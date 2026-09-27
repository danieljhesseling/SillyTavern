#!/usr/bin/env node
/**
 * Un recorrido corto: empezar una partida en 1387 desde el título («Partida nueva», un mundo
 * hecho, un modo y un héroe hecho), de punta a punta, contra un servidor propio con un
 * `--dataRoot` temporal, como `e2e-campaign.mjs`.
 *
 * El recorrido grande tarda una hora: para mirar solo esto, esto. Dice lo que pasa en cada
 * paso, no solo si sale.
 *
 * Uso:
 *   node tools/e2e-quick.mjs                   # sin ventana
 *   node tools/e2e-quick.mjs --headed          # mirándolo
 *   node tools/e2e-quick.mjs --profundidad     # y la tanda de profundidad (altura, salidas, tregua…)
 *   node tools/e2e-quick.mjs --captura a.png   # y una captura del título
 */

/* global window, document */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const PORT = 8124;
const BASE = `http://127.0.0.1:${PORT}`;
const HEADED = process.argv.includes('--headed');

const require = createRequire(join(ROOT, 'tests/package.json'));
const { chromium } = require('@playwright/test');

let failures = 0;
const check = (/** @type {string} */ name, /** @type {boolean} */ ok, detail = '') => {
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        -> ${detail}` : ''}`);
};

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-quick-'));
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
    page.on('pageerror', e => problems.push(`PAGEERROR ${e.message}`));
    page.on('console', m => {
        if (m.type() === 'error' && !/Failed to load resource.*404/.test(m.text())) problems.push(`ERROR ${m.text().slice(0, 300)}`);
    });
    await context.addInitScript(() => {
        try {
            window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,combat,travel,prisoners,mesa,high,spell,pet,bill');
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
        } catch { /* nada */ }
    });
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    const firstRun = page.locator('text=Welcome to SillyTavern!');
    if (await firstRun.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#game-shell', { timeout: 90000 });
    await page.waitForTimeout(1500);

    const newGame = page.locator('.gs-menu-btn').filter({ hasText: 'Partida nueva' });
    check('el título ofrece empezar una partida nueva', await newGame.count() === 1);
    // UX: el título no enseña la cabecera de la partida; el escenario ocupa el alto y el pie
    // se queda abajo (sin cabecera, la rejilla pierde una fila).
    const title = await page.evaluate(() => {
        const box = (/** @type {string} */ sel) => {
            const el = document.querySelector(sel);
            const r = el?.getBoundingClientRect();
            return r ? { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) } : null;
        };
        const head = document.querySelector('#game-shell .gs-head');
        return {
            scene: document.querySelector('#game-shell')?.getAttribute('data-scene'),
            headShown: Boolean(head && window.getComputedStyle(head).display !== 'none'),
            stage: box('#game-shell .gs-stage'),
            footer: box('#game-shell .gs-actions'),
            menu: box('#game-shell .gs-menu'),
            viewport: window.innerHeight,
        };
    });
    const centro = await page.evaluate(() => {
        const menu = document.querySelector('#game-shell .gs-menu')?.getBoundingClientRect();
        const title = document.querySelector('#game-shell .gs-title');
        const tr = title?.getBoundingClientRect();
        return {
            gap: menu && tr ? Math.round((window.innerHeight - menu.bottom) - tr.top) : null,
            color: title ? window.getComputedStyle(title).color : '',
        };
    });
    check('en el título, el rótulo en dorado y el menú en el centro de la pantalla',
        centro.gap !== null && Math.abs(centro.gap) <= 80 && /226, 194, 122/.test(centro.color), JSON.stringify(centro));
    check('el título no enseña la cabecera, y el menú ocupa la pantalla con el pie abajo',
        title.scene === 'title' && !title.headShown && (title.stage?.top ?? 99) <= 1
        && Math.abs((title.footer?.bottom ?? 0) - title.viewport) <= 1 && (title.stage?.height ?? 0) > title.viewport * 0.8,
        JSON.stringify(title));
    if (process.argv.includes('--captura')) await page.screenshot({ path: process.argv[process.argv.indexOf('--captura') + 1] || 'titulo.png' });

    // UX: Localidades, la lista y la ficha lado a lado (maestro-detalle), en la pantalla más
    // pequeña que se admite, 1280×720. Por «Desde cero», que es donde se escriben: un mundo
    // hecho las trae escritas. Se cancela al acabar, sin crear nada.
    await page.setViewportSize({ width: 1280, height: 720 });
    await newGame.first().click();
    await page.waitForSelector('.tl-door-grid', { timeout: 20000 });
    await page.locator('.tl-door-card').nth(0).click();
    await page.waitForSelector('.tl-root', { timeout: 20000 });
    await page.locator('.tl-tab[data-step="localidades"]').click();
    await page.waitForTimeout(500);
    const sitiosAntes = await page.locator('.tl-list .tl-card').count();
    for (let i = 0; i < 3; i++) {
        await page.locator('.tl-toolbar .tl-add').click();
        await page.waitForTimeout(250);
    }
    // El nombre, letra a letra: cada letra redibuja la tarjeta, y el cursor no se sale.
    await page.locator('.tl-detail .tl-field[data-key="lName"] .tl-input').click();
    await page.keyboard.type('Mirador de prueba', { delay: 25 });
    await page.waitForTimeout(300);
    await page.locator('.tl-detail-foot .tl-action.danger').hover();
    await page.waitForTimeout(300);
    const md = await page.evaluate(() => {
        const r = (/** @type {string} */ sel) => {
            const b = document.querySelector(sel)?.getBoundingClientRect();
            return b ? { left: Math.round(b.left), right: Math.round(b.right), top: Math.round(b.top), bottom: Math.round(b.bottom) } : null;
        };
        const scroller = /** @type {HTMLElement|null} */ (document.querySelector('.tl-list-scroll'));
        const open = document.querySelector('.tl-list .tl-card.open');
        const oa = open?.getBoundingClientRect();
        const sb = scroller?.getBoundingClientRect();
        const list = r('.tl-list');
        const detail = r('.tl-detail');
        const popup = r('.popup:has(.tl-root)');
        const drop = document.querySelector('.tl-detail-foot .tl-action.danger');
        const seen = {
            cards: document.querySelectorAll('.tl-list .tl-card').length,
            sideBySide: Boolean(list && detail && list.right <= detail.left && Math.abs(list.top - detail.top) < 60),
            inside: Boolean(popup && detail && detail.bottom <= popup.bottom && detail.right <= popup.right),
            scrolls: Boolean(scroller && scroller.scrollHeight > scroller.clientHeight),
            openVisible: Boolean(oa && sb && oa.top >= sb.top - 1 && oa.bottom <= sb.bottom + 1),
            typed: /** @type {HTMLInputElement|null} */ (document.querySelector('.tl-detail .tl-field[data-key="lName"] .tl-input'))?.value || '',
            openTitle: open?.querySelector('.tl-card-title')?.textContent || '',
            drop: (drop?.textContent || '').trim(),
            dropHover: drop ? window.getComputedStyle(drop).color : '',
            detailStill: false,
            addStill: false,
        };
        if (scroller) {
            scroller.scrollTop = 0;
            const top = JSON.stringify([r('.tl-detail'), r('.tl-toolbar .tl-add')]);
            scroller.scrollTop = scroller.scrollHeight;
            const bottom = JSON.stringify([r('.tl-detail'), r('.tl-toolbar .tl-add')]);
            seen.detailStill = top === bottom;
            seen.addStill = top === bottom && Boolean(r('.tl-toolbar .tl-add'));
        }
        return seen;
    });
    check('Localidades a 1280×720: lista y ficha lado a lado; la lista se mueve sola, la ficha y «Nuevo sitio» no; el nuevo se ve y se escribe de un tirón',
        md.cards === sitiosAntes + 3 && md.sideBySide && md.inside && md.scrolls && md.openVisible
        && md.detailStill && md.addStill && md.typed === 'Mirador de prueba' && md.openTitle === 'Mirador de prueba'
        && /Quitar este sitio/.test(md.drop) && md.dropHover === 'rgb(255, 255, 255)', JSON.stringify(md));
    await page.locator('.tl-detail-foot .tl-action.danger').click();
    await page.waitForTimeout(300);
    const trasQuitar = await page.locator('.tl-list .tl-card').count();
    // Los filtros: por dónde está cada sitio. Quedan puestos al abrir uno.
    const pildoras = await page.locator('.tl-pill').count();
    /** @type {any} */
    let filtro = null;
    if (pildoras >= 3) {
        await page.locator('.tl-pill').nth(1).click();
        await page.waitForTimeout(200);
        const want = await page.locator('.tl-pill.on').getAttribute('data-tag');
        await page.locator('.tl-list .tl-card:not(.tl-hidden):not(.add)').first().click();
        await page.waitForTimeout(300);
        filtro = await page.evaluate((/** @type {string|null} */ tag) => {
            const shown = [...document.querySelectorAll('.tl-list .tl-card:not(.tl-hidden)')];
            return {
                tag, still: document.querySelector('.tl-pill.on')?.getAttribute('data-tag') === tag,
                shown: shown.length, all: document.querySelectorAll('.tl-list .tl-card').length,
                same: shown.every(c => c.getAttribute('data-tag') === tag),
                open: document.querySelector('.tl-detail-title')?.textContent || '',
            };
        }, want);
    }
    check('quitar un sitio lo quita de la lista; los filtros dejan solo los de ese sitio y siguen puestos al abrir uno',
        trasQuitar === sitiosAntes + 2 && (pildoras === 0 || Boolean(filtro?.still && filtro.same && filtro.shown > 0 && filtro.shown < filtro.all && filtro.open)),
        JSON.stringify({ trasQuitar, sitiosAntes, pildoras, filtro }));
    if (process.argv.includes('--captura')) {
        const base = process.argv[process.argv.indexOf('--captura') + 1] || 'titulo.png';
        await page.screenshot({ path: `${base}.localidades.png` });
        // Y las otras pestañas con lista y ficha, con algo abierto.
        for (const [tab, pick] of [['tableros', '.tl-list .tl-card.add'], ['bestiario', '.tl-list .tl-card:not(.add)'], ['misiones', '']]) {
            await page.locator(`.tl-tab[data-step="${tab}"]`).click();
            await page.waitForTimeout(500);
            if (pick) await page.locator(pick).first().click({ timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(300);
            await page.screenshot({ path: `${base}.${tab}.png` });
        }
    }
    await page.locator('.tl-foot .tl-cancel').click();
    await page.waitForSelector('.tl-root', { state: 'detached', timeout: 10000 });
    await page.setViewportSize({ width: 1400, height: 950 });
    await page.waitForTimeout(800);

    // «Partida nueva» → «Un mundo hecho» → 1387, como lo haría quien juega.
    await newGame.first().click();
    await page.waitForSelector('.tl-door-grid', { timeout: 20000 });
    // UX: las tres puertas en una fila, altas, y la de encima se nota.
    await page.waitForTimeout(400);
    await page.locator('.tl-door-card').nth(1).hover();
    await page.waitForTimeout(350);
    const door = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('.tl-door-card')].map(c => c.getBoundingClientRect());
        const hovered = document.querySelectorAll('.tl-door-card')[1];
        return {
            titles: [...document.querySelectorAll('.tl-door-card-title')].map(t => (t.textContent || '').trim()),
            tops: cards.map(r => Math.round(r.top)), heights: cards.map(r => Math.round(r.height)),
            hoverBorder: hovered ? window.getComputedStyle(hovered).borderTopColor : '',
        };
    });
    check('las tres puertas van en una fila, altas, y la de encima se ilumina en dorado',
        door.titles.join(' | ') === 'Desde cero | Un mundo hecho | Importar un libro'
        && Math.max(...door.tops) - Math.min(...door.tops) <= 6 && door.heights.every(h => h >= 180)
        && /226, 194, 122/.test(door.hoverBorder), JSON.stringify(door));
    if (process.argv.includes('--captura')) await page.screenshot({ path: `${process.argv[process.argv.indexOf('--captura') + 1] || 'titulo.png'}.puertas.png` });
    await page.locator('.tl-door-card').nth(1).click();
    await page.waitForSelector('.tl-root', { timeout: 20000 });
    await page.locator('.tl-card', { hasText: '1387' }).first().click();
    // El paquete se carga después de elegir: se espera a que el aviso de carga se vaya.
    const loaded = await page.waitForFunction(() => !/Cargando el mundo/.test(document.querySelector('.tl-said')?.textContent || ''), null, { timeout: 20000 }).then(() => true).catch(() => false);
    const said = await page.evaluate(() => document.querySelector('.tl-said')?.textContent || '');
    check('el paquete de 1387 se carga', loaded && !/no se ha podido cargar/.test(said), said);
    // UX: el taller a dos columnas, la ficha fija y la semilla con su dado en la misma línea.
    await page.waitForTimeout(500);
    const taller = await page.evaluate(() => {
        const tabs = [...document.querySelectorAll('.tl-tab')].map(t => t.getBoundingClientRect());
        const seed = document.querySelector('.tl-input-group > .tl-input')?.getBoundingClientRect();
        const dice = document.querySelector('.tl-input-group > .tl-reroll')?.getBoundingClientRect();
        const body = document.querySelector('.tl-body')?.getBoundingClientRect();
        return {
            tabs: tabs.length,
            column: tabs.length > 0 && tabs.every(r => Math.abs(r.left - tabs[0].left) < 2) && tabs.every((r, i) => i === 0 || r.top > tabs[i - 1].top),
            sideOfBody: Boolean(body && tabs[0] && tabs[0].right <= body.left),
            detail: document.querySelectorAll('.tl-body .tl-detail .tl-form').length,
            seedRow: Boolean(seed && dice && Math.abs(seed.top - dice.top) < 4),
            cancelInFoot: document.querySelectorAll('.tl-foot > .tl-cancel').length,
            popupControls: [...document.querySelectorAll('.popup:not([closing]) .popup-controls')].filter(e => /** @type {HTMLElement} */ (e).offsetParent !== null).length,
        };
    });
    check('el taller va a dos columnas: pestañas a la izquierda, la ficha al lado, semilla y dado en una línea, y Cancelar en el pie',
        taller.tabs === 13 && taller.column && taller.sideOfBody && taller.detail === 1 && taller.seedRow && taller.cancelInFoot === 1 && taller.popupControls === 0,
        JSON.stringify(taller));
    // UX: la pestaña del narrador, con sus grupos y sin desplegable; eligiendo uno se ve su ficha.
    await page.locator('.tl-tab[data-step="narrador"]').click();
    await page.waitForTimeout(400);
    await page.locator('.tl-card', { hasText: /cronista/i }).first().click();
    await page.waitForTimeout(500);
    const narrator = await page.evaluate(() => ({
        groups: [...document.querySelectorAll('.tl-cards-group')].map(g => (g.textContent || '').trim()),
        folds: document.querySelectorAll('.tl-body .tl-fold').length,
        detail: document.querySelectorAll('.tl-body .tl-detail .tl-form').length,
        file: document.querySelectorAll('.tl-body input[type="file"].tl-file').length,
    }));
    check('el narrador: tarjetas sin desplegable, «De serie» aparte, y su ficha al lado al elegirlo',
        narrator.groups[0] === 'De serie' && narrator.folds === 0 && narrator.detail === 1 && narrator.file === 1, JSON.stringify(narrator));
    if (process.argv.includes('--captura')) await page.screenshot({ path: `${process.argv[process.argv.indexOf('--captura') + 1] || 'titulo.png'}.narrador.png` });
    await page.locator('.tl-tab[data-step="mundo"]').click();
    await page.waitForTimeout(400);
    if (process.argv.includes('--captura')) {
        await page.screenshot({ path: `${process.argv[process.argv.indexOf('--captura') + 1] || 'titulo.png'}.mundo.png` });
        // Y en una pantalla grande, que es donde sobraba hueco a los lados.
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${process.argv[process.argv.indexOf('--captura') + 1] || 'titulo.png'}.ancho.png` });
        await page.setViewportSize({ width: 1400, height: 950 });
        await page.waitForTimeout(400);
        await page.evaluate(() => document.querySelector('.tl-input-group')?.scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${process.argv[process.argv.indexOf('--captura') + 1] || 'titulo.png'}.ficha.png` });
        console.log('semilla:', JSON.stringify(await page.evaluate(() => {
            const r = (/** @type {string} */ s) => { const b = document.querySelector(s)?.getBoundingClientRect(); return b ? [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)] : null; };
            return { group: r('.tl-input-group'), input: r('.tl-input-group > .tl-input'), dice: r('.tl-input-group > .tl-reroll') };
        })));
    }
    // El modo, en su pestaña. Si algo la tapa, se dice qué.
    const tabError = await page.locator('.tl-tab[data-step="jugabilidad"]').click({ timeout: 8000 })
        .then(() => '').catch((/** @type {any} */ err) => String(err?.message || err).replace(/\s+/g, ' ').slice(0, 400));
    if (tabError) {
        const blocked = await page.evaluate(() => {
            const tab = document.querySelector('.tl-tab[data-step="jugabilidad"]');
            const r = tab?.getBoundingClientRect();
            const over = r ? document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) : null;
            return {
                tabs: [...document.querySelectorAll('.tl-tab')].map(t => t.getAttribute('data-step')),
                rect: r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] : null,
                over: over ? `${over.tagName}.${String(over.className).slice(0, 80)}` : '',
                popups: [...document.querySelectorAll('dialog[open]')].map(d => (d.textContent || '').replace(/\s+/g, ' ').slice(0, 100)),
            };
        });
        console.log('pestaña:', tabError, JSON.stringify(blocked));
    }
    await page.waitForTimeout(300);
    if (process.argv.includes('--captura')) await page.screenshot({ path: `${process.argv[process.argv.indexOf('--captura') + 1] || 'titulo.png'}.taller.png` });
    await page.locator('.tl-root .md-card[data-mode="relajado"]').click();
    await page.waitForTimeout(300);
    // UX: los botones del pie, en una línea (antes «Crear y jugar» se partía en tres).
    const foot = await page.evaluate(() => [...document.querySelectorAll('.tl-foot > .menu_button')]
        .filter(b => /** @type {HTMLElement} */ (b).offsetParent !== null)
        .map(b => ({ text: (b.textContent || '').trim(), height: Math.round(b.getBoundingClientRect().height) })));
    check('los botones del pie del taller van en una línea', foot.length > 0 && foot.every(b => b.height <= 44), JSON.stringify(foot));
    // En la última pestaña, «Siguiente» ya es «Crear y jugar» (el otro botón se oculta).
    await page.locator('.tl-next').click();

    await page.waitForSelector('.popup:visible .vt-premade', { timeout: 180000 });
    const premade = await page.evaluate(() => [...document.querySelectorAll('.popup:not([closing]) .vt-premade')].map(b => (b.getAttribute('aria-label') || b.textContent || '').trim()));
    check('se ofrecen tres héroes hechos', premade.length === 3, JSON.stringify(premade));
    // UX: quién entra, en tarjetas que se pulsan: los tres y «Uno nuevo» en una fila, sin
    // botones al pie, y la de encima se enciende en dorado.
    await page.waitForTimeout(500);
    await page.locator('.popup:visible .vt-premade').nth(1).hover();
    await page.waitForTimeout(300);
    const entra = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('.popup:not([closing]) .vt-grid:not(.vt-small) > .vt-card')].map(c => c.getBoundingClientRect());
        const hovered = document.querySelectorAll('.popup:not([closing]) .vt-premade')[1];
        return {
            cards: cards.length,
            row: cards.length > 0 && Math.max(...cards.map(r => r.top)) - Math.min(...cards.map(r => r.top)) <= 4,
            controls: [...document.querySelectorAll('.popup:not([closing]) .popup-controls')].filter(e => /** @type {HTMLElement} */ (e).offsetParent !== null).length,
            hoverBorder: hovered ? window.getComputedStyle(hovered).borderTopColor : '',
            first: document.querySelector('.popup:not([closing]) .vt-premade .vt-name')?.textContent || '',
        };
    });
    check('quién entra: los tres y «Uno nuevo» en tarjetas, en una fila, sin botones al pie; la de encima en dorado',
        entra.cards === 4 && entra.row && entra.controls === 0 && /226, 194, 122/.test(entra.hoverBorder) && entra.first === 'Ulrich Brand', JSON.stringify(entra));
    if (process.argv.includes('--captura')) await page.screenshot({ path: `${process.argv[process.argv.indexOf('--captura') + 1] || 'titulo.png'}.heroes.png` });
    await page.waitForTimeout(800);
    let clickError = '';
    for (let i = 0; i < 3 && await page.locator('.popup:visible .vt-premade').count() > 0; i++) {
        clickError = await page.locator('.popup:visible .vt-premade').first().click({ timeout: 8000 }).then(() => '').catch(err => String(err?.message || err).slice(0, 900));
        await page.waitForTimeout(1200);
    }
    const box = await page.evaluate(() => {
        const button = /** @type {HTMLElement|null} */ (document.querySelector('.popup:not([closing]) .vt-premade'));
        const r = button?.getBoundingClientRect();
        const over = r ? document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) : null;
        return { rect: r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] : null, over: over ? `${over.tagName}.${String(over.className).slice(0, 60)}` : '', result: button?.dataset.result ?? '' };
    });
    console.log('clic:', clickError || 'ok', JSON.stringify(box));
    for (let i = 0; i < 12; i++) {
        await page.waitForTimeout(1000);
        const t = await page.evaluate(async () => {
            const ctx = window.SillyTavern.getContext();
            const party = (await import('/scripts/party.js')).getPartyMembersSnapshot();
            return {
                chat: ctx.getCurrentChatId?.() ?? null,
                party: party.map((/** @type {any} */ m) => m.name),
                meta: (ctx.chatMetadata?.party || []).map((/** @type {any} */ m) => m.name),
                popups: [...document.querySelectorAll('dialog[open]')].map(d => (d.textContent || '').replace(/\s+/g, ' ').slice(0, 40)),
            };
        });
        console.log(`t+${i + 1}s`, JSON.stringify(t));
    }

    // Se sondea a mano: `waitForFunction` con una función async recibe una promesa, que
    // siempre cuenta como verdadera, y no esperaba nada.
    let state = null;
    for (let i = 0; i < 60 && !state; i++) {
        state = await page.evaluate(async () => ((await import('/scripts/party.js')).getPartyMembersSnapshot())[0]?.name || null).catch(() => null);
        if (!state) await page.waitForTimeout(500);
    }
    const after = await page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const { getActiveRuleset } = await import('/scripts/game-engine/rules/ruleset.js');
        const { modeOf } = await import('/scripts/game-engine/rules/modes.js');
        const party = (await import('/scripts/party.js')).getPartyMembersSnapshot();
        return {
            world: ctx.chatMetadata?.world_info ?? null,
            chatId: ctx.getCurrentChatId?.() ?? null,
            location: ctx.chatMetadata?.currentLocation ?? null,
            board: ctx.chatMetadata?.currentBoard ?? null,
            mode: modeOf(getActiveRuleset()?.survival ?? null),
            packSurvival: (await (await import('/scripts/world-info.js')).loadWorldInfo(String(ctx.chatMetadata?.world_info || '')))?.metadata?.rulesetPack?.survival ?? null,
            remembered: (() => { try { return JSON.parse(window.localStorage.getItem('sillytavern_activeRulesetPack') || 'null')?.survival ?? 'sin'; } catch { return 'err'; } })(),
            party: party.map((/** @type {any} */ m) => ({ name: m.name, abilities: m.abilities })),
            toasts: [...document.querySelectorAll('#toast-container .toast')].map(t => (t.textContent || '').trim()).slice(0, 6),
            popups: [...document.querySelectorAll('dialog[open]')].map(d => (d.textContent || '').replace(/\s+/g, ' ').slice(0, 120)),
        };
    });
    check('se juega con Ulrich Brand, en Relajado, en el mundo de 1387', state === 'Ulrich Brand' && after.mode === 'relajado' && /Barro|Vane/.test(String(after.location)), JSON.stringify({ state, ...after }));
    // UX: se empieza leyendo al narrador, no plantado en el tablero. La columna del mapa solo
    // sale si hay algo dibujado; y las fichas de acción se encienden en dorado.
    await page.waitForTimeout(800);
    const chipAt = page.locator('#game-shell .gs-chip-action').first();
    if (await chipAt.count() > 0) await chipAt.hover().catch(() => {});
    await page.waitForTimeout(300);
    const dialogo = await page.evaluate(() => {
        const root = document.querySelector('#game-shell');
        const map = document.querySelector('#game-shell .gs-scene-map');
        const chip = document.querySelector('#game-shell .gs-chip-action');
        const talk = document.querySelector('#game-shell .gs-scene-dialogue')?.getBoundingClientRect();
        return {
            scene: root?.getAttribute('data-scene') || '',
            drawn: Boolean(map?.querySelector('.wm-container')),
            mapShown: Boolean(map && window.getComputedStyle(map).display !== 'none'),
            chipHover: chip ? window.getComputedStyle(chip).borderTopColor : '(sin fichas)',
            chatWidth: talk ? Math.round(talk.width) : 0,
        };
    });
    check('se empieza en Diálogo; la columna del mapa solo con algo dibujado; las fichas en dorado al pasar',
        dialogo.scene === 'dialogue' && dialogo.mapShown === dialogo.drawn
        && (dialogo.chipHover === '(sin fichas)' || /226, 194, 122/.test(dialogo.chipHover)), JSON.stringify(dialogo));
    // UX: el tablero se ve (la cuadrícula tiene alto) y nada ensancha la página, a 1400 y a
    // 1920. La cabecera en una fila medía casi 2000 px y sacaba el chat por la derecha; y la
    // cuadrícula medía 2 px porque el alto no llegaba hasta ella.
    const captura = process.argv.includes('--captura') ? (process.argv[process.argv.indexOf('--captura') + 1] || 'titulo.png') : '';
    const probe = () => page.evaluate(() => {
        const box = document.querySelector('#game-shell .gs-scene-map .wm-container');
        const r = box?.getBoundingClientRect();
        return {
            scene: document.querySelector('#game-shell')?.getAttribute('data-scene') || '',
            grid: r ? [Math.round(r.width), Math.round(r.height)] : null,
            pageWidth: document.documentElement.scrollWidth,
            viewport: window.innerWidth,
        };
    });
    // UX: la cabecera en dos filas; la fecha de arriba a la izquierda, fuera (la dice el
    // reloj); los botones (diario, mesa…), abajo a la derecha.
    const cabecera = await page.evaluate(() => {
        const r = (/** @type {string} */ s) => document.querySelector(s)?.getBoundingClientRect();
        const state = document.querySelector('#game-shell .gs-head-state');
        const tools = r('#game-shell .gs-tools');
        const scenes = r('#game-shell .gs-scenes');
        const head = r('#game-shell .gs-head');
        return {
            stateShown: Boolean(state && window.getComputedStyle(state).display !== 'none'),
            toolsBelow: Boolean(tools && scenes && tools.top >= scenes.bottom - 2),
            toolsRight: Boolean(tools && head && head.right - tools.right < 40),
            journal: Boolean(document.querySelector('#game-shell .gs-tools .gs-journal')),
            active: document.querySelector('#game-shell .gs-scene-btn.active')?.textContent?.trim() || '',
            activeColor: (() => { const a = document.querySelector('#game-shell .gs-scene-btn.active'); return a ? window.getComputedStyle(a).color : ''; })(),
        };
    });
    // Y un aviso flotante cae por debajo de la cabecera, no encima de sus botones.
    await page.evaluate(() => { /** @type {any} */ (window).toastr?.info('Prueba de aviso', 'Aviso'); });
    await page.waitForTimeout(600);
    const aviso = await page.evaluate(() => {
        const toast = document.querySelector('body > #toast-container .toast');
        const head = document.querySelector('#game-shell .gs-head');
        return { toastTop: toast ? Math.round(toast.getBoundingClientRect().top) : null, headBottom: head ? Math.round(head.getBoundingClientRect().bottom) : null };
    });
    await page.evaluate(() => { /** @type {any} */ (window).toastr?.clear(); });
    check('un aviso flotante cae por debajo de la cabecera, sin tapar sus botones',
        aviso.toastTop !== null && aviso.headBottom !== null && aviso.toastTop >= aviso.headBottom, JSON.stringify(aviso));
    check('la cabecera: sin la fecha de arriba, los botones abajo a la derecha, y la escena abierta en dorado',
        !cabecera.stateShown && cabecera.toolsBelow && cabecera.toolsRight && cabecera.journal
        && /^Diálogo/.test(cabecera.active) && /226, 194, 122/.test(cabecera.activeColor), JSON.stringify(cabecera));
    // UX: las siete ventanas de la cabecera, con el mismo marco: mismo ancho, borde dorado,
    // título en dorado y el mismo botón de cerrar, sin el fondo carmesí.
    /** @type {any[]} */
    const ventanas = [];
    for (const tool of ['gs-journal', 'gs-table', 'gs-map', 'gs-glance', 'gs-tray', 'gs-dice', 'gs-help']) {
        const button = page.locator(`#game-shell .gs-tools .${tool}`);
        if (await button.count() === 0) {
            ventanas.push({ tool, missing: true });
            continue;
        }
        await button.click();
        const opened = await page.waitForSelector('.popup:not([closing]) .gs-panel', { timeout: 8000 }).then(() => true).catch(() => false);
        await page.waitForTimeout(300);
        ventanas.push(await page.evaluate((/** @type {string} */ name) => {
            const panel = document.querySelector('.popup:not([closing]) .gs-panel');
            const popup = panel?.closest('.popup');
            const title = panel?.querySelector('.gs-popup-title');
            const close = popup?.querySelector('.popup-button-ok');
            const css = (/** @type {Element|null|undefined} */ el, /** @type {string} */ prop) => el ? window.getComputedStyle(el).getPropertyValue(prop) : '';
            return {
                tool: name,
                width: popup ? Math.round(popup.getBoundingClientRect().width) : 0,
                border: css(popup, 'border-top-color'),
                title: css(title, 'color'),
                closeBg: css(close, 'background-color'),
                closeText: (close?.textContent || '').trim(),
            };
        }, tool).then(v => ({ ...v, opened })));
        if (captura && tool === 'gs-journal') await page.screenshot({ path: `${captura}.diario.png` });
        await page.locator('.popup:not([closing]) .popup-button-ok').last().click().catch(() => {});
        await page.waitForTimeout(400);
    }
    const anchos = new Set(ventanas.filter(v => !v.missing).map(v => v.width));
    check('las ventanas de la cabecera, con el mismo marco: mismo ancho, borde y título dorados, y Cerrar sin el fondo carmesí',
        ventanas.filter(v => !v.missing).length >= 6 && anchos.size === 1
        && ventanas.filter(v => !v.missing).every(v => v.opened && /214, 180, 106/.test(v.border) && /226, 194, 122/.test(v.title)
            && /rgba\(0, 0, 0, 0\)|transparent/.test(v.closeBg) && v.closeText === 'Cerrar'),
        JSON.stringify(ventanas));
    const seen = { dialogue: await probe() };
    if (captura) await page.screenshot({ path: `${captura}.dialogo.png` });
    await page.evaluate(() => /** @type {HTMLElement|null} */ (document.activeElement)?.blur());
    await page.keyboard.press('3');
    await page.waitForTimeout(900);
    seen.board = await probe();
    if (captura) await page.screenshot({ path: `${captura}.tablero.png` });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(700);
    seen.wide = await probe();
    if (captura) await page.screenshot({ path: `${captura}.tablero-ancho.png` });
    await page.setViewportSize({ width: 1400, height: 950 });
    await page.waitForTimeout(400);
    await page.keyboard.press('1');
    await page.waitForTimeout(500);
    check('el tablero se ve, en Diálogo y en el Tablero (la cuadrícula con alto), y nada se sale por la derecha a 1400 ni a 1920',
        [seen.dialogue, seen.board, seen.wide].every(s => s.grid && s.grid[1] >= 200 && s.pageWidth <= s.viewport)
        && seen.board.scene === 'combat', JSON.stringify(seen));
    // K2: la tanda de profundidad (B1, B2, H2, T1, B3, T2) sobre la partida recién empezada.
    // `node tools/e2e-quick.mjs --profundidad`. Cada comando lleva tope: si se cuelga, se dice cuál.
    if (process.argv.includes('--profundidad')) await depthRound(page);

    console.log('\n--- problemas ---');
    console.log(problems.length ? problems.join('\n') : '(ninguno)');
} catch (error) {
    failures++;
    console.log(`FAIL  the run threw: ${/** @type {any} */ (error)?.message || error}`);
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
console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);

/**
 * La tanda de profundidad: lo nuevo de LO_QUE_FALTA, en el tablero de la posada de 1387.
 *
 * @param {any} page
 */
async function depthRound(page) {
    /** Un comando, con tope: si en 20 s no vuelve, dice qué ventanas hay abiertas y pulsa Escape. */
    const slash = async (/** @type {string} */ command) => {
        const done = page.evaluate((c) => window.SillyTavern.getContext().executeSlashCommandsWithOptions(c).then(() => 'ok').catch((/** @type {any} */ e) => `error: ${e?.message || e}`), command);
        const said = await Promise.race([done, new Promise(resolve => setTimeout(() => resolve('timeout'), 20000))]);
        if (said === 'timeout') {
            const open = await page.evaluate(() => [...document.querySelectorAll('dialog[open]')].map(d => (d.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160)));
            console.log(`WAIT  «${command}» no vuelve: ${JSON.stringify(open)}. Se pulsa Escape.`);
            await page.keyboard.press('Escape').catch(() => {});
            await page.keyboard.press('Escape').catch(() => {});
        }
        await page.waitForTimeout(700);
        return said;
    };
    const clearDice = async () => {
        for (let i = 0; i < 40; i++) {
            const next = page.locator('.wm-dice-overlay.active .wm-dice-next');
            if (await next.count() === 0) return;
            await next.click({ timeout: 4000 }).catch(() => {});
            await page.waitForTimeout(250);
        }
    };
    const clearToasts = () => page.evaluate(() => document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));
    const lastLine = (/** @type {RegExp} */ pattern) => page.evaluate((source) => (window.SillyTavern.getContext().chat || [])
        .map((/** @type {any} */ m) => String(m.mes || '')).filter(t => new RegExp(source, 'u').test(t)).pop() || '', pattern.source);
    const whoseTurn = () => page.evaluate(async () => {
        const enc = (await import('/scripts/party.js')).getCombatEncounter();
        const entry = enc?.turnOrder?.[enc?.currentTurnIndex];
        return !enc?.active ? 'over' : (entry?.isEnemy ? 'enemy' : 'player');
    });
    const toPlayer = async () => {
        for (let i = 0; i < 12; i++) {
            const who = await whoseTurn();
            if (who !== 'enemy') return who;
            await slash('/combat-end');
            await clearDice();
        }
        return 'enemy';
    };
    /** El tablero vivo, y pintar en él. */
    const paint = (/** @type {string} */ type, /** @type {'turn'|'all'|{x: number, y: number}} */ where) => page.evaluate(async ({ type, where }) => {
        const party = await import('/scripts/party.js');
        const wi = await import('/scripts/world-info.js');
        const ctx = window.SillyTavern.getContext();
        const enc = party.getCombatEncounter();
        const place = wi.getCurrentWorldLocationMaps().find((/** @type {any} */ l) => l.name === ctx.chatMetadata.currentLocation);
        const board = (place?.boards || []).find((/** @type {any} */ b) => b.name === ctx.chatMetadata.currentBoard);
        if (!board) return null;
        board.terrain = board.terrain && typeof board.terrain === 'object' ? board.terrain : { version: 1, cells: {} };
        board.terrain.cells = board.terrain.cells || {};
        if (typeof where === 'object') {
            board.terrain.cells[`${where.x},${where.y}`] = { type };
            return [];
        }
        const current = String(enc?.turnOrder?.[enc?.currentTurnIndex]?.id ?? '');
        const fighting = (enc?.turnOrder || []).filter((/** @type {any} */ t) => !t.isEnemy).map((/** @type {any} */ t) => String(t.id));
        const members = party.getPartyMembersSnapshot().filter((/** @type {any} */ m) => (m.hp || 0) > 0 && !m.dead
            && (where === 'all' ? fighting.includes(String(m.id)) : String(m.id) === current));
        for (const m of members) board.terrain.cells[`${m.mapPosition?.gridX},${m.mapPosition?.gridY}`] = { type };
        return members.sort((a, b) => Number(String(a.id) === current) - Number(String(b.id) === current)).map((/** @type {any} */ m) => m.name);
    }, { type, where });

    console.log('\n=== Profundidad: B1, B2, H2, T1, B3, T2 ===');
    await clearToasts();
    // Un guardia pegado al héroe.
    await slash('/fight Guardia de Montesclaros 1');
    await clearDice();
    await toPlayer();
    const placed = await page.evaluate(async () => {
        const party = await import('/scripts/party.js');
        const enc = party.getCombatEncounter();
        const entry = enc.turnOrder?.[enc.currentTurnIndex];
        const me = party.getPartyMembersSnapshot().find((/** @type {any} */ m) => String(m.id) === String(entry?.id));
        const foe = (enc.enemies || []).find((/** @type {any} */ e) => (e.currentHp || 0) > 0);
        if (!me || !foe) return null;
        foe.currentHp = 99;
        foe.maxHp = 99;
        foe.gridX = (Number(me.mapPosition?.gridX) || 0) + 1;
        foe.gridY = Number(me.mapPosition?.gridY) || 0;
        return { me: me.name, at: [me.mapPosition?.gridX, me.mapPosition?.gridY], foe: foe.name };
    });
    // B1: el héroe, en alto.
    await paint('high', 'turn');
    await slash(`/combat-attack ${placed?.foe ?? 'Guardia de Montesclaros 1'}`);
    await clearDice();
    const above = await lastLine(/ataca desde arriba/);
    check('B1: desde arriba se ataca con ventaja, y la tirada lo dice', Boolean(above), JSON.stringify({ placed, above: above.slice(0, 160) }));

    // B2: todos en una salida, y salen.
    await toPlayer();
    const out = await paint('exit', 'all');
    for (const name of out || []) {
        await slash(`/salir ${name}`);
        await clearDice();
    }
    const left = await lastLine(/^🚪 \[COMBAT\] /);
    const fled = await lastLine(/Os vais de .+ sin ganar el tablero/);
    check('B2: salen por la salida y la pelea acaba en huida', /el último/.test(left) && Boolean(fled) && await whoseTurn() === 'over', JSON.stringify({ out, left, fled: fled.slice(0, 120) }));

    // H2: «Cómo se juega».
    await clearToasts();
    void page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/ayuda'));
    await page.waitForSelector('.popup:not([closing]) .hp-root', { timeout: 8000 }).catch(() => {});
    const help = await page.evaluate(() => [...document.querySelectorAll('.popup:not([closing]) .hp-root .jr-title')].map(t => (t.textContent || '').trim()));
    await page.locator('.popup:visible .popup-button-ok').first().click({ timeout: 4000 }).catch(() => {});
    check('H2: /ayuda dice el modo y qué hacer si te pierdes', help.some(t => /^Tu modo: /.test(t)) && help.includes('Si te pierdes'), JSON.stringify(help));

    // T1 y B3: en combate, una palanca y una barricada junto a quien tiene el turno, y una
    // reja cerrada con llave. Cada cosa gasta la acción, así que entre una y otra se cierra el turno.
    await clearToasts();
    await slash('/fight Guardia de Montesclaros 1');
    await clearDice();
    await toPlayer();
    const spots = await page.evaluate(async () => {
        const party = await import('/scripts/party.js');
        const enc = party.getCombatEncounter();
        const entry = enc.turnOrder?.[enc.currentTurnIndex];
        const hero = party.getPartyMembersSnapshot().find((/** @type {any} */ m) => String(m.id) === String(entry?.id));
        const foe = (enc.enemies || []).find((/** @type {any} */ e) => (e.currentHp || 0) > 0);
        const x = Number(hero?.mapPosition?.gridX) || 0;
        const y = Number(hero?.mapPosition?.gridY) || 0;
        if (foe) { foe.currentHp = 99; foe.gridX = x + 3; foe.gridY = y; }
        return { lever: { x: x + 1, y }, barricade: { x, y: y + 1 } };
    });
    await paint('lever', spots.lever);
    await paint('barricade', spots.barricade);
    await paint('door', { x: 0, y: 0 });
    await page.evaluate(async () => {
        const wi = await import('/scripts/world-info.js');
        const ctx = window.SillyTavern.getContext();
        const place = wi.getCurrentWorldLocationMaps().find((/** @type {any} */ l) => l.name === ctx.chatMetadata.currentLocation);
        const board = (place?.boards || []).find((/** @type {any} */ b) => b.name === ctx.chatMetadata.currentBoard);
        board.terrain.cells['0,0'] = { type: 'door', open: false, locked: true };
    });
    // Se redibuja el tablero: lo pintado desde fuera no se ve hasta entonces.
    await page.evaluate(async () => (await import('/scripts/party.js')).refreshBoardView());
    await page.waitForTimeout(800);
    await clearToasts();
    // Qué hay de verdad en la casilla: si se dibuja, si responde y qué la tapa.
    const cellInfo = (/** @type {string} */ kind) => page.evaluate((k) => {
        const el = /** @type {HTMLElement|null} */ ([...document.querySelectorAll(`.wm-terrain-${k}`)].find(e => /** @type {HTMLElement} */ (e).offsetParent !== null) ?? null);
        if (!el) return { found: document.querySelectorAll(`.wm-terrain-${k}`).length, visible: false };
        const r = el.getBoundingClientRect();
        const over = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return { found: true, actionable: el.classList.contains('wm-terrain-door-actionable'), title: el.getAttribute('title'), rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width)], over: over ? `${over.tagName}.${String(over.className).slice(0, 70)}` : '' };
    }, kind);
    const leverCell = await cellInfo('lever');
    const clickLever = await page.locator('.wm-terrain-lever').filter({ visible: true }).first().click({ timeout: 6000 }).then(() => 'ok').catch((/** @type {any} */ e) => String(e?.message || e).replace(/\s+/g, ' ').slice(0, 200));
    await page.waitForTimeout(900);
    await slash('/combat-end');
    await clearDice();
    await toPlayer();
    await clearToasts();
    await page.evaluate(async () => (await import('/scripts/party.js')).refreshBoardView());
    await page.waitForTimeout(800);
    const barCell = await cellInfo('barricade');
    const clickBar = await page.locator('.wm-terrain-barricade').filter({ visible: true }).first().click({ timeout: 6000 }).then(() => 'ok').catch((/** @type {any} */ e) => String(e?.message || e).replace(/\s+/g, ' ').slice(0, 200));
    await page.waitForTimeout(900);
    const lever = await lastLine(/tira de la palanca/);
    const bar = await lastLine(/golpea la barricada/);
    const toasts = await page.evaluate(() => [...document.querySelectorAll('#toast-container .toast')].map(t => (t.textContent || '').trim()).slice(0, 4));
    check('T1 y B3: la palanca abre la reja y la barricada se golpea (en combate, con el daño del arma)', /se abre/.test(lever) && /(aguanta|cede)/.test(bar), JSON.stringify({ spots, leverCell, clickLever, barCell, clickBar, lever, bar, toasts }));

    // T2: un bando con el líder caído pide tregua.
    await clearToasts();
    await slash('/fight Guardia de Montesclaros 4');
    await clearDice();
    const band = await page.evaluate(async () => {
        const enc = (await import('/scripts/party.js')).getCombatEncounter();
        const foes = enc?.enemies || [];
        foes.forEach((/** @type {any} */ e, /** @type {number} */ i) => {
            e.maxHp = 20;
            e.boss = false;
            if (i === 0) { e.role = 'lider'; e.currentHp = 0; } else if (i === 1) e.currentHp = 0; else e.currentHp = 6;
        });
        return foes.length;
    });
    for (let i = 0; i < 6; i++) {
        const pending = await page.evaluate(async () => /** @type {any} */ ((await import('/scripts/party.js')).getCombatEncounter())?.truce === 'pending');
        if (pending) break;
        await slash('/combat-end');
        await clearDice();
    }
    const asked = await lastLine(/piden tregua/);
    await slash('/tregua sí');
    const truce = await lastLine(/^🤝 \[COMBAT\] Tregua: /);
    check('T2: con el líder caído piden tregua; aceptarla acaba el combate', Boolean(asked) && Boolean(truce) && await whoseTurn() === 'over', JSON.stringify({ band, asked: asked.slice(0, 120), truce: truce.slice(0, 120) }));
}
