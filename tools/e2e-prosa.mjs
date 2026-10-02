#!/usr/bin/env node
/**
 * El texto del motor, en prosa (J13.1 y J18.10 de wiki/ROADMAP_SIN_CONEXION.md): un tramo corto
 * de «Jugar sin conexión» jugado con el ratón, mirando lo que se lee en la caja de la novela.
 *
 *   título → tu personaje → el prólogo (el ratero del muelle, Tomás, Brunilda y la bodega)
 *   → el pueblo del gremio: comprar en la tienda, comer, pasar el rato y dormir en la taberna
 *   → el tablón: el viaje a 1387 → un viaje dentro de la campaña → descansar fuera
 *
 * Tras cada paso, cada mensaje nuevo del chat se pinta como lo pintaría la caja (sin sus
 * etiquetas: `cleanNovelCopy`) y se mira que se lea como prosa:
 *
 * - ninguna etiqueta del motor («[VIAJE]», «🛒 [TIENDA]»), ni al principio ni en medio;
 * - ningún id («el-caliz-ensangrentado», «hub-chest», «shop-buy:…») ni casillas («(3, 4)»);
 * - ninguna palabra en inglés del motor (turn, attack, damage, round…);
 * - ningún número suelto entre paréntesis («(5 de oro)», «(−3)»): los números van en la frase;
 * - ningún número de registro: «34/34», «34 → 34», «Ronda 2», «1. Irene», ni siglas con cifra
 *   («8 PG», «CA 16»);
 * - ningún emoji delante de la línea («👹 Rata ataca…»): la caja cuenta, no apunta;
 * - ninguna orden al narrador («Cuéntalo…», «Que lo pida…»).
 *
 * Y, en los momentos en que la caja está a la vista, lo mismo con lo que de verdad se lee en ella.
 *
 * Uso:
 *   node tools/e2e-prosa.mjs --port 8383
 *   node tools/e2e-prosa.mjs --port 8383 --volcar lineas.json --captura prosa.png
 */

/* global window, document */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { entrarEnLaPelea } from './e2e-entrar-pelea.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8383;
const BASE = `http://127.0.0.1:${PORT}`;
const HEADED = process.argv.includes('--headed');
const SHOT = argAfter('--captura');
const DUMP = argAfter('--volcar');

const require = createRequire(join(ROOT, 'tests/package.json'));
const { chromium } = require('@playwright/test');

let failures = 0;
const check = (/** @type {string} */ name, /** @type {boolean} */ ok, detail = '') => {
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        -> ${detail}` : ''}`);
};

/**
 * Lo que no puede leerse en la caja. Cada regla, con su nombre para el informe.
 *
 * @type {Array<[string, RegExp]>}
 */
const BAD = [
    ['etiqueta', /\[[\p{Lu}][\p{Lu}\p{N} ·]{1,30}\]/u],
    ['id', /\b[a-z0-9]+(?:-[a-z0-9]+){2,}\b|\b(?:hub|shop|inn|chip|clock|enter|go)[-:][a-z]/u],
    ['casilla', /\(\s*\d+\s*,\s*\d+\s*\)/u],
    // Con los tipos de daño y los estados de 5e, que el motor guarda en inglés («Daño fire»).
    ['inglés', /\b(?:turn|attack|damage|round|hit|miss|enemy|enemies|board|combat|player|HP|ft|undefined|null|NaN|vs|fire|cold|acid|lightning|necrotic|piercing|psychic|radiant|slashing|thunder|bludgeoning|Blinded|Charmed|Deafened|Frightened|Grappled|Incapacitated|Paralyzed|Petrified|Poisoned|Prone|Restrained|Stunned|Unconscious)\b/u],
    ['número entre paréntesis', /\(\s*[−+-]?\d+[^)]*\)/u],
    ['número de registro', /\d+\s*\/\s*\d+|\d\s*→\s*\d|^\s*(?:Ronda|Turno|Día)\s+\d+\s*(?:·|$)|(?:^|:)\s*\d+\.\s+\p{Lu}|\b\d+\s*(?:PG|PX)\b|\b(?:CA|CD)\s*\d|\bd20\(|\b\d*d\d+\s*=/u],
    ['emoji delante', /^\s*\p{Extended_Pictographic}/u],
    ['orden al narrador', /\b(?:Cuéntalo|Cuentalo|No inventes|Dilo tal cual|Narra esta|Que lo (?:pida|diga|agradezca)|Que aparezcan?\b|Que les llegue|Que se note|con naturalidad|Ya se ha dicho|no lo repitas|Si lo cuentas)/u],
];

/**
 * @param {string} line
 * @returns {string} La regla que rompe, o nada.
 */
function badIn(line) {
    for (const [name, rule] of BAD) if (rule.test(line)) return name;
    return '';
}

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-prosa-'));
/** @type {any} */
let server = null;
/** @type {any} */
let browser = null;

function startServer() {
    server = spawn(process.execPath, ['server.js', '--browserLaunchEnabled', 'false', '--port', String(PORT), '--dataRoot', dataRoot], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    const child = server;
    return new Promise((resolve, reject) => {
        // Con muchos agentes a la vez, webpack solo ya tarda minuto y medio en arrancar.
        const timer = setTimeout(() => reject(new Error('the server did not start in 480s')), 480000);
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
 * Elegir en una tarjeta de «Crear personaje», como quien juega.
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
    const chosen = values.find((/** @type {string} */ v) => plain(v) === plain(wanted)) ?? values[0];
    await page.locator(`.hc-picker .hc-option[data-value="${chosen}"]`).first().click();
    await page.waitForSelector('.hc-picker', { state: 'detached', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(200);
}

try {
    await startServer();
    browser = await chromium.launch({ channel: 'msedge', headless: !HEADED });
    const context = await browser.newContext({ viewport: { width: 1400, height: 950 } });
    const page = await context.newPage();
    /** @type {string[]} */
    const problems = [];
    page.on('pageerror', (/** @type {any} */ e) => problems.push(`PAGEERROR ${e.message}`));
    await context.addInitScript(() => {
        try {
            window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,combat,travel,prisoners,mesa,high,spell,pet,bill,move,attack,roll,talk,journal');
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
            // Las tarjetas de suceso salen en su ventana: aquí se mira la caja.
            window.localStorage.setItem('sillytavern_gameSucesos', 'off');
            window.localStorage.setItem('sillytavern_gameStoryWindows', 'off');
        } catch { /* nada */ }
    });

    // --- Los ayudantes -----------------------------------------------------------------------
    const until = async (/** @type {() => Promise<boolean>} */ test, ms = 30000) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (await test().catch(() => false)) return true;
            await page.waitForTimeout(400);
        }
        return false;
    };
    const state = () => page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const party = (await import('/scripts/party.js')).getPartyMembersSnapshot();
        return {
            world: String(ctx.chatMetadata?.world_info ?? ''),
            place: String(ctx.chatMetadata?.currentLocation ?? ''),
            board: String(ctx.chatMetadata?.currentBoard ?? ''),
            gold: party.reduce((/** @type {number} */ sum, /** @type {any} */ m) => sum + (Number(m.gold) || 0), 0),
            fighting: Boolean(ctx.chatMetadata?.combatEncounter?.active),
        };
    });
    const chips = () => page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-chip-action')].map(c => (c.textContent || '').trim()));
    const clickChip = (/** @type {RegExp} */ pattern) => page.evaluate((source) => {
        const chip = [...document.querySelectorAll('#game-shell .gs-chip-action')].find(b => new RegExp(source).test(b.textContent || ''));
        if (chip instanceof window.HTMLElement) chip.click();
        return Boolean(chip);
    }, pattern.source);
    const sceneNow = () => page.evaluate(() => document.querySelector('#game-shell')?.getAttribute('data-scene') || '');
    const carryOn = async (/** @type {string} */ wanted) => {
        await until(async () => {
            if (await sceneNow() === wanted) return true;
            await page.evaluate(() => /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .gs-vn-box .gs-chip-continue'))?.click());
            return false;
        }, 12000);
        return sceneNow();
    };
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
    const dropToasts = () => page.evaluate(() => document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));
    /** Lo que se abra encima (un contratiempo del camino, un aviso, una ventana), cerrado como quien lo lee. */
    const clearPopups = async () => {
        await clearDice();
        for (let i = 0; i < 8; i++) {
            const open = await page.evaluate(() => {
                const pick = (/** @type {string} */ sel) => /** @type {HTMLElement|null} */ (document.querySelector(sel));
                const button = pick('.popup:not([closing]) .tr-detour') ?? pick('.popup:not([closing]) .rd-pass')
                    ?? pick('.popup:not([closing]) .rd-face') ?? pick('.popup:not([closing]) .gd-pay') ?? pick('.popup:not([closing]) .gd-flee')
                    ?? pick('.popup:not([closing]) .popup-button-ok');
                if (button && button.offsetParent) {
                    button.click();
                    return true;
                }
                return false;
            });
            if (!open) return;
            await page.waitForTimeout(500);
            await clearDice();
        }
    };
    /** Ganar la pelea abierta: todos a cero y a acabar turnos. */
    const winFight = async () => {
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
    };
    /**
     * Salir del tablero al pueblo, como quien juega: la ficha «Salir del tablero» de la caja y,
     * si no está, el botón del mapa. Hasta que no quede tablero.
     */
    const leaveBoard = async () => {
        for (let i = 0; i < 4 && (await state()).board; i++) {
            await clearPopups();
            if (!(await clickChip(/^Salir del tablero$/))) {
                await carryOn('combat');
                await page.locator('.wm-leave-loc-btn').filter({ visible: true }).first().click({ timeout: 4000 }).catch(() => {});
            }
            await page.waitForTimeout(900);
        }
        await clearPopups();
    };
    const placeScene = () => page.evaluate(() => {
        const scene = document.querySelector('#game-shell .gs-town-scene');
        return {
            place: scene?.getAttribute('data-place') || '',
            acts: [...(scene?.querySelectorAll('.gs-town-act') ?? [])].map(b => ({ id: b.getAttribute('data-action') || '', enabled: !(/** @type {HTMLButtonElement} */ (b).disabled) })),
        };
    });
    const leavePlace = async () => {
        if (await page.locator('#game-shell .gs-town-scene').count() === 0) return;
        await page.locator('#game-shell .gs-town-back').click({ timeout: 5000 }).catch(() => {});
        await until(() => page.evaluate(() => !document.querySelector('#game-shell .gs-town-scene')), 5000);
    };
    const enterPlace = async (/** @type {string} */ id) => {
        await leavePlace();
        await carryOn('exploration');
        await page.locator(`#game-shell .gs-town-place[data-place="${id}"]`).click({ timeout: 8000 }).catch(() => {});
        return until(async () => (await placeScene()).place === id, 8000);
    };
    const placeAct = async (/** @type {string} */ id) => {
        await page.locator(`#game-shell .gs-town-scene .gs-town-act[data-action="${id}"]`).first().click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(900);
        await clearPopups();
    };

    /**
     * Cada mensaje del chat, pintado como lo pinta la caja: la copia de su `.mes_text`, sin
     * etiquetas (`cleanNovelCopy`). Por su `mesid`, para no mirar dos veces el mismo.
     */
    const boxRendering = () => page.evaluate(async () => {
        const { cleanNovelCopy } = await import('/scripts/game-engine/ui/shell/engine-tags.js');
        const chat = window.SillyTavern.getContext().chat || [];
        return [...document.querySelectorAll('#chat .mes')].map(node => {
            const body = node.querySelector('.mes_text');
            const id = Number(node.getAttribute('mesid'));
            if (!body || node.getAttribute('is_user') === 'true') return null;
            const copy = /** @type {Element} */ (body.cloneNode(true));
            const kept = cleanNovelCopy(copy);
            const message = chat[id] ?? {};
            return {
                id,
                who: node.getAttribute('ch_name') || '',
                system: node.getAttribute('is_system') === 'true',
                stored: String(message.extra?.display_text ?? message.mes ?? '').slice(0, 400),
                shown: kept ? (/** @type {HTMLElement} */ (copy).innerText || copy.textContent || '').replace(/\s+/g, ' ').trim() : '',
            };
        }).filter(Boolean);
    });
    /** Lo que de verdad se lee ahora en la caja, si está a la vista. */
    const boxNow = () => page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-vn-text .gs-vn-line')]
        .map(l => (/** @type {HTMLElement} */ (l).innerText || l.textContent || '').replace(/\s+/g, ' ').trim()));

    /** @type {Map<number, any>} */
    const lines = new Map();
    /** @type {Array<{step: string, id: number, shown: string, rule: string}>} */
    const broken = [];
    /** @type {Record<string, number>} */
    const perStep = {};
    /**
     * Mirar lo nuevo tras un paso: cada línea, como en la caja.
     *
     * @param {string} step
     */
    const look = async (step) => {
        const now = await boxRendering();
        let fresh = 0;
        for (const line of now) {
            const key = Number(line.id);
            if (lines.has(key) && lines.get(key).stored === line.stored) continue;
            lines.set(key, { ...line, step });
            if (!line.shown) continue;
            fresh += 1;
            const rule = badIn(line.shown);
            if (rule) broken.push({ step, id: key, shown: line.shown.slice(0, 220), rule });
        }
        perStep[step] = (perStep[step] ?? 0) + fresh;
        // Y lo que se lee de verdad en la caja, si se ve.
        if (await sceneNow() === 'dialogue') {
            for (const shown of await boxNow()) {
                const rule = badIn(shown);
                if (rule && !broken.some(b => b.shown === shown.slice(0, 220))) broken.push({ step: `${step} (caja)`, id: -1, shown: shown.slice(0, 220), rule });
            }
        }
        console.log(`  · ${step}: ${fresh} línea(s) nueva(s)`);
    };

    // --- 1. El título y tu personaje ---------------------------------------------------------
    // Con la máquina cargada (muchas pruebas a la vez), la primera carga tarda más de 30 s.
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    if (await page.locator('text=Welcome to SillyTavern!').waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#game-shell', { timeout: 90000 });
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
    const inGuild = await until(async () => /Gremio/.test((await state()).world), 90000);
    check('se entra en el gremio con Irene, sin conexión', inGuild);
    // Tanda 10: ya no hay «Iniciar combate»; la llegada se lee antes de pulsar «Continuar».
    await until(async () => (await boxNow()).length > 0, 20000);
    await page.waitForTimeout(800);
    await look('la llegada al muelle');
    if (SHOT) await page.screenshot({ path: `${SHOT}.muelle.png` });

    // --- 2. El prólogo: el ratero, Tomás, Brunilda y la bodega --------------------------------
    await entrarEnLaPelea(page);
    await winFight();
    await until(async () => (await sceneNow()) === 'dialogue', 10000);
    await page.waitForTimeout(800);
    await look('la pelea del muelle');
    if (SHOT) await page.screenshot({ path: `${SHOT}.tras-pelea.png` });
    // Tanda 10: en un tablero no se ofrece hablar con nadie; se sale del muelle al pueblo primero.
    await carryOn('combat');
    await page.locator('#game-shell .gs-scene-map .wm-leave-loc-btn').first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(800);
    // J13.7: antes de presentarse, la ficha dice el oficio («Hablar con el posadero»), no el nombre.
    const talkWith = async (/** @type {string} */ name, /** @type {string} */ topic = '') => {
        await dropToasts();
        const chip = new RegExp(`^Hablar con (?:${name})$`);
        await until(async () => (await chips()).some(c => chip.test(c)), 10000);
        await clickChip(chip);
        await page.waitForSelector('.popup:visible .tk-root', { timeout: 10000 }).catch(() => {});
        if (topic) {
            await page.locator(`.popup:visible .tk-root .tk-topic[data-topic="${topic}"]`).first().click({ timeout: 5000 }).catch(() => {});
            await page.waitForTimeout(900);
            await clearDice();
        }
        await dropToasts();
        await page.locator('.popup:visible:has(.tk-root) .popup-button-ok').first().click({ timeout: 5000 }).catch(() => {});
        await page.waitForSelector('.tk-root', { state: 'detached', timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(600);
    };
    await talkWith('Tomás|el posadero', 'rumor');
    await look('hablar con Tomás');
    await talkWith('Brunilda|la maestra del gremio');
    await page.waitForTimeout(600);
    await look('hablar con Brunilda');
    await carryOn('exploration');
    await until(async () => (await chips()).some(c => /^Entrar en La bodega del gremio$/.test(c)), 10000);
    await clickChip(/^Entrar en La bodega del gremio$/);
    await until(async () => (await state()).board === 'La bodega del gremio', 10000);
    await entrarEnLaPelea(page);
    await winFight();
    await until(async () => (await sceneNow()) === 'dialogue', 10000);
    await page.waitForTimeout(1000);
    await look('la prueba de la bodega');
    if (SHOT) await page.screenshot({ path: `${SHOT}.bodega.png` });
    const afterTrial = await boxNow();
    check('tras la prueba de la bodega, la caja se lee y ninguna línea empieza por «[» (J18.10)',
        afterTrial.length > 0 && afterTrial.every(l => !/^\S{0,3}\s*\[/u.test(l)), JSON.stringify(afterTrial));

    // --- 3. El pueblo del gremio: la tienda, la taberna y dormir -------------------------------
    await leaveBoard();
    await clearPopups();
    await carryOn('exploration');
    await page.evaluate(async () => {
        const { partyMembers } = await import('/scripts/party/state.js');
        if (partyMembers[0]) partyMembers[0].gold = 300;
        (await import('/scripts/party/roster.js')).savePartyState();
    });
    const inShop = await enterPlace('tienda');
    const shopActs = (await placeScene()).acts.filter(a => a.id.startsWith('shop-buy:') && a.enabled);
    const goldBefore = (await state()).gold;
    if (shopActs[0]) await placeAct(shopActs[0].id);
    const bought = (await state()).gold < goldBefore;
    check('en la tienda del gremio se compra algo con un clic', inShop && bought, JSON.stringify({ inShop, shopActs: shopActs.map(a => a.id), goldBefore }));
    await look('comprar en la tienda');
    const inInn = await enterPlace('posada');
    await placeAct('inn-meal');
    await look('comer en la taberna');
    await placeAct('clock:slot');
    await look('pasar el rato');
    await placeAct('inn-room');
    await clearPopups();
    await look('dormir en la taberna');
    check('en la taberna se come, se pasa el rato y se duerme', inInn);
    // J13.1: las notas del motor guardan su versión contada aparte (`extra.display_text`), con la
    // misma etiqueta delante; el mensaje sigue con sus datos de siempre. Se mira en el chat del gremio, antes de irse.
    const told = await page.evaluate(async () => {
        const { tagLength } = await import('/scripts/game-engine/ui/shell/engine-tags.js');
        const chat = window.SillyTavern.getContext().chat || [];
        const notes = chat.filter((/** @type {any} */ m) => m.is_system && typeof m.extra?.display_text === 'string' && m.extra.display_text !== m.mes);
        const tagOf = (/** @type {string} */ s) => s.slice(0, tagLength(s)).replace(/\s+/g, '');
        return {
            count: notes.length,
            lostTag: notes.filter((/** @type {any} */ m) => tagOf(m.mes) !== tagOf(m.extra.display_text)).map((/** @type {any} */ m) => m.mes.slice(0, 80)),
            sample: notes.slice(0, 4).map((/** @type {any} */ m) => [m.mes.slice(0, 90), m.extra.display_text.slice(0, 90)]),
        };
    });
    check('las notas del motor llevan su versión contada, con la etiqueta guardada delante (J13.1)', told.count >= 5 && told.lostTag.length === 0, JSON.stringify(told));
    if (await sceneNow() === 'dialogue') {
        const restBox = await boxNow();
        check('tras dormir, la caja se lee sin etiquetas (J18.10)', restBox.every(l => !badIn(l)), JSON.stringify(restBox));
        if (SHOT) await page.screenshot({ path: `${SHOT}.dormir.png` });
    }
    await leavePlace();

    // --- 4. El tablón: el viaje a 1387 ---------------------------------------------------------
    await carryOn('exploration');
    await until(async () => (await chips()).some(c => /Tablón de campañas/.test(c)), 15000);
    await clickChip(/Tablón de campañas/);
    await page.waitForSelector('.hb-root [data-campaign="1387"]', { timeout: 15000 }).catch(() => {});
    await page.locator('.hb-root [data-campaign="1387"]').click({ timeout: 8000 }).catch(() => {});
    const in1387 = await until(async () => /1387/.test((await state()).world), 150000);
    await page.waitForTimeout(2500);
    await clearPopups();
    await look('el viaje a 1387');
    check('del tablón a 1387', in1387);
    if (await sceneNow() === 'dialogue') {
        const tripBox = await boxNow();
        check('el viaje a 1387 se lee en la caja sin «[VIAJE]» ni otra etiqueta (J18.10)', tripBox.length > 0 && tripBox.every(l => !badIn(l)), JSON.stringify(tripBox));
        if (SHOT) await page.screenshot({ path: `${SHOT}.viaje.png` });
    }
    await leaveBoard();
    await carryOn('exploration');
    await look('fuera del tablero de 1387');

    // --- 5. Un viaje dentro de la campaña, y descansar fuera -----------------------------------
    const from = (await state()).place;
    const target = await page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-place')]
        .filter(c => !(/** @type {HTMLButtonElement} */ (c).disabled))
        .map(c => (c.querySelector('.gs-place-name')?.textContent || '').trim()).find(Boolean) || '');
    if (target) {
        await page.locator('#game-shell .gs-place', { hasText: target }).first().click({ timeout: 8000 }).catch(() => {});
        await page.waitForSelector('.popup:visible .tr-pace-normal', { timeout: 8000 }).catch(() => {});
        await page.locator('.popup:visible .tr-pace-normal').click({ timeout: 5000 }).catch(() => {});
        for (let i = 0; i < 20; i++) {
            await page.waitForTimeout(600);
            await clearPopups();
            if ((await state()).place === target && i > 4) break;
        }
    }
    await page.waitForTimeout(1200);
    await look(`el viaje de ${from} a ${target}`);
    check('un viaje dentro de 1387, con un clic en «Viajar»', Boolean(target) && (await state()).place === target, JSON.stringify({ from, target, now: await state() }));
    if (await sceneNow() === 'dialogue') {
        const roadBox = await boxNow();
        check('el viaje se cuenta en la caja sin etiquetas (J13.1, J18.10)', roadBox.every(l => !badIn(l)), JSON.stringify(roadBox));
        if (SHOT) await page.screenshot({ path: `${SHOT}.camino.png` });
    }
    await carryOn('exploration');
    // Descansar: en la posada si la hay; si no, la tarjeta «Descansar» con acampar o el descanso largo.
    const places = await page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-town-place')].map(c => c.getAttribute('data-place') || ''));
    if (places.includes('posada')) {
        await enterPlace('posada');
        await placeAct('inn-room');
    } else if (places.includes('descanso')) {
        await enterPlace('descanso');
        const acts = (await placeScene()).acts;
        const camp = acts.find(a => a.id === 'chip:camp') ?? acts.find(a => a.id === 'clock:long');
        if (camp) await placeAct(camp.id);
        // Acampar abre su ventana: el fuego, las guardias y la cena.
        await page.locator('.popup:visible .cp-go, .popup:visible .popup-button-ok').first().click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(1200);
        await clearPopups();
    } else {
        // Sin posada ni tarjeta «Descansar»: la ficha «Acampar aquí» o «Descanso corto», abriendo
        // «+N más» si hace falta, como quien juega.
        if (!(await chips()).some(c => /^(?:Acampar aquí|Descanso corto)$/.test(c))) await clickChip(/^\+\d+ más$/);
        await page.waitForTimeout(400);
        if (await clickChip(/^Acampar aquí$/)) {
            await page.locator('.popup:visible .cp-go, .popup:visible .popup-button-ok').first().click({ timeout: 5000 }).catch(() => {});
        } else {
            await clickChip(/^Descanso corto$/);
        }
        await page.waitForTimeout(1500);
        await clearPopups();
    }
    await page.waitForTimeout(1000);
    await look('descansar fuera del gremio');
    if (SHOT) await page.screenshot({ path: `${SHOT}.descanso.png` });

    // --- Lo visto --------------------------------------------------------------------------------
    const shown = [...lines.values()].filter(l => l.shown);
    console.log(`\nLíneas miradas: ${shown.length} (${Object.entries(perStep).map(([k, v]) => `${k}: ${v}`).join('; ')})`);
    check('se han mirado líneas de cada tramo: el prólogo, el pueblo, el viaje y el descanso',
        shown.length >= 10 && ['la llegada al muelle', 'comprar en la tienda', 'dormir en la taberna', 'el viaje a 1387'].every(s => (perStep[s] ?? 0) > 0),
        JSON.stringify(perStep));
    check('ninguna línea de la caja lleva etiquetas del motor, ids, casillas, inglés, números sueltos ni órdenes al narrador (J13.1, J18.10)',
        broken.length === 0, JSON.stringify(broken.slice(0, 12)));
    for (const bad of broken) console.log(`   ✘ [${bad.rule}] ${bad.step}: ${bad.shown}`);
    // La crónica sigue leyendo sus categorías: las etiquetas se guardan, no se ven.
    const chronicle = await page.evaluate(async () => {
        const { chronicleOf } = await import('/scripts/game-engine/campaign/chronicle.js');
        const entries = chronicleOf(window.SillyTavern.getContext().chat || []);
        return [...new Set(entries.map((/** @type {any} */ e) => e.category))];
    });
    check('la crónica (el Diario) sigue sabiendo de qué es cada línea: guarda la etiqueta aunque no se vea', chronicle.length >= 2 && !chronicle.every(c => c === 'otros'),
        JSON.stringify(chronicle));
    check('sin errores de página', problems.length === 0, problems.slice(0, 5).join(' | '));
    if (DUMP) writeFileSync(DUMP, JSON.stringify({ broken, lines: [...lines.values()] }, null, 2));
} catch (error) {
    failures++;
    console.log(`FAIL  la vuelta se ha roto\n        -> ${/** @type {any} */ (error)?.stack || error}`);
} finally {
    await browser?.close().catch(() => {});
    server?.kill();
    try {
        rmSync(dataRoot, { recursive: true, force: true });
    } catch { /* se queda en la carpeta temporal */ }
}
console.log(failures === 0 ? '\nTODO BIEN' : `\n${failures} FALLO(S)`);
process.exit(failures === 0 ? 0 : 1);
