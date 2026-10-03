#!/usr/bin/env node
/**
 * Tanda 17, «que el combate se sienta» (Daniel, 2026-10-02: «cuando le doy a ataque, las tiradas y
 * el daño se hacen y aplican antes de que termine la animación… quiero una animación cuando
 * ataquen, así como una animación de dado»), en un navegador de verdad contra un servidor propio
 * con un `--dataRoot` temporal:
 *
 *   título → Jugar sin conexión → Nerea, guerrera → la pelea del muelle (el ratero) →
 *   A. Nerea ataca con un 20 natural: se lanza, el d20 rueda y se para en oro («¡crítico!»), el
 *      daño sube de la ficha y solo entonces baja la vida; el panel de victoria y la novela, al
 *      acabar (antes, la pelea se acababa antes de que saliera la tirada).
 *   B. Dos bandidos a unas casillas: un 1 natural (la grieta roja, «pifia: falla», «Falla»).
 *   C. Su turno: el cartel de cada uno, el que estaba lejos anda hasta Nerea antes de pegar, su
 *      d20 en rojo, el golpe y la vida de Nerea que baja después; al acabar, «Tu turno» y el
 *      tablero no vuelve a andar lo andado.
 *   D. «Pasar» enseña lo que queda de golpe.
 *   E. Ganar con «/combat-end» (como e2e-combate) saca el panel en cuanto acaba la secuencia.
 *
 * Lo que se mira va con una línea de tiempo tomada en la página (cada 40 ms): qué se ve y en qué
 * orden, no solo cómo acaba. La secuencia va a su ritmo de verdad (`sillytavern_gameCombatPace`:
 * `normal`); las demás vueltas de prueba la llevan al momento.
 *
 * Uso:
 *   node tools/e2e-sensacion.mjs                                   # 1280×720, puerto 8510
 *   node tools/e2e-sensacion.mjs --movil                           # 390×844, a toques
 *   node tools/e2e-sensacion.mjs --quieto                          # «reducir movimiento»: casi al momento
 *   node tools/e2e-sensacion.mjs --port 8510 --captura sens.png    # sens-a-1100.png, sens-c-…
 */

/* global window, document, HTMLElement */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { entrarEnLaPelea } from './e2e-entrar-pelea.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8510;
const BASE = `http://127.0.0.1:${PORT}`;
const SHOT = argAfter('--captura');
const MOVIL = process.argv.includes('--movil');
const QUIETO = process.argv.includes('--quieto');

const require = createRequire(join(ROOT, 'tests/package.json'));
const { chromium } = require('@playwright/test');

let failures = 0;
const check = (/** @type {string} */ name, /** @type {boolean} */ ok, detail = '') => {
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        -> ${detail}` : ''}`);
};

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-sensacion-'));
/** @type {any} */
let server = null;
/** @type {any} */
let browser = null;

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
 * @param {any} target
 * @param {string} pick
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

/**
 * @typedef {Object} Sample Lo que se ve en un momento de la secuencia.
 * @property {number} t
 * @property {boolean} busy
 * @property {boolean} rolling
 * @property {string} face
 * @property {boolean} nat20
 * @property {boolean} nat1
 * @property {boolean} enemyDie
 * @property {string} line
 * @property {string} dmg
 * @property {string[]} floats
 * @property {Record<string, string>} hp
 * @property {string} banner
 * @property {string} scene
 * @property {boolean} victory
 * @property {string[]} moved Fichas con una animación en marcha (andar, lanzarse).
 */

try {
    await startServer();
    browser = await chromium.launch({ channel: 'msedge', headless: !process.argv.includes('--headed') });
    const viewport = MOVIL ? { width: 390, height: 844 } : { width: 1280, height: 720 };
    const context = await browser.newContext({
        viewport,
        ...(MOVIL ? { hasTouch: true, isMobile: true } : {}),
        ...(QUIETO ? { reducedMotion: /** @type {'reduce'} */ ('reduce') } : {}),
    });
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
            window.localStorage.setItem('sillytavern_gameStoryWindows', 'off');
            // La secuencia del combate a su ritmo de verdad (las demás pruebas la llevan al momento).
            window.localStorage.setItem('sillytavern_gameCombatPace', 'normal');
        } catch { /* nada */ }
    });

    const until = async (/** @type {() => Promise<boolean>} */ test, ms = 30000) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (await test().catch(() => false)) return true;
            await page.waitForTimeout(200);
        }
        return false;
    };
    const fighting = () => page.evaluate(() => Boolean(window.SillyTavern.getContext().chatMetadata?.combatEncounter?.active));
    const busy = () => page.evaluate(() => document.documentElement.dataset.vfxBusy === 'true');
    const dropToasts = () => page.evaluate(() => document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));
    const clearDice = async () => {
        for (let i = 0; i < 40; i++) {
            const next = page.locator('.wm-dice-overlay.active .wm-dice-next');
            if (await next.count() === 0) break;
            if (!await next.click({ timeout: 1500 }).then(() => true).catch(() => false)) break;
            await page.waitForTimeout(200);
        }
    };
    const turn = () => page.evaluate(async () => {
        const party = await import('/scripts/party/state.js');
        const cs = await import('/scripts/party/combat-state.js');
        const enc = /** @type {any} */ (party.combatEncounter);
        const entry = cs.getCurrentTurnEntry();
        const hero = /** @type {any} */ (party.partyMembers[0]);
        return {
            mine: Boolean(entry && !entry.isEnemy && String(entry.id) === String(hero?.id)),
            fighting: Boolean(enc.active),
            heroId: String(hero?.id ?? ''),
            enemies: enc.enemies.map((/** @type {any} */ e) => ({ id: String(e.instanceId), hp: Number(e.currentHp) })),
        };
    });
    let shots = 0;
    const shoot = async (/** @type {string} */ what) => {
        if (!SHOT) return;
        shots += 1;
        const file = `${SHOT.replace(/\.png$/i, '')}-${what}.png`;
        await page.screenshot({ path: file });
        console.log(`      captura ${shots} (${what}): ${file}`);
    };
    /** Capturas a lo largo de una secuencia, cada una a su tiempo desde ya. */
    const shootAlong = async (/** @type {string} */ tag, /** @type {number[]} */ times) => {
        const t0 = Date.now();
        for (const ms of times) {
            const left = ms - (Date.now() - t0);
            if (left > 0) await page.waitForTimeout(left);
            await shoot(`${tag}-${String(ms).padStart(4, '0')}`);
        }
    };
    /** Empieza a tomar la línea de tiempo en la página (cada 40 ms). */
    const startTimeline = () => page.evaluate(() => {
        const w = /** @type {any} */ (window);
        clearInterval(w.__vfxTimer);
        const t0 = performance.now();
        /** @type {any[]} */
        const samples = [];
        w.__vfxSamples = samples;
        const take = () => {
            const card = document.querySelector('.vfx-card');
            const die = card?.querySelector('.vfx-die:not(.vfx-die-dropped)') ?? card?.querySelector('.vfx-die');
            /** @type {Record<string, string>} */
            const hp = {};
            for (const row of document.querySelectorAll('.wm-init-row')) hp[String(row.getAttribute('data-entry-id'))] = (row.querySelector('.wm-init-hp-text')?.textContent || '').trim();
            samples.push({
                t: Math.round(performance.now() - t0),
                busy: document.documentElement.dataset.vfxBusy === 'true',
                rolling: Boolean(card?.querySelector('.vfx-die-rolling')),
                face: (die?.querySelector('.vfx-die-face')?.textContent || '').trim(),
                nat20: Boolean(die?.classList.contains('vfx-die-nat20')),
                nat1: Boolean(die?.classList.contains('vfx-die-nat1')),
                enemyDie: Boolean(die?.classList.contains('vfx-die-enemy')),
                line: (card?.querySelector('.vfx-roll-line')?.textContent || '').trim(),
                dmg: (card?.querySelector('.vfx-dmg-line')?.textContent || '').trim(),
                floats: [...document.querySelectorAll('.wm-token .wm-float')].map(f => `${f.closest('.wm-token')?.getAttribute('data-token-id')}:${(f.textContent || '').trim()}`),
                hp,
                banner: (document.querySelector('.vtt-turn-banner, .vfx-banner')?.textContent || '').trim(),
                scene: document.querySelector('#game-shell')?.getAttribute('data-scene') || '',
                // J12.21: la pantalla de victoria de verdad (la escondida, `.vo-pending`, solo hace esperar).
                victory: Boolean(document.querySelector('.vs-card.vo-layer')),
                moved: [...document.querySelectorAll('.wm-token')].filter(t => t.getAnimations().some(a => a.playState === 'running')).map(t => String(t.getAttribute('data-token-id'))),
            });
        };
        take();
        w.__vfxTimer = setInterval(take, 40);
    });
    /** Para la línea de tiempo y la devuelve. @returns {Promise<Sample[]>} */
    const stopTimeline = () => page.evaluate(() => {
        const w = /** @type {any} */ (window);
        clearInterval(w.__vfxTimer);
        return w.__vfxSamples ?? [];
    });
    /** El primer momento en que pasa algo, o -1. */
    const firstAt = (/** @type {Sample[]} */ line, /** @type {(s: Sample) => boolean} */ test) => line.find(test)?.t ?? -1;
    /** Cuándo acaba la secuencia: lo primero sin secuencia después de haberla. */
    const endOf = (/** @type {Sample[]} */ line) => {
        const from = line.findIndex(s => s.busy);
        return from < 0 ? -1 : (line.slice(from).find(s => !s.busy)?.t ?? -1);
    };
    /** Atacar desde el menú de Atacar, con el dado fijado (`die`: lo que sale, en [0, 1)). */
    const attackWith = async (/** @type {number} */ die) => {
        await page.locator('#game-shell .gs-vtt-bar .gs-btn[data-menu="atacar"]').click({ timeout: 5000 });
        await page.waitForSelector('#game-shell .gs-grimoire[data-menu="atacar"]', { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(300);
        const pick = await page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-grimoire [data-pick]')]
            .map(c => ({ pick: String(c.getAttribute('data-pick')), off: /** @type {HTMLButtonElement} */ (c).disabled }))
            .find(c => /^attack:/.test(c.pick) && !c.off)?.pick ?? '');
        if (!pick) return '';
        await page.evaluate(async (/** @type {number} */ d) => (await import('/scripts/party/combat-rules.js')).setRandomSource(() => d), die);
        await startTimeline();
        await page.locator(`#game-shell .gs-grimoire [data-pick="${pick}"]`).first().click({ timeout: 5000 });
        await page.evaluate(async () => (await import('/scripts/party/combat-rules.js')).setRandomSource(null));
        return pick;
    };

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    const firstRun = page.locator('text=Welcome to SillyTavern!');
    if (await firstRun.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#game-shell', { timeout: 120000 });
    const offline = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Jugar sin conexión' });
    await until(async () => await offline.count() === 1, 60000);
    await offline.click();
    await page.waitForSelector('.hc-root', { timeout: 120000 });
    await page.fill('.hc-root .hc-name', 'Nerea');
    await pickHeroCard(page, 'race', 'Humano');
    await pickHeroCard(page, 'class', 'Guerrero');
    await page.locator('.hc-root .hc-enter').click();
    check('empieza en el gremio, con Nerea', await until(() => page.evaluate(async () => (await import('/scripts/party.js')).getPartyMembersSnapshot().length === 1), 90000));

    // La pelea del muelle, como quien juega.
    await page.evaluate(async () => {
        const { partyMembers } = await import('/scripts/party/state.js');
        /** @type {any} */ (partyMembers[0]).strength = 18;
    });
    await dropToasts();
    await entrarEnLaPelea(page, { ms: 90000 });
    check('la pelea del muelle empieza', await until(fighting, 20000));
    await until(async () => { await clearDice(); await dropToasts(); const t = await turn(); return t.mine || !t.fighting; }, 60000);
    await until(async () => !(await busy()), 15000);
    await page.waitForTimeout(800);

    // ---- A. Un 20 natural que tumba al ratero: el orden de todo, y el final después.
    await page.evaluate(async () => {
        const { handlePlayerCombatMove } = await import('/scripts/party/player-actions.js');
        const { partyMembers, combatEncounter } = await import('/scripts/party/state.js');
        const hero = /** @type {any} */ (partyMembers[0]);
        const hx = Number(hero.mapPosition?.gridX) || 0;
        const hy = Number(hero.mapPosition?.gridY) || 0;
        const target = /** @type {any} */ (combatEncounter.enemies.find((/** @type {any} */ e) => e.currentHp > 0));
        if (!target || Math.max(Math.abs(target.gridX - hx), Math.abs(target.gridY - hy)) <= 1) return;
        const options = [-1, 0, 1].flatMap(dx => [-1, 0, 1].map(dy => ({ x: target.gridX + dx, y: target.gridY + dy })))
            .filter(c => !(c.x === target.gridX && c.y === target.gridY))
            .sort((a, b) => Math.max(Math.abs(a.x - hx), Math.abs(a.y - hy)) - Math.max(Math.abs(b.x - hx), Math.abs(b.y - hy)));
        for (const cell of options) if (handlePlayerCombatMove(`${cell.x + 1} ${cell.y + 1}`)) return;
    });
    await page.waitForTimeout(1600);
    await dropToasts();
    const ratId = (await turn()).enemies[0]?.id ?? '';
    const pickA = await attackWith(0.99);
    check('A: Nerea tiene al ratero a su alcance', Boolean(pickA), pickA);
    if (pickA) {
        await shootAlong('a', QUIETO ? [150, 700] : [120, 500, 1300, 2300, 2900]);
        await until(async () => !(await busy()), 15000);
        await page.waitForTimeout(600);
        const line = await stopTimeline();
        await shoot('a-final');
        const lineAt = firstAt(line, s => /¡crítico!/.test(s.line));
        const floatAt = firstAt(line, s => s.floats.some(f => /:-\d+/.test(f)));
        const hpAt = firstAt(line, s => s.hp[ratId] === '0/5');
        const endAt = endOf(line);
        const victoryAt = firstAt(line, s => s.victory);
        const novelAt = firstAt(line, s => s.scene !== 'combat');
        if (!QUIETO) {
            check('A: el d20 rueda (cambia de número) antes de pararse', line.some(s => s.rolling) && new Set(line.filter(s => s.rolling).map(s => s.face)).size > 2,
                JSON.stringify([...new Set(line.filter(s => s.rolling).map(s => s.face))]));
            // Tanda 21: quieta mientras rueda el dado; se lanza una vez, cuando ya ha salido.
            const lungeAt = firstAt(line, s => s.moved.length > 0);
            check('A: Nerea se queda quieta mientras rueda el dado y se lanza contra el ratero después', lungeAt >= 0 && lungeAt > firstAt(line, s => s.face !== '') && !line.some(s => s.rolling && s.moved.length > 0),
                JSON.stringify({ lunge: lungeAt, die: firstAt(line, s => s.face !== '') }));
        }
        check('A: se para en 20, en oro, y lo dice llano: «20 + 4 = 24 contra CA 11: ¡crítico!»', lineAt >= 0 && line.some(s => s.nat20 && s.face === '20'),
            (line.find(s => s.line)?.line ?? '') + ' | ' + (line.find(s => s.dmg)?.dmg ?? ''));
        check('A: el daño sube de la ficha después de la tirada, y la vida baja después del golpe', lineAt >= 0 && floatAt > lineAt && hpAt >= floatAt,
            JSON.stringify({ lineAt, floatAt, hpAt }));
        check('A: la pelea acaba después: ni panel de victoria ni novela hasta que se ha visto todo', victoryAt > lineAt && novelAt >= endAt && endAt > hpAt,
            JSON.stringify({ hpAt, endAt, victoryAt, novelAt }));
        if (QUIETO) {
            check('A, con «reducir movimiento»: el dado no rueda y todo pasa casi al momento', !line.some(s => s.rolling) && endAt > 0 && endAt < 2500, JSON.stringify({ endAt }));
        }
    }
    await page.evaluate(() => document.querySelectorAll('.vs-card').forEach(c => c.remove()));
    await dropToasts();

    // ---- B. Dos bandidos: uno pegado y otro a cuatro casillas. Un 1 natural de Nerea.
    await page.evaluate(async () => {
        const flow = await import('/scripts/party/combat-flow.js');
        flow.startCombat(/** @type {any} */ ({ id: 'bandido', name: 'Bandido', maxHp: 40, armorClass: 12, cr: 1, attackRangeFeet: 5, strength: 14, dexterity: 10, constitution: 12, profile: 'agresivo' }), 2, 12, 12);
    });
    check('B: la pelea con los bandidos empieza', await until(fighting, 15000));
    await page.waitForTimeout(500);
    await clearDice();
    await until(async () => { await clearDice(); return !(await busy()); }, 30000);
    const far = await page.evaluate(async () => {
        const { partyMembers, combatEncounter } = await import('/scripts/party/state.js');
        const enc = /** @type {any} */ (combatEncounter);
        const hero = /** @type {any} */ (partyMembers[0]);
        const hx = Number(hero.mapPosition?.gridX) || 0;
        const hy = Number(hero.mapPosition?.gridY) || 0;
        const [a, b] = enc.enemies;
        Object.assign(a, { gridX: hx + 1, gridY: hy });
        Object.assign(b, { gridX: hx + 4, gridY: hy + 1 > 10 ? hy - 1 : hy + 1 });
        enc.currentTurnIndex = enc.turnOrder.findIndex((/** @type {any} */ e) => !e.isEnemy && String(e.id) === String(hero.id));
        enc.turnState = { actorId: String(hero.id), isEnemy: false, movementSpentFeet: 0, actionUsed: false, bonusActionUsed: false, reactionUsed: false };
        (await import('/scripts/party/board-view.js')).renderLocationMapsPreview();
        return { id: String(b.instanceId), token: -2, from: { x: b.gridX, y: b.gridY } };
    });
    await page.waitForTimeout(1500);
    await dropToasts();
    const pickB = await attackWith(0.0);
    check('B: Nerea ataca al bandido de al lado', Boolean(pickB), pickB);
    if (pickB) {
        await shootAlong('b', QUIETO ? [300] : [1300, 2000]);
        await until(async () => !(await busy()), 10000);
        const line = await stopTimeline();
        const fumbleAt = firstAt(line, s => /pifia: falla/.test(s.line));
        // J12.19: el fallo se dice «¡Falla!».
        const missAt = firstAt(line, s => s.floats.some(f => /:¡?Falla!?$/.test(f)));
        check('B: un 1 natural: el dado se agrieta en rojo y dice «pifia: falla»; luego, «Falla» en el bandido',
            line.some(s => s.nat1 && s.face === '1') && fumbleAt >= 0 && missAt > fumbleAt, JSON.stringify({ fumbleAt, missAt, line: line.find(s => s.line)?.line }));
    }
    await page.waitForTimeout(400);
    await dropToasts();

    // ---- C. El turno de los bandidos: cartel, andar, su d20, el golpe y la vida de Nerea.
    if (await fighting()) {
        const heroId = (await turn()).heroId;
        await page.evaluate(async () => (await import('/scripts/party/combat-rules.js')).setRandomSource(() => 0.7));
        await startTimeline();
        await page.evaluate(() => {
            const end = document.querySelector('#game-shell .gs-vtt-bar .gs-btn-end');
            if (end instanceof HTMLElement) end.click();
        });
        await page.evaluate(async () => (await import('/scripts/party/combat-rules.js')).setRandomSource(null));
        await page.locator('.popup-button-ok:visible').first().click({ timeout: 800 }).catch(() => {});
        await shootAlong('c', QUIETO ? [300, 900] : [400, 1500, 2600, 4200, 5600]);
        let walkingAfter = -1;
        await until(async () => {
            const now = await page.evaluate(() => ({ busy: document.documentElement.dataset.vfxBusy === 'true', walking: document.querySelectorAll('.wm-token.wm-token-walking').length }));
            if (!now.busy) walkingAfter = now.walking;
            return !now.busy;
        }, 30000);
        await page.waitForTimeout(900);
        const line = await stopTimeline();
        await shoot('c-final');
        const hpStart = line[0]?.hp[heroId] ?? '';
        const firstBanner = firstAt(line, s => /^Turno del bandido [12]$/i.test(s.banner));
        const secondBanner = firstAt(line, s => /^Turno del bandido 2$/i.test(s.banner));
        const enemyDieAt = firstAt(line, s => s.enemyDie && s.line !== '');
        const hitAt = firstAt(line, s => s.floats.some(f => f.startsWith(`${heroId}:-`)));
        const hpDropAt = firstAt(line, s => Boolean(s.hp[heroId]) && s.hp[heroId] !== hpStart);
        const walkAt = firstAt(line, s => s.moved.includes(String(far.token)));
        const endAt = endOf(line);
        const yoursAt = firstAt(line, s => /^Tu turno/.test(s.banner));
        check('C: el cartel dice de quién es cada turno («Turno del bandido 1»…), y al acabar «Tu turno»',
            firstBanner >= 0 && line.some(s => /^Turno del bandido 1$/i.test(s.banner)) && secondBanner >= 0 && yoursAt >= endAt,
            JSON.stringify({ banners: [...new Set(line.map(s => s.banner).filter(Boolean))], firstBanner, yoursAt, endAt }));
        check('C: el d20 de un enemigo, en rojo, sale antes de su golpe; y la vida de Nerea baja después del golpe',
            enemyDieAt > firstBanner && hitAt > enemyDieAt && hpDropAt >= hitAt, JSON.stringify({ firstBanner, enemyDieAt, hitAt, hpDropAt, hpStart, hpEnd: line[line.length - 1]?.hp[heroId] }));
        if (!QUIETO) check('C: el bandido que estaba lejos anda hasta Nerea en su turno (antes de pegar)', secondBanner >= 0 && walkAt >= secondBanner, JSON.stringify({ walkAt, secondBanner }));
        check('C: al redibujarse, nadie vuelve a andar lo que ya anduvo', walkingAfter === 0, String(walkingAfter));
    }

    // ---- D. «Pasar»: lo que queda sale de golpe.
    if (!QUIETO && await fighting() && (await turn()).mine) {
        await dropToasts();
        const pickD = await attackWith(0.5);
        if (pickD) {
            await page.waitForSelector('.vfx-card .vfx-skip', { timeout: 3000 }).catch(() => {});
            const t0 = Date.now();
            await page.locator('.vfx-card .vfx-skip').click({ timeout: 2000 }).catch(() => {});
            const quick = await until(async () => !(await busy()), 5000);
            await stopTimeline();
            check('D: «Pasar» enseña lo que queda de golpe', quick && Date.now() - t0 < 1500, `${Date.now() - t0} ms`);
        }
    }

    // ---- E. Ganar como lo hace e2e-combate (todos a 0 y «/combat-end»): el panel, al acabar.
    if (await fighting()) {
        await until(async () => !(await busy()), 15000);
        await page.evaluate(async () => {
            const enc = /** @type {any} */ ((await import('/scripts/party.js')).getCombatEncounter());
            for (const e of enc.enemies) e.currentHp = 0;
        });
        for (let i = 0; i < 8 && await fighting(); i++) {
            await page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/combat-end'));
            await page.waitForTimeout(700);
            await clearDice();
        }
        check('E: ganar con «/combat-end» saca el panel de victoria', await until(() => page.evaluate(() => Boolean(document.querySelector('.vs-card.vo-layer'))), 8000));
        await shoot('e-ganar');
    }

    check('sin errores en la página', problems.length === 0, problems.slice(0, 5).join(' | '));
} catch (error) {
    failures++;
    console.log(`FAIL  la vuelta: ${/** @type {any} */ (error)?.stack || error}`);
} finally {
    await browser?.close().catch(() => {});
    server?.kill();
    try {
        rmSync(dataRoot, { recursive: true, force: true });
    } catch { /* nada */ }
    console.log(failures ? `\n${failures} fallo(s)` : '\ntodo bien');
    process.exit(failures ? 1 : 0);
}
