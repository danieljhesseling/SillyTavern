/**
 * Tanda 10, «entrar en la pelea» (wiki/maquetas/ENCARGO_COMBATE_VTT.md): la pelea empieza sola,
 * con la decisión si tiene otras salidas, y el grupo se coloca antes de la iniciativa.
 */
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { terrainFromAsciiMap, createEmptyTerrain, isPassable } from '../public/scripts/game-engine/board/terrain.js';
import {
    fightOpening, startCells, defaultPlacement, placeMember, placementHint,
} from '../public/scripts/game-engine/combat/placement.js';
import { avoidFor, avoidIntro, withArticle } from '../public/scripts/game-engine/combat/avoid-fight.js';

const key = (c) => `${c.x},${c.y}`;

describe('cómo empieza la pelea', () => {
    test('con otras salidas escritas, primero la decisión; después, colocarse', () => {
        expect(fightOpening({ ways: 3 })).toEqual({ decide: true, place: true });
    });

    test('sin otras salidas, directo a colocarse', () => {
        expect(fightOpening({ ways: 0 })).toEqual({ decide: false, place: true });
    });

    test('una emboscada (la sala que despierta al abrir la puerta) no pregunta: a colocarse', () => {
        expect(fightOpening({ ways: 4, ambush: true })).toEqual({ decide: false, place: true });
    });

    test('si os pillan huyendo o escondidos, empiezan ellos: ni decisión ni colocarse', () => {
        expect(fightOpening({ ways: 4, caught: true })).toEqual({ decide: false, place: false });
    });

    test('en el muelle del prólogo, la pelea escrita tiene otras salidas: sale la decisión', () => {
        const pack = JSON.parse(readFileSync(new URL('../public/mundos/gremio.pack.json', import.meta.url), 'utf8'));
        const board = pack.boards.find(b => b.id === 'muelle_puerto_alba');
        const ways = avoidFor(board, [{ name: 'Ratero del muelle', cr: 0.125 }]).length;
        expect(ways).toBeGreaterThan(0);
        expect(fightOpening({ ways }).decide).toBe(true);
        expect(avoidIntro([{ name: 'Ratero del muelle', cr: 0.125 }])).toBe('El ratero del muelle os cierra el paso.');
    });
});

describe('las casillas de salida', () => {
    const room = terrainFromAsciiMap([
        '##########',
        '#........#',
        '#........#',
        '#..WWW...#',
        '#........#',
        '#....x...#',
        '##########',
    ]);

    test('al entrar, las escritas y las de alrededor, sin muros ni agua honda ni salidas', () => {
        const cells = startCells({ terrain: room, gridWidth: 10, gridHeight: 7, starts: [{ x: 4, y: 4 }, { x: 5, y: 4 }], party: [{ x: 4, y: 4 }] });
        const keys = new Set(cells.map(key));
        expect(keys.has('4,4')).toBe(true);
        expect(keys.has('6,5')).toBe(true);
        expect(keys.has('4,3')).toBe(false); // el agua honda
        expect(keys.has('5,5')).toBe(false); // la salida: sería irse antes de empezar
        expect(cells.every(c => isPassable(room, c.x, c.y, 10, 7))).toBe(true);
    });

    test('ni la casilla de un enemigo ni la de al lado: pegarse antes de la iniciativa sería un golpe gratis', () => {
        const cells = startCells({ terrain: createEmptyTerrain(), gridWidth: 10, gridHeight: 10, starts: [{ x: 5, y: 5 }], party: [], enemies: [{ x: 6, y: 4 }] });
        const keys = new Set(cells.map(key));
        expect(keys.has('5,5')).toBe(false);
        expect(keys.has('6,5')).toBe(false);
        expect(keys.has('4,6')).toBe(true);
    });

    test('pero donde ya está alguien del grupo vale siempre', () => {
        const cells = startCells({ terrain: createEmptyTerrain(), gridWidth: 10, gridHeight: 10, starts: [], party: [{ x: 5, y: 5 }], enemies: [{ x: 6, y: 5 }], ambush: true });
        expect(cells.map(key)).toContain('5,5');
    });

    test('en una emboscada, alrededor de donde está el grupo, no en las de salida del tablero', () => {
        const cells = startCells({ terrain: createEmptyTerrain(), gridWidth: 12, gridHeight: 12, starts: [{ x: 1, y: 1 }], party: [{ x: 8, y: 8 }], ambush: true });
        const keys = new Set(cells.map(key));
        expect(keys.has('8,8')).toBe(true);
        expect(keys.has('9,9')).toBe(true);
        expect(keys.has('1,1')).toBe(false);
        expect(cells.length).toBe(9);
    });

    test('las trampas ya vistas tampoco', () => {
        const cells = startCells({ terrain: createEmptyTerrain(), gridWidth: 10, gridHeight: 10, starts: [{ x: 5, y: 5 }], party: [{ x: 5, y: 5 }], blocked: [{ x: 5, y: 6 }] });
        expect(cells.map(key)).not.toContain('5,6');
    });

    test('en el muelle del prólogo: ninguna en el mar, y sitio de sobra para cuatro', () => {
        const pack = JSON.parse(readFileSync(new URL('../public/mundos/gremio.pack.json', import.meta.url), 'utf8'));
        const board = pack.boards.find(b => b.id === 'muelle_puerto_alba');
        const terrain = terrainFromAsciiMap(board.map);
        const cells = startCells({ terrain, gridWidth: board.map[0].length, gridHeight: board.map.length, starts: board.partyStart, party: [board.partyStart[0]], enemies: board.enemies });
        expect(cells.length).toBeGreaterThanOrEqual(8);
        expect(cells.every(c => terrain.cells[`${c.x},${c.y}`]?.type !== 'deep_water')).toBe(true);
    });
});

describe('colocar', () => {
    const cells = [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }];
    const members = [
        { id: 'a', name: 'Tessa', x: 2, y: 1 },
        { id: 'b', name: 'Bran', x: 9, y: 9 },
        { id: 'c', name: 'Gerd', x: 2, y: 1, locked: true },
    ];

    test('por defecto, cada uno donde está si vale; si no, en la libre más cercana; nadie repite casilla', () => {
        const placed = defaultPlacement({ members, cells });
        expect(placed.a).toEqual({ x: 2, y: 1 });
        expect(Object.keys(placed)).toHaveLength(3);
        const used = Object.values(placed).map(key);
        expect(new Set(used).size).toBe(3);
        expect(used.every(k => cells.some(c => key(c) === k))).toBe(true);
    });

    test('poner a alguien en una casilla libre de salida', () => {
        const placed = defaultPlacement({ members, cells });
        const free = cells.find(c => !Object.values(placed).some(p => key(p) === key(c)));
        const result = placeMember({ placement: placed, id: 'a', to: free, cells, members });
        expect(result.ok).toBe(true);
        expect(result.placement.a).toEqual(free);
    });

    test('en la de otro de los tuyos, os cambiáis el sitio', () => {
        const placed = { a: { x: 1, y: 1 }, b: { x: 2, y: 1 } };
        const result = placeMember({ placement: placed, id: 'a', to: { x: 2, y: 1 }, cells, members });
        expect(result.ok).toBe(true);
        expect(result.swapped).toBe('b');
        expect(result.placement).toEqual({ a: { x: 2, y: 1 }, b: { x: 1, y: 1 } });
    });

    test('fuera de las de salida, no; y a quien lleva el juego tampoco se le mueve', () => {
        const placed = { a: { x: 1, y: 1 }, c: { x: 2, y: 1 } };
        expect(placeMember({ placement: placed, id: 'a', to: { x: 7, y: 7 }, cells, members }).reason).toMatch(/casilla encendida/);
        expect(placeMember({ placement: placed, id: 'c', to: { x: 3, y: 1 }, cells, members }).reason).toBe('A Gerd lo coloca el juego.');
        expect(placeMember({ placement: placed, id: 'a', to: { x: 2, y: 1 }, cells, members }).ok).toBe(false);
    });

    test('lo que dice la barra, en llano', () => {
        expect(placementHint({})).toMatch(/^Colocad al grupo antes de la iniciativa\. Pulsa a uno de los tuyos y luego una casilla azul/);
        expect(placementHint({ touch: true })).toMatch(/Toca a uno de los tuyos/);
        expect(placementHint({ ambush: true, selected: 'Tessa' })).toBe('¡Emboscada! Colocaos donde estáis. Tessa: elige su casilla.');
    });
});

describe('el artículo de quien os cierra el paso', () => {
    test('lo que alguien es lleva artículo; un nombre propio, no', () => {
        expect(withArticle('Ratero del muelle')).toBe('El ratero del muelle');
        expect(withArticle('Bruja del pantano')).toBe('La bruja del pantano');
        expect(withArticle('Bandido contrabandista')).toBe('El bandido contrabandista');
        expect(withArticle('Torres')).toBe('Torres');
        expect(withArticle('Alguacil Torres')).toBe('Alguacil Torres');
        expect(withArticle('Baba Lysaga')).toBe('Baba Lysaga');
    });
});
