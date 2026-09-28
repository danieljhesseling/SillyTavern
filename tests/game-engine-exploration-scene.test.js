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
        expect(view.boards.map(b => ({ name: b.name, current: b.current }))).toEqual([
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
        expect(view.boards).toEqual([{ name: 'Plaza', current: false, note: '', icon: 'fa-road' }]);
    });

    test('un tablero dice de qué va, con su objetivo, y lleva un icono por su nombre', () => {
        const view = buildExplorationView({
            locationMaps: [{ name: 'Aldea', boards: [{ name: 'El cuarto de la posada', objectives: [{ label: 'Salir vivo del cuarto' }] }] }],
            currentLocation: 'Aldea', party,
        });
        expect(view.boards[0]).toMatchObject({ note: 'Salir vivo del cuarto', icon: 'fa-bed' });
    });
});

// Se viaja a los vecinos: de la posada al pueblo y del pueblo al santuario.
describe('a dónde se llega desde aquí', () => {
    const roads = [
        { name: 'La Posada', locationType: 'village', routes: [{ to: 'El Pueblo', days: 1 }] },
        { name: 'El Pueblo', locationType: 'city', routes: [{ to: 'El Santuario', days: 2 }] },
        { name: 'El Santuario', locationType: 'sanctuary', routes: [] },
    ];

    test('el vecino se puede; lo de más lejos dice por dónde se pasa', () => {
        const view = buildExplorationView({ locationMaps: roads, currentLocation: 'La Posada', party });
        const by = Object.fromEntries(view.places.map(p => [p.name, p]));
        expect(by['La Posada'].reach).toBe('here');
        expect(by['El Pueblo']).toMatchObject({ reach: 'near', days: 1, icon: 'fa-chess-rook' });
        expect(by['El Santuario']).toMatchObject({ reach: 'far', via: 'El Pueblo', days: 3, icon: 'fa-place-of-worship' });
    });

    test('un camino que la historia aún no abre se ve cerrado, con su motivo', () => {
        const view = buildExplorationView({
            locationMaps: [
                { name: 'La Posada', routes: [{ to: 'El Pueblo', days: 1, closedUntil: 'el-ultimatum' }] },
                { name: 'El Pueblo', routes: [] },
            ],
            currentLocation: 'La Posada', party,
        });
        expect(view.places.find(p => p.name === 'El Pueblo')).toMatchObject({ reach: 'shut' });
        expect(view.places.find(p => p.name === 'El Pueblo')?.why).toMatch(/más adelante en la historia/);
        const opened = buildExplorationView({
            locationMaps: [
                { name: 'La Posada', routes: [{ to: 'El Pueblo', days: 1, closedUntil: 'el-ultimatum' }] },
                { name: 'El Pueblo', routes: [] },
            ],
            currentLocation: 'La Posada', party, travel: { done: ['el-ultimatum'] },
        });
        expect(opened.places.find(p => p.name === 'El Pueblo')?.reach).toBe('near');
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
