import { describe, test, expect } from '@jest/globals';
import {
    seedFrom, createSeededRandom, seedForTurn, rollWith,
} from '../public/scripts/game-engine/combat/seeded-random.js';

describe('the seed', () => {
    test('the same word always gives the same seed', () => {
        expect(seedFrom('molino')).toBe(seedFrom('molino'));
        expect(seedFrom('molino')).not.toBe(seedFrom('sotano'));
    });

    test('a number is used as it is', () => {
        expect(seedFrom(42)).toBe(42);
        expect(seedFrom(-42)).toBe(42);
        expect(seedFrom(7.9)).toBe(7);
    });

    test('nothing is still a seed, not a crash', () => {
        expect(Number.isInteger(seedFrom(''))).toBe(true);
        expect(Number.isInteger(seedFrom(null))).toBe(true);
        expect(Number.isInteger(seedFrom(NaN))).toBe(true);
    });
});

describe('dice you can roll twice', () => {
    // The whole point: the fight goes the same way, so the only thing that differs is
    // the thing you changed.
    test('the same seed gives the same sequence', () => {
        const a = createSeededRandom('molino');
        const b = createSeededRandom('molino');
        const first = [a(), a(), a(), a(), a()];
        const second = [b(), b(), b(), b(), b()];
        expect(first).toEqual(second);
    });

    test('a different seed gives a different one', () => {
        const a = createSeededRandom('molino');
        const b = createSeededRandom('sotano');
        expect([a(), a(), a()]).not.toEqual([b(), b(), b()]);
    });

    test('every number is in range, and they are not all the same', () => {
        const random = createSeededRandom(1);
        const numbers = Array.from({ length: 500 }, () => random());
        expect(numbers.every(n => n >= 0 && n < 1)).toBe(true);
        expect(new Set(numbers).size).toBeGreaterThan(450);
    });

    test('the spread is not obviously lopsided', () => {
        const random = createSeededRandom('reparto');
        const buckets = [0, 0, 0, 0];
        for (let i = 0; i < 4000; i++) buckets[Math.floor(random() * 4)]++;
        expect(buckets.every(count => count > 800 && count < 1200)).toBe(true);
    });
});

describe('the seed of a turn', () => {
    // Two runs of the same turn get the same seed without anybody writing it down.
    test('is the same for the same turn of the same fight', () => {
        const turn = { campaign: 'Molino', round: 2, turnIndex: 1, actorId: '7' };
        expect(seedForTurn(turn)).toBe(seedForTurn({ ...turn }));
    });

    test('and different for a different round, actor or campaign', () => {
        const turn = { campaign: 'Molino', round: 2, turnIndex: 1, actorId: '7' };
        expect(seedForTurn({ ...turn, round: 3 })).not.toBe(seedForTurn(turn));
        expect(seedForTurn({ ...turn, actorId: '9' })).not.toBe(seedForTurn(turn));
        expect(seedForTurn({ ...turn, campaign: 'Otra' })).not.toBe(seedForTurn(turn));
    });

    test('a salt makes an otherwise identical turn roll differently', () => {
        const turn = { campaign: 'Molino', round: 1, turnIndex: 0, actorId: '1' };
        expect(seedForTurn({ ...turn, salt: 2 })).not.toBe(seedForTurn(turn));
    });

    test('an empty turn still produces a seed', () => {
        expect(Number.isInteger(seedForTurn({}))).toBe(true);
    });
});

describe('rolling a formula with a given die', () => {
    test('the same seed rolls the same dice', () => {
        expect(rollWith('2d6+3', createSeededRandom(7))).toEqual(rollWith('2d6+3', createSeededRandom(7)));
    });

    test('the arithmetic is the usual one', () => {
        const result = rollWith('3d8-2', createSeededRandom('x'));
        expect(result.rolls).toHaveLength(3);
        expect(result.rolls.every(r => r >= 1 && r <= 8)).toBe(true);
        expect(result.total).toBe(result.rolls.reduce((s, r) => s + r, 0) - 2);
        expect(result.modifier).toBe(-2);
    });

    test('a formula it cannot read rolls nothing rather than guessing', () => {
        expect(rollWith('un puñado', createSeededRandom(1))).toEqual({ total: 0, rolls: [], modifier: 0 });
        expect(rollWith('', createSeededRandom(1)).total).toBe(0);
        expect(rollWith(null, createSeededRandom(1)).total).toBe(0);
    });

    test('absurd formulas are clamped rather than hanging the tab', () => {
        expect(rollWith('9999d99999', createSeededRandom(1)).rolls).toHaveLength(100);
    });
});
