import { describe, test, expect } from '@jest/globals';
import { planSpawnCells } from '../public/scripts/game-engine/combat/spawn.js';
import { terrainFromAsciiMap } from '../public/scripts/game-engine/board/terrain.js';

/** A five-wide room with a wall down the middle of row 2. */
const map = [
    '#######',
    '#.....#',
    '#.###.#',
    '#.....#',
    '#######',
];
const board = { terrain: terrainFromAsciiMap(map), gridWidth: 7, gridHeight: 5 };
const placements = [
    { name: 'Cuervo', x: 5, y: 1 },
    { name: 'Cuervo', x: 5, y: 3 },
    { name: 'Guardián', x: 1, y: 3 },
];

describe('where a board says', () => {
    test('an enemy stands where the book drew it', () => {
        const cells = planSpawnCells({ name: 'Guardián', count: 1, placements, ...board });
        expect(cells).toEqual([{ x: 1, y: 3, fromBoard: true }]);
    });

    test('several of the same creature take their drawn cells in order', () => {
        const cells = planSpawnCells({ name: 'Cuervo', count: 2, placements, ...board });
        expect(cells).toEqual([
            { x: 5, y: 1, fromBoard: true },
            { x: 5, y: 3, fromBoard: true },
        ]);
    });

    test('the name is matched without regard to case', () => {
        expect(planSpawnCells({ name: 'guardián', count: 1, placements, ...board })[0])
            .toMatchObject({ x: 1, y: 3, fromBoard: true });
    });

    test('more copies than the book drew still all get a cell', () => {
        const cells = planSpawnCells({ name: 'Cuervo', count: 4, placements, ...board, random: () => 0.5 });
        expect(cells).toHaveLength(4);
        expect(cells.filter(c => c.fromBoard)).toHaveLength(2);
        expect(cells.every(c => c.x >= 0 && c.y >= 0)).toBe(true);
    });
});

describe('nobody ends up inside a wall', () => {
    // The old behaviour: a random cell of the top-left ten by ten, walls included.
    test('a random placement lands on floor, never on a wall', () => {
        for (let seed = 0; seed < 30; seed++) {
            const [cell] = planSpawnCells({
                name: 'Sin dibujar', count: 1, placements, ...board,
                random: () => (seed % 10) / 10,
            });
            expect(map[cell.y][cell.x]).toBe('.');
        }
    });

    test('a cell the book drew on a wall is not used', () => {
        const [cell] = planSpawnCells({
            name: 'Topo', count: 1, placements: [{ name: 'Topo', x: 3, y: 2 }], ...board, random: () => 0.3,
        });
        expect(cell.fromBoard).toBe(false);
        expect(map[cell.y][cell.x]).toBe('.');
    });

    test('two enemies never share a cell', () => {
        const cells = planSpawnCells({ name: 'X', count: 6, ...board, random: () => 0.5 });
        const keys = new Set(cells.map(c => `${c.x},${c.y}`));
        expect(keys.size).toBe(6);
    });

    test('cells already occupied by the party are left alone', () => {
        const taken = [{ x: 1, y: 3 }];
        const [cell] = planSpawnCells({ name: 'Guardián', count: 1, placements, ...board, taken, random: () => 0.2 });
        expect(cell.fromBoard).toBe(false);
        expect(`${cell.x},${cell.y}`).not.toBe('1,3');
    });

    // A fight that cannot place its enemies would be worse than one that places them oddly.
    test('when random never finds a gap, it scans for one', () => {
        const cells = planSpawnCells({ name: 'X', count: 1, ...board, random: () => 0 });
        expect(cells[0]).toMatchObject({ x: 1, y: 1 });
    });

    test('a board with no terrain still places everybody', () => {
        const cells = planSpawnCells({ name: 'X', count: 3, gridWidth: 10, gridHeight: 10, random: () => 0.5 });
        expect(cells).toHaveLength(3);
    });
});
