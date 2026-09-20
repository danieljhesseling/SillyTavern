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
 * Pure module. Depends only on the terrain leaf.
 *
 * See wiki/ROADMAP.md, Fase A (A4).
 */

import { cellKey, getMovementCost, isPassable } from './terrain.js';

/** The eight directions, straight first so equal-cost ties resolve to tidier paths. */
const DIRECTIONS = [
    { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
    { dx: 1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 },
];

/**
 * Minimal binary heap. A board is at most a few thousand cells, but a linear scan of the
 * open set turns A* quadratic and it shows on a 50x50 board with a long wall.
 */
class MinHeap {
    constructor() {
        /** @type {Array<{key: string, x: number, y: number, f: number}>} */
        this.items = [];
    }

    get size() {
        return this.items.length;
    }

    /** @param {{key: string, x: number, y: number, f: number}} item */
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
 * Chebyshev distance, the heuristic and the board's distance measure.
 * @param {number} ax @param {number} ay @param {number} bx @param {number} by
 * @returns {number}
 */
function chebyshev(ax, ay, bx, by) {
    return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

/**
 * @typedef {Object} PathOptions
 * @property {Set<string>} [occupied]        Cell keys holding another creature.
 * @property {number} [maxCost]              Give up beyond this many movement points.
 * @property {boolean} [allowCornerCutting]  Permit diagonals between two touching walls.
 */

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
    const sx = Math.trunc(Number(startX) || 0);
    const sy = Math.trunc(Number(startY) || 0);
    const gx = Math.trunc(Number(goalX) || 0);
    const gy = Math.trunc(Number(goalY) || 0);

    if (!isPassable(terrain, sx, sy, gridWidth, gridHeight)) return null;
    if (!isPassable(terrain, gx, gy, gridWidth, gridHeight)) return null;
    if (sx === gx && sy === gy) return [{ x: sx, y: sy }];

    const maxCost = Number.isFinite(Number(options.maxCost)) ? Number(options.maxCost) : Infinity;
    const startKey = cellKey(sx, sy);

    /** @type {Map<string, number>} */
    const gScore = new Map([[startKey, 0]]);
    /** @type {Map<string, {x: number, y: number}>} */
    const cameFrom = new Map();
    /** @type {Set<string>} */
    const closed = new Set();

    const open = new MinHeap();
    open.push({ key: startKey, x: sx, y: sy, f: chebyshev(sx, sy, gx, gy) });

    while (open.size > 0) {
        const current = open.pop();
        if (!current || closed.has(current.key)) continue;
        closed.add(current.key);

        if (current.x === gx && current.y === gy) {
            const path = [{ x: gx, y: gy }];
            let key = current.key;
            while (cameFrom.has(key)) {
                const previous = /** @type {{x: number, y: number}} */ (cameFrom.get(key));
                path.push(previous);
                key = cellKey(previous.x, previous.y);
            }
            return path.reverse();
        }

        const currentG = gScore.get(current.key) ?? Infinity;

        for (const { dx, dy } of DIRECTIONS) {
            const nx = current.x + dx;
            const ny = current.y + dy;
            const neighbourKey = cellKey(nx, ny);
            if (closed.has(neighbourKey)) continue;
            if (!canStep(terrain, current.x, current.y, nx, ny, gridWidth, gridHeight, options)) continue;

            const stepCost = getMovementCost(terrain, nx, ny);
            if (!Number.isFinite(stepCost)) continue;

            const tentativeG = currentG + stepCost;
            if (tentativeG > maxCost) continue;
            if (tentativeG >= (gScore.get(neighbourKey) ?? Infinity)) continue;

            gScore.set(neighbourKey, tentativeG);
            cameFrom.set(neighbourKey, { x: current.x, y: current.y });
            open.push({
                key: neighbourKey,
                x: nx,
                y: ny,
                f: tentativeG + chebyshev(nx, ny, gx, gy),
            });
        }
    }

    return null;
}

/**
 * Total movement cost of a path, in cells. The starting cell is free.
 * @param {import('./terrain.js').BoardTerrain} terrain
 * @param {Array<{x: number, y: number}>} path
 * @returns {number}
 */
export function getPathCost(terrain, path) {
    if (!Array.isArray(path) || path.length <= 1) return 0;
    return path.slice(1).reduce((sum, cell) => sum + getMovementCost(terrain, cell.x, cell.y), 0);
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

    /** @type {Map<string, number>} */
    const best = new Map([[cellKey(ox, oy), 0]]);
    const open = new MinHeap();
    open.push({ key: cellKey(ox, oy), x: ox, y: oy, f: 0 });
    /** @type {Set<string>} */
    const closed = new Set();

    while (open.size > 0) {
        const current = open.pop();
        if (!current || closed.has(current.key)) continue;
        closed.add(current.key);

        const currentCost = best.get(current.key) ?? Infinity;

        for (const { dx, dy } of DIRECTIONS) {
            const nx = current.x + dx;
            const ny = current.y + dy;
            const neighbourKey = cellKey(nx, ny);
            if (closed.has(neighbourKey)) continue;
            if (!canStep(terrain, current.x, current.y, nx, ny, gridWidth, gridHeight, options)) continue;

            const stepCost = getMovementCost(terrain, nx, ny);
            if (!Number.isFinite(stepCost)) continue;

            const total = currentCost + stepCost;
            if (total > budget) continue;
            if (total >= (best.get(neighbourKey) ?? Infinity)) continue;

            best.set(neighbourKey, total);
            open.push({ key: neighbourKey, x: nx, y: ny, f: total });
        }
    }

    return [...best.entries()].map(([key, cost]) => {
        const [x, y] = key.split(',').map(Number);
        return { gridX: x, gridY: y, cost, kind: /** @type {'move'} */ ('move') };
    });
}
