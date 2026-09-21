import { describe, test, expect } from '@jest/globals';
import {
    parseHitDie, getHitDice, planShortRest, planLongRest, describeRest, DEFAULT_HIT_DIE,
} from '../public/scripts/game-engine/rules/rest.js';

const hurt = (over = {}) => ({
    id: 1, name: 'Lyra', hp: 4, maxHp: 20, level: 3, constitution: 14, class: 'guerrero', ...over,
});

describe('the hit die a character rolls', () => {
    test('is read from whatever the class entry says', () => {
        expect(parseHitDie('d10')).toBe(10);
        expect(parseHitDie('D8')).toBe(8);
        expect(parseHitDie('1d6')).toBe(6);
        expect(parseHitDie('d 12')).toBe(12);
    });

    test('and nothing is read from nonsense', () => {
        expect(parseHitDie('')).toBe(0);
        expect(parseHitDie(null)).toBe(0);
        expect(parseHitDie('grande')).toBe(0);
        expect(parseHitDie('d0')).toBe(0);
        expect(parseHitDie('d999')).toBe(0);
    });

    test('the class decides it, unless the character says otherwise', () => {
        expect(getHitDice(hurt(), { guerrero: 'd10' }).faces).toBe(10);
        expect(getHitDice(hurt({ hitDie: 'd12' }), { guerrero: 'd10' }).faces).toBe(12);
    });

    test('somebody with no class at all still has a die', () => {
        expect(getHitDice({ level: 1 }).faces).toBe(DEFAULT_HIT_DIE);
    });

    test('one die per level, and spent ones cannot go below zero or above the total', () => {
        expect(getHitDice(hurt({ level: 5, hitDiceSpent: 2 }))).toMatchObject({ total: 5, spent: 2, available: 3 });
        expect(getHitDice(hurt({ level: 2, hitDiceSpent: 9 }))).toMatchObject({ spent: 2, available: 0 });
        expect(getHitDice(hurt({ level: 0, hitDiceSpent: -3 }))).toMatchObject({ total: 1, spent: 0 });
    });
});

describe('a short rest', () => {
    const roll = (value) => () => value;

    test('spends dice until somebody is whole again', () => {
        const { entries, healed, diceSpent } = planShortRest({ party: [hurt()], rollDie: roll(5) });
        // 4 + (5+2) + (5+2) = 18, then one more die to reach 20.
        expect(entries[0]).toMatchObject({ hpBefore: 4, hpAfter: 20, diceSpent: 3 });
        expect(entries[0].rolls).toEqual([5, 5, 5]);
        expect(healed).toBe(16);
        expect(diceSpent).toBe(3);
    });

    test('and stops when the dice run out, hurt or not', () => {
        const { entries } = planShortRest({ party: [hurt({ level: 1 })], rollDie: roll(3) });
        expect(entries[0]).toMatchObject({ diceSpent: 1, hpAfter: 9 });
    });

    test('somebody already whole spends nothing: dice are too scarce', () => {
        const { entries, diceSpent } = planShortRest({ party: [hurt({ hp: 20 })], rollDie: roll(6) });
        expect(diceSpent).toBe(0);
        expect(entries[0].note).toMatch(/Ya estaba entero/);
    });

    test('somebody with no dice left is told why nothing happened', () => {
        const { entries } = planShortRest({ party: [hurt({ hitDiceSpent: 3 })], rollDie: roll(6) });
        expect(entries[0]).toMatchObject({ healed: 0, diceSpent: 0 });
        expect(entries[0].note).toMatch(/Sin dados de golpe/);
    });

    // A breather is not a resurrection: 5e needs a spell or somebody to stabilise you.
    test('nobody who is down gets up', () => {
        const { entries } = planShortRest({ party: [hurt({ hp: 0 })], rollDie: roll(6) });
        expect(entries[0]).toMatchObject({ hpAfter: 0, diceSpent: 0 });
        expect(entries[0].note).toMatch(/no levanta a nadie/);
    });

    test('a terrible Constitution never takes hit points away', () => {
        const { entries } = planShortRest({ party: [hurt({ constitution: 1 })], rollDie: roll(1) });
        expect(entries[0].hpAfter).toBeGreaterThanOrEqual(entries[0].hpBefore);
    });
});

describe('a long rest', () => {
    test('gives every hit point back', () => {
        const { entries, healed } = planLongRest({ party: [hurt()] });
        expect(entries[0]).toMatchObject({ hpBefore: 4, hpAfter: 20 });
        expect(healed).toBe(16);
    });

    // The rounding is the whole economy: a night does not erase the day.
    test('and half the spent dice, rounded down', () => {
        expect(planLongRest({ party: [hurt({ level: 5, hitDiceSpent: 5 })] }).diceRegained).toBe(2);
        expect(planLongRest({ party: [hurt({ level: 9, hitDiceSpent: 9 })] }).diceRegained).toBe(4);
    });

    test('never fewer than one, however low the level', () => {
        expect(planLongRest({ party: [hurt({ level: 1, hitDiceSpent: 1 })] }).diceRegained).toBe(1);
    });

    test('and never more than were spent', () => {
        expect(planLongRest({ party: [hurt({ level: 9, hitDiceSpent: 1 })] }).diceRegained).toBe(1);
        expect(planLongRest({ party: [hurt({ level: 9, hitDiceSpent: 0 })] }).diceRegained).toBe(0);
    });

    // Waking healthy from a night on the floor would make being knocked out free.
    test('somebody at zero wakes at one hit point, not at full', () => {
        const { entries } = planLongRest({ party: [hurt({ hp: 0 })] });
        expect(entries[0].hpAfter).toBe(1);
        expect(entries[0].note).toMatch(/un solo punto de vida/);
    });
});

describe('what the rest says out loud', () => {
    test('a line per character, with the dice that were rolled', () => {
        const plan = planShortRest({ party: [hurt()], rollDie: () => 5 });
        const lines = describeRest('corto', plan);
        expect(lines[0]).toBe('Descanso corto.');
        expect(lines[1]).toBe('Lyra: 4 → 20 PG, 3 dados de golpe (5 + 5 + 5).');
    });

    test('and says what was regained after a long one', () => {
        const lines = describeRest('largo', planLongRest({ party: [hurt({ hitDiceSpent: 3, level: 3 })] }));
        expect(lines[1]).toContain('recupera 1 dado de golpe');
    });

    test('somebody who gained nothing gets their reason, not a line of zeroes', () => {
        const lines = describeRest('corto', planShortRest({ party: [hurt({ hp: 20 })], rollDie: () => 5 }));
        expect(lines[1]).toBe('Lyra: Ya estaba entero.');
    });
});

describe('an empty party', () => {
    test('rests without incident', () => {
        expect(planShortRest({ party: [], rollDie: () => 5 })).toEqual({ entries: [], healed: 0, diceSpent: 0 });
        expect(planLongRest({ party: null })).toEqual({ entries: [], healed: 0, diceRegained: 0 });
        expect(planShortRest({ party: [null, undefined], rollDie: () => 5 }).entries).toEqual([]);
    });
});

describe('the die that gets rolled', () => {
    // A fighter rolls d10. Rolling a d8 for everybody was the bug the browser found:
    // the module computed the faces and nobody used them.
    test('is the one the character actually has', () => {
        const seen = [];
        planShortRest({
            party: [hurt({ class: 'guerrero' }), hurt({ id: 2, class: 'mago', hitDie: 'd6' })],
            rollDie: (faces) => { seen.push(faces); return 1; },
            hitDieByClass: { guerrero: 'd10' },
        });
        expect(seen).toContain(10);
        expect(seen).toContain(6);
    });

    test('and the default when nothing says otherwise', () => {
        const seen = [];
        planShortRest({ party: [{ id: 1, name: 'X', hp: 1, maxHp: 50, level: 1 }], rollDie: (f) => { seen.push(f); return 1; } });
        expect(seen).toEqual([DEFAULT_HIT_DIE]);
    });
});
