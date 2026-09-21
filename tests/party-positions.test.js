import { describe, test, expect } from '@jest/globals';
import { resolveEntryMapPosition } from '../public/scripts/party/positions.js';
import {
    STARTER_TEMPLATES, buildWorldEntries, buildWorldMetadata, getTemplateSize,
} from '../public/scripts/game-engine/campaign/starter-templates.js';
import { isPassable } from '../public/scripts/game-engine/board/terrain.js';

describe('resolveEntryMapPosition', () => {
    test('a mapPosition object is used as it comes', () => {
        expect(resolveEntryMapPosition({
            mapPosition: { locationName: 'Cripta', gridX: 4, gridY: 7 },
        })).toEqual({ locationName: 'Cripta', gridX: 4, gridY: 7 });
    });

    // These are the fields the content browser saves, which nothing used to read.
    test('falls back to the location, boardX and boardY the content browser writes', () => {
        expect(resolveEntryMapPosition({ location: 'Aldea', boardX: 3, boardY: 5 }))
            .toEqual({ locationName: 'Aldea', gridX: 3, gridY: 5 });
    });

    test('locationName is preferred over location, as before', () => {
        expect(resolveEntryMapPosition({ locationName: 'Uno', location: 'Dos' }).locationName).toBe('Uno');
    });

    test('mapPosition wins over the browser fields', () => {
        const result = resolveEntryMapPosition({
            mapPosition: { locationName: 'Cripta', gridX: 1, gridY: 1 },
            location: 'Otra', boardX: 9, boardY: 9,
        });
        expect(result).toEqual({ locationName: 'Cripta', gridX: 1, gridY: 1 });
    });

    test('an empty location name does not hide a real one further down', () => {
        expect(resolveEntryMapPosition({ mapPosition: { locationName: '' }, location: 'Aldea' }).locationName)
            .toBe('Aldea');
    });

    test('a position of zero is a position, not a missing value', () => {
        expect(resolveEntryMapPosition({ mapPosition: { locationName: 'X', gridX: 0, gridY: 0 }, boardX: 5, boardY: 5 }))
            .toMatchObject({ gridX: 0, gridY: 0 });
    });

    test('nothing usable starts at the origin with no location, as it always did', () => {
        expect(resolveEntryMapPosition(undefined)).toEqual({ locationName: '', gridX: 0, gridY: 0 });
        expect(resolveEntryMapPosition(null)).toEqual({ locationName: '', gridX: 0, gridY: 0 });
        expect(resolveEntryMapPosition('nonsense')).toEqual({ locationName: '', gridX: 0, gridY: 0 });
        expect(resolveEntryMapPosition({})).toEqual({ locationName: '', gridX: 0, gridY: 0 });
    });

    test('coordinates are whole and never negative', () => {
        expect(resolveEntryMapPosition({ mapPosition: { locationName: 'X', gridX: 3.9, gridY: -2 } }))
            .toMatchObject({ gridX: 3, gridY: 0 });
        expect(resolveEntryMapPosition({ mapPosition: { locationName: 'X', gridX: 'abc', gridY: NaN } }))
            .toMatchObject({ gridX: 0, gridY: 0 });
    });

    test('numeric strings from a form are accepted', () => {
        expect(resolveEntryMapPosition({ location: 'Aldea', boardX: '6', boardY: '2' }))
            .toMatchObject({ gridX: 6, gridY: 2 });
    });
});

// The first version of the wizard put the party in its templates' partyStart cells and
// tested exactly that. What the game reads is a different thing: setPartyFromWorldEntries
// ignored the position entirely and put everybody at (0, 0), which is a wall. So the
// tests below start from what the templates *write* and follow it through what the game
// *reads*, instead of checking the template data against itself.
describe('what the starter templates write is what the game reads', () => {
    const NAMES = ['Lyra', 'Brand', 'Mira', 'Tomás'];

    for (const template of STARTER_TEMPLATES) {
        describe(`template ${template.id}`, () => {
            const { gridWidth, gridHeight } = getTemplateSize(template);
            const board = buildWorldMetadata(template).locationMaps[0].boards[0];
            const members = buildWorldEntries(template, NAMES)
                .filter(entry => entry.group === 'Characters')
                .map(entry => ({ name: entry.title, ...resolveEntryMapPosition(entry.dndData) }));

            test('every member ends up in the location the campaign starts in', () => {
                for (const member of members) {
                    expect(member.locationName).toBe(template.locationName);
                }
            });

            test('every member ends up on ground they can stand on', () => {
                for (const member of members) {
                    expect(isPassable(board.terrain, member.gridX, member.gridY, gridWidth, gridHeight)).toBe(true);
                }
            });

            test('no two members share a cell', () => {
                const cells = members.map(m => `${m.gridX},${m.gridY}`);
                expect(new Set(cells).size).toBe(cells.length);
            });

            test('nobody is left on the origin cell, where the old reader put everyone', () => {
                // Not a rule about origins in general: a template may legitimately start
                // somebody there. It fails only if the resolver is dropping the position.
                const stuck = members.filter(m => m.gridX === 0 && m.gridY === 0);
                expect(stuck).toEqual([]);
            });
        });
    }
});
