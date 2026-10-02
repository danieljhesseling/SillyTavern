#!/usr/bin/env node
/**
 * Solo sabes el nombre de quien se ha presentado (J13.7 de wiki/ROADMAP_SIN_CONEXION.md), jugado
 * con el ratón en «Jugar sin conexión», en el prólogo del gremio:
 *
 *   título → tu personaje → la escena del muelle (el posadero grita «¡Al ladrón!»)
 *   → la pelea con el ratero → la charla («Soy Tomás…») → Brunilda («Soy Brunilda…»)
 *   → el Diario («La gente que conoces») → el pueblo (el herrero, hasta que se presenta)
 *
 * Se mira:
 *
 * - en la ventana de la escena, la placa de Tomás dice «Posadero» hasta que dice su nombre, y
 *   «Tomás» desde esa misma línea; ninguna opción le nombra antes;
 * - cuando cuenta el narrador, ni en la escena ni en la caja de la novela sale una placa: solo el
 *   texto (Daniel, 2026-10-01: «la figura del narrador sobra»);
 * - las fichas de acción no nombran a quien no se conoce;
 * - el Diario cuenta a quién conoces y cómo, y a nadie más;
 * - en el pueblo, el herrero sale por su oficio hasta que habla contigo, y luego por su nombre.
 *
 * Uso:
 *   node tools/e2e-nombres.mjs --port 8433
 *   node tools/e2e-nombres.mjs --port 8433 --captura nombres.png
 */

/* global window, document */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { entrarEnLaPelea } from './e2e-entrar-pelea.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const PORT = Number(argAfter('--port')) || 8433;
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

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-nombres-'));
/** @type {any} */
let server = null;
/** @type {any} */
let browser = null;

function startServer() {
    server = spawn(process.execPath, ['server.js', '--port', String(PORT), '--dataRoot', dataRoot], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    const child = server;
    return new Promise((resolve, reject) => {
        // Con muchas pruebas a la vez en la máquina, el servidor tarda: se le dan seis minutos.
        const timer = setTimeout(() => reject(new Error('the server did not start in 360s')), 360000);
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
 * Elegir en una tarjeta de «Crear personaje», como quien juega.
 *
 * @param {any} page
 * @param {string} pick
 * @param {string} wanted
 */
async function pickHeroCard(page, pick, wanted) {
    await page.locator(`.hc-root .hc-card[data-pick="${pick}"] .hc-pick`).click();
    await page.waitForSelector('.hc-picker .hc-option', { timeout: 15000 });
    const plain = (/** @type {string} */ v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const values = await page.evaluate(() => [...document.querySelectorAll('.hc-picker .hc-option')].map(o => o.getAttribute('data-value') || ''));
    const chosen = values.find((/** @type {string} */ v) => plain(v) === plain(wanted)) ?? values[0];
    await page.locator(`.hc-picker .hc-option[data-value="${chosen}"]`).first().click();
    await page.waitForSelector('.hc-picker', { state: 'detached', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(200);
}

try {
    await startServer();
    browser = await chromium.launch({ channel: 'msedge', headless: !HEADED });
    const context = await browser.newContext({ viewport: { width: 1400, height: 950 } });
    const page = await context.newPage();
    /** @type {string[]} */
    const problems = [];
    page.on('pageerror', (/** @type {any} */ e) => problems.push(`PAGEERROR ${e.message}`));
    await context.addInitScript(() => {
        try {
            window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,combat,travel,prisoners,mesa,high,spell,pet,bill,move,attack,roll,talk,journal');
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
            window.localStorage.setItem('sillytavern_gameSucesos', 'off');
        } catch { /* nada */ }
    });

    // --- Los ayudantes -----------------------------------------------------------------------
    const until = async (/** @type {() => Promise<boolean>} */ test, ms = 30000) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (await test().catch(() => false)) return true;
            await page.waitForTimeout(400);
        }
        return false;
    };
    const state = () => page.evaluate(() => {
        const ctx = window.SillyTavern.getContext();
        return {
            world: String(ctx.chatMetadata?.world_info ?? ''),
            place: String(ctx.chatMetadata?.currentLocation ?? ''),
            fighting: Boolean(ctx.chatMetadata?.combatEncounter?.active),
            narrator: String(ctx.name2 ?? ''),
            known: ctx.chatMetadata?.knownPeople ?? null,
        };
    });
    const chips = () => page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-chip-action')].map(c => (c.textContent || '').trim()));
    const clearDice = async () => {
        let misses = 0;
        for (let i = 0; i < 40; i++) {
            const next = page.locator('.wm-dice-overlay.active .wm-dice-next');
            if (await next.count() === 0) return;
            const clicked = await next.click({ timeout: 1500 }).then(() => true).catch(() => false);
            if (!clicked && ++misses >= 2) return;
            await page.waitForTimeout(150);
        }
    };
    const dropToasts = () => page.evaluate(() => document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));
    /** La ventana de la escena (o la de una charla escrita), como se ve. */
    const story = () => page.evaluate(() => {
        // La ventana de «pelear o buscar otra salida» (J12.2) también es de escena: esa no cuenta.
        const scene = document.querySelector('dialog.ps-dialog:not(.ev-dialog)[open] .ps-root');
        const talk = document.querySelector('dialog.dw-dialog[open]:not(.ps-dialog) .dw-root');
        const root = scene ?? talk;
        if (!root) return null;
        const plate = /** @type {HTMLElement|null} */ (root.querySelector('.qd-nameplate'));
        const portrait = /** @type {HTMLElement|null} */ (root.querySelector('.qd-portrait'));
        return {
            kind: scene ? 'scene' : 'dialogue',
            id: scene ? root.getAttribute('data-scene') || '' : root.getAttribute('data-dialogue') || '',
            narrator: root.classList.contains('ps-narrator'),
            who: portrait?.dataset.who || '',
            plate: (plate?.textContent || '').trim(),
            plateShown: Boolean(plate && !plate.hidden && plate.offsetParent),
            text: (root.querySelector('.qd-text')?.textContent || '').replace(/\s+/g, ' ').trim(),
            options: [...root.querySelectorAll('.dw-option')].map(o => ({ id: o.getAttribute('data-option') || '', text: (o.textContent || '').trim(), locked: o.classList.contains('dw-locked') })),
        };
    });
    /** Jugar la escena abierta, guardando lo que se vio en cada paso. Para al cambiar de escena. */
    const playScene = async () => {
        /** @type {any[]} */
        const frames = [];
        for (let i = 0; i < 60; i++) {
            const now = await story();
            if (!now || now.kind !== 'scene') break;
            if (frames.length > 0 && now.id !== frames[0].id) break;
            const prev = frames[frames.length - 1];
            if (!prev || prev.text !== now.text || prev.plate !== now.plate) frames.push(now);
            const free = now.options.filter((/** @type {any} */ o) => !o.locked);
            if (free.length > 0) {
                await page.locator(`dialog.ps-dialog[open] .dw-option[data-option="${free[0].id}"]`).click({ timeout: 4000 }).catch(() => {});
            } else {
                await page.locator('dialog.ps-dialog[open] .ps-next, dialog.ps-dialog[open] .ps-finish').first().click({ timeout: 4000 }).catch(() => {});
            }
            await page.waitForTimeout(300);
            await clearDice();
        }
        return frames;
    };
    /** Esperar a que se abra la escena `id` (o cualquiera, sin id). */
    const waitScene = (/** @type {string} */ id = '') => until(async () => {
        const now = await story();
        return Boolean(now && now.kind === 'scene' && (!id || now.id === id));
    }, 25000);
    /** La placa y las líneas de la caja de la novela, como se ven ahora. */
    const novel = () => page.evaluate(async () => {
        const shell = await import('/scripts/game-engine/ui/shell/game-shell.js');
        shell.setScene('dialogue');
        shell.refreshGameShell();
        await new Promise(resolve => setTimeout(resolve, 500));
        const plate = /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .gs-vn-nameplate'));
        const chatNames = [...document.querySelectorAll('#chat .mes')].slice(-6).map(m => m.getAttribute('ch_name') || '');
        return {
            plate: (plate?.textContent || '').trim(),
            plateShown: Boolean(plate && !plate.hidden),
            who: [...document.querySelectorAll('#game-shell .gs-vn-who')].map(w => (w.textContent || '').trim()),
            lines: [...document.querySelectorAll('#game-shell .gs-vn-text .gs-vn-line')].map(l => (l.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 140)),
            chatNames,
        };
    });
    /** Ganar la pelea: entrar como quien juega («Pelear», «Empezar»), todos a cero y a acabar turnos. */
    const winFight = async () => {
        await dropToasts();
        await entrarEnLaPelea(page, { ms: 40000 });
        await until(async () => (await state()).fighting, 10000);
        await clearDice();
        await page.evaluate(async () => {
            const enc = (await import('/scripts/party.js')).getCombatEncounter();
            for (const e of enc?.enemies ?? []) e.currentHp = 0;
        });
        for (let i = 0; i < 8 && (await state()).fighting; i++) {
            await page.evaluate(() => window.SillyTavern.getContext().executeSlashCommandsWithOptions('/combat-end'));
            await page.waitForTimeout(700);
            await clearDice();
        }
    };
    const shoot = async (/** @type {string} */ name) => {
        if (SHOT) await page.screenshot({ path: `${SHOT}.${name}.png` });
    };

    // --- 1. El título y tu personaje ---------------------------------------------------------
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 240000 });
    if (await page.locator('text=Welcome to SillyTavern!').waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#game-shell', { timeout: 90000 });
    const offline = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Jugar sin conexión' });
    await until(async () => await offline.count() === 1, 30000);
    await offline.click();
    await page.waitForSelector('.hc-root, dialog[open] .vt-card.vt-new', { timeout: 120000 });
    if (await page.locator('dialog[open] .vt-card.vt-new').count() > 0) await page.locator('dialog[open] .vt-card.vt-new').first().click();
    await page.waitForSelector('.hc-root', { timeout: 120000 });
    await page.fill('.hc-root .hc-name', 'Irene');
    await page.locator('.hc-root .hc-gender[data-value="Mujer"]').click().catch(() => {});
    await pickHeroCard(page, 'race', 'Humano');
    await pickHeroCard(page, 'class', 'Guerrero');
    await page.locator('.hc-root .hc-enter').click();
    const inGuild = await until(async () => /Gremio/.test((await state()).world), 90000);
    check('se entra en el gremio con Irene, sin conexión', inGuild);

    // --- 2. El muelle: el posadero grita, y aún no sabes quién es ------------------------------
    const dockOpen = await waitScene('el-muelle');
    await page.waitForTimeout(600);
    await shoot('muelle');
    const dock = await playScene();
    const tomasDock = dock.filter(f => f.who === 'Tomás');
    check('J13.7: en el muelle, la placa del posadero dice «Posadero», no «Tomás»',
        dockOpen && tomasDock.length > 0 && tomasDock.every(f => f.plateShown && f.plate === 'Posadero'),
        JSON.stringify(dock.map(f => [f.who, f.plate, f.plateShown, f.text.slice(0, 50)])));
    check('J13.7: ninguna opción ni línea del muelle dice «Tomás»',
        dock.length > 0 && dock.every(f => !/Tomás/.test(f.text) && f.options.every((/** @type {any} */ o) => !/Tomás/.test(o.text))),
        JSON.stringify(dock.map(f => [f.text.slice(0, 60), f.options.map((/** @type {any} */ o) => o.text)])));
    const dockNarrator = dock.filter(f => f.narrator);
    check('el narrador, en la escena: sin placa, solo el texto', dockNarrator.length > 0 && dockNarrator.every(f => !f.plateShown),
        JSON.stringify(dockNarrator.map(f => [f.plate, f.plateShown, f.text.slice(0, 40)])));
    await page.waitForTimeout(1500);
    const dockChips = await chips();
    check('J13.7: las fichas de acción no nombran a quien no se conoce', !dockChips.some(c => /Tomás|Brunilda|Ramiro|Marisa|Elvira/.test(c)), JSON.stringify(dockChips));
    const box1 = await novel();
    const { narrator } = await state();
    check('«La figura del narrador sobra»: en la caja de la novela, lo del narrador sale sin placa ni nombre',
        !(box1.plateShown && (box1.plate === narrator || box1.plate === 'Narrador')) && !box1.who.some(w => w === narrator || w === 'Narrador'),
        JSON.stringify({ narrator, ...box1 }));
    check('J13.7: la caja no llama «Tomás» a quien no se ha presentado',
        !box1.plate.includes('Tomás') && box1.lines.every(l => !/Tomás/.test(l)), JSON.stringify(box1));
    await shoot('caja-muelle');

    // --- 3. La pelea, y la charla: «Soy Tomás» -------------------------------------------------
    await page.evaluate(async () => {
        const shell = await import('/scripts/game-engine/ui/shell/game-shell.js');
        shell.setScene('combat');
        shell.refreshGameShell();
    });
    await dropToasts();
    await winFight();
    const talkOpen = await waitScene('la-charla');
    await page.waitForTimeout(500);
    const talk = await playScene();
    const intro = talk.findIndex(f => f.who === 'Tomás' && /Soy Tomás/.test(f.text));
    check('J13.7: Tomás dice su nombre en la charla, y desde esa línea su placa dice «Tomás»',
        talkOpen && intro >= 0 && talk.slice(intro).filter(f => f.who === 'Tomás').every(f => f.plate === 'Tomás'),
        JSON.stringify(talk.map(f => [f.who, f.plate, f.text.slice(0, 50)])));
    check('J13.7: antes de presentarse, el narrador le llama «el posadero»',
        talk.slice(0, Math.max(0, intro)).every(f => !/Tomás/.test(f.text)) && talk.some(f => /el posadero/i.test(f.text)),
        JSON.stringify(talk.slice(0, Math.max(1, intro)).map(f => f.text.slice(0, 80))));
    await shoot('charla');

    // --- 4. Brunilda: Tomás la nombra, y ella se presenta --------------------------------------
    const guildOpen = await waitScene('el-gremio');
    const guild = guildOpen ? await playScene() : [];
    const bruni = guild.filter(f => f.who === 'Brunilda');
    check('J13.7: Tomás la nombra («¡Brunilda!») y ella se presenta: su placa dice «Brunilda»',
        guildOpen && bruni.length > 0 && bruni.every(f => f.plate === 'Brunilda') && guild.filter(f => f.who === 'Tomás').every(f => f.plate === 'Tomás'),
        JSON.stringify(guild.map(f => [f.who, f.plate, f.text.slice(0, 50)])));
    const known = (await state()).known;
    check('J13.7: la partida guarda a quién conoces y cómo', Boolean(known?.people?.tomas && known?.people?.brunilda) && !known?.people?.ramiro,
        JSON.stringify(known));

    // --- 5. El Diario: la gente que conoces -----------------------------------------------------
    await page.waitForTimeout(800);
    await dropToasts();
    await page.locator('#game-shell .gs-journal').first().click({ timeout: 5000 }).catch(() => {});
    // El Diario es un libro: lo apuntado (y la gente que conoces) está en «Apuntes».
    await until(() => page.evaluate(() => Boolean(document.querySelector('dialog.lb-dialog[open]'))), 10000);
    await page.locator('dialog.lb-dialog[open] .lb-tab[data-view="notes"]').first().click({ timeout: 5000 }).catch(() => {});
    const journalOpen = await until(() => page.evaluate(() => /La gente que conoces/.test(document.querySelector('dialog.lb-dialog[open]')?.textContent || '')), 10000);
    const journal = await page.evaluate(() => (document.querySelector('dialog.lb-dialog[open]')?.textContent || '').replace(/\s+/g, ' '));
    const peopleSection = journal.slice(journal.indexOf('La gente que conoces'), journal.indexOf('La gente que conoces') + 400);
    check('J13.7: el Diario cuenta a quién conoces (Tomás, Brunilda) y a nadie más',
        journalOpen && /Tomás/.test(peopleSection) && /Brunilda/.test(peopleSection) && !/Ramiro|Marisa|Elvira/.test(peopleSection),
        peopleSection.slice(0, 300) || journal.slice(0, 300));
    await page.evaluate(() => {
        const at = [...document.querySelectorAll('dialog.lb-dialog[open] h1, dialog.lb-dialog[open] h2, dialog.lb-dialog[open] h3, dialog.lb-dialog[open] h4, dialog.lb-dialog[open] p, dialog.lb-dialog[open] div')]
            .find(n => n.childElementCount === 0 && /La gente que conoces/.test(n.textContent || ''));
        at?.scrollIntoView({ block: 'start' });
    });
    await page.waitForTimeout(300);
    await shoot('diario');
    await page.locator('dialog.lb-dialog[open] .lb-close').first().click({ timeout: 4000 }).catch(() => {});
    await until(() => page.evaluate(() => !document.querySelector('dialog.lb-dialog[open]')), 5000);

    // --- 6. El pueblo: el herrero, hasta que se presenta ---------------------------------------
    await page.evaluate(async () => {
        const shell = await import('/scripts/game-engine/ui/shell/game-shell.js');
        shell.setScene('exploration');
        shell.refreshGameShell();
    });
    await until(() => page.evaluate(() => document.querySelectorAll('#game-shell .gs-town-place').length > 0), 10000);
    const townText = await page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-town-place')].map(p => (p.textContent || '').replace(/\s+/g, ' ').trim()));
    check('J13.7: en el pueblo, quien no se ha presentado sale por su oficio (el herrero, no Ramiro)',
        townText.length > 0 && townText.every(t => !/Ramiro|Marisa|Elvira/.test(t)), JSON.stringify(townText));
    await shoot('pueblo');
    const smithy = await page.locator('#game-shell .gs-town-place[data-place="herreria"]').first().click({ timeout: 6000 }).then(() => true).catch(() => false);
    await until(() => page.evaluate(() => document.querySelector('#game-shell .gs-town-scene')?.getAttribute('data-place') === 'herreria'), 6000);
    const smithyView = await page.evaluate(() => ({
        text: (document.querySelector('#game-shell .gs-town-scene')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 600),
        line: (document.querySelector('#game-shell .gs-town-scene .gs-town-line')?.textContent || '').trim(),
        plate: (document.querySelector('#game-shell .gs-town-scene .gs-town-plate')?.textContent || '').trim(),
        acts: [...document.querySelectorAll('#game-shell .gs-town-scene .gs-town-act')].map(b => ({ id: b.getAttribute('data-action') || '', label: (b.textContent || '').trim() })),
    }));
    const talkAct = smithyView.acts.find(a => /^talk-local:/.test(a.id));
    await shoot('herreria');
    // El saludo de la primera vez puede ser el suyo («Ramiro. Herrero. ¿Qué se te ha roto?»): eso es presentarse.
    const saidHisName = /«[^»]*Ramiro[^»]*»/.test(smithyView.line);
    check('J13.7: el saludo nunca dice «El herrero. Herrero.» (quien dice su nombre al saludar, se presenta)',
        !/herrero\.\s*Herrero/i.test(smithyView.line), smithyView.line);
    if (saidHisName) {
        const knownNow = (await state()).known;
        check('J13.7: el herrero se presenta al saludar: placa «Ramiro», «Hablar con Ramiro», y la partida lo apunta',
            smithy && smithyView.plate === 'Ramiro' && /Ramiro/.test(talkAct?.label ?? '') && knownNow?.people?.ramiro?.how === 'presentado',
            JSON.stringify({ ...smithyView, knownNow }));
    } else {
        check('J13.7: en la herrería, «Hablar con el herrero», sin su nombre (tampoco en los trabajos)',
            smithy && Boolean(talkAct) && /el herrero/i.test(talkAct?.label ?? '') && !/Ramiro/.test(smithyView.text),
            JSON.stringify(smithyView));
        if (talkAct) {
            await page.locator(`#game-shell .gs-town-scene .gs-town-act[data-action="${talkAct.id}"]`).first().click({ timeout: 5000 }).catch(() => {});
            const opened = await until(() => page.evaluate(() => Boolean(document.querySelector('.popup:not([closing]) .tk-root, dialog.dw-dialog[open]'))), 10000);
            await page.waitForTimeout(800);
            const heard = await page.evaluate(() => (document.querySelector('.popup:not([closing]) .tk-root, dialog.dw-dialog[open]')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 500));
            check('J13.7: al hablar con él, el herrero dice su nombre', opened && /Ramiro/.test(heard), heard);
            await shoot('herrero-habla');
            await page.locator('.popup:not([closing]):has(.tk-root) .popup-button-ok, dialog.dw-dialog[open] .dw-finish, dialog.dw-dialog[open] .dw-leave').first().click({ timeout: 4000 }).catch(() => {});
            await page.waitForTimeout(800);
            const after = await page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-town-scene .gs-town-act')].map(b => (b.textContent || '').trim()));
            const knownNow = (await state()).known;
            check('J13.7: y desde entonces es «Ramiro»', Boolean(knownNow?.people?.ramiro) && after.some(a => /Ramiro/.test(a)), JSON.stringify({ after, knownNow }));
        }
    }

    check('sin errores de página', problems.length === 0, problems.slice(0, 5).join(' | '));
} catch (error) {
    failures++;
    console.log(`FAIL  la prueba se rompió: ${error instanceof Error ? error.stack : error}`);
} finally {
    await browser?.close().catch(() => {});
    server?.kill();
    try { rmSync(dataRoot, { recursive: true, force: true }); } catch { /* nada */ }
}
console.log(failures === 0 ? '\nTODO BIEN' : `\n${failures} FALLO(S)`);
process.exit(failures === 0 ? 0 : 1);
