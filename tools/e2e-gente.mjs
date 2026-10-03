#!/usr/bin/env node
/**
 * J14 en el juego de verdad (wiki/ROADMAP_SIN_CONEXION.md): tu gente en el pueblo del gremio,
 * con el pegamento de `party/social.js`. Contra un servidor propio con un `--dataRoot` temporal,
 * como `e2e-saltar-prueba.mjs`:
 *
 *   título → Jugar sin conexión → tu personaje → en el muelle, la fila no ofrece aún el tablón
 *   ni contratar (D-J28) → saltar la prueba → la cabecera enseña las partes del día (J14.2) →
 *   la pantalla del pueblo dice quién anda por dónde, sin corazones (J14.4, D-J63) → pulsar a
 *   Gerd: te saluda, «Pasar el rato con Gerd», su escena, entera; el vínculo sube y se va la
 *   mañana (J14.3, J14.2, D-J63) → pulsar a otro y «Hablamos en otro momento» no gasta tiempo
 *   (J14.1, D-J63) → `/quedar` abre el selector (J14.3) →
 *   contratar a Gerd se lleva lo vivido a su ficha (adoptBond) → con él a vínculo 2, avisa de
 *   que quiere quedar y la herrería cobra menos (bondDiscounts, J14.3).
 *
 * Uso:
 *   node tools/e2e-gente.mjs --port 8190 --captura C:/tmp/gente.png
 *   (las capturas salen como gente.png.pueblo.png, gente.png.quedada.png…)
 */

/* global window, document, HTMLElement */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { enElGremio } from './e2e-guiado.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8164;
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

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-gente-'));
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
 * Elegir en una tarjeta de «Crear personaje» la primera opción, o la que se parece a lo pedido.
 *
 * @param {any} target
 * @param {string} pick class | race | background
 * @param {string} wanted
 */
async function pickHeroCard(target, pick, wanted) {
    await target.locator(`.hc-root .hc-card[data-pick="${pick}"] .hc-pick`).click();
    await target.waitForSelector('.hc-picker .hc-option', { timeout: 15000 });
    const plain = (/** @type {string} */ v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const values = await target.evaluate(() => [...document.querySelectorAll('.hc-picker .hc-option')].map(o => o.getAttribute('data-value') || ''));
    const chosen = values.find(v => plain(v).includes(plain(wanted))) ?? values[0];
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
    page.on('pageerror', (/** @type {any} */ e) => problems.push(`PAGEERROR ${e.message}`));
    page.on('console', (/** @type {any} */ m) => {
        if (m.type() === 'error' && !/Failed to load resource.*404/.test(m.text())) problems.push(`ERROR ${m.text().slice(0, 300)}`);
    });
    await context.addInitScript(() => {
        try {
            window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,combat,travel,prisoners,mesa,high,spell,pet,bill,move,attack,roll,talk,journal');
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
            window.localStorage.setItem('sillytavern_gameSucesos', 'off');
            // Las escenas del hilo y las charlas escritas las mira e2e-historia; aquí taparían clics.
            window.localStorage.setItem('sillytavern_gameStoryWindows', 'off');
        } catch { /* nada */ }
    });

    /** Lo que el juego sabe ahora: el grupo, el hilo, los vínculos y lo social. */
    const state = () => page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const party = (await import('/scripts/party.js')).getPartyMembersSnapshot();
        const meta = ctx.chatMetadata ?? {};
        const bonds = meta.bonds?.bonds ?? {};
        return {
            world: String(meta.world_info ?? ''),
            party: party.map((/** @type {any} */ m) => ({ id: String(m.id), name: m.name, gold: Number(m.gold) || 0, guest: Boolean(m.guest) })),
            open: Array.isArray(meta.plotState?.open) ? meta.plotState.open : [],
            bonds: Object.fromEntries(Object.entries(bonds).map(([k, v]) => [k, Number(/** @type {any} */ (v)?.points) || 0])),
            slot: Number(meta.calendar?.slotIndex) || 0,
            day: Number(meta.calendar?.day) || 0,
            seen: meta.social?.seen ?? {},
        };
    });
    /** Todas las fichas de ahora, también las que no caben en la fila («+N más»). */
    const allChips = () => page.evaluate(async () => (await import('/scripts/party/shell.js')).buildShellChips(Infinity).map((/** @type {any} */ c) => c.label));
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
            await page.waitForTimeout(400);
        }
        return false;
    };
    const sceneNow = () => page.evaluate(() => document.querySelector('#game-shell')?.getAttribute('data-scene') || '');
    /** «Continuar», al acabar de leer, hasta la escena que toca. */
    const carryOn = async (/** @type {string} */ wanted) => {
        await until(async () => {
            if (await sceneNow() === wanted) return true;
            await page.evaluate(() => /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .gs-vn-box .gs-chip-continue'))?.click());
            return false;
        }, 12000);
        return sceneNow();
    };
    const dropToasts = () => page.evaluate(() => document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));
    /** J14.2: la tira de la cabecera. */
    const strip = () => page.evaluate(() => {
        const node = document.querySelector('#game-shell .gs-clock .gs-day-strip');
        return {
            title: node?.getAttribute('title') ?? '',
            parts: [...(node?.querySelectorAll('.gs-day-part') ?? [])].map(p => `${p.getAttribute('data-part')}:${[...p.classList].find(c => /^gs-day-(hecho|ahora|libre)$/.test(c))?.slice(7) ?? ''}`),
            visible: Boolean(node && node.getBoundingClientRect().width > 0),
        };
    });
    /** J14.4: la pantalla del pueblo, con tu gente. */
    const townPeople = () => page.evaluate(() => ({
        badges: [...document.querySelectorAll('#game-shell .gs-town-place .gs-town-you')].map(b => `${b.closest('.gs-town-place')?.getAttribute('data-place')}:${b.getAttribute('data-person')}${b.classList.contains('gs-town-wants') ? '♥' : ''}`),
        loose: [...document.querySelectorAll('#game-shell .gs-town-loose .gs-town-act')].map(b => `${b.getAttribute('data-chip')}${b.classList.contains('gs-town-wants') ? '♥' : ''}|${(b.textContent || '').trim()}`),
        places: [...document.querySelectorAll('#game-shell .gs-town-place')].map(c => c.getAttribute('data-place')),
    }));
    /** La ventana de quedar o charlar (`ui/meetup-scene.js`). */
    const meetup = () => page.evaluate(() => {
        const dialog = document.querySelector('.qd-dialog[open]');
        return {
            open: Boolean(dialog),
            name: dialog?.querySelector('.qd-nameplate')?.textContent ?? '',
            lines: [...(dialog?.querySelectorAll('.qd-line') ?? [])].map(l => (l.textContent ?? '').trim()),
            // D-J60: lo que se cuenta al acabar va fuera de la caja; D-J63: y el rango, en grande.
            aside: [...(dialog?.querySelectorAll('.vn-aside-line, .qd-rankup') ?? [])].map(l => (l.textContent ?? '').trim()),
            chips: [...(dialog?.querySelectorAll('.qd-chip') ?? [])].map(c => (c.textContent ?? '').trim()),
            picks: [...(dialog?.querySelectorAll('.qd-pick-card') ?? [])].map(c => c.querySelector('.qd-pick-name')?.textContent ?? ''),
        };
    });
    /** Jugar la escena abierta hasta el final: la primera respuesta, seguir, terminar, cerrar. */
    const playMeetup = async () => {
        /** @type {string[]} */
        const read = [];
        for (let i = 0; i < 16; i++) {
            const now = await meetup();
            if (!now.open) break;
            read.push(...now.lines, ...now.aside);
            if (await page.locator('.qd-dialog[open] .qd-chip-reply').count() > 0) await page.locator('.qd-dialog[open] .qd-chip-reply').first().click();
            else await page.locator('.qd-dialog[open] .qd-chip').first().click();
            await page.waitForTimeout(250);
        }
        return read;
    };

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    const firstRun = page.locator('text=Welcome to SillyTavern!');
    if (await firstRun.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#game-shell', { timeout: 90000 });

    // 1. Jugar sin conexión, con Iria.
    const offline = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Jugar sin conexión' });
    await until(async () => await offline.count() === 1, 30000);
    await offline.click();
    await page.waitForSelector('.hc-root', { timeout: 120000 });
    await page.fill('.hc-root .hc-name', 'Iria');
    await pickHeroCard(page, 'race', 'Humano');
    await pickHeroCard(page, 'class', 'Guerrero');
    await page.locator('.hc-root .hc-enter').click();
    await until(async () => /Gremio/.test((await state()).world), 60000);
    await until(() => chatHas(/Al ladrón/), 20000);
    await page.waitForTimeout(800);

    // 2. D-J28: el tablón y los mercenarios, escondidos hasta que acabe la prueba (también para quedar).
    const before = await allChips();
    // Si el prólogo ya está en su pelea (directo a la decisión), «Saltar la prueba» no va en la fila.
    check('en la prueba, ni el tablón ni contratar ni quedar con los mercenarios (D-J28)',
        !before.some((/** @type {string} */ c) => /Tablón de campañas|Contratar mercenarios|Quedar con/.test(c)), JSON.stringify(before));

    // 3. Saltar la prueba: después sí. Sin su botón en la fila, lo mismo que hace el botón.
    if (!(await clickChip(/^Saltar la prueba$/))) await page.evaluate(async () => { void (await import('/scripts/party/hub.js')).skipHubTrial(); });
    await page.waitForSelector('.popup:has-text("¿Saltar la prueba?")', { timeout: 10000 }).catch(() => {});
    await page.locator('.popup-button-ok:visible').first().click({ timeout: 5000 }).catch(() => {});
    await until(() => chatHas(/apunta tu nombre en el libro del gremio|Te saltas «|Ya subes|tengo el libro abierto/), 15000);
    await page.waitForTimeout(800);
    await dropToasts();
    const after = await allChips();
    // D-J63: sin «Quedar con alguien» en la fila: a tu gente se la pulsa en el pueblo.
    check('acabada la prueba, el tablón y contratar; «Quedar con alguien», no (D-J28, D-J63)',
        after.includes('Tablón de campañas') && after.includes('Contratar mercenarios') && !after.some((/** @type {string} */ c) => /^Quedar con|^Charlar con/.test(c)), JSON.stringify(after));

    // 4. J14.2: la cabecera enseña las partes del día.
    let day = await strip();
    check('la cabecera enseña las partes del día: la mañana ahora, la tarde y la noche libres (J14.2)',
        day.visible && day.parts.join(',') === 'morning:ahora,afternoon:libre,night:libre' && /Mañana: ahora/.test(day.title), JSON.stringify(day));

    // 5. J14.4: el pueblo dice quién de tu gente anda por dónde, y quién quiere quedar.
    const scene = await carryOn('exploration');
    await until(async () => (await townPeople()).places.length > 0, 10000);
    let town = await townPeople();
    const everyone = [...town.badges, ...town.loose].join(' ');
    // D-J63: sin corazones al principio.
    check('en el pueblo se ve a Gerd, Nella y Osric, con dónde están, y sin corazones al principio (J14.4, D-J63)',
        scene === 'exploration' && /gerd-el-mellado/.test(everyone) && /nella-tresflechas/.test(everyone) && /osric-mediapaga/.test(everyone) && !/♥/.test(everyone),
        JSON.stringify(town));
    if (SHOT) await page.screenshot({ path: `${SHOT}.pueblo.png` });

    // 6. J14.3 y D-J63: pulsar a Gerd, que por la mañana anda por el muelle: te saluda, «Pasar el
    //    rato con Gerd», y su escena, entera.
    // Por el pueblo (un sitio sin tarjeta) o dentro del sitio donde anda (el muelle, si tiene tarjeta).
    let gerdChip = page.locator('#game-shell .gs-town-loose .gs-town-act[data-chip="persona:gerd-el-mellado"]');
    const gerdPlace = town.badges.find(b => /:gerd-el-mellado/.test(b))?.split(':')[0] ?? '';
    if (await gerdChip.count() === 0 && gerdPlace) {
        await page.locator(`#game-shell .gs-town-place[data-place="${gerdPlace}"]`).click({ timeout: 5000 }).catch(() => {});
        await page.waitForSelector('#game-shell .gs-town-scene', { timeout: 8000 }).catch(() => {});
        gerdChip = page.locator('#game-shell .gs-town-scene .gs-town-act[data-action="persona:gerd-el-mellado"]');
    }
    const canMeetGerd = await gerdChip.count() === 1;
    if (canMeetGerd) await gerdChip.click();
    else await page.evaluate(() => { void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/invitacion Gerd'); });
    const invited = await page.waitForSelector('.qd-dialog[open] .qd-invite', { timeout: 15000 }).then(() => true).catch(() => false);
    if (SHOT) await page.screenshot({ path: `${SHOT}.invitacion.png` });
    // Su charla corta, si la trae dentro del saludo, se contesta primero.
    if (await page.locator('.qd-dialog[open] .qd-chip[data-choice="quedar"]').count() === 0) await page.locator('.qd-dialog[open] .qd-chip').first().click({ timeout: 5000 }).catch(() => {});
    const invite = await meetup();
    await page.locator('.qd-dialog[open] .qd-chip[data-choice="quedar"]').click({ timeout: 5000 }).catch(() => {});
    const opened = await page.waitForSelector('.qd-dialog[open] .qd-root:not(.qd-invite) .qd-chip', { timeout: 15000 }).then(() => true).catch(() => false);
    const first = await meetup();
    check('pulsar a Gerd (el muelle): te saluda y pregunta; «Pasar el rato con Gerd» abre su escena, con su nombre y sus respuestas (J14.3, D-J63)',
        canMeetGerd && invited && invite.chips.some(c => /Pasar el rato con Gerd/.test(c)) && invite.chips.some(c => /Hablamos en otro momento/.test(c))
        && opened && first.name === 'Gerd el Mellado' && first.chips.length >= 2, JSON.stringify({ invite, first }));
    if (SHOT) await page.screenshot({ path: `${SHOT}.quedada.png` });
    const bondsBefore = (await state()).bonds;
    const read = await playMeetup();
    await page.waitForTimeout(800);
    let now = await state();
    day = await strip();
    check('al acabar, el vínculo con Gerd sube y se cuenta (J14.3)', (now.bonds['gente:gerd-el-mellado'] ?? 0) > (bondsBefore['gente:gerd-el-mellado'] ?? 0)
        && await chatHas(/💞 \[VÍNCULO\] .*Gerd/) && read.some(l => /Gerd/.test(l)), JSON.stringify({ bonds: now.bonds, read: read.slice(-2) }));
    check('y se va la mañana: la cabecera dice «Con Gerd» y ahora es la tarde (J14.2)',
        now.slot === 1 && day.parts.join(',') === 'morning:hecho,afternoon:ahora,night:libre' && /Mañana: Con Gerd/.test(day.title), JSON.stringify({ slot: now.slot, day }));
    if (SHOT) await page.screenshot({ path: `${SHOT}.tarde.png` });
    await dropToasts();

    // 7. J14.1 y D-J63: pulsar a alguien de tu gente y «Hablamos en otro momento» (con su charla
    //    corta dentro del saludo, si la trae) no gasta tiempo.
    await carryOn('exploration');
    // Si se quedó dentro de un sitio (el muelle), a la plaza.
    await page.locator('#game-shell .gs-town-back').click({ timeout: 3000 }).catch(() => {});
    await until(async () => (await townPeople()).places.length > 0, 10000);
    town = await townPeople();
    const talkPlace = town.badges.find(b => /nella-tresflechas|osric-mediapaga/.test(b))?.split(':')[0] ?? '';
    /** @type {string} */
    let talked = '';
    if (talkPlace) {
        await page.locator(`#game-shell .gs-town-place[data-place="${talkPlace}"]`).click();
        await page.waitForSelector('#game-shell .gs-town-scene', { timeout: 8000 }).catch(() => {});
        const acts = await page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-town-scene .gs-town-act')].map(b => `${b.getAttribute('data-action')}|${(b.textContent || '').trim()}`));
        check('dentro de un sitio, «Tu gente»: una ficha con el nombre de quien está ahí, sin «Quedar con» ni «Charlar con» (J14.4, D-J63)',
            acts.some(a => /^persona:(nella|osric)/.test(a)) && !acts.some(a => /^(quedar|charlar):|Quedar con|Charlar con/.test(a)), JSON.stringify({ talkPlace, acts }));
        if (SHOT) await page.screenshot({ path: `${SHOT}.sitio.png` });
        const talkAct = page.locator('#game-shell .gs-town-scene .gs-town-act[data-action^="persona:"]').first();
        talked = String(await talkAct.getAttribute('data-action').catch(() => ''));
        await talkAct.click({ timeout: 5000 }).catch(() => {});
    }
    const talkOpen = await page.waitForSelector('.qd-dialog[open] .qd-invite', { timeout: 10000 }).then(() => true).catch(() => false);
    const talk = await meetup();
    if (await page.locator('.qd-dialog[open] .qd-chip[data-choice="luego"]').count() === 0) await page.locator('.qd-dialog[open] .qd-chip').first().click({ timeout: 5000 }).catch(() => {});
    await page.locator('.qd-dialog[open] .qd-chip[data-choice="luego"]').click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(600);
    now = await state();
    check('pulsar a Nella u Osric te saluda; «Hablamos en otro momento» cierra y no se lleva la tarde (J14.1, D-J63)',
        Boolean(talked) && talkOpen && talk.chips.length >= 2 && !(await meetup()).open && now.slot === 1, JSON.stringify({ talked, talk, slot: now.slot }));
    await page.locator('#game-shell .gs-town-back').click({ timeout: 5000 }).catch(() => {});
    await dropToasts();

    // 8. «Quedar con alguien» (la ficha, `/quedar`): el selector de con quién.
    await page.evaluate(() => { void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/quedar'); });
    const picker = await page.waitForSelector('.qd-dialog[open] .qd-pick-card', { timeout: 10000 }).then(() => true).catch(() => false);
    const picks = (await meetup()).picks;
    check('«Quedar con alguien» abre el selector con tu gente de aquí (J14.3)', picker && picks.length >= 2 && picks.includes('Gerd el Mellado'), JSON.stringify(picks));
    if (SHOT) await page.screenshot({ path: `${SHOT}.selector.png` });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    await page.evaluate(() => document.querySelectorAll('.qd-dialog[open]').forEach(d => /** @type {HTMLDialogElement} */ (d).close()));
    now = await state();
    check('cerrar el selector no gasta nada', now.slot === 1, JSON.stringify({ slot: now.slot }));

    // 9. Contratar a Gerd: lo vivido pasa a su ficha (adoptBond).
    const gerdPoints = now.bonds['gente:gerd-el-mellado'] ?? 0;
    // D-J62: contratar está en la Casa del Gremio (la fila de abajo ya no lo lleva).
    await enElGremio(page, 'hub-hire') || await page.evaluate(() => { void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/contratar'); });
    await page.waitForSelector('.hb-root [data-hireling="Gerd el Mellado"]', { timeout: 15000 });
    await page.locator('.hb-root [data-hireling="Gerd el Mellado"]').click();
    await until(async () => (await state()).party.length === 2, 10000);
    now = await state();
    const gerd = now.party.find(m => m.name === 'Gerd el Mellado');
    check('al contratar a Gerd, su vínculo viene con él: lo de la quedada pasa a su ficha (J14, adoptBond)',
        Boolean(gerd) && (now.bonds[String(gerd?.id)] ?? 0) === gerdPoints && gerdPoints > 0 && !('gente:gerd-el-mellado' in now.bonds), JSON.stringify({ gerd, bonds: now.bonds }));
    await dropToasts();

    // 10. D-J63: la primera quedada ya le subió a vínculo 2 (la herrería cobra menos, bondDiscounts).
    //     Con Gerd a vínculo 3 (lo que da la aventura): quiere quedar contigo.
    await page.evaluate(async (id) => {
        const time = await import('/scripts/party/time.js');
        const { getBondProgress } = await import('/scripts/game-engine/campaign/bonds.js');
        for (let i = 0; i < 6 && getBondProgress(time.getCampaignBonds(), String(id)).rank < 3; i++) time.recordCampaignBondEvent(String(id), 'confidant_scene');
    }, gerd?.id);
    await page.waitForTimeout(800);
    check('al subir de vínculo, Gerd avisa de que quiere quedar contigo (J14.3)', await chatHas(/💞 \[VÍNCULO\] Gerd el Mellado quiere quedar contigo/));
    await dropToasts();
    await carryOn('exploration');
    await until(async () => (await townPeople()).places.length > 0, 10000);
    // D-J62: contratar deja dentro de la Casa del Gremio; de ahí a la herrería, por su pestaña.
    const forgeTab = page.locator('#game-shell .gs-town-tab[data-place="herreria"]');
    if (await forgeTab.count() > 0) await forgeTab.click({ timeout: 5000 }).catch(() => {});
    else await page.locator('#game-shell .gs-town-place[data-place="herreria"]').click({ timeout: 5000 }).catch(() => {});
    await until(async () => await page.evaluate(() => document.querySelector('#game-shell .gs-town-scene')?.getAttribute('data-place') ?? '') === 'herreria', 8000);
    await page.waitForSelector('#game-shell .gs-town-scene', { timeout: 8000 }).catch(() => {});
    const forge = await page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-town-scene .gs-town-act')].map(b => (b.textContent || '').replace(/\s+/g, ' ').trim()));
    check('en la herrería, Gerd os consigue precio: la capa, 9 de oro en vez de 10 (J14.3, bondDiscounts)',
        forge.some(a => /capa de pieles \(9 de oro/.test(a)), JSON.stringify(forge));
    if (SHOT) await page.screenshot({ path: `${SHOT}.herreria.png` });

    const mine = problems.filter(p => /social|meetup|quedad|charla|small-talk|whereabouts|day-parts|town-scene|clock|qd-/i.test(p));
    check('sin errores de lo social en la página', mine.length === 0, mine.slice(0, 6).join('\n        '));
    if (problems.length > mine.length) console.log(`(otros avisos de la página: ${problems.length - mine.length})\n        ${problems.filter(p => !mine.includes(p)).slice(0, 4).join('\n        ')}`);
} catch (error) {
    failures++;
    console.log(`FAIL  the run threw: ${String(/** @type {any} */ (error)?.stack || error).slice(0, 800)}`);
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
