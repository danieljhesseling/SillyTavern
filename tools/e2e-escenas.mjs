#!/usr/bin/env node
/**
 * Las escenas del hilo, jugadas (J9.2), en un navegador de verdad y sin servidor: la página se
 * sirve desde `public/` a mano (`page.route`), se leen los hitos de los paquetes con
 * `milestoneScene` y se juegan con `openPlotScene` como jugaría alguien, con el ratón, el dedo
 * y el teclado. Lo que cambian las decisiones se aplica con `applySceneEffects`.
 *
 *   Puerto Alba, a una guerrera: el muelle empieza con el narrador (sin retrato ni placa), Tomás
 *   grita con su cara de enfadado, la decisión sale como opciones, elegir «Yo me encargo» hace
 *   que os mire mejor y Tomás se alegra. En la prueba, la tirada de pedir paga da oro.
 *   1387: Garret pide oro que no tienes (sale cerrado), «Saltar» se para en la decisión, y en el
 *   precio del escape decides cómo entras y la escena sigue con la charla de Giles.
 *   Strahd: Ismark con su cara, y nada de «propio:».
 *   Y el muelle en un móvil: se sigue tocando la escena.
 *
 * Uso:
 *   node tools/e2e-escenas.mjs                                  # sin ventana
 *   node tools/e2e-escenas.mjs --headed
 *   node tools/e2e-escenas.mjs --port 8160 --captura escena.png  # escena-1.png, escena-2.png…
 *
 * El puerto solo da nombre al origen de la página: no se abre ningún servidor.
 */

/* global window, document */

import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8160;
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

let shots = 0;
/** @param {any} page @param {string} what */
async function shoot(page, what) {
    if (!SHOT) return;
    shots += 1;
    const file = SHOT.replace(/\.png$/i, '') + `-${shots}.png`;
    await page.screenshot({ path: file });
    console.log(`      captura ${shots} (${what}): ${file}`);
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };

const PAGE = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Escenas</title>
<link rel="stylesheet" href="css/fontawesome.min.css"><link rel="stylesheet" href="css/solid.min.css">
<link rel="stylesheet" href="css/game-shell.css"><link rel="stylesheet" href="css/quedadas.css"><link rel="stylesheet" href="css/dialogos.css"><link rel="stylesheet" href="css/escenas.css">
<style>body{margin:0;min-height:100vh;background:#12100e;color:#e8e0d0;font-family:system-ui,sans-serif}</style>
</head><body>
<script type="module">
import { readPlot } from './scripts/game-engine/campaign/plot.js';
import { milestoneScene, applySceneEffects } from './scripts/game-engine/campaign/plot-scenes.js';
import { openPlotScene } from './scripts/game-engine/ui/plot-scene.js';
window.harness = { readPlot, milestoneScene, applySceneEffects, openPlotScene };
window.harnessReady = true;
</script>
</body></html>`;

/**
 * Abrir la escena de un hito, con una partida que las decisiones cambian de verdad.
 *
 * @param {any} page
 * @param {{pack: string, milestone: string, hero: any, game: any, done?: string[]}} input
 */
async function openScene(page, input) {
    await page.evaluate(async ({ pack, milestone, hero, game, done }) => {
        const data = await (await fetch(`mundos/${pack}.pack.json`)).json();
        const plot = window.harness.readPlot(data.plot);
        const found = plot.milestones.find((/** @type {any} */ m) => m.id === milestone);
        window.scene = window.harness.milestoneScene(found, { dialogues: data.dialogues, hero, party: [hero], state: { done: done ?? [] } });
        window.game = { ...game, rumors: data.rumors ?? [] };
        window.applied = [];
        window.nextRoll = 10;
        window.sceneResult = null;
        window.harness.openPlotScene({
            scene: window.scene,
            hero,
            pack,
            getWorld: (/** @type {string} */ who) => ({
                attitude: window.game.attitudes?.values?.[who] ?? 0,
                gold: window.game.gold, items: window.game.items, party: [hero], open: [milestone], done: done ?? [],
            }),
            rollD20: () => window.nextRoll,
            applyEffects: (/** @type {any[]} */ effects) => {
                window.applied.push(...effects);
                const out = window.harness.applySceneEffects(effects, window.game);
                window.game = { ...window.game, attitudes: out.attitudes, rumorsHeard: out.rumorsHeard, rumorsHeardOn: out.rumorsHeardOn, gold: out.gold, items: out.items };
                return out.notes;
            },
        }).then((/** @type {any} */ result) => {
            window.sceneResult = { finished: result.finished, choices: result.choices, transcript: result.transcript, dialogue: result.dialogue ? { ended: result.dialogue.ended } : null };
        });
    }, input);
    await page.waitForSelector('.ps-dialog .qd-chip', { timeout: 10000 });
    await page.waitForTimeout(250);
}

/** Lo que se ve en la escena. @param {any} page */
function readScene(page) {
    return page.evaluate(() => {
        const q = (/** @type {string} */ s) => document.querySelector(s);
        const holder = /** @type {HTMLElement|null} */ (q('.ps-dialog .qd-portrait'));
        const image = /** @type {HTMLImageElement|null} */ (q('.ps-dialog .qd-portrait img'));
        const plate = /** @type {HTMLElement|null} */ (q('.ps-dialog .qd-nameplate'));
        return {
            open: Boolean(q('dialog.ps-dialog[open]')),
            beat: /** @type {HTMLElement|null} */ (q('.ps-dialog .ps-root'))?.dataset.beat ?? '',
            step: q('.ps-dialog .qd-step')?.textContent ?? '',
            plate: plate && !plate.hidden ? plate.textContent ?? '' : '',
            portraitShown: Boolean(holder && !holder.hidden && window.getComputedStyle(holder).display !== 'none'),
            portrait: image?.getAttribute('src') ?? '',
            loaded: Boolean(image && image.complete && image.naturalWidth > 0),
            mood: holder?.dataset.mood ?? '',
            lines: [...document.querySelectorAll('.ps-dialog .qd-line')].map(l => ({ cls: l.className, text: l.textContent ?? '' })),
            options: [...document.querySelectorAll('.ps-dialog .ps-option')].map(o => ({
                id: o.getAttribute('data-option'),
                text: o.querySelector('.dw-said')?.textContent ?? '',
                key: o.querySelector('.qd-key')?.textContent ?? '',
                check: o.querySelector('.dw-check')?.textContent?.trim() ?? '',
                why: o.querySelector('.dw-why')?.textContent?.trim() ?? '',
                locked: o.classList.contains('dw-locked'),
            })),
            next: q('.ps-dialog .ps-next, .ps-dialog .ps-finish')?.textContent ?? '',
            skip: Boolean(q('.ps-dialog .ps-skip')),
        };
    });
}

/** Seguir tocando la escena (no la ficha): como con el dedo. @param {any} page */
async function tapScene(page) {
    await page.locator('.ps-dialog .qd-text').click();
    await page.waitForTimeout(150);
}

/** Seguir hasta la decisión. @param {any} page */
async function toDecision(page) {
    for (let i = 0; i < 12; i++) {
        if ((await readScene(page)).options.length > 0) return;
        await page.locator('.ps-dialog .ps-next').click();
        await page.waitForTimeout(120);
    }
}

/** Seguir hasta cerrar. @param {any} page */
async function toEnd(page) {
    for (let i = 0; i < 14; i++) {
        const seen = await readScene(page);
        if (!seen.open) return;
        await page.locator('.ps-dialog .ps-next, .ps-dialog .ps-finish').click();
        await page.waitForTimeout(150);
    }
}

const stats = { level: 1, strength: 12, dexterity: 12, constitution: 12, intelligence: 10, wisdom: 12, charisma: 12 };
const ada = { name: 'Ada', race: 'Humana', class: 'Guerrera', gender: 'Mujer', background: 'soldado', ...stats };

const browser = await chromium.launch({ headless: !HEADED, channel: 'msedge' }).catch(() => chromium.launch({ headless: !HEADED }));
try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    /** @type {string[]} */
    const errors = [];
    page.on('pageerror', (/** @type {any} */ error) => errors.push(String(error?.message ?? error)));
    page.on('console', (/** @type {any} */ message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route(`${BASE}/**`, async (/** @type {any} */ route) => {
        const url = new URL(route.request().url());
        if (url.pathname === '/' || url.pathname === '/escenas.html') {
            await route.fulfill({ status: 200, contentType: 'text/html', body: PAGE });
            return;
        }
        const file = join(ROOT, 'public', decodeURIComponent(url.pathname));
        if (!existsSync(file)) {
            await route.fulfill({ status: 404, body: '' });
            return;
        }
        await route.fulfill({ status: 200, contentType: TYPES[/** @type {keyof typeof TYPES} */ (extname(file).toLowerCase())] ?? 'application/octet-stream', body: readFileSync(file) });
    });
    await page.goto(`${BASE}/escenas.html`);
    await page.waitForFunction(() => window.harnessReady === true, null, { timeout: 15000 });

    // --- Puerto Alba: el muelle.
    await openScene(page, { pack: 'gremio', milestone: 'el-muelle', hero: ada, game: { gold: 0, items: [] } });
    let seen = await readScene(page);
    check('El muelle empieza con el narrador: sin placa ni retrato', seen.plate === '' && !seen.portraitShown && seen.lines.some(l => /ps-narration/.test(l.cls)), JSON.stringify(seen));
    check('Con el género de la heroína: «cansada»', seen.lines.some(l => /cansada del viaje/.test(l.text)), JSON.stringify(seen.lines));
    check('Dice por qué línea va', seen.step === '1 / 6', seen.step);
    check('Hay fondo: el muelle', await page.evaluate(() => /sitios\/muelle/.test(window.getComputedStyle(document.querySelector('.ps-dialog .qd-backdrop') ?? document.body).getPropertyValue('--qd-backdrop'))));
    await shoot(page, 'el narrador, en el muelle');

    await tapScene(page);
    seen = await readScene(page);
    check('Un toque en el texto sigue: Tomás grita, con su placa', seen.beat === '1' && seen.plate === 'Tomás' && seen.lines.some(l => /Al ladrón/.test(l.text)), JSON.stringify(seen));
    check('Su retrato enfadado carga', seen.portraitShown && seen.loaded && /retratos\/gremio\/tomas--enfadado/.test(seen.portrait), seen.portrait);
    await shoot(page, 'Tomás, enfadado');

    await toDecision(page);
    seen = await readScene(page);
    check('La decisión: dos opciones numeradas, y sin «Seguir» hasta decidir', seen.options.length === 2 && seen.options[0].key === '1' && seen.next === '' && !seen.skip, JSON.stringify(seen));
    check('Tomás, triste, en la línea de la decisión', seen.mood === 'triste' && /tomas--triste/.test(seen.portrait), `${seen.mood} ${seen.portrait}`);
    await tapScene(page);
    check('Tocar la escena no se salta la decisión', (await readScene(page)).options.length === 2);
    await shoot(page, 'la decisión del muelle');

    await page.keyboard.press('1');
    await page.waitForTimeout(250);
    seen = await readScene(page);
    const game = await page.evaluate(() => window.game);
    check('Elegir con el 1: lo que dijiste, y Tomás os mira mejor', seen.lines.some(l => /qd-you/.test(l.cls) && /Yo me encargo/.test(l.text))
        && seen.lines.some(l => /Tomás (os mira mejor|le ha gustado eso|te mira con otros ojos|le ha caído bien)/.test(l.text)) && game.attitudes?.values?.['Tomás'] === 1, `${JSON.stringify(seen.lines)} ${JSON.stringify(game.attitudes)}`);
    check('Y contesta alegre, con otra cara', seen.mood === 'alegre' && /tomas--alegre/.test(seen.portrait) && seen.lines.some(l => /dioses te lo paguen/.test(l.text)), seen.portrait);
    await shoot(page, 'Tomás, alegre');

    await toEnd(page);
    let result = await page.evaluate(() => window.sceneResult);
    check('Al acabar se cierra, con lo elegido y lo que pasó escrito', !((await readScene(page)).open) && result?.finished === true
        && result.choices.length === 1 && result.transcript.some((/** @type {string} */ l) => /^Tú: «Quédate atrás/.test(l)), JSON.stringify(result));

    // --- Puerto Alba: la prueba, con tirada.
    await openScene(page, { pack: 'gremio', milestone: 'la-prueba', hero: ada, game: { gold: 1, items: [] } });
    await toDecision(page);
    seen = await readScene(page);
    const pay = seen.options.find(o => o.id === 'cuanto-por-rata');
    check('La tirada dice cuál y contra cuánto', /Persuasión · CD 12/.test(pay?.check ?? ''), JSON.stringify(pay));
    await page.evaluate(() => { window.nextRoll = 17; });
    await page.locator('.ps-dialog .ps-option[data-option="cuanto-por-rata"]').click();
    await page.waitForTimeout(250);
    seen = await readScene(page);
    const gold = await page.evaluate(() => window.game.gold);
    check('Sale bien: la tirada en la caja, +3 de oro y Brunilda alegre', seen.lines.some(l => /dw-roll/.test(l.cls) && /Persuasión/.test(l.text)) && gold === 4
        && seen.mood === 'alegre' && /brunilda--alegre/.test(seen.portrait), `${gold} ${JSON.stringify(seen.lines.map(l => l.text))}`);
    await shoot(page, 'la prueba, la tirada');
    await toEnd(page);

    // --- 1387: Garret, sin blanca.
    const nel = { name: 'Nel', race: 'Humano', class: 'Pícaro', gender: 'Hombre', background: 'criminal', ...stats };
    await openScene(page, { pack: '1387', milestone: 'el-invierno-cierra-el-paso', hero: nel, game: { gold: 0, items: [] }, done: ['la-pista-en-el-barro'] });
    check('Hay fondo: el castillo de Vane', await page.evaluate(() => /escenarios\/1387\/castillo-de-vane/.test(window.getComputedStyle(document.querySelector('.ps-dialog .qd-backdrop') ?? document.body).getPropertyValue('--qd-backdrop'))));
    await page.locator('.ps-dialog .ps-skip').click();
    await page.waitForTimeout(150);
    seen = await readScene(page);
    check('«Saltar» se para en la decisión: Garret, en el portón', seen.plate === 'Garret' && seen.options.length === 2 && seen.loaded && /el-guardia-corrupto/.test(seen.portrait), JSON.stringify(seen));
    const bribe = seen.options.find(o => o.id === 'para-el-frio');
    check('Sin blanca, darle algo sale cerrado y dice cuánto falta', Boolean(bribe?.locked && !bribe.key && /2 monedas/.test(bribe.why)), JSON.stringify(bribe));
    await page.locator('.ps-dialog .ps-option[data-option="para-vane"]').click();
    await page.waitForTimeout(200);
    check('Llevárselo a Vane: Lord Vane os mirará mejor', (await page.evaluate(() => window.game.attitudes?.values?.['Lord Edmund Vane'])) === 1);
    await shoot(page, 'Garret');
    await toEnd(page);

    // --- 1387: el precio del escape, y la charla de Giles detrás.
    await openScene(page, { pack: '1387', milestone: 'el-precio-del-escape', hero: nel, game: { gold: 0, items: [] }, done: ['el-caliz-ensangrentado'] });
    await toDecision(page);
    seen = await readScene(page);
    check('Decide el narrador: sin retrato, y las opciones de cómo entrar', !seen.portraitShown && seen.plate === '' && seen.options.some(o => o.id === 'llamar') && seen.options.some(o => /Sigilo/.test(o.check)), JSON.stringify(seen));
    await page.locator('.ps-dialog .ps-option[data-option="llamar"]').click();
    await page.waitForTimeout(250);
    seen = await readScene(page);
    check('Llamar: Giles os mira mejor y contesta, en masculino', seen.plate === 'Giles' && seen.loaded && /el-tabernero-giles/.test(seen.portrait)
        && seen.lines.some(l => /Un asesino con modales/.test(l.text)) && seen.lines.some(l => /Giles (os mira mejor|le ha gustado eso|te mira con otros ojos|le ha caído bien)/.test(l.text)), JSON.stringify(seen.lines));
    check('La última ficha lleva a la charla', /Hablar con Giles/.test(seen.next), seen.next);
    await shoot(page, 'Giles, antes de la charla');
    await page.locator('.ps-dialog .ps-finish').click();
    await page.waitForSelector('dialog.dw-dialog[open]:not(.ps-dialog)', { timeout: 8000 });
    await page.waitForTimeout(250);
    const talk = await page.evaluate(() => ({
        plate: document.querySelector('dialog.dw-dialog:not(.ps-dialog) .qd-nameplate')?.textContent ?? '',
        lines: [...document.querySelectorAll('dialog.dw-dialog:not(.ps-dialog) .qd-line')].map(l => l.textContent ?? ''),
        mood: /** @type {HTMLElement|null} */ (document.querySelector('dialog.dw-dialog:not(.ps-dialog) .qd-attitude, dialog.dw-dialog:not(.ps-dialog) .dw-attitude'))?.textContent ?? '',
    }));
    check('Al acabar la escena se abre la charla de Giles, y ya os mira mejor', talk.plate === 'Giles' && talk.lines.some(l => /Cierra esa puerta/.test(l)) && /cordial/.test(talk.mood), JSON.stringify(talk));
    await shoot(page, 'la charla de Giles');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    result = await page.evaluate(() => window.sceneResult);
    check('Despedirse de Giles cierra la escena entera', result?.finished === true && result.dialogue?.ended === false && result.transcript.some((/** @type {string} */ l) => /charla con Giles/.test(l)), JSON.stringify(result));

    // --- Strahd: Ismark.
    const aerin = { name: 'Aerin', race: 'Elfo', class: 'Clérigo', gender: 'Hombre', background: 'acolito', ...stats };
    await openScene(page, { pack: 'strahd', milestone: 'sangrienta-bienvenida', hero: aerin, game: { gold: 10, items: [] } });
    await page.locator('.ps-dialog .ps-next').click();
    await page.locator('.ps-dialog .ps-next').click();
    await page.waitForTimeout(150);
    seen = await readScene(page);
    check('Strahd: Ismark se presenta, con su cara triste', seen.plate === 'Ismark Kolyanovich' && seen.loaded && /ismark-kolyanovich--triste/.test(seen.portrait), seen.portrait);
    check('Lo marcado «propio:» no llega a la pantalla', !JSON.stringify(seen).includes('propio:'));
    await shoot(page, 'Ismark');
    await toDecision(page);
    await page.keyboard.press('2');
    await page.waitForTimeout(250);
    seen = await readScene(page);
    const heard = await page.evaluate(() => window.game.rumorsHeard);
    check('Preguntar por la vieja: un rumor al Diario', heard.includes('r-no-invitar') && seen.lines.some(l => /Apuntado en el Diario/.test(l.text)), `${JSON.stringify(heard)} ${JSON.stringify(seen.lines.map(l => l.text))}`);
    await toEnd(page);

    // --- En un móvil: se sigue con el dedo.
    await page.setViewportSize({ width: 390, height: 844 });
    await openScene(page, { pack: 'gremio', milestone: 'la-charla', hero: ada, game: { gold: 0, items: [] } });
    await tapScene(page);
    await tapScene(page);
    seen = await readScene(page);
    check('Móvil: dos toques, y habla Tomás', seen.beat === '2' && seen.plate === 'Tomás', JSON.stringify(seen));
    const fits = await page.evaluate(() => {
        const box = document.querySelector('.ps-dialog .qd-box')?.getBoundingClientRect();
        return Boolean(box && box.right <= window.innerWidth + 1 && box.left >= -1 && box.bottom <= window.innerHeight + 1);
    });
    check('Móvil: la caja cabe en la pantalla', fits);
    await tapScene(page);
    seen = await readScene(page);
    check('Móvil: la decisión, con las tres opciones', seen.options.length === 3, JSON.stringify(seen.options));
    await shoot(page, 'móvil, la decisión de Tomás');
    await page.locator('.ps-dialog .ps-option[data-option="que-se-cuenta"]').click();
    await page.waitForTimeout(250);
    seen = await readScene(page);
    check('Móvil: el rumor de Barovia, apuntado', seen.lines.some(l => /Salieron cinco y volvieron dos/.test(l.text)), JSON.stringify(seen.lines.map(l => l.text)));
    await shoot(page, 'móvil, el rumor');
    await toEnd(page);

    check('Sin errores en la página', errors.length === 0, errors.join(' | '));
} finally {
    await browser.close();
}

console.log(failures === 0 ? '\nTodo bien.' : `\n${failures} fallo(s).`);
process.exit(failures === 0 ? 0 : 1);
