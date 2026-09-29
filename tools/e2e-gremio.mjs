#!/usr/bin/env node
/**
 * El recorrido de «Jugar sin conexión» (J4 de ROADMAP_SIN_CONEXION), de punta a punta, contra
 * un servidor propio con un `--dataRoot` temporal, como `e2e-quick.mjs`:
 *
 *   título → Jugar sin conexión → tu personaje → el prólogo (J2.1: el ratero del muelle, la
 *   charla con Tomás y Brunilda) → la prueba de la bodega → contratar a un
 *   mercenario → el tablón → La Maldición de Strahd → volver al gremio → seguir la campaña
 *   → terminarla y volver con lo ganado, y sale en el salón (J4.5, J3.9)
 *   → y el título ofrece «Continuar» y «Cargar partida» lista el gremio como una partida
 *   (J0.5, J0.6), sin fichas de SillyTavern a la vista en todo el camino (J0.3)
 *   → al entrar, con quién (J18.1): uno nuevo en el
 *   mismo gremio, cambiar quién va en el tablón (J1.6) y volver a entrar con el guardado.
 *
 * Uso:
 *   node tools/e2e-gremio.mjs            # sin ventana
 *   node tools/e2e-gremio.mjs --headed   # mirándolo
 *   node tools/e2e-gremio.mjs --port 8130 --captura gremio.png
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
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8128;
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

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-gremio-'));
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
    page = await context.newPage();
    /** @type {string[]} */
    const problems = [];
    page.on('pageerror', e => problems.push(`PAGEERROR ${e.message}`));
    page.on('console', m => {
        if (m.type() === 'error' && !/Failed to load resource.*404/.test(m.text())) problems.push(`ERROR ${m.text().slice(0, 300)}`);
    });
    // Un 500 en la consola no dice de dónde; esto sí.
    page.on('response', r => { if (r.status() >= 500) problems.push(`HTTP ${r.status()} ${r.request().method()} ${r.url()}`); });
    await context.addInitScript(() => {
        // J2.2: cada consejo que sale, apuntado, y cuántos ha habido a la vez como mucho.
        const seenTips = /** @type {any} */ (window);
        seenTips.__tips = [];
        seenTips.__tipsAtOnce = 0;
        const isTip = (/** @type {any} */ n) => n instanceof HTMLElement && n.classList.contains('toast') && /Consejo/.test(n.querySelector('.toast-title')?.textContent || '');
        // Y los avisos de «Tu personaje» y «Lo que sabes hacer», que tienen que ser cortos.
        seenTips.__heroToasts = [];
        const isHeroToast = (/** @type {any} */ n) => n instanceof HTMLElement && n.classList.contains('toast') && /Tu personaje|Lo que sabes hacer/.test(n.querySelector('.toast-title')?.textContent || '');
        new window.MutationObserver(records => {
            for (const added of records.flatMap(r => [...r.addedNodes]).filter(isTip)) {
                seenTips.__tips.push((added.querySelector('.toast-message')?.textContent || '').trim());
                seenTips.__tipsAtOnce = Math.max(seenTips.__tipsAtOnce, [...document.querySelectorAll('.toast')].filter(isTip).length);
            }
            for (const added of records.flatMap(r => [...r.addedNodes]).filter(isHeroToast)) {
                seenTips.__heroToasts.push((added.querySelector('.toast-message')?.textContent || '').trim());
            }
        }).observe(document, { childList: true, subtree: true });
        try {
            // Los consejos de J2.2 (la pelea, andar, el Diario…) no se dan por vistos: la vuelta
            // mira que salen una vez. Y lo visto sigue visto al recargar, como en un navegador.
            if (window.localStorage.getItem('sillytavern_gameTipsSeen') === null) {
                window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,travel,prisoners,mesa,high,spell,pet,bill');
            }
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
            window.localStorage.setItem('sillytavern_gameSucesos', 'off');
        } catch { /* nada */ }
    });

    /** Lo que el juego sabe ahora: el mundo, el chat, el grupo y el tablero. */
    const state = () => page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const party = (await import('/scripts/party.js')).getPartyMembersSnapshot();
        return {
            world: String(ctx.chatMetadata?.world_info ?? ''),
            chat: String(ctx.getCurrentChatId?.() ?? ''),
            location: String(ctx.chatMetadata?.currentLocation ?? ''),
            board: String(ctx.chatMetadata?.currentBoard ?? ''),
            party: party.map((/** @type {any} */ m) => ({ name: m.name, gold: Number(m.gold) || 0, guest: Boolean(m.guest), wiUid: m.wiUid, world: m.worldName, level: m.level })),
            fighting: Boolean(ctx.chatMetadata?.combatEncounter?.active),
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
    /** Los dados que quedan en pantalla, con su fondo, se pasan como lo haría quien juega. */
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
    /** Espera a que se cumpla algo, sin dormir de más. */
    const until = async (/** @type {() => Promise<boolean>} */ test, ms = 30000) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (await test().catch(() => false)) return true;
            await page.waitForTimeout(400);
        }
        return false;
    };
    /** J2.2: los consejos que han salido en esta página, en orden. */
    const tipsShown = () => page.evaluate(() => /** @type {string[]} */ (/** @type {any} */ (window).__tips || []));
    /** J2.2: cerrar los consejos, como quien los lee, hasta que salga este. Salen de uno en uno. */
    const tipsUntil = async (/** @type {RegExp} */ pattern, ms = 45000) => {
        await until(async () => {
            if ((await tipsShown()).some(t => pattern.test(t))) return true;
            await page.evaluate(() => [...document.querySelectorAll('#toast-container .toast')]
                .filter(t => /Consejo/.test(t.querySelector('.toast-title')?.textContent || ''))
                .forEach(t => /** @type {HTMLElement} */ (t).click()));
            return false;
        }, ms);
        return tipsShown();
    };

    /**
     * J0.3: lo que se ve de las fichas de personaje de SillyTavern (el narrador es una): el icono
     * y el panel de personajes, su editor, su lista, la bienvenida con los chats recientes y el
     * logo de SillyTavern pintado como retrato. `#right-nav-panel` no entra: es también el
     * cajón del grupo, que el juego abre; lo que no puede verse son estas piezas de dentro.
     */
    const stCharacterUi = () => page.evaluate(() => ['#rightNavDrawerIcon', '#rm_button_selected_ch', '#HotSwapWrapper',
        '#rm_characters_block', '#rm_ch_create_block', '#avatar_div', '.character_select', '#character_popup',
        '.welcomePanel', '.recentChat', '.gs-vn-portrait img[src*="five.png"]']
        .filter(selector => [...document.querySelectorAll(selector)].some(node => {
            const box = node.getBoundingClientRect();
            return box.width > 1 && box.height > 1 && window.getComputedStyle(node).visibility !== 'hidden';
        })));

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    const firstRun = page.locator('text=Welcome to SillyTavern!');
    if (await firstRun.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#game-shell', { timeout: 90000 });

    // 1. El título ofrece jugar sin conexión.
    const offline = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Jugar sin conexión' });
    const offered = await until(async () => await offline.count() === 1, 30000);
    const order = await page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-menu-btn .gs-menu-label')].map(l => (l.textContent || '').trim()));
    check('el título ofrece «Jugar sin conexión», lo primero', offered && order[0] === 'Jugar sin conexión', JSON.stringify(order));
    if (SHOT) await page.screenshot({ path: SHOT });
    // J0.3 y J0.6: sin partidas, «Cargar partida» lo dice con sus palabras; la bienvenida de
    // SillyTavern (su logo, sus chats, su asistente) no asoma.
    await page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Cargar partida' }).click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(600);
    const emptyLoad = { list: await page.locator('#game-shell .gs-saves').textContent({ timeout: 3000 }).catch(() => ''), st: await stCharacterUi() };
    await page.locator('#game-shell .gs-menu-back').click({ timeout: 5000 }).catch(() => {});
    check('sin partidas, «Cargar partida» lo dice, sin nada de SillyTavern a la vista (J0.3, J0.6)',
        /Todavía no hay ninguna partida/.test(String(emptyLoad.list)) && emptyLoad.st.length === 0, JSON.stringify(emptyLoad));
    // Arte en pixel: en el compendio, cada arma y cada bicho con su icono.
    await page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Compendio' }).click({ timeout: 5000 }).catch(() => {});
    const drawnRows = async (/** @type {string} */ domain) => {
        await page.locator(`.cx-root .cx-tab[data-domain="${domain}"]`).click({ timeout: 8000 }).catch(() => {});
        const count = () => page.evaluate(() => ({
            rows: document.querySelectorAll('.cx-root .cx-row:not(.cx-head)').length,
            drawn: [...document.querySelectorAll('.cx-root .cx-art img')].filter(i => /** @type {HTMLImageElement} */ (i).naturalWidth > 0).length,
        }));
        await until(async () => {
            const now = await count();
            return now.rows > 0 && now.drawn === now.rows;
        }, 8000);
        return count();
    };
    const compendiumArt = { armas: await drawnRows('armas'), bestiario: await drawnRows('bestiario') };
    check('en el compendio, cada arma y cada bicho del bestiario con su icono (arte en pixel)',
        compendiumArt.armas.rows > 0 && compendiumArt.armas.drawn === compendiumArt.armas.rows
        && compendiumArt.bestiario.rows > 0 && compendiumArt.bestiario.drawn === compendiumArt.bestiario.rows, JSON.stringify(compendiumArt));
    if (SHOT) await page.screenshot({ path: `${SHOT}.compendio.png` });
    await page.locator('.popup:has(.cx-root) .popup-button-ok').click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(300);

    // 2. Tu personaje: nombre, especie y clase.
    await offline.click();
    const creator = await page.waitForSelector('.hc-root', { timeout: 120000 }).then(() => true).catch(() => false);
    check('se abre la creación de personaje', creator);
    // J18.2: la pantalla propia, con tarjetas. «Entrar al mundo» espera a nombre y clase.
    const shape = await page.evaluate(() => ({
        cards: [...document.querySelectorAll('.hc-root .hc-card')].map(c => c.getAttribute('data-pick')),
        empty: document.querySelector('.hc-root .hc-card[data-pick="class"] .hc-card-value')?.textContent || '',
        off: /** @type {HTMLButtonElement|null} */ (document.querySelector('.hc-root .hc-enter'))?.disabled ?? null,
        portrait: (document.querySelector('.hc-root .hc-portrait')?.getBoundingClientRect().width || 0),
        sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    check('crear personaje es una pantalla con tres tarjetas y el retrato (J18.2)',
        shape.cards.join(',') === 'class,race,background' && /Elegir clase/.test(shape.empty) && shape.portrait > 0 && shape.portrait <= 380 && !shape.sideways,
        JSON.stringify(shape));
    check('y no deja entrar sin nombre ni clase', shape.off === true);
    const inCreator = await stCharacterUi();
    check('mientras se crea el personaje no asoma la ficha del narrador (J0.3)', inCreator.length === 0, JSON.stringify(inCreator));
    await page.fill('.hc-root .hc-name', 'Tessa');
    // D-J15: quien es no binario elige cómo le habla el texto, y el comienzo ya le habla así.
    const genderView = () => page.evaluate(() => ({
        asks: Boolean(/** @type {HTMLElement|null} */ (document.querySelector('.hc-root .hc-text-form'))?.offsetParent),
        note: document.querySelector('.hc-root .hc-gender-note')?.textContent || '',
        premise: document.querySelector('.hc-root .hc-premise-text')?.textContent || '',
    }));
    await page.locator('.hc-root .hc-gender[data-value="No binario"]').click();
    const genderAsked = await genderView();
    await page.locator('.hc-root .hc-text-form .hc-gender[data-form="f"]').click();
    const genderTold = await genderView();
    if (SHOT) await page.screenshot({ path: `${SHOT}.genero.png` });
    check('D-J15: con «No binario» pregunta cómo te habla el texto, y en femenino el comienzo dice «cansada»',
        genderAsked.asks && /Elige cómo quieres que te hable el texto/.test(genderAsked.note)
        && genderTold.asks && /en femenino/.test(genderTold.note) && (!genderTold.premise || /cansada/.test(genderTold.premise)),
        JSON.stringify({ genderAsked, genderTold }));
    // J1.4: Tessa se presenta como mujer, y el texto tiene que concordar. Ya no se pregunta la forma.
    await page.locator('.hc-root .hc-gender[data-value="Mujer"]').click();
    const genderWoman = await genderView();
    check('y con «Mujer» la pregunta se va: el texto le habla en femenino', !genderWoman.asks && /en femenino/.test(genderWoman.note), JSON.stringify(genderWoman));
    await pickHeroCard(page, 'race', 'Humano');
    await pickHeroCard(page, 'class', 'Guerrero');
    // Arte en pixel: el icono de la clase en su tarjeta y, sin cara subida, el retrato de relleno.
    const loaded = (/** @type {string} */ selector) => page.evaluate((s) => {
        const image = /** @type {HTMLImageElement|null} */ (document.querySelector(s));
        return image && image.complete && image.naturalWidth > 0 ? String(image.getAttribute('src')) : '';
    }, selector);
    const heroArt = { icon: '', stand: '' };
    await until(async () => {
        heroArt.icon = await loaded('.hc-root .hc-card[data-pick="class"] .hc-card-icon img');
        heroArt.stand = await loaded('.hc-root .hc-face-stand');
        return Boolean(heroArt.icon && heroArt.stand);
    }, 10000);
    check('el creador enseña el icono de la clase y, sin cara, el retrato de relleno de una guerrera (arte en pixel)',
        /clases\/guerrero\.png$/.test(heroArt.icon) && /retratos\/heroes\/(raza-humano-)?guerrero-mujer\.png$/.test(heroArt.stand), JSON.stringify(heroArt));
    const numbers = await page.evaluate(() => ({
        str: document.querySelector('.hc-root .hc-stat[data-stat="strength"] .hc-stat-val')?.textContent || '',
        ac: document.querySelector('.hc-root .hc-total[data-total="ac"] strong')?.textContent || '',
        kit: document.querySelector('.hc-root .hc-kit')?.textContent || '',
    }));
    check('al elegir, salen los números con la clase y la especie sumadas, y el equipo (J1.2, J1.3)',
        Number(numbers.str) > 10 && /1[4-9] CA/.test(numbers.ac) && /Cota de malla/.test(numbers.kit), JSON.stringify(numbers));
    // J1.2: repartir un punto en Fuerza la sube uno, y lo dice.
    await page.locator('.hc-root .hc-stat[data-stat="strength"] [data-step="1"]').click();
    await page.waitForTimeout(200);
    const spread = await page.evaluate(() => ({
        str: document.querySelector('.hc-root .hc-stat[data-stat="strength"] .hc-stat-val')?.textContent || '',
        left: document.querySelector('.hc-root .hc-mode-note')?.textContent || '',
    }));
    check('repartir un punto sube la Fuerza, y quedan dos (J1.2)',
        Number(spread.str) === Number(numbers.str) + 1 && /quedan 2/.test(spread.left), JSON.stringify(spread));
    const premise = await page.locator('.hc-root .hc-premise-text').textContent().catch(() => '');
    check('la creación cuenta cómo empieza: la llegada al muelle de Puerto Alba (J2.1)', /muelle de Puerto Alba/i.test(String(premise)), String(premise).slice(0, 160));
    if (SHOT) await page.screenshot({ path: `${SHOT}.personaje.png` });
    await page.locator('.hc-root .hc-enter').click();

    const inHub = await until(async () => {
        const now = await state();
        return /Gremio/.test(now.world) && now.party.length === 1 && now.party[0].name === 'Tessa';
    }, 60000);
    let now = await state();
    check('empieza en el gremio, con Tessa y 100 de oro, en el muelle de Puerto Alba (J2.1)', inHub && now.party[0]?.gold === 100 && now.board === 'El muelle de Puerto Alba', JSON.stringify(now));
    const prologue = await until(() => chatHas(/Al ladrón/), 20000);
    check('el prólogo se cuenta en el chat: la llegada y el ratero (J2.1)', prologue);
    await page.waitForTimeout(800);
    /** J1.4: con «Mujer», el texto en femenino, y ni una marca {…|…} ni un «o/a» a la vista. */
    const genderText = () => page.evaluate(() => [
        ...(window.SillyTavern.getContext().chat || []).map((/** @type {any} */ m) => String(m.extra?.display_text || m.mes || '')),
        document.querySelector('#game-shell .gs-focus')?.textContent || '',
    ].join('\n'));
    const genderOk = (/** @type {string} */ said, /** @type {RegExp} */ good, /** @type {RegExp} */ bad) =>
        good.test(said) && !bad.test(said) && !/\{[^{}\n]*\|[^{}\n]*\}|[a-záéíóúñ]os?\/as?\b/i.test(said);
    const arrival = await genderText();
    check('el texto concuerda con Tessa: «cansada del viaje», sin marcas ni «o/a» (J1.4)', genderOk(arrival, /cansada del viaje/, /cansado del viaje/),
        (arrival.match(/.{0,60}(\{[^{}\n]*\||cansad[oa] del viaje|o\/a).{0,40}/i) ?? [''])[0]);
    const hubChips = await chips();
    check('las fichas ofrecen el tablón de campañas y contratar', hubChips.some(c => /Tablón de campañas/.test(c)) && hubChips.some(c => /Contratar mercenarios/.test(c)), JSON.stringify(hubChips));
    // Al crear, los avisos son cortos: el equipo y los números ya se vieron en la creación.
    const heroToasts = await page.evaluate(() => /** @type {string[]} */ (/** @type {any} */ (window).__heroToasts || []));
    check('al crear, «Tu personaje» es un aviso corto, sin repetir el equipo',
        heroToasts.length >= 1 && heroToasts[0].startsWith('Tessa · ') && heroToasts.every(t => t.length <= 120 && !/Llevas:/.test(t)), JSON.stringify(heroToasts));
    /**
     * J18.7 a J18.9: lo que no puede verse sin conexión: la caja de escribir (con su menú y su
     * varita), las pestañas de escena, la X, los botones de descanso de la cabecera y «Al narrador».
     */
    const offlineChrome = () => page.evaluate(() => {
        const seen = (/** @type {string} */ s) => [...document.querySelectorAll(s)].some(n => {
            const box = n.getBoundingClientRect();
            return box.width > 1 && box.height > 1 && window.getComputedStyle(n).visibility !== 'hidden';
        });
        return {
            box: seen('#send_form') || seen('#send_textarea') || seen('#extensionsMenuButton'),
            tabs: seen('#game-shell .gs-scene-btn'),
            close: seen('#game-shell .gs-close'),
            rest: seen('#game-shell .gs-clock-btn'),
            narrator: seen('#game-shell .gs-chip-narrator'),
            pause: seen('#game-shell .gs-pause-open'),
            clock: (document.querySelector('#game-shell .gs-clock-label')?.textContent || '').trim(),
        };
    });
    const offlineOk = (/** @type {any} */ c) => !c.box && !c.tabs && !c.close && !c.rest && !c.narrator && c.pause;
    /** La escena que se ve. */
    const sceneNow = () => page.evaluate(() => document.querySelector('#game-shell')?.getAttribute('data-scene') || '');
    /** J18.8: «Continuar», al acabar de leer, si se está leyendo; y esperar a la escena que toca. */
    const carryOn = async (/** @type {string} */ wanted) => {
        await until(async () => {
            if (await sceneNow() === wanted) return true;
            await page.evaluate(() => /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .gs-vn-box .gs-chip-continue'))?.click());
            return false;
        }, 10000);
        return sceneNow();
    };
    /** J18.10: las líneas de la caja de la novela, como se leen. */
    const boxLines = () => page.evaluate(() => ({
        lines: [...document.querySelectorAll('#game-shell .gs-vn-text .gs-vn-line')].map(l => (l.textContent || '').replace(/\s+/g, ' ').trim()),
        quotes: [...document.querySelectorAll('#game-shell .gs-vn-text q')].map(q => window.getComputedStyle(q, '::before').content).filter(c => c !== 'none' && c !== 'normal'),
    }));
    /** Lo que se lee en la caja de la novela visual, y lo que toca ahora. */
    const novelBox = () => page.evaluate(() => ({
        text: (document.querySelector('#game-shell .gs-vn-text')?.textContent || '').replace(/\s+/g, ' ').trim(),
        focus: (document.querySelector('#game-shell .gs-focus')?.textContent || '').replace(/\s+/g, ' ').trim(),
    }));
    const dropToasts = () => page.evaluate(() => document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));

    // 2b. J2.1: el prólogo. Se llega al muelle y un ratero le quita la bolsa a Tomás: la primera
    // pelea, pequeña y con un solo enemigo, enseña a andar y a atacar (J2.2).
    const canPier = await until(async () => (await chips()).some(c => /^Iniciar combate \(Ratero del muelle\)/.test(c)), 15000);
    check('en el muelle, la fila ofrece pelear con el ratero, y saltar la prueba para quien ya sabe jugar (J2.1, J2.3)',
        canPier && (await chips()).some(c => /^Saltar la prueba$/.test(c)), JSON.stringify(await chips()));
    const pierBox = await novelBox();
    check('la llegada se lee en la caja de la novela visual, con lo que toca ahora (J2.1)',
        /Al ladrón/.test(pierBox.text) && /ratero/i.test(pierBox.focus), JSON.stringify(pierBox));
    const pierChrome = await offlineChrome();
    check('sin conexión no hay caja de escribir, ni pestañas de escena, ni la X, ni descansos en la cabecera, ni «Al narrador»; sí la pausa y el día (J18.7 a J18.9)',
        offlineOk(pierChrome) && /^Día 1/.test(pierChrome.clock), JSON.stringify(pierChrome));
    // J18.8: las teclas 1, 2 y 3 ya no saltan de escena.
    await page.evaluate(() => /** @type {HTMLElement|null} */ (document.activeElement)?.blur());
    const beforeKeys = await sceneNow();
    for (const key of ['2', '3', '1']) await page.keyboard.press(key);
    await page.waitForTimeout(300);
    check('las teclas 1, 2 y 3 no cambian de escena sin conexión (J18.8)', beforeKeys === 'dialogue' && await sceneNow() === 'dialogue', beforeKeys);
    if (SHOT) await page.screenshot({ path: `${SHOT}.muelle.png` });
    if (canPier) {
        await clickChip(/^Iniciar combate \(Ratero/);
        await until(async () => (await state()).fighting, 10000);
        await clearDice();
        // Las casillas del muelle: hierba y peñascos de exterior, y el agua del puerto.
        const pierTiles = await page.evaluate(() => ({
            floor: document.querySelector('.wm-terrain-layer.wm-terrain-tiled-floor')?.getAttribute('data-biome') || '',
            walls: document.querySelectorAll('.wm-terrain-wall.wm-terrain-tiled').length,
            water: document.querySelectorAll('.wm-terrain-water.wm-terrain-tiled').length,
        }));
        check('el muelle se pinta de exterior, con el agua del puerto (arte en pixel)', pierTiles.floor === 'exterior' && pierTiles.walls > 0 && pierTiles.water > 0,
            JSON.stringify(pierTiles));
        // J2.2: la primera pelea enseña, un consejo cada vez: el de pelear y, en tu turno, el de andar.
        const fightTips = await tipsUntil(/^Te toca/);
        check('la primera pelea trae su consejo y, en tu turno, el de andar (J2.2)',
            fightTips.filter(t => /^Empieza la pelea/.test(t)).length === 1 && fightTips.filter(t => /^Te toca/.test(t)).length === 1, JSON.stringify(fightTips));
        if (SHOT) await page.screenshot({ path: `${SHOT}.muelle-pelea.png` });
        // El panel del combate, en tu turno: en castellano y sin comandos. Y sin caja de escribir:
        // la pelea se juega con la barra de abajo (J18.7).
        const inFight = await page.evaluate(() => ({
            panel: (document.querySelector('.wm-combat-section')?.textContent || '').replace(/\s+/g, ' ').trim(),
            scene: document.querySelector('#game-shell')?.getAttribute('data-scene') || '',
            bar: [...document.querySelectorAll('#game-shell .gs-actions .gs-btn')].map(b => (b.textContent || '').trim()),
        }));
        const fightChrome = await offlineChrome();
        check('en la pelea, el panel dice «En combate», «Enemigos» y «Te toca», sin inglés; se juega con la barra, sin caja de escribir (J18.7)',
            /En combate/.test(inFight.panel) && /Enemigos/.test(inFight.panel) && /Te toca/.test(inFight.panel) && /Fin de turno/.test(inFight.panel)
            && !/Combat Active|Your turn|Enemies|Action used|End Turn|Movement left/.test(inFight.panel)
            && inFight.scene === 'combat' && inFight.bar.some(b => /Atacar/.test(b)) && offlineOk(fightChrome), JSON.stringify({ inFight, fightChrome }));
        await page.evaluate(async () => {
            const enc = (await import('/scripts/party.js')).getCombatEncounter();
            for (const e of enc?.enemies ?? []) e.currentHp = 0;
        });
        for (let i = 0; i < 8 && (await state()).fighting; i++) {
            await page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/combat-end'));
            await page.waitForTimeout(700);
            await clearDice();
        }
    }
    const thanked = await until(() => chatHas(/Soy Tomás/), 15000);
    check('ganar en el muelle sigue la historia: Tomás da las gracias (J2.1)', thanked && !(await state()).fighting);
    // J2.2: al moverse el hilo, el del Diario. Lo que queda por enseñar no se mete en medio.
    const journalTips = await tipsUntil(/Diario/);
    check('y al moverse el hilo, el consejo del Diario (J2.2)', journalTips.filter(t => /^Queda apuntado en el Diario/.test(t)).length === 1, JSON.stringify(journalTips));

    // J2.1: la charla con Tomás, en la ventana de hablar: sus temas y lo que se cuenta en el puerto.
    /** Pulsar «Hablar con…» en la fila y esperar su ventana. */
    const talkWith = async (/** @type {string} */ name) => {
        await dropToasts();
        const offered = await until(async () => (await chips()).some(c => c === `Hablar con ${name}`), 10000);
        await clickChip(new RegExp(`^Hablar con ${name}$`));
        const opened = await page.waitForSelector('.popup:visible .tk-root', { timeout: 10000 }).then(() => true).catch(() => false);
        return offered && opened;
    };
    const endTalk = async () => {
        await dropToasts();
        await page.locator('.popup:visible:has(.tk-root) .popup-button-ok').first().click({ timeout: 5000 }).catch(() => {});
        await page.waitForSelector('.tk-root', { state: 'detached', timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(500);
    };
    const withTomas = await talkWith('Tomás');
    const talkTips = await tipsUntil(/^Pulsa un tema/, 10000);
    await page.locator('.popup:visible .tk-root .tk-topic[data-topic="rumor"]').first().click({ timeout: 5000 }).catch(() => {});
    const heard = await until(async () => /Barovia/.test(String(await page.locator('.popup:visible .tk-root .tk-log').textContent({ timeout: 1000 }).catch(() => ''))), 8000);
    const talkWindow = await page.evaluate(() => ({
        title: (document.querySelector('.tk-root .gs-popup-title')?.textContent || '').trim(),
        topics: [...document.querySelectorAll('.tk-root .tk-topic')].map(t => t.getAttribute('data-topic')),
        log: (document.querySelector('.tk-root .tk-log')?.textContent || '').trim().slice(0, 160),
    }));
    check('«Hablar con Tomás» abre la charla: sus temas, lo que se cuenta en el puerto y el consejo de hablar (J2.1, J2.2)',
        withTomas && heard && talkWindow.title === 'Tomás' && talkWindow.topics.includes('rumor') && talkTips.filter(t => /^Pulsa un tema/.test(t)).length === 1,
        JSON.stringify({ talkWindow, talkTips }));
    if (SHOT) await page.screenshot({ path: `${SHOT}.charla.png` });
    await endTalk();
    const guildTold = await until(() => chatHas(/Brunilda, la maestra del gremio/), 10000);
    check('mientras se habla llega Brunilda, que lleva al gremio y dice para qué sirve (J2.1)', guildTold && await chatHas(/se reparten las campañas/));

    // Brunilda: hablar con ella trae la prueba de la bodega.
    const withBrunilda = await talkWith('Brunilda');
    await endTalk();
    const cellarAsked = await until(() => chatHas(/Baja a la bodega/), 10000);
    await page.waitForTimeout(800);
    const trialText = await genderText();
    check('hablar con Brunilda trae la prueba: «Baja a la bodega», y «si subes entera», sin marcas (J2.1, J1.4)',
        withBrunilda && cellarAsked && genderOk(trialText, /subes entera/, /subes entero/),
        (trialText.match(/.{0,60}(\{[^{}\n]*\||subes enter[oa]|o\/a).{0,40}/i) ?? [''])[0]);
    const trialBox = await novelBox();
    check('la prueba se lee en la caja, y lo que toca dice cómo llegar a la bodega (J2.1)',
        /Baja a la bodega/.test(trialBox.text) && /bodega/i.test(trialBox.focus), JSON.stringify(trialBox));
    // J18.10: en la caja, solo la prosa: ni «[HILO] Hecho: …», ni «[RUMOR]», ni comillas dobles “«…»”.
    const prose = await boxLines();
    check('en la caja no hay etiquetas del motor: ninguna línea empieza por «[», ni «Hecho:», ni comillas dobles (J18.10)',
        prose.lines.length > 0 && prose.lines.every(l => !/^\S{0,3}\s*\[/.test(l) && !/^Hecho:/.test(l) && !/“«|»”/.test(l)) && prose.quotes.length === 0,
        JSON.stringify(prose));
    if (SHOT) await page.screenshot({ path: `${SHOT}.prologo.png` });
    // Del muelle a la bodega, por la fila: la que pide la historia va delante.
    await page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/leave'));
    await page.waitForTimeout(700);
    const toCellar = await until(async () => (await chips()).some(c => /^Entrar en La bodega del gremio$/.test(c)), 10000);
    check('fuera del muelle, la fila lleva a la bodega, que es lo que pide la historia (J2.1)', toCellar, JSON.stringify(await chips()));
    await clickChip(/^Entrar en La bodega del gremio$/);
    await until(async () => (await state()).board === 'La bodega del gremio', 10000);

    // 3. La prueba: las ratas de la bodega. La pelea se empieza desde la fila de fichas: en
    // la escena de diálogo el botón del tablero no se ve.
    const canFight = await until(async () => (await chips()).some(c => /^Iniciar combate \(Rata de bodega x2\)/.test(c)), 15000);
    check('en la bodega, la fila ofrece pelear con las dos ratas', canFight, JSON.stringify(await chips()));
    check('y también saltar la prueba, para quien ya sabe jugar (J2.3)', (await chips()).some(c => /^Saltar la prueba$/.test(c)), JSON.stringify(await chips()));
    if (canFight) {
        await clickChip(/^Iniciar combate/);
        await until(async () => (await state()).fighting, 10000);
        // Los dados, en castellano: mientras rueda y cuando se pueden pasar.
        const diceText = () => page.evaluate(() => ({
            button: (document.querySelector('.wm-dice-overlay.active .wm-dice-next')?.textContent || '').trim(),
            card: (document.querySelector('.wm-dice-overlay.active .wm-dice-card')?.textContent || '').replace(/\s+/g, ' ').trim(),
        }));
        await page.waitForSelector('.wm-dice-overlay.active', { timeout: 5000 }).catch(() => {});
        const rolling = await diceText();
        await page.waitForTimeout(1000);
        const rolled = await diceText();
        check('los dados hablan en castellano: «Tirando…» y luego «Siguiente» o «Cerrar», sin Next ni Close',
            /^(Tirando…|Siguiente|Cerrar)$/.test(rolling.button) && /^(Siguiente|Cerrar)$/.test(rolled.button) && /Fórmula/.test(rolled.card)
            && ![rolling, rolled].some(d => /\b(Next|Close|Rolling|Formula|init|dmg)\b/.test(`${d.button} ${d.card}`)), JSON.stringify({ rolling, rolled }));
        await clearDice();
        // Arte en pixel: en el tablero, las ratas con su dibujo y Tessa, sin cara propia, con su retrato de relleno.
        const drawnTokens = () => page.evaluate(() => [...document.querySelectorAll('.wm-token img.wm-token-avatar[data-pixel]')]
            .map(i => (i.getAttribute('src') || '').split('/').slice(-2).join('/')));
        const ratsDrawn = await until(async () => (await drawnTokens()).filter(s => s === 'bestias/rata-de-bodega.png').length === 2, 10000);
        const tokenArt = await drawnTokens();
        // Y las casillas: el suelo de piedra de la bodega debajo, y los muros con su dibujo.
        const tiles = await page.evaluate(() => ({
            floor: document.querySelector('.wm-terrain-layer.wm-terrain-tiled-floor')?.getAttribute('data-biome') || '',
            walls: document.querySelectorAll('.wm-terrain-wall.wm-terrain-tiled').length,
        }));
        check('en el tablero, las dos ratas salen con su dibujo, Tessa con su retrato de relleno y las casillas en pixel (arte en pixel)',
            ratsDrawn && tokenArt.some(s => /^heroes\/(raza-humano-)?guerrero-mujer\.png$/.test(s)) && tiles.floor === 'mazmorra' && tiles.walls > 0,
            JSON.stringify({ tokenArt, tiles }));
        if (SHOT) await page.screenshot({ path: `${SHOT}.pelea.png` });
        // Los consejos de la primera pelea y el panel en castellano se miran en el muelle (J2.1): aquí ya no salen.
        await page.evaluate(async () => {
            const enc = (await import('/scripts/party.js')).getCombatEncounter();
            for (const e of enc?.enemies ?? []) e.currentHp = 0;
        });
        for (let i = 0; i < 8 && (await state()).fighting; i++) {
            await page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/combat-end'));
            await page.waitForTimeout(700);
            await clearDice();
        }
    }
    now = await state();
    const tablon = await until(() => chatHas(/apunta tu nombre en el libro del gremio/), 15000);
    check('ganar la prueba abre el hilo siguiente: el tablón', !now.fighting && tablon, JSON.stringify({ fighting: now.fighting }));
    // J18.8: acabada la pelea se vuelve a la novela, a leer el final; «Continuar» lleva al tablero
    // (seguís en la bodega), y de él se sale con su botón, al pueblo. Sin tocar ninguna pestaña.
    const afterFight = { scene: await sceneNow(), chrome: await offlineChrome(),
        next: await page.evaluate(() => document.querySelector('#game-shell .gs-vn-box .gs-chip-continue')?.getAttribute('data-next') || '') };
    check('acabada la pelea, se lee el final en la novela, sin caja de escribir, y «Continuar» lleva al tablero (J18.7, J18.8)',
        afterFight.scene === 'dialogue' && offlineOk(afterFight.chrome) && afterFight.next === 'combat', JSON.stringify(afterFight));
    const onBoard = await carryOn('combat');
    const boardFoot = await page.evaluate(() => ({
        chips: [...document.querySelectorAll('#game-shell .gs-actions .gs-chip-action')].map(c => (c.textContent || '').trim()),
        leave: (document.querySelector('#game-shell .gs-scene-map .wm-leave-loc-btn')?.textContent || '').trim(),
    }));
    check('«Continuar» lleva al tablero, sin pelea: lo que se puede hacer va al pie, y el tablero tiene su botón para salir (J18.8)',
        onBoard === 'combat' && boardFoot.chips.length > 0 && /Volver a Puerto Alba/.test(boardFoot.leave), JSON.stringify({ onBoard, boardFoot }));
    if (SHOT) await page.screenshot({ path: `${SHOT}.tablero.png` });
    await page.evaluate(() => {
        const seen = window.localStorage.getItem('sillytavern_gameTipsSeen') || '';
        window.localStorage.setItem('sillytavern_gameTipsSeen', `${seen},combat,move,attack,roll,talk,journal`);
        document.querySelectorAll('#toast-container .toast').forEach(t => t.remove());
    });

    // 4. Un mercenario. Se sale de la bodega con el botón del tablero, y se lee si hay algo que leer.
    await clearDice();
    await page.locator('#game-shell .gs-scene-map .wm-leave-loc-btn').first().click({ timeout: 5000 })
        .catch(() => page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/leave')));
    await page.waitForTimeout(600);
    await carryOn('exploration');

    // J3.11: fuera del tablero, la pantalla es el pueblo. Con el selector de sitios: la herrería,
    // con Ramiro; volver; la taberna, con Tomás, y comer ahí. Luego, de vuelta a la novela.
    const townShown = await until(() => page.evaluate(() => document.querySelector('#game-shell')?.getAttribute('data-scene') === 'exploration'
        && document.querySelectorAll('#game-shell .gs-town-place').length > 0), 10000);
    const townPlaces = await page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-town-place')].map(c => c.getAttribute('data-place')));
    // El gremio va primero desde el 2026-09-29: es a lo que se viene.
    check('fuera del tablero, la pantalla es el pueblo: el gremio, la herrería, la taberna, la tienda y la capilla (J3.11)',
        townShown && JSON.stringify(townPlaces) === JSON.stringify(['gremio', 'herreria', 'posada', 'tienda', 'templo']), JSON.stringify(townPlaces));
    if (SHOT) await page.screenshot({ path: `${SHOT}.pueblo.png` });
    /** Lo que se ve dentro de un sitio del pueblo. */
    const placeScene = () => page.evaluate(() => {
        const scene = document.querySelector('#game-shell .gs-town-scene');
        const face = /** @type {HTMLImageElement|null} */ (scene?.querySelector('.gs-town-portrait img'));
        return {
            place: scene?.getAttribute('data-place') || '',
            plate: (scene?.querySelector('.gs-town-plate')?.textContent || '').trim(),
            face: face && face.complete && face.naturalWidth > 0 ? String(face.getAttribute('src')) : '',
            line: (scene?.querySelector('.gs-town-line')?.textContent || '').trim(),
            acts: [...(scene?.querySelectorAll('.gs-town-act') ?? [])].map(b => (b.textContent || '').replace(/\s+/g, ' ').trim()),
        };
    });
    await page.locator('#game-shell .gs-town-place[data-place="herreria"]').click({ timeout: 5000 }).catch(() => {});
    let inPlace = await placeScene();
    await until(async () => /ramiro\.png$/.test((inPlace = await placeScene()).face), 8000);
    check('en la herrería, Ramiro con su retrato, su saludo y lo que se hace allí (J3.11)',
        inPlace.place === 'herreria' && inPlace.plate === 'Ramiro' && /retratos\/gremio\/ramiro\.png$/.test(inPlace.face) && /^Ramiro .*«Buen/.test(inPlace.line)
        && inPlace.acts.some(a => /Hablar con Ramiro/.test(a)) && inPlace.acts.some(a => /capa/i.test(a)), JSON.stringify(inPlace));
    if (SHOT) await page.screenshot({ path: `${SHOT}.herreria.png` });
    await page.locator('#game-shell .gs-town-back').click({ timeout: 5000 }).catch(() => {});
    const backInTown = await until(() => page.evaluate(() => !document.querySelector('#game-shell .gs-town-scene')
        && document.querySelectorAll('#game-shell .gs-town-place').length > 0), 5000);
    await page.locator('#game-shell .gs-town-place[data-place="posada"]').click({ timeout: 5000 }).catch(() => {});
    await until(async () => /tomas\.png$/.test((inPlace = await placeScene()).face), 8000);
    const goldBeforeMeal = (await state()).party[0]?.gold ?? 0;
    await page.locator('#game-shell .gs-town-scene .gs-town-act[data-action="inn-meal"]').click({ timeout: 5000 }).catch(() => {});
    const ate = await until(async () => ((await state()).party[0]?.gold ?? 0) === goldBeforeMeal - 1, 8000);
    const afterMeal = await placeScene();
    check('volver al pueblo y entrar en la taberna: Tomás, y comer caliente por 1 de oro sin salir de ella (J3.11)',
        backInTown && inPlace.place === 'posada' && inPlace.plate === 'Tomás' && /retratos\/gremio\/tomas\.png$/.test(inPlace.face)
        && inPlace.acts.some(a => /Hablar con Tomás/.test(a)) && ate && afterMeal.place === 'posada', JSON.stringify({ inPlace, goldBeforeMeal, ate }));
    if (SHOT) await page.screenshot({ path: `${SHOT}.posada.png` });
    // J18.9: en la taberna se pasa el rato y se duerme; en la cabecera, solo el día.
    const clockNow = async () => (await offlineChrome()).clock;
    const dayBefore = await clockNow();
    await page.locator('#game-shell .gs-town-scene .gs-town-act[data-action="clock:slot"]').click({ timeout: 5000 }).catch(() => {});
    const idled = await until(async () => (await clockNow()) !== dayBefore, 8000);
    const dayIdle = await clockNow();
    await page.locator('#game-shell .gs-town-scene .gs-town-act[data-action="inn-room"]').click({ timeout: 5000 }).catch(() => {});
    const slept = await until(async () => /^Día 2/.test(await clockNow()), 10000);
    await page.evaluate(() => document.querySelectorAll('.popup:not([closing]) .popup-button-ok').forEach(b => /** @type {HTMLElement} */ (b).click()));
    await carryOn('exploration');
    const afterSleep = { clock: await clockNow(), place: (await placeScene()).place, acts: (await placeScene()).acts, chrome: await offlineChrome() };
    check('en la taberna, «Pasar el rato» pasa una parte del día y «Dormir en una habitación» pasa la noche; la cabecera no tiene botones de descanso (J18.9)',
        /^Día 1/.test(dayBefore) && idled && dayIdle !== dayBefore && slept && afterSleep.place === 'posada'
        && inPlace.acts.some(a => /Pasar el rato/.test(a)) && inPlace.acts.some(a => /Dormir en una habitación/.test(a)) && !afterSleep.chrome.rest,
        JSON.stringify({ dayBefore, dayIdle, afterSleep, acts: inPlace.acts }));
    await page.locator('#game-shell .gs-town-back').click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(400);

    check('fuera del tablón también se ofrece contratar', await clickChip(/Contratar mercenarios/));
    const hire = await page.waitForSelector('.hb-root [data-hireling]', { timeout: 15000 }).then(() => true).catch(() => false);
    const offers = await page.evaluate(() => [...document.querySelectorAll('.hb-root [data-hireling]')].map(c => c.getAttribute('aria-label')));
    check('se ofrecen los tres mercenarios del gremio con su precio', hire && offers.length === 3 && offers.every(o => /40 de oro/.test(String(o))), JSON.stringify(offers));
    const hireArt = await page.evaluate(() => [...document.querySelectorAll('.hb-root [data-hireling] img.hb-pixel')].map(i => (i.getAttribute('src') || '').split('/').pop()));
    check('y cada uno con su retrato (arte en pixel)', hireArt.length === 3 && hireArt.includes('gerd-el-mellado.png'), JSON.stringify(hireArt));
    if (SHOT) await page.screenshot({ path: `${SHOT}.mercenarios.png` });
    const purse = (await state()).party.reduce((sum, m) => sum + m.gold, 0);
    await page.locator('.hb-root [data-hireling="Gerd el Mellado"]').click();
    await until(async () => (await state()).party.length === 2, 10000);
    now = await state();
    const gerd = now.party.find(m => m.name === 'Gerd el Mellado');
    check('Gerd se une por 40 de oro, y él no trae oro', Boolean(gerd?.guest) && now.party[0].gold === purse - 40 && gerd?.gold === 0, JSON.stringify({ purse, party: now.party }));
    const gold = now.party[0].gold;
    const hubWorld = now.world;
    const hubChat = now.chat;

    // 5. El tablón: Strahd.
    await page.waitForTimeout(500);
    // J18.8: contratar no cuenta nada nuevo que leer: se sigue en el pueblo, con lo que se puede
    // hacer al pie (y sin la fila de entrar en tableros ni de viajar, que tienen sus tarjetas).
    const stayed = await page.evaluate(() => ({
        scene: document.querySelector('#game-shell')?.getAttribute('data-scene') || '',
        foot: [...document.querySelectorAll('#game-shell .gs-actions .gs-chips-foot .gs-chip-action')].map(c => (c.textContent || '').trim()),
    }));
    check('contratar deja en el pueblo, con lo que se puede hacer al pie: el tablón y contratar, sin «Entrar en…» (J18.8)',
        stayed.scene === 'exploration' && stayed.foot.some(c => /Tablón de campañas/.test(c)) && !stayed.foot.some(c => /^Entrar en /.test(c)), JSON.stringify(stayed));
    if (SHOT) await page.screenshot({ path: `${SHOT}.pueblo-pie.png` });
    // Arte en pixel: si habla alguien del paquete, sale su retrato en grande; y detrás, apagado,
    // el escenario del sitio. La frase de Brunilda se quita después, para no tocar lo que sigue.
    // Y (J18.8) lo nuevo que se cuenta lleva solo a la novela, sin pestañas.
    await page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/sendas name="Brunilda" Aquí se viene a trabajar, no a mirar.'));
    await until(async () => await sceneNow() === 'dialogue', 8000);
    // J18.3: la historia se lee como una novela visual.
    const novel = await page.evaluate(() => ({
        scene: document.querySelector('#game-shell')?.getAttribute('data-scene') || '',
        box: (document.querySelector('#game-shell .gs-vn-box')?.getBoundingClientRect().width || 0),
        text: (document.querySelector('#game-shell .gs-vn-text')?.textContent || '').trim().slice(0, 80),
        chips: document.querySelectorAll('#game-shell .gs-vn-box .gs-chip-action').length,
        next: document.querySelector('#game-shell .gs-vn-box .gs-chip-continue')?.getAttribute('data-next') || '',
        chat: window.getComputedStyle(/** @type {Element} */ (document.querySelector('#chat'))).display,
    }));
    check('lo nuevo que se cuenta lleva a la novela: la caja, con las fichas dentro y «Continuar» al pueblo (J18.3, J18.8)',
        novel.scene === 'dialogue' && novel.box > 600 && novel.text.length > 0 && novel.chips > 0 && novel.next === 'exploration' && novel.chat === 'none',
        JSON.stringify(novel));
    if (SHOT) await page.screenshot({ path: `${SHOT}.novela.png` });
    const novelArt = () => page.evaluate(async () => {
        (await import('/scripts/game-engine/ui/shell/game-shell.js')).refreshGameShell();
        const image = /** @type {HTMLImageElement|null} */ (document.querySelector('#game-shell .gs-vn-portrait:not([hidden]) img.gs-vn-pixel'));
        const back = document.querySelector('#game-shell .gs-vn-backdrop');
        const drawn = back instanceof HTMLElement && !back.hidden ? (/url\("([^"]+)"\)/.exec(window.getComputedStyle(back).backgroundImage) ?? [])[1] ?? '' : '';
        // El fondo tiene que cargar de verdad: una ruta mal resuelta no falla, se queda en negro.
        const loads = drawn ? await new Promise(done => {
            const probe = new window.Image();
            probe.onload = () => done(true);
            probe.onerror = () => done(false);
            probe.src = drawn;
        }) : false;
        return {
            portrait: image && image.complete && image.naturalWidth > 0 ? String(image.getAttribute('src')) : '',
            backdrop: loads ? drawn : '',
        };
    });
    let brunilda = await novelArt();
    await until(async () => /retratos\/gremio\/brunilda\.png$/.test((brunilda = await novelArt()).portrait) && /puerto-alba/.test(brunilda.backdrop), 10000);
    check('Brunilda sale con su retrato, y detrás, Puerto Alba (arte en pixel)',
        /retratos\/gremio\/brunilda\.png$/.test(brunilda.portrait) && /puerto-alba/.test(brunilda.backdrop), JSON.stringify(brunilda));
    if (SHOT) await page.screenshot({ path: `${SHOT}.brunilda.png` });
    await page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/cut {{lastMessageId}}'));
    await page.waitForTimeout(400);
    const inHubScene = await stCharacterUi();
    // Y en el registro, el chat entero, las frases van sin la cara de la ficha del narrador, y
    // sin las etiquetas del motor (J18.10).
    const openLog = () => page.evaluate(() => /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .gs-vn-log-btn'))?.click());
    await openLog();
    await page.waitForTimeout(400);
    const inLog = await page.evaluate(() => {
        const shown = [...document.querySelectorAll('#game-shell #chat .mes')].filter(m => m.getBoundingClientRect().height > 1);
        return {
            lines: shown.length,
            faces: [...document.querySelectorAll('#game-shell #chat .mes:not([is_user="true"]) .avatar img')].filter(i => i.getBoundingClientRect().width > 1).length,
            tagged: shown.map(m => (/** @type {HTMLElement|null} */ (m.querySelector('.mes_text'))?.innerText || '').trim())
                .filter(t => /^\S{0,3}\s*\[[A-ZÁÉÍÓÚÑ ]{2,}\]/u.test(t)).slice(0, 3),
        };
    });
    if (SHOT) await page.screenshot({ path: `${SHOT}.registro.png` });
    await openLog();
    check('en el gremio no se ve ninguna ficha de SillyTavern, ni su logo como retrato, ni caras ni etiquetas en el registro (J0.3, J18.10)',
        inHubScene.length === 0 && inLog.lines > 0 && inLog.faces === 0 && inLog.tagged.length === 0, JSON.stringify({ inHubScene, inLog }));

    // J0.4: las opciones son del juego, con sus palabras; sin conexión, sin panel de la API.
    await page.evaluate(() => /** @type {HTMLElement|null} */ (document.activeElement)?.blur());
    await page.keyboard.press('Escape');
    await page.waitForSelector('#game-shell .gs-pause', { timeout: 5000 }).catch(() => {});
    // J0.3: en pausa vuelve la barra de SillyTavern, y el panel del grupo; sus personajes, no.
    const inPause = await stCharacterUi();
    check('en pausa vuelve la barra de SillyTavern, pero no la ficha del narrador ni la lista de personajes (J0.3)', inPause.length === 0, JSON.stringify(inPause));
    // D-J24: ni su cajón de la derecha (Party, World Map, Location, Campaña), que salía vacío.
    const rightPanel = await page.evaluate(() => {
        const panel = document.querySelector('#right-nav-panel');
        const box = panel?.getBoundingClientRect();
        return Boolean(panel && box && box.width > 1 && box.height > 1 && window.getComputedStyle(panel).visibility !== 'hidden');
    });
    if (SHOT) await page.screenshot({ path: `${SHOT}.pausa.png` });
    check('en pausa no sale el cajón vacío de la derecha (D-J24)', !rightPanel);
    await page.locator('#game-shell .gs-pause-btn').filter({ hasText: 'Opciones' }).first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForSelector('.go-root', { timeout: 8000 }).catch(() => {});
    const optionRows = () => page.evaluate(() => [...document.querySelectorAll('.go-root .go-row')]
        .map(r => `${r.getAttribute('data-option')}=${(r.querySelector('.go-value')?.textContent || '').trim()}`));
    const before = await optionRows();
    await page.locator('.go-root .go-row[data-option="size"]').click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(300);
    const bigger = await page.evaluate(() => ({
        scale: window.getComputedStyle(document.documentElement).getPropertyValue('--gs-text-scale').trim(),
        row: (document.querySelector('.go-root .go-row[data-option="size"] .go-value')?.textContent || '').trim(),
    }));
    // Y se deja como estaba, para lo que sigue.
    for (let i = 0; i < 2; i++) await page.locator('.go-root .go-row[data-option="size"]').click({ timeout: 4000 }).catch(() => {});
    const optionsSeen = {
        rows: before, bigger,
        advanced: await page.locator('.go-root .go-advanced').count(),
        apiOpen: await page.evaluate(() => document.querySelector('#rm_api_block')?.closest('.drawer-content')?.classList.contains('openDrawer') ?? false),
    };
    await page.locator('.popup:has(.go-root) .popup-button-ok').click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(300);
    if (await page.locator('#game-shell .gs-pause').count() > 0) await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const wanted = ['narrator', 'sucesos', 'size', 'speed', 'colorblind', 'audio', 'autostart'];
    check('la pausa abre las opciones del juego: texto, colores, sonido y quién cuenta, sin el panel de la API (J0.4)',
        wanted.every(id => before.some(r => r.startsWith(`${id}=`))) && bigger.scale === '1.15' && bigger.row === 'Grande'
        && optionsSeen.advanced === 0 && !optionsSeen.apiOpen && await page.locator('.go-root').count() === 0,
        JSON.stringify(optionsSeen));
    check('la ficha del tablón de campañas está', await clickChip(/Tablón de campañas/));
    await page.waitForSelector('.hb-root [data-campaign]', { timeout: 15000 }).catch(() => {});
    const board = await page.evaluate(() => [...document.querySelectorAll('.hb-root [data-campaign]')].map(c => ({ id: c.getAttribute('data-campaign'), text: (c.textContent || '').replace(/\s+/g, ' ').slice(0, 120) })));
    check('en el tablón están 1387 y La Maldición de Strahd, sin empezar', board.some(c => c.id === '1387') && board.some(c => c.id === 'strahd' && /Sin empezar/.test(c.text)), JSON.stringify(board));
    check('el tablón dice lo lejos que queda cada campaña (J4.9)', board.some(c => c.id === 'strahd' && /A nueve días de camino/.test(c.text)), JSON.stringify(board));
    if (SHOT) await page.screenshot({ path: `${SHOT}.tablon.png` });
    await page.locator('.hb-root [data-campaign="strahd"]').click();

    const inStrahd = await until(async () => /Strahd/.test((await state()).world), 120000);
    await page.waitForTimeout(1500);
    now = await state();
    const tessa = now.party.find(m => m.name === 'Tessa');
    check('La Maldición de Strahd empieza en la Taberna, con el grupo entero: Tessa con su oro y Gerd',
        inStrahd && now.board === 'Taberna Sangre de la Enredadera' && now.party.length === 2 && tessa?.gold === gold
        && now.party.every(m => m.world === now.world) && tessa?.wiUid !== null,
        JSON.stringify(now));
    const scene = await until(() => chatHas(/Bruja Baroviana está acechando/), 20000);
    check('la primera escena de Strahd se cuenta', scene);
    const inStrahdScene = await stCharacterUi();
    check('y en Strahd, que tiene su propio narrador, tampoco se ve su ficha (J0.3)', inStrahdScene.length === 0, JSON.stringify(inStrahdScene));
    check('antes, el viaje: de Puerto Alba a Strahd, nueve días (J4.9)', await chatHas(/Salís de Puerto Alba hacia La Maldición de Strahd\..*Nueve días de camino/));
    const campaignChips = await chips();
    check('en la campaña se ofrece volver al gremio', campaignChips.some(c => /Volver al gremio/.test(c)), JSON.stringify(campaignChips));
    // J18.7 a J18.10: una campaña del gremio también es sin conexión: se empieza leyendo, sin caja
    // de escribir ni pestañas, y el viaje y el presagio sin «[VIAJE]» ni «[HILO]».
    const strahdOpen = { scene: await sceneNow(), chrome: await offlineChrome(), box: await boxLines() };
    check('Strahd empieza en la novela, sin caja ni pestañas, y su caja sin etiquetas del motor (J18.7, J18.8, J18.10)',
        strahdOpen.scene === 'dialogue' && offlineOk(strahdOpen.chrome) && strahdOpen.box.lines.length > 0
        && strahdOpen.box.lines.every(l => !/^\S{0,3}\s*\[/.test(l)), JSON.stringify(strahdOpen));
    const strahdWorld = now.world;
    const strahdChat = now.chat;

    /** Gana la pelea que haya: todos a cero y turnos hasta que se acaba. */
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
    /** Que nadie del grupo esté sobre un muro del tablero abierto. */
    const partyOnFloor = () => page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const data = await (await import('/scripts/world-info.js')).loadWorldInfo(String(ctx.chatMetadata?.world_info || ''));
        const place = (data?.metadata?.locationMaps ?? []).find((/** @type {any} */ l) => l.name === ctx.chatMetadata?.currentLocation);
        const board = (place?.boards ?? []).find((/** @type {any} */ b) => b.name === ctx.chatMetadata?.currentBoard);
        const { getCell, normalizeTerrain } = await import('/scripts/game-engine/board/terrain.js');
        const party = (await import('/scripts/party.js')).getPartyMembersSnapshot();
        return party.map((/** @type {any} */ m) => {
            const x = Number(m.mapPosition?.gridX) || 0;
            const y = Number(m.mapPosition?.gridY) || 0;
            return { name: m.name, x, y, cell: getCell(normalizeTerrain(board?.terrain), x, y).type };
        });
    });

    // Strahd se juega: la bruja de la Taberna, y ganar abre la Mansión y el Sótano.
    const where = await partyOnFloor();
    check('en la Taberna, cada uno en su casilla de salida, ninguno en un muro', where.every(m => m.cell !== 'wall') && new Set(where.map(m => `${m.x},${m.y}`)).size === where.length, JSON.stringify(where));
    const bruja = await until(async () => (await chips()).some(c => /^Iniciar combate \(Bruja Baroviana\)$/.test(c)), 15000);
    check('en la Taberna espera la bruja; el zombi de la cocina, no, que está tras la puerta', bruja, JSON.stringify(await chips()));
    if (SHOT) await page.screenshot({ path: `${SHOT}.taberna.png` });
    await clickChip(/^Iniciar combate/);
    await winFight();
    const mansion = await until(() => chatHas(/asedian la mansión del burgomaestre/), 15000);
    check('ganar la Taberna abre el hilo: el asedio de la mansión', mansion);
    await page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/leave'));
    await page.waitForTimeout(800);
    const outside = await chips();
    check('fuera, la fila ofrece entrar en la Mansión y en el Sótano', outside.some(c => /Entrar en Mansión del Burgomaestre/.test(c)) && outside.some(c => /Entrar en Sótano de la Iglesia/.test(c)), JSON.stringify(outside));
    await clickChip(/Entrar en Mansión del Burgomaestre/);
    const zombis = await until(async () => (await chips()).some(c => /^Iniciar combate \(Zombi de Strahd x3\)$/.test(c)), 15000);
    const inside = await partyOnFloor();
    check('en la Mansión, el grupo en el salón y los tres zombis fuera, esperando', zombis && inside.every(m => m.cell !== 'wall'), JSON.stringify({ chips: await chips(), inside }));
    if (SHOT) await page.screenshot({ path: `${SHOT}.mansion.png` });

    // La palanca del Sótano abre la celda y despierta al engendro. Antes la reja se abría y
    // la sala seguía a oscuras, con él dormido para siempre.
    await page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/leave'));
    await page.waitForTimeout(700);
    await clickChip(/Entrar en Sótano de la Iglesia/);
    await page.waitForTimeout(1200);
    const lever = await page.evaluate(async () => {
        const party = await import('/scripts/party.js');
        const wi = await import('/scripts/world-info.js');
        const ctx = window.SillyTavern.getContext();
        const place = wi.getCurrentWorldLocationMaps().find((/** @type {any} */ l) => l.name === ctx.chatMetadata.currentLocation);
        const board = (place?.boards || []).find((/** @type {any} */ b) => b.name === ctx.chatMetadata.currentBoard);
        if (!board) return null;
        const hero = party.getPartyMembersSnapshot()[0];
        const at = { x: (Number(hero?.mapPosition?.gridX) || 0) - 1, y: Number(hero?.mapPosition?.gridY) || 0 };
        board.terrain.cells = board.terrain.cells || {};
        // La palanca del tablero, junto al héroe: así no hay que andar hasta ella.
        for (const [key, cell] of Object.entries(board.terrain.cells)) if (/** @type {any} */ (cell)?.type === 'lever') delete board.terrain.cells[key];
        board.terrain.cells[`${at.x},${at.y}`] = { type: 'lever' };
        party.refreshBoardView();
        return { board: board.name, at, asleep: (board.enemyPlacements || []).map((/** @type {any} */ p) => p.name) };
    });
    await page.waitForTimeout(800);
    // La palanca se pulsa en el tablero. Entrar en él es una acción (la ficha): se lee lo que se
    // cuente al entrar y «Continuar» lleva al tablero (J18.8), sin pestañas.
    const inCellar = await carryOn('combat');
    check('entrar en el Sótano desde la fila lleva a su tablero, tras leer lo que se cuenta al entrar (J18.8)',
        inCellar === 'combat' && (await state()).board === 'Sótano de la Iglesia' && offlineOk(await offlineChrome()), inCellar);
    await page.waitForTimeout(800);
    await clearDice();
    await page.evaluate(() => document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));
    // La tarjeta de la victoria de la Taberna, si sigue ahí, se cierra como quien la ha leído: cae
    // encima de la palanca.
    await page.locator('.vs-card').filter({ visible: true }).first().click({ timeout: 2000 }).catch(() => {});
    const over = await page.evaluate(() => {
        const el = [...document.querySelectorAll('.wm-terrain-lever')].find(e => /** @type {HTMLElement} */ (e).offsetParent !== null);
        const r = el?.getBoundingClientRect();
        const top = r ? document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) : null;
        return { rect: r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width)] : null, top: top ? `${top.tagName}.${String(top.className).slice(0, 80)}` : '', scene: document.querySelector('#game-shell')?.getAttribute('data-scene') };
    });
    const pulled = await page.locator('.wm-terrain-lever').filter({ visible: true }).first().click({ timeout: 6000 }).then(() => 'ok')
        .catch((/** @type {any} */ e) => String(e?.message || e).split(/\r?\n/)
            .filter(l => /intercept|not stable|outside|visible/.test(l)).slice(0, 3).join(' | '));
    const woke = await until(() => chatHas(/Se despierta lo que dormia en la sala: Engendro hambriento/), 10000);
    check('en el Sótano, tirar de la palanca abre la celda y despierta al engendro', woke && (await state()).fighting, JSON.stringify({ lever, over, pulled }));
    await page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/combat-stop'));
    await page.waitForTimeout(800);
    await clearDice();
    // Acabar la pelea vuelve solo a la novela (J18.8).
    const stopped = await until(async () => await sceneNow() === 'dialogue', 8000);
    check('acabar la pelea vuelve sola a la novela (J18.8)', stopped, await sceneNow());
    await page.waitForTimeout(500);
    const rulesToast = await page.evaluate(() => [...document.querySelectorAll('#toast-container .toast')].some(t => /Recarga la página/.test(t.textContent || '')));
    check('cambiar de campaña no pide recargar la página', !rulesToast);

    // 6. Volver al gremio.
    await clickChip(/Volver al gremio/);
    const home = await until(async () => (await state()).world === hubWorld, 60000);
    await page.waitForTimeout(1000);
    now = await state();
    check('se vuelve al gremio, a su chat, con el grupo entero', home && now.chat === hubChat && now.party.length === 2 && now.party.every(m => m.world === hubWorld), JSON.stringify(now));
    check('y la vuelta se cuenta (J4.9)', await until(() => chatHas(/Nueve días de camino después, volvéis a Puerto Alba/), 10000));

    // 7. Y se sigue la campaña donde se dejó.
    await clickChip(/Tablón de campañas/);
    await page.waitForSelector('.hb-root [data-campaign="strahd"]', { timeout: 15000 }).catch(() => {});
    const again = await page.evaluate(() => (document.querySelector('.hb-root [data-campaign="strahd"]')?.textContent || '').replace(/\s+/g, ' '));
    check('en el tablón, Strahd sale en curso, para seguirla', /En curso/.test(again) && /Seguir/.test(again), again.slice(0, 200));
    await page.locator('.hb-root [data-campaign="strahd"]').click();
    const back = await until(async () => (await state()).world === strahdWorld, 60000);
    await page.waitForTimeout(800);
    now = await state();
    check('seguir la abre en su mismo chat, con el grupo', back && now.chat === strahdChat && now.party.length === 2, JSON.stringify(now));
    // J2.2: la vuelta ve cada consejo una vez, aunque haya habido otra pelea (la Taberna), y nunca dos a la vez.
    const allTips = await tipsShown();
    const tipsAtOnce = await page.evaluate(() => Number(/** @type {any} */ (window).__tipsAtOnce) || 0);
    check('la vuelta ve cada consejo una vez, y de uno en uno (J2.2)', allTips.length >= 3 && new Set(allTips).size === allTips.length && tipsAtOnce === 1,
        JSON.stringify({ allTips, tipsAtOnce }));

    // J0.5: al título y de vuelta con «Continuar», que sigue lo último que se jugó: Strahd, que
    // es del gremio, en su chat.
    await clearDice();
    await page.evaluate(() => /** @type {HTMLElement|null} */ (document.activeElement)?.blur());
    await page.keyboard.press('Escape');
    await page.locator('#game-shell .gs-pause-btn').filter({ hasText: /Salir al men/i }).first().click({ timeout: 5000 }).catch(() => {});
    const continueItem = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Continuar' });
    const resumeHint = await until(async () => /Strahd/.test(await continueItem.locator('.gs-menu-hint').textContent({ timeout: 1000 }) || ''), 30000)
        ? String(await continueItem.locator('.gs-menu-hint').textContent()) : '';
    await continueItem.click({ timeout: 5000 }).catch(() => {});
    const resumed = await until(async () => (await state()).chat === strahdChat, 60000);
    await page.waitForTimeout(800);
    now = await state();
    check('en el título, «Continuar» dice qué sigue (Strahd, desde el gremio, con Tessa) y la sigue en su chat, de un clic (J0.5)',
        /^La Maldición de Strahd, desde .*Gremio · Tessa/.test(resumeHint) && resumed && now.party.length === 2, JSON.stringify({ resumeHint, now }));

    // 7b. J4.5 y J3.9: terminar la campaña. Se abre el último hito y se gana en la cripta con
    // el mismo suceso que daría el juego; sale el final, se vuelve al gremio desde él, y la
    // campaña queda terminada en el tablón y en el salón de la fama.
    const chatCount = (/** @type {RegExp} */ pattern) => page.evaluate((source) => (window.SillyTavern.getContext().chat || [])
        .filter((/** @type {any} */ m) => new RegExp(source).test(String(m.extra?.display_text || m.mes || ''))).length, pattern.source);
    // El chat cambia de nombre antes de que lleguen sus metadatos: se espera a que el hilo de
    // Strahd esté cargado, o lo que se toque aquí se lo lleva la carga.
    await until(() => page.evaluate((world) => {
        const meta = window.SillyTavern.getContext().chatMetadata;
        return meta?.world_info === world && Boolean(meta?.plotState) && Boolean(meta?.plot);
    }, strahdWorld), 30000);
    await page.waitForTimeout(1000);
    await clearDice();
    await page.evaluate(() => document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));
    const started = await page.evaluate(async () => {
        const meta = window.SillyTavern.getContext().chatMetadata;
        const plot = meta.plotState || { open: [], done: [] };
        meta.plotState = { ...plot, open: [...new Set([...(plot.open || []), 'el-senor-de-barovia'])] };
        (await import('/scripts/party.js')).notePlot({ kind: 'win', place: 'Castillo Ravenloft', board: 'La Cripta de Strahd' });
        return (meta.campaignStart?.party || []).map((/** @type {any} */ m) => m.name);
    });
    const endShown = await page.waitForSelector('.popup:visible .end-root', { timeout: 15000 }).then(() => true).catch(() => false);
    await page.waitForTimeout(500);
    const ending = await page.evaluate(() => {
        const root = document.querySelector('.end-root');
        const all = (/** @type {string} */ s) => [...(root?.querySelectorAll(s) ?? [])].map(e => (e.textContent || '').trim());
        return {
            title: (root?.querySelector('h3')?.textContent || '').trim(),
            scene: (root?.querySelector('.end-scene')?.textContent || '').trim(),
            people: all('.end-epilogue'),
            companions: all('.ep-line'),
            take: all('.end-take'),
            numbers: all('.end-number'),
            home: document.querySelectorAll('.popup:has(.end-root) .end-home').length,
        };
    });
    // Idea 200: la partida en números, con sus singulares, y nunca más ganados que combates.
    const fightsLine = ending.numbers.map(n => /^(\d+) combates?: (\d+) ganados?/.exec(n)).find(Boolean);
    check('en el final, la partida en números concuerda: «1 día», no «1 días», y nunca más ganados que combates (200)',
        ending.numbers.length >= 4 && Boolean(fightsLine) && Number(fightsLine?.[1]) >= Number(fightsLine?.[2]) && Number(fightsLine?.[1]) > 0
        && !ending.numbers.some(n => /(^|\D)1 (días|combates|ganados|sitios|viajes|huidas|encargos|rumores)\b/.test(n))
        && !ending.numbers.some(n => /(^|\D)(0|[2-9]|\d\d+) (día|combate|ganado|sitio|viaje|huida|encargo|rumor)\b/.test(n)),
        JSON.stringify(ending.numbers));
    const endingTitle = ending.title.replace(/^Final: /, '');
    check('al ganar en la cripta sale el final: su título, lo que pasó, qué fue de la gente y de Gerd, y lo que se lleva cada uno, frente a cómo empezó (J4.5)',
        endShown && /^Final: (Barovia, libre|La orden descansa|La caravana se va)$/.test(ending.title) && /Strahd cae/.test(ending.scene)
        && ending.people.length >= 3 && ending.companions.length === 1 && /gremio/.test(ending.companions[0]) && started.includes('Tessa')
        && ending.take.length === 2 && /^Tessa: nivel \d+/.test(ending.take[0]) && /de experiencia/.test(ending.take[0]) && /^Gerd el Mellado: /.test(ending.take[1])
        && ending.home === 1, JSON.stringify({ ending, started }));
    check('con la campaña terminada, la fila ofrece volver a ver el final (J4.5)', (await chips()).some(c => /El final/.test(c)), JSON.stringify(await chips()));
    if (SHOT) await page.screenshot({ path: `${SHOT}.final.png` });
    await page.evaluate(() => document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));
    await page.locator('.popup:visible .end-home').click({ timeout: 5000 }).catch(() => {});
    const homeAgain = await until(async () => (await state()).world === hubWorld, 60000);
    await page.waitForTimeout(1000);
    now = await state();
    const told = endingTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const homecoming = await until(() => chatHas(new RegExp(`ya se sabe cómo acabó La Maldición de Strahd: ${told}\\.`)), 10000);
    // En el chat del gremio: el camino de la primera vuelta (paso 6) y el de esta.
    const roads = await chatCount(/Nueve días de camino después/);
    check('«Volver al gremio» desde el final lleva al gremio con el grupo, con el camino y una escena que dice cómo acabó (J4.5)',
        homeAgain && now.chat === hubChat && now.party.length === 2 && homecoming && roads === 2,
        JSON.stringify({ now, homecoming, roads }));
    await clearDice();
    await clickChip(/Tablón de campañas/);
    await page.waitForSelector('.hb-root [data-campaign="strahd"]', { timeout: 15000 }).catch(() => {});
    const finished = await page.evaluate(() => (document.querySelector('.hb-root [data-campaign="strahd"]')?.textContent || '').replace(/\s+/g, ' '));
    check('en el tablón, Strahd sale terminada, con su final, y se vuelve a ella en vez de seguirla (J4.5)',
        finished.includes(`Terminada: ${endingTitle}`) && /Volver: La Maldición de Strahd/.test(finished), finished.slice(0, 240));
    await page.locator('.hb-root .hb-close').click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
    const hallChip = await clickChip(/Salón de la fama/);
    await page.waitForSelector('.popup:visible .hall-root', { timeout: 8000 }).catch(() => {});
    const hall = await page.evaluate(() => [...document.querySelectorAll('.hall-root .hall-campaign')].map(e => (e.textContent || '').trim()));
    check('y sale en el salón de la fama: cuál, con qué final, quién fue y cuándo (J3.9)',
        hallChip && hall.length === 1 && hall[0].startsWith(`La Maldición de Strahd: terminada con «${endingTitle}»`)
        && /Fueron Tessa y Gerd el Mellado/.test(hall[0]) && /\(\d{4}-\d{2}-\d{2}/.test(hall[0]), JSON.stringify({ hallChip, hall }));
    if (SHOT) await page.screenshot({ path: `${SHOT}.salon.png` });
    await page.locator('.popup:visible .popup-button-ok').last().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(400);

    // 8. J0.5: el título ofrece «Continuar», lo primero, y dice qué sigue: el gremio, con quién.
    // «Seguir en el gremio» ya no sale: era lo mismo para el gremio más reciente.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#game-shell', { timeout: 90000 });
    await page.evaluate(() => document.querySelector('#option_close_chat') instanceof HTMLElement && /** @type {HTMLElement} */ (document.querySelector('#option_close_chat')).click());
    const cont = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Continuar' });
    const resumable = await until(async () => await cont.count() === 1, 30000);
    const contHint = resumable ? await cont.locator('.gs-menu-hint').textContent() : '';
    const titleItems = await page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-menu-btn .gs-menu-label')].map(l => (l.textContent || '').trim()));
    check('el título ofrece «Continuar» lo primero: el gremio, con quién va (J0.5)',
        resumable && titleItems[0] === 'Continuar' && !titleItems.includes('Seguir en el gremio')
        && /^[^·]*Gremio · Tessa/.test(String(contHint)) && /Gerd/.test(String(contHint)), JSON.stringify({ titleItems, contHint }));
    // J0.6: «Cargar partida» enseña partidas, no chats: el gremio y sus campañas son una sola, con su tarjeta.
    await page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Cargar partida' }).click({ timeout: 5000 }).catch(() => {});
    await page.waitForSelector('#game-shell .gs-save', { timeout: 15000 }).catch(() => {});
    const saves = await page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-save')].map(card => ({
        kind: card.getAttribute('data-kind'),
        title: card.querySelector('.gs-save-title')?.textContent || '',
        hero: card.querySelector('.gs-save-hero')?.textContent || '',
        line: card.querySelector('.gs-save-line')?.textContent || '',
        when: card.querySelector('.gs-save-when')?.textContent || '',
        campaigns: card.querySelector('.gs-save-campaigns')?.textContent || '',
        shown: card.getBoundingClientRect().height > 0,
    })));
    const inLoad = await stCharacterUi();
    check('«Cargar partida» enseña partidas, no chats: el gremio, con Strahd dentro, en una tarjeta con el día, el sitio, Tessa y su nivel, y cuándo se jugó (J0.6)',
        saves.length === 1 && saves[0].kind === 'gremio' && saves[0].shown && /Gremio/.test(saves[0].title)
        && /^Tessa \(.*nivel \d+\), con Gerd el Mellado/.test(saves[0].hero) && /^Día \d+ · \S/.test(saves[0].line)
        && /^Jugada hace/.test(saves[0].when) && /La Maldición de Strahd/.test(saves[0].campaigns) && inLoad.length === 0,
        JSON.stringify({ saves, inLoad }));
    if (SHOT) await page.screenshot({ path: `${SHOT}.cargar.png` });
    await page.locator('#game-shell .gs-menu-back').click({ timeout: 5000 }).catch(() => {});
    // J3.9: el título también lleva al salón, y dice lo que hay.
    const hallHint = await page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Salón de la fama' }).locator('.gs-menu-hint').textContent({ timeout: 3000 }).catch(() => '');
    check('el título ofrece el salón de la fama, con la campaña terminada (J3.9)', /1 campaña terminada/.test(String(hallHint)), String(hallHint));

    // 9. J1.6 y J18.1: tus personajes. Al entrar se elige con quién; se hace uno más en el
    // mismo gremio, se cambia quién va desde el tablón, y al volver se entra con el guardado.
    /** Las tarjetas de tus personajes que hay en pantalla. */
    const heroCards = () => page.evaluate(() => [...document.querySelectorAll('.hb-root .hb-hero[data-hero]')].map(c => ({
        id: c.getAttribute('data-hero'), active: c.classList.contains('is-active'), text: (c.textContent || '').replace(/\s+/g, ' ').trim(),
    })));
    /** El tuyo que va con el grupo, con lo que lleva, y quién va con él. */
    const leader = () => page.evaluate(async () => {
        const party = (await import('/scripts/party.js')).getPartyMembersSnapshot();
        const hero = party.find((/** @type {any} */ m) => !m.guest);
        return hero ? {
            name: String(hero.name), gold: Number(hero.gold) || 0, level: Number(hero.level) || 1, xp: Number(hero.xp) || 0,
            items: (hero.items ?? []).length, guests: party.filter((/** @type {any} */ m) => m.guest).map((/** @type {any} */ m) => String(m.name)),
        } : null;
    });
    /** Los que se quedan en el gremio, leídos del mundo. */
    const resting = () => page.evaluate(async (world) => {
        const data = await (await import('/scripts/world-info.js')).loadWorldInfo(world);
        return (data?.metadata?.hubHeroes ?? []).map((/** @type {any} */ h) => ({
            name: String(h.name), gold: Number(h.gold) || 0, level: Number(h.level) || 1, xp: Number(h.xp) || 0, items: (h.items ?? []).length,
        }));
    }, hubWorld);
    const noToasts = () => page.evaluate(() => document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));
    /** Entrar desde la portada: «Continuar» (J0.5), o «Seguir en el gremio», que es lo que había antes. */
    const enterFromTitle = async () => {
        const entry = page.locator('#game-shell .gs-menu-btn').filter({ hasText: /Continuar|Seguir en el gremio/ }).first();
        await until(async () => await entry.count() === 1, 30000);
        await entry.click({ timeout: 10000 });
    };

    await enterFromTitle();
    const chooser = await page.waitForSelector('.hb-root .hb-hero[data-hero]', { timeout: 60000 }).then(() => true).catch(() => false);
    await page.waitForTimeout(500);
    let seen = await heroCards();
    const tessaThen = await leader();
    check('al entrar al gremio se elige con quién: Tessa en su tarjeta, con su nivel y lo que lleva, y «Nuevo personaje» (J18.1)',
        chooser && seen.length === 1 && seen[0].active && /Tessa/.test(seen[0].text) && /Nivel \d/.test(seen[0].text) && /Lleva:/.test(seen[0].text)
        && await page.locator('.hb-root [data-hero-new]').count() === 1 && tessaThen?.name === 'Tessa', JSON.stringify({ seen, tessaThen }));
    if (SHOT) await page.screenshot({ path: `${SHOT}.quien-entra.png` });

    // Entrar con uno nuevo: la creación, y el de antes se queda en el gremio.
    await noToasts();
    await page.locator('.hb-root [data-hero-new]').click();
    const creatorAgain = await page.waitForSelector('.hc-root', { timeout: 30000 }).then(() => true).catch(() => false);
    await page.fill('.hc-root .hc-name', 'Bram');
    await pickHeroCard(page, 'race', 'Mediano');
    await pickHeroCard(page, 'class', 'Picaro');
    await page.locator('.hc-root .hc-enter').click();
    await until(async () => (await leader())?.name === 'Bram', 30000);
    await page.waitForTimeout(800);
    const bramNow = await leader();
    let staying = await resting();
    check('«Nuevo personaje» abre la creación: Bram entra con 10 de oro (D-J11) y con Gerd; Tessa se queda en el gremio, entera (J18.1, J1.6)',
        creatorAgain && bramNow?.name === 'Bram' && bramNow.gold === 10 && bramNow.items > 0 && bramNow.guests.includes('Gerd el Mellado')
        && staying.length === 1 && staying[0].name === 'Tessa' && staying[0].gold === tessaThen?.gold && staying[0].level === tessaThen?.level
        && staying[0].xp === tessaThen?.xp && staying[0].items === tessaThen?.items,
        JSON.stringify({ tessaThen, bramNow, staying }));

    // Cambiar quién va, desde el tablón.
    await clearDice();
    await noToasts();
    await clickChip(/Tablón de campañas/);
    await page.waitForSelector('.hb-root .hb-heroes .hb-hero[data-hero]', { timeout: 15000 }).catch(() => {});
    seen = await heroCards();
    check('en el tablón, «Quién va»: Bram va ahora y Tessa espera en el gremio (J1.6)',
        seen.length === 2 && seen[0].active && /Bram/.test(seen[0].text) && !seen[1].active && /Tessa/.test(seen[1].text) && /En el gremio/.test(seen[1].text),
        JSON.stringify(seen));
    if (SHOT) await page.screenshot({ path: `${SHOT}.quien-va.png` });
    await page.locator('.hb-root .hb-heroes .hb-hero[data-hero]').filter({ hasText: 'Tessa' }).click();
    await until(async () => (await leader())?.name === 'Tessa', 30000);
    // El tablón se abre otra vez, con ella al frente; se cierra sin elegir campaña.
    await until(() => page.evaluate(() => document.querySelectorAll('.hb-root').length === 1
        && /Tessa/.test(document.querySelector('.hb-root .hb-hero.is-active')?.textContent || '')), 15000);
    const reopened = await heroCards();
    await page.locator('.hb-root .hb-close').click({ timeout: 5000 }).catch(() => {});
    const tessaBack = await leader();
    staying = await resting();
    check('cambiar en el tablón trae a Tessa con lo suyo y deja a Bram en el gremio; el tablón vuelve con ella al frente (J1.6)',
        tessaBack?.name === 'Tessa' && tessaBack.gold === tessaThen?.gold && tessaBack.items === tessaThen?.items && tessaBack.guests.includes('Gerd el Mellado')
        && staying.length === 1 && staying[0].name === 'Bram' && staying[0].gold === 10 && staying[0].items === bramNow?.items
        && reopened[0]?.active === true && /Tessa/.test(reopened[0]?.text ?? ''),
        JSON.stringify({ tessaBack, staying, reopened }));

    // Entrar con uno guardado: otra vez desde el título, y se elige entre los dos.
    await page.waitForTimeout(1500);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#game-shell', { timeout: 90000 });
    await page.evaluate(() => document.querySelector('#option_close_chat') instanceof HTMLElement && /** @type {HTMLElement} */ (document.querySelector('#option_close_chat')).click());
    await enterFromTitle();
    const twice = await page.waitForSelector('.hb-root .hb-hero[data-hero]', { timeout: 60000 }).then(() => true).catch(() => false);
    await page.waitForTimeout(500);
    seen = await heroCards();
    check('al volver a entrar se elige entre los dos: Tessa, que iba, y Bram (J18.1)',
        twice && seen.length === 2 && seen.some(c => /Tessa/.test(c.text) && c.active) && seen.some(c => /Bram/.test(c.text) && !c.active), JSON.stringify(seen));
    await noToasts();
    await page.locator('.hb-root .hb-hero[data-hero]').filter({ hasText: 'Bram' }).click();
    await until(async () => (await leader())?.name === 'Bram', 30000);
    await page.waitForTimeout(500);
    const bramBack = await leader();
    staying = await resting();
    check('entrar con Bram, guardado, lo trae con su oro y su equipo; Tessa se queda en el gremio (J18.1)',
        bramBack?.name === 'Bram' && bramBack.gold === 10 && bramBack.items === bramNow?.items && bramBack.guests.includes('Gerd el Mellado')
        && staying.map(h => h.name).join() === 'Tessa' && staying[0]?.gold === tessaThen?.gold,
        JSON.stringify({ bramBack, staying }));

    // 10. D-J23: borrar el gremio desde «Cargar partida», con sus campañas, y una ventana que dice
    // todo lo que se va antes de borrarlo.
    await page.waitForTimeout(1500);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#game-shell', { timeout: 90000 });
    await page.evaluate(() => document.querySelector('#option_close_chat') instanceof HTMLElement && /** @type {HTMLElement} */ (document.querySelector('#option_close_chat')).click());
    const loadItem = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Cargar partida' });
    await until(async () => await loadItem.count() === 1, 30000);
    await loadItem.click({ timeout: 10000 }).catch(() => {});
    const guildBin = page.locator('#game-shell .gs-save[data-kind="gremio"] .gs-save-delete');
    const binShown = await guildBin.waitFor({ state: 'visible', timeout: 30000 }).then(() => true).catch(() => false);
    const binTitle = binShown ? await guildBin.getAttribute('title') : '';
    await guildBin.click({ timeout: 5000 }).catch(() => {});
    const asked = await page.waitForSelector('.popup:visible .popup-button-ok', { timeout: 15000 }).then(() => true).catch(() => false);
    const warning = asked ? (await page.locator('.popup:visible').last().textContent() || '').replace(/\s+/g, ' ').trim() : '';
    if (SHOT) await page.screenshot({ path: `${SHOT}.borrar-gremio.png` });
    await page.locator('.popup:visible .popup-button-ok').last().click({ timeout: 5000 }).catch(() => {});
    const emptied = await until(async () => /Todavía no hay ninguna partida/.test(String(await page.locator('#game-shell .gs-saves').textContent({ timeout: 1000 }).catch(() => ''))), 45000);
    const worldsLeft = await page.evaluate(async (names) => {
        const wi = await import('/scripts/world-info.js');
        return names.filter(name => (wi.world_names ?? []).includes(name));
    }, [hubWorld, strahdWorld]);
    check('«Cargar partida» borra el gremio entero: avisa de todo (el gremio, Strahd, las sesiones, que no se deshace) y se lleva sus mundos y sus chats (D-J23)',
        binShown && /gremio/i.test(String(binTitle)) && /La Maldición de Strahd/.test(warning) && /sesion/.test(warning) && /no se puede deshacer/.test(warning)
        && emptied && worldsLeft.length === 0, JSON.stringify({ binTitle, warning: warning.slice(0, 500), emptied, worldsLeft }));

    check('sin errores en la página', problems.length === 0, problems.slice(0, 6).join('\n        '));
} catch (error) {
    failures++;
    console.log(`FAIL  the run threw: ${/** @type {any} */ (error)?.message || error}`);
    // Con --captura, también cómo estaba la pantalla cuando se rompió.
    if (SHOT && page) await page.screenshot({ path: `${SHOT}.error.png` }).catch(() => {});
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
