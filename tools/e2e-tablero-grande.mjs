#!/usr/bin/env node
/**
 * Un tablero grande hecho de un mapa en imagen, jugado a toques en un teléfono (J12.3, J12.8 a
 * J12.11, J12.13 y J20.2 de ROADMAP_SIN_CONEXION), contra un servidor propio con un `--dataRoot`
 * temporal, como `e2e-tablero.mjs`.
 *
 * El mapa lo dibuja la prueba (sin arte de nadie): una cripta de 40 × 28 casillas de 24 px, con
 * una sala de entrada al oeste (C), un pasillo, una sala con un risco de 20 pies en medio, otro
 * pasillo y la sala del fondo al este (B1), donde espera un jefe. Se guarda como imagen del
 * usuario y la campaña la trae como tablero dibujado (`image`, `grid`), con sus salas, sus cotas
 * y dos trampas (`traps`):
 *
 *   título → Jugar sin conexión → una maga → saltar la prueba → el tablón → «Añadir una campaña»
 *   → empezarla → y cruzar la cripta de punta a punta, a toques:
 *
 *   - se ve por partes, sobre el dibujo limpio, con niebla en lo no visto (J12.13, J12.8);
 *   - una losa sin ver salta al pisarla, y quien anda se queda en ella (J12.3);
 *   - al risco no se sube andando, y tocarlo dice su altura y su borde (J12.10, J20.2);
 *   - «Buscar trampas» encuentra los dardos, que cierran el pasillo; «Desarmar» los quita (J12.3);
 *   - la cámara sigue a la maga todo el camino (J12.13);
 *   - al entrar en B1, su nombre y su nota, en el aviso y en la cabecera del tablero (J12.11);
 *   - y el jefe que espera allí lleva su corona (arte del tablero).
 *
 * Uso:
 *   node tools/e2e-tablero-grande.mjs                         # puerto 8171, sin ventana
 *   node tools/e2e-tablero-grande.mjs --headed
 *   node tools/e2e-tablero-grande.mjs --port 8172 --captura grande   # y una captura por paso
 */

/* global window, document, HTMLElement, PointerEvent */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Buffer } from 'node:buffer';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8171;
const BASE = `http://127.0.0.1:${PORT}`;
const HEADED = process.argv.includes('--headed');
const SHOT = argAfter('--captura');

const require = createRequire(join(ROOT, 'tests/package.json'));
const { chromium } = require('@playwright/test');
const { default: png } = await import('@jimp/js-png');

let failures = 0;
const check = (/** @type {string} */ name, /** @type {boolean} */ ok, detail = '') => {
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        -> ${detail}` : ''}`);
};

// ---- La cripta: 40 × 28 casillas ----------------------------------------------------------------
//
//   C (x 1-8, y 9-19): la entrada, donde empieza la maga, en (3,14).
//   Pasillo (x 9-13, y 14), con la losa en (9,14).
//   La sala del risco (x 14-20, y 10-18); el risco, a 20 pies, en x 16-18, y 10-11.
//   Pasillo (x 21-30, y 14), con los dardos en (26,14).
//   B1 (x 31-38, y 9-19): la sala del eco; el jefe, en (36,11).
const COLS = 40;
const ROWS = 28;
const CELL = 24;
const floor = (/** @type {number} */ x, /** @type {number} */ y) => (x >= 1 && x <= 8 && y >= 9 && y <= 19)
    || (x >= 9 && x <= 13 && y === 14)
    || (x >= 14 && x <= 20 && y >= 10 && y <= 18)
    || (x >= 21 && x <= 30 && y === 14)
    || (x >= 31 && x <= 38 && y >= 9 && y <= 19);
const MAP = Array.from({ length: ROWS }, (_, y) => Array.from({ length: COLS }, (_, x) => (floor(x, y) ? '.' : '#')).join(''));
const LEDGE = [];
for (let y = 10; y <= 11; y++) for (let x = 16; x <= 18; x++) LEDGE.push(`${x},${y}`);

/** El dibujo: suelo de papel con su cuadrícula, roca rayada y el risco más claro. */
function drawMap() {
    const width = COLS * CELL;
    const height = ROWS * CELL;
    const data = Buffer.alloc(width * height * 4, 255);
    const put = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number[]} */ rgb) => {
        const i = (y * width + x) * 4;
        data[i] = rgb[0];
        data[i + 1] = rgb[1];
        data[i + 2] = rgb[2];
        data[i + 3] = 255;
    };
    for (let cy = 0; cy < ROWS; cy++) {
        for (let cx = 0; cx < COLS; cx++) {
            const open = MAP[cy][cx] === '.';
            const high = LEDGE.includes(`${cx},${cy}`);
            for (let y = 0; y < CELL; y++) {
                for (let x = 0; x < CELL; x++) {
                    const px = cx * CELL + x;
                    const py = cy * CELL + y;
                    if (!open) put(px, py, (x + y + px) % 6 < 2 ? [40, 36, 44] : [96, 90, 100]);
                    else if (x === 0 || y === 0) put(px, py, [150, 140, 120]);
                    else put(px, py, high ? [214, 200, 160] : [236, 226, 200]);
                }
            }
        }
    }
    return { width, height, data };
}

const { buildExamplePack } = await import(pathToFileURL(join(ROOT, 'public/scripts/game-engine/campaign/campaign-pack-schema.js')).href);
const NAME = 'La Cripta del Risco';
const ID = 'tuya-la-cripta-del-risco';
const HERO = 'Nadia';
const IMAGE = 'user/images/e2e-grande/cripta.png';
const BOSS = 'El Guardián de la cripta';
const B1_NOTE = 'Una bóveda alta que devuelve cada paso. Al fondo, algo grande espera quieto.';
const pack = (() => {
    const made = buildExamplePack();
    made.world.name = NAME;
    made.bestiary.push({ name: BOSS, hp: 30, armorClass: 14, cr: 2, profile: 'guardian', attackRangeFeet: 5, boss: true });
    made.boards[0] = {
        id: made.boards[0].id,
        name: 'La cripta',
        locationName: made.boards[0].locationName,
        map: MAP,
        image: IMAGE,
        grid: { cell: CELL, offsetX: 0, offsetY: 0, cols: COLS, rows: ROWS },
        partyStart: [{ x: 3, y: 14 }, { x: 3, y: 13 }],
        enemies: [{ name: BOSS, x: 36, y: 11 }],
        zones: [
            { name: 'C · La entrada', rect: { x: 1, y: 9, width: 8, height: 11 }, note: 'Escalones gastados y un frío que sube del suelo.' },
            { name: 'La sala del risco', rect: { x: 14, y: 10, width: 7, height: 9 }, note: 'Un risco de piedra se alza en medio, sin escalera.' },
            { name: 'B1 · La sala del eco', rect: { x: 31, y: 9, width: 8, height: 11 }, note: B1_NOTE },
        ],
        elevation: Object.fromEntries(LEDGE.map(key => [key, 20])),
        traps: [
            { name: 'Losa hundida', x: 9, y: 14, tell: 'Una losa más baja que las demás.', damage: '1d2', spotDC: 30, disarmDC: 12 },
            { name: 'Dardos en la pared', x: 26, y: 14, tell: 'Agujeritos en la pared, a la altura del cuello.', damage: '1d4', spotDC: 8, disarmDC: 10 },
        ],
    };
    return made;
})();

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-grande-'));
// La imagen, como una del usuario: se sirve en /user/images/…
const imageDir = join(dataRoot, 'default-user', 'user', 'images', 'e2e-grande');
mkdirSync(imageDir, { recursive: true });
writeFileSync(join(imageDir, 'cripta.png'), png().encode(/** @type {any} */ (drawMap())));
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
 * @param {any} target
 * @param {string} pick
 * @param {string} wanted
 */
async function pickHeroCard(target, pick, wanted) {
    await target.locator(`.hc-root .hc-card[data-pick="${pick}"] .hc-pick`).click();
    await target.waitForSelector('.hc-picker .hc-option', { timeout: 15000 });
    const values = await target.evaluate(() => [...document.querySelectorAll('.hc-picker .hc-option')].map(o => o.getAttribute('data-value') || ''));
    const chosen = values.find(v => v.toLowerCase().includes(wanted.toLowerCase())) ?? values[0];
    await target.locator(`.hc-picker .hc-option[data-value="${chosen}"]`).first().click();
    await target.waitForSelector('.hc-picker', { state: 'detached', timeout: 15000 }).catch(() => {});
    await target.waitForTimeout(200);
}

try {
    await startServer();
    browser = await chromium.launch({ channel: 'msedge', headless: !HEADED });
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
    });
    page = await context.newPage();
    /** @type {string[]} */
    const problems = [];
    page.on('pageerror', e => problems.push(`PAGEERROR ${e.message}`));
    page.on('console', m => {
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

    const BOARD = '#game-shell .gs-scene-map';
    const state = () => page.evaluate(async () => {
        const meta = window.SillyTavern.getContext().chatMetadata ?? {};
        const hero = (await import('/scripts/party.js')).getPartyMembersSnapshot()[0];
        return {
            world: String(meta.world_info ?? ''),
            board: String(meta.currentBoard ?? ''),
            fighting: Boolean(meta.combatEncounter?.active),
            hero: hero ? { id: Number(hero.id), x: Number(hero.mapPosition?.gridX) || 0, y: Number(hero.mapPosition?.gridY) || 0, hp: Number(hero.hp) || 0 } : null,
        };
    });
    const chips = () => page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-chip-action')].map(c => (c.textContent || '').trim()));
    const tapChip = async (/** @type {RegExp} */ pattern) => {
        // La fila que se ve: la de la caja de la novela está escondida fuera de su escena.
        const chip = page.locator('#game-shell .gs-chip-action:visible').filter({ hasText: pattern }).first();
        if (await chip.count() === 0) return false;
        return chip.tap({ timeout: 4000 }).then(() => true).catch((/** @type {any} */ e) => {
            console.log(`        (no se pudo tocar la ficha ${pattern}: ${String(e?.message ?? e).split('\n').slice(0, 14).join(' | ')})`);
            return false;
        });
    };
    const chatLines = (/** @type {RegExp} */ pattern) => page.evaluate((source) => (window.SillyTavern.getContext().chat || [])
        .map((/** @type {any} */ m) => String(m.extra?.display_text || m.mes || ''))
        .filter((/** @type {string} */ t) => new RegExp(source).test(t)), pattern.source);
    const chatHas = async (/** @type {RegExp} */ pattern) => (await chatLines(pattern)).length > 0;
    const until = async (/** @type {() => Promise<boolean>} */ test, ms = 30000) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (await test().catch(() => false)) return true;
            await page.waitForTimeout(400);
        }
        return false;
    };
    const dropToasts = () => page.evaluate(() => document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));
    const toastsNow = () => page.evaluate(() => [...document.querySelectorAll('#toast-container .toast')].map(t => (t.textContent || '').replace(/\s+/g, ' ').trim()));
    const clearDice = async () => {
        for (let i = 0; i < 30; i++) {
            const next = page.locator('.wm-dice-overlay.active .wm-dice-next');
            if (await next.count() === 0) break;
            if (!await next.tap({ timeout: 1500 }).then(() => true).catch(() => false)) break;
            await page.waitForTimeout(250);
        }
    };
    const sceneNow = () => page.evaluate(() => document.querySelector('#game-shell')?.getAttribute('data-scene') || '');
    const carryOn = async (/** @type {string} */ wanted) => {
        await until(async () => {
            if (await sceneNow() === wanted) return true;
            await page.evaluate(() => /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .gs-vn-box .gs-chip-continue'))?.click());
            return false;
        }, 15000);
        return sceneNow();
    };
    const shot = async (/** @type {string} */ name) => {
        if (SHOT) await page.screenshot({ path: `${SHOT}.${name}.png` });
    };
    /** Dónde cae en la pantalla el centro de una casilla, y el recuadro de la vista del tablero. */
    const screenOf = (/** @type {number} */ gx, /** @type {number} */ gy) => page.evaluate(({ sel, gx, gy, cols, rows }) => {
        const content = document.querySelector(`${sel} .wm-content`)?.getBoundingClientRect();
        const view = document.querySelector(`${sel} .wm-container`)?.getBoundingClientRect();
        if (!content || !view) return null;
        return {
            x: content.left + ((gx + 0.5) / cols) * content.width,
            y: content.top + ((gy + 0.5) / rows) * content.height,
            view: { left: view.left, top: view.top, right: view.right, bottom: view.bottom },
            cellPx: content.width / cols,
        };
    }, { sel: BOARD, gx, gy, cols: COLS, rows: ROWS });
    /** Si el centro de la ficha de la maga cae dentro de la vista del tablero. */
    const heroInView = async () => {
        const s = await state();
        if (!s.hero) return false;
        return page.evaluate(({ sel, id }) => {
            const token = document.querySelector(`${sel} .wm-token[data-token-id="${id}"]`)?.getBoundingClientRect();
            const view = document.querySelector(`${sel} .wm-container`)?.getBoundingClientRect();
            if (!token || !view) return false;
            const x = token.left + token.width / 2;
            const y = token.top + token.height / 2;
            return x > view.left && x < view.right && y > view.top && y < view.bottom;
        }, { sel: BOARD, id: s.hero.id });
    };
    /** Arrastrar el dedo por el tablero, con los eventos de puntero de un teléfono. */
    const dragFinger = (/** @type {[number, number]} */ from, /** @type {[number, number]} */ to) => page.evaluate(({ sel, from, to }) => {
        const board = document.querySelector(`${sel} .wm-container`);
        if (!board) return false;
        const fire = (/** @type {string} */ type, /** @type {[number, number]} */ at) => board.dispatchEvent(new PointerEvent(type, {
            pointerId: 61, pointerType: 'touch', isPrimary: true, clientX: at[0], clientY: at[1], bubbles: true, cancelable: true,
        }));
        fire('pointerdown', from);
        for (let i = 1; i <= 6; i++) fire('pointermove', [from[0] + ((to[0] - from[0]) * i) / 6, from[1] + ((to[1] - from[1]) * i) / 6]);
        fire('pointerup', to);
        return true;
    }, { sel: BOARD, from, to });
    /** J20.2: si una casilla cae fuera de la vista, se arrastra el tablero con el dedo hasta tenerla en medio. */
    const bringIntoView = async (/** @type {number} */ gx, /** @type {number} */ gy) => {
        const at = await screenOf(gx, gy);
        if (!at) return;
        const margin = at.cellPx;
        if (at.x > at.view.left + margin && at.x < at.view.right - margin && at.y > at.view.top + margin && at.y < at.view.bottom - margin) return;
        const cx = (at.view.left + at.view.right) / 2;
        const cy = (at.view.top + at.view.bottom) / 2;
        await dragFinger([cx, cy], [cx - (at.x - cx), cy - (at.y - cy)]);
        await page.waitForTimeout(500);
    };
    const tapCell = async (/** @type {number} */ gx, /** @type {number} */ gy) => {
        await bringIntoView(gx, gy);
        const at = await screenOf(gx, gy);
        if (!at) return false;
        await page.touchscreen.tap(at.x, at.y);
        await page.waitForTimeout(350);
        return true;
    };
    const lit = (/** @type {number} */ x, /** @type {number} */ y) => page.locator(`${BOARD} .wm-highlight-move.wm-highlight-clickable[data-x="${x}"][data-y="${y}"]`).count();
    /** Tocar la ficha de la maga, para elegirla (si ya está elegida, no: tocarla la soltaría). */
    const tapHero = async () => {
        const s = await state();
        const token = page.locator(`${BOARD} .wm-token[data-token-id="${s.hero?.id}"]`).first();
        if (await token.evaluate((/** @type {HTMLElement} */ el) => el.classList.contains('wm-token-selected')).catch(() => false)) return;
        await bringIntoView(s.hero?.x ?? 0, s.hero?.y ?? 0);
        const box = await token.boundingBox().catch(() => null);
        if (box) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
        await until(async () => (await page.locator(`${BOARD} .wm-highlight-move.wm-highlight-clickable`).count()) > 0, 5000);
    };
    /** A toques: elegir a la maga, tocar la casilla (enseña el camino) y tocarla otra vez (anda). */
    const walkTo = async (/** @type {number} */ gx, /** @type {number} */ gy) => {
        await tapHero();
        const from = (await state()).hero;
        await tapCell(gx, gy);
        const armed = String(await page.locator(`${BOARD} .wm-path-cost.wm-path-armed`).first().textContent({ timeout: 2000 }).catch(() => ''));
        const moved = (await state()).hero;
        if (!armed) console.log(`        (el primer toque en (${gx}, ${gy}) no enseñó la ruta: de ${JSON.stringify(from)} a ${JSON.stringify(moved)})`);
        const at = await screenOf(gx, gy);
        if (at) await page.touchscreen.tap(at.x, at.y);
        await page.waitForTimeout(900);
        await clearDice();
        return armed;
    };
    /**
     * Cómo se ve una casilla con la niebla: `unknown`, `explored` o `visible`. J20.6: la niebla va
     * en rectángulos (una sala sin ver es una caja): se mira cuál cubre la casilla, con el tamaño
     * de una casilla sacado de la capa (su ancho entre las columnas).
     */
    const fogAt = (/** @type {number} */ gx, /** @type {number} */ gy) => page.evaluate(({ sel, gx, gy, cols, rows }) => {
        const layer = document.querySelector(`${sel} .wm-fog-layer`);
        if (!(layer instanceof HTMLElement)) return 'visible';
        const cw = (parseFloat(layer.style.width) || 1) / cols;
        const ch = (parseFloat(layer.style.height) || 1) / rows;
        for (const el of layer.querySelectorAll('.wm-fog-cell')) {
            if (!(el instanceof HTMLElement)) continue;
            const x0 = Math.round(parseFloat(el.style.left) / cw);
            const y0 = Math.round(parseFloat(el.style.top) / ch);
            const x1 = x0 + Math.round(parseFloat(el.style.width) / cw);
            const y1 = y0 + Math.round(parseFloat(el.style.height) / ch);
            if (gx >= x0 && gx < x1 && gy >= y0 && gy < y1) {
                return el.classList.contains('wm-fog-unknown') ? 'unknown' : 'explored';
            }
        }
        return 'visible';
    }, { sel: BOARD, gx, gy, cols: COLS, rows: ROWS });
    const hazardAt = (/** @type {number} */ gx, /** @type {number} */ gy) => page.evaluate(({ sel, gx, gy }) => [...document.querySelectorAll(`${sel} .wm-hazard`)].some(el => {
        if (!(el instanceof HTMLElement)) return false;
        const w = parseFloat(el.style.width) || 1;
        return Math.round(parseFloat(el.style.left) / w) === gx && Math.round(parseFloat(el.style.top) / (parseFloat(el.style.height) || 1)) === gy;
    }), { sel: BOARD, gx, gy });
    /** El dado, fijado para la prueba: lo que se mira es lo que pasa con la tirada, no la suerte. */
    const fixDie = (/** @type {number|null} */ value) => page.evaluate(async (v) => {
        const { setRandomSource } = await import('/scripts/party/combat-rules.js');
        setRandomSource(v === null ? null : () => v);
    }, value);
    const header = () => page.evaluate((sel) => ({
        name: (document.querySelector(`${sel} .wm-location-header-name`)?.textContent || '').trim(),
        desc: (document.querySelector(`${sel} .wm-location-header-desc`)?.textContent || '').trim(),
    }), BOARD);

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    const firstRun = page.locator('text=Welcome to SillyTavern!');
    if (await firstRun.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.locator('.popup-button-ok').tap();
    }
    await page.waitForSelector('#game-shell', { timeout: 90000 });

    // 1. Al gremio: una maga, y la prueba saltada.
    const offline = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Jugar sin conexión' });
    await until(async () => await offline.count() === 1, 30000);
    await offline.tap();
    await page.waitForSelector('.hc-root', { timeout: 120000 });
    await page.fill('.hc-root .hc-name', HERO);
    await pickHeroCard(page, 'race', 'Humano');
    await pickHeroCard(page, 'class', 'Mago');
    await page.locator('.hc-root .hc-enter').tap();
    await until(async () => Boolean((await state()).hero), 60000);
    await until(() => chatHas(/Baja a la bodega/), 20000);
    // Tanda 10: en el tablero del muelle no sale «Saltar la prueba»; primero se sale de él.
    await until(async () => (await chips()).some(c => /^(Saltar la prueba|Salir del tablero)$/.test(c)), 15000);
    if ((await chips()).includes('Salir del tablero')) await tapChip(/^Salir del tablero$/);
    await until(async () => (await chips()).some(c => /^Saltar la prueba$/.test(c)), 15000);
    await tapChip(/^Saltar la prueba$/);
    await page.waitForSelector('.popup:has-text("¿Saltar la prueba?")', { timeout: 10000 }).catch(() => {});
    await page.locator('.popup-button-ok:visible').first().tap({ timeout: 5000 }).catch(() => {});
    await until(() => chatHas(/apunta tu nombre en el libro del gremio/), 15000);

    // 2. La campaña de la cripta, desde un archivo, y empezarla.
    await dropToasts();
    await until(async () => (await chips()).some(c => /Tablón de campañas/.test(c)), 15000);
    await tapChip(/Tablón de campañas/);
    await page.waitForSelector('.hb-root [data-campaign-add]', { timeout: 15000 });
    const [chooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 10000 }),
        page.locator('.hb-root [data-campaign-add]').tap(),
    ]);
    await chooser.setFiles({ name: 'cripta.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(pack), 'utf8') });
    const added = await page.waitForSelector(`.hb-root [data-campaign="${ID}"]`, { timeout: 20000 }).then(() => true).catch(() => false);
    check('la campaña con el mapa grande, sus salas, sus cotas y sus trampas se añade al tablón', added);
    await page.locator(`.hb-root [data-campaign="${ID}"]`).tap();
    const started = await until(async () => (await state()).world.includes(NAME), 120000);
    await page.waitForTimeout(1500);
    await clearDice();
    await dropToasts();
    const onBoard = await until(async () => (await state()).board === 'La cripta', 20000);
    const scene = await carryOn('combat');
    await page.waitForSelector(`${BOARD} .wm-terrain-layer`, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    check('empezarla deja a la maga en la cripta, en su escena de tablero', started && onBoard && scene === 'combat', JSON.stringify({ scene, state: await state() }));

    // 3. J12.8 y J12.13: sobre el dibujo limpio, por partes y con niebla.
    const look = await page.evaluate(({ sel, cols, rows }) => {
        const content = document.querySelector(`${sel} .wm-content`)?.getBoundingClientRect();
        const view = document.querySelector(`${sel} .wm-container`)?.getBoundingClientRect();
        return {
            image: (document.querySelector(`${sel} .wm-content > img`)?.getAttribute('src') || ''),
            overImage: Boolean(document.querySelector(`${sel} .wm-terrain-layer.wm-terrain-over-image`)),
            cellPx: content ? Math.round((content.width / cols) * 10) / 10 : 0,
            wider: Boolean(content && view && content.width > view.width + 10),
            // Las casillas sin ver, no las cajas: J20.6 junta las iguales en rectángulos.
            unknown: (() => {
                const layer = document.querySelector(`${sel} .wm-fog-layer`);
                const cw = (parseFloat(layer instanceof HTMLElement ? layer.style.width : '') || 1) / cols;
                const ch = (parseFloat(layer instanceof HTMLElement ? layer.style.height : '') || 1) / rows;
                return [...document.querySelectorAll(`${sel} .wm-fog-cell.wm-fog-unknown`)]
                    .reduce((sum, el) => sum + Math.round(parseFloat(/** @type {HTMLElement} */ (el).style.width) / cw) * Math.round(parseFloat(/** @type {HTMLElement} */ (el).style.height) / ch), 0);
            })(),
            boxes: document.querySelectorAll(`${sel} .wm-fog-cell`).length,
        };
    }, { sel: BOARD, cols: COLS, rows: ROWS });
    check('el tablero es el dibujo, con el terreno marcado encima sin taparlo (J12.8)', /e2e-grande\/cripta\.png$/.test(look.image) && look.overImage, JSON.stringify(look));
    check('un tablero de 40 × 28 se ve por partes, con casillas que se leen (28 px o más) (J12.13)', look.wider && look.cellPx >= 27.5, JSON.stringify(look));
    check('con niebla: lo que aún no se ha visto está tapado, como la sala del fondo (J12.13)', look.unknown > 100 && await fogAt(36, 14) === 'unknown', JSON.stringify({ unknown: look.unknown, far: await fogAt(36, 14) }));
    const startHead = await header();
    check('la cabecera dice la sala en la que se empieza y su nota (J12.11)', /La cripta · C · La entrada/.test(startHead.name) && /Escalones gastados/.test(startHead.desc), JSON.stringify(startHead));
    check('la cámara empieza en la maga (J12.13)', await heroInView());
    await shot('1-entrada');

    // 4. J12.3: la losa sin ver salta al pisarla, y la maga se queda en ella.
    const before = /** @type {any} */ ((await state()).hero);
    await dropToasts();
    const armedCost = await walkTo(12, 14);
    const afterTrap = /** @type {any} */ ((await state()).hero);
    const trapToasts = await toastsNow();
    check('a toques, tocar una casilla enseña el camino y lo que cuesta; tocarla otra vez anda (J20.2)', /\d+ pies · toca otra vez para ir/.test(armedCost), armedCost);
    check('la losa sin ver salta al pisarla: la maga se queda en ella, con daño, y se dice (J12.3)',
        afterTrap.x === 9 && afterTrap.y === 14 && afterTrap.hp < before.hp && await chatHas(/Losa hundida salta bajo Nadia/)
        && trapToasts.some(t => /¡Una trampa!/.test(t)), JSON.stringify({ before, afterTrap, trapToasts }));
    check('y ya se ve en el tablero (J12.3)', await hazardAt(9, 14));
    // Tanda 9, arte de lo nuevo: dentro del recuadro, su dibujo en pixel (el cepo de `tablero/trampa.png`).
    const trapArt = await page.evaluate((sel) => [...document.querySelectorAll(`${sel} .wm-hazard.wm-hazard-drawn`)]
        .map(el => (el instanceof HTMLElement ? el.style.backgroundImage : '')), BOARD);
    check('la trampa vista lleva su dibujo en pixel, no solo el recuadro (tablero/trampa.png)', trapArt.some(b => /tablero\/trampa\.png/.test(b)), JSON.stringify(trapArt));
    check('la cámara sigue a la maga (J12.13)', await heroInView());
    await shot('2-losa');

    // 5. J12.10: al risco no se sube andando; tocarlo dice su altura y su borde.
    await dropToasts();
    await tapHero();
    const ledge = { up: await lit(17, 11) + await lit(16, 10), floor: await lit(17, 13) };
    check('al risco de 20 pies no se sube andando; al suelo de la sala, sí (J12.10)', ledge.up === 0 && ledge.floor === 1, JSON.stringify(ledge));
    await tapCell(17, 10);
    const told = await page.evaluate((sel) => (document.querySelector(`${sel} .wm-cell-info`)?.textContent || '').trim(), BOARD);
    check('tocar el risco dice su sala, su altura y que es un acantilado, sin ratón (J12.10, J12.11, J20.2)',
        /La sala del risco/.test(told) && /\+20 pies de alto/.test(told) && /acantilado/.test(told), told);

    // 6. Por la sala del risco hasta el segundo pasillo, a dos casillas de los dardos.
    await dropToasts();
    await walkTo(24, 14);
    const mid = /** @type {any} */ ((await state()).hero);
    check('se cruza la sala del risco hasta el pasillo del este (J12.13)', mid.x === 24 && mid.y === 14, JSON.stringify(mid));
    check('la cámara sigue a la maga (J12.13)', await heroInView());
    check('la entrada queda atrás, vista pero ya no a la vista (niebla recordada) (J12.13)', await fogAt(3, 14) === 'explored', await fogAt(3, 14));

    // 7. J12.3: «Buscar trampas» encuentra los dardos, que cierran el pasillo.
    await dropToasts();
    await fixDie(0.99);
    const searchChip = (await chips()).some(c => /^Buscar trampas$/.test(c));
    await tapChip(/^Buscar trampas$/);
    await page.waitForTimeout(800);
    await fixDie(null);
    const found = { chip: searchChip, said: await chatHas(/busca trampas alrededor .*Encuentra dardos en la pared/), drawn: await hazardAt(26, 14), toasts: await toastsNow() };
    check('«Buscar trampas» encuentra los dardos a dos casillas, y se dibujan (J12.3)', found.chip && found.said && found.drawn, JSON.stringify(found));
    await dropToasts();
    await tapHero();
    const closed = { beyond: await lit(28, 14), trap: await lit(26, 14), beside: await lit(25, 14) };
    check('una trampa vista no se pisa: el pasillo queda cerrado hasta desarmarla (J12.3)', closed.beyond === 0 && closed.trap === 0 && closed.beside === 1, JSON.stringify(closed));
    await shot('3-dardos');

    // 8. J12.3: al lado, «Desarmar: dardos en la pared».
    await walkTo(25, 14);
    await dropToasts();
    const disarmChip = (await chips()).find(c => /^Desarmar: dardos en la pared$/.test(c)) ?? '';
    await fixDie(0.99);
    await tapChip(/^Desarmar: dardos en la pared$/);
    await page.waitForTimeout(800);
    await fixDie(null);
    const disarmed = { chip: disarmChip, said: await chatHas(/Dardos en la pared queda desarmada/), drawn: await hazardAt(26, 14) };
    check('al lado de los dardos, «Desarmar» los quita, y dejan de verse como peligro (J12.3)', Boolean(disarmChip) && disarmed.said && !disarmed.drawn, JSON.stringify(disarmed));
    await dropToasts();
    await tapHero();
    check('y el pasillo se abre (J12.3)', await lit(28, 14) === 1);

    // 9. J12.11: hasta B1, la sala del fondo: su nombre y su nota.
    await dropToasts();
    await walkTo(33, 14);
    const end = /** @type {any} */ ((await state()).hero);
    const b1Toasts = await toastsNow();
    const endHead = await header();
    check('la maga cruza la cripta de punta a punta: de la entrada a B1 (J12.13)', end.x === 33 && end.y === 14, JSON.stringify(end));
    check('al entrar en B1, su nota: en el aviso, en el registro y en la cabecera del tablero (J12.11)',
        b1Toasts.some(t => t.includes('Una bóveda alta')) && await chatHas(/Nadia entra en B1 · La sala del eco\. Una bóveda alta/)
        && /B1 · La sala del eco/.test(endHead.name) && endHead.desc === B1_NOTE, JSON.stringify({ b1Toasts, endHead }));
    check('la cámara sigue a la maga hasta el final (J12.13)', await heroInView());
    check('lo del fondo ya se ve, y la entrada sigue recordada (J12.13)', await fogAt(36, 14) === 'visible' && await fogAt(3, 14) === 'explored');
    const boss = await page.evaluate((sel) => {
        const token = document.querySelector(`${sel} .wm-token.wm-token-enemy.wm-token-idle.wm-token-boss`);
        return {
            token: Boolean(token),
            crown: Boolean(token?.querySelector('.wm-token-boss-mark')),
            meta: (token?.querySelector('.wm-token-tooltip-meta')?.textContent || '').trim(),
            art: token?.querySelector('img.wm-token-avatar[data-pixel]')?.getAttribute('src') || '',
            skull: Boolean(token?.querySelector('.wm-token-unknown')),
        };
    }, BOARD);
    check('el jefe que espera en B1 se ve, con su corona (arte del tablero)', boss.token && boss.crown && /^Jefe · /.test(boss.meta), JSON.stringify(boss));
    // Tanda 9, arte de lo nuevo: un jefe propio de la campaña, sin dibujo ni arquetipo, sale de sombra, no de calavera.
    check('el jefe sin dibujo propio lleva la sombra encapuchada (bestias/enemigo-sin-dibujo.png), no la calavera',
        /bestias\/enemigo-sin-dibujo\.png$/.test(boss.art) && !boss.skull, JSON.stringify(boss));
    await shot('4-b1');

    const serious = problems.filter(p => !/favicon|ResizeObserver loop/.test(p));
    check('sin errores en la página', serious.length === 0, serious.slice(0, 6).join('\n        '));
} catch (error) {
    failures++;
    console.log(`FAIL  el recorrido se ha parado: ${error instanceof Error ? error.stack : error}`);
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
