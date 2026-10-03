import { describe, test, expect } from '@jest/globals';
import fs from 'node:fs';
import {
    LEVEL_LIMITS, readLevelRange, levelPlanOf, boardBand, partyLevelOf, levelGap, levelAdjustment,
    adjustEnemy, adjustPlacements, levelNote, adjustForSize, sizeNotes, adjustmentNotes, WRITTEN_PARTY_SIZE, SIZE_LIMITS,
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
        // Tanda 20: las campañas de semilla que ya traen paquete también dicen el suyo.
        expect(worlds.map(w => [w.id, readLevelRange(w.levels)]).filter(([id]) => ['1387', 'strahd', 'pantalla'].includes(id))).toEqual([
            ['pantalla', { min: 1, max: 4 }],
            ['1387', { min: 1, max: 4 }],
            // D-J56: la cripta es para nivel 6 a 7, así que Strahd llega hasta el 7.
            ['strahd', { min: 1, max: 7 }],
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
        expect(boardBand(plan, 'Comedor del Conde')).toEqual({ low: 5, high: 6, act: 5 });
        // Los tableros de los encargos también saben su acto.
        expect(boardBand(plan, 'El taller del ataudero')).toEqual({ low: 2, high: 3, act: 2 });
        // Uno que no sale en ningún acto es para todo el tramo.
        expect(boardBand(plan, 'Un sótano cualquiera (encargo)')).toEqual({ low: 1, high: 7, act: 0 });
    });

    test('D-J56: la cripta dice su propio nivel, 6 a 7, y los actos se reparten lo demás', () => {
        const plan = levelPlanOf(strahdMeta, strahdRow.levels);
        expect(plan.bandOf).toEqual({ 'la cripta de strahd': { low: 6, high: 7 } });
        expect(plan.actsMax).toBe(6);
        expect(boardBand(plan, 'La Cripta de Strahd')).toEqual({ low: 6, high: 7, act: 5 });
        // Sin nada que diga su nivel, los actos llegan al final del tramo, como siempre.
        const plain = levelPlanOf({ quests: [{ boardName: 'Uno', act: 1 }, { boardName: 'Dos', act: 2 }] }, [1, 4]);
        expect(plain.actsMax).toBe(4);
        expect(boardBand(plain, 'Dos')).toEqual({ low: 2, high: 4, act: 2 });
        // Un tablero de en medio con su nivel no recorta a los actos.
        const middle = levelPlanOf({ quests: [{ boardName: 'Uno', act: 1, levels: [2, 3] }, { boardName: 'Dos', act: 2 }] }, [1, 4]);
        expect(middle.actsMax).toBe(4);
        expect(boardBand(middle, 'Uno')).toEqual({ low: 2, high: 3, act: 1 });
        // Un nivel mal escrito no cuenta.
        expect(levelPlanOf({ quests: [{ boardName: 'Uno', act: 1, levels: [0, 3] }] }, [1, 4]).bandOf).toEqual({});
    });

    test('D-J56: a nivel 6, la cripta tal cual; a nivel 5, afloja sola, sin quitar a nadie', () => {
        const atSix = fightFor('cripta_strahd', 6, 4);
        expect(atSix.adjustment.steps).toBe(0);
        expect(atSix.placements).toEqual(boardOf('cripta_strahd').enemies);
        const atFive = fightFor('cripta_strahd', 5, 4);
        expect(atFive.adjustment).toMatchObject({ steps: -1, hpFactor: 0.88, damage: -1, minions: 0 });
        expect(atFive.placements.map(p => p.name)).toEqual(['Strahd von Zarovich', 'Engendro Vampírico']);
        expect(atFive.enemies[0].maxHp).toBe(Math.round(90 * 0.88));
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

    test('D-J21: la vida sube como mucho un 35 %', () => {
        expect(LEVEL_LIMITS.hp.max).toBe(1.35);
        expect(levelAdjustment(3).hpFactor).toBe(1.35);
        expect(levelAdjustment(9).hpFactor).toBe(1.35);
    });

    test('la vida que le queda baja o sube en la misma proporción', () => {
        const hurt = adjustEnemy({ name: 'Lobo', maxHp: 20, currentHp: 10 }, levelAdjustment(4));
        expect(hurt).toMatchObject({ maxHp: 27, currentHp: 14, levelHit: 2, levelDamage: 3, levelSteps: 4 });
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
        // 26 × 1,35 = 35 y 11 × 1,35 = 15 (D-J21: antes, ×1,5).
        expect(higher.totalHp).toBe(35 + 4 * 15);
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

    test('D-J21: a quien lleva CA 15 o más no se le copia', () => {
        // La Entrada a Ravenloft: dos gárgolas de CA 15. Con nivel 9 no sale una tercera.
        const gate = fightFor('entrada_ravenloft', 9);
        expect(gate.adjustment.minions).toBeGreaterThan(0);
        expect(gate.placements.map(p => p.name)).toEqual(['Gárgola', 'Gárgola']);
        expect(gate.enemies.every(e => e.maxHp <= Math.round(bestiary.find(r => r.name === 'Gárgola').hp * 1.35))).toBe(true);
        // Con uno acorazado y otro no, se copia al que no lo está, aunque sea más fuerte.
        const mixed = [
            { name: 'Caballero de latón', armorClass: 18, hp: 5, cr: 0.125 },
            { name: 'Lobo gris', armorClass: 13, hp: 11, cr: 0.25 },
        ];
        const { placements, added } = adjustPlacements({
            placements: [{ name: 'Caballero de latón', x: 1, y: 1 }, { name: 'Lobo gris', x: 5, y: 5 }],
            adjustment: levelAdjustment(4), bestiary: mixed, partyLevel: 9, partySize: 4, band: { low: 1, high: 2 },
            gridWidth: 12, gridHeight: 12,
        });
        expect(added).toEqual(['Lobo gris', 'Lobo gris']);
        expect(placements.filter(p => p.name === 'Caballero de latón')).toHaveLength(1);
        // Solo acorazados: nadie de más. Quitar sí se puede.
        const armoured = adjustPlacements({
            placements: [{ name: 'Caballero de latón', x: 1, y: 1 }, { name: 'Caballero de latón', x: 2, y: 1 }],
            adjustment: levelAdjustment(4), bestiary: mixed, partyLevel: 9, partySize: 4, band: { low: 1, high: 2 },
            gridWidth: 12, gridHeight: 12,
        });
        expect(armoured.added).toEqual([]);
        expect(adjustPlacements({
            placements: [{ name: 'Caballero de latón', x: 1, y: 1 }, { name: 'Caballero de latón', x: 2, y: 1 }],
            adjustment: levelAdjustment(-4), bestiary: mixed, partyLevel: 1, partySize: 4, band: { low: 5, high: 6 },
        }).removed).toEqual(['Caballero de latón']);
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

describe('J12.6: el mismo tablero con uno y con cuatro', () => {
    /**
     * La pelea de un tablero de Strahd para un grupo de ese tamaño, a su nivel.
     *
     * @param {string} id
     * @param {number} size
     * @param {number} [level]
     */
    const forSize = (id, size, level = 2) => {
        const board = boardOf(id);
        return adjustForSize({
            placements: board.enemies, partySize: size, partyLevel: level, bestiary,
            terrain: terrainFromAsciiMap(board.map), gridWidth: board.map[0].length, gridHeight: board.map.length,
            taken: board.partyStart,
        });
    };

    test('D-J56: para cuatro, como se escribió; con tres, uno menos; con uno, menos; con cinco, uno más', () => {
        expect(WRITTEN_PARTY_SIZE).toBe(4);
        // La mansión del burgomaestre: tres zombis.
        expect(forSize('mansion_burgomaestre', 4).placements).toEqual(boardOf('mansion_burgomaestre').enemies);
        expect(forSize('mansion_burgomaestre', 4).added).toEqual([]);
        const three = forSize('mansion_burgomaestre', 3);
        expect(three.placements.map(p => p.name)).toEqual(['Zombi de Strahd', 'Zombi de Strahd']);
        expect(three.removed).toEqual(['Zombi de Strahd']);
        const alone = forSize('mansion_burgomaestre', 1);
        expect(alone.placements.map(p => p.name)).toEqual(['Zombi de Strahd']);
        expect(alone.removed).toEqual(['Zombi de Strahd', 'Zombi de Strahd']);
        const five = forSize('mansion_burgomaestre', 5);
        expect(five.placements.map(p => p.name)).toEqual(['Zombi de Strahd', 'Zombi de Strahd', 'Zombi de Strahd', 'Zombi de Strahd']);
        expect(five.added).toEqual(['Zombi de Strahd']);
    });

    test('D-J56: uno de más o de menos por cada uno que sobra o que falta, como mucho', () => {
        // La cima de Yester: un druida y cuatro plagas de agujas (amenaza 8, poca). Con tres
        // cabrían dos plagas menos en el presupuesto, pero solo falta uno: se quita una.
        expect(forSize('cima_yester', 3).removed).toEqual(['Plaga de agujas']);
        expect(forSize('cima_yester', 5).added).toEqual(['Plaga de agujas']);
        expect(forSize('cima_yester', 6).added).toEqual(['Plaga de agujas', 'Plaga de agujas']);
        expect(forSize('cima_yester', 2).removed).toHaveLength(2);
        // Con los que pide el tablero, nada.
        expect(forSize('cima_yester', 4)).toMatchObject({ added: [], removed: [] });
    });

    test('más gente, más enemigos: nunca menos que con uno menos', () => {
        for (const id of ['cima_yester', 'islote_torre', 'camino_vino', 'plaza_vallaki']) {
            const counts = [1, 2, 3, 4, 5].map(size => forSize(id, size).placements.length);
            for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
            expect(counts[0]).toBeLessThan(counts[3]);
        }
    });

    test('con uno, a nadie se le deja sin los suyos; al jefe no se le quita ni se le copia', () => {
        const hill = forSize('cima_yester', 1);
        expect(new Set(hill.placements.map(p => p.name))).toEqual(new Set(['Druida de Yester', 'Plaga de agujas']));
        expect(hill.removed.length).toBeLessThanOrEqual(-SIZE_LIMITS.min);
        const crypt = forSize('cripta_strahd', 1);
        expect(crypt.placements.map(p => p.name)).toEqual(['Strahd von Zarovich', 'Engendro Vampírico']);
        expect(forSize('cripta_strahd', 6).placements.filter(p => p.name === 'Strahd von Zarovich')).toHaveLength(1);
    });

    test('los de más caen en casillas libres, junto a los suyos, y siempre en las mismas', () => {
        const big = forSize('cima_yester', 5);
        expect(big.added.length).toBeLessThanOrEqual(SIZE_LIMITS.max);
        const map = boardOf('cima_yester').map;
        for (const p of big.placements.slice(5)) expect(map[p.y][p.x]).not.toBe('#');
        const cells = big.placements.map(p => `${p.x},${p.y}`);
        expect(new Set(cells).size).toBe(cells.length);
        expect(forSize('cima_yester', 5)).toEqual(big);
    });

    test('D-J21: tampoco por ser muchos se copia a quien lleva CA 15 o más', () => {
        expect(forSize('entrada_ravenloft', 6).placements.map(p => p.name)).toEqual(['Gárgola', 'Gárgola']);
    });

    test('se dice llano', () => {
        expect(sizeNotes({ partySize: 3, removed: ['Zombi de Strahd'] }))
            .toEqual(['Este tablero está pensado para un grupo de 4 y el vuestro es de 3: hay un enemigo menos (Zombi de Strahd).']);
        expect(sizeNotes({ partySize: 5, added: ['Lobo gris'] }))
            .toEqual(['Este tablero está pensado para un grupo de 4 y el vuestro es de 5: hay un enemigo más (Lobo gris).']);
        expect(sizeNotes({ partySize: 4 })).toEqual([]);
    });

    test('por el nivel y por cuántos sois a la vez: se dice lo que queda, una vez', () => {
        // Uno más por el nivel y dos menos por ir solo: uno menos.
        expect(adjustmentNotes({ level: { added: ['Guardia'] }, size: { removed: ['Guardia', 'Guardia'] }, partySize: 1 }))
            .toEqual(['Por vuestro nivel y por cuántos sois, hay un enemigo menos: Guardia.']);
        // Se anulan: nada que decir.
        expect(adjustmentNotes({ level: { added: ['Lobo gris'] }, size: { removed: ['Lobo gris'] }, partySize: 2 })).toEqual([]);
        // Solo el nivel, como siempre; solo el tamaño, con el tamaño.
        expect(adjustmentNotes({ level: { removed: ['Lobo gris'] }, partySize: 3 })).toEqual(['Por vuestro nivel, hay un enemigo menos: Lobo gris.']);
        expect(adjustmentNotes({ size: { added: ['Lobo gris'] }, partySize: 5 }))
            .toEqual(['Este tablero está pensado para un grupo de 4 y el vuestro es de 5: hay un enemigo más (Lobo gris).']);
    });
});
