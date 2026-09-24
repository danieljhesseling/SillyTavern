import { describe, test, expect } from '@jest/globals';
import { shareFor, chooseSource, DEFAULT_CURVE } from '../public/scripts/game-engine/campaign/mix.js';
import {
    canExplore, discoverPlace, boardForPlace, peopleWanted, readProposals, addProposal, takeProposal,
    MAX_PLACES, MAX_PROPOSALS,
} from '../public/scripts/game-engine/world/growth.js';
import { createCompendium } from '../public/scripts/game-engine/compendio/compendio.js';
import { createSeededRandom } from '../public/scripts/game-engine/combat/seeded-random.js';

describe('la mezcla (M7)', () => {
    test('la curva de serie: 80/20 al empezar, y el chat entra después', () => {
        expect(shareFor(1)).toEqual(DEFAULT_CURVE[1]);
        expect(shareFor(3).chat).toBeCloseTo(0.25);
        expect(shareFor(1, true)).toEqual(DEFAULT_CURVE.after);
    });

    test('un mundo puede traer su curva, solo lo escrito o entera', () => {
        const only = shareFor(1, false, { 1: 0.5 });
        expect(only.written).toBe(0.5);
        expect(only.seed + only.chat).toBeCloseTo(0.5);
        expect(shareFor(2, false, { 2: { written: 1, seed: 0, chat: 0 } })).toEqual({ written: 1, seed: 0, chat: 0 });
    });

    test('el dado decide, dentro de la curva', () => {
        expect(chooseSource({ act: 1, roll: 0.1, have: { written: true } })).toBe('written');
        expect(chooseSource({ act: 1, roll: 0.9, have: { written: true } })).toBe('seed');
        expect(chooseSource({ act: 3, roll: 0.95, have: { written: true, chat: true } })).toBe('chat');
    });

    test('lo que no hay, no se elige: se genera', () => {
        expect(chooseSource({ act: 1, roll: 0.1, have: { written: false } })).toBe('seed');
        expect(chooseSource({ act: 3, roll: 0.95, have: { written: true, chat: false } })).toBe('seed');
    });
});

const compendium = createCompendium({
    nombres: [
        { id: 'n1', kind: 'place', patterns: ['{a}'], parts: { a: ['Hoya', 'Cerro', 'Vado', 'Pinar', 'Collado'] } },
    ],
    sitios: [
        { id: 'tipo-cueva', name: 'Cueva', kind: 'tipo', locationType: 'dungeon', shape: 'cave', note: 'Oscura.', when: { biome: ['montana'] } },
        { id: 'tipo-aldea', name: 'Aldea', kind: 'tipo', locationType: 'village', shape: 'camp', note: 'Techo y sopa.' },
    ],
});

describe('explorar los alrededores (G1)', () => {
    const here = [{ name: 'Castillo', biome: 'montana', gridWidth: 20, gridHeight: 15, routes: [] }];

    test('con tope: los escondidos también cuentan', () => {
        expect(canExplore(Array(MAX_PLACES - 1).fill({}))).toBe(true);
        expect(canExplore(Array(MAX_PLACES - 2).fill({}), [{}, {}])).toBe(false);
    });

    test('un sitio nuevo junto al tuyo, con camino, tipo y bioma', () => {
        const place = discoverPlace({ compendium, locations: here, here: 'Castillo', random: createSeededRandom('a') });
        expect(place).toMatchObject({ biome: 'montana', discovered: 'seed' });
        expect(place.routes).toEqual([{ to: 'Castillo', days: expect.any(Number) }]);
        expect(place.routes[0].days).toBeGreaterThanOrEqual(1);
        expect(place.routes[0].days).toBeLessThanOrEqual(2);
        expect(place.name).toBeTruthy();
    });

    test('con la misma semilla, el mismo sitio', () => {
        const a = discoverPlace({ compendium, locations: here, here: 'Castillo', random: createSeededRandom('x') });
        const b = discoverPlace({ compendium, locations: here, here: 'Castillo', random: createSeededRandom('x') });
        expect(a).toEqual(b);
    });

    test('lo que propuso el chat, con su nombre y lo que se contó', () => {
        const place = discoverPlace({
            compendium, locations: here, here: 'Castillo', random: createSeededRandom('b'),
            name: 'La cueva del norte', note: 'Se ve humo.', source: 'chat',
        });
        expect(place).toMatchObject({ name: 'La cueva del norte', discovered: 'chat' });
        expect(place.description).toMatch(/^Se ve humo\./);
    });

    test('ni un nombre repetido, ni desde un sitio que no existe', () => {
        expect(discoverPlace({ compendium, locations: here, here: 'Castillo', random: Math.random, name: 'castillo' })).toBeNull();
        expect(discoverPlace({ compendium, locations: here, here: 'Ninguna', random: Math.random })).toBeNull();
    });
});

describe('su tablero y su gente (G2, G3)', () => {
    test('un tablero de su forma, con los bichos que se le den', () => {
        const board = boardForPlace({
            place: { name: 'La hoya', shape: 'cave', description: 'Oscura.' },
            random: createSeededRandom('t'), bestiary: ['Lobo'], partySize: 2,
        });
        expect(board.name).toBe('La hoya');
        expect(board.partyStart.length).toBeGreaterThan(0);
        expect(Object.keys(board.terrain.cells).length).toBeGreaterThan(10);
        expect(board.enemyPlacements.every((/** @type {any} */ e) => e.name === 'Lobo')).toBe(true);
    });

    test('cuánta gente falta', () => {
        expect(peopleWanted(0)).toBe(2);
        expect(peopleWanted(1)).toBe(1);
        expect(peopleWanted(4)).toBe(0);
    });
});

describe('lo que propone el chat (G6)', () => {
    test('se apunta, sin repetir ni lo que ya está en el mapa', () => {
        let list = addProposal([], { name: 'La cueva', note: 'Humo', near: 'Castillo' }).proposals;
        expect(list).toEqual([{ name: 'La cueva', note: 'Humo', near: 'Castillo' }]);
        expect(addProposal(list, { name: 'la cueva' }).added).toBe(false);
        expect(addProposal(list, { name: 'Castillo' }, ['Castillo']).added).toBe(false);
        for (const n of ['A', 'B', 'C']) list = addProposal(list, { name: n }).proposals;
        expect(list).toHaveLength(MAX_PROPOSALS);
        expect(list[0].name).toBe('A');
    });

    test('ir a buscarla la saca de la lista', () => {
        const { proposal, proposals } = takeProposal([{ name: 'La cueva' }, { name: 'El pozo' }], 'la cueva');
        expect(proposal?.name).toBe('La cueva');
        expect(proposals.map(p => p.name)).toEqual(['El pozo']);
        expect(readProposals(null)).toEqual([]);
    });
});
