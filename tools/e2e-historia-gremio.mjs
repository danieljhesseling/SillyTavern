#!/usr/bin/env node
/**
 * La historia jugada sin conexión, desde el gremio y solo con el ratón (J7.5, J9.3, J9.5, J9.6,
 * J10, J11.1 a J11.5 y las caras de J13 de wiki/ROADMAP_SIN_CONEXION.md), contra un servidor
 * propio con un `--dataRoot` temporal, como las otras vueltas. Nada se escribe: sin conexión no
 * hay caja.
 *
 *   «Jugar sin conexión», Tessa → la escena del muelle en su ventana: «Yo me encargo» deja algo
 *   para días después → «Saltar la prueba» → el Diario es un libro (J9.6): el prólogo, lo que
 *   decidisteis y lo que salió de ello → «mirar» algo de Puerto Alba, y la tirada dice si sale
 *   (J10) → en las opciones, los sucesos con decisión; tres noches en la taberna, y vuelve Tomás
 *   con lo del muelle (J11.2) → contratar a Gerd → robar en la tienda y que os pillen: Marisa os
 *   saluda de otra forma, con su cara de enfadada, y todo sale más caro (J11.3) → el tablón:
 *   Strahd → en la primera escena, «A Gerd le gusta esto» junto a la opción (J7.5), y al elegirla
 *   se dice y cuenta para el vínculo → el libro de Strahd, por su capítulo (J9.3) → el plazo de lo
 *   que tenéis entre manos, en la cabecera (J9.5) → volver al gremio: en el tablón, por qué
 *   capítulo ibais y «La crónica» (J11.5) → seguir y terminar Strahd → la vuelta dice cómo os
 *   llaman, y Brunilda os saluda sabiendo cómo acabó, con su cara (J11.4).
 *
 * Uso:
 *   node tools/e2e-historia-gremio.mjs                                  # sin ventana
 *   node tools/e2e-historia-gremio.mjs --headed
 *   node tools/e2e-historia-gremio.mjs --port 8301 --captura hg.png     # hg-01-muelle.png…
 */

/* global window, document */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8193;
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

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-historia-gremio-'));
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
    page.on('pageerror', e => problems.push(`PAGEERROR ${e.message}`));
    page.on('console', m => {
        if (m.type() === 'error' && !/Failed to load resource.*404/.test(m.text())) problems.push(`ERROR ${m.text().slice(0, 300)}`);
    });
    await context.addInitScript(() => {
        try {
            if (window.localStorage.getItem('sillytavern_gameTipsSeen') === null) {
                window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,combat,travel,prisoners,mesa,high,spell,pet,bill,move,attack,roll,talk,journal');
            }
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
            // Los sucesos se encienden desde las opciones, como lo haría quien juega (J11.2).
            if (window.localStorage.getItem('sillytavern_gameSucesos') === null) window.localStorage.setItem('sillytavern_gameSucesos', 'off');
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
    const meta = () => page.evaluate(() => {
        const m = window.SillyTavern.getContext().chatMetadata || {};
        return {
            world: String(m.world_info ?? ''),
            done: [...(m.plotState?.done || [])], open: [...(m.plotState?.open || [])], played: [...(m.plotScenesPlayed || [])],
            decisions: (m.plotDecisions || []).map((/** @type {any} */ d) => ({ text: String(d.text), milestone: String(d.milestone ?? ''), came: d.came ?? [] })),
            pending: (m.sucesos?.pending || []).map((/** @type {any} */ p) => ({ id: String(p.id), day: Number(p.day) })),
            marks: m.worldMarks ?? [],
            approval: m.approval ?? null,
            day: Number(/^Día (\d+)/.exec((document.querySelector('#game-shell .gs-clock-label')?.textContent || '').trim())?.[1]) || 0,
            dialogues: m.dialogues ?? {},
        };
    });
    /** Las ventanas de la noche (J14.7) y las quedadas: la primera respuesta, seguir, terminar. */
    const clearNight = async () => {
        for (let i = 0; i < 20; i++) {
            const open = await page.locator('dialog.qd-dialog[open]:not(.dw-dialog)').count();
            if (open === 0) return;
            if (await page.locator('dialog.qd-dialog[open] .qd-chip-reply').count() > 0) await page.locator('dialog.qd-dialog[open] .qd-chip-reply').first().click({ timeout: 3000 }).catch(() => {});
            else if (await page.locator('dialog.qd-dialog[open] .qd-chip').count() > 0) await page.locator('dialog.qd-dialog[open] .qd-chip').first().click({ timeout: 3000 }).catch(() => {});
            else await page.locator('dialog.qd-dialog[open] .qd-leave').first().click({ timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(300);
        }
    };
    const chatTexts = () => page.evaluate(() => (window.SillyTavern.getContext().chat || []).map((/** @type {any} */ m) => String(m.extra?.display_text ?? m.mes ?? '')));
    const chips = () => page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-chip-action')].map(c => (c.textContent || '').trim()));
    const clickChip = (/** @type {RegExp} */ pattern) => page.evaluate((source) => {
        const chip = [...document.querySelectorAll('#game-shell .gs-chip-action')].find(b => new RegExp(source).test(b.textContent || ''));
        if (chip instanceof window.HTMLElement) chip.click();
        return Boolean(chip);
    }, pattern.source);
    const sceneNow = () => page.evaluate(() => document.querySelector('#game-shell')?.getAttribute('data-scene') || '');
    /** J18.8: «Continuar», al acabar de leer, hasta la escena que toca. */
    const carryOn = async (/** @type {string} */ wanted) => {
        await until(async () => {
            if (await sceneNow() === wanted) return true;
            await page.evaluate(() => /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .gs-vn-box .gs-chip-continue'))?.click());
            return false;
        }, 10000);
        return sceneNow();
    };
    /** Que las tiradas salgan (un 20 natural), que fallen (un 1), o que vuelvan a ser al azar. */
    const loadedDice = (/** @type {'bien'|'mal'|''} */ how) => page.evaluate(async (want) => {
        const rules = await import('/scripts/party/combat-rules.js');
        rules.setRandomSource(want === 'bien' ? () => 0.999 : want === 'mal' ? () => 0 : null);
    }, how);
    /** La ventana de historia abierta: una escena del hilo o una charla escrita. */
    const story = () => page.evaluate(() => {
        const scene = document.querySelector('dialog.ps-dialog[open] .ps-root');
        const talk = document.querySelector('dialog.dw-dialog[open]:not(.ps-dialog) .dw-root');
        const root = scene ?? talk;
        if (!root) return null;
        return {
            kind: scene ? 'scene' : 'dialogue',
            id: scene ? root.getAttribute('data-scene') || '' : root.getAttribute('data-dialogue') || '',
            plate: (root.querySelector('.qd-nameplate')?.textContent || '').trim(),
            text: (root.querySelector('.qd-text')?.textContent || '').replace(/\s+/g, ' ').trim(),
            // D-J60: lo que ha cambiado sale en el aviso de fuera de la caja.
            notes: [...root.querySelectorAll('.qd-text .dw-note, .qd-aside .vn-aside-line')].map(n => (n.textContent || '').trim()),
            options: [...root.querySelectorAll('.dw-option')].map(o => ({
                id: o.getAttribute('data-option') || '',
                locked: o.classList.contains('dw-locked'),
                opinions: [...o.querySelectorAll('.dw-opinion')].map(b => ({ text: (b.textContent || '').trim(), mood: /** @type {HTMLElement} */ (b).dataset.mood || '' })),
            })),
        };
    });
    /** Jugar la escena abierta, eligiendo lo de `pick` si sale. Devuelve lo que se vio en cada pantalla. */
    const playScene = async (/** @type {string[]} */ pick = [], /** @type {(frame: any) => Promise<void>} */ onAsk = async () => {}) => {
        /** @type {any[]} */
        const frames = [];
        for (let i = 0; i < 60; i++) {
            const now = await story();
            if (!now || now.kind !== 'scene') break;
            if (frames.length > 0 && now.id !== frames[0].id) break;
            frames.push(now);
            const free = now.options.filter((/** @type {any} */ o) => !o.locked);
            if (free.length > 0) {
                await onAsk(now);
                const choice = pick.find(id => free.some((/** @type {any} */ o) => o.id === id)) ?? free[0].id;
                await page.locator(`dialog.ps-dialog[open] .dw-option[data-option="${choice}"]`).click({ timeout: 4000 }).catch(() => {});
                // Lo que no tiene vuelta atrás se decide a la segunda pulsación (J11.1).
                await page.waitForTimeout(150);
                if (await page.locator(`dialog.ps-dialog[open] .dw-option.nr-armed[data-option="${choice}"]`).count() > 0) {
                    await page.locator(`dialog.ps-dialog[open] .dw-option[data-option="${choice}"]`).click({ timeout: 4000 }).catch(() => {});
                }
            } else {
                await page.locator('dialog.ps-dialog[open] .ps-next, dialog.ps-dialog[open] .ps-finish').first().click({ timeout: 4000 }).catch(() => {});
            }
            await page.waitForTimeout(250);
        }
        return frames;
    };
    /** Jugar todas las escenas que estén esperando (la primera opción en cada decisión). */
    const playAllScenes = async () => {
        for (let i = 0; i < 6; i++) {
            if (!await until(async () => (await story())?.kind === 'scene', 2500)) return;
            await playScene();
            await page.waitForTimeout(600);
        }
    };
    /** Lo que se ve del libro. */
    const readBook = () => page.evaluate(() => {
        const q = (/** @type {string} */ s) => document.querySelector(s);
        return {
            open: Boolean(q('dialog.lb-dialog[open]')),
            kicker: (q('.lb-dialog .lb-kicker')?.textContent ?? '').trim(),
            title: (q('.lb-dialog .lb-title')?.textContent ?? '').trim(),
            now: (q('.lb-dialog .lb-now')?.textContent ?? '').trim(),
            tabs: [...document.querySelectorAll('.lb-dialog .lb-tab')].map(t => ({
                view: /** @type {HTMLElement} */ (t).dataset.view,
                name: (t.querySelector('.lb-tab-name')?.textContent ?? '').trim(),
                note: (t.querySelector('.lb-tab-note')?.textContent ?? '').trim(),
            })),
            view: /** @type {HTMLElement|null} */ (q('.lb-dialog .lb-page'))?.dataset.view ?? '',
            entries: [...document.querySelectorAll('.lb-dialog .lb-entry')].map(e => ({
                id: /** @type {HTMLElement} */ (e).dataset.page,
                title: (e.querySelector('.lb-entry-title')?.textContent ?? '').trim(),
                said: [...e.querySelectorAll('.lb-said')].map(s => (s.textContent ?? '').trim()),
                came: [...e.querySelectorAll('.lb-came li, .lb-outcome li')].map(s => (s.textContent ?? '').trim()),
            })),
            decided: [...document.querySelectorAll('.lb-dialog .lb-decided .lb-decision')].map(d => ({
                said: (d.querySelector('.lb-said')?.textContent ?? '').trim(),
                came: [...d.querySelectorAll('li')].map(s => (s.textContent ?? '').trim()),
            })),
        };
    });
    const openDiary = async () => {
        await page.evaluate(() => /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .gs-tools .gs-journal'))?.click());
        return page.waitForSelector('dialog.lb-dialog[open] .lb-page', { timeout: 10000 }).then(() => true).catch(() => false);
    };
    const closeBook = async () => {
        await page.locator('dialog.lb-dialog[open] .lb-close').first().click({ timeout: 4000 }).catch(() => {});
        await until(() => page.evaluate(() => !document.querySelector('dialog.lb-dialog[open]')), 4000);
    };
    /** Lo que se ve dentro de un sitio del pueblo. */
    const placeScene = () => page.evaluate(() => {
        const scene = document.querySelector('#game-shell .gs-town-scene');
        const face = /** @type {HTMLImageElement|null} */ (scene?.querySelector('.gs-town-portrait img'));
        const line = scene?.querySelector('.gs-town-line');
        return {
            place: scene?.getAttribute('data-place') || '',
            face: face ? String(face.getAttribute('src')) : '',
            mood: /** @type {HTMLElement|null} */ (scene?.querySelector('.gs-town-portrait'))?.dataset.mood || '',
            line: (line?.textContent || '').trim(),
            remembered: Boolean(line?.classList.contains('gs-town-line-remembered')),
            acts: [...(scene?.querySelectorAll('.gs-town-act') ?? [])].map(b => ({
                id: b.getAttribute('data-action') || '',
                text: (b.querySelector('.gs-btn-label')?.textContent || b.textContent || '').replace(/\s+/g, ' ').trim(),
                cost: Number((b.querySelector('.gs-btn-cost')?.textContent || '').replace(/\D+/g, '')) || 0,
                enabled: !(/** @type {HTMLButtonElement} */ (b).disabled),
                detail: (b.querySelector('.gs-btn-detail')?.textContent || '').trim(),
            })),
        };
    });
    const enterPlace = async (/** @type {string} */ id) => {
        if (await page.locator('#game-shell .gs-town-scene').count() > 0) {
            await page.locator('#game-shell .gs-town-back').click({ timeout: 5000 }).catch(() => {});
            await until(() => page.evaluate(() => !document.querySelector('#game-shell .gs-town-scene')), 5000);
        }
        await page.locator(`#game-shell .gs-town-place[data-place="${id}"]`).click({ timeout: 8000 }).catch(() => {});
        return until(async () => (await placeScene()).place === id, 8000);
    };
    /** Una tarjeta de suceso abierta: su nombre. */
    const sucesoCard = () => page.evaluate(() => {
        const root = document.querySelector('.popup:not([closing]) .su-root');
        return root ? { id: root.getAttribute('data-suceso') || '', name: (root.querySelector('h3')?.textContent || '').trim(), text: (root.querySelector('.su-text')?.textContent || '').trim() } : null;
    });
    /** Elegir la primera opción que se pueda de la tarjeta abierta, y seguir. */
    const answerSuceso = async () => {
        await page.locator('.popup:not([closing]) .su-root .su-option:not([disabled])').first().click({ timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(600);
        await clearDice();
        await page.locator('.popup:not([closing]) .su-root .su-go').first().click({ timeout: 4000 }).catch(() => {});
        await until(() => page.evaluate(() => !document.querySelector('.popup:not([closing]) .su-root')), 5000);
    };

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    if (await page.locator('text=Welcome to SillyTavern!').waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#game-shell', { timeout: 90000 });

    // === 1. «Jugar sin conexión»: Tessa, y la escena del muelle =====================================
    await page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Jugar sin conexión' }).click({ timeout: 30000 });
    await page.waitForSelector('.hc-root, dialog[open] .vt-card.vt-new', { timeout: 120000 });
    if (await page.locator('dialog[open] .vt-card.vt-new').count() > 0) await page.locator('dialog[open] .vt-card.vt-new').first().click();
    await page.waitForSelector('.hc-root', { timeout: 120000 });
    await page.fill('.hc-root .hc-name', 'Tessa');
    await page.locator('.hc-root .hc-gender[data-value="Mujer"]').click();
    // Humana y soldado: Brunilda tiene algo que decirle a una veterana (J8.2).
    for (const [pick, wanted] of [['race', 'Humano'], ['class', 'Soldado']]) {
        await page.locator(`.hc-root .hc-card[data-pick="${pick}"] .hc-pick`).click();
        await page.waitForSelector('.hc-picker .hc-option', { timeout: 15000 });
        const values = await page.evaluate(() => [...document.querySelectorAll('.hc-picker .hc-option')].map(o => o.getAttribute('data-value') || ''));
        const chosen = values.find(v => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(wanted.toLowerCase())) ?? values[0];
        await page.locator(`.hc-picker .hc-option[data-value="${chosen}"]`).first().click();
        await page.waitForTimeout(400);
    }
    await page.locator('.hc-root .hc-enter').click();
    const pier = await until(async () => (await story())?.id === 'el-muelle', 90000);
    await shoot('muelle');
    await playScene(['yo-me-encargo']);
    await page.waitForTimeout(1200);
    let now = await meta();
    const pierFollow = now.pending.find(p => p.day >= 3);
    check('J11.2: en la escena del muelle, «Yo me encargo» deja algo para días después',
        pier && now.played.includes('el-muelle') && Boolean(pierFollow), JSON.stringify({ played: now.played, pending: now.pending }));

    // «Saltar la prueba», como quien ya sabe jugar (J2.3): el prólogo queda hecho.
    await dropToasts();
    await until(async () => (await chips()).some(c => /^Saltar la prueba$/.test(c)), 15000);
    await clickChip(/^Saltar la prueba$/);
    await page.waitForSelector('.popup:has-text("¿Saltar la prueba?")', { timeout: 10000 }).catch(() => {});
    await page.locator('.popup-button-ok:visible').first().click({ timeout: 5000 }).catch(() => {});
    await until(async () => (await meta()).done.includes('la-prueba'), 20000);
    await playAllScenes();
    await clearDice();
    await dropToasts();
    await carryOn('exploration');
    const town = await until(() => page.evaluate(() => document.querySelectorAll('#game-shell .gs-town-place').length > 0), 20000);

    // === 2. J9.6: el Diario es un libro ==========================================================
    const diaryOpen = await openDiary();
    let book = await readBook();
    await shoot('diario-prologo');
    const pierPage = book.entries.find(e => e.id === 'el-muelle');
    check('J9.6: sin conexión, el Diario se abre como un libro, por su capítulo, con lo del muelle',
        town && diaryOpen && book.kicker === 'Diario' && book.tabs.some(t => t.view === 'decided') && Boolean(pierPage),
        JSON.stringify({ kicker: book.kicker, title: book.title, tabs: book.tabs, entries: book.entries.map(e => e.id) }));
    check('J9.6: en su página, lo que decidiste («Yo me encargo») y lo que salió de ello (Tomás os mira mejor)',
        Boolean(pierPage?.said.some(s => /Yo me encargo/.test(s))) && Boolean(pierPage?.came.some(c => /Tomás/.test(c))), JSON.stringify(pierPage));
    await page.locator('.lb-dialog .lb-tab[data-view="notes"]').click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(250);
    const notes = await page.evaluate(() => [...document.querySelectorAll('.lb-dialog .lb-list-title')].map(t => (t.textContent || '').trim()));
    check('J9.6: lo de siempre del Diario sigue en sus «Apuntes»', notes.length > 0, JSON.stringify(notes));
    await closeBook();

    // === 3. J10: mirar algo de Puerto Alba, y la tirada dice si sale ================================
    // Las fichas de mirar son las que examinan algo del sitio (del paquete, o del compendio si el
    // sitio no escribe las suyas, como Puerto Alba).
    const lookChips = () => page.evaluate(() => [...new Set([...document.querySelectorAll('#game-shell .gs-chip-action[data-chip^="look:"]')]
        .map(c => (c.textContent || '').trim()))]);
    await until(async () => (await lookChips()).length > 0, 8000);
    const lookOffered = await lookChips();
    const lookFrom = (await chatTexts()).length;
    await loadedDice('bien');
    await clickChip(new RegExp(`^${String(lookOffered[0] ?? '---').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
    await page.waitForTimeout(1500);
    await clearDice();
    await loadedDice('');
    const looked = (await chatTexts()).slice(lookFrom).join('\n');
    // Sin conexión, lo que salió de mirar se lee en la novela (no solo en el dado).
    const novelText = () => page.evaluate(() => (document.querySelector('#game-shell .gs-vn-box')?.textContent || '').replace(/\s+/g, ' ').trim());
    const novelLook = await until(async () => await sceneNow() === 'dialogue' && /✓ Éxito/.test(await novelText()), 8000);
    const novelSaid = await novelText();
    await shoot('mirar');
    await carryOn('exploration');
    const lookedAfter = await lookChips();
    check('J10: en Puerto Alba se ofrece mirar algo del sitio; al pulsarlo, la tirada dice que sale, y ya no se ofrece hoy',
        lookOffered.length >= 1 && /🎲 [^\n]*✓/.test(looked) && !lookedAfter.includes(lookOffered[0]),
        JSON.stringify({ offered: lookOffered, after: lookedAfter, looked: looked.slice(0, 300) }));
    check('J10: y lo que salió de mirarlo se lee en la novela, con «Continuar»', novelLook, novelSaid.slice(0, 300));
    await dropToasts();
    await carryOn('exploration');

    // === 4. Contratar a Gerd =========================================================================
    await until(async () => (await chips()).some(c => /Contratar mercenarios/.test(c)), 8000);
    await clickChip(/Contratar mercenarios/);
    await page.waitForSelector('.hb-root [data-hireling="Gerd el Mellado"]', { timeout: 15000 }).catch(() => {});
    await page.locator('.hb-root [data-hireling="Gerd el Mellado"]').click({ timeout: 5000 }).catch(() => {});
    const hired = await until(() => page.evaluate(async () => (await import('/scripts/party.js')).getPartyMembersSnapshot().some((/** @type {any} */ m) => m.name === 'Gerd el Mellado')), 10000);
    check('Gerd se une al grupo', hired);
    await carryOn('exploration');

    // === 4b. D-J36 y J7.5: «Hablar con Brunilda» abre su charla, y Gerd opina de lo que dices =======
    await enterPlace('gremio');
    const talkAct = (await placeScene()).acts.find(a => a.id === 'talk-local:Brunilda');
    await page.locator('#game-shell .gs-town-scene .gs-town-act[data-action="talk-local:Brunilda"]').click({ timeout: 5000 }).catch(() => {});
    const talkOpen = await until(async () => (await story())?.id === 'brunilda-la-casa', 10000);
    const talkFirst = await story();
    const extras = await page.evaluate(() => [...document.querySelectorAll('dialog.dw-dialog[open] .dw-extra')].map(e => e.getAttribute('data-extra') || ''));
    check('D-J36: en la sala del gremio, «Hablar con Brunilda» abre directamente su charla escrita, con «Otras cosas»',
        Boolean(talkAct) && talkOpen && extras.includes('otras'), JSON.stringify({ talkAct, extras, options: talkFirst?.options.map((/** @type {any} */ o) => o.id) }));
    const veteran = talkFirst?.options.find((/** @type {any} */ o) => o.id === 'veterana');
    await shoot('charla-opiniones');
    check('J7.5: en la charla, junto a «[Soldado] Reconozco a una veterana…», «A Gerd le gusta esto»',
        Boolean(veteran?.opinions.some((/** @type {any} */ b) => b.text === 'A Gerd le gusta esto' && b.mood === 'bien')), JSON.stringify(talkFirst?.options));
    await page.locator('dialog.dw-dialog[open] .dw-option[data-option="veterana"]').click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(600);
    const afterVeteran = await story();
    check('J7.5: al decirlo, la charla sigue y la ventana dice «A Gerd le ha gustado.»',
        Boolean(afterVeteran?.notes.includes('A Gerd le ha gustado.')), JSON.stringify(afterVeteran?.notes));
    // Lo que cuenta de su pasado, y el libro del gremio: «Ya he limpiado la bodega» cumple el hito.
    for (const id of ['veterana-por-que', 'pasado-siento', 'hecho', 'libro-tablon']) {
        await page.locator(`dialog.dw-dialog[open] .dw-option[data-option="${id}"]`).click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(400);
    }
    await page.locator('dialog.dw-dialog[open] .dw-finish, dialog.dw-dialog[open] .dw-leave').first().click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(800);
    now = await meta();
    const learned = JSON.stringify(now.dialogues?.['brunilda-la-casa']?.learned ?? []);
    check('J8: lo que se dice aplica sus efectos (el hito del libro del gremio) y lo que cuenta Brunilda queda recordado',
        now.done.includes('el-tablon') && /compañía/.test(learned), JSON.stringify({ done: now.done, learned: learned.slice(0, 300) }));
    await playAllScenes();
    await dropToasts();
    await carryOn('exploration');
    await openDiary();
    const told = await page.evaluate(() => [...document.querySelectorAll('.lb-dialog .lb-page .lb-list')]
        .filter(l => /Lo que os contaron/.test(l.querySelector('.lb-list-title')?.textContent || ''))
        .flatMap(l => [...l.querySelectorAll('li')].map(i => (i.textContent || '').trim())));
    await shoot('diario-contado');
    check('J8: en el Diario, en su capítulo, «Lo que os contaron»: lo que dijo Brunilda de su pasado',
        told.some(t => /^Brunilda: .*compañía/.test(t)), JSON.stringify(told));
    await closeBook();

    // === 5. J11.2: con los sucesos encendidos, tres noches en la taberna, y vuelve Tomás ============
    await page.evaluate(() => /** @type {HTMLElement|null} */ (document.activeElement)?.blur());
    await page.keyboard.press('Escape');
    await page.waitForSelector('#game-shell .gs-pause', { timeout: 5000 }).catch(() => {});
    await page.locator('#game-shell .gs-pause-btn').filter({ hasText: 'Opciones' }).first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForSelector('.go-root .go-row[data-option="sucesos"]', { timeout: 8000 }).catch(() => {});
    const sucesosBefore = await page.locator('.go-root .go-row[data-option="sucesos"] .go-value').textContent({ timeout: 3000 }).catch(() => '');
    await page.locator('.go-root .go-row[data-option="sucesos"]').click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(300);
    const sucesosOn = await page.evaluate(() => window.localStorage.getItem('sillytavern_gameSucesos') !== 'off');
    await page.locator('.popup:has(.go-root) .popup-button-ok').click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(300);
    if (await page.locator('#game-shell .gs-pause').count() > 0) await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    check('en las opciones del juego se encienden los sucesos con decisión', sucesosOn, String(sucesosBefore));

    await carryOn('exploration');
    /** @type {any} */
    let returned = null;
    /** @type {string[]} */
    const cardsSeen = [];
    for (let night = 0; night < 5 && !returned; night++) {
        await enterPlace('posada');
        await page.locator('#game-shell .gs-town-scene .gs-town-act[data-action="inn-room"]').click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(1200);
        // J14.7: antes de dormir, a veces pasa algo en la taberna (una escena de la noche).
        await clearNight();
        await page.waitForTimeout(800);
        await page.evaluate(() => document.querySelectorAll('.popup:not([closing]):not(:has(.su-root)) .popup-button-ok').forEach(b => /** @type {HTMLElement} */ (b).click()));
        for (let tries = 0; tries < 4; tries++) {
            const card = await until(async () => Boolean(await sucesoCard()), 3000) ? await sucesoCard() : null;
            if (!card) break;
            cardsSeen.push(card.name);
            if (/Tomás/.test(card.name) || /Tomás/.test(card.text)) {
                returned = card;
                await shoot('vuelve-tomas');
            }
            await answerSuceso();
        }
        await dropToasts();
        await carryOn('exploration');
    }
    now = await meta();
    check('J11.2: días después de lo del muelle, Tomás vuelve con ello, en una tarjeta con decisión',
        Boolean(returned) && /Un regalo de Tomás/.test(String(returned?.name)), JSON.stringify({ returned, cardsSeen, day: now.day, pending: now.pending }));

    // === 6. J11.3: robar en la tienda y que os pillen ===============================================
    await enterPlace('tienda');
    let shop = await placeScene();
    const buyBefore = shop.acts.find(a => a.id.startsWith('shop-buy:') && a.cost > 0);
    const steal = shop.acts.find(a => a.id.startsWith('shop-steal:'));
    const helloBefore = shop.line;
    await loadedDice('mal');
    await page.locator(`#game-shell .gs-town-scene .gs-town-act[data-action="${steal?.id ?? 'shop-steal:'}"]`).click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await clearDice();
    await loadedDice('');
    await dropToasts();
    await carryOn('exploration');
    await enterPlace('tienda');
    await until(async () => (await placeScene()).remembered, 8000);
    shop = await placeScene();
    const buyAfter = shop.acts.find(a => a.id === buyBefore?.id);
    now = await meta();
    await shoot('tienda-recuerda');
    check('J11.3: tras pillaros robando, la huella queda en Puerto Alba', now.marks.some((/** @type {any} */ m) => m.deed === 'robo' && m.place === 'tienda'), JSON.stringify(now.marks));
    check('J11.3: Marisa os saluda sabiendo lo que hicisteis, con su cara de enfadada',
        Boolean(steal) && shop.remembered && shop.line !== helloBefore && /enfadado/.test(shop.face) && shop.mood === 'enfadado',
        JSON.stringify({ before: helloBefore, after: shop.line, face: shop.face, mood: shop.mood }));
    check('J11.3: y en la tienda todo sale más caro', Boolean(buyBefore) && Boolean(buyAfter) && Number(buyAfter?.cost) > Number(buyBefore?.cost),
        JSON.stringify({ before: buyBefore, after: buyAfter }));
    await page.locator('#game-shell .gs-town-back').click({ timeout: 5000 }).catch(() => {});

    // === 7. J7.5: Strahd, y lo que opina Gerd junto a la opción =====================================
    await dropToasts();
    await until(async () => (await chips()).some(c => /Tablón de campañas/.test(c)), 8000);
    await clickChip(/Tablón de campañas/);
    await page.waitForSelector('.hb-root [data-campaign="strahd"]', { timeout: 15000 }).catch(() => {});
    await page.locator('.hb-root [data-campaign="strahd"]').click({ timeout: 5000 }).catch(() => {});
    const opening = await until(async () => (await story())?.id === 'sangrienta-bienvenida', 150000);
    /** @type {any} */
    let asked = null;
    const strahdFrames = await playScene(['a-mi-lado'], async (frame) => {
        asked = frame;
        await shoot('opiniones');
    });
    const liked = asked?.options.find((/** @type {any} */ o) => o.id === 'a-mi-lado');
    check('J7.5: en la primera escena de Strahd, junto a la opción, «A Gerd le gusta esto»',
        opening && Boolean(liked?.opinions.some((/** @type {any} */ b) => b.text === 'A Gerd le gusta esto' && b.mood === 'bien')),
        JSON.stringify(asked?.options ?? strahdFrames.map(f => f.id)));
    const said = strahdFrames.flatMap(f => f.notes);
    await page.waitForTimeout(1000);
    now = await meta();
    const gerdId = await page.evaluate(async () => String((await import('/scripts/party.js')).getPartyMembersSnapshot().find((/** @type {any} */ m) => m.name === 'Gerd el Mellado')?.id ?? ''));
    const approved = (now.approval?.log ?? []).filter((/** @type {any} */ a) => String(a.id) === gerdId && Number(a.mood) > 0);
    check('J7.5: al elegirla, la ventana lo dice («A Gerd le ha gustado.») y cuenta para su vínculo (una aprobación de Gerd)',
        said.includes('A Gerd le ha gustado.') && approved.length >= 1, JSON.stringify({ said, gerdId, approval: now.approval }));
    await playAllScenes();
    await clearDice();
    await dropToasts();

    // === 8. J9.3: el libro de Strahd, por su capítulo ================================================
    await openDiary();
    book = await readBook();
    await shoot('diario-strahd');
    check('J9.3: el libro de Strahd dice por qué capítulo vais, con su nombre',
        book.title === 'La Maldición de Strahd' && /Vais por el capítulo 1 de \d: La aldea de Barovia/.test(book.now), JSON.stringify({ title: book.title, now: book.now }));
    const welcome = book.entries.find(e => e.id === 'sangrienta-bienvenida');
    check('J9.6: en su página, lo que decidiste y lo que salió de ello, también lo que le pareció a Gerd',
        Boolean(welcome?.said.length) && Boolean(welcome?.came.includes('A Gerd le ha gustado.')), JSON.stringify(welcome));
    await closeBook();

    // === 9. J9.5: el plazo de lo que tenéis entre manos, en la cabecera =============================
    // Preparado a mano: Strahd no tiene plazos al empezar (1387 sí, en su segundo capítulo), así que
    // al hito que tenéis entre manos se le ponen dos días desde hoy. Lo que se mira es que la cabecera lo diga.
    // D-J46: los plazos están apagados por ahora. Primero se mira que la cabecera no diga nada; luego
    // se encienden solo para esta prueba, para ver que el día que Daniel los encienda se ven.
    const clockShown = await page.evaluate(async () => {
        const meta = window.SillyTavern.getContext().chatMetadata;
        const id = String(meta.plotState?.open?.[0] ?? '');
        const day = Math.max(1, Number((await import('/scripts/party/time.js')).campaignDay()) || 1);
        const found = (meta.plot?.milestones ?? []).find((/** @type {any} */ m) => m.id === id);
        // Dos días de plazo, abierto hoy: quedan dos.
        if (found) found.within = 2;
        meta.plotState = { ...meta.plotState, since: { ...(meta.plotState?.since ?? {}), [id]: day } };
        const shell = await import('/scripts/game-engine/ui/shell/game-shell.js');
        const switchOf = (await import('/scripts/game-engine/campaign/plot.js')).STORY_DEADLINES;
        const read = async () => {
            shell.refreshGameShell();
            await new Promise(resolve => setTimeout(resolve, 500));
            const badge = document.querySelector('#game-shell .gs-focus .lb-badge');
            return { text: (badge?.textContent || '').trim(), urgency: /** @type {HTMLElement|null} */ (badge)?.dataset.urgency ?? '' };
        };
        const off = await read();
        switchOf.on = true;
        const on = await read();
        switchOf.on = false;
        if (found) found.within = 0;
        await read();
        return { id, off, ...on };
    });
    check('D-J46: con los plazos apagados, la cabecera no dice ningún plazo', clockShown.off.text === '', JSON.stringify(clockShown));
    check('J9.5: encendidos, la cabecera dice cuánto queda de lo que tenéis entre manos', clockShown.text === 'Quedan 2 días', JSON.stringify(clockShown));
    await shoot('plazo');

    // === 10. J11.5 y J9.3: volver al gremio, y en el tablón su capítulo y su crónica =================
    await dropToasts();
    await until(async () => (await chips()).some(c => /Volver al gremio/.test(c)), 10000);
    await clickChip(/Volver al gremio/);
    const home = await until(async () => /Gremio/i.test((await meta()).world), 90000);
    await page.waitForTimeout(1500);
    await dropToasts();
    await carryOn('exploration');
    await until(async () => (await chips()).some(c => /Tablón de campañas/.test(c)), 10000);
    await clickChip(/Tablón de campañas/);
    await page.waitForSelector('.hb-root [data-campaign="strahd"]', { timeout: 15000 }).catch(() => {});
    const card = await page.evaluate(() => {
        const tile = document.querySelector('.hb-root [data-campaign-tile="strahd"]') ?? document.querySelector('.hb-root [data-campaign="strahd"]')?.closest('.vt-card, .hb-tile, div');
        return {
            chapter: (tile?.querySelector('.hb-chapter')?.textContent || '').trim(),
            chronicle: [...(tile?.querySelectorAll('button, [role="button"]') ?? [])].map(b => (b.textContent || '').trim()).filter(t => /crónica/i.test(t)),
        };
    });
    await shoot('tablon-capitulo');
    check('J9.3: de vuelta en el gremio, la tarjeta de Strahd dice por qué capítulo ibais',
        home && /^Capítulo 1 de \d+: La aldea de Barovia$/.test(card.chapter), JSON.stringify(card));
    await page.locator('.hb-root :is(button, [role="button"]):has-text("La crónica")').first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForSelector('dialog.lb-dialog[open]', { timeout: 8000 }).catch(() => {});
    book = await readBook();
    await shoot('cronica');
    check('J11.5: «La crónica» abre encima del tablón lo que decidisteis en Strahd',
        book.kicker === 'La crónica' && book.decided.some(d => /Sangrienta Bienvenida/.test(d.said)), JSON.stringify({ kicker: book.kicker, decided: book.decided }));
    await closeBook();

    // === 11. J11.4: terminar Strahd, y el gremio lo recuerda ========================================
    // Seguir la campaña desde el tablón, y ganarla con el mismo suceso que daría la cripta (como
    // e2e-gremio): lo que se mira es lo que pasa en el gremio después.
    await page.locator('.hb-root [data-campaign="strahd"]').click({ timeout: 5000 }).catch(() => {});
    await until(async () => /Strahd/.test((await meta()).world), 90000);
    await until(() => page.evaluate(() => {
        const m = window.SillyTavern.getContext().chatMetadata;
        return Boolean(m?.plotState) && Boolean(m?.plot) && /Strahd/.test(String(m?.world_info));
    }), 30000);
    await page.waitForTimeout(1000);
    await dropToasts();
    await page.evaluate(async () => {
        const m = window.SillyTavern.getContext().chatMetadata;
        const plot = m.plotState || { open: [], done: [] };
        m.plotState = { ...plot, open: [...new Set([...(plot.open || []), 'el-senor-de-barovia'])] };
        (await import('/scripts/party.js')).notePlot({ kind: 'win', place: 'Castillo Ravenloft', board: 'La Cripta de Strahd' });
    });
    await playAllScenes();
    const endShown = await page.waitForSelector('.popup:visible .end-root', { timeout: 20000 }).then(() => true).catch(() => false);
    const endingTitle = (await page.locator('.popup:visible .end-root h3').first().textContent({ timeout: 3000 }).catch(() => '') || '').replace(/^Final: /, '').trim();
    await dropToasts();
    await page.locator('.popup:visible .end-home').click({ timeout: 5000 }).catch(() => {});
    await until(async () => /Gremio/i.test((await meta()).world), 90000);
    const legacyTold = await until(async () => /Desde hoy, en Puerto Alba os conocen como quienes/.test((await chatTexts()).join('\n')), 15000);
    const texts = (await chatTexts()).join('\n');
    check('J11.4: la vuelta tras el final dice cómo os llaman desde hoy en Puerto Alba',
        endShown && legacyTold, JSON.stringify({ endingTitle, tail: texts.slice(-400) }));
    await dropToasts();
    await carryOn('exploration');
    await enterPlace('gremio');
    await until(async () => (await placeScene()).remembered, 8000);
    const hall = await placeScene();
    await shoot('brunilda-recuerda');
    check('J11.4: en el gremio, Brunilda os saluda sabiendo cómo acabó Strahd, con su cara',
        // D-J60: en la caja, solo lo que dice ella (sin «Brunilda deja lo que estaba haciendo…»).
        hall.remembered && hall.line.length > 10 && !/deja lo que estaba haciendo/.test(hall.line) && /brunilda/.test(hall.face),
        JSON.stringify(hall));

    // En la taberna se cuenta, y días después alguien viene a buscaros por ello.
    const legacies = await page.evaluate(async () => {
        const pack = await (await fetch('/mundos/strahd.pack.json')).json();
        return Object.values(pack.plot.endings).map((/** @type {any} */ e) => ({ title: e.title, rumor: String(e.legacy?.rumor ?? ''), visitor: String(e.legacy?.visitor?.name ?? '') }));
    });
    const reached = legacies.find(l => l.title === endingTitle);
    await enterPlace('posada');
    const rumorFrom = (await chatTexts()).length;
    await page.locator('#game-shell .gs-town-scene .gs-town-act[data-action="inn-rumor"]').click({ timeout: 5000 }).catch(() => {});
    const heardLegacy = await until(async () => (await chatTexts()).slice(rumorFrom).join('\n').includes(String(reached?.rumor).slice(0, 40)), 8000);
    check('J11.4: en la taberna del gremio se cuenta lo de Barovia', Boolean(reached?.rumor) && heardLegacy,
        JSON.stringify({ reached, told: (await chatTexts()).slice(rumorFrom).join('\n').slice(0, 300) }));
    await dropToasts();
    await carryOn('exploration');
    /** @type {any} */
    let visitor = null;
    for (let night = 0; night < 7 && !visitor; night++) {
        await enterPlace('posada');
        await page.locator('#game-shell .gs-town-scene .gs-town-act[data-action="inn-room"]').click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(1200);
        await clearNight();
        await page.waitForTimeout(800);
        await page.evaluate(() => document.querySelectorAll('.popup:not([closing]):not(:has(.su-root)) .popup-button-ok').forEach(b => /** @type {HTMLElement} */ (b).click()));
        for (let tries = 0; tries < 4; tries++) {
            const card = await until(async () => Boolean(await sucesoCard()), 3000) ? await sucesoCard() : null;
            if (!card) break;
            if (card.name === reached?.visitor) {
                visitor = card;
                await shoot('visita');
            }
            await answerSuceso();
        }
        await dropToasts();
        await carryOn('exploration');
    }
    check('J11.4: días después de volver, alguien viene al gremio por cómo acabó Strahd', Boolean(visitor), JSON.stringify({ visitor, expected: reached?.visitor }));

    // === 12. D-J47: a la segunda vez que os pillan robando, al calabozo; luego la tienda vende =======
    // Desde el robo del paso 6 ha pasado más de una semana (Strahd y las noches en la taberna): si
    // Marisa ya lo ha olvidado, la primera vez vuelve a ser la primera y hace falta otra.
    /** @type {any[]} */
    let jailFrames = [];
    let stealAgain = null;
    for (let tries = 0; tries < 2 && jailFrames.length === 0; tries++) {
        await enterPlace('tienda');
        stealAgain = (await placeScene()).acts.find(a => a.id.startsWith('shop-steal:') && a.enabled) ?? null;
        await loadedDice('mal');
        await page.locator(`#game-shell .gs-town-scene .gs-town-act[data-action="${stealAgain?.id ?? 'shop-steal:'}"]`).click({ timeout: 5000 }).catch(() => {});
        if (await until(async () => (await story())?.id === 'calabozo', 6000)) {
            await shoot('calabozo');
            jailFrames = await playScene();
        }
        await clearDice();
        await loadedDice('');
        await dropToasts();
        await carryOn('exploration');
    }
    check('D-J47: a la segunda vez que os pillan robando, la guardia os lleva al calabozo (una escena corta)',
        Boolean(stealAgain) && jailFrames.length >= 5 && jailFrames.some(f => /¡Al ladrón!/.test(f.text)) && jailFrames.some(f => /calabozo/.test(f.text)),
        JSON.stringify(jailFrames.map(f => `${f.plate}: ${f.text}`).slice(0, 6)));
    await enterPlace('tienda');
    await until(async () => (await placeScene()).remembered, 8000);
    const again = await placeScene();
    const buys = again.acts.filter(a => /^shop-buy:/.test(a.id));
    await shoot('tienda-vende-mas-caro');
    check('D-J47: al salir, Marisa os vuelve a vender (ya no cierra cuatro semanas), enfadada y más caro',
        buys.some(a => a.enabled) && !again.acts.some(a => /Dos veces/.test(a.detail)) && again.remembered && again.line !== shop.line
        && again.mood === 'enfadado' && buys.some(a => /\+30 %/.test(a.detail)),
        JSON.stringify({ line: again.line, mood: again.mood, acts: buys.slice(0, 2) }));

    console.log('\n--- problemas ---');
    console.log(problems.length ? problems.join('\n') : '(ninguno)');
    check('sin errores en la página', problems.filter(p => /PAGEERROR/.test(p)).length === 0, problems.slice(0, 6).join('\n        '));
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
console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
