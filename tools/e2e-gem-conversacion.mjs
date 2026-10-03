#!/usr/bin/env node
/**
 * Los Gems al día (2026-10-02): una campaña escrita con las instrucciones cortas nuevas del Gem
 * ([[GEM_CREAR_CAMPANA]], su muestra: `buildConversationSamplePack` de `gem-guide.js`) se pega en
 * «Añadir una campaña» y su primera escena se juega como una conversación de novela visual:
 *
 *   título → Jugar sin conexión → tu personaje → saltar la prueba → el tablón → pegar la muestra →
 *   «Añadida al tablón», lista para jugar → empezarla → la primera escena, sin narrador (D-J60):
 *   la gente hablando, cada uno con su placa y su retrato (o la
 *   silueta, si aún no está dibujado), con su cara. El farero sale como «El farero» hasta que la
 *   posadera le presenta (J13.7), y la decisión de la escena se elige.
 *
 * Contra un servidor propio con un `--dataRoot` temporal, como `e2e-campana-gem.mjs`.
 *
 * Uso:
 *   node tools/e2e-gem-conversacion.mjs --port 8480 --captura conv.png
 *   node tools/e2e-gem-conversacion.mjs --headed
 */

/* global window, document */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createBot, startOffline, runCampaign } from './vuelta-bot.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8480;
const BASE = `http://127.0.0.1:${PORT}`;
const HEADED = process.argv.includes('--headed');
const SHOT = argAfter('--captura');

const require = createRequire(join(ROOT, 'tests/package.json'));
const { chromium } = require('@playwright/test');

const { buildConversationSamplePack } = await import(pathToFileURL(join(ROOT, 'public/scripts/game-engine/campaign/gem-guide.js')).href);
const { importedCampaignId } = await import(pathToFileURL(join(ROOT, 'public/scripts/game-engine/campaign/campaign-import.js')).href);
const SAMPLE = buildConversationSamplePack();
const NAME = String(SAMPLE.world.name);
const ID = importedCampaignId(NAME);

let failures = 0;
const check = (/** @type {string} */ name, /** @type {boolean} */ ok, detail = '') => {
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        -> ${detail}` : ''}`);
};

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-gem-conv-'));
/** @type {any} */
let server = null;
/** @type {any} */
let browser = null;

function startServer() {
    server = spawn(process.execPath, ['server.js', '--browserLaunchEnabled', 'false', '--port', String(PORT), '--dataRoot', dataRoot], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    const child = server;
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('the server did not start in 240s')), 240000);
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
            window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,combat,travel,prisoners,mesa,high,spell,pet,bill,move,attack,roll,talk,journal');
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
            window.localStorage.setItem('sillytavern_gameSucesos', 'off');
        } catch { /* nada */ }
    });

    const chips = () => page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-chip-action')].map(c => (c.textContent || '').trim()));
    const until = async (/** @type {() => Promise<boolean>} */ test, ms = 30000) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (await test().catch(() => false)) return true;
            await page.waitForTimeout(400);
        }
        return false;
    };
    const world = () => page.evaluate(() => String(window.SillyTavern.getContext().chatMetadata?.world_info ?? ''));
    const clearDice = async () => {
        for (let i = 0; i < 30; i++) {
            const next = page.locator('.wm-dice-overlay.active .wm-dice-next');
            if (await next.count() === 0) break;
            await next.click({ timeout: 1500 }).catch(() => {});
            await page.waitForTimeout(250);
        }
    };
    /** La escena del hilo abierta: quién habla, qué dice, su retrato y su cara. */
    const story = () => page.evaluate(() => {
        const root = document.querySelector('dialog.ps-dialog[open] .ps-root');
        if (!root) return null;
        const portrait = /** @type {HTMLElement|null} */ (root.querySelector('.ps-portrait'));
        const img = /** @type {HTMLImageElement|null} */ (portrait?.querySelector('img') ?? null);
        return {
            id: root.getAttribute('data-scene') || '',
            plate: (root.querySelector('.qd-nameplate')?.textContent || '').trim(),
            plateShown: Boolean(root.querySelector('.qd-nameplate')) && /** @type {HTMLElement} */ (root.querySelector('.qd-nameplate')).offsetParent !== null && Boolean((root.querySelector('.qd-nameplate')?.textContent || '').trim()),
            text: (root.querySelector('.qd-text')?.textContent || '').replace(/\s+/g, ' ').trim(),
            narrator: root.classList.contains('ps-narrator'),
            portrait: portrait && !portrait.hidden ? (img ? `img:${img.getAttribute('src')}` : portrait.querySelector('.qd-silhouette') ? 'silueta' : 'vacío') : '',
            mood: portrait?.dataset.mood ?? '',
            options: [...root.querySelectorAll('.dw-option')].map(o => o.getAttribute('data-option') || (o.textContent || '').trim()),
        };
    });
    const settle = async () => {
        await clearDice();
        for (let i = 0; i < 6; i++) {
            const more = await page.evaluate(() => {
                const next = /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .gs-vn-box .gs-chip-continue'));
                if (next && next.offsetParent !== null) { next.click(); return true; }
                return false;
            });
            if (!more) break;
            await page.waitForTimeout(400);
        }
        await page.evaluate(() => document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));
    };

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 120000 });

    // 1. Al gremio: el prólogo del muelle a clics (como las vueltas), y la prueba saltada.
    const bot = createBot(page, { fast: true, log: () => {} });
    await startOffline(page, { name: 'Iria', gender: 'Mujer', race: 'Humano', klass: 'Clérigo' });
    await runCampaign(bot, {
        pack: JSON.parse(readFileSync(join(ROOT, 'public/mundos/gremio.pack.json'), 'utf8')),
        stop: (/** @type {any} */ now) => now.done.includes('la-prueba') || now.chips.includes('Saltar la prueba'),
        maxSteps: 250,
        log: () => {},
    });
    let v = await bot.observe();
    for (let i = 0; i < 60 && !v.done.includes('la-prueba'); i++) {
        v = await bot.observe();
        if (await bot.handleLayer(v)) continue;
        if (await bot.tapChip(v, /^Saltar la prueba$/, 'saltar la prueba', 'hub.js')) continue;
        // D-J62: con el modo guiado, «Saltar la prueba» está en la Casa del Gremio, fuera del tablero.
        if (v.board && !v.fight && await bot.tapChip(v, /^Salir del tablero$/, 'salir del tablero', 'action-chips.js')) continue;
        if (await bot.hallAct(v, 'hub-skip', 'saltar la prueba (en la Casa del Gremio)')) continue;
        if (v.scene === 'dialogue' && v.vn.next) await bot.act(v, '«Continuar»', () => bot.press(bot.chip(/^Continuar$/)));
    }
    // Hasta que se abre el tablón: se para ahí (`onHub`), sin elegir nada.
    const hubOpen = () => page.evaluate(() => Boolean(document.querySelector('dialog[open] .hb-root [data-campaign-add]')));
    for (let i = 0; i < 40 && !(await hubOpen()); i++) {
        v = await bot.observe();
        if (await bot.handleLayer(v, { onHub: async () => true })) continue;
        if (await bot.tapChip(v, /^Tablón de campañas$/, 'el tablón de campañas', 'action-chips.js')) continue;
        // D-J62: con el modo guiado, el tablón está en la Casa del Gremio.
        if (await bot.hallAct(v, 'hub-board', 'el tablón de campañas (en la Casa del Gremio)')) continue;
        if (v.scene === 'dialogue' && v.vn.next) await bot.act(v, '«Continuar»', () => bot.press(bot.chip(/^Continuar$/)));
        else if (v.town.inside) await bot.toMap(v);
    }
    const board = await hubOpen();
    if (!board && SHOT) await page.screenshot({ path: `${SHOT}.gremio.png` });
    check('en el gremio, con la prueba saltada y el tablón abierto', v.done.includes('la-prueba') && board, JSON.stringify({
        done: v.done, chips: await chips(), world: await world(),
    }));

    // 2. Pegar la muestra de las instrucciones cortas.
    await page.locator('.hb-root .hb-paste-open').click();
    await page.fill('.hb-root .hb-paste-text', JSON.stringify(SAMPLE, null, 2));
    await page.locator('.hb-root .hb-paste-add').click();
    const added = await until(() => page.evaluate((id) => Boolean(document.querySelector(`.hb-root [data-campaign="${id}"]`)), ID), 40000);
    const verdict = await page.evaluate(() => ({
        verdict: document.querySelector('.hb-root .hb-import .hb-check')?.getAttribute('data-verdict') ?? '',
        text: (document.querySelector('.hb-root .hb-import')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 600),
    }));
    check('la muestra de las instrucciones cortas entra en el tablón, lista para jugar', added && verdict.verdict === 'lista', JSON.stringify(verdict));
    if (SHOT) await page.screenshot({ path: `${SHOT}.tablon.png` });

    // 3. Empezarla: la primera escena, como conversación.
    await page.locator(`.hb-root [data-campaign="${ID}"]`).click();
    const started = await until(async () => (await world()).includes(NAME), 150000);
    check('empezarla abre su mundo', started, await world());
    await page.waitForTimeout(2000);
    await settle();
    const opened = await until(async () => {
        const now = await story();
        return Boolean(now && /Punta Gris|faro/.test(now.text + now.plate));
    }, 60000);
    /** @type {any[]} */
    const seen = [];
    let shot = false;
    for (let i = 0; i < 30 && opened; i++) {
        const now = await story();
        if (!now) break;
        if (!seen.length || seen[seen.length - 1].text !== now.text) seen.push(now);
        if (SHOT && !shot && now.plate && now.portrait) {
            await page.screenshot({ path: SHOT });
            shot = true;
        }
        if (now.options.length > 0) {
            // La decisión: ayudar sin cobrar.
            await page.locator('dialog.ps-dialog[open] .dw-option').first().click({ timeout: 4000 }).catch(() => {});
        } else {
            await page.locator('dialog.ps-dialog[open] .ps-next, dialog.ps-dialog[open] .ps-finish').first().click({ timeout: 4000 }).catch(() => {});
        }
        await page.waitForTimeout(300);
    }
    console.log(JSON.stringify(seen, null, 1).slice(0, 4000));
    check('la primera escena se abre al empezar', opened, JSON.stringify(seen.slice(0, 2)));
    const narrator = seen.filter(s => s.narrator);
    const scenes = [...new Set(seen.map(s => s.id))];
    // D-J60: la muestra ya no trae ni una línea del narrador.
    check('el narrador no dice nada: cada pantalla la dice alguien (D-J60)',
        scenes.length >= 1 && narrator.length === 0, JSON.stringify(narrator));
    check('Lía, que dice «Me llamo Lía», sale con su nombre desde esa línea (J13.7)',
        seen.some(s => /Me llamo Lía/.test(s.text) && /Lía Remos/.test(s.plate)) && seen.filter(s => s.id === 'faro' && !s.narrator).every(s => /Lía Remos/.test(s.plate)),
        JSON.stringify(seen.map(s => s.plate)));
    const talking = seen.filter(s => !s.narrator && s.plateShown);
    check('lo demás lo dice la gente, cada línea con su placa y su retrato', talking.length >= 4 && talking.every(s => s.portrait), JSON.stringify(talking.map(s => [s.plate, s.portrait])));
    check('la posadera sale con su retrato dibujado (el de su aspecto, con PixelLab); quien aún no lo tiene, con la silueta',
        talking.filter(s => /Marta/.test(s.plate)).every(s => /marta-salmuera\.png/.test(s.portrait))
        && talking.filter(s => !/Marta/.test(s.plate)).every(s => s.portrait === 'silueta' || /^img:/.test(s.portrait)),
        JSON.stringify(talking.map(s => [s.plate, s.portrait])));
    check('con su cara: la posadera sale triste al recibiros', talking.some(s => /Marta|posadera/i.test(s.plate) && s.mood === 'triste'), JSON.stringify(talking.map(s => [s.plate, s.mood])));
    const before = seen.findIndex(s => /me dejé echar/.test(s.text));
    const after = seen.findIndex(s => /ciento|Encienden su farol/.test(s.text));
    check('el farero sale como «El farero» hasta que la posadera le presenta, y luego con su nombre (J13.7)',
        before >= 0 && /farero/i.test(seen[before].plate) && !/Ezequiel/.test(seen[before].plate) && after > before && /Ezequiel/.test(seen[after]?.plate ?? ''),
        JSON.stringify(seen.map(s => s.plate)));
    check('la reacción a quien juega: a una clériga le habla de rezar (alt con class)', seen.some(s => /rezad por los de esas barcas/.test(s.text)), JSON.stringify(seen.map(s => s.text.slice(0, 60))));
    check('la decisión se elige y se oye la respuesta', seen.some(s => /Que la escalera os sea leve/.test(s.text)), JSON.stringify(seen.map(s => s.text.slice(0, 50))));
    check('sin errores en la página', problems.length === 0, problems.slice(0, 5).join(' | '));
} catch (error) {
    failures++;
    console.log(`FAIL  la prueba se ha roto: ${/** @type {any} */ (error)?.stack ?? error}`);
} finally {
    await browser?.close().catch(() => {});
    server?.kill();
    try { rmSync(dataRoot, { recursive: true, force: true }); } catch { /* nada */ }
}

console.log(failures === 0 ? '\nTODO BIEN' : `\n${failures} FALLO(S)`);
process.exit(failures === 0 ? 0 : 1);
