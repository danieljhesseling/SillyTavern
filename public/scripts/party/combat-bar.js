/**
 * La barra de acciones de D&D 2024 (tanda 10, wiki/maquetas/ENCARGO_COMBATE_VTT.md): la foto del
 * turno que dibuja `game-engine/ui/combat-vtt/action-bar.js`, y lo que pasa al pulsar cada cosa.
 *
 * La foto (`buildCombatBarSnapshot`) lee el motor y no cambia nada: el arma y su maestría, a
 * quién llegas y con qué probabilidad, tus conjuros con sus espacios, tus pociones, si te queda
 * la otra mano. Los menús salen de ella (`ui/combat-vtt/action-menus.js`).
 *
 * Lo que se pulsa llega como un `pick` («attack:e1», «unarmed:agarrar:e2», «drink:p1»…) a
 * `runCombatBarPick`, que llama a lo que ya existía (atacar, las maniobras, los conjuros, lanzar
 * aceite) y a lo nuevo de 2024 que vive aquí: el impacto sin armas con su CD, Correr, Ocultarse
 * contra 15, Estudiar, beber o dar una poción, la otra mano, cambiar de arma y tirarse al suelo.
 */

import { getAbilityModifier, consumeItemInInventory } from '../dnd-system.js';
import { getCurrentWorldEnemies } from '../world-info.js';
import { tokenArt } from '../world-map-renderer.js';
import { firstArt, isPlainFace } from '../game-engine/ui/pixel-art.js';
import {
    rollDiceDetailed, getDistanceInFeet, getAttackRangeFeet, getPlayerAttackModifier, getPlayerDamageFormula, getPlayerAttackParts, getPlayerAttackBonus,
} from './combat-rules.js';
import { describeAttackBonus, describeEdgeReason } from '../game-engine/rules/attack-bonus.js';
import { hasAction, useAction, spendMovement } from '../game-engine/combat/turn-machine.js';
import {
    attackEdge, judgeManeuvers, recordManeuver, noteKnockdown, rollWithEdge, describeEdge,
} from '../game-engine/combat/maneuvers.js';
import { judgeThrows, sceneryNear, judgeSceneryThrow } from '../game-engine/combat/throwables.js';
import { judgeMagicItems, magicItemsOf } from '../game-engine/rules/magic-items.js';
import { hitChance } from '../game-engine/combat/forecast.js';
import { brawlOf } from '../game-engine/combat/brawl.js';
import { noteDealt } from '../game-engine/combat/tally.js';
import { weaponOf, weaponBonus, equippedIn } from '../game-engine/rules/equipment.js';
import {
    masteryOf, isLightWeapon, isRangedWeapon, isWeaponItem, hasWeaponMastery, turnFlags, markTurn, readTactics,
    noteStudied, combineEdge, hasVex,
} from '../game-engine/rules/weapon-mastery.js';
import { unarmedDamage, unarmedDC, escapeSave, freeHand, saveFails, saveLine } from '../game-engine/rules/unarmed.js';
import {
    ACTIONS_2024, HIDE_DC, canHide2024, studyDC, studyFacts, newFacts, potionsOf, canStand, offHandWeaponOf, judgeOffHand,
} from '../game-engine/rules/actions-2024.js';
import { canUseAbility, usesLeft } from '../game-engine/rules/abilities.js';
import { describeArea, isArea } from '../game-engine/rules/area.js';
import { ABILITY_NAMES } from '../game-engine/rules/spell-catalogue.js';
import { slotsLeft, slotsFor, casterOf } from '../game-engine/rules/spell-slots.js';
import { chargesLeft, CIRCLE_CHARGES } from '../game-engine/rules/grimoire.js';
import { skillModifier, proficiencyBonus } from '../game-engine/rules/checks.js';
import { rollLine } from '../game-engine/rules/roll-line.js';
import { traitBonus } from '../game-engine/campaign/feats.js';
import { perkBonus } from '../game-engine/rules/level-perks.js';
import { clearDeathSaves } from '../game-engine/rules/death-saves.js';
import { needsStabilizing, stabilizeCheck, stableSaves, STABILIZE_DC } from '../game-engine/rules/stabilize.js';
import { gendered } from '../game-engine/campaign/grammar.js';
import {
    buildBar, buildAttackMenu, buildMagicMenu, buildActionsMenu, buildBonusMenu,
} from '../game-engine/ui/combat-vtt/action-menus.js';
import { combatEncounter, partyMembers } from './state.js';
import {
    getAliveEnemies, getCurrentActingMember, getCurrentTurnEntry, getRemainingMovementFeet, getTargetArmorClass,
    heightFor, partyCell, partyFlanks, saveCombatState, speedOf, enemyTokenId,
} from './combat-state.js';
import {
    abilityOf, abilityVictims, applyTimedCondition, carriedNames, castsLikeFifth, classRowOf, getAbilityCatalogue, knownAbilitiesOf, spellAbilityAt,
    useAbility, useMagicItem,
} from './magic.js';
import {
    attackEnemyById, hideCheck, performManeuver, pushEnemyAway, throwItem, throwScenery, attackLine,
} from './player-actions.js';
import { attackHindrance, boardVisibility, getActiveBoardContext, archetypeOf } from './board.js';
import { checkScenarioOutcome, endCombat, judgeCurrentScenario } from './combat-flow.js';
import { floatOnToken, initiativeShowing, showCombatDiceRoll } from './combat-log.js';
import { postCombatNarration, soundCue } from './narration.js';
import { savePartyState } from './roster.js';
import { renderLocationMapsPreview } from './board-view.js';
import { canParleyNow, openParleyChoice } from './avoid.js';
import { recordFeat } from './companions.js';
import { fxMark, stageAttack } from './combat-fx.js';

/** @typedef {import('../game-engine/ui/combat-vtt/action-menus.js').BarSnapshot} BarSnapshot */
/** @typedef {import('../game-engine/ui/combat-vtt/action-menus.js').TargetView} TargetView */
/** @typedef {import('../game-engine/ui/combat-vtt/action-menus.js').WeaponView} WeaponView */

/** Lo que dice el motor en pies abreviados («30 ft»), dicho para leerlo. */
const pies = (/** @type {any} */ value) => String(value ?? '').replace(/(\d+)\s*ft\b/g, '$1 pies');

/**
 * La casilla de alguien del combate.
 *
 * @param {any} who
 * @returns {{x: number, y: number}}
 */
function cellOf(who) {
    return {
        x: Number(who?.gridX ?? who?.mapPosition?.gridX) || 0,
        y: Number(who?.gridY ?? who?.mapPosition?.gridY) || 0,
    };
}

/**
 * La distancia en pies entre dos del combate.
 *
 * @param {any} a
 * @param {any} b
 * @returns {number}
 */
function feetBetween(a, b) {
    const from = cellOf(a);
    const to = cellOf(b);
    return getDistanceInFeet(from.x, from.y, to.x, to.y);
}

/**
 * El dibujo de un enemigo: el suyo si lo trae, si no su bicho en pixel.
 *
 * @param {any} enemy
 * @returns {string}
 */
function enemyFace(enemy) {
    const archetype = archetypeOf(enemy?.archetype ? enemy : getCurrentWorldEnemies().find(t => String(t.id) === String(enemy?.templateId)));
    const drawn = tokenArt({ isEnemy: true, name: String(enemy?.name ?? ''), avatar: String(enemy?.avatar ?? ''), archetype });
    if (drawn) return drawn;
    return isPlainFace(enemy?.avatar) ? '' : String(enemy.avatar);
}

/**
 * La cara de alguien del grupo.
 *
 * @param {any} member
 * @returns {string}
 */
function memberFace(member) {
    const drawn = tokenArt({ name: String(member?.name ?? ''), avatar: String(member?.avatar ?? ''), className: member?.class, gender: member?.gender, race: member?.race });
    if (drawn) return drawn;
    return isPlainFace(member?.avatar) ? '' : String(member.avatar);
}

/**
 * Lo que tiene quien ataca de acertarle a `enemy` con `wielder` (con esa arma puesta), y si va
 * con ventaja: las mismas cuentas que el golpe.
 *
 * @param {any} member
 * @param {any} wielder
 * @param {any} enemy
 * @param {number} distanceFeet
 * Con el número explicado en `note` («+5 al ataque: +3 de Fuerza y +2 de competencia») y, si
 * va con ventaja o desventaja, por qué, en `edge` («desventaja: está en el suelo…»).
 *
 * @returns {{chance: number, edge: string, note: string}}
 */
function forecastAgainst(member, wielder, enemy, distanceFeet) {
    const rangeFeet = getAttackRangeFeet(wielder);
    const parts = getPlayerAttackParts(wielder, rangeFeet, [
        { label: 'del arma', value: weaponBonus(wielder) },
        { label: 'contra los de su clase', value: traitBonus(member, enemy.name) },
        { label: 'de lo aprendido', value: perkBonus(member, 'attack') },
    ]);
    const attackMod = parts.total;
    const base = attackEdge({
        targetId: String(enemy.instanceId),
        height: heightFor(partyCell(member), cellOf(enemy)),
        targetConditions: enemy.activeConditions ?? [],
        attackerConditions: member.activeConditions ?? [],
        distanceFeet,
        maneuvers: combatEncounter.maneuvers,
        byParty: true,
        flanked: partyFlanks(member, enemy),
        attackerId: String(member.id),
        hindered: attackHindrance(partyCell(member), cellOf(enemy), distanceFeet),
    });
    const vexed = hasVex(combatEncounter.tactics, { by: String(member.id), target: String(enemy.instanceId), round: Number(combatEncounter.round) || 1 });
    const edge = combineEdge(base, vexed ? ['le tienes molestado'] : []);
    const { ac } = getTargetArmorClass(enemy, member);
    return {
        chance: Math.round(hitChance(attackMod, ac, edge.mode) * 100),
        edge: describeEdgeReason(edge.mode, edge.reasons),
        note: describeAttackBonus(parts),
    };
}

/**
 * Un enemigo como lo enseña una lista.
 *
 * @param {any} member
 * @param {any} enemy
 * @returns {TargetView & {cr: number}}
 */
function enemyView(member, enemy) {
    const armor = getTargetArmorClass(enemy, member);
    return {
        id: String(enemy.instanceId),
        name: String(enemy.name),
        art: enemyFace(enemy),
        hp: Number(enemy.currentHp) || 0,
        maxHp: Number(enemy.maxHp) || 0,
        ac: armor.ac,
        distanceFeet: feetBetween(member, enemy),
        cr: Number(enemy.cr) || 0,
        // J12.18: su ficha (para encenderla al pasar por él en el menú), su bando y lo que le tapa.
        token: enemyTokenId(enemy),
        side: 'enemy',
        cover: Number(armor.cover) || 0,
    };
}

/**
 * J12.18: uno de los tuyos como lo enseña una lista, con su ficha (para encenderla en azul).
 *
 * @param {any} member Quien juega.
 * @param {any} who
 * @returns {TargetView}
 */
function allyView(member, who) {
    return {
        id: String(who.id), name: String(who.name), art: memberFace(who), hp: Number(who.hp) || 0, maxHp: Number(who.maxHp) || 0,
        distanceFeet: feetBetween(member, who), token: who.id, side: 'ally',
    };
}

/**
 * J12.18: lo lejos que se ve en la pelea (de noche, con niebla), o `Infinity`: los que no alcanzas
 * salen en el menú, apagados, solo si se ven.
 *
 * @returns {number}
 */
function sightFeet() {
    const max = boardVisibility().maxFeet;
    return max === null || max === undefined || !Number.isFinite(Number(max)) ? Infinity : Number(max);
}

/**
 * J12.18: un conjuro o una técnica contra alguien, lo que se sabe antes: si es de ataque, lo que
 * tienes de acertar; si salva él, la CD y con qué; si es un área (o va a varios), a quién más
 * pilla y sus casillas.
 *
 * @param {any} member
 * @param {any} ability
 * @param {any} who
 * @param {boolean} isEnemy
 * @param {number} distanceFeet
 * @returns {Partial<TargetView>}
 */
function abilityForecast(member, ability, who, isEnemy, distanceFeet) {
    /** @type {Partial<TargetView>} */
    const out = {};
    if (isEnemy && ability.resolution === 'attack') {
        const spell = typeof ability.spellLevel === 'number' && typeof ability.attackBonus === 'number';
        // Una técnica ataca como el arma: característica y competencia (como `useAbility` en magic.js).
        const mod = spell ? Number(ability.attackBonus) : getPlayerAttackBonus(member, Number(ability.rangeFeet) || 5);
        const edge = attackEdge({
            targetId: String(who.instanceId),
            height: heightFor(partyCell(member), cellOf(who)),
            targetConditions: who.activeConditions ?? [],
            attackerConditions: member.activeConditions ?? [],
            distanceFeet,
            maneuvers: combatEncounter.maneuvers,
            byParty: true,
            flanked: (Number(ability.rangeFeet) || 5) <= 5 && partyFlanks(member, who),
            attackerId: String(member.id),
            hindered: attackHindrance(partyCell(member), cellOf(who), distanceFeet),
        });
        out.chance = Math.round(hitChance(mod, getTargetArmorClass(who, member).ac, edge.mode) * 100);
        out.edge = describeEdgeReason(edge.mode, edge.reasons);
    }
    if (ability.resolution === 'save' && Number(ability.saveDc) > 0) {
        out.dc = Number(ability.saveDc);
        out.save = /** @type {Record<string, string>} */ (ABILITY_NAMES)[String(ability.saveAbility)] ?? '';
    }
    if (isArea(ability.area) || (Number(ability.targets) || 1) > 1) {
        try {
            const { cells, victims } = abilityVictims(member, 'party', ability, who);
            out.caught = victims.map(v => (v.kind === 'enemy'
                ? { id: String(v.ref.instanceId), token: enemyTokenId(v.ref), name: String(v.ref.name), side: /** @type {const} */ ('enemy') }
                : { id: String(v.ref.id), token: v.ref.id, name: String(v.ref.name), side: /** @type {const} */ ('ally') }));
            if (isArea(ability.area)) out.cells = cells.map(c => ({ x: Number(c.x) || 0, y: Number(c.y) || 0 }));
        } catch (error) {
            console.warn('[combat-bar] el área de', ability?.name, error);
        }
    }
    return out;
}

/**
 * Quien ataca con otra arma puesta (no se guarda).
 *
 * @param {any} member
 * @param {any} weapon
 * @returns {any}
 */
function wielding(member, weapon) {
    return weapon ? { ...member, equippedItems: { ...(member.equippedItems ?? {}), weapon: weapon.id } } : member;
}

/**
 * Un arma como tarjeta: su daño con el modificador, su maestría y a quién llega.
 *
 * @param {any} member
 * @param {any} weapon
 * @param {{offHand?: boolean}} [opts]
 * @returns {WeaponView}
 */
function weaponView(member, weapon, { offHand = false } = {}) {
    const wielder = wielding(member, weapon);
    const rangeFeet = getAttackRangeFeet(wielder);
    const formula = getPlayerDamageFormula(wielder, rangeFeet);
    const abilityMod = getPlayerAttackModifier(wielder, rangeFeet);
    const mod = (offHand ? Math.min(0, abilityMod) : Math.max(0, abilityMod)) + weaponBonus(wielder);
    // J12.18: primero a los que llegas; detrás, los que se ven pero no alcanzas, apagados y diciendo
    // a cuántos pies están.
    const sight = sightFeet();
    const all = getAliveEnemies()
        .map(enemy => ({ enemy, distanceFeet: feetBetween(member, enemy) }))
        .sort((a, b) => a.distanceFeet - b.distanceFeet);
    const name = `tu ${weapon ? String(weapon.name).toLowerCase() : 'puño'}`;
    const targets = [
        ...all.filter(({ distanceFeet }) => distanceFeet <= rangeFeet)
            .map(({ enemy, distanceFeet }) => ({ ...enemyView(member, enemy), ...forecastAgainst(member, wielder, enemy, distanceFeet) })),
        ...all.filter(({ distanceFeet }) => distanceFeet > rangeFeet && distanceFeet <= sight)
            .map(({ enemy, distanceFeet }) => ({
                ...enemyView(member, enemy), enabled: false, reason: `Está a ${distanceFeet} pies; ${name} llega a ${rangeFeet}.`,
            })),
    ];
    return {
        id: String(weapon?.id ?? 'puños'),
        name: weapon ? String(weapon.name) : 'Puños',
        art: weapon ? firstArt('item', { name: String(weapon.name) }) : '',
        mastery: weapon ? masteryOf(weapon) : '',
        masteryOn: hasWeaponMastery(member) && !brawlOf(combatEncounter),
        damage: `${formula}${mod > 0 ? `+${mod}` : mod < 0 ? `${mod}` : ''}`,
        damageType: String(weapon?.damageType || 'contundente'),
        reachFeet: rangeFeet,
        light: weapon ? isLightWeapon(weapon) : false,
        ranged: weapon ? isRangedWeapon(weapon) : false,
        hands: Number(weapon?.hands) || 1,
        targets,
    };
}

/**
 * Las armas que lleva encima además de la puesta.
 *
 * @param {any} member
 * @returns {any[]}
 */
function spareWeaponsOf(member) {
    const main = weaponOf(member);
    return (Array.isArray(member?.items) ? member.items : []).filter(item => isWeaponItem(item) && item.id !== main?.id);
}

/**
 * Si puede cambiar de arma gratis ahora, y por qué no. A dos manos no se coge con escudo.
 *
 * @param {any} member
 * @returns {{ok: boolean, reason: string}}
 */
function swapVerdict(member) {
    if (brawlOf(combatEncounter)) return { ok: false, reason: 'En una pelea sin muertes no se sacan armas.' };
    const turn = turnFlags(combatEncounter.tactics, String(member.id), Number(combatEncounter.round) || 1);
    if (turn.swapped) return { ok: false, reason: 'Ya has cambiado de arma este turno.' };
    return { ok: true, reason: '' };
}

/**
 * El daño de un conjuro, con sus rayos si va en varios (Proyectil mágico: «3 × 1d4+1»).
 *
 * @param {any} ability
 * @returns {string}
 */
function damageWithRays(ability) {
    const damage = String(ability?.damage || '');
    const rays = Number(ability?.rays) || 0;
    return damage && rays > 1 ? `${rays} × ${damage}` : damage;
}

/**
 * J19.3: los espacios con que alguien puede lanzar ahora un conjuro con nivel (el suyo y los
 * mayores que le quedan), con lo que hace con cada uno. Los de pacto son todos del mismo nivel:
 * no hay qué elegir.
 *
 * @param {any} member
 * @param {any} ability
 * @returns {import('../game-engine/ui/combat-vtt/action-menus.js').Upcast[]}
 */
function upcastsOf(member, ability) {
    if (!(Number(ability?.spellLevel) > 0) || !castsLikeFifth(member)) return [];
    const classRow = classRowOf(member);
    if (!casterOf(classRow)) return [];
    const left = slotsLeft(member, classRow);
    if (left.pactLevel > 0) return [];
    /** @type {import('../game-engine/ui/combat-vtt/action-menus.js').Upcast[]} */
    const out = [];
    for (let level = Number(ability.spellLevel); level <= 9; level++) {
        const count = Number(left.slots[level]) || 0;
        if (count <= 0) continue;
        const at = spellAbilityAt(member, String(ability.id), level);
        if (!at) continue;
        out.push({ level, left: count, damage: damageWithRays(at), healing: String(at.healing || ''), targets: Number(/** @type {any} */ (at).targets) || 1 });
    }
    return out;
}

/**
 * Los conjuros y técnicas de alguien, juzgados contra cada posible objetivo.
 *
 * @param {any} member
 * @returns {import('../game-engine/ui/combat-vtt/action-menus.js').AbilityView[]}
 */
function abilityViews(member) {
    const action = hasAction(combatEncounter, 'action');
    const bonus = hasAction(combatEncounter, 'bonus');
    const carried = carriedNames();
    const enemies = getAliveEnemies();
    const allies = partyMembers.filter(m => !m.dead && (Number(m.hp) || 0) > 0);
    return knownAbilitiesOf(member)
        .filter(ability => ability.combat !== false)
        .map(ability => {
            const verdict = canUseAbility({ member, ability, distanceFeet: 0, hasAction: true, hasBonus: true, carried });
            const judge = (/** @type {any} */ who, /** @type {boolean} */ isEnemy) => {
                const distanceFeet = feetBetween(member, who);
                const v = canUseAbility({ member, ability, distanceFeet, hasAction: action, hasBonus: bonus, targetAlive: true, carried });
                return {
                    ...(isEnemy ? enemyView(member, who) : allyView(member, who)),
                    // J12.18: lo que tienes de acertar (o su CD) y, si es un área, a quién pilla.
                    ...(v.ok ? abilityForecast(member, ability, who, isEnemy, distanceFeet) : {}),
                    enabled: v.ok, reason: pies(v.reason),
                };
            };
            const spellLevel = typeof ability.spellLevel === 'number' ? ability.spellLevel
                : typeof ability.circle === 'number' ? ability.circle : null;
            const left = usesLeft(member, ability);
            return {
                id: String(ability.id),
                name: String(ability.name),
                art: firstArt('ability', { id: String(ability.id), name: String(ability.name) }),
                desc: pies(ability.description || ''),
                cost: /** @type {'action'|'bonus'|'free'} */ (ability.cost),
                target: /** @type {'enemy'|'ally'|'self'} */ (ability.target),
                rangeFeet: Number(ability.rangeFeet) || 0,
                spellLevel,
                slotLevel: Number(ability.slotLevel) || 0,
                damage: damageWithRays(ability),
                damageType: String(ability.damageType || ''),
                healing: String(ability.healing || ''),
                concentration: Boolean(ability.concentration),
                area: pies(describeArea(ability.area)),
                uses: spellLevel === null && Number.isFinite(left) ? `Quedan ${left}` : '',
                upcasts: upcastsOf(member, ability),
                enabled: verdict.ok,
                reason: pies(verdict.reason),
                targets: ability.target === 'enemy' ? enemies.map(e => judge(e, true))
                    : ability.target === 'ally' ? allies.map(a => judge(a, false)) : [],
            };
        });
}

/**
 * Las gemas de Magia: lo que queda de cada nivel de espacio (o de cada círculo de cargas).
 *
 * @param {any} member
 * @returns {Array<{level: number, left: number, max: number}>}
 */
function slotGems(member) {
    const classRow = classRowOf(member);
    if (casterOf(classRow)) {
        const table = slotsFor(classRow, member?.level);
        const left = slotsLeft(member, classRow);
        /** @type {Array<{level: number, left: number, max: number}>} */
        const gems = Object.entries(table.slots)
            .map(([level, max]) => ({ level: Number(level), left: left.slots[Number(level)] ?? 0, max: Number(max) || 0 }))
            .filter(g => g.max > 0);
        if (table.pact) gems.push({ level: table.pact.level, left: left.pact, max: table.pact.count });
        return gems;
    }
    // La capa ligera: cargas por círculo, del que sepa algún conjuro.
    const circles = new Set(knownAbilitiesOf(member).filter(a => typeof a.circle === 'number' && a.circle > 0).map(a => Number(a.circle)));
    return [...circles].sort((a, b) => a - b)
        .map(circle => ({ level: circle, left: chargesLeft(member, circle), max: Number(/** @type {Record<number, number>} */ (CIRCLE_CHARGES)[circle]) || 0 }));
}

/**
 * La foto del turno, para la barra y sus menús. Con `full: false`, la ligera: lo que dibuja la
 * barra sola (se pinta en cada repintado del tablero); los menús piden la entera al abrirse.
 *
 * @param {{full?: boolean}} [opts]
 * @returns {BarSnapshot}
 */
export function buildCombatBarSnapshot({ full = true } = {}) {
    const entry = getCurrentTurnEntry();
    const member = getCurrentActingMember();
    // H19 (tanda 22): mientras sale la tarjeta de la iniciativa, la barra espera: no es turno de nadie.
    const rolling = initiativeShowing();
    const isPlayerTurn = Boolean(combatEncounter.active && entry && !entry.isEnemy && member) && !rolling;
    const round = Number(combatEncounter.round) || 1;
    const blank = {
        active: Boolean(combatEncounter.active), isPlayerTurn: false,
        turnLabel: rolling ? 'Tirando la iniciativa' : entry ? `Turno de ${entry.name}` : 'Combate en curso', actorName: String(entry?.name ?? ''),
        ready: { action: false, bonus: false, reaction: false }, move: { left: 0, speed: 0 },
        posture: { prone: false, standCost: 0, canStand: false, standWhy: '' }, canAuto: false, canParley: false, hasMastery: false,
        weapon: null, spareWeapons: [], swap: { ok: false, reason: 'No es tu turno.' }, enemies: [], adjacentAllies: [], dying: [],
        unarmed: { damage: 1, dc: 10, freeHand: { ok: false, reason: '' }, targets: [] }, abilities: [], slots: [], magicItems: [], potions: [],
        offHand: { weapon: null, ok: false, reason: 'No es tu turno.', free: false }, throws: [], maneuvers: [], hide: { ok: false, reason: '' }, studied: {},
    };
    if (!isPlayerTurn || !member) return blank;

    const speed = speedOf(member);
    const left = getRemainingMovementFeet(member);
    const prone = (Array.isArray(member.activeConditions) ? member.activeConditions : []).includes('Prone');
    const stand = canStand({ left, speed });
    const action = hasAction(combatEncounter, 'action');
    const bonus = hasAction(combatEncounter, 'bonus');
    const reaction = !(combatEncounter.turnState?.reactionUsed);
    const turn = turnFlags(combatEncounter.tactics, String(member.id), round);
    if (!full) {
        return {
            ...blank,
            isPlayerTurn: true,
            turnLabel: `Turno de ${member.name}`,
            actorName: String(member.name),
            ready: { action, bonus, reaction },
            move: { left, speed },
            posture: { prone, standCost: stand.cost, canStand: stand.ok, standWhy: stand.reason },
            canAuto: String(member.id) !== String(partyMembers[0]?.id),
            magicCount: knownAbilitiesOf(member).filter(a => a.combat !== false && (typeof a.spellLevel === 'number' || typeof a.circle === 'number')).length
                + magicItemsOf(member).length,
        };
    }

    const main = weaponOf(member);
    const brawl = Boolean(brawlOf(combatEncounter));
    const weapon = weaponView(member, brawl ? null : main);
    const spareWeapons = brawl ? [] : spareWeaponsOf(member).map(item => weaponView(member, item));
    const enemies = getAliveEnemies().map(enemy => enemyView(member, enemy)).sort((a, b) => a.distanceFeet - b.distanceFeet);
    const close = enemies.filter(e => e.distanceFeet <= 5);
    const adjacentAllies = partyMembers
        .filter(m => String(m.id) !== String(member.id) && !m.dead)
        .map(m => allyView(member, m))
        .filter(m => m.distanceFeet <= 5);
    // Tanda 16: los tuyos que están en el suelo tirando salvaciones (para Estabilizar).
    const dying = partyMembers
        .filter(m => String(m.id) !== String(member.id) && needsStabilizing(m))
        .map(m => ({ ...allyView(member, m), hp: 0 }))
        .sort((a, b) => a.distanceFeet - b.distanceFeet);

    // La otra mano: otra ligera, tras atacar con la primera.
    const offItem = brawl ? null : offHandWeaponOf({ items: member.items, main, shield: equippedIn(member, 'shield') });
    const nick = Boolean(offItem) && hasWeaponMastery(member) && masteryOf(offItem) === 'nick' && !turn.nicked;
    const offJudge = judgeOffHand({ offHand: offItem, attackedWith: turn.lightWeapon, used: turn.offhand, hasBonus: bonus, nick });

    const x = cellOf(member).x;
    const y = cellOf(member).y;
    const plain = enemies.map(e => ({ id: e.id, name: e.name, distanceFeet: e.distanceFeet }));
    const board = getActiveBoardContext();
    const scenery = judgeSceneryThrow({ near: sceneryNear(board.terrain, x, y, board.gridWidth, board.gridHeight), hasAction: action, enemies: plain });
    const visibility = boardVisibility();

    return {
        active: true,
        isPlayerTurn: true,
        turnLabel: `Turno de ${member.name}`,
        actorName: String(member.name),
        ready: { action, bonus, reaction },
        move: { left, speed },
        posture: { prone, standCost: stand.cost, canStand: stand.ok, standWhy: stand.reason },
        canAuto: String(member.id) !== String(partyMembers[0]?.id),
        canParley: canParleyNow(),
        hasMastery: hasWeaponMastery(member),
        weapon,
        spareWeapons,
        swap: swapVerdict(member),
        enemies,
        adjacentAllies,
        dying,
        unarmed: {
            damage: unarmedDamage(member).damage,
            dc: unarmedDC(member),
            // J12.7: en una pelea sin muertes el arma va guardada: queda una mano para agarrar.
            freeHand: freeHand({ weapon: brawl ? null : main, shield: equippedIn(member, 'shield') }),
            targets: close.map(e => ({ ...e, note: `salva con ${escapeSave(getAliveEnemies().find(en => String(en.instanceId) === e.id)).label}` })),
        },
        abilities: abilityViews(member),
        slots: slotGems(member),
        magicItems: judgeMagicItems({
            member,
            hasAction: action,
            enemies: plain,
            allies: partyMembers.filter(m => (Number(m.hp) || 0) > 0).map(m => ({ id: String(m.id), name: String(m.name), distanceFeet: feetBetween(member, m) })),
            abilityOf: (id) => getAbilityCatalogue().find(a => a.id === id),
        }),
        potions: potionsOf(member),
        offHand: { weapon: offItem ? weaponView(member, offItem, { offHand: true }) : null, ok: offJudge.ok, reason: offJudge.reason, free: offJudge.free },
        throws: [
            ...judgeThrows({ member, hasAction: action, enemies: plain }),
            ...(scenery ? [scenery] : []),
        ],
        maneuvers: judgeManeuvers({ hasAction: action, enemies: plain, hide: hideCheck(member) }),
        hide: canHide2024({ covered: hideCheck(member), dim: visibility.maxFeet !== null }),
        studied: Object.fromEntries(Object.entries(readTactics(combatEncounter.tactics).studied).map(([id, facts]) => [id, facts.length])),
        // J12.18: quien juega, para encender su ficha con lo que se hace a sí mismo.
        actor: { id: String(member.id), token: member.id },
    };
}

/**
 * Lo que pide `game-shell.js` para dibujar la barra nueva: la barra, y los menús bajo demanda
 * (de la misma foto: lo que se ve en la barra y en el menú no puede discrepar).
 *
 * @returns {{bar: import('../game-engine/ui/combat-vtt/action-menus.js').BarView, menu: (id: string, filter?: string, slots?: Record<string, number>) => import('../game-engine/ui/combat-vtt/action-menus.js').MenuView|null}}
 */
export function buildCombatBarView() {
    const light = buildCombatBarSnapshot({ full: false });
    /** @type {BarSnapshot|null} */
    let whole = null;
    return {
        bar: buildBar(light),
        menu: (id, filter = 'todos', slots = {}) => {
            if (!light.isPlayerTurn) return null;
            whole ??= buildCombatBarSnapshot();
            const snapshot = whole;
            if (id === 'atacar') return buildAttackMenu(snapshot);
            if (id === 'magia') return buildMagicMenu(snapshot, filter, slots);
            if (id === 'acciones') return buildActionsMenu(snapshot, ACTIONS_2024, { hideDc: HIDE_DC, studyDc: studyDC });
            if (id === 'adicional') return buildBonusMenu(snapshot, slots);
            return null;
        },
    };
}

// ---------------------------------------------------------------- lo que pasa al pulsar

/**
 * Quien juega, si es su turno; si no, un aviso y nada.
 *
 * @returns {any}
 */
function actingMember() {
    const entry = getCurrentTurnEntry();
    const member = getCurrentActingMember();
    if (!combatEncounter.active || !entry || entry.isEnemy || !member) {
        toastr.warning('No hay un turno de jugador activo.');
        return null;
    }
    return member;
}

/**
 * Tras algo que puede tumbar al último: ganar si toca, y repintar.
 */
function afterBlow() {
    saveCombatState();
    savePartyState();
    if (!checkScenarioOutcome() && getAliveEnemies().length === 0 && !judgeCurrentScenario()) {
        postCombatNarration('🏆 [COMBAT] Todos los enemigos han sido derrotados.');
        endCombat('victory');
    }
    renderLocationMapsPreview();
}

/**
 * El enemigo pegado a quien juega, por su id; si no, un aviso.
 *
 * @param {any} member
 * @param {string} targetId
 * @param {number} reach
 * @returns {any}
 */
function enemyInReach(member, targetId, reach) {
    const target = getAliveEnemies().find(e => String(e.instanceId) === String(targetId));
    if (!target) {
        toastr.warning('Ese enemigo ya no está en pie.');
        return null;
    }
    if (feetBetween(member, target) > reach) {
        toastr.warning(`${target.name} está demasiado lejos: tiene que estar a ${reach} pies.`);
        return null;
    }
    return target;
}

/**
 * El impacto sin armas de 2024: el golpe, agarrar o empujar (apartar o tirar al suelo).
 *
 * @param {'golpe'|'agarrar'|'apartar'|'tirar'} mode
 * @param {string} targetId
 * @returns {string}
 */
export function unarmedStrike(mode, targetId) {
    const member = actingMember();
    if (!member) return '';
    if (!hasAction(combatEncounter, 'action')) {
        toastr.warning('Tu accion de este turno ya fue usada.');
        return '';
    }
    const target = enemyInReach(member, targetId, 5);
    if (!target) return '';
    if (mode === 'agarrar') {
        const hand = freeHand({ weapon: brawlOf(combatEncounter) ? null : weaponOf(member), shield: equippedIn(member, 'shield') });
        if (!hand.ok) {
            toastr.warning(hand.reason, 'Agarrar');
            return '';
        }
    }
    Object.assign(combatEncounter, useAction(combatEncounter, 'action'));
    /** @type {string[]} */
    const lines = [];
    const id = String(target.instanceId);
    const round = Number(combatEncounter.round) || 1;

    if (mode === 'golpe') {
        const strength = getAbilityModifier(Number(member.strength) || 10);
        // Con los puños todo el mundo tiene competencia (2024): Fuerza y competencia.
        const attackMod = strength + proficiencyBonus(member.level) + traitBonus(member, target.name) + perkBonus(member, 'attack');
        const distanceFeet = feetBetween(member, target);
        const edge = attackEdge({
            targetId: id, height: heightFor(partyCell(member), cellOf(target)), targetConditions: target.activeConditions ?? [],
            attackerConditions: member.activeConditions ?? [], distanceFeet, maneuvers: combatEncounter.maneuvers, byParty: true,
            flanked: partyFlanks(member, target), attackerId: String(member.id), hindered: attackHindrance(partyCell(member), cellOf(target), distanceFeet),
        });
        const edged = rollWithEdge(() => rollDiceDetailed('1d20', 20).total, edge.mode);
        const natural = edged.natural;
        const total = natural + attackMod;
        const { ac, cover } = getTargetArmorClass(target, member);
        const hit = natural === 20 || (natural !== 1 && total >= ac);
        soundCue(hit ? 'hit' : 'miss');
        showCombatDiceRoll({
            title: `${member.name} golpea sin armas`, subtitle: `Objetivo: ${target.name}`, formula: `1d20${attackMod >= 0 ? '+' : ''}${attackMod}`,
            detail: `d20(${natural}) ${attackMod >= 0 ? '+' : ''}${attackMod} = ${total}`, total, dc: ac, natural, glyph: 'd20',
            // Tanda 17: en la secuencia del combate.
            stage: { by: member, at: target, hit, roll: edged, edge: edge.mode, against: 'CA', style: 'melee' },
        });
        lines.push(`👊 ${member.name} le suelta un golpe a ${target.name}.`);
        lines.push(attackLine({ who: member.name, at: target.name, total, ac, hit, natural, modifier: attackMod, cover, edge: describeEdge(edged, edge.mode, edge.reasons) }));
        if (hit) {
            const damage = unarmedDamage(member).damage;
            target.currentHp = Math.max(0, (Number(target.currentHp) || 0) - damage);
            combatEncounter.tally = noteDealt(combatEncounter.tally, member.id, damage, target.currentHp === 0);
            floatOnToken(enemyTokenId(target), `-${damage}`, 'damage');
            lines.push(`✅ ${damage} de daño contundente. ${target.name}: ${target.currentHp}/${target.maxHp}.`);
            if (target.currentHp === 0) {
                lines.push(`☠️ ${target.name} cae derrotado.`);
                recordFeat(member, 'kill', String(target.name));
            }
        } else {
            lines.push('❌ Resultado: fallo.');
        }
    } else {
        // Agarrar y empujar: salva él, con su Fuerza o su Destreza, contra tu CD.
        const dc = unarmedDC(member);
        const save = escapeSave(target);
        const natural = rollDiceDetailed('1d20', 20).total;
        const fails = saveFails({ dc, saveTotal: natural + save.modifier });
        const verb = mode === 'agarrar' ? 'agarrar' : mode === 'apartar' ? 'apartar de un empujón' : 'tirar al suelo';
        showCombatDiceRoll({
            title: `${target.name} se resiste`, subtitle: `${member.name} intenta ${verb}`, formula: `1d20${save.modifier >= 0 ? '+' : ''}${save.modifier}`,
            detail: `d20(${natural}) ${save.modifier >= 0 ? '+' : ''}${save.modifier} = ${natural + save.modifier} contra CD ${dc}`,
            total: natural + save.modifier, dc, natural, glyph: 'd20',
            stage: { by: member, at: target, hit: !fails, against: 'CD', style: 'melee', save: true, side: 'enemy' },
        });
        lines.push(`🤼 ${member.name} intenta ${verb} a ${target.name}.`);
        lines.push(saveLine({ who: target.name, label: save.label, natural, modifier: save.modifier, dc }));
        if (!fails) {
            lines.push(`❌ ${target.name} se zafa.`);
        } else if (mode === 'agarrar') {
            applyTimedCondition(target, id, 'Grappled', 1);
            lines.push(`✅ ${target.name} queda agarrado: no se mueve hasta tu próximo turno.`);
        } else if (mode === 'apartar') {
            lines.push(...pushEnemyAway(member, target, 1));
        } else {
            applyTimedCondition(target, id, 'Prone', 1);
            combatEncounter.maneuvers = noteKnockdown(combatEncounter.maneuvers, id, String(member.id), round);
            lines.push(`✅ ${target.name} cae al suelo: pegarle de cerca va con ventaja; de lejos, con desventaja.`);
        }
    }
    postCombatNarration(`[COMBAT] ${lines.join('\n')}`);
    afterBlow();
    return `${member.name}: ${mode}`;
}

/**
 * Correr: lo suyo otra vez este turno (la acción de 2024).
 *
 * @returns {string}
 */
export function dashAction() {
    const member = actingMember();
    if (!member) return '';
    if (!hasAction(combatEncounter, 'action')) {
        toastr.warning('Tu accion de este turno ya fue usada.');
        return '';
    }
    Object.assign(combatEncounter, useAction(combatEncounter, 'action'));
    const before = getRemainingMovementFeet(member);
    applyTimedCondition(member, String(member.id), 'Corriendo', 1);
    const after = getRemainingMovementFeet(member);
    postCombatNarration(`[COMBAT] 🏃 ${member.name} echa a correr: este turno anda ${after - before} pies más. Le quedan ${after}.`);
    saveCombatState();
    savePartyState();
    renderLocationMapsPreview();
    return `${member.name}: correr`;
}

/**
 * Ocultarse a la manera de 2024: Sigilo contra 15, tras algo que tape o con poca luz. Si sale,
 * Invisible: nadie le ve hasta que ataque.
 *
 * @returns {string}
 */
export function hide2024() {
    const member = actingMember();
    if (!member) return '';
    if (!hasAction(combatEncounter, 'action')) {
        toastr.warning('Tu accion de este turno ya fue usada.');
        return '';
    }
    const can = canHide2024({ covered: hideCheck(member), dim: boardVisibility().maxFeet !== null });
    if (!can.ok) {
        toastr.warning(can.reason, 'Ocultarse');
        return '';
    }
    Object.assign(combatEncounter, useAction(combatEncounter, 'action'));
    const { modifier } = skillModifier(member, 'stealth');
    const natural = rollDiceDetailed('1d20', 20).total;
    const total = natural + modifier;
    const success = total >= HIDE_DC;
    showCombatDiceRoll({
        title: `${member.name} se oculta`, subtitle: 'Sigilo contra 15', formula: `1d20${modifier >= 0 ? '+' : ''}${modifier}`,
        detail: `d20(${natural}) ${modifier >= 0 ? '+' : ''}${modifier} = ${total} contra 15`, total, dc: HIDE_DC, natural, glyph: 'd20',
        stage: { hit: success, against: 'CD' },
    });
    /** @type {string[]} */
    const lines = [rollLine({ what: 'Sigilo', who: member.name, total, against: HIDE_DC, label: 'CD', success, natural, modifier })];
    if (success) {
        combatEncounter.maneuvers = recordManeuver(combatEncounter.maneuvers, 'esconderse', String(member.id));
        applyTimedCondition(member, String(member.id), 'Invisible', 2);
        lines.push(`🫥 ${member.name} desaparece: nadie le ve hasta que ataque. Su próximo golpe, con ventaja.`);
    } else {
        lines.push(`👀 Le han visto: ${member.name} no consigue ocultarse.`);
    }
    postCombatNarration(`[COMBAT] ${lines.join('\n')}`);
    saveCombatState();
    savePartyState();
    renderLocationMapsPreview();
    return `${member.name}: ocultarse`;
}

/**
 * Estudiar a un enemigo: Inteligencia (Investigación) contra 10 más su desafío. Si sale, lo
 * que aún no se sabía de él: su punto débil, lo que resiste, cómo pelea (dos cosas con un 20).
 *
 * @param {string} targetId
 * @returns {string}
 */
export function studyEnemy(targetId) {
    const member = actingMember();
    if (!member) return '';
    if (!hasAction(combatEncounter, 'action')) {
        toastr.warning('Tu accion de este turno ya fue usada.');
        return '';
    }
    const target = getAliveEnemies().find(e => String(e.instanceId) === String(targetId));
    if (!target) {
        toastr.warning('Ese enemigo ya no está en pie.');
        return '';
    }
    Object.assign(combatEncounter, useAction(combatEncounter, 'action'));
    const dc = studyDC(Number(target.cr) || 0);
    const { modifier } = skillModifier(member, 'investigation');
    const natural = rollDiceDetailed('1d20', 20).total;
    const total = natural + modifier;
    const success = natural === 20 || (natural !== 1 && total >= dc);
    showCombatDiceRoll({
        title: `${member.name} estudia a ${target.name}`, subtitle: 'Inteligencia (Investigación)', formula: `1d20${modifier >= 0 ? '+' : ''}${modifier}`,
        detail: `d20(${natural}) ${modifier >= 0 ? '+' : ''}${modifier} = ${total} contra CD ${dc}`, total, dc, natural, glyph: 'd20',
        stage: { hit: success, against: 'CD' },
    });
    /** @type {string[]} */
    const lines = [`📖 ${member.name} se fija bien en ${target.name}.`, rollLine({ what: 'Estudiar', who: member.name, at: target.name, total, against: dc, label: 'CD', success, natural, modifier })];
    if (success) {
        const template = getCurrentWorldEnemies().find(t => String(t.id) === String(target.templateId));
        const facts = studyFacts(target, { weakness: String(template?.weakness ?? ''), quirk: String(template?.quirk ?? '') });
        const known = readTactics(combatEncounter.tactics).studied[String(target.instanceId)] ?? [];
        const fresh = newFacts(facts, known, natural === 20 ? 2 : 1);
        if (fresh.length === 0) {
            lines.push(`🤔 No hay nada más que sacarle: de ${target.name} ya sabes lo que hay.`);
        } else {
            combatEncounter.tactics = noteStudied(combatEncounter.tactics, String(target.instanceId), fresh.map(f => f.key));
            for (const fact of fresh) lines.push(`💡 ${fact.text}`);
        }
    } else {
        lines.push(`🤔 ${member.name} no le saca nada en claro.`);
    }
    postCombatNarration(`[COMBAT] ${lines.join('\n')}`);
    saveCombatState();
    renderLocationMapsPreview();
    return `${member.name}: estudiar`;
}

/**
 * Curar a alguien con una poción: tira lo que cura, la gasta y, si estaba en el suelo, le levanta.
 *
 * @param {any} giver Quien la lleva.
 * @param {any} drinker Quien se la bebe.
 * @param {string} itemId
 * @returns {string[]}
 */
function pourPotion(giver, drinker, itemId) {
    const potion = potionsOf(giver).find(p => p.itemId === String(itemId))
        ?? potionsOf(giver).find(p => (giver.items ?? []).some((/** @type {any} */ i) => String(i.id) === String(itemId) && i.name === p.name));
    if (!potion) return [];
    const roll = rollDiceDetailed(potion.heal, 4);
    const before = Number(drinker.hp) || 0;
    drinker.hp = Math.min(Number(drinker.maxHp) || before + roll.total, before + roll.total);
    // Una poción bebida se acaba, la marque la ficha como gastable o no (las del botín no lo dicen).
    if (!consumeItemInInventory(/** @type {any} */ (giver), String(potion.itemId)).consumed) {
        const items = Array.isArray(giver.items) ? giver.items : [];
        const at = items.findIndex((/** @type {any} */ i) => String(i.id) === String(potion.itemId));
        if (at >= 0) {
            const count = Math.floor(Number(items[at].quantity) || 1);
            if (count > 1) items[at].quantity = count - 1;
            else items.splice(at, 1);
        }
    }
    floatOnToken(drinker.id, `+${drinker.hp - before}`, 'heal');
    /** @type {string[]} */
    const lines = [`🧪 ${potion.name}: cura ${roll.total} (${potion.heal}). ${drinker.name}: ${drinker.hp}/${drinker.maxHp}.`];
    if (before <= 0 && drinker.hp > 0) {
        drinker.deathSaves = clearDeathSaves();
        drinker.activeConditions = (Array.isArray(drinker.activeConditions) ? drinker.activeConditions : []).filter((/** @type {string} */ c) => c !== 'Unconscious');
        lines.push(`🙌 ${drinker.name} vuelve en sí.`);
    }
    return lines;
}

/**
 * Beber una poción uno mismo: en 2024, acción adicional.
 *
 * @param {string} itemId
 * @returns {string}
 */
export function drinkPotion(itemId) {
    const member = actingMember();
    if (!member) return '';
    if (!hasAction(combatEncounter, 'bonus')) {
        toastr.warning('Ya has gastado la acción adicional.');
        return '';
    }
    const lines = pourPotion(member, member, itemId);
    if (lines.length === 0) {
        toastr.warning('No llevas esa poción.');
        return '';
    }
    Object.assign(combatEncounter, useAction(combatEncounter, 'bonus'));
    soundCue('heal');
    postCombatNarration(`[COMBAT] 🧪 ${member.name} se bebe la poción de un trago.\n${lines.join('\n')}`);
    saveCombatState();
    savePartyState();
    renderLocationMapsPreview();
    return `${member.name}: poción`;
}

/**
 * Darle una poción a quien se tiene al lado (Utilizar, que gasta la acción).
 *
 * @param {string} itemId
 * @param {string} allyId
 * @returns {string}
 */
export function givePotion(itemId, allyId) {
    const member = actingMember();
    if (!member) return '';
    if (!hasAction(combatEncounter, 'action')) {
        toastr.warning('Tu accion de este turno ya fue usada.');
        return '';
    }
    const ally = partyMembers.find(m => String(m.id) === String(allyId) && !m.dead);
    if (!ally || feetBetween(member, ally) > 5) {
        toastr.warning('Para darle una poción tiene que estar pegado a ti.');
        return '';
    }
    const lines = pourPotion(member, ally, itemId);
    if (lines.length === 0) {
        toastr.warning('No llevas esa poción.');
        return '';
    }
    Object.assign(combatEncounter, useAction(combatEncounter, 'action'));
    soundCue('heal');
    postCombatNarration(`[COMBAT] 🧪 ${member.name} le pasa una poción a ${ally.name}, que se la bebe.\n${lines.join('\n')}`);
    saveCombatState();
    savePartyState();
    renderLocationMapsPreview();
    return `${member.name}: poción a ${ally.name}`;
}

/**
 * Tanda 16: Estabilizar a uno de los tuyos que está en el suelo, pegado a ti (2024: Ayudar a
 * quien está a 0 PG, Sabiduría (Medicina) contra 10). Gasta la acción. Si sale, deja de
 * desangrarse: sigue a 0 PG, pero ya no tira salvaciones de muerte.
 *
 * @param {string} allyId
 * @returns {string}
 */
export function stabilizeAlly(allyId) {
    const member = actingMember();
    if (!member) return '';
    if (!hasAction(combatEncounter, 'action')) {
        toastr.warning('Tu accion de este turno ya fue usada.');
        return '';
    }
    const ally = partyMembers.find(m => String(m.id) === String(allyId));
    if (!ally || !needsStabilizing(ally)) {
        toastr.info(ally ? `${ally.name} no se está desangrando.` : 'No hay nadie en el suelo.', 'Estabilizar');
        return '';
    }
    if (feetBetween(member, ally) > 5) {
        toastr.warning(`Para atender a ${ally.name} tienes que estar pegado a ${gendered(ally, 'él', 'ella')}.`, 'Estabilizar');
        return '';
    }
    Object.assign(combatEncounter, useAction(combatEncounter, 'action'));
    const { modifier } = skillModifier(member, 'medicine');
    const natural = rollDiceDetailed('1d20', 20).total;
    const check = stabilizeCheck({ helper: String(member.name), target: String(ally.name), natural, modifier });
    showCombatDiceRoll({
        title: `${member.name} atiende a ${ally.name}`, subtitle: `Medicina contra ${STABILIZE_DC}`, formula: `1d20${modifier >= 0 ? '+' : ''}${modifier}`,
        detail: `d20(${natural}) ${modifier >= 0 ? '+' : ''}${modifier} = ${check.total} contra ${STABILIZE_DC}`, total: check.total, dc: STABILIZE_DC, natural, glyph: 'd20',
        stage: { hit: check.success, against: 'CD' },
    });
    if (check.success) ally.deathSaves = stableSaves();
    soundCue(check.success ? 'heal' : 'miss');
    postCombatNarration(`[COMBAT] ${check.lines.join('\n')}`);
    saveCombatState();
    savePartyState();
    renderLocationMapsPreview();
    return `${member.name}: estabilizar a ${ally.name}`;
}

/**
 * El golpe con la otra mano: tras atacar con un arma ligera, otro con la ligera de la otra mano,
 * sin sumar el modificador al daño. Gasta la adicional, salvo con Mellar (una vez por turno).
 *
 * @param {string} targetId
 * @returns {string}
 */
export function offHandAttack(targetId) {
    const member = actingMember();
    if (!member) return '';
    const s = buildCombatBarSnapshot();
    if (!s.offHand.ok || !s.offHand.weapon) {
        toastr.warning(s.offHand.reason || 'Ahora no puedes golpear con la otra mano.');
        return '';
    }
    const offItem = (member.items ?? []).find((/** @type {any} */ i) => String(i.id) === s.offHand.weapon?.id);
    return attackEnemyById(targetId, { weapon: offItem, offHand: true, cost: s.offHand.free ? 'none' : 'bonus' });
}

/**
 * Cambiar de arma: gratis una vez por turno (2024: al atacar se puede sacar o guardar un arma).
 *
 * @param {string} itemId
 * @returns {boolean}
 */
export function swapWeapon(itemId) {
    const member = actingMember();
    if (!member) return false;
    const verdict = swapVerdict(member);
    if (!verdict.ok) {
        toastr.warning(verdict.reason);
        return false;
    }
    const item = (member.items ?? []).find((/** @type {any} */ i) => String(i.id) === String(itemId));
    if (!item || !isWeaponItem(item)) {
        toastr.warning('No llevas esa arma.');
        return false;
    }
    if ((Number(item.hands) || 1) >= 2 && equippedIn(member, 'shield')) {
        toastr.warning(`${item.name} se lleva a dos manos, y llevas escudo.`, 'Cambiar de arma');
        return false;
    }
    member.equippedItems = { ...(member.equippedItems ?? {}), weapon: item.id };
    combatEncounter.tactics = markTurn(combatEncounter.tactics, String(member.id), Number(combatEncounter.round) || 1, { swapped: true });
    postCombatNarration(`[COMBAT] 🔁 ${member.name} cambia a ${String(item.name).toLowerCase()}.`);
    saveCombatState();
    savePartyState();
    return true;
}

/**
 * Cuerpo a tierra: tirarse es gratis; levantarse cuesta la mitad del movimiento (2024).
 *
 * @param {boolean} down
 * @returns {string}
 */
export function setProne(down) {
    const member = actingMember();
    if (!member) return '';
    const conditions = Array.isArray(member.activeConditions) ? member.activeConditions : [];
    if (down) {
        if (!conditions.includes('Prone')) member.activeConditions = [...conditions, 'Prone'];
        postCombatNarration(`[COMBAT] 🧎 ${member.name} se tira al suelo: de lejos le dan peor; de cerca, mejor.`);
    } else {
        const verdict = canStand({ left: getRemainingMovementFeet(member), speed: speedOf(member) });
        if (!verdict.ok) {
            toastr.warning(verdict.reason, 'Levantarse');
            return '';
        }
        Object.assign(combatEncounter, spendMovement(combatEncounter, verdict.cost, speedOf(member)));
        member.activeConditions = conditions.filter((/** @type {string} */ c) => c !== 'Prone');
        combatEncounter.conditionTimers = (Array.isArray(combatEncounter.conditionTimers) ? combatEncounter.conditionTimers : [])
            .filter((/** @type {any} */ t) => !(String(t.who) === String(member.id) && t.condition === 'Prone'));
        combatEncounter.tactics = markTurn(combatEncounter.tactics, String(member.id), Number(combatEncounter.round) || 1, { stood: true });
        postCombatNarration(`[COMBAT] 🧍 ${member.name} se levanta: le cuesta ${verdict.cost} pies. Le quedan ${getRemainingMovementFeet(member)}.`);
    }
    saveCombatState();
    savePartyState();
    renderLocationMapsPreview();
    return `${member.name}: ${down ? 'al suelo' : 'en pie'}`;
}

/**
 * Usar una habilidad o un conjuro desde la barra: sobre uno mismo, un aliado o un enemigo.
 *
 * @param {string} abilityId
 * @param {string} targetId
 * @param {number} [slotLevel] J19.3: el espacio elegido, si es mayor que el más bajo que queda.
 * @returns {string}
 */
function castFromBar(abilityId, targetId, slotLevel = 0) {
    const member = actingMember();
    if (!member) return '';
    const ability = abilityOf(member, abilityId);
    if (!ability) {
        toastr.warning('No conoces eso.');
        return '';
    }
    /** @type {any} */
    let target = null;
    if (ability.target === 'enemy') target = getAliveEnemies().find(e => String(e.instanceId) === String(targetId)) ?? null;
    else if (ability.target === 'ally') target = partyMembers.find(m => String(m.id) === String(targetId)) ?? null;
    if (ability.target !== 'self' && !target) {
        toastr.warning('Hace falta elegir a quién.');
        return '';
    }
    // Tanda 17: si sale, el conjuro va hacia quien lo recibe antes de lo que le hace (la secuencia).
    const mark = fxMark();
    const said = useAbility(member, ability, target, slotLevel);
    // J12.19: con su tipo de daño (o su nombre: «Rayo de escarcha»), para dibujar cómo llega.
    if (said && target && target !== member) stageAttack(member, target, 'spell', mark, `${ability.damageType || ''} ${ability.name || ''}`.trim());
    return said;
}

/**
 * Lo que pasa al pulsar algo de la barra o de sus menús.
 *
 * @param {string} pick
 * @returns {{keepOpen: string}} El menú que sigue abierto después (al cambiar de arma, Atacar), o vacío.
 */
export function runCombatBarPick(pick) {
    const [kind, a = '', b = '', c = ''] = String(pick ?? '').split(':');
    switch (kind) {
        case 'attack': attackEnemyById(a); break;
        case 'swapattack':
            if (swapWeapon(a)) attackEnemyById(b);
            else renderLocationMapsPreview();
            break;
        case 'swap':
            swapWeapon(a);
            renderLocationMapsPreview();
            return { keepOpen: 'atacar' };
        case 'unarmed':
            unarmedStrike(/** @type {'golpe'|'agarrar'|'apartar'|'tirar'} */ (a), b);
            break;
        case 'ability': castFromBar(a, b); break;
        // J19.3: «cast:nivel:conjuro:objetivo», con un espacio mayor.
        case 'cast': castFromBar(b, c, Number(a) || 0); break;
        case 'maneuver': {
            // Lo mismo que la barra vieja: pergaminos y varitas, lo que hay a mano, aceite y red.
            // Su id lleva dos partes («leer:p3», «lanzar:aceite»); detrás, a quién.
            const parts = String(pick).split(':').slice(1);
            const twoPart = parts[0] === 'leer' || parts[0] === 'lanzar';
            const id = twoPart ? `${parts[0]}:${parts[1] ?? ''}` : parts[0] ?? '';
            const target = (twoPart ? parts[2] : parts[1]) ?? '';
            if (id.startsWith('leer:')) useMagicItem(id.slice('leer:'.length), target);
            else if (id === 'lanzar:objeto') throwScenery(target);
            else if (id.startsWith('lanzar:')) throwItem(id.slice('lanzar:'.length), target);
            else performManeuver(id, target);
            break;
        }
        case 'act':
            if (a === 'correr') dashAction();
            else if (a === 'ocultarse') hide2024();
            else if (a === 'estudiar') studyEnemy(b);
            else if (a === 'estabilizar') stabilizeAlly(b);
            else performManeuver(a, b);
            break;
        case 'give': givePotion(a, b); break;
        case 'drink': drinkPotion(a); break;
        case 'offhand': offHandAttack(a); break;
        case 'prone': setProne(true); break;
        case 'stand': setProne(false); break;
        case 'parley': void openParleyChoice(); break;
        default: break;
    }
    return { keepOpen: '' };
}
