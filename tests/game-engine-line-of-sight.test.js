import { describe, test, expect } from '@jest/globals';
import { createEmptyTerrain, setCell } from '../public/scripts/game-engine/board/terrain.js';
import {
    getRayCells,
    hasLineOfSight,
    getVisibleCells,
    sightRadiusInCells,
} from '../public/scripts/game-engine/board/line-of-sight.js';

/**
 * Builds terrain from an ASCII map, which is far easier to read than setCell chains.
 * '#' wall, '.' floor, 'D' closed door, 'o' open door, '~' difficult.
 * @param {string[]} rows
 */
function terrainFromMap(rows) {
    let terrain = createEmptyTerrain();
    rows.forEach((row, y) => {
        [...row].forEach((char, x) => {
            if (char === '#') terrain = setCell(terrain, x, y, 'wall');
            if (char === 'D') terrain = setCell(terrain, x, y, 'door', { open: false });
            if (char === 'o') terrain = setCell(terrain, x, y, 'door', { open: true });
            if (char === '~') terrain = setCell(terrain, x, y, 'difficult');
        });
    });
    return terrain;
}

describe('getRayCells', () => {
    test('a cell to itself crosses nothing', () => {
        expect(getRayCells(3, 3, 3, 3)).toEqual([]);
    });

    test('adjacent cells have nothing in between', () => {
        expect(getRayCells(0, 0, 1, 0)).toEqual([]);
        expect(getRayCells(0, 0, 1, 1)).toEqual([]);
    });

    test('a horizontal ray lists the cells in between', () => {
        expect(getRayCells(0, 0, 4, 0)).toEqual([
            { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 },
        ]);
    });

    test('a vertical ray lists the cells in between', () => {
        expect(getRayCells(2, 0, 2, 3)).toEqual([
            { x: 2, y: 1 }, { x: 2, y: 2 },
        ]);
    });

    test('a pure diagonal walks the diagonal only', () => {
        expect(getRayCells(0, 0, 3, 3)).toEqual([
            { x: 1, y: 1 }, { x: 2, y: 2 },
        ]);
    });

    test('never includes either endpoint', () => {
        const cells = getRayCells(0, 0, 5, 3);
        expect(cells).not.toContainEqual({ x: 0, y: 0 });
        expect(cells).not.toContainEqual({ x: 5, y: 3 });
    });
});

describe('hasLineOfSight', () => {
    test('sees across open floor', () => {
        expect(hasLineOfSight(createEmptyTerrain(), 0, 0, 9, 9)).toBe(true);
    });

    test('a wall in between blocks the view', () => {
        const terrain = terrainFromMap([
            '.....',
            '.....',
            '..#..',
            '.....',
            '.....',
        ]);
        expect(hasLineOfSight(terrain, 2, 0, 2, 4)).toBe(false);
    });

    test('a wall beside the line does not block', () => {
        const terrain = terrainFromMap([
            '.....',
            '.....',
            '.#...',
            '.....',
            '.....',
        ]);
        expect(hasLineOfSight(terrain, 2, 0, 2, 4)).toBe(true);
    });

    test('you can always see your own cell, even standing in a wall', () => {
        const terrain = terrainFromMap(['#']);
        expect(hasLineOfSight(terrain, 0, 0, 0, 0)).toBe(true);
    });

    test('a creature standing in a wall cell is still visible', () => {
        const terrain = terrainFromMap([
            '....#',
        ]);
        expect(hasLineOfSight(terrain, 0, 0, 4, 0)).toBe(true);
    });

    test('a closed door blocks, an open one does not', () => {
        const closed = terrainFromMap(['..D..']);
        const open = terrainFromMap(['..o..']);
        expect(hasLineOfSight(closed, 0, 0, 4, 0)).toBe(false);
        expect(hasLineOfSight(open, 0, 0, 4, 0)).toBe(true);
    });

    test('difficult ground does not block sight', () => {
        const terrain = terrainFromMap(['..~..']);
        expect(hasLineOfSight(terrain, 0, 0, 4, 0)).toBe(true);
    });

    // The reason this module does not use plain Bresenham.
    test('is symmetric across a wide range of walls and angles', () => {
        const terrain = terrainFromMap([
            '..........',
            '..##......',
            '.....#....',
            '..#.......',
            '......##..',
            '..........',
            '...#......',
            '.......#..',
            '..#.......',
            '..........',
        ]);

        const pairs = [];
        for (let ax = 0; ax < 10; ax++) {
            for (let ay = 0; ay < 10; ay++) {
                for (let bx = 0; bx < 10; bx++) {
                    for (let by = 0; by < 10; by++) {
                        pairs.push({
                            label: `(${ax},${ay})->(${bx},${by})`,
                            forward: hasLineOfSight(terrain, ax, ay, bx, by),
                            backward: hasLineOfSight(terrain, bx, by, ax, ay),
                        });
                    }
                }
            }
        }

        const asymmetric = pairs.filter(p => p.forward !== p.backward).map(p => p.label);
        expect(pairs).toHaveLength(10000);
        expect(asymmetric).toEqual([]);
    });

    test('a solid wall line cannot be seen through anywhere', () => {
        const terrain = terrainFromMap([
            '.....',
            '.....',
            '#####',
            '.....',
            '.....',
        ]);
        for (let x = 0; x < 5; x++) {
            expect(hasLineOfSight(terrain, x, 0, x, 4)).toBe(false);
        }
    });

    test('an open door in a wall lets the view through', () => {
        const terrain = terrainFromMap([
            '.....',
            '.....',
            '##o##',
            '.....',
            '.....',
        ]);
        expect(hasLineOfSight(terrain, 2, 0, 2, 4)).toBe(true);
        expect(hasLineOfSight(terrain, 0, 0, 0, 4)).toBe(false);
    });
});

describe('getVisibleCells', () => {
    test('a radius of zero sees only the origin', () => {
        const cells = getVisibleCells(createEmptyTerrain(), 5, 5, 0, 10, 10);
        expect(cells).toEqual([{ x: 5, y: 5 }]);
    });

    test('an open board gives the full Chebyshev square', () => {
        const cells = getVisibleCells(createEmptyTerrain(), 5, 5, 2, 20, 20);
        expect(cells).toHaveLength(5 * 5);
    });

    test('clips against the board edges', () => {
        const cells = getVisibleCells(createEmptyTerrain(), 0, 0, 3, 5, 5);
        expect(cells.every(c => c.x >= 0 && c.y >= 0 && c.x < 5 && c.y < 5)).toBe(true);
        expect(cells).toHaveLength(4 * 4);
    });

    test('an origin outside the board sees nothing', () => {
        expect(getVisibleCells(createEmptyTerrain(), -1, 0, 3, 10, 10)).toEqual([]);
        expect(getVisibleCells(createEmptyTerrain(), 10, 10, 3, 10, 10)).toEqual([]);
    });

    test('walls carve a shadow out of the visible area', () => {
        const terrain = terrainFromMap([
            '.....',
            '.....',
            '..#..',
            '.....',
            '.....',
        ]);
        const cells = getVisibleCells(terrain, 2, 0, 4, 5, 5);
        const seen = new Set(cells.map(c => `${c.x},${c.y}`));
        expect(seen.has('2,2')).toBe(true);  // the wall itself is visible
        expect(seen.has('2,3')).toBe(false); // directly behind it is not
        expect(seen.has('2,4')).toBe(false);
        expect(seen.has('0,3')).toBe(true);  // beside the shadow, still visible
    });

    test('a creature sealed in a room sees only the room and its walls', () => {
        const terrain = terrainFromMap([
            '#####',
            '#...#',
            '#...#',
            '#...#',
            '#####',
        ]);
        const cells = getVisibleCells(terrain, 2, 2, 10, 5, 5);
        const seen = new Set(cells.map(c => `${c.x},${c.y}`));
        expect(seen.has('1,1')).toBe(true);
        expect(seen.has('3,3')).toBe(true);
        // The diagonal to the corner runs through open floor at (1,1), so the corner is
        // visible. It is the cells beyond the walls that are not.
        expect(seen.has('0,0')).toBe(true);
        expect(cells.every(c => c.x <= 4 && c.y <= 4)).toBe(true);
    });

    test('nothing outside a sealed room is visible', () => {
        const terrain = terrainFromMap([
            '.......',
            '.#####.',
            '.#...#.',
            '.#...#.',
            '.#...#.',
            '.#####.',
            '.......',
        ]);
        const cells = getVisibleCells(terrain, 3, 3, 10, 7, 7);
        const seen = new Set(cells.map(c => `${c.x},${c.y}`));
        // The interior and the walls enclosing it are visible, including the corner at
        // (1,1): the diagonal to it runs through open interior floor. What is not visible
        // is anything beyond those walls.
        expect(seen.has('2,2')).toBe(true);
        expect(seen.has('1,1')).toBe(true);
        expect(seen.has('0,0')).toBe(false);
        expect(seen.has('6,6')).toBe(false);
        expect(seen.has('3,0')).toBe(false);
        expect(seen.has('0,3')).toBe(false);
    });
});

describe('sightRadiusInCells', () => {
    test('converts feet to cells at five feet each', () => {
        expect(sightRadiusInCells(60)).toBe(12);
        expect(sightRadiusInCells(30)).toBe(6);
        expect(sightRadiusInCells(0)).toBe(0);
    });

    test('rounds down and never goes negative', () => {
        expect(sightRadiusInCells(7)).toBe(1);
        expect(sightRadiusInCells(-30)).toBe(0);
        expect(sightRadiusInCells('nonsense')).toBe(0);
    });
});
