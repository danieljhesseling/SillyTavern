import { describe, test, expect } from '@jest/globals';
import { simParty, simEnemies, simulateBoard, simulateBoards, simVerdict, enemyDamageFormula, SIM_VERDICTS } from '../public/scripts/game-engine/combat/quick-sim.js';

const bestiary = [
    { name: 'Lobo', hp: 11, armorClass: 13, cr: 0.25 },
    { name: 'Ogro', hp: 59, armorClass: 11, cr: 2 },
    { name: 'Dragón', hp: 200, armorClass: 18, cr: 10, boss: true },
];
const board = (/** @type {string} */ id, /** @type {string[]} */ names) => ({ id, name: id, enemies: names.map((name, i) => ({ name, x: i, y: 0 })) });

describe('J5.9: la simulación rápida de peleas', () => {
    test('el grupo es de cuatro y crece con el nivel', () => {
        const one = simParty(1);
        const five = simParty(5);
        expect(one.map(m => m.role)).toEqual(['guerrero', 'clerigo', 'picaro', 'mago']);
        expect(five[0].maxHp).toBeGreaterThan(one[0].maxHp);
        expect(simParty(1, 6)).toHaveLength(6);
    });

    test('los enemigos pegan como en el juego: su competencia y el daño de su desafío; el jefe, dos veces', () => {
        const { foes, unknown } = simEnemies([{ name: 'Lobo' }, { name: 'Dragón' }, { name: 'Nadie' }], bestiary);
        // Tanda 22: +0 de característica y +2 de competencia (desafío 1/4); el dragón (10), +4.
        expect(foes[0]).toMatchObject({ attack: 2, damage: '1d6', attacks: 1, maxHp: 11, ac: 13 });
        expect(foes[1]).toMatchObject({ attack: 4, damage: '2d8', attacks: 2, boss: true });
        expect(unknown).toEqual(['Nadie']);
        expect(enemyDamageFormula(11)).toBe('3d8');
    });

    test('dos lobos para nivel 1 se ganan; un dragón para nivel 1, no', () => {
        const easy = simulateBoard({ board: board('lobos', ['Lobo', 'Lobo']), bestiary, level: 1, runs: 100, seed: 'x' });
        const hard = simulateBoard({ board: board('dragon', ['Dragón']), bestiary, level: 1, runs: 100, seed: 'x' });
        expect(easy?.winRate).toBeGreaterThan(0.95);
        expect(hard?.winRate).toBeLessThan(0.2);
        expect(hard?.verdict).toBe('muy-dificil');
        expect(Object.keys(SIM_VERDICTS)).toContain(easy?.verdict);
        expect(hard?.said).toMatch(/Demasiado difícil: con cuatro de nivel 1, se gana \d+ de cada 100/);
    });

    test('con la misma semilla sale lo mismo, y más nivel gana más', () => {
        const a = simulateBoard({ board: board('ogros', ['Ogro', 'Ogro', 'Ogro']), bestiary, level: 2, runs: 150, seed: 's' });
        const b = simulateBoard({ board: board('ogros', ['Ogro', 'Ogro', 'Ogro']), bestiary, level: 2, runs: 150, seed: 's' });
        const higher = simulateBoard({ board: board('ogros', ['Ogro', 'Ogro', 'Ogro']), bestiary, level: 6, runs: 150, seed: 's' });
        expect(b).toEqual(a);
        expect(Number(higher?.winRate)).toBeGreaterThanOrEqual(Number(a?.winRate));
    });

    test('el veredicto', () => {
        expect(simVerdict({ winRate: 0.3, hpLost: 0.9, rounds: 6 })).toBe('muy-dificil');
        expect(simVerdict({ winRate: 0.8, hpLost: 0.4, rounds: 4 })).toBe('dificil');
        expect(simVerdict({ winRate: 1, hpLost: 0.05, rounds: 2 })).toBe('muy-facil');
        expect(simVerdict({ winRate: 0.97, hpLost: 0.3, rounds: 4 })).toBe('justa');
    });

    test('todos los tableros, uno a uno, devolviendo el control entre medias; los que no tienen pelea no cuentan', async () => {
        const pack = { bestiary, boards: [board('a', ['Lobo']), { id: 'vacio', name: 'vacío', enemies: [] }, board('b', ['Ogro'])] };
        let pauses = 0;
        /** @type {number[]} */
        const seen = [];
        const sims = await simulateBoards({
            pack, bandOf: () => ({ low: 2, high: 3 }), runs: 20,
            onProgress: (done) => seen.push(done),
            pause: async () => { pauses++; },
        });
        expect(sims.map(s => s.id)).toEqual(['a', 'b']);
        expect(sims[0].level).toBe(2);
        expect(pauses).toBe(2);
        expect(seen).toEqual([1, 2]);
    });
});
