import { describe, test, expect } from '@jest/globals';
import { createEmptyTerrain, setCell } from '../public/scripts/game-engine/board/terrain.js';
import {
    findPath,
    getPathCost,
    getReachableCells,
} from '../public/scripts/game-engine/board/pathfinding.js';

/** @param {string[]} rows */
function terrainFromMap(rows) {
    let terrain = createEmptyTerrain();
    rows.forEach((row, y) => {
        [...row].forEach((char, x) => {
            if (char === '#') terrain = setCell(terrain, x, y, 'wall');
            if (char === '~') terrain = setCell(terrain, x, y, 'difficult');
            if (char === 'D') terrain = setCell(terrain, x, y, 'door', { open: false });
            if (char === 'o') terrain = setCell(terrain, x, y, 'door', { open: true });
        });
    });
    return terrain;
}

/** @param {Array<{x:number,y:number}>|null} path */
function asString(path) {
    return path ? path.map(c => `${c.x},${c.y}`).join(' ') : null;
}

describe('findPath', () => {
    test('a cell to itself is a path of one', () => {
        expect(findPath(createEmptyTerrain(), 2, 2, 2, 2, 10, 10)).toEqual([{ x: 2, y: 2 }]);
    });

    test('crosses open ground by the diagonal, since diagonals are free', () => {
        const path = findPath(createEmptyTerrain(), 0, 0, 3, 3, 10, 10);
        expect(path).toHaveLength(4);
        expect(getPathCost(createEmptyTerrain(), path)).toBe(3);
    });

    test('includes both the start and the goal', () => {
        const path = findPath(createEmptyTerrain(), 1, 1, 4, 1, 10, 10);
        expect(path[0]).toEqual({ x: 1, y: 1 });
        expect(path[path.length - 1]).toEqual({ x: 4, y: 1 });
    });

    test('walks around a wall instead of through it', () => {
        const terrain = terrainFromMap([
            '.....',
            '.....',
            '.###.',
            '.....',
            '.....',
        ]);
        const path = findPath(terrain, 2, 1, 2, 3, 5, 5);
        expect(path).not.toBeNull();
        expect(asString(path)).not.toContain('2,2');
        expect(path.every(c => !['1,2', '2,2', '3,2'].includes(`${c.x},${c.y}`))).toBe(true);
    });

    test('returns null when the goal is sealed off', () => {
        const terrain = terrainFromMap([
            '.....',
            '#####',
            '.....',
        ]);
        expect(findPath(terrain, 2, 0, 2, 2, 5, 3)).toBeNull();
    });

    test('returns null when start or goal is itself impassable', () => {
        const terrain = terrainFromMap(['#....', '.....']);
        expect(findPath(terrain, 0, 0, 3, 1, 5, 2)).toBeNull();
        expect(findPath(terrain, 3, 1, 0, 0, 5, 2)).toBeNull();
    });

    test('a closed door blocks, an open one is walked through', () => {
        const closed = terrainFromMap(['.....', '##D##', '.....']);
        const open = terrainFromMap(['.....', '##o##', '.....']);
        expect(findPath(closed, 2, 0, 2, 2, 5, 3)).toBeNull();
        expect(findPath(open, 2, 0, 2, 2, 5, 3)).not.toBeNull();
    });

    test('prefers plain ground over difficult ground', () => {
        // Straight through costs 2+2+2; the detour below costs 1 per cell.
        const terrain = terrainFromMap([
            '..~..',
            '.....',
        ]);
        const path = findPath(terrain, 1, 0, 3, 0, 5, 2);
        expect(asString(path)).not.toContain('2,0');
        expect(getPathCost(terrain, path)).toBe(2);
    });

    test('crosses difficult ground when there is no way round', () => {
        const terrain = terrainFromMap([
            '#####',
            '..~..',
            '#####',
        ]);
        const path = findPath(terrain, 1, 1, 3, 1, 5, 3);
        expect(asString(path)).toBe('1,1 2,1 3,1');
        expect(getPathCost(terrain, path)).toBe(3); // 2 for the difficult cell, 1 for the last
    });

    test('will not squeeze diagonally between two touching walls', () => {
        const terrain = terrainFromMap([
            '.#.',
            '#..',
            '...',
        ]);
        // (0,0) to (1,1) is diagonal past the walls at (1,0) and (0,1).
        const path = findPath(terrain, 0, 0, 1, 1, 3, 3);
        expect(path).toBeNull();
    });

    test('allows the squeeze when the caller asks for it', () => {
        const terrain = terrainFromMap([
            '.#.',
            '#..',
            '...',
        ]);
        const path = findPath(terrain, 0, 0, 1, 1, 3, 3, { allowCornerCutting: true });
        expect(asString(path)).toBe('0,0 1,1');
    });

    test('treats occupied cells as blocked', () => {
        const terrain = terrainFromMap(['#####', '..X..', '#####'].map(r => r.replace('X', '.')));
        const occupied = new Set(['2,1']);
        expect(findPath(terrain, 1, 1, 3, 1, 5, 3, { occupied })).toBeNull();
        expect(findPath(terrain, 1, 1, 3, 1, 5, 3)).not.toBeNull();
    });

    test('gives up beyond the movement budget', () => {
        const terrain = createEmptyTerrain();
        expect(findPath(terrain, 0, 0, 9, 0, 20, 5, { maxCost: 5 })).toBeNull();
        expect(findPath(terrain, 0, 0, 9, 0, 20, 5, { maxCost: 9 })).not.toBeNull();
    });

    test('finds its way out of a spiral', () => {
        const terrain = terrainFromMap([
            '#########',
            '#.......#',
            '#.#####.#',
            '#.#...#.#',
            '#.#.#.#.#',
            '#.#.#...#',
            '#.#.#####',
            '#.......#',
            '#########',
        ]);
        const path = findPath(terrain, 1, 1, 3, 3, 9, 9);
        expect(path).not.toBeNull();
        expect(path[0]).toEqual({ x: 1, y: 1 });
        expect(path[path.length - 1]).toEqual({ x: 3, y: 3 });
        // Every step of the way must be legal ground.
        expect(path.every(c => terrain.cells[`${c.x},${c.y}`]?.type !== 'wall')).toBe(true);
    });

    test('consecutive steps are always adjacent', () => {
        const terrain = terrainFromMap([
            '.........',
            '.#######.',
            '.......#.',
            '.#####.#.',
            '.......#.',
        ]);
        const path = findPath(terrain, 0, 0, 8, 4, 9, 5);
        expect(path).not.toBeNull();
        for (let i = 1; i < path.length; i++) {
            const dx = Math.abs(path[i].x - path[i - 1].x);
            const dy = Math.abs(path[i].y - path[i - 1].y);
            expect(Math.max(dx, dy)).toBe(1);
        }
    });
});

describe('getPathCost', () => {
    test('the starting cell is free', () => {
        expect(getPathCost(createEmptyTerrain(), [{ x: 0, y: 0 }])).toBe(0);
    });

    test('charges one per plain cell entered', () => {
        const path = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }];
        expect(getPathCost(createEmptyTerrain(), path)).toBe(2);
    });

    test('charges double for difficult ground', () => {
        const terrain = terrainFromMap(['.~.']);
        const path = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }];
        expect(getPathCost(terrain, path)).toBe(3);
    });

    test('tolerates an empty or invalid path', () => {
        expect(getPathCost(createEmptyTerrain(), [])).toBe(0);
        expect(getPathCost(createEmptyTerrain(), null)).toBe(0);
    });
});

describe('getReachableCells', () => {
    test('on open ground it matches the Chebyshev square', () => {
        const cells = getReachableCells(createEmptyTerrain(), 10, 10, 30, 40, 40);
        expect(cells).toHaveLength(13 * 13); // radius 6
    });

    test('no movement means only the origin', () => {
        const cells = getReachableCells(createEmptyTerrain(), 5, 5, 0, 10, 10);
        expect(cells).toEqual([{ gridX: 5, gridY: 5, cost: 0, kind: 'move' }]);
    });

    test('clips against the board edges', () => {
        const cells = getReachableCells(createEmptyTerrain(), 0, 0, 50, 5, 5);
        expect(cells).toHaveLength(25);
        expect(cells.every(c => c.gridX >= 0 && c.gridY >= 0 && c.gridX < 5 && c.gridY < 5)).toBe(true);
    });

    // The reason this replaces the naive version in combat-rules.js.
    test('does not reach through a wall', () => {
        const terrain = terrainFromMap([
            '.....',
            '.....',
            '#####',
            '.....',
            '.....',
        ]);
        const cells = getReachableCells(terrain, 2, 0, 50, 5, 5);
        const keys = new Set(cells.map(c => `${c.gridX},${c.gridY}`));
        expect(keys.has('2,1')).toBe(true);
        expect(keys.has('2,2')).toBe(false); // the wall itself
        expect(keys.has('2,3')).toBe(false); // beyond it
    });

    test('difficult ground eats into the budget', () => {
        const open = getReachableCells(createEmptyTerrain(), 2, 2, 10, 5, 5);
        const rough = getReachableCells(terrainFromMap([
            '~~~~~',
            '~~~~~',
            '~~.~~',
            '~~~~~',
            '~~~~~',
        ]), 2, 2, 10, 5, 5);
        expect(rough.length).toBeLessThan(open.length);
    });

    test('reports the cost of reaching each cell', () => {
        const cells = getReachableCells(createEmptyTerrain(), 0, 0, 15, 10, 10);
        const byKey = new Map(cells.map(c => [`${c.gridX},${c.gridY}`, c.cost]));
        expect(byKey.get('0,0')).toBe(0);
        expect(byKey.get('1,1')).toBe(1); // diagonals cost the same as straights
        expect(byKey.get('3,0')).toBe(3);
    });

    test('an origin on impassable ground reaches nothing', () => {
        const terrain = terrainFromMap(['#']);
        expect(getReachableCells(terrain, 0, 0, 30, 5, 5)).toEqual([]);
    });

    test('routes around an obstacle rather than through it', () => {
        const terrain = terrainFromMap([
            '.....',
            '.###.',
            '.....',
        ]);
        // Straight down is two cells but walled. The way round is six, because the
        // diagonals past the wall ends are corner cuts and therefore illegal.
        const short = getReachableCells(terrain, 2, 0, 20, 5, 3); // 4 cells of movement
        expect(new Map(short.map(c => [`${c.gridX},${c.gridY}`, c.cost])).get('2,2')).toBeUndefined();

        const long = getReachableCells(terrain, 2, 0, 30, 5, 3); // 6 cells
        expect(new Map(long.map(c => [`${c.gridX},${c.gridY}`, c.cost])).get('2,2')).toBe(6);
    });

    test('corner cutting, when allowed, shortens the way round', () => {
        const terrain = terrainFromMap([
            '.....',
            '.###.',
            '.....',
        ]);
        const cells = getReachableCells(terrain, 2, 0, 30, 5, 3, { allowCornerCutting: true });
        const cost = new Map(cells.map(c => [`${c.gridX},${c.gridY}`, c.cost])).get('2,2');
        expect(cost).toBeLessThan(6);
    });
});
