/**
 * D-J47: robar dos veces en la misma tienda ya no la cierra cuatro semanas. La primera vez, quien
 * atiende se acuerda (saludo y un 30 % más durante una semana); la segunda, la guardia del sitio
 * se lleva a quien robó dos días al calabozo, se queda lo robado y cobra una multa pequeña si llega
 * el oro; después la tienda vuelve a vender, algo más cara unos días.
 */

import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import {
    addMark, jailFor, jailRisk, refusal, rememberedGreeting, rememberedPrice,
} from '../public/scripts/game-engine/campaign/world-marks.js';
import {
    JAIL_MIN_FINE, daysWord, goodsWords, guardOf, jailFine, jailLine, jailScene, markStolen, stolenHere,
} from '../public/scripts/game-engine/campaign/jail.js';

const rows = JSON.parse(readFileSync(new URL('../public/compendio/ecos.json', import.meta.url), 'utf8')).rows;
const TOWN = 'Puerto Alba';
const shop = { kind: 'tienda', keeper: { name: 'Marisa' } };

/** Las huellas de unos robos pillados en la tienda, los días dados. */
const caught = (/** @type {number[]} */ days, town = TOWN) => days.reduce((marks, day) => addMark(marks, { deed: 'robo', town, place: 'tienda', day }), /** @type {any[]} */ ([]));

describe('D-J47: cuándo toca el calabozo', () => {
    test('la primera vez no: se acuerdan, os saludan con ello y cobran un 30 % más, pero os atienden', () => {
        const marks = caught([1]);
        expect(jailFor({ marks, rows, mark: { deed: 'robo', town: TOWN, place: 'tienda', day: 1 } })).toBeNull();
        expect(rememberedPrice({ marks, rows, town: TOWN, place: 'tienda', today: 2 }).factor).toBe(1.3);
        expect(rememberedGreeting({ place: shop, town: TOWN, marks, rows, today: 2 })).toMatch(/^Marisa /);
        expect(refusal({ place: shop, town: TOWN, marks, rows, today: 2 })).toBe('');
    });

    test('la segunda, mientras se acuerdan de la primera: dos días de calabozo', () => {
        const marks = caught([1, 3]);
        expect(jailFor({ marks, rows, mark: { deed: 'robo', town: TOWN, place: 'tienda', day: 3 } })?.days).toBe(2);
        // Y se avisa antes de intentarlo.
        expect(jailRisk({ marks: caught([1]), rows, mark: { deed: 'robo', town: TOWN, place: 'tienda', day: 3 } })).toBe(2);
        expect(jailRisk({ marks: [], rows, mark: { deed: 'robo', town: TOWN, place: 'tienda', day: 3 } })).toBe(0);
    });

    test('después la tienda vuelve a vender, más cara unos días, sin cerrar; luego se olvida', () => {
        const marks = addMark(caught([1, 3]), { deed: 'calabozo', town: TOWN, place: '', day: 3 });
        // Al salir, dos días después: os venden, un 30 % más caro, y os saludan sabiendo lo del calabozo.
        expect(refusal({ place: shop, town: TOWN, marks, rows, today: 5 })).toBe('');
        expect(rememberedPrice({ marks, rows, town: TOWN, place: 'tienda', today: 5 })).toEqual({ factor: 1.3, label: 'la guardia te llevó por robar aquí' });
        expect(rememberedGreeting({ place: shop, town: TOWN, marks, rows, today: 5 })).toMatch(/soltado|calabozo/);
        // Una semana después del último robo, se olvida.
        expect(rememberedPrice({ marks, rows, town: TOWN, place: 'tienda', today: 10 }).factor).toBe(1);
        // Y ninguna fila de robo cierra ya la tienda.
        expect(rows.filter((/** @type {any} */ r) => r.when?.hecho === 'robo' && r.niega)).toEqual([]);
    });

    test('lo de antes de un olvido no cuenta: pillados otra vez tras más de una semana, es la primera vez', () => {
        const marks = caught([1, 9]);
        expect(jailFor({ marks, rows, mark: { deed: 'robo', town: TOWN, place: 'tienda', day: 9 } })).toBeNull();
    });

    test('lo robado sin que os pillen no cuenta, ni lo de otro pueblo', () => {
        const hidden = addMark(caught([3]), { deed: 'robo-oculto', town: TOWN, place: 'tienda', day: 1 });
        expect(jailFor({ marks: hidden, rows, mark: { deed: 'robo', town: TOWN, place: 'tienda', day: 3 } })).toBeNull();
        const elsewhere = [...caught([1], 'Vallaki'), ...caught([3])];
        expect(jailFor({ marks: elsewhere, rows, mark: { deed: 'robo', town: TOWN, place: 'tienda', day: 3 } })).toBeNull();
    });
});

describe('D-J47: la guardia, lo requisado y la multa', () => {
    test('la guardia es la del sitio: su alguacil o sargento; si no hay, un guardia', () => {
        const npcs = [
            { name: 'Torres', where: 'El Pueblo de Barro', trade: 'Alguacil' },
            { name: 'Garret', where: 'Castillo de Vane', trade: 'Guardia de la puerta' },
            { name: 'Marisa', where: TOWN, trade: 'Tendera del mercado' },
        ];
        expect(guardOf({ npcs, town: 'el pueblo de barro' })).toEqual({ name: 'Torres', named: true });
        expect(guardOf({ npcs, town: TOWN })).toEqual({ name: 'Un guardia', named: false });
        expect(guardOf({ npcs: [{ ...npcs[0], dead: true }], town: 'El Pueblo de Barro' }).named).toBe(false);
    });

    test('en las campañas de verdad: Torres en El Pueblo de Barro, Izek en Vallaki; en la aldea de Barovia, un guardia', () => {
        const npcsOf = (/** @type {string} */ id) => JSON.parse(readFileSync(new URL(`../public/mundos/${id}.pack.json`, import.meta.url), 'utf8')).npcs;
        expect(guardOf({ npcs: npcsOf('1387'), town: 'El Pueblo de Barro' })).toEqual({ name: 'Torres', named: true });
        expect(guardOf({ npcs: npcsOf('strahd'), town: 'Ciudad de Vallaki' })).toEqual({ name: 'Izek Strazni', named: true });
        expect(guardOf({ npcs: npcsOf('strahd'), town: 'Aldea de Barovia' })).toEqual({ name: 'Un guardia', named: false });
    });

    test('se quedan lo que salió de esa tienda sin pagar, y nada más', () => {
        const members = [
            { id: '1', items: [markStolen({ id: 'a', name: 'Cuerda' }, TOWN), { id: 'b', name: 'Espada' }] },
            { id: '2', items: [markStolen({ id: 'c', name: 'Vela' }, 'puerto alba'), markStolen({ id: 'd', name: 'Aceite' }, 'Vallaki')] },
        ];
        expect(stolenHere(members, TOWN)).toEqual([
            { memberId: '1', itemId: 'a', name: 'Cuerda' },
            { memberId: '2', itemId: 'c', name: 'Vela' },
        ]);
        expect(stolenHere(members, '')).toEqual([]);
    });

    test('la multa es pequeña: lo que valía, y como poco cinco', () => {
        expect(jailFine(0)).toBe(JAIL_MIN_FINE);
        expect(jailFine(2)).toBe(5);
        expect(jailFine(12)).toBe(12);
        expect(daysWord(2)).toBe('dos días');
        expect(daysWord(1)).toBe('un día');
    });
});

describe('D-J47: la escena del calabozo', () => {
    const hero = { id: 'h', name: 'Tessa', gender: 'Mujer' };
    const gerd = { id: 'g', name: 'Gerd', gender: 'Hombre' };
    const facts = {
        town: TOWN, guard: { name: 'Un guardia', named: false }, keeper: 'Marisa', thief: hero, hero, visitor: gerd,
        days: 2, fine: 5, paid: true, taken: ['una vela', 'la cuerda'], releaseDay: 6,
    };

    test('si robaste tú: te hablan a ti, te visita alguien de tu gente, pagas y sales el día que toca', () => {
        const scene = jailScene(facts);
        expect(scene.id).toBe('calabozo');
        expect(scene.title).toBe('El calabozo de Puerto Alba');
        const said = scene.beats.map(b => b.text).join(' ');
        expect(scene.beats[0]).toMatchObject({ who: 'Marisa', text: expect.stringMatching(/^¡Al ladrón!/) });
        expect(said).toMatch(/Esto se queda con la guardia: una vela y la cuerda/);
        expect(said).toMatch(/Y tú, al calabozo: dos días a pan y agua/);
        expect(scene.beats.some(b => b.who === 'Gerd')).toBe(true);
        expect(said).toMatch(/Son 5 de oro de multa/);
        expect(said).toMatch(/Al amanecer del día 6, se abre la celda/);
        // D-J54: lo cuentan quienes están allí; el narrador, una sola línea corta (cuándo se sale).
        const narrator = scene.beats.filter(b => !b.who);
        expect(narrator).toHaveLength(1);
        expect(narrator[0].text.length).toBeLessThan(50);
        expect(said).not.toMatch(/[{}|]/);
        expect(scene.beats.every(b => b.decision === null)).toBe(true);
    });

    test('si robó alguien de tu gente, vas tú a verle, y se le nombra con su género; sin oro, la celda paga la multa', () => {
        const mira = { id: 'm', name: 'Mira', gender: 'Mujer' };
        const scene = jailScene({ ...facts, thief: mira, visitor: hero, paid: false });
        const said = scene.beats.map(b => b.text).join(' ');
        expect(said).toMatch(/Y Mira, al calabozo: dos días a pan y agua/);
        expect(scene.beats.find(b => b.who === 'Tessa')?.text).toMatch(/^Mira, te traigo pan/);
        expect(jailScene({ ...facts, thief: mira, visitor: hero }).beats.map(b => b.text).join(' ')).toMatch(/Si la vuelvo a ver robando aquí/);
        expect(said).toMatch(/los días de celda la pagan/);
        expect(said).not.toMatch(/[{}|]/);
        expect(jailLine({ ...facts, thief: mira, paid: false })).toMatch(/^La guardia de Puerto Alba se lleva a Mira al calabozo/);
    });

    test('lo requisado se dice como se diría: lo repetido, contado, y los nombres comunes en minúscula', () => {
        expect(goodsWords(['Aceite afilador', 'Aceite afilador'])).toBe('dos aceites afiladores');
        expect(goodsWords(['Aceite afilador', 'Cuerda de cáñamo', 'Daga de Vane'])).toBe('aceite afilador, cuerda de cáñamo y Daga de Vane');
        const said = jailScene({ ...facts, taken: ['Aceite afilador', 'Aceite afilador'] }).beats.map(b => b.text).join(' ');
        expect(said).toMatch(/Esto se queda con la guardia: dos aceites afiladores. Y tú, al calabozo/);
        expect(said).not.toMatch(/Aceite afilador y Aceite afilador/);
    });

    test('con la guardia con nombre, se dice quién', () => {
        expect(jailLine({ ...facts, town: 'El Pueblo de Barro', guard: { name: 'Torres', named: true } }))
            .toMatch(/^Torres, de la guardia de El Pueblo de Barro, se lleva a Tessa al calabozo por robar otra vez en la tienda: dos días\. Se quedan con una vela y la cuerda\. Multa: 5 de oro\.$/);
    });
});
