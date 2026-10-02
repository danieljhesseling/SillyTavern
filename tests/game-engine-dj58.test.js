/**
 * D-J58 (Daniel, 2026-10-02): las facciones, como historia y no como simulación.
 *
 * Con el interruptor apagado (lo que trae el juego): los días pasan y ningún reloj de facción se
 * mueve, los precios no cambian por quién manda, no sale ningún suceso por el reloj de nadie, y
 * nada lo cuenta. Pero la reputación sigue cambiando, y con ella se abren los caminos, cortan el
 * paso los que os tienen ganas y se decide el final. Encendido (el mundo semiabierto), todo como
 * antes.
 */

import { describe, test, expect, afterEach } from '@jest/globals';
import { readFileSync } from 'node:fs';
import {
    FACTION_WORLD, factionWorldOn, tickFactions, pushFaction, busyFactions, newsFor, priceFactor,
    describeFaction, changeStanding, standingWith, readFactions,
} from '../public/scripts/game-engine/campaign/factions.js';
import { marketPressure, warPressure, applyMarket, describeMarket } from '../public/scripts/game-engine/campaign/economy.js';
import { passesTriggers, sucesoWorld, describeWorldEffect, mergeSucesoRows } from '../public/scripts/game-engine/campaign/suceso-triggers.js';
import { describeEffect } from '../public/scripts/game-engine/campaign/sucesos.js';
import { affairsOf } from '../public/scripts/game-engine/campaign/week-table.js';
import { upcoming } from '../public/scripts/game-engine/campaign/upcoming.js';
import { describeStake } from '../public/scripts/game-engine/campaign/contracts.js';
import { gateRoutes } from '../public/scripts/game-engine/world/route-gates.js';
import { reachFrom } from '../public/scripts/game-engine/world/travel.js';
import { roadTrouble } from '../public/scripts/game-engine/campaign/world-memory.js';
import { chooseEnding } from '../public/scripts/game-engine/campaign/plot.js';
import { letterRows } from '../public/scripts/game-engine/rules/modes.js';

const json = (/** @type {string} */ path) => JSON.parse(readFileSync(new URL(`../public/${path}`, import.meta.url), 'utf8'));
const p1387 = json('mundos/1387.pack.json');
const strahd = json('mundos/strahd.pack.json');
const compendio = json('compendio/sucesos.json').rows;

/** Las facciones de 1387, con la reputación que se quiera. */
const factions1387 = (/** @type {Record<string, number>} */ rep = {}) => p1387.world.factions
    .map((/** @type {any} */ f) => ({ ...f, reputation: rep[f.id] ?? f.reputation ?? 0 }));
const visible = (/** @type {any} */ pack) => pack.locations.filter((/** @type {any} */ l) => !l.hidden);
const clocks = (/** @type {any[]} */ list) => readFactions(list).map(f => `${f.id}:${f.goal.at}/${f.goal.days}`);

// Cada prueba deja el interruptor como lo trae el juego.
afterEach(() => { FACTION_WORLD.on = false; });

describe('D-J58: el interruptor', () => {
    test('viene apagado, en un solo sitio', () => {
        expect(FACTION_WORLD.on).toBe(false);
        expect(factionWorldOn()).toBe(false);
    });
});

describe('D-J58 apagado: la simulación no se mueve ni se cuenta', () => {
    test('pasan los días (un mes en 1387) y ningún reloj de facción se mueve', () => {
        const before = factions1387();
        const { factions, events } = tickFactions({ factions: before, days: 30, here: 'El Pueblo de Barro' });
        expect(events).toEqual([]);
        expect(clocks(factions)).toEqual(clocks(before));
        // Ni un día suelto, ni muchos de golpe.
        expect(tickFactions({ factions: before, days: 1 }).events).toEqual([]);
    });

    test('un encargo o un suceso no empuja ningún reloj', () => {
        const { factions, event } = pushFaction(factions1387(), 'la-casa-keller', -1);
        expect(event).toBeNull();
        expect(clocks(factions)).toEqual(clocks(factions1387()));
    });

    test('los precios no cambian por quién manda en el sitio', () => {
        // El Pueblo de Barro es de los Leales, que además tienen un plan en marcha.
        const pressure = marketPressure({ here: 'El Pueblo de Barro', locations: visible(p1387), factions: factions1387({ 'leales-de-montesclaros': -3 }) });
        expect(pressure).toEqual({ food: 1, tax: 1, reasons: [], holder: '', cut: false });
        expect(describeMarket(pressure)).toBe('');
        const prices = { foodPerDay: 2, lodgingPerWeek: 10, taxPerWeek: 5, wagePerWeek: 7 };
        expect(applyMarket(prices, pressure)).toEqual(prices);
        // Ni la guerra encarece el acero, ni lo que piensan de ti la tienda.
        expect(warPressure({ here: 'Castillo de Vane', factions: factions1387() })).toEqual({ steel: 1, reasons: [] });
        expect(priceFactor(5)).toBe(1);
        expect(priceFactor(-5)).toBe(1);
    });

    test('no sale ningún suceso por el reloj de una facción, y su efecto ni se dice', () => {
        const rows = mergeSucesoRows(compendio, p1387.sucesos);
        const keller = rows.find(r => r.id === 'avanzadas-de-keller');
        // Aunque el reloj de los Keller fuera por la mitad.
        const late = factions1387().map(f => (f.id === 'la-casa-keller' ? { ...f, goal: { ...f.goal, at: 4, of: 6 } } : f));
        expect(passesTriggers(keller, sucesoWorld({ factions: late, here: 'El Pueblo de Barro' }))).toBe(false);
        expect(passesTriggers({ when: { relojAqui: [0, 99] } }, sucesoWorld({ factions: late, here: 'Campamento Keller' }))).toBe(false);
        expect(describeWorldEffect('reloj:la-corte-de-strahd:-1', { 'la-corte-de-strahd': 'La corte de Strahd' })).toBe('');
        expect(describeEffect('reloj:la-corte-de-strahd:-1', { 'la-corte-de-strahd': 'La corte de Strahd' })).toBe('');
    });

    test('nada lo cuenta: ni noticias, ni la Mesa, ni «Lo que viene», ni el tablón, ni el Diario', () => {
        const late = factions1387().map(f => ({ ...f, goal: { ...f.goal, at: 4, of: 6, days: 0 } }));
        const events = [{ faction: 'leales-de-montesclaros', kind: 'avanza', target: 'El Pueblo de Barro', note: 'Leales de Montesclaros: 5 de 6.' }];
        expect(newsFor({ events, here: 'El Pueblo de Barro', locations: visible(p1387), factions: late })).toEqual([]);
        expect(affairsOf({ today: 3, factions: late }).filter(a => a.kind === 'faccion')).toEqual([]);
        expect(upcoming({ today: 3, factions: late }).filter(u => u.kind === 'faccion')).toEqual([]);
        expect(busyFactions(late)).toEqual([]);
        // El Diario («Ahí fuera»): quiénes son y qué piensan de ti, sin reloj.
        const line = describeFaction(late[0]);
        expect(line).toBe('Leales de Montesclaros (Castillo de Vane) · no saben quién sois');
        expect(line).not.toMatch(/de 6|quieren|días/);
        // Un encargo que toma partido dice lo que cambia de verdad: lo que piensan de ti.
        expect(describeStake({ faction: 'x', against: true }, 'Los Lobos del Bosque')).toBe('Si sale bien, Los Lobos del Bosque os mirarán peor.');
        expect(describeStake({ faction: 'x', against: false }, 'La Casa Keller')).toBe('Si sale bien, La Casa Keller os mirará mejor.');
        // Y el modo no promete que las facciones avancen.
        expect(letterRows({}).find(r => r.id === 'c')?.note).not.toMatch(/facciones/i);
    });
});

describe('D-J58 apagado: la reputación sigue siendo historia', () => {
    test('la reputación cambia, y su enemigo lo nota al revés', () => {
        const moved = changeStanding(factions1387(), 'leales-de-montesclaros', 1);
        expect(standingWith(moved, 'leales-de-montesclaros')).toBe(1);
        expect(standingWith(moved, 'los-lobos-del-bosque')).toBe(-1);
        expect(standingWith(moved, 'la-casa-keller')).toBe(-2);
    });

    test('el camino de la granja en 1387 se abre al caerles bien a los Leales', () => {
        const shut = { here: 'El Pueblo de Barro', factions: factions1387(), fame: {}, keys: [] };
        expect(reachFrom({ from: 'El Pueblo de Barro', locations: gateRoutes(visible(p1387), shut) })['La Granja Quemada'].reach).toBe('shut');
        const friends = { ...shut, factions: changeStanding(factions1387(), 'leales-de-montesclaros', 1) };
        expect(reachFrom({ from: 'El Pueblo de Barro', locations: gateRoutes(visible(p1387), friends) })['La Granja Quemada'].reach).toBe('near');
    });

    test('quien os tiene ganas os corta el paso en el camino', () => {
        const hostile = factions1387({ 'la-casa-keller': -3 });
        expect(roadTrouble({ factions: hostile, places: ['El Peaje Norte'], purse: 100 })?.name).toBe('Los de la Casa Keller os cortan el paso');
    });

    test('los sucesos por reputación y por quién manda aquí siguen saliendo', () => {
        const rows = mergeSucesoRows(compendio, p1387.sucesos);
        const lobos = rows.find(r => r.id === 'lobos-piden-un-carro');
        const leales = rows.find(r => r.id === 'leales-cobran-el-paso');
        expect(passesTriggers(lobos, sucesoWorld({ factions: factions1387({ 'los-lobos-del-bosque': 2 }), here: 'El Camino Viejo' }))).toBe(true);
        expect(passesTriggers(leales, sucesoWorld({ factions: factions1387({ 'leales-de-montesclaros': -1 }), here: 'El Pueblo de Barro' }))).toBe(true);
        expect(describeWorldEffect('faccion:los-vistani:+1', { 'los-vistani': 'Los Vistani' })).toBe('Los Vistani: os miran mejor');
    });

    test('el final de Strahd lo decide a quién os habéis ganado', () => {
        const final = strahd.plot.milestones.find((/** @type {any} */ m) => Object.keys(m.changes?.endingBy ?? {}).length > 0);
        expect(final).toBeTruthy();
        const [[first, ending]] = Object.entries(final.changes.endingBy);
        const won = strahd.world.factions.map((/** @type {any} */ f) => ({ ...f, reputation: f.id === first ? 5 : 0 }));
        expect(chooseEnding(final.changes, won)).toBe(ending);
    });
});

describe('D-J58 encendido (el mundo semiabierto): todo como antes', () => {
    test('los relojes avanzan, los precios cambian y sale el suceso del reloj', () => {
        FACTION_WORLD.on = true;
        expect(factionWorldOn()).toBe(true);
        const { events } = tickFactions({ factions: factions1387(), days: 10, here: 'El Molino' });
        expect(events.some(e => e.kind === 'avanza' || e.kind === 'cumple')).toBe(true);
        expect(pushFaction(factions1387(), 'la-casa-keller', 1).event).not.toBeNull();
        expect(marketPressure({ here: 'El Pueblo de Barro', locations: visible(p1387), factions: factions1387() }).tax).toBeGreaterThan(1);
        expect(priceFactor(4)).toBeLessThan(1);
        const keller = mergeSucesoRows(compendio, p1387.sucesos).find(r => r.id === 'avanzadas-de-keller');
        const late = factions1387().map(f => (f.id === 'la-casa-keller' ? { ...f, goal: { ...f.goal, at: 4, of: 6 } } : f));
        expect(passesTriggers(keller, sucesoWorld({ factions: late, here: 'El Pueblo de Barro' }))).toBe(true);
        expect(describeWorldEffect('reloj:la-corte-de-strahd:-1', { 'la-corte-de-strahd': 'La corte de Strahd' })).toBe('La corte de Strahd se retrasa en lo suyo');
        expect(busyFactions(factions1387()).length).toBeGreaterThan(0);
        expect(letterRows({}).find(r => r.id === 'c')?.note).toMatch(/facciones avanzan/i);
    });
});
