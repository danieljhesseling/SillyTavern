#!/usr/bin/env node
/**
 * Las decisiones de reglas y datos del 2026-09-29 (sección 2.1 de ROADMAP_SIN_CONEXION), en el
 * navegador y jugando como quien juega, contra un servidor propio con un `--dataRoot` temporal
 * (como `e2e-magia.mjs`):
 *
 *   crear un erudito → empieza con su bolsa de componentes (D-J25) → saltar la prueba y salir
 *   al pueblo: el gremio, el primero (D-J30) → la ficha y el grimorio: «Lanzar un ritual»
 *   (D-J27), con lo que falta dicho llano (la perla, el incienso) → lanzar Detectar magia →
 *   con una perla y algo sin identificar, Identificar → de noche, la tienda y la herrería
 *   cerradas, con su cartel, y la tendera en la taberna; el día de descanso, cerradas todo el
 *   día (D-J29) → de día, comprar no pasa la parte del día (D-J31) y el laúd va a la bardo
 *   que no tiene foco (D-J25) → un clérigo que llega sin nada trae su bolsa (D-J25).
 *
 * Uso:
 *   node tools/e2e-reglas.mjs --port 8163 --captura C:/tmp/reglas.png
 *   (las capturas salen como reglas-1-pueblo.png, reglas-2-rituales.png…)
 */

/* global window, document, HTMLElement */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8163;
const BASE = `http://127.0.0.1:${PORT}`;
const HEADED = process.argv.includes('--headed');
const SHOT = argAfter('--captura');
const shot = (/** @type {string} */ name) => (SHOT ? SHOT.replace(/(\.png)?$/i, `-${name}.png`) : '');

const require = createRequire(join(ROOT, 'tests/package.json'));
const { chromium } = require('@playwright/test');

let failures = 0;
const check = (/** @type {string} */ name, /** @type {boolean} */ ok, detail = '') => {
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        -> ${detail}` : ''}`);
};

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-reglas-'));
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
 * Elegir en una tarjeta de «Crear personaje», como en `e2e-gremio.mjs`.
 *
 * @param {any} p
 * @param {string} pick
 * @param {string} wanted
 */
async function pickHeroCard(p, pick, wanted) {
    await p.locator(`.hc-root .hc-card[data-pick="${pick}"] .hc-pick`).click();
    await p.waitForSelector('.hc-picker .hc-option', { timeout: 15000 });
    const plain = (/** @type {string} */ v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const values = await p.evaluate(() => [...document.querySelectorAll('.hc-picker .hc-option')].map(o => o.getAttribute('data-value') || ''));
    const chosen = values.find(v => plain(v) === plain(wanted)) ?? values.find(v => plain(v).startsWith(plain(wanted).slice(0, 4))) ?? values[0];
    await p.locator(`.hc-picker .hc-option[data-value="${chosen}"]`).first().click();
    await p.waitForSelector('.hc-picker', { state: 'detached', timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(200);
    return chosen;
}

try {
    await startServer();
    browser = await chromium.launch({ channel: 'msedge', headless: !HEADED });
    const context = await browser.newContext({ viewport: { width: 1400, height: 950 } });
    page = await context.newPage();
    /** @type {string[]} */
    const problems = [];
    page.on('pageerror', (/** @type {any} */ e) => problems.push(`PAGEERROR ${e.message}`));
    page.on('console', (/** @type {any} */ m) => {
        if (m.type() === 'error' && !/Failed to load resource.*404/.test(m.text())) problems.push(`ERROR ${m.text().slice(0, 300)}`);
    });
    await context.addInitScript(() => {
        try {
            window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,travel,prisoners,mesa,high,spell,pet,bill,fight,move,journal,combat,attack,roll,talk');
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
            window.localStorage.setItem('sillytavern_gameSucesos', 'off');
            window.localStorage.setItem('sillytavern_gameStoryWindows', 'off');
        } catch { /* nada */ }
    });

    const until = async (/** @type {() => Promise<boolean>} */ test, ms = 30000) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (await test().catch(() => false)) return true;
            await page.waitForTimeout(400);
        }
        return false;
    };
    const chips = () => page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-chip-action')].map(c => (c.textContent || '').trim()));
    const clickChip = (/** @type {RegExp} */ pattern) => page.evaluate((/** @type {string} */ source) => {
        const chip = [...document.querySelectorAll('#game-shell .gs-chip-action')].find(b => new RegExp(source).test(b.textContent || ''));
        if (chip instanceof HTMLElement) chip.click();
        return Boolean(chip);
    }, pattern.source);
    const chatHas = (/** @type {RegExp} */ pattern) => page.evaluate((/** @type {string} */ source) => (window.SillyTavern.getContext().chat || [])
        .some((/** @type {any} */ m) => new RegExp(source).test(String(m.extra?.display_text || m.mes || ''))), pattern.source);
    const dropToasts = () => page.evaluate(() => document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));
    const sceneNow = () => page.evaluate(() => document.querySelector('#game-shell')?.getAttribute('data-scene') || '');
    const carryOn = async (/** @type {string} */ wanted) => {
        await until(async () => {
            if (await sceneNow() === wanted) return true;
            await page.evaluate(() => /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .gs-vn-box .gs-chip-continue'))?.click());
            return false;
        }, 10000);
        return sceneNow();
    };
    /** El grupo, tal cual lo tiene el juego. */
    const party = () => page.evaluate(async () => {
        const { partyMembers } = await import('/scripts/party/state.js');
        return JSON.parse(JSON.stringify(partyMembers));
    });
    /** Abrir tu ficha pulsando tu cara en la tira del grupo. */
    const openSheet = async () => {
        await page.locator('#game-shell .gs-party-strip .gs-chip-clickable').filter({ visible: true }).first().click({ timeout: 8000 });
        await page.waitForSelector('.ch-root', { timeout: 10000 });
        await page.waitForTimeout(400);
    };
    const closePopups = async () => {
        for (let i = 0; i < 4; i++) {
            const ok = page.locator('dialog.popup[open] .popup-button-ok').last();
            if (await ok.count() === 0) break;
            await ok.click({ timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(300);
        }
    };
    /** Poner el reloj a mano: el día y la parte del día. */
    const setClock = (/** @type {number} */ day, /** @type {number} */ slotIndex) => page.evaluate(async ({ d, s }) => {
        const time = await import('/scripts/party/time.js');
        time.saveCampaignState({ ...time.getCampaignCalendar(), day: d, slotIndex: s }, time.getCampaignBonds());
        const shell = await import('/scripts/game-engine/ui/shell/game-shell.js');
        if (shell.isShellOpen()) shell.refreshGameShell();
    }, { d: day, s: slotIndex });
    const townPlaces = () => page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-town-place')].map(c => ({
        id: c.getAttribute('data-place') || '',
        closed: c.classList.contains('gs-town-closed'),
        title: c.getAttribute('title') || '',
        text: (c.textContent || '').replace(/\s+/g, ' ').trim(),
    })));
    const placeScene = () => page.evaluate(() => {
        const scene = document.querySelector('#game-shell .gs-town-scene');
        return {
            place: scene?.getAttribute('data-place') || '',
            line: (scene?.querySelector('.gs-town-line')?.textContent || '').trim(),
            acts: [...(scene?.querySelectorAll('.gs-town-act') ?? [])].map(b => `${(b.textContent || '').replace(/\s+/g, ' ').trim()}${/** @type {HTMLButtonElement} */ (b).disabled ? ' (no)' : ''}`),
        };
    });

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    const firstRun = page.locator('text=Welcome to SillyTavern!');
    if (await firstRun.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#game-shell', { timeout: 90000 });
    const offline = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Jugar sin conexión' });
    await until(async () => await offline.count() === 1, 30000);

    // 1. Un erudito, con su bolsa de componentes.
    await offline.click();
    await page.waitForSelector('.hc-root', { timeout: 120000 });
    await page.fill('.hc-root .hc-name', 'Tomasín');
    await pickHeroCard(page, 'race', 'Humano');
    const picked = await pickHeroCard(page, 'class', 'Erudito');
    await page.locator('.hc-root .hc-enter').click();
    await until(async () => (await party())[0]?.name === 'Tomasín', 60000);
    await until(async () => (await chips()).some(c => /^Saltar la prueba$/.test(c)), 20000);
    let now = await party();
    check('se crea un erudito, y empieza con su bolsa de componentes (D-J25)',
        /Erudit/.test(String(now[0]?.class)) && (now[0]?.items ?? []).some((/** @type {any} */ i) => i.name === 'Bolsa de componentes'),
        JSON.stringify({ picked, class: now[0]?.class, items: (now[0]?.items ?? []).map((/** @type {any} */ i) => i.name) }));

    // 2. Saltar la prueba y salir al pueblo: el gremio, el primero.
    await clickChip(/^Saltar la prueba$/);
    await page.waitForSelector('.popup:has-text("¿Saltar la prueba?")', { timeout: 10000 }).catch(() => {});
    await page.locator('.popup-button-ok:visible').first().click({ timeout: 5000 }).catch(() => {});
    await until(() => chatHas(/apunta tu nombre en el libro del gremio/), 15000);
    await page.waitForTimeout(800);
    await closePopups();
    const where = () => page.evaluate(async () => {
        const state = await import('/scripts/party/state.js');
        const meta = window.SillyTavern.getContext().chatMetadata ?? {};
        return { here: state.currentLocationName, board: String(meta.currentBoard ?? ''), scene: document.querySelector('#game-shell')?.getAttribute('data-scene') || '',
            leave: [...document.querySelectorAll('.wm-leave-loc-btn')].map(b => (b.textContent || '').trim()) };
    });
    // Saltar la prueba deja al grupo en Puerto Alba; si aún está en un tablero, se sale de él
    // (no de la localización: eso lleva al mapa).
    if ((await where()).board) {
        await page.locator('#game-shell .gs-scene-map .wm-leave-loc-btn').first().click({ timeout: 5000 })
            .catch(() => page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/leave')));
        await page.waitForTimeout(600);
    }
    if (process.argv.includes('--debug')) console.log('en el pueblo', JSON.stringify(await where()));
    await carryOn('exploration');
    await setClock(2, 0);
    const inTown = await until(async () => (await townPlaces()).length > 0, 10000);
    let places = await townPlaces();
    check('fuera del tablero, el pueblo: el gremio, el primero (D-J30)', inTown && places[0]?.id === 'gremio', JSON.stringify(places.map(p => p.id)));
    if (shot('1-pueblo')) await page.screenshot({ path: shot('1-pueblo') });

    // 3. El grimorio: «Lanzar un ritual». Su libro, con los rituales que se miran aquí.
    await page.evaluate(async () => {
        const { partyMembers } = await import('/scripts/party/state.js');
        const { savePartyState } = await import('/scripts/party/roster.js');
        partyMembers[0].spellbook = ['conj-detectar-magia', 'conj-identificar', 'conj-encontrar-familiar', 'conj-alarma', 'conj-comprender-idiomas'];
        partyMembers[0].level = 3;
        savePartyState();
    });
    await dropToasts();
    await openSheet();
    await page.locator('.ch-root .ch-grimoire').click();
    await page.waitForSelector('.gr-fifth', { timeout: 10000 });
    const book = await page.evaluate(() => ({
        lines: [...document.querySelectorAll('.gr-fifth .gr-line')].map(l => (l.textContent || '').trim()),
        groups: [...document.querySelectorAll('.gr-fifth .gr-group')].map(g => (g.textContent || '').trim()),
        buttons: [...document.querySelectorAll('.gr-fifth .gr-actions button')].map(b => `${(b.textContent || '').trim()}${/** @type {HTMLButtonElement} */ (b).disabled ? ' (no)' : ''}`),
    }));
    check('el grimorio del erudito: solo rituales, sin espacios ni preparar, y el botón «Lanzar un ritual» (D-J27)',
        book.lines.some(l => /Solo rituales, sin espacios/.test(l)) && book.groups.some(g => /^Rituales/.test(g))
        && book.buttons.includes('Lanzar un ritual') && !book.buttons.some(b => /Preparar/.test(b)), JSON.stringify(book));
    await page.locator('.gr-fifth .gr-ritual').click();
    await page.waitForSelector('.gr-rituals .gr-ritual-row', { timeout: 10000 });
    await page.waitForTimeout(400);
    const rituals = () => page.evaluate(() => [...document.querySelectorAll('.gr-rituals .gr-ritual-row')].map(r => ({
        id: r.getAttribute('data-ritual') || '',
        ok: !(/** @type {HTMLButtonElement|null} */ (r.querySelector('.gr-ritual-cast'))?.disabled ?? true),
        why: (r.querySelector('.gr-ritual-why')?.textContent || '').trim(),
    })));
    let list = await rituals();
    const byId = (/** @type {any[]} */ rows, /** @type {string} */ id) => rows.find(r => r.id === id) ?? {};
    check('el cuadro de rituales: Detectar magia, sí; Identificar pide una perla, y Encontrar familiar, incienso (D-J25)',
        byId(list, 'conj-detectar-magia').ok === true
        && /^Para Identificar hace falta: perla \(100 de oro\)\. Se compra en las tiendas\.$/.test(byId(list, 'conj-identificar').why)
        && /incienso y hierbas \(10 de oro\), que se gasta al lanzarlo/.test(byId(list, 'conj-encontrar-familiar').why),
        JSON.stringify(list));
    if (shot('2-rituales')) await page.screenshot({ path: shot('2-rituales') });
    await page.locator('.gr-rituals .gr-ritual-row[data-ritual="conj-detectar-magia"] .gr-ritual-cast').click();
    const told = await until(() => chatHas(/lanza Detectar magia como ritual/), 8000);
    const said = await page.evaluate(() => (document.querySelector('dialog.popup[open]')?.textContent || '').replace(/\s+/g, ' ').trim());
    check('lanzar Detectar magia: se cuenta, y dice qué tiene magia', told && /nota la magia/.test(said) && /(Tiene magia|Nada de lo que lleváis tiene magia)/.test(said), said.slice(0, 300));
    if (shot('3-detectar')) await page.screenshot({ path: shot('3-detectar') });
    await closePopups();

    // 4. Con una perla y un anillo sin identificar, Identificar.
    await page.evaluate(async () => {
        const { partyMembers } = await import('/scripts/party/state.js');
        const { describeLootItem } = await import('/scripts/game-engine/combat/loot-items.js');
        const { addItemToInventory, createItem } = await import('/scripts/dnd-system.js');
        const { savePartyState } = await import('/scripts/party/roster.js');
        addItemToInventory(/** @type {any} */ (partyMembers[0]), createItem(/** @type {any} */ (describeLootItem('Perla'))));
        addItemToInventory(/** @type {any} */ (partyMembers[0]), createItem(/** @type {any} */ ({ name: 'Anillo de plata', rarity: 'uncommon', identified: false })));
        savePartyState();
    });
    await dropToasts();
    await page.evaluate(async () => {
        const { partyMembers } = await import('/scripts/party/state.js');
        void (await import('/scripts/party/rituals.js')).openRituals(partyMembers[0]);
    });
    await page.waitForSelector('.gr-rituals .gr-ritual-row', { timeout: 10000 });
    list = await rituals();
    check('con la perla y algo sin identificar, Identificar se puede lanzar', byId(list, 'conj-identificar').ok === true, JSON.stringify(list));
    await page.locator('.gr-rituals .gr-ritual-row[data-ritual="conj-identificar"] .gr-ritual-cast').click();
    await until(() => chatHas(/lanza Identificar como ritual/), 8000);
    now = await party();
    const ring = (now[0]?.items ?? []).find((/** @type {any} */ i) => i.name === 'Anillo de plata');
    const pearl = (now[0]?.items ?? []).some((/** @type {any} */ i) => i.name === 'Perla');
    check('Identificar: el anillo ya se sabe lo que es, y la perla no se gasta', ring?.identified === true && pearl, JSON.stringify({ ring, pearl }));
    await closePopups();

    // 5. De noche, la tienda y la herrería cerradas, con su cartel; la tendera, en la taberna.
    await setClock(3, 2);
    await page.waitForTimeout(600);
    if (process.argv.includes('--debug')) {
        console.log(JSON.stringify(await page.evaluate(async () => {
            const town = await import('/scripts/party/town.js');
            const time = await import('/scripts/party/time.js');
            const world = await import('/scripts/party/world.js');
            const state = await import('/scripts/party/state.js');
            return {
                calendar: time.getCampaignCalendar(),
                here: state.currentLocationName,
                location: world.hereLocation(),
                cards: town.buildServiceCards().map((/** @type {any} */ c) => ({ id: c.id, closed: c.closed, n: c.actions.length, first: c.actions.slice(0, 3).map((/** @type {any} */ a) => a.id) })),
            };
        }), null, 1).slice(0, 4000));
    }
    places = await townPlaces();
    const shop = places.find(p => p.id === 'tienda');
    const forge = places.find(p => p.id === 'herreria');
    const inn = places.find(p => p.id === 'posada');
    check('de noche, la tienda y la herrería se ven cerradas, con «Cerrado: es de noche»; la taberna, abierta (D-J29)',
        Boolean(shop?.closed) && /Cerrado: es de noche/.test(`${shop?.title} ${shop?.text}`) && Boolean(forge?.closed) && !inn?.closed, JSON.stringify(places));
    if (shot('4-noche')) await page.screenshot({ path: shot('4-noche') });
    await page.locator('#game-shell .gs-town-place[data-place="tienda"]').click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
    const shut = await placeScene();
    check('entrar en la tienda cerrada: lo dice llano, dónde está Marisa, y no se compra',
        /La tienda está cerrada: es de noche\. Marisa está en la posada/.test(shut.line) && !shut.acts.some(a => /de oro\)$/.test(a)), JSON.stringify(shut));
    if (shot('5-tienda-cerrada')) await page.screenshot({ path: shot('5-tienda-cerrada') });
    await page.locator('#game-shell .gs-town-back').click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(400);
    await page.locator('#game-shell .gs-town-place[data-place="posada"]').click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
    const tavern = await page.evaluate(() => (document.querySelector('#game-shell .gs-town-scene')?.textContent || '').replace(/\s+/g, ' '));
    check('y en la taberna está Marisa, con quien se puede hablar', /Marisa/.test(tavern), tavern.slice(0, 300));
    await page.locator('#game-shell .gs-town-back').click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(300);

    // El día de descanso (el 7), cerradas todo el día.
    await setClock(7, 0);
    await page.waitForTimeout(600);
    places = await townPlaces();
    const rest = places.find(p => p.id === 'tienda');
    check('el día de descanso, cerrada también por la mañana: «Cerrado hoy: día de descanso» (D-J29)',
        Boolean(rest?.closed) && /Cerrado hoy: día de descanso/.test(`${rest?.title} ${rest?.text}`), JSON.stringify(rest));

    // 6. De día: comprar no pasa la parte del día, y el laúd va a la bardo sin foco.
    await setClock(8, 0);
    await page.evaluate(async () => {
        const { partyMembers } = await import('/scripts/party/state.js');
        const { savePartyState } = await import('/scripts/party/roster.js');
        partyMembers.push(/** @type {any} */ ({
            id: 9901, name: 'Lira', class: 'Bardo', level: 3, hp: 20, maxHp: 20, charisma: 16, items: [], equippedItems: {},
            cantrips: [], spellsKnown: ['hab-sueno'], focusGiven: true, gold: 0, mapPosition: { ...partyMembers[0].mapPosition },
        }));
        partyMembers[0].gold = 500;
        savePartyState();
    });
    const before = await page.evaluate(async () => (await import('/scripts/party/time.js')).getCampaignCalendar());
    const bought = await page.evaluate(async () => {
        const town = await import('/scripts/party/town.js');
        const card = town.buildServiceCards().find((/** @type {any} */ c) => c.id === 'tienda');
        const lute = card?.actions.find((/** @type {any} */ a) => a.id === 'shop-buy:Laúd');
        if (!lute?.enabled) return { offered: Boolean(lute), done: '' };
        await town.runService('shop-buy:Laúd');
        return { offered: true, done: 'yes' };
    });
    await page.waitForTimeout(500);
    const after = await page.evaluate(async () => (await import('/scripts/party/time.js')).getCampaignCalendar());
    now = await party();
    const lira = now.find((/** @type {any} */ m) => m.name === 'Lira');
    check('de día, la tienda vende el laúd, y comprarlo no pasa la parte del día (D-J25, D-J31)',
        bought.done === 'yes' && before.day === after.day && before.slotIndex === after.slotIndex, JSON.stringify({ bought, before: [before.day, before.slotIndex], after: [after.day, after.slotIndex] }));
    check('el laúd va a Lira, que no tenía foco, y se dice', (lira?.items ?? []).some((/** @type {any} */ i) => i.name === 'Laúd') && await chatHas(/Se lo da a Lira, que lo necesita para sus conjuros/),
        JSON.stringify(lira?.items?.map((/** @type {any} */ i) => i.name)));

    // 7. Un clérigo que llega sin nada trae su bolsa, una vez.
    const doc = await page.evaluate(async () => {
        const { partyMembers } = await import('/scripts/party/state.js');
        partyMembers.push(/** @type {any} */ ({
            id: 9902, name: 'Doc', class: 'Clérigo', level: 1, hp: 12, maxHp: 12, wisdom: 15, items: [], equippedItems: {}, gold: 0,
            mapPosition: { ...partyMembers[0].mapPosition },
        }));
        const magic = await import('/scripts/party/magic.js');
        const abilities = magic.knownAbilitiesOf(partyMembers[partyMembers.length - 1]);
        const member = partyMembers[partyMembers.length - 1];
        return { items: (member.items ?? []).map((/** @type {any} */ i) => i.name), given: member.focusGiven, blocked: abilities.filter((/** @type {any} */ a) => a.blocked).map((/** @type {any} */ a) => `${a.name}: ${a.blocked}`) };
    });
    check('un clérigo que llega sin nada trae su bolsa de componentes, y sus conjuros no se bloquean por el foco (D-J25)',
        doc.items.includes('Bolsa de componentes') && doc.given === true && !doc.blocked.some((/** @type {string} */ b) => /foco/.test(b)), JSON.stringify(doc));

    check('sin errores en la página', problems.length === 0, problems.slice(0, 6).join('\n        '));
} catch (error) {
    failures++;
    console.log(`FAIL  the run threw: ${/** @type {any} */ (error)?.message || error}`);
    if (SHOT && page) await page.screenshot({ path: shot('error') }).catch(() => {});
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
