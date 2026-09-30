#!/usr/bin/env node
/**
 * Tus compañeros y el viaje, jugados desde la portada con el ratón (wiki/ROADMAP_SIN_CONEXION.md:
 * J14.7, J14.8, J13.5, J7.4, J14.9 y J7.2). Contra un servidor propio con un `--dataRoot`
 * temporal, como `e2e-gente.mjs`:
 *
 *   título → Jugar sin conexión → tu personaje → saltar la prueba → contratar a Gerd y a Nella →
 *   dormir en la posada de Puerto Alba varias noches: alguien llega, una ronda, una charla de
 *   pareja con los dos retratos (J14.7, J14.8) → «Grupo» → «Formación y papeles»: Nella delante
 *   y de vigía (J7.4) → viajar: el vigía del camino es Nella, y alguien dice algo por el camino
 *   con su cara en la novela (J13.5) → acampar: la guardia la abre Nella (J7.4) → con Gerd en
 *   vínculo 4, su misión personal desde su ficha, jugada hasta uno de sus finales y en el
 *   Diario (J14.9).
 *
 * Lo único que se prepara a mano es lo que costaría horas de juego: oro para las noches y el
 * vínculo de Gerd. Todo lo demás se pulsa.
 *
 * Uso:
 *   node tools/e2e-companeros.mjs --port 8300 --captura C:/tmp/comp.png
 *   (las capturas salen como comp.png.noche.png, comp.png.formacion.png…)
 *   node tools/e2e-companeros.mjs --port 8300 --log C:/tmp/comp.log   # lo que dice el servidor, y la página en comp.log.pagina.txt
 */

/* global window, document, HTMLElement */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createWriteStream, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8166;
const BASE = `http://127.0.0.1:${PORT}`;
const HEADED = process.argv.includes('--headed');
const SHOT = argAfter('--captura');
/** Solo una parte: `noches`, `formacion`, `mision` (sin nada, todas). */
const ONLY = argAfter('--solo');
const wants = (/** @type {string} */ part) => !ONLY || ONLY.split(',').includes(part);

const require = createRequire(join(ROOT, 'tests/package.json'));
const { chromium } = require('@playwright/test');

let failures = 0;
const check = (/** @type {string} */ name, /** @type {boolean} */ ok, detail = '') => {
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        -> ${detail}` : ''}`);
};

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-companeros-'));
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
        // `--log fichero`: lo que dice el servidor (un 500 se explica ahí).
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
        if (m.type() === 'warning' && /\[gremio\]/.test(m.text())) console.log(`        (aviso de la página: ${m.text().slice(0, 300)})`);
    });
    // Con `--log fichero`, también lo que dice la página (en `fichero.pagina.txt`).
    const pageLog = argAfter('--log') ? createWriteStream(`${argAfter('--log')}.pagina.txt`) : null;
    if (pageLog) page.on('console', (/** @type {any} */ m) => pageLog.write(`${m.type()} ${m.text().slice(0, 600)}\n`));
    await context.addInitScript(() => {
        try {
            window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,combat,travel,prisoners,mesa,high,spell,pet,bill,move,attack,roll,talk,journal');
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
            // Las noches van con los sucesos y las ventanas de la historia: los sucesos, encendidos;
            // las ventanas, apagadas hasta tener el grupo (la escena del prólogo taparía los clics).
            if (!window.sessionStorage.getItem('e2e-started')) {
                window.sessionStorage.setItem('e2e-started', '1');
                window.localStorage.setItem('sillytavern_gameSucesos', 'on');
                window.localStorage.setItem('sillytavern_gameStoryWindows', 'off');
            }
        } catch { /* nada */ }
    });

    const state = () => page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const party = (await import('/scripts/party.js')).getPartyMembersSnapshot();
        const meta = ctx.chatMetadata ?? {};
        return {
            world: String(meta.world_info ?? ''),
            place: String(meta.currentLocation ?? ''),
            board: String(meta.currentBoard ?? ''),
            party: party.map((/** @type {any} */ m) => ({ id: String(m.id), name: m.name, gold: Number(m.gold) || 0 })),
            bonds: Object.fromEntries(Object.entries(meta.bonds?.bonds ?? {}).map(([k, v]) => [k, Number(/** @type {any} */ (v)?.points) || 0])),
            day: Number(meta.calendar?.day) || 0,
            nights: meta.noches ?? null,
            formation: meta.party_formation ?? null,
            quests: meta.misionesPersonales ?? null,
        };
    });
    const clickChip = (/** @type {RegExp} */ pattern) => page.evaluate((source) => {
        const chip = [...document.querySelectorAll('#game-shell .gs-chip-action')].find(b => new RegExp(source).test(b.textContent || ''));
        if (chip instanceof HTMLElement) chip.click();
        return Boolean(chip);
    }, pattern.source);
    const chatHas = (/** @type {RegExp} */ pattern) => page.evaluate((source) => (window.SillyTavern.getContext().chat || [])
        .some((/** @type {any} */ m) => new RegExp(source).test(String(m.extra?.display_text || m.mes || ''))), pattern.source);
    const until = async (/** @type {() => Promise<boolean>} */ test, ms = 30000) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (await test().catch(() => false)) return true;
            await page.waitForTimeout(400);
        }
        return false;
    };
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
    /** Lo que haya abierto encima (un suceso, un aviso), fuera: se elige lo primero y se cierra. */
    const clearPopups = async () => {
        await clearDice();
        for (let i = 0; i < 6; i++) {
            const open = await page.evaluate(() => {
                const go = /** @type {HTMLElement|null} */ (document.querySelector('.popup:not([closing]) .su-go'));
                if (go) {
                    go.click();
                    return 'seguir';
                }
                const option = /** @type {HTMLElement|null} */ (document.querySelector('.popup:not([closing]) .su-option:not([disabled])'));
                if (option) {
                    option.click();
                    return 'suceso';
                }
                const ok = /** @type {HTMLElement|null} */ (document.querySelector('.popup:not([closing]) .popup-button-ok'));
                if (ok && ok.offsetParent) {
                    ok.click();
                    return 'ok';
                }
                return '';
            });
            if (!open) return;
            await page.waitForTimeout(500);
        }
    };
    /** La ventana de la escena (`ui/meetup-scene.js`). */
    const meetup = () => page.evaluate(() => {
        const dialog = document.querySelector('.qd-dialog[open]');
        const root = dialog?.querySelector('.qd-root');
        return {
            open: Boolean(dialog),
            kind: [...(root?.classList ?? [])].find(c => /^qd-(noche|pareja|escena|charla|despedida)$/.test(c))?.slice(3) ?? '',
            id: root?.getAttribute('data-scene') ?? '',
            plate: (dialog?.querySelector('.qd-nameplate')?.textContent ?? '').trim(),
            speaker: root?.getAttribute('data-speaker') ?? '',
            portrait: dialog?.querySelector('.qd-portrait img')?.getAttribute('src') ?? '',
            title: (dialog?.querySelector('.qd-title')?.textContent ?? '').trim(),
            lines: [...(dialog?.querySelectorAll('.qd-line') ?? [])].map(l => (l.textContent ?? '').trim()),
            chips: [...(dialog?.querySelectorAll('.qd-chip') ?? [])].map(c => (c.textContent ?? '').trim()),
        };
    });
    /** Jugar la escena abierta hasta el final, apuntando quién habla en cada paso. */
    const playMeetup = async () => {
        /** @type {Array<{plate: string, speaker: string, portrait: string, lines: string[]}>} */
        const frames = [];
        for (let i = 0; i < 20; i++) {
            const now = await meetup();
            if (!now.open) break;
            frames.push({ plate: now.plate, speaker: now.speaker, portrait: now.portrait, lines: now.lines });
            if (await page.locator('.qd-dialog[open] .qd-chip-reply').count() > 0) await page.locator('.qd-dialog[open] .qd-chip-reply').first().click();
            else await page.locator('.qd-dialog[open] .qd-chip').first().click();
            await page.waitForTimeout(250);
        }
        return frames;
    };
    /** El pueblo, y dentro de un sitio. */
    const enterPlace = async (/** @type {string} */ id) => {
        await carryOn('exploration');
        const inside = await page.evaluate(() => document.querySelector('#game-shell .gs-town-scene')?.getAttribute('data-place') ?? null);
        if (inside === id) return;
        // Ya dentro de otro sitio (la posada tras la última noche): a este, por su pestaña.
        if (inside !== null) {
            await page.locator(`#game-shell .gs-town-tab[data-place="${id}"]`).click({ timeout: 5000 }).catch(() => {});
            await until(async () => await page.evaluate(() => document.querySelector('#game-shell .gs-town-scene')?.getAttribute('data-place') ?? '') === id, 8000);
            return;
        }
        await until(async () => await page.locator(`#game-shell .gs-town-place[data-place="${id}"]`).count() > 0, 10000);
        await page.locator(`#game-shell .gs-town-place[data-place="${id}"]`).click({ timeout: 5000 }).catch(() => {});
        await page.waitForSelector('#game-shell .gs-town-scene', { timeout: 8000 }).catch(() => {});
    };
    const leavePlace = () => page.locator('#game-shell .gs-town-back').click({ timeout: 3000 }).catch(() => {});
    /** Lo que el modelo lee de la partida (no solo lo que se ve). */
    const chatMes = (/** @type {RegExp} */ pattern) => page.evaluate((source) => (window.SillyTavern.getContext().chat || [])
        .filter((/** @type {any} */ m) => new RegExp(source).test(String(m.mes || ''))).map((/** @type {any} */ m) => ({ name: m.name, mes: String(m.mes || ''), shown: String(m.extra?.display_text || '') })), pattern.source);
    /**
     * Las ventanas de la historia (una escena del hilo o una charla escrita), jugadas: en cada
     * decisión, la primera de `pick` que se pueda, o la primera abierta. Devuelve lo visto.
     */
    const clearStory = async (/** @type {string[]} */ pick = [], /** @type {number} */ max = 80) => {
        /** @type {Array<{id: string, options: string[], plate: string}>} */
        const seen = [];
        for (let i = 0; i < max; i++) {
            const now = await page.evaluate(() => {
                const ps = document.querySelector('dialog.ps-dialog[open]');
                if (ps) {
                    return {
                        kind: 'ps', id: ps.querySelector('.ps-root')?.getAttribute('data-scene') || '',
                        plate: (ps.querySelector('.qd-nameplate')?.textContent || '').trim(),
                        options: [...ps.querySelectorAll('.dw-option:not(.dw-locked)')].map(o => o.getAttribute('data-option') || ''),
                    };
                }
                const dw = document.querySelector('dialog.dw-dialog[open]');
                return dw ? { kind: 'dw', id: '', plate: '', options: [] } : null;
            });
            if (!now) return seen;
            seen.push({ id: now.id, options: now.options, plate: now.plate });
            if (now.kind === 'dw') {
                await page.locator('dialog.dw-dialog[open] .dw-finish, dialog.dw-dialog[open] .dw-leave').first().click({ timeout: 3000 }).catch(() => {});
            } else if (now.options.length > 0) {
                const choice = pick.find(id => now.options.includes(id)) ?? now.options[0];
                await page.locator(`dialog.ps-dialog[open] .dw-option[data-option="${choice}"]`).click({ timeout: 4000 }).catch(() => {});
            } else {
                await page.locator('dialog.ps-dialog[open] .ps-next, dialog.ps-dialog[open] .ps-finish').first().click({ timeout: 4000 }).catch(() => {});
            }
            await page.waitForTimeout(300);
        }
        return seen;
    };
    /** Las tiradas en pantalla: «Seguir» en cada una, como quien las mira. */
    const clearDice = async () => {
        let misses = 0;
        for (let i = 0; i < 40; i++) {
            const next = page.locator('.wm-dice-overlay.active .wm-dice-next');
            if (await next.count() === 0) break;
            const clicked = await next.click({ timeout: 1500 }).then(() => true).catch(() => false);
            if (!clicked && ++misses >= 2) break;
            await page.waitForTimeout(150);
        }
    };
    /** Gana la pelea abierta: todos a cero y se acaba (lo que en el juego lleva unos turnos). */
    const winFight = async () => {
        await until(async () => await page.evaluate(async () => Boolean((await import('/scripts/party.js')).getCombatEncounter()?.active)), 10000);
        await page.evaluate(async () => {
            const enc = (await import('/scripts/party.js')).getCombatEncounter();
            for (const e of enc?.enemies ?? []) e.currentHp = 0;
        });
        for (let i = 0; i < 4; i++) {
            const active = await page.evaluate(async () => Boolean((await import('/scripts/party.js')).getCombatEncounter()?.active));
            if (!active) break;
            await page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/combat-end'));
            await page.waitForTimeout(700);
            await clearDice();
        }
        // Si el turno no es de quien juega, se da por ganada como la daría el motor al ver a todos en el suelo.
        await page.evaluate(async () => {
            if ((await import('/scripts/party.js')).getCombatEncounter()?.active) (await import('/scripts/party/combat-flow.js')).endCombat('victory');
        });
        await page.waitForTimeout(800);
        await page.locator('.vs-card').filter({ visible: true }).first().click({ timeout: 2000 }).catch(() => {});
    };
    /** Un botón de una ventana de las de siempre (`.popup`), por su texto. */
    const popupButton = async (/** @type {RegExp} */ label, ms = 8000) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            const hit = await page.evaluate((source) => {
                const button = [...document.querySelectorAll('.popup[open]:not([closing]) .popup-button-ok, .popup[open]:not([closing]) .popup-button-cancel')]
                    .find(b => b instanceof HTMLElement && b.offsetParent && new RegExp(source).test(b.textContent || ''));
                if (button instanceof HTMLElement) button.click();
                return Boolean(button);
            }, label.source);
            if (hit) return true;
            await page.waitForTimeout(300);
        }
        return false;
    };

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    const firstRun = page.locator('text=Welcome to SillyTavern!');
    if (await firstRun.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#game-shell', { timeout: 90000 });

    // 1. Jugar sin conexión, con Iria, y saltar la prueba.
    const offline = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Jugar sin conexión' });
    await until(async () => await offline.count() === 1, 30000);
    await offline.click();
    await page.waitForSelector('.hc-root', { timeout: 120000 });
    await page.fill('.hc-root .hc-name', 'Iria');
    await pickHeroCard(page, 'race', 'Humano');
    await pickHeroCard(page, 'class', 'Guerrero');
    await page.locator('.hc-root .hc-enter').click();
    await until(async () => /Gremio/.test((await state()).world), 60000);
    await until(() => chatHas(/Al ladrón/), 20000);
    await page.waitForTimeout(800);
    await clickChip(/^Saltar la prueba$/);
    await page.waitForSelector('.popup:has-text("¿Saltar la prueba?")', { timeout: 10000 });
    await page.locator('.popup-button-ok:visible').first().click({ timeout: 5000 }).catch(() => {});
    await until(() => chatHas(/apunta tu nombre en el libro del gremio/), 15000);
    await page.waitForTimeout(800);
    await dropToasts();

    // Oro para las noches y los contratos: lo que en una partida se gana con encargos.
    await page.evaluate(async () => {
        const party = await import('/scripts/party.js');
        const hero = party.getPartyMembersSnapshot()[0];
        const { partyMembers } = await import('/scripts/party/state.js');
        const live = partyMembers.find((/** @type {any} */ m) => String(m.id) === String(hero.id));
        if (live) live.gold = 400;
        (await import('/scripts/party/roster.js')).savePartyState();
    });

    // 2. Contratar a Gerd, a Nella y a Osric, con sus botones.
    for (const name of ['Gerd el Mellado', 'Nella Tresflechas', 'Osric Mediapaga']) {
        await clickChip(/Contratar mercenarios/);
        await page.waitForSelector(`.hb-root [data-hireling="${name}"]`, { timeout: 15000 });
        await page.locator(`.hb-root [data-hireling="${name}"]`).click();
        await until(async () => (await state()).party.some(m => m.name === name), 10000);
        await clearPopups();
        await dropToasts();
    }
    let now = await state();
    check('contratados con sus botones: Gerd, Nella y Osric van en el grupo', now.party.length === 4, JSON.stringify(now.party));
    // Desde aquí, como juega cualquiera: con las ventanas de la historia.
    await page.evaluate(() => window.localStorage.setItem('sillytavern_gameStoryWindows', 'on'));

    if (wants('noches')) {
        // 3. J14.7 y J14.8: dormir en la posada varias noches.
        // D-J31: comprar no gasta la parte del día: una comida caliente en la posada.
        await enterPlace('posada');
        const slotBefore = await page.evaluate(() => Number(window.SillyTavern.getContext().chatMetadata?.calendar?.slotIndex) || 0);
        await page.locator('#game-shell .gs-town-scene .gs-town-act[data-action="inn-meal"]').click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(600);
        const slotAfter = await page.evaluate(() => Number(window.SillyTavern.getContext().chatMetadata?.calendar?.slotIndex) || 0);
        check('D-J31: comprar (una comida caliente en la posada) no gasta la parte del día', slotBefore === slotAfter && await chatHas(/Comida caliente para todos/), JSON.stringify({ slotBefore, slotAfter }));
        await leavePlace();
        /** @type {Array<{id: string, kind: string, frames: any[]}>} */
        const nights = [];
        for (let night = 0; night < 7; night++) {
            await page.waitForTimeout(800);
            const popped = await page.evaluate(() => [...document.querySelectorAll('.popup[open]:not([closing])')].map(p => (p.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120)));
            if (popped.length > 0) console.log(`        (encima: ${JSON.stringify(popped)})`);
            await clearPopups();
            await enterPlace('posada');
            const room = page.locator('#game-shell .gs-town-scene .gs-town-act[data-action="inn-room"]');
            if (await room.count() === 0) {
                if (SHOT) await page.screenshot({ path: `${SHOT}.sin-posada.png` });
                check('la posada ofrece «Dormir en una habitación»', false, JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-town-act')].map(b => b.getAttribute('data-action')))));
                break;
            }
            const dayBefore = (await state()).day;
            await room.click();
            const scene = await page.waitForSelector('.qd-dialog[open] .qd-chip', { timeout: 6000 }).then(() => true).catch(() => false);
            if (scene) {
                const first = await meetup();
                if (SHOT && nights.length === 0) await page.screenshot({ path: `${SHOT}.noche.png` });
                if (SHOT && first.kind === 'pareja' && !nights.some(n => n.kind === 'pareja')) await page.screenshot({ path: `${SHOT}.pareja.png` });
                const frames = await playMeetup();
                nights.push({ id: first.id, kind: first.kind, frames });
            }
            await until(async () => (await state()).day > dayBefore, 10000);
            await page.waitForTimeout(600);
            await clearPopups();
            await dropToasts();
            await leavePlace();
        }
        now = await state();
        const kinds = new Set(nights.map(n => (n.kind === 'pareja' ? 'pareja' : /-(buhonero|veterana|comicos|mensajero|viajero|familia)$/.test(n.id) ? 'llegada' : 'ronda')));
        check('J14.7: en siete noches en la posada salen escenas de noche, sin repetirse ninguna',
            nights.length >= 3 && new Set(nights.map(n => n.id)).size === nights.length, JSON.stringify(nights.map(n => `${n.kind}:${n.id}`)));
        check('J14.7: y se ven al menos dos cosas distintas (alguien que llega, una ronda, una charla de pareja)', kinds.size >= 2, JSON.stringify([...kinds]));
        check('J14.7: lo visto queda apuntado (noches.seen / noches.pairs), una por noche',
            Boolean(now.nights) && (now.nights.seen?.length ?? 0) + (now.nights.pairs?.length ?? 0) === nights.length, JSON.stringify(now.nights));
        // Una de pareja en la posada sale a veces (es al azar); la que se busca a propósito, acampando, más abajo.
        const pair = nights.find(n => n.kind === 'pareja');
        if (pair) console.log(`        (en la posada, también una de pareja: ${pair.id} · ${[...new Set(pair.frames.map(f => f.speaker))].join(' y ')})`);
        check('J14.7: la noche queda en la crónica', await chatHas(/🌙 \[NOCHE\]/));
    }

    const idOf = (/** @type {string} */ name) => now.party.find(m => m.name === name)?.id ?? '';

    if (wants('formacion')) {
        // 4. J7.4: «Grupo» → «Formación y papeles».
        await dropToasts();
        await clearPopups();
        await carryOn('exploration');
        await page.locator('#game-shell .gs-glance').click({ timeout: 5000 });
        await page.waitForSelector('.popup[open] .pg-formation', { timeout: 8000 });
        await page.locator('.popup[open] .pg-formation').click();
        await page.waitForSelector('.popup[open] .fm-root', { timeout: 8000 });
        const panel = () => page.evaluate(() => ({
            rows: [...document.querySelectorAll('.fm-root .fm-row')].map(r => `${r.querySelector('.fm-place')?.textContent}|${r.querySelector('.fm-name')?.textContent}`),
            duties: [...document.querySelectorAll('.fm-root .fm-duty')].map(d => d.getAttribute('data-duty')),
            auto: [...document.querySelectorAll('.fm-root .fm-duty .fm-pick option[value=""]')].map(o => o.textContent),
            summary: document.querySelector('.fm-root .fm-summary')?.textContent ?? '',
        }));
        const before = await panel();
        check('J7.4: «Grupo» → «Formación y papeles»: el orden de los cuatro y los papeles (cura, guía, vigía, cazador), cada uno con quién lo haría el juego',
            before.rows.length === 4 && before.duties.join(',') === 'cura,guia,vigia,cazador' && before.auto.every(a => /Lo decide el juego/.test(String(a))), JSON.stringify(before));
        for (let i = 0; i < 4; i++) {
            const up = page.locator('.fm-root .fm-row', { hasText: 'Nella Tresflechas' }).locator('.fm-up');
            if (await up.isDisabled()) break;
            await up.click();
            await page.waitForTimeout(200);
        }
        // Nella de guía, y luego de vigía: en el camino cada uno hace un solo papel, así que la guía
        // vuelve a decidirla el juego; y de guía, Osric.
        await page.locator('.fm-root .fm-duty[data-duty="guia"] .fm-pick').selectOption(idOf('Nella Tresflechas'));
        await page.waitForTimeout(200);
        await page.locator('.fm-root .fm-duty[data-duty="vigia"] .fm-pick').selectOption(idOf('Nella Tresflechas'));
        await page.waitForTimeout(200);
        const oneJob = (await state()).formation?.duties?.guia ?? 'x';
        await page.locator('.fm-root .fm-duty[data-duty="guia"] .fm-pick').selectOption(idOf('Osric Mediapaga'));
        await page.waitForTimeout(200);
        const after = await panel();
        if (SHOT) await page.screenshot({ path: `${SHOT}.formacion.png` });
        const saved = (await state()).formation;
        check('J7.4: un papel del camino por persona: Nella pasa de guía a vigía y la guía vuelve al juego', oneJob === '', JSON.stringify({ oneJob }));
        check('J7.4: se guarda: Nella la primera y de vigía, Osric de guía, y el resumen lo dice',
            saved?.order?.[0] === idOf('Nella Tresflechas') && saved?.duties?.vigia === idOf('Nella Tresflechas') && saved?.duties?.guia === idOf('Osric Mediapaga')
            && /^Delante: Nella/.test(after.summary) && /^Delante\|Nella/.test(after.rows[0] ?? ''), JSON.stringify({ saved, after }));
        await popupButton(/Hecho/);
        await page.waitForTimeout(400);
        await enterPlace('gremio');
        const hallAct = page.locator('#game-shell .gs-town-scene .gs-town-act[data-action="hub-formation"]');
        const inHall = await hallAct.count() === 1;
        if (inHall) await hallAct.click();
        const opened = await page.waitForSelector('.popup[open] .fm-root', { timeout: 6000 }).then(() => true).catch(() => false);
        if (SHOT && !(inHall && opened)) await page.screenshot({ path: `${SHOT}.gremio-formacion.png` });
        check('J7.4: en el gremio, «Tu gente» → «Formación y papeles» abre lo mismo', inHall && opened, inHall && opened ? '' : JSON.stringify(await page.evaluate(() => ({
            scene: document.querySelector('#game-shell')?.getAttribute('data-scene') || '',
            place: document.querySelector('#game-shell .gs-town-scene')?.getAttribute('data-place') || '',
            acts: [...document.querySelectorAll('#game-shell .gs-town-act')].map(b => b.getAttribute('data-action')),
            popups: [...document.querySelectorAll('dialog[open]:not([closing])')].map(d => (d.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80)),
        }))));
        await popupButton(/Hecho/);
        await leavePlace();
    }

    if (wants('mision')) {
        // 5. J14.9: la misión de Osric, con sus dos finales.
        await dropToasts();
        await clearPopups();
        const osric = idOf('Osric Mediapaga');
        await page.evaluate(async (id) => {
            const time = await import('/scripts/party/time.js');
            const { getBondProgress } = await import('/scripts/game-engine/campaign/bonds.js');
            for (let i = 0; i < 40 && getBondProgress(time.getCampaignBonds(), String(id)).rank < 4; i++) time.recordCampaignBondEvent(String(id), 'confidant_scene');
        }, osric);
        await page.waitForTimeout(800);
        check('J14.9: con Osric en vínculo 4, avisa de que tiene algo que pedirte', await chatHas(/Osric Mediapaga tiene algo que pedirte: «El anillo de Valdés»/));
        await dropToasts();
        const playOsric = async (/** @type {string} */ ending, /** @type {string} */ shot) => {
            await clearPopups();
            await carryOn('exploration');
            await page.locator('#game-shell .gs-chip[title="Abrir la ficha de Osric Mediapaga"]').filter({ visible: true }).first().click({ timeout: 5000 });
            await page.waitForSelector('.cc-card .cc-quest', { timeout: 8000 });
            const box = await page.evaluate(() => (document.querySelector('.cc-card .cc-quest')?.textContent || '').replace(/\s+/g, ' ').trim());
            if (SHOT && shot) await page.screenshot({ path: `${SHOT}.${shot}-ficha.png` });
            await page.locator('.cc-card .cc-quest-go').click({ timeout: 5000 });
            const started = await popupButton(/Ir con él/);
            const dayBefore = (await state()).day;
            const road1 = await popupButton(/En marcha/);
            const scene1Open = await until(async () => await page.locator('dialog.ps-dialog[open]').count() > 0, 10000);
            if (SHOT && shot) await page.screenshot({ path: `${SHOT}.${shot}-escena.png` });
            const scene1 = await clearStory(['esperar']);
            const toFight = await popupButton(/A pelear/, 10000);
            const fighting = await until(async () => await page.evaluate(async () => Boolean((await import('/scripts/party.js')).getCombatEncounter()?.active)), 15000);
            const fightBoard = (await state()).board;
            if (SHOT && shot) await page.screenshot({ path: `${SHOT}.${shot}-pelea.png` });
            await winFight();
            const afterFightNow = await page.evaluate(async () => ({
                active: Boolean((await import('/scripts/party.js')).getCombatEncounter()?.active),
                quest: window.SillyTavern.getContext().chatMetadata?.misionesPersonales?.quests?.['osric-anillo']?.step ?? '',
                popups: [...document.querySelectorAll('.popup[open]')].map(p => (p.textContent || '').replace(/\s+/g, ' ').slice(0, 80)),
            }));
            console.log(`        (tras la pelea: ${JSON.stringify(afterFightNow)}; avisos: ${JSON.stringify(problems.slice(-3))})`);
            await clearPopups();
            const road2 = await popupButton(/En marcha/, 25000);
            const scene2Open = await until(async () => await page.locator('dialog.ps-dialog[open]').count() > 0, 10000);
            const scene2 = await clearStory([ending]);
            const finalText = await page.evaluate(() => (document.querySelector('.popup[open] .pq-root')?.textContent || '').replace(/\s+/g, ' ').trim()).catch(() => '');
            if (SHOT && shot) await page.screenshot({ path: `${SHOT}.${shot}-final.png` });
            const back = await popupButton(/Volver a Puerto Alba/, 10000);
            await page.waitForTimeout(600);
            const after = await state();
            return {
                box, started, road1, scene1Open, scene1: scene1.map(s => s.options.join('/')).filter(Boolean), toFight, fighting, fightBoard, road2, scene2Open,
                scene2: scene2.map(s => s.options.join('/')).filter(Boolean), finalText: finalText.slice(0, 160), back,
                days: after.day - dayBefore, quest: after.quests?.quests?.['osric-anillo'] ?? null, board: after.board,
            };
        };
        const bondBefore = (await state()).bonds[osric] ?? 0;
        const first = await playOsric('verdad', 'mision');
        const bondAfter = (await state()).bonds[osric] ?? 0;
        check('J14.9: desde la ficha de Osric, su misión: «El anillo de Valdés», con de qué va y «Acompañarle»',
            /Su misión: El anillo de Valdés/.test(first.box) && /Acompañarle/.test(first.box) && first.started, JSON.stringify(first.box));
        check('J14.9: el camino (un día), la escena de la guardia con su decisión y la pelea en su tablero',
            first.road1 && first.scene1Open && first.scene1.some(o => /esperar/.test(o)) && first.toFight && first.fighting && first.fightBoard === 'Las rocas del camino',
            JSON.stringify(first));
        check('J14.9: tras ganar sigue sola: el camino a Valdés, la viuda y el final «La verdad»; el tablero se quita',
            first.road2 && first.scene2Open && first.back && first.quest?.done === true && first.quest?.ending === 'verdad' && first.board === '' && first.days >= 4,
            JSON.stringify(first));
        check('J14.9: el final une: el vínculo con Osric sube', bondAfter > bondBefore, JSON.stringify({ bondBefore, bondAfter }));
        // El Diario.
        await clearPopups();
        await page.locator('#game-shell .gs-tools .gs-journal').click({ timeout: 5000 }).catch(() => {});
        // Sin conexión, el Diario es un libro: lo de siempre está en «Apuntes».
        const book = await page.waitForSelector('dialog.lb-dialog[open]', { timeout: 8000 }).then(() => true).catch(() => false);
        if (book) await page.locator('dialog.lb-dialog[open] .lb-tab[data-view="notes"]').click({ timeout: 5000 }).catch(() => {});
        else await page.waitForSelector('.popup[open] .jr-root', { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(400);
        const diary = await page.evaluate(() => (document.querySelector('dialog.lb-dialog[open] .lb-page') ?? document.querySelector('.popup[open] .jr-root'))?.textContent?.replace(/\s+/g, ' ') ?? '');
        const at = diary.indexOf('Misiones de tu gente');
        check('J14.9: el Diario la apunta en «Misiones de tu gente», con cómo acabó',
            at >= 0 && /El anillo de Valdés, con Osric Mediapaga: terminada: La verdad/.test(diary.slice(at)), diary.slice(Math.max(0, at), at + 160));
        if (SHOT) await page.screenshot({ path: `${SHOT}.diario.png` });
        if (book) await page.locator('dialog.lb-dialog[open] .lb-close').click({ timeout: 3000 }).catch(() => {});
        else await popupButton(/Cerrar/);
        await page.waitForTimeout(400);
        // El otro final: la misma misión, otra vez desde el principio (lo único a mano: olvidarla).
        await page.evaluate(async () => {
            const ctx = window.SillyTavern.getContext();
            delete ctx.chatMetadata.misionesPersonales.quests['osric-anillo'];
        });
        const second = await playOsric('mentira', '');
        check('J14.9: y el otro final, jugado: «Una mentira piadosa»', second.back && second.quest?.done === true && second.quest?.ending === 'mentira', JSON.stringify(second));
    }

    if (wants('viaje')) {
        // 6. A 1387 desde el tablón: viajar, frases por el camino y acampar.
        await dropToasts();
        await clearPopups();
        await carryOn('exploration');
        // Los días de las misiones se come (lo dice su ventana): antes, dos seguidas mataban de
        // hambre a los mercenarios y a 1387 llegaba el héroe solo.
        const alive = await page.evaluate(async () => (await import('/scripts/party.js')).getPartyMembersSnapshot()
            .map((/** @type {any} */ m) => ({ name: String(m.name), hp: `${m.hp}/${m.maxHp}`, dead: Boolean(m.dead), hunger: Number(m.needs?.hunger) || 0 })));
        if (wants('mision')) {
            check('J14.9: tras los días de las misiones, nadie del grupo ha caído de hambre por el camino',
                alive.length === 4 && alive.every(m => !m.dead && m.hunger < 72), JSON.stringify(alive));
        }
        await clickChip(/Tablón de campañas/);
        await page.waitForSelector('.hb-root [data-campaign="1387"]', { timeout: 15000 });
        await page.locator('.hb-root [data-campaign="1387"]').click();
        const in1387 = await until(async () => /1387/.test((await state()).world), 120000);
        await page.waitForTimeout(2500);
        await clearStory();
        await clearPopups();
        await dropToasts();
        now = await state();
        const nellaThere = now.party.find(m => m.name === 'Nella Tresflechas')?.id ?? '';
        check('a 1387 con el grupo entero y su formación: Nella delante y de vigía (J7.4 viaja con el grupo)',
            in1387 && now.party.length === 4 && now.formation?.order?.[0] === nellaThere && now.formation?.duties?.vigia === nellaThere,
            JSON.stringify({ world: now.world, party: now.party.map(m => `${m.name}:${m.id}`), formation: now.formation }));
        // Fuera del tablero del principio («Volver a El Pueblo de Barro»), a la vista de viajar.
        for (let i = 0; i < 3 && (await state()).board; i++) {
            await carryOn('combat');
            await page.locator('.wm-leave-loc-btn').filter({ visible: true }).first().click({ timeout: 4000 }).catch(() => {});
            await page.waitForTimeout(800);
            await clearStory();
        }
        check('fuera del tablero, en El Pueblo de Barro', (await state()).board === '' && (await state()).place === 'El Pueblo de Barro', JSON.stringify(await state()));
        now = await state();
        /** @type {string[]} */
        const smallTalk = [];
        /** Viajar a un sitio vecino desde la columna «Viajar», a paso normal, y lo que salga. */
        const travelTo = async (/** @type {string} */ to) => {
            // Lo que saliera al llegar (un suceso del camino con su tirada y su «Seguir»), cerrado
            // antes, como quien lo lee: si no, tapa la columna «Viajar».
            await clearPopups();
            await clearDice();
            await clearPopups();
            await carryOn('exploration');
            await page.locator('#game-shell .gs-place', { hasText: to }).first().click({ timeout: 8000 });
            await page.waitForSelector('.popup:visible .tr-pace-normal', { timeout: 8000 });
            await page.locator('.popup:visible .tr-pace-normal').click({ timeout: 5000 });
            for (let i = 0; i < 12; i++) {
                await page.waitForTimeout(700);
                if (await page.locator('.popup:visible .tr-detour').count() > 0) await page.locator('.popup:visible .tr-detour').first().click();
                else if (await page.locator('.popup:visible .rd-pass, .popup:visible .rd-face').count() > 0) await page.locator('.popup:visible .rd-pass, .popup:visible .rd-face').first().click();
                else if (await page.locator('.popup:visible .gd-flee, .popup:visible .gd-pay').count() > 0) await page.locator('.popup:visible .gd-pay, .popup:visible .gd-flee').first().click();
                else if (await page.locator('.popup:visible .su-go, .popup:visible .su-option:not([disabled])').count() > 0) await clearPopups();
                else if ((await state()).place === to) break;
            }
            await page.waitForTimeout(1200);
            // J14.1: al llegar, a veces alguien quiere decirte algo (un aviso con «Escuchar»).
            const offered = await page.evaluate(() => [...document.querySelectorAll('#toast-container .toast')].map(t => (t.textContent || '').replace(/\s+/g, ' ')).filter(t => /quiere decirte algo/.test(t)));
            if (offered.length > 0) smallTalk.push(...offered);
            await clearStory();
            await clearPopups();
        };
        /** @type {any[]} */
        let lines = [];
        /** @type {string[]} */
        let novel = [];
        const places = ['El Camino Viejo', 'El Pueblo de Barro'];
        // Sin sucesos en estos viajes: la caja de la novela lleva las cuatro últimas, y un cruce de
        // caminos, un mendigo y el rumor que cuenta sacaban de ella la frase recién dicha. Los
        // sucesos del camino los miran sus pruebas; aquí se mira la frase.
        await page.evaluate(() => window.localStorage.setItem('sillytavern_gameSucesos', 'off'));
        for (let trip = 0; trip < 6 && lines.length === 0; trip++) {
            await travelTo(places[trip % 2]);
            lines = await chatMes(/^\[FRASE\] [^,]+, (por el camino|al llegar a )/);
            if (lines.length > 0) {
                // Recién dicha, en la caja de la novela: su frase, con su nombre.
                await carryOn('dialogue').catch(() => '');
                novel = await page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-vn-line')].map(l => (l.textContent || '').replace(/\s+/g, ' ').trim()));
                if (SHOT) await page.screenshot({ path: `${SHOT}.frase.png` });
            }
        }
        const roles = await chatMes(/En el camino: .*Vigía: Nella Tresflechas/);
        check('J7.4: en el camino, la vigía es Nella y el guía Osric, como se eligió',
            roles.length > 0 && roles.some(r => /Guía: Osric Mediapaga/.test(r.mes)), JSON.stringify((await chatMes(/En el camino:/)).map(r => r.mes.match(/En el camino:[^\n]*/)?.[0])));
        const said = lines[0] ? lines[0].shown.replace(/^💬 \[FRASE\] /, '') : '';
        check('J13.5: por el camino (o al llegar) alguien del grupo dice algo, a su nombre, y se lee en la caja de la novela',
            lines.length > 0 && ['Gerd el Mellado', 'Nella Tresflechas', 'Osric Mediapaga'].includes(lines[0].name) && said.length > 5
            && novel.some(l => l.includes(said.slice(0, 30))), JSON.stringify({ line: lines[0], novel: novel.slice(-3) }));
        // Es al azar (una por parte del día como mucho): se dice si ha salido, sin contarlo como fallo.
        console.log(`        (J14.1, charla que sale sola al llegar: ${smallTalk.length > 0 ? smallTalk[0] : 'esta vez no'})`);
        const reacted = await chatMes(/^\[FRASE\] [^,]+, ante lo que habéis decidido/);
        if (reacted.length > 0) console.log(`        (y ante una decisión: ${reacted[0].name}: ${reacted[0].shown})`);
        // Acampar en el Camino Viejo, con Gerd y Nella charlando junto al fuego (las noches van con
        // los sucesos: otra vez encendidos).
        if ((await state()).place !== 'El Camino Viejo') await travelTo('El Camino Viejo');
        await page.evaluate(() => window.localStorage.setItem('sillytavern_gameSucesos', 'on'));
        await carryOn('exploration');
        // «Acampar aquí», en la fila o en «+N más».
        let camp = await clickChip(/^Acampar aquí$/);
        if (!camp) {
            await clickChip(/\+\d+ más$/);
            camp = await page.locator('.popup[open] .hp-item[data-chip="camp"]').click({ timeout: 5000 }).then(() => true).catch(() => false);
        }
        const campOpen = await page.waitForSelector('.popup:visible .cp-root', { timeout: 8000 }).then(() => true).catch(() => false);
        const guards = await page.evaluate(() => [...document.querySelectorAll('.popup .cp-guard:checked')].map(b => /** @type {HTMLInputElement} */ (b).value));
        check('J7.4: al acampar, la vigía (Nella) está entre quienes hacen guardia', camp && campOpen && guards.includes(idOf('Nella Tresflechas')), JSON.stringify(guards));
        const pairValue = `${idOf('Gerd el Mellado')}|${idOf('Nella Tresflechas')}`;
        const options = await page.evaluate(() => [...document.querySelectorAll('.popup .cp-pair option')].map(o => /** @type {HTMLOptionElement} */ (o).value));
        const pick = options.includes(pairValue) ? pairValue : options.find(v => v.includes(idOf('Gerd el Mellado')) && v.includes(idOf('Nella Tresflechas'))) ?? '';
        await page.locator('.popup .cp-pair').selectOption(pick);
        await popupButton(/Pasar la noche/);
        const talk = await page.waitForSelector('.qd-dialog[open] .qd-chip', { timeout: 10000 }).then(() => true).catch(() => false);
        const open = await meetup();
        if (SHOT) await page.screenshot({ path: `${SHOT}.pareja.png` });
        const frames = await playMeetup();
        const speakers = new Set(frames.map(f => f.speaker).filter(Boolean));
        check('J14.8: acampando, Gerd y Nella charlan junto al fuego: una charla de pareja escrita, leída entera, cada uno con su placa y su retrato',
            talk && open.kind === 'pareja' && speakers.has('Gerd el Mellado') && speakers.has('Nella Tresflechas')
            && frames.some(f => /gerd/i.test(f.portrait)) && frames.some(f => /nella/i.test(f.portrait)) && frames.length >= 3,
            JSON.stringify({ id: open.id, frames: frames.map(f => `${f.plate}|${f.portrait.split('/').pop()}|${(f.lines[0] ?? '').slice(0, 40)}`) }));
        await page.waitForTimeout(1500);
        await clearPopups();
        check('J14.8: y lo oído queda apuntado, para no repetirla', ((await state()).nights?.pairs ?? []).length > 0, JSON.stringify((await state()).nights));

        // 7. J7.2: Bran se une en 1387 y, al acabar la campaña, se viene al gremio.
        await clearPopups();
        await dropToasts();
        if ((await state()).place !== 'El Pueblo de Barro') await travelTo('El Pueblo de Barro');
        const recruitActs = async () => page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-town-scene .gs-town-act')]
            .map(b => `${b.getAttribute('data-action')}|${(b.textContent || '').replace(/\s+/g, ' ').trim()}`));
        await enterPlace('posada');
        let acts = await recruitActs();
        const meetBran = acts.find(a => /^inn-meet:/.test(a) && /Bran/.test(a));
        if (meetBran) {
            await page.locator(`#game-shell .gs-town-scene .gs-town-act[data-action="${meetBran.split('|')[0]}"]`).click({ timeout: 5000 });
            await page.waitForTimeout(1200);
            await clearStory();
            await clearPopups();
            await enterPlace('posada');
            acts = await recruitActs();
        }
        const hireBran = acts.find(a => /^inn-hire:/.test(a) && /Bran/.test(a));
        if (hireBran) await page.locator(`#game-shell .gs-town-scene .gs-town-act[data-action="${hireBran.split('|')[0]}"]`).click({ timeout: 5000 });
        const joined = await until(async () => (await state()).party.some(m => m.name === 'Bran'), 15000);
        check('J7.2: en la posada de El Pueblo de Barro, «Conocer a Bran» y contratarle: se une al grupo', joined, JSON.stringify(acts));
        await clearStory();
        await clearPopups();
        await leavePlace();
        // Lo que en una partida cuesta la campaña entera: su vínculo, y que la campaña ha terminado.
        await page.evaluate(async () => {
            const party = (await import('/scripts/party.js')).getPartyMembersSnapshot();
            const bran = party.find((/** @type {any} */ m) => m.name === 'Bran');
            const time = await import('/scripts/party/time.js');
            const { getBondProgress } = await import('/scripts/game-engine/campaign/bonds.js');
            for (let i = 0; i < 30 && getBondProgress(time.getCampaignBonds(), String(bran?.id)).rank < 3; i++) time.recordCampaignBondEvent(String(bran?.id), 'confidant_scene');
            const ctx = window.SillyTavern.getContext();
            ctx.chatMetadata.plotEnding = Object.keys(ctx.chatMetadata.plot?.endings ?? {})[0] || 'fin';
            await ctx.saveMetadata();
        });
        await dropToasts();
        await clearPopups();
        await carryOn('exploration');
        let home = await clickChip(/^Volver al gremio$/);
        if (!home) {
            await clickChip(/\+\d+ más$/);
            home = await page.locator('.popup[open] .hp-item[data-chip="hub-home"]').click({ timeout: 5000 }).then(() => true).catch(() => false);
        }
        const farewell = await page.waitForSelector('.qd-dialog[open] .qd-root.qd-despedida', { timeout: 20000 }).then(() => true).catch(() => false);
        const ask = await meetup();
        if (SHOT) await page.screenshot({ path: `${SHOT}.despedida.png` });
        const come = page.locator('.qd-dialog[open] .qd-chip-reply', { hasText: 'Vente con nosotros' });
        const offered = await come.count() > 0;
        if (offered) await come.click();
        else await page.locator('.qd-dialog[open] .qd-chip-reply').first().click().catch(() => {});
        await page.waitForTimeout(300);
        for (let i = 0; i < 4 && (await meetup()).open; i++) {
            await page.locator('.qd-dialog[open] .qd-chip').first().click().catch(() => {});
            await page.waitForTimeout(300);
        }
        const inHub = await until(async () => /Gremio/.test((await state()).world), 60000);
        // El grupo llega un momento después del chat (se copian sus fichas al mundo del gremio).
        await until(async () => (await state()).party.some(m => m.name === 'Bran'), 20000);
        await page.waitForTimeout(500);
        const guildBran = await page.evaluate(async () => {
            const bran = (await import('/scripts/party.js')).getPartyMembersSnapshot().find((/** @type {any} */ m) => m.name === 'Bran');
            return bran ? { guild: bran.guild === true, from: bran.from ?? null } : null;
        });
        check('J7.2: al volver al gremio con la campaña acabada, Bran tiene su momento: «¿Vienes al gremio?» con su retrato',
            home && farewell && ask.plate === 'Bran' && offered && /¿Y ahora qué\?/.test(ask.lines.join(' ')), JSON.stringify(ask));
        check('J7.2: «Vente con nosotros»: llega al gremio como uno de los vuestros (del gremio, de 1387)',
            inHub && guildBran?.guild === true && guildBran?.from?.campaign === '1387', JSON.stringify({ inHub, guildBran }));
    }

    // Cuánto pesa la partida y cuánto tarda en guardarse, para verlo crecer.
    const saveCost = await page.evaluate(async () => {
        const st = await import('/script.js');
        const size = JSON.stringify(st.chat_metadata).length + JSON.stringify(st.chat).length;
        const started = performance.now();
        await st.saveChatConditional();
        return { size, ms: Math.round(performance.now() - started), messages: st.chat.length };
    }).catch(() => null);
    if (saveCost) console.log(`        (guardar el chat: ${saveCost.messages} mensajes, ${saveCost.size} caracteres, ${saveCost.ms} ms)`);
    const mine = problems.filter(p => /night|noche|pareja|cast|meetup|qd-|formation|formaci|quest|misi|frase|companion/i.test(p));
    check('sin errores de lo mío en la página', mine.length === 0, mine.slice(0, 6).join('\n        '));
    if (problems.length > mine.length) console.log(`(otros avisos de la página: ${problems.length - mine.length})\n        ${problems.filter(p => !mine.includes(p)).slice(0, 4).join('\n        ')}`);
} catch (error) {
    failures++;
    console.log(`FAIL  the run threw: ${String(/** @type {any} */ (error)?.stack || error).slice(0, 800)}`);
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
