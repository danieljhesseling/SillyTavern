#!/usr/bin/env node
/**
 * ¿Se puede ganar esta campaña? Una partida entera jugada sola, en el navegador de verdad.
 *
 * Crea un gremio, hace un héroe, gana la prueba de la bodega, contrata mercenarios y empieza
 * la campaña del tablón. Luego juega **cada tablón que pide el hilo**, en orden: el grupo
 * juega sus turnos solo (como «Que actúe solo») y los enemigos, como siempre. Entre tablero y
 * tablero, un descanso largo. El grupo sube de nivel como subiría jugando.
 *
 * No viaja: salta de sitio en sitio. Lo que mide es si las peleas se pueden ganar con un
 * grupo como el que tendrías a esas alturas, no el camino.
 *
 * Uso:
 *   node tools/sim-campana.mjs                          # Strahd, un guerrero y dos mercenarios
 *   node tools/sim-campana.mjs --campana 1387 --clase Pícaro --mercenarios 1
 *   node tools/sim-campana.mjs --intentos 3 --headed --port 8129
 *   node tools/sim-campana.mjs --encargos               # y los tableros de los encargos, en su acto
 *   node tools/sim-campana.mjs --solo-encargos --nivel 4  # solo los encargos, con el héroe a nivel 4
 */

/* global window, document, HTMLElement */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';


/**
 * Elegir en una tarjeta de «Crear personaje», como quien juega: abrir su selector y pulsar
 * la opción que más se parece a lo pedido (sin acentos ni mayúsculas), o la primera.
 *
 * @param {any} page
 * @param {string} pick class | race | background
 * @param {string} [wanted]
 * @returns {Promise<string>} Lo elegido.
 */
async function pickHeroCard(page, pick, wanted = '') {
    await page.locator(`.hc-root .hc-card[data-pick="${pick}"] .hc-pick`).click();
    await page.waitForSelector('.hc-picker .hc-option', { timeout: 15000 });
    const plain = (/** @type {string} */ v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const values = await page.evaluate(() => [...document.querySelectorAll('.hc-picker .hc-option')].map(o => o.getAttribute('data-value') || ''));
    // Igual, o que lo contenga, o que empiece igual («Picara» es la Pícaro del compendio), o la primera.
    const chosen = values.find(v => plain(v) === plain(wanted)) ?? values.find(v => wanted && plain(v).includes(plain(wanted)))
        ?? values.find(v => wanted.length >= 4 && plain(v).startsWith(plain(wanted).slice(0, 4))) ?? values[0];
    await page.locator(`.hc-picker .hc-option[data-value="${chosen}"]`).first().click();
    await page.waitForSelector('.hc-picker', { state: 'detached', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(200);
    return chosen;
}

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag, fallback = '') => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : fallback);
const PORT = Number(argAfter('--port')) || 8129;
const BASE = `http://127.0.0.1:${PORT}`;
const HEADED = process.argv.includes('--headed');
const CAMPAIGN = argAfter('--campana', 'strahd');
const CLASS = argAfter('--clase', 'Guerrero');
const MERCS = Math.max(0, Math.min(3, Number(argAfter('--mercenarios', '2'))));
const TRIES = Math.max(1, Number(argAfter('--intentos', '2')));
// Con --encargos se juegan también los tableros de los encargos escritos, cada uno detrás de
// los hitos de su acto: así se pelean con el nivel que se tendría a esas alturas.
const ONLY_CONTRACTS = process.argv.includes('--solo-encargos');
const CONTRACTS = ONLY_CONTRACTS || process.argv.includes('--encargos');
// Con --nivel, el héroe empieza en ese nivel (lo que da la experiencia de D&D), para probar
// un tramo sin jugar lo de antes.
const START_LEVEL = Math.max(1, Math.min(20, Number(argAfter('--nivel', '1')) || 1));
// Con --tableros «a,b», solo esos (por el principio de su nombre).
const ONLY_BOARDS = argAfter('--tableros', '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const XP_FOR = [0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000];
const MAX_ROUNDS = 30;

const require = createRequire(join(ROOT, 'tests/package.json'));
const { chromium } = require('@playwright/test');

const dataRoot = mkdtempSync(join(tmpdir(), 'st-sim-'));
/** @type {any} */
let server = null;
/** @type {any} */
let browser = null;
let broken = false;

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
        child.on('exit', (/** @type {number} */ code) => reject(new Error(`the server exited with code ${code}`)));
    });
}

try {
    await startServer();
    browser = await chromium.launch({ channel: 'msedge', headless: !HEADED });
    const context = await browser.newContext({ viewport: { width: 1400, height: 950 } });
    const page = await context.newPage();
    await context.addInitScript(() => {
        try {
            window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,combat,travel,prisoners,mesa,high,spell,pet,bill,move,attack,roll,talk,journal');
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
            window.localStorage.setItem('sillytavern_gameSucesos', 'off');
            // Las escenas del hilo y las charlas escritas (J9.2, J8) las mira e2e-historia; aquí taparían clics.
            window.localStorage.setItem('sillytavern_gameStoryWindows', 'off');
        } catch { /* nada */ }
    });

    /** Un comando, sin esperar a que acabe: alguno abre una ventana y se quedaría esperando. */
    const slash = async (/** @type {string} */ command) => {
        await page.evaluate((c) => {
            void window.SillyTavern.getContext().executeSlashCommandsWithOptions(c).catch(() => '');
        }, command);
        await page.waitForTimeout(900);
    };
    const until = async (/** @type {() => Promise<boolean>} */ test, ms = 30000) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (await test().catch(() => false)) return true;
            await page.waitForTimeout(300);
        }
        return false;
    };
    const party = () => page.evaluate(async () => (await import('/scripts/party.js')).getPartyMembersSnapshot()
        .map((/** @type {any} */ m) => ({ name: m.name, level: Number(m.level) || 1, hp: Number(m.hp) || 0, maxHp: Number(m.maxHp) || 0, dead: Boolean(m.dead), guest: Boolean(m.guest), xp: Number(m.xp) || 0 })));
    // El combate vivo, no el guardado en el chat: ese va con retraso y daba peleas por acabadas.
    const fighting = () => page.evaluate(async () => Boolean((await import('/scripts/party.js')).getCombatEncounter()?.active));
    const chips = () => page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-chip-action')].map(c => (c.textContent || '').trim()));
    const clickChip = (/** @type {RegExp} */ pattern) => page.evaluate((source) => {
        const chip = [...document.querySelectorAll('#game-shell .gs-chip-action')].find(b => new RegExp(source).test(b.textContent || ''));
        if (chip instanceof HTMLElement) chip.click();
        return Boolean(chip);
    }, pattern.source);
    /** Cierra lo que se abra solo (subir de nivel, un botín, una rendición): lo de por defecto. */
    const closePopups = async () => {
        for (let i = 0; i < 6; i++) {
            const open = await page.locator('dialog[open] .popup-button-ok, dialog[open] .popup-controls .menu_button').filter({ visible: true }).first();
            if (await open.count() === 0) return;
            await open.click({ timeout: 2000 }).catch(() => {});
            await page.waitForTimeout(300);
        }
    };

    /**
     * Juega la pelea que espera en el tablero abierto, entera.
     *
     * @returns {Promise<{result: string, rounds: number}>}
     */
    const playFight = async () => {
        const chatBefore = await page.evaluate(() => (window.SillyTavern.getContext().chat ?? []).length).catch(() => 0);
        const offer = () => until(async () => (await chips()).some(c => /^Iniciar combate/.test(c)), 6000);
        let offered = await offer();
        // Lo que duerme tras una puerta (el engendro del Sótano) se despierta abriéndola,
        // como haría quien juega yendo a por ello.
        if (!offered) {
            await page.evaluate(async () => (await import('/scripts/party.js')).openBoardDoorsForSimulation?.() ?? 0);
            await page.waitForTimeout(1000);
            await closePopups();
            if (!await fighting()) offered = await offer();
            if (!offered && !await fighting()) return { result: 'sin pelea', rounds: 0 };
        }
        if (offered) {
            await clickChip(/^Iniciar combate/);
            await until(fighting, 10000);
        }
        // J4.6: si el tablero se ajusta al nivel del grupo, lo que dice y con qué vida sale cada uno.
        const adjusted = await page.evaluate(async (from) => {
            const fight = /** @type {any} */ ((await import('/scripts/party.js')).getCombatEncounter());
            const said = (window.SillyTavern.getContext().chat ?? []).slice(from).map((/** @type {any} */ m) => String(m?.mes ?? ''))
                .filter(text => text.includes('⚖️'));
            const foes = (fight?.enemies ?? []).map((/** @type {any} */ e) => `${e.name} ${e.maxHp}pg${e.levelSteps ? ` (${e.levelSteps > 0 ? '+' : ''}${e.levelSteps})` : ''}`);
            return { said, foes };
        }, chatBefore).catch(() => ({ said: [], foes: [] }));
        for (const line of adjusted.said) console.log(`  ${line}`);
        if (adjusted.foes.length > 0) console.log(`  enemigos: ${adjusted.foes.join(', ')}`);
        let rounds = 0;
        for (let step = 0; step < 600 && await fighting(); step++) {
            rounds = await page.evaluate(async () => Number((await import('/scripts/party.js')).getCombatEncounter()?.round) || 0);
            if (rounds > MAX_ROUNDS) {
                // Quién queda en pie y dónde: para ver si es un tablero que no se puede acabar.
                const left = await page.evaluate(async () => {
                    const fight = /** @type {any} */ ((await import('/scripts/party.js')).getCombatEncounter());
                    return [...(fight?.enemies ?? []), ...(fight?.allies ?? [])]
                        .filter(c => Number(c?.currentHp ?? c?.hp ?? 1) > 0)
                        .map(c => `${c.name} ${c.currentHp ?? c.hp ?? '?'}pg (${c.x ?? c.position?.x},${c.y ?? c.position?.y})`);
                });
                console.log(`  sin acabar tras ${MAX_ROUNDS} rondas; en pie: ${left.join(' · ')}`);
                await slash('/combat-stop');
                return { result: 'no acaba', rounds };
            }
            await page.evaluate(async () => (await import('/scripts/party.js')).playCurrentTurnAlone());
            await page.waitForTimeout(120);
            if (step % 10 === 0) await closePopups();
        }
        await page.waitForTimeout(800);
        await closePopups();
        // Ganada es ganada en el juego: el tablero queda apuntado como ganado. Leer el chat
        // confundía la victoria de la pelea anterior con esta.
        const won = await page.evaluate(() => {
            const meta = window.SillyTavern.getContext().chatMetadata;
            return Array.isArray(meta?.boardsWon) && meta.boardsWon.includes(`${meta.currentLocation}::${meta.currentBoard}`);
        });
        return { result: won ? 'gana' : 'pierde', rounds };
    };

    /**
     * Después de cada pelea: subir de nivel si toca (como desde la ficha, con lo de por
     * defecto) y el descanso largo, sin esperar al día ni emboscadas.
     */
    const restore = async () => {
        const up = await page.evaluate(async () => (await import('/scripts/party.js')).levelUpForSimulation?.() ?? []);
        if (up.length > 0) console.log(`  sube de nivel: ${up.join(', ')}`);
        // Como quien vuelve al gremio de vez en cuando: los mercenarios entrenan.
        await page.evaluate(async () => (await import('/scripts/party.js')).trainMercenariesForSimulation?.());
        await page.evaluate(async () => (await import('/scripts/party.js')).restPartyForSimulation());
    };

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    const firstRun = page.locator('text=Welcome to SillyTavern!');
    if (await firstRun.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) await page.click('.popup-button-ok');
    await page.waitForSelector('#game-shell', { timeout: 90000 });
    const offline = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Jugar sin conexión' });
    await until(async () => await offline.count() === 1, 30000);
    await offline.click();
    await page.waitForSelector('.hc-root', { timeout: 120000 });
    await page.fill('.hc-root .hc-name', 'Prueba');
    await pickHeroCard(page, 'race', 'Humano');
    await pickHeroCard(page, 'class', CLASS);
    await page.locator('.hc-root .hc-enter').click();
    await until(async () => (await party()).length === 1, 60000);
    await page.waitForTimeout(1500);

    /** @type {Array<{board: string, tries: number, result: string, rounds: number, party: string}>} */
    const rows = [];
    const line = async () => (await party()).map(m => `${m.name.split(' ')[0]} n${m.level} ${m.dead ? '†' : `${m.hp}/${m.maxHp}`}`).join(', ');

    console.log('héroe hecho; la bodega…');
    const bodega = await playFight();
    console.log(`bodega: ${bodega.result} en ${bodega.rounds} rondas`);
    rows.push({ board: 'La bodega del gremio (gremio)', tries: 1, result: bodega.result, rounds: bodega.rounds, party: await line() });
    await slash('/leave');
    await restore();
    for (let i = 0; i < MERCS; i++) {
        await slash('/contratar');
        await page.waitForSelector('.hb-root [data-hireling]', { timeout: 15000 });
        const pick = page.locator('.hb-root [data-hireling]:not(.is-hired):not(.is-off)').first();
        if (await pick.count() === 0) {
            await page.locator('.hb-root .hb-close').click();
            break;
        }
        await pick.click();
        await page.waitForTimeout(800);
    }

    await slash('/campanas');
    await page.waitForSelector(`.hb-root [data-campaign="${CAMPAIGN}"]`, { timeout: 15000 });
    await page.locator(`.hb-root [data-campaign="${CAMPAIGN}"]`).click();
    await until(async () => !/Gremio/.test(await page.evaluate(() => String(window.SillyTavern.getContext().chatMetadata?.world_info || ''))), 120000);
    await page.waitForTimeout(2000);

    // Los tableros que pide el hilo, en orden; y con --encargos, los de los encargos detrás
    // de los hitos de su acto.
    const plan = await page.evaluate(async (withContracts) => {
        const ctx = window.SillyTavern.getContext();
        const data = await (await import('/scripts/world-info.js')).loadWorldInfo(String(ctx.chatMetadata?.world_info || ''));
        const where = new Map();
        /** @type {Map<string, number>} */
        const actOf = new Map();
        for (const place of [...(data?.metadata?.locationMaps ?? []), ...(data?.metadata?.hiddenLocations ?? [])]) {
            for (const board of place.boards ?? []) {
                where.set(board.name, place.name);
                const act = Math.max(0, ...(board.quests ?? []).map((/** @type {any} */ q) => Number(q.act) || 0));
                if (act) actOf.set(board.name, act);
            }
        }
        const steps = (data?.metadata?.plot?.milestones ?? [])
            .filter((/** @type {any} */ m) => m.asks?.kind === 'win' && where.has(m.asks.board))
            .map((/** @type {any} */ m, /** @type {number} */ i) => ({ board: String(m.asks.board), place: String(where.get(m.asks.board)), act: Number(m.act) || 1, order: i, from: 'hilo' }));
        if (withContracts) {
            const taken = new Set(steps.map(s => s.board));
            for (const c of data?.metadata?.writtenContracts ?? []) {
                const board = String(c.boardName || '');
                if (!board || taken.has(board) || !where.has(board)) continue;
                taken.add(board);
                steps.push({ board, place: String(where.get(board)), act: actOf.get(board) ?? Number(c.act) ?? 1, order: 1000 + steps.length, from: 'encargo' });
            }
        }
        return steps.sort((a, b) => a.act - b.act || a.order - b.order);
    }, CONTRACTS);
    if (ONLY_CONTRACTS) plan.splice(0, plan.length, ...plan.filter(step => step.from === 'encargo'));
    if (ONLY_BOARDS.length > 0) plan.splice(0, plan.length, ...plan.filter(step => ONLY_BOARDS.some(b => step.board.toLowerCase().startsWith(b))));
    if (START_LEVEL > 1) {
        await page.evaluate(async ({ xp, times }) => {
            const party = await import('/scripts/party.js');
            party.grantXpForSimulation(xp);
            for (let i = 0; i < times; i++) await party.levelUpForSimulation();
            party.trainMercenariesForSimulation();
        }, { xp: XP_FOR[Math.min(START_LEVEL, XP_FOR.length - 1)], times: START_LEVEL - 1 });
        console.log(`  empieza a nivel ${START_LEVEL}: ${await line()}`);
    }

    for (const step of plan) {
        let outcome = { result: '', rounds: 0 };
        let tries = 0;
        for (; tries < TRIES && outcome.result !== 'gana'; tries++) {
            await page.evaluate(async ({ place, board }) => {
                const party = await import('/scripts/party.js');
                // Si el sitio sigue escondido (se juega un tramo suelto), se pone en el mapa.
                await party.revealLocationsForSimulation([place]);
                party.enterStartingBoard(place, board);
            }, step);
            await slash('/leave');
            await slash(`/enter ${step.board}`);
            await page.waitForTimeout(800);
            outcome = await playFight();
            await slash('/leave');
            // Entre peleas, a dormir: y quien cayó del grupo se levanta, que esto mide las
            // peleas, no la mala suerte de la anterior.
            await restore();
            await closePopups();
        }
        const label = step.from === 'encargo' ? `${step.board} (${step.place}, encargo)` : `${step.board} (${step.place})`;
        rows.push({ board: label, tries, result: outcome.result, rounds: outcome.rounds, party: await line() });
        console.log(`${outcome.result.padEnd(9)} ${label} · ${tries} intento(s) · ${outcome.rounds} rondas · ${await line()}`);
        if (outcome.result !== 'gana') broken = true;
    }

    console.log('\nTablero | Intentos | Resultado | Rondas | El grupo al acabar');
    for (const row of rows) console.log(`${row.board} | ${row.tries} | ${row.result} | ${row.rounds} | ${row.party}`);
} catch (error) {
    broken = true;
    console.log(`La simulación se rompió: ${/** @type {any} */ (error)?.message || error}`);
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
process.exit(broken ? 1 : 0);
