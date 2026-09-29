#!/usr/bin/env node
/**
 * El mapa en cuadrícula (J12.8 a J12.11 de ROADMAP_SIN_CONEXION), en el navegador, contra un
 * servidor propio con un `--dataRoot` temporal, como `e2e-gremio.mjs`:
 *
 *   un mundo → su ficha (el botón del mapa) → Localizaciones → una nueva → un tablero nuevo →
 *   «Subir mapa en cuadrícula» con un mapa dibujado aquí mismo (sin arte de nadie) → la
 *   cuadrícula sola, a mano, contando casillas y marcando una → las casillas leídas y un
 *   retoque con el pincel → una sala con nombre y nota → una altura → «Usar este mapa» →
 *   guardar el tablero, la localización y el mundo → y el mundo guardado lleva la imagen
 *   recortada como archivo, la cuadrícula, el terreno, la sala y la altura → «Retocar el
 *   mapa» lo vuelve a abrir tal cual → y el tablero se ve con el terreno encima del dibujo.
 *
 * Uso:
 *   node tools/e2e-mapa-imagen.mjs                       # puerto 8151, sin ventana
 *   node tools/e2e-mapa-imagen.mjs --headed
 *   node tools/e2e-mapa-imagen.mjs --port 8152 --captura carpeta/   # capturas de cada paso
 */

/* global window, document, $ */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8151;
const BASE = `http://127.0.0.1:${PORT}`;
const HEADED = process.argv.includes('--headed');
const SHOTS = argAfter('--captura');

const require = createRequire(join(ROOT, 'tests/package.json'));
const { chromium } = require('@playwright/test');
const { default: png } = await import('@jimp/js-png');

let failures = 0;
const check = (/** @type {string} */ name, /** @type {boolean} */ ok, detail = '') => {
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        -> ${detail}` : ''}`);
};

// ---- El mapa de prueba: dos salas, una puerta, dibujado como los de mazmorra -------------------

/** Casilla de 24 px, la cuadrícula empieza en (9, 6). */
const CELL = 24;
const OFF_X = 9;
const OFF_Y = 6;
const ROWS = [
    '############',
    '#....#.....#',
    '#....#.....#',
    '#..........#',
    '#....#.....#',
    '#....#.....#',
    '#....#.....#',
    '############',
];
/** La puerta: un rectángulo sobre la línea entre (4,3) y (5,3). El motor la pone en (5,3). */
const DOORS = [{ x: 4, y: 3, side: 'right' }];

/**
 * Papel blanco, cuadrícula gris sobre el suelo, trama negra sobre la roca, el trazo gordo de la
 * pared y la puerta como un rectángulo: como `drawMap` de las pruebas de `map-image.js`.
 */
function drawMap() {
    const cols = ROWS[0].length;
    const rows = ROWS.length;
    const width = OFF_X + cols * CELL + 15;
    const height = OFF_Y + rows * CELL + 11;
    const data = Buffer.alloc(width * height * 4, 255);
    const put = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ value) => {
        x = Math.round(x);
        y = Math.round(y);
        if (x < 0 || y < 0 || x >= width || y >= height) return;
        const i = (y * width + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = Math.min(data[i], value);
    };
    const box = (/** @type {number} */ cx, /** @type {number} */ cy) => ({ x0: OFF_X + cx * CELL, y0: OFF_Y + cy * CELL });
    for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
            const { x0, y0 } = box(cx, cy);
            if (ROWS[cy][cx] === '.') {
                for (let t = 0; t < CELL; t++) {
                    for (const d of [-1, 0, 1]) {
                        put(x0 + t, y0 + d, 166);
                        put(x0 + t, y0 + CELL + d, 166);
                        put(x0 + d, y0 + t, 166);
                        put(x0 + CELL + d, y0 + t, 166);
                    }
                }
            } else {
                for (let y = 0; y < CELL; y++) {
                    for (let x = 0; x < CELL; x++) if ((x + y + cx * CELL + cy * CELL) % 6 < 2) put(x0 + x, y0 + y, 0);
                }
            }
        }
    }
    const walkable = (/** @type {number} */ cx, /** @type {number} */ cy) => cy >= 0 && cy < rows && cx >= 0 && cx < cols && ROWS[cy][cx] === '.';
    /** @type {Array<{x: number, y: number, side: string}>} */
    const lines = [];
    for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
            if (ROWS[cy][cx] !== '#') continue;
            if (walkable(cx + 1, cy)) lines.push({ x: cx, y: cy, side: 'right' });
            if (walkable(cx - 1, cy)) lines.push({ x: cx - 1, y: cy, side: 'right' });
            if (walkable(cx, cy + 1)) lines.push({ x: cx, y: cy, side: 'down' });
            if (walkable(cx, cy - 1)) lines.push({ x: cx, y: cy - 1, side: 'down' });
        }
    }
    for (const line of lines) {
        const { x0, y0 } = box(line.x, line.y);
        for (let t = -1; t <= CELL + 1; t++) {
            for (const d of [-1, 0, 1]) {
                if (line.side === 'right') put(x0 + CELL + d, y0 + t, 0);
                else put(x0 + t, y0 + CELL + d, 0);
            }
        }
    }
    for (const door of DOORS) {
        const { x0, y0 } = box(door.x, door.y);
        for (let t = 3; t < CELL - 3; t++) {
            for (const d of [-4, -3, 3, 4]) {
                if (door.side === 'right') put(x0 + CELL + d, y0 + t, 0);
                else put(x0 + t, y0 + CELL + d, 0);
            }
        }
        for (let d = -4; d <= 4; d++) {
            for (const t of [3, CELL - 4]) {
                if (door.side === 'right') put(x0 + CELL + d, y0 + t, 0);
                else put(x0 + t, y0 + CELL + d, 0);
            }
        }
    }
    return { width, height, data };
}

const map = drawMap();
// `--png ruta`: solo escribe el mapa de prueba, para mirarlo o pasarlo por `mapa-a-tablero.mjs`.
if (argAfter('--png')) {
    writeFileSync(argAfter('--png'), png().encode(/** @type {any} */ (map)));
    console.log(`Escrito ${argAfter('--png')}: ${map.width} × ${map.height} px.`);
    process.exit(0);
}
const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-mapa-'));
const mapFile = join(dataRoot, 'mazmorra-sintetica.png');
writeFileSync(mapFile, png().encode(/** @type {any} */ (map)));
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const shot = async (/** @type {any} */ page, /** @type {string} */ name) => {
    if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`) });
};

/** @type {any} */
let server = null;
/** @type {any} */
let browser = null;

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

try {
    await startServer();
    browser = await chromium.launch({ channel: 'msedge', headless: !HEADED });
    const context = await browser.newContext({ viewport: { width: 1400, height: 950 } });
    const page = await context.newPage();
    /** @type {string[]} */
    const problems = [];
    page.on('pageerror', (/** @type {Error} */ e) => problems.push(`PAGEERROR ${e.message}`));
    page.on('console', (/** @type {any} */ m) => {
        if (m.type() === 'error' && !/Failed to load resource.*404/.test(m.text())) problems.push(`ERROR ${m.text().slice(0, 300)}`);
    });
    /**
     * Pulsar un botón de la pantalla del mapa. Si algo lo tapa, se dice qué (un clic que «no
     * hace nada» casi siempre es otra cosa encima).
     */
    const press = async (/** @type {string} */ selector) => {
        const target = page.locator(selector).first();
        try {
            await target.click({ timeout: 10000 });
        } catch (error) {
            const box = await target.boundingBox().catch(() => null);
            const onTop = box ? await page.evaluate((/** @type {any} */ at) => {
                const hit = document.elementFromPoint(at.x, at.y);
                const root = document.querySelector('.mie-root');
                return `encima: ${hit?.outerHTML.slice(0, 160)} · .mie-root: ${root?.className}`;
            }, { x: box.x + box.width / 2, y: box.y + box.height / 2 }) : 'sin caja';
            const first = error instanceof Error ? error.message.split(String.fromCharCode(10))[0] : String(error);
            throw new Error(`no se puede pulsar ${selector} (${onTop}): ${first}`);
        }
    };
    await context.addInitScript(() => {
        try {
            // La aplicación de siempre, sin la pantalla de título del juego delante.
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'false');
            window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,combat,travel,prisoners,mesa,high,spell,pet,bill,move,attack,roll,talk,journal');
        } catch { /* nada */ }
    });
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    const firstRun = page.locator('text=Welcome to SillyTavern!');
    if (await firstRun.waitFor({ state: 'visible', timeout: 30000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForFunction(() => Boolean(window.SillyTavern?.getContext), null, { timeout: 90000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));

    // Un mundo, y su ficha: el botón del mapa del editor de World Info.
    await page.evaluate(async () => {
        const wi = await import('/scripts/world-info.js');
        await wi.createNewWorldInfo('Mapas', { interactive: false });
        await wi.showWorldEditor('Mapas');
        $('#world_popup_meta').trigger('click');
    });
    await page.waitForSelector('.wm-modal', { timeout: 20000 });
    await page.locator('.wm-accordion:has(#wm_locations_grid) .wm-accordion-toggle').click();
    await page.locator('#wm_add_location').click();
    await page.waitForSelector('#wm_le_name', { timeout: 10000 });
    await page.fill('#wm_le_name', 'La mazmorra');
    await page.locator('#wm_le_add_board').click();
    await page.waitForSelector('#wm_be_map_btn', { timeout: 10000 });
    await page.fill('#wm_be_name', 'El sótano');
    check('el editor de tableros ofrece «Subir mapa en cuadrícula»', await page.locator('#wm_be_map_btn').isVisible());

    // Subirlo: se abre la pantalla y la cuadrícula se busca sola.
    await page.setInputFiles('#wm_be_map_file', mapFile);
    await page.waitForSelector('.mie-root', { timeout: 20000 });
    const summaryIs = async (/** @type {RegExp} */ pattern, timeout = 20000) => page.waitForFunction(
        (/** @type {string} */ source) => new RegExp(source).test(document.querySelector('.mie-summary')?.textContent || ''),
        pattern.source, { timeout }).then(() => true).catch(() => false);
    const found = await summaryIs(/Casillas de 24 px · 12 × 8\. Se ve clara/);
    check('la cuadrícula se encuentra sola: casillas de 24 px, 12 × 8',
        found, await page.locator('.mie-summary').textContent().catch(() => ''));
    await shot(page, '1-cuadricula');

    /** El centro de una casilla, en la pantalla. */
    const cellPoint = async (/** @type {number} */ cx, /** @type {number} */ cy) => {
        const box = await page.locator('.mie-overlay').boundingBox();
        return {
            x: box.x + ((OFF_X + (cx + 0.5) * CELL) / map.width) * box.width,
            y: box.y + ((OFF_Y + (cy + 0.5) * CELL) / map.height) * box.height,
        };
    };
    const clickCell = async (/** @type {number} */ cx, /** @type {number} */ cy) => {
        const at = await cellPoint(cx, cy);
        await page.mouse.click(at.x, at.y);
    };

    // A mano, mal: 30 px. Luego contando casillas: 12 de ancho. Luego marcando una.
    await page.fill('.mie-cell', '30');
    await press('.mie-apply');
    check('a mano: el lado dicho manda (30 px, 10 × 6)', await summaryIs(/Casillas de 30 px · 10 × 6\./, 5000));
    await page.fill('.mie-across', '12');
    await press('.mie-across-go');
    check('contando casillas de ancho (12) vuelve a caer en 24 px',
        await summaryIs(/Casillas de 24 px · 12 × 8\./), await page.locator('.mie-summary').textContent());
    await page.fill('.mie-cell', '30');
    await press('.mie-apply');
    await summaryIs(/30 px/, 5000);
    await press('.mie-mark');
    {
        const box = await page.locator('.mie-overlay').boundingBox();
        const toScreen = (/** @type {number} */ px, /** @type {number} */ py) => ({ x: box.x + (px / map.width) * box.width, y: box.y + (py / map.height) * box.height });
        // Una casilla del dibujo, de esquina a esquina, con un píxel de error.
        const from = toScreen(OFF_X + 2 * CELL, OFF_Y + 2 * CELL);
        const to = toScreen(OFF_X + 3 * CELL + 1, OFF_Y + 3 * CELL);
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2);
        await page.mouse.move(to.x, to.y);
        await page.mouse.up();
    }
    check('marcando una casilla con el ratón vuelve a caer en 24 px, 12 × 8',
        await summaryIs(/Casillas de 24 px · 12 × 8\./), await page.locator('.mie-summary').textContent());

    // Las casillas: lo leído, y un retoque con el pincel.
    await press('.mie-tab[data-step="terrain"]');
    const read = await summaryIs(/Suelo \d+ · Muro \d+ · Puertas 1/);
    check('las casillas leídas: suelo, muro y una puerta', read, await page.locator('.mie-summary').textContent());
    await press('.mie-brush[data-brush="~"]');
    await clickCell(8, 5);
    await clickCell(9, 5);
    await page.waitForTimeout(200);
    check('el pincel pinta terreno difícil encima', await summaryIs(/Terreno difícil 2/, 5000), await page.locator('.mie-summary').textContent());
    await shot(page, '2-casillas');

    // Una sala: pulsar en ella, nombre y nota.
    await press('.mie-tab[data-step="zones"]');
    await page.waitForSelector('.mie-zone-name', { timeout: 10000 });
    await clickCell(2, 2);
    const picked = await page.waitForFunction(() => /\d+ casillas elegidas/.test(document.querySelector('.mie-selected')?.textContent || ''), null, { timeout: 10000 })
        .then(() => true).catch(() => false);
    const pickedText = String(await page.locator('.mie-selected').textContent());
    check('pulsar en la sala la elige entera (la izquierda: 4 × 6 = 24 casillas)', picked && /^24 casillas/.test(pickedText), pickedText);
    await page.fill('.mie-zone-name', 'B1');
    await page.fill('.mie-zone-note', 'Dos goblins juegan a los dados.');
    await press('.mie-zone-save');
    check('la sala se guarda y sale en la lista',
        await page.locator('.mie-list-pick', { hasText: 'B1' }).count() === 1, String(await page.locator('.mie-say').textContent()));
    await shot(page, '3-salas');

    // Una altura: la sala de la derecha, a 30 pies.
    await press('.mie-tab[data-step="heights"]');
    await page.waitForSelector('.mie-feet', { timeout: 10000 });
    await clickCell(8, 2);
    await page.waitForFunction(() => /casillas elegidas/.test(document.querySelector('.mie-selected')?.textContent || ''), null, { timeout: 10000 }).catch(() => {});
    await page.fill('.mie-feet', '30');
    await press('.mie-height-set');
    const heightItem = await page.locator('.mie-list-pick', { hasText: '+30 pies' }).textContent().catch(() => '');
    check('la altura se pone: +30 pies en la sala de la derecha (5 × 6 = 30 casillas)', /\+30 pies · 30 casillas/.test(String(heightItem)), String(heightItem));
    await shot(page, '4-alturas');

    // Usar este mapa.
    await page.locator('.popup:has(.mie-root) .popup-button-ok').click();
    await page.waitForSelector('.mie-root', { state: 'detached', timeout: 20000 });
    const info = String(await page.locator('#wm_be_map_info').textContent());
    check('el editor de tableros lo dice: 12 × 8 casillas, 1 sala, con alturas', info === '12 × 8 casillas · 1 sala · con alturas', info);
    check('y pone el tamaño del tablero', await page.inputValue('#wm_be_gw') === '12' && await page.inputValue('#wm_be_gh') === '8');
    const url = await page.inputValue('#wm_be_url');
    check('la imagen es un archivo del mundo, no un data URL', /^\/?user\/images\/Mapas\/mapa-\d+\.png$/.test(url), url);
    await shot(page, '5-tablero');

    // Guardar el tablero, la localización y el mundo.
    await page.locator('.popup:has(#wm_be_name) .popup-button-ok').click();
    await page.waitForSelector('#wm_be_name', { state: 'detached', timeout: 10000 });
    await page.locator('.popup:has(#wm_le_name) .popup-button-ok').click();
    await page.waitForSelector('#wm_le_name', { state: 'detached', timeout: 10000 });
    await page.locator('.popup:has(.wm-modal) .popup-button-ok').click();
    await page.waitForSelector('.wm-modal', { state: 'detached', timeout: 10000 });
    await page.waitForTimeout(1000);

    const saved = await page.evaluate(async () => {
        const wi = await import('/scripts/world-info.js');
        const data = await wi.loadWorldInfo('Mapas');
        const board = data?.metadata?.locationMaps?.[0]?.boards?.[0] ?? null;
        /** @type {{width: number, height: number}|null} */
        let image = null;
        if (board?.url) {
            image = await new Promise(resolve => {
                const img = new window.Image();
                img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
                img.onerror = () => resolve(null);
                img.src = String(board.url).startsWith('/') ? board.url : `/${board.url}`;
            });
        }
        return { board, image, raw: JSON.stringify(data?.metadata ?? {}).length };
    });
    const board = saved.board ?? {};
    const terrain = board.terrain?.cells ?? {};
    check('el mundo guardado tiene el tablero, con su nombre', board.name === 'El sótano', JSON.stringify(Object.keys(board)));
    check('la cuadrícula: 24 px, empieza en la esquina de la imagen recortada, 12 × 8',
        board.grid?.cell === 24 && board.grid.offsetX < 0.5 && board.grid.offsetY < 0.5 && board.grid.cols === 12 && board.grid.rows === 8
        && board.gridWidth === 12 && board.gridHeight === 8, JSON.stringify(board.grid));
    check('la imagen guardada es la recortada a la cuadrícula: 288 × 192',
        saved.image?.width === 12 * CELL && saved.image?.height === 8 * CELL, JSON.stringify(saved.image));
    check('el terreno: roca por fuera y en la pared, la puerta en su sitio, el retoque del pincel',
        terrain['0,0']?.type === 'wall' && terrain['5,1']?.type === 'wall' && terrain['5,3']?.type === 'door'
        && terrain['8,5']?.type === 'difficult' && terrain['9,5']?.type === 'difficult' && !terrain['2,2'],
        JSON.stringify(terrain).slice(0, 300));
    const zone = board.zones?.[0];
    check('la sala B1 con su nota y sus casillas, sin salirse por la puerta',
        board.zones?.length === 1 && zone.name === 'B1' && zone.note === 'Dos goblins juegan a los dados.'
        && zone.cells.includes('2,2') && zone.cells.length === 24 && !zone.cells.includes('5,3') && !zone.cells.includes('7,2'),
        JSON.stringify(board.zones));
    check('la altura: 30 pies en la sala de la derecha, nada en la de la izquierda',
        board.elevation?.['8,2'] === 30 && Object.keys(board.elevation).length === 30 && !board.elevation['2,2'], JSON.stringify(board.elevation));
    check('el mundo no lleva la imagen dentro (menos de 20 KB de metadatos)', saved.raw < 20000, `${saved.raw} caracteres`);

    // Retocar: vuelve a abrirse con lo guardado.
    await page.evaluate(() => $('#world_popup_meta').trigger('click'));
    await page.waitForSelector('.wm-modal', { timeout: 20000 });
    await page.locator('.wm-accordion:has(#wm_locations_grid) .wm-accordion-toggle').click();
    await page.locator('#wm_locations_grid .wm-card').first().click();
    await page.waitForSelector('#wm_le_name', { timeout: 10000 });
    await page.locator('.wm-board-mini').first().click();
    await page.waitForSelector('#wm_be_map_edit', { timeout: 10000 });
    check('un tablero con mapa ofrece «Retocar el mapa»', await page.locator('#wm_be_map_edit').isVisible());
    await page.locator('#wm_be_map_edit').click();
    await page.waitForSelector('.mie-root', { timeout: 20000 });
    check('al retocar, la cuadrícula es la guardada', await summaryIs(/Casillas de 24 px · 12 × 8\./, 10000));
    await press('.mie-tab[data-step="zones"]');
    check('y la sala B1 sigue ahí', await page.locator('.mie-list-pick', { hasText: 'B1' }).count() === 1);
    await page.locator('.popup:has(.mie-root) .popup-button-cancel').click();
    await page.waitForSelector('.mie-root', { state: 'detached', timeout: 10000 });
    for (const sel of ['#wm_be_name', '#wm_le_name', '.wm-modal']) {
        await page.locator(`.popup:has(${sel}) .popup-button-cancel`).click().catch(() => {});
        await page.waitForSelector(sel, { state: 'detached', timeout: 10000 }).catch(() => {});
    }

    // Y el tablero, como lo pinta el juego: el terreno encima del dibujo, casilla a casilla.
    await page.evaluate(async (/** @type {any} */ b) => {
        const { renderLocationView } = await import('/scripts/world-map-renderer.js');
        const host = document.createElement('div');
        host.id = 'e2e-mapa-vista';
        host.style.cssText = 'position:fixed;left:20px;top:20px;width:760px;height:560px;z-index:99999;background:#222;overflow:hidden;';
        document.body.append(host);
        renderLocationView($(host), {
            name: b.name, imageUrl: b.url, gridWidth: b.gridWidth, gridHeight: b.gridHeight, tokens: [], terrain: b.terrain,
        });
    }, board);
    await page.waitForTimeout(1500);
    const layer = await page.evaluate(() => {
        const content = document.querySelector('#e2e-mapa-vista .wm-terrain-layer');
        return { cells: content ? content.children.length : 0 };
    });
    check('el juego pinta el tablero con su terreno', layer.cells > 0, JSON.stringify(layer));
    if (SHOTS) await page.locator('#e2e-mapa-vista').screenshot({ path: join(SHOTS, '6-en-el-juego.png') });

    const serious = problems.filter(p => !/favicon|ResizeObserver loop/.test(p));
    check('sin errores en la página', serious.length === 0, serious.slice(0, 5).join('\n        '));
} catch (error) {
    failures++;
    console.log(`FAIL  el recorrido se ha parado: ${error instanceof Error ? error.stack : error}`);
} finally {
    await browser?.close().catch(() => {});
    server?.kill();
    try {
        rmSync(dataRoot, { recursive: true, force: true });
    } catch { /* el servidor aún lo tiene abierto */ }
}

console.log(failures === 0 ? '\nTodo bien.' : `\n${failures} fallo(s).`);
process.exit(failures === 0 ? 0 : 1);
