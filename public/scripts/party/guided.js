/**
 * El modo guiado en la partida (D-J62 de wiki/ROADMAP_SIN_CONEXION.md): lo que pide ahora la
 * historia, hacerlo, y lo que una conversación manda hacer al acabar («Bajo a la bodega»).
 *
 * Lo que se enseña y lo que se esconde lo decide `game-engine/campaign/guided-mode.js` (puro, con
 * el interruptor `GUIDED_MODE`). Aquí se le da lo de la partida —el hilo, el encargo aceptado, los
 * caminos y los tableros— y se hace lo que se pulsa:
 *
 * - **Ir a…**: se viaja como siempre (lo que cuesta, el ritmo) y, al llegar, si allí espera la
 *   pelea que pide la historia o el encargo, se entra en su tablero y empieza sola (J12.16).
 * - **Ir a un tablero de aquí** que pide la historia: se entra (con el aviso de J11.1 si no tiene
 *   vuelta atrás).
 * - **Hablar con…** quien pide la historia, si está aquí.
 * - **Intentarlo**: la tirada que pide un hito o una pista, o resolver un encargo hablando.
 *
 * Las opciones de conversación con `{"board": …}` o `{"go": …}` (dialogues.js) se guardan al
 * elegirlas y se hacen al cerrar la ventana (`runStoryMoves`): entrar en un tablero con la charla
 * abierta la dejaría encima de la pelea.
 */

import { chat_metadata } from '../../script.js';
import { getCurrentWorldLocationMaps } from '../world-info.js';
import { guidedOn, storySteps, boardOnArrival, boardsByTalk } from '../game-engine/campaign/guided-mode.js';
import { readPlotState } from '../game-engine/campaign/plot.js';
import { normalizeObjectives } from '../game-engine/campaign/scenarios.js';
import { reachFrom } from '../game-engine/world/travel.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import { shownName } from '../game-engine/ui/shown-names.js';
import { OBJECTIVE_LEFT_KEY, PLOT_STATE_KEY, RUMORS_HEARD_KEY, TAKEN_KEY, VISITED_KEY } from './keys.js';
import { combatEncounter, currentBoardName, currentLocationName } from './state.js';
import { currentSeason, getLocationBoards, lastDialogues, lastRumors, lastWorldNpcs, travelLocations } from './world.js';
import { friendlyFactions } from './factions.js';
import { offlineGame, storyWindowsOn } from './narration.js';
import { getPlot, confirmBoardNoReturn } from './plot.js';
import { enterBoard, isBoardWon } from './board.js';
import { askBeforeTravelling, travelWithTime } from './travel.js';
import { runSkillCheck, startTalk } from './talk.js';
import { renderLocationMapsPreview } from './board-view.js';

/**
 * Si el modo guiado manda en esta partida: encendido y sin conexión.
 *
 * @returns {boolean}
 */
export function guidedNow() {
    return guidedOn(offlineGame());
}

/** @param {any} value @returns {string} */
const fold = (value) => String(value ?? '').trim().toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * El tablero ganado con la misión a medias (Tanda 16: no queda nadie en pie, pero falta salir por
 * la ventana), con lo que falta, como se lee: `{"El cuarto de la posada": "Salir por la ventana"}`.
 * Sale de él quien pulsa «Salir del tablero» antes de terminarla; con el modo guiado, se vuelve
 * por «Lo que pide la historia».
 *
 * @returns {Record<string, string>}
 */
function unfinishedBoards() {
    const left = chat_metadata?.[OBJECTIVE_LEFT_KEY];
    if (!left?.board) return {};
    const location = getCurrentWorldLocationMaps().find((/** @type {any} */ l) => fold(l?.name) === fold(left.place));
    const board = getLocationBoards(location).find((/** @type {any} */ b) => fold(b?.name) === fold(left.board));
    const ids = new Set(Array.isArray(left.left) ? left.left.map(String) : []);
    const labels = normalizeObjectives(board?.objectives).filter(o => ids.has(o.id)).map(o => o.label);
    return { [String(left.board)]: labels.join(' · ') };
}

/**
 * Adonde lleva un rumor ya oído (`leadsTo`) y donde aún no se ha estado: con el modo guiado, se
 * puede ir (alguien os ha dicho dónde). Es por donde se da con los secretos del hilo.
 *
 * @returns {string[]}
 */
function rumorLeads() {
    const heard = new Set(Array.isArray(chat_metadata?.[RUMORS_HEARD_KEY]) ? chat_metadata[RUMORS_HEARD_KEY].map(String) : []);
    const been = new Set((Array.isArray(chat_metadata?.[VISITED_KEY]) ? chat_metadata[VISITED_KEY] : []).map(fold));
    const places = lastRumors.filter(r => heard.has(String(r.id)) && r.leadsTo).map(r => String(r.leadsTo));
    return [...new Set(places)].filter(place => !been.has(fold(place)));
}

/**
 * Lo que `storySteps` necesita de la partida de ahora.
 *
 * @returns {Parameters<typeof storySteps>[0]}
 */
function storyInput() {
    const plot = getPlot();
    const state = readPlotState(chat_metadata?.[PLOT_STATE_KEY]);
    /** @type {Record<string, string>} */
    const where = {};
    for (const npc of lastWorldNpcs) if (!npc.dead && npc.where) where[npc.name] = npc.where;
    return {
        unfinished: unfinishedBoards(),
        leads: rumorLeads(),
        milestones: plot?.milestones ?? [],
        state,
        here: currentLocationName,
        board: currentBoardName,
        locations: getCurrentWorldLocationMaps(),
        reach: currentLocationName ? reachFrom({
            from: currentLocationName, locations: travelLocations(), friendly: friendlyFactions(), season: currentSeason(), done: state.done,
        }) : {},
        won: (place, board) => isBoardWon(place, board),
        taken: chat_metadata?.[TAKEN_KEY] ?? null,
        where,
        // Los tableros a los que ya lleva una conversación escrita (la de Brunilda, a la bodega): a
        // esos se entra hablando, no con un botón. Con las ventanas de historia apagadas no se ven
        // esas conversaciones, y entonces sí sale el botón.
        talked: storyWindowsOn() ? [...boardsByTalk(lastDialogues), ...boardsByTalk(plot?.milestones ?? [])] : [],
        // J13.7: «Hablar con el posadero» hasta que se presente.
        called: (name) => shownName(name, 'el'),
        // El pueblo de donde se sale: el primer sitio de la partida (el del gremio, o donde empieza la campaña).
        home: String((Array.isArray(chat_metadata?.[VISITED_KEY]) ? chat_metadata[VISITED_KEY] : [])[0] ?? ''),
    };
}

/**
 * Lo que pide ahora la historia (y el encargo aceptado), para la pantalla del sitio. Vacío sin el
 * modo guiado, en plena pelea o sin partida.
 *
 * @returns {import('../game-engine/campaign/guided-mode.js').StoryStep[]}
 */
export function storyStepsNow() {
    if (!guidedNow() || !chat_metadata || combatEncounter.active || !currentLocationName) return [];
    return storySteps(storyInput());
}

/** Redibujar lo que se ve: el panel del mundo y el Modo Juego. */
function redraw() {
    renderLocationMapsPreview();
    if (isShellOpen()) refreshGameShell();
}

/**
 * Al llegar a un sitio adonde se iba por la historia o por un encargo: si allí espera su pelea, se
 * entra en su tablero y empieza sola (J12.16). Con un respiro antes, para que la escena de la
 * llegada se ponga en cola delante (`fight-entry.js` espera a que acabe).
 *
 * @param {string} [wanted] El tablero que se buscaba al salir.
 * @returns {Promise<string>} El tablero en el que se ha entrado, o vacío.
 */
export async function enterStoryBoardHere(wanted = '') {
    await new Promise(resolve => setTimeout(resolve, 250));
    if (!chat_metadata || combatEncounter.active || !currentLocationName) return '';
    const board = boardOnArrival({ ...storyInput(), wanted });
    if (!board || fold(board) === fold(currentBoardName)) return '';
    if (!(await confirmBoardNoReturn(board))) return '';
    const entered = enterBoard(board);
    redraw();
    return entered;
}

/**
 * Viajar adonde manda la historia: como la columna «Viajar» de siempre (se dice lo que cuesta y se
 * elige el ritmo) y, al llegar, a su pelea si la hay.
 *
 * @param {string} place
 * @param {string} [board] El tablero que se busca allí, si se sabe.
 * @returns {Promise<string>} Adonde se ha llegado, o vacío.
 */
export async function travelForStory(place, board = '') {
    const { to, reason } = await travelWithTime(place, { confirm: askBeforeTravelling });
    // Cancelar no lleva motivo: solo se avisa de lo que impide viajar.
    if (reason) toastr.info(reason, 'No se puede viajar');
    redraw();
    if (to) await enterStoryBoardHere(board);
    return to;
}

/**
 * Hacer un paso de la historia (lo que se pulsa en la pantalla del sitio).
 *
 * @param {import('../game-engine/campaign/guided-mode.js').StoryStep} step
 * @returns {Promise<void>}
 */
export async function runStoryStep(step) {
    if (!step?.enabled) return;
    if (combatEncounter.active) {
        toastr.warning('No mientras peleáis.');
        return;
    }
    if (step.kind === 'go' && step.place) {
        await travelForStory(step.place, step.board ?? '');
        return;
    }
    if (step.kind === 'board' && step.board) {
        // J11.1: el tablero que no tiene vuelta atrás pregunta antes.
        if (!(await confirmBoardNoReturn(step.board))) return;
        enterBoard(step.board);
        redraw();
        return;
    }
    if (step.kind === 'talk' && step.npc) {
        startTalk(step.npc);
        return;
    }
    if (step.kind === 'check' && step.skill) {
        runSkillCheck(step.skill);
        if (isShellOpen()) refreshGameShell();
    }
}

/**
 * D-J62: lo que una conversación manda hacer al acabar (`{"board": …}`, `{"go": …}`), en cola
 * hasta que se cierre su ventana.
 *
 * @type {Array<{kind: 'board'|'go', name: string}>}
 */
let moves = [];

/**
 * Guardar lo que manda hacer una opción de conversación. Lo último que se pide de cada clase manda.
 *
 * @param {Array<{kind: 'board'|'go', name: string}>} list
 */
export function queueStoryMoves(list) {
    for (const move of Array.isArray(list) ? list : []) {
        if (!move?.name) continue;
        moves = [...moves.filter(m => m.kind !== move.kind), { kind: move.kind, name: String(move.name) }];
    }
}

/**
 * La localización de un tablero del mundo, por su nombre.
 *
 * @param {string} board
 * @returns {string}
 */
function homeOfBoard(board) {
    const home = getCurrentWorldLocationMaps().find((/** @type {any} */ l) => (Array.isArray(l?.boards) ? l.boards : [])
        .some((/** @type {any} */ b) => fold(b?.name) === fold(board)));
    return String(home?.name ?? '');
}

/**
 * Hacer lo que la conversación mandó, ya cerrada su ventana: viajar adonde dijo y entrar en el
 * tablero (si está en otro sitio, se va antes allí). Lo llaman la escena del hilo y la charla
 * escrita al acabar.
 *
 * @returns {Promise<void>}
 */
export async function runStoryMoves() {
    const now = moves;
    moves = [];
    if (now.length === 0) return;
    // Que la ventana acabe de cerrarse antes de cambiar de pantalla.
    await new Promise(resolve => setTimeout(resolve, 150));
    if (!chat_metadata || combatEncounter.active) return;
    const go = now.find(m => m.kind === 'go')?.name ?? '';
    const board = now.find(m => m.kind === 'board')?.name ?? '';
    const home = board ? homeOfBoard(board) : '';
    const place = go || (home && fold(home) !== fold(currentLocationName) ? home : '');
    if (place && fold(place) !== fold(currentLocationName)) {
        await travelForStory(place, board);
        return;
    }
    if (!board || fold(board) === fold(currentBoardName)) return;
    if (!(await confirmBoardNoReturn(board))) return;
    if (!enterBoard(board)) {
        toastr.warning(`Desde aquí no se llega a ${board}.`, 'La historia');
        return;
    }
    redraw();
}

/**
 * D-J62: con quién se puede hablar aquí fuera de un pueblo con sitios (la fila de abajo ya no lo
 * ofrece): la gente de esta localización que sigue viva, llamada como se la conoce (J13.7).
 *
 * @returns {Array<{name: string, label: string}>}
 */
export function peopleHereNow() {
    if (!currentLocationName || currentBoardName) return [];
    return lastWorldNpcs
        .filter(n => !n.dead && fold(n.where) === fold(currentLocationName))
        .map(n => ({ name: String(n.name), label: shownName(n.name, 'el') }));
}
