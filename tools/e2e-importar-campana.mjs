#!/usr/bin/env node
/**
 * J5.4 de ROADMAP_SIN_CONEXION: añadir una campaña al tablón del gremio desde un archivo.
 * Contra un servidor propio con un `--dataRoot` temporal, como `e2e-saltar-prueba.mjs`:
 *
 *   título → Jugar sin conexión → tu personaje → saltar la prueba → el tablón →
 *   «Añadir una campaña» con un archivo que no es JSON: dice dónde falla →
 *   con un paquete sin tableros: dice lo que dice el validador →
 *   con lo que da el Gem (el paquete de ejemplo, con cabecera y marcas [cite]): la tarjeta
 *   sale en el tablón, con su nivel recomendado y su distancia, en tu lista (D-J35) → pegar el
 *   texto de otra que empieza en el nivel 10: avisa (D-J22) → quitarla del tablón (D-J35) →
 *   cerrar y abrir: la primera sigue ahí → empezarla: el grupo viaja y la campaña empieza →
 *   volver al gremio: «En curso» → acabarla: el salón la llama como el tablón (D-J19) →
 *   un segundo personaje: el nombre no se repite (D-J14) y llega con 10 de oro (D-J11); Iria,
 *   herida, descansa cuatro días y vuelve curada (D-J12) → otro gremio: tu campaña también
 *   está en su tablón (D-J35).
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
// D-J35 y D-J22: otra, pegada como texto, que empieza en el nivel 10.
const HIGH = 'La Cima de prueba';
const HIGH_ID = 'tuya-la-cima-de-prueba';
const highPack = (() => {
    const pack = buildExamplePack();
    pack.world.name = HIGH;
    pack.world.levels = [10, 12];
    return pack;
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
    /** Las tarjetas del tablón, en orden: su id (o «añadir») y lo que dicen. D-J35: las tuyas van en su caja, con «Quitar». */
    const boardTiles = () => page.evaluate(() => [...document.querySelectorAll('.hb-root .hb-grid > .vt-card, .hb-root .hb-grid > .hb-tile > .vt-card')].map(c => ({
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
    check('su tarjeta sale en el tablón, antes de «Añadir», con el nivel recomendado, la distancia y sin empezar (D-J22)',
        Boolean(mine) && tiles.indexOf(/** @type {any} */ (mine)) === tiles.length - 2
        && /Nivel recomendado: 1 a 2/.test(mine?.text ?? '') && /A cinco días de camino/.test(mine?.text ?? '') && /Sin empezar/.test(mine?.text ?? '')
        && /Añadida por ti/.test(mine?.text ?? '') && !/cite/.test(mine?.text ?? ''), JSON.stringify(mine));
    const removable = await page.evaluate((id) => ({
        mine: Boolean(document.querySelector(`.hb-root [data-campaign-remove="${id}"]`)),
        strahd: Boolean(document.querySelector('.hb-root [data-campaign-remove="strahd"]')),
    }), ID);
    check('la tuya se puede quitar del tablón; las del juego, no (D-J35)', removable.mine && !removable.strahd, JSON.stringify(removable));
    if (SHOT) await page.screenshot({ path: SHOT });
    const stored = await page.evaluate(async (id) => {
        const response = await fetch(`/user/files/campana-${id}.pack.json`, { cache: 'no-cache' });
        const pack = response.ok ? await response.json() : null;
        return { status: response.status, name: pack?.world?.name ?? '', schema: pack ? '$schema' in pack : null };
    }, ID);
    check('el paquete, en limpio, está entre tus archivos', stored.status === 200 && stored.name === NAME && stored.schema === false, JSON.stringify(stored));
    const listed = await page.evaluate(async () => {
        const response = await fetch('/user/files/tablon-campanas.json', { cache: 'no-cache' });
        return response.ok ? ((await response.json())?.campaigns ?? []).map((/** @type {any} */ r) => r.id) : [];
    });
    check('y su fila, en tu lista de campañas, no en el gremio (D-J35)', JSON.stringify(listed) === JSON.stringify([ID]), JSON.stringify(listed));

    // 5b. D-J35: pegar el texto. Una que empieza en el nivel 10: avisa a un grupo sin experiencia (D-J22).
    await page.locator('.hb-root .hb-paste-open').click();
    await page.fill('.hb-root .hb-paste-text', `\`\`\`json\n${JSON.stringify(highPack, null, 2)}\n\`\`\``);
    await page.locator('.hb-root .hb-paste-add').click();
    await until(() => page.evaluate((id) => Boolean(document.querySelector(`.hb-root [data-campaign="${id}"]`)), HIGH_ID), 20000);
    const pasted = await page.evaluate(() => (document.querySelector('.hb-root .hb-import')?.textContent || '').replace(/\s+/g, ' ').trim());
    tiles = await boardTiles();
    const high = tiles.find(t => t.id === HIGH_ID);
    check('pegar el texto también la añade: «Añadida al tablón», y el cuadro se vacía (D-J35)',
        new RegExp(`Añadida al tablón: ${HIGH}`).test(pasted) && await page.inputValue('.hb-root .hb-paste-text') === '', pasted);
    check('una que empieza en el 10: «Nivel recomendado: 10 a 12», y que no es para un grupo sin experiencia (D-J22)',
        /Nivel recomendado: 10 a 12/.test(high?.text ?? '') && /No es para un grupo sin experiencia: empieza en el nivel 10 y tu grupo es de nivel 1/.test(high?.text ?? '')
        && await page.locator(`.hb-root [data-campaign="${HIGH_ID}"] .hb-levels.is-hard`).count() === 1, JSON.stringify(high));
    if (SHOT) await page.screenshot({ path: `${SHOT}.pegada.png` });

    // 5c. D-J35: quitarla del tablón, con su confirmación.
    await page.locator(`.hb-root [data-campaign-remove="${HIGH_ID}"]`).click();
    const asked = await page.waitForSelector('.popup:has-text("del tablón?")', { timeout: 10000 }).then(() => true).catch(() => false);
    const question = asked ? await page.evaluate(() => ([...document.querySelectorAll('.popup')].pop()?.textContent || '').replace(/\s+/g, ' ').trim()) : '';
    await page.locator('.popup:has-text("del tablón?") .popup-button-ok').click({ timeout: 5000 }).catch(() => {});
    await until(() => page.evaluate((id) => !document.querySelector(`.hb-root [data-campaign="${id}"]`), HIGH_ID), 15000);
    const afterRemove = await page.evaluate(async (id) => {
        const list = await fetch('/user/files/tablon-campanas.json', { cache: 'no-cache' }).then(r => r.json()).catch(() => null);
        const file = await fetch(`/user/files/campana-${id}.pack.json`, { cache: 'no-cache' });
        return {
            report: (document.querySelector('.hb-root .hb-import')?.textContent || '').replace(/\s+/g, ' ').trim(),
            ids: (list?.campaigns ?? []).map((/** @type {any} */ r) => r.id),
            file: file.status,
        };
    }, HIGH_ID);
    check('«Quitar del tablón» pregunta antes, lo dice llano, y la quita de tu lista y su archivo (D-J35)',
        asked && /Deja de salir en el tablón de todos tus gremios/.test(question)
        && new RegExp(`Quitada del tablón: ${HIGH}`).test(afterRemove.report) && JSON.stringify(afterRemove.ids) === JSON.stringify([ID]) && afterRemove.file === 404,
        JSON.stringify({ question, afterRemove }));

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
    const boardName = await page.evaluate(() => String(window.SillyTavern.getContext().chatMetadata?.hubCampaignName ?? ''));
    check('y cómo se llama en el tablón, para el salón de la fama (D-J19)', boardName === NAME, boardName);
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

    // 8b. D-J19: seguirla, acabarla y volver: en el salón de la fama se llama como en el tablón,
    // no como su mundo («El Molino de prueba · Iria»).
    await page.locator(`.hb-root [data-campaign="${ID}"]`).click();
    const resumed = await until(async () => (await state()).world.includes(NAME), 60000);
    await page.waitForTimeout(1500);
    await page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        ctx.chatMetadata.plotEnding = 'El molino, libre';
        await ctx.saveMetadata();
    });
    await dropToasts();
    await until(async () => (await chips()).some(c => /Volver al gremio/.test(c)), 20000);
    await clickChip(/Volver al gremio/);
    await page.locator('.popup-button-ok:visible').first().click({ timeout: 3000 }).catch(() => {});
    const backAgain = await until(async () => (await state()).world === hubWorld, 60000);
    await page.waitForTimeout(1000);
    await dropToasts();
    const hallChip = await until(() => clickChip(/Salón de la fama/), 15000);
    await page.waitForSelector('.popup:visible .hall-root', { timeout: 8000 }).catch(() => {});
    const hall = await page.evaluate(() => [...document.querySelectorAll('.hall-root .hall-campaign')].map(e => (e.textContent || '').trim()));
    check('acabada, entra en el salón de la fama con su nombre del tablón (D-J19)',
        resumed && backAgain && hallChip && hall.length === 1 && hall[0].startsWith(`${NAME}: terminada con «El molino, libre»`), JSON.stringify({ resumed, backAgain, hallChip, hall }));
    if (SHOT) await page.screenshot({ path: `${SHOT}.salon.png` });
    await page.locator('.popup:visible .popup-button-ok').last().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(400);

    // 9. Tus personajes: el nombre no se repite (D-J14), el segundo llega con 10 de oro (D-J11) y
    // quien descansa en el gremio se cura con los días (D-J12).
    /** El tuyo que va con el grupo. */
    const leader = () => page.evaluate(async () => {
        const party = (await import('/scripts/party.js')).getPartyMembersSnapshot();
        const hero = party.find((/** @type {any} */ m) => !m.guest);
        return hero ? { name: String(hero.name), gold: Number(hero.gold) || 0, hp: Number(hero.hp) || 0, maxHp: Number(hero.maxHp) || 0 } : null;
    });
    const toastText = () => page.evaluate(() => [...document.querySelectorAll('#toast-container .toast')].map(t => (t.textContent || '').trim()).join(' | '));
    await openBoard();
    await dropToasts();
    await page.locator('.hb-root [data-hero-new]').click();
    await page.waitForSelector('.hc-root', { timeout: 30000 });
    await pickHeroCard(page, 'race', 'Humano');
    await pickHeroCard(page, 'class', 'Guerrero');
    await page.fill('.hc-root .hc-name', 'ÍRIA ');
    await page.waitForTimeout(300);
    const clash = await page.evaluate(() => ({
        said: (document.querySelector('.hc-root .hc-name-taken') instanceof HTMLElement
            && /** @type {HTMLElement} */ (document.querySelector('.hc-root .hc-name-taken')).offsetParent !== null)
            ? (document.querySelector('.hc-root .hc-name-taken')?.textContent || '') : '',
        off: /** @type {HTMLButtonElement|null} */ (document.querySelector('.hc-root .hc-enter'))?.disabled ?? null,
    }));
    check('«ÍRIA» no vale en el gremio de Iria: se dice llano y no se puede entrar (D-J14)',
        clash.said === 'Ya hay un personaje que se llama Iria en este gremio. Elige otro nombre.' && clash.off === true, JSON.stringify(clash));
    if (SHOT) await page.screenshot({ path: `${SHOT}.nombre.png` });
    await page.fill('.hc-root .hc-name', 'Nuno');
    await page.waitForTimeout(300);
    const freed = await page.evaluate(() => ({
        hidden: !(document.querySelector('.hc-root .hc-name-taken') instanceof HTMLElement
            && /** @type {HTMLElement} */ (document.querySelector('.hc-root .hc-name-taken')).offsetParent !== null),
        on: /** @type {HTMLButtonElement|null} */ (document.querySelector('.hc-root .hc-enter'))?.disabled === false,
    }));
    await page.locator('.hc-root .hc-enter').click();
    const nuno = await until(async () => (await leader())?.name === 'Nuno', 30000);
    await page.waitForTimeout(800);
    const nunoNow = await leader();
    check('con otro nombre sí, y el segundo llega con 10 de oro, no con 100 (D-J11)',
        freed.hidden && freed.on && nuno && nunoNow?.gold === 10, JSON.stringify({ freed, nunoNow }));

    // Iria se queda herida en el gremio y pasan cuatro días.
    const rested = await page.evaluate(async (world) => {
        const wi = await import('/scripts/world-info.js');
        const data = await wi.loadWorldInfo(world);
        data.metadata.hubHeroes = (data.metadata.hubHeroes ?? []).map((/** @type {any} */ h) => (h.name === 'Iria' ? { ...h, hp: 3 } : h));
        await wi.saveWorldInfo(world, data, true);
        const ctx = window.SillyTavern.getContext();
        const calendar = ctx.chatMetadata.calendar ?? {};
        ctx.chatMetadata.calendar = { ...calendar, day: (Number(calendar.day) || 1) + 4 };
        await ctx.saveMetadata();
        return (data.metadata.hubHeroes ?? []).map((/** @type {any} */ h) => ({ name: h.name, hp: h.hp, restDay: h.restDay }));
    }, hubWorld);
    await dropToasts();
    await openBoard();
    await page.locator('.hb-root .hb-heroes .hb-hero[data-hero]').filter({ hasText: 'Iria' }).click();
    const iriaBack = await until(async () => (await leader())?.name === 'Iria', 30000);
    let told = '';
    await until(async () => /ha descansado/.test(told = await toastText()), 10000);
    const iriaNow = await leader();
    check('Iria vuelve del gremio curada por los cuatro días, y se dice (D-J12)',
        iriaBack && iriaNow?.hp === iriaNow?.maxHp && /Iria ha descansado 4 días en el gremio: vuelve con la vida entera\./.test(told),
        JSON.stringify({ rested, iriaNow, told }));
    await page.locator('.hb-root .hb-close').click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);

    // 10. D-J35: en otro gremio tuyo, tu campaña también está. Y allí «Iria» sí vale (D-J14).
    await dropToasts();
    await page.evaluate(() => { void import('/scripts/campaigns.js').then(m => m.startHubGame()); });
    // Con personajes en otro gremio, antes se ofrece traer a uno de ellos: aquí, uno nuevo.
    await page.waitForSelector('.hc-root, .vt-root .vt-card.vt-new', { timeout: 120000 });
    if (await page.locator('.vt-root .vt-card.vt-new').count() > 0) await page.locator('.vt-root .vt-card.vt-new').click();
    await page.waitForSelector('.hc-root', { timeout: 60000 });
    await pickHeroCard(page, 'race', 'Humano');
    await pickHeroCard(page, 'class', 'Guerrero');
    await page.fill('.hc-root .hc-name', 'Iria');
    await page.waitForTimeout(300);
    const otherOk = await page.evaluate(() => /** @type {HTMLButtonElement|null} */ (document.querySelector('.hc-root .hc-enter'))?.disabled === false);
    await page.locator('.hc-root .hc-enter').click();
    const inOther = await until(async () => {
        const now = await state();
        return /Gremio/.test(now.world) && now.world !== hubWorld && now.party.length === 1;
    }, 60000);
    await until(async () => (await chips()).some(c => /^Saltar la prueba$/.test(c)), 20000);
    await clickChip(/^Saltar la prueba$/);
    await page.waitForSelector('.popup:has-text("¿Saltar la prueba?")', { timeout: 10000 }).catch(() => {});
    await page.locator('.popup-button-ok:visible').first().click({ timeout: 5000 }).catch(() => {});
    await until(() => chatHas(/apunta tu nombre en el libro del gremio/), 15000);
    const otherBoard = await openBoard();
    tiles = await boardTiles();
    const there = tiles.find(t => t.id === ID);
    check('en un gremio nuevo, «Iria» vale otra vez, y tu campaña está en su tablón, sin empezar (D-J35, D-J14)',
        otherOk && inOther && otherBoard && /Sin empezar/.test(there?.text ?? '') && !tiles.some(t => t.id === HIGH_ID),
        JSON.stringify({ otherOk, inOther, ids: tiles.map(t => t.id), there }));
    if (SHOT) await page.screenshot({ path: `${SHOT}.otro-gremio.png` });
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
