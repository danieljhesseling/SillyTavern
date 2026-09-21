/**
 * Where the enemies stand when a fight begins.
 *
 * Until now they landed on a random cell of the top-left ten by ten, which could be — and
 * regularly was — inside a wall. Nobody noticed because the enemy AI walks out of trouble
 * on its first turn, but an imported campaign makes it matter: a book draws its monsters
 * where it wants them, behind the cover and across the room, and that drawing is half of
 * what makes the encounter what it is.
 *
 * So: use the board's own placements when it has them, fall back to a free cell when it
 * does not, and never put anybody inside a wall.
 *
 * Pure, with the randomness injected. See wiki/ROADMAP_INGESTA_CAMPANAS_LIBROS.md (G3).
 */

import { isPassable } from '../board/terrain.js';

/**
 * @typedef {Object} SpawnInput
 * @property {string} name The enemy template's name, as the board would spell it.
 * @property {number} count How many to place.
 * @property {Array<{name: string, x: number, y: number}>} [placements] What the board says.
 * @property {any} terrain
 * @property {number} gridWidth
 * @property {number} gridHeight
 * @property {Array<{x: number, y: number}>} [taken] Cells already occupied.
 * @property {() => number} [random]
 */

/**
 * @param {Array<{x: number, y: number}>} cells
 * @returns {Set<string>}
 */
function keysOf(cells) {
    return new Set((Array.isArray(cells) ? cells : [])
        .filter(Boolean)
        .map(cell => `${Number(cell.x) || 0},${Number(cell.y) || 0}`));
}

/**
 * Decide where each copy of an enemy goes.
 *
 * @param {SpawnInput} input
 * @returns {Array<{x: number, y: number, fromBoard: boolean}>}
 */
export function planSpawnCells({
    name, count, placements = [], terrain = null, gridWidth = 50, gridHeight = 50,
    taken = [], random = Math.random,
}) {
    const used = keysOf(taken);
    /** @type {Array<{x: number, y: number, fromBoard: boolean}>} */
    const cells = [];

    const free = (/** @type {number} */ x, /** @type {number} */ y) =>
        isPassable(terrain, x, y, gridWidth, gridHeight) && !used.has(`${x},${y}`);

    // The board's own placements for this creature, in the order it drew them.
    const drawn = (Array.isArray(placements) ? placements : [])
        .filter(p => p && String(p.name).toLowerCase() === String(name).toLowerCase())
        .map(p => ({ x: Number(p.x) || 0, y: Number(p.y) || 0 }));

    for (let i = 0; i < count; i++) {
        const spot = drawn.find(cell => free(cell.x, cell.y));
        if (spot) {
            drawn.splice(drawn.indexOf(spot), 1);
            used.add(`${spot.x},${spot.y}`);
            cells.push({ ...spot, fromBoard: true });
            continue;
        }

        // Nothing drawn, or every drawn cell is taken: somewhere free, at random, and
        // failing that the first free cell there is. A fight that cannot place its
        // enemies at all would be worse than one that places them oddly.
        let placed = null;
        for (let attempt = 0; attempt < 60 && !placed; attempt++) {
            const x = Math.floor(random() * gridWidth);
            const y = Math.floor(random() * gridHeight);
            if (free(x, y)) placed = { x, y };
        }
        if (!placed) {
            outer:
            for (let y = 0; y < gridHeight; y++) {
                for (let x = 0; x < gridWidth; x++) {
                    if (free(x, y)) { placed = { x, y }; break outer; }
                }
            }
        }
        if (!placed) placed = { x: 0, y: 0 };

        used.add(`${placed.x},${placed.y}`);
        cells.push({ ...placed, fromBoard: false });
    }

    return cells;
}
