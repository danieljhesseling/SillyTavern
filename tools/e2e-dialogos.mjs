#!/usr/bin/env node
/**
 * La ventana de las charlas con ramas (J8.4), en un navegador de verdad y sin servidor: la
 * página se sirve desde `public/` a mano (`page.route`), se abre `openDialogueWindow` con las
 * charlas escritas de los paquetes y se juegan como jugaría alguien, con el ratón y el teclado.
 *
 *   Brunilda (gremio), a una enana soldado: salen «[Enano]» y «[Soldado]», lo que se gana con
 *   aprecio sale apagado y con el porqué, su cara cambia con lo que dice, la tirada de pedirle
 *   un adelanto da oro, «Quiero entrar» cumple el hito y la charla acaba.
 *   Giles (1387), a un pícaro sin blanca: pagar sale cerrado, «[Pícaro] Esta cerveza sabe a
 *   agua» sí sale, y una tirada fallida lo enfada.
 *   Ismark (Strahd), a un elfo clérigo: sus opciones, y su retrato con cara.
 *
 * Uso:
 *   node tools/e2e-dialogos.mjs                                  # sin ventana
 *   node tools/e2e-dialogos.mjs --headed
 *   node tools/e2e-dialogos.mjs --port 8156 --captura charla.png  # charla-1.png, charla-2.png…
 *
 * El puerto solo da nombre al origen de la página: no se abre ningún servidor.
 */

/* global window, document */

import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8156;
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
<html lang="es"><head><meta charset="utf-8"><title>Charlas</title>
<link rel="stylesheet" href="css/fontawesome.min.css"><link rel="stylesheet" href="css/solid.min.css">
<link rel="stylesheet" href="css/game-shell.css"><link rel="stylesheet" href="css/quedadas.css"><link rel="stylesheet" href="css/dialogos.css">
<style>body{margin:0;min-height:100vh;background:#12100e;color:#e8e0d0;font-family:system-ui,sans-serif}</style>
</head><body>
<script type="module">
import { readDialogues } from './scripts/game-engine/campaign/dialogues.js';
import { openDialogueWindow } from './scripts/game-engine/ui/dialogue-window.js';
window.harness = { readDialogues, openDialogueWindow };
window.harnessReady = true;
</script>
</body></html>`;

/**
 * Abrir una charla en la página, con un mundo que los efectos cambian de verdad.
 *
 * @param {any} page
 * @param {{pack: string, speaker: string, hero: any, world: any, place?: string}} input
 */
async function openTalk(page, input) {
    await page.evaluate(async ({ pack, speaker, hero, world, place }) => {
        const data = await (await fetch(`mundos/${pack}.pack.json`)).json();
        const dialogue = window.harness.readDialogues(data.dialogues).find((/** @type {any} */ d) => d.speaker === speaker);
        window.world = world;
        window.applied = [];
        window.nextRoll = 10;
        window.talk = window.harness.openDialogueWindow({
            dialogue,
            hero,
            pack,
            place,
            getWorld: () => window.world,
            rollD20: () => window.nextRoll,
            applyEffects: (/** @type {any[]} */ effects) => {
                window.applied.push(...effects);
                for (const effect of effects) {
                    if (effect.kind === 'attitude') window.world.attitude = Math.max(-3, Math.min(3, (window.world.attitude ?? 0) + effect.amount));
                    if (effect.kind === 'gold') window.world.gold = (window.world.gold ?? 0) + effect.amount;
                    if (effect.kind === 'milestone') {
                        window.world.open = (window.world.open ?? []).filter((/** @type {string} */ id) => id !== effect.id);
                        window.world.done = [...(window.world.done ?? []), effect.id];
                    }
                    if (effect.kind === 'give') window.world.items = [...(window.world.items ?? []), effect.item];
                    if (effect.kind === 'take') window.world.items = (window.world.items ?? []).filter((/** @type {string} */ i) => i !== effect.item);
                }
            },
        }).then((/** @type {any} */ result) => { window.talkResult = { ended: result.ended, memory: result.memory }; });
    }, input);
    await page.waitForSelector('.dw-dialog .dw-option, .dw-dialog .dw-finish', { timeout: 10000 });
    await page.waitForTimeout(300);
}

/** Lo que se ve en la ventana. @param {any} page */
function readWindow(page) {
    return page.evaluate(() => {
        const q = (/** @type {string} */ s) => document.querySelector(s);
        const image = /** @type {HTMLImageElement|null} */ (q('.dw-dialog .qd-portrait img'));
        return {
            plate: q('.dw-dialog .qd-nameplate')?.textContent ?? '',
            lines: [...document.querySelectorAll('.dw-dialog .qd-line')].map(l => ({ cls: l.className, text: l.textContent ?? '' })),
            options: [...document.querySelectorAll('.dw-dialog .dw-option')].map(o => ({
                id: o.getAttribute('data-option'),
                text: o.querySelector('.dw-said')?.textContent ?? '',
                tag: o.querySelector('.dw-tag')?.textContent ?? '',
                check: o.querySelector('.dw-check')?.textContent?.trim() ?? '',
                why: o.querySelector('.dw-why')?.textContent?.trim() ?? '',
                key: o.querySelector('.qd-key')?.textContent ?? '',
                locked: o.classList.contains('dw-locked'),
            })),
            mood: /** @type {HTMLElement|null} */ (q('.dw-dialog .qd-portrait'))?.dataset.mood ?? '',
            portrait: image?.getAttribute('src') ?? '',
            loaded: Boolean(image && image.complete && image.naturalWidth > 0),
            finish: Boolean(q('.dw-dialog .dw-finish')),
            open: Boolean(q('dialog.dw-dialog[open]')),
        };
    });
}

/** Pulsar una opción por su id. @param {any} page @param {string} id */
async function pick(page, id) {
    await page.locator(`.dw-dialog .dw-option[data-option="${id}"]`).click();
    await page.waitForTimeout(250);
}

const stats = { level: 1, strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 12, charisma: 12 };

const browser = await chromium.launch({ headless: !HEADED, channel: 'msedge' }).catch(() => chromium.launch({ headless: !HEADED }));
try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    /** @type {string[]} */
    const errors = [];
    page.on('pageerror', (/** @type {any} */ error) => errors.push(String(error?.message ?? error)));
    page.on('console', (/** @type {any} */ message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route(`${BASE}/**`, async (/** @type {any} */ route) => {
        const url = new URL(route.request().url());
        if (url.pathname === '/' || url.pathname === '/charlas.html') {
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
    await page.goto(`${BASE}/charlas.html`);
    await page.waitForFunction(() => window.harnessReady === true, null, { timeout: 15000 });

    // --- Brunilda, a una enana soldado.
    await openTalk(page, {
        pack: 'gremio', speaker: 'Brunilda', place: 'gremio',
        hero: { name: 'Hilda', race: 'Enana', class: 'Soldado', gender: 'Mujer', background: '', ...stats },
        world: { open: ['el-gremio'], done: ['el-muelle', 'la-charla'], attitude: 0, gold: 3, items: [] },
    });
    let seen = await readWindow(page);
    check('Brunilda: la placa y su línea, con el género de la heroína', seen.plate === 'Brunilda' && seen.lines.some(l => /eres la nueva/.test(l.text)), JSON.stringify(seen.lines));
    check('Brunilda: su retrato en pixel carga', seen.loaded && /retratos\/gremio\/brunilda/.test(seen.portrait), seen.portrait);
    const tags = seen.options.map(o => o.tag);
    check('J8.2: a la enana soldado le salen «[Enano]» y «[Soldado]»', tags.includes('[Enano]') && tags.includes('[Soldado]'), JSON.stringify(tags));
    check('J8.2: no le salen las de clérigo ni pícaro', !seen.options.some(o => o.id === 'clerigo' || o.id === 'picaro'));
    const past = seen.options.find(o => o.id === 'pasado');
    check('Lo que se gana con aprecio sale apagado, sin número y con el porqué', Boolean(past?.locked && !past.key && /cordial/.test(past.why)), JSON.stringify(past));
    const loan = seen.options.find(o => o.id === 'adelanto');
    check('La tirada dice cuál y contra cuánto', /Persuasión · CD 13/.test(loan?.check ?? ''), JSON.stringify(loan));
    await shoot(page, 'Brunilda al empezar');

    // Cerrada va con `aria-disabled`: Playwright no la pulsa sin `force`, como no la pulsaría nadie.
    await page.locator('.dw-dialog .dw-option[data-option="pasado"]').click({ force: true });
    await page.waitForTimeout(200);
    check('Pulsar una cerrada no hace nada', (await readWindow(page)).lines.some(l => /eres la nueva/.test(l.text)));

    await pick(page, 'veterana');
    seen = await readWindow(page);
    check('[Soldado]: Brunilda se pone triste, y su retrato cambia de cara', seen.mood === 'triste' && /brunilda--triste/.test(seen.portrait), `${seen.mood} ${seen.portrait}`);
    check('La caja dice lo que dijiste y lo que contesta', seen.lines.some(l => /qd-you/.test(l.cls) && /veterana/.test(l.text)) && seen.lines.some(l => /veinte años/.test(l.text)));
    check('Y lo que pasó: os mira mejor', seen.lines.some(l => /Brunilda os mira mejor/.test(l.text)), JSON.stringify(seen.lines.map(l => l.text)));
    await shoot(page, 'Brunilda, triste');

    await pick(page, 'veterana-vale');
    seen = await readWindow(page);
    check('J8.6: de vuelta, lo ya dicho no sale y Brunilda lo resume', !seen.options.some(o => o.id === 'veterana') && seen.lines.some(l => /Otra vez tú/.test(l.text)), JSON.stringify(seen.lines.map(l => l.text)));
    const unlocked = seen.options.find(o => o.id === 'pasado');
    check('Con el aprecio ganado, «¿Por qué dejaste…?» ya se puede elegir', Boolean(unlocked && !unlocked.locked), JSON.stringify(unlocked));
    const loanNow = seen.options.find(o => o.id === 'adelanto');
    check('Y la CD de la tirada baja con el aprecio', /CD 12/.test(loanNow?.check ?? ''), JSON.stringify(loanNow));

    // J8.3: la tirada, con el teclado.
    await page.evaluate(() => { window.nextRoll = 17; });
    const loanKey = seen.options.find(o => o.id === 'adelanto')?.key ?? '';
    await page.keyboard.press(loanKey);
    await page.waitForTimeout(250);
    seen = await readWindow(page);
    const gold = await page.evaluate(() => window.world.gold);
    check('J8.3: la tirada sale en la caja, y bien da el oro', seen.lines.some(l => /dw-roll/.test(l.cls) && /Persuasión/.test(l.text)) && gold === 8 && seen.mood === 'alegre', `${gold} ${JSON.stringify(seen.lines.map(l => l.text))}`);
    await shoot(page, 'Brunilda, la tirada');

    await pick(page, 'adelanto-si-trato');
    await pick(page, 'quiero-entrar');
    const applied = await page.evaluate(() => window.applied);
    check('«Quiero entrar» lleva a la prueba y cumple el hito', applied.some((/** @type {any} */ e) => e.kind === 'milestone' && e.id === 'el-gremio'), JSON.stringify(applied));
    seen = await readWindow(page);
    check('Y ya no se ofrece dos veces', !seen.options.some(o => o.id === 'quiero-entrar'));
    await pick(page, 'prueba-voy');
    seen = await readWindow(page);
    check('Al acabar, «Terminar»', seen.finish);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    const result = await page.evaluate(() => window.talkResult);
    check('Se cierra, acabada, con lo recordado para el Diario', !((await readWindow(page)).open) && result?.ended === true
        && (result?.memory?.['brunilda-la-casa']?.learned ?? []).some((/** @type {any} */ l) => /veinte años/.test(l.text)), JSON.stringify(result));

    // --- Giles, a un pícaro sin blanca.
    await openTalk(page, {
        pack: '1387', speaker: 'Giles', place: 'posada',
        hero: { name: 'Nel', race: 'Humano', class: 'Pícaro', gender: 'Hombre', background: 'criminal', ...stats },
        world: { open: ['el-precio-del-escape'], done: ['el-caliz-ensangrentado'], attitude: 0, gold: 0, items: ['Cáliz ensangrentado de Vane'] },
    });
    seen = await readWindow(page);
    check('Giles: al pícaro le sale «[Pícaro] Esta cerveza sabe a agua»', seen.options.some(o => o.id === 'cerveza' && o.tag === '[Pícaro]'), JSON.stringify(seen.options.map(o => `${o.tag} ${o.text}`)));
    check('Giles: y no le sale lo del soldado', !seen.options.some(o => o.id === 'soldado'));
    check('Giles: le trata en masculino', seen.lines.some(l => /eres tonto/.test(l.text)));
    await pick(page, 'quien-subio');
    seen = await readWindow(page);
    const pay = seen.options.find(o => o.id === 'pagar');
    check('Sin blanca, pagar sale cerrado y dice cuánto falta', Boolean(pay?.locked && /3 monedas/.test(pay.why)), JSON.stringify(pay));
    await shoot(page, 'Giles, el precio');
    await page.evaluate(() => { window.nextRoll = 2; });
    await pick(page, 'convencer');
    seen = await readWindow(page);
    check('J8.3: mal: Giles se enfada y os mira peor', seen.mood === 'enfadado' && seen.lines.some(l => /os mira peor/.test(l.text)), `${seen.mood} ${JSON.stringify(seen.lines.map(l => l.text))}`);
    await page.locator('.dw-dialog .dw-leave').click();
    await page.waitForTimeout(200);
    check('«Despedirse» cierra a medias', !((await readWindow(page)).open) && (await page.evaluate(() => window.talkResult?.ended)) === false);

    // --- Ismark, a un elfo clérigo.
    await openTalk(page, {
        pack: 'strahd', speaker: 'Ismark Kolyanovich', place: 'posada',
        hero: { name: 'Aerin', race: 'Elfo', class: 'Clérigo', gender: 'Hombre', background: 'acolito', ...stats },
        world: { open: [], done: ['sangrienta-bienvenida'], attitude: 0, gold: 10, items: ['Ristra de ajos'] },
    });
    seen = await readWindow(page);
    check('Ismark: su retrato triste carga', seen.loaded && /ismark-kolyanovich--triste/.test(seen.portrait), seen.portrait);
    check('Ismark: al elfo clérigo le salen «[Elfo]» y «[Clérigo]», y lo de la bruja', seen.options.some(o => o.tag === '[Elfo]') && seen.options.some(o => o.tag === '[Clérigo]') && seen.options.some(o => o.id === 'bruja'), JSON.stringify(seen.options.map(o => `${o.tag} ${o.text}`)));
    check('Lo marcado «propio:» no llega a la pantalla', !JSON.stringify(seen).includes('propio:'));
    await shoot(page, 'Ismark');
    await pick(page, 'bruja');
    seen = await readWindow(page);
    check('Ismark se alegra: otra cara', seen.mood === 'alegre' && /ismark-kolyanovich--alegre/.test(seen.portrait), seen.portrait);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    check('Escape se despide', !((await readWindow(page)).open));

    check('Sin errores en la página', errors.length === 0, errors.join(' | '));
} finally {
    await browser.close();
}

console.log(failures === 0 ? '\nTodo bien.' : `\n${failures} fallo(s).`);
process.exit(failures === 0 ? 0 : 1);
