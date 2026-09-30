import { describe, test, expect } from '@jest/globals';
import {
    SEARCH_RADIUS, withIds, knownTrapCells, canSearchAround, searchAround, disarmable, tryDisarm, walkPath,
} from '../public/scripts/game-engine/board/trap-actions.js';

/** Un pasillo con dos trampas y una pista: una losa en (5,2) y un dardo en (9,2). */
const board = () => ({
    hazards: [
        { id: 'losa', name: 'Losa hundida', trigger: 'enter', x: 5, y: 2, tell: 'Una losa más baja.', effect: 'damage', damageDice: '2d6', spotDC: 14, disarmDC: 12 },
        { id: 'dardo', name: 'Dardo en la pared', trigger: 'enter', x: 9, y: 2, tell: 'Agujeros en la pared.', effect: 'damage', damageDice: '1d4', spotDC: 18, disarmDC: 15 },
        { id: 'pista-1', name: 'Algo que no encaja', kind: 'pista', trigger: 'enter', effect: 'none', x: 3, y: 2, seen: true, note: 'caso:1' },
    ],
});
const line = (/** @type {number} */ from, /** @type {number} */ to) => Array.from({ length: to - from + 1 }, (_, i) => ({ x: from + i, y: 2 }));

describe('J12.3: buscar trampas alrededor', () => {
    test('una buena tirada encuentra la que está a dos casillas, y no la de más lejos', () => {
        const found = searchAround({ board: board(), center: { x: 3, y: 2 }, roll: 20, cols: 20, rows: 6 });
        expect(found.fresh).toBe(true);
        expect(found.found.map(h => h.id)).toEqual(['losa']);
        expect(found.hazards.find(h => h.id === 'losa').seen).toBe(true);
        expect(found.hazards.find(h => h.id === 'dardo').seen).toBe(false);
        expect(found.searched.length).toBe((2 * SEARCH_RADIUS + 1) ** 2);
    });

    test('una mala no encuentra nada, pero lo buscado se queda buscado', () => {
        const b = board();
        const first = searchAround({ board: b, center: { x: 4, y: 2 }, roll: 5, cols: 20, rows: 6 });
        expect(first.found).toEqual([]);
        expect(first.missed.map(h => h.id)).toEqual(['losa']);
        const again = searchAround({ board: { ...b, searchedCells: first.searched }, center: { x: 4, y: 2 }, roll: 20, cols: 20, rows: 6 });
        expect(again.fresh).toBe(false);
        expect(canSearchAround({ board: { searchedCells: first.searched }, center: { x: 4, y: 2 }, cols: 20, rows: 6 })).toBe(false);
        expect(canSearchAround({ board: { searchedCells: first.searched }, center: { x: 8, y: 2 }, cols: 20, rows: 6 })).toBe(true);
    });

    test('las de un paquete sin id reciben uno', () => {
        const ids = withIds([{ name: 'x', x: 2, y: 3 }, { id: 'y', x: 1, y: 1 }]).map(h => h.id);
        expect(ids).toEqual(['trampa-0-2-3', 'y']);
    });
});

describe('J12.3: desarmar lo visto', () => {
    const seen = () => ({ hazards: board().hazards.map(h => (h.id === 'losa' ? { ...h, seen: true } : h)) });

    test('solo lo visto, armado y al lado de alguien', () => {
        expect(disarmable(board(), [{ x: 4, y: 2 }])).toEqual([]);
        const near = disarmable(seen(), [{ x: 0, y: 0 }, { x: 4, y: 3 }]);
        expect(near.map(d => [d.hazard.id, d.by])).toEqual([['losa', 1]]);
        expect(knownTrapCells(seen())).toEqual(new Set(['5,2']));
    });

    test('un fuego no es una trampa: no se desarma ni corta el camino, y quema si se acaba encima', () => {
        const fire = { hazards: [{ id: 'fuego-1', name: 'Aceite ardiendo', kind: 'fuego', trigger: 'enter', x: 4, y: 2, seen: true, effect: 'damage', damageDice: '1d4' }] };
        expect(knownTrapCells(fire).size).toBe(0);
        expect(disarmable(fire, [{ x: 3, y: 2 }])).toEqual([]);
        expect(walkPath({ board: fire, path: line(0, 6), passive: 10 })).toMatchObject({ stopAt: 6, fired: [], blockedBy: null });
        expect(walkPath({ board: fire, path: line(0, 4), passive: 10 }).fired.map(h => h.id)).toEqual(['fuego-1']);
    });

    test('con la tirada, queda desarmada y deja de estorbar al camino', () => {
        const done = tryDisarm(seen(), 'losa', 13);
        expect(done.ok).toBe(true);
        expect(done.hazards.find(h => h.id === 'losa').armed).toBe(false);
        expect(knownTrapCells({ hazards: done.hazards }).size).toBe(0);
    });

    test('fallar por poco no pasa nada; por cinco o más, salta', () => {
        expect(tryDisarm(seen(), 'losa', 10)).toMatchObject({ ok: false, sprung: false });
        const sprung = tryDisarm(seen(), 'losa', 7);
        expect(sprung.sprung).toBe(true);
        expect(sprung.hazard.id).toBe('losa');
    });
});

describe('J12.3: andar por un camino con trampas', () => {
    test('la que no se ha visto salta al pisarla, y quien anda se queda en ella', () => {
        const walk = walkPath({ board: board(), path: line(0, 8), passive: 10 });
        expect(walk.stopAt).toBe(5);
        expect(walk.fired.map(h => h.id)).toEqual(['losa']);
        expect(walk.clues.map(h => h.id)).toEqual(['pista-1']);
        expect(walk.hazards.find(h => h.id === 'losa').seen).toBe(true);
    });

    test('con buen ojo se ve al lado y se para antes de pisarla', () => {
        const walk = walkPath({ board: board(), path: line(0, 8), passive: 15 });
        expect(walk.fired).toEqual([]);
        expect(walk.spotted.map(h => h.id)).toEqual(['losa']);
        expect(walk.stopAt).toBe(4);
    });

    test('ante una ya vista se para en la casilla de antes', () => {
        const walk = walkPath({ board: { hazards: board().hazards.map(h => ({ ...h, seen: true })) }, path: line(0, 8), passive: 0 });
        expect(walk.stopAt).toBe(4);
        expect(walk.blockedBy.id).toBe('losa');
    });

    test('un camino sin trampas se anda entero', () => {
        const walk = walkPath({ board: board(), path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], passive: 10 });
        expect(walk.stopAt).toBe(2);
        expect(walk.fired).toEqual([]);
    });
});
