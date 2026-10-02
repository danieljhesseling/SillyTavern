#!/usr/bin/env node
/**
 * Las peleas que se pueden evitar (J12.2, J8.5 y J12.6 de ROADMAP_SIN_CONEXION), en un navegador
 * de verdad contra un servidor propio con un `--dataRoot` temporal, como `e2e-combate.mjs`:
 *
 *   título → Jugar sin conexión → Bran, bardo → saltar la prueba (J2.3) → el tablón: 1387 → el
 *   cuarto de la posada, con Torres y sus guardias esperando →
 *   J12.2: junto a «Iniciar combate», «Evitar la pelea»: su ventana de novela visual, con Torres
 *   en la placa, «Pelear» y tres salidas (hablar, pagar, saltar por la ventana), cada una con su
 *   tirada, quién tira y lo que cuesta → «Todavía no» la cierra sin más → saltar por la ventana
 *   con el dado en contra: os pillan, empieza la pelea y ellos van primero →
 *   J12.6 y D-J56: el grupo es de uno y el tablero es para cuatro: sale un guardia menos, y se dice →
 *   J8.5: en la barra del combate, «Hablar»: las cuatro formas; convencer sale y la pelea se
 *   acaba (el tablero, ganado; el hito del cáliz, cumplido) → otra vez (el tablero, sin ganar a
 *   mano): sobornar paga 8 de oro → engañar: se van, y Torres os la guarda → entregarse: se acaba,
 *   os sacan del tablero y os quitan la bolsa →
 *   J12.2 bien: saltar por la ventana con el dado a favor: el tablero, pasado sin pelear.
 *
 * Lo que se prepara a mano se dice en cada paso: el dado (`setRandomSource`), la vida y el oro
 * del héroe, y volver a poner la pelea de la posada sin ganar. Lo que se prueba se hace con el
 * ratón, como quien juega.
 *
 * Uso:
 *   node tools/e2e-peleas.mjs                                  # sin ventana
 *   node tools/e2e-peleas.mjs --headed                         # mirándolo
 *   node tools/e2e-peleas.mjs --port 8342 --captura peleas.png # peleas-1.png, peleas-2.png…
 */

/* global window, document, HTMLElement */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8190;
const BASE = `http://127.0.0.1:${PORT}`;
const HEADED = process.argv.includes('--headed');
const SHOT = argAfter('--captura');
const INN = 'El cuarto de la posada';

const require = createRequire(join(ROOT, 'tests/package.json'));
const { chromium } = require('@playwright/test');

let failures = 0;
const check = (/** @type {string} */ name, /** @type {boolean} */ ok, detail = '') => {
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        -> ${detail}` : ''}`);
};

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-peleas-'));
/** @type {any} */
let server = null;
/** @type {any} */
let browser = null;
/** @type {any} */
let page = null;

let shots = 0;
/** @param {string} what */
async function shoot(what) {
    if (!SHOT || !page) return;
    shots += 1;
    const file = SHOT.replace(/\.png$/i, '') + `-${shots}.png`;
    await page.screenshot({ path: file });
    console.log(`      captura ${shots} (${what}): ${file}`);
}

function startServer() {
    server = spawn(process.execPath, ['server.js', '--browserLaunchEnabled', 'false', '--port', String(PORT), '--dataRoot', dataRoot], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
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
 * @returns {Promise<string>}
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
    return chosen;
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
            window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,combat,travel,prisoners,mesa,high,spell,pet,bill,move,attack,roll,talk,journal');
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
            window.localStorage.setItem('sillytavern_gameSucesos', 'off');
            // Las escenas del hilo las mira e2e-historia: aquí taparían la ventana de las salidas.
            window.localStorage.setItem('sillytavern_gameStoryWindows', 'off');
        } catch { /* nada */ }
    });

    /** Lo que el juego sabe ahora. */
    const state = () => page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const party = (await import('/scripts/party.js')).getPartyMembersSnapshot();
        const meta = ctx.chatMetadata ?? {};
        return {
            world: String(meta.world_info ?? ''),
            board: String(meta.currentBoard ?? ''),
            party: party.map((/** @type {any} */ m) => ({ name: m.name, gold: Number(m.gold) || 0, hp: m.hp })),
            fighting: Boolean(meta.combatEncounter?.active),
            won: Array.isArray(meta.boardsWon) ? meta.boardsWon.map(String) : [],
            done: Array.isArray(meta.plotState?.done) ? meta.plotState.done : [],
            attitudes: meta.attitudes?.values || {},
            heard: [...(meta.rumorsHeard || [])],
        };
    });
    const innWon = (/** @type {any} */ now) => now.won.some((/** @type {string} */ k) => k.endsWith(`::${INN}`));
    const chips = () => page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-chip-action')].map(c => (c.textContent || '').trim()));
    const clickChip = (/** @type {RegExp} */ pattern) => page.evaluate((source) => {
        const chip = [...document.querySelectorAll('#game-shell .gs-chip-action')].find(b => new RegExp(source).test(b.textContent || ''));
        if (chip instanceof HTMLElement) chip.click();
        return Boolean(chip);
    }, pattern.source);
    const chatHas = (/** @type {RegExp} */ pattern) => page.evaluate((source) => (window.SillyTavern.getContext().chat || [])
        .some((/** @type {any} */ m) => new RegExp(source).test(String(m.extra?.display_text || m.mes || ''))), pattern.source);
    const chatSince = (/** @type {number} */ from) => page.evaluate((start) => (window.SillyTavern.getContext().chat || [])
        .slice(start).map((/** @type {any} */ m) => String(m.extra?.display_text || m.mes || '')).join('\n'), from);
    const chatLength = () => page.evaluate(() => (window.SillyTavern.getContext().chat || []).length);
    const until = async (/** @type {() => Promise<boolean>} */ test, ms = 30000) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (await test().catch(() => false)) return true;
            await page.waitForTimeout(400);
        }
        return false;
    };
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
    const dropToasts = () => page.evaluate(() => {
        document.querySelectorAll('#toast-container .toast').forEach(t => t.remove());
        document.querySelectorAll('.vs-card').forEach(c => c.remove());
    });
    /** El dado de la partida: 0.999 saca siempre 20; 0, siempre 1; nulo, al azar (se dice: es preparar la mesa). */
    const dice = (/** @type {number|null} */ value) => page.evaluate(async (v) => {
        (await import('/scripts/party/combat-rules.js')).setRandomSource(v === null ? null : () => v);
    }, value);
    /** El combate: de quién es el turno y quién pelea. */
    const fight = () => page.evaluate(async () => {
        const enc = /** @type {any} */ ((await import('/scripts/party.js')).getCombatEncounter());
        const entry = enc?.active ? enc.turnOrder?.[enc.currentTurnIndex] ?? null : null;
        return {
            active: Boolean(enc?.active),
            turn: entry ? { name: String(entry.name), isEnemy: Boolean(entry.isEnemy) } : null,
            order: (enc?.turnOrder ?? []).map((/** @type {any} */ e) => ({ name: String(e.name), isEnemy: Boolean(e.isEnemy) })),
            enemies: (enc?.enemies ?? []).map((/** @type {any} */ e) => ({ name: String(e.name), hp: Number(e.currentHp) || 0, fled: Boolean(e.fled) })),
        };
    });
    /** La ventana de las salidas, como se ve. */
    const exitWindow = () => page.evaluate(() => {
        const dialog = document.querySelector('dialog.ev-dialog[open]');
        if (!dialog) return null;
        const plate = /** @type {HTMLElement|null} */ (dialog.querySelector('.qd-nameplate'));
        return {
            kind: dialog.querySelector('.ev-root')?.getAttribute('data-kind') || '',
            plate: plate && !plate.hidden ? (plate.textContent || '').trim() : '',
            face: dialog.querySelector('.ev-portrait img')?.getAttribute('src') || '',
            lines: [...dialog.querySelectorAll('.ev-text .qd-line')].map(p => (p.textContent || '').trim()),
            options: [...dialog.querySelectorAll('.ev-option')].map(o => ({
                id: o.getAttribute('data-exit') || '', locked: o.classList.contains('dw-locked'),
                text: (o.querySelector('.dw-said')?.textContent || '').trim(), detail: (o.querySelector('.ev-detail')?.textContent || '').trim(),
                check: (o.querySelector('.dw-check')?.textContent || '').trim(), why: (o.querySelector('.dw-why')?.textContent || '').trim(),
            })),
            next: (dialog.querySelector('.ev-next')?.textContent || '').trim(),
        };
    });
    /** Elegir una opción de la ventana, con el ratón, y esperar a lo que pasa. */
    const pickExit = async (/** @type {string} */ id) => {
        await page.locator(`dialog.ev-dialog[open] .ev-option[data-exit="${id}"]`).click({ timeout: 5000 });
        await until(async () => Boolean((await exitWindow())?.next), 5000);
        const seen = await exitWindow();
        await shoot(`lo que pasa al elegir «${id}»`);
        await page.locator('dialog.ev-dialog[open] .ev-next').click({ timeout: 5000 }).catch(() => {});
        await until(async () => !(await exitWindow()), 5000);
        await page.waitForTimeout(600);
        await clearDice();
        return seen;
    };
    /** Abrir «Evitar la pelea»: la ficha de la fila o, sin ella, el botón del tablero. */
    const openAvoid = async () => {
        await dropToasts();
        let how = 'ficha';
        if (!await clickChip(/^Evitar la pelea$/)) {
            how = 'botón';
            await page.locator('#game-shell .sc-avoid').first().click({ timeout: 5000 }).catch(() => { how = ''; });
        }
        const open = await until(async () => Boolean(await exitWindow()), 5000);
        return open ? how : '';
    };
    /** Esperar al turno de alguien del grupo (los enemigos juegan solos). */
    const toPlayerTurn = async () => {
        for (let i = 0; i < 30; i++) {
            await clearDice();
            const now = await fight();
            if (!now.active) return false;
            if (now.turn && !now.turn.isEnemy) return true;
            await page.waitForTimeout(500);
        }
        return false;
    };
    /** «Iniciar combate»: la ficha de la fila o, sin ella, el botón del tablero. */
    const startFightNow = async () => {
        await until(async () => (await chips()).some(c => /^Iniciar combate/.test(c))
            || await page.evaluate(() => Boolean(document.querySelector('#game-shell .sc-btn:not(.sc-avoid)'))), 10000);
        await dropToasts();
        if (!await clickChip(/^Iniciar combate/)) await page.locator('#game-shell .sc-btn:not(.sc-avoid)').first().click({ timeout: 5000 }).catch(() => {});
        return until(async () => (await fight()).active, 8000);
    };
    /** «Hablar» en la barra del combate. */
    const openParley = async () => {
        await dropToasts();
        await clearDice();
        await page.locator('#game-shell .gs-btn-parley').first().click({ timeout: 5000 }).catch(() => {});
        return until(async () => (await exitWindow())?.kind === 'parley', 5000);
    };
    /**
     * Preparar la mesa: la pelea de la posada otra vez sin ganar, con el grupo dentro. Es lo único
     * que no haría un jugador (volver atrás en el tiempo); se hace aquí para probar cada salida.
     */
    const resetInn = () => page.evaluate(async (inn) => {
        const ctx = window.SillyTavern.getContext();
        ctx.chatMetadata.boardsWon = (ctx.chatMetadata.boardsWon || []).filter((/** @type {string} */ k) => !String(k).endsWith(`::${inn}`));
        const board = await import('/scripts/party/board.js');
        const state = await import('/scripts/party/state.js');
        if (state.currentBoardName !== inn) board.enterBoard(inn);
        const hero = state.partyMembers[0];
        Object.assign(hero, { hp: 200, maxHp: 200, gold: Math.max(Number(hero.gold) || 0, 50) });
        (await import('/scripts/party/roster.js')).savePartyState();
        (await import('/scripts/party.js')).refreshBoardView();
        await ctx.saveMetadata();
    }, INN);

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    const firstRun = page.locator('text=Welcome to SillyTavern!');
    if (await firstRun.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#game-shell', { timeout: 90000 });

    // 1. Bran, bardo: sabe hablar.
    const offline = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Jugar sin conexión' });
    await until(async () => await offline.count() === 1, 30000);
    await offline.click();
    await page.waitForSelector('.hc-root', { timeout: 120000 });
    await page.fill('.hc-root .hc-name', 'Bran');
    await page.locator('.hc-root .hc-gender[data-value="Hombre"]').click({ timeout: 5000 }).catch(() => {});
    await pickHeroCard(page, 'race', 'Humano');
    const heroClass = await pickHeroCard(page, 'class', 'Bardo');
    await page.locator('.hc-root .hc-enter').click();
    const inHub = await until(async () => {
        const now = await state();
        return /Gremio/.test(now.world) && now.party.length === 1 && now.party[0].name === 'Bran';
    }, 60000);
    check('Bran, bardo, empieza en el gremio', inHub, JSON.stringify({ heroClass }));
    await page.waitForTimeout(1200);

    // 2. Saltar la prueba (J2.3) y, desde el tablón, 1387.
    await until(async () => (await chips()).some(c => /^Saltar la prueba$/.test(c)), 20000);
    await clickChip(/^Saltar la prueba$/);
    await page.waitForSelector('.popup:has-text("¿Saltar la prueba?")', { timeout: 10000 }).catch(() => {});
    await page.locator('.popup-button-ok:visible').first().click({ timeout: 5000 }).catch(() => {});
    await until(() => chatHas(/apunta tu nombre en el libro del gremio/), 20000);
    await page.waitForTimeout(800);
    await clearDice();
    await dropToasts();
    await page.evaluate(() => document.querySelectorAll('.popup:not([closing]) .popup-button-ok, .popup:not([closing]) .popup-button-cancel').forEach(b => /** @type {HTMLElement} */ (b).click()));
    await page.waitForTimeout(500);
    await until(async () => (await chips()).some(c => /Tablón de campañas/.test(c)), 15000);
    await clickChip(/Tablón de campañas/);
    await page.waitForSelector('.hb-root [data-campaign="1387"]', { timeout: 15000 }).catch(() => {});
    await page.locator('.hb-root [data-campaign="1387"]').click({ timeout: 5000 }).catch(() => {});
    const in1387 = await until(async () => { const now = await state(); return /1387/.test(now.world) && now.board === INN; }, 150000);
    await page.waitForTimeout(1500);
    await clearDice();
    await dropToasts();
    await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach(d => /** @type {HTMLDialogElement} */ (d).close()));
    check('1387 empieza en el cuarto de la posada, con Bran solo', in1387 && (await state()).party.length === 1, JSON.stringify(await state()));
    // La mesa: Bran con vida y oro de sobra, para que una mala tirada no acabe la prueba.
    await resetInn();
    await page.waitForTimeout(800);

    // 3. J12.2: junto a «Iniciar combate», «Evitar la pelea».
    const offered = await until(async () => {
        const row = await chips();
        const button = await page.evaluate(() => Boolean(document.querySelector('#game-shell .sc-avoid')));
        return (row.some(c => /^Evitar la pelea$/.test(c)) || button) && (row.some(c => /^Iniciar combate/.test(c)) || await page.evaluate(() => Boolean(document.querySelector('#game-shell .sc-btn'))));
    }, 15000);
    await shoot('en la posada: «Iniciar combate» y, al lado, «Evitar la pelea»');
    check('J12.2: en la posada, junto a «Iniciar combate», se ofrece «Evitar la pelea»', offered,
        JSON.stringify({ chips: await chips(), button: await page.evaluate(() => (document.querySelector('#game-shell .sc-row')?.textContent || '').replace(/\s+/g, ' ').trim()) }));

    const how = await openAvoid();
    const choice = await exitWindow();
    await shoot('la elección antes de pelear, en su ventana');
    check('J12.2: «Evitar la pelea» abre su ventana de novela visual, con Torres en la placa y lo que pasa',
        Boolean(how) && choice?.kind === 'avoid' && choice.plate === 'Alguacil Torres'
        && choice.lines.some(l => /^Alguacil Torres y dos más os cierran el paso\.$/.test(l)), JSON.stringify({ how, choice }));
    const ids = (choice?.options ?? []).map(o => o.id);
    const talk = choice?.options.find(o => o.id === 'hablar-1');
    const pay = choice?.options.find(o => o.id === 'pagar-2');
    const windowJump = choice?.options.find(o => o.id === 'huir-3');
    check('J12.2: «Pelear» y las tres salidas escritas de la posada, cada una con su tirada, quién tira y lo que cuesta',
        JSON.stringify(ids) === JSON.stringify(['pelear', 'hablar-1', 'pagar-2', 'huir-3'])
        && /Persuasión · CD 15/.test(talk?.check ?? '') && /Tira Bran/.test(talk?.detail ?? '')
        && /Cuesta 5 de oro/.test(pay?.detail ?? '') && /Atletismo · CD 13/.test(windowJump?.check ?? ''),
        JSON.stringify(choice?.options));
    await page.locator('dialog.ev-dialog[open] .ev-close').click({ timeout: 5000 }).catch(() => {});
    const closed = await until(async () => !(await exitWindow()), 4000);
    check('J12.2: «Todavía no» cierra la ventana sin decidir: la pelea sigue esperando', closed && !(await fight()).active && !innWon(await state()));

    // 4. Saltar por la ventana con el dado en contra: os pillan y empiezan ellos (J12.2). Y el
    // grupo es de uno para un tablero de cuatro: un guardia menos (J12.6, D-J56).
    await dice(0);
    const beforeCaught = await chatLength();
    await openAvoid();
    const caught = await pickExit('huir-3');
    await dice(0.999);
    const caughtFight = await fight();
    const caughtLog = await chatSince(beforeCaught);
    check('J12.2: saltar por la ventana y fallar: «¡A pelear!», empieza la pelea y ellos van primero',
        /A pelear/.test(caught?.next ?? '') && caught?.lines.some(l => /Fallo/.test(l)) === true && caughtFight.active
        && caughtFight.order[0]?.isEnemy === true && /Os han pillado: ellos atacan primero/.test(caughtLog),
        JSON.stringify({ caught, order: caughtFight.order }));
    check('J12.6 y D-J56: Bran va solo y el tablero es para cuatro: sale un guardia menos, y se dice',
        caughtFight.enemies.filter(e => /^Guardia de Montesclaros/.test(e.name)).length === 1
        && /pensado para un grupo de 4 y el vuestro es de 1: hay un enemigo menos \(Guardia de Montesclaros\)/.test(caughtLog),
        JSON.stringify({ enemies: caughtFight.enemies, log: caughtLog.split('\n').filter(l => /⚖️/.test(l)) }));

    // 5. J8.5: en la barra del combate, «Hablar». Convencer, con el dado a favor.
    const myTurn = await toPlayerTurn();
    const opened = await openParley();
    const parley = await exitWindow();
    await shoot('hablar en mitad de la pelea, en su ventana');
    check('J8.5: «Hablar» en la barra del combate abre las cuatro formas, con Torres en la placa',
        myTurn && opened && parley?.plate === 'Alguacil Torres'
        && JSON.stringify(parley.options.map(o => o.id)) === JSON.stringify(['seguir', 'entregarse', 'sobornar', 'convencer', 'enganar'])
        && parley.options.filter(o => o.id !== 'seguir').every(o => !o.locked), JSON.stringify(parley));
    const convinced = await pickExit('convencer');
    await until(async () => !(await fight()).active, 8000);
    let now = await state();
    check('J8.5: convencer sale: se van, la pelea se acaba, el tablero es vuestro y el hito del cáliz se cumple',
        /Los guardias dudan y bajan las lanzas/.test(convinced?.lines.join(' ') ?? '') && !now.fighting && innWon(now)
        && now.done.includes('el-caliz-ensangrentado') && now.heard.includes('r-traicion-en-la-puerta'),
        JSON.stringify({ convinced, now: { ...now, party: undefined } }));

    // 6. Sobornar: la pelea otra vez (se prepara), y Torres coge 8 de oro. Antes, J4.6: Bran
    // sube a nivel 5 (a mano) y la posada es para nivel 1 a 2: los enemigos aprietan más, y se dice.
    await resetInn();
    await page.evaluate(async () => {
        const state = await import('/scripts/party/state.js');
        state.partyMembers[0].level = 5;
        (await import('/scripts/party/roster.js')).savePartyState();
    });
    await page.waitForTimeout(800);
    const levelFrom = await chatLength();
    await startFightNow();
    const levelLog = await chatSince(levelFrom);
    const levelFight = await page.evaluate(async () => ((await import('/scripts/party.js')).getCombatEncounter()?.enemies ?? [])
        .map((/** @type {any} */ e) => ({ name: String(e.name), maxHp: Number(e.maxHp) || 0, steps: Number(e.levelSteps) || 0 })));
    check('J4.6: con nivel 5 en un tablero para nivel 1 a 2, los enemigos aprietan más (Torres, de 45 a 61 de vida), y se dice llano',
        /Vais por encima de lo que pide la campaña: los enemigos aprietan más\. Este tablero es para nivel 1 a 2 y vuestro grupo es de nivel 5\./.test(levelLog)
        && levelFight.some(e => /^Alguacil Torres/.test(e.name) && e.maxHp === 61 && e.steps === 3)
        // Uno más por el nivel y dos menos por ir solo: se dice lo que queda, una vez (J12.6).
        && /Por vuestro nivel y por cuántos sois, hay un enemigo menos: Guardia de Montesclaros\./.test(levelLog)
        && !/Por vuestro nivel, hay un enemigo más/.test(levelLog),
        JSON.stringify({ levelFight, log: levelLog.split('\n').filter(l => /⚖️/.test(l)) }));
    await toPlayerTurn();
    const goldBefore = (await state()).party[0].gold;
    await openParley();
    const bribed = await pickExit('sobornar');
    await until(async () => !(await fight()).active, 8000);
    now = await state();
    check('J8.5: sobornar: Torres coge 8 de oro y se van; la pelea es vuestra',
        /Torres cuenta las monedas/.test(bribed?.lines.join(' ') ?? '') && now.party[0].gold <= goldBefore - 8 && (bribed?.lines.join(' ') + ' ' + JSON.stringify(bribed)).includes('8') && !now.fighting && innWon(now),
        JSON.stringify({ bribed, goldBefore, gold: now.party[0].gold }));

    // 7. Engañar: se asoman a la ventana y os vais; Torres os la guarda.
    await resetInn();
    await page.waitForTimeout(800);
    await startFightNow();
    await toPlayerTurn();
    const grudgeBefore = Number((await state()).attitudes['Alguacil Torres'] ?? 0);
    await openParley();
    const tricked = await pickExit('enganar');
    await until(async () => !(await fight()).active, 8000);
    now = await state();
    check('J8.5: engañar: se asoman a la ventana, se acaba la pelea, y Torres os mira peor (os la guarda)',
        /el cuarto está vacío/.test(tricked?.lines.join(' ') ?? '') && !now.fighting && innWon(now)
        && Number(now.attitudes['Alguacil Torres'] ?? 0) < grudgeBefore, JSON.stringify({ tricked, attitudes: now.attitudes }));

    // 8. Entregarse: se acaba, os sacan del tablero y os quitan la bolsa.
    await resetInn();
    await page.waitForTimeout(800);
    await startFightNow();
    await toPlayerTurn();
    const beforeSurrender = (await state()).party[0].gold;
    const surrenderFrom = await chatLength();
    await openParley();
    const given = await pickExit('entregarse');
    await until(async () => !(await fight()).active, 8000);
    now = await state();
    const surrenderLog = await chatSince(surrenderFrom);
    check('J8.5: entregarse: os atan, os quitan 5 de oro, pasa el tiempo y os sacan del cuarto; la historia sigue (Giles abre)',
        /Giles te hace una seña/.test(given?.lines.join(' ') ?? '') && !now.fighting && now.board === '' && innWon(now)
        && now.party[0].gold <= beforeSurrender - 5, JSON.stringify({ given, board: now.board, gold: now.party[0].gold, beforeSurrender }));
    check('J8.5: el final de la pelea dice que os habéis rendido, no que os retiráis',
        /Resultado: os habéis rendido\./.test(surrenderLog) && !/Os retiráis a tiempo/.test(surrenderLog) && /Giles te hace una seña/.test(surrenderLog),
        surrenderLog.slice(-600));

    // 9. J12.2 bien: saltar por la ventana con el dado a favor: el tablero, pasado sin pelear.
    await resetInn();
    await page.waitForTimeout(800);
    const beforeJump = await chatLength();
    await openAvoid();
    const jumped = await pickExit('huir-3');
    now = await state();
    await dropToasts();
    // D-J45: lo que pasó se lee en la novela, y «Continuar» sigue el hilo, como tras ganar.
    const told = await until(() => page.evaluate(() => Boolean(document.querySelector('#game-shell .gs-vn-box .gs-chip-continue'))), 8000);
    const onward = await page.evaluate(() => {
        const chip = document.querySelector('#game-shell .gs-vn-box .gs-chip-continue');
        return {
            scene: document.querySelector('#game-shell')?.getAttribute('data-scene') || '',
            box: (document.querySelector('#game-shell .gs-vn-box')?.textContent || '').replace(/\s+/g, ' ').trim().slice(-500),
            after: chip?.getAttribute('data-after') || '', next: chip?.getAttribute('data-next') || '', title: chip?.getAttribute('title') || '',
        };
    });
    await shoot('pasado sin pelear: lo que pasó, en la novela, con «Continuar»');
    check('J12.2: saltar por la ventana y salir bien: no hay pelea, el tablero queda pasado y ya no espera nadie',
        /ruedas por las tejas/.test(jumped?.lines.join(' ') ?? '') && /Seguir/.test(jumped?.next ?? '') && !now.fighting && innWon(now)
        && !(await chips()).some(c => /^Iniciar combate|^Evitar la pelea/.test(c))
        && /ruedas por las tejas/.test(await chatSince(beforeJump)),
        JSON.stringify({ jumped, chips: await chips() }));
    check('D-J45: pasado sin pelear, lo que pasó se lee en la novela y «Continuar» sigue el hilo',
        told && onward.scene === 'dialogue' && /ruedas por las tejas/.test(onward.box), JSON.stringify(onward));
    await page.locator('#game-shell .gs-vn-box .gs-chip-continue').first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const after = await page.evaluate(() => ({
        scene: document.querySelector('#game-shell')?.getAttribute('data-scene') || '',
        focus: (document.querySelector('#game-shell .gs-focus')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160),
    }));
    await shoot('tras «Continuar»');
    check('D-J45: «Continuar» lleva a lo siguiente del hilo (el precio del escape: Giles)', after.scene !== 'dialogue' || /Giles/.test(after.focus),
        JSON.stringify({ onward, after, board: (await state()).board }));

    check('sin errores en la página', problems.length === 0, problems.slice(0, 6).join('\n        '));
} catch (error) {
    failures++;
    console.log(`FAIL  the run threw: ${/** @type {any} */ (error)?.message || error}`);
    if (SHOT && page) await page.screenshot({ path: `${SHOT.replace(/\.png$/i, '')}-error.png` }).catch(() => {});
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
