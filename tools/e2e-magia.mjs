#!/usr/bin/env node
/**
 * J19 en el navegador, jugando como quien juega: la magia de 5e y la ficha, contra un servidor
 * propio con un `--dataRoot` temporal (como `e2e-gremio.mjs`).
 *
 *   crear una maga → su ficha (la magia, los dibujos de habilidades y objetos, el equipo con
 *   nombres y huecos en castellano, una herida con su icono) → el grimorio (sus conjuros con
 *   su dibujo) → «Elegir mis conjuros de inicio» → «Preparar conjuros» → la pelea del muelle:
 *   lanzar un conjuro de nivel 1 desde «Magia» en la barra de acciones, que gasta un espacio →
 *   un bastón que pide sintonía: «Sintonizar» en la ficha, y ya sale en «Magia» → subir de nivel:
 *   el icono de la clase y los conjuros nuevos con su dibujo → J19.10, la magia fuera de
 *   combate: desde la ficha, Identificar y Detectar magia como rituales; en la posada, pasar el
 *   rato hasta la noche, y la fila ofrece «Magia: Luz»; la Luz se enciende y examinar suma +2
 *   → dormir en la posada: se recuperan los espacios y se abre el cuadro de preparar.
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
import { entrarEnLaPelea } from './e2e-entrar-pelea.mjs';

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
    /** Pulsar una ficha de la escena: en la fila, o, si no cabe, en «+N más» (idea 169), como quien juega. */
    const pressChip = async (/** @type {RegExp} */ label, /** @type {string} */ id) => {
        if (await clickChip(label)) return 'fila';
        if (!await clickChip(/^\+\d+ más$/)) return '';
        const item = page.locator(`.hp-item[data-chip="${id}"]`);
        if (!await item.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)) {
            await page.locator('dialog.popup[open] .popup-button-ok').last().click({ timeout: 3000 }).catch(() => {});
            return '';
        }
        await item.click();
        return 'más';
    };
    /** Las fichas que el juego ofrece ahora, todas (también las de «+N más»). */
    const allChips = () => page.evaluate(async () => (await import('/scripts/party/shell.js')).buildShellChips(Infinity)
        .map((/** @type {any} */ c) => ({ id: String(c.id), label: String(c.label), icon: String(c.icon) })));
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
    // Tanda 10: ya no hay ficha de «Iniciar combate» (la pelea empieza sola en el tablero).
    await until(async () => (await chips()).length > 0, 20000);
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
    // J1.7 y J1.8: quién es, con el icono de su clase y su cara; y en qué campañas ha estado.
    const who = await page.evaluate(() => ({
        title: document.querySelector('.ch-root .ch-title')?.textContent || '',
        campaigns: [...document.querySelectorAll('.ch-root .ch-campaigns > *')].map(n => n.textContent || ''),
        rawIds: /item_\d{6,}/.test(document.querySelector('.ch-root')?.textContent || ''),
    }));
    const classIcon = await drawn('.ch-root .ch-title .ch-class-art');
    const face = await drawn('.ch-root .ch-head img.ch-avatar.pixel-art');
    check('la ficha legible: el icono de su clase junto a «Humano · Nivel 1 Mago», su retrato, y ningún id a la vista (J1.7)',
        classIcon.length === 1 && /Nivel 1 Mag/.test(who.title) && face.length === 1 && !who.rawIds, JSON.stringify({ who, classIcon, face }));
    check('y sus campañas: en el prólogo, que todavía no ha salido a ninguna (J1.7)',
        who.campaigns.length === 1 && /Todavía no ha salido a ninguna campaña/.test(who.campaigns[0]), JSON.stringify(who.campaigns));
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
    // libro, Proyectil mágico el primero, para lanzarlo en la pelea. J19.10: y Luz, Detectar
    // magia e Identificar, para la magia fuera de combate de más adelante.
    await page.locator('.lu-spell-card .sp-picker[data-picker="conjuros"] .sp-option[data-spell*="proyectil"]').first().click();
    for (const [picker, id] of [['trucos', 'mag-luz'], ['conjuros', 'conj-detectar-magia'], ['conjuros', 'conj-identificar']]) {
        await page.locator(`.lu-spell-card .sp-picker[data-picker="${picker}"] .sp-option[data-spell="${id}"]:not(.chosen)`).first().click({ timeout: 3000 }).catch(() => {});
    }
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
    // Tanda 10: la pelea empieza sola (decidir, colocarse, «Empezar»), como quien juega.
    await entrarEnLaPelea(page);
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
    // Tanda 10: los conjuros se lanzan desde «Magia», en la barra de acciones de abajo.
    await page.locator('#game-shell .gs-vtt-bar .gs-btn[data-menu="magia"]').click({ timeout: 10000 });
    await page.waitForSelector('#game-shell .gs-grimoire[data-menu="magia"]', { timeout: 8000 });
    const targetButtons = await page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-grimoire .gs-card')]
        .map(b => `${(b.querySelector('.gs-card-name-text')?.textContent || '').trim()}${/** @type {HTMLButtonElement} */ (b).disabled ? ' (no)' : ''}`));
    const levelOne = await page.evaluate(async () => {
        const { partyMembers } = await import('/scripts/party/state.js');
        const magic = await import('/scripts/party/magic.js');
        return magic.knownAbilitiesOf(partyMembers[0]).filter(a => a.target === 'enemy' && a.spellLevel === 1).map(a => a.name);
    });
    const spellName = levelOne.find(name => targetButtons.some(b => b === name)) ?? '';
    check('en «Magia» salen sus conjuros de ataque, listos para lanzar', myTurn && Boolean(spellName), JSON.stringify({ myTurn, targetButtons, levelOne }));
    if (shot('5-tarjeta')) await page.screenshot({ path: shot('5-tarjeta') });
    const slotsBefore = JSON.stringify((await hero())?.slotsUsed ?? {});
    if (spellName) {
        // Su tarjeta, y luego a quién.
        await page.locator('#game-shell .gs-grimoire .gs-card', { has: page.locator('.gs-card-name-text', { hasText: spellName }) }).first().click();
        await page.locator('#game-shell .gs-grimoire .gs-card-target:not([disabled])').first().click({ timeout: 5000 });
    } else {
        await page.keyboard.press('Escape');
    }
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
    // D-J45: recién ganada la pelea, «Continuar» ya sale del tablero al pueblo; si se queda en el
    // tablero, su botón lleva al pueblo.
    await until(async () => {
        if (['combat', 'exploration'].includes(await sceneNow())) return true;
        await page.evaluate(() => /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .gs-vn-box .gs-chip-continue'))?.click());
        return false;
    }, 10000);
    if (await sceneNow() === 'combat') {
        await page.locator('#game-shell .gs-scene-map .wm-leave-loc-btn').first().click({ timeout: 5000 })
            .catch(() => page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/leave')));
        await page.waitForTimeout(600);
    }
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
        // Y una enfermedad, como la pega el camino (su etapa, en el hueco de las enfermedades).
        const { stageInjury, DISEASE_SLOT } = await import('/scripts/game-engine/compendio/ailments.js');
        const fever = { name: 'Fiebre de los pantanos', stages: [{ label: 'destemplado', days: 2, modifiers: {} }, { label: 'con fiebre', days: 4, modifiers: {} }] };
        const sick = setInjury(partyMembers[0], stageInjury(fever, 1), DISEASE_SLOT);
        Object.assign(partyMembers[0], { injuries: sick.injuries, baseStats: sick.baseStats, ...sick.stats });
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
    check('una herida y una enfermedad salen en la ficha, cada una con su icono (arte en pixel)',
        attune.injuries.length === 2 && injuryArt.includes('estados/caida-tobillo.png') && injuryArt.includes('estados/enf-fiebre.png'),
        JSON.stringify({ injuries: attune.injuries, injuryArt }));
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
    check('y ya se puede usar en combate, con sus cargas (en «Magia», con los objetos)', works.some(w => /^Bastón de las llamas:5$/.test(w)), JSON.stringify(works));
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

    // 8b. J19.10: la magia fuera de combate, como quien juega: desde la ficha y desde la fila.
    // Del botín, un anillo sin identificar; de la tienda, la perla que pide Identificar (D-J25).
    await page.evaluate(async () => {
        const { partyMembers } = await import('/scripts/party/state.js');
        const { describeLootItem } = await import('/scripts/game-engine/combat/loot-items.js');
        const { addItemToInventory, createItem } = await import('/scripts/dnd-system.js');
        const { savePartyState } = await import('/scripts/party/roster.js');
        const ring = createItem(/** @type {any} */ (describeLootItem('Anillo de resistencia', 'Rare', [])));
        addItemToInventory(/** @type {any} */ (partyMembers[0]), /** @type {any} */ ({ ...ring, identified: false }));
        addItemToInventory(/** @type {any} */ (partyMembers[0]), createItem(/** @type {any} */ (describeLootItem('Perla', '', []))));
        savePartyState();
    });
    await dropToasts();
    await openSheet();
    const beforeField = await page.evaluate(() => ({
        unknown: [...document.querySelectorAll('.ch-root .ch-item-name')].map(n => n.textContent || '').filter(t => /sin identificar/.test(t)),
        button: document.querySelector('.ch-root .ch-field-magic')?.textContent?.trim() || '',
    }));
    check('la ficha ofrece «Magia fuera de combate», y el anillo del botín sale «sin identificar» (J19.10)',
        /Magia fuera de combate/.test(beforeField.button) && beforeField.unknown.length === 1, JSON.stringify(beforeField));
    await page.locator('.ch-root .ch-field-magic').click();
    await page.waitForSelector('.fm-dialog[open] .fm-spell', { timeout: 10000 });
    await page.waitForTimeout(400);
    const fieldRows = () => page.evaluate(() => [...document.querySelectorAll('.fm-dialog[open] .fm-spell')]
        .map(r => `${r.getAttribute('data-spell')}:${r.getAttribute('data-how')}:${r.getAttribute('data-ok')}`));
    const byDay = await fieldRows();
    const slotLine = await page.evaluate(() => document.querySelector('.fm-dialog[open] .fm-slots')?.textContent || '');
    check('la ventana: Identificar y Detectar magia como rituales, sus espacios, y la Luz, que de día aquí no hace falta',
        byDay.includes('conj-identificar:ritual:true') && byDay.includes('conj-detectar-magia:ritual:true') && byDay.includes('mag-luz:truco:false') && /de nivel 1/.test(slotLine),
        JSON.stringify({ byDay, slotLine }));
    if (shot('10-magia-campo')) await page.screenshot({ path: shot('10-magia-campo') });
    const castHere = async (/** @type {string} */ id) => {
        await page.locator(`.fm-dialog[open] .fm-spell[data-spell="${id}"] .fm-cast`).click();
        await page.waitForFunction(() => {
            const box = document.querySelector('.fm-dialog[open] .fm-result');
            return box instanceof HTMLElement && !box.hidden && (box.textContent || '').trim().length > 0;
        }, null, { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(400);
        return page.evaluate(() => document.querySelector('.fm-dialog[open] .fm-result')?.textContent || '');
    };
    const slotsBeforeRitual = JSON.stringify((await hero())?.slotsUsed ?? {});
    const identified = await castHere('conj-identificar');
    lia = await hero();
    const ring = (lia?.items ?? []).find((/** @type {any} */ i) => i.name === 'Anillo de resistencia');
    check('Identificar, como ritual y sin espacio: dice qué es el anillo, y deja de estar sin identificar',
        ring?.identified === true && /Anillo de resistencia/.test(identified) && JSON.stringify(lia?.slotsUsed ?? {}) === slotsBeforeRitual,
        JSON.stringify({ identified, ring: ring?.identified, slotsBefore: slotsBeforeRitual, slotsUsed: lia?.slotsUsed }));
    const detected = await castHere('conj-detectar-magia');
    check('Detectar magia, como ritual: dice qué de lo que lleváis tiene magia (el bastón, el anillo)',
        /Tiene magia: .*Bastón de las llamas/.test(detected) && /Anillo de resistencia/.test(detected), detected);
    await page.locator('.fm-dialog[open] .fm-close').click();
    await page.waitForTimeout(500);
    await dropToasts();
    await openSheet();
    const named = await page.evaluate(() => [...document.querySelectorAll('.ch-root .ch-item-name')].map(n => n.textContent || '').filter(t => /Anillo de resistencia/.test(t)));
    check('y en la ficha, el anillo ya sale con su nombre, sin «sin identificar»', named.length === 1 && !/sin identificar/.test(named[0]), JSON.stringify(named));
    await closeTopPopup();

    // De día, la Luz no saca la ficha «Magia» a la escena: no hace falta.
    const dayChips = await allChips();
    check('de día, en la plaza, la fila no ofrece la Luz', !dayChips.some(c => c.id === 'field-magic' && /Luz/.test(c.label)), JSON.stringify(dayChips.map(c => c.label)));
    // A la posada, a pasar el rato hasta la noche.
    const slotNow = () => page.evaluate(async () => (await import('/scripts/party/time.js')).getCurrentSlotLabel());
    await page.locator('#game-shell .gs-town-place[data-place="posada"]').click({ timeout: 5000 }).catch(() => {});
    for (let i = 0; i < 4 && !/noche|madrugada/i.test(await slotNow()); i++) {
        const idle = page.locator('#game-shell .gs-town-scene .gs-town-act[data-action="clock:slot"]');
        if (!await idle.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)) break;
        await idle.click();
        await page.waitForTimeout(900);
        await clearDice();
        await dropToasts();
    }
    const night = await slotNow();
    // D-J51: bajo techo, en la posada, ya hay luz: de noche tampoco se ofrece.
    const innChips = await allChips();
    check('D-J51: de noche en la posada (bajo techo, con luz), la fila no ofrece la Luz',
        /noche|madrugada/i.test(night) && !innChips.some(c => c.id === 'field-magic' && /Luz/.test(c.label)), JSON.stringify({ night, chips: innChips.map(c => c.label) }));
    if (shot('11a-posada-noche')) await page.screenshot({ path: shot('11a-posada-noche') });
    // Fuera, a la calle: «Volver a Puerto Alba».
    await page.locator('#game-shell .gs-town-back').click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(700);
    const nightChips = await allChips();
    const lightChip = nightChips.find(c => c.id === 'field-magic');
    check('de noche, al raso (en la plaza), la escena ofrece «Magia: Luz» (J19.10, D-J51)', /noche|madrugada/i.test(night) && Boolean(lightChip) && /Luz/.test(String(lightChip?.label)),
        JSON.stringify({ night, chips: nightChips.map(c => c.label) }));
    const pressed = await pressChip(/^Magia: /, 'field-magic');
    const opened = await page.waitForSelector('.fm-dialog[open] .fm-spell[data-spell="mag-luz"]', { timeout: 10000 }).then(() => true).catch(() => false);
    const lit = opened ? await castHere('mag-luz') : '';
    const lightState = await page.evaluate(async () => ({
        stored: window.SillyTavern.getContext().chatMetadata?.fieldLight ?? null,
        on: (await import('/scripts/party/magic.js')).fieldLightOn(),
        bonus: (await import('/scripts/party/magic.js')).fieldLookBonus('investigation'),
        board: (await import('/scripts/party/board.js')).boardVisibility(),
    }));
    check('pulsarla abre la ventana; la Luz alumbra la noche, se guarda, y cuenta como un farol en el tablero',
        Boolean(pressed) && /alumbrado/.test(lit) && lightState.on === true && lightState.bonus === 2 && lightState.stored?.by === 'Lía',
        JSON.stringify({ pressed, lit, lightState }));
    if (shot('11-luz')) await page.screenshot({ path: shot('11-luz') });
    if (opened) await page.locator('.fm-dialog[open] .fm-close').click().catch(() => {});
    await page.waitForTimeout(500);
    const afterChips = await allChips();
    check('con la Luz ya encendida, la fila deja de ofrecerla', !afterChips.some(c => c.id === 'field-magic' && /Luz/.test(c.label)), JSON.stringify(afterChips.map(c => c.label)));
    // Examinar algo de aquí, a la luz: la tirada suma +2 y lo dice.
    const look = afterChips.find(c => /^look:/.test(c.id) && /fa-magnifying-glass|fa-binoculars/.test(c.icon));
    const logBefore = await page.evaluate(() => (window.SillyTavern.getContext().chat || []).length);
    if (look) await pressChip(new RegExp(`^${look.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), look.id);
    await page.waitForTimeout(1200);
    await clearDice();
    const lookLog = await page.evaluate((from) => (window.SillyTavern.getContext().chat || []).slice(from)
        .map((/** @type {any} */ m) => String(m.extra?.display_text || m.mes || '')).join('\n'), logBefore);
    check('examinar a la luz, de noche: la tirada suma «+2 por la Luz»', Boolean(look) && /\+2 por la Luz/.test(lookLog),
        JSON.stringify({ look, lookLog: lookLog.slice(0, 400) }));
    await dropToasts();
    // Lo que cuenta la tirada se lee en la caja; «Continuar» vuelve al pueblo.
    await carryOn('exploration');

    // 8c. D-J53 y D-J50: con una clériga en el grupo. Lía, herida, llega a un sitio: la novela
    // pregunta si curarla con magia. Y un asesinato abierto: el muerto contesta una vez, y hasta
    // dentro de siete días no vuelve a hacerlo (se dice cuándo, y no se gasta el espacio).
    await dropToasts();
    await page.evaluate(async () => {
        const { partyMembers } = await import('/scripts/party/state.js');
        const { savePartyState, renderPartyMembers } = await import('/scripts/party/roster.js');
        partyMembers.push(/** @type {any} */ ({
            id: 9901, name: 'Irena', class: 'Clérigo', level: 5, wisdom: 16, hp: 30, maxHp: 30, gender: 'Mujer',
            cantrips: ['mag-luz'], prepared: ['hab-curar', 'mag-hablar-muertos'], slotsUsed: {},
            items: [{ id: 'irena-simbolo', name: 'Símbolo sagrado' }, { id: 'irena-polvo', name: 'Polvo de hueso' }],
            equippedItems: {}, guest: { kind: 'hireling' }, mapPosition: { ...(partyMembers[0].mapPosition || {}) },
        }));
        partyMembers[0].hp = Math.max(1, Number(partyMembers[0].maxHp) - 8);
        const meta = window.SillyTavern.getContext().chatMetadata;
        meta.cases = {
            active: {
                id: 'caso-e2e', kind: 'asesinato', title: 'El muerto del muelle', victim: 'Vasili', suspects: ['Ana', 'Berto'],
                clues: [
                    { id: 'k1', fact: 'Olía a brea.', misleading: false, about: 'Ana', points: 'culpable', source: { kind: 'sitio', name: 'El muelle' } },
                    { id: 'k2', fact: 'Llevaba una capa roja.', misleading: false, about: 'Ana', points: 'culpable', source: { kind: 'sitio', name: 'El muelle' } },
                ],
                truth: { culprit: 'Ana' }, secrets: {},
            },
            found: [], closed: [],
        };
        savePartyState();
        renderPartyMembers();
        // Lo que hace el viaje al llegar: sin esperar, la pregunta sale en cuanto no hay otra ventana.
        window.__healAsked = import('/scripts/party/magic.js').then(m => m.askHealOnArrival());
    });
    const asked = await page.waitForSelector('dialog.vq-dialog[open] .vq-question', { timeout: 15000 }).then(() => true).catch(() => false);
    const question = await page.evaluate(() => ({
        text: (document.querySelector('dialog.vq-dialog[open] .qd-text')?.textContent || '').replace(/\s+/g, ' ').trim(),
        plate: (document.querySelector('dialog.vq-dialog[open] .qd-nameplate')?.textContent || '').trim(),
        answers: [...document.querySelectorAll('dialog.vq-dialog[open] .qd-chip')].map(b => (b.textContent || '').trim()),
    }));
    check('D-J53: al llegar con alguien herido, la novela pregunta «¿Curar a Lía con magia? (gasta un espacio de nivel 1)», con Sí y No',
        asked && /¿Curar a Lía con magia\? \(gasta un espacio de nivel 1\)/.test(question.text) && /Lía llega herida/.test(question.text)
        && question.plate === 'Irena' && question.answers.some(a => /Sí/.test(a)) && question.answers.some(a => /No/.test(a)), JSON.stringify(question));
    if (shot('11b-curar-al-llegar')) await page.screenshot({ path: shot('11b-curar-al-llegar') });
    const hpBefore = Number((await hero())?.hp);
    await page.locator('dialog.vq-dialog[open] .vq-yes').click({ timeout: 4000 }).catch(() => {});
    const healed = await page.evaluate(async () => {
        const done = await window.__healAsked;
        const { partyMembers } = await import('/scripts/party/state.js');
        const irena = partyMembers.find(m => m.name === 'Irena');
        return { done, slots: irena?.slotsUsed ?? {} };
    });
    const hpAfter = Number((await hero())?.hp);
    check('D-J53: al decir que sí, Irena la cura y gasta su espacio; la ficha «Curar con magia» sigue para quien diga que no',
        healed.done === true && hpAfter > hpBefore && Object.values(healed.slots).some(v => Number(v) > 0), JSON.stringify({ healed, hpBefore, hpAfter }));
    await dropToasts();
    const speak = await page.evaluate(async () => {
        const magic = await import('/scripts/party/magic.js');
        const { partyMembers } = await import('/scripts/party/state.js');
        const irena = partyMembers.find(m => m.name === 'Irena');
        const choiceOf = () => magic.fieldCasters().find(c => c.member === irena)?.choices.find(c => c.kind === 'muertos');
        const first = await magic.castFieldChoice(irena, /** @type {any} */ (choiceOf()));
        const slotsAfterFirst = JSON.stringify(irena?.slotsUsed ?? {});
        const again = choiceOf();
        const second = await magic.castFieldChoice(irena, /** @type {any} */ (again));
        return {
            first: first.join(' '), again: { ok: again?.ok, reason: again?.reason }, second: second.join(' '),
            spent: slotsAfterFirst === JSON.stringify(irena?.slotsUsed ?? {}),
            stored: window.SillyTavern.getContext().chatMetadata?.spokenDead ?? null,
        };
    });
    check('D-J50: Vasili contesta una vez (una pista); al volver a intentarlo, dice cuándo se podrá y no gasta el espacio',
        /Pista:/.test(speak.first) && speak.again.ok === false && /Vasili ya contestó hace poco\. Se le puede volver a preguntar dentro de 7 días\./.test(String(speak.again.reason))
        && speak.second === speak.again.reason && speak.spent && Boolean(speak.stored?.['caso-e2e|vasili']), JSON.stringify(speak));
    // Y en la ventana de la magia, la fila lo dice en llano.
    await dropToasts();
    await openSheet();
    await page.locator('.ch-root .ch-field-magic').click({ timeout: 5000 }).catch(() => {});
    await page.waitForSelector('.fm-dialog[open] .fm-spell', { timeout: 10000 }).catch(() => {});
    const deadRow = await page.evaluate(() => {
        const row = document.querySelector('.fm-dialog[open] .fm-spell[data-spell="mag-hablar-muertos"]');
        return { ok: row?.getAttribute('data-ok') ?? '', why: (row?.querySelector('.fm-why')?.textContent || '').trim() };
    });
    check('D-J50: en «Magia fuera de combate», Hablar con los muertos sale apagado con el porqué: dentro de 7 días',
        deadRow.ok === 'false' && /dentro de 7 días/.test(deadRow.why), JSON.stringify(deadRow));
    if (shot('11c-muerto')) await page.screenshot({ path: shot('11c-muerto') });
    await page.locator('.fm-dialog[open] .fm-close').click().catch(() => {});
    await page.waitForTimeout(400);
    const tipSeen = await page.evaluate(() => (window.localStorage.getItem('sillytavern_gameTipsSeen') || '').split(','));
    check('D-J49: la primera vez con alguien que lanza, un consejo dice dónde está «Magia fuera de combate»', tipSeen.includes('fieldMagic'), JSON.stringify(tipSeen));
    // Irena se va: lo que sigue es de Lía sola.
    await page.evaluate(async () => {
        const { partyMembers } = await import('/scripts/party/state.js');
        const { savePartyState, renderPartyMembers } = await import('/scripts/party/roster.js');
        const index = partyMembers.findIndex(m => m.name === 'Irena');
        if (index >= 0) partyMembers.splice(index, 1);
        savePartyState();
        renderPartyMembers();
    });
    await dropToasts();

    // 9. Dormir en la posada: vuelven los espacios y se abre el cuadro de preparar.
    await page.evaluate(async () => {
        const { partyMembers } = await import('/scripts/party/state.js');
        partyMembers[0].slotsUsed = { 1: 2 };
    });
    await dropToasts();
    // Como quien juega: la posada del pueblo, «Dormir en una habitación». Si ya se está en ella
    // (de pasar el rato), no se vuelve a pulsar: pulsarla otra vez la cierra.
    const room = page.locator('#game-shell .gs-town-scene .gs-town-act[data-action="inn-room"]');
    if (!await room.isVisible().catch(() => false)) {
        await page.locator('#game-shell .gs-town-place[data-place="posada"]').click({ timeout: 5000 }).catch(() => {});
    }
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

    // 10. J1.8: tu cara sin arte. La imagen que subió ya no está: sale su retrato en pixel. Y
    // con una clase del taller, que no tiene retrato: sus iniciales en su color, en la ficha,
    // en la tira del grupo y en el tablero; nunca una imagen rota ni «???».
    await closeTopPopup();
    await dropToasts();
    await page.evaluate(async () => {
        const { partyMembers } = await import('/scripts/party/state.js');
        const { savePartyState, renderPartyMembers } = await import('/scripts/party/roster.js');
        partyMembers[0].avatar = 'user-avatars/esta-imagen-no-existe.png';
        savePartyState();
        renderPartyMembers();
    });
    await openSheet();
    await page.waitForTimeout(800);
    const brokenFace = await drawn('.ch-root .ch-head img.ch-avatar.pixel-art');
    check('si la cara subida ya no está, la ficha enseña su retrato en pixel, no una imagen rota (J1.8)', brokenFace.length === 1, JSON.stringify(brokenFace));
    await closeTopPopup();
    await page.evaluate(async () => {
        const { partyMembers } = await import('/scripts/party/state.js');
        const { savePartyState, renderPartyMembers } = await import('/scripts/party/roster.js');
        partyMembers[0].class = 'Juglar de feria';
        savePartyState();
        renderPartyMembers();
        const { refreshGameShell } = await import('/scripts/game-engine/ui/shell/game-shell.js');
        refreshGameShell();
    });
    await page.waitForTimeout(800);
    await openSheet();
    await page.waitForTimeout(600);
    const noArt = await page.evaluate(() => {
        const badge = document.querySelector('.ch-root .ch-head .hero-initials');
        const strip = document.querySelector('#game-shell .gs-party-strip .gs-chip-initials');
        return {
            sheet: badge?.textContent || '',
            sheetColor: badge instanceof HTMLElement ? badge.style.background : '',
            broken: [...document.querySelectorAll('.ch-root img, #game-shell .gs-party-strip img')]
                .filter(i => /** @type {HTMLImageElement} */ (i).complete && /** @type {HTMLImageElement} */ (i).naturalWidth === 0).length,
            strip: strip?.textContent || '',
        };
    });
    check('sin arte ninguno, la ficha y la tira del grupo enseñan sus iniciales en su color, y ninguna imagen rota (J1.8)',
        noArt.sheet === 'L' && /hsl|rgb/.test(noArt.sheetColor) && noArt.strip === 'L' && noArt.broken === 0, JSON.stringify(noArt));
    if (shot('12-iniciales')) await page.screenshot({ path: shot('12-iniciales') });
    await closeTopPopup();
    // Y en el tablero: al muelle, su ficha con sus iniciales.
    const boards = await allChips();
    const dock = boards.find(c => /^enter:/.test(c.id) && /muelle/i.test(c.label));
    if (dock) await pressChip(new RegExp(`^${dock.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), dock.id);
    const onBoard = await until(() => page.evaluate(() => Boolean(document.querySelector('.wm-token .wm-token-initials'))), 15000);
    const token = await page.evaluate(() => ({
        initials: [...document.querySelectorAll('.wm-token .wm-token-initials')].map(n => n.textContent || ''),
        unknown: [...document.querySelectorAll('.wm-token .wm-token-unknown')].map(n => n.textContent || '').filter(t => t === '???'),
    }));
    check('en el tablero, su ficha también lleva sus iniciales, no «???» (J1.8)', Boolean(dock) && onBoard && token.initials.includes('L') && token.unknown.length === 0,
        JSON.stringify({ dock, token }));
    // Lo que se cuenta al entrar se lee en la caja; «Continuar» deja ver el tablero.
    await carryOn('combat');
    await page.waitForTimeout(600);
    if (shot('13-tablero')) await page.screenshot({ path: shot('13-tablero') });

    const mine = problems.filter(p => /magic|spell|grimo|level-up|sheet|character-panel|attun|sp-|lu-|ch-|hero-face/i.test(p));
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
