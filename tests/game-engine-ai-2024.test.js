import { describe, test, expect } from '@jest/globals';
import {
    ENEMY_WEAPONS, weaponsIn, enemyWeapon, proficiencyFromCr, enemySaveDC, failChance, enemyPotions, pushTrail,
    chooseEnemyAction2024, chooseEnemyBefore2024, chooseEnemySlot, masteryLine, LEDGE_FEET,
} from '../public/scripts/game-engine/combat/ai-2024.js';
import { masteryOf } from '../public/scripts/game-engine/rules/weapon-mastery.js';
import { normalizeSpell } from '../public/scripts/game-engine/rules/spell-catalogue.js';
import { averageOf } from '../public/scripts/game-engine/combat/enemy-abilities.js';

/** Un tablero abierto de 10×10, sin nadie, sin desniveles. */
const open = (/** @type {Partial<import('../public/scripts/game-engine/combat/ai-2024.js').Ground>} */ extra = {}) => ({
    isFree: (/** @type {number} */ x, /** @type {number} */ y) => x >= 0 && y >= 0 && x < 10 && y < 10,
    ...extra,
});

/** @param {object} o */
const foe = (o = {}) => ({ id: 'lia', x: 5, y: 5, hp: 20, maxHp: 20, saveMod: 0, conditions: [], avgDamage: 7, ...o });

/** @param {object} o */
const brute = (o = {}) => ({ id: 'bandido', x: 4, y: 5, hp: 20, maxHp: 20, reachFeet: 5, str: 16, dex: 10, cr: 1, role: 'bruto', avgDamage: 7, ...o });

describe('el arma de un enemigo, de su ficha o de lo que dice de él', () => {
    test('lo que dicen las campañas: horca, hacha de dos manos, alabardero, pica, dagas, estoque', () => {
        expect(enemyWeapon({ name: 'Campesino desesperado', description: 'Empuña una horca oxidada.' })).toMatchObject({ name: 'tridente', mastery: 'topple', masteryLabel: 'Derribar' });
        expect(enemyWeapon({ name: 'Garth', description: 'Lleva un hacha de dos manos afilada.' })).toMatchObject({ name: 'hacha a dos manos', mastery: 'cleave', hands: 2 });
        expect(enemyWeapon({ name: 'Alabardero del Castillo', description: 'Veteranos leales.', attackRangeFeet: 10 })).toMatchObject({ mastery: 'cleave' });
        expect(enemyWeapon({ name: 'Capitana', description: 'Va armada con una pica de acero negro.', attackRangeFeet: 10 })).toMatchObject({ name: 'pica', mastery: 'push' });
        expect(enemyWeapon({ name: 'Sombra', description: 'Usa dagas untadas en estiércol.' })).toMatchObject({ name: 'daga', mastery: 'nick', offHand: { name: 'daga', mastery: 'nick' } });
        // El estoque no es ligero: con la daga de parada no pega dos veces (2024).
        expect(enemyWeapon({ name: 'Lord Vane', description: 'Lucha con espada ropera y daga de parada.' })).toMatchObject({ name: 'estoque', mastery: 'vex', offHand: null });
        expect(enemyWeapon({ name: 'Bandido', description: 'Con una maza y mala cara.' })).toMatchObject({ name: 'maza', mastery: 'sap' });
    });

    test('sin arma reconocible (un lobo, un zombi), nada: pega como siempre', () => {
        expect(enemyWeapon({ name: 'Lobo gris', description: 'Caza en manada y huye si se queda solo.' })).toBeNull();
        expect(enemyWeapon({ name: 'Zombi', description: 'Sus miembros cortados a mordiscos.' })).toBeNull();
    });

    test('palabras enteras: «se lanza» no es una lanza, ni «amenaza» una maza', () => {
        expect(weaponsIn('Se lanza a por el más cercano con una amenaza')).toEqual([]);
        expect(weaponsIn('Lleva una lanza larga')).toMatchObject([{ name: 'lanza' }]);
    });

    test('un tirador pega con lo de disparar; uno de cerca, con lo de cerca', () => {
        const both = { name: 'Cazador', description: 'Un arco corto a la espalda y un hacha en el cinto.' };
        expect(enemyWeapon({ ...both, attackRangeFeet: 60 })).toMatchObject({ name: 'arco corto', mastery: 'vex', ranged: true });
        expect(enemyWeapon({ ...both, attackRangeFeet: 5 })).toMatchObject({ name: 'hacha', mastery: 'topple', ranged: false });
    });

    test('la ficha manda: `weapon` gana a la descripción', () => {
        expect(enemyWeapon({ name: 'Matón', description: 'Usa dagas.', weapon: 'Martillo de guerra' })).toMatchObject({ name: 'martillo de guerra', mastery: 'push' });
        expect(enemyWeapon({ name: 'Domador', weapon: 'látigo' })).toMatchObject({ mastery: 'slow' });
    });

    test('cada arma de la tabla tiene la maestría de su forma de 2024', () => {
        // El látigo trae la suya (no está en el compendio); las demás, del compendio.
        const masteries = ENEMY_WEAPONS.map(weapon => [weapon.name, masteryOf({ name: weapon.name, mastery: weapon.mastery })]);
        for (const [name, mastery] of masteries) {
            expect([name, mastery]).toEqual([name, expect.stringMatching(/^(vex|topple|sap|slow|push|graze|cleave|nick)$/)]);
        }
    });
});

describe('las cuentas de un enemigo', () => {
    test('competencia por desafío y la CD de 8 + característica + competencia', () => {
        expect(proficiencyFromCr(0.25)).toBe(2);
        expect(proficiencyFromCr(5)).toBe(3);
        expect(proficiencyFromCr(9)).toBe(4);
        expect(enemySaveDC({ strength: 16, dexterity: 10, cr: 1 }, 'strength')).toBe(13);
        expect(enemySaveDC({ strength: 10, dexterity: 18, cr: 1 }, 'best')).toBe(14);
        // Las fichas de los paquetes no traen características: 10.
        expect(enemySaveDC({ cr: 0.5 })).toBe(10);
    });

    test('la probabilidad de fallar una salvación (el empate salva)', () => {
        expect(failChance(10, 0)).toBeCloseTo(0.45);
        expect(failChance(13, 3)).toBeCloseTo(0.45);
        expect(failChance(30, 0)).toBe(0.95);
        expect(failChance(2, 5)).toBe(0.05);
    });

    test('las pociones: las de su ficha, menos las que se ha bebido', () => {
        expect(enemyPotions({ potions: 2 }, { potionsUsed: 1 })).toMatchObject({ count: 1, heal: '2d4+2' });
        expect(enemyPotions({ items: [{ name: 'Poción de curación mayor', quantity: 1 }] })).toMatchObject({ count: 1, heal: '4d4+4' });
        expect(enemyPotions({}).count).toBe(0);
    });
});

describe('a dónde va a parar alguien empujado', () => {
    test('en campo abierto, las casillas que tocan', () => {
        expect(pushTrail({ from: { x: 4, y: 5 }, target: { x: 5, y: 5 }, cells: 2, ground: open() })).toEqual({ to: { x: 7, y: 5 }, moved: 2, why: '', dropFeet: 0 });
    });

    test('lo que no se pisa le para antes', () => {
        const ground = open({ isFree: (x, y) => !(x === 6 && y === 5) });
        expect(pushTrail({ from: { x: 4, y: 5 }, target: { x: 5, y: 5 }, cells: 2, ground })).toMatchObject({ to: { x: 5, y: 5 }, moved: 0, why: '' });
    });

    test('al borde de lo alto, cae: ahí se para, con los pies de la caída', () => {
        const high = (/** @type {{x: number}} */ c) => c.x <= 5;
        const ground = open({ drop: (a, b) => (high(a) && !high(b) ? LEDGE_FEET : 0) });
        expect(pushTrail({ from: { x: 4, y: 5 }, target: { x: 5, y: 5 }, cells: 2, ground })).toEqual({ to: { x: 6, y: 5 }, moved: 1, why: 'ledge', dropFeet: 10 });
    });

    test('subir un risco no se puede: le para', () => {
        const ground = open({ drop: () => -20 });
        expect(pushTrail({ from: { x: 4, y: 5 }, target: { x: 5, y: 5 }, cells: 1, ground })).toMatchObject({ moved: 0, why: '' });
    });

    test('el agua honda: cae dentro y sale por donde cayó', () => {
        const ground = open({ isDeepWater: (x) => x === 6 });
        expect(pushTrail({ from: { x: 4, y: 5 }, target: { x: 5, y: 5 }, cells: 1, ground })).toEqual({ to: { x: 5, y: 5 }, moved: 0, why: 'water', dropFeet: 0 });
    });

    test('lo que quema y el vacío', () => {
        expect(pushTrail({ from: { x: 4, y: 5 }, target: { x: 5, y: 5 }, cells: 2, ground: open({ isHazard: (x) => x === 6 }) })).toMatchObject({ to: { x: 6, y: 5 }, why: 'hazard' });
        expect(pushTrail({ from: { x: 4, y: 5 }, target: { x: 5, y: 5 }, cells: 1, ground: open({ isChasm: (x) => x === 6 }) })).toMatchObject({ to: { x: 6, y: 5 }, why: 'chasm' });
    });
});

describe('lo que hace un enemigo en vez de su golpe', () => {
    test('un bruto empuja al que tiene al borde del agua honda', () => {
        const choice = chooseEnemyAction2024({ actor: brute(), canAttack: true, foes: [foe()], ground: open({ isDeepWater: (x) => x === 6 }) });
        expect(choice).toMatchObject({ kind: 'shove', targetId: 'lia', why: 'water' });
        expect(choice?.reason).toMatch(/agua honda/);
    });

    test('y desde lo alto, abajo', () => {
        const high = (/** @type {{x: number}} */ c) => c.x <= 5;
        const choice = chooseEnemyAction2024({ actor: brute(), canAttack: true, foes: [foe()], ground: open({ drop: (a, b) => (high(a) && !high(b) ? 10 : 0) }) });
        expect(choice).toMatchObject({ kind: 'shove', why: 'ledge' });
    });

    test('sin borde, no empuja: pega', () => {
        expect(chooseEnemyAction2024({ actor: brute(), canAttack: true, foes: [foe()], ground: open() })).toBeNull();
    });

    test('quien dispara de lejos no empuja', () => {
        const archer = brute({ reachFeet: 60, role: 'tirador', str: 10, dex: 16 });
        expect(chooseEnemyAction2024({ actor: archer, canAttack: true, foes: [foe()], ground: open({ isDeepWater: (x) => x === 6 }) })).toBeNull();
    });

    test('un bruto agarra al que lanza conjuros, si hay más gente que pegar', () => {
        const mage = foe({ caster: true, saveMod: 0 });
        const choice = chooseEnemyAction2024({ actor: brute(), canAttack: true, foes: [mage, foe({ id: 'gerd', x: 1, y: 1 })], ground: open() });
        expect(choice).toMatchObject({ kind: 'grapple', targetId: 'lia' });
    });

    test('no agarra con un arma a dos manos, ni a quien ya está agarrado, ni al último que queda', () => {
        const mage = foe({ caster: true });
        const other = foe({ id: 'gerd', x: 1, y: 1 });
        expect(chooseEnemyAction2024({ actor: brute({ freeHand: false }), canAttack: true, foes: [mage, other], ground: open() })).toBeNull();
        expect(chooseEnemyAction2024({ actor: brute(), canAttack: true, foes: [foe({ caster: true, conditions: ['Grappled'] }), other], ground: open() })).toBeNull();
        expect(chooseEnemyAction2024({ actor: brute(), canAttack: true, foes: [mage], ground: open() })).toBeNull();
    });

    test('a cada uno lo intenta agarrar una vez por pelea: si se le suelta, le pega', () => {
        const mage = foe({ caster: true, saveMod: 0 });
        const other = foe({ id: 'gerd', x: 1, y: 1 });
        expect(chooseEnemyAction2024({ actor: brute({ grabbed: ['lia'] }), canAttack: true, foes: [mage, other], ground: open() })).toBeNull();
        // A otro que lanza, sí.
        const second = foe({ id: 'nella', x: 5, y: 4, caster: true, saveMod: 0 });
        expect(chooseEnemyAction2024({ actor: brute({ grabbed: ['lia'] }), canAttack: true, foes: [mage, second, other], ground: open() }))
            .toMatchObject({ kind: 'grapple', targetId: 'nella' });
    });

    test('un esbirro le abre la guardia al jefe que pega el triple', () => {
        const minion = brute({ id: 'esbirro', role: 'tanque', str: 10, avgDamage: 3.5 });
        const boss = { id: 'jefe', x: 6, y: 5, hp: 60, maxHp: 60, reachFeet: 5, avgDamage: 14 };
        const choice = chooseEnemyAction2024({ actor: minion, canAttack: true, foes: [foe()], friends: [boss], ground: open() });
        expect(choice).toMatchObject({ kind: 'help', targetId: 'lia', friendId: 'jefe' });
    });

    test('si el otro pega parecido, pega él', () => {
        const minion = brute({ id: 'esbirro', avgDamage: 6 });
        const other = { id: 'otro', x: 6, y: 5, hp: 20, maxHp: 20, reachFeet: 5, avgDamage: 8 };
        expect(chooseEnemyAction2024({ actor: minion, canAttack: true, foes: [foe()], friends: [other], ground: open() })).toBeNull();
    });

    test('lo tira al suelo si dos de los suyos más le pegan después en esta ronda', () => {
        const friends = [
            { id: 'a', x: 6, y: 5, hp: 10, maxHp: 10, avgDamage: 7, laterThisRound: true },
            { id: 'b', x: 5, y: 6, hp: 10, maxHp: 10, avgDamage: 7, laterThisRound: true },
        ];
        expect(chooseEnemyAction2024({ actor: brute(), canAttack: true, foes: [foe()], friends, ground: open() })).toMatchObject({ kind: 'shove', why: 'prone' });
        // Si ya les ha tocado, no les sirve.
        const done = friends.map(f => ({ ...f, laterThisRound: false }));
        expect(chooseEnemyAction2024({ actor: brute(), canAttack: true, foes: [foe()], friends: done, ground: open() })).toBeNull();
    });

    test('un tirador que no llega a nadie se esconde, si hay dónde', () => {
        const archer = brute({ reachFeet: 60, profile: 'skirmisher', role: 'tirador' });
        const far = foe({ x: 9, y: 9 });
        expect(chooseEnemyAction2024({ actor: archer, canAttack: false, foes: [far], ground: open(), sight: { canHide: true } })).toMatchObject({ kind: 'hide' });
        expect(chooseEnemyAction2024({ actor: archer, canAttack: false, foes: [far], ground: open(), sight: { dim: true } })?.reason).toMatch(/penumbra/);
        expect(chooseEnemyAction2024({ actor: archer, canAttack: false, foes: [far], ground: open(), sight: {} })).toBeNull();
        expect(chooseEnemyAction2024({ actor: archer, canAttack: true, foes: [far], ground: open(), sight: { canHide: true } })).toBeNull();
    });
});

describe('lo que hace un enemigo antes de moverse', () => {
    const stays = { action: 'attack', movementCostFeet: 0 };
    const leaves = { action: 'none', movementCostFeet: 15 };

    test('malherido y con poción, se la bebe (y luego hace su turno)', () => {
        const out = chooseEnemyBefore2024({ actor: brute({ hp: 8, potions: 1 }), plan: stays, foes: [foe()] });
        expect(out.potion).toMatchObject({ kind: 'potion' });
        expect(out.before).toBeNull();
        expect(chooseEnemyBefore2024({ actor: brute({ hp: 8, potions: 0 }), plan: stays, foes: [foe()] }).potion).toBeNull();
        expect(chooseEnemyBefore2024({ actor: brute({ hp: 15, potions: 1 }), plan: stays, foes: [foe()] }).potion).toBeNull();
    });

    test('acorralado y malherido, con los suyos aún en pie, se cubre', () => {
        const guard = brute({ role: 'tanque', hp: 4 });
        const two = [foe(), foe({ id: 'gerd', x: 4, y: 4 })];
        const friend = { id: 'otro', x: 0, y: 0, hp: 10, maxHp: 10 };
        expect(chooseEnemyBefore2024({ actor: guard, plan: stays, foes: two, friends: [friend] }).before).toMatchObject({ kind: 'dodge' });
        // Solo, no: ya no viene nadie a ayudar.
        expect(chooseEnemyBefore2024({ actor: guard, plan: stays, foes: two }).before).toBeNull();
        // El bruto y el jefe pelean hasta el final.
        expect(chooseEnemyBefore2024({ actor: brute({ hp: 4 }), plan: stays, foes: two, friends: [friend] }).before).toBeNull();
        expect(chooseEnemyBefore2024({ actor: guard, plan: stays, foes: two, friends: [friend] }).before?.reason).toMatch(/Acorralado/);
    });

    test('se cubre una vez por pelea: la siguiente, pelea (si no, con otro curándole no acababa)', () => {
        const two = [foe(), foe({ id: 'gerd', x: 4, y: 4 })];
        const friend = { id: 'otro', x: 0, y: 0, hp: 10, maxHp: 10 };
        expect(chooseEnemyBefore2024({ actor: brute({ role: 'tanque', hp: 4, dodged: true }), plan: stays, foes: two, friends: [friend] }).before).toBeNull();
    });

    test('si irse le cuesta un golpe y no iba a pegar, se destraba', () => {
        const out = chooseEnemyBefore2024({ actor: brute(), plan: leaves, foes: [foe()], provokes: [foe({ avgDamage: 6 })] });
        expect(out.before).toMatchObject({ kind: 'disengage' });
    });

    test('si iba a pegar, solo se destraba cuando el golpe le puede tumbar', () => {
        const shoots = { action: 'attack', movementCostFeet: 10 };
        expect(chooseEnemyBefore2024({ actor: brute({ hp: 20 }), plan: shoots, foes: [foe()], provokes: [foe({ avgDamage: 6 })] }).before).toBeNull();
        expect(chooseEnemyBefore2024({ actor: brute({ hp: 6 }), plan: shoots, foes: [foe()], provokes: [foe({ avgDamage: 6 })] }).before).toMatchObject({ kind: 'disengage' });
    });

    test('sin nadie que le pegue al irse, nada', () => {
        expect(chooseEnemyBefore2024({ actor: brute(), plan: leaves, foes: [foe()] }).before).toBeNull();
    });
});

describe('J19.3 para los enemigos: con qué espacio lanza', () => {
    const missile = normalizeSpell({ id: 'conj-proyectil-magico', name: 'Proyectil mágico', level: 1, rays: 3, damage: '1d4+1', target: 'enemy', upcast: { rays: 1 } });
    const fireball = normalizeSpell({ id: 'mag-bola-fuego', name: 'Bola de fuego', level: 3, damage: '8d6', save: 'dexterity', target: 'point', area: { shape: 'radius', size: 20 }, upcast: { dice: '1d6' } });
    const frost = normalizeSpell({ id: 'mag-escarcha', name: 'Rayo de escarcha', level: 0, damage: '1d8', target: 'enemy' });

    test('con un espacio mayor que no guarda para nada, lo sube', () => {
        expect(chooseEnemySlot({ spell: missile, left: { 1: 2, 2: 1 }, average: averageOf, targetHp: 30 })).toEqual({ slotLevel: 2, upcast: true, detail: '4 dardos en vez de 3' });
    });

    test('el espacio de su otro conjuro de ese nivel no lo toca', () => {
        expect(chooseEnemySlot({ spell: missile, left: { 1: 2, 2: 1, 3: 1 }, reservedLevels: [3], average: averageOf, targetHp: 30 })).toMatchObject({ slotLevel: 2, upcast: true });
        expect(chooseEnemySlot({ spell: missile, left: { 1: 2, 3: 1 }, reservedLevels: [3], average: averageOf, targetHp: 30 })).toMatchObject({ slotLevel: 1, upcast: false });
    });

    test('si con el más bajo ya lo tumba, no gasta más', () => {
        expect(chooseEnemySlot({ spell: missile, left: { 1: 2, 2: 1 }, average: averageOf, targetHp: 6 })).toMatchObject({ slotLevel: 1, upcast: false });
    });

    test('más dados de daño, dichos en palabras', () => {
        expect(chooseEnemySlot({ spell: fireball, left: { 3: 1, 4: 1 }, average: averageOf })).toEqual({ slotLevel: 4, upcast: true, detail: '9d6 de daño en vez de 8d6' });
    });

    test('un truco no gasta espacio, y sin espacios, nada', () => {
        expect(chooseEnemySlot({ spell: frost, left: { 1: 1 } })).toMatchObject({ upcast: false });
        expect(chooseEnemySlot({ spell: missile, left: {} })).toEqual({ slotLevel: 0, upcast: false, detail: '' });
    });
});

describe('lo que dice el registro', () => {
    test('cada maestría en palabras llanas, con el arma', () => {
        const names = { who: 'El bandido', at: 'Lia', weapon: 'maza' };
        expect(masteryLine('sap', names)).toMatch(/^💢 Debilitar \(maza\): el golpe le pesa a Lia; su próximo ataque, con desventaja\.$/);
        expect(masteryLine('vex', names)).toMatch(/con ventaja/);
        expect(masteryLine('slow', names)).toMatch(/10 pies menos/);
        expect(masteryLine('topple', names)).toMatch(/tirar al suelo/);
        for (const id of ['vex', 'sap', 'slow', 'topple', 'push', 'graze', 'cleave']) {
            expect(masteryLine(/** @type {any} */ (id), names)).not.toMatch(/\bft\b/);
        }
    });
});
