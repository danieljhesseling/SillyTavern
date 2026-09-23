import fs from 'node:fs';
import { describe, test, expect } from '@jest/globals';
import { createCompendium, validateBattery } from '../public/scripts/game-engine/compendio/compendio.js';
import {
    KIN_STATS, STAT_LABELS, effectsOf, racesOf, kindsOf, validateKin, applyKin, describeKin,
} from '../public/scripts/game-engine/compendio/kin.js';

const read = (name) => JSON.parse(fs.readFileSync(
    new URL(`../public/compendio/${name}.json`, import.meta.url), 'utf8',
));

const razas = read('razas');
const clases = read('clases');
const habilidades = read('habilidades');

const real = () => createCompendium({ razas: razas.rows, clases: clases.rows });

const hoja = () => ({
    strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10,
    charisma: 10, speed: 30, maxHp: 30, armorClass: 10,
});

describe('las dos baterías', () => {
    test('cada una pasa su propia validación', () => {
        expect(validateBattery('razas', razas)).toEqual([]);
        expect(validateBattery('clases', clases)).toEqual([]);
    });

    test('hay de sobra para elegir', () => {
        expect(racesOf(real()).length).toBeGreaterThanOrEqual(10);
        expect(kindsOf(real()).length).toBeGreaterThanOrEqual(8);
    });

    test('y sin batería no hay nada, sin reventar', () => {
        expect(racesOf(createCompendium({}))).toEqual([]);
        expect(kindsOf(createCompendium({}))).toEqual([]);
    });

    // Lo que aquí se llama «picaro» es lo que abre el Ataque furtivo.
    test('las clases son las mismas que usan las habilidades', () => {
        const enHabilidades = new Set(habilidades.rows
            .flatMap(row => row.when?.class ?? [])
            .filter(name => name !== '*'));
        const escritas = new Set(kindsOf(real()).map(row => row.id));
        for (const name of enHabilidades) expect(escritas).toContain(name);
    });
});

describe('lo que hace que elegir signifique algo', () => {
    test('ninguna usa una característica que el motor no conoce', () => {
        expect(validateKin(real())).toEqual([]);
    });

    test('una característica inventada se caza, y se dice cuáles valen', () => {
        const [message] = validateKin(createCompendium({
            razas: [{ id: 'x', name: 'Mala', kind: 'raza', effects: [{ stat: 'suerte', modifier: 2 }] }],
        }));
        expect(message).toMatch(/suerte/);
        expect(message).toContain(KIN_STATS.join(', '));
    });

    // Una raza que solo suma se elige siempre, y entonces no hay nada que elegir.
    test('la que solo suma se caza', () => {
        expect(validateKin(createCompendium({
            razas: [{
                id: 'x', name: 'Regalada', kind: 'raza',
                effects: [{ stat: 'strength', modifier: 2 }, { stat: 'wisdom', modifier: 2 }],
            }],
        })).join(' ')).toMatch(/solo suma/);
    });

    test('y la que no hace nada, también', () => {
        expect(validateKin(createCompendium({
            razas: [{ id: 'x', name: 'Vacía', kind: 'raza', effects: [] }],
        })).join(' ')).toMatch(/no significa nada/);
    });

    test('una clase tiene que decir su dado de golpe', () => {
        expect(validateKin(createCompendium({
            clases: [{
                id: 'x', name: 'Sin dado', kind: 'clase',
                effects: [{ stat: 'strength', modifier: 2 }, { stat: 'wisdom', modifier: -1 }],
            }],
        })).join(' ')).toMatch(/dado de golpe/);
    });

    // Todas las escritas cumplen su parte del trato.
    test('todas las que vienen escritas quitan algo', () => {
        for (const row of [...racesOf(real()), ...kindsOf(real())]) {
            expect(effectsOf(row).some(effect => effect.modifier < 0)).toBe(true);
        }
    });
});

describe('lo que le hacen a una ficha', () => {
    const enano = () => racesOf(real()).find(row => row.id === 'raza-enano');
    const mago = () => kindsOf(real()).find(row => row.id === 'mago');

    test('suman y restan donde toca', () => {
        const { stats } = applyKin({ sheet: hoja(), race: enano() });
        expect(stats.constitution).toBe(12);
        expect(stats.dexterity).toBe(9);
        expect(stats.speed).toBe(25);
        expect(stats.charisma).toBe(10);
    });

    test('la raza y la clase se apilan', () => {
        const { stats } = applyKin({ sheet: hoja(), race: enano(), kind: mago() });
        expect(stats.constitution).toBe(10);
        expect(stats.intelligence).toBe(12);
    });

    // Un número que aparece en una ficha sin poder explicarlo parece un error del juego.
    test('y se puede decir de dónde sale cada cambio', () => {
        const { lines } = applyKin({ sheet: hoja(), race: enano(), kind: mago() });
        expect(lines[0]).toContain('Enano');
        expect(lines[0]).toContain('+2 Constitución');
        expect(lines[0]).toContain('-5 Velocidad');
        expect(lines.join(' ')).not.toMatch(/undefined|NaN/);
    });

    test('sin raza ni clase, la ficha sale como entró', () => {
        expect(applyKin({ sheet: hoja() }).stats).toEqual(hoja());
        expect(applyKin({ sheet: hoja() }).lines).toEqual([]);
    });

    // Lo que la ficha no tiene no se inventa.
    test('no crea campos que la ficha no traía', () => {
        const { stats } = applyKin({ sheet: { strength: 10 }, race: enano() });
        expect(stats).toEqual({ strength: 10 });
    });

    test('en una línea se lee lo que da y lo que quita', () => {
        expect(describeKin(enano())).toContain('+2 Constitución');
        expect(describeKin(mago())).toContain('1d6');
        expect(describeKin(null)).toBe('');
    });

    test('y ninguna línea sale con un hueco', () => {
        for (const row of [...racesOf(real()), ...kindsOf(real())]) {
            expect(describeKin(row)).not.toMatch(/undefined|NaN/);
        }
        expect(Object.keys(STAT_LABELS).sort()).toEqual([...KIN_STATS].sort());
    });
});
