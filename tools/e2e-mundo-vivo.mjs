#!/usr/bin/env node
/**
 * El mundo de cada campaña, vivo, sin conexión y con el ratón (J10.1, J10.3 con D-J42, J10.5 y
 * J11.3 de wiki/ROADMAP_SIN_CONEXION.md), contra un servidor propio con un `--dataRoot`
 * temporal, como las otras vueltas.
 *
 *   «Jugar sin conexión», Irene → saltar la prueba → el tablón: 1387 → en El Pueblo de Barro, la
 *   columna «Viajar» dice que la granja está cerrada, por qué y qué la abre (J10.1) → robar en la
 *   tienda de Vera y que os pillen (los Leales os miran peor) → «Mapa»: el mapa dibujado, con el
 *   candado de la granja y una nota (J10.5); «Viajar aquí» al Camino Viejo → de vuelta al pueblo,
 *   los hombres de Vane os cobran el paso: un suceso propio de 1387 que sale porque os miran mal
 *   (J10.3, D-J42) → otro robo, otro viaje, y al volver los guardias: se paga la multa (J11.3) →
 *   Dunstan, en la herrería, sabe lo de la multa → al caerles bien a los Leales, «Se os abre el
 *   camino» y se viaja a la granja (J10.1).
 *
 * Lo preparado a mano, dicho: el oro del héroe (lo que se gana con encargos); que al llegar
 * salga un suceso seguro y ya vistos los del compendio (el azar del juego no se puede esperar
 * en una prueba); y la subida de los Leales de la última parte, con la misma función que usa
 * el hito del castillo (llegar allí pide tres hitos antes).
 *
 * Uso:
 *   node tools/e2e-mundo-vivo.mjs                          # sin ventana
 *   node tools/e2e-mundo-vivo.mjs --headed
 *   node tools/e2e-mundo-vivo.mjs --port 8345 --captura mv.png   # mv-01-granja-cerrada.png…
 */

/* global window, document */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { apagarModoGuiado, enElGremio, salirDelTablero } from './e2e-guiado.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8345;
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

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-mundo-vivo-'));
/** @type {any} */
let server = null;
/** @type {any} */
let browser = null;
/** Lo que la página dice que falla, para enseñarlo si la vuelta se rompe. @type {string[]} */
const pageProblems = [];

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
 * Una tarjeta del creador de personajes.
 *
 * @param {any} page
 * @param {string} pick
 * @param {string} wanted
 */
async function pickHeroCard(page, pick, wanted) {
    await page.locator(`.hc-root .hc-card[data-pick="${pick}"] .hc-pick`).click();
    await page.waitForSelector('.hc-picker .hc-option', { timeout: 15000 });
    const plain = (/** @type {string} */ v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const values = await page.evaluate(() => [...document.querySelectorAll('.hc-picker .hc-option')].map(o => o.getAttribute('data-value') || ''));
    const chosen = values.find((/** @type {string} */ v) => plain(v).includes(plain(wanted))) ?? values[0];
    await page.locator(`.hc-picker .hc-option[data-value="${chosen}"]`).first().click();
    await page.waitForSelector('.hc-picker', { state: 'detached', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(200);
}

try {
    await startServer();
    browser = await chromium.launch({ channel: 'msedge', headless: !HEADED });
    const context = await browser.newContext({ viewport: { width: 1400, height: 950 } });
    const page = await context.newPage();
    const problems = pageProblems;
    page.on('pageerror', (/** @type {any} */ e) => problems.push(`PAGEERROR ${e.message}`));
    page.on('console', (/** @type {any} */ m) => {
        if (m.type() === 'error' && !/Failed to load resource.*404/.test(m.text())) problems.push(`ERROR ${m.text().slice(0, 300)}`);
    });
    await context.addInitScript(() => {
        try {
            window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,combat,travel,prisoners,mesa,high,spell,pet,bill,move,attack,roll,talk,journal');
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
            // Los sucesos, encendidos (como vienen); las ventanas de la historia, apagadas: sus
            // escenas no son lo que se mira aquí y taparían los clics.
            window.localStorage.setItem('sillytavern_gameSucesos', 'on');
            window.localStorage.setItem('sillytavern_gameStoryWindows', 'off');
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
            await page.waitForTimeout(300);
        }
        return false;
    };
    const state = () => page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const meta = ctx.chatMetadata ?? {};
        const party = (await import('/scripts/party.js')).getPartyMembersSnapshot();
        const factions = (await import('/scripts/party/factions.js')).getCurrentWorldFactions();
        return {
            world: String(meta.world_info ?? ''),
            place: String(meta.currentLocation ?? ''),
            board: String(meta.currentBoard ?? ''),
            gold: party.reduce((/** @type {number} */ sum, /** @type {any} */ m) => sum + (Number(m.gold) || 0), 0),
            wanted: meta.wanted ?? {},
            marks: meta.worldMarks ?? [],
            notes: meta.mapNotes ?? {},
            gates: meta.gatesOpen ?? null,
            leales: Number(factions.find((/** @type {any} */ f) => f.id === 'leales-de-montesclaros')?.reputation ?? NaN),
        };
    });
    const chatTexts = () => page.evaluate(() => (window.SillyTavern.getContext().chat || []).map((/** @type {any} */ m) => String(m.extra?.display_text ?? m.mes ?? '')));
    const sceneNow = () => page.evaluate(() => document.querySelector('#game-shell')?.getAttribute('data-scene') || '');
    const carryOn = async (/** @type {string} */ wanted) => {
        await until(async () => {
            if (await sceneNow() === wanted) return true;
            await page.evaluate(() => /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .gs-vn-box .gs-chip-continue'))?.click());
            return false;
        }, 12000);
        return sceneNow();
    };
    const dropToasts = () => page.evaluate(() => document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));
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
    /** Que las tiradas salgan (un 20 natural), que fallen (un 1), o que vuelvan a ser al azar. */
    const loadedDice = (/** @type {'bien'|'mal'|''} */ how) => page.evaluate(async (want) => {
        const rules = await import('/scripts/party/combat-rules.js');
        rules.setRandomSource(want === 'bien' ? () => 0.999 : want === 'mal' ? () => 0 : null);
    }, how);
    /** La tarjeta de suceso abierta, si la hay. */
    const sucesoCard = () => page.evaluate(() => {
        const root = document.querySelector('.popup:not([closing]) .su-root');
        return root ? {
            id: root.getAttribute('data-suceso') || '',
            name: (root.querySelector('h3')?.textContent || '').trim(),
            text: (root.querySelector('.su-text')?.textContent || '').trim(),
            options: [...root.querySelectorAll('.su-option')].map(o => (o.querySelector('.su-label')?.textContent || '').trim()),
        } : null;
    });
    /** Elegir una opción de la tarjeta abierta (la primera que se pueda, si no se dice) y seguir. */
    const answerSuceso = async (/** @type {RegExp|null} */ pick = null) => {
        const clicked = await page.evaluate((source) => {
            const options = [...document.querySelectorAll('.popup:not([closing]) .su-root .su-option:not([disabled])')];
            const chosen = (source ? options.find(o => new RegExp(source).test(o.textContent || '')) : null) ?? options[0];
            if (chosen instanceof window.HTMLElement) chosen.click();
            return chosen ? (chosen.textContent || '').trim() : '';
        }, pick ? pick.source : '');
        await page.waitForTimeout(700);
        await clearDice();
        const result = await page.evaluate(() => (document.querySelector('.popup:not([closing]) .su-root .su-result')?.textContent || '').replace(/\s+/g, ' ').trim());
        await page.locator('.popup:not([closing]) .su-root .su-go').first().click({ timeout: 4000 }).catch(() => {});
        await until(() => page.evaluate(() => !document.querySelector('.popup:not([closing]) .su-root')), 5000);
        return { clicked, result };
    };
    /** Lo que se abra encima al viajar o llegar (un contratiempo, un encuentro, un aviso), fuera. */
    const clearPopups = async () => {
        await clearDice();
        for (let i = 0; i < 8; i++) {
            const open = await page.evaluate(() => {
                const pick = (/** @type {string} */ sel) => /** @type {HTMLElement|null} */ (document.querySelector(sel));
                const button = pick('.popup:not([closing]) .tr-detour') ?? pick('.popup:not([closing]) .rd-pass')
                    ?? pick('.popup:not([closing]) .rd-face') ?? pick('.popup:not([closing]) .popup-button-ok');
                if (button && button.offsetParent) {
                    button.click();
                    return true;
                }
                return false;
            });
            if (!open) return;
            await page.waitForTimeout(500);
        }
    };
    /** La escena de un sitio del pueblo, y entrar en uno. */
    const placeScene = () => page.evaluate(() => {
        const scene = document.querySelector('#game-shell .gs-town-scene');
        const line = scene?.querySelector('.gs-town-line');
        return {
            place: scene?.getAttribute('data-place') || '',
            line: (line?.textContent || '').trim(),
            remembered: Boolean(line?.classList.contains('gs-town-line-remembered')),
            acts: [...(scene?.querySelectorAll('.gs-town-act') ?? [])].map(b => ({
                id: b.getAttribute('data-action') || '',
                enabled: !(/** @type {HTMLButtonElement} */ (b).disabled),
            })),
        };
    });
    const leavePlace = async () => {
        if (await page.locator('#game-shell .gs-town-scene').count() === 0) return;
        await page.locator('#game-shell .gs-town-back').click({ timeout: 5000 }).catch(() => {});
        await until(() => page.evaluate(() => !document.querySelector('#game-shell .gs-town-scene')), 5000);
    };
    const enterPlace = async (/** @type {string} */ id) => {
        await leavePlace();
        await page.locator(`#game-shell .gs-town-place[data-place="${id}"]`).click({ timeout: 8000 }).catch(() => {});
        return until(async () => (await placeScene()).place === id, 8000);
    };
    /** La tarjeta de un sitio en la columna «Viajar». */
    const travelCard = (/** @type {string} */ name) => page.evaluate((wanted) => {
        const card = [...document.querySelectorAll('#game-shell .gs-place')].find(c => (c.querySelector('.gs-place-name')?.textContent || '').trim() === wanted);
        return card ? {
            disabled: /** @type {HTMLButtonElement} */ (card).disabled,
            reach: [...card.classList].find(c => c.startsWith('reach-')) ?? '',
            note: (card.querySelector('.gs-place-note')?.textContent || '').trim(),
            title: card.getAttribute('title') || '',
        } : null;
    }, name);
    /** Viajar: la pregunta de lo que cuesta, a paso normal, y lo que salga por el camino. */
    const travelFromPopup = async (/** @type {string} */ to, /** @type {(card: any) => Promise<boolean>} */ onCard = async () => false) => {
        await page.waitForSelector('.popup:visible .tr-pace-normal', { timeout: 10000 });
        await page.locator('.popup:visible .tr-pace-normal').click({ timeout: 5000 });
        /** @type {any[]} */
        const cards = [];
        /** @type {string[]} */
        const guards = [];
        for (let i = 0; i < 40; i++) {
            await page.waitForTimeout(500);
            const guard = await page.evaluate(() => {
                const box = document.querySelector('.popup:not([closing]) .tr-setback');
                if (!box || !/Los guardias/.test(box.textContent || '')) return null;
                return {
                    text: (box.textContent || '').replace(/\s+/g, ' ').trim(),
                    buttons: [...document.querySelectorAll('.popup:not([closing]) .gd-pay, .popup:not([closing]) .gd-flee')].map(b => (b.textContent || '').trim()),
                };
            });
            if (guard) {
                guards.push(`${guard.text} [${guard.buttons.join(' | ')}]`);
                await page.locator('.popup:not([closing]) .gd-pay, .popup:not([closing]) .gd-flee').first().click({ timeout: 4000 }).catch(() => {});
                continue;
            }
            const card = await sucesoCard();
            if (card) {
                const handled = await onCard(card);
                if (!handled) cards.push({ ...card, ...(await answerSuceso()) });
                continue;
            }
            await clearPopups();
            if ((await state()).place === to && i > 6 && !(await sucesoCard())) break;
        }
        await dropToasts();
        await carryOn('exploration');
        return { cards, guards };
    };

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    if (await page.locator('text=Welcome to SillyTavern!').waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#game-shell', { timeout: 90000 });
    // D-J62: lo que se mira aquí (la columna «Viajar», «Viajar aquí» en el mapa) lo esconde el modo
    // guiado, sin borrarlo (wiki/LO_OCULTO.md): se prueba con él apagado.
    check('el modo guiado, apagado para probar lo que esconde', await apagarModoGuiado(page));

    // === 1. «Jugar sin conexión», Irene, y saltar la prueba =======================================
    const offline = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Jugar sin conexión' });
    await until(async () => await offline.count() === 1, 30000);
    await offline.click();
    await page.waitForSelector('.hc-root, dialog[open] .vt-card.vt-new', { timeout: 120000 });
    if (await page.locator('dialog[open] .vt-card.vt-new').count() > 0) await page.locator('dialog[open] .vt-card.vt-new').first().click();
    await page.waitForSelector('.hc-root', { timeout: 120000 });
    await page.fill('.hc-root .hc-name', 'Irene');
    await page.locator('.hc-root .hc-gender[data-value="Mujer"]').click().catch(() => {});
    await pickHeroCard(page, 'race', 'Humano');
    await pickHeroCard(page, 'class', 'Guerrero');
    await page.locator('.hc-root .hc-enter').click();
    await until(async () => /Gremio/.test((await state()).world), 90000);
    // D-J62: «Saltar la prueba» está en la Casa del Gremio, fuera del tablero del muelle.
    await salirDelTablero(page);
    await until(() => enElGremio(page, 'hub-skip'), 30000);
    await page.waitForSelector('.popup:has-text("¿Saltar la prueba?")', { timeout: 10000 }).catch(() => {});
    await page.locator('.popup-button-ok:visible').first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await clearPopups();
    await dropToasts();
    await carryOn('exploration');
    // Oro para las multas y los peajes: lo que en una partida se gana con encargos.
    await page.evaluate(async () => {
        const { partyMembers } = await import('/scripts/party/state.js');
        if (partyMembers[0]) partyMembers[0].gold = 200;
        (await import('/scripts/party/roster.js')).savePartyState();
    });

    // === 2. El tablón: 1387, y fuera del tablero del principio ====================================
    // D-J62: el tablón de campañas está en la Casa del Gremio.
    await until(() => enElGremio(page, 'hub-board'), 15000);
    await page.waitForSelector('.hb-root [data-campaign="1387"]', { timeout: 15000 });
    await page.locator('.hb-root [data-campaign="1387"]').click();
    const in1387 = await until(async () => /1387/.test((await state()).world), 150000);
    await page.waitForTimeout(2500);
    await clearPopups();
    await dropToasts();
    for (let i = 0; i < 4 && (await state()).board; i++) {
        await carryOn('combat');
        await page.locator('.wm-leave-loc-btn').filter({ visible: true }).first().click({ timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(900);
        await clearPopups();
    }
    await carryOn('exploration');
    let now = await state();
    check('a 1387 desde el tablón, fuera del tablero del principio, en El Pueblo de Barro',
        in1387 && now.board === '' && now.place === 'El Pueblo de Barro', JSON.stringify({ world: now.world, place: now.place, board: now.board }));

    // === 3. J10.1: la granja, cerrada; el viaje dice por qué y qué la abre =========================
    const farm = await travelCard('La Granja Quemada');
    const showCard = (/** @type {string} */ name) => page.evaluate((wanted) => [...document.querySelectorAll('#game-shell .gs-place')]
        .find(c => (c.querySelector('.gs-place-name')?.textContent || '').trim() === wanted)?.scrollIntoView({ block: 'center' }), name);
    await showCard('La Granja Quemada');
    await shoot('granja-cerrada');
    check('J10.1: en «Viajar», La Granja Quemada sale cerrada, con el candado, y dice por qué y qué la abre',
        Boolean(farm?.disabled) && farm?.reach === 'reach-shut'
        && /hombres de Vane vigilan el sendero de la granja/.test(String(farm?.note))
        && /Se abre si Leales de Montesclaros os conocen o si en El Pueblo de Barro sois alguien/.test(String(farm?.note)),
        JSON.stringify(farm));
    const road = await travelCard('El Camino Viejo');
    check('J10.1: los demás vecinos siguen abiertos (el Camino Viejo)', road?.reach === 'reach-near' && !road?.disabled, JSON.stringify(road));

    // === 4. J11.3: robar en la tienda de Vera, y que os pillen =======================================
    /** Robar lo más barato de la tienda con los dados en contra: os pillan. */
    const stealCaught = async () => {
        await enterPlace('tienda');
        const steal = (await placeScene()).acts.find(a => a.id.startsWith('shop-steal:') && a.enabled);
        if (!steal) return '';
        await loadedDice('mal');
        await page.locator(`#game-shell .gs-town-scene .gs-town-act[data-action="${steal.id}"]`).click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(1500);
        await clearDice();
        await loadedDice('');
        await dropToasts();
        await carryOn('exploration');
        await leavePlace();
        await page.waitForTimeout(1200);
        return steal.id;
    };
    const lealesBefore = (await state()).leales;
    const firstTheft = await stealCaught();
    now = await state();
    check('J11.3: pillados robando en la tienda: os apuntan en el pueblo y los Leales (que mandan allí) os miran peor',
        Boolean(firstTheft) && Number(now.wanted['El Pueblo de Barro']) === 1 && now.leales === lealesBefore - 1
        && now.marks.filter((/** @type {any} */ m) => m.deed === 'robo').length === 1,
        JSON.stringify({ firstTheft, wanted: now.wanted, leales: [lealesBefore, now.leales], marks: now.marks }));

    // === 5. J10.5: el mapa dibujado ================================================================
    await page.locator('#game-shell .gs-tools .gs-map').click({ timeout: 8000 });
    const mapOpen = await page.waitForSelector('dialog.cm-dialog[open] .cm-root', { timeout: 10000 }).then(() => true).catch(() => false);
    await page.waitForTimeout(600);
    const drawn = await page.evaluate(() => {
        const root = document.querySelector('dialog.cm-dialog[open] .cm-root');
        return {
            title: (root?.querySelector('.cm-title')?.textContent || '').trim(),
            places: [...(root?.querySelectorAll('.cm-place') ?? [])].map(p => ({
                name: p.getAttribute('data-place') || '', state: p.getAttribute('data-state') || '', reach: p.getAttribute('data-reach') || '',
            })),
            roads: root?.querySelectorAll('line.cm-road').length ?? 0,
            shut: [...(root?.querySelectorAll('.cm-mark.cm-gate-shut') ?? [])].map(m => /** @type {HTMLElement} */ (m).dataset.road || ''),
            legend: [...(root?.querySelectorAll('.cm-legend-item') ?? [])].map(l => (l.textContent || '').trim()),
        };
    });
    check('J10.5: «Mapa» abre el mapa de 1387 dibujado: los siete sitios que se ven, sus caminos y la leyenda',
        mapOpen && drawn.title === 'El mapa de 1387' && drawn.places.length === 7 && drawn.roads >= 7
        && drawn.places.find(p => p.name === 'El Pueblo de Barro')?.state === 'aqui' && drawn.legend.includes('Se abre con algo'),
        JSON.stringify(drawn));
    check('J10.5: el camino a la granja, en el mapa con su candado y lo que pide (J10.1)',
        drawn.shut.some(r => r.split('|').sort().join('|') === 'El Pueblo de Barro|La Granja Quemada'), JSON.stringify(drawn.shut));
    await page.locator('dialog.cm-dialog[open] .cm-place[data-place="La Granja Quemada"]').click({ timeout: 5000 });
    await page.waitForTimeout(300);
    const farmSide = await page.evaluate(() => (document.querySelector('dialog.cm-dialog[open] .cm-side-reach')?.textContent || '').trim());
    check('J10.5: al pulsar la granja, dice por qué no se puede ir y qué lo abre',
        /^El paso está cerrado: .*Se abre si Leales de Montesclaros os conocen/.test(farmSide), farmSide);
    await page.locator('dialog.cm-dialog[open] .cm-place[data-place="Castillo de Vane"]').click({ timeout: 5000 });
    await page.locator('dialog.cm-dialog[open] .cm-note').fill('Preguntar por la plata de Vane.');
    await page.locator('dialog.cm-dialog[open] .cm-note-save').click();
    await page.waitForTimeout(500);
    const pinned = await page.evaluate(() => Boolean(document.querySelector('dialog.cm-dialog[open] .cm-place[data-place="Castillo de Vane"] .cm-pin')));
    await shoot('mapa');
    now = await state();
    check('J10.5: tu nota se guarda en la partida y el sitio lleva su chincheta',
        now.notes['Castillo de Vane'] === 'Preguntar por la plata de Vane.' && pinned, JSON.stringify({ notes: now.notes, pinned }));
    // «Viajar aquí», desde el mapa, al Camino Viejo.
    await page.locator('dialog.cm-dialog[open] .cm-place[data-place="El Camino Viejo"]').click({ timeout: 5000 });
    await page.locator('dialog.cm-dialog[open] .cm-travel').click({ timeout: 5000 });
    const trip1 = await travelFromPopup('El Camino Viejo');
    now = await state();
    check('J10.5: «Viajar aquí» en el mapa viaja como la columna: primero lo que cuesta, y se llega',
        now.place === 'El Camino Viejo' && !(await page.locator('dialog.cm-dialog[open]').count()), JSON.stringify({ place: now.place, cards: trip1.cards.map(c => c.id) }));

    // === 6. De vuelta al pueblo: los hombres de Vane os cobran el paso (J10.3, D-J42) =================
    // Preparado: al llegar sale un suceso seguro, y los de llegada del compendio ya se vieron.
    await page.evaluate(async () => {
        (await import('/scripts/game-engine/campaign/sucesos.js')).SUCESO_CHANCE.llegada = 1;
        const { compendium } = await (await import('/scripts/game-engine/compendio/browser.js')).getCompendium();
        const meta = window.SillyTavern.getContext().chatMetadata;
        const arrivals = compendium.find('sucesos', {}).filter((/** @type {any} */ r) => [r.when?.momento].flat().includes('llegada')).map((/** @type {any} */ r) => String(r.id));
        meta.sucesos = { ...(meta.sucesos ?? {}), seen: arrivals };
    });
    now = await state();
    await page.locator('#game-shell .gs-place').filter({ hasText: 'El Pueblo de Barro' }).first().click({ timeout: 8000 });
    /** @type {any} */
    let vane = null;
    const trip2 = await travelFromPopup('El Pueblo de Barro', async (card) => {
        if (card.id !== 'leales-cobran-el-paso' || vane) return false;
        await shoot('los-de-vane');
        vane = { ...card, ...(await answerSuceso(/Pagar lo que piden/)) };
        return true;
    });
    await page.waitForTimeout(2500);
    let after = await state();
    check('J10.3 y D-J42: como los Leales os miran mal, al llegar os paran los hombres de Vane (un suceso de 1387), con su nombre',
        vane?.id === 'leales-cobran-el-paso' && /^Tres hombres con el emblema de Leales de Montesclaros/.test(String(vane?.text)) && trip2.guards.length === 0,
        JSON.stringify({ vane, other: trip2.cards.map(c => c.id), guards: trip2.guards }));
    check('J10.3: pagar lo que piden mueve a los Leales, y se dice en la tarjeta',
        /Leales de Montesclaros: os miran mejor/.test(String(vane?.result)) && after.leales === now.leales + 1,
        JSON.stringify({ result: vane?.result, leales: [now.leales, after.leales] }));

    // === 6b. J11.3: otra vez a la tienda; al volver del camino, los guardias =========================
    const secondTheft = await stealCaught();
    now = await state();
    check('J11.3: pillados otra vez: ya os buscan en el pueblo (dos)',
        Boolean(secondTheft) && Number(now.wanted['El Pueblo de Barro']) === 2 && now.marks.filter((/** @type {any} */ m) => m.deed === 'robo').length === 2,
        JSON.stringify({ secondTheft, wanted: now.wanted, marks: now.marks }));
    await page.locator('#game-shell .gs-place').filter({ hasText: 'El Camino Viejo' }).first().click({ timeout: 8000 });
    await travelFromPopup('El Camino Viejo');
    await page.locator('#game-shell .gs-place').filter({ hasText: 'El Pueblo de Barro' }).first().click({ timeout: 8000 });
    const trip3 = await travelFromPopup('El Pueblo de Barro');
    await page.waitForTimeout(2000);
    after = await state();
    check('J11.3: al volver, los guardias os paran por lo robado: se paga la multa y la huella queda',
        trip3.guards.some(g => /Los guardias/.test(g) && /Pagar 30 de oro/.test(g)) && after.marks.some((/** @type {any} */ m) => m.deed === 'multa' && m.town === 'El Pueblo de Barro')
        && !after.wanted['El Pueblo de Barro'],
        JSON.stringify({ guards: trip3.guards, marks: after.marks, wanted: after.wanted }));

    // === 7. J11.3: Dunstan, en la herrería, sabe lo de la multa =====================================
    await enterPlace('herreria');
    await until(async () => (await placeScene()).remembered, 8000);
    const smithy = await placeScene();
    await shoot('herreria-multa');
    check('J11.3: en la herrería, Dunstan os saluda sabiendo que pagasteis la multa',
        smithy.place === 'herreria' && smithy.remembered && /Pagaste la multa, así que estamos en paz/.test(smithy.line), JSON.stringify(smithy));
    await leavePlace();

    // === 8. J10.1: al caerles bien a los Leales, se abre el camino, y se dice ======================
    const told = (await chatTexts()).length;
    // Preparado: lo que da el hito del castillo (+2 a los Leales), con la misma función.
    await page.evaluate(async () => { await (await import('/scripts/party/factions.js')).shiftFactionStanding('leales-de-montesclaros', 2); });
    await page.waitForTimeout(1500);
    const opened = (await chatTexts()).slice(told).find(t => /\[CAMINO\]/.test(t)) ?? '';
    await carryOn('exploration');
    const farmOpen = await travelCard('La Granja Quemada');
    await showCard('La Granja Quemada');
    await shoot('granja-abierta');
    check('J10.1: con los Leales a favor, «Se os abre el camino de El Pueblo de Barro a La Granja Quemada», una vez',
        /Se os abre el camino de El Pueblo de Barro a La Granja Quemada: Leales de Montesclaros os conocen\./.test(opened)
        && (await chatTexts()).filter(t => /Se os abre el camino de El Pueblo de Barro a La Granja Quemada/.test(t)).length === 1,
        opened);
    check('J10.1: y en «Viajar» la granja ya se puede pulsar', farmOpen?.reach === 'reach-near' && !farmOpen?.disabled, JSON.stringify(farmOpen));
    await page.locator('#game-shell .gs-place').filter({ hasText: 'La Granja Quemada' }).first().click({ timeout: 8000 });
    await travelFromPopup('La Granja Quemada');
    now = await state();
    check('J10.1: y se llega a la granja', now.place === 'La Granja Quemada', now.place);

    const serious = problems.filter(p => !/favicon|ResizeObserver|net::ERR/.test(p));
    check('sin errores en la página', serious.length === 0, serious.slice(0, 5).join('\n'));
} catch (error) {
    failures++;
    console.log(`FAIL  the run threw: ${error instanceof Error ? error.message : String(error)}`);
    for (const line of pageProblems.slice(0, 8)) console.log(`        ${line}`);
} finally {
    await browser?.close().catch(() => {});
    server?.kill();
    try {
        rmSync(dataRoot, { recursive: true, force: true });
    } catch { /* nada */ }
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
