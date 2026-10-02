#!/usr/bin/env node
/**
 * J15.5 de wiki/ROADMAP_SIN_CONEXION.md: el juego sin conexión, jugado con el teclado solo.
 *
 * Contra un servidor propio con un `--dataRoot` temporal, como `e2e-quick.mjs`. No hay ni un clic
 * ni una orden escrita: solo teclas (Tab, Mayús+Tab, flechas, Intro, Espacio, Esc, Av Pág). Lo
 * que se lee de la página es para comprobar, nunca para pulsar.
 *
 *   título (el foco se ve; flechas por el menú) → Opciones («Animaciones»: el foco sigue en la
 *   fila; «reducir movimiento» del aparato se respeta) → Jugar sin conexión → crear personaje
 *   (las ventanas para elegir abren con el foco en una opción; flechas; Esc cierra solo el
 *   selector; la fila de la cara no pierde el foco) → la escena del hilo con Intro → la pausa
 *   (Esc, Tab en círculo, Esc y el foco vuelve) → «Saltar la prueba» (la ventana de sí o no, con
 *   el foco dentro) → el pueblo (flechas) → la Casa del Gremio (flechas; Esc, la pausa) → el
 *   tablón de campañas (una ventana: el foco dentro, Esc la cierra y el foco vuelve).
 *   En cada pantalla: el contraste del texto y que todo botón tenga nombre.
 *
 *   El tablero de combate se rehace aparte (ENCARGO_COMBATE_VTT) y trae sus propias teclas: la
 *   pelea del muelle con el teclado solo va con `--pelea` (los dados, el cursor del tablero, la
 *   tarjeta del enemigo).
 *
 * Uso:
 *   node tools/e2e-teclado.mjs                       # sin ventana, puerto 8428
 *   node tools/e2e-teclado.mjs --headed
 *   node tools/e2e-teclado.mjs --port 8428 --captura t.png   # t.png.titulo.png, t.png.crear.png…
 *   node tools/e2e-teclado.mjs --pelea               # y la pelea del muelle, en vez de saltarla
 */

/* global window, document, getComputedStyle, innerHeight, NodeFilter, HTMLElement */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8428;
const BASE = `http://127.0.0.1:${PORT}`;
const HEADED = process.argv.includes('--headed');
const FIGHT = process.argv.includes('--pelea');
const SHOT = argAfter('--captura');

const require = createRequire(join(ROOT, 'tests/package.json'));
const { chromium } = require('@playwright/test');

let failures = 0;
const check = (/** @type {string} */ name, /** @type {boolean} */ ok, detail = '') => {
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        -> ${detail}` : ''}`);
};

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-teclado-'));
/** @type {any} */
let server = null;
/** @type {any} */
let browser = null;

/** Lo último que dijo el servidor: si se cae a mitad, el informe dice por qué. */
let serverTail = '';

function startServer() {
    server = spawn(process.execPath, ['server.js', '--browserLaunchEnabled', 'false', '--port', String(PORT), '--dataRoot', dataRoot], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    const child = server;
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('the server did not start in 180s')), 180000);
        let up = false;
        const watch = (/** @type {any} */ buffer) => {
            const text = String(buffer);
            serverTail = (serverTail + text).slice(-3000);
            if (!up && (text.includes(String(PORT)) || text.toLowerCase().includes('listening'))) {
                up = true;
                clearTimeout(timer);
                setTimeout(() => resolve(child), 1500);
            }
        };
        child.stdout.on('data', watch);
        child.stderr.on('data', watch);
        child.on('exit', (/** @type {number} */ code) => {
            if (!up) reject(new Error(`the server exited with code ${code}`));
            else console.log(`(el servidor se cerró con el código ${code}; lo último que dijo:)\n${serverTail.slice(-1500)}`);
        });
    });
}

// ---------------------------------------------------------------- lo que se lee de la página

/** Lo que tiene el foco, dicho corto, y si su anillo se ve (un contorno de 2 px o más). */
function focusNow() {
    const a = document.activeElement;
    if (!a || a === document.body || a === document.documentElement) return { lost: true, cls: 'BODY', text: '', ring: false, inDialog: false, tag: '' };
    const cs = getComputedStyle(a);
    const ring = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2;
    const text = (a.getAttribute('aria-label') || a.textContent || a.getAttribute('title') || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    return {
        lost: false,
        tag: a.tagName.toLowerCase(),
        cls: String(a.className || ''),
        text,
        ring,
        inDialog: Boolean(a.closest('dialog[open], [role="dialog"]')),
        data: { ...(/** @type {HTMLElement} */ (a).dataset || {}) },
    };
}

/** Lo que se ve del juego: la escena, las ventanas, el creador, la pausa, los dados. */
function gameNow() {
    const shell = document.querySelector('#game-shell');
    const dice = document.querySelector('.wm-dice-overlay.active');
    return {
        scene: shell?.getAttribute('data-scene') || '',
        dialogs: document.querySelectorAll('dialog[open]:not([closing])').length,
        creator: document.querySelectorAll('.hc-root').length,
        picker: document.querySelectorAll('.hc-picker').length,
        paused: document.querySelectorAll('#game-shell .gs-pause').length,
        dice: Boolean(dice),
        diceReady: Boolean(dice && !(/** @type {HTMLButtonElement|null} */ (dice.querySelector('.wm-dice-next')))?.disabled),
        card: document.querySelectorAll('.tc-overlay').length,
        targets: document.querySelectorAll('#game-shell .gs-targets').length,
        town: document.querySelector('#game-shell .gs-town-scene')?.getAttribute('data-place') || '',
        places: [...document.querySelectorAll('#game-shell .gs-town-place')].filter(n => n.getClientRects().length > 0).length,
        hint: document.querySelector('.gs-board-hint')?.textContent || '',
        motion: document.documentElement.getAttribute('data-gs-motion') || '',
    };
}

/**
 * Los textos del juego que no llegan al contraste de la WCAG (4,5 a 1; 3 a 1 si son grandes),
 * contra su fondo de verdad (las capas de color de debajo). Sobre una imagen, lo peor de un
 * fondo oscuro y uno medio. Lo desactivado no cuenta (la WCAG lo deja fuera).
 */
function contrastAudit() {
    const parse = (/** @type {string} */ c) => {
        const m = /rgba?\(([^)]+)\)/.exec(c);
        if (!m) return null;
        const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
        return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 };
    };
    const lum = (/** @type {number[]} */ rgb) => {
        const [r, g, b] = rgb.map(v => {
            const c = v / 255;
            return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (/** @type {number[]} */ a, /** @type {number[]} */ b) => {
        const x = lum(a);
        const y = lum(b);
        return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };
    const blend = (/** @type {number[]} */ top, /** @type {number} */ a, /** @type {number[]} */ under) => top.map((v, i) => Math.round(v * a + under[i] * (1 - a)));
    const bgOf = (/** @type {Element} */ el) => {
        /** @type {any[]} */
        const layers = [];
        for (let n = /** @type {Element|null} */ (el); n; n = n.parentElement) {
            const cs = getComputedStyle(n);
            if (cs.backgroundImage && cs.backgroundImage !== 'none' && !/gradient/.test(cs.backgroundImage)) {
                layers.push({ image: true });
                break;
            }
            const c = parse(cs.backgroundColor);
            if (c && c.a > 0) {
                layers.push(c);
                if (c.a >= 0.99) break;
            }
        }
        const image = layers.length > 0 && layers[layers.length - 1].image;
        const solid = layers.filter(l => !l.image);
        const under = (/** @type {number[]} */ base) => {
            let out = base;
            for (let i = solid.length - 1; i >= 0; i--) out = blend(solid[i].rgb, solid[i].a, out);
            return out;
        };
        return image ? { rgb: under([60, 50, 40]), alt: under([128, 118, 100]) } : { rgb: under([0, 0, 0]), alt: null };
    };
    const seen = new Set();
    const rows = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
        const text = (t.textContent || '').trim();
        const el = t.parentElement;
        if (!text || !el || seen.has(el)) continue;
        seen.add(el);
        if (!el.closest('#game-shell, dialog[open], .tc-overlay, .wm-dice-overlay.active')) continue;
        if (el.closest(':disabled, [aria-disabled="true"], .disabled, [inert], .toast')) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden') continue;
        let op = 1;
        for (let n = /** @type {Element|null} */ (el); n; n = n.parentElement) op *= Number(getComputedStyle(n).opacity);
        if (op < 0.05) continue;
        const fg = parse(cs.color);
        if (!fg) continue;
        const bg = bgOf(el);
        const size = parseFloat(cs.fontSize);
        const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
        const need = large ? 3 : 4.5;
        let k = ratio(blend(fg.rgb, fg.a * op, bg.rgb), bg.rgb);
        if (bg.alt) k = Math.min(k, ratio(blend(fg.rgb, fg.a * op, bg.alt), bg.alt));
        if (k < need) rows.push(`${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join('.')} «${text.slice(0, 30)}» ${k.toFixed(2)}<${need}`);
    }
    return rows;
}

/** Los botones a la vista sin nombre que leer (ni texto, ni aria-label, ni title). */
function namelessButtons() {
    return [...document.querySelectorAll('#game-shell button, dialog[open] button, .tc-overlay button, .wm-dice-overlay.active button')]
        .filter((b) => {
            const r = b.getBoundingClientRect();
            if (r.width < 1 || r.height < 1) return false;
            const name = (b.getAttribute('aria-label') || b.textContent || b.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
            return !/\p{L}{2,}/u.test(name);
        })
        .map(b => `${b.className} 「${(b.textContent || '').trim().slice(0, 12)}」`);
}

// ---------------------------------------------------------------- la vuelta

try {
    await startServer();
    browser = await chromium.launch({ channel: 'msedge', headless: !HEADED });
    // «Reducir movimiento» pedido por el aparato: el juego lo respeta sin tocar nada.
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    /** @type {string[]} */
    const problems = [];
    page.on('pageerror', (/** @type {any} */ e) => problems.push(`PAGEERROR ${e.message}`));
    page.on('console', (/** @type {any} */ m) => {
        if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push(`ERROR ${m.text().slice(0, 300)}`);
    });
    await context.addInitScript(() => {
        try {
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
            window.localStorage.setItem('sillytavern_gameSucesos', 'off');
            window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,combat,travel,prisoners,mesa,high,spell,pet,bill,move,attack,roll,talk,journal');
        } catch { /* nada */ }
    });

    const shot = async (/** @type {string} */ name) => {
        if (SHOT) await page.screenshot({ path: `${SHOT}.${name}.png` }).catch(() => {});
    };
    const focus = () => page.evaluate(focusNow);
    const game = () => page.evaluate(gameNow);
    const wait = (/** @type {number} */ ms) => page.waitForTimeout(ms);
    const key = async (/** @type {string} */ k, ms = 350) => {
        await page.keyboard.press(k);
        await wait(ms);
    };
    const until = async (/** @type {() => Promise<boolean>} */ fn, ms = 15000) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (await fn().catch(() => false)) return true;
            await wait(250);
        }
        return false;
    };
    /** Tab (o Mayús+Tab, o una flecha) hasta que lo enfocado case; dice si llegó. */
    const keyTo = async (/** @type {(f: any) => boolean} */ test, max = 60, k = 'Tab') => {
        for (let i = 0; i < max; i++) {
            if (test(await focus())) return true;
            await key(k, 80);
        }
        return test(await focus());
    };
    /** Lo que se mira en cada pantalla: el contraste y los botones sin nombre. */
    const screenChecks = async (/** @type {string} */ where) => {
        const low = await page.evaluate(contrastAudit);
        check(`${where}: el texto se lee (contraste de la WCAG)`, low.length === 0, low.slice(0, 8).join(' | '));
        const nameless = await page.evaluate(namelessButtons);
        check(`${where}: todo botón tiene un nombre que leer`, nameless.length === 0, nameless.slice(0, 8).join(' | '));
    };

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    // La bienvenida de SillyTavern (con datos nuevos), con Intro.
    for (let i = 0; i < 150; i++) {
        if (await page.locator('dialog[open]').count()) {
            await key('Enter', 600);
            continue;
        }
        if (await page.locator('#game-shell .gs-menu-btn').count() > 0 && !(await page.evaluate(() => Boolean(document.querySelector('#preloader'))))) break;
        await wait(1000);
    }
    await wait(1500);

    // 1. El título: Intro trae el foco al menú (sin pulsar nada), Tab y flechas.
    await key('Enter', 400);
    let f = await focus();
    check('título: con el foco perdido, Intro lo trae a la primera opción del menú sin pulsarla', /gs-menu-btn/.test(f.cls) && (await game()).scene === 'title', JSON.stringify(f));
    check('título: el foco se ve (un anillo de 2 px o más)', f.ring, JSON.stringify(f));
    await key('ArrowDown', 200);
    const second = await focus();
    await key('ArrowUp', 200);
    const backUp = await focus();
    check('título: las flechas andan por el menú', /gs-menu-btn/.test(second.cls) && second.text !== f.text && backUp.text === f.text, JSON.stringify({ first: f.text, second: second.text, backUp: backUp.text }));
    check('«reducir movimiento» del aparato: el juego no anima nada (html[data-gs-motion="none"])', (await game()).motion === 'none', (await game()).motion);
    await screenChecks('título');
    await shot('titulo');

    // 2. Opciones: la fila «Animaciones», con Intro; el foco sigue en la fila.
    check('título: «Opciones» se alcanza con las flechas', await keyTo(x => /Opciones/.test(x.text), 8, 'ArrowDown'));
    await key('Enter', 1200);
    f = await focus();
    const optionsOpen = await page.locator('dialog[open] .go-row[data-option="motion"]').count() === 1;
    check('Opciones: se abre como ventana, con el foco dentro, y trae «Animaciones»', optionsOpen && f.inDialog, JSON.stringify(f));
    const reachedMotion = await keyTo(x => x.data?.option === 'motion', 12);
    const motionValue = () => page.evaluate(() => (document.querySelector('dialog[open] .go-row[data-option="motion"]')?.textContent || '').replace(/\s+/g, ' ').trim());
    const before = await motionValue();
    await key('Enter', 500);
    const afterOne = await motionValue();
    f = await focus();
    const stays = f.data?.option === 'motion';
    const motionNormal = (await game()).motion;
    // Tres más: cortas, ninguna y otra vez «según el aparato».
    for (let i = 0; i < 3; i++) await key('Enter', 400);
    check('Opciones: Intro en «Animaciones» la cambia, el foco sigue en la fila y vuelve a «según el aparato»',
        reachedMotion && before !== afterOne && stays && motionNormal === 'normal' && (await motionValue()) === before && (await game()).motion === 'none',
        JSON.stringify({ before, afterOne, stays, motionNormal, back: await motionValue() }));
    await shot('opciones');
    await key('Escape', 800);
    f = await focus();
    check('Opciones: Esc cierra la ventana y el foco vuelve a «Opciones»', (await game()).dialogs === 0 && /Opciones/.test(f.text), JSON.stringify(f));

    // 3. Jugar sin conexión → crear personaje.
    await key('Home', 200);
    f = await focus();
    check('título: Inicio, a la primera opción («Jugar sin conexión»)', /Jugar sin conexi/.test(f.text), f.text);
    await key('Enter', 400);
    await until(async () => (await game()).creator > 0, 90000);
    await wait(1200);
    f = await focus();
    check('crear personaje: se abre como ventana con el foco dentro', f.inDialog, JSON.stringify(f));
    await key('Enter', 400);
    f = await focus();
    check('crear personaje: Intro con el foco en la ventana va a lo primero que se elige («Elegir» la clase)', /hc-pick/.test(f.cls), JSON.stringify(f));
    await shot('crear');
    await screenChecks('crear personaje');

    await key('Enter', 1200);
    f = await focus();
    check('la clase: el selector se abre con el foco en una opción', (await game()).picker === 1 && /hc-option/.test(f.cls), JSON.stringify(f));
    await screenChecks('el selector de clase');
    await key('ArrowRight', 200);
    const moved = await focus();
    await key('ArrowLeft', 200);
    const movedBack = await focus();
    check('la clase: las flechas pasan de una opción a la de al lado', /hc-option/.test(moved.cls) && moved.text !== f.text && movedBack.text === f.text, JSON.stringify({ first: f.text, right: moved.text, left: movedBack.text }));
    await key('ArrowDown', 200);
    const chosenClass = (await focus()).text.split('.')[0];
    await key('Enter', 900);
    f = await focus();
    let now = await page.evaluate(() => ({
        cls: document.querySelector('.hc-card[data-pick="class"]')?.getAttribute('data-value') || '',
        race: document.querySelector('.hc-card[data-pick="race"]')?.getAttribute('data-value') || '',
        bg: document.querySelector('.hc-card[data-pick="background"]')?.getAttribute('data-value') || '',
    }));
    check('la clase: Intro la elige, cierra el selector y el foco vuelve a su botón', now.cls === chosenClass && (await game()).picker === 0 && /hc-pick/.test(f.cls), JSON.stringify({ now, chosenClass, f }));

    // La especie: Esc cierra solo el selector (ni el creador ni la pausa).
    await keyTo(x => /hc-pick/.test(x.cls) && /Elegir/.test(x.text), 8);
    await key('Enter', 1200);
    await key('Escape', 800);
    let g = await game();
    f = await focus();
    check('la especie: Esc cierra el selector y nada más (el creador sigue, sin pausa), y el foco vuelve', g.picker === 0 && g.creator === 1 && g.paused === 0 && /hc-pick/.test(f.cls), JSON.stringify({ g, f }));
    await key('Enter', 1200);
    await key('ArrowDown', 200);
    await key(' ', 900);
    // El trasfondo: el primero que salga.
    await keyTo(x => /hc-pick/.test(x.cls) && /Elegir/.test(x.text), 8);
    await key('Enter', 1200);
    await key('Enter', 900);
    now = await page.evaluate(() => ({
        cls: document.querySelector('.hc-card[data-pick="class"]')?.getAttribute('data-value') || '',
        race: document.querySelector('.hc-card[data-pick="race"]')?.getAttribute('data-value') || '',
        bg: document.querySelector('.hc-card[data-pick="background"]')?.getAttribute('data-value') || '',
    }));
    check('especie (Espacio) y trasfondo (Intro), elegidos con el teclado', Boolean(now.race && now.bg), JSON.stringify(now));

    // El nombre, cómo te presentas y la cara.
    check('el nombre se alcanza con Tab', await keyTo(x => /hc-name/.test(x.cls), 40));
    await page.keyboard.type('Nerea');
    check('«Mujer» se alcanza con Tab', await keyTo(x => /hc-gender/.test(x.cls) && /Mujer/.test(x.text), 10));
    await key(' ', 300);
    const genderOn = await page.evaluate(() => document.querySelector('.hc-gender.is-on')?.textContent || '');
    check('Espacio elige «Mujer»', genderOn === 'Mujer', genderOn);
    check('la cara se alcanza con Tab', await keyTo(x => /fc-kind/.test(x.cls), 10));
    await key('ArrowRight', 200);
    await key('ArrowRight', 200);
    const kindTarget = (await focus()).text;
    await key('Enter', 700);
    f = await focus();
    const kindOn = await page.evaluate(() => document.querySelector('.fc-kind.is-on')?.textContent || '');
    check('la cara: Intro elige otra y el foco sigue en la fila (la fila se dibuja de nuevo)', !f.lost && /fc-kind/.test(f.cls) && kindOn === kindTarget, JSON.stringify({ f, kindOn, kindTarget }));
    await shot('crear-listo');
    check('«Entrar al mundo» se alcanza con Mayús+Tab', await keyTo(x => /hc-enter/.test(x.cls), 60, 'Shift+Tab'));
    await key('Enter', 400);
    await until(async () => (await game()).creator === 0, 60000);
    await wait(2500);

    // 4. La escena del hilo, con Intro: el foco siempre dentro.
    let lostInStory = 0;
    let storySteps = 0;
    for (let i = 0; i < 30; i++) {
        g = await game();
        if (g.dialogs === 0) break;
        f = await focus();
        if (!f.inDialog) lostInStory++;
        storySteps++;
        await key('Enter', 700);
    }
    await wait(1500);
    g = await game();
    f = await focus();
    check('la escena del hilo se juega con Intro, con el foco siempre en ella', storySteps > 0 && lostInStory === 0 && g.dialogs === 0, JSON.stringify({ storySteps, lostInStory, g }));
    check('de vuelta en el muelle, el foco está en lo principal de la escena (una ficha)', /gs-chip/.test(f.cls) && f.ring, JSON.stringify(f));
    await shot('muelle');
    await screenChecks('el muelle');

    // 5. La pausa: Esc, foco dentro, Tab en círculo, Esc y el foco vuelve.
    const beforePause = f;
    await key('Escape', 700);
    f = await focus();
    const pauseRole = await page.evaluate(() => document.querySelector('#game-shell .gs-pause')?.getAttribute('role') || '');
    check('Esc abre la pausa, que es una ventana (role="dialog") con el foco en «Continuar»', (await game()).paused === 1 && pauseRole === 'dialog' && /Continuar/.test(f.text), JSON.stringify({ pauseRole, f }));
    let escaped = false;
    for (let i = 0; i < 20; i++) {
        await key('Tab', 60);
        if (!(await page.evaluate(() => Boolean(document.activeElement?.closest('#game-shell .gs-pause'))))) escaped = true;
    }
    check('en la pausa, Tab da la vuelta sin salir de ella', !escaped);
    await screenChecks('la pausa');
    await key('Escape', 700);
    f = await focus();
    check('Esc cierra la pausa y el foco vuelve a donde estaba', (await game()).paused === 0 && f.text === beforePause.text, JSON.stringify({ before: beforePause.text, now: f.text }));

    if (FIGHT) {
        // 6. La pelea del muelle, con el teclado.
        check('«Iniciar combate» se alcanza con Tab', await keyTo(x => /Iniciar combate/.test(x.text), 40));
        await key('Enter', 600);
        await until(async () => (await game()).scene === 'combat', 15000);
        let lostInFight = 0;
        let stuckDice = 0;
        let lastDice = '';
        let boardUsed = false;
        let boardAttack = false;
        let cardUsed = false;
        let diceSeen = 0;
        let ringMissing = 0;
        /** Lo que pasa en la pelea, para el informe. */
        const steps = [];
        for (let i = 0; i < 160; i++) {
            g = await game();
            if (g.scene !== 'combat' && !g.dice) break;
            f = await focus();
            steps.push(`${f.cls.split(' ').slice(0, 2).join('.')}「${f.text.slice(0, 24)}」`);
            if (f.lost) {
                lostInFight++;
                await key('Enter', 400);
                continue;
            }
            if (!f.ring && !/wm-dice-card/.test(f.cls)) ringMissing++;
            if (g.dice) {
                diceSeen++;
                const sig = `${f.cls}|${f.text}|${await page.evaluate(() => document.querySelector('.wm-dice-overlay.active .wm-dice-title')?.textContent || '')}`;
                stuckDice = g.diceReady && sig === lastDice ? stuckDice + 1 : 0;
                lastDice = sig;
                if (stuckDice > 4) break;
                await key('Enter', 450);
                continue;
            }
            if (/gs-board-keys/.test(f.cls)) {
                boardUsed = true;
                const hint = g.hint;
                if (/Intro: atacar/.test(hint)) {
                    boardAttack = true;
                    await key('Enter', 900);
                    continue;
                }
                const lit = await page.evaluate(() => ({
                    attack: document.querySelectorAll('.wm-highlight-attack').length,
                    move: document.querySelectorAll('.wm-highlight-clickable:not(.wm-highlight-attack)').length,
                }));
                if (lit.attack > 0) {
                    // Av Pág: a la ficha siguiente (el enemigo).
                    await key('PageDown', 300);
                    continue;
                }
                if (lit.move === 0) {
                    // Tu ficha, elegida: se encienden las casillas.
                    await key('Home', 200);
                    await key('Enter', 700);
                    continue;
                }
                // Andar: a la casilla encendida más cerca del enemigo, con las flechas.
                const plan = await page.evaluate(() => {
                    const cells = [...document.querySelectorAll('.wm-highlight-clickable:not(.wm-highlight-attack)[data-x][data-y]')].map(n => ({ x: Number(n.getAttribute('data-x')), y: Number(n.getAttribute('data-y')) }));
                    const enemy = document.querySelector('.wm-token.wm-token-enemy');
                    const ex = Number(enemy?.getAttribute('data-x') ?? enemy?.getAttribute('data-grid-x') ?? NaN);
                    const ey = Number(enemy?.getAttribute('data-y') ?? enemy?.getAttribute('data-grid-y') ?? NaN);
                    const said = /Casilla \((\d+), (\d+)\)/.exec(document.querySelector('.gs-board-hint')?.textContent || '');
                    const at = said ? { x: Number(said[1]) - 1, y: Number(said[2]) - 1 } : null;
                    if (!at || cells.length === 0) return null;
                    const target = Number.isFinite(ex) && Number.isFinite(ey)
                        ? cells.sort((a, b) => (Math.abs(a.x - ex) + Math.abs(a.y - ey)) - (Math.abs(b.x - ex) + Math.abs(b.y - ey)))[0]
                        : cells[0];
                    return { at, target };
                });
                if (!plan) {
                    await key('Tab', 200);
                    continue;
                }
                const dx = plan.target.x - plan.at.x;
                const dy = plan.target.y - plan.at.y;
                for (let s = 0; s < Math.abs(dx); s++) await key(dx > 0 ? 'ArrowRight' : 'ArrowLeft', 60);
                for (let s = 0; s < Math.abs(dy); s++) await key(dy > 0 ? 'ArrowDown' : 'ArrowUp', 60);
                await key('Enter', 900);
                continue;
            }
            if (g.card > 0) {
                cardUsed = true;
                await key('Enter', 900);
                continue;
            }
            if (/gs-btn-end/.test(f.cls)) {
                // Con el ataque gastado, pasar el turno; si no, al tablero.
                const canAttack = await page.evaluate(() => !(/** @type {HTMLButtonElement|null} */ (document.querySelector('#game-shell .gs-btn-attack')))?.disabled);
                if (canAttack) {
                    await key('Shift+Tab', 200);
                    continue;
                }
            }
            await key('Enter', 800);
        }
        await wait(1500);
        g = await game();
        const won = await page.evaluate(() => /victoria|termina/i.test(document.querySelector('#game-shell .gs-vn-text, #game-shell .gs-vn-box')?.textContent || ''));
        check('la pelea del muelle se gana con el teclado solo', g.scene !== 'combat' && won, JSON.stringify({ g, won, last: steps.slice(-6) }));
        check('en la pelea, el foco no se pierde en la página (como mucho una vez, y una tecla lo trae)', lostInFight <= 1, `${lostInFight} veces · ${steps.join(' → ').slice(0, 600)}`);
        check('los dados se pasan con Intro (ninguna tirada se queda atascada)', diceSeen > 0 && stuckDice <= 4, JSON.stringify({ diceSeen, stuckDice }));
        check('el tablero se usa con el teclado: su cursor, y atacar desde él (Intro en la casilla del enemigo)', boardUsed && boardAttack, JSON.stringify({ boardUsed, boardAttack, cardUsed }));
        check('en la pelea, lo que tiene el foco siempre se ve', ringMissing === 0, `${ringMissing} sin anillo`);
        await shot('pelea');

        // 7. Tras la pelea: lo que quede (dados, la escena del hilo) con Intro; luego al pueblo.
        for (let i = 0; i < 30; i++) {
            g = await game();
            if (!g.dice && g.dialogs === 0) break;
            await key('Enter', 600);
        }
        await wait(1000);
        check('«Salir del tablero» se alcanza con Tab', await keyTo(x => /Salir del tablero|Volver a Puerto Alba/.test(x.text), 50));
        await key('Enter', 1800);
    } else {
        // 6. Sin pelear: fuera del tablero del muelle (con el ratero esperando, la fila solo deja
        // salir) y «Saltar la prueba» con el teclado. Su ventana de sí o no abre con el foco dentro,
        // Intro dice que sí, y al cerrarse el foco no se queda en la página.
        check('«Salir del tablero» se alcanza con Tab', await keyTo(x => /Salir del tablero/.test(x.text), 30));
        await key('Enter', 2000);
        f = await focus();
        check('fuera del tablero, el foco sigue en la fila (no en la página)', !f.lost && /gs-chip/.test(f.cls), JSON.stringify(f));
        check('«Saltar la prueba» se alcanza con Tab', await keyTo(x => /Saltar la prueba/.test(x.text), 40));
        await key('Enter', 1200);
        await until(async () => (await page.locator('dialog[open]').count()) > 0, 8000);
        f = await focus();
        const askText = await page.evaluate(() => (document.querySelector('dialog[open]')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80));
        check('saltar la prueba: la ventana de sí o no abre con el foco dentro, en «Saltarla»', f.inDialog && /Saltarla/.test(f.text) && f.ring, JSON.stringify({ askText, f }));
        await screenChecks('la ventana de saltar la prueba');
        await shot('saltar');
        await key('Enter', 2500);
        g = await game();
        f = await focus();
        const sure = await page.evaluate(() => /Saltar la prueba\?/.test(document.querySelector('dialog[open]')?.textContent || ''));
        check('Intro dice que sí: la ventana se cierra y el foco no se pierde en la página (sigue el hilo)', !sure && !f.lost, JSON.stringify({ g, f }));
        // Lo que cuenta el hilo después (Brunilda y el tablón), con Intro.
        let lostAfter = 0;
        let afterSteps = 0;
        for (let i = 0; i < 30; i++) {
            g = await game();
            if (g.dialogs === 0) break;
            f = await focus();
            if (!f.inDialog) lostAfter++;
            afterSteps++;
            await key('Enter', 700);
        }
        await wait(1200);
        check('lo que cuenta el hilo tras saltar la prueba se pasa con Intro, con el foco en ello', (await game()).dialogs === 0 && lostAfter === 0, JSON.stringify({ afterSteps, lostAfter }));
    }
    // «Continuar» (lo principal de la fila) lleva al pueblo: sus localizaciones, en tarjetas.
    if ((await game()).places === 0) {
        check('«Continuar» se alcanza con Tab', await keyTo(x => /gs-chip-continue/.test(x.cls), 40));
        await key('Enter', 1200);
    }
    await until(async () => (await game()).places > 0, 10000);
    check('en el pueblo, las localizaciones se alcanzan con Tab', await keyTo(x => /gs-town-place/.test(x.cls), 50));
    const firstPlace = (await focus()).text;
    await key('ArrowRight', 200);
    const nextPlace = (await focus()).text;
    check('en el pueblo, las flechas pasan de una localización a otra', nextPlace !== firstPlace && /gs-town-place/.test((await focus()).cls), JSON.stringify({ firstPlace, nextPlace }));
    await shot('pueblo');
    check('la Casa del Gremio se alcanza con las flechas', await keyTo(x => /Casa del Gremio/.test(x.text), 10, 'ArrowLeft'));
    await screenChecks('el pueblo');
    await key('Enter', 1500);
    g = await game();
    f = await focus();
    check('Intro entra en la Casa del Gremio, con el foco dentro', g.town === 'gremio' && !f.lost && f.ring, JSON.stringify({ g: g.town, f }));
    check('en la Casa del Gremio, lo que se hace se alcanza con Tab', await keyTo(x => /gs-town-act/.test(x.cls), 30));
    const act1 = (await focus()).text;
    await key('ArrowDown', 250);
    const act2 = (await focus()).text;
    check('en la Casa del Gremio, las flechas andan por lo que se hace', act1 !== act2 && !(await focus()).lost, JSON.stringify({ act1, act2 }));
    await shot('gremio');
    await screenChecks('la Casa del Gremio');
    await key('Escape', 700);
    check('en el gremio, Esc abre la pausa', (await game()).paused === 1);
    await key('Escape', 700);
    f = await focus();
    check('y Esc la cierra con el foco donde estaba', (await game()).paused === 0 && f.text === act2, JSON.stringify({ act2, now: f.text }));

    // 8. El tablón de campañas: una ventana con una rejilla de tarjetas.
    check('«Tablón de campañas» se alcanza con Tab', await keyTo(x => /Tablón de campañas/.test(x.text), 60));
    const opener = (await focus()).text;
    await key('Enter', 400);
    await until(async () => (await page.locator('dialog[open] .hb-root [data-campaign]').count()) > 0, 15000);
    await wait(600);
    f = await focus();
    check('el tablón se abre como ventana, con el foco dentro', f.inDialog && !f.lost && f.ring, JSON.stringify(f));
    const cardNow = () => page.evaluate(() => document.activeElement?.getAttribute('data-campaign') || document.activeElement?.getAttribute('data-hero') || '');
    const reachedCard = await keyTo(x => Boolean(x.data?.campaign), 12);
    const card1 = await cardNow();
    await key('ArrowRight', 250);
    let card2 = await cardNow();
    if (card2 === card1) {
        await key('ArrowDown', 250);
        card2 = await cardNow();
    }
    check('en el tablón, las flechas pasan de una campaña a otra', reachedCard && Boolean(card1) && Boolean(card2) && card1 !== card2, JSON.stringify({ card1, card2 }));
    await shot('tablon');
    await screenChecks('el tablón de campañas');
    await key('Escape', 900);
    f = await focus();
    check('Esc cierra el tablón y el foco vuelve a lo que lo abrió', (await game()).dialogs === 0 && f.text === opener, JSON.stringify({ opener, now: f.text }));

    // 9. Las ventanas de la cabecera: cada una abre con el foco dentro, Tab no sale de ella, se
    // lee y tiene nombres, y Esc la cierra con el foco de vuelta en su botón.
    const HEAD = [['Diario', 'gs-journal'], ['Mesa', 'gs-table'], ['Mapa', 'gs-map'], ['Grupo', 'gs-glance'], ['Avisos', 'gs-tray'], ['Historial de dados', 'gs-dice'], ['¿Qué hago?', 'gs-help']];
    /** Lo de encima ahora: una ventana o algo que hace de ventana. */
    const onTop = () => page.evaluate(() => {
        const dialogs = [...document.querySelectorAll('dialog[open]:not([closing]), [role="dialog"]:not(.gs-pause)')].filter(n => n.getClientRects().length > 0);
        const top = dialogs[dialogs.length - 1];
        return top ? (top.className || top.tagName).toString().slice(0, 60) : '';
    });
    for (const [label, cls] of HEAD) {
        const reached = await keyTo(x => x.cls.includes(cls), 60);
        if (!reached) {
            check(`la cabecera: «${label}» se alcanza con Tab`, false);
            continue;
        }
        await key('Enter', 1500);
        const box = await onTop();
        f = await focus();
        let leaked = false;
        for (let i = 0; i < 12 && box; i++) {
            await key('Tab', 50);
            if (!(await focus()).inDialog) leaked = true;
        }
        check(`«${label}»: se abre como ventana con el foco dentro, y Tab no sale de ella`, Boolean(box) && f.inDialog && !leaked, JSON.stringify({ box, f, leaked }));
        await shot(`cabecera-${cls}`);
        if (box) await screenChecks(`«${label}»`);
        await key('Escape', 900);
        f = await focus();
        check(`«${label}»: Esc la cierra y el foco vuelve a su botón`, !(await onTop()) && (await game()).paused === 0 && f.cls.includes(cls), JSON.stringify({ now: f, left: await onTop() }));
        if ((await game()).paused) await key('Escape', 500);
    }

    const pageErrors = problems.filter(p => /PAGEERROR/.test(p));
    check('sin errores de la página', pageErrors.length === 0, pageErrors.slice(0, 5).join(' | '));
} catch (error) {
    failures++;
    console.log(`FAIL  la vuelta se cortó: ${/** @type {any} */ (error)?.stack || error}`);
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
