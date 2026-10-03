/**
 * Lo que se derrumba y los mecanismos del tablero (E1.4 y E1.5 de wiki/ROADMAP_ENTRETENIDO.md).
 *
 * - **Derribar** (`H`, E1.4): una columna, un puntal o una estantería. Estando al lado, con la
 *   acción, una prueba de Fuerza (Atletismo) CD 10; si sale, cae hacia el lado contrario al que
 *   empuja, sobre las dos casillas de detrás. Quien está debajo hace una salvación de Destreza
 *   CD 12: si falla, 1d10 de daño contundente y queda derribado; si la pasa, la mitad y de pie.
 *   Es cosecha propia, como regla de máster: el 1d10 es el de «le cae una estantería encima» de la
 *   tabla de daño improvisado de la Guía del máster. Donde cae quedan escombros (terreno difícil).
 * - **Las estatuas y las gemas** (`S` y `g`, E1.5): las gemas están en pedestales por el tablero;
 *   se cogen estando al lado y se ponen en las manos de las estatuas. Con todas puestas, se abren
 *   las puertas con llave del tablero.
 * - **Las runas en orden** (`1` a `5`): se pisan de la 1 en adelante. Pisar una que no toca las
 *   apaga todas y da un chispazo (1d4 de rayo). Con todas encendidas, se abren las puertas con llave.
 * - **Las palancas emparejadas** (`p`): hay que bajarlas a la vez. En combate, en la misma ronda;
 *   fuera de él, con alguien al lado de cada una. Con todas bajadas, se abren las puertas con llave.
 *
 * Puro: recibe el terreno y devuelve el nuevo; los dados y lo que se dice los pone quien llama.
 */

import { getCell, setCell, isPassable, normalizeTerrain, cellKey, parseCellKey } from './terrain.js';
import { pullLever } from './interactables.js';

/** E1.4: derribar una columna o una estantería. */
export const TOPPLE = { checkDc: 10, damage: '1d10', saveDc: 12, reach: 2 };

/** E1.5: el chispazo de la runa que no toca. */
export const RUNE_ZAP = '1d4';

/** Las casillas de mecanismo que se pulsan estando al lado. */
const TOUCHED = new Set(['topple', 'statue', 'gem', 'lever_pair']);

/**
 * Qué mecanismo hay en una casilla que se pulsa, si alguno.
 *
 * @param {any} terrain
 * @param {number} x
 * @param {number} y
 * @returns {'topple'|'statue'|'gem'|'lever_pair'|''}
 */
export function mechanismAt(terrain, x, y) {
    const type = String(getCell(terrain, Math.trunc(Number(x) || 0), Math.trunc(Number(y) || 0))?.type ?? '');
    return TOUCHED.has(type) ? /** @type {'topple'|'statue'|'gem'|'lever_pair'} */ (type) : '';
}

/**
 * Las casillas de un tipo, con su estado, en orden de lectura.
 *
 * @param {any} terrain
 * @param {string} type
 * @returns {Array<{x: number, y: number, order: number, on: boolean, round: number}>}
 */
export function cellsOfType(terrain, type) {
    return Object.entries(normalizeTerrain(terrain).cells)
        .filter(([, cell]) => cell.type === type)
        .map(([key, cell]) => {
            const at = /** @type {{x: number, y: number}} */ (parseCellKey(key));
            return { x: at.x, y: at.y, order: Number(cell.order) || 0, on: Boolean(cell.on), round: Number(cell.round) || 0 };
        })
        .sort((a, b) => a.y - b.y || a.x - b.x);
}

// ── E1.4: derribar ───────────────────────────────────────────────────────────

/**
 * Hacia dónde cae lo que se empuja y sobre qué casillas: las dos de detrás, en la línea de quien
 * empuja, hasta la primera que no se pisa (un muro, otra columna).
 *
 * @param {Object} input
 * @param {any} input.terrain
 * @param {{x: number, y: number}} input.from Quien empuja.
 * @param {{x: number, y: number}} input.at Lo que se empuja.
 * @param {number} input.width
 * @param {number} input.height
 * @returns {Array<{x: number, y: number}>}
 */
export function toppleCells({ terrain, from, at, width, height }) {
    const dx = Math.sign(Number(at?.x) - Number(from?.x));
    const dy = Math.sign(Number(at?.y) - Number(from?.y));
    if (!dx && !dy) return [];
    /** @type {Array<{x: number, y: number}>} */
    const cells = [];
    for (let step = 1; step <= TOPPLE.reach; step++) {
        const cell = { x: Number(at.x) + dx * step, y: Number(at.y) + dy * step };
        if (!isPassable(terrain, cell.x, cell.y, width, height)) break;
        cells.push(cell);
    }
    return cells;
}

/**
 * El tablero después de caer: escombros (terreno difícil) donde estaba y en el suelo donde cae.
 * Lo que no es suelo (el agua, una runa, el barro) se queda como estaba.
 *
 * @param {any} terrain
 * @param {{x: number, y: number}} at
 * @param {Array<{x: number, y: number}>} cells
 * @returns {any}
 */
export function toppleTerrain(terrain, at, cells) {
    let next = setCell(terrain, at.x, at.y, 'difficult');
    for (const cell of cells) {
        if (getCell(next, cell.x, cell.y).type === 'floor') next = setCell(next, cell.x, cell.y, 'difficult');
    }
    return next;
}

/**
 * Lo que le pasa a quien está debajo: con la salvación fallada, todo el daño y al suelo; pasada,
 * la mitad y de pie.
 *
 * @param {{rolled: number, saved: boolean}} input
 * @returns {{damage: number, prone: boolean}}
 */
export function crushed({ rolled, saved }) {
    const damage = Math.max(0, Math.trunc(Number(rolled) || 0));
    return saved ? { damage: Math.floor(damage / 2), prone: false } : { damage, prone: true };
}

// ── E1.5: las gemas y las estatuas ───────────────────────────────────────────

/**
 * Coger la gema de un pedestal: el pedestal queda vacío (suelo).
 *
 * @param {any} terrain
 * @param {number} x
 * @param {number} y
 * @returns {{terrain: any, taken: boolean}}
 */
export function takeGem(terrain, x, y) {
    if (getCell(terrain, x, y).type !== 'gem') return { terrain: normalizeTerrain(terrain), taken: false };
    return { terrain: setCell(terrain, x, y, 'floor'), taken: true };
}

/**
 * Poner una gema en una estatua. Con la última, se abren las puertas con llave.
 *
 * @param {any} terrain
 * @param {number} x
 * @param {number} y
 * @returns {{terrain: any, placed: boolean, left: number, solved: boolean, opened: Array<{x: number, y: number}>}}
 */
export function placeGem(terrain, x, y) {
    const cell = getCell(terrain, x, y);
    if (cell.type !== 'statue' || cell.on) {
        return { terrain: normalizeTerrain(terrain), placed: false, left: cellsOfType(terrain, 'statue').filter(s => !s.on).length, solved: false, opened: [] };
    }
    let next = setCell(terrain, x, y, 'statue', { on: true });
    const left = cellsOfType(next, 'statue').filter(s => !s.on).length;
    /** @type {Array<{x: number, y: number}>} */
    let opened = [];
    if (left === 0) {
        const pulled = pullLever(next);
        next = pulled.terrain;
        opened = pulled.opened;
    }
    return { terrain: next, placed: true, left, solved: left === 0, opened };
}

// ── E1.5: las runas en orden ─────────────────────────────────────────────────

/**
 * Pisar las casillas de un camino: la runa que toca se enciende; una que no toca las apaga
 * todas (y deja de contar el resto del camino: un chispazo por paseo). Con todas encendidas,
 * se abren las puertas con llave. Una vez resuelto, las runas ya no hacen nada.
 *
 * @param {any} terrain
 * @param {Array<{x: number, y: number}>} steps Las casillas pisadas, sin la de salida.
 * @returns {{terrain: any, lit: Array<{x: number, y: number, order: number}>, wrong: {x: number, y: number, order: number, expected: number}|null, solved: boolean, next: number, total: number, opened: Array<{x: number, y: number}>}}
 */
export function stepRunes(terrain, steps) {
    let next = normalizeTerrain(terrain);
    const all = cellsOfType(next, 'rune');
    const total = all.length;
    /** @type {Array<{x: number, y: number, order: number}>} */
    const lit = [];
    const unlitOrder = (/** @type {any} */ t) => {
        const left = cellsOfType(t, 'rune').filter(r => !r.on).map(r => r.order);
        return left.length > 0 ? Math.min(...left) : 0;
    };
    const done = { terrain: next, lit, wrong: null, solved: false, next: unlitOrder(next), total, opened: [] };
    if (total === 0 || all.every(r => r.on)) return done;
    for (const step of Array.isArray(steps) ? steps : []) {
        const cell = getCell(next, step.x, step.y);
        if (cell.type !== 'rune' || cell.on) continue;
        const expected = unlitOrder(next);
        const order = Number(cell.order) || 0;
        if (order === expected) {
            next = setCell(next, step.x, step.y, 'rune', { order, on: true });
            lit.push({ x: step.x, y: step.y, order });
            if (unlitOrder(next) === 0) {
                const pulled = pullLever(next);
                return { terrain: pulled.terrain, lit, wrong: null, solved: true, next: 0, total, opened: pulled.opened };
            }
            continue;
        }
        // La que no toca: se apagan todas.
        for (const rune of cellsOfType(next, 'rune')) next = setCell(next, rune.x, rune.y, 'rune', { order: rune.order });
        return { terrain: next, lit: [], wrong: { x: step.x, y: step.y, order, expected }, solved: false, next: unlitOrder(next), total, opened: [] };
    }
    return { terrain: next, lit, wrong: null, solved: false, next: unlitOrder(next), total, opened: [] };
}

// ── Para quien escribe el paquete ────────────────────────────────────────────

/**
 * Los avisos de un mapa con mecanismos que no se pueden resolver o no abren nada: estatuas sin
 * gemas suficientes, runas sin la 1 o con huecos, una palanca doble sola, o ninguna puerta con
 * llave que abrir.
 *
 * @param {string[]} map
 * @returns {string[]}
 */
export function puzzleWarnings(map) {
    const chars = (Array.isArray(map) ? map : []).join('');
    const count = (/** @type {string} */ c) => [...chars].filter(ch => ch === c).length;
    /** @type {string[]} */
    const out = [];
    const statues = count('S');
    const gems = count('g');
    if (statues > 0 && gems < statues) out.push(`Hay ${statues} estatua(s) (S) y ${gems} gema(s) (g): sin una gema para cada estatua, no se abre.`);
    if (gems > 0 && statues === 0) out.push('Hay gemas (g) pero ninguna estatua (S) donde ponerlas.');
    const orders = ['1', '2', '3', '4', '5'].filter(c => chars.includes(c)).map(Number);
    if (orders.length > 0 && orders.some((order, at) => order !== at + 1)) out.push(`Las runas tienen que ir de la 1 seguidas, sin saltarse ninguna; hay: ${orders.join(', ')}.`);
    if (orders.length === 1) out.push('Una sola runa (1) no es un orden: pon al menos la 1 y la 2.');
    if (count('p') === 1) out.push('Hay una sola palanca doble (p): hacen falta dos.');
    const puzzle = statues > 0 || orders.length > 0 || count('p') > 0;
    if (puzzle && !chars.includes('L')) out.push('Hay un mecanismo (estatuas, runas o palancas dobles) pero ninguna puerta con llave (L) que abra.');
    return out;
}

// ── E1.5: las palancas emparejadas ───────────────────────────────────────────

/**
 * Si cada una de las otras palancas emparejadas tiene al lado a alguien que no es quien tira.
 *
 * @param {Object} input
 * @param {any} input.terrain
 * @param {{x: number, y: number}} input.at La palanca de quien tira.
 * @param {string} input.actorId
 * @param {Array<{id: string, x: number, y: number}>} input.people
 * @returns {boolean}
 */
export function pairedLeversManned({ terrain, at, actorId, people }) {
    const others = cellsOfType(terrain, 'lever_pair').filter(l => cellKey(l.x, l.y) !== cellKey(at.x, at.y));
    if (others.length === 0) return false;
    const near = (/** @type {{x: number, y: number}} */ a, /** @type {{x: number, y: number}} */ b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) === 1;
    return others.every(lever => (Array.isArray(people) ? people : [])
        .some(p => String(p.id) !== String(actorId) && near(p, lever)));
}

/**
 * Bajar una palanca emparejada. En combate (`round` > 0) se queda bajada esa ronda; si todas
 * están bajadas en la misma ronda, se abre. Fuera de combate se abre si las otras tienen a
 * alguien al lado (`manned`), que tira a la vez.
 *
 * @param {any} terrain
 * @param {number} x
 * @param {number} y
 * @param {{round?: number, manned?: boolean}} [options]
 * @returns {{terrain: any, solved: boolean, already: boolean, waiting: number, opened: Array<{x: number, y: number}>}}
 */
export function pullPairedLever(terrain, x, y, { round = 0, manned = false } = {}) {
    let next = normalizeTerrain(terrain);
    const levers = cellsOfType(next, 'lever_pair');
    if (getCell(next, x, y).type !== 'lever_pair') return { terrain: next, solved: false, already: false, waiting: 0, opened: [] };
    if (levers.some(l => l.on)) return { terrain: next, solved: false, already: true, waiting: 0, opened: [] };
    const now = Math.max(0, Math.trunc(Number(round) || 0));
    let solved = false;
    if (now > 0) {
        next = setCell(next, x, y, 'lever_pair', { round: now });
        solved = cellsOfType(next, 'lever_pair').every(l => l.round === now);
    } else {
        solved = Boolean(manned);
    }
    if (!solved) {
        const waiting = now > 0 ? cellsOfType(next, 'lever_pair').filter(l => l.round !== now).length : levers.length - 1;
        return { terrain: next, solved: false, already: false, waiting, opened: [] };
    }
    for (const lever of cellsOfType(next, 'lever_pair')) next = setCell(next, lever.x, lever.y, 'lever_pair', { on: true });
    const pulled = pullLever(next);
    return { terrain: pulled.terrain, solved: true, already: false, waiting: 0, opened: pulled.opened };
}
