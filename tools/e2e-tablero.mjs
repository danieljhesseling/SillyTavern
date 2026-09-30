#!/usr/bin/env node
/**
 * El tablero en juego (J12.9 a J12.11, J19.5 y J19.6 de ROADMAP_SIN_CONEXION), en el navegador,
 * contra un servidor propio con un `--dataRoot` temporal, como `e2e-importar-campana.mjs`:
 *
 *   título → Jugar sin conexión → una maga → saltar la prueba → el tablón → «Añadir una
 *   campaña» con el paquete de ejemplo, al que aquí se le ponen dos salas con nombre y nota y un
 *   altillo de 10 pies (lo que puede escribir el Gem, o el editor de mapas) → empezarla → en la
 *   planta baja del molino:
 *
 *   - el altillo se dibuja, con sus acantilados, y la casilla dice su altura y su sala (J12.10, J12.11);
 *   - pulsar tu ficha enciende hasta dónde anda, y el altillo no, que no tiene escalera (J12.10);
 *   - entrar andando en «La sala de la muela» lee su nota, una sola vez (J12.11);
 *   - desde el altillo se ataca desde arriba (J12.10);
 *   - abrir la puerta del granero dice a qué sala da, y despierta al cuervo (J12.11);
 *   - en la pelea, la Nube de niebla que lanza la maga desde la tarjeta del cuervo se dibuja, y
 *     la tarjeta dice que no se ve (J19.6); una telaraña en medio cuesta el doble al cruzarla y
 *     salta al entrar (J19.6); y una invocación sale en el tablero y en la iniciativa (J19.5).
 *
 * Uso:
 *   node tools/e2e-tablero.mjs                       # puerto 8161, sin ventana
 *   node tools/e2e-tablero.mjs --headed
 *   node tools/e2e-tablero.mjs --port 8162 --captura tablero.png   # y una captura por paso
 */

/* global window, document, HTMLElement */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Buffer } from 'node:buffer';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8161;
const BASE = `http://127.0.0.1:${PORT}`;
const HEADED = process.argv.includes('--headed');
const SHOT = argAfter('--captura');

const require = createRequire(join(ROOT, 'tests/package.json'));
const { chromium } = require('@playwright/test');

// La campaña de la prueba: el paquete de ejemplo del contrato, con otro nombre, y en su primer
// tablero (la planta baja del molino, 14 × 9) dos salas con nombre y un altillo sin escalera:
//
//   ##############
//   #....#.......#   ← «El granero» (x 6-12, y 1-3), tras la puerta de (10,4); el cuervo, en (9,2)
//   #.c..D...~~..#
//   #....#...~~..#
//   #....#####D###
//   #....^^......#   ← ^ el altillo, a 10 pies: (5,5) y (6,5)
//   #..C......c..#   ← «La sala de la muela» (x 7-11, y 5-7)
//   #............#   ← el grupo empieza en (2,7) y (3,7)
//   ##############
const { buildExamplePack } = await import(pathToFileURL(join(ROOT, 'public/scripts/game-engine/campaign/campaign-pack-schema.js')).href);
const NAME = 'El Molino de las alturas';
const ID = 'tuya-el-molino-de-las-alturas';
const HERO = 'Nadia';
const pack = (() => {
    const made = buildExamplePack();
    made.world.name = NAME;
    const floor = made.boards[0];
    floor.zones = [
        { name: 'La sala de la muela', rect: { x: 7, y: 5, width: 5, height: 3 }, note: 'La muela del molino, parada. Huele a harina mojada.' },
        { name: 'El granero', rect: { x: 6, y: 1, width: 7, height: 3 }, note: 'Sacos reventados y plumas negras por el suelo.' },
    ];
    floor.elevation = { '5,5': 10, '6,5': 10 };
    return made;
})();
const FLOOR = String(pack.boards[0].name);

let failures = 0;
const check = (/** @type {string} */ name, /** @type {boolean} */ ok, detail = '') => {
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        -> ${detail}` : ''}`);
};

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-tablero-'));
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
    const values = await target.evaluate(() => [...document.querySelectorAll('.hc-picker .hc-option')].map(o => o.getAttribute('data-value') || ''));
    const chosen = values.find(v => v.toLowerCase().includes(wanted.toLowerCase())) ?? values[0];
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
            // Los consejos, vistos: aquí se mira el tablero, no enseñar a jugar.
            window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,combat,travel,prisoners,mesa,high,spell,pet,bill,move,attack,roll,talk,journal');
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
            window.localStorage.setItem('sillytavern_gameSucesos', 'off');
            // Las escenas del hilo y las charlas escritas (J9.2, J8) las mira e2e-historia; aquí taparían clics.
            window.localStorage.setItem('sillytavern_gameStoryWindows', 'off');
        } catch { /* nada */ }
    });

    const state = () => page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const party = (await import('/scripts/party.js')).getPartyMembersSnapshot();
        const meta = ctx.chatMetadata ?? {};
        return {
            world: String(meta.world_info ?? ''),
            board: String(meta.currentBoard ?? ''),
            party: party.map((/** @type {any} */ m) => ({ name: m.name, x: Number(m.mapPosition?.gridX) || 0, y: Number(m.mapPosition?.gridY) || 0 })),
            fighting: Boolean(meta.combatEncounter?.active),
        };
    });
    const chips = () => page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-chip-action')].map(c => (c.textContent || '').trim()));
    const clickChip = (/** @type {RegExp} */ pattern) => page.evaluate((source) => {
        const chip = [...document.querySelectorAll('#game-shell .gs-chip-action')].find(b => new RegExp(source).test(b.textContent || ''));
        if (chip instanceof HTMLElement) chip.click();
        return Boolean(chip);
    }, pattern.source);
    /** Las líneas del chat que casan, como se leen. */
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
        for (let i = 0; i < 40; i++) {
            const next = page.locator('.wm-dice-overlay.active .wm-dice-next');
            if (await next.count() === 0) break;
            if (!await next.click({ timeout: 1500 }).then(() => true).catch(() => false)) break;
            await page.waitForTimeout(250);
        }
    };
    const sceneNow = () => page.evaluate(() => document.querySelector('#game-shell')?.getAttribute('data-scene') || '');
    /** J18.8: «Continuar», al acabar de leer, hasta la escena que toca. */
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
    /** El tablero de la escena: donde está cada casilla en la pantalla. */
    const BOARD = '#game-shell .gs-scene-map';
    /** El centro en pantalla de la casilla (x, y), sabiendo el tamaño del tablero: el dibujo lo ocupa entero. */
    const centerOf = async (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ cols, /** @type {number} */ rows) => {
        const box = await page.evaluate((sel) => {
            const r = document.querySelector(`${sel} .wm-content`)?.getBoundingClientRect();
            return r ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
        }, BOARD);
        if (!box) return null;
        return { x: box.left + ((x + 0.5) / cols) * box.width, y: box.top + ((y + 0.5) / rows) * box.height };
    };
    /** Lo que dice la casilla bajo el ratón (idea 164), pasando por encima. */
    const hoverInfo = async (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ cols, /** @type {number} */ rows) => {
        const at = await centerOf(x, y, cols, rows);
        if (!at) return '';
        await page.mouse.move(at.x, at.y);
        await page.waitForTimeout(150);
        return page.evaluate((sel) => (document.querySelector(`${sel} .wm-cell-info`)?.textContent || '').trim(), BOARD);
    };
    const lit = (/** @type {number} */ x, /** @type {number} */ y) => page.locator(`${BOARD} .wm-highlight-move.wm-highlight-clickable[data-x="${x}"][data-y="${y}"]`).count();
    const heroId = () => page.evaluate(async () => Number((await import('/scripts/party.js')).getPartyMembersSnapshot()[0]?.id));
    /** Elegir al héroe pulsando su ficha con el ratón (si ya está elegido, pulsarla lo soltaría). */
    const clickHero = async () => {
        const token = page.locator(`${BOARD} .wm-token[data-token-id="${await heroId()}"]`).first();
        if (await token.evaluate(el => el.classList.contains('wm-token-selected')).catch(() => false)) return;
        await token.click({ timeout: 5000 });
        await page.waitForTimeout(300);
    };

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    const firstRun = page.locator('text=Welcome to SillyTavern!');
    if (await firstRun.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#game-shell', { timeout: 90000 });

    // 1. Al gremio: una maga, y la prueba saltada.
    const offline = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Jugar sin conexión' });
    await until(async () => await offline.count() === 1, 30000);
    await offline.click();
    await page.waitForSelector('.hc-root', { timeout: 120000 });
    await page.fill('.hc-root .hc-name', HERO);
    await pickHeroCard(page, 'race', 'Humano');
    await pickHeroCard(page, 'class', 'Mago');
    await page.locator('.hc-root .hc-enter').click();
    await until(async () => (await state()).party.length === 1, 60000);
    await until(() => chatHas(/Baja a la bodega/), 20000);
    await until(async () => (await chips()).some(c => /^Saltar la prueba$/.test(c)), 15000);
    await clickChip(/^Saltar la prueba$/);
    await page.waitForSelector('.popup:has-text("¿Saltar la prueba?")', { timeout: 10000 }).catch(() => {});
    await page.locator('.popup-button-ok:visible').first().click({ timeout: 5000 }).catch(() => {});
    await until(() => chatHas(/apunta tu nombre en el libro del gremio/), 15000);

    // 2. La campaña, desde un archivo, y empezarla.
    await dropToasts();
    await until(async () => (await chips()).some(c => /Tablón de campañas/.test(c)), 15000);
    await clickChip(/Tablón de campañas/);
    await page.waitForSelector('.hb-root [data-campaign-add]', { timeout: 15000 });
    const [chooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 10000 }),
        page.locator('.hb-root [data-campaign-add]').click(),
    ]);
    await chooser.setFiles({ name: 'molino.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(pack), 'utf8') });
    const added = await page.waitForSelector(`.hb-root [data-campaign="${ID}"]`, { timeout: 20000 }).then(() => true).catch(() => false);
    check('la campaña con salas y alturas se añade al tablón', added);
    await page.locator(`.hb-root [data-campaign="${ID}"]`).click();
    const started = await until(async () => (await state()).world.includes(NAME), 120000);
    await page.waitForTimeout(1500);
    await clearDice();
    await dropToasts();
    const onFloor = await until(async () => (await state()).board === FLOOR, 20000);
    check(`empezarla deja al grupo en «${FLOOR}»`, started && onFloor, JSON.stringify(await state()));
    const scene = await carryOn('combat');
    await page.waitForSelector(`${BOARD} .wm-terrain-layer`, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(800);
    const size = await page.evaluate(async () => {
        const { getActiveBoardContext } = await import('/scripts/party/board.js');
        const { gridWidth, gridHeight, board } = getActiveBoardContext();
        return { cols: gridWidth, rows: gridHeight, zones: (board?.zones ?? []).map((/** @type {any} */ z) => z.name), rooms: (board?.rooms ?? []).map((/** @type {any} */ r) => r.name ?? '') };
    });
    check('el tablero llega con sus salas con nombre (J12.11)', scene === 'combat' && size.zones.includes('La sala de la muela') && size.rooms.includes('El granero'), JSON.stringify({ scene, size }));

    // 3. J12.10: el altillo se dibuja, con sus acantilados; y la casilla dice su altura y su sala.
    const drawn = await page.evaluate((sel) => ({
        high: document.querySelectorAll(`${sel} .wm-elevated`).length,
        cliffs: document.querySelectorAll(`${sel} .wm-cliff`).length,
        tip: document.querySelector(`${sel} .wm-cliff`)?.getAttribute('title') || '',
    }), BOARD);
    check('el altillo se dibuja: sus dos casillas, más claras, y los acantilados de sus bordes (J12.10)',
        drawn.high === 2 && drawn.cliffs >= 4 && /Acantilado: 10 pies/.test(drawn.tip), JSON.stringify(drawn));
    const highInfo = await hoverInfo(5, 5, size.cols, size.rows);
    const roomInfo = await hoverInfo(9, 6, size.cols, size.rows);
    check('al pasar por encima, la casilla dice su altura y su sala (J12.10, J12.11)',
        /\+10 pies de alto/.test(highInfo) && /La sala de la muela/.test(roomInfo), JSON.stringify({ highInfo, roomInfo }));
    await shot('1-altillo');

    // 4. J12.10: pulsar tu ficha enciende hasta dónde anda; el altillo no, que no tiene escalera.
    await dropToasts();
    await clickHero();
    const walkable = { beside: await lit(4, 5), up: await lit(5, 5) + await lit(6, 5), any: await page.locator(`${BOARD} .wm-highlight-move`).count() };
    const hud = String(await page.locator(`${BOARD} .wm-tactical-hud`).first().textContent({ timeout: 2000 }).catch(() => ''));
    check('pulsar tu ficha enciende hasta dónde anda y lo dice encima; al altillo no se sube andando (J12.10)',
        walkable.any > 0 && walkable.beside === 1 && walkable.up === 0 && /Pulsa una casilla encendida para ir/.test(hud), JSON.stringify({ walkable, hud }));
    // Desde lo alto se ataca con ventaja: el tablero con sus cotas llega a quien cuenta el ataque.
    const heights = await page.evaluate(async () => {
        const { heightFor } = await import('/scripts/party/combat-state.js');
        return { down: heightFor({ x: 5, y: 5 }, { x: 4, y: 6 }), up: heightFor({ x: 4, y: 6 }, { x: 5, y: 5 }), flat: heightFor({ x: 2, y: 7 }, { x: 3, y: 7 }) };
    });
    check('desde el altillo se ataca desde arriba, y al revés desde abajo (J12.10)',
        heights.down === 'above' && heights.up === 'below' && heights.flat === 'level', JSON.stringify(heights));

    // 5. J12.11: entrar andando en «La sala de la muela» lee su nota, una sola vez.
    await dropToasts();
    const into = await page.locator(`${BOARD} .wm-highlight-move.wm-highlight-clickable[data-x="8"][data-y="7"]`).count() > 0
        ? { x: 8, y: 7 } : { x: 7, y: 7 };
    await page.locator(`${BOARD} .wm-highlight-move.wm-highlight-clickable[data-x="${into.x}"][data-y="${into.y}"]`).first().click({ timeout: 5000 }).catch(() => {});
    const noteRe = new RegExp(`${HERO} entra en La sala de la muela\\. La muela del molino, parada`);
    const noted = await until(() => chatHas(noteRe), 8000);
    const toastSaid = await toastsNow();
    const where = (await state()).party[0];
    check('al entrar andando en «La sala de la muela», su nota: en el registro y en un aviso (J12.11)',
        noted && where.x === into.x && where.y === into.y && toastSaid.some(t => /La muela del molino/.test(t)), JSON.stringify({ where, toastSaid }));
    await shot('2-sala');
    // Salir y volver a entrar: ya no se repite.
    await dropToasts();
    await clickHero();
    await page.locator(`${BOARD} .wm-highlight-move.wm-highlight-clickable[data-x="4"][data-y="7"]`).first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(600);
    await clickHero();
    await page.locator(`${BOARD} .wm-highlight-move.wm-highlight-clickable[data-x="${into.x}"][data-y="${into.y}"]`).first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(800);
    const again = (await chatLines(noteRe)).length;
    check('la nota de una sala se lee la primera vez, no cada vez que se entra (J12.11)', again === 1, `${again} veces`);

    // 6. J12.11: abrir la puerta del granero dice a qué sala da.
    await dropToasts();
    const door = await page.evaluate(({ sel, cols }) => {
        const layer = document.querySelector(`${sel} .wm-terrain-layer`);
        const width = layer instanceof HTMLElement ? layer.getBoundingClientRect().width : 0;
        for (const el of document.querySelectorAll(`${sel} .wm-terrain-door-actionable`)) {
            if (!(el instanceof HTMLElement)) continue;
            const cell = parseFloat(el.style.width) || 1;
            const gx = Math.round(parseFloat(el.style.left) / cell);
            const gy = Math.round(parseFloat(el.style.top) / (parseFloat(el.style.height) || 1));
            if (gx === 10 && gy === 4) {
                const r = el.getBoundingClientRect();
                return { x: r.left + r.width / 2, y: r.top + r.height / 2, width, cols };
            }
        }
        return null;
    }, { sel: BOARD, cols: size.cols });
    if (door) await page.mouse.click(door.x, door.y);
    const opened = await until(() => chatHas(/La puerta de \(11, 5\) queda abierta: da a El granero/), 8000);
    check('abrir la puerta del granero dice a qué sala da: «da a El granero» (J12.11)', Boolean(door) && opened, JSON.stringify({ door, lines: await chatLines(/La puerta de/) }));
    await clearDice();
    await shot('3-puerta');

    // 7. La pelea con el cuervo: si la puerta no la empieza, se empieza desde la fila.
    if (!(await state()).fighting) {
        await until(async () => (await chips()).some(c => /^Iniciar combate/.test(c)), 8000);
        await clickChip(/^Iniciar combate/);
    }
    const fighting = await until(async () => (await state()).fighting, 15000);
    check('el cuervo del granero pelea', fighting, JSON.stringify(await chips()));
    const myTurn = async () => {
        await clearDice();
        return page.evaluate(async () => {
            const enc = (await import('/scripts/party.js')).getCombatEncounter();
            const entry = enc?.active ? enc.turnOrder?.[enc.currentTurnIndex] : null;
            return Boolean(entry && !entry.isEnemy);
        });
    };
    await until(myTurn, 30000);
    await dropToasts();

    // 8. J19.6: una Nube de niebla sobre el cuervo. Se pone con las mismas piezas con las que la
    // pone el conjuro (`zoneFromSpell` y `placeZone`, como `castSpellExtras` de `magic.js`):
    // lanzarla desde el grimorio o la tarjeta es de las pruebas de la magia (J19.3).
    const fogAt = await page.evaluate(async () => {
        const { getCombatEncounter, getPartyMembersSnapshot } = await import('/scripts/party.js');
        const { zoneFromSpell, placeZone } = await import('/scripts/game-engine/board/spell-zones.js');
        const { normalizeSpell } = await import('/scripts/game-engine/rules/spell-catalogue.js');
        const rows = (await (await fetch('/compendio/conjuros.json')).json()).rows;
        const spell = normalizeSpell(rows.find((/** @type {any} */ r) => r.id === 'conj-nube-niebla'));
        const enc = getCombatEncounter();
        const crow = enc.enemies[0];
        const cx = Number(crow.gridX) || 0;
        const cy = Number(crow.gridY) || 0;
        const cells = [];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) cells.push({ x: cx + dx, y: cy + dy });
        const zone = zoneFromSpell({ spell, cells, center: { x: cx, y: cy }, casterId: String(getPartyMembersSnapshot()[0].id), round: Number(enc.round) || 1 });
        enc.spellZones = placeZone(enc.spellZones ?? [], zone).zones;
        const { renderLocationMapsPreview } = await import('/scripts/party/board-view.js');
        renderLocationMapsPreview();
        return { x: cx, y: cy };
    });
    const fog = await until(() => page.evaluate((sel) => document.querySelectorAll(`${sel} .wm-spell-zone[data-kind="niebla"]`).length > 0, BOARD), 8000);
    const fogDrawn = await page.evaluate((sel) => ({
        cells: document.querySelectorAll(`${sel} .wm-spell-zone[data-kind="niebla"]`).length,
        icons: document.querySelectorAll(`${sel} .wm-spell-zone[data-kind="niebla"] .wm-spell-zone-icon`).length,
        tip: document.querySelector(`${sel} .wm-spell-zone[data-kind="niebla"]`)?.getAttribute('title') || '',
    }), BOARD);
    const fogInfo = await hoverInfo(fogAt.x, fogAt.y, size.cols, size.rows);
    check('una Nube de niebla en la pelea se dibuja en el tablero, con su icono una vez, y la casilla dice lo que hace (J19.6)',
        fog && fogDrawn.cells === 9 && fogDrawn.icons === 1 && /Nube de niebla: Una niebla espesa/.test(fogDrawn.tip) && /Nube de niebla: Una niebla espesa/.test(fogInfo),
        JSON.stringify({ fogDrawn, fogInfo }));
    await shot('4-niebla');
    // Dentro de la niebla no se ve: quien ataca a través de ella lo hace con desventaja, y se dice.
    const blind = await page.evaluate(async () => {
        const { attackHindrance } = await import('/scripts/party/board.js');
        const { getCombatEncounter } = await import('/scripts/party.js');
        const enc = getCombatEncounter();
        const zone = (enc?.spellZones ?? [])[0];
        const inside = zone?.cells?.[0];
        return inside ? attackHindrance({ x: 0, y: 0 }, inside, 30) : ['sin zona'];
    });
    check('atacar a algo dentro de la niebla lleva su motivo: «no se ve: nube de niebla» (J19.6)', blind.some(r => /no se ve: nube de niebla/.test(r)), JSON.stringify(blind));

    // 9. J19.6: una telaraña en el camino (como la de un mago de nivel 3): cuesta el doble y salta al entrar.
    const web = await page.evaluate(async () => {
        const { getCombatEncounter, getPartyMembersSnapshot } = await import('/scripts/party.js');
        const { zoneFromSpell, placeZone } = await import('/scripts/game-engine/board/spell-zones.js');
        const { normalizeSpell } = await import('/scripts/game-engine/rules/spell-catalogue.js');
        const rows = (await (await fetch('/compendio/conjuros.json')).json()).rows;
        const spell = normalizeSpell(rows.find((/** @type {any} */ r) => r.id === 'conj-telarana'));
        const hero = getPartyMembersSnapshot()[0];
        const hx = Number(hero.mapPosition?.gridX) || 0;
        const hy = Number(hero.mapPosition?.gridY) || 0;
        // Dos casillas a su izquierda, en su fila y en la de arriba, para que andar hacia allí la pise.
        const cells = [{ x: hx - 1, y: hy }, { x: hx - 2, y: hy }, { x: hx - 1, y: hy - 1 }, { x: hx - 2, y: hy - 1 }];
        const enc = getCombatEncounter();
        const zone = zoneFromSpell({ spell, cells, center: cells[0], casterId: 'e2e', round: Number(enc.round) || 1, saveDc: 30 });
        enc.spellZones = placeZone(enc.spellZones ?? [], zone).zones;
        const { renderLocationMapsPreview } = await import('/scripts/party/board-view.js');
        renderLocationMapsPreview();
        return { hero: { x: hx, y: hy }, cells };
    });
    await page.waitForTimeout(500);
    const webDrawn = await page.locator(`${BOARD} .wm-spell-zone[data-kind="telarana"]`).count();
    check('la telaraña se dibuja donde está (J19.6)', webDrawn === 4, `${webDrawn} casillas`);
    // El precio del camino, antes de pulsar: dos casillas de telaraña cuestan cuatro.
    await clickHero();
    const target = { x: web.hero.x - 2, y: web.hero.y };
    const preview = await page.evaluate(async (to) => {
        const { getActiveBoardContext } = await import('/scripts/party/board.js');
        const { findPath, getPathCost } = await import('/scripts/game-engine/board/pathfinding.js');
        const { terrain, gridWidth, gridHeight } = getActiveBoardContext();
        const { getPartyMembersSnapshot } = await import('/scripts/party.js');
        const hero = getPartyMembersSnapshot()[0];
        const path = findPath(terrain, Number(hero.mapPosition.gridX), Number(hero.mapPosition.gridY), to.x, to.y, gridWidth, gridHeight, {});
        return { steps: path ? path.length - 1 : -1, feet: path ? getPathCost(terrain, path) * 5 : -1 };
    }, target);
    check('cruzar la telaraña cuesta el doble: dos casillas, 20 pies (J19.6)', preview.steps === 2 && preview.feet === 20, JSON.stringify(preview));
    const cell = page.locator(`${BOARD} .wm-highlight-move.wm-highlight-clickable[data-x="${target.x}"][data-y="${target.y}"]`);
    if (await cell.count() > 0) {
        await cell.first().hover({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(200);
    }
    const shownCost = String(await page.locator(`${BOARD} .wm-path-cost`).first().textContent({ timeout: 1500 }).catch(() => ''));
    if (await cell.count() > 0) await cell.first().click({ timeout: 3000 }).catch(() => {});
    await clearDice();
    const stuck = await until(() => chatHas(/Telaraña/), 6000);
    const after = (await state()).party[0];
    check('al pasar, la ruta dice lo que cuesta y la telaraña salta al entrar: con CD 30, se queda pegada en la primera casilla (J19.6)',
        /^20 pies/.test(shownCost) && stuck && after.x === web.hero.x - 1 && after.y === web.hero.y,
        JSON.stringify({ shownCost, after, lines: (await chatLines(/Telaraña|telaraña/)).slice(-3) }));
    await shot('5-telarana');

    // 10. J19.5: una invocación (los lobos de Conjurar animales) sale en el tablero, con su dibujo, y en la iniciativa.
    await page.evaluate(async () => {
        const { getCombatEncounter, getPartyMembersSnapshot } = await import('/scripts/party.js');
        const { planSummon } = await import('/scripts/game-engine/rules/summons.js');
        const { normalizeSpell } = await import('/scripts/game-engine/rules/spell-catalogue.js');
        const { getActiveBoardContext } = await import('/scripts/party/board.js');
        const rows = (await (await fetch('/compendio/conjuros.json')).json()).rows;
        const beasts = (await (await fetch('/compendio/bestiario.json')).json()).rows;
        const spell = normalizeSpell(rows.find((/** @type {any} */ r) => r.id === 'conj-conjurar-animales'));
        const hero = getPartyMembersSnapshot()[0];
        const enc = getCombatEncounter();
        const { terrain, gridWidth, gridHeight } = getActiveBoardContext();
        const planned = planSummon({
            spell, caster: { id: String(hero.id), name: hero.name, x: Number(hero.mapPosition.gridX), y: Number(hero.mapPosition.gridY) },
            round: Number(enc.round) || 1, bestiary: beasts, occupied: [], terrain, width: gridWidth, height: gridHeight,
        });
        enc.summons = [...(enc.summons ?? []), ...planned.tokens];
        // Lo que hace el turno con las recién llegadas (`spell-turn.js`): hacerlas luchadoras y
        // meterlas en la iniciativa, detrás de quien las llamó.
        (await import('/scripts/party/spell-turn.js')).summonsNow();
        const { renderLocationMapsPreview } = await import('/scripts/party/board-view.js');
        renderLocationMapsPreview();
    });
    await page.waitForTimeout(800);
    const summoned = await page.evaluate((sel) => ({
        tokens: [...document.querySelectorAll(`${sel} .wm-token.wm-token-summon`)].map(t => ({
            name: (t.querySelector('.wm-token-name')?.textContent || '').trim(),
            art: (t.querySelector('img.wm-token-avatar')?.getAttribute('src') || '').split('/').slice(-2).join('/'),
            mark: Boolean(t.querySelector('.wm-token-summon-mark')),
            meta: (t.querySelector('.wm-token-tooltip-meta')?.textContent || '').trim(),
        })),
        rows: [...document.querySelectorAll('.wm-init-row')].map(r => (r.textContent || '').replace(/\s+/g, ' ').trim()).filter(t => /Lobo/.test(t)),
        faces: [...document.querySelectorAll('.wm-init-row img.wm-init-face')].map(i => (i.getAttribute('src') || '').split('/').slice(-2).join('/')).filter(s => /lobo/.test(s)),
    }), BOARD);
    check('los dos lobos invocados salen en el tablero con su dibujo, su marca y de quién son (J19.5)',
        summoned.tokens.length === 2 && summoned.tokens.every(t => /lobo/.test(t.art) && t.mark && new RegExp(`Invocación de ${HERO}`).test(t.meta)), JSON.stringify(summoned.tokens));
    check('y en la iniciativa, detrás de la maga, con su cara (J19.5)', summoned.rows.length === 2 && summoned.faces.length === 2, JSON.stringify(summoned));
    await shot('6-invocacion');

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
