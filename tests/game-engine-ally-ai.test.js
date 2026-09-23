import { describe, test, expect } from '@jest/globals';
import { createEmptyTerrain } from '../public/scripts/game-engine/board/terrain.js';
import {
    planAllyTurn, stanceOf, STANCES, DEFAULT_STANCE,
} from '../public/scripts/game-engine/combat/ally-ai.js';

const terrain = createEmptyTerrain();
const W = 12;
const H = 12;

/** @param {object} overrides */
const ally = (overrides = {}) => ({
    id: 'bruna', name: 'Bruna', gridX: 5, gridY: 5, currentHp: 20, maxHp: 20,
    speedFeet: 30, attackRangeFeet: 5, ...overrides,
});

/** @param {object} overrides */
const goblin = (overrides = {}) => ({
    id: 'g1', gridX: 6, gridY: 5, currentHp: 7, maxHp: 7, reachFeet: 5, ...overrides,
});

/** @param {{x: number, y: number}} a @param {{gridX: number, gridY: number}} b */
const feet = (a, b) => Math.max(Math.abs(a.x - b.gridX), Math.abs(a.y - b.gridY)) * 5;

describe('stanceOf', () => {
    test('lo elegido manda', () => {
        expect(stanceOf({ stance: 'atras' })).toBe('atras');
    });

    test('sin elegir nada, a tu lado: el «agresivo» de antes no lo había decidido nadie', () => {
        expect(stanceOf({})).toBe(DEFAULT_STANCE);
        expect(DEFAULT_STANCE).toBe('cerca');
    });

    test('un perfil escrito en la ficha se respeta', () => {
        expect(stanceOf({ reasons: { profile: 'skirmisher' } })).toBe('atras');
        expect(stanceOf({ reasons: { profile: 'aggressive' } })).toBe('carga');
        expect(stanceOf({ reasons: { profile: 'guardian' } })).toBe('cerca');
    });

    test('una postura que no existe no se cuela', () => {
        expect(stanceOf({ stance: 'bailar' })).toBe('cerca');
    });

    test('las tres tienen nombre, icono y explicación', () => {
        for (const stance of Object.values(STANCES)) {
            expect(stance.label).toBeTruthy();
            expect(stance.icon).toMatch(/^fa-/);
            expect(stance.description.length).toBeGreaterThan(10);
        }
    });
});

describe('planAllyTurn — a mi lado', () => {
    test('no se aleja del tuyo para ir a por alguien', () => {
        const plan = planAllyTurn({
            actor: ally({ gridX: 2, gridY: 2 }),
            leader: { gridX: 2, gridY: 3 },
            enemies: [goblin({ gridX: 9, gridY: 9 })],
            stance: 'cerca', terrain, gridWidth: W, gridHeight: H,
        });
        expect(feet(plan.destination, { gridX: 2, gridY: 3 })).toBeLessThanOrEqual(5);
        expect(plan.action).toBe('none');
    });

    test('pega a lo que llega sin irse de tu lado', () => {
        const plan = planAllyTurn({
            actor: ally({ gridX: 4, gridY: 5 }),
            leader: { gridX: 4, gridY: 6 },
            enemies: [goblin({ gridX: 6, gridY: 5 })],
            stance: 'cerca', terrain, gridWidth: W, gridHeight: H,
        });
        expect(plan.action).toBe('attack');
        expect(plan.targetId).toBe('g1');
        expect(feet(plan.destination, { gridX: 4, gridY: 6 })).toBeLessThanOrEqual(5);
        expect(feet(plan.destination, { gridX: 6, gridY: 5 })).toBeLessThanOrEqual(5);
    });

    test('nunca sale andando del alcance de un enemigo', () => {
        // Pegada al goblin, y el tuyo lejos: irse hacia ti costaría un golpe gratis.
        const plan = planAllyTurn({
            actor: ally({ gridX: 5, gridY: 5 }),
            leader: { gridX: 1, gridY: 5 },
            enemies: [goblin({ gridX: 6, gridY: 5 })],
            stance: 'cerca', terrain, gridWidth: W, gridHeight: H,
        });
        expect(feet(plan.destination, { gridX: 6, gridY: 5 })).toBeLessThanOrEqual(5);
    });
});

describe('planAllyTurn — atrás', () => {
    test('se va lo más lejos que puede', () => {
        const plan = planAllyTurn({
            actor: ally({ gridX: 5, gridY: 5, attackRangeFeet: 80 }),
            enemies: [goblin({ gridX: 7, gridY: 5 })],
            stance: 'atras', terrain, gridWidth: W, gridHeight: H,
        });
        expect(feet(plan.destination, { gridX: 7, gridY: 5 })).toBeGreaterThan(10);
    });

    test('con arco, dispara desde atrás', () => {
        const plan = planAllyTurn({
            actor: ally({ gridX: 5, gridY: 5, attackRangeFeet: 80 }),
            enemies: [goblin({ gridX: 7, gridY: 5 })],
            stance: 'atras', terrain, gridWidth: W, gridHeight: H,
        });
        expect(plan.action).toBe('attack');
    });

    test('con alguien encima, se destraba antes de irse', () => {
        const plan = planAllyTurn({
            actor: ally({ gridX: 5, gridY: 5 }),
            enemies: [goblin({ gridX: 6, gridY: 5 })],
            stance: 'atras', terrain, gridWidth: W, gridHeight: H,
        });
        expect(plan.action).toBe('disengage');
        expect(feet(plan.destination, { gridX: 6, gridY: 5 })).toBeGreaterThan(5);
    });
});

describe('planAllyTurn — a la carga', () => {
    test('va a por el enemigo, como antes', () => {
        const plan = planAllyTurn({
            actor: ally({ gridX: 2, gridY: 5 }),
            leader: { gridX: 1, gridY: 5 },
            enemies: [goblin({ gridX: 6, gridY: 5 })],
            stance: 'carga', terrain, gridWidth: W, gridHeight: H,
        });
        expect(plan.action).toBe('attack');
        expect(feet(plan.destination, { gridX: 6, gridY: 5 })).toBeLessThanOrEqual(5);
    });
});

describe('planAllyTurn — malherido', () => {
    test('se retira, sea cual sea su postura', () => {
        for (const stance of ['cerca', 'carga', 'atras']) {
            const plan = planAllyTurn({
                actor: ally({ gridX: 5, gridY: 5, currentHp: 3 }),
                enemies: [goblin({ gridX: 6, gridY: 5 })],
                stance, terrain, gridWidth: W, gridHeight: H,
            });
            expect(plan.action).toBe('disengage');
            expect(plan.rationale).toMatch(/Malherido/);
        }
    });

    test('acorralado, se cubre en vez de pegar', () => {
        // Rodeado en una esquina: no hay casilla más lejos que la suya.
        const plan = planAllyTurn({
            actor: ally({ gridX: 0, gridY: 0, currentHp: 2, speedFeet: 0 }),
            enemies: [goblin({ gridX: 1, gridY: 0 })],
            stance: 'cerca', terrain, gridWidth: W, gridHeight: H,
        });
        expect(plan.action).toBe('dodge');
    });
});

test('sin enemigos, baja el arma', () => {
    const plan = planAllyTurn({
        actor: ally(), enemies: [goblin({ currentHp: 0 })], terrain, gridWidth: W, gridHeight: H,
    });
    expect(plan.action).toBe('none');
    expect(plan.destination).toEqual({ x: 5, y: 5 });
});
