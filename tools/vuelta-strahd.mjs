#!/usr/bin/env node
/**
 * La vuelta sin conexión de *La Maldición de Strahd*, de punta a punta (el hito M4 de
 * wiki/ROADMAP_SIN_CONEXION.md), contra un servidor propio con un `--dataRoot` temporal.
 *
 *   portada → «Jugar sin conexión» → Tessa → saltar la prueba → el tablón → Strahd → cada hito,
 *   a clics (escenas, viajes, tableros, peleas) → uno de sus tres finales.
 *
 * Es la hermana de `tools/vuelta-1387.mjs` y la juega el mismo `tools/vuelta-bot.mjs`: mira la
 * pantalla y pulsa lo que pulsaría quien juega, sin escribir nada. Apunta cada **silencio** (un
 * clic tras el que no cambia nada que se vea, o una escena sin texto) y cada **atasco** (lo que
 * pide la historia no está a la vista), con el sitio, el paso y lo que se ve.
 *
 * Juega los doce hitos del hilo, no solo el camino más corto al final: primero la aldea, el
 * campamento y Vallaki; luego la bodega, Krezk y Argynvostholt; y por último el molino y el
 * castillo. El final depende de a quién os hayáis ganado (`endingBy` del último hito).
 *
 * Uso:
 *   node tools/vuelta-strahd.mjs                         # sin ventana, puerto 8388
 *   node tools/vuelta-strahd.mjs --port 8388 --captura v.png
 *   node tools/vuelta-strahd.mjs --corto                 # solo el camino al final (sin la bodega, Krezk ni Argynvostholt)
 *   node tools/vuelta-strahd.mjs --peleas                # las peleas de verdad (mucho más lenta)
 *   node tools/vuelta-strahd.mjs --estricto              # y un silencio o un atasco cuentan como fallo
 *   node tools/vuelta-strahd.mjs --sitios                # en vez de la vuelta: lo que ofrece cada localización
 *   node tools/vuelta-strahd.mjs --perder                # perder la pelea de la taberna: ¿hay por dónde seguir?
 *   node tools/vuelta-strahd.mjs --secreto               # el hito escondido: la puerta sin pomo de la torre
 *   node tools/vuelta-strahd.mjs --encargos              # un encargo del tablón de Barovia, cogido y hecho
 */

/* global window, document, HTMLElement, MouseEvent */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBot, startOffline, runCampaign, fixedNumbers, proseNotes, printFindings } from './vuelta-bot.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8388;
const BASE = `http://127.0.0.1:${PORT}`;
const HEADED = process.argv.includes('--headed');
const SHOT = argAfter('--captura');
const STRICT = process.argv.includes('--estricto');
const REAL_FIGHTS = process.argv.includes('--peleas');
const SHORT = process.argv.includes('--corto');
// Con --sitios, en vez de la vuelta: lo que ofrece cada localización al llegar.
const SITES = process.argv.includes('--sitios');
// Con --perder: perder la primera pelea del hilo y ver que hay por dónde seguir.
const LOSE = process.argv.includes('--perder');
// Con --secreto: el hito escondido (la puerta sin pomo de la torre), como lo encontraría quien juega.
const SECRET = process.argv.includes('--secreto');
// Con --encargos: un encargo del acto 1 cogido en el tablón de Barovia y hecho allí, sin pelear.
const JOBS = process.argv.includes('--encargos');
const MAX_STEPS = Number(argAfter('--pasos')) || 1600;

const require = createRequire(join(ROOT, 'tests/package.json'));
const { chromium } = require('@playwright/test');
const readJson = (/** @type {string} */ path) => JSON.parse(readFileSync(join(ROOT, path), 'utf8'));

let failures = 0;
const check = (/** @type {string} */ name, /** @type {boolean} */ ok, detail = '') => {
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        -> ${detail}` : ''}`);
};
const number = (/** @type {string} */ what, /** @type {string|number} */ value) => console.log(`NUM   ${what}: ${value}`);
/** Las órdenes al narrador: sin modelo, si se ven, se leen como un error. */
const ORDER = /(Cuéntalo|Cuentalo|No inventes|Dilo tal cual|Describe la escena|Narra esta|Adapta la escena|Que se note|narra la consecuencia|No digas otra vez)/;
/** Una nota del juego que se lee en crudo, con su etiqueta: «[HILO] Hecho: …», «🤝 [CAMPAÑA] …». */
const RAW = /^\W{0,4}\[[A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ ·]{1,30}\]/u;

// El orden en que se siguen los hitos cuando hay varios abiertos: todo el hilo antes del castillo.
const FULL_ORDER = [
    'sangrienta-bienvenida', 'asedio-en-la-mansion', 'el-grito-en-el-sotano', 'lectura-interrumpida', 'panico-en-el-festival',
    'el-vinedo-asediado', 'lobos-a-las-puertas', 'el-caballero-sin-descanso',
    'pesadillas-de-molino', 'las-puertas-del-diablo', 'la-cena-esta-servida', 'el-senor-de-barovia',
];
const SHORT_ORDER = ['sangrienta-bienvenida', 'asedio-en-la-mansion', 'lectura-interrumpida', 'panico-en-el-festival',
    'pesadillas-de-molino', 'las-puertas-del-diablo', 'la-cena-esta-servida', 'el-senor-de-barovia'];

const dataRoot = mkdtempSync(join(tmpdir(), 'st-vuelta-strahd-'));
/** @type {any} */
let server = null;
/** @type {any} */
let browser = null;
/** @type {any} */
let page = null;

function startServer() {
    server = spawn(process.execPath, ['server.js', '--browserLaunchEnabled', 'false', '--port', String(PORT), '--dataRoot', dataRoot], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    const child = server;
    return new Promise((resolve, reject) => {
        // Con muchas vueltas a la vez en la máquina, el servidor puede tardar varios minutos en arrancar.
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

const t0 = Date.now();
const clock = (/** @type {number} */ ms) => `${Math.floor(ms / 60000)}:${String(Math.round((ms % 60000) / 1000)).padStart(2, '0')}`;

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
    });
    await context.addInitScript(() => {
        try {
            // Los consejos, vistos: se mide el juego, no enseñar a jugar (eso lo mira e2e-gremio).
            window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,combat,travel,prisoners,mesa,high,spell,pet,bill,move,attack,roll,talk,journal');
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
        } catch { /* nada */ }
    });

    // Con muchas vueltas a la vez en la máquina, la primera carga tarda: hasta dos minutos.
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    const bot = createBot(page, { fast: !REAL_FIGHTS, log: (line) => console.log(line) });
    const clicked = await startOffline(page, { name: 'Tessa', gender: 'Mujer', race: 'Humano', klass: 'Guerrero' });

    // --- El gremio: saltar la prueba y el tablón ------------------------------------------
    // La partida empieza en el muelle (J2.1): el prólogo se juega a clics hasta el gremio, que
    // es donde se ofrece «Saltar la prueba».
    await runCampaign(bot, {
        pack: readJson('public/mundos/gremio.pack.json'),
        stop: (now) => now.done.includes('la-prueba') || now.chips.includes('Saltar la prueba'),
        maxSteps: 250,
    });
    let v = await bot.observe();
    for (let i = 0; i < 60 && !v.done.includes('la-prueba'); i++) {
        v = await bot.observe();
        if (await bot.handleLayer(v)) continue;
        if (await bot.tapChip(v, /^Saltar la prueba$/, 'saltar la prueba', 'hub.js')) continue;
        if (v.scene === 'dialogue' && v.vn.next) await bot.act(v, '«Continuar»', () => bot.press(bot.chip(/^Continuar$/)));
    }
    check('en el gremio, «Saltar la prueba» deja el prólogo hecho', v.done.includes('la-prueba'), `${JSON.stringify(v.done)} · se ve: ${bot.describe(v).slice(0, 400)}`);
    if (SHOT && !v.done.includes('la-prueba')) await page.screenshot({ path: `${SHOT}.prologo.png` });
    const pack = readJson('public/mundos/strahd.pack.json');
    const onHub = async (/** @type {any} */ now) => {
        const card = page.locator('dialog[open] .hb-root [data-campaign="strahd"]');
        if (await card.count() === 0) return false;
        return bot.act(now, 'empezar Strahd en el tablón', () => bot.press(card), { module: 'hub-panel.js', wait: 8000 });
    };
    for (let i = 0; i < 40 && !/Strahd/.test(v.world); i++) {
        v = await bot.observe();
        if (await bot.handleLayer(v, { onHub })) continue;
        if (await bot.tapChip(v, /^Tablón de campañas$/, 'el tablón de campañas', 'action-chips.js')) continue;
        if (v.scene === 'dialogue' && v.vn.next) await bot.act(v, '«Continuar»', () => bot.press(bot.chip(/^Continuar$/)));
        else if (v.town.inside) await bot.toMap(v);
    }
    const started = await bot.until(async () => /Strahd/.test((await bot.observe()).world), 60000, 500);
    check('desde el tablón empieza La Maldición de Strahd', started, bot.describe(await bot.observe()).slice(0, 300));
    await bot.until(async () => (await bot.observe()).open.length > 0, 20000, 400);
    if (SHOT) await page.screenshot({ path: SHOT });

    // --- Con --sitios: qué se puede hacer en cada localización, como lo ve quien llega ---------
    // Se pone al grupo en cada sitio (un gancho, sin viajar) y se lee lo que ofrece la pantalla:
    // la gente, los rumores, los tableros, los sitios del pueblo. Un sitio sin nada propio es un
    // fallo: «un sitio sin nada que hacer» (M4).
    if (SITES) {
        const DOING = /^(Hablar con|Escuchar rumores|Entrar en|Explorar|Cazar|Buscar|Magia|Curar|Tirada|Examinar|Mirar|Iniciar combate|Evitar la pelea|Comprar|Vender|Descansar en|Encargo|Tablón|Aceptar|Quedar|Charlar)/;
        await page.evaluate(async (names) => (await import('/scripts/party.js')).revealLocationsForSimulation(names), (pack.locations ?? []).map((/** @type {any} */ l) => String(l.name)));
        for (const place of pack.locations ?? []) {
            const name = String(place.name);
            await page.evaluate(async (where) => {
                (await import('/scripts/party.js')).enterStartingLocation(where);
                const shell = await import('/scripts/game-engine/ui/shell/game-shell.js');
                if (shell.isShellOpen()) shell.refreshGameShell();
            }, name);
            await bot.until(async () => (await bot.observe()).location === name, 8000, 300);
            await page.waitForTimeout(600);
            let seen = await bot.observe();
            for (let i = 0; i < 6 && (seen.layer || seen.dice); i++) {
                await bot.handleLayer(seen);
                seen = await bot.observe();
            }
            if (seen.scene !== 'exploration' && !seen.town.inside && seen.town.places.length === 0) {
                const map = page.locator('#game-shell .gs-tools .gs-map:visible');
                if (await map.count() > 0) await map.first().click({ timeout: 1500 }).catch(() => {});
                await page.waitForTimeout(500);
                seen = await bot.observe();
            }
            // Lo escondido tras «+N más», también.
            const more = await page.evaluate(async () => {
                const chip = [...document.querySelectorAll('#game-shell .gs-chip-action')].find(c => /^\+\d+ más$/.test((c.textContent || '').trim()));
                if (!(chip instanceof HTMLElement)) return [];
                chip.click();
                await new Promise(r => setTimeout(r, 400));
                const box = document.querySelector('dialog[open]:not([closing])');
                const labels = box ? [...box.querySelectorAll('button, .menu_button')].map(b => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean) : [];
                box?.querySelector('.popup-button-ok, .popup-button-close')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                await new Promise(r => setTimeout(r, 300));
                return labels;
            });
            const chips = [...new Set([...seen.chips, ...more])].filter(c => !/^\+\d+ más$/.test(c));
            const doing = chips.filter(c => DOING.test(c));
            const town = seen.town.places.map((/** @type {any} */ p) => p.id);
            const total = doing.length + town.length + seen.boards.length;
            check(`en ${name} hay algo que hacer (${total})`, total > 0, `se ve: ${bot.describe(seen).slice(0, 240)}`);
            console.log(`      ${doing.join(' · ') || '—'}${town.length ? ` | pueblo: ${town.join(', ')}` : ''}${seen.boards.length ? ` | tableros: ${seen.boards.join(', ')}` : ''}`);
            if (SHOT) await page.screenshot({ path: `${SHOT}.sitio-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png` });
        }
        throw Object.assign(new Error('fin del recorrido de sitios'), { sites: true });
    }

    // --- Con --perder: la pelea de la taberna, perdida. ¿Qué se ve, y hay por dónde seguir? ------
    // Se juega hasta la primera pelea del hilo; entonces los enemigos se vuelven imposibles y el
    // grupo se queda con un punto de vida. Tras la derrota, la vuelta sigue como quien juega
    // (vuelve al punto guardado, carga la partida o descansa) y el hito tiene que poder cumplirse.
    if (LOSE) {
        await runCampaign(bot, { pack, order: FULL_ORDER, maxSteps: 250, stop: (now) => Boolean(now.fight) });
        let seen = await bot.observe();
        check('se llega a la pelea de la taberna', Boolean(seen.fight), bot.describe(seen).slice(0, 240));
        await page.evaluate(async () => {
            const state = await import('/scripts/party/state.js');
            // A los enemigos no se les toca (con 999 PG y CA 40, la revancha salía igual de
            // imposible): se pierde porque el grupo, con 1 PG y CA 1, deja pasar sus turnos.
            // La armadura de quien juega se guarda para devolvérsela tras perder: si no, la
            // revancha se jugaba con CA 1 y no se ganaba nunca.
            const keep = /** @type {any} */ (window);
            keep.__vueltaArmor = state.partyMembers.map(m => [m.name, m.armorClass]);
            for (const member of state.partyMembers) Object.assign(member, { hp: 1, armorClass: 1 });
        });
        for (let i = 0; i < 300; i++) {
            seen = await bot.observe();
            if (!seen.fight) break;
            if (seen.layer || seen.dice) {
                await bot.handleLayer(seen);
                continue;
            }
            if (seen.fight.mine) await page.evaluate(async () => (await import('/scripts/party/player-actions.js')).endPlayerCombatTurn());
            else await page.waitForTimeout(700);
        }
        await page.waitForTimeout(1500);
        seen = await bot.observe();
        const lost = await page.evaluate(() => {
            const chat = window.SillyTavern.getContext().chat || [];
            return chat.slice(-14).map((/** @type {any} */ m) => String(m.extra?.display_text ?? m.mes ?? '').slice(0, 200));
        });
        if (SHOT) await page.screenshot({ path: `${SHOT}.derrota.png` });
        check('la pelea acaba en derrota, dicha', !seen.fight && lost.some(t => /derrota|han caido|han caído|No queda nadie/i.test(t)),
            JSON.stringify({ layer: seen.layer?.kind, title: seen.layer?.title, text: seen.layer?.text?.slice(0, 200), buttons: seen.layer?.buttons, chips: seen.chips, last: lost.slice(-5) }));
        console.log(`      tras perder se ve: ${bot.describe(seen).slice(0, 400)}`);
        await page.evaluate(async () => {
            const state = await import('/scripts/party/state.js');
            const armor = new Map(/** @type {any} */ (window).__vueltaArmor ?? []);
            for (const member of state.partyMembers) if (armor.has(member.name)) member.armorClass = armor.get(member.name);
        });
        // La revancha, con «Que actúe solo» (el gancho): la bruja huye de casilla en casilla y
        // la vuelta, a clics, anda hasta ella pero no ataca después de andar.
        process.env.VUELTA_PELEAS = 'gancho';
        const after = await runCampaign(bot, {
            pack, order: FULL_ORDER, maxSteps: 250,
            stop: (now) => now.done.includes('sangrienta-bienvenida'),
        });
        // Si no se gana: cómo están los enemigos de la revancha y lo último que se dijo.
        const foes = after.reached ? [] : await page.evaluate(async () => {
            const fight = /** @type {any} */ ((await import('/scripts/party.js')).getCombatEncounter());
            const chat = (window.SillyTavern.getContext().chat || []).slice(-8).map((/** @type {any} */ m) => String(m.mes ?? '').slice(0, 160));
            return [...(fight?.enemies ?? []).map((/** @type {any} */ e) => `${e.name} ${e.currentHp}/${e.maxHp} CA ${e.armorClass} (${e.gridX},${e.gridY})${e.vueltaSeen ? ' visto' : ''}`), ...chat];
        });
        check('tras perder, la pelea de la taberna se puede volver a jugar y ganar (hay por dónde seguir)', after.reached,
            JSON.stringify({ gaveUp: after.gaveUp, falls: bot.falls, where: bot.where(after.view), foes }));
        throw Object.assign(new Error('fin de la prueba de perder'), { sites: true });
    }

    // --- Con --secreto: la puerta sin pomo de la torre de Van Richten (el hito escondido) ---------
    // Lo que lleva a ella: un rumor de Vallaki pone la torre en el mapa, y en la torre se examina
    // la puerta (Investigación). Si la tirada sale mal, otro día se puede volver a mirar.
    if (SECRET) {
        const rumor = (pack.rumors ?? []).find((/** @type {any} */ r) => r.leadsTo === 'Torre de Van Richten');
        check('un rumor pone la torre de Van Richten en el mapa', Boolean(rumor), JSON.stringify(rumor ?? null));
        const tower = 'Torre de Van Richten';
        await page.evaluate(async (where) => {
            const party = await import('/scripts/party.js');
            await party.revealLocationsForSimulation([where]);
            party.enterStartingLocation(where);
            const shell = await import('/scripts/game-engine/ui/shell/game-shell.js');
            if (shell.isShellOpen()) shell.refreshGameShell();
        }, tower);
        await bot.until(async () => (await bot.observe()).location === tower, 8000, 300);
        const door = /^Examinar la puerta de hierro sin pomo/;
        let found = false;
        /** @type {string[]} */
        const tries = [];
        for (let attempt = 0; attempt < 8 && !found; attempt++) {
            let seen = await bot.observe();
            for (let i = 0; i < 8 && (seen.layer || seen.dice); i++) {
                await bot.handleLayer(seen);
                seen = await bot.observe();
            }
            if (seen.scene !== 'exploration') await bot.toMap(seen);
            seen = await bot.observe();
            let pressed = await bot.tapChip(seen, door, 'examinar la puerta sin pomo', 'action-chips.js');
            if (!pressed) {
                // Detrás de «+N más».
                pressed = await page.evaluate(async (source) => {
                    const chip = [...document.querySelectorAll('#game-shell .gs-chip-action')].find(c => /^\+\d+ más$/.test((c.textContent || '').trim()));
                    if (!(chip instanceof HTMLElement)) return false;
                    chip.click();
                    await new Promise(r => setTimeout(r, 400));
                    const box = document.querySelector('dialog[open]:not([closing])');
                    const want = new RegExp(source);
                    const button = box ? [...box.querySelectorAll('button, .menu_button')].find(b => want.test((b.textContent || '').replace(/\s+/g, ' ').trim())) : null;
                    if (button instanceof HTMLElement) {
                        button.click();
                        return true;
                    }
                    box?.querySelector('.popup-button-ok, .popup-button-close')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                    return false;
                }, door.source);
            }
            if (!pressed) {
                tries.push(`intento ${attempt + 1}: no se ve «Examinar la puerta…» (${seen.chips.join(' · ').slice(0, 200)})`);
            }
            // Los dados y lo que salga.
            for (let i = 0; i < 12; i++) {
                await page.waitForTimeout(400);
                seen = await bot.observe();
                if (seen.done.includes('la-puerta-sin-pomo')) found = true;
                if (!seen.layer && !seen.dice) break;
                if (seen.layer?.kind === 'scene' && SHOT) await page.screenshot({ path: `${SHOT}.secreto.png` });
                await bot.handleLayer(seen);
            }
            seen = await bot.observe();
            found = found || seen.done.includes('la-puerta-sin-pomo');
            if (pressed) tries.push(`intento ${attempt + 1}: ${found ? 'encontrada' : 'sin suerte'} (${seen.last.slice(0, 120)})`);
            if (!found) {
                // Otro día: acampar aquí, y volver a mirar.
                if (seen.scene !== 'exploration') await bot.toMap(seen);
                await bot.tapChip(await bot.observe(), /^Acampar aquí$/, 'acampar aquí (otro día)', 'action-chips.js');
                for (let i = 0; i < 10; i++) {
                    await page.waitForTimeout(400);
                    seen = await bot.observe();
                    if (!seen.layer && !seen.dice) break;
                    await bot.handleLayer(seen);
                }
            }
        }
        console.log(`      ${tries.join('\n      ')}`);
        const told = await page.evaluate(() => (window.SillyTavern.getContext().chat || [])
            .some((/** @type {any} */ m) => /Tanteáis la pared|estuche de repuesto/.test(String(m.extra?.display_text ?? m.mes ?? ''))));
        check('el secreto de la torre se encuentra examinando la puerta, y se cuenta (M4)', found && told, JSON.stringify({ found, told }));
        if (SHOT) await page.screenshot({ path: `${SHOT}.secreto-final.png` });
        throw Object.assign(new Error('fin de la prueba del secreto'), { sites: true });
    }

    // --- Con --encargos: el tablón de Barovia (M4) ---------------------------------------------
    // Los encargos del acto 1 son todos de Barovia, y Barovia no tenía tablón: no se veían hasta
    // Vallaki. Ahora: llegar, entrar en «Las notas de la puerta de la iglesia», «Mirar el
    // tablón», aceptar uno que se hace sin pelear y hacerlo allí con una tirada que salga.
    if (JOBS) {
        // La pelea de la taberna, con «Que actúe solo» (el gancho): aquí se miden los encargos, y
        // a clics la vuelta persigue a la bruja sin atacar tras andar.
        process.env.VUELTA_PELEAS = 'gancho';
        // Hasta ganar la taberna: si la vuelta se rinde a medias (la pelea en marcha), otra vez.
        for (let round = 0; round < 3; round++) {
            const got = await runCampaign(bot, { pack, order: FULL_ORDER, maxSteps: 300, stop: (now) => now.done.includes('sangrienta-bienvenida') });
            if (got.reached) break;
            console.log(`      la vuelta se paró antes de ganar la taberna: ${got.gaveUp}`);
        }
        let seen = await bot.observe();
        for (let i = 0; i < 10 && (seen.layer || seen.dice || seen.fight); i++) {
            await bot.handleLayer(seen);
            seen = await bot.observe();
        }
        check('el grupo está en la Aldea de Barovia, con la taberna ganada', seen.location === 'Aldea de Barovia' && seen.done.includes('sangrienta-bienvenida'), bot.where(seen));
        const villageJobs = (pack.contracts ?? []).filter((/** @type {any} */ c) => c.where === 'Aldea de Barovia');
        // A la pantalla del pueblo, y al tablón. La vuelta se para dentro del tablero de la
        // taberna: primero se sale de él (y de la caja de la novela) hasta ver el pueblo.
        // Al ganar salen ventanas una tras otra (la victoria, la escena del hito siguiente, de
        // varias páginas): se cierran todas antes de mirar el pueblo.
        for (let i = 0; i < 40; i++) {
            if (seen.layer || seen.dice) await bot.handleLayer(seen);
            else if (seen.board || seen.town.inside || seen.town.places.length === 0) {
                if (!await bot.toMap(seen)) await page.waitForTimeout(800);
            } else {
                await page.waitForTimeout(1200);
                const again = await bot.observe();
                if (!again.layer && !again.dice) break;
            }
            seen = await bot.observe();
        }
        seen = await bot.observe();
        const board = page.locator('#game-shell .gs-town-place[data-place="tablon"]');
        const hasBoard = await board.count() > 0;
        check('Barovia tiene tablón en la pantalla del pueblo', hasBoard, `${JSON.stringify(seen.town.places)} · ${bot.describe(seen).slice(0, 300)}`);
        if (hasBoard) await bot.act(seen, 'entrar en el tablón', () => bot.press(board), { module: 'town-scene.js' });
        seen = await bot.observe();
        const look = page.locator('#game-shell .gs-town-act[data-action="board"]');
        if (await look.count() > 0) await bot.act(seen, '«Mirar el tablón»', () => bot.press(look), { module: 'town.js' });
        await page.waitForSelector('dialog[open] .gd-root', { timeout: 15000 }).catch(() => {});
        const cards = await page.evaluate(() => [...document.querySelectorAll('dialog[open] .gd-contract')].map(c => ({
            title: (c.querySelector('.gd-contract-title')?.textContent || '').trim(),
            meta: (c.querySelector('.gd-contract-meta')?.textContent || '').replace(/\s+/g, ' ').trim(),
        })));
        if (SHOT) await page.screenshot({ path: `${SHOT}.tablon-barovia.png` });
        const ours = cards.filter(c => villageJobs.some((/** @type {any} */ j) => j.title === c.title));
        check('en el tablón de Barovia salen sus encargos del acto 1', ours.length > 0, JSON.stringify({ cards, villageJobs: villageJobs.map((/** @type {any} */ j) => j.title) }));
        const pick = villageJobs.find((/** @type {any} */ j) => j.noFight && ours.some(c => c.title === j.title));
        if (pick) {
            const take = page.locator('dialog[open] .gd-contract').filter({ hasText: pick.title }).locator('.gd-take');
            await take.first().click({ timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(800);
            // Lo que pregunte al aceptar (si lo hay), que sí.
            const ok = page.locator('dialog[open] .popup-button-ok:visible');
            if (await ok.count() > 0) await ok.first().click({ timeout: 2000 }).catch(() => {});
            await page.waitForTimeout(800);
        }
        const takenId = await page.evaluate(() => String(window.SillyTavern.getContext().chatMetadata?.contractTaken?.title || ''));
        check(`se acepta «${pick?.title ?? '—'}» (sin pelear)`, Boolean(pick) && takenId === pick.title, takenId);
        // Hacerlo: una tirada que salga, en Barovia. Lo que hay que mirar (o hablar) está en el sitio.
        /** @type {string[]} */
        const tries = [];
        let finished = false;
        for (let attempt = 0; attempt < 8 && pick && !finished; attempt++) {
            seen = await bot.observe();
            for (let i = 0; i < 8 && (seen.layer || seen.dice); i++) {
                await bot.handleLayer(seen);
                seen = await bot.observe();
            }
            if (seen.town.inside) await bot.toMap(seen);
            seen = await bot.observe();
            const checkChip = seen.chips.find((/** @type {string} */ c) => /^(Examinar|Buscar|Mirar|Escuchar|Rastrear|Registrar)\b/.test(c));
            if (checkChip) {
                await bot.tapChip(seen, new RegExp(`^${checkChip.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), `tirada: ${checkChip}`, 'action-chips.js');
                for (let i = 0; i < 12; i++) {
                    await page.waitForTimeout(400);
                    seen = await bot.observe();
                    if (!seen.layer && !seen.dice) break;
                    await bot.handleLayer(seen);
                }
            } else {
                tries.push(`intento ${attempt + 1}: sin nada que tirar a la vista (${seen.chips.join(' · ').slice(0, 200)})`);
            }
            finished = await page.evaluate(() => !window.SillyTavern.getContext().chatMetadata?.contractTaken);
            tries.push(`intento ${attempt + 1}: ${checkChip ?? '—'} → ${finished ? 'hecho' : 'aún no'}`);
            if (!finished) {
                await bot.tapChip(await bot.observe(), /^Acampar aquí$/, 'acampar aquí (otro día)', 'action-chips.js');
                for (let i = 0; i < 10; i++) {
                    await page.waitForTimeout(400);
                    seen = await bot.observe();
                    if (!seen.layer && !seen.dice) break;
                    await bot.handleLayer(seen);
                }
            }
        }
        console.log(`      ${tries.join('\n      ')}`);
        const said = await page.evaluate(() => (window.SillyTavern.getContext().chat || []).slice(-30)
            .map((/** @type {any} */ m) => String(m.extra?.display_text ?? m.mes ?? '')).filter(t => /ncargo/.test(t)).slice(-3));
        check('el encargo se hace en Barovia, sin pelear, con una tirada', finished, JSON.stringify(said).slice(0, 400));
        if (SHOT) await page.screenshot({ path: `${SHOT}.encargo-hecho.png` });
        throw Object.assign(new Error('fin de la prueba de los encargos'), { sites: true });
    }

    // --- Strahd, a clics, hasta un final ------------------------------------------------------
    // Con --captura, una foto de cada escena del hilo la primera vez que sale (para mirarlas).
    const shotScenes = new Set();
    const sceneWatch = SHOT ? setInterval(() => {
        void page.evaluate(() => document.querySelector('dialog[open] .ps-root')?.getAttribute('data-scene') || '').then(async (/** @type {string} */ id) => {
            if (!id || shotScenes.has(id)) return;
            shotScenes.add(id);
            await page.waitForTimeout(700);
            await page.screenshot({ path: `${SHOT}.escena-${id}.png` });
        }).catch(() => {});
    }, 900) : null;
    const played = await runCampaign(bot, {
        pack,
        order: SHORT ? SHORT_ORDER : FULL_ORDER,
        maxSteps: MAX_STEPS,
        stop: (now) => now.layer?.kind === 'end' || Boolean(now.ending),
    });
    if (sceneWatch) clearInterval(sceneWatch);
    v = played.view;
    // El final puede tardar un momento en abrir su ventana tras el último tablero.
    await bot.until(async () => (await page.locator('dialog[open] .end-root').count()) > 0, 8000, 300);
    const ending = await page.evaluate(() => {
        const root = document.querySelector('dialog[open] .end-root');
        const meta = window.SillyTavern.getContext().chatMetadata || {};
        return {
            id: String(meta.plotEnding || meta.plotState?.ending || ''),
            title: (root?.querySelector('h3')?.textContent || '').replace(/^Final: /, '').trim(),
            scene: (root?.querySelector('.end-scene')?.textContent || '').trim().slice(0, 200),
            people: [...(root?.querySelectorAll('.end-epilogue') ?? [])].length,
            numbers: [...(root?.querySelectorAll('.end-number') ?? [])].map(n => (n.textContent || '').trim()),
        };
    });
    if (SHOT) await page.screenshot({ path: `${SHOT}.final.png` });
    const endings = Object.keys(pack.plot?.endings ?? {});
    check('Strahd llega a uno de sus tres finales, con su escena (M4)',
        endings.includes(ending.id) && ending.title.length > 0 && ending.scene.length > 0,
        JSON.stringify({ ending, gaveUp: played.gaveUp, where: bot.where(v), sees: bot.describe(v).slice(0, 300) }));
    const main = (pack.plot?.milestones ?? []).filter((/** @type {any} */ m) => !m.hidden && m.opens?.kind !== 'clock').map((/** @type {any} */ m) => String(m.id));
    const wanted = SHORT ? SHORT_ORDER : FULL_ORDER;
    const missed = wanted.filter(id => !v.done.includes(id));
    check(`los hitos del hilo que se buscaban, hechos (${wanted.length})`, missed.length === 0, `faltan: ${missed.join(', ')}`);
    // Cada hito del hilo se cuenta en su ventana de escena, con gente que habla y una decisión.
    const scenes = new Set(bot.choices.map(c => c.scene));
    const told = wanted.filter(id => scenes.has(id));
    check('cada hito del hilo tiene su escena con una decisión (M5)', told.length === wanted.length,
        `sin decisión: ${wanted.filter(id => !scenes.has(id)).join(', ')}`);

    // --- Y de vuelta al gremio, con el final apuntado en el Salón de la fama (J4.5, J3.9) ------
    const guildWorld = /Gremio/;
    const home = page.locator('dialog[open] .end-home');
    const pressed = await home.count() > 0 && await home.first().click({ timeout: 3000 }).then(() => true).catch(() => false);
    const backHome = pressed && await bot.until(async () => guildWorld.test((await bot.observe()).world), 90000, 500);
    const hall = await page.evaluate(() => {
        const list = /** @type {any} */ (window.SillyTavern.getContext().extensionSettings)?.partyHall;
        return (Array.isArray(list) ? list : Array.isArray(list?.entries) ? list.entries : [])
            .filter((/** @type {any} */ e) => e?.kind === 'campaign').map((/** @type {any} */ e) => JSON.stringify(e).slice(0, 200));
    }).catch(() => []);
    check('«Volver al gremio» desde el final lleva al gremio, y el Salón de la fama apunta Strahd',
        backHome && hall.some((/** @type {string} */ e) => /Strahd/i.test(e)), JSON.stringify({ pressed, backHome, hall }));
    if (SHOT) await page.screenshot({ path: `${SHOT}.gremio.png` });

    // --- Lo que se ha leído: ni órdenes al narrador ni etiquetas del motor -------------------
    const read = await page.evaluate(() => (window.SillyTavern.getContext().chat || [])
        .map((/** @type {any} */ m) => String(m.extra?.display_text ?? m.mes ?? '')));
    const leaks = read.filter(t => ORDER.test(t));
    check('ninguna orden al narrador a la vista en toda la vuelta', leaks.length === 0, JSON.stringify(leaks.slice(0, 3).map(t => t.slice(0, 160))));
    const raw = read.filter(t => RAW.test(t));
    const box = await page.evaluate(() => {
        const form = document.querySelector('#send_form');
        if (!form) return false;
        const r = form.getBoundingClientRect();
        return r.width > 1 && r.height > 1 && window.getComputedStyle(form).visibility !== 'hidden';
    });
    check('sin caja de texto a la vista (sin conexión, D-J44)', !box);

    // --- El recuento --------------------------------------------------------------------------
    const all = fixedNumbers(readJson);
    const notes = proseNotes(ROOT);
    // Silencios, atascos, lo que se ve mal, caídas, clics lentos y lo elegido: como en las otras vueltas.
    printFindings(bot);
    // J18.10: las notas con su etiqueta del motor que quedan en el chat. La caja de la novela las
    // limpia al pintarlas: lo que se VE lo mira el bot en cada paso (`oddities`, «crudo»).
    const visible = bot.oddities.filter(o => o.kind === 'crudo');
    if (raw.length > 0) {
        console.log('\n--- notas con etiqueta del motor en el chat (sin pintar; la caja las limpia) ---');
        for (const t of [...new Set(raw)].slice(0, 12)) console.log(`  ${t.slice(0, 160)}`);
    }

    console.log('\n--- los números ---');
    number('Hitos de Strahd jugados sin conexión en la vuelta', `${v.done.filter((/** @type {string} */ id) => main.includes(id)).length} de ${main.length}`);
    number('El final', ending.title ? `${ending.title} (${ending.id})` : 'ninguno');
    number('Silencios en la vuelta sin modelo', bot.silences.length);
    number('Atascos (rescatados con un comando)', bot.blocks.length);
    number('Tiempo de «Jugar sin conexión» a la primera decisión', bot.firstDecisionAt ? clock(bot.firstDecisionAt - clicked) : 'sin decidir');
    number('Días de campaña', v.day);
    number('Pasos (clics)', bot.steps.length);
    number('Peleas, escenas con decisión, sucesos, charlas, viajes y tiradas',
        `${bot.counts.fights} · ${bot.counts.options} · ${bot.counts.sucesos} · ${bot.counts.talks} · ${bot.counts.travels} · ${bot.counts.checks}`);
    number('Notas del juego con su versión en prosa', `${notes.prose} de ${notes.total} (etiqueta del motor a la vista en la vuelta: ${visible.length}; en el chat, sin pintar: ${raw.length})`);
    number('Escenas del hilo que salen con su hito ya cumplido', bot.oddities.filter(o => o.kind === 'tarde').length);
    number('Ventanas abiertas encima de otra a medias', bot.oddities.filter(o => o.kind === 'encima').length);
    number('Peleas que tardan en cerrarse sin enemigos en pie (más de 3 s)', bot.oddities.filter(o => o.kind === 'cierre').length);
    number('Veces que cae el grupo entero', `${bot.falls.length} (partidas cargadas después: ${bot.counts.loads})`);
    number('Descansos (posada, acampar, cazar), al ver el agotamiento o media vida', bot.counts.rests);
    number('«Otra salida» antes o en mitad de una pelea (la vuelta elige pelear)', bot.counts.exits);
    number('Turnos del grupo jugados con el gancho (la barra de combate no respondía)', bot.counts.hooked);
    number('Clics lentos (más de 1,5 s)', bot.slow.length ? `${bot.slow.length} (el peor, ${Math.max(...bot.slow.map(s => s.ms))} ms)` : 0);
    number('Filas del narrador (frases.json)', all.frases);
    number('Sucesos con decisión (sucesos.json)', all.sucesos);
    number('Charlas con ramas escritas en Strahd', all.charlasStrahd);
    number('Jugadores en la partida', 1);
    number('Lo que tarda la vuelta', clock(Date.now() - t0));
    if (STRICT) {
        check('ningún silencio', bot.silences.length === 0, bot.silences.map(s => `#${s.n} ${s.what}`).join(' · '));
        check('ningún atasco', bot.blocks.length === 0, bot.blocks.map(b => `#${b.n} ${b.goal}`).join(' · '));
    }
    check('sin errores en la página', problems.length === 0, problems.slice(0, 6).join('\n        '));
} catch (error) {
    const sitesDone = Boolean(/** @type {any} */ (error)?.sites);
    if (!sitesDone) {
        failures++;
        console.log(`FAIL  the run threw: ${/** @type {any} */ (error)?.message || error}`);
        if (SHOT && page) await page.screenshot({ path: `${SHOT}.error.png` }).catch(() => {});
    }
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
