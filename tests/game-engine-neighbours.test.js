import fs from 'node:fs';
import { describe, test, expect } from '@jest/globals';
import { createCompendium } from '../public/scripts/game-engine/compendio/compendio.js';
import { createSeededRandom } from '../public/scripts/game-engine/combat/seeded-random.js';
import { buildRouteMap, planTravel } from '../public/scripts/game-engine/world/travel.js';
import {
    rollNeighbours, withNeighbours, DEFAULT_NEIGHBOURS,
} from '../public/scripts/game-engine/world/neighbours.js';

const read = (name) => JSON.parse(fs.readFileSync(
    new URL(`../public/compendio/${name}.json`, import.meta.url), 'utf8',
)).rows;

const real = () => createCompendium({ nombres: read('nombres'), mundo: read('mundo') });
const home = () => ([{ name: 'La Cripta', gridWidth: 20, gridHeight: 15, boards: [{ name: 'Entrada' }] }]);
const roll = (seed = 'semilla') => withNeighbours({
    compendium: real(), locations: home(), random: createSeededRandom(seed),
});

describe('un mundo nuevo tiene a dónde ir', () => {
    // Con un solo sitio no hay distancia, y sin distancia no hay nada de lo que el
    // mundo-lista prometía.
    test('un sitio solo se queda en varios', () => {
        expect(roll()).toHaveLength(DEFAULT_NEIGHBOURS + 1);
    });

    test('sin batería de nombres no se inventa nada, y la campaña sale igual', () => {
        const sin = withNeighbours({
            compendium: createCompendium({}), locations: home(), random: createSeededRandom('x'),
        });
        expect(sin).toEqual(home());
    });

    // Alguien los puso a mano, y eso manda sobre esto.
    test('y un mundo que ya tiene sitios no se toca', () => {
        const dos = [...home(), { name: 'El Molino' }];
        expect(withNeighbours({ compendium: real(), locations: dos, random: createSeededRandom('x') }))
            .toEqual(dos);
    });

    test('el sitio de partida sigue siendo el primero, con su tablero', () => {
        expect(roll()[0].name).toBe('La Cripta');
        expect(roll()[0].boards).toHaveLength(1);
    });

    test('ningún nombre se repite', () => {
        const nombres = roll().map(l => l.name);
        expect(new Set(nombres).size).toBe(nombres.length);
    });

    test('cada vecino sabe de qué clase de sitio es', () => {
        for (const place of roll().slice(1)) expect(place.biome).not.toBe('');
    });

    // La semilla no es el texto: la misma semilla, el mismo mapa.
    test('la misma semilla da el mismo mapa, y otra da otro', () => {
        expect(roll('una').map(l => l.name)).toEqual(roll('una').map(l => l.name));
        expect(roll('una').map(l => l.name)).not.toEqual(roll('otra').map(l => l.name));
    });
});

describe('y los caminos sirven para viajar', () => {
    test('se puede llegar a todos desde casa', () => {
        const places = roll();
        for (const place of places.slice(1)) {
            expect(planTravel({ from: 'La Cripta', to: place.name, locations: places }).ok).toBe(true);
        }
    });

    test('cada camino se escribe una sola vez', () => {
        const places = roll();
        const escritos = places.flatMap(p => (p.routes ?? []).map(r => `${p.name}>${r.to}`));
        expect(new Set(escritos).size).toBe(escritos.length);
    });

    // Sin esto, ir de un vecino a otro sería siempre volver al centro y `planTravel` no
    // tendría nunca un rodeo que proponer.
    test('el mapa no es una estrella: el último también llega a casa por fuera', () => {
        const places = roll();
        const last = places[places.length - 1];
        expect((last.routes ?? []).map(r => r.to)).toContain('La Cripta');
    });

    test('y hay dos maneras de llegar al último, una corta y otra larga', () => {
        const places = roll();
        const last = places[places.length - 1];
        const mapa = buildRouteMap(places);
        expect(mapa.get('La Cripta').some(r => r.to === last.name)).toBe(true);

        const directo = mapa.get('La Cripta').find(r => r.to === last.name).days;
        const plan = planTravel({ from: 'La Cripta', to: last.name, locations: places });
        // El corto es el que se coge; el largo existe para cuando alguien cierre el otro.
        expect(plan.days).toBeLessThanOrEqual(directo);
    });

    test('lo de más allá cuesta más días que lo de al lado', () => {
        const places = roll();
        const cerca = planTravel({ from: 'La Cripta', to: places[1].name, locations: places }).days;
        const lejos = planTravel({ from: 'La Cripta', to: places[2].name, locations: places }).days;
        expect(lejos).toBeGreaterThan(cerca);
    });

    test('rollNeighbours devuelve solo los nuevos, ya conectados', () => {
        const made = rollNeighbours({
            compendium: real(), locations: home(), random: createSeededRandom('x'),
        });
        expect(made).toHaveLength(DEFAULT_NEIGHBOURS);
        expect(made.every(p => (p.routes ?? []).length > 0)).toBe(true);
    });
});
