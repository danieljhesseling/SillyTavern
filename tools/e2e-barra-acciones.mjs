#!/usr/bin/env node
/**
 * La barra de acciones de D&D 2024 (tanda 10, wiki/maquetas/ENCARGO_COMBATE_VTT.md), en un
 * navegador de verdad contra un servidor propio con un `--dataRoot` temporal:
 *
 *   título → Jugar sin conexión → Nerea, guerrera → la bodega del gremio. Antes de pelear se le
 *   da una espada corta (ligera, Molestar), una daga (para la otra mano) y dos pociones. En su
 *   turno:
 *
 *   - la barra: de quién es el turno, Acción, Adicional y Reacción, los pies, «Cuerpo a tierra»
 *     y los seis botones (Atacar, Magia, Acciones, Adicional, Fin de turno, Abandonar), y nada de
 *     «Hablar», «Maniobras», «Mascota» ni «Objetivos»;
 *   - Atacar: el arma con su maestría, a quién llega, el golpe sin armas, agarrar y empujar con su
 *     CD, y cambiar de arma; el menú no pasa de 440 px ni se corta por arriba; Esc y pulsar el
 *     mapa lo cierran (y ese toque no mueve a nadie);
 *   - Acciones: las siete de 2024 y Preparar; Correr suma los pies;
 *   - Cuerpo a tierra es gratis; levantarse cuesta la mitad;
 *   - atacar con la espada corta desde el menú gasta la acción; con la daga en la otra mano,
 *     Adicional ofrece el golpe con la otra mano, y beber una poción;
 *   - Magia (con la ficha hecha maga un momento): las gemas de los espacios y los filtros; y,
 *     de nivel 3, lanzar Proyectil mágico con un espacio de nivel 2 (J19.3): cuatro dardos;
 *   - con el teclado: 3 abre Acciones, Esc lo cierra, 1 abre Atacar;
 *   - y en 1920 × 1080 y en un teléfono (390 × 844 y tumbado) la barra cabe y el menú también.
 *
 * Saca capturas de cada cosa; mirarlas.
 *
 * Uso:
 *   node tools/e2e-barra-acciones.mjs                                # puerto 8411, sin ventana
 *   node tools/e2e-barra-acciones.mjs --headed
 *   node tools/e2e-barra-acciones.mjs --port 8411 --captura barra.png  # barra.1280.png, …
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
const PORT = Number(argAfter('--port')) || 8411;
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

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-barra-'));
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
        const timer = setTimeout(() => reject(new Error('the server did not start in 300s')), 300000);
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
 * Elegir en una tarjeta de «Crear personaje» la opción que se parece a lo pedido, o la primera.
 *
 * @param {any} target
 * @param {string} pick
 * @param {string} wanted
 */
async function pickHeroCard(target, pick, wanted) {
    await target.locator(`.hc-root .hc-card[data-pick="${pick}"] .hc-pick`).click();
    await target.waitForSelector('.hc-picker .hc-option', { timeout: 15000 });
    const plain = (/** @type {string} */ v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const values = await target.evaluate(() => [...document.querySelectorAll('.hc-picker .hc-option')].map(o => o.getAttribute('data-value') || ''));
    const chosen = values.find((/** @type {string} */ v) => plain(v).includes(plain(wanted))) ?? values[0];
    await target.locator(`.hc-picker .hc-option[data-value="${chosen}"]`).first().click();
    await target.waitForSelector('.hc-picker', { state: 'detached', timeout: 15000 }).catch(() => {});
    await target.waitForTimeout(200);
}

try {
    await startServer();
    browser = await chromium.launch({ channel: 'msedge', headless: !HEADED });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    page = await context.newPage();
    /** @type {string[]} */
    const problems = [];
    page.on('pageerror', (/** @type {any} */ e) => problems.push(`PAGEERROR ${e.message}`));
    page.on('console', (/** @type {any} */ m) => {
        if (m.type() === 'error' && !/Failed to load resource.*404/.test(m.text())) problems.push(`ERROR ${m.text().slice(0, 300)}`);
    });
    // Nada de internet: lo que pida fuera de este servidor, se apunta.
    /** @type {string[]} */
    const outside = [];
    page.on('request', (/** @type {any} */ r) => {
        const url = String(r.url());
        if (/^https?:/.test(url) && !url.startsWith(BASE)) outside.push(url);
    });
    await context.addInitScript(() => {
        try {
            window.localStorage.setItem('sillytavern_gameTipsSeen', 'dialogue,exploration,combat,travel,prisoners,mesa,high,spell,pet,bill,move,attack,roll,talk,journal');
            window.localStorage.setItem('sillytavern_gameShellAutostart', 'true');
            window.localStorage.setItem('sillytavern_gameSucesos', 'off');
            window.localStorage.setItem('sillytavern_gameStoryWindows', 'off');
        } catch { /* nada */ }
    });

    const until = async (/** @type {() => Promise<boolean>} */ test, ms = 30000) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (await test().catch(() => false)) return true;
            await page.waitForTimeout(300);
        }
        return false;
    };
    const fighting = () => page.evaluate(() => Boolean(window.SillyTavern.getContext().chatMetadata?.combatEncounter?.active));
    const dropToasts = () => page.evaluate(() => document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));
    const clearDice = async () => {
        for (let i = 0; i < 40; i++) {
            const next = page.locator('.wm-dice-overlay.active .wm-dice-next');
            if (await next.count() === 0) break;
            if (!await next.click({ timeout: 1500 }).then(() => true).catch(() => false)) break;
            await page.waitForTimeout(200);
        }
    };
    const shot = async (/** @type {string} */ name) => {
        if (!SHOT) return;
        const file = `${SHOT.replace(/\.png$/i, '')}.${name}.png`;
        await page.screenshot({ path: file });
        console.log(`      captura: ${file}`);
    };
    /** Lo que se sabe del turno: de quién es, lo que le queda, lo que lleva encima. */
    const turn = () => page.evaluate(async () => {
        const party = await import('/scripts/party/state.js');
        const cs = await import('/scripts/party/combat-state.js');
        const enc = party.combatEncounter;
        const entry = cs.getCurrentTurnEntry();
        const hero = party.partyMembers[0];
        return {
            mine: Boolean(entry && !entry.isEnemy && String(entry.id) === String(hero?.id)),
            fighting: Boolean(enc.active),
            action: !enc.turnState?.actionUsed,
            bonus: !enc.turnState?.bonusActionUsed,
            left: hero ? cs.getRemainingMovementFeet(hero) : 0,
            conditions: [...(hero?.activeConditions ?? [])],
            x: Number(hero?.mapPosition?.gridX) || 0,
            y: Number(hero?.mapPosition?.gridY) || 0,
            hp: Number(hero?.hp) || 0,
            potions: (hero?.items ?? []).filter((/** @type {any} */ i) => /Poción/.test(i.name)).length,
            weapon: String((hero?.items ?? []).find((/** @type {any} */ i) => i.id === hero?.equippedItems?.weapon)?.name ?? ''),
            enemies: enc.enemies.filter((/** @type {any} */ e) => (Number(e.currentHp) || 0) > 0).map((/** @type {any} */ e) => ({ id: String(e.instanceId), x: Number(e.gridX), y: Number(e.gridY), hp: Number(e.currentHp) })),
        };
    });
    /** Hasta que le toque a Nerea (pasando los dados y los turnos de los demás). */
    const heroTurn = async (ms = 40000) => until(async () => {
        await clearDice();
        await dropToasts();
        const now = await turn();
        return now.mine || !now.fighting;
    }, ms);
    const bar = () => page.evaluate(() => {
        const root = document.querySelector('#game-shell .gs-actions.gs-actions-vtt .gs-vtt-bar');
        const r = root?.getBoundingClientRect();
        const menu = document.querySelector('#game-shell .gs-actions-vtt .gs-grimoire');
        const m = menu?.getBoundingClientRect();
        const head = document.querySelector('#game-shell .gs-head')?.getBoundingClientRect();
        return {
            shown: Boolean(r && r.width > 10 && r.height > 10),
            box: r ? { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom) } : null,
            buttons: [...document.querySelectorAll('#game-shell .gs-vtt-bar .gs-btn')].map(b => (b.querySelector('.gs-btn-label')?.textContent || '').trim()),
            disabled: [...document.querySelectorAll('#game-shell .gs-vtt-bar .gs-btn')].filter(b => /** @type {HTMLButtonElement} */ (b).disabled).map(b => (b.querySelector('.gs-btn-label')?.textContent || '').trim()),
            pills: [...document.querySelectorAll('#game-shell .gs-vtt-bar .gs-pill')].map(p => `${(p.textContent || '').replace('●', '').trim()}:${p.classList.contains('ready') ? 'lista' : 'gastada'}`),
            move: (document.querySelector('#game-shell .gs-vtt-bar .gs-move-label')?.textContent || '').trim(),
            prone: (document.querySelector('#game-shell .gs-vtt-bar .gs-prone-toggle')?.getAttribute('title') || '') + '|' + (document.querySelector('#game-shell .gs-vtt-bar .gs-prone-toggle')?.textContent || '').trim(),
            menu: menu ? {
                id: menu.getAttribute('data-menu') || '',
                top: Math.round(m?.top ?? 0),
                bottom: Math.round(m?.bottom ?? 0),
                height: Math.round(m?.height ?? 0),
                left: Math.round(m?.left ?? 0),
                right: Math.round(m?.right ?? 0),
                title: (menu.querySelector('.gs-grimoire-title')?.textContent || '').trim(),
                cards: [...menu.querySelectorAll('.gs-card')].map(c => ({
                    pick: c.getAttribute('data-pick') || '',
                    name: (c.querySelector('.gs-card-name-text')?.textContent || '').trim(),
                    tags: [...c.querySelectorAll('.gs-tag-mastery, .gs-tag-dc, .gs-tag-plain')].map(t => (t.textContent || '').trim()),
                    badges: [...c.querySelectorAll('.gs-card-badge')].map(t => (t.textContent || '').trim()),
                    off: /** @type {HTMLButtonElement} */ (c).disabled === true,
                    why: (c.querySelector('.gs-card-why')?.textContent || '').trim(),
                })),
                gems: menu.querySelectorAll('.gs-slot-gems .fa-diamond').length,
                filters: [...menu.querySelectorAll('.gs-filter-pill[data-filter]')].map(f => (f.textContent || '').trim()),
                head: (menu.querySelector('.gs-head-action')?.textContent || '').trim(),
            } : null,
            headBottom: Math.round(head?.bottom ?? 0),
            vw: window.innerWidth,
            vh: window.innerHeight,
            pageWide: document.documentElement.scrollWidth > window.innerWidth + 1,
        };
    });
    const openMenu = async (/** @type {string} */ id) => {
        await clearDice();
        const now = await bar();
        if (now.menu?.id === id) return;
        await page.locator(`#game-shell .gs-vtt-bar .gs-btn[data-menu="${id}"]`).click({ timeout: 5000 });
        await page.waitForSelector(`#game-shell .gs-grimoire[data-menu="${id}"]`, { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(250);
    };
    const pickCard = async (/** @type {string} */ pick) => {
        await page.locator(`#game-shell .gs-grimoire [data-pick="${pick}"]`).first().click({ timeout: 5000 });
        await page.waitForTimeout(400);
    };

    // Con muchos servidores a la vez, la primera carga puede tardar.
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    const firstRun = page.locator('text=Welcome to SillyTavern!');
    if (await firstRun.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#game-shell', { timeout: 120000 });

    // 1. Nerea, guerrera, al gremio.
    const offline = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Jugar sin conexión' });
    await until(async () => await offline.count() === 1, 60000);
    await offline.click();
    await page.waitForSelector('.hc-root', { timeout: 120000 });
    await page.fill('.hc-root .hc-name', 'Nerea');
    await pickHeroCard(page, 'race', 'Humano');
    await pickHeroCard(page, 'class', 'Guerrero');
    await page.locator('.hc-root .hc-enter').click();
    const inHub = await until(() => page.evaluate(async () => (await import('/scripts/party.js')).getPartyMembersSnapshot().length === 1), 90000);
    check('empieza en el gremio, con Nerea', inHub);

    // Antes de pelear: una espada corta puesta (ligera, Molestar), una daga y dos pociones.
    await page.evaluate(async () => {
        const { createItem } = await import('/scripts/dnd-system.js');
        const { partyMembers } = await import('/scripts/party/state.js');
        const hero = partyMembers[0];
        const sword = createItem({ name: 'Espada corta', type: 'weapon', category: 'weapon', slot: 'weapon', damageDice: '1d6', damageType: 'cortante', hands: 1, kitForm: 'forma-espada-corta' });
        const dagger = createItem({ name: 'Daga', type: 'weapon', category: 'weapon', slot: 'weapon', damageDice: '1d4', damageType: 'perforante', hands: 1, rangeFeet: 20, kitForm: 'forma-daga' });
        const potions = [1, 2].map(() => createItem({ name: 'Poción de curación', type: 'gear', category: 'magic', subcategory: 'potion', description: 'Recupera 2d4+2 puntos de vida al beberla.' }));
        hero.items = [...(hero.items ?? []), sword, dagger, ...potions];
        hero.equippedItems = { ...(hero.equippedItems ?? {}), weapon: sword.id, shield: null };
        hero.strength = 16;
        hero.hp = Math.max(1, (Number(hero.maxHp) || 12) - 4);
        (await import('/scripts/party/roster.js')).savePartyState();
    });

    // 2. La pelea de la bodega.
    // Como quien juega: la pelea se abre sola (la decisión, «Pelear», colocar y «Empezar»).
    await dropToasts();
    await entrarEnLaPelea(page, { ms: 90000 });
    check('la pelea de la bodega empieza', await until(fighting, 20000));
    const mine = await heroTurn();
    check('le toca a Nerea', mine && (await turn()).mine, JSON.stringify(await turn()));
    await page.waitForTimeout(600);
    await dropToasts();

    // 3. La barra.
    const first = await bar();
    await shot('1280');
    // Lo de detrás (el tablero, de la parte del lienzo): se dice, para saber de quién es lo que falle.
    const behind = await page.evaluate(() => {
        const box = (/** @type {string} */ s) => {
            const r = document.querySelector(s)?.getBoundingClientRect();
            return r ? `${Math.round(r.width)}x${Math.round(r.height)}@${Math.round(r.left)},${Math.round(r.top)}` : 'no';
        };
        return {
            scene: document.querySelector('#game-shell')?.getAttribute('data-scene'),
            stage: box('#game-shell .gs-stage'),
            map: box('#game-shell .gs-scene-map'),
            row: box('#world_location_maps_row'),
            container: box('#game-shell .wm-container'),
            tokens: document.querySelectorAll('#game-shell .wm-token').length,
            vtt: document.querySelectorAll('#game-shell .wm-vtt').length,
        };
    });
    console.log(`      detrás de la barra: ${JSON.stringify(behind)}`);
    check('la barra flota abajo, dentro de la pantalla, sin barras de desplazamiento',
        first.shown && Boolean(first.box) && (first.box?.bottom ?? 0) <= first.vh && (first.box?.left ?? -1) >= 0 && (first.box?.right ?? 0) <= first.vw && !first.pageWide, JSON.stringify(first.box));
    check('los seis botones: Atacar, Magia, Acciones, Adicional, Fin de turno y Abandonar',
        ['Atacar', 'Magia', 'Acciones', 'Adicional', 'Fin de turno', 'Abandonar'].every(b => first.buttons.includes(b)), JSON.stringify(first.buttons));
    check('ni «Hablar», ni «Maniobras», ni «Mascota», ni «Objetivos» en la barra',
        !first.buttons.some(b => /Hablar|Maniobras|Mascota|Objetivos|Habilidades/.test(b)), JSON.stringify(first.buttons));
    check('Acción, Adicional y Reacción, listas; los pies, «x/30 pies»; y «Cuerpo a tierra»',
        first.pills.join(',') === 'Acción:lista,Adicional:lista,Reacción:lista' && /\d+\/\d+ pies/.test(first.move) && /Cuerpo a tierra/.test(first.prone),
        JSON.stringify({ pills: first.pills, move: first.move, prone: first.prone }));
    check('un guerrero sin conjuros: «Magia» apagada', first.disabled.includes('Magia'), JSON.stringify(first.disabled));

    // 4. Atacar.
    await openMenu('atacar');
    const attack = await bar();
    await shot('1280.atacar');
    const cards = attack.menu?.cards ?? [];
    const weaponCard = cards.find(c => /^weapon:/.test(c.pick));
    check('Atacar: tu arma, con su maestría de 2024 (Espada corta · Molestar)',
        Boolean(weaponCard && /Espada corta/.test(weaponCard.name) && weaponCard.tags.includes('Molestar') && weaponCard.badges.some(b => /pies/.test(b))), JSON.stringify(weaponCard));
    const grab = cards.find(c => c.pick === 'unarmed:agarrar');
    const shove = cards.find(c => c.pick === 'unarmed:empujar');
    check('Atacar: el golpe sin armas, agarrar y empujar, con su CD (8 + Fuerza + competencia = 13)',
        cards.some(c => c.pick === 'unarmed:golpe') && Boolean(grab?.tags.includes('CD 13')) && Boolean(shove?.tags.includes('CD 13')), JSON.stringify(cards.map(c => [c.pick, c.tags])));
    check('Atacar: cambiar de arma, gratis', /Cambiar de arma/.test(attack.menu?.head ?? ''), attack.menu?.head ?? '');
    check('el menú no pasa de 440 px y no se corta por arriba',
        Boolean(attack.menu) && (attack.menu?.height ?? 999) <= 441 && (attack.menu?.top ?? -1) >= attack.headBottom - 1, JSON.stringify({ menu: attack.menu && { top: attack.menu.top, height: attack.menu.height }, head: attack.headBottom }));
    check('ninguna tarjeta dice «ft»', !JSON.stringify(cards).match(/\bft\b/), '');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    check('Esc cierra el menú', !(await bar()).menu);

    // Pulsar el mapa lo cierra, y ese toque no mueve a nadie.
    await openMenu('acciones');
    const before = await turn();
    // Un punto del mapa que no tape nada del HUD (con el lienzo a pantalla completa, el menú
    // está encima del mapa: pulsar en su sitio sería pulsar una tarjeta).
    const mapPoint = await page.evaluate(() => {
        const box = document.querySelector('#game-shell .gs-scene-map .wm-container');
        const r = box?.getBoundingClientRect();
        if (!box || !r) return null;
        for (let fy = 0.2; fy <= 0.8; fy += 0.05) {
            for (let fx = 0.05; fx <= 0.95; fx += 0.05) {
                const x = r.left + r.width * fx;
                const y = r.top + r.height * fy;
                const hit = document.elementFromPoint(x, y);
                if (hit && box.contains(hit) && !hit.closest('.wm-token, .gs-grimoire, .gs-vtt-bar')) return { x, y };
            }
        }
        return null;
    });
    if (mapPoint) await page.mouse.click(mapPoint.x, mapPoint.y);
    await page.waitForTimeout(500);
    const afterMap = await turn();
    check('pulsar el mapa cierra el menú, y no mueve a nadie', !(await bar()).menu && afterMap.x === before.x && afterMap.y === before.y, JSON.stringify({ before: [before.x, before.y], after: [afterMap.x, afterMap.y] }));

    // 5. Acciones.
    await openMenu('acciones');
    const acts = await bar();
    await shot('1280.acciones');
    const names = (acts.menu?.cards ?? []).map(c => c.name);
    check('Acciones: Correr, Destrabarse, Esquivar, Ayudar, Ocultarse, Estudiar, Utilizar y Preparar',
        ['Correr', 'Destrabarse', 'Esquivar', 'Ayudar', 'Ocultarse', 'Estudiar', 'Utilizar', 'Preparar golpe'].every(n => names.includes(n)), JSON.stringify(names));
    check('Ocultarse dice su CD 15 de Sigilo', (acts.menu?.cards ?? []).some(c => c.name === 'Ocultarse' && c.tags.some(t => /CD 15/.test(t))));
    await page.keyboard.press('Escape');

    // 6. Cuerpo a tierra: gratis; levantarse, la mitad.
    const standing = await turn();
    await page.locator('#game-shell .gs-vtt-bar .gs-prone-toggle').click();
    await page.waitForTimeout(500);
    const down = await turn();
    const downBar = await bar();
    check('«Cuerpo a tierra» tira al suelo sin gastar pies', down.conditions.includes('Prone') && down.left === standing.left && /Levantarse/.test(downBar.prone), JSON.stringify({ down, prone: downBar.prone }));
    await page.locator('#game-shell .gs-vtt-bar .gs-prone-toggle').click();
    await page.waitForTimeout(500);
    const up = await turn();
    check('levantarse cuesta la mitad del movimiento', !up.conditions.includes('Prone') && up.left === standing.left - 15, JSON.stringify({ before: standing.left, after: up.left }));

    // 7. Correr.
    await openMenu('acciones');
    await pickCard('act:correr');
    await page.waitForTimeout(500);
    await clearDice();
    const ran = await turn();
    check('Correr gasta la acción y suma 30 pies', !ran.action && ran.left === up.left + 30, JSON.stringify({ before: up.left, after: ran.left, action: ran.action }));
    await shot('1280.correr');

    // 8. Adicional: beber una poción (2024: acción adicional).
    await openMenu('adicional');
    const bonus = await bar();
    await shot('1280.adicional');
    const drink = (bonus.menu?.cards ?? []).find(c => /^drink:/.test(c.pick));
    check('Adicional: beber una poción, con lo que cura', Boolean(drink && !drink.off && drink.badges.some(b => /Cura 2d4\+2/.test(b))), JSON.stringify(drink));
    const offhand = (bonus.menu?.cards ?? []).find(c => c.pick === 'offhand');
    check('Adicional: el golpe con la otra mano, apagado hasta atacar con la ligera', Boolean(offhand && offhand.off && /ataca/i.test(offhand.why)), JSON.stringify(offhand));
    const ownBonus = (bonus.menu?.cards ?? []).filter(c => /^ability:/.test(c.pick)).map(c => c.name);
    check('Adicional: lo de tu clase que va con la adicional (el guerrero, Segundo aliento)', ownBonus.includes('Segundo aliento'), JSON.stringify(ownBonus));
    if (drink) await pickCard(drink.pick);
    await page.waitForTimeout(500);
    await clearDice();
    const drank = await turn();
    check('beberla gasta la adicional y la poción, y cura', !drank.bonus && drank.potions === 1 && drank.hp > ran.hp, JSON.stringify({ hp: [ran.hp, drank.hp], potions: drank.potions, bonus: drank.bonus }));

    // 9. Magia: con la ficha hecha maga un momento, las gemas y los filtros.
    await page.evaluate(async () => {
        const { partyMembers } = await import('/scripts/party/state.js');
        partyMembers[0].class = 'Mago';
        (await import('/scripts/party/board-view.js')).renderLocationMapsPreview();
    });
    await page.waitForTimeout(600);
    await openMenu('magia');
    const magic = await bar();
    await shot('1280.magia');
    check('Magia: las gemas de los espacios que quedan y los filtros Todos, Trucos, Nivel 1',
        Boolean(magic.menu) && (magic.menu?.gems ?? 0) >= 2 && ['Todos', 'Trucos', 'Nivel 1'].every(f => magic.menu?.filters.includes(f)), JSON.stringify(magic.menu && { gems: magic.menu.gems, filters: magic.menu.filters, cards: magic.menu.cards.map(c => c.name) }));
    await page.keyboard.press('Escape');
    await page.evaluate(async () => {
        const { partyMembers } = await import('/scripts/party/state.js');
        partyMembers[0].class = 'Guerrero';
        (await import('/scripts/party/board-view.js')).renderLocationMapsPreview();
    });
    await page.waitForTimeout(400);

    // 10. Fin de turno, y al siguiente: atacar desde el menú, y luego la otra mano.
    await page.locator('#game-shell .gs-vtt-bar .gs-btn-end').click();
    await page.locator('.popup-button-ok:visible').first().click({ timeout: 2500 }).catch(() => {});
    let fought = 0;
    let offhandTried = false;
    let keysTried = false;
    const deadline = Date.now() + 240000;
    while (Date.now() < deadline && await fighting()) {
        if (!await heroTurn(30000)) continue;
        if (!(await turn()).fighting) break;
        await page.waitForTimeout(400);
        await dropToasts();
        const now = await turn();
        // Con el teclado, la primera vez: 3 abre Acciones, Esc lo cierra, 1 abre Atacar.
        if (!keysTried) {
            keysTried = true;
            await page.locator('#game-shell .gs-vtt-bar .gs-btn-end').focus();
            await page.keyboard.press('3');
            await page.waitForTimeout(300);
            const three = (await bar()).menu?.id;
            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
            const closed = !(await bar()).menu;
            await page.keyboard.press('1');
            await page.waitForTimeout(300);
            const one = (await bar()).menu?.id;
            check('con el teclado: 3 abre Acciones, Esc lo cierra y 1 abre Atacar', three === 'acciones' && closed && one === 'atacar', JSON.stringify({ three, closed, one }));
            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
            // Intro en un botón de la barra abre su menú; el foco entra en él y Tab no se sale.
            await page.locator('#game-shell .gs-vtt-bar .gs-btn[data-menu="acciones"]').focus();
            await page.keyboard.press('Enter');
            await page.waitForTimeout(300);
            const entered = (await bar()).menu?.id;
            const inMenu = () => page.evaluate(() => Boolean(document.activeElement?.closest('#game-shell .gs-grimoire')));
            const focusIn = await inMenu();
            for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
            const tabIn = await inMenu();
            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
            check('con el teclado: Intro en «Acciones» lo abre, el foco entra en el menú y Tab no se sale de él',
                entered === 'acciones' && focusIn && tabIn && !(await bar()).menu, JSON.stringify({ entered, focusIn, tabIn }));
        }
        // A por el más cercano: andar hasta él si hace falta, con el tablero.
        const near = now.enemies.sort((a, b) => Math.max(Math.abs(a.x - now.x), Math.abs(a.y - now.y)) - Math.max(Math.abs(b.x - now.x), Math.abs(b.y - now.y)))[0];
        if (near && Math.max(Math.abs(near.x - now.x), Math.abs(near.y - now.y)) > 1) {
            await page.evaluate(async (target) => {
                const { handlePlayerCombatMove } = await import('/scripts/party/player-actions.js');
                const { partyMembers } = await import('/scripts/party/state.js');
                const hero = partyMembers[0];
                const hx = Number(hero.mapPosition?.gridX) || 0;
                const hy = Number(hero.mapPosition?.gridY) || 0;
                // La casilla de al lado del enemigo, la más cercana a Nerea.
                const options = [-1, 0, 1].flatMap(dx => [-1, 0, 1].map(dy => ({ x: target.x + dx, y: target.y + dy }))).filter(c => !(c.x === target.x && c.y === target.y))
                    .sort((a, b) => Math.max(Math.abs(a.x - hx), Math.abs(a.y - hy)) - Math.max(Math.abs(b.x - hx), Math.abs(b.y - hy)));
                for (const cell of options) {
                    if (handlePlayerCombatMove(`${cell.x + 1} ${cell.y + 1}`)) return;
                }
            }, near);
            await page.waitForTimeout(500);
            await clearDice();
        }
        await openMenu('atacar');
        const menu = await bar();
        const row = (menu.menu?.cards ?? []).find(c => /^attack:/.test(c.pick) && !c.off);
        if (row) {
            await pickCard(row.pick);
            fought++;
            await clearDice();
            await page.waitForTimeout(500);
            if (fought === 1) await shot('1280.ataque');
            if (!offhandTried && (await turn()).fighting && (await turn()).mine) {
                offhandTried = true;
                await openMenu('adicional');
                const extra = await bar();
                const off = (extra.menu?.cards ?? []).find(c => c.pick === 'offhand');
                check('tras atacar con la espada corta, Adicional ofrece la daga en la otra mano', Boolean(off && !off.off && /daga/i.test(off.name)), JSON.stringify(off));
                if (off && !off.off) {
                    await pickCard('offhand');
                    const step = await bar();
                    const target = (step.menu?.cards ?? []).find(c => /^offhand:/.test(c.pick) && !c.off);
                    if (target) await pickCard(target.pick);
                    await clearDice();
                    await page.waitForTimeout(400);
                    const after = await turn();
                    const nick = off.badges.some(b => /Mellar/.test(b));
                    const logged = await page.evaluate(() => (window.SillyTavern.getContext().chat || []).some((/** @type {any} */ m) => /con la otra mano/.test(String(m.mes || ''))));
                    // Con Mellar (la daga), el golpe de la otra mano no gasta la adicional (2024).
                    check(nick ? 'el golpe con la otra mano, con Mellar, no gasta la acción adicional' : 'el golpe con la otra mano gasta la acción adicional',
                        logged && (!after.fighting || (nick ? after.bonus : !after.bonus)), JSON.stringify({ nick, logged, bonus: after.bonus }));
                    if (after.fighting && after.mine) {
                        await openMenu('adicional');
                        const again = ((await bar()).menu?.cards ?? []).find(c => c.pick === 'offhand');
                        check('y una sola vez por turno', Boolean(again?.off), JSON.stringify(again));
                        await page.keyboard.press('Escape');
                    }
                } else {
                    await page.keyboard.press('Escape');
                }
            }
        } else {
            await page.keyboard.press('Escape');
        }
        if (await fighting() && (await turn()).mine) {
            await page.locator('#game-shell .gs-vtt-bar .gs-btn-end').click({ timeout: 3000 }).catch(() => {});
            await page.locator('.popup-button-ok:visible').first().click({ timeout: 2000 }).catch(() => {});
        }
        await page.waitForTimeout(400);
    }
    check('la pelea se gana atacando desde el menú de Atacar', !(await fighting()) && fought > 0, JSON.stringify({ fought }));

    // 10b. Las maestrías de 2024 en el motor, una a una, contra dos muñecos de prácticas pegados a
    // Nerea. El dado se fija (`setRandomSource`): primero lo que hace falta para acertar, y luego
    // unos para todo (el daño mínimo, la salvación que falla). Cada golpe, por la barra.
    await page.evaluate(async () => {
        const flow = await import('/scripts/party/combat-flow.js');
        flow.startCombat({ id: 'muneco', name: 'Muñeco', maxHp: 300, armorClass: 5, cr: 0, attackRangeFeet: 5, strength: 10, dexterity: 10, constitution: 10, profile: 'guardian' }, 2, 12, 12);
    });
    await until(fighting, 15000);
    await heroTurn();
    /**
     * Un golpe con un arma de una maestría, con el dado fijado, y lo que dejó.
     *
     * @param {{weapon: string, form: string, hands?: number, first: number[], then: number, ac?: number}} spec
     */
    const strike = (spec) => page.evaluate(async (s) => {
        const state = await import('/scripts/party/state.js');
        const rules = await import('/scripts/party/combat-rules.js');
        const bar = await import('/scripts/party/combat-bar.js');
        const { createItem } = await import('/scripts/dnd-system.js');
        const enc = state.combatEncounter;
        const hero = state.partyMembers[0];
        const [a, b] = enc.enemies;
        // Los dos muñecos pegados a Nerea, uno al lado del otro, en pie y sin nada encima.
        const hx = Number(hero.mapPosition?.gridX) || 0;
        const hy = Number(hero.mapPosition?.gridY) || 0;
        Object.assign(a, { gridX: hx + 1, gridY: hy, currentHp: 300, activeConditions: [], armorClass: s.ac ?? 5 });
        Object.assign(b, { gridX: hx + 1, gridY: hy + 1, currentHp: 300, activeConditions: [], armorClass: 5 });
        enc.conditionTimers = [];
        enc.tactics = {};
        enc.maneuvers = { dodging: [], disengaged: [], helped: [], combo: null, hidden: [] };
        // Que sea su turno, con la acción entera.
        const at = enc.turnOrder.findIndex((/** @type {any} */ e) => !e.isEnemy && String(e.id) === String(hero.id));
        enc.currentTurnIndex = at;
        enc.turnState = { actorId: String(hero.id), isEnemy: false, movementSpentFeet: 0, actionUsed: false, bonusActionUsed: false, reactionUsed: false };
        const weapon = createItem({ name: s.weapon, type: 'weapon', category: 'weapon', slot: 'weapon', damageDice: '1d8', damageType: 'cortante', hands: s.hands ?? 1, kitForm: s.form });
        hero.items = [...hero.items.filter((/** @type {any} */ i) => i.name !== s.weapon), weapon];
        hero.equippedItems = { ...hero.equippedItems, weapon: weapon.id, shield: null };
        const queue = [...s.first];
        rules.setRandomSource(() => (queue.length > 0 ? Number(queue.shift()) : s.then));
        const before = { a: { x: a.gridX, y: a.gridY }, hpB: b.currentHp, hpA: a.currentHp };
        bar.runCombatBarPick(`attack:${a.instanceId}`);
        rules.setRandomSource(null);
        return {
            hit: a.currentHp < before.hpA,
            hpA: [before.hpA, a.currentHp],
            hpB: [before.hpB, b.currentHp],
            moved: [before.a, { x: a.gridX, y: a.gridY }],
            conditions: [...(a.activeConditions ?? [])],
            vex: (enc.tactics?.vex ?? []).length,
            log: String(window.SillyTavern.getContext().chat?.slice(-3).map((/** @type {any} */ m) => m.mes).join(' | ') ?? '').slice(-400),
        };
    }, spec);
    const vex = await strike({ weapon: 'Espada corta', form: 'forma-espada-corta', first: [0.9], then: 0.5 });
    check('Molestar (espada corta): al darle, tu siguiente ataque contra él, con ventaja', vex.hit && vex.vex === 1 && /Molestar/.test(vex.log), JSON.stringify(vex));
    const topple = await strike({ weapon: 'Hacha', form: 'forma-hacha', first: [0.9], then: 0 });
    check('Derribar (hacha): falla la salvación de Constitución y cae al suelo', topple.hit && topple.conditions.includes('Prone'), JSON.stringify(topple));
    const sap = await strike({ weapon: 'Maza', form: 'forma-maza', first: [0.9], then: 0.5 });
    check('Debilitar (maza): su siguiente ataque, con desventaja', sap.hit && sap.conditions.includes('Debilitado'), JSON.stringify(sap));
    const slow = await strike({ weapon: 'Porra', form: 'forma-porra', first: [0.9], then: 0.5 });
    check('Ralentizar (porra): 10 pies menos', slow.hit && slow.conditions.includes('Ralentizado'), JSON.stringify(slow));
    const push = await strike({ weapon: 'Martillo de guerra', form: 'forma-martillo', hands: 2, first: [0.9], then: 0.5 });
    // Si detrás hay pared, se queda: lo dice.
    check('Empujar (martillo de guerra): lo aparta hasta 10 pies', push.hit && (push.moved[1].x > push.moved[0].x || /no tiene a dónde ir/.test(push.log)), JSON.stringify(push));
    const graze = await strike({ weapon: 'Espadón', form: 'forma-espadon', hands: 2, first: [0.05], then: 0.5, ac: 30 });
    check('Rozar (espadón): aunque falle, le hace tu modificador (3)', graze.hpA[0] - graze.hpA[1] === 3 && /Rozar/.test(graze.log), JSON.stringify(graze));
    const cleave = await strike({ weapon: 'Hacha a dos manos', form: 'forma-hacha-dos-manos', hands: 2, first: [0.9, 0.5, 0.9], then: 0.5 });
    check('Hender (hacha a dos manos): el tajo sigue hasta el otro muñeco, sin tu modificador', cleave.hit && cleave.hpB[1] < cleave.hpB[0] && /Hender/.test(cleave.log), JSON.stringify(cleave));
    // Agarrar, empujar y Estudiar, por la barra.
    const unarmed = await page.evaluate(async () => {
        const state = await import('/scripts/party/state.js');
        const rules = await import('/scripts/party/combat-rules.js');
        const bar = await import('/scripts/party/combat-bar.js');
        const enc = state.combatEncounter;
        const hero = state.partyMembers[0];
        const [a] = enc.enemies;
        const fresh = () => {
            enc.turnState = { actorId: String(hero.id), isEnemy: false, movementSpentFeet: 0, actionUsed: false, bonusActionUsed: false, reactionUsed: false };
            a.activeConditions = [];
            a.gridX = (Number(hero.mapPosition?.gridX) || 0) + 1;
            a.gridY = Number(hero.mapPosition?.gridY) || 0;
        };
        hero.equippedItems = { ...hero.equippedItems, shield: null };
        // La salvación del muñeco, un 1: falla.
        rules.setRandomSource(() => 0);
        fresh();
        hero.equippedItems.weapon = (hero.items.find((/** @type {any} */ i) => i.name === 'Espada corta') ?? {}).id;
        bar.runCombatBarPick(`unarmed:agarrar:${a.instanceId}`);
        const grabbed = [...a.activeConditions];
        fresh();
        bar.runCombatBarPick(`unarmed:tirar:${a.instanceId}`);
        const prone = [...a.activeConditions];
        fresh();
        const from = a.gridX;
        bar.runCombatBarPick(`unarmed:apartar:${a.instanceId}`);
        const pushed = a.gridX - from;
        fresh();
        rules.setRandomSource(() => 0.95);
        bar.runCombatBarPick(`act:estudiar:${a.instanceId}`);
        rules.setRandomSource(null);
        const said = String(window.SillyTavern.getContext().chat?.slice(-2).map((/** @type {any} */ m) => m.mes).join(' | ') ?? '');
        return { grabbed, prone, pushed, studied: /se fija bien/.test(said) && /💡/.test(said), said: said.slice(-300) };
    });
    check('Agarrar (2024): falla la salvación contra la CD y queda agarrado', unarmed.grabbed.includes('Grappled'), JSON.stringify(unarmed));
    check('Empujar (2024): tirarlo al suelo, o apartarlo 5 pies', unarmed.prone.includes('Prone') && unarmed.pushed === 1, JSON.stringify(unarmed));
    check('Estudiar: con la tirada buena, algo que no se sabía de él', unarmed.studied, unarmed.said);
    // La otra mano (2024): tras atacar con la espada corta (ligera), la daga; con Mellar, gratis.
    const twoHands = await page.evaluate(async () => {
        const state = await import('/scripts/party/state.js');
        const rules = await import('/scripts/party/combat-rules.js');
        const bar = await import('/scripts/party/combat-bar.js');
        const enc = state.combatEncounter;
        const hero = state.partyMembers[0];
        const [a] = enc.enemies;
        enc.tactics = {};
        enc.turnState = { actorId: String(hero.id), isEnemy: false, movementSpentFeet: 0, actionUsed: false, bonusActionUsed: false, reactionUsed: false };
        Object.assign(a, { gridX: (Number(hero.mapPosition?.gridX) || 0) + 1, gridY: Number(hero.mapPosition?.gridY) || 0, currentHp: 300, activeConditions: [], armorClass: 5 });
        hero.equippedItems = { ...hero.equippedItems, weapon: (hero.items.find((/** @type {any} */ i) => i.name === 'Espada corta') ?? {}).id, shield: null };
        const card = () => bar.buildCombatBarView().menu('adicional')?.sections[0].items.find((/** @type {any} */ i) => i.key === 'offhand');
        const before = card();
        rules.setRandomSource(() => 0.9);
        bar.runCombatBarPick(`attack:${a.instanceId}`);
        const ready = card();
        bar.runCombatBarPick(`offhand:${a.instanceId}`);
        rules.setRandomSource(null);
        const said = String(window.SillyTavern.getContext().chat?.slice(-2).map((/** @type {any} */ m) => m.mes).join(' | ') ?? '');
        return {
            before: before?.enabled, ready: ready?.enabled, name: ready?.name, badges: (ready?.badges ?? []).map((/** @type {any} */ b) => b.text),
            bonus: !enc.turnState.bonusActionUsed, again: card()?.enabled, said: said.slice(-300),
            // La tirada de la otra mano lleva el modificador (lo que no lleva es el del daño).
            offMod: (said.split('con la otra mano')[1] ?? '').match(/d20 \d+ ([+-]\d+)/)?.[1] ?? '',
        };
    });
    // Cambiar de arma (2024): gratis, sin gastar la acción, una vez por turno; el menú de Atacar
    // sigue abierto, con el arma nueva.
    const swapped = await page.evaluate(async () => {
        const state = await import('/scripts/party/state.js');
        const bar = await import('/scripts/party/combat-bar.js');
        const enc = state.combatEncounter;
        const hero = state.partyMembers[0];
        enc.tactics = {};
        enc.turnState = { actorId: String(hero.id), isEnemy: false, movementSpentFeet: 0, actionUsed: false, bonusActionUsed: false, reactionUsed: false };
        const dagger = hero.items.find((/** @type {any} */ i) => i.name === 'Daga');
        const after = bar.runCombatBarPick(`swap:${dagger?.id}`);
        const now = hero.items.find((/** @type {any} */ i) => i.id === hero.equippedItems?.weapon)?.name;
        const head = bar.buildCombatBarView().menu('atacar')?.headAction;
        return { keepOpen: after.keepOpen, now, action: !enc.turnState.actionUsed, again: head?.enabled, why: head?.reason };
    });
    check('cambiar de arma: gratis (la acción sigue), el menú de Atacar sigue abierto, y una vez por turno',
        swapped.now === 'Daga' && swapped.action && swapped.keepOpen === 'atacar' && swapped.again === false && /Ya has cambiado/.test(String(swapped.why)), JSON.stringify(swapped));
    check('la otra mano (2024): apagada hasta atacar con la espada corta; luego la daga (su tirada, con tu modificador), y con Mellar no gasta la adicional, una vez por turno',
        twoHands.before === false && twoHands.ready === true && /daga/i.test(String(twoHands.name)) && twoHands.badges.includes('Gratis (Mellar)')
        && twoHands.bonus && twoHands.again === false && /otra mano/.test(twoHands.said) && twoHands.offMod === '+3', JSON.stringify(twoHands));

    // 10c. J19.3: lanzar a más nivel, por la barra. Nerea, maga de nivel 3 un momento (espacios
    // de 1.º y de 2.º): en Magia, Proyectil mágico deja elegir el espacio; con el de 2.º, un dardo más.
    await page.evaluate(async () => {
        const state = await import('/scripts/party/state.js');
        const enc = state.combatEncounter;
        const hero = /** @type {any} */ (state.partyMembers[0]);
        hero.class = 'Mago';
        hero.level = 3;
        hero.slotsUsed = {};
        for (const key of ['spellbook', 'prepared']) {
            const list = Array.isArray(hero[key]) ? hero[key] : [];
            if (!list.includes('conj-proyectil-magico')) hero[key] = [...list, 'conj-proyectil-magico'];
        }
        const [a] = enc.enemies;
        Object.assign(a, { currentHp: 300, activeConditions: [] });
        const at = enc.turnOrder.findIndex((/** @type {any} */ e) => !e.isEnemy && String(e.id) === String(hero.id));
        enc.currentTurnIndex = at;
        enc.turnState = { actorId: String(hero.id), isEnemy: false, movementSpentFeet: 0, actionUsed: false, bonusActionUsed: false, reactionUsed: false };
        (await import('/scripts/party/board-view.js')).renderLocationMapsPreview();
    });
    await page.waitForTimeout(600);
    await openMenu('magia');
    const levelPills = await page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-grimoire .gs-level-pill[data-spell="conj-proyectil-magico"]')]
        .map(b => `${(b.textContent || '').trim()}:${b.classList.contains('active') ? 'elegido' : ''}`));
    await page.locator('#game-shell .gs-grimoire .gs-level-pill[data-spell="conj-proyectil-magico"][data-slot-level="2"]').click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(300);
    const upcast = ((await bar()).menu?.cards ?? []).find(c => /conj-proyectil-magico/.test(c.pick));
    await shot('1280.nivel');
    check('J19.3: Proyectil mágico deja elegir el espacio, y con el de nivel 2 son cuatro dardos',
        levelPills.length >= 2 && levelPills[0] === 'Nivel 1:elegido' && upcast?.pick === 'cast:2:conj-proyectil-magico'
        && upcast.badges.some(b => /^4 × 1d4\+1/.test(b)) && upcast.badges.includes('Espacio de nivel 2'), JSON.stringify({ levelPills, upcast }));
    if (upcast) await pickCard(upcast.pick);
    const castTarget = ((await bar()).menu?.cards ?? []).find(c => c.pick.startsWith('cast:2:conj-proyectil-magico:') && !c.off);
    const hpBefore = await page.evaluate(async () => Number((await import('/scripts/party/state.js')).combatEncounter.enemies[0].currentHp));
    if (castTarget) await pickCard(castTarget.pick);
    await clearDice();
    await page.waitForTimeout(400);
    const cast = await page.evaluate(async () => {
        const state = await import('/scripts/party/state.js');
        const hero = /** @type {any} */ (state.partyMembers[0]);
        const said = String(window.SillyTavern.getContext().chat?.slice(-3).map((/** @type {any} */ m) => m.mes).join(' | ') ?? '');
        return { used: { ...(hero.slotsUsed ?? {}) }, hp: Number(state.combatEncounter.enemies[0].currentHp), action: !state.combatEncounter.turnState?.actionUsed, said: said.slice(-400) };
    });
    check('lanzado con el espacio de nivel 2: gasta ese, no uno de nivel 1, y los cuatro dardos le dan',
        Number(cast.used[2]) === 1 && !Number(cast.used[1]) && /espacio de 2\.º/.test(cast.said) && (hpBefore - cast.hp) >= 8 && !cast.action,
        JSON.stringify({ ...cast, hpBefore }));
    await page.evaluate(async () => {
        const { partyMembers } = await import('/scripts/party/state.js');
        Object.assign(partyMembers[0], { class: 'Guerrero', level: 1 });
    });
    await page.evaluate(async () => (await import('/scripts/party/combat-flow.js')).endCombat('ended'));
    await page.waitForTimeout(800);
    await clearDice();
    await dropToasts();

    // 11. Otra pelea, para mirar la barra en 1920 × 1080 y en el teléfono.
    await page.evaluate(async () => {
        const flow = await import('/scripts/party/combat-flow.js');
        flow.startCombat({ id: 'rata-gigante', name: 'Rata gigante', maxHp: 30, armorClass: 12, cr: 0.25, attackRangeFeet: 5, strength: 10, dexterity: 12, constitution: 10, profile: 'aggressive' }, 2, 12, 12);
    });
    await until(fighting, 15000);
    await heroTurn();
    for (const [name, size] of /** @type {Array<[string, {width: number, height: number}]>} */ ([['1920', { width: 1920, height: 1080 }], ['390', { width: 390, height: 844 }], ['844x390', { width: 844, height: 390 }]])) {
        await page.setViewportSize(size);
        await page.waitForTimeout(800);
        await clearDice();
        await dropToasts();
        const look = await bar();
        await shot(name);
        check(`${name}: la barra cabe, sin salirse por los lados`, look.shown && (look.box?.left ?? -1) >= 0 && (look.box?.right ?? 9999) <= look.vw + 1 && (look.box?.bottom ?? 9999) <= look.vh + 1 && !look.pageWide, JSON.stringify({ box: look.box, vw: look.vw, vh: look.vh }));
        await openMenu('atacar');
        const withMenu = await bar();
        await shot(`${name}.atacar`);
        check(`${name}: el menú de Atacar cabe y no se corta por arriba`, Boolean(withMenu.menu) && (withMenu.menu?.top ?? -1) >= withMenu.headBottom - 1 && (withMenu.menu?.left ?? -1) >= 0 && (withMenu.menu?.right ?? 9999) <= withMenu.vw + 1,
            JSON.stringify({ menu: withMenu.menu && { top: withMenu.menu.top, left: withMenu.menu.left, right: withMenu.menu.right, height: withMenu.menu.height }, head: withMenu.headBottom }));
        await page.keyboard.press('Escape');
    }
    await page.setViewportSize({ width: 1280, height: 720 });

    check('no se ha pedido nada a internet', outside.length === 0, outside.slice(0, 5).join(' | '));
    check('sin errores en la página', problems.length === 0, problems.slice(0, 6).join(' | '));
} catch (error) {
    failures++;
    console.log(`FAIL  la vuelta se ha roto: ${error?.stack || error}`);
    if (page && SHOT) await page.screenshot({ path: `${SHOT.replace(/\.png$/i, '')}.error.png` }).catch(() => {});
} finally {
    await browser?.close().catch(() => {});
    server?.kill();
    try {
        rmSync(dataRoot, { recursive: true, force: true });
    } catch { /* nada */ }
    console.log(failures === 0 ? '\nTodo bien.' : `\n${failures} fallo(s).`);
    process.exit(failures === 0 ? 0 : 1);
}
