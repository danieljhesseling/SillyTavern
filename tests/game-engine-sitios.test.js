import fs from 'node:fs';
import { describe, test, expect } from '@jest/globals';
import { validateBattery, createCompendium } from '../public/scripts/game-engine/compendio/compendio.js';
import {
    SHAPES, COVER_BUDGET, solidGrid, floodRegions, coverRatio,
    rotateTemplate, mirrorTemplate, stampRoom, placeRoom,
} from '../public/scripts/game-engine/world-builder/shapes.js';
import { generateBoard } from '../public/scripts/game-engine/world-builder/dungeon-generator.js';

const sitios = JSON.parse(fs.readFileSync(
    new URL('../public/compendio/sitios.json', import.meta.url), 'utf8',
));
const of = (kind) => sitios.rows.filter(r => r.kind === kind);

/** Un azar repetible. */
const rolling = (seed) => {
    let state = seed;
    return () => ((state = (state * 9301 + 49297) % 233280) / 233280);
};

describe('la batería de sitios', () => {
    test('sitios.json pasa su propia validación', () => {
        expect(validateBattery('sitios', sitios)).toEqual([]);
    });

    test('trae tipos, salas y estados', () => {
        expect(new Set(sitios.rows.map(r => r.kind)))
            .toEqual(new Set(['tipo', 'sala', 'estado']));
    });

    // Un tipo que pida una forma que el generador no sabe hacer es un sitio que no sale.
    test('cada tipo pide una forma que el generador sabe hacer', () => {
        for (const tipo of of('tipo')) expect(SHAPES).toContain(tipo.shape);
    });

    test('y un tipo de localidad que el editor sabe dibujar', () => {
        const known = ['city', 'village', 'outpost', 'ruins', 'dungeon', 'camp', 'sanctuary', 'wilderness'];
        for (const tipo of of('tipo')) expect(known).toContain(tipo.locationType);
    });

    test('cada sala es un mapa rectangular, con la leyenda de siempre', () => {
        for (const sala of of('sala')) {
            expect(sala.rows.length).toBeGreaterThan(2);
            const width = sala.rows[0].length;
            for (const row of sala.rows) expect(row.length).toBe(width);
            for (const row of sala.rows) expect(row).toMatch(/^[#.~cCDwibTkx^v=P ]+$/);
        }
    });

    // Una sala escrita a mano que no se puede pisar no es una sala.
    test('y toda sala tiene suelo por dentro', () => {
        for (const sala of of('sala')) {
            const floors = sala.rows.join('').split('').filter(c => c === '.').length;
            expect(floors).toBeGreaterThan(3);
        }
    });

    test('cada estado dice cuánta cobertura y cuánto suelo malo deja', () => {
        for (const estado of of('estado')) {
            expect(estado.cover).toBeGreaterThanOrEqual(0);
            expect(estado.cover).toBeLessThanOrEqual(0.4);
            expect(estado.rough).toBeGreaterThanOrEqual(0);
            expect(estado.rough).toBeLessThanOrEqual(0.5);
        }
    });
});

describe('girar y espejar una sala', () => {
    const room = ['abc', 'def'];

    // Cuatro giros por dos espejos son ocho salas por cada una que escribas.
    test('un cuarto de vuelta a la derecha', () => {
        expect(rotateTemplate(room, 1)).toEqual(['da', 'eb', 'fc']);
    });

    test('cuatro cuartos la dejan como estaba', () => {
        expect(rotateTemplate(room, 4)).toEqual(room);
    });

    test('y un giro negativo también vale', () => {
        expect(rotateTemplate(room, -1)).toEqual(rotateTemplate(room, 3));
    });

    test('el espejo le da la vuelta a cada fila', () => {
        expect(mirrorTemplate(room)).toEqual(['cba', 'fed']);
    });

    test('y una sala vacía no revienta', () => {
        expect(rotateTemplate([], 1)).toEqual([]);
        expect(mirrorTemplate(null)).toEqual([]);
    });
});

describe('estampar una sala', () => {
    const blank = () => solidGrid(12, 10);

    test('se pega donde se le diga', () => {
        const grid = blank();
        expect(stampRoom(grid, ['...', '...'], 2, 3)).toBe(true);
        expect(grid[3][2]).toBe('.');
        expect(grid[4][4]).toBe('.');
    });

    // Es lo que permite que una sala tenga forma de ele sin arrastrar un rectángulo.
    test('el espacio en blanco no se toca', () => {
        const grid = blank();
        grid[3][2] = 'X';
        stampRoom(grid, [' .', '..'], 2, 3);
        expect(grid[3][2]).toBe('X');
        expect(grid[3][3]).toBe('.');
    });

    // Media sala fuera sería una sala partida.
    test('media fuera no se estampa', () => {
        const grid = blank();
        expect(stampRoom(grid, ['....'], 10, 3)).toBe(false);
        expect(stampRoom(grid, ['....'], -1, 3)).toBe(false);
    });

    // El borde exterior cerrado es lo primero que comprueba el validador.
    test('y nunca toca el borde', () => {
        const grid = blank();
        expect(stampRoom(grid, ['..'], 0, 0)).toBe(false);
        expect(grid[0].every(c => c === '#')).toBe(true);
    });

    test('una sala vacía no hace nada', () => {
        expect(stampRoom(blank(), [], 2, 2)).toBe(false);
    });
});

describe('colocar una sala donde quepa', () => {
    test('cabe y dice dónde', () => {
        const grid = solidGrid(20, 14);
        const placed = placeRoom(grid, ['###', '#.#', '###'], rolling(7));
        expect(placed).not.toBe(null);
        expect(grid[placed.y + 1][placed.x + 1]).toBe('.');
    });

    test('una que no cabe en ninguna parte se dice, no se fuerza', () => {
        const grid = solidGrid(6, 6);
        const huge = Array.from({ length: 9 }, () => '.........');
        expect(placeRoom(grid, huge, rolling(3))).toBe(null);
    });

    test('la misma semilla la pone en el mismo sitio', () => {
        const a = solidGrid(20, 14);
        const b = solidGrid(20, 14);
        expect(placeRoom(a, ['##', '#.'], rolling(11)))
            .toEqual(placeRoom(b, ['##', '#.'], rolling(11)));
    });
});

describe('las salas escritas, dentro de un mapa', () => {
    // Un algoritmo hace sitios variados y ninguno memorable; una sala escrita a mano es
    // memorable y siempre la misma. Estampar una dentro del otro da las dos cosas.
    test('todas caben en un tablero mediano y dejan suelo que pisar', () => {
        for (const sala of of('sala')) {
            const grid = solidGrid(26, 18);
            const placed = placeRoom(grid, sala.rows, rolling(13));
            expect(placed).not.toBe(null);
            expect(floodRegions(grid).length).toBeGreaterThan(0);
        }
    });

    test('y ninguna se pasa de cobertura ella sola', () => {
        for (const sala of of('sala')) {
            const grid = solidGrid(26, 18);
            placeRoom(grid, sala.rows, rolling(17));
            expect(coverRatio(grid)).toBeLessThanOrEqual(COVER_BUDGET.max * 3);
        }
    });
});

describe('la batería, cargada como compendio', () => {
    const lib = () => createCompendium({ sitios: sitios.rows });

    test('se filtra por bioma, como todo lo demás', () => {
        const pantano = lib().find('sitios', { kind: 'tipo', biome: 'pantano' });
        expect(pantano.length).toBeGreaterThan(0);
        for (const tipo of pantano) expect(tipo.when.biome).toContain('pantano');
    });

    test('y un bioma sin tipos escritos no devuelve basura', () => {
        expect(lib().find('sitios', { kind: 'tipo', biome: 'luna' })).toEqual([]);
    });
});

describe('el generador con salas escritas y estado', () => {
    const salas = of('sala').map(r => r.rows);
    const estados = of('estado');

    // Estampar despues de colocar dejaba al grupo dentro de un muro.
    test('nadie acaba enterrado, sea cual sea la forma y el estado', () => {
        let checked = 0;
        for (const shape of SHAPES) {
            for (const estado of estados) {
                const board = generateBoard({
                    shape, size: 'medium', random: rolling(7), partySize: 2,
                    bestiary: ['Lobo'], templates: salas, state: estado,
                });
                const grid = board.map.map(row => [...row]);
                for (const cell of [...board.partyStart, ...board.enemies]) {
                    expect(grid[cell.y][cell.x]).toBe('.');
                    checked++;
                }
            }
        }
        expect(checked).toBeGreaterThan(50);
    });

    // Una cripta saqueada y una inundada no se juegan igual.
    test('el estado se nota: la inundada trae suelo malo y la saqueada no', () => {
        const rough = (state) => {
            const board = generateBoard({
                shape: 'rooms', size: 'medium', random: rolling(5),
                partySize: 2, bestiary: ['Lobo'], templates: salas, state,
            });
            return board.map.join('').split('').filter(c => c === '~').length;
        };

        const inundada = estados.find(e => e.id === 'estado-inundada');
        const habitada = estados.find(e => e.id === 'estado-habitada');
        expect(rough(inundada)).toBeGreaterThan(rough(habitada));
    });

    test('y en todas se sigue llegando a todo', () => {
        for (const shape of SHAPES) {
            const board = generateBoard({
                shape, size: 'medium', random: rolling(11), partySize: 2,
                bestiary: ['Lobo'], templates: salas, state: estados[0],
            });
            expect(floodRegions(board.map.map(row => [...row]))).toHaveLength(1);
        }
    });
});
