/**
 * D-J45 afinado (tanda 8): tras ganar, si al tablero ya no le queda nada (ni enemigos, ni nada por
 * explorar, ni nada que coger), «Continuar» sale al sitio en vez de volver al tablero vacío.
 */

import { describe, test, expect } from '@jest/globals';
import { boardLeftovers } from '../public/scripts/game-engine/board/leftovers.js';
import { afterFightStep } from '../public/scripts/game-engine/combat/after-fight.js';
import { createEmptyTerrain, setCell } from '../public/scripts/game-engine/board/terrain.js';

/** @param {string[]} rows @returns {any} */
function terrainFromMap(rows) {
    let terrain = createEmptyTerrain();
    rows.forEach((row, y) => {
        [...row].forEach((char, x) => {
            if (char === '#') terrain = setCell(terrain, x, y, 'wall');
            if (char === 'D') terrain = setCell(terrain, x, y, 'door', { open: false });
            if (char === 'C') terrain = setCell(terrain, x, y, 'chest');
        });
    });
    return terrain;
}

/** Todas las casillas de un rectángulo, vistas. @returns {Record<string, true>} */
function seenAll(/** @type {number} */ cols, /** @type {number} */ rows, skip = /** @type {string[]} */ ([])) {
    /** @type {Record<string, true>} */
    const explored = {};
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (!skip.includes(`${x},${y}`)) explored[`${x},${y}`] = true;
    return explored;
}

describe('lo que le queda a un tablero', () => {
    const base = { gridWidth: 5, gridHeight: 3, party: [{ x: 0, y: 1 }] };

    test('ganado, sin salas, sin cofres ni pistas y sin niebla: no queda nada', () => {
        const left = boardLeftovers({ ...base, board: { name: 'Bodega', enemyPlacements: [{ name: 'Rata', x: 3, y: 1 }] }, won: true });
        expect(left).toEqual({ enemies: 0, rooms: 0, unseen: 0, chests: 0, clues: 0, done: true });
    });

    test('los enemigos escritos, mientras su pelea no se ha ganado', () => {
        const left = boardLeftovers({ ...base, board: { enemyPlacements: [{ name: 'Rata', x: 3, y: 1 }, { name: 'Rata', x: 4, y: 1 }] } });
        expect(left.enemies).toBe(2);
        expect(left.done).toBe(false);
    });

    test('una sala sin abrir', () => {
        const board = { rooms: [{ id: 'a', revealed: true, cells: ['0,0'] }, { id: 'b', revealed: false, cells: ['4,2'] }] };
        expect(boardLeftovers({ ...base, board, won: true }).rooms).toBe(1);
    });

    test('un cofre sin abrir, o una pista sin encontrar', () => {
        const chest = boardLeftovers({ ...base, board: { terrain: terrainFromMap(['.....', '...C.', '.....']) }, won: true });
        expect(chest.chests).toBe(1);
        expect(chest.done).toBe(false);
        const clue = boardLeftovers({ ...base, board: { hazards: [{ kind: 'pista', x: 2, y: 2, armed: true }, { kind: 'pista', x: 1, y: 1, armed: false }] }, won: true });
        expect(clue.clues).toBe(1);
        // Una trampa sin ver no es algo que hacer.
        expect(boardLeftovers({ ...base, board: { hazards: [{ kind: 'trampa', x: 2, y: 2, armed: true }] }, won: true }).done).toBe(true);
    });

    test('con niebla, lo que se puede pisar (abriendo puertas) y nadie ha visto', () => {
        // Tras la puerta de (2,1) queda la parte derecha, sin ver; la roca de abajo no cuenta.
        const terrain = terrainFromMap(['..#..', '..D..', '#####']);
        const behind = ['3,0', '4,0', '3,1', '4,1'];
        const rock = ['0,2', '1,2', '2,2', '3,2', '4,2'];
        const fogged = boardLeftovers({
            ...base, won: true, fogOn: true, board: { terrain, fog: { explored: seenAll(5, 3, [...behind, ...rock]) } },
        });
        expect(fogged.unseen).toBe(4);
        expect(fogged.done).toBe(false);
        const seen = boardLeftovers({
            ...base, won: true, fogOn: true, board: { terrain, fog: { explored: seenAll(5, 3, rock) } },
        });
        expect(seen.unseen).toBe(0);
        expect(seen.done).toBe(true);
        // Una bolsa cerrada entre muros, a la que no se llega, no cuenta.
        const sealed = terrainFromMap(['..#..', '..#..', '#####']);
        expect(boardLeftovers({ ...base, won: true, fogOn: true, board: { terrain: sealed, fog: { explored: seenAll(5, 3, [...behind, ...rock]) } } }).unseen).toBe(0);
        // Sin niebla, todo se ve.
        expect(boardLeftovers({ ...base, won: true, board: { terrain, fog: { explored: {} } } }).unseen).toBe(0);
    });
});

describe('«Continuar» con el tablero vacío', () => {
    test('con algo en el tablero, vuelve a él; sin nada, al sitio, y dice por qué', () => {
        const here = { place: 'La Bodega', board: 'Sótano' };
        expect(afterFightStep({ here })).toEqual({ kind: 'board', title: 'Volver al tablero: Sótano' });
        expect(afterFightStep({ here, boardDone: true })).toEqual({ kind: 'place', title: 'En Sótano ya no queda nada: seguir en La Bodega' });
    });

    test('una escena o lo siguiente de la campaña mandan antes', () => {
        const here = { place: 'La Bodega', board: 'Sótano' };
        expect(afterFightStep({ here, boardDone: true, story: true }).kind).toBe('story');
        expect(afterFightStep({ here, boardDone: true, inCampaign: true, next: { title: 'Hablar con Ismark', place: 'Aldea de Barovia' } }).kind).toBe('next');
    });
});
