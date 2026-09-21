import { describe, test, expect } from '@jest/globals';
import { buildDialogueView } from '../public/scripts/game-engine/ui/shell/dialogue-scene.js';

const party = [
    { id: 1, name: 'Lyra', avatar: 'lyra.png', hp: 20, maxHp: 20 },
    { id: 2, name: 'Brand', avatar: 'brand.png', hp: 6, maxHp: 24, activeConditions: ['poisoned', 'prone'] },
];

describe('who is speaking', () => {
    test('is the last one to talk who is not the player', () => {
        const view = buildDialogueView({
            messages: [{ name: 'Lyra' }, { name: 'Tú', is_user: true }],
            party,
        });
        expect(view.speaker?.name).toBe('Lyra');
        expect(view.speaker?.avatar).toBe('lyra.png');
        expect(view.speaker?.known).toBe(true);
    });

    // The output of a slash command would otherwise take over the portrait.
    test('a system message is never the speaker', () => {
        const view = buildDialogueView({
            messages: [{ name: 'Brand' }, { name: 'System', is_system: true }],
            party,
        });
        expect(view.speaker?.name).toBe('Brand');
    });

    // The game posts its narration as a normal message on purpose, so the model reads it.
    test('the narrator counts, because it is not a system message', () => {
        const view = buildDialogueView({
            messages: [{ name: 'Brand' }, { name: 'Narrador', is_system: false, force_avatar: 'narrator.png' }],
            party,
        });
        expect(view.speaker?.name).toBe('Narrador');
        expect(view.speaker?.avatar).toBe('narrator.png');
        expect(view.speaker?.known).toBe(false);
        expect(view.speaker?.rankLabel).toBe('');
    });

    test('somebody outside the party still gets a portrait, but no rank', () => {
        const view = buildDialogueView({
            messages: [{ name: 'Tabernero', force_avatar: 'tab.png' }],
            party,
        });
        expect(view.speaker).toEqual({
            name: 'Tabernero', avatar: 'tab.png', rank: 0, known: false, rankLabel: '',
        });
    });

    test('the name is matched without regard to case', () => {
        const view = buildDialogueView({ messages: [{ name: 'lyra' }], party });
        expect(view.speaker?.known).toBe(true);
        expect(view.speaker?.avatar).toBe('lyra.png');
    });

    test('with only the player talking, the last line still fills the portrait', () => {
        const view = buildDialogueView({
            messages: [{ name: 'Sistema', is_system: true, force_avatar: 's.png' }, { name: 'Tú', is_user: true }],
            party,
        });
        expect(view.speaker?.name).toBe('Sistema');
    });

    test('an empty chat has nobody speaking', () => {
        expect(buildDialogueView({ messages: [], party }).speaker).toBeNull();
        expect(buildDialogueView({ party }).speaker).toBeNull();
        expect(buildDialogueView().speaker).toBeNull();
    });

    test('a message with no name is the narrator', () => {
        expect(buildDialogueView({ messages: [{ }], party }).speaker?.name).toBe('Narrador');
    });
});

describe('the party strip', () => {
    test('carries health as a number and as a share', () => {
        const [lyra, brand] = buildDialogueView({ party }).party;
        expect(lyra).toMatchObject({ name: 'Lyra', hp: 20, maxHp: 20, hpPct: 100, bloodied: false, fallen: false });
        expect(brand).toMatchObject({ hp: 6, maxHp: 24, hpPct: 25, bloodied: true, fallen: false });
    });

    test('somebody at zero is down, not merely hurt', () => {
        const [chip] = buildDialogueView({ party: [{ id: 1, name: 'Lyra', hp: 0, maxHp: 20 }] }).party;
        expect(chip.fallen).toBe(true);
        expect(chip.bloodied).toBe(false);
        expect(chip.hpPct).toBe(0);
    });

    test('negative health does not print a negative bar', () => {
        const [chip] = buildDialogueView({ party: [{ id: 1, name: 'Lyra', hp: -7, maxHp: 20 }] }).party;
        expect(chip.hp).toBe(0);
        expect(chip.hpPct).toBe(0);
        expect(chip.fallen).toBe(true);
    });

    test('conditions come out as icons, from the same table as the tracker', () => {
        const brand = buildDialogueView({ party }).party[1];
        expect(brand.statuses.map(s => s.label)).toEqual(['Envenenado', 'Derribado']);
        expect(brand.statuses.every(s => s.icon.startsWith('fa-'))).toBe(true);
    });

    test('the older comma-separated field still works', () => {
        const [chip] = buildDialogueView({
            party: [{ id: 1, name: 'Lyra', hp: 5, maxHp: 10, conditions: 'stunned, blinded' }],
        }).party;
        expect(chip.statuses.map(s => s.label)).toEqual(['Aturdido', 'Cegado']);
    });

    test('somebody with no maximum is not shown as dead', () => {
        const [chip] = buildDialogueView({ party: [{ id: 1, name: 'X' }] }).party;
        expect(chip.fallen).toBe(false);
        expect(chip.hpPct).toBe(0);
    });

    test('junk in the party list does not reach the strip', () => {
        expect(buildDialogueView({ party: [null, undefined] }).party).toEqual([]);
        expect(buildDialogueView({ party: /** @type {any} */ ('Lyra') }).party).toEqual([]);
    });
});

describe('the moment', () => {
    test('is the day and the slot, as the calendar gives them', () => {
        expect(buildDialogueView({ party }).moment).toBe('Día 1 · Mañana');
        expect(buildDialogueView({ party, calendar: { day: 4, slotIndex: 2 } }).moment).toMatch(/^Día 4 · /);
    });
});

describe('the bond rank beside the portrait', () => {
    test('is the rank the campaign panel shows, not a second count', () => {
        const bonds = { bonds: { 1: { points: 30 } } };
        const view = buildDialogueView({ messages: [{ name: 'Lyra' }], party, bonds });
        expect(view.speaker?.rank).toBeGreaterThan(1);
        expect(view.speaker?.rankLabel).toBe(`Vínculo ${view.speaker?.rank}`);
        expect(view.party[0].rank).toBe(view.speaker?.rank);
    });
});
