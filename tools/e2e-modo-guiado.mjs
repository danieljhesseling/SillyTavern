#!/usr/bin/env node
/**
 * D-J62, el modo guiado, jugado con el ratón contra un servidor propio con un `--dataRoot`
 * temporal, como las otras vueltas:
 *
 *   «Jugar sin conexión», Iria → el muelle (su escena y su pelea) → Puerto Alba sin la fila de
 *   acciones libres, sin «Tirada», sin «Tableros de aquí» ni «Viajar»; lo que pide la historia
 *   («Hablar con Brunilda») → la escena de la prueba: «Ahora no» deja la bodega sin botón → en la
 *   Casa del Gremio, «Hablar con Brunilda» → «Bajo a la bodega»: la pelea con las ratas → el libro
 *   → todo lo del gremio dentro de la Casa del Gremio (el tablón, contratar, los encargos, tus
 *   personajes, el cofre, entrenar…) → aceptar un encargo: «Ir a…» y, al llegar, su pelea →
 *   «Volver a Puerto Alba» → el tablón: 1387 → se sale del cuarto sin saltar por la ventana: «Ir a
 *   El cuarto de la posada» lleva de vuelta → Giles → «Ir a El Camino Viejo» (de camino a
 *   Campamento Furtivo): allí no se entra sola en ninguna pelea, y Los claros salen como secreto.
 *
 * Uso:
 *   node tools/e2e-modo-guiado.mjs                                   # sin ventana
 *   node tools/e2e-modo-guiado.mjs --headed
 *   node tools/e2e-modo-guiado.mjs --port 8580 --captura mg.png      # mg-01-puerto-alba.png…
 */

/* global window, document */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { entrarEnLaPelea } from './e2e-entrar-pelea.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8580;
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

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-guiado-'));
/** @type {any} */
let server = null;
/** @type {any} */
let browser = null;

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

try {
    await startServer();
    browser = await chromium.launch({ channel: 'msedge', headless: !HEADED });
    const context = await browser.newContext({ viewport: { width: 1400, height: 950 } });
    const page = await context.newPage();
    /** @type {string[]} */
    const problems = [];
    page.on('pageerror', (/** @type {any} */ e) => problems.push(`PAGEERROR ${e.message}`));
    page.on('console', (/** @type {any} */ m) => {
        if (m.type() === 'error' && !/Failed to load resource.*404/.test(m.text())) problems.push(`ERROR ${m.text().slice(0, 300)}`);
    });
    await context.addInitScript(() => {
        try {
            // Los consejos, vistos: aquí se mira el modo guiado, no enseñar a jugar.
            window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,combat,travel,prisoners,mesa,high,spell,pet,bill,move,attack,roll,talk,journal');
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
            window.localStorage.setItem('sillytavern_gameSucesos', 'off');
        } catch { /* nada */ }
    });

    let shots = 0;
    const shoot = async (/** @type {string} */ what) => {
        if (!SHOT) return;
        shots++;
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
    const dropToasts = () => page.evaluate(() => document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));
    /** Lo que el juego sabe ahora. */
    const state = () => page.evaluate(() => {
        const m = window.SillyTavern.getContext().chatMetadata || {};
        return {
            world: String(m.world_info ?? ''),
            here: String(m.currentLocation ?? ''),
            board: String(m.currentBoard ?? ''),
            fighting: Boolean(m.combatEncounter?.active),
            open: [...(m.plotState?.open || [])],
            done: [...(m.plotState?.done || [])],
            taken: m.contractTaken ? { title: String(m.contractTaken.title), where: String(m.contractTaken.locationName), board: String(m.contractTaken.boardName ?? '') } : null,
        };
    });
    const sceneNow = () => page.evaluate(() => document.querySelector('#game-shell')?.getAttribute('data-scene') || '');
    /** «Continuar» en la novela hasta la escena que toca. */
    const carryOn = async (/** @type {string} */ wanted) => {
        await until(async () => {
            if (await sceneNow() === wanted) return true;
            await page.evaluate(() => /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .gs-vn-box .gs-chip-continue'))?.click());
            return false;
        }, 12000);
        return sceneNow();
    };
    /** La ventana de historia abierta: una escena del hilo o una charla escrita. */
    const story = () => page.evaluate(() => {
        const scene = document.querySelector('dialog.ps-dialog[open] .ps-root');
        const talk = document.querySelector('dialog.dw-dialog[open]:not(.ps-dialog) .dw-root');
        const root = scene ?? talk;
        if (!root) return null;
        return {
            kind: scene ? 'scene' : 'dialogue',
            id: scene ? root.getAttribute('data-scene') || '' : root.getAttribute('data-dialogue') || '',
            text: (root.querySelector('.qd-text')?.textContent || '').replace(/\s+/g, ' ').trim(),
            options: [...root.querySelectorAll('.dw-option')].map(o => ({
                id: o.getAttribute('data-option') || '',
                text: (o.textContent || '').replace(/\s+/g, ' ').trim(),
                locked: o.classList.contains('dw-locked'),
            })),
        };
    });
    /** Jugar la ventana abierta (escena o charla), eligiendo lo de `pick` si sale. */
    const playStory = async (/** @type {string[]} */ pick = [], ms = 60000) => {
        /** @type {any[]} */
        const frames = [];
        const end = Date.now() + ms;
        let first = '';
        while (Date.now() < end) {
            const now = await story();
            if (!now) break;
            if (first && now.id !== first) break;
            first = now.id;
            frames.push(now);
            const free = now.options.filter((/** @type {any} */ o) => !o.locked);
            const sel = now.kind === 'scene' ? 'dialog.ps-dialog[open]' : 'dialog.dw-dialog[open]';
            if (free.length > 0) {
                const choice = pick.find(id => free.some((/** @type {any} */ o) => o.id === id)) ?? (now.kind === 'dialogue' ? free.find((/** @type {any} */ o) => o.id === 'adios')?.id : '') ?? free[0].id;
                await page.locator(`${sel} .dw-option[data-option="${choice || free[0].id}"]`).click({ timeout: 4000 }).catch(() => {});
                await page.waitForTimeout(150);
                if (await page.locator(`${sel} .dw-option.nr-armed[data-option="${choice || free[0].id}"]`).count() > 0) {
                    await page.locator(`${sel} .dw-option[data-option="${choice || free[0].id}"]`).click({ timeout: 4000 }).catch(() => {});
                }
            } else {
                await page.locator(`${sel} .ps-next, ${sel} .ps-finish, ${sel} .dw-finish, ${sel} .dw-leave`).first().click({ timeout: 4000 }).catch(() => {});
            }
            await page.waitForTimeout(250);
        }
        return frames;
    };
    /** Jugar las escenas que estén esperando (la primera opción en cada decisión). */
    const playAllScenes = async (/** @type {string[]} */ pick = []) => {
        for (let i = 0; i < 8; i++) {
            if (!await until(async () => (await story())?.kind === 'scene', 2500)) return;
            await playStory(pick);
            await page.waitForTimeout(500);
        }
    };
    /** Ganar la pelea que empieza sola en el tablero abierto. */
    const winFight = async () => {
        const fought = await entrarEnLaPelea(page);
        if (fought) {
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
        }
        return fought && !(await state()).fighting;
    };
    /** Salir del tablero a la pantalla del sitio, como quien juega: «Continuar». */
    const toPlace = async () => {
        await playAllScenes();
        await until(async () => {
            const now = await state();
            if (now.board === '' && await sceneNow() === 'exploration') return true;
            // En el tablero, sin pelea: «Salir del tablero» en la fila, o su botón de arriba a la izquierda.
            if (now.board && !now.fighting) {
                const left = await page.evaluate(() => {
                    const out = /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .gs-chip-action[data-chip="leave"]'))
                        ?? /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .vtt-tools .wm-leave-loc-btn'));
                    out?.click();
                    return Boolean(out);
                });
                if (left) return false;
            }
            await page.evaluate(() => /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .gs-chip-continue'))?.click());
            return false;
        }, 15000);
        await playAllScenes();
        return (await state()).board === '';
    };
    /** Lo que se ve en la pantalla del sitio: la fila de abajo, las columnas y lo que pide la historia. */
    const placeView = () => page.evaluate(() => ({
        foot: [...document.querySelectorAll('#game-shell .gs-actions .gs-chip-action')].map(c => c.getAttribute('data-chip') || (c.textContent || '').trim()),
        vnRow: [...document.querySelectorAll('#game-shell .gs-vn-box .gs-chips .gs-chip-action')].map(c => c.getAttribute('data-chip') || (c.textContent || '').trim()),
        check: document.querySelectorAll('#game-shell .gs-chip-check').length,
        cols: [...document.querySelectorAll('#game-shell .ex-column')].map(c => c.getAttribute('data-col')),
        steps: [...document.querySelectorAll('#game-shell .gs-story-step')].map(s => ({
            id: s.getAttribute('data-step') || '',
            label: (s.querySelector('.gs-place-name')?.textContent || '').trim(),
            note: (s.querySelector('.gs-card-note')?.textContent || '').trim(),
            on: !(/** @type {HTMLButtonElement} */ (s).disabled),
        })),
        places: [...document.querySelectorAll('#game-shell .gs-town-place')].map(p => p.getAttribute('data-place')),
    }));
    const FREE = /^(hub-(board|hire|errands|heroes|chest|train|house|formation|sleep|memory|hall|skip)|look:|rumor$|more$|enter:|go:|explore$|forage$|talk-local:|talk:|quedar|charlar|typed:)/;
    /** Si la pantalla del sitio está guiada: sin fila libre, sin «Tirada», sin tableros ni viajar. */
    const guidedOk = (/** @type {any} */ v) => !v.foot.some((/** @type {string} */ c) => FREE.test(c)) && v.check === 0
        && !v.cols.includes('boards') && !v.cols.includes('travel');
    const enterPlace = async (/** @type {string} */ id) => {
        if (await page.locator('#game-shell .gs-town-scene').count() > 0) {
            await page.locator('#game-shell .gs-town-back').click({ timeout: 5000 }).catch(() => {});
            await until(() => page.evaluate(() => !document.querySelector('#game-shell .gs-town-scene')), 5000);
        }
        await page.locator(`#game-shell .gs-town-place[data-place="${id}"]`).click({ timeout: 8000 }).catch(() => {});
        return until(() => page.evaluate((want) => document.querySelector('#game-shell .gs-town-scene')?.getAttribute('data-place') === want, id), 8000);
    };
    const leavePlace = async () => {
        await page.locator('#game-shell .gs-town-back').click({ timeout: 5000 }).catch(() => {});
        await until(() => page.evaluate(() => !document.querySelector('#game-shell .gs-town-scene')), 5000);
    };
    const placeActs = () => page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-town-scene .gs-town-act')].map(b => b.getAttribute('data-action') || ''));
    const act = (/** @type {string} */ id) => page.locator(`#game-shell .gs-town-scene .gs-town-act[data-action="${id}"]`).first().click({ timeout: 5000 }).then(() => true).catch(() => false);
    /** Pulsar un paso de lo que pide la historia, por su id o por lo que dice. */
    const step = async (/** @type {RegExp} */ pattern) => {
        await dropToasts();
        const target = (await placeView()).steps.find(s => pattern.test(s.id) || pattern.test(s.label));
        if (!target) return false;
        await page.locator(`#game-shell .gs-story-step[data-step="${target.id}"]`).click({ timeout: 5000 }).catch(() => {});
        return true;
    };
    /** Viajar con la ventana del viaje: el paso normal. */
    const travelPopup = async () => {
        const asked = await page.waitForSelector('.popup:visible .tr-ask', { timeout: 10000 }).then(() => true).catch(() => false);
        if (asked) await page.locator('.popup:visible .tr-pace-normal').first().click({ timeout: 5000 }).catch(() => {});
        return asked;
    };

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    if (await page.locator('text=Welcome to SillyTavern!').waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#game-shell', { timeout: 90000 });
    // El interruptor, encendido (es como sale el juego).
    const switchOn = await page.evaluate(async () => (await import('/scripts/game-engine/campaign/guided-mode.js')).GUIDED_MODE.on);
    check('el modo guiado sale encendido (`GUIDED_MODE.on`)', switchOn === true);

    // === 1. Iria, y el muelle ============================================================
    await page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Jugar sin conexión' }).click({ timeout: 30000 });
    await page.waitForSelector('.hc-root, dialog[open] .vt-card.vt-new', { timeout: 120000 });
    if (await page.locator('dialog[open] .vt-card.vt-new').count() > 0) await page.locator('dialog[open] .vt-card.vt-new').first().click();
    await page.waitForSelector('.hc-root', { timeout: 120000 });
    await page.fill('.hc-root .hc-name', 'Iria');
    await page.locator('.hc-root .hc-gender[data-value="Mujer"]').click().catch(() => {});
    for (const [pick, wanted] of [['race', 'Humano'], ['class', 'Guerrero']]) {
        await page.locator(`.hc-root .hc-card[data-pick="${pick}"] .hc-pick`).click();
        await page.waitForSelector('.hc-picker .hc-option', { timeout: 15000 });
        const values = await page.evaluate(() => [...document.querySelectorAll('.hc-picker .hc-option')].map(o => o.getAttribute('data-value') || ''));
        const chosen = values.find(v => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(wanted.toLowerCase())) ?? values[0];
        await page.locator(`.hc-picker .hc-option[data-value="${chosen}"]`).first().click();
        await page.waitForTimeout(400);
    }
    await page.locator('.hc-root .hc-enter').click();
    const pier = await until(async () => (await story())?.id === 'el-muelle', 90000);
    await playStory();
    let now = await state();
    check('se empieza en el muelle de Puerto Alba, con su escena', pier && now.board === 'El muelle de Puerto Alba', JSON.stringify(now));
    const pierWon = await winFight();
    check('la pelea del muelle empieza sola y se gana', pierWon, JSON.stringify(await state()));
    const outside = await toPlace();
    now = await state();

    // === 2. Puerto Alba, guiado ============================================================
    await until(async () => (await placeView()).places.length > 0, 10000);
    let view = await placeView();
    check('en Puerto Alba, fuera del muelle, se ven los sitios del pueblo', outside && view.places.includes('gremio') && view.places.includes('posada'), JSON.stringify({ now, view }));
    check('sin la fila de acciones libres, sin «Tirada», sin «Tableros de aquí» ni «Viajar» (D-J62)', guidedOk(view), JSON.stringify(view));
    check('la novela tampoco ofrece lo escondido en su fila (D-J62)', !view.vnRow.some(c => FREE.test(c)), JSON.stringify(view.vnRow));
    check('lo que pide la historia: «Hablar con Brunilda», con quién lo pide debajo', view.steps.some(s => s.id === 'story:talk:Brunilda' && /^Hablar con /.test(s.label) && /Lo pide la historia/.test(s.note)), JSON.stringify(view.steps));
    await shoot('puerto-alba');

    // Lo de mirar, en su sitio: los avisos de la lonja, en la tienda; las barcas, en el muelle.
    await enterPlace('tienda');
    const shopActs = await placeActs();
    await shoot('tienda-avisos');
    await leavePlace();
    const docks = view.places.includes('muelle') ? await enterPlace('muelle') : false;
    const docksActs = docks ? await placeActs() : [];
    if (docks) await leavePlace();
    await enterPlace('posada');
    const innActs = await placeActs();
    await leavePlace();
    check('lo que se mira suelto va a su sitio: los avisos de la lonja, en la tienda; las barcas, en el muelle (D-J62)',
        shopActs.some(a => /^look:/.test(a)) && (!docks || docksActs.some(a => /^look:/.test(a))), JSON.stringify({ shopActs, docksActs }));
    const rumorsLeft = await page.evaluate(async () => (await import('/scripts/party/town.js')).rumorsLeftHere());
    check('y los rumores, en la taberna, una sola vez (D-J62)', rumorsLeft === 0 || innActs.filter(a => a === 'rumor' || a === 'inn-rumor').length === 1, JSON.stringify({ rumorsLeft, innActs }));

    // === 3. Brunilda y la bodega, hablando =================================================
    await step(/^story:talk:Brunilda$/);
    const talkOpen = await until(async () => (await story())?.id === 'brunilda-la-casa', 10000);
    await playStory(['quiero-entrar', 'prueba-voy']);
    // La escena de la prueba: «Ninguna. Voy ahora mismo» y luego «Ahora no».
    const trialScene = await until(async () => (await story())?.id === 'la-prueba', 15000);
    const trialFrames = await playStory(['voy-ya', 'bodega-luego']);
    const lastFrame = trialFrames.find((/** @type {any} */ f) => f.options.some((/** @type {any} */ o) => o.id === 'bajo-a-la-bodega')) ?? null;
    await page.waitForTimeout(1200);
    now = await state();
    check('Brunilda manda a la bodega; su escena acaba con «Bajo a la bodega» o «Ahora no»', talkOpen && trialScene
        && Boolean(lastFrame?.options.some((/** @type {any} */ o) => o.id === 'bajo-a-la-bodega')) && Boolean(lastFrame?.options.some((/** @type {any} */ o) => o.id === 'bodega-luego')),
    JSON.stringify(lastFrame));
    await carryOn('exploration');
    view = await placeView();
    check('con «Ahora no» se sigue en el pueblo, y no hay ningún botón para entrar en la bodega: se baja hablando (D-J62)',
        now.board === '' && now.open.includes('la-prueba') && !view.steps.some(s => /bodega/i.test(`${s.id} ${s.label}`)), JSON.stringify({ now, steps: view.steps }));
    await enterPlace('gremio');
    const hallBefore = await placeActs();
    check('en la Casa del Gremio, durante el prólogo, está «Saltar la prueba»', hallBefore.includes('hub-skip'), JSON.stringify(hallBefore));
    await act('talk-local:Brunilda');
    const again = await until(async () => (await story())?.id === 'brunilda-la-casa', 10000);
    const offered = (await story())?.options.find((/** @type {any} */ o) => o.id === 'bajar') ?? null;
    await playStory(['bajar']);
    const cellar = await until(async () => (await state()).board === 'La bodega del gremio', 15000);
    check('«Hablar con Brunilda» → «Bajo a la bodega.»: se entra en la bodega (D-J62)', again && Boolean(offered) && cellar, JSON.stringify({ offered, now: await state() }));
    await page.waitForTimeout(1500);
    await shoot('bodega');
    const ratsWon = await winFight();
    check('y la pelea con las ratas empieza sola y se gana', ratsWon, JSON.stringify(await state()));
    await toPlace();
    // El libro: «Ya he limpiado la bodega» (antes, la escena de la subida, si sale).
    await playAllScenes();
    await carryOn('exploration');
    // Al subir de la bodega se está en la Casa del Gremio (o en la plaza): Brunilda, en su sala
    // («Hablar con Brunilda» del sitio) o en lo que pide la historia.
    const upAt = await page.evaluate(() => document.querySelector('#game-shell .gs-town-scene')?.getAttribute('data-place') || '');
    await until(async () => (await placeActs()).includes('talk-local:Brunilda') || (await placeView()).steps.some(s => s.id === 'story:talk:Brunilda'), 10000);
    if ((await placeActs()).includes('talk-local:Brunilda')) await act('talk-local:Brunilda');
    else await step(/^story:talk:Brunilda$/);
    const bookTalk = await until(async () => (await story())?.id === 'brunilda-la-casa', 10000);
    const bookOffered = (await story())?.options.some((/** @type {any} */ o) => o.id === 'hecho') ?? false;
    if (bookTalk) await playStory(['hecho', 'libro-tablon']);
    await page.waitForTimeout(1000);
    now = await state();
    check('Brunilda apunta tu nombre en el libro: el prólogo, hecho', now.done.includes('la-prueba') && now.done.includes('el-tablon'),
        JSON.stringify({ upAt, bookTalk, bookOffered, scene: await sceneNow(), now }));

    // === 4. Todo lo del gremio, dentro de la Casa del Gremio =================================
    await carryOn('exploration');
    view = await placeView();
    check('fuera, en la plaza, la fila sigue sin el tablón ni contratar (D-J62)', guidedOk(view), JSON.stringify(view));
    await enterPlace('gremio');
    const hall = await placeActs();
    const wanted = ['hub-board', 'hub-hire', 'hub-errands', 'hub-heroes', 'hub-chest', 'hub-train', 'hub-house', 'hub-formation', 'hub-sleep', 'hub-memory'];
    check('en la Casa del Gremio están el tablón, contratar, los encargos, tus personajes, el cofre, entrenar, los edificios, la formación, dormir y la memoria',
        wanted.every(id => hall.includes(id)), JSON.stringify({ missing: wanted.filter(id => !hall.includes(id)), hall }));
    await shoot('casa-del-gremio');

    // === 5. Un encargo: «Ir a…» y, al llegar, su pelea ====================================
    await act('hub-errands');
    await page.waitForSelector('.popup:visible .hb-root', { timeout: 10000 }).catch(() => {});
    const errands = await page.evaluate(() => [...document.querySelectorAll('.popup .hb-root .hb-card')].map(c => ({
        name: (c.querySelector('.vt-name')?.textContent || '').trim(), can: Boolean(c.querySelector('button')),
    })));
    const pickErrand = errands.find(e => e.can && /cala|faro|salinas|cementerio|carb[oó]n/i.test(e.name)) ?? errands.find(e => e.can);
    if (pickErrand) await page.locator('.popup:visible .hb-root .hb-card').filter({ hasText: pickErrand.name }).locator('button').first().click({ timeout: 5000 }).catch(() => {});
    await until(async () => Boolean((await state()).taken), 15000);
    await page.waitForTimeout(1000);
    await leavePlace();
    now = await state();
    view = await placeView();
    const goStep = view.steps.find(s => s.id.startsWith('story:go:') && /El encargo de/.test(s.note));
    check('aceptar un encargo da «Ir a…», con quién lo pide debajo (D-J62)', Boolean(now.taken) && Boolean(goStep) && /^Ir a /.test(goStep?.label ?? ''), JSON.stringify({ errands, taken: now.taken, steps: view.steps }));
    await shoot('encargo-ir-a');
    if (goStep) {
        await page.locator(`#game-shell .gs-story-step[data-step="${goStep.id}"]`).click({ timeout: 5000 }).catch(() => {});
        await travelPopup();
        const arrived = await until(async () => (await state()).here === now.taken?.where, 30000);
        const fightHere = await until(async () => Boolean((await state()).board), 15000);
        await page.waitForTimeout(1500);
        const there = await state();
        check('al llegar al sitio del encargo, se entra solo en su tablero (la pelea empieza sola)', arrived && fightHere && (!now.taken?.board || there.board === now.taken.board), JSON.stringify(there));
        await shoot('encargo-llegada');
        await winFight();
        await toPlace();
        view = await placeView();
        check('fuera del pueblo, sin «Tableros de aquí» ni «Viajar»; y se puede volver a Puerto Alba',
            guidedOk(view) && view.steps.some(s => s.id === 'story:go:Puerto Alba' && /^(Volver|Ir) a Puerto Alba$/.test(s.label)), JSON.stringify(view));
        await shoot('volver');
        await step(/^story:go:Puerto Alba$/);
        await travelPopup();
        await until(async () => (await state()).here === 'Puerto Alba', 30000);
        await playAllScenes();
        await carryOn('exploration');
    }

    // === 6. 1387: «Ir a…» adonde manda la historia ==========================================
    await enterPlace('gremio');
    await act('hub-board');
    await page.waitForSelector('.hb-root [data-campaign="1387"]', { timeout: 15000 }).catch(() => {});
    await page.locator('.hb-root [data-campaign="1387"]').click({ timeout: 5000 }).catch(() => {});
    const in1387 = await until(async () => /1387/.test((await state()).world), 150000);
    await page.waitForTimeout(2000);
    await playAllScenes();
    const inn = await winFight();
    check('1387 empieza en el cuarto de la posada, y su pelea se gana', in1387 && inn, JSON.stringify(await state()));
    // Se sale del cuarto sin haber saltado por la ventana: sin «Tableros de aquí», la historia
    // tiene que llevar de vuelta a terminarlo (si no, no habría por dónde seguir).
    await toPlace();
    await until(async () => (await placeView()).steps.length > 0, 10000);
    view = await placeView();
    const backToRoom = view.steps.find(s => s.id === 'story:board:El cuarto de la posada');
    check('en El Pueblo de Barro, sin fila libre ni «Viajar»; sin haber salido por la ventana, «Ir a El cuarto de la posada» dice lo que falta',
        guidedOk(view) && Boolean(backToRoom) && /Falta: Salir por la ventana/.test(backToRoom?.note ?? ''), JSON.stringify(view));
    await shoot('1387-pueblo');
    await step(/^story:board:El cuarto de la posada$/);
    const inRoom = await until(async () => (await state()).board === 'El cuarto de la posada', 10000);
    // Andar hasta la ventana (la casilla 8, 10), como quien arrastra su ficha.
    const walked = await page.evaluate(async () => {
        const { partyMembers } = await import('/scripts/party/state.js');
        const { handleTokenMove } = await import('/scripts/party/board.js');
        const hero = partyMembers.find((/** @type {any} */ m) => !m.dead);
        if (hero) handleTokenMove(hero.id, 7, 9);
        return hero ? `${hero.mapPosition?.gridX},${hero.mapPosition?.gridY}` : '';
    });
    const escaped = await until(async () => (await state()).done.includes('el-caliz-ensangrentado'), 10000);
    check('«Ir a El cuarto de la posada» → se vuelve a él, se sale por la ventana y el hito se cumple', inRoom && escaped, JSON.stringify({ walked, now: await state() }));

    // Giles: la escena de después abre su charla, o se habla con él por lo que pide la historia.
    const GILES = ['quien-subio', 'pagar', 'convencer', 'furtivos', 'barro', 'camino-gracias', 'precio-no-vale'];
    await playAllScenes();
    if ((await story())?.id !== 'giles-lo-que-vio') {
        await toPlace();
        await carryOn('exploration');
        await leavePlace();
        await until(async () => (await placeView()).steps.some(s => s.id === 'story:talk:Giles'), 10000);
        await step(/^story:talk:Giles$/);
    }
    const gilesTalk = await until(async () => (await story())?.id === 'giles-lo-que-vio', 10000);
    for (let i = 0; i < 3 && (await story())?.id === 'giles-lo-que-vio'; i++) await playStory(GILES);
    const paid = await until(async () => (await state()).done.includes('el-precio-del-escape'), 8000);
    check('Giles cuenta por dónde ir: el hito, hecho', gilesTalk && paid, JSON.stringify(await state()));

    // Lo siguiente, la pista en el barro: «Ir a El Camino Viejo», de camino a Campamento Furtivo.
    await playAllScenes();
    await carryOn('exploration');
    await leavePlace();
    await until(async () => (await placeView()).steps.some(s => s.id === 'story:go:El Camino Viejo'), 10000);
    view = await placeView();
    const toCamino = view.steps.find(s => s.id === 'story:go:El Camino Viejo');
    check('la historia manda «Ir a El Camino Viejo», de camino a Campamento Furtivo, con quién lo pide',
        guidedOk(view) && Boolean(toCamino) && /Lo pide la historia/.test(toCamino?.note ?? '') && /Campamento Furtivo/.test(toCamino?.note ?? ''), JSON.stringify(view));
    if (toCamino) {
        await step(/^story:go:El Camino Viejo$/);
        await travelPopup();
        const there = await until(async () => (await state()).here === 'El Camino Viejo', 30000);
        await page.waitForTimeout(2500);
        await playAllScenes();
        await carryOn('exploration');
        await until(async () => (await placeView()).steps.length > 0, 10000);
        const atCamino = await state();
        view = await placeView();
        const secret = view.steps.find(s => s.id === 'story:board:Los claros del Camino Viejo');
        check('en El Camino Viejo no se entra sola en ninguna pelea; la historia sigue («Ir a Campamento Furtivo») y Los claros salen como cosa vuestra (un secreto)',
            there && atCamino.board === '' && view.steps.some(s => s.id === 'story:go:Campamento Furtivo')
            && Boolean(secret) && /Nadie os lo ha pedido/.test(secret?.note ?? '') && !/explorador/i.test(secret?.note ?? ''), JSON.stringify({ atCamino, view }));
        await shoot('1387-camino-viejo');
        if (secret) {
            await step(/^story:board:Los claros del Camino Viejo$/);
            const inClaros = await until(async () => (await state()).board === 'Los claros del Camino Viejo', 10000);
            const fought = inClaros ? await entrarEnLaPelea(page) : false;
            check('«Ir a Los claros del Camino Viejo»: se entra, y la pelea empieza sola', inClaros && fought, JSON.stringify(await state()));
            await shoot('1387-los-claros');
        }
    }

    check('sin errores en la página', problems.length === 0, problems.slice(0, 6).join('\n        '));
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

console.log(failures === 0 ? '\nTodo bien.' : `\n${failures} fallo(s).`);
process.exit(failures === 0 ? 0 : 1);
