import fs from 'node:fs';
import { describe, test, expect } from '@jest/globals';
import {
    DOMAINS, validateBattery, matches, pickWeighted, createCompendium, loadCompendium,
} from '../public/scripts/game-engine/compendio/compendio.js';

/** Un azar que va diciendo lo que le mandes, para que una prueba sea una prueba. */
const fixed = (...values) => {
    let i = 0;
    return () => values[Math.min(i++, values.length - 1)];
};

const battery = (rows) => ({ version: 1, domain: 'armas', rows });

const row = (extra = {}) => ({ id: 'espada-corta', name: 'Espada corta', ...extra });

describe('lo que impide usar una batería', () => {
    // El dolor de una biblioteca no es que sea lenta: es una errata que hace que no salga
    // nada y no sepas por qué. Por eso cada problema lleva archivo y número de fila.
    test('un error dice el archivo y la fila, que es lo único que sirve', () => {
        const [message] = validateBattery('armas', battery([{ name: 'Sin id' }]));
        expect(message).toMatch(/armas\.json, fila 1/);
        expect(message).toMatch(/id/);
    });

    test('se dicen todos de una vez, no el primero', () => {
        const errors = validateBattery('armas', battery([{}, {}, {}]));
        expect(errors.length).toBeGreaterThanOrEqual(6);
    });

    test('un id repetido se caza, porque es como se pierde una fila', () => {
        const errors = validateBattery('armas', battery([row(), row()]));
        expect(errors.join(' ')).toMatch(/ya estaba usado/);
    });

    test('y un id con mayúsculas o espacios, porque se referencia a mano', () => {
        expect(validateBattery('armas', battery([row({ id: 'Espada Corta' })])).join(' '))
            .toMatch(/minusculas/);
    });

    test('un peso negativo no es un peso', () => {
        expect(validateBattery('armas', battery([row({ weight: -3 })])).join(' '))
            .toMatch(/negativo/);
    });

    test('un archivo guardado con el nombre de otro dominio se dice', () => {
        expect(validateBattery('armas', { domain: 'bestiario', rows: [] }).join(' '))
            .toMatch(/dice ser de "bestiario"/);
    });

    test('y una batería correcta no tiene nada que decir', () => {
        expect(validateBattery('armas', battery([row({ weight: 5, tags: ['hoja'] })]))).toEqual([]);
    });
});

describe('si una fila sirve para lo que se pide', () => {
    test('quien no dice nada, vale: sin región, sale en cualquiera', () => {
        expect(matches({ id: 'a', when: {} }, { region: 'norte' })).toBe(true);
    });

    // Escribir dos veces lo mismo es como se escriben archivos que se contradicen.
    test('los campos propios de la fila filtran solos, sin repetirlos en `when`', () => {
        expect(matches({ kind: 'person', when: {} }, { kind: 'person' })).toBe(true);
        expect(matches({ kind: 'person', when: {} }, { kind: 'place' })).toBe(false);
    });

    test('una lista es un conjunto', () => {
        const r = { when: { region: ['norte', 'montana'] } };
        expect(matches(r, { region: 'norte' })).toBe(true);
        expect(matches(r, { region: 'desierto' })).toBe(false);
    });

    test('y un asterisco vale para todo', () => {
        expect(matches({ when: { region: '*' } }, { region: 'lo que sea' })).toBe(true);
        expect(matches({ when: { region: ['norte', '*'] } }, { region: 'desierto' })).toBe(true);
    });

    test('dos números son un rango cuando se pregunta con un número', () => {
        const r = { when: { level: [3, 7] } };
        expect(matches(r, { level: 5 })).toBe(true);
        expect(matches(r, { level: 9 })).toBe(false);
    });

    test('preguntar por nada no filtra nada', () => {
        expect(matches({ when: { region: 'norte' } }, { region: '' })).toBe(true);
    });
});

describe('sortear por peso', () => {
    test('el peso manda: el doble sale el doble', () => {
        const rows = [{ id: 'a', weight: 1 }, { id: 'b', weight: 3 }];
        expect(pickWeighted(rows, () => 0.1).id).toBe('a');
        expect(pickWeighted(rows, () => 0.5).id).toBe('b');
    });

    // Cero no es "poco probable", es "nunca sola": se pide por id y punto.
    test('peso cero no sale nunca', () => {
        const rows = [{ id: 'a', weight: 0 }, { id: 'b', weight: 1 }];
        for (const r of [0, 0.25, 0.5, 0.99]) expect(pickWeighted(rows, () => r).id).toBe('b');
    });

    test('y si no hay nada con peso, no hay nada', () => {
        expect(pickWeighted([{ id: 'a', weight: 0 }], () => 0.5)).toBe(null);
    });
});

describe('la biblioteca cargada', () => {
    const c = () => createCompendium({
        armas: [
            { id: 'daga', name: 'Daga', when: { region: 'norte' } },
            { id: 'hacha', name: 'Hacha', when: { region: 'norte' } },
            { id: 'lanza', name: 'Lanza', when: { region: 'valle' } },
        ],
    });

    test('dice lo que tiene y lo que no', () => {
        const lib = c();
        expect(lib.has('armas')).toBe(true);
        expect(lib.has('bestiario')).toBe(false);
        expect(lib.count('armas')).toBe(3);
        expect(lib.count('bestiario')).toBe(0);
    });

    test('y lo que falta por escribir, que es media lista de tareas', () => {
        // El ejemplo de aquí trae armas, así que ésa ya no falta: es justo lo que
        // `missing()` tiene que decir.
        expect(c().missing()).toEqual(DOMAINS.filter(d => d !== 'armas'));
        expect(createCompendium({ nombres: [] }).missing())
            .toEqual(DOMAINS.filter(d => d !== 'nombres'));
    });

    test('se busca por id, que es como se referencian entre baterías', () => {
        expect(c().byId('armas', 'daga').name).toBe('Daga');
        expect(c().byId('armas', 'no-existe')).toBe(null);
    });

    test('el filtro se aplica al sortear', () => {
        const chosen = c().pick('armas', { where: { region: 'valle' }, random: () => 0.5 });
        expect(chosen.id).toBe('lanza');
    });

    // Quien llama tiene que aguantar un null: es la regla que permite que falte una batería.
    test('pedir de una batería que no está devuelve null, no revienta', () => {
        expect(c().pick('bestiario', { random: () => 0.5 })).toBe(null);
        expect(c().take('bestiario', 3, { random: () => 0.5 })).toEqual([]);
    });

    test('pedir varias no repite ninguna: es una bolsa, no cinco tiradas', () => {
        const out = c().take('armas', 3, { random: fixed(0.1, 0.9, 0.5) });
        expect(new Set(out.map(r => r.id)).size).toBe(3);
    });

    test('y no da más de las que hay', () => {
        expect(c().take('armas', 10, { random: () => 0.5 })).toHaveLength(3);
    });
});

describe('no repetirse', () => {
    const lib = () => createCompendium({
        armas: [
            { id: 'a', name: 'A' }, { id: 'b', name: 'B' },
            { id: 'c', name: 'C' }, { id: 'd', name: 'D' },
            { id: 'e', name: 'E' }, { id: 'f', name: 'F' },
        ],
    }, { memory: 3 });

    test('lo que acaba de salir se aparta', () => {
        const c = lib();
        const first = c.pick('armas', { random: () => 0 }).id;
        const second = c.pick('armas', { random: () => 0 }).id;
        expect(second).not.toBe(first);
    });

    // Si el dominio es más corto que la memoria, manda tener algo.
    test('pero antes que no salir nada, se repite', () => {
        const c = createCompendium({ armas: [{ id: 'unica', name: 'Única' }] }, { memory: 3 });
        expect(c.pick('armas', { random: () => 0 }).id).toBe('unica');
        expect(c.pick('armas', { random: () => 0 }).id).toBe('unica');
    });

    test('y se puede olvidar, que es lo que hace el botón de probar', () => {
        const c = lib();
        const first = c.pick('armas', { random: () => 0 }).id;
        c.forget();
        expect(c.pick('armas', { random: () => 0 }).id).toBe(first);
    });
});

describe('cargar lo que exista', () => {
    const read = (files) => async (domain) => (domain in files ? files[domain] : null);
    const twoDomains = ['armas', 'bestiario'];

    // Sin `armas.json` el botín funciona como siempre. Es lo que permite ir una por tarde.
    test('una batería que falta no es un error', async () => {
        const { compendium, errors, loaded } = await loadCompendium({
            read: read({ armas: battery([row()]) }),
            domains: twoDomains,
        });
        expect(errors).toEqual([]);
        expect(loaded).toEqual(['armas']);
        expect(compendium.has('bestiario')).toBe(false);
    });

    // Entrar a medias es como sale un mundo con la mitad de las armas y nadie sabe por qué.
    test('una batería rota no entra a medias: no entra', async () => {
        const { compendium, errors } = await loadCompendium({
            read: read({ armas: battery([row(), { name: 'sin id' }]) }),
            domains: twoDomains,
        });
        expect(errors.join(' ')).toMatch(/fila 2/);
        expect(compendium.has('armas')).toBe(false);
    });

    test('un archivo que revienta al leerse se cuenta y no tumba el resto', async () => {
        const { compendium, errors } = await loadCompendium({
            read: async (domain) => {
                if (domain === 'armas') throw new Error('disco');
                if (domain === 'nombres') return { version: 1, domain: 'nombres', rows: [row()] };
                return null;
            },
            domains: ['armas', 'nombres'],
        });
        expect(errors.join(' ')).toMatch(/armas\.json/);
        expect(compendium.has('nombres')).toBe(true);
    });

    test('los problemas se pueden escuchar, para enseñarlos donde toque', async () => {
        const heard = [];
        await loadCompendium({
            read: read({ armas: battery([{ name: 'sin id' }]) }),
            domains: twoDomains,
            warn: (m) => heard.push(m),
        });
        expect(heard.join(' ')).toMatch(/armas\.json, fila 1/);
    });
});

describe('la batería que viene escrita', () => {
    const data = JSON.parse(fs.readFileSync(
        new URL('../public/compendio/nombres.json', import.meta.url), 'utf8',
    ));

    // Esta es la prueba que caza una errata en el archivo, que es lo que de verdad va a
    // pasar cuando se escriban cincuenta filas a mano.
    test('nombres.json pasa su propia validación', () => {
        expect(validateBattery('nombres', data)).toEqual([]);
    });

    test('trae las cuatro culturas y los tres tipos de sitio', () => {
        const kinds = new Set(data.rows.map(r => r.kind));
        expect(kinds).toEqual(new Set(['person', 'place', 'tavern', 'nickname']));
        expect(data.rows.filter(r => r.kind === 'person')).toHaveLength(4);
    });

    test('y ninguna plantilla pide un trozo que no existe', () => {
        for (const r of data.rows) {
            for (const pattern of r.patterns) {
                for (const [, key] of pattern.matchAll(/\{([a-z0-9_]+)\}/gi)) {
                    expect(Array.isArray(r.parts[key])).toBe(true);
                    expect(r.parts[key].length).toBeGreaterThan(0);
                }
            }
        }
    });
});
