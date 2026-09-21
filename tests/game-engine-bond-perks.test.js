import { describe, test, expect } from '@jest/globals';
import {
    FOLLOW_UP_CHANCE,
    planEndure,
    planFollowUp,
    planBatonPass,
} from '../public/scripts/game-engine/combat/bond-perks.js';
import {
    createBondState, recordBondEvent, spendPerk, getRank,
} from '../public/scripts/game-engine/campaign/bonds.js';

/** A bond high enough for the perk at a given rank. */
function bondsAtRank(characterId, rank) {
    let state = createBondState();
    for (let i = 0; i < 60 && getRank(state, String(characterId)) < rank; i++) {
        state = recordBondEvent(state, String(characterId), 'saved_their_life').state;
    }
    return state;
}

const PARTY = [
    { id: 1, name: 'Lyra', hp: 5 },
    { id: 2, name: 'Brand', hp: 10 },
];

describe('endure: taking the blow for someone', () => {
    const bonds = bondsAtRank(2, 8);

    test('fires when the hit would drop them', () => {
        const rescue = planEndure({ bonds, party: PARTY, targetId: '1', currentHp: 5, damage: 9 });
        expect(rescue).toMatchObject({ saviourId: '2', saviourName: 'Brand', perkId: 'endure' });
    });

    // A perk that triggers on every scratch makes a fight unloseable rather than tense.
    test('does not fire for a hit they would survive', () => {
        expect(planEndure({ bonds, party: PARTY, targetId: '1', currentHp: 5, damage: 2 })).toBeNull();
    });

    test('exactly lethal counts as lethal', () => {
        expect(planEndure({ bonds, party: PARTY, targetId: '1', currentHp: 5, damage: 5 })).not.toBeNull();
    });

    test('nobody saves themselves', () => {
        expect(planEndure({ bonds, party: PARTY, targetId: '2', currentHp: 10, damage: 20 })).toBeNull();
    });

    test('a fallen companion saves nobody', () => {
        const down = [{ id: 1, name: 'Lyra', hp: 5 }, { id: 2, name: 'Brand', hp: 0 }];
        expect(planEndure({ bonds, party: down, targetId: '1', currentHp: 5, damage: 9 })).toBeNull();
    });

    test('a bond below rank 8 cannot do it', () => {
        expect(planEndure({ bonds: bondsAtRank(2, 5), party: PARTY, targetId: '1', currentHp: 5, damage: 9 }))
            .toBeNull();
    });

    test('once a day: spent means gone until tomorrow', () => {
        const used = spendPerk(bonds, '2', 'endure');
        expect(planEndure({ bonds: used, party: PARTY, targetId: '1', currentHp: 5, damage: 9 })).toBeNull();
    });

    test('somebody already down is not rescued again', () => {
        expect(planEndure({ bonds, party: PARTY, targetId: '1', currentHp: 0, damage: 9 })).toBeNull();
    });
});

describe('follow-up: a free swing after a critical', () => {
    const bonds = bondsAtRank(2, 3);
    const reachable = () => true;

    test('fires when the coin lands and the companion can reach', () => {
        const plan = planFollowUp({
            bonds, party: PARTY, attackerId: '1', canReach: reachable, random: () => 0.1,
        });
        expect(plan).toMatchObject({ actorId: '2', actorName: 'Brand', perkId: 'follow_up' });
    });

    test('it is a chance, not a certainty', () => {
        expect(planFollowUp({
            bonds, party: PARTY, attackerId: '1', canReach: reachable, random: () => 0.9,
        })).toBeNull();
        expect(FOLLOW_UP_CHANCE).toBeGreaterThan(0);
        expect(FOLLOW_UP_CHANCE).toBeLessThan(1);
    });

    // A free attack from across the room would make position meaningless, and position
    // is the whole game underneath.
    test('a companion who cannot reach the target does not get one', () => {
        expect(planFollowUp({
            bonds, party: PARTY, attackerId: '1', canReach: () => false, random: () => 0.1,
        })).toBeNull();
    });

    test('the attacker does not follow up on their own critical', () => {
        expect(planFollowUp({
            bonds: bondsAtRank(1, 3), party: PARTY, attackerId: '1', canReach: reachable, random: () => 0.1,
        })).toBeNull();
    });

    test('a fallen companion does not swing', () => {
        const down = [{ id: 1, name: 'Lyra', hp: 5 }, { id: 2, name: 'Brand', hp: 0 }];
        expect(planFollowUp({
            bonds, party: down, attackerId: '1', canReach: reachable, random: () => 0.1,
        })).toBeNull();
    });

    test('a bond below rank 3 does nothing', () => {
        expect(planFollowUp({
            bonds: createBondState(), party: PARTY, attackerId: '1', canReach: reachable, random: () => 0.1,
        })).toBeNull();
    });
});

describe('baton pass: handing over the rest of your move', () => {
    const bonds = bondsAtRank(1, 5);

    test('offers the companions who are still up', () => {
        expect(planBatonPass({ bonds, party: PARTY, actorId: '1', remainingFeet: 15 }))
            .toEqual([{ id: '2', name: 'Brand' }]);
    });

    test('offers nothing when there is no movement left to give', () => {
        expect(planBatonPass({ bonds, party: PARTY, actorId: '1', remainingFeet: 0 })).toEqual([]);
    });

    test('a bond below rank 5 offers nothing', () => {
        expect(planBatonPass({ bonds: bondsAtRank(1, 3), party: PARTY, actorId: '1', remainingFeet: 15 }))
            .toEqual([]);
    });

    test('once a day', () => {
        const used = spendPerk(bonds, '1', 'baton_pass');
        expect(planBatonPass({ bonds: used, party: PARTY, actorId: '1', remainingFeet: 15 })).toEqual([]);
    });

    test('never offers it to the fallen, nor to yourself', () => {
        const party = [{ id: 1, name: 'Lyra', hp: 5 }, { id: 2, name: 'Brand', hp: 0 }];
        expect(planBatonPass({ bonds, party, actorId: '1', remainingFeet: 15 })).toEqual([]);
    });
});

describe('robustness', () => {
    test('an empty or junk party never produces a plan', () => {
        const bonds = bondsAtRank(2, 8);
        for (const party of [[], null, undefined, 'lyra']) {
            expect(planEndure({ bonds, party, targetId: '1', currentHp: 5, damage: 9 })).toBeNull();
            expect(planFollowUp({ bonds, party, attackerId: '1', canReach: () => true, random: () => 0 })).toBeNull();
            expect(planBatonPass({ bonds, party, actorId: '1', remainingFeet: 15 })).toEqual([]);
        }
    });

    test('a missing bond state means no perks, not an error', () => {
        expect(planEndure({ bonds: null, party: PARTY, targetId: '1', currentHp: 5, damage: 9 })).toBeNull();
        expect(planBatonPass({ bonds: undefined, party: PARTY, actorId: '1', remainingFeet: 15 })).toEqual([]);
    });
});

describe('the rank-10 bond, which was a label for months', () => {
    const maxed = { bonds: { 1: { points: 200 } } };
    const hero = (over = {}) => ({
        id: 1, name: 'Lyra', hp: 20, level: 4,
        items: [{ id: 'w1', damageDice: '2d6' }],
        equippedItems: { weapon: 'w1' },
        ...over,
    });

    test('the ultimate hits without rolling, for the weapon maximum plus the level', async () => {
        const { planUltimate } = await import('../public/scripts/game-engine/combat/bond-perks.js');
        const plan = planUltimate({ bonds: maxed, party: [hero()], actorId: '1', targetId: 'e1' });
        expect(plan).toMatchObject({ actorId: '1', perkId: 'ultimate', damage: 16 });
        expect(plan?.reason).toMatch(/sin tirar/);
    });

    test('with no weapon equipped it still lands, on the smallest die', async () => {
        const { planUltimate } = await import('../public/scripts/game-engine/combat/bond-perks.js');
        expect(planUltimate({ bonds: maxed, party: [hero({ equippedItems: {} })], actorId: '1', targetId: 'e1' })?.damage)
            .toBe(10);
    });

    // It costs a whole day and the longest track in the game; it is not a free button.
    test('below rank 10 there is nothing to use', async () => {
        const { planUltimate } = await import('../public/scripts/game-engine/combat/bond-perks.js');
        expect(planUltimate({ bonds: { bonds: { 1: { points: 80 } } }, party: [hero()], actorId: '1', targetId: 'e1' }))
            .toBeNull();
    });

    test('and once spent today, not again', async () => {
        const { planUltimate } = await import('../public/scripts/game-engine/combat/bond-perks.js');
        const spent = { bonds: { 1: { points: 200, usedOncePerDay: ['ultimate'] } } };
        expect(planUltimate({ bonds: spent, party: [hero()], actorId: '1', targetId: 'e1' })).toBeNull();
    });

    test('nobody swings from the floor, and nobody swings at nobody', async () => {
        const { planUltimate } = await import('../public/scripts/game-engine/combat/bond-perks.js');
        expect(planUltimate({ bonds: maxed, party: [hero({ hp: 0 })], actorId: '1', targetId: 'e1' })).toBeNull();
        expect(planUltimate({ bonds: maxed, party: [hero()], actorId: '1', targetId: '' })).toBeNull();
        expect(planUltimate({ bonds: maxed, party: [], actorId: '1', targetId: 'e1' })).toBeNull();
    });

    test('the personal weapon is a real item, named after whose bond it is', async () => {
        const { buildPersonalWeapon } = await import('../public/scripts/game-engine/combat/bond-perks.js');
        const { createItem } = await import('../public/scripts/dnd-system.js');
        const item = createItem(buildPersonalWeapon({ name: 'Brand' }));
        expect(item.name).toBe('Arma personal de Brand');
        expect(item.slot).toBe('weapon');
        expect(item.damageDice).toBe('1d10');
        expect(item.rarity).toBe('Very Rare');
    });

    test('and somebody with no name still gets one', async () => {
        const { buildPersonalWeapon } = await import('../public/scripts/game-engine/combat/bond-perks.js');
        expect(buildPersonalWeapon({}).name).toBe('Arma personal de Compañero');
    });
});
