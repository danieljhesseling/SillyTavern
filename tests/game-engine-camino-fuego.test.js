/**
 * Tanda 8: el camino rodea el fuego a la vista, como una trampa ya vista, salvo que no haya otro
 * camino (`pathfinding.js`, `hotCells` de `withOverlay`).
 */

import { describe, test, expect } from '@jest/globals';
import { createEmptyTerrain, setCell, withOverlay } from '../public/scripts/game-engine/board/terrain.js';
import {
    findPath, getPathCost, getReachableCells, fireCellsOf,
} from '../public/scripts/game-engine/board/pathfinding.js';

/** @param {string[]} rows @returns {any} */
function terrainFromMap(rows) {
    let terrain = createEmptyTerrain();
    rows.forEach((row, y) => {
        [...row].forEach((char, x) => {
            if (char === '#') terrain = setCell(terrain, x, y, 'wall');
        });
    });
    return terrain;
}

// Un pasillo (fila 1) con fuego en medio, y un rodeo por abajo: 6 casillas por el fuego, 10 por
// el rodeo.
const WITH_DETOUR = [
    '#######',
    '.......',
    '#.###.#',
    '#.....#',
    '#######',
];
// El mismo pasillo sin rodeo: por el fuego o nada.
const NO_DETOUR = [
    '#######',
    '.......',
    '#######',
    '#######',
    '#######',
];
const FIRE = ['3,1'];

/** @param {Array<{x: number, y: number}>|null} path @returns {string[]} */
const keys = (path) => (path ?? []).map(c => `${c.x},${c.y}`);

describe('el camino y el fuego a la vista', () => {
    test('con otro camino, lo rodea aunque sea más largo', () => {
        const terrain = withOverlay(terrainFromMap(WITH_DETOUR), { hotCells: FIRE });
        const path = findPath(terrain, 0, 1, 6, 1, 7, 5);
        expect(keys(path)).not.toContain('3,1');
        expect(getPathCost(terrain, path ?? [])).toBe(10);
    });

    test('sin fuego, o pidiendo cruzarlo, va por lo más corto', () => {
        const plain = terrainFromMap(WITH_DETOUR);
        expect(getPathCost(plain, findPath(plain, 0, 1, 6, 1, 7, 5) ?? [])).toBe(6);
        const hot = withOverlay(terrainFromMap(WITH_DETOUR), { hotCells: FIRE });
        const through = findPath(hot, 0, 1, 6, 1, 7, 5, { throughFire: true });
        expect(keys(through)).toContain('3,1');
        expect(getPathCost(hot, through ?? [])).toBe(6);
    });

    test('sin otro camino, lo cruza', () => {
        const terrain = withOverlay(terrainFromMap(NO_DETOUR), { hotCells: FIRE });
        const path = findPath(terrain, 0, 1, 6, 1, 7, 5);
        expect(keys(path)).toContain('3,1');
        expect(getPathCost(terrain, path ?? [])).toBe(6);
    });

    test('la casilla que arde se puede elegir como destino', () => {
        const terrain = withOverlay(terrainFromMap(WITH_DETOUR), { hotCells: FIRE });
        const path = findPath(terrain, 0, 1, 3, 1, 7, 5);
        expect(keys(path).at(-1)).toBe('3,1');
        expect(getPathCost(terrain, path ?? [])).toBe(3);
    });

    test('quien ya está en el fuego sale de él', () => {
        const terrain = withOverlay(terrainFromMap(WITH_DETOUR), { hotCells: FIRE });
        const path = findPath(terrain, 3, 1, 6, 1, 7, 5);
        expect(keys(path)).toEqual(['3,1', '4,1', '5,1', '6,1']);
    });

    test('lo que se enciende al mover es lo que luego se anda', () => {
        const at = (/** @type {any[]} */ cells, /** @type {string} */ key) => cells.find(c => `${c.gridX},${c.gridY}` === key);
        // Seis casillas de movimiento: por el pasillo se llegaría al final, pero hay rodeo y no cabe.
        const hot = withOverlay(terrainFromMap(WITH_DETOUR), { hotCells: FIRE });
        const withFire = getReachableCells(hot, 0, 1, 30, 7, 5);
        expect(at(withFire, '6,1')).toBeUndefined();
        expect(at(withFire, '4,1')).toBeUndefined();
        expect(at(withFire, '3,1')?.cost).toBe(3);
        expect(at(withFire, '2,1')?.cost).toBe(2);
        // Sin fuego, sí.
        expect(at(getReachableCells(terrainFromMap(WITH_DETOUR), 0, 1, 30, 7, 5), '6,1')?.cost).toBe(6);
        // Sin rodeo, por el fuego.
        const forced = getReachableCells(withOverlay(terrainFromMap(NO_DETOUR), { hotCells: FIRE }), 0, 1, 30, 7, 5);
        expect(at(forced, '6,1')?.cost).toBe(6);
    });

    test('el fuego a la vista: lo que arde y no se ha apagado, y las zonas de fuego', () => {
        const cells = fireCellsOf({
            hazards: [
                { kind: 'fuego', x: 1, y: 1, armed: true, seen: true },
                { kind: 'fuego', x: 2, y: 1, armed: false, seen: true },
                { kind: 'fuego', x: 3, y: 1, seen: false },
                { kind: 'trampa', x: 4, y: 1, armed: true, seen: true },
                { kind: 'fuego', x: 5, y: 1 },
            ],
            zones: [
                { kind: 'fuego', cells: [{ x: 7, y: 7 }, { x: 8, y: 7 }] },
                { kind: 'niebla', cells: [{ x: 9, y: 9 }] },
            ],
        });
        expect([...cells].sort()).toEqual(['1,1', '5,1', '7,7', '8,7']);
        expect(fireCellsOf().size).toBe(0);
    });

    test('el fuego va encima del terreno, sin guardarse con él', () => {
        const terrain = withOverlay(createEmptyTerrain(), { hotCells: ['1,1'] });
        expect(/** @type {any} */ (terrain).hotCells.has('1,1')).toBe(true);
        expect(JSON.stringify(terrain)).not.toContain('hotCells');
    });
});
