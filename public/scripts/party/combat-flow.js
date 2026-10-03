/**
 * Cómo va una pelea de principio a fin: empezarla, la iniciativa, los turnos y las rondas, los
 * que se mueven solos, las salvaciones de muerte, los objetivos del tablero, la tregua, la
 * huida y el final con su pantalla de victoria.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import { Popup, POPUP_TYPE } from '../popup.js';
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
import { isPassable, getCell } from '../game-engine/board/terrain.js';
import { treasureInChest } from '../game-engine/campaign/scenarios.js';
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
    adjustForSize, adjustmentNotes, WRITTEN_PARTY_SIZE,
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
import { afterFightStep, whereItAsks } from '../game-engine/combat/after-fight.js';
import { fallenCard, partyHasFallen } from '../game-engine/combat/party-fallen.js';
import { normalizeCheckpoints, CHECKPOINT_KEY } from '../game-engine/campaign/checkpoint.js';
import { boardLeftovers } from '../game-engine/board/leftovers.js';
import { fogOnFor } from '../game-engine/board/board-camera.js';
import { focusOf } from '../game-engine/campaign/plot.js';
import { continueScene } from '../game-engine/ui/shell/scene-director.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import { planRetreat } from '../game-engine/combat/retreat.js';
import { advanceTurn } from '../game-engine/combat/turn-machine.js';
import { applyInjury, describeInjuries } from '../game-engine/rules/injuries.js';
import { resolveFall } from '../game-engine/rules/mortality.js';
import { isIronRun, modeOf, modeLabel } from '../game-engine/rules/modes.js';
import { epitaphFor, heirloomOf, heirOf, addGrave, addToHall } from '../game-engine/campaign/legacy.js';
import { listNames } from '../game-engine/campaign/engine-narrator.js';
import { countedName } from '../game-engine/campaign/narration-notes.js';
import { gendered, groupGender } from '../game-engine/campaign/grammar.js';
import { withJob, whoMourns } from '../game-engine/campaign/company.js';
import { takePrisoners } from '../game-engine/campaign/prisoners.js';
import { boxExamples } from '../game-engine/campaign/read-box.js';
import { readReasons } from '../game-engine/rules/companions.js';
import { planSpawnCells } from '../game-engine/combat/spawn.js';
import { enemiesInRoom, awakePlacements } from '../game-engine/campaign/campaign-map.js';
import { buildBoardState, judgeScenario, hasScenario, leftToDo, objectivesLeftWalking, walkingObjectiveStatus } from '../game-engine/combat/scenario-board.js';
import { needsStabilizing, bestTender, tendFallen, stableSaves } from '../game-engine/rules/stabilize.js';
import { skillModifier } from '../game-engine/rules/checks.js';
import { recordBondEvent, getBondProgress } from '../game-engine/campaign/bonds.js';
import { buildEpiloguePrompt } from '../game-engine/ui/combat-log.js';
import { getActiveRuleset } from '../game-engine/rules/ruleset.js';
import { knownAbilities } from '../game-engine/rules/abilities.js';
import { isDying, rollDeathSave, clearDeathSaves } from '../game-engine/rules/death-saves.js';
import {
    GRAVES_KEY, LEVEL_SAID_KEY, MODE_HISTORY_KEY, NEMESES_KEY, PLOT_STATE_KEY, PRISONERS_KEY, SAFETY_KEY, SAFETY_ON_KEY, TAKEN_KEY,
    OBJECTIVE_LEFT_KEY,
} from './keys.js';
import {
    combatEncounter, currentBoardName, currentLocationName, partyMembers, setCombatBoardSelection,
    setCombatEncounter, setCombatLogEntries, setCurrentBoardName, setUsedReactions,
} from './state.js';
import { saveCheckpoint, restoreCheckpoint } from './checkpoints.js';
import { currentPet, offerTaming, petLivesIt } from './pet.js';
import { expireTimedConditions, getAbilityCatalogue } from './magic.js';
import { dismissGuests } from './contracts.js';
import {
    actsOnItsOwn, getAliveEnemies, getAttackableEnemiesForMember, getCurrentTurnEntry, getEnemyByInstanceId,
    getLivingPartyMembers, getPartyMemberByTurnEntry, getRemainingMovementFeet, partyCell, resetCombatTurnState,
    saveCombatState,
} from './combat-state.js';
import {
    turnStartMagic, turnEndMagic, roundMagic, endOfFightMagic, livingSummons, canChooseControl, controlOf, setControl,
    CONTROL_LABELS,
} from './spell-turn.js';
import { showCombatDiceRoll } from './combat-log.js';
import { afterFx, stageTurn } from './combat-fx.js';
import { resolveEnemyAttackOn, resolveEnemyTurnAction } from './enemy-turn.js';
import { allyBeforeTurn2024, allyInstead2024, allyAfterAttack2024, allyRescue2024 } from './ally-turn-2024.js';
import {
    handlePlayerCombatMove, performManeuver, handlePlayerCombatAttack, endPlayerCombatTurn,
} from './player-actions.js';
import { collectedHere, awardEncounterLoot, dropBoardKey, openChest } from './loot.js';
import {
    persistBoardTerrain, getActiveBoardContext, explodeBarrels, recordBoardWon, boardVisibility, isBoardWon,
} from './board.js';
import { renderLocationMapsPreview } from './board-view.js';
import { beginAmbushPlacement } from './fight-entry.js';
import { lastLevelPlan, getLocationBoards, hereLocation, lastCompendium, saveCurrentBoard, lastHub, lastHubHome } from './world.js';
import { getCampaignCalendar, getCampaignBonds, saveCampaignState, markLocationComplete } from './time.js';
import { notePlot, getPlot, scenesPending } from './plot.js';
import { noteDeed } from './world-growth.js';
import { currentSurvival, survivalNow } from './modes.js';
import { postCombatNarration, tellMoment, postForModel, showTip } from './narration.js';
import { savePartyState, renderPartyMembers } from './roster.js';
import {
    tellBondScene, rememberTogether, bark, judgeDecision, partyMorale, getPartyFormation, questAfterFight,
} from './companions.js';
import { healerFirst } from '../game-engine/campaign/formation.js';
import { afterFight } from './social.js';
import { raiseFame } from './town.js';
import { countStat } from './menus.js';
import { brawlOf } from '../game-engine/combat/brawl.js';
import { brawlTalk, endBrawl } from './brawl.js';

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
 * @param {string} [said] J8.5: el resultado dicho de otra forma («os habéis rendido»).
 * @returns {string}
 */
function buildCombatSummary(reason, said = '') {
    const enemyTotal = combatEncounter.enemies.length;
    const enemyAlive = combatEncounter.enemies.filter(enemy => (enemy.currentHp || 0) > 0).length;
    const enemyDefeated = Math.max(0, enemyTotal - enemyAlive);

    const partyTotal = partyMembers.length;
    const partyAlive = partyMembers.filter(member => (member.hp || 0) > 0).length;

    let outcome = 'Resultado: combate finalizado.';
    if (reason === 'victory') outcome = 'Resultado: victoria del grupo.';
    if (reason === 'defeat') outcome = 'Resultado: derrota del grupo.';
    if (reason === 'manual') outcome = 'Resultado: combate terminado manualmente.';
    if (said) outcome = `Resultado: ${said}`;

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
    // Tanda 17: en la secuencia del combate, de quién es el turno en su sitio (tras lo de antes).
    stageTurn(entry, entry.isEnemy ? 'enemy' : actsOnItsOwn(entry) ? 'ally' : 'you');
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
        // Tanda 17: el dado en la secuencia del combate, tras lo que le tumbó.
        stage: { hit: Number(result.natural) >= 10, against: 'CD', side: 'you' },
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

/** La partida en la que ya se dijo que había caído todo el grupo: no se repite sola. */
let fallenToldFor = null;

/**
 * J9.1: todo el grupo ha muerto. Se dice claro, con las salidas: volver al último punto
 * guardado en el que alguien seguía vivo o volver al gremio (la campaña se queda donde está).
 * Sin esto la partida seguía con los muertos andando, y la pelea siguiente se quedaba en el
 * turno de los enemigos para siempre.
 *
 * @param {{again?: boolean}} [options] again: decirlo aunque ya se dijera (al intentar pelear).
 * @returns {Promise<void>}
 */
export async function sayPartyFallen({ again = false } = {}) {
    if (!chat_metadata || !partyHasFallen(partyMembers)) return;
    if (fallenToldFor === chat_metadata && !again) return;
    fallenToldFor = chat_metadata;
    const card = fallenCard({
        party: partyMembers,
        place: currentBoardName || currentLocationName,
        checkpoints: normalizeCheckpoints(chat_metadata[CHECKPOINT_KEY]),
        home: Boolean(lastHubHome),
        // H7 de las vueltas: la partida de cada mañana («Nuevo día. Partida guardada»). Con una
        // sola vida no hay vuelta atrás.
        saves: !isIronRun(survivalNow(), chat_metadata?.[MODE_HISTORY_KEY] ?? null),
    });
    const body = $('<div class="st-root end-root gs-panel pf-root"></div>');
    body.append($('<h3 class="gs-popup-title"></h3>').text(card.title));
    body.append($('<p class="end-scene pf-text"></p>').text(card.text));
    if (card.ways) body.append($('<p class="pf-ways"></p>').text(card.ways));
    const BACK = 81;
    const HOME = 82;
    const LOAD = 83;
    /** @type {Array<{text: string, result: number, classes: string[], icon: string}>} */
    const buttons = [];
    if (card.checkpoint) buttons.push({ text: 'Volver al punto guardado', result: BACK, classes: ['pf-back'], icon: 'fa-clock-rotate-left' });
    if (card.saves) buttons.push({ text: 'Cargar partida', result: LOAD, classes: ['pf-load'], icon: 'fa-floppy-disk' });
    if (card.home) buttons.push({ text: 'Volver al gremio', result: HOME, classes: ['pf-home'], icon: 'fa-house-flag' });
    const choice = await new Popup(body[0], POPUP_TYPE.TEXT, '', {
        okButton: 'Cerrar', leftAlign: true, allowVerticalScrolling: true, customButtons: buttons,
    }).show();
    if (choice === BACK && card.checkpoint) {
        await restoreCheckpoint(String(card.checkpoint.id));
        return;
    }
    if (choice === LOAD) {
        const { openSaveGame } = await import('../guardar-partida.js');
        await openSaveGame();
        return;
    }
    if (choice === HOME && !combatEncounter.active) {
        const { returnToHub } = await import('../campaigns.js');
        await returnToHub();
    }
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
        // J9.1: fuera de una pelea (el hambre, el frío), si era el último, se dice ya. En una
        // pelea lo dice la derrota.
        if (!combatEncounter.active) void sayPartyFallen();
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

/**
 * J19: contar lo que ha hecho la magia al cambiar de turno o de ronda (una zona que quema, una
 * concentración que se pierde, una invocación que se va) y mirar si con eso se ha acabado la
 * pelea: una zona también tumba al último enemigo, o al último de los tuyos.
 *
 * @param {string[]} lines
 * @returns {boolean} Si la pelea se ha acabado aquí.
 */
function tellMagic(lines) {
    if (lines.length === 0) return false;
    postCombatNarration(`[COMBAT] ${lines.join('\n')}`);
    savePartyState();
    saveCombatState();
    renderPartyMembers();
    if (!combatEncounter.active || checkScenarioOutcome()) return true;
    if (getAliveEnemies().length === 0 && !judgeCurrentScenario()) {
        postCombatNarration('🏆 [COMBAT] Todos los enemigos han sido derrotados.');
        endCombat('victory');
        return true;
    }
    if (getLivingPartyMembers().length === 0) {
        if (everyoneOut(partyMembers.filter(m => !m.dead), combatEncounter.left)) {
            finishEscape('Los que quedaban dentro han caído; los que salieron, se salvan.');
            return true;
        }
        postCombatNarration('💀 [COMBAT] Todos los miembros del grupo han caido. Fin del combate.');
        endCombat('defeat');
        void sayPartyFallen();
        return true;
    }
    return false;
}

/**
 * @param {number} [depth] Cuántos turnos se han saltado ya porque la zona tumbó a quien empezaba.
 */
function advanceTurnIndex(depth = 0) {
    if (!combatEncounter.active || combatEncounter.turnOrder.length === 0) return null;

    // T2: si acaba el turno de alguien del grupo con una tregua pedida, ya la ha visto: sin
    // respuesta, el siguiente enemigo la da por rechazada.
    const ending = getCurrentTurnEntry();
    if (ending && !ending.isEnemy && /** @type {any} */ (combatEncounter).truce === 'pending') {
        /** @type {any} */ (combatEncounter).truceSeen = true;
    }
    // J19.6: al acabar su turno, lo que le hacen las zonas en las que se queda (la esfera
    // llameante quema al final del turno de quien está dentro).
    if (ending && tellMagic(turnEndMagic(ending))) return null;

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
        // J19: y lo que caduca con la ronda: las zonas, las invocaciones y las concentraciones
        // que han llegado a su fin (y lo que dependía de ellas).
        if (tellMagic(roundMagic())) return null;

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

    // J19.4, J19.6 y J19.7: al empezar su turno se le baja el Escudo, le saltan las zonas en
    // las que está, y quien se concentraba y ha caído, está incapacitado o recibió un golpe
    // (los enemigos) aguanta o lo pierde.
    const startingNow = getCurrentTurnEntry();
    if (startingNow && tellMagic(turnStartMagic(startingNow))) return null;
    // Si la zona le ha tumbado al empezar, su turno pasa al siguiente.
    if (startingNow && !canTurnEntryAct(startingNow) && depth < combatEncounter.turnOrder.length) {
        return advanceTurnIndex(depth + 1);
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
 * M4: el cofre que guarda el tesoro que pide el tablero, si aún no se ha sacado: el más
 * cercano, y la casilla libre a su lado por la que se llega antes. `at`: ya está al lado.
 *
 * @param {any} member
 * @returns {{x: number, y: number, at: boolean, beside: {x: number, y: number}|null}|null}
 */
function chestToOpen(member) {
    const { board, terrain, gridWidth, gridHeight } = getActiveBoardContext();
    if (!board || !treasureInChest(board.objectives, collectedHere(board))) return null;
    const from = { x: Number(member.mapPosition?.gridX) || 0, y: Number(member.mapPosition?.gridY) || 0 };
    const taken = new Set(partyMembers.filter(m => Number(m.id) !== Number(member.id) && (Number(m.hp) || 0) > 0)
        .map(m => `${Number(m.mapPosition?.gridX) || 0},${Number(m.mapPosition?.gridY) || 0}`));
    /** @type {{x: number, y: number, at: boolean, beside: {x: number, y: number}|null, steps: number}|null} */
    let best = null;
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            if (getCell(terrain, x, y).type !== 'chest') continue;
            if (Math.max(Math.abs(x - from.x), Math.abs(y - from.y)) <= 1) return { x, y, at: true, beside: null };
            for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
                const nx = x + dx;
                const ny = y + dy;
                if (!isPassable(terrain, nx, ny, gridWidth, gridHeight) || taken.has(`${nx},${ny}`)) continue;
                const path = findPath(terrain, from.x, from.y, nx, ny, gridWidth, gridHeight, { occupied: taken });
                if (path && (!best || path.length < best.steps)) best = { x, y, at: false, beside: { x: nx, y: ny }, steps: path.length };
            }
        }
    }
    return best;
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

/**
 * El turno de un companero que se lleva solo.
 *
 * Decide con **su propia maquina** (`ally-ai.js`), no con la de los enemigos: una IA que
 * vale para un goblin no vale para alguien a quien le tienes carino. Sigue la postura que
 * le has puesto en su ficha, no sale del alcance de nadie andando y se retira malherido.
 * Lo que decide lo aplica **por los mismos caminos que usarias tu**: mover cuesta pies,
 * atacar gasta la accion y tira contra la misma CA.
 *
 * @param {any} entry
 * @returns {string}
 */
export function resolveAllyTurnAction(entry) {
    // J19.5: también la invocación que va sola (o que le has dejado al juego, J7.3).
    const member = getPartyMemberByTurnEntry(entry);
    if (!member) return '';
    const out = cannotAct(member.activeConditions);
    if (out && (Number(member.hp) || 0) > 0) return `💤 [COMBAT] ${member.name} no puede actuar (${CONDITION_WORDS[out] ?? out}): pierde el turno.`;

    const living = combatEncounter.enemies.filter((/** @type {any} */ e) => (Number(e.currentHp) || 0) > 0);
    if (living.length === 0) {
        // Sin nadie en pie, queda lo que pide el tablero: llegar a una casilla, o llevar a
        // quien se escolta. Antes se quedaba quieto y la pelea no se acababa nunca.
        const goal = objectiveCellFor(member);
        if (goal) return walkTowardObjective(member, goal);
        // M4: y si lo que falta es un tesoro, está en un cofre: ir a su lado y abrirlo.
        const chest = chestToOpen(member);
        if (chest?.at) {
            openChest(getActiveBoardContext().board, chest.x, chest.y);
            return `[COMBAT] ${member.name} abre el cofre que buscabais.`;
        }
        if (chest?.beside) return walkTowardObjective(member, chest.beside);
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
    // Una invocación se queda al lado de quien la llamó; los demás, al tuyo.
    const caster = member.summon ? partyMembers.find(m => String(m.id) === String(member.casterId)) : null;
    const yours = caster ?? partyMembers[0];
    const leader = yours && String(yours.id) !== String(member.id) && (Number(yours.hp) || 0) > 0
        ? cellOf(yours) : null;

    // Tanda 12: malherido y con una poción, se la bebe antes de decidir (acción adicional).
    allyBeforeTurn2024(member);
    // Tanda 16: si uno de los suyos se desangra y es bastante seguro, va a su lado y le atiende.
    if (allyRescue2024(member)) return '';

    const plan = planAllyTurn({
        actor: {
            id: String(member.id),
            name: String(member.name),
            ...cellOf(member),
            currentHp: Number(member.hp) || 0,
            maxHp: Number(member.maxHp) || 1,
            // J19: con lo que le han echado encima (Acelerado, Ralentizado…). Tanda 12: lo que le
            // queda, que levantarse del suelo ya le ha costado la mitad; con todo, el paso no le llegaba.
            speedFeet: getRemainingMovementFeet(member),
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
        allies: [...partyMembers, ...livingSummons()]
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

    // Tanda 12: lo de 2024 que le sale mejor que el golpe (dar una poción, empujar al vacío,
    // ayudar, ocultarse), con las funciones de la barra (`ally-turn-2024.js`).
    if (allyInstead2024(member, plan)) return lines.join('\n');

    // Lo que no pega (un familiar), no pega: se queda al lado de quien lo llamó.
    if (plan.action === 'attack' && plan.targetId != null && !(member.summon && member.attacks === false)) {
        const target = living.find((/** @type {any} */ e) => String(e.instanceId) === String(plan.targetId));
        if (target) handlePlayerCombatAttack(String(target.name));
        // Tanda 12: con un arma ligera en cada mano, también la otra.
        if (target) allyAfterAttack2024(member, target);
    }

    return lines.join('\n');
}

/**
 * J7.3 y D-J32: quién mueve a alguien en combate, «Lo muevo yo» o «Que lo lleve el juego».
 * Un compañero, desde el vínculo de amigo (5), en los dos modos de campaña; una invocación, si
 * puedes llevar a quien la llamó. Vale también a mitad de pelea: si le toca ahora y se lo
 * devuelves al juego, juega su turno solo en ese momento.
 *
 * @param {any} member Del grupo, o una invocación.
 * @param {'player'|'engine'} control
 * @returns {boolean} Si ha cambiado.
 */
export function chooseControl(member, control) {
    if (!member || !canChooseControl(member)) return false;
    if (controlOf(member) === control) return false;
    if (!setControl(member, control)) return false;
    savePartyState();
    if (combatEncounter.active) saveCombatState();
    const label = CONTROL_LABELS[control];
    toastr.info(control === 'player' ? `${member.name}: lo mueves tú en combate.` : `${member.name}: lo lleva el juego en combate.`, label);
    const entry = getCurrentTurnEntry();
    if (combatEncounter.active && entry && !entry.isEnemy && String(entry.id) === String(member.id) && control === 'engine') {
        setCombatBoardSelection({ tokenId: null, boardName: '', locationName: '' });
        runCombatTurnLoop(true);
    }
    renderPartyMembers();
    renderLocationMapsPreview();
    return true;
}

/**
 * `chooseControl` por el id de ficha: del grupo o una invocación en pie.
 *
 * @param {string|number} id
 * @param {'player'|'engine'} control
 * @returns {boolean}
 */
export function chooseControlOf(id, control) {
    const member = partyMembers.find(m => String(m.id) === String(id))
        ?? (combatEncounter.active ? livingSummons().find(s => String(s.id) === String(id)) : null);
    return member ? chooseControl(member, control) : false;
}

/**
 * Quién se puede elegir que lo muevas tú o el juego ahora mismo: los compañeros que ya son
 * amigos y las invocaciones en pie que se dejan llevar. Con su lado de ahora.
 *
 * @returns {Array<{id: string, name: string, summon: boolean, control: 'player'|'engine'}>}
 */
export function controlChoices() {
    const people = partyMembers.slice(1).filter(m => !m.dead);
    const summons = combatEncounter.active ? livingSummons() : [];
    return [...people, ...summons]
        .filter(m => canChooseControl(m))
        .map(m => ({ id: String(m.id), name: String(m.name), summon: Boolean(m.summon), control: controlOf(m) }));
}

export function runCombatTurnLoop(includeCurrent = true) {
    if (!combatEncounter.active || combatEncounter.turnOrder.length === 0) return null;
    // J9.1: sin nadie del grupo en pie no hay turno que esperar: se pierde, y no se queda
    // la pelea en el turno de los enemigos para siempre.
    if (getLivingPartyMembers().length === 0) {
        if (everyoneOut(partyMembers.filter(m => !m.dead), combatEncounter.left)) {
            finishEscape('Los que quedaban dentro han caído; los que salieron, se salvan.');
            return null;
        }
        postCombatNarration('💀 [COMBAT] No queda nadie del grupo en pie. Fin del combate.');
        endCombat('defeat');
        void sayPartyFallen();
        return null;
    }

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
            void sayPartyFallen();
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
            // Idea 24: el jefe que marca el bestiario del paquete (o la casilla del tablero) lo
            // es también aquí; antes solo lo era si se llamaba con `/fight`, y un tablero escrito
            // perdía sus fases de jefe y su contestar una vez por ronda.
            boss: Boolean(/** @type {any} */ (placement).boss || /** @type {any} */ (template).boss),
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
            // J19.12: la bruja que lanza conjuros de verdad, con sus espacios (`enemy-spells.js`).
            ...(/** @type {any} */ (template).spellcasting ? { spellcasting: /** @type {any} */ (template).spellcasting } : {}),
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
    // J12.6: también cuando el nivel cuadra pero el grupo no es de los que pide el tablero.
    return adjustment.steps === 0 && size === WRITTEN_PARTY_SIZE ? null : { adjustment, band, level, size };
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
    if (level.adjustment.steps !== 0 && chat_metadata && chat_metadata[LEVEL_SAID_KEY] !== side) {
        chat_metadata[LEVEL_SAID_KEY] = side;
        const note = levelNote(level);
        postCombatNarration(`⚖️ [COMBAT] ${note}`);
        toastr.info(note, 'El nivel de la campaña', { timeOut: 9000 });
    }
    // J12.6: y por cuántos sois: el tablero está escrito para cuatro, como en D&D (D-J56). Lo de más o de menos se
    // dice una vez, con lo que queda al final (`adjustmentNotes`).
    const sized = adjustForSize({
        placements: result.placements, partySize: level.size, partyLevel: level.level, bestiary: templates,
        terrain, gridWidth, gridHeight,
        taken: [
            ...partyMembers.map(m => ({ x: Number(m.mapPosition?.gridX) || 0, y: Number(m.mapPosition?.gridY) || 0 })),
            ...(Array.isArray(board?.enemyPlacements) ? board.enemyPlacements : []),
        ],
    });
    for (const note of adjustmentNotes({ level: result, size: sized, partySize: level.size })) postCombatNarration(`⚖️ [COMBAT] ${note}`);
    return sized.placements;
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
    // Tanda 10: sin pelea en marcha es una emboscada: antes de la iniciativa, el grupo se coloca
    // alrededor de donde está (`fight-entry.js`), sin decisión previa.
    if (!combatEncounter.active && beginAmbushPlacement(placements)) return placements.length;

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
            // J19.12: sus conjuros, si los lanza.
            ...(/** @type {any} */ (template).spellcasting ? { spellcasting: /** @type {any} */ (template).spellcasting } : {}),
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
 * @param {{enemiesFirst?: boolean, brawl?: import('../game-engine/combat/brawl.js').Brawl|null}} [options] J12.2: os han
 *   pillado huyendo o escondidos, y empiezan ellos, tire lo que tire cada uno. J12.7: `brawl`, la
 *   bandera de una pelea sin muertes, puesta antes del primer golpe; quien mira un duelo no tira
 *   iniciativa y va como «fuera» (nadie le pega).
 * @returns {string} El orden de iniciativa, ya escrito.
 */
function beginEncounterWith(newEnemies, { enemiesFirst = false, brawl = null } = {}) {
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
    if (boss && !combatEncounter.active && !brawl) {
        saveCheckpoint(`Antes de ${boss.name}`, true);
    }

    /** @type {import('../dnd-system.js').TurnEntry[]} */
    const turnEntries = [];
    // Ideas 39 y 41: la moral del grupo y quien vigila mueven la iniciativa de todos.
    const morale = partyMorale();
    const sentinel = withJob(partyMembers, 'centinela') ? 1 : 0;
    // Quien ha muerto ya no pelea (idea 36): antes seguía tirando iniciativa, y un descanso
    // lo ponía en pie otra vez.
    for (const m of partyMembers.filter(member => !member.dead && !brawl?.watching.includes(String(member.id)))) {
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
    // J12.2: si os han pillado, ellos primero; entre ellos y entre los vuestros, por iniciativa.
    if (enemiesFirst) {
        turnEntries.sort((a, b) => (b.isEnemy ? 1 : 0) - (a.isEnemy ? 1 : 0) || b.initiative - a.initiative);
        postCombatNarration('⚠️ [COMBAT] Os han pillado: ellos atacan primero.');
    }

    setCombatEncounter({
        active: true,
        enemies,
        turnOrder: turnEntries,
        currentTurnIndex: 0,
        round: 1,
        turnState: null,
        // J12.7: la pelea sin muertes, sin treguas que pedir; y quien mira un duelo, fuera.
        ...(brawl ? { brawl, left: [...brawl.watching], truce: 'refused' } : {}),
    });

    saveCombatState();

    // Build summary
    const summary = turnEntries.map((t, i) => `${i + 1}. ${t.name} (${t.initiative})${t.isEnemy ? ' ⚔️' : ''}`).join('\n');

    postCombatNarration(`⚔️ [COMBAT] ¡Encuentro iniciado!\n\nOrden de iniciativa:\n${summary}`);
    // J2.2: la primera pelea, con su consejo. Antes que los del turno: es lo primero que pasa.
    showTip('combat');
    const firstTurn = getCurrentTurnEntry();
    resetCombatTurnState(firstTurn);
    // Tanda 17: el tablero ya de pelea (la iniciativa, sus fichas) antes de que jueguen los primeros:
    // si son ellos, la secuencia de sus golpes (combat-fx.js) se ve encima de este dibujo.
    renderLocationMapsPreview();
    runCombatTurnLoop(true);

    return summary;
}

/**
 * J12.7: empezar una pelea sin muertes (`party/brawl.js`): sus rivales, ya hechos, y la bandera
 * en el combate antes del primer golpe.
 *
 * @param {import('../dnd-system.js').EnemyInstance[]} enemies
 * @param {import('../game-engine/combat/brawl.js').Brawl} brawl
 * @returns {string} El orden de iniciativa, ya escrito.
 */
export function startBrawlFight(enemies, brawl) {
    if (combatEncounter.active || enemies.length === 0) return '';
    setCombatLogEntries([]);
    const summary = beginEncounterWith(enemies, { brawl });
    showInitiativeBanner(enemies.map(e => e.name));
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
 * @param {{enemiesFirst?: boolean, said?: string}} [options] J12.2: si os pillaron al evitarla, empiezan ellos.
 *   Tanda 10: `said`, lo que se cuenta al empezar, si no es lo de siempre.
 */
export function startWaitingFight(awake, { enemiesFirst = false, said = '' } = {}) {
    if (combatEncounter.active) return;
    // J9.1: con todo el grupo muerto no se empieza nada: se dice, con sus salidas.
    if (partyHasFallen(partyMembers)) {
        void sayPartyFallen({ again: true });
        return;
    }
    const enemies = instancesFromPlacements(awake);
    if (enemies.length === 0) {
        toastr.warning('Ninguno de los enemigos del tablero existe en el mundo.');
        return;
    }
    setCombatLogEntries([]);
    postCombatNarration(said || `[COMBAT] Empieza el combate del tablero: ${waitingSummary(awake)}.`);
    beginEncounterWith(enemies, { enemiesFirst });
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
 * Tanda 16: en la pelea de ahora, lo que falta de la misión del tablero si ya solo se puede
 * hacer andando (sin nadie en pie y sin refuerzos por llegar): sus ids. Vacío si no.
 *
 * @returns {string[]}
 */
function objectiveLeftNow() {
    if (!combatEncounter.active) return [];
    const location = getCurrentWorldLocationMaps().find(l => l.name === currentLocationName);
    const board = getLocationBoards(location).find((/** @type {any} */ b) => b.name === currentBoardName);
    if (!board || !hasScenario(board)) return [];
    const live = getActiveBoardContext().board;
    const wavesLeft = (Array.isArray(live?.waves) ? live.waves : []).some((/** @type {any} */ w) => w && !w.done && !w.help);
    return objectivesLeftWalking(board.objectives, buildBoardState({
        round: combatEncounter.round, enemies: combatEncounter.enemies, party: partyMembers, collectedTreasures: collectedHere(board),
    }), { wavesLeft });
}

/**
 * Tanda 16: fuera de combate, si se ha cumplido lo que quedó de la misión del tablero al acabar
 * su pelea (alguien ha llegado a la ventana, se ha sacado el tesoro): entonces se gana el tablero
 * como si se hubiera hecho peleando (la localización superada, el hilo sigue y «Continuar» lleva
 * a lo siguiente). Lo llaman el tablero al andar y el cofre al abrirse.
 *
 * @returns {boolean} Si se ha cumplido ahora.
 */
export function checkObjectiveLeft() {
    const left = chat_metadata?.[OBJECTIVE_LEFT_KEY];
    if (!left || combatEncounter.active || left.place !== currentLocationName || left.board !== currentBoardName) return false;
    const location = getCurrentWorldLocationMaps().find(l => l.name === currentLocationName);
    const board = getLocationBoards(location).find((/** @type {any} */ b) => b.name === currentBoardName);
    if (!board) return false;
    const here = partyMembers.filter(m => !m.dead && (!m.mapPosition?.locationName || m.mapPosition.locationName === currentLocationName));
    const now = walkingObjectiveStatus(board.objectives, left.left, buildBoardState({
        round: Number(left.round) || 1, enemies: [], party: here, collectedTreasures: collectedHere(board),
    }));
    if (now.status === 'pending') return false;
    delete chat_metadata[OBJECTIVE_LEFT_KEY];
    saveMetadata();
    if (now.status === 'failed') {
        postCombatNarration(`🏁 [TABLERO] ❌ ${now.labels.join(' · ')}: la misión ha fracasado.`);
        return true;
    }
    postCombatNarration(`🎯 [TABLERO] ✅ ${now.labels.join(' · ')}.\n🏁 [TABLERO] Objetivos cumplidos.`);
    toastr.success(now.labels.join(' · '), 'Objetivo cumplido');
    markLocationComplete(currentLocationName);
    notePlot({ kind: 'win', place: currentLocationName, board: currentBoardName });
    // D-J45: ahora sí, «Continuar» sigue el hilo desde aquí.
    lastWin = { owner: chat_metadata, place: currentLocationName, board: currentBoardName };
    if (isShellOpen()) refreshGameShell();
    return true;
}

/**
 * Tanda 16: fuera de la pelea (acabada, o tras una trampa), quien está en el suelo desangrándose
 * no se queda ahí: quien mejor sabe de Medicina de los que siguen en pie le atiende, sin prisa,
 * hasta que deja de desangrarse (`tendFallen`). Quien cae solo, sin nadie que le atienda, tira
 * sus salvaciones de muerte hasta que se decide (como en la pelea: estable, en pie con un 20, o
 * lo que digan las reglas de la campaña con el tercer fallo); estable y solo, al rato vuelve en
 * sí con 1 PG (en D&D, de una a cuatro horas después).
 */
function tendTheFallen() {
    const fallen = partyMembers.filter(m => needsStabilizing(m)
        && (!m.mapPosition?.locationName || m.mapPosition.locationName === currentLocationName));
    for (const target of fallen) {
        const helper = bestTender(partyMembers.filter(m => m !== target && !(/** @type {any} */ (m)).summon), m => skillModifier(m, 'medicine').modifier);
        if (helper) {
            const tended = tendFallen({
                helper: String(helper.name), target: String(target.name),
                modifier: skillModifier(helper, 'medicine').modifier,
                rollD20: () => rollDiceDetailed('1d20', 20).total,
            });
            target.deathSaves = stableSaves();
            postCombatNarration(`[COMBAT] ${tended.line}`);
            continue;
        }
        // Solo: sus salvaciones, hasta que se decide (como mucho, cinco tiradas: tres de un lado).
        for (let i = 0; i < 6 && needsStabilizing(target); i++) {
            const result = rollDeathSave({ member: target, roll: () => rollDiceDetailed('1d20', 20) });
            target.deathSaves = result.saves;
            if (result.hp != null) target.hp = result.hp;
            postCombatNarration(`[COMBAT] ${result.line}`);
            if (result.outcome === 'up') {
                target.activeConditions = (Array.isArray(target.activeConditions) ? target.activeConditions : [])
                    .filter((/** @type {string} */ c) => c !== 'Unconscious');
            }
            if (result.outcome === 'dead') applyFall(target);
        }
    }
    // Estable y sin nadie más en pie: al rato vuelve en sí, con 1 PG.
    if (!partyMembers.some(m => !m.dead && !(/** @type {any} */ (m)).summon && (Number(m.hp) || 0) > 0)) {
        for (const member of partyMembers.filter(m => !m.dead && !(/** @type {any} */ (m)).summon && (Number(m.hp) || 0) <= 0 && m.deathSaves?.stable)) {
            member.hp = 1;
            member.deathSaves = clearDeathSaves();
            member.activeConditions = (Array.isArray(member.activeConditions) ? member.activeConditions : [])
                .filter((/** @type {string} */ c) => c !== 'Unconscious');
            postCombatNarration(`🩹 [COMBAT] Pasa un rato. ${member.name} vuelve en sí con 1 PG.`);
        }
    }
}

/**
 * Tanda 16: atender a los caídos fuera de combate (lo llama la trampa que deja a alguien a 0 PG
 * fuera de una pelea; en una pelea, quien cae tira sus salvaciones en su turno).
 */
export function tendFallenOutOfFight() {
    if (combatEncounter.active) return;
    tendTheFallen();
    savePartyState();
}

/**
 * M4: sin nadie en pie y la misión del tablero sin cumplir, decir qué falta (un cofre, una
 * casilla, aguantar unas rondas), una vez por pelea. Antes la pelea seguía sin decir por qué.
 */
function sayWhatIsLeft() {
    const location = getCurrentWorldLocationMaps().find(l => l.name === currentLocationName);
    const board = getLocationBoards(location).find((/** @type {any} */ b) => b.name === currentBoardName);
    const line = board ? leftToDo(board.objectives, buildBoardState({
        round: combatEncounter.round, enemies: combatEncounter.enemies, party: partyMembers, collectedTreasures: collectedHere(board),
    })) : '';
    // Lo mismo con otra ronda no se repite: solo cuando cambia lo que falta.
    const key = line.replace(/\d+/g, '#');
    if (!line || /** @type {any} */ (combatEncounter).leftSaid === key) return;
    /** @type {any} */ (combatEncounter).leftSaid = key;
    postCombatNarration(`🎯 [COMBAT] ${line}`);
    toastr.info(line, 'Lo que falta', { timeOut: 12000 });
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
    if (verdict && !verdict.outcome) sayWhatIsLeft();
    // Tanda 16: sin nadie en pie y con lo que falta para hacerse andando (la ventana de la posada
    // de 1387), la pelea se acaba aquí: lo que falta se hace fuera de combate, sin turnos ni
    // salvaciones de muerte, y el grupo puede atender a quien ha caído.
    if (verdict && !verdict.outcome && objectiveLeftNow().length > 0) {
        postCombatNarration('🏆 [COMBAT] Todos los enemigos han sido derrotados.');
        endCombat('victory');
        renderLocationMapsPreview();
        return true;
    }
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
 *
 * @param {string} [reason]
 * @param {{said?: string, told?: string}} [options] J8.5: cuando se acaba hablando, el resultado
 *   dicho a su manera («os habéis rendido») y lo que se lee en la novela en vez del final de
 *   siempre (que diría «os retiráis a tiempo» a quien se ha entregado).
 */
export function endCombat(reason = 'ended', { said = '', told = '' } = {}) {
    // J12.7: una pelea sin muertes acaba a su manera: sin botín, sin muertos y de vuelta al pueblo.
    if (endBrawl(reason)) return;
    // Tanda 16: ganada sin haber cumplido lo que falta de la misión (que se hace andando): la pelea
    // se acaba, pero el tablero no se da por ganado para el hilo hasta que se cumpla.
    const objectiveLeft = reason === 'victory' ? objectiveLeftNow() : [];
    postCombatNarration('🏁 [COMBAT] El combate termina.');
    // J19: lo que dura un minuto no pasa a la escena siguiente: las invocaciones se van, las
    // zonas se deshacen y las concentraciones de la pelea se acaban.
    const magicEnds = endOfFightMagic();
    if (magicEnds.length > 0) postCombatNarration(`[COMBAT] ${magicEnds.join('\n')}`);
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
    postCombatNarration(buildCombatSummary(/** @type {'victory'|'defeat'|'manual'|'ended'} */ (reason === 'fled' ? 'manual' : reason), said));

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
        // R3: quien sabe primeros auxilios levanta a quien quedó en el suelo. J7.4: primero, quien
        // cura en la formación.
        const medic = patchUpAfterFight(healerFirst(getPartyFormation(), partyMembers));
        for (const fallenMember of medic ? partyMembers.filter(m => !m.dead && (Number(m.hp) || 0) <= 0) : []) {
            const healed = Math.max(1, Number(rollDiceDetailed(String(medic?.formula), 4).total) || 1);
            fallenMember.hp = Math.min(Number(fallenMember.maxHp) || healed, healed);
            fallenMember.deathSaves = clearDeathSaves();
            fallenMember.activeConditions = (Array.isArray(fallenMember.activeConditions) ? fallenMember.activeConditions : [])
                .filter((/** @type {string} */ c) => c !== 'Unconscious');
            postCombatNarration(`🩹 [COMBAT] ${medic?.who} venda a ${fallenMember.name}: se levanta con ${fallenMember.hp} PG.`);
        }
        // Tanda 16: y a quien sigue desangrándose, quien mejor sabe le estabiliza (Medicina contra 10).
        tendTheFallen();
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
        // Tanda 16: con la misión a medias (falta salir por la ventana), el hilo espera a que se cumpla.
        if (objectiveLeft.length === 0) notePlot({ kind: 'win', place: currentLocationName, board: currentBoardName });
        else if (chat_metadata) {
            chat_metadata[OBJECTIVE_LEFT_KEY] = {
                place: currentLocationName, board: currentBoardName, left: objectiveLeft, round: Number(combatEncounter.round) || 1,
            };
            saveMetadata();
        }
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
    const woundedMembers = partyMembers.filter(m => (m.hp || 0) > 0 && (m.hp || 0) <= (Number(m.maxHp) || 1) / 2);
    const wounded = woundedMembers.map(m => m.name);
    // J13.1: contados, «dos ratas de bodega», no «Rata de bodega» por las dos.
    /** @type {Record<string, number>} */
    const fallenCount = {};
    for (const foe of combatEncounter.enemies.filter(e => (e.currentHp || 0) <= 0)) {
        const base = String(foe.name).replace(/\s+\d+$/, '');
        fallenCount[base] = (fallenCount[base] ?? 0) + 1;
    }
    const fallenFoes = Object.entries(fallenCount).map(([name, n]) => countedName(name, n));
    const ending = tellMoment('fin-combate', {
        ganado: reason === 'victory' ? 'sí' : (reason === 'manual' || reason === 'fled' ? 'huida' : 'no'),
        caidos: listNames(fallenFoes),
        // J13.3: con el género de quien sale herido; de varios, el del grupo (todas mujeres,
        // «malheridas»).
        heridos: wounded.length === 0 ? '' : `${listNames(wounded)} ${wounded.length === 1
            ? `sale ${gendered(woundedMembers[0], 'malherido', 'malherida')}`
            : `salen ${gendered(groupGender(woundedMembers), 'malheridos', 'malheridas')}`}.`,
        botin: listNames((loot?.items ?? []).map((/** @type {any} */ item) => String(item?.name || '')).filter(Boolean).slice(0, 3)),
    });
    // J13.9: sin conexión, el final de la pelea no lo cuenta nadie (la pantalla de la victoria ya lo dice).
    postForModel(epilogue, { show: told || ending, moment: 'fin-combate' }).catch(error => console.error('[party] could not post the combat epilogue', error));

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
        // Tanda 17: después de ver el último golpe y su tirada (la secuencia del combate).
        afterFx(() => showVictoryScreen(report));
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
    // D-J45: ganada en un tablero, «Continuar» sigue el hilo desde aquí (`afterFightNow`).
    // Tanda 16: con la misión a medias, todavía no: lo pone `checkObjectiveLeft` al cumplirla.
    lastWin = reason === 'victory' && currentBoardName && objectiveLeft.length === 0
        ? { owner: chat_metadata, place: currentLocationName, board: currentBoardName }
        : null;
    // J14.1 y J14.2: la pelea de tablero se lleva su parte del día, y tras ganarla, a veces
    // alguien del grupo tiene algo que decir.
    afterFight(reason, { board: currentBoardName });
    // J14.9: si era la pelea de una misión personal, la misión sigue por donde diga el final.
    // Mientras sigue, es lo que toca tras la pelea (D-J45).
    questFollowUps += 1;
    void questAfterFight(reason, currentBoardName).finally(() => {
        questFollowUps = Math.max(0, questFollowUps - 1);
        if (isShellOpen()) refreshGameShell();
    });
}

/**
 * D-J45: la última pelea ganada en un tablero, mientras no se haya seguido con «Continuar».
 *
 * @type {{owner: any, place: string, board: string}|null}
 */
let lastWin = null;

/** Los pasos de misión personal que siguen solos tras una pelea y aún no han acabado. */
let questFollowUps = 0;

/**
 * Lo que tenéis entre manos en la campaña (el hito de la cabecera), con dónde está.
 *
 * @returns {{title: string, place: string, board: string}|null}
 */
function campaignNextStep() {
    const plot = getPlot();
    if (!plot || !chat_metadata) return null;
    const focus = focusOf(plot, chat_metadata[PLOT_STATE_KEY]);
    if (!focus) return null;
    const milestone = plot.milestones.find((/** @type {any} */ m) => String(m.id) === String(focus.id));
    return { title: String(focus.title || ''), ...whereItAsks(milestone?.asks) };
}

/**
 * D-J45: a dónde lleva «Continuar» ahora, si se acaba de ganar una pelea en este tablero. Nada
 * si no: entonces «Continuar» es el de siempre (J18.8), que vuelve al tablero.
 *
 * @returns {import('../game-engine/combat/after-fight.js').AfterFightStep|null}
 */
export function afterFightNow() {
    if (!lastWin || combatEncounter.active) return null;
    if (lastWin.owner !== chat_metadata || lastWin.board !== currentBoardName || lastWin.place !== currentLocationName) {
        lastWin = null;
        return null;
    }
    // Una escena del hilo en cola, la tarjeta de un suceso o el paso de una misión personal.
    const story = scenesPending > 0 || questFollowUps > 0 || Boolean(document.querySelector('.su-root'));
    // En el gremio no hay «lo siguiente de la campaña»: no es una campaña.
    const inCampaign = !lastHub;
    return afterFightStep({
        story,
        inCampaign,
        next: inCampaign ? campaignNextStep() : null,
        here: { place: currentLocationName, board: currentBoardName },
        boardDone: boardIsDone(),
    });
}

/**
 * Tanda 8: si al tablero abierto ya no le queda nada: ni enemigos escritos por pelear, ni nada
 * por explorar, ni nada que coger (`boardLeftovers`). Entonces «Continuar» sale al sitio.
 *
 * @returns {boolean}
 */
function boardIsDone() {
    const { board, gridWidth, gridHeight } = getActiveBoardContext();
    if (!board) return false;
    return boardLeftovers({
        board,
        won: isBoardWon(currentLocationName, currentBoardName),
        fogOn: fogOnFor(board, gridWidth, gridHeight),
        gridWidth,
        gridHeight,
        party: partyMembers.filter(m => !m.dead && (!m.mapPosition?.locationName || m.mapPosition.locationName === currentLocationName))
            .map(m => ({ x: Number(m.mapPosition?.gridX) || 0, y: Number(m.mapPosition?.gridY) || 0 })),
    }).done;
}

/**
 * D-J45: pulsar «Continuar» tras ganar. Con una escena, solo se aparta el panel de victoria (la
 * escena sale encima de la novela y, al acabar, «Continuar» sigue). Con lo siguiente de la
 * campaña en otro sitio, se sale del tablero al sitio; si no, se vuelve al tablero.
 *
 * Se decide con lo de ahora, no con lo que decía el botón al dibujarse: la escena puede haber
 * acabado entre medias.
 *
 * @param {import('../game-engine/ui/shell/scene-director.js').SceneName} next La escena que decía el botón.
 * @param {import('../game-engine/ui/shell/scene-director.js').GameSituation|null} [situation] La de ahora,
 *   con los sitios del pueblo que contó la pantalla (`townPlaces`): sin ellos, en el gremio no se
 *   podría salir del tablero al pueblo.
 * @returns {import('../game-engine/ui/shell/scene-director.js').SceneName} A dónde va la pantalla.
 */
export function followAfterFight(next, situation = null) {
    const step = afterFightNow();
    if (!step) return next;
    if (step.kind === 'story') return 'dialogue';
    const scene = (situation ? continueScene({ ...situation, afterFight: step }) : null) ?? next;
    lastWin = null;
    if ((step.kind === 'next' || step.kind === 'place') && scene === 'exploration' && currentBoardName) {
        setCurrentBoardName('');
        saveCurrentBoard();
        renderLocationMapsPreview();
        if (step.kind === 'next') toastr.info(step.title.replace(/^Lo siguiente: /, ''), 'Lo siguiente', { timeOut: 6000 });
        // Tanda 8: se sale de un tablero al que ya no le queda nada; se dice por qué.
        else toastr.info(step.title, 'Aquí ya no queda nada', { timeOut: 6000 });
    }
    return scene;
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
    // J12.7: en un duelo, los que miran no han huido: quien peleaba ha caído.
    if (brawlOf(combatEncounter)) {
        endCombat('defeat');
        return;
    }
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
    // J12.7: de una pelea sin muertes no se huye: se rinde uno, o se paga una ronda.
    if (brawlOf(combatEncounter)) {
        await brawlTalk();
        return;
    }
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
