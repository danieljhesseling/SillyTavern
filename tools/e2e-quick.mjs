#!/usr/bin/env node
/**
 * Un recorrido corto: la partida rápida (R1 del roadmap de profundidad), de punta a punta,
 * contra un servidor propio con un `--dataRoot` temporal, como `e2e-campaign.mjs`.
 *
 * El recorrido grande tarda cincuenta minutos y la partida rápida va al final: para mirar
 * solo esto, esto. Dice lo que pasa en cada paso, no solo si sale.
 *
 * Uso:
 *   node tools/e2e-quick.mjs            # sin ventana
 *   node tools/e2e-quick.mjs --headed   # mirándolo
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

    const quick = page.locator('.gs-menu-btn').filter({ hasText: 'Partida rápida' });
    check('el título ofrece la partida rápida', await quick.count() === 1);
    await quick.first().click();
    await page.waitForSelector('.tl-root.tl-quick', { timeout: 20000 });
    await page.locator('.tl-quick-world[data-world="1387"]').click();
    // El paquete se carga después de elegir: se espera a que el aviso de carga se vaya.
    const loaded = await page.waitForFunction(() => !/Cargando el mundo/.test(document.querySelector('.tl-said')?.textContent || ''), null, { timeout: 20000 }).then(() => true).catch(() => false);
    const said = await page.evaluate(() => document.querySelector('.tl-said')?.textContent || '');
    check('el paquete de 1387 se carga', loaded && !/no se ha podido cargar/.test(said), said);
    await page.locator('.tl-root .md-card[data-mode="relajado"]').click();
    await page.waitForTimeout(300);
    await page.locator('.tl-start').click();

    await page.waitForSelector('.popup:visible .vt-premade', { timeout: 180000 });
    const premade = await page.evaluate(() => [...document.querySelectorAll('.popup:not([closing]) .vt-premade')].map(b => (b.textContent || '').trim()));
    check('se ofrecen tres héroes hechos', premade.length === 3, JSON.stringify(premade));
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
