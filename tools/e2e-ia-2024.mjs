#!/usr/bin/env node
/**
 * La IA juega con las reglas de 2024 (tanda 12), en un navegador de verdad contra un servidor
 * propio con un `--dataRoot` temporal:
 *
 *   título → Jugar sin conexión → Nerea, guerrera → la bodega del gremio (se gana). Después, en el
 *   mismo tablero, peleas cortas contra enemigos puestos a mano, cada una con el dado fijado para
 *   que el enemigo haga lo de 2024 que toca, por el turno de siempre (`runCombatTurnLoop`):
 *
 *   1. un bandido con maza le da a Nerea: Debilitar (su próximo ataque, con desventaja);
 *   2. un bruto la tiene al borde del agua honda: la empuja dentro (en el suelo y más lenta);
 *   3. un matón malherido con una poción se la bebe (acción adicional) y pega;
 *   4. un arquero pegado a ella se aparta: Nerea le da un golpe de oportunidad; y malherido, se
 *      destraba antes y se va sin llevárselo;
 *   5. una bruja con espacios de nivel 1 y 2 lanza Proyectil mágico con el de nivel 2: 4 dardos;
 *   6. un ratero que no llega a nadie, con poca luz, se esconde;
 *   7. y con `sillytavern_ia2024` en `off`, el bandido de la maza pega como antes, sin maestría.
 *
 * Saca capturas; mirarlas.
 *
 * Uso:
 *   node tools/e2e-ia-2024.mjs --port 8450 --captura <carpeta>/ia.png
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
const PORT = Number(argAfter('--port')) || 8450;
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

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-ia2024-'));
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

try {
    await startServer();
    browser = await chromium.launch({ channel: 'msedge', headless: !HEADED });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
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
        } catch { /* nada */ }
    });

    const until = async (/** @type {() => Promise<boolean>} */ test, ms = 30000) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (await test().catch(() => false)) return true;
            await page.waitForTimeout(300);
        }
        return false;
    };
    const fighting = () => page.evaluate(() => Boolean(window.SillyTavern.getContext().chatMetadata?.combatEncounter?.active));
    const clearDice = async () => {
        for (let i = 0; i < 40; i++) {
            const next = page.locator('.wm-dice-overlay.active .wm-dice-next');
            if (await next.count() === 0) break;
            if (!await next.click({ timeout: 1500 }).then(() => true).catch(() => false)) break;
            await page.waitForTimeout(150);
        }
    };
    const shot = async (/** @type {string} */ name) => {
        if (!SHOT) return;
        // Lo que vería quien juega: el tablero vuelto a pintar (la escena se monta por dentro)
        // y el resumen del combate de arriba, sin la tarjeta de la victoria de la bodega encima.
        await page.evaluate(async () => {
            document.querySelectorAll('.vs-card').forEach(card => card.remove());
            (await import('/scripts/party.js')).refreshBoardView();
        }).catch(() => {});
        await page.waitForTimeout(600);
        const file = `${SHOT.replace(/\.png$/i, '')}.${name}.png`;
        await page.screenshot({ path: file });
        console.log(`      captura: ${file}`);
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
    const inHub = await until(() => page.evaluate(async () => (await import('/scripts/party.js')).getPartyMembersSnapshot().length === 1), 90000);
    check('empieza en el gremio, con Nerea', inHub);

    // La bodega: se entra como quien juega, y se gana a golpes (el ratero tiene 5 PG).
    await entrarEnLaPelea(page, { ms: 90000 });
    check('la pelea de la bodega empieza sola', await until(fighting, 20000));
    for (let i = 0; i < 40 && await fighting(); i++) {
        await clearDice();
        await page.evaluate(async () => (await import('/scripts/party.js')).playCurrentTurnAlone());
        await page.waitForTimeout(300);
    }
    await clearDice();
    check('la bodega se gana', !(await fighting()));

    /**
     * Una pelea corta en la bodega: un enemigo puesto a mano junto a Nerea, el dado fijado, y su
     * turno por el bucle de siempre. Devuelve lo que se contó y cómo quedó todo.
     *
     * @param {Object} spec
     */
    const scene = (spec) => page.evaluate(async (s) => {
        const flow = await import('/scripts/party/combat-flow.js');
        const state = await import('/scripts/party/state.js');
        const rules = await import('/scripts/party/combat-rules.js');
        const board = await import('/scripts/party/board.js');
        const terrainMod = await import('/scripts/game-engine/board/terrain.js');
        const roster = await import('/scripts/party/roster.js');
        if (state.combatEncounter.active) flow.endCombat('ended');
        const hero = state.partyMembers[0];
        Object.assign(hero, { hp: Number(hero.maxHp) || 30, activeConditions: [], deathSaves: undefined, ...(s.hero ?? {}) });
        roster.savePartyState();
        const context = board.getActiveBoardContext();
        // Las casillas que pide la escena (agua honda detrás de Nerea, por ejemplo).
        const hx = 4;
        const hy = 4;
        hero.mapPosition = { ...(hero.mapPosition ?? {}), gridX: hx, gridY: hy };
        if (context.board) {
            let terrain = terrainMod.normalizeTerrain(context.board.terrain);
            for (let x = 1; x <= 9; x++) for (let y = 1; y <= 8; y++) terrain = terrainMod.setCell(terrain, x, y, 'floor');
            for (const cell of s.cells ?? []) terrain = terrainMod.setCell(terrain, hx + cell.dx, hy + cell.dy, cell.type);
            context.board.terrain = terrain;
            context.board.hazards = [];
            context.board.enemyPlacements = [];
        }
        flow.startCombat({ id: s.id, name: s.name, maxHp: s.maxHp ?? 30, armorClass: 10, cr: s.cr ?? 1, attackRangeFeet: s.reach ?? 5, strength: s.strength ?? 10, dexterity: s.dexterity ?? 10, constitution: 10, profile: s.profile ?? 'aggressive', speed: 30, ...(s.spellcasting ? { spellcasting: s.spellcasting } : {}) }, 1, 12, 12);
        const enc = state.combatEncounter;
        const [enemy] = enc.enemies;
        // Si el enemigo sacó más iniciativa, ya ha jugado un turno al empezar: todo como al
        // principio, para que el turno que se mira sea el de la escena.
        Object.assign(enemy, {
            gridX: hx + (s.at?.dx ?? 1), gridY: hy + (s.at?.dy ?? 0), currentHp: s.hp ?? enemy.maxHp, activeConditions: [],
            slotsUsed: {}, abilityUses: {}, potionsUsed: 0, ...(s.enemy ?? {}),
        });
        Object.assign(hero, { hp: Number(hero.maxHp) || 30, activeConditions: [], ...(s.hero ?? {}) });
        enc.conditionTimers = [];
        enc.tactics = {};
        enc.maneuvers = { dodging: [], disengaged: [], helped: [], combo: null, hidden: [] };
        state.setUsedReactions(new Set());
        hero.mapPosition = { ...(hero.mapPosition ?? {}), gridX: hx, gridY: hy };
        // Le toca al enemigo.
        const at = enc.turnOrder.findIndex((/** @type {any} */ e) => e.isEnemy);
        enc.currentTurnIndex = at;
        enc.turnState = { actorId: String(enemy.instanceId), isEnemy: true, movementSpentFeet: 0, actionUsed: false, bonusActionUsed: false, reactionUsed: false };
        const chat = window.SillyTavern.getContext().chat;
        const from = chat.length;
        const queue = [...(s.dice ?? [])];
        rules.setRandomSource(() => (queue.length > 0 ? Number(queue.shift()) : (s.then ?? 0.5)));
        try {
            flow.runCombatTurnLoop(true);
        } finally {
            rules.setRandomSource(null);
        }
        const said = chat.slice(from).map((/** @type {any} */ m) => String(m.mes)).join('\n');
        return {
            said,
            hero: { x: Number(hero.mapPosition?.gridX), y: Number(hero.mapPosition?.gridY), hp: Number(hero.hp), conditions: [...(hero.activeConditions ?? [])] },
            enemy: { x: Number(enemy.gridX), y: Number(enemy.gridY), hp: Number(enemy.currentHp), slotsUsed: enemy.slotsUsed ?? {}, potionsUsed: enemy.potionsUsed ?? 0 },
            maneuvers: JSON.parse(JSON.stringify(enc.maneuvers ?? {})),
            board: Boolean(context.board),
        };
    }, spec);

    // 1. Debilitar: el bandido de la maza acierta (un 19) y deja a Nerea tocada.
    const sap = await scene({ id: 'bandido-maza', name: 'Bandido', enemy: { weapon: 'maza' }, dice: [0.9], then: 0.5 });
    await clearDice();
    check('1. el bandido pega con la maza y Debilitar deja a Nerea con desventaja', /Debilitar \(maza\)/.test(sap.said) && sap.hero.conditions.includes('Debilitado'), sap.said.slice(0, 600));
    check('   y lo dice en palabras: «ataca a Nerea con la maza»', /ataca a Nerea con la maza/.test(sap.said), '');
    await shot('1-debilitar');

    // 2. El bruto la tiene al borde del agua honda: la empuja dentro. Nerea saca un 1 al salvar.
    const water = await scene({ id: 'bruto', name: 'Bruto del muelle', strength: 16, at: { dx: -1, dy: 0 }, cells: [{ dx: 1, dy: 0, type: 'deep_water' }], enemy: { role: 'bruto' }, dice: [0], then: 0.5 });
    await clearDice();
    check('2. el bruto la empuja al agua honda: en el suelo y más lenta',
        /agua honda/.test(water.said) && water.hero.conditions.includes('Prone') && water.hero.conditions.includes('Ralentizado') && water.board,
        `${water.said.slice(0, 500)} · ${JSON.stringify(water.hero)}`);
    await shot('2-agua-honda');

    // 3. El matón malherido con una poción: se la bebe y pega igual.
    const potion = await scene({ id: 'maton', name: 'Matón', hp: 6, maxHp: 30, enemy: { potions: 1 }, then: 0.5 });
    await clearDice();
    check('3. malherido, se bebe la poción (acción adicional) y aun así ataca',
        /se bebe una poción/.test(potion.said) && potion.enemy.hp > 6 && potion.enemy.potionsUsed === 1 && /ataca a Nerea/.test(potion.said),
        potion.said.slice(0, 500));
    await shot('3-pocion');

    // 4. El arquero pegado a Nerea se aparta para disparar: golpe de oportunidad. Malherido, se destraba.
    const leave = await scene({ id: 'arquero', name: 'Arquero', reach: 60, profile: 'skirmisher', dexterity: 14, then: 0.5 });
    await clearDice();
    check('4a. el arquero se aparta de Nerea y se lleva su golpe de oportunidad',
        /deja el flanco: ataque de oportunidad de Nerea/.test(leave.said) && /aprovecha que se va/.test(leave.said), leave.said.slice(0, 600));
    const scared = await scene({ id: 'arquero2', name: 'Arquero herido', reach: 60, profile: 'skirmisher', dexterity: 14, hp: 5, maxHp: 30, then: 0.5 });
    await clearDice();
    check('4b. malherido, se destraba antes de irse y no se lo llevan',
        /se destraba/i.test(scared.said) && !/ataque de oportunidad de Nerea/.test(scared.said) && scared.enemy.hp === 5, scared.said.slice(0, 600));
    await shot('4-destrabarse');

    // 5. La bruja: Proyectil mágico con el espacio de nivel 2 (4 dardos), que el de nivel 2 no lo guarda para otro.
    const witch = await scene({
        id: 'bruja', name: 'Bruja del faro', reach: 120, profile: 'skirmisher', at: { dx: 5, dy: 0 }, hero: { hp: 40, maxHp: 40 },
        spellcasting: { ability: 'intelligence', saveDc: 12, attackBonus: 4, casterLevel: 3, slots: { 1: 1, 2: 1 }, spells: ['conj-proyectil-magico'] },
        then: 0.5,
    });
    await clearDice();
    check('5. la bruja lanza a más nivel: espacio de nivel 2, cuatro dardos',
        /espacio de nivel 2/.test(witch.said) && /4 dardos/.test(witch.said) && Number(witch.enemy.slotsUsed?.[2]) === 1, `${witch.said.slice(0, 500)} · ${JSON.stringify(witch.enemy)}`);
    await shot('5-nivel-2');

    // 6. El ratero sujeto (no anda), que no llega a Nerea y tiene un barril delante: se esconde.
    // Saca un 20 en Sigilo.
    const hide = await scene({
        id: 'ratero-escondido', name: 'Ratero escurridizo', reach: 10, profile: 'skirmisher', dexterity: 16,
        at: { dx: -3, dy: 0 }, cells: [{ dx: -2, dy: 0, type: 'cover_three_quarters' }], enemy: { activeConditions: ['Restrained'] }, dice: [0.95], then: 0.5,
    });
    await clearDice();
    check('6. el ratero que no llega a nadie, con algo delante, se esconde (Sigilo contra 15)',
        /se esconde/.test(hide.said) && (hide.maneuvers.hidden ?? []).length === 1, `${hide.said.slice(0, 400)} · ${JSON.stringify(hide.maneuvers)}`);
    await shot('6-ocultarse');

    // 7. Con la IA de 2024 apagada (para comparar), el bandido pega como antes.
    await page.evaluate(() => window.localStorage.setItem('sillytavern_ia2024', 'off'));
    const plain = await scene({ id: 'bandido-maza2', name: 'Bandido', enemy: { weapon: 'maza' }, dice: [0.9], then: 0.5 });
    await page.evaluate(() => window.localStorage.removeItem('sillytavern_ia2024'));
    await clearDice();
    check('7. apagada, pega como antes: sin maestría', !/Debilitar/.test(plain.said) && /ataca a Nerea\./.test(plain.said) && !plain.hero.conditions.includes('Debilitado'), plain.said.slice(0, 300));

    // 8. Lo que lleva el juego del grupo (un compañero, o Nerea con «Que actúe solo»): en el suelo,
    // malherida y con una poción, se levanta (la mitad de lo que anda), se la bebe (acción
    // adicional) y aún va a por el bandido con lo que le queda: 15 pies, no 30.
    const alone = await page.evaluate(async () => {
        const flow = await import('/scripts/party/combat-flow.js');
        const state = await import('/scripts/party/state.js');
        const board = await import('/scripts/party/board.js');
        const terrainMod = await import('/scripts/game-engine/board/terrain.js');
        const roster = await import('/scripts/party/roster.js');
        const party = await import('/scripts/party.js');
        const rules = await import('/scripts/party/combat-rules.js');
        if (state.combatEncounter.active) flow.endCombat('ended');
        const hero = state.partyMembers[0];
        const context = board.getActiveBoardContext();
        if (context.board) {
            let terrain = terrainMod.normalizeTerrain(context.board.terrain);
            for (let x = 1; x <= 9; x++) for (let y = 1; y <= 8; y++) terrain = terrainMod.setCell(terrain, x, y, 'floor');
            context.board.terrain = terrain;
            context.board.hazards = [];
            context.board.enemyPlacements = [];
        }
        hero.mapPosition = { ...(hero.mapPosition ?? {}), gridX: 3, gridY: 4 };
        flow.startCombat({ id: 'bandido-lejos', name: 'Bandido lejano', maxHp: 30, armorClass: 10, cr: 1, attackRangeFeet: 5, strength: 10, dexterity: 10, constitution: 10, profile: 'aggressive', speed: 30 }, 1, 12, 12);
        const enc = state.combatEncounter;
        const [enemy] = enc.enemies;
        Object.assign(enemy, { gridX: 8, gridY: 4, currentHp: 30, activeConditions: [] });
        const items = (Array.isArray(hero.items) ? hero.items : []).filter((/** @type {any} */ i) => i.id !== 'e2e-pocion');
        Object.assign(hero, { hp: 10, activeConditions: ['Prone'], items: [...items, { id: 'e2e-pocion', name: 'Poción de curación', quantity: 1 }] });
        hero.mapPosition = { ...(hero.mapPosition ?? {}), gridX: 3, gridY: 4 };
        roster.savePartyState();
        enc.conditionTimers = [];
        enc.tactics = {};
        enc.maneuvers = { dodging: [], disengaged: [], helped: [], combo: null, hidden: [] };
        state.setUsedReactions(new Set());
        // Le toca a Nerea, con el turno entero.
        const at = enc.turnOrder.findIndex((/** @type {any} */ e) => !e.isEnemy);
        enc.currentTurnIndex = at;
        enc.turnState = { actorId: String(hero.id), isEnemy: false, movementSpentFeet: 0, actionUsed: false, bonusActionUsed: false, reactionUsed: false };
        const warnings = [];
        const toast = /** @type {any} */ (window).toastr;
        const warn = toast.warning;
        toast.warning = (/** @type {any[]} */ ...args) => {
            warnings.push(String(args[0]));
            return warn.apply(toast, args);
        };
        const chat = window.SillyTavern.getContext().chat;
        const from = chat.length;
        // El dado a la mitad: la poción cura 8, y el bandido falla después (11 contra 16).
        rules.setRandomSource(() => 0.5);
        try {
            party.playCurrentTurnAlone();
        } finally {
            toast.warning = warn;
            rules.setRandomSource(null);
        }
        return {
            said: chat.slice(from).map((/** @type {any} */ m) => String(m.mes)).join('\n'),
            warnings,
            hero: { x: Number(hero.mapPosition?.gridX), hp: Number(hero.hp), conditions: [...(hero.activeConditions ?? [])], potions: (hero.items ?? []).filter((/** @type {any} */ i) => i.id === 'e2e-pocion').length },
        };
    });
    await clearDice();
    check('8. el grupo que lleva el juego: se levanta, se bebe la poción y aún anda lo que le queda',
        /se levanta: le cuesta 15 pies/.test(alone.said) && /se bebe la poción de un trago/.test(alone.said) && alone.hero.hp > 10
            && !alone.hero.conditions.includes('Prone') && alone.hero.x === 6 && alone.hero.potions === 0
            && !alone.warnings.some((/** @type {string} */ w) => /Movimiento insuficiente/.test(w)),
        `${alone.said.slice(0, 700)} · ${JSON.stringify(alone.hero)} · ${alone.warnings.join(' | ')}`);
    await shot('8-levantarse-pocion');

    check('sin errores en la consola', problems.length === 0, problems.slice(0, 5).join(' | '));
} catch (error) {
    failures++;
    console.log(`FAIL  la vuelta se rompió: ${/** @type {any} */ (error)?.stack || error}`);
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
console.log(failures === 0 ? 'Todo bien' : `${failures} fallo(s)`);
process.exit(failures === 0 ? 0 : 1);
