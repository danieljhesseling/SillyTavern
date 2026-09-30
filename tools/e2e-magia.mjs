#!/usr/bin/env node
/**
 * J19 en el navegador, jugando como quien juega: la magia de 5e y la ficha, contra un servidor
 * propio con un `--dataRoot` temporal (como `e2e-gremio.mjs`).
 *
 *   crear una maga → su ficha (la magia, los dibujos de habilidades y objetos, el equipo con
 *   nombres y huecos en castellano, una herida con su icono) → el grimorio (sus conjuros con
 *   su dibujo) → «Elegir mis conjuros de inicio» → «Preparar conjuros» → la pelea del muelle:
 *   lanzar un conjuro de nivel 1 desde la tarjeta del enemigo, que gasta un espacio → un bastón
 *   que pide sintonía: «Sintonizar» en la ficha, y ya sale en las maniobras → subir de nivel:
 *   el icono de la clase y los conjuros nuevos con su dibujo → dormir en la posada: se
 *   recuperan los espacios y se abre el cuadro de preparar.
 *
 * Uso:
 *   node tools/e2e-magia.mjs --port 8187 --captura C:/tmp/magia.png
 *   (las capturas salen como magia-1-ficha.png, magia-2-grimorio.png…)
 */

/* global window, document, HTMLElement */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8137;
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

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-magia-'));
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
 * Elegir en una tarjeta de «Crear personaje», como en `e2e-gremio.mjs`.
 *
 * @param {any} page
 * @param {string} pick
 * @param {string} wanted
 */
async function pickHeroCard(page, pick, wanted) {
    await page.locator(`.hc-root .hc-card[data-pick="${pick}"] .hc-pick`).click();
    await page.waitForSelector('.hc-picker .hc-option', { timeout: 15000 });
    const plain = (/** @type {string} */ v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const values = await page.evaluate(() => [...document.querySelectorAll('.hc-picker .hc-option')].map(o => o.getAttribute('data-value') || ''));
    const chosen = values.find(v => plain(v) === plain(wanted)) ?? values.find(v => plain(v).startsWith(plain(wanted).slice(0, 4))) ?? values[0];
    await page.locator(`.hc-picker .hc-option[data-value="${chosen}"]`).first().click();
    await page.waitForSelector('.hc-picker', { state: 'detached', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(200);
    return chosen;
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
        const w = /** @type {any} */ (window);
        w.__toasts = [];
        new window.MutationObserver(records => {
            for (const added of records.flatMap(r => [...r.addedNodes])) {
                if (added instanceof HTMLElement && added.classList.contains('toast')) {
                    w.__toasts.push(`${added.querySelector('.toast-title')?.textContent || ''}: ${(added.querySelector('.toast-message')?.textContent || '').trim()}`);
                }
            }
        }).observe(document, { childList: true, subtree: true });
        try {
            window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,travel,prisoners,mesa,high,spell,pet,bill,fight,move,journal');
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
            window.localStorage.setItem('sillytavern_gameSucesos', 'off');
            window.localStorage.setItem('sillytavern_gameStoryWindows', 'off');
        } catch { /* nada */ }
    });

    const until = async (/** @type {() => Promise<boolean>} */ test, ms = 30000) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (await test().catch(() => false)) return true;
            await page.waitForTimeout(400);
        }
        return false;
    };
    const chips = () => page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-chip-action')].map(c => (c.textContent || '').trim()));
    const clickChip = (/** @type {RegExp} */ pattern) => page.evaluate((source) => {
        const chip = [...document.querySelectorAll('#game-shell .gs-chip-action')].find(b => new RegExp(source).test(b.textContent || ''));
        if (chip instanceof HTMLElement) chip.click();
        return Boolean(chip);
    }, pattern.source);
    const clearDice = async () => {
        for (let i = 0; i < 40; i++) {
            const next = page.locator('.wm-dice-overlay.active .wm-dice-next');
            if (await next.count() === 0) break;
            if (!await next.click({ timeout: 1500 }).then(() => true).catch(() => false)) break;
            await page.waitForTimeout(250);
        }
    };
    const dropToasts = () => page.evaluate(() => document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));
    /** La heroína, tal cual la tiene el juego. */
    const hero = () => page.evaluate(async () => {
        const { partyMembers } = await import('/scripts/party/state.js');
        return JSON.parse(JSON.stringify(partyMembers[0] ?? null));
    });
    /** Cuántas imágenes de un selector se han pintado de verdad, y cuáles. */
    const drawn = (/** @type {string} */ selector) => page.evaluate((s) => [...document.querySelectorAll(s)]
        .filter(i => /** @type {HTMLImageElement} */ (i).complete && /** @type {HTMLImageElement} */ (i).naturalWidth > 0)
        .map(i => String(i.getAttribute('src')).split('/').slice(-2).join('/')), selector);
    /** Abrir tu ficha pulsando tu cara en la tira del grupo, como quien juega. */
    const openSheet = async () => {
        await page.locator('#game-shell .gs-party-strip .gs-chip-clickable').filter({ visible: true }).first().click({ timeout: 8000 });
        await page.waitForSelector('.ch-root', { timeout: 10000 });
        await page.waitForTimeout(500);
    };
    const closeTopPopup = async () => {
        await page.locator('dialog.popup[open] .popup-button-ok').last().click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(400);
    };

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    const firstRun = page.locator('text=Welcome to SillyTavern!');
    if (await firstRun.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#game-shell', { timeout: 90000 });
    const offline = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Jugar sin conexión' });
    await until(async () => await offline.count() === 1, 30000);

    // 1. Una maga, creada con las tarjetas.
    await offline.click();
    await page.waitForSelector('.hc-root', { timeout: 120000 });
    await page.fill('.hc-root .hc-name', 'Lía');
    await page.locator('.hc-root .hc-gender[data-value="Mujer"]').click();
    await pickHeroCard(page, 'race', 'Humano');
    const picked = await pickHeroCard(page, 'class', 'Mago');
    await page.locator('.hc-root .hc-enter').click();
    const inHub = await until(async () => (await hero())?.name === 'Lía', 60000);
    await until(async () => (await chips()).some(c => /^Iniciar combate \(Ratero del muelle\)/.test(c)), 20000);
    await page.waitForTimeout(1000);
    const told = await page.evaluate(() => /** @type {string[]} */ (/** @type {any} */ (window).__toasts).filter(t => /^Lo que sabes hacer/.test(t)));
    let lia = await hero();
    check('se crea Lía, maga, y empieza en el muelle', inHub && /Mag/.test(String(lia?.class)), JSON.stringify({ picked, class: lia?.class }));

    // 2. Su ficha, desde su cara en la tira del grupo.
    await dropToasts();
    await openSheet();
    lia = await hero();
    const sheet = await page.evaluate(() => ({
        magic: [...document.querySelectorAll('.ch-root .ch-magic-line')].map(l => (l.textContent || '').trim()),
        grimoire: Boolean(document.querySelector('.ch-root .ch-grimoire')),
        abilities: [...document.querySelectorAll('.ch-root .ch-ability')].map(a => `${a.querySelector('.ch-ability-name')?.textContent}|${a.querySelector('.ch-ability-left')?.textContent}`),
        slots: [...document.querySelectorAll('.ch-root .ch-slot')].map(s => `${s.querySelector('.ch-slot-label')?.textContent}=${s.querySelector('.ch-slot-item')?.textContent}`),
        text: document.querySelector('.ch-root')?.textContent || '',
    }));
    const abilityArt = await drawn('.ch-root .ch-ability-art');
    const itemArt = await drawn('.ch-root .ch-item-art');
    const castNames = await page.evaluate(async () => {
        const { partyMembers } = await import('/scripts/party/state.js');
        const magic = await import('/scripts/party/magic.js');
        const m = partyMembers[0];
        return [...(m?.cantrips ?? []), ...(m?.prepared ?? [])].map(id => magic.spellFor(id)?.name ?? id);
    });
    check('al crearla, «Lo que sabes hacer» dice los conjuros de 5e que tiene de verdad (J19.2)',
        told.length === 1 && castNames.length >= 4 && castNames.every(name => told[0].includes(name)) && /Conjuros: /.test(told[0]),
        JSON.stringify({ told, castNames }));
    check('la ficha tiene su magia: espacios, preparados, CD, y el botón del grimorio (J19)',
        sheet.grimoire && sheet.magic.some(l => /de nivel 1: 2 de 2/.test(l)) && sheet.magic.some(l => /preparados/.test(l)) && sheet.magic.some(l => /CD de sus conjuros: \d+/.test(l)),
        JSON.stringify(sheet.magic));
    check('en «Habilidades», sus trucos y conjuros, con su nivel y su dibujo (arte en pixel)',
        sheet.abilities.some(a => /\|truco$/.test(a)) && sheet.abilities.some(a => /\|1\.º nivel$/.test(a)) && abilityArt.length >= 2,
        JSON.stringify({ abilities: sheet.abilities, abilityArt }));
    check('el equipo con nombres y huecos en castellano, sin ids ni «Head/Body» (J12)',
        sheet.slots.some(s => /^Cabeza=/.test(s)) && sheet.slots.some(s => /^Cuerpo=/.test(s)) && !/item_\d|Head|Body|Hands|Feet/.test(sheet.slots.join(' ')),
        JSON.stringify(sheet.slots));
    check('lo que lleva, con el dibujo de cada objeto que lo tiene (arte en pixel)', itemArt.length >= 1, JSON.stringify(itemArt));
    if (shot('1-ficha')) await page.screenshot({ path: shot('1-ficha') });

    // 3. El grimorio, desde la ficha.
    await page.locator('.ch-root .ch-grimoire').click();
    await page.waitForSelector('.gr-fifth', { timeout: 10000 });
    await page.waitForTimeout(600);
    const book = await page.evaluate(() => ({
        groups: [...document.querySelectorAll('.gr-fifth .gr-group')].map(g => (g.textContent || '').trim()),
        spells: [...document.querySelectorAll('.gr-fifth .gr-spell5e')].map(s => s.getAttribute('data-spell')),
        buttons: [...document.querySelectorAll('.gr-fifth .gr-actions button')].map(b => `${(b.textContent || '').trim()}${/** @type {HTMLButtonElement} */ (b).disabled ? ' (no)' : ''}`),
    }));
    const bookArt = await drawn('.gr-fifth .gr-spell-art');
    const classArt = await drawn('.gr-fifth .gr-class-art');
    check('el grimorio: trucos, preparados y su libro, cada uno con su dibujo, y el icono de la clase',
        book.groups.some(g => /Trucos/.test(g)) && book.groups.some(g => /Preparados/.test(g)) && book.spells.length >= 4 && bookArt.length === book.spells.length && classArt.length === 1,
        JSON.stringify({ book, bookArt: bookArt.length, classArt }));
    check('y los botones de preparar y de elegir los de inicio', book.buttons.some(b => /^Preparar conjuros$/.test(b)) && book.buttons.some(b => /^Elegir mis conjuros de inicio$/.test(b)), JSON.stringify(book.buttons));
    if (shot('2-grimorio')) await page.screenshot({ path: shot('2-grimorio') });

    // 4. Elegir los de inicio, en la misma tarjeta que al subir de nivel.
    await page.locator('.gr-fifth .gr-start').click();
    await page.waitForSelector('.lu-spell-card .sp-option', { timeout: 10000 });
    await page.waitForTimeout(500);
    const startCard = await page.evaluate(() => ({
        pickers: [...document.querySelectorAll('.lu-spell-card .sp-picker')].map(p => `${p.getAttribute('data-picker')}:${p.querySelector('.sp-count')?.textContent}`),
        options: document.querySelectorAll('.lu-spell-card .sp-option').length,
    }));
    const startArt = await drawn('.lu-spell-card .sp-art');
    check('«Elegir mis conjuros de inicio» abre la tarjeta: trucos y conjuros para el libro, con su dibujo',
        startCard.pickers.some(p => /^trucos:/.test(p)) && startCard.pickers.some(p => /^conjuros:/.test(p)) && startArt.length >= 4,
        JSON.stringify({ startCard, startArt: startArt.length }));
    if (shot('3-inicio')) await page.screenshot({ path: shot('3-inicio') });
    // Se eligen los últimos de cada rejilla, para que no sean los que dio el juego; y en el
    // libro, Proyectil mágico el primero, para lanzarlo en la pelea.
    await page.locator('.lu-spell-card .sp-picker[data-picker="conjuros"] .sp-option[data-spell*="proyectil"]').first().click();
    for (const name of ['trucos', 'conjuros']) {
        const options = page.locator(`.lu-spell-card .sp-picker[data-picker="${name}"] .sp-option:not(.chosen):not([disabled])`);
        for (let i = 0; i < 10 && await options.count() > 0; i++) await options.last().click();
    }
    const before = lia;
    await page.locator('.lu-spell-card .lu-confirm').click();
    await page.waitForTimeout(800);
    lia = await hero();
    check('al confirmar, Lía sabe los que ha elegido, y ya no los del juego',
        lia?.spellsChosenBy === 'jugador' && JSON.stringify(lia?.cantrips) !== JSON.stringify(before?.cantrips) && (lia?.spellbook ?? []).length >= 6,
        JSON.stringify({ antes: before?.cantrips, ahora: lia?.cantrips, libro: lia?.spellbook }));

    // 5. Preparar, desde el grimorio.
    await dropToasts();
    await openSheet();
    await page.locator('.ch-root .ch-grimoire').click();
    await page.waitForSelector('.gr-fifth .gr-prepare', { timeout: 10000 });
    await page.locator('.gr-fifth .gr-prepare').click();
    await page.waitForSelector('.sp-prepare .sp-option', { timeout: 10000 });
    await page.waitForTimeout(400);
    const prep = await page.evaluate(() => ({
        count: document.querySelector('.sp-prepare .sp-count')?.textContent || '',
        options: [...document.querySelectorAll('.sp-prepare .sp-option')].map(o => o.getAttribute('data-spell')),
        chosen: [...document.querySelectorAll('.sp-prepare .sp-option.chosen')].map(o => o.getAttribute('data-spell')),
    }));
    check('«Preparar conjuros» abre el cuadro con los del libro y lo que ya tenía preparado', prep.options.length >= 6 && prep.chosen.length > 0 && /de \d+/.test(prep.count), JSON.stringify(prep));
    if (shot('4-preparar')) await page.screenshot({ path: shot('4-preparar') });
    // Quitar uno y poner otro que no estaba; Proyectil mágico se queda (o entra), para lanzarlo luego.
    const missile = prep.options.find(id => /proyectil/.test(String(id)));
    const out = prep.chosen.find(id => id !== missile);
    if (out) await page.locator(`.sp-prepare .sp-option[data-spell="${out}"]`).click();
    const into = missile && !prep.chosen.includes(missile) ? missile : prep.options.find(id => !prep.chosen.includes(id) && id !== out);
    if (into) await page.locator(`.sp-prepare .sp-option[data-spell="${into}"]`).click();
    await page.locator('dialog.popup[open]:has(.sp-prepare) .popup-button-ok').click();
    await page.waitForTimeout(700);
    lia = await hero();
    const preparedNow = lia?.prepared ?? [];
    const swapped = Boolean(into) && preparedNow.includes(String(into)) && !preparedNow.includes(String(out))
        && preparedNow.some((/** @type {string} */ id) => /proyectil/.test(id));
    check('al preparar, cambia lo que tiene a mano', swapped, JSON.stringify({ out, into, prepared: lia?.prepared }));

    // 6. La pelea del muelle: un conjuro de nivel 1 desde la tarjeta del enemigo.
    await dropToasts();
    await clickChip(/^Iniciar combate \(Ratero/);
    await until(async () => page.evaluate(() => Boolean(window.SillyTavern.getContext().chatMetadata?.combatEncounter?.active)), 15000);
    await clearDice();
    const myTurn = await until(async () => {
        await clearDice();
        return page.evaluate(async () => {
            const enc = (await import('/scripts/party.js')).getCombatEncounter();
            const entry = enc?.turnOrder?.[enc?.currentTurnIndex];
            return Boolean(entry && !entry.isEnemy && entry.type !== 'enemy' && !enc?.turnState?.actionUsed);
        });
    }, 30000);
    // El ratero, lejos o cerca, se alcanza con un conjuro de 120 pies. Que aguante el golpe.
    await page.evaluate(async () => {
        const enc = (await import('/scripts/party.js')).getCombatEncounter();
        for (const e of enc?.enemies ?? []) {
            e.currentHp = 60;
            e.maxHp = 60;
        }
    });
    await page.locator('.wm-token-enemy').filter({ visible: true }).first().click({ timeout: 10000 });
    await page.waitForSelector('.tc-card', { timeout: 8000 });
    const targetButtons = await page.evaluate(() => [...document.querySelectorAll('.tc-card .tc-btn')].map(b => `${(b.textContent || '').trim()}${/** @type {HTMLButtonElement} */ (b).disabled ? ' (no)' : ''}`));
    const levelOne = await page.evaluate(async () => {
        const { partyMembers } = await import('/scripts/party/state.js');
        const magic = await import('/scripts/party/magic.js');
        return magic.knownAbilitiesOf(partyMembers[0]).filter(a => a.target === 'enemy' && a.spellLevel === 1).map(a => a.name);
    });
    const spellName = levelOne.find(name => targetButtons.some(b => b === name)) ?? '';
    check('en la tarjeta del enemigo salen sus conjuros de ataque, listos para lanzar', myTurn && Boolean(spellName), JSON.stringify({ myTurn, targetButtons, levelOne }));
    if (shot('5-tarjeta')) await page.screenshot({ path: shot('5-tarjeta') });
    const slotsBefore = JSON.stringify((await hero())?.slotsUsed ?? {});
    if (spellName) await page.locator('.tc-card .tc-btn', { hasText: spellName }).first().click();
    else await page.locator('.tc-card .tc-btn', { hasText: 'Cerrar' }).first().click().catch(() => {});
    await page.waitForTimeout(1200);
    await clearDice();
    lia = await hero();
    const log = await page.evaluate(() => (window.SillyTavern.getContext().chat || []).slice(-8).map((/** @type {any} */ m) => String(m.extra?.display_text || m.mes || '')).join('\n'));
    check('lanzarlo gasta un espacio de nivel 1, y se cuenta', Boolean(spellName) && JSON.stringify(lia?.slotsUsed ?? {}) !== slotsBefore && /gasta un espacio de 1/.test(log),
        JSON.stringify({ spellName, slotsBefore, after: lia?.slotsUsed, log: log.slice(-400) }));
    if (shot('6-lanzado')) await page.screenshot({ path: shot('6-lanzado') });
    // Terminar la pelea, como hace e2e-gremio.
    await page.evaluate(async () => {
        const enc = (await import('/scripts/party.js')).getCombatEncounter();
        for (const e of enc?.enemies ?? []) e.currentHp = 0;
    });
    for (let i = 0; i < 8 && await page.evaluate(() => Boolean(window.SillyTavern.getContext().chatMetadata?.combatEncounter?.active)); i++) {
        await page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/combat-end'));
        await page.waitForTimeout(700);
        await clearDice();
    }
    // Y al pueblo, con el botón del tablero, leyendo lo que haya que leer (como e2e-gremio).
    const sceneNow = () => page.evaluate(() => document.querySelector('#game-shell')?.getAttribute('data-scene') || '');
    const carryOn = async (/** @type {string} */ wanted) => until(async () => {
        if (await sceneNow() === wanted) return true;
        await page.evaluate(() => /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .gs-vn-box .gs-chip-continue'))?.click());
        return false;
    }, 10000);
    await dropToasts();
    await carryOn('combat');
    await page.locator('#game-shell .gs-scene-map .wm-leave-loc-btn').first().click({ timeout: 5000 })
        .catch(() => page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/leave')));
    await page.waitForTimeout(600);
    await carryOn('exploration');
    const inTown = await until(() => page.evaluate(() => document.querySelectorAll('#game-shell .gs-town-place').length > 0), 10000);

    // 7. Un objeto que pide sintonía, del botín: en la ficha, «Sintonizar».
    await page.evaluate(async () => {
        const { partyMembers } = await import('/scripts/party/state.js');
        const { describeLootItem } = await import('/scripts/game-engine/combat/loot-items.js');
        const { addItemToInventory, createItem } = await import('/scripts/dnd-system.js');
        const { savePartyState } = await import('/scripts/party/roster.js');
        addItemToInventory(/** @type {any} */ (partyMembers[0]), createItem(/** @type {any} */ (describeLootItem('Bastón de las llamas', 'Rare', []))));
        // Y una herida, para ver su icono.
        const { setInjury } = await import('/scripts/game-engine/rules/injuries.js');
        const patch = setInjury(partyMembers[0], { id: 'caida-tobillo', label: 'Tobillo torcido', description: 'Cojea.', days: 3, modifiers: { speed: -10 } }, 'caida-tobillo');
        Object.assign(partyMembers[0], { injuries: patch.injuries, baseStats: patch.baseStats, ...patch.stats });
        savePartyState();
    });
    await dropToasts();
    await openSheet();
    const staffRow = page.locator('.ch-root .ch-item', { hasText: 'Bastón de las llamas' });
    const attune = await page.evaluate(() => ({
        note: document.querySelector('.ch-root .ch-attune-note')?.textContent || '',
        button: document.querySelector('.ch-root .ch-attune')?.textContent || '',
        injuries: [...document.querySelectorAll('.ch-root .ch-injury')].map(t => t.getAttribute('data-injury')),
    }));
    const injuryArt = await drawn('.ch-root .ch-injury .ch-tag-art');
    check('una herida sale en la ficha con su icono (arte en pixel)', attune.injuries.length > 0 && injuryArt.length > 0, JSON.stringify({ injuries: attune.injuries, injuryArt }));
    check('el bastón pide sintonía: la ficha dice cuántos lleva y ofrece «Sintonizar» (J19.9)',
        await staffRow.count() === 1 && /En sintonía: 0 de 3/.test(attune.note) && /^Sintonizar$/.test(attune.button), JSON.stringify(attune));
    if (shot('7-sintonia')) await page.screenshot({ path: shot('7-sintonia') });
    await page.locator('.ch-root .ch-attune').first().click();
    await page.waitForSelector('.ch-root .ch-attune.is-on', { timeout: 8000 }).catch(() => {});
    lia = await hero();
    const staff = (lia?.items ?? []).find((/** @type {any} */ i) => i.name === 'Bastón de las llamas');
    const reopened = await page.evaluate(() => document.querySelector('.ch-root .ch-attune')?.textContent || '');
    check('al pulsar, queda en sintonía, guardado, y el botón pasa a «Dejar la sintonía»', staff?.attuned === true && /Dejar la sintonía/.test(reopened), JSON.stringify({ attuned: staff?.attuned, reopened }));
    const works = await page.evaluate(async () => {
        const { partyMembers } = await import('/scripts/party/state.js');
        const { magicItemsOf } = await import('/scripts/game-engine/rules/magic-items.js');
        return magicItemsOf(partyMembers[0]).map((/** @type {any} */ m) => `${m.name}:${m.left}`);
    });
    check('y ya se puede usar en combate, con sus cargas (en «Maniobras»)', works.some(w => /^Bastón de las llamas:5$/.test(w)), JSON.stringify(works));
    await closeTopPopup();

    // 8. Subir de nivel: la tarjeta con el icono de la clase y los conjuros nuevos.
    await page.evaluate(async () => (await import('/scripts/party.js')).grantXpForSimulation(400));
    await dropToasts();
    await openSheet();
    const canUp = await page.locator('.ch-root .ch-levelup').count();
    check('con la experiencia, la ficha ofrece «Subir de nivel»', canUp === 1);
    if (canUp) await page.locator('.ch-root .ch-levelup').click();
    await page.waitForSelector('.lu-card .lu-confirm', { timeout: 10000 });
    await page.waitForTimeout(500);
    const upCard = await page.evaluate(() => ({
        title: document.querySelector('.lu-card .lu-title')?.textContent || '',
        lines: [...document.querySelectorAll('.lu-card .lu-spell-line')].map(l => l.textContent || ''),
        pickers: [...document.querySelectorAll('.lu-card .sp-picker')].map(p => `${p.getAttribute('data-picker')}:${p.querySelector('.sp-count')?.textContent}`),
        perks: document.querySelectorAll('.lu-card .lu-perk').length,
        off: /** @type {HTMLButtonElement|null} */ (document.querySelector('.lu-card .lu-confirm'))?.disabled ?? null,
    }));
    const upClassArt = await drawn('.lu-card .lu-class-art');
    const upSpellArt = await drawn('.lu-card .sp-art');
    check('la tarjeta de nivel: el icono de la clase, lo que trae y los conjuros nuevos con su dibujo (J19.2)',
        /nivel 1 → 2/.test(upCard.title) && upClassArt.length === 1 && upCard.pickers.some(p => /^conjuros:0 de 2$/.test(p)) && upSpellArt.length >= 2 && upCard.off === true,
        JSON.stringify({ upCard, upClassArt, upSpellArt: upSpellArt.length }));
    if (shot('8-nivel')) await page.screenshot({ path: shot('8-nivel') });
    if (upCard.perks > 0) await page.locator('.lu-card .lu-perk').first().click();
    const spellsInCard = page.locator('.lu-card .sp-picker[data-picker="conjuros"] .sp-option:not(.chosen):not([disabled])');
    for (let i = 0; i < 2; i++) await spellsInCard.first().click().catch(() => {});
    const bookBefore = (lia?.spellbook ?? []).length;
    await page.locator('.lu-card .lu-confirm').click();
    await page.waitForTimeout(900);
    lia = await hero();
    check('al confirmar, sube a nivel 2 y copia dos conjuros más al libro', Number(lia?.level) === 2 && (lia?.spellbook ?? []).length === bookBefore + 2,
        JSON.stringify({ level: lia?.level, antes: bookBefore, libro: lia?.spellbook }));
    await closeTopPopup();

    // 9. Dormir en la posada: vuelven los espacios y se abre el cuadro de preparar.
    await page.evaluate(async () => {
        const { partyMembers } = await import('/scripts/party/state.js');
        partyMembers[0].slotsUsed = { 1: 2 };
    });
    await dropToasts();
    // Como quien juega: la posada del pueblo, «Dormir en una habitación».
    await page.locator('#game-shell .gs-town-place[data-place="posada"]').click({ timeout: 5000 }).catch(() => {});
    const room = page.locator('#game-shell .gs-town-scene .gs-town-act[data-action="inn-room"]');
    const canSleep = await room.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
    if (canSleep) await room.click();
    const offered = await page.waitForSelector('.sp-prepare', { timeout: 12000 }).then(() => true).catch(() => false);
    lia = await hero();
    check('en el pueblo, dormir en la posada: vuelven los espacios y se abre «preparar conjuros» (J19.2)',
        inTown && canSleep && offered && Object.values(lia?.slotsUsed ?? {}).every(v => !v) && lia?.mayPrepare === true,
        JSON.stringify({ inTown, canSleep, offered, slotsUsed: lia?.slotsUsed, mayPrepare: lia?.mayPrepare }));
    if (shot('9-descanso')) await page.screenshot({ path: shot('9-descanso') });
    // Preparar lo nuevo del libro, desde el cuadro que se ha abierto solo.
    const fresh = page.locator('.sp-prepare .sp-option:not(.chosen):not([disabled])');
    if (await fresh.count() > 0) await fresh.first().click();
    await page.locator('dialog.popup[open]:has(.sp-prepare) .popup-button-ok').click().catch(() => {});
    await page.waitForTimeout(700);
    lia = await hero();
    check('y preparar al despertar deja de estar abierto hasta el próximo descanso', lia?.mayPrepare === false && (lia?.prepared ?? []).length === 3,
        JSON.stringify({ mayPrepare: lia?.mayPrepare, prepared: lia?.prepared }));
    check('subir de nivel con el tobillo torcido no se deshace al dormir: la vida máxima nueva se queda',
        Number(lia?.maxHp) > 30 && Number(lia?.hp) <= Number(lia?.maxHp) && Number(lia?.baseStats?.maxHp) === Number(lia?.maxHp),
        JSON.stringify({ hp: lia?.hp, maxHp: lia?.maxHp, base: lia?.baseStats?.maxHp }));

    const mine = problems.filter(p => /magic|spell|grimo|level-up|sheet|character-panel|attun|sp-|lu-|ch-/i.test(p));
    check('sin errores de estos módulos en la consola', mine.length === 0, mine.join(' | '));
    if (problems.length > 0) console.log(`(otros avisos de la página: ${problems.length})\n        ${problems.slice(0, 5).join('\n        ')}`);
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

console.log(failures === 0 ? '\nJ19 en el navegador: todo bien.' : `\n${failures} fallos.`);
process.exit(failures === 0 ? 0 : 1);
