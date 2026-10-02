#!/usr/bin/env node
/**
 * La pelea con magia de verdad (J19 de ROADMAP_SIN_CONEXION), el control de los compañeros
 * (J7.3, D-J32) y lo que pasa al ganar (J13.3, J14.1), en un navegador de verdad contra un
 * servidor propio con un `--dataRoot` temporal, como `e2e-gremio.mjs`:
 *
 *   título → Jugar sin conexión → Iria, druida → saltar la prueba (J2.3) → contratar a Gerd →
 *   La Maldición de Strahd → en la Taberna, antes de pelear: la ficha de Gerd sin «Quién le
 *   mueve» y, con el vínculo de amigo (5), con él (J7.3) → la bruja, que trae sus conjuros del
 *   paquete (J19.12) → Iria invoca dos lobos: entran en la iniciativa detrás de ella, con su
 *   ficha en el tablero y su botón de quién los mueve (J19.5) → uno se le deja al juego y juega
 *   solo; el otro lo mueves tú → la bruja lanza y Gerd, mago, se lo corta con Contraconjuro
 *   (J19.7) → el Rayo de luna acaba con los lobos (la concentración cambia) y quema a la bruja
 *   al empezar su turno (J19.6) → un golpe a quien se concentra pide la salvación, y con un 1
 *   la rompe (J19.4) → Escudo para un golpe a Gerd (J19.7) → a Gerd lo mueves tú (J7.3) →
 *   Gerd, devuelto al juego, juega solo (J7.3) → ganar: el panel de victoria, «Iria sale
 *   malherida» (J13.3), alguien quiere decirte algo (J14.1) y ni lobos ni zonas se quedan →
 *   «Continuar» sigue el hilo: de la Taberna a la Aldea, camino de la Mansión (D-J45).
 *
 * Lo que se prepara a mano (el nivel, los conjuros, el vínculo, la vida de la bruja) se dice
 * en cada paso; lo que se prueba se hace con el ratón, como quien juega.
 *
 * Uso:
 *   node tools/e2e-combate.mjs                                  # sin ventana
 *   node tools/e2e-combate.mjs --headed                         # mirándolo
 *   node tools/e2e-combate.mjs --port 8186 --captura combate.png  # combate-1.png, combate-2.png…
 */

/* global window, document, HTMLElement, HTMLButtonElement */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { entrarEnLaPelea } from './e2e-entrar-pelea.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8186;
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

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-combate-'));
/** @type {any} */
let server = null;
/** @type {any} */
let browser = null;
/** @type {any} */
let page = null;

let shots = 0;
/** @param {string} what */
async function shoot(what) {
    if (!SHOT || !page) return;
    shots += 1;
    const file = SHOT.replace(/\.png$/i, '') + `-${shots}.png`;
    await page.screenshot({ path: file });
    console.log(`      captura ${shots} (${what}): ${file}`);
}

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

/**
 * Elegir en una tarjeta de «Crear personaje» la opción que se parece a lo pedido, o la primera.
 *
 * @param {any} target
 * @param {string} pick class | race | background
 * @param {string} wanted
 * @returns {Promise<string>}
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
    return chosen;
}

try {
    await startServer();
    browser = await chromium.launch({ channel: 'msedge', headless: !HEADED });
    const context = await browser.newContext({ viewport: { width: 1400, height: 950 } });
    page = await context.newPage();
    /** @type {string[]} */
    const problems = [];
    page.on('pageerror', e => problems.push(`PAGEERROR ${e.message}`));
    page.on('console', m => {
        if (m.type() === 'error' && !/Failed to load resource.*404/.test(m.text())) problems.push(`ERROR ${m.text().slice(0, 300)}`);
    });
    await context.addInitScript(() => {
        try {
            window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,combat,travel,prisoners,mesa,high,spell,pet,bill,move,attack,roll,talk,journal');
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
            window.localStorage.setItem('sillytavern_gameSucesos', 'off');
            // Las escenas del hilo las mira e2e-historia (también que esperan al panel de victoria).
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
            party: party.map((/** @type {any} */ m) => ({ id: m.id, name: m.name, gold: Number(m.gold) || 0, hp: m.hp, maxHp: m.maxHp, control: m.control ?? '' })),
            fighting: Boolean(meta.combatEncounter?.active),
            done: Array.isArray(meta.plotState?.done) ? meta.plotState.done : [],
        };
    });
    const chips = () => page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-chip-action')].map(c => (c.textContent || '').trim()));
    const clickChip = (/** @type {RegExp} */ pattern) => page.evaluate((source) => {
        const chip = [...document.querySelectorAll('#game-shell .gs-chip-action')].find(b => new RegExp(source).test(b.textContent || ''));
        if (chip instanceof HTMLElement) chip.click();
        return Boolean(chip);
    }, pattern.source);
    const chatHas = (/** @type {RegExp} */ pattern) => page.evaluate((source) => (window.SillyTavern.getContext().chat || [])
        .some((/** @type {any} */ m) => new RegExp(source).test(String(m.extra?.display_text || m.mes || ''))), pattern.source);
    /** Los mensajes del chat desde el número `from`, como texto. */
    const chatSince = (/** @type {number} */ from) => page.evaluate((start) => (window.SillyTavern.getContext().chat || [])
        .slice(start).map((/** @type {any} */ m) => String(m.extra?.display_text || m.mes || '')).join('\n'), from);
    const chatLength = () => page.evaluate(() => (window.SillyTavern.getContext().chat || []).length);
    const until = async (/** @type {() => Promise<boolean>} */ test, ms = 30000) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (await test().catch(() => false)) return true;
            await page.waitForTimeout(400);
        }
        return false;
    };
    const clearDice = async () => {
        let misses = 0;
        for (let i = 0; i < 40; i++) {
            const next = page.locator('.wm-dice-overlay.active .wm-dice-next');
            if (await next.count() === 0) break;
            const clicked = await next.click({ timeout: 1500 }).then(() => true).catch(() => false);
            if (!clicked && ++misses >= 2) break;
            await page.waitForTimeout(250);
        }
    };
    const dropToasts = () => page.evaluate(() => document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));
    /** El combate: de quién es el turno, quién pelea, las invocaciones y las zonas. */
    const fight = () => page.evaluate(async () => {
        const enc = /** @type {any} */ ((await import('/scripts/party.js')).getCombatEncounter());
        const entry = enc?.active ? enc.turnOrder?.[enc.currentTurnIndex] ?? null : null;
        return {
            active: Boolean(enc?.active),
            round: Number(enc?.round) || 0,
            turn: entry ? { id: String(entry.id), name: String(entry.name), isEnemy: Boolean(entry.isEnemy) } : null,
            order: (enc?.turnOrder ?? []).map((/** @type {any} */ e) => ({ id: String(e.id), name: String(e.name), isEnemy: Boolean(e.isEnemy) })),
            summons: (enc?.summons ?? []).map((/** @type {any} */ s) => ({ id: String(s.id), name: String(s.name), hp: Number(s.hp) || 0, control: String(s.control ?? ''), casterId: String(s.casterId ?? '') })),
            zones: (enc?.spellZones ?? []).map((/** @type {any} */ z) => ({ kind: String(z.kind), name: String(z.name), cells: z.cells?.length ?? 0 })),
            enemies: (enc?.enemies ?? []).map((/** @type {any} */ e) => ({
                name: String(e.name), hp: Number(e.currentHp) || 0, spellcasting: Boolean(e.spellcasting), slotsUsed: e.slotsUsed ?? null,
                conditions: e.activeConditions ?? [],
            })),
        };
    });
    /** Pasar el turno de quien lleve el jugador, con el botón de la barra del combate (tanda 10). */
    const endTurn = async () => {
        await clearDice();
        await dropToasts();
        const clicked = await page.evaluate(() => {
            const button = [...document.querySelectorAll('#game-shell .gs-actions button')].find(b => /Fin de turno/.test(b.textContent || ''));
            if (button instanceof HTMLElement) button.click();
            return Boolean(button);
        });
        if (!clicked) await page.evaluate(async () => (await import('/scripts/party/player-actions.js')).endPlayerCombatTurn());
        // Idea 153: con alguien a tiro, el botón pregunta «¿Acabar el turno?»: se acaba igual.
        const sure = page.locator('.popup:visible .popup-button-ok', { hasText: 'Acabar igual' }).first();
        if (await sure.waitFor({ state: 'visible', timeout: 800 }).then(() => true).catch(() => false)) await sure.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(500);
        await clearDice();
    };
    /** Pasar turnos hasta que le toque a quien se pide (o se acabe la pelea). */
    const toTurnOf = async (/** @type {(turn: any) => boolean} */ wanted, max = 14) => {
        for (let i = 0; i < max; i++) {
            await clearDice();
            const now = await fight();
            if (!now.active || !now.turn) return false;
            if (wanted(now.turn)) return true;
            if (!now.turn.isEnemy) await endTurn();
            else await page.waitForTimeout(400);
        }
        return false;
    };
    /** Abrir la tarjeta de un enemigo del tablero, como quien lo pulsa. */
    const openFoeCard = async (/** @type {RegExp} */ name) => {
        await clearDice();
        await dropToasts();
        const tokens = page.locator('#game-shell .wm-token.wm-token-enemy:not(.wm-token-idle)');
        const count = await tokens.count();
        for (let i = 0; i < count; i++) {
            const token = tokens.nth(i);
            const label = await token.getAttribute('title').catch(() => '') || await token.textContent().catch(() => '') || '';
            if (!name.test(label)) continue;
            await token.click({ timeout: 4000 }).catch(() => {});
            if (await until(() => page.evaluate(() => Boolean(document.querySelector('.tc-card'))), 3000)) return true;
        }
        await tokens.first().click({ timeout: 4000 }).catch(() => {});
        return until(() => page.evaluate(() => Boolean(document.querySelector('.tc-card'))), 3000);
    };
    /** Pulsar un botón de la tarjeta del objetivo. */
    const cardButton = (/** @type {RegExp} */ label) => page.evaluate((source) => {
        const button = [...document.querySelectorAll('.tc-card .tc-btn')].find(b => new RegExp(source).test(b.textContent || ''));
        const info = { found: Boolean(button), disabled: button instanceof HTMLButtonElement ? button.disabled : null, title: button?.getAttribute('title') || '',
            all: [...document.querySelectorAll('.tc-card .tc-btn')].map(b => (b.textContent || '').trim()) };
        if (button instanceof HTMLButtonElement && !button.disabled) button.click();
        return info;
    }, label.source);

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    const firstRun = page.locator('text=Welcome to SillyTavern!');
    if (await firstRun.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#game-shell', { timeout: 90000 });

    // 1. Iria, druida: la que invoca y pone zonas.
    const offline = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Jugar sin conexión' });
    await until(async () => await offline.count() === 1, 30000);
    await offline.click();
    await page.waitForSelector('.hc-root', { timeout: 120000 });
    await page.fill('.hc-root .hc-name', 'Iria');
    await page.locator('.hc-root .hc-gender[data-value="Mujer"]').click({ timeout: 5000 }).catch(() => {});
    await pickHeroCard(page, 'race', 'Humano');
    const heroClass = await pickHeroCard(page, 'class', 'Druida');
    await page.locator('.hc-root .hc-enter').click();
    const inHub = await until(async () => {
        const now = await state();
        return /Gremio/.test(now.world) && now.party.length === 1 && now.party[0].name === 'Iria';
    }, 60000);
    check('Iria, druida, empieza en el gremio', inHub && /druid/i.test(heroClass), JSON.stringify({ heroClass }));
    await page.waitForTimeout(1200);

    // 2. Saltar la prueba (J2.3), y con ella salen el tablón y contratar (D-J28). Tanda 10: en el
    // tablero del muelle no sale; primero se sale de él.
    await until(async () => (await chips()).some(c => /^(Saltar la prueba|Salir del tablero)$/.test(c)), 20000);
    if ((await chips()).includes('Salir del tablero')) await clickChip(/^Salir del tablero$/);
    await until(async () => (await chips()).some(c => /^Saltar la prueba$/.test(c)), 20000);
    await clickChip(/^Saltar la prueba$/);
    await page.waitForSelector('.popup:has-text("¿Saltar la prueba?")', { timeout: 10000 }).catch(() => {});
    await page.locator('.popup-button-ok:visible').first().click({ timeout: 5000 }).catch(() => {});
    await until(() => chatHas(/apunta tu nombre en el libro del gremio/), 20000);
    await page.waitForTimeout(800);
    await clearDice();
    await dropToasts();
    const canHire = await until(async () => (await chips()).some(c => /Contratar mercenarios/.test(c)), 15000);
    await clickChip(/Contratar mercenarios/);
    await page.waitForSelector('.hb-root [data-hireling="Gerd el Mellado"]', { timeout: 15000 }).catch(() => {});
    await page.locator('.hb-root [data-hireling="Gerd el Mellado"]').click({ timeout: 5000 }).catch(() => {});
    const hired = await until(async () => (await state()).party.length === 2, 10000);
    check('saltada la prueba, se contrata a Gerd', canHire && hired, JSON.stringify((await state()).party));

    // 3. Al tablón: La Maldición de Strahd, que empieza en la Taberna con la bruja.
    await page.evaluate(() => document.querySelectorAll('.popup:not([closing]) .popup-button-ok, .popup:not([closing]) .popup-button-cancel').forEach(b => /** @type {HTMLElement} */ (b).click()));
    await page.waitForTimeout(500);
    await clickChip(/Tablón de campañas/);
    await page.waitForSelector('.hb-root [data-campaign="strahd"]', { timeout: 15000 }).catch(() => {});
    await page.locator('.hb-root [data-campaign="strahd"]').click({ timeout: 5000 }).catch(() => {});
    const inStrahd = await until(async () => /Strahd/.test((await state()).world) && (await state()).board === 'Taberna Sangre de la Enredadera', 150000);
    await page.waitForTimeout(1500);
    await clearDice();
    await dropToasts();
    let now = await state();
    check('Strahd empieza en la Taberna, con Iria y Gerd', inStrahd && now.party.length === 2, JSON.stringify(now));

    // 4. La mesa, puesta a mano: Iria de nivel 5 con su rama de muérdago y sus conjuros de
    // druida; Gerd, mago de nivel 5, con Contraconjuro y Escudo. Y la bruja trae lo suyo del paquete.
    // Iria, con Constitución 30: los dardos de la bruja le piden tres salvaciones de
    // concentración, y perderla antes de tiempo se llevaba a los lobos antes del Rayo de luna.
    // Romperla se mira aparte, con el dado puesto (paso 12).
    const setup = await page.evaluate(async () => {
        const party = /** @type {any[]} */ ((await import('/scripts/party/state.js')).partyMembers);
        const dnd = await import('/scripts/dnd-system.js');
        const roster = await import('/scripts/party/roster.js');
        const [iria, gerd] = party;
        Object.assign(iria, {
            level: 5, class: 'Druida', wisdom: 18, constitution: 30, hp: 44, maxHp: 44, slotsUsed: {}, concentration: null,
            cantrips: ['conj-producir-llama', 'conj-rociada-venenosa'],
            prepared: ['conj-conjurar-animales', 'conj-rayo-luna', 'hab-espinas', 'conj-fuego-feerico'],
        });
        iria.items = Array.isArray(iria.items) ? iria.items : [];
        dnd.addItemToInventory(iria, dnd.createItem(/** @type {any} */ ({ name: 'Rama de muérdago', type: 'misc', description: 'Foco de druida.' })));
        Object.assign(gerd, {
            level: 5, class: 'Mago', intelligence: 16, hp: 40, maxHp: 40, slotsUsed: {}, concentration: null,
            cantrips: ['mag-escarcha', 'hab-rayo-fuego', 'mag-luz'],
            spellbook: ['conj-contraconjuro', 'hab-escudo-arcano', 'conj-proyectil-magico'],
            prepared: ['conj-contraconjuro', 'hab-escudo-arcano', 'conj-proyectil-magico'],
        });
        roster.savePartyState();
        const wi = await import('/scripts/world-info.js');
        const witch = wi.getCurrentWorldEnemies().find((/** @type {any} */ e) => /Bruja Baroviana/.test(e.name));
        return { iria: iria.class, gerd: gerd.class, witchSpells: witch?.spellcasting ?? null };
    });
    check('J19.12: la plantilla de la bruja trae su bloque de conjuros desde el paquete (importador y mundo)',
        Array.isArray(setup.witchSpells?.spells) && setup.witchSpells.spells.includes('conj-proyectil-magico'), JSON.stringify(setup));

    // 5. J7.3 y D-J32: la ficha de Gerd sin «Quién le mueve» hasta el vínculo de amigo, y con él.
    const openCard = async (/** @type {string} */ who) => {
        await dropToasts();
        await page.evaluate(() => document.querySelectorAll('.cc-overlay').forEach(c => c.remove()));
        const clicked = await page.evaluate((name) => {
            const chip = [...document.querySelectorAll('#game-shell .gs-chip.gs-chip-clickable')]
                .find(c => /** @type {HTMLElement} */ (c).offsetParent !== null && (c.getAttribute('title') || '').includes(name));
            if (chip instanceof HTMLElement) chip.click();
            return Boolean(chip);
        }, who);
        if (!clicked) {
            await page.evaluate(async (name) => {
                const party = /** @type {any[]} */ ((await import('/scripts/party/state.js')).partyMembers);
                const member = party.find(m => String(m.name).includes(name));
                if (member) (await import('/scripts/party/companions.js')).openCompanionCard(String(member.id));
            }, who);
        }
        await page.waitForSelector('.cc-card', { timeout: 8000 }).catch(() => {});
        return {
            clicked,
            name: await page.evaluate(() => (document.querySelector('.cc-card .cc-name')?.textContent || '').trim()),
            control: await page.evaluate(() => [...document.querySelectorAll('.cc-card .cc-control-btn')].map(b => ({
                side: b.getAttribute('data-control'), text: (b.textContent || '').trim(), active: b.classList.contains('active') }))),
        };
    };
    const closeCard = () => page.evaluate(() => document.querySelectorAll('.cc-overlay').forEach(c => c.remove()));
    const cardBefore = await openCard('Gerd');
    await closeCard();
    await page.evaluate(async () => {
        const party = /** @type {any[]} */ ((await import('/scripts/party/state.js')).partyMembers);
        const time = await import('/scripts/party/time.js');
        const bondsMod = await import('/scripts/game-engine/campaign/bonds.js');
        let bonds = time.getCampaignBonds();
        for (let i = 0; i < 12 && bondsMod.getRank(bonds, String(party[1].id)) < 5; i++) {
            bonds = bondsMod.recordBondEvent(bonds, String(party[1].id), 'quest_together').state;
        }
        time.saveCampaignState(null, bonds);
    });
    const cardAfter = await openCard('Gerd');
    await shoot('la ficha de Gerd, con «Quién le mueve»');
    await closeCard();
    check('J7.3: la ficha de Gerd no ofrece «Quién le mueve» antes del vínculo de amigo, y sí con él: «Lo muevo yo», puesto',
        cardBefore.control.length === 0 && /Gerd/.test(cardAfter.name) && cardAfter.control.length === 2
        && cardAfter.control.some(c => c.side === 'player' && c.active && /Lo muevo yo/.test(c.text))
        && cardAfter.control.some(c => c.side === 'engine' && /Que lo lleve el juego/.test(c.text)),
        JSON.stringify({ cardBefore, cardAfter }));

    // 6. La pelea con la bruja. Con mucha vida, para que dure lo que hace falta mirar.
    // Tanda 10: ya no hay ficha de «Iniciar combate»; la pelea empieza sola (decidir, colocarse, «Empezar»).
    const fightStart = await chatLength();
    const witchOffered = await entrarEnLaPelea(page);
    await until(async () => (await fight()).active, 10000);
    await clearDice();
    await page.evaluate(async () => {
        const enc = /** @type {any} */ ((await import('/scripts/party.js')).getCombatEncounter());
        for (const e of enc.enemies) Object.assign(e, { currentHp: 200, maxHp: 200 });
    });
    let seen = await fight();
    const witch = seen.enemies.find(e => /Bruja Baroviana/.test(e.name));
    check('J19.12: la bruja del tablero sale con sus conjuros (el bloque pasa de la plantilla a la pelea)',
        witchOffered && seen.active && Boolean(witch?.spellcasting), JSON.stringify(seen.enemies));

    // 7. Iria invoca: dos lobos detrás de ella en la iniciativa, en el tablero y con su botón.
    const heroTurn = await toTurnOf(turn => turn.name === 'Iria');
    const beforeCast = await chatLength();
    await openFoeCard(/Bruja/);
    const summonButton = await cardButton(/Conjurar animales/);
    await page.waitForTimeout(800);
    await clearDice();
    seen = await fight();
    const wolves = seen.summons;
    const heroAt = seen.order.findIndex(e => e.name === 'Iria');
    const wolfIds = wolves.map(w => w.id);
    const afterHero = seen.order.slice(heroAt + 1, heroAt + 1 + wolves.length).map(e => e.id);
    const summonView = await page.evaluate((ids) => ({
        tokens: ids.filter(id => document.querySelector(`#game-shell .wm-token.wm-token-summon[data-token-id="${id}"]`)).length,
        rows: [...document.querySelectorAll('#game-shell .wm-init-row .wm-init-name')].map(n => (n.textContent || '').trim()),
        control: [...document.querySelectorAll('#game-shell .wm-combat-control-btn')].map(b => ({ id: b.getAttribute('data-control-id'), control: b.getAttribute('data-control'), text: (b.textContent || '').trim() })),
    }), wolfIds);
    check('J19.5: «Conjurar animales» desde la tarjeta de la bruja trae dos lobos, que entran en la iniciativa justo detrás de Iria',
        heroTurn && summonButton.found && wolves.length === 2 && JSON.stringify(afterHero) === JSON.stringify(wolfIds),
        JSON.stringify({ summonButton, wolves, order: seen.order }));
    check('J19.5: los lobos tienen su ficha en el tablero y su fila en la iniciativa',
        summonView.tokens === 2 && wolves.every(w => summonView.rows.includes(w.name)), JSON.stringify(summonView));
    check('J7.3: el panel del combate dice quién mueve a cada lobo y a Gerd («Lo muevo yo»)',
        wolves.every(w => summonView.control.some(c => c.id === w.id && c.control === 'player' && /Lo muevo yo/.test(c.text)))
        && summonView.control.some(c => /Gerd/.test(c.text)), JSON.stringify(summonView.control));
    check('J19.4: Iria se concentra en los lobos', /se concentra en Conjurar animales/.test(await chatSince(beforeCast)));
    await shoot('los lobos en la iniciativa y en el tablero');

    // 8. Uno de los lobos, al juego: pulsar su botón.
    await dropToasts();
    await page.locator(`#game-shell .wm-combat-control-btn[data-control-id="${wolfIds[0]}"]`).click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
    seen = await fight();
    check('J7.3: pulsar el botón del primer lobo se lo deja al juego («Que lo lleve el juego»)',
        seen.summons.find(s => s.id === wolfIds[0])?.control === 'engine'
        && await page.evaluate((id) => /Que lo lleve el juego/.test(document.querySelector(`#game-shell .wm-combat-control-btn[data-control-id="${id}"]`)?.textContent || ''), wolfIds[0]),
        JSON.stringify(seen.summons));

    // 9. Fin del turno de Iria: el primer lobo juega solo; el segundo espera a que lo muevas tú.
    const beforeWolves = await chatLength();
    await endTurn();
    const wolfTwoTurn = await until(async () => (await fight()).turn?.id === wolfIds[1], 8000);
    const wolfLog = await chatSince(beforeWolves);
    // Tanda 10: de quién es el turno lo dice la cabecera de la iniciativa, arriba a la derecha.
    const turnPanel = await page.evaluate(() => (document.querySelector('#game-shell .vtt-init .wm-init-head')?.textContent || '').replace(/\s+/g, ' ').trim());
    check('J19.5 y J7.3: el lobo que lleva el juego decide solo; al segundo le toca y lo mueves tú',
        new RegExp(`${wolves[0].name}[^\\n]*decide por su cuenta`).test(wolfLog) && wolfTwoTurn && new RegExp(`Turno de ${wolves[1].name}`).test(turnPanel),
        JSON.stringify({ wolfLog: wolfLog.slice(0, 400), turnPanel }));
    // Pulsar su ficha la elige: se encienden las casillas a las que llega.
    await clearDice();
    await dropToasts();
    await page.locator(`#game-shell .wm-token[data-token-id="${wolfIds[1]}"]`).click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(500);
    const lit = await page.evaluate(() => document.querySelectorAll('#game-shell .wm-highlight-cell.wm-highlight-move').length);
    check('J19.5: pulsar la ficha del lobo en su turno lo elige y enciende hasta dónde anda', lit > 0, String(lit));
    await shoot('el turno del segundo lobo');

    // 10. La bruja lanza, y Gerd, mago, se lo corta (J19.7); lo que gasta es su espacio (J19.12).
    // Desde el principio de la pelea: con dos brujas (el ajuste por nivel pone una más), la
    // primera puede lanzar antes de que le toque a Iria.
    await endTurn();
    const witchActed = await toTurnOf(turn => turn.name === 'Iria', 16);
    const witchLog = await chatSince(fightStart);
    seen = await fight();
    const casters = seen.enemies.filter(e => /Bruja Baroviana/.test(e.name));
    const castTried = /Bruja Baroviana[^\n]*(lanza|usa) (Proyectil mágico|Rayo de escarcha)/.test(witchLog);
    check('J19.12: en su turno, la bruja usa sus conjuros del paquete (Proyectil mágico o Rayo de escarcha)',
        witchActed && castTried, witchLog.split('\n').filter(l => /Bruja|Contraconjuro/.test(l)).slice(0, 8).join(' | '));
    check('J19.7 y J19.12: el primer Proyectil mágico de una bruja lo corta Gerd con Contraconjuro, y ella gasta su espacio de 1.er nivel',
        /Bruja Baroviana[^\n]* lanza Proyectil mágico/.test(witchLog) && /Contraconjuro/.test(witchLog)
        && casters.some(e => Number(e.slotsUsed?.[1]) === 1),
        JSON.stringify({ slots: casters.map(e => e.slotsUsed), lines: witchLog.split('\n').filter(l => /Contraconjuro|Proyectil|contrarresta|corta/.test(l)).slice(0, 6) }));

    // 11. Rayo de luna sobre la bruja: los lobos se van (la concentración cambia) y la luz la
    // quema al empezar su turno.
    const beforeMoon = await chatLength();
    await openFoeCard(/Bruja/);
    const moonButton = await cardButton(/Rayo de luna/);
    await page.waitForTimeout(800);
    await clearDice();
    seen = await fight();
    const moonLog = await chatSince(beforeMoon);
    check('J19.4 y J19.5: Rayo de luna cambia la concentración: los lobos se desvanecen y sale su zona',
        moonButton.found && seen.summons.length === 0 && /se desvanece/.test(moonLog) && seen.zones.some(z => z.kind === 'luz_de_luna')
        && !seen.order.some(e => wolfIds.includes(e.id) && e.id !== seen.turn?.id),
        JSON.stringify({ moonButton, summons: seen.summons, zones: seen.zones, moonLog: moonLog.slice(0, 300) }));
    await shoot('el rayo de luna sobre la bruja');
    const beforeBurn = await chatLength();
    await endTurn();
    await toTurnOf(turn => turn.name === 'Iria', 16);
    const burnLog = await chatSince(beforeBurn);
    check('J19.6: la bruja empieza su turno dentro del Rayo de luna, y le salta',
        /Bruja Baroviana empieza su turno en Rayo de luna/.test(burnLog), burnLog.split('\n').filter(l => /Rayo de luna|luna/.test(l)).slice(0, 4).join(' | '));

    // 12. J19.4: un golpe a quien se concentra pide la salvación de Constitución. Por la misma
    // puerta que usa cualquier golpe de un enemigo (`damagePartyMember`).
    const hurtLines = await page.evaluate(async () => {
        const party = /** @type {any[]} */ ((await import('/scripts/party/state.js')).partyMembers);
        return (await import('/scripts/party/enemy-turn.js')).damagePartyMember(party[0], 6, false);
    });
    check('J19.4: un golpe a Iria, que se concentra, pide aguantar la concentración',
        hurtLines.some((/** @type {string} */ l) => /aguanta la concentración en Rayo de luna/.test(l)), hurtLines.join(' | '));

    // 12b. J19.4: y un golpe la rompe. Con su Constitución de verdad (14) y el dado puesto a 1,
    // la salvación no llega: se acaba el Rayo de luna, y su zona se va con él.
    const broken = await page.evaluate(async () => {
        const party = /** @type {any[]} */ ((await import('/scripts/party/state.js')).partyMembers);
        const rules = await import('/scripts/party/combat-rules.js');
        party[0].constitution = 14;
        rules.setRandomSource(() => 0);
        const lines = (await import('/scripts/party/enemy-turn.js')).damagePartyMember(party[0], 6, false);
        rules.setRandomSource(null);
        const enc = /** @type {any} */ ((await import('/scripts/party.js')).getCombatEncounter());
        return { lines, concentration: party[0].concentration ?? null, zones: (enc.spellZones ?? []).map((/** @type {any} */ z) => z.kind) };
    });
    check('J19.4: con un 1 en el dado, el golpe rompe la concentración de Iria y el Rayo de luna se apaga',
        broken.lines.some((/** @type {string} */ l) => /La pierde: se acaba Rayo de luna/.test(l)) && broken.concentration === null && !broken.zones.includes('luz_de_luna'),
        JSON.stringify(broken));

    // 12c. J19.7: Escudo. Una bruja le pega a Gerd con el dado puesto: el primer número con el que
    // el golpe entraría (por poco) lo para su Escudo, que gasta un espacio de 1.er nivel y le deja
    // +5 a la CA hasta su turno. Su reacción de esta ronda, libre (la del Contraconjuro fue otra).
    const shielded = await page.evaluate(async () => {
        const party = /** @type {any[]} */ ((await import('/scripts/party/state.js')).partyMembers);
        const state = await import('/scripts/party/state.js');
        const rules = await import('/scripts/party/combat-rules.js');
        const turn = await import('/scripts/party/enemy-turn.js');
        const enc = /** @type {any} */ ((await import('/scripts/party.js')).getCombatEncounter());
        const gerd = party[1];
        const witch = enc.enemies.find((/** @type {any} */ e) => /Bruja/.test(e.name) && Number(e.currentHp) > 0);
        state.usedReactions.delete(`party:${gerd.id}`);
        const before = { hp: gerd.hp, first: Number(gerd.slotsUsed?.[1]) || 0 };
        let said = '';
        let natural = 0;
        for (let k = 2; k <= 19 && witch; k++) {
            rules.setRandomSource(() => (k - 1) / 20 + 0.001);
            said = turn.resolveEnemyAttackOn(witch, gerd);
            natural = k;
            if (!/Resultado: fallo/.test(said) || /Escudo/.test(said)) break;
        }
        rules.setRandomSource(null);
        return { said, natural, before, hp: gerd.hp, first: Number(gerd.slotsUsed?.[1]) || 0, shielded: (enc.shielded ?? []).map(String), gerd: String(gerd.id) };
    });
    await clearDice();
    check('J19.7: un golpe que entraba por poco en Gerd lo para su Escudo, que gasta un espacio de 1.er nivel y le sube la CA hasta su turno',
        /reacciona: Escudo/.test(shielded.said) && /el golpe ya no entra/.test(shielded.said) && shielded.hp === shielded.before.hp
        && shielded.first === shielded.before.first + 1 && shielded.shielded.includes(shielded.gerd),
        JSON.stringify({ ...shielded, said: shielded.said.split('\n').slice(0, 5).join(' | ') }));

    // 12d. J7.3: a Gerd, amigo, lo mueves tú: en su turno, pulsar su ficha enciende hasta dónde
    // anda, y pulsar una casilla lo lleva allí.
    const gerdTurn = await toTurnOf(turn => /Gerd/.test(turn.name), 16);
    await clearDice();
    await dropToasts();
    const gerdIdNow = String((await state()).party[1].id);
    await page.locator(`#game-shell .wm-token[data-token-id="${gerdIdNow}"]`).click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(500);
    const gerdCell = await page.evaluate(async () => {
        const party = /** @type {any[]} */ ((await import('/scripts/party/state.js')).partyMembers);
        const enc = /** @type {any} */ ((await import('/scripts/party.js')).getCombatEncounter());
        const taken = new Set([
            ...party.map(m => `${m.mapPosition?.gridX},${m.mapPosition?.gridY}`),
            ...(enc.enemies ?? []).map((/** @type {any} */ e) => `${e.gridX},${e.gridY}`),
        ]);
        const free = [...document.querySelectorAll('#game-shell .wm-highlight-move.wm-highlight-clickable')]
            .map(node => ({ x: Number(/** @type {HTMLElement} */ (node).dataset.x), y: Number(/** @type {HTMLElement} */ (node).dataset.y) }))
            .filter(cell => !taken.has(`${cell.x},${cell.y}`));
        return { from: { x: party[1].mapPosition?.gridX, y: party[1].mapPosition?.gridY }, to: free[free.length - 1] ?? null, lit: free.length };
    });
    if (gerdCell.to) {
        await page.locator(`#game-shell .wm-highlight-move.wm-highlight-clickable[data-x="${gerdCell.to.x}"][data-y="${gerdCell.to.y}"]`).first().click({ timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(1000);
        await clearDice();
    }
    const gerdAt = await page.evaluate(async () => {
        const party = /** @type {any[]} */ ((await import('/scripts/party/state.js')).partyMembers);
        return { x: party[1].mapPosition?.gridX, y: party[1].mapPosition?.gridY };
    });
    check('J7.3: en su turno, a Gerd lo mueves tú: su ficha enciende hasta dónde anda y una casilla pulsada lo lleva allí',
        gerdTurn && gerdCell.lit > 0 && Boolean(gerdCell.to) && gerdAt.x === gerdCell.to?.x && gerdAt.y === gerdCell.to?.y,
        JSON.stringify({ gerdTurn, gerdCell, gerdAt }));
    await shoot('Gerd, movido a mano');
    await toTurnOf(turn => turn.name === 'Iria', 16);

    // 13. J7.3: Gerd, devuelto al juego desde el panel, juega solo su turno.
    await dropToasts();
    const gerdId = (await state()).party[1].id;
    await page.locator(`#game-shell .wm-combat-control-btn[data-control-id="${gerdId}"]`).click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(400);
    const beforeGerd = await chatLength();
    const gerdEngine = (await state()).party[1].control === 'engine';
    await endTurn();
    await toTurnOf(turn => turn.name === 'Iria', 16);
    const gerdLog = await chatSince(beforeGerd);
    check('J7.3: Gerd, devuelto al juego con su botón, decide solo en su turno',
        gerdEngine && /Gerd el Mellado[^\n]*decide por su cuenta/.test(gerdLog), gerdLog.split('\n').filter(l => /Gerd/.test(l)).slice(0, 4).join(' | '));

    // 14. Ganar: Iria herida y Gerd entero; con la charla de después segura. Y las ventanas de
    // historia, encendidas: ganar la Taberna abre el Asedio en la Mansión, con su escena (D-J45).
    await page.evaluate(async () => {
        window.localStorage.setItem('sillytavern_gameStoryWindows', 'on');
        const party = /** @type {any[]} */ ((await import('/scripts/party/state.js')).partyMembers);
        party[0].hp = Math.floor(party[0].maxHp * 0.3);
        party[1].hp = party[1].maxHp;
        // Iria sale herida: el momento de la charla es «Vas mal» (`herido`), no «Tras la pelea».
        const { MOMENTS } = await import('/scripts/game-engine/campaign/small-talk.js');
        MOMENTS.pelea.chance = 1;
        MOMENTS.herido.chance = 1;
        const enc = /** @type {any} */ ((await import('/scripts/party.js')).getCombatEncounter());
        for (const e of enc.enemies) e.currentHp = 0;
    });
    const beforeWin = await chatLength();
    for (let i = 0; i < 8 && (await fight()).active; i++) {
        await page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/combat-end'));
        await page.waitForTimeout(700);
        await clearDice();
    }
    const victory = await until(async () => await page.locator('.vs-card').count() > 0, 8000);
    const talkToast = await until(() => page.evaluate(() => [...document.querySelectorAll('#toast-container .toast')].some(t => /quiere decirte algo/.test(t.textContent || ''))), 8000);
    await shoot('ganar: el panel y la charla de después');
    const winLog = await chatSince(beforeWin);
    seen = await fight();
    const leftovers = await page.evaluate(async () => {
        const party = /** @type {any[]} */ ((await import('/scripts/party/state.js')).partyMembers);
        return { concentration: party.map(m => m.concentration ?? null), meta: window.SillyTavern.getContext().chatMetadata?.combatEncounter?.summons?.length ?? 0 };
    });
    check('J13.3: el final de la pelea dice «Iria sale malherida», en femenino', /Iria sale malherida/.test(winLog), (winLog.match(/.{0,60}malherid.{0,20}/) ?? [''])[0]);
    check('ganar saca el panel de victoria', victory);
    check('J14.1: tras ganar, alguien del grupo quiere decirte algo', talkToast,
        JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('#toast-container .toast')].map(t => (t.textContent || '').trim().slice(0, 80)))));
    check('J19: al acabar, ni lobos, ni zonas, ni concentraciones de la pelea', !seen.active && leftovers.meta === 0 && leftovers.concentration.every(c => c === null),
        JSON.stringify(leftovers));
    // La charla: pulsar «Escuchar» abre la escena de Gerd.
    await page.locator('#toast-container .gs-talk-listen').first().click({ timeout: 4000 }).catch(() => {});
    const talkOpen = await until(() => page.evaluate(() => Boolean(document.querySelector('dialog[open]'))), 8000);
    check('J14.1: «Escuchar» abre lo que tiene que decir', talkOpen);
    await shoot('la charla después de ganar');

    // 15. D-J45: tras ganar, «Continuar» sigue el hilo. Primero, la escena que ha abierto la
    // victoria (el Asedio en la Mansión). Luego, lo que toca en la campaña, que está en otro
    // tablero: «Continuar» saca de la Taberna y enseña la Aldea, desde donde se va.
    // (Si la tarjeta de victoria se ha cerrado sola, la escena ya ha salido: es lo mismo.)
    await page.evaluate(() => document.querySelectorAll('dialog[open]:not(.ps-dialog)').forEach(d => /** @type {HTMLDialogElement} */ (d).close()));
    await dropToasts();
    const continueChip = () => page.evaluate(() => {
        const chip = document.querySelector('#game-shell .gs-vn-box .gs-chip-continue');
        return {
            scene: document.querySelector('#game-shell')?.getAttribute('data-scene') || '',
            after: chip?.getAttribute('data-after') || '', next: chip?.getAttribute('data-next') || '', title: chip?.getAttribute('title') || '',
            victory: Boolean(document.querySelector('.vs-card')),
        };
    });
    const sceneOpen = () => page.evaluate(() => Boolean(document.querySelector('dialog.ps-dialog[open]')));
    await until(async () => await sceneOpen() || (await continueChip()).after !== '', 8000);
    const storyFirst = { ...(await continueChip()), already: await sceneOpen() };
    if (!storyFirst.already) await page.locator('#game-shell .gs-vn-box .gs-chip-continue').first().click({ timeout: 5000 }).catch(() => {});
    const sceneShown = await until(sceneOpen, 8000);
    const sceneId = await page.evaluate(() => document.querySelector('dialog.ps-dialog[open] .ps-root')?.getAttribute('data-scene') || '');
    await shoot('«Continuar» tras ganar: primero, la escena del Asedio');
    check('D-J45: tras ganar, si la victoria abre una escena, «Continuar» lleva a ella: la del Asedio en la Mansión',
        (storyFirst.already || (storyFirst.after === 'story' && storyFirst.victory)) && sceneShown && /asedio/i.test(sceneId),
        JSON.stringify({ storyFirst, sceneShown, sceneId }));
    // La escena, jugada entera: la primera opción que se pueda y seguir.
    for (let i = 0; i < 40 && await sceneOpen(); i++) {
        const option = page.locator('dialog.ps-dialog[open] .dw-option:not(.dw-locked)').first();
        if (await option.count() > 0) await option.click({ timeout: 3000 }).catch(() => {});
        else await page.locator('dialog.ps-dialog[open] .ps-next, dialog.ps-dialog[open] .ps-finish').first().click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(250);
    }
    await clearDice();
    await dropToasts();
    await until(async () => (await continueChip()).after === 'next', 8000);
    const onward = await continueChip();
    await page.locator('#game-shell .gs-vn-box .gs-chip-continue').first().click({ timeout: 5000 }).catch(() => {});
    const leftTavern = await until(async () => (await state()).board === ''
        && await page.evaluate(() => document.querySelector('#game-shell')?.getAttribute('data-scene') === 'exploration'), 8000);
    await shoot('«Continuar» tras ganar: la Aldea, camino de la Mansión');
    check('D-J45: tras ganar, «Continuar» lleva a lo siguiente de la campaña: sale de la Taberna a la Aldea, camino del Asedio en la Mansión',
        onward.scene === 'dialogue' && onward.after === 'next' && onward.next === 'exploration' && /^Lo siguiente: Asedio en la Mansión/.test(onward.title) && leftTavern,
        JSON.stringify({ onward, now: await state(), scene: await page.evaluate(() => document.querySelector('#game-shell')?.getAttribute('data-scene')) }));

    check('sin errores en la página', problems.length === 0, problems.slice(0, 6).join('\n        '));
} catch (error) {
    failures++;
    console.log(`FAIL  the run threw: ${/** @type {any} */ (error)?.message || error}`);
    if (SHOT && page) await page.screenshot({ path: `${SHOT.replace(/\.png$/i, '')}-error.png` }).catch(() => {});
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
