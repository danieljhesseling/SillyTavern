/**
 * El borrador de un tablero en el taller: lo que se ve en la ficha, lo que se pinta y lo que
 * se crea (pedido por Daniel el 2026-09-28).
 *
 * Un tablero del taller nace de su forma y su tamaño, dibujado con la semilla del mundo y su
 * clave: el mismo mundo da siempre el mismo tablero. En cuanto se pinta una casilla, el mapa
 * se guarda tal cual y deja de depender de la semilla. **Lo que se ve en la ficha es lo que
 * se juega**: al crear se usa este mismo borrador, no otro tirado aparte.
 *
 * Dos cosas no se dejan romper al pintar:
 * - **El borde** es muro siempre: por ahí se saldría del mapa.
 * - **Donde empieza el grupo** tiene que ser suelo que se pueda pisar; tapar una casilla de
 *   inicio la quita. Y un grupo sin sitio donde empezar se dice.
 *
 * Los enemigos que trae escritos un tablero **no se enseñan** en el taller (Daniel, el mismo
 * día: «no quiero que los enemigos se vean en el tablero de crear mundo»). Así que se puede
 * pintar encima de ellos, y al crear se recolocan (`settleEnemies`): el que quedó en un muro
 * o encerrado pasa a la casilla libre más cercana a la que se llega.
 *
 * Puro: de un mapa y un pincel, a otro mapa. No guarda nada.
 */

import { generateBoard } from '../world-builder/dungeon-generator.js';
import { createSeededRandom } from '../combat/seeded-random.js';
import { derive } from './seed.js';
import { ASCII_TERRAIN, terrainFromAsciiMap, isPassable } from '../board/terrain.js';
import { findUnreachable } from '../board/reachability.js';

/**
 * @typedef {object} BoardDraft
 * @property {string[]} map Filas ASCII, con la leyenda de `board/terrain.js`.
 * @property {Array<{x: number, y: number}>} partyStart
 */

/** Cuántas casillas de inicio caben: las del grupo y alguien más. */
export const MAX_STARTS = 6;

/** El pincel que pone o quita dónde empieza el grupo. No es un carácter del mapa. */
export const START_BRUSH = 'start';

/** Los pinceles, en el orden en que se ofrecen. */
export const BRUSHES = [
    { id: '.', label: 'Suelo' },
    { id: '#', label: 'Muro' },
    { id: 'D', label: 'Puerta' },
    { id: 'c', label: 'Cobertura' },
    { id: 'C', label: 'Cobertura alta' },
    { id: '~', label: 'Terreno difícil' },
    { id: 'w', label: 'Agua' },
    { id: 'T', label: 'Barril' },
    { id: 'x', label: 'Salida' },
    { id: START_BRUSH, label: 'Empieza el grupo' },
];

/**
 * Cómo se llama cada casilla, para la etiqueta y el color (`data-t`).
 *
 * @type {Record<string, string>}
 */
export const CELL_NAMES = {
    '.': 'suelo', '#': 'muro', 'D': 'puerta', 'L': 'puerta', 'o': 'puerta', '~': 'dificil',
    'c': 'cobertura', 'C': 'cobertura-alta', 'v': 'sima', '>': 'escalera', 'w': 'agua', 'i': 'hielo',
    'b': 'maleza', 'T': 'barril', 'k': 'cofre', '^': 'alto', 'x': 'salida', 'P': 'palanca', '=': 'barricada',
};

/**
 * Y dicho para quien juega, al pasar por encima.
 *
 * @type {Record<string, string>}
 */
export const CELL_LABELS = {
    '.': 'Suelo', '#': 'Muro', 'D': 'Puerta', 'L': 'Puerta cerrada con llave', 'o': 'Puerta abierta',
    '~': 'Terreno difícil', 'c': 'Cobertura', 'C': 'Cobertura alta', 'v': 'Sima', '>': 'Escalera',
    'w': 'Agua', 'i': 'Hielo', 'b': 'Maleza', 'T': 'Barril', 'k': 'Cofre', '^': 'En alto', 'x': 'Salida',
    'P': 'Palanca', '=': 'Barricada',
};

/** Lo que no se puede pisar: un inicio no cae ahí, y un enemigo no se tapa con ello. */
const BLOCKED = new Set(Object.keys(ASCII_TERRAIN)
    .filter(char => !isPassable(terrainFromAsciiMap([char]), 0, 0, 1, 1)));

/**
 * @param {any} value
 * @returns {string}
 */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * @param {any} cells
 * @returns {Array<{x: number, y: number}>}
 */
function cellsOf(cells) {
    return (Array.isArray(cells) ? cells : []).map(c => ({ x: Number(c?.x) || 0, y: Number(c?.y) || 0 }));
}

/**
 * Si se puede pisar esa casilla.
 *
 * @param {string} char
 * @returns {boolean}
 */
export function walkable(char) {
    return !BLOCKED.has(char);
}

/**
 * Dibujar uno con la semilla. La clave es la del taller, que no cambia al renombrarlo; y
 * `take` cuenta las veces que se ha pedido otro.
 *
 * @param {{key: string, shape?: string, size?: string, seed?: string, take?: number}} input
 * @returns {BoardDraft}
 */
export function draftFor({ key, shape = 'rooms', size = 'medium', seed = '', take = 0 }) {
    const drawn = generateBoard({
        random: createSeededRandom(derive(seed, 'tablero', key, take > 0 ? String(take) : '')),
        shape: text(shape) || 'rooms',
        size: /** @type {any} */ (text(size) || 'medium'),
        partySize: 3,
    });
    return { map: drawn.map.map(String), partyStart: cellsOf(drawn.partyStart) };
}

/**
 * El borrador de un tablero del taller: el pintado, si se ha pintado; si no, el de la semilla.
 *
 * @param {any} board Con `id` (o la clave), `shape`, `size`, `take` y, si se pintó, `map` y `partyStart`.
 * @param {string} seed
 * @returns {BoardDraft}
 */
export function draftOf(board, seed) {
    if (Array.isArray(board?.map) && board.map.length > 0) {
        return { map: board.map.map(String), partyStart: cellsOf(board.partyStart) };
    }
    return draftFor({
        key: text(board?.id) || text(board?.name), shape: board?.shape, size: board?.size, seed,
        take: Math.max(0, Number(board?.take) || 0),
    });
}

/**
 * Pintar una casilla. Lo que no se puede pintar deja el borrador igual (el mismo objeto), así
 * que quien pinta sabe que no ha cambiado nada.
 *
 * @param {BoardDraft} draft
 * @param {number} x
 * @param {number} y
 * @param {string} brush Un carácter de la leyenda, o `START_BRUSH`.
 * @returns {BoardDraft}
 */
export function paintCell(draft, x, y, brush) {
    const map = Array.isArray(draft?.map) ? draft.map : [];
    const height = map.length;
    const width = height > 0 ? map[0].length : 0;
    // El borde no se toca: es lo que cierra el tablero.
    if (!Number.isInteger(x) || !Number.isInteger(y) || x <= 0 || y <= 0 || x >= width - 1 || y >= height - 1) return draft;

    const starts = cellsOf(draft.partyStart);
    const here = (/** @type {{x: number, y: number}} */ c) => c.x === x && c.y === y;

    if (brush === START_BRUSH) {
        if (starts.some(here)) return { map, partyStart: starts.filter(c => !here(c)) };
        if (!walkable(map[y][x]) || starts.length >= MAX_STARTS) return draft;
        return { map, partyStart: [...starts, { x, y }] };
    }

    if (CELL_NAMES[brush] === undefined || map[y][x] === brush) return draft;

    const row = map[y];
    const next = map.map((line, i) => (i === y ? `${row.slice(0, x)}${brush}${row.slice(x + 1)}` : line));
    return { map: next, partyStart: walkable(brush) ? starts : starts.filter(c => !here(c)) };
}

/**
 * Lo que impide jugarlo, o ''.
 *
 * @param {BoardDraft} draft
 * @param {{enemies?: Array<{name?: string, x: number, y: number}>}} [options]
 * @returns {string}
 */
export function draftProblem(draft, { enemies = [] } = {}) {
    const map = Array.isArray(draft?.map) ? draft.map : [];
    if (map.length === 0) return 'Está vacío.';
    const starts = cellsOf(draft.partyStart);
    if (starts.length === 0) return 'No dice dónde empieza el grupo: píntalo con «Empieza el grupo».';
    const report = findUnreachable({
        terrain: terrainFromAsciiMap(map), gridWidth: map[0].length, gridHeight: map.length, starts,
        enemies: (Array.isArray(enemies) ? enemies : []).map(e => ({ name: text(e?.name), x: Number(e?.x) || 0, y: Number(e?.y) || 0 })),
    });
    if (report.enemies.length > 0) return `A ${report.enemies[0].name || 'un enemigo'} no se llega desde donde empieza el grupo.`;
    return '';
}

/**
 * Los enemigos escritos de un tablero repintado, cada uno donde se pueda estar y llegar.
 *
 * El que sigue en suelo al que se llega se queda donde estaba. El que quedó en un muro, en una
 * puerta cerrada o encerrado pasa a la casilla libre más cercana a la que se llega desde donde
 * empieza el grupo. Sin ninguna así, se quedan como estaban: el tablero ya dice que algo falla.
 *
 * @template {{x: number, y: number}} T
 * @param {BoardDraft} draft
 * @param {T[]} enemies
 * @returns {T[]}
 */
export function settleEnemies(draft, enemies) {
    const list = Array.isArray(enemies) ? enemies : [];
    const map = Array.isArray(draft?.map) ? draft.map : [];
    const starts = cellsOf(draft?.partyStart);
    if (list.length === 0 || map.length === 0 || starts.length === 0) return list;
    const width = map[0].length;
    const height = map.length;

    const open = [];
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) if (walkable(map[y][x])) open.push({ x, y });
    }
    const lost = findUnreachable({ terrain: terrainFromAsciiMap(map), gridWidth: width, gridHeight: height, starts, cells: open }).cells;
    const key = (/** @type {{x: number, y: number}} */ c) => `${c.x},${c.y}`;
    const far = new Set(lost.map(key));
    const taken = new Set(starts.map(key));
    const good = open.filter(c => !far.has(key(c)));

    return list.map(enemy => {
        const at = { x: Number(enemy?.x) || 0, y: Number(enemy?.y) || 0 };
        const fine = good.some(c => c.x === at.x && c.y === at.y) && !taken.has(key(at));
        if (fine) {
            taken.add(key(at));
            return enemy;
        }
        const free = good.filter(c => !taken.has(key(c)));
        if (free.length === 0) return enemy;
        // La más cercana en línea recta: entre dos a la misma distancia en casillas, la de enfrente.
        const far2 = (/** @type {{x: number, y: number}} */ c) => ((c.x - at.x) ** 2) + ((c.y - at.y) ** 2);
        const nearest = free.reduce((best, c) => (far2(c) < far2(best) ? c : best));
        taken.add(key(nearest));
        return { ...enemy, x: nearest.x, y: nearest.y };
    });
}

/**
 * El tablero tal como lo guarda el mundo (`locationMaps[].boards[]`).
 *
 * @param {BoardDraft} draft
 * @param {{name: string, description?: string}} about
 * @returns {any}
 */
export function storedBoard(draft, { name, description = '' }) {
    const map = draft.map.map(String);
    return {
        name: text(name),
        description: text(description),
        url: '',
        gridWidth: map[0]?.length ?? 0,
        gridHeight: map.length,
        terrain: terrainFromAsciiMap(map),
        partyStart: cellsOf(draft.partyStart),
        enemyPlacements: [],
        objectives: [],
        isCombat: false,
        fogEnabled: false,
        npcPlacements: [],
        encounterRules: [],
    };
}
