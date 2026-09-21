import { describe, test, expect } from '@jest/globals';
import {
    isCampaignWorld, getStartingPoint, uniqueWorldName,
} from '../public/scripts/game-engine/campaign/campaign-worlds.js';
import { buildWorldMetadata, getTemplate } from '../public/scripts/game-engine/campaign/starter-templates.js';

describe('isCampaignWorld', () => {
    test('a world with a location on a map was built to be played', () => {
        expect(isCampaignWorld({ locationMaps: [{ name: 'Aldea' }] })).toBe(true);
    });

    // Lorebooks are also used for plain character or setting lore, which must not turn
    // up in the campaign list.
    test('a lore book with no locations is not a campaign', () => {
        expect(isCampaignWorld({})).toBe(false);
        expect(isCampaignWorld({ locationMaps: [] })).toBe(false);
        expect(isCampaignWorld({ displayName: 'Lore de personaje', genre: 'Fantasía' })).toBe(false);
    });

    test('junk metadata is not a campaign', () => {
        expect(isCampaignWorld(null)).toBe(false);
        expect(isCampaignWorld(undefined)).toBe(false);
        expect(isCampaignWorld({ locationMaps: 'Aldea' })).toBe(false);
    });

    // The exact world the first, broken version of the wizard left behind.
    test('a world built from any starter template counts', () => {
        for (const id of ['dungeon', 'forest', 'tavern', 'blank']) {
            expect(isCampaignWorld(buildWorldMetadata(getTemplate(id)))).toBe(true);
        }
    });
});

describe('getStartingPoint', () => {
    test('is the first location and its first board', () => {
        expect(getStartingPoint({
            locationMaps: [
                { name: 'Cripta', boards: [{ name: 'Sala' }, { name: 'Pasillo' }] },
                { name: 'Aldea', boards: [{ name: 'Plaza' }] },
            ],
        })).toEqual({ locationName: 'Cripta', boardName: 'Sala' });
    });

    test('honours the older shape where a location names a global board', () => {
        expect(getStartingPoint({ locationMaps: [{ name: 'Aldea', boardName: 'Plaza' }] }))
            .toEqual({ locationName: 'Aldea', boardName: 'Plaza' });
    });

    test('a location with no board still gives the location', () => {
        expect(getStartingPoint({ locationMaps: [{ name: 'Aldea' }] }))
            .toEqual({ locationName: 'Aldea', boardName: '' });
        expect(getStartingPoint({ locationMaps: [{ name: 'Aldea', boards: [] }] }))
            .toEqual({ locationName: 'Aldea', boardName: '' });
    });

    test('a world with no locations gives an empty starting point', () => {
        expect(getStartingPoint({})).toEqual({ locationName: '', boardName: '' });
        expect(getStartingPoint(null)).toEqual({ locationName: '', boardName: '' });
        expect(getStartingPoint({ locationMaps: [null] })).toEqual({ locationName: '', boardName: '' });
    });

    // What the wizard writes must be what this reads, or "Iniciar" would land nowhere.
    test('reads back the location and board every starter template writes', () => {
        for (const id of ['dungeon', 'forest', 'tavern', 'blank']) {
            const template = getTemplate(id);
            expect(getStartingPoint(buildWorldMetadata(template))).toEqual({
                locationName: template.locationName, boardName: template.boardName,
            });
        }
    });
});

describe('uniqueWorldName', () => {
    test('a free name is used as it is', () => {
        expect(uniqueWorldName('Mazmorra clásica', ['Eldoria'])).toBe('Mazmorra clásica');
    });

    // The reported dead end: the second attempt was refused for a name nobody had typed.
    test('a taken name gets a number instead of being refused', () => {
        expect(uniqueWorldName('Mazmorra clásica', ['Mazmorra clásica'])).toBe('Mazmorra clásica (2)');
    });

    test('keeps counting past numbers that are also taken', () => {
        expect(uniqueWorldName('Mazmorra clásica', [
            'Mazmorra clásica', 'Mazmorra clásica (2)', 'Mazmorra clásica (3)',
        ])).toBe('Mazmorra clásica (4)');
    });

    test('fills a gap in the numbering rather than skipping it', () => {
        expect(uniqueWorldName('Mundo', ['Mundo', 'Mundo (3)'])).toBe('Mundo (2)');
    });

    test('compares without regard to case, since a Lorebook is a file', () => {
        expect(uniqueWorldName('Mazmorra Clásica', ['mazmorra clásica'])).toBe('Mazmorra Clásica (2)');
    });

    test('ignores surrounding spaces on both sides', () => {
        expect(uniqueWorldName('  Mundo  ', [' mundo '])).toBe('Mundo (2)');
    });

    test('an empty suggestion still yields a usable name', () => {
        expect(uniqueWorldName('', [])).toBe('Nueva campaña');
        expect(uniqueWorldName(null, ['Nueva campaña'])).toBe('Nueva campaña (2)');
    });

    test('a missing list of existing names means everything is free', () => {
        expect(uniqueWorldName('Mundo', undefined)).toBe('Mundo');
        expect(uniqueWorldName('Mundo', null)).toBe('Mundo');
    });
});
