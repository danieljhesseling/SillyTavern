#!/usr/bin/env node
/**
 * J2.3 de ROADMAP_SIN_CONEXION: la prueba de la bodega se puede saltar, y con ella el prólogo
 * entero (J2.1: el muelle, la charla con Tomás y Brunilda). Contra un servidor propio con un
 * `--dataRoot` temporal, como `e2e-gremio.mjs`:
 *
 *   título → Jugar sin conexión → tu personaje (eso no se salta) → en el muelle, «Saltar la
 *   prueba» → «Mejor la juego» no toca nada → «Saltarla» deja la partida como si se hubiera
 *   ganado: el prólogo hecho sin contarse, el hilo en el tablón, sin ratas que pelear, con el
 *   botín de las ratas y el tablón abierto.
 *
 * Uso:
 *   node tools/e2e-saltar-prueba.mjs              # sin ventana
 *   node tools/e2e-saltar-prueba.mjs --headed     # mirándolo
 *   node tools/e2e-saltar-prueba.mjs --port 8142 --captura saltar.png
 */

/* global window, document */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// D-J62, el modo guiado: «Saltar la prueba» y el tablón están dentro de la Casa del Gremio.
import { accionesDelSitio, enElGremio, entrarEnSitio, pasosDeLaHistoria, salirDelSitio, salirDelTablero } from './e2e-guiado.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8134;
const BASE = `http://127.0.0.1:${PORT}`;
const HEADED = process.argv.includes('--headed');
const SHOT = argAfter('--captura');

const require = createRequire(join(ROOT, 'tests/package.json'));
const { chromium } = require('@playwright/test');

let failures = 0;
const check = (/** @type {string} */ name, /** @type {boolean} */ ok, detail = '') => {
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        -> ${detail}` : ''}`);
};

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-saltar-'));
/** @type {any} */
let server = null;
/** @type {any} */
let browser = null;
/** @type {any} */
let page = null;

function startServer() {
    server = spawn(process.execPath, ['server.js', '--browserLaunchEnabled', 'false', '--port', String(PORT), '--dataRoot', dataRoot], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
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

/**
 * Elegir en una tarjeta de «Crear personaje» la primera opción, o la que se parece a lo pedido.
 *
 * @param {any} target
 * @param {string} pick class | race | background
 * @param {string} wanted
 */
async function pickHeroCard(target, pick, wanted) {
    await target.locator(`.hc-root .hc-card[data-pick="${pick}"] .hc-pick`).click();
    await target.waitForSelector('.hc-picker .hc-option', { timeout: 15000 });
    const plain = (/** @type {string} */ v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const values = await target.evaluate(() => [...document.querySelectorAll('.hc-picker .hc-option')].map(o => o.getAttribute('data-value') || ''));
    const chosen = values.find(v => plain(v).includes(plain(wanted))) ?? values[0];
    await target.locator(`.hc-picker .hc-option[data-value="${chosen}"]`).first().click();
    await target.waitForSelector('.hc-picker', { state: 'detached', timeout: 15000 }).catch(() => {});
    await target.waitForTimeout(200);
}

try {
    await startServer();
    browser = await chromium.launch({ channel: 'msedge', headless: !HEADED });
    const context = await browser.newContext({ viewport: { width: 1400, height: 950 } });
    page = await context.newPage();
    /** @type {string[]} */
    const problems = [];
    page.on('pageerror', e => problems.push(`PAGEERROR ${e.message}`));
    page.on('console', m => {
        if (m.type() === 'error' && !/Failed to load resource.*404/.test(m.text())) problems.push(`ERROR ${m.text().slice(0, 300)}`);
    });
    await context.addInitScript(() => {
        try {
            // Los consejos, vistos: aquí se mira saltar la prueba, no enseñar a jugar.
            window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,combat,travel,prisoners,mesa,high,spell,pet,bill,move,attack,roll,talk,journal');
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
            window.localStorage.setItem('sillytavern_gameSucesos', 'off');
            // Las escenas del hilo y las charlas escritas (J9.2, J8) las mira e2e-historia; aquí taparían clics.
            window.localStorage.setItem('sillytavern_gameStoryWindows', 'off');
        } catch { /* nada */ }
    });

    /** Lo que el juego sabe ahora: el grupo, el tablero, el hilo y los tableros ganados. */
    const state = () => page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const party = (await import('/scripts/party.js')).getPartyMembersSnapshot();
        const meta = ctx.chatMetadata ?? {};
        return {
            world: String(meta.world_info ?? ''),
            board: String(meta.currentBoard ?? ''),
            party: party.map((/** @type {any} */ m) => ({ name: m.name, gold: Number(m.gold) || 0, xp: Number(m.xp) || 0 })),
            fighting: Boolean(meta.combatEncounter?.active),
            done: Array.isArray(meta.plotState?.done) ? meta.plotState.done : [],
            open: Array.isArray(meta.plotState?.open) ? meta.plotState.open : [],
            won: Array.isArray(meta.boardsWon) ? meta.boardsWon : [],
        };
    });
    const chatHas = (/** @type {RegExp} */ pattern) => page.evaluate((source) => (window.SillyTavern.getContext().chat || [])
        .some((/** @type {any} */ m) => new RegExp(source).test(String(m.extra?.display_text || m.mes || ''))), pattern.source);
    /** Espera a que se cumpla algo, sin dormir de más. */
    const until = async (/** @type {() => Promise<boolean>} */ test, ms = 30000) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (await test().catch(() => false)) return true;
            await page.waitForTimeout(400);
        }
        return false;
    };
    /** La ventana de «¿Saltar la prueba?», con lo que dice. D-J62: se pulsa en la Casa del Gremio. */
    const askSkip = async () => {
        await enElGremio(page, 'hub-skip');
        const asked = await page.waitForSelector('.popup:has-text("¿Saltar la prueba?")', { timeout: 10000 }).then(() => true).catch(() => false);
        const text = asked ? await page.locator('.popup:has-text("¿Saltar la prueba?")').last().textContent() : '';
        return { asked, text: String(text || '').replace(/\s+/g, ' ').trim() };
    };

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    const firstRun = page.locator('text=Welcome to SillyTavern!');
    if (await firstRun.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#game-shell', { timeout: 90000 });

    // 1. Jugar sin conexión: el personaje se hace igual; saltar la prueba no salta esto.
    const offline = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Jugar sin conexión' });
    await until(async () => await offline.count() === 1, 30000);
    await offline.click();
    const creator = await page.waitForSelector('.hc-root', { timeout: 120000 }).then(() => true).catch(() => false);
    check('se abre la creación de personaje, como siempre', creator);
    await page.fill('.hc-root .hc-name', 'Iria');
    await pickHeroCard(page, 'race', 'Humano');
    await pickHeroCard(page, 'class', 'Guerrero');
    await page.locator('.hc-root .hc-enter').click();
    const inHub = await until(async () => {
        const now = await state();
        return /Gremio/.test(now.world) && now.party.length === 1 && now.party[0].name === 'Iria';
    }, 60000);
    await until(() => chatHas(/Al ladrón/), 20000);
    await page.waitForTimeout(800);
    let now = await state();
    // J2.1: se empieza por el prólogo, en el muelle; la prueba de la bodega viene después.
    check('empieza en el muelle, con Iria y 100 de oro, y el prólogo por hacer (J2.1)',
        inHub && now.party[0]?.gold === 100 && now.board === 'El muelle de Puerto Alba' && now.open.includes('el-muelle'), JSON.stringify(now));

    // 2. Las dos cosas: pelear (la pelea del muelle empieza sola, tanda 10) o saltarla. D-J62: saltarla
    // está en la Casa del Gremio, fuera del tablero: «Salir del tablero» y entrar en ella.
    await salirDelTablero(page);
    await entrarEnSitio(page, 'gremio');
    const hallTrial = await accionesDelSitio(page);
    check('fuera del muelle, en la Casa del Gremio, se puede saltar la prueba (D-J62)', hallTrial.includes('hub-skip'), JSON.stringify(hallTrial));
    // D-J28: el tablón y los mercenarios, escondidos hasta que acabe la prueba.
    check('y todavía no el tablón de campañas ni contratar (D-J28)', !hallTrial.some(a => /^hub-(board|hire)$/.test(a)), JSON.stringify(hallTrial));
    if (SHOT) await page.screenshot({ path: SHOT });

    // 3. Pensárselo y no: nada cambia.
    let ask = await askSkip();
    check('saltarla pregunta antes, diciendo lo que pasa', ask.asked && /como si hubieras ganado/.test(ask.text) && /sin pelear/.test(ask.text), ask.text.slice(0, 240));
    if (SHOT) await page.screenshot({ path: `${SHOT}.pregunta.png` });
    await page.locator('.popup-button-cancel:visible').first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(800);
    now = await state();
    check('«Mejor la juego» no toca nada: el prólogo y la prueba siguen por hacer', now.open.includes('el-muelle') && now.done.length === 0
        && (await accionesDelSitio(page)).includes('hub-skip'), JSON.stringify(now));

    // 4. Saltarla: como si se hubiera ganado.
    ask = await askSkip();
    await page.locator('.popup-button-ok:visible').first().click({ timeout: 5000 }).catch(() => {});
    const told = await until(() => chatHas(/apunta tu nombre en el libro del gremio/), 15000);
    await page.waitForTimeout(1000);
    now = await state();
    check('saltarla abre el hilo siguiente, con su escena: el tablón', told && now.done.includes('la-prueba') && now.open.includes('el-tablon'), JSON.stringify(now));
    // J2.1: el prólogo entero queda hecho, y sus escenas no se cuentan: no se han jugado.
    const untold = !(await chatHas(/Soy Tomás/)) && !(await chatHas(/Mientras habláis/));
    check('y salta el prólogo entero: el muelle, la charla y Brunilda, hechos sin contarse (J2.1)',
        ['el-muelle', 'la-charla', 'el-gremio'].every(id => now.done.includes(id)) && untold, JSON.stringify({ done: now.done, untold }));
    check('el tablero queda ganado, sin pelea en marcha', now.won.includes('Puerto Alba::La bodega del gremio') && !now.fighting, JSON.stringify(now));
    // Dos ratas dan 50 de experiencia (25 cada una, por su desafío) y el ratero del muelle 25 más
    // (J2.1: se recorren los dos tableros de la prueba); el oro, lo que salga al tirar.
    check('Iria sigue ahí, con su bolsa y lo que dan el ratero y las ratas (75 PX), como si los hubiera ganado (J2.1)',
        now.party.length === 1 && now.party[0].name === 'Iria' && now.party[0].gold >= 100 && now.party[0].xp === 75 && await chatHas(/Botín/), JSON.stringify(now.party));
    // J2.1: no queda nadie con quien pelear (ni el ratero ni las ratas). D-J62: en la sala ya no está
    // «Saltar la prueba» y sí el tablón; y lo que pide la historia no lleva a ninguna pelea.
    await entrarEnSitio(page, 'gremio');
    const after = await accionesDelSitio(page);
    await salirDelSitio(page);
    const steps = await pasosDeLaHistoria(page);
    check('saltada, la sala ya no ofrece saltar y sí el tablón de campañas, y nada lleva a pelear (J2.1, D-J62)',
        now.board === '' && !after.includes('hub-skip') && after.includes('hub-board') && !steps.some(st => st.kind === 'board'), JSON.stringify({ board: now.board, after, steps }));
    const focus = await page.evaluate(() => (document.querySelector('#game-shell .gs-focus-title')?.textContent || '').trim());
    check('lo que toca ahora es el tablón', /tablón de campañas/i.test(focus), focus);
    if (SHOT) await page.screenshot({ path: `${SHOT}.saltada.png` });

    // 5. Y el tablón se abre, con sus campañas.
    await enElGremio(page, 'hub-board');
    const board = await page.waitForSelector('.hb-root [data-campaign="strahd"]', { timeout: 15000 }).then(() => true).catch(() => false);
    check('el tablón de campañas se abre, con Strahd', board);

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
