#!/usr/bin/env node
/**
 * J5.4 de ROADMAP_SIN_CONEXION: añadir una campaña al tablón del gremio desde un archivo.
 * Contra un servidor propio con un `--dataRoot` temporal, como `e2e-saltar-prueba.mjs`:
 *
 *   título → Jugar sin conexión → tu personaje → saltar la prueba → el tablón →
 *   «Añadir una campaña» con un archivo que no es JSON: dice dónde falla →
 *   con un paquete sin tableros: dice lo que dice el validador →
 *   con lo que da el Gem (el paquete de ejemplo, con cabecera y marcas [cite]): la tarjeta
 *   sale en el tablón, con sus niveles y su distancia → cerrar y abrir: sigue ahí →
 *   empezarla: el grupo viaja y la campaña empieza → volver al gremio: «En curso».
 *
 * Uso:
 *   node tools/e2e-importar-campana.mjs              # sin ventana
 *   node tools/e2e-importar-campana.mjs --headed     # mirándolo
 *   node tools/e2e-importar-campana.mjs --port 8157 --captura importar.png
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
const PORT = Number(argAfter('--port')) || 8136;
const BASE = `http://127.0.0.1:${PORT}`;
const HEADED = process.argv.includes('--headed');
const SHOT = argAfter('--captura');

const require = createRequire(join(ROOT, 'tests/package.json'));
const { chromium } = require('@playwright/test');

// La campaña de la prueba: el paquete de ejemplo que publica el contrato, vestido como lo
// devuelve el Gem (la cabecera del esquema y las marcas del resumidor), con otro nombre.
const { buildExamplePack } = await import(pathToFileURL(join(ROOT, 'public/scripts/game-engine/campaign/campaign-pack-schema.js')).href);
const NAME = 'El Molino de prueba';
const ID = 'tuya-el-molino-de-prueba';
const gemPack = (() => {
    const pack = buildExamplePack();
    pack.world.name = NAME;
    pack.world.synopsis = `${pack.world.synopsis} [cite: 7]`;
    return { $schema: 'http://json-schema.org/draft-07/schema#', title: 'Paquete de campaña', description: 'Lo que devuelve el Gem.', ...pack };
})();
const noBoards = (() => {
    const pack = buildExamplePack();
    pack.world.name = 'Sin tableros';
    pack.boards = [];
    return pack;
})();

let failures = 0;
const check = (/** @type {string} */ name, /** @type {boolean} */ ok, detail = '') => {
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        -> ${detail}` : ''}`);
};

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-importar-'));
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
            // Los consejos, vistos: aquí se mira el tablón, no enseñar a jugar.
            window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,combat,travel,prisoners,mesa,high,spell,pet,bill,move,attack,roll,talk,journal');
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
            window.localStorage.setItem('sillytavern_gameSucesos', 'off');
        } catch { /* nada */ }
    });

    const state = () => page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const party = (await import('/scripts/party.js')).getPartyMembersSnapshot();
        const meta = ctx.chatMetadata ?? {};
        return {
            world: String(meta.world_info ?? ''),
            board: String(meta.currentBoard ?? ''),
            party: party.map((/** @type {any} */ m) => ({ name: m.name, world: m.worldName })),
            fighting: Boolean(meta.combatEncounter?.active),
        };
    });
    const chips = () => page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-chip-action')].map(c => (c.textContent || '').trim()));
    const clickChip = (/** @type {RegExp} */ pattern) => page.evaluate((source) => {
        const chip = [...document.querySelectorAll('#game-shell .gs-chip-action')].find(b => new RegExp(source).test(b.textContent || ''));
        if (chip instanceof HTMLElement) chip.click();
        return Boolean(chip);
    }, pattern.source);
    const chatHas = (/** @type {RegExp} */ pattern) => page.evaluate((source) => (window.SillyTavern.getContext().chat || [])
        .some((/** @type {any} */ m) => new RegExp(source).test(String(m.extra?.display_text || m.mes || ''))), pattern.source);
    const until = async (/** @type {() => Promise<boolean>} */ test, ms = 30000) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (await test().catch(() => false)) return true;
            await page.waitForTimeout(400);
        }
        return false;
    };
    const dropToasts = () => page.evaluate(() => document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));
    /** Abrir el tablón, como quien juega: la ficha de la fila. */
    const openBoard = async () => {
        await dropToasts();
        await clickChip(/Tablón de campañas/);
        return page.waitForSelector('.hb-root [data-campaign-add]', { timeout: 15000 }).then(() => true).catch(() => false);
    };
    /** Las tarjetas del tablón, en orden: su id (o «añadir») y lo que dicen. */
    const boardTiles = () => page.evaluate(() => [...document.querySelectorAll('.hb-root .hb-grid > .vt-card')].map(c => ({
        id: c.getAttribute('data-campaign') || (c.hasAttribute('data-campaign-add') ? 'añadir' : ''),
        text: (c.textContent || '').replace(/\s+/g, ' ').trim(),
    })));
    /**
     * «Añadir una campaña» con un archivo, eligiéndolo en la ventana de archivos, y lo que dice
     * el tablón después.
     *
     * @param {string} name
     * @param {string} content
     */
    const addFile = async (name, content) => {
        const before = await page.evaluate(() => document.querySelector('.hb-root .hb-import')?.textContent || '');
        const [chooser] = await Promise.all([
            page.waitForEvent('filechooser', { timeout: 10000 }),
            page.locator('.hb-root [data-campaign-add]').click(),
        ]);
        await chooser.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(content, 'utf8') });
        await until(() => page.evaluate((was) => {
            const box = document.querySelector('.hb-root .hb-import');
            return Boolean(box && (box.textContent || '') !== was && !document.querySelector('.hb-root .hb-add.is-busy'));
        }, before), 20000);
        return page.evaluate(() => {
            const box = document.querySelector('.hb-root .hb-import');
            return {
                ok: box?.classList.contains('is-ok') ?? false,
                bad: box?.classList.contains('is-bad') ?? false,
                text: (box?.textContent || '').replace(/\s+/g, ' ').trim(),
                items: [...document.querySelectorAll('.hb-root .hb-import-list li')].map(li => (li.textContent || '').trim()),
            };
        });
    };

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    const firstRun = page.locator('text=Welcome to SillyTavern!');
    if (await firstRun.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#game-shell', { timeout: 90000 });

    // 1. Al gremio: el personaje, y la prueba saltada, como quien ya sabe jugar.
    const offline = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Jugar sin conexión' });
    await until(async () => await offline.count() === 1, 30000);
    await offline.click();
    await page.waitForSelector('.hc-root', { timeout: 120000 });
    await page.fill('.hc-root .hc-name', 'Iria');
    await pickHeroCard(page, 'race', 'Humano');
    await pickHeroCard(page, 'class', 'Guerrero');
    await page.locator('.hc-root .hc-enter').click();
    const inHub = await until(async () => {
        const now = await state();
        return /Gremio/.test(now.world) && now.party.length === 1;
    }, 60000);
    await until(() => chatHas(/Baja a la bodega/), 20000);
    await until(async () => (await chips()).some(c => /^Saltar la prueba$/.test(c)), 15000);
    await clickChip(/^Saltar la prueba$/);
    await page.waitForSelector('.popup:has-text("¿Saltar la prueba?")', { timeout: 10000 }).catch(() => {});
    await page.locator('.popup-button-ok:visible').first().click({ timeout: 5000 }).catch(() => {});
    const skipped = await until(() => chatHas(/apunta tu nombre en el libro del gremio/), 15000);
    check('en el gremio con Iria, y la prueba saltada', inHub && skipped, JSON.stringify(await state()));
    const hubWorld = (await state()).world;

    // 2. El tablón: las del juego y, al final, «Añadir una campaña».
    const opened = await openBoard();
    let tiles = await boardTiles();
    check('el tablón tiene «Añadir una campaña», al final, después de las del juego',
        opened && tiles.length >= 3 && tiles[tiles.length - 1].id === 'añadir' && /Añadir una campaña/.test(tiles[tiles.length - 1].text)
        && tiles.some(t => t.id === 'strahd') && tiles.some(t => t.id === '1387'), JSON.stringify(tiles.map(t => t.id)));

    // 3. Un archivo que no es JSON: se dice dónde falla, en castellano.
    const notJson = await addFile('roto.json', '{\n  "world": { "name": "Roto" },\n  "boards": [ }\n}');
    check('un archivo que no es JSON: «No se ha podido añadir», con la línea donde falla',
        notJson.bad && /No se ha podido añadir «roto\.json»/.test(notJson.text) && /No es un JSON válido: algo falla en la línea 3, columna 15/.test(notJson.text),
        notJson.text);
    tiles = await boardTiles();
    check('y no se añade nada al tablón', !tiles.some(t => /Roto/.test(t.text)), JSON.stringify(tiles.map(t => t.id)));

    // 4. Un paquete que el validador no deja pasar: sus fallos, uno a uno.
    const invalid = await addFile('sin-tableros.json', JSON.stringify(noBoards));
    check('un paquete sin tableros: lo que dice el validador, en la lista',
        invalid.bad && /La campaña tiene \d+ fallos? que arreglar/.test(invalid.text)
        && invalid.items.some(i => /Un paquete sin tableros no se puede jugar\. boards$/.test(i)) && /pásale esta lista a tu Gem/.test(invalid.text),
        JSON.stringify(invalid));
    if (SHOT) await page.screenshot({ path: `${SHOT}.error.png` });

    // 5. Lo que da el Gem: se pone en limpio y sale en el tablón.
    const added = await addFile('molino.json', JSON.stringify(gemPack, null, 2));
    check('lo que da el Gem se añade: «Añadida al tablón», y dice que se quitaron las marcas',
        added.ok && new RegExp(`Añadida al tablón: ${NAME}`).test(added.text) && /se ha quitado una marca \[cite\]/.test(added.text), added.text);
    tiles = await boardTiles();
    const mine = tiles.find(t => t.id === ID);
    check('su tarjeta sale en el tablón, antes de «Añadir», con los niveles, la distancia y sin empezar',
        Boolean(mine) && tiles.indexOf(/** @type {any} */ (mine)) === tiles.length - 2
        && /Para nivel 1 a 2/.test(mine?.text ?? '') && /A cinco días de camino/.test(mine?.text ?? '') && /Sin empezar/.test(mine?.text ?? '')
        && /Añadida por ti/.test(mine?.text ?? '') && !/cite/.test(mine?.text ?? ''), JSON.stringify(mine));
    if (SHOT) await page.screenshot({ path: SHOT });
    const stored = await page.evaluate(async (id) => {
        const response = await fetch(`/user/files/campana-${id}.pack.json`, { cache: 'no-cache' });
        const pack = response.ok ? await response.json() : null;
        return { status: response.status, name: pack?.world?.name ?? '', schema: pack ? '$schema' in pack : null };
    }, ID);
    check('el paquete, en limpio, está entre tus archivos', stored.status === 200 && stored.name === NAME && stored.schema === false, JSON.stringify(stored));

    // 6. Cerrar el tablón y abrirlo otra vez: sigue ahí (lo guarda el gremio).
    await page.locator('.hb-root .hb-close').click({ timeout: 5000 }).catch(() => {});
    await page.waitForSelector('.hb-root', { state: 'detached', timeout: 10000 }).catch(() => {});
    await openBoard();
    tiles = await boardTiles();
    check('al volver a abrir el tablón, sigue ahí', tiles.some(t => t.id === ID), JSON.stringify(tiles.map(t => t.id)));

    // 7. Empezarla: el grupo viaja y la campaña empieza, como Strahd.
    await page.locator(`.hb-root [data-campaign="${ID}"]`).click();
    const started = await until(async () => (await state()).world.includes(NAME), 120000);
    await page.waitForTimeout(1500);
    let now = await state();
    check('empezarla abre su mundo, con Iria dentro', started && now.party.some(m => m.name === 'Iria' && m.world === now.world), JSON.stringify(now));
    check('antes, el viaje: de Puerto Alba, cinco días', await until(() => chatHas(new RegExp(`Salís de Puerto Alba hacia ${NAME}\\. Cinco días de camino\\.`)), 15000));
    const meta = await page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const data = await (await import('/scripts/world-info.js')).loadWorldInfo(String(ctx.chatMetadata?.world_info || ''));
        return { campaign: data?.metadata?.hubCampaign ?? '', levels: data?.metadata?.hubLevels ?? null, places: (data?.metadata?.locationMaps ?? []).map((/** @type {any} */ l) => l.name) };
    });
    check('la campaña sabe de dónde sale y para qué nivel es', meta.campaign === ID && JSON.stringify(meta.levels) === '[1,2]' && meta.places.includes('El Molino de los Cuervos'), JSON.stringify(meta));
    if (SHOT) await page.screenshot({ path: `${SHOT}.campana.png` });

    // 8. Volver al gremio: la vuelta se cuenta y en el tablón va «En curso».
    await dropToasts();
    const canGoBack = await until(async () => (await chips()).some(c => /Volver al gremio/.test(c)), 20000);
    await clickChip(/Volver al gremio/);
    await page.locator('.popup-button-ok:visible').first().click({ timeout: 3000 }).catch(() => {});
    const back = await until(async () => (await state()).world === hubWorld, 60000);
    check('se vuelve al gremio, y la vuelta se cuenta', canGoBack && back && await until(() => chatHas(/Cinco días de camino después, volvéis a Puerto Alba/), 15000),
        JSON.stringify(await state()));
    await openBoard();
    tiles = await boardTiles();
    check('en el tablón, la tuya va «En curso»', /En curso/.test(tiles.find(t => t.id === ID)?.text ?? ''), JSON.stringify(tiles.find(t => t.id === ID)));
    await page.locator('.hb-root .hb-close').click({ timeout: 5000 }).catch(() => {});

    check('sin errores en la página', problems.length === 0, problems.slice(0, 6).join('\n        '));
} catch (error) {
    failures++;
    console.log(`FAIL  the run threw: ${/** @type {any} */ (error)?.message || error}`);
    if (SHOT && page) await page.screenshot({ path: `${SHOT}.roto.png` }).catch(() => {});
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
