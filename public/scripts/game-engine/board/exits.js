/**
 * Las salidas del tablero: la ventana que da al callejón (B2 de wiki/LO_QUE_FALTA.md).
 *
 * Huir ya se podía siempre (idea 22, `retreat.js`): el grupo entero, pagando un golpe por
 * cada enemigo pegado. Una salida es otra cosa, a la manera de Gloomhaven: **cada uno sale
 * por su cuenta** al pisarla, deja de estar en la pelea (nadie le ataca, no tiene turno) y,
 * cuando han salido todos los que siguen en pie, el combate acaba en huida — sin los golpes
 * de la retirada, porque para llegar hasta allí ya se ha pagado el camino.
 *
 * Si lo que pide el tablero es justo salir (un objetivo «alcanzar» sobre la salida), pisarla
 * es ganar, y eso ya lo decide el objetivo: aquí no hace falta nada.
 *
 * Puro: quién ha salido vive en el combate (`combatEncounter.left`), y esto lo lee y lo dice.
 */

import { getCell } from './terrain.js';

/** El tipo de terreno que es una salida. */
export const EXIT = 'exit';

/**
 * Si una casilla es una salida.
 *
 * @param {any} terrain
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function isExit(terrain, x, y) {
    if (!terrain) return false;
    return getCell(terrain, Math.trunc(Number(x) || 0), Math.trunc(Number(y) || 0))?.type === EXIT;
}

/**
 * Las salidas de un tablero.
 *
 * @param {any} terrain
 * @returns {Array<{x: number, y: number}>}
 */
export function exitCells(terrain) {
    const cells = terrain?.cells && typeof terrain.cells === 'object' ? terrain.cells : {};
    return Object.entries(cells)
        .filter(([, cell]) => /** @type {any} */ (cell)?.type === EXIT)
        .map(([key]) => {
            const [x, y] = key.split(',').map(Number);
            return { x, y };
        })
        .filter(cell => Number.isFinite(cell.x) && Number.isFinite(cell.y));
}

/**
 * Quién ha salido ya, leído del combate.
 *
 * @param {any} raw
 * @returns {string[]}
 */
export function readLeft(raw) {
    return Array.isArray(raw) ? [...new Set(raw.map(String).filter(Boolean))] : [];
}

/**
 * Salir: devuelve la lista nueva. Salir dos veces no cambia nada.
 *
 * @param {any} raw
 * @param {string|number} memberId
 * @returns {string[]}
 */
export function leaveBoard(raw, memberId) {
    const left = readLeft(raw);
    const id = String(memberId ?? '');
    return id && !left.includes(id) ? [...left, id] : left;
}

/**
 * Si alguien ha salido ya de esta pelea.
 *
 * @param {any} raw
 * @param {string|number} memberId
 * @returns {boolean}
 */
export function hasLeft(raw, memberId) {
    return readLeft(raw).includes(String(memberId ?? ''));
}

/**
 * Quién sigue en la pelea: en pie y sin haber salido.
 *
 * @template {{id: any, hp?: any}} T
 * @param {T[]} members
 * @param {any} raw
 * @returns {T[]}
 */
export function stillFighting(members, raw) {
    const left = new Set(readLeft(raw));
    return (Array.isArray(members) ? members : []).filter(m => (Number(m?.hp) || 0) > 0 && !left.has(String(m?.id)));
}

/**
 * Si ya han salido todos los que podían: la pelea se acaba en huida.
 * Sin nadie fuera no es una huida, es una derrota (eso lo decide quien llama).
 *
 * @param {Array<{id: any, hp?: any}>} members
 * @param {any} raw
 * @returns {boolean}
 */
export function everyoneOut(members, raw) {
    const left = readLeft(raw);
    return left.length > 0 && stillFighting(members, raw).length === 0;
}

/**
 * Lo que se dice al salir.
 *
 * @param {string} name
 * @param {number} stillIn Cuántos quedan dentro después de él.
 * @returns {string}
 */
export function leaveLine(name, stillIn) {
    const who = String(name || 'Alguien');
    return stillIn > 0
        ? `🚪 [COMBAT] ${who} sale por la salida: fuera de esta pelea. Quedan dentro ${stillIn}.`
        : `🚪 [COMBAT] ${who} sale por la salida, el último.`;
}
