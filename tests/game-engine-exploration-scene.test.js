import { describe, test, expect } from '@jest/globals';
import { buildExplorationView } from '../public/scripts/game-engine/ui/shell/exploration-scene.js';

const world = [
    { name: 'Cripta olvidada', description: 'Fría y húmeda', boards: [{ name: 'Sala de entrada' }, { name: 'Cámara' }] },
    { name: 'Aldea', boards: [{ name: 'Plaza' }] },
    { name: 'Torre', boards: [] },
];
const party = [{ id: 1, name: 'Lyra', hp: 20, maxHp: 20 }, { id: 2, name: 'Brand', hp: 5, maxHp: 24 }];

describe('where the party is', () => {
    test('names the location, its description and its boards', () => {
        const view = buildExplorationView({
            locationMaps: world, currentLocation: 'Cripta olvidada', currentBoard: 'Cámara', party,
        });
        expect(view.here).toBe('Cripta olvidada');
        expect(view.description).toBe('Fría y húmeda');
        expect(view.boards).toEqual([
            { name: 'Sala de entrada', current: false },
            { name: 'Cámara', current: true },
        ]);
    });

    test('a party that is nowhere yet still gets the map', () => {
        const view = buildExplorationView({ locationMaps: world, party });
        expect(view.here).toBe('');
        expect(view.boards).toEqual([]);
        expect(view.places).toHaveLength(3);
    });

    test('reads the older shape where a location names one board', () => {
        const view = buildExplorationView({
            locationMaps: [{ name: 'Aldea', boardName: 'Plaza' }], currentLocation: 'Aldea', party,
        });
        expect(view.boards).toEqual([{ name: 'Plaza', current: false }]);
    });
});

describe('the places on the map', () => {
    // Every campaign that exists today has no campaign map at all: everywhere is open.
    test('a campaign with no map has everywhere open', () => {
        const view = buildExplorationView({ locationMaps: world, party });
        expect(view.places.map(p => p.status)).toEqual(['available', 'available', 'available']);
        expect(view.places.map(p => p.boards)).toEqual([2, 1, 0]);
    });

    test('a place that needs another one finished stays shut, and says so', () => {
        const view = buildExplorationView({
            locationMaps: world, party,
            campaignMap: { locations: [{ id: 'Aldea', status: 'locked', requiresLocations: ['Cripta olvidada'] }] },
        });
        const aldea = view.places.find(p => p.id === 'Aldea');
        expect(aldea?.status).toBe('locked');
        expect(aldea?.reasons).toEqual(['Requiere haber superado "Cripta olvidada".']);
    });

    test('and opens once that one is finished', () => {
        const view = buildExplorationView({
            locationMaps: world, party,
            campaignMap: {
                locations: [
                    { id: 'Cripta olvidada', status: 'complete' },
                    { id: 'Aldea', status: 'locked', requiresLocations: ['Cripta olvidada'] },
                ],
            },
        });
        expect(view.places.find(p => p.id === 'Aldea')?.status).toBe('available');
        expect(view.places.find(p => p.id === 'Cripta olvidada')?.status).toBe('complete');
    });
});

describe('requirements the engine checks instead of trusting', () => {
    test('a quest that is not done keeps the place shut', () => {
        const locked = buildExplorationView({
            locationMaps: world, party,
            campaignMap: { locations: [{ id: 'Torre', status: 'locked', requiresQuests: ['el_sello'] }] },
        });
        expect(locked.places.find(p => p.id === 'Torre')?.reasons)
            .toEqual(['Requiere completar la misión "el_sello".']);

        const open = buildExplorationView({
            locationMaps: world, party,
            campaignMap: { locations: [{ id: 'Torre', status: 'locked', requiresQuests: ['el_sello'] }] },
            isQuestComplete: id => id === 'el_sello',
        });
        expect(open.places.find(p => p.id === 'Torre')?.status).toBe('available');
    });

    test('a bond requirement is read by name as well as by id', () => {
        const map = {
            locations: [{ id: 'Torre', status: 'locked', requiresBondRank: 3, requiresBondWith: 'Lyra' }],
        };
        const shut = buildExplorationView({ locationMaps: world, party, campaignMap: map });
        expect(shut.places.find(p => p.id === 'Torre')?.status).toBe('locked');
        expect(shut.places.find(p => p.id === 'Torre')?.reasons[0]).toMatch(/vínculo 3 con Lyra/);

        const raised = buildExplorationView({
            locationMaps: world, party, campaignMap: map, bonds: { bonds: { 1: { points: 40 } } },
        });
        expect(raised.places.find(p => p.id === 'Torre')?.status).toBe('available');
    });

    // Offering somewhere you cannot go is worse than not offering it.
    test('a stored place the world does not have is dropped', () => {
        const view = buildExplorationView({
            locationMaps: [{ name: 'Aldea' }], party,
            campaignMap: { locations: [{ id: 'Aldea' }, { id: 'Ciudad fantasma', status: 'available' }] },
        });
        expect(view.places.map(p => p.id)).toEqual(['Aldea']);
    });

    test('a finished place stays finished even if its requirements lapse', () => {
        const view = buildExplorationView({
            locationMaps: world, party,
            campaignMap: { locations: [{ id: 'Torre', status: 'complete', requiresQuests: ['nunca'] }] },
        });
        expect(view.places.find(p => p.id === 'Torre')?.status).toBe('complete');
        expect(view.places.find(p => p.id === 'Torre')?.reasons).toEqual([]);
    });
});

describe('the rest of the scene', () => {
    test('carries the party strip and the moment, like the conversation does', () => {
        const view = buildExplorationView({ locationMaps: world, party, calendar: { day: 3, slotIndex: 1 } });
        expect(view.moment).toMatch(/^Día 3 · /);
        expect(view.party.map(c => c.name)).toEqual(['Lyra', 'Brand']);
        expect(view.party[1].bloodied).toBe(true);
    });

    test('a world with nothing in it does not throw', () => {
        expect(buildExplorationView()).toMatchObject({ here: '', places: [], boards: [], party: [] });
        expect(buildExplorationView({ locationMaps: null, campaignMap: 'nonsense' }).places).toEqual([]);
        expect(buildExplorationView({ locationMaps: [null, { }] }).places).toEqual([]);
    });
});
