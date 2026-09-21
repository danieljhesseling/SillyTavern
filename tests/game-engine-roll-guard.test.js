import { describe, test, expect } from '@jest/globals';
import {
    findRollClaims,
    getFormulaBounds,
    isClaimPossible,
    guardRolls,
    guardImpossibleRolls,
    describeCorrections,
} from '../public/scripts/game-engine/combat/roll-guard.js';

/** A roller that always returns the same number, so results are checkable. */
const always = (/** @type {number} */ value) => () => value;

describe('findRollClaims', () => {
    test('finds the equals form', () => {
        const claims = findRollClaims('Lyra ataca: 1d20+5 = 23 contra CA 15.');
        expect(claims).toHaveLength(1);
        expect(claims[0]).toMatchObject({ formula: '1d20+5', claimed: 23 });
    });

    test('finds the arrow and colon forms', () => {
        expect(findRollClaims('2d6 -> 9')[0]).toMatchObject({ formula: '2d6', claimed: 9 });
        expect(findRollClaims('1d8: 4')[0]).toMatchObject({ formula: '1d8', claimed: 4 });
        expect(findRollClaims('1d20 → 17')[0]).toMatchObject({ formula: '1d20', claimed: 17 });
    });

    test('finds the parenthesised form', () => {
        expect(findRollClaims('daño 2d6+3 (12)')[0]).toMatchObject({ formula: '2d6+3', claimed: 12 });
    });

    test('tolerates spaces inside the notation', () => {
        expect(findRollClaims('1 d 20 + 5 = 18')[0]).toMatchObject({ formula: '1d20+5', claimed: 18 });
    });

    test('handles a negative modifier', () => {
        expect(findRollClaims('1d20-2 = 7')[0]).toMatchObject({ formula: '1d20-2', claimed: 7 });
    });

    test('ignores notation with no claimed total', () => {
        expect(findRollClaims('Tira 1d20 para iniciativa.')).toEqual([]);
        expect(findRollClaims('El arma hace 2d6 de daño.')).toEqual([]);
    });

    test('leaves loose prose alone', () => {
        expect(findRollClaims('Lyra saca un resultado excelente.')).toEqual([]);
        expect(findRollClaims('Obtiene un 18 en la tirada.')).toEqual([]);
    });

    test('finds several claims in order', () => {
        const claims = findRollClaims('Ataque 1d20+5 = 22, daño 1d8+3 = 9.');
        expect(claims.map(c => c.formula)).toEqual(['1d20+5', '1d8+3']);
    });

    test('empty and non-string input is safe', () => {
        expect(findRollClaims('')).toEqual([]);
        expect(findRollClaims(null)).toEqual([]);
        expect(findRollClaims(undefined)).toEqual([]);
    });
});

describe('getFormulaBounds', () => {
    test('reports the possible range', () => {
        expect(getFormulaBounds('1d20')).toEqual({ min: 1, max: 20 });
        expect(getFormulaBounds('2d6')).toEqual({ min: 2, max: 12 });
        expect(getFormulaBounds('1d20+5')).toEqual({ min: 6, max: 25 });
        expect(getFormulaBounds('2d6-2')).toEqual({ min: 0, max: 10 });
    });

    test('unparseable formulas have no bounds', () => {
        expect(getFormulaBounds('nonsense')).toBeNull();
        expect(getFormulaBounds('')).toBeNull();
        expect(getFormulaBounds('0d6')).toBeNull();
    });
});

describe('isClaimPossible', () => {
    test('accepts a result inside the range', () => {
        expect(isClaimPossible('1d20+5', 18)).toBe(true);
        expect(isClaimPossible('1d20+5', 6)).toBe(true);
        expect(isClaimPossible('1d20+5', 25)).toBe(true);
    });

    test('rejects a result the dice cannot produce', () => {
        expect(isClaimPossible('1d20+5', 30)).toBe(false);
        expect(isClaimPossible('1d20+5', 2)).toBe(false);
        expect(isClaimPossible('2d6', 13)).toBe(false);
    });

    test('gives the benefit of the doubt when it cannot parse', () => {
        expect(isClaimPossible('garbage', 999)).toBe(true);
    });
});

describe('guardRolls', () => {
    test('replaces a fabricated total with the engine result', () => {
        const result = guardRolls('Lyra ataca: 1d20+5 = 23 contra CA 15.', always(11));
        expect(result.text).toBe('Lyra ataca: 1d20+5 = 11 contra CA 15.');
        expect(result.corrections).toEqual([{ formula: '1d20+5', claimed: 23, actual: 11 }]);
    });

    test('leaves the text untouched when the model happened to be right', () => {
        const text = 'Lyra ataca: 1d20+5 = 11.';
        const result = guardRolls(text, always(11));
        expect(result.text).toBe(text);
        expect(result.corrections).toEqual([]);
    });

    test('keeps whatever separator the model wrote', () => {
        expect(guardRolls('2d6 -> 9', always(5)).text).toBe('2d6 -> 5');
        expect(guardRolls('1d8: 4', always(6)).text).toBe('1d8: 6');
        expect(guardRolls('2d6+3 (12)', always(8)).text).toBe('2d6+3 (8)');
    });

    test('corrects several claims independently', () => {
        const rolls = { '1d20+5': 9, '1d8+3': 7 };
        const result = guardRolls(
            'Ataque 1d20+5 = 22, daño 1d8+3 = 11.',
            formula => rolls[formula],
        );
        expect(result.text).toBe('Ataque 1d20+5 = 9, daño 1d8+3 = 7.');
        expect(result.corrections).toHaveLength(2);
    });

    test('does not touch prose without structured claims', () => {
        const text = 'El goblin esquiva con agilidad y contraataca.';
        expect(guardRolls(text, always(3)).text).toBe(text);
    });

    test('preserves the surrounding text exactly', () => {
        const result = guardRolls('Antes. 1d20 = 20. Después.', always(4));
        expect(result.text).toBe('Antes. 1d20 = 4. Después.');
    });

    test('empty and non-string input is safe', () => {
        expect(guardRolls('', always(5))).toEqual({ text: '', corrections: [] });
        expect(guardRolls(null, always(5))).toEqual({ text: '', corrections: [] });
    });

    test('a roller returning nothing usable leaves the claim alone', () => {
        const text = '1d20+5 = 23';
        expect(guardRolls(text, () => NaN).text).toBe(text);
        expect(guardRolls(text, () => undefined).corrections).toEqual([]);
    });

    test('the impossible claim, which is the case that matters most', () => {
        // A natural 20 plus 5 cannot be 30, and this is exactly what models invent.
        const claim = '1d20+5 = 30';
        expect(isClaimPossible('1d20+5', 30)).toBe(false);
        expect(guardRolls(claim, always(17)).text).toBe('1d20+5 = 17');
    });

    test('does not corrupt numbers that are not the claimed total', () => {
        const result = guardRolls('CA 15, tirada 1d20+5 = 23, resta 8 puntos.', always(12));
        expect(result.text).toContain('CA 15');
        expect(result.text).toContain('resta 8 puntos');
        expect(result.text).toContain('1d20+5 = 12');
    });
});

describe('describeCorrections', () => {
    test('summarises what was fixed', () => {
        const line = describeCorrections([
            { formula: '1d20+5', claimed: 23, actual: 11 },
            { formula: '1d8', claimed: 8, actual: 3 },
        ]);
        expect(line).toContain('1d20+5: 23');
        expect(line).toContain('11');
        expect(line).toContain('1d8: 8');
    });

    test('says nothing when nothing was wrong', () => {
        expect(describeCorrections([])).toBeNull();
        expect(describeCorrections(null)).toBeNull();
    });
});

// The mode the game actually runs in over every incoming message. It only touches
// arithmetic that is provably wrong, so a correction is never a judgement call.
describe('guardImpossibleRolls', () => {
    const engine = () => 12;

    test('corrects a total the dice could not produce', () => {
        const result = guardImpossibleRolls('Ataque: 1d20+5 = 30', engine);
        expect(result.text).toBe('Ataque: 1d20+5 = 12');
        expect(result.corrections).toEqual([{ formula: '1d20+5', claimed: 30, actual: 12 }]);
    });

    test('leaves a possible total alone, even when the engine would have rolled another', () => {
        const result = guardImpossibleRolls('Ataque: 1d20+5 = 18', engine);
        expect(result.text).toBe('Ataque: 1d20+5 = 18');
        expect(result.corrections).toEqual([]);
    });

    // A guard that quietly consumed dice would change the game it is meant to referee.
    test('does not roll at all for claims it accepts', () => {
        let rolls = 0;
        guardImpossibleRolls('1d20+5 = 18 y 2d6 = 7', () => { rolls++; return 12; });
        expect(rolls).toBe(0);
    });

    test('corrects a total below the minimum as well as above the maximum', () => {
        expect(guardImpossibleRolls('2d6+2 = 1', engine).corrections).toHaveLength(1);
        expect(guardImpossibleRolls('2d6+2 = 99', engine).corrections).toHaveLength(1);
    });

    test('touches only the impossible claim when a message holds both', () => {
        const result = guardImpossibleRolls('1d20+5 = 18 y luego 1d20+5 = 40', engine);
        expect(result.text).toBe('1d20+5 = 18 y luego 1d20+5 = 12');
        expect(result.corrections).toHaveLength(1);
    });

    test('prose with no structured claim is returned untouched', () => {
        const prose = 'Lyra tira bien y el golpe entra limpio.';
        expect(guardImpossibleRolls(prose, engine).text).toBe(prose);
    });

    test('junk input does not throw', () => {
        for (const value of [null, undefined, 42]) {
            expect(() => guardImpossibleRolls(value, engine)).not.toThrow();
        }
    });
});
