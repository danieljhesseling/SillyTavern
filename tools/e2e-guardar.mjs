#!/usr/bin/env node
/**
 * Guardar como un juego (J15.2, J3.3 y J15.6 de wiki/ROADMAP_SIN_CONEXION.md), en un
 * navegador de verdad contra un servidor propio con un `--dataRoot` temporal, como
 * `e2e-gremio.mjs`. Lo que no es de este frente (crear el personaje, el prólogo) no se juega:
 * la partida se monta con las llamadas de SillyTavern (un gremio, su chat y una campaña de su
 * tablón) y se abre como la abriría «Continuar».
 *
 *   la pantalla de guardar con la partida abierta → guardar en la ranura 1 → pasa el día (el
 *   automático) y se empieza otra campaña → guardar en la 2, pisándola con su pregunta →
 *   dormir en el gremio guarda → un punto de retorno de hoy, y volver a él → cerrar →
 *   desde el título, las ranuras del gremio: cargar la 1 (el día 3, sin la campaña nueva) →
 *   y volver a la 2 (el día 5, con ella) → exportar la partida entera → importarla al lado,
 *   como copia, y jugarla → un archivo que no es una partida → y en el móvil.
 *
 * Uso:
 *   node tools/e2e-guardar.mjs                       # sin ventana
 *   node tools/e2e-guardar.mjs --headed
 *   node tools/e2e-guardar.mjs --port 8201 --captura guardar.png   # guardar-1.png, guardar-2.png…
 */

/* global window, document */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8201;
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

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-guardar-'));
const work = mkdtempSync(join(tmpdir(), 'st-e2e-guardar-files-'));
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
            const said = String(buffer);
            if (said.includes(String(PORT)) || said.toLowerCase().includes('listening')) {
                clearTimeout(timer);
                setTimeout(() => resolve(child), 1500);
            }
        };
        child.stdout.on('data', watch);
        child.stderr.on('data', watch);
        child.on('exit', (/** @type {number} */ code) => reject(new Error(`the server exited with code ${code}`)));
    });
}

let shots = 0;
/** @param {any} page @param {string} what */
async function shoot(page, what) {
    if (!SHOT) return;
    shots += 1;
    const file = SHOT.replace(/\.png$/i, '') + `-${shots}.png`;
    await page.screenshot({ path: file });
    console.log(`      captura ${shots} (${what}): ${file}`);
}

try {
    await startServer();
    browser = await chromium.launch({ channel: 'msedge', headless: !HEADED }).catch(() => chromium.launch({ headless: !HEADED }));
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    const page = await context.newPage();
    /** @type {string[]} */
    const problems = [];
    page.on('pageerror', (/** @type {any} */ e) => problems.push(`PAGEERROR ${e.message}`));
    page.on('console', (/** @type {any} */ m) => {
        if (m.type() === 'error' && !/Failed to load resource.*404/.test(m.text())) problems.push(`ERROR ${m.text().slice(0, 300)}`);
    });
    page.on('response', (/** @type {any} */ r) => { if (r.status() >= 500) problems.push(`HTTP ${r.status()} ${r.request().method()} ${r.url()}`); });
    await context.addInitScript(() => {
        try {
            window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,travel,prisoners,mesa,high,spell,pet,bill,town,rest,board');
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
            window.localStorage.setItem('sillytavern_gameSucesos', 'off');
            window.localStorage.setItem('sillytavern_gameStoryWindows', 'off');
        } catch { /* nada */ }
    });

    /** Espera a que se cumpla algo, sin dormir de más. */
    const until = async (/** @type {() => Promise<boolean>} */ test, ms = 30000) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (await test().catch(() => false)) return true;
            await page.waitForTimeout(300);
        }
        return false;
    };

    /** Hasta que SillyTavern ha arrancado del todo (ajustes leídos, `APP_READY` lanzado). */
    const appReady = () => until(() => page.evaluate(async () => (await import('/scripts/events.js')).eventSource.autoFireLastArgs.has('app_ready')), 90000);

    const boot = async () => {
        await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 90000 });
        const firstRun = page.locator('text=Welcome to SillyTavern!');
        if (await firstRun.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false)) {
            await page.click('.popup-button-ok');
        }
        await page.waitForFunction(() => Boolean(window.SillyTavern?.getContext?.()?.characters), null, { timeout: 90000 });
        await appReady();
        await page.waitForTimeout(1500);
    };
    await boot();

    // --- La partida, montada con las llamadas de SillyTavern: un gremio con su chat, una campaña
    // de su tablón con el suyo y un punto de retorno de hoy.
    const built = await page.evaluate(async () => {
        const st = await import('/script.js');
        const wi = await import('/scripts/world-info.js');
        const form = new FormData();
        form.append('ch_name', 'Posadero');
        form.append('file_name', 'Posadero');
        form.append('description', 'Narra el gremio.');
        form.append('first_mes', 'Bienvenidos al gremio.');
        const made = await fetch('/api/characters/create', { method: 'POST', headers: st.getRequestHeaders({ omitContentType: true }), body: form });
        const avatar = (await made.text()).trim();
        await st.getCharacters();
        const campaign = 'La Maldición de Strahd · Tessa';
        await wi.createNewWorldInfo('El Gremio', { interactive: false });
        await wi.saveWorldInfo('El Gremio', {
            entries: { 0: { uid: 0, comment: 'Tessa', key: ['Tessa'], content: 'Guerrera del gremio.' } },
            metadata: {
                displayName: 'El Gremio', narratorAvatar: avatar,
                hub: {
                    chat: { file: 'Posadero - gremio', avatar },
                    campaigns: { strahd: { worldName: campaign, chat: { file: 'Posadero - strahd', avatar }, finished: false, ending: '', day: 2 } },
                },
            },
        }, true);
        await wi.createNewWorldInfo(campaign, { interactive: false });
        await wi.saveWorldInfo(campaign, { entries: {}, metadata: { displayName: campaign, hubHome: 'El Gremio', hubCampaign: 'strahd' } }, true);
        const party = [{ id: 'tessa', name: 'Tessa', class: 'Guerrera', level: 2, hp: 18, maxHp: 22, gold: 40, items: [], equippedItems: {} }];
        const header = (/** @type {string} */ world, /** @type {any} */ meta) => ({
            user_name: 'Tú', character_name: 'Posadero', create_date: '2026-09-30@10h00m00s', chat_metadata: { world_info: world, ...meta },
        });
        const save = (/** @type {string} */ file, /** @type {any[]} */ chat) => fetch('/api/chats/save', {
            method: 'POST', headers: st.getRequestHeaders(), body: JSON.stringify({ avatar_url: avatar, file_name: file, chat, force: true }),
        }).then(r => r.ok);
        const ok1 = await save('Posadero - gremio', [
            header('El Gremio', {
                calendar: { day: 3, slotIndex: 1 }, currentLocation: 'Puerto Alba', party,
                checkpoints: [{ version: 2, id: 'cp_bodega', label: 'Antes de la bodega', savedAt: '2026-09-30T09:30:00.000Z', automatic: true, state: { calendar: { day: 3, slotIndex: 0 }, party, currentLocation: 'Puerto Alba' } }],
            }),
            { name: 'Posadero', is_user: false, mes: 'Bienvenidos al gremio.', send_date: '2026-09-30@10h00m00s' },
        ]);
        const ok2 = await save('Posadero - strahd', [
            header(campaign, { calendar: { day: 2, slotIndex: 0 }, currentLocation: 'Aldea de Barovia', party }),
            { name: 'Posadero', is_user: false, mes: 'La niebla os recibe.', send_date: '2026-09-30@10h05m00s' },
        ]);
        const index = st.characters.findIndex((/** @type {any} */ c) => c.avatar === avatar);
        await st.selectCharacterById(index);
        await st.openCharacterChat('Posadero - gremio');
        return { avatar, ok1, ok2, world: String(st.chat_metadata?.world_info ?? '') };
    });
    check('la partida de prueba: un gremio y una campaña de su tablón, abierta en el gremio', built.avatar === 'Posadero.png' && built.ok1 && built.ok2 && built.world === 'El Gremio', JSON.stringify(built));
    await page.waitForTimeout(1500);

    const day = () => page.evaluate(() => Number(window.SillyTavern.getContext().chatMetadata?.calendar?.day) || 0);
    const openWorld = () => page.evaluate(() => String(window.SillyTavern.getContext().chatMetadata?.world_info ?? ''));
    const worlds = () => page.evaluate(async () => [...(await import('/scripts/world-info.js')).world_names]);
    const slots = () => page.evaluate(async () => JSON.parse(JSON.stringify((await import('/scripts/extensions.js')).extension_settings.gameSlots?.['El Gremio'] ?? {})));
    const openScreen = async (/** @type {string} */ how) => {
        await page.evaluate(async (way) => {
            const saves = await import('/scripts/guardar-partida.js');
            window.__screen = way === 'title' ? saves.openGameSlots('El Gremio') : saves.openSaveGame();
        }, how);
        await page.waitForSelector('dialog.sv-dialog[open] .sv-slot', { timeout: 15000 });
        await page.waitForTimeout(300);
    };
    const screen = () => page.evaluate(() => ({
        title: document.querySelector('.sv-dialog .sv-title')?.textContent ?? '',
        sub: document.querySelector('.sv-dialog .sv-sub')?.textContent ?? '',
        status: (document.querySelector('.sv-dialog .sv-status')?.textContent ?? '').trim(),
        tone: /** @type {HTMLElement|null} */ (document.querySelector('.sv-dialog .sv-status'))?.dataset.tone ?? '',
        slots: [...document.querySelectorAll('.sv-dialog .sv-slot')].map(s => ({
            id: s.getAttribute('data-slot'),
            name: s.querySelector('.sv-name')?.textContent ?? '',
            line: s.querySelector('.sv-line')?.textContent ?? '',
            where: s.querySelector('.sv-where')?.textContent ?? '',
            hero: s.querySelector('.sv-hero')?.textContent ?? '',
            when: s.querySelector('.sv-when')?.textContent ?? '',
            save: Boolean(s.querySelector('.sv-save')),
            saveOn: Boolean(s.querySelector('.sv-save:not([disabled])')),
            loadOn: Boolean(s.querySelector('.sv-load:not([disabled])')),
            art: s.querySelector('.sv-thumb img')?.getAttribute('src') ?? '',
        })),
        points: [...document.querySelectorAll('.sv-dialog .sv-points > .sv-point-list .sv-point')].map(p => p.querySelector('.sv-point-label')?.textContent ?? ''),
        pointsShown: !(/** @type {HTMLElement|null} */ (document.querySelector('.sv-dialog .sv-points'))?.hidden),
        ask: /** @type {HTMLElement|null} */ (document.querySelector('.sv-dialog .sv-confirm'))?.hidden === false
            ? document.querySelector('.sv-dialog .sv-confirm-text')?.textContent ?? '' : '',
        open: Boolean(document.querySelector('dialog.sv-dialog[open]')),
        wide: document.documentElement.scrollWidth <= window.innerWidth + 1,
    }));
    const waitStatus = (/** @type {RegExp} */ pattern, ms = 30000) => until(async () => pattern.test((await screen()).status), ms);
    const clickSlot = async (/** @type {string} */ slot, /** @type {string} */ what) => {
        await page.locator(`.sv-dialog .sv-slot[data-slot="${slot}"] .${what}`).click();
        await page.waitForTimeout(250);
    };
    const closeScreen = async () => {
        await page.locator('.sv-dialog .sv-close').click();
        await until(async () => !(await screen()).open, 5000);
    };

    // 1. Con la partida abierta: las cinco ranuras, vacías, y el punto de hoy debajo.
    await openScreen('game');
    let seen = await screen();
    check('J15.2: la pantalla dice qué partida, qué día y dónde', seen.title === 'Guardar y cargar' && /El Gremio · Día 3 · Puerto Alba/.test(seen.sub), seen.sub);
    check('J15.2: al dormir, al empezar el día y las tres tuyas, en ese orden', JSON.stringify(seen.slots.map(s => s.id)) === '["dormir","auto","1","2","3"]', JSON.stringify(seen.slots.map(s => s.id)));
    check('las que se llenan solas no tienen «Guardar aquí»; las tuyas sí, y vacías', !seen.slots[0].save && !seen.slots[1].save && seen.slots[2].saveOn && seen.slots[2].line === 'Vacía.' && !seen.slots[2].loadOn);
    check('J15.2: los puntos de hoy, por debajo', seen.pointsShown && seen.points.includes('Antes de la bodega'), JSON.stringify(seen.points));
    check('sin barra de lado a lado', seen.wide);
    await shoot(page, 'guardar y cargar, vacía');

    // 2. Guardar en la ranura 1.
    await clickSlot('1', 'sv-save');
    const saved1 = await waitStatus(/Guardada en la ranura 1/);
    seen = await screen();
    const s1 = seen.slots.find(s => s.id === '1');
    check('J15.2: guardar en la ranura 1, y la tarjeta dice el día, el sitio y quién va', saved1 && s1?.line === 'Día 3 · Puerto Alba' && /Tessa \(Guerrera, nivel 2\)/.test(s1?.hero ?? '') && /Guardada hace un momento/.test(s1?.when ?? ''), JSON.stringify({ status: seen.status, s1 }));
    check('la tarjeta lleva el dibujo del sitio', /escenarios\/gremio\/puerto-alba/.test(s1?.art ?? ''), s1?.art);
    const file1 = (await slots())['1']?.file ?? '';
    const fileOk = await page.evaluate(async (url) => (await fetch(url.startsWith('/') ? url : `/${url}`, { cache: 'no-store' })).json().then(j => j.format === 'sillytavern-rpg-partida' && j.worlds.length === 2 && j.chats.length === 2).catch(() => false), file1);
    check('la ranura es una copia entera: los dos mundos y los dos chats, en un archivo tuyo', fileOk, file1);
    await shoot(page, 'guardada en la ranura 1');
    await closeScreen();

    // 3. Pasa el día (el automático) y se empieza otra campaña después de guardar.
    await page.evaluate(async () => {
        const st = await import('/script.js');
        const wi = await import('/scripts/world-info.js');
        st.chat_metadata.calendar = { day: 5, slotIndex: 0 };
        await st.saveMetadata();
        const avatar = 'Posadero.png';
        await wi.createNewWorldInfo('La Cripta · Tessa', { interactive: false });
        await wi.saveWorldInfo('La Cripta · Tessa', { entries: {}, metadata: { displayName: 'La Cripta · Tessa', hubHome: 'El Gremio' } }, true);
        await fetch('/api/chats/save', {
            method: 'POST', headers: st.getRequestHeaders(), body: JSON.stringify({
                avatar_url: avatar, file_name: 'Posadero - cripta', force: true,
                chat: [{ user_name: 'Tú', character_name: 'Posadero', create_date: '2026-09-30@11h00m00s', chat_metadata: { world_info: 'La Cripta · Tessa', calendar: { day: 1 } } }],
            }),
        });
        (await import('/scripts/guardar-partida.js')).onDayTurned({ day: 5 });
    });
    const autoSaved = await until(async () => (await slots()).auto?.day === 5, 20000);
    check('J15.2: al cambiar de día se guarda solo, en «Al empezar el día»', autoSaved, JSON.stringify(await slots()));

    // 4. Guardar en la 2, y otra vez en la 2: pregunta antes de pisarla.
    await openScreen('game');
    await clickSlot('2', 'sv-save');
    await waitStatus(/Guardada en la ranura 2/);
    await clickSlot('2', 'sv-save');
    seen = await screen();
    check('pisar una ranura tuya pregunta antes, en llano', /La ranura 2 ya tiene una partida: Día 5 · Puerto Alba\. Se cambia por la de ahora\. ¿Seguro\?/.test(seen.ask), seen.ask);
    await shoot(page, 'pregunta antes de pisar la ranura 2');
    await page.locator('.sv-dialog .sv-confirm-yes').click();
    check('«Sí, guardar encima» la guarda', await waitStatus(/Guardada en la ranura 2/));
    seen = await screen();
    check('la ranura automática ya tiene el día 5', /Día 5/.test(seen.slots[1].line), seen.slots[1].line);
    await closeScreen();

    // 5. J3.3: dormir en el gremio guarda (y el automático de esa noche sobra).
    const slept = await page.evaluate(async () => {
        const saves = await import('/scripts/guardar-partida.js');
        saves.onDayTurned({ day: 5 });
        return saves.onGuildSleep();
    });
    const sleepSlot = (await slots()).dormir;
    check('J3.3: dormir en el gremio guarda, en «Al dormir en el gremio»', slept === true && sleepSlot?.day === 5, JSON.stringify(sleepSlot));
    const sleepToast = await until(() => page.evaluate(() => [...document.querySelectorAll('#toast-container .toast')].some(t => /Dormís en el gremio/.test(t.textContent || ''))), 5000);
    check('y lo dice: «Dormís en el gremio. Partida guardada»', sleepToast);

    // 6. Los puntos de hoy: dejar uno aquí y volver a él.
    await openScreen('game');
    await page.locator('.sv-dialog .sv-point-new').click();
    const pointMade = await until(async () => (await screen()).points.some(p => /A mano, en Puerto Alba/.test(p)), 10000);
    check('«Dejar un punto aquí» lo pone entre los de hoy', pointMade, JSON.stringify((await screen()).points));
    const earlier = await page.evaluate(() => document.querySelector('.sv-dialog .sv-earlier summary')?.textContent ?? '');
    check('los de otros días, plegados debajo', /de otro día|de otros días/.test(earlier), earlier);
    await page.locator('.sv-dialog .sv-points > .sv-point-list .sv-point').first().locator('.sv-point-back').click();
    seen = await screen();
    check('volver a un punto pregunta y dice que la conversación se queda', /lo dicho en la conversación se queda/.test(seen.ask), seen.ask);
    await page.locator('.sv-dialog .sv-confirm-yes').click();
    check('y vuelve', await waitStatus(/Vuelta al punto/, 15000), (await screen()).status);
    await shoot(page, 'las ranuras llenas y los puntos de hoy');
    await closeScreen();

    // 7. Cerrar, y desde el título: las ranuras del gremio, cargar la 1.
    await page.evaluate(async () => { await (await import('/script.js')).closeCurrentChat(); });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.SillyTavern?.getContext?.()?.characters), null, { timeout: 90000 });
    // `characters` existe (vacío) antes de leer los ajustes: con la máquina cargada, las ranuras
    // (que viven en los ajustes) llegaban después de mirarlas. Se espera a que acabe de arrancar.
    await appReady();
    await page.waitForTimeout(1500);
    check('cerrado: no hay partida abierta', (await openWorld()) === '', await openWorld());
    await openScreen('title');
    seen = await screen();
    check('desde el título: solo cargar, sin guardar ni puntos', /Las ranuras de «El Gremio»/.test(seen.title) && seen.slots.every(s => !s.save) && !seen.pointsShown && seen.slots.filter(s => s.loadOn).length === 4, JSON.stringify(seen.slots.map(s => [s.id, s.loadOn])));
    await shoot(page, 'las ranuras desde el título');
    await clickSlot('1', 'sv-load');
    seen = await screen();
    check('cargar pregunta adónde se vuelve', /Vuelves al día 3, en Puerto Alba/.test(seen.ask), seen.ask);
    await page.locator('.sv-dialog .sv-confirm-yes').click();
    const loaded1 = await until(async () => (await openWorld()) === 'El Gremio' && (await day()) === 3, 30000);
    check('J15.2: cargar la ranura 1 abre el gremio en el día 3', loaded1, JSON.stringify({ world: await openWorld(), day: await day() }));
    const afterLoad = await worlds();
    check('lo que se empezó después de guardarla (La Cripta) ya no está', !afterLoad.includes('La Cripta · Tessa') && afterLoad.includes('La Maldición de Strahd · Tessa'), JSON.stringify(afterLoad));
    // Se cierra cuando acaba de abrir el chat, un poco después de que el mundo y el día ya estén.
    check('la pantalla se cierra al cargar', await until(async () => !(await screen()).open, 15000));

    // 8. Y volver: la ranura 2, el día 5 y La Cripta otra vez.
    await openScreen('game');
    await clickSlot('2', 'sv-load');
    await page.locator('.sv-dialog .sv-confirm-yes').click();
    const loaded2 = await until(async () => (await openWorld()) === 'El Gremio' && (await day()) === 5, 30000);
    check('J15.2: y volver a la 2: el día 5', loaded2, JSON.stringify({ world: await openWorld(), day: await day() }));
    check('con La Cripta de vuelta', (await worlds()).includes('La Cripta · Tessa'));
    // La pantalla se cierra cuando acaba de cargar (abre el chat un poco después de que el mundo y
    // el día ya estén). Antes se abría otra encima de la que seguía cargando, con los botones
    // quietos, y «Exportar» esperaba 30 s sin poder pulsarse: el «Timeout … "download"».
    check('y se cierra al acabar de cargar', await until(async () => !(await screen()).open, 30000));

    // 9. J15.6: exportar la partida entera.
    await openScreen('game');
    /** @type {Promise<any>} */
    const downloading = page.waitForEvent('download', { timeout: 30000 }).catch((/** @type {any} */ error) => error);
    await page.locator('.sv-dialog .sv-export').click();
    const download = await downloading;
    // Si no llega, que se sepa qué dijo la pantalla.
    if (download instanceof Error) throw new Error(`no llegó la descarga; la pantalla dice «${(await screen()).status}». ${problems.slice(-4).join(' | ')} (${download.message})`);
    const exportedPath = join(work, download.suggestedFilename());
    await download.saveAs(exportedPath);
    const exported = JSON.parse(readFileSync(exportedPath, 'utf8'));
    check('J15.6: exportar da un archivo «.partida.json»', /^partida-el-gremio-\d{4}-\d{2}-\d{2}\.partida\.json$/.test(download.suggestedFilename()), download.suggestedFilename());
    check('con el gremio, las campañas, los chats y el narrador con su cara', exported.worlds.length === 3 && exported.chats.length === 3
        && exported.narrators.length === 1 && exported.narrators[0].image?.length > 100, JSON.stringify({ w: exported.worlds.map((/** @type {any} */ w) => w.name), c: exported.chats.length, n: exported.narrators.length }));
    await waitStatus(/Exportada/);

    // 10. Importarla al lado: una copia, sin pisar nada, y jugarla.
    await page.setInputFiles('.sv-dialog .sv-file', exportedPath);
    const imported = await waitStatus(/Partida importada/, 45000);
    seen = await screen();
    check('J15.6: importarla la mete como «El Gremio (copia)»', imported && /«El Gremio \(copia\)»/.test(seen.status), seen.status);
    const both = await worlds();
    check('al lado de la de antes: sus mundos llevan un número', both.includes('El Gremio') && both.includes('El Gremio (2)') && both.includes('La Maldición de Strahd · Tessa (2)'), JSON.stringify(both));
    await shoot(page, 'importada, con «Jugarla ahora»');
    await page.locator('.sv-dialog .sv-play').click();
    const playing = await until(async () => (await openWorld()) === 'El Gremio (2)', 30000);
    const importedChat = await page.evaluate(() => String(window.SillyTavern.getContext().getCurrentChatId?.() ?? ''));
    check('«Jugarla ahora» abre la copia, en su chat', playing && /\(importada\)/.test(importedChat), JSON.stringify({ world: await openWorld(), importedChat }));
    const hubOk = await page.evaluate(async () => {
        const wi = await import('/scripts/world-info.js');
        const data = await wi.loadWorldInfo('El Gremio (2)');
        const campaign = await wi.loadWorldInfo('La Maldición de Strahd · Tessa (2)');
        return data?.metadata?.hub?.campaigns?.strahd?.worldName === 'La Maldición de Strahd · Tessa (2)' && campaign?.metadata?.hubHome === 'El Gremio (2)';
    });
    check('el gremio copiado sabe dónde están sus campañas, y cada campaña de qué gremio sale', hubOk);

    // 11. Un archivo que no es una partida: se dice por qué, y no escribe nada.
    const bogus = join(work, 'no-es-partida.json');
    writeFileSync(bogus, '{"hola": 1}');
    await openScreen('game');
    await page.setInputFiles('.sv-dialog .sv-file', bogus);
    await waitStatus(/no se puede importar/, 15000);
    seen = await screen();
    check('un archivo que no es una partida se rechaza en llano', seen.tone === 'bad' && /no es una partida del juego/.test(seen.status), seen.status);
    await shoot(page, 'un archivo que no es una partida');
    await closeScreen();

    // 12. En el móvil: todo en una columna, sin barra de lado a lado.
    await page.setViewportSize({ width: 390, height: 844 });
    await openScreen('game');
    seen = await screen();
    const tapSize = await page.evaluate(() => Math.min(...[...document.querySelectorAll('.sv-dialog .sv-slot .sv-btn')].map(b => b.getBoundingClientRect().height)));
    check('J20: en el móvil cabe, y los botones son de dedo', seen.wide && tapSize >= 40, `alto mínimo ${tapSize}`);
    await shoot(page, 'en el móvil');
    await closeScreen();

    const real = problems.filter(p => !/favicon|thumbnail|Failed to fetch.*extensions|tokenizer/i.test(p));
    check('sin errores en la consola', real.length === 0, real.slice(0, 8).join('\n        '));
} catch (error) {
    failures++;
    console.log(`FAIL  el recorrido se ha roto: ${String(/** @type {any} */ (error)?.stack ?? error)}`);
} finally {
    await browser?.close().catch(() => {});
    server?.kill();
    await new Promise(resolve => setTimeout(resolve, 800));
    for (const dir of [dataRoot, work]) {
        try {
            rmSync(dir, { recursive: true, force: true });
        } catch { /* Windows a veces lo tiene cogido un momento */ }
    }
    console.log(failures === 0 ? '\nTodo bien.' : `\n${failures} fallo(s).`);
    process.exit(failures === 0 ? 0 : 1);
}

