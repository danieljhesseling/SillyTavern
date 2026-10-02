#!/usr/bin/env node
/**
 * J14 en el navegador: la quedada como novela visual (`ui/meetup-scene.js`), encima del Modo
 * Juego, contra un servidor propio con un `--dataRoot` temporal (como `e2e-gremio.mjs`).
 *
 * Todavía no hay pegamento en party.js, así que la página importa los módulos y los abre ella:
 *
 *   el compendio carga `charlas` y `quedadas` → la escena de rango 1 de Gerd, jugada con el
 *   ratón y con el teclado (1-3 eligen, Intro sigue), con su cara según lo que contesta, y lo
 *   que queda al acabar → el selector de con quién y dónde, con la gente de Puerto Alba →
 *   la escena de rango 2 de Ismark (J14.5), entera → una charla corta de Tomás → dejarla a
 *   medias → y el Modo Juego no se entera de las teclas mientras tanto.
 *
 * Uso:
 *   node tools/e2e-quedadas.mjs --port 8153 --captura C:/tmp/quedadas.png
 *   (las capturas salen como quedadas-1-gerd.png, quedadas-2-respuesta.png…)
 */

/* global window, document */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8131;
const BASE = `http://127.0.0.1:${PORT}`;
const HEADED = process.argv.includes('--headed');
const SHOT = argAfter('--captura');
const shot = (/** @type {string} */ name) => (SHOT ? SHOT.replace(/(\.png)?$/i, `-${name}.png`) : '');

const require = createRequire(join(ROOT, 'tests/package.json'));
const { chromium } = require('@playwright/test');

let failures = 0;
const check = (/** @type {string} */ name, /** @type {boolean} */ ok, detail = '') => {
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        -> ${detail}` : ''}`);
};

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-quedadas-'));
/** @type {any} */
let server = null;
/** @type {any} */
let browser = null;

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

try {
    await startServer();
    browser = await chromium.launch({ channel: 'msedge', headless: !HEADED });
    const context = await browser.newContext({ viewport: { width: 1400, height: 950 } });
    const page = await context.newPage();
    /** @type {string[]} */
    const problems = [];
    page.on('pageerror', (/** @type {any} */ e) => problems.push(`PAGEERROR ${e.message}`));
    page.on('console', (/** @type {any} */ m) => {
        if (m.type() === 'error' && !/Failed to load resource.*404/.test(m.text())) problems.push(`ERROR ${m.text().slice(0, 300)}`);
    });
    await context.addInitScript(() => {
        try {
            window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,travel,prisoners,mesa,high,spell,pet,bill');
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
        } catch { /* nada */ }
    });

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    const firstRun = page.locator('text=Welcome to SillyTavern!');
    if (await firstRun.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#game-shell', { timeout: 90000 });
    await page.waitForTimeout(1500);

    // 0. El compendio trae las dos baterías nuevas, sin errores.
    const loaded = await page.evaluate(async () => {
        const { getCompendium } = await import('/scripts/game-engine/compendio/browser.js');
        const result = await getCompendium();
        return { loaded: result.loaded, errors: result.errors, charlas: result.compendium.count('charlas'), quedadas: result.compendium.count('quedadas') };
    });
    check('el compendio carga las charlas y las quedadas, sin errores', loaded.loaded.includes('charlas') && loaded.loaded.includes('quedadas')
        && loaded.errors.length === 0 && loaded.charlas >= 150 && loaded.quedadas >= 80, JSON.stringify({ ...loaded, loaded: loaded.loaded.slice(-3) }));

    /** Lo que se ve en la escena abierta. */
    const view = () => page.evaluate(() => {
        const dialog = document.querySelector('.qd-dialog[open]');
        const img = /** @type {HTMLImageElement|null} */ (dialog?.querySelector('.qd-portrait img'));
        return {
            open: Boolean(dialog),
            name: dialog?.querySelector('.qd-nameplate')?.textContent ?? '',
            title: dialog?.querySelector('.qd-title')?.textContent ?? '',
            step: dialog?.querySelector('.qd-step')?.textContent ?? '',
            lines: [...(dialog?.querySelectorAll('.qd-line') ?? [])].map(l => `${l.className.replace('qd-line qd-', '')}: ${(l.textContent ?? '').trim()}`),
            chips: [...(dialog?.querySelectorAll('.qd-chip') ?? [])].map(c => (c.textContent ?? '').trim()),
            portrait: img?.getAttribute('src') ?? '',
            drawn: Boolean(img && img.naturalWidth > 0),
            backdrop: (/** @type {HTMLElement|null} */ (dialog?.querySelector('.qd-backdrop')))?.style.getPropertyValue('--qd-backdrop') ?? '',
            inShell: Boolean(dialog?.closest('.gs-root')),
        };
    });
    const shellScene = () => page.evaluate(() => document.querySelector('#game-shell')?.getAttribute('data-scene') ?? '');

    // 1. La escena de rango 1 de Gerd, en la posada, con lo que queda al acabar.
    await page.evaluate(async () => {
        const w = /** @type {any} */ (window);
        const m = await import('/scripts/game-engine/campaign/meetups.js');
        const ui = await import('/scripts/game-engine/ui/meetup-scene.js');
        const { createBondState } = await import('/scripts/game-engine/campaign/bonds.js');
        const data = m.readMeetupRows(await (await fetch('/compendio/quedadas.json')).json());
        const hero = { name: 'Tessa', gender: 'Mujer' };
        const scene = m.renderScene(m.meetupFor({ person: { name: 'Gerd el Mellado' }, rank: 1, data, talkRows: [], social: null, random: Math.random }).scene, { hero });
        w.__qd = { result: null };
        void ui.openMeetupScene({
            scene, person: { name: 'Gerd el Mellado', className: 'guerrero', gender: 'Hombre' }, pack: 'gremio', place: 'posada', placeLabel: 'La posada',
            summarize: (/** @type {any} */ choices) => {
                const outcome = m.sceneOutcome({ scene, choices, likedPlace: true });
                const result = m.applyMeetup({ bonds: createBondState(), bondKey: '2', outcome, data, name: 'Gerd el Mellado' });
                return m.meetupSummary({ name: 'Gerd el Mellado', result, outcome });
            },
        }).then((/** @type {any} */ r) => { w.__qd.result = r; });
    });
    await page.waitForSelector('.qd-dialog[open] .qd-chip', { timeout: 15000 });
    await page.waitForTimeout(700);
    const sceneBefore = await shellScene();
    let seen = await view();
    check('la escena se abre dentro del Modo Juego, con el nombre, el título y el paso', seen.inShell && seen.name === 'Gerd el Mellado' && /Los dientes · La posada/.test(seen.title) && seen.step === '1 / 3', JSON.stringify(seen));
    check('el retrato de Gerd, alegre, dibujado; y detrás, la posada', /gerd-el-mellado--alegre\.png/.test(seen.portrait) && seen.drawn && /sitios\/taberna/.test(seen.backdrop), `${seen.portrait} ${seen.backdrop}`);
    check('lo que pasa, lo que dice y tres respuestas', seen.lines.length === 2 && /^note: Gerd se sienta/.test(seen.lines[0]) && seen.chips.length === 3, JSON.stringify(seen));
    if (shot('1-gerd')) await page.screenshot({ path: shot('1-gerd') });

    await page.locator('.qd-dialog[open] .qd-chip-reply').nth(2).click();
    await page.waitForTimeout(400);
    seen = await view();
    check('contestar algo que no le gusta: tu respuesta, la suya y la cara enfadada', seen.lines.some(l => /^you: Tú/.test(l)) && seen.lines.some(l => /^then: Vaya/.test(l))
        && /gerd-el-mellado--enfadado\.png/.test(seen.portrait) && seen.chips.length === 1 && /Seguir/.test(seen.chips[0]), JSON.stringify(seen));
    if (shot('2-respuesta')) await page.screenshot({ path: shot('2-respuesta') });

    // Con el teclado: Intro sigue, 2 elige la segunda.
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    seen = await view();
    check('Intro pasa al paso siguiente', seen.step === '2 / 3' && seen.chips.length === 3, JSON.stringify(seen));
    await page.keyboard.press('2');
    await page.waitForTimeout(300);
    seen = await view();
    check('la tecla 2 elige la segunda respuesta, y su cara cambia', seen.lines.some(l => /^you: Tú.*escudo funcionaba/.test(l)) && /--alegre\.png/.test(seen.portrait), JSON.stringify(seen));
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    seen = await view();
    check('el último paso cierra con Terminar', seen.step === '3 / 3' && seen.chips.length === 1 && /Terminar/.test(seen.chips[0]), JSON.stringify(seen));
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    seen = await view();
    check('al acabar, lo que queda: cuánto os acercáis', seen.lines.some(l => /summary: Te acercas a Gerd el Mellado \(\+\d+ de vínculo\)/.test(l)) && /Cerrar/.test(seen.chips.join(' ')), JSON.stringify(seen));
    if (shot('3-final')) await page.screenshot({ path: shot('3-final') });
    await page.locator('.qd-dialog[open] .qd-chip-finish').click();
    await page.waitForTimeout(400);
    const result = await page.evaluate(() => /** @type {any} */ (window).__qd.result);
    check('se cierra y devuelve lo elegido', !(await view()).open && result?.finished === true && JSON.stringify(result?.choices) === JSON.stringify([{ beat: 0, reply: 2 }, { beat: 1, reply: 1 }]), JSON.stringify(result));
    check('el Modo Juego no se enteró de las teclas (1-4 cambian su escena)', (await shellScene()) === sceneBefore, `${sceneBefore} -> ${await shellScene()}`);

    // 2. El selector: con quién y dónde, con la gente de Puerto Alba por la tarde.
    await page.evaluate(async () => {
        const w = /** @type {any} */ (window);
        const m = await import('/scripts/game-engine/campaign/meetups.js');
        const where = await import('/scripts/game-engine/campaign/whereabouts.js');
        const ui = await import('/scripts/game-engine/ui/meetup-scene.js');
        const data = m.readMeetupRows(await (await fetch('/compendio/quedadas.json')).json());
        const pack = await (await fetch('/mundos/gremio.pack.json')).json();
        const merc = (/** @type {number} */ id, /** @type {string} */ name) => ({ id, name, hp: 16, maxHp: 16, guest: { kind: 'mercenary' }, reasons: { wants: 'coin' } });
        const here = where.whoIsWhere({
            town: 'Puerto Alba', location: pack.locations[0], slot: 'afternoon', hub: true, data,
            townsfolk: pack.npcs, party: [{ id: 1, name: 'Tessa' }, merc(2, 'Gerd el Mellado'), merc(3, 'Nella Tresflechas')],
            hirelings: [{ name: 'Osric Mediapaga', className: 'guerrero', gender: 'Hombre' }],
            wants: (/** @type {any} */ p) => m.wantsToMeet({ person: { name: p.name }, rank: 1, data, social: { seen: { 'nella-tresflechas': ['gremio-nella-1'] } } }),
        });
        const places = where.placesOf(pack.locations[0], { hub: true });
        const people = here.people.filter(p => p.canMeet).map(p => ({
            ...p, placeLabel: where.placeLabel(p.place), rankLabel: 'Vínculo 1',
            className: m.personOf(data, p.name)?.className, gender: m.personOf(data, p.name)?.gender,
        }));
        w.__qd = { picked: undefined, people: people.map(p => `${p.name}@${p.place}${p.wantsToMeet ? '*' : ''}`) };
        void ui.openMeetupPicker({
            people, pack: 'gremio', slotLabel: 'Tarde',
            placesFor: (/** @type {any} */ person) => where.meetPlaces({ places, slot: 'afternoon', current: person.place, person: m.personOf(data, person.name) }),
        }).then((/** @type {any} */ r) => { w.__qd.picked = r; });
    });
    await page.waitForSelector('.qd-dialog[open] .qd-pick-card', { timeout: 15000 });
    await page.waitForTimeout(700);
    const cards = await page.evaluate(() => [...document.querySelectorAll('.qd-dialog[open] .qd-pick-card')].map(c => ({
        name: c.querySelector('.qd-pick-name')?.textContent ?? '', where: c.querySelector('.qd-pick-where')?.textContent ?? '',
        eager: c.classList.contains('qd-eager'), drawn: /** @type {HTMLImageElement|null} */ (c.querySelector('img'))?.naturalWidth ?? 0,
    })));
    const people = await page.evaluate(() => /** @type {any} */ (window).__qd.people);
    check('el selector: tu gente de Puerto Alba, quien quiere quedar delante, con su cara y su sitio', cards.length === 3 && cards[0].eager
        && cards.every(c => c.drawn > 0 && /Vínculo 1/.test(c.where)), JSON.stringify({ cards, people }));
    if (shot('4-selector')) await page.screenshot({ path: shot('4-selector') });
    await page.locator('.qd-dialog[open] .qd-pick-card', { hasText: 'Gerd el Mellado' }).click();
    await page.waitForTimeout(400);
    const placesShown = await page.evaluate(() => [...document.querySelectorAll('.qd-dialog[open] .qd-chip-place')].map(c => `${c.getAttribute('data-place')}${c.querySelector('.qd-liked') ? '♥' : ''}`));
    check('dónde: los sitios abiertos, el suyo primero y los que le gustan con corazón', placesShown[0] === 'plaza' && placesShown.includes('muelle♥') && placesShown.includes('posada♥'), JSON.stringify(placesShown));
    if (shot('5-donde')) await page.screenshot({ path: shot('5-donde') });
    await page.locator('.qd-dialog[open] .qd-chip-place[data-place="muelle"]').click();
    await page.waitForTimeout(300);
    const picked = await page.evaluate(() => /** @type {any} */ (window).__qd.picked);
    check('devuelve con quién y dónde', picked?.name === 'Gerd el Mellado' && picked?.place === 'muelle', JSON.stringify(picked));

    // 3. J14.5: la escena de rango 2 de Ismark, de Strahd, jugada entera, de noche en la posada.
    await page.evaluate(async () => {
        const w = /** @type {any} */ (window);
        const m = await import('/scripts/game-engine/campaign/meetups.js');
        const ui = await import('/scripts/game-engine/ui/meetup-scene.js');
        const data = m.readMeetupRows(await (await fetch('/compendio/quedadas.json')).json());
        const pack = await (await fetch('/mundos/strahd.pack.json')).json();
        const ismark = pack.confidants.find((/** @type {any} */ c) => c.name === 'Ismark Kolyanovich');
        const scene = m.renderScene(m.meetupFor({ person: { name: ismark.name, bondScenes: ismark.scenes }, rank: 2, data, talkRows: [], social: null, random: Math.random, campaign: 'strahd' }).scene, { hero: { name: 'Bruno', gender: 'Hombre' } });
        w.__qd = { result: null, id: scene.id, beats: scene.beats.length };
        void ui.openMeetupScene({ scene, person: { name: ismark.name }, pack: 'strahd', place: 'posada', night: true, placeLabel: 'Aldea de Barovia' })
            .then((/** @type {any} */ r) => { w.__qd.result = r; });
    });
    await page.waitForSelector('.qd-dialog[open] .qd-chip', { timeout: 15000 });
    await page.waitForTimeout(700);
    seen = await view();
    check('Ismark, con su retrato y la posada de noche detrás', seen.name === 'Ismark Kolyanovich' && /ismark-kolyanovich/.test(seen.portrait) && seen.drawn && /taberna-noche/.test(seen.backdrop), JSON.stringify(seen));
    if (shot('6-ismark')) await page.screenshot({ path: shot('6-ismark') });
    /** @type {string[]} */
    const read = [];
    for (let i = 0; i < 12 && (await view()).open; i++) {
        const now = await view();
        read.push(...now.lines);
        if (await page.locator('.qd-dialog[open] .qd-chip-reply').count() > 0) await page.locator('.qd-dialog[open] .qd-chip-reply').first().click();
        else await page.locator('.qd-dialog[open] .qd-chip').first().click();
        await page.waitForTimeout(250);
    }
    const ismark = await page.evaluate(() => /** @type {any} */ (window).__qd);
    check('la escena de rango 2 de Ismark, jugada entera (J14.5)', ismark.id === 'strahd-ismark-2' && ismark.result?.finished === true
        && ismark.result.choices.length >= 2 && read.some(l => /Menor/.test(l)) && !read.some(l => /[{}|]/.test(l)), JSON.stringify({ ...ismark, read: read.length }));

    // 4. Una charla corta: Tomás, en la posada. Y dejarla a medias.
    await page.evaluate(async () => {
        const w = /** @type {any} */ (window);
        const t = await import('/scripts/game-engine/campaign/small-talk.js');
        const ui = await import('/scripts/game-engine/ui/meetup-scene.js');
        const rows = t.readTalkRows(await (await fetch('/compendio/charlas.json')).json());
        const { talk } = t.pickTalk({ rows, person: { name: 'Tomás' }, moment: 'pueblo', social: null, random: () => 0, hero: { name: 'Tessa', gender: 'Mujer' }, slot: 'night' });
        w.__qd = { result: null };
        void ui.openMeetupScene({ scene: t.talkScene(/** @type {any} */ (talk)), person: { name: 'Tomás' }, pack: 'gremio', place: 'posada', night: true })
            .then((/** @type {any} */ r) => { w.__qd.result = r; });
    });
    await page.waitForSelector('.qd-dialog[open] .qd-chip', { timeout: 15000 });
    await page.waitForTimeout(600);
    seen = await view();
    check('una charla de Tomás: sus frases y tres respuestas, con su retrato', seen.name === 'Tomás' && seen.chips.length === 3 && /tomas/.test(seen.portrait) && seen.drawn, JSON.stringify(seen));
    if (shot('7-charla')) await page.screenshot({ path: shot('7-charla') });
    await page.locator('.qd-dialog[open] .qd-leave').click();
    await page.waitForTimeout(300);
    const left = await page.evaluate(() => /** @type {any} */ (window).__qd.result);
    check('«Dejarlo para otro día» la cierra sin terminarla', !(await view()).open && left?.finished === false, JSON.stringify(left));

    // 5. En el compendio del menú, las charlas se ven como cualquier otra batería.
    await page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Compendio' }).click({ timeout: 5000 }).catch(() => {});
    await page.locator('.cx-root .cx-tab[data-domain="charlas"]').click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(600);
    const rows = await page.evaluate(() => document.querySelectorAll('.cx-root .cx-row:not(.cx-head)').length);
    check('el compendio enseña las charlas, para leerlas sin programar', rows >= 100, `${rows} filas`);
    if (shot('8-compendio')) await page.screenshot({ path: shot('8-compendio') });

    const mine = problems.filter(p => /meetup|quedad|charla|small-talk|whereabouts|day-parts|social\.js|qd-/i.test(p));
    check('sin errores de estos módulos en la consola', mine.length === 0, mine.join(' | '));
    if (problems.length > 0) console.log(`(otros avisos de la página: ${problems.length})`);
} catch (error) {
    failures++;
    console.log(`FAIL  el recorrido se paró: ${String(/** @type {any} */ (error)?.stack || error).slice(0, 800)}`);
} finally {
    await browser?.close().catch(() => {});
    server?.kill();
    try {
        rmSync(dataRoot, { recursive: true, force: true });
    } catch { /* el servidor aún lo tiene abierto */ }
}

console.log(failures === 0 ? '\nJ14 en el navegador: todo bien.' : `\n${failures} fallos.`);
process.exit(failures === 0 ? 0 : 1);
