import { describe, test, expect } from '@jest/globals';
import {
    DAMAGE_LADDER, DEX_MODES, equippedIn, weaponOf, damageStepOf, stepDamage,
    weaponDamage, weaponRange, shieldBlocked, armourClassOf, describeArmour,
} from '../public/scripts/game-engine/rules/equipment.js';

const carrying = (...items) => ({
    items,
    equippedItems: Object.fromEntries(items.map(i => [i.slot, i.id])),
    dexterity: 14,
});

const daga = { id: 'daga', name: 'Daga', slot: 'weapon', damageDice: '1d4', hands: 1 };
const espada = { id: 'esp', name: 'Espada larga', slot: 'weapon', damageDice: '1d8', hands: 1 };
const hacha = { id: 'hac', name: 'Hacha a dos manos', slot: 'weapon', damageDice: '1d12', hands: 2 };
const arco = { id: 'arco', name: 'Arco corto', slot: 'weapon', damageDice: '1d6', hands: 2, rangeFeet: 80 };

describe('lo que llevas en la mano', () => {
    test('se encuentra por su ranura', () => {
        expect(weaponOf(carrying(daga)).name).toBe('Daga');
        expect(equippedIn(carrying(daga), 'body')).toBe(null);
    });

    test('y sin nada equipado no hay arma', () => {
        expect(weaponOf(null)).toBe(null);
        expect(weaponOf({ items: [daga], equippedItems: {} })).toBe(null);
    });

    // Un id equipado que ya no está en la mochila no puede reventar el combate.
    test('un arma que ya no está no es un arma', () => {
        expect(weaponOf({ items: [], equippedItems: { weapon: 'fantasma' } })).toBe(null);
    });
});

describe('el arma te mueve por la escalera', () => {
    test('el d8 es el punto de partida, y no mueve nada', () => {
        expect(damageStepOf(espada)).toBe(0);
    });

    test('una daga baja y un hacha a dos manos sube', () => {
        expect(damageStepOf(daga)).toBe(-2);
        // 1d12 sube dos, y las dos manos uno más: renunciar al escudo paga algo.
        expect(damageStepOf(hacha)).toBe(3);
    });

    test('cada dado de más es un peldaño', () => {
        expect(damageStepOf({ damageDice: '2d6', hands: 1 })).toBe(0);
        expect(damageStepOf({ damageDice: '2d8', hands: 1 })).toBe(1);
    });

    test('y lo que no dice nada no mueve nada', () => {
        expect(damageStepOf({})).toBe(0);
        expect(damageStepOf(null)).toBe(0);
    });

    test('subir y bajar recorre la escalera', () => {
        expect(stepDamage('1d8', 2)).toBe('1d12');
        expect(stepDamage('1d8', -2)).toBe('1d4');
        expect(DAMAGE_LADDER[0]).toBe('1d4');
    });

    test('no se sale por ningún extremo', () => {
        expect(stepDamage('1d4', -9)).toBe('1d4');
        expect(stepDamage('3d10', 9)).toBe(DAMAGE_LADDER[DAMAGE_LADDER.length - 1]);
    });

    // Una fórmula rara escrita a mano vale más que un dado inventado por el motor.
    test('lo que no está en la escalera se queda como está', () => {
        expect(stepDamage('1d6+3', 2)).toBe('1d6+3');
    });
});

describe('el daño de quien lleva algo', () => {
    // El nivel dice de qué dado partes; el arma te mueve por la escalera.
    test('el nivel sigue mandando, y el arma decide desde dónde', () => {
        expect(weaponDamage(carrying(espada), '1d8')).toBe('1d8');
        expect(weaponDamage(carrying(daga), '1d8')).toBe('1d4');
        expect(weaponDamage(carrying(hacha), '1d8')).toBe('2d6');
    });

    // Un nivel 9 con una daga sigue siendo de nivel 9.
    test('y la progresión no se pierde: la misma daga pega más a nivel alto', () => {
        expect(weaponDamage(carrying(daga), '2d8')).toBe('1d12');
        expect(weaponDamage(carrying(hacha), '2d8')).toBe('3d10');
    });

    // Aditivo: una partida vieja, con objetos sin estos campos, pega igual que pegaba.
    test('sin arma, o con una que no dice su dado, quien llama sigue con lo suyo', () => {
        expect(weaponDamage(carrying({ id: 'x', name: 'Palo', slot: 'weapon' }), '1d8')).toBe('');
        expect(weaponDamage(null, '1d8')).toBe('');
    });
});

describe('hasta dónde llega', () => {
    // Un «Arco corto de tejo» del compendio era cuerpo a cuerpo: el alcance salía de
    // buscar «bow» en el nombre, en inglés.
    test('el arma lo dice, y por fin un arco del compendio dispara', () => {
        expect(weaponRange(carrying(arco))).toBe(80);
    });

    test('y si no lo dice, cero: quien llama sigue con su regla de siempre', () => {
        expect(weaponRange(carrying(espada))).toBe(0);
        expect(weaponRange(null)).toBe(0);
    });
});

describe('las dos manos', () => {
    // «No te queda mano» es una frase que se puede enseñar.
    test('un arma a dos manos deja sin escudo, y dice por qué', () => {
        expect(shieldBlocked(carrying(hacha))).toMatch(/no te queda mano/i);
        expect(shieldBlocked(carrying(hacha))).toContain('Hacha a dos manos');
    });

    test('y una de una mano no estorba', () => {
        expect(shieldBlocked(carrying(espada))).toBe('');
        expect(shieldBlocked(null)).toBe('');
    });
});

describe('la clase de armadura', () => {
    const cuero = { id: 'cue', name: 'Cuero', slot: 'body', armorClass: 11, dexMode: 'full' };
    const malla = { id: 'mal', name: 'Cota de malla', slot: 'body', armorClass: 14, dexMode: 'half' };
    const placa = { id: 'pla', name: 'Placa', slot: 'body', armorClass: 18, dexMode: 'none' };
    const escudo = { id: 'esc', name: 'Escudo', slot: 'shield', armorClass: 2 };

    test('sin nada puesto es diez y la destreza', () => {
        const sum = armourClassOf({ member: carrying(), dexModifier: 3 });
        expect(sum.armorClass).toBe(13);
        expect(sum.worn).toBe(false);
    });

    // Una armadura sustituye al diez, no se suma a él.
    test('la armadura sustituye al diez', () => {
        expect(armourClassOf({ member: carrying(cuero), dexModifier: 3 }).armorClass).toBe(14);
    });

    test('y la destreza cuenta según lo que la armadura deje', () => {
        expect(armourClassOf({ member: carrying(malla), dexModifier: 4 }).armorClass).toBe(16);
        expect(armourClassOf({ member: carrying(placa), dexModifier: 4 }).armorClass).toBe(18);
        expect(DEX_MODES).toContain('half');
    });

    test('una placa no deja ser ágil, ni siquiera un poco', () => {
        expect(armourClassOf({ member: carrying(placa), dexModifier: -1 }).armorClass).toBe(18);
    });

    test('el escudo sí suma', () => {
        expect(armourClassOf({ member: carrying(cuero, escudo), dexModifier: 2 }).armorClass).toBe(15);
    });

    test('y lo que trae un efecto también, que es el campo que ya existía', () => {
        const anillo = { id: 'an', name: 'Anillo', slot: 'ring', effects: [{ stat: 'armorClass', modifier: 1 }] };
        expect(armourClassOf({ member: carrying(cuero, anillo), dexModifier: 0 }).armorClass).toBe(12);
    });

    // Una CA que no se puede explicar se siente como una trampa del motor.
    test('se puede decir de dónde sale cada punto', () => {
        const sum = armourClassOf({ member: carrying(malla, escudo), dexModifier: 3 });
        expect(describeArmour(sum)).toBe('CA 18 (Cota de malla 14, Destreza +2, Escudo +2)');
    });

    test('y sin nada que describir, nada', () => {
        expect(describeArmour(null)).toBe('');
    });
});
