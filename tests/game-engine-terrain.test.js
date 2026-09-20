import { describe, test, expect } from '@jest/globals';
import {
    TERRAIN_TYPES,
    DEFAULT_TERRAIN,
    cellKey,
    parseCellKey,
    createEmptyTerrain,
    normalizeTerrain,
    getCell,
    getCellDefinition,
    setCell,
    setDoorOpen,
    isInsideGrid,
    isPassable,
    blocksSight,
    getMovementCost,
    getCoverBonus,
    getTerrainOptions,
} from '../public/scripts/game-engine/board/terrain.js';

describe('cellKey / parseCellKey', () => {
    test('round-trips coordinates', () => {
        expect(parseCellKey(cellKey(3, 7))).toEqual({ x: 3, y: 7 });
        expect(parseCellKey(cellKey(-2, 0))).toEqual({ x: -2, y: 0 });
    });

    test('truncates fractional coordinates', () => {
        expect(cellKey(3.9, 7.2)).toBe('3,7');
    });

    test('rejects malformed keys', () => {
        expect(parseCellKey('nonsense')).toBeNull();
        expect(parseCellKey('1,2,3')).toBeNull();
        expect(parseCellKey('')).toBeNull();
        expect(parseCellKey('a,b')).toBeNull();
    });
});

describe('normalizeTerrain', () => {
    test('junk input yields empty terrain', () => {
        expect(normalizeTerrain(null)).toEqual(createEmptyTerrain());
        expect(normalizeTerrain('nope')).toEqual(createEmptyTerrain());
        expect(normalizeTerrain(undefined)).toEqual(createEmptyTerrain());
        expect(normalizeTerrain({})).toEqual(createEmptyTerrain());
    });

    test('drops unknown terrain types', () => {
        const result = normalizeTerrain({ cells: { '1,1': { type: 'lava' } } });
        expect(result.cells).toEqual({});
    });

    test('drops malformed cell keys', () => {
        const result = normalizeTerrain({ cells: { 'over there': { type: 'wall' } } });
        expect(result.cells).toEqual({});
    });

    test('does not store cells that are just the default', () => {
        const result = normalizeTerrain({ cells: { '1,1': { type: 'floor' } } });
        expect(result.cells).toEqual({});
    });

    test('keeps valid cells and stamps the schema version', () => {
        const result = normalizeTerrain({ cells: { '2,3': { type: 'wall' } } });
        expect(result.cells['2,3']).toEqual({ type: 'wall' });
        expect(result.version).toBe(1);
    });

    test('gives doors an explicit open flag', () => {
        expect(normalizeTerrain({ cells: { '0,0': { type: 'door' } } }).cells['0,0'])
            .toEqual({ type: 'door', open: false });
        expect(normalizeTerrain({ cells: { '0,0': { type: 'door', open: 'yes' } } }).cells['0,0'])
            .toEqual({ type: 'door', open: true });
    });

    test('accepts a bare type string as the cell value', () => {
        expect(normalizeTerrain({ cells: { '4,4': 'wall' } }).cells['4,4']).toEqual({ type: 'wall' });
    });
});

describe('setCell', () => {
    test('writes a cell without mutating the original', () => {
        const before = createEmptyTerrain();
        const after = setCell(before, 1, 1, 'wall');
        expect(before.cells).toEqual({});
        expect(after.cells['1,1']).toEqual({ type: 'wall' });
    });

    test('setting a cell back to the default removes it', () => {
        const withWall = setCell(createEmptyTerrain(), 1, 1, 'wall');
        expect(setCell(withWall, 1, 1, 'floor').cells).toEqual({});
    });

    test('an unknown type also clears the cell', () => {
        const withWall = setCell(createEmptyTerrain(), 1, 1, 'wall');
        expect(setCell(withWall, 1, 1, 'lava').cells).toEqual({});
    });

    test('overwrites an existing cell', () => {
        let terrain = setCell(createEmptyTerrain(), 2, 2, 'wall');
        terrain = setCell(terrain, 2, 2, 'difficult');
        expect(terrain.cells['2,2']).toEqual({ type: 'difficult' });
    });
});

describe('doors', () => {
    test('a closed door blocks movement and sight', () => {
        const terrain = setCell(createEmptyTerrain(), 5, 5, 'door', { open: false });
        expect(isPassable(terrain, 5, 5, 10, 10)).toBe(false);
        expect(blocksSight(terrain, 5, 5)).toBe(true);
    });

    test('an open door behaves like floor', () => {
        const terrain = setCell(createEmptyTerrain(), 5, 5, 'door', { open: true });
        expect(isPassable(terrain, 5, 5, 10, 10)).toBe(true);
        expect(blocksSight(terrain, 5, 5)).toBe(false);
        expect(getMovementCost(terrain, 5, 5)).toBe(1);
    });

    test('setDoorOpen toggles the state', () => {
        let terrain = setCell(createEmptyTerrain(), 5, 5, 'door');
        expect(isPassable(terrain, 5, 5, 10, 10)).toBe(false);
        terrain = setDoorOpen(terrain, 5, 5, true);
        expect(isPassable(terrain, 5, 5, 10, 10)).toBe(true);
        terrain = setDoorOpen(terrain, 5, 5, false);
        expect(isPassable(terrain, 5, 5, 10, 10)).toBe(false);
    });

    test('setDoorOpen leaves other terrain alone', () => {
        const terrain = setCell(createEmptyTerrain(), 5, 5, 'wall');
        expect(setDoorOpen(terrain, 5, 5, true).cells['5,5']).toEqual({ type: 'wall' });
    });
});

describe('isInsideGrid', () => {
    test('accepts cells within bounds', () => {
        expect(isInsideGrid(0, 0, 10, 10)).toBe(true);
        expect(isInsideGrid(9, 9, 10, 10)).toBe(true);
    });

    test('rejects cells outside bounds', () => {
        expect(isInsideGrid(-1, 0, 10, 10)).toBe(false);
        expect(isInsideGrid(10, 0, 10, 10)).toBe(false);
        expect(isInsideGrid(0, 10, 10, 10)).toBe(false);
    });

    test('rejects non-finite coordinates', () => {
        expect(isInsideGrid(NaN, 0, 10, 10)).toBe(false);
        expect(isInsideGrid(0, Infinity, 10, 10)).toBe(false);
    });
});

describe('cell queries', () => {
    test('an unlisted cell reads as the default', () => {
        const terrain = createEmptyTerrain();
        expect(getCell(terrain, 4, 4)).toEqual({ type: DEFAULT_TERRAIN });
        expect(isPassable(terrain, 4, 4, 10, 10)).toBe(true);
        expect(blocksSight(terrain, 4, 4)).toBe(false);
        expect(getMovementCost(terrain, 4, 4)).toBe(1);
        expect(getCoverBonus(terrain, 4, 4)).toBe(0);
    });

    test('a cell outside the board is never passable', () => {
        const terrain = createEmptyTerrain();
        expect(isPassable(terrain, -1, 0, 10, 10)).toBe(false);
        expect(isPassable(terrain, 10, 10, 10, 10)).toBe(false);
    });

    test('a wall blocks movement and sight', () => {
        const terrain = setCell(createEmptyTerrain(), 3, 3, 'wall');
        expect(isPassable(terrain, 3, 3, 10, 10)).toBe(false);
        expect(blocksSight(terrain, 3, 3)).toBe(true);
        expect(getMovementCost(terrain, 3, 3)).toBe(Infinity);
    });

    test('difficult ground costs double but is walkable and transparent', () => {
        const terrain = setCell(createEmptyTerrain(), 3, 3, 'difficult');
        expect(isPassable(terrain, 3, 3, 10, 10)).toBe(true);
        expect(blocksSight(terrain, 3, 3)).toBe(false);
        expect(getMovementCost(terrain, 3, 3)).toBe(2);
    });

    test('cover grants AC without blocking anything', () => {
        let terrain = setCell(createEmptyTerrain(), 1, 1, 'cover_half');
        terrain = setCell(terrain, 2, 2, 'cover_three_quarters');
        expect(getCoverBonus(terrain, 1, 1)).toBe(2);
        expect(getCoverBonus(terrain, 2, 2)).toBe(5);
        expect(isPassable(terrain, 1, 1, 10, 10)).toBe(true);
        expect(blocksSight(terrain, 2, 2)).toBe(false);
    });

    test('a corrupt stored type falls back to the default', () => {
        const terrain = { version: 1, cells: { '1,1': { type: 'lava' } } };
        expect(getCellDefinition(terrain, 1, 1)).toBe(TERRAIN_TYPES[DEFAULT_TERRAIN]);
    });
});

describe('getTerrainOptions', () => {
    test('offers every terrain type as a value/label pair', () => {
        const options = getTerrainOptions();
        expect(options.length).toBe(Object.keys(TERRAIN_TYPES).length);
        expect(options).toContainEqual(['wall', 'Wall']);
        expect(options.every(([value, label]) => typeof value === 'string' && typeof label === 'string')).toBe(true);
    });
});

describe('storage stays sparse', () => {
    test('a board of open floor stores nothing', () => {
        let terrain = createEmptyTerrain();
        for (let x = 0; x < 50; x++) {
            for (let y = 0; y < 50; y++) {
                terrain = setCell(terrain, x, y, 'floor');
            }
        }
        expect(Object.keys(terrain.cells)).toHaveLength(0);
        expect(JSON.stringify(terrain).length).toBeLessThan(60);
    });

    test('only the exceptions are written down', () => {
        let terrain = createEmptyTerrain();
        for (let x = 0; x < 10; x++) {
            terrain = setCell(terrain, x, 0, 'wall');
        }
        expect(Object.keys(terrain.cells)).toHaveLength(10);
    });
});
