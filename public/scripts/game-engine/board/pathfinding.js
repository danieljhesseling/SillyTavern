/**
 * A* pathfinding over the board terrain.
 *
 * Movement is eight-directional with Chebyshev distance, matching the rest of the engine:
 * a diagonal step costs the same as a straight one, as in D&D 5e's default rule. The
 * heuristic is therefore Chebyshev distance, which is admissible because the cheapest
 * possible step costs 1.
 *
 * Difficult ground costs 2 per cell entered. Walls and closed doors are impassable, and so
 * are cells occupied by another creature.
 *
 * Corner cutting is disallowed by default: a diagonal step between two walls that touch at
 * the corner is not legal. Allowing it lets creatures slip through sealed diagonal walls,
 * which players read as a bug.
 *
 * Pure module. Depends on the terrain leaf, and on `heights.js` for the cliffs of a board
 * with elevations (J12.10), which travel on the terrain itself (`withOverlay`).
 *
 * Tanda 8: el fuego a la vista (`hotCells` del terreno, `withOverlay`) se rodea como una trampa
 * ya vista: si hay un camino sin fuego, se va por él aunque sea más largo; solo si no lo hay se
 * cruza. Una casilla que arde se puede elegir como destino: quien quiera pasar por las llamas
 * pisa primero la que arde. Lo que se enciende al mover (`getReachableCells`) sigue la misma
 * regla, así que lo encendido es lo que luego se anda.
 *
 * Tanda 10 (wiki/maquetas/ENCARGO_COMBATE_VTT.md):
 * - **Las diagonales**, con la regla opcional de 5e (`DIAGONAL_RULE`): la primera cuesta 5 pies,
 *   la segunda 10, la tercera 5… Por eso la búsqueda lleva, además de la casilla, si la próxima
 *   diagonal es de las que cuestan el doble.
 * - **El camino más recto.** Entre dos caminos que cuestan lo mismo, el que tiene menos giros; y
 *   entre esos, el que va más cerca de la línea recta. Antes, a igual precio, salía el primero
 *   que encontraba la búsqueda, y la ruta hacia el ratero del muelle hacía eses.
 *
 * See wiki/ROADMAP.md, Fase A (A4).
 */

import { cellKey, getMovementCost, isPassable } from './terrain.js';
import { canStepBetween, isCliff } from './heights.js';

/**
 * Tanda 10: la regla de las diagonales, en un solo sitio. Todo el movimiento la lee de aquí: lo
 * que se enciende al mover, la ruta que se dibuja, lo que cuesta y cómo andan los enemigos.
 *
 * - `'alternas'`, la regla opcional de las diagonales de 5e (la que va ahora): la primera
 *   diagonal cuesta 5 pies, la segunda 10, la tercera 5, la cuarta 10… En diagonal se llega
 *   menos lejos que en recto, y se nota en el tablero.
 * - `'todas-a-5'`, la de siempre: cada diagonal cuesta 5 pies, como un paso recto.
 *
 * Daniel: si prefieres la de siempre, cambia `'alternas'` por `'todas-a-5'` en esta línea y ya
 * está. Las distancias de alcance (un arco, un conjuro) no cambian con esto: siguen contando
 * cada casilla a 5 pies.
 *
 * @type {'alternas'|'todas-a-5'}
 */
export const DIAGONAL_RULE = 'alternas';

/** The eight directions, straight first so equal-cost ties resolve to tidier paths. */
const DIRECTIONS = [
    { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
    { dx: 1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 },
];

/** Sin dirección todavía: la casilla de salida. */
const NO_DIRECTION = DIRECTIONS.length;

/**
 * Tanda 10: los pesos del desempate. El precio en casillas manda siempre; a igual precio, los
 * giros; y a igual precio y giros, lo que se aparta de la línea recta. Los pesos separan las tres
 * cosas: en un tablero de 40 × 30, ni todos los giros juntos llegan a una casilla de precio, ni
 * todo el desvío junto a un giro.
 */
const COST_WEIGHT = 1e9;
const TURN_WEIGHT = 1e5;

/**
 * Si la regla de las diagonales alternas va en esta búsqueda.
 *
 * @param {PathOptions} options
 * @returns {boolean}
 */
function alternating(options) {
    return (options?.diagonals ?? DIAGONAL_RULE) === 'alternas';
}

/**
 * Lo que cuesta un paso, en casillas, y cómo queda la cuenta de diagonales.
 *
 * Con las diagonales alternas, `odd` dice si la próxima diagonal es de las que cuestan el doble
 * (la segunda, la cuarta…). Lo difícil sigue costando el doble: una diagonal de 10 pies por
 * terreno difícil cuesta 20.
 *
 * @param {import('./terrain.js').BoardTerrain} terrain
 * @param {number} fromX @param {number} fromY @param {number} toX @param {number} toY
 * @param {number} odd 0 o 1.
 * @param {boolean} alternate
 * @returns {{cost: number, odd: number}}
 */
function stepCostOf(terrain, fromX, fromY, toX, toY, odd, alternate) {
    const base = getMovementCost(terrain, toX, toY);
    if (!Number.isFinite(base)) return { cost: Infinity, odd };
    const diagonal = fromX !== toX && fromY !== toY;
    if (!diagonal || !alternate) return { cost: base, odd };
    return { cost: odd ? base * 2 : base, odd: odd ? 0 : 1 };
}

/**
 * Lo mínimo que cuesta ir de una casilla a otra por suelo llano, la cota de la búsqueda.
 *
 * @param {number} ax @param {number} ay @param {number} bx @param {number} by
 * @param {number} odd
 * @param {boolean} alternate
 * @returns {number}
 */
function floorDistance(ax, ay, bx, by, odd, alternate) {
    const dx = Math.abs(ax - bx);
    const dy = Math.abs(ay - by);
    const diagonals = Math.min(dx, dy);
    const straight = Math.max(dx, dy) - diagonals;
    if (!alternate) return straight + diagonals;
    return straight + diagonals + Math.floor((diagonals + odd) / 2);
}

/**
 * Minimal binary heap. A board is at most a few thousand cells, but a linear scan of the
 * open set turns A* quadratic and it shows on a 50x50 board with a long wall.
 */
/**
 * @typedef {Object} HeapItem
 * @property {string} key
 * @property {number} x
 * @property {number} y
 * @property {number} f
 * @property {number} [odd] Tanda 10: si la próxima diagonal cuesta el doble (0 o 1).
 * @property {number} [dir] Tanda 10: por dónde se llegó (índice de `DIRECTIONS`), para contar giros.
 */

class MinHeap {
    constructor() {
        /** @type {HeapItem[]} */
        this.items = [];
    }

    get size() {
        return this.items.length;
    }

    /** @param {HeapItem} item */
    push(item) {
        this.items.push(item);
        let i = this.items.length - 1;
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (this.items[parent].f <= this.items[i].f) break;
            [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
            i = parent;
        }
    }

    pop() {
        const top = this.items[0];
        const last = this.items.pop();
        if (this.items.length > 0 && last) {
            this.items[0] = last;
            let i = 0;
            for (;;) {
                const left = 2 * i + 1;
                const right = left + 1;
                let smallest = i;
                if (left < this.items.length && this.items[left].f < this.items[smallest].f) smallest = left;
                if (right < this.items.length && this.items[right].f < this.items[smallest].f) smallest = right;
                if (smallest === i) break;
                [this.items[smallest], this.items[i]] = [this.items[i], this.items[smallest]];
                i = smallest;
            }
        }
        return top;
    }
}

/**
 * @typedef {Object} PathOptions
 * @property {Set<string>} [occupied]        Cell keys holding another creature.
 * @property {number} [maxCost]              Give up beyond this many movement points.
 * @property {boolean} [allowCornerCutting]  Permit diagonals between two touching walls.
 * @property {boolean} [throughFire]         Tanda 8: no rodear el fuego (`hotCells`); el camino más corto, arda o no.
 * @property {'alternas'|'todas-a-5'} [diagonals] Tanda 10: la regla de las diagonales; sin decirla, `DIAGONAL_RULE`.
 * @property {number} [diagonalsTaken]       Tanda 10: las diagonales ya andadas en este turno: con un número impar,
 *   la primera de este movimiento ya es de las que cuestan el doble.
 */

/**
 * @typedef {PathOptions & {avoid?: Set<string>|null}} SearchOptions
 *   `avoid`: casillas que no se cruzan (el fuego a la vista); se entra en ellas, pero no se sigue.
 */

/**
 * Tanda 8: las casillas del fuego a la vista: un fuego del tablero (el aceite que arde, lo que
 * prende y se extiende; `kind: 'fuego'`, `hazards.js`) que no se ha apagado, y las casillas de
 * una zona de fuego de un conjuro (J19.6). Lo que el camino rodea si puede.
 *
 * @param {Object} [input]
 * @param {any[]} [input.hazards] Lo que el tablero tiene puesto (`board.hazards`).
 * @param {any[]} [input.zones] Las zonas de conjuro del combate.
 * @returns {Set<string>}
 */
export function fireCellsOf({ hazards = [], zones = [] } = {}) {
    /** @type {Set<string>} */
    const out = new Set();
    for (const hazard of Array.isArray(hazards) ? hazards : []) {
        if (!hazard || String(hazard.kind ?? '') !== 'fuego' || hazard.armed === false || hazard.seen === false) continue;
        const x = Number(hazard.x);
        const y = Number(hazard.y);
        if (Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0) out.add(cellKey(x, y));
    }
    for (const zone of Array.isArray(zones) ? zones : []) {
        if (String(zone?.kind ?? '') !== 'fuego') continue;
        for (const cell of Array.isArray(zone.cells) ? zone.cells : []) out.add(cellKey(cell?.x, cell?.y));
    }
    return out;
}

/**
 * El fuego que este camino rodea: el del terreno (`hotCells`), salvo que se pida cruzarlo.
 *
 * @param {import('./terrain.js').BoardTerrain} terrain
 * @param {PathOptions} options
 * @returns {Set<string>|null} Nada si no hay fuego que rodear.
 */
function fireToAvoid(terrain, options) {
    if (options.throughFire) return null;
    const hot = /** @type {any} */ (terrain)?.hotCells;
    return hot instanceof Set && hot.size > 0 ? hot : null;
}

/**
 * Whether a step from one cell to a neighbour is legal.
 * @param {import('./terrain.js').BoardTerrain} terrain
 * @param {number} fromX @param {number} fromY @param {number} toX @param {number} toY
 * @param {number} gridWidth @param {number} gridHeight
 * @param {PathOptions} options
 * @returns {boolean}
 */
function canStep(terrain, fromX, fromY, toX, toY, gridWidth, gridHeight, options) {
    if (!isPassable(terrain, toX, toY, gridWidth, gridHeight)) return false;
    if (options.occupied?.has(cellKey(toX, toY))) return false;

    // J12.10: el tablero con cotas (`withOverlay`) no deja cruzar un acantilado andando. La
    // regla es la de `heights.js`, la misma con la que el editor comprueba los puentes.
    const elevation = terrain?.elevation;
    if (elevation) {
        const from = { x: fromX, y: fromY };
        const to = { x: toX, y: toY };
        if (options.allowCornerCutting ? isCliff(elevation, from, to) : !canStepBetween(terrain, elevation, from, to, gridWidth, gridHeight)) return false;
    }

    const isDiagonal = fromX !== toX && fromY !== toY;
    if (!isDiagonal || options.allowCornerCutting) return true;

    // Both orthogonal cells the diagonal squeezes past must be open.
    return isPassable(terrain, toX, fromY, gridWidth, gridHeight)
        && isPassable(terrain, fromX, toY, gridWidth, gridHeight);
}

/**
 * Shortest path between two cells, or null when none exists.
 *
 * The returned path includes the start and the goal.
 *
 * @param {import('./terrain.js').BoardTerrain} terrain
 * @param {number} startX @param {number} startY
 * @param {number} goalX @param {number} goalY
 * @param {number} gridWidth @param {number} gridHeight
 * @param {PathOptions} [options]
 * @returns {Array<{x: number, y: number}> | null}
 */
export function findPath(terrain, startX, startY, goalX, goalY, gridWidth, gridHeight, options = {}) {
    // Tanda 8: primero sin cruzar el fuego a la vista; si así no se llega, por donde se pueda.
    const hot = fireToAvoid(terrain, options);
    if (hot) {
        const around = searchPath(terrain, startX, startY, goalX, goalY, gridWidth, gridHeight, { ...options, avoid: hot });
        if (around) return around;
    }
    return searchPath(terrain, startX, startY, goalX, goalY, gridWidth, gridHeight, options);
}

/**
 * El A* de `findPath`, con las casillas que no se cruzan (`avoid`): se puede acabar en una,
 * pero no pasar por ella.
 *
 * @param {import('./terrain.js').BoardTerrain} terrain
 * @param {number} startX @param {number} startY
 * @param {number} goalX @param {number} goalY
 * @param {number} gridWidth @param {number} gridHeight
 * @param {SearchOptions} options
 * @returns {Array<{x: number, y: number}> | null}
 */
function searchPath(terrain, startX, startY, goalX, goalY, gridWidth, gridHeight, options) {
    const sx = Math.trunc(Number(startX) || 0);
    const sy = Math.trunc(Number(startY) || 0);
    const gx = Math.trunc(Number(goalX) || 0);
    const gy = Math.trunc(Number(goalY) || 0);

    if (!isPassable(terrain, sx, sy, gridWidth, gridHeight)) return null;
    if (!isPassable(terrain, gx, gy, gridWidth, gridHeight)) return null;
    if (sx === gx && sy === gy) return [{ x: sx, y: sy }];

    const maxCost = Number.isFinite(Number(options.maxCost)) ? Number(options.maxCost) : Infinity;
    const startCell = cellKey(sx, sy);
    const alternate = alternating(options);
    const firstOdd = Math.abs(Math.trunc(Number(options.diagonalsTaken) || 0)) % 2;
    // Tanda 10: el estado es la casilla, si la próxima diagonal cuesta el doble y por dónde se
    // llegó: a igual precio, gana el camino con menos giros y, después, el más pegado a la recta.
    const stateKey = (/** @type {string} */ cell, /** @type {number} */ odd, /** @type {number} */ dir) => `${cell}|${odd}|${dir}`;
    const lineLength = Math.hypot(gx - sx, gy - sy) || 1;
    /** Lo que se aparta una casilla de la línea recta del camino, en casillas. */
    const offLine = (/** @type {number} */ x, /** @type {number} */ y) => Math.abs((gx - sx) * (y - sy) - (gy - sy) * (x - sx)) / lineLength;

    const startKey = stateKey(startCell, firstOdd, NO_DIRECTION);
    /** El precio en casillas de cada estado. @type {Map<string, number>} */
    const gScore = new Map([[startKey, 0]]);
    /** El precio con el desempate (giros y desvío). @type {Map<string, number>} */
    const score = new Map([[startKey, 0]]);
    /** @type {Map<string, {state: string, x: number, y: number}>} */
    const cameFrom = new Map();
    /** @type {Set<string>} */
    const closed = new Set();

    const open = new MinHeap();
    open.push({ key: startKey, x: sx, y: sy, f: floorDistance(sx, sy, gx, gy, firstOdd, alternate) * COST_WEIGHT, odd: firstOdd, dir: NO_DIRECTION });

    while (open.size > 0) {
        const current = open.pop();
        if (!current || closed.has(current.key)) continue;
        closed.add(current.key);

        if (current.x === gx && current.y === gy) {
            const path = [{ x: gx, y: gy }];
            let key = current.key;
            while (cameFrom.has(key)) {
                const previous = /** @type {{state: string, x: number, y: number}} */ (cameFrom.get(key));
                path.push({ x: previous.x, y: previous.y });
                key = previous.state;
            }
            return path.reverse();
        }
        // Lo que no se cruza (el fuego): se llega, pero de ahí no se sigue.
        const currentCell = cellKey(current.x, current.y);
        if (options.avoid?.has(currentCell) && currentCell !== startCell) continue;

        const currentG = gScore.get(current.key) ?? Infinity;
        const currentScore = score.get(current.key) ?? Infinity;
        const odd = Number(current.odd) || 0;
        const cameDir = current.dir ?? NO_DIRECTION;

        DIRECTIONS.forEach(({ dx, dy }, dir) => {
            const nx = current.x + dx;
            const ny = current.y + dy;
            if (!canStep(terrain, current.x, current.y, nx, ny, gridWidth, gridHeight, options)) return;

            const step = stepCostOf(terrain, current.x, current.y, nx, ny, odd, alternate);
            if (!Number.isFinite(step.cost)) return;

            const tentativeG = currentG + step.cost;
            if (tentativeG > maxCost) return;
            const neighbourKey = stateKey(cellKey(nx, ny), step.odd, dir);
            if (closed.has(neighbourKey)) return;
            const turned = cameDir !== NO_DIRECTION && cameDir !== dir ? 1 : 0;
            const tentative = currentScore + step.cost * COST_WEIGHT + turned * TURN_WEIGHT + offLine(nx, ny);
            if (tentative >= (score.get(neighbourKey) ?? Infinity)) return;

            gScore.set(neighbourKey, tentativeG);
            score.set(neighbourKey, tentative);
            cameFrom.set(neighbourKey, { state: current.key, x: current.x, y: current.y });
            open.push({
                key: neighbourKey,
                x: nx,
                y: ny,
                f: tentative + floorDistance(nx, ny, gx, gy, step.odd, alternate) * COST_WEIGHT,
                odd: step.odd,
                dir,
            });
        });
    }

    return null;
}

/**
 * Total movement cost of a path, in cells. The starting cell is free.
 *
 * Tanda 10: con las diagonales alternas (`DIAGONAL_RULE`), la segunda diagonal del camino cuesta
 * el doble, y la cuarta… `diagonalsTaken` cuenta las que ya se anduvieron antes en este turno.
 *
 * @param {import('./terrain.js').BoardTerrain} terrain
 * @param {Array<{x: number, y: number}>} path
 * @param {{diagonals?: 'alternas'|'todas-a-5', diagonalsTaken?: number}} [options]
 * @returns {number}
 */
export function getPathCost(terrain, path, options = {}) {
    if (!Array.isArray(path) || path.length <= 1) return 0;
    const alternate = alternating(options);
    let odd = Math.abs(Math.trunc(Number(options.diagonalsTaken) || 0)) % 2;
    let total = 0;
    for (let i = 1; i < path.length; i++) {
        const step = stepCostOf(terrain, path[i - 1].x, path[i - 1].y, path[i].x, path[i].y, odd, alternate);
        total += step.cost;
        odd = step.odd;
    }
    return total;
}

/**
 * Tanda 10: cuántas diagonales tiene un camino, para seguir la cuenta de las alternas en el
 * siguiente movimiento del mismo turno.
 *
 * @param {Array<{x: number, y: number}>} path
 * @returns {number}
 */
export function countDiagonals(path) {
    if (!Array.isArray(path)) return 0;
    let count = 0;
    for (let i = 1; i < path.length; i++) {
        if (path[i].x !== path[i - 1].x && path[i].y !== path[i - 1].y) count++;
    }
    return count;
}

/**
 * Every cell reachable within a movement budget, with the cost of getting there.
 *
 * This is the terrain-aware replacement for the naive Chebyshev square: it walks around
 * walls, charges double for difficult ground and refuses cells held by other creatures.
 * A Dijkstra flood is used rather than repeated A*, since every cell is wanted.
 *
 * @param {import('./terrain.js').BoardTerrain} terrain
 * @param {number} originX @param {number} originY
 * @param {number} movementFeet
 * @param {number} gridWidth @param {number} gridHeight
 * @param {PathOptions} [options]
 * @returns {Array<{gridX: number, gridY: number, cost: number, kind: 'move'}>}
 */
export function getReachableCells(terrain, originX, originY, movementFeet, gridWidth, gridHeight, options = {}) {
    const ox = Math.trunc(Number(originX) || 0);
    const oy = Math.trunc(Number(originY) || 0);
    const budget = Math.max(0, Math.floor((Number(movementFeet) || 0) / 5));

    if (!isPassable(terrain, ox, oy, gridWidth, gridHeight)) return [];

    const plain = flood(terrain, ox, oy, budget, gridWidth, gridHeight, options);
    let best = plain;
    const hot = fireToAvoid(terrain, options);
    if (hot) {
        // Tanda 8: lo encendido es lo que `findPath` anda: a donde se llega sin cruzar el fuego, por
        // ahí, aunque el rodeo no quepa en lo que queda; a donde no, por donde se pueda.
        const around = flood(terrain, ox, oy, Infinity, gridWidth, gridHeight, { ...options, avoid: hot });
        best = new Map();
        for (const [key, cost] of around) if (cost <= budget) best.set(key, cost);
        for (const [key, cost] of plain) if (!around.has(key)) best.set(key, cost);
    }

    return [...best.entries()].map(([key, cost]) => {
        const [x, y] = key.split(',').map(Number);
        return { gridX: x, gridY: y, cost, kind: /** @type {'move'} */ ('move') };
    });
}

/**
 * El Dijkstra de `getReachableCells`: lo que cuesta llegar a cada casilla sin pasar de
 * `budget`. Por lo que no se cruza (`avoid`) no se sigue, pero se llega.
 *
 * @param {import('./terrain.js').BoardTerrain} terrain
 * @param {number} ox @param {number} oy
 * @param {number} budget En casillas.
 * @param {number} gridWidth @param {number} gridHeight
 * @param {SearchOptions} options
 * @returns {Map<string, number>}
 */
function flood(terrain, ox, oy, budget, gridWidth, gridHeight, options) {
    const startCell = cellKey(ox, oy);
    const alternate = alternating(options);
    const firstOdd = Math.abs(Math.trunc(Number(options.diagonalsTaken) || 0)) % 2;
    // Tanda 10: con las diagonales alternas, llegar a una casilla con la próxima diagonal barata
    // vale más que llegar por lo mismo con ella cara: se guardan las dos cuentas.
    const stateKey = (/** @type {string} */ cell, /** @type {number} */ odd) => `${cell}|${odd}`;
    const startKey = stateKey(startCell, firstOdd);
    /** Lo que cuesta cada estado. @type {Map<string, number>} */
    const cost = new Map([[startKey, 0]]);
    /** Y cada casilla, por la mejor de sus cuentas. @type {Map<string, number>} */
    const best = new Map([[startCell, 0]]);
    const open = new MinHeap();
    open.push({ key: startKey, x: ox, y: oy, f: 0, odd: firstOdd });
    /** @type {Set<string>} */
    const closed = new Set();

    while (open.size > 0) {
        const current = open.pop();
        if (!current || closed.has(current.key)) continue;
        closed.add(current.key);
        const currentCell = cellKey(current.x, current.y);
        if (options.avoid?.has(currentCell) && currentCell !== startCell) continue;

        const currentCost = cost.get(current.key) ?? Infinity;
        const odd = Number(current.odd) || 0;

        for (const { dx, dy } of DIRECTIONS) {
            const nx = current.x + dx;
            const ny = current.y + dy;
            if (!canStep(terrain, current.x, current.y, nx, ny, gridWidth, gridHeight, options)) continue;

            const step = stepCostOf(terrain, current.x, current.y, nx, ny, odd, alternate);
            if (!Number.isFinite(step.cost)) continue;

            const total = currentCost + step.cost;
            if (total > budget) continue;
            const neighbourCell = cellKey(nx, ny);
            const neighbourKey = stateKey(neighbourCell, step.odd);
            if (closed.has(neighbourKey)) continue;
            if (total >= (cost.get(neighbourKey) ?? Infinity)) continue;

            cost.set(neighbourKey, total);
            if (total < (best.get(neighbourCell) ?? Infinity)) best.set(neighbourCell, total);
            open.push({ key: neighbourKey, x: nx, y: ny, f: total, odd: step.odd });
        }
    }
    return best;
}
