#!/usr/bin/env node
/**
 * J19.10 en el navegador, jugando como quien juega: la magia fuera de combate de una clériga,
 * contra un servidor propio con un `--dataRoot` temporal (como `e2e-magia.mjs`).
 *
 *   crear una clériga → sana, la escena no ofrece curar → herida, la escena ofrece «Curar con
 *   magia (…)»: un toque, sube la vida y se gasta un espacio («curar en el viaje», `roadHeal`) →
 *   ya curada, la ficha desaparece → con un asesinato abierto y a nivel 5, la escena ofrece
 *   «Magia: Hablar con los muertos»: la ventana, el muerto contesta y la pista entra en el caso.
 *
 * Uso:
 *   node tools/e2e-magia-campo.mjs --port 8188 --captura C:/tmp/campo.png
 *   (las capturas salen como campo-1-curar.png, campo-2-muertos.png…)
 */

/* global window, document, HTMLElement */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8139;
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

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-campo-'));
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
        .map((/** @type {any} */ c) => ({ id: String(c.id), label: String(c.label) })));
    const dropToasts = () => page.evaluate(() => document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));
    const hero = () => page.evaluate(async () => {
        const { partyMembers } = await import('/scripts/party/state.js');
        return JSON.parse(JSON.stringify(partyMembers[0] ?? null));
    });
    const chatSince = (/** @type {number} */ from) => page.evaluate((start) => (window.SillyTavern.getContext().chat || []).slice(start)
        .map((/** @type {any} */ m) => String(m.extra?.display_text || m.mes || '')).join('\n'), from);
    const chatLength = () => page.evaluate(() => (window.SillyTavern.getContext().chat || []).length);
    const refresh = () => page.evaluate(async () => {
        const { savePartyState, renderPartyMembers } = await import('/scripts/party/roster.js');
        savePartyState();
        renderPartyMembers();
        (await import('/scripts/game-engine/ui/shell/game-shell.js')).refreshGameShell();
    });

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    const firstRun = page.locator('text=Welcome to SillyTavern!');
    if (await firstRun.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#game-shell', { timeout: 90000 });
    const offline = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Jugar sin conexión' });
    await until(async () => await offline.count() === 1, 30000);

    // 1. Una clériga, creada con las tarjetas.
    await offline.click();
    await page.waitForSelector('.hc-root', { timeout: 120000 });
    await page.fill('.hc-root .hc-name', 'Irena');
    await page.locator('.hc-root .hc-gender[data-value="Mujer"]').click();
    await pickHeroCard(page, 'race', 'Humano');
    const picked = await pickHeroCard(page, 'class', 'Clérigo');
    await page.locator('.hc-root .hc-enter').click();
    const inHub = await until(async () => (await hero())?.name === 'Irena', 60000);
    await page.waitForTimeout(1500);
    let irena = await hero();
    check('se crea Irena, clériga, y empieza en el muelle', inHub && /Cl[eé]rig/.test(String(irena?.class)), JSON.stringify({ picked, class: irena?.class }));

    // Que tenga preparado un conjuro de curar (si el juego no se lo dio, lo prepara ella, en el grimorio).
    const healers = ['hab-curar', 'conj-palabra-curacion'];
    if (!(irena?.prepared ?? []).some((/** @type {string} */ id) => healers.includes(id))) {
        await page.locator('#game-shell .gs-party-strip .gs-chip-clickable').filter({ visible: true }).first().click({ timeout: 8000 });
        await page.waitForSelector('.ch-root .ch-grimoire', { timeout: 10000 });
        await page.locator('.ch-root .ch-grimoire').click();
        await page.waitForSelector('.gr-fifth .gr-prepare', { timeout: 10000 });
        await page.locator('.gr-fifth .gr-prepare').click();
        await page.waitForSelector('.sp-prepare .sp-option', { timeout: 10000 });
        const chosen = await page.evaluate(() => [...document.querySelectorAll('.sp-prepare .sp-option.chosen')].map(o => o.getAttribute('data-spell')));
        if (chosen.length > 0) await page.locator(`.sp-prepare .sp-option[data-spell="${chosen[chosen.length - 1]}"]`).click();
        await page.locator('.sp-prepare .sp-option[data-spell="hab-curar"]').click();
        await page.locator('dialog.popup[open]:has(.sp-prepare) .popup-button-ok').click();
        await page.waitForTimeout(700);
        irena = await hero();
    }
    check('tiene a mano un conjuro de curar', (irena?.prepared ?? []).some((/** @type {string} */ id) => healers.includes(id)), JSON.stringify(irena?.prepared));

    // 2. Sana, la escena no ofrece curar.
    await dropToasts();
    const healthy = await allChips();
    check('sana, la escena no ofrece «Curar con magia»', !healthy.some(c => c.id === 'field-heal'), JSON.stringify(healthy.map(c => c.label)));

    // 3. Herida (un corte del ratero), la escena ofrece curar de un toque.
    await page.evaluate(async () => {
        const { partyMembers } = await import('/scripts/party/state.js');
        partyMembers[0].hp = Math.max(1, (Number(partyMembers[0].maxHp) || 10) - 7);
    });
    await refresh();
    await page.waitForTimeout(600);
    const hurtChips = await allChips();
    const heal = hurtChips.find(c => c.id === 'field-heal');
    check('herida, la escena ofrece «Curar con magia (…)», con el conjuro que usaría (J19.10)', Boolean(heal) && /^Curar con magia \((Curar heridas|Palabra de curación)\)$/.test(String(heal?.label)),
        JSON.stringify(hurtChips.map(c => c.label)));
    const before = await hero();
    const logFrom = await chatLength();
    const pressed = heal ? await pressChip(/^Curar con magia/, 'field-heal') : '';
    const healed = await until(async () => Number((await hero())?.hp) > Number(before?.hp), 8000);
    irena = await hero();
    const healLog = await chatSince(logFrom);
    check('un toque: sube la vida, se gasta un espacio de 1.er nivel y se cuenta', Boolean(pressed) && healed && Number(irena?.slotsUsed?.[1]) === 1 && /\[MAGIA\] Irena lanza/.test(healLog),
        JSON.stringify({ pressed, hp: [before?.hp, irena?.hp], slotsUsed: irena?.slotsUsed, healLog: healLog.slice(0, 300) }));
    if (shot('1-curar')) await page.screenshot({ path: shot('1-curar') });
    const stripHp = await page.evaluate(() => document.querySelector('#game-shell .gs-party-strip')?.textContent || '');
    check('y la tira del grupo lo enseña', stripHp.includes(`${irena?.hp}/${irena?.maxHp}`), stripHp.slice(0, 200));
    await page.evaluate(async () => {
        const { partyMembers } = await import('/scripts/party/state.js');
        partyMembers[0].hp = partyMembers[0].maxHp;
    });
    await refresh();
    const after = await allChips();
    check('ya curada, la ficha de curar desaparece', !after.some(c => c.id === 'field-heal'), JSON.stringify(after.map(c => c.label)));

    // 4. Hablar con los muertos: un asesinato en el pueblo, e Irena ya de nivel 5 con el conjuro
    // preparado (lo de subir de nivel y preparar ya lo prueba e2e-magia).
    const clue = await page.evaluate(async () => {
        const { partyMembers } = await import('/scripts/party/state.js');
        const me = partyMembers[0];
        Object.assign(me, { level: 5, maxHp: 38, hp: 38, slotsUsed: {} });
        me.prepared = [...new Set([...(me.prepared ?? []), 'mag-hablar-muertos'])];
        const { generateCase } = await import('/scripts/game-engine/campaign/cases.js');
        const people = ['Vasili el pescador', 'Marta la cordelera', 'Iván el del faro', 'Olga la viuda', 'Pavel el tonelero', 'Nadia la lavandera', 'Bruno el aduanero']
            .map(name => ({ name, place: 'Puerto Alba' }));
        let seed = 7;
        const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        const mystery = generateCase({ people, places: ['Puerto Alba', 'El muelle'], random, day: 1, kind: 'asesinato' });
        const ctx = window.SillyTavern.getContext();
        ctx.chatMetadata.cases = { active: mystery, found: [], closed: [] };
        await ctx.saveMetadata?.();
        const good = (mystery?.clues ?? []).find((/** @type {any} */ c) => !c.misleading);
        return { victim: mystery?.victim ?? '', id: good?.id ?? '', fact: good?.fact ?? '' };
    });
    await refresh();
    await page.waitForTimeout(600);
    const caseChips = await allChips();
    const dead = caseChips.find(c => c.id === 'field-magic');
    check('con un asesinato abierto, la escena ofrece «Magia: Hablar con los muertos» (J19.10)', Boolean(clue.id) && /Hablar con los muertos/.test(String(dead?.label)),
        JSON.stringify({ clue, chips: caseChips.map(c => c.label) }));
    const deadFrom = await chatLength();
    const opened = dead ? await pressChip(/^Magia: /, 'field-magic') : '';
    const row = page.locator('.fm-dialog[open] .fm-spell[data-spell="mag-hablar-muertos"]');
    const rowOk = await row.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    const does = rowOk ? await row.locator('.fm-does').textContent() : '';
    if (rowOk) await row.locator('.fm-cast').click();
    await page.waitForFunction(() => {
        const box = document.querySelector('.fm-dialog[open] .fm-result');
        return box instanceof HTMLElement && !box.hidden && /Pista/.test(box.textContent || '');
    }, null, { timeout: 8000 }).catch(() => {});
    const result = await page.evaluate(() => document.querySelector('.fm-dialog[open] .fm-result')?.textContent || '');
    if (shot('2-muertos')) await page.screenshot({ path: shot('2-muertos') });
    const found = await page.evaluate(() => window.SillyTavern.getContext().chatMetadata?.cases?.found ?? []);
    irena = await hero();
    const deadLog = await chatSince(deadFrom);
    check('la ventana: el muerto contesta, la pista buena entra en el caso y se gasta un espacio de 3.er nivel',
        Boolean(opened) && rowOk && new RegExp(clue.victim.split(' ')[0]).test(String(does)) && found.includes(clue.id)
            && result.includes(clue.fact) && Number(irena?.slotsUsed?.[3]) === 1 && deadLog.includes(`[PISTA] ${clue.fact}`),
        JSON.stringify({ opened, does, found, result: result.slice(0, 300), slotsUsed: irena?.slotsUsed }));
    await page.locator('.fm-dialog[open] .fm-close').click().catch(() => {});
    await page.waitForTimeout(500);
    // El muerto contesta una pista buena cada vez; cuando ya se saben todas (por él o buscando),
    // no tiene más que decir y la escena deja de ofrecerlo.
    await page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const cases = ctx.chatMetadata.cases;
        cases.found = (cases.active?.clues ?? []).filter((/** @type {any} */ c) => !c.misleading).map((/** @type {any} */ c) => c.id);
        await ctx.saveMetadata?.();
    });
    await refresh();
    await page.waitForTimeout(500);
    const done = await allChips();
    check('sabidas ya todas las pistas buenas, el muerto no tiene más que decir: la escena deja de ofrecerlo', !done.some(c => c.id === 'field-magic' && /muertos/.test(c.label)),
        JSON.stringify(done.map(c => c.label)));

    // 5. D-J27: el erudito solo lanza rituales, sin espacios. (La clase, cambiada a mano: crearlo
    // es lo mismo que la clériga.) Desde la ficha, «Magia fuera de combate».
    await page.evaluate(async () => {
        const { partyMembers } = await import('/scripts/party/state.js');
        Object.assign(partyMembers[0], {
            class: 'Erudito', level: 3, cantrips: [], prepared: [], slotsUsed: {},
            spellbook: ['conj-detectar-magia', 'conj-identificar', 'conj-proyectil-magico'],
        });
    });
    await refresh();
    await dropToasts();
    await page.locator('#game-shell .gs-party-strip .gs-chip-clickable').filter({ visible: true }).first().click({ timeout: 8000 });
    await page.waitForSelector('.ch-root .ch-field-magic', { timeout: 10000 }).catch(() => {});
    const scholarButton = await page.locator('.ch-root .ch-field-magic').count();
    if (scholarButton) await page.locator('.ch-root .ch-field-magic').click();
    await page.waitForSelector('.fm-dialog[open] .fm-spell', { timeout: 10000 }).catch(() => {});
    const scholar = await page.evaluate(() => ({
        rows: [...document.querySelectorAll('.fm-dialog[open] .fm-spell')].map(r => `${r.getAttribute('data-spell')}:${r.getAttribute('data-how')}:${r.getAttribute('data-ok')}`),
        slots: document.querySelector('.fm-dialog[open] .fm-slots')?.textContent || '',
    }));
    check('D-J27: el erudito, desde su ficha, solo tiene rituales, sin espacios; Proyectil mágico no sale',
        scholarButton === 1 && scholar.rows.length > 0 && scholar.rows.every(r => /:ritual:/.test(r)) && scholar.rows.includes('conj-detectar-magia:ritual:true')
            && !scholar.rows.some(r => r.startsWith('conj-proyectil-magico')) && /Solo rituales/.test(scholar.slots),
        JSON.stringify(scholar));
    if (shot('3-erudito')) await page.screenshot({ path: shot('3-erudito') });
    await page.locator('.fm-dialog[open] .fm-close').click().catch(() => {});

    const mine = problems.filter(p => /magic|spell|field|fm-|cases|hero-face/i.test(p));
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

console.log(failures === 0 ? '\nLa magia fuera de combate, en el navegador: todo bien.' : `\n${failures} fallos.`);
process.exit(failures === 0 ? 0 : 1);
