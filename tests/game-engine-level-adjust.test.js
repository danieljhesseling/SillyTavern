import { describe, test, expect } from '@jest/globals';
import fs from 'node:fs';
import {
    LEVEL_LIMITS, readLevelRange, levelPlanOf, boardBand, partyLevelOf, levelGap, levelAdjustment,
    adjustEnemy, adjustPlacements, levelNote,
} from '../public/scripts/game-engine/combat/level-adjust.js';
import { buildImportPlan } from '../public/scripts/game-engine/campaign/campaign-importer.js';
import { terrainFromAsciiMap } from '../public/scripts/game-engine/board/terrain.js';

const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'));

// Strahd de verdad: su paquete importado como lo importa el juego, y su tramo del tablón.
const strahdPack = read('../public/mundos/strahd.pack.json');
const strahdRow = read('../public/mundos/mundos.json').worlds.find(w => w.id === 'strahd');
const strahdMeta = buildImportPlan(strahdPack).metadata;
const bestiary = strahdPack.bestiary.map(row => ({ ...row, maxHp: row.hp }));
const boardOf = (id) => strahdPack.boards.find(b => b.id === id);

/**
 * La pelea de un tablero de Strahd para un grupo de ese nivel, como la monta el juego.
 *
 * @param {string} id
 * @param {number} level
 * @param {number} [size]
 */
function fightFor(id, level, size = 3) {
    const board = boardOf(id);
    const plan = levelPlanOf(strahdMeta, strahdRow.levels);
    const band = boardBand(plan, board.name);
    const adjustment = levelAdjustment(levelGap(level, band));
    const { placements } = adjustPlacements({
        placements: board.enemies, adjustment, bestiary, partyLevel: level, partySize: size, band,
        terrain: terrainFromAsciiMap(board.map), gridWidth: board.map[0].length, gridHeight: board.map.length,
        taken: board.partyStart,
    });
    const enemies = placements.map(p => adjustEnemy({ name: p.name, maxHp: bestiary.find(r => r.name === p.name).hp, currentHp: bestiary.find(r => r.name === p.name).hp }, adjustment));
    return {
        band, adjustment, placements, enemies,
        totalHp: enemies.reduce((sum, e) => sum + e.maxHp, 0),
    };
}

describe('para qué nivel es la campaña', () => {
    test('el tablón de Strahd y el de 1387 dicen su tramo', () => {
        const worlds = read('../public/mundos/mundos.json').worlds.filter(w => w.pack);
        expect(worlds.map(w => [w.id, readLevelRange(w.levels)])).toEqual([
            ['1387', { min: 1, max: 4 }],
            ['strahd', { min: 1, max: 6 }],
        ]);
    });

    test('un tramo mal escrito no es un tramo', () => {
        expect(readLevelRange(undefined)).toBeNull();
        expect(readLevelRange([])).toBeNull();
        expect(readLevelRange([0, 4])).toBeNull();
        expect(readLevelRange([3])).toEqual({ min: 3, max: 3 });
        expect(readLevelRange([5, 2])).toEqual({ min: 5, max: 5 });
        expect(levelPlanOf(strahdMeta, null)).toBeNull();
    });

    test('cada acto de Strahd tiene su trozo del tramo', () => {
        const plan = levelPlanOf(strahdMeta, strahdRow.levels);
        expect(plan.acts).toBe(5);
        expect(boardBand(plan, 'Taberna Sangre de la Enredadera')).toEqual({ low: 1, high: 2, act: 1 });
        expect(boardBand(plan, 'Tienda de Madam Eva')).toEqual({ low: 2, high: 3, act: 2 });
        expect(boardBand(plan, 'Plaza de Vallaki')).toEqual({ low: 3, high: 4, act: 3 });
        expect(boardBand(plan, 'Entrada a Ravenloft')).toEqual({ low: 4, high: 5, act: 4 });
        expect(boardBand(plan, 'La Cripta de Strahd')).toEqual({ low: 5, high: 6, act: 5 });
        // Los tableros de los encargos también saben su acto.
        expect(boardBand(plan, 'El taller del ataudero')).toEqual({ low: 2, high: 3, act: 2 });
        // Uno que no sale en ningún acto es para todo el tramo.
        expect(boardBand(plan, 'Un sótano cualquiera (encargo)')).toEqual({ low: 1, high: 6, act: 0 });
    });

    test('el nivel del grupo es la media de los que pelean', () => {
        expect(partyLevelOf([{ level: 5 }, { level: 5, guest: { kind: 'mercenary' } }, { level: 2 }])).toEqual({ level: 4, size: 3 });
        expect(partyLevelOf([{ level: 5 }, { level: 1, guest: { kind: 'ward' } }, { level: 9, dead: true }])).toEqual({ level: 5, size: 1 });
        expect(partyLevelOf([])).toEqual({ level: 1, size: 0 });
    });

    test('dentro del tramo no se aparta; fuera, hasta el borde', () => {
        expect(levelGap(3, { low: 3, high: 4 })).toBe(0);
        expect(levelGap(4, { low: 3, high: 4 })).toBe(0);
        expect(levelGap(1, { low: 3, high: 4 })).toBe(-2);
        expect(levelGap(8, { low: 3, high: 4 })).toBe(4);
    });
});

describe('el ajuste, con tope', () => {
    test('sin diferencia, nada cambia', () => {
        expect(levelAdjustment(0)).toEqual({ steps: 0, hpFactor: 1, hit: 0, damage: 0, minions: 0 });
        const orc = { name: 'Orco', maxHp: 15, currentHp: 15 };
        expect(adjustEnemy(orc, levelAdjustment(0))).toEqual(orc);
        expect(adjustEnemy(orc, null)).toEqual(orc);
    });

    test('crece con la diferencia y se para en sus topes', () => {
        expect(levelAdjustment(1)).toEqual({ steps: 1, hpFactor: 1.12, hit: 0, damage: 1, minions: 0 });
        expect(levelAdjustment(2)).toEqual({ steps: 2, hpFactor: 1.24, hit: 1, damage: 2, minions: 1 });
        expect(levelAdjustment(-2)).toEqual({ steps: -2, hpFactor: 0.76, hit: -1, damage: -2, minions: -1 });
        for (const gap of [10, 19, -10, -19]) {
            const a = levelAdjustment(gap);
            expect(a.hpFactor).toBe(gap > 0 ? LEVEL_LIMITS.hp.max : LEVEL_LIMITS.hp.min);
            expect(a.hit).toBe(gap > 0 ? LEVEL_LIMITS.hit.max : LEVEL_LIMITS.hit.min);
            expect(a.damage).toBe(gap > 0 ? LEVEL_LIMITS.damage.max : LEVEL_LIMITS.damage.min);
            expect(a.minions).toBe(gap > 0 ? LEVEL_LIMITS.minions.max : LEVEL_LIMITS.minions.min);
        }
    });

    test('la vida que le queda baja o sube en la misma proporción', () => {
        const hurt = adjustEnemy({ name: 'Lobo', maxHp: 20, currentHp: 10 }, levelAdjustment(4));
        expect(hurt).toMatchObject({ maxHp: 30, currentHp: 15, levelHit: 2, levelDamage: 3, levelSteps: 4 });
        const weak = adjustEnemy({ name: 'Rata', maxHp: 1, currentHp: 1 }, levelAdjustment(-5));
        expect(weak).toMatchObject({ maxHp: 1, currentHp: 1, levelHit: -2, levelDamage: -2 });
    });
});

describe('el mismo tablero, con nivel 1 y con nivel 5', () => {
    // La plaza de Vallaki, del acto 3: para nivel 3 a 4. Un lobo terrible y dos grises.
    const low = fightFor('plaza_vallaki', 1);
    const written = fightFor('plaza_vallaki', 3);
    const high = fightFor('plaza_vallaki', 5);
    const higher = fightFor('plaza_vallaki', 9);

    test('a su nivel, tal y como se escribió', () => {
        expect(written.adjustment.steps).toBe(0);
        expect(written.placements).toEqual(boardOf('plaza_vallaki').enemies);
        expect(written.totalHp).toBe(26 + 11 + 11);
    });

    test('con nivel 1, más flojo: menos vida, menos puntería y daño, y un lobo gris menos', () => {
        expect(low.adjustment).toMatchObject({ steps: -2, hit: -1, damage: -2, minions: -1 });
        expect(low.placements.map(p => p.name)).toEqual(['Lobo Terrible', 'Lobo gris']);
        expect(low.totalHp).toBeLessThan(written.totalHp);
        expect(low.enemies[0].maxHp).toBe(Math.round(26 * 0.76));
    });

    test('con nivel 5, más fuerte: más vida y más daño, con los mismos enemigos', () => {
        expect(high.adjustment).toMatchObject({ steps: 1, hit: 0, damage: 1, minions: 0 });
        expect(high.placements.map(p => p.name)).toEqual(['Lobo Terrible', 'Lobo gris', 'Lobo gris']);
        expect(high.totalHp).toBeGreaterThan(written.totalHp);
    });

    test('con nivel 9, todo lo que da de sí y ni un punto más', () => {
        expect(higher.adjustment).toMatchObject({ hpFactor: LEVEL_LIMITS.hp.max, hit: LEVEL_LIMITS.hit.max, damage: LEVEL_LIMITS.damage.max });
        // Dos lobos grises más, al lado de los suyos y en casillas que se pisan.
        expect(higher.placements.map(p => p.name)).toEqual(['Lobo Terrible', 'Lobo gris', 'Lobo gris', 'Lobo gris', 'Lobo gris']);
        const map = boardOf('plaza_vallaki').map;
        for (const p of higher.placements.slice(3)) expect(map[p.y][p.x]).not.toBe('#');
        const cells = higher.placements.map(p => `${p.x},${p.y}`);
        expect(new Set(cells).size).toBe(cells.length);
        // Cada uno, con su vida por el tope como mucho.
        for (const e of higher.enemies) {
            expect(e.maxHp).toBeLessThanOrEqual(Math.round(bestiary.find(r => r.name === e.name).hp * LEVEL_LIMITS.hp.max));
        }
        expect(higher.totalHp).toBe(39 + 4 * 17);
    });

    test('lo que se ajusta es igual cada vez: el mismo grupo, la misma pelea', () => {
        expect(fightFor('plaza_vallaki', 9)).toEqual(higher);
    });
});

describe('la cara del tablero no cambia', () => {
    test('al jefe no se le quita nunca, ni se copia', () => {
        // La cripta: Strahd y un engendro. Con nivel 1 no se quita a nadie (no hay repetidos).
        const crypt = fightFor('cripta_strahd', 1);
        expect(crypt.adjustment.minions).toBe(-1);
        expect(crypt.placements.map(p => p.name)).toEqual(['Strahd von Zarovich', 'Engendro Vampírico']);
        expect(crypt.enemies[0].maxHp).toBe(Math.round(90 * LEVEL_LIMITS.hp.min));
        // El Revenant, solo y jefe: con nivel 9 no le sale un compañero.
        const yard = fightFor('patio_argynvostholt', 9);
        expect(yard.placements.map(p => p.name)).toEqual(['Revenant']);
        expect(yard.enemies[0].maxHp).toBeGreaterThan(70);
    });

    test('un esbirro que no cabe en el presupuesto no entra', () => {
        // El comedor: dos engendros vampíricos (amenaza 35 cada uno). A nivel 8, un nivel y
        // pico por encima de su acto, lo de más no llega para otro engendro.
        const dining = fightFor('comedor_ravenloft', 8);
        expect(dining.adjustment.minions).toBe(1);
        expect(dining.placements.map(p => p.name)).toEqual(['Engendro Vampírico', 'Engendro Vampírico']);
    });

    test('sin casilla libre al lado, no se pone', () => {
        const { placements, added } = adjustPlacements({
            placements: [{ name: 'Lobo gris', x: 1, y: 1 }],
            adjustment: levelAdjustment(6), bestiary, partyLevel: 9, partySize: 3, band: { low: 1, high: 2 },
            terrain: terrainFromAsciiMap(['###', '#.#', '###']), gridWidth: 3, gridHeight: 3,
        });
        expect(placements).toEqual([{ name: 'Lobo gris', x: 1, y: 1 }]);
        expect(added).toEqual([]);
    });
});

describe('se dice llano', () => {
    test('por encima y por debajo, con el tramo y el nivel', () => {
        expect(levelNote({ adjustment: levelAdjustment(3), band: { low: 1, high: 2 }, level: 5 }))
            .toBe('Vais por encima de lo que pide la campaña: los enemigos aprietan más. Este tablero es para nivel 1 a 2 y vuestro grupo es de nivel 5.');
        expect(levelNote({ adjustment: levelAdjustment(-4), band: { low: 5, high: 5 }, level: 1 }))
            .toBe('Vais por debajo de lo que pide la campaña: los enemigos aflojan un poco, pero no del todo. Este tablero es para nivel 5 y vuestro grupo es de nivel 1.');
        expect(levelNote({ adjustment: levelAdjustment(0), band: { low: 1, high: 2 }, level: 2 })).toBe('');
    });
});
