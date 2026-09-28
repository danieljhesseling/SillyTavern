import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { outcomeOf, consequence, CONSEQUENCES } from '../public/scripts/game-engine/campaign/consequences.js';
import { narrate } from '../public/scripts/game-engine/campaign/engine-narrator.js';
import { SKILLS } from '../public/scripts/game-engine/rules/checks.js';

const rows = JSON.parse(readFileSync(new URL('../public/compendio/frases.json', import.meta.url), 'utf8')).rows;

describe('las tiradas con consecuencia (Z3 de ROADMAP_SIN_TOKENS)', () => {
    test('bien, a medias o mal: a medias es fallar por tres o menos, sin un 1', () => {
        expect(outcomeOf({ success: true, total: 14, dc: 12, natural: 10 })).toBe('bien');
        expect(outcomeOf({ success: false, total: 10, dc: 12, natural: 8 })).toBe('medias');
        expect(outcomeOf({ success: false, total: 9, dc: 12, natural: 7 })).toBe('medias');
        expect(outcomeOf({ success: false, total: 8, dc: 12, natural: 6 })).toBe('mal');
        expect(outcomeOf({ success: false, total: 11, dc: 12, natural: 1 })).toBe('mal');
    });

    test('cada habilidad tiene sus tres resultados', () => {
        expect(Object.keys(CONSEQUENCES).sort()).toEqual(Object.keys(SKILLS).sort());
    });

    test('lo que se gana, lo primero que se pueda: si no hay pista, un rumor; si no, monedas', () => {
        expect(consequence({ skill: 'perception', outcome: 'bien' })).toEqual([{ kind: 'pista' }]);
        expect(consequence({ skill: 'perception', outcome: 'bien', can: { pista: false } })).toEqual([{ kind: 'rumor' }]);
        expect(consequence({ skill: 'perception', outcome: 'bien', can: { pista: false, rumor: false } })).toEqual([{ kind: 'oro', amount: '1d4' }]);
        // Ya se sacó lo de aquí hoy: la tirada sale, pero no da más.
        expect(consequence({ skill: 'perception', outcome: 'bien', can: { pista: false, rumor: false, oro: false } })).toEqual([]);
    });

    test('a medias se gana y se paga', () => {
        expect(consequence({ skill: 'survival', outcome: 'medias' })).toEqual([{ kind: 'comida' }, { kind: 'hora' }]);
        expect(consequence({ skill: 'athletics', outcome: 'medias', can: { pista: false } })).toEqual([{ kind: 'oro', amount: '1d2' }, { kind: 'herida', amount: '1' }]);
    });

    test('lo que toca a alguien, solo si hay alguien delante', () => {
        expect(consequence({ skill: 'persuasion', outcome: 'mal' })).toEqual([]);
        expect(consequence({ skill: 'persuasion', outcome: 'mal', can: { mirada: true } })).toEqual([{ kind: 'mirada', amount: '-1' }]);
        expect(consequence({ skill: 'intimidation', outcome: 'bien', can: { mirada: true, sabe: true } }))
            .toEqual([{ kind: 'sabe' }, { kind: 'mirada', amount: '-1' }]);
        expect(consequence({ skill: 'sleight', outcome: 'mal' })).toEqual([{ kind: 'hora' }]);
    });

    test('el banco cuenta cada resultado, con lo que se intentaba', () => {
        const told = (/** @type {string} */ outcome, /** @type {string} */ skill, que = 'buscar huellas en el barro') =>
            narrate({ rows, moment: `tirada-${outcome}`, facts: { quien: 'Bran', que, habilidad: skill }, random: () => 0.01 }).text;
        for (const outcome of ['bien', 'medias', 'mal']) {
            for (const skill of Object.keys(SKILLS)) {
                expect(told(outcome, skill)).toMatch(/Bran/);
                expect(told(outcome, skill, '')).toMatch(/Bran/);
            }
        }
    });

    test('y los edificios y lo que se puede mirar en cada tipo de sitio', () => {
        for (const service of ['posada', 'tienda', 'herreria', 'templo', 'tablon']) {
            expect(narrate({ rows, moment: 'servicio', facts: { servicio: service }, random: () => 0.5 }).text).not.toBe('');
        }
        const looks = rows.filter((/** @type {any} */ r) => r.kind === 'mirar');
        expect(looks.every((/** @type {any} */ r) => r.skill in SKILLS && r.verbo && r.text)).toBe(true);
        for (const type of ['city', 'village', 'outpost', 'sanctuary', 'camp', 'ruins', 'dungeon', 'wilderness']) {
            expect(looks.some((/** @type {any} */ r) => r.when?.tipo === type)).toBe(true);
        }
    });
});
