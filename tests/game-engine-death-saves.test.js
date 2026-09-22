import { describe, test, expect } from '@jest/globals';
import {
    readDeathSaves, isDying, clearDeathSaves, rollDeathSave, takeHitWhileDown,
    describeDeathSaves, DEATH_SAVE_TARGET,
} from '../public/scripts/game-engine/rules/death-saves.js';

const down = (over = {}) => ({ id: 1, name: 'Lyra', hp: 0, maxHp: 20, ...over });
const fixed = (n) => () => ({ total: n, natural: n });

describe('quien esta jugandosela', () => {
    test('el que esta a cero y no se ha estabilizado', () => {
        expect(isDying(down())).toBe(true);
    });

    test('el que sigue en pie, no', () => {
        expect(isDying(down({ hp: 3 }))).toBe(false);
    });

    test('el estabilizado tampoco: sigue a cero, pero deja de tirar', () => {
        expect(isDying(down({ deathSaves: { stable: true } }))).toBe(false);
    });

    test('ni el muerto', () => {
        expect(isDying(down({ deathSaves: { dead: true } }))).toBe(false);
    });

    test('una ficha sin estado se lee como recien caida', () => {
        expect(readDeathSaves({})).toEqual({ successes: 0, failures: 0, stable: false, dead: false });
        expect(clearDeathSaves()).toEqual({ successes: 0, failures: 0, stable: false, dead: false });
    });
});

describe('la tirada', () => {
    test('diez o mas es un exito', () => {
        const result = rollDeathSave({ member: down(), roll: fixed(10) });
        expect(result.saves.successes).toBe(1);
        expect(result.outcome).toBe('pending');
        expect(result.line).toMatch(/éxito/);
    });

    test('menos de diez es un fallo', () => {
        expect(rollDeathSave({ member: down(), roll: fixed(9) }).saves.failures).toBe(1);
    });

    test('un 1 natural cuenta por dos', () => {
        const result = rollDeathSave({ member: down(), roll: fixed(1) });
        expect(result.saves.failures).toBe(2);
        expect(result.line).toMatch(/pifia/);
    });

    test('un 20 natural levanta con 1 PG, no estabiliza', () => {
        const result = rollDeathSave({ member: down({ deathSaves: { failures: 2 } }), roll: fixed(20) });
        expect(result.outcome).toBe('up');
        expect(result.hp).toBe(1);
        expect(result.saves).toEqual(clearDeathSaves());
    });

    test('tres exitos estabilizan', () => {
        const result = rollDeathSave({ member: down({ deathSaves: { successes: 2 } }), roll: fixed(15) });
        expect(result.outcome).toBe('stable');
        expect(result.saves.stable).toBe(true);
        expect(result.hp).toBe(0);
    });

    test('y tres fallos matan', () => {
        const result = rollDeathSave({ member: down({ deathSaves: { failures: 2 } }), roll: fixed(4) });
        expect(result.outcome).toBe('dead');
        expect(result.saves.dead).toBe(true);
    });

    test('una pifia con un fallo ya puesto tambien mata', () => {
        expect(rollDeathSave({ member: down({ deathSaves: { failures: 1 } }), roll: fixed(1) }).outcome).toBe('dead');
    });
});

describe('golpear a quien esta en el suelo', () => {
    test('es un fallo automatico', () => {
        const result = takeHitWhileDown(down());
        expect(result.saves.failures).toBe(1);
        expect(result.line).toMatch(/un fallo/);
    });

    test('y dos si es critico', () => {
        expect(takeHitWhileDown(down(), true).saves.failures).toBe(2);
    });

    test('remata al que ya llevaba dos', () => {
        const result = takeHitWhileDown(down({ deathSaves: { failures: 2 } }));
        expect(result.outcome).toBe('dead');
        expect(result.saves.dead).toBe(true);
    });

    test('y saca de la estabilizacion a quien la tenia', () => {
        const result = takeHitWhileDown(down({ deathSaves: { stable: true, successes: 3 } }));
        expect(result.saves.stable).toBe(false);
    });
});

describe('contado en la ficha', () => {
    test('dice como va', () => {
        expect(describeDeathSaves(down({ deathSaves: { successes: 1, failures: 2 } })))
            .toBe('Salvaciones: 1 éxito(s), 2 fallo(s)');
    });

    test('y el final, cuando lo hay', () => {
        expect(describeDeathSaves(down({ deathSaves: { stable: true } }))).toBe('Estabilizado');
        expect(describeDeathSaves(down({ deathSaves: { dead: true } }))).toBe('Muerto');
    });

    test('quien esta en pie no tiene nada que contar', () => {
        expect(describeDeathSaves(down({ hp: 10 }))).toBe('');
    });

    test('hacen falta tres, ni mas ni menos', () => {
        expect(DEATH_SAVE_TARGET).toBe(3);
    });
});
