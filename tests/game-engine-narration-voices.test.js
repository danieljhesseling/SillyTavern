import { readFileSync } from 'node:fs';
import { describe, test, expect } from '@jest/globals';
import {
    voiceNote, voiceArrivalHook, voiceCoverage, VOICE_KINDS, VOICE_FALLBACKS, coinWords, someone,
} from '../public/scripts/game-engine/campaign/narration-voices.js';
import { leftoverMarkers } from '../public/scripts/game-engine/campaign/grammar.js';
import { validateBattery } from '../public/scripts/game-engine/compendio/compendio.js';

const bank = JSON.parse(readFileSync(new URL('../public/compendio/frases.json', import.meta.url), 'utf8'));
const rows = bank.rows;

/** El pueblo del gremio: quien atiende cada sitio, como lo da el mundo. */
const guild = {
    keepers: {
        tienda: { name: 'Marisa', gender: 'f' },
        posada: { name: 'Tomás', gender: 'm' },
        templo: { name: 'Madre Elvira', gender: 'f' },
        gremio: { name: 'Brunilda', gender: 'f' },
    },
    services: ['posada', 'tienda', 'templo', 'herreria'],
    companions: [],
    party: [{ name: 'Irene', gender: 'f' }],
};

/** Lo que no puede leerse en la caja (J18.10): etiquetas, cifras de registro, llaves sin resolver. */
const LOG = /\[[\p{Lu} ]+\]|\(\s*\d+[^)]*\)|\d+\s*\/\s*\d+|\b\d+\s*de oro\b|[{}|]/u;

const say = (/** @type {string} */ note, /** @type {any} */ scene = guild, turn = 0) => voiceNote(note, { scene, rows, seed: 'prueba', turn, who: { heroe: 'f', grupo: ['f'] } });

// D-J54 (Daniel, 2026-10-02): el narrador casi desaparece; las notas del juego las dice la gente.
describe('voiceNote: who says each note (D-J54)', () => {
    test('the shopkeeper says the price of what you buy, in words', () => {
        const voiced = say('🛒 [TIENDA] Irene compra Frasco de aceite por 9 de oro.');
        expect(voiced.mode).toBe('line');
        expect(voiced.who).toBe('Marisa');
        expect(voiced.text).toMatch(/nueve monedas/);
        expect(voiced.text).not.toMatch(LOG);
    });

    test('selling and haggling are hers too', () => {
        expect(say('🪙 [TIENDA] Vendéis Daga oxidada, Cuerda: 7 de oro.')).toMatchObject({ mode: 'line', who: 'Marisa' });
        const haggled = say('🛒 [TIENDA] Irene regatea con el tendero de puerto alba: 10 % menos para hoy.');
        expect(haggled.who).toBe('Marisa');
        expect(haggled.text).toMatch(/diez por ciento/);
        expect(say('🛒 [TIENDA] Irene regatea con el tendero de puerto alba: no cede, hoy al precio que hay.').mood).toBe('enfadado');
    });

    test('a town without anyone written still has someone behind the counter, by their role (J13.7)', () => {
        const voiced = say('🛒 [TIENDA] Irene compra Cuerda por 1 de oro.', { services: ['tienda'], companions: [] });
        expect(voiced).toMatchObject({ mode: 'line', who: 'El tendero' });
        expect(voiced.text).toMatch(/una moneda/);
        // Sin tienda aquí, nadie lo dice: un aviso corto.
        expect(say('🛒 [TIENDA] Irene compra Cuerda por 1 de oro.', { services: [], companions: [] }).mode).toBe('notice');
    });

    test('the innkeeper serves the meal, and a feast day is free', () => {
        const meal = say('🍲 [POSADA] Comida caliente para todos (2 de oro).');
        expect(meal).toMatchObject({ mode: 'line', who: 'Tomás' });
        expect(meal.text).toMatch(/dos monedas/);
        expect(meal.text).not.toMatch(/para todos|Sentaos/);
        expect(say('🍲 [POSADA] Comida caliente para todos (0 de oro).').text).not.toMatch(/monedas/);
    });

    test('alone you are spoken to as one, with company as many', () => {
        const company = { ...guild, companions: [{ name: 'Gerd', gender: 'm' }] };
        const texts = new Set();
        for (let turn = 0; turn < 12; turn++) texts.add(say('🍲 [POSADA] Comida caliente para todos (2 de oro).', guild, turn).text);
        expect([...texts].some(t => /Sentaos|para todos/.test(t))).toBe(false);
        const together = new Set();
        for (let turn = 0; turn < 12; turn++) together.add(say('🍲 [POSADA] Comida caliente para todos (2 de oro).', company, turn).text);
        expect([...together].some(t => /Siéntate|te lo saco/.test(t))).toBe(false);
    });

    test('after a night at the inn, the innkeeper says good morning; the rest itself is on screen', () => {
        const inn = { ...guild, open: 'posada', restUnder: 'techo' };
        expect(say('🌙 [DESCANSO] Dormís de un tirón. Amanece el día 2.', inn)).toMatchObject({ mode: 'line', who: 'Tomás' });
        expect(say('[DESCANSO] Descanso largo.\nIrene: 34 → 34 PG.', inn).mode).toBe('quiet');
        // En el gremio, fuera de la posada, el paso del tiempo es un aviso corto.
        expect(say('🌙 [DESCANSO] Dormís de un tirón. Amanece el día 2.', { ...guild, restUnder: 'techo' }).mode).toBe('notice');
        // Al raso, la noche la cuenta el campamento.
        expect(say('🌙 [DESCANSO] Hacéis guardias por turnos. Amanece el día 2.', { ...guild, restUnder: 'cielo' }).mode).toBe('quiet');
    });

    test('the guild master gives you the job: what it is, who asks and where; then marks it on the map', () => {
        const voiced = say('📄 [GREMIO] Encargo aceptado: «Contrabandistas en la cala», lo pide Marisa. Se juega en La cala del norte (La playa de la cala).');
        expect(voiced).toMatchObject({ mode: 'line', who: 'Brunilda' });
        expect(voiced.text).toMatch(/Contrabandistas en la cala/);
        expect(voiced.text).toMatch(/Marisa/);
        expect(voiced.text).toMatch(/La cala del norte/);
        expect(voiced.text).not.toMatch(/La playa de la cala|[{}|]/);
        const peaceful = say('📄 [GREMIO] Encargo aceptado: «La deuda», lo pide Tomás. Se resuelve en Puerto Alba, sin pelear: hablando, con una tirada o pagando.');
        expect(peaceful.text).toMatch(/La deuda/);
        expect(peaceful.text).toMatch(/pelear|armas/);
        // La copia del modelo no sale otra vez.
        expect(say('[ENCARGO] Encargo aceptado: «La deuda», lo pide Tomás. Se resuelve en Puerto Alba.').mode).toBe('quiet');
        const map = say('🗺️ [GREMIO] Aceptáis «Contrabandistas en la cala», que pide Marisa. La cala del norte ya sale en el mapa: está a un día de camino.');
        expect(map).toMatchObject({ mode: 'line', who: 'Brunilda' });
        expect(map.text).toMatch(/La cala del norte/);
        expect(map.text).toMatch(/un día/);
        // Fuera del gremio no hay quien lo apunte: un aviso.
        expect(say('📄 [GREMIO] Encargo aceptado: «La deuda», lo pide Tomás. Se juega en Vallaki.', { services: ['tienda'], companions: [] }).mode).toBe('notice');
    });

    test('who goes on the job says why, in their own words; your hero goes without saying', () => {
        const scene = { ...guild, hero: { name: 'Irene', gender: 'f' }, party: [{ name: 'Irene', gender: 'f' }, { name: 'Gerd', gender: 'm' }] };
        expect(say('🫱 [GREMIO] Irene se apunta: no le dice nada.', scene).mode).toBe('quiet');
        const gerd = say('🫱 [GREMIO] Gerd se apunta: no le dice nada.', scene);
        expect(gerd).toMatchObject({ mode: 'line', who: 'Gerd' });
        expect(gerd.text).toMatch(/ni me va ni me viene/i);
        const stays = say('🫱 [GREMIO] Gerd se queda: le parece poca cosa.', scene);
        expect(stays.text).toMatch(/me parece poca cosa/i);
    });

    test('a mercenary says it themselves when they join or leave', () => {
        const scene = { ...guild, party: [{ name: 'Irene', gender: 'f' }, { name: 'Yago', gender: 'm' }] };
        const joins = say('🗡️ [GREMIO] Yago (Guerrero) se une al grupo por 20 de oro. Va contigo hasta que le despidas.', scene);
        expect(joins).toMatchObject({ mode: 'line', who: 'Yago' });
        expect(say('🗡️ [GREMIO] Yago se despide y se queda en el gremio.', scene)).toMatchObject({ mode: 'line', who: 'Yago' });
    });

    test('a night in the open is told by a companion in the morning, in their own words', () => {
        const camp = { ...guild, keepers: {}, companions: [{ name: 'Gerd', gender: 'm' }] };
        const voiced = say('🏕️ [CAMPAMENTO] La noche pasa sin sobresaltos. Se cena caliente junto al fuego: nadie pasa hambre.', camp);
        expect(voiced).toMatchObject({ mode: 'line', who: 'Gerd' });
        expect(voiced.text).not.toMatch(/pasa sin sobresaltos|nadie pasa hambre/);
        // Quien hizo la guardia lo cuenta en primera persona.
        const watched = say('🏕️ [CAMPAMENTO] Lobo famélico se acerca de noche, pero Gerd lo ve venir (15 contra 12): se va sin nada.', camp);
        expect(watched.text).toMatch(/un lobo famélico/);
        expect(watched.text).not.toMatch(/Gerd|\(/);
        // Lo que no sabe decir va antes, como aviso.
        const mixed = say('🏕️ [CAMPAMENTO] La noche pasa sin sobresaltos. Algo raro pasa en el bosque.', camp);
        expect(mixed.before).toBe('Algo raro pasa en el bosque.');
        // A solas, nadie la cuenta: un aviso.
        expect(say('🏕️ [CAMPAMENTO] La noche pasa sin sobresaltos.', { ...camp, companions: [] }).mode).toBe('notice');
    });

    test('what is already on screen does not reach the box', () => {
        for (const note of [
            '🕐 [CAMPAÑA] Día 1 · Tarde.',
            '🌅 [CAMPAÑA] Amanece el día 3.',
            '🎲 Guardia de Gerd: 14 contra 12 ✓',
            '[CAMPAMENTO] Noche en La cala del norte. La noche pasa sin sobresaltos.',
            '📋 [COMBAT] Resumen final\nHP aliados: Irene 34/34',
            '💰 [COMBAT] Botín: 92 de oro y 50 PX (92 y 50 para cada superviviente).',
        ]) expect(say(note).mode).toBe('quiet');
    });

    test('on arrival, what is worth knowing is said by a companion; alone, it is a short notice', () => {
        const company = { ...guild, companions: [{ name: 'Gerd', gender: 'm' }] };
        const told = voiceArrivalHook('aquí está vuestro encargo', { scene: company, rows, seed: 'prueba' });
        expect(told).toMatchObject({ mode: 'line', who: 'Gerd' });
        expect(told.text).toMatch(/aquí está nuestro encargo/);
        expect(voiceArrivalHook('aquí está vuestro encargo', { scene: guild, rows })).toEqual({ mode: 'notice', text: 'Aquí está tu encargo.' });
        expect(voiceArrivalHook('', { scene: company, rows }).mode).toBe('quiet');
    });

    test('anything else stays a short notice, as it was told', () => {
        expect(say('🎲 [TIRADA] Irene: Percepción, 14 contra 12: sale.', guild)).toEqual({ mode: 'notice', text: '🎲 [TIRADA] Irene: Percepción, 14 contra 12: sale.' });
        expect(voiceNote('⚔️ [COMBAT] Le toca a Irene.', { told: 'Le toca a Irene.' })).toEqual({ mode: 'notice', text: 'Le toca a Irene.' });
    });
});

describe('the voice lines in frases.json', () => {
    test('the bank still loads: a broken row (an id with a tilde) would drop every phrase in the game', () => {
        expect(validateBattery('frases', bank)).toEqual([]);
    });

    test('every voz-* kind has its lines, and every line resolves with no braces left', () => {
        const coverage = voiceCoverage(rows);
        for (const kind of VOICE_KINDS) expect(coverage[kind]).toBeGreaterThanOrEqual(3);
        for (const row of rows.filter((/** @type {any} */ r) => String(r.kind).startsWith('voz-'))) {
            expect(VOICE_KINDS).toContain(row.kind);
            expect(leftoverMarkers(row.text)).toEqual([]);
            expect(row.text).not.toMatch(/\[|\bde oro\b/);
        }
        // Y cada reserva es una de las del banco.
        for (const [kind, line] of Object.entries(VOICE_FALLBACKS)) expect(rows.some((/** @type {any} */ r) => r.kind === kind && r.text === line)).toBe(true);
    });

    test('a keeper with their own lines says them sometimes (Marisa and her chalk)', () => {
        const said = new Set();
        for (let turn = 0; turn < 20; turn++) said.add(say('🛒 [TIENDA] Irene compra Cuerda por 1 de oro.', guild, turn).text);
        expect([...said].some(t => /tiza|humedad/.test(t))).toBe(true);
        // Y nadie más las dice.
        const other = { ...guild, keepers: { tienda: { name: 'Nella' } } };
        for (let turn = 0; turn < 20; turn++) expect(say('🛒 [TIENDA] Irene compra Cuerda por 1 de oro.', other, turn).text).not.toMatch(/tiza|humedad/);
    });

    test('prices and creatures read as they are said', () => {
        expect(coinWords(1)).toBe('una moneda');
        expect(coinWords(9)).toBe('nueve monedas');
        expect(coinWords(25)).toBe('25 monedas');
        expect(someone('Lobo famélico')).toBe('un lobo famélico');
        expect(someone('Rata de bodega')).toBe('una rata de bodega');
        expect(someone('Ojo Rojo')).toBe('Ojo Rojo');
    });
});
