import fs from 'node:fs';
import { describe, test, expect } from '@jest/globals';
import { createCompendium, validateBattery } from '../public/scripts/game-engine/compendio/compendio.js';
import {
    CAUSES, DISEASE_SLOT, asInjury, injuryTableFor, causesOf,
    catchDisease, stageInjury, advanceDisease, describeDisease,
} from '../public/scripts/game-engine/compendio/ailments.js';
import { rollInjury, applyInjury } from '../public/scripts/game-engine/rules/injuries.js';

const estados = JSON.parse(fs.readFileSync(
    new URL('../public/compendio/estados.json', import.meta.url), 'utf8',
));
const of = (kind) => estados.rows.filter(r => r.kind === kind);

const real = () => createCompendium({ estados: estados.rows });

/** Un azar repetible. */
const rolling = (seed) => {
    let state = seed;
    return () => ((state = (state * 9301 + 49297) % 233280) / 233280);
};

/** Las que el motor sabe escribir encima de una ficha. */
const STATS = ['speed', 'maxHp', 'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

describe('la batería de estados', () => {
    test('estados.json pasa su propia validación', () => {
        expect(validateBattery('estados', estados)).toEqual([]);
    });

    test('trae heridas y enfermedades', () => {
        expect(new Set(estados.rows.map(r => r.kind))).toEqual(new Set(['herida', 'enfermedad']));
    });

    // Caerse por un pozo y salir de un incendio no dejan lo mismo.
    test('cada herida dice de qué viene, y son causas que el motor distingue', () => {
        for (const injury of of('herida')) expect(CAUSES).toContain(injury.cause);
    });

    // Los modificadores se escriben encima de la ficha: un nombre que nadie lee es una
    // herida que no duele.
    test('y toca algo que el motor lee de verdad', () => {
        for (const injury of of('herida')) {
            const touched = Object.keys(injury.modifiers ?? {});
            expect(touched.length).toBeGreaterThan(0);
            for (const stat of touched) expect(STATS).toContain(stat);
        }
    });

    test('y todas restan, porque una herida que sume no es una herida', () => {
        for (const injury of of('herida')) {
            for (const amount of Object.values(injury.modifiers ?? {})) {
                expect(amount).toBeLessThan(0);
            }
        }
    });

    // El orden ES el contrato: rollInjury indexa por posición.
    test('cada causa va de lo leve a lo grave', () => {
        for (const cause of causesOf(real())) {
            const table = injuryTableFor(real(), cause);
            expect(table.length).toBeGreaterThanOrEqual(4);
            // Lo permanente va al final: nada con días después de algo sin ellos.
            const firstPermanent = table.findIndex(row => row.days === 0);
            if (firstPermanent >= 0) {
                for (let i = firstPermanent; i < table.length; i++) expect(table[i].days).toBe(0);
            }
        }
    });

    test('toda causa tiene al menos una que no se va', () => {
        for (const cause of causesOf(real())) {
            expect(injuryTableFor(real(), cause).some(row => row.days === 0)).toBe(true);
        }
    });

    // Tres etapas con un plazo son una carrera; un número que baja es aritmética.
    test('cada enfermedad tiene tres etapas, con su nota', () => {
        for (const disease of of('enfermedad')) {
            expect(disease.stages).toHaveLength(3);
            for (const stage of disease.stages) {
                expect(String(stage.label).length).toBeGreaterThan(3);
                expect(String(stage.note).length).toBeGreaterThan(20);
            }
        }
    });

    test('y empeoran: la última etapa duele más que la primera', () => {
        const weight = (stage) => Object.values(stage.modifiers ?? {})
            .reduce((sum, value) => sum + Math.abs(Number(value)), 0);
        for (const disease of of('enfermedad')) {
            expect(weight(disease.stages[2])).toBeGreaterThan(weight(disease.stages[0]));
        }
    });

    test('y dicen cómo se cogen', () => {
        for (const disease of of('enfermedad')) {
            expect(String(disease.catch || '').length).toBeGreaterThan(15);
        }
    });
});

describe('la tabla de una causa', () => {
    test('sale con la forma que el motor espera', () => {
        const [first] = injuryTableFor(real(), 'fuego');
        expect(Object.keys(first).sort()).toEqual(['days', 'description', 'id', 'label', 'modifiers']);
    });

    // El fuego no rompe tobillos.
    test('y solo trae lo de esa causa', () => {
        const byId = new Map(estados.rows.map(r => [r.id, r]));
        for (const cause of causesOf(real())) {
            for (const row of injuryTableFor(real(), cause)) {
                expect(byId.get(row.id).cause).toBe(cause);
            }
        }
    });

    // Sin batería el motor usa la suya: aditivo, como todo el compendio.
    test('sin batería no hay tabla, y quien llama usa la de siempre', () => {
        expect(injuryTableFor(createCompendium({}), 'fuego')).toEqual([]);
    });

    test('una causa que nadie escribió tampoco inventa nada', () => {
        expect(injuryTableFor(real(), 'maldicion')).toEqual([]);
    });

    // Lo que de verdad importa: que la causa cambie lo que te pasa.
    test('la misma tirada da heridas distintas según de qué venga', () => {
        const fuego = rollInjury(() => 0.9, { table: injuryTableFor(real(), 'fuego') });
        const frio = rollInjury(() => 0.9, { table: injuryTableFor(real(), 'frio') });
        expect(fuego.label).not.toBe(frio.label);
    });

    test('y lo que sale se puede aplicar a una ficha tal cual', () => {
        const member = {
            name: 'Bruna', speed: 30, maxHp: 24,
            strength: 12, dexterity: 14, constitution: 13,
            intelligence: 10, wisdom: 12, charisma: 11,
        };
        const injury = rollInjury(() => 0.5, { table: injuryTableFor(real(), 'caida') });
        const patch = applyInjury(member, injury);
        for (const [stat, amount] of Object.entries(injury.modifiers)) {
            expect(patch.stats[stat]).toBeLessThan(patch.baseStats[stat]);
            expect(amount).toBeLessThan(0);
        }
    });
});

describe('coger una enfermedad', () => {
    test('sin batería no se coge nada, y no revienta', () => {
        expect(catchDisease(createCompendium({}), { random: () => 0.5 })).toBe(null);
    });

    test('se empieza por la primera etapa', () => {
        const caught = catchDisease(real(), { random: rolling(7) });
        expect(caught.stage).toBe(0);
        expect(caught.injury.label).toContain(caught.disease.stages[0].label);
    });

    test('se puede pedir una de un sitio', () => {
        const caught = catchDisease(real(), { tag: 'pantano', random: rolling(11) });
        expect(caught.disease.tags).toContain('pantano');
    });

    test('y un sitio sin enfermedades propias no te deja sin ninguna', () => {
        expect(catchDisease(real(), { tag: 'luna', random: rolling(13) })).not.toBe(null);
    });

    // Una sola cosa que empeora a alguien, y `baseStats` con un único dueño.
    test('viaja con un solo id, así que no se acumulan tres gripes', () => {
        for (const disease of of('enfermedad')) {
            for (let stage = 0; stage < 3; stage++) {
                expect(stageInjury(disease, stage).id).toBe(DISEASE_SLOT);
            }
        }
    });

    test('una etapa que no existe se recorta a la que sí', () => {
        const disease = of('enfermedad')[0];
        expect(stageInjury(disease, 99).label).toContain(disease.stages[2].label);
        expect(stageInjury(disease, -5).label).toContain(disease.stages[0].label);
    });
});

describe('el curso de una enfermedad', () => {
    const disease = () => of('enfermedad').find(d => d.id === 'enf-fiebre');

    test('sin cuidados tiende a empeorar', () => {
        let stage = 0;
        for (let day = 0; day < 6; day++) {
            stage = advanceDisease({ disease: disease(), stage, random: () => 0.1 }).stage;
        }
        expect(stage).toBe(2);
    });

    // Cuidarla no la cura: hace que gane la resistencia más veces.
    test('cuidarla la hace remitir, y desde la primera etapa se va del todo', () => {
        const step = advanceDisease({ disease: disease(), stage: 0, random: () => 0.99, tended: true });
        expect(step.done).toBe(true);
        expect(step.injury).toBe(null);
        expect(step.reason).toMatch(/se le pasa/);
    });

    test('y desde la última se baja un escalón, no se cura de golpe', () => {
        const step = advanceDisease({ disease: disease(), stage: 2, random: () => 0.99, tended: true });
        expect(step.done).toBe(false);
        expect(step.stage).toBe(1);
    });

    // Lo que el narrador tiene que contar, dicho una sola vez y en un sitio.
    test('cada día dice qué ha pasado', () => {
        const step = advanceDisease({ disease: disease(), stage: 1, random: () => 0.5 });
        expect(step.reason).toContain(disease().name);
        expect(step.reason.length).toBeGreaterThan(20);
    });

    test('la misma semilla da el mismo curso', () => {
        const once = advanceDisease({ disease: disease(), stage: 0, days: 5, random: rolling(42) });
        const twice = advanceDisease({ disease: disease(), stage: 0, days: 5, random: rolling(42) });
        expect(once).toEqual(twice);
    });
});

describe('contada en una línea', () => {
    test('dice cuál es y por dónde va', () => {
        const disease = of('enfermedad')[0];
        expect(describeDisease(disease, 1))
            .toBe(`${disease.name} · ${disease.stages[1].label} · etapa 2 de 3`);
    });

    test('y sin enfermedad, nada', () => {
        expect(describeDisease(null, 0)).toBe('');
    });
});

describe('leer una fila como herida', () => {
    test('se traduce a lo que el motor espera', () => {
        expect(asInjury({ id: 'x', name: 'Corte', note: 'Sangra.', modifiers: { maxHp: -3 }, days: 7 }))
            .toEqual({ id: 'x', label: 'Corte', description: 'Sangra.', modifiers: { maxHp: -3 }, days: 7 });
    });

    test('y lo que falte no la rompe', () => {
        const injury = asInjury({});
        expect(injury.days).toBe(0);
        expect(injury.modifiers).toEqual({});
    });
});
