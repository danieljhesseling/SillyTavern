import { afterEach, describe, test, expect, jest } from '@jest/globals';
import {
    describeCover,
    rollDice,
    rollDiceDetailed,
    getRollClassification,
    getRollClassificationLabel,
    getDistanceInCells,
    getDistanceInFeet,
    buildReachableCells,
    getAttackRangeFeet,
    getPlayerDamageFormula,
    getEnemyDamageFormula,
    getPlayerAttackModifier,
    createEmptyCombatEncounter,
    normalizeCombatEncounter,
} from '../public/scripts/party/combat-rules.js';

/**
 * Pins Math.random so dice results are deterministic.
 * @param {number} value value in [0, 1)
 */
function pinRandom(value) {
    jest.spyOn(Math, 'random').mockReturnValue(value);
}

afterEach(() => {
    jest.restoreAllMocks();
});

describe('rollDiceDetailed', () => {
    test('parses count, sides and modifier', () => {
        pinRandom(0.5); // -> floor(0.5 * sides) + 1
        const result = rollDiceDetailed('3d6+2');
        expect(result.rolls).toEqual([4, 4, 4]);
        expect(result.modifier).toBe(2);
        expect(result.total).toBe(14);
        expect(result.formula).toBe('3d6+2');
    });

    test('supports a negative modifier', () => {
        pinRandom(0);
        expect(rollDiceDetailed('1d8-3').total).toBe(-2);
    });

    test('reports the natural roll only for a single d20', () => {
        pinRandom(0.95);
        expect(rollDiceDetailed('1d20').natural).toBe(20);
        expect(rollDiceDetailed('2d20').natural).toBeNull();
        expect(rollDiceDetailed('1d6').natural).toBeNull();
    });

    test('falls back to a single die when the formula is unparseable', () => {
        pinRandom(0);
        const result = rollDiceDetailed('not a formula', 20);
        expect(result.rolls).toHaveLength(1);
        expect(result.total).toBe(1);
        expect(result.natural).toBe(1);
    });

    test('an empty formula becomes 1d<fallback>', () => {
        pinRandom(0);
        expect(rollDiceDetailed('', 6).formula).toBe('1d6');
        expect(rollDiceDetailed(null, 8).formula).toBe('1d8');
    });

    test('is case insensitive about the d separator', () => {
        pinRandom(0);
        expect(rollDiceDetailed('2D10').rolls).toHaveLength(2);
    });

    test('never rolls outside 1..sides', () => {
        jest.restoreAllMocks();
        for (let i = 0; i < 200; i++) {
            for (const roll of rollDiceDetailed('4d6').rolls) {
                expect(roll).toBeGreaterThanOrEqual(1);
                expect(roll).toBeLessThanOrEqual(6);
            }
        }
    });

    test('clamps a zero-count or one-sided formula into a sane range', () => {
        pinRandom(0);
        expect(rollDiceDetailed('0d6').rolls).toHaveLength(1);
        expect(rollDiceDetailed('1d1').rolls[0]).toBeGreaterThanOrEqual(1);
    });
});

describe('rollDice', () => {
    test('returns just the total of rollDiceDetailed', () => {
        pinRandom(0.5);
        expect(rollDice('2d6+1')).toBe(rollDiceDetailed('2d6+1').total);
    });
});

describe('getRollClassification', () => {
    test('a natural 20 always crits, whatever the DC', () => {
        expect(getRollClassification(20, 1, 99)).toBe('critical-success');
    });

    test('a natural 1 always fumbles, whatever the total', () => {
        expect(getRollClassification(1, 99, 1)).toBe('critical-failure');
    });

    test('without a DC anything non-critical counts as success', () => {
        expect(getRollClassification(10, 3, null)).toBe('success');
        expect(getRollClassification(null, 3, undefined)).toBe('success');
    });

    test('compares the total against the DC', () => {
        expect(getRollClassification(10, 15, 15)).toBe('success');
        expect(getRollClassification(10, 14, 15)).toBe('failure');
    });
});

describe('getRollClassificationLabel', () => {
    test('maps every classification to a label', () => {
        expect(getRollClassificationLabel('critical-success')).toBe('Victoria critica');
        expect(getRollClassificationLabel('critical-failure')).toBe('Fracaso critico');
        expect(getRollClassificationLabel('failure')).toBe('Fracaso');
        expect(getRollClassificationLabel('success')).toBe('Victoria');
    });
});

describe('getDistanceInCells', () => {
    test('uses Chebyshev distance, as D&D 5e grids do', () => {
        // a pure diagonal costs the same as a straight line
        expect(getDistanceInCells(0, 0, 3, 3)).toBe(3);
        expect(getDistanceInCells(0, 0, 3, 0)).toBe(3);
        expect(getDistanceInCells(0, 0, 3, 1)).toBe(3);
    });

    test('is symmetric and zero at the same cell', () => {
        expect(getDistanceInCells(2, 5, 2, 5)).toBe(0);
        expect(getDistanceInCells(1, 2, 4, 6)).toBe(getDistanceInCells(4, 6, 1, 2));
    });

    test('treats non-finite coordinates as the origin', () => {
        expect(getDistanceInCells(NaN, NaN, 2, 2)).toBe(2);
        expect(getDistanceInCells('x', undefined, 0, 0)).toBe(0);
    });
});

describe('getDistanceInFeet', () => {
    test('is five feet per cell', () => {
        expect(getDistanceInFeet(0, 0, 3, 3)).toBe(15);
        expect(getDistanceInFeet(0, 0, 0, 0)).toBe(0);
    });
});

describe('buildReachableCells', () => {
    test('a speed below one cell still reaches the origin', () => {
        const cells = buildReachableCells(2, 2, 4, 10, 10);
        expect(cells).toEqual([{ gridX: 2, gridY: 2, kind: 'move' }]);
    });

    test('30 feet reaches six cells in each direction', () => {
        const cells = buildReachableCells(10, 10, 30, 40, 40);
        // a Chebyshev radius of 6 gives a 13x13 square
        expect(cells).toHaveLength(13 * 13);
    });

    test('clips against the edges of the board', () => {
        const cells = buildReachableCells(0, 0, 10, 5, 5);
        expect(cells.every(c => c.gridX >= 0 && c.gridY >= 0)).toBe(true);
        expect(cells).toHaveLength(3 * 3);
    });

    test('never leaves the grid bounds', () => {
        const cells = buildReachableCells(4, 4, 100, 5, 5);
        expect(cells.every(c => c.gridX < 5 && c.gridY < 5)).toBe(true);
        expect(cells).toHaveLength(25);
    });
});

describe('getAttackRangeFeet', () => {
    test('a ranged weapon name gives 60 feet', () => {
        for (const name of ['Longbow', 'Heavy Crossbow', 'sling', 'Wand of Magic Missiles', 'Quarterstaff']) {
            const member = { equippedItems: { weapon: 'w' }, items: [{ id: 'w', name }] };
            expect(getAttackRangeFeet(member)).toBe(60);
        }
    });

    test('a caster class gives 60 feet even unarmed', () => {
        expect(getAttackRangeFeet({ class: 'Wizard' })).toBe(60);
        expect(getAttackRangeFeet({ class: 'ranger' })).toBe(60);
    });

    test('melee is the default', () => {
        expect(getAttackRangeFeet({ class: 'Fighter' })).toBe(5);
        expect(getAttackRangeFeet(null)).toBe(5);
        expect(getAttackRangeFeet({ equippedItems: { weapon: 'w' }, items: [{ id: 'w', name: 'Longsword' }] })).toBe(5);
    });

    test('an equipped id that is not in the inventory falls back to melee', () => {
        expect(getAttackRangeFeet({ equippedItems: { weapon: 'ghost' }, items: [] })).toBe(5);
    });
});

describe('getPlayerDamageFormula', () => {
    test('at range the die depends on reaching level 5', () => {
        expect(getPlayerDamageFormula({ level: 4 }, 60)).toBe('1d8');
        expect(getPlayerDamageFormula({ level: 5 }, 60)).toBe('1d10');
        expect(getPlayerDamageFormula({ level: 20 }, 60)).toBe('1d10');
    });

    test('in melee it scales at levels 5 and 9', () => {
        expect(getPlayerDamageFormula({ level: 1 }, 5)).toBe('1d8');
        expect(getPlayerDamageFormula({ level: 5 }, 5)).toBe('1d10');
        expect(getPlayerDamageFormula({ level: 9 }, 5)).toBe('2d8');
    });

    test('a missing member is treated as level 1', () => {
        expect(getPlayerDamageFormula(null, 5)).toBe('1d8');
    });
});

describe('getEnemyDamageFormula', () => {
    const bands = [
        [0, '1d6'],
        [0.5, '1d6'],
        [1, '1d8'],
        [2, '1d8'],
        [3, '2d6'],
        [5, '2d6'],
        [6, '2d8'],
        [10, '2d8'],
        [11, '3d8'],
        [30, '3d8'],
    ];

    for (const [cr, expected] of bands) {
        test(`CR ${cr} deals ${expected}`, () => {
            expect(getEnemyDamageFormula(cr)).toBe(expected);
        });
    }
});

describe('getPlayerAttackModifier', () => {
    test('ranged attacks use dexterity', () => {
        const member = { strength: 20, dexterity: 10 };
        expect(getPlayerAttackModifier(member, 60)).toBe(0);
    });

    test('melee attacks use the better of strength and dexterity', () => {
        expect(getPlayerAttackModifier({ strength: 18, dexterity: 10 }, 5)).toBe(4);
        expect(getPlayerAttackModifier({ strength: 10, dexterity: 18 }, 5)).toBe(4);
    });

    test('missing scores default to 10', () => {
        expect(getPlayerAttackModifier(null, 5)).toBe(0);
        expect(getPlayerAttackModifier({}, 60)).toBe(0);
    });
});

describe('combat encounter shape', () => {
    test('createEmptyCombatEncounter is inert', () => {
        expect(createEmptyCombatEncounter()).toEqual({
            active: false, enemies: [], turnOrder: [], currentTurnIndex: 0, round: 0, turnState: null,
        });
    });

    test('createEmptyCombatEncounter returns a fresh object each time', () => {
        const a = createEmptyCombatEncounter();
        a.enemies.push('x');
        expect(createEmptyCombatEncounter().enemies).toEqual([]);
    });

    test('normalizeCombatEncounter repairs junk input', () => {
        expect(normalizeCombatEncounter(null)).toEqual(createEmptyCombatEncounter());
        expect(normalizeCombatEncounter('nonsense')).toEqual(createEmptyCombatEncounter());
        expect(normalizeCombatEncounter(undefined)).toEqual(createEmptyCombatEncounter());
    });

    test('normalizeCombatEncounter coerces field types', () => {
        const result = normalizeCombatEncounter({
            active: 'yes',
            enemies: 'not an array',
            turnOrder: null,
            currentTurnIndex: 2.5,
            turnState: 'nope',
        });
        expect(result.active).toBe(true);
        expect(result.enemies).toEqual([]);
        expect(result.turnOrder).toEqual([]);
        expect(result.currentTurnIndex).toBe(0);
        expect(result.turnState).toBeNull();
    });

    // Encounters predate the round counter, so loading one must not refuse or reset it.
    test('an encounter saved before rounds existed resumes at round one', () => {
        const legacy = { active: true, enemies: [], turnOrder: [], currentTurnIndex: 0, turnState: null };
        expect(normalizeCombatEncounter(legacy).round).toBe(1);
    });

    test('an inactive encounter has no round', () => {
        expect(normalizeCombatEncounter({ active: false }).round).toBe(0);
    });

    test('an existing round survives normalisation', () => {
        expect(normalizeCombatEncounter({ active: true, round: 7 }).round).toBe(7);
    });

    test('normalizeCombatEncounter keeps a well-formed turnState', () => {
        const result = normalizeCombatEncounter({
            active: true,
            turnState: { actorId: 7, isEnemy: 1, movementSpentFeet: '15', actionUsed: false },
        });
        expect(result.turnState).toMatchObject({
            actorId: '7', isEnemy: true, movementSpentFeet: 15, actionUsed: false,
        });
    });

    // Encounters saved before the turn machine was connected knew about movement and one
    // action. They load unchanged and gain the two flags they were missing, rather than
    // being refused or leaving the new fields undefined.
    test('an older turnState gains the bonus action and the reaction', () => {
        const result = normalizeCombatEncounter({
            active: true,
            turnState: { actorId: '7', isEnemy: false, movementSpentFeet: 15, actionUsed: true },
        });
        expect(result.turnState.bonusActionUsed).toBe(false);
        expect(result.turnState.reactionUsed).toBe(false);
    });
});

// Cover used to be decorative: the terrain knew a cell granted +2 AC and the attack
// never asked. These lock the note that tells the player why a roll missed.
describe('describeCover', () => {
    test('says nothing when the target has no cover', () => {
        expect(describeCover(0)).toBe('');
    });

    test('names half cover and its bonus', () => {
        expect(describeCover(2)).toBe(' (incluye +2 por cobertura media)');
    });

    test('names three-quarters cover and its bonus', () => {
        expect(describeCover(5)).toBe(' (incluye +5 por cobertura 3/4)');
    });

    test('a negative or junk bonus is treated as no cover, never as a penalty', () => {
        for (const value of [-2, null, undefined, NaN, 'dos']) {
            expect(describeCover(value)).toBe('');
        }
    });
});

describe('dice you can make repeatable', () => {
    // The whole point of a seed: the same fight twice, so the only difference is the
    // change you made.
    test('a seeded source makes the rolls repeat', async () => {
        const { setRandomSource, rollDiceDetailed, isSeeded } = await import('../public/scripts/party/combat-rules.js');
        const { createSeededRandom } = await import('../public/scripts/game-engine/combat/seeded-random.js');

        setRandomSource(createSeededRandom('molino'));
        const first = [rollDiceDetailed('1d20'), rollDiceDetailed('2d6+1')];
        expect(isSeeded()).toBe(true);

        setRandomSource(createSeededRandom('molino'));
        const second = [rollDiceDetailed('1d20'), rollDiceDetailed('2d6+1')];

        expect(second).toEqual(first);
        setRandomSource(null);
        expect(isSeeded()).toBe(false);
    });

    // Capturing Math.random at load time broke every test that stubs it, because the
    // module went on holding the original function.
    test('and going back to chance picks up a stubbed Math.random', async () => {
        const { setRandomSource, rollDiceDetailed } = await import('../public/scripts/party/combat-rules.js');
        setRandomSource(null);

        const original = Math.random;
        try {
            Math.random = () => 0.5;
            expect(rollDiceDetailed('1d6').rolls).toEqual([4]);
        } finally {
            Math.random = original;
        }
    });
});
