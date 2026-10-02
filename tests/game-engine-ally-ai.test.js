import { describe, test, expect } from '@jest/globals';
import { createEmptyTerrain } from '../public/scripts/game-engine/board/terrain.js';
import {
    planAllyTurn, stanceOf, STANCES, DEFAULT_STANCE, planAlly2024, allyDrinks,
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

describe('M4: «a mi lado» sin nadie al lado', () => {
    test('el héroe solo, con «Que actúe solo», va a por el enemigo lejano en vez de esperar', () => {
        const plan = planAllyTurn({
            actor: ally({ gridX: 1, gridY: 1 }),
            leader: null,
            enemies: [goblin({ gridX: 10, gridY: 10 })],
            stance: 'cerca', terrain, gridWidth: W, gridHeight: H,
        });
        expect(plan.rationale).not.toBe('Se queda a tu lado, esperando.');
        expect(feet(plan.destination, { gridX: 10, gridY: 10 })).toBeLessThan(feet({ x: 1, y: 1 }, { gridX: 10, gridY: 10 }));
    });

    test('malherido, en una esquina y con quien le dispara de lejos, va a por él en vez de cubrirse siempre', () => {
        const plan = planAllyTurn({
            actor: ally({ gridX: 0, gridY: 0, currentHp: 2 }),
            leader: null,
            enemies: [goblin({ gridX: 0, gridY: 8, attackRangeFeet: 60 })],
            stance: 'cerca', terrain, gridWidth: W, gridHeight: H,
        });
        expect(plan.action).not.toBe('dodge');
        expect(plan.rationale).toBe('Malherido y sin a dónde ir: se la juega.');
        expect(feet(plan.destination, { gridX: 0, gridY: 8 })).toBeLessThan(40);
    });

    test('con el enemigo encima, o con su héroe en pie, se sigue cubriendo', () => {
        const near = planAllyTurn({
            actor: ally({ gridX: 0, gridY: 0, currentHp: 2, speedFeet: 0 }),
            enemies: [goblin({ gridX: 1, gridY: 0 })],
            stance: 'cerca', terrain, gridWidth: W, gridHeight: H,
        });
        expect(near.action).toBe('dodge');
        const withHero = planAllyTurn({
            actor: ally({ gridX: 0, gridY: 0, currentHp: 2 }),
            leader: { gridX: 1, gridY: 1 },
            enemies: [goblin({ gridX: 0, gridY: 8, attackRangeFeet: 60 })],
            stance: 'cerca', terrain, gridWidth: W, gridHeight: H,
        });
        expect(withHero.action).toBe('dodge');
    });

    test('un mercenario malherido en su esquina, con su héroe lejos, también va a por él (la cripta)', () => {
        const plan = planAllyTurn({
            actor: ally({ gridX: 0, gridY: 0, currentHp: 2 }),
            leader: { gridX: 9, gridY: 9 },
            enemies: [goblin({ gridX: 0, gridY: 8, attackRangeFeet: 60 })],
            stance: 'cerca', terrain, gridWidth: W, gridHeight: H,
        });
        expect(plan.action).not.toBe('dodge');
        expect(plan.rationale).toBe('Malherido y sin a dónde ir: se la juega.');
    });
});

describe('tanda 12: los compañeros que van solos, con las reglas de 2024', () => {
    const board = {
        isFree: (/** @type {number} */ x, /** @type {number} */ y) => x >= 0 && y >= 0 && x < 10 && y < 10,
    };
    /** @param {object} o */
    const me = (o = {}) => ({ id: 'bruna', x: 4, y: 5, reachFeet: 5, avgDamage: 7, potions: 0, attacks: true, stance: 'cerca', shoveDC: 13, ...o });
    /** @param {object} o */
    const enemy = (o = {}) => ({ id: 'g1', x: 5, y: 5, hp: 12, maxHp: 12, saveMod: 0, avgDamage: 4, ...o });
    const attack = { action: 'attack', targetId: 'g1' };

    test('malherida y con poción, se la bebe; entera, o sin la adicional, no', () => {
        expect(allyDrinks({ hp: 5, maxHp: 20, potions: 1 })).toBe(true);
        expect(allyDrinks({ hp: 15, maxHp: 20, potions: 1 })).toBe(false);
        expect(allyDrinks({ hp: 5, maxHp: 20, potions: 0 })).toBe(false);
        expect(allyDrinks({ hp: 5, maxHp: 20, potions: 1, hasBonus: false })).toBe(false);
        // En el suelo no bebe nadie: eso es darle la poción (Utilizar).
        expect(allyDrinks({ hp: 0, maxHp: 20, potions: 1 })).toBe(false);
    });

    test('a quien cae a su lado le da la poción, antes que pegar', () => {
        const down = { id: 'hero', x: 4, y: 6, hp: 0 };
        const plan = planAlly2024({ actor: me({ potions: 1 }), plan: attack, enemies: [enemy()], allies: [down], ground: board });
        expect(plan).toMatchObject({ kind: 'give-potion', targetId: 'hero' });
        // Muerto del todo, no; lejos, tampoco.
        expect(planAlly2024({ actor: me({ potions: 1 }), plan: attack, enemies: [enemy()], allies: [{ ...down, dead: true }], ground: board })).toBeNull();
        expect(planAlly2024({ actor: me({ potions: 1 }), plan: attack, enemies: [enemy()], allies: [{ ...down, x: 9 }], ground: board })).toBeNull();
    });

    test('al enemigo que está al borde del vacío, le empuja', () => {
        const ground = { ...board, isChasm: (/** @type {number} */ x) => x === 6 };
        expect(planAlly2024({ actor: me(), plan: attack, enemies: [enemy()], ground })).toMatchObject({ kind: 'shove', targetId: 'g1', why: 'chasm' });
        // Un familiar no empuja a nadie.
        expect(planAlly2024({ actor: me({ attacks: false, shoveDC: 0 }), plan: attack, enemies: [enemy()], ground })).toBeNull();
    });

    test('contra lo que quema, solo si no lo tumba antes a golpes', () => {
        const ground = { ...board, isHazard: (/** @type {number} */ x) => x === 6 };
        expect(planAlly2024({ actor: me({ shoveDC: 15 }), plan: attack, enemies: [enemy()], ground })).toMatchObject({ kind: 'shove', why: 'hazard' });
        expect(planAlly2024({ actor: me({ shoveDC: 15 }), plan: attack, enemies: [enemy({ hp: 3 })], ground })).toBeNull();
    });

    test('un familiar le abre la guardia a quien pega; un mercenario, solo si el otro pega el triple', () => {
        const hero = { id: 'hero', x: 6, y: 5, hp: 30, avgDamage: 9, reachFeet: 5 };
        expect(planAlly2024({ actor: me({ attacks: false, avgDamage: 0, shoveDC: 0 }), plan: { action: 'none', targetId: null }, enemies: [enemy()], allies: [hero], ground: board }))
            .toMatchObject({ kind: 'help', targetId: 'g1' });
        expect(planAlly2024({ actor: me({ avgDamage: 6 }), plan: attack, enemies: [enemy()], allies: [hero], ground: board })).toBeNull();
        expect(planAlly2024({ actor: me({ avgDamage: 2 }), plan: attack, enemies: [enemy()], allies: [hero], ground: board })).toMatchObject({ kind: 'help' });
    });

    test('quien se queda atrás sin nadie a tiro se esconde, si hay dónde', () => {
        const archer = me({ reachFeet: 60, stance: 'atras' });
        const far = enemy({ x: 9, y: 9 });
        const none = { action: 'none', targetId: null };
        expect(planAlly2024({ actor: archer, plan: none, enemies: [far], ground: board, sight: { canHide: true } })).toMatchObject({ kind: 'hide' });
        expect(planAlly2024({ actor: archer, plan: none, enemies: [far], ground: board, sight: {} })).toBeNull();
        expect(planAlly2024({ actor: archer, plan: attack, enemies: [far], ground: board, sight: { canHide: true } })).toBeNull();
    });

    test('sin nada mejor, pega', () => {
        expect(planAlly2024({ actor: me(), plan: attack, enemies: [enemy()], ground: board })).toBeNull();
    });
});
