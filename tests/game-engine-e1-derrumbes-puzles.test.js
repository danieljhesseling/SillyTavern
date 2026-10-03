/**
 * E1.4 y E1.5 de wiki/ROADMAP_ENTRETENIDO.md: lo que se derrumba y los mecanismos del tablero.
 */
import { describe, test, expect } from '@jest/globals';
import {
    terrainFromAsciiMap, getCell, normalizeTerrain, isPassable, describeCell, setCell,
} from '../public/scripts/game-engine/board/terrain.js';
import {
    TOPPLE, mechanismAt, toppleCells, toppleTerrain, crushed, takeGem, placeGem, stepRunes,
    pairedLeversManned, pullPairedLever, cellsOfType, puzzleWarnings,
} from '../public/scripts/game-engine/board/mechanisms.js';
import { getMapLegend } from '../public/scripts/game-engine/campaign/campaign-pack-schema.js';
import { validatePack } from '../public/scripts/game-engine/campaign/campaign-pack.js';
import fs from 'node:fs';
import path from 'node:path';

const W = 10;
const H = 6;

describe('E1.4 · derribar una columna', () => {
    const map = [
        '##########',
        '#........#',
        '#..H.....#',
        '#........#',
        '#.......##',
        '##########',
    ];

    test('la columna corta el paso, cubre y se pulsa', () => {
        const terrain = terrainFromAsciiMap(map);
        expect(getCell(terrain, 3, 2).type).toBe('topple');
        expect(isPassable(terrain, 3, 2, W, H)).toBe(false);
        expect(mechanismAt(terrain, 3, 2)).toBe('topple');
        expect(describeCell(terrain, 3, 2)).toMatch(/se puede tirar/);
    });

    test('cae hacia el lado contrario a quien empuja, sobre dos casillas', () => {
        const terrain = terrainFromAsciiMap(map);
        expect(toppleCells({ terrain, from: { x: 2, y: 2 }, at: { x: 3, y: 2 }, width: W, height: H }))
            .toEqual([{ x: 4, y: 2 }, { x: 5, y: 2 }]);
        // En diagonal también.
        expect(toppleCells({ terrain, from: { x: 2, y: 1 }, at: { x: 3, y: 2 }, width: W, height: H }))
            .toEqual([{ x: 4, y: 3 }, { x: 5, y: 4 }]);
    });

    test('un muro la para', () => {
        const terrain = terrainFromAsciiMap(map);
        // Empujada hacia arriba: la casilla (3,1) y luego el muro.
        expect(toppleCells({ terrain, from: { x: 3, y: 3 }, at: { x: 3, y: 2 }, width: W, height: H }))
            .toEqual([{ x: 3, y: 1 }]);
    });

    test('deja escombros donde estaba y donde cae', () => {
        const terrain = terrainFromAsciiMap(map);
        const cells = [{ x: 4, y: 2 }, { x: 5, y: 2 }];
        const after = toppleTerrain(terrain, { x: 3, y: 2 }, cells);
        expect(getCell(after, 3, 2).type).toBe('difficult');
        expect(getCell(after, 4, 2).type).toBe('difficult');
        expect(getCell(after, 5, 2).type).toBe('difficult');
        expect(isPassable(after, 3, 2, W, H)).toBe(true);
    });

    test('debajo: salvación fallada, todo y al suelo; pasada, la mitad y de pie', () => {
        expect(crushed({ rolled: 7, saved: false })).toEqual({ damage: 7, prone: true });
        expect(crushed({ rolled: 7, saved: true })).toEqual({ damage: 3, prone: false });
        expect(TOPPLE.damage).toBe('1d10');
    });
});

describe('E1.5 · las estatuas y las gemas', () => {
    const map = [
        '##########',
        '#g..S...k#',
        '#.....S.L#',
        '#g.......#',
        '#........#',
        '##########',
    ];

    test('coger una gema deja el pedestal vacío', () => {
        const terrain = terrainFromAsciiMap(map);
        const took = takeGem(terrain, 1, 1);
        expect(took.taken).toBe(true);
        expect(getCell(took.terrain, 1, 1).type).toBe('floor');
        expect(takeGem(took.terrain, 1, 1).taken).toBe(false);
    });

    test('con la última gema se abre la puerta con llave', () => {
        let terrain = terrainFromAsciiMap(map);
        const first = placeGem(terrain, 4, 1);
        expect(first.placed).toBe(true);
        expect(first.left).toBe(1);
        expect(first.solved).toBe(false);
        expect(getCell(first.terrain, 8, 2).locked).toBe(true);
        // La misma estatua no admite otra.
        expect(placeGem(first.terrain, 4, 1).placed).toBe(false);
        const second = placeGem(first.terrain, 6, 2);
        expect(second.solved).toBe(true);
        expect(second.opened).toEqual([{ x: 8, y: 2 }]);
        expect(getCell(second.terrain, 8, 2).open).toBe(true);
        expect(describeCell(second.terrain, 6, 2)).toMatch(/ya tiene su gema/);
        terrain = normalizeTerrain(JSON.parse(JSON.stringify(second.terrain)));
        expect(getCell(terrain, 4, 1).on).toBe(true);
    });
});

describe('E1.5 · las runas en orden', () => {
    const map = [
        '##########',
        '#1......L#',
        '#........#',
        '#....2...#',
        '#3.......#',
        '##########',
    ];

    test('cada runa guarda su número', () => {
        const terrain = terrainFromAsciiMap(map);
        expect(cellsOfType(terrain, 'rune').map(r => r.order).sort()).toEqual([1, 2, 3]);
        expect(describeCell(terrain, 5, 3)).toMatch(/Runa 2/);
        expect(isPassable(terrain, 1, 1, W, H)).toBe(true);
    });

    test('en orden se encienden y, con la última, se abre', () => {
        let terrain = terrainFromAsciiMap(map);
        let walk = stepRunes(terrain, [{ x: 1, y: 2 }, { x: 1, y: 1 }]);
        expect(walk.lit).toEqual([{ x: 1, y: 1, order: 1 }]);
        expect(walk.next).toBe(2);
        terrain = walk.terrain;
        walk = stepRunes(terrain, [{ x: 5, y: 3 }]);
        expect(walk.next).toBe(3);
        walk = stepRunes(walk.terrain, [{ x: 1, y: 4 }]);
        expect(walk.solved).toBe(true);
        expect(walk.opened).toEqual([{ x: 8, y: 1 }]);
        // Resuelto, pisarlas ya no hace nada.
        const again = stepRunes(walk.terrain, [{ x: 5, y: 3 }]);
        expect(again.lit).toEqual([]);
        expect(again.wrong).toBeNull();
    });

    test('pisar una que no toca las apaga todas', () => {
        let terrain = terrainFromAsciiMap(map);
        terrain = stepRunes(terrain, [{ x: 1, y: 1 }]).terrain;
        const wrong = stepRunes(terrain, [{ x: 1, y: 4 }, { x: 5, y: 3 }]);
        expect(wrong.wrong).toEqual({ x: 1, y: 4, order: 3, expected: 2 });
        expect(wrong.next).toBe(1);
        expect(cellsOfType(wrong.terrain, 'rune').every(r => !r.on)).toBe(true);
        // El número se queda.
        expect(getCell(wrong.terrain, 1, 4).order).toBe(3);
    });

    test('volver a pisar una ya encendida no pasa nada', () => {
        const terrain = stepRunes(terrainFromAsciiMap(map), [{ x: 1, y: 1 }]).terrain;
        const walk = stepRunes(terrain, [{ x: 1, y: 1 }]);
        expect(walk.lit).toEqual([]);
        expect(walk.wrong).toBeNull();
    });
});

describe('E1.5 · las palancas emparejadas', () => {
    const map = [
        '##########',
        '#p......p#',
        '#........#',
        '#...L....#',
        '#........#',
        '##########',
    ];

    test('en combate: las dos en la misma ronda', () => {
        const terrain = terrainFromAsciiMap(map);
        const one = pullPairedLever(terrain, 1, 1, { round: 2 });
        expect(one.solved).toBe(false);
        expect(one.waiting).toBe(1);
        // La otra, una ronda después: la primera ya ha vuelto a subir.
        const late = pullPairedLever(one.terrain, 8, 1, { round: 3 });
        expect(late.solved).toBe(false);
        const both = pullPairedLever(one.terrain, 8, 1, { round: 2 });
        expect(both.solved).toBe(true);
        expect(both.opened).toEqual([{ x: 4, y: 3 }]);
        expect(pullPairedLever(both.terrain, 1, 1, { round: 4 }).already).toBe(true);
    });

    test('fuera de combate: con otro de los tuyos junto a la otra', () => {
        const terrain = terrainFromAsciiMap(map);
        const people = [{ id: 'a', x: 2, y: 1 }, { id: 'b', x: 7, y: 2 }];
        expect(pairedLeversManned({ terrain, at: { x: 1, y: 1 }, actorId: 'a', people })).toBe(true);
        expect(pairedLeversManned({ terrain, at: { x: 1, y: 1 }, actorId: 'a', people: [people[0]] })).toBe(false);
        // Quien tira no cuenta para la otra.
        expect(pairedLeversManned({ terrain, at: { x: 1, y: 1 }, actorId: 'b', people: [{ id: 'b', x: 7, y: 2 }] })).toBe(false);
        expect(pullPairedLever(terrain, 1, 1, { manned: false }).solved).toBe(false);
        expect(pullPairedLever(terrain, 1, 1, { manned: true }).solved).toBe(true);
    });

    test('el estado sobrevive a guardar', () => {
        const pulled = pullPairedLever(terrainFromAsciiMap(map), 1, 1, { round: 5 });
        const back = normalizeTerrain(JSON.parse(JSON.stringify(pulled.terrain)));
        expect(getCell(back, 1, 1).round).toBe(5);
        expect(setCell(back, 1, 1, 'lever_pair', { on: true }).cells['1,1']).toEqual({ type: 'lever_pair', on: true });
    });
});

describe('el paquete y el Gem', () => {
    test('la leyenda dice qué es cada carácter nuevo', () => {
        const legend = getMapLegend();
        expect(legend.H).toMatch(/tirar/);
        expect(legend.S).toMatch(/estatua/);
        expect(legend.g).toMatch(/gema/);
        expect(legend['1']).toMatch(/en orden/);
        expect(legend['3']).toBe('runa 3');
        expect(legend.p).toMatch(/a la vez/);
    });

    test('avisa de los mecanismos que no se pueden resolver', () => {
        expect(puzzleWarnings(['#S.S#', '#g.L#'])).toEqual([expect.stringMatching(/2 estatua\(s\).*1 gema/)]);
        expect(puzzleWarnings(['#1.3#', '#..L#'])).toEqual([expect.stringMatching(/seguidas/)]);
        expect(puzzleWarnings(['#p..#', '#..L#'])).toEqual([expect.stringMatching(/una sola palanca/)]);
        expect(puzzleWarnings(['#1.2#', '#...#'])).toEqual([expect.stringMatching(/ninguna puerta con llave/)]);
        expect(puzzleWarnings(['#1.2#', '#..L#'])).toEqual([]);
    });

    test('los ejemplos de 1387 y Strahd se validan y llevan cada idea', () => {
        const read = (/** @type {string} */ name) => JSON.parse(fs.readFileSync(path.resolve('..', 'public', 'mundos', `${name}.pack.json`), 'utf8'));
        const p1387 = read('1387');
        const strahd = read('strahd');
        for (const pack of [p1387, strahd]) {
            const result = validatePack(pack);
            expect(result.errors).toEqual([]);
            expect(result.warnings.filter((/** @type {any} */ w) => /estatua|runa|palanca|incomunicad/i.test(w.message))).toEqual([]);
        }
        const mapOf = (/** @type {any} */ pack, /** @type {string} */ name) => pack.boards.find((/** @type {any} */ b) => b.name === name).map.join('');
        expect(mapOf(p1387, 'Los túneles de la mina')).toContain('H');
        expect(mapOf(strahd, 'Comedor del Conde')).toContain('H');
        expect(mapOf(strahd, 'Patio de Argynvostholt')).toMatch(/S[\s\S]*S/);
        expect(mapOf(p1387, 'El patio de la ermita')).toMatch(/1[\s\S]*2[\s\S]*3/);
        expect(mapOf(p1387, 'El gran salón de Vane')).toMatch(/p[\s\S]*p/);
    });
});
