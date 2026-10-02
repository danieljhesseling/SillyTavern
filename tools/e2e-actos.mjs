#!/usr/bin/env node
/**
 * J10.7 de ROADMAP_SIN_CONEXION: una campaña hecha con la semilla tiene tres actos que se juegan.
 * Contra un servidor propio con un `--dataRoot` temporal, como `e2e-campana-gem.mjs`:
 *
 *   título → Jugar sin conexión → tu personaje → saltar la prueba → el tablón → «La costa que no
 *   duerme» (sin paquete: su historia la escribe el juego) → empezarla →
 *   acto 1: el gancho, en su ventana → hablar con quien lo vio → ir a dos sitios de pista y
 *   examinar en cada uno lo que la historia esconde allí (la tirada sale bien a propósito) →
 *   se descubre la guarida →
 *   acto 2: ir a la guarida → entrar en su tablero y ganar → la escena de la encrucijada, con su
 *   decisión: llevar lo encontrado al bando A → se descubre el refugio →
 *   acto 3: ir al refugio → su tablero, con el villano → ganar → el final del bando A, en su
 *   ventana → volver al gremio: en el tablón, «Terminada».
 *
 * Lo que se espera (quién lo vio, dónde están las pistas, cómo se llama el villano) se calcula aquí
 * con los mismos módulos y la misma semilla: la campaña tiene que ser esa, y no otra.
 *
 * Los atajos de prueba: los consejos vistos, los sucesos de viaje apagados, las tiradas de las
 * pistas forzadas a salir bien, el grupo curado al llegar a cada sitio (`restPartyForSimulation`:
 * quien juega compraría comida y descansaría; aquí se va derecho) y las peleas ganadas poniendo a
 * los enemigos a cero (la pelea en sí la mira `e2e-combate.mjs`).
 *
 * Uso:
 *   node tools/e2e-actos.mjs                 # sin ventana
 *   node tools/e2e-actos.mjs --headed        # mirándolo
 *   node tools/e2e-actos.mjs --port 8395 --captura C:/tmp/actos
 */

/* global window, document, HTMLElement */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { entrarEnLaPelea } from './e2e-entrar-pelea.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8395;
const BASE = `http://127.0.0.1:${PORT}`;
const HEADED = process.argv.includes('--headed');
const SHOT = argAfter('--captura');

const require = createRequire(join(ROOT, 'tests/package.json'));
const { chromium } = require('@playwright/test');

// ------------------------------------------------------------ lo que se espera
const engine = (/** @type {string} */ path) => import(pathToFileURL(join(ROOT, 'public/scripts/game-engine', path)).href);
const { createCompendium } = await engine('compendio/compendio.js');
const { seedCampaignPack } = await engine('campaign/seed-pack.js');
const { ACT_IDS, ACT_ENDINGS } = await engine('campaign/act-grammar.js');
const { readPlot } = await engine('campaign/plot.js');
const battery = (/** @type {string} */ name) => JSON.parse(readFileSync(join(ROOT, 'public/compendio', `${name}.json`), 'utf8')).rows;
const COMPENDIUM = createCompendium(Object.fromEntries(['actos', 'nombres', 'mundo', 'facciones', 'bestiario', 'frases'].map(d => [d, battery(d)])));
const WORLDS = JSON.parse(readFileSync(join(ROOT, 'public/mundos/mundos.json'), 'utf8')).worlds;
const ROW = WORLDS.find((/** @type {any} */ w) => w.id === 'costa');
const { pack: PACK } = seedCampaignPack({ row: ROW, compendium: COMPENDIUM });
const PLOT = /** @type {any} */ (readPlot(PACK.plot));
const M = (/** @type {string} */ id) => PLOT.milestones.find((/** @type {any} */ m) => m.id === id);
const START = PACK.locations[0].name;
const WITNESS = M(ACT_IDS.witness).asks.npc;
const CLUES = M(ACT_IDS.clues).asks.clues;
const LAIR = M(ACT_IDS.lair).asks.place;
const LAIR_BOARD = M(ACT_IDS.strike).asks.board;
const FIGHT = M(ACT_IDS.climaxA).asks.options.find((/** @type {any} */ o) => o.kind === 'defeat');
const REFUGE = FIGHT.place;
const VILLAIN = FIGHT.enemy;
const REFUGE_BOARD = PACK.boards.find((/** @type {any} */ b) => b.locationName === REFUGE)?.name ?? REFUGE;
const ENDING = PLOT.endings[ACT_ENDINGS.a];
/** Cómo se le llama a alguien antes de que se presente (J13.7): por su oficio. */
const roleOf = (/** @type {string} */ name) => String(PACK.npcs.find((/** @type {any} */ n) => n.name === name)?.trade ?? name);
const sightAt = (/** @type {string} */ place, /** @type {string} */ skill) => PACK.locations.find((/** @type {any} */ l) => l.name === place)
    ?.sights?.find((/** @type {any} */ s) => s.skill === skill);
console.log(JSON.stringify({ START, WITNESS, CLUES, LAIR, LAIR_BOARD, REFUGE, REFUGE_BOARD, VILLAIN, ending: ENDING.title }, null, 1));

/**
 * Los caminos, en los dos sentidos, para ir de un sitio a otro de vecino en vecino.
 *
 * @param {string} from
 * @param {string} to
 * @returns {string[]} Los sitios por los que se pasa, sin el de salida.
 */
function pathTo(from, to) {
    /** @type {Map<string, Set<string>>} */
    const links = new Map();
    const link = (/** @type {string} */ a, /** @type {string} */ b) => {
        links.set(a, new Set([...(links.get(a) ?? []), b]));
        links.set(b, new Set([...(links.get(b) ?? []), a]));
    };
    for (const place of PACK.locations) for (const route of place.routes ?? []) link(place.name, route.to);
    /** @type {Map<string, string>} */
    const before = new Map([[from, '']]);
    const queue = [from];
    while (queue.length > 0) {
        const at = /** @type {string} */ (queue.shift());
        if (at === to) break;
        for (const next of links.get(at) ?? []) {
            if (before.has(next)) continue;
            before.set(next, at);
            queue.push(next);
        }
    }
    /** @type {string[]} */
    const path = [];
    for (let at = to; at && at !== from; at = /** @type {string} */ (before.get(at))) path.unshift(at);
    return before.has(to) ? path : [to];
}

let failures = 0;
const check = (/** @type {string} */ name, /** @type {boolean} */ ok, detail = '') => {
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        -> ${detail}` : ''}`);
};

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-actos-'));
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
        // Con muchos servidores y pruebas a la vez, arrancar tarda: hasta diez minutos.
        const timer = setTimeout(() => reject(new Error('the server did not start in 600s')), 600000);
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
 * Elegir en una tarjeta de «Crear personaje» la primera opción, o la que se parece a lo pedido.
 *
 * @param {any} target
 * @param {string} pick class | race | background
 * @param {string} wanted
 */
async function pickHeroCard(target, pick, wanted) {
    await target.locator(`.hc-root .hc-card[data-pick="${pick}"] .hc-pick`).click();
    await target.waitForSelector('.hc-picker .hc-option', { timeout: 15000 });
    const values = await target.evaluate(() => [...document.querySelectorAll('.hc-picker .hc-option')].map(o => o.getAttribute('data-value') || ''));
    const chosen = values.find(v => v.toLowerCase().includes(wanted.toLowerCase())) ?? values[0];
    await target.locator(`.hc-picker .hc-option[data-value="${chosen}"]`).first().click();
    await target.waitForSelector('.hc-picker', { state: 'detached', timeout: 15000 }).catch(() => {});
    await target.waitForTimeout(200);
}

/** @param {string} value */
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
        } catch { /* nada */ }
    });

    const state = () => page.evaluate(() => {
        const meta = window.SillyTavern.getContext().chatMetadata ?? {};
        const plot = meta.plotState ?? {};
        return {
            world: String(meta.world_info ?? ''),
            location: String(meta.currentLocation ?? ''),
            board: String(meta.currentBoard ?? ''),
            fighting: Boolean(meta.combatEncounter?.active),
            ending: String(meta.plotEnding ?? ''),
            open: Array.isArray(plot.open) ? plot.open : [],
            done: Array.isArray(plot.done) ? plot.done : [],
            closed: Array.isArray(plot.closed) ? plot.closed : [],
            clues: plot.clues?.['actos-pistas']?.length ?? 0,
            day: Number(meta.calendar?.day) || 0,
        };
    });
    const chips = () => page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-chip-action')].map(c => (c.textContent || '').trim()));
    const pressChip = (/** @type {RegExp} */ pattern) => page.evaluate(({ source, flags }) => {
        const chip = [...document.querySelectorAll('#game-shell .gs-chip-action')].find(b => new RegExp(source, flags).test((b.textContent || '').trim()));
        if (chip instanceof HTMLElement) chip.click();
        return Boolean(chip);
    }, { source: pattern.source, flags: pattern.flags });
    /** Pulsar una ficha; si no cabe en la fila, en la ventana de «+N más», que las tiene todas. */
    const clickChip = async (/** @type {RegExp} */ pattern) => {
        if (await pressChip(pattern)) return true;
        if (!(await pressChip(/^\+\d+ más$/))) return false;
        await page.waitForSelector('.hp-root .hp-item', { timeout: 5000 }).catch(() => {});
        const found = await page.evaluate(({ source, flags }) => {
            const item = [...document.querySelectorAll('.hp-root .hp-item')].find(b => new RegExp(source, flags).test((b.textContent || '').trim()));
            if (item instanceof HTMLElement) item.click();
            return Boolean(item);
        }, { source: pattern.source, flags: pattern.flags });
        if (!found) await page.locator('.popup:has(.hp-root) .popup-button-ok').click({ timeout: 3000 }).catch(() => {});
        return found;
    };
    /** Todas las fichas, también las que no caben en la fila. */
    const allChips = async () => {
        const shown = await chips();
        if (!shown.some(c => /^\+\d+ más$/.test(c))) return shown;
        await pressChip(/^\+\d+ más$/);
        await page.waitForSelector('.hp-root .hp-item', { timeout: 5000 }).catch(() => {});
        const more = await page.evaluate(() => [...document.querySelectorAll('.hp-root .hp-item')].map(b => (b.textContent || '').trim()));
        await page.locator('.popup:has(.hp-root) .popup-button-ok').click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(300);
        return [...shown, ...more];
    };
    const until = async (/** @type {() => Promise<boolean>} */ test, ms = 30000) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (await test().catch(() => false)) return true;
            await page.waitForTimeout(400);
        }
        return false;
    };
    const dropToasts = () => page.evaluate(() => document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));
    const novelBox = () => page.evaluate(() => ({
        text: (document.querySelector('#game-shell .gs-vn-text')?.textContent || '').replace(/\s+/g, ' ').trim(),
        focus: (document.querySelector('#game-shell .gs-focus')?.textContent || '').replace(/\s+/g, ' ').trim(),
    }));
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
    /** J11.1: lo que no tiene vuelta atrás pregunta antes; aquí se acepta. */
    const acceptWeighty = async () => {
        const warned = await page.locator('.popup:has-text("vuelta atrás") .popup-button-ok').click({ timeout: 800 }).then(() => true).catch(() => false);
        if (warned) await page.waitForTimeout(600);
        return warned;
    };
    const dump = async (/** @type {string} */ label) => {
        console.log(`--- ${label}`);
        console.log(JSON.stringify({ state: await state(), chips: await chips(), box: await novelBox() }, null, 1).slice(0, 2500));
    };

    /** La escena del hilo abierta en su ventana, si hay una. */
    const story = () => page.evaluate(() => {
        const root = document.querySelector('dialog.ps-dialog[open] .ps-root');
        if (!root) return null;
        return {
            id: root.getAttribute('data-scene') || '',
            plate: (root.querySelector('.qd-nameplate')?.textContent || '').trim(),
            text: (root.querySelector('.qd-text')?.textContent || '').replace(/\s+/g, ' ').trim(),
            options: [...root.querySelectorAll('.dw-option')].map(o => o.getAttribute('data-option') || ''),
        };
    });
    /** @type {Array<{plate: string, text: string}>} Lo que se ha leído en las escenas del hilo, en orden. */
    const read = [];
    /** @type {string[]} Las decisiones tomadas en las escenas, por su id. */
    const chosen = [];
    /** Leer las escenas que se abran, hasta que no quede ninguna. La primera opción, siempre. */
    const playScenes = async () => {
        for (let i = 0; i < 80; i++) {
            const now = await story();
            if (!now) {
                await page.waitForTimeout(300);
                if (await acceptWeighty()) continue;
                if (!(await story())) return;
                continue;
            }
            if (now.text && read[read.length - 1]?.text !== now.text) read.push({ plate: now.plate, text: now.text });
            if (now.options.length > 0) {
                chosen.push(now.options[0]);
                if (SHOT && now.options.includes('pensar')) await page.screenshot({ path: `${SHOT}.encrucijada.png` });
                await page.locator(`dialog.ps-dialog[open] .dw-option[data-option="${now.options[0]}"]`).click({ timeout: 4000 }).catch(() => {});
            } else {
                await page.locator('dialog.ps-dialog[open] .ps-next, dialog.ps-dialog[open] .ps-finish').first().click({ timeout: 4000 }).catch(() => {});
            }
            await page.waitForTimeout(250);
            await acceptWeighty();
        }
    };
    /** Seguir la novela hasta que se vea lo que se puede hacer. */
    const settle = async () => {
        await playScenes();
        await clearDice();
        for (let i = 0; i < 6; i++) {
            const more = await page.evaluate(() => {
                const next = /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .gs-vn-box .gs-chip-continue'));
                if (next && next.offsetParent !== null) { next.click(); return true; }
                return false;
            });
            if (!more) break;
            await page.waitForTimeout(400);
            await playScenes();
        }
        await page.locator('.popup-button-ok:visible').first().click({ timeout: 500 }).catch(() => {});
        await dropToasts();
    };
    /** Ir de vecino en vecino hasta un sitio, como quien juega. */
    const travelTo = async (/** @type {string} */ place) => {
        const from = (await state()).location;
        const hops = from === place ? [] : pathTo(from, place);
        for (const hop of hops) {
            await settle();
            const go = await until(() => clickChip(new RegExp(`^Ir a ${escape(hop)}$`)), 15000);
            await page.waitForTimeout(800);
            await page.locator('.popup-button-ok:visible').first().click({ timeout: 2000 }).catch(() => {});
            const there = await until(async () => (await state()).location === hop, 40000);
            await settle();
            // El atajo: el grupo llega descansado y comido, como si hubiera parado en el camino.
            await page.evaluate(async () => (await import('/scripts/party.js')).restPartyForSimulation());
            if (!go || !there) {
                await dump(`no se pudo ir a ${hop}`);
                return false;
            }
        }
        return (await state()).location === place;
    };
    /** Gana la pelea que haya: todos a cero y turnos hasta que se acaba. */
    const winFight = async () => {
        await until(async () => (await state()).fighting, 10000);
        // Con la máquina cargada, los turnos de ellos tardan: se insiste (y quien entre tarde en la
        // pelea también cae a cero).
        for (let i = 0; i < 30 && (await state()).fighting; i++) {
            await clearDice();
            await page.evaluate(async () => {
                const enc = (await import('/scripts/party.js')).getCombatEncounter();
                for (const e of enc?.enemies ?? []) e.currentHp = 0;
            });
            await page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/combat-end'));
            await page.waitForTimeout(1000);
        }
        await clearDice();
    };
    /** Entrar en un tablero de aquí y ganar su pelea. */
    const enterAndWin = async (/** @type {string} */ board) => {
        const enter = await until(() => clickChip(new RegExp(`^Entrar en ${escape(board)}`)), 10000);
        await page.waitForTimeout(1200);
        const warned = await acceptWeighty();
        await settle();
        // Tanda 10: al ver el tablero con enemigos, la pelea se abre sola (con la decisión de
        // pelear o no, y la barra de colocar): se hace lo que haría quien juega hasta que hay pelea.
        // Si los de dentro os ven al entrar, la pelea se abre sola; si están tras una puerta, se abre.
        let fight = await entrarEnLaPelea(page, { ms: 25000 }) && await until(async () => (await state()).fighting, 15000);
        if (!fight) fight = (await state()).fighting;
        /** @type {any[]} Lo que se ve al abrir cada puerta, para el informe si no sale la pelea. */
        const doorLog = [];
        // Los de dentro están tras una puerta: se abren en el tablero una a una, como quien juega
        // (ya no hay ficha de «Abrir la puerta»). La que da a su sala la despierta: emboscada.
        for (let i = 0; i < 12 && !fight; i++) {
            await page.locator('.popup-button-ok:visible').first().click({ timeout: 500 }).catch(() => {});
            await clearDice();
            const look = await page.evaluate(() => {
                const shell = document.querySelector('#game-shell');
                const door = document.querySelector('#game-shell .wm-terrain-door-actionable[title="Abrir la puerta"]');
                if (door instanceof HTMLElement) door.click();
                return {
                    scene: shell?.getAttribute('data-scene') || '',
                    opened: door instanceof HTMLElement,
                    doors: document.querySelectorAll('#game-shell .wm-terrain-door-actionable').length,
                    dialogs: [...document.querySelectorAll('dialog[open]')].map(d => d.className),
                    popups: [...document.querySelectorAll('.popup[open]')].map(p => (p.textContent || '').trim().slice(0, 60)),
                };
            });
            doorLog.push(look);
            if (await entrarEnLaPelea(page, { ms: 8000 })) fight = await until(async () => (await state()).fighting, 10000);
            if (!look.opened && !fight && i > 2) break;
        }
        // Abiertas en otro orden que el de quien anda la mazmorra, una puerta puede haber revelado
        // la sala de este lado y no la de ellos: se cierra y se vuelve a abrir, y entonces da a
        // la suya (`getRoomBehindDoor` elige la que aún no se ha visto).
        for (let i = 0; i < 12 && !fight; i++) {
            const again = await page.evaluate(async (index) => {
                const doors = () => [...document.querySelectorAll('#game-shell .wm-terrain-door-actionable')];
                const door = doors()[index];
                if (!(door instanceof HTMLElement)) return 'no hay más';
                const where = `${door.style.left}|${door.style.top}`;
                const title = door.getAttribute('title') || '';
                if (title !== 'Cerrar la puerta') return title;
                door.click();
                await new Promise(resolve => setTimeout(resolve, 400));
                const same = doors().find(d => d instanceof HTMLElement && `${d.style.left}|${d.style.top}` === where);
                if (same instanceof HTMLElement) same.click();
                return 'cerrada y abierta';
            }, i);
            doorLog.push({ again });
            if (again === 'no hay más') break;
            await clearDice();
            if (await entrarEnLaPelea(page, { ms: 6000 })) fight = await until(async () => (await state()).fighting, 10000);
        }
        if (SHOT && !fight) await page.screenshot({ path: `${SHOT}.sin-pelea.png` });
        const enemies = await page.evaluate(async () => ((await import('/scripts/party.js')).getCombatEncounter()?.enemies ?? []).map((/** @type {any} */ e) => String(e.name)));
        await winFight();
        await page.waitForTimeout(1200);
        await settle();
        return { enter, warned, fight, enemies, won: fight && !(await state()).fighting, doors: fight ? doorLog.length : doorLog };
    };

    // Con la máquina cargada, la primera página tarda en llegar.
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 300000 });
    const firstRun = page.locator('text=Welcome to SillyTavern!');
    if (await firstRun.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#game-shell', { timeout: 300000 });

    // ------------------------------------------------------------ al gremio
    const offline = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Jugar sin conexión' });
    await until(async () => await offline.count() === 1, 30000);
    await offline.click();
    await page.waitForSelector('.hc-root', { timeout: 120000 });
    await page.fill('.hc-root .hc-name', 'Iria');
    await pickHeroCard(page, 'race', 'Humano');
    await pickHeroCard(page, 'class', 'Guerrero');
    await page.locator('.hc-root .hc-enter').click();
    const inHub = await until(async () => /Gremio/.test((await state()).world), 60000);
    await page.waitForTimeout(1500);
    await settle();
    // Tanda 10: en el tablero del muelle ya no se ofrece saltar la prueba (la pelea con el ratero
    // empieza sola). El prólogo no es lo que se mira aquí: si la pelea empezó, se gana, y la prueba
    // se salta con la ficha si sale o con su comando si no.
    // Desde el 02-10, el ratero sale antes en su ventana de decisión: se elige pelear, como quien juega.
    if (await entrarEnLaPelea(page, { ms: 15000 }) && await until(async () => (await state()).fighting, 6000)) {
        await winFight();
        await settle();
    }
    if (!(await until(() => clickChip(/^Saltar la prueba$/), 4000))) {
        await page.evaluate(() => { void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/saltar-prueba'); });
    }
    await page.waitForSelector('.popup:has-text("¿Saltar la prueba?")', { timeout: 10000 }).catch(() => {});
    await page.locator('.popup-button-ok:visible').first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await settle();
    // Si la ventana del ratero sigue abierta tras saltar la prueba, se cierra (no es de este frente).
    await page.evaluate(() => document.querySelectorAll('dialog.ev-avoid[open]').forEach(d => /** @type {any} */ (d).close()));
    const skipped = await until(async () => (await chips()).some(c => /Tablón de campañas/.test(c)), 20000);
    check('en el gremio con Iria, y la prueba saltada', inHub && skipped, JSON.stringify({ state: await state(), chips: await chips() }));
    read.length = 0;

    // ------------------------------------------------------------ el tablón
    await dropToasts();
    await clickChip(/Tablón de campañas/);
    await page.waitForSelector('.hb-root [data-campaign="costa"]', { timeout: 15000 }).catch(() => {});
    const board = await page.evaluate(() => [...document.querySelectorAll('.hb-root [data-campaign]')].map(c => ({
        id: c.getAttribute('data-campaign') || '', text: (c.textContent || '').replace(/\s+/g, ' ').trim(),
    })));
    const costa = board.find(c => c.id === 'costa');
    if (SHOT) await page.screenshot({ path: `${SHOT}.tablon.png` });
    check('el tablón ofrece las campañas de semilla, detrás de las escritas, diciendo que su historia la escribe el juego',
        Boolean(costa) && /La costa que no duerme/.test(costa?.text ?? '') && /Su historia la escribe el juego/.test(costa?.text ?? '')
        && /Nivel recomendado: 1 a 3/.test(costa?.text ?? '') && board.findIndex(c => c.id === 'costa') > board.findIndex(c => c.id === 'strahd'),
        JSON.stringify(board.map(c => `${c.id}: ${c.text.slice(0, 120)}`)));

    // ------------------------------------------------------------ empezarla
    await page.locator('.hb-root [data-campaign="costa"]').click();
    const started = await until(async () => (await state()).world.includes('La costa que no duerme'), 120000);
    await page.waitForTimeout(2500);
    await settle();
    await dump('al empezar');
    if (SHOT) await page.screenshot({ path: `${SHOT}.empieza.png` });
    const hookLines = M(ACT_IDS.hook).beats.map((/** @type {any} */ b) => b.text);
    const hookRead = read.filter(r => hookLines.some((/** @type {string} */ line) => r.text.includes(line.slice(0, 40))));
    const witnessSpoke = read.some(r => r.plate.includes(WITNESS) && r.text.includes(`Soy ${WITNESS}`));
    const now0 = await state();
    check(`acto 1: empieza en ${START} con el gancho en su ventana, y ${WITNESS} se presenta`,
        started && now0.location === START && hookRead.length >= 2 && witnessSpoke && now0.done.includes(ACT_IDS.hook) && now0.open.includes(ACT_IDS.witness),
        JSON.stringify({ started, now0, read: read.slice(0, 6) }));

    // ------------------------------------------------------------ acto 1: quien lo vio
    const talkChip = new RegExp(`^Hablar con (${escape(WITNESS)}|(el|la) ${escape(roleOf(WITNESS).toLowerCase())})$`, 'i');
    const talked = await until(() => clickChip(talkChip), 15000);
    await page.waitForTimeout(1200);
    // Sin charla escrita, hablar abre la de siempre: se cierra para volver al sitio.
    await page.locator('.popup-button-ok:visible, .popup-button-cancel:visible').first().click({ timeout: 2000 }).catch(() => {});
    await settle();
    const now1 = await state();
    const clueScene = read.some(r => r.text.includes(CLUES[0].place) && r.plate.includes(WITNESS));
    check(`acto 1: hablar con ${WITNESS} abre las pistas, y lo cuenta en su escena`,
        talked && now1.done.includes(ACT_IDS.witness) && now1.open.includes(ACT_IDS.clues) && clueScene,
        JSON.stringify({ talked, now1, chips: await chips(), last: read.slice(-3) }));

    // ------------------------------------------------------------ acto 1: las pistas
    /** @type {string[]} */
    const looked = [];
    // Las dos más cerca, como haría quien juega.
    const order = [...CLUES].sort((a, b) => pathTo(START, a.place).length - pathTo(START, b.place).length).slice(0, 2);
    for (const clue of order) {
        const there = await travelTo(clue.place);
        const sight = sightAt(clue.place, clue.skill);
        const label = `${sight.verbo.charAt(0).toUpperCase()}${sight.verbo.slice(1)} ${sight.text}`;
        const offered = (await allChips()).some(c => c === label);
        if (SHOT && looked.length === 0) await page.screenshot({ path: `${SHOT}.pista.png` });
        // La tirada sale bien a propósito: lo que se mira aquí es que la pista está y cuenta.
        await page.evaluate(() => { /** @type {any} */ (window).__random = Math.random; Math.random = () => 0.97; });
        const pressed = await clickChip(new RegExp(`^${escape(label)}$`));
        await page.waitForTimeout(900);
        await clearDice();
        await page.evaluate(() => { Math.random = /** @type {any} */ (window).__random; });
        await settle();
        const after = await state();
        const box = (await novelBox()).text;
        looked.push(clue.place);
        check(`acto 1: en ${clue.place} se ofrece «${label}», y examinarlo da la pista`,
            there && offered && pressed && (after.clues >= looked.length || after.done.includes(ACT_IDS.clues)),
            JSON.stringify({ there, offered, pressed, after, box: box.slice(0, 300), chips: await allChips() }));
    }
    const now2 = await state();
    check(`acto 1 → 2: con dos pistas se descubre ${LAIR}`, now2.done.includes(ACT_IDS.clues) && now2.open.includes(ACT_IDS.lair),
        JSON.stringify(now2));

    // ------------------------------------------------------------ acto 2: la guarida
    const atLair = await travelTo(LAIR);
    await dump(`en ${LAIR}`);
    if (SHOT) await page.screenshot({ path: `${SHOT}.guarida.png` });
    const now3 = await state();
    check(`acto 2: se llega a ${LAIR}, que estaba escondida, y pide ganar en «${LAIR_BOARD}»`,
        atLair && now3.done.includes(ACT_IDS.lair) && now3.open.includes(ACT_IDS.strike), JSON.stringify(now3));
    const lairFight = await enterAndWin(LAIR_BOARD);
    const now4 = await state();
    check(`acto 2: se gana en «${LAIR_BOARD}», y la escena de la encrucijada decide: el bando A`,
        lairFight.won && now4.done.includes(ACT_IDS.strike) && now4.done.includes(ACT_IDS.crossroads)
        && chosen.includes('a') && now4.done.includes(ACT_IDS.sideA) && now4.closed.includes(ACT_IDS.sideB) && now4.open.includes(ACT_IDS.climaxA),
        JSON.stringify({ lairFight, now4, chosen, last: read.slice(-4) }));
    if (await clickChip(/^Salir del tablero$/)) {
        await page.waitForTimeout(800);
        await settle();
    }

    // ------------------------------------------------------------ acto 3: el refugio
    const atRefuge = await travelTo(REFUGE);
    await dump(`en ${REFUGE}`);
    if (SHOT) await page.screenshot({ path: `${SHOT}.refugio.png` });
    const finalFight = await enterAndWin(REFUGE_BOARD);
    await settle();
    const ended = await until(async () => Boolean((await state()).ending), 20000);
    const now5 = await state();
    check(`acto 3: en ${REFUGE} espera ${VILLAIN}; ganarle acaba la campaña con el final del bando A, avisando antes`,
        atRefuge && finalFight.won && finalFight.enemies.some((/** @type {string} */ n) => n.startsWith(VILLAIN)) && finalFight.warned
        && ended && now5.ending === ACT_ENDINGS.a && now5.done.includes(ACT_IDS.climaxA),
        JSON.stringify({ atRefuge, finalFight, now5 }));

    // ------------------------------------------------------------ el final
    const endCard = await until(() => page.evaluate(() => Boolean(document.querySelector('.popup .end-root'))), 15000);
    const endText = await page.evaluate(() => (document.querySelector('.popup .end-root')?.textContent || '').replace(/\s+/g, ' ').trim());
    if (SHOT) await page.screenshot({ path: `${SHOT}.final.png` });
    check(`el final sale en su ventana: «${ENDING.title}», con su escena y qué fue de la gente`,
        endCard && endText.includes(ENDING.title) && endText.includes(ENDING.epilogues[0].text.slice(0, 30)), endText.slice(0, 600));
    const home = await page.locator('.popup:has(.end-root) .end-home').click({ timeout: 5000 }).then(() => true).catch(() => false);
    const back = await until(async () => /Gremio/.test((await state()).world), 60000);
    await page.waitForTimeout(1500);
    await settle();
    await clickChip(/Tablón de campañas/);
    await page.waitForSelector('.hb-root [data-campaign="costa"]', { timeout: 15000 }).catch(() => {});
    const tile = await page.evaluate(() => (document.querySelector('.hb-root [data-campaign="costa"]')?.textContent || '').replace(/\s+/g, ' ').trim());
    if (SHOT) await page.screenshot({ path: `${SHOT}.vuelta.png` });
    check('de vuelta en el gremio, en el tablón va «Terminada»', home && back && /Terminada/.test(tile), JSON.stringify({ home, back, tile }));
    console.log('leído:', JSON.stringify(read.map(r => `${r.plate ? `${r.plate}: ` : ''}${r.text}`), null, 1).slice(0, 6000));

    check('sin errores en la página', problems.length === 0, problems.slice(0, 6).join('\n        '));
} catch (error) {
    failures++;
    console.log(`FAIL  the run threw: ${/** @type {any} */ (error)?.message || error}`);
    if (SHOT && page) await page.screenshot({ path: `${SHOT}.roto.png` }).catch(() => {});
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
