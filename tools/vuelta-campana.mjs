#!/usr/bin/env node
/**
 * La vuelta de CUALQUIER campaña (J16 de wiki/ROADMAP_SIN_CONEXION.md): la que te da tu Gem o
 * un paquete del juego, en un archivo JSON. La añade al tablón como quien juega y la juega a
 * clics hasta uno de sus finales, contra un servidor propio con un `--dataRoot` temporal (no
 * toca tu partida):
 *
 *   portada → «Jugar sin conexión» → Tessa → la pelea del muelle y «Saltar la prueba» → el tablón
 *   → «Añadir una campaña» con tu archivo (el informe del tablón sale en el registro) → empezarla
 *   → cada hito, a clics (escenas, charlas, viajes, tableros, peleas, tiradas) → un final.
 *
 * La juega el mismo jugador automático que las otras vueltas (`tools/vuelta-bot.mjs`): mira la
 * pantalla y pulsa lo que pulsaría quien juega, sin escribir nada. Apunta cada **silencio** (un
 * clic tras el que no cambia nada que se vea) y cada **atasco** (lo que pide la historia no está
 * a la vista), con el sitio, el paso y lo que se ve, y al final lo dice todo junto.
 *
 * Uso:
 *   node tools/vuelta-campana.mjs mi-campana.json                 # sin ventana, puerto 8249
 *   node tools/vuelta-campana.mjs mi-campana.json --headed        # mirándola
 *   node tools/vuelta-campana.mjs mi-campana.json --captura v.png # capturas al empezar y al final
 *   node tools/vuelta-campana.mjs --ejemplo                       # la muestra del Gem (La luz de Punta Gris)
 *   node tools/vuelta-campana.mjs --ejemplo corta                 # la muestra corta (El Pozo de la Ermita)
 *   node tools/vuelta-campana.mjs mi-campana.json --peleas        # las peleas de verdad (más lenta)
 *   node tools/vuelta-campana.mjs mi-campana.json --estricto      # y un silencio o un atasco cuentan como fallo
 *   node tools/vuelta-campana.mjs mi-campana.json --pasos 400     # cortar antes
 *
 * Los ganchos de prueba, dichos en el registro con «GANCHO»: las peleas a un golpe (salvo con
 * `--peleas`); si la campaña empieza por encima del nivel 1, el héroe sube a su nivel de entrada;
 * y si el rango del gremio aún no la abre, el gremio recibe el renombre que le falta.
 */

/* global window, document */

import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createBot, startOffline, runCampaign, skipTrial, startServer, printFindings } from './vuelta-bot.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const FLAGS_WITH_VALUE = ['--port', '--captura', '--pasos', '--campana'];
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8249;
const BASE = `http://127.0.0.1:${PORT}`;
const HEADED = process.argv.includes('--headed');
const SHOT = argAfter('--captura');
const STRICT = process.argv.includes('--estricto');
const REAL_FIGHTS = process.argv.includes('--peleas');
const MAX_STEPS = Number(argAfter('--pasos')) || 1600;
const SAMPLE = process.argv.includes('--ejemplo') ? (argAfter('--ejemplo') === 'corta' ? 'corta' : 'gem') : '';
/** El archivo: el primer argumento suelto (que no es el valor de una opción), o `--campana`. */
const FILE = argAfter('--campana') || process.argv.slice(2).find((arg, i, all) => !arg.startsWith('--')
    && !FLAGS_WITH_VALUE.includes(all[i - 1] ?? '') && !(all[i - 1] === '--ejemplo' && arg === 'corta')) || '';

const require = createRequire(join(ROOT, 'tests/package.json'));
const { chromium } = require('@playwright/test');
const readJson = (/** @type {string} */ path) => JSON.parse(readFileSync(join(ROOT, path), 'utf8'));

let failures = 0;
const check = (/** @type {string} */ name, /** @type {boolean} */ ok, detail = '') => {
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        -> ${detail}` : ''}`);
};
/** Los números que importan (J16.4): salen en el registro, y `e2e-todo.mjs` los enseña al final. */
const number = (/** @type {string} */ what, /** @type {string|number} */ value) => console.log(`NUM   ${what}: ${value}`);
/** Las órdenes al narrador: sin modelo, si se ven, se leen como un error. */
const ORDER = /(Cuéntalo|Cuentalo|No inventes|Dilo tal cual|Describe la escena|Narra esta|Adapta la escena|Que se note|narra la consecuencia|No digas otra vez)/;
/** Los puntos de experiencia de cada nivel (las reglas de 2024): para subir al de entrada. */
const XP_FOR_LEVEL = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];

const dataRoot = mkdtempSync(join(tmpdir(), 'st-vuelta-campana-'));
/** @type {any} */
let server = null;
/** @type {any} */
let browser = null;
/** @type {any} */
let page = null;

const t0 = Date.now();
const clock = (/** @type {number} */ ms) => `${Math.floor(ms / 60000)}:${String(Math.round((ms % 60000) / 1000)).padStart(2, '0')}`;

/**
 * El archivo que se añade: el que se ha dado o, con `--ejemplo`, la muestra del Gem escrita en
 * la carpeta temporal (como si te la hubiera dado él).
 *
 * @returns {Promise<string>}
 */
async function campaignFile() {
    if (SAMPLE) {
        const pack = SAMPLE === 'corta'
            ? (await import(pathToFileURL(join(ROOT, 'public/scripts/game-engine/campaign/pack-fill.js')).href)).buildShortExamplePack()
            : (await import(pathToFileURL(join(ROOT, 'public/scripts/game-engine/campaign/gem-guide.js')).href)).buildConversationSamplePack();
        const path = join(dataRoot, SAMPLE === 'corta' ? 'el-pozo-de-la-ermita.json' : 'la-luz-de-punta-gris.json');
        writeFileSync(path, JSON.stringify(pack, null, 2));
        return path;
    }
    return FILE ? resolve(process.cwd(), FILE) : '';
}

try {
    const file = await campaignFile();
    if (!file || !existsSync(file)) {
        console.log('Uso: node tools/vuelta-campana.mjs <tu-campaña.json> [--headed] [--captura v.png] [--peleas] [--estricto]');
        console.log('     node tools/vuelta-campana.mjs --ejemplo        (la muestra del Gem)');
        throw new Error(file ? `no encuentro el archivo ${file}` : 'falta el archivo de la campaña');
    }
    console.log(`La campaña: ${file}`);
    server = await startServer({ root: ROOT, port: PORT, dataRoot });
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
            // Los consejos, vistos: se mide la campaña, no enseñar a jugar (eso lo mira e2e-gremio).
            window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,combat,travel,prisoners,mesa,high,spell,pet,bill,move,attack,roll,talk,journal');
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
        } catch { /* nada */ }
    });

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    const bot = createBot(page, { fast: !REAL_FIGHTS, log: (line) => console.log(line) });
    const clicked = await startOffline(page, { name: 'Tessa', gender: 'Mujer', race: 'Humano', klass: 'Guerrero' });

    // --- El gremio: la pelea del muelle y saltar la prueba ----------------------------------
    const skipped = await skipTrial(bot, { guildPack: readJson('public/mundos/gremio.pack.json') });
    check('en el gremio, «Saltar la prueba» deja el prólogo hecho', skipped, bot.describe(await bot.observe()).slice(0, 300));

    // --- El tablón: «Añadir una campaña» con el archivo, como quien la elige -----------------
    /** @type {{ok: boolean, title: string, verdict: string, text: string, groups: Array<{key: string, text: string}>}|null} */
    let report = null;
    let campaignId = '';
    let locked = '';
    let started = false;
    let worldBefore = '';
    const onHub = async (/** @type {any} */ now) => {
        const hub = page.locator('dialog[open] .hb-root');
        if (!report) {
            const add = hub.locator('[data-campaign-add]');
            if (await add.count() === 0) return false;
            bot.markDecision();
            const done = await bot.act(now, `«Añadir una campaña» con ${file.replace(/^.*[\\/]/, '')}`, async () => {
                const chooser = page.waitForEvent('filechooser', { timeout: 15000 });
                if (!await bot.press(add)) return false;
                await (await chooser).setFiles(file);
                return true;
            }, { module: 'hub-panel.js (añadir)', wait: 60000 });
            // Se comprueba antes de guardarla: el informe sale debajo de las tarjetas.
            await bot.until(async () => page.evaluate(() => {
                const box = document.querySelector('dialog[open] .hb-root .hb-import');
                return Boolean(box && (box.classList.contains('is-ok') || box.classList.contains('is-bad')));
            }), 90000, 500);
            report = await page.evaluate(() => {
                const said = (/** @type {Element|null|undefined} */ n) => (n?.textContent || '').replace(/\s+/g, ' ').trim();
                const box = document.querySelector('dialog[open] .hb-root .hb-import');
                return {
                    ok: Boolean(box?.classList.contains('is-ok')),
                    title: said(box?.querySelector('.hb-import-title')),
                    verdict: box?.querySelector('.hb-check')?.getAttribute('data-verdict') ?? '',
                    text: said(box).slice(0, 4000),
                    groups: [...(box?.querySelectorAll('.hb-check-group') ?? [])].map(g => ({ key: g.getAttribute('data-group') || '', text: said(g).slice(0, 1500) })),
                };
            });
            const fresh = await page.evaluate(() => {
                const card = document.querySelector('dialog[open] .hb-root .vt-card.is-new[data-campaign]');
                return { id: card?.getAttribute('data-campaign') || '', locked: card?.classList.contains('is-locked') ? (card.querySelector('.hb-lock')?.textContent || 'cerrada').trim() : '' };
            });
            campaignId = fresh.id;
            locked = fresh.locked;
            return done;
        }
        if (!report.ok || !campaignId) return false;
        const card = hub.locator(`[data-campaign="${campaignId}"]:not(.is-locked)`);
        if (await card.count() === 0) return false;
        worldBefore = now.world;
        const done = await bot.act(now, `empezar «${campaignId}» en el tablón`, () => bot.press(card), { module: 'hub-panel.js', wait: 8000 });
        // Cargar la campaña tarda: no se vuelve a mirar el tablón mientras carga.
        started = await bot.until(async () => { const w = (await bot.observe()).world; return Boolean(w) && w !== worldBefore; }, 60000, 400);
        return done;
    };
    /**
     * Desde el pueblo del gremio, abrir el tablón y hacer lo que pida `onHub` hasta `reached`.
     *
     * @param {(now: any) => boolean} reached
     */
    const atTheBoard = async (reached) => {
        for (let i = 0; i < 40; i++) {
            const now = await bot.observe();
            if (reached(now)) return true;
            if (await bot.handleLayer(now, { onHub })) continue;
            if (await bot.tapChip(now, /^Tablón de campañas$/, 'el tablón de campañas', 'action-chips.js')) continue;
            if (now.scene === 'dialogue' && now.vn.next) await bot.act(now, '«Continuar»', () => bot.press(bot.chip(/^Continuar$/)));
            else if (!await bot.toMap(now)) await page.waitForTimeout(300);
        }
        return reached(await bot.observe());
    };
    await atTheBoard(() => Boolean(report));
    // Cerrado el tablón (para subir de nivel o de rango antes de empezarla).
    const closeBoard = async () => {
        await page.locator('dialog[open] .hb-root .hb-close, dialog[open]:has(.hb-root) .popup-button-ok').first().click({ timeout: 2000 }).catch(() => page.keyboard.press('Escape'));
        await bot.until(async () => (await page.locator('dialog[open] .hb-root').count()) === 0, 5000);
    };
    const imported = /** @type {any} */ (report);
    console.log(`\n--- el informe del tablón al añadirla ---\n  ${imported?.title || '(no salió el informe)'}${imported?.verdict ? ` [${imported.verdict}]` : ''}`);
    for (const g of imported?.groups ?? []) console.log(`  · ${g.key}: ${g.text.slice(0, 600)}`);
    if (imported && !imported.ok) console.log(`  ${imported.text.slice(0, 1500)}`);
    check('el tablón la acepta («Añadida al tablón»)', Boolean(imported?.ok && campaignId), JSON.stringify({ title: imported?.title, id: campaignId }));
    if (!imported?.ok || !campaignId) throw new Error('el tablón no la ha aceptado: arregla lo que dice el informe (o pásaselo a tu Gem) y vuelve a probar');

    // El paquete tal como lo ha guardado el tablón, con lo que puso el juego (tableros, bichos,
    // textos): lo que pide cada hito se lee de aquí, como quien lee «Lo que tienes entre manos».
    const pack = await page.evaluate(async (id) => {
        const { importedPackFileName } = await import('/scripts/game-engine/campaign/campaign-import.js');
        const response = await fetch(`/user/files/${importedPackFileName(id)}`, { cache: 'no-store' });
        return response.ok ? response.json() : null;
    }, campaignId);
    if (!pack) throw new Error(`no encuentro el paquete guardado de ${campaignId}`);
    const levels = Array.isArray(pack.world?.levels) ? pack.world.levels.map(Number) : [];
    const entry = Math.max(1, Math.min(20, Number(levels[0]) || 1));

    // --- Los ganchos: el nivel de entrada y el rango del gremio, si hacen falta ---------------
    if (entry > 1 || locked) await closeBoard();
    if (entry > 1) {
        const now = await page.evaluate(async ({ xp, ups }) => {
            const party = await import('/scripts/party.js');
            party.grantXpForSimulation(xp);
            for (let i = 0; i < ups; i++) await party.levelUpForSimulation();
            party.trainMercenariesForSimulation();
            return Number(party.getPartyMembersSnapshot().find((/** @type {any} */ m) => !m.guest)?.level) || 1;
        }, { xp: XP_FOR_LEVEL[entry - 1], ups: entry - 1 });
        console.log(`GANCHO la campaña empieza en el nivel ${entry}: Tessa sube a su nivel de entrada (ahora, nivel ${now})`);
    }
    if (locked) {
        await page.evaluate(async () => {
            const ctx = window.SillyTavern.getContext();
            ctx.chatMetadata.guild = { ...(ctx.chatMetadata.guild ?? {}), renown: Math.max(40, Number(ctx.chatMetadata.guild?.renown) || 0) };
            await ctx.saveMetadata();
        });
        console.log(`GANCHO el tablón la tiene cerrada («${locked}»): el gremio recibe el renombre que le falta`);
    }
    await atTheBoard(() => started);
    check(`empezarla desde el tablón abre su mundo (${pack.world?.name || campaignId})`, started, bot.describe(await bot.observe()).slice(0, 300));
    await bot.until(async () => (await bot.observe()).open.length > 0, 20000, 400);
    if (SHOT) await page.screenshot({ path: SHOT });

    // --- La campaña, a clics, hasta un final ------------------------------------------------
    const played = started ? await runCampaign(bot, {
        pack,
        maxSteps: MAX_STEPS,
        stop: (now) => now.layer?.kind === 'end' || Boolean(now.ending),
    }) : { reached: false, gaveUp: 'no ha empezado', view: await bot.observe() };
    const v = played.view;
    const ending = await page.evaluate(() => {
        const root = document.querySelector('dialog[open] .end-root');
        const meta = window.SillyTavern.getContext().chatMetadata || {};
        return {
            id: String(meta.plotEnding || meta.plotState?.ending || ''),
            title: (root?.querySelector('h3')?.textContent || '').replace(/^Final: /, '').trim(),
            scene: (root?.querySelector('.end-scene')?.textContent || '').trim().slice(0, 200),
        };
    });
    if (SHOT) await page.screenshot({ path: `${SHOT}.final.png` });
    const endings = Object.keys(pack.plot?.endings ?? {});
    check('se juega a clics hasta uno de sus finales, con su escena',
        Boolean(ending.id) && (endings.length === 0 || endings.includes(ending.id)) && ending.title.length > 0,
        JSON.stringify({ ending, endings, gaveUp: played.gaveUp, where: bot.where(v), sees: bot.describe(v).slice(0, 300) }));

    // --- Lo que se ha leído: ninguna orden al narrador ---------------------------------------
    const read = await page.evaluate(() => (window.SillyTavern.getContext().chat || [])
        .map((/** @type {any} */ m) => String(m.extra?.display_text ?? m.mes ?? '')));
    const leaks = read.filter(t => ORDER.test(t));
    check('ninguna orden al narrador a la vista', leaks.length === 0, JSON.stringify(leaks.slice(0, 3).map(t => t.slice(0, 160))));

    // --- El recuento ------------------------------------------------------------------------
    printFindings(bot);
    const milestones = (pack.plot?.milestones ?? []).filter((/** @type {any} */ m) => !m.hidden && m.opens?.kind !== 'clock');
    const missing = milestones.filter((/** @type {any} */ m) => !v.done.includes(String(m.id)));
    console.log('\n--- los hitos que no se cumplieron ---');
    for (const m of missing) console.log(`  ${m.id}${m.title ? ` («${m.title}»)` : ''}: pide ${JSON.stringify(m.asks ?? { kind: 'none' }).slice(0, 160)}`);
    if (missing.length === 0) console.log('  (ninguno)');

    console.log('\n--- los números ---');
    number('La campaña', `${pack.world?.name || campaignId} (${campaignId}), niveles ${levels.join(' a ') || '?'}`);
    number('El informe del tablón', `${imported.verdict || '?'}: ${imported.title}`);
    number('Hitos jugados', `${milestones.filter((/** @type {any} */ m) => v.done.includes(String(m.id))).length} de ${milestones.length}`);
    number('El final', ending.title ? `${ending.title} (${ending.id})` : `ninguno (${played.gaveUp || 'sin final'})`);
    number('Silencios', bot.silences.length);
    number('Atascos (rescatados con un comando)', bot.blocks.length);
    number('Lo que se ve mal (etiquetas en crudo, ventanas encima, escenas tarde)', bot.oddities.length);
    number('Tiempo de «Jugar sin conexión» a la primera decisión', bot.firstDecisionAt ? clock(bot.firstDecisionAt - clicked) : 'sin decidir');
    number('Días de campaña', v.day);
    number('Pasos (clics)', bot.steps.length);
    number('Peleas, escenas con decisión, sucesos, charlas, viajes y tiradas',
        `${bot.counts.fights} · ${bot.counts.options} · ${bot.counts.sucesos} · ${bot.counts.talks} · ${bot.counts.travels} · ${bot.counts.checks}`);
    number('Veces que cae el grupo entero', `${bot.falls.length} (partidas cargadas después: ${bot.counts.loads})`);
    number('Descansos', bot.counts.rests);
    number('«Otra salida» antes o en mitad de una pelea (la vuelta elige pelear)', bot.counts.exits);
    number('Turnos del grupo jugados con el gancho (la barra de combate no respondía)', bot.counts.hooked);
    number('Clics lentos (más de 1,5 s)', bot.slow.length ? `${bot.slow.length} (el peor, ${Math.max(...bot.slow.map(s => s.ms))} ms)` : 0);
    number('Lo que tarda la vuelta', clock(Date.now() - t0));

    // En una frase, para quien la ha escrito.
    const verdict = ending.title
        ? `«${pack.world?.name}» se juega a clics de principio a fin: final «${ending.title}», ${bot.silences.length} silencio(s) y ${bot.blocks.length} atasco(s).`
        : `«${pack.world?.name}» se queda a medias en ${bot.where(v)}: ${played.gaveUp || 'sin final'}. Mira «los atascos» y «los hitos que no se cumplieron».`;
    console.log(`\nEN UNA FRASE: ${verdict}`);
    if (STRICT) {
        check('ningún silencio', bot.silences.length === 0, bot.silences.map(s => `#${s.n} ${s.what}`).join(' · '));
        check('ningún atasco', bot.blocks.length === 0, bot.blocks.map(b => `#${b.n} ${b.goal}`).join(' · '));
    }
    check('sin errores en la página', problems.length === 0, problems.slice(0, 6).join('\n        '));
} catch (error) {
    failures++;
    console.log(`FAIL  the run threw: ${/** @type {any} */ (error)?.message || error}`);
    if (SHOT && page) await page.screenshot({ path: `${SHOT}.error.png` }).catch(() => {});
} finally {
    if (browser) await browser.close().catch(() => {});
    if (server) {
        server.stdout?.destroy();
        server.stderr?.destroy();
        server.kill('SIGKILL');
    }
    await new Promise(r => setTimeout(r, 1000));
    rmSync(dataRoot, { recursive: true, force: true, maxRetries: 5 });
}
console.log(failures === 0 ? '\nTodo bien.' : `\n${failures} fallo(s).`);
process.exit(failures === 0 ? 0 : 1);
