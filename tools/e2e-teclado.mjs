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
 *   selector; la fila de la cara no pierde el foco) → el prólogo: la escena del hilo con Intro, y
 *   de vuelta en el muelle el foco en «Continuar» → la pausa (Esc, Tab en círculo, Esc y el foco
 *   vuelve) → la pelea del muelle (la decisión con el foco en «Pelear»; al colocar, el foco en
 *   «Empezar»; los dados con Intro; el cursor del tablero con las flechas, Av Pág e Inicio; atacar
 *   desde el tablero y la tarjeta del enemigo; 1 abre «Atacar» y Esc lo cierra; «Fin de turno»
 *   con Tab) → lo que cuenta el hilo después (el posadero, Brunilda) → «Saltar la prueba» de la
 *   bodega (la ventana de sí o no, con el foco dentro) → el pueblo (flechas) → la Casa del Gremio
 *   (flechas; Esc, la pausa) → el tablón de campañas (una ventana: el foco dentro, Esc la cierra y
 *   el foco vuelve) → una quedada con Gerd (la novela con el foco dentro; 1 elige, Intro sigue; al
 *   acabar, el foco en el pueblo) → las ventanas de la cabecera.
 *   En cada pantalla: el contraste del texto y que todo botón tenga nombre.
 *
 * Uso:
 *   node tools/e2e-teclado.mjs                       # sin ventana, puerto 8428
 *   node tools/e2e-teclado.mjs --headed
 *   node tools/e2e-teclado.mjs --port 8428 --captura t.png   # t.png.titulo.png, t.png.crear.png…
 *   node tools/e2e-teclado.mjs --sin-pelea           # sale del tablero del muelle sin pelear (más corta)
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
const FIGHT = !process.argv.includes('--sin-pelea');
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

/** La pelea: de quién es el turno, qué hay encima, dónde está el foco y lo que el tablero enciende. */
function fightNow() {
    const bar = document.querySelector('#game-shell .gs-vtt-bar');
    const card = document.querySelector('.tc-overlay');
    const a = document.activeElement;
    const cs = a && a !== document.body ? getComputedStyle(a) : null;
    return {
        active: Boolean(/** @type {any} */ (window).SillyTavern.getContext().chatMetadata?.combatEncounter?.active),
        dice: Boolean(document.querySelector('.wm-dice-overlay.active')),
        dialog: (document.querySelector('dialog[open]:not([closing])')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
        card: Boolean(card),
        cardFocus: Boolean(card && a && card.contains(a)),
        mine: Boolean(bar && !bar.classList.contains('gs-vtt-waiting')),
        actionReady: Boolean(document.querySelector('#game-shell .gs-vtt-bar .gs-btn-attack:not([disabled])')),
        menu: Boolean(document.querySelector('#game-shell .gs-targets')),
        menuFocus: Boolean(a?.closest('#game-shell .gs-targets')),
        hint: document.querySelector('.gs-board-hint')?.textContent || '',
        onBoard: Boolean(a?.classList.contains('gs-board-keys')),
        text: (a?.getAttribute('aria-label') || a?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
        cls: String(a?.className || ''),
        lost: !a || a === document.body,
        ring: Boolean(cs && cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2),
        lit: [...document.querySelectorAll('.wm-highlight-clickable:not(.wm-highlight-attack)[data-x][data-y]')].map(n => ({ x: Number(n.getAttribute('data-x')), y: Number(n.getAttribute('data-y')) })),
    };
}

/** La quedada abierta (`ui/meetup-scene.js`): si está, si el foco está dentro y qué se lee. */
function meetupNow() {
    const dialog = document.querySelector('.qd-dialog[open]');
    const a = document.activeElement;
    return {
        open: Boolean(dialog),
        inside: Boolean(dialog && a && dialog.contains(a)),
        name: dialog?.querySelector('.qd-nameplate')?.textContent ?? '',
        replies: dialog?.querySelectorAll('.qd-chip-reply').length ?? 0,
        line: (dialog?.querySelector('.qd-line:last-child, .qd-text')?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60),
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
        // Sin nadie que cuente la llegada (D-J60), al acabar la escena se ve el tablero y la pelea se
        // abre sola: su ventana de pelear o no ya no es de la escena.
        if (await page.evaluate(() => Boolean(document.querySelector('dialog.ev-avoid[open]')))) break;
        f = await focus();
        if (!f.inDialog) lostInStory++;
        storySteps++;
        await key('Enter', 700);
    }
    await wait(1500);
    g = await game();
    f = await focus();
    const decidingFirst = await page.evaluate(() => Boolean(document.querySelector('dialog.ev-avoid[open]')));
    check('la escena del hilo se juega con Intro, con el foco siempre en ella', storySteps > 0 && lostInStory === 0 && (g.dialogs === 0 || decidingFirst), JSON.stringify({ storySteps, lostInStory, g }));
    check('de vuelta en el muelle, el foco está en lo principal de la escena (una ficha, o «Pelear» si la pelea se abre sola)',
        (/gs-chip/.test(f.cls) || (decidingFirst && f.inDialog && /Pelear/.test(f.text))) && f.ring, JSON.stringify(f));
    await shot('muelle');
    await screenChecks('el muelle');
    // Sin pelear (--sin-pelea), la ventana del ratero (sin «Todavía no») no es de esta prueba: se cierra.
    if (decidingFirst && !FIGHT) await page.evaluate(() => document.querySelectorAll('dialog.ev-avoid[open]').forEach(d => /** @type {any} */ (d).close()));

    // 5. La pausa: Esc, foco dentro, Tab en círculo, Esc y el foco vuelve. Con la ventana de pelear o
    // no delante (Esc no la cierra), después de la pelea.
    const pauseChecks = async () => {
        f = await focus();
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
    };
    if (!decidingFirst || !FIGHT) await pauseChecks();

    if (FIGHT) {
        // 6. La pelea del muelle, con el teclado. «Continuar» lleva al tablero, y la pelea se abre
        // sola: primero la decisión (pelear u otra salida), luego colocar al grupo. Si ya está
        // abierta (al acabar la escena), sin «Continuar».
        if (!decidingFirst) await key('Enter', 1500);
        await until(async () => (await page.evaluate(fightNow)).dialog !== '', 15000);
        f = await focus();
        const decision = (await page.evaluate(fightNow)).dialog;
        check('la pelea: la decisión se abre como ventana con el foco en «Pelear»', f.inDialog && /Pelear/.test(f.text) && f.ring, JSON.stringify({ decision, f }));
        await screenChecks('la decisión antes de pelear');
        await shot('decision');
        await key('Enter', 1500);
        await until(async () => (await page.locator('.cv-place').count()) > 0, 10000);
        await wait(600);
        f = await focus();
        check('colocar al grupo: el foco en «Empezar» (Intro empieza)', /cv-place-start/.test(f.cls) && f.ring, JSON.stringify(f));
        await screenChecks('colocar al grupo');
        await shot('colocar');
        await key('Enter', 1500);

        /** La casilla que dice la línea del tablero («Casilla (6, 3) · …»), desde 0. */
        const cellOf = (/** @type {string} */ hint) => {
            const m = /Casilla \((\d+), (\d+)\)/.exec(hint);
            return m ? { x: Number(m[1]) - 1, y: Number(m[2]) - 1 } : null;
        };
        const fight = () => page.evaluate(fightNow);
        /** Tab hasta algo de la pelea; dice si llegó. */
        const tabToFight = async (/** @type {(s: any) => boolean} */ test) => {
            for (let t = 0; t < 45; t++) {
                if (test(await fight())) return true;
                await key('Tab', 60);
            }
            return test(await fight());
        };
        const stats = { lost: 0, noRing: 0, dice: 0, stuckDice: 0, board: false, boardAttack: false, card: 0, ended: 0, endReached: false, checked: false };
        let lastDice = '';
        /** @type {any} */
        let menuKeys = null;
        /** Lo que pasa en la pelea, para el informe. */
        const steps = [];
        /** Lo que se decide en cada turno (dónde está el cursor, qué se enciende), por si falla. */
        const trace = [];
        const note = (/** @type {string} */ what, /** @type {any} */ s) => trace.push(`${what} ${s ? `[${s.cls.split(' ').slice(-1)[0]}「${s.text.slice(0, 16)}」 ${s.hint.slice(0, 70)} · ${s.lit.length} enc.]` : ''}`);
        for (let i = 0; i < 260; i++) {
            const s = await fight();
            if (!s.active && !s.dice && !s.dialog) break;
            steps.push(`${s.cls.split(' ').slice(-1)[0]}「${s.text.slice(0, 18)}」`);
            if (s.lost) {
                stats.lost++;
                await key('Enter', 400);
                continue;
            }
            if (!s.ring && !/wm-dice-card/.test(s.cls)) stats.noRing++;
            if (s.dice) {
                stats.dice++;
                const sig = `${s.cls}|${s.text}|${await page.evaluate(() => document.querySelector('.wm-dice-overlay.active .wm-dice-title')?.textContent || '')}`;
                stats.stuckDice = sig === lastDice ? stats.stuckDice + 1 : 0;
                lastDice = sig;
                if (stats.stuckDice > 6) break;
                await key('Enter', 500);
                continue;
            }
            // Una ventana (¿acabar el turno?): el foco está en ella; Intro dice que sí.
            if (s.dialog) {
                await key('Enter', 800);
                continue;
            }
            // La tarjeta del enemigo: con la acción libre, el foco en «Atacar» e Intro; si no, Esc.
            if (s.card) {
                stats.card++;
                if (s.cardFocus && /^Atacar/.test(s.text) && s.actionReady) await key('Enter', 900);
                else await key('Escape', 600);
                continue;
            }
            if (!s.mine) {
                await wait(400);
                continue;
            }
            if (!stats.checked) {
                stats.checked = true;
                await screenChecks('la pelea, en tu turno');
                await shot('pelea');
            }
            // Las teclas de la barra, una vez: 1 abre «Atacar» con el foco dentro; Esc lo cierra y
            // el foco vuelve a donde estaba.
            if (!menuKeys && s.actionReady) {
                const before = s.text;
                await key('1', 700);
                const open = await fight();
                await key('Escape', 600);
                const closed = await fight();
                menuKeys = { open: open.menu, inside: open.menuFocus, closed: !closed.menu, before, back: closed.text };
                // Y «Fin de turno» se alcanza con Tab (sin pulsarlo): si el primer golpe gana la
                // pelea, no hará falta, pero tiene que estar.
                stats.endReached = await tabToFight(x => /gs-btn-end/.test(x.cls));
                continue;
            }
            // La acción gastada: «Fin de turno», con Tab.
            if (!s.actionReady) {
                note('acción gastada: fin de turno', s);
                await tabToFight(x => /gs-btn-end/.test(x.cls));
                stats.ended++;
                await key('Enter', 1200);
                continue;
            }
            // Al tablero (Tab), y con su cursor: Av Pág hasta el enemigo.
            if (!s.onBoard && !(await tabToFight(x => x.onBoard))) break;
            stats.board = true;
            let foeHint = '';
            for (let t = 0; t < 6 && !foeHint; t++) {
                await key('PageDown', 150);
                const h = (await fight()).hint;
                if (/enemigo/.test(h)) foeHint = h;
            }
            note(`enemigo: ${foeHint.slice(0, 60)}`, await fight());
            if (/Intro: atacar/.test(foeHint)) {
                // Al lado: Intro en su casilla abre su tarjeta, con el foco en «Atacar».
                stats.boardAttack = true;
                await key('Enter', 900);
                continue;
            }
            // Inicio (tu ficha). Si no está elegida (nada encendido), Intro la elige: se encienden
            // las casillas a las que llega, y la del enemigo si está al lado.
            await key('Home', 200);
            let here = await fight();
            note('inicio', here);
            if (here.lit.length === 0 && /Intro: elegir/.test(here.hint)) {
                await key('Enter', 700);
                here = await fight();
                note('elegida', here);
                if (here.onBoard) {
                    let again = '';
                    for (let t = 0; t < 6 && !again; t++) {
                        await key('PageDown', 150);
                        const h = (await fight()).hint;
                        if (/enemigo/.test(h)) again = h;
                    }
                    if (/Intro: atacar/.test(again)) {
                        stats.boardAttack = true;
                        await key('Enter', 900);
                        continue;
                    }
                    await key('Home', 200);
                    here = await fight();
                }
            }
            // Andar: las flechas hasta la casilla encendida más cerca de él.
            const foe = cellOf(foeHint);
            const at = cellOf(here.hint);
            if (!foe || !at || here.lit.length === 0) {
                note(`sin pasos: fin de turno (${JSON.stringify({ foe, at })})`, here);
                await tabToFight(x => /gs-btn-end/.test(x.cls));
                stats.ended++;
                await key('Enter', 1200);
                continue;
            }
            const far = (/** @type {{x: number, y: number}} */ c) => Math.max(Math.abs(c.x - foe.x), Math.abs(c.y - foe.y));
            const goal = here.lit.sort((a, b) => far(a) - far(b))[0];
            const dx = goal.x - at.x;
            const dy = goal.y - at.y;
            for (let k = 0; k < Math.abs(dx); k++) await key(dx > 0 ? 'ArrowRight' : 'ArrowLeft', 60);
            for (let k = 0; k < Math.abs(dy); k++) await key(dy > 0 ? 'ArrowDown' : 'ArrowUp', 60);
            note(`andar a (${goal.x + 1}, ${goal.y + 1})`, await fight());
            await key('Enter', 1200);
        }
        await wait(1500);
        const after = await fight();
        check('la pelea del muelle se gana con el teclado solo', !after.active, JSON.stringify({ after: { active: after.active, text: after.text }, last: steps.slice(-6) }));
        check('en la pelea, el foco no se pierde en la página (como mucho una vez, y una tecla lo trae)', stats.lost <= 1, `${stats.lost} veces · ${steps.join(' → ').slice(0, 600)}`);
        check('los dados se pasan con Intro (ninguna tirada se queda atascada)', stats.dice > 0 && stats.stuckDice <= 6, JSON.stringify({ dice: stats.dice, stuck: stats.stuckDice }));
        check('el tablero se usa con el teclado: su cursor (flechas, Av Pág, Inicio) y atacar desde él, con la tarjeta del enemigo', stats.board && stats.boardAttack && stats.card > 0, JSON.stringify(stats));
        check('la barra: 1 abre «Atacar» con el foco dentro, y Esc lo cierra con el foco donde estaba', Boolean(menuKeys?.open && menuKeys.inside && menuKeys.closed && menuKeys.back === menuKeys.before), JSON.stringify(menuKeys));
        check('«Fin de turno» se alcanza con Tab (y pasa el turno cuando hace falta)', stats.endReached, JSON.stringify({ reached: stats.endReached, ended: stats.ended }));
        // Lo que se decidió en cada turno, si la pelea no fue como debía.
        if (after.active || !stats.boardAttack) console.log(`        (la pelea, turno a turno:)\n          ${trace.slice(-30).join('\n          ')}`);
        check('en la pelea, lo que tiene el foco siempre se ve', stats.noRing === 0, `${stats.noRing} sin anillo`);
        f = await focus();
        check('tras la pelea, el foco en lo principal («Continuar»)', /gs-chip-continue/.test(f.cls) && f.ring, JSON.stringify(f));
        await shot('tras-pelea');

        // 7. Lo que cuenta el hilo después (el posadero, Brunilda en la Casa del Gremio): con
        // «Continuar» e Intro, el foco siempre en la escena; hasta que se ofrece saltar la prueba.
        let lostAfterFight = 0;
        let sceneSteps = 0;
        for (let i = 0; i < 40; i++) {
            g = await game();
            f = await focus();
            if (g.dialogs > 0) {
                if (!f.inDialog) lostAfterFight++;
                sceneSteps++;
                await key('Enter', 700);
                continue;
            }
            const skip = await page.evaluate(() => [...document.querySelectorAll('#game-shell button')].some(b => /Saltar la prueba/.test(b.textContent || '') && b.getClientRects().length > 0));
            if (skip) break;
            if (!/gs-chip-continue/.test(f.cls)) break;
            await key('Enter', 1500);
        }
        await wait(800);
        f = await focus();
        check('lo que cuenta el hilo tras la pelea se pasa con Intro, con el foco en la escena; al acabar, el foco no se pierde', sceneSteps > 0 && lostAfterFight === 0 && !f.lost, JSON.stringify({ sceneSteps, lostAfterFight, f }));
        if (decidingFirst) await pauseChecks();
    } else {
        // 6. Sin pelear: fuera del tablero del muelle (con el ratero esperando, la fila solo deja
        // salir).
        check('«Salir del tablero» se alcanza con Tab', await keyTo(x => /Salir del tablero/.test(x.text), 30));
        await key('Enter', 2000);
        f = await focus();
        check('fuera del tablero, el foco sigue en la fila (no en la página)', !f.lost && /gs-chip/.test(f.cls), JSON.stringify(f));
    }

    // «Saltar la prueba» de la bodega con el teclado. Su ventana de sí o no abre con el foco
    // dentro, Intro dice que sí, y al cerrarse el foco no se queda en la página.
    // D-J62: está en la Casa del Gremio (la fila de abajo ya no lo lleva): al pueblo con «Continuar»
    // (o con el botón del tablero) y dentro, todo con el teclado.
    for (let i = 0; i < 3 && (await game()).places === 0 && !(await game()).town; i++) {
        if (await keyTo(x => /gs-chip-continue|wm-leave-loc-btn|Salir del tablero/.test(`${x.cls} ${x.text}`), 30)) await key('Enter', 1500);
    }
    await until(async () => (await game()).places > 0 || Boolean((await game()).town), 10000);
    if (!(await game()).town) {
        check('en el pueblo, la Casa del Gremio se alcanza con Tab (D-J62)', await keyTo(x => /gs-town-place/.test(x.cls) && /Casa del Gremio/.test(x.text), 50));
        await key('Enter', 1500);
    }
    check('«Saltar la prueba» se alcanza con Tab, en la Casa del Gremio (D-J62)', await keyTo(x => /Saltar la prueba/.test(x.text), 40));
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
    // D-J62: se saltó desde la Casa del Gremio: se vuelve a la plaza con su botón, con el teclado.
    if ((await game()).town && await keyTo(x => /gs-town-back/.test(x.cls), 40)) await key('Enter', 800);
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

    // 8b. Una quedada: de vuelta a los sitios del pueblo («Volver a…», con Tab), «Quedar con…» (la
    // gente que anda por el pueblo) y su novela con el teclado: el foco dentro, 1 elige la primera
    // respuesta, Intro sigue; al acabar, el foco en el pueblo.
    check('«Volver a» los sitios del pueblo se alcanza con Tab', await keyTo(x => /gs-town-back/.test(x.cls), 40));
    await key('Enter', 1200);
    await until(async () => (await game()).places > 0, 8000);
    // D-J63: sin «Quedar con…»: se pulsa a la persona (`persona:…`), saluda, y «Pasar el rato».
    const reachedMeet = await keyTo(x => /^(quedar|persona):/.test(x.data?.chip || ''), 60);
    const meetLabel = (await focus()).text;
    check('a tu gente («Quedar con…»; D-J63, la persona) se la alcanza con Tab', reachedMeet, meetLabel);
    if (reachedMeet) {
        await key('Enter', 1500);
        if (await until(() => page.evaluate(() => Boolean(document.querySelector('.qd-dialog[open] .qd-invite'))), 5000)) {
            // Su charla corta, si la trae dentro del saludo, se contesta antes (1).
            for (let i = 0; i < 3 && !(await keyTo(x => x.data?.choice === 'quedar', 12)); i++) await key('1', 700);
            await key('Enter', 1500);
        }
        await until(async () => (await page.evaluate(meetupNow)).open, 10000);
        await wait(500);
        let m = await page.evaluate(meetupNow);
        f = await focus();
        check('la quedada se abre como ventana con el foco dentro', m.open && m.inside && f.ring, JSON.stringify({ m, f }));
        await screenChecks('la quedada');
        await shot('quedada');
        let outside = 0;
        let replied = 0;
        let meetSteps = 0;
        for (let i = 0; i < 30; i++) {
            m = await page.evaluate(meetupNow);
            if (!m.open) break;
            if (!m.inside) outside++;
            meetSteps++;
            if (m.replies > 0) {
                replied++;
                await key('1', 700);
            } else {
                await key('Enter', 700);
            }
        }
        await wait(1200);
        m = await page.evaluate(meetupNow);
        f = await focus();
        check('la quedada se juega con el teclado (1 responde, Intro sigue), con el foco siempre en ella', !m.open && meetSteps > 1 && replied > 0 && outside === 0, JSON.stringify({ meetSteps, replied, outside }));
        check('al acabar la quedada, el foco no se pierde: vuelve al juego, y se ve', !f.lost && !f.inDialog && f.ring, JSON.stringify(f));
    }

    // 9. Las ventanas de la cabecera: cada una abre con el foco dentro, Tab no sale de ella, se
    // lee y tiene nombres, y Esc la cierra con el foco de vuelta en su botón.
    const HEAD = [['Diario', 'gs-journal'], ['Mesa', 'gs-table'], ['Mapa', 'gs-map'], ['Grupo', 'gs-glance'], ['Avisos', 'gs-tray'], ['Historial de dados', 'gs-dice'], ['¿Qué hago?', 'gs-help']];
    /** Lo de encima ahora: una ventana o algo que hace de ventana. */
    const onTop = () => page.evaluate(() => {
        // Los dados escondidos se quedan en la página (transparentes, `inert`): no cuentan.
        const dialogs = [...document.querySelectorAll('dialog[open]:not([closing]), [role="dialog"]:not(.gs-pause)')]
            .filter(n => n.getClientRects().length > 0 && !n.closest('[inert]') && !n.matches('.wm-dice-overlay:not(.active)'));
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
