/**
 * Las formas en la cuadrícula: a quién toca una habilidad de área (R3 del roadmap de
 * profundidad).
 *
 * Hasta ahora todo era a un solo objetivo, aunque el tablero es una cuadrícula que pide
 * áreas. Cuatro formas, medidas en pies como todo lo demás:
 *
 * - **a uno** (`single`): lo de siempre.
 * - **radio** (`radius`): todo lo que hay a esa distancia del punto elegido, si el punto lo
 *   ve (una pared corta la explosión).
 * - **línea** (`line`): desde quien la lanza hacia el punto, tan larga como dice, y se para
 *   en la primera pared.
 * - **cono** (`cone`): desde quien la lanza, abriéndose hacia el punto en un ángulo recto.
 *
 * El área **no distingue bandos**: lo que cae dentro, cae. Es lo que hace que colocarse
 * importe, y que un compañero pegado al enemigo sea un problema antes de lanzar.
 *
 * Puro: casillas y quién está en ellas. Lo que pasa a cada uno lo decide la habilidad.
 *
 * Ver wiki/ROADMAP_PROFUNDIDAD.md, R3.
 */

import { blocksSight, isInsideGrid } from '../board/terrain.js';
import { getRayCells, hasLineOfSight } from '../board/line-of-sight.js';

/** Las formas, en vocabulario cerrado. */
export const AREA_SHAPES = ['single', 'radius', 'line', 'cone'];

/** Cómo se llama cada una para quien juega. */
export const AREA_LABELS = {
    single: 'a uno',
    radius: 'en radio',
    line: 'en línea',
    cone: 'en cono',
};

/** Pies por casilla, como en el resto del motor. */
const FEET_PER_CELL = 5;

/**
 * @typedef {Object} Area
 * @property {'single'|'radius'|'line'|'cone'} shape
 * @property {number} size En pies: el radio, el largo de la línea o del cono.
 */

/**
 * Un área leída con tolerancia. Lo que no dice forma es a uno.
 *
 * @param {any} raw
 * @returns {Area}
 */
export function readArea(raw) {
    const source = (raw && typeof raw === 'object') ? raw : {};
    const shape = AREA_SHAPES.includes(String(source.shape)) ? /** @type {Area['shape']} */ (String(source.shape)) : 'single';
    const fallback = shape === 'radius' ? 10 : shape === 'single' ? 0 : 15;
    const size = Math.max(0, Math.floor(Number(source.size) || fallback));
    return { shape, size: shape === 'single' ? 0 : Math.max(FEET_PER_CELL, size) };
}

/**
 * Si un área toca a más de uno.
 *
 * @param {any} area
 * @returns {boolean}
 */
export function isArea(area) {
    return readArea(area).shape !== 'single';
}

/**
 * @param {{x: number, y: number}} a
 * @param {{x: number, y: number}} b
 * @returns {number}
 */
function chebyshev(a, b) {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * Las casillas que toca un área.
 *
 * @param {Object} input
 * @param {any} input.area
 * @param {{x: number, y: number}} input.origin Dónde está quien la lanza.
 * @param {{x: number, y: number}} input.aim El punto elegido (el objetivo).
 * @param {any} [input.terrain]
 * @param {number} [input.width]
 * @param {number} [input.height]
 * @returns {Array<{x: number, y: number}>}
 */
export function areaCells({ area, origin, aim, terrain = null, width = 50, height = 50 }) {
    const { shape, size } = readArea(area);
    const reach = Math.max(1, Math.floor(size / FEET_PER_CELL));
    const inside = (/** @type {number} */ x, /** @type {number} */ y) => isInsideGrid(x, y, width, height);
    const open = (/** @type {number} */ x, /** @type {number} */ y) => !terrain || !blocksSight(terrain, x, y);
    const from = { x: Math.trunc(origin.x), y: Math.trunc(origin.y) };
    const to = { x: Math.trunc(aim.x), y: Math.trunc(aim.y) };

    if (shape === 'single') return inside(to.x, to.y) ? [to] : [];

    /** @type {Array<{x: number, y: number}>} */
    const out = [];
    if (shape === 'radius') {
        for (let y = to.y - reach; y <= to.y + reach; y++) {
            for (let x = to.x - reach; x <= to.x + reach; x++) {
                if (!inside(x, y) || !open(x, y)) continue;
                // Una pared entre el centro y la casilla la protege.
                if (terrain && !hasLineOfSight(terrain, to.x, to.y, x, y)) continue;
                out.push({ x, y });
            }
        }
        return out;
    }

    if (from.x === to.x && from.y === to.y) return [];

    if (shape === 'line') {
        // Se alarga el rayo hasta su largo, y se corta en la primera pared.
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const steps = Math.max(Math.abs(dx), Math.abs(dy));
        const far = { x: from.x + Math.round((dx / steps) * reach), y: from.y + Math.round((dy / steps) * reach) };
        for (const cell of [...getRayCells(from.x, from.y, far.x, far.y), far]) {
            if (chebyshev(from, cell) > reach) break;
            if (!inside(cell.x, cell.y) || !open(cell.x, cell.y)) break;
            out.push(cell);
        }
        return out;
    }

    // El cono: dentro del alcance y a 45 grados o menos de la dirección elegida.
    const dir = Math.atan2(to.y - from.y, to.x - from.x);
    for (let y = from.y - reach; y <= from.y + reach; y++) {
        for (let x = from.x - reach; x <= from.x + reach; x++) {
            if ((x === from.x && y === from.y) || !inside(x, y) || !open(x, y)) continue;
            let gap = Math.abs(Math.atan2(y - from.y, x - from.x) - dir);
            if (gap > Math.PI) gap = 2 * Math.PI - gap;
            if (gap > Math.PI / 4 + 1e-9) continue;
            if (terrain && !hasLineOfSight(terrain, from.x, from.y, x, y)) continue;
            out.push({ x, y });
        }
    }
    return out;
}

/**
 * Quién cae dentro: de una lista de criaturas con su casilla, las que están en el área.
 *
 * @template {{x: number, y: number}} T
 * @param {Array<{x: number, y: number}>} cells
 * @param {T[]} creatures
 * @returns {T[]}
 */
export function creaturesIn(cells, creatures) {
    const keys = new Set(cells.map(c => `${c.x},${c.y}`));
    return (Array.isArray(creatures) ? creatures : []).filter(c => keys.has(`${Math.trunc(c.x)},${Math.trunc(c.y)}`));
}

/**
 * El área en pocas palabras: «cono de 15 ft».
 *
 * @param {any} area
 * @returns {string}
 */
export function describeArea(area) {
    const { shape, size } = readArea(area);
    if (shape === 'single') return '';
    const name = shape === 'radius' ? 'radio' : shape === 'line' ? 'línea' : 'cono';
    return `${name} de ${size} ft`;
}
