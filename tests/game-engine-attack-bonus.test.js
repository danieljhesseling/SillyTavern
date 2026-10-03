import { describe, test, expect } from '@jest/globals';
import {
    attackBonusParts, describeAttackBonus, describeEdgeReason, weaponProficient, isMartialWeapon,
} from '../public/scripts/game-engine/rules/attack-bonus.js';
import { hitChance } from '../public/scripts/game-engine/combat/forecast.js';
import { planAbilityUse, normalizeAbility } from '../public/scripts/game-engine/rules/abilities.js';
import { getPlayerAttackBonus, getPlayerAttackModifier, getPlayerAttackParts } from '../public/scripts/party/combat-rules.js';

const fighter = (over = {}) => ({ name: 'Gerd', class: 'Guerrero', level: 1, strength: 16, dexterity: 12, ...over });
const longsword = { id: 'w1', name: 'Espada larga', subcategory: 'martial_melee', damageDice: '1d8' };
const rapier = { id: 'w2', name: 'Estoque', subcategory: 'martial_melee', properties: ['finesse'], damageDice: '1d8' };
const dagger = { id: 'w3', name: 'Daga', subcategory: 'simple_melee', damageDice: '1d4' };

describe('el bono de ataque: característica y competencia', () => {
    test('un guerrero de nivel 1 con Fuerza 16 ataca con +5, y lo dice', () => {
        const parts = attackBonusParts({ member: fighter(), rangeFeet: 5, weapon: longsword });
        expect(parts).toMatchObject({ total: 5, ability: 3, proficiency: 2, proficient: true, abilityLabel: 'Fuerza' });
        expect(describeAttackBonus(parts)).toBe('+5 al ataque: +3 de Fuerza y +2 de competencia');
    });

    test('la competencia sube con el nivel: +3 a nivel 5, +4 a nivel 9', () => {
        expect(attackBonusParts({ member: fighter({ level: 5 }), rangeFeet: 5 }).proficiency).toBe(3);
        expect(attackBonusParts({ member: fighter({ level: 9 }), rangeFeet: 5 }).total).toBe(7);
    });

    test('de lejos, la Destreza; de cerca, la mejor de las dos', () => {
        const archer = fighter({ strength: 10, dexterity: 16 });
        expect(attackBonusParts({ member: archer, rangeFeet: 80 })).toMatchObject({ total: 5, abilityLabel: 'Destreza' });
        expect(attackBonusParts({ member: fighter(), rangeFeet: 80 })).toMatchObject({ total: 3, ability: 1, abilityLabel: 'Destreza' });
        expect(attackBonusParts({ member: archer, rangeFeet: 5 }).abilityLabel).toBe('Destreza');
    });

    test('lo demás que suma sale en la explicación; lo que vale 0, no', () => {
        const parts = attackBonusParts({
            member: fighter(), rangeFeet: 5, weapon: longsword,
            extras: [{ label: 'del arma', value: 1 }, { label: 'de lo aprendido', value: 0 }],
        });
        expect(parts.total).toBe(6);
        expect(describeAttackBonus(parts)).toBe('+6 al ataque: +3 de Fuerza, +2 de competencia y +1 del arma');
    });

    test('una característica baja resta, y se ve', () => {
        const weak = attackBonusParts({ member: fighter({ strength: 6, dexterity: 6 }), rangeFeet: 5 });
        expect(weak.total).toBe(0);
        expect(describeAttackBonus(weak)).toBe('+0 al ataque: -2 de Fuerza y +2 de competencia');
    });
});

describe('con qué armas hay competencia (2024)', () => {
    test('marcial o sencilla, por la subcategoría; lo que no lo dice, sencilla', () => {
        expect(isMartialWeapon(longsword)).toBe(true);
        expect(isMartialWeapon(dagger)).toBe(false);
        expect(isMartialWeapon({ name: 'Palo' })).toBe(false);
        expect(isMartialWeapon(null)).toBe(false);
    });

    test('el guerrero, con todas; el mago, solo con las sencillas', () => {
        expect(weaponProficient(fighter(), longsword)).toBe(true);
        expect(weaponProficient({ class: 'Mago' }, dagger)).toBe(true);
        expect(weaponProficient({ class: 'Mago' }, longsword)).toBe(false);
        const parts = attackBonusParts({ member: { class: 'Mago', level: 1, strength: 16 }, rangeFeet: 5, weapon: longsword });
        expect(parts).toMatchObject({ total: 3, proficiency: 0, proficient: false });
        expect(describeAttackBonus(parts)).toBe('+3 al ataque: +3 de Fuerza (sin competencia con esta arma)');
    });

    test('el pícaro, las marciales sutiles o ligeras; el monje, las ligeras', () => {
        expect(weaponProficient({ class: 'Pícaro' }, rapier)).toBe(true);
        expect(weaponProficient({ class: 'Pícaro' }, longsword)).toBe(false);
        expect(weaponProficient({ class: 'Monje' }, longsword)).toBe(false);
        expect(weaponProficient({ class: 'Monje' }, longsword, { light: true })).toBe(true);
    });

    test('sin arma (los puños), siempre; y una clase que no se conoce, también', () => {
        expect(weaponProficient({ class: 'Mago' }, null)).toBe(true);
        expect(weaponProficient({ class: 'Mercenario' }, longsword)).toBe(true);
    });
});

describe('la razón de la ventaja o la desventaja', () => {
    test('en palabras, y vacío si va normal', () => {
        expect(describeEdgeReason('disadvantage', ['está en el suelo, y de lejos cuesta'])).toBe('con desventaja: está en el suelo, y de lejos cuesta');
        expect(describeEdgeReason('advantage', ['lo tenéis flanqueado', 'va bendecido'])).toBe('con ventaja: lo tenéis flanqueado, va bendecido');
        expect(describeEdgeReason('advantage', [])).toBe('con ventaja');
        expect(describeEdgeReason('normal', ['algo'])).toBe('');
    });
});

describe('lo que pasa en la tirada', () => {
    test('el guerrero de nivel 1 acierta a una CA 13 el 65 % (antes, el 55 %)', () => {
        expect(hitChance(5, 13)).toBeCloseTo(0.65);
        expect(hitChance(3, 13)).toBeCloseTo(0.55);
    });

    test('un 1 siempre falla, también con una técnica', () => {
        const ability = normalizeAbility({ id: 'tajo', name: 'Tajo', cost: 'action', resource: 'at_will', rangeFeet: 5, target: 'enemy', resolution: 'attack', damage: '1d8' });
        const plan = planAbilityUse({
            actor: { name: 'Gerd' }, target: { name: 'Rata' }, ability,
            roll: () => ({ total: 1, natural: 1, rolls: [1] }), attackModifier: 20, targetAc: 5,
        });
        expect(plan.hit).toBe(false);
    });

    test('el motor: el ataque suma la competencia y el daño no', () => {
        const member = fighter({ items: [longsword], equippedItems: { weapon: 'w1' } });
        expect(getPlayerAttackModifier(member, 5)).toBe(3);
        expect(getPlayerAttackBonus(member, 5)).toBe(5);
        expect(getPlayerAttackParts(member, 5).proficient).toBe(true);
        const wizard = { ...member, class: 'Mago' };
        expect(getPlayerAttackBonus(wizard, 5)).toBe(3);
    });
});
