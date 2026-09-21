import { describe, test, expect } from '@jest/globals';
import {
    buildCampaignView,
    getRecordableEvents,
} from '../public/scripts/game-engine/campaign/campaign-view.js';
import { createCalendar, advanceSlots } from '../public/scripts/game-engine/campaign/calendar.js';
import {
    createBondState, recordBondEvent, spendPerk, BOND_PERKS, BOND_EVENTS, MAX_RANK,
} from '../public/scripts/game-engine/campaign/bonds.js';

const PARTY = [{ id: 1, name: 'Lyra', avatar: 'a.png' }, { id: 2, name: 'Brand' }];

/** Records life-saving events until the bond reaches a rank. */
function bondsAtRank(characterId, rank) {
    let state = createBondState();
    for (let i = 0; i < 60; i++) {
        const view = buildCampaignView({
            calendar: createCalendar(), bonds: state, party: [{ id: characterId, name: 'x' }],
        });
        if (view.characters[0].rank >= rank) break;
        state = recordBondEvent(state, String(characterId), 'saved_their_life').state;
    }
    return state;
}

describe('the day', () => {
    test('starts on day one, in the first slot', () => {
        const view = buildCampaignView({ calendar: createCalendar(), bonds: createBondState(), party: PARTY });
        expect(view.day).toBe(1);
        expect(view.slotLabel).toBe('Mañana');
    });

    test('marks exactly one slot as the current one', () => {
        const view = buildCampaignView({ calendar: createCalendar(), bonds: createBondState(), party: PARTY });
        expect(view.slots.filter(s => s.current)).toHaveLength(1);
    });

    test('follows the clock as it advances', () => {
        const { calendar } = advanceSlots(createCalendar(), 1);
        const view = buildCampaignView({ calendar, bonds: createBondState(), party: PARTY });
        expect(view.slotLabel).toBe('Tarde');
        expect(view.slots.find(s => s.current).id).toBe('afternoon');
    });

    test('says how much of the day is left, which is what a slot is for', () => {
        const fresh = buildCampaignView({ calendar: createCalendar(), bonds: createBondState(), party: PARTY });
        const { calendar } = advanceSlots(createCalendar(), 2);
        const late = buildCampaignView({ calendar, bonds: createBondState(), party: PARTY });
        expect(late.remainingSlots).toBeLessThan(fresh.remainingSlots);
    });

    test('a missing calendar still describes a day', () => {
        const view = buildCampaignView({ calendar: null, bonds: null, party: PARTY });
        expect(view.day).toBeGreaterThan(0);
        expect(view.slotLabel).toBeTruthy();
    });
});

describe('the bonds', () => {
    test('one card per party member, in order', () => {
        const view = buildCampaignView({ calendar: createCalendar(), bonds: createBondState(), party: PARTY });
        expect(view.characters.map(c => c.name)).toEqual(['Lyra', 'Brand']);
    });

    test('everyone starts at rank one with nothing earned', () => {
        const view = buildCampaignView({ calendar: createCalendar(), bonds: createBondState(), party: PARTY });
        expect(view.characters[0]).toMatchObject({ rank: 1, points: 0, maxed: false });
        expect(view.characters[0].perks.every(p => !p.unlocked)).toBe(true);
    });

    test('a recorded event moves the points and the progress bar', () => {
        // A three-point event, deliberately: six lands exactly on the rank-2 threshold,
        // where progress towards rank 3 is correctly zero.
        const bonds = recordBondEvent(createBondState(), '1', 'confidant_scene').state;
        const view = buildCampaignView({ calendar: createCalendar(), bonds, party: PARTY });
        const lyra = view.characters.find(c => c.name === 'Lyra');

        expect(lyra.points).toBe(BOND_EVENTS.confidant_scene.points);
        expect(lyra.progress).toBeGreaterThan(0);
        expect(view.characters.find(c => c.name === 'Brand').points).toBe(0);
    });

    // Reaching a threshold exactly is a rank up, and zero progress towards the next one.
    test('landing on a threshold reads as the new rank, not as progress towards it', () => {
        const bonds = recordBondEvent(createBondState(), '1', 'saved_their_life').state;
        const lyra = buildCampaignView({ calendar: createCalendar(), bonds, party: PARTY })
            .characters.find(c => c.name === 'Lyra');

        expect(lyra.rank).toBe(2);
        expect(lyra.progress).toBe(0);
    });

    // Seeing what rank 8 gives is the reason to keep spending evenings with somebody.
    test('lists every perk, earned or not', () => {
        const view = buildCampaignView({ calendar: createCalendar(), bonds: createBondState(), party: PARTY });
        expect(view.characters[0].perks.map(p => p.id)).toEqual(BOND_PERKS.map(p => p.id));
    });

    test('marks as unlocked only the perks the rank has reached', () => {
        const bonds = bondsAtRank(1, 3);
        const lyra = buildCampaignView({ calendar: createCalendar(), bonds, party: PARTY })
            .characters.find(c => c.name === 'Lyra');

        expect(lyra.rank).toBeGreaterThanOrEqual(3);
        expect(lyra.perks.find(p => p.rank === 3).unlocked).toBe(true);
        expect(lyra.perks.find(p => p.rank === 10).unlocked).toBe(false);
    });

    test('says which once-a-day perk has already been spent', () => {
        const spent = spendPerk(bondsAtRank(1, 8), '1', 'endure');
        const bonds = spent.state ?? spent;
        const endure = buildCampaignView({ calendar: createCalendar(), bonds, party: PARTY })
            .characters[0].perks.find(p => p.id === 'endure');

        expect(endure.unlocked).toBe(true);
        expect(endure.spentToday).toBe(true);
    });

    test('a maxed bond says so instead of showing a target it cannot pass', () => {
        const lyra = buildCampaignView({ calendar: createCalendar(), bonds: bondsAtRank(1, MAX_RANK), party: PARTY })
            .characters[0];
        expect(lyra.maxed).toBe(true);
        expect(lyra.nextAt).toBeNull();
    });

    test('an empty party is an empty panel, not an error', () => {
        expect(buildCampaignView({ calendar: createCalendar(), bonds: createBondState(), party: [] }).characters).toEqual([]);
        expect(buildCampaignView({ calendar: createCalendar(), bonds: createBondState(), party: null }).characters).toEqual([]);
    });

    test('a member with no bond recorded yet still gets a card', () => {
        const view = buildCampaignView({
            calendar: createCalendar(), bonds: createBondState(), party: [{ id: 9, name: 'Nueva' }],
        });
        expect(view.characters[0]).toMatchObject({ name: 'Nueva', rank: 1, points: 0 });
    });
});

describe('the events a person can record by hand', () => {
    test('offers the deliberate ones', () => {
        const types = getRecordableEvents().map(e => e.type);
        expect(types).toContain('gift_liked');
        expect(types).toContain('confidant_scene');
    });

    // The engine records these itself; a button for them would double-count.
    test('leaves out what the engine records on its own, and the manual adjustment', () => {
        const types = getRecordableEvents().map(e => e.type);
        expect(types).not.toContain('combat_together');
        expect(types).not.toContain('quest_together');
        expect(types).not.toContain('manual');
    });

    test('puts the rewarding ones first and the costly ones last', () => {
        const points = getRecordableEvents().map(e => e.points);
        expect([...points].sort((a, b) => b - a)).toEqual(points);
    });

    test('every one of them is a real event the engine knows', () => {
        for (const event of getRecordableEvents()) {
            expect(BOND_EVENTS[event.type]).toBeDefined();
            expect(event.label).toBe(BOND_EVENTS[event.type].label);
        }
    });
});
