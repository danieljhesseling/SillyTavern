#!/usr/bin/env node
/**
 * La vuelta sin conexión de 1387, hasta uno de sus tres finales (J16.1 y J9.1 de
 * wiki/ROADMAP_SIN_CONEXION.md), contra un servidor propio con un `--dataRoot` temporal.
 *
 *   portada → «Jugar sin conexión» → Tessa → saltar la prueba → el tablón → 1387 → cada hito,
 *   a clics (escenas, charlas, viajes, tableros, peleas, tiradas) → el final.
 *
 * La juega `tools/vuelta-bot.mjs`: mira la pantalla y pulsa lo que pulsaría quien juega, sin
 * escribir nada. Apunta cada **silencio** (un clic tras el que no cambia nada que se vea, o una
 * escena sin texto) y cada **atasco** (lo que pide la historia no está a la vista), con el
 * sitio, el paso y lo que se ve. Al final, los números de la sección 6 del plan (J16.4).
 *
 * Uso:
 *   node tools/vuelta-1387.mjs                         # sin ventana, puerto 8246
 *   node tools/vuelta-1387.mjs --port 8346 --captura v.png
 *   node tools/vuelta-1387.mjs --final vane            # la última paga con Vane (la tienda de Keller)
 *   node tools/vuelta-1387.mjs --peleas                # las peleas de verdad (más lenta)
 *   node tools/vuelta-1387.mjs --estricto              # y un silencio o un atasco cuentan como fallo
 *   VUELTA_PELEAS=gancho node tools/vuelta-1387.mjs    # los turnos del grupo, con el gancho (sin la barra)
 *
 * Las peleas: si la barra de combate no responde a lo que pulsa la vuelta (se está rehaciendo,
 * wiki/maquetas/ENCARGO_COMBATE_VTT.md), los turnos del grupo pasan solos al gancho
 * `playCurrentTurnAlone`, y la vuelta lo dice («GANCHO …» y su número al final).
 */

/* global window, document */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBot, startOffline, runCampaign, fixedNumbers, proseNotes, boardGoalsFromPack } from './vuelta-bot.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8246;
const BASE = `http://127.0.0.1:${PORT}`;
const HEADED = process.argv.includes('--headed');
const SHOT = argAfter('--captura');
const STRICT = process.argv.includes('--estricto');
const REAL_FIGHTS = process.argv.includes('--peleas');
const FINAL = argAfter('--final') || 'lobos';
const MAX_STEPS = Number(argAfter('--pasos')) || 1400;

const require = createRequire(join(ROOT, 'tests/package.json'));
const { chromium } = require('@playwright/test');
const readJson = (/** @type {string} */ path) => JSON.parse(readFileSync(join(ROOT, path), 'utf8'));

let failures = 0;
const check = (/** @type {string} */ name, /** @type {boolean} */ ok, detail = '') => {
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        -> ${detail}` : ''}`);
};
/** Los números que importan (J16.4): salen en el registro, y `e2e-todo.mjs` los enseña al final. */
const number = (/** @type {string} */ what, /** @type {string|number} */ value) => console.log(`NUM   ${what}: ${value}`);
/** Las órdenes al narrador: sin modelo, si se ven, se leen como un error. */
const ORDER = /(Cuéntalo|Cuentalo|No inventes|Dilo tal cual|Describe la escena|Narra esta|Adapta la escena|Que se note|narra la consecuencia|No digas otra vez)/;
/** Una nota del juego que se lee en crudo, con su etiqueta: «[HILO] Hecho: …», «🤝 [CAMPAÑA] …». */
const RAW = /^\W{0,4}\[[A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ ·]{1,30}\]/u;

const dataRoot = mkdtempSync(join(tmpdir(), 'st-vuelta-1387-'));
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
        // Con muchas pruebas a la vez (e2e-todo.mjs), el servidor tarda en arrancar.
        const timer = setTimeout(() => reject(new Error('the server did not start in 360s')), 360000);
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
            // Los consejos, vistos: se mide el juego, no enseñar a jugar (eso lo mira e2e-gremio).
            window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,combat,travel,prisoners,mesa,high,spell,pet,bill,move,attack,roll,talk,journal');
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
        } catch { /* nada */ }
    });

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    const bot = createBot(page, { fast: !REAL_FIGHTS, log: (line) => console.log(line) });
    const clicked = await startOffline(page, { name: 'Tessa', gender: 'Mujer', race: 'Humano', klass: 'Guerrero' });

    // --- El gremio: saltar la prueba y el tablón ------------------------------------------
    let v = await bot.observe();
    // El prólogo empieza con la pelea del muelle (con el combate nuevo, sola al entrar: «otra
    // salida», colocar y «Empezar»); después, «Saltar la prueba».
    const guildGoals = boardGoalsFromPack(readJson('public/mundos/gremio.pack.json'));
    for (let i = 0; i < 120 && !v.done.includes('la-prueba'); i++) {
        v = await bot.observe();
        if (await bot.handleLayer(v)) continue;
        if (v.fight) {
            await bot.fightTurn(v, guildGoals.get(v.board) ?? null);
            continue;
        }
        if (v.board && v.start.length > 0) {
            await bot.confirmStart(v);
            continue;
        }
        if (await bot.tapChip(v, /^Saltar la prueba$/, 'saltar la prueba', 'hub.js')) continue;
        if (await bot.tapChip(v, /^Iniciar combate/, 'iniciar el combate', 'action-chips.js')) continue;
        if (v.scene === 'dialogue' && v.vn.next) await bot.act(v, '«Continuar»', () => bot.press(bot.chip(/^Continuar$/)));
        else await page.waitForTimeout(300);
    }
    check('en el gremio, «Saltar la prueba» deja el prólogo hecho', v.done.includes('la-prueba'), JSON.stringify(v.done));
    const pack = readJson('public/mundos/1387.pack.json');
    const onHub = async (/** @type {any} */ now) => {
        const card = page.locator('dialog[open] .hb-root [data-campaign="1387"]');
        if (await card.count() === 0) return false;
        const done = await bot.act(now, 'empezar 1387 en el tablón', () => bot.press(card), { module: 'hub-panel.js', wait: 8000 });
        // Cargar la campaña tarda: no se vuelve a mirar el tablón mientras carga.
        await bot.until(async () => /1387/.test((await bot.observe()).world), 30000, 400);
        return done;
    };
    for (let i = 0; i < 40 && !/1387/.test(v.world); i++) {
        v = await bot.observe();
        if (await bot.handleLayer(v, { onHub })) continue;
        if (await bot.tapChip(v, /^Tablón de campañas$/, 'el tablón de campañas', 'action-chips.js')) continue;
        if (v.scene === 'dialogue' && v.vn.next) await bot.act(v, '«Continuar»', () => bot.press(bot.chip(/^Continuar$/)));
        else if (v.town.inside) await bot.toMap(v);
    }
    const started1387 = await bot.until(async () => /1387/.test((await bot.observe()).world), 60000, 500);
    check('desde el tablón empieza 1387', started1387, bot.describe(await bot.observe()).slice(0, 300));
    if (SHOT) await page.screenshot({ path: SHOT });

    // --- 1387, a clics, hasta un final ------------------------------------------------------
    // Los dos finales del último acto se eligen yendo a uno u otro tablero: con Vane, la tienda de
    // Keller; si no, las puertas del castillo (con Keller o con los Lobos, según la fama).
    const order = FINAL === 'vane' ? ['la-ultima-paga-norte', 'la-ultima-paga'] : ['la-ultima-paga', 'la-ultima-paga-norte'];
    const played = await runCampaign(bot, {
        pack,
        order,
        maxSteps: MAX_STEPS,
        stop: (now) => now.layer?.kind === 'end' || Boolean(now.ending),
    });
    v = played.view;
    const ending = await page.evaluate(() => {
        const root = document.querySelector('dialog[open] .end-root');
        const meta = window.SillyTavern.getContext().chatMetadata || {};
        return {
            id: String(meta.plotEnding || meta.plotState?.ending || ''),
            title: (root?.querySelector('h3')?.textContent || '').replace(/^Final: /, '').trim(),
            scene: (root?.querySelector('.end-scene')?.textContent || '').trim().slice(0, 200),
            people: [...(root?.querySelectorAll('.end-epilogue') ?? [])].length,
            numbers: [...(root?.querySelectorAll('.end-number') ?? [])].map(n => (n.textContent || '').trim()),
        };
    });
    if (SHOT) await page.screenshot({ path: `${SHOT}.final.png` });
    const endings = Object.keys(pack.plot?.endings ?? {});
    check('1387 llega a uno de sus tres finales, con su escena (J9.1)',
        endings.includes(ending.id) && ending.title.length > 0 && ending.scene.length > 0,
        JSON.stringify({ ending, gaveUp: played.gaveUp, where: bot.where(v), sees: bot.describe(v).slice(0, 300) }));

    // --- Lo que se ha leído: ni órdenes al narrador ni etiquetas del motor -------------------
    const read = await page.evaluate(() => (window.SillyTavern.getContext().chat || [])
        .map((/** @type {any} */ m) => String(m.extra?.display_text ?? m.mes ?? '')));
    const leaks = read.filter(t => ORDER.test(t));
    check('ninguna orden al narrador a la vista en toda la vuelta', leaks.length === 0, JSON.stringify(leaks.slice(0, 3).map(t => t.slice(0, 160))));
    // J18.10 y J13.1: las notas del chat que llevan su etiqueta del motor («[HILO] …»). La caja de
    // la novela las limpia al pintarlas (engine-tags.js): lo que cuenta es lo que se VE, que mira
    // el bot en cada paso (`oddities`, «crudo»).
    const tagged = read.filter(t => RAW.test(t));
    const raw = bot.oddities.filter(o => o.kind === 'crudo');

    // --- El recuento ------------------------------------------------------------------------
    const main = (pack.plot?.milestones ?? []).filter((/** @type {any} */ m) => !m.hidden && m.opens?.kind !== 'clock').map((/** @type {any} */ m) => String(m.id));
    const all = fixedNumbers(readJson);
    const notes = proseNotes(ROOT);
    console.log('\n--- los silencios ---');
    for (const s of bot.silences) console.log(`  #${s.n} ${s.where} · ${s.what}\n      se ve: ${s.sees.slice(0, 260)}${s.module ? `\n      módulo: ${s.module}` : ''}`);
    if (bot.silences.length === 0) console.log('  (ninguno)');
    console.log('\n--- los atascos ---');
    for (const b of bot.blocks) console.log(`  #${b.n} ${b.where} · ${b.goal}\n      se ve: ${b.sees.slice(0, 300)}\n      rescate: ${b.rescue}`);
    if (bot.blocks.length === 0) console.log('  (ninguno)');
    console.log('\n--- lo que se ve mal (sin ser silencio ni atasco) ---');
    for (const o of bot.oddities) console.log(`  #${o.n} ${o.where} · ${o.kind}: ${o.text.slice(0, 300)}`);
    if (bot.oddities.length === 0) console.log('  (nada)');
    console.log('\n--- el grupo ha caído (la tarjeta «ha muerto») ---');
    for (const f of bot.falls) console.log(`  #${f.n} ${f.where} · ${f.text}\n      salidas: ${f.ways.join(' | ') || '(ninguna)'}`);
    if (bot.falls.length === 0) console.log('  (nunca)');
    console.log('\n--- los clics lentos (la página tarda más de 1,5 s en atenderlos) ---');
    for (const s of bot.slow) console.log(`  ${s.ms} ms · ${s.what} · ${s.where}`);
    if (bot.slow.length === 0) console.log('  (ninguno)');
    console.log('\n--- lo que se eligió ---');
    for (const c of bot.choices) console.log(`  ${c.scene}: ${c.option}`);

    console.log('\n--- los números (sección 6 del plan) ---');
    number('Hitos de 1387 jugados sin conexión en la vuelta', `${v.done.filter((/** @type {string} */ id) => id !== '').length} de ${all.hitos1387} (el hilo principal: ${main.filter((/** @type {string} */ id) => v.done.includes(id)).length} de ${main.length})`);
    number('El final', ending.title ? `${ending.title} (${ending.id})` : 'ninguno');
    number('Silencios en la vuelta sin modelo', bot.silences.length);
    number('Atascos (rescatados con un comando)', bot.blocks.length);
    number('Tiempo de «Jugar sin conexión» a la primera decisión', bot.firstDecisionAt ? clock(bot.firstDecisionAt - clicked) : 'sin decidir');
    number('Días de campaña', v.day);
    number('Pasos (clics)', bot.steps.length);
    number('Peleas, escenas con decisión, sucesos, charlas, viajes y tiradas',
        `${bot.counts.fights} · ${bot.counts.options} · ${bot.counts.sucesos} · ${bot.counts.talks} · ${bot.counts.travels} · ${bot.counts.checks}`);
    number('Notas del juego con su versión en prosa', `${notes.prose} de ${notes.total} (etiqueta del motor a la vista en la vuelta: ${raw.length}; en el chat, sin pintar: ${tagged.length})`);
    number('Escenas del hilo que salen con su hito ya cumplido', bot.oddities.filter(o => o.kind === 'tarde').length);
    number('Ventanas abiertas encima de otra a medias', bot.oddities.filter(o => o.kind === 'encima').length);
    number('Veces que cae el grupo entero', `${bot.falls.length} (partidas cargadas después: ${bot.counts.loads})`);
    number('Descansos (posada, acampar, cazar), al ver el agotamiento o media vida', bot.counts.rests);
    number('«Otra salida» antes o en mitad de una pelea (la vuelta elige pelear)', bot.counts.exits);
    number('Turnos del grupo jugados con el gancho (la barra de combate no respondía)', bot.counts.hooked);
    number('Clics lentos (más de 1,5 s)', bot.slow.length ? `${bot.slow.length} (el peor, ${Math.max(...bot.slow.map(s => s.ms))} ms)` : 0);
    number('Filas del narrador (frases.json)', all.frases);
    number('Sucesos con decisión (sucesos.json)', all.sucesos);
    number('Charlas con ramas escritas en 1387', all.charlas1387);
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
