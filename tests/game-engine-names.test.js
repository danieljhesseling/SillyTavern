import fs from 'node:fs';
import { describe, test, expect } from '@jest/globals';
import { createCompendium } from '../public/scripts/game-engine/compendio/compendio.js';
import {
    NAME_KINDS, fillPattern, nameFromRow, makeName, makeNames, culturesOf,
} from '../public/scripts/game-engine/compendio/names.js';

const nombres = JSON.parse(fs.readFileSync(
    new URL('../public/compendio/nombres.json', import.meta.url), 'utf8',
));

/** La biblioteca de verdad, la que viene escrita. */
const real = (config) => createCompendium({ nombres: nombres.rows }, config);

/** Un azar que va diciendo lo que le mandes. */
const fixed = (...values) => {
    let i = 0;
    return () => values[Math.min(i++, values.length - 1)];
};

describe('rellenar una plantilla', () => {
    const parts = { inicio: ['Bran'], fin: ['dar', 'vik'] };

    test('un hueco se cambia por uno de sus trozos', () => {
        expect(fillPattern('{inicio}{fin}', parts, () => 0)).toBe('Brandar');
        expect(fillPattern('{inicio}{fin}', parts, () => 0.9)).toBe('Branvik');
    });

    test('el texto de alrededor se queda como está', () => {
        expect(fillPattern('El {inicio} del monte', parts, () => 0)).toBe('El Bran del monte');
    });

    // Verlo en pantalla dice exactamente qué falta; un nombre a medias no dice nada.
    test('un hueco que no existe se deja con sus llaves, para que se vea', () => {
        expect(fillPattern('{inicio}{noexiste}', parts, () => 0)).toBe('Bran{noexiste}');
    });

    test('una plantilla vacía da vacío', () => {
        expect(fillPattern('', parts, () => 0)).toBe('');
    });
});

describe('un nombre de una fila', () => {
    const row = {
        id: 'x', name: 'X',
        parts: { a: ['Bran'], b: ['dar'] },
        patterns: ['{a}{b}'],
    };

    test('sale de su plantilla', () => {
        expect(nameFromRow(row, () => 0)).toBe('Brandar');
    });

    test('sin plantillas no hay nombre', () => {
        expect(nameFromRow({ ...row, patterns: [] }, () => 0)).toBe('');
    });

    test('y los espacios de sobra se recogen', () => {
        const spaced = { parts: { a: ['Vado'], b: ['Sauce'] }, patterns: ['{a}   del   {b}'] };
        expect(nameFromRow(spaced, () => 0)).toBe('Vado del Sauce');
    });
});

describe('pedirle un nombre al compendio', () => {
    // Vacío no es un error: es la batería que todavía no has escrito, y quien llama sigue
    // con lo que hiciera antes. Es la regla que permite ir una batería por tarde.
    test('sin batería de nombres devuelve vacío, y no revienta', () => {
        const empty = createCompendium({});
        expect(makeName({ compendium: empty, random: () => 0 })).toBe('');
        expect(makeNames({ compendium: empty, howMany: 3, random: () => 0 })).toEqual([]);
    });

    test('con ella sale algo, y es texto', () => {
        const name = makeName({ compendium: real(), random: fixed(0.1, 0.3, 0.7) });
        expect(name.length).toBeGreaterThan(1);
        expect(name).not.toMatch(/[{}]/);
    });

    test('la misma semilla da el mismo nombre: es reproducible', () => {
        const once = makeName({ compendium: real(), random: fixed(0.42, 0.13, 0.77) });
        const twice = makeName({ compendium: real(), random: fixed(0.42, 0.13, 0.77) });
        expect(once).toBe(twice);
    });

    test('pedir un sitio no devuelve una persona', () => {
        const place = makeName({ compendium: real(), kind: 'place', random: fixed(0.2, 0.4, 0.6) });
        expect(place).toMatch(/ de(l)? /);
    });

    test('y una taberna empieza por El o La, que es lo que hacen las tabernas', () => {
        const tavern = makeName({ compendium: real(), kind: 'tavern', random: fixed(0.2, 0.5, 0.8) });
        expect(tavern).toMatch(/^(El|La) /);
    });

    // Un mundo con una cultura sin escribir sigue teniendo gente.
    test('una cultura que no existe no te deja sin nombre', () => {
        const name = makeName({ compendium: real(), culture: 'atlantida', random: fixed(0.3, 0.5) });
        expect(name.length).toBeGreaterThan(1);
    });

    test('y una que existe manda', () => {
        const lib = real();
        const rows = lib.find('nombres', { kind: 'person', culture: 'norte' });
        expect(rows).toHaveLength(1);
        expect(rows[0].id).toBe('personas-norte');
    });

    test('lo que ya está cogido no se repite', () => {
        const lib = real({ memory: 0 });
        const first = makeName({ compendium: lib, random: fixed(0.1, 0.1, 0.1) });
        const second = makeName({
            compendium: lib, random: fixed(0.1, 0.1, 0.1, 0.9, 0.9, 0.9), taken: [first],
        });
        expect(second).not.toBe(first);
    });
});

describe('un pueblo entero', () => {
    test('diez personas son diez nombres distintos', () => {
        let seed = 0;
        const names = makeNames({
            compendium: real(), howMany: 10, random: () => ((seed = (seed * 9301 + 49297) % 233280) / 233280),
        });
        expect(names).toHaveLength(10);
        expect(new Set(names).size).toBe(10);
    });

    test('y pedir cero no da ninguno', () => {
        expect(makeNames({ compendium: real(), howMany: 0, random: () => 0.5 })).toEqual([]);
    });
});

describe('lo que la batería ofrece', () => {
    test('las culturas se pueden listar, para poder elegirlas', () => {
        expect(culturesOf(real()).sort()).toEqual(['arena', 'bosque', 'norte', 'valle']);
    });

    test('sin batería, ninguna', () => {
        expect(culturesOf(createCompendium({}))).toEqual([]);
    });

    test('los tipos que el motor conoce son los que la batería usa', () => {
        const kinds = new Set(nombres.rows.map(r => r.kind));
        for (const kind of kinds) expect(NAME_KINDS).toContain(kind);
    });
});
