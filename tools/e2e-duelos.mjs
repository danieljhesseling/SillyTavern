#!/usr/bin/env node
/**
 * J12.7 de wiki/ROADMAP_SIN_CONEXION.md jugado sin conexión, desde el gremio y con el ratón,
 * contra un servidor propio con un `--dataRoot` temporal, como las otras vueltas:
 *
 *   «Jugar sin conexión», Tessa → saltar la prueba y contratar a Gerd → el pueblo, la taberna:
 *   por la mañana no hay con quién pelear (se dice por qué) → «Pasar el rato»: por la tarde,
 *   «Armar una pelea» y el duelo por dinero con Rosa la Remera →
 *   el duelo por 10 de oro: su escena, el tablero de la taberna, el cartel con la regla, colocarse
 *   antes de la iniciativa (solo Tessa; Rosa espera a la vista) y «Empezar», Gerd mirando desde la
 *   pared (sin turno), los puños (solo al de al lado), agarrar y empujar → se gana: +10 de oro, la
 *   escena del final, de vuelta al pueblo, el tablero fuera y la parte del día gastada →
 *   la pelea que armas tú, y se pierde: quien cae queda fuera de combate (sin salvaciones), nadie
 *   muere, al acabar todos con 1 PG, la bolsa más ligera, lo roto, y Tomás enfadado →
 *   alguien te busca pelea: su escena (pelear, calmarle, invitarle, irte), y le calmas →
 *   amenazas a Ramiro, no se asusta y te reta por honor: aceptas, y en mitad del duelo «Hablar»
 *   deja rendirse; rendirse es perder.
 *
 * Lo que se prepara a mano se dice en cada paso: el dado (`setRandomSource`) y la vida del grupo
 * (para que la pelea acabe como se quiere probar). Lo que se prueba se hace con el ratón.
 *
 * Uso:
 *   node tools/e2e-duelos.mjs                                   # sin ventana, puerto 8429
 *   node tools/e2e-duelos.mjs --headed
 *   node tools/e2e-duelos.mjs --port 8429 --captura du.png      # du-01-taberna-mañana.png…
 */

/* global window, document */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8429;
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

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-duelos-'));
/** @type {any} */
let server = null;
/** @type {any} */
let browser = null;

function startServer() {
    server = spawn(process.execPath, ['server.js', '--browserLaunchEnabled', 'false', '--port', String(PORT), '--dataRoot', dataRoot], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    const child = server;
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('the server did not start in 420s')), 420000);
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
            window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,combat,travel,prisoners,mesa,high,spell,pet,bill,move,attack,roll,talk,journal');
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
            // Sin sucesos ni escenas del hilo que se metan en medio de la taberna.
            window.localStorage.setItem('sillytavern_gameSucesos', 'off');
            window.localStorage.setItem('sillytavern_gameStoryWindows', 'off');
        } catch { /* nada */ }
    });

    let shots = 0;
    const shoot = async (/** @type {string} */ what) => {
        if (!SHOT) return;
        shots += 1;
        const file = `${SHOT.replace(/\.png$/i, '')}-${String(shots).padStart(2, '0')}-${what}.png`;
        await page.screenshot({ path: file });
        console.log(`      captura: ${file}`);
    };
    const until = async (/** @type {() => Promise<boolean>} */ test, ms = 30000) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (await test().catch(() => false)) return true;
            await page.waitForTimeout(300);
        }
        return false;
    };
    const clearDice = async () => {
        let misses = 0;
        for (let i = 0; i < 40; i++) {
            const next = page.locator('.wm-dice-overlay.active .wm-dice-next');
            if (await next.count() === 0) return;
            const clicked = await next.click({ timeout: 1500 }).then(() => true).catch(() => false);
            if (!clicked && ++misses >= 2) return;
            await page.waitForTimeout(200);
        }
    };
    const dropToasts = () => page.evaluate(() => {
        document.querySelectorAll('#toast-container .toast').forEach(t => t.remove());
        document.querySelectorAll('.vs-card').forEach(c => c.remove());
    });
    const chips = () => page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-chip-action')].map(c => (c.textContent || '').trim()));
    const clickChip = (/** @type {RegExp} */ pattern) => page.evaluate((source) => {
        const chip = [...document.querySelectorAll('#game-shell .gs-chip-action')].find(b => new RegExp(source).test(b.textContent || ''));
        if (chip instanceof window.HTMLElement) chip.click();
        return Boolean(chip);
    }, pattern.source);
    const chatLength = () => page.evaluate(() => (window.SillyTavern.getContext().chat || []).length);
    const chatSince = (/** @type {number} */ from) => page.evaluate((start) => (window.SillyTavern.getContext().chat || [])
        .slice(start).map((/** @type {any} */ m) => String(m.extra?.display_text || m.mes || '')).join('\n'), from);
    const sceneNow = () => page.evaluate(() => document.querySelector('#game-shell')?.getAttribute('data-scene') || '');
    /** «Continuar», al acabar de leer, hasta la escena que toca. */
    const carryOn = async (/** @type {string} */ wanted) => {
        await until(async () => {
            if (await sceneNow() === wanted) return true;
            await page.evaluate(() => /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .gs-vn-box .gs-chip-continue'))?.click());
            return false;
        }, 10000);
        return sceneNow();
    };
    /** El dado de la partida: 0.999 saca siempre 20; 0, siempre 1; nulo, al azar (se dice: es preparar la mesa). */
    const dice = (/** @type {number|null} */ value) => page.evaluate(async (v) => {
        (await import('/scripts/party/combat-rules.js')).setRandomSource(v === null ? null : () => v);
    }, value);
    /** Preparar la mesa: la vida del grupo (Tessa la primera), para que la pelea acabe como se quiere probar. */
    const setLife = (/** @type {number[]} */ hps) => page.evaluate(async (list) => {
        const state = await import('/scripts/party/state.js');
        state.partyMembers.forEach((m, i) => {
            if (list[i] === undefined) return;
            Object.assign(m, { hp: list[i], maxHp: Math.max(Number(m.maxHp) || 0, list[i]) });
        });
        (await import('/scripts/party/roster.js')).savePartyState();
    }, hps);
    const state = () => page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const m = ctx.chatMetadata || {};
        const party = (await import('/scripts/party.js')).getPartyMembersSnapshot();
        const wi = await import('/scripts/world-info.js');
        const here = wi.getCurrentWorldLocationMaps().find((/** @type {any} */ l) => l.name === m.currentLocation);
        return {
            world: String(m.world_info ?? ''),
            board: String(m.currentBoard ?? ''),
            location: String(m.currentLocation ?? ''),
            boards: (here?.boards ?? []).map((/** @type {any} */ b) => String(b.name)),
            fighting: Boolean(m.combatEncounter?.active),
            brawl: m.combatEncounter?.active ? (m.combatEncounter.brawl ?? null) : null,
            left: m.combatEncounter?.active ? (m.combatEncounter.left ?? []) : [],
            party: party.map((/** @type {any} */ p) => ({
                id: String(p.id), name: String(p.name), hp: Number(p.hp) || 0, dead: Boolean(p.dead), gold: Number(p.gold) || 0,
                saves: p.deathSaves ?? null, at: `${Number(p.mapPosition?.gridX) || 0},${Number(p.mapPosition?.gridY) || 0}`,
            })),
            gold: party.reduce((/** @type {number} */ sum, /** @type {any} */ p) => sum + (Number(p.gold) || 0), 0),
            marks: (m.worldMarks || []).map((/** @type {any} */ k) => `${k.deed}@${k.place ?? ''}`),
            fame: m.fame ?? {},
            brawls: (m.tavernBrawls?.events ?? []).map((/** @type {any} */ e) => `${e.what}:${e.who}`),
            clock: (document.querySelector('#game-shell .gs-clock-label')?.textContent || '').trim(),
        };
    });
    /** El combate: de quién es el turno, quién pelea y quién mira. */
    const fight = () => page.evaluate(async () => {
        const enc = /** @type {any} */ ((await import('/scripts/party.js')).getCombatEncounter());
        const entry = enc?.active ? enc.turnOrder?.[enc.currentTurnIndex] ?? null : null;
        return {
            active: Boolean(enc?.active),
            turn: entry ? { name: String(entry.name), isEnemy: Boolean(entry.isEnemy) } : null,
            order: (enc?.turnOrder ?? []).map((/** @type {any} */ e) => String(e.name)),
            enemies: (enc?.enemies ?? []).map((/** @type {any} */ e) => ({ name: String(e.name), hp: Number(e.currentHp) || 0, at: `${e.gridX},${e.gridY}` })),
        };
    });
    /** Lo que se ve dentro de un sitio del pueblo. */
    const placeScene = () => page.evaluate(() => {
        const scene = document.querySelector('#game-shell .gs-town-scene');
        const line = scene?.querySelector('.gs-town-line');
        return {
            place: scene?.getAttribute('data-place') || '',
            plate: (scene?.querySelector('.gs-town-plate')?.textContent || '').trim(),
            mood: /** @type {HTMLElement|null} */ (scene?.querySelector('.gs-town-portrait'))?.dataset.mood || '',
            line: (line?.textContent || '').trim(),
            acts: [...(scene?.querySelectorAll('.gs-town-act') ?? [])].map(b => ({
                id: b.getAttribute('data-action') || '',
                label: (b.querySelector('.gs-btn-label')?.textContent || b.textContent || '').replace(/\s+/g, ' ').trim(),
                enabled: !(/** @type {HTMLButtonElement} */ (b).disabled),
                detail: (b.querySelector('.gs-btn-detail')?.textContent || '').trim(),
            })),
        };
    });
    const enterPlace = async (/** @type {string} */ id) => {
        await clearDice();
        if ((await placeScene()).place === id) return true;
        if (await page.locator('#game-shell .gs-town-scene').count() > 0) {
            await page.locator('#game-shell .gs-town-back').click({ timeout: 5000 }).catch(() => {});
            await until(() => page.evaluate(() => !document.querySelector('#game-shell .gs-town-scene')), 5000);
        }
        await until(async () => await page.locator(`#game-shell .gs-town-place[data-place="${id}"]`).count() > 0, 10000);
        await page.locator(`#game-shell .gs-town-place[data-place="${id}"]`).click({ timeout: 8000 }).catch(() => {});
        return until(async () => (await placeScene()).place === id, 8000);
    };
    const brawlActs = async () => (await placeScene()).acts.filter(a => a.id.startsWith('brawl-'));
    // Antes de pulsar, los dados que sigan a la vista (el último golpe de una pelea tapaba la tarjeta).
    const clickAct = async (/** @type {string} */ id) => {
        await clearDice();
        await page.locator(`#game-shell .gs-town-scene .gs-town-act[data-action="${id}"]`).click({ timeout: 5000 });
    };
    /** La barra de colocarse (tanda 10), como se ve: quién se coloca, las casillas azules y si ya hay pelea. */
    const placement = () => page.evaluate(async () => {
        const bar = document.querySelector('.cv-place');
        const fe = await import('/scripts/party/fight-entry.js');
        return {
            bar: Boolean(bar),
            title: (bar?.querySelector('.cv-place-title')?.textContent || '').trim(),
            hint: (bar?.querySelector('.cv-place-hint')?.textContent || '').trim(),
            faces: [...(bar?.querySelectorAll('.cv-place-face') ?? [])].map(f => ({ name: (f.querySelector('.cv-place-name')?.textContent || '').trim(), locked: f.classList.contains('locked') })),
            cells: [...document.querySelectorAll('#game-shell .wm-highlight-place')].map(n => ({ x: Number(n.getAttribute('data-x')), y: Number(n.getAttribute('data-y')) })),
            foes: [...document.querySelectorAll('#game-shell .wm-token.wm-token-enemy')].map(t => (t.getAttribute('title') || t.textContent || '').trim().slice(0, 40)),
            entry: fe.fightEntryState(),
            fighting: Boolean(window.SillyTavern.getContext().chatMetadata?.combatEncounter?.active),
        };
    });
    /** «Empezar» en la barra de colocarse: la iniciativa. */
    const startFromPlacement = async () => {
        await dropToasts();
        await page.locator('.cv-place .cv-place-start').click({ timeout: 5000 }).catch(() => {});
        return until(async () => (await state()).fighting, 10000);
    };
    /** La ventana de la taberna (la de las salidas de una pelea), como se ve. */
    const exitWindow = () => page.evaluate(() => {
        const dialog = document.querySelector('dialog.ev-dialog[open]');
        if (!dialog) return null;
        const plate = /** @type {HTMLElement|null} */ (dialog.querySelector('.qd-nameplate'));
        return {
            kind: dialog.querySelector('.ev-root')?.getAttribute('data-kind') || '',
            title: (dialog.querySelector('.qd-title')?.textContent || '').trim(),
            plate: plate && !plate.hidden ? (plate.textContent || '').trim() : '',
            lines: [...dialog.querySelectorAll('.ev-text .qd-line')].map(p => (p.textContent || '').trim()),
            options: [...dialog.querySelectorAll('.ev-option')].map(o => ({
                id: o.getAttribute('data-exit') || '', locked: o.classList.contains('dw-locked'),
                text: (o.querySelector('.dw-said')?.textContent || '').trim(), detail: (o.querySelector('.ev-detail')?.textContent || '').trim(),
                check: (o.querySelector('.dw-check')?.textContent || '').trim(), why: (o.querySelector('.dw-why')?.textContent || '').trim(),
            })),
            next: (dialog.querySelector('.ev-next')?.textContent || '').trim(),
        };
    });
    /** Elegir en la ventana, con el ratón. Si sale lo que pasa, se lee y se sigue. */
    const pickExit = async (/** @type {string} */ id, /** @type {string} */ shot = '') => {
        await page.locator(`dialog.ev-dialog[open] .ev-option[data-exit="${id}"]`).click({ timeout: 5000 });
        await page.waitForTimeout(500);
        const seen = await exitWindow();
        if (seen?.next) {
            if (shot) await shoot(shot);
            await page.locator('dialog.ev-dialog[open] .ev-next').click({ timeout: 5000 }).catch(() => {});
        }
        await until(async () => !(await exitWindow()), 5000);
        await page.waitForTimeout(600);
        await clearDice();
        return seen;
    };
    /** Esperar al turno de Tessa (los demás juegan solos). Falso si la pelea se acaba antes. */
    const toMyTurn = async () => {
        for (let i = 0; i < 40; i++) {
            await clearDice();
            const now = await fight();
            if (!now.active) return false;
            if (now.turn && !now.turn.isEnemy && now.turn.name === 'Tessa') return true;
            await page.waitForTimeout(400);
        }
        return false;
    };
    /** El cartel del combate: lo que dice ahora. */
    const banner = () => page.evaluate(() => {
        const node = document.querySelector('.br-banner');
        return node ? {
            title: (node.querySelector('.br-title')?.textContent || '').trim(),
            rule: (node.querySelector('.br-rule')?.textContent || '').trim(),
            stakes: (node.querySelector('.br-stakes')?.textContent || '').trim(),
            watch: (node.querySelector('.br-watch')?.textContent || '').trim(),
        } : null;
    });
    /** El menú de Atacar de la barra (tanda 10): el arma (en una pelea así, los puños) y a quién llega. */
    const attackMenu = () => page.evaluate(() => {
        const menu = document.querySelector('#game-shell .gs-grimoire[data-menu="atacar"]');
        return menu ? {
            weapon: (menu.querySelector('.gs-card .gs-card-name-text')?.textContent || '').trim(),
            cards: [...menu.querySelectorAll('.gs-card')].map(c => ({
                pick: c.getAttribute('data-pick') || '',
                name: (c.querySelector('.gs-card-name-text')?.textContent || '').trim(),
                badges: [...c.querySelectorAll('.gs-card-badge')].map(t => (t.textContent || '').trim()),
                off: /** @type {HTMLButtonElement} */ (c).disabled === true,
                why: (c.querySelector('.gs-card-why')?.textContent || '').trim(),
            })),
        } : null;
    });
    /** En el turno de Tessa: «Atacar» en la barra; si alguien está a su alcance, se le pega; si no, «Fin de turno». */
    const myTurnPunch = async () => {
        await clearDice();
        await dropToasts();
        await page.waitForTimeout(300);
        const open = page.locator('#game-shell .gs-vtt-bar .gs-btn[data-menu="atacar"]');
        if (await open.count() > 0 && !(await open.first().isDisabled())) {
            if (!(await attackMenu())) await open.first().click({ timeout: 4000 }).catch(() => {});
            await page.waitForTimeout(300);
        }
        const menu = await attackMenu();
        const row = (menu?.cards ?? []).find(c => /^attack:/.test(c.pick) && !c.off);
        if (row) {
            const from = await chatLength();
            await page.locator(`#game-shell .gs-grimoire [data-pick="${row.pick}"]`).first().click({ timeout: 4000 }).catch(() => {});
            await page.waitForTimeout(800);
            await clearDice();
            return { punched: true, menu, said: (await chatSince(from)).slice(0, 300) };
        }
        await page.keyboard.press('Escape').catch(() => {});
        await page.locator('#game-shell .gs-btn-end').first().click({ timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(600);
        await clearDice();
        return { punched: false, menu };
    };

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    if (await page.locator('text=Welcome to SillyTavern!').waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#game-shell', { timeout: 90000 });

    // === 1. «Jugar sin conexión»: Tessa; saltar la prueba y contratar a Gerd ========================
    await page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Jugar sin conexión' }).click({ timeout: 30000 });
    await page.waitForSelector('.hc-root, dialog[open] .vt-card.vt-new', { timeout: 120000 });
    if (await page.locator('dialog[open] .vt-card.vt-new').count() > 0) await page.locator('dialog[open] .vt-card.vt-new').first().click();
    await page.waitForSelector('.hc-root', { timeout: 120000 });
    await page.fill('.hc-root .hc-name', 'Tessa');
    await page.locator('.hc-root .hc-gender[data-value="Mujer"]').click();
    for (const [pick, wanted] of [['race', 'Humano'], ['class', 'Soldado']]) {
        await page.locator(`.hc-root .hc-card[data-pick="${pick}"] .hc-pick`).click();
        await page.waitForSelector('.hc-picker .hc-option', { timeout: 15000 });
        const values = await page.evaluate(() => [...document.querySelectorAll('.hc-picker .hc-option')].map(o => o.getAttribute('data-value') || ''));
        const chosen = values.find(v => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(wanted.toLowerCase())) ?? values[0];
        await page.locator(`.hc-picker .hc-option[data-value="${chosen}"]`).first().click();
        await page.waitForTimeout(400);
    }
    await page.locator('.hc-root .hc-enter').click();
    await until(async () => /Gremio/.test((await state()).world), 90000);
    await until(async () => /Al ladrón/.test(await chatSince(0)), 30000);
    // El muelle (tanda 10): «Continuar» lleva al tablero y el ratero os cierra el paso en su
    // ventana; se le habla con el dado a favor (no hay pelea). «Saltar la prueba» está fuera del
    // tablero: se sale con su botón y se salta. Si algo se cruza, otra vez.
    let skipped = false;
    for (let i = 0; i < 24 && !skipped; i++) {
        await dropToasts();
        if (await page.locator('dialog.ev-dialog[open] .ev-option[data-exit="hablar-1"]').count() > 0) {
            await dice(0.999);
            await pickExit('hablar-1');
            await dice(null);
            continue;
        }
        await page.locator('dialog.ev-dialog[open] .ev-next').click({ timeout: 1000 }).catch(() => {});
        await page.locator('dialog.ps-dialog[open] :is(.ps-finish, .ps-next, .qd-leave)').first().click({ timeout: 1000 }).catch(() => {});
        if (await clickChip(/^Saltar la prueba$/)) {
            await page.waitForSelector('.popup:has-text("¿Saltar la prueba?")', { timeout: 10000 }).catch(() => {});
            await page.locator('.popup-button-ok:visible').first().click({ timeout: 5000 }).catch(() => {});
            skipped = await until(async () => /bodega|libro del gremio|moja la pluma|Subes/.test(await chatSince(0)), 8000);
            continue;
        }
        const now = await state();
        if (now.board && !now.fighting) {
            // Fuera del tablero, con su botón (o la ficha de la fila).
            if (!(await clickChip(/^Salir del tablero$|^Volver a Puerto Alba$/))) {
                await page.locator('#game-shell .wm-leave-loc-btn').first().click({ timeout: 2000 }).catch(() => {});
            }
        } else {
            await page.evaluate(() => /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .gs-vn-box .gs-chip-continue'))?.click());
        }
        await page.waitForTimeout(700);
        await clearDice();
    }
    await page.waitForTimeout(800);
    await clearDice();
    await carryOn('exploration');
    if ((await state()).board) {
        await clickChip(/^Salir del tablero$|^Volver a Puerto Alba$/);
        await page.locator('#game-shell .wm-leave-loc-btn').first().click({ timeout: 2000 }).catch(() => {});
        await until(async () => (await state()).board === '', 8000);
    }
    await dropToasts();
    // Contratar a Gerd en el gremio del pueblo.
    await enterPlace('gremio');
    await clickAct('hub-hire').catch(() => {});
    await page.waitForSelector('.hb-root [data-hireling="Gerd el Mellado"]', { timeout: 15000 }).catch(() => {});
    await page.locator('.hb-root [data-hireling="Gerd el Mellado"]').click({ timeout: 5000 }).catch(() => {});
    const hired = await until(async () => (await state()).party.length === 2, 10000);
    await page.locator('dialog[open]:not([closing]) :is(.hb-close, .mm-close, .popup-button-ok):visible').first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);
    check('Tessa salta la prueba y contrata a Gerd en el gremio: son dos', skipped && hired, JSON.stringify({ skipped, chips: await chips(), party: (await state()).party }));
    await carryOn('exploration');
    await dropToasts();

    // === 2. La taberna por la mañana: no hay con quién =================================================
    const inInn = await enterPlace('posada');
    const morning = await brawlActs();
    const clockMorning = (await state()).clock;
    await shoot('taberna-manana');
    const startM = morning.find(a => a.id === 'brawl-start');
    const duelM = morning.find(a => a.id === 'brawl-duel');
    check('J12.7: en la taberna, «Armar una pelea» y el duelo con Rosa la Remera; por la mañana, apagados y con el porqué',
        inInn && /Mañana/.test(clockMorning) && startM?.enabled === false && /Por la mañana la taberna está casi vacía/.test(startM?.detail ?? '')
        && duelM?.enabled === false && /^Retar a Rosa la Remera a un duelo por dinero/.test(duelM?.label ?? '') && /Por la mañana Rosa la Remera no está/.test(duelM?.detail ?? ''),
        JSON.stringify({ inInn, clockMorning, morning }));

    // «Pasar el rato» en la taberna: llega la tarde.
    await clickAct('clock:slot').catch(() => {});
    await until(async () => /Tarde/.test((await state()).clock), 8000);
    await carryOn('exploration');
    await enterPlace('posada');
    const afternoon = await brawlActs();
    const startA = afternoon.find(a => a.id === 'brawl-start');
    const duelA = afternoon.find(a => a.id === 'brawl-duel');
    await shoot('taberna-tarde');
    check('J12.7: por la tarde ya se puede: armarla (lo roto lo pagas tú) y el duelo (5, 10 o 25 de oro, tu gente mira)',
        /Tarde/.test((await state()).clock) && startA?.enabled === true && /lo que se rompa lo pagas tú/.test(startA?.detail ?? '')
        && duelA?.enabled === true && /Se apuesta 5, 10 o 25 de oro; tu gente mira/.test(duelA?.detail ?? ''),
        JSON.stringify({ clock: (await state()).clock, afternoon }));

    // === 3. El duelo por dinero con Rosa: se gana ======================================================
    await dropToasts();
    await clickAct('brawl-duel').catch(() => {});
    await until(async () => Boolean(await exitWindow()), 6000);
    const offer = await exitWindow();
    await shoot('duelo-oferta');
    check('J12.7: retar a Rosa abre su escena: quién es, lo que dice, y cuánto apostar (5, 10, 25 o mejor no)',
        offer?.kind === 'brawl' && offer.plate === 'Rosa la Remera' && offer.lines.some(l => /Rosa la Remera se arremanga/.test(l))
        && offer.lines.some(l => /Tu gente se queda mirando desde la pared/.test(l))
        && JSON.stringify(offer.options.map(o => o.id)) === JSON.stringify(['apuesta-5', 'apuesta-10', 'apuesta-25', 'no'])
        && /Si ganas, \+10; si pierdes, −10/.test(offer.options[1]?.detail ?? ''), JSON.stringify(offer));
    // La mesa: Tessa aguanta, y los dados salen siempre 20 (Rosa no se rinde: pelea hasta caer).
    await setLife([120]);
    await dice(0.999);
    const goldBeforeDuel = (await state()).gold;
    const duelFrom = await chatLength();
    await pickExit('apuesta-10');
    // Tanda 10: decidido en la taberna, se coloca uno antes de la iniciativa (en un duelo, solo quien pelea).
    await until(async () => (await placement()).bar, 10000);
    await page.waitForTimeout(400);
    const duelBanner = await banner();
    const duelPlace = await placement();
    await shoot('duelo-colocarse');
    check('J12.7: tras apostar, a colocarse antes de la iniciativa: solo Tessa elige casilla (Gerd mira), Rosa espera a la vista, y aún no hay pelea',
        duelPlace.bar && !duelPlace.fighting && duelPlace.entry.placing && /^Duelo con Rosa la Remera/.test(duelPlace.title)
        && /Elige dónde empiezas/.test(duelPlace.hint) && JSON.stringify(duelPlace.faces.map(f => f.name)) === JSON.stringify(['Tessa'])
        && duelPlace.cells.length >= 4 && duelPlace.foes.some(f => /Rosa/.test(f)), JSON.stringify(duelPlace));
    // Un paso hacia Rosa: la casilla azul de la derecha.
    const tessaBefore = (await state()).party.find(p => p.name === 'Tessa')?.at ?? '';
    const [bx, by] = tessaBefore.split(',').map(Number);
    const closer = duelPlace.cells.find(c => c.x === bx + 1 && c.y === by) ?? duelPlace.cells.find(c => c.x > bx);
    if (closer) await page.locator(`#game-shell .wm-highlight-place[data-x="${closer.x}"][data-y="${closer.y}"]`).click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
    const tessaAfter = (await state()).party.find(p => p.name === 'Tessa')?.at ?? '';
    check('J12.7: pulsar una casilla azul pone ahí a Tessa', Boolean(closer) && tessaAfter === `${closer?.x},${closer?.y}`, JSON.stringify({ tessaBefore, closer, tessaAfter }));
    await startFromPlacement();
    await page.waitForTimeout(500);
    const duelStart = await state();
    const duelFight = await fight();
    const gerd = duelStart.party.find(p => p.name === 'Gerd el Mellado');
    const gerdToken = await page.evaluate(() => [...document.querySelectorAll('#game-shell .wm-token:not(.wm-token-enemy)')]
        .some(t => /Gerd/.test(`${t.getAttribute('title') || ''} ${t.textContent || ''}`)));
    await shoot('duelo-empieza');
    check('J12.7: empieza el duelo en el tablero de la taberna, con la bandera sin muertes, por 10 de oro',
        duelStart.fighting && duelStart.board === 'Duelo en la taberna' && duelStart.brawl?.kind === 'duelo'
        && duelStart.brawl?.way === 'apuesta' && duelStart.brawl?.stake === 10 && await sceneNow() === 'combat',
        JSON.stringify({ board: duelStart.board, brawl: duelStart.brawl, scene: await sceneNow() }));
    check('J12.7: al empezar, el cartel dice la regla (sin muertes, a puñetazos, sin magia que hiere), lo apostado y quién mira',
        /^Duelo con Rosa la Remera$/.test(duelBanner?.title ?? '') && /Quien cae a 0 PG queda fuera de combate/.test(duelBanner?.rule ?? '')
        && /10 de oro en la mesa/.test(duelBanner?.stakes ?? '') && /Gerd el Mellado/.test(duelBanner?.watch ?? '')
        && /Pelea sin muertes: a puñetazos/.test(await chatSince(duelFrom)), JSON.stringify(duelBanner));
    check('J12.7: Gerd mira desde la pared: se ve en el tablero, pero no tiene turno; enfrente, solo Rosa',
        Boolean(gerd) && duelStart.left.includes(String(gerd?.id)) && gerdToken && !duelFight.order.includes('Gerd el Mellado')
        && duelFight.order.includes('Tessa') && JSON.stringify(duelFight.enemies.map(e => e.name)) === JSON.stringify(['Rosa la Remera']),
        JSON.stringify({ left: duelStart.left, gerd, gerdToken, order: duelFight.order, enemies: duelFight.enemies }));

    /** @type {any[]} */
    const punches = [];
    for (let i = 0; i < 12 && (await fight()).active; i++) {
        if (!await toMyTurn()) break;
        punches.push(await myTurnPunch());
        if (process.env.DU_DEBUG) console.log('       golpe', JSON.stringify(punches.at(-1)));
    }
    if (process.env.DU_STOP === 'duelo') throw new Error('parado tras el duelo (DU_STOP)');
    await until(async () => !(await state()).fighting, 10000);
    await until(async () => {
        await clearDice();
        return (await exitWindow())?.kind === 'brawl';
    }, 40000);
    const duelEnd = await exitWindow();
    const afterDuel = await state();
    await shoot('duelo-ganado');
    const fistsCard = punches.find(p => p.menu)?.menu;
    check('J12.7: a puñetazos: en «Atacar» el arma son los puños (1d4, 5 pies), sin cambiar de arma, y solo llega a quien está al lado',
        punches.some(p => p.punched) && /^Puños$/.test(fistsCard?.weapon ?? '') && (fistsCard?.cards ?? []).some(c => c.badges.some(b => /1d4/.test(b)))
        && !(fistsCard?.cards ?? []).some(c => /^swapattack:/.test(c.pick) && !c.off) && punches.some(p => !p.punched || /5 pies/.test(JSON.stringify(p.menu))),
        JSON.stringify({ punches: punches.map(p => ({ punched: p.punched, said: p.said })), fistsCard }).slice(0, 1500));
    // Pegada a Rosa, la barra de 2024 ofrece también agarrar y empujar: el arma va guardada, y el escudo no quita la otra mano.
    const closeMenu = punches.map(p => p.menu).find(m => (m?.cards ?? []).some((/** @type {any} */ c) => /^attack:/.test(c.pick)));
    const grab = (closeMenu?.cards ?? []).find((/** @type {any} */ c) => c.pick === 'unarmed:agarrar');
    const shove = (closeMenu?.cards ?? []).find((/** @type {any} */ c) => c.pick === 'unarmed:empujar');
    check('J12.7: al lado de Rosa, «Agarrar» y «Empujar» se pueden (sin arma en la mano), además del puñetazo',
        Boolean(grab) && grab.off === false && Boolean(shove) && shove.off === false, JSON.stringify({ grab, shove }));
    check('J12.7: se gana: la escena del final con Rosa, «Ganas el duelo» y +10 de oro',
        duelEnd?.title === 'Ganas el duelo' && duelEnd.plate === 'Rosa la Remera' && duelEnd.lines.some(l => /\+10 de oro/.test(l))
        && afterDuel.gold === goldBeforeDuel + 10, JSON.stringify({ duelEnd, gold: [goldBeforeDuel, afterDuel.gold] }));
    await page.locator('dialog.ev-dialog[open] .ev-option').first().click({ timeout: 5000 }).catch(() => {});
    await until(async () => !(await exitWindow()), 5000);
    await page.waitForTimeout(800);
    await carryOn('exploration');
    const backInTown = await state();
    check('J12.7: de vuelta al pueblo, sin el tablero del duelo; la tarde se ha ido en el duelo, y en el pueblo se sabe',
        !backInTown.fighting && backInTown.board === '' && !backInTown.boards.some(b => /Duelo en la taberna/.test(b))
        && /Noche/.test(backInTown.clock) && backInTown.marks.includes('duelo-ganado@posada') && backInTown.brawls.includes('duelo:Rosa la Remera'),
        JSON.stringify({ board: backInTown.board, boards: backInTown.boards, clock: backInTown.clock, marks: backInTown.marks, brawls: backInTown.brawls }));

    // === 4. La pelea que armas tú, y se pierde: nadie muere ===========================================
    await enterPlace('posada');
    const night = await brawlActs();
    check('J12.7: hoy ya no hay otro duelo aquí (se dice), y armarla sigue abierto por la noche',
        night.find(a => a.id === 'brawl-duel')?.enabled === false && /Hoy ya has peleado un duelo aquí/.test(night.find(a => a.id === 'brawl-duel')?.detail ?? '')
        && night.find(a => a.id === 'brawl-start')?.enabled === true, JSON.stringify(night));
    // La mesa: poca vida, y los dados siempre 20: los camorristas tumban a quien toquen.
    await setLife([3, 3]);
    const goldBeforeBrawl = (await state()).gold;
    const brawlFrom = await chatLength();
    await dropToasts();
    await clickAct('brawl-start').catch(() => {});
    await until(async () => (await placement()).bar, 10000);
    await page.waitForTimeout(400);
    const brawlPlace = await placement();
    await shoot('pelea-colocarse');
    check('J12.7: armarla lleva a colocarse en el tablero de la taberna: el grupo entero, los camorristas a la vista junto a la barra, y aún sin pelea',
        brawlPlace.bar && !brawlPlace.fighting && /^Pelea en /.test(brawlPlace.title) && brawlPlace.faces.length === 2
        && brawlPlace.foes.length === 2 && brawlPlace.cells.length >= 2 && (await state()).board === 'Pelea en la taberna', JSON.stringify(brawlPlace));
    await startFromPlacement();
    await page.waitForTimeout(500);
    const brawlStart = await state();
    const brawlFight = await fight();
    await shoot('pelea-empieza');
    check('J12.7: armar la pelea: el tablero de la taberna, Tessa y Gerd contra dos camorristas, con la bandera sin muertes',
        brawlStart.fighting && brawlStart.board === 'Pelea en la taberna' && brawlStart.brawl?.kind === 'taberna'
        && brawlStart.brawl?.started === 'tu' && brawlFight.enemies.length === 2 && brawlFight.order.includes('Gerd el Mellado'),
        JSON.stringify({ board: brawlStart.board, brawl: brawlStart.brawl, order: brawlFight.order }));
    // Tessa no pega: pasa su turno, y deja que la tumben.
    for (let i = 0; i < 12 && (await fight()).active; i++) {
        if (await toMyTurn()) {
            await page.locator('#game-shell .gs-btn-end').first().click({ timeout: 4000 }).catch(() => {});
            await page.waitForTimeout(600);
        }
    }
    await until(async () => !(await state()).fighting, 15000);
    // La escena del final espera a que se cierren los dados del último golpe: se cierran.
    await until(async () => {
        await clearDice();
        return (await exitWindow())?.kind === 'brawl';
    }, 40000);
    const brawlEnd = await exitWindow();
    const brawlLog = await chatSince(brawlFrom);
    const afterBrawl = await state();
    await shoot('pelea-perdida');
    // La narración quita el emoji del principio de la línea (J13.8): se busca la frase.
    check('J12.7: quien cae queda fuera de combate («cae redondo… aquí nadie muere»), sin tirar salvaciones de muerte',
        /Tessa cae redondo/.test(brawlLog) && /Aquí nadie muere/.test(brawlLog) && !/salvaci[oó]n(es)? de muerte/i.test(brawlLog)
        && !/ha muerto|muere\b(?!.*nadie)/.test(brawlLog.replace(/Aquí nadie muere\./g, '')),
        (brawlLog.match(/.{0,40}(cae redondo|muert|salvaci).{0,80}/g) ?? []).join(' | ').slice(0, 600));
    check('J12.7: se pierde y nadie muere: todos de pie con 1 PG, vivos',
        afterBrawl.party.every(p => !p.dead && p.hp === 1), JSON.stringify(afterBrawl.party));
    check('J12.7: el final: «Pierdes la pelea», la bolsa más ligera, y lo dice Tomás o el camorrista',
        brawlEnd?.title === 'Pierdes la pelea' && afterBrawl.gold < goldBeforeBrawl && brawlEnd.lines.some(l => /Os falta \d+ de oro en la bolsa/.test(l))
        && afterBrawl.marks.includes('pelea@posada'), JSON.stringify({ brawlEnd, gold: [goldBeforeBrawl, afterBrawl.gold], marks: afterBrawl.marks }));
    await page.locator('dialog.ev-dialog[open] .ev-option').first().click({ timeout: 5000 }).catch(() => {});
    await until(async () => !(await exitWindow()), 5000);
    await page.waitForTimeout(800);
    await carryOn('exploration');
    await enterPlace('posada');
    await until(async () => (await placeScene()).mood === 'enfadado', 6000);
    const angry = await placeScene();
    await shoot('tomas-enfadado');
    check('J12.7: Tomás se acuerda de la pelea que armaste: enfadado, con su saludo de quien lo vio',
        angry.place === 'posada' && angry.mood === 'enfadado', JSON.stringify({ plate: angry.plate, mood: angry.mood, line: angry.line }));

    // === 5. Alguien te busca pelea: le calmas ==========================================================
    // Se pasa el rato hasta que alguien te la busque (por la tarde o por la noche, con su suerte).
    let rowdyAct = (await brawlActs()).find(a => a.id === 'brawl-rowdy');
    for (let i = 0; i < 14 && !rowdyAct; i++) {
        await clickAct('clock:slot').catch(() => {});
        await page.waitForTimeout(900);
        await carryOn('exploration');
        await dropToasts();
        await enterPlace('posada');
        rowdyAct = (await brawlActs()).find(a => a.id === 'brawl-rowdy');
    }
    await shoot('camorrista');
    check('J12.7: por la tarde o por la noche, a veces alguien te busca pelea, y sale en la taberna',
        Boolean(rowdyAct?.enabled) && / te busca pelea$/.test(rowdyAct?.label ?? '') && /calmarle hablando, invitarle a una ronda o irte/.test(rowdyAct?.detail ?? ''),
        JSON.stringify({ rowdyAct, clock: (await state()).clock }));
    if (rowdyAct) {
        await dice(0.999);
        await clickAct('brawl-rowdy').catch(() => {});
        await until(async () => Boolean(await exitWindow()), 6000);
        const rowdy = await exitWindow();
        await shoot('camorrista-escena');
        const name = rowdyAct.label.replace(/ te busca pelea$/, '');
        check('J12.7: su escena: quién es, lo que dice (en femenino a Tessa) y cuatro salidas: pelear, calmarle (Persuasión), invitarle o irte',
            rowdy?.kind === 'brawl' && rowdy.plate === name && rowdy.lines.length >= 2 && !rowdy.lines.join(' ').includes('{')
            && !/forastero\b/.test(rowdy.lines.join(' '))
            && JSON.stringify(rowdy.options.map(o => o.id)) === JSON.stringify(['pelear', 'calmar', 'ronda', 'irse']) && /Persuasión · CD 13/.test(rowdy.options[1]?.check ?? ''),
            JSON.stringify(rowdy));
        const calmed = await pickExit('calmar', 'camorrista-calmado');
        const afterCalm = await state();
        check('J12.7: calmarle sale: no hay pelea, y ya no te la busca más esta franja',
            !afterCalm.fighting && /Seguir/.test(calmed?.next ?? '') && (calmed?.lines.length ?? 0) >= 2 && !(await brawlActs()).some(a => a.id === 'brawl-rowdy'),
            JSON.stringify({ calmed, brawls: afterCalm.brawls }));
    }

    // === 6. El reto por honor: amenazas a Ramiro, y te reta =============================================
    // De noche la herrería está cerrada (Ramiro, en la posada): se pasa el rato hasta que abra.
    for (let i = 0; i < 3 && /Noche/.test((await state()).clock); i++) {
        await enterPlace('posada');
        await clickAct('clock:slot').catch(() => {});
        await page.waitForTimeout(900);
        await carryOn('exploration');
        await dropToasts();
    }
    await enterPlace('herreria');
    const forge = await placeScene();
    // J13.7: hasta que se presenta, «Hablar con el herrero».
    const talkAct = forge.acts.find(a => /^Hablar con (Ramiro|el herrero)/i.test(a.label)) ?? forge.acts.find(a => /^Hablar con/.test(a.label));
    await dropToasts();
    if (talkAct) await clickAct(talkAct.id).catch(() => {});
    await page.waitForTimeout(1200);
    // Con charla escrita, «Otras cosas» lleva a la de siempre (sonsacar, convencer, amenazar).
    const otras = page.locator('dialog[open] [data-option="otras"], dialog[open] [data-extra="otras"], dialog[open] .dw-extra');
    if (await otras.count() > 0) {
        await otras.first().click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(1200);
    }
    const threatOpen = await until(async () => await page.locator('.tk-root [data-act="amenazar"]').count() > 0, 8000);
    await dice(0);
    await page.locator('.tk-root [data-act="amenazar"]').first().click({ timeout: 4000 }).catch(() => {});
    await until(async () => (await exitWindow())?.kind === 'brawl', 8000);
    const dare = await exitWindow();
    await shoot('reto-honor');
    check('J12.7: amenazas a Ramiro, no se asusta, y te reta a un duelo por honor: aceptar o no, con lo que se juega',
        threatOpen && dare?.title === 'Un reto en Puerto Alba' && dare.plate === 'Ramiro' && dare.lines.some(l => /Ramiro se quita el mandil/.test(l))
        && JSON.stringify(dare.options.map(o => o.id)) === JSON.stringify(['aceptar', 'rechazar'])
        && /Si ganas, \+2 de fama en Puerto Alba/.test(dare.options[0]?.detail ?? ''), JSON.stringify({ threatOpen, talkAct, dare }));
    await dice(null);
    await setLife([60, 20]);
    const honorFrom = await chatLength();
    await pickExit('aceptar');
    await until(async () => (await placement()).bar, 10000);
    const honorPlaced = (await placement()).bar;
    await startFromPlacement();
    const honorStart = await state();
    check('J12.7: aceptado: a colocarse, «Empezar», y un duelo por honor contra Ramiro, y Gerd mira',
        honorPlaced && honorStart.brawl?.kind === 'duelo' && honorStart.brawl?.way === 'honor' && honorStart.brawl?.rival === 'Ramiro'
        && honorStart.left.length === 1, JSON.stringify({ brawl: honorStart.brawl, left: honorStart.left }));
    // En mitad del duelo, «Abandonar» (tanda 10: ya no hay «Hablar» en la barra): rendirse o seguir.
    await toMyTurn();
    await dropToasts();
    await page.locator('#game-shell .gs-vtt-bar .gs-btn-flee, #game-shell .gs-btn-parley').first().click({ timeout: 5000 }).catch(() => {});
    await until(async () => (await exitWindow())?.kind === 'brawl', 6000);
    const talkMid = await exitWindow();
    await shoot('duelo-abandonar');
    check('J12.7: «Abandonar» en un duelo no es huir: seguir peleando o rendirte (y lo que cuesta)',
        JSON.stringify(talkMid?.options.map(o => o.id)) === JSON.stringify(['seguir', 'rendirse']) && /−1 de fama en Puerto Alba/.test(talkMid?.options[1]?.detail ?? ''),
        JSON.stringify(talkMid));
    await page.locator('dialog.ev-dialog[open] .ev-option[data-exit="rendirse"]').click({ timeout: 5000 }).catch(() => {});
    await until(async () => !(await state()).fighting, 8000);
    await until(async () => (await exitWindow())?.title === 'Te rindes', 8000);
    const yielded = await exitWindow();
    const afterHonor = await state();
    await shoot('duelo-rendido');
    check('J12.7: rendirse es perder: «Te rindes», se sabe en Puerto Alba, y nadie se queda en el suelo',
        yielded?.title === 'Te rindes' && afterHonor.marks.includes('duelo-perdido@posada') && afterHonor.party.every(p => !p.dead && p.hp > 0)
        && /La pelea termina/.test(await chatSince(honorFrom)), JSON.stringify({ yielded, marks: afterHonor.marks, party: afterHonor.party }));
    await page.locator('dialog.ev-dialog[open] .ev-option').first().click({ timeout: 5000 }).catch(() => {});
    await until(async () => !(await exitWindow()), 5000);
    await carryOn('exploration');
    await shoot('al-final');

    console.log('\n--- problemas ---');
    console.log(problems.length ? problems.join('\n') : '(ninguno)');
    check('sin errores en la página', problems.filter(p => /PAGEERROR/.test(p)).length === 0, problems.slice(0, 6).join('\n        '));
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
