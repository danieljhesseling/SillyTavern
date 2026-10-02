#!/usr/bin/env node
/**
 * Tanda 10, «el lienzo y la cámara» (wiki/maquetas/ENCARGO_COMBATE_VTT.md): el tablero de combate
 * como una mesa virtual, en un navegador de verdad contra un servidor propio con un `--dataRoot`
 * temporal, como `e2e-gremio.mjs`:
 *
 *   título → Jugar sin conexión → Tessa, guerrera → la pelea del muelle →
 *   - el tablero llena la pantalla de juego, sin barras de desplazamiento, a 1280 × 720 y 1920 × 1080;
 *   - la capa del HUD no recibe clics, solo sus islas;
 *   - la iniciativa: caras de 26 px (su dibujo en pixel), barras de vida y el turno marcado; pulsar
 *     una fila centra la cámara en esa persona;
 *   - el resumen del combate, plegable, en lugar de la franja del registro de abajo;
 *   - la rueda acerca hacia el cursor, de 0,45× a 2,2×; los botones acercan, alejan y centran;
 *   - arrastrar mueve el mapa, y soltar no cuenta como pulsar una casilla (sin clics fantasma);
 *   - el minimapa enseña lo que se ve, y pulsarlo lleva la cámara;
 *   - un enemigo fuera de la vista sale en el borde con su nombre y sus pies; pulsarlo, a él;
 *   - Espacio centra en quien tiene el turno; al volver tu turno, la cámara te busca;
 *   - pasar el ratón por tu ficha enciende en azul hasta dónde llegas, sin pulsar;
 *   - en el teléfono (390 × 844, y tumbado), el HUD compacto, dos dedos acercan, uno arrastra y el
 *     primer toque en tu ficha enciende tu alcance;
 *   - fuera de combate, el mismo tablero sin el HUD del combate.
 *
 * Uso:
 *   node tools/e2e-lienzo.mjs                                   # puerto 8410, sin ventana
 *   node tools/e2e-lienzo.mjs --headed
 *   node tools/e2e-lienzo.mjs --port 8411 --captura lienzo.png  # lienzo-1280.png, lienzo-1920.png…
 */

/* global window, document, HTMLElement, HTMLImageElement, PointerEvent */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { entrarEnLaPelea, comoVaLaEntrada } from './e2e-entrar-pelea.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8410;
const BASE = `http://127.0.0.1:${PORT}`;
const HEADED = process.argv.includes('--headed');
const SHOT = argAfter('--captura');
const DEBUG = process.argv.includes('--depurar');

const require = createRequire(join(ROOT, 'tests/package.json'));
const { chromium } = require('@playwright/test');

let failures = 0;
const check = (/** @type {string} */ name, /** @type {boolean} */ ok, detail = '') => {
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        -> ${detail}` : ''}`);
};

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-lienzo-'));
/** @type {any} */
let server = null;
/** @type {any} */
let browser = null;

function startServer() {
    server = spawn(process.execPath, ['server.js', '--port', String(PORT), '--dataRoot', dataRoot], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    const child = server;
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('the server did not start in 300s')), 300000);
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
 * Elegir en una tarjeta de «Crear personaje» la opción que se parece a lo pedido, o la primera.
 *
 * @param {any} page
 * @param {string} pick
 * @param {string} wanted
 * @param {boolean} touch
 */
async function pickHeroCard(page, pick, wanted, touch) {
    const tap = (/** @type {any} */ locator) => (touch ? locator.tap() : locator.click());
    await tap(page.locator(`.hc-root .hc-card[data-pick="${pick}"] .hc-pick`));
    await page.waitForSelector('.hc-picker .hc-option', { timeout: 15000 });
    const plain = (/** @type {string} */ v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const values = await page.evaluate(() => [...document.querySelectorAll('.hc-picker .hc-option')].map(o => o.getAttribute('data-value') || ''));
    const chosen = values.find(v => plain(v).includes(plain(wanted))) ?? values[0];
    await tap(page.locator(`.hc-picker .hc-option[data-value="${chosen}"]`).first());
    await page.waitForSelector('.hc-picker', { state: 'detached', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(200);
}

/**
 * Una partida nueva en su propia ventana, hasta la pelea del muelle con el turno de Tessa.
 *
 * @param {{width: number, height: number}} viewport
 * @param {boolean} touch Un teléfono: toques en vez de clics.
 * @param {string} hero
 */
async function intoFight(viewport, touch, hero) {
    const context = await browser.newContext(touch
        ? { viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
        : { viewport });
    const page = await context.newPage();
    /** @type {string[]} */
    const problems = [];
    page.on('pageerror', (/** @type {any} */ e) => problems.push(`PAGEERROR ${e.message}`));
    page.on('console', (/** @type {any} */ m) => {
        if (m.type() === 'error' && !/Failed to load resource.*404/.test(m.text())) problems.push(`ERROR ${m.text().slice(0, 300)}`);
    });
    await context.addInitScript(() => {
        try {
            window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,combat,travel,prisoners,mesa,high,spell,pet,bill,move,attack,roll,talk,journal');
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
            window.localStorage.setItem('sillytavern_gameSucesos', 'off');
            window.localStorage.setItem('sillytavern_gameStoryWindows', 'off');
        } catch { /* nada */ }
    });
    const until = async (/** @type {() => Promise<boolean>} */ test, ms = 30000) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (await test().catch(() => false)) return true;
            await page.waitForTimeout(350);
        }
        return false;
    };
    const tap = (/** @type {any} */ locator) => (touch ? locator.tap({ timeout: 8000 }) : locator.click({ timeout: 8000 }));
    // La máquina puede ir cargada (varias vueltas a la vez): la primera carga, sin prisa.
    // El teléfono entra como la app de la pantalla de inicio (`?juego`, J20.7).
    await page.goto(`${BASE}/${touch ? '?juego' : ''}`, { waitUntil: 'domcontentloaded', timeout: 240000 });
    const firstRun = page.locator('text=Welcome to SillyTavern!');
    if (await firstRun.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await tap(page.locator('.popup-button-ok'));
    }
    await page.waitForSelector('#game-shell', { timeout: 90000 });
    const offline = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Jugar sin conexión' });
    await until(async () => await offline.count() === 1, 30000);
    await tap(offline);
    // El mismo servidor guarda a la heroína de la primera vuelta: «¿Quién entra?» pregunta antes
    // si viene una veterana (idea 179). Aquí se hace una nueva: «Uno nuevo».
    await page.waitForSelector('.hc-root, dialog[open] .vt-card.vt-new', { timeout: 120000 });
    if (await page.locator('dialog[open] .vt-card.vt-new').count() > 0) await tap(page.locator('dialog[open] .vt-card.vt-new').first());
    await page.waitForSelector('.hc-root', { timeout: 120000 });
    await page.fill('.hc-root .hc-name', hero);
    await pickHeroCard(page, 'race', 'Humano', touch);
    await pickHeroCard(page, 'class', 'Guerrero', touch);
    await tap(page.locator('.hc-root .hc-enter'));
    await until(() => page.evaluate(async () => (await import('/scripts/party.js')).getPartyMembersSnapshot().length === 1), 60000);
    return { page, context, problems, until, tap };
}

/**
 * Todo lo que sirve para mirar la pelea en una página.
 *
 * @param {any} page
 * @param {(test: () => Promise<boolean>, ms?: number) => Promise<boolean>} until
 */
function helpers(page, until) {
    const fighting = () => page.evaluate(() => Boolean(window.SillyTavern.getContext().chatMetadata?.combatEncounter?.active));
    const clearDice = async () => {
        for (let i = 0; i < 40; i++) {
            const next = page.locator('.wm-dice-overlay.active .wm-dice-next');
            if (await next.count() === 0) break;
            if (!await next.click({ timeout: 1500 }).then(() => true).catch(() => false)) break;
            await page.waitForTimeout(200);
        }
    };
    const dropToasts = () => page.evaluate(() => document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));
    /** La pelea del muelle, como quien juega: «Continuar», «Pelear» y «Empezar» (`e2e-entrar-pelea.mjs`). */
    const startFight = async () => {
        await dropToasts();
        const on = await entrarEnLaPelea(page, { ms: 60000 });
        if (DEBUG && !on) console.log(`      entrar: ${JSON.stringify(await comoVaLaEntrada(page))}`);
        return on && await until(fighting, 10000);
    };
    /** Esperar a que le toque a uno del grupo. */
    const myTurn = () => until(async () => {
        await clearDice();
        return page.evaluate(async () => {
            const enc = (await import('/scripts/party.js')).getCombatEncounter();
            const entry = enc?.active ? enc.turnOrder?.[enc.currentTurnIndex] : null;
            return Boolean(entry && !entry.isEnemy);
        });
    }, 40000);
    /** La cámara: lo que dice el `transform` del tablero. */
    const camera = () => page.evaluate(() => {
        const content = document.querySelector('#game-shell .gs-scene-map .wm-content');
        const t = content instanceof HTMLElement ? content.style.transform : '';
        // El navegador lo escribe a su manera: `scale(1.5)` sale como `scale(1.5, 1.5)`.
        const m = /translate\(([-\d.e]+)px(?:,\s*([-\d.e]+)px)?\)\s*scale\(([\d.e]+)(?:,\s*[\d.e]+)?\)/.exec(t);
        return {
            x: m ? Number(m[1]) : NaN, y: m ? Number(m[2]) : NaN, scale: m ? Number(m[3]) : NaN,
            zoom: (document.querySelector('#game-shell .vtt-minimap-zoom')?.textContent || '').trim(),
        };
    });
    /** Dónde está en pantalla el centro de una ficha, y la caja del tablero. */
    const tokenAt = (/** @type {number|string} */ id) => page.evaluate((tokenId) => {
        const token = document.querySelector(`#game-shell .gs-scene-map .wm-token[data-token-id="${tokenId}"]`)?.getBoundingClientRect();
        const view = document.querySelector('#game-shell .gs-scene-map .wm-container')?.getBoundingClientRect();
        const board = document.querySelector('#game-shell .gs-scene-map .wm-content')?.getBoundingClientRect();
        if (!token || !view) return null;
        return {
            x: token.left + token.width / 2, y: token.top + token.height / 2, view: { left: view.left, top: view.top, right: view.right, bottom: view.bottom },
            board: board ? { left: board.left, top: board.top, right: board.right, bottom: board.bottom } : null,
        };
    }, id);
    /**
     * El centro de lo que se mira: la vista sin la columna de la derecha (si va por la derecha) ni
     * la barra de acciones de abajo (si flota encima del tablero), como la cuenta el juego.
     */
    const lookCenter = () => page.evaluate(() => {
        const view = document.querySelector('#game-shell .gs-scene-map .wm-container')?.getBoundingClientRect();
        const column = document.querySelector('#game-shell .vtt-top-right')?.getBoundingClientRect();
        const bar = document.querySelector('#game-shell .gs-actions')?.getBoundingClientRect();
        if (!view) return null;
        const right = column && column.width > 0 && column.left > view.left + view.width / 2 && column.height > view.height * 0.3 ? column.left - 8 : view.right;
        const bottom = bar && bar.width > 0 && bar.height > 0 && bar.top < view.bottom && bar.bottom > view.top + view.height / 2 ? bar.top - 8 : view.bottom;
        return { x: (view.left + right) / 2, y: (view.top + bottom) / 2, left: view.left, top: view.top, right, bottom };
    });
    /**
     * Si «centrar» ha dejado a alguien en el centro de lo que se mira: a menos de 30 px, o, en el eje
     * en que el tablero entero cabe en lo que se mira, con el tablero centrado (se le ve igual, y
     * un tablero pequeño no se queda pegado a un lado).
     *
     * @param {any} at Lo que da `tokenAt`.
     * @param {any} look Lo que da `lookCenter`.
     */
    const centred = (at, look) => {
        if (!at || !look) return false;
        const b = at.board;
        const axis = (/** @type {'x'|'y'} */ k) => {
            if (Math.abs(at[k] - look[k]) < 30) return true;
            if (!b) return false;
            const [lo, hi] = k === 'x' ? ['left', 'right'] : ['top', 'bottom'];
            return b[lo] >= look[lo] - 2 && b[hi] <= look[hi] + 2 && Math.abs((b[lo] + b[hi]) / 2 - look[k]) < 4;
        };
        return axis('x') && axis('y');
    };
    const hero = () => page.evaluate(async () => {
        const m = (await import('/scripts/party.js')).getPartyMembersSnapshot()[0];
        return { id: Number(m?.id), x: Number(m?.mapPosition?.gridX) || 0, y: Number(m?.mapPosition?.gridY) || 0 };
    });
    const enemyToken = () => page.evaluate(() => Number(document.querySelector('#game-shell .gs-scene-map .wm-token.wm-token-enemy:not(.wm-token-idle)')?.getAttribute('data-token-id') ?? NaN));
    /** Nada se desplaza: ni la página ni el escenario. */
    const scrollbars = () => page.evaluate(() => {
        const doc = document.documentElement;
        const stage = document.querySelector('#game-shell .gs-stage');
        const view = document.querySelector('#game-shell .gs-scene-map .wm-container')?.getBoundingClientRect();
        const box = stage?.getBoundingClientRect();
        const scrolling = [...document.querySelectorAll('#game-shell .gs-stage, #game-shell .gs-stage *')].filter(n => {
            if (!(n instanceof HTMLElement) || n.closest('.vtt-island, .wm-content')) return false;
            const style = window.getComputedStyle(n);
            return (/(auto|scroll)/.test(style.overflowY) && n.scrollHeight > n.clientHeight + 1) || (/(auto|scroll)/.test(style.overflowX) && n.scrollWidth > n.clientWidth + 1);
        }).map(n => n.className.toString().slice(0, 40));
        return {
            page: doc.scrollWidth > window.innerWidth + 1 || doc.scrollHeight > window.innerHeight + 1,
            stage: stage ? stage.scrollHeight > stage.clientHeight + 1 || stage.scrollWidth > stage.clientWidth + 1 : true,
            scrolling,
            fills: Boolean(view && box && Math.abs(view.left - box.left) <= 2 && Math.abs(view.right - box.right) <= 2 && Math.abs(view.top - box.top) <= 2 && Math.abs(view.bottom - box.bottom) <= 2),
            view: view ? [Math.round(view.left), Math.round(view.top), Math.round(view.width), Math.round(view.height)] : null,
            stageBox: box ? [Math.round(box.left), Math.round(box.top), Math.round(box.width), Math.round(box.height)] : null,
        };
    });
    return { fighting, clearDice, dropToasts, startFight, myTurn, camera, tokenAt, lookCenter, centred, hero, enemyToken, scrollbars };
}

try {
    await startServer();
    browser = await chromium.launch({ channel: 'msedge', headless: !HEADED });

    // ================================================================ 1280 × 720, con ratón
    const desk = await intoFight({ width: 1280, height: 720 }, false, 'Tessa');
    const { page } = desk;
    const h = helpers(page, desk.until);
    const fightOn = await h.startFight();
    check('la pelea del muelle empieza', fightOn);
    await h.clearDice();
    const turn = await h.myTurn();
    await h.dropToasts();
    await page.waitForTimeout(600);
    if (SHOT) await page.screenshot({ path: SHOT.replace(/\.png$/i, '') + '-1280.png' });

    const bars = await h.scrollbars();
    check('1280 × 720: el tablero llena la pantalla de juego, sin barras de desplazamiento',
        turn && !bars.page && !bars.stage && bars.scrolling.length === 0 && bars.fills, JSON.stringify(bars));

    const layer = await page.evaluate(() => {
        const hud = document.querySelector('#game-shell .vtt-hud');
        const style = (/** @type {string} */ s) => { const n = document.querySelector(s); return n ? window.getComputedStyle(n).pointerEvents : ''; };
        const seen = (/** @type {string} */ s) => [...document.querySelectorAll(s)].some(n => { const r = n.getBoundingClientRect(); return r.width > 1 && r.height > 1; });
        return {
            hud: hud ? window.getComputedStyle(hud).pointerEvents : '',
            init: style('#game-shell .vtt-init'), summary: style('#game-shell .vtt-summary'), minimap: style('#game-shell .vtt-minimap'), camera: style('#game-shell .vtt-camera'),
            oldSection: seen('#game-shell .wm-combat-section'), oldLog: seen('#game-shell .combat-log-panel'), oldZoom: seen('#game-shell .wm-zoom-controls'),
        };
    });
    check('la capa del HUD no recibe clics; sus islas (iniciativa, resumen, minimapa, cámara) sí; y no queda el panel ni el registro de antes',
        layer.hud === 'none' && layer.init === 'auto' && layer.summary === 'auto' && layer.minimap === 'auto' && layer.camera === 'auto'
        && !layer.oldSection && !layer.oldLog && !layer.oldZoom, JSON.stringify(layer));

    // La iniciativa.
    const init = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('#game-shell .vtt-init .wm-init-row')];
        return {
            rows: rows.length,
            faces: rows.map(r => {
                const face = r.querySelector('.wm-init-face');
                const box = face?.getBoundingClientRect();
                return { w: Math.round(box?.width ?? 0), h: Math.round(box?.height ?? 0), art: face instanceof HTMLImageElement ? (face.getAttribute('src') || '').split('/').slice(-2).join('/') : '', loaded: face instanceof HTMLImageElement ? face.naturalWidth > 0 : false };
            }),
            bars: rows.filter(r => r.querySelector('.wm-init-hp .wm-init-hp-fill')).length,
            current: rows.filter(r => r.classList.contains('current')).length,
            head: (document.querySelector('#game-shell .vtt-init .wm-init-head')?.textContent || '').replace(/\s+/g, ' ').trim(),
        };
    });
    check('la iniciativa: cada uno con su cara de 26 px en pixel (el ratero, la guerrera), su barra de vida y el turno marcado',
        init.rows >= 2 && init.faces.every(f => f.w === 26 && f.h === 26 && f.loaded) && init.faces.some(f => /^bestias\//.test(f.art))
        && init.bars === init.rows && init.current === 1 && /Ronda 1/.test(init.head) && /Turno de/.test(init.head), JSON.stringify(init));

    // Pulsar la fila del ratero centra la cámara en él.
    const foeId = await h.enemyToken();
    await page.locator('#game-shell .vtt-init .wm-init-row.enemy').first().click();
    await page.waitForTimeout(500);
    const foeAt = await h.tokenAt(foeId);
    const look = await h.lookCenter();
    check('pulsar la fila del ratero en la iniciativa lleva la cámara hasta él',
        h.centred(foeAt, look), JSON.stringify({ foeAt, look }));

    // Espacio: a quien tiene el turno.
    const me = await h.hero();
    await page.mouse.click(5, 5).catch(() => {});
    await page.evaluate(() => /** @type {HTMLElement|null} */ (document.activeElement)?.blur?.());
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);
    const meAt = await h.tokenAt(me.id);
    const look2 = await h.lookCenter();
    check('Espacio centra la cámara en quien tiene el turno', h.centred(meAt, look2), JSON.stringify({ meAt, look2 }));

    // La rueda acerca hacia el cursor: el punto bajo el ratón no se mueve.
    const view = await page.evaluate(() => document.querySelector('#game-shell .gs-scene-map .wm-container')?.getBoundingClientRect().toJSON());
    const cursor = { x: view.left + view.width * 0.35, y: view.top + view.height * 0.55 };
    const before = await h.camera();
    await page.mouse.move(cursor.x, cursor.y);
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(250);
    const after = await h.camera();
    // El punto del tablero bajo el cursor, antes y después.
    const under = (/** @type {any} */ c) => ({ x: (cursor.x - view.left - c.x) / c.scale, y: (cursor.y - view.top - c.y) / c.scale });
    const drift = Math.hypot(under(before).x - under(after).x, under(before).y - under(after).y);
    check('la rueda acerca hacia el cursor: lo que hay bajo el ratón se queda bajo el ratón', after.scale > before.scale && drift < 1.5, JSON.stringify({ before, after, drift }));
    for (let i = 0; i < 25; i++) await page.mouse.wheel(0, -100);
    await page.waitForTimeout(300);
    const most = await h.camera();
    for (let i = 0; i < 40; i++) await page.mouse.wheel(0, 100);
    await page.waitForTimeout(300);
    const least = await h.camera();
    check('la cámara va de 0,45× a 2,2×, ni más ni menos (lo dice el minimapa)', most.zoom === '2,2×' && /^0,[45]×$/.test(least.zoom) && least.scale < most.scale, JSON.stringify({ most, least }));
    if (SHOT) await page.screenshot({ path: SHOT.replace(/\.png$/i, '') + '-1280-lejos.png' });

    // Los botones de la cámara.
    await page.locator('#game-shell .vtt-cam-btn[data-cam="center"]').click();
    await page.waitForTimeout(400);
    const c0 = await h.camera();
    await page.locator('#game-shell .vtt-cam-btn[data-cam="in"]').click();
    await page.waitForTimeout(400);
    const c1 = await h.camera();
    await page.locator('#game-shell .vtt-cam-btn[data-cam="out"]').click();
    await page.locator('#game-shell .vtt-cam-btn[data-cam="out"]').click();
    await page.waitForTimeout(400);
    const c2 = await h.camera();
    await page.locator('#game-shell .vtt-cam-btn[data-cam="center"]').click();
    await page.waitForTimeout(400);
    const meAt2 = await h.tokenAt(me.id);
    const look3 = await h.lookCenter();
    check('los botones de la cámara acercan, alejan y centran en quien tiene el turno',
        c1.scale > c0.scale && c2.scale < c1.scale && h.centred(meAt2, look3), JSON.stringify({ c0, c1, c2, meAt2, look3 }));

    // Pasar el ratón por tu ficha: el alcance en azul, sin pulsar.
    await page.mouse.move(5, view.top + 5);
    await page.waitForTimeout(200);
    const meNow = await h.tokenAt(me.id);
    await page.mouse.move(meNow.x, meNow.y, { steps: 4 });
    await page.waitForTimeout(350);
    const reach = await page.evaluate(() => ({
        on: Boolean(document.querySelector('#game-shell .vtt-reach-layer.on')),
        cells: document.querySelectorAll('#game-shell .vtt-reach-layer .vtt-reach-cell').length,
        clickable: document.querySelectorAll('#game-shell .wm-highlight-clickable').length,
        color: (() => { const c = document.querySelector('#game-shell .vtt-reach-cell'); return c ? window.getComputedStyle(c).backgroundColor : ''; })(),
    }));
    if (SHOT) await page.screenshot({ path: SHOT.replace(/\.png$/i, '') + '-1280-alcance.png' });
    await page.mouse.move(view.left + 20, view.bottom - 260);
    await page.waitForTimeout(300);
    const reachOff = await page.evaluate(() => document.querySelectorAll('#game-shell .vtt-reach-layer.on').length);
    check('pasar el ratón por tu ficha enciende en azul hasta dónde llegas, sin pulsar; al quitarlo, se apaga',
        reach.on && reach.cells > 0 && reach.clickable === 0 && /59, 130, 246/.test(reach.color) && reachOff === 0, JSON.stringify({ reach, reachOff }));

    // Arrastrar mueve el mapa; soltar sobre una casilla encendida no mueve a nadie (sin clics fantasma).
    await page.mouse.click(meNow.x, meNow.y);
    await desk.until(async () => (await page.locator('#game-shell .wm-highlight-move.wm-highlight-clickable').count()) > 0, 5000);
    const lit = await page.evaluate(() => {
        for (const node of document.querySelectorAll('#game-shell .wm-highlight-move.wm-highlight-clickable')) {
            const r = node.getBoundingClientRect();
            const x = r.left + r.width / 2;
            const y = r.top + r.height / 2;
            const top = document.elementFromPoint(x, y);
            if (top === node) return { x, y };
        }
        return null;
    });
    const dragFrom = await h.camera();
    const heroBefore = await h.hero();
    if (lit) {
        await page.mouse.move(lit.x, lit.y);
        await page.mouse.down();
        await page.mouse.move(lit.x + 60, lit.y + 30, { steps: 6 });
        await page.mouse.move(lit.x + 140, lit.y + 50, { steps: 6 });
        await page.mouse.up();
    }
    await page.waitForTimeout(500);
    const dragTo = await h.camera();
    const heroAfter = await h.hero();
    check('arrastrar el mapa con el ratón lo mueve, y soltar sobre una casilla encendida no mueve a tu ficha (sin clic fantasma)',
        Boolean(lit) && Math.abs(dragTo.x - dragFrom.x - 140) < 3 && Math.abs(dragTo.y - dragFrom.y - 50) < 3 && heroAfter.x === heroBefore.x && heroAfter.y === heroBefore.y,
        JSON.stringify({ lit, dragFrom, dragTo, heroBefore, heroAfter }));

    // Un clic en una isla del HUD que tapa una casilla encendida no llega a la casilla.
    const under2 = await page.evaluate(() => {
        const island = document.querySelector('#game-shell .vtt-minimap')?.getBoundingClientRect();
        if (!island) return null;
        return { x: island.left + island.width / 2, y: island.top + island.height / 2 };
    });
    const ghost = { hit: '', moved: false };
    if (under2) {
        ghost.hit = await page.evaluate((p) => {
            const top = document.elementFromPoint(p.x, p.y);
            return top?.closest('.vtt-island') ? 'isla' : (top?.className?.toString() || '');
        }, under2);
        await page.mouse.click(under2.x, under2.y);
        await page.waitForTimeout(400);
        const now = await h.hero();
        ghost.moved = now.x !== heroBefore.x || now.y !== heroBefore.y;
    }
    check('pulsar una isla del HUD (el minimapa) no cuenta como pulsar la casilla de debajo', ghost.hit === 'isla' && !ghost.moved, JSON.stringify(ghost));

    // El minimapa: el recuadro de la vista, y pulsarlo lleva la cámara. Antes se acerca: alejada del
    // todo, la vista es más grande que el tablero y el recuadro ocupa el minimapa entero.
    for (let i = 0; i < 4; i++) await page.locator('#game-shell .vtt-cam-btn[data-cam="in"]').click();
    await page.waitForTimeout(400);
    const mm = await page.evaluate(() => {
        const box = document.querySelector('#game-shell .vtt-minimap-box')?.getBoundingClientRect();
        const frame = document.querySelector('#game-shell .vtt-minimap-view')?.getBoundingClientRect();
        return box && frame ? { box: box.toJSON(), frame: frame.toJSON() } : null;
    });
    const mmBefore = await h.camera();
    if (mm) await page.mouse.click(mm.box.left + 6, mm.box.top + mm.box.height - 6);
    await page.waitForTimeout(500);
    const mmAfter = await h.camera();
    const frameAfter = await page.evaluate(() => document.querySelector('#game-shell .vtt-minimap-view')?.getBoundingClientRect().toJSON());
    check('el minimapa enseña lo que se ve en un recuadro, y pulsarlo lleva allí la cámara (y el recuadro con ella)',
        Boolean(mm && mm.frame.width > 4 && mm.frame.height > 4) && (mmAfter.x !== mmBefore.x || mmAfter.y !== mmBefore.y)
        && Boolean(frameAfter && (Math.abs(frameAfter.left - mm.frame.left) > 2 || Math.abs(frameAfter.top - mm.frame.top) > 2)),
        JSON.stringify({ mm, mmBefore, mmAfter, frameAfter }));

    // El ratero, fuera de la vista: su marcador en el borde; pulsarlo lleva la cámara a él.
    const away = await page.evaluate(async () => {
        // Se arrastra lejos: la cámara se deja el tablero casi fuera, por la esquina contraria al ratero.
        const view = document.querySelector('#game-shell .gs-scene-map .wm-container')?.getBoundingClientRect();
        return view ? { x: view.left + view.width * 0.3, y: view.top + view.height * 0.5 } : null;
    });
    const foeScreen = await h.tokenAt(foeId);
    if (away && foeScreen) {
        const dx = foeScreen.x < (foeScreen.view.left + foeScreen.view.right) / 2 ? 1 : -1;
        await page.mouse.move(away.x, away.y);
        await page.mouse.down();
        for (let i = 1; i <= 10; i++) await page.mouse.move(away.x + dx * 90 * i, away.y + 40 * i);
        await page.mouse.up();
    }
    await page.waitForTimeout(500);
    const edge = await page.evaluate(() => [...document.querySelectorAll('#game-shell .vtt-edge')].map(e => ({ text: (e.textContent || '').trim(), id: e.getAttribute('data-token-id') })));
    if (SHOT) await page.screenshot({ path: SHOT.replace(/\.png$/i, '') + '-1280-borde.png' });
    await page.locator('#game-shell .vtt-edge').first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);
    const foeBack = await h.tokenAt(foeId);
    const look4 = await h.lookCenter();
    check('con el ratero fuera de la vista, sale en el borde con su nombre y sus pies; pulsarlo lleva la cámara a él',
        edge.some(e => /^Ratero del muelle · \d+ pies$/.test(e.text) && Number(e.id) === foeId)
        && h.centred(foeBack, look4), JSON.stringify({ edge, foeBack, look4 }));

    // El resumen del combate: con lo que ha pasado, y se pliega.
    const sumOpen = await page.evaluate(() => ({
        rows: document.querySelectorAll('#game-shell .vtt-summary .cl-body .cl-row').length,
        collapsed: Boolean(document.querySelector('#game-shell .vtt-summary.collapsed')),
    }));
    await page.locator('#game-shell .vtt-summary-toggle').click();
    await page.waitForTimeout(250);
    const sumShut = await page.evaluate(() => ({
        collapsed: Boolean(document.querySelector('#game-shell .vtt-summary.collapsed')),
        list: (document.querySelector('#game-shell .vtt-summary .cl-body')?.getBoundingClientRect().height ?? 0),
        last: (document.querySelector('#game-shell .vtt-summary-last')?.textContent || '').trim(),
    }));
    if (SHOT) await page.screenshot({ path: SHOT.replace(/\.png$/i, '') + '-1280-plegado.png' });
    await page.locator('#game-shell .vtt-summary-toggle').click();
    await page.waitForTimeout(250);
    check('el resumen del combate cuenta lo que pasa y se pliega a una línea (en lugar de la franja de abajo)',
        sumOpen.rows > 0 && !sumOpen.collapsed && sumShut.collapsed && sumShut.list === 0 && sumShut.last.length > 0, JSON.stringify({ sumOpen, sumShut }));

    // Al volver tu turno, la cámara te busca: la vista se aleja de Tessa y se acaba el turno.
    const meAway = await h.tokenAt(me.id);
    const hidden = meAway && (meAway.x < meAway.view.left || meAway.x > meAway.view.right || meAway.y < meAway.view.top || meAway.y > meAway.view.bottom
        || Math.abs(meAway.x - look4.x) > 120 || Math.abs(meAway.y - look4.y) > 120);
    await page.waitForTimeout(2600);
    await page.evaluate(async () => {
        const { endPlayerCombatTurn } = await import('/scripts/party/player-actions.js');
        endPlayerCombatTurn();
    });
    await page.waitForTimeout(800);
    const back = await h.myTurn();
    await page.waitForTimeout(700);
    const meFound = await h.tokenAt(me.id);
    const stillFighting = await h.fighting();
    check('al volver tu turno, si no se te ve, la cámara te busca',
        !stillFighting || Boolean(back && meFound && meFound.x > meFound.view.left + 40 && meFound.x < meFound.view.right - 40 && meFound.y > meFound.view.top + 40 && meFound.y < meFound.view.bottom - 40),
        JSON.stringify({ hidden, back, meFound, stillFighting }));

    // ================================================================ 1920 × 1080
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(900);
    await page.locator('#game-shell .vtt-cam-btn[data-cam="center"]').click().catch(() => {});
    for (let i = 0; i < 3; i++) await page.locator('#game-shell .vtt-cam-btn[data-cam="in"]').click().catch(() => {});
    await page.waitForTimeout(500);
    const big = await h.scrollbars();
    if (SHOT) await page.screenshot({ path: SHOT.replace(/\.png$/i, '') + '-1920.png' });
    check('1920 × 1080: el tablero llena la pantalla de juego, sin barras de desplazamiento', !big.page && !big.stage && big.scrolling.length === 0 && big.fills, JSON.stringify(big));

    // ================================================================ fuera de combate: el mismo tablero, sin el HUD del combate
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.evaluate(async () => {
        const enc = (await import('/scripts/party.js')).getCombatEncounter();
        for (const e of enc?.enemies ?? []) e.currentHp = 0;
    });
    for (let i = 0; i < 8 && await h.fighting(); i++) {
        await page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/combat-end'));
        await page.waitForTimeout(700);
        await h.clearDice();
    }
    await h.dropToasts();
    // La tarjeta de la victoria se cierra pulsándola; la historia sigue en la novela, «Continuar»
    // lleva al pueblo (D-J45), y desde él se entra otra vez en el tablero del muelle, ya sin pelea.
    await page.evaluate(() => document.querySelectorAll('.vs-card, .gs-victory, .wm-victory').forEach(v => /** @type {HTMLElement} */ (v).click()));
    const onBoard = await desk.until(async () => {
        const scene = await page.evaluate(() => {
            const now = document.querySelector('#game-shell')?.getAttribute('data-scene') || '';
            if (now === 'dialogue') /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .gs-vn-box .gs-chip-continue'))?.click();
            if (now === 'exploration') /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .gs-board'))?.click();
            return now;
        });
        return scene === 'combat' && await page.evaluate(() => Boolean(window.SillyTavern.getContext().chatMetadata?.currentBoard));
    }, 20000);
    await page.waitForTimeout(800);
    const calm = await page.evaluate(() => ({
        fighting: Boolean(window.SillyTavern.getContext().chatMetadata?.combatEncounter?.active),
        hud: Boolean(document.querySelector('#game-shell .vtt-hud')),
        init: Boolean(document.querySelector('#game-shell .vtt-init')),
        summary: Boolean(document.querySelector('#game-shell .vtt-summary')),
        edges: document.querySelectorAll('#game-shell .vtt-edge').length,
        minimap: Boolean(document.querySelector('#game-shell .vtt-minimap')),
        scene: document.querySelector('#game-shell')?.getAttribute('data-scene') || '',
    }));
    const calmBars = await h.scrollbars();
    if (SHOT) await page.screenshot({ path: SHOT.replace(/\.png$/i, '') + '-explorar.png' });
    check('fuera de combate, el mismo tablero a toda la pantalla, con su cámara y su minimapa, sin iniciativa, resumen ni marcadores',
        !calm.fighting && onBoard && calm.hud && !calm.init && !calm.summary && calm.edges === 0 && calm.minimap && calmBars.fills && !calmBars.stage && !calmBars.page,
        JSON.stringify({ onBoard, calm, calmBars }));
    check('sin errores en la página (ratón)', desk.problems.length === 0, desk.problems.slice(0, 6).join('\n        '));
    await desk.context.close();

    // ================================================================ 390 × 844, a toques
    const phone = await intoFight({ width: 390, height: 844 }, true, 'Nerea');
    const p = phone.page;
    const ph = helpers(p, phone.until);
    check('en el teléfono, la pelea del muelle empieza', await ph.startFight());
    // Con `?juego` en la dirección, las pestañas de los fondos cargaban la página entera dentro de
    // una (`<base href="/">`): dos filas del tablero, y el juego dibujaba en la escondida.
    const boardRows = await p.evaluate(() => document.querySelectorAll('[id="world_location_maps_row"]').length);
    check('en la app del teléfono (?juego), la página no se repite: una sola fila del tablero', boardRows === 1, String(boardRows));
    await ph.clearDice();
    const phoneTurn = await ph.myTurn();
    await ph.dropToasts();
    await p.waitForTimeout(700);
    if (SHOT) await p.screenshot({ path: SHOT.replace(/\.png$/i, '') + '-390.png' });
    const phoneBars = await ph.scrollbars();
    const phoneHud = await p.evaluate(() => {
        const inside = (/** @type {string} */ s) => [...document.querySelectorAll(s)].every(n => {
            const r = n.getBoundingClientRect();
            return r.width === 0 || (r.left >= -1 && r.right <= window.innerWidth + 1 && r.top >= -1 && r.bottom <= window.innerHeight + 1);
        });
        const init = document.querySelector('#game-shell .vtt-init')?.getBoundingClientRect();
        const view = document.querySelector('#game-shell .gs-scene-map .wm-container')?.getBoundingClientRect();
        return {
            inside: inside('#game-shell .vtt-island'),
            initHeight: Math.round(init?.height ?? 0),
            viewHeight: Math.round(view?.height ?? 0),
            folded: Boolean(document.querySelector('#game-shell .vtt-summary.collapsed')),
        };
    });
    check('390 × 844: el tablero llena la pantalla de juego sin desplazarse, y el HUD, compacto, cabe entero (la iniciativa en una fila, el resumen plegado)',
        phoneTurn && !phoneBars.page && !phoneBars.stage && phoneBars.fills && phoneHud.inside && phoneHud.initHeight > 0 && phoneHud.initHeight < 110 && phoneHud.folded,
        JSON.stringify({ phoneBars, phoneHud }));

    // El primer toque en tu ficha enciende tu alcance.
    const myself = await ph.hero();
    const mine = await p.evaluate((id) => {
        const node = document.querySelector(`#game-shell .gs-scene-map .wm-token[data-token-id="${id}"]`);
        const r = node?.getBoundingClientRect();
        if (!r) return null;
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        const top = document.elementFromPoint(x, y);
        return { x, y, hit: Boolean(top && node?.contains(top)) };
    }, myself.id);
    if (mine?.hit) await p.touchscreen.tap(mine.x, mine.y);
    const litPhone = await phone.until(async () => (await p.locator('#game-shell .wm-highlight-move.wm-highlight-clickable').count()) > 0, 5000);
    if (SHOT) await p.screenshot({ path: SHOT.replace(/\.png$/i, '') + '-390-alcance.png' });
    check('a toques, el primer toque en tu ficha enciende hasta dónde llegas', Boolean(mine?.hit) && litPhone, JSON.stringify({ mine, litPhone }));

    // Dos dedos acercan; uno arrastra.
    const fingers = (/** @type {Array<Array<[number, number]>>} */ tracks) => p.evaluate((all) => {
        const board = document.querySelector('#game-shell .gs-scene-map .wm-container');
        if (!board) return false;
        const fire = (/** @type {string} */ type, /** @type {number} */ finger, /** @type {[number, number]} */ at) => board.dispatchEvent(new PointerEvent(type, {
            pointerId: 40 + finger, pointerType: 'touch', isPrimary: finger === 0, clientX: at[0], clientY: at[1], bubbles: true, cancelable: true,
        }));
        all.forEach((track, finger) => fire('pointerdown', finger, track[0]));
        const steps = Math.max(...all.map(t => t.length));
        for (let i = 1; i < steps; i++) all.forEach((track, finger) => fire('pointermove', finger, track[Math.min(i, track.length - 1)]));
        all.forEach((track, finger) => fire('pointerup', finger, track[track.length - 1]));
        return true;
    }, tracks);
    const mid = await p.evaluate(() => {
        const r = document.querySelector('#game-shell .gs-scene-map .wm-container')?.getBoundingClientRect();
        return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: 195, y: 400 };
    });
    const pc0 = await ph.camera();
    await fingers([[[mid.x - 20, mid.y], [mid.x - 50, mid.y], [mid.x - 90, mid.y]], [[mid.x + 20, mid.y], [mid.x + 50, mid.y], [mid.x + 90, mid.y]]]);
    const pc1 = await ph.camera();
    await fingers([[[mid.x, mid.y], [mid.x + 30, mid.y + 20], [mid.x + 70, mid.y + 40]]]);
    const pc2 = await ph.camera();
    check('a toques, dos dedos que se separan acercan la cámara (sin pasar de 2,2×) y uno la arrastra',
        pc1.scale > pc0.scale && (pc2.x !== pc1.x || pc2.y !== pc1.y) && Math.abs(pc2.scale - pc1.scale) < 1e-6, JSON.stringify({ pc0, pc1, pc2 }));

    // Tumbado.
    await p.setViewportSize({ width: 844, height: 390 });
    await p.waitForTimeout(900);
    if (SHOT) await p.screenshot({ path: SHOT.replace(/\.png$/i, '') + '-844-tumbado.png' });
    const flat = await ph.scrollbars();
    const flatHud = await p.evaluate(() => [...document.querySelectorAll('#game-shell .vtt-island')].filter(n => {
        const r = n.getBoundingClientRect();
        return r.width > 0 && (r.left < -1 || r.right > window.innerWidth + 1 || r.top < -1 || r.bottom > window.innerHeight + 1);
    }).map(n => n.className.toString()));
    check('tumbado (844 × 390): sin desplazarse a lo ancho, el tablero lleno y el HUD dentro de la pantalla', !flat.page && flat.fills && flatHud.length === 0, JSON.stringify({ flat, flatHud }));
    check('sin errores en la página (teléfono)', phone.problems.length === 0, phone.problems.slice(0, 6).join('\n        '));
    await phone.context.close();
} catch (error) {
    failures++;
    console.log(`FAIL  the run threw: ${/** @type {any} */ (error)?.stack || error}`);
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
