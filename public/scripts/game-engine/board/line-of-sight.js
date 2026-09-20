/**
 * Line of sight and visible area over the board terrain.
 *
 * Sight is traced between cell centres. The traversal is the Amanatides & Woo grid walk
 * rather than plain Bresenham, for one reason: it is symmetric. Bresenham picks a different
 * set of cells depending on which end you start from, so a wall can leave A seeing B while
 * B cannot see A. In a tactical game that reads as a bug, and players notice.
 *
 * Endpoints never block: you can always see out of your own cell, and you can always see a
 * creature standing in a doorway or behind a low wall it occupies.
 *
 * Corner grazing is permissive. When the ray passes exactly through the corner shared by
 * four cells, the two diagonal neighbours do not block. The strict rule makes diagonal
 * corridors unusable and surprises players more often than it helps.
 *
 * Pure module. Depends only on the terrain leaf.
 *
 * See wiki/ROADMAP.md, Fase A (A2).
 */

import { blocksSight, isInsideGrid } from './terrain.js';

/**
 * Lists the cells a ray between two cell centres passes through, endpoints excluded.
 *
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @returns {Array<{x: number, y: number}>}
 */
export function getRayCells(x0, y0, x1, y1) {
    const ax = Math.trunc(x0);
    const ay = Math.trunc(y0);
    const bx = Math.trunc(x1);
    const by = Math.trunc(y1);

    if (ax === bx && ay === by) return [];

    // Symmetry is a property we need, not one we can hope for. Floating point accumulates
    // differently depending on which end the walk starts from, so the endpoints are put in
    // a canonical order and the result reversed if needed. The arithmetic below is then
    // bit-identical whichever way the caller asked, which makes A-sees-B and B-sees-A the
    // same computation rather than two that merely ought to agree.
    const flipped = ax > bx || (ax === bx && ay > by);
    const startX = flipped ? bx : ax;
    const startY = flipped ? by : ay;
    const endX = flipped ? ax : bx;
    const endY = flipped ? ay : by;

    const dx = endX - startX;
    const dy = endY - startY;
    const stepX = Math.sign(dx);
    const stepY = Math.sign(dy);
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    /** @type {Array<{x: number, y: number}>} */
    const cells = [];

    // Pure horizontal, vertical and diagonal rays have no ambiguity: walk them directly.
    if (absDx === 0 || absDy === 0 || absDx === absDy) {
        const steps = Math.max(absDx, absDy);
        for (let i = 1; i < steps; i++) {
            cells.push({ x: startX + stepX * i, y: startY + stepY * i });
        }
        return flipped ? cells.reverse() : cells;
    }

    // Parametric walk from centre to centre. tMaxX/tMaxY hold the ray parameter at which
    // the next vertical/horizontal grid line is crossed.
    let x = startX;
    let y = startY;
    const tDeltaX = 1 / absDx;
    const tDeltaY = 1 / absDy;
    let tMaxX = tDeltaX / 2;
    let tMaxY = tDeltaY / 2;

    // Guard against pathological input rather than looping forever.
    const limit = 2 * (absDx + absDy) + 4;
    for (let guard = 0; guard < limit; guard++) {
        if (tMaxX < tMaxY) {
            tMaxX += tDeltaX;
            x += stepX;
        } else if (tMaxY < tMaxX) {
            tMaxY += tDeltaY;
            y += stepY;
        } else {
            // Exact corner: cross both at once and skip the two diagonal neighbours.
            tMaxX += tDeltaX;
            tMaxY += tDeltaY;
            x += stepX;
            y += stepY;
        }

        if (x === endX && y === endY) break;
        cells.push({ x, y });
    }

    return flipped ? cells.reverse() : cells;
}

/**
 * Whether an unobstructed line runs between two cells.
 *
 * @param {import('./terrain.js').BoardTerrain} terrain
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @returns {boolean}
 */
export function hasLineOfSight(terrain, x0, y0, x1, y1) {
    for (const cell of getRayCells(x0, y0, x1, y1)) {
        if (blocksSight(terrain, cell.x, cell.y)) return false;
    }
    return true;
}

/**
 * Every cell a creature at the origin can currently see.
 *
 * Radius is in cells and measured with Chebyshev distance, matching how the rest of the
 * engine measures the board. A radius of 0 sees only the origin.
 *
 * @param {import('./terrain.js').BoardTerrain} terrain
 * @param {number} originX
 * @param {number} originY
 * @param {number} radiusCells
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {Array<{x: number, y: number}>}
 */
export function getVisibleCells(terrain, originX, originY, radiusCells, gridWidth, gridHeight) {
    const ox = Math.trunc(Number(originX) || 0);
    const oy = Math.trunc(Number(originY) || 0);
    const radius = Math.max(0, Math.floor(Number(radiusCells) || 0));

    /** @type {Array<{x: number, y: number}>} */
    const visible = [];
    if (!isInsideGrid(ox, oy, gridWidth, gridHeight)) return visible;

    const minX = Math.max(0, ox - radius);
    const maxX = Math.min(gridWidth - 1, ox + radius);
    const minY = Math.max(0, oy - radius);
    const maxY = Math.min(gridHeight - 1, oy + radius);

    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            if (hasLineOfSight(terrain, ox, oy, x, y)) {
                visible.push({ x, y });
            }
        }
    }

    return visible;
}

/**
 * Converts a sight radius in feet to cells, at the board's five feet per cell.
 * @param {number} feet
 * @returns {number}
 */
export function sightRadiusInCells(feet) {
    return Math.max(0, Math.floor((Number(feet) || 0) / 5));
}
