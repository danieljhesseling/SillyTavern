import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { narrate, fill, rememberUsed, listNames, daysText, MOMENTS } from '../public/scripts/game-engine/campaign/engine-narrator.js';
import { validateBattery } from '../public/scripts/game-engine/compendio/compendio.js';

const bank = JSON.parse(readFileSync(new URL('../public/compendio/frases.json', import.meta.url), 'utf8'));
const rows = bank.rows;
/** Un azar fijo que se puede repetir. */
const seeded = (seed = 1) => {
    let s = seed;
    return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
};

describe('el narrador del motor (Z1 de ROADMAP_SIN_TOKENS)', () => {
    test('el banco de frases es válido y cubre todos los momentos', () => {
        expect(validateBattery('frases', bank)).toEqual([]);
        const kinds = new Set(rows.map((/** @type {any} */ r) => r.kind));
        for (const parts of Object.values(MOMENTS)) {
            // La primera parte de cada momento siempre tiene frases: es lo que se cuenta seguro.
            expect(kinds.has(parts[0])).toBe(true);
        }
    });

    test('rellenar: con todos los huecos sale la frase; con uno vacío, no', () => {
        expect(fill('Llegáis a {sitio}.', { sitio: 'El Pueblo de Barro' })).toBe('Llegáis a El Pueblo de Barro.');
        expect(fill('Por aquí anda {gente}.', { gente: '' })).toBeNull();
        expect(fill('{sitio} sale de la niebla.', { sitio: 'el molino' })).toBe('El molino sale de la niebla.');
    });

    test('una llegada de noche con lluvia, la primera vez, con gente y algo pendiente', () => {
        const facts = {
            sitio: 'El Pueblo de Barro', hora: 'noche', tiempo: 'lluvia', primera: 'sí',
            descripcion: 'Un amasijo de cabañas de madera podrida hundiéndose en el fango.',
            gente: 'Giles y Marta', gente_n: 2, gancho: 'hay dos encargos en el tablón',
        };
        const { text, used } = narrate({ rows, moment: 'llegada', facts, random: seeded(7) });
        expect(text).toMatch(/El Pueblo de Barro/);
        expect(text).toMatch(/Un amasijo de cabañas/);
        expect(text).toMatch(/Giles y Marta/);
        expect(text).toMatch(/dos encargos en el tablón/);
        expect(used).toHaveLength(4);
        // Nunca una frase de mañana, de nieve o de vuelta.
        expect(used.some(id => /manana|nieve|vuelta/.test(id))).toBe(false);
    });

    test('sin gente ni nada pendiente, esas partes se saltan', () => {
        const { text, used } = narrate({ rows, moment: 'llegada', facts: { sitio: 'La atalaya', hora: 'tarde', primera: 'no' }, random: seeded(3) });
        expect(used).toHaveLength(2);
        expect(text).not.toMatch(/\{|\}/);
    });

    test('un día de camino no dice «días»; tres, sí', () => {
        const one = narrate({ rows, moment: 'viaje', facts: { destino: 'Vane', dias: 1, dias_texto: daysText(1) }, random: seeded(5) }).text;
        const three = narrate({ rows, moment: 'viaje', facts: { destino: 'Vane', dias: 3, dias_texto: daysText(3) }, random: seeded(5) }).text;
        expect(one).toMatch(/Vane/);
        expect(three).toMatch(/Tres días/);
    });

    test('no repite frase mientras haya otra', () => {
        const facts = { sitio: 'El Pueblo de Barro', hora: 'mañana', primera: 'no' };
        let recent = /** @type {string[]} */ ([]);
        const firsts = [];
        for (let i = 0; i < 4; i++) {
            const out = narrate({ rows, moment: 'llegada', facts, random: seeded(11 + i), recent });
            firsts.push(out.used[0]);
            recent = rememberUsed(recent, out.used);
        }
        // Hay muchas frases de llegada por la mañana: las cuatro primeras no se repiten.
        expect(new Set(firsts).size).toBe(4);
    });

    test('J13.2: diez llegadas seguidas, con su viaje y lo de entre medias, sin una frase repetida', () => {
        // El caso más estrecho: siempre por la mañana, con buen tiempo, de vuelta y con una
        // sola persona a la vista. Entre llegada y llegada, tiradas y charlas gastan memoria.
        const arrival = { sitio: 'Vane', hora: 'mañana', tiempo: 'despejado', primera: 'no', gente: 'Giles', gente_n: 1, gancho: 'hay un encargo en el tablón' };
        const road = { destino: 'Vane', dias: 1, dias_texto: daysText(1), tiempo: 'despejado', sucesos: 'una rueda se parte.' };
        let recent = /** @type {string[]} */ ([]);
        const said = /** @type {string[]} */ ([]);
        const between = /** @type {Array<[string, any]>} */ ([
            ['tirada-bien', { quien: 'Bran', habilidad: 'perception' }],
            ['charla-vosotros', { quien: 'Giles', actitud: 'neutra', actitud_texto: 'neutral' }],
        ]);
        const trip = /** @type {Array<[string, any]>} */ ([['viaje', road], ['llegada', arrival]]);
        for (let i = 0; i < 10; i++) {
            for (const [moment, facts] of between) recent = rememberUsed(recent, narrate({ rows, moment, facts, random: seeded(101 + i), recent }).used);
            for (const [moment, facts] of trip) {
                const out = narrate({ rows, moment, facts, random: seeded(201 + i), recent });
                said.push(...out.used);
                recent = rememberUsed(recent, out.used);
            }
        }
        expect(said).toHaveLength(60);
        expect(new Set(said).size).toBe(60);
    });

    test('cuando ya salieron todas, vuelve una de las que salieron hace más, nunca la última', () => {
        const three = ['a', 'b', 'c'].map(id => ({ id, kind: 'llegada', weight: 1, text: `${id} en {sitio}.` }));
        for (const r of [0, 0.5, 0.99]) {
            const out = narrate({ rows: three, moment: 'llegada', facts: { sitio: 'Vane' }, random: () => r, recent: ['a', 'b', 'c'] });
            expect(['a', 'b']).toContain(out.used[0]);
        }
        // Y una que no ha salido va antes que cualquiera que sí.
        expect(narrate({ rows: three, moment: 'llegada', facts: { sitio: 'Vane' }, random: () => 0.99, recent: ['c', 'a'] }).used).toEqual(['b']);
    });

    test('la memoria guarda cada frase una vez, en el sitio de la última vez', () => {
        expect(rememberUsed(['a', 'b', 'c'], ['a'])).toEqual(['b', 'c', 'a']);
        expect(rememberUsed(null, ['x', 'x'])).toEqual(['x']);
        const many = Array.from({ length: 300 }, (_, i) => `f${i}`);
        const kept = rememberUsed(many, ['nueva']);
        expect(kept.length).toBeLessThanOrEqual(200);
        expect(kept[kept.length - 1]).toBe('nueva');
    });

    test('J13.4: cada parte de cada momento tiene al menos ocho frases', () => {
        for (const part of new Set(Object.values(MOMENTS).flat())) {
            expect([part, rows.filter((/** @type {any} */ r) => r.kind === part).length >= 8]).toEqual([part, true]);
        }
    });

    test('una frase de una voz solo sale con esa voz', () => {
        // Solo dos frases de llegada: la neutra y la del cronista.
        const bankWithVoice = [
            { id: 'llegada-neutra', kind: 'llegada', weight: 1, text: 'Llegáis a {sitio}.' },
            { id: 'llegada-cronista', kind: 'llegada', weight: 1, when: { voz: 'cronista' }, text: 'Anoto: {sitio}.' },
        ];
        const cronista = new Set([0.1, 0.9].map(r => narrate({ rows: bankWithVoice, moment: 'llegada', facts: { sitio: 'Vane', voz: 'cronista' }, random: () => r }).text));
        expect(cronista).toEqual(new Set(['Llegáis a Vane.', 'Anoto: Vane.']));
        const posadera = new Set([0.1, 0.9].map(r => narrate({ rows: bankWithVoice, moment: 'llegada', facts: { sitio: 'Vane', voz: 'posadera' }, random: () => r }).text));
        expect(posadera).toEqual(new Set(['Llegáis a Vane.']));
    });

    test('nombres y días, en castellano', () => {
        expect(listNames(['Giles'])).toBe('Giles');
        expect(listNames(['Giles', 'Marta', 'Karl'])).toBe('Giles, Marta y Karl');
        expect(daysText(1)).toBe('Un día');
        expect(daysText(12)).toBe('12 días');
    });
});
