#!/usr/bin/env node
/**
 * J5.9 de ROADMAP_SIN_CONEXION: el taller de campañas del gremio, de verdad, en el navegador.
 * Contra un servidor propio con un `--dataRoot` temporal, como `e2e-importar-campana.mjs`:
 *
 *   título → Jugar sin conexión → tu personaje → saltar la prueba → el tablón: «Taller de
 *   campañas» al lado de «Añadir una campaña» → el taller →
 *   una ronda rota: dice el archivo, la línea, la línea tal cual y el arreglo →
 *   las rondas de 1387 (wiki/guiones/1387, con su README y sus dudas, que no se leen): se
 *   convierten aquí, con el informe y «Copiar la lista para tu Gem» →
 *   lo que pone el juego, y el paquete relleno para descargar →
 *   la simulación de las peleas, tablero a tablero, sin helar la ventana →
 *   un tablero sobre un mapa en imagen, con el editor de mapas →
 *   el guion en Word: exportarlo, cambiar una línea e importarlo →
 *   «Añadir al tablón» con otro nombre → volver al tablón: su tarjeta → empezarla.
 *
 * Uso:
 *   node tools/e2e-taller.mjs                         # sin ventana
 *   node tools/e2e-taller.mjs --headed                # mirándolo
 *   node tools/e2e-taller.mjs --port 8531 --captura <carpeta>
 */

/* global window, document, HTMLElement */

import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, readdirSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Buffer } from 'node:buffer';
import { enElGremio } from './e2e-guiado.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8531;
const BASE = `http://127.0.0.1:${PORT}`;
const HEADED = process.argv.includes('--headed');
const SHOTS = argAfter('--captura');
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const require = createRequire(join(ROOT, 'tests/package.json'));
const { chromium } = require('@playwright/test');

/** Con otro nombre, para que salga al lado de la 1387 del juego. */
const NAME = '1387 (taller)';
const ID = 'tuya-1387-taller';
const GUION = join(ROOT, 'wiki/guiones/1387');

let failures = 0;
const check = (/** @type {string} */ name, /** @type {boolean} */ ok, detail = '') => {
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        -> ${detail}` : ''}`);
};

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-taller-'));
// El mapa en imagen de la prueba del editor (dos salas y una puerta, 12 × 8 casillas).
const mapFile = join(dataRoot, 'mazmorra.png');
spawnSync(process.execPath, [join(ROOT, 'tools/e2e-mapa-imagen.mjs'), '--png', mapFile], { cwd: ROOT, encoding: 'utf8' });

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
 * @param {any} target
 * @param {string} pick
 * @param {string} wanted
 */
async function pickHeroCard(target, pick, wanted) {
    await target.locator(`.hc-root .hc-card[data-pick="${pick}"] .hc-pick`).click();
    await target.waitForSelector('.hc-picker .hc-option', { timeout: 15000 });
    const values = await target.evaluate(() => [...document.querySelectorAll('.hc-picker .hc-option')].map(o => o.getAttribute('data-value') || ''));
    const chosen = values.find(v => v.toLowerCase().includes(wanted.toLowerCase())) ?? values[0];
    await target.locator(`.hc-picker .hc-option[data-value="${chosen}"]`).first().click();
    await target.waitForSelector('.hc-picker', { state: 'detached', timeout: 15000 }).catch(() => {});
    await target.waitForTimeout(200);
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
            window.localStorage.setItem('sillytavern_gameStoryWindows', 'off');
        } catch { /* nada */ }
    });
    const shot = async (/** @type {string} */ name) => {
        if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`) });
    };
    /** Una captura de la ventana del taller entera, aunque no quepa en la pantalla. */
    const shotWorkshop = async (/** @type {string} */ name, /** @type {string} */ selector = '.tc-root') => {
        if (!SHOTS) return;
        await page.locator(selector).first().scrollIntoViewIfNeeded().catch(() => {});
        await page.locator(selector).first().screenshot({ path: join(SHOTS, `${name}.png`) }).catch(async () => shot(name));
    };
    const state = () => page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const party = (await import('/scripts/party.js')).getPartyMembersSnapshot();
        const meta = ctx.chatMetadata ?? {};
        return { world: String(meta.world_info ?? ''), party: party.map((/** @type {any} */ m) => ({ name: m.name, world: m.worldName })) };
    });
    const clickChip = (/** @type {RegExp} */ pattern) => page.evaluate((source) => {
        const chip = [...document.querySelectorAll('#game-shell .gs-chip-action')].find(b => new RegExp(source).test(b.textContent || ''));
        if (chip instanceof HTMLElement) chip.click();
        return Boolean(chip);
    }, pattern.source);
    const chatHas = (/** @type {RegExp} */ pattern) => page.evaluate((source) => (window.SillyTavern.getContext().chat || [])
        .some((/** @type {any} */ m) => new RegExp(source).test(String(m.extra?.display_text || m.mes || ''))), pattern.source);
    const until = async (/** @type {() => Promise<boolean>} */ test, ms = 30000) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (await test().catch(() => false)) return true;
            await page.waitForTimeout(300);
        }
        return false;
    };
    const dropToasts = () => page.evaluate(() => document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));
    const text = (/** @type {string} */ selector) => page.evaluate((s) => (document.querySelector(s)?.textContent || '').replace(/\s+/g, ' ').trim(), selector);
    /**
     * Elegir archivos en el taller, como quien juega: «Elegir los archivos» y la ventana de archivos.
     *
     * @param {Array<string|{name: string, mimeType: string, buffer: Buffer}>} files
     */
    const upload = async (files) => {
        const before = await text('.tc-root .tc-status');
        const [chooser] = await Promise.all([
            page.waitForEvent('filechooser', { timeout: 10000 }),
            page.locator('.tc-root .tc-choose').click(),
        ]);
        await chooser.setFiles(files);
        await until(async () => (await text('.tc-root .tc-status')) !== before && !(await page.locator('.tc-root .tc-choose').isDisabled()), 60000);
        await page.waitForTimeout(300);
    };

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    const firstRun = page.locator('text=Welcome to SillyTavern!');
    if (await firstRun.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) await page.click('.popup-button-ok');
    await page.waitForSelector('#game-shell', { timeout: 90000 });

    // 1. Al gremio, con la prueba saltada.
    const offline = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Jugar sin conexión' });
    await until(async () => await offline.count() === 1, 30000);
    await offline.click();
    await page.waitForSelector('.hc-root', { timeout: 120000 });
    await page.fill('.hc-root .hc-name', 'Iria');
    await pickHeroCard(page, 'race', 'Humano');
    await pickHeroCard(page, 'class', 'Guerrero');
    await page.locator('.hc-root .hc-enter').click();
    const inHub = await until(async () => /Gremio/.test((await state()).world) && (await state()).party.length === 1, 60000);
    await until(() => chatHas(/Al ladrón/), 20000);
    await page.waitForTimeout(800);
    // La prueba (el ratero del muelle) no es lo que se mira aquí: se salta con su orden, la misma
    // que la ficha «Saltar la prueba».
    const slash = (/** @type {string} */ command) => page.evaluate((c) => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions(c).catch(() => '');
    }, command);
    await slash('/saltar-prueba');
    await page.waitForSelector('.popup:has-text("¿Saltar la prueba?")', { timeout: 10000 }).catch(() => {});
    await page.locator('.popup-button-ok:visible').first().click({ timeout: 5000 }).catch(() => {});
    // Saltada, el tablón ya se ofrece (D-J28: en la prueba está escondido).
    const allChips = () => page.evaluate(async () => (await import('/scripts/party/shell.js')).buildShellChips(Infinity).map((/** @type {any} */ c) => String(c.label)));
    const skipped = await until(async () => (await allChips()).includes('Tablón de campañas'), 15000);
    check('en el gremio con Iria, y la prueba saltada', inHub && skipped, JSON.stringify({ ...(await state()), chips: await allChips() }));

    // 2. El tablón: «Taller de campañas», al lado de «Añadir una campaña».
    await page.waitForTimeout(800);
    await dropToasts();
    // D-J62: con el modo guiado, el tablón está en la Casa del Gremio.
    if (!await clickChip(/Tablón de campañas/) && !await enElGremio(page, 'hub-board')) await slash('/campanas');
    const opened = await page.waitForSelector('.hb-root [data-campaign-workshop]', { timeout: 15000 }).then(() => true).catch(() => false);
    const order = await page.evaluate(() => [...document.querySelectorAll('.hb-root .hb-grid > *')].map(c => (c.hasAttribute('data-campaign-add') ? 'añadir' : c.hasAttribute('data-campaign-workshop') ? 'taller' : 'otra')));
    check('el tablón tiene «Taller de campañas», justo detrás de «Añadir una campaña»',
        opened && order.indexOf('taller') === order.indexOf('añadir') + 1, JSON.stringify(order));
    await page.locator('.hb-root [data-campaign-workshop]').scrollIntoViewIfNeeded().catch(() => {});
    await shot('1-tablon');

    // 3. El taller.
    await page.locator('.hb-root [data-campaign-workshop]').click();
    const workshop = await page.waitForSelector('.tc-root', { timeout: 15000 }).then(() => true).catch(() => false);
    check('se abre el taller, con su primer paso: subir el guion', workshop && /Sube el guion/.test(await text('.tc-root [data-step="subir"]')), await text('.tc-root .vt-head'));

    // 4. Una ronda rota: el archivo, la línea, la línea tal cual y el arreglo.
    const broken = ['# Ronda 1', '', 'mundo:', '  id: roto', '  nombre: Roto', '', 'pnj:', '  id: arthur', '  nombre: Arthur: el Doc', '  voz: grave', ''].join('\n');
    await upload([{ name: 'ronda-1.md', mimeType: 'text/markdown', buffer: Buffer.from(broken, 'utf8') }]);
    const brokenSaid = await text('.tc-root .tc-status');
    check('una ronda rota: «ronda-1.md, línea 9», qué pasa, la línea y el arreglo, y no sigue',
        /1 bloque no se puede leer/.test(brokenSaid) && /ronda-1\.md, línea 9/.test(brokenSaid) && /dos puntos/.test(brokenSaid)
        && /nombre: Arthur: el Doc/.test(brokenSaid) && /Arreglo: Pon ese texto entre comillas/.test(brokenSaid)
        && await page.locator('.tc-root [data-step="informe"]').isHidden(), brokenSaid);
    await shotWorkshop('2-ronda-rota', '.tc-root [data-step="subir"]');

    // 4b. Las rondas en un .zip, como salen de una carpeta comprimida: se abren aquí.
    const { zipSync: zipFiles } = require('fflate');
    const zipped = zipFiles(Object.fromEntries(readdirSync(GUION).map(name => [`1387/${name}`, readFileSync(join(GUION, name))])));
    await upload([{ name: 'guion-1387.zip', mimeType: 'application/zip', buffer: Buffer.from(zipped) }]);
    const fromZip = await text('.tc-root .tc-status');
    check('las rondas en un .zip también se leen', /Leídas 12 rondas/.test(fromZip) && /Convertido: «El valle de Vane»/.test(fromZip), fromZip.slice(0, 200));

    // 5. Las rondas de 1387, tal cual (con el README y las dudas, que no son rondas).
    const files = readdirSync(GUION).map(name => join(GUION, name));
    await upload(files);
    const status = await text('.tc-root .tc-status');
    check('las 12 rondas de 1387 se convierten en el navegador; el README y las dudas no se leen',
        /12 rondas del guion; no se leen: (DUDAS_1387\.md, README\.md|README\.md, DUDAS_1387\.md)/.test(status)
        && /Leídas 12 rondas: ronda-1\.md, ronda-2\.md/.test(status) && /ronda-12-claude-decisiones\.md/.test(status)
        && /hito: 18/.test(status) && /Convertido: «El valle de Vane»/.test(status), status.slice(0, 400));
    const report = await page.waitForSelector('.tc-root [data-step="informe"] .hb-check', { timeout: 60000 }).then(() => true).catch(() => false);
    const reportText = await text('.tc-root [data-step="informe"]');
    check('el informe: si se puede jugar, cuántas localizaciones y tableros, y lo que le falta',
        report && /localizaciones/.test(reportText) && /tableros/.test(reportText) && /Lo que trae, contado/.test(reportText), reportText.slice(0, 400));
    await shotWorkshop('3-informe', '.tc-root [data-step="informe"]');
    await page.locator('.tc-root .tc-gem-copy').click();
    await until(() => page.evaluate(() => /** @type {HTMLTextAreaElement|null} */ (document.querySelector('.tc-root .tc-gem-text'))?.value.length > 0), 5000);
    const gemText = await page.evaluate(() => /** @type {HTMLTextAreaElement|null} */ (document.querySelector('.tc-root .tc-gem-text'))?.value ?? '');
    check('«Copiar la lista para tu Gem»: pide una ronda nueva del guion, con lo que falta',
        /^Hola\. Al pasar el guion de «El valle de Vane» por el taller del juego sale esto\. Escribe una ronda nueva del guion/.test(gemText) && /Añade:|Arregla:|Lo que se quedaría a medias:/.test(gemText),
        gemText.slice(0, 300));

    // 6. Lo que pone el juego, y el paquete relleno.
    const fill = await text('.tc-root [data-step="huecos"]');
    check('rellenar los huecos: lo que pone el juego, y la campaña rellena para descargar',
        /Rellenar los huecos/.test(fill) && (/el juego pone/.test(fill) || /No le falta nada/.test(fill))
        && await page.locator('.tc-root .tc-download').count() === 1, fill.slice(0, 300));
    const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 10000 }).catch(() => null),
        page.locator('.tc-root .tc-download').click(),
    ]);
    check('la descarga es el paquete de 1387 («El valle de Vane») relleno', Boolean(download) && /^el-valle-de-vane\.pack\.json$/.test(download?.suggestedFilename() ?? ''), download?.suggestedFilename() ?? 'sin descarga');

    // 7. La simulación, tablero a tablero, sin helar la ventana: los fotogramas siguen corriendo.
    await page.evaluate(() => {
        /** @type {any} */ (window).__frames = 0;
        const tick = () => { /** @type {any} */ (window).__frames++; window.requestAnimationFrame(tick); };
        window.requestAnimationFrame(tick);
    });
    const started = Date.now();
    await page.locator('.tc-root .tc-sim-run').click();
    const simulated = await until(() => page.evaluate(() => document.querySelectorAll('.tc-root .tc-sim').length > 0), 120000);
    const took = Date.now() - started;
    const frames = await page.evaluate(() => /** @type {any} */ (window).__frames);
    const sims = await page.evaluate(() => [...document.querySelectorAll('.tc-root .tc-sim')].map(s => ({
        board: s.querySelector('.tc-sim-name')?.textContent || '',
        verdict: s.getAttribute('data-verdict') || '',
        said: s.querySelector('.tc-sim-said')?.textContent || '',
    })));
    const summary = await text('.tc-root .tc-sim-summary');
    check('la simulación: una fila por pelea, con su veredicto, para el nivel de su tablero y un grupo de cuatro',
        simulated && sims.length === 16 && sims.every(s => s.verdict && /con cuatro de nivel \d+, se gana \d+ de cada 100/.test(s.said))
        && /^16 peleas: /.test(summary), `${summary} · ${JSON.stringify(sims.slice(0, 3))}`);
    check('y la ventana sigue viva mientras cuenta (los fotogramas siguen)', frames >= 5, `${frames} fotogramas en ${took} ms`);
    console.log(`        ${summary}`);
    for (const s of sims) console.log(`        ${s.verdict.padEnd(12)} ${s.board}`);
    await shotWorkshop('4-peleas', '.tc-root [data-step="peleas"]');
    // En el móvil: los pasos en una columna, sin salirse por los lados.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    const overflow = await page.evaluate(() => {
        const root = document.querySelector('.tc-root');
        return root ? root.scrollWidth - root.clientWidth : -1;
    });
    await page.locator('.tc-root [data-step="peleas"] .tc-sim-run').scrollIntoViewIfNeeded().catch(() => {});
    await shot('4b-movil');
    await page.setViewportSize({ width: 1400, height: 950 });
    await page.waitForTimeout(300);
    check('en el móvil, el taller no se sale por los lados', overflow === 0, `${overflow} px de más`);

    // 8. Un tablero sobre un mapa en imagen: el editor de mapas de siempre.
    const boardsListed = await page.locator('.tc-root .tc-map-board option').count();
    const firstBoard = await page.locator('.tc-root .tc-map-board option').first().textContent();
    const [mapChooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 10000 }),
        page.locator('.tc-root .tc-map-open').click(),
    ]);
    await mapChooser.setFiles(mapFile);
    const editor = await page.waitForSelector('.mie-root', { timeout: 30000 }).then(() => true).catch(() => false);
    await page.waitForTimeout(1500);
    await shot('5-editor-de-mapas');
    await page.locator('.popup:has(.mie-root) .popup-button-ok').click({ timeout: 10000 }).catch(() => {});
    await page.waitForSelector('.mie-root', { state: 'detached', timeout: 30000 }).catch(() => {});
    const onMap = await until(async () => /va ahora sobre el dibujo \(12 × 8 casillas\)\. El juego pone/.test(await text('.tc-root .tc-map-said')), 60000);
    check('el editor de mapas se abre con el tablero elegido, y el tablero pasa a jugarse sobre el dibujo (12 × 8)',
        boardsListed >= 14 && editor && onMap, `${boardsListed} tableros; el primero: ${firstBoard}; ${await text('.tc-root .tc-map-said')}`);

    // 8b. J5.7 y J5.8: el guion en Word. Se exporta, se cambia una línea (como en Word) y se importa.
    const [wordDownload] = await Promise.all([
        page.waitForEvent('download', { timeout: 20000 }).catch(() => null),
        page.locator('.tc-root .tc-word-export').click(),
    ]);
    const docxPath = join(dataRoot, 'guion.docx');
    if (wordDownload) await wordDownload.saveAs(docxPath);
    const exported = await text('.tc-root .tc-word-said');
    check('«Exportar el guion»: un .docx con las líneas de la campaña',
        Boolean(wordDownload) && /^el-valle-de-vane-guion\.docx$/.test(wordDownload?.suggestedFilename() ?? '') && /Exportado: «El valle de Vane», \d+ líneas/.test(exported),
        `${wordDownload?.suggestedFilename()} · ${exported}`);
    // La línea que se cambia: la misma que elige la prueba unitaria, del mismo paquete (el conversor da lo mismo aquí que en el navegador).
    const jsyaml = require('js-yaml');
    const { unzipSync, zipSync, strFromU8, strToU8 } = require('fflate');
    const engine = (/** @type {string} */ path) => import(pathToFileURL(join(ROOT, 'public/scripts/game-engine', path)).href);
    const [{ convertGuion, isRoundFile }, { buildScript }, { xmlText }] = await Promise.all([engine('campaign/guion-pack.js'), engine('campaign/script-doc.js'), engine('campaign/script-docx.js')]);
    const library = JSON.parse(readFileSync(join(ROOT, 'public/compendio/habilidades.json'), 'utf8'));
    const converted = convertGuion(readdirSync(GUION).filter(isRoundFile).map(name => ({ name, text: readFileSync(join(GUION, name), 'utf8') })), { parseYaml: jsyaml.load, abilityRows: library.rows ?? [] });
    const parts = wordDownload ? unzipSync(readFileSync(docxPath)) : {};
    const xml = parts['word/document.xml'] ? strFromU8(parts['word/document.xml']) : '';
    const target = buildScript(converted.pack).blocks.find((/** @type {any} */ b) => b.id && b.src?.doc === 'pack' && String(b.text ?? '').length > 20 && xml.includes(xmlText(String(b.text))));
    const NEW_LINE = 'Una línea corregida en el Word del taller.';
    parts['word/document.xml'] = strToU8(xml.replace(xmlText(String(target?.text ?? '')), xmlText(NEW_LINE)));
    const fixedPath = join(dataRoot, 'guion-corregido.docx');
    writeFileSync(fixedPath, zipSync(parts, { level: 6 }));
    const [wordChooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 10000 }),
        page.locator('.tc-root .tc-word-import').click(),
    ]);
    await wordChooser.setFiles(fixedPath);
    const imported = await until(async () => /«guion-corregido\.docx»: 1 línea cambiada/.test(await text('.tc-root .tc-word-said')), 60000);
    const importSaid = await text('.tc-root .tc-word-said');
    check('«Importar el guion»: cambia solo la línea tocada, y lo dice', imported && importSaid.includes(NEW_LINE), importSaid.slice(0, 400));
    // 8c. J5.10: lo corregido sale también como una ronda del guion, la siguiente a la última.
    const [roundDownload] = await Promise.all([
        page.waitForEvent('download', { timeout: 20000 }).catch(() => null),
        page.locator('.tc-root .tc-word-round').click({ timeout: 10000 }).catch(() => {}),
    ]);
    const roundPath = join(dataRoot, 'ronda-correcciones.md');
    if (roundDownload) await roundDownload.saveAs(roundPath);
    const roundText = roundDownload ? readFileSync(roundPath, 'utf8') : '';
    const roundName = roundDownload?.suggestedFilename() ?? '';
    const again = roundText ? convertGuion([...readdirSync(GUION).filter(isRoundFile).map(name => ({ name, text: readFileSync(join(GUION, name), 'utf8') })), { name: roundName, text: roundText }], { parseYaml: jsyaml.load, abilityRows: library.rows ?? [] }) : null;
    const landed = (target?.src?.path ?? []).reduce((/** @type {any} */ at, /** @type {any} */ step) => at?.[step], again?.pack);
    const roundSaid = await text('.tc-root .tc-round-said');
    check('«Descargar la ronda de correcciones (.md)»: ronda-13-correcciones.md, y con ella las rondas dan la línea corregida',
        roundName === 'ronda-13-correcciones.md' && roundText.includes(NEW_LINE) && again?.stage === 'hecho' && landed === NEW_LINE
            && /^ronda-13-correcciones\.md: 1 corrección en 1 bloque\./.test(roundSaid),
        `${roundName} · ${roundSaid} · ${roundText.split('\n').slice(0, 14).join(' / ')}`);
    await shotWorkshop('5b-word', '.tc-root [data-step="word"]');

    // 9. Añadir al tablón con otro nombre.
    await page.fill('.tc-root .tc-name', NAME);
    await page.locator('.tc-root .tc-add').click();
    const addedOk = await until(async () => /Añadida al tablón: «1387 \(taller\)»/.test(await text('.tc-root .tc-add-said')), 60000);
    check('«Añadir al tablón» con otro nombre: «Añadida al tablón: «1387 (taller)»»', addedOk, await text('.tc-root .tc-add-said'));
    await shotWorkshop('6-anadida', '.tc-root [data-step="tablon"]');
    await page.locator('.tc-root .tc-back').click();
    await page.waitForSelector('.tc-root', { state: 'detached', timeout: 10000 }).catch(() => {});
    const tile = await page.waitForSelector(`.hb-root [data-campaign="${ID}"]`, { timeout: 10000 }).then(() => true).catch(() => false);
    const tiles = await page.evaluate(() => [...document.querySelectorAll('.hb-root [data-campaign]')].map(c => c.getAttribute('data-campaign')));
    check('de vuelta en el tablón: su tarjeta, al lado de la 1387 del juego', tile && tiles.includes('1387') && tiles.includes(ID), JSON.stringify(tiles));
    const stored = await page.evaluate(async (id) => {
        const response = await fetch(`/user/files/campana-${id}.pack.json`, { cache: 'no-cache' });
        const pack = response.ok ? await response.json() : null;
        return { status: response.status, name: pack?.world?.name ?? '', image: (pack?.boards ?? []).filter((/** @type {any} */ b) => b.image).length, word: JSON.stringify(pack ?? {}).includes('Una línea corregida en el Word del taller.') };
    }, ID);
    check('el paquete guardado se llama «1387 (taller)», lleva el tablero sobre el dibujo y la línea corregida en Word',
        stored.status === 200 && stored.name === NAME && stored.image === 1 && stored.word, JSON.stringify(stored));
    await shot('7-tablon-con-la-nueva');

    // 10. Empezarla.
    await page.locator(`.hb-root [data-campaign="${ID}"]`).click();
    const begun = await until(async () => (await state()).world.includes(NAME), 120000);
    await page.waitForTimeout(2500);
    const now = await state();
    check('empezarla abre su mundo, con Iria dentro', begun && now.party.some(m => m.name === 'Iria' && m.world === now.world), JSON.stringify(now));
    const places = await page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const data = await (await import('/scripts/world-info.js')).loadWorldInfo(String(ctx.chatMetadata?.world_info || ''));
        return (data?.metadata?.locationMaps ?? []).map((/** @type {any} */ l) => l.name);
    });
    // Las siete a la vista; las escondidas (el campamento furtivo…) salen al jugar.
    check('con las localizaciones de 1387', places.length >= 7 && places[0] === 'El Pueblo de Barro', JSON.stringify(places));
    await dropToasts();
    await shot('8-campana-empezada');

    check('sin errores en la consola', problems.length === 0, problems.slice(0, 5).join('\n        '));
} catch (error) {
    failures++;
    console.log(`FAIL  la prueba se rompió: ${/** @type {any} */ (error)?.stack || error}`);
    if (page && SHOTS) await page.screenshot({ path: join(SHOTS, 'rota.png') }).catch(() => {});
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
