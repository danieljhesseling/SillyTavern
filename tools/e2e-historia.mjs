#!/usr/bin/env node
/**
 * La historia de 1387 jugada en sus ventanas (J9.2, J8, J10 y las caras de la novela de
 * wiki/ROADMAP_SIN_CONEXION.md), sin modelo, contra un servidor propio con un `--dataRoot`
 * temporal, como las otras vueltas:
 *
 *   la partida empieza con la escena del cáliz en su ventana (el narrador sin cara, Torres
 *   enfadado, una decisión) → ganar en el cuarto de la posada → la escena siguiente espera a que
 *   se cierre el panel de victoria → la escena de la huida acaba en la charla de Giles, que
 *   cumple su hito cuando lo cuenta → lo que se ve al examinar algo del pueblo, si la tirada
 *   sale → «Hablar» con Giles abre su charla directamente, con «Otras cosas» (D-J36) → lo que
 *   dice sale en la novela con su cara y su gesto → viajar abre las escenas de los hitos 3 y 4 →
 *   la de Karl ya es la charla y cumple su hito (D-J39) → el hito siguiente, que solo trae
 *   texto, se abre como una escena corta del narrador (D-J40) → el Diario apunta lo decidido y
 *   lo que os han contado → la estación de hoy llega al narrador (J13).
 *
 *   Y en otra pestaña, el prólogo del gremio: la escena del muelle → ganar al ratero → la
 *   escena de Tomás cumple su hito (D-J39) → la de Brunilda no, porque lo cumple su charla
 *   escrita, que «Hablar con Brunilda» abre directamente (D-J36) → la escena de la prueba.
 *
 * Uso:
 *   node tools/e2e-historia.mjs                                   # sin ventana
 *   node tools/e2e-historia.mjs --headed
 *   node tools/e2e-historia.mjs --port 8189 --captura historia.png  # historia-01-caliz.png…
 */

/* global window, document */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8157;
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

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-historia-'));
/** @type {any} */
let server = null;
/** @type {any} */
let browser = null;

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
    /** @type {string[]} */
    const problems = [];
    /** Una pestaña nueva, con su almacenamiento limpio (la segunda parte, el gremio, usa otra). */
    const newPage = async () => {
        const context = await browser.newContext({ viewport: { width: 1400, height: 950 } });
        const opened = await context.newPage();
        opened.on('pageerror', e => problems.push(`PAGEERROR ${e.message}`));
        opened.on('console', m => {
            if (m.type() === 'error' && !/Failed to load resource.*404/.test(m.text())) problems.push(`ERROR ${m.text().slice(0, 300)}`);
        });
        await context.addInitScript(() => {
            try {
                window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,combat,travel,prisoners,mesa,high,spell,pet,bill,move,attack,roll,talk,journal');
                window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
                window.localStorage.setItem('sillytavern_gameSucesos', 'off');
            } catch { /* nada */ }
        });
        return opened;
    };
    let page = await newPage();

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
    const slash = async (/** @type {string} */ command) => {
        const done = page.evaluate((c) => window.SillyTavern.getContext().executeSlashCommandsWithOptions(c).then(() => 'ok').catch((/** @type {any} */ e) => `error: ${e?.message || e}`), command);
        const said = await Promise.race([done, new Promise(resolve => setTimeout(() => resolve('timeout'), 25000))]);
        await page.waitForTimeout(500);
        return said;
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
            done: [...(m.plotState?.done || [])], open: [...(m.plotState?.open || [])], played: [...(m.plotScenesPlayed || [])],
            decisions: (m.plotDecisions || []).map((/** @type {any} */ d) => String(d.text)), attitudes: m.attitudes?.values || {},
            heard: [...(m.rumorsHeard || [])], dialogues: m.dialogues || {},
        };
    });
    const chatTexts = () => page.evaluate(() => (window.SillyTavern.getContext().chat || []).map((/** @type {any} */ m) => String(m.extra?.display_text ?? m.mes ?? '')));
    const chips = () => page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-chip-action')].map(c => (c.textContent || '').trim()));
    const clickChip = (/** @type {RegExp} */ pattern) => page.evaluate((source) => {
        const chip = [...document.querySelectorAll('#game-shell .gs-chip-action')].find(b => new RegExp(source).test(b.textContent || ''));
        if (chip instanceof window.HTMLElement) chip.click();
        return Boolean(chip);
    }, pattern.source);
    /** La ventana de historia abierta: una escena del hilo o una charla escrita. */
    const story = () => page.evaluate(() => {
        const scene = document.querySelector('dialog.ps-dialog[open] .ps-root');
        const talk = document.querySelector('dialog.dw-dialog[open]:not(.ps-dialog) .dw-root');
        const root = scene ?? talk;
        if (!root) return null;
        const portrait = /** @type {HTMLElement|null} */ (root.querySelector('.qd-portrait'));
        const face = /** @type {HTMLImageElement|null} */ (portrait?.querySelector('img'));
        return {
            kind: scene ? 'scene' : 'dialogue',
            id: scene ? root.getAttribute('data-scene') || '' : root.getAttribute('data-dialogue') || '',
            narrator: root.classList.contains('ps-narrator'),
            plate: (root.querySelector('.qd-nameplate')?.textContent || '').trim(),
            plateShown: !(/** @type {HTMLElement|null} */ (root.querySelector('.qd-nameplate')))?.hidden,
            mood: portrait?.dataset.mood || '',
            face: face && face.complete && face.naturalWidth > 0 ? String(face.getAttribute('src')) : '',
            text: (root.querySelector('.qd-text')?.textContent || '').replace(/\s+/g, ' ').trim(),
            options: [...root.querySelectorAll('.dw-option')].map(o => ({ id: o.getAttribute('data-option') || '', locked: o.classList.contains('dw-locked') })),
            extras: [...root.querySelectorAll('.dw-extra')].map(o => o.getAttribute('data-extra') || ''),
            finish: (root.querySelector('.qd-chip-finish')?.textContent || '').trim(),
        };
    });
    /**
     * Jugar la escena abierta: seguir, y en cada decisión la primera de `pick` que se pueda, o la
     * primera abierta. Para al acabar o si la escena da paso a una charla. Devuelve lo que se vio.
     */
    const playScene = async (/** @type {string[]} */ pick = []) => {
        /** @type {any[]} */
        const frames = [];
        for (let i = 0; i < 60; i++) {
            const now = await story();
            if (!now || now.kind !== 'scene') break;
            // La siguiente escena puede abrirse enseguida: esa ya no es de esta jugada.
            if (frames.length > 0 && now.id !== frames[0].id) break;
            frames.push(now);
            const free = now.options.filter((/** @type {any} */ o) => !o.locked);
            if (free.length > 0) {
                const choice = pick.find(id => free.some((/** @type {any} */ o) => o.id === id)) ?? free[0].id;
                await page.locator(`dialog.ps-dialog[open] .dw-option[data-option="${choice}"]`).click({ timeout: 4000 }).catch(() => {});
            } else {
                await page.locator('dialog.ps-dialog[open] .ps-next, dialog.ps-dialog[open] .ps-finish').first().click({ timeout: 4000 }).catch(() => {});
            }
            await page.waitForTimeout(250);
        }
        return frames;
    };
    /** Jugar la charla abierta por las opciones de `path`, y terminarla. */
    const playTalk = async (/** @type {string[]} */ path) => {
        /** @type {any[]} */
        const steps = [];
        for (const id of path) {
            const now = await story();
            if (!now || now.kind !== 'dialogue') break;
            steps.push(now);
            if (!now.options.some((/** @type {any} */ o) => o.id === id && !o.locked)) continue;
            await page.locator(`dialog.dw-dialog[open] .dw-option[data-option="${id}"]`).click({ timeout: 4000 }).catch(() => {});
            await page.waitForTimeout(400);
        }
        const last = await story();
        if (last?.kind === 'dialogue') steps.push(last);
        await page.locator('dialog.dw-dialog[open] .dw-finish, dialog.dw-dialog[open] .dw-leave').first().click({ timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(500);
        return steps;
    };
    /** Que las tiradas salgan (un 20 natural), o que vuelvan a ser al azar. */
    const loadedDice = (/** @type {boolean} */ on) => page.evaluate(async (yes) => {
        const rules = await import('/scripts/party/combat-rules.js');
        rules.setRandomSource(yes ? () => 0.999 : null);
    }, on);

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    const firstRun = page.locator('text=Welcome to SillyTavern!');
    if (await firstRun.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#game-shell', { timeout: 90000 });
    await page.waitForTimeout(1500);
    await page.evaluate(async () => {
        const st = await import('/script.js');
        st.setOnlineStatus('no_connection');
    });

    // --- 1387, sin modelo: «Partida nueva», un mundo hecho, Relajado y Ulrich ---------------
    await page.locator('.gs-menu-btn').filter({ hasText: 'Partida nueva' }).first().click();
    await page.waitForSelector('.tl-door-grid', { timeout: 20000 });
    await page.locator('.tl-door-card').nth(1).click();
    await page.waitForSelector('.tl-root', { timeout: 20000 });
    await page.locator('.tl-card', { hasText: '1387' }).first().click();
    await page.waitForFunction(() => !/Cargando el mundo/.test(document.querySelector('.tl-said')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(500);
    await page.locator('.tl-tab[data-step="jugabilidad"]').click({ timeout: 8000 });
    await page.waitForTimeout(300);
    await page.locator('.tl-root .md-card[data-mode="relajado"]').click();
    await page.waitForTimeout(300);
    await page.locator('.tl-next').click();
    await page.waitForSelector('.popup:visible .vt-premade', { timeout: 180000 });
    await page.waitForTimeout(800);
    for (let i = 0; i < 3 && await page.locator('.popup:visible .vt-premade').count() > 0; i++) {
        await page.locator('.popup:visible .vt-premade').first().click({ timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(1200);
    }

    // --- J9.2: la mecha se juega en su ventana ----------------------------------------------
    const opening = await until(async () => (await story())?.id === 'el-caliz-ensangrentado', 90000);
    const first = await story();
    check('J9.2: la partida empieza con la escena del cáliz en su ventana, y la cuenta el narrador: sin cara ni placa',
        opening && Boolean(first?.narrator) && !first?.plateShown && /cuarto más barato de la posada/.test(String(first?.text)), JSON.stringify(first));
    await shoot('caliz');
    const calizFrames = await playScene(['gritar']);
    const torres = calizFrames.find(f => f.plate === 'Torres');
    check('J9.2: Torres habla con su cara de enfadado y su nombre en la placa; la escena trae su decisión',
        Boolean(torres) && torres.mood === 'enfadado' && /alguacil-torres--enfadado\.png$/.test(torres.face) && calizFrames.some(f => f.options.some((/** @type {any} */ o) => o.id === 'gritar')),
        JSON.stringify(torres ?? calizFrames.map(f => f.plate)));
    await page.waitForTimeout(1200);
    let now = await meta();
    const told = (await chatTexts()).join('\n');
    check('J9.2: jugada la escena, queda apuntada, lo decidido va al Diario, cambia cómo os mira Giles y lo que pasó queda en el registro',
        now.played.includes('el-caliz-ensangrentado') && now.decisions.some(d => /^El cáliz ensangrentado: «Gritas/.test(d))
        && Number(now.attitudes.Giles) >= 1 && /📜 \[HILO\][\s\S]*Torres: «¡Abrid en nombre de Lord Vane/.test(told),
        JSON.stringify({ played: now.played, decisions: now.decisions, attitudes: now.attitudes }));
    // Lo que queda es el registro de la escena (con Torres); su texto no sale otra vez como nota suelta.
    const openingNotes = (await chatTexts()).filter(t => /\[HILO\][\s\S]*Viernes por la mañana/.test(t));
    check('J9.2: el texto de la escena ya jugada no se vuelve a contar como nota del hilo',
        openingNotes.length === 1 && /Torres: «/.test(openingNotes[0]), JSON.stringify(openingNotes.map(t => t.slice(0, 80))));

    // --- Ganar en el cuarto de la posada: la escena siguiente espera al panel de victoria ----
    await dropToasts();
    const canFight = await until(async () => (await chips()).some(c => /^Iniciar combate/.test(c)), 15000);
    await clickChip(/^Iniciar combate/);
    await until(() => page.evaluate(async () => Boolean((await import('/scripts/party.js')).getCombatEncounter()?.active)), 10000);
    await clearDice();
    await page.evaluate(async () => {
        const enc = (await import('/scripts/party.js')).getCombatEncounter();
        for (const e of enc?.enemies ?? []) e.currentHp = 0;
    });
    // El tablero no se gana matando a todos: el encargo es salir por la ventana (7,9). En el
    // turno de quien juega, al pie de la ventana, y a salir (como e2e-sin-modelo).
    for (let i = 0; i < 8; i++) {
        const turn = await page.evaluate(async () => {
            const party = await import('/scripts/party.js');
            const enc = party.getCombatEncounter();
            if (!enc?.active) return 'over';
            const entry = enc.turnOrder?.[enc.currentTurnIndex];
            return entry?.type === 'enemy' || entry?.isEnemy ? 'enemy' : 'player';
        });
        if (turn === 'over') break;
        if (turn === 'enemy') {
            await slash('/combat-end');
            await clearDice();
            continue;
        }
        await page.evaluate(async () => {
            // El de verdad (`getPartyMembersSnapshot` es una copia).
            const me = (await import('/scripts/party/state.js')).partyMembers[0];
            if (me?.mapPosition) {
                me.mapPosition.gridX = 7;
                me.mapPosition.gridY = 7;
            }
        });
        // `/combat-move` cuenta desde 1; el objetivo del paquete (7,9), desde 0.
        await slash('/combat-move 8 10');
        await page.waitForTimeout(1200);
        await clearDice();
    }
    const card = await until(async () => await page.locator('.vs-card').count() > 0, 8000);
    await page.waitForTimeout(1500);
    const waiting = { card, scene: await story() };
    check('J9.2: tras ganar sale el panel de victoria, y la escena siguiente espera a que se cierre',
        canFight && card && waiting.scene === null && (await meta()).done.includes('el-caliz-ensangrentado'), JSON.stringify(waiting));
    await shoot('victoria');
    await page.locator('.vs-card').first().click({ timeout: 4000 }).catch(() => {});
    const escape = await until(async () => (await story())?.id === 'el-precio-del-escape', 15000);
    check('J9.2: al cerrar el panel se abre la escena de la huida', escape, JSON.stringify(await story()));
    await shoot('huida');
    const escapeFrames = await playScene(['llamar']);
    const gilesGlad = escapeFrames.find(f => f.plate === 'Giles');
    check('J9.2: la decisión de la huida tiene respuesta: Giles, con su cara de alegre',
        Boolean(gilesGlad) && gilesGlad.mood === 'alegre' && /giles--alegre\.png$/.test(gilesGlad.face), JSON.stringify(gilesGlad ?? escapeFrames.map(f => f.plate)));

    // --- J8: la escena acaba en la charla de Giles, que cumple el hito cuando lo cuenta -------
    const gilesTalk = await until(async () => (await story())?.id === 'giles-lo-que-vio', 10000);
    const talkOpen = await story();
    check('J8: la escena acaba con la charla escrita de Giles en su ventana, con sus opciones', gilesTalk && Boolean(talkOpen?.options.some((/** @type {any} */ o) => o.id === 'quien-subio')), JSON.stringify(talkOpen));
    await shoot('giles');
    const doneBefore = (await meta()).done.includes('el-precio-del-escape');
    await loadedDice(true);
    const gold = await page.evaluate(async () => (await import('/scripts/party.js')).getPartyMembersSnapshot().reduce((s, m) => s + (Number(m.gold) || 0), 0));
    const talkSteps = await playTalk(['quien-subio', gold >= 3 ? 'pagar' : 'convencer', 'furtivos', 'camino-gracias']);
    await loadedDice(false);
    await page.waitForTimeout(1200);
    now = await meta();
    check('J8: el hito de hablar con Giles no se cumple al saludar, sino cuando lo cuenta (su efecto de hito), con su rumor',
        !doneBefore && now.done.includes('el-precio-del-escape') && now.heard.includes('r-traicion-en-la-puerta'),
        JSON.stringify({ doneBefore, done: now.done, heard: now.heard, steps: talkSteps.map(s => s.options.map((/** @type {any} */ o) => o.id).join('/')) }));
    check('J8.6: lo que contó Giles queda recordado', Boolean(now.dialogues['giles-lo-que-vio']?.learned?.length), JSON.stringify(now.dialogues['giles-lo-que-vio'] ?? null));

    // La pista en el barro se abre al acabar la charla.
    const mud = await until(async () => (await story())?.id === 'la-pista-en-el-barro', 15000);
    check('J9.2: al acabar la charla se abre la escena del hito siguiente (la pista en el barro)', mud, JSON.stringify(await story()));
    await playScene();
    await page.waitForTimeout(800);

    // --- J10.2: lo que se examina en el pueblo, y lo que se ve si sale ------------------------
    await slash('/leave');
    await page.waitForTimeout(800);
    await dropToasts();
    const sightsHere = await page.evaluate(async () => {
        const wi = await import('/scripts/world-info.js');
        const place = wi.getCurrentWorldLocationMaps().find((/** @type {any} */ l) => l.name === 'El Pueblo de Barro');
        return (place?.sights ?? []).map((/** @type {any} */ s) => ({ label: `${String(s.verbo).charAt(0).toUpperCase()}${String(s.verbo).slice(1)} ${s.text}`, found: s.found }));
    });
    const lookChip = await until(async () => (await chips()).some(c => sightsHere.some((/** @type {any} */ s) => s.label === c)), 10000);
    const offered = (await chips()).filter(c => sightsHere.some((/** @type {any} */ s) => s.label === c));
    check('J10.2: en El Pueblo de Barro se ofrece examinar lo que el paquete escribe para él (sus «sights»)',
        lookChip && offered.length >= 1, JSON.stringify({ chips: await chips(), sights: sightsHere.map((/** @type {any} */ s) => s.label) }));
    await shoot('mirar');
    const sight = sightsHere.find((/** @type {any} */ s) => s.label === offered[0]);
    await loadedDice(true);
    await clickChip(new RegExp(`^${String(offered[0] ?? '---').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
    await page.waitForTimeout(1500);
    await clearDice();
    await loadedDice(false);
    const foundShown = (await chatTexts()).some(t => t.includes(String(sight?.found ?? '---')));
    check('J10.2: con la tirada buena, se ve lo que hay (su «found»), y la ficha ya no sale hoy',
        foundShown && !(await chips()).includes(String(offered[0])), JSON.stringify({ found: sight?.found, chips: await chips() }));

    // --- D-J36: «Hablar» con Giles abre su charla; «Otras cosas», la de siempre ----------------
    await page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/hablar Giles'));
    const direct = await until(async () => (await story())?.id === 'giles-lo-que-vio', 10000);
    const again = await story();
    check('D-J36: «Hablar» con Giles abre directamente su charla escrita, con «Otras cosas»',
        direct && Boolean(again?.extras.includes('otras')), JSON.stringify(again));
    await page.locator('dialog.dw-dialog[open] .dw-extra[data-extra="otras"]').click({ timeout: 4000 }).catch(() => {});
    const classic = await page.waitForSelector('.popup:not([closing]) .tk-root', { timeout: 8000 }).then(() => true).catch(() => false);
    const acts = await page.locator('.popup:not([closing]) .tk-act').evaluateAll(els => els.map(e => e.getAttribute('data-act') || ''));
    check('D-J36: «Otras cosas» lleva a sonsacar, convencer y amenazar', classic && ['sonsacar', 'convencer', 'amenazar'].every(a => acts.includes(a)), JSON.stringify(acts));
    // Las caras: lo que dice Giles sale en la novela con su gesto (os mira bien: alegre).
    const beforeTopic = (await chatTexts()).length;
    await page.locator('.popup:not([closing]) .tk-topic[data-topic="vosotros"]').click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(800);
    const said = await page.evaluate((from) => (window.SillyTavern.getContext().chat || []).slice(from)
        .map((/** @type {any} */ m) => ({ name: m.name, mood: m.extra?.mood ?? '', text: String(m.extra?.display_text ?? m.mes).slice(0, 120) })), beforeTopic);
    await page.locator('.popup:not([closing]):has(.tk-root) .popup-button-ok').first().click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(800);
    // La novela es la escena «Diálogo»; en «Exploración» (el pueblo) no se pinta.
    const novelFace = await page.evaluate(async () => {
        const shell = await import('/scripts/game-engine/ui/shell/game-shell.js');
        shell.setScene('dialogue');
        shell.refreshGameShell();
        await new Promise(resolve => setTimeout(resolve, 600));
        const image = /** @type {HTMLImageElement|null} */ (document.querySelector('#game-shell .gs-vn-portrait:not([hidden]) img'));
        return { plate: (document.querySelector('#game-shell .gs-vn-nameplate')?.textContent || '').trim(), src: image?.getAttribute('src') || '' };
    });
    check('Expresiones: lo que dice Giles sale a su nombre, con el gesto de cómo os mira (alegre), y la novela pinta esa cara',
        said.some(m => m.name === 'Giles' && m.mood === 'alegre') && novelFace.plate === 'Giles' && /giles--alegre\.png$/.test(novelFace.src),
        JSON.stringify({ said, novelFace }));
    await shoot('cara');

    // --- Viajar: los hitos 3 y 4, y la escena de Karl ------------------------------------------
    await slash('/go Campamento Furtivo');
    await page.waitForTimeout(1500);
    await clearDice();
    const winter = await until(async () => (await story())?.id === 'el-invierno-cierra-el-paso', 20000);
    check('J9.2: llegar al Campamento Furtivo cumple el hito 3 y abre la escena del 4 (el invierno cierra el paso)',
        winter && (await meta()).done.includes('la-pista-en-el-barro'), JSON.stringify({ story: await story(), done: (await meta()).done }));
    await playScene();
    await slash('/acampar');
    await slash('/explorar');
    await page.locator('.popup:not([closing]) .popup-button-ok').last().click({ timeout: 2000 }).catch(() => {});
    await slash('/go Castillo de Vane');
    await page.waitForTimeout(1500);
    await clearDice();
    const karl = await until(async () => (await story())?.id === 'el-hambre-de-los-lobos', 20000);
    check('J9.2: llegar a Castillo de Vane cumple el hito 4 y abre la escena de Karl', karl && (await meta()).done.includes('el-invierno-cierra-el-paso'),
        JSON.stringify({ story: await story(), done: (await meta()).done }));
    await shoot('karl');
    // J11.1: lo que no tiene vuelta atrás lo dice en la opción, y se decide a la segunda pulsación.
    /** @type {string[]} */
    const karlPlates = [];
    for (let i = 0; i < 12 && !((await story())?.options.length); i++) {
        karlPlates.push(String((await story())?.plate ?? ''));
        await page.locator('dialog.ps-dialog[open] .ps-next').first().click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(200);
    }
    const weighty = await page.evaluate(() => [...document.querySelectorAll('dialog.ps-dialog[open] .dw-option')]
        .map(o => ({ id: o.getAttribute('data-option') || '', warn: (o.querySelector('.nr-badge')?.textContent || '').trim() })));
    await page.locator('dialog.ps-dialog[open] .dw-option[data-option="mirar-a-otro-lado"]').click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(300);
    const armed = await page.evaluate(() => ({
        armed: Boolean(document.querySelector('dialog.ps-dialog[open] .dw-option.nr-armed[data-option="mirar-a-otro-lado"]')),
        still: document.querySelectorAll('dialog.ps-dialog[open] .dw-option').length,
    }));
    check('J11.1: las opciones que pesan dicen «Esto no tiene vuelta atrás», y la primera pulsación solo las marca',
        weighty.some(o => o.id === 'mirar-a-otro-lado' && /no tiene vuelta atrás/.test(o.warn)) && armed.armed && armed.still > 0,
        JSON.stringify({ weighty, armed }));
    await shoot('sin-vuelta');
    const karlFrames = await playScene(['mirar-a-otro-lado']);
    await page.waitForTimeout(1200);
    now = await meta();
    check('D-J39: la escena de Karl ya es la charla: cumple su propio hito sin tener que hablar con él',
        [...karlPlates, ...karlFrames.map(f => f.plate)].includes('Karl') && now.done.includes('el-hambre-de-los-lobos'),
        JSON.stringify({ done: now.done, plates: [...karlPlates, ...karlFrames.map(f => f.plate)] }));
    const textOnly = await until(async () => (await story())?.id === 'la-oferta-del-castillo', 15000);
    const offer = await story();
    check('D-J40: el hito siguiente, que solo trae texto, se abre en la ventana como una escena corta del narrador',
        textOnly && Boolean(offer?.narrator) && !offer?.plateShown && String(offer?.text).length > 40, JSON.stringify(offer));
    await shoot('texto');
    await playScene();
    await page.waitForTimeout(800);

    // --- J9.6 y J8.6: el Diario ----------------------------------------------------------------
    await page.evaluate(() => /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .gs-tools .gs-journal'))?.click());
    await page.waitForSelector('.popup:not([closing]) .jr-root', { timeout: 8000 }).catch(() => {});
    const diary = await page.evaluate(() => {
        const root = document.querySelector('.popup:not([closing]) .jr-root');
        /** @type {Record<string, string[]>} */
        const out = {};
        let title = '';
        for (const node of root?.children ?? []) {
            if (node.classList.contains('jr-title')) title = (node.textContent || '').trim();
            else if (node.classList.contains('jr-item') && title) (out[title] ??= []).push((node.textContent || '').trim());
        }
        return out;
    });
    await shoot('diario');
    await page.locator('.popup:not([closing]):has(.jr-root) .popup-button-ok').first().click({ timeout: 4000 }).catch(() => {});
    check('J9.6: el Diario apunta lo que decidisteis en las escenas, con lo que dejó apuntado la de Karl',
        (diary['Lo que decidisteis'] ?? []).some(l => /El cáliz ensangrentado: «Gritas/.test(l)) && (diary['Lo que decidisteis'] ?? []).some(l => /Le prometiste a Karl/.test(l)),
        JSON.stringify(diary['Lo que decidisteis'] ?? Object.keys(diary)));
    check('J8.6: el Diario apunta lo que os han contado en las charlas (Giles)',
        (diary['Lo que os han contado'] ?? []).some(l => /^Giles: Giles vio subir a tu cuarto/.test(l)), JSON.stringify(diary['Lo que os han contado'] ?? Object.keys(diary)));

    // --- J13: la estación de hoy llega al narrador (el descanso, el viaje, la llegada) -------
    const season = await page.evaluate(async () => {
        const world = await import('/scripts/party/world.js');
        const narration = await import('/scripts/party/narration.js');
        const now = world.currentSeason();
        const rows = world.lastCompendium.find('frases', { kind: 'descanso' });
        // Solo quedan las de alguna estación: si la estación no llegara, no saldría ninguna.
        const muted = rows.filter((/** @type {any} */ r) => !r.when?.estacion);
        const saved = muted.map((/** @type {any} */ r) => r.weight);
        muted.forEach((/** @type {any} */ r) => { r.weight = 0; });
        let told = '';
        try {
            told = narration.tellMoment('descanso', { largo: 'sí', dia: 9, tiempo: 'despejado' });
        } finally {
            muted.forEach((/** @type {any} */ r, /** @type {number} */ i) => { r.weight = saved[i]; });
        }
        const all = world.lastCompendium.find('frases', {}).filter((/** @type {any} */ r) => r.when?.estacion);
        const pieceOf = (/** @type {any} */ r) => String(r.text).split(/\{[^}]+\}/).sort((a, b) => b.length - a.length)[0].trim();
        return {
            now, told,
            mine: all.filter((/** @type {any} */ r) => r.when.estacion === now && r.kind === 'descanso').map(pieceOf),
            others: all.filter((/** @type {any} */ r) => r.when.estacion !== now).map(pieceOf),
        };
    });
    const heardSeasons = (await chatTexts()).join('\n');
    check(`J13: la estación de hoy (${season.now}) llega al narrador: el descanso dice una frase de ${season.now}, y en toda la partida no sale ninguna de otra estación`,
        Boolean(season.told) && season.mine.some((/** @type {string} */ piece) => season.told.includes(piece))
        && !season.others.some((/** @type {string} */ piece) => heardSeasons.includes(piece)), JSON.stringify({ now: season.now, told: season.told }));

    // === El prólogo del gremio, con sus escenas en la ventana (D-J39, D-J40, D-J36) ============
    // Otra pestaña, limpia: «Jugar sin conexión», Tessa, y el muelle de Puerto Alba.
    page = await newPage();
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    if (await page.locator('text=Welcome to SillyTavern!').waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#game-shell', { timeout: 90000 });
    await page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Jugar sin conexión' }).click({ timeout: 30000 });
    // El mismo servidor guarda al héroe de la primera parte (1387), así que «¿Quién entra?»
    // pregunta antes si viene un veterano (idea 179). Aquí se hace una nueva: «Uno nuevo».
    await page.waitForSelector('.hc-root, dialog[open] .vt-card.vt-new', { timeout: 120000 });
    if (await page.locator('dialog[open] .vt-card.vt-new').count() > 0) await page.locator('dialog[open] .vt-card.vt-new').first().click();
    await page.waitForSelector('.hc-root', { timeout: 120000 });
    await page.fill('.hc-root .hc-name', 'Tessa');
    await page.locator('.hc-root .hc-gender[data-value="Mujer"]').click();
    for (const pick of ['race', 'class']) {
        await page.locator(`.hc-root .hc-card[data-pick="${pick}"] .hc-pick`).click();
        await page.waitForSelector('.hc-picker .hc-option', { timeout: 15000 });
        await page.locator('.hc-picker .hc-option').first().click();
        await page.waitForTimeout(400);
    }
    await page.locator('.hc-root .hc-enter').click();
    const pier = await until(async () => (await story())?.id === 'el-muelle', 90000);
    const pierFirst = await story();
    check('Gremio: el prólogo empieza con la escena del muelle en su ventana, contada por el narrador, en femenino',
        pier && Boolean(pierFirst?.narrator) && /cansada del viaje/.test(String(pierFirst?.text)), JSON.stringify(pierFirst));
    await shoot('gremio-muelle');
    const pierFrames = await playScene(['yo-me-encargo']);
    await page.waitForTimeout(1000);
    now = await meta();
    check('Gremio: Tomás grita con su cara; «Yo me encargo» hace que os mire mejor, y la escena queda jugada',
        pierFrames.some(f => f.plate === 'Tomás' && /retratos\/gremio\/tomas--/.test(f.face)) && now.played.includes('el-muelle') && Number(now.attitudes['Tomás']) >= 1,
        JSON.stringify({ plates: pierFrames.map(f => `${f.plate}:${f.mood}`), played: now.played, attitudes: now.attitudes }));

    // La pelea del muelle: ganarla abre la escena de la charla con Tomás, tras el panel de victoria.
    await dropToasts();
    const pierFight = await until(async () => (await chips()).some(c => /^Iniciar combate \(Ratero/.test(c)), 15000);
    await clickChip(/^Iniciar combate \(Ratero/);
    await until(() => page.evaluate(async () => Boolean((await import('/scripts/party.js')).getCombatEncounter()?.active)), 10000);
    await clearDice();
    await page.evaluate(async () => {
        const enc = (await import('/scripts/party.js')).getCombatEncounter();
        for (const e of enc?.enemies ?? []) e.currentHp = 0;
    });
    for (let i = 0; i < 8; i++) {
        if (!await page.evaluate(async () => Boolean((await import('/scripts/party.js')).getCombatEncounter()?.active))) break;
        await slash('/combat-end');
        await clearDice();
    }
    const pierCard = await until(async () => await page.locator('.vs-card').count() > 0, 8000);
    check('Gremio: se gana en el muelle y sale el panel de victoria, sin escena encima', pierFight && pierCard && (await story()) === null, JSON.stringify({ pierFight, pierCard }));
    await page.locator('.vs-card').first().click({ timeout: 4000 }).catch(() => {});
    // Tras la pelea pueden salir antes otras cosas (lo que dice un compañero, un consejo): se espera más.
    const charla = await until(async () => (await story())?.id === 'la-charla', 30000);
    check('Gremio: al cerrar el panel se abre la escena de la charla con Tomás', charla, JSON.stringify(await story()));
    await shoot('gremio-tomas');
    const charlaFrames = await playScene(['una-cerveza']);
    await page.waitForTimeout(1200);
    now = await meta();
    check('D-J39: la escena de Tomás ya es la charla del hito: lo cumple sin tener que «Hablar con Tomás»',
        charlaFrames.some(f => f.plate === 'Tomás') && now.done.includes('la-charla'), JSON.stringify({ done: now.done, plates: charlaFrames.map(f => f.plate) }));

    // La escena de Brunilda no cumple su hito: lo cumple su charla escrita, al pedir entrar.
    const brunildaScene = await until(async () => (await story())?.id === 'el-gremio', 15000);
    await shoot('gremio-brunilda-escena');
    const gremioFrames = await playScene(['trabajo']);
    await page.waitForTimeout(1200);
    now = await meta();
    check('Gremio: sigue la escena de Brunilda; como ella tiene charla escrita que cumple el hito, la escena no lo cumple',
        brunildaScene && gremioFrames.some(f => f.plate === 'Brunilda') && !now.done.includes('el-gremio') && now.open.includes('el-gremio'),
        JSON.stringify({ done: now.done, open: now.open }));
    await dropToasts();
    const talkChip = await until(async () => (await chips()).some(c => /^Hablar con Brunilda/.test(c)), 10000);
    await clickChip(/^Hablar con Brunilda/);
    const brunildaTalk = await until(async () => (await story())?.id === 'brunilda-la-casa', 10000);
    const brunildaOpen = await story();
    check('D-J36: «Hablar con Brunilda» abre directamente su charla escrita, con su cara y «Otras cosas»',
        talkChip && brunildaTalk && brunildaOpen?.plate === 'Brunilda' && /retratos\/gremio\/brunilda/.test(String(brunildaOpen?.face)) && Boolean(brunildaOpen?.extras.includes('otras'))
        && Boolean(brunildaOpen?.options.some((/** @type {any} */ o) => o.id === 'quiero-entrar')), JSON.stringify(brunildaOpen));
    await shoot('gremio-brunilda-charla');
    await playTalk(['quiero-entrar', 'prueba-voy']);
    await page.waitForTimeout(1200);
    now = await meta();
    const trial = await until(async () => (await story())?.id === 'la-prueba', 15000);
    check('Gremio: «Quiero entrar» cumple el hito de Brunilda, y se abre la escena de la prueba',
        now.done.includes('el-gremio') && trial, JSON.stringify({ done: now.done, story: await story() }));
    await shoot('gremio-prueba');
    await playScene(['voy-ya']);

    console.log('\n--- problemas ---');
    console.log(problems.length ? problems.join('\n') : '(ninguno)');
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
