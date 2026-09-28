import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import {
    sucesoCount, pickSucesos, sucesoById, optionView, resolveOption, readSucesoState, noteSuceso, dueFollowUp, describeEffect,
} from '../public/scripts/game-engine/campaign/sucesos.js';
import { validateBattery } from '../public/scripts/game-engine/compendio/compendio.js';
import { SKILLS } from '../public/scripts/game-engine/rules/checks.js';

const battery = JSON.parse(readFileSync(new URL('../public/compendio/sucesos.json', import.meta.url), 'utf8'));
const rows = battery.rows;
/** Un azar repetible. */
const rolling = (/** @type {number} */ seed) => {
    let state = seed;
    return () => ((state = (state * 9301 + 49297) % 233280) / 233280);
};

describe('sucesos con decisiones (Z4 de ROADMAP_SIN_TOKENS)', () => {
    test('la batería es válida, y cada opción dice lo que hace', () => {
        expect(validateBattery('sucesos', battery)).toEqual([]);
        const known = /^(oro:[+-](\d+|\d*d\d+)|hora|dia|herida:(\d+|\d*d\d+)|cura:\d*d\d+|comida|fama:[+-]1|faccion:[+-]1|vinculo:\+1|rumor|pista)$/;
        expect(rows.every((/** @type {any} */ row) => row.options.length >= 2)).toBe(true);
        const options = rows.flatMap((/** @type {any} */ row) => row.options);
        const effects = options.flatMap((/** @type {any} */ o) => [...(o.effects ?? []), ...(o.success?.effects ?? []), ...(o.fail?.effects ?? [])]);
        expect(effects.filter((/** @type {string} */ e) => !known.test(e))).toEqual([]);
        expect(options.filter((/** @type {any} */ o) => o.check && !(o.check.skill in SKILLS))).toEqual([]);
        expect(options.filter((/** @type {any} */ o) => o.follow && !rows.some((/** @type {any} */ r) => r.id === o.follow.id))).toEqual([]);
        // Algo tiene que pasar, o al menos decirse.
        expect(options.filter((/** @type {any} */ o) => !(o.then || o.success?.then || (o.effects ?? []).length > 0))).toEqual([]);
    });

    test('cada viaje trae su decisión, y uno de tres días, dos; lo demás, a veces', () => {
        expect(sucesoCount({ moment: 'viaje', days: 3, random: () => 0.9 })).toBe(2);
        expect(sucesoCount({ moment: 'viaje', days: 2, random: () => 0.9 })).toBe(1);
        expect(sucesoCount({ moment: 'viaje', days: 1, random: () => 0.9 })).toBe(1);
        expect(sucesoCount({ moment: 'llegada', random: () => 0.9 })).toBe(0);
        expect(sucesoCount({ moment: 'llegada', random: () => 0.1 })).toBe(1);
        expect(sucesoCount({ moment: 'continuacion', random: () => 0.1 })).toBe(0);
    });

    test('salen los del momento, con sus huecos rellenos, sin repetirse', () => {
        const picked = pickSucesos({ rows, moment: 'viaje', facts: { destino: 'Castillo de Vane', sitio: 'El Pueblo de Barro' }, count: 2, random: rolling(3) });
        expect(picked).toHaveLength(2);
        expect(picked[0].id).not.toBe(picked[1].id);
        expect(picked.every(s => !/\{/.test(s.text))).toBe(true);
        // Una tormenta solo con mal tiempo; unas setas solo en el bosque.
        const clear = pickSucesos({ rows, moment: 'viaje', facts: { tiempo: 'despejado', bioma: 'llanura', destino: 'X', sitio: 'Y' }, count: 30, random: rolling(5) });
        expect(clear.map(s => s.id)).not.toContain('tormenta-encima');
        expect(clear.map(s => s.id)).not.toContain('setas-bosque');
        // Las continuaciones no salen solas.
        expect(clear.map(s => s.id)).not.toContain('desertor-posada');
        // Sin compañero, la historia junto al fuego no se puede contar.
        const night = pickSucesos({ rows, moment: 'descanso', facts: {}, count: 10, random: rolling(7) });
        expect(night.map(s => s.id)).not.toContain('hoguera-historia');
        expect(pickSucesos({ rows, moment: 'descanso', facts: { companero: 'Bran' }, count: 10, random: rolling(7) }).map(s => s.id)).toContain('hoguera-historia');
        const again = pickSucesos({ rows, moment: 'llegada', facts: { sitio: 'Y' }, count: 1, random: rolling(9), seen: ['pelea-puerta', 'mendigo-sabe'] });
        expect(again[0].id).toBe('reliquia-feria');
    });

    test('lo que cuesta se dice antes, y lo que no se puede pagar se apaga', () => {
        const pan = sucesoById(rows, 'desertores-pan', { destino: 'Castillo de Vane' });
        expect(pan?.text).toMatch(/Camino de Castillo de Vane/);
        const [share, scare] = pan?.options ?? [];
        expect(optionView(share, { purse: 5 })).toEqual({ enabled: true, why: '', price: '2 de oro' });
        expect(optionView(share, { purse: 1 }).enabled).toBe(false);
        expect(optionView(scare, { purse: 0, skills: SKILLS }).price).toBe('Intimidación, CD 11');
    });

    test('elegir paga, tira y deja lo que vuelve', () => {
        const pan = sucesoById(rows, 'desertores-pan', { destino: 'X' });
        const share = resolveOption(pan?.options[0] ?? { label: '' });
        expect(share.effects).toEqual(['oro:-2', 'fama:+1']);
        expect(share.follow).toEqual({ id: 'desertor-posada', days: 3 });
        const scared = resolveOption(pan?.options[1] ?? { label: '' }, { success: false });
        expect(scared.effects).toEqual(['herida:1d4']);
        expect(scared.then).toMatch(/cuchillo/);
        expect(resolveOption({ label: 'Rodear', cost: { dias: 1 } }).effects).toEqual(['dia']);
    });

    test('lo que vuelve, vuelve el día que toca y donde toca', () => {
        let state = readSucesoState(null);
        state = noteSuceso(state, { id: 'desertores-pan', follow: { id: 'desertor-posada', days: 3 }, day: 2 });
        expect(dueFollowUp(state, { day: 4, place: 'Castillo de Vane' })).toBe('');
        expect(dueFollowUp(state, { day: 5, place: 'Castillo de Vane' })).toBe('desertor-posada');
        state = noteSuceso(state, { id: 'desertor-posada', day: 5 });
        expect(dueFollowUp(state, { day: 9, place: 'X' })).toBe('');
        expect(state.seen).toEqual(['desertores-pan', 'desertor-posada']);
    });

    test('cada efecto, dicho en llano', () => {
        expect(['oro:-2', 'oro:+1d6', 'dia', 'fama:+1', 'faccion:-1', 'rumor'].map(describeEffect))
            .toEqual(['−2 de oro', '+1d6 de oro', 'se pierde un día', 'se habla bien de vosotros', 'los que mandan aquí os miran peor', 'os enteráis de algo']);
    });
});
