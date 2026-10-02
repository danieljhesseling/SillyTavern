#!/usr/bin/env node
/**
 * J14.11 en el navegador: trabajos y ratos libres, jugados como un jugador desde el título, en un
 * navegador de verdad contra un servidor propio con un `--dataRoot` temporal (como
 * `e2e-sala-gremio.mjs`). Todo con el ratón: sin escribir órdenes.
 *
 *   título → Jugar sin conexión → tu personaje → saltar la prueba en la sala → contratar a un
 *   mercenario → por la mañana, la taberna dice que servir mesas es de tarde → la forja: viene el
 *   mercenario, la escena con Ramiro, en monedas → lo que te llevas (oro, aprecio, vínculo) y la
 *   tarde → servir mesas con la oreja puesta (un rumor) → de noche, las cartas: la apuesta, la
 *   mesa con las probabilidades, mayor o menor, plantarse → al día siguiente, el muelle (que antes
 *   no salía) y pescar → dejar a medias no gasta nada → entrenar en el patio del gremio → de noche,
 *   leer en el gremio da experiencia.
 *
 * Uso:
 *   node tools/e2e-trabajos.mjs --port 8430 --captura C:/tmp/trabajos.png   # trabajos.png.forja.png, …
 *   node tools/e2e-trabajos.mjs --headed
 */

/* global window, document, HTMLElement */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8430;
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

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-trabajos-'));
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
        const timer = setTimeout(() => reject(new Error('the server did not start in 420s')), 420000);
        const watch = (/** @type {any} */ buffer) => {
            const said = String(buffer);
            if (said.includes(String(PORT)) || said.toLowerCase().includes('listening')) {
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
 * Elegir en una tarjeta de «Crear personaje» la opción que más se parece a lo pedido.
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
    const chosen = values.find(v => plain(v).includes(plain(wanted))) ?? values[0];
    await target.locator(`.hc-picker .hc-option[data-value="${chosen}"]`).first().click();
    await target.waitForSelector('.hc-picker', { state: 'detached', timeout: 15000 }).catch(() => {});
    await target.waitForTimeout(200);
}

try {
    await startServer();
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
            window.localStorage.setItem('sillytavern_gameSucesos', 'off');
            // Las escenas del hilo y las charlas escritas taparían clics; aquí se juegan los trabajos.
            window.localStorage.setItem('sillytavern_gameStoryWindows', 'off');
        } catch { /* nada */ }
    });

    /** Lo que el juego sabe ahora. */
    const state = () => page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const party = (await import('/scripts/party.js')).getPartyMembersSnapshot();
        const meta = ctx.chatMetadata ?? {};
        return {
            world: String(meta.world_info ?? ''),
            board: String(meta.currentBoard ?? ''),
            day: Number(meta.calendar?.day) || 0,
            slot: Number(meta.calendar?.slotIndex) || 0,
            party: party.map((/** @type {any} */ m) => ({
                id: String(m.id), name: m.name, gold: Number(m.gold) || 0, xp: Number(m.xp) || 0, guest: Boolean(m.guest),
                weapon: (m.items ?? []).filter((/** @type {any} */ i) => Number(i?.magicalBonus) > 0).map((/** @type {any} */ i) => i.name),
            })),
            purse: party.reduce((/** @type {number} */ sum, /** @type {any} */ m) => sum + (Number(m.gold) || 0), 0),
            attitudes: JSON.parse(JSON.stringify(meta.attitudes?.values ?? {})),
            pastimes: JSON.parse(JSON.stringify(meta.pastimes ?? {})),
            bonds: Object.fromEntries(Object.entries(meta.bonds?.bonds ?? {}).map(([k, v]) => [k, Number(/** @type {any} */ (v)?.points) || 0])),
            done: JSON.parse(JSON.stringify(meta.social?.day?.done ?? [])),
            rumors: Array.isArray(meta.rumorsHeard) ? meta.rumorsHeard.length : 0,
        };
    });
    const chatHas = (/** @type {RegExp} */ pattern) => page.evaluate((source) => (window.SillyTavern.getContext().chat || [])
        .some((/** @type {any} */ m) => new RegExp(source).test(String(m.extra?.display_text || m.mes || ''))), pattern.source);
    const dropToasts = () => page.evaluate(() => document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));
    const until = async (/** @type {() => Promise<boolean>} */ test, ms = 30000) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (await test().catch(() => false)) return true;
            await page.waitForTimeout(300);
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
    const placeScene = () => page.evaluate(() => {
        const scene = document.querySelector('#game-shell .gs-town-scene');
        return {
            place: scene?.getAttribute('data-place') || '',
            groups: [...(scene?.querySelectorAll('.gs-town-group') ?? [])].map(g => (g.textContent || '').trim()),
            acts: [...(scene?.querySelectorAll('.gs-town-act') ?? [])].map(b => ({
                id: b.getAttribute('data-action') || '',
                label: (b.querySelector('.gs-btn-label')?.textContent || b.textContent || '').trim(),
                detail: (b.querySelector('.gs-btn-detail')?.textContent || '').trim(),
                on: !(/** @type {HTMLButtonElement} */ (b).disabled),
            })),
        };
    });
    const enterPlace = async (/** @type {string} */ id) => {
        await carryOn('exploration');
        if ((await placeScene()).place !== id) {
            if (await page.locator('#game-shell .gs-town-scene').count() > 0) {
                await page.locator(`#game-shell .gs-town-tab[data-place="${id}"]`).click({ timeout: 5000 }).catch(() => {});
            } else {
                await until(() => page.evaluate(() => document.querySelectorAll('#game-shell .gs-town-place').length > 0), 10000);
                await page.locator(`#game-shell .gs-town-place[data-place="${id}"]`).click({ timeout: 5000 }).catch(() => {});
            }
        }
        return until(async () => (await placeScene()).place === id, 8000);
    };
    const act = (/** @type {string} */ id) => page.locator(`#game-shell .gs-town-scene .gs-town-act[data-action="${id}"]`).click({ timeout: 5000 }).then(() => true).catch(() => false);
    const closeWindow = async () => {
        await page.locator('dialog[open]:not([closing]) :is(.hb-close, .mm-close, .popup-button-ok, .popup-button-cancel):visible').last().click({ timeout: 5000 }).catch(() => {});
        await until(() => page.evaluate(() => document.querySelectorAll('dialog[open]:not([closing])').length === 0), 6000);
    };
    const shot = async (/** @type {string} */ what) => { if (SHOT) await page.screenshot({ path: `${SHOT}.${what}.png` }); };
    /** El rato abierto, como se ve. */
    const pastime = () => page.evaluate(() => {
        const dialog = document.querySelector('.pt-dialog[open]');
        const root = dialog?.querySelector('.pt-root');
        return {
            open: Boolean(dialog),
            stage: root?.getAttribute('data-stage') || '',
            name: (dialog?.querySelector('.qd-nameplate')?.textContent || '').trim(),
            title: (dialog?.querySelector('.qd-title')?.textContent || '').trim(),
            lines: [...(dialog?.querySelectorAll('.qd-line') ?? [])].map(l => `${l.className.replace(/qd-line qd-| pt-\w+/g, '')}: ${(l.textContent || '').trim()}`),
            chips: [...(dialog?.querySelectorAll('.qd-chip') ?? [])].map(c => (c.textContent || '').replace(/\s+/g, ' ').trim()),
            sides: [...(dialog?.querySelectorAll('.pt-side') ?? [])].map(s => ({ side: s.getAttribute('data-side'), text: (s.textContent || '').replace(/\s+/g, ' ').trim(), on: !(/** @type {HTMLButtonElement} */ (s).disabled) })),
            same: (dialog?.querySelector('.pt-same')?.textContent || '').trim(),
            pot: (dialog?.querySelector('.pt-pot')?.textContent || '').trim(),
            shown: dialog?.querySelector('.pt-shown .pt-card')?.getAttribute('data-card') || '',
            portrait: dialog?.querySelector('.qd-portrait img')?.getAttribute('src') || '',
            backdrop: (/** @type {HTMLElement|null} */ (dialog?.querySelector('.qd-backdrop')))?.style.getPropertyValue('--qd-backdrop') || '',
            leave: Boolean(dialog?.querySelector('.qd-leave')),
        };
    });
    const press = (/** @type {string} */ selector) => page.locator(`.pt-dialog[open] ${selector}`).first().click({ timeout: 5000 }).then(() => true).catch(() => false);
    /** Pasar la escena: seguir, y en el paso que decide, la respuesta `reply` (desde 0). */
    const playScene = async (reply = 0) => {
        for (let i = 0; i < 10; i++) {
            const now = await pastime();
            if (!now.open || now.stage !== 'scene') return;
            if (await page.locator('.pt-dialog[open] .qd-chip-reply').count() > 0) await page.locator('.pt-dialog[open] .qd-chip-reply').nth(reply).click();
            else await press('.qd-chip');
            await page.waitForTimeout(250);
        }
    };
    const waitStage = (/** @type {string} */ stage) => until(async () => (await pastime()).stage === stage, 10000);

    // Con muchas vueltas a la vez, el servidor puede tardar en servir la primera página.
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    const firstRun = page.locator('text=Welcome to SillyTavern!');
    if (await firstRun.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#game-shell', { timeout: 90000 });

    // 1. Jugar sin conexión, con Mara.
    const offline = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Jugar sin conexión' });
    await until(async () => await offline.count() === 1, 30000);
    await offline.click();
    await page.waitForSelector('.hc-root', { timeout: 120000 });
    await page.fill('.hc-root .hc-name', 'Mara');
    await pickHeroCard(page, 'race', 'Humano');
    await pickHeroCard(page, 'class', 'Guerrero');
    await page.locator('.hc-root .hc-enter').click();
    await until(async () => /Gremio/.test((await state()).world), 60000);
    await until(() => chatHas(/Al ladrón/), 20000);
    await page.waitForTimeout(800);
    check('empieza en Puerto Alba, con Mara', (await state()).party[0]?.name === 'Mara', JSON.stringify((await state()).party));

    // 2. Saltar la prueba desde el muelle (D-J28), salir al pueblo y contratar a alguien que venga a los trabajos.
    const clickChip = (/** @type {RegExp} */ pattern) => page.evaluate((source) => {
        const chip = [...document.querySelectorAll('#game-shell .gs-chip-action')].find(b => new RegExp(source).test((b.textContent || '').trim()));
        if (chip instanceof HTMLElement) chip.click();
        return Boolean(chip);
    }, pattern.source);
    await carryOn('combat');
    await until(() => page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-chip-action')].some(c => /^Saltar la prueba$/.test((c.textContent || '').trim()))), 15000);
    await clickChip(/^Saltar la prueba$/);
    await page.waitForSelector('.popup:has-text("¿Saltar la prueba?")', { timeout: 10000 }).catch(() => {});
    await page.locator('.popup-button-ok:visible').first().click({ timeout: 5000 }).catch(() => {});
    await until(() => chatHas(/apunta tu nombre en el libro del gremio|moja la pluma/), 15000);
    await page.waitForTimeout(1000);
    await page.evaluate(() => document.querySelectorAll('.wm-dice-overlay.active .wm-dice-next').forEach(b => /** @type {HTMLElement} */ (b).click()));
    await carryOn('exploration');
    if ((await state()).board) {
        await clickChip(/^Salir del tablero$|^Volver a Puerto Alba$/);
        await page.locator('#game-shell .gs-scene-map .wm-leave-loc-btn').first().click({ timeout: 3000 }).catch(() => {});
    }
    await until(async () => (await state()).board === '', 10000);
    await dropToasts();
    await enterPlace('gremio');
    await act('hub-hire');
    await page.waitForSelector('.hb-root [data-hireling]', { timeout: 10000 }).catch(() => {});
    await page.locator('.hb-root [data-hireling]').first().click({ timeout: 5000 }).catch(() => {});
    const hired = await until(async () => (await state()).party.length === 2, 8000);
    await closeWindow();
    await dropToasts();
    let now = await state();
    const mate = now.party[1];
    check('prueba saltada y un mercenario contratado', hired && Boolean(mate), JSON.stringify(now.party));

    // Para que la partida empiece por la mañana, como un jugador que acaba de llegar.
    const slotIds = await page.evaluate(() => (window.SillyTavern.getContext().chatMetadata?.calendar?.slots ?? []).map((/** @type {any} */ s) => s.id));
    const slotId = () => state().then(s => slotIds[s.slot] ?? '');
    // Si ya no es por la mañana (la prueba o la sala gastaron algo), se duerme hasta mañana.
    if ((await slotId()) !== 'morning') {
        await page.evaluate(async () => {
            const time = await import('/scripts/party/time.js');
            await time.sleepTillMorning();
        });
        await page.waitForTimeout(800);
        await carryOn('exploration');
        await dropToasts();
    }

    // 3. Por la mañana, la taberna: el grupo «Trabajos y ratos libres», que dice por qué no se puede aún.
    await enterPlace('posada');
    let inn = await placeScene();
    const tables = inn.acts.find(a => a.id === 'rato:mesas');
    const cards = inn.acts.find(a => a.id === 'rato:cartas');
    check('la taberna, por la mañana: «Trabajos y ratos libres» con servir mesas y las cartas, apagados y diciendo por qué',
        inn.groups.includes('Trabajos y ratos libres') && tables && !tables.on && /de tarde o de noche/.test(tables.detail) && cards && !cards.on && /tarde y por la noche/.test(cards.detail),
        JSON.stringify({ groups: inn.groups, tables, cards }));
    await shot('taberna-manana');

    // 4. La forja, por la mañana: viene el mercenario, Ramiro, en monedas. Si hoy es fiesta o día
    // de descanso (D-J29), la herrería está cerrada y lo dice: se duerme hasta mañana.
    await enterPlace('herreria');
    let smithy = await placeScene();
    for (let tries = 0; tries < 3 && /cerrad/i.test(smithy.acts.find(a => a.id === 'rato:forja')?.detail ?? ''); tries++) {
        const shut = smithy.acts.find(a => a.id === 'rato:forja');
        check('la herrería cerrada (fiesta o descanso): echar una mano, apagado y diciendo por qué', !shut?.on && /cerrad/i.test(shut?.detail ?? ''), JSON.stringify(shut));
        await shot('herreria-cerrada');
        await page.evaluate(async () => {
            const time = await import('/scripts/party/time.js');
            await time.sleepTillMorning();
        });
        await page.waitForTimeout(800);
        await carryOn('exploration');
        await dropToasts();
        await enterPlace('herreria');
        smithy = await placeScene();
    }
    const forge = smithy.acts.find(a => a.id === 'rato:forja');
    check('la herrería ofrece echar una mano, con lo que da y que gasta la mañana', Boolean(forge?.on) && /Gasta la mañana/.test(forge?.detail ?? '') && /Ramiro/.test(forge?.detail ?? ''), JSON.stringify(forge));
    await shot('herreria');
    const before = await state();
    await act('rato:forja');
    await waitStage('who');
    let seen = await pastime();
    check('quién viene: el mercenario libre, en una ficha que se enciende; y «Dejarlo para otro día»',
        seen.chips.some(c => c.includes(mate.name.split(' ')[0])) && seen.chips.some(c => /Empezar sol[oa]/.test(c)) && seen.leave && /Ramiro/.test(seen.name),
        JSON.stringify(seen));
    await press('.qd-chip-mate');
    await page.waitForTimeout(200);
    seen = await pastime();
    check('al encenderla, «Empezar con …»', seen.chips.some(c => new RegExp(`Empezar con ${mate.name.split(' ')[0]}`).test(c)), JSON.stringify(seen.chips));
    await shot('forja-quien');
    await press('.pt-start');
    await waitStage('scene');
    seen = await pastime();
    check('la escena en la forja: Ramiro en la placa, su retrato, la herrería detrás, y el mercenario en el texto',
        /Ramiro/.test(seen.name) && /ramiro/i.test(seen.portrait) && /sitios\/herreria/.test(seen.backdrop) && seen.lines.some(l => new RegExp(mate.name.split(' ')[0]).test(l)),
        JSON.stringify(seen));
    await shot('forja-escena');
    await playScene(0);
    await waitStage('end');
    seen = await pastime();
    check('lo que te llevas: el oro, cuánto falta para la mejora, el aprecio de Ramiro y el vínculo',
        seen.lines.some(l => /\+\d+ de oro \(\d+ de el jornal/.test(l)) && seen.lines.some(l => /Llevas 1 de 3 días en la forja/.test(l))
        && seen.lines.some(l => /Ramiro os mira ahora de forma cordial/.test(l)) && seen.lines.some(l => /un poco más cerca/.test(l)), JSON.stringify(seen.lines));
    await shot('forja-final');
    await press('.qd-chip-finish');
    await until(async () => !(await pastime()).open, 6000);
    await page.waitForTimeout(600);
    let after = await state();
    check('la forja: más oro, la parte del día gastada («En la forja»), Ramiro cordial, un día de forja y el vínculo del mercenario',
        after.purse > before.purse && after.slot === before.slot + 1 && after.done.some((/** @type {any} */ d) => d.label === 'En la forja')
        && after.attitudes['Ramiro'] === 1 && after.pastimes?.forge?.['Ramiro'] === 1 && (after.bonds[mate.id] ?? 0) > (before.bonds[mate.id] ?? 0),
        JSON.stringify({ purse: [before.purse, after.purse], slot: [before.slot, after.slot], done: after.done, att: after.attitudes, pt: after.pastimes, bonds: [before.bonds, after.bonds] }));
    await dropToasts();

    // 5. Por la tarde, servir mesas con la oreja puesta: un rumor.
    await carryOn('exploration');
    await enterPlace('posada');
    inn = await placeScene();
    check('por la tarde, servir mesas ya se puede', Boolean(inn.acts.find(a => a.id === 'rato:mesas')?.on), JSON.stringify(inn.acts.filter(a => a.id.startsWith('rato:'))));
    const beforeInn = await state();
    await act('rato:mesas');
    await waitStage('who');
    await press('.pt-start');
    await waitStage('scene');
    await playScene(1);
    await waitStage('end');
    seen = await pastime();
    check('servir mesas con la oreja puesta: el jornal, lo que se oye y el aprecio de Tomás',
        seen.lines.some(l => /\+\d+ de oro/.test(l)) && seen.lines.some(l => /Lo que se oye en las mesas:|Hoy no se cuenta nada/.test(l)) && seen.lines.some(l => /Tomás os mira ahora/.test(l)),
        JSON.stringify(seen.lines));
    await shot('mesas-final');
    await press('.qd-chip-finish');
    await until(async () => !(await pastime()).open, 6000);
    await page.waitForTimeout(600);
    after = await state();
    check('y la noche: la tarde se fue sirviendo mesas, con un rumor más oído', after.slot === beforeInn.slot + 1 && after.done.some((/** @type {any} */ d) => d.label === 'Servir mesas')
        && after.rumors >= beforeInn.rumors, JSON.stringify({ slot: after.slot, done: after.done, rumors: [beforeInn.rumors, after.rumors] }));
    await dropToasts();

    // 6. De noche, las cartas: la apuesta, la mesa con las probabilidades, mayor o menor.
    await carryOn('exploration');
    await enterPlace('posada');
    const beforeCards = await state();
    await act('rato:cartas');
    await waitStage('who');
    await press('.pt-start');
    await waitStage('scene');
    seen = await pastime();
    check('las cartas: quien baraja explica el juego en una frase', seen.lines.some(l => /mayor o menor/.test(l)) && seen.chips.some(c => /Sentarse a jugar/.test(c)), JSON.stringify(seen));
    await playScene(0);
    await waitStage('bet');
    seen = await pastime();
    check('la apuesta: 5, 10 o 20 de oro, y «Mejor no»', seen.chips.filter(c => /Apostar \d+ de oro/.test(c)).length === 3 && seen.leave, JSON.stringify(seen.chips));
    await shot('cartas-apuesta');
    await press('.pt-bet[data-bet="5"]');
    await waitStage('table');
    seen = await pastime();
    check('la mesa: una carta boca arriba, el bote y, en cada lado, cuántas de cuántas y el tanto por ciento',
        Boolean(seen.shown) && /Bote: 5 de oro/.test(seen.pot) && seen.sides.length === 2
        && seen.sides.every(s => !s.on || /\d+ de \d+ cartas · \d+ %/.test(s.text)) && /Iguales|ninguna igual/.test(seen.same), JSON.stringify(seen));
    await shot('cartas-mesa');
    for (let i = 0; i < 4; i++) {
        seen = await pastime();
        if (seen.stage !== 'table' || seen.chips.some(c => /Seguir/.test(c))) break;
        // Tras un acierto, plantarse; si no, el lado más probable.
        if (seen.chips.some(c => /Plantarse/.test(c))) {
            await press('.pt-stand');
        } else {
            const pct = (/** @type {string} */ t) => Number((t.match(/(\d+) %/) ?? [])[1] ?? -1);
            const best = [...seen.sides].filter(s => s.on).sort((a, b) => pct(b.text) - pct(a.text))[0];
            await press(`.pt-side[data-side="${best?.side}"]`);
        }
        await page.waitForTimeout(300);
    }
    seen = await pastime();
    const net = seen.lines.find(l => /Ganas \d+ de oro|Pierdes \d+ de oro|Ni ganas/.test(l)) ?? '';
    check('la mano acaba: lo que salió y cuánto se gana o se pierde', /Salieron:/.test(seen.lines.join(' ')) && Boolean(net), JSON.stringify(seen.lines));
    await shot('cartas-final');
    await press('.qd-chip-next');
    await waitStage('end');
    await press('.qd-chip-finish');
    await until(async () => !(await pastime()).open, 6000);
    await page.waitForTimeout(800);
    after = await state();
    const won = Number((net.match(/Ganas (\d+)/) ?? [])[1] ?? 0);
    const lost = Number((net.match(/Pierdes (\d+)/) ?? [])[1] ?? 0);
    check('el oro cuadra con la mano, y la noche se fue (es otro día)', after.purse === beforeCards.purse + won - lost && after.day === beforeCards.day + 1,
        JSON.stringify({ purse: [beforeCards.purse, after.purse], won, lost, day: [beforeCards.day, after.day] }));
    await dropToasts();

    // 7. Al día siguiente, el muelle: sale como sitio, y se pesca.
    await carryOn('exploration');
    await page.locator('#game-shell .gs-town-back').click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(400);
    const docks = await page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-town-place')].map(c => c.getAttribute('data-place')));
    check('el muelle sale entre los sitios de Puerto Alba', docks.includes('muelle'), JSON.stringify(docks));
    await shot('sitios');
    await enterPlace('muelle');
    const pier = await placeScene();
    check('en el muelle: pescar, con lo que da', Boolean(pier.acts.find(a => a.id === 'rato:pescar')?.on), JSON.stringify(pier));
    await shot('muelle');
    const beforeFish = await state();
    await act('rato:pescar');
    await waitStage('who');
    await press('.pt-start');
    await waitStage('scene');
    await playScene(0);
    await waitStage('end');
    seen = await pastime();
    check('pescar: cuántos peces, si coméis, y lo que sobra a la venta', seen.lines.some(l => /Sacas \d+ peces|Sacas un pez/.test(l)), JSON.stringify(seen.lines));
    await shot('pesca-final');
    await press('.qd-chip-finish');
    await until(async () => !(await pastime()).open, 6000);
    await page.waitForTimeout(600);
    after = await state();
    check('y la mañana se fue pescando', after.slot === beforeFish.slot + 1 && after.done.some((/** @type {any} */ d) => d.label === 'Pescar'), JSON.stringify({ slot: after.slot, done: after.done }));
    await dropToasts();

    // 8. Por la tarde, en la sala del gremio: dejar a medias no gasta nada; entrenar en el patio,
    // con el mercenario (que no gana experiencia: sube contigo); y de noche, leer.
    await carryOn('exploration');
    await enterPlace('gremio');
    let hall = await placeScene();
    check('en la sala del gremio: leer y entrenar en el patio', Boolean(hall.acts.find(a => a.id === 'rato:leer')?.on) && Boolean(hall.acts.find(a => a.id === 'rato:patio')?.on)
        && hall.groups.includes('Trabajos y ratos libres'), JSON.stringify({ groups: hall.groups, acts: hall.acts.filter(a => a.id.startsWith('rato:')) }));
    await shot('gremio-tarde');
    const beforeYard = await state();
    await act('rato:patio');
    await waitStage('who');
    await page.locator('.pt-dialog[open] .qd-leave').click();
    await until(async () => !(await pastime()).open, 6000);
    const left = await state();
    check('«Dejarlo para otro día» cierra sin gastar la parte del día', left.slot === beforeYard.slot && left.day === beforeYard.day, JSON.stringify({ before: beforeYard.slot, after: left.slot }));
    await act('rato:patio');
    await waitStage('who');
    await press('.qd-chip-mate');
    await press('.pt-start');
    await waitStage('scene');
    seen = await pastime();
    check('el patio: quien enseña en la placa, el patio dibujado detrás, y el mercenario con un arma de madera',
        Boolean(seen.name) && /patio/.test(seen.lines.join(' ')) && seen.lines.some(l => new RegExp(mate.name.split(' ')[0]).test(l)) && /sitios\/patio\.png/.test(seen.backdrop),
        JSON.stringify(seen));
    await shot('patio-escena');
    await playScene(1);
    await waitStage('end');
    seen = await pastime();
    check('lo que te llevas del patio: experiencia para Mara; el mercenario, no (sube contigo); y el vínculo',
        seen.lines.some(l => /^summary: Mara: \+\d+ de experiencia/.test(l)) && seen.lines.some(l => /es de alquiler: no gana experiencia/.test(l)) && seen.lines.some(l => /un poco más cerca/.test(l)),
        JSON.stringify(seen.lines));
    await shot('patio-final');
    await press('.qd-chip-finish');
    await until(async () => !(await pastime()).open, 6000);
    await page.waitForTimeout(600);
    after = await state();
    check('entrenar: la experiencia en la ficha y la tarde gastada («Entrenar»)', after.party[0].xp > beforeYard.party[0].xp && after.slot === beforeYard.slot + 1
        && after.done.some((/** @type {any} */ d) => d.label === 'Entrenar'), JSON.stringify({ xp: [beforeYard.party[0].xp, after.party[0].xp], slot: [beforeYard.slot, after.slot], done: after.done }));
    await dropToasts();

    // De noche: el patio, a oscuras; leer, sí.
    await carryOn('exploration');
    await enterPlace('gremio');
    hall = await placeScene();
    const yardNight = hall.acts.find(a => a.id === 'rato:patio');
    check('de noche el patio está a oscuras, y leer sí se puede', Boolean(yardNight && !yardNight.on && /a oscuras/.test(yardNight.detail)) && Boolean(hall.acts.find(a => a.id === 'rato:leer')?.on),
        JSON.stringify(hall.acts.filter(a => a.id.startsWith('rato:'))));
    const beforeRead = await state();
    await act('rato:leer');
    await waitStage('who');
    await press('.pt-start');
    await waitStage('scene');
    seen = await pastime();
    check('leer de noche: la escena lo dice', seen.lines.some(l => /esta noche/.test(l)) || (await page.locator('.pt-dialog[open] .qd-chip').count()) > 0, JSON.stringify(seen.lines));
    // Sin biblioteca todavía se lee en la sala (con ella, `sitios/biblioteca.png`).
    check('leer sin biblioteca: la sala del gremio de noche detrás', /sitios\/gremio-noche\.png/.test(seen.backdrop), seen.backdrop);
    await playScene(0);
    await waitStage('end');
    seen = await pastime();
    check('leer: experiencia para Mara', seen.lines.some(l => /Mara: \+\d+ de experiencia/.test(l)), JSON.stringify(seen.lines));
    await shot('leer-final');
    await press('.qd-chip-finish');
    await until(async () => !(await pastime()).open, 6000);
    await page.waitForTimeout(600);
    after = await state();
    check('la experiencia se apunta en la ficha', after.party[0].xp > beforeRead.party[0].xp, JSON.stringify({ before: beforeRead.party[0].xp, after: after.party[0].xp }));
    await shot('final');

    const mine = problems.filter(p => /pastime|trabajo|card-game|pt-|pastimes/i.test(p));
    check('sin errores de estos módulos en la consola', mine.length === 0, mine.join(' | '));
    if (problems.length > 0) console.log(`(otros avisos de la página: ${problems.length})\n  ${problems.slice(0, 6).join('\n  ')}`);
} catch (error) {
    failures++;
    console.log(`FAIL  el recorrido se paró: ${String(/** @type {any} */ (error)?.stack || error).slice(0, 800)}`);
    if (page && SHOT) await page.screenshot({ path: `${SHOT}.error.png` }).catch(() => {});
} finally {
    await browser?.close().catch(() => {});
    server?.kill();
    try {
        rmSync(dataRoot, { recursive: true, force: true });
    } catch { /* el servidor aún lo tiene abierto */ }
}

console.log(failures === 0 ? '\nJ14.11 en el navegador: todo bien.' : `\n${failures} fallos.`);
process.exit(failures === 0 ? 0 : 1);
