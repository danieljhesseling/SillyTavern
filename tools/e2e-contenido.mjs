#!/usr/bin/env node
/**
 * El contenido escrito que faltaba (tanda 9), jugado como un jugador en un navegador de verdad,
 * contra un servidor propio con un `--dataRoot` temporal, como `e2e-peleas.mjs`:
 *
 *   título → Jugar sin conexión → Bran, bardo → en el muelle, la pelea con el ratero (se entra como
 *   quien juega, con `e2e-entrar-pelea.mjs`; o con «Iniciar combate», si aún está)
 *   → J8.5: «Hablar» en la barra del combate: lo escrito para el ratero (no acepta presos), y
 *   convencerle acaba la pelea y gana el tablero → saltar la prueba → J10.2: en la plaza de Puerto
 *   Alba, la fila ofrece mirar cosas del puerto (no las del compendio), y mirar una dice lo que se
 *   ve → J3.11: dentro de «La Casa del Gremio», la parte «Mirar», con lo de la sala; mirar una
 *   cuenta lo que se ve y deja de ofrecerse ese día → el tablón: La Maldición de Strahd → en la
 *   taberna, «Evitar la pelea» con la bruja → salir y entrar en el Sótano de la Iglesia → J12.3:
 *   «Buscar trampas» encuentra el escalón podrido al pie de la escalera, y se dibuja.
 *
 * Lo que se prepara a mano se dice en cada paso: el dado (`setRandomSource`), para mirar lo que
 * pasa con la tirada y no la suerte, y la vida del héroe en el muelle. Lo que se prueba se hace
 * con el ratón, como quien juega.
 *
 * Uso:
 *   node tools/e2e-contenido.mjs                                    # sin ventana
 *   node tools/e2e-contenido.mjs --headed                           # mirándolo
 *   node tools/e2e-contenido.mjs --port 8422 --captura contenido.png  # contenido-1.png, contenido-2.png…
 */

/* global window, document, HTMLElement */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { entrarEnLaPelea } from './e2e-entrar-pelea.mjs';
import { buscarEnElPueblo, enElGremio, entrarEnSitio, opcionesALaVista, pasoDeLaHistoria, salirDelTablero } from './e2e-guiado.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8217;
const BASE = `http://127.0.0.1:${PORT}`;
const HEADED = process.argv.includes('--headed');
const SHOT = argAfter('--captura');
const DOCK = 'El muelle de Puerto Alba';
const CELLAR = 'Sótano de la Iglesia';

/** Lo escrito para Puerto Alba: las cuatro cosas de la plaza y las tres de la sala del gremio. */
const PORT_LOOKS = /^(Mirar las barcas del muelle|Leer los avisos clavados en la lonja|Mirar el faro de la punta, al caer la tarde|Escuchar a los pescadores que remiendan redes)$/;
const PORT_FOUND = /barca negra, sin nombre|el herrero paga bien|algo se mueve despacio|los lobos bajan cada noche/;
const HALL_LOOKS = ['Leer los nombres grabados en la viga del salón', 'Examinar el tablón viejo, debajo del nuevo', 'Mirar las armas colgadas sobre la chimenea'];

const require = createRequire(join(ROOT, 'tests/package.json'));
const { chromium } = require('@playwright/test');

let failures = 0;
const check = (/** @type {string} */ name, /** @type {boolean} */ ok, detail = '') => {
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        -> ${detail}` : ''}`);
};

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-contenido-'));
/** @type {any} */
let server = null;
/** @type {any} */
let browser = null;
/** @type {any} */
let page = null;

let shots = 0;
/** @param {string} what */
async function shoot(what) {
    if (!SHOT || !page) return;
    shots += 1;
    const file = SHOT.replace(/\.png$/i, '') + `-${shots}.png`;
    await page.screenshot({ path: file });
    console.log(`      captura ${shots} (${what}): ${file}`);
}

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
 * Elegir en una tarjeta de «Crear personaje» la opción que se parece a lo pedido, o la primera.
 *
 * @param {any} target
 * @param {string} pick class | race | background
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
    const context = await browser.newContext({ viewport: { width: 1400, height: 950 } });
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
            // Las escenas del hilo las mira e2e-historia: aquí taparían la ventana de las salidas.
            window.localStorage.setItem('sillytavern_gameStoryWindows', 'off');
        } catch { /* nada */ }
    });

    /** Lo que el juego sabe ahora. */
    const state = () => page.evaluate(async () => {
        const meta = window.SillyTavern.getContext().chatMetadata ?? {};
        const party = (await import('/scripts/party.js')).getPartyMembersSnapshot();
        return {
            world: String(meta.world_info ?? ''),
            location: String(meta.currentLocation ?? ''),
            board: String(meta.currentBoard ?? ''),
            fighting: Boolean(meta.combatEncounter?.active),
            won: Array.isArray(meta.boardsWon) ? meta.boardsWon.map(String) : [],
            done: Array.isArray(meta.plotState?.done) ? meta.plotState.done : [],
            hero: party[0] ? { name: String(party[0].name), hp: Number(party[0].hp) || 0, gold: Number(party[0].gold) || 0 } : null,
        };
    });
    const chips = () => page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-chip-action')].map(c => (c.textContent || '').trim()));
    /** Pulsar una ficha de la fila con el ratón; si está en «+N más», se abre antes. */
    const clickChip = async (/** @type {RegExp} */ pattern) => {
        const visible = page.locator('#game-shell .gs-chip-action:visible').filter({ hasText: pattern }).first();
        if (await visible.count() === 0) {
            const more = page.locator('#game-shell .gs-chip-action:visible').filter({ hasText: /^\+\d+ más$/ }).first();
            if (await more.count() > 0) await more.click({ timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(300);
        }
        const chip = page.locator('#game-shell .gs-chip-action:visible').filter({ hasText: pattern }).first();
        if (await chip.count() > 0) return chip.click({ timeout: 4000 }).then(() => true).catch(() => false);
        // «+N más» abre una ventana con todas: se busca ahí, y si no está, se cierra.
        await page.waitForSelector('.hp-root .hp-item', { timeout: 3000 }).catch(() => {});
        const found = await page.evaluate((source) => {
            const item = [...document.querySelectorAll('.hp-root .hp-item')].find(b => new RegExp(source).test((b.textContent || '').trim()));
            if (item instanceof HTMLElement) item.click();
            return Boolean(item);
        }, pattern.source);
        if (!found) await page.locator('.popup:has(.hp-root) .popup-button-ok').click({ timeout: 3000 }).catch(() => {});
        return found;
    };
    /** Si una ficha se ofrece, en la fila o en «+N más» (que se abre y se cierra para mirarlo). */
    const offered = async (/** @type {RegExp} */ pattern) => {
        if ((await chips()).some(c => pattern.test(c))) return true;
        if (!await page.locator('#game-shell .gs-chip-action:visible').filter({ hasText: /^\+\d+ más$/ }).first().click({ timeout: 3000 }).then(() => true).catch(() => false)) return false;
        await page.waitForSelector('.hp-root .hp-item', { timeout: 3000 }).catch(() => {});
        const there = await page.evaluate((source) => [...document.querySelectorAll('.hp-root .hp-item')]
            .some(b => new RegExp(source).test((b.textContent || '').trim())), pattern.source);
        await page.locator('.popup:has(.hp-root) .popup-button-ok').click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(300);
        return there;
    };
    const chatHas = (/** @type {RegExp} */ pattern) => page.evaluate((source) => (window.SillyTavern.getContext().chat || [])
        .some((/** @type {any} */ m) => new RegExp(source).test(String(m.extra?.display_text || m.mes || ''))), pattern.source);
    const chatSince = (/** @type {number} */ from) => page.evaluate((start) => (window.SillyTavern.getContext().chat || [])
        .slice(start).map((/** @type {any} */ m) => String(m.extra?.display_text || m.mes || '')).join('\n'), from);
    const chatLength = () => page.evaluate(() => (window.SillyTavern.getContext().chat || []).length);
    const until = async (/** @type {() => Promise<boolean>} */ test, ms = 30000) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (await test().catch(() => false)) return true;
            await page.waitForTimeout(400);
        }
        return false;
    };
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
    const dropToasts = () => page.evaluate(() => {
        document.querySelectorAll('#toast-container .toast').forEach(t => t.remove());
        document.querySelectorAll('.vs-card').forEach(c => c.remove());
    });
    /** El dado de la partida: 0.999 saca siempre 20; nulo, al azar (se dice: es preparar la mesa). */
    const dice = (/** @type {number|null} */ value) => page.evaluate(async (v) => {
        (await import('/scripts/party/combat-rules.js')).setRandomSource(v === null ? null : () => v);
    }, value);
    const sceneNow = () => page.evaluate(() => document.querySelector('#game-shell')?.getAttribute('data-scene') || '');
    /** «Continuar» en la caja de la novela hasta que la escena sea otra. */
    const carryOn = async (/** @type {number} */ ms = 12000) => {
        await until(async () => {
            if (await sceneNow() !== 'dialogue') return true;
            await page.locator('#game-shell .gs-vn-box .gs-chip-continue:visible').first().click({ timeout: 1500 }).catch(() => {});
            return false;
        }, ms);
    };
    /** El combate: de quién es el turno. */
    const fight = () => page.evaluate(async () => {
        const enc = /** @type {any} */ ((await import('/scripts/party.js')).getCombatEncounter());
        const entry = enc?.active ? enc.turnOrder?.[enc.currentTurnIndex] ?? null : null;
        return { active: Boolean(enc?.active), turn: entry ? { name: String(entry.name), isEnemy: Boolean(entry.isEnemy) } : null };
    });
    /** La ventana de las salidas (evitar la pelea o hablar en ella), como se ve. */
    const exitWindow = () => page.evaluate(() => {
        const dialog = document.querySelector('dialog.ev-dialog[open]');
        if (!dialog) return null;
        const plate = /** @type {HTMLElement|null} */ (dialog.querySelector('.qd-nameplate'));
        return {
            kind: dialog.querySelector('.ev-root')?.getAttribute('data-kind') || '',
            plate: plate && !plate.hidden ? (plate.textContent || '').trim() : '',
            lines: [...dialog.querySelectorAll('.ev-text .qd-line')].map(p => (p.textContent || '').trim()),
            options: [...dialog.querySelectorAll('.ev-option')].map(o => ({
                id: o.getAttribute('data-exit') || '', locked: o.classList.contains('dw-locked'),
                text: (o.querySelector('.dw-said')?.textContent || '').trim(), why: (o.querySelector('.dw-why')?.textContent || '').trim(),
            })),
            next: (dialog.querySelector('.ev-next')?.textContent || '').trim(),
        };
    });
    /** Elegir una opción de la ventana, con el ratón, y esperar a lo que pasa. */
    const pickExit = async (/** @type {string} */ id, /** @type {string} */ what) => {
        await page.locator(`dialog.ev-dialog[open] .ev-option[data-exit="${id}"]`).click({ timeout: 5000 });
        await until(async () => Boolean((await exitWindow())?.next), 5000);
        const seen = await exitWindow();
        await shoot(what);
        await page.locator('dialog.ev-dialog[open] .ev-next').click({ timeout: 5000 }).catch(() => {});
        await until(async () => !(await exitWindow()), 5000);
        await page.waitForTimeout(600);
        await clearDice();
        return seen;
    };
    const toPlayerTurn = async () => {
        for (let i = 0; i < 30; i++) {
            await clearDice();
            const now = await fight();
            if (!now.active) return false;
            if (now.turn && !now.turn.isEnemy) return true;
            await page.waitForTimeout(500);
        }
        return false;
    };
    /** La sala abierta de la pantalla del pueblo: sus partes y lo que hay en cada una. */
    const placeScene = () => page.evaluate(() => {
        const scene = document.querySelector('#game-shell .gs-town-scene');
        if (!scene) return null;
        /** @type {Record<string, Array<{action: string, label: string, detail: string}>>} */
        const groups = {};
        let title = '';
        for (const node of scene.querySelectorAll('.gs-town-acts > *')) {
            if (node.classList.contains('gs-town-group')) { title = (node.textContent || '').trim(); continue; }
            (groups[title] ??= []).push({
                action: node.getAttribute('data-action') || '',
                label: (node.querySelector('.gs-btn-label')?.textContent || '').trim(),
                detail: (node.querySelector('.gs-btn-detail')?.textContent || '').trim(),
            });
        }
        return { place: scene.getAttribute('data-place') || '', groups };
    });
    /** Bajar la sala hasta su parte «Mirar», para que salga en la captura. */
    const showLooks = () => page.evaluate(() => {
        const head = [...document.querySelectorAll('#game-shell .gs-town-scene .gs-town-group')].find(g => /Mirar/.test(g.textContent || ''));
        head?.scrollIntoView({ block: 'center' });
        document.querySelectorAll('#toast-container .toast').forEach(t => t.remove());
    });

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    const firstRun = page.locator('text=Welcome to SillyTavern!');
    if (await firstRun.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) await page.click('.popup-button-ok');
    await page.waitForSelector('#game-shell', { timeout: 90000 });

    // 1. Jugar sin conexión: Bran, bardo, en el muelle.
    const offline = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Jugar sin conexión' });
    await until(async () => await offline.count() === 1, 30000);
    await offline.click();
    await page.waitForSelector('.hc-root', { timeout: 240000 });
    await page.fill('.hc-root .hc-name', 'Bran');
    await pickHeroCard(page, 'race', 'Humano');
    await pickHeroCard(page, 'class', 'Bardo');
    await page.locator('.hc-root .hc-enter').click();
    const atDock = await until(async () => (await state()).board === DOCK, 90000);
    check('se llega al muelle, con el ratero esperando', atDock, JSON.stringify({ state: await state(), chips: await chips() }));

    // 2. J8.5: en mitad de la pelea del muelle, «Hablar»: lo escrito para el ratero.
    // Se prepara: vida de sobra, para que un mal golpe no acabe la prueba antes de hablar.
    await until(async () => Boolean((await state()).hero), 20000);
    await page.evaluate(async () => {
        const st = await import('/scripts/party/state.js');
        const hero = st.partyMembers[0];
        if (!hero) return;
        Object.assign(hero, { hp: 200, maxHp: 200, gold: Math.max(Number(hero.gold) || 0, 20) });
        (await import('/scripts/party/roster.js')).savePartyState();
    });
    await dropToasts();
    // La pelea, como quien juega (`e2e-entrar-pelea.mjs`): «Continuar», «Pelear» en la ventana que
    // se abre al veros y «Empezar» en la barra de colocar. Sin todo eso, la ficha de antes.
    let started = await entrarEnLaPelea(page, { ms: 20000 });
    if (!started && await clickChip(/^Iniciar combate/)) started = await until(async () => (await fight()).active, 10000);
    const myTurn = await toPlayerTurn();
    await dropToasts();
    // «Hablar» en la barra del combate; en la barra nueva, «Parlamentar» dentro de «Acciones».
    if (!await page.locator('#game-shell .gs-btn-parley:visible').first().click({ timeout: 3000 }).then(() => true).catch(() => false)) {
        await page.locator('#game-shell .gs-btn[data-menu="acciones"]').first().click({ timeout: 3000 }).catch(() => {});
        await page.locator('[data-pick="parley"]').first().click({ timeout: 3000 }).catch(() => {});
    }
    const opened = await until(async () => (await exitWindow())?.kind === 'parley', 5000);
    const parley = await exitWindow();
    await shoot('hablar con el ratero, en mitad de la pelea');
    const way = (/** @type {string} */ id) => parley?.options.find(o => o.id === id);
    check('J8.5: en el muelle, «Hablar» abre lo escrito para el ratero: tirarle monedas, decirle que aún está a tiempo, gritar que viene la guardia',
        started && myTurn && opened && /Ratero del muelle/.test(parley?.plate ?? '')
        && /Tirarle unas monedas/.test(way('sobornar')?.text ?? '') && /aún está a tiempo/.test(way('convencer')?.text ?? '')
        && /la guardia del puerto/.test(way('enganar')?.text ?? ''), JSON.stringify(parley));
    check('J8.5: al ratero no se le rinde nadie: «Entregarse» sale cerrado, y dice por qué',
        way('entregarse')?.locked === true && /no hay trato/.test(way('entregarse')?.why ?? ''), JSON.stringify(way('entregarse')));
    await dice(0.999);
    const convinced = await pickExit('convencer', 'convencer al ratero');
    await dice(null);
    await until(async () => !(await fight()).active, 8000);
    const afterTalk = await state();
    check('J8.5: convencerle sale: suelta la bolsa y se tira al agua, la pelea se acaba y el muelle cuenta como ganado',
        /Al chico le tiembla el cuchillo/.test(convinced?.lines.join(' ') ?? '') && !afterTalk.fighting
        && afterTalk.won.some((/** @type {string} */ k) => k.endsWith(`::${DOCK}`)) && afterTalk.done.includes('el-muelle'),
        JSON.stringify({ convinced, afterTalk: { ...afterTalk, hero: undefined } }));

    // 3. Saltar la prueba (J2.3): al pueblo. D-J62: está en la Casa del Gremio, fuera del muelle.
    await carryOn();
    await salirDelTablero(page);
    await until(() => enElGremio(page, 'hub-skip'), 20000);
    await page.waitForSelector('.popup:has-text("¿Saltar la prueba?")', { timeout: 10000 }).catch(() => {});
    await page.locator('.popup-button-ok:visible').first().click({ timeout: 5000 }).catch(() => {});
    await until(() => chatHas(/apunta tu nombre en el libro del gremio|moja la pluma|Te saltas «|Ya subes|tengo el libro abierto/), 20000);
    await page.waitForTimeout(1200);
    await page.evaluate(() => document.querySelectorAll('.popup:not([closing]) .popup-button-ok').forEach(b => /** @type {HTMLElement} */ (b).click()));
    await carryOn();
    await page.waitForTimeout(800);

    // 4. J10.2: en Puerto Alba, lo que se puede mirar es de Puerto Alba, no del compendio. D-J62: con
    // el modo guiado no va en la fila: va en el sitio del pueblo al que pertenece (las barcas, en el muelle).
    const portAct = await buscarEnElPueblo(page, act => PORT_LOOKS.test(act.label));
    const portChip = portAct?.label ?? '';
    const plaza = await opcionesALaVista(page);
    await shoot('el sitio de Puerto Alba con lo que se puede mirar del puerto');
    check('J10.2: en Puerto Alba se ofrece mirar cosas del puerto, en su sitio (D-J62), y no las genéricas del compendio',
        Boolean(portChip) && !plaza.some(c => /carteles viejos del muro|callejones de detrás/.test(c)), JSON.stringify({ portAct, plaza }));
    await dice(0.999);
    const beforeLook = await chatLength();
    await page.locator(`#game-shell .gs-town-scene .gs-town-act[data-action="${portAct?.id ?? '---'}"]`).first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(800);
    await clearDice();
    const seenPort = await until(async () => PORT_FOUND.test(await chatSince(beforeLook)), 10000);
    await dice(null);
    await carryOn();
    await shoot('lo que se ve al mirar en el puerto');
    check(`J10.2: «${portChip}» tira y, si sale, cuenta lo que se ve`, seenPort, (await chatSince(beforeLook)).slice(0, 400));

    // 5. J3.11: dentro de «La Casa del Gremio», la parte «Mirar».
    await entrarEnSitio(page, 'gremio');
    await until(async () => (await placeScene())?.place === 'gremio', 8000);
    const hall = await placeScene();
    const hallLooks = (hall?.groups.Mirar ?? []).map(a => a.label);
    await showLooks();
    await shoot('la sala del gremio, con «Mirar»');
    check('J3.11 y J10.2: en la sala del gremio hay una parte «Mirar» con lo de la sala: la viga, el tablón viejo y las armas',
        HALL_LOOKS.every(l => hallLooks.includes(l)) && (hall?.groups.Mirar ?? []).every(a => /una vez al día/.test(a.detail)), JSON.stringify(hall?.groups.Mirar ?? hall));
    check('y lo de la sala no sale en la fila de abajo', !(await chips()).some(c => HALL_LOOKS.includes(c)), JSON.stringify(await chips()));
    await dice(0.999);
    const beforeBeam = await chatLength();
    await page.locator('#game-shell .gs-town-scene .gs-town-act').filter({ hasText: HALL_LOOKS[0] }).first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(800);
    await clearDice();
    const beam = await until(async () => /compañías que salieron de esta casa y no volvieron/.test(await chatSince(beforeBeam)), 10000);
    await dice(null);
    await carryOn();
    await until(async () => (await placeScene())?.place === 'gremio', 5000);
    const hallAfter = ((await placeScene())?.groups.Mirar ?? []).map(a => a.label);
    await showLooks();
    await shoot('la sala del gremio, tras mirar la viga');
    check('mirar la viga cuenta lo que se ve, y ese día ya no se ofrece otra vez',
        beam && !hallAfter.includes(HALL_LOOKS[0]) && hallAfter.includes(HALL_LOOKS[1]), JSON.stringify({ hallAfter, said: (await chatSince(beforeBeam)).slice(0, 300) }));

    // 6. El tablón: La Maldición de Strahd, y en la taberna, «Evitar la pelea» con la bruja.
    await dropToasts();
    await page.locator('#game-shell .gs-town-scene .gs-town-act[data-action="hub-board"]').first().click({ timeout: 5000 })
        .catch(async () => { await clickChip(/Tablón de campañas/); });
    await page.waitForSelector('.hb-root [data-campaign="strahd"]', { timeout: 15000 }).catch(() => {});
    await page.locator('.hb-root [data-campaign="strahd"]').click({ timeout: 5000 }).catch(() => {});
    const inStrahd = await until(async () => /Strahd/.test((await state()).world) && Boolean((await state()).board), 180000);
    await page.waitForTimeout(1500);
    await carryOn(20000);
    check('desde el tablón, Strahd empieza en la taberna', inStrahd && (await state()).board === 'Taberna Sangre de la Enredadera', JSON.stringify(await state()));
    await dropToasts();
    // La ficha de la fila o, si no cabe, el botón del tablero, como en e2e-peleas.
    if (!await clickChip(/^Evitar la pelea$/)) await page.locator('#game-shell .sc-avoid').first().click({ timeout: 5000 }).catch(() => {});
    await until(async () => Boolean(await exitWindow()), 5000);
    const avoid = await exitWindow();
    const talkOut = avoid?.options.find(o => /^hablar/.test(o.id))?.id ?? '';
    await dice(0.999);
    if (talkOut) await pickExit(talkOut, 'la bruja de la taberna, plantándole cara');
    await dice(null);
    await carryOn();
    const tavernDone = (await state()).won.some((/** @type {string} */ k) => k.endsWith('::Taberna Sangre de la Enredadera'));
    check('en la taberna, plantarle cara a la bruja la echa sin pelear y el tablero queda pasado', Boolean(talkOut) && tavernDone, JSON.stringify({ avoid, chips: await chips() }));

    // 7. J12.3: en el Sótano de la Iglesia, «Buscar trampas» encuentra el escalón podrido.
    await dropToasts();
    // Con la taberna pasada, la fila ofrece entrar en los otros tableros de la aldea: «Entrar en
    // Sótano de la Iglesia». Si no, se sale del tablero y se entra desde la localización.
    let inCellar = await clickChip(new RegExp(`^Entrar en ${CELLAR}$`))
        && await until(async () => (await state()).board === CELLAR, 15000);
    if (!inCellar) {
        await clickChip(/^Salir del tablero$/);
        await until(async () => !(await state()).board, 8000);
        await carryOn();
        if (!await clickChip(new RegExp(`^Entrar en ${CELLAR}$`))) {
            // D-J62: con el modo guiado no hay «Tableros de aquí»: «Ir a…» en lo que pide la historia.
            if (!await pasoDeLaHistoria(page, `story:board:${CELLAR}`)) await page.locator('#game-shell .gs-board').filter({ hasText: CELLAR }).first().click({ timeout: 5000 }).catch(() => {});
        }
        inCellar = await until(async () => (await state()).board === CELLAR, 15000);
    }
    await carryOn();
    await page.waitForTimeout(1000);
    const searchChip = await offered(/^Buscar trampas$/);
    await dice(0.999);
    const beforeSearch = await chatLength();
    await clickChip(/^Buscar trampas$/);
    await page.waitForTimeout(1000);
    await clearDice();
    const foundIt = await until(async () => /Encuentra (?:una trampa: )?escalón podrido\./i.test(await chatSince(beforeSearch)), 8000);
    await dice(null);
    const drawn = await page.evaluate(() => document.querySelectorAll('#game-shell .wm-hazard').length);
    const disarm = await offered(/^Desarmar: escalón podrido$/);
    // El tablero, sin el aviso encima, para que se vea la trampa dibujada.
    await page.waitForTimeout(1500);
    await dropToasts();
    await page.locator('#game-shell .wm-hazard').first().scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
    await shoot('el escalón podrido, encontrado al buscar');
    // Desarmarla pide estar a su lado: desde la entrada queda a dos casillas, así que aquí solo se apunta.
    check('J12.3: en el Sótano de la Iglesia, «Buscar trampas» encuentra el escalón podrido al pie de la escalera, y se dibuja',
        inCellar && searchChip && foundIt && drawn > 0,
        JSON.stringify({ inCellar, searchChip, foundIt, drawn, disarm, said: (await chatSince(beforeSearch)).slice(0, 300), chips: await chips() }));

    check('sin errores en la página', problems.length === 0, problems.slice(0, 6).join('\n        '));
} catch (error) {
    failures++;
    console.log(`FAIL  the run threw: ${/** @type {any} */ (error)?.message || error}`);
    if (SHOT && page) await page.screenshot({ path: `${SHOT.replace(/\.png$/i, '')}-error.png` }).catch(() => {});
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
