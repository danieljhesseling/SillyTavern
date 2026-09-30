/**
 * El mundo de cada campaña, vivo (J10.1, J10.3 con D-J42 y J10.5 de wiki/ROADMAP_SIN_CONEXION.md),
 * con los datos de verdad de 1387 y de Strahd: los caminos que se abren por reputación, por fama,
 * con una barca o con un guía; los sucesos que salen por cómo os mira cada facción, y los propios
 * de cada campaña; y el mapa dibujado, con sus puertas.
 */

import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import {
    gateRoutes, gateStatus, keyringOf, newlyOpened, describeOpened, gateWarnings,
} from '../public/scripts/game-engine/world/route-gates.js';
import { reachFrom, planTravel } from '../public/scripts/game-engine/world/travel.js';
import { mapModel } from '../public/scripts/game-engine/world/map-layout.js';
import {
    sucesoWorld, readCampaignSucesos, mergeSucesoRows, checkCampaignSucesos, readSucesoEffect, describeWorldEffect,
} from '../public/scripts/game-engine/campaign/suceso-triggers.js';
import { pickSucesos, sucesoById } from '../public/scripts/game-engine/campaign/sucesos.js';
import { SKILLS } from '../public/scripts/game-engine/rules/checks.js';
import { addMark, rememberedGreeting, rememberedPrice, refusal } from '../public/scripts/game-engine/campaign/world-marks.js';

const json = (/** @type {string} */ path) => JSON.parse(readFileSync(new URL(`../public/${path}`, import.meta.url), 'utf8'));
const p1387 = json('mundos/1387.pack.json');
const strahd = json('mundos/strahd.pack.json');
const compendio = json('compendio/sucesos.json').rows;

/** Los sitios que se ven al empezar (sin los escondidos), como los guarda el juego. */
const visible = (/** @type {any} */ pack) => pack.locations.filter((/** @type {any} */ l) => !l.hidden);
/** Las facciones del paquete, con la reputación que se quiera. */
const factions = (/** @type {any} */ pack, /** @type {Record<string, number>} */ rep = {}) => pack.world.factions
    .map((/** @type {any} */ f) => ({ ...f, reputation: rep[f.id] ?? f.reputation ?? 0 }));
/** Un azar repetible. */
const rolling = (/** @type {number} */ seed) => {
    let state = seed;
    return () => ((state = (state * 9301 + 49297) % 233280) / 233280);
};

describe('J10.1: caminos que se abren por reputación, por fama, con una barca o con un guía', () => {
    test('en 1387, la granja está cerrada al empezar, y el viaje dice por qué y qué la abre', () => {
        const context = { here: 'El Pueblo de Barro', factions: factions(p1387, { 'leales-de-montesclaros': -1 }), fame: {}, keys: [] };
        const places = gateRoutes(visible(p1387), context);
        const reach = reachFrom({ from: 'El Pueblo de Barro', locations: places });
        expect(reach['La Granja Quemada'].reach).toBe('shut');
        expect(reach['La Granja Quemada'].reason).toBe('Desde el incendio, los hombres de Vane vigilan el sendero de la granja y no dejan pasar a forasteros. '
            + 'Se abre si Leales de Montesclaros os conocen o si en El Pueblo de Barro sois alguien');
        const plan = planTravel({ from: 'El Pueblo de Barro', to: 'La Granja Quemada', locations: places, directOnly: true });
        expect(plan.ok).toBe(false);
        expect(plan.reason).toMatch(/^El paso de "El Pueblo de Barro" a "La Granja Quemada" está cerrado\. .*Se abre si Leales de Montesclaros os conocen/);
        // Los otros vecinos siguen abiertos: la puerta es de ese camino, no del pueblo.
        expect(reach['El Camino Viejo'].reach).toBe('near');
        expect(reach['Castillo de Vane'].reach).toBe('near');
    });

    test('se abre al caerles bien a los Leales, o al ser conocidos en el pueblo, y se dice una vez', () => {
        const locations = visible(p1387);
        const shut = { here: 'El Pueblo de Barro', factions: factions(p1387, { 'leales-de-montesclaros': -1 }), fame: {}, keys: [] };
        const baseline = newlyOpened(undefined, gateStatus(locations, shut));
        expect(baseline.opened).toEqual([]);
        // Tras llegar al castillo (el hito da +2 a los Leales): de −1 a +1.
        const friends = { ...shut, factions: factions(p1387, { 'leales-de-montesclaros': 1 }) };
        expect(reachFrom({ from: 'El Pueblo de Barro', locations: gateRoutes(locations, friends) })['La Granja Quemada'].reach).toBe('near');
        const now = newlyOpened(baseline.open, gateStatus(locations, friends));
        expect(now.opened.map(g => `${g.from}→${g.to}`)).toEqual(['El Pueblo de Barro→La Granja Quemada']);
        expect(describeOpened(now.opened[0])).toBe('Se os abre el camino de El Pueblo de Barro a La Granja Quemada: Leales de Montesclaros os conocen.');
        // Y la segunda vez ya no es noticia.
        expect(newlyOpened(now.open, gateStatus(locations, friends)).opened).toEqual([]);
        // O por la fama en el pueblo, aunque los Leales os miren mal: no basta con la de la
        // primera pelea (la de la posada da dos puntos), hace falta que allí seáis alguien.
        const first = { ...shut, fame: { 'El Pueblo de Barro': 2 } };
        expect(reachFrom({ from: 'El Pueblo de Barro', locations: gateRoutes(locations, first) })['La Granja Quemada'].reach).toBe('shut');
        const known = { ...shut, fame: { 'El Pueblo de Barro': 5 } };
        expect(reachFrom({ from: 'El Pueblo de Barro', locations: gateRoutes(locations, known) })['La Granja Quemada'].reach).toBe('near');
    });

    test('nadie se queda atrapado: desde la granja siempre se puede volver al pueblo', () => {
        const context = { here: 'La Granja Quemada', factions: factions(p1387, { 'leales-de-montesclaros': -3 }), fame: {}, keys: [] };
        const reach = reachFrom({ from: 'La Granja Quemada', locations: gateRoutes(visible(p1387), context) });
        expect(reach['El Pueblo de Barro'].reach).toBe('near');
    });

    test('el hielo del lago se cruza con Finn de guía; sin él, se dice el rodeo y por qué no el atajo', () => {
        const locations = visible(p1387);
        const alone = { here: 'La Ermita Derruida', factions: factions(p1387), fame: {}, keys: keyringOf({ party: [{ name: 'Tessa', items: [] }], worldKeys: [] }) };
        const far = reachFrom({ from: 'La Ermita Derruida', locations: gateRoutes(locations, alone) })['El Lago Helado'];
        expect(far.reach).toBe('far');
        expect(far.reason).toMatch(/El paso directo está cerrado: Por el lado de la ermita, el hielo del lago está podrido.*Se abre si Finn os guía o si en El Lago Helado os conocen\.$/);
        // `guia:Finn` de un suceso lo deja apuntado (worldKeys); o Finn va en el grupo.
        const guided = { ...alone, keys: keyringOf({ party: [{ name: 'Tessa', items: [] }], worldKeys: ['Finn'] }) };
        expect(reachFrom({ from: 'La Ermita Derruida', locations: gateRoutes(locations, guided) })['El Lago Helado'].reach).toBe('near');
        const joined = { ...alone, keys: keyringOf({ party: [{ name: 'Tessa', items: [] }, { name: 'Finn', items: [] }] }) };
        expect(reachFrom({ from: 'La Ermita Derruida', locations: gateRoutes(locations, joined) })['El Lago Helado'].reach).toBe('near');
    });

    test('en Strahd, la torre del islote solo con la barca de Nikolai, por cualquier orilla', () => {
        // Revelados la torre y la guarida (lo hace «Pánico en el festival»).
        const locations = strahd.locations.filter((/** @type {any} */ l) => !l.hidden || ['Torre de Van Richten', 'Guarida de los Hombres Lobo'].includes(l.name));
        const none = { here: 'Aldea de Krezk', factions: factions(strahd), fame: {}, keys: [] };
        const shut = reachFrom({ from: 'Aldea de Krezk', locations: gateRoutes(locations, none) })['Torre de Van Richten'];
        expect(shut.reach).toBe('shut');
        expect(shut.reason).toBe('La torre está en un islote del lago, y solo se llega en barca. Se abre con la barca de Nikolai o si en Aldea de Krezk os conocen');
        for (const from of ['Argynvostholt', 'Guarida de los Hombres Lobo']) {
            expect(reachFrom({ from, locations: gateRoutes(locations, { ...none, here: from }) })['Torre de Van Richten'].reach).not.toBe('near');
        }
        const boat = { ...none, keys: keyringOf({ party: [], worldKeys: ['La barca de Nikolai'] }) };
        expect(reachFrom({ from: 'Aldea de Krezk', locations: gateRoutes(locations, boat) })['Torre de Van Richten'].reach).toBe('near');
        const opened = gateStatus(locations, boat).find(g => g.from === 'Aldea de Krezk' && g.to === 'Torre de Van Richten');
        expect(opened && describeOpened(opened)).toBe('Se os abre el camino de Aldea de Krezk a Torre de Van Richten: tenéis la barca de Nikolai.');
    });

    test('y la cascada del Tser, cuando los vistani os conocen (tras la tienda de Madam Eva)', () => {
        const locations = strahd.locations.filter((/** @type {any} */ l) => !l.hidden || l.name === 'La Cascada del Tser');
        const before = { here: 'Campamento del Estanque Tser', factions: factions(strahd), fame: {}, keys: [] };
        expect(reachFrom({ from: 'Campamento del Estanque Tser', locations: gateRoutes(locations, before) })['La Cascada del Tser'].reason)
            .toMatch(/Se abre si Los Vistani os conocen/);
        const after = { ...before, factions: factions(strahd, { 'los-vistani': 1 }) };
        expect(reachFrom({ from: 'Campamento del Estanque Tser', locations: gateRoutes(locations, after) })['La Cascada del Tser'].reach).toBe('near');
    });

    test('las puertas de los dos paquetes están bien escritas', () => {
        expect(gateWarnings(p1387)).toEqual([]);
        expect(gateWarnings(strahd)).toEqual([]);
    });
});

describe('J10.3 y D-J42: sucesos por facción y reputación, y los propios de cada campaña', () => {
    const rows1387 = mergeSucesoRows(compendio, p1387.sucesos);
    const rowsStrahd = mergeSucesoRows(compendio, strahd.sucesos);

    test('los sucesos de los paquetes están bien escritos, y se juntan con los del compendio', () => {
        const skills = Object.keys(SKILLS);
        expect(checkCampaignSucesos(p1387.sucesos, { factions: p1387.world.factions, skills })).toEqual([]);
        expect(checkCampaignSucesos(strahd.sucesos, { factions: strahd.world.factions, skills })).toEqual([]);
        expect(readCampaignSucesos(p1387.sucesos)).toHaveLength(p1387.sucesos.length);
        expect(rows1387.length).toBe(compendio.length + p1387.sucesos.length);
        // La continuación de un suceso de campaña también se lee (vuelve con su `follow`).
        expect(readCampaignSucesos([{ id: 'x', text: 'Vuelve.', when: { momento: 'continuacion' }, options: [{ label: 'a' }, { label: 'b' }] }])).toHaveLength(1);
    });

    test('los hombres de Vane os paran al llegar solo si os miran mal, y el texto dice quiénes son', () => {
        const random = rolling(4);
        const facts = { sitio: 'El Pueblo de Barro' };
        const cold = sucesoWorld({ factions: factions(p1387, { 'leales-de-montesclaros': -1 }), here: 'El Pueblo de Barro' });
        const warm = sucesoWorld({ factions: factions(p1387, { 'leales-de-montesclaros': 1 }), here: 'El Pueblo de Barro' });
        const ids = (/** @type {any} */ world) => pickSucesos({ rows: rows1387, moment: 'llegada', facts, count: 20, random, world }).map(s => s.id);
        expect(ids(cold)).toContain('leales-cobran-el-paso');
        expect(ids(warm)).not.toContain('leales-cobran-el-paso');
        // Más abajo ya os cobran el peaje del camino (`roadTrouble`): no se cobra dos veces.
        const hostile = sucesoWorld({ factions: factions(p1387, { 'leales-de-montesclaros': -2 }), here: 'El Pueblo de Barro' });
        expect(ids(hostile)).not.toContain('leales-cobran-el-paso');
        // Sin saber cómo está el mundo, no sale.
        expect(ids(null)).not.toContain('leales-cobran-el-paso');
        const card = sucesoById(rows1387, 'leales-cobran-el-paso', facts, cold);
        expect(card?.text).toMatch(/^Tres hombres con el emblema de Leales de Montesclaros/);
    });

    test('Finn solo sale en el lago; y los Lobos piden ayuda por el camino cuando os conocen', () => {
        const world = sucesoWorld({ factions: factions(p1387, { 'los-lobos-del-bosque': 1 }), here: 'El Camino Viejo' });
        const atLake = pickSucesos({ rows: rows1387, moment: 'llegada', facts: { sitio: 'El Lago Helado' }, count: 20, random: rolling(2), world }).map(s => s.id);
        const atVillage = pickSucesos({ rows: rows1387, moment: 'llegada', facts: { sitio: 'El Pueblo de Barro' }, count: 20, random: rolling(2), world }).map(s => s.id);
        expect(atLake).toContain('finn-conoce-el-hielo');
        expect(atVillage).not.toContain('finn-conoce-el-hielo');
        const road = pickSucesos({ rows: rows1387, moment: 'viaje', facts: { sitio: 'El Camino Viejo', destino: 'Castillo de Vane' }, count: 30, random: rolling(6), world });
        const wolves = road.find(s => s.id === 'lobos-piden-un-carro');
        expect(wolves?.text).toMatch(/^Camino de Castillo de Vane, un muchacho de Los Lobos del Bosque/);
        const cold = sucesoWorld({ factions: factions(p1387), here: 'El Camino Viejo' });
        expect(pickSucesos({ rows: rows1387, moment: 'viaje', facts: { sitio: 'El Camino Viejo', destino: 'X' }, count: 30, random: rolling(6), world: cold }).map(s => s.id))
            .not.toContain('lobos-piden-un-carro');
    });

    test('los guardias con ganas y el recado de quien manda salen en cualquier campaña, según os miren', () => {
        const at = (/** @type {number} */ rep) => pickSucesos({
            rows: rowsStrahd, moment: 'llegada', facts: { sitio: 'Aldea de Barovia' }, count: 30, random: rolling(8),
            world: sucesoWorld({ factions: factions(strahd, { 'la-corte-de-strahd': rep }), here: 'Aldea de Barovia' }),
        }).map(s => s.id);
        expect(at(-3)).toContain('guardias-con-ganas');
        expect(at(-3)).not.toContain('recado-de-quien-manda');
        // A −2 ya pagáis el peaje del camino: los guardias no salen además.
        expect(at(-2)).not.toContain('guardias-con-ganas');
        expect(at(3)).toContain('recado-de-quien-manda');
        expect(at(0)).not.toContain('guardias-con-ganas');
        // Y en el gremio (nadie manda allí), ninguno de los dos.
        expect(pickSucesos({ rows: compendio, moment: 'llegada', facts: { sitio: 'Puerto Alba' }, count: 30, random: rolling(8), world: sucesoWorld({ factions: [], here: 'Puerto Alba' }) })
            .map(s => s.id)).not.toContain('guardias-con-ganas');
    });

    test('la barca de Nikolai sale en Krezk y da la llave del islote; los efectos se dicen en llano', () => {
        const world = sucesoWorld({ factions: factions(strahd), here: 'Aldea de Krezk' });
        const card = pickSucesos({ rows: rowsStrahd, moment: 'llegada', facts: { sitio: 'Aldea de Krezk' }, count: 20, random: rolling(1), world })
            .find(s => s.id === 'la-barca-de-nikolai');
        expect(card?.options[0].effects).toEqual(['llave:La barca de Nikolai']);
        expect(readSucesoEffect('llave:La barca de Nikolai')).toEqual({ kind: 'llave', target: 'La barca de Nikolai', amount: 0, raw: 'llave:La barca de Nikolai' });
        expect(describeWorldEffect('llave:La barca de Nikolai')).toBe('conseguís: La barca de Nikolai');
        expect(describeWorldEffect('guia:Finn')).toBe('Finn os guiará');
        expect(describeWorldEffect('faccion:los-vistani:+1', { 'los-vistani': 'Los Vistani' })).toBe('Los Vistani: os miran mejor');
        expect(describeWorldEffect('reloj:la-corte-de-strahd:-1', { 'la-corte-de-strahd': 'La corte de Strahd' })).toBe('La corte de Strahd se retrasa en lo suyo');
    });
});

describe('J10.5: el mapa dibujado, con lo visitado, las notas y las puertas', () => {
    test('los sitios que se ven, el camino cerrado con su candado y lo que pide, y tu nota', () => {
        const context = { here: 'El Pueblo de Barro', factions: factions(p1387, { 'leales-de-montesclaros': -1 }), fame: {}, keys: [] };
        const locations = gateRoutes(visible(p1387), context);
        const model = mapModel({
            locations, here: 'El Pueblo de Barro', visited: ['El Pueblo de Barro', 'Castillo de Vane'],
            notes: { 'Castillo de Vane': 'La plata de Vane es de cobre.' }, gates: gateStatus(visible(p1387), context),
        });
        expect(model.places.map(p => p.name).sort()).toEqual(visible(p1387).map((/** @type {any} */ l) => l.name).sort());
        expect(model.places.find(p => p.name === 'El Pueblo de Barro')?.state).toBe('aqui');
        expect(model.places.find(p => p.name === 'Castillo de Vane')?.note).toBe('La plata de Vane es de cobre.');
        expect(model.places.find(p => p.name === 'El Lago Helado')?.state).toBe('sin-visitar');
        const farm = model.roads.find(r => [r.a, r.b].sort().join('|') === 'El Pueblo de Barro|La Granja Quemada');
        expect(farm?.closed).toBe(true);
        expect(farm?.gate?.kinds).toEqual(['standing', 'fame']);
        expect(farm?.note).toMatch(/Se abre si Leales de Montesclaros os conocen/);
        expect(model.places.find(p => p.name === 'La Granja Quemada')?.reach).toBe('shut');
        // Ningún sitio encima de otro, y todos dentro del dibujo.
        for (const place of model.places) {
            expect(place.x).toBeGreaterThanOrEqual(4);
            expect(place.x).toBeLessThanOrEqual(96);
        }
        // El mismo mundo sale siempre igual.
        expect(mapModel({ locations, here: 'El Pueblo de Barro' }).places.map(p => [p.x, p.y]))
            .toEqual(mapModel({ locations, here: 'El Pueblo de Barro' }).places.map(p => [p.x, p.y]));
    });
});

describe('J11.3: lo que queda de ecos.json, además del robo en la tienda', () => {
    const rows = json('compendio/ecos.json').rows;
    const smithy = { kind: 'herreria', keeper: { name: 'Dunstan' } };
    const chapel = { kind: 'templo', keeper: { name: 'Hermano Silas' } };
    const say = (/** @type {any} */ marks, /** @type {any} */ place) => rememberedGreeting({ place, town: 'El Pueblo de Barro', marks, rows, today: 6, hero: { name: 'Irene', gender: 'Mujer' } });

    test('huir de la guardia: en todo el pueblo lo saben, y cobran más', () => {
        const marks = addMark([], { deed: 'huida', town: 'El Pueblo de Barro', day: 5 });
        expect(say(marks, smithy)).toMatch(/^Dunstan baja la voz: «Hola, Irene\. La guardia ha preguntado por ti/);
        expect(rememberedPrice({ marks, rows, town: 'El Pueblo de Barro', place: 'herreria', today: 6 })).toEqual({ factor: 1.2, label: 'saben que huiste de la guardia' });
    });

    test('pagar la multa: estáis en paz, sin precio de más; y lo del robo en la tienda manda sobre ello allí', () => {
        const paid = addMark(addMark([], { deed: 'robo', town: 'El Pueblo de Barro', place: 'tienda', day: 4 }), { deed: 'multa', town: 'El Pueblo de Barro', day: 5 });
        expect(say(paid, smithy)).toMatch(/Pagaste la multa, así que estamos en paz/);
        expect(rememberedPrice({ marks: paid, rows, town: 'El Pueblo de Barro', place: 'herreria', today: 6 }).factor).toBe(1);
        expect(say(paid, { kind: 'tienda', keeper: { name: 'Vera' } })).toMatch(/^Vera/);
        expect(say(paid, { kind: 'tienda', keeper: { name: 'Vera' } })).not.toMatch(/multa/);
    });

    test('la nigromancia: en la capilla no os atienden; el caso resuelto, más barato', () => {
        const dark = addMark([], { deed: 'nigromancia', town: 'El Pueblo de Barro', day: 5 });
        expect(refusal({ place: chapel, town: 'El Pueblo de Barro', marks: dark, rows, today: 6 })).toMatch(/^Hermano Silas se pone entre el altar y la puerta/);
        const solved = addMark([], { deed: 'caso-resuelto', town: 'El Pueblo de Barro', day: 5 });
        expect(rememberedPrice({ marks: solved, rows, town: 'El Pueblo de Barro', place: 'herreria', today: 6 }).factor).toBe(0.9);
        expect(say(solved, smithy)).toMatch(/aclaró lo del caso/);
    });
});
