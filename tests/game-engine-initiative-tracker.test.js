import { describe, test, expect } from '@jest/globals';
import {
    STATUS_ICONS,
    SIZE_CELLS,
    sizeToCells,
    statusMarkers,
    buildTracker,
    describeTurn,
    toggleCondition,
} from '../public/scripts/game-engine/combat/initiative-tracker.js';
import { DEFAULT_RULESET } from '../public/scripts/game-engine/rules/default-ruleset.js';

/** A three-way fight: one wounded, one untouched, one down. */
const ORDER = [
    { id: '1', name: 'Lyra', initiative: 18, isEnemy: false },
    { id: 'g1', name: 'Ghoul', initiative: 14, isEnemy: true },
    { id: '2', name: 'Brand', initiative: 9, isEnemy: false },
];
const PARTY = [
    { id: 1, hp: 6, maxHp: 12, activeConditions: ['Poisoned'] },
    { id: 2, hp: 0, maxHp: 14 },
];
const ENEMIES = [{ instanceId: 'g1', currentHp: 22, maxHp: 22 }];

describe('status markers', () => {
    test('every condition in the rule pack has an icon of its own', () => {
        for (const condition of DEFAULT_RULESET.character.conditions) {
            expect(STATUS_ICONS[condition.toLowerCase()]).toBeDefined();
        }
    });

    test('a condition becomes a marker with an icon and a Spanish label', () => {
        expect(statusMarkers(['Poisoned'])).toEqual([
            { key: 'poisoned', icon: 'fa-flask', label: 'Envenenado' },
        ]);
    });

    // Older sheets keep conditions as free text rather than a list.
    test('reads the free-text field older sheets use', () => {
        expect(statusMarkers('Poisoned, Prone').map(s => s.key)).toEqual(['poisoned', 'prone']);
        expect(statusMarkers('Stunned; Blinded').map(s => s.key)).toEqual(['stunned', 'blinded']);
    });

    // A condition nobody drew is a condition the player forgets they have.
    test('an unknown condition still gets a marker, keeping its own name', () => {
        const [marker] = statusMarkers(['Maldito']);
        expect(marker.label).toBe('Maldito');
        expect(marker.icon).toBeTruthy();
    });

    test('the same condition twice is one marker', () => {
        expect(statusMarkers(['Poisoned', 'poisoned'])).toHaveLength(1);
    });

    test('nothing at all produces no markers', () => {
        for (const value of [[], '', null, undefined, ['', '  ']]) {
            expect(statusMarkers(value)).toEqual([]);
        }
    });
});

describe('creature size', () => {
    test('a large creature covers more board than a medium one', () => {
        expect(sizeToCells('Large')).toBeGreaterThan(sizeToCells('Medium'));
        expect(sizeToCells('Gargantuan')).toBe(4);
    });

    test('is read whatever the case or spacing', () => {
        expect(sizeToCells('  HUGE ')).toBe(SIZE_CELLS.huge);
    });

    test('an unknown or missing size is one cell, never zero', () => {
        for (const value of ['', null, undefined, 'colosal']) {
            expect(sizeToCells(value)).toBe(1);
        }
    });
});

describe('the tracker', () => {
    const tracker = () => buildTracker({
        turnOrder: ORDER, currentTurnIndex: 0, round: 3, party: PARTY, enemies: ENEMIES,
    });

    test('keeps the initiative order it was given', () => {
        expect(tracker().entries.map(e => e.name)).toEqual(['Lyra', 'Ghoul', 'Brand']);
    });

    test('marks exactly one combatant as acting', () => {
        expect(tracker().entries.filter(e => e.isCurrent).map(e => e.name)).toEqual(['Lyra']);
    });

    test('pulls health from the party and from the enemies alike', () => {
        const byName = Object.fromEntries(tracker().entries.map(e => [e.name, e]));
        expect(byName.Lyra).toMatchObject({ hp: 6, maxHp: 12, hpPct: 50 });
        expect(byName.Ghoul).toMatchObject({ hp: 22, maxHp: 22, hpPct: 100 });
    });

    test('says who is wounded and who is down', () => {
        const byName = Object.fromEntries(tracker().entries.map(e => [e.name, e]));
        expect(byName.Lyra.bloodied).toBe(true);
        expect(byName.Ghoul.bloodied).toBe(false);
        expect(byName.Brand.defeated).toBe(true);
        expect(byName.Brand.bloodied).toBe(false);
    });

    test('carries each combatant status markers', () => {
        const lyra = tracker().entries.find(e => e.name === 'Lyra');
        expect(lyra.statuses.map(s => s.key)).toEqual(['poisoned']);
    });
});

describe('who goes next', () => {
    test('is the one after the current combatant', () => {
        expect(buildTracker({
            turnOrder: ORDER, currentTurnIndex: 0, party: PARTY, enemies: ENEMIES,
        }).nextName).toBe('Ghoul');
    });

    // Pointing at a corpse is exactly what a tracker is supposed to prevent.
    test('skips the fallen', () => {
        expect(buildTracker({
            turnOrder: ORDER, currentTurnIndex: 1, party: PARTY, enemies: ENEMIES,
        }).nextName).toBe('Lyra');
    });

    test('wraps around the end of the round', () => {
        expect(buildTracker({
            turnOrder: ORDER, currentTurnIndex: 2, party: PARTY, enemies: ENEMIES,
        }).nextName).toBe('Lyra');
    });

    test('with everyone else down, the current one is also the next', () => {
        expect(buildTracker({
            turnOrder: ORDER,
            currentTurnIndex: 0,
            party: [{ id: 1, hp: 6, maxHp: 12 }, { id: 2, hp: 0, maxHp: 14 }],
            enemies: [{ instanceId: 'g1', currentHp: 0, maxHp: 22 }],
        }).nextName).toBe('Lyra');
    });

    test('never marks the same row as current and next at once', () => {
        for (let i = 0; i < ORDER.length; i++) {
            const { entries } = buildTracker({
                turnOrder: ORDER, currentTurnIndex: i, party: PARTY, enemies: ENEMIES,
            });
            expect(entries.filter(e => e.isCurrent && e.isNext)).toHaveLength(0);
        }
    });
});

describe('robustness', () => {
    test('an encounter with no turn order is empty, not broken', () => {
        expect(buildTracker({ turnOrder: [], currentTurnIndex: 0 })).toMatchObject({ entries: [] });
        expect(buildTracker({ turnOrder: null, currentTurnIndex: 0 }).entries).toEqual([]);
    });

    // Saved encounters from before a change can hold an index past the end.
    test('an index outside the order is clamped instead of breaking the panel', () => {
        for (const index of [-5, 99, NaN, undefined]) {
            const { entries } = buildTracker({
                turnOrder: ORDER, currentTurnIndex: index, party: PARTY, enemies: ENEMIES,
            });
            expect(entries.filter(e => e.isCurrent)).toHaveLength(1);
        }
    });

    test('a combatant with nobody behind it still gets a row', () => {
        const { entries } = buildTracker({ turnOrder: ORDER, currentTurnIndex: 0 });
        expect(entries).toHaveLength(3);
        expect(entries.every(e => e.name)).toBe(true);
    });

    test('a missing round reads as the first', () => {
        expect(buildTracker({ turnOrder: ORDER, currentTurnIndex: 0 }).round).toBe(1);
    });
});

describe('describeTurn', () => {
    test('names the round, who acts and who follows', () => {
        const text = describeTurn(buildTracker({
            turnOrder: ORDER, currentTurnIndex: 0, round: 3, party: PARTY, enemies: ENEMIES,
        }));
        expect(text).toBe('Ronda 3 · turno de Lyra · después Ghoul');
    });

    test('does not say "after" when it would name the same combatant', () => {
        expect(describeTurn({ round: 1, activeName: 'Lyra', nextName: 'Lyra' }))
            .toBe('Ronda 1 · turno de Lyra');
    });

    test('an empty tracker describes nothing', () => {
        expect(describeTurn({ round: 1, activeName: '', nextName: '' })).toBe('');
        expect(describeTurn(null)).toBe('');
    });
});
// Conditions used to be reachable only from a character sheet, or applied by the combat
// itself. /condition is the table gesture: it goes on, and later it comes off.
describe('toggleCondition', () => {
    test('puts a condition on someone who does not have it', () => {
        expect(toggleCondition([], 'Poisoned')).toEqual({ conditions: ['Poisoned'], added: true });
    });

    test('takes it off again', () => {
        expect(toggleCondition(['Poisoned'], 'Poisoned')).toEqual({ conditions: [], added: false });
    });

    // Otherwise a list ends up holding both "Poisoned" and "poisoned".
    test('matches without regard to case', () => {
        expect(toggleCondition(['Poisoned'], 'poisoned').conditions).toEqual([]);
        expect(toggleCondition([], 'poisoned').conditions).toEqual(['Poisoned']);
    });

    test('leaves the other conditions alone', () => {
        const { conditions } = toggleCondition(['Poisoned', 'Prone'], 'Prone');
        expect(conditions).toEqual(['Poisoned']);
    });

    test('a condition the rule pack does not know is kept as written', () => {
        expect(toggleCondition([], 'Maldición del pozo').conditions).toEqual(['Maldición del pozo']);
    });

    test('an empty name changes nothing', () => {
        expect(toggleCondition(['Poisoned'], '')).toEqual({ conditions: ['Poisoned'], added: false });
        expect(toggleCondition(['Poisoned'], null).conditions).toEqual(['Poisoned']);
    });

    test('a missing or junk list is treated as none', () => {
        expect(toggleCondition(null, 'Prone').conditions).toEqual(['Prone']);
        expect(toggleCondition(undefined, 'Prone').conditions).toEqual(['Prone']);
    });

    test('blank entries left by an older sheet are dropped on the way through', () => {
        expect(toggleCondition(['Poisoned', '', '  '], 'Prone').conditions)
            .toEqual(['Poisoned', 'Prone']);
    });
});
