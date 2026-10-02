#!/usr/bin/env node
/**
 * Sin narrador (D-J60 de wiki/ROADMAP_SIN_CONEXION.md), en un navegador de verdad, contra un
 * servidor propio con un `--dataRoot` temporal, como las otras vueltas.
 *
 * Daniel, el 2026-10-02: «la figura del narrador en un juego sin conexión no la quiero». En la caja
 * de la novela todo lo dice alguien que está allí (la gente, tus compañeros o tú, al elegir); lo
 * que no dice nadie (un aviso del juego, la tirada, lo que cambia) va en un aviso pequeño fuera de
 * la caja.
 *
 *   «Jugar sin conexión» → el prólogo en sus ventanas (el muelle, Tomás, Brunilda) → la pelea del
 *   muelle → «Saltar la prueba» y la escena del tablón (Brunilda) → el gremio: contratar a un
 *   mercenario y aceptar un encargo → la tienda → la posada: comer y dormir (un descanso) → el
 *   viaje al sitio del encargo → el tablón: 1387 (el viaje desde Puerto Alba) y su primera escena →
 *   volver al gremio → el tablón: Strahd y su primera escena.
 *
 * En cada ventana de la novela (escenas, charlas, quedadas) y en la caja del Modo Juego se mira
 * cada línea: la dice quien está en la placa, o eres tú («Tú»). Ninguna sin dueño, ninguna nota
 * en la caja. Lo que no dice nadie, en el aviso de fuera.
 *
 * Uso:
 *   node tools/e2e-sin-narrador.mjs --port 8530
 *   node tools/e2e-sin-narrador.mjs --port 8530 --captura sn.png    # sn-01-muelle.png…
 *   node tools/e2e-sin-narrador.mjs --port 8530 --headed
 */

/* global window, document */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { entrarEnLaPelea } from './e2e-entrar-pelea.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8530;
const BASE = `http://127.0.0.1:${PORT}`;
const HEADED = process.argv.includes('--headed');
const SHOT = argAfter('--captura');

const require = createRequire(join(ROOT, 'tests/package.json'));
const { chromium } = require('@playwright/test');

let failures = 0;
const check = (/** @type {string} */ name, /** @type {boolean} */ ok, detail = '') => {
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        -> ${String(detail).slice(0, 1500)}` : ''}`);
};

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-sin-narrador-'));
/** @type {any} */
let server = null;
/** @type {any} */
let browser = null;

function startServer() {
    // Sin pestañas: el config.yaml de Daniel abre una en cada arranque.
    server = spawn(process.execPath, ['server.js', '--browserLaunchEnabled', 'false', '--port', String(PORT), '--dataRoot', dataRoot], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    const child = server;
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('the server did not start in 480s')), 480000);
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
    page.on('pageerror', (/** @type {any} */ e) => problems.push(`PAGEERROR ${e.message}`));
    await context.addInitScript(() => {
        try {
            window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,combat,travel,prisoners,mesa,high,spell,pet,bill,move,attack,roll,talk,journal');
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
            // Las tarjetas de suceso son otra ventana (no la novela): aquí no estorban.
            window.localStorage.setItem('sillytavern_gameSucesos', 'off');
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
            await page.waitForTimeout(350);
        }
        return false;
    };
    const state = () => page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const party = (await import('/scripts/party.js')).getPartyMembersSnapshot();
        const meta = ctx.chatMetadata || {};
        return {
            world: String(meta.world_info ?? ''),
            place: String(meta.currentLocation ?? ''),
            board: String(meta.currentBoard ?? ''),
            fighting: Boolean(meta.combatEncounter?.active),
            done: [...(meta.plotState?.done ?? [])],
            party: party.length,
        };
    });
    const chips = () => page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-chip-action')].map(c => (c.textContent || '').trim()));
    const clickChip = (/** @type {RegExp} */ pattern) => page.evaluate((source) => {
        const chip = [...document.querySelectorAll('#game-shell .gs-chip-action')].find(b => new RegExp(source).test(b.textContent || ''));
        if (chip instanceof window.HTMLElement) chip.click();
        return Boolean(chip);
    }, pattern.source);
    const sceneNow = () => page.evaluate(() => document.querySelector('#game-shell')?.getAttribute('data-scene') || '');
    const carryOn = async (/** @type {string} */ wanted) => {
        await until(async () => {
            if (await sceneNow() === wanted) return true;
            await page.evaluate(() => /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .gs-vn-box .gs-chip-continue'))?.click());
            return false;
        }, 12000);
        return sceneNow();
    };
    const clearDice = async () => {
        let misses = 0;
        for (let i = 0; i < 40; i++) {
            const next = page.locator('.wm-dice-overlay.active .wm-dice-next');
            if (await next.count() === 0) return;
            const clicked = await next.click({ timeout: 1500 }).then(() => true).catch(() => false);
            if (!clicked && ++misses >= 2) return;
            await page.waitForTimeout(150);
        }
    };
    const dropToasts = () => page.evaluate(() => document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));
    const clearPopups = async () => {
        await clearDice();
        for (let i = 0; i < 8; i++) {
            const open = await page.evaluate(() => {
                const pick = (/** @type {string} */ sel) => /** @type {HTMLElement|null} */ (document.querySelector(sel));
                const button = pick('.popup:not([closing]) .tr-detour') ?? pick('.popup:not([closing]) .rd-pass')
                    ?? pick('.popup:not([closing]) .rd-face') ?? pick('.popup:not([closing]) .gd-pay') ?? pick('.popup:not([closing]) .gd-flee')
                    ?? pick('.popup:not([closing]) .popup-button-ok');
                if (button && button.offsetParent) {
                    button.click();
                    return true;
                }
                return false;
            });
            if (!open) return;
            await page.waitForTimeout(500);
            await clearDice();
        }
    };

    // --- Lo que se mira -----------------------------------------------------------------------------
    /** @type {Array<{step: string, where: string, plate: string, line: string, why: string}>} */
    const broken = [];
    const seen = { windows: 0, windowLines: 0, boxes: 0, boxLines: 0, asides: /** @type {string[]} */ ([]), speakers: new Set() };

    /**
     * La ventana de la novela abierta, como se lee: su placa, cada línea de la caja (con su clase y
     * si lleva «Tú») y lo que va en el aviso de fuera.
     */
    const readWindow = () => page.evaluate(() => {
        const dialog = document.querySelector('dialog.qd-dialog[open]');
        if (!dialog) return null;
        const root = dialog.querySelector('.qd-root');
        const plate = /** @type {HTMLElement|null} */ (dialog.querySelector('.qd-nameplate'));
        const plateShown = Boolean(plate && !plate.hidden && window.getComputedStyle(plate).display !== 'none' && (plate.textContent || '').trim());
        return {
            kind: dialog.classList.contains('ps-dialog') && !dialog.classList.contains('ev-dialog') ? 'escena'
                : dialog.classList.contains('ev-dialog') ? 'salida'
                    : dialog.classList.contains('dw-dialog') ? 'charla' : 'ventana',
            id: root?.getAttribute('data-scene') || root?.getAttribute('data-dialogue') || '',
            plate: plateShown ? (plate?.textContent || '').trim() : '',
            lines: [...dialog.querySelectorAll('.qd-text .qd-line')].map(l => ({
                cls: l.className,
                you: (l.querySelector('.qd-who')?.textContent || '').trim(),
                text: (l.textContent || '').replace(/\s+/g, ' ').trim(),
            })),
            aside: [...dialog.querySelectorAll('.qd-aside .vn-aside-line')].map(l => (l.textContent || '').trim()),
            options: [...dialog.querySelectorAll('.dw-option:not(.dw-locked)')].map(o => o.getAttribute('data-option') || ''),
        };
    });

    /**
     * Mirar una pantalla de una ventana: cada línea es tuya («Tú») o de quien está en la placa.
     *
     * @param {string} step
     * @param {any} now
     */
    const auditWindow = (step, now) => {
        if (!now) return;
        seen.windows += 1;
        for (const line of now.aside) if (!seen.asides.includes(line)) seen.asides.push(line);
        for (const line of now.lines) {
            seen.windowLines += 1;
            const mine = /\bqd-you\b/.test(line.cls) && line.you === 'Tú';
            const theirs = !/\bqd-you\b/.test(line.cls) && Boolean(now.plate);
            const noted = /\b(?:qd-note|qd-summary|ps-narration|dw-note|dw-roll)\b/.test(line.cls);
            if (now.plate) seen.speakers.add(now.plate);
            if ((!mine && !theirs) || noted) {
                broken.push({ step, where: `${now.kind} ${now.id}`, plate: now.plate, line: line.text.slice(0, 160), why: noted ? 'una nota en la caja' : 'nadie la dice' });
            }
        }
    };

    /**
     * Jugar las ventanas de la novela que se abran, mirando cada pantalla: en una decisión, la
     * primera opción (o la pedida); si no, seguir. Las charlas, unas pocas respuestas y despedirse.
     * Las de «otra salida» (antes de una pelea) se miran pero las lleva la pelea.
     *
     * @param {string} step
     * @param {{pick?: string[], ms?: number, steps?: number}} [how]
     * @returns {Promise<string[]>} Las ventanas jugadas (su id).
     */
    const playWindows = async (step, { pick = [], ms = 4000, steps = 80 } = {}) => {
        /** @type {string[]} */
        const played = [];
        let talkSteps = 0;
        let idle = 0;
        for (let i = 0; i < steps; i++) {
            // El panel de victoria espera a que se cierre: la escena siguiente sale detrás.
            if (await page.locator('.vs-card').count() > 0) {
                await page.locator('.vs-card').first().click({ timeout: 3000 }).catch(() => {});
                await page.waitForTimeout(400);
            }
            const now = await readWindow();
            if (!now) {
                if (++idle * 350 > ms) break;
                await page.waitForTimeout(350);
                continue;
            }
            idle = 0;
            auditWindow(step, now);
            if (!played.includes(`${now.kind}:${now.id}`)) played.push(`${now.kind}:${now.id}`);
            if (now.kind === 'salida') break;
            if (now.kind === 'charla') {
                if (now.options.length > 0 && talkSteps < 3) {
                    talkSteps += 1;
                    await page.locator(`dialog.dw-dialog[open] .dw-option[data-option="${now.options[0]}"]`).first().click({ timeout: 3000 }).catch(() => {});
                } else {
                    talkSteps = 0;
                    await page.locator('dialog.dw-dialog[open] .dw-finish, dialog.dw-dialog[open] .dw-leave').first().click({ timeout: 3000 }).catch(() => {});
                }
            } else if (now.options.length > 0) {
                const choice = pick.find(id => now.options.includes(id)) ?? now.options[0];
                await page.locator(`dialog.qd-dialog[open] .dw-option[data-option="${choice}"]`).first().click({ timeout: 3000 }).catch(() => {});
            } else if (await page.locator('dialog.qd-dialog[open] .qd-chip-reply').count() > 0) {
                await page.locator('dialog.qd-dialog[open] .qd-chip-reply').first().click({ timeout: 3000 }).catch(() => {});
            } else {
                await page.locator('dialog.qd-dialog[open] .ps-next, dialog.qd-dialog[open] .ps-finish, dialog.qd-dialog[open] .qd-chip-next, dialog.qd-dialog[open] .qd-chip-finish, dialog.qd-dialog[open] .qd-chip')
                    .first().click({ timeout: 3000 }).catch(() => {});
            }
            await page.waitForTimeout(250);
            await clearDice();
        }
        return played;
    };

    /** La caja del Modo Juego, como se lee ahora (solo en la novela). */
    const readBox = () => page.evaluate(() => {
        const plate = /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .gs-vn-nameplate'));
        return {
            scene: document.querySelector('#game-shell')?.getAttribute('data-scene') || '',
            plate: plate && !plate.hidden ? (plate.textContent || '').trim() : '',
            lines: [...document.querySelectorAll('#game-shell .gs-vn-text .gs-vn-line')].map(l => ({
                who: /** @type {HTMLElement} */ (l).dataset.who || '',
                label: (l.querySelector('.gs-vn-who')?.textContent || '').trim(),
                note: l.classList.contains('gs-vn-note'),
                text: (l.textContent || '').replace(/\s+/g, ' ').trim(),
            })),
            aside: [...document.querySelectorAll('#game-shell .gs-vn-aside .vn-aside-line')].map(l => (l.textContent || '').trim()),
        };
    });

    /**
     * Mirar la caja del Modo Juego tras un paso: si se está leyendo la novela, cada línea la dice
     * alguien (con su nombre: en la placa o delante), y ninguna es una nota.
     *
     * @param {string} step
     * @returns {Promise<any>}
     */
    const auditBox = async (step) => {
        await page.waitForTimeout(500);
        const now = await readBox();
        if (now.scene !== 'dialogue') return now;
        seen.boxes += 1;
        for (const line of now.aside) if (!seen.asides.includes(line)) seen.asides.push(line);
        for (const line of now.lines) {
            seen.boxLines += 1;
            if (line.who) seen.speakers.add(line.who);
            const named = Boolean(line.who) && (Boolean(line.label) || Boolean(now.plate));
            if (!named || line.note) broken.push({ step, where: 'la caja', plate: now.plate, line: line.text.slice(0, 160), why: line.note ? 'una nota en la caja' : 'nadie la dice' });
        }
        console.log(`  · ${step}: ${now.lines.length} línea(s) en la caja${now.plate ? ` (${now.plate})` : ''}, ${now.aside.length} aviso(s) fuera`);
        return now;
    };

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
    const leaveBoard = async () => {
        for (let i = 0; i < 4 && (await state()).board; i++) {
            await clearPopups();
            if (!(await clickChip(/^Salir del tablero$/))) {
                await carryOn('combat');
                await page.locator('.wm-leave-loc-btn').filter({ visible: true }).first().click({ timeout: 4000 }).catch(() => {});
            }
            await page.waitForTimeout(900);
        }
        await clearPopups();
    };
    const placeScene = () => page.evaluate(() => {
        const scene = document.querySelector('#game-shell .gs-town-scene');
        return {
            place: scene?.getAttribute('data-place') || '',
            plate: (scene?.querySelector('.gs-town-plate')?.textContent || '').trim(),
            line: (scene?.querySelector('.gs-town-line')?.textContent || '').trim(),
            acts: [...(scene?.querySelectorAll('.gs-town-act') ?? [])].map(b => ({ id: b.getAttribute('data-action') || '', enabled: !(/** @type {HTMLButtonElement} */ (b).disabled) })),
        };
    });
    const leavePlace = async () => {
        if (await page.locator('#game-shell .gs-town-scene').count() === 0) return;
        await page.locator('#game-shell .gs-town-back').click({ timeout: 5000 }).catch(() => {});
        await until(() => page.evaluate(() => !document.querySelector('#game-shell .gs-town-scene')), 5000);
    };
    /** @type {string[]} */
    const greetings = [];
    const enterPlace = async (/** @type {string} */ id) => {
        await carryOn('exploration');
        await leavePlace();
        await page.locator(`#game-shell .gs-town-place[data-place="${id}"]`).click({ timeout: 8000 }).catch(() => {});
        const inside = await until(async () => (await placeScene()).place === id, 8000);
        const now = await placeScene();
        if (inside && now.line) greetings.push(`${now.plate}: ${now.line}`);
        return inside;
    };
    const placeAct = async (/** @type {string} */ id) => {
        await dropToasts();
        await page.locator(`#game-shell .gs-town-scene .gs-town-act[data-action="${id}"]`).first().click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(900);
    };

    // === 1. «Jugar sin conexión» y el prólogo en sus ventanas ======================================
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    if (await page.locator('text=Welcome to SillyTavern!').waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#game-shell', { timeout: 90000 });
    const offline = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Jugar sin conexión' });
    await until(async () => await offline.count() === 1, 30000);
    await offline.click();
    await page.waitForSelector('.hc-root, dialog[open] .vt-card.vt-new', { timeout: 120000 });
    if (await page.locator('dialog[open] .vt-card.vt-new').count() > 0) await page.locator('dialog[open] .vt-card.vt-new').first().click();
    await page.waitForSelector('.hc-root', { timeout: 120000 });
    await page.fill('.hc-root .hc-name', 'Irene');
    await page.locator('.hc-root .hc-gender[data-value="Mujer"]').click().catch(() => {});
    for (const [pick, wanted] of [['race', 'Humano'], ['class', 'Guerrero']]) {
        await page.locator(`.hc-root .hc-card[data-pick="${pick}"] .hc-pick`).click();
        await page.waitForSelector('.hc-picker .hc-option', { timeout: 15000 });
        const values = await page.evaluate(() => [...document.querySelectorAll('.hc-picker .hc-option')].map(o => o.getAttribute('data-value') || ''));
        const chosen = values.find(v => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(wanted.toLowerCase())) ?? values[0];
        await page.locator(`.hc-picker .hc-option[data-value="${chosen}"]`).first().click();
        await page.waitForTimeout(300);
    }
    await page.locator('.hc-root .hc-enter').click();
    const pier = await until(async () => (await readWindow())?.id === 'el-muelle', 120000);
    const pierFirst = await readWindow();
    await shoot('muelle');
    // J13.7: hasta que se presenta, la placa dice lo que es («Posadero»).
    check('D-J60: el prólogo empieza con la escena del muelle, y la primera línea la dice Tomás, con su placa (sin narrador)',
        pier && /^(?:Tomás|Posadero)$/.test(String(pierFirst?.plate)) && pierFirst.lines.length > 0 && pierFirst.lines.every((/** @type {any} */ l) => !/qd-note|ps-narration/.test(l.cls)),
        JSON.stringify(pierFirst));
    const pierPlayed = await playWindows('el prólogo: el muelle', { pick: ['yo-me-encargo'] });
    await auditBox('tras la escena del muelle');

    // La pelea del muelle, y las escenas de Tomás y de Brunilda.
    await entrarEnLaPelea(page);
    await winFight();
    const afterPier = await playWindows('el prólogo: Tomás y Brunilda', { ms: 12000 });
    await auditBox('tras la pelea del muelle');
    if (SHOT) await shoot('tras-el-muelle');
    check('el prólogo se juega en sus ventanas: el muelle, Tomás y Brunilda', pierPlayed.includes('escena:el-muelle')
        && afterPier.some(id => /la-charla/.test(id)) && afterPier.some(id => /el-gremio/.test(id)), JSON.stringify({ pierPlayed, afterPier }));

    // «Saltar la prueba»: la escena del tablón ya no es un párrafo del narrador; la dice Brunilda.
    await dropToasts();
    await carryOn('exploration');
    await until(async () => (await chips()).some(c => /^Saltar la prueba$/.test(c)), 15000);
    await clickChip(/^Saltar la prueba$/);
    await page.waitForSelector('.popup:has-text("¿Saltar la prueba?")', { timeout: 10000 }).catch(() => {});
    await page.locator('.popup-button-ok:visible').first().click({ timeout: 5000 }).catch(() => {});
    await until(async () => (await state()).done.includes('la-prueba'), 20000);
    const boardScene = await until(async () => (await readWindow())?.id === 'el-tablon', 15000);
    const boardFirst = await readWindow();
    await shoot('el-tablon');
    check('D-J60: la escena del tablón la dice Brunilda (antes era un párrafo del narrador)',
        boardScene && boardFirst?.plate === 'Brunilda' && boardFirst.lines.length > 0, JSON.stringify(boardFirst));
    await playWindows('el tablón');
    await auditBox('tras el prólogo');

    // === 2. El gremio: contratar, un encargo y la tienda ===========================================
    await clearPopups();
    await carryOn('exploration');
    await page.evaluate(async () => {
        const { partyMembers } = await import('/scripts/party/state.js');
        if (partyMembers[0]) partyMembers[0].gold = 400;
        (await import('/scripts/party/roster.js')).savePartyState();
    });
    await enterPlace('gremio');
    await placeAct('hub-hire');
    if (await page.locator('.hb-root [data-hireling]').count() === 0) await clickChip(/Contratar mercenarios/);
    await page.waitForSelector('.hb-root [data-hireling]', { timeout: 15000 }).catch(() => {});
    await page.locator('.hb-root [data-hireling]').first().click({ timeout: 5000 }).catch(() => {});
    const hired = await until(async () => (await state()).party >= 2, 10000);
    await clearPopups();
    await carryOn('dialogue');
    const hireBox = await auditBox('contratar a un mercenario');
    await shoot('contratar');
    // Lo que se lee al contratar: lo dice quien se une (`extra.voiced`, con su nombre), no una nota.
    const hireSaid = await page.evaluate(async () => {
        const chat = window.SillyTavern.getContext().chat || [];
        const party = (await import('/scripts/party.js')).getPartyMembersSnapshot();
        const merc = party[party.length - 1];
        const said = [...chat].reverse().find((/** @type {any} */ m) => /\[GREMIO\].*se une al grupo/.test(String(m.mes)));
        return { merc: String(merc?.name || ''), name: String(said?.name || ''), voiced: Boolean(said?.extra?.voiced), shown: String(said?.extra?.display_text || '').slice(0, 160) };
    });
    check('D-J60: al contratar, quien se une lo dice él, con su nombre (no es una nota sin dueño)',
        hired && hireSaid.voiced && hireSaid.name === hireSaid.merc && hireBox.lines.every((/** @type {any} */ l) => l.who && !l.note), JSON.stringify({ hireSaid, hireBox }));
    await enterPlace('gremio');
    await placeAct('hub-errands');
    if (await page.locator('.hb-root .hb-card button').count() === 0) {
        await page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/encargos-gremio'));
    }
    await page.waitForSelector('.hb-root .hb-card button', { timeout: 15000 }).catch(() => {});
    await page.locator('.hb-root .hb-card button').first().click({ timeout: 5000 }).catch(() => {});
    const taken = await until(async () => Boolean(await page.evaluate(() => window.SillyTavern.getContext().chatMetadata?.contractTaken?.locationName)), 10000);
    const errandPlace = String(await page.evaluate(() => window.SillyTavern.getContext().chatMetadata?.contractTaken?.locationName || ''));
    await clearPopups();
    await playWindows('aceptar un encargo', { ms: 1500 });
    await carryOn('dialogue');
    await auditBox('aceptar un encargo');
    check('se acepta un encargo del tablón', taken && Boolean(errandPlace), errandPlace);
    await enterPlace('tienda');
    const shopBuy = (await placeScene()).acts.find(a => a.id.startsWith('shop-buy:') && a.enabled);
    if (shopBuy) await placeAct(shopBuy.id);
    await auditBox('comprar en la tienda');

    // === 3. La posada: comer y dormir (un descanso) ================================================
    await enterPlace('posada');
    await placeAct('inn-meal');
    await auditBox('comer en la posada');
    await placeAct('inn-room');
    await clearPopups();
    await playWindows('la noche en la posada', { ms: 2500 });
    await carryOn('dialogue');
    const restBox = await auditBox('dormir en la posada');
    await shoot('descanso');
    check('D-J60: tras dormir, la caja la dice el posadero (los buenos días) o nadie; lo demás, en el aviso de fuera',
        restBox.lines.every((/** @type {any} */ l) => l.who && !l.note), JSON.stringify(restBox));
    const quoted = greetings.filter(g => /«/.test(g.split(': ').slice(1).join(': ')));
    check('D-J60: en la caja de cada sitio, quien atiende dice su saludo sin que lo cuente nadie («seca un vaso: «…»»)',
        greetings.length >= 3 && quoted.length === 0, JSON.stringify(greetings));

    // === 4. El viaje al sitio del encargo ==========================================================
    await carryOn('exploration');
    await leavePlace();
    if (errandPlace) {
        await page.locator('#game-shell .gs-place', { hasText: errandPlace }).first().click({ timeout: 8000 }).catch(() => {});
        await page.waitForSelector('.popup:visible .tr-pace-normal', { timeout: 8000 }).catch(() => {});
        await page.locator('.popup:visible .tr-pace-normal').click({ timeout: 5000 }).catch(() => {});
        for (let i = 0; i < 20; i++) {
            await page.waitForTimeout(600);
            await clearPopups();
            await playWindows('el viaje', { ms: 400, steps: 30 });
            if ((await state()).place === errandPlace && i > 4) break;
        }
    }
    const travelled = (await state()).place === errandPlace;
    await carryOn('dialogue');
    await auditBox('el viaje');
    await shoot('viaje');
    check('un viaje al sitio del encargo', travelled, JSON.stringify(await state()));
    if ((await state()).fighting) await winFight();
    if ((await state()).board) await leaveBoard();
    await playWindows('tras el viaje', { ms: 1500 });

    // === 5. El tablón: 1387 y su primera escena (con el viaje desde Puerto Alba) ===================
    /**
     * Volver al gremio (si no se está) y abrir una campaña del tablón.
     *
     * @param {string} id
     * @param {string} first La primera escena que se espera.
     */
    const startCampaign = async (id, first) => {
        await clearPopups();
        for (let i = 0; i < 4 && !(await chips()).some(c => /Tablón de campañas/.test(c)); i++) {
            // Desde una campaña, «Volver al gremio» está en la caja: antes de «Continuar», que lleva al tablero.
            if (await clickChip(/Volver al gremio/)) {
                await page.waitForTimeout(1500);
                await clearPopups();
                await page.locator('.popup-button-ok:visible').first().click({ timeout: 3000 }).catch(() => {});
                await until(async () => /Gremio/.test((await state()).world), 60000);
                await playWindows(`volver al gremio (${id})`, { ms: 2000 });
                await carryOn('exploration');
            } else if (errandPlace && (await state()).place !== 'Puerto Alba') {
                // Al gremio a pie, desde el sitio del encargo.
                await carryOn('exploration');
                await leavePlace();
                await page.locator('#game-shell .gs-place', { hasText: 'Puerto Alba' }).first().click({ timeout: 5000 }).catch(() => {});
                await page.locator('.popup:visible .tr-pace-normal').click({ timeout: 5000 }).catch(() => {});
                await page.waitForTimeout(3000);
                await clearPopups();
                await playWindows('de vuelta al gremio', { ms: 1500 });
                await carryOn('exploration');
            } else {
                await carryOn('exploration');
            }
        }
        await clickChip(/Tablón de campañas/);
        await page.waitForSelector(`.hb-root [data-campaign="${id}"]`, { timeout: 15000 }).catch(() => {});
        await page.locator(`.hb-root [data-campaign="${id}"]`).first().click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(1200);
        await page.locator('.popup-button-ok:visible').first().click({ timeout: 3000 }).catch(() => {});
        const opened = await until(async () => (await readWindow())?.id === first, 150000);
        const now = await readWindow();
        await shoot(`${id}-primera-escena`);
        const played = await playWindows(`la primera escena de ${id}`);
        await carryOn('dialogue');
        await auditBox(`tras la primera escena de ${id}`);
        return { opened, now, played };
    };

    const r1387 = await startCampaign('1387', 'el-caliz-ensangrentado');
    check('D-J60: 1387 empieza con la escena del cáliz, y la primera línea la dice Torres, con su placa (sin narrador)',
        r1387.opened && /^(?:Torres|Alguacil)$/.test(String(r1387.now?.plate)) && /Abrid en nombre de Lord Vane/.test(r1387.now.lines.map((/** @type {any} */ l) => l.text).join(' ')),
        JSON.stringify(r1387.now));

    // === 6. Volver al gremio, y Strahd ==============================================================
    const rStrahd = await startCampaign('strahd', 'sangrienta-bienvenida');
    check('D-J60: Strahd empieza con la escena de la taberna, y la primera línea la dice Ismark, con su placa (sin narrador)',
        rStrahd.opened && /Ismark/.test(String(rStrahd.now?.plate)) && rStrahd.now.lines.length > 0, JSON.stringify(rStrahd.now));

    // === Lo visto ===================================================================================
    console.log(`\nVentanas miradas: ${seen.windows} pantallas, ${seen.windowLines} líneas. Caja: ${seen.boxes} veces, ${seen.boxLines} líneas.`);
    console.log(`Quién ha hablado: ${[...seen.speakers].join(', ')}`);
    console.log(`Avisos de fuera de la caja (${seen.asides.length}): ${seen.asides.slice(0, 12).join(' | ')}`);
    for (const bad of broken) console.log(`   ✘ [${bad.why}] ${bad.step} · ${bad.where}${bad.plate ? ` (placa: ${bad.plate})` : ''}: ${bad.line}`);
    check('D-J60: en cada ventana de la novela y en la caja, cada línea la dice alguien (placa o «Tú»), y ninguna nota va dentro',
        broken.length === 0 && seen.windows >= 20 && seen.windowLines >= 25 && seen.boxes >= 5 && seen.boxLines >= 3,
        JSON.stringify({ broken: broken.slice(0, 8), windows: seen.windows, windowLines: seen.windowLines, boxes: seen.boxes, boxLines: seen.boxLines }));
    check('D-J60: lo que no dice nadie (lo que cambia, una tirada, un aviso del juego) sale fuera de la caja', seen.asides.length >= 2, JSON.stringify(seen.asides.slice(0, 8)));
    check('sin errores de página', problems.length === 0, problems.slice(0, 5).join(' | '));
} catch (error) {
    failures++;
    console.log(`FAIL  la vuelta se ha roto\n        -> ${/** @type {any} */ (error)?.stack || error}`);
} finally {
    await browser?.close().catch(() => {});
    server?.kill();
    try {
        rmSync(dataRoot, { recursive: true, force: true });
    } catch { /* se queda en la carpeta temporal */ }
}
console.log(failures === 0 ? '\nTODO BIEN' : `\n${failures} FALLO(S)`);
process.exit(failures === 0 ? 0 : 1);
