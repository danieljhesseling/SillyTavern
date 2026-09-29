#!/usr/bin/env node
/**
 * La vuelta sin modelo (Z8 de wiki/ROADMAP_SIN_TOKENS.md): una partida de 1387 con el
 * proveedor apagado, solo con fichas, botones y comandos, como la jugaría quien no gasta un
 * token. Contra un servidor propio con un `--dataRoot` temporal, como las otras vueltas.
 *
 * Mira dos cosas que las otras vueltas no miran:
 *
 * - **Los silencios.** Tras cada acción tiene que aparecer algo nuevo y legible: una línea en
 *   el chat, un aviso o una ventana. Una acción que no devuelve nada es un silencio.
 * - **Las órdenes a la vista.** Ninguna línea que se ve puede ser una orden al narrador
 *   («Cuéntalo en un párrafo…», «No inventes…»): sin modelo, se leen como un error.
 *
 * Y que el hilo de 1387 avance sin modelo: hasta hoy se paraba en su hito 2.
 *
 * Uso:
 *   node tools/e2e-sin-modelo.mjs              # sin ventana
 *   node tools/e2e-sin-modelo.mjs --headed     # mirándolo
 *   node tools/e2e-sin-modelo.mjs --estricto   # y un silencio cuenta como fallo
 */

/* global window, document */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
// Con --port, otro: para correr a la vez que otras vueltas.
const PORT = Number(process.argv.includes('--port') ? process.argv[process.argv.indexOf('--port') + 1] : '') || 8125;
const BASE = `http://127.0.0.1:${PORT}`;
const HEADED = process.argv.includes('--headed');
const STRICT = process.argv.includes('--estricto');

const require = createRequire(join(ROOT, 'tests/package.json'));
const { chromium } = require('@playwright/test');

let failures = 0;
const check = (/** @type {string} */ name, /** @type {boolean} */ ok, detail = '') => {
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        -> ${detail}` : ''}`);
};

/** Cómo empiezan las órdenes al narrador: si una se ve, es un fallo. */
const ORDER = /(Cuéntalo|Cuentalo|No inventes|Dilo tal cual|Describe la escena|Narra esta|Adapta la escena|Que se note|narra la consecuencia)/;

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-sin-modelo-'));
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
    const context = await browser.newContext({ viewport: { width: 1400, height: 950 } });
    const page = await context.newPage();
    /** @type {string[]} */
    const problems = [];
    page.on('pageerror', e => problems.push(`PAGEERROR ${e.message}`));
    page.on('console', m => {
        if (m.type() === 'error' && !/Failed to load resource.*404/.test(m.text())) problems.push(`ERROR ${m.text().slice(0, 300)}`);
        // `WALK_DEBUG=1`: todo lo que dice la consola, al momento (para una página que se cae).
        if (process.env.WALK_DEBUG && /party|suceso|Error|error|warn/i.test(m.text())) console.log(`  [consola ${m.type()}] ${m.text().slice(0, 240)}`);
    });
    page.on('crash', () => console.log('  [la página se ha caído]'));
    await context.addInitScript(() => {
        try {
            window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,combat,travel,prisoners,mesa,high,spell,pet,bill,move,attack,roll,talk,journal');
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
            // Las escenas del hilo y las charlas escritas (J9.2, J8) las mira e2e-historia; aquí taparían clics.
            window.localStorage.setItem('sillytavern_gameStoryWindows', 'off');
        } catch { /* nada */ }
    });
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    const firstRun = page.locator('text=Welcome to SillyTavern!');
    if (await firstRun.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#game-shell', { timeout: 90000 });
    await page.waitForTimeout(1500);
    // Sin modelo de verdad: aunque el servidor de pruebas diga «Connected» (sin clave de nada),
    // se desconecta, como quien juega sin proveedor.
    const offline = await page.evaluate(async () => {
        const st = await import('/script.js');
        st.setOnlineStatus('no_connection');
        return st.online_status;
    });
    check('se juega sin modelo: no hay proveedor conectado', offline === 'no_connection', String(offline));

    // --- 1387, como lo haría quien juega: «Partida nueva», un mundo hecho, Relajado y Ulrich.
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
    let hero = '';
    for (let i = 0; i < 60 && !hero; i++) {
        hero = await page.evaluate(async () => ((await import('/scripts/party.js')).getPartyMembersSnapshot())[0]?.name || '').catch(() => '');
        if (!hero) await page.waitForTimeout(500);
    }
    await page.waitForTimeout(2500);
    check('se entra en 1387 con Ulrich, sin modelo', hero === 'Ulrich Brand', hero);

    // --- Los ayudantes -----------------------------------------------------------------
    /** Un comando, con tope. */
    const slash = async (/** @type {string} */ command) => {
        const done = page.evaluate((c) => window.SillyTavern.getContext().executeSlashCommandsWithOptions(c).then(() => 'ok').catch((/** @type {any} */ e) => `error: ${e?.message || e}`), command);
        const said = await Promise.race([done, new Promise(resolve => setTimeout(() => resolve('timeout'), 25000))]);
        if (said === 'timeout') {
            await page.keyboard.press('Escape').catch(() => {});
            await page.keyboard.press('Escape').catch(() => {});
        }
        await page.waitForTimeout(600);
        return said;
    };
    // Con una ventana encima, los dados no se pueden pulsar: con dos fallos seguidos se deja.
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
    /** Z4: una tarjeta de suceso se decide (la primera opción que se pueda) y se sigue. */
    const decided = [];
    const decideSucesos = async () => {
        for (let i = 0; i < 6; i++) {
            const card = page.locator('.popup:not([closing]) .su-root').last();
            if (await card.count() === 0) break;
            const id = await card.getAttribute('data-suceso').catch(() => '');
            const pick = card.locator('.su-option:not([disabled])').first();
            if (await pick.count() === 0) break;
            await pick.click({ timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(700);
            await clearDice();
            decided.push(String(id));
            await card.locator('.su-go').click({ timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(500);
        }
    };
    /** Cerrar lo que haya abierto: ventanas del juego y la pausa. */
    const closeAll = async () => {
        await decideSucesos();
        for (let i = 0; i < 4; i++) {
            const ok = page.locator('.popup:not([closing]) .popup-button-ok').last();
            if (await ok.count() === 0 || !(await ok.isVisible().catch(() => false))) break;
            await ok.click({ timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(400);
        }
        if (await page.locator('.gs-pause').count() > 0) {
            await page.mouse.click(5, 5);
            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
        }
    };
    /** Lo que se ve ahora: lo que dice el chat (como se pinta), los avisos y las ventanas. */
    const seen = () => page.evaluate(() => ({
        chat: (window.SillyTavern.getContext().chat || []).map((/** @type {any} */ m) => String(m.extra?.display_text ?? m.mes ?? '')),
        toasts: [...document.querySelectorAll('#toast-container .toast')].map(t => (t.textContent || '').trim()),
        dialogs: [...document.querySelectorAll('dialog[open]:not([closing])')].map(d => (d.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80)),
    }));
    /** @type {Array<{label: string, silent: boolean, leaked: string, got: string, texts: string[]}>} */
    const walk = [];
    /**
     * Una acción: lo que hace, y si devuelve algo que se lee.
     *
     * @param {string} label
     * @param {() => Promise<any>} run
     * @param {string} [said] Lo que se escribió, si se escribió algo: eso no cuenta como respuesta.
     */
    const act = async (label, run, said = '') => {
        await page.evaluate(() => { /** @type {any} */ (window).toastr?.clear(); document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()); });
        const before = await seen();
        await run();
        await page.waitForTimeout(1500);
        await clearDice();
        const after = await seen();
        const fresh = after.chat.slice(before.chat.length).filter(t => t.trim());
        const toasts = after.toasts.filter(t => !before.toasts.includes(t));
        const dialogs = after.dialogs.filter(t => !before.dialogs.includes(t));
        const visible = [...fresh, ...toasts, ...dialogs];
        const leaked = fresh.find(t => ORDER.test(t)) || '';
        // Lo que escribe quien juega no es una respuesta: se mira lo que dice el juego.
        const answer = visible.filter(t => t.trim() !== String(said ?? '').trim());
        const entry = { label, silent: answer.length === 0, leaked, got: (answer[0] || '').replace(/\s+/g, ' ').slice(0, 120), texts: fresh };
        walk.push(entry);
        console.log(`${entry.silent ? 'MUDO' : leaked ? 'ORDEN' : 'OK  '}  ${label}${entry.got ? ` → ${entry.got}` : ''}${leaked ? `\n        orden a la vista: ${leaked.slice(0, 160)}` : ''}`);
        await closeAll();
        return entry;
    };
    const plotDone = () => page.evaluate(() => [...(window.SillyTavern.getContext().chatMetadata?.plotState?.done || [])]);
    const whoseTurn = () => page.evaluate(async () => {
        const enc = (await import('/scripts/party.js')).getCombatEncounter();
        const entry = enc?.turnOrder?.[enc?.currentTurnIndex];
        return !enc?.active ? 'over' : (entry?.isEnemy ? 'enemy' : 'player');
    });

    // --- El arranque: la escena, sin órdenes -------------------------------------------
    const opening = await seen();
    const openingLeak = opening.chat.find(t => ORDER.test(t)) || '';
    check('el arranque se lee sin órdenes al narrador', !openingLeak, openingLeak.slice(0, 200));

    // --- Hito 1: ganar la pelea del cuarto de la posada --------------------------------
    await page.evaluate(() => /** @type {HTMLElement|null} */ (document.activeElement)?.blur());
    await page.keyboard.press('3');
    await page.waitForTimeout(800);
    await act('Iniciar combate en el cuarto de la posada', async () => {
        await page.locator('#game-shell .sc-btn').first().click({ timeout: 8000 }).catch(() => {});
    });
    // Lo que se prueba aquí no es la pelea: los enemigos, a un golpe y al lado del héroe.
    await page.evaluate(async () => {
        const party = await import('/scripts/party.js');
        const enc = party.getCombatEncounter();
        const me = party.getPartyMembersSnapshot()[0];
        let dx = 1;
        for (const foe of enc?.enemies || []) {
            foe.currentHp = 1;
            foe.armorClass = 1;
            foe.ac = 1;
            foe.maxHp = Math.max(1, Number(foe.maxHp) || 1);
            foe.gridX = (Number(me?.mapPosition?.gridX) || 0) + (dx > 0 ? 1 : -1);
            foe.gridY = (Number(me?.mapPosition?.gridY) || 0) + (Math.abs(dx) > 1 ? 1 : 0);
            dx = dx > 0 ? -dx : -dx + 1;
        }
    });
    for (let round = 0; round < 30 && await whoseTurn() !== 'over'; round++) {
        if (await whoseTurn() === 'enemy') {
            await slash('/combat-end');
            await clearDice();
            continue;
        }
        const target = await page.evaluate(async () => {
            const enc = (await import('/scripts/party.js')).getCombatEncounter();
            return (enc?.enemies || []).find((/** @type {any} */ e) => (e.currentHp || 0) > 0)?.name || '';
        });
        if (!target) break;
        await act(`Atacar a ${target}`, () => slash(`/combat-attack ${target}`));
        if (await whoseTurn() === 'player') await slash('/combat-end');
        await clearDice();
    }
    // El tablero no se gana matando a todos: el encargo es salir por la ventana (7,9). Ulrich,
    // al pie de la ventana, y a salir.
    if (await whoseTurn() === 'enemy') await slash('/combat-end');
    await page.evaluate(async () => {
        const me = (await import('/scripts/party.js')).getPartyMembersSnapshot()[0];
        if (me?.mapPosition) {
            me.mapPosition.gridX = 7;
            me.mapPosition.gridY = 7;
        }
    });
    // `/combat-move` cuenta desde 1; el objetivo del paquete (7,9), desde 0.
    await act('Salir por la ventana', () => slash('/combat-move 8 10'));
    await page.waitForTimeout(2000);
    await clearDice();
    console.log('combate:', JSON.stringify(await page.evaluate(async () => {
        const enc = (await import('/scripts/party.js')).getCombatEncounter();
        return {
            active: Boolean(enc?.active),
            turn: enc?.turnOrder?.[enc?.currentTurnIndex]?.name ?? null,
            enemies: (enc?.enemies || []).map((/** @type {any} */ e) => `${e.name}:${e.currentHp}`),
            overlays: [...document.querySelectorAll('.wm-victory, .gs-victory, .vc-root, dialog[open]')].map(d => String(d.className).slice(0, 40)),
            last: (window.SillyTavern.getContext().chat || []).slice(-3).map((/** @type {any} */ m) => String(m.mes).slice(0, 90)),
        };
    })));
    await closeAll();
    // Lo que dice el chat tras la pelea: el epílogo puede salir en el turno del enemigo (si se
    // rinde), fuera de ninguna acción medida.
    const afterFight = (await seen()).chat.join(' ');
    const done1 = await plotDone();
    check('hito 1: ganar la pelea del cuarto, sin modelo', done1.includes('el-caliz-ensangrentado'), JSON.stringify(done1));

    // --- Hito 2: hablar con Giles, pulsando -----------------------------------------------
    await act('Salir del tablero', () => slash('/leave'));
    await page.keyboard.press('1');
    await page.waitForTimeout(600);
    const giles = page.locator('#game-shell .gs-chip-action', { hasText: 'Hablar con Giles' });
    await act('Hablar con Giles (la ficha)', async () => {
        if (await giles.count() > 0) await giles.first().click();
        else await page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/hablar Giles'));
    });
    const done2 = await plotDone();
    check('hito 2: hablar con Giles, sin enviar ningún mensaje', done2.includes('el-precio-del-escape'), JSON.stringify(done2));

    // --- Z2: la charla, con cinco personajes -------------------------------------------------
    /** Hablar con alguien: la ventana, y preguntarle por cada tema. */
    const talkTo = async (/** @type {string} */ name) => {
        await page.evaluate((n) => window.SillyTavern.getContext().executeSlashCommandsWithOptions(`/hablar ${n}`), name);
        const opened = await page.waitForSelector('.popup:not([closing]) .tk-root', { timeout: 8000 }).then(() => true).catch(() => false);
        const topics = await page.locator('.popup:not([closing]) .tk-topic').evaluateAll(els => els.map(e => e.getAttribute('data-topic') || ''));
        for (const topic of topics.filter(t => ['hilo', 'sabe', 'quiere', 'vosotros'].includes(t))) {
            await page.locator(`.popup:not([closing]) .tk-topic[data-topic="${topic}"]`).click().catch(() => {});
            await page.waitForTimeout(400);
        }
        const lines = await page.locator('.popup:not([closing]) .tk-line').evaluateAll(els => els.map(e => (e.textContent || '').trim()));
        const mood = await page.locator('.popup:not([closing]) .tk-mood').textContent().catch(() => '');
        await closeAll();
        return { name, opened, topics, lines, mood };
    };
    const charlas = [];
    for (const name of ['Giles', 'Torres', 'Dunstan', 'Yorick']) charlas.push(await talkTo(name));
    if (process.argv.includes('--ver')) console.log('charlas:', JSON.stringify(charlas, null, 1).slice(0, 2500));
    // Desde el 2026-09-28, lo que sabe, busca y piensa sale cerrado hasta ganárselo (relación o
    // una tirada), y al pulsarlo dice cómo se abre: eso también es una respuesta.
    check('Z2: se habla con la gente de El Pueblo de Barro sin modelo: cada uno con al menos tres temas, y lo cerrado dice cómo se abre',
        charlas.every(c => c.opened && c.topics.length >= 3 && c.lines.length >= 3 && new Set(c.lines).size >= 2 && c.lines.every(l => !ORDER.test(l)))
        && charlas.some(c => c.lines.some(l => /sonsácale|aprecia/.test(l))),
        JSON.stringify(charlas.map(c => ({ name: c.name, topics: c.topics, lines: c.lines.length, mood: c.mood }))));
    // Lo que sabe depende de cómo os mire: solo a quien os aprecia; a los demás no se lo saca una pregunta.
    const knowsSaid = charlas.map(c => ({ name: c.name, mood: c.mood, told: c.lines.some(l => /\bSabe\b|sabe (?!pensar)/.test(l) && !/aprecia/.test(l)) }));
    // Amenazar se paga: después os mira peor, y lo que sabe ya no lo cuenta por preguntar.
    await page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/hablar Torres'));
    await page.waitForSelector('.popup:not([closing]) .tk-root', { timeout: 8000 }).catch(() => {});
    await page.locator('.popup:not([closing]) .tk-act', { hasText: 'Amenazar' }).click().catch(() => {});
    await page.waitForTimeout(800);
    await clearDice();
    await page.locator('.popup:not([closing]) .tk-topic[data-topic="sabe"]').click().catch(() => {});
    await page.waitForTimeout(500);
    const threat = {
        mood: await page.locator('.popup:not([closing]) .tk-mood').textContent().catch(() => ''),
        lines: await page.locator('.popup:not([closing]) .tk-line').evaluateAll(els => els.map(e => (e.textContent || '').trim())),
    };
    await closeAll();
    if (process.argv.includes('--ver')) console.log('amenaza:', JSON.stringify(threat));
    check('Z2: amenazar se paga: Torres os mira peor, y preguntado otra vez, no suelta lo que sabe',
        /fría|recelosa|hostil/.test(threat.mood || '') && threat.lines.length >= 2 && !/guardias aceptan sobornos/.test(threat.lines[threat.lines.length - 1] || ''),
        JSON.stringify(threat));
    check('Z2: lo que sabe, solo a quien os aprecia',
        knowsSaid.every(k => /cordial|amistosa|leal/.test(k.mood || '') ? k.told : !k.told), JSON.stringify(knowsSaid));

    // --- Tiradas: tres seguidas, y ninguna se queda echada ------------------------------
    for (const skill of ['investigation', 'perception', 'insight']) {
        await act(`/tirada ${skill}`, () => slash(`/tirada ${skill}`));
    }
    const locked = await page.evaluate(() => Boolean(window.SillyTavern.getContext().chatMetadata?.pendingCheck));
    const rolls = walk.filter(w => w.label.startsWith('/tirada') && !w.silent).length;
    check('se tira tres veces seguidas, y ninguna tirada se queda pendiente', rolls === 3 && !locked, JSON.stringify({ rolls, locked }));

    // --- Lo de cada día ------------------------------------------------------------------
    await act('El Diario', () => page.locator('#game-shell .gs-tools .gs-journal').click({ timeout: 5000 }).catch(() => {}));
    await act('La Mesa', () => page.locator('#game-shell .gs-tools .gs-table').click({ timeout: 5000 }).catch(() => {}));
    await act('Oír un rumor', () => slash('/rumor'));
    await act('Descansar (largo)', () => slash('/descanso largo'));
    /** Escribir en la caja y pulsar Intro, como quien juega. */
    const type = (/** @type {string} */ said) => act(`Escribir «${said}»`, async () => {
        await page.locator('#send_textarea').fill(said);
        await page.locator('#send_textarea').press('Enter');
    }, said);
    await type('voy a la posada');
    const boxLeft = await page.locator('#send_textarea').inputValue().catch(() => '');
    check('Z3: lo escrito lo lee el juego: la caja se vacía y la frase queda en el chat',
        boxLeft === '' && (await seen()).chat.some(t => t === 'voy a la posada'), JSON.stringify({ boxLeft }));
    await page.locator('#send_textarea').fill('').catch(() => {});

    // --- Hitos 3 y 4: viajar -------------------------------------------------------------
    await act('Viajar a Campamento Furtivo', () => slash('/go Campamento Furtivo'));
    await act('Acampar', () => slash('/acampar'));
    await act('Explorar', () => slash('/explorar'));
    await act('Viajar a Castillo de Vane', () => slash('/go Castillo de Vane'));
    const done4 = await plotDone();
    check('hitos 3 y 4: llegar al Campamento Furtivo y a Castillo de Vane, sin modelo',
        done4.includes('la-pista-en-el-barro') && done4.includes('el-invierno-cierra-el-paso'), JSON.stringify(done4));

    // --- Z3: la caja que entiende, en Castillo de Vane -------------------------------------
    // Hecho cuando: diez frases distintas en la caja, y todas hacen algo o enseñan qué se puede.
    const phrases = [
        'hablo con Lord Edmund Vane',
        'le pregunto a Oswald por los rumores',
        'voy a la tienda',
        'entro en el templo',
        'busco huellas en el barro',
        'examino las paredes del patio',
        'me escondo',
        'espero a la noche',
        'compro una antorcha',
        'me pongo a cantar una balada triste',
        'voy a Pekín',
        '¿Qué hago?',
    ];
    const typed = [];
    for (const said of phrases) typed.push(await type(said));
    if (process.argv.includes('--ver')) console.log('caja:', JSON.stringify(typed.map(t => ({ label: t.label, got: t.got })), null, 1));
    const answered = typed.filter(t => !t.silent);
    const taught = typed.filter(t => /Prueba: «/.test(t.texts.join(' ')));
    const didSomething = typed.filter(t => !t.silent && !/\[CAJA\]/.test(t.texts.join(' ')));
    check('Z3: doce frases distintas en la caja: todas contestan, y las que no se entienden enseñan qué escribir',
        answered.length === phrases.length && taught.length >= 2 && didSomething.length >= 9,
        JSON.stringify(typed.map(t => ({ label: t.label, silent: t.silent, got: t.got }))));
    const rolled = typed.filter(t => /\[TIRADA\]/.test(t.texts.join(' ')));
    check('Z3: intentar algo es una tirada que se cuenta y hace algo (bien, a medias o mal)',
        rolled.length >= 3 && rolled.every(t => /\[TIRADA\] .+\. .+/.test(t.texts.join(' '))),
        JSON.stringify(rolled.map(t => t.texts.join(' ').slice(0, 200))));

    // --- Z4: sucesos con decisiones -------------------------------------------------------
    // Hecho cuando: un viaje de tres días da al menos dos decisiones con efecto que se ven en el Diario.
    await closeAll();
    const cards = await page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const { chronicleOf } = await import('/scripts/game-engine/campaign/chronicle.js');
        const lines = (ctx.chat || []).map((/** @type {any} */ m) => String(m.extra?.display_text ?? m.mes ?? '')).filter(t => /\[SUCESO\]/.test(t));
        const diary = chronicleOf(ctx.chat || []).filter((/** @type {any} */ e) => e.tag === 'SUCESO').map((/** @type {any} */ e) => e.text);
        return { lines, diary, state: ctx.chatMetadata?.sucesos ?? null, trips: Number(ctx.chatMetadata?.stats?.trips) || 0 };
    });
    if (process.argv.includes('--ver')) console.log('sucesos:', JSON.stringify({ decided, ...cards }, null, 1).slice(0, 2500));
    check('Z4: cada viaje trae su decisión (los tramos dependen de lo que se descubra explorando), con efecto, y el Diario las apunta',
        cards.trips >= 3 && decided.length >= cards.trips && cards.lines.length >= cards.trips && cards.diary.length >= cards.trips
        && cards.lines.some(t => /\(.+\)/.test(t)),
        JSON.stringify({ trips: cards.trips, decided, lines: cards.lines.map(t => t.slice(0, 160)), diary: cards.diary.length }));

    // --- Z1: el narrador del motor cuenta los momentos --------------------------------------
    /** Lo que se leyó en el chat tras una acción. */
    const read = (/** @type {string} */ label) => (walk.find(w => w.label === label)?.texts ?? []).join('\n');
    const tells = {
        pelea: afterFight,
        descanso: read('Descansar (largo)'),
        viaje: read('Viajar a Campamento Furtivo'),
    };
    if (process.argv.includes('--ver')) {
        const tail = (await seen()).chat.slice(-40).filter(t => t.trim() && !/^\[|^⚔️|^🗡️|^🎲|^🛡️|^💬|^⏳|^🚶/.test(t));
        console.log(`\n--- lo que contó el narrador ---\n${tail.join('\n\n')}\n---\n`);
    }
    // J13.4: son cientos de frases, así que no se busca una en concreto: se mira que salga
    // alguna del banco de ese momento, por sus trozos fijos (lo que va entre los huecos).
    const bank = /** @type {any[]} */ (JSON.parse(readFileSync(join(ROOT, 'public/compendio/frases.json'), 'utf8')).rows);
    const toldBy = (/** @type {string} */ said, /** @type {string} */ kind) => bank.filter(row => row.kind === kind).some(row => {
        const pieces = String(row.text).split(/\{[^{}]*\}/).map(piece => piece.trim().toLowerCase()).filter(piece => piece.length >= 6);
        return pieces.length > 0 && pieces.every(piece => said.toLowerCase().includes(piece));
    });
    check('Z1: el final de la pelea se cuenta en prosa del motor',
        toldBy(tells.pelea, 'fin-combate'), tells.pelea.slice(-300));
    check('Z1: el descanso se cuenta, y el día nuevo se dice una vez',
        /\[DESCANSO\]/.test(tells.descanso) && toldBy(tells.descanso, 'descanso') && (tells.descanso.match(/día \d+/g) || []).length === 1, tells.descanso.slice(0, 300));
    check('Z1: el viaje y la llegada, en prosa: los días de camino, cómo es el sitio la primera vez y quién hay',
        /Campamento Furtivo/.test(tells.viaje) && toldBy(tells.viaje, 'viaje') && toldBy(tells.viaje, 'llegada'),
        tells.viaje.slice(0, 400));

    // --- El recuento ---------------------------------------------------------------------
    const silent = walk.filter(w => w.silent);
    const leaks = walk.filter(w => w.leaked);
    const everLeaked = (await seen()).chat.filter(t => ORDER.test(t));
    check('ninguna orden al narrador a la vista en toda la partida', everLeaked.length === 0 && leaks.length === 0,
        JSON.stringify(everLeaked.slice(0, 3).map(t => t.slice(0, 140))));
    console.log(`\nSILENCIOS: ${silent.length} de ${walk.length} acciones${silent.length ? ` (${silent.map(w => w.label).join(' · ')})` : ''}`);
    if (STRICT) check('ninguna acción sin respuesta', silent.length === 0, silent.map(w => w.label).join(' · '));

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
