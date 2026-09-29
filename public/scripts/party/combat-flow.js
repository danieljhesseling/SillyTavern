/**
 * Cómo va una pelea de principio a fin: empezarla, la iniciativa, los turnos y las rondas, los
 * que se mueven solos, las salvaciones de muerte, los objetivos del tablero, la tregua, la
 * huida y el final con su pantalla de victoria.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import { Popup } from '../popup.js';
import { chat_metadata, saveMetadata, online_status, saveSettingsDebounced } from '../../script.js';
import { extension_settings } from '../extensions.js';
import { getCurrentWorldLocationMaps, getCurrentWorldEnemies, METADATA_KEY } from '../world-info.js';
import {
    getAbilityModifier, addItemToInventory, removeItemFromInventory, createItem, generateEnemyInstanceId,
} from '../dnd-system.js';
import { injuryTableFor } from '../game-engine/compendio/ailments.js';
import {
    rollDiceDetailed, getDistanceInFeet, getAttackRangeFeet, createEmptyCombatEncounter, nextRandom,
} from './combat-rules.js';
import { bestFor } from '../game-engine/rules/equipment.js';
import { isPassable } from '../game-engine/board/terrain.js';
import { patchUpAfterFight } from '../game-engine/rules/field-uses.js';
import {
    ROLES as ENEMY_ROLES, roleOf as bandRoleOf, tacticOf, describeBand,
} from '../game-engine/combat/enemy-roles.js';
import { readNemeses, comeback, nemesisFalls } from '../game-engine/campaign/nemesis.js';
import { isExit, leaveBoard, hasLeft, stillFighting, everyoneOut, leaveLine } from '../game-engine/board/exits.js';
import { truceLine } from '../game-engine/combat/morale-options.js';
import { bossPhase } from '../game-engine/combat/boss-phases.js';
import {
    boardBand, partyLevelOf, levelGap, levelAdjustment, adjustEnemy, adjustPlacements, levelNote,
} from '../game-engine/combat/level-adjust.js';
import { findPath, getPathCost } from '../game-engine/board/pathfinding.js';
import { planAllyTurn, stanceOf, STANCES, DEFAULT_PREFERENCE } from '../game-engine/combat/ally-ai.js';
import { startTurn as startManeuverTurn, readManeuvers, cannotAct } from '../game-engine/combat/maneuvers.js';
import { dropReadied } from '../game-engine/combat/readied.js';
import { perkBonus } from '../game-engine/rules/level-perks.js';
import { isIndoors } from '../game-engine/world/visibility.js';
import { spreadFire } from '../game-engine/board/living-terrain.js';
import { noteOutcome, shouldSoften, softenEnemy, SOFTEN_NOTE } from '../game-engine/campaign/safety-net.js';
import { wardLost } from '../game-engine/campaign/guests.js';
import { buildVictoryReport } from '../game-engine/combat/tally.js';
import { planRetreat } from '../game-engine/combat/retreat.js';
import { advanceTurn } from '../game-engine/combat/turn-machine.js';
import { applyInjury, describeInjuries } from '../game-engine/rules/injuries.js';
import { resolveFall } from '../game-engine/rules/mortality.js';
import { isIronRun, modeOf, modeLabel } from '../game-engine/rules/modes.js';
import { epitaphFor, heirloomOf, heirOf, addGrave, addToHall } from '../game-engine/campaign/legacy.js';
import { listNames } from '../game-engine/campaign/engine-narrator.js';
import { withJob, whoMourns } from '../game-engine/campaign/company.js';
import { takePrisoners } from '../game-engine/campaign/prisoners.js';
import { boxExamples } from '../game-engine/campaign/read-box.js';
import { readReasons } from '../game-engine/rules/companions.js';
import { planSpawnCells } from '../game-engine/combat/spawn.js';
import { enemiesInRoom, awakePlacements } from '../game-engine/campaign/campaign-map.js';
import { buildBoardState, judgeScenario, hasScenario } from '../game-engine/combat/scenario-board.js';
import { recordBondEvent, getBondProgress } from '../game-engine/campaign/bonds.js';
import { buildEpiloguePrompt } from '../game-engine/ui/combat-log.js';
import { getActiveRuleset } from '../game-engine/rules/ruleset.js';
import { knownAbilities } from '../game-engine/rules/abilities.js';
import { isDying, rollDeathSave, clearDeathSaves } from '../game-engine/rules/death-saves.js';
import {
    GRAVES_KEY, LEVEL_SAID_KEY, MODE_HISTORY_KEY, NEMESES_KEY, PRISONERS_KEY, SAFETY_KEY, SAFETY_ON_KEY, TAKEN_KEY,
} from './keys.js';
import {
    combatEncounter, currentBoardName, currentLocationName, partyMembers, setCombatBoardSelection,
    setCombatEncounter, setCombatLogEntries, setUsedReactions,
} from './state.js';
import { saveCheckpoint } from './checkpoints.js';
import { currentPet, offerTaming, petLivesIt } from './pet.js';
import { expireTimedConditions, getAbilityCatalogue } from './magic.js';
import { dismissGuests } from './contracts.js';
import {
    actsOnItsOwn, getAliveEnemies, getAttackableEnemiesForMember, getCurrentTurnEntry, getEnemyByInstanceId,
    getLivingPartyMembers, getPartyMemberByTurnEntry, getRemainingMovementFeet, partyCell, resetCombatTurnState,
    saveCombatState,
} from './combat-state.js';
import { showCombatDiceRoll } from './combat-log.js';
import { resolveEnemyAttackOn, resolveEnemyTurnAction } from './enemy-turn.js';
import {
    savePartyState, renderPartyMembers, lastLevelPlan, getLocationBoards, persistBoardTerrain,
    getActiveBoardContext, postCombatNarration, tellMoment, postForModel, currentSurvival, survivalNow,
    collectedHere, explodeBarrels, awardEncounterLoot, noteDeed, notePlot, hereLocation, raiseFame, recordBoardWon,
    countStat, showTip, tellBondScene, rememberTogether, bark, dropBoardKey, judgeDecision, partyMorale,
    getCampaignCalendar, getCampaignBonds, saveCampaignState, markLocationComplete, boardVisibility,
    lastCompendium, renderLocationMapsPreview,
} from './main.js';
import {
    handlePlayerCombatMove, performManeuver, handlePlayerCombatAttack, endPlayerCombatTurn,
} from './player-actions.js';

/**
 * @param {string} name
 * @param {number} dexterity
 * @param {'ally'|'enemy'} actorType
 * @returns {number}
 */
function rollInitiativeWithPopover(name, dexterity, actorType) {
    const dexMod = getAbilityModifier(dexterity || 10);
    const formula = `1d20${dexMod >= 0 ? '+' : ''}${dexMod}`;
    const roll = rollDiceDetailed(formula, 20);
    const total = roll.total;
    const d20 = roll.natural ?? roll.rolls[0] ?? total;

    showCombatDiceRoll({
        title: `Iniciativa de ${name}`,
        subtitle: actorType === 'enemy' ? 'Iniciativa de enemigo' : 'Iniciativa de aliado',
        formula: roll.formula,
        detail: `d20(${d20}) ${dexMod >= 0 ? '+' : ''}${dexMod} = ${total}`,
        total,
        glyph: 'init',
    });

    return total;
}

/**
 * @param {'victory'|'defeat'|'manual'|'ended'} reason
 * @returns {string}
 */
function buildCombatSummary(reason) {
    const enemyTotal = combatEncounter.enemies.length;
    const enemyAlive = combatEncounter.enemies.filter(enemy => (enemy.currentHp || 0) > 0).length;
    const enemyDefeated = Math.max(0, enemyTotal - enemyAlive);

    const partyTotal = partyMembers.length;
    const partyAlive = partyMembers.filter(member => (member.hp || 0) > 0).length;

    let outcome = 'Resultado: combate finalizado.';
    if (reason === 'victory') outcome = 'Resultado: victoria del grupo.';
    if (reason === 'defeat') outcome = 'Resultado: derrota del grupo.';
    if (reason === 'manual') outcome = 'Resultado: combate terminado manualmente.';

    const partyHp = partyMembers.length
        ? partyMembers.map(member => `${member.name} ${member.hp || 0}/${member.maxHp || 0}`).join(' | ')
        : 'Sin miembros de grupo.';
    const enemyHp = combatEncounter.enemies.length
        ? combatEncounter.enemies.map(enemy => `${enemy.name} ${enemy.currentHp || 0}/${enemy.maxHp || 0}`).join(' | ')
        : 'Sin enemigos registrados.';

    return [
        '📋 [COMBAT] Resumen final',
        outcome,
        `Enemigos derrotados: ${enemyDefeated}/${enemyTotal}`,
        `Aliados en pie: ${partyAlive}/${partyTotal}`,
        `HP aliados: ${partyHp}`,
        `HP enemigos: ${enemyHp}`,
    ].join('\n');
}

/**
 * @param {import('../dnd-system.js').TurnEntry|null} entry
 */
function announceTurnInChat(entry) {
    if (!entry) return;
    const actorType = entry.isEnemy ? 'Enemigo' : 'Jugador';
    const actorIcon = entry.isEnemy ? '⚔️' : '🛡️';
    postCombatNarration(`${actorIcon} [COMBAT] Turno de ${entry.name} (${actorType})`);

    if (!entry.isEnemy) {
        const member = getPartyMemberByTurnEntry(entry);
        if (!member) return;
        const rangeFeet = getAttackRangeFeet(member);
        const remainingFeet = getRemainingMovementFeet(member);
        const targets = getAttackableEnemiesForMember(member);
        const targetSummary = targets.length
            ? targets.map(enemy => enemy.name).join(', ')
            : 'ningun enemigo en rango';
        postCombatNarration(`💬 [COMBAT] ${member.name}, elige accion. Usa /combat-attack <objetivo>, /combat-move <x> <y> y /combat-end. Movimiento restante: ${remainingFeet} ft. Rango actual: ${rangeFeet} ft. Objetivos en rango: ${targetSummary}.`);
        // En la caja, lo que entiende escrito en llano, no los comandos.
        // Con alguien al alcance, ese; si no, cualquiera en pie: el ejemplo lleva un nombre.
        const foes = [...targets, ...getAliveEnemies()].map(enemy => String(enemy.name));
        const tries = boxExamples({ fighting: true, foes }).map(example => `«${example}»`);
        setChatPlaceholder(`Te toca. Escribe, por ejemplo: ${tries.join(', ')}`, true);
    }
}

/** La caja de escribir fuera de la pelea, dicha llana. */
const CHAT_PLACEHOLDER = 'Escribe lo que hace tu personaje…';

/**
 * Lo que dice la caja de escribir. En tu turno, ejemplos de lo que entiende; al acabar la
 * pelea, lo de siempre: antes se quedaba con «/combat-attack … | /combat-end» puesto para
 * el resto de la partida. Con «Al narrador» encendido se cambia lo que vuelve al apagarlo.
 *
 * @param {string} text
 * @param {boolean} fighting Si es el de la pelea, que hay que quitar al acabar.
 */
function setChatPlaceholder(text, fighting) {
    const box = /** @type {HTMLTextAreaElement|null} */ (document.querySelector('#send_textarea'));
    if (!box) return;
    if (box.dataset.placeholderBefore !== undefined) box.dataset.placeholderBefore = text;
    else box.placeholder = text;
    if (fighting) box.dataset.fightPlaceholder = '1';
    else delete box.dataset.fightPlaceholder;
}

/**
 * Sin pelea, la caja dice lo de siempre: en una partida, lo del juego; en un chat que no lo
 * es y que se quedó con lo del juego, lo de SillyTavern.
 */
export function restoreChatPlaceholder() {
    const box = /** @type {HTMLTextAreaElement|null} */ (document.querySelector('#send_textarea'));
    if (!box) return;
    if (chat_metadata?.[METADATA_KEY]) {
        setChatPlaceholder(CHAT_PLACEHOLDER, false);
        box.dataset.gamePlaceholder = '1';
    } else if (box.dataset.gamePlaceholder || box.dataset.fightPlaceholder) {
        setChatPlaceholder(box.getAttribute(online_status === 'no_connection' ? 'no_connection_text' : 'connected_text') || '', false);
        delete box.dataset.gamePlaceholder;
    }
}

/**
 * @param {import('../dnd-system.js').TurnEntry|null} entry
 * @returns {boolean}
 */
function canTurnEntryAct(entry) {
    if (!entry) return false;
    if (entry.isEnemy) {
        const enemy = getEnemyByInstanceId(entry.id);
        return Boolean(enemy && enemy.currentHp > 0);
    }
    const member = getPartyMemberByTurnEntry(entry);
    // B2: quien salió ya no tiene turno.
    return Boolean(member && member.hp > 0 && !hasLeft(combatEncounter.left, member.id));
}

/**
 * El turno de quien esta en el suelo: una salvacion de muerte.
 *
 * No actua — no puede — pero su turno no es un hueco en blanco: es el momento mas tenso
 * de una mesa de D&D, y hasta ahora no existia. Se tira sola al llegarle el turno, porque
 * no hay nada que decidir.
 *
 * @param {any} member
 * @returns {boolean} Si ha pasado algo que merezca redibujar.
 */
function resolveDeathSave(member) {
    if (!isDying(member)) return false;

    const result = rollDeathSave({
        member,
        roll: () => rollDiceDetailed('1d20', 20),
    });

    member.deathSaves = result.saves;
    if (result.hp != null) member.hp = result.hp;

    if (result.outcome === 'up') {
        member.activeConditions = (Array.isArray(member.activeConditions) ? member.activeConditions : [])
            .filter((/** @type {string} */ c) => c !== 'Unconscious');
    }

    // El tercer fallo dejaba a alguien tirado para siempre y ahi se acababa: ni moria ni
    // se levantaba. Ahora pasa lo que diga la campana — muere quien vino por la paga, y
    // quien vino por ti se levanta roto.
    if (result.outcome === 'dead') applyFall(member);

    showCombatDiceRoll({
        title: `${member.name}: salvación de muerte`,
        subtitle: result.outcome === 'dead' ? 'Tercer fallo' : '',
        formula: '1d20',
        detail: result.line,
        total: result.natural,
        dc: 10,
        natural: result.natural,
        glyph: 'd20',
    });

    postCombatNarration(`☠️ [COMBAT] ${result.line}`);
    savePartyState();
    saveCombatState();
    return true;
}

/**
 * Ideas 36 y 199: lo que queda de quien muere. Epitafio, tumba donde cayó, lo mejor que
 * llevaba para quien más le quería, y un sitio en el salón de la fama.
 *
 * @param {any} member
 * @param {number} today
 * @param {any} bonds
 */
export function buryMember(member, today, bonds) {
    const place = currentLocationName || '';
    const epitaph = epitaphFor(member, { day: today, place, className: String(member.charClass ?? member.className ?? '') });
    if (chat_metadata) {
        chat_metadata[GRAVES_KEY] = addGrave(chat_metadata[GRAVES_KEY], { name: String(member.name), place, day: today, epitaph });
        saveMetadata();
    }
    // Lo que se hereda: el arma que llevaba, o lo que más valía.
    const heir = heirOf({
        dead: member,
        party: partyMembers,
        bondRanks: Object.fromEntries(partyMembers.map(m => [String(m.id), getBondProgress(bonds, String(m.id)).rank])),
    });
    const heirloom = heirloomOf(member);
    let inherited = '';
    if (heir && heirloom) {
        removeItemFromInventory(/** @type {any} */ (member), String(heirloom.id));
        heir.items = heir.items ?? [];
        addItemToInventory(/** @type {any} */ (heir), createItem(/** @type {any} */ ({
            ...heirloom,
            id: undefined,
            heirloom: String(member.name),
            description: [String(heirloom.description ?? ''), `Era de ${member.name}.`].filter(Boolean).join(' '),
        })));
        inherited = `${heir.name} se queda con ${heirloom.name}.`;
    }
    // Idea 199: el salón de la fama no es de ninguna partida.
    const settings = /** @type {any} */ (extension_settings);
    settings.partyHall = addToHall(settings.partyHall, {
        name: String(member.name), world: String(chat_metadata?.[METADATA_KEY] ?? ''), day: today, epitaph,
        when: new Date().toISOString(),
        // R1 (DR2): de hierro solo si lo fue siempre.
        mode: modeLabel(modeOf(survivalNow())),
        iron: isIronRun(survivalNow(), chat_metadata?.[MODE_HISTORY_KEY] ?? null),
    });
    saveSettingsDebounced();
    postCombatNarration(`🪦 [CAMPAÑA] ${epitaph}${inherited ? ` ${inherited}` : ''}`);
    void postForModel(`[MUERTE] ${epitaph}${inherited ? ` ${inherited}` : ''} Ya no está: que se note en lo que cuentes, y que nadie le haga hablar.`, {
        show: [tellMoment('muerte', { quien: String(member?.name || ''), epitafio: String(epitaph || '') }), inherited].filter(Boolean).join(' '),
    })
        .catch(error => console.error('[party] death note failed', error));
}

export function applyFall(member, cause = '') {
    const fall = resolveFall(member, {
        roll: () => nextRandom(),
        rules: getActiveRuleset()?.survival ?? null,
        // Caer con el golpe todavia encima deja peor recuerdo que desangrarse despacio.
        severity: (Number(member.hp) || 0) < 0 ? 1 : 0,
        // De que viene el golpe elige la rama: una caida rompe huesos, el fuego quema
        // manos y el frio se lleva dedos. Sin bateria de estados, la tabla de siempre.
        table: injuryTableFor(lastCompendium, cause),
    });

    if (fall.outcome === 'dies') {
        member.dead = true;
        countStat('deaths');
        postCombatNarration(`⚰️ [COMBAT] ${fall.reason}`);
        toastr.error(fall.reason, 'Se acabo', { timeOut: 15000 });
        // Idea 43: quien le quería, o quien busca calma, guarda duelo un dia.
        const today = Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1));
        const bonds = getCampaignBonds();
        for (const grief of whoMourns({
            party: partyMembers.filter(m => m !== member).map(m => ({
                id: m.id, name: m.name, hp: m.hp, wants: readReasons(m).wants,
                bondWithDead: getBondProgress(bonds, String(m.id)).rank,
            })),
            dead: String(member.name),
            today,
        })) {
            const mourner = partyMembers.find(m => String(m.id) === grief.id);
            if (mourner) mourner.mourning = grief.mourning;
        }
        buryMember(member, today, bonds);
        rememberTogether(`${member.name} murió en ${currentBoardName || currentLocationName}.`,
            partyMembers.map(m => String(m.name)));
        return;
    }

    // Un mundo puede decidir que las heridas no quedan: se levanta y ya esta.
    if (!currentSurvival().injuries) {
        member.hp = 1;
        member.deathSaves = clearDeathSaves();
        postCombatNarration(`🩸 [COMBAT] ${fall.reason}`);
        return;
    }

    const patch = applyInjury(member, fall.injury);
    member.injuries = patch.injuries;
    member.baseStats = patch.baseStats;
    Object.assign(member, patch.stats);

    // Se levanta, pero no entero: sigue a 1 PG y con lo suyo encima.
    member.hp = 1;
    member.deathSaves = clearDeathSaves();
    member.activeConditions = (Array.isArray(member.activeConditions) ? member.activeConditions : [])
        .filter((/** @type {string} */ c) => c !== 'Unconscious');

    postCombatNarration(`🩸 [COMBAT] ${fall.reason}`);
    postCombatNarration(`🩹 [COMBAT] ${describeInjuries(member).join(' · ')}`);
    toastr.warning(describeInjuries(member).join('\n'), fall.reason, { timeOut: 15000 });
}

/**
 * Idea 23: al empezar cada ronda, el fuego se extiende a lo que arde de al lado (cajas,
 * puertas, maleza), se apaga a las tres rondas, y con lluvia no prende.
 */
function burnRound() {
    const context = getActiveBoardContext();
    const board = context.board;
    if (!board || !Array.isArray(board.hazards) || board.hazards.length === 0) return;
    const step = spreadFire({
        hazards: board.hazards,
        terrain: context.terrain,
        round: Number(combatEncounter.round) || 1,
        random: nextRandom,
        wet: boardVisibility().wet,
        outdoors: !isIndoors(board, hereLocation()),
        width: context.gridWidth,
        height: context.gridHeight,
    });
    if (step.lines.length === 0) return;
    board.hazards = step.hazards;
    board.terrain = step.terrain;
    persistBoardTerrain(board);
    // R6: si el fuego llega a un barril, revienta.
    const blasts = explodeBarrels(step.burnt.filter(b => /barril/i.test(b.what)));
    postCombatNarration(`[COMBAT] ${[...step.lines, ...blasts].join('\n')}`);
    renderLocationMapsPreview();
}

/**
 * R6: los jefes con fases (la P22): al bajar de la mitad, cambian una vez, y se dice.
 */
function bossPhases() {
    const band = [...getAliveEnemies()]
        .sort((a, b) => (Number(a.maxHp) || 0) - (Number(b.maxHp) || 0))
        .map(e => String(e.name).replace(/\s+\d+$/, ''));
    for (const enemy of getAliveEnemies()) {
        const phase = bossPhase({ enemy, band });
        if (!phase) continue;
        Object.assign(enemy, phase.patch);
        postCombatNarration(`👑 [COMBAT] ${phase.line}`);
        if (phase.summon.length > 0) {
            const board = getActiveBoardContext().board;
            if (board) {
                board.waves = [...(Array.isArray(board.waves) ? board.waves : []), {
                    round: Number(combatEncounter.round) || 1, names: phase.summon, x: Number(enemy.gridX) || 0, y: Number(enemy.gridY) || 0, tell: '',
                }];
                arriveWaves();
            }
        }
    }
    saveCombatState();
}

/**
 * R6: los refuerzos de un tablero (la P21). Una ronda antes se oyen (el aviso); en su ronda
 * llegan, junto a donde dice el tablero, y entran en la iniciativa.
 */
function arriveWaves() {
    const board = getActiveBoardContext().board;
    if (!board || !Array.isArray(board.waves) || board.waves.length === 0 || !combatEncounter.active) return;
    const round = Number(combatEncounter.round) || 1;
    const { terrain, gridWidth, gridHeight } = getActiveBoardContext();
    const busy = new Set([
        ...partyMembers.map(m => `${Number(m.mapPosition?.gridX) || 0},${Number(m.mapPosition?.gridY) || 0}`),
        ...combatEncounter.enemies.filter(e => (e.currentHp || 0) > 0).map(e => `${Number(e.gridX) || 0},${Number(e.gridY) || 0}`),
    ]);
    let changed = false;
    board.waves = board.waves.map((/** @type {any} */ wave) => {
        if (!wave || wave.done) return wave;
        if (Number(wave.round) - 1 === round && wave.tell && !wave.told) {
            postCombatNarration(`👂 [COMBAT] ${wave.tell}`);
            changed = true;
            return { ...wave, told: true };
        }
        if (Number(wave.round) > round) return wave;
        // Las casillas libres más cerca de por donde llegan.
        /** @type {Array<{x: number, y: number}>} */
        const cells = [];
        for (let r = 0; r <= 3 && cells.length < (wave.names?.length ?? 0); r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    const x = Number(wave.x) + dx;
                    const y = Number(wave.y) + dy;
                    if (cells.length >= (wave.names?.length ?? 0) || busy.has(`${x},${y}`) || !isPassable(terrain, x, y, gridWidth, gridHeight)) continue;
                    busy.add(`${x},${y}`);
                    cells.push({ x, y });
                }
            }
        }
        const arrived = instancesFromPlacements((wave.names ?? []).slice(0, cells.length).map((/** @type {string} */ name, /** @type {number} */ i) => ({ name, ...cells[i] })));
        if (arrived.length > 0) {
            combatEncounter.enemies = [...combatEncounter.enemies, ...arrived];
            for (const enemy of arrived) {
                const initiative = rollInitiativeWithPopover(enemy.name, enemy.dexterity || 10, 'enemy');
                combatEncounter.turnOrder.push({ id: enemy.instanceId, name: enemy.name, initiative, isEnemy: true });
            }
            postCombatNarration(`⚠️ [COMBAT] Llegan refuerzos: ${arrived.map(e => e.name).join(', ')}.`);
        }
        changed = true;
        return { ...wave, done: true };
    });
    if (!changed) return;
    persistBoardTerrain(board);
    saveCombatState();
    renderLocationMapsPreview();
}

function advanceTurnIndex() {
    if (!combatEncounter.active || combatEncounter.turnOrder.length === 0) return null;

    // T2: si acaba el turno de alguien del grupo con una tregua pedida, ya la ha visto: sin
    // respuesta, el siguiente enemigo la da por rechazada.
    const ending = getCurrentTurnEntry();
    if (ending && !ending.isEnemy && /** @type {any} */ (combatEncounter).truce === 'pending') {
        /** @type {any} */ (combatEncounter).truceSeen = true;
    }

    // The machine owns the walk: it skips the fallen, wraps the order and counts the
    // round. This used to be a second implementation of the same thing, right here.
    const roundBefore = Number(combatEncounter.round) || 1;
    const advanced = advanceTurn(combatEncounter, entry => canTurnEntryAct(entry));

    if (advanced === combatEncounter) return null;   // nobody left who can act

    Object.assign(combatEncounter, advanced);
    // Lo que caduca cuando vuelve a tocarle a alguien: su esquivar, su destrabarse, su ayuda.
    const starting = getCurrentTurnEntry();
    if (starting) combatEncounter.maneuvers = startManeuverTurn(combatEncounter.maneuvers, String(starting.id));
    // Idea 4: lo preparado dura hasta que vuelve a tocarle.
    if (starting) combatEncounter.readied = dropReadied(combatEncounter.readied, String(starting.id));
    saveCombatState();

    // Announced here rather than inside the machine, which stays pure and silent.
    if (combatEncounter.round > roundBefore) {
        postCombatNarration(`⏳ [COMBAT] Ronda ${combatEncounter.round}`);
        // Lo que una habilidad puso con duracion se va aqui, que es el unico sitio donde
        // el combate cuenta rondas.
        for (const line of expireTimedConditions()) postCombatNarration(line);

        // Y aqui tiran los que estan en el suelo. En 5e se tira "al empezar tu turno",
        // pero la maquina de turnos salta a quien no puede actuar, asi que el turno de un
        // caido no llega nunca: una vez por ronda es lo mismo y no pide reescribirla.
        for (const member of partyMembers) resolveDeathSave(member);

        // Ronda nueva, reacciones nuevas.
        setUsedReactions(new Set());
        // Idea 23: el tablero cambia mientras se pelea.
        burnRound();
        // R6: los refuerzos del tablero: se oyen una ronda antes, y llegan en la suya.
        arriveWaves();
        // R6: y los jefes que han bajado de la mitad cambian.
        bossPhases();
        // A scenario won by the clock has no other moment to notice.
        if (checkScenarioOutcome()) return null;
    }

    return getCurrentTurnEntry();
}

/** R3: cómo se dicen los estados que quitan el turno. */
export const CONDITION_WORDS = /** @type {Record<string, string>} */ ({
    Unconscious: 'dormido', Stunned: 'aturdido', Paralyzed: 'paralizado', Incapacitated: 'fuera de sí',
});

/**
 * La casilla que pide el tablero y que aún no se ha pisado: la de «llegar», o la salida
 * de quien se escolta (solo para él).
 *
 * @param {any} member
 * @returns {{x: number, y: number}|null}
 */
function objectiveCellFor(member) {
    const location = getCurrentWorldLocationMaps().find(l => l.name === currentLocationName);
    const board = getLocationBoards(location).find((/** @type {any} */ b) => b.name === currentBoardName);
    for (const objective of Array.isArray(board?.objectives) ? board.objectives : []) {
        const cell = objective?.cell;
        if (!cell || objective.optional || !Number.isFinite(Number(cell.x))) continue;
        if (objective.type === 'reach_cell' || (objective.type === 'escort' && String(objective.allyId) === String(member.id))) {
            return { x: Number(cell.x), y: Number(cell.y) };
        }
    }
    return null;
}

/**
 * Andar hacia la casilla del objetivo, por donde se pueda y hasta donde den los pies.
 *
 * @param {any} member
 * @param {{x: number, y: number}} goal
 * @returns {string}
 */
function walkTowardObjective(member, goal) {
    const { terrain, gridWidth, gridHeight } = getActiveBoardContext();
    const from = { x: Number(member.mapPosition?.gridX) || 0, y: Number(member.mapPosition?.gridY) || 0 };
    const said = `[COMBAT] ${member.name}: no queda nadie, así que va a lo que pide el tablero, (${goal.x + 1}, ${goal.y + 1}).`;
    if (from.x === goal.x && from.y === goal.y) return said;
    const occupied = new Set(partyMembers
        .filter(m => Number(m.id) !== Number(member.id) && (Number(m.hp) || 0) > 0)
        .map(m => `${Number(m.mapPosition?.gridX) || 0},${Number(m.mapPosition?.gridY) || 0}`));
    const path = findPath(terrain, from.x, from.y, goal.x, goal.y, gridWidth, gridHeight, { occupied });
    if (!path || path.length < 2) return `[COMBAT] ${member.name} no encuentra por dónde llegar a (${goal.x + 1}, ${goal.y + 1}).`;
    const feet = getRemainingMovementFeet(member);
    // Lo más lejos del camino que se alcanza este turno, sin pasarse de pies.
    let stop = null;
    for (let i = 1; i < path.length; i++) {
        if (getPathCost(terrain, path.slice(0, i + 1)) * 5 > feet) break;
        if (getDistanceInFeet(from.x, from.y, path[i].x, path[i].y) > feet) break;
        stop = path[i];
    }
    if (stop) handlePlayerCombatMove(`${stop.x + 1},${stop.y + 1}`);
    return said;
}

export function resolveAllyTurnAction(entry) {
    const member = partyMembers.find(m => Number(m.id) === Number(entry.id));
    if (!member) return '';
    const out = cannotAct(member.activeConditions);
    if (out && (Number(member.hp) || 0) > 0) return `💤 [COMBAT] ${member.name} no puede actuar (${CONDITION_WORDS[out] ?? out}): pierde el turno.`;

    const living = combatEncounter.enemies.filter((/** @type {any} */ e) => (Number(e.currentHp) || 0) > 0);
    if (living.length === 0) {
        // Sin nadie en pie, queda lo que pide el tablero: llegar a una casilla, o llevar a
        // quien se escolta. Antes se quedaba quieto y la pelea no se acababa nunca.
        const goal = objectiveCellFor(member);
        if (goal) return walkTowardObjective(member, goal);
        return `[COMBAT] ${member.name} baja el arma: no queda nadie.`;
    }

    const { terrain, gridWidth, gridHeight } = getActiveBoardContext();
    const cellOf = (/** @type {any} */ m) => ({
        gridX: Number(m.mapPosition?.gridX) || 0,
        gridY: Number(m.mapPosition?.gridY) || 0,
    });

    // Su postura la eliges tu, en su ficha. Sin elegir, se queda a tu lado: el valor
    // por defecto de antes era cargar, y eso no lo habia decidido nadie.
    const stance = stanceOf(member);
    const yours = partyMembers[0];
    const leader = yours && String(yours.id) !== String(member.id) && (Number(yours.hp) || 0) > 0
        ? cellOf(yours) : null;

    const plan = planAllyTurn({
        actor: {
            id: String(member.id),
            name: String(member.name),
            ...cellOf(member),
            currentHp: Number(member.hp) || 0,
            maxHp: Number(member.maxHp) || 1,
            speedFeet: Number(member.speed) || 30,
            // Su arma de verdad: un arquero que se queda atras tiene que poder disparar.
            attackRangeFeet: getAttackRangeFeet(member),
        },
        leader,
        enemies: living.map((/** @type {any} */ e) => ({
            id: String(e.instanceId),
            gridX: Number(e.gridX) || 0,
            gridY: Number(e.gridY) || 0,
            currentHp: Number(e.currentHp) || 0,
            maxHp: Number(e.maxHp) || 1,
            reachFeet: Number(e.attackRangeFeet) || 5,
            boss: Boolean(e.boss),
        })),
        allies: partyMembers
            .filter(m => Number(m.id) !== Number(member.id) && (Number(m.hp) || 0) > 0)
            .map(m => ({ id: String(m.id), ...cellOf(m) })),
        stance,
        // Idea 35: a quien prefiere, de su ficha.
        prefer: String(member.prefer || DEFAULT_PREFERENCE),
        terrain,
        gridWidth,
        gridHeight,
    });

    /** @type {string[]} */
    const lines = [`[COMBAT] ${member.name} (${STANCES[/** @type {keyof typeof STANCES} */ (stance)].label.toLowerCase()}) decide por su cuenta: ${plan.rationale}`];

    // Destrabarse va **antes** de moverse: es lo que le deja irse sin pagar el golpe.
    if (plan.action === 'disengage') performManeuver('destrabarse');

    const here = cellOf(member);
    if (plan.destination && (plan.destination.x !== here.gridX || plan.destination.y !== here.gridY)) {
        // Se mueve por la puerta de siempre: cuenta los pies y paga los ataques de
        // oportunidad igual que si lo arrastraras tu.
        handlePlayerCombatMove(`${plan.destination.x + 1},${plan.destination.y + 1}`);
    }

    if (plan.action === 'dodge') performManeuver('esquivar');

    if (plan.action === 'attack' && plan.targetId != null) {
        const target = living.find((/** @type {any} */ e) => String(e.instanceId) === String(plan.targetId));
        if (target) handlePlayerCombatAttack(String(target.name));
    }

    return lines.join('\n');
}

export function runCombatTurnLoop(includeCurrent = true) {
    if (!combatEncounter.active || combatEncounter.turnOrder.length === 0) return null;

    let entry = includeCurrent ? getCurrentTurnEntry() : advanceTurnIndex();
    if (!entry || !canTurnEntryAct(entry)) {
        entry = advanceTurnIndex();
    }

    let safety = 0;
    while (entry && combatEncounter.active
        && (entry.isEnemy || actsOnItsOwn(entry))
        && safety < combatEncounter.turnOrder.length + 1) {
        announceTurnInChat(entry);
        const actionLog = entry.isEnemy ? resolveEnemyTurnAction(entry) : resolveAllyTurnAction(entry);
        postCombatNarration(actionLog);

        if (!getLivingPartyMembers().length) {
            // B2: si alguien salió antes, los de dentro han caído pero los de fuera se salvan.
            if (everyoneOut(partyMembers.filter(m => !m.dead), combatEncounter.left)) {
                finishEscape('Los que quedaban dentro han caído; los que salieron, se salvan.');
                return null;
            }
            postCombatNarration('💀 [COMBAT] Todos los miembros del grupo han caido. Fin del combate.');
            endCombat('defeat');
            return null;
        }

        entry = advanceTurnIndex();
        safety += 1;
    }

    if (entry && combatEncounter.active) {
        announceTurnInChat(entry);
        teachTurn(entry);
    }

    return entry;
}

/**
 * J2.2: lo que se aprende en tu turno, la primera vez: a andar y, si hay alguien a tu
 * alcance, a atacar. Solo si el turno lo juegas tú: el de un compañero que va solo no enseña.
 *
 * @param {import('../dnd-system.js').TurnEntry|null} entry
 */
function teachTurn(entry) {
    if (!entry || entry.isEnemy || actsOnItsOwn(entry)) return;
    const member = getPartyMemberByTurnEntry(entry);
    if (!member) return;
    showTip('move');
    if (getAttackableEnemiesForMember(member).length > 0) showTip('attack');
}

/**
 * Convierte lo que el libro dibujo en el tablero en enemigos de verdad.
 *
 * Es el ritmo de una mazmorra de Gloomhaven: el siguiente combate llega cuando **tu**
 * abres la puerta, no cuando se carga el mapa. Aparecen donde el libro los dibujo, con
 * los numeros de su plantilla; una colocacion sin plantilla se salta y se avisa.
 *
 * @param {Array<{name: string, x: number, y: number}>} placements
 * @returns {import('../dnd-system.js').EnemyInstance[]}
 */
export function instancesFromPlacements(placements) {
    const templates = getCurrentWorldEnemies();
    // J4.6: un tablero escrito para otro nivel se ajusta al grupo. Al empezar la pelea, con
    // un esbirro de más o de menos; lo que llega después (una sala, un refuerzo), solo con
    // sus números.
    const level = levelAdjustHere();
    const drawn = level && !combatEncounter.active ? levelPlacements(placements, level, templates) : placements;
    /** @type {import('../dnd-system.js').EnemyInstance[]} */
    const instances = [];

    for (const placement of drawn) {
        const template = templates.find(e => String(e.name).toLowerCase() === String(placement.name).toLowerCase());
        if (!template) {
            console.warn('[party] placement with no template', placement);
            continue;
        }
        const already = combatEncounter.enemies.filter(e => e.name.startsWith(template.name)).length
            + instances.filter(e => e.name.startsWith(template.name)).length;
        // R7: la némesis vuelve más fuerte, y lo dice.
        const nemesis = /** @type {any} */ (placement).nemesis ? readNemeses(chat_metadata?.[NEMESES_KEY]).find(n => n.id === /** @type {any} */ (placement).nemesis && !n.gone) : null;
        const back = nemesis ? comeback(nemesis) : null;
        if (back) {
            postCombatNarration(back.line.replace(/^😈 /u, '😈 [NEMESIS] '));
            void postForModel(back.forModel);
        }
        instances.push({
            ...(back ? { nemesis: /** @type {any} */ (nemesis).id } : {}),
            instanceId: generateEnemyInstanceId(),
            templateId: template.id,
            name: already > 0 ? `${template.name} ${already + 1}` : template.name,
            avatar: template.avatar,
            currentHp: Math.round(template.maxHp * (back?.hpFactor ?? 1)),
            maxHp: Math.round(template.maxHp * (back?.hpFactor ?? 1)),
            armorClass: template.armorClass,
            strength: template.strength,
            dexterity: template.dexterity,
            constitution: template.constitution,
            intelligence: template.intelligence,
            wisdom: template.wisdom,
            charisma: template.charisma,
            speed: template.speed,
            cr: template.cr,
            // Sin esto, todos peleaban como agresivos de cuerpo a cuerpo: el arquero del
            // mundo bajaba a dar punetazos.
            profile: /** @type {any} */ (template).profile,
            attackRangeFeet: /** @type {any} */ (template).attackRangeFeet,
            abilities: /** @type {any} */ (template).abilities,
            gridX: placement.x,
            gridY: placement.y,
        });
    }

    if (level) for (const enemy of instances) Object.assign(enemy, adjustEnemy(enemy, level.adjustment));
    return instances;
}

/**
 * J4.6: cuánto se aparta el grupo de lo que pide el tablero abierto. Solo en los tableros
 * escritos de una campaña del tablón: los de los encargos ya salen a la medida del grupo
 * (el presupuesto del R6), y ajustarlos otra vez sería contarlo dos veces.
 *
 * @returns {{adjustment: import('../game-engine/combat/level-adjust.js').LevelAdjustment, band: {low: number, high: number}, level: number, size: number}|null}
 */
function levelAdjustHere() {
    const board = getActiveBoardContext().board;
    if (!lastLevelPlan || !board) return null;
    const name = String(board.name ?? '');
    if (!board.packBoardId && !lastLevelPlan.actOf[name.toLowerCase()]) return null;
    const { level, size } = partyLevelOf(partyMembers);
    if (size === 0) return null;
    const band = boardBand(lastLevelPlan, name);
    const adjustment = levelAdjustment(levelGap(level, band));
    return adjustment.steps === 0 ? null : { adjustment, band, level, size };
}

/**
 * J4.6: los que salen al empezar, con un esbirro de más o de menos. Se dice la primera vez
 * (y otra si el grupo pasa al otro lado del tramo), y cada vez que sale uno de más o de menos:
 * si no, el lobo que no estaba en el tablero parecería un error.
 *
 * @param {Array<{name: string, x: number, y: number}>} placements
 * @param {NonNullable<ReturnType<typeof levelAdjustHere>>} level
 * @param {any[]} templates
 * @returns {Array<{name: string, x: number, y: number}>}
 */
function levelPlacements(placements, level, templates) {
    const { terrain, gridWidth, gridHeight, board } = getActiveBoardContext();
    const result = adjustPlacements({
        placements, adjustment: level.adjustment, bestiary: templates,
        partyLevel: level.level, partySize: level.size, band: level.band,
        terrain, gridWidth, gridHeight,
        // Donde está el grupo y donde espera el resto del tablero.
        taken: [
            ...partyMembers.map(m => ({ x: Number(m.mapPosition?.gridX) || 0, y: Number(m.mapPosition?.gridY) || 0 })),
            ...(Array.isArray(board?.enemyPlacements) ? board.enemyPlacements : []),
        ],
    });
    const side = level.adjustment.steps > 0 ? 'up' : 'down';
    if (chat_metadata && chat_metadata[LEVEL_SAID_KEY] !== side) {
        chat_metadata[LEVEL_SAID_KEY] = side;
        const note = levelNote(level);
        postCombatNarration(`⚖️ [COMBAT] ${note}`);
        toastr.info(note, 'El nivel de la campaña', { timeOut: 9000 });
    }
    for (const name of result.added) postCombatNarration(`⚖️ [COMBAT] Por vuestro nivel, hay un enemigo más: ${name}.`);
    for (const name of result.removed) postCombatNarration(`⚖️ [COMBAT] Por vuestro nivel, hay un enemigo menos: ${name}.`);
    return result.placements;
}

/**
 * Despierta a lo que duerme en una sala recien revelada.
 *
 * @param {any} board El tablero abierto.
 * @param {any} room La sala que se acaba de revelar.
 * @returns {number} Cuantos han despertado.
 */
export function wakeRoomEnemies(board, room) {
    const placements = enemiesInRoom(room, board?.enemyPlacements ?? []);
    if (placements.length === 0) return 0;

    const woken = instancesFromPlacements(placements);
    if (woken.length === 0) return 0;

    const names = woken.map(e => `${e.name} (${e.gridX + 1}, ${e.gridY + 1})`).join(', ');

    if (!combatEncounter.active) {
        // Nadie peleaba: la sala abre su propio combate.
        postCombatNarration(`[COMBAT] Se despierta lo que dormia en la sala: ${names}.`);
        beginEncounterWith(woken);
        showInitiativeBanner(woken.map(e => e.name));
        return woken.length;
    } else {
        combatEncounter.enemies = [...combatEncounter.enemies, ...woken];
        for (const enemy of woken) {
            const initiative = rollInitiativeWithPopover(enemy.name, enemy.dexterity || 10, 'enemy');
            combatEncounter.turnOrder.push({ id: enemy.instanceId, name: enemy.name, initiative, isEnemy: true });
        }
        saveCombatState();
    }

    postCombatNarration(`⚠️ [COMBAT] Se despierta lo que dormia en la sala: ${names}.`);
    showInitiativeBanner(woken.map(e => e.name));
    return woken.length;
}

/**
 * Start a combat encounter on the current board.
 * @param {import('../dnd-system.js').EnemyTemplate} template - Enemy template
 * @param {number} count - Number of enemies to spawn
 * @param {number} [gridWidth=50] - Board grid width for random placement
 * @param {number} [gridHeight=50] - Board grid height for random placement
 * @returns {string} Initiative order summary string
 */
export function startCombat(template, count, gridWidth = 50, gridHeight = 50) {
    // A new fight starts with an empty log: the last one's blow-by-blow is already in
    // the chat, and leaving it here would read as if it were still happening.
    setCombatLogEntries([]);

    // Donde los pone el tablero, si los pone. Un libro dibuja a sus monstruos donde
    // quiere — tras la cobertura, al otro lado de la sala — y ese dibujo es la mitad de
    // lo que hace que el encuentro sea el que es. Antes caian en una casilla al azar de
    // la esquina, muros incluidos.
    const spawnBoard = getActiveBoardContext();
    const spawnCells = planSpawnCells({
        name: template.name,
        count,
        // Solo los que estan en una sala ya revelada: lo que duerme tras una puerta
        // cerrada no aparece porque alguien escriba su nombre.
        placements: awakePlacements(spawnBoard.board?.rooms, spawnBoard.board?.enemyPlacements ?? []),
        terrain: spawnBoard.terrain,
        gridWidth: spawnBoard.gridWidth || gridWidth,
        gridHeight: spawnBoard.gridHeight || gridHeight,
        taken: partyMembers.map(m => ({
            x: Number(m.mapPosition?.gridX) || 0,
            y: Number(m.mapPosition?.gridY) || 0,
        })),
        // Con el dado de la partida, no con Math.random. Cuando no hay nada dibujado que
        // este despierto, la casilla se sortea — y una tirada que se salte la semilla hace
        // que dos partidas con la misma semilla dejen de salir iguales, que es justo lo
        // unico que la semilla promete.
        random: nextRandom,
    });

    /** @type {import('../dnd-system.js').EnemyInstance[]} */
    const newEnemies = [];
    for (let i = 0; i < count; i++) {
        newEnemies.push({
            instanceId: generateEnemyInstanceId(),
            templateId: template.id,
            name: count > 1 ? `${template.name} ${i + 1}` : template.name,
            avatar: template.avatar,
            // Idea 24: el jefe del guion lo es también en el tablero.
            boss: Boolean(/** @type {any} */ (template).boss),
            currentHp: template.maxHp,
            maxHp: template.maxHp,
            armorClass: template.armorClass,
            strength: template.strength,
            dexterity: template.dexterity,
            constitution: template.constitution,
            intelligence: template.intelligence,
            wisdom: template.wisdom,
            charisma: template.charisma,
            speed: template.speed,
            cr: template.cr,
            // Sin esto, todos peleaban como agresivos de cuerpo a cuerpo: el arquero del
            // mundo bajaba a dar punetazos.
            profile: /** @type {any} */ (template).profile,
            attackRangeFeet: /** @type {any} */ (template).attackRangeFeet,
            abilities: /** @type {any} */ (template).abilities,
            gridX: spawnCells[i]?.x ?? 0,
            gridY: spawnCells[i]?.y ?? 0,
        });
    }

    return beginEncounterWith(newEnemies);
}

/**
 * Arranca el encuentro con los enemigos dados: tira iniciativas, ordena y empieza.
 *
 * Extraido de `startCombat` porque una sala que se abre tambien empieza un combate, y
 * fingir una plantilla vacia para reutilizar aquella dejaba a los recien despertados sin
 * turno: existian en el encuentro y no actuaban nunca.
 *
 * @param {import('../dnd-system.js').EnemyInstance[]} newEnemies
 * @returns {string} El orden de iniciativa, ya escrito.
 */
function beginEncounterWith(newEnemies) {
    // Idea 200: la pelea se cuenta aquí, por donde pasan todas (el botón y la ficha del
    // tablero, una sala que se abre, `/fight`). Contada solo en `startCombat`, la bodega
    // salía en el final como «0 combates: 1 ganados».
    if (!combatEncounter.active) countStat('fights');
    // Idea 25: tras dos derrotas seguidas, con la red puesta, este baja un escalón.
    if (chat_metadata && shouldSoften(chat_metadata[SAFETY_KEY], Boolean(chat_metadata[SAFETY_ON_KEY])) && !combatEncounter.active) {
        for (const enemy of newEnemies) Object.assign(enemy, softenEnemy(enemy));
        chat_metadata[SAFETY_KEY] = { streak: 0 };
        postCombatNarration(`🪢 [COMBAT] ${SOFTEN_NOTE}`);
    }
    // Antes de una pelea que puede torcer la campana, una red. Solo con los duros: un
    // punto antes de cada rata seria un cajon de sastre y tapa a los que guardas tu.
    const boss = newEnemies.find(e => (Number(e.cr) || 0) >= 2 || (Number(e.maxHp) || 0) >= 40);
    if (boss && !combatEncounter.active) {
        saveCheckpoint(`Antes de ${boss.name}`, true);
    }

    /** @type {import('../dnd-system.js').TurnEntry[]} */
    const turnEntries = [];
    // Ideas 39 y 41: la moral del grupo y quien vigila mueven la iniciativa de todos.
    const morale = partyMorale();
    const sentinel = withJob(partyMembers, 'centinela') ? 1 : 0;
    // Quien ha muerto ya no pelea (idea 36): antes seguía tirando iniciativa, y un descanso
    // lo ponía en pie otra vez.
    for (const m of partyMembers.filter(member => !member.dead)) {
        const init = rollInitiativeWithPopover(m.name, m.dexterity || 10, 'ally') + morale.value + sentinel + perkBonus(m, 'initiative');
        turnEntries.push({ id: String(m.id), name: m.name, initiative: init, isEnemy: false });
    }
    if (morale.value !== 0) postCombatNarration(`🫂 [COMBAT] Moral del grupo: ${morale.label}.`);
    // Ideas 73 y 90: la niebla, la lluvia, el viento o la noche, dichos antes del primer golpe.
    const seen = boardVisibility();
    if (seen.note) postCombatNarration(`🌫️ [COMBAT] ${seen.note}`);
    // R7: cada enemigo con su papel; sin perfil escrito, el que pide su papel. Y la banda,
    // si es banda, se organiza a la vista.
    for (const enemy of newEnemies) {
        const role = bandRoleOf(enemy, knownAbilities(enemy, getAbilityCatalogue()));
        /** @type {any} */ (enemy).role = role;
        if (!enemy.profile) /** @type {any} */ (enemy).profile = ENEMY_ROLES[role].profile;
    }
    const band = newEnemies.length > 1
        ? describeBand(newEnemies.map(e => ({ name: String(e.name), role: String(/** @type {any} */ (e).role ?? '') })), tacticOf(newEnemies[0]))
        : '';
    if (band) postCombatNarration(`🧠 [COMBAT] ${band}`);

    const enemies = [...combatEncounter.enemies, ...newEnemies];
    for (const e of enemies) {
        const init = rollInitiativeWithPopover(e.name, e.dexterity || 10, 'enemy');
        turnEntries.push({ id: e.instanceId, name: e.name, initiative: init, isEnemy: true });
    }

    // Sort descending by initiative (ties: non-enemies first)
    turnEntries.sort((a, b) => b.initiative - a.initiative || (a.isEnemy ? 1 : 0) - (b.isEnemy ? 1 : 0));

    setCombatEncounter({
        active: true,
        enemies,
        turnOrder: turnEntries,
        currentTurnIndex: 0,
        round: 1,
        turnState: null,
    });

    saveCombatState();

    // Build summary
    const summary = turnEntries.map((t, i) => `${i + 1}. ${t.name} (${t.initiative})${t.isEnemy ? ' ⚔️' : ''}`).join('\n');

    postCombatNarration(`⚔️ [COMBAT] ¡Encuentro iniciado!\n\nOrden de iniciativa:\n${summary}`);
    // J2.2: la primera pelea, con su consejo. Antes que los del turno: es lo primero que pasa.
    showTip('combat');
    const firstTurn = getCurrentTurnEntry();
    resetCombatTurnState(firstTurn);
    runCombatTurnLoop(true);

    return summary;
}

/**
 * El aviso de que esto ya es un combate.
 *
 * Abrir una puerta y que de pronto tengas turnos es el momento que mas facil se pasa por
 * alto: el registro lo decia en una linea entre otras diez. Un cartel no decide nada y no
 * se puede pulsar — por eso no roba clics —, solo hace imposible no enterarse.
 *
 * @param {string[]} names Los que acaban de entrar.
 */
function showInitiativeBanner(names) {
    $('.ib-banner').remove();

    const root = $('<div class="ib-banner"></div>');
    root.append($('<div class="ib-title"></div>').text('¡INICIATIVA!'));
    if (names.length > 0) {
        root.append($('<div class="ib-names"></div>').text(names.join(', ')));
    }
    $('body').append(root);

    // Se va sola: es un aviso, no algo que haya que cerrar.
    setTimeout(() => root.addClass('ib-out'), 2200);
    setTimeout(() => root.remove(), 3000);
}

/**
 * Lo que espera en el tablero, dicho corto: «Rata de bodega x3».
 *
 * @param {Array<{name: string}>} awake
 * @returns {string}
 */
export function waitingSummary(awake) {
    const counts = new Map();
    for (const placement of awake) {
        const name = String(placement.name);
        counts.set(name, (counts.get(name) || 0) + 1);
    }
    return [...counts.entries()].map(([name, count]) => (count > 1 ? `${name} x${count}` : name)).join(', ');
}

/**
 * Empezar la pelea con los que esperan en el tablero: el botón del tablero y la ficha.
 *
 * @param {Array<{name: string, x: number, y: number}>} awake
 */
export function startWaitingFight(awake) {
    if (combatEncounter.active) return;
    const enemies = instancesFromPlacements(awake);
    if (enemies.length === 0) {
        toastr.warning('Ninguno de los enemigos del tablero existe en el mundo.');
        return;
    }
    setCombatLogEntries([]);
    postCombatNarration(`[COMBAT] Empieza el combate del tablero: ${waitingSummary(awake)}.`);
    beginEncounterWith(enemies);
    showInitiativeBanner(enemies.map(e => e.name));
    renderLocationMapsPreview();
}

/**
 * Judges the scenario the current board carries, if it carries one.
 *
 * Most boards do not, and one without objectives has to behave exactly as it always did:
 * clear the enemies and you win. A scenario replaces that rule rather than adding to it —
 * "survive six rounds" is a victory with every enemy still standing.
 *
 * @returns {ReturnType<typeof judgeScenario>|null}
 */
export function judgeCurrentScenario() {
    if (!combatEncounter.active) return null;

    const location = getCurrentWorldLocationMaps().find(l => l.name === currentLocationName);
    const board = getLocationBoards(location).find((/** @type {any} */ b) => b.name === currentBoardName);
    if (!board || !hasScenario(board)) return null;

    return judgeScenario(board.objectives, buildBoardState({
        round: combatEncounter.round,
        enemies: combatEncounter.enemies,
        party: partyMembers,
        // Lo abierto antes de la pelea también cuenta.
        collectedTreasures: collectedHere(board),
    }));
}

/**
 * Ends the fight when the scenario says it is over.
 *
 * Called after anything that could change the answer — an attack, a move, a turn passing —
 * because "survive six rounds" is won by the clock and nothing else would notice.
 *
 * @returns {boolean} Whether the fight ended here.
 */
export function checkScenarioOutcome() {
    const verdict = judgeCurrentScenario();
    if (!verdict || !verdict.outcome) return false;

    postCombatNarration(`🎯 [COMBAT] ${verdict.summary}`);
    postCombatNarration(verdict.outcome === 'victory'
        ? '🏁 [COMBAT] Objetivos cumplidos.'
        : '🏁 [COMBAT] La misión ha fracasado.');

    // Cumplir la mision de un tablero es lo que da la localizacion por superada, y eso
    // es lo que abre las siguientes en el mapa de campana. Ganar deberia ser lo unico
    // que abre puertas.
    if (verdict.outcome === 'victory') markLocationComplete(currentLocationName);

    endCombat(verdict.outcome === 'victory' ? 'victory' : 'defeat');
    renderLocationMapsPreview();
    return true;
}

/**
 * End the current combat encounter.
 */
export function endCombat(reason = 'ended') {
    postCombatNarration('🏁 [COMBAT] El combate termina.');
    // T2: la ayuda que no llegó a entrar no espera a la pelea siguiente.
    const helpBoard = getActiveBoardContext().board;
    if (helpBoard && Array.isArray(helpBoard.waves) && helpBoard.waves.some((/** @type {any} */ w) => w?.help && !w.done)) {
        helpBoard.waves = helpBoard.waves.filter((/** @type {any} */ w) => !(w?.help && !w.done));
        persistBoardTerrain(helpBoard);
    }
    // Idea 25: la cuenta de derrotas seguidas.
    if (chat_metadata) chat_metadata[SAFETY_KEY] = noteOutcome(chat_metadata[SAFETY_KEY], reason);
    // Idea 105: si cayó a quien se escoltaba, el encargo se pierde.
    const escorted = chat_metadata?.[TAKEN_KEY] ? wardLost(partyMembers, String(chat_metadata[TAKEN_KEY].id)) : null;
    if (escorted && chat_metadata) {
        const lost = chat_metadata[TAKEN_KEY];
        delete chat_metadata[TAKEN_KEY];
        noteDeed(`Se perdió el encargo «${lost.title}»: ${escorted.name} no llegó.`);
        postCombatNarration(`💀 [GREMIO] ${escorted.name} ha caído: el encargo «${lost.title}» se pierde.`);
        dismissGuests(String(lost.id), 'perdido');
    }
    postCombatNarration(buildCombatSummary(/** @type {'victory'|'defeat'|'manual'|'ended'} */ (reason === 'fled' ? 'manual' : reason)));

    // Winning has to be worth something, or the tactical engine underneath is doing
    // careful work for nothing.
    /** @type {ReturnType<typeof awardEncounterLoot>} */
    let loot = null;
    if (reason === 'fled') countStat('fled');
    if (reason === 'victory') {
        countStat('wins');
        // R5: ganar juntos suma vínculo con la mascota; sin mascota, una bestia vencida se
        // puede domar (un aviso con botón: no para la partida).
        if (currentPet()) petLivesIt();
        else offerTaming(combatEncounter.enemies.filter(e => (e.currentHp || 0) <= 0 && !(/** @type {any} */ (e).fled)));
        // R3: quien sabe primeros auxilios levanta a quien quedó en el suelo.
        const medic = patchUpAfterFight(partyMembers);
        for (const fallenMember of medic ? partyMembers.filter(m => !m.dead && (Number(m.hp) || 0) <= 0) : []) {
            const healed = Math.max(1, Number(rollDiceDetailed(String(medic?.formula), 4).total) || 1);
            fallenMember.hp = Math.min(Number(fallenMember.maxHp) || healed, healed);
            fallenMember.deathSaves = clearDeathSaves();
            fallenMember.activeConditions = (Array.isArray(fallenMember.activeConditions) ? fallenMember.activeConditions : [])
                .filter((/** @type {string} */ c) => c !== 'Unconscious');
            postCombatNarration(`🩹 [COMBAT] ${medic?.who} venda a ${fallenMember.name}: se levanta con ${fallenMember.hp} PG.`);
        }
        loot = awardEncounterLoot(combatEncounter.enemies.filter(e => (e.currentHp || 0) <= 0 && !(/** @type {any} */ (e).fled)));
        // R7: una némesis que cae, se acaba.
        for (const fallen of combatEncounter.enemies.filter(e => /** @type {any} */ (e).nemesis && (e.currentHp || 0) <= 0 && !(/** @type {any} */ (e).fled))) {
            const done = nemesisFalls(chat_metadata?.[NEMESES_KEY], String(fallen.name));
            if (chat_metadata && done.line) {
                chat_metadata[NEMESES_KEY] = done.list;
                saveMetadata();
                postCombatNarration(`😈 [NEMESIS] ${done.line}`);
            }
        }
        if (loot?.gold) countStat('gold', loot.gold);

        // C7: alguien lo celebra.
        const cheering = partyMembers.filter(m => String(m.id) !== String(partyMembers[0]?.id) && (Number(m.hp) || 0) > 0);
        if (cheering.length > 0) bark(cheering[Math.floor(Math.random() * cheering.length)], 'victory');

        // El hilo: ganar aqui, y a quien se ha derrotado.
        for (const fallen of combatEncounter.enemies.filter(e => (e.currentHp || 0) <= 0)) {
            notePlot({ kind: 'defeat', enemy: String(fallen.name) });
        }
        notePlot({ kind: 'win', place: currentLocationName, board: currentBoardName });
        // La pelea escrita del tablero, ganada: sus enemigos no vuelven a dibujarse. Cuenta si
        // en esta pelea estaba alguno de los que el tablero trae (el botón, una sala que se
        // abre o `/fight` con su nombre); una pelea suelta no se los lleva.
        const wonBoard = getActiveBoardContext().board;
        const written = new Set((wonBoard?.enemyPlacements ?? []).map((/** @type {any} */ p) => String(p.name).toLowerCase()));
        const fought = combatEncounter.enemies.some(e => written.has(String(e.name).replace(/\s+\d+$/, '').toLowerCase()));
        if (currentBoardName && fought) recordBoardWon(currentLocationName, currentBoardName);
        // Idea 52: el sitio sabe quién le ha quitado ese peso de encima.
        raiseFame(currentLocationName);

        // Surviving a fight together is a recorded fact, which is the whole point of the
        // bond design: the engine decides it happened, the model writes about it later.
        const survivors = partyMembers.filter(m => (m.hp || 0) > 0);
        if (survivors.length > 1) {
            let bonds = getCampaignBonds();
            for (const member of survivors) {
                const together = recordBondEvent(bonds, String(member.id), 'combat_together');
                bonds = together.state;
                if (together.rankedUp) tellBondScene(member, together.rankAfter);
            }
            saveCampaignState(null, bonds);
        }
    }

    // The blow-by-blow above is posted as system messages, which SillyTavern filters out
    // of the prompt (script.js: chat.filter(x => !x.is_system)). So the model never saw
    // the fight at all. This is the one line that tells it what happened — condensed on
    // purpose, because it is also the only part of a combat that costs anything.
    //
    // It goes out through postForModel, not postCombatNarration: sending it as a system
    // message, as this did until 2026-09-21, meant the model never received it either.
    const epilogue = buildEpiloguePrompt([], {
        rounds: Number(combatEncounter.round) || 1,
        victory: reason === 'victory',
        abandoned: reason === 'manual' || reason === 'fled',
        survivors: partyMembers.filter(m => (m.hp || 0) > 0).map(m => m.name),
        defeated: combatEncounter.enemies.filter(e => (e.currentHp || 0) <= 0).map(e => e.name),
    });
    // Z1: si cuenta el motor, el final de la pelea en prosa.
    const wounded = partyMembers.filter(m => (m.hp || 0) > 0 && (m.hp || 0) <= (Number(m.maxHp) || 1) / 2).map(m => m.name);
    const fallenFoes = [...new Set(combatEncounter.enemies.filter(e => (e.currentHp || 0) <= 0).map(e => String(e.name).replace(/\s+\d+$/, '')))];
    const ending = tellMoment('fin-combate', {
        ganado: reason === 'victory' ? 'sí' : (reason === 'manual' || reason === 'fled' ? 'huida' : 'no'),
        caidos: listNames(fallenFoes),
        heridos: wounded.length === 0 ? '' : `${listNames(wounded)} ${wounded.length === 1 ? 'sale malherido' : 'salen malheridos'}.`,
        botin: listNames((loot?.items ?? []).map((/** @type {any} */ item) => String(item?.name || '')).filter(Boolean).slice(0, 3)),
    });
    postForModel(epilogue, { show: ending }).catch(error => console.error('[party] could not post the combat epilogue', error));

    // Idea 191: ganar se celebra, con la cuenta delante.
    if (reason === 'victory') {
        const report = buildVictoryReport({
            tally: combatEncounter.tally,
            party: partyMembers,
            rounds: Number(combatEncounter.round) || 1,
            loot,
            defeated: combatEncounter.enemies.filter(e => (e.currentHp || 0) <= 0).length,
        });
        // Idea 63: lo nuevo, frente a lo que ya lleva quien mas lo aprovecha.
        report.upgrades = (loot?.items ?? []).map(item => bestFor(item, partyMembers)).filter(Boolean);
        showVictoryScreen(report);
        // Idea 34: lo que se recuerda de este combate.
        const where = currentBoardName || currentLocationName;
        for (const row of report.rows.filter(r => r.downed)) {
            rememberTogether(`${row.name} cayó en ${where} y se levantó.`, [row.name]);
        }
        // Idea 7: quien se rindio se queda con el grupo, hasta que se decida que hacer.
        const surrendered = combatEncounter.enemies.filter(e => e.surrendered).map(e => String(e.name));
        if (surrendered.length > 0 && chat_metadata) {
            chat_metadata[PRISONERS_KEY] = takePrisoners(chat_metadata[PRISONERS_KEY], surrendered, {
                day: Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1)), place: where,
            });
            saveMetadata();
            postCombatNarration(`⛓️ [COMBAT] Prisioneros: ${surrendered.join(', ')}. Se puede interrogarlos, entregarlos o soltarlos.`);
            showTip('prisoners');
        }
        // Idea 77: si el tablero tiene puertas con llave, el que mandaba la llevaba encima.
        dropBoardKey();
    }

    setCombatEncounter(createEmptyCombatEncounter());
    setCombatBoardSelection({ tokenId: null, boardName: '', locationName: '' });
    saveCombatState();
    restoreChatPlaceholder();
}

/**
 * La pantalla de victoria: quien hizo que, que os lleváis y quien cayo por el camino.
 *
 * No tapa la partida: es una tarjeta que se cierra sola o al pulsarla, porque detras
 * sigue el epilogo del narrador, que es lo que importa leer.
 *
 * @param {import('../game-engine/combat/tally.js').VictoryReport} report
 */
function showVictoryScreen(report) {
    $('.vs-card').remove();
    const card = $('<div class="vs-card" role="status"></div>');
    card.append($('<div class="vs-title"></div>').text(`🏆 ${report.title}`));
    const table = $('<div class="vs-rows"></div>');
    for (const row of report.rows) {
        const line = $('<div class="vs-row"></div>').toggleClass('vs-best', row.best);
        line.append($('<span class="vs-name"></span>').text(`${row.best ? '⭐ ' : ''}${row.name}`));
        line.append($('<span class="vs-num"></span>').text(`${row.dealt} hecho`));
        line.append($('<span class="vs-num"></span>').text(`${row.kills} ${row.kills === 1 ? 'tumbado' : 'tumbados'}`));
        line.append($('<span class="vs-num"></span>').text(`${row.taken} recibido`));
        table.append(line);
    }
    card.append(table);
    if (report.best) card.append($('<div class="vs-line"></div>').text(report.best));
    card.append($('<div class="vs-line vs-loot"></div>').text(`Os lleváis: ${report.loot}`));
    for (const scar of report.scars) card.append($('<div class="vs-line vs-scar"></div>').text(scar));
    for (const upgrade of report.upgrades ?? []) card.append($('<div class="vs-line vs-upgrade"></div>').text(`⬆️ ${upgrade}`));
    card.append($('<div class="vs-hint"></div>').text('Pulsa para cerrar'));
    card.on('click', () => card.remove());
    $('body').append(card);
    setTimeout(() => card.remove(), 20000);
}

/**
 * T2: el bando pide tregua. Un aviso con sus dos botones; también `/tregua sí|no`.
 */
export function offerTruce() {
    /** @type {any} */ (combatEncounter).truce = 'pending';
    // Todavía no le ha tocado a nadie del grupo desde que la piden (ver `advanceTurnIndex`).
    /** @type {any} */ (combatEncounter).truceSeen = false;
    saveCombatState();
    postCombatNarration(truceLine(getAliveEnemies().map(e => String(e.name))));
    const toast = toastr.info('Aceptarla gana el tablero, pero los que se van no dejan botín. Los tuyos lo juzgarán, la aceptes o no.', '🏳️ Piden tregua', { timeOut: 20000 });
    const buttons = $('<div style="margin-top:6px; display:flex; gap:6px;"></div>');
    buttons.append($('<button class="menu_button truce-yes"></button>').text('Dejarles ir').on('click', () => { answerTruce(true); }));
    buttons.append($('<button class="menu_button truce-no"></button>').text('Sin cuartel').on('click', () => { answerTruce(false); }));
    $(toast).find('.toast-message').append(buttons);
}

/**
 * T2: la respuesta a la tregua.
 *
 * @param {boolean} accept
 * @returns {string}
 */
export function answerTruce(accept) {
    if (!combatEncounter.active || /** @type {any} */ (combatEncounter).truce !== 'pending') {
        toastr.info('Nadie está pidiendo tregua ahora.', 'La tregua');
        return '';
    }
    if (!accept) {
        /** @type {any} */ (combatEncounter).truce = 'refused';
        saveCombatState();
        postCombatNarration('⚔️ [COMBAT] Sin cuartel: vuelven a levantar las armas.');
        judgeDecision('sin-cuartel');
        return '';
    }
    /** @type {any} */ (combatEncounter).truce = 'accepted';
    const leaving = getAliveEnemies();
    for (const enemy of leaving) {
        enemy.currentHp = 0;
        /** @type {any} */ (enemy).fled = true;
    }
    saveCombatState();
    postCombatNarration(`🤝 [COMBAT] Tregua: ${leaving.map(e => e.name).join(', ')} se van. El tablero es vuestro.`);
    noteDeed(`Dejasteis ir a los que pidieron tregua en ${currentBoardName || currentLocationName || 'un combate'}.`);
    judgeDecision('tregua');
    endCombat('victory');
    renderLocationMapsPreview();
    return '';
}

/**
 * B2: quien está en una salida puede irse de la pelea. Un aviso con su botón.
 *
 * @param {any} member
 * @param {number} x
 * @param {number} y
 */
export function offerExit(member, x, y) {
    if (!combatEncounter.active || (Number(member?.hp) || 0) <= 0) return;
    if (!isExit(getActiveBoardContext().terrain, x, y)) return;
    const toast = toastr.info(`${member.name} está en una salida. Salir le saca de esta pelea: nadie le ataca y ya no actúa. Cuando salgáis todos, se acaba en huida.`, '🚪 Una salida', { timeOut: 12000 });
    $(toast).find('.toast-message').append($('<button class="menu_button exit-leave" style="margin-top:6px;"></button>').text('Salir por aquí').on('click', () => { leaveThroughExit(member); }));
}

/**
 * B2: salir por una salida. Quien sale deja de estar en la pelea; cuando han salido todos los
 * que siguen en pie, se acaba en huida, sin los golpes de la retirada (el camino ya se pagó).
 *
 * @param {any} member
 * @returns {string}
 */
export function leaveThroughExit(member) {
    if (!combatEncounter.active || !member) return '';
    const cell = partyCell(member);
    if (!isExit(getActiveBoardContext().terrain, cell.x, cell.y)) {
        toastr.info(`${member.name} no está en una salida: primero hay que llegar a ella.`, 'Salir');
        return '';
    }
    if ((Number(member.hp) || 0) <= 0 || hasLeft(combatEncounter.left, member.id)) return '';
    const wasTurn = String(getPartyMemberByTurnEntry(getCurrentTurnEntry())?.id ?? '') === String(member.id);
    combatEncounter.left = leaveBoard(combatEncounter.left, member.id);
    postCombatNarration(leaveLine(member.name, stillFighting(partyMembers, combatEncounter.left).length));
    saveCombatState();
    if (everyoneOut(partyMembers.filter(m => !m.dead), combatEncounter.left)) {
        finishEscape('Todos fuera.');
        return '';
    }
    renderPartyMembers();
    renderLocationMapsPreview();
    // Si le tocaba a él, su turno se acaba aquí.
    if (wasTurn) endPlayerCombatTurn();
    return '';
}

/**
 * B2: la pelea acaba en huida por las salidas. Se deja el tablero sin ganar, se sabe y se juzga,
 * como la retirada de siempre.
 *
 * @param {string} said
 */
function finishEscape(said) {
    postCombatNarration(`🏃 [COMBAT] ${said} Os vais de ${currentBoardName || 'aquí'} sin ganar el tablero.`);
    noteDeed(`Salisteis por pies de ${currentBoardName || currentLocationName || 'un combate'}.`);
    savePartyState();
    renderPartyMembers();
    endCombat('fled');
    renderLocationMapsPreview();
    judgeDecision('retirada');
}

/**
 * Idea 22: huir, con su precio dicho antes.
 *
 * @returns {Promise<void>}
 */
export async function retreatFromCombat() {
    if (!combatEncounter.active) return;
    const cell = (/** @type {any} */ pos) => ({ x: Number(pos?.gridX) || 0, y: Number(pos?.gridY) || 0 });
    const plan = planRetreat({
        party: partyMembers.map(m => ({ id: m.id, name: m.name, ...cell(m.mapPosition), hp: Number(m.hp) || 0 })),
        enemies: getAliveEnemies().map(e => ({ id: e.instanceId, name: e.name, ...cell(e), hp: Number(e.currentHp) || 0 })),
        disengaged: readManeuvers(combatEncounter.maneuvers).disengaged,
        distanceFeet: getDistanceInFeet,
    });
    const go = await Popup.show.confirm('¿Huir del combate?', plan.summary);
    if (!go || !combatEncounter.active) return;

    const lines = ['🏃 [COMBAT] El grupo se retira.'];
    for (const blow of plan.blows) {
        const enemy = getEnemyByInstanceId(blow.enemyId);
        const member = partyMembers.find(m => String(m.id) === blow.memberId);
        if (enemy && member && (Number(enemy.currentHp) || 0) > 0) {
            lines.push(`↩️ ${enemy.name} aprovecha que ${member.name} se da la vuelta.`);
            lines.push(resolveEnemyAttackOn(enemy, member));
        }
    }
    postCombatNarration(lines.filter(Boolean).join('\n'));
    noteDeed(`Huisteis de ${currentBoardName || currentLocationName || 'un combate'}.`);
    savePartyState();
    renderPartyMembers();
    endCombat('fled');
    renderLocationMapsPreview();
    // Idea 28: huir también se juzga.
    judgeDecision('retirada');
}
