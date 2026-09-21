import { describe, test, expect } from '@jest/globals';
import {
    DEFAULT_LOOT_RULES,
    xpForChallenge,
    rollEnemyLoot,
    rollEncounterLoot,
} from '../public/scripts/game-engine/combat/loot.js';
import { DEFAULT_RULESET } from '../public/scripts/game-engine/rules/default-ruleset.js';

/** Fixed dice and a generous roll, so the numbers below are exact. */
const always = { roll: () => 7, random: () => 0.01 };
const never = { roll: () => 7, random: () => 0.99 };

describe('experience by challenge rating', () => {
    test('follows the D&D 5e table', () => {
        expect(xpForChallenge(0)).toBe(10);
        expect(xpForChallenge(0.25)).toBe(50);
        expect(xpForChallenge(1)).toBe(200);
        expect(xpForChallenge(5)).toBe(1800);
    });

    test('a rating between steps takes the lower one', () => {
        expect(xpForChallenge(0.3)).toBe(xpForChallenge(0.25));
        expect(xpForChallenge(2.9)).toBe(xpForChallenge(2));
    });

    test('never rewards nothing, whatever it is given', () => {
        for (const cr of [undefined, null, NaN, -5, 'dos']) {
            expect(xpForChallenge(cr)).toBeGreaterThan(0);
        }
    });

    test('a rating past the table keeps the highest step rather than falling to zero', () => {
        expect(xpForChallenge(30)).toBe(xpForChallenge(10));
    });
});

describe('one enemy', () => {
    test('gold grows with the challenge rating', () => {
        const weak = rollEnemyLoot({ cr: 0 }, always).gold;
        const strong = rollEnemyLoot({ cr: 5 }, always).gold;
        expect(strong).toBeGreaterThan(weak);
    });

    test('gold follows the rule table, not a number in the code', () => {
        const { gold } = rollEnemyLoot({ cr: 2 }, always);
        const { goldPerCr, goldDieMultiplier } = DEFAULT_LOOT_RULES;
        expect(gold).toBe(2 * goldPerCr + 7 * goldDieMultiplier);
    });

    // Loot that always drops stops being a reward and becomes an allowance.
    test('an item is a chance, not a certainty', () => {
        expect(rollEnemyLoot({ cr: 1 }, always).item).not.toBeNull();
        expect(rollEnemyLoot({ cr: 1 }, never).item).toBeNull();
    });

    test('a tougher enemy can drop something better', () => {
        expect(rollEnemyLoot({ cr: 0 }, always).item.rarity).toBe('Common');
        expect(rollEnemyLoot({ cr: 7 }, always).item.rarity).toBe('Rare');
    });

    test('every rarity it can name is one the rule pack knows', () => {
        for (const rarity of Object.keys(DEFAULT_LOOT_RULES.itemsByRarity)) {
            expect(DEFAULT_RULESET.items.rarity).toContain(rarity);
        }
    });

    test('an enemy with no challenge rating still gives something', () => {
        const { gold, xp } = rollEnemyLoot({}, always);
        expect(gold).toBeGreaterThan(0);
        expect(xp).toBeGreaterThan(0);
    });

    test('junk dice never produce negative gold', () => {
        expect(rollEnemyLoot({ cr: 1 }, { roll: () => NaN, random: () => 0.5 }).gold)
            .toBeGreaterThanOrEqual(0);
    });
});

describe('a whole encounter', () => {
    const enemies = [{ name: 'Ghoul', cr: 1 }, { name: 'Acólito', cr: 0.25 }];

    test('adds up every enemy', () => {
        const { xp } = rollEncounterLoot(enemies, 2, always);
        expect(xp).toBe(xpForChallenge(1) + xpForChallenge(0.25));
    });

    // Splitting between survivors gives the player one more reason to care whether
    // everyone is still standing when the last enemy falls.
    test('splits between those still standing, not the whole party', () => {
        const two = rollEncounterLoot(enemies, 2, always);
        const four = rollEncounterLoot(enemies, 4, always);
        expect(four.goldEach).toBeLessThan(two.goldEach);
        expect(two.gold).toBe(four.gold);
    });

    test('never hands out more than it rolled', () => {
        const { gold, goldEach, xp, xpEach } = rollEncounterLoot(enemies, 3, always);
        expect(goldEach * 3).toBeLessThanOrEqual(gold);
        expect(xpEach * 3).toBeLessThanOrEqual(xp);
    });

    test('a single survivor takes the lot', () => {
        const { gold, goldEach } = rollEncounterLoot(enemies, 1, always);
        expect(goldEach).toBe(gold);
    });

    test('names which enemy carried each item', () => {
        const { items } = rollEncounterLoot(enemies, 2, always);
        expect(items.length).toBeGreaterThan(0);
        for (const item of items) {
            expect(enemies.map(e => e.name)).toContain(item.from);
        }
    });

    test('reports itself in lines ready for the combat log', () => {
        const { lines } = rollEncounterLoot(enemies, 2, always);
        expect(lines[0]).toMatch(/Botín/);
        expect(lines.join(' ')).toMatch(/PX/);
    });

    test('an encounter with nobody defeated yields nothing to say', () => {
        expect(rollEncounterLoot([], 2, always)).toMatchObject({ gold: 0, xp: 0, items: [], lines: [] });
    });

    test('zero survivors does not divide by zero', () => {
        const result = rollEncounterLoot(enemies, 0, always);
        expect(Number.isFinite(result.goldEach)).toBe(true);
        expect(result.goldEach).toBeGreaterThan(0);
    });

    test('junk in place of a list of enemies is not an error', () => {
        for (const value of [null, undefined, 'goblin', 42]) {
            expect(rollEncounterLoot(value, 2, always).gold).toBe(0);
        }
    });
});

describe('the rules are data', () => {
    test('a pack that halves gold halves what drops', () => {
        const poorer = { ...DEFAULT_LOOT_RULES, goldPerCr: 5, goldDieMultiplier: 0 };
        expect(rollEnemyLoot({ cr: 4 }, { ...always, rules: poorer }).gold).toBe(20);
    });

    test('a pack that drops nothing drops nothing', () => {
        const barren = { ...DEFAULT_LOOT_RULES, itemChanceByCr: [[0, 0]] };
        expect(rollEnemyLoot({ cr: 9 }, { ...always, rules: barren }).item).toBeNull();
    });

    test('a pack with its own items uses them', () => {
        const custom = {
            ...DEFAULT_LOOT_RULES,
            rarityByCr: [[0, 'Common']],
            itemsByRarity: { Common: ['Diente de lobo'] },
        };
        expect(rollEnemyLoot({ cr: 1 }, { ...always, rules: custom }).item.name).toBe('Diente de lobo');
    });
});
