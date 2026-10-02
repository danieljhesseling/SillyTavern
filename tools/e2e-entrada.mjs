#!/usr/bin/env node
/**
 * Tanda 10, «entrar en la pelea y moverse» (wiki/maquetas/ENCARGO_COMBATE_VTT.md), en el navegador,
 * contra un servidor propio con un `--dataRoot` temporal:
 *
 *   título → Jugar sin conexión → Tessa, guerrera → el muelle del prólogo: en la novela no hay
 *   «Iniciar combate», ni «Evitar la pelea», ni «Saltar la prueba» → «Continuar» al tablero y la
 *   pelea se abre sola: la decisión (Pelear, Hablar, Pagar…, sin «Todavía no») → «Pelear» →
 *   colocarse: casillas de salida en azul, ninguna en el mar; mover a Tessa a otra → «Empezar» →
 *   iniciativa → en su turno, nada encendido en el mar, el agua honda lo dice al pasar por encima,
 *   y la ruta hasta el ratero va recta (un giro como mucho) y cuesta con las diagonales alternas.
 *
 * Capturas a 1280×720, 1920×1080, 390×844 y 844×390 de la decisión y de colocarse.
 *
 * Uso:
 *   node tools/e2e-entrada.mjs --port 8412 --captura <carpeta>/entrada.png
 */

/* global window, document, HTMLElement */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { comoVaLaEntrada } from './e2e-entrar-pelea.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8412;
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

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-entrada-'));
/** @type {any} */
let server = null;
/** @type {any} */
let browser = null;

function startServer() {
    server = spawn(process.execPath, ['server.js', '--port', String(PORT), '--dataRoot', dataRoot], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    const child = server;
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('the server did not start in 600s')), 600000);
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
 * Elegir en una tarjeta de «Crear personaje», como en e2e-gremio.
 *
 * @param {any} page
 * @param {string} pick
 * @param {string} wanted
 */
async function pickHeroCard(page, pick, wanted) {
    await page.locator(`.hc-root .hc-card[data-pick="${pick}"] .hc-pick`).click();
    await page.waitForSelector('.hc-picker .hc-option', { timeout: 15000 });
    const plain = (/** @type {string} */ v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const values = await page.evaluate(() => [...document.querySelectorAll('.hc-picker .hc-option')].map(o => o.getAttribute('data-value') || ''));
    const chosen = values.find(v => plain(v) === plain(wanted)) ?? values.find(v => plain(v).includes(plain(wanted))) ?? values[0];
    await page.locator(`.hc-picker .hc-option[data-value="${chosen}"]`).first().click();
    await page.waitForSelector('.hc-picker', { state: 'detached', timeout: 15000 }).catch(() => {});
}

try {
    await startServer();
    browser = await chromium.launch({ channel: 'msedge', headless: !HEADED });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    /** @type {string[]} */
    const problems = [];
    page.on('pageerror', (/** @type {any} */ e) => problems.push(`PAGEERROR ${e.message}`));
    page.on('console', (/** @type {any} */ m) => {
        if (m.type() === 'error' && !/Failed to load resource.*404/.test(m.text())) problems.push(`ERROR ${m.text().slice(0, 300)}`);
    });
    // Nada de internet: el juego no carga nada de fuera.
    /** @type {string[]} */
    const outside = [];
    page.on('request', (/** @type {any} */ r) => { if (!r.url().startsWith(BASE) && !/^(data|blob):/.test(r.url())) outside.push(r.url()); });
    await context.addInitScript(() => {
        try {
            window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,travel,prisoners,mesa,high,spell,pet,bill,combat,move,attack,journal,talk');
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
            window.localStorage.setItem('sillytavern_gameSucesos', 'off');
            window.localStorage.setItem('sillytavern_gameStoryWindows', 'off');
        } catch { /* nada */ }
    });

    const state = () => page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const party = (await import('/scripts/party.js')).getPartyMembersSnapshot();
        return {
            board: String(ctx.chatMetadata?.currentBoard ?? ''),
            fighting: Boolean(ctx.chatMetadata?.combatEncounter?.active),
            hero: party[0] ? { x: Number(party[0].mapPosition?.gridX), y: Number(party[0].mapPosition?.gridY), id: party[0].id } : null,
            scene: document.querySelector('#game-shell')?.getAttribute('data-scene') || '',
        };
    });
    const chips = () => page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-chip-action')].map(c => (c.textContent || '').trim()));
    const until = async (/** @type {() => Promise<boolean>} */ test, ms = 30000) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (await test().catch(() => false)) return true;
            await page.waitForTimeout(350);
        }
        return false;
    };
    const dropToasts = () => page.evaluate(() => document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));
    const clearDice = async () => {
        for (let i = 0; i < 30; i++) {
            const next = page.locator('.wm-dice-overlay.active .wm-dice-next');
            if (await next.count() === 0) break;
            await next.click({ timeout: 1500 }).catch(() => {});
            await page.waitForTimeout(200);
        }
    };
    /** Una captura a cada tamaño, volviendo al de siempre. */
    const shootSizes = async (/** @type {string} */ tag) => {
        if (!SHOT) return {};
        /** @type {Record<string, any>} */
        const fit = {};
        for (const [w, h] of [[1280, 720], [1920, 1080], [390, 844], [844, 390]]) {
            await page.setViewportSize({ width: w, height: h });
            await page.waitForTimeout(500);
            await page.screenshot({ path: `${SHOT}.${tag}-${w}x${h}.png` });
            fit[`${w}x${h}`] = await page.evaluate(() => {
                const bar = document.querySelector('.cv-place, dialog.ev-avoid[open] .ev-box');
                const box = bar?.getBoundingClientRect();
                const start = document.querySelector('.cv-place .cv-place-start, dialog.ev-avoid[open] [data-exit="pelear"]')?.getBoundingClientRect();
                return {
                    sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth,
                    inside: box ? box.left >= 0 && box.right <= window.innerWidth + 1 && box.top >= 0 && box.bottom <= window.innerHeight + 1 : null,
                    button: start ? start.width > 0 && start.bottom <= window.innerHeight + 1 && start.top >= 0 : null,
                };
            });
        }
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.waitForTimeout(400);
        return fit;
    };

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 300000 });
    const firstRun = page.locator('text=Welcome to SillyTavern!');
    if (await firstRun.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#game-shell', { timeout: 90000 });
    const offline = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Jugar sin conexión' });
    await until(async () => await offline.count() === 1, 30000);
    await offline.click();
    await page.waitForSelector('.hc-root', { timeout: 120000 });
    await page.fill('.hc-root .hc-name', 'Tessa');
    await page.locator('.hc-root .hc-gender[data-value="Mujer"]').click();
    await pickHeroCard(page, 'race', 'Humano');
    await pickHeroCard(page, 'class', 'Guerrero');
    await page.locator('.hc-root .hc-enter').click();

    // 1. En el muelle, leyendo: ninguna ficha de empezar la pelea, ni de lo que no es del tablero.
    const atDock = await until(async () => (await state()).board === 'El muelle de Puerto Alba', 90000);
    await page.waitForTimeout(1500);
    const novelRow = await chips();
    check('el prólogo empieza en el muelle, leyendo', atDock, JSON.stringify(await state()));
    check('en el tablero, la fila no ofrece «Iniciar combate», «Evitar la pelea», «Saltar la prueba», «Hablar con…», «Escuchar rumores» ni «Tirada»',
        !novelRow.some(c => /Iniciar combate|Evitar la pelea|Saltar la prueba|^Hablar con|Escuchar rumores|^Tirada$/.test(c)), JSON.stringify(novelRow));

    // 2. «Continuar» al tablero: la pelea se abre sola, con la decisión.
    const decided = await until(async () => {
        if ((await comoVaLaEntrada(page)).deciding) return true;
        await page.evaluate(() => /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .gs-vn-box .gs-chip-continue'))?.click());
        return false;
    }, 30000);
    const decision = await comoVaLaEntrada(page);
    check('al llegar al tablero con el ratero a la vista, se abre sola la decisión (sin pulsar nada más)', decided && (await state()).scene === 'combat', JSON.stringify({ decision, now: await state() }));
    check('la decisión ofrece «Pelear» primero y otras salidas (hablar, pagar…), y no se puede dejar para luego',
        decision.options[0] === 'pelear' && decision.options.length >= 3 && !decision.closable, JSON.stringify(decision));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    check('Escape no la cierra: os han visto', (await comoVaLaEntrada(page)).deciding);
    const decisionFit = await shootSizes('decision');
    check('la decisión cabe en la pantalla a 1280×720, 1920×1080, 390×844 y 844×390, sin barra de lado',
        Object.values(decisionFit).every((/** @type {any} */ f) => !f.sideways && f.button !== false), JSON.stringify(decisionFit));

    // 3. «Pelear»: a colocarse, con las casillas de salida en azul.
    await page.locator('dialog.ev-avoid[open] [data-exit="pelear"]').click({ timeout: 5000 });
    const placing = await until(async () => (await comoVaLaEntrada(page)).placing, 10000);
    await dropToasts();
    const placeView = await page.evaluate(async () => {
        const fe = await import('/scripts/party/fight-entry.js');
        const board = (await import('/scripts/party/board.js')).getActiveBoardContext();
        const cells = [...document.querySelectorAll('#game-shell .wm-highlight-place')].map(n => ({ x: Number(n.getAttribute('data-x')), y: Number(n.getAttribute('data-y')) }));
        const sea = cells.filter(c => board.terrain.cells[`${c.x},${c.y}`]?.type === 'deep_water');
        return { entry: fe.fightEntryState(), cells, sea: sea.length, fighting: Boolean(window.SillyTavern.getContext().chatMetadata?.combatEncounter?.active) };
    });
    check('tras «Pelear», el grupo se coloca antes de la iniciativa: barra de colocar, casillas de salida en azul y aún sin pelea',
        placing && !placeView.fighting && placeView.entry.placing && placeView.cells.length >= 4, JSON.stringify(placeView));
    check('ninguna casilla de salida en el mar', placeView.sea === 0, JSON.stringify(placeView.sea));
    const placeFit = await shootSizes('colocar');
    check('la barra de colocar cabe entera, con «Empezar» a la vista, a 1280×720, 1920×1080, 390×844 y 844×390',
        Object.values(placeFit).every((/** @type {any} */ f) => !f.sideways && f.inside !== false && f.button !== false), JSON.stringify(placeFit));
    // Mover a Tessa a otra casilla de salida, pulsándola.
    const before = (await state()).hero;
    const target = placeView.cells.find((/** @type {any} */ c) => before && (c.x !== before.x || c.y !== before.y));
    if (target) await page.locator(`#game-shell .wm-highlight-place[data-x="${target.x}"][data-y="${target.y}"]`).click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(600);
    const after = (await state()).hero;
    check('pulsar una casilla azul pone ahí a Tessa', Boolean(target && after && after.x === target.x && after.y === target.y), JSON.stringify({ before, target, after }));

    // 4. «Empezar»: la iniciativa, y la pelea.
    await page.locator('.cv-place .cv-place-start').click({ timeout: 5000 });
    const fighting = await until(async () => (await state()).fighting, 10000);
    check('«Empezar» tira la iniciativa: hay pelea, y la barra de colocar se va', fighting && !(await comoVaLaEntrada(page)).placing);
    const startedAt = (await state()).hero;
    check('Tessa empieza donde la pusiste', Boolean(startedAt && after && startedAt.x === after.x && startedAt.y === after.y), JSON.stringify({ startedAt, after }));

    // 5. En su turno: el mar no se enciende, el agua honda lo dice, y la ruta al ratero va recta.
    const myTurn = await until(async () => {
        await clearDice();
        return page.evaluate(async () => {
            const enc = (await import('/scripts/party.js')).getCombatEncounter();
            const entry = enc?.active ? enc.turnOrder?.[enc.currentTurnIndex] : null;
            return Boolean(entry && !entry.isEnemy);
        });
    }, 30000);
    await dropToasts();
    // Elegir a Tessa enciende hasta dónde llega.
    await page.locator('#game-shell .wm-token:not(.wm-token-enemy)').first().click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(600);
    const turnView = await page.evaluate(async () => {
        const party = (await import('/scripts/party.js'));
        const enc = party.getCombatEncounter();
        const board = (await import('/scripts/party/board.js')).getActiveBoardContext();
        const pf = await import('/scripts/game-engine/board/pathfinding.js');
        const hero = party.getPartyMembersSnapshot()[0];
        const thief = enc.enemies.find((/** @type {any} */ e) => Number(e.currentHp) > 0);
        const lit = [...document.querySelectorAll('#game-shell .wm-highlight-move')].map(n => ({ x: Number(n.getAttribute('data-x')), y: Number(n.getAttribute('data-y')) }));
        const sea = lit.filter(c => board.terrain.cells[`${c.x},${c.y}`]?.type === 'deep_water');
        const hx = Number(hero.mapPosition.gridX);
        const hy = Number(hero.mapPosition.gridY);
        const goal = { x: Number(thief.gridX), y: Number(thief.gridY) + 1 };
        const path = pf.findPath(board.terrain, hx, hy, goal.x, goal.y, board.gridWidth, board.gridHeight, { occupied: new Set([`${thief.gridX},${thief.gridY}`]) }) ?? [];
        let turns = 0;
        for (let i = 2; i < path.length; i++) {
            const a = `${path[i - 1].x - path[i - 2].x},${path[i - 1].y - path[i - 2].y}`;
            const b = `${path[i].x - path[i - 1].x},${path[i].y - path[i - 1].y}`;
            if (a !== b) turns++;
        }
        return {
            rule: pf.DIAGONAL_RULE, lit: lit.length, sea: sea.length, hero: { x: hx, y: hy }, thief: { x: thief.gridX, y: thief.gridY },
            path: path.map((/** @type {any} */ c) => `${c.x},${c.y}`), turns, feet: pf.getPathCost(board.terrain, path) * 5,
        };
    });
    check('en su turno, lo que se enciende para andar no incluye el mar', myTurn && turnView.lit > 0 && turnView.sea === 0, JSON.stringify(turnView));
    check('la ruta hasta el ratero va recta: un giro como mucho', turnView.path.length > 1 && turnView.turns <= 1, JSON.stringify(turnView));
    check('las diagonales van alternas (5, 10, 5…), en un solo interruptor', turnView.rule === 'alternas');
    // Al pasar el ratón por el mar, la casilla lo dice.
    const seaNote = await page.evaluate(async () => {
        const board = (await import('/scripts/party/board.js')).getActiveBoardContext();
        const key = Object.entries(board.terrain.cells).find(([, c]) => /** @type {any} */ (c).type === 'deep_water')?.[0] ?? '';
        const [x, y] = key.split(',').map(Number);
        const content = document.querySelector('#game-shell .wm-content');
        const box = content?.getBoundingClientRect();
        if (!box) return { x, y, at: null };
        return { x, y, at: { cx: box.left + ((x + 0.5) / board.gridWidth) * box.width, cy: box.top + ((y + 0.5) / board.gridHeight) * box.height } };
    });
    if (seaNote.at) await page.mouse.move(seaNote.at.cx, seaNote.at.cy);
    await page.waitForTimeout(400);
    const said = await page.evaluate(() => (document.querySelector('#game-shell .wm-cell-info')?.textContent || '').trim());
    check('al pasar el ratón por el agua honda, dice «Agua honda: no se cruza andando»', /Agua honda: no se cruza andando/.test(said), JSON.stringify({ seaNote, said }));
    // Pasar el ratón por la casilla de debajo del ratero dibuja la ruta recta.
    const goalCell = { x: turnView.thief.x, y: turnView.thief.y + 1 };
    const goalAt = await page.evaluate((cell) => {
        const node = document.querySelector(`#game-shell .wm-highlight-move[data-x="${cell.x}"][data-y="${cell.y}"]`);
        const box = node?.getBoundingClientRect();
        return box ? { cx: box.left + box.width / 2, cy: box.top + box.height / 2 } : null;
    }, goalCell);
    if (goalAt) await page.mouse.move(goalAt.cx, goalAt.cy);
    await page.waitForTimeout(500);
    const drawn = await page.evaluate(() => ({
        steps: document.querySelectorAll('#game-shell .wm-path-step').length,
        cost: (document.querySelector('#game-shell .wm-path-cost')?.textContent || '').trim(),
    }));
    if (SHOT) await page.screenshot({ path: `${SHOT}.ruta-1280x720.png` });
    check('al pasar por la casilla de debajo del ratero, se dibuja la ruta con su precio en pies', !goalAt || (drawn.steps > 0 && /pies/.test(drawn.cost)), JSON.stringify({ goalAt, drawn }));

    check('el juego no ha pedido nada a internet', outside.length === 0, JSON.stringify(outside.slice(0, 5)));
    check('sin errores en la página', problems.filter(p => /PAGEERROR/.test(p)).length === 0, JSON.stringify(problems.slice(0, 6)));
} catch (error) {
    failures++;
    console.error('FAIL  la vuelta se ha roto:', error);
} finally {
    await browser?.close().catch(() => {});
    server?.kill();
    try { rmSync(dataRoot, { recursive: true, force: true }); } catch { /* nada */ }
    console.log(failures === 0 ? '\nTodo bien.' : `\n${failures} fallo(s).`);
    process.exit(failures === 0 ? 0 : 1);
}
