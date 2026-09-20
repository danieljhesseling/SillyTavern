import { describe, test, expect } from '@jest/globals';
import {
    createEncounter,
    normalizeEncounter,
    normalizeTurnState,
    buildTurnOrder,
    startEncounter,
    getCurrentEntry,
    advanceTurn,
    getRemainingMovement,
    spendMovement,
    hasAction,
    useAction,
    isTurnSpent,
    endEncounter,
    removeFromTurnOrder,
} from '../public/scripts/game-engine/combat/turn-machine.js';

/** Deterministic initiative: everyone rolls their dexterity. */
const byDex = (/** @type {number} */ dexterity) => dexterity;

const PARTY = [
    { id: 'hero', name: 'Lyra', isEnemy: false, dexterity: 18 },
    { id: 'ally', name: 'Brand', isEnemy: false, dexterity: 12 },
];
const FOES = [
    { id: 'gob1', name: 'Goblin', isEnemy: true, dexterity: 14 },
    { id: 'gob2', name: 'Goblin II', isEnemy: true, dexterity: 10 },
];

const alwaysAlive = () => true;

describe('buildTurnOrder', () => {
    test('sorts by initiative, highest first', () => {
        const order = buildTurnOrder([...PARTY, ...FOES], byDex);
        expect(order.map(e => e.id)).toEqual(['hero', 'gob1', 'ally', 'gob2']);
    });

    test('ties go to the party', () => {
        const order = buildTurnOrder([
            { id: 'foe', name: 'Foe', isEnemy: true, dexterity: 14 },
            { id: 'friend', name: 'Friend', isEnemy: false, dexterity: 14 },
        ], byDex);
        expect(order.map(e => e.id)).toEqual(['friend', 'foe']);
    });

    test('a missing dexterity is treated as 10', () => {
        const order = buildTurnOrder([{ id: 'x', name: 'X', isEnemy: false }], byDex);
        expect(order[0].initiative).toBe(10);
    });

    test('an empty roster gives an empty order', () => {
        expect(buildTurnOrder([], byDex)).toEqual([]);
        expect(buildTurnOrder(null, byDex)).toEqual([]);
    });
});

describe('startEncounter', () => {
    test('opens at round one with the first combatant acting', () => {
        const encounter = startEncounter([...PARTY, ...FOES], byDex);
        expect(encounter.active).toBe(true);
        expect(encounter.round).toBe(1);
        expect(getCurrentEntry(encounter).id).toBe('hero');
        expect(encounter.turnState.actorId).toBe('hero');
    });

    test('with nobody to fight there is no encounter', () => {
        expect(startEncounter([], byDex).active).toBe(false);
    });

    test('carries the enemy roster', () => {
        const enemies = [{ instanceId: 'gob1', currentHp: 7 }];
        expect(startEncounter([...PARTY, ...FOES], byDex, enemies).enemies).toEqual(enemies);
    });
});

describe('advanceTurn', () => {
    test('walks the order in sequence', () => {
        let encounter = startEncounter([...PARTY, ...FOES], byDex);
        const seen = [getCurrentEntry(encounter).id];
        for (let i = 0; i < 3; i++) {
            encounter = advanceTurn(encounter, alwaysAlive);
            seen.push(getCurrentEntry(encounter).id);
        }
        expect(seen).toEqual(['hero', 'gob1', 'ally', 'gob2']);
    });

    test('counts a new round when the order wraps', () => {
        let encounter = startEncounter([...PARTY, ...FOES], byDex);
        expect(encounter.round).toBe(1);
        for (let i = 0; i < 3; i++) encounter = advanceTurn(encounter, alwaysAlive);
        expect(encounter.round).toBe(1);
        encounter = advanceTurn(encounter, alwaysAlive);
        expect(getCurrentEntry(encounter).id).toBe('hero');
        expect(encounter.round).toBe(2);
    });

    test('skips combatants that can no longer act', () => {
        let encounter = startEncounter([...PARTY, ...FOES], byDex);
        const downed = new Set(['gob1', 'ally']);
        encounter = advanceTurn(encounter, entry => !downed.has(entry.id));
        expect(getCurrentEntry(encounter).id).toBe('gob2');
    });

    test('gives every combatant a fresh turn state', () => {
        let encounter = startEncounter([...PARTY, ...FOES], byDex);
        encounter = spendMovement(encounter, 30, 30);
        encounter = useAction(encounter, 'action');
        encounter = advanceTurn(encounter, alwaysAlive);

        expect(encounter.turnState.actorId).toBe('gob1');
        expect(encounter.turnState.movementSpentFeet).toBe(0);
        expect(encounter.turnState.actionUsed).toBe(false);
    });

    test('leaves the encounter alone when nobody can act', () => {
        const encounter = startEncounter([...PARTY, ...FOES], byDex);
        expect(advanceTurn(encounter, () => false)).toBe(encounter);
    });

    test('does nothing on an inactive encounter', () => {
        const encounter = createEncounter();
        expect(advanceTurn(encounter, alwaysAlive)).toBe(encounter);
    });

    test('a lone survivor keeps taking turns and the rounds keep counting', () => {
        let encounter = startEncounter([...PARTY, ...FOES], byDex);
        const onlyHero = (/** @type {{id: string}} */ entry) => entry.id === 'hero';
        encounter = advanceTurn(encounter, onlyHero);
        expect(getCurrentEntry(encounter).id).toBe('hero');
        expect(encounter.round).toBe(2);
    });
});

describe('movement', () => {
    test('starts with the full speed available', () => {
        const encounter = startEncounter(PARTY, byDex);
        expect(getRemainingMovement(encounter, 30)).toBe(30);
    });

    test('spending reduces what is left', () => {
        let encounter = startEncounter(PARTY, byDex);
        encounter = spendMovement(encounter, 10, 30);
        expect(getRemainingMovement(encounter, 30)).toBe(20);
    });

    test('cannot overspend', () => {
        let encounter = startEncounter(PARTY, byDex);
        encounter = spendMovement(encounter, 999, 30);
        expect(getRemainingMovement(encounter, 30)).toBe(0);
        expect(encounter.turnState.movementSpentFeet).toBe(30);
    });

    test('ignores negative and junk amounts', () => {
        let encounter = startEncounter(PARTY, byDex);
        encounter = spendMovement(encounter, -10, 30);
        encounter = spendMovement(encounter, 'nonsense', 30);
        expect(getRemainingMovement(encounter, 30)).toBe(30);
    });

    test('a speed of zero leaves nothing to spend', () => {
        const encounter = startEncounter(PARTY, byDex);
        expect(getRemainingMovement(encounter, 0)).toBe(0);
    });
});

describe('action economy', () => {
    test('a fresh turn has all three available', () => {
        const encounter = startEncounter(PARTY, byDex);
        expect(hasAction(encounter, 'action')).toBe(true);
        expect(hasAction(encounter, 'bonus')).toBe(true);
        expect(hasAction(encounter, 'reaction')).toBe(true);
    });

    test('each is spent independently', () => {
        let encounter = startEncounter(PARTY, byDex);
        encounter = useAction(encounter, 'action');
        expect(hasAction(encounter, 'action')).toBe(false);
        expect(hasAction(encounter, 'bonus')).toBe(true);
        expect(hasAction(encounter, 'reaction')).toBe(true);
    });

    test('spending one twice changes nothing', () => {
        let encounter = startEncounter(PARTY, byDex);
        encounter = useAction(encounter, 'action');
        const after = useAction(encounter, 'action');
        expect(after).toBe(encounter);
    });

    test('an unknown kind is refused', () => {
        const encounter = startEncounter(PARTY, byDex);
        expect(hasAction(encounter, 'teleport')).toBe(false);
        expect(useAction(encounter, 'teleport')).toBe(encounter);
    });

    test('nothing is available outside a turn', () => {
        expect(hasAction(createEncounter(), 'action')).toBe(false);
    });
});

describe('isTurnSpent', () => {
    test('a fresh turn is not spent', () => {
        expect(isTurnSpent(startEncounter(PARTY, byDex), 30)).toBe(false);
    });

    test('movement left alone keeps the turn open', () => {
        let encounter = startEncounter(PARTY, byDex);
        encounter = useAction(encounter, 'action');
        encounter = useAction(encounter, 'bonus');
        expect(isTurnSpent(encounter, 30)).toBe(false);
    });

    test('everything spent closes the turn', () => {
        let encounter = startEncounter(PARTY, byDex);
        encounter = useAction(encounter, 'action');
        encounter = useAction(encounter, 'bonus');
        encounter = spendMovement(encounter, 30, 30);
        expect(isTurnSpent(encounter, 30)).toBe(true);
    });

    test('a reaction left over does not keep the turn open', () => {
        let encounter = startEncounter(PARTY, byDex);
        encounter = useAction(encounter, 'action');
        encounter = useAction(encounter, 'bonus');
        encounter = spendMovement(encounter, 30, 30);
        expect(hasAction(encounter, 'reaction')).toBe(true);
        expect(isTurnSpent(encounter, 30)).toBe(true);
    });
});

describe('normalizeEncounter', () => {
    test('junk input yields an empty encounter', () => {
        expect(normalizeEncounter(null)).toEqual(createEncounter());
        expect(normalizeEncounter('nope')).toEqual(createEncounter());
    });

    test('an encounter saved before rounds existed resumes at round one', () => {
        const legacy = {
            active: true,
            enemies: [],
            turnOrder: [{ id: 'a', name: 'A', initiative: 10, isEnemy: false }],
            currentTurnIndex: 0,
            turnState: null,
        };
        expect(normalizeEncounter(legacy).round).toBe(1);
    });

    test('drops malformed turn entries', () => {
        const result = normalizeEncounter({
            active: true,
            turnOrder: [{ id: 'a', name: 'A', initiative: 5, isEnemy: false }, null, { name: 'no id' }],
        });
        expect(result.turnOrder).toHaveLength(1);
    });

    test('clamps an out-of-range turn index', () => {
        const result = normalizeEncounter({
            active: true,
            turnOrder: [{ id: 'a', name: 'A', initiative: 5, isEnemy: false }],
            currentTurnIndex: 99,
        });
        expect(result.currentTurnIndex).toBe(0);
    });

    test('turn state fields are coerced', () => {
        expect(normalizeTurnState({ actorId: 7, movementSpentFeet: '15', actionUsed: 1 })).toEqual({
            actorId: '7',
            isEnemy: false,
            movementSpentFeet: 15,
            actionUsed: true,
            bonusActionUsed: false,
            reactionUsed: false,
        });
        expect(normalizeTurnState(null)).toBeNull();
    });
});

describe('removeFromTurnOrder', () => {
    test('keeps the current actor pointing at the same combatant', () => {
        let encounter = startEncounter([...PARTY, ...FOES], byDex);
        encounter = advanceTurn(encounter, alwaysAlive); // gob1
        encounter = advanceTurn(encounter, alwaysAlive); // ally
        expect(getCurrentEntry(encounter).id).toBe('ally');

        const after = removeFromTurnOrder(encounter, 'hero');
        expect(getCurrentEntry(after).id).toBe('ally');
    });

    test('removing someone later in the order does not shift the current actor', () => {
        const encounter = startEncounter([...PARTY, ...FOES], byDex);
        const after = removeFromTurnOrder(encounter, 'gob2');
        expect(getCurrentEntry(after).id).toBe('hero');
    });

    test('an unknown id changes nothing', () => {
        const encounter = startEncounter([...PARTY, ...FOES], byDex);
        expect(removeFromTurnOrder(encounter, 'ghost')).toBe(encounter);
    });

    test('removing the last combatant ends the encounter', () => {
        const encounter = startEncounter([PARTY[0]], byDex);
        expect(removeFromTurnOrder(encounter, 'hero').active).toBe(false);
    });
});

describe('endEncounter', () => {
    test('goes inactive but keeps the enemies for the summary', () => {
        const enemies = [{ instanceId: 'gob1', currentHp: 0 }];
        const encounter = startEncounter([...PARTY, ...FOES], byDex, enemies);
        const ended = endEncounter(encounter);
        expect(ended.active).toBe(false);
        expect(ended.round).toBe(0);
        expect(ended.enemies).toEqual(enemies);
    });
});

describe('purity', () => {
    test('nothing mutates the encounter it was given', () => {
        const encounter = startEncounter([...PARTY, ...FOES], byDex);
        const snapshot = JSON.stringify(encounter);

        spendMovement(encounter, 15, 30);
        useAction(encounter, 'action');
        advanceTurn(encounter, alwaysAlive);
        removeFromTurnOrder(encounter, 'gob1');
        endEncounter(encounter);

        expect(JSON.stringify(encounter)).toBe(snapshot);
    });

    test('a full encounter replays identically', () => {
        const run = () => {
            let encounter = startEncounter([...PARTY, ...FOES], byDex);
            const log = [];
            for (let i = 0; i < 8; i++) {
                log.push(`r${encounter.round}:${getCurrentEntry(encounter).id}`);
                encounter = advanceTurn(encounter, alwaysAlive);
            }
            return log.join(' ');
        };
        expect(run()).toBe(run());
    });
});
