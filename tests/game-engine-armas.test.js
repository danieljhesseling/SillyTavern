import fs from 'node:fs';
import { describe, test, expect } from '@jest/globals';
import { createCompendium, validateBattery } from '../public/scripts/game-engine/compendio/compendio.js';
import { forgeItems, describeItem, FORM_DOMAINS } from '../public/scripts/game-engine/compendio/forge.js';
import { createSeededRandom } from '../public/scripts/game-engine/combat/seeded-random.js';
import {
    DEX_MODES, damageStepOf, stepDamage,
} from '../public/scripts/game-engine/rules/equipment.js';

const read = (name) => JSON.parse(fs.readFileSync(
    new URL(`../public/compendio/${name}.json`, import.meta.url), 'utf8',
));

const armas = read('armas');
const armaduras = read('armaduras');
const trastos = read('trastos');
const materiales = read('materiales');
const propiedades = read('propiedades');

const real = () => createCompendium({
    armas: armas.rows, armaduras: armaduras.rows, trastos: trastos.rows,
    materiales: materiales.rows, propiedades: propiedades.rows,
});

const forge = (itemType, howMany = 12, seed = 'b3b4') =>
    forgeItems({ compendium: real(), howMany, itemType, random: createSeededRandom(seed) });

describe('las tres baterías de formas', () => {
    test('cada una pasa su propia validación', () => {
        expect(validateBattery('armas', armas)).toEqual([]);
        expect(validateBattery('armaduras', armaduras)).toEqual([]);
        expect(validateBattery('trastos', trastos)).toEqual([]);
    });

    test('y la forja sabe dónde están las formas', () => {
        for (const domain of ['armas', 'armaduras', 'trastos']) {
            expect(FORM_DOMAINS).toContain(domain);
        }
    });

    // Materiales por un lado y formas por otro: forma × material = objeto.
    test('materiales.json ya no guarda formas', () => {
        expect(materiales.rows.every(r => r.kind === 'material')).toBe(true);
    });

    test('ningún id se repite entre archivos', () => {
        const ids = [...armas.rows, ...armaduras.rows, ...trastos.rows, ...materiales.rows]
            .map(r => r.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    test('hay suficientes para que el botín no se repita', () => {
        expect(armas.rows.length).toBeGreaterThanOrEqual(30);
        expect(armaduras.rows.length).toBeGreaterThanOrEqual(15);
        expect(trastos.rows.length).toBeGreaterThanOrEqual(15);
    });
});

describe('lo que hace que un arma sea una decisión', () => {
    test('todas dicen su dado, su tipo de daño y a cuántas manos van', () => {
        for (const row of armas.rows) {
            expect(row.damageDice).toMatch(/^\d+d\d+$/);
            expect(row.damageType).not.toBe('');
            expect([1, 2]).toContain(row.hands);
            expect(row.slot).toBe('weapon');
        }
    });

    // Sin `rangeFeet` un arco era cuerpo a cuerpo: el alcance salía de buscar «bow» en el
    // nombre, en inglés.
    test('y todo lo que es de distancia dice hasta dónde llega', () => {
        const lejos = armas.rows.filter(r => r.category === 'distancia');
        expect(lejos.length).toBeGreaterThanOrEqual(4);
        for (const row of lejos) expect(row.rangeFeet).toBeGreaterThan(20);
    });

    test('lo de cuerpo a cuerpo no finge alcance, salvo lo que se arroja', () => {
        for (const row of armas.rows.filter(r => r.category !== 'distancia')) {
            expect(row.rangeFeet ?? 0).toBeLessThanOrEqual(30);
        }
    });

    // Un arma que no mueve nada es un nombre. El reparto importa más que el número.
    test('hay armas que bajan, armas que no mueven y armas que suben', () => {
        const pasos = armas.rows.map(damageStepOf);
        expect(pasos.some(p => p < 0)).toBe(true);
        expect(pasos.some(p => p === 0)).toBe(true);
        expect(pasos.some(p => p >= 2)).toBe(true);
    });

    // Renunciar al escudo tiene que pagar algo.
    test('las de dos manos pegan más que las de una', () => {
        const unaMano = armas.rows.filter(r => r.hands === 1).map(damageStepOf);
        const dosManos = armas.rows.filter(r => r.hands === 2).map(damageStepOf);
        expect(Math.max(...dosManos)).toBeGreaterThan(Math.max(...unaMano));
    });

    test('y ninguna se sale de la escalera de dados', () => {
        for (const row of armas.rows) {
            expect(stepDamage('1d8', damageStepOf(row))).not.toBe('1d8+undefined');
        }
    });
});

describe('lo que hace que una armadura sea una decisión', () => {
    test('las de cuerpo dicen cuánto protegen y cuánta destreza dejan', () => {
        const cuerpo = armaduras.rows.filter(r => r.slot === 'body');
        expect(cuerpo.length).toBeGreaterThanOrEqual(6);
        for (const row of cuerpo) {
            expect(row.armorClass).toBeGreaterThanOrEqual(11);
            expect(DEX_MODES).toContain(row.dexMode);
        }
    });

    // Una placa protege más y no deja ser ágil: sin eso, la mejor armadura sería siempre
    // la de número más alto y no habría nada que decidir.
    test('la que más protege es la que menos destreza deja', () => {
        const cuerpo = armaduras.rows.filter(r => r.slot === 'body');
        const mejor = cuerpo.reduce((a, b) => (a.armorClass >= b.armorClass ? a : b));
        expect(mejor.dexMode).toBe('none');
        const peor = cuerpo.reduce((a, b) => (a.armorClass <= b.armorClass ? a : b));
        expect(peor.dexMode).toBe('full');
    });

    test('y la que más protege es también la que más pesa', () => {
        const cuerpo = armaduras.rows.filter(r => r.slot === 'body');
        const mejor = cuerpo.reduce((a, b) => (a.armorClass >= b.armorClass ? a : b));
        expect(mejor.kg).toBe(Math.max(...cuerpo.map(r => r.kg)));
    });

    test('las piezas sueltas suman poco, y van a su sitio', () => {
        for (const row of armaduras.rows.filter(r => r.slot !== 'body')) {
            expect(row.armorClass).toBeLessThanOrEqual(3);
            expect(['head', 'shield', 'hands', 'feet']).toContain(row.slot);
        }
    });
});

describe('y forjado de verdad', () => {
    test('pedir un arma da un arma, con su dado y su alcance', () => {
        for (const item of forge('weapon')) {
            expect(item.type).toBe('weapon');
            expect(item.damageDice).not.toBe('');
            expect(item.hands).toBeGreaterThanOrEqual(1);
        }
    });

    test('pedir una armadura da algo que protege', () => {
        for (const item of forge('armor')) {
            expect(item.type).toBe('armor');
            expect(item.armorClass).toBeGreaterThan(0);
        }
    });

    // Sin esto, una placa completa y un jubón se leían igual: un nombre y unos kilos.
    test('lo que se lee dice lo que importa', () => {
        const dicho = forge('armor').map(describeItem).join(' | ');
        expect(dicho).toMatch(/CA \d+/);
        const armas2 = forge('weapon').map(describeItem).join(' | ');
        expect(armas2).toMatch(/\d+d\d+/);
        expect(`${dicho} ${armas2}`).not.toMatch(/undefined|NaN/);
    });

    // «Grebas de cuero adornada» lo escribe una máquina.
    test('el adjetivo va en plural detrás de lo que es plural', () => {
        const muchas = forgeItems({
            compendium: real(), howMany: 40, itemType: 'armor', properties: 1,
            random: createSeededRandom('plural'),
        }).map(item => item.name);

        const plurales = muchas.filter(n => /^(Botas|Grebas|Pieles|Guanteletes)/.test(n));
        expect(plurales.length).toBeGreaterThan(0);
        // Las propiedades que acaban en sustantivo —«de viaje», «del vado»— no llevan
        // adjetivo que concordar; las que sí lo llevan tienen que acabar en s.
        const conAdjetivo = plurales.filter(n => !/ (de|del) [a-záéíóú]+$/i.test(n));
        expect(conAdjetivo.length).toBeGreaterThan(0);
        for (const name of conAdjetivo) {
            expect(name.split(' ').pop()).toMatch(/s$/);
        }
    });

    // Un arco de piedra no se dobla; y eso lo dice el archivo, no el código.
    test('un material puede decir para qué categorías sirve', () => {
        const arcos = forgeItems({
            compendium: real(), howMany: 30, itemType: 'weapon', category: 'distancia',
            random: createSeededRandom('arcos'),
        });
        expect(arcos.length).toBeGreaterThan(0);
        for (const arco of arcos) {
            expect(arco.from.material).not.toBe('material-piedra');
            expect(arco.from.material).not.toBe('material-obsidiana');
        }
    });
});
