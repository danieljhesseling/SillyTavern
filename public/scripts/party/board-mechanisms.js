/**
 * Lo que se derrumba y los mecanismos del tablero, jugados (E1.4 y E1.5 de
 * wiki/ROADMAP_ENTRETENIDO.md). Las reglas viven en `game-engine/board/mechanisms.js`; aquí, el
 * clic en la casilla, quién lo hace, los dados, el daño y lo que dice quien lo hace (D-J60: no
 * hay narrador; el registro de combate lleva la cuenta).
 *
 * - La columna o la estantería (`H`): se pulsa estando al lado y se tira (con la acción).
 * - La gema (`g`) se coge y la estatua (`S`) la recibe estando al lado (gratis, como abrir una puerta).
 * - Las runas (`1` a `5`) se pisan: las mira `walkTraps` en `board.js` en cada paseo.
 * - La palanca emparejada (`p`): con la acción; a la vez que la otra.
 */

import { getCell, normalizeTerrain } from '../game-engine/board/terrain.js';
import {
    TOPPLE, RUNE_ZAP, toppleCells, toppleTerrain, crushed, takeGem, placeGem, stepRunes,
    pairedLeversManned, pullPairedLever, cellsOfType,
} from '../game-engine/board/mechanisms.js';
import { rollWith } from '../game-engine/combat/seeded-random.js';
import { hasAction, useAction } from '../game-engine/combat/turn-machine.js';
import { rollCheck } from '../game-engine/rules/checks.js';
import { getAbilityModifier } from '../dnd-system.js';
import { rollDiceDetailed, nextRandom } from './combat-rules.js';
import { combatEncounter, currentLocationName, partyMembers } from './state.js';
import { getAliveEnemies, getCurrentTurnEntry, getPartyMemberByTurnEntry, saveCombatState } from './combat-state.js';
import { damagePartyMember } from './enemy-turn.js';
import { applyTimedCondition } from './magic.js';
import { checkScenarioOutcome, endCombat, judgeCurrentScenario } from './combat-flow.js';
import { getActiveBoardContext, persistBoardTerrain, toggleBoardDoor } from './board.js';
import { renderLocationMapsPreview } from './board-view.js';
import { savePartyState } from './roster.js';
import { postCombatNarration, sayHere, soundCue } from './narration.js';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** Cómo se llama cada cosa en los avisos. */
const THING = { topple: 'la columna', statue: 'la estatua', gem: 'la gema', lever_pair: 'la palanca' };

/**
 * Dónde está alguien del grupo.
 *
 * @param {any} member
 * @returns {{x: number, y: number}}
 */
function placeOf(member) {
    return { x: Number(member?.mapPosition?.gridX) || 0, y: Number(member?.mapPosition?.gridY) || 0 };
}

/**
 * Quién del grupo está en el tablero abierto, vivo.
 *
 * @returns {any[]}
 */
function standing() {
    return partyMembers.filter(m => !m.dead && (Number(m.hp) || 0) > 0
        && (!m.mapPosition?.locationName || m.mapPosition.locationName === currentLocationName));
}

/**
 * Quién lo hace: en combate, quien tiene el turno si está al lado; fuera, el primero que esté al lado.
 *
 * @param {number} gx
 * @param {number} gy
 * @returns {any|null}
 */
function whoIsNext(gx, gy) {
    const near = (/** @type {any} */ m) => {
        const at = placeOf(m);
        return Math.max(Math.abs(at.x - gx), Math.abs(at.y - gy)) <= 1;
    };
    if (combatEncounter.active) {
        const acting = getPartyMemberByTurnEntry(getCurrentTurnEntry());
        return acting && near(acting) && (Number(acting.hp) || 0) > 0 ? acting : null;
    }
    return standing().find(near) ?? null;
}

/**
 * Gasta la acción del turno, si hay combate. Si ya la ha usado, lo dice y no deja.
 *
 * @param {any} who
 * @param {string} title
 * @returns {boolean}
 */
function spendAction(who, title) {
    if (!combatEncounter.active) return true;
    if (!hasAction(combatEncounter, 'action')) {
        toastr.info(`${who.name} ya ha usado su acción este turno.`, title);
        return false;
    }
    Object.assign(combatEncounter, useAction(combatEncounter, 'action'));
    return true;
}

/**
 * Se abren las puertas: como al tirar de la palanca, lo de detrás se ve y lo que dormía despierta.
 *
 * @param {any} board
 * @param {Array<{x: number, y: number}>} opened
 */
function openDoors(board, opened) {
    if (opened.length === 0) return;
    soundCue('door');
    const { gridWidth, gridHeight } = getActiveBoardContext();
    for (const door of opened) toggleBoardDoor(board, door.x, door.y, true, gridWidth, gridHeight);
}

/** Lo que se dice cuando se abre el mecanismo: lo que se oye y lo que se abre. */
function openedSaid(/** @type {number} */ doors) {
    return doors === 0 ? '¡Ya está! Aunque no veo que se haya abierto nada.' : doors === 1 ? '¡Ha sonado algo! Se ha abierto la reja.' : '¡Ha sonado algo! Se han abierto las rejas.';
}

/**
 * Si la pelea se ha acabado porque ya no queda nadie en pie.
 */
function maybeWon() {
    if (!combatEncounter.active) return;
    if (!checkScenarioOutcome() && getAliveEnemies().length === 0 && !judgeCurrentScenario()) {
        postCombatNarration('🏆 [COMBAT] Todos los enemigos han sido derrotados.');
        endCombat('victory');
    }
}

/**
 * E1.4 y E1.5: pulsar una casilla de mecanismo del tablero (la columna, la estatua, la gema, la
 * palanca doble). Lo llama `toggleBoardDoor`, el mismo clic que abre puertas y cofres.
 *
 * @param {any} board
 * @param {number} gx
 * @param {number} gy
 * @param {'topple'|'statue'|'gem'|'lever_pair'} kind
 */
export function useMechanism(board, gx, gy, kind) {
    const title = kind === 'topple' ? 'Derribar' : kind === 'lever_pair' ? 'La palanca doble' : kind === 'gem' ? 'La gema' : 'La estatua';
    const who = whoIsNext(gx, gy);
    if (!who) {
        toastr.info(combatEncounter.active ? `Tiene que estar al lado de ${THING[kind]} quien tiene el turno.` : `Hay que llegar al lado de ${THING[kind]}.`, title);
        return;
    }
    if (kind === 'topple') toppleAt(board, gx, gy, who);
    else if (kind === 'gem') pickGem(board, gx, gy, who);
    else if (kind === 'statue') giveGem(board, gx, gy, who);
    else pullPair(board, gx, gy, who);
    persistBoardTerrain(board);
    if (combatEncounter.active) saveCombatState();
    renderLocationMapsPreview();
}

/**
 * E1.4: tirar la columna. Prueba de Atletismo; si sale, cae sobre las dos casillas de detrás y
 * quien está debajo hace su salvación de Destreza.
 *
 * @param {any} board
 * @param {number} gx
 * @param {number} gy
 * @param {any} who
 */
function toppleAt(board, gx, gy, who) {
    if (!spendAction(who, 'Derribar')) return;
    const check = rollCheck({ member: who, skill: 'athletics', rollD20: () => rollDiceDetailed('1d20', 20).total, dc: TOPPLE.checkDc, why: 'para tirarla' });
    if (check && !check.success) {
        sayHere(`🪨 [TABLERO] ${check.said}. ${who.name} empuja, pero no cae.`, text(who.name), 'No se mueve… Pesa más de lo que parece.');
        return;
    }
    const { gridWidth, gridHeight } = getActiveBoardContext();
    const terrain = normalizeTerrain(board.terrain);
    const cells = toppleCells({ terrain, from: placeOf(who), at: { x: gx, y: gy }, width: gridWidth, height: gridHeight });
    board.terrain = toppleTerrain(terrain, { x: gx, y: gy }, cells);
    soundCue('hit');
    const under = (/** @type {number} */ x, /** @type {number} */ y) => cells.some(c => c.x === x && c.y === y);
    const rolled = rollWith(TOPPLE.damage, nextRandom).total;
    const save = (/** @type {number} */ dexterity) => rollWith('1d20', nextRandom).total + getAbilityModifier(Number(dexterity) || 10) >= TOPPLE.saveDc;
    /** @type {string[]} */
    const hit = [];
    /** @type {string[]} */
    const lines = [];
    for (const enemy of getAliveEnemies().filter(e => under(Number(e.gridX) || 0, Number(e.gridY) || 0))) {
        const out = crushed({ rolled, saved: save(enemy.dexterity) });
        enemy.currentHp = Math.max(0, (Number(enemy.currentHp) || 0) - out.damage);
        if (out.prone && enemy.currentHp > 0) applyTimedCondition(enemy, String(enemy.instanceId), 'Prone', 1);
        hit.push(`${enemy.name} ${out.damage}${out.prone ? ', derribado' : ' (se aparta a medias)'}${enemy.currentHp === 0 ? ', y cae' : ''}`);
    }
    for (const member of standing().filter(m => m !== who && under(placeOf(m).x, placeOf(m).y))) {
        const out = crushed({ rolled, saved: save(member.dexterity) });
        lines.push(...damagePartyMember(member, out.damage, false));
        if (out.prone) applyTimedCondition(member, String(member.id), 'Prone', 1);
        hit.push(`${member.name} ${out.damage}${out.prone ? ', derribado' : ' (se aparta a medias)'}`);
    }
    const note = `🪨 [TABLERO] ${check ? `${check.said}. ` : ''}${who.name} tira ${THING.topple} de (${gx + 1}, ${gy + 1}): cae sobre ${cells.length || 'ninguna'} casilla(s)`
        + `${hit.length > 0 ? `, ${rolled} de daño contundente (salvación de Destreza CD ${TOPPLE.saveDc} para la mitad): ${hit.join(', ')}` : ', y no pilla a nadie'}. Quedan escombros.`;
    sayHere([note, ...lines].join('\n'), text(who.name), hit.length > 0 ? '¡Cuidado, que cae! ¡Debajo, a ver si os apartáis!' : '¡Abajo! Ya no nos taparán con eso.');
    if (hit.length > 0) savePartyState();
    maybeWon();
}

/**
 * E1.5: coger la gema del pedestal. La lleva el grupo (`board.gemsCarried`) hasta ponerla.
 *
 * @param {any} board
 * @param {number} gx
 * @param {number} gy
 * @param {any} who
 */
function pickGem(board, gx, gy, who) {
    const took = takeGem(normalizeTerrain(board.terrain), gx, gy);
    if (!took.taken) return;
    board.terrain = took.terrain;
    board.gemsCarried = (Number(board.gemsCarried) || 0) + 1;
    const empty = cellsOfType(board.terrain, 'statue').filter(s => !s.on).length;
    sayHere(`💎 [TABLERO] ${who.name} coge la gema del pedestal (${board.gemsCarried} en la bolsa).`, text(who.name),
        empty > 0 ? '¡Una gema! Las estatuas tienen las manos vacías: seguro que va en una de ellas.' : 'Una gema. Me la guardo.');
}

/**
 * E1.5: poner una gema en la estatua. Con la última, se abren las puertas con llave.
 *
 * @param {any} board
 * @param {number} gx
 * @param {number} gy
 * @param {any} who
 */
function giveGem(board, gx, gy, who) {
    if (getCell(normalizeTerrain(board.terrain), gx, gy).on) {
        toastr.info('Esta estatua ya tiene su gema.', 'La estatua');
        return;
    }
    if ((Number(board.gemsCarried) || 0) <= 0) {
        sayHere('🗿 [TABLERO] La estatua tiene las manos vacías: le falta una gema.', text(who.name), 'Tiene las manos abiertas, como esperando algo. Habrá una gema por aquí: busquémosla.');
        return;
    }
    const put = placeGem(normalizeTerrain(board.terrain), gx, gy);
    if (!put.placed) return;
    board.terrain = put.terrain;
    board.gemsCarried = Math.max(0, (Number(board.gemsCarried) || 0) - 1);
    if (!put.solved) {
        sayHere(`🗿 [TABLERO] ${who.name} pone una gema en la estatua. ${put.left === 1 ? 'Falta una estatua' : `Faltan ${put.left} estatuas`}.`, text(who.name),
            put.left === 1 ? 'Encaja. Brilla un poco… Falta la otra estatua.' : `Encaja. Faltan ${put.left} estatuas.`);
        return;
    }
    sayHere(`🗿 [TABLERO] ${who.name} pone la última gema: las estatuas brillan${put.opened.length > 0 ? ' y se abre la reja' : ''}.`, text(who.name), openedSaid(put.opened.length));
    openDoors(board, put.opened);
}

/**
 * E1.5: bajar una palanca emparejada.
 *
 * @param {any} board
 * @param {number} gx
 * @param {number} gy
 * @param {any} who
 */
function pullPair(board, gx, gy, who) {
    const terrain = normalizeTerrain(board.terrain);
    if (cellsOfType(terrain, 'lever_pair').some(l => l.on)) {
        toastr.info('Ya están bajadas las dos: el mecanismo está abierto.', 'La palanca doble');
        return;
    }
    const round = combatEncounter.active ? Number(combatEncounter.round) || 1 : 0;
    const people = standing().map(m => ({ id: String(m.id), ...placeOf(m) }));
    const manned = round === 0 && pairedLeversManned({ terrain, at: { x: gx, y: gy }, actorId: String(who.id), people });
    if (round === 0 && !manned) {
        // Fuera de combate no se gasta nada: solo se dice qué falta.
        sayHere('🕹️ [TABLERO] La palanca doble solo baja a la vez que la otra.', text(who.name), 'Sola no baja. Que alguien se ponga en la otra palanca y tiramos a la vez.');
        return;
    }
    if (!spendAction(who, 'La palanca doble')) return;
    const pulled = pullPairedLever(terrain, gx, gy, { round, manned });
    board.terrain = pulled.terrain;
    if (!pulled.solved) {
        sayHere(`🕹️ [TABLERO] ${who.name} baja una palanca doble: falta la otra en esta ronda, o vuelve a subir.`, text(who.name), '¡La tengo! ¡La otra, ahora, antes de que vuelva a subir!');
        return;
    }
    const helper = round === 0 ? standing().find(m => m !== who && cellsOfType(terrain, 'lever_pair')
        .some(l => (l.x !== gx || l.y !== gy) && Math.max(Math.abs(placeOf(m).x - l.x), Math.abs(placeOf(m).y - l.y)) === 1)) : null;
    sayHere(`🕹️ [TABLERO] ${who.name}${helper ? ` y ${helper.name}` : ''} bajan las palancas a la vez${pulled.opened.length > 0 ? ': se abre la reja' : ''}.`, text(who.name), openedSaid(pulled.opened.length));
    openDoors(board, pulled.opened);
}

/**
 * E1.5: las runas que se pisan en un paseo. Lo llama `walkTraps` con las casillas pisadas.
 *
 * @param {any} member
 * @param {Array<{x: number, y: number}>} steps Sin la casilla de salida.
 */
export function stepOnRunes(member, steps) {
    const board = getActiveBoardContext().board;
    if (!board || !member || !Array.isArray(steps) || steps.length === 0) return;
    const terrain = normalizeTerrain(board.terrain);
    if (!steps.some(s => getCell(terrain, s.x, s.y).type === 'rune')) return;
    const walked = stepRunes(terrain, steps);
    if (walked.lit.length === 0 && !walked.wrong) return;
    board.terrain = walked.terrain;
    persistBoardTerrain(board);
    if (walked.wrong) {
        const zap = rollWith(RUNE_ZAP, nextRandom).total;
        const lines = damagePartyMember(member, zap, false);
        soundCue('hit');
        sayHere([`✨ [TABLERO] ${member.name} pisa la runa ${walked.wrong.order} cuando tocaba la ${walked.wrong.expected}: se apagan todas, y un chispazo le hace ${zap} de daño de rayo.`, ...lines].join('\n'),
            text(member.name), `¡Ay! No era esa: se han apagado todas. Hay que empezar otra vez por la ${walked.next || 1}.`);
        savePartyState();
    } else if (walked.solved) {
        sayHere(`✨ [TABLERO] ${member.name} pisa la última runa: se encienden todas${walked.opened.length > 0 ? ' y se abre la reja' : ''}.`, text(member.name), openedSaid(walked.opened.length));
        openDoors(board, walked.opened);
    } else {
        const last = walked.lit[walked.lit.length - 1].order;
        sayHere(`✨ [TABLERO] ${member.name} pisa la runa ${last}: se enciende (${walked.total - cellsOfType(walked.terrain, 'rune').filter(r => !r.on).length} de ${walked.total}).`,
            text(member.name), `Se ha encendido la ${last}. Ahora, la ${walked.next}.`);
    }
    renderLocationMapsPreview();
}
