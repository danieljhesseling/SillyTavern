#!/usr/bin/env node
/**
 * La vuelta del gremio (J16.2 de wiki/ROADMAP_SIN_CONEXION.md), a clics y sin escribir nada,
 * contra un servidor propio con un `--dataRoot` temporal:
 *
 *   portada → «Jugar sin conexión» → Tessa → el prólogo entero (el ratero del muelle, Tomás,
 *   Brunilda y la bodega) → contratar un mercenario → el tablón → 1387, sus dos primeros hitos
 *   → «Volver al gremio» → el tablón → La Maldición de Strahd, con la misma Tessa, hasta su
 *   primer hito.
 *
 * La juega `tools/vuelta-bot.mjs`, como la de 1387: apunta cada silencio y cada atasco, y al
 * final saca los números de la sección 6 del plan (J16.4).
 *
 * Uso:
 *   node tools/vuelta-gremio.mjs                       # sin ventana, puerto 8247
 *   node tools/vuelta-gremio.mjs --port 8346 --captura g.png
 *   node tools/vuelta-gremio.mjs --estricto            # y un silencio o un atasco cuentan como fallo
 */

/* global window */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBot, startOffline, runCampaign, fixedNumbers, proseNotes } from './vuelta-bot.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8247;
const BASE = `http://127.0.0.1:${PORT}`;
const HEADED = process.argv.includes('--headed');
const SHOT = argAfter('--captura');
const STRICT = process.argv.includes('--estricto');

const require = createRequire(join(ROOT, 'tests/package.json'));
const { chromium } = require('@playwright/test');
const readJson = (/** @type {string} */ path) => JSON.parse(readFileSync(join(ROOT, path), 'utf8'));

let failures = 0;
const check = (/** @type {string} */ name, /** @type {boolean} */ ok, detail = '') => {
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        -> ${detail}` : ''}`);
};
const number = (/** @type {string} */ what, /** @type {string|number} */ value) => console.log(`NUM   ${what}: ${value}`);
/** Una nota del juego que se lee en crudo, con su etiqueta: «[HILO] Hecho: …», «🤝 [CAMPAÑA] …». */
const RAW = /^\W{0,4}\[[A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ ·]{1,30}\]/u;

const dataRoot = mkdtempSync(join(tmpdir(), 'st-vuelta-gremio-'));
/** @type {any} */
let server = null;
/** @type {any} */
let browser = null;
/** @type {any} */
let page = null;

function startServer() {
    server = spawn(process.execPath, ['server.js', '--port', String(PORT), '--dataRoot', dataRoot], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    const child = server;
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('the server did not start in 180s')), 180000);
        const watch = (/** @type {any} */ buffer) => {
            const text = String(buffer);
            if (text.includes(String(PORT)) || text.toLowerCase().includes('listening')) {
                clearTimeout(timer);
                setTimeout(() => resolve(child), 1500);
            }
        };
        child.stdout.on('data', watch);
        child.stderr.on('data', watch);
        child.on('exit', (/** @type {number} */ code) => reject(new Error(`the server exited with code ${code}`)));
    });
}

const t0 = Date.now();
const clock = (/** @type {number} */ ms) => `${Math.floor(ms / 60000)}:${String(Math.round((ms % 60000) / 1000)).padStart(2, '0')}`;

try {
    await startServer();
    browser = await chromium.launch({ channel: 'msedge', headless: !HEADED });
    const context = await browser.newContext({ viewport: { width: 1400, height: 950 } });
    page = await context.newPage();
    /** @type {string[]} */
    const problems = [];
    page.on('pageerror', (/** @type {any} */ e) => problems.push(`PAGEERROR ${e.message}`));
    page.on('console', (/** @type {any} */ m) => {
        if (m.type() === 'error' && !/Failed to load resource.*404/.test(m.text())) problems.push(`ERROR ${m.text().slice(0, 300)}`);
    });
    await context.addInitScript(() => {
        try {
            // Los consejos salen como a quien juega por primera vez; son avisos, no tapan nada.
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
        } catch { /* nada */ }
    });

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    const bot = createBot(page, { log: (line) => console.log(line) });
    const clicked = await startOffline(page, { name: 'Tessa', gender: 'Mujer', race: 'Humano', klass: 'Guerrero' });
    const shoot = async (/** @type {string} */ what) => { if (SHOT) await page.screenshot({ path: `${SHOT.replace(/\.png$/i, '')}-${what}.png` }); };

    // --- 1. El prólogo, entero ---------------------------------------------------------------
    const prologue = await runCampaign(bot, {
        pack: readJson('public/mundos/gremio.pack.json'),
        stop: (now) => now.done.includes('la-prueba'),
        maxSteps: 250,
    });
    const afterPrologue = await bot.observe();
    check('el prólogo se juega entero a clics: el muelle, Tomás, Brunilda y la bodega (J2.1)',
        prologue.reached && ['el-muelle', 'la-charla', 'el-gremio', 'la-prueba'].every(id => afterPrologue.done.includes(id)),
        JSON.stringify({ gaveUp: prologue.gaveUp, done: afterPrologue.done }));
    const firstDecision = bot.firstDecisionAt ? bot.firstDecisionAt - clicked : 0;
    await shoot('prologo');

    // --- 2. El gremio: contratar a alguien y el tablón -------------------------------------------
    /** @type {string} */
    let wanted = '';
    /** @type {string[]} */
    let boardCards = [];
    const onHub = async (/** @type {any} */ now) => {
        const hire = page.locator('dialog[open] .hb-root [data-hireling]:not(.is-hired):not(.is-off)');
        if (!wanted && await hire.count() > 0) {
            bot.markDecision();
            const done = await bot.act(now, 'contratar al primer mercenario', () => bot.press(hire), { module: 'hub-panel.js' });
            await page.locator('dialog[open] .hb-root .hb-close').first().click({ timeout: 1500 }).catch(() => {});
            return done;
        }
        const cards = page.locator('dialog[open] .hb-root [data-campaign]');
        if (wanted && await cards.count() > 0) {
            boardCards = await cards.evaluateAll(list => list.map(c => c.getAttribute('data-campaign') || ''));
            const card = page.locator(`dialog[open] .hb-root [data-campaign="${wanted}"]`);
            if (await card.count() === 0) return false;
            return bot.act(now, `empezar ${wanted} en el tablón`, () => bot.press(card), { module: 'hub-panel.js', wait: 8000 });
        }
        return false;
    };
    /**
     * Desde el pueblo del gremio, abrir el tablón y elegir una campaña (o antes, contratar).
     *
     * @param {RegExp} chipText
     * @param {(now: any) => boolean} reached
     */
    const fromGuild = async (chipText, reached) => {
        for (let i = 0; i < 40; i++) {
            const now = await bot.observe();
            if (reached(now)) return true;
            if (await bot.handleLayer(now, { onHub })) continue;
            if (await bot.tapChip(now, chipText, `la ficha «${chipText.source.replace(/[\^$\\]/g, '')}»`, 'action-chips.js')) continue;
            if (now.scene === 'dialogue' && now.vn.next) await bot.act(now, '«Continuar»', () => bot.press(bot.chip(/^Continuar$/)));
            else if (!await bot.toMap(now)) await page.waitForTimeout(300);
        }
        return reached(await bot.observe());
    };
    const hired = await fromGuild(/^Contratar mercenarios$/, (now) => now.party.length >= 2);
    const guild = await bot.observe();
    check('en el gremio se contrata a un mercenario con un clic (J3)', hired && guild.party.length >= 2, JSON.stringify(guild.party));
    const heroAtGuild = guild.hero;
    const guildWorld = guild.world;

    wanted = '1387';
    const in1387 = await fromGuild(/^Tablón de campañas$/, (now) => /1387/.test(now.world));
    check('desde el tablón empieza 1387, con el grupo del gremio', in1387, JSON.stringify(boardCards));
    await bot.until(async () => (await bot.observe()).open.length > 0, 20000, 400);

    // --- 3. 1387: sus dos primeros hitos ------------------------------------------------------
    const pack1387 = readJson('public/mundos/1387.pack.json');
    const first = await runCampaign(bot, {
        pack: pack1387,
        stop: (now) => ['el-caliz-ensangrentado', 'el-precio-del-escape'].every(id => now.done.includes(id)),
        maxSteps: 300,
    });
    const mid = await bot.observe();
    check('en 1387, a clics, se ganan el cuarto de la posada y la charla con Giles',
        first.reached, JSON.stringify({ gaveUp: first.gaveUp, done: mid.done, where: bot.where(mid) }));
    await shoot('1387');

    // --- 4. Volver al gremio ------------------------------------------------------------------
    const home = await fromGuild(/^Volver al gremio$/, (now) => now.world === guildWorld && !now.layer);
    const back = await bot.observe();
    check('«Volver al gremio» lleva al pueblo del gremio, con el grupo entero (J4.4, J4.9)',
        home && back.world === guildWorld && back.party.length === guild.party.length, JSON.stringify({ world: back.world, party: back.party }));

    // --- 5. Otra campaña con la misma Tessa ---------------------------------------------------
    wanted = 'strahd';
    const inStrahd = await fromGuild(/^Tablón de campañas$/, (now) => /Strahd/.test(now.world));
    await bot.until(async () => (await bot.observe()).open.length > 0, 20000, 400);
    const strahdStart = await bot.observe();
    check('desde el tablón empieza La Maldición de Strahd con la misma Tessa, con lo que ganó en 1387 (D-J4)',
        inStrahd && strahdStart.hero?.name === 'Tessa' && (strahdStart.hero?.xp ?? 0) >= (heroAtGuild?.xp ?? 0)
        && (strahdStart.hero?.xp ?? 0) > (heroAtGuild?.xp ?? 0) - 1 && strahdStart.party.length === guild.party.length,
        JSON.stringify({ guild: heroAtGuild, strahd: strahdStart.hero, party: strahdStart.party }));
    const packStrahd = readJson('public/mundos/strahd.pack.json');
    const strahd = await runCampaign(bot, {
        pack: packStrahd,
        stop: (now) => now.done.includes('sangrienta-bienvenida'),
        maxSteps: 200,
    });
    const end = await bot.observe();
    check('en Strahd, a clics, se gana la Taberna: su primer hito', strahd.reached, JSON.stringify({ gaveUp: strahd.gaveUp, done: end.done, where: bot.where(end) }));
    await shoot('strahd');

    // --- El recuento --------------------------------------------------------------------------
    const all = fixedNumbers(readJson);
    const notes = proseNotes(ROOT);
    // J18.10 y J13.1: lo leído en la última campaña con la etiqueta del motor a la vista.
    const raw = (await page.evaluate(() => (window.SillyTavern.getContext().chat || [])
        .map((/** @type {any} */ m) => String(m.extra?.display_text ?? m.mes ?? '')))).filter((/** @type {string} */ t) => RAW.test(t));
    console.log('\n--- los silencios ---');
    for (const s of bot.silences) console.log(`  #${s.n} ${s.where} · ${s.what}\n      se ve: ${s.sees.slice(0, 260)}${s.module ? `\n      módulo: ${s.module}` : ''}`);
    if (bot.silences.length === 0) console.log('  (ninguno)');
    console.log('\n--- los atascos ---');
    for (const b of bot.blocks) console.log(`  #${b.n} ${b.where} · ${b.goal}\n      se ve: ${b.sees.slice(0, 300)}\n      rescate: ${b.rescue}`);
    if (bot.blocks.length === 0) console.log('  (ninguno)');
    console.log('\n--- los números (sección 6 del plan) ---');
    number('Campañas en una misma partida', `${[in1387, inStrahd].filter(Boolean).length}, con el mismo gremio y la misma Tessa`);
    number('Campañas en el tablón', boardCards.length);
    number('Tiempo de «Jugar sin conexión» a la primera decisión', firstDecision ? clock(firstDecision) : 'sin decidir');
    number('Silencios en la vuelta', bot.silences.length);
    number('Atascos (rescatados con un comando)', bot.blocks.length);
    number('Pasos (clics)', bot.steps.length);
    number('Peleas, escenas con decisión, sucesos, charlas, viajes y tiradas',
        `${bot.counts.fights} · ${bot.counts.options} · ${bot.counts.sucesos} · ${bot.counts.talks} · ${bot.counts.travels} · ${bot.counts.checks}`);
    number('Notas del juego con su versión en prosa', `${notes.prose} de ${notes.total} (en crudo a la vista en Strahd: ${raw.length})`);
    number('Filas del narrador (frases.json)', all.frases);
    number('Sucesos con decisión (sucesos.json)', all.sucesos);
    number('Charlas con ramas escritas (1387 y Strahd)', `${all.charlas1387} y ${all.charlasStrahd}`);
    number('Jugadores en la partida', 1);
    number('Lo que tarda la vuelta', clock(Date.now() - t0));
    if (STRICT) {
        check('ningún silencio', bot.silences.length === 0, bot.silences.map(s => `#${s.n} ${s.what}`).join(' · '));
        check('ningún atasco', bot.blocks.length === 0, bot.blocks.map(b => `#${b.n} ${b.goal}`).join(' · '));
    }
    check('sin errores en la página', problems.length === 0, problems.slice(0, 6).join('\n        '));
} catch (error) {
    failures++;
    console.log(`FAIL  the run threw: ${/** @type {any} */ (error)?.message || error}`);
    if (SHOT && page) await page.screenshot({ path: `${SHOT}.error.png` }).catch(() => {});
} finally {
    if (browser) await browser.close().catch(() => {});
    if (server) {
        server.stdout?.destroy();
        server.stderr?.destroy();
        server.kill('SIGKILL');
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
    rmSync(dataRoot, { recursive: true, force: true, maxRetries: 5 });
}
console.log(failures === 0 ? '\nTodo bien.' : `\n${failures} fallo(s).`);
process.exit(failures === 0 ? 0 : 1);
