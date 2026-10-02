#!/usr/bin/env node
/**
 * J4.2 de ROADMAP_SIN_CONEXION, «la partida es el gremio»: dos campañas en la misma partida, y el
 * gremio el mismo en las dos. Contra un servidor propio con un `--dataRoot` temporal, como
 * `e2e-saltar-prueba.mjs`, con el ratón donde lo hace quien juega:
 *
 *   título → Jugar sin conexión → tu personaje → saltar la prueba → dejar 10 de oro en el arca
 *   (la sala del gremio) → el tablón → Strahd: el arca está igual → un encargo cumplido en
 *   Strahd (+2 de renombre) → volver al gremio: la sala lo dice → el tablón → 1387: el mismo
 *   gremio, con el renombre de Strahd → un encargo en 1387 (+4) → volver → seguir Strahd: allí
 *   también se ve lo de 1387 → recargar la página: sigue igual.
 *
 *   Y una partida de antes de J4.2 (un gremio en cada chat, sin almacén): al abrirla no se pierde
 *   nada; el renombre de cada chat se suma una vez, y las dos campañas acaban con el mismo.
 *
 * Los encargos se cumplen con el motor (`finishTakenContract`), que es lo que corre al
 * entregar uno: lo que se mira aquí es el gremio compartido, no el tablón de encargos.
 *
 * Uso:
 *   node tools/e2e-gremio-compartido.mjs --port 8386
 *   node tools/e2e-gremio-compartido.mjs --port 8386 --captura gremio.png   # gremio.png.strahd.png, …
 *   node tools/e2e-gremio-compartido.mjs --headed
 */

/* global window, document, HTMLElement */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8386;
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

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-compartido-'));
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
 * Elegir en una tarjeta de «Crear personaje» la opción que se parece a lo pedido, o la primera.
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
    browser = await chromium.launch({ channel: 'msedge', headless: !HEADED });
    const context = await browser.newContext({ viewport: { width: 1400, height: 950 } });
    page = await context.newPage();
    /** @type {string[]} */
    const problems = [];
    page.on('pageerror', e => problems.push(`PAGEERROR ${e.message}`));
    page.on('console', m => {
        if (m.type() === 'error' && !/Failed to load resource.*404/.test(m.text())) problems.push(`ERROR ${m.text().slice(0, 300)}`);
    });
    page.on('response', r => { if (r.status() >= 500) problems.push(`HTTP ${r.status()} ${r.request().method()} ${r.url()}`); });
    await context.addInitScript(() => {
        try {
            // Los consejos, vistos: aquí se mira el gremio compartido, no enseñar a jugar.
            window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,combat,travel,prisoners,mesa,high,spell,pet,bill,move,attack,roll,talk,journal');
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
            window.localStorage.setItem('sillytavern_gameSucesos', 'off');
            window.localStorage.setItem('sillytavern_gameStoryWindows', 'off');
        } catch { /* nada */ }
    });

    /** Lo que el juego sabe ahora: el mundo, el chat, el grupo y su copia del gremio. */
    const state = () => page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const party = (await import('/scripts/party.js')).getPartyMembersSnapshot();
        const meta = ctx.chatMetadata ?? {};
        return {
            world: String(meta.world_info ?? ''),
            chat: String(ctx.getCurrentChatId?.() ?? ''),
            board: String(meta.currentBoard ?? ''),
            party: party.map((/** @type {any} */ m) => ({ name: m.name, gold: Number(m.gold) || 0 })),
            renown: Number(meta.guild?.renown) || 0,
            chest: Number(meta.guild?.gold) || 0,
            rev: Number(meta.hubStateRev) || 0,
        };
    });
    /** El almacén de la partida, en el mundo del gremio, leído del disco. */
    const store = (/** @type {string} */ hubWorld) => page.evaluate(async (name) => {
        const { loadWorldInfo } = await import('/scripts/world-info.js');
        const data = await loadWorldInfo(name);
        const saved = data?.metadata?.hubState ?? null;
        return saved ? { rev: Number(saved.rev) || 0, renown: Number(saved.keys?.guild?.renown) || 0, chest: Number(saved.keys?.guild?.gold) || 0, folded: saved.folded ?? [] } : null;
    }, hubWorld);
    const chips = () => page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-chip-action')].map(c => (c.textContent || '').trim()));
    const clickChip = (/** @type {RegExp} */ pattern) => page.evaluate((source) => {
        const chip = [...document.querySelectorAll('#game-shell .gs-chip-action')].find(b => new RegExp(source).test(b.textContent || ''));
        if (chip instanceof HTMLElement) chip.click();
        return Boolean(chip);
    }, pattern.source);
    const chatHas = (/** @type {RegExp} */ pattern) => page.evaluate((source) => (window.SillyTavern.getContext().chat || [])
        .some((/** @type {any} */ m) => new RegExp(source).test(String(m.extra?.display_text || m.mes || ''))), pattern.source);
    const dropToasts = () => page.evaluate(() => document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));
    /** Espera a que se cumpla algo, sin dormir de más. */
    const until = async (/** @type {() => Promise<boolean>} */ test, ms = 30000) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (await test().catch(() => false)) return true;
            await page.waitForTimeout(400);
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
            acts: [...(scene?.querySelectorAll('.gs-town-act') ?? [])].map(b => ({
                id: b.getAttribute('data-action') || '',
                detail: (b.querySelector('.gs-btn-detail')?.textContent || '').trim(),
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
    const dialogWith = (/** @type {RegExp} */ pattern) => until(() => page.evaluate((source) => [...document.querySelectorAll('dialog[open]:not([closing])')]
        .some(d => new RegExp(source).test(d.textContent || '')), pattern.source), 10000);
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
    const shot = async (/** @type {string} */ what) => { if (SHOT) await page.screenshot({ path: `${SHOT}.${what}.png` }); };
    /** La sala del gremio: el rango (con el renombre) y lo que dice el cofre. */
    const hallSays = async () => {
        for (let tries = 0; tries < 3; tries++) {
            await dropToasts();
            await page.evaluate(() => document.querySelectorAll('.popup:not([closing]) .popup-button-ok').forEach(b => /** @type {HTMLElement} */ (b).click()));
            if (await enterPlace('gremio')) break;
        }
        await page.waitForTimeout(400);
        const hall = await placeScene();
        return { rank: hall.rank, chest: hall.acts.find(a => a.id === 'hub-chest')?.detail ?? '' };
    };
    /** El chat abierto, con la versión del almacén: el viaje lo pone al día al llegar. */
    const synced = (/** @type {string} */ hubWorld) => until(async () => {
        const rev = (await state()).rev;
        return rev > 0 && rev === (await store(hubWorld))?.rev;
    }, 30000);
    /** Antes de recargar, lo que se está guardando termina (si no, el navegador lo corta). */
    const settle = () => page.waitForTimeout(2500);
    /**
     * Recargar la página y seguir como quien vuelve a jugar: si la portada no abre la partida
     * sola, «Continuar». Abierta de verdad es con su mundo: al arrancar, el chat puede estar
     * elegido sin haberse leído todavía.
     */
    const reloadAndContinue = async (/** @type {string} */ chatId, /** @type {string} */ label) => {
        await settle();
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
        await page.waitForSelector('#game-shell', { timeout: 90000 });
        const open = async () => {
            const now = await state();
            return now.chat === chatId && Boolean(now.world);
        };
        if (!(await until(open, 15000))) {
            await shot(`${label}-portada`);
            await page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Continuar' }).click({ timeout: 15000 }).catch(() => {});
            await until(open, 60000);
        }
        await page.waitForTimeout(1000);
        await shot(label);
    };
    /** Del pueblo del gremio al tablón de campañas, y a una de ellas. */
    const goToCampaign = async (/** @type {string} */ id, /** @type {RegExp} */ worldPattern, /** @type {string} */ hubWorldName) => {
        await dropToasts();
        await carryOn('exploration');
        if (!(await clickChip(/Tablón de campañas/))) {
            await enterPlace('gremio');
            await act('hub-board');
        }
        await page.waitForSelector(`.hb-root [data-campaign="${id}"]`, { timeout: 15000 }).catch(() => {});
        await page.locator(`.hb-root [data-campaign="${id}"]`).click({ timeout: 5000 }).catch(() => {});
        const there = await until(async () => worldPattern.test((await state()).world), 150000);
        await page.waitForTimeout(1500);
        await clearDice();
        return there && await synced(hubWorldName);
    };
    /** Volver al gremio desde una campaña, con la ficha de la fila. */
    const goHome = async (/** @type {string} */ hubWorld) => {
        await dropToasts();
        await clearDice();
        await carryOn('exploration');
        if (!(await clickChip(/Volver al gremio/))) {
            await clickChip(/\+\d+ más$/);
            await page.locator('.popup[open] .hp-item').filter({ hasText: /Volver al gremio/ }).first().click({ timeout: 5000 }).catch(() => {});
        }
        const home = await until(async () => (await state()).world === hubWorld, 90000);
        await page.waitForTimeout(1500);
        return home && await synced(hubWorld);
    };
    /** Un encargo cumplido aquí, como lo entrega el juego: el oro al grupo y el renombre al gremio. */
    const finishContract = (/** @type {string} */ rank) => page.evaluate(async (r) => {
        const contracts = await import('/scripts/party/contracts.js');
        contracts.finishTakenContract({ rank: r, reward: 5, title: 'Un encargo de prueba' });
        await window.SillyTavern.getContext().saveMetadata();
    }, rank);

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    const firstRun = page.locator('text=Welcome to SillyTavern!');
    if (await firstRun.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#game-shell', { timeout: 90000 });

    // 1. Una partida nueva: Iria, y la prueba saltada.
    const offline = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Jugar sin conexión' });
    await until(async () => await offline.count() === 1, 30000);
    await offline.click();
    await page.waitForSelector('.hc-root', { timeout: 120000 });
    await page.fill('.hc-root .hc-name', 'Iria');
    await pickHeroCard(page, 'race', 'Humano');
    await pickHeroCard(page, 'class', 'Guerrero');
    await page.locator('.hc-root .hc-enter').click();
    await until(async () => /Gremio/.test((await state()).world) && (await state()).party[0]?.name === 'Iria', 60000);
    await until(() => chatHas(/Al ladrón/), 20000);
    await page.waitForTimeout(800);
    await until(async () => (await chips()).some(c => /^Saltar la prueba$/.test(c)), 15000);
    await clickChip(/^Saltar la prueba$/);
    await page.waitForSelector('.popup:has-text("¿Saltar la prueba?")', { timeout: 10000 }).catch(() => {});
    await page.locator('.popup-button-ok:visible').first().click({ timeout: 5000 }).catch(() => {});
    await until(() => chatHas(/apunta tu nombre en el libro del gremio/), 15000);
    await page.waitForTimeout(1000);
    await clearDice();
    await carryOn('exploration');
    let now = await state();
    const hubWorld = now.world;
    const hubChat = now.chat;
    const created = await until(async () => (await store(hubWorld)) !== null && (await state()).rev >= 1, 20000);
    check('una partida nueva del gremio tiene su almacén en el mundo del gremio, y el chat sabe qué versión lleva',
        /Gremio/.test(hubWorld) && created && now.rev >= 1, JSON.stringify({ now, store: await store(hubWorld) }));

    // 2. En la sala del gremio, 10 de oro al arca, con el ratón.
    await enterPlace('gremio');
    await act('hub-chest');
    await dialogWith(/El cofre del gremio/);
    await page.locator('dialog[open] .hb-chest-amount').fill('10');
    await pressIn('.hb-chest-gold', /^Dejar oro$/);
    await page.waitForTimeout(600);
    await closeWindow();
    now = await state();
    const homeHall = await hallSays();
    check('en la sala del gremio se dejan 10 de oro en el arca', now.chest === 10 && /10 de oro en el arca/.test(homeHall.chest), JSON.stringify({ chest: now.chest, homeHall }));
    await shot('arca');
    await act('hub-exit');
    await page.waitForTimeout(400);

    // 3. A Strahd: el gremio va con la partida, no se queda en el chat del gremio.
    const inStrahd = await goToCampaign('strahd', /Strahd/, hubWorld);
    now = await state();
    const strahdWorld = now.world;
    const strahdChat = now.chat;
    let saved = await store(hubWorld);
    check('en Strahd, el gremio es el de la partida: el arca con sus 10 de oro, y la misma versión que el almacén',
        inStrahd && now.chest === 10 && saved !== null && now.rev === saved.rev && saved.chest === 10, JSON.stringify({ now, saved }));
    await shot('strahd');

    // 4. Un encargo en Strahd: +2 de renombre (rango C). Y de vuelta al gremio.
    await finishContract('C');
    now = await state();
    check('un encargo cumplido en Strahd sube el renombre del gremio a 2', now.renown === 2, JSON.stringify(now));
    const backFromStrahd = await goHome(hubWorld);
    now = await state();
    saved = await store(hubWorld);
    const hallAfterStrahd = await hallSays();
    check('de vuelta en el gremio, el renombre ganado en Strahd está, y la sala lo dice (antes se quedaba en el chat de Strahd)',
        backFromStrahd && now.chat === hubChat && now.renown === 2 && now.chest === 10 && /\b2 de renombre/.test(hallAfterStrahd.rank) && saved?.renown === 2,
        JSON.stringify({ now, saved, hallAfterStrahd }));
    await shot('vuelta-strahd');
    await act('hub-exit');
    await page.waitForTimeout(400);

    // 5. A 1387: otra campaña, el mismo gremio.
    const in1387 = await goToCampaign('1387', /1387/, hubWorld);
    now = await state();
    const world1387 = now.world;
    check('en 1387, otra campaña de la misma partida, el gremio es el mismo: 2 de renombre y 10 de oro en el arca',
        in1387 && world1387 !== strahdWorld && now.renown === 2 && now.chest === 10, JSON.stringify(now));
    await shot('1387');
    await finishContract('B');
    now = await state();
    check('un encargo cumplido en 1387 lo sube a 6', now.renown === 6, JSON.stringify(now));
    const backFrom1387 = await goHome(hubWorld);
    now = await state();
    check('y en el gremio se ve: 6 de renombre', backFrom1387 && now.renown === 6 && now.chest === 10, JSON.stringify(now));
    await act('hub-exit').catch(() => false);

    // 6. Seguir Strahd: allí también se ve lo ganado en 1387.
    const backInStrahd = await goToCampaign('strahd', /Strahd/, hubWorld);
    now = await state();
    saved = await store(hubWorld);
    check('al seguir Strahd, su gremio trae lo ganado en 1387: 6 de renombre, el mismo que en el gremio y en 1387',
        backInStrahd && now.chat === strahdChat && now.renown === 6 && now.chest === 10 && saved?.renown === 6 && now.rev === saved?.rev,
        JSON.stringify({ now, saved }));
    await shot('strahd-otra-vez');

    // 7. Recargar la página: lo mismo.
    await reloadAndContinue(strahdChat, 'recarga-strahd');
    await synced(hubWorld);
    now = await state();
    check('al recargar la página, Strahd sigue con el gremio de la partida', now.chat === strahdChat && now.renown === 6 && now.chest === 10, JSON.stringify(now));

    // 8. Una partida de antes de J4.2: un gremio en cada chat y ningún almacén. Se vuelve al
    // gremio y se deja como estaba entonces: el gremio (1 de renombre, 30 de oro), Strahd (3) y
    // 1387 (2), cada uno por su lado.
    await goHome(hubWorld);
    const hubRecord = await page.evaluate(async (name) => {
        const { loadWorldInfo } = await import('/scripts/world-info.js');
        return (await loadWorldInfo(name))?.metadata?.hub ?? null;
    }, hubWorld);
    const oldSave = await page.evaluate(async ({ record, hubName }) => {
        const ctx = window.SillyTavern.getContext();
        /** Un chat guardado, con su gremio de antes y sin versión. */
        const rewrite = async (/** @type {any} */ chat, /** @type {any} */ guild) => {
            const body = (/** @type {any} */ extra) => JSON.stringify({ avatar_url: chat.avatar, file_name: chat.file, ...extra });
            const lines = await (await fetch('/api/chats/get', { method: 'POST', headers: ctx.getRequestHeaders(), body: body({}) })).json();
            const head = lines[0];
            head.chat_metadata = { ...head.chat_metadata, guild };
            delete head.chat_metadata.hubStateRev;
            const saved = await fetch('/api/chats/save', { method: 'POST', headers: ctx.getRequestHeaders(), body: body({ chat: lines, force: true }) });
            return saved.ok;
        };
        const strahd = await rewrite(record.campaigns.strahd.chat, { renown: 3 });
        const other = await rewrite(record.campaigns['1387'].chat, { renown: 2 });
        // El mundo del gremio, sin almacén.
        const { loadWorldInfo, saveWorldInfo } = await import('/scripts/world-info.js');
        const data = await loadWorldInfo(hubName);
        delete data.metadata.hubState;
        await saveWorldInfo(hubName, data, true);
        // Y el chat del gremio, abierto, el último en guardarse.
        ctx.chatMetadata.guild = { renown: 1, gold: 30 };
        delete ctx.chatMetadata.hubStateRev;
        await ctx.saveMetadata();
        return { strahd, other };
    }, { record: hubRecord, hubName: hubWorld });
    check('(preparado: una partida con un gremio en cada chat y sin almacén)', oldSave.strahd && oldSave.other && (await store(hubWorld)) === null, JSON.stringify(oldSave));
    await reloadAndContinue(hubChat, 'recarga-partida-de-antes');
    await synced(hubWorld);
    now = await state();
    saved = await store(hubWorld);
    check('la partida de antes se abre: el gremio, tal cual, y el almacén se crea con él',
        now.chat === hubChat && now.renown === 1 && now.chest === 30 && saved?.renown === 1 && saved?.chest === 30, JSON.stringify({ now, saved }));
    const oldStrahd = await goToCampaign('strahd', /Strahd/, hubWorld);
    now = await state();
    check('al seguir Strahd, su gremio de antes se suma una vez: 1 + 3 = 4 de renombre, con los 30 de oro del arca',
        oldStrahd && now.chat === strahdChat && now.renown === 4 && now.chest === 30, JSON.stringify(now));
    await goHome(hubWorld);
    const oldHall = await hallSays();
    now = await state();
    check('y en el gremio, lo mismo: 4 de renombre, y la sala lo dice', now.renown === 4 && /\b4 de renombre/.test(oldHall.rank), JSON.stringify({ now, oldHall }));
    await act('hub-exit').catch(() => false);
    const old1387 = await goToCampaign('1387', /1387/, hubWorld);
    now = await state();
    saved = await store(hubWorld);
    check('y al seguir 1387, lo suyo se suma también: 6, el mismo gremio en las dos campañas y en casa',
        old1387 && now.renown === 6 && now.chest === 30 && saved?.renown === 6 && saved?.folded.length === 3, JSON.stringify({ now, saved }));
    await goHome(hubWorld);
    await goToCampaign('strahd', /Strahd/, hubWorld);
    now = await state();
    check('y Strahd, otra vez: 6 (fundido una sola vez, no se suma dos veces)', now.renown === 6 && now.chest === 30, JSON.stringify(now));
    await shot('fin');

    check('sin errores en la página', problems.length === 0, problems.slice(0, 6).join('\n        '));
} catch (error) {
    failures++;
    console.log(`FAIL  the run threw: ${/** @type {any} */ (error)?.message || error}`);
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
