/**
 * Moverse fuera de combate con un clic, y el grupo junto (J12.4 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * Fuera de combate se arrastraba ficha a ficha (`walk.js`): para cruzar una sala con cuatro
 * había que hacer cuatro viajes. Aquí se pulsa una casilla y **va el grupo entero**: quien
 * abre la marcha (el primero de la formación, J7.4) va hasta allí por el camino más corto, y
 * los demás le siguen y se colocan a su alrededor, **detrás de él** según de dónde venís, en
 * el orden de la formación. Nadie atraviesa muros ni se sube encima de otro.
 *
 * - Quien no puede andar (atado, inconsciente) se queda donde está, y se dice.
 * - Quien no tiene camino hasta el grupo (una puerta cerrada entre medias) también.
 * - La marcha **se para** donde quien llama diga: al ver a alguien esperando, al pisar una
 *   trampa ya vista, al entrar en una sala nueva (`stopAt`). Así no se cruza el mapa entero
 *   sin enterarse de nada.
 * - Con `maxFeet`, se anda como mucho eso de una vez (el trecho de `walk.js`, si se quiere).
 *
 * Y para que se vea andar, `walkFrames` da los pasos de cada uno, casilla a casilla.
 *
 * Puro: planea y explica. No mueve a nadie.
 */

import { findPath, getPathCost } from './pathfinding.js';
import { cellKey, isPassable } from './terrain.js';
import { canWalk } from './walk.js';

/** Lo que mide una casilla, como en el resto del motor. */
const FEET_PER_CELL = 5;

/** Hasta dónde se buscan sitios para los que siguen, alrededor de quien abre la marcha. */
export const GATHER_RADIUS = 4;

/**
 * @typedef {Object} Walker
 * @property {any} id
 * @property {string} name
 * @property {number} x
 * @property {number} y
 * @property {number} [hp]
 * @property {number} [speed]
 * @property {string[]} [activeConditions]
 */

/**
 * @typedef {Object} GroupStep
 * @property {string} id
 * @property {string} name
 * @property {{x: number, y: number}} from
 * @property {{x: number, y: number}} to
 * @property {Array<{x: number, y: number}>} path Con la casilla de salida y la de llegada.
 */

/**
 * @typedef {Object} GroupPlan
 * @property {boolean} allowed
 * @property {string} reason Por qué no, si no.
 * @property {string} leader El id de quien abre la marcha.
 * @property {Array<{x: number, y: number}>} path El camino de quien abre la marcha.
 * @property {number} costFeet Lo que anda quien abre la marcha.
 * @property {GroupStep[]} moves Lo que anda cada uno (los que se mueven).
 * @property {Array<{id: string, name: string, reason: string}>} stayed Los que se quedan, y por qué.
 * @property {string} stopped Si la marcha se paró antes, por qué.
 */

/** @param {any} value @returns {number} */
const num = (value) => (Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0);

/**
 * El orden de la marcha: el de la formación, y detrás los que no están en ella.
 *
 * @param {Walker[]} members
 * @param {any[]} [order]
 * @returns {Walker[]}
 */
export function marchOrder(members, order = []) {
    const list = Array.isArray(members) ? members.filter(Boolean) : [];
    const rank = new Map((Array.isArray(order) ? order : []).map((id, index) => [String(id), index]));
    return list
        .map((member, index) => ({ member, index }))
        .sort((a, b) => (rank.get(String(a.member.id)) ?? 1000 + a.index) - (rank.get(String(b.member.id)) ?? 1000 + b.index))
        .map(entry => entry.member);
}

/**
 * Los sitios para los que siguen: las casillas libres alrededor de la llegada, las de detrás
 * primero (según de dónde se viene) y las más cercanas antes.
 *
 * @param {Object} input
 * @param {{x: number, y: number}} input.end
 * @param {{x: number, y: number}} input.from De dónde viene quien abre la marcha (la casilla anterior).
 * @param {any} input.terrain
 * @param {number} input.gridWidth
 * @param {number} input.gridHeight
 * @param {Set<string>} input.blocked
 * @returns {Array<{x: number, y: number}>}
 */
export function gatherCells({ end, from, terrain, gridWidth, gridHeight, blocked }) {
    const dx = Math.sign(num(end.x) - num(from.x));
    const dy = Math.sign(num(end.y) - num(from.y));
    /** @type {Map<string, number>} */
    const steps = new Map([[cellKey(end.x, end.y), 0]]);
    const queue = [{ x: end.x, y: end.y }];
    /** @type {Array<{x: number, y: number, steps: number}>} */
    const found = [];
    while (queue.length > 0) {
        const cell = /** @type {{x: number, y: number}} */ (queue.shift());
        const here = steps.get(cellKey(cell.x, cell.y)) ?? 0;
        if (here >= GATHER_RADIUS) continue;
        for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            const x = cell.x + sx;
            const y = cell.y + sy;
            const key = cellKey(x, y);
            if (steps.has(key) || blocked.has(key)) continue;
            if (!isPassable(terrain, x, y, gridWidth, gridHeight)) continue;
            // Sin colarse entre dos muros que se tocan en la esquina, como al andar.
            if (sx !== 0 && sy !== 0 && (!isPassable(terrain, cell.x + sx, cell.y, gridWidth, gridHeight) || !isPassable(terrain, cell.x, cell.y + sy, gridWidth, gridHeight))) continue;
            steps.set(key, here + 1);
            queue.push({ x, y });
            found.push({ x, y, steps: here + 1 });
        }
    }
    // Detrás es lo que queda a la espalda de quien llega: el producto con la dirección, negativo.
    const behind = (/** @type {{x: number, y: number}} */ c) => (c.x - end.x) * dx + (c.y - end.y) * dy;
    return found
        .sort((a, b) => a.steps - b.steps || behind(a) - behind(b) || a.y - b.y || a.x - b.x)
        .map(({ x, y }) => ({ x, y }));
}

/**
 * Llevar al grupo a una casilla.
 *
 * @param {Object} input
 * @param {Walker[]} input.members Los del grupo en este tablero.
 * @param {{x: number, y: number}} input.to
 * @param {any} input.terrain
 * @param {number} input.gridWidth
 * @param {number} input.gridHeight
 * @param {any[]} [input.order] Los ids en el orden de la formación.
 * @param {Array<{x: number, y: number}>} [input.blocked] Casillas con alguien que no es del grupo.
 * @param {(cell: {x: number, y: number}, index: number) => (boolean|string)} [input.stopAt] Si la
 *   marcha se para al llegar a esa casilla del camino (y por qué, si es un texto).
 * @param {number|null} [input.maxFeet] Lo más que se anda de una vez; sin nada, lo que haga falta.
 * @returns {GroupPlan}
 */
export function planGroupMove({ members, to, terrain, gridWidth, gridHeight, order = [], blocked = [], stopAt = undefined, maxFeet = null }) {
    const target = { x: num(to?.x), y: num(to?.y) };
    const ordered = marchOrder(members, order);
    /** @type {GroupPlan} */
    const plan = { allowed: false, reason: '', leader: '', path: [], costFeet: 0, moves: [], stayed: [], stopped: '' };
    if (ordered.length === 0) {
        plan.reason = 'No hay nadie del grupo en este tablero.';
        return plan;
    }
    const others = new Set((Array.isArray(blocked) ? blocked : []).map(c => cellKey(num(c?.x), num(c?.y))));
    if (!isPassable(terrain, target.x, target.y, gridWidth, gridHeight)) {
        plan.reason = 'Ahí no se puede estar: es muro, agua honda o una puerta cerrada.';
        return plan;
    }
    if (others.has(cellKey(target.x, target.y))) {
        plan.reason = 'Ahí ya hay alguien.';
        return plan;
    }

    const stuck = (/** @type {Walker} */ m) => canWalk({ name: m.name, hp: m.hp, activeConditions: m.activeConditions });
    const walkers = ordered.filter(m => stuck(m).allowed);
    for (const member of ordered.filter(m => !stuck(m).allowed)) {
        plan.stayed.push({ id: String(member.id), name: String(member.name), reason: stuck(member).reason });
    }
    if (walkers.length === 0) {
        plan.reason = plan.stayed[0]?.reason || 'Nadie puede andar ahora.';
        return plan;
    }

    // Quien abre la marcha: el primero de la formación que tenga camino hasta allí.
    // Los del grupo no se estorban entre sí (se mueven a la vez); los que se quedan, sí.
    const still = new Set(plan.stayed.map(s => {
        const m = ordered.find(o => String(o.id) === s.id);
        return m ? cellKey(num(m.x), num(m.y)) : '';
    }).filter(Boolean));
    const hard = new Set([...others, ...still]);
    /** @type {Walker|null} */
    let leader = null;
    /** @type {Array<{x: number, y: number}>|null} */
    let path = null;
    for (const member of walkers) {
        const found = findPath(terrain, num(member.x), num(member.y), target.x, target.y, gridWidth, gridHeight, { occupied: hard });
        if (found && found.length > 0) {
            leader = member;
            path = found;
            break;
        }
    }
    if (!leader || !path) {
        plan.reason = 'No hay camino hasta ahí: algo se interpone.';
        return plan;
    }

    // Donde se para: lo que diga quien llama, o el trecho, si lo hay.
    let end = path.length - 1;
    for (let i = 1; i < path.length; i++) {
        if (maxFeet != null && getPathCost(terrain, path.slice(0, i + 1)) * FEET_PER_CELL > Number(maxFeet)) {
            end = i - 1;
            plan.stopped = `Hasta aquí de una vez: se andan ${Number(maxFeet)} pies.`;
            break;
        }
        const said = typeof stopAt === 'function' ? stopAt(path[i], i) : false;
        if (said) {
            end = i;
            plan.stopped = typeof said === 'string' ? said : 'La marcha se para.';
            break;
        }
    }
    const leaderPath = path.slice(0, end + 1);
    const arrival = leaderPath[leaderPath.length - 1];
    const before = leaderPath.length > 1 ? leaderPath[leaderPath.length - 2] : { x: num(leader.x), y: num(leader.y) };

    plan.allowed = true;
    plan.leader = String(leader.id);
    plan.path = leaderPath;
    plan.costFeet = getPathCost(terrain, leaderPath) * FEET_PER_CELL;
    if (leaderPath.length > 1) {
        plan.moves.push({ id: String(leader.id), name: String(leader.name), from: { x: num(leader.x), y: num(leader.y) }, to: arrival, path: leaderPath });
    }

    // Los demás: cada uno al primer sitio libre al que tenga camino, en el orden de la marcha.
    const taken = new Set([cellKey(arrival.x, arrival.y)]);
    const spots = gatherCells({ end: arrival, from: before, terrain, gridWidth, gridHeight, blocked: hard });
    for (const member of walkers.filter(m => m !== leader)) {
        const start = { x: num(member.x), y: num(member.y) };
        let placed = false;
        for (const spot of spots) {
            const key = cellKey(spot.x, spot.y);
            if (taken.has(key)) continue;
            const route = findPath(terrain, start.x, start.y, spot.x, spot.y, gridWidth, gridHeight, { occupied: hard });
            if (!route || route.length === 0) continue;
            taken.add(key);
            placed = true;
            if (route.length > 1) plan.moves.push({ id: String(member.id), name: String(member.name), from: start, to: spot, path: route });
            break;
        }
        if (!placed) plan.stayed.push({ id: String(member.id), name: String(member.name), reason: `${member.name} no tiene camino hasta el grupo.` });
    }
    return plan;
}

/**
 * Los pasos de la marcha, para verla andar: en cada paso, dónde está cada uno. Los que siguen
 * salen un paso después que el anterior, en fila, como se anda de verdad.
 *
 * @param {GroupPlan} plan
 * @returns {Array<Array<{id: string, x: number, y: number}>>}
 */
export function walkFrames(plan) {
    const moves = Array.isArray(plan?.moves) ? plan.moves : [];
    if (moves.length === 0) return [];
    const length = Math.max(...moves.map((move, index) => move.path.length + index));
    /** @type {Array<Array<{id: string, x: number, y: number}>>} */
    const frames = [];
    for (let t = 1; t < length; t++) {
        frames.push(moves.map((move, index) => {
            const at = Math.max(0, Math.min(move.path.length - 1, t - index));
            return { id: move.id, x: move.path[at].x, y: move.path[at].y };
        }));
    }
    return frames;
}

/**
 * Lo que se enseña al pasar por encima de una casilla: el camino de quien abre la marcha y
 * lo que se anda (la forma que espera `onCellHover` del tablero).
 *
 * @param {GroupPlan} plan
 * @returns {{cells: Array<{gridX: number, gridY: number}>, feet: number, ok: boolean}|null}
 */
export function hoverOf(plan) {
    if (!plan?.allowed || plan.path.length < 2) return null;
    return { cells: plan.path.slice(1).map(c => ({ gridX: c.x, gridY: c.y })), feet: plan.costFeet, ok: true };
}

/**
 * Lo que se dice al llegar, si hace falta: quién se ha quedado y por qué se paró la marcha.
 *
 * @param {GroupPlan} plan
 * @returns {string}
 */
export function describeGroupMove(plan) {
    if (!plan?.allowed) return plan?.reason ?? '';
    const parts = [];
    if (plan.stopped) parts.push(plan.stopped);
    for (const stay of plan.stayed) parts.push(stay.reason);
    return parts.join(' ');
}
