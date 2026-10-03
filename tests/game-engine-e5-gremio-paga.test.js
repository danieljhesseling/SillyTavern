import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import {
    prepOf, prepBonus, takeBroth, describePrep, prepOffers, prepareFor, TEMPER,
    readBooks, writeBook, bookOffers, bookFactsFor,
    fatigueInjury, homecomingFatigue, infirmaryDays, restRoster, restDetail, OUTING_MIN_DAYS,
    dispatchReport, reportScene,
} from '../public/scripts/game-engine/campaign/guild-perks.js';
import { applyInjury, healInjuries, readInjuries } from '../public/scripts/game-engine/rules/injuries.js';
import { getHitDice } from '../public/scripts/game-engine/rules/rest.js';
import { planAbilityUse } from '../public/scripts/game-engine/rules/abilities.js';

/** @param {string} path */
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

const mail = { id: 'a1', name: 'Cota de malla', type: 'armor', slot: 'body', armorClass: 16 };
const tessa = (extra = {}) => ({ id: 'p1', name: 'Tessa', gender: 'Mujer', level: 3, gold: 200, items: [mail], ...extra });
const bran = (extra = {}) => ({ id: 'p2', name: 'Bran', gender: 'Hombre', level: 2, gold: 0, items: [], ...extra });
const guild = (buildings = {}, gold = 0) => ({ buildings, ...(gold ? { gold } : {}) });

describe('E5.1 · la forja y la cocina preparan la próxima salida', () => {
    test('sin forja ni cocina no se ofrece nada', () => {
        const offers = prepOffers({ guild: guild(), party: [tessa()], purse: 500 });
        expect(offers.temper).toEqual([]);
        expect(offers.rations).toEqual([]);
    });

    test('la forja templa a quien lleva armadura; a quien no, dice por qué', () => {
        const offers = prepOffers({ guild: guild({ forge: 1 }), party: [tessa(), bran()], purse: 500 });
        expect(offers.temper.find(o => o.memberId === 'p1')).toMatchObject({ ok: true, cost: TEMPER.cost });
        expect(offers.temper.find(o => o.memberId === 'p2')).toMatchObject({ ok: false, why: expect.stringContaining('armadura') });
        const done = prepareFor({ member: tessa(), kind: 'temple', guild: guild({ forge: 1 }), purse: 500 });
        expect(done.ok).toBe(true);
        expect(prepBonus({ guildPrep: done.guildPrep }, 'armorClass')).toBe(1);
        expect(done.line).toMatch(/\+1 a la CA/);
    });

    test('la cocina: una ración por salida, más barata con más nivel', () => {
        const one = prepOffers({ guild: guild({ kitchen: 1 }), party: [bran()], purse: 100 });
        const three = prepOffers({ guild: guild({ kitchen: 3 }), party: [bran()], purse: 100 });
        expect(one.rations.map(r => r.kind)).toEqual(['caldo', 'guiso']);
        expect(three.rations[0].cost).toBeLessThan(one.rations[0].cost);
        const stew = prepareFor({ member: bran(), kind: 'guiso', guild: guild({ kitchen: 1 }), purse: 100 });
        const fed = bran({ guildPrep: stew.guildPrep });
        expect(prepareFor({ member: fed, kind: 'caldo', guild: guild({ kitchen: 1 }), purse: 100 }).ok).toBe(false);
        expect(describePrep(fed)[0]).toMatch(/Guiso de camino/);
    });

    test('sin oro no se prepara nada', () => {
        expect(prepareFor({ member: tessa(), kind: 'temple', guild: guild({ forge: 1 }), purse: 5 }).ok).toBe(false);
    });

    test('el guiso da un dado de golpe más en los descansos', () => {
        const base = getHitDice(bran());
        const fed = getHitDice(bran({ guildPrep: { ration: 'guiso' } }));
        expect(fed.total).toBe(base.total + 1);
    });

    test('el caldo: ventaja en la primera salvación, y se gasta', () => {
        const member = bran({ guildPrep: { ration: 'caldo', temper: 1 } });
        const broth = takeBroth(member);
        expect(broth.used).toBe(true);
        expect(prepOf({ guildPrep: broth.guildPrep })).toEqual({ temper: 1, ration: '' });
        expect(takeBroth({ guildPrep: broth.guildPrep }).used).toBe(false);
        const rolls = [3, 17];
        const plan = planAbilityUse({
            actor: { name: 'Bruja' }, target: member, ability: { name: 'Maldición', resolution: 'save', saveDc: 15, target: 'enemy' },
            roll: () => ({ total: rolls.shift() ?? 1 }), saveAdvantage: true,
        });
        expect(plan.saved).toBe(true);
        expect(plan.lines.join(' ')).toMatch(/ventaja/);
    });
});

describe('E5.1 · los libros de bichos de la biblioteca', () => {
    const pack = read('../public/mundos/costa.pack.json');
    const world = { id: 'costa', name: 'La costa que no duerme', bestiary: pack.bestiary };

    test('un libro dice lo que aguanta cada bicho de la campaña', () => {
        const book = writeBook(world);
        expect(book.title).toMatch(/La costa que no duerme/);
        expect(book.creatures.length).toBeGreaterThan(3);
        const facts = book.creatures.flatMap(c => c.facts).join(' ');
        expect(facts).toMatch(/Aguanta la mitad de|Le duele el doble|No le hace nada|punto débil/);
    });

    test('la biblioteca los vende y no repite los que ya tiene', () => {
        const none = bookOffers({ guild: guild(), worlds: [world], books: [], purse: 500 });
        expect(none.offers).toEqual([]);
        const offers = bookOffers({ guild: guild({ library: 1 }), worlds: [world], books: [], purse: 500 });
        expect(offers.offers[0]).toMatchObject({ id: 'costa', ok: true });
        const owned = bookOffers({ guild: guild({ library: 1 }), worlds: [world], books: [writeBook(world)], purse: 500 });
        expect(owned.offers[0]).toMatchObject({ owned: true, ok: false });
    });

    test('en la pelea, «Nombre 2» se lee como «Nombre»', () => {
        const book = writeBook(world);
        const first = book.creatures[0];
        const found = bookFactsFor([book], `${first.name} 2`);
        expect(found?.facts).toEqual(first.facts);
        expect(bookFactsFor(readBooks([book]), 'Nadie que exista')).toBeNull();
    });
});

describe('E5.2 · el banquillo se usa', () => {
    test('quien encadena salidas vuelve cansado; quien se quedó, lo borra', () => {
        const once = homecomingFatigue({ went: [bran()], stayed: [], days: 6 });
        expect(once.went[0]).toEqual({ id: 'p2', outings: 1, injury: null });
        const twice = homecomingFatigue({ went: [bran({ outings: 1 })], stayed: [tessa({ outings: 2 })], days: 6 });
        expect(twice.went[0].injury).toMatchObject({ id: 'cansancio', label: 'Cansado del camino' });
        expect(twice.stayed).toEqual(['p1']);
        expect(fatigueInjury(3)?.label).toBe('Molido del camino');
    });

    test('volver a por algo no cansa', () => {
        const quick = homecomingFatigue({ went: [bran({ outings: 1 })], stayed: [], days: OUTING_MIN_DAYS - 1 });
        expect(quick.went[0]).toEqual({ id: 'p2', outings: 1, injury: null });
    });

    test('el cansancio es una herida de días: baja la velocidad y cura', () => {
        const tired = { ...bran({ speed: 30, strength: 14, dexterity: 12 }) };
        const patch = applyInjury(tired, fatigueInjury(2));
        Object.assign(tired, { injuries: patch.injuries, baseStats: patch.baseStats }, patch.stats);
        expect(tired.speed).toBe(25);
        const healed = healInjuries(tired, 5);
        expect(healed.injuries).toEqual([]);
    });

    test('la enfermería cura antes a quien se queda en casa', () => {
        expect(infirmaryDays(guild(), 2)).toBe(2);
        expect(infirmaryDays(guild({ infirmary: 2 }), 2)).toBe(6);
    });

    test('cada uno dice cómo está, y la sala lo resume', () => {
        const hurt = applyInjury(bran(), { id: 'broken_leg', label: 'Pierna rota', description: '', modifiers: { speed: -10 }, days: 14 });
        const tired = applyInjury(tessa(), fatigueInjury(2));
        const rows = restRoster({
            party: [tessa({ injuries: tired.injuries, outings: 2 })],
            bench: [bran({ injuries: hurt.injuries })],
            away: [{ contract: { title: 'Escoltar al molinero' }, backOn: 9, members: [{ id: 'p3', name: 'Nella' }] }],
            guild: guild({ infirmary: 1 }),
        });
        expect(rows.map(r => r.where)).toEqual(['grupo', 'casa', 'fuera']);
        expect(rows[0]).toMatchObject({ tired: true, hero: true, mood: 'triste' });
        expect(rows[0].says).toMatch(/salidas seguidas/);
        expect(rows[1].says).toMatch(/pierna rota/);
        expect(rows[1].says).toMatch(/enfermería/);
        expect(rows[2].state).toMatch(/día 9/);
        expect(restDetail(rows, 1)).toBe('Alguien ha vuelto y te espera · 1 herido · 1 cansado · 1 fuera');
        expect(readInjuries({ injuries: tired.injuries })[0].daysLeft).toBe(5);
    });
});

describe('E5.3 · la tarjeta de informe la cuentan los que vuelven', () => {
    const dispatch = {
        id: 'despacho-c1-4', contract: { id: 'c1', title: 'Escoltar al molinero', kind: 'escort', reward: 30 },
        members: [bran(), { id: 'p3', name: 'Nella', gender: 'Mujer' }], backOn: 7,
    };

    test('salió bien: el oro, y una anécdota o un camino nuevo', () => {
        const report = dispatchReport({ dispatch, result: { success: true, reward: 30, hurt: '', dead: '' }, renown: 1, random: () => 0.9 });
        expect(report).toMatchObject({ success: true, reward: 30, map: false, renown: 1 });
        const scene = reportScene(report);
        expect(scene.beats.every(b => b.who)).toBe(true);
        expect(scene.beats[0]).toMatchObject({ who: 'Bran', mood: 'alegre' });
        expect(scene.beats[0].text).toMatch(/30 de oro/);
        expect(scene.beats.map(b => b.text).join(' ')).toMatch(/se habla del gremio/);
        const mapped = reportScene({ ...report, map: true }, { revealed: 'la Cueva del Eco' });
        expect(mapped.beats[1].text).toMatch(/la Cueva del Eco/);
    });

    test('salió mal: quien vuelve herido lo dice; si no vuelve nadie, lo trae un mensajero', () => {
        const report = dispatchReport({
            dispatch, result: { success: false, reward: 0, hurt: 'p2', dead: '' }, injury: { label: 'Costillas rotas', days: 12 }, random: () => 0.1,
        });
        const scene = reportScene(report);
        expect(scene.beats.find(b => b.who === 'Bran' && /costillas rotas/.test(b.text))).toBeTruthy();
        const alone = { ...dispatch, members: [bran()] };
        const lost = reportScene(dispatchReport({ dispatch: alone, result: { success: false, reward: 0, hurt: '', dead: 'p2' }, random: () => 0.5 }));
        expect(lost.beats[0].who).toBe('Un mensajero del gremio');
        expect(lost.beats[0].text).toMatch(/Bran no vuelve/);
    });
});
