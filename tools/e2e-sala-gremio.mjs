#!/usr/bin/env node
/**
 * La sala del gremio, jugada como un jugador (J3.1, J3.3 a J3.8, J15.2, J15.4, J15.6, J14, D-J28,
 * J2.3 y J4.6 de wiki/ROADMAP_SIN_CONEXION.md), en un navegador de verdad contra un servidor propio
 * con un `--dataRoot` temporal, como `e2e-gremio.mjs`. Todo con el ratón: sin escribir órdenes.
 *
 *   título → Jugar sin conexión → tu personaje → en la prueba, la sala solo deja saltarla (D-J28)
 *   → saltarla en el muelle no deja la pelea a la vista (J2.3) → la sala por partes: el cofre (oro
 *   y cosas), el patio (entrenar y subir de nivel), los edificios, los encargos, tus personajes,
 *   contratar, la memoria → dormir en el gremio guarda (J3.3) → dormir en la taberna guarda solo
 *   al empezar el día (J15.2) → la pausa: «Guardar y cargar», guardar en una ranura, exportar, y
 *   cargarla → desde el título, las ranuras del gremio e «Importar una partida» (J15.6) → quedar
 *   con alguien desde el pueblo (J14) → el tablón dice el ajuste por nivel (J4.6).
 *
 * Uso:
 *   node tools/e2e-sala-gremio.mjs                 # sin ventana
 *   node tools/e2e-sala-gremio.mjs --headed
 *   node tools/e2e-sala-gremio.mjs --port 8303 --captura sala.png   # sala.png.cofre.png, …
 *   node tools/e2e-sala-gremio.mjs --port 8303 --log sala.log       # y lo que dice el servidor (un 500 se explica ahí)
 */

/* global window, document, HTMLElement */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createWriteStream, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8173;
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

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-sala-'));
const work = mkdtempSync(join(tmpdir(), 'st-e2e-sala-files-'));
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
            const said = String(buffer);
            if (said.includes(String(PORT)) || said.toLowerCase().includes('listening')) {
                clearTimeout(timer);
                setTimeout(() => resolve(child), 1500);
            }
        };
        child.stdout.on('data', watch);
        child.stderr.on('data', watch);
        // `--log fichero`: lo que dice el servidor (un 500 se explica ahí).
        if (argAfter('--log')) {
            const out = createWriteStream(argAfter('--log'));
            child.stdout.pipe(out);
            child.stderr.pipe(out);
        }
        child.on('exit', (/** @type {number} */ code) => reject(new Error(`the server exited with code ${code}`)));
    });
}

/**
 * Elegir en una tarjeta de «Crear personaje» la opción que más se parece a lo pedido.
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
    browser = await chromium.launch({ channel: 'msedge', headless: !HEADED }).catch(() => chromium.launch({ headless: !HEADED }));
    const context = await browser.newContext({ viewport: { width: 1400, height: 950 }, acceptDownloads: true });
    page = await context.newPage();
    /** @type {string[]} */
    const problems = [];
    page.on('pageerror', (/** @type {any} */ e) => problems.push(`PAGEERROR ${e.message}`));
    page.on('console', (/** @type {any} */ m) => {
        if (m.type() === 'error' && !/Failed to load resource.*404/.test(m.text())) problems.push(`ERROR ${m.text().slice(0, 300)}`);
    });
    await context.addInitScript(() => {
        try {
            // Los consejos, vistos: aquí se juega la sala, no se aprende a jugar.
            window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,combat,travel,prisoners,mesa,high,spell,pet,bill,move,attack,roll,talk,journal,town,rest,board');
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
            window.localStorage.setItem('sillytavern_gameSucesos', 'off');
            // Las escenas del hilo y las charlas escritas las mira e2e-historia; aquí taparían clics.
            window.localStorage.setItem('sillytavern_gameStoryWindows', 'off');
        } catch { /* nada */ }
    });

    /** Lo que el juego sabe ahora. */
    const state = () => page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const party = (await import('/scripts/party.js')).getPartyMembersSnapshot();
        const meta = ctx.chatMetadata ?? {};
        const settings = (await import('/scripts/extensions.js')).extension_settings;
        return {
            world: String(meta.world_info ?? ''),
            chat: String(ctx.getCurrentChatId?.() ?? ''),
            board: String(meta.currentBoard ?? ''),
            location: String(meta.currentLocation ?? ''),
            day: Number(meta.calendar?.day) || 0,
            slot: Number(meta.calendar?.slotIndex) || 0,
            party: party.map((/** @type {any} */ m) => ({
                id: String(m.id), name: m.name, gold: Number(m.gold) || 0, xp: Number(m.xp) || 0, level: Number(m.level) || 1,
                hp: Number(m.hp) || 0, maxHp: Number(m.maxHp) || 0, guest: Boolean(m.guest),
                loose: (m.items ?? []).filter((/** @type {any} */ i) => !Object.values(m.equippedItems ?? {}).includes(i.id)).map((/** @type {any} */ i) => i.name),
            })),
            fighting: Boolean(meta.combatEncounter?.active),
            storage: (Array.isArray(meta.guildStorage) ? meta.guildStorage : []).map((/** @type {any} */ i) => i?.name),
            guild: meta.guild ?? null,
            taken: meta.contractTaken ? String(meta.contractTaken.title || meta.contractTaken.id || '') : '',
            slots: JSON.parse(JSON.stringify(settings.gameSlots?.[String(meta.world_info ?? '')] ?? {})),
            done: Array.isArray(meta.plotState?.done) ? meta.plotState.done : [],
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
    const toasts = () => page.evaluate(() => [...document.querySelectorAll('#toast-container .toast')].map(t => (t.textContent || '').replace(/\s+/g, ' ').trim()));
    const dropToasts = () => page.evaluate(() => document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));
    /** Espera a que se cumpla algo, sin dormir de más. */
    const until = async (/** @type {() => Promise<boolean>} */ test, ms = 30000) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (await test().catch(() => false)) return true;
            await page.waitForTimeout(300);
        }
        return false;
    };
    const sceneNow = () => page.evaluate(() => document.querySelector('#game-shell')?.getAttribute('data-scene') || '');
    /** J18.8: «Continuar», al acabar de leer; y esperar a la escena que toca. */
    const carryOn = async (/** @type {string} */ wanted) => {
        await until(async () => {
            if (await sceneNow() === wanted) return true;
            await page.evaluate(() => /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .gs-vn-box .gs-chip-continue'))?.click());
            return false;
        }, 12000);
        return sceneNow();
    };
    /** Los dados que quedan en pantalla, pasados como lo haría quien juega. */
    const clearDice = async () => {
        for (let i = 0; i < 20; i++) {
            const next = page.locator('.wm-dice-overlay.active .wm-dice-next');
            if (await next.count() === 0) break;
            if (!(await next.click({ timeout: 1500 }).then(() => true).catch(() => false))) break;
            await page.waitForTimeout(250);
        }
    };
    /** Lo que se ve dentro de un sitio del pueblo. */
    const placeScene = () => page.evaluate(() => {
        const scene = document.querySelector('#game-shell .gs-town-scene');
        return {
            place: scene?.getAttribute('data-place') || '',
            rank: (scene?.querySelector('.gs-town-hall-rank')?.textContent || '').trim(),
            news: (scene?.querySelector('.gs-town-hall-news')?.textContent || '').trim(),
            groups: [...(scene?.querySelectorAll('.gs-town-group') ?? [])].map(g => (g.textContent || '').trim()),
            acts: [...(scene?.querySelectorAll('.gs-town-act') ?? [])].map(b => ({
                id: b.getAttribute('data-action') || '',
                label: (b.querySelector('.gs-btn-label')?.textContent || b.textContent || '').trim(),
                detail: (b.querySelector('.gs-btn-detail')?.textContent || '').trim(),
                on: !(/** @type {HTMLButtonElement} */ (b).disabled),
            })),
        };
    });
    /** Al pueblo (fuera de lo que se lea), y dentro de un sitio. */
    const enterPlace = async (/** @type {string} */ id) => {
        await carryOn('exploration');
        if ((await placeScene()).place !== id) {
            if (await page.locator('#game-shell .gs-town-scene').count() > 0) {
                await page.locator(`#game-shell .gs-town-tab[data-place="${id}"]`).click({ timeout: 5000 }).catch(() => {});
            } else {
                await until(() => page.evaluate(() => document.querySelectorAll('#game-shell .gs-town-place').length > 0), 10000);
                await page.locator(`#game-shell .gs-town-place[data-place="${id}"]`).click({ timeout: 5000 }).catch(() => {});
            }
        }
        return until(async () => (await placeScene()).place === id, 8000);
    };
    const act = (/** @type {string} */ id) => page.locator(`#game-shell .gs-town-scene .gs-town-act[data-action="${id}"]`).click({ timeout: 5000 }).then(() => true).catch(() => false);
    /** La ventana abierta que dice algo, con su texto. */
    const dialogWith = (/** @type {RegExp} */ pattern) => until(() => page.evaluate((source) => [...document.querySelectorAll('dialog[open]:not([closing])')]
        .some(d => new RegExp(source).test(d.textContent || '')), pattern.source), 10000);
    const windowText = () => page.evaluate(() => [...document.querySelectorAll('dialog[open]:not([closing])')].map(d => (d.textContent || '').replace(/\s+/g, ' ').trim()).join(' | '));
    /** Pulsar un botón de la ventana de encima por su texto. */
    const pressIn = (/** @type {string} */ scope, /** @type {RegExp} */ label) => page.evaluate(({ scope: s, source }) => {
        const dialogs = [...document.querySelectorAll('dialog[open]:not([closing])')];
        const top = dialogs[dialogs.length - 1];
        const button = [...(top?.querySelectorAll(`${s} button`) ?? [])].find(b => new RegExp(source).test((b.textContent || '').trim()) && !(/** @type {HTMLButtonElement} */ (b).disabled));
        if (button instanceof HTMLElement) button.click();
        return Boolean(button);
    }, { scope, source: label.source });
    const closeWindow = async () => {
        await page.locator('dialog[open]:not([closing]) :is(.hb-close, .mm-close, .popup-button-ok, .popup-button-cancel):visible').last().click({ timeout: 5000 }).catch(() => {});
        await until(() => page.evaluate(() => document.querySelectorAll('dialog[open]:not([closing])').length === 0), 6000);
    };
    /** La pausa, y uno de sus botones. */
    const pauseItem = async (/** @type {string} */ label) => {
        await page.locator('#game-shell .gs-pause-open').click({ timeout: 5000 }).catch(() => {});
        await page.waitForSelector('#game-shell .gs-pause .gs-pause-btn', { timeout: 8000 }).catch(() => {});
        const items = await page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-pause .gs-pause-label')].map(l => (l.textContent || '').trim()));
        if (label) await page.locator('#game-shell .gs-pause .gs-pause-btn').filter({ hasText: label }).first().click({ timeout: 5000 }).catch(() => {});
        return items;
    };
    /** La pantalla de guardar y cargar, como se ve. */
    const saveScreen = () => page.evaluate(() => ({
        open: Boolean(document.querySelector('dialog.sv-dialog[open]')),
        title: document.querySelector('.sv-dialog .sv-title')?.textContent ?? '',
        sub: document.querySelector('.sv-dialog .sv-sub')?.textContent ?? '',
        status: (document.querySelector('.sv-dialog .sv-status')?.textContent ?? '').trim(),
        slots: [...document.querySelectorAll('.sv-dialog .sv-slot')].map(s => ({
            id: s.getAttribute('data-slot'),
            line: s.querySelector('.sv-line')?.textContent ?? '',
            save: Boolean(s.querySelector('.sv-save:not([disabled])')),
            load: Boolean(s.querySelector('.sv-load:not([disabled])')),
        })),
    }));
    const waitStatus = (/** @type {RegExp} */ pattern, ms = 30000) => until(async () => pattern.test((await saveScreen()).status), ms);
    const confirmYes = () => page.locator('.sv-dialog .sv-confirm-yes').click({ timeout: 5000 }).catch(() => {});
    const shot = async (/** @type {string} */ what) => { if (SHOT) await page.screenshot({ path: `${SHOT}.${what}.png` }); };

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    const firstRun = page.locator('text=Welcome to SillyTavern!');
    if (await firstRun.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#game-shell', { timeout: 90000 });

    // 1. Jugar sin conexión, con Mara.
    const offline = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Jugar sin conexión' });
    await until(async () => await offline.count() === 1, 30000);
    await offline.click();
    await page.waitForSelector('.hc-root', { timeout: 120000 });
    await page.fill('.hc-root .hc-name', 'Mara');
    await pickHeroCard(page, 'race', 'Humano');
    await pickHeroCard(page, 'class', 'Guerrero');
    await page.locator('.hc-root .hc-enter').click();
    await until(async () => /Gremio/.test((await state()).world), 60000);
    await until(() => chatHas(/Al ladrón/), 20000);
    await page.waitForTimeout(800);
    let now = await state();
    const hubWorld = now.world;
    check('empieza en el muelle de Puerto Alba, con la prueba por hacer', now.board === 'El muelle de Puerto Alba' && now.party[0]?.name === 'Mara', JSON.stringify(now));

    // 2. D-J28: en la prueba, la sala solo deja saltarla. Se sale del muelle, se entra en la sala y se vuelve.
    // «Salir del tablero», en la fila o, si no cabe (con «Evitar la pelea» y las trampas), en «+N más».
    if (!(await clickChip(/^Salir del tablero$/))) {
        await clickChip(/\+\d+ más$/);
        await page.locator('.popup[open] .hp-item[data-chip="leave"]').click({ timeout: 5000 }).catch(() => {});
    }
    await page.waitForTimeout(600);
    const inHallTrial = await enterPlace('gremio');
    const trialHall = await placeScene();
    check('D-J28: en la prueba, la sala del gremio no ofrece el tablón ni los mercenarios: solo saltar la prueba y la salida',
        inHallTrial && trialHall.acts.some(a => a.id === 'hub-skip') && !trialHall.acts.some(a => /^hub-(board|hire|chest|train|house|errands|heroes|sleep)$/.test(a.id))
        && trialHall.acts.some(a => a.id === 'hub-exit'), JSON.stringify(trialHall.acts.map(a => a.id)));
    await shot('sala-prueba');
    await act('hub-exit');
    await page.waitForTimeout(400);

    // 3. J2.3: de vuelta al muelle, se salta la prueba desde allí.
    await page.locator('#game-shell .gs-board').filter({ hasText: 'El muelle de Puerto Alba' }).first().click({ timeout: 5000 })
        .catch(() => clickChip(/Entrar en El muelle de Puerto Alba/));
    await until(async () => (await state()).board === 'El muelle de Puerto Alba', 10000);
    await carryOn('combat');
    await until(async () => (await chips()).some(c => /^Saltar la prueba$/.test(c)), 10000);
    await clickChip(/^Saltar la prueba$/);
    await page.waitForSelector('.popup:has-text("¿Saltar la prueba?")', { timeout: 10000 }).catch(() => {});
    await page.locator('.popup-button-ok:visible').first().click({ timeout: 5000 }).catch(() => {});
    await until(() => chatHas(/apunta tu nombre en el libro del gremio/), 15000);
    await page.waitForTimeout(1000);
    await clearDice();
    await shot('saltada');
    // Lo que se lee al saltarla es lo que pasa ahora (Brunilda te apunta), no el ratero.
    const told = await page.evaluate(() => {
        const lines = [...document.querySelectorAll('#game-shell .gs-vn-text .gs-vn-line')].map(l => (l.textContent || '').trim()).filter(Boolean);
        return { last: lines[lines.length - 1] ?? '', scene: document.querySelector('#game-shell')?.getAttribute('data-scene') || '' };
    });
    const afterSkipScene = await carryOn('exploration');
    await until(() => page.evaluate(() => document.querySelectorAll('#game-shell .gs-town-place').length > 0), 10000);
    now = await state();
    const pier = await page.evaluate(() => {
        const card = [...document.querySelectorAll('#game-shell .gs-board')].find(c => /El muelle de Puerto Alba/.test(c.textContent || ''));
        return (card?.querySelector('.gs-card-note')?.textContent || '').trim();
    });
    // Y si se vuelve a mirar el muelle, allí ya no hay nadie: ni el ratero ni su ficha de pelea.
    await page.locator('#game-shell .gs-board').filter({ hasText: 'El muelle de Puerto Alba' }).first().click({ timeout: 5000 }).catch(() => {});
    await until(async () => (await state()).board === 'El muelle de Puerto Alba', 8000);
    await page.waitForTimeout(800);
    const onPier = await page.evaluate(() => ({
        tokens: document.querySelectorAll('#game-shell .wm-token.wm-token-enemy').length,
        fightChip: [...document.querySelectorAll('#game-shell .gs-chip-action')].some(c => /Iniciar combate|Ratero/.test(c.textContent || '')),
    }));
    await shot('muelle-vacio');
    check('J2.3: saltada en el muelle, la pelea no se queda a la vista: se lee a Brunilda, el muelle sale «Ganado» y, dentro, ni el ratero ni «Iniciar combate»',
        now.board === '' && !now.fighting && afterSkipScene === 'exploration' && !/Al ladrón|ratero/i.test(told.last) && /^Ganado/.test(pier)
        && onPier.tokens === 0 && !onPier.fightChip, JSON.stringify({ told, afterSkipScene, pier, onPier }));
    await clickChip(/^Salir del tablero$|^Volver a Puerto Alba$/);
    await page.locator('#game-shell .gs-scene-map .wm-leave-loc-btn').first().click({ timeout: 3000 }).catch(() => {});
    await until(async () => (await state()).board === '', 8000);
    await dropToasts();

    // 4. J3.1: la sala, por partes, con el rango arriba y la cama en «La casa».
    await enterPlace('gremio');
    let hall = await placeScene();
    const ids = hall.acts.map(a => a.id);
    check('J3.1: la sala por partes: el tablón, tu gente, la casa (con «Dormir en el gremio»), la memoria y la salida; el rango arriba',
        ['El tablón', 'Tu gente', 'La casa', 'La memoria del gremio', 'La salida'].every(g => hall.groups.includes(g))
        && ['hub-board', 'hub-errands', 'hub-heroes', 'hub-hire', 'hub-chest', 'hub-train', 'hub-house', 'hub-sleep', 'hub-memory', 'hub-exit'].every(id => ids.includes(id))
        && /^Rango D /.test(hall.rank), JSON.stringify({ groups: hall.groups, ids, rank: hall.rank }));
    await shot('sala');

    // 5. J3.4: el cofre. Antes, algo que no se lleve puesto: lo más barato de la tienda.
    await enterPlace('tienda');
    const buy = await page.evaluate(() => {
        const offers = [...document.querySelectorAll('#game-shell .gs-town-scene .gs-town-act[data-action^="shop-buy:"]:not([disabled])')];
        const cheapest = offers.map(b => ({ b, cost: Number((b.querySelector('.gs-btn-cost')?.textContent || '').replace(/\D+/g, '')) || 999 }))
            .sort((x, y) => x.cost - y.cost)[0];
        if (cheapest?.b instanceof HTMLElement) cheapest.b.click();
        return cheapest ? cheapest.b.getAttribute('data-action') : '';
    });
    await until(async () => (await state()).party[0].loose.length > 0, 8000);
    await page.evaluate(() => document.querySelectorAll('.popup:not([closing]) .popup-button-ok').forEach(b => /** @type {HTMLElement} */ (b).click()));
    await dropToasts();
    await enterPlace('gremio');
    const goldStart = (await state()).party[0].gold;
    await act('hub-chest');
    await dialogWith(/El cofre del gremio/);
    await page.locator('dialog[open] .hb-chest-amount').fill('10');
    await pressIn('.hb-chest-gold', /^Dejar oro$/);
    await until(async () => /10 de oro en el arca/.test(await windowText()), 6000);
    const afterDeposit = (await state()).party[0].gold;
    await page.locator('dialog[open] .hb-chest-amount').fill('4');
    await pressIn('.hb-chest-gold', /^Sacar oro$/);
    await until(async () => /6 de oro en el arca/.test(await windowText()), 6000);
    const afterWithdraw = (await state()).party[0].gold;
    check('J3.4: el arca: dejar 10 de oro y sacar 4 deja 6 en el arca, y la bolsa lo nota',
        afterDeposit === goldStart - 10 && afterWithdraw === goldStart - 6 && /6 de oro en el arca/.test(await windowText()), JSON.stringify({ goldStart, afterDeposit, afterWithdraw }));
    const loose = (await state()).party[0].loose;
    const stored = loose.length > 0 ? await pressIn('.hb-chest-row', /^Dejar en el cofre$/) : false;
    await page.waitForTimeout(500);
    const inChest = (await state()).storage;
    const tookBack = stored ? await pressIn('.hb-chest-row', /^Sacar para/) : false;
    await page.waitForTimeout(500);
    check('J3.4: lo comprado en la tienda (no se lleva puesto) se deja en el cofre y se saca otra vez',
        Boolean(buy) && loose.length > 0 && stored && inChest.length === 1 && tookBack && (await state()).storage.length === 0, JSON.stringify({ buy, loose, inChest, stored, tookBack }));
    await shot('cofre');
    await closeWindow();
    const chestLine = await until(async () => /6 de oro en el arca/.test((await placeScene()).acts.find(a => a.id === 'hub-chest')?.detail ?? ''), 6000);
    check('y la sala dice cómo está el cofre: el oro del arca', chestLine, JSON.stringify((await placeScene()).acts.find(a => a.id === 'hub-chest')));

    // 6. Tu gente: «Tus personajes» (con su «Cerrar») y contratar a un mercenario, antes de gastar el oro.
    await act('hub-heroes');
    const heroes = await dialogWith(/Tus personajes/);
    const heroesClose = await page.waitForSelector('dialog[open]:not([closing]) .hb-heroes ~ .hb-foot .hb-close, dialog[open]:not([closing]) .hb-root .hb-close', { timeout: 6000 }).then(() => true).catch(() => false);
    await closeWindow();
    await act('hub-hire');
    const hire = await page.waitForSelector('.hb-root [data-hireling]', { timeout: 10000 }).then(() => true).catch(() => false);
    const hireOffers = await page.evaluate(() => [...document.querySelectorAll('.hb-root [data-hireling]')].map(c => c.getAttribute('data-hireling')));
    await page.locator('.hb-root [data-hireling]').first().click({ timeout: 5000 }).catch(() => {});
    const hired = await until(async () => (await state()).party.length === 2, 8000);
    await closeWindow();
    check('J1.6 y J4: «Tus personajes» se abre y se cierra con su botón; «Contratar mercenarios» contrata a uno',
        heroes && heroesClose && hire && hired, JSON.stringify({ heroes, heroesClose, hire, hireOffers, party: (await state()).party.map(m => m.name) }));
    await dropToasts();

    // 7. J3.5: el patio: entrenar gasta la parte del día y da experiencia; con la bastante, subir de nivel ahí.
    const beforeTrain = await state();
    await act('hub-train');
    await dialogWith(/Patio de entrenamiento/);
    await shot('patio');
    const trained = await pressIn('.hb-training', /^Entrenar$/);
    await until(async () => (await state()).party[0].xp > beforeTrain.party[0].xp, 6000);
    const afterTrain = await state();
    check('J3.5: «Entrenar» da experiencia y se lleva la parte del día',
        trained && afterTrain.party[0].xp > beforeTrain.party[0].xp && (afterTrain.slot !== beforeTrain.slot || afterTrain.day !== beforeTrain.day),
        JSON.stringify({ xp: [beforeTrain.party[0].xp, afterTrain.party[0].xp], slot: [beforeTrain.slot, afterTrain.slot] }));
    await closeWindow();
    // Lo que da una pelea más, y el oro de una campaña, puestos a mano: aquí se miran los botones de
    // la sala (subir de nivel, los edificios y lo que abren), no ganar peleas.
    await page.evaluate(async () => {
        const hero = (await import('/scripts/party/state.js')).partyMembers[0];
        hero.xp = 300;
        hero.gold = 900;
        (await import('/scripts/party/roster.js')).savePartyState();
    });
    await act('hub-train');
    await dialogWith(/Patio de entrenamiento/);
    const levelButton = await pressIn('.hb-training', /^Subir de nivel$/);
    const levelCard = await page.waitForSelector('.lu-card', { timeout: 10000 }).then(() => true).catch(() => false);
    await page.evaluate(() => /** @type {HTMLElement|null} */ (document.querySelector('.lu-card .lu-perk'))?.click());
    await page.waitForTimeout(300);
    await page.evaluate(() => /** @type {HTMLElement|null} */ (document.querySelector('.lu-card .lu-confirm:not([disabled])'))?.click());
    const levelled = await until(async () => (await state()).party[0].level === 2, 8000);
    check('J3.5: con la experiencia, el patio ofrece «Subir de nivel» y abre su tarjeta: Mara sube al nivel 2', levelButton && levelCard && levelled,
        JSON.stringify({ levelButton, levelCard, level: (await state()).party[0].level }));
    await shot('nivel');
    await closeWindow();

    // 8. J3.6: los edificios abren cosas: la forja mejora el arma aquí mismo; la biblioteca dice
    // qué enseña; los dormitorios traen una espada de alquiler más.
    await act('hub-house');
    await dialogWith(/La casa del gremio/);
    const raise = (/** @type {string} */ key) => page.evaluate((k) => {
        const button = [...document.querySelectorAll(`dialog[open] .hb-card[data-building="${k}"] button`)].find(b => /^Mejorar$/.test((b.textContent || '').trim()) && !(/** @type {HTMLButtonElement} */ (b).disabled));
        if (button instanceof HTMLElement) button.click();
        return Boolean(button);
    }, key);
    const forgeUp = await raise('forge');
    await until(async () => Number((await state()).guild?.buildings?.forge) === 1, 6000);
    const forgeRow = await until(() => page.evaluate(() => Boolean(document.querySelector('dialog[open] .hb-forge .hb-forge-go:not([disabled])'))), 6000);
    const forgeText = await page.evaluate(() => (document.querySelector('dialog[open] .hb-forge')?.textContent || '').replace(/\s+/g, ' ').trim());
    await page.locator('dialog[open] .hb-forge .hb-forge-go:not([disabled])').first().click({ timeout: 5000 }).catch(() => {});
    const sharpened = await until(() => page.evaluate(async () => {
        const hero = (await import('/scripts/party/state.js')).partyMembers[0];
        return (hero.items ?? []).some((/** @type {any} */ i) => Number(i.magicalBonus) === 1);
    }), 6000);
    await shot('forja');
    check('J3.6: levantar la forja abre «La forja» en la misma ventana, y mejora el arma de Mara a +1',
        forgeUp && forgeRow && sharpened && /Espada larga: de \+0 a \+1/.test(forgeText), JSON.stringify({ forgeUp, forgeRow, sharpened, forgeText: forgeText.slice(0, 200) }));
    const libraryUp = await raise('library');
    await until(async () => Number((await state()).guild?.buildings?.library) === 1, 6000);
    const libraryText = await page.evaluate(() => (document.querySelector('dialog[open] .hb-library')?.textContent || '').replace(/\s+/g, ' ').trim());
    const bunksUp = await raise('bunks');
    await until(async () => Number((await state()).guild?.buildings?.bunks) === 1, 6000);
    const arrival = await until(async () => (await toasts()).some(t => /Iria Salitre deja su petate/.test(t)), 6000);
    const stableUp = await raise('stable');
    await until(async () => Number((await state()).guild?.buildings?.stable) === 1, 6000);
    check('J3.6: la biblioteca dice qué enseña (a Mara, guerrera, nada), los dormitorios traen a Iria Salitre y se levanta el establo',
        libraryUp && /La biblioteca \(nivel 1\)/.test(libraryText) && /lanza conjuros/.test(libraryText) && bunksUp && arrival && stableUp,
        JSON.stringify({ libraryUp, libraryText: libraryText.slice(0, 200), bunksUp, arrival, stableUp }));
    await closeWindow();
    await act('hub-hire');
    await page.waitForSelector('.hb-root [data-hireling]', { timeout: 10000 }).catch(() => {});
    const moreOffers = await page.evaluate(() => [...document.querySelectorAll('.hb-root [data-hireling]')].map(c => c.getAttribute('data-hireling')));
    check('J3.6: con los dormitorios, Iria Salitre se puede contratar en la sala', moreOffers.some(n => /Iria Salitre/.test(String(n))), JSON.stringify(moreOffers));
    await closeWindow();
    await dropToasts();

    // 9. J3.8: los encargos del tablón: aceptar uno. Y la memoria del gremio.
    await act('hub-errands');
    await dialogWith(/Encargos del tablón/);
    await shot('encargos');
    const offers = await page.evaluate(() => [...document.querySelectorAll('dialog[open] .hb-card .vt-name')].map(n => (n.textContent || '').trim()));
    const accepted = offers.length > 0 ? await pressIn('.hb-card', /^Aceptar$/) : false;
    if (!accepted) await closeWindow();
    const took = accepted ? await until(async () => Boolean((await state()).taken), 15000) : false;
    check('J3.8: los encargos del tablón se ven y se acepta uno', offers.length > 0 && accepted && took, JSON.stringify({ offers, taken: (await state()).taken }));
    await dropToasts();
    await enterPlace('gremio');
    await act('hub-memory');
    const memory = await dialogWith(/Lo que se recuerda de vosotros/);
    await closeWindow();
    check('J11.4: la memoria del gremio se abre con un clic, y se cierra', memory);
    await dropToasts();

    // 10. J3.3: dormir en el gremio: cura, amanece y guarda.
    await enterPlace('gremio');
    const beforeSleep = await state();
    await act('hub-sleep');
    const woke = await until(async () => (await state()).day === beforeSleep.day + 1, 10000);
    const sleptSlot = await until(async () => Boolean((await state()).slots?.dormir), 20000);
    const sleepToast = await until(async () => (await toasts()).some(t => /Dormís en el gremio/.test(t)), 8000);
    check('J3.3: «Dormir en el gremio» pasa la noche y guarda la partida en «Al dormir en el gremio», y lo dice',
        woke && sleptSlot && sleepToast, JSON.stringify({ day: [beforeSleep.day, (await state()).day], slots: Object.keys((await state()).slots), toasts: await toasts() }));
    await shot('dormir');
    await dropToasts();

    // 11. J15.2: dormir en la taberna también pasa el día: se guarda solo, en «Al empezar el día».
    await enterPlace('posada');
    const beforeInn = await state();
    await act('inn-room');
    await until(async () => (await state()).day === beforeInn.day + 1, 10000);
    await page.evaluate(() => document.querySelectorAll('.popup:not([closing]) .popup-button-ok').forEach(b => /** @type {HTMLElement} */ (b).click()));
    const autoSaved = await until(async () => Number((await state()).slots?.auto?.day) === beforeInn.day + 1, 25000);
    check('J15.2: al empezar el día se guarda solo, en «Al empezar el día»', autoSaved, JSON.stringify((await state()).slots?.auto ?? null));
    await dropToasts();

    // 12. J15.2 y J15.6: la pausa tiene «Guardar y cargar»: guardar en la ranura 1 y exportar.
    await carryOn('exploration');
    const pauseItems = await pauseItem('Guardar y cargar');
    const screenOpen = await page.waitForSelector('dialog.sv-dialog[open] .sv-slot', { timeout: 15000 }).then(() => true).catch(() => false);
    let seen = await saveScreen();
    check('J15.2: en la pausa, «Guardar y cargar» abre las ranuras: al dormir y al empezar el día, llenas, y las tres tuyas',
        pauseItems.includes('Guardar y cargar') && screenOpen && JSON.stringify(seen.slots.map(s => s.id)) === '["dormir","auto","1","2","3"]'
        && seen.slots[0].load && seen.slots[1].load && seen.slots[2].save, JSON.stringify({ pauseItems, seen }));
    await shot('guardar');
    await page.locator('.sv-dialog .sv-slot[data-slot="1"] .sv-save').click({ timeout: 5000 }).catch(() => {});
    const saved1 = await waitStatus(/Guardada en la ranura 1/);
    const goldAtSave = (await state()).party[0].gold;
    const downloading = page.waitForEvent('download', { timeout: 30000 }).catch(() => null);
    await page.locator('.sv-dialog .sv-export').click({ timeout: 5000 }).catch(() => {});
    const download = await downloading;
    const exportedPath = download ? join(work, download.suggestedFilename()) : '';
    if (download) await download.saveAs(exportedPath);
    const exported = exportedPath ? JSON.parse(readFileSync(exportedPath, 'utf8')) : null;
    check('J15.2 y J15.6: guardar en la ranura 1 y exportar la partida entera en un «.partida.json»',
        saved1 && Boolean(download) && /\.partida\.json$/.test(download?.suggestedFilename() ?? '') && exported?.worlds?.length >= 1 && exported?.chats?.length >= 1,
        JSON.stringify({ saved1, file: download?.suggestedFilename(), worlds: exported?.worlds?.length, chats: exported?.chats?.length }));
    await page.locator('.sv-dialog .sv-close').click({ timeout: 5000 }).catch(() => {});
    await until(async () => !(await saveScreen()).open, 5000);

    // 13. Gastar algo y cargar la ranura 1: vuelve como estaba.
    await enterPlace('posada');
    await act('inn-meal');
    await until(async () => (await state()).party[0].gold !== goldAtSave, 8000);
    const goldSpent = (await state()).party[0].gold;
    await pauseItem('Guardar y cargar');
    await page.waitForSelector('dialog.sv-dialog[open] .sv-slot', { timeout: 15000 }).catch(() => {});
    await page.locator('.sv-dialog .sv-slot[data-slot="1"] .sv-load').click({ timeout: 5000 }).catch(() => {});
    await confirmYes();
    const loaded = await until(async () => (await state()).world === hubWorld && (await state()).party[0]?.gold === goldAtSave, 45000);
    check('J15.2: cargar la ranura 1 devuelve la partida como se guardó (el oro de la comida, de vuelta)',
        goldSpent !== goldAtSave && loaded, JSON.stringify({ goldAtSave, goldSpent, now: (await state()).party[0]?.gold }));
    await until(async () => !(await saveScreen()).open, 15000);
    await dropToasts();

    // 14. Desde el título: «Cargar partida» dice las ranuras del gremio y las carga; «Importar una partida».
    await pauseItem('Salir al menu principal');
    await until(async () => (await state()).world === '', 20000);
    const loadMenu = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Cargar partida' });
    /** «Cargar partida» en el título; si ya está abierta su lista, se queda. */
    const openLoadList = async () => {
        await until(async () => await loadMenu.count() === 1 || await page.locator('#game-shell .gs-saves').count() === 1, 20000);
        if (await page.locator('#game-shell .gs-saves').count() === 0) await loadMenu.click();
        return until(() => page.evaluate(() => document.querySelectorAll('#game-shell .gs-save').length > 0), 20000);
    };
    await openLoadList();
    const titleCard = await page.evaluate((world) => {
        const node = document.querySelector(`#game-shell .gs-save[data-world="${world}"]`);
        return { slots: (node?.querySelector('.gs-save-slots')?.textContent || '').trim(), button: Boolean(node?.querySelector('.gs-save-load')),
            importer: Boolean(document.querySelector('#game-shell .gs-save-import')) };
    }, hubWorld);
    check('J15.2: en «Cargar partida», el gremio dice cuántas ranuras tiene y trae su botón «Ranuras»; al pie, «Importar una partida» (J15.6)',
        /^[3-5] ranuras guardadas$/.test(titleCard.slots) && titleCard.button && titleCard.importer, JSON.stringify(titleCard));
    await shot('cargar-partida');
    await page.locator(`#game-shell .gs-save[data-world="${hubWorld}"] .gs-save-load`).click({ timeout: 5000 }).catch(() => {});
    await page.waitForSelector('dialog.sv-dialog[open] .sv-slot', { timeout: 15000 }).catch(() => {});
    seen = await saveScreen();
    await page.locator('.sv-dialog .sv-slot[data-slot="dormir"] .sv-load').click({ timeout: 5000 }).catch(() => {});
    await confirmYes();
    const fromTitle = await until(async () => (await state()).world === hubWorld && (await state()).day === beforeSleep.day + 1, 45000);
    check('J15.2: desde el título, las ranuras del gremio: cargar «Al dormir en el gremio» abre el gremio en aquella mañana',
        /Las ranuras de/.test(seen.title) && seen.slots.every(s => !s.save) && fromTitle, JSON.stringify({ title: seen.title, day: (await state()).day, wanted: beforeSleep.day + 1 }));
    await until(async () => !(await saveScreen()).open, 15000);

    // 15. J15.6: importar la partida exportada, desde el título, y jugarla.
    await pauseItem('Salir al menu principal');
    await until(async () => (await state()).world === '', 20000);
    await openLoadList();
    await page.locator('#game-shell .gs-save-import').click({ timeout: 8000 }).catch(() => {});
    await page.waitForSelector('dialog.sv-dialog[open]', { timeout: 10000 }).catch(() => {});
    if (exportedPath) await page.setInputFiles('.sv-dialog .sv-file', exportedPath).catch(() => {});
    const imported = await waitStatus(/Partida importada/, 60000);
    await shot('importada');
    await page.locator('.sv-dialog .sv-play').click({ timeout: 5000 }).catch(() => {});
    const playing = await until(async () => /\(2\)$/.test((await state()).world), 45000);
    check('J15.6: «Importar una partida» mete la exportada como copia, y «Jugarla ahora» la abre', imported && playing, JSON.stringify({ imported, world: (await state()).world }));
    await dropToasts();

    // 16. J14: quedar con alguien desde la pantalla del pueblo, sin escribir nada: su escena, entera.
    await carryOn('exploration');
    await page.locator('#game-shell .gs-town-back').click({ timeout: 3000 }).catch(() => {});
    await until(() => page.evaluate(() => document.querySelectorAll('#game-shell .gs-town-place').length > 0), 10000);
    const meetButton = page.locator('#game-shell .gs-town-loose .gs-town-act[data-chip^="quedar:"]').first();
    const meetWho = String(await meetButton.getAttribute('data-chip', { timeout: 5000 }).catch(() => ''));
    const slotBeforeMeet = await state();
    await meetButton.click({ timeout: 5000 }).catch(() => {});
    const meetOpen = await page.waitForSelector('.qd-dialog[open] .qd-chip', { timeout: 15000 }).then(() => true).catch(() => false);
    await shot('quedar');
    for (let i = 0; i < 16; i++) {
        if (!(await page.locator('.qd-dialog[open]').count())) break;
        if (await page.locator('.qd-dialog[open] .qd-chip-reply').count() > 0) await page.locator('.qd-dialog[open] .qd-chip-reply').first().click();
        else await page.locator('.qd-dialog[open] .qd-chip').first().click();
        await page.waitForTimeout(250);
    }
    const metSpent = await until(async () => {
        const after = await state();
        return after.slot !== slotBeforeMeet.slot || after.day !== slotBeforeMeet.day;
    }, 8000);
    const bonded = await chatHas(/💞 \[VÍNCULO\]/);
    check('J14.3 y J15.4: «Quedar con …» en «Por el pueblo» abre su escena sin escribir la orden; al acabar, el vínculo sube y se va la parte del día',
        Boolean(meetWho) && meetOpen && metSpent && bonded, JSON.stringify({ meetWho, meetOpen, metSpent, bonded }));
    await dropToasts();

    // 17. J4.6: el tablón dice si la campaña se os queda corta, y que los enemigos aprietan más.
    await page.evaluate(async () => {
        const live = (await import('/scripts/party/state.js')).partyMembers[0];
        live.level = 8;
        live.xp = 34000;
        (await import('/scripts/party/roster.js')).savePartyState();
    });
    await enterPlace('gremio');
    await act('hub-board');
    await page.waitForSelector('.hb-root [data-campaign="strahd"]', { timeout: 15000 }).catch(() => {});
    const strahd = await page.evaluate(() => (document.querySelector('.hb-root [data-campaign="strahd"]')?.textContent || '').replace(/\s+/g, ' '));
    check('J4.6: con el grupo a nivel 8, la tarjeta de Strahd dice su nivel y que los enemigos aprietan más',
        /Nivel recomendado: 1 a 7/.test(strahd) && /nivel 8, más de lo que pide: los enemigos aprietan más/.test(strahd), strahd.slice(0, 300));
    check('J3.6: con las mulas del establo, Strahd queda más cerca: menos de nueve días de camino',
        /A (siete|seis|ocho) días de camino/.test(strahd) && !/nueve días/.test(strahd), strahd.slice(0, 300));
    await shot('tablon');
    await page.locator('.hb-root .hb-close').click({ timeout: 5000 }).catch(() => {});
    await until(() => page.evaluate(() => document.querySelectorAll('dialog[open]:not([closing])').length === 0), 6000);

    // 17b. J15.4: lo que hacía `/cuenta`, con su botón: la Mesa de arriba, «Parte a parte».
    await dropToasts();
    await page.locator('#game-shell .gs-table').click({ timeout: 5000 }).catch(() => {});
    const tableOpen = await page.waitForSelector('.wt-root', { timeout: 10000 }).then(() => true).catch(() => false);
    const billButton = await page.locator('.wt-root .wt-bill-detail').count() > 0;
    if (billButton) await page.locator('.wt-root .wt-bill-detail').click({ timeout: 5000 }).catch(() => {});
    const billToast = billButton ? await until(async () => (await toasts()).some(t => /^La cuenta/.test(t)), 8000) : false;
    await shot('mesa');
    check('J15.4: la Mesa dice la cuenta de la semana y «Parte a parte» la desglosa, sin escribir `/cuenta`',
        tableOpen && billButton && billToast, JSON.stringify({ tableOpen, billButton, toasts: (await toasts()).slice(0, 3) }));
    await page.locator('.popup:not([closing]) :is(.popup-button-ok, .popup-button-cancel):visible').last().click({ timeout: 5000 }).catch(() => {});
    await until(() => page.evaluate(() => document.querySelectorAll('dialog[open]:not([closing])').length === 0), 6000);
    await dropToasts();

    // 17c. J15.4: «Cómo se juega», sin conexión, nombra botones y no comandos.
    await pauseItem('Cómo se juega');
    const helpOpen = await page.waitForSelector('.hp-root .hp-lines', { timeout: 10000 }).then(() => true).catch(() => false);
    const helpText = await page.evaluate(() => (document.querySelector('.hp-root')?.textContent || '').replace(/\s+/g, ' '));
    await shot('ayuda');
    check('J15.4: «Cómo se juega» sin conexión no manda escribir ningún comando: dice cada botón',
        helpOpen && !/(^|\s)\/[a-z]/.test(helpText) && !/escribes en el chat/.test(helpText) && /«Guardar y cargar», en la pausa/.test(helpText),
        helpText.slice(0, 300));
    await page.locator('.popup:not([closing]) .popup-button-ok:visible').last().click({ timeout: 5000 }).catch(() => {});
    await until(() => page.evaluate(() => document.querySelectorAll('dialog[open]:not([closing])').length === 0), 6000);

    // 18. J20: en el móvil, la sala y el cofre caben, sin barra de lado a lado, con botones de dedo.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(800);
    await enterPlace('gremio');
    const hallFits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    await shot('movil-sala');
    await act('hub-chest');
    await dialogWith(/El cofre del gremio/);
    await page.waitForTimeout(400);
    const chestPhone = await page.evaluate(() => {
        const dialog = [...document.querySelectorAll('dialog[open]:not([closing])')].pop();
        const box = dialog?.getBoundingClientRect();
        const buttons = [...(dialog?.querySelectorAll('.hb-chest-row .menu_button, .hb-chest-gold .menu_button') ?? [])].map(b => b.getBoundingClientRect());
        return {
            wide: document.documentElement.scrollWidth <= window.innerWidth + 1,
            inside: Boolean(box) && (box?.left ?? -1) >= -1 && (box?.right ?? 9999) <= window.innerWidth + 1,
            tap: buttons.length > 0 ? Math.min(...buttons.map(b => b.height)) : 0,
        };
    });
    await shot('movil-cofre');
    check('J20: en el móvil, la sala y el cofre caben, sin barra de lado a lado, y sus botones son de dedo',
        hallFits && chestPhone.wide && chestPhone.inside && chestPhone.tap >= 40, JSON.stringify({ hallFits, chestPhone }));
    await closeWindow();
    await page.setViewportSize({ width: 1400, height: 950 });
    await page.waitForTimeout(600);

    // 19. J3.8: el sitio del encargo aceptado sale en «Viajar», y se llega andando desde Puerto Alba.
    await carryOn('exploration');
    await page.locator('#game-shell .gs-town-back').click({ timeout: 3000 }).catch(() => {});
    const errandPlace = await page.evaluate(() => String(window.SillyTavern.getContext().chatMetadata?.contractTaken?.locationName ?? ''));
    const travelCards = await page.evaluate(() => [...document.querySelectorAll('#game-shell .ex-column[data-col="travel"] .gs-place .gs-place-name')].map(n => (n.textContent || '').trim()));
    await page.locator('#game-shell .ex-column[data-col="travel"] .gs-place').filter({ hasText: errandPlace || '—' }).first().click({ timeout: 5000 }).catch(() => {});
    await page.locator('.popup:visible .tr-pace-normal, .popup:visible .popup-button-custom').first().click({ timeout: 8000 }).catch(() => {});
    // Por el camino puede salir algo al paso (una ventana): se sigue, como quien juega.
    const arrived = await until(async () => {
        await page.evaluate(() => {
            for (const popup of document.querySelectorAll('.popup:not([closing])')) {
                const go = [...popup.querySelectorAll('.popup-button-ok, .popup-button-custom')].find(b => /Seguir|Continuar|Cerrar|Vale|Aceptar/.test(b.textContent || ''));
                if (go instanceof HTMLElement) go.click();
            }
        });
        return Boolean(errandPlace) && (await state()).location === errandPlace;
    }, 45000);
    await shot('encargo-sitio');
    check('J3.8: aceptar el encargo pone su sitio en «Viajar» (estaba escondido), y se llega a él',
        Boolean(errandPlace) && travelCards.includes(errandPlace) && arrived, JSON.stringify({ errandPlace, travelCards, at: (await state()).location }));

    const real = problems.filter(p => !/favicon|thumbnail|Failed to fetch.*extensions|tokenizer/i.test(p));
    check('sin errores en la página', real.length === 0, real.slice(0, 8).join('\n        '));
} catch (error) {
    failures++;
    console.log(`FAIL  el recorrido se ha roto: ${String(/** @type {any} */ (error)?.stack ?? error)}`);
    if (SHOT && page) await page.screenshot({ path: `${SHOT}.error.png` }).catch(() => {});
} finally {
    await browser?.close().catch(() => {});
    server?.kill();
    await new Promise(resolve => setTimeout(resolve, 800));
    for (const dir of [dataRoot, work]) {
        try {
            rmSync(dir, { recursive: true, force: true });
        } catch { /* Windows a veces lo tiene cogido un momento */ }
    }
    console.log(failures === 0 ? '\nTodo bien.' : `\n${failures} fallo(s).`);
    process.exit(failures === 0 ? 0 : 1);
}
