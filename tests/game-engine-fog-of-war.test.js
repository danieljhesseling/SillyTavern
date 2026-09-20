import { describe, test, expect } from '@jest/globals';
import { createEmptyTerrain, setCell } from '../public/scripts/game-engine/board/terrain.js';
import {
    createEmptyFog,
    normalizeFog,
    revealCells,
    computeVisibleSet,
    updateFog,
    getCellVisibility,
    isTokenVisible,
    createFullyExploredFog,
    getExploredFraction,
    DEFAULT_SIGHT_FEET,
} from '../public/scripts/game-engine/board/fog-of-war.js';

/** @param {string[]} rows */
function terrainFromMap(rows) {
    let terrain = createEmptyTerrain();
    rows.forEach((row, y) => {
        [...row].forEach((char, x) => {
            if (char === '#') terrain = setCell(terrain, x, y, 'wall');
            if (char === 'D') terrain = setCell(terrain, x, y, 'door', { open: false });
            if (char === 'o') terrain = setCell(terrain, x, y, 'door', { open: true });
        });
    });
    return terrain;
}

describe('normalizeFog', () => {
    test('junk input yields empty fog', () => {
        expect(normalizeFog(null)).toEqual(createEmptyFog());
        expect(normalizeFog('nope')).toEqual(createEmptyFog());
        expect(normalizeFog({})).toEqual(createEmptyFog());
    });

    test('drops malformed keys and falsy values', () => {
        const fog = normalizeFog({ explored: { 'over there': true, '1,1': true, '2,2': false } });
        expect(fog.explored).toEqual({ '1,1': true });
    });
});

describe('revealCells', () => {
    test('marks cells without mutating the input', () => {
        const before = createEmptyFog();
        const after = revealCells(before, [{ x: 1, y: 2 }]);
        expect(before.explored).toEqual({});
        expect(after.explored).toEqual({ '1,2': true });
    });

    test('is additive across calls', () => {
        let fog = revealCells(createEmptyFog(), [{ x: 0, y: 0 }]);
        fog = revealCells(fog, [{ x: 1, y: 1 }]);
        expect(Object.keys(fog.explored).sort()).toEqual(['0,0', '1,1']);
    });

    test('ignores an empty or invalid list', () => {
        expect(revealCells(createEmptyFog(), []).explored).toEqual({});
        expect(revealCells(createEmptyFog(), null).explored).toEqual({});
        expect(revealCells(createEmptyFog(), [null, { x: NaN, y: 0 }]).explored).toEqual({});
    });
});

describe('computeVisibleSet', () => {
    test('no tokens means nothing is visible', () => {
        expect(computeVisibleSet(createEmptyTerrain(), [], 10, 10).size).toBe(0);
        expect(computeVisibleSet(createEmptyTerrain(), null, 10, 10).size).toBe(0);
    });

    test('a token sees a disc of its sight radius', () => {
        const visible = computeVisibleSet(createEmptyTerrain(), [
            { gridX: 5, gridY: 5, sightFeet: 10 }, // 2 cells
        ], 20, 20);
        expect(visible.size).toBe(5 * 5);
        expect(visible.has('5,5')).toBe(true);
        expect(visible.has('7,7')).toBe(true);
        expect(visible.has('8,8')).toBe(false);
    });

    test('sight radius defaults when the token declares none', () => {
        const withDefault = computeVisibleSet(createEmptyTerrain(), [{ gridX: 20, gridY: 20 }], 60, 60);
        const explicit = computeVisibleSet(createEmptyTerrain(), [
            { gridX: 20, gridY: 20, sightFeet: DEFAULT_SIGHT_FEET },
        ], 60, 60);
        expect(withDefault.size).toBe(explicit.size);
    });

    test('two tokens see the union of their areas', () => {
        const terrain = createEmptyTerrain();
        const one = computeVisibleSet(terrain, [{ gridX: 2, gridY: 2, sightFeet: 5 }], 20, 20);
        const both = computeVisibleSet(terrain, [
            { gridX: 2, gridY: 2, sightFeet: 5 },
            { gridX: 15, gridY: 15, sightFeet: 5 },
        ], 20, 20);
        expect(both.size).toBeGreaterThan(one.size);
        expect(both.has('2,2')).toBe(true);
        expect(both.has('15,15')).toBe(true);
    });

    test('walls cut the visible area down', () => {
        const open = computeVisibleSet(createEmptyTerrain(), [{ gridX: 3, gridY: 3, sightFeet: 50 }], 7, 7);
        const walled = computeVisibleSet(terrainFromMap([
            '.......',
            '.#####.',
            '.#...#.',
            '.#...#.',
            '.#...#.',
            '.#####.',
            '.......',
        ]), [{ gridX: 3, gridY: 3, sightFeet: 50 }], 7, 7);
        expect(walled.size).toBeLessThan(open.size);
    });
});

describe('updateFog', () => {
    test('what is visible becomes explored', () => {
        const { fog, visible } = updateFog(
            createEmptyFog(), createEmptyTerrain(), [{ gridX: 1, gridY: 1, sightFeet: 5 }], 10, 10,
        );
        expect(visible.has('1,1')).toBe(true);
        expect(fog.explored['1,1']).toBe(true);
    });

    test('explored memory survives after the token walks away', () => {
        const terrain = createEmptyTerrain();
        const first = updateFog(createEmptyFog(), terrain, [{ gridX: 1, gridY: 1, sightFeet: 5 }], 20, 20);
        const second = updateFog(first.fog, terrain, [{ gridX: 15, gridY: 15, sightFeet: 5 }], 20, 20);

        expect(second.visible.has('1,1')).toBe(false);
        expect(second.fog.explored['1,1']).toBe(true);
    });

    test('opening a door reveals what was behind it', () => {
        const closed = terrainFromMap([
            '.....',
            '.....',
            '##D##',
            '.....',
            '.....',
        ]);
        const open = terrainFromMap([
            '.....',
            '.....',
            '##o##',
            '.....',
            '.....',
        ]);
        const tokens = [{ gridX: 2, gridY: 0, sightFeet: 50 }];

        const before = updateFog(createEmptyFog(), closed, tokens, 5, 5);
        const after = updateFog(before.fog, open, tokens, 5, 5);

        expect(before.visible.has('2,4')).toBe(false);
        expect(after.visible.has('2,4')).toBe(true);
    });
});

describe('getCellVisibility', () => {
    test('reports the three states', () => {
        const fog = revealCells(createEmptyFog(), [{ x: 1, y: 1 }, { x: 2, y: 2 }]);
        const visible = new Set(['1,1']);

        expect(getCellVisibility(fog, visible, 1, 1)).toBe('visible');
        expect(getCellVisibility(fog, visible, 2, 2)).toBe('explored');
        expect(getCellVisibility(fog, visible, 9, 9)).toBe('unknown');
    });

    test('tolerates missing fog or visibility', () => {
        expect(getCellVisibility(null, null, 0, 0)).toBe('unknown');
        expect(getCellVisibility(createEmptyFog(), undefined, 0, 0)).toBe('unknown');
    });
});

describe('isTokenVisible', () => {
    test('creatures are only drawn where sight reaches now', () => {
        const visible = new Set(['1,1']);
        expect(isTokenVisible(visible, 1, 1)).toBe(true);
        expect(isTokenVisible(visible, 2, 2)).toBe(false);
    });

    test('a remembered cell does not remember the creature on it', () => {
        const fog = revealCells(createEmptyFog(), [{ x: 5, y: 5 }]);
        const visible = new Set();
        expect(getCellVisibility(fog, visible, 5, 5)).toBe('explored');
        expect(isTokenVisible(visible, 5, 5)).toBe(false);
    });
});

describe('createFullyExploredFog', () => {
    test('marks every cell of the board', () => {
        const fog = createFullyExploredFog(4, 3);
        expect(Object.keys(fog.explored)).toHaveLength(12);
        expect(fog.explored['3,2']).toBe(true);
    });
});

describe('getExploredFraction', () => {
    test('runs from nothing to everything', () => {
        expect(getExploredFraction(createEmptyFog(), 10, 10)).toBe(0);
        expect(getExploredFraction(createFullyExploredFog(10, 10), 10, 10)).toBe(1);
    });

    test('reports a partial reveal', () => {
        const fog = revealCells(createEmptyFog(), [{ x: 0, y: 0 }, { x: 1, y: 0 }]);
        expect(getExploredFraction(fog, 10, 10)).toBeCloseTo(0.02);
    });

    test('a board with no area reports zero instead of dividing by it', () => {
        expect(getExploredFraction(createEmptyFog(), 0, 0)).toBe(0);
    });
});
