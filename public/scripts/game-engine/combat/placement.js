/**
 * Colocarse antes de la pelea (tanda 10, wiki/maquetas/ENCARGO_COMBATE_VTT.md).
 *
 * Al entrar en un tablero con enemigos que os ven, la pelea empieza sola: si la pelea escrita
 * tiene otras salidas (hablar, pagar, huir, esconderse; J12.2), primero se decide; luego, antes
 * de la iniciativa, quien juega pone a los suyos en las casillas de salida. El juego ya los deja
 * en un sitio que vale; se pueden cambiar, y «Empezar» lo confirma. A los compañeros que lleva el
 * juego los coloca el juego.
 *
 * Las casillas de salida:
 * - **Al entrar**, las que el tablero trae escritas (`partyStart`) y las de alrededor: con cuatro
 *   casillas para cuatro, no habría nada que elegir.
 * - **En una emboscada** (una sala que despierta al abrir su puerta), donde está el grupo y las
 *   de alrededor: no hay tiempo de ir a otra parte.
 * - Nunca un muro, el agua honda, una salida (sería irse antes de empezar), una trampa vista ni
 *   la casilla de un enemigo o la de al lado: pegarse a él antes de la iniciativa sería un
 *   golpe gratis. La casilla en la que ya está alguien del grupo sí vale, aunque sea de esas.
 *
 * Puro: decide y explica. No mueve a nadie.
 */

import { cellKey, getCell, isPassable } from '../board/terrain.js';

/** @typedef {{x: number, y: number}} Cell */

/**
 * @typedef {Object} Placer Alguien del grupo, para colocarlo.
 * @property {string} id
 * @property {string} name
 * @property {number} x Donde está ahora.
 * @property {number} y
 * @property {boolean} [locked] Lo coloca el juego (un compañero que lleva el juego).
 */

/** @param {any} value @returns {number} */
const num = (value) => (Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0);

/** @param {any} cell @returns {Cell} */
const cellOf = (cell) => ({ x: num(cell?.x), y: num(cell?.y) });

/**
 * Cómo empieza una pelea que el grupo no ha empezado a mano.
 *
 * @param {Object} input
 * @param {number} [input.ways] Cuántas otras salidas tiene (las de `avoidFor`).
 * @param {boolean} [input.ambush] Una sala que despierta al abrir la puerta: os pillan dentro.
 * @param {boolean} [input.caught] Os han pillado huyendo o escondidos: empiezan ellos, ya.
 * @returns {{decide: boolean, place: boolean}} `decide`: antes, la decisión de novela visual;
 *   `place`: antes de la iniciativa, colocar al grupo.
 */
export function fightOpening({ ways = 0, ambush = false, caught = false } = {}) {
    return {
        decide: !ambush && !caught && Number(ways) > 0,
        place: !caught,
    };
}

/**
 * Las casillas en las que se puede poner al grupo.
 *
 * @param {Object} input
 * @param {any} input.terrain
 * @param {number} input.gridWidth
 * @param {number} input.gridHeight
 * @param {Cell[]} [input.starts] Las de salida que trae el tablero escritas.
 * @param {Cell[]} [input.party] Donde está el grupo ahora.
 * @param {Cell[]} [input.enemies] Donde están los enemigos.
 * @param {Cell[]} [input.blocked] Lo que no se pisa a sabiendas (las trampas vistas).
 * @param {boolean} [input.ambush] En una emboscada, alrededor de donde está el grupo.
 * @param {number} [input.ring] Cuántas casillas alrededor (una).
 * @returns {Cell[]}
 */
export function startCells({ terrain, gridWidth, gridHeight, starts = [], party = [], enemies = [], blocked = [], ambush = false, ring = 1 }) {
    const own = (Array.isArray(party) ? party : []).map(cellOf);
    const written = (Array.isArray(starts) ? starts : []).map(cellOf)
        .filter(c => isPassable(terrain, c.x, c.y, gridWidth, gridHeight));
    const base = ambush || written.length === 0 ? own : written;
    const foes = (Array.isArray(enemies) ? enemies : []).map(cellOf);
    const nearFoe = (/** @type {Cell} */ c) => foes.some(f => Math.max(Math.abs(f.x - c.x), Math.abs(f.y - c.y)) <= 1);
    const ownKeys = new Set(own.map(c => cellKey(c.x, c.y)));
    const avoid = new Set((Array.isArray(blocked) ? blocked : []).map(c => cellKey(num(c?.x), num(c?.y))));

    /** @type {Map<string, Cell>} */
    const out = new Map();
    const reach = Math.max(0, num(ring));
    for (const center of base) {
        for (let dy = -reach; dy <= reach; dy++) {
            for (let dx = -reach; dx <= reach; dx++) {
                const c = { x: center.x + dx, y: center.y + dy };
                const key = cellKey(c.x, c.y);
                if (out.has(key)) continue;
                if (!isPassable(terrain, c.x, c.y, gridWidth, gridHeight)) continue;
                // Donde ya está alguien del grupo vale siempre: no se le echa de su casilla.
                if (!ownKeys.has(key)) {
                    if (foes.some(f => f.x === c.x && f.y === c.y) || nearFoe(c)) continue;
                    if (avoid.has(key)) continue;
                    if (getCell(terrain, c.x, c.y).type === 'exit') continue;
                }
                out.set(key, c);
            }
        }
    }
    // De arriba abajo y de izquierda a derecha: el orden en que se reparten.
    return [...out.values()].sort((a, b) => a.y - b.y || a.x - b.x);
}

/**
 * Dónde empieza cada uno si nadie lo cambia: donde está, si es una casilla de salida y no la
 * comparte; si no, la casilla libre más cercana. Primero los que ya están bien, para que nadie
 * pierda la suya por el orden.
 *
 * @param {Object} input
 * @param {Placer[]} input.members
 * @param {Cell[]} input.cells Las de `startCells`.
 * @returns {Record<string, Cell>}
 */
export function defaultPlacement({ members, cells }) {
    const allowed = new Map((Array.isArray(cells) ? cells : []).map(c => [cellKey(c.x, c.y), cellOf(c)]));
    /** @type {Record<string, Cell>} */
    const placed = {};
    const taken = new Set();
    const list = Array.isArray(members) ? members : [];
    for (const member of list) {
        const key = cellKey(member.x, member.y);
        if (allowed.has(key) && !taken.has(key)) {
            placed[String(member.id)] = /** @type {Cell} */ (allowed.get(key));
            taken.add(key);
        }
    }
    for (const member of list) {
        if (placed[String(member.id)]) continue;
        const free = [...allowed.entries()].filter(([key]) => !taken.has(key))
            .sort(([, a], [, b]) => distance(a, member) - distance(b, member) || a.y - b.y || a.x - b.x)[0];
        if (!free) continue;
        placed[String(member.id)] = free[1];
        taken.add(free[0]);
    }
    return placed;
}

/**
 * @param {Cell} a
 * @param {{x: number, y: number}} b
 * @returns {number}
 */
function distance(a, b) {
    return Math.max(Math.abs(a.x - num(b.x)), Math.abs(a.y - num(b.y)));
}

/**
 * Poner a alguien en otra casilla de salida.
 *
 * Si en esa casilla está otro de los tuyos, se cambian el sitio; con alguien que coloca el
 * juego, no.
 *
 * @param {Object} input
 * @param {Record<string, Cell>} input.placement
 * @param {string} input.id
 * @param {Cell} input.to
 * @param {Cell[]} input.cells
 * @param {Placer[]} [input.members] Para saber quién lo coloca el juego y cómo se llama.
 * @returns {{ok: boolean, placement: Record<string, Cell>, reason: string, swapped: string}}
 */
export function placeMember({ placement, id, to, cells, members = [] }) {
    const current = { ...(placement ?? {}) };
    const key = String(id);
    const target = cellOf(to);
    const who = (Array.isArray(members) ? members : []).find(m => String(m.id) === key);
    if (who?.locked) return { ok: false, placement: current, reason: `A ${who.name} lo coloca el juego.`, swapped: '' };
    const allowed = (Array.isArray(cells) ? cells : []).some(c => num(c.x) === target.x && num(c.y) === target.y);
    if (!allowed) return { ok: false, placement: current, reason: 'Ahí no se puede empezar: elige una casilla encendida.', swapped: '' };
    const from = current[key];
    const other = Object.entries(current).find(([otherId, c]) => otherId !== key && c.x === target.x && c.y === target.y)?.[0] ?? '';
    if (other) {
        const otherWho = (Array.isArray(members) ? members : []).find(m => String(m.id) === other);
        if (otherWho?.locked) return { ok: false, placement: current, reason: `Ahí está ${otherWho.name}, y a ${otherWho.name} lo coloca el juego.`, swapped: '' };
        if (!from) return { ok: false, placement: current, reason: 'Esa casilla ya está ocupada.', swapped: '' };
        current[other] = from;
    }
    current[key] = target;
    return { ok: true, placement: current, reason: '', swapped: other };
}

/**
 * Lo que dice la barra de colocar, en una línea.
 *
 * @param {Object} input
 * @param {boolean} [input.ambush]
 * @param {string} [input.selected] El nombre del elegido.
 * @param {boolean} [input.touch] Si se juega con el dedo.
 * @returns {string}
 */
export function placementHint({ ambush = false, selected = '', touch = false } = {}) {
    const lead = ambush ? '¡Emboscada! Colocaos donde estáis.' : 'Colocad al grupo antes de la iniciativa.';
    const how = touch ? 'Toca a uno de los tuyos y luego una casilla azul.' : 'Pulsa a uno de los tuyos y luego una casilla azul (o arrástralo).';
    return selected ? `${lead} ${selected}: elige su casilla.` : `${lead} ${how}`;
}
