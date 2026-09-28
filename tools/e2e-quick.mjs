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
            // Las tarjetas de sucesos (Z4) las prueba la vuelta sin modelo; aquí taparían clics.
            window.localStorage.setItem('sillytavern_gameSucesos', 'off');
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
    check('Localizaciones a 1280×720: lista y ficha lado a lado; la lista se mueve sola, la ficha y «Nuevo sitio» no; el nuevo se ve y se escribe de un tirón',
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
    // Las pestañas de filas (razas, clases, habilidades, objetos, bichos) también tienen su
    // ficha y su «+»: una raza nueva nace de otra, y se escribe qué da y qué quita.
    await page.locator('.tl-tab[data-step="razas"]').click();
    await page.waitForTimeout(500);
    const razasAntes = await page.locator('.tl-list .tl-card:not(.add)').count();
    await page.locator('.tl-toolbar .tl-add').click();
    await page.waitForTimeout(400);
    await page.locator('.tl-detail .tl-field[data-key="name"] .tl-input').fill('Trasgo de prueba');
    await page.waitForTimeout(300);
    await page.locator('.tl-detail .tl-field[data-key="effects"] .tl-input').fill('+2 Destreza');
    await page.waitForTimeout(300);
    const raza = await page.evaluate(() => ({
        cards: document.querySelectorAll('.tl-list .tl-card:not(.add)').length,
        open: (document.querySelector('.tl-list .tl-card.open')?.textContent || '').trim(),
        fields: [...document.querySelectorAll('.tl-detail .tl-field')].map(f => f.getAttribute('data-key')),
        warn: document.querySelector('.tl-tab[data-step="razas"]')?.classList.contains('tl-tab-warn') ?? false,
        drop: [...document.querySelectorAll('.tl-detail-foot .tl-action')].map(a => (a.textContent || '').trim()),
    }));
    check('razas: el «+» hace una nueva con su ficha al lado; si solo suma, la pestaña avisa',
        raza.cards === razasAntes + 1 && /Trasgo de prueba/.test(raza.open) && /Tuya/.test(raza.open)
        && ['name', 'effects', 'note'].every(k => raza.fields.includes(k)) && raza.warn && raza.drop.some(t => /Quitar esta/.test(t)),
        JSON.stringify({ razasAntes, ...raza }));
    if (process.argv.includes('--captura')) {
        const base = process.argv[process.argv.indexOf('--captura') + 1] || 'titulo.png';
        await page.screenshot({ path: `${base}.razas.png` });
    }
    await page.locator('.tl-detail-foot .tl-action', { hasText: 'Quitar esta' }).click();
    await page.waitForTimeout(300);

    // Tableros: la ficha enseña el tablero entero y se pinta arrastrando el ratón. Lo que se
    // ve es lo que se crea (antes no se dibujaba ninguno: A15).
    await page.locator('.tl-tab[data-step="tableros"]').click();
    await page.waitForTimeout(500);
    await page.locator('.tl-list .tl-card.add').first().click();
    await page.waitForTimeout(500);
    const grid = await page.evaluate(() => {
        const box = /** @type {HTMLElement|null} */ (document.querySelector('.tl-detail .tl-bp-grid'));
        const w = Number(box?.style.getPropertyValue('--w') || 0);
        return {
            w, cells: box?.children.length ?? 0,
            brushes: [...document.querySelectorAll('.tl-bp-brush')].map(b => (b.textContent || '').trim()),
            starts: document.querySelectorAll('.tl-bp-cell.is-start').length,
            said: document.querySelector('.tl-bp-said')?.textContent || '',
        };
    });
    await page.locator('.tl-bp-brush[data-brush="w"]').click();
    // Como lo haría quien juega: se baja hasta el tablero si no cabe, y se arrastra.
    await page.locator('.tl-bp-cell[data-x="2"][data-y="2"]').scrollIntoViewIfNeeded();
    const cellBox = async (/** @type {number} */ x, /** @type {number} */ y) => page.locator(`.tl-bp-cell[data-x="${x}"][data-y="${y}"]`).boundingBox();
    const from = await cellBox(2, 2);
    const to = await cellBox(5, 2);
    if (from && to) {
        await page.mouse.move(from.x + (from.width / 2), from.y + (from.height / 2));
        await page.mouse.down();
        await page.mouse.move(to.x + (to.width / 2), to.y + (to.height / 2), { steps: 8 });
        await page.mouse.up();
    }
    await page.waitForTimeout(300);
    const painted = await page.evaluate(() => ({
        water: [2, 3, 4, 5].map(x => document.querySelector(`.tl-bp-cell[data-x="${x}"][data-y="2"]`)?.getAttribute('data-t')),
        note: document.querySelector('.tl-list .tl-card.open .tl-card-note')?.textContent || '',
        mark: document.querySelector('.tl-tab[data-step="tableros"]')?.className || '',
    }));
    if (process.argv.includes('--captura')) await page.screenshot({ path: `${process.argv[process.argv.indexOf('--captura') + 1] || 'titulo.png'}.tablero-pintado.png` });
    await page.locator('.tl-detail-foot .tl-action', { hasText: 'Dibujar otro' }).click();
    await page.waitForTimeout(400);
    const redrawn = await page.evaluate(() => document.querySelector('.tl-list .tl-card.open .tl-card-note')?.textContent || '');
    check('tableros: la ficha enseña el tablero entero con sus pinceles; arrastrando se pinta, y «Dibujar otro» lo vuelve a tirar',
        grid.w > 0 && grid.cells % grid.w === 0 && grid.cells >= 100 && grid.brushes.length === 10 && grid.starts > 0
        && painted.water.every(t => t === 'agua') && /pintado a mano/.test(painted.note) && /tl-tab-changed/.test(painted.mark)
        && !/pintado a mano/.test(redrawn),
        JSON.stringify({ grid, painted, redrawn }));

    if (process.argv.includes('--captura')) {
        const base = process.argv[process.argv.indexOf('--captura') + 1] || 'titulo.png';
        await page.locator('.tl-tab[data-step="localidades"]').click();
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${base}.localidades.png` });
        // Y las otras pestañas con lista y ficha, con algo abierto.
        for (const [tab, pick] of [['tableros', '.tl-list .tl-card.add'], ['bestiario', '.tl-list .tl-card:not(.add)'], ['objetos', '.tl-toolbar .tl-add'], ['habilidades', '.tl-list .tl-card:not(.add)']]) {
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
            changed: [...document.querySelectorAll('.tl-tab.tl-tab-changed')].map(t => t.getAttribute('data-step')),
        };
    });
    check('recién cargado 1387, ninguna pestaña sale como cambiada: lo que trae el mundo es «como viene»',
        taller.changed.length === 0, JSON.stringify(taller.changed));
    check('el taller va a dos columnas: pestañas a la izquierda, la ficha al lado, semilla y dado en una línea, y Cancelar en el pie',
        taller.tabs === 12 && taller.column && taller.sideOfBody && taller.detail === 1 && taller.seedRow && taller.cancelInFoot === 1 && taller.popupControls === 0,
        JSON.stringify(taller));
    // Un mundo escrito también se retoca: sus sitios, tableros y gente, con ficha y «+».
    // Un sitio nuevo se une a otro, y al crear tiene camino de ida y de vuelta.
    await page.locator('.tl-tab[data-step="localidades"]').click();
    await page.waitForTimeout(500);
    await page.locator('.tl-list .tl-card', { hasText: 'El Pueblo de Barro' }).first().click();
    await page.waitForTimeout(300);
    const stockPlace = await page.evaluate(() => [...document.querySelectorAll('.tl-detail .tl-field')].map(f => f.getAttribute('data-key')));
    await page.locator('.tl-toolbar .tl-add').click();
    await page.waitForTimeout(400);
    await page.locator('.tl-detail .tl-field[data-key="name"] .tl-input').fill('Mirador de prueba');
    await page.waitForTimeout(300);
    await page.locator('.tl-detail .tl-field[data-key="link"] select').selectOption('Castillo de Vane');
    await page.waitForTimeout(300);
    await page.locator('.tl-detail .tl-field[data-key="days"] select').selectOption('2');
    await page.waitForTimeout(300);
    const packPlace = await page.evaluate(() => ({
        open: (document.querySelector('.tl-list .tl-card.open')?.textContent || '').trim(),
        fields: [...document.querySelectorAll('.tl-detail .tl-field')].map(f => f.getAttribute('data-key')),
        mark: document.querySelector('.tl-tab[data-step="localidades"]')?.className || '',
    }));
    if (process.argv.includes('--captura')) await page.screenshot({ path: `${process.argv[process.argv.indexOf('--captura') + 1] || 'titulo.png'}.1387-localidades.png` });
    await page.locator('.tl-tab[data-step="personajes"]').click();
    await page.waitForTimeout(500);
    await page.locator('.tl-list .tl-card', { hasText: 'Giles' }).first().click();
    await page.waitForTimeout(300);
    const packPerson = await page.evaluate(() => ({
        groups: [...document.querySelectorAll('.tl-cards-group')].map(g => (g.textContent || '').trim()),
        fields: [...document.querySelectorAll('.tl-detail .tl-field')].map(f => f.getAttribute('data-key')),
        add: document.querySelectorAll('.tl-toolbar .tl-add').length,
    }));
    if (process.argv.includes('--captura')) await page.screenshot({ path: `${process.argv[process.argv.indexOf('--captura') + 1] || 'titulo.png'}.1387-personajes.png` });
    await page.locator('.tl-tab[data-step="tableros"]').click();
    await page.waitForTimeout(500);
    await page.locator('.tl-list .tl-card:not(.add)').first().click();
    await page.waitForTimeout(300);
    const packBoard = await page.evaluate(() => ({
        fields: [...document.querySelectorAll('.tl-detail .tl-field')].map(f => f.getAttribute('data-key')),
        add: document.querySelectorAll('.tl-toolbar .tl-add').length,
        cells: document.querySelectorAll('.tl-detail .tl-bp-cell').length,
        starts: document.querySelectorAll('.tl-detail .tl-bp-cell.is-start').length,
        // Los enemigos no se enseñan en el taller (Daniel, 2026-09-28): ni puntos ni cuenta.
        foesSaid: /enemigo/i.test(document.querySelector('.tl-detail .tl-bp')?.textContent || ''),
        tab: document.querySelector('.tl-tab[data-step="localidades"]')?.textContent?.trim() || '',
    }));
    if (process.argv.includes('--captura')) await page.screenshot({ path: `${process.argv[process.argv.indexOf('--captura') + 1] || 'titulo.png'}.1387-tableros.png` });
    check('1387 se retoca: sitios, gente y tableros con su ficha al lado y su «+»; un sitio nuevo pregunta de dónde se llega',
        stockPlace.includes('name') && !stockPlace.includes('link')
        && /Mirador de prueba/.test(packPlace.open) && /Tuyo/.test(packPlace.open) && packPlace.fields.includes('link') && /tl-tab-changed/.test(packPlace.mark)
        && packPerson.fields.includes('wants') && packPerson.fields.includes('secret') && packPerson.add === 1 && packPerson.groups.some(g => /Vecinos/.test(g))
        && packBoard.fields.includes('locationName') && packBoard.add === 1
        && packBoard.cells === 16 * 11 && !packBoard.foesSaid && packBoard.starts === 3 && packBoard.tab === 'Localizaciones',
        JSON.stringify({ stockPlace, packPlace, packPerson, packBoard }));

    // Y una raza propia en 1387: tiene que llegar al mundo y al creador de personaje.
    await page.locator('.tl-tab[data-step="razas"]').click();
    await page.waitForTimeout(500);
    await page.locator('.tl-toolbar .tl-add').click();
    await page.waitForTimeout(400);
    await page.locator('.tl-detail .tl-field[data-key="name"] .tl-input').fill('Trasgo de prueba');
    await page.waitForTimeout(300);
    await page.locator('.tl-detail .tl-field[data-key="effects"] .tl-input').fill('+2 Destreza, -1 Carisma');
    await page.waitForTimeout(300);

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
            trasgo: await (async () => {
                const data = await (await import('/scripts/world-info.js')).loadWorldInfo(String(ctx.chatMetadata?.world_info || ''));
                const rows = data?.metadata?.worldRows?.razas ?? [];
                const mine = rows.find((/** @type {any} */ r) => r.name === 'Trasgo de prueba');
                const { freshCompendium } = await import('/scripts/game-engine/compendio/browser.js');
                const { racesOf } = await import('/scripts/game-engine/compendio/kin.js');
                const races = racesOf(await freshCompendium(data?.metadata?.worldRows)).map((/** @type {any} */ r) => r.name);
                return {
                    saved: Boolean(mine), effects: mine?.effects ?? null,
                    picked: (data?.metadata?.picks?.razas ?? []).includes(mine?.id),
                    inCreator: races.includes('Trasgo de prueba'),
                };
            })(),
            mirador: await (async () => {
                const data = await (await import('/scripts/world-info.js')).loadWorldInfo(String(ctx.chatMetadata?.world_info || ''));
                const maps = Array.isArray(data?.metadata?.locationMaps) ? data.metadata.locationMaps : [];
                const place = maps.find((/** @type {any} */ l) => l.name === 'Mirador de prueba');
                const vane = maps.find((/** @type {any} */ l) => l.name === 'Castillo de Vane');
                return {
                    ida: (place?.routes ?? []).map((/** @type {any} */ r) => `${r.to}:${r.days}`),
                    vuelta: (vane?.routes ?? []).some((/** @type {any} */ r) => r.to === 'Mirador de prueba'),
                };
            })(),
            toasts: [...document.querySelectorAll('#toast-container .toast')].map(t => (t.textContent || '').trim()).slice(0, 6),
            popups: [...document.querySelectorAll('dialog[open]')].map(d => (d.textContent || '').replace(/\s+/g, ' ').slice(0, 120)),
        };
    });
    check('se juega con Ulrich Brand, en Relajado, en el mundo de 1387', state === 'Ulrich Brand' && after.mode === 'relajado' && /Barro|Vane/.test(String(after.location)), JSON.stringify({ state, ...after }));
    check('y la raza hecha en el taller se guarda con el mundo, entra marcada y la ve el creador de personaje',
        after.trasgo.saved && after.trasgo.picked && after.trasgo.inCreator
        && JSON.stringify(after.trasgo.effects) === JSON.stringify([{ stat: 'dexterity', modifier: 2 }, { stat: 'charisma', modifier: -1 }]),
        JSON.stringify(after.trasgo));
    check('y el sitio añadido en el taller está en el mundo, con camino de ida y vuelta al Castillo de Vane',
        after.mirador.ida.includes('Castillo de Vane:2') && after.mirador.vuelta, JSON.stringify(after.mirador));
    // Lo que dice el texto, en el tablero: el alguacil y sus guardias revientan la puerta, y
    // aunque todavía no haya pelea, están dibujados (quietos, sin poder moverlos).
    await page.waitForTimeout(800);
    const idle = await page.evaluate(() => {
        const tokens = [...document.querySelectorAll('#game-shell .wm-token-enemy.wm-token-idle')];
        return {
            names: tokens.map(t => (t.querySelector('.wm-token-name')?.textContent || '').trim()).sort(),
            fighting: Boolean(window.SillyTavern.getContext().chatMetadata.combatEncounter?.active),
            start: (document.querySelector('#game-shell .sc-what')?.textContent || '').trim(),
            locked: [...document.querySelectorAll('#game-shell .wm-char-idle .wm-char-coord-input')].every(i => /** @type {HTMLInputElement} */ (i).disabled),
        };
    });
    check('sin pelea todavía, el tablero enseña al alguacil y a sus dos guardias, quietos, como dice el texto',
        !idle.fighting && idle.names.join('|') === 'Alguacil Torres|Guardia de Montesclaros|Guardia de Montesclaros' && idle.locked,
        JSON.stringify(idle));

    // Lo que se escribe lo contesta quien tienes delante; al narrador se le habla con su botón
    // (Daniel, 2026-09-28). Con un modelo «conectado» de mentira: lo que se mira es qué leería
    // el modelo y a nombre de quién sale la respuesta, no lo que escribiría.
    const onlineBefore = await page.evaluate(async () => (await import('/script.js')).online_status);
    await page.evaluate(async () => (await import('/script.js')).setOnlineStatus('Prueba'));
    const turnNotes = () => page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        await ctx.eventSource.emit(ctx.eventTypes.GENERATION_STARTED, 'normal', {}, true);
        return Object.values(ctx.extensionPrompts || {}).map((/** @type {any} */ p) => String(p?.value ?? ''))
            .filter(v => /\[CONVERSACIÓN\]|\[AL NARRADOR\]/.test(v)).join('\n');
    });
    const replyName = () => page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        ctx.chat.push({ name: 'La posadera', is_user: false, is_system: false, mes: 'Una respuesta de prueba.', extra: { model: 'prueba' } });
        const id = ctx.chat.length - 1;
        await ctx.eventSource.emit(ctx.eventTypes.MESSAGE_RECEIVED, id, 'normal');
        const name = ctx.chat[id].name;
        ctx.chat.pop();
        return name;
    });
    const toScene = await page.evaluate(async () => (await import('/scripts/party.js')).routeTyped('¿Qué pasa?'));
    const sceneNotes = await turnNotes();
    const sceneName = await replyName();

    // Y es un enfrentamiento, no una charla de taberna (Daniel, 2026-09-28): lo que se sugiere,
    // cómo os mira, la respuesta sin párrafo de narración delante, y la ventana de charla.
    await page.evaluate(async () => (await import('/scripts/party.js')).refreshBoardView?.());
    await page.waitForTimeout(500);
    const hotChips = await page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-chip-action')].map(c => (c.textContent || '').trim()));
    const trimmed = await page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        ctx.chat.push({ name: 'La posadera', is_user: false, is_system: false, mes: 'La posadera se cruza de brazos junto a la puerta.\n\n—No me cuentes milongas —gruñe.', extra: { model: 'prueba' } });
        const id = ctx.chat.length - 1;
        await ctx.eventSource.emit(ctx.eventTypes.MESSAGE_RECEIVED, id, 'normal');
        const kept = { name: ctx.chat[id].name, mes: ctx.chat[id].mes };
        ctx.chat.pop();
        return kept;
    });
    void page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/hablar Torres'));
    await page.waitForSelector('.popup:not([closing]) .tk-root', { timeout: 8000 }).catch(() => {});
    const talkWindow = await page.evaluate(() => {
        const root = document.querySelector('.popup:not([closing]) .tk-root');
        return {
            mood: (root?.querySelector('.tk-mood')?.textContent || '').trim(),
            locked: [...(root?.querySelectorAll('.tk-topic.tk-locked') ?? [])].map(b => b.getAttribute('data-topic')),
            open: [...(root?.querySelectorAll('.tk-topic:not(.tk-locked)') ?? [])].map(b => b.getAttribute('data-topic')),
            ronda: Boolean(root?.querySelector('[data-act="ronda"]')),
            ok: (document.querySelector('.popup:not([closing]) .popup-button-ok')?.textContent || '').trim(),
        };
    });
    await page.locator('.popup:visible .popup-button-ok').last().click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(400);
    check('con Torres plantando cara: se sugiere contestarle, os mira receloso y lo que dice sale sin narración delante',
        hotChips.some(t => /No he sido yo/.test(t)) && hotChips.some(t => /De qué se me acusa/.test(t)) && !hotChips.some(t => /Qué necesitas/.test(t))
        && /os está plantando cara/.test(sceneNotes) && /Os mira de forma recelosa/.test(sceneNotes)
        && trimmed.name === 'Torres' && trimmed.mes === '—No me cuentes milongas —gruñe.',
        JSON.stringify({ hotChips, trimmed, sceneNotes: sceneNotes.slice(0, 400) }));
    check('la ventana de charla con Torres: recelosa, lo que sabe, busca y piensa cerrado, sin ronda y con «Cerrar»',
        /recelosa/.test(talkWindow.mood) && ['sabe', 'quiere', 'vosotros'].every(t => talkWindow.locked.includes(t))
        && !talkWindow.ronda && talkWindow.ok === 'Cerrar', JSON.stringify(talkWindow));
    await page.waitForTimeout(400);
    await page.locator('#game-shell .gs-chip-narrator').click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(300);
    const armed = await page.evaluate(() => ({
        on: document.querySelector('#game-shell .gs-chip-narrator')?.classList.contains('on') ?? false,
        placeholder: /** @type {HTMLTextAreaElement|null} */ (document.querySelector('#send_textarea'))?.placeholder || '',
    }));
    const toNarrator = await page.evaluate(async () => (await import('/scripts/party.js')).routeTyped('¿Qué puedo hacer?'));
    const narratorNotes = await turnNotes();
    const narratorName = await replyName();
    const disarmed = await page.evaluate(() => ({
        on: document.querySelector('#game-shell .gs-chip-narrator')?.classList.contains('on') ?? false,
        placeholder: /** @type {HTMLTextAreaElement|null} */ (document.querySelector('#send_textarea'))?.placeholder || '',
    }));
    check('lo que se escribe lo contesta quien tienes delante (el alguacil Torres), a su nombre',
        toScene === 'model' && /\[CONVERSACIÓN\] Quien juega le está hablando a Torres/.test(sceneNotes) && sceneName === 'Torres',
        JSON.stringify({ toScene, sceneNotes: sceneNotes.slice(0, 200), sceneName }));
    check('«Al narrador»: lo siguiente va al narrador, fuera de la escena, y contesta él; luego se apaga solo',
        armed.on && /narrador/i.test(armed.placeholder) && toNarrator === 'model'
        && /\[AL NARRADOR\]/.test(narratorNotes) && !/\[CONVERSACIÓN\]/.test(narratorNotes) && narratorName === 'La posadera'
        && !disarmed.on && !/narrador/i.test(disarmed.placeholder),
        JSON.stringify({ armed, toNarrator, narratorNotes: narratorNotes.slice(0, 160), narratorName, disarmed }));
    // Se deja todo como estaba: sin conversación con Torres y sin modelo.
    await page.locator('#game-shell .gs-chip-action', { hasText: 'Despedirse' }).first().click({ timeout: 4000 }).catch(() => {});
    await page.locator('#send_textarea').fill('').catch(() => {});
    await page.evaluate(async (was) => (await import('/script.js')).setOnlineStatus(was), onlineBefore);
    await page.waitForTimeout(300);
    // UX: se empieza leyendo al narrador, no plantado en el tablero. La columna del mapa solo
    // sale si hay algo dibujado; y las fichas de acción se encienden en dorado.
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

    // La Exploración a pantalla entera (Gem director de UX): sin el tablero, en tres
    // columnas, y solo se viaja a los vecinos.
    await page.evaluate(() => /** @type {HTMLElement|null} */ (document.activeElement)?.blur());
    await page.keyboard.press('2');
    await page.waitForTimeout(900);
    const explore = await page.evaluate(() => {
        const box = (/** @type {Element|null} */ node) => node?.getBoundingClientRect() ?? null;
        const columns = [...document.querySelectorAll('#game-shell .gs-explore-dashboard > .ex-column')]
            .map(c => ({ col: c.getAttribute('data-col'), top: Math.round(box(c)?.top ?? 0), width: Math.round(box(c)?.width ?? 0) }));
        const cards = [...document.querySelectorAll('#game-shell .ex-column[data-col="travel"] .gs-place')].map(p => ({
            name: p.querySelector('.gs-place-name')?.textContent || '',
            note: p.querySelector('.gs-place-note')?.textContent || '',
            open: !(/** @type {HTMLButtonElement} */ (p)).disabled,
            here: p.classList.contains('current'),
        }));
        return {
            scene: document.querySelector('#game-shell')?.getAttribute('data-scene'),
            mapHeight: Math.round(box(document.querySelector('#game-shell .gs-map-slot'))?.height ?? 0),
            gridHeight: Math.round(box(document.querySelector('#game-shell .wm-grid, #game-shell .wm-container'))?.height ?? 0),
            placesWidth: Math.round(box(document.querySelector('#game-shell .gs-places'))?.width ?? 0),
            here: document.querySelector('#game-shell .gs-here-name')?.textContent || '',
            titleColor: window.getComputedStyle(document.querySelector('#game-shell .gs-here-name') ?? document.body).color,
            columns,
            services: document.querySelectorAll('#game-shell .ex-column[data-col="here"] .gs-service').length,
            boards: document.querySelectorAll('#game-shell .ex-column[data-col="boards"] .gs-board').length,
            cards,
            pageWidth: document.documentElement.scrollWidth,
            viewport: window.innerWidth,
        };
    });
    if (captura) await page.screenshot({ path: `${captura}.exploracion.png` });
    // Los vecinos de El Pueblo de Barro en 1387: el Camino Viejo, el Castillo y la Granja.
    const neighbours = ['El Camino Viejo', 'Castillo de Vane', 'La Granja Quemada'];
    const openCards = explore.cards.filter(c => c.open).map(c => c.name);
    check('Exploración: sin tablero, el sitio en dorado arriba y tres columnas lado a lado (aquí mismo, tableros, viajar)',
        explore.scene === 'exploration' && explore.mapHeight === 0 && explore.gridHeight === 0
        && explore.columns.length === 3 && new Set(explore.columns.map(c => c.top)).size === 1
        && explore.columns.map(c => c.col).join() === 'here,boards,travel'
        && /226, 194, 122/.test(explore.titleColor) && explore.services >= 1 && explore.boards >= 1
        && explore.pageWidth <= explore.viewport, JSON.stringify({ ...explore, cards: undefined }));
    check('Exploración: solo se viaja a los vecinos; lo de más lejos se ve, apagado, con por dónde se pasa',
        explore.here !== 'El Pueblo de Barro'
        || (openCards.length > 0 && openCards.every(n => neighbours.includes(n))
            && explore.cards.some(c => !c.open && !c.here && /pasando por/.test(c.note))),
        JSON.stringify(explore.cards));
    await page.keyboard.press('1');
    await page.waitForTimeout(500);

    // Con modelo, a quien se le habla contesta él, no el narrador (fallo visto por Daniel,
    // 2026-09-27: «¿cómo te llamas?» al tabernero lo contestaba el narrador con otra cosa).
    /** Lo que el modelo leería ahora al final del prompt. */
    const promptTail = () => page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        await ctx.eventSource.emit(ctx.eventTypes.GENERATION_STARTED, 'normal', {}, true);
        return Object.values(ctx.extensionPrompts || {}).map((/** @type {any} */ p) => String(p?.value ?? '')).filter(v => v.includes('[CONVERSACIÓN]')).join('\n');
    });
    await page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/hablar Giles'));
    await page.waitForSelector('.popup:not([closing]) .tk-root', { timeout: 8000 }).catch(() => {});
    await page.locator('.popup:not([closing]) .tk-act[data-act="palabras"]').click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(600);
    const talking = await promptTail();
    const named = await page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        ctx.chat.push({ name: 'Narrador', is_user: false, is_system: false, mes: 'Me llamo Giles, y aquí se paga antes de beber.', extra: { model: 'prueba' } });
        const id = ctx.chat.length - 1;
        await ctx.eventSource.emit(ctx.eventTypes.MESSAGE_RECEIVED, id, 'normal');
        const name = ctx.chat[id].name;
        ctx.chat.pop();
        return name;
    });
    await page.locator('#send_textarea').fill('').catch(() => {});
    await page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/hablar Giles'));
    await page.waitForSelector('.popup:not([closing]) .tk-root', { timeout: 8000 }).catch(() => {});
    await page.locator('.popup:not([closing]) .popup-button-ok').last().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(600);
    const farewell = await promptTail();
    check('hablando con Giles, el modelo lee que conteste Giles, y su respuesta sale a su nombre; al despedirse, se acaba',
        /Quien juega le está hablando a Giles.*contesta Giles, en primera persona, con una o dos frases/.test(talking) && named === 'Giles' && farewell === '',
        JSON.stringify({ talking: talking.slice(0, 200), named, farewell: farewell.slice(0, 80) }));

    // Z6: el modo del narrador se elige en la pausa: Mixto → Modelo → Motor → Mixto.
    const narratorLabels = [];
    for (let i = 0; i < 3; i++) {
        await page.evaluate(() => /** @type {HTMLElement|null} */ (document.activeElement)?.blur());
        await page.keyboard.press('Escape');
        await page.waitForSelector('.gs-pause', { timeout: 5000 }).catch(() => {});
        const toggle = page.locator('.gs-pause-toggle[data-toggle="narrator"]');
        narratorLabels.push(await toggle.textContent().catch(() => ''));
        await toggle.click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(300);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
    }
    const narratorBack = await page.evaluate(() => window.localStorage.getItem('sillytavern_gameNarrator'));
    await page.evaluate(() => /** @type {HTMLElement|null} */ (document.activeElement)?.blur());
    await page.keyboard.press('Escape');
    await page.waitForSelector('.gs-pause', { timeout: 5000 }).catch(() => {});
    const sucesosToggle = await page.locator('.gs-pause-toggle[data-toggle="sucesos"]').textContent().catch(() => '');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    check('Z6: en la pausa se elige el narrador (Mixto, Modelo, Motor), y los sucesos se pueden apagar',
        narratorLabels.join('|') === 'Narrador: Mixto|Narrador: Modelo|Narrador: Motor (0 tokens)' && narratorBack === 'mixto'
        && sucesosToggle === 'Sucesos con decisión: no',
        JSON.stringify({ narratorLabels, narratorBack, sucesosToggle }));

    // K2: la tanda de profundidad (B1, B2, H2, T1, B3, T2) sobre la partida recién empezada.
    // Corre siempre desde el 2026-09-28: es la que sustituye a los pasos 74 y 75 de la vuelta
    // larga, que con el mundo gastado se colgaban. Cada comando lleva tope: si se cuelga, se dice cuál.
    if (!process.argv.includes('--sin-profundidad')) await depthRound(page);

    // El grupo viaja entero: tras llegar a otro sitio y entrar en uno de sus tableros, las
    // fichas del grupo están en ese tablero (se viaja de vecino en vecino).
    await page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/go Castillo de Vane'));
    await page.waitForTimeout(2500);
    await page.evaluate(() => { /** @type {any} */ (window).toastr?.clear(); });
    await page.evaluate(() => /** @type {HTMLElement|null} */ (document.activeElement)?.blur());
    await page.keyboard.press('2');
    await page.waitForTimeout(900);
    await page.locator('#game-shell .ex-column[data-col="boards"] .gs-board').first().click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const moved = await page.evaluate(async () => {
        const party = (await import('/scripts/party.js')).getPartyMembersSnapshot();
        const meta = window.SillyTavern.getContext().chatMetadata;
        return {
            here: String(meta.currentLocation || ''),
            board: String(meta.currentBoard || ''),
            scene: document.querySelector('#game-shell')?.getAttribute('data-scene'),
            members: party.filter((/** @type {any} */ m) => !m.dead).map((/** @type {any} */ m) => ({
                name: m.name, at: m.mapPosition?.locationName, token: Boolean(document.querySelector(`#game-shell .wm-token[data-token-id="${m.id}"]`)),
            })),
        };
    });
    check('tras viajar a Castillo de Vane y entrar en un tablero, el grupo está en él',
        moved.here === 'Castillo de Vane' && Boolean(moved.board) && moved.members.length > 0 && moved.members.every(m => m.token),
        JSON.stringify(moved));

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
    // Con una ventana encima, los dados no se pueden pulsar: con dos fallos seguidos se deja.
    const clearDice = async () => {
        let misses = 0;
        for (let i = 0; i < 40; i++) {
            const next = page.locator('.wm-dice-overlay.active .wm-dice-next');
            if (await next.count() === 0) return;
            const clicked = await next.click({ timeout: 1500 }).then(() => true).catch(() => false);
            if (!clicked && ++misses >= 2) return;
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

    // Ganada la pelea de la posada (la tregua la gana), sus enemigos ya no se dibujan ni se ofrecen.
    await page.evaluate(async () => (await import('/scripts/party.js')).refreshBoardView());
    await page.waitForTimeout(800);
    const cleared = await page.evaluate(() => ({
        idle: document.querySelectorAll('#game-shell .wm-token-enemy.wm-token-idle').length,
        start: document.querySelectorAll('#game-shell .sc-btn').length,
        won: window.SillyTavern.getContext().chatMetadata.boardsWon ?? [],
    }));
    check('ganada la pelea del tablero, sus enemigos ya no se dibujan ni se ofrece empezarla otra vez',
        cleared.idle === 0 && cleared.start === 0 && cleared.won.some((/** @type {string} */ k) => /::El cuarto de la posada$/.test(k)), JSON.stringify(cleared));

    // R3, R4 y R6 (los pasos 70 y 72 de la vuelta larga, que allí fallaban siempre): el cono
    // de escarcha hiela el charco donde está el guardia, el fuego revienta un barril y un
    // cofre al lado se abre pulsándolo. En partida nueva, como el resto de la tanda.
    console.log('\n=== Profundidad: R3, R4 y R6 ===');
    await slash('/combat-stop');
    await page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const hero = (ctx.chatMetadata.party || [])[0];
        if (hero) {
            hero.level = 5;
            hero.hp = Math.max(Number(hero.hp) || 0, 40);
            hero.maxHp = Math.max(Number(hero.maxHp) || 0, 40);
            hero.abilities = [...new Set([...(hero.abilities || []), 'tec-frasco-lumbre', 'mag-cono-escarcha'])];
            hero.spellCharges = {};
        }
        await ctx.saveMetadata();
        await ctx.eventSource.emit(ctx.eventTypes.CHAT_CHANGED, ctx.getCurrentChatId?.());
    });
    await page.waitForTimeout(1500);
    /** Un guardia pegado al héroe al que le toca, con vida de sobra; y qué casilla pisa. */
    const nextToFoe = async () => {
        await slash('/fight Guardia de Montesclaros 1');
        await clearDice();
        await toPlayer();
        return page.evaluate(async () => {
            const party = await import('/scripts/party.js');
            const enc = party.getCombatEncounter();
            const entry = enc?.turnOrder?.[enc?.currentTurnIndex];
            const me = party.getPartyMembersSnapshot().find((/** @type {any} */ m) => String(m.id) === String(entry?.id));
            const foe = (enc?.enemies || []).find((/** @type {any} */ e) => (e.currentHp || 0) > 0);
            if (!me || !foe) return null;
            foe.currentHp = 99;
            foe.maxHp = 99;
            foe.gridX = (Number(me.mapPosition?.gridX) || 0) + 1;
            foe.gridY = Number(me.mapPosition?.gridY) || 0;
            return { me: { x: Number(me.mapPosition?.gridX) || 0, y: Number(me.mapPosition?.gridY) || 0 }, foe: { name: String(foe.name), x: foe.gridX, y: foe.gridY } };
        });
    };
    /** Usar algo contra el guardia como quien juega: su ficha y el botón. */
    const useOnFoe = async (/** @type {string} */ what) => {
        await page.evaluate(async () => (await import('/scripts/party.js')).refreshBoardView());
        await page.waitForTimeout(600);
        await clearToasts();
        await page.locator('.wm-token-enemy').filter({ visible: true }).first().click({ timeout: 6000 }).catch(() => {});
        await page.waitForSelector('.tc-card', { timeout: 8000 }).catch(() => {});
        const buttons = await page.evaluate(() => [...document.querySelectorAll('.tc-btn')].map(b => (b.textContent || '').trim()));
        await page.locator('.tc-btn').filter({ hasText: what }).first().click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(1500);
        await clearDice();
        // El mensaje entero de lo que se usó: si falla, que se vea qué dijo el juego.
        const said = await page.evaluate((w) => (window.SillyTavern.getContext().chat || [])
            .map((/** @type {any} */ m) => String(m.mes || '')).filter(t => t.includes(`usa ${w}`)).pop() || '', what);
        return { buttons, said };
    };
    const cellAt = (/** @type {{x: number, y: number}} */ at) => page.evaluate(async (c) => {
        const wi = await import('/scripts/world-info.js');
        const ctx = window.SillyTavern.getContext();
        const place = wi.getCurrentWorldLocationMaps().find((/** @type {any} */ l) => l.name === ctx.chatMetadata.currentLocation);
        const board = (place?.boards || []).find((/** @type {any} */ b) => b.name === ctx.chatMetadata.currentBoard);
        return board?.terrain?.cells?.[`${c.x},${c.y}`]?.type ?? 'floor';
    }, at);

    // R4 + R3: el cono de escarcha sobre el charco.
    const cold = await nextToFoe();
    if (cold) await paint('water', cold.foe);
    const cone = await useOnFoe('Cono de escarcha');
    const coldCell = cold ? await cellAt(cold.foe) : '';
    check('R4 + R3: el cono de escarcha hiela el charco donde está el guardia, y se dice',
        /usa Cono de escarcha/.test(cone.said) && coldCell === 'ice' && /❄️ El agua se hiela/u.test(cone.said),
        JSON.stringify({ cold, coldCell, buttons: cone.buttons, said: cone.said.slice(0, 700) }));

    // R6: el fuego revienta un barril pegado al guardia; y el guardia, jefe y malherido,
    // cambia una vez al empezar la ronda.
    await slash('/combat-stop');
    const fire = await nextToFoe();
    const barrelAt = fire ? { x: fire.foe.x, y: fire.foe.y + 1 } : { x: 0, y: 0 };
    if (fire) await paint('barrel', barrelAt);
    await page.evaluate(async () => {
        const enc = (await import('/scripts/party.js')).getCombatEncounter();
        const foe = (enc?.enemies || []).find((/** @type {any} */ e) => (e.currentHp || 0) > 0);
        if (foe) {
            foe.boss = true;
            foe.currentHp = Math.floor((Number(foe.maxHp) || 20) * 0.45);
        }
    });
    const flask = await useOnFoe('Frasco de lumbre');
    const boom = await lastLine(/Revienta un barril/);
    await slash('/combat-end');
    await clearDice();
    await toPlayer();
    const phase = await lastLine(/^👑 \[COMBAT\] /);
    check('R6: el fuego revienta un barril y alcanza a quien está al lado; y el jefe malherido cambia una vez',
        Boolean(boom) && /(se enfurece|se acorrala|da una voz)/.test(phase),
        JSON.stringify({ fire, barrelAt, barrel: await cellAt(barrelAt), buttons: flask.buttons, said: flask.said.slice(0, 700), boom: boom.slice(0, 200), phase: phase.slice(0, 160) }));

    // R6: un cofre al lado del héroe se abre pulsándolo.
    await slash('/combat-stop');
    const hero = await page.evaluate(async () => {
        const me = (await import('/scripts/party.js')).getPartyMembersSnapshot()[0];
        return { x: Number(me?.mapPosition?.gridX) || 0, y: Number(me?.mapPosition?.gridY) || 0 };
    });
    const chestAt = { x: hero.x + 1, y: hero.y };
    await paint('chest', chestAt);
    await page.evaluate(async () => (await import('/scripts/party.js')).refreshBoardView());
    await page.waitForTimeout(800);
    await clearToasts();
    const chestCell = await cellInfo('chest');
    const clickChest = await page.locator('.wm-terrain-chest').filter({ visible: true }).first().click({ timeout: 6000 }).then(() => 'ok').catch((/** @type {any} */ e) => String(e?.message || e).replace(/\s+/g, ' ').slice(0, 200));
    await page.waitForTimeout(1000);
    const opened = await lastLine(/abre el cofre/);
    check('R6: un cofre al lado del héroe se abre pulsándolo: oro y a veces algo más',
        Boolean(opened), JSON.stringify({ hero, chestAt, chestCell, clickChest, opened: opened.slice(0, 200) }));
}
