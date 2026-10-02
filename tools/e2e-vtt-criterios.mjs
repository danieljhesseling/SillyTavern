#!/usr/bin/env node
/**
 * Tanda 12, «el revisor de los criterios»: cada criterio de aceptación y cada punto de «Lo que
 * Daniel vio jugando» de wiki/maquetas/ENCARGO_COMBATE_VTT.md, mirados como los vería quien juega,
 * en un navegador de verdad contra un servidor propio (un `--dataRoot` limpio por escenario, siempre
 * en el mismo puerto):
 *
 *   - «muelle»: título → Jugar sin conexión → Tessa, guerrera → el muelle del prólogo (la novela,
 *     la decisión, colocarse, la iniciativa) → su turno, a 1280×720, 1920×1080, 390×844 y 844×390
 *     (con ratón) → la pelea, ganada a clics desde la barra → el muelle sin pelea;
 *   - «movil»: lo mismo con Nerea, maga, en un teléfono (toques), de pie y tumbado;
 *   - «1387»: Mara, maga → el bot de las vueltas (`vuelta-bot.mjs`) pasa el prólogo y empieza 1387
 *     desde el tablón hasta su primera pelea → los cuatro tamaños, con ratón.
 *
 * En cada tamaño: sin barras de desplazamiento, el HUD fuera de la cabecera y dentro de la
 * pantalla, el contraste WCAG AA medido con los colores calculados, los cuatro menús (no más de
 * 440 px, sin cortarse por arriba; Atacar con el golpe sin armas, agarrar y empujar con su CD y el
 * cambio de arma; Magia con sus gemas), Espacio, los marcadores de borde, el alcance al pasar el
 * ratón (o al primer toque) y los clics fantasma (pulsar el HUD no mueve ninguna ficha).
 * Una vez por escenario: la placa del narrador, el oficio con su género, los 120 pies, el mar, la
 * ruta recta, la pelea que empieza sola (sin «Iniciar combate») y las diagonales alternas.
 *
 * Al final, la tabla: cada criterio, PASS/FAIL por escenario y tamaño. Con `--captura <carpeta>`
 * guarda capturas de todo (mirarlas al lado de wiki/maquetas/combate-vtt-v3.html), el informe en
 * JSON (`informe.json`) y los fallos en Markdown (`fallos.md`).
 *
 * Uso:
 *   node tools/e2e-vtt-criterios.mjs --port 8451 --captura <carpeta>
 *   node tools/e2e-vtt-criterios.mjs --solo muelle,movil       # solo esos escenarios
 *   node tools/e2e-vtt-criterios.mjs --tamanos 1280x720,390x844  # solo esos tamaños (con ratón)
 */

/* global window, document, HTMLElement, HTMLButtonElement, PointerEvent, MutationObserver, getComputedStyle */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { comoVaLaEntrada, entrarEnLaPelea } from './e2e-entrar-pelea.mjs';
import { createBot, runCampaign, startOffline } from './vuelta-bot.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8451;
const BASE = `http://127.0.0.1:${PORT}`;
const HEADED = process.argv.includes('--headed');
const SHOTS = argAfter('--captura');
const ONLY = new Set((argAfter('--solo') || 'muelle,movil,1387').split(',').map(s => s.trim()).filter(Boolean));
const DESK_SIZES = (argAfter('--tamanos') || '1280x720,1920x1080,390x844,844x390').split(',').map(s => s.trim()).filter(Boolean);

const require = createRequire(join(ROOT, 'tests/package.json'));
const { chromium } = require('@playwright/test');
const readJson = (/** @type {string} */ path) => JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

/** Los criterios, en el orden del encargo. */
const CRITERIA = /** @type {Array<[string, string]>} */ ([
    ['C1', 'El mapa llena la pantalla de juego sin barras de desplazamiento'],
    ['C1b', 'El HUD deja libre la cabecera y cabe en la pantalla'],
    ['C2', 'Espacio centra en quien tiene el turno'],
    ['C3', 'Un enemigo fuera de la vista sale en el borde («Nombre · N pies») y pulsarlo lleva la cámara a él'],
    ['C4', 'Pasar el ratón por tu ficha (en el móvil, el primer toque) enseña tu alcance en azul'],
    ['C5', 'Atacar: golpe sin armas con daño, agarrar y empujar con CD, y cambiar de arma'],
    ['C6', 'Magia: las gemas de los espacios que quedan (y los filtros)'],
    ['C7', 'Los menús no pasan de 440 px ni se cortan por arriba'],
    ['C8', 'Contraste WCAG AA (4,5:1; 3:1 el texto grande) del texto del HUD'],
    ['C9', 'Sin clics fantasma: pulsar el HUD no mueve ninguna ficha'],
    ['B1', 'La barra: Acción, Adicional y Reacción, «x/30 pies», Cuerpo a tierra y Atacar, Magia, Acciones, Adicional, Fin de turno, Abandonar (sin Hablar, Mascota, Maniobras)'],
    ['V1', 'Sin placa «Narrador» en la novela'],
    ['V1b', 'El oficio va con el género de la persona («la posadera» / «el posadero»)'],
    ['V2', 'Fuera de combate no se dice «Anda hasta 120 pies de una vez»'],
    ['V3', 'No se anda sobre el agua honda (el mar)'],
    ['V4', 'La ruta hacia el enemigo (en el muelle, el ratero) va recta: un giro como mucho'],
    ['V5', 'La pelea empieza sola: decisión → colocarse → iniciativa; sin «Iniciar combate»'],
    ['V5b', 'La decisión ofrece Pelear y otras salidas (Hablar, Pagar, Huir, Esconderse…)'],
    ['V5c', 'En el tablero no salen fichas que no son de ahí (Saltar la prueba, Hablar con…, Escuchar rumores, Tirada)'],
    ['V6', 'En combate, 30 pies (6 casillas) y las diagonales alternas (5, 10, 5…) en un interruptor'],
]);

/** @type {Array<{crit: string, scene: string, size: string, ok: boolean|null, detail: string, shot: string}>} */
const results = [];
/**
 * Apuntar el resultado de un criterio en un escenario y un tamaño.
 *
 * @param {string} crit
 * @param {string} scene
 * @param {string} size
 * @param {boolean|null} ok `null`: no se puede mirar aquí (y se dice por qué).
 * @param {any} [detail]
 * @param {string} [shot]
 */
function note(crit, scene, size, ok, detail = '', shot = '') {
    const said = typeof detail === 'string' ? detail : JSON.stringify(detail);
    results.push({ crit, scene, size, ok, detail: said.slice(0, 1600), shot });
    const name = CRITERIA.find(c => c[0] === crit)?.[1] ?? crit;
    console.log(`${ok === null ? 'N/A ' : ok ? 'PASS' : 'FAIL'}  [${scene} ${size}] ${crit} ${name}${said ? `\n        -> ${said.slice(0, 700)}` : ''}${shot ? `\n        captura: ${shot}` : ''}`);
}

// ------------------------------------------------------------------ el servidor, uno limpio por escenario
/** @type {any} */
let server = null;
let dataRoot = '';
/** @type {any} */
let browser = null;

async function startServer() {
    dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-criterios-'));
    server = spawn(process.execPath, ['server.js', '--port', String(PORT), '--dataRoot', dataRoot], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    const child = server;
    await new Promise((resolve, reject) => {
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

async function stopServer() {
    if (server) {
        server.stdout?.destroy();
        server.stderr?.destroy();
        server.kill('SIGKILL');
        server = null;
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
    if (dataRoot) rmSync(dataRoot, { recursive: true, force: true, maxRetries: 5 });
    dataRoot = '';
}

// ------------------------------------------------------------------ una partida en su ventana
/**
 * @typedef {object} Game
 * @property {any} page
 * @property {any} context
 * @property {string} scene
 * @property {boolean} touch
 * @property {string[]} problems
 * @property {(test: () => Promise<boolean>, ms?: number) => Promise<boolean>} until
 */

/**
 * Abrir el juego en una ventana nueva, con lo que mira la novela (la placa y quién habla) apuntado
 * desde la página misma, cada vez que cambia.
 *
 * @param {{width: number, height: number}} viewport
 * @param {boolean} touch
 * @param {string} scene
 * @param {{quiet?: boolean}} [options] `quiet`: sin sucesos ni ventanas de historia (como e2e-entrada).
 * @returns {Promise<Game>}
 */
async function openGame(viewport, touch, scene, { quiet = true } = {}) {
    const context = await browser.newContext(touch ? { viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport });
    const page = await context.newPage();
    /** @type {string[]} */
    const problems = [];
    page.on('pageerror', (/** @type {any} */ e) => problems.push(`PAGEERROR ${e.message}`));
    page.on('console', (/** @type {any} */ m) => {
        if (m.type() === 'error' && !/Failed to load resource.*404/.test(m.text())) problems.push(`ERROR ${m.text().slice(0, 300)}`);
    });
    await context.addInitScript((calm) => {
        try {
            window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,combat,travel,prisoners,mesa,high,spell,pet,bill,move,attack,roll,talk,journal');
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
            if (calm) {
                window.localStorage.setItem('sillytavern_gameSucesos', 'off');
                window.localStorage.setItem('sillytavern_gameStoryWindows', 'off');
            }
        } catch { /* nada */ }
        // Lo que se ve en la caja de la novela: la placa, quién dice cada frase y el texto.
        /** @type {any} */ (window).__vnSeen = [];
        const keys = new Set();
        let pending = false;
        const sample = () => {
            pending = false;
            // Las ventanas de historia (escenas, charlas, la decisión antes de pelear): su placa.
            for (const box of document.querySelectorAll('dialog[open] .qd-root')) {
                const plate = /** @type {HTMLElement|null} */ (box.querySelector('.qd-nameplate'));
                const pr = plate?.getBoundingClientRect();
                const plateText = plate && !plate.hidden && pr && pr.width > 0 && pr.height > 0 ? (plate.textContent || '').trim() : '';
                const text = (box.querySelector('.qd-text')?.textContent || '').replace(/\s+/g, ' ').trim();
                const key = `v|${plateText}|${text.slice(-160)}`;
                if ((!plateText && !text) || keys.has(key)) continue;
                keys.add(key);
                /** @type {any} */ (window).__vnSeen.push({ plate: plateText, who: [], text: text.slice(-500), scene: 'ventana' });
            }
            const textNode = document.querySelector('#game-shell .gs-vn-text');
            if (!textNode) return;
            const plate = /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .gs-vn-nameplate'));
            const box = plate?.getBoundingClientRect();
            const plateText = plate && !plate.hidden && box && box.width > 0 && box.height > 0 ? (plate.textContent || '').trim() : '';
            const who = [...document.querySelectorAll('#game-shell .gs-vn-who')].map(n => (n.textContent || '').trim()).filter(Boolean);
            const text = (textNode.textContent || '').replace(/\s+/g, ' ').trim();
            if (!plateText && who.length === 0 && !text) return;
            const key = `${plateText}|${who.join(',')}|${text.slice(-160)}`;
            if (keys.has(key)) return;
            keys.add(key);
            const seen = /** @type {any} */ (window).__vnSeen;
            seen.push({ plate: plateText, who, text: text.slice(-500), scene: document.querySelector('#game-shell')?.getAttribute('data-scene') || '' });
            if (seen.length > 600) seen.shift();
        };
        const start = () => new MutationObserver(() => {
            if (pending) return;
            pending = true;
            setTimeout(sample, 120);
        }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden'] });
        if (document.body) start();
        else document.addEventListener('DOMContentLoaded', start);
    }, quiet);
    const until = async (/** @type {() => Promise<boolean>} */ test, ms = 30000) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (await test().catch(() => false)) return true;
            await page.waitForTimeout(300);
        }
        return false;
    };
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 300000 });
    return { page, context, scene, touch, problems, until };
}

// ------------------------------------------------------------------ mirar la pantalla
/** @param {Game} g */
const clearDice = async (g) => {
    for (let i = 0; i < 40; i++) {
        const next = g.page.locator('.wm-dice-overlay.active .wm-dice-next');
        if (await next.count() === 0) break;
        const ok = await (g.touch ? next.first().tap({ timeout: 1500 }) : next.first().click({ timeout: 1500 })).then(() => true).catch(() => false);
        if (!ok) await g.page.evaluate(() => /** @type {HTMLElement|null} */ (document.querySelector('.wm-dice-overlay.active .wm-dice-next'))?.click());
        await g.page.waitForTimeout(200);
    }
};
/** @param {Game} g */
const dropToasts = (g) => g.page.evaluate(() => document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));
/** @param {Game} g */
const fighting = (g) => g.page.evaluate(() => Boolean(window.SillyTavern.getContext().chatMetadata?.combatEncounter?.active));

/**
 * Una captura con nombre, si se pidieron.
 *
 * @param {Game} g
 * @param {string} size
 * @param {string} what
 */
async function shot(g, size, what) {
    if (!SHOTS) return '';
    const file = join(SHOTS, `${g.scene}-${size}-${what}.png`);
    await g.page.screenshot({ path: file }).catch(() => {});
    return file;
}

/**
 * Lo que se sabe de la pelea y del grupo (posiciones, el turno, lo gastado).
 *
 * @param {Game} g
 */
const fightState = (g) => g.page.evaluate(async () => {
    const st = await import('/scripts/party/state.js');
    const enc = /** @type {any} */ (st.combatEncounter);
    const members = /** @type {any[]} */ (st.partyMembers);
    const hero = members.find(m => !m.guest) ?? members[0];
    const entry = enc?.active ? enc.turnOrder?.[enc.currentTurnIndex] : null;
    return {
        fighting: Boolean(enc?.active),
        mine: Boolean(entry && !entry.isEnemy && String(entry.id) === String(hero?.id)),
        ally: Boolean(entry && !entry.isEnemy && String(entry.id) !== String(hero?.id)),
        heroId: String(hero?.id ?? ''),
        hero: { x: Number(hero?.mapPosition?.gridX) || 0, y: Number(hero?.mapPosition?.gridY) || 0 },
        party: members.map(m => `${m.id}:${m.mapPosition?.gridX},${m.mapPosition?.gridY}`),
        // La ficha de un enemigo lleva de id su puesto en la lista, en negativo (-1, -2…).
        foes: (enc?.enemies ?? []).map((/** @type {any} */ e, /** @type {number} */ i) => ({ e, i })).filter(({ e }) => (Number(e.currentHp) || 0) > 0)
            .map(({ e, i }) => ({ id: String(-(i + 1)), instance: String(e.instanceId), name: String(e.name), x: Number(e.gridX), y: Number(e.gridY) })),
        spent: Number(enc?.turnState?.movementSpentFeet) || 0,
        action: Boolean(enc?.turnState?.actionUsed),
    };
});

/**
 * Hasta que le toque al héroe: pasa los dados; el turno de un compañero, que lo juegue solo.
 *
 * @param {Game} g
 * @param {number} [ms]
 */
async function heroTurn(g, ms = 60000) {
    return g.until(async () => {
        await clearDice(g);
        await dropToasts(g);
        const now = await fightState(g);
        if (!now.fighting) return true;
        if (now.ally) {
            await g.page.evaluate(() => /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .gs-vtt-bar .gs-btn-auto, #game-shell .gs-vtt-bar .gs-btn-end'))?.click());
            await g.page.waitForTimeout(400);
        }
        return now.mine;
    }, ms);
}

/**
 * La caja de un elemento (o null si no se ve).
 *
 * @param {Game} g
 * @param {string} selector
 */
const boxOf = (g, selector) => g.page.evaluate((s) => {
    const n = document.querySelector(s);
    const r = n?.getBoundingClientRect();
    return r && r.width > 0 && r.height > 0 ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height, x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
}, selector);

/**
 * Pulsar en un punto de la pantalla: con el ratón o con el dedo.
 *
 * @param {Game} g
 * @param {number} x
 * @param {number} y
 */
const tapAt = (g, x, y) => (g.touch ? g.page.touchscreen.tap(x, y) : g.page.mouse.click(x, y));

/**
 * El tablero: la vista, lo que tapa el HUD y el centro de lo que se mira (sin la columna de la
 * derecha ni la barra de abajo, si van encima del tablero), y dónde está cada ficha en pantalla.
 *
 * @param {Game} g
 */
const boardView = (g) => g.page.evaluate(() => {
    const view = document.querySelector('#game-shell .wm-container')?.getBoundingClientRect();
    if (!view) return null;
    // Lo que se mira, como lo cuenta el juego (`lookRect` de world-map-renderer.js): sin la
    // columna de la derecha; en el teléfono, por debajo de lo de arriba y por encima de lo de abajo;
    // y por encima de la barra.
    const rectOf = (/** @type {string} */ s) => document.querySelector(s)?.getBoundingClientRect();
    const column = rectOf('#game-shell .vtt-top-right');
    let right = view.right;
    let bottom = view.bottom;
    let top = view.top;
    if (column && column.width > 0 && column.height > 0) {
        if (column.left > view.left + view.width / 2 && column.height > view.height * 0.3) right = column.left - 8;
        else if (column.width > view.width / 2) {
            let lowest = column.bottom;
            for (const s of ['#game-shell .vtt-top-left', '#game-shell .vtt-top-center']) {
                const r = rectOf(s);
                if (r && r.height > 0 && r.top < view.top + view.height / 2) lowest = Math.max(lowest, r.bottom);
            }
            top = Math.max(top, lowest + 6);
            const low = rectOf('#game-shell .vtt-bottom-left');
            if (low && low.height > 0 && low.top > view.top + view.height / 2) bottom = Math.min(bottom, low.top - 6);
        }
    }
    for (const node of document.querySelectorAll('.gs-root .gs-actions')) {
        const bar = node.getBoundingClientRect();
        if (bar.width > 0 && bar.height > 0 && bar.top < view.bottom && bar.bottom > view.top + view.height / 2) bottom = Math.min(bottom, bar.top - 8);
    }
    const content = rectOf('#game-shell .wm-content');
    const tokens = [...document.querySelectorAll('#game-shell .wm-token[data-token-id]')].map(n => {
        const r = n.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        const hit = document.elementFromPoint(x, y);
        return {
            id: String(n.getAttribute('data-token-id')), enemy: n.classList.contains('wm-token-enemy'), x, y,
            inView: x >= view.left && x <= view.right && y >= view.top && y <= view.bottom,
            // En lo que se mira (sin lo que tapan las islas): fuera de ahí sale el marcador de borde.
            inLook: x >= view.left && x <= right && y >= top && y <= bottom,
            covered: !(hit && n.contains(hit)),
            under: hit ? String(hit.className || hit.tagName).slice(0, 60) : '',
        };
    });
    return {
        view: { left: view.left, top: view.top, right: view.right, bottom: view.bottom, width: view.width, height: view.height },
        look: { left: view.left, top, right, bottom, x: (view.left + right) / 2, y: (top + bottom) / 2, width: right - view.left, height: bottom - top },
        board: content ? { left: content.left, top: content.top, right: content.right, bottom: content.bottom } : null,
        tokens,
    };
});

/**
 * Si una ficha está en el centro de lo que se mira, o tan cerca como deja el borde del tablero
 * (la cámara no enseña vacío por fuera de un tablero más grande que la vista).
 *
 * @param {any} v Lo que da `boardView`.
 * @param {any} t La ficha.
 */
function centredIn(v, t) {
    const L = v?.look;
    if (!L || !t) return { ok: false, dx: 9999, dy: 9999, tol: 0, clamped: '' };
    const tol = Math.max(48, 0.12 * Math.min(L.width, L.height));
    const dx = Math.round(t.x - L.x);
    const dy = Math.round(t.y - L.y);
    const b = v.board;
    // Hasta dónde deja el borde: si para centrarla habría que enseñar vacío, vale lo que hay.
    const clampX = Boolean(b && ((dx < -tol && b.left >= L.left - 2) || (dx > tol && b.right <= L.right + 2)));
    const clampY = Boolean(b && ((dy < -tol && b.top >= L.top - 2) || (dy > tol && b.bottom <= L.bottom + 2)));
    const ok = t.inView && !t.covered && (Math.abs(dx) <= tol || clampX) && (Math.abs(dy) <= tol || clampY);
    return { ok, dx, dy, tol: Math.round(tol), clamped: `${clampX ? 'x' : ''}${clampY ? 'y' : ''}` };
}

/**
 * Un punto del tablero donde no hay HUD, ni ficha, ni casilla encendida (para arrastrar sin pulsar
 * nada); si no lo hay sin casilla encendida, uno sin ficha ni HUD.
 *
 * @param {Game} g
 * @param {{fx?: number, fy?: number}} [prefer] Por dónde buscar primero (fracciones de la vista).
 */
const emptyPoint = (g, prefer = {}) => g.page.evaluate((p) => {
    const box = document.querySelector('#game-shell .wm-container');
    const r = box?.getBoundingClientRect();
    if (!box || !r) return null;
    /** @type {{x: number, y: number}|null} */
    let fallback = null;
    const xs = [];
    const ys = [];
    for (let f = 0.1; f <= 0.9; f += 0.05) {
        xs.push(f);
        ys.push(f);
    }
    if (p.fx !== undefined) xs.sort((a, b) => Math.abs(a - Number(p.fx)) - Math.abs(b - Number(p.fx)));
    if (p.fy !== undefined) ys.sort((a, b) => Math.abs(a - Number(p.fy)) - Math.abs(b - Number(p.fy)));
    for (const fy of ys) {
        for (const fx of xs) {
            const x = r.left + r.width * fx;
            const y = r.top + r.height * fy;
            const stack = document.elementsFromPoint(x, y);
            const hit = stack[0];
            if (!hit || !box.contains(hit) || hit.closest('.wm-token, .vtt-island, .vtt-edge, .gs-vtt-bar, .gs-grimoire')) continue;
            if (stack.some(n => n.matches?.('.wm-highlight-clickable'))) {
                fallback = fallback ?? { x, y };
                continue;
            }
            return { x, y, lit: false };
        }
    }
    return fallback ? { ...fallback, lit: true } : null;
}, prefer);

/**
 * Arrastrar el tablero (ratón, o un dedo con eventos de puntero) desde un punto vacío.
 *
 * @param {Game} g
 * @param {number} dx
 * @param {number} dy
 */
async function dragBoard(g, dx, dy) {
    const from = await emptyPoint(g, { fx: dx > 0 ? 0.2 : 0.8, fy: dy > 0 ? 0.25 : 0.75 });
    if (!from) return false;
    if (g.touch) {
        await g.page.evaluate(({ start, move }) => {
            const board = document.querySelector('#game-shell .wm-container');
            if (!board) return;
            const fire = (/** @type {string} */ type, /** @type {number} */ x, /** @type {number} */ y) => board.dispatchEvent(new PointerEvent(type, {
                pointerId: 71, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true,
            }));
            fire('pointerdown', start.x, start.y);
            for (let i = 1; i <= 8; i++) fire('pointermove', start.x + (move.dx * i) / 8, start.y + (move.dy * i) / 8);
            fire('pointerup', start.x + move.dx, start.y + move.dy);
        }, { start: from, move: { dx, dy } });
    } else {
        await g.page.mouse.move(from.x, from.y);
        await g.page.mouse.down();
        for (let i = 1; i <= 8; i++) await g.page.mouse.move(from.x + (dx * i) / 8, from.y + (dy * i) / 8);
        await g.page.mouse.up();
    }
    await g.page.waitForTimeout(450);
    return true;
}

/**
 * Pulsar un botón de la cámara (si está) unas cuantas veces.
 *
 * @param {Game} g
 * @param {string} which `in`, `out`, `center`.
 * @param {number} times
 */
async function camera(g, which, times = 1) {
    for (let i = 0; i < times; i++) {
        const b = await boxOf(g, `#game-shell .vtt-cam-btn[data-cam="${which}"]`);
        if (!b) return false;
        await tapAt(g, b.x, b.y);
        await g.page.waitForTimeout(220);
    }
    await g.page.waitForTimeout(400);
    return true;
}

/** @param {Game} g */
const closeMenus = async (g) => {
    for (let i = 0; i < 3; i++) {
        if (await g.page.locator('#game-shell .gs-grimoire').count() === 0) return;
        await g.page.evaluate(() => /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .gs-grimoire .gs-targets-close'))?.click());
        await g.page.waitForTimeout(250);
    }
};

/**
 * Lo que hay en la fila de fichas y en los botones a la vista (para «Iniciar combate» y las
 * fichas que no son del tablero).
 *
 * @param {Game} g
 */
const visibleButtons = (g) => g.page.evaluate(() => {
    const seen = (/** @type {Element} */ n) => {
        const r = n.getBoundingClientRect();
        return r.width > 1 && r.height > 1 && getComputedStyle(n).visibility !== 'hidden';
    };
    return {
        chips: [...document.querySelectorAll('#game-shell .gs-chip-action, #game-shell .gs-chip')].filter(seen).map(c => (c.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
        buttons: [...document.querySelectorAll('#game-shell button, #game-shell .menu_button, .wm-start-combat, .wm-fight-btn')].filter(seen).map(c => (c.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
        scene: document.querySelector('#game-shell')?.getAttribute('data-scene') || '',
    };
});
const START_CHIP = /Iniciar combate|Evitar la pelea/i;
const FOREIGN_CHIP = /^(Saltar la prueba|Hablar con .+|Escuchar rumores|Tirada)$/i;

// ------------------------------------------------------------------ C1: sin barras de desplazamiento
/**
 * Nada se desplaza: ni la página ni el escenario; y el tablero ocupa el escenario entero.
 *
 * @param {Game} g
 */
const scrollState = (g) => g.page.evaluate(() => {
    const doc = document.documentElement;
    const stage = document.querySelector('#game-shell .gs-stage');
    const view = document.querySelector('#game-shell .wm-container')?.getBoundingClientRect();
    const box = stage?.getBoundingClientRect();
    // Una barra de verdad: algo que se desplaza (auto/scroll) y es grande (no la lista del resumen
    // ni el cuerpo de un menú, que pueden desplazarse dentro de su isla).
    const scrolling = [...document.querySelectorAll('#game-shell *')].filter(n => {
        if (!(n instanceof HTMLElement) || n.closest('.vtt-island, .gs-grimoire, .wm-content, .cv-place, dialog')) return false;
        const s = getComputedStyle(n);
        const r = n.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return false;
        const y = /(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 1;
        const x = /(auto|scroll)/.test(s.overflowX) && n.scrollWidth > n.clientWidth + 1;
        return y || x;
    });
    const said = (/** @type {HTMLElement} */ n) => `${String(n.className).slice(0, 50)} (${n.scrollWidth}x${n.scrollHeight} en ${n.clientWidth}x${n.clientHeight})`;
    // Lo que se desliza sin barra a la vista (`scrollbar-width: none`, como la fila de botones de
    // la cabecera tumbado) no es una barra: se dice aparte, porque deja cosas sin ver.
    const bars = scrolling.filter(n => getComputedStyle(n).scrollbarWidth !== 'none').map(n => said(/** @type {HTMLElement} */ (n)));
    const sliders = scrolling.filter(n => getComputedStyle(n).scrollbarWidth === 'none').map(n => said(/** @type {HTMLElement} */ (n)));
    const stageStyle = stage ? getComputedStyle(stage) : null;
    return {
        page: doc.scrollWidth > window.innerWidth + 1 || doc.scrollHeight > window.innerHeight + 1
            || document.body.scrollWidth > window.innerWidth + 1 || document.body.scrollHeight > window.innerHeight + 1,
        pageSize: `${doc.scrollWidth}x${doc.scrollHeight} en ${window.innerWidth}x${window.innerHeight}`,
        stageOverflow: stage ? `${stageStyle?.overflowX}/${stageStyle?.overflowY} ${stage.scrollWidth}x${stage.scrollHeight} en ${stage.clientWidth}x${stage.clientHeight}` : 'sin escenario',
        stageScrolls: stage ? (stage.scrollHeight > stage.clientHeight + 1 || stage.scrollWidth > stage.clientWidth + 1) : true,
        stageScrolled: stage ? stage.scrollTop !== 0 || stage.scrollLeft !== 0 : false,
        bars,
        sliders,
        fills: Boolean(view && box && Math.abs(view.left - box.left) <= 2 && Math.abs(view.right - box.right) <= 2 && Math.abs(view.top - box.top) <= 2 && Math.abs(view.bottom - box.bottom) <= 2),
        view: view ? [Math.round(view.left), Math.round(view.top), Math.round(view.width), Math.round(view.height)] : null,
        stage: box ? [Math.round(box.left), Math.round(box.top), Math.round(box.width), Math.round(box.height)] : null,
    };
});

// ------------------------------------------------------------------ C1b: la cabecera y la pantalla
/** @param {Game} g */
const hudPlacement = (g) => g.page.evaluate(() => {
    const head = document.querySelector('#game-shell .gs-head');
    const hr = head?.getBoundingClientRect();
    const headBottom = hr && hr.height > 0 && getComputedStyle(head).visibility !== 'hidden' ? hr.bottom : 0;
    const items = [...document.querySelectorAll('#game-shell .vtt-island, #game-shell .vtt-edge, #game-shell .gs-actions-vtt .gs-vtt-bar')].map(n => {
        const r = n.getBoundingClientRect();
        return { cls: String(n.className).slice(0, 60), left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom), w: r.width, h: r.height };
    }).filter(i => i.w > 1 && i.h > 1);
    return {
        headBottom: Math.round(headBottom),
        overHead: items.filter(i => i.top < headBottom - 1 && i.bottom > 0).map(i => `${i.cls} top ${i.top}`),
        outside: items.filter(i => i.left < -1 || i.top < -1 || i.right > window.innerWidth + 1 || i.bottom > window.innerHeight + 1).map(i => `${i.cls} [${i.left},${i.top},${i.right},${i.bottom}]`),
        // Islas que se tapan entre sí (un menú cerrado no cuenta).
        overlap: items.flatMap((a, i) => items.slice(i + 1).filter(b => !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top))
            .filter(b => !a.cls.includes('vtt-edge') && !b.cls.includes('vtt-edge'))
            .map(b => `${a.cls.split(' ')[0]} × ${b.cls.split(' ')[0]}`)),
        count: items.length,
    };
});

// ------------------------------------------------------------------ C8: el contraste, con los colores calculados
/**
 * Cada texto del HUD contra lo que tiene detrás, con los colores calculados (fondos con su
 * transparencia, degradados por su peor parada, la opacidad de los de encima). Detrás de una isla
 * transparente está el tablero: se mira contra el fondo de la página y contra un verde de hierba
 * claro, y cuenta el peor. Lo apagado (`disabled`) no cuenta (WCAG lo deja fuera), pero se dice.
 *
 * @param {Game} g
 * @param {string} roots
 */
const contrastAudit = (g, roots) => g.page.evaluate((rootSelector) => {
    /** @param {string} s */
    const parse = (s) => {
        if (!s || s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
        let m = /rgba?\(([^)]+)\)/.exec(s);
        if (m) {
            const p = m[1].split(/[\s,/]+/).filter(Boolean).map(v => (v.endsWith('%') ? Number(v.slice(0, -1)) / 100 : Number(v)));
            return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
        }
        m = /color\(srgb ([^)]+)\)/.exec(s);
        if (m) {
            const p = m[1].split(/[\s/]+/).filter(Boolean).map(Number);
            return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p.length > 3 ? p[3] : 1 };
        }
        return null;
    };
    /** @param {{r: number, g: number, b: number, a: number}} top @param {{r: number, g: number, b: number}} under */
    const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
    /** @param {{r: number, g: number, b: number}} c */
    const lum = (c) => {
        const ch = (/** @type {number} */ v) => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
    };
    /** @param {any} a @param {any} b */
    const ratio = (a, b) => {
        const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
        return (x + 0.05) / (y + 0.05);
    };
    const hex = (/** @type {any} */ c) => `#${[c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
    const backdrops = [{ r: 12, g: 10, b: 8 }, { r: 122, g: 150, b: 86 }];
    const seen = (/** @type {Element} */ n) => {
        const r = n.getBoundingClientRect();
        const s = getComputedStyle(n);
        return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.02;
    };
    /** @type {any[]} */
    const fails = [];
    let checked = 0;
    let disabled = 0;
    let worst = 99;
    const roots = [...document.querySelectorAll(rootSelector)].filter(seen);
    const done = new Set();
    for (const root of roots) {
        for (const node of [root, ...root.querySelectorAll('*')]) {
            if (done.has(node) || !(node instanceof HTMLElement)) continue;
            done.add(node);
            const own = [...node.childNodes].filter(c => c.nodeType === 3).map(c => c.textContent || '').join('').replace(/\s+/g, ' ').trim();
            if (!own || !seen(node) || node.closest('.vtt-sr, .sr-only, [aria-hidden="true"] .vtt-sr')) continue;
            const box = node.getBoundingClientRect();
            if (box.right < 0 || box.bottom < 0 || box.left > window.innerWidth || box.top > window.innerHeight) continue;
            if (node.closest('button:disabled, [aria-disabled="true"], .disabled, .is-disabled')) {
                disabled++;
                continue;
            }
            // De la pieza al fondo: los fondos que tiene debajo, hasta uno opaco.
            /** @type {Array<{bg: any, stops: any[]}>} */
            const layers = [];
            let alpha = 1;
            let opaque = false;
            for (let n = /** @type {Element|null} */ (node); n; n = n.parentElement) {
                const s = getComputedStyle(n);
                alpha *= Number(s.opacity) || 1;
                const bg = parse(s.backgroundColor) ?? { r: 0, g: 0, b: 0, a: 0 };
                const stops = /gradient/.test(s.backgroundImage) ? (s.backgroundImage.match(/rgba?\([^)]+\)|color\(srgb [^)]+\)/g) ?? []).map(parse).filter(Boolean) : [];
                layers.push({ bg, stops });
                if (bg.a >= 0.999 && stops.length === 0) {
                    opaque = true;
                    break;
                }
                if (stops.length > 0 && stops.every((/** @type {any} */ c) => c.a >= 0.999)) {
                    opaque = true;
                    break;
                }
            }
            const style = getComputedStyle(node);
            const fg0 = parse(style.color) ?? { r: 255, g: 255, b: 255, a: 1 };
            const size = parseFloat(style.fontSize) || 16;
            const weight = Number(style.fontWeight) || 400;
            const large = size >= 24 || (size >= 18.66 && weight >= 700);
            const need = large ? 3 : 4.5;
            let low = 99;
            let pair = { fg: '', bg: '' };
            for (const base of opaque ? [backdrops[0]] : backdrops) {
                // Cada combinación de paradas de los degradados: se queda la peor.
                /** @type {any[]} */
                let under = [base];
                for (const layer of [...layers].reverse()) {
                    const next = [];
                    for (const u of under) {
                        const withBg = over(layer.bg, u);
                        if (layer.stops.length === 0) next.push(withBg);
                        else for (const stop of layer.stops) next.push(over(stop, withBg));
                    }
                    under = next.slice(0, 32);
                }
                for (const bgc of under) {
                    const fg = over({ ...fg0, a: fg0.a * alpha }, bgc);
                    const r = ratio(fg, bgc);
                    if (r < low) {
                        low = r;
                        pair = { fg: hex(fg), bg: hex(bgc) };
                    }
                }
            }
            checked++;
            worst = Math.min(worst, low);
            if (low < need) {
                const island = node.closest('.vtt-island, .vtt-edge, .gs-vtt-bar, .gs-grimoire, .cv-place');
                fails.push({
                    text: own.slice(0, 40), cls: `${String(node.className || node.tagName).slice(0, 50)} en ${String(island?.className || '').split(' ').slice(0, 2).join(' ')}`,
                    fg: pair.fg, bg: pair.bg, ratio: Math.round(low * 100) / 100, need, size: Math.round(size * 10) / 10, opaque,
                });
            }
        }
    }
    return { checked, disabled, worst: Math.round(worst * 100) / 100, fails };
}, roots);
const HUD_ROOTS = '#game-shell .vtt-island, #game-shell .vtt-edge, #game-shell .gs-actions-vtt .gs-vtt-bar, #game-shell .gs-grimoire';

// ------------------------------------------------------------------ C5, C6, C7: los menús
/** @param {Game} g */
const menuView = (g) => g.page.evaluate(() => {
    const menu = document.querySelector('#game-shell .gs-grimoire');
    if (!menu) return null;
    const r = menu.getBoundingClientRect();
    const head = document.querySelector('#game-shell .gs-head');
    const hr = head?.getBoundingClientRect();
    const headBottom = hr && hr.height > 0 && getComputedStyle(head).visibility !== 'hidden' ? hr.bottom : 0;
    const body = menu.querySelector('.gs-grimoire-body');
    const cards = [...menu.querySelectorAll('.gs-card')].map(c => {
        const cr = c.getBoundingClientRect();
        const br = body?.getBoundingClientRect();
        return {
            pick: c.getAttribute('data-pick') || '',
            name: (c.querySelector('.gs-card-name-text')?.textContent || '').trim(),
            tags: [...c.querySelectorAll('.gs-tag-mastery, .gs-tag-dc, .gs-tag-plain')].map(t => (t.textContent || '').trim()),
            badges: [...c.querySelectorAll('.gs-card-badge')].map(t => (t.textContent || '').trim()),
            off: /** @type {HTMLButtonElement} */ (c).disabled === true,
            // Se ve sin desplazar el menú.
            shown: Boolean(br && cr.top >= br.top - 1 && cr.bottom <= br.bottom + 1),
        };
    });
    return {
        id: menu.getAttribute('data-menu') || '',
        box: { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom), height: Math.round(r.height), width: Math.round(r.width) },
        headBottom: Math.round(headBottom),
        vw: window.innerWidth,
        vh: window.innerHeight,
        title: (menu.querySelector('.gs-grimoire-title')?.textContent || '').trim(),
        head: [...menu.querySelectorAll('.gs-head-action')].map(h => `${(h.textContent || '').trim()}${/** @type {HTMLButtonElement} */ (h).disabled ? ' (apagado)' : ''}`),
        sections: [...menu.querySelectorAll('.gs-grimoire-section')].map(s => (s.textContent || '').trim()),
        cards,
        gems: menu.querySelectorAll('.gs-slot-gems .fa-diamond').length,
        gemsSpent: menu.querySelectorAll('.gs-slot-gems .gs-slot-gem-spent').length,
        slots: (menu.querySelector('.gs-slot-gems')?.textContent || '').replace(/\s+/g, ' ').trim(),
        filters: [...menu.querySelectorAll('.gs-filter-pill[data-filter]')].map(f => (f.textContent || '').trim()),
        ft: /\bft\b/.test(menu.textContent || ''),
    };
});

/**
 * Abrir un menú de la barra pulsando su botón (ratón o dedo). Devuelve si estaba apagado.
 *
 * @param {Game} g
 * @param {string} id
 */
async function openMenu(g, id) {
    await closeMenus(g);
    const state = await g.page.evaluate((m) => {
        const b = /** @type {HTMLButtonElement|null} */ (document.querySelector(`#game-shell .gs-vtt-bar .gs-btn[data-menu="${m}"]`));
        if (!b) return 'falta';
        return b.disabled ? 'apagado' : 'ok';
    }, id);
    if (state !== 'ok') return state;
    const b = await boxOf(g, `#game-shell .gs-vtt-bar .gs-btn[data-menu="${id}"]`);
    if (!b) return 'no se ve';
    await tapAt(g, b.x, b.y);
    await g.until(async () => await g.page.locator(`#game-shell .gs-grimoire[data-menu="${id}"]`).count() > 0, 4000);
    await g.page.waitForTimeout(300);
    return 'ok';
}

// ------------------------------------------------------------------ el héroe: elegirlo y saber dónde está
/** @param {Game} g */
const litCount = (g) => g.page.evaluate(() => document.querySelectorAll('#game-shell .wm-highlight-move.wm-highlight-clickable').length);

/**
 * Que se enciendan sus casillas: si no lo están, pulsar su ficha (centrándola antes si no se ve).
 *
 * @param {Game} g
 * @param {string} heroId
 */
async function selectHero(g, heroId) {
    if (await litCount(g) > 0) return true;
    let me = (await boardView(g))?.tokens.find(t => t.id === heroId);
    if (!me || me.covered || !me.inView) {
        await camera(g, 'center');
        me = (await boardView(g))?.tokens.find(t => t.id === heroId);
    }
    if (!me || me.covered || !me.inView) return false;
    await tapAt(g, me.x, me.y);
    await g.page.waitForTimeout(450);
    return (await litCount(g)) > 0;
}

// ------------------------------------------------------------------ C2: Espacio
/**
 * @param {Game} g
 * @param {string} size
 * @param {string} heroId
 */
async function checkSpace(g, size, heroId) {
    await camera(g, 'in', 6);
    const before = await boardView(g);
    const look = before?.look;
    // Lejos de quien tiene el turno: arrastrar la vista hasta que no esté en el centro.
    const me0 = before?.tokens.find(t => t.id === heroId);
    if (look && me0) await dragBoard(g, me0.x < look.x ? -look.width * 0.35 : look.width * 0.35, me0.y < look.y ? -look.height * 0.3 : look.height * 0.3);
    const away = await boardView(g);
    const meAway = away?.tokens.find(t => t.id === heroId);
    // En el teléfono no hay teclado: lo mismo con el botón «Centrar» (la mira).
    if (g.touch) await camera(g, 'center');
    else {
        await g.page.evaluate(() => /** @type {HTMLElement|null} */ (document.activeElement)?.blur?.());
        await g.page.keyboard.press('Space');
        await g.page.waitForTimeout(800);
    }
    const after = await boardView(g);
    const me = after?.tokens.find(t => t.id === heroId);
    const L = after?.look;
    const c = centredIn(after, me);
    const movedAway = Boolean(meAway && away && (Math.abs(meAway.x - away.look.x) > c.tol || Math.abs(meAway.y - away.look.y) > c.tol || !meAway.inView));
    const file = await shot(g, size, 'espacio');
    note('C2', g.scene, size, c.ok && movedAway,
        { con: g.touch ? 'el botón «Centrar» (sin teclado)' : 'Espacio', antes: meAway && away ? { dx: Math.round(meAway.x - away.look.x), dy: Math.round(meAway.y - away.look.y), seVe: meAway.inView } : null, despues: { dx: c.dx, dy: c.dy, tapada: me?.covered, bajo: me?.under, alBorde: c.clamped }, tolerancia: c.tol, lejosAntes: movedAway, libre: L && { top: Math.round(L.top), bottom: Math.round(L.bottom), left: Math.round(L.left), right: Math.round(L.right) } }, file);
}

// ------------------------------------------------------------------ C3: los marcadores de borde
/**
 * @param {Game} g
 * @param {string} size
 * @param {string} heroId
 */
async function checkEdge(g, size, heroId) {
    await camera(g, 'in', 6);
    await camera(g, 'center');
    const st = await fightState(g);
    const foe = st.foes[0];
    if (!foe) {
        note('C3', g.scene, size, null, 'no queda ningún enemigo en pie');
        return;
    }
    // Empujar la vista lejos del enemigo hasta que no se vea (fuera de lo que se mira).
    /** @type {any[]} */
    const drags = [];
    for (let i = 0; i < 5; i++) {
        const v = await boardView(g);
        const t = v?.tokens.find(x => x.id === foe.id);
        if (!v || !t) break;
        if (!t.inLook) break;
        const dx = t.x <= v.look.x ? v.view.width * 0.45 : -v.view.width * 0.45;
        const dy = t.y <= v.look.y ? v.view.height * 0.4 : -v.view.height * 0.4;
        // Se arrastra en la dirección que lo saca: el tablero se lleva al enemigo hacia fuera.
        const did = await dragBoard(g, -dx, -dy);
        const after = await boardView(g);
        drags.push({ arrastre: [Math.round(-dx), Math.round(-dy)], hecho: did, tablero: [v.board, after?.board].map(b => b && [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]) });
    }
    const out = await boardView(g);
    const foeOut = out?.tokens.find(x => x.id === foe.id);
    const edges = await g.page.evaluate(() => [...document.querySelectorAll('#game-shell .vtt-edge')].map(e => {
        const r = e.getBoundingClientRect();
        // Si el texto no cabe (puntos suspensivos), lo que se ve no dice los pies.
        const label = e.querySelector('.vtt-edge-text') ?? e;
        return {
            text: (e.textContent || '').replace(/\s+/g, ' ').trim(), id: e.getAttribute('data-token-id') || '', x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height,
            cut: label.scrollWidth > label.clientWidth + 1,
        };
    }));
    const file = await shot(g, size, 'borde');
    const mine = edges.find(e => e.id === foe.id) ?? edges.find(e => e.text.startsWith(foe.name.replace(/ \d+$/, '')));
    const textOk = Boolean(mine && /· \d+ pies$/.test(mine.text) && !/\bft\b/.test(mine.text) && !mine.cut);
    if (!foeOut || foeOut.inLook) {
        // Un tablero que cabe entero en lo que se mira no deja a nadie fuera: no hay qué mirar.
        const b = out?.board;
        const L = out?.look;
        const fits = Boolean(b && L && b.left >= L.left - 2 && b.right <= L.right + 2 && b.top >= L.top - 2 && b.bottom <= L.bottom + 2);
        note('C3', g.scene, size, fits ? null : false, { porque: fits ? 'el tablero cabe entero en lo que se mira' : 'no se pudo sacar al enemigo de lo que se mira arrastrando el tablero', foe, foeOut, edges, drags, libre: L && [Math.round(L.left), Math.round(L.top), Math.round(L.right), Math.round(L.bottom)] }, file);
        return;
    }
    if (!mine) {
        note('C3', g.scene, size, false, { porque: 'el enemigo está fuera de la vista y no sale su marcador', foe: foe.name, foeOut, edges }, file);
        return;
    }
    await tapAt(g, mine.x, mine.y);
    await g.page.waitForTimeout(900);
    const back = await boardView(g);
    const t = back?.tokens.find(x => x.id === foe.id);
    const c = centredIn(back, t);
    const file2 = await shot(g, size, 'borde-pulsado');
    note('C3', g.scene, size, textOk && c.ok, {
        marcador: mine.text, formato: textOk, cortado: mine.cut, ancho: Math.round(mine.w), centrado: c.ok,
        despues: { dx: c.dx, dy: c.dy, tapado: t?.covered, bajo: t?.under, alBorde: c.clamped }, tolerancia: c.tol,
    }, `${file} ${file2}`.trim());
    await g.page.evaluate(() => /** @type {HTMLElement|null} */ (document.activeElement)?.blur?.());
    void heroId;
}

// ------------------------------------------------------------------ C4: el alcance
/**
 * @param {Game} g
 * @param {string} size
 * @param {string} heroId
 */
async function checkReach(g, size, heroId) {
    await camera(g, 'center');
    const st0 = await fightState(g);
    const v = await boardView(g);
    const me = v?.tokens.find(t => t.id === heroId);
    if (!me || me.covered || !me.inView) {
        note('C4', g.scene, size, false, { porque: 'tu ficha no se ve o la tapa el HUD tras «Centrar»', me });
        return;
    }
    const reach = () => g.page.evaluate(async () => {
        const layer = document.querySelector('#game-shell .vtt-reach-layer.on');
        const cells = [...document.querySelectorAll('#game-shell .vtt-reach-layer.on .vtt-reach-cell')];
        const content = /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .wm-content'));
        const board = (await import('/scripts/party/board.js')).getActiveBoardContext();
        const cw = content ? content.offsetWidth / (Number(board.gridWidth) || 1) : 0;
        const ch = content ? content.offsetHeight / (Number(board.gridHeight) || 1) : 0;
        const sea = cells.filter(c => {
            const s = /** @type {HTMLElement} */ (c).style;
            const x = Math.round(parseFloat(s.left) / cw);
            const y = Math.round(parseFloat(s.top) / ch);
            return board.terrain?.cells?.[`${x},${y}`]?.type === 'deep_water';
        }).length;
        const lit = document.querySelectorAll('#game-shell .wm-highlight-move.wm-highlight-clickable').length;
        const color = cells[0] ? getComputedStyle(cells[0]).backgroundColor : '';
        return { on: Boolean(layer), cells: cells.length, lit, sea, color };
    });
    // Sin la ficha elegida (si lo está, sus casillas ya se ven: pulsarla la suelta).
    const picked = await g.page.evaluate((id) => Boolean(document.querySelector(`#game-shell .wm-token.wm-token-selected[data-token-id="${id}"]`)), heroId);
    if (picked) {
        await tapAt(g, me.x, me.y);
        await g.page.waitForTimeout(450);
    }
    const unpicked = await g.page.evaluate((id) => !document.querySelector(`#game-shell .wm-token.wm-token-selected[data-token-id="${id}"]`), heroId);
    if (g.touch) {
        // En el teléfono, el primer toque en tu ficha.
        const lit0 = await litCount(g);
        await tapAt(g, me.x, me.y);
        await g.page.waitForTimeout(500);
        const r = await reach();
        const st1 = await fightState(g);
        const file = await shot(g, size, 'alcance');
        const blue = /rgba?\((\d+), (\d+), (\d+)/.exec(r.color);
        const isBlue = !r.color || Boolean(blue && Number(blue[3]) > Number(blue[1]) + 40);
        note('C4', g.scene, size, (r.cells > 0 || r.lit > 0) && isBlue && st1.hero.x === st0.hero.x && st1.hero.y === st0.hero.y,
            { antes: lit0, ...r, elegidaAntes: picked, soltada: unpicked, seMovio: st1.hero.x !== st0.hero.x || st1.hero.y !== st0.hero.y }, file);
        return;
    }
    // Con el ratón: primero fuera, luego encima, sin pulsar.
    const away = await emptyPoint(g, { fx: 0.15, fy: 0.3 });
    if (away) await g.page.mouse.move(away.x, away.y);
    await g.page.waitForTimeout(250);
    await g.page.mouse.move(me.x, me.y, { steps: 4 });
    await g.page.waitForTimeout(450);
    const r = await reach();
    const file = await shot(g, size, 'alcance');
    if (away) await g.page.mouse.move(away.x, away.y, { steps: 3 });
    await g.page.waitForTimeout(350);
    const off = await reach();
    const st1 = await fightState(g);
    const blue = /rgba?\((\d+), (\d+), (\d+)/.exec(r.color);
    const isBlue = Boolean(blue && Number(blue[3]) > Number(blue[1]) + 40 && Number(blue[3]) > Number(blue[2]));
    note('C4', g.scene, size, r.on && r.cells > 0 && isBlue && !off.on && st1.hero.x === st0.hero.x && st1.hero.y === st0.hero.y,
        { encima: r, fuera: { on: off.on, cells: off.cells }, azul: isBlue, elegidaAntes: picked, soltada: unpicked, seMovio: st1.hero.x !== st0.hero.x || st1.hero.y !== st0.hero.y }, file);
    if (r.sea > 0) note('V3', g.scene, size, false, { porque: 'el alcance al pasar el ratón enciende casillas de agua honda', mar: r.sea });
}

// ------------------------------------------------------------------ C9: los clics fantasma
/**
 * Pulsar cada botón del HUD (lo que no gasta el turno) con las casillas de tu ficha encendidas, y
 * mirar que no se mueve nadie. Se dice si debajo había una casilla encendida (es cuando se nota).
 *
 * @param {Game} g
 * @param {string} size
 * @param {string} heroId
 */
async function checkGhost(g, size, heroId) {
    await closeMenus(g);
    await camera(g, 'in', 3);
    await camera(g, 'center');
    /** @type {any[]} */
    const tried = [];
    const where = (/** @type {string} */ selector, /** @type {number} */ index) => g.page.evaluate(({ s, i }) => {
        const n = document.querySelectorAll(s)[i];
        const r = n?.getBoundingClientRect();
        if (!n || !r || r.width < 2 || r.height < 2) return null;
        if (/** @type {HTMLButtonElement} */ (n).disabled) return { off: true };
        const x = r.left + Math.min(r.width / 2, 40);
        const y = r.top + r.height / 2;
        const stack = document.elementsFromPoint(x, y);
        const top = stack[0];
        return {
            x, y, off: false,
            mine: Boolean(top && (n === top || n.contains(top))),
            onTop: top ? String(top.className || top.tagName).slice(0, 50) : '',
            overLit: stack.some(e => e.matches?.('.wm-highlight-move.wm-highlight-clickable')),
            overCell: stack.some(e => e.matches?.('.wm-highlight, .wm-cell, .wm-terrain, .wm-content')),
        };
    }, { s: selector, i: index });
    const count = (/** @type {string} */ s) => g.page.evaluate((sel) => document.querySelectorAll(sel).length, s);
    /**
     * @param {string} label
     * @param {string} selector
     * @param {number} [index]
     * @param {() => Promise<void>} [after]
     */
    const press = async (label, selector, index = 0, after) => {
        const lit = await selectHero(g, heroId);
        const at = await where(selector, index);
        if (!at) return;
        if (at.off) {
            tried.push({ label, skip: 'apagado' });
            return;
        }
        if (!at.mine) {
            tried.push({ label, skip: `tapado por ${at.onTop}` });
            return;
        }
        const before = await fightState(g);
        await tapAt(g, at.x, at.y);
        await g.page.waitForTimeout(450);
        await clearDice(g);
        const now = await fightState(g);
        const moved = now.party.join() !== before.party.join() || JSON.stringify(now.foes) !== JSON.stringify(before.foes) || now.spent !== before.spent;
        tried.push({ label, lit, overLit: at.overLit, moved, ...(moved ? { antes: before.party.join(' '), despues: now.party.join(' '), pies: [before.spent, now.spent] } : {}) });
        if (after) await after();
    };
    await press('cámara: acercar', '#game-shell .vtt-cam-btn[data-cam="in"]');
    await press('cámara: alejar', '#game-shell .vtt-cam-btn[data-cam="out"]');
    await press('cámara: centrar', '#game-shell .vtt-cam-btn[data-cam="center"]');
    await press('cámara: casillas', '#game-shell .vtt-cam-btn[data-cam="grid"]', 0, async () => { await press('cámara: casillas (otra vez)', '#game-shell .vtt-cam-btn[data-cam="grid"]'); });
    await press('minimapa', '#game-shell .vtt-minimap-box');
    await camera(g, 'center');
    const rows = await count('#game-shell .vtt-init .wm-init-row');
    for (let i = 0; i < Math.min(rows, 4); i++) await press(`iniciativa: fila ${i + 1}`, '#game-shell .vtt-init .wm-init-row', i);
    await camera(g, 'center');
    await press('resumen: plegar', '#game-shell .vtt-summary-toggle', 0, async () => { await press('resumen: desplegar', '#game-shell .vtt-summary-toggle'); });
    await press('resumen: una línea', '#game-shell .vtt-summary .cl-row');
    await press('iniciativa: la cabecera', '#game-shell .vtt-init .vtt-init-head');
    await press('barra: el turno y los pies', '#game-shell .gs-vtt-bar .gs-move-label');
    await press('barra: las píldoras', '#game-shell .gs-vtt-bar .gs-pill');
    for (const id of ['atacar', 'acciones', 'adicional', 'magia']) {
        await press(`barra: ${id}`, `#game-shell .gs-vtt-bar .gs-btn[data-menu="${id}"]`, 0, async () => {
            if (await count('#game-shell .gs-grimoire') === 0) return;
            await press(`menú ${id}: el título`, '#game-shell .gs-grimoire .gs-grimoire-title');
            await press(`menú ${id}: una sección`, '#game-shell .gs-grimoire .gs-grimoire-section');
            await press(`menú ${id}: un filtro`, '#game-shell .gs-grimoire .gs-filter-pill[data-filter]', 1);
            await press(`menú ${id}: cerrar`, '#game-shell .gs-grimoire .gs-targets-close');
            await closeMenus(g);
        });
    }
    if (await count('#game-shell .vtt-edge') > 0) await press('marcador de borde', '#game-shell .vtt-edge');
    const moved = tried.filter(t => t.moved);
    const file = await shot(g, size, 'fantasma');
    note('C9', g.scene, size, moved.length === 0 && tried.some(t => !t.skip),
        { movieron: moved, probados: tried.filter(t => !t.skip).length, sobreCasillaEncendida: tried.filter(t => t.overLit).map(t => t.label), saltados: tried.filter(t => t.skip).map(t => `${t.label}: ${t.skip}`) }, file);
}

// ------------------------------------------------------------------ todo lo de un tamaño
/**
 * @param {Game} g
 * @param {string} size
 */
async function sizeSuite(g, size) {
    const [w, h] = size.split('x').map(Number);
    await g.page.setViewportSize({ width: w, height: h });
    await g.page.waitForTimeout(1200);
    await clearDice(g);
    await dropToasts(g);
    await closeMenus(g);
    if (!await heroTurn(g, 30000) || !(await fightState(g)).fighting) {
        note('C1', g.scene, size, null, 'la pelea ya no sigue o no le toca al héroe');
        return;
    }
    const heroId = (await fightState(g)).heroId;
    await camera(g, 'center');
    const base = await shot(g, size, 'turno');
    // C1
    const sc = await scrollState(g);
    note('C1', g.scene, size, !sc.page && sc.bars.length === 0 && sc.fills && !sc.stageScrolled, sc, base);
    // C1b
    const hp = await hudPlacement(g);
    note('C1b', g.scene, size, hp.overHead.length === 0 && hp.outside.length === 0 && hp.count > 0, hp);
    // B1: la barra de la maqueta.
    const barNow = await g.page.evaluate(() => ({
        buttons: [...document.querySelectorAll('#game-shell .gs-vtt-bar .gs-btn')].map(b => (b.querySelector('.gs-btn-label')?.textContent || '').trim()),
        pills: [...document.querySelectorAll('#game-shell .gs-vtt-bar .gs-pill')].map(p => (p.textContent || '').replace('●', '').trim()),
        move: (document.querySelector('#game-shell .gs-vtt-bar .gs-move-label')?.textContent || '').replace(/\s+/g, ' ').trim(),
        prone: (document.querySelector('#game-shell .gs-vtt-bar .gs-prone-toggle')?.getAttribute('title') || '') + (document.querySelector('#game-shell .gs-vtt-bar .gs-prone-toggle')?.textContent || ''),
    }));
    note('B1', g.scene, size, ['Atacar', 'Magia', 'Acciones', 'Adicional', 'Fin de turno', 'Abandonar'].every(b => barNow.buttons.includes(b))
        && !barNow.buttons.some(b => /Hablar|Mascota|Maniobras|Objetivos/.test(b))
        && ['Acción', 'Adicional', 'Reacción'].every(p => barNow.pills.includes(p)) && /^\d+\/\d+ pies$/.test(barNow.move) && /Cuerpo a tierra|Levantarse/i.test(barNow.prone), barNow);
    // C8, sin menú
    const plain = await contrastAudit(g, HUD_ROOTS);
    /** @type {any[]} */
    const contrastFails = [...plain.fails];
    let checked = plain.checked;
    let worst = plain.worst;
    // Los menús
    /** @type {Record<string, any>} */
    const menus = {};
    for (const id of ['atacar', 'magia', 'acciones', 'adicional']) {
        const opened = await openMenu(g, id);
        if (opened !== 'ok') {
            menus[id] = opened;
            continue;
        }
        const m = await menuView(g);
        const file = await shot(g, size, `menu-${id}`);
        menus[id] = m ? { ...m.box, headBottom: m.headBottom, file } : 'no se abrió';
        if (m) {
            const fits = m.box.height <= 440.5 && m.box.top >= Math.max(0, m.headBottom - 1) && m.box.bottom <= m.vh + 1 && m.box.left >= -1 && m.box.right <= m.vw + 1;
            menus[id].fits = fits;
            const c = await contrastAudit(g, '#game-shell .gs-grimoire');
            checked += c.checked;
            worst = Math.min(worst, c.worst);
            contrastFails.push(...c.fails.map((/** @type {any} */ f) => ({ ...f, menu: id })));
            if (id === 'atacar') {
                const golpe = m.cards.find(c2 => c2.pick === 'unarmed:golpe' || /^unarmed:golpe/.test(c2.pick));
                const agarrar = m.cards.find(c2 => /^unarmed:agarrar/.test(c2.pick));
                const empujar = m.cards.find(c2 => /^unarmed:empujar/.test(c2.pick));
                const dc = (/** @type {any} */ c2) => Boolean(c2 && [...c2.tags, ...c2.badges].some((/** @type {string} */ t) => /^CD \d+/.test(t)));
                const damage = Boolean(golpe && golpe.badges.some(b => /\d/.test(b) && /(contundente|daño|\d+d\d+|^\d+\b)/i.test(b)));
                const swap = m.head.some(t => /Cambiar de arma/i.test(t)) || m.cards.some(c2 => /^swap:|^weapon-swap/.test(c2.pick)) || m.sections.some(s => /otras armas/i.test(s));
                // Cambiar de arma solo tiene sentido con dos armas o más.
                const weapons = await g.page.evaluate(async () => {
                    const st = await import('/scripts/party/state.js');
                    const hero = /** @type {any} */ (st.partyMembers[0]);
                    return (hero?.items ?? []).filter((/** @type {any} */ i) => i?.type === 'weapon' || i?.category === 'weapon' || i?.slot === 'weapon').map((/** @type {any} */ i) => String(i.name));
                });
                const seenWithoutScroll = [golpe, agarrar, empujar].filter(Boolean).every(c2 => c2?.shown);
                note('C5', g.scene, size, Boolean(golpe && damage && dc(agarrar) && dc(empujar) && (swap || weapons.length < 2) && !m.ft), {
                    golpe: golpe && { badges: golpe.badges, tags: golpe.tags }, agarrar: agarrar && [...agarrar.tags, ...agarrar.badges], empujar: empujar && [...empujar.tags, ...empujar.badges],
                    cambiarDeArma: m.head, armas: weapons, secciones: m.sections, sinDesplazar: seenWithoutScroll, ft: m.ft,
                }, file);
            }
            if (id === 'magia') {
                note('C6', g.scene, size, m.gems > 0 && ['Todos', 'Trucos'].every(f => m.filters.includes(f)) && m.filters.some(f => /Nivel 1/.test(f)),
                    { gemas: m.gems, gastadas: m.gemsSpent, espacios: m.slots, filtros: m.filters, tarjetas: m.cards.length }, file);
            }
        }
        await closeMenus(g);
    }
    if (menus.atacar && typeof menus.atacar === 'string') note('C5', g.scene, size, false, `el menú de Atacar: ${menus.atacar}`);
    if (typeof menus.magia === 'string') {
        note('C6', g.scene, size, menus.magia === 'apagado' ? null : false, menus.magia === 'apagado' ? 'Magia apagada: este héroe no tiene conjuros (lo mira el escenario de la maga)' : `el menú de Magia: ${menus.magia}`);
    }
    const opened = Object.entries(menus).filter(([, v]) => typeof v === 'object');
    note('C7', g.scene, size, opened.length > 0 && opened.every(([, v]) => v.fits),
        Object.fromEntries(Object.entries(menus).map(([k, v]) => [k, typeof v === 'object' ? { top: v.top, height: v.height, bottom: v.bottom, left: v.left, right: v.right, cabecera: v.headBottom, cabe: v.fits } : v])),
        opened.map(([, v]) => v.file).join(' '));
    note('C8', g.scene, size, contrastFails.length === 0 && checked > 0, { textos: checked, peor: worst, apagados: plain.disabled, fallan: contrastFails.slice(0, 14), masFallos: Math.max(0, contrastFails.length - 14) });
    // C2, C3, C4, C9
    await checkSpace(g, size, heroId);
    await checkEdge(g, size, heroId);
    await checkReach(g, size, heroId);
    await checkGhost(g, size, heroId);
    await camera(g, 'center');
}

// ------------------------------------------------------------------ V1, V1b: la novela
/**
 * La placa y quién dice cada frase, en todo lo que se ha leído en la partida.
 *
 * @param {Game} g
 */
async function checkNovel(g) {
    const seen = /** @type {Array<{plate: string, who: string[], text: string, scene: string}>} */ (await g.page.evaluate(() => /** @type {any} */ (window).__vnSeen ?? []));
    const plates = [...new Set(seen.map(s => s.plate).filter(Boolean))];
    const labels = [...new Set(seen.flatMap(s => s.who))];
    const narrator = seen.filter(s => /narrador/i.test(s.plate) || s.who.some(w => /narrador/i.test(w)));
    note('V1', g.scene, 'todos', seen.length > 0 && narrator.length === 0,
        { frasesVistas: seen.length, placas: plates.slice(0, 20), quienes: labels.slice(0, 20), conNarrador: narrator.slice(0, 3) });
    // El oficio con su género: una etiqueta «La posadera» con un texto que habla de «el posadero».
    /** @type {any[]} */
    const wrong = [];
    for (const s of seen) {
        const low = s.text.toLowerCase();
        for (const label of [s.plate, ...s.who].filter(Boolean)) {
            const word = label.toLowerCase().replace(/^(el|la|los|las)\s+/, '').trim();
            if (!/^[a-záéíóúñ]+[ao]$/.test(word)) continue;
            const other = `${word.slice(0, -1)}${word.endsWith('a') ? 'o' : 'a'}`;
            const otherWithArticle = `${word.endsWith('a') ? 'el' : 'la'} ${other}`;
            if (low.includes(otherWithArticle)) wrong.push({ label, dice: otherWithArticle, text: s.text.slice(0, 160) });
        }
    }
    note('V1b', g.scene, 'todos', wrong.length === 0, { mal: wrong.slice(0, 4), etiquetas: [...plates, ...labels].slice(0, 30) });
}

// ------------------------------------------------------------------ V2: los 120 pies
/**
 * @param {Game} g
 * @param {string} where
 */
async function check120(g, where) {
    const found = await g.page.evaluate(() => {
        const all = [document.body.innerText, ...[...document.querySelectorAll('[title]')].map(n => n.getAttribute('title') || ''), ...[...document.querySelectorAll('[aria-label]')].map(n => n.getAttribute('aria-label') || '')].join('\n');
        return all.split('\n').filter(l => /120 pies|de una vez|para un tirón/i.test(l)).map(l => l.trim().slice(0, 140)).slice(0, 6);
    });
    return { where, found };
}

// ------------------------------------------------------------------ V3, V4, V6: el tablero en el turno
/**
 * El mar: lo que se enciende para andar, y pulsar una casilla de agua honda al lado.
 *
 * @param {Game} g
 * @param {string} heroId
 */
async function seaCheck(g, heroId) {
    await camera(g, 'center');
    const lit = await selectHero(g, heroId);
    const info = await g.page.evaluate(async () => {
        const board = (await import('/scripts/party/board.js')).getActiveBoardContext();
        const cells = /** @type {Record<string, any>} */ (board.terrain?.cells ?? {});
        const seaKeys = Object.entries(cells).filter(([, c]) => c?.type === 'deep_water').map(([k]) => k);
        const lit = [...document.querySelectorAll('#game-shell .wm-highlight-move')].map(n => `${n.getAttribute('data-x')},${n.getAttribute('data-y')}`);
        return { sea: seaKeys.length, litSea: lit.filter(k => cells[k]?.type === 'deep_water'), lit: lit.length, seaKeys: seaKeys.slice(0, 400) };
    });
    // Pulsar el agua honda más cercana que se vea: no se va.
    const st0 = await fightState(g);
    const near = info.seaKeys.map(k => k.split(',').map(Number)).sort((a, b) => Math.max(Math.abs(a[0] - st0.hero.x), Math.abs(a[1] - st0.hero.y)) - Math.max(Math.abs(b[0] - st0.hero.x), Math.abs(b[1] - st0.hero.y)))[0];
    let clicked = null;
    if (near) {
        clicked = await g.page.evaluate(async (cell) => {
            const board = (await import('/scripts/party/board.js')).getActiveBoardContext();
            const content = document.querySelector('#game-shell .wm-content');
            const r = content?.getBoundingClientRect();
            if (!r) return null;
            const x = r.left + ((cell[0] + 0.5) / Number(board.gridWidth)) * r.width;
            const y = r.top + ((cell[1] + 0.5) / Number(board.gridHeight)) * r.height;
            const hit = document.elementFromPoint(x, y);
            return { x, y, free: Boolean(hit && hit.closest('#game-shell .wm-container') && !hit.closest('.vtt-island, .gs-vtt-bar, .wm-token')) };
        }, near);
        if (clicked?.free) {
            await tapAt(g, clicked.x, clicked.y);
            await g.page.waitForTimeout(700);
            // Un toque en el teléfono enseña la ruta; el segundo, en la misma casilla, iría.
            if (g.touch) {
                await tapAt(g, clicked.x, clicked.y);
                await g.page.waitForTimeout(700);
            }
        }
    }
    const st1 = await fightState(g);
    const onSea = await g.page.evaluate(async () => {
        const board = (await import('/scripts/party/board.js')).getActiveBoardContext();
        const st = await import('/scripts/party/state.js');
        return /** @type {any[]} */ (st.partyMembers).filter(m => board.terrain?.cells?.[`${m.mapPosition?.gridX},${m.mapPosition?.gridY}`]?.type === 'deep_water').map(m => m.name);
    });
    return { lit, sea: info.sea, litOnSea: info.litSea.length, near, clicked, moved: st1.hero.x !== st0.hero.x || st1.hero.y !== st0.hero.y, from: st0.hero, to: st1.hero, onSea };
}

/**
 * La ruta hasta la casilla de al lado del ratero: la que dibuja el tablero al pasar por ella (lo
 * que ve quien juega) y la del motor.
 *
 * @param {Game} g
 * @param {string} heroId
 */
async function routeCheck(g, heroId) {
    await camera(g, 'center');
    await selectHero(g, heroId);
    const plan = await g.page.evaluate(async () => {
        const board = (await import('/scripts/party/board.js')).getActiveBoardContext();
        const pf = await import('/scripts/game-engine/board/pathfinding.js');
        const st = await import('/scripts/party/state.js');
        const enc = /** @type {any} */ (st.combatEncounter);
        const hero = /** @type {any} */ (st.partyMembers[0]);
        const hx = Number(hero.mapPosition.gridX);
        const hy = Number(hero.mapPosition.gridY);
        const foe = (enc.enemies ?? []).find((/** @type {any} */ e) => Number(e.currentHp) > 0);
        if (!foe) return null;
        const fx = Number(foe.gridX);
        const fy = Number(foe.gridY);
        // La casilla libre de al lado del enemigo más cerca de la línea recta desde el héroe.
        const free = (/** @type {number} */ x, /** @type {number} */ y) => pf.findPath(board.terrain, hx, hy, x, y, board.gridWidth, board.gridHeight, { occupied: new Set([`${fx},${fy}`]) });
        const options = [-1, 0, 1].flatMap(dx => [-1, 0, 1].map(dy => ({ x: fx + dx, y: fy + dy }))).filter(c => !(c.x === fx && c.y === fy))
            .map(c => ({ ...c, d: Math.max(Math.abs(c.x - hx), Math.abs(c.y - hy)), e: Math.hypot(c.x - hx, c.y - hy) }))
            .sort((a, b) => a.d - b.d || a.e - b.e);
        const goal = options.find(c => (c.x !== hx || c.y !== hy) && free(c.x, c.y)) ?? null;
        if (!goal) return { hero: { x: hx, y: hy }, foe: { x: fx, y: fy }, goal: null };
        const path = free(goal.x, goal.y) ?? [];
        return { hero: { x: hx, y: hy }, foe: { x: fx, y: fy, name: String(foe.name) }, goal, engine: path.map((/** @type {any} */ c) => [c.x, c.y]), rule: pf.DIAGONAL_RULE };
    });
    if (!plan?.goal) return { plan, drawn: null };
    // Pasar el ratón (o un toque) por la casilla: se dibuja la ruta.
    const at = await g.page.evaluate((cell) => {
        const n = document.querySelector(`#game-shell .wm-highlight-move[data-x="${cell.x}"][data-y="${cell.y}"]`);
        const r = n?.getBoundingClientRect();
        if (!r) return null;
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        const hit = document.elementFromPoint(x, y);
        return { x, y, free: hit === n };
    }, plan.goal);
    /** @type {any} */
    let drawn = null;
    if (at?.free) {
        if (g.touch) await tapAt(g, at.x, at.y);
        else await g.page.mouse.move(at.x, at.y, { steps: 3 });
        await g.page.waitForTimeout(500);
        drawn = await g.page.evaluate(async () => {
            const board = (await import('/scripts/party/board.js')).getActiveBoardContext();
            const content = /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .wm-content'));
            const cw = content ? content.offsetWidth / Number(board.gridWidth) : 1;
            const ch = content ? content.offsetHeight / Number(board.gridHeight) : 1;
            const steps = [...document.querySelectorAll('#game-shell .wm-path-step')].map(n => {
                const s = /** @type {HTMLElement} */ (n).style;
                return [Math.round(parseFloat(s.left) / cw - 0.5), Math.round(parseFloat(s.top) / ch - 0.5)];
            });
            return { steps, cost: (document.querySelector('#game-shell .wm-path-cost')?.textContent || '').trim() };
        });
    }
    return { plan, at, drawn };
}

/**
 * Giros de una ruta (con la casilla de salida delante) y cuánto se aparta de la línea recta.
 *
 * @param {number[][]} cells
 * @param {{x: number, y: number}} start
 */
function shapeOf(cells, start) {
    const all = [[start.x, start.y], ...cells.filter((c, i) => i > 0 || c[0] !== start.x || c[1] !== start.y)];
    let turns = 0;
    for (let i = 2; i < all.length; i++) {
        const a = `${all[i - 1][0] - all[i - 2][0]},${all[i - 1][1] - all[i - 2][1]}`;
        const b = `${all[i][0] - all[i - 1][0]},${all[i][1] - all[i - 1][1]}`;
        if (a !== b) turns++;
    }
    const end = all[all.length - 1];
    const len = Math.hypot(end[0] - start.x, end[1] - start.y) || 1;
    const off = Math.max(0, ...all.map(c => Math.abs((end[0] - start.x) * (start.y - c[1]) - (start.x - c[0]) * (end[1] - start.y)) / len));
    const chebyshev = Math.max(Math.abs(end[0] - start.x), Math.abs(end[1] - start.y));
    return { turns, off: Math.round(off * 100) / 100, steps: all.length - 1, chebyshev };
}

/**
 * El movimiento en combate y la regla de las diagonales.
 *
 * @param {Game} g
 */
const moveRule = (g) => g.page.evaluate(async () => {
    const pf = await import('/scripts/game-engine/board/pathfinding.js');
    const empty = { cells: {} };
    const label = (document.querySelector('#game-shell .gs-vtt-bar .gs-move-label')?.textContent || '').replace(/\s+/g, ' ').trim();
    return {
        rule: pf.DIAGONAL_RULE,
        twoDiagonals: pf.getPathCost(/** @type {any} */ (empty), [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }]) * 5,
        threeDiagonals: pf.getPathCost(/** @type {any} */ (empty), [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }]) * 5,
        allFive: pf.getPathCost(/** @type {any} */ (empty), [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }], { diagonals: 'todas-a-5' }) * 5,
        shallow: pf.getPathCost(/** @type {any} */ ({ cells: { '1,0': { type: 'water' } } }), [{ x: 0, y: 0 }, { x: 1, y: 0 }]) * 5,
        label,
    };
});

// ------------------------------------------------------------------ entrar en la pelea, mirándolo
/**
 * Del tablero con el ratero a la vista hasta la pelea, como quien juega, apuntando lo que se ve en
 * cada paso: la fila de fichas, la decisión, colocarse y la iniciativa.
 *
 * @param {Game} g
 * @param {string} size
 */
async function enterFightWatching(g, size) {
    /** @type {any} */
    const seen = { rows: [], decision: null, placing: null, started: false, startChip: [], foreign: [] };
    const look = async (/** @type {string} */ when) => {
        const b = await visibleButtons(g);
        const start = [...b.chips, ...b.buttons].filter(t => START_CHIP.test(t));
        const foreign = b.scene === 'combat' ? b.chips.filter(t => FOREIGN_CHIP.test(t)) : [];
        seen.rows.push({ when, scene: b.scene, chips: b.chips.slice(0, 12) });
        if (start.length) seen.startChip.push({ when, start });
        if (foreign.length) seen.foreign.push({ when, foreign });
    };
    await look('antes');
    const decided = await g.until(async () => {
        const e = await comoVaLaEntrada(g.page);
        if (e.deciding || e.placing || e.fighting) return true;
        await look('leyendo');
        await g.page.evaluate(() => /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .gs-vn-box .gs-chip-continue'))?.click());
        return false;
    }, 90000);
    let e = await comoVaLaEntrada(g.page);
    if (e.deciding) {
        await look('decidiendo');
        seen.decision = await g.page.evaluate(() => ({
            options: [...document.querySelectorAll('dialog.ev-avoid[open] [data-exit]')].map(b => ({ id: b.getAttribute('data-exit') || '', text: (b.querySelector('.ev-tag, .dw-option-label, strong')?.textContent || b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) })),
            closable: Boolean(document.querySelector('dialog.ev-avoid[open] .ev-close')),
            nameplate: (document.querySelector('dialog.ev-avoid[open] .qd-nameplate')?.textContent || '').trim(),
        }));
        seen.decisionShot = await shot(g, size, 'decision');
        await g.page.locator('dialog.ev-avoid[open] [data-exit="pelear"]').first().click({ timeout: 8000 }).catch(() => {});
        await g.until(async () => {
            const now = await comoVaLaEntrada(g.page);
            return now.placing || now.fighting;
        }, 15000);
        e = await comoVaLaEntrada(g.page);
    }
    if (e.placing) {
        await dropToasts(g);
        await look('colocando');
        seen.placing = await g.page.evaluate(async () => {
            const board = (await import('/scripts/party/board.js')).getActiveBoardContext();
            const cells = [...document.querySelectorAll('#game-shell .wm-highlight-place')].map(n => `${n.getAttribute('data-x')},${n.getAttribute('data-y')}`);
            return { cells: cells.length, sea: cells.filter(k => board.terrain?.cells?.[k]?.type === 'deep_water').length, fighting: Boolean(window.SillyTavern.getContext().chatMetadata?.combatEncounter?.active) };
        });
        seen.placingShot = await shot(g, size, 'colocar');
        // Ponerse en la casilla de salida más lejos del enemigo, pulsándola: así la ruta hasta él
        // (V4) tiene algo que mirar.
        const far = await g.page.evaluate(async () => {
            // Dónde está el enemigo: su ficha en la pantalla, pasada a casillas.
            const board = (await import('/scripts/party/board.js')).getActiveBoardContext();
            const content = document.querySelector('#game-shell .wm-content')?.getBoundingClientRect();
            const foeBox = document.querySelector('#game-shell .wm-token.wm-token-enemy')?.getBoundingClientRect();
            const fx = content && foeBox ? Math.floor(((foeBox.left + foeBox.width / 2 - content.left) / content.width) * Number(board.gridWidth)) : NaN;
            const fy = content && foeBox ? Math.floor(((foeBox.top + foeBox.height / 2 - content.top) / content.height) * Number(board.gridHeight)) : NaN;
            const cells = [...document.querySelectorAll('#game-shell .wm-highlight-place')].map(n => {
                const r = n.getBoundingClientRect();
                const x = r.left + r.width / 2;
                const y = r.top + r.height / 2;
                return { gx: Number(n.getAttribute('data-x')), gy: Number(n.getAttribute('data-y')), x, y, free: document.elementFromPoint(x, y) === n };
            }).filter(c => c.free);
            if (!cells.length) return null;
            const d = (/** @type {any} */ c) => (Number.isFinite(fx) ? Math.max(Math.abs(c.gx - fx), Math.abs(c.gy - fy)) : 0);
            return cells.sort((a, b) => d(b) - d(a))[0];
        });
        if (far) {
            await tapAt(g, far.x, far.y);
            await g.page.waitForTimeout(500);
            seen.placedAt = { x: far.gx, y: far.gy };
        }
        const start = await boxOf(g, '.cv-place .cv-place-start');
        if (start) await tapAt(g, start.x, start.y);
        else await g.page.evaluate(() => /** @type {HTMLElement|null} */ (document.querySelector('.cv-place .cv-place-start'))?.click());
    }
    seen.started = await g.until(() => fighting(g), 20000);
    if (!seen.started) {
        // No hace trampas: si no se llega a pelear, lo dice (y se intenta a la manera del ayudante).
        seen.helper = await entrarEnLaPelea(g.page, { ms: 30000 });
        seen.started = await fighting(g);
    }
    await look('peleando');
    seen.decided = decided;
    return seen;
}

/**
 * Lo de la entrada, a la tabla: V5, V5b, V5c y el mar al colocarse.
 *
 * @param {Game} g
 * @param {string} size
 * @param {any} seen
 */
function noteEntry(g, size, seen) {
    note('V5', g.scene, size, Boolean(seen.started && seen.decision && seen.placing && !seen.placing.fighting && seen.startChip.length === 0 && !seen.helper),
        { decision: Boolean(seen.decision), colocarse: seen.placing, empezo: seen.started, conElAyudante: Boolean(seen.helper), iniciarCombate: seen.startChip }, seen.placingShot || '');
    const options = (seen.decision?.options ?? []).map((/** @type {any} */ o) => o.id);
    note('V5b', g.scene, size, Boolean(seen.decision && options[0] === 'pelear' && options.length >= 2),
        { opciones: seen.decision?.options, sePuedeCerrar: seen.decision?.closable }, seen.decisionShot || '');
    note('V5c', g.scene, size, seen.foreign.length === 0, { ajenas: seen.foreign, filas: seen.rows.slice(-3) });
    if (seen.placing) note('V3', g.scene, `${size} colocar`, seen.placing.sea === 0, { casillasDeSalida: seen.placing.cells, enElMar: seen.placing.sea });
}

/**
 * En el primer turno: el mar, la ruta recta y la regla del movimiento.
 *
 * @param {Game} g
 * @param {string} size
 * @param {boolean} hasSea
 */
async function firstTurnChecks(g, size, hasSea) {
    const heroId = (await fightState(g)).heroId;
    const rule = await moveRule(g);
    note('V6', g.scene, size, rule.rule === 'alternas' && rule.twoDiagonals === 15 && rule.threeDiagonals === 20 && rule.allFive === 10 && rule.shallow === 10 && /^30\/30 pies$/.test(rule.label.replace(/^\W+/, '').trim()), rule);
    const route = await routeCheck(g, heroId);
    if (route.plan?.goal) {
        const engine = shapeOf(route.plan.engine ?? [], route.plan.hero);
        const drawn = route.drawn ? shapeOf(route.drawn.steps, route.plan.hero) : null;
        const file = await shot(g, size, 'ruta');
        note('V4', g.scene, size, Boolean(drawn && drawn.turns <= 1 && engine.turns <= 1 && drawn.steps === drawn.chebyshev),
            { de: route.plan.hero, a: route.plan.goal, ratero: route.plan.foe, motor: { ...engine, celdas: route.plan.engine }, dibujada: drawn && { ...drawn, celdas: route.drawn.steps, precio: route.drawn.cost }, casilla: route.at }, file);
    } else {
        note('V4', g.scene, size, null, { porque: 'no hay casilla libre al lado del enemigo', plan: route.plan });
    }
    if (hasSea) {
        const sea = await seaCheck(g, heroId);
        const file = await shot(g, size, 'mar');
        note('V3', g.scene, `${size} turno`, sea.lit && sea.litOnSea === 0 && !(sea.clicked?.free && sea.moved && sea.onSea.length > 0) && sea.onSea.length === 0, sea, file);
    }
}

/**
 * Acabar la pelea con el gancho (los enemigos a 0 y `/combat-end`, sin esperar a la orden, que
 * puede no volver), como e2e-lienzo: hasta que no haya pelea.
 *
 * @param {Game} g
 */
async function endFightByHook(g) {
    for (let i = 0; i < 8 && await fighting(g); i++) {
        await g.page.evaluate(async () => {
            const st = await import('/scripts/party/state.js');
            for (const e of /** @type {any} */ (st.combatEncounter).enemies ?? []) e.currentHp = 0;
            void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/combat-end');
        });
        await g.page.waitForTimeout(900);
        await clearDice(g);
        await g.page.evaluate(() => document.querySelectorAll('.vs-card, .gs-victory, .wm-victory').forEach(v => /** @type {HTMLElement} */ (v).click()));
    }
}

/**
 * Ganar la pelea a clics desde la barra: acercarse pulsando una casilla encendida y atacar desde
 * «Atacar». Si en tres minutos no se acaba, se dice y se termina con el gancho.
 *
 * @param {Game} g
 */
async function winFight(g) {
    const end = Date.now() + 180000;
    let attacks = 0;
    let hooked = false;
    while (Date.now() < end && await fighting(g)) {
        if (!await heroTurn(g, 40000)) break;
        if (!await fighting(g)) break;
        const st = await fightState(g);
        const foe = st.foes.sort((a, b) => Math.max(Math.abs(a.x - st.hero.x), Math.abs(a.y - st.hero.y)) - Math.max(Math.abs(b.x - st.hero.x), Math.abs(b.y - st.hero.y)))[0];
        if (foe && Math.max(Math.abs(foe.x - st.hero.x), Math.abs(foe.y - st.hero.y)) > 1) {
            await camera(g, 'center');
            await selectHero(g, st.heroId);
            const cell = await g.page.evaluate((f) => {
                const cells = [...document.querySelectorAll('#game-shell .wm-highlight-move.wm-highlight-clickable')].map(n => ({ n, x: Number(n.getAttribute('data-x')), y: Number(n.getAttribute('data-y')) }))
                    .sort((a, b) => Math.max(Math.abs(a.x - f.x), Math.abs(a.y - f.y)) - Math.max(Math.abs(b.x - f.x), Math.abs(b.y - f.y)));
                for (const c of cells) {
                    const r = c.n.getBoundingClientRect();
                    const x = r.left + r.width / 2;
                    const y = r.top + r.height / 2;
                    if (document.elementFromPoint(x, y) === c.n) return { x, y };
                }
                return null;
            }, foe);
            if (cell) {
                await tapAt(g, cell.x, cell.y);
                await g.page.waitForTimeout(400);
                if (g.touch) await tapAt(g, cell.x, cell.y);
                await g.page.waitForTimeout(600);
                await clearDice(g);
            }
        }
        if (await openMenu(g, 'atacar') === 'ok') {
            const pick = await g.page.evaluate(() => {
                const card = [...document.querySelectorAll('#game-shell .gs-grimoire [data-pick^="attack:"]')].find(c => !(/** @type {HTMLButtonElement} */ (c).disabled));
                return card ? card.getAttribute('data-pick') : null;
            });
            if (pick) {
                await g.page.locator(`#game-shell .gs-grimoire [data-pick="${pick}"]`).first().click({ timeout: 4000 }).catch(() => {});
                attacks++;
                await g.page.waitForTimeout(600);
                await clearDice(g);
            }
            await closeMenus(g);
        }
        if (await fighting(g) && (await fightState(g)).mine) {
            await g.page.evaluate(() => /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .gs-vtt-bar .gs-btn-end'))?.click());
            await g.page.locator('.popup-button-ok:visible').first().click({ timeout: 1500 }).catch(() => {});
            await g.page.waitForTimeout(500);
        }
    }
    if (await fighting(g)) {
        hooked = true;
        await endFightByHook(g);
        await g.page.waitForTimeout(1200);
    }
    await clearDice(g);
    return { attacks, hooked, over: !(await fighting(g)) };
}

// ------------------------------------------------------------------ fuera de combate
/**
 * Tras la pelea, en el mismo tablero sin pelea: ni «120 pies de una vez», ni andar por el mar.
 *
 * @param {Game} g
 * @param {string} size
 * @param {boolean} hasSea
 * @param {string} [boardName] El tablero de la pelea, para volver a él si la historia sigue fuera.
 */
async function afterFight(g, size, hasSea, boardName = '') {
    await dropToasts(g);
    await g.page.evaluate(() => document.querySelectorAll('.vs-card, .gs-victory, .wm-victory').forEach(v => /** @type {HTMLElement} */ (v).click()));
    const state = () => g.page.evaluate(() => ({
        scene: document.querySelector('#game-shell')?.getAttribute('data-scene') || '',
        board: String(window.SillyTavern.getContext().chatMetadata?.currentBoard ?? ''),
        fight: Boolean(window.SillyTavern.getContext().chatMetadata?.combatEncounter?.active),
    }));
    // Hasta el tablero sin pelea, leyendo lo que salga antes: «Continuar» (si vuelve al tablero)
    // o la ventana de encima. Al volver a entrar, el sitio puede abrir antes su conversación.
    const toBoard = (/** @type {number} */ ms) => g.until(async () => {
        await clearDice(g);
        const s = await state();
        if (s.scene === 'combat' && s.board && !s.fight) return true;
        await g.page.evaluate(() => {
            const top = document.querySelector('dialog[open] .ps-finish, dialog[open] .dw-finish, dialog[open] .qd-chip-next, dialog[open] .popup-button-ok');
            if (top instanceof HTMLElement) top.click();
            else /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .gs-vn-box .gs-chip-continue'))?.click();
        });
        return false;
    }, ms);
    const onBoard = await toBoard(25000);
    let entered = '';
    if (!onBoard) {
        // Si la historia sigue fuera del tablero, entrar en uno sin enemigos desde la lista de
        // tableros del sitio, como quien juega.
        await shot(g, size, 'tras-la-pelea');
        const boards = await g.page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-board')].filter(b => b.getBoundingClientRect().width > 0)
            .map((b, i) => ({ i, name: (b.querySelector('.gs-board-name')?.textContent || b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) })));
        const pick = boards.find(b => /muelle|posada|cuarto/i.test(b.name)) ?? boards[0];
        if (pick) {
            entered = pick.name;
            const b = await g.page.evaluate((i) => {
                const n = [...document.querySelectorAll('#game-shell .gs-board')].filter(x => x.getBoundingClientRect().width > 0)[i];
                const r = n?.getBoundingClientRect();
                return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
            }, pick.i);
            if (b) await tapAt(g, b.x, b.y);
        } else {
            // La ficha «Entrar en …» de la fila (aunque esté dentro de «+N más»).
            entered = await g.page.evaluate(() => {
                const chip = [...document.querySelectorAll('#game-shell .gs-chip-action, #game-shell .gs-chip')].find(c => /^Entrar en /.test((c.textContent || '').trim()));
                if (chip instanceof HTMLElement) {
                    chip.click();
                    return `ficha «${(chip.textContent || '').trim()}»`;
                }
                return '';
            });
        }
        let back = await toBoard(15000);
        if (!back && boardName) {
            // Sin tarjeta ni ficha a la vista: la orden de entrar (como el rescate de las vueltas).
            entered = `${entered ? `${entered}; ` : ''}/enter ${boardName}`;
            await g.page.evaluate((name) => { void window.SillyTavern.getContext().executeSlashCommandsWithOptions(`/enter ${name}`); }, boardName);
            back = await toBoard(20000);
        }
    }
    const where = await state();
    const t120 = await check120(g, `tablero sin pelea (${where.board || 'ninguno'})`);
    if (!(where.scene === 'combat' && where.board && !where.fight)) {
        note('V2', g.scene, size, t120.found.length === 0 ? null : false, { porque: 'tras la pelea no se vuelve a un tablero sin pelea; se mira lo que hay a la vista', entrando: entered, ...where, ...t120 });
        return;
    }
    // Pasar el ratón (o un toque) por la ficha y por una casilla lejana: lo que dice el tablero.
    const heroId = (await fightState(g)).heroId;
    await camera(g, 'center');
    const v = await boardView(g);
    const me = v?.tokens.find(t => t.id === heroId);
    if (me && !me.covered) {
        await tapAt(g, me.x, me.y);
        await g.page.waitForTimeout(500);
    }
    const far = await emptyPoint(g, { fx: 0.85, fy: 0.2 });
    if (far && !g.touch) await g.page.mouse.move(far.x, far.y, { steps: 3 });
    await g.page.waitForTimeout(500);
    const said = await g.page.evaluate(() => [...document.querySelectorAll('#game-shell .wm-cell-info, #game-shell .wm-path-cost, #game-shell .vtt-top-left')].map(n => (n.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean));
    const t120b = await check120(g, `tablero sin pelea, con la ficha elegida (${where.board})`);
    const file = await shot(g, size, 'sin-pelea');
    note('V2', g.scene, size, t120.found.length === 0 && t120b.found.length === 0, { tablero: where.board, entrando: entered || 'ya estaba', dice: said.slice(0, 4), encontrado: [...t120.found, ...t120b.found] }, file);
    if (hasSea) {
        const before = await fightState(g);
        const target = await g.page.evaluate(async (hero) => {
            const board = (await import('/scripts/party/board.js')).getActiveBoardContext();
            const cells = /** @type {Record<string, any>} */ (board.terrain?.cells ?? {});
            const sea = Object.entries(cells).filter(([, c]) => c?.type === 'deep_water').map(([k]) => k.split(',').map(Number))
                .sort((a, b) => Math.max(Math.abs(a[0] - hero.x), Math.abs(a[1] - hero.y)) - Math.max(Math.abs(b[0] - hero.x), Math.abs(b[1] - hero.y)));
            const content = document.querySelector('#game-shell .wm-content');
            const r = content?.getBoundingClientRect();
            if (!r) return null;
            for (const cell of sea) {
                const x = r.left + ((cell[0] + 0.5) / Number(board.gridWidth)) * r.width;
                const y = r.top + ((cell[1] + 0.5) / Number(board.gridHeight)) * r.height;
                const hit = document.elementFromPoint(x, y);
                if (hit && hit.closest('#game-shell .wm-container') && !hit.closest('.vtt-island, .gs-vtt-bar, .wm-token')) return { x, y, cell };
            }
            return null;
        }, before.hero);
        if (target) {
            await tapAt(g, target.x, target.y);
            await g.page.waitForTimeout(500);
            await tapAt(g, target.x, target.y);
            await g.page.waitForTimeout(900);
        }
        const after = await fightState(g);
        const onSea = await g.page.evaluate(async () => {
            const board = (await import('/scripts/party/board.js')).getActiveBoardContext();
            const st = await import('/scripts/party/state.js');
            return /** @type {any[]} */ (st.partyMembers).filter(m => board.terrain?.cells?.[`${m.mapPosition?.gridX},${m.mapPosition?.gridY}`]?.type === 'deep_water').map(m => `${m.name} (${m.mapPosition?.gridX},${m.mapPosition?.gridY})`);
        });
        const file2 = await shot(g, size, 'sin-pelea-mar');
        note('V3', g.scene, `${size} sin pelea`, Boolean(target) && onSea.length === 0, { pulsado: target?.cell, antes: before.hero, despues: after.hero, enElMar: onSea }, file2);
    }
}

/**
 * Seguir el prólogo tras el muelle con el bot de las vueltas (sin «Saltar la prueba») hasta que
 * se haya hablado en la posada y llegado al gremio, o 90 pasos.
 *
 * @param {Game} g
 */
async function readPrologue(g) {
    const bot = createBot(g.page, { fast: true, log: () => {} });
    /** @type {any} */
    let v = await bot.observe();
    for (let i = 0; i < 90 && !v.done.includes('el-gremio'); i++) {
        v = await bot.observe();
        if (await bot.handleLayer(v)) continue;
        if (v.fight) {
            await bot.fightTurn(v, null);
            continue;
        }
        if (v.board && v.start.length > 0) {
            await bot.confirmStart(v);
            continue;
        }
        if (v.scene === 'dialogue' && v.vn.next) await bot.act(v, '«Continuar»', () => bot.press(bot.chip(/^Continuar$/)));
        else if (await bot.tapChip(v, /^Hablar con /, 'hablar', 'action-chips.js')) continue;
        else await g.page.waitForTimeout(300);
    }
    note('R', g.scene, '1280x720', true, { prologoLeido: v.done });
}

// ------------------------------------------------------------------ los escenarios
/**
 * Lo que queda al acabar un escenario: los errores de la página.
 *
 * @param {Game} g
 */
function noteProblems(g) {
    const errors = g.problems.filter(p => /PAGEERROR/.test(p));
    note('R', g.scene, 'todos', errors.length === 0, { errores: errors.slice(0, 5), otros: g.problems.filter(p => !/PAGEERROR/.test(p)).slice(0, 3) });
}

/**
 * Hasta el muelle del prólogo, leyendo.
 *
 * @param {Game} g
 */
async function toTheDock(g) {
    return g.until(async () => /muelle/i.test(await g.page.evaluate(() => String(window.SillyTavern.getContext().chatMetadata?.currentBoard ?? ''))), 150000);
}

async function scenarioMuelle() {
    const g = await openGame({ width: 1280, height: 720 }, false, 'muelle');
    try {
        await startOffline(g.page, { name: 'Tessa', gender: 'Mujer', race: 'Humano', klass: 'Guerrero' });
        const atDock = await toTheDock(g);
        note('R', g.scene, '1280x720', atDock, 'del título al muelle del prólogo, leyendo');
        await g.page.waitForTimeout(1500);
        await shot(g, '1280x720', 'novela');
        const novel120 = await check120(g, 'la novela del muelle');
        if (novel120.found.length) note('V2', g.scene, '1280x720 novela', false, novel120);
        const seen = await enterFightWatching(g, '1280x720');
        noteEntry(g, '1280x720', seen);
        if (!seen.started || !await heroTurn(g)) throw new Error('no se llega al turno de Tessa');
        await firstTurnChecks(g, '1280x720', true);
        for (const size of DESK_SIZES) await sizeSuite(g, size);
        await g.page.setViewportSize({ width: 1280, height: 720 });
        await g.page.waitForTimeout(800);
        const won = await winFight(g);
        note('R', g.scene, '1280x720', won.over && !won.hooked, { comoSeGana: 'a clics: andar a una casilla encendida y «Atacar»', ...won });
        await afterFight(g, '1280x720', true, 'El muelle de Puerto Alba');
        // La novela del prólogo, después del muelle (la charla con quien lleva la posada): para
        // mirar la placa del narrador y el oficio con su género, como quien lee.
        await readPrologue(g);
        await checkNovel(g);
    } catch (error) {
        note('R', g.scene, 'todos', false, `la vuelta se ha roto: ${/** @type {any} */ (error)?.stack || error}`, await shot(g, 'x', 'error'));
    } finally {
        noteProblems(g);
        await g.context.close().catch(() => {});
    }
}

async function scenarioMovil() {
    const g = await openGame({ width: 390, height: 844 }, true, 'movil');
    try {
        await startOffline(g.page, { name: 'Nerea', gender: 'Mujer', race: 'Humano', klass: 'Mago' });
        const atDock = await toTheDock(g);
        note('R', g.scene, '390x844', atDock, 'del título al muelle del prólogo, en el teléfono');
        await g.page.waitForTimeout(1500);
        await shot(g, '390x844', 'novela');
        const seen = await enterFightWatching(g, '390x844');
        noteEntry(g, '390x844', seen);
        if (!seen.started || !await heroTurn(g)) throw new Error('no se llega al turno de Nerea');
        await firstTurnChecks(g, '390x844', true);
        for (const size of ['390x844', '844x390']) await sizeSuite(g, size);
        await checkNovel(g);
    } catch (error) {
        note('R', g.scene, 'todos', false, `la vuelta se ha roto: ${/** @type {any} */ (error)?.stack || error}`, await shot(g, 'x', 'error'));
    } finally {
        noteProblems(g);
        await g.context.close().catch(() => {});
    }
}

async function scenario1387() {
    // El bot de las vueltas juega como en `vuelta-1387.mjs` (a su tamaño de siempre), hasta la
    // primera pelea de 1387; allí se mira todo a los cuatro tamaños.
    const g = await openGame({ width: 1400, height: 950 }, false, '1387', { quiet: false });
    try {
        const log = (/** @type {string} */ line) => { if (process.argv.includes('--depurar')) console.log(line); };
        const bot = createBot(g.page, { fast: true, log });
        await startOffline(g.page, { name: 'Mara', gender: 'Mujer', race: 'Humano', klass: 'Mago' });
        /** @type {any} */
        let v = await bot.observe();
        for (let i = 0; i < 160 && !v.done.includes('la-prueba'); i++) {
            v = await bot.observe();
            if (await bot.handleLayer(v)) continue;
            if (v.fight) {
                await bot.fightTurn(v, null);
                continue;
            }
            if (v.board && v.start.length > 0) {
                await bot.confirmStart(v);
                continue;
            }
            if (await bot.tapChip(v, /^Saltar la prueba$/, 'saltar la prueba', 'hub.js')) continue;
            if (v.scene === 'dialogue' && v.vn.next) await bot.act(v, '«Continuar»', () => bot.press(bot.chip(/^Continuar$/)));
            else await g.page.waitForTimeout(300);
        }
        note('R', g.scene, '1400x950', v.done.includes('la-prueba'), { prologo: v.done });
        const onHub = async (/** @type {any} */ now) => {
            const card = g.page.locator('dialog[open] .hb-root [data-campaign="1387"]');
            if (await card.count() === 0) return false;
            const done = await bot.act(now, 'empezar 1387 en el tablón', () => bot.press(card), { module: 'hub-panel.js', wait: 8000 });
            await bot.until(async () => /1387/.test((await bot.observe()).world), 30000, 400);
            return done;
        };
        for (let i = 0; i < 50 && !/1387/.test(v.world); i++) {
            v = await bot.observe();
            if (await bot.handleLayer(v, { onHub })) continue;
            if (await bot.tapChip(v, /^Tablón de campañas$/, 'el tablón de campañas', 'action-chips.js')) continue;
            if (v.scene === 'dialogue' && v.vn.next) await bot.act(v, '«Continuar»', () => bot.press(bot.chip(/^Continuar$/)));
            else if (v.town.inside) await bot.toMap(v);
        }
        const started = await bot.until(async () => /1387/.test((await bot.observe()).world), 60000, 500);
        note('R', g.scene, '1400x950', started, 'desde el tablón empieza 1387');
        const played = await runCampaign(bot, {
            pack: readJson('public/mundos/1387.pack.json'),
            order: [],
            maxSteps: 260,
            log,
            stop: (now) => Boolean(now.fight) || now.start.length > 0 || now.layer?.exit === 'avoid',
        });
        const board = await g.page.evaluate(() => String(window.SillyTavern.getContext().chatMetadata?.currentBoard ?? ''));
        note('R', g.scene, '1400x950', played.reached, { primeraPelea: board, gaveUp: played.gaveUp, pasos: bot.steps.length });
        if (!played.reached) throw new Error(`no se llega a la primera pelea de 1387: ${played.gaveUp}`);
        await g.page.setViewportSize({ width: 1280, height: 720 });
        await g.page.waitForTimeout(800);
        const seen = await enterFightWatching(g, '1280x720');
        noteEntry(g, '1280x720', seen);
        if (!seen.started || !await heroTurn(g)) throw new Error('no se llega al turno de Mara');
        const hasSea = await g.page.evaluate(async () => Object.values((await import('/scripts/party/board.js')).getActiveBoardContext().terrain?.cells ?? {}).some((/** @type {any} */ c) => c?.type === 'deep_water'));
        await firstTurnChecks(g, '1280x720', hasSea);
        for (const size of DESK_SIZES) await sizeSuite(g, size);
        await g.page.setViewportSize({ width: 1280, height: 720 });
        // La pelea se acaba con el gancho (una maga sola contra cuatro guardias caería): lo que
        // se mira después es el tablero sin pelea.
        await endFightByHook(g);
        await g.page.waitForTimeout(1500);
        await afterFight(g, '1280x720', hasSea, board);
        await checkNovel(g);
    } catch (error) {
        note('R', g.scene, 'todos', false, `la vuelta se ha roto: ${/** @type {any} */ (error)?.stack || error}`, await shot(g, 'x', 'error'));
    } finally {
        noteProblems(g);
        await g.context.close().catch(() => {});
    }
}

// ------------------------------------------------------------------ la vuelta
const t0 = Date.now();
const clock = (/** @type {number} */ ms) => `${Math.floor(ms / 60000)}:${String(Math.round((ms % 60000) / 1000)).padStart(2, '0')}`;
try {
    browser = await chromium.launch({ channel: 'msedge', headless: !HEADED });
    for (const [name, run] of /** @type {Array<[string, () => Promise<void>]>} */ ([['muelle', scenarioMuelle], ['movil', scenarioMovil], ['1387', scenario1387]])) {
        if (!ONLY.has(name)) continue;
        const t1 = Date.now();
        console.log(`\n=== ${name} ===`);
        try {
            await startServer();
            await run();
        } catch (error) {
            note('R', name, 'todos', false, `no arranca: ${/** @type {any} */ (error)?.message || error}`);
        } finally {
            await stopServer();
        }
        console.log(`--- ${name}: ${clock(Date.now() - t1)}`);
    }
} catch (error) {
    note('R', 'todo', 'todos', false, `la vuelta se ha roto: ${/** @type {any} */ (error)?.stack || error}`);
} finally {
    if (browser) await browser.close().catch(() => {});
    await stopServer();
}

// ------------------------------------------------------------------ la tabla
const columns = [...new Set(results.map(r => `${r.scene} ${r.size}`))];
const mark = (/** @type {boolean|null|undefined} */ ok) => (ok === undefined ? '·' : ok === null ? 'n/a' : ok ? 'PASS' : 'FAIL');
console.log('\n=== Los criterios (PASS/FAIL por escenario y tamaño) ===');
for (const [id, name] of [...CRITERIA, ['R', 'La vuelta llega hasta ahí (sin romperse ni errores en la página)']]) {
    const rows = results.filter(r => r.crit === id);
    if (rows.length === 0) {
        console.log(`${id.padEnd(4)} sin mirar  ${name}`);
        continue;
    }
    const all = rows.every(r => r.ok !== false) ? (rows.some(r => r.ok) ? 'PASS' : 'n/a ') : 'FAIL';
    console.log(`${id.padEnd(4)} ${all}  ${name}`);
    console.log(`       ${columns.filter(c => rows.some(r => `${r.scene} ${r.size}` === c)).map(c => {
        const oks = rows.filter(r => `${r.scene} ${r.size}` === c).map(r => r.ok);
        return `${c}: ${mark(oks.includes(false) ? false : oks.includes(true) ? true : null)}`;
    }).join(' · ')}`);
}
const failed = results.filter(r => r.ok === false);
console.log(`\n${results.filter(r => r.ok === true).length} PASS, ${failed.length} FAIL, ${results.filter(r => r.ok === null).length} n/a · ${clock(Date.now() - t0)}`);
if (SHOTS) {
    writeFileSync(join(SHOTS, 'informe.json'), JSON.stringify({ when: new Date().toISOString(), results }, null, 1));
    const md = [`# Fallos de los criterios del tablero (${new Date().toISOString()})`, ''];
    for (const r of failed) {
        md.push(`- **${r.crit}** ${CRITERIA.find(c => c[0] === r.crit)?.[1] ?? 'La vuelta'} · ${r.scene} ${r.size}`);
        md.push(`  - ${r.detail.slice(0, 900)}`);
        if (r.shot) md.push(`  - captura: ${r.shot}`);
    }
    writeFileSync(join(SHOTS, 'fallos.md'), md.join('\n'));
}
process.exit(failed.length === 0 ? 0 : 1);
