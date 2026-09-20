/**
 * Fog of war.
 *
 * Three states, which is what makes exploring a dungeon feel like exploring rather than
 * like switching a light on:
 *
 *   unknown   never seen. Drawn black. The player does not know the terrain.
 *   explored  seen before, not seen now. Drawn dimmed. Terrain is remembered, creatures
 *             are not: a goblin that walked in behind you does not show.
 *   visible   in somebody's line of sight right now. Drawn normally.
 *
 * Only `explored` is persisted, because it is the only part that is memory. Visibility is
 * recomputed from the party's positions whenever anything moves, so it can never go stale.
 *
 * Storage is sparse for the same reason as terrain: this lives inside the world info file.
 *
 * Pure module.
 *
 * See wiki/ROADMAP.md, Fase A (A3).
 */

import { cellKey, parseCellKey } from './terrain.js';
import { getVisibleCells, sightRadiusInCells } from './line-of-sight.js';

/** Default sight radius in feet when a token declares none. */
export const DEFAULT_SIGHT_FEET = 60;

export const FOG_SCHEMA_VERSION = 1;

/** @typedef {'unknown'|'explored'|'visible'} CellVisibility */

/**
 * @typedef {Object} BoardFog
 * @property {number} version
 * @property {Record<string, true>} explored  Keyed by "x,y".
 */

/**
 * @returns {BoardFog}
 */
export function createEmptyFog() {
    return { version: FOG_SCHEMA_VERSION, explored: {} };
}

/**
 * Repairs fog read from disk, dropping malformed keys.
 * @param {any} raw
 * @returns {BoardFog}
 */
export function normalizeFog(raw) {
    if (!raw || typeof raw !== 'object') return createEmptyFog();

    const source = raw.explored && typeof raw.explored === 'object' ? raw.explored : {};
    /** @type {Record<string, true>} */
    const explored = {};
    for (const [key, value] of Object.entries(source)) {
        if (!parseCellKey(key)) continue;
        if (!value) continue;
        explored[key] = true;
    }

    return { version: FOG_SCHEMA_VERSION, explored };
}

/**
 * Marks cells as explored. Returns new fog; the input is not mutated.
 * @param {BoardFog} fog
 * @param {Array<{x: number, y: number}>} cells
 * @returns {BoardFog}
 */
export function revealCells(fog, cells) {
    const base = normalizeFog(fog);
    if (!Array.isArray(cells) || cells.length === 0) return base;

    const explored = { ...base.explored };
    for (const cell of cells) {
        if (!cell || !Number.isFinite(Number(cell.x)) || !Number.isFinite(Number(cell.y))) continue;
        explored[cellKey(cell.x, cell.y)] = true;
    }
    return { version: FOG_SCHEMA_VERSION, explored };
}

/**
 * The union of what every given token can see.
 *
 * Tokens are the party members, not the enemies: fog models what the player knows. Each
 * token contributes a disc of its own sight radius, trimmed by walls.
 *
 * @param {import('./terrain.js').BoardTerrain} terrain
 * @param {Array<{gridX: number, gridY: number, sightFeet?: number}>} tokens
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {Set<string>} cell keys currently visible
 */
export function computeVisibleSet(terrain, tokens, gridWidth, gridHeight) {
    /** @type {Set<string>} */
    const visible = new Set();
    if (!Array.isArray(tokens)) return visible;

    for (const token of tokens) {
        if (!token) continue;
        const radius = sightRadiusInCells(
            Number.isFinite(Number(token.sightFeet)) ? Number(token.sightFeet) : DEFAULT_SIGHT_FEET,
        );
        const cells = getVisibleCells(terrain, token.gridX, token.gridY, radius, gridWidth, gridHeight);
        for (const cell of cells) {
            visible.add(cellKey(cell.x, cell.y));
        }
    }

    return visible;
}

/**
 * Recomputes visibility and folds it into the explored memory.
 *
 * This is the one call the renderer needs after anything moves.
 *
 * @param {BoardFog} fog
 * @param {import('./terrain.js').BoardTerrain} terrain
 * @param {Array<{gridX: number, gridY: number, sightFeet?: number}>} tokens
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {{ fog: BoardFog, visible: Set<string> }}
 */
export function updateFog(fog, terrain, tokens, gridWidth, gridHeight) {
    const visible = computeVisibleSet(terrain, tokens, gridWidth, gridHeight);
    const cells = [...visible].map(parseCellKey).filter(Boolean);
    return { fog: revealCells(fog, /** @type {Array<{x: number, y: number}>} */ (cells)), visible };
}

/**
 * @param {BoardFog} fog
 * @param {Set<string>} visible
 * @param {number} x
 * @param {number} y
 * @returns {CellVisibility}
 */
export function getCellVisibility(fog, visible, x, y) {
    const key = cellKey(x, y);
    if (visible instanceof Set && visible.has(key)) return 'visible';
    if (fog?.explored?.[key]) return 'explored';
    return 'unknown';
}

/**
 * Whether a creature standing on a cell should be drawn.
 *
 * Deliberately stricter than terrain: remembering a wall is reasonable, remembering a
 * creature that has since moved is not. Only currently visible creatures are shown.
 *
 * @param {Set<string>} visible
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function isTokenVisible(visible, x, y) {
    return visible instanceof Set && visible.has(cellKey(x, y));
}

/**
 * Reveals an entire board. For the GM view, or for boards that declare no fog.
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {BoardFog}
 */
export function createFullyExploredFog(gridWidth, gridHeight) {
    /** @type {Record<string, true>} */
    const explored = {};
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            explored[cellKey(x, y)] = true;
        }
    }
    return { version: FOG_SCHEMA_VERSION, explored };
}

/**
 * How much of the board has been seen, as a fraction. Useful for a completion indicator.
 * @param {BoardFog} fog
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {number} 0..1
 */
export function getExploredFraction(fog, gridWidth, gridHeight) {
    const total = Math.max(0, Math.trunc(gridWidth) * Math.trunc(gridHeight));
    if (total === 0) return 0;
    return Math.min(1, Object.keys(normalizeFog(fog).explored).length / total);
}
