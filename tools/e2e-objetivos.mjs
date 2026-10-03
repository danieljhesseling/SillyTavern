#!/usr/bin/env node
/**
 * J12.18 y J12.19 (Daniel, 2026-10-02): los objetivos dentro del menú, quién se lleva el golpe
 * (rojo y azul) y los golpes y las caídas que se notan. En un navegador de verdad contra un
 * servidor propio con un `--dataRoot` temporal:
 *
 *   título → Jugar sin conexión → Nerea, guerrera (espada corta, arco corto, una poción) → la
 *   pelea de la bodega. En su turno:
 *
 *   - Atacar: debajo del arma, a quién llegas, con su vida en una barra, los pies y lo que tienes
 *     de acertar; los que no alcanzas, apagados y diciendo a cuántos pies están;
 *   - pasar el ratón por un objetivo lo enciende en rojo en el tablero y en la iniciativa;
 *   - el arco (otra arma): sus objetivos se abren debajo de su tarjeta, en el mismo menú, con
 *     número; Esc los cierra y el menú sigue abierto;
 *   - Adicional: pasar por «Beber poción» enciende a Nerea en azul;
 *   - Magia (la ficha hecha maga un momento): un conjuro de área enseña su zona y a quién pilla;
 *   - con el dedo: el primer toque en un objetivo lo enciende («Toca otra vez»), el segundo ataca;
 *   - los golpes: uno normal, un crítico («¡Crítico!»), un fallo («¡Falla!») y una muerte (la
 *     ficha tumbada, apagada y con su calavera, «Cae …»); y al redibujarse el tablero, el caído
 *     sigue caído.
 *
 * Saca capturas de cada cosa; mirarlas.
 *
 * Uso:
 *   node tools/e2e-objetivos.mjs                              # puerto 8540, sin ventana
 *   node tools/e2e-objetivos.mjs --port 8540 --captura o.png  # o.menu.png, o.rojo.png, …
 */

/* global window, document, PointerEvent */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { entrarEnLaPelea } from './e2e-entrar-pelea.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8540;
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

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-objetivos-'));
/** @type {any} */
let server = null;
/** @type {any} */
let browser = null;
/** @type {any} */
let page = null;

function startServer() {
    server = spawn(process.execPath, ['server.js', '--browserLaunchEnabled', 'false', '--port', String(PORT), '--dataRoot', dataRoot], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    const child = server;
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('the server did not start in 300s')), 300000);
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
 * @param {any} target
 * @param {string} pick
 * @param {string} wanted
 */
async function pickHeroCard(target, pick, wanted) {
    await target.locator(`.hc-root .hc-card[data-pick="${pick}"] .hc-pick`).click();
    await target.waitForSelector('.hc-picker .hc-option', { timeout: 15000 });
    const plain = (/** @type {string} */ v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const values = await target.evaluate(() => [...document.querySelectorAll('.hc-picker .hc-option')].map(o => o.getAttribute('data-value') || ''));
    const chosen = values.find((/** @type {string} */ v) => plain(v).includes(plain(wanted))) ?? values[0];
    await target.locator(`.hc-picker .hc-option[data-value="${chosen}"]`).first().click();
    await target.waitForSelector('.hc-picker', { state: 'detached', timeout: 15000 }).catch(() => {});
    await target.waitForTimeout(200);
}

try {
    await startServer();
    browser = await chromium.launch({ channel: 'msedge', headless: !HEADED });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    page = await context.newPage();
    /** @type {string[]} */
    const problems = [];
    page.on('pageerror', (/** @type {any} */ e) => problems.push(`PAGEERROR ${e.message}`));
    page.on('console', (/** @type {any} */ m) => {
        if (m.type() === 'error' && !/Failed to load resource.*404/.test(m.text())) problems.push(`ERROR ${m.text().slice(0, 300)}`);
    });
    await context.addInitScript(() => {
        try {
            window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,combat,travel,prisoners,mesa,high,spell,pet,bill,move,attack,roll,talk,journal');
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
            window.localStorage.setItem('sillytavern_gameSucesos', 'off');
            window.localStorage.setItem('sillytavern_gameStoryWindows', 'off');
            // Los golpes, a su ritmo (con el navegador de prueba irían al momento): hay que verlos.
            window.localStorage.setItem('sillytavern_gameCombatPace', 'normal');
        } catch { /* nada */ }
    });

    const until = async (/** @type {() => Promise<boolean>} */ test, ms = 30000) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (await test().catch(() => false)) return true;
            await page.waitForTimeout(250);
        }
        return false;
    };
    const fighting = () => page.evaluate(() => Boolean(window.SillyTavern.getContext().chatMetadata?.combatEncounter?.active));
    const dropToasts = () => page.evaluate(() => document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));
    const fxIdle = () => until(() => page.evaluate(() => document.documentElement.dataset.vfxBusy !== 'true'), 30000);
    const clearDice = async () => {
        for (let i = 0; i < 40; i++) {
            const next = page.locator('.wm-dice-overlay.active .wm-dice-next');
            if (await next.count() === 0) break;
            if (!await next.click({ timeout: 1500 }).then(() => true).catch(() => false)) break;
            await page.waitForTimeout(200);
        }
    };
    const shot = async (/** @type {string} */ name) => {
        if (!SHOT) return;
        const file = `${SHOT.replace(/\.png$/i, '')}.${name}.png`;
        await page.screenshot({ path: file });
        console.log(`      captura: ${file}`);
    };
    const turn = () => page.evaluate(async () => {
        const party = await import('/scripts/party/state.js');
        const cs = await import('/scripts/party/combat-state.js');
        const enc = party.combatEncounter;
        const entry = cs.getCurrentTurnEntry();
        const hero = party.partyMembers[0];
        return {
            mine: Boolean(entry && !entry.isEnemy && String(entry.id) === String(hero?.id)),
            fighting: Boolean(enc.active),
            action: !enc.turnState?.actionUsed,
            heroId: String(hero?.id ?? ''),
            x: Number(hero?.mapPosition?.gridX) || 0,
            y: Number(hero?.mapPosition?.gridY) || 0,
            enemies: enc.enemies.map((/** @type {any} */ e, /** @type {number} */ i) => ({
                id: String(e.instanceId), token: -(i + 1), name: String(e.name), x: Number(e.gridX), y: Number(e.gridY), hp: Number(e.currentHp),
            })),
        };
    });
    const heroTurn = async (ms = 60000) => until(async () => {
        await clearDice();
        await dropToasts();
        const now = await turn();
        return now.mine || !now.fighting;
    }, ms);
    const aim = () => page.evaluate(async () => (await import('/scripts/game-engine/ui/combat-vtt/aim-glow.js')).aimState());
    const menu = () => page.evaluate(() => {
        const box = document.querySelector('#game-shell .gs-grimoire');
        return box ? {
            id: box.getAttribute('data-menu') || '',
            back: Boolean(box.querySelector('.gs-grimoire-back')),
            unfold: box.querySelectorAll('.gs-card-unfold').length,
            cards: [...box.querySelectorAll('.gs-card')].map(c => ({
                pick: c.getAttribute('data-pick') || '',
                name: (c.querySelector('.gs-card-name-text')?.textContent || '').trim(),
                off: /** @type {HTMLButtonElement} */ (c).disabled === true,
                desc: (c.querySelector('.gs-card-desc')?.textContent || '').trim(),
                why: (c.querySelector('.gs-card-why')?.textContent || '').trim(),
                hp: (c.querySelector('.gs-card-hp-text')?.textContent || '').trim(),
                badges: [...c.querySelectorAll('.gs-card-badge')].map(b => (b.textContent || '').trim()),
                key: (c.querySelector('.gs-card-key')?.textContent || '').trim(),
                expanded: c.getAttribute('aria-expanded') || '',
                inUnfold: Boolean(c.closest('.gs-card-unfold')),
                caught: (c.querySelector('.gs-card-caught')?.textContent || '').trim(),
                armed: c.classList.contains('gs-card-armed'),
                confirm: (c.querySelector('.gs-card-confirm')?.textContent || '').trim(),
            })),
        } : null;
    });
    const openMenu = async (/** @type {string} */ id) => {
        await clearDice();
        if ((await menu())?.id === id) return;
        await page.locator(`#game-shell .gs-vtt-bar .gs-btn[data-menu="${id}"]`).click({ timeout: 5000 });
        await page.waitForSelector(`#game-shell .gs-grimoire[data-menu="${id}"]`, { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(250);
    };
    const closeMenu = async () => {
        await page.locator('#game-shell .gs-grimoire .gs-targets-close').click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(200);
    };
    /** Al lado del enemigo más cercano (con el motor, como en e2e-barra-acciones). */
    const stepNextTo = async (/** @type {{x: number, y: number}} */ target) => {
        await page.evaluate(async (/** @type {{x: number, y: number}} */ t) => {
            const { handlePlayerCombatMove } = await import('/scripts/party/player-actions.js');
            const { partyMembers } = await import('/scripts/party/state.js');
            const hero = partyMembers[0];
            const hx = Number(hero.mapPosition?.gridX) || 0;
            const hy = Number(hero.mapPosition?.gridY) || 0;
            const options = [-1, 0, 1].flatMap(dx => [-1, 0, 1].map(dy => ({ x: t.x + dx, y: t.y + dy }))).filter(c => !(c.x === t.x && c.y === t.y))
                .sort((a, b) => Math.max(Math.abs(a.x - hx), Math.abs(a.y - hy)) - Math.max(Math.abs(b.x - hx), Math.abs(b.y - hy)));
            for (const cell of options) {
                if (handlePlayerCombatMove(`${cell.x + 1} ${cell.y + 1}`)) return;
            }
        }, target);
        await page.waitForTimeout(500);
        await fxIdle();
    };
    /** Otra acción en este turno (para ver varios golpes seguidos): el atajo de la prueba. */
    const freshAction = () => page.evaluate(async () => {
        const { combatEncounter } = await import('/scripts/party/state.js');
        if (combatEncounter.turnState) combatEncounter.turnState.actionUsed = false;
        (await import('/scripts/party/board-view.js')).renderLocationMapsPreview();
    });
    /** Los dados, a mano: `value` en [0, 1) para todas las tiradas hasta `rngBack`. */
    const rng = (/** @type {number} */ value) => page.evaluate((/** @type {number} */ v) => {
        const w = /** @type {any} */ (window);
        w.__realRandom ??= Math.random;
        Math.random = () => v;
    }, value);
    const rngBack = () => page.evaluate(() => {
        const w = /** @type {any} */ (window);
        if (w.__realRandom) Math.random = w.__realRandom;
    });

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    const firstRun = page.locator('text=Welcome to SillyTavern!');
    if (await firstRun.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#game-shell', { timeout: 120000 });

    // 1. Nerea, guerrera, al gremio, con espada corta, arco corto y una poción.
    const offline = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Jugar sin conexión' });
    await until(async () => await offline.count() === 1, 60000);
    await offline.click();
    await page.waitForSelector('.hc-root', { timeout: 120000 });
    await page.fill('.hc-root .hc-name', 'Nerea');
    await pickHeroCard(page, 'race', 'Humano');
    await pickHeroCard(page, 'class', 'Guerrero');
    await page.locator('.hc-root .hc-enter').click();
    check('empieza en el gremio, con Nerea', await until(() => page.evaluate(async () => (await import('/scripts/party.js')).getPartyMembersSnapshot().length === 1), 90000));
    await page.evaluate(async () => {
        const { createItem } = await import('/scripts/dnd-system.js');
        const { partyMembers } = await import('/scripts/party/state.js');
        const hero = partyMembers[0];
        const sword = createItem({ name: 'Espada corta', type: 'weapon', category: 'weapon', slot: 'weapon', damageDice: '1d6', damageType: 'cortante', hands: 1, kitForm: 'forma-espada-corta' });
        const bow = createItem({ name: 'Arco corto', type: 'weapon', category: 'weapon', slot: 'weapon', damageDice: '1d6', damageType: 'perforante', hands: 2, rangeFeet: 80, ranged: true, kitForm: 'forma-arco-corto' });
        const potion = createItem({ name: 'Poción de curación', type: 'gear', category: 'magic', subcategory: 'potion', description: 'Recupera 2d4+2 puntos de vida al beberla.' });
        hero.items = [...(hero.items ?? []), sword, bow, potion];
        hero.equippedItems = { ...(hero.equippedItems ?? {}), weapon: sword.id, shield: null };
        hero.strength = 16;
        hero.hp = Math.max(1, (Number(hero.maxHp) || 12) - 4);
        (await import('/scripts/party/roster.js')).savePartyState();
    });

    // 2. La pelea de la bodega.
    await dropToasts();
    await entrarEnLaPelea(page, { ms: 90000 });
    check('la pelea empieza', await until(fighting, 20000));
    check('le toca a Nerea', await heroTurn() && (await turn()).mine);
    await fxIdle();
    await dropToasts();
    let now = await turn();
    console.log(`      enemigos: ${JSON.stringify(now.enemies)}`);
    // Pegada al más cercano; los demás, a ser posible lejos (para ver a quien no se alcanza).
    const nearest = [...now.enemies].filter(e => e.hp > 0).sort((a, b) => Math.max(Math.abs(a.x - now.x), Math.abs(a.y - now.y)) - Math.max(Math.abs(b.x - now.x), Math.abs(b.y - now.y)))[0];
    if (nearest && Math.max(Math.abs(nearest.x - now.x), Math.abs(nearest.y - now.y)) > 1) await stepNextTo(nearest);
    // La bodega trae un ratero solo: aguanta más (para ver varios golpes) y llega otro, lejos (para
    // ver a quien no se alcanza, y para que la pelea siga cuando caiga el primero).
    const farFoe = await page.evaluate(async () => {
        const { combatEncounter, partyMembers } = await import('/scripts/party/state.js');
        const { getActiveBoardContext } = await import('/scripts/party/board.js');
        const { isPassable } = await import('/scripts/game-engine/board/terrain.js');
        const first = combatEncounter.enemies[0];
        if (!first) return null;
        first.currentHp = 40;
        first.maxHp = 40;
        const hero = partyMembers[0];
        const hx = Number(hero.mapPosition?.gridX) || 0;
        const hy = Number(hero.mapPosition?.gridY) || 0;
        const { terrain, gridWidth, gridHeight } = getActiveBoardContext();
        const taken = new Set([`${hx},${hy}`, ...combatEncounter.enemies.map((/** @type {any} */ e) => `${e.gridX},${e.gridY}`)]);
        for (let d = 3; d <= 12; d++) {
            for (let dx = -d; dx <= d; dx++) {
                for (const dy of [-d, d]) {
                    const x = hx + dx;
                    const y = hy + dy;
                    if (x < 0 || y < 0 || x >= gridWidth || y >= gridHeight || taken.has(`${x},${y}`) || !isPassable(terrain, x, y, gridWidth, gridHeight)) continue;
                    const other = { ...JSON.parse(JSON.stringify(first)), instanceId: `einst_lejos_${Date.now()}`, name: 'Vigía del muelle', gridX: x, gridY: y, currentHp: 7, maxHp: 7 };
                    combatEncounter.enemies.push(other);
                    combatEncounter.turnOrder.push({ id: other.instanceId, name: other.name, initiative: 1, isEnemy: true });
                    (await import('/scripts/party/board-view.js')).renderLocationMapsPreview();
                    return { x, y, d };
                }
            }
        }
        return null;
    });
    console.log(`      otro enemigo, lejos: ${JSON.stringify(farFoe)}`);
    await page.waitForTimeout(500);
    now = await turn();

    // 3. Atacar: el arma y, debajo, a quién llegas (y a quién no, apagado con el porqué).
    await openMenu('atacar');
    const attack = await menu();
    await shot('menu');
    const rows = (attack?.cards ?? []).filter(c => /^attack:/.test(c.pick));
    const live = rows.filter(c => !c.off);
    const far = rows.filter(c => c.off);
    check('Atacar: debajo del arma, a quién llegas, con su vida en una barra, los pies y lo que tienes de acertar',
        live.length > 0 && live.every(c => /\d+\/\d+/.test(c.hp) && /\d+ pies/.test(c.desc) && c.badges.some(b => /^\d+ %$/.test(b))), JSON.stringify(rows));
    check('los que no alcanzas salen apagados, diciendo a cuántos pies están',
        far.length > 0 && far.every(c => /Está a \d+ pies; tu espada corta llega a 5\./.test(c.why)), JSON.stringify(far));

    // 4. Pasar el ratón por un objetivo: rojo en el tablero y en la iniciativa.
    const first = live[0];
    const firstId = first?.pick.split(':').pop() ?? '';
    const firstToken = now.enemies.find(e => e.id === firstId)?.token;
    if (first) await page.locator(`#game-shell .gs-grimoire [data-pick="${first.pick}"]`).hover();
    await page.waitForTimeout(250);
    const red = await aim();
    await shot('rojo');
    check('pasar el ratón por un objetivo lo enciende en rojo, en su ficha y en su fila de la iniciativa',
        red.harm.includes(String(firstToken)) && red.rows.includes(firstId) && red.help.length === 0, JSON.stringify({ red, firstId, firstToken }));
    await page.mouse.move(5, 5);
    await page.waitForTimeout(200);
    check('al salir, se apaga', (await aim()).harm.length === 0, JSON.stringify(await aim()));

    // 5. El arco: sus objetivos se abren debajo de su tarjeta, en el mismo menú, con número.
    await page.locator('#game-shell .gs-grimoire [data-pick="swapattack:' + (await page.evaluate(async () => {
        const { partyMembers } = await import('/scripts/party/state.js');
        return String(partyMembers[0].items.find((/** @type {any} */ i) => i.name === 'Arco corto')?.id ?? '');
    })) + '"]').click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(300);
    const unfolded = await menu();
    await shot('arco');
    const bowRows = (unfolded?.cards ?? []).filter(c => c.inUnfold);
    check('el arco abre sus objetivos debajo de su tarjeta, en el mismo menú (sin «Atrás»), con su número',
        Boolean(unfolded && unfolded.id === 'atacar' && unfolded.unfold === 1 && !unfolded.back && bowRows.length > 0 && bowRows.some(c => !c.off && /^\d$/.test(c.key))
            && unfolded.cards.some(c => /^swapattack:/.test(c.pick) && c.expanded === 'true')), JSON.stringify(unfolded));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    const folded = await menu();
    check('Esc cierra la lista abierta y el menú sigue abierto', Boolean(folded && folded.unfold === 0 && folded.id === 'atacar'), JSON.stringify(folded && { unfold: folded.unfold, id: folded.id }));
    await closeMenu();

    // 6. Adicional: «Beber poción» enciende a Nerea en azul.
    await openMenu('adicional');
    const drink = ((await menu())?.cards ?? []).find(c => /^drink:/.test(c.pick));
    if (drink) await page.locator(`#game-shell .gs-grimoire [data-pick="${drink.pick}"]`).hover();
    await page.waitForTimeout(250);
    const blue = await aim();
    await shot('azul');
    check('pasar por «Beber poción» enciende a Nerea en azul', blue.help.includes(now.heroId) && blue.harm.length === 0, JSON.stringify(blue));
    await page.mouse.move(5, 5);
    await closeMenu();

    // 7. Magia (con la ficha hecha maga un momento, con Manos ardientes): un área enseña su zona.
    await page.evaluate(async () => {
        const { partyMembers } = await import('/scripts/party/state.js');
        const hero = partyMembers[0];
        hero.class = 'Mago';
        (await import('/scripts/party/magic.js')).knownAbilitiesOf(hero);
        for (const list of ['spellbook', 'prepared']) {
            hero[list] = [...new Set([...(Array.isArray(hero[list]) ? hero[list] : []), 'conj-manos-ardientes'])];
        }
        (await import('/scripts/party/board-view.js')).renderLocationMapsPreview();
    });
    await page.waitForTimeout(600);
    const areaSpell = await page.evaluate(async () => {
        const { buildCombatBarSnapshot } = await import('/scripts/party/combat-bar.js');
        const s = buildCombatBarSnapshot();
        const spell = s.abilities.find(a => a.area && a.target === 'enemy' && a.enabled && (a.targets || []).some(t => t.enabled !== false && Array.isArray(t.cells) && t.cells.length > 0));
        return spell ? { id: spell.id, name: spell.name, all: s.abilities.map(a => a.name) } : { id: '', name: '', all: s.abilities.map(a => `${a.name}${a.area ? ` (${a.area})` : ''}`) };
    });
    if (areaSpell.id) {
        await openMenu('magia');
        await page.locator(`#game-shell .gs-grimoire [data-pick="ability:${areaSpell.id}"]`).click({ timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(300);
        const spellMenu = await menu();
        const spellRow = (spellMenu?.cards ?? []).find(c => c.inUnfold && !c.off);
        if (spellRow) await page.locator(`#game-shell .gs-grimoire [data-pick="${spellRow.pick}"]`).hover();
        await page.waitForTimeout(250);
        const zone = await aim();
        await shot('area');
        check(`un conjuro de área (${areaSpell.name}): al pasar por su objetivo se ve la zona y a quién pilla`,
            zone.cells > 0 && zone.harm.length > 0 && Boolean(spellRow?.caught), JSON.stringify({ zone, row: spellRow }));
        await page.mouse.move(5, 5);
        await closeMenu();
    } else {
        console.log(`      (sin conjuro de área a mano para la maga: ${areaSpell.all.join(', ')})`);
    }
    await page.evaluate(async () => {
        const { partyMembers } = await import('/scripts/party/state.js');
        partyMembers[0].class = 'Guerrero';
        (await import('/scripts/party/board-view.js')).renderLocationMapsPreview();
    });
    await page.waitForTimeout(500);

    // 8. Con el dedo: el primer toque lo enciende, el segundo ataca. Y el golpe se ve.
    const touch = async (/** @type {string} */ pick) => page.evaluate((/** @type {string} */ p) => {
        const node = /** @type {HTMLElement|null} */ (document.querySelector(`#game-shell .gs-grimoire [data-pick="${p}"]`));
        if (!node) return false;
        node.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }));
        node.click();
        return true;
    }, pick);
    await openMenu('atacar');
    const target = ((await menu())?.cards ?? []).find(c => /^attack:/.test(c.pick) && !c.off);
    const targetId = target?.pick.split(':').pop() ?? '';
    const targetToken = (await turn()).enemies.find(e => e.id === targetId)?.token;
    if (target) await touch(target.pick);
    await page.waitForTimeout(250);
    const armed = ((await menu())?.cards ?? []).find(c => c.pick === target?.pick);
    const armedAim = await aim();
    await shot('toque');
    check('con el dedo, el primer toque enciende el objetivo («Toca otra vez para hacerlo») y no ataca',
        Boolean(armed?.armed && /Toca otra vez/.test(armed.confirm)) && armedAim.harm.includes(String(targetToken)) && (await turn()).action, JSON.stringify({ armed, armedAim }));
    const hpBefore = (await turn()).enemies.find(e => e.id === targetId)?.hp ?? 0;
    await rng(0.6);
    if (target) await touch(target.pick);
    const blowSeen = await page.waitForSelector('#game-shell .wm-token .vfx-impact, #game-shell .wm-token .vfx-float-miss', { timeout: 8000 }).then(() => true).catch(() => false);
    await page.waitForTimeout(120);
    await shot('golpe');
    const blowKind = await page.evaluate(() => document.querySelector('#game-shell .wm-token .vfx-impact')?.className ?? '');
    await rngBack();
    await fxIdle();
    check('el segundo toque ataca, y el golpe se ve: un tajo de espada con el número grande',
        !(await turn()).action && blowSeen && /vfx-impact-cut/.test(blowKind), JSON.stringify({ blowSeen, blowKind, hpBefore }));

    // 9. Un crítico, un fallo y una muerte (con los dados a mano y otra acción cada vez).
    const strike = async (/** @type {number} */ roll, /** @type {string} */ wait, /** @type {string} */ name, setHp = 0) => {
        if (!(await turn()).fighting) return { seen: false, text: '' };
        await freshAction();
        await page.waitForTimeout(400);
        await fxIdle();
        const foe = (await turn()).enemies.find(e => e.id === targetId && e.hp > 0) ?? (await turn()).enemies.find(e => e.hp > 0);
        if (!foe) return { seen: false, text: '' };
        if (setHp > 0) {
            await page.evaluate(async ({ id, hp }) => {
                const { combatEncounter } = await import('/scripts/party/state.js');
                const enemy = combatEncounter.enemies.find((/** @type {any} */ e) => String(e.instanceId) === id);
                if (enemy) enemy.currentHp = hp;
            }, { id: foe.id, hp: setHp });
        }
        const at = (await turn());
        const foeNow = at.enemies.find(e => e.id === foe.id);
        if (foeNow && Math.max(Math.abs(foeNow.x - at.x), Math.abs(foeNow.y - at.y)) > 1) await stepNextTo(foeNow);
        await openMenu('atacar');
        await rng(roll);
        await page.locator(`#game-shell .gs-grimoire [data-pick="attack:${foe.id}"]`).click({ timeout: 4000 }).catch(() => {});
        const found = await page.waitForSelector(wait, { timeout: 9000 }).catch(() => null);
        const seen = Boolean(found);
        // Lo escrito se lee ya: se va a los dos segundos, y la captura tarda.
        const text = found ? String(await found.textContent().catch(() => '')).trim() : '';
        await shot(name);
        await rngBack();
        await fxIdle();
        return { seen, text, foe };
    };
    const crit = await strike(0.999, '#game-shell .vfx-crit-word', 'critico');
    check('un crítico: «¡Crítico!» en oro encima del número', crit.seen && crit.text === '¡Crítico!', JSON.stringify(crit));
    const miss = await strike(0, '#game-shell .vfx-float-miss', 'falla');
    check('un fallo: «¡Falla!», claro', miss.seen && miss.text === '¡Falla!', JSON.stringify(miss));
    const death = await strike(0.9, '#game-shell .vfx-down-caption', 'muerte', 1);
    check('una muerte: la ficha se tumba con su calavera y se lee «Cae …»', death.seen && /^Cae /.test(death.text), JSON.stringify(death));

    // 10. Al redibujarse el tablero, el caído sigue caído (no vuelve a parecer en pie).
    await page.evaluate(async () => (await import('/scripts/party/board-view.js')).renderLocationMapsPreview());
    await page.waitForTimeout(600);
    const downId = death.foe ? (await turn()).enemies.find(e => e.id === death.foe?.id)?.token : null;
    const after = await page.evaluate((/** @type {any} */ id) => {
        const token = document.querySelector(`#game-shell .wm-token[data-token-id="${id}"]`);
        return token ? {
            down: token.classList.contains('wm-token-down'),
            mark: Boolean(token.querySelector('.wm-token-down-mark .fa-skull')),
            meta: (token.querySelector('.wm-token-tooltip-meta')?.textContent || '').trim(),
        } : null;
    }, downId);
    await shot('tras-redibujar');
    check('tras redibujar el tablero, el caído sigue tumbado y con su calavera («Derrotado»)',
        Boolean(after?.down && after.mark && after.meta === 'Derrotado'), JSON.stringify({ downId, after }));

    check('sin errores en la página', problems.length === 0, problems.slice(0, 6).join(' | '));
} catch (error) {
    failures++;
    console.log(`FAIL  la vuelta se ha caído: ${String(/** @type {any} */ (error)?.stack || error).slice(0, 800)}`);
    if (page && SHOT) await page.screenshot({ path: `${SHOT.replace(/\.png$/i, '')}.error.png` }).catch(() => {});
} finally {
    await browser?.close().catch(() => {});
    server?.kill();
    try {
        rmSync(dataRoot, { recursive: true, force: true });
    } catch { /* lo borra el sistema */ }
}
console.log(failures === 0 ? '\nTodo bien.' : `\n${failures} fallo(s).`);
process.exit(failures === 0 ? 0 : 1);
