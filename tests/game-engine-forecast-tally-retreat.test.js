import { describe, test, expect } from '@jest/globals';
import { hitChance, damageRange, describeForecast, describeIntents } from '../public/scripts/game-engine/combat/forecast.js';
import { readTally, noteDealt, noteTaken, buildVictoryReport } from '../public/scripts/game-engine/combat/tally.js';
import { planRetreat } from '../public/scripts/game-engine/combat/retreat.js';
import { normalizeEncounter } from '../public/scripts/game-engine/combat/turn-machine.js';

describe('forecast', () => {
    test('+5 contra CA 15 acierta con 10 o más: 55 %', () => {
        expect(hitChance(5, 15)).toBeCloseTo(0.55);
    });

    test('un 20 siempre entra, y el 1 no falla solo', () => {
        expect(hitChance(0, 30)).toBeCloseTo(0.05);
        expect(hitChance(20, 5)).toBe(1);
    });

    test('ventaja y desventaja', () => {
        expect(hitChance(5, 15, 'advantage')).toBeCloseTo(1 - 0.45 ** 2);
        expect(hitChance(5, 15, 'disadvantage')).toBeCloseTo(0.55 ** 2);
    });

    test('el daño, con dados, fijos y modificador, y nunca menos de 1', () => {
        expect(damageRange('1d8', 3)).toEqual({ min: 4, max: 11 });
        expect(damageRange('2d6+1', 0)).toEqual({ min: 3, max: 13 });
        expect(damageRange('1d4-3', 0)).toEqual({ min: 1, max: 1 });
    });

    test('la línea dice el porcentaje, la ventaja y si lo tumba', () => {
        const line = describeForecast({
            attackMod: 5, armorClass: 15, mode: 'advantage', reasons: ['está en el suelo'],
            formula: '1d8', damageBonus: 3, targetHp: 3,
        });
        expect(line.text).toMatch(/^80 % de acertar, con ventaja \(está en el suelo\) · 4–11 de daño · lo tumba si acierta$/);
    });

    test('las intenciones: ataca, va hacia, o espera', () => {
        const names = { 1: 'Bruna', 2: 'Sela' };
        expect(describeIntents([
            { name: 'Lobo', plan: { focusId: '1', action: 'attack', targetId: '1' } },
            { name: 'Arquero', plan: { focusId: '2', action: 'none', targetId: null } },
            { name: 'Rata', plan: { focusId: null, action: 'none', targetId: null } },
        ], names).map(i => i.text)).toEqual(['Lobo → Bruna', 'Arquero va hacia Sela', 'Rata espera']);
    });
});

describe('tally', () => {
    test('suma daño, tumbados y quién cayó', () => {
        let t = noteDealt(null, 1, 7, false);
        t = noteDealt(t, 1, 5, true);
        t = noteTaken(t, 2, 9, true);
        t = noteTaken(t, 2, 3, true);
        expect(t).toEqual({ dealt: { 1: 12 }, kills: { 1: 1 }, taken: { 2: 12 }, downed: ['2'] });
    });

    test('lo roto se lee vacío', () => {
        expect(readTally({ dealt: { a: 'x', b: -3 }, downed: 'no' })).toEqual({ dealt: {}, kills: {}, taken: {}, downed: [] });
    });

    test('sobrevive a que el combate se normalice al recargar', () => {
        const encounter = normalizeEncounter({ active: true, enemies: [], turnOrder: [], tally: noteDealt(null, 1, 4) });
        expect(encounter.tally?.dealt).toEqual({ 1: 4 });
    });

    test('la pantalla de victoria: el mejor, el botín y las cicatrices', () => {
        let t = noteDealt(null, 1, 10, true);
        t = noteDealt(t, 2, 15);
        t = noteTaken(t, 2, 8, true);
        const report = buildVictoryReport({
            tally: t,
            party: [{ id: 1, name: 'Bruna' }, { id: 2, name: 'Sela' }],
            rounds: 3,
            loot: { gold: 12, xp: 50, items: [{ name: 'Daga' }] },
            defeated: 2,
        });
        expect(report.title).toBe('Victoria en 3 rondas');
        expect(report.rows.find(r => r.best)?.name).toBe('Bruna');
        expect(report.best).toMatch(/Bruna sostuvo el combate: 10 de daño, 1 tumbado/);
        expect(report.loot).toBe('12 de oro · 50 PX · Daga');
        expect(report.scars).toEqual(['Sela cayó y se levantó']);
    });

    test('sin nadie que hiciera nada, no hay mejor', () => {
        const report = buildVictoryReport({ tally: null, party: [{ id: 1, name: 'Bruna' }], rounds: 1 });
        expect(report.best).toBe('');
        expect(report.loot).toBe('Nada que llevarse.');
    });
});

describe('retreat', () => {
    const feet = (/** @type {number} */ ax, /** @type {number} */ ay, /** @type {number} */ bx, /** @type {number} */ by) =>
        Math.max(Math.abs(ax - bx), Math.abs(ay - by)) * 5;
    const party = [
        { id: 1, name: 'Bruna', x: 2, y: 2, hp: 10 },
        { id: 2, name: 'Sela', x: 8, y: 8, hp: 10 },
        { id: 3, name: 'Caído', x: 3, y: 3, hp: 0 },
    ];
    const enemies = [
        { id: 'a', name: 'Lobo', x: 3, y: 2, hp: 5 },
        { id: 'b', name: 'Arquero', x: 12, y: 8, hp: 5 },
        { id: 'c', name: 'Muerto', x: 2, y: 3, hp: 0 },
    ];

    test('quien tiene un enemigo pegado paga un golpe por cada uno', () => {
        const plan = planRetreat({ party, enemies, distanceFeet: feet });
        expect(plan.blows).toEqual([{ memberId: '1', memberName: 'Bruna', enemyId: 'a', enemyName: 'Lobo' }]);
        expect(plan.safe).toEqual(['Sela']);
        expect(plan.summary).toMatch(/Lobo golpea a Bruna/);
    });

    test('destrabarse antes lo evita', () => {
        const plan = planRetreat({ party, enemies, disengaged: ['1'], distanceFeet: feet });
        expect(plan.blows).toEqual([]);
        expect(plan.summary).toMatch(/salís sin que os toquen/);
    });
});
