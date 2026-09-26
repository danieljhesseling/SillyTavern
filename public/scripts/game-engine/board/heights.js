/**
 * La altura en el tablero: quien pelea desde arriba, pega mejor (B1 de wiki/LO_QUE_FALTA.md).
 *
 * El guion de 1387 lo pedía cuatro veces con otras palabras: las torres desde las que se
 * dispara, los escalones, la empalizada, «pelear en escalones da ventaja por altura». Aquí
 * es una sola regla, para los dos bandos y para cualquier arma: **desde una casilla alta
 * contra una que no lo es, ventaja**. Subir cuesta, eso sí: la casilla alta se paga doble al
 * entrar, como el terreno difícil (lo dice su definición en `terrain.js`).
 *
 * Puro: lee el terreno y dice. Quién lo aprovecha lo decide quien llama (`attackEdge`, la
 * IA que busca sitio, el generador que pone los parapetos).
 */

import { getCell } from './terrain.js';

/** El tipo de terreno que es «arriba». */
export const HIGH = 'high';

/**
 * Si una casilla está en alto.
 *
 * @param {any} terrain
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function isHigh(terrain, x, y) {
    if (!terrain) return false;
    return getCell(terrain, Math.trunc(Number(x) || 0), Math.trunc(Number(y) || 0))?.type === HIGH;
}

/**
 * Cómo está quien ataca respecto a quien recibe.
 *
 * @param {any} terrain
 * @param {{x: number, y: number}} from Quien ataca.
 * @param {{x: number, y: number}} to   Quien recibe.
 * @returns {'above'|'below'|'level'}
 */
export function heightBetween(terrain, from, to) {
    const up = isHigh(terrain, from?.x, from?.y);
    const down = isHigh(terrain, to?.x, to?.y);
    if (up && !down) return 'above';
    if (down && !up) return 'below';
    return 'level';
}

/**
 * La razón que entra en la tirada, o nada. Solo arriba cuenta: estar abajo no estorba más
 * que no tener la altura, y una regla que castiga dos veces se nota injusta.
 *
 * @param {'above'|'below'|'level'|string} height
 * @returns {string}
 */
export function heightReason(height) {
    return height === 'above' ? 'ataca desde arriba' : '';
}

/**
 * Las casillas altas de un tablero, para quien busca dónde ponerse (el tirador de R7).
 *
 * @param {any} terrain
 * @returns {Array<{x: number, y: number}>}
 */
export function highCells(terrain) {
    const cells = terrain?.cells && typeof terrain.cells === 'object' ? terrain.cells : {};
    return Object.entries(cells)
        .filter(([, cell]) => /** @type {any} */ (cell)?.type === HIGH)
        .map(([key]) => {
            const [x, y] = key.split(',').map(Number);
            return { x, y };
        })
        .filter(cell => Number.isFinite(cell.x) && Number.isFinite(cell.y));
}

/**
 * Cuánto le gusta una casilla a quien pelea: la altura es media cobertura para el tirador,
 * y nada para quien va cuerpo a cuerpo (que la pagaría al subir sin sacarle partido).
 *
 * @param {any} terrain
 * @param {{x: number, y: number}} cell
 * @param {boolean} ranged
 * @returns {number}
 */
export function heightScore(terrain, cell, ranged) {
    return ranged && isHigh(terrain, cell?.x, cell?.y) ? 3 : 0;
}
