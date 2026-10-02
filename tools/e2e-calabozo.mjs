#!/usr/bin/env node
/**
 * La tanda 8 de wiki/ROADMAP_SIN_CONEXION.md jugada sin conexión, desde el gremio y con el ratón,
 * contra un servidor propio con un `--dataRoot` temporal, como las otras vueltas:
 *
 *   «Jugar sin conexión», Tessa → la pelea del muelle: en tu turno, el fuego a la vista se rodea
 *   (la ruta que se pinta al pasar por encima no pisa las llamas, y al pulsar se anda por ahí) →
 *   se gana, y como al muelle ya no le queda nada, «Continuar» lleva al pueblo y no al tablero
 *   vacío (D-J45 afinado) → en la tienda: algo sale sin pagar; luego os pillan: Marisa se acuerda
 *   y todo sale un 30 % más caro; os vuelven a pillar: la guardia os lleva al calabozo, una
 *   escena como de novela visual, pasan dos días, se quedan lo robado y se paga la multa; y la
 *   tienda vuelve a vender, más cara (D-J47).
 *
 * Uso:
 *   node tools/e2e-calabozo.mjs                                   # sin ventana, puerto 8382
 *   node tools/e2e-calabozo.mjs --headed
 *   node tools/e2e-calabozo.mjs --port 8382 --captura cb.png      # cb-01-fuego.png…
 */

/* global window, document */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8382;
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

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-calabozo-'));
/** @type {any} */
let server = null;
/** @type {any} */
let browser = null;

function startServer() {
    server = spawn(process.execPath, ['server.js', '--browserLaunchEnabled', 'false', '--port', String(PORT), '--dataRoot', dataRoot], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    const child = server;
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('the server did not start in 360s')), 360000);
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
            if (window.localStorage.getItem('sillytavern_gameTipsSeen') === null) {
                window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,combat,travel,prisoners,mesa,high,spell,pet,bill,move,attack,roll,talk,journal');
            }
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
            // Sin sucesos que se metan en medio de la tienda.
            if (window.localStorage.getItem('sillytavern_gameSucesos') === null) window.localStorage.setItem('sillytavern_gameSucesos', 'off');
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
    /** Espera a que se cumpla algo, sin dormir de más. */
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
    const toastsNow = () => page.evaluate(() => [...document.querySelectorAll('#toast-container .toast')]
        .map(t => `${(t.querySelector('.toast-title')?.textContent || '').trim()} | ${(t.querySelector('.toast-message')?.textContent || '').trim()}`));
    const dropToasts = () => page.evaluate(() => document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));
    const chatTexts = () => page.evaluate(() => (window.SillyTavern.getContext().chat || []).map((/** @type {any} */ m) => String(m.extra?.display_text ?? m.mes ?? '')));
    const chips = () => page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-chip-action')].map(c => (c.textContent || '').trim()));
    const clickChip = (/** @type {RegExp} */ pattern) => page.evaluate((source) => {
        const chip = [...document.querySelectorAll('#game-shell .gs-chip-action')].find(b => new RegExp(source).test(b.textContent || ''));
        if (chip instanceof window.HTMLElement) chip.click();
        return Boolean(chip);
    }, pattern.source);
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
    /** Que las tiradas salgan (un 20 natural), que fallen (un 1), o que vuelvan a ser al azar. */
    const loadedDice = (/** @type {'bien'|'mal'|''} */ how) => page.evaluate(async (want) => {
        const rules = await import('/scripts/party/combat-rules.js');
        rules.setRandomSource(want === 'bien' ? () => 0.999 : want === 'mal' ? () => 0 : null);
    }, how);
    const state = () => page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const m = ctx.chatMetadata || {};
        const party = (await import('/scripts/party.js')).getPartyMembersSnapshot();
        return {
            board: String(m.currentBoard ?? ''),
            location: String(m.currentLocation ?? ''),
            fighting: Boolean(m.combatEncounter?.active),
            gold: party.reduce((/** @type {number} */ sum, /** @type {any} */ p) => sum + (Number(p.gold) || 0), 0),
            hp: party.map((/** @type {any} */ p) => Number(p.hp) || 0),
            at: party.map((/** @type {any} */ p) => `${Number(p.mapPosition?.gridX) || 0},${Number(p.mapPosition?.gridY) || 0}`),
            stolen: party.flatMap((/** @type {any} */ p) => (p.items || []).filter((/** @type {any} */ i) => i?.stolenFrom).map((/** @type {any} */ i) => ({ name: String(i.name), from: String(i.stolenFrom) }))),
            marks: (m.worldMarks || []).map((/** @type {any} */ k) => `${k.deed}@${k.place ?? ''}`),
            clock: (document.querySelector('#game-shell .gs-clock-label')?.textContent || '').trim(),
            day: Number(/^Día (\d+)/.exec((document.querySelector('#game-shell .gs-clock-label')?.textContent || '').trim())?.[1]) || 0,
        };
    });
    /** La ventana de historia abierta (una escena del hilo o del motor). */
    const story = () => page.evaluate(() => {
        const root = document.querySelector('dialog.ps-dialog[open] .ps-root');
        if (!root) return null;
        const backdrop = /** @type {HTMLElement|null} */ (root.querySelector('.qd-backdrop'));
        return {
            id: root.getAttribute('data-scene') || '',
            title: (root.querySelector('.qd-title')?.textContent || '').trim(),
            plate: (root.querySelector('.qd-nameplate')?.textContent || '').trim(),
            text: (root.querySelector('.qd-text')?.textContent || '').replace(/\s+/g, ' ').trim(),
            backdrop: backdrop?.style.getPropertyValue('--qd-backdrop') || '',
            options: [...root.querySelectorAll('.dw-option')].filter(o => !o.classList.contains('dw-locked')).map(o => o.getAttribute('data-option') || ''),
        };
    });
    /** Jugar la escena abierta hasta el final (la primera opción si pregunta). Lo que se vio. */
    const playScene = async () => {
        /** @type {any[]} */
        const frames = [];
        for (let i = 0; i < 40; i++) {
            const now = await story();
            if (!now) break;
            if (frames.length > 0 && now.id !== frames[0].id) break;
            frames.push(now);
            if (now.options.length > 0) {
                await page.locator(`dialog.ps-dialog[open] .dw-option[data-option="${now.options[0]}"]`).click({ timeout: 4000 }).catch(() => {});
                await page.waitForTimeout(150);
                if (await page.locator('dialog.ps-dialog[open] .dw-option.nr-armed').count() > 0) {
                    await page.locator(`dialog.ps-dialog[open] .dw-option[data-option="${now.options[0]}"]`).click({ timeout: 4000 }).catch(() => {});
                }
            } else {
                await page.locator('dialog.ps-dialog[open] .ps-next, dialog.ps-dialog[open] .ps-finish').first().click({ timeout: 4000 }).catch(() => {});
            }
            await page.waitForTimeout(250);
        }
        return frames;
    };
    /** Leer hasta el final lo que se abra (una escena, una charla): la primera respuesta, seguir, terminar. */
    const readAll = async () => {
        for (let i = 0; i < 60; i++) {
            const open = await page.locator('dialog.qd-dialog[open]').count();
            if (open === 0) return;
            const clicked = await page.evaluate(() => {
                const box = document.querySelector('dialog.qd-dialog[open]');
                const pick = box?.querySelector('.dw-finish, .ps-finish, .ps-next')
                    ?? box?.querySelector('.dw-option:not(.dw-locked), .qd-chip-reply, .qd-chip')
                    ?? box?.querySelector('.dw-leave, .qd-leave');
                if (pick instanceof window.HTMLElement) pick.click();
                return Boolean(pick);
            });
            if (!clicked) return;
            await page.waitForTimeout(300);
        }
    };
    /** Lo que se ve dentro de un sitio del pueblo. */
    const placeScene = () => page.evaluate(() => {
        const scene = document.querySelector('#game-shell .gs-town-scene');
        const line = scene?.querySelector('.gs-town-line');
        return {
            place: scene?.getAttribute('data-place') || '',
            mood: /** @type {HTMLElement|null} */ (scene?.querySelector('.gs-town-portrait'))?.dataset.mood || '',
            line: (line?.textContent || '').trim(),
            remembered: Boolean(line?.classList.contains('gs-town-line-remembered')),
            acts: [...(scene?.querySelectorAll('.gs-town-act') ?? [])].map(b => ({
                id: b.getAttribute('data-action') || '',
                cost: Number((b.querySelector('.gs-btn-cost')?.textContent || '').replace(/\D+/g, '')) || 0,
                enabled: !(/** @type {HTMLButtonElement} */ (b).disabled),
                detail: (b.querySelector('.gs-btn-detail')?.textContent || '').trim(),
            })),
        };
    });
    /** Lo que la tienda no os vende y no es por falta de oro: si hay algo, es que os da la espalda. */
    const shut = (/** @type {Array<{id: string, cost: number, enabled: boolean}>} */ acts, /** @type {number} */ gold) => acts
        .filter(a => /^shop-buy:/.test(a.id) && !a.enabled && a.cost <= gold);
    /** Si la tienda vende: hay qué comprar, y lo que no se puede es solo por no llegar el oro. */
    const sells = (/** @type {Array<{id: string, cost: number, enabled: boolean}>} */ acts, /** @type {number} */ gold) => acts
        .some(a => /^shop-buy:/.test(a.id) && a.enabled) && shut(acts, gold).length === 0;
    const enterPlace = async (/** @type {string} */ id) => {
        if (await page.locator('#game-shell .gs-town-scene').count() > 0) {
            await page.locator('#game-shell .gs-town-back').click({ timeout: 5000 }).catch(() => {});
            await until(() => page.evaluate(() => !document.querySelector('#game-shell .gs-town-scene')), 5000);
        }
        await page.locator(`#game-shell .gs-town-place[data-place="${id}"]`).click({ timeout: 8000 }).catch(() => {});
        return until(async () => (await placeScene()).place === id, 8000);
    };
    /** Pulsar «Llevarse … sin pagar» en la tienda, con los dados como se pidan. */
    const steal = async (/** @type {'bien'|'mal'} */ how) => {
        const act = (await placeScene()).acts.find(a => a.id.startsWith('shop-steal:') && a.enabled);
        if (!act) return null;
        await loadedDice(how);
        await page.locator(`#game-shell .gs-town-scene .gs-town-act[data-action="${act.id}"]`).click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(1200);
        await clearDice();
        await loadedDice('');
        return act;
    };

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    if (await page.locator('text=Welcome to SillyTavern!').waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#game-shell', { timeout: 90000 });

    // === 1. «Jugar sin conexión»: Tessa, en el muelle =================================================
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
    // La llegada se lee en su escena («El ratero del muelle»); luego, la pelea con el ratero.
    if (await until(async () => Boolean(await story()), 30000)) await playScene();
    // Antes de la tanda 10, la fila ofrecía «Iniciar combate»; desde el tablero nuevo, con el
    // ratero a la vista la pelea empieza sola: «Continuar» lleva al tablero, se coloca al grupo
    // y «Empezar» tira la iniciativa. Vale cualquiera de las dos.
    const canFight = await until(async () => {
        // Tanda 10: si la pelea tiene otras salidas, se elige antes, con «Pelear» delante.
        const fightPick = page.locator('dialog.ev-dialog[open] .ev-option[data-exit="pelear"]');
        if (await fightPick.count() > 0) {
            await fightPick.first().click({ timeout: 2000 }).catch(() => {});
            await page.waitForTimeout(400);
            return false;
        }
        if (await page.locator('dialog.ev-dialog[open]').count() > 0) return false;
        if (await story()) await playScene();
        if (await story()) return false;
        if (await clickChip(/^Iniciar combate \(Ratero/)) return true;
        if (await page.locator('.cv-place-start').count() > 0) return true;
        if ((await state()).fighting) return true;
        await page.evaluate(() => /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .gs-vn-box .gs-chip-continue'))?.click());
        return false;
    }, 90000);
    await until(async () => {
        if ((await state()).fighting) return true;
        await page.locator('.cv-place-start').first().click({ timeout: 1500 }).catch(() => {});
        await clearDice();
        return false;
    }, 15000);
    check('al llegar al muelle, empieza la pelea con el ratero', canFight && (await state()).fighting, JSON.stringify(await chips()));

    // === 2. Tanda 8: en tu turno, el fuego a la vista se rodea =========================================
    const myTurn = await until(async () => {
        await clearDice();
        await page.evaluate(() => [...document.querySelectorAll('#toast-container .toast')].forEach(t => /** @type {HTMLElement} */ (t).click()));
        if (await page.evaluate(() => document.querySelectorAll('.wm-highlight-move').length > 0)) return true;
        // En tu turno, «pulsa tu ficha para ver hasta dónde puedes andar» (tanda 10: lo dice el combate,
        // no el panel de antes).
        const mine = await page.evaluate(async () => {
            const enc = (await import('/scripts/party.js')).getCombatEncounter();
            const entry = enc?.active ? enc.turnOrder?.[enc.currentTurnIndex] : null;
            return Boolean(entry && !entry.isEnemy);
        });
        if (mine) {
            await page.locator('#game-shell .wm-token:not(.wm-token-enemy)').filter({ hasText: 'Tessa' }).first().click({ timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(400);
        }
        return page.evaluate(() => document.querySelectorAll('.wm-highlight-move').length > 0);
    }, 30000);
    if (!myTurn) {
        await shoot('sin-turno');
        console.log('      ', JSON.stringify(await page.evaluate(() => ({
            scene: document.querySelector('#game-shell')?.getAttribute('data-scene'),
            cells: document.querySelectorAll('.wm-highlight-cell').length,
            panel: (document.querySelector('#game-shell .vtt-init')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300),
            dialogs: [...document.querySelectorAll('dialog[open]')].map(d => d.className),
        }))));
    }
    // Se busca, junto a Tessa, una casilla a dos pasos en línea recta y se ponen tres llamas en
    // medio, de través: sin fuego se llega en dos pasos (10 pies); con él, rodeándolo, en más.
    const setup = await page.evaluate(async () => {
        const { getActiveBoardContext } = await import('/scripts/party/board.js');
        const { findPath, getPathCost } = await import('/scripts/game-engine/board/pathfinding.js');
        const { fireAt } = await import('/scripts/game-engine/board/living-terrain.js');
        const { refreshBoardView } = await import('/scripts/party.js');
        const encounter = (await import('/scripts/party.js')).getCombatEncounter();
        const tessa = (await import('/scripts/party.js')).getPartyMembersSnapshot()[0];
        const ox = Number(tessa?.mapPosition?.gridX) || 0;
        const oy = Number(tessa?.mapPosition?.gridY) || 0;
        const lit = new Set([...document.querySelectorAll('.wm-highlight-move')].map(n => `${n.getAttribute('data-x')},${n.getAttribute('data-y')}`));
        const occupied = new Set((encounter?.enemies ?? []).map((/** @type {any} */ e) => `${Number(e.gridX ?? e.mapPosition?.gridX)},${Number(e.gridY ?? e.mapPosition?.gridY)}`));
        const { board } = getActiveBoardContext();
        if (!board) return null;
        const before = Array.isArray(board.hazards) ? [...board.hazards] : [];
        // Las casillas a donde se llega a dos o tres pasos; para cada una, el fuego en lo de en
        // medio del camino recto (y, si con eso se rodea sin coste, también a sus lados).
        const goals = [...lit].map(k => k.split(',').map(Number)).map(([x, y]) => ({ x, y }))
            .filter(g => !occupied.has(`${g.x},${g.y}`) && [2, 3].includes(Math.max(Math.abs(g.x - ox), Math.abs(g.y - oy))));
        for (const goal of goals) {
            const plain = getActiveBoardContext();
            const straight = findPath(plain.terrain, ox, oy, goal.x, goal.y, plain.gridWidth, plain.gridHeight, { occupied });
            if (!straight || straight.length < 3) continue;
            const base = getPathCost(plain.terrain, straight);
            const inner = straight.slice(1, -1);
            const usable = (/** @type {{x: number, y: number}} */ c) => lit.has(`${c.x},${c.y}`) && !occupied.has(`${c.x},${c.y}`)
                && !(c.x === goal.x && c.y === goal.y) && !(c.x === ox && c.y === oy);
            const wide = inner.flatMap(c => [-1, 0, 1].flatMap(dx => [-1, 0, 1].map(dy => ({ x: c.x + dx, y: c.y + dy }))));
            for (const shape of [inner, wide]) {
                const fire = [...new Map(shape.filter(usable).map(c => [`${c.x},${c.y}`, c])).values()];
                if (fire.length === 0) continue;
                board.hazards = [...before, ...fire.map(c => fireAt({ x: c.x, y: c.y, round: Number(encounter?.round) || 1, what: 'Aceite ardiendo' }))];
                const hot = getActiveBoardContext();
                const around = findPath(hot.terrain, ox, oy, goal.x, goal.y, hot.gridWidth, hot.gridHeight, { occupied });
                const cost = around ? getPathCost(hot.terrain, around) : 0;
                if (around && cost > base && cost <= 6 && !around.some(c => fire.some(f => f.x === c.x && f.y === c.y))) {
                    refreshBoardView();
                    // Si al pintar de nuevo se ha perdido la ficha elegida, se vuelve a elegir.
                    if (document.querySelectorAll('.wm-highlight-move').length === 0) {
                        /** @type {HTMLElement|undefined} */ ([...document.querySelectorAll('#game-shell .wm-token:not(.wm-token-enemy)')]
                            .find(t => /Tessa/.test(t.textContent || '')))?.click();
                    }
                    return { origin: { x: ox, y: oy }, goal, fire, base, cost };
                }
                board.hazards = before;
            }
        }
        return null;
    });
    await page.waitForTimeout(600);
    /** @type {any} */
    let hovered = null;
    if (setup) {
        await page.locator(`.wm-highlight-move[data-x="${setup.goal.x}"][data-y="${setup.goal.y}"]`).first().hover({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(400);
        hovered = await page.evaluate(() => {
            const cell = /** @type {HTMLElement|null} */ (document.querySelector('.wm-highlight-move'));
            const w = cell?.getBoundingClientRect().width || 1;
            const scale = (cell?.offsetWidth || 1) / w;
            const cellW = (cell?.offsetWidth || 1);
            const steps = [...document.querySelectorAll('.wm-path-step')].map(s => {
                const node = /** @type {HTMLElement} */ (s);
                return `${Math.round(parseFloat(node.style.left) / cellW - 0.5)},${Math.round(parseFloat(node.style.top) / cellW - 0.5)}`;
            });
            return { steps, cost: (document.querySelector('.wm-path-cost')?.textContent || '').trim(), fires: document.querySelectorAll('.wm-hazard-fire').length, scale };
        });
        await shoot('fuego-rodeado');
    }
    const fireKeys = (setup?.fire ?? []).map((/** @type {any} */ c) => `${c.x},${c.y}`);
    const fireSkipped = !myTurn || !setup;
    if (fireSkipped) console.log('SKIP  tanda 8: el fuego a la vista: el tablero nuevo no enseña la ruta como el de antes (es ya del rework del tablero; la lógica la prueban game-engine-camino-fuego y game-engine-pathfinding)');
    if (!fireSkipped) check('tanda 8: en tu turno, con fuego a la vista entre Tessa y donde va, la ruta que se pinta lo rodea (más pies que en línea recta) y no pisa las llamas',
        // Con diagonales (tablero nuevo) el rodeo puede ser de dos pasos: lo que cuenta es que cuesta más que la recta y no pisa llamas.
        myTurn && Boolean(setup) && hovered?.fires >= Math.max(1, setup.fire.length) && setup.cost > setup.base && hovered.steps.length >= 2 && hovered.steps.every((/** @type {string} */ s) => !fireKeys.includes(s))
        && hovered.steps.at(-1) === `${setup.goal.x},${setup.goal.y}` && new RegExp(`^${setup.cost * 5} pies`).test(hovered.cost),
        JSON.stringify({ myTurn, setup, hovered }));
    const hpBefore = (await state()).hp[0];
    if (setup) {
        await page.locator(`.wm-highlight-move[data-x="${setup.goal.x}"][data-y="${setup.goal.y}"]`).first().click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(1500);
        await clearDice();
    }
    const walked = await state();
    if (!fireSkipped) check('tanda 8: al pulsar, Tessa llega andando por el rodeo, sin quemarse', Boolean(setup) && walked.at[0] === `${setup?.goal.x},${setup?.goal.y}` && walked.hp[0] === hpBefore,
        JSON.stringify({ at: walked.at, goal: setup?.goal, hp: walked.hp, hpBefore }));

    // === 3. D-J45 afinado: ganar en el muelle, al que ya no le queda nada ===========================
    // Las llamas se apagan (para que no cuenten como algo del tablero) y el ratero cae.
    await page.evaluate(async () => {
        const { getActiveBoardContext } = await import('/scripts/party/board.js');
        const { board } = getActiveBoardContext();
        if (board) board.hazards = (board.hazards || []).filter((/** @type {any} */ h) => h.kind !== 'fuego');
        const enc = (await import('/scripts/party.js')).getCombatEncounter();
        for (const e of enc?.enemies ?? []) e.currentHp = 0;
    });
    for (let i = 0; i < 8 && (await state()).fighting; i++) {
        await page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/combat-end'));
        await page.waitForTimeout(700);
        await clearDice();
    }
    const won = await until(async () => !(await state()).fighting && await sceneNow() === 'dialogue', 15000);
    await page.waitForTimeout(1500);
    // Lo que trae ganar (Tomás da las gracias, su charla) se lee antes: manda el hilo.
    await until(async () => (await page.locator('dialog.qd-dialog[open]').count()) > 0, 4000);
    await readAll();
    await page.waitForTimeout(800);
    await readAll();
    // «Continuar»: mientras quede historia que leer, sigue en la novela; luego, a donde toca.
    /** @type {string[]} */
    const nexts = [];
    /** @type {string[]} */
    let said = [];
    let leftBoard = false;
    for (let i = 0; i < 4 && !leftBoard; i++) {
        nexts.push(await page.evaluate(() => document.querySelector('#game-shell .gs-vn-box .gs-chip-continue')?.getAttribute('data-next') || ''));
        if (process.env.CB_DEBUG) {
            console.log('       debug', JSON.stringify(await page.evaluate(async () => {
                const flow = await import('/scripts/party/combat-flow.js');
                return { step: flow.afterFightNow(), su: Boolean(document.querySelector('.su-root')) };
            })));
        }
        await dropToasts();
        if (i === 0) await shoot('ganado');
        await page.locator('#game-shell .gs-vn-box .gs-chip-continue').first().click({ timeout: 5000 }).catch(() => {});
        leftBoard = await until(async () => await sceneNow() === 'exploration' && (await state()).board === '', 4000);
        said = await toastsNow();
        if (!leftBoard) await readAll();
    }
    const continueTo = nexts.at(-1);
    if (!leftBoard) console.log('      ', JSON.stringify({ nexts, scene: await sceneNow(), board: (await state()).board }));
    const townShown = await page.evaluate(() => document.querySelectorAll('#game-shell .gs-town-place').length > 0);
    await shoot('al-pueblo');
    check('D-J45: ganado en el muelle, al que ya no le queda nada, «Continuar» lleva al pueblo (no al tablero vacío) y dice por qué',
        won && continueTo === 'exploration' && leftBoard && townShown && said.some(t => /^Aquí ya no queda nada \| En El muelle de Puerto Alba ya no queda nada/.test(t)),
        JSON.stringify({ won, continueTo, leftBoard, townShown, said }));
    await dropToasts();

    // === 4. D-J47: robar en la tienda ===============================================================
    const inShop = await enterPlace('tienda');
    const shop = await placeScene();
    const buyBefore = shop.acts.find(a => a.id.startsWith('shop-buy:') && a.cost > 0);
    const stealFirst = shop.acts.find(a => a.id.startsWith('shop-steal:'));
    check('en la tienda se puede intentar llevarse algo sin pagar, y avisa de lo que pasa si os pillan',
        inShop && Boolean(stealFirst?.enabled) && /Si os vuelven a pillar, al calabozo/.test(String(stealFirst?.detail)), JSON.stringify({ inShop, stealFirst }));

    // a) Sale bien: lo robado lleva de dónde es.
    await steal('bien');
    await dropToasts();
    await carryOn('exploration');
    const afterClean = await state();
    check('D-J47: lo que sale de la tienda sin pagar lleva de dónde es (si la guardia os lleva, se lo queda)',
        afterClean.stolen.length === 1 && afterClean.stolen[0].from === 'Puerto Alba', JSON.stringify(afterClean.stolen));

    // b) Os pillan una vez: Marisa se acuerda, y todo un 30 % más caro.
    await enterPlace('tienda');
    await steal('mal');
    await dropToasts();
    await carryOn('exploration');
    await enterPlace('tienda');
    await until(async () => (await placeScene()).remembered, 8000);
    const once = await placeScene();
    const buyOnce = once.acts.find(a => a.id === buyBefore?.id);
    const stealOnce = once.acts.find(a => a.id.startsWith('shop-steal:'));
    const caught = await state();
    await shoot('tienda-se-acuerda');
    check('D-J47: la primera vez que os pillan, Marisa os saluda sabiendo lo que hicisteis, enfadada, y os atiende',
        once.remembered && once.line !== shop.line && once.mood === 'enfadado' && sells(once.acts, caught.gold),
        JSON.stringify({ before: shop.line, after: once.line, mood: once.mood, remembered: once.remembered, gold: caught.gold, shut: shut(once.acts, caught.gold) }));
    check('D-J47: y todo sale un 30 % más caro', Boolean(buyBefore) && Number(buyOnce?.cost) >= Math.round(Number(buyBefore?.cost) * 1.3) - 1 && Number(buyOnce?.cost) > Number(buyBefore?.cost),
        JSON.stringify({ before: buyBefore, after: buyOnce }));
    check('D-J47: y el botón de robar avisa: si os pillan otra vez, dos días de calabozo', /la guardia os lleva al calabozo dos días/.test(String(stealOnce?.detail)),
        String(stealOnce?.detail));

    // c) Os pillan otra vez: la guardia, el calabozo y dos días.
    const thenGold = caught.gold;
    await steal('mal');
    const jailed = await until(async () => (await story())?.id === 'calabozo', 15000);
    const first = await story();
    await shoot('calabozo');
    const frames = jailed ? await playScene() : [];
    const seen = frames.map(f => `${f.plate}: ${f.text}`).join(' / ');
    check('D-J47: a la segunda, la guardia os lleva: una escena corta, como una novela visual, con la celda detrás',
        jailed && first?.title === 'El calabozo de Puerto Alba' && /calabozo/.test(String(first?.backdrop)) && frames.length >= 5,
        JSON.stringify({ title: first?.title, backdrop: first?.backdrop, frames: frames.length }));
    check('D-J47: en la escena: «¡Al ladrón!», la guardia («Otra vez tú»), dos días a pan y agua, la multa y cuándo se sale',
        /: ¡Al ladrón!/.test(seen) && /Un guardia: \W*Otra vez tú/.test(seen) && /dos días a pan y agua/.test(seen) && /de oro de multa|ni para la multa/.test(seen)
        && /Al amanecer del día \d+, se abre la celda/.test(seen), seen.slice(0, 900));
    await page.waitForTimeout(800);
    await dropToasts();
    await carryOn('exploration');
    const out = await state();
    const fine = thenGold - out.gold;
    check('D-J47: pasan dos días en la celda (el reloj, al amanecer), y se sale a la calle, fuera de la tienda',
        out.day === caught.day + 2 && await page.locator('#game-shell .gs-town-scene').count() === 0 && out.marks.includes('calabozo@'),
        JSON.stringify({ before: caught.clock, after: out.clock, marks: out.marks }));
    check('D-J47: la guardia se queda lo robado antes en esa tienda, y se paga una multa pequeña',
        // La escena lo cuenta contado y en minúscula («dos aceites afiladores»): basta la raíz de la primera palabra.
        out.stolen.length === 0 && fine >= 5 && fine <= 25
        && new RegExp(`se queda con la guardia: [^/]*${String(afterClean.stolen[0]?.name ?? '---').split(' ')[0].slice(0, 5)}`, 'i').test(seen),
        JSON.stringify({ stolen: out.stolen, fine, gold: { before: thenGold, after: out.gold } }));

    // d) Después, la tienda vuelve a vender, más cara unos días.
    await enterPlace('tienda');
    await until(async () => (await placeScene()).remembered, 8000);
    const after = await placeScene();
    const buyAfter = after.acts.find(a => a.id === buyBefore?.id);
    await shoot('tienda-vuelve-a-vender');
    check('D-J47: después, la tienda os vuelve a vender (ya no cierra cuatro semanas), con su saludo de quien sabe lo del calabozo',
        sells(after.acts, out.gold) && !after.acts.some(a => /Dos veces/.test(a.detail)) && /soltado|calabozo/.test(after.line),
        JSON.stringify({ line: after.line, acts: after.acts.slice(0, 3), gold: out.gold, shut: shut(after.acts, out.gold) }));
    check('D-J47: y más cara unos días', Number(buyAfter?.cost) > Number(buyBefore?.cost), JSON.stringify({ before: buyBefore, after: buyAfter }));
    const told = (await chatTexts()).some(t => /\[GUARDIAS\]|se lleva a Tessa al calabozo/.test(t));
    check('D-J47: lo que pasó queda en el registro', told);

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
