#!/usr/bin/env node
/**
 * J20.9 de ROADMAP_SIN_CONEXION: el juego en un móvil, de punta a punta, contra un servidor
 * propio con un `--dataRoot` temporal, como `e2e-gremio.mjs`. Pantalla de teléfono (390 × 844),
 * con toques y sin pulsar ninguna tecla:
 *
 *   título → Jugar sin conexión → tu personaje (y el selector de clase) → la novela visual,
 *   sin caja de escribir ni pestañas (J18.7, J18.8) → la pausa y las opciones con su botón →
 *   la ficha → el registro → la primera pelea (el ratero del muelle, J2.1), a toques → hablar
 *   con Tomás → «Continuar» al tablero y su botón al pueblo → contratar → el tablón → Strahd →
 *   su final → volver al gremio desde él.
 *
 * En cada paso, en vertical (390 × 844) y en horizontal (844 × 390): que nada se salga por los
 * lados (J20.1, J20.5) y que cada botón a la vista mida 44 × 44 px o más (J20.3).
 *
 * Uso:
 *   node tools/e2e-movil.mjs                       # sin ventana
 *   node tools/e2e-movil.mjs --headed              # mirándolo
 *   node tools/e2e-movil.mjs --port 8155 --captura movil   # y una captura por paso: movil.01-titulo.png…
 *   node tools/e2e-movil.mjs --cpu 6               # la pelea con la CPU 6 veces más lenta (4 si no se dice)
 *
 * J20.6: la pelea a toques se juega con la CPU de un teléfono simulada (`Emulation.setCPUThrottlingRate`),
 * y se mide cuánto tarda en volver tu turno tras «Fin de turno» y cuánto trabaja el teléfono.
 */

/* global window, document, HTMLElement, PointerEvent, MouseEvent */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8135;
const BASE = `http://127.0.0.1:${PORT}`;
const HEADED = process.argv.includes('--headed');
const SHOT = argAfter('--captura');

/** Un teléfono corriente, de pie y tumbado. */
const PORTRAIT = { width: 390, height: 844 };
const LANDSCAPE = { width: 844, height: 390 };
/** Con el teclado del móvil fuera: `interactive-widget=resizes-content` encoge la página. */
const WITH_KEYBOARD = { width: 390, height: 500 };
/** Lo mínimo para un dedo (J20.3). Medio píxel de margen por el redondeo. */
const FINGER = 44;
/**
 * J20.6: la pelea se juega con la CPU de un teléfono corriente, simulada: `--cpu 4` es cuatro
 * veces más lenta que la de este ordenador (lo que usa Chrome para «móvil de gama media»).
 * `--cpu 1` la deja como está.
 */
const CPU_SLOWDOWN = Math.max(1, Number(argAfter('--cpu')) || 4);
/** J20.6: lo más que puede tardar, de mediana, en volver tu turno tras «Fin de turno», dados incluidos. */
const TURN_BUDGET_MS = 8000;

const require = createRequire(join(ROOT, 'tests/package.json'));
const { chromium } = require('@playwright/test');

let failures = 0;
const check = (/** @type {string} */ name, /** @type {boolean} */ ok, detail = '') => {
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        -> ${detail}` : ''}`);
};

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-movil-'));
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

/**
 * Lo que se ve ahora, medido: lo que se sale por los lados y los botones pequeños para un dedo.
 *
 * «Se sale» es la página más ancha que la pantalla, o una de las cajas del juego (el escenario,
 * la cabecera, la caja de la novela, una ventana…) más ancha que su sitio. Lo de dentro de una
 * fila que se desliza a propósito (las fichas, la barra de la cabecera) no cuenta: se desliza.
 *
 * Un botón «a la vista» es uno que se puede tocar ahí mismo: con tamaño, sin esconder, dentro
 * de la pantalla y sin nada encima (lo que hay en su centro es él o algo suyo).
 *
 * @param {number} finger
 */
function measureScreen(finger) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const doc = document.documentElement;
    /** @type {string[]} */
    const wide = [];
    if (doc.scrollWidth > vw + 1) wide.push(`la página mide ${doc.scrollWidth} px de ancho en una pantalla de ${vw}`);
    const boxes = ['#game-shell .gs-stage', '#game-shell .gs-head', '#game-shell .gs-actions', '#game-shell .gs-vn-box',
        '#game-shell .gs-places', '#game-shell .gs-pause-card', 'dialog[open].popup', 'dialog[open] .popup-content', '.wm-dice-overlay.active .wm-dice-card'];
    for (const selector of boxes) {
        for (const box of document.querySelectorAll(selector)) {
            const r = box.getBoundingClientRect();
            if (r.width < 2 || r.height < 2 || window.getComputedStyle(box).visibility === 'hidden') continue;
            if (box.scrollWidth > box.clientWidth + 1) wide.push(`${selector}: dentro mide ${box.scrollWidth}, cabe ${box.clientWidth}`);
            if (r.left < -1 || r.right > vw + 1) wide.push(`${selector}: de ${Math.round(r.left)} a ${Math.round(r.right)}, la pantalla ${vw}`);
        }
    }
    /** Si algo está dentro de una fila que se desliza a lo ancho. */
    const inScroller = (/** @type {Element} */ node) => {
        for (let p = node.parentElement; p; p = p.parentElement) {
            if (/(auto|scroll)/.test(window.getComputedStyle(p).overflowX) && p.scrollWidth > p.clientWidth + 1) return true;
        }
        return false;
    };
    /** @type {string[]} */
    const small = [];
    let seen = 0;
    for (const button of document.querySelectorAll('button, [role="button"], .menu_button, input[type="button"], input[type="submit"]')) {
        // La barra de SillyTavern (vuelve en pausa) es suya, no del juego.
        if (button.closest('#top-settings-holder, #top-bar')) continue;
        const r = button.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        const css = window.getComputedStyle(button);
        if (css.visibility === 'hidden' || Number(css.opacity) === 0) continue;
        if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) continue;
        const x = Math.min(Math.max(r.left + r.width / 2, 0), vw - 1);
        const y = Math.min(Math.max(r.top + r.height / 2, 0), vh - 1);
        const top = document.elementFromPoint(x, y);
        if (!top || !(top === button || button.contains(top))) continue;
        seen++;
        const name = `${button.tagName.toLowerCase()}.${[...button.classList].slice(0, 2).join('.')}`
            + `「${(button.textContent || button.getAttribute('title') || button.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 18)}」`;
        if (r.width < finger - 0.5 || r.height < finger - 0.5) small.push(`${name} ${Math.round(r.width)}×${Math.round(r.height)}`);
        if ((r.left < -1 || r.right > vw + 1) && !inScroller(button)) wide.push(`${name} se sale: de ${Math.round(r.left)} a ${Math.round(r.right)}`);
    }
    return { wide, small, seen, width: vw, height: vh };
}

try {
    await startServer();
    browser = await chromium.launch({ channel: 'msedge', headless: !HEADED });
    // Un Android corriente: tamaño de teléfono, toques y su navegador.
    const context = await browser.newContext({
        viewport: PORTRAIT,
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
    });
    page = await context.newPage();
    /** @type {string[]} */
    const problems = [];
    page.on('pageerror', e => problems.push(`PAGEERROR ${e.message}`));
    page.on('console', m => {
        if (m.type() === 'error' && !/Failed to load resource.*404/.test(m.text())) problems.push(`ERROR ${m.text().slice(0, 300)}`);
    });
    // Ni una tecla en toda la vuelta (J20.4): si algo la pulsa, se apunta.
    await context.addInitScript(() => {
        const seen = /** @type {any} */ (window);
        seen.__keys = [];
        window.addEventListener('keydown', (event) => seen.__keys.push(event.key), true);
        try {
            // Los consejos, vistos: aquí se mira el tamaño de las cosas, no enseñar a jugar.
            window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,combat,travel,prisoners,mesa,high,spell,pet,bill,move,attack,roll,talk,journal');
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
            window.localStorage.setItem('sillytavern_gameSucesos', 'off');
            // Las escenas del hilo y las charlas escritas (J9.2, J8) las mira e2e-historia; aquí taparían clics.
            window.localStorage.setItem('sillytavern_gameStoryWindows', 'off');
        } catch { /* nada */ }
    });

    /** Lo que el juego sabe ahora: el mundo, el grupo y si hay pelea. */
    const state = () => page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const party = (await import('/scripts/party.js')).getPartyMembersSnapshot();
        return {
            world: String(ctx.chatMetadata?.world_info ?? ''),
            board: String(ctx.chatMetadata?.currentBoard ?? ''),
            party: party.map((/** @type {any} */ m) => String(m.name)),
            fighting: Boolean(ctx.chatMetadata?.combatEncounter?.active),
        };
    });
    const chips = () => page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-chip-action')].map(c => (c.textContent || '').trim()));
    /**
     * Tocar una ficha de acción, como con el dedo: la fila se desliza hasta ella si hace falta. La
     * que se ve: sin conexión la fila está en la novela y al pie del pueblo y del tablero (J18.8).
     */
    const tapChip = (/** @type {RegExp} */ pattern) => page.locator('#game-shell .gs-chip-action').filter({ hasText: pattern }).filter({ visible: true }).first()
        .tap({ timeout: 8000 }).then(() => true).catch(() => false);
    /** La escena que se ve. */
    const sceneNow = () => page.evaluate(() => document.querySelector('#game-shell')?.getAttribute('data-scene') || '');
    /** J18.8: tocar «Continuar» mientras se lee, hasta llegar a la escena que toca. */
    const carryOn = async (/** @type {string} */ wanted) => {
        await until(async () => {
            if (await sceneNow() === wanted) return true;
            const next = page.locator('#game-shell .gs-vn-box .gs-chip-continue').filter({ visible: true });
            if (await next.count() > 0) await next.first().tap({ timeout: 3000 }).catch(() => {});
            return false;
        }, 10000);
        return sceneNow();
    };
    const chatHas = (/** @type {RegExp} */ pattern) => page.evaluate((source) => (window.SillyTavern.getContext().chat || [])
        .some((/** @type {any} */ m) => new RegExp(source).test(String(m.extra?.display_text || m.mes || ''))), pattern.source);
    /** Espera a que se cumpla algo, sin dormir de más. */
    const until = async (/** @type {() => Promise<boolean>} */ test, ms = 30000) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (await test().catch(() => false)) return true;
            await page.waitForTimeout(400);
        }
        return false;
    };
    /** Los dados que quedan en pantalla se pasan tocando «Siguiente». Dice si había alguno. */
    const tapDice = async () => {
        let any = false;
        for (let i = 0; i < 30; i++) {
            const next = page.locator('.wm-dice-overlay.active .wm-dice-next');
            if (await next.count() === 0) break;
            const tapped = await next.tap({ timeout: 1500 }).then(() => true).catch(() => false);
            if (!tapped) break;
            any = true;
            await page.waitForTimeout(250);
        }
        return any;
    };
    const noToasts = () => page.evaluate(() => document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));
    /** Si algo se ve de verdad: con tamaño y dentro de la pantalla. */
    const shown = (/** @type {string} */ selector) => page.evaluate((s) => [...document.querySelectorAll(s)].some(node => {
        const r = node.getBoundingClientRect();
        return r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < window.innerHeight && window.getComputedStyle(node).visibility !== 'hidden';
    }), selector);

    /**
     * J20.2: el centro en pantalla de lo primero que case y se pueda tocar ahí mismo (sin nada
     * encima), con su casilla si la dice. Nada si no hay ninguno.
     */
    const tapPoint = (/** @type {string} */ selector) => page.evaluate((s) => {
        for (const node of document.querySelectorAll(s)) {
            const r = node.getBoundingClientRect();
            if (r.width < 2 || r.height < 2) continue;
            const x = r.left + r.width / 2;
            const y = r.top + r.height / 2;
            if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) continue;
            const top = document.elementFromPoint(x, y);
            if (top && (top === node || node.contains(top))) {
                return { x, y, gx: Number(node.getAttribute('data-x')), gy: Number(node.getAttribute('data-y')) };
            }
        }
        return null;
    }, selector);
    /** Dónde está el héroe en el tablero. */
    const heroCell = () => page.evaluate(async () => {
        const hero = (await import('/scripts/party.js')).getPartyMembersSnapshot()[0];
        return { id: Number(hero?.id), x: Number(hero?.mapPosition?.gridX) || 0, y: Number(hero?.mapPosition?.gridY) || 0 };
    });
    /** Cómo está la cámara del tablero: su `transform`. */
    const cameraNow = () => page.evaluate(() => {
        const content = document.querySelector('#game-shell .gs-scene-map .wm-container .wm-content');
        return content instanceof HTMLElement ? content.style.transform : '';
    });
    /**
     * J20.2: arrastrar el dedo (o dos, pellizcando) por el tablero. Los toques de Playwright
     * solo tocan: el arrastre se hace con los mismos eventos de puntero que manda el teléfono.
     *
     * @param {Array<Array<[number, number]>>} tracks Por cada dedo, sus puntos de pantalla.
     */
    const dragFingers = (tracks) => page.evaluate((all) => {
        const board = document.querySelector('#game-shell .gs-scene-map .wm-container');
        if (!board) return false;
        const fire = (/** @type {string} */ type, /** @type {number} */ finger, /** @type {[number, number]} */ at) => board.dispatchEvent(new PointerEvent(type, {
            pointerId: 40 + finger, pointerType: 'touch', isPrimary: finger === 0, clientX: at[0], clientY: at[1], bubbles: true, cancelable: true,
        }));
        all.forEach((track, finger) => fire('pointerdown', finger, track[0]));
        const steps = Math.max(...all.map(t => t.length));
        for (let i = 1; i < steps; i++) all.forEach((track, finger) => fire('pointermove', finger, track[Math.min(i, track.length - 1)]));
        all.forEach((track, finger) => fire('pointerup', finger, track[track.length - 1]));
        return true;
    }, tracks);

    let step = 0;
    /**
     * Un paso de la vuelta: se mide y se fotografía en vertical y, girando el teléfono, en
     * horizontal; y se vuelve a vertical para seguir.
     *
     * @param {string} name
     * @param {{landscape?: boolean}} [opts]
     */
    const look = async (name, { landscape = true } = {}) => {
        step++;
        const tag = `${String(step).padStart(2, '0')}-${name}`;
        await noToasts();
        await page.waitForTimeout(400);
        const upright = await page.evaluate(measureScreen, FINGER);
        if (SHOT) await page.screenshot({ path: `${SHOT}.${tag}.png` });
        check(`${name}, en vertical: nada se sale por los lados (J20.1, J20.5)`, upright.wide.length === 0, upright.wide.slice(0, 6).join(' | '));
        check(`${name}, en vertical: los ${upright.seen} botones a la vista miden 44 × 44 o más (J20.3)`, upright.small.length === 0, upright.small.slice(0, 10).join(' | '));
        if (!landscape) return upright;
        await page.setViewportSize(LANDSCAPE);
        await page.waitForTimeout(700);
        await noToasts();
        const flat = await page.evaluate(measureScreen, FINGER);
        if (SHOT) await page.screenshot({ path: `${SHOT}.${tag}.horizontal.png` });
        check(`${name}, en horizontal: nada se sale por los lados (J20.1, J20.5)`, flat.wide.length === 0, flat.wide.slice(0, 6).join(' | '));
        check(`${name}, en horizontal: los ${flat.seen} botones a la vista miden 44 × 44 o más (J20.3)`, flat.small.length === 0, flat.small.slice(0, 10).join(' | '));
        await page.setViewportSize(PORTRAIT);
        await page.waitForTimeout(700);
        return upright;
    };

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    // El juego tarda en arrancar con la máquina ocupada; la bienvenida de la primera vez, si
    // sale, se cierra tocando «OK».
    const opened = await until(async () => {
        if (await page.locator('#game-shell').count() > 0) return true;
        const welcome = page.locator('dialog[open]:has-text("Welcome to SillyTavern!") .popup-button-ok');
        if (await welcome.count() > 0) await welcome.first().tap({ timeout: 3000 }).catch(() => {});
        return false;
    }, 240000);
    if (!opened) throw new Error('el juego no se abrió en 4 minutos');
    // El juego se monta antes de que acabe de cargar la página: hasta entonces la tapa la
    // pantalla de carga de SillyTavern, y lo que se mediría sería ella.
    await until(() => page.evaluate(() => !document.querySelector('#preloader')), 180000);
    const coarse = await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches);
    check('el navegador se presenta como un teléfono táctil: (pointer: coarse)', coarse);

    // 1. El título.
    const offline = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Jugar sin conexión' });
    await until(async () => await offline.count() === 1, 30000);
    await look('titulo');

    // 2. Tu personaje: una columna, y el selector de clase a pantalla entera (J20.5).
    await offline.tap();
    const creator = await page.waitForSelector('.hc-root', { timeout: 120000 }).then(() => true).catch(() => false);
    check('se abre la creación de personaje', creator);
    await page.waitForTimeout(600);
    await look('personaje');
    const columns = await page.evaluate(() => {
        const left = document.querySelector('.hc-root .hc-left')?.getBoundingClientRect();
        const right = document.querySelector('.hc-root .hc-right')?.getBoundingClientRect();
        return { stacked: Boolean(left && right && Math.abs(left.left - right.left) < 2), left: left?.width ?? 0, screen: window.innerWidth };
    });
    check('crear personaje va en una columna (J20.5)', columns.stacked, JSON.stringify(columns));
    // Escribir el nombre no pulsa teclas: el teclado del móvil pone el texto de una vez.
    await page.locator('.hc-root .hc-name').fill('Nerea');
    await page.locator('.hc-root .hc-gender[data-value="Mujer"]').tap();
    /** Elegir en una tarjeta tocando: abrir su selector y tocar la opción. */
    const pick = async (/** @type {string} */ which, /** @type {string} */ wanted, /** @type {string} */ shot = '') => {
        await page.locator(`.hc-root .hc-card[data-pick="${which}"] .hc-pick`).tap();
        await page.waitForSelector('.hc-picker .hc-option', { timeout: 15000 });
        await page.waitForTimeout(400);
        if (shot) {
            await look(shot);
            const full = await page.evaluate(() => {
                const popup = document.querySelector('.hc-picker')?.closest('.popup')?.getBoundingClientRect();
                return popup ? { w: Math.round(popup.width), h: Math.round(popup.height), sw: window.innerWidth, sh: window.innerHeight } : null;
            });
            check('el selector de clase, a pantalla entera (J20.5)', Boolean(full && full.w >= full.sw - 2 && full.h >= full.sh - 2), JSON.stringify(full));
        }
        const option = page.locator('.hc-picker .hc-option').filter({ hasText: wanted }).first();
        await (await option.count() ? option : page.locator('.hc-picker .hc-option').first()).tap();
        await page.waitForSelector('.hc-picker', { state: 'detached', timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(300);
    };
    await pick('race', 'Humano');
    await pick('class', 'Guerrero', 'selector-de-clase');
    await look('personaje-hecho');
    await page.locator('.hc-root .hc-enter').tap();
    const inHub = await until(async () => {
        const now = await state();
        return /Gremio/.test(now.world) && now.party[0] === 'Nerea';
    }, 60000);
    check('empieza en el gremio, con Nerea', inHub, JSON.stringify(await state()));
    const canFight = await until(async () => (await chips()).some(c => /^Iniciar combate/.test(c)), 30000);
    check('al llegar, la fila ofrece la primera pelea', canFight, JSON.stringify(await chips()));

    // 3. La novela visual: a pantalla entera, la caja abajo y las fichas en una fila que se desliza.
    await page.waitForTimeout(800);
    await look('novela');
    const novel = await page.evaluate(() => {
        const box = document.querySelector('#game-shell .gs-vn-box')?.getBoundingClientRect();
        const row = document.querySelector('#game-shell .gs-vn-box > .gs-chips');
        const tops = [...document.querySelectorAll('#game-shell .gs-vn-box .gs-chip-action')].map(c => Math.round(c.getBoundingClientRect().top));
        return {
            scene: document.querySelector('#game-shell')?.getAttribute('data-scene') || '',
            boxWidth: Math.round(box?.width ?? 0),
            screen: window.innerWidth,
            oneRow: tops.length > 0 && tops.every(t => Math.abs(t - tops[0]) <= 2),
            slides: row ? window.getComputedStyle(row).overflowX : '',
            chips: tops.length,
        };
    });
    check('la novela va a lo ancho del teléfono, con las fichas en una sola fila que se desliza (J20.1)',
        novel.scene === 'dialogue' && novel.boxWidth >= novel.screen - 32 && novel.oneRow && /auto|scroll/.test(novel.slides), JSON.stringify(novel));
    // Si habla alguien con retrato, el retrato va encima de la caja. La frase se quita después.
    await page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/sendas name="Brunilda" Aquí se viene a trabajar, no a mirar.'));
    await page.evaluate(async () => (await import('/scripts/game-engine/ui/shell/game-shell.js')).refreshGameShell());
    await until(() => shown('#game-shell .gs-vn-portrait:not([hidden]) img'), 8000);
    const portrait = await page.evaluate(() => {
        const face = document.querySelector('#game-shell .gs-vn-portrait:not([hidden])')?.getBoundingClientRect();
        const box = document.querySelector('#game-shell .gs-vn-box')?.getBoundingClientRect();
        return face && box ? { face: [Math.round(face.top), Math.round(face.bottom), Math.round(face.height)], box: Math.round(box.top) } : null;
    });
    check('quien habla sale en grande, encima de la caja (J20.1)', Boolean(portrait && portrait.face[2] > 80 && portrait.face[1] <= portrait.box + 30), JSON.stringify(portrait));
    await look('novela-con-retrato');
    await page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/cut {{lastMessageId}}'));
    await page.waitForTimeout(400);

    // 4. J20.4: lo que va con teclas tiene su botón: la pausa (Esc). Sin conexión (J18.7, J18.8) no
    // hay pestañas de escena, ni la X, ni caja de escribir: la escena cambia por lo que se hace.
    const bare = await page.evaluate(() => {
        const seen = (/** @type {string} */ s) => [...document.querySelectorAll(s)].some(n => {
            const r = n.getBoundingClientRect();
            return r.width > 1 && r.height > 1 && window.getComputedStyle(n).visibility !== 'hidden';
        });
        return { tabs: seen('#game-shell .gs-scene-btn'), close: seen('#game-shell .gs-close'), box: seen('#send_form') || seen('#send_textarea'), rest: seen('#game-shell .gs-clock-btn') };
    });
    check('sin conexión, en el teléfono: ni pestañas de escena, ni la X, ni caja de escribir, ni descansos en la cabecera (J18.7 a J18.9)',
        !bare.tabs && !bare.close && !bare.box && !bare.rest, JSON.stringify(bare));
    const pauseButton = page.locator('#game-shell .gs-pause-open');
    const hasPause = await pauseButton.count() > 0 && await pauseButton.first().isVisible();
    check('la pausa (Esc) tiene su botón a la vista (J20.4)', hasPause);
    if (hasPause) {
        await pauseButton.first().tap();
        const paused = await page.waitForSelector('#game-shell .gs-pause', { timeout: 5000 }).then(() => true).catch(() => false);
        check('tocarlo abre la pausa', paused);
        await look('pausa');
        await page.locator('#game-shell .gs-pause-btn').filter({ hasText: 'Opciones' }).first().tap({ timeout: 5000 }).catch(() => {});
        const options = await page.waitForSelector('.go-root', { timeout: 8000 }).then(() => true).catch(() => false);
        check('y desde ella, las opciones', options);
        if (options) {
            await look('opciones');
            await page.locator('.popup:has(.go-root) .popup-button-ok').tap({ timeout: 5000 }).catch(() => {});
            await page.waitForTimeout(400);
        }
        if (await page.locator('#game-shell .gs-pause').count() > 0) {
            await page.locator('#game-shell .gs-pause-btn').filter({ hasText: 'Continuar' }).first().tap({ timeout: 5000 }).catch(() => {});
        }
        await page.waitForTimeout(300);
        check('«Continuar» cierra la pausa, sin tecla', await page.locator('#game-shell .gs-pause').count() === 0);
    }

    // 5. La ficha: tocar tu cara en la tira del grupo.
    const face = page.locator('#game-shell .gs-party-strip .gs-chip-clickable').filter({ visible: true }).first();
    if (await face.count() > 0) {
        await face.tap({ timeout: 5000 }).catch(() => {});
        const sheet = await page.waitForSelector('.popup .ch-root', { timeout: 8000 }).then(() => true).catch(() => false);
        check('tocar tu cara abre tu ficha', sheet);
        if (sheet) {
            await look('ficha');
            await page.locator('.popup:has(.ch-root) .popup-button-ok').tap({ timeout: 5000 }).catch(() => {});
            await page.waitForTimeout(400);
        }
    } else {
        check('la tira del grupo se ve, para abrir tu ficha', false);
    }

    // 6. J18.7: sin caja de escribir, lo dicho se lee en el «Registro», que se abre y se cierra
    // tocando; y en una pantalla baja (el teclado de otra app, un teléfono pequeño) la caja de la
    // novela sigue a la vista.
    const logButton = page.locator('#game-shell .gs-vn-log-btn');
    await logButton.tap({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
    const log = await page.evaluate(() => ({
        open: document.querySelector('#game-shell')?.classList.contains('gs-vn-log') ?? false,
        lines: [...document.querySelectorAll('#game-shell #chat .mes')].filter(m => m.getBoundingClientRect().height > 1).length,
        box: [...document.querySelectorAll('#send_form, #send_textarea')].some(n => n.getBoundingClientRect().height > 1),
    }));
    await look('registro', { landscape: false });
    check('el «Registro» se abre tocando, con lo dicho, y sin caja de escribir (J18.7)', log.open && log.lines > 0 && !log.box, JSON.stringify(log));
    await logButton.tap({ timeout: 5000 }).catch(() => {});
    await page.setViewportSize(WITH_KEYBOARD);
    await page.waitForTimeout(700);
    const low = await page.evaluate(() => {
        const vh = window.innerHeight;
        const text = document.querySelector('#game-shell .gs-vn-text')?.getBoundingClientRect();
        const visible = text ? Math.max(0, Math.min(text.bottom, vh) - Math.max(text.top, 0)) : 0;
        return { text: Math.round(visible), height: vh, log: document.querySelector('#game-shell')?.classList.contains('gs-vn-log') ?? true };
    });
    if (SHOT) await page.screenshot({ path: `${SHOT}.bajo.png` });
    check('en una pantalla baja, lo último dicho sigue a la vista (J20.4)', !low.log && low.text >= 60, JSON.stringify(low));
    await page.setViewportSize(PORTRAIT);
    await page.waitForTimeout(600);

    // 7. La primera pelea (el ratero del muelle), a toques: el enemigo viene; se ataca con
    // «Atacar» y su lista, y se pasa el turno con «Fin de turno». Andar por el tablero a toques
    // es J20.2, todavía por hacer.
    await noToasts();
    await tapChip(/^Iniciar combate/);
    const fighting = await until(async () => (await state()).fighting, 10000);
    check('tocar «Iniciar combate» empieza la pelea', fighting);
    await tapDice();
    await page.waitForTimeout(800);
    await look('pelea');
    const board = await page.evaluate(() => {
        const grid = document.querySelector('#game-shell .gs-scene-map .wm-container')?.getBoundingClientRect();
        return grid ? { left: Math.round(grid.left), right: Math.round(grid.right), height: Math.round(grid.height), screen: window.innerWidth } : null;
    });
    check('el tablero cabe a lo ancho, con alto para verlo (J20.1)',
        Boolean(board && board.left >= -1 && board.right <= board.screen + 1 && board.height >= 200), JSON.stringify(board));

    // J20.2: el tablero a toques, sin nada que dependa de pasar el ratón por encima. En tu turno,
    // tocar tu ficha enciende hasta dónde llegas; tocar una casilla encendida enseña el camino y
    // lo que cuesta, sin moverte; tocarla otra vez, mueve. Tocar al enemigo abre su tarjeta.
    const myTurn = await until(async () => {
        await tapDice();
        return page.evaluate(async () => {
            const enc = (await import('/scripts/party.js')).getCombatEncounter();
            const entry = enc?.active ? enc.turnOrder?.[enc.currentTurnIndex] : null;
            return Boolean(entry && !entry.isEnemy);
        });
    }, 30000);
    await noToasts();
    const walk = { myTurn, lit: 0, hud: '', cost: '', stayed: false, moved: false, to: /** @type {any} */ (null) };
    const start = await heroCell();
    const mine = await tapPoint(`#game-shell .gs-scene-map .wm-token[data-token-id="${start.id}"]`);
    if (myTurn && mine) {
        await page.touchscreen.tap(mine.x, mine.y);
        await until(async () => (await page.locator('#game-shell .gs-scene-map .wm-highlight-move.wm-highlight-clickable').count()) > 0, 5000);
        walk.lit = await page.locator('#game-shell .gs-scene-map .wm-highlight-move.wm-highlight-clickable').count();
        // Encima del tablero, lo que le queda por andar y hasta dónde llega: escrito, no al pasar el ratón.
        walk.hud = String(await page.locator('#game-shell .gs-scene-map .wm-tactical-hud').first().textContent({ timeout: 1500 }).catch(() => ''));
        const cell = await tapPoint('#game-shell .gs-scene-map .wm-highlight-move.wm-highlight-clickable');
        if (cell) {
            walk.to = cell;
            await page.touchscreen.tap(cell.x, cell.y);
            await page.waitForTimeout(400);
            walk.cost = String(await page.locator('#game-shell .gs-scene-map .wm-path-cost.wm-path-armed').first().textContent({ timeout: 2000 }).catch(() => ''));
            const still = await heroCell();
            walk.stayed = still.x === start.x && still.y === start.y;
            if (SHOT) await page.screenshot({ path: `${SHOT}.tablero-toque-ruta.png` });
            await page.touchscreen.tap(cell.x, cell.y);
            walk.moved = await until(async () => {
                const now = await heroCell();
                return now.x === cell.gx && now.y === cell.gy;
            }, 5000);
        }
    }
    check('a toques, en tu turno: tocar tu ficha enciende casillas; tocar una enseña el camino y lo que cuesta sin moverte; tocarla otra vez mueve (J20.2)',
        walk.lit > 0 && /Te quedan \d+ pies/.test(walk.hud) && /\d+ pies · toca otra vez para ir/.test(walk.cost) && walk.stayed && walk.moved, JSON.stringify(walk));
    // Lo que el ratón enseña al pasar por encima, a toques: tocar una casilla dice qué hay en ella.
    await noToasts();
    const emptyCell = await page.evaluate(() => {
        const layer = document.querySelector('#game-shell .gs-scene-map .wm-container');
        const r = layer?.getBoundingClientRect();
        return r ? { x: r.left + r.width * 0.5, y: r.top + r.height * 0.15 } : null;
    });
    let told = '';
    if (emptyCell) {
        await page.touchscreen.tap(emptyCell.x, emptyCell.y);
        await page.waitForTimeout(300);
        told = await page.evaluate(() => {
            const info = document.querySelector('#game-shell .gs-scene-map .wm-cell-info');
            return info instanceof HTMLElement && info.style.display !== 'none' ? (info.textContent || '').trim() : '';
        });
    }
    check('a toques, tocar una casilla dice qué es, sin pasar el ratón (J20.2)', told.length > 0, told);
    // Tocar al enemigo: su tarjeta, con su cara, su vida y qué se puede hacer, y un botón para cerrarla.
    const foe = await tapPoint('#game-shell .gs-scene-map .wm-token.wm-token-enemy:not(.wm-token-idle)');
    let foeCard = { open: false, face: '', text: '' };
    if (foe) {
        await page.touchscreen.tap(foe.x, foe.y);
        foeCard = await until(() => page.evaluate(() => Boolean(document.querySelector('.tc-overlay .tc-card'))), 4000).then(() => page.evaluate(() => ({
            open: Boolean(document.querySelector('.tc-overlay .tc-card')),
            face: (document.querySelector('.tc-card .tc-face')?.getAttribute('src') || '').split('/').slice(-2).join('/'),
            text: (document.querySelector('.tc-card')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160),
        })));
        if (SHOT) await page.screenshot({ path: `${SHOT}.tablero-toque-enemigo.png` });
        await page.locator('.tc-card .tc-close').tap({ timeout: 3000 }).catch(() => {});
        await page.waitForSelector('.tc-overlay', { state: 'detached', timeout: 3000 }).catch(() => {});
    }
    check('a toques, tocar al ratero abre su tarjeta, con su dibujo y su vida escritos (J20.2, arte en pixel)',
        foeCard.open && /^bestias\//.test(foeCard.face) && /Ratero/.test(foeCard.text), JSON.stringify(foeCard));
    // La cámara: un dedo que se arrastra la mueve; dos que se separan la acercan.
    const box = await page.evaluate(() => {
        const r = document.querySelector('#game-shell .gs-scene-map .wm-container')?.getBoundingClientRect();
        return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
    });
    const camera = { before: await cameraNow(), panned: '', pinched: '' };
    if (box) {
        await dragFingers([[[box.x, box.y], [box.x + 20, box.y + 10], [box.x + 60, box.y + 30]]]);
        camera.panned = await cameraNow();
        await dragFingers([[[box.x - 20, box.y], [box.x - 50, box.y], [box.x - 90, box.y]], [[box.x + 20, box.y], [box.x + 50, box.y], [box.x + 90, box.y]]]);
        camera.pinched = await cameraNow();
    }
    // El navegador lo escribe «scale(0.58, 0.58)».
    const scaleOf = (/** @type {string} */ t) => Number(/scale\(([\d.]+)/.exec(t)?.[1] ?? 0);
    check('a toques, un dedo arrastra la cámara y dos, al separarse, la acercan (J20.2)',
        camera.panned !== camera.before && scaleOf(camera.pinched) > scaleOf(camera.panned), JSON.stringify(camera));
    // Doble toque: la cámara vuelve a encuadrar el tablero, para seguir la pelea.
    await page.evaluate(() => document.querySelector('#game-shell .gs-scene-map .wm-container')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
    await page.waitForTimeout(300);

    // J20.6: el resto de la pelea, con la CPU de un teléfono corriente: cuánto tarda en volver tu
    // turno tras «Fin de turno» y cuánto trabaja el teléfono (las tareas largas, de más de 50 ms).
    const cdp = CPU_SLOWDOWN > 1 ? await context.newCDPSession(page) : null;
    if (cdp) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });
    await page.evaluate(() => {
        const seen = /** @type {any} */ (window);
        seen.__busy = 0;
        try {
            new PerformanceObserver((list) => { for (const entry of list.getEntries()) seen.__busy += entry.duration; }).observe({ type: 'longtask' });
        } catch { /* sin «longtask», solo se mide el tiempo */ }
    });
    /** @type {number[]} */
    const turnTimes = [];
    let turnFrom = 0;
    const fight = { attacks: 0, turns: 0, sheet: false };
    const fightEnd = Date.now() + 150000 * Math.min(CPU_SLOWDOWN, 2);
    while (Date.now() < fightEnd && (await state()).fighting) {
        if (await tapDice()) continue;
        await noToasts();
        const attack = page.locator('#game-shell .gs-actions .gs-btn-attack');
        const endTurn = page.locator('#game-shell .gs-actions .gs-btn').filter({ hasText: 'Fin de turno' });
        if (await attack.count() > 0 && await attack.isEnabled().catch(() => false)) {
            if (turnFrom) {
                turnTimes.push(Date.now() - turnFrom);
                turnFrom = 0;
            }
            await attack.tap({ timeout: 4000 }).catch(() => {});
            const target = page.locator('#game-shell .gs-targets .gs-target');
            if (await target.first().waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
                if (!fight.sheet) {
                    fight.sheet = true;
                    await look('objetivos', { landscape: false });
                }
                await target.first().tap({ timeout: 4000 }).then(() => { fight.attacks++; }).catch(() => {});
            }
            await page.waitForTimeout(700);
            continue;
        }
        if (await endTurn.count() > 0 && await endTurn.isEnabled().catch(() => false)) {
            await endTurn.tap({ timeout: 4000 }).then(() => {
                fight.turns++;
                turnFrom = Date.now();
            }).catch(() => {});
            await page.waitForTimeout(900);
            continue;
        }
        await page.waitForTimeout(500);
    }
    if (cdp) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const busy = await page.evaluate(() => Math.round(/** @type {any} */ (window).__busy || 0));
    const sortedTurns = [...turnTimes].sort((a, b) => a - b);
    const medianTurn = sortedTurns.length ? sortedTurns[Math.floor(sortedTurns.length / 2)] : 0;
    console.log(`      J20.6, con la CPU ${CPU_SLOWDOWN} veces más lenta: ${turnTimes.length} vuelta(s) de turno, ${turnTimes.map(t => `${(t / 1000).toFixed(1)} s`).join(', ') || '—'};`
        + ` el teléfono, ocupado ${(busy / 1000).toFixed(1)} s en tareas largas (${fight.attacks} ataque(s), ${fight.turns} fin(es) de turno).`);
    check(`J20.6: con la CPU de un móvil (${CPU_SLOWDOWN}×), tu turno vuelve en menos de ${TURN_BUDGET_MS / 1000} s tras «Fin de turno», de mediana`,
        medianTurn <= TURN_BUDGET_MS, JSON.stringify({ turnTimes, medianTurn, busy }));
    const wonByTaps = !(await state()).fighting;
    check('la primera pelea se gana a toques: «Atacar», su lista y «Fin de turno» (J20.9)', wonByTaps && fight.attacks > 0, JSON.stringify(fight));
    if (!wonByTaps) {
        // Para seguir la vuelta: la pelea se acaba como en e2e-gremio.
        await page.evaluate(async () => {
            const enc = (await import('/scripts/party.js')).getCombatEncounter();
            for (const e of enc?.enemies ?? []) e.currentHp = 0;
        });
        for (let i = 0; i < 8 && (await state()).fighting; i++) {
            await page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/combat-end'));
            await page.waitForTimeout(700);
            await tapDice();
        }
    }
    await tapDice();
    // La tarjeta de la victoria se cierra tocándola, como quien la ha leído.
    const victory = page.locator('.vs-card');
    if (await victory.count() > 0) await victory.first().tap({ timeout: 4000 }).catch(() => {});
    // La historia sigue: en el muelle, Tomás da las gracias (J2.1); antes era el tablón.
    const moved = await until(() => chatHas(/Soy Tomás|apunta tu nombre en el libro del gremio/), 20000);
    check('ganada la primera pelea, la historia sigue', moved && !(await state()).fighting);
    await noToasts();

    // 7b. Hablar con alguien: la ventana de la charla, con sus temas (J20.5).
    const talk = (await chips()).find(c => /^Hablar con /.test(c));
    if (talk) {
        await tapChip(new RegExp(`^${talk}$`));
        const talking = await page.waitForSelector('.popup:visible .tk-root', { timeout: 10000 }).then(() => true).catch(() => false);
        check(`«${talk}» abre la charla`, talking);
        if (talking) {
            await page.waitForTimeout(500);
            await look('charla');
            await page.locator('.popup:visible:has(.tk-root) .popup-button-ok').first().tap({ timeout: 5000 }).catch(() => {});
            await page.waitForSelector('.tk-root', { state: 'detached', timeout: 5000 }).catch(() => {});
            await page.waitForTimeout(500);
        }
    }
    await noToasts();

    // 8. J18.8: sin pestañas. «Continuar» lleva al tablero (seguís en el muelle), con lo que se
    // puede hacer al pie; su botón lleva al pueblo: los sitios, los tableros y viajar, en una columna.
    const toBoard = await carryOn('combat');
    check('«Continuar», tocado, lleva al tablero del muelle (J18.8)', toBoard === 'combat', toBoard);
    await look('tablero');
    // J20.2: sin pelea también se anda a toques (con el dedo no se arrastra): tocar tu ficha la
    // elige y enciende hasta dónde anda de una vez; una casilla encendida, dos toques, y va.
    await noToasts();
    const stroll = { lit: 0, legend: '', cost: '', moved: false };
    const from = await heroCell();
    const me = await tapPoint(`#game-shell .gs-scene-map .wm-token[data-token-id="${from.id}"]`);
    if (me) {
        await page.touchscreen.tap(me.x, me.y);
        await until(async () => (await page.locator('#game-shell .gs-scene-map .wm-highlight-move.wm-highlight-clickable').count()) > 0, 5000);
        stroll.lit = await page.locator('#game-shell .gs-scene-map .wm-highlight-move.wm-highlight-clickable').count();
        stroll.legend = String(await page.locator('#game-shell .gs-scene-map .wm-tactical-hud').first().textContent({ timeout: 1500 }).catch(() => ''));
        const spot = await tapPoint('#game-shell .gs-scene-map .wm-highlight-move.wm-highlight-clickable');
        if (spot) {
            await page.touchscreen.tap(spot.x, spot.y);
            await page.waitForTimeout(400);
            stroll.cost = String(await page.locator('#game-shell .gs-scene-map .wm-path-cost.wm-path-armed').first().textContent({ timeout: 2000 }).catch(() => ''));
            await page.touchscreen.tap(spot.x, spot.y);
            stroll.moved = await until(async () => {
                const now = await heroCell();
                return now.x === spot.gx && now.y === spot.gy;
            }, 5000);
        }
    }
    check('sin pelea, a toques: tocar tu ficha enciende hasta dónde anda, y dos toques en una casilla la llevan allí (J20.2)',
        stroll.lit > 0 && /Pulsa una casilla encendida para ir/.test(stroll.legend) && /toca otra vez para ir/.test(stroll.cost) && stroll.moved, JSON.stringify(stroll));
    await page.locator('#game-shell .gs-scene-map .wm-leave-loc-btn').filter({ visible: true }).first().tap({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(800);
    const toTown = await carryOn('exploration');
    check('el botón del tablero lleva al pueblo, sin pestañas (J18.8)', toTown === 'exploration', toTown);
    await look('explorar');

    // 8b. D-J28: el tablón y los mercenarios salen al acabar la prueba de la bodega. Aquí se salta
    // (J2.3), tocando su ficha y «Saltarla»: la bodega a toques ya la cubren la pelea del muelle.
    await noToasts();
    if (await tapChip(/^Saltar la prueba$/)) {
        const skip = page.locator('.popup:visible .popup-button-ok').first();
        if (await skip.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)) await skip.tap({ timeout: 5000 }).catch(() => {});
        await until(() => chatHas(/apunta tu nombre en el libro del gremio/), 15000);
        await page.waitForTimeout(800);
        await tapDice();
    }
    const boardOffered = await until(async () => (await chips()).some(c => /Tablón de campañas/.test(c)), 15000);
    check('saltada la prueba, se ofrecen el tablón y contratar (D-J28, J2.3)', boardOffered, JSON.stringify(await chips()));

    // 9. Contratar, si la fila lo ofrece aquí.
    if ((await chips()).some(c => /Contratar mercenarios/.test(c))) {
        await tapChip(/Contratar mercenarios/);
        const hire = await page.waitForSelector('.hb-root [data-hireling]', { timeout: 15000 }).then(() => true).catch(() => false);
        check('«Contratar mercenarios» abre sus tarjetas', hire);
        if (hire) {
            await page.waitForTimeout(500);
            await look('mercenarios');
            await page.locator('.hb-root .hb-close').tap({ timeout: 5000 }).catch(() => {});
            await page.waitForTimeout(500);
        }
    }

    // 10. El tablón de campañas, y Strahd.
    const boardChip = await tapChip(/Tablón de campañas/);
    const hub = await page.waitForSelector('.hb-root [data-campaign]', { timeout: 15000 }).then(() => true).catch(() => false);
    check('el tablón de campañas se abre tocando su ficha', boardChip && hub);
    const hubWorld = (await state()).world;
    if (hub) {
        await page.waitForTimeout(600);
        await look('tablon');
        await page.locator('.hb-root [data-campaign="strahd"]').tap({ timeout: 8000 }).catch(() => {});
        const inStrahd = await until(async () => /Strahd/.test((await state()).world), 120000);
        check('tocar Strahd en el tablón la empieza', inStrahd);
        await page.waitForTimeout(1500);
        await tapDice();
        await look('strahd');

        // 11. El final de Strahd, como en e2e-gremio, y volver al gremio desde él con un toque.
        const strahdWorld = (await state()).world;
        await until(() => page.evaluate((world) => {
            const meta = window.SillyTavern.getContext().chatMetadata;
            return meta?.world_info === world && Boolean(meta?.plotState) && Boolean(meta?.plot);
        }, strahdWorld), 30000);
        await page.waitForTimeout(800);
        await tapDice();
        await noToasts();
        await page.evaluate(async () => {
            const meta = window.SillyTavern.getContext().chatMetadata;
            const plot = meta.plotState || { open: [], done: [] };
            meta.plotState = { ...plot, open: [...new Set([...(plot.open || []), 'el-senor-de-barovia'])] };
            (await import('/scripts/party.js')).notePlot({ kind: 'win', place: 'Castillo Ravenloft', board: 'La Cripta de Strahd' });
        });
        const ending = await page.waitForSelector('.popup:visible .end-root', { timeout: 15000 }).then(() => true).catch(() => false);
        check('al ganar en la cripta sale el final', ending);
        if (ending) {
            await page.waitForTimeout(500);
            await look('final');
            await page.locator('.popup:visible .end-home').tap({ timeout: 5000 }).catch(() => {});
            const home = await until(async () => (await state()).world === hubWorld, 60000);
            check('«Volver al gremio» desde el final, con un toque, lleva al gremio', home, JSON.stringify(await state()));
            await page.waitForTimeout(1200);
            await tapDice();
            await look('de-vuelta', { landscape: false });
        }
    }

    const keys = await page.evaluate(() => /** @type {string[]} */ (/** @type {any} */ (window).__keys || []));
    check('en toda la vuelta no se ha pulsado ni una tecla (J20.4)', keys.length === 0, JSON.stringify(keys.slice(0, 10)));
    check('sin errores en la página', problems.length === 0, problems.slice(0, 6).join('\n        '));
} catch (error) {
    failures++;
    console.log(`FAIL  the run threw: ${/** @type {any} */ (error)?.message || error}`);
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
