/**
 * Lo que le queda a un tablero (D-J45, afinado en la tanda 8 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * Tras ganar una pelea en un tablero, «Continuar» vuelve a él (`afterFightStep`). Pero si ya no
 * le queda nada —nadie más con quien pelear, nada por explorar y nada que coger—, volver a un
 * tablero vacío es un paso de más: se sale al sitio.
 *
 * Lo que cuenta como que queda algo:
 * - **Enemigos**: los que el tablero trae escritos, mientras su pelea no se ha ganado.
 * - **Por explorar**: una sala que aún no se ha abierto; y, con niebla, una casilla a la que se
 *   llega andando (abriendo puertas) y que nadie ha visto.
 * - **Para coger**: un cofre sin abrir, o una pista de un caso sin encontrar.
 *
 * Puro: del tablero y de dónde está el grupo, a lo que queda. Quien llama decide qué hacer.
 */

import { cellKey, getCell, normalizeTerrain } from './terrain.js';
import { normalizeFog } from './fog-of-war.js';

/** Lo que no se anda ni abriendo puertas: el muro y el precipicio. */
const SOLID = new Set(['wall', 'chasm']);

/** Las cuatro direcciones: por la esquina de dos muros no se cuela nadie. */
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * @typedef {Object} BoardLeftovers
 * @property {number} enemies Los enemigos escritos que aún esperan.
 * @property {number} rooms Las salas sin abrir.
 * @property {number} unseen Las casillas a las que se llega y que nadie ha visto (con niebla).
 * @property {number} chests Los cofres sin abrir.
 * @property {number} clues Las pistas de un caso sin encontrar.
 * @property {boolean} done Si no queda nada.
 */

/**
 * Las casillas sin ver a las que se llega andando desde donde está el grupo, abriendo puertas.
 * Sin saber dónde está el grupo, todas las que se pueden pisar.
 *
 * @param {any} terrain
 * @param {Record<string, true>} explored
 * @param {Array<{x: number, y: number}>} party
 * @param {number} cols
 * @param {number} rows
 * @returns {number}
 */
function unseenCells(terrain, explored, party, cols, rows) {
    const open = (/** @type {number} */ x, /** @type {number} */ y) => x >= 0 && y >= 0 && x < cols && y < rows
        && !SOLID.has(getCell(terrain, x, y).type);
    const starts = (Array.isArray(party) ? party : [])
        .map(p => ({ x: Math.trunc(Number(p?.x)), y: Math.trunc(Number(p?.y)) }))
        .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y) && open(p.x, p.y));
    let unseen = 0;
    if (starts.length === 0) {
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) if (open(x, y) && !explored[cellKey(x, y)]) unseen++;
        }
        return unseen;
    }
    const seen = new Set(starts.map(p => cellKey(p.x, p.y)));
    const queue = [...starts];
    for (let i = 0; i < queue.length; i++) {
        const { x, y } = queue[i];
        if (!explored[cellKey(x, y)]) unseen++;
        for (const [dx, dy] of STEPS) {
            const key = cellKey(x + dx, y + dy);
            if (seen.has(key) || !open(x + dx, y + dy)) continue;
            seen.add(key);
            queue.push({ x: x + dx, y: y + dy });
        }
    }
    return unseen;
}

/**
 * Lo que le queda a un tablero.
 *
 * @param {Object} input
 * @param {any} input.board
 * @param {boolean} [input.won] Si la pelea escrita del tablero ya se ganó (`isBoardWon`).
 * @param {boolean} [input.fogOn] Si el tablero lleva niebla (`fogOnFor`).
 * @param {number} [input.gridWidth]
 * @param {number} [input.gridHeight]
 * @param {Array<{x: number, y: number}>} [input.party] Dónde está el grupo: de ahí se anda.
 * @returns {BoardLeftovers}
 */
export function boardLeftovers({ board, won = false, fogOn = false, gridWidth = 50, gridHeight = 50, party = [] }) {
    const terrain = normalizeTerrain(board?.terrain);
    const cols = Math.max(1, Math.trunc(Number(gridWidth) || 50));
    const rows = Math.max(1, Math.trunc(Number(gridHeight) || 50));
    const placements = Array.isArray(board?.enemyPlacements) ? board.enemyPlacements.filter(Boolean) : [];
    const enemies = won ? 0 : placements.length;
    const rooms = (Array.isArray(board?.rooms) ? board.rooms : [])
        .filter((/** @type {any} */ r) => r && typeof r === 'object' && r.id != null && !r.revealed).length;
    const chests = Object.entries(terrain.cells ?? {}).filter(([key, cell]) => {
        const [x, y] = key.split(',').map(Number);
        return cell?.type === 'chest' && x < cols && y < rows;
    }).length;
    const clues = (Array.isArray(board?.hazards) ? board.hazards : [])
        .filter((/** @type {any} */ h) => h && String(h.kind ?? '') === 'pista' && h.armed !== false).length;
    const unseen = fogOn ? unseenCells(terrain, normalizeFog(board?.fog).explored, party, cols, rows) : 0;
    return { enemies, rooms, unseen, chests, clues, done: enemies + rooms + unseen + chests + clues === 0 };
}
