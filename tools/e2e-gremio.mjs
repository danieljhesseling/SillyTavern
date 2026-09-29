#!/usr/bin/env node
/**
 * El recorrido de «Jugar sin conexión» (J4 de ROADMAP_SIN_CONEXION), de punta a punta, contra
 * un servidor propio con un `--dataRoot` temporal, como `e2e-quick.mjs`:
 *
 *   título → Jugar sin conexión → tu personaje → la prueba de la bodega → contratar a un
 *   mercenario → el tablón → La Maldición de Strahd → volver al gremio → seguir la campaña
 *   → y el título ofrece seguir en el gremio.
 *
 * Uso:
 *   node tools/e2e-gremio.mjs            # sin ventana
 *   node tools/e2e-gremio.mjs --headed   # mirándolo
 *   node tools/e2e-gremio.mjs --port 8130 --captura gremio.png
 */

/* global window, document, HTMLElement */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';


/**
 * Elegir en una tarjeta de «Crear personaje», como quien juega: abrir su selector y pulsar
 * la opción que más se parece a lo pedido (sin acentos ni mayúsculas), o la primera.
 *
 * @param {any} page
 * @param {string} pick class | race | background
 * @param {string} [wanted]
 * @returns {Promise<string>} Lo elegido.
 */
async function pickHeroCard(page, pick, wanted = '') {
    await page.locator(`.hc-root .hc-card[data-pick="${pick}"] .hc-pick`).click();
    await page.waitForSelector('.hc-picker .hc-option', { timeout: 15000 });
    const plain = (/** @type {string} */ v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const values = await page.evaluate(() => [...document.querySelectorAll('.hc-picker .hc-option')].map(o => o.getAttribute('data-value') || ''));
    // Igual, o que lo contenga, o que empiece igual («Picara» es la Pícaro del compendio), o la primera.
    const chosen = values.find(v => plain(v) === plain(wanted)) ?? values.find(v => wanted && plain(v).includes(plain(wanted)))
        ?? values.find(v => wanted.length >= 4 && plain(v).startsWith(plain(wanted).slice(0, 4))) ?? values[0];
    await page.locator(`.hc-picker .hc-option[data-value="${chosen}"]`).first().click();
    await page.waitForSelector('.hc-picker', { state: 'detached', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(200);
    return chosen;
}

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8128;
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

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-gremio-'));
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
            window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,combat,travel,prisoners,mesa,high,spell,pet,bill');
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
            window.localStorage.setItem('sillytavern_gameSucesos', 'off');
        } catch { /* nada */ }
    });

    /** Lo que el juego sabe ahora: el mundo, el chat, el grupo y el tablero. */
    const state = () => page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const party = (await import('/scripts/party.js')).getPartyMembersSnapshot();
        return {
            world: String(ctx.chatMetadata?.world_info ?? ''),
            chat: String(ctx.getCurrentChatId?.() ?? ''),
            location: String(ctx.chatMetadata?.currentLocation ?? ''),
            board: String(ctx.chatMetadata?.currentBoard ?? ''),
            party: party.map((/** @type {any} */ m) => ({ name: m.name, gold: Number(m.gold) || 0, guest: Boolean(m.guest), wiUid: m.wiUid, world: m.worldName, level: m.level })),
            fighting: Boolean(ctx.chatMetadata?.combatEncounter?.active),
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
    /** Los dados que quedan en pantalla, con su fondo, se pasan como lo haría quien juega. */
    const clearDice = async () => {
        let misses = 0;
        for (let i = 0; i < 40; i++) {
            const next = page.locator('.wm-dice-overlay.active .wm-dice-next');
            if (await next.count() === 0) break;
            const clicked = await next.click({ timeout: 1500 }).then(() => true).catch(() => false);
            if (!clicked && ++misses >= 2) break;
            await page.waitForTimeout(250);
        }
    };
    /** Espera a que se cumpla algo, sin dormir de más. */
    const until = async (/** @type {() => Promise<boolean>} */ test, ms = 30000) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (await test().catch(() => false)) return true;
            await page.waitForTimeout(400);
        }
        return false;
    };

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    const firstRun = page.locator('text=Welcome to SillyTavern!');
    if (await firstRun.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#game-shell', { timeout: 90000 });

    // 1. El título ofrece jugar sin conexión.
    const offline = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Jugar sin conexión' });
    const offered = await until(async () => await offline.count() === 1, 30000);
    const order = await page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-menu-btn .gs-menu-label')].map(l => (l.textContent || '').trim()));
    check('el título ofrece «Jugar sin conexión», lo primero', offered && order[0] === 'Jugar sin conexión', JSON.stringify(order));
    if (SHOT) await page.screenshot({ path: SHOT });

    // 2. Tu personaje: nombre, especie y clase.
    await offline.click();
    const creator = await page.waitForSelector('.hc-root', { timeout: 120000 }).then(() => true).catch(() => false);
    check('se abre la creación de personaje', creator);
    // J18.2: la pantalla propia, con tarjetas. «Entrar al mundo» espera a nombre y clase.
    const shape = await page.evaluate(() => ({
        cards: [...document.querySelectorAll('.hc-root .hc-card')].map(c => c.getAttribute('data-pick')),
        empty: document.querySelector('.hc-root .hc-card[data-pick="class"] .hc-card-value')?.textContent || '',
        off: /** @type {HTMLButtonElement|null} */ (document.querySelector('.hc-root .hc-enter'))?.disabled ?? null,
        portrait: (document.querySelector('.hc-root .hc-portrait')?.getBoundingClientRect().width || 0),
        sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    check('crear personaje es una pantalla con tres tarjetas y el retrato (J18.2)',
        shape.cards.join(',') === 'class,race,background' && /Elegir clase/.test(shape.empty) && shape.portrait > 0 && shape.portrait <= 380 && !shape.sideways,
        JSON.stringify(shape));
    check('y no deja entrar sin nombre ni clase', shape.off === true);
    await page.fill('.hc-root .hc-name', 'Tessa');
    await pickHeroCard(page, 'race', 'Humano');
    await pickHeroCard(page, 'class', 'Guerrero');
    const numbers = await page.evaluate(() => ({
        str: document.querySelector('.hc-root .hc-stat[data-stat="strength"] .hc-stat-val')?.textContent || '',
        ac: document.querySelector('.hc-root .hc-total[data-total="ac"] strong')?.textContent || '',
        kit: document.querySelector('.hc-root .hc-kit')?.textContent || '',
    }));
    check('al elegir, salen los números con la clase y la especie sumadas, y el equipo (J1.2, J1.3)',
        Number(numbers.str) > 10 && /1[4-9] CA/.test(numbers.ac) && /Cota de malla/.test(numbers.kit), JSON.stringify(numbers));
    // J1.2: repartir un punto en Fuerza la sube uno, y lo dice.
    await page.locator('.hc-root .hc-stat[data-stat="strength"] [data-step="1"]').click();
    await page.waitForTimeout(200);
    const spread = await page.evaluate(() => ({
        str: document.querySelector('.hc-root .hc-stat[data-stat="strength"] .hc-stat-val')?.textContent || '',
        left: document.querySelector('.hc-root .hc-mode-note')?.textContent || '',
    }));
    check('repartir un punto sube la Fuerza, y quedan dos (J1.2)',
        Number(spread.str) === Number(numbers.str) + 1 && /quedan 2/.test(spread.left), JSON.stringify(spread));
    const premise = await page.locator('.hc-root .hc-premise-text').textContent().catch(() => '');
    check('la creación cuenta cómo empieza: el gremio y la bodega', /bodega/i.test(String(premise)), String(premise).slice(0, 160));
    if (SHOT) await page.screenshot({ path: `${SHOT}.personaje.png` });
    await page.locator('.hc-root .hc-enter').click();

    const inHub = await until(async () => {
        const now = await state();
        return /Gremio/.test(now.world) && now.party.length === 1 && now.party[0].name === 'Tessa';
    }, 60000);
    let now = await state();
    check('empieza en el gremio, con Tessa y 100 de oro, en la bodega', inHub && now.party[0]?.gold === 100 && now.board === 'La bodega del gremio', JSON.stringify(now));
    const prologue = await until(() => chatHas(/Baja a la bodega/), 20000);
    check('el prólogo se cuenta en el chat', prologue);
    await page.waitForTimeout(800);
    const hubChips = await chips();
    check('las fichas ofrecen el tablón de campañas y contratar', hubChips.some(c => /Tablón de campañas/.test(c)) && hubChips.some(c => /Contratar mercenarios/.test(c)), JSON.stringify(hubChips));

    // 3. La prueba: las ratas de la bodega. La pelea se empieza desde la fila de fichas: en
    // la escena de diálogo el botón del tablero no se ve.
    const canFight = await until(async () => (await chips()).some(c => /^Iniciar combate \(Rata de bodega x2\)/.test(c)), 15000);
    check('en la bodega, la fila ofrece pelear con las dos ratas', canFight, JSON.stringify(await chips()));
    if (canFight) {
        await clickChip(/^Iniciar combate/);
        await until(async () => (await state()).fighting, 10000);
        await clearDice();
        await page.evaluate(async () => {
            const enc = (await import('/scripts/party.js')).getCombatEncounter();
            for (const e of enc?.enemies ?? []) e.currentHp = 0;
        });
        for (let i = 0; i < 8 && (await state()).fighting; i++) {
            await page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/combat-end'));
            await page.waitForTimeout(700);
            await clearDice();
        }
    }
    now = await state();
    const tablon = await until(() => chatHas(/apunta tu nombre en el libro del gremio/), 15000);
    check('ganar la prueba abre el hilo siguiente: el tablón', !now.fighting && tablon, JSON.stringify({ fighting: now.fighting }));

    // 4. Un mercenario.
    await clearDice();
    await page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/leave'));
    await page.waitForTimeout(600);
    check('fuera del tablón también se ofrece contratar', await clickChip(/Contratar mercenarios/));
    const hire = await page.waitForSelector('.hb-root [data-hireling]', { timeout: 15000 }).then(() => true).catch(() => false);
    const offers = await page.evaluate(() => [...document.querySelectorAll('.hb-root [data-hireling]')].map(c => c.getAttribute('aria-label')));
    check('se ofrecen los tres mercenarios del gremio con su precio', hire && offers.length === 3 && offers.every(o => /40 de oro/.test(String(o))), JSON.stringify(offers));
    if (SHOT) await page.screenshot({ path: `${SHOT}.mercenarios.png` });
    const purse = (await state()).party.reduce((sum, m) => sum + m.gold, 0);
    await page.locator('.hb-root [data-hireling="Gerd el Mellado"]').click();
    await until(async () => (await state()).party.length === 2, 10000);
    now = await state();
    const gerd = now.party.find(m => m.name === 'Gerd el Mellado');
    check('Gerd se une por 40 de oro, y él no trae oro', Boolean(gerd?.guest) && now.party[0].gold === purse - 40 && gerd?.gold === 0, JSON.stringify({ purse, party: now.party }));
    const gold = now.party[0].gold;
    const hubWorld = now.world;
    const hubChat = now.chat;

    // 5. El tablón: Strahd.
    await page.waitForTimeout(500);
    check('la ficha del tablón de campañas está', await clickChip(/Tablón de campañas/));
    await page.waitForSelector('.hb-root [data-campaign]', { timeout: 15000 }).catch(() => {});
    const board = await page.evaluate(() => [...document.querySelectorAll('.hb-root [data-campaign]')].map(c => ({ id: c.getAttribute('data-campaign'), text: (c.textContent || '').replace(/\s+/g, ' ').slice(0, 120) })));
    check('en el tablón están 1387 y La Maldición de Strahd, sin empezar', board.some(c => c.id === '1387') && board.some(c => c.id === 'strahd' && /Sin empezar/.test(c.text)), JSON.stringify(board));
    if (SHOT) await page.screenshot({ path: `${SHOT}.tablon.png` });
    await page.locator('.hb-root [data-campaign="strahd"]').click();

    const inStrahd = await until(async () => /Strahd/.test((await state()).world), 120000);
    await page.waitForTimeout(1500);
    now = await state();
    const tessa = now.party.find(m => m.name === 'Tessa');
    check('La Maldición de Strahd empieza en la Taberna, con el grupo entero: Tessa con su oro y Gerd',
        inStrahd && now.board === 'Taberna Sangre de la Enredadera' && now.party.length === 2 && tessa?.gold === gold
        && now.party.every(m => m.world === now.world) && tessa?.wiUid !== null,
        JSON.stringify(now));
    const scene = await until(() => chatHas(/Bruja Baroviana está acechando/), 20000);
    check('la primera escena de Strahd se cuenta', scene);
    const campaignChips = await chips();
    check('en la campaña se ofrece volver al gremio', campaignChips.some(c => /Volver al gremio/.test(c)), JSON.stringify(campaignChips));
    const strahdWorld = now.world;
    const strahdChat = now.chat;

    /** Gana la pelea que haya: todos a cero y turnos hasta que se acaba. */
    const winFight = async () => {
        await until(async () => (await state()).fighting, 10000);
        await clearDice();
        await page.evaluate(async () => {
            const enc = (await import('/scripts/party.js')).getCombatEncounter();
            for (const e of enc?.enemies ?? []) e.currentHp = 0;
        });
        for (let i = 0; i < 8 && (await state()).fighting; i++) {
            await page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/combat-end'));
            await page.waitForTimeout(700);
            await clearDice();
        }
    };
    /** Que nadie del grupo esté sobre un muro del tablero abierto. */
    const partyOnFloor = () => page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const data = await (await import('/scripts/world-info.js')).loadWorldInfo(String(ctx.chatMetadata?.world_info || ''));
        const place = (data?.metadata?.locationMaps ?? []).find((/** @type {any} */ l) => l.name === ctx.chatMetadata?.currentLocation);
        const board = (place?.boards ?? []).find((/** @type {any} */ b) => b.name === ctx.chatMetadata?.currentBoard);
        const { getCell, normalizeTerrain } = await import('/scripts/game-engine/board/terrain.js');
        const party = (await import('/scripts/party.js')).getPartyMembersSnapshot();
        return party.map((/** @type {any} */ m) => {
            const x = Number(m.mapPosition?.gridX) || 0;
            const y = Number(m.mapPosition?.gridY) || 0;
            return { name: m.name, x, y, cell: getCell(normalizeTerrain(board?.terrain), x, y).type };
        });
    });

    // Strahd se juega: la bruja de la Taberna, y ganar abre la Mansión y el Sótano.
    const where = await partyOnFloor();
    check('en la Taberna, cada uno en su casilla de salida, ninguno en un muro', where.every(m => m.cell !== 'wall') && new Set(where.map(m => `${m.x},${m.y}`)).size === where.length, JSON.stringify(where));
    const bruja = await until(async () => (await chips()).some(c => /^Iniciar combate \(Bruja Baroviana\)$/.test(c)), 15000);
    check('en la Taberna espera la bruja; el zombi de la cocina, no, que está tras la puerta', bruja, JSON.stringify(await chips()));
    if (SHOT) await page.screenshot({ path: `${SHOT}.taberna.png` });
    await clickChip(/^Iniciar combate/);
    await winFight();
    const mansion = await until(() => chatHas(/asedian la mansión del burgomaestre/), 15000);
    check('ganar la Taberna abre el hilo: el asedio de la mansión', mansion);
    await page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/leave'));
    await page.waitForTimeout(800);
    const outside = await chips();
    check('fuera, la fila ofrece entrar en la Mansión y en el Sótano', outside.some(c => /Entrar en Mansión del Burgomaestre/.test(c)) && outside.some(c => /Entrar en Sótano de la Iglesia/.test(c)), JSON.stringify(outside));
    await clickChip(/Entrar en Mansión del Burgomaestre/);
    const zombis = await until(async () => (await chips()).some(c => /^Iniciar combate \(Zombi de Strahd x3\)$/.test(c)), 15000);
    const inside = await partyOnFloor();
    check('en la Mansión, el grupo en el salón y los tres zombis fuera, esperando', zombis && inside.every(m => m.cell !== 'wall'), JSON.stringify({ chips: await chips(), inside }));
    if (SHOT) await page.screenshot({ path: `${SHOT}.mansion.png` });

    // La palanca del Sótano abre la celda y despierta al engendro. Antes la reja se abría y
    // la sala seguía a oscuras, con él dormido para siempre.
    await page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/leave'));
    await page.waitForTimeout(700);
    await clickChip(/Entrar en Sótano de la Iglesia/);
    await page.waitForTimeout(1200);
    const lever = await page.evaluate(async () => {
        const party = await import('/scripts/party.js');
        const wi = await import('/scripts/world-info.js');
        const ctx = window.SillyTavern.getContext();
        const place = wi.getCurrentWorldLocationMaps().find((/** @type {any} */ l) => l.name === ctx.chatMetadata.currentLocation);
        const board = (place?.boards || []).find((/** @type {any} */ b) => b.name === ctx.chatMetadata.currentBoard);
        if (!board) return null;
        const hero = party.getPartyMembersSnapshot()[0];
        const at = { x: (Number(hero?.mapPosition?.gridX) || 0) - 1, y: Number(hero?.mapPosition?.gridY) || 0 };
        board.terrain.cells = board.terrain.cells || {};
        // La palanca del tablero, junto al héroe: así no hay que andar hasta ella.
        for (const [key, cell] of Object.entries(board.terrain.cells)) if (/** @type {any} */ (cell)?.type === 'lever') delete board.terrain.cells[key];
        board.terrain.cells[`${at.x},${at.y}`] = { type: 'lever' };
        party.refreshBoardView();
        return { board: board.name, at, asleep: (board.enemyPlacements || []).map((/** @type {any} */ p) => p.name) };
    });
    await page.waitForTimeout(800);
    // La palanca se pulsa en el tablero: en la escena de diálogo el tablero solo se mira.
    await page.locator('#game-shell .gs-scene-btn[data-scene="combat"]').click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(800);
    await clearDice();
    await page.evaluate(() => document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));
    const over = await page.evaluate(() => {
        const el = [...document.querySelectorAll('.wm-terrain-lever')].find(e => /** @type {HTMLElement} */ (e).offsetParent !== null);
        const r = el?.getBoundingClientRect();
        const top = r ? document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) : null;
        return { rect: r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width)] : null, top: top ? `${top.tagName}.${String(top.className).slice(0, 80)}` : '', scene: document.querySelector('#game-shell')?.getAttribute('data-scene') };
    });
    const pulled = await page.locator('.wm-terrain-lever').filter({ visible: true }).first().click({ timeout: 6000 }).then(() => 'ok')
        .catch((/** @type {any} */ e) => String(e?.message || e).split(/\r?\n/)
            .filter(l => /intercept|not stable|outside|visible/.test(l)).slice(0, 3).join(' | '));
    const woke = await until(() => chatHas(/Se despierta lo que dormia en la sala: Engendro hambriento/), 10000);
    check('en el Sótano, tirar de la palanca abre la celda y despierta al engendro', woke && (await state()).fighting, JSON.stringify({ lever, over, pulled }));
    await page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/combat-stop'));
    await page.waitForTimeout(800);
    await clearDice();
    await page.locator('#game-shell .gs-scene-btn[data-scene="dialogue"]').click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
    const rulesToast = await page.evaluate(() => [...document.querySelectorAll('#toast-container .toast')].some(t => /Recarga la página/.test(t.textContent || '')));
    check('cambiar de campaña no pide recargar la página', !rulesToast);

    // 6. Volver al gremio.
    await clickChip(/Volver al gremio/);
    const home = await until(async () => (await state()).world === hubWorld, 60000);
    await page.waitForTimeout(1000);
    now = await state();
    check('se vuelve al gremio, a su chat, con el grupo entero', home && now.chat === hubChat && now.party.length === 2 && now.party.every(m => m.world === hubWorld), JSON.stringify(now));

    // 7. Y se sigue la campaña donde se dejó.
    await clickChip(/Tablón de campañas/);
    await page.waitForSelector('.hb-root [data-campaign="strahd"]', { timeout: 15000 }).catch(() => {});
    const again = await page.evaluate(() => (document.querySelector('.hb-root [data-campaign="strahd"]')?.textContent || '').replace(/\s+/g, ' '));
    check('en el tablón, Strahd sale en curso, para seguirla', /En curso/.test(again) && /Seguir/.test(again), again.slice(0, 200));
    await page.locator('.hb-root [data-campaign="strahd"]').click();
    const back = await until(async () => (await state()).world === strahdWorld, 60000);
    await page.waitForTimeout(800);
    now = await state();
    check('seguir la abre en su mismo chat, con el grupo', back && now.chat === strahdChat && now.party.length === 2, JSON.stringify(now));

    // 8. El título ofrece seguir en el gremio.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#game-shell', { timeout: 90000 });
    await page.evaluate(() => document.querySelector('#option_close_chat') instanceof HTMLElement && /** @type {HTMLElement} */ (document.querySelector('#option_close_chat')).click());
    const cont = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Seguir en el gremio' });
    const resumable = await until(async () => await cont.count() === 1, 30000);
    const contHint = resumable ? await cont.locator('.gs-menu-hint').textContent() : '';
    check('el título ofrece seguir en el gremio, con quién va', resumable && /Tessa/.test(String(contHint)) && /Gerd/.test(String(contHint)), String(contHint));
    const listed = await page.evaluate(() => [...document.querySelectorAll('#game-shell .campaign-card .campaign-title')].map(t => t.textContent));
    check('el gremio y sus campañas no salen sueltos en la lista de partidas', !listed.some(t => /Gremio|Strahd/.test(String(t))), JSON.stringify(listed));

    check('sin errores en la página', problems.length === 0, problems.slice(0, 6).join('\n        '));
} catch (error) {
    failures++;
    console.log(`FAIL  the run threw: ${/** @type {any} */ (error)?.message || error}`);
    // Con --captura, también cómo estaba la pantalla cuando se rompió.
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
