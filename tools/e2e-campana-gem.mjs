#!/usr/bin/env node
/**
 * J5.3, J5.6 y J12.5 de ROADMAP_SIN_CONEXION: una campaña de tu Gem con solo la historia y las
 * misiones se añade desde el tablón del gremio, se comprueba antes de jugarla y se juega
 * entera. Contra un servidor propio con un `--dataRoot` temporal, como `e2e-importar-campana.mjs`:
 *
 *   título → Jugar sin conexión → tu personaje → saltar la prueba → el tablón →
 *   pegar la campaña corta de [[GEM_CREAR_CAMPANA]] (`buildShortExamplePack`: sin tableros, sin
 *   bestiario, sin finales) → «Añadida al tablón», con el informe (J5.6): se puede jugar, y lo
 *   que ha puesto el juego (tableros con la semilla, bichos del bestiario, textos del narrador) →
 *   empezarla → la primera escena → de la aldea al camino del monte → su tablero, dibujado con
 *   la semilla, con los lobos → ganar → la ermita → ganar: se descubre la cripta → la cripta →
 *   ganar: el final → volver al gremio.
 *
 * J5.2: lo que la corta trae sin dibujar se ve al jugarla: a cuántos días queda y para qué nivel
 * es (en su tarjeta), quién cuenta la primera escena (Tobías, con su nombre), Tobías en la aldea
 * y el cofre de la cripta.
 *
 * J12.5: después, otra campaña con un tablero hecho de un mapa en imagen y sin su mapa escrito
 * (lo que escribe un Gem, que no ve el dibujo): el tablón lo lee del dibujo, se juega encima del
 * dibujo, y el tesoro del sitio está en un cofre que se abre andando hasta él. J5.2: su tablero
 * trae una trampa sin casilla (`traps`, con el estado en castellano): el juego la pone en el
 * camino, se ve al pasar a su lado y se desarma con su ficha.
 *
 * Uso:
 *   node tools/e2e-campana-gem.mjs              # sin ventana
 *   node tools/e2e-campana-gem.mjs --headed     # mirándolo
 *   node tools/e2e-campana-gem.mjs --port 8344 --captura gem.png
 */

/* global window, document, HTMLElement */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// D-J62, el modo guiado: lo del gremio en la Casa del Gremio; se va y se entra por lo que pide la historia.
import { alSitio, enElGremio, pasoDeLaHistoria, salirDelTablero, viajarAPasoNormal } from './e2e-guiado.mjs';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8262;
const BASE = `http://127.0.0.1:${PORT}`;
const HEADED = process.argv.includes('--headed');
const SHOT = argAfter('--captura');

const require = createRequire(join(ROOT, 'tests/package.json'));
const { chromium } = require('@playwright/test');

// La campaña de la prueba: la muestra corta que enseña GEM_CREAR_CAMPANA, tal cual.
const { buildShortExamplePack } = await import(pathToFileURL(join(ROOT, 'public/scripts/game-engine/campaign/pack-fill.js')).href);
const SHORT = buildShortExamplePack();
const NAME = String(SHORT.world.name);
const ID = 'tuya-el-pozo-de-la-ermita';

// J12.5: un mapa de mazmorra en imagen (dos salas y un paso, la cuadrícula gris en el suelo y
// la roca rayada, como los de verdad) y una campaña que lo trae sin su mapa escrito.
const { default: png } = await import('@jimp/js-png');
const DRAWN = [
    '##########',
    '#...#....#',
    '#...#....#',
    '#........#',
    '#...#....#',
    '##########',
];
const CELL = 20;
function drawMap() {
    const width = 7 + DRAWN[0].length * CELL + 13;
    const height = 5 + DRAWN.length * CELL + 13;
    const data = Buffer.alloc(width * height * 4, 255);
    const put = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ value) => {
        x = Math.round(x);
        y = Math.round(y);
        if (x < 0 || y < 0 || x >= width || y >= height) return;
        const i = (y * width + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = Math.min(data[i], value);
    };
    const box = (/** @type {number} */ cx, /** @type {number} */ cy) => ({ x0: 7 + cx * CELL, y0: 5 + cy * CELL });
    const floor = (/** @type {number} */ cx, /** @type {number} */ cy) => DRAWN[cy]?.[cx] === '.';
    for (let cy = 0; cy < DRAWN.length; cy++) {
        for (let cx = 0; cx < DRAWN[0].length; cx++) {
            const { x0, y0 } = box(cx, cy);
            if (floor(cx, cy)) {
                for (let t = 0; t < CELL; t++) {
                    for (const d of [-1, 0, 1]) {
                        put(x0 + t, y0 + d, 166);
                        put(x0 + t, y0 + CELL + d, 166);
                        put(x0 + d, y0 + t, 166);
                        put(x0 + CELL + d, y0 + t, 166);
                    }
                }
                continue;
            }
            for (let y = 0; y < CELL; y++) {
                for (let x = 0; x < CELL; x++) if ((x + y + cx * CELL + cy * CELL) % 6 < 2) put(x0 + x, y0 + y, 0);
            }
            for (let t = -1; t <= CELL + 1; t++) {
                for (const d of [-1, 0, 1]) {
                    if (floor(cx + 1, cy)) put(x0 + CELL + d, y0 + t, 0);
                    if (floor(cx - 1, cy)) put(x0 + d, y0 + t, 0);
                    if (floor(cx, cy + 1)) put(x0 + t, y0 + CELL + d, 0);
                    if (floor(cx, cy - 1)) put(x0 + t, y0 + d, 0);
                }
            }
        }
    }
    return { width, height, data };
}
const DRAWN_NAME = 'El Sótano del Molino';
const DRAWN_ID = 'tuya-el-sotano-del-molino';
const DRAWN_TREASURE = 'Llave del molino viejo';
// J5.2: una trampa como la escribiría un Gem que no ve el dibujo: sin casilla, y «derribado».
const DRAWN_TRAP = { name: 'Losa suelta', tell: 'Una losa baila bajo el polvo', damage: '1d4', condition: 'derribado', spotDC: 5, disarmDC: 5 };
const DRAWN_PACK = {
    world: { name: DRAWN_NAME, synopsis: 'Bajo el molino viejo hay un sótano que nadie baja a mirar desde hace años.', levels: [1, 2], journey: { days: 2 } },
    locations: [{ name: 'El molino viejo', type: 'ruins', treasure: [DRAWN_TREASURE] }],
    boards: [{ id: 'sotano', name: 'El sótano', locationName: 'El molino viejo', image: 'user/images/e2e-gem/sotano.png', grid: { cell: CELL, offsetX: 7, offsetY: 5 }, traps: [DRAWN_TRAP] }],
};

let failures = 0;
const check = (/** @type {string} */ name, /** @type {boolean} */ ok, detail = '') => {
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        -> ${detail}` : ''}`);
};

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-gem-'));
// El dibujo, como una imagen tuya: se sirve en /user/images/…
mkdirSync(join(dataRoot, 'default-user', 'user', 'images', 'e2e-gem'), { recursive: true });
writeFileSync(join(dataRoot, 'default-user', 'user', 'images', 'e2e-gem', 'sotano.png'), png().encode(/** @type {any} */ (drawMap())));
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

    const state = () => page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const party = (await import('/scripts/party.js')).getPartyMembersSnapshot();
        const meta = ctx.chatMetadata ?? {};
        return {
            world: String(meta.world_info ?? ''),
            location: String(meta.currentLocation ?? ''),
            board: String(meta.currentBoard ?? ''),
            party: party.map((/** @type {any} */ m) => ({ name: m.name, world: m.worldName, hp: m.hp })),
            fighting: Boolean(meta.combatEncounter?.active),
            ending: String(meta.plotEnding ?? ''),
            done: Array.isArray(meta.plotState?.done) ? meta.plotState.done.map(String) : [],
        };
    });
    const chips = () => page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-chip-action')].map(c => (c.textContent || '').trim()));
    const pressChip = (/** @type {RegExp} */ pattern) => page.evaluate((source) => {
        const chip = [...document.querySelectorAll('#game-shell .gs-chip-action')].find(b => new RegExp(source).test((b.textContent || '').trim()));
        if (chip instanceof HTMLElement) chip.click();
        return Boolean(chip);
    }, pattern.source);
    /** Pulsar una ficha; si no cabe en la fila, en la ventana de «+N más», que las tiene todas. */
    const clickChip = async (/** @type {RegExp} */ pattern) => {
        if (await pressChip(pattern)) return true;
        if (!(await pressChip(/^\+\d+ más$/))) return false;
        await page.waitForSelector('.hp-root .hp-item', { timeout: 5000 }).catch(() => {});
        const found = await page.evaluate((source) => {
            const item = [...document.querySelectorAll('.hp-root .hp-item')].find(b => new RegExp(source).test((b.textContent || '').trim()));
            if (item instanceof HTMLElement) item.click();
            return Boolean(item);
        }, pattern.source);
        if (!found) await page.locator('.popup:has(.hp-root) .popup-button-ok').click({ timeout: 3000 }).catch(() => {});
        return found;
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
    const sceneNow = () => page.evaluate(() => document.querySelector('#game-shell')?.getAttribute('data-scene') || '');
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
    /** @type {string[]} Lo que salió en la caja de la novela en cada parada. */
    const boxes = [];
    const dump = async (/** @type {string} */ label) => {
        console.log(`--- ${label}`);
        const box = await novelBox();
        boxes.push(box.text);
        console.log(JSON.stringify({ state: await state(), scene: await sceneNow(), chips: await chips(), box }, null, 1).slice(0, 2500));
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
    /** @type {string[]} Lo que se ha leído en las escenas del hilo, en orden. */
    const read = [];
    /** @type {string[]} Quién habla en cada escena leída (J5.2: el punto de vista). */
    const plates = [];
    /** Leer las escenas que se abran, hasta que no quede ninguna. */
    const playScenes = async () => {
        for (let i = 0; i < 80; i++) {
            const now = await story();
            if (!now) {
                await page.waitForTimeout(300);
                if (!(await story())) return;
                continue;
            }
            if (now.text && read[read.length - 1] !== now.text) {
                read.push(now.text);
                plates.push(now.plate);
            }
            if (now.options.length > 0) await page.locator(`dialog.ps-dialog[open] .dw-option[data-option="${now.options[0]}"]`).click({ timeout: 4000 }).catch(() => {});
            else await page.locator('dialog.ps-dialog[open] .ps-next, dialog.ps-dialog[open] .ps-finish').first().click({ timeout: 4000 }).catch(() => {});
            await page.waitForTimeout(250);
        }
    };
    /** Seguir la novela hasta que se vea lo que se puede hacer (o `wanted`). */
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
        await dropToasts();
    };
    /** Gana la pelea que haya: todos a cero y turnos hasta que se acaba (la pelea en sí la mira e2e-combate). */
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

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    const firstRun = page.locator('text=Welcome to SillyTavern!');
    if (await firstRun.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#game-shell', { timeout: 90000 });

    // 1. Al gremio: el personaje, y la prueba saltada.
    const offline = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Jugar sin conexión' });
    await until(async () => await offline.count() === 1, 30000);
    await offline.click();
    await page.waitForSelector('.hc-root', { timeout: 120000 });
    await page.fill('.hc-root .hc-name', 'Iria');
    await pickHeroCard(page, 'race', 'Humano');
    await pickHeroCard(page, 'class', 'Guerrero');
    await page.locator('.hc-root .hc-enter').click();
    const inHub = await until(async () => {
        const now = await state();
        return /Gremio/.test(now.world) && now.party.length === 1;
    }, 60000);
    // El prólogo se lee (sus escenas) y la prueba se salta, como quien ya sabe jugar.
    await page.waitForTimeout(1500);
    await settle();
    // D-J62: «Saltar la prueba» está en la Casa del Gremio, fuera del tablero del muelle.
    await salirDelTablero(page);
    // Si la pelea del muelle ya se está decidiendo, lo mismo que hace el botón.
    if (!(await until(() => enElGremio(page, 'hub-skip'), 15000))) await page.evaluate(async () => { void (await import('/scripts/party/hub.js')).skipHubTrial(); });
    await page.waitForSelector('.popup:has-text("¿Saltar la prueba?")', { timeout: 10000 }).catch(() => {});
    await page.locator('.popup-button-ok:visible').first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await settle();
    const skipped = await until(async () => (await state()).done.includes('la-prueba'), 20000);
    check('en el gremio con Iria, y la prueba saltada', inHub && skipped, JSON.stringify({ state: await state(), chips: await chips() }));
    read.length = 0;
    plates.length = 0;

    // 2. El tablón: pegar la campaña corta.
    await dropToasts();
    await enElGremio(page, 'hub-board');
    await page.waitForSelector('.hb-root [data-campaign-add]', { timeout: 15000 });
    await page.locator('.hb-root .hb-paste-open').click();
    await page.fill('.hb-root .hb-paste-text', JSON.stringify(SHORT, null, 2));
    await page.locator('.hb-root .hb-paste-add').click();
    await until(() => page.evaluate((id) => Boolean(document.querySelector(`.hb-root [data-campaign="${id}"]`)), ID), 30000);
    const report = await page.evaluate(() => {
        const box = document.querySelector('.hb-root .hb-import');
        return {
            text: (box?.textContent || '').replace(/\s+/g, ' ').trim(),
            verdict: box?.querySelector('.hb-check')?.getAttribute('data-verdict') ?? '',
            groups: [...(box?.querySelectorAll('.hb-check-group') ?? [])].map(g => ({ key: g.getAttribute('data-group'), open: /** @type {HTMLDetailsElement} */ (g).open, text: (g.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 3000) })),
        };
    });
    console.log(JSON.stringify(report, null, 1));
    // J5.6: el informe va pegado a las tarjetas y se ve sin buscarlo: su veredicto, en pantalla,
    // y la tarjeta recién añadida justo encima.
    const seen = await page.evaluate((id) => {
        const verdict = document.querySelector('.hb-root .hb-import .hb-check-head')?.getBoundingClientRect();
        const box = document.querySelector('.hb-root .hb-import');
        return {
            inView: Boolean(verdict) && /** @type {DOMRect} */ (verdict).top >= 0 && /** @type {DOMRect} */ (verdict).bottom <= window.innerHeight,
            afterGrid: Boolean(box?.previousElementSibling?.classList.contains('hb-grid')),
            tile: Boolean(document.querySelector(`.hb-root [data-campaign="${id}"]`)),
        };
    }, ID);
    check('el informe sale bajo las tarjetas, con su veredicto a la vista al añadirla (J5.6)', seen.inView && seen.afterGrid && seen.tile, JSON.stringify(seen));
    if (SHOT) await page.screenshot({ path: `${SHOT}.informe.png` });
    // J5.6: comprobada antes de jugarla, en llano: se juega entera, y lo que puso el juego, plegado.
    const relleno = report.groups.find(g => g.key === 'relleno');
    check('el informe dice que se puede jugar de principio a fin y lo que ha puesto el juego, sin ids ni «PNJ»',
        report.verdict === 'lista' && /Comprobada: Se puede jugar de principio a fin/.test(report.text)
        && Boolean(relleno) && relleno?.open === false && /3 tableros dibujados con la semilla/.test(relleno?.text ?? '')
        && /escena contada por quien la vive: Tobías el molinero/.test(relleno?.text ?? '')
        && !/PNJ|eliminate|survive_rounds/.test(report.text) && !/«Aldea de Brezo»: nadie con quien hablar/.test(report.text), report.text.slice(0, 600));
    // J5.2: la tarjeta dice para qué nivel es y a cuántos días queda, como lo escribió el Gem.
    const card = await page.evaluate((id) => (document.querySelector(`.hb-root [data-campaign="${id}"]`)?.textContent || '').replace(/\s+/g, ' ').trim(), ID);
    check('su tarjeta: nivel 1 a 3 y a tres días de camino (world.levels y world.journey)',
        /Nivel recomendado: 1 a 3/.test(card) && /A tres días de camino/.test(card), card);

    // 3. Empezarla.
    await page.locator(`.hb-root [data-campaign="${ID}"]`).click();
    const started = await until(async () => (await state()).world.includes(NAME), 120000);
    await page.waitForTimeout(2500);
    check('empezarla abre su mundo', started, JSON.stringify(await state()));
    await dump('al empezar');
    if (SHOT) await page.screenshot({ path: `${SHOT}.empieza.png` });
    const tripText = (await novelBox()).text;
    await settle();
    await dump('tras la primera escena');
    console.log('leído:', JSON.stringify(read), 'quién:', JSON.stringify(plates));
    check('el viaje dura lo que dice la campaña, y se va como dice (world.journey)',
        /Tres días de camino|tres días/i.test(`${tripText} ${(await novelBox()).text}`) && /Subís por la costa/.test(`${tripText} ${(await novelBox()).text}`),
        `${tripText} | ${(await novelBox()).text}`.slice(0, 400));
    const povAt = read.findIndex(t => /Aquí nadie os va a abrir la puerta/.test(t));
    // J13.7: hasta que se presenta, se le llama por lo que es («El molinero»).
    check('la primera escena la cuenta Tobías, con su nombre o lo que es (pov)', povAt >= 0 && /Tobías|molinero/i.test(plates[povAt] ?? ''), JSON.stringify({ read, plates }));
    // D-J62: sin la fila de abajo, se le habla en la aldea (en su sitio o en «Gente de aquí»).
    await alSitio(page);
    const brezo = await page.evaluate(() => [...document.querySelectorAll('#game-shell [data-chip^="talk-local:"], #game-shell .gs-town-place-who, #game-shell .gs-story-step')]
        .map(n => (n.textContent || '').replace(/\s+/g, ' ').trim()));
    check('Tobías el molinero está en la aldea (npcs.where): se puede hablar con él', brezo.some(c => /Tobías|molinero/.test(c)), JSON.stringify(brezo));

    // 4. Las tres misiones, una tras otra: ir, entrar, pelear, ganar.
    /** @type {string[]} Los tableros que avisaron de que no hay vuelta atrás (J11.1). */
    const warnings = [];
    for (const [place, foe] of [['El camino del monte', 'Lobo'], ['La ermita', 'Cultista'], ['La cripta de la ermita', 'Dama']]) {
        await settle();
        // D-J62: «Ir a…» en lo que pide la historia; y al llegar, su tablero se abre solo.
        const go = await pasoDeLaHistoria(page, `story:go:${place}`, { ms: 15000 });
        await viajarAPasoNormal(page);
        const there = await until(async () => (await state()).location === place, 30000);
        await settle();
        await dump(`en ${place}`);
        if (SHOT) await page.screenshot({ path: `${SHOT}.${place.replace(/\W+/g, '-')}.png` });
        const enter = await until(async () => Boolean((await state()).board) || await page.locator('.popup:has-text("no tiene vuelta atrás")').count() > 0, 10000);
        await page.waitForTimeout(600);
        // J11.1: el tablero que lleva al final avisa antes de que no hay vuelta atrás.
        const warned = await page.locator('.popup:has-text("no tiene vuelta atrás") .popup-button-ok').click({ timeout: 2500 }).then(() => true).catch(() => false);
        if (warned) {
            warnings.push(place);
            await page.waitForTimeout(1200);
        }
        await settle();
        await dump(`el tablero de ${place}`);
        if (/cripta/.test(place)) {
            // J5.2: el tesoro de la cripta (locations[].treasure), en un cofre de su tablero.
            const chest = await page.evaluate(() => document.querySelectorAll('#game-shell .wm-terrain-door-actionable[title="Abrir el cofre"]').length);
            check('en la cripta hay un cofre: el tesoro que la campaña le puso', chest >= 1, String(chest));
        }
        // Quien espera a la vista se ofrece con «Iniciar combate»; en una mazmorra, quien duerme
        // tras una puerta se despierta al abrirla: se abren una a una hasta dar con la pelea.
        let fight = false;
        for (let i = 0; i < 6 && !fight; i++) {
            if ((await state()).fighting) { fight = true; break; }
            if (await until(async () => (await chips()).some(c => new RegExp(`^Iniciar combate.*${foe}`).test(c)), i === 0 ? 8000 : 2000)) {
                await clickChip(/^Iniciar combate/);
                fight = await until(async () => (await state()).fighting, 8000);
                break;
            }
            if (!(await clickChip(/^Abrir la puerta/))) break;
            await page.waitForTimeout(1200);
            await settle();
            fight = await until(async () => (await state()).fighting, 3000);
        }
        await winFight();
        await page.waitForTimeout(1200);
        await settle();
        check(`${place}: se llega, se entra y se gana a ${foe}`, go && there && fight && !(await state()).fighting, JSON.stringify({ go, there, enter, fight, state: await state() }));
        await dump(`tras ganar en ${place}`);
        // Ganada, se sale del tablero al sitio, como quien juega (si «Continuar» no lo ha hecho ya: D-J45).
        if (await clickChip(/^Salir del tablero$/)) {
            await page.waitForTimeout(800);
            await settle();
        }
    }
    await settle();
    console.log('leído:', JSON.stringify(read));
    await dump('al final');
    // Sin modelo, la gente nueva de un sitio se dice sin la orden para el narrador.
    const orders = boxes.filter(t => /con naturalidad|cuando toque/.test(t));
    check('la caja no enseña órdenes para el narrador («Que aparezcan con naturalidad…»)', orders.length === 0, orders.join(' | ').slice(0, 400));
    if (SHOT) await page.screenshot({ path: `${SHOT}.final.png` });

    // 5. El final: la campaña se acaba con el que puso el juego, y se vuelve al gremio con ella hecha.
    const ended = await until(async () => Boolean((await state()).ending), 20000);
    const endingNow = (await state()).ending;
    check('ganar en la cripta acaba la campaña con el final que puso el juego, avisando antes (J11.1)',
        ended && /final/i.test(endingNow) && warnings.includes('La cripta de la ermita'), JSON.stringify({ endingNow, warnings }));
    // J4.5: la escena del final, en su ventana: lo que cuenta el narrador del motor, lo que se lleva
    // cada uno y el botón para volver al gremio.
    const endCard = await until(() => page.evaluate(() => Boolean(document.querySelector('.popup .end-root'))), 15000);
    const endText = await page.evaluate(() => (document.querySelector('.popup .end-root')?.textContent || '').replace(/\s+/g, ' ').trim());
    check('el final sale en su ventana, contado aunque la campaña no lo escribiera, con lo que se lleva cada uno',
        endCard && /^Final: El final/.test(endText) && /El último golpe cae|silencio|se hablará/.test(endText) && /Lo que se lleva cada uno/.test(endText), endText.slice(0, 400));
    const home = await page.locator('.popup:has(.end-root) .end-home').click({ timeout: 5000 }).then(() => true).catch(() => false);
    const back = await until(async () => /Gremio/.test((await state()).world), 60000);
    await page.waitForTimeout(1500);
    await settle();
    await enElGremio(page, 'hub-board');
    await page.waitForSelector('.hb-root [data-campaign]', { timeout: 15000 }).catch(() => {});
    const tile = await page.evaluate((id) => (document.querySelector(`.hb-root [data-campaign="${id}"]`)?.textContent || '').replace(/\s+/g, ' ').trim(), ID);
    check('de vuelta en el gremio, en el tablón va «Terminada»', home && back && /Terminada/.test(tile), JSON.stringify({ home, back, tile }));
    if (SHOT) await page.screenshot({ path: `${SHOT}.vuelta.png` });
    await page.locator('.hb-root .hb-close').click({ timeout: 5000 }).catch(() => {});

    // 6. J12.5: otra campaña, con un tablero hecho de un mapa en imagen y sin su mapa escrito.
    await enElGremio(page, 'hub-board');
    await page.waitForSelector('.hb-root [data-campaign-add]', { timeout: 15000 });
    await page.locator('.hb-root .hb-paste-open').click();
    await page.fill('.hb-root .hb-paste-text', JSON.stringify(DRAWN_PACK, null, 2));
    await page.locator('.hb-root .hb-paste-add').click();
    const drawnIn = await until(() => page.evaluate((id) => Boolean(document.querySelector(`.hb-root [data-campaign="${id}"]`)), DRAWN_ID), 30000);
    const drawnReport = await page.evaluate(() => (document.querySelector('.hb-root .hb-import')?.textContent || '').replace(/\s+/g, ' ').trim());
    check('el tablón lee el mapa del dibujo al añadirla, y pone el tesoro en un cofre',
        drawnIn && /Un tablero traía su dibujo sin su mapa: se ha leído del dibujo/.test(drawnReport)
        && /1 tablero leído de su dibujo: El sótano/.test(drawnReport) && /1 cofre con su tesoro: El sótano/.test(drawnReport), drawnReport.slice(0, 700));
    check('la trampa sin casilla la pone el juego en el camino, y lo dice (traps)', /1 trampa puesta en el camino: El sótano/.test(drawnReport), drawnReport.slice(0, 900));
    if (SHOT) await page.screenshot({ path: `${SHOT}.dibujo-informe.png` });
    await page.locator(`.hb-root [data-campaign="${DRAWN_ID}"]`).click();
    const drawnStarted = await until(async () => (await state()).world.includes(DRAWN_NAME), 120000);
    await page.waitForTimeout(2500);
    await settle();
    await until(async () => (await state()).board === 'El sótano', 20000);
    const BOARD = '#game-shell .gs-scene-map';
    const onDrawing = await page.evaluate((sel) => ({
        image: [...document.querySelectorAll(`${sel} img`)].map(i => i.getAttribute('src') || '').find(src => /sotano\.png/.test(src)) || '',
        over: Boolean(document.querySelector(`${sel} .wm-terrain-over-image`)),
        walls: document.querySelectorAll(`${sel} .wm-terrain-wall`).length,
        doors: document.querySelectorAll(`${sel} .wm-terrain-door-actionable`).length,
    }), BOARD);
    check('se juega encima del dibujo, con los muros leídos de él', drawnStarted && Boolean(onDrawing.image) && onDrawing.over && onDrawing.walls >= 20,
        JSON.stringify({ drawnStarted, onDrawing, state: await state() }));
    if (SHOT) await page.screenshot({ path: `${SHOT}.dibujo.png` });

    // Andar hasta el cofre, a clics (la ficha, y la casilla más cerca de él), y abrirlo.
    const heroAt = () => page.evaluate(async () => {
        const hero = (await import('/scripts/party.js')).getPartyMembersSnapshot()[0];
        return { id: String(hero?.id ?? ''), x: Number(hero?.mapPosition?.gridX) || 0, y: Number(hero?.mapPosition?.gridY) || 0, items: (hero?.items ?? []).map((/** @type {any} */ i) => String(i?.name ?? '')) };
    });
    const chestAt = () => page.evaluate((sel) => {
        const el = /** @type {HTMLElement|null} */ (document.querySelector(`${sel} .wm-terrain-door-actionable[title="Abrir el cofre"]`));
        if (!el) return null;
        const w = parseFloat(el.style.width) || 1;
        const h = parseFloat(el.style.height) || 1;
        return { x: Math.round(parseFloat(el.style.left) / w), y: Math.round(parseFloat(el.style.top) / h) };
    }, BOARD);
    const chestCell = await chestAt();
    /** J5.2: la trampa del paquete, vista al pasar a su lado y desarmada con su ficha. */
    const trap = { seen: '', disarmed: false, tries: 0 };
    const disarmChip = /^Desarmar: losa suelta$/;
    /** @type {Array<{at: string, lit: number}>} Por dónde se anduvo, y cuántas casillas se encendían. */
    const walked = [];
    for (let step = 0; step < 12 && chestCell; step++) {
        if ((await chips()).some(c => disarmChip.test(c)) && !trap.disarmed) {
            trap.seen ||= await page.evaluate(() => [...document.querySelectorAll('#toast-container .toast')].map(t => (t.textContent || '').replace(/\s+/g, ' ').trim()).join(' | '));
            if (SHOT && trap.tries === 0) await page.screenshot({ path: `${SHOT}.trampa.png` });
            for (; trap.tries < 5 && (await chips()).some(c => disarmChip.test(c)); trap.tries++) {
                await dropToasts();
                await clickChip(disarmChip);
                await page.waitForTimeout(700);
                await clearDice();
                await page.waitForTimeout(400);
            }
            trap.disarmed = !(await chips()).some(c => disarmChip.test(c));
        }
        const hero = await heroAt();
        if (Math.max(Math.abs(hero.x - chestCell.x), Math.abs(hero.y - chestCell.y)) <= 1) break;
        await clearDice();
        // Si la ficha ya está elegida (se paró ante la trampa), pulsarla otra vez la soltaría.
        const lit = () => page.locator(`${BOARD} .wm-highlight-move.wm-highlight-clickable`).count();
        if (await lit() === 0) await page.locator(`${BOARD} .wm-token[data-token-id="${hero.id}"]`).first().click({ timeout: 3000 }).catch(() => {});
        await until(async () => (await lit()) > 0, 4000);
        walked.push({ at: `${hero.x},${hero.y}`, lit: await lit() });
        const target = await page.evaluate(({ sel, cx, cy }) => {
            const cells = [...document.querySelectorAll(`${sel} .wm-highlight-move.wm-highlight-clickable`)]
                .map(n => ({ x: Number(n.getAttribute('data-x')), y: Number(n.getAttribute('data-y')) }))
                .filter(c => !(c.x === cx && c.y === cy));
            const far = (/** @type {{x: number, y: number}} */ c) => Math.max(Math.abs(c.x - cx), Math.abs(c.y - cy)) * 100 + Math.abs(c.x - cx) + Math.abs(c.y - cy);
            cells.sort((a, b) => far(a) - far(b));
            return cells[0] ?? null;
        }, { sel: BOARD, cx: chestCell.x, cy: chestCell.y });
        if (!target) break;
        await page.locator(`${BOARD} .wm-highlight-move.wm-highlight-clickable[data-x="${target.x}"][data-y="${target.y}"]`).first().click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(900);
        await clearDice();
    }
    const beside = await heroAt();
    await dropToasts();
    await page.locator(`${BOARD} .wm-terrain-door-actionable[title="Abrir el cofre"]`).first().click({ timeout: 4000 }).catch(() => {});
    const opened = await until(async () => (await heroAt()).items.includes(DRAWN_TREASURE), 8000);
    check('la trampa del paquete se ve al pasar a su lado, con su aviso, y se desarma con su ficha (traps)',
        /Una losa baila bajo el polvo/.test(trap.seen) && trap.disarmed, JSON.stringify(trap));
    check('andando hasta el cofre y abriéndolo, el tesoro del sitio va a la mochila (locations[].treasure)',
        Boolean(chestCell) && opened && !(await chestAt()), JSON.stringify({ chestCell, beside, walked, after: await heroAt() }));
    if (SHOT) await page.screenshot({ path: `${SHOT}.cofre.png` });

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
