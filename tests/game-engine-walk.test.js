import { describe, test, expect } from '@jest/globals';
import {
    IMMOBILISING, STRIDE_MULTIPLIER, canWalk, strideOf, planWalk,
} from '../public/scripts/game-engine/board/walk.js';
import { terrainFromAsciiMap } from '../public/scripts/game-engine/board/terrain.js';

/** Dos salas separadas por un muro, con una puerta **cerrada** en medio. */
const cell = () => terrainFromAsciiMap([
    '##########',
    '#...#....#',
    '#...D....#',
    '#...#....#',
    '##########',
]);

/** Lo mismo, con la puerta ya abierta. */
const opened = () => terrainFromAsciiMap([
    '##########',
    '#...#....#',
    '#...o....#',
    '#...#....#',
    '##########',
]);

const lyra = (extra = {}) => ({
    name: 'Lyra', speed: 30, hp: 20,
    mapPosition: { gridX: 1, gridY: 1 },
    ...extra,
});

const walk = (member, to, occupied = []) => planWalk({
    member, to, terrain: cell(), gridWidth: 10, gridHeight: 5, occupied,
});

describe('quién puede andar', () => {
    test('quien está entero', () => {
        expect(canWalk(lyra()).allowed).toBe(true);
    });

    // Lo que pidio: atado te quedas donde estas y sigues pudiendo accionar lo de al lado.
    test('atado, agarrado o paralizado, no — y lo dice', () => {
        for (const condition of Object.keys(IMMOBILISING)) {
            const stuck = canWalk(lyra({ activeConditions: [condition] }));
            expect(stuck.allowed).toBe(false);
            expect(stuck.reason).toMatch(/Lyra/);
        }
        expect(canWalk(lyra({ activeConditions: ['Restrained'] })).reason).toMatch(/puede actuar, pero no moverse/);
    });

    // Quien esta en el suelo se arrastra: lento, pero es moverse.
    test('pero tumbado sí: eso es arrastrarse, no estar clavado', () => {
        expect(canWalk(lyra({ activeConditions: ['Prone'] })).allowed).toBe(true);
    });

    test('y quien está a cero no va a ninguna parte', () => {
        expect(canWalk(lyra({ hp: 0 })).allowed).toBe(false);
    });
});

describe('lo que se anda de una vez', () => {
    test('un trecho, no el mapa entero', () => {
        expect(strideOf(lyra())).toBe(30 * STRIDE_MULTIPLIER);
    });

    test('quien cojea anda menos, con el mismo tirón', () => {
        expect(strideOf(lyra({ speed: 20 }))).toBeLessThan(strideOf(lyra()));
    });

    test('y nadie anda cero', () => {
        expect(strideOf({ speed: 0 })).toBeGreaterThan(0);
    });
});

describe('ir de aquí a allí', () => {
    test('dentro de la sala, se puede', () => {
        const plan = walk(lyra(), { x: 3, y: 3 });
        expect(plan.allowed).toBe(true);
        expect(plan.path.length).toBeGreaterThan(0);
        expect(plan.costFeet).toBeGreaterThan(0);
    });

    // Sin esto las paredes eran decoracion: arrastrabas la ficha y aparecia detras.
    test('a través de un muro, no', () => {
        const plan = walk(lyra(), { x: 6, y: 1 });
        expect(plan.allowed).toBe(false);
        expect(plan.reason).toMatch(/No hay camino/);
    });

    // Una puerta cerrada es un muro hasta que alguien la abre: por eso abrirla es una
    // accion del juego y no un adorno.
    test('ni por una puerta cerrada', () => {
        expect(walk(lyra(), { x: 6, y: 2 }).allowed).toBe(false);
    });

    test('pero por una abierta, sí', () => {
        const plan = planWalk({
            member: lyra(), to: { x: 6, y: 2 }, terrain: opened(), gridWidth: 10, gridHeight: 5,
        });
        expect(plan.allowed).toBe(true);
    });

    test('quedarse donde estás siempre se puede', () => {
        const plan = walk(lyra(), { x: 1, y: 1 });
        expect(plan.allowed).toBe(true);
        expect(plan.costFeet).toBe(0);
    });

    test('atado no se va ni a la casilla de al lado', () => {
        const plan = walk(lyra({ activeConditions: ['Grappled'] }), { x: 2, y: 1 });
        expect(plan.allowed).toBe(false);
        expect(plan.path).toEqual([]);
    });

    test('y no se pasa por encima de quien esté en medio', () => {
        const clear = planWalk({
            member: lyra(), to: { x: 6, y: 2 }, terrain: opened(), gridWidth: 10, gridHeight: 5,
        });
        expect(clear.allowed).toBe(true);

        const blocked = planWalk({
            member: lyra(), to: { x: 6, y: 2 }, terrain: opened(), gridWidth: 10, gridHeight: 5,
            occupied: [{ x: 4, y: 2 }],
        });
        expect(blocked.allowed).toBe(false);
    });

    test('demasiado lejos para un tirón se dice con números', () => {
        const slow = lyra({ speed: 5 });
        const plan = planWalk({
            member: slow, to: { x: 8, y: 3 }, terrain: opened(), gridWidth: 10, gridHeight: 5,
        });
        expect(plan.allowed).toBe(false);
        expect(plan.reason).toMatch(/demasiado lejos/);
        expect(plan.reason).toMatch(/\d+ pies/);
        // La ruta se devuelve igual: sirve para ensenar hasta donde si se llega.
        expect(plan.path.length).toBeGreaterThan(0);
    });
});
