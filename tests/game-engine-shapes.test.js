import { describe, test, expect } from '@jest/globals';
import {
    SHAPES, COVER_BUDGET, solidGrid, floodRegions, connectRegions, erode,
    coverRatio, applyCoverBudget, carveCave, carveCamp, carveTemple, symmetry,
} from '../public/scripts/game-engine/world-builder/shapes.js';
import { generateBoard } from '../public/scripts/game-engine/world-builder/dungeon-generator.js';

/** Un azar repetible. */
const rolling = (seed) => {
    let state = seed;
    return () => ((state = (state * 9301 + 49297) % 233280) / 233280);
};

/** Una rejilla de un mapa escrito a mano, para poder mirarla. */
const gridFrom = (rows) => rows.map(row => [...row]);

describe('los trozos de suelo', () => {
    test('un sitio de una pieza tiene una', () => {
        const grid = gridFrom(['#####', '#...#', '#...#', '#####']);
        expect(floodRegions(grid)).toHaveLength(1);
        expect(floodRegions(grid)[0]).toHaveLength(6);
    });

    test('y dos partes separadas son dos', () => {
        const grid = gridFrom(['#####', '#.#.#', '#.#.#', '#####']);
        expect(floodRegions(grid)).toHaveLength(2);
    });

    test('lo que no se puede pisar no cuenta como suelo', () => {
        const grid = gridFrom(['####', '#..#', '####']);
        expect(floodRegions(grid)[0]).toHaveLength(2);
    });

    test('pero la cobertura sí: se pisa, aunque estorbe', () => {
        const grid = gridFrom(['####', '#Cc#', '####']);
        expect(floodRegions(grid)[0]).toHaveLength(2);
    });
});

describe('que se llegue a todo', () => {
    // Un sitio con una parte inalcanzable es un sitio roto, y con un algoritmo orgánico
    // eso pasa casi siempre.
    test('lo que quede suelto se une', () => {
        const grid = gridFrom(['#######', '#.#...#', '#.#...#', '#######']);
        expect(floodRegions(grid)).toHaveLength(2);
        expect(connectRegions(grid)).toBeGreaterThan(0);
        expect(floodRegions(grid)).toHaveLength(1);
    });

    test('y lo que ya estaba unido no se toca', () => {
        const grid = gridFrom(['#####', '#...#', '#####']);
        const before = grid.map(row => row.join(''));
        expect(connectRegions(grid)).toBe(0);
        expect(grid.map(row => row.join(''))).toEqual(before);
    });
});

describe('quitar las púas', () => {
    // Es la diferencia entre una cueva y un dibujo de una cueva.
    test('un muro suelto en medio del suelo sobra', () => {
        const grid = gridFrom(['#####', '#...#', '#.#.#', '#...#', '#####']);
        erode(grid);
        expect(grid[2][2]).toBe('.');
    });

    test('y una pared de verdad se queda', () => {
        const grid = gridFrom(['#####', '#.#.#', '#.#.#', '#.#.#', '#####']);
        erode(grid);
        expect(grid[2][2]).toBe('#');
    });
});

describe('el presupuesto de cobertura', () => {
    test('se mide sobre el suelo, no sobre el tablero', () => {
        expect(coverRatio(gridFrom(['####', '#.c#', '####']))).toBe(0.5);
        expect(coverRatio(gridFrom(['####', '####']))).toBe(0);
    });

    // Una sala vacía se juega sola: todo el mundo se pega y tira.
    test('un sitio pelado se llena hasta que se pueda jugar', () => {
        const grid = solidGrid(20, 14);
        for (let y = 1; y < 13; y++) for (let x = 1; x < 19; x++) grid[y][x] = '.';
        expect(coverRatio(grid)).toBe(0);

        applyCoverBudget(grid, rolling(7));
        expect(coverRatio(grid)).toBeGreaterThanOrEqual(COVER_BUDGET.min);
        expect(coverRatio(grid)).toBeLessThanOrEqual(COVER_BUDGET.max);
    });

    test('y uno atiborrado se despeja', () => {
        const grid = solidGrid(20, 14);
        for (let y = 1; y < 13; y++) for (let x = 1; x < 19; x++) grid[y][x] = 'C';
        applyCoverBudget(grid, rolling(3));
        expect(coverRatio(grid)).toBeLessThanOrEqual(COVER_BUDGET.max);
    });

    // Tapar un paso de una casilla no es cobertura, es un muro.
    test('no se tapa un paso de una casilla', () => {
        const grid = gridFrom(['#####', '###.#', '#...#', '#.###', '#####']);
        applyCoverBudget(grid, rolling(5), { min: 0.9, max: 1 });
        expect(grid[1][3]).toBe('.');
        expect(grid[3][1]).toBe('.');
    });
});

describe('las formas', () => {
    const shaped = (carve, seed = 7) => {
        const grid = solidGrid(24, 16);
        carve(grid, rolling(seed));
        return grid;
    };

    test('una cueva no tiene esquinas rectas ni trozos sueltos', () => {
        const grid = shaped(carveCave);
        expect(floodRegions(grid)).toHaveLength(1);
        // Y no se queda en un pasillo: una cueva de diez casillas no es una cueva.
        expect(floodRegions(grid)[0].length).toBeGreaterThan(40);
    });

    test('un campamento se ve de lado a lado, y aun así estorba', () => {
        const grid = shaped(carveCamp);
        expect(floodRegions(grid)).toHaveLength(1);
        expect(coverRatio(grid)).toBeGreaterThan(0.05);
    });

    // La simetría dice que alguien lo construyó; el fallo, que lleva ahí mucho tiempo.
    test('un templo es simétrico, pero no del todo', () => {
        const grid = shaped(carveTemple);
        const mirror = symmetry(grid);
        expect(mirror).toBeGreaterThan(0.8);
        expect(mirror).toBeLessThan(1);
    });

    test('y las tres dejan el borde cerrado', () => {
        for (const carve of [carveCave, carveCamp, carveTemple]) {
            const grid = shaped(carve);
            expect(grid[0].every(c => c === '#')).toBe(true);
            expect(grid[grid.length - 1].every(c => c === '#')).toBe(true);
            for (const row of grid) {
                expect(row[0]).toBe('#');
                expect(row[row.length - 1]).toBe('#');
            }
        }
    });
});

describe('el generador con formas', () => {
    const make = (shape, seed = 11) => generateBoard({
        shape, size: 'medium', random: rolling(seed), partySize: 2, bestiary: ['Lobo', 'Rata'],
    });

    test('sabe hacer las cuatro', () => {
        for (const shape of SHAPES) {
            const board = make(shape);
            expect(board.map).toHaveLength(board.gridHeight);
            expect(board.map[0]).toHaveLength(board.gridWidth);
        }
    });

    test('y salen distintas entre sí, no el mismo sitio con otro nombre', () => {
        const maps = SHAPES.map(shape => make(shape).map.join('\\n'));
        expect(new Set(maps).size).toBe(SHAPES.length);
    });

    test('en todas se llega a todo', () => {
        for (const shape of SHAPES) {
            const grid = gridFrom(make(shape).map);
            expect(floodRegions(grid)).toHaveLength(1);
        }
    });

    test('en todas hay sitio para el grupo y para los bichos', () => {
        for (const shape of SHAPES) {
            const board = make(shape);
            expect(board.partyStart.length).toBeGreaterThan(0);
            expect(board.enemies.length).toBeGreaterThan(0);
        }
    });

    // Un bicho encima de una columna no se puede dibujar.
    test('y nadie empieza encima de un muro ni de una columna', () => {
        for (const shape of SHAPES) {
            const board = make(shape);
            const grid = gridFrom(board.map);
            for (const cell of [...board.partyStart, ...board.enemies]) {
                expect(grid[cell.y][cell.x]).toBe('.');
            }
        }
    });

    // Una cueva no tiene puertas, y fingirlas sería dibujar una puerta en la roca.
    test('una cueva no tiene puertas', () => {
        expect(make('cave').doors).toEqual([]);
    });

    // Un pasillo excavado a lo largo de una pared salía como un pasillo de puertas.
    test('y las salas no se unen con un pasillo de puertas', () => {
        const board = make('rooms');
        expect(board.doors.length).toBeLessThan(board.rooms.length * 2);
    });

    test('la misma semilla da el mismo sitio, sea cual sea la forma', () => {
        for (const shape of SHAPES) {
            expect(make(shape, 42).map).toEqual(make(shape, 42).map);
        }
    });
});
