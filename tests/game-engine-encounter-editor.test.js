import { describe, test, expect } from '@jest/globals';
import { toRows, fromRows, describeEncounters } from '../public/scripts/game-engine/campaign/encounter-editor.js';

const names = { 7: 'Cuervo grande', 9: 'Guardián del grano' };
const ids = { 'Cuervo grande': '7', 'Guardián del grano': '9' };

describe('reading a board rules for editing', () => {
    test('ids become names', () => {
        expect(toRows([{ enemyId: '7', minCount: 1, maxCount: 3 }], names))
            .toEqual([{ name: 'Cuervo grande', minCount: 1, maxCount: 3 }]);
    });

    test('an id nobody knows is shown as it is', () => {
        expect(toRows([{ enemyId: '99', minCount: 1, maxCount: 1 }], names)[0].name).toBe('99');
    });

    test('missing counts become a sane single enemy', () => {
        expect(toRows([{ enemyId: '7' }], names)[0]).toMatchObject({ minCount: 1, maxCount: 1 });
    });

    test('a maximum below the minimum is straightened out on the way in', () => {
        expect(toRows([{ enemyId: '7', minCount: 3, maxCount: 1 }], names)[0])
            .toMatchObject({ minCount: 3, maxCount: 3 });
    });

    test('junk is skipped', () => {
        expect(toRows(null)).toEqual([]);
        expect(toRows([null, false])).toEqual([]);
    });
});

describe('saving the rows back', () => {
    test('names become the ids /fight looks up', () => {
        const { rules, problems } = fromRows([{ name: 'Cuervo grande', minCount: 1, maxCount: 2 }], ids);
        expect(rules).toEqual([{ enemyId: '7', minCount: 1, maxCount: 2 }]);
        expect(problems).toEqual([]);
    });

    test('a round trip changes nothing', () => {
        const saved = [{ enemyId: '7', minCount: 1, maxCount: 2 }, { enemyId: '9', minCount: 1, maxCount: 1 }];
        expect(fromRows(toRows(saved, names), ids).rules).toEqual(saved);
    });

    // An empty rule would make /fight find nothing, silently.
    test('a name nobody knows is reported, not saved empty', () => {
        const { rules, problems } = fromRows([{ name: 'Dragón', minCount: 1, maxCount: 1 }], ids);
        expect(rules).toEqual([]);
        expect(problems[0]).toMatch(/"Dragón" no existe/);
    });

    test('a rule with no enemy at all is reported', () => {
        expect(fromRows([{ name: '  ', minCount: 1, maxCount: 1 }], ids).problems[0]).toMatch(/sin enemigo/);
    });

    // Two rules for the same creature would roll twice and field more than either says.
    test('the same enemy twice is refused, with what to do about it', () => {
        const { rules, problems } = fromRows([
            { name: 'Cuervo grande', minCount: 1, maxCount: 2 },
            { name: 'Cuervo grande', minCount: 3, maxCount: 4 },
        ], ids);
        expect(rules).toHaveLength(1);
        expect(problems[0]).toMatch(/junta las dos en un solo rango/);
    });

    test('a maximum below the minimum is refused rather than guessed', () => {
        const { rules, problems } = fromRows([{ name: 'Cuervo grande', minCount: 3, maxCount: 1 }], ids);
        expect(rules).toEqual([]);
        expect(problems[0]).toMatch(/menor que el mínimo/);
    });

    test('zero and nonsense counts fall back to one', () => {
        expect(fromRows([{ name: 'Cuervo grande', minCount: 0, maxCount: 'muchos' }], ids).rules[0])
            .toEqual({ enemyId: '7', minCount: 1, maxCount: 1 });
    });
});

describe('how the rules read', () => {
    test('a fixed count and a range read differently', () => {
        expect(describeEncounters([{ name: 'Cuervo', minCount: 2, maxCount: 2 }])).toBe('Cuervo ×2');
        expect(describeEncounters([{ name: 'Cuervo', minCount: 1, maxCount: 3 }])).toBe('Cuervo ×1–3');
    });

    test('and an empty board says so', () => {
        expect(describeEncounters([])).toMatch(/no tiene enemigos declarados/);
        expect(describeEncounters(null)).toMatch(/no tiene enemigos/);
    });
});
