/**
 * Habilidades y conjuros: el catálogo, usarlas (en el tablero, a uno o en área), sus
 * componentes y su precio, los estados con fecha, pergaminos y varitas, el grimorio y aprender
 * con quien enseña.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import { POPUP_TYPE, Popup } from '../popup.js';
import { chat_metadata, saveMetadata } from '../../script.js';
import { loadWorldInfo, saveWorldInfo, METADATA_KEY } from '../world-info.js';
import { getAbilityModifier, removeItemFromInventory } from '../dnd-system.js';
import { asAbility } from '../game-engine/compendio/skills.js';
import { rollDiceDetailed, getDistanceInFeet, getPlayerAttackModifier } from './combat-rules.js';
import { setCell as setTerrainCell, getCell, TERRAIN_TYPES } from '../game-engine/board/terrain.js';
import { areaCells, creaturesIn, isArea, describeArea } from '../game-engine/rules/area.js';
import { elementOf, reactTerrain, comboFor, ELEMENT_ICONS } from '../game-engine/rules/tags.js';
import { MAGIC_ITEMS, afterUse, canLearnScroll } from '../game-engine/rules/magic-items.js';
import {
    grimoireAbilities, spellById, spellAbility, spendCharge, magicInData, knownSpells, describeSpell,
    describeCharges, SCHOOLS, SPELLS, CIRCLE_LABELS,
} from '../game-engine/rules/grimoire.js';
import { describeLesson, LESSON } from '../game-engine/campaign/masters.js';
import { isIndoors } from '../game-engine/world/visibility.js';
import { fireAt } from '../game-engine/board/living-terrain.js';
import { WATCH, readWanted } from '../game-engine/campaign/crime.js';
import { noteDealt } from '../game-engine/combat/tally.js';
import { hasAction, useAction } from '../game-engine/combat/turn-machine.js';
import { getActiveRuleset } from '../game-engine/rules/ruleset.js';
import { normalizeAbilities, canUseAbility, planAbilityUse, spendAbilityUse } from '../game-engine/rules/abilities.js';
import { addConditionTimer, expireConditions, clearTimersFor } from '../game-engine/combat/condition-timers.js';
import { clearDeathSaves } from '../game-engine/rules/death-saves.js';
import { WANTED_KEY } from './keys.js';
import { combatEncounter, currentLocationName, partyMembers } from './state.js';
import {
    saveCombatState, getCurrentTurnState, getEnemyByInstanceId, getAliveEnemies, getCurrentActingMember,
    getTargetArmorClass, enemyTokenId, boardCellOf,
} from './combat-state.js';
import { floatOnToken } from './combat-log.js';
import { damagePartyMember } from './enemy-turn.js';
import { judgeCurrentScenario, checkScenarioOutcome, endCombat } from './combat-flow.js';
import { persistBoardTerrain, getActiveBoardContext, explodeBarrels, boardVisibility } from './board.js';
import { renderLocationMapsPreview } from './board-view.js';
import { applyCampaignRuleset, lastWorldRows, hereLocation, lastCompendium } from './world.js';
import { nudgeRuler } from './factions.js';
import { advanceCampaignDay } from './time.js';
import { noteDeed, worldWrite } from './world-growth.js';
import { postCombatNarration, postForModel, showTip } from './narration.js';
import { savePartyState, renderPartyMembers } from './roster.js';
import { judgeDecision, recordFeat } from './companions.js';

/**
 * R4: usar un pergamino o una varita: el conjuro sale del objeto, sin gastar cargas del
 * círculo ni componentes de quien lo usa. El pergamino se gasta; la varita pierde una carga.
 *
 * @param {string} itemId
 * @param {string} targetId
 * @returns {string}
 */
export function useMagicItem(itemId, targetId) {
    const member = getCurrentActingMember();
    if (!member || !combatEncounter.active) return '';
    const item = (Array.isArray(member.items) ? member.items : []).find((/** @type {any} */ i) => String(i.id) === String(itemId));
    const spec = item ? MAGIC_ITEMS[String(item.name)] : null;
    const ability = spec ? getAbilityCatalogue().find(a => a.id === spec.spell) : null;
    if (!item || !ability || !hasAction(combatEncounter, 'action')) return '';
    const subject = ability.target === 'self' ? member
        : ability.target === 'ally' ? partyMembers.find(m => String(m.id) === String(targetId))
            : getEnemyByInstanceId(String(targetId));
    if (!subject) return '';
    Object.assign(combatEncounter, useAction(combatEncounter, 'action'));
    const lines = [`📜 ${member.name} usa ${item.name}.`, ...resolveAbilityOnBoard({ actor: member, side: 'party', ability, subject })];
    const after = afterUse(item);
    if (after.remove) removeItemFromInventory(/** @type {any} */ (member), String(item.id));
    else /** @type {any} */ (item).charges = after.charges;
    lines.push(after.line, ...magicConsequences(ability));
    saveCombatState();
    savePartyState();
    postCombatNarration(lines.join('\n'));
    renderPartyMembers();
    renderLocationMapsPreview();
    if (!checkScenarioOutcome() && getAliveEnemies().length === 0 && !judgeCurrentScenario()) {
        postCombatNarration('🏆 [COMBAT] Todos los enemigos han sido derrotados.');
        endCombat('victory');
    }
    return item.name;
}

/**
 * R4: aprender el conjuro de un pergamino, si se ha estudiado (el mago y el erudito). El
 * pergamino se gasta.
 *
 * @param {string} name Del pergamino, o vacío para el primero que haya.
 * @returns {string}
 */
export function learnFromScroll(name) {
    for (const member of partyMembers.filter(m => !m.dead)) {
        const item = (Array.isArray(member.items) ? member.items : []).find((/** @type {any} */ i) => MAGIC_ITEMS[String(i.name)]?.kind === 'scroll'
            && (!name || String(i.name).toLowerCase().includes(String(name).toLowerCase())));
        if (!item) continue;
        const verdict = canLearnScroll(member, item);
        if (!verdict.ok) continue;
        member.abilities = [...new Set([...(Array.isArray(member.abilities) ? member.abilities.map(String) : []), verdict.spell])];
        removeItemFromInventory(/** @type {any} */ (member), String(item.id));
        savePartyState();
        renderPartyMembers();
        const line = `${member.name} estudia ${item.name} hasta sabérselo: ya sabe ${spellById(verdict.spell)?.name ?? verdict.spell}.`;
        postCombatNarration(`📜 [APRENDIZAJE] ${line}`);
        noteDeed(line);
        return line;
    }
    toastr.info('Nadie del grupo puede aprender de un pergamino ahora: hace falta haber estudiado (el mago o el erudito), y no sabérselo ya.', 'Pergaminos');
    return '';
}

/**
 * R4: el grimorio del grupo, en un cuadro. Solo lee.
 */
export async function openGrimoire(all = false) {
    const body = $('<div class="jr-root gr-root"></div>');
    body.append($('<h3></h3>').text(all ? 'Toda la magia que existe' : 'El grimorio'));
    // R10: la lista entera, por círculos: no se crea, se consulta.
    if (all) {
        for (const circle of [0, 1, 2, 3]) {
            body.append($('<div class="jr-title"></div>').text(CIRCLE_LABELS[/** @type {0|1|2|3} */ (circle)].replace(/^./, c => c.toUpperCase())));
            for (const spell of SPELLS.filter(s => s.circle === circle)) {
                body.append($('<div class="jr-item gr-spell"></div>').attr('data-spell', spell.id).attr('title', spell.note).text(`${describeSpell(spell)} · ${spell.id}`));
            }
        }
        await new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', allowVerticalScrolling: true, leftAlign: true }).show();
        return;
    }
    const casters = partyMembers.filter(m => !m.dead && knownSpells(m).length > 0);
    if (casters.length === 0) {
        body.append($('<div class="jr-item"></div>').text('Nadie del grupo hace magia. En este mundo, la única que existe es la del grimorio.'));
    }
    const carried = carriedNames().map(n => n.toLowerCase());
    for (const member of casters) {
        body.append($('<div class="jr-title"></div>').text(`${member.name}${describeCharges(member) ? ` · ${describeCharges(member)}` : ''}`));
        for (const spell of knownSpells(member)) {
            const missing = spell.component && !carried.includes(spell.component.toLowerCase()) ? ` (falta ${spell.component.toLowerCase()})` : '';
            body.append($('<div class="jr-item gr-spell"></div>').attr('data-spell', spell.id).attr('title', spell.note).text(`${describeSpell(spell)}${missing}`));
        }
    }
    const schools = Object.values(SCHOOLS).map(s => `${s.label}: ${s.note}`).join(' · ');
    body.append($('<div class="jr-item gr-schools"></div>').text(schools));
    await new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', allowVerticalScrolling: true, leftAlign: true }).show();
}

/**
 * Abre el panel de habilidades y guarda lo que salga.
 *
 * El catalogo viaja dentro del paquete de reglas del mundo, como las armas y las
 * condiciones; lo que cada personaje se sabe vive en su ficha.
 *
 * @returns {Promise<string>}
 */
export async function openAbilitiesEditor() {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName) {
        toastr.warning('Abre una campana antes de escribir sus habilidades.');
        return '';
    }

    try {
        const data = await loadWorldInfo(worldName);
        if (!data) {
            toastr.warning(`No se pudo leer el mundo "${worldName}".`);
            return '';
        }

        const { openAbilitiesPanel } = await import('../game-engine/ui/abilities-panel.js');
        const edited = await openAbilitiesPanel({
            abilities: getPackAbilities(),
            party: partyMembers,
            conditions: getActiveRuleset()?.character?.conditions ?? [],
            Popup,
            POPUP_TYPE,
        });
        if (!edited) return '';

        // El paquete del mundo manda: si no tiene uno propio, se parte del activo para no
        // perder el resto de secciones al guardar solo las habilidades.
        const pack = structuredClone(data.metadata?.rulesetPack ?? getActiveRuleset());
        pack.abilities = edited.abilities;
        data.metadata = data.metadata ?? {};
        data.metadata.rulesetPack = pack;
        await saveWorldInfo(worldName, data, true);
        await applyCampaignRuleset(worldName);

        // Y lo que cada uno se sabe, en su ficha. Una habilidad borrada deja de saberse
        // sola, porque el panel ya la quito de las listas.
        const live = new Set(edited.abilities.map((/** @type {any} */ a) => a.id));
        for (const member of partyMembers) {
            const mine = edited.known[String(member.id)] ?? [];
            member.abilities = mine.filter((/** @type {string} */ id) => live.has(id));
        }
        savePartyState();
        renderPartyMembers();
        renderLocationMapsPreview();

        const total = edited.abilities.length;
        toastr.success(`${total} habilidad(es) guardadas con las reglas de "${worldName}".`);
        return `${total} habilidades`;
    } catch (error) {
        console.error('[party] abilities editor failed', error);
        toastr.error(String(error?.message || error), 'No se pudieron guardar las habilidades');
        return '';
    }
}

/** El catalogo de habilidades del paquete de reglas activo. */
/**
 * Lo que se puede saber hacer: el paquete del mundo, y debajo las filas del compendio.
 *
 * R3: las habilidades de clase del héroe salían del compendio y se escribían en su ficha,
 * pero el catálogo solo leía el paquete, así que en combate no aparecía ninguna. Ahora el
 * compendio entra debajo; si el paquete trae una con el mismo id, manda la del paquete.
 *
 * @returns {import('../game-engine/rules/abilities.js').Ability[]}
 */
export function getAbilityCatalogue() {
    // R4: un conjuro del paquete (por su id, o el viejo de fila de datos) solo ajusta los
    // números del grimorio; lo que parezca magia y no esté en el grimorio no entra (DR3).
    /** @type {Map<string, Record<string, any>>} */
    const tuned = new Map();
    /** @type {any[]} */
    const plain = [];
    for (const row of Array.isArray(getActiveRuleset()?.abilities) ? getActiveRuleset().abilities : []) {
        const spell = spellById(String(row?.id ?? ''));
        if (spell) {
            tuned.set(spell.id, Object.fromEntries(['damage', 'healing', 'rangeFeet', 'saveDc', 'conditionRounds']
                .filter(key => row?.[key] !== undefined && row?.[key] !== '').map(key => [key, row[key]])));
            continue;
        }
        if (magicInData(row)) continue;
        plain.push(row);
    }
    const pack = normalizeAbilities(plain);
    const have = new Set(pack.map(ability => ability.id));
    // Las del mundo primero: una habilidad retocada en el taller tapa a la de serie.
    const own = (Array.isArray(lastWorldRows?.habilidades) ? lastWorldRows.habilidades : [])
        .filter((/** @type {any} */ row) => String(row?.kind || 'habilidad') === 'habilidad')
        .map(asAbility).filter((/** @type {any} */ a) => !have.has(String(a.id)) && !magicInData(a));
    for (const ability of own) have.add(String(ability.id));
    const rows = [...own, ...(lastCompendium?.has?.('habilidades')
        ? lastCompendium.find('habilidades', { kind: 'habilidad' }).map(asAbility)
            .filter((/** @type {any} */ a) => !have.has(String(a.id)) && !magicInData(a))
        : [])];
    const magic = grimoireAbilities().map(ability => ({ ...ability, ...(tuned.get(ability.id) ?? {}), aliases: spellById(ability.id)?.aliases ?? [] }));
    return [...pack, ...normalizeAbilities(rows), ...normalizeAbilities(magic)];
}

/**
 * R4: lo que lleva encima el grupo, por nombre, para los componentes de los conjuros.
 *
 * @returns {string[]}
 */
export function carriedNames() {
    return partyMembers.filter(m => !m.dead).flatMap(m => (Array.isArray(m.items) ? m.items : []).map((/** @type {any} */ item) => String(item?.name ?? '')));
}

/**
 * R4: lo que gastan los conjuros que el grupo sabe, para que la botica lo tenga.
 *
 * @returns {string[]}
 */
export function neededComponents() {
    return [...new Set(partyMembers.filter(m => !m.dead).flatMap(m => knownSpells(m)).map(s => String(s.component ?? '')).filter(Boolean))];
}

/**
 * R4: gastar un componente, de quien lo lleve.
 *
 * @param {string} name
 * @returns {boolean}
 */
function consumeComponent(name) {
    const wanted = String(name).trim().toLowerCase();
    for (const member of partyMembers) {
        const item = (Array.isArray(member.items) ? member.items : []).find((/** @type {any} */ i) => String(i?.name ?? '').trim().toLowerCase() === wanted);
        if (!item) continue;
        removeItemFromInventory(/** @type {any} */ (member), String(item.id));
        return true;
    }
    return false;
}

/**
 * R4: pagar un conjuro: la carga de su círculo y lo que gaste.
 *
 * @param {any} caster
 * @param {any} ability
 * @returns {string[]} Lo que se dice.
 */
export function payForSpell(caster, ability) {
    /** @type {string[]} */
    const said = [];
    if (typeof ability?.circle !== 'number') return said;
    if (ability.circle > 0) caster.spellCharges = spendCharge(caster, ability.circle);
    // H1: el primer conjuro del grupo dice cómo va lo de las cargas.
    if (partyMembers.includes(caster)) showTip('spell');
    if (ability.component && partyMembers.includes(caster) && consumeComponent(ability.component)) {
        said.push(`🧪 Se gasta ${String(ability.component).toLowerCase()}.`);
    }
    return said;
}

/**
 * R4: la nigromancia, en un sitio con gente, es un crimen; y a los tuyos les parece lo que
 * les parece (a quien busca tranquilidad, mal).
 *
 * @param {any} ability
 * @returns {string[]}
 */
export function magicConsequences(ability) {
    /** @type {string[]} */
    const said = [];
    if (ability?.school !== 'nigromancia') return said;
    judgeDecision('nigromancia', { quiet: true });
    const here = hereLocation();
    const type = String(here?.locationType ?? here?.type ?? '').toLowerCase();
    if (chat_metadata && currentLocationName && Object.hasOwn(WATCH, type)) {
        const wanted = readWanted(chat_metadata[WANTED_KEY]);
        const level = (wanted[currentLocationName] ?? 0) + 1;
        chat_metadata[WANTED_KEY] = { ...wanted, [currentLocationName]: level };
        saveMetadata();
        said.push(`👁️ [GUARDIAS] Alguien os ha visto usar nigromancia en ${currentLocationName}: ahora os buscan (buscados: ${level}).`);
        // R9: y quien manda aquí lo nota.
        void nudgeRuler(currentLocationName, 'nigromancia');
    }
    return said;
}

/** Solo las del paquete del mundo: lo que el editor de habilidades escribe. */
function getPackAbilities() {
    return normalizeAbilities(getActiveRuleset()?.abilities);
}

/**
 * El modificador de una caracteristica, que es la misma cuenta de siempre.
 *
 * @param {any} creature
 * @param {string} ability
 */
function abilityModifier(creature, ability) {
    return Math.floor(((Number(creature?.[ability]) || 10) - 10) / 2);
}

/**
 * Pone una condicion, con fecha de caducidad si la habilidad la trae.
 *
 * Lo puesto a mano con `/condition` no lleva apunte y se quita a mano; lo que pone una
 * habilidad se va solo al pasar las rondas que dijo. Un "una ronda" que dura para siempre
 * seria un numero decorativo.
 *
 * @param {any} creature
 * @param {string} who El id con el que el encuentro lo conoce.
 * @param {string} condition
 * @param {number} rounds
 */
export function applyTimedCondition(creature, who, condition, rounds) {
    creature.activeConditions = Array.isArray(creature.activeConditions) ? creature.activeConditions : [];
    if (!creature.activeConditions.includes(condition)) creature.activeConditions.push(condition);

    combatEncounter.conditionTimers = addConditionTimer(combatEncounter.conditionTimers, {
        who, condition, round: Number(combatEncounter.round) || 1, rounds,
    });
}

/**
 * Quita lo que ya ha caducado al empezar una ronda.
 *
 * @returns {string[]} Lo que se ha ido, ya escrito.
 */
export function expireTimedConditions() {
    const { timers, expired } = expireConditions(combatEncounter.conditionTimers, Number(combatEncounter.round) || 1);
    combatEncounter.conditionTimers = timers;
    if (expired.length === 0) return [];

    const lines = [];
    for (const gone of expired) {
        const enemy = combatEncounter.enemies.find(e => String(e.instanceId) === gone.who);
        const member = partyMembers.find(m => String(m.id) === gone.who);
        const creature = enemy || member;
        if (!creature) continue;

        creature.activeConditions = (Array.isArray(creature.activeConditions) ? creature.activeConditions : [])
            .filter((/** @type {string} */ c) => c !== gone.condition);
        lines.push(`✨ [COMBAT] A ${creature.name} se le pasa: ${gone.condition}.`);
    }
    return lines;
}

/**
 * Usa una habilidad sobre alguien, o sobre uno mismo.
 *
 * Resuelve y aplica: la decision de si se puede y de que pasa esta en `rules/abilities.js`,
 * y aqui solo se escribe en las fichas y se cuenta.
 *
 * @param {any} member Quien la usa.
 * @param {any} ability
 * @param {any} target El enemigo o el companero, o null para uno mismo.
 * @returns {string}
 */
export function useAbility(member, ability, target) {
    const turnState = getCurrentTurnState();
    if (!combatEncounter.active || !turnState) {
        toastr.warning('No hay un turno de jugador activo.');
        return '';
    }

    const isSelf = ability.target === 'self';
    const subject = isSelf ? member : target;
    if (!subject) {
        toastr.warning('Esa habilidad necesita un objetivo.');
        return '';
    }

    const origin = member.mapPosition || { gridX: 0, gridY: 0 };
    const at = subject.mapPosition || { gridX: subject.gridX ?? 0, gridY: subject.gridY ?? 0 };
    const distanceFeet = isSelf ? 0 : getDistanceInFeet(
        origin.gridX || 0, origin.gridY || 0,
        at.gridX ?? at.x ?? 0, at.gridY ?? at.y ?? 0,
    );

    const alive = ability.target === 'enemy'
        ? (Number(subject.currentHp) || 0) > 0
        : (Number(subject.hp) || 0) > 0 || isSelf;

    const verdict = canUseAbility({
        member,
        ability,
        distanceFeet,
        hasAction: hasAction(combatEncounter, 'action'),
        hasBonus: hasAction(combatEncounter, 'bonus'),
        targetAlive: alive,
        // R4: los componentes de los conjuros.
        carried: carriedNames(),
    });
    if (!verdict.ok) {
        toastr.warning(verdict.reason);
        return '';
    }

    // El coste se paga aunque falle: lanzar y errar tambien gasta el turno.
    if (ability.cost !== 'free') {
        Object.assign(combatEncounter, useAction(combatEncounter, ability.cost === 'bonus' ? 'bonus' : 'action'));
    }
    member.abilityUses = spendAbilityUse(member, ability);
    // R4: un conjuro gasta una carga de su círculo y lo que pida.
    const paid = payForSpell(member, ability);

    // R3: a uno o en área, por el mismo camino que los enemigos.
    const lines = [...resolveAbilityOnBoard({ actor: member, side: 'party', ability, subject }), ...paid, ...magicConsequences(ability)];

    saveCombatState();
    savePartyState();
    postCombatNarration(lines.join('\n'));
    renderPartyMembers();
    renderLocationMapsPreview();
    if (!checkScenarioOutcome() && getAliveEnemies().length === 0 && !judgeCurrentScenario()) {
        postCombatNarration('🏆 [COMBAT] Todos los enemigos han sido derrotados.');
        endCombat('victory');
    }

    return `${member.name} usa ${ability.name}`;
}

/**
 * R3: a quién alcanzaría una habilidad apuntada a una casilla. El área no distingue bandos;
 * las que van sobre aliados solo tocan a los del bando de quien la lanza (una canción no
 * cura al enemigo), y quien la lanza nunca se da a sí mismo con lo que hace daño.
 *
 * @param {any} actor
 * @param {'party'|'enemy'} side
 * @param {any} ability
 * @param {any} subject
 * @returns {{cells: Array<{x: number, y: number}>, victims: Array<{kind: 'party'|'enemy', ref: any, x: number, y: number}>}}
 */
export function abilityVictims(actor, side, ability, subject) {
    const aim = boardCellOf(subject);
    if (!isArea(ability.area)) {
        const kind = partyMembers.includes(subject) ? 'party' : 'enemy';
        return { cells: [aim], victims: [{ kind, ref: subject, ...aim }] };
    }
    const context = getActiveBoardContext();
    const cells = areaCells({
        area: ability.area, origin: boardCellOf(actor), aim,
        terrain: context.terrain, width: context.gridWidth, height: context.gridHeight,
    });
    /** @type {Array<{kind: 'party'|'enemy', ref: any, x: number, y: number}>} */
    const creatures = [
        ...getAliveEnemies().map(e => ({ kind: /** @type {'enemy'} */ ('enemy'), ref: e, ...boardCellOf(e) })),
        ...partyMembers.filter(m => !m.dead && (Number(m.hp) || 0) > 0).map(m => ({ kind: /** @type {'party'} */ ('party'), ref: m, ...boardCellOf(m) })),
    ];
    const friendly = ability.target === 'ally';
    const victims = creaturesIn(cells, creatures).filter(v => (friendly ? v.kind === side : v.ref !== actor));
    return { cells, victims };
}

/**
 * R3 del roadmap de profundidad: una habilidad sobre el tablero, a uno o en área, para los
 * dos bandos. Decide a quién toca (`rules/area.js`), tira por cada uno con
 * `planAbilityUse`, aplica, y deja su huella en el terreno (`rules/tags.js`): un rayo de
 * fuego prende las cajas, un cono de escarcha hiela el charco.
 *
 * @param {Object} input
 * @param {any} input.actor
 * @param {'party'|'enemy'} input.side
 * @param {any} input.ability
 * @param {any} input.subject El objetivo elegido, o quien la lanza si es sobre sí mismo.
 * @returns {string[]}
 */
export function resolveAbilityOnBoard({ actor, side, ability, subject }) {
    const area = isArea(ability.area);
    const { cells, victims } = abilityVictims(actor, side, ability, subject);
    const friendly = ability.target === 'ally';
    /** @type {string[]} */
    const lines = [];
    if (area) {
        lines.push(`✨ ${actor.name} usa ${ability.name} (${describeArea(ability.area)}).`);
        if (victims.length === 0) lines.push('No alcanza a nadie.');
        const own = friendly ? [] : victims.filter(v => v.kind === side);
        if (own.length > 0) lines.push(`⚠️ También alcanza a ${own.map(v => v.ref.name).join(', ')}, de los suyos.`);
    }

    const context = getActiveBoardContext();
    const element = elementOf(ability);
    const outdoors = context.board ? !isIndoors(context.board, hereLocation()) : true;
    const wet = Boolean(boardVisibility().wet);
    // R4: lo que se quita con un conjuro que roba vida.
    let drained = 0;
    for (const victim of victims) {
        const target = victim.ref;
        const plan = planAbilityUse({
            actor,
            target,
            ability,
            roll: (/** @type {string} */ formula) => rollDiceDetailed(formula, 8),
            attackModifier: side === 'party'
                ? getPlayerAttackModifier(actor, ability.rangeFeet)
                : Math.max(getAbilityModifier(actor.strength || 10), getAbilityModifier(actor.dexterity || 10)),
            targetAc: friendly || target === actor ? 10 : getTargetArmorClass(target, actor).ac,
            saveModifier: abilityModifier(target, ability.saveAbility),
        });
        if (area) {
            lines.push(`➤ ${target.name}:`);
            lines.push(...plan.lines.slice(1));
        } else {
            lines.push(...plan.lines);
        }
        lines.push(...applyAbilityPlan({ actor, side, victim, plan }));
        if (ability.drain && victim.kind !== side) drained += plan.damage;

        // El elemento y dónde está, o cómo está: en el agua, el frío hiela.
        if (element && plan.hit && !plan.saved && (Number(target.currentHp ?? target.hp) || 0) > 0) {
            const standingOn = context.terrain ? getCell(context.terrain, victim.x, victim.y).type : 'floor';
            const conditions = [...(Array.isArray(target.activeConditions) ? target.activeConditions : []), ...(wet && outdoors ? ['Mojado'] : [])];
            const combo = comboFor({ element, standingOn, conditions });
            if (combo) {
                if (combo.remove) {
                    target.activeConditions = (Array.isArray(target.activeConditions) ? target.activeConditions : []).filter((/** @type {string} */ c) => c !== combo.remove);
                }
                if (combo.add) applyTimedCondition(target, victim.kind === 'enemy' ? String(target.instanceId) : String(target.id), combo.add, combo.rounds);
                lines.push(`${ELEMENT_ICONS[/** @type {keyof typeof ELEMENT_ICONS} */ (element)] ?? '✨'} ${target.name}: ${combo.line}.`);
            }
        }
    }

    // R4: lo que se roba, se queda.
    if (drained > 0) {
        const back = Math.floor(drained / 2);
        if (side === 'party') actor.hp = Math.min(Number(actor.maxHp) || 0, (Number(actor.hp) || 0) + back);
        else actor.currentHp = Math.min(Number(actor.maxHp) || 0, (Number(actor.currentHp) || 0) + back);
        if (back > 0) lines.push(`🩸 ${actor.name} se queda con ${back} PG de lo que quita.`);
    }

    // La huella en el tablero: lo que prende, lo que se hiela, lo que queda en el suelo.
    const board = context.board;
    if (board && context.terrain && (element || ability.leaves)) {
        let terrain = context.terrain;
        let hazards = Array.isArray(board.hazards) ? board.hazards : [];
        /** @type {string[]} */
        const said = [];
        if (element) {
            const out = reactTerrain({ element, cells, terrain, hazards, round: Number(combatEncounter.round) || 1, outdoors, wet });
            terrain = out.terrain;
            hazards = out.hazards;
            said.push(...out.lines);
            // R6: los barriles que ha tocado el fuego revientan.
            said.push(...explodeBarrels(out.changed.filter(c => c.from === 'barrel')));
        }
        // R4: un muro de fuego deja cada casilla ardiendo, sea de lo que sea (salvo la lluvia).
        if (ability.leaves === 'fuego' && !wet) {
            let lit = 0;
            for (const cell of cells) {
                if (hazards.some((/** @type {any} */ h) => h.kind === 'fuego' && h.armed !== false && Number(h.x) === cell.x && Number(h.y) === cell.y)) continue;
                hazards = [...hazards, fireAt({ x: cell.x, y: cell.y, round: Number(combatEncounter.round) || 1, what: 'Muro de fuego' })];
                lit++;
            }
            if (lit > 0) said.push(`🔥 Arden ${lit} casilla(s) durante tres rondas.`);
        }
        if (ability.leaves && Object.hasOwn(TERRAIN_TYPES, ability.leaves)) {
            let left = 0;
            for (const cell of cells) {
                if (getCell(terrain, cell.x, cell.y).type !== 'floor') continue;
                terrain = setTerrainCell(terrain, cell.x, cell.y, ability.leaves);
                left++;
            }
            if (left > 0) said.push(`🪤 El suelo queda ${ability.leaves === 'difficult' ? 'difícil de pisar' : 'cambiado'} en ${left} casilla(s).`);
        }
        if (said.length > 0) {
            board.terrain = terrain;
            board.hazards = hazards;
            persistBoardTerrain(board);
            lines.push(...said);
        }
    }
    return lines;
}

/**
 * R3: aplicar a una víctima lo que decidió `planAbilityUse`. El daño cae sobre quien sea,
 * del bando que sea: un área no pregunta.
 *
 * @param {Object} input
 * @param {any} input.actor
 * @param {'party'|'enemy'} input.side
 * @param {{kind: 'party'|'enemy', ref: any}} input.victim
 * @param {any} input.plan
 * @returns {string[]}
 */
function applyAbilityPlan({ actor, side, victim, plan }) {
    /** @type {string[]} */
    const lines = [];
    const target = victim.ref;
    if (plan.damage > 0) {
        if (victim.kind === 'enemy') {
            target.currentHp = Math.max(0, (Number(target.currentHp) || 0) - plan.damage);
            if (side === 'party') {
                combatEncounter.tally = noteDealt(combatEncounter.tally, actor.id, plan.damage, target.currentHp === 0);
                if (target.currentHp === 0) recordFeat(actor, 'kill', String(target.name));
            }
            floatOnToken(enemyTokenId(target), `-${plan.damage}`, 'damage');
            lines.push(`❤️ Estado de ${target.name}: ${target.currentHp}/${target.maxHp}`);
            if (target.currentHp === 0) {
                lines.push(`☠️ ${target.name} cae derrotado.`);
                combatEncounter.conditionTimers = clearTimersFor(combatEncounter.conditionTimers, String(target.instanceId));
            }
        } else {
            lines.push(...damagePartyMember(target, plan.damage, plan.crit));
        }
    }
    if (plan.healing > 0) {
        if (victim.kind === 'enemy') {
            target.currentHp = Math.min(Number(target.maxHp) || 0, (Number(target.currentHp) || 0) + plan.healing);
            lines.push(`❤️ Estado de ${target.name}: ${target.currentHp}/${target.maxHp}`);
        } else {
            const before = Number(target.hp) || 0;
            target.hp = Math.min(Number(target.maxHp) || before, before + plan.healing);
            lines.push(`❤️ Estado de ${target.name}: ${target.hp}/${target.maxHp}`);
            // Curar a quien estaba en el suelo lo levanta y borra la cuenta: es para lo que
            // sirve una curacion en mitad de un combate.
            if (before <= 0 && target.hp > 0) {
                target.deathSaves = clearDeathSaves();
                target.activeConditions = (Array.isArray(target.activeConditions) ? target.activeConditions : [])
                    .filter((/** @type {string} */ c) => c !== 'Unconscious');
                lines.push(`🙌 ${target.name} vuelve en si.`);
            }
        }
    }
    if (plan.condition) {
        applyTimedCondition(target, victim.kind === 'enemy' ? String(target.instanceId) : String(target.id), plan.condition, plan.conditionRounds);
    }
    return lines;
}

/**
 * Idea 54: aprender con quien enseña. Se paga (ya pagado al pulsar), pasan los días, y la
 * habilidad entra en el catálogo del mundo si no estaba y en la ficha de quien aprende.
 *
 * @param {string} memberId
 * @param {string} abilityId
 * @returns {Promise<void>}
 */
export async function learnAbility(memberId, abilityId) {
    const member = partyMembers.find(m => String(m.id) === String(memberId));
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    // R4: un conjuro no se escribe en el paquete: vive en el grimorio. Se aprende y ya.
    const spell = spellById(String(abilityId));
    if (member && spell) {
        member.abilities = [...new Set([...(Array.isArray(member.abilities) ? member.abilities.map(String) : []), spell.id])];
        for (let day = 0; day < LESSON.days; day++) advanceCampaignDay();
        savePartyState();
        const line = describeLesson(String(member.name), spellAbility(spell), currentLocationName);
        noteDeed(line);
        toastr.success(line, '📜 Aprendido', { timeOut: 10000 });
        return;
    }
    if (!member || !worldName || !lastCompendium?.has?.('habilidades')) return;
    const ability = lastCompendium.find('habilidades', { kind: 'habilidad' })
        .filter((/** @type {any} */ row) => String(row.id) === String(abilityId))
        .map(asAbility)[0];
    if (!ability) return;
    await worldWrite(async () => {
        const data = await loadWorldInfo(worldName);
        if (!data) return;
        const pack = structuredClone(data.metadata?.rulesetPack ?? getActiveRuleset());
        pack.abilities = Array.isArray(pack.abilities) ? pack.abilities : [];
        if (!pack.abilities.some((/** @type {any} */ a) => String(a?.id) === ability.id)) pack.abilities.push(ability);
        data.metadata = data.metadata ?? {};
        data.metadata.rulesetPack = pack;
        await saveWorldInfo(worldName, data, true);
    });
    await applyCampaignRuleset(worldName);
    member.abilities = [...new Set([...(Array.isArray(member.abilities) ? member.abilities.map(String) : []), ability.id])];
    for (let day = 0; day < LESSON.days; day++) advanceCampaignDay();
    savePartyState();
    const line = describeLesson(String(member.name), ability, currentLocationName);
    noteDeed(line);
    toastr.success(line, '📜 Aprendido', { timeOut: 10000 });
    await postForModel(`[APRENDIZAJE] ${line} Cuéntalo en dos frases. No inventes nada más.`);
}
