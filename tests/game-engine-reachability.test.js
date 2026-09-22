import { describe, test, expect } from '@jest/globals';
import {
    floodFrom, findUnreachable, describeReachability, isWalkableEventually,
} from '../public/scripts/game-engine/board/reachability.js';
import { terrainFromAsciiMap } from '../public/scripts/game-engine/board/terrain.js';

/** Dos salas con una puerta cerrada en medio: el ritmo de una mazmorra. */
const CONECTADO = [
    '#########',
    '#...#...#',
    '#...D...#',
    '#...#...#',
    '#########',
];

/** La misma, pero con la puerta tapiada: la sala de la derecha no se alcanza. */
const AISLADO = [
    '#########',
    '#...#...#',
    '#...#...#',
    '#...#...#',
    '#########',
];

const board = (map) => ({ terrain: terrainFromAsciiMap(map), gridWidth: map[0].length, gridHeight: map.length });

describe('por donde se puede pasar', () => {
    test('una puerta cerrada no corta: se abre', () => {
        const { terrain, gridWidth, gridHeight } = board(CONECTADO);
        expect(isWalkableEventually(terrain, 4, 2, gridWidth, gridHeight)).toBe(true);
    });

    test('un muro si corta', () => {
        const { terrain, gridWidth, gridHeight } = board(AISLADO);
        expect(isWalkableEventually(terrain, 4, 2, gridWidth, gridHeight)).toBe(false);
    });

    test('y lo de fuera del tablero tampoco existe', () => {
        const { terrain, gridWidth, gridHeight } = board(CONECTADO);
        expect(isWalkableEventually(terrain, -1, 0, gridWidth, gridHeight)).toBe(false);
        expect(isWalkableEventually(terrain, 99, 0, gridWidth, gridHeight)).toBe(false);
    });
});

describe('la inundacion', () => {
    test('atraviesa una puerta cerrada y moja las dos salas', () => {
        const wet = floodFrom({ ...board(CONECTADO), starts: [{ x: 1, y: 1 }] });
        expect(wet.has('7,1')).toBe(true);
    });

    test('y con la puerta tapiada se queda en la primera', () => {
        const wet = floodFrom({ ...board(AISLADO), starts: [{ x: 1, y: 1 }] });
        expect(wet.has('1,1')).toBe(true);
        expect(wet.has('7,1')).toBe(false);
    });

    test('un inicio sobre un muro no moja nada', () => {
        expect(floodFrom({ ...board(CONECTADO), starts: [{ x: 0, y: 0 }] }).size).toBe(0);
    });

    test('sin inicios tampoco', () => {
        expect(floodFrom({ ...board(CONECTADO), starts: [] }).size).toBe(0);
    });

    test('una diagonal no se cuela entre dos muros en contacto', () => {
        // Dos cuartos que solo se tocan por la esquina: por ahi no cabe nadie.
        const esquina = [
            '#####',
            '#.#.#',
            '##..#',
            '#####',
        ];
        const wet = floodFrom({ ...board(esquina), starts: [{ x: 1, y: 1 }] });
        expect(wet.has('3,1')).toBe(false);
    });
});

describe('lo que queda incomunicado', () => {
    test('un tablero sano no tiene nada suelto', () => {
        const report = findUnreachable({ ...board(CONECTADO), starts: [{ x: 1, y: 1 }] });
        expect(report.orphanCells).toBe(0);
        expect(report.enemies).toEqual([]);
        expect(report.reachable).toBe(report.total);
    });

    test('una sala amurallada sale con sus casillas y sus enemigos', () => {
        const report = findUnreachable({
            ...board(AISLADO),
            starts: [{ x: 1, y: 1 }],
            enemies: [{ name: 'Goblin', x: 7, y: 2 }, { name: 'Rata', x: 2, y: 2 }],
        });
        expect(report.orphanCells).toBe(9);
        expect(report.enemies).toEqual([{ name: 'Goblin', x: 7, y: 2 }]);
    });

    test('y una casilla de objetivo que no se alcanza, tambien', () => {
        const report = findUnreachable({
            ...board(AISLADO), starts: [{ x: 1, y: 1 }], cells: [{ x: 7, y: 1 }, { x: 2, y: 2 }],
        });
        expect(report.cells).toEqual([{ x: 7, y: 1 }]);
    });
});

describe('contado en una linea', () => {
    test('dice cuanto se alcanza y que falta', () => {
        const report = findUnreachable({
            ...board(AISLADO), starts: [{ x: 1, y: 1 }], enemies: [{ name: 'Goblin', x: 7, y: 2 }],
        });
        expect(describeReachability(report))
            .toBe('9 de 18 casillas se alcanzan, 9 incomunicadas, 1 enemigo(s) inalcanzables.');
    });

    test('y un tablero sin suelo lo dice sin pretender contar', () => {
        expect(describeReachability({ reachable: 0, total: 0, orphanCells: 0, enemies: [], cells: [] }))
            .toBe('El tablero no tiene ni una casilla transitable.');
    });
});
