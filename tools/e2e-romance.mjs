#!/usr/bin/env node
/**
 * J14.10 en el navegador: un romance entero, sin conexión y desde la portada, con el ratón.
 * Contra un servidor propio con un `--dataRoot` temporal, como `e2e-companeros.mjs`:
 *
 *   título → Jugar sin conexión → Iria (mujer) → saltar la prueba → contratar a Nella y a Gerd →
 *   «Romance: Sí» en las opciones → con Gerd en vínculo 4, quedar: la respuesta con corazón, y
 *   su «no» (su ficha no lo permite) → con Nella en vínculo 4: la señal, y empezáis → tres citas,
 *   cada una una quedada, desde el pueblo («quiere quedar contigo») → la noche, que funde a negro
 *   → sois pareja: «♥ Pareja» en su ficha, una frase suya en el siguiente rato, y la pareja en el
 *   Salón de la fama → con «Romance: No», nada de eso se ve → a 1387 con el grupo y, al acabar
 *   la campaña, la línea de la pareja en «Qué fue de cada uno».
 *
 * Lo único que se prepara a mano es lo que costaría horas de juego: el oro, el vínculo 4 de
 * Nella y de Gerd (y sus escenas de vínculo ya vistas), y que 1387 ha llegado a su final.
 *
 * Uso:
 *   node tools/e2e-romance.mjs --port 8431 --captura C:/tmp/romance.png
 *   (las capturas salen como romance.png.senal.png, romance.png.fundido.png…)
 *   node tools/e2e-romance.mjs --port 8431 --log C:/tmp/romance.log   # y lo que dice el servidor
 */

/* global window, document, HTMLElement */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createWriteStream, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8431;
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

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-romance-'));
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
            const said = String(buffer);
            if (said.includes(String(PORT)) || said.toLowerCase().includes('listening')) {
                clearTimeout(timer);
                setTimeout(() => resolve(child), 1500);
            }
        };
        child.stdout.on('data', watch);
        child.stderr.on('data', watch);
        if (argAfter('--log')) {
            const out = createWriteStream(argAfter('--log'));
            child.stdout.pipe(out);
            child.stderr.pipe(out);
        }
        child.on('exit', (/** @type {number} */ code) => reject(new Error(`the server exited with code ${code}`)));
    });
}

/**
 * @param {any} target
 * @param {string} pick
 * @param {string} wanted
 */
async function pickHeroCard(target, pick, wanted) {
    await target.locator(`.hc-root .hc-card[data-pick="${pick}"] .hc-pick`).click();
    await target.waitForSelector('.hc-picker .hc-option', { timeout: 15000 });
    const plain = (/** @type {string} */ v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const values = await target.evaluate(() => [...document.querySelectorAll('.hc-picker .hc-option')].map(o => o.getAttribute('data-value') || ''));
    const chosen = values.find(v => plain(v).includes(plain(wanted))) ?? values[0];
    await target.locator(`.hc-picker .hc-option[data-value="${chosen}"]`).first().click();
    await target.waitForSelector('.hc-picker', { state: 'detached', timeout: 15000 }).catch(() => {});
    await target.waitForTimeout(200);
}

const NELLA = 'Nella Tresflechas';
const GERD = 'Gerd el Mellado';

try {
    // `--externo`: contra un servidor que ya está en marcha en ese puerto (para depurar).
    if (!process.argv.includes('--externo')) await startServer();
    browser = await chromium.launch({ channel: 'msedge', headless: !HEADED }).catch(() => chromium.launch({ headless: !HEADED }));
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
            window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,combat,travel,prisoners,mesa,high,spell,pet,bill,move,attack,roll,talk,journal,town,rest,board');
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
            // Aquí se juega el romance: sin sucesos ni ventanas de la historia que tapen los clics.
            window.localStorage.setItem('sillytavern_gameSucesos', 'off');
            window.localStorage.setItem('sillytavern_gameStoryWindows', 'off');
        } catch { /* nada */ }
    });

    const shot = async (/** @type {string} */ what) => { if (SHOT) await page.screenshot({ path: `${SHOT}.${what}.png` }); };
    const state = () => page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const party = (await import('/scripts/party.js')).getPartyMembersSnapshot();
        const meta = ctx.chatMetadata ?? {};
        return {
            world: String(meta.world_info ?? ''),
            board: String(meta.currentBoard ?? ''),
            day: Number(meta.calendar?.day) || 0,
            slot: Number(meta.calendar?.slotIndex) || 0,
            party: party.map((/** @type {any} */ m) => ({ id: String(m.id), name: String(m.name), dead: Boolean(m.dead) })),
            romances: JSON.parse(JSON.stringify(meta.romances ?? null)),
        };
    });
    const until = async (/** @type {() => Promise<boolean>} */ test, ms = 30000) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (await test().catch(() => false)) return true;
            await page.waitForTimeout(300);
        }
        return false;
    };
    const clickChip = (/** @type {RegExp} */ pattern) => page.evaluate((source) => {
        const chip = [...document.querySelectorAll('#game-shell .gs-chip-action')].find(b => new RegExp(source).test(b.textContent || ''));
        if (chip instanceof HTMLElement) chip.click();
        return Boolean(chip);
    }, pattern.source);
    const chatHas = (/** @type {RegExp} */ pattern) => page.evaluate((source) => (window.SillyTavern.getContext().chat || [])
        .some((/** @type {any} */ m) => new RegExp(source).test(String(m.extra?.display_text || m.mes || ''))), pattern.source);
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
    /** Pulsar un botón de la fila; si aún no está, «Continuar» en la caja hasta que salga. */
    const chipOrContinue = (/** @type {RegExp} */ pattern, ms = 30000) => until(async () => {
        if (await clickChip(pattern)) return true;
        await page.evaluate(() => {
            const next = /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .gs-vn-box .gs-chip-continue'));
            if (next && next.offsetParent !== null) next.click();
        });
        return false;
    }, ms);
    const clearDice = async () => {
        for (let i = 0; i < 30; i++) {
            const next = page.locator('.wm-dice-overlay.active .wm-dice-next');
            if (await next.count() === 0) break;
            if (!(await next.click({ timeout: 1500 }).then(() => true).catch(() => false))) break;
            await page.waitForTimeout(150);
        }
    };
    /** Lo que haya abierto encima (un aviso), fuera. */
    const clearPopups = async () => {
        await clearDice();
        for (let i = 0; i < 6; i++) {
            const open = await page.evaluate(() => {
                const ok = /** @type {HTMLElement|null} */ (document.querySelector('.popup:not([closing]) .popup-button-ok'));
                if (ok && ok.offsetParent) {
                    ok.click();
                    return true;
                }
                return false;
            });
            if (!open) return;
            await page.waitForTimeout(400);
        }
    };
    /** La escena abierta (`ui/meetup-scene.js`). */
    const meetup = () => page.evaluate(() => {
        const dialog = document.querySelector('.qd-dialog[open]');
        const root = dialog?.querySelector('.qd-root');
        return {
            open: Boolean(dialog),
            id: root?.getAttribute('data-scene') ?? '',
            fade: Boolean(root?.classList.contains('qd-fade')),
            plate: (dialog?.querySelector('.qd-nameplate')?.textContent ?? '').trim(),
            title: (dialog?.querySelector('.qd-title')?.textContent ?? '').trim(),
            lines: [...(dialog?.querySelectorAll('.qd-line') ?? [])].map(l => (l.textContent ?? '').trim()),
            // D-J54: lo del narrador (sin placa, en cursiva) y lo que dice quien está contigo.
            // D-J60: ya no en la caja, sino en el aviso de fuera de ella.
            notes: [...(dialog?.querySelectorAll('.qd-line.qd-note, .qd-aside .vn-aside-note') ?? [])].map(l => (l.textContent ?? '').trim()),
            says: [...(dialog?.querySelectorAll('.qd-line.qd-say, .qd-line.qd-then') ?? [])].map(l => (l.textContent ?? '').trim()),
            // Solo el texto de la respuesta: delante va la tecla («1»).
            love: [...(dialog?.querySelectorAll('.qd-chip-love') ?? [])].map(c => (c.querySelector('.qd-label')?.textContent ?? c.textContent ?? '').trim()),
            chips: [...(dialog?.querySelectorAll('.qd-chip') ?? [])].map(c => (c.textContent ?? '').trim()),
        };
    });
    /**
     * Jugar la escena abierta: en cada paso, la respuesta con corazón si la hay (y si `heart`), o
     * la primera. Devuelve lo leído, lo que queda al acabar y si se fundió a negro.
     *
     * @param {{heart?: boolean, onLove?: (now: any) => Promise<void>, onFade?: (now: any) => Promise<void>}} [how]
     */
    const play = async ({ heart = true, onLove, onFade } = {}) => {
        /** @type {{read: string[], notes: string[], says: string[], summary: string[], loves: string[], fade: boolean, id: string, title: string}} */
        const out = { read: [], notes: [], says: [], summary: [], loves: [], fade: false, id: '', title: '' };
        for (let i = 0; i < 24; i++) {
            const now = await meetup();
            if (!now.open) break;
            out.id = out.id || now.id;
            out.title = out.title || now.title;
            out.read.push(...now.lines);
            out.notes.push(...now.notes);
            out.says.push(...now.says);
            if (now.love.length > 0) {
                out.loves.push(...now.love);
                if (onLove) await onLove(now);
            }
            if (now.fade && !out.fade) {
                out.fade = true;
                if (onFade) await onFade(now);
            }
            const summary = await page.evaluate(() => [...document.querySelectorAll('.qd-dialog[open] .qd-summary, .qd-dialog[open] .vn-aside-summary')].map(l => (l.textContent ?? '').trim()));
            if (summary.length > 0) out.summary = summary;
            if (heart && await page.locator('.qd-dialog[open] .qd-chip-love').count() > 0) await page.locator('.qd-dialog[open] .qd-chip-love').first().click();
            else if (await page.locator('.qd-dialog[open] .qd-chip-reply:not(.qd-chip-love)').count() > 0) await page.locator('.qd-dialog[open] .qd-chip-reply:not(.qd-chip-love)').first().click();
            else await page.locator('.qd-dialog[open] .qd-chip').first().click();
            await page.waitForTimeout(300);
            // Lo último que se lee (la respuesta del corazón, el fundido) también cuenta.
            const after = await meetup();
            if (after.open) {
                out.read.push(...after.lines);
                out.notes.push(...after.notes);
                out.says.push(...after.says);
                if (after.fade && !out.fade) {
                    out.fade = true;
                    if (onFade) await onFade(after);
                }
            }
        }
        out.read = [...new Set(out.read)];
        out.notes = [...new Set(out.notes)];
        out.says = [...new Set(out.says)];
        return out;
    };
    /** La ficha de un compañero, desde su cara en la tira del grupo. */
    const openCard = async (/** @type {string} */ name) => {
        await page.evaluate(() => document.querySelectorAll('.cc-overlay').forEach(o => o.remove()));
        // La tira del grupo va en cada escena (la del diálogo, escondida en el pueblo): la que se ve.
        await page.locator(`#game-shell .gs-chip-clickable[title="Abrir la ficha de ${name}"]:visible`).first().click({ timeout: 5000 }).catch(() => {});
        return page.waitForSelector('.cc-card', { timeout: 6000 }).then(() => true).catch(() => false);
    };
    const cardText = () => page.evaluate(() => ({
        rank: (document.querySelector('.cc-card .cc-rank')?.textContent ?? '').trim(),
        romance: (document.querySelector('.cc-card .cc-romance')?.textContent ?? '').trim(),
    }));
    /** Quedar con alguien pulsando «Pasar tiempo» en su ficha (en un pueblo, es quedar). */
    const meetFromCard = async (/** @type {string} */ name) => {
        await clearPopups();
        await dropToasts();
        await carryOn('exploration');
        if (!(await openCard(name))) {
            await shot(`sin-ficha-${name.split(' ')[0]}`);
            return false;
        }
        await page.locator('.cc-card .cc-btn', { hasText: 'Pasar tiempo' }).click({ timeout: 5000 }).catch(() => {});
        const opened = await page.waitForSelector('.qd-dialog[open] .qd-chip', { timeout: 15000 }).then(() => true).catch(() => false);
        if (!opened) await shot(`sin-quedada-${name.split(' ')[0]}`);
        return opened;
    };
    /** Dónde anda alguien de tu gente ahora, y si quiere quedar contigo (lo que pinta el pueblo). */
    const whereIs = (/** @type {string} */ name) => page.evaluate(async (who) => {
        const social = await import('/scripts/party/social.js');
        const person = social.townPeople().find((/** @type {any} */ p) => p.name === who);
        return person ? { place: String(person.place), wants: Boolean(person.wantsToMeet), why: String(person.why || ''), canMeet: Boolean(person.canMeet) } : null;
    }, name);
    /** Quedar desde la pantalla del pueblo: entrar en el sitio donde está y «Quedar con …». */
    const meetFromTown = async (/** @type {string} */ name, /** @type {string} */ key) => {
        await clearPopups();
        await dropToasts();
        await carryOn('exploration');
        const where = await whereIs(name);
        if (!where?.canMeet) return { opened: false, where, heart: false };
        const inside = await page.evaluate(() => document.querySelector('#game-shell .gs-town-scene')?.getAttribute('data-place') ?? null);
        if (inside !== null && inside !== where.place) {
            await page.locator(`#game-shell .gs-town-tab[data-place="${where.place}"]`).click({ timeout: 5000 }).catch(() => {});
        } else if (inside === null) {
            await page.locator(`#game-shell .gs-town-place[data-place="${where.place}"]`).click({ timeout: 5000 }).catch(() => {});
        }
        await page.waitForTimeout(600);
        const act = page.locator(`#game-shell .gs-town-scene .gs-town-act[data-action="quedar:${key}"]`);
        if (await act.count() === 0) {
            // Sin tarjeta de sitio (el muelle): desde «Por el pueblo».
            await page.locator('#game-shell .gs-town-back').click({ timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(400);
            const loose = page.locator(`#game-shell .gs-town-loose [data-chip="quedar:${key}"]`);
            const heart = await loose.locator('.fa-heart').count() > 0;
            await loose.first().click({ timeout: 5000 }).catch(() => {});
            const opened = await page.waitForSelector('.qd-dialog[open] .qd-chip', { timeout: 15000 }).then(() => true).catch(() => false);
            return { opened, where, heart };
        }
        const heart = await act.locator('.fa-heart').count() > 0;
        await act.first().click({ timeout: 5000 }).catch(() => {});
        const opened = await page.waitForSelector('.qd-dialog[open] .qd-chip', { timeout: 15000 }).then(() => true).catch(() => false);
        return { opened, where, heart };
    };
    const romanceOf = async (/** @type {string} */ key) => (await state()).romances?.people?.[key] ?? null;
    const pauseItem = async (/** @type {string} */ label) => {
        // Un aviso (los del vínculo preparado) tapa la pausa: fuera.
        await dropToasts();
        await page.locator('#game-shell .gs-pause-open').click({ timeout: 5000 }).catch(() => {});
        await page.waitForSelector('#game-shell .gs-pause .gs-pause-btn', { timeout: 8000 }).catch(() => {});
        await dropToasts();
        const items = await page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-pause .gs-pause-btn')].map(l => (l.textContent || '').replace(/\s+/g, ' ').trim()));
        await page.locator('#game-shell .gs-pause .gs-pause-btn').filter({ hasText: label }).first().click({ timeout: 5000 }).catch(() => {});
        return items;
    };
    const closePopup = async () => {
        await page.locator('.popup[open]:not([closing]) .popup-button-ok:visible').last().click({ timeout: 5000 }).catch(() => {});
        await until(() => page.evaluate(() => document.querySelectorAll('.popup[open]:not([closing])').length === 0), 6000);
        // La pausa, si quedó abierta debajo: «Continuar».
        await page.locator('#game-shell .gs-pause .gs-pause-btn').filter({ hasText: 'Continuar' }).first().click({ timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(300);
    };
    /** La opción «Romance» de la ventana de opciones: cómo está, y pulsarla si se pide. */
    const romanceOption = async (/** @type {boolean} */ toggle) => {
        await pauseItem('Opciones');
        await page.waitForSelector('.go-root .go-row[data-option="romance"]', { timeout: 25000 }).catch(() => {});
        const before = (await page.locator('.go-root .go-row[data-option="romance"] .go-value').textContent({ timeout: 3000 }).catch(() => '')) ?? '';
        if (toggle) await page.locator('.go-root .go-row[data-option="romance"]').click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(300);
        const after = (await page.locator('.go-root .go-row[data-option="romance"] .go-value').textContent({ timeout: 3000 }).catch(() => '')) ?? '';
        const rows = await page.evaluate(() => [...document.querySelectorAll('.go-root .go-row')].map(r => r.getAttribute('data-option')));
        return { before: before.trim(), after: after.trim(), rows };
    };
    /** El pueblo, y dentro de un sitio. */
    const enterPlace = async (/** @type {string} */ id) => {
        await carryOn('exploration');
        const inside = await page.evaluate(() => document.querySelector('#game-shell .gs-town-scene')?.getAttribute('data-place') ?? null);
        if (inside === id) return;
        if (inside !== null) {
            await page.locator(`#game-shell .gs-town-tab[data-place="${id}"]`).click({ timeout: 5000 }).catch(() => {});
        } else {
            await until(async () => await page.locator(`#game-shell .gs-town-place[data-place="${id}"]`).count() > 0, 10000);
            await page.locator(`#game-shell .gs-town-place[data-place="${id}"]`).click({ timeout: 5000 }).catch(() => {});
        }
        await until(async () => await page.evaluate(() => document.querySelector('#game-shell .gs-town-scene')?.getAttribute('data-place') ?? '') === id, 8000);
    };
    /** El Salón de la fama, en la sala del gremio («La memoria del gremio»): sus cabeceras y sus filas. */
    const hallOfFame = async () => {
        await enterPlace('gremio');
        const items = await page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-town-scene .gs-town-act')].map(b => b.getAttribute('data-action')));
        await page.locator('#game-shell .gs-town-scene .gs-town-act[data-action="hub-hall"]').click({ timeout: 5000 }).catch(() => {});
        await page.waitForSelector('.hall-root', { timeout: 6000 }).catch(() => {});
        const hall = await page.evaluate(() => ({
            heads: [...document.querySelectorAll('.hall-root .hall-head')].map(h => (h.textContent ?? '').trim()),
            couples: [...document.querySelectorAll('.hall-root .hall-couple')].map(h => (h.textContent ?? '').trim()),
        }));
        return { items, ...hall };
    };

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    const firstRun = page.locator('text=Welcome to SillyTavern!');
    if (await firstRun.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#game-shell', { timeout: 90000 });

    // 1. Jugar sin conexión, con Iria (mujer), y saltar la prueba.
    const offline = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Jugar sin conexión' });
    await until(async () => await offline.count() === 1, 30000);
    await offline.click();
    await page.waitForSelector('.hc-root', { timeout: 120000 });
    await page.fill('.hc-root .hc-name', 'Iria');
    await page.locator('.hc-root .hc-gender[data-value="Mujer"]').click({ timeout: 5000 }).catch(() => {});
    await pickHeroCard(page, 'race', 'Humano');
    await pickHeroCard(page, 'class', 'Guerrero');
    await page.locator('.hc-root .hc-enter').click();
    await until(async () => /Gremio/.test((await state()).world), 60000);
    await until(() => chatHas(/Al ladrón/), 20000);
    await page.waitForTimeout(800);
    // «Saltar la prueba», en la fila de botones. Si el prólogo ya está en su pelea (la caja no lo
    // lleva), lo mismo que hace el botón: aquí solo se prepara el gremio.
    const skipChip = await until(() => clickChip(/^Saltar la prueba$/), 8000);
    if (!skipChip) {
        console.log('(la prueba, saltada sin su botón: la caja del prólogo no lo lleva)');
        await page.evaluate(async () => { void (await import('/scripts/party/hub.js')).skipHubTrial(); });
    }
    await page.waitForSelector('.popup:has-text("¿Saltar la prueba?")', { timeout: 10000 }).catch(() => {});
    await page.locator('.popup-button-ok:visible').first().click({ timeout: 5000 }).catch(() => {});
    await until(() => chatHas(/apunta tu nombre en el libro del gremio|moja la pluma/), 15000);
    await page.waitForTimeout(800);
    await clearDice();
    await dropToasts();

    // 2. Oro para contratar (lo que se gana con encargos), y a Nella y a Gerd con sus botones.
    await page.evaluate(async () => {
        const { partyMembers } = await import('/scripts/party/state.js');
        partyMembers[0].gold = 400;
        (await import('/scripts/party/roster.js')).savePartyState();
    });
    for (const name of [NELLA, GERD]) {
        await chipOrContinue(/Contratar mercenarios/);
        await page.waitForSelector(`.hb-root [data-hireling="${name}"]`, { timeout: 15000 }).catch(() => {});
        await page.locator(`.hb-root [data-hireling="${name}"]`).click({ timeout: 5000 }).catch(() => {});
        await until(async () => (await state()).party.some(m => m.name === name), 10000);
        await clearPopups();
        await dropToasts();
    }
    let now = await state();
    if (![NELLA, GERD].every(n => now.party.some(m => m.name === n))) await shot('sin-contratar');
    check('Iria contrata a Nella y a Gerd con sus botones', [NELLA, GERD].every(n => now.party.some(m => m.name === n)), JSON.stringify(now.party));
    await page.locator('dialog[open]:not([closing]) .hb-close:visible').last().click({ timeout: 2000 }).catch(() => {});

    // 3. Lo que costaría horas de juego: Nella y Gerd en vínculo 4, con sus escenas de vínculo vistas.
    const prepared = await page.evaluate(async ([nella, gerd]) => {
        const party = (await import('/scripts/party.js')).getPartyMembersSnapshot();
        const time = await import('/scripts/party/time.js');
        const { getBondProgress } = await import('/scripts/game-engine/campaign/bonds.js');
        const social = await import('/scripts/party/social.js');
        const { SOCIAL_KEY, readSocial, keyOf } = await import('/scripts/game-engine/campaign/social.js');
        const st = await import('/script.js');
        /** @type {Record<string, number>} */
        const ranks = {};
        for (const name of [nella, gerd]) {
            const member = party.find((/** @type {any} */ m) => m.name === name);
            for (let i = 0; i < 120 && getBondProgress(time.getCampaignBonds(), String(member?.id)).rank < 4; i++) time.recordCampaignBondEvent(String(member?.id), 'confidant_scene');
            ranks[name] = getBondProgress(time.getCampaignBonds(), String(member?.id)).rank;
        }
        const data = social.meetupData();
        const s = readSocial(st.chat_metadata[SOCIAL_KEY]);
        for (const name of [nella, gerd]) {
            const key = keyOf(name);
            s.seen[key] = [...new Set([...(s.seen[key] ?? []), ...data.scenes.filter((/** @type {any} */ x) => x.key === key).map((/** @type {any} */ x) => x.id)])];
        }
        st.chat_metadata[SOCIAL_KEY] = s;
        await st.saveMetadata();
        return ranks;
    }, [NELLA, GERD]);
    check('preparado: Nella y Gerd en vínculo 4 (lo que llevaría muchas quedadas)', prepared[NELLA] >= 4 && prepared[GERD] >= 4, JSON.stringify(prepared));

    // 4. «Romance» en las opciones del juego, encendido de salida.
    const option = await romanceOption(false);
    await shot('opciones');
    check('J14.10 (1): «Romance» está en las opciones del juego, encendido de salida (detrás de los sucesos)',
        option.before === 'Sí' && option.rows.indexOf('romance') === option.rows.indexOf('sucesos') + 1, JSON.stringify(option));
    await closePopup();

    // 5. Gerd: su ficha no lo permite. La pregunta sale (con corazón), y contesta su «no».
    const gerdOpen = await meetFromCard(GERD);
    let loveShot = false;
    const gerdScene = await play({
        onLove: async () => {
            if (!loveShot) await shot('gerd-pregunta');
            loveShot = true;
        },
    });
    check('J14.10 (3): con Gerd en vínculo 4, la quedada trae la respuesta con corazón',
        gerdOpen && gerdScene.loves.length === 1 && /^♥/.test(gerdScene.loves[0]), JSON.stringify({ gerdOpen, loves: gerdScene.loves, id: gerdScene.id }));
    check('J14.10 (2) y (3): Gerd contesta según su ficha (con nadie): su «no», con cariño, y concordando con Iria',
        gerdScene.read.some(l => /chavala.*una hermana pequeña/.test(l)) && !gerdScene.read.some(l => /[{}|]/.test(l))
        && gerdScene.summary.some(l => /Gerd te ha dicho que no, con cariño/.test(l)) && (await romanceOf('gerd-el-mellado'))?.status === 'no',
        JSON.stringify({ read: gerdScene.read.slice(-3), summary: gerdScene.summary }));
    await clearPopups();
    await dropToasts();

    // 6. Nella: la señal, desde su ficha. «La última flecha», y el corazón al final.
    const nellaOpen = await meetFromCard(NELLA);
    loveShot = false;
    const signal = await play({
        onLove: async () => {
            if (!loveShot) await shot('senal');
            loveShot = true;
        },
    });
    let nella = await romanceOf('nella-tresflechas');
    check('J14.10 (3): con Nella en vínculo 4, la señal: su escena escrita, y una respuesta con corazón',
        nellaOpen && /La última flecha/.test(signal.title) && signal.loves.length === 1 && /Le coges la mano/.test(signal.loves[0]), JSON.stringify({ title: signal.title, loves: signal.loves }));
    check('J14.10 (3): la elige Iria, y empiezan: Nella contesta lo suyo y lo dice el resumen',
        signal.read.some(l => /se acabaron las excusas/.test(l)) && signal.summary.some(l => /Nella y tú empezáis algo/.test(l)) && nella?.status === 'citas' && nella?.step === 0,
        JSON.stringify({ summary: signal.summary, nella }));
    await clearPopups();
    await dropToasts();

    // 7. Tres citas, cada una una quedada. La primera, desde el pueblo: «quiere quedar contigo».
    /** @type {any[]} */
    const dates = [];
    for (let step = 1; step <= 3; step++) {
        const where = await whereIs(NELLA);
        const fromTown = step === 1 ? await meetFromTown(NELLA, 'nella-tresflechas') : null;
        const opened = fromTown ? fromTown.opened : await meetFromCard(NELLA);
        if (step === 1) await shot('cita-1');
        const date = await play();
        nella = await romanceOf('nella-tresflechas');
        dates.push({ step, opened, where, fromTown, title: date.title, loves: date.loves.length, summary: date.summary, nella, notes: date.notes, says: date.says.length });
        if (step === 1) {
            check('J14.10 (4): la primera cita, desde el pueblo: en su sitio, Nella «quiere quedar contigo» (el corazón) porque tiene una cita',
                Boolean(fromTown?.opened) && Boolean(fromTown?.heart) && /te espera para vuestra cita/.test(where?.why ?? ''), JSON.stringify({ where, fromTown }));
        }
        await clearPopups();
        await dropToasts();
    }
    check('J14.10 (4): tres citas escritas, una por quedada, que solo avanzan con el corazón',
        dates.map(d => d.title.split(' · ')[0]).join('|') === 'La mesa del rincón|El tejado del almacén|La feria'
        && dates.every((d, i) => d.loves === 1 && d.nella?.step === i + 1)
        && /van 1 de 3/.test(dates[0].summary.join(' ')) && /La próxima vez que quedéis de noche/.test(dates[2].summary.join(' ')),
        JSON.stringify(dates.map(d => ({ t: d.title, l: d.loves, s: d.nella?.step, sum: d.summary.slice(-1) }))));
    check('D-J54: la señal y las citas son conversaciones: Nella habla en cada paso, y el narrador dice como mucho una línea corta por escena',
        [{ notes: signal.notes, says: signal.says.length }, ...dates].every(d => d.notes.length <= 1 && d.notes.every((/** @type {string} */ n) => n.length <= 110) && d.says >= 3),
        JSON.stringify([{ notes: signal.notes, says: signal.says.length }, ...dates.map(d => ({ notes: d.notes, says: d.says }))]));

    // 8. La noche: hasta que caiga, ratos de siempre; de noche, «quiere verte esta noche» y su escena.
    /** @type {any} */
    let night = null;
    /** @type {string[]} */
    const waited = [];
    for (let i = 0; i < 4 && !night; i++) {
        const where = await whereIs(NELLA);
        const opened = await meetFromCard(NELLA);
        const first = await meetup();
        if (/La ventana que da al mar/.test(first.title)) {
            night = await play({ onFade: async () => { await page.waitForTimeout(2600); await shot('fundido'); } });
            night.why = where?.why ?? '';
        } else {
            waited.push(`${first.title} (${where?.why || 'sin aviso'})`);
            await play({ heart: false });
        }
        if (!opened) break;
        await clearPopups();
        await dropToasts();
    }
    nella = await romanceOf('nella-tresflechas');
    check('J14.10 (4): la noche llega de noche («quiere verte esta noche»), y antes solo hay ratos de siempre',
        Boolean(night) && /quiere verte esta noche/.test(night?.why ?? '') && waited.every(w => !/La ventana/.test(w)), JSON.stringify({ waited, why: night?.why }));
    check('J14.10 (4): «Te quedas», con corazón, funde a negro: nada explícito, el mar y la vela, y lo dice Nella',
        Boolean(night?.fade) && night.says.some((/** @type {string} */ l) => /¿Oyes el mar\? Ya no hace falta la vela/.test(l)) && night.notes.length <= 1,
        JSON.stringify({ fade: night?.fade, last: night?.read.slice(-2), notes: night?.notes }));
    check('J14.10 (4): y desde ahí, pareja: lo dice el resumen y queda guardado',
        night?.summary.some((/** @type {string} */ l) => /Nella Tresflechas y tú sois pareja/.test(l)) && nella?.status === 'pareja', JSON.stringify({ summary: night?.summary, nella }));
    await clearPopups();
    await dropToasts();

    // 9. El vínculo lo dice: «♥ Pareja» en su ficha, y en «El grupo».
    await carryOn('exploration');
    await openCard(NELLA);
    const card = await cardText();
    await shot('ficha-pareja');
    await page.evaluate(() => document.querySelectorAll('.cc-overlay').forEach(o => o.remove()));
    check('J14.10 (4): la ficha de Nella dice «♥ Pareja» junto a su vínculo', /^♥ Pareja$/.test(card.romance) && /Rango|Vínculo/.test(card.rank), JSON.stringify(card));

    // 10. El siguiente rato con Nella lleva una frase suya de pareja.
    await meetFromCard(NELLA);
    const rato = await play({ heart: false });
    // D-J54: la frase de pareja la dice ella (con su placa), no el narrador.
    const coupleLine = rato.says.some(l => /Te he guardado sitio|cinta roja del carcaj|un beso rápido, ahora que no mira nadie/.test(l));
    check('J14.10 (4): sus frases lo mencionan: en un rato juntos, Nella te dice una de sus frases de pareja', coupleLine, JSON.stringify({ says: rato.says.slice(0, 2), notes: rato.notes }));
    await clearPopups();
    await dropToasts();

    // 11. El Salón de la fama: «Parejas», con su línea.
    await carryOn('exploration');
    const hall = await hallOfFame();
    await shot('salon');
    check('J14.10 (5): en el Salón de la fama del gremio, la pareja con su línea, concordando con las dos',
        hall.heads.includes('Parejas') && hall.couples.some(l => /^♥ Iria y Nella Tresflechas, juntas desde el día \d+\. .*es de las dos\./.test(l)), JSON.stringify(hall));
    await closePopup();

    // 12. Con «Romance: No», no se ve nada de esto; y se vuelve a encender.
    const off = await romanceOption(true);
    await closePopup();
    await openCard(NELLA);
    const cardOff = await cardText();
    await page.evaluate(() => document.querySelectorAll('.cc-overlay').forEach(o => o.remove()));
    const hallOff = await hallOfFame();
    await closePopup();
    const offState = await page.evaluate(async () => {
        const romance = await import('/scripts/party/romance.js');
        return { label: romance.romanceLabelFor('Nella Tresflechas'), partners: romance.partnerNames() };
    });
    check('J14.10 (1): con «Romance: No», ni «♥ Pareja» en la ficha, ni parejas en el salón (lo vivido se guarda igual)',
        off.before === 'Sí' && off.after === 'No' && cardOff.romance === '' && !hallOff.heads.includes('Parejas') && hallOff.couples.length === 0
        && offState.label === '' && offState.partners.length === 0 && (await romanceOf('nella-tresflechas'))?.status === 'pareja',
        JSON.stringify({ off, cardOff, hallOff, offState }));
    const on = await romanceOption(true);
    await closePopup();
    check('y se vuelve a encender', on.after === 'Sí', JSON.stringify(on));

    // 13. A 1387 con el grupo; al acabar la campaña, la línea de la pareja en «Qué fue de cada uno».
    await clearPopups();
    await dropToasts();
    await carryOn('exploration');
    await clickChip(/Tablón de campañas/);
    await page.waitForSelector('.hb-root [data-campaign="1387"]', { timeout: 15000 }).catch(() => {});
    await page.locator('.hb-root [data-campaign="1387"]').click({ timeout: 5000 }).catch(() => {});
    const in1387 = await until(async () => /1387/.test((await state()).world), 150000);
    await until(async () => (await state()).party.some(m => m.name === NELLA), 20000);
    await page.waitForTimeout(2500);
    await clearPopups();
    await dropToasts();
    now = await state();
    check('a 1387 con el grupo, y el romance viaja con él', in1387 && now.party.some(m => m.name === NELLA) && now.romances?.people?.['nella-tresflechas']?.status === 'pareja',
        JSON.stringify({ world: now.world, party: now.party.map(m => m.name), romances: now.romances }));
    // Lo que en una partida cuesta la campaña entera: que ha llegado a su final.
    await page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        ctx.chatMetadata.plotEnding = Object.keys(ctx.chatMetadata.plot?.endings ?? {})[0] || 'fin';
        await ctx.saveMetadata();
        (await import('/scripts/game-engine/ui/shell/game-shell.js')).refreshGameShell();
    });
    await page.waitForTimeout(800);
    await carryOn('exploration');
    let ending = await clickChip(/^El final$/);
    if (!ending) ending = await page.locator('#game-shell [data-chip="hub-ending"]').first().click({ timeout: 4000 }).then(() => true).catch(() => false);
    if (!ending) {
        await clickChip(/\+\d+ más$/);
        ending = await page.locator('.popup[open] .hp-item[data-chip="hub-ending"]').click({ timeout: 5000 }).then(() => true).catch(() => false);
    }
    await page.waitForSelector('.end-root', { timeout: 10000 }).catch(() => {});
    const epilogue = await page.evaluate(() => [...document.querySelectorAll('.end-root .ep-line')].map(l => (l.textContent ?? '').trim()));
    await shot('final');
    check('J14.10 (5): al final de la campaña, en «Qué fue de cada uno», la línea de la pareja (vuelve contigo al gremio)',
        ending && epilogue.some(l => /^Nella Tresflechas vuelve contigo al gremio\. Después de «.+», duerme en la habitación que da al mar/.test(l)),
        JSON.stringify({ ending, epilogue }));
    await closePopup();

    const mine = problems.filter(p => /roman|meetup|qd-|hall|salón|legacy|game-options/i.test(p));
    check('sin errores del romance en la consola', mine.length === 0, mine.slice(0, 6).join('\n        '));
    if (problems.length > mine.length) console.log(`(otros avisos de la página: ${problems.length - mine.length})\n        ${problems.filter(p => !mine.includes(p)).slice(0, 4).join('\n        ')}`);
} catch (error) {
    failures++;
    console.log(`FAIL  el recorrido se paró: ${String(/** @type {any} */ (error)?.stack || error).slice(0, 800)}`);
    if (SHOT && page) await page.screenshot({ path: `${SHOT}.error.png` }).catch(() => {});
} finally {
    await browser?.close().catch(() => {});
    server?.kill();
    try {
        rmSync(dataRoot, { recursive: true, force: true });
    } catch { /* el servidor aún lo tiene abierto */ }
}

console.log(failures === 0 ? '\nJ14.10 en el navegador: un romance entero, bien.' : `\n${failures} fallos.`);
process.exit(failures === 0 ? 0 : 1);
