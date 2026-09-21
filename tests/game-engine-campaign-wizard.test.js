import { describe, test, expect } from '@jest/globals';
import { createCampaign, buildNewCampaignCta } from '../public/scripts/game-engine/ui/campaign-wizard.js';

/**
 * Fake world-info backend that records what happens to it, in order.
 * @param {{ createResult?: any, loaded?: any }} [options]
 */
function fakeBackend({ createResult = true, loaded = { entries: {}, metadata: {} } } = {}) {
    /** @type {string[]} */
    const calls = [];
    let nextUid = 0;
    /** @type {any} */
    let saved = null;

    return {
        calls,
        get saved() { return saved; },
        deps: {
            createWorld: async (/** @type {string} */ name) => { calls.push(`create:${name}`); return createResult; },
            loadWorld: async (/** @type {string} */ name) => { calls.push(`load:${name}`); return loaded; },
            saveWorld: async (/** @type {string} */ name, /** @type {any} */ data) => {
                calls.push(`save:${name}`);
                saved = data;
            },
            createEntry: (/** @type {string} */ _name, /** @type {any} */ data) => {
                calls.push('entry');
                const entry = { uid: nextUid++ };
                data.entries[entry.uid] = entry;
                return entry;
            },
        },
    };
}

const answers = (overrides = {}) => ({
    templateId: 'dungeon',
    worldName: 'Mi mundo',
    genre: 'Fantasía',
    description: 'Un sitio oscuro.',
    party: ['Lyra', 'Brand'],
    ...overrides,
});

describe('createCampaign', () => {
    test('creates the world, then fills it, then saves it, in that order', async () => {
        const backend = fakeBackend();
        await createCampaign({ answers: answers(), ...backend.deps });

        const order = backend.calls.filter(c => c !== 'entry');
        expect(order).toEqual(['create:Mi mundo', 'load:Mi mundo', 'save:Mi mundo']);
    });

    test('writes the location and the board with its terrain into the metadata', async () => {
        const backend = fakeBackend();
        await createCampaign({ answers: answers(), ...backend.deps });

        const location = backend.saved.metadata.locationMaps[0];
        expect(location.name).toBe('Cripta olvidada');
        expect(location.boards[0].name).toBe('Sala de entrada');
        expect(Object.keys(location.boards[0].terrain.cells).length).toBeGreaterThan(20);
    });

    test('uses the name, genre and description that were typed', async () => {
        const backend = fakeBackend();
        await createCampaign({ answers: answers(), ...backend.deps });

        expect(backend.saved.metadata).toMatchObject({
            displayName: 'Mi mundo', genre: 'Fantasía', description: 'Un sitio oscuro.',
        });
    });

    test('adds a Characters entry per party member and a Monsters entry per monster', async () => {
        const backend = fakeBackend();
        await createCampaign({ answers: answers(), ...backend.deps });

        const entries = Object.values(backend.saved.entries);
        expect(entries.filter(e => e.group === 'Characters')).toHaveLength(2);
        expect(entries.filter(e => e.group === 'Monsters')).toHaveLength(2);
    });

    test('every entry is written with the fields world info matches on', async () => {
        const backend = fakeBackend();
        await createCampaign({ answers: answers(), ...backend.deps });

        for (const entry of Object.values(backend.saved.entries)) {
            expect(entry.comment.length).toBeGreaterThan(0);
            expect(entry.key.length).toBeGreaterThan(0);
            expect(entry.dndData).toBeDefined();
        }
    });

    // What the real new-chat path needs to build the party: the saved entries themselves.
    test('hands back the saved Characters entries so the party can be built from them', async () => {
        const backend = fakeBackend();
        const result = await createCampaign({ answers: answers(), ...backend.deps });

        expect(result.party).toEqual(['Lyra', 'Brand']);
        expect(result.partyEntries).toHaveLength(2);
        expect(result.partyEntries[0]).toBe(backend.saved.entries[result.partyEntries[0].uid]);
        expect(result.partyEntries.every(e => e.group === 'Characters')).toBe(true);
    });

    test('reports where the campaign starts', async () => {
        const result = await createCampaign({ answers: answers(), ...fakeBackend().deps });
        expect(result).toMatchObject({
            worldName: 'Mi mundo', locationName: 'Cripta olvidada', boardName: 'Sala de entrada',
        });
    });

    test('an unknown template falls back to the first one instead of failing', async () => {
        const backend = fakeBackend();
        const result = await createCampaign({ answers: answers({ templateId: 'atlantis' }), ...backend.deps });
        expect(result.locationName).toBe('Cripta olvidada');
    });

    test('a template with no monsters adds none', async () => {
        const backend = fakeBackend();
        await createCampaign({ answers: answers({ templateId: 'tavern' }), ...backend.deps });
        expect(Object.values(backend.saved.entries).some(e => e.group === 'Monsters')).toBe(false);
    });

    // The bug this guards: createNewWorldInfo answers false for a name that collides once
    // sanitised, and carrying on would load the world that already exists and overwrite its
    // metadata.
    test('a refused world name stops everything before anything is loaded or written', async () => {
        const backend = fakeBackend({ createResult: false });

        await expect(createCampaign({ answers: answers(), ...backend.deps })).rejects.toThrow(/No se pudo crear/);
        expect(backend.calls).toEqual(['create:Mi mundo']);
        expect(backend.saved).toBeNull();
    });

    test('a world that cannot be loaded back is an error, not a silent no-op', async () => {
        const backend = fakeBackend({ loaded: null });

        await expect(createCampaign({ answers: answers(), ...backend.deps })).rejects.toThrow(/No se pudo cargar/);
        expect(backend.saved).toBeNull();
    });

    test('keeps any metadata the freshly created world already had', async () => {
        const backend = fakeBackend({ loaded: { entries: {}, metadata: { keepMe: true } } });
        await createCampaign({ answers: answers(), ...backend.deps });
        expect(backend.saved.metadata.keepMe).toBe(true);
    });

    test('does not touch any chat: binding the world to one is the new-chat path\'s job', async () => {
        const backend = fakeBackend();
        // No bind dependencies exist to be called, so this is a check on the signature too.
        await expect(createCampaign({ answers: answers(), ...backend.deps })).resolves.toBeDefined();
        expect(Object.keys(backend.deps).sort()).toEqual(['createEntry', 'createWorld', 'loadWorld', 'saveWorld']);
    });
});

describe('buildNewCampaignCta', () => {
    test('with no campaigns it offers the button instead of an instruction', () => {
        const html = buildNewCampaignCta(false);
        expect(html).toContain('id="cw-new-campaign"');
        expect(html).not.toContain('Start a new chat');
    });

    test('with campaigns it is a compact button above the cards', () => {
        const html = buildNewCampaignCta(true);
        expect(html).toContain('id="cw-new-campaign"');
        expect(html).toContain('cw-cta-inline');
    });
});
