#!/usr/bin/env node
/**
 * El Diario como un libro (J9.6), sus plazos (J9.5), sus capítulos en el tablón del gremio
 * (J9.3) y la crónica de lo decidido (J11.5), en un navegador de verdad y sin servidor: la
 * página se sirve desde `public/` a mano (`page.route`), se monta el libro con los paquetes de
 * verdad (`buildStoryBook`) y se lee como lo leería alguien, con el ratón y el teclado.
 *
 *   Strahd, en el capítulo 3: el índice con los capítulos hechos, el de ahora y los que siguen en
 *   blanco (sin su nombre); la página con su entrada, lo abierto con «Lo que toca», lo decidido y
 *   lo que salió; las flechas pasan de capítulo; «Lo que decidisteis», con su buscador; los apuntes
 *   de siempre, con su filtro; Escape cierra.
 *   1387, con la nieve manchada a un día: el reloj arriba, en la página y en la cabecera del juego.
 *   En el móvil: el índice en una tira, sin salirse de la pantalla.
 *   El tablón del gremio: la tarjeta dice por qué capítulo ibais y «La crónica» la abre encima.
 *
 * Uso:
 *   node tools/e2e-libro.mjs                                   # sin ventana
 *   node tools/e2e-libro.mjs --headed
 *   node tools/e2e-libro.mjs --port 8202 --captura libro.png   # libro-1.png, libro-2.png…
 *
 * El puerto solo da nombre al origen de la página: no se abre ningún servidor.
 */

/* global window, document */

import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8202;
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
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Libro</title>
<link rel="stylesheet" href="css/fontawesome.min.css"><link rel="stylesheet" href="css/solid.min.css">
<link rel="stylesheet" href="css/popup.css"><link rel="stylesheet" href="css/game-shell.css"><link rel="stylesheet" href="css/campaigns.css">
<link rel="stylesheet" href="css/libro.css">
<style>body{margin:0;min-height:100vh;background:#12100e;color:#e8e0d0;font-family:system-ui,sans-serif}
.fake-focus{display:flex;gap:10px;align-items:center;padding:10px 16px;border-bottom:1px solid rgba(214,180,106,.3)}
.stub-popup{width:min(1100px,96vw);max-height:92vh;overflow:auto;background:#1a1611;color:#e8e0d0;border:1px solid rgba(214,180,106,.4);border-radius:12px}</style>
<script src="lib/jquery-3.5.1.min.js"></script>
</head><body>
<div class="fake-focus" id="focus"><i class="fa-solid fa-compass"></i><span>Lo que tenéis entre manos</span></div>
<script type="module">
import * as book from './scripts/game-engine/campaign/story-book.js';
import * as plot from './scripts/game-engine/campaign/plot.js';
import * as hub from './scripts/game-engine/campaign/hub.js';
import { openStoryBook, deadlineBadge } from './scripts/game-engine/ui/story-book.js';
import { openHubBoard } from './scripts/game-engine/ui/hub-panel.js';
class Popup {
    constructor(content) { this.content = content; }
    show() {
        const dialog = document.createElement('dialog');
        dialog.className = 'stub-popup';
        dialog.appendChild(this.content);
        document.body.appendChild(dialog);
        dialog.showModal();
        this.dialog = dialog;
        return new Promise(resolve => { this.resolve = resolve; });
    }
    completeCancelled() { this.dialog?.close(); this.dialog?.remove(); this.resolve?.(null); }
}
Popup.show = { confirm: async () => true };
window.harness = { book, plot, hub, openStoryBook, deadlineBadge, openHubBoard, Popup };
window.harnessReady = true;
</script>
</body></html>`;

/**
 * Strahd, jugado hasta el capítulo 3: lo de verdad del paquete, empujado con los mismos sucesos
 * que da el juego, y lo que la partida guarda alrededor (lo decidido, el chat, lo recordado).
 *
 * @param {any} page
 */
function strahdBook(page) {
    return page.evaluate(async () => {
        const { book, plot } = window.harness;
        const data = await (await fetch('mundos/strahd.pack.json')).json();
        const read = plot.readPlot(data.plot);
        let state = plot.startPlot(read, 1).state;
        const win = (/** @type {string} */ board, /** @type {number} */ day) => { state = plot.plotEvent(read, state, { kind: 'win', board }, day).state; };
        win('Taberna Sangre de la Enredadera', 2);
        win('Mansión del Burgomaestre', 3);
        win('Sótano de la Iglesia', 4);
        win('Tienda de Madam Eva', 6);
        win('Plaza de Vallaki', 9);
        const decisions = book.recordDecisions([], [
            ...book.sceneDecisionEntries({
                scene: { title: 'Sangrienta Bienvenida' }, milestone: read.milestones[0], day: 2,
                choices: [{ beat: 2, said: 'Salid todos. Nosotras nos encargamos de la bruja.', outcome: null }],
                came: { 2: ['Ismark os mira mejor.'] },
            }),
            ...book.sceneDecisionEntries({
                scene: { title: 'Asedio en la Mansión' }, milestone: read.milestones[1], day: 3,
                choices: [{ beat: 1, said: 'Ireena viene con nosotras, pase lo que pase.', outcome: 'bien' }],
                came: { 1: ['Ireena os mira mejor.'] },
            }),
            { day: 6, text: 'Lectura Interrumpida: «Queremos saber dónde está la espada.»', milestone: 'lectura-interrumpida', came: ['Madam Eva os señala una tumba en la montaña.'] },
            // De antes de J9.6: sin hito; va a su capítulo por el día.
            { day: 10, text: 'En Vallaki: «No iremos a la fiesta del barón.»' },
        ]);
        const chat = [
            { mes: 'Empezamos.' },
            { mes: '🃏 [SUCESO] Un carro volcado: Ayudáis al buhonero a levantarlo. Os regala una linterna sorda.' },
            { mes: '⚰️ [MUERTE] Gerd cae defendiendo la puerta de la mansión.' },
            { mes: '🎲 [TIRADA] Percepción: 14.' },
            { mes: '📜 [HILO] Una escena que ya está en su página.' },
            { mes: '⬆️ [NIVEL] Ada sube a nivel 2.' },
            { mes: '🃏 [SUCESO] Niebla en el camino: Esperáis a que levante. Perdéis medio día.' },
            { mes: '🩸 [VILLANO] Strahd os mira desde lo alto de la muralla y se va.' },
            { mes: 'Seguimos.' },
            { mes: '🃏 [SUCESO] La fiesta del barón: Os quedáis mirando desde lejos. Nadie os molesta.' },
        ];
        window.lastState = state;
        return book.buildStoryBook({
            plot: read,
            state,
            today: 11,
            decisions,
            // El día 2: el 3 ya es del capítulo 2 (ese día se abrió «Lectura Interrumpida», y el día en
            // que empieza un capítulo, lo que pasa ya es suyo).
            dialogueMemory: { ismark: { learned: [{ who: 'Ismark', text: 'Mi padre murió defendiendo a Ireena.', day: 2 }] } },
            memories: [{ day: 7, text: 'Cantasteis con Ismark junto al fuego del campamento.', who: ['Ismark'] }],
            deeds: [{ day: 9, text: 'Salvasteis a los niños de la plaza de Vallaki.' }],
            chat,
            // Acto → su primer mensaje: la niebla, Strahd en la muralla y la fiesta son de Vallaki.
            actStarts: { 2: 5, 3: 6 },
            factions: data.world.factions,
            boardPlaces: Object.fromEntries(data.boards.map((/** @type {any} */ b) => [String(b.name).toLowerCase(), b.locationName])),
            who: { heroe: 'Mujer', grupo: ['Mujer', 'Mujer'] },
        });
    });
}

/** Abrir un libro en la página; lo que devuelve la ventana al cerrarse queda en `window.bookClosed`. @param {any} page @param {any} input */
async function openBook(page, input) {
    await page.evaluate((/** @type {any} */ options) => {
        window.bookClosed = false;
        window.harness.openStoryBook(options).then(() => { window.bookClosed = true; });
    }, input);
    await page.waitForSelector('dialog.lb-dialog[open] .lb-page', { timeout: 10000 });
    await page.waitForTimeout(250);
}

/** Lo que se ve del libro. @param {any} page */
function readBook(page) {
    return page.evaluate(() => {
        const q = (/** @type {string} */ s) => document.querySelector(s);
        return {
            open: Boolean(q('dialog.lb-dialog[open]')),
            title: q('.lb-dialog .lb-title')?.textContent ?? '',
            kicker: q('.lb-dialog .lb-kicker')?.textContent ?? '',
            now: q('.lb-dialog .lb-now')?.textContent ?? '',
            clocks: [...document.querySelectorAll('.lb-dialog .lb-clocks .lb-badge')].map(b => ({ text: b.textContent ?? '', urgency: /** @type {HTMLElement} */ (b).dataset.urgency })),
            tabs: [...document.querySelectorAll('.lb-dialog .lb-tab')].map(t => ({
                view: /** @type {HTMLElement} */ (t).dataset.view,
                state: /** @type {HTMLElement} */ (t).dataset.state,
                name: t.querySelector('.lb-tab-name')?.textContent ?? '',
                note: t.querySelector('.lb-tab-note')?.textContent ?? '',
                off: t.getAttribute('aria-disabled') === 'true',
                on: t.classList.contains('lb-tab-on'),
            })),
            view: /** @type {HTMLElement|null} */ (q('.lb-dialog .lb-page'))?.dataset.view ?? '',
            chapter: q('.lb-dialog .lb-chapter-title')?.textContent ?? '',
            epigraph: q('.lb-dialog .lb-epigraph')?.textContent ?? '',
            entries: [...document.querySelectorAll('.lb-dialog .lb-entry')].map(e => ({
                id: /** @type {HTMLElement} */ (e).dataset.page,
                state: /** @type {HTMLElement} */ (e).dataset.state,
                title: e.querySelector('.lb-entry-title')?.textContent ?? '',
                tag: e.querySelector('.lb-tag')?.textContent ?? '',
                hint: e.querySelector('.lb-entry-hint')?.textContent ?? '',
                said: [...e.querySelectorAll('.lb-said')].map(s => s.textContent ?? ''),
                came: [...e.querySelectorAll('.lb-came li, .lb-outcome li')].map(s => s.textContent ?? ''),
                clock: e.querySelector('.lb-badge')?.textContent ?? '',
            })),
            lists: [...document.querySelectorAll('.lb-dialog .lb-page > .lb-list')].map(l => ({ title: l.querySelector('.lb-list-title')?.textContent ?? '', items: [...l.querySelectorAll('li')].map(i => i.textContent ?? '') })),
            closing: q('.lb-dialog .lb-closing')?.textContent ?? '',
            blank: q('.lb-dialog .lb-blank')?.textContent ?? '',
            vignette: /** @type {HTMLImageElement|null} */ (q('.lb-dialog .lb-vignette img'))?.getAttribute('src') ?? '',
            folio: q('.lb-dialog .lb-folio')?.textContent ?? '',
            count: q('.lb-dialog .lb-count')?.textContent ?? '',
            decided: [...document.querySelectorAll('.lb-dialog .lb-decided .lb-decision')].map(d => d.querySelector('.lb-said')?.textContent ?? ''),
            groups: [...document.querySelectorAll('.lb-dialog .lb-decided-where')].map(g => g.textContent ?? ''),
            chron: [...document.querySelectorAll('.lb-dialog .lb-chron')].filter(l => !(/** @type {HTMLElement} */ (l).hidden)).map(l => l.textContent ?? ''),
        };
    });
}

/** @param {any} page @param {string} view */
async function tab(page, view) {
    await page.locator(`.lb-dialog .lb-tab[data-view="${view}"]`).click();
    await page.waitForTimeout(150);
}

const browser = await chromium.launch({ headless: !HEADED, channel: 'msedge' }).catch(() => chromium.launch({ headless: !HEADED }));
try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    /** @type {string[]} */
    const errors = [];
    page.on('pageerror', (/** @type {any} */ error) => errors.push(String(error?.message ?? error)));
    page.on('console', (/** @type {any} */ message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route(`${BASE}/**`, async (/** @type {any} */ route) => {
        const url = new URL(route.request().url());
        if (url.pathname === '/' || url.pathname === '/libro.html') {
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
    await page.goto(`${BASE}/libro.html`);
    await page.waitForFunction(() => window.harnessReady === true, null, { timeout: 15000 });

    // --- Strahd, en el capítulo 3.
    const strahd = await strahdBook(page);
    const notes = [
        { title: 'Lo que viene', items: ['Empieza el otoño, en 4 días.'] },
        { title: 'Lo que se oye', items: ['«En el molino hacen pasteles que dan sueños» (Arik, Vallaki)'] },
    ];
    const chronicle = [
        { category: 'grupo', title: 'El grupo', items: ['Ada sube a nivel 2.'] },
        { category: 'mundo', title: 'El mundo', items: ['El barón prepara otra fiesta.'] },
    ];
    await openBook(page, { book: strahd, pack: 'strahd', notes, chronicle });
    let seen = await readBook(page);
    check('Se abre el libro de Strahd, por el capítulo en el que estáis', seen.open && seen.title === 'La Maldición de Strahd' && seen.view === 'chapter:3', JSON.stringify({ title: seen.title, view: seen.view }));
    check('Bajo el título, por qué capítulo vais', seen.now === 'Vais por el capítulo 3 de 5: Vallaki y sus alrededores.', seen.now);
    const chapterTabs = seen.tabs.filter(t => t.view.startsWith('chapter:'));
    check('El índice: dos hechos, el de ahora y dos en blanco', JSON.stringify(chapterTabs.map(t => t.state)) === JSON.stringify(['hecho', 'hecho', 'ahora', 'en-blanco', 'en-blanco']), JSON.stringify(chapterTabs));
    check('Los que no han empezado no dicen su nombre (no se destripa)', chapterTabs.slice(3).every(t => t.off && t.name.startsWith('Capítulo') && t.note === 'En blanco')
        && !JSON.stringify(seen.tabs).includes('Ravenloft'), JSON.stringify(chapterTabs.slice(3)));
    check('El de ahora dice «Aquí estáis»', chapterTabs[2].note === 'Aquí estáis' && chapterTabs[2].on, JSON.stringify(chapterTabs[2]));
    check('Detrás de los capítulos: lo decidido y los apuntes', seen.tabs.some(t => t.view === 'decided' && t.note === '7') && seen.tabs.some(t => t.view === 'notes'), JSON.stringify(seen.tabs.slice(5)));
    check('La página: su título y su entrada', seen.chapter === 'Vallaki y sus alrededores' && /ciudad amurallada/.test(seen.epigraph), `${seen.chapter} | ${seen.epigraph}`);
    const open3 = seen.entries.filter(e => e.state === 'abierto');
    check('Lo abierto del capítulo 3, con «Lo que toca»', open3.length === 3 && open3.every(e => /^Lo que toca:/.test(e.hint) && e.tag === 'Entre manos'), JSON.stringify(open3));
    check('El festival, hecho, y lo que salió de él', seen.entries.some(e => e.id === 'panico-en-el-festival' && e.state === 'hecho' && e.came.some(c => /^Llevó a /.test(c))), JSON.stringify(seen.entries[0]));
    check('Por el camino: lo decidido en Vallaki y en la fiesta', seen.lists.some(l => l.title === 'Por el camino decidisteis' && l.items.some(i => /fiesta del barón/.test(i))), JSON.stringify(seen.lists));
    check('Lo que movió la historia, sin tiradas ni el hilo', seen.lists.some(l => l.title === 'Lo que pasó por el camino' && l.items.some(i => /Strahd os mira/.test(i)))
        && !JSON.stringify(seen.lists).includes('Percepción'), JSON.stringify(seen.lists));
    check('La viñeta del sitio carga', await page.evaluate(() => {
        const img = /** @type {HTMLImageElement|null} */ (document.querySelector('.lb-dialog .lb-vignette img'));
        return !img || (img.complete && img.naturalWidth > 0);
    }), seen.vignette);
    await shoot(page, 'Strahd, capítulo 3');

    await tab(page, 'chapter:1');
    seen = await readBook(page);
    const first = seen.entries[0];
    check('Capítulo 1: tres hitos hechos, con el género del grupo', seen.entries.length === 3 && seen.entries.every(e => e.state === 'hecho') && seen.chapter === 'La aldea de Barovia', JSON.stringify(seen.entries.map(e => e.title)));
    check('Lo que decidisteis en la taberna, y lo que salió', first.said.some(s => /Nosotras nos encargamos/.test(s)) && first.came.includes('Ismark os mira mejor.'), JSON.stringify(first));
    check('La tirada de la mansión, con lo que salió', seen.entries[1].came.includes('La tirada salió bien.') && seen.entries[1].came.includes('Ireena os mira mejor.'), JSON.stringify(seen.entries[1]));
    check('Lo que os contaron y el suceso del carro, en su capítulo', seen.lists.some(l => l.title === 'Lo que os contaron' && /Ismark: Mi padre/.test(l.items.join('')))
        && seen.lists.some(l => l.title === 'Por el camino decidisteis' && l.items.some(i => /Un carro volcado/.test(i) && /linterna/.test(i))), JSON.stringify(seen.lists));
    check('El cierre del capítulo', /^Quedó hecho: Sangrienta Bienvenida, Asedio en la Mansión y El Grito en el Sótano\.$/.test(seen.closing), seen.closing);
    check('La letra grande del capítulo', await page.evaluate(() => {
        const text = document.querySelector('.lb-dialog .lb-entries > .lb-entry:first-child .lb-entry-text');
        return Boolean(text) && Number.parseFloat(window.getComputedStyle(/** @type {Element} */ (text), '::first-letter').fontSize) > 40;
    }));
    await shoot(page, 'Strahd, capítulo 1');

    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(150);
    seen = await readBook(page);
    check('La flecha derecha pasa al capítulo 2', seen.view === 'chapter:2' && seen.chapter === 'El campamento vistani' && seen.folio === '2 / 5', `${seen.view} ${seen.folio}`);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(150);
    seen = await readBook(page);
    check('Y no pasa a un capítulo en blanco', seen.view === 'chapter:3', seen.view);
    await page.locator('.lb-dialog .lb-tab[data-view="chapter:4"]').click({ force: true });
    await page.waitForTimeout(150);
    check('Pulsar uno en blanco no hace nada', (await readBook(page)).view === 'chapter:3');
    check('Al pie, «Capítulo 4» apagado', await page.evaluate(() => /** @type {HTMLButtonElement|null} */ (document.querySelector('.lb-dialog .lb-turn-next'))?.disabled === true));

    // --- J11.5: lo decidido, con su buscador.
    await tab(page, 'decided');
    seen = await readBook(page);
    check('Lo que decidisteis: todo, por capítulos', seen.count === '7 decisiones' && seen.groups.length === 3 && seen.decided.length === 7, JSON.stringify({ count: seen.count, groups: seen.groups }));
    await page.locator('.lb-dialog .lb-search').fill('ireena');
    await page.waitForTimeout(150);
    seen = await readBook(page);
    check('Buscar «ireena»: lo de la mansión (sin mirar mayúsculas)', seen.count === '1 de 7' && /Ireena viene/.test(seen.decided[0] ?? ''), JSON.stringify(seen.decided));
    await page.locator('.lb-dialog .lb-search').fill('linterna');
    await page.waitForTimeout(150);
    seen = await readBook(page);
    check('Buscar en lo que salió: la linterna del buhonero', seen.decided.length === 1 && /Un carro volcado/.test(seen.decided[0]), JSON.stringify(seen.decided));
    await page.locator('.lb-dialog .lb-search').fill('dragón');
    await page.waitForTimeout(150);
    check('Sin nada, lo dice', (await readBook(page)).count === 'Nada con «dragón».');
    await page.locator('.lb-dialog .lb-search').fill('');
    await page.locator('.lb-dialog .lb-search').press('ArrowLeft');
    check('Las flechas en el buscador no pasan de capítulo', (await readBook(page)).view === 'decided');
    await shoot(page, 'lo que decidisteis');

    await tab(page, 'notes');
    seen = await readBook(page);
    check('Los apuntes de siempre siguen, con la crónica', seen.lists.some(l => l.title === 'Lo que viene') && seen.chron.length === 2, JSON.stringify(seen.lists));
    await page.locator('.lb-dialog .lb-filter[data-cat="mundo"]').click();
    await page.waitForTimeout(100);
    check('El filtro de la crónica', JSON.stringify((await readBook(page)).chron) === JSON.stringify(['El mundo: El barón prepara otra fiesta.']));
    await shoot(page, 'apuntes');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    check('Escape cierra el libro', !(await readBook(page)).open && await page.evaluate(() => window.bookClosed === true));

    // --- 1387: la nieve manchada, a un día.
    const valley = await page.evaluate(async () => {
        const { book, plot } = window.harness;
        const data = await (await fetch('mundos/1387.pack.json')).json();
        const read = plot.readPlot(data.plot);
        const done = ['el-caliz-ensangrentado', 'el-precio-del-escape', 'la-pista-en-el-barro', 'el-invierno-cierra-el-paso', 'el-hambre-de-los-lobos', 'la-oferta-del-castillo', 'la-vanguardia-de-keller', 'el-paso-de-los-contrabandistas'];
        const since = Object.fromEntries(done.map((id, i) => [id, i + 1]));
        const state = { open: ['la-nieve-manchada', 'la-soga-de-darek'], done, since: { ...since, 'la-nieve-manchada': 20, 'la-soga-de-darek': 1 } };
        const focusBar = document.getElementById('focus');
        const clock = book.focusClock(read, state, 22, 'la-nieve-manchada');
        const badge = window.harness.deadlineBadge(clock);
        if (badge && focusBar) focusBar.appendChild(badge);
        return book.buildStoryBook({ plot: read, state, today: 22, who: { heroe: 'Hombre' } });
    });
    const shellBadge = await page.evaluate(() => {
        const badge = document.querySelector('#focus .lb-badge');
        return { text: badge?.textContent ?? '', urgency: /** @type {HTMLElement|null} */ (badge)?.dataset.urgency ?? '' };
    });
    check('J9.5: en la cabecera del juego, el reloj de lo que tenéis entre manos', shellBadge.text === 'Queda 1 día' && shellBadge.urgency === 'pronto', JSON.stringify(shellBadge));
    await openBook(page, { book: valley, pack: '1387' });
    seen = await readBook(page);
    check('J9.5: arriba del libro, el plazo con su nombre', seen.clocks.length === 1 && seen.clocks[0].text === '«La nieve manchada»: queda 1 día de 3.' && seen.clocks[0].urgency === 'pronto', JSON.stringify(seen.clocks));
    const snow = seen.entries.find(e => e.id === 'la-nieve-manchada');
    check('Y en su página, junto a lo que toca', snow?.clock === 'Queda 1 día' && /^Lo que toca:/.test(snow?.hint ?? ''), JSON.stringify(snow));
    check('1387 va por su capítulo 2, con su nombre', seen.now === 'Vais por el capítulo 2 de 3: La guerra bajo la nieve.' && seen.chapter === 'La guerra bajo la nieve', seen.now);
    check('El secreto sin encontrar no sale', !seen.entries.some(e => e.id === 'la-soga-de-darek'));
    await shoot(page, '1387, con plazo');
    await page.locator('.lb-dialog .lb-close').click();
    await page.waitForTimeout(150);

    // --- El móvil.
    await page.setViewportSize({ width: 390, height: 844 });
    await openBook(page, { book: strahd, pack: 'strahd', notes, chronicle });
    const phone = await page.evaluate(() => {
        const toc = /** @type {HTMLElement} */ (document.querySelector('.lb-dialog .lb-toc'));
        const dialog = /** @type {HTMLElement} */ (document.querySelector('.lb-dialog'));
        const page = /** @type {HTMLElement} */ (document.querySelector('.lb-dialog .lb-page'));
        const tabs = [...document.querySelectorAll('.lb-dialog .lb-tab')].map(t => t.getBoundingClientRect());
        return {
            row: window.getComputedStyle(toc).flexDirection,
            dialogWidth: dialog.getBoundingClientRect().width,
            pageOverflow: page.scrollWidth - page.clientWidth,
            tall: Math.min(...tabs.map(r => r.height)),
            close: /** @type {HTMLElement} */ (document.querySelector('.lb-dialog .lb-close')).getBoundingClientRect().height,
        };
    });
    check('En el móvil: el índice en una tira, la ventana a lo ancho y nada se sale', phone.row === 'row' && phone.dialogWidth <= 390 && phone.pageOverflow <= 1, JSON.stringify(phone));
    check('Botones de dedo (44 px)', phone.tall >= 43 && phone.close >= 43, JSON.stringify(phone));
    await shoot(page, 'Strahd en el móvil');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    await page.setViewportSize({ width: 1280, height: 860 });

    // --- J9.3 y J11.5: el tablón del gremio. La crónica que se guarda es la del libro de Strahd.
    await page.evaluate((/** @type {any} */ full) => { window.strahdForGuild = full; }, strahd);
    await page.evaluate(async () => {
        const { book, plot, hub, openHubBoard, Popup } = window.harness;
        const worlds = (await (await fetch('mundos/mundos.json')).json()).worlds;
        const data = await (await fetch('mundos/strahd.pack.json')).json();
        const read = plot.readPlot(data.plot);
        // Lo que haría el juego al volver al gremio: apuntar el capítulo y guardar la crónica.
        let record = hub.withHubCampaign({}, 'strahd', { worldName: 'Strahd · Ada', chapter: book.guildChapterLine(read, window.lastState) });
        record = hub.withHubCampaign(record, '1387', { worldName: '1387 · Ada', finished: true, ending: 'El yugo de hierro' });
        const stored = book.withChronicle({}, 'strahd', window.strahdForGuild);
        const cards = hub.hubCampaignCards({ worlds, hub: record, level: 3 });
        window.boardDone = false;
        openHubBoard({ Popup, POPUP_TYPE: {}, cards, chronicles: book.readChronicles(JSON.parse(JSON.stringify(stored))) }).then(() => { window.boardDone = true; });
    });
    await page.waitForSelector('dialog.stub-popup [data-campaign="strahd"]', { timeout: 10000 });
    await page.waitForTimeout(300);
    const board = await page.evaluate(() => {
        const tile = document.querySelector('[data-campaign-tile="strahd"]');
        return {
            chapter: tile?.querySelector('.hb-chapter')?.textContent ?? '',
            state: tile?.querySelector('.hb-state')?.textContent ?? '',
            chronicle: Boolean(tile?.querySelector('[data-campaign-chronicle="strahd"]')),
            other: Boolean(document.querySelector('[data-campaign-chronicle="1387"]')),
        };
    });
    check('J9.3: la tarjeta de Strahd dice por qué capítulo ibais', board.chapter === 'Capítulo 3 de 5: Vallaki y sus alrededores' && board.state === 'En curso', JSON.stringify(board));
    check('J11.5: y lleva «La crónica» debajo; la que no tiene crónica, no', board.chronicle && !board.other, JSON.stringify(board));
    await page.locator('[data-campaign-tile="strahd"]').scrollIntoViewIfNeeded();
    await shoot(page, 'el tablón, con el capítulo');
    await page.locator('[data-campaign-chronicle="strahd"]').click();
    await page.waitForSelector('dialog.lb-dialog[open]', { timeout: 10000 });
    await page.waitForTimeout(250);
    seen = await readBook(page);
    check('La crónica se abre encima del tablón, por lo decidido', seen.kicker === 'La crónica' && seen.view === 'decided' && seen.decided.length === 7, JSON.stringify({ kicker: seen.kicker, view: seen.view, n: seen.decided.length }));
    check('Sin relojes en el gremio: allí no corren', seen.clocks.length === 0);
    await shoot(page, 'la crónica, desde el tablón');
    await tab(page, 'chapter:1');
    check('Y se lee por capítulos, como el libro', (await readBook(page)).entries.length === 3);
    await page.locator('.lb-dialog .lb-close').click();
    await page.waitForTimeout(200);
    check('Al cerrarla, el tablón sigue ahí', await page.evaluate(() => Boolean(document.querySelector('dialog.stub-popup[open] [data-campaign="strahd"]')) && !document.querySelector('dialog.lb-dialog')));

    check('Sin errores en la consola', errors.length === 0, errors.join(' | '));
} finally {
    await browser.close();
}

console.log(`\n${failures === 0 ? 'Todo bien' : `${failures} fallo(s)`}.`);
process.exit(failures === 0 ? 0 : 1);
