import { describe, test, expect } from '@jest/globals';
import { upcoming } from '../public/scripts/game-engine/campaign/upcoming.js';
import { affairsOf } from '../public/scripts/game-engine/campaign/week-table.js';
import { keepOn, MODES, survivalFor } from '../public/scripts/game-engine/rules/modes.js';

describe('T7: los relojes que no decían su plazo', () => {
    const base = { today: 10, billDue: 14, seasonStart: undefined };
    const kinds = (/** @type {any[]} */ list) => list.map(i => i.kind);

    test('el harto, los rivales y lo que os buscan, el día de la semana', () => {
        const list = upcoming({ ...base, leaving: ['Bran'], rivals: true, wanted: { 'El Pueblo de Barro': 2, 'Vane': 0 } });
        expect(list.find(i => i.kind === 'harto')).toEqual({ in: 4, kind: 'harto', text: 'Bran puede irse si nada cambia' });
        expect(list.find(i => i.kind === 'rivales')?.in).toBe(4);
        expect(list.filter(i => i.kind === 'buscados').map(i => i.text)).toEqual(['En El Pueblo de Barro os buscan un poco menos (de 2 a 1)']);
    });

    test('sin día de la semana no se inventa ninguno', () => {
        const list = upcoming({ today: 10, leaving: ['Bran'], rivals: true, wanted: { A: 2 } });
        expect(kinds(list)).not.toContain('harto');
        expect(kinds(list)).not.toContain('rivales');
    });

    test('la pista llega a los 3 días de quieto el hilo, y la segunda a los 6; con un erudito, uno antes', () => {
        const hints = { open: [{ id: 'h1', title: 'El cáliz' }], openedDay: { h1: 9 }, given: {} };
        expect(upcoming({ ...base, hints }).find(i => i.kind === 'pista')).toEqual({ in: 2, kind: 'pista', text: 'Si el hilo sigue quieto, una pista de «El cáliz»' });
        expect(upcoming({ ...base, hints: { ...hints, given: { h1: 1 } } }).find(i => i.kind === 'pista')?.in).toBe(5);
        expect(upcoming({ ...base, hints: { ...hints, early: 1 } }).find(i => i.kind === 'pista')?.in).toBe(1);
        expect(upcoming({ ...base, hints: { ...hints, given: { h1: 2 } } }).some(i => i.kind === 'pista')).toBe(false);
    });

    test('los rivales solo salen con el mundo en marcha', () => {
        const list = upcoming({ ...base, rivals: true, leaving: ['Bran'] });
        const relaxedWithoutWorld = survivalFor('ab');
        expect(kinds(keepOn(list, relaxedWithoutWorld))).not.toContain('rivales');
        expect(kinds(keepOn(list, relaxedWithoutWorld))).toContain('harto');
        expect(kinds(keepOn(list, survivalFor(MODES.normal.letters)))).toContain('rivales');
    });

    test('el harto pide su sitio en la mesa: si nadie le atiende, se va', () => {
        const affairs = affairsOf({ today: 10, leaving: [{ id: 7, name: 'Bran' }], weekDue: 14 });
        expect(affairs).toEqual([{
            id: 'harto:7', kind: 'harto', title: 'Bran está harto',
            detail: 'Algo le pesa: habladle, dadle lo que quiere o cambiad de rumbo',
            in: 4, ifIgnored: 'Bran se va, con lo suyo', where: '',
        }]);
    });
});
