import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import {
    readImbueSpec, imbueProblems, imbueTier, isMagicWeapon, canImbue, readImbue, imbueFor, affinityOf,
    imbueDamage, bestImbueType, describeImbue, planAllyImbue, IMBUE_TYPES,
} from '../public/scripts/game-engine/rules/elemental-weapon.js';
import { validateSpell, normalizeSpell, isFormula, findSpell, spellsOfClass } from '../public/scripts/game-engine/rules/spell-catalogue.js';
import { spellToAbility } from '../public/scripts/game-engine/rules/spell-cast.js';
import { linkedTo } from '../public/scripts/game-engine/rules/concentration.js';

const read = (/** @type {string} */ path) => JSON.parse(readFileSync(new URL(`../public/${path}`, import.meta.url), 'utf8'));
const catalogue = read('compendio/conjuros.json').rows;
const classIds = read('compendio/clases.json').rows.map((/** @type {any} */ r) => r.id);
const row = catalogue.find((/** @type {any} */ r) => r.id === 'conj-arma-elemental');
const spell = normalizeSpell(row);

const sword = { id: 'w1', name: 'Espada larga', damageDice: '1d8', damageType: 'slashing' };
const fighter = { id: 'f', name: 'Bran', spellWeapon: null };

describe('E3.3: la fila de Arma elemental', () => {
    test('existe, es de nivel 3, de concentración, a un aliado tocando, y del explorador y el paladín (2024)', () => {
        expect(row).toBeTruthy();
        expect(validateSpell(row, { classIds })).toEqual([]);
        expect(spell.level).toBe(3);
        expect(spell.concentration).toBe(true);
        expect(spell.durationRounds).toBe(600);
        expect(spell.target).toBe('ally');
        expect(spell.rangeFeet).toBe(5);
        expect(spell.classes).toEqual(['explorador', 'paladin']);
        expect(spellsOfClass([spell], 'explorador', { level: 3 }).map(s => s.id)).toEqual(['conj-arma-elemental']);
        expect(findSpell([spell], 'conj-arma-elemental')).toBe(spell);
    });

    test('los escalones de 2024: +1/1d4, con 5-6 +2/2d4, con 7+ +3/3d4', () => {
        expect(imbueTier(spell.imbue, 3)).toEqual({ bonus: 1, dice: '1d4' });
        expect(imbueTier(spell.imbue, 4)).toEqual({ bonus: 1, dice: '1d4' });
        expect(imbueTier(spell.imbue, 5)).toEqual({ bonus: 2, dice: '2d4' });
        expect(imbueTier(spell.imbue, 6)).toEqual({ bonus: 2, dice: '2d4' });
        expect(imbueTier(spell.imbue, 7)).toEqual({ bonus: 3, dice: '3d4' });
        expect(imbueTier(spell.imbue, 9)).toEqual({ bonus: 3, dice: '3d4' });
    });

    test('como habilidad: a un aliado, sin tirada, sin daño propio', () => {
        const ability = spellToAbility(spell, { slotLevel: 3 });
        expect(ability.target).toBe('ally');
        expect(ability.resolution).toBe('auto');
        expect(ability.damage).toBe('');
        expect(ability.concentration).toBe(true);
    });

    test('el validador pilla una columna imbue mal escrita', () => {
        expect(imbueProblems({ types: ['Poison'], tiers: [] }, isFormula).length).toBeGreaterThanOrEqual(2);
        expect(imbueProblems({ types: ['Fire'], tiers: [{ slot: 3, bonus: 5, dice: 'mucho' }] }, isFormula).length).toBe(2);
        const wrong = validateSpell({ ...row, target: 'enemy' }, { classIds });
        expect(wrong.some(e => e.includes('imbue'))).toBe(true);
        expect(readImbueSpec(null)).toBeNull();
        expect(readImbueSpec({ tiers: [{ slot: 3, bonus: 1, dice: '1d4' }] })?.types).toEqual(IMBUE_TYPES);
    });
});

describe('E3.3: a quién se le puede imbuir', () => {
    test('hace falta un arma, corriente y sin imbuir', () => {
        expect(canImbue(fighter, null).ok).toBe(false);
        expect(canImbue(fighter, null).reason).toMatch(/no lleva arma/);
        expect(canImbue(fighter, { ...sword, magicalBonus: 1 }).reason).toMatch(/ya es mágica/);
        expect(canImbue(fighter, sword)).toEqual({ ok: true, reason: '' });
        expect(canImbue({ ...fighter, spellWeapon: { spellId: 'conj-arma-elemental' } }, sword).reason).toMatch(/ya está imbuida/);
        expect(isMagicWeapon({ name: 'Varita', category: 'magic' })).toBe(true);
        expect(isMagicWeapon(sword)).toBe(false);
    });

    test('solo vale para el arma que se tocó, no la de la otra mano', () => {
        const member = { spellWeapon: { spellId: 'conj-arma-elemental', weaponId: 'w1', bonus: 1, dice: '1d4', type: 'Cold' } };
        expect(imbueFor(member, sword)?.type).toBe('Cold');
        expect(imbueFor(member, { id: 'w2', name: 'Daga' })).toBeNull();
        expect(imbueFor(member, null)).toBeNull();
        expect(imbueFor({}, sword)).toBeNull();
    });

    test('se acaba con la concentración de quien lo lanzó (linkedTo)', () => {
        const mark = readImbue({ spellId: 'conj-arma-elemental', casterId: 'ranger', bonus: 1, dice: '1d4' });
        const ended = { spellId: 'conj-arma-elemental', casterId: 'ranger', name: 'Arma elemental', since: 1, until: null };
        expect(linkedTo(ended, [mark]).linked).toHaveLength(1);
        expect(linkedTo({ ...ended, casterId: 'otro' }, [mark]).linked).toHaveLength(0);
    });
});

describe('E3.3: el daño y las resistencias', () => {
    test('la mitad si lo resiste, nada si es inmune, el doble si le duele', () => {
        expect(imbueDamage(4, 'Fire', {})).toEqual({ damage: 4, note: '' });
        expect(imbueDamage(4, 'Fire', { resistances: ['fire'] }).damage).toBe(2);
        expect(imbueDamage(5, 'Fire', { damageResistances: 'Fuego, frío' }).damage).toBe(2);
        expect(imbueDamage(4, 'Cold', { immunities: 'cold' })).toEqual({ damage: 0, note: 'no le hace nada' });
        expect(imbueDamage(3, 'Thunder', { vulnerabilities: ['trueno'] }).damage).toBe(6);
        expect(affinityOf({ resistances: ['rayo'] }, 'Lightning')).toBe('resist');
    });

    test('el tipo lo elige el juego: el que más les duele; si da igual, fuego', () => {
        expect(bestImbueType({ enemies: [] }).type).toBe('Fire');
        expect(bestImbueType({ enemies: [{ name: 'Lobo' }] })).toEqual({ type: 'Fire', word: 'fuego', why: '' });
        const ghouls = [{ name: 'Elemental', immunities: ['fire'], vulnerabilities: ['cold'] }];
        expect(bestImbueType({ enemies: ghouls })).toMatchObject({ type: 'Cold', word: 'frío' });
        expect(bestImbueType({ enemies: ghouls }).why).toMatch(/doble/);
        const yeti = [{ name: 'Yeti', weakness: 'Un ruido fuerte lo desorienta.' }];
        expect(bestImbueType({ enemies: yeti })).toMatchObject({ type: 'Thunder', word: 'trueno' });
        expect(bestImbueType({ enemies: [{ name: 'Plaga', weakness: 'La plata le quema.' }] }).type).toBe('Fire');
    });

    test('en la ficha y la tarjeta, en una frase llana', () => {
        const said = describeImbue({ spellId: 'conj-arma-elemental', name: 'Arma elemental', weaponName: 'Espada larga', bonus: 1, dice: '1d4', type: 'Fire', casterName: 'Nella' });
        expect(said).toBe('🔥 Arma elemental en espada larga: +1 al ataque y +1d4 de fuego (mientras Nella se concentre)');
        expect(describeImbue(null)).toBe('');
    });
});

describe('E3.3: la IA del compañero', () => {
    const near = (/** @type {Partial<import('../public/scripts/game-engine/rules/elemental-weapon.js').ImbueCandidate>} */ c) => ({ id: 'x', name: 'X', distanceFeet: 5, ok: true, ...c });
    const many = [{ currentHp: 10 }, { currentHp: 10 }, { currentHp: 10 }];

    test('no lo lanza si ya se concentra, si la pelea es corta o si no tiene a nadie a mano', () => {
        expect(planAllyImbue({ caster: { id: 'r', concentrating: true }, candidates: [near({})], enemies: many })).toBeNull();
        expect(planAllyImbue({ caster: { id: 'r', concentrating: false }, candidates: [near({})], enemies: [{ currentHp: 7 }] })).toBeNull();
        expect(planAllyImbue({ caster: { id: 'r', concentrating: false }, candidates: [near({ distanceFeet: 15 })], enemies: many })).toBeNull();
        expect(planAllyImbue({ caster: { id: 'r', concentrating: false }, candidates: [near({ ok: false })], enemies: many })).toBeNull();
    });

    test('con un jefe o muchos, al de cuerpo a cuerpo que tiene al lado antes que a sí mismo', () => {
        const plan = planAllyImbue({
            caster: { id: 'r', concentrating: false },
            candidates: [near({ id: 'r', melee: false }), near({ id: 'f', melee: true })],
            enemies: [{ currentHp: 30, boss: true }],
        });
        expect(plan).toEqual({ targetId: 'f', why: 'está aquí quien manda' });
        const alone = planAllyImbue({ caster: { id: 'r', concentrating: false }, candidates: [near({ id: 'r' })], enemies: many });
        expect(alone).toEqual({ targetId: 'r', why: 'son muchos' });
    });
});
