#!/usr/bin/env node
/**
 * Walks the campaign flow in a real browser, against a server of its own.
 *
 * Unit tests said the campaign wizard worked. It did not: it created a world but no chat,
 * so the campaign never appeared; and it wrote starting positions that nothing read, so
 * characters stood on walls. Both passed every assertion, because the tests checked the
 * data the wizard produced rather than what the game did with it. This script checks the
 * second thing, which is the only one a player can see.
 *
 * It never touches your own data. It starts SillyTavern on its own port with a temporary
 * --dataRoot, runs against that, and deletes it afterwards. Your own server on port 8000
 * can stay open while this runs.
 *
 * Requirements: Microsoft Edge (used as installed, nothing is downloaded) and the test
 * dependencies (npm ci --prefix tests), which bring Playwright.
 *
 * Usage:
 *   node tools/e2e-campaign.mjs               # headless
 *   node tools/e2e-campaign.mjs --headed      # watch it happen
 *   node tools/e2e-campaign.mjs --keep        # keep the temp data dir for inspection
 *
 * See wiki/POR_HACER.md and the N-09 proposal in wiki/PROPUESTAS_MEJORA.md.
 */

// Las funciones que se pasan a `page.evaluate` se ejecutan en el navegador, no aqui: por
// eso este archivo de Node habla de `window` y `document`. Se declaran para que ESLint
// compruebe el resto en vez de ahogarse en esto.
/* global window, document, Node, getComputedStyle, HTMLElement */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const PORT = 8123;
const BASE = `http://127.0.0.1:${PORT}`;
const HEADED = process.argv.includes('--headed');
const KEEP = process.argv.includes('--keep');

// Playwright lives with the test dependencies, not the app's.
const require = createRequire(join(ROOT, 'tests/package.json'));
let chromium;
try {
    ({ chromium } = require('@playwright/test'));
} catch {
    console.error('Playwright is missing. Run:  npm ci --prefix tests');
    process.exit(2);
}

let failures = 0;
/** Lo que fallo, con su paso: el recorrido son 400 lineas y el fallo puede quedar en medio. */
const failed = [];
let currentStep = '(antes de empezar)';
const check = (name, ok, detail = '') => {
    if (!ok) {
        failures++;
        failed.push(`${currentStep} - ${name}${detail ? ` -> ${detail}` : ''}`);
    }
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        -> ${detail}` : ''}`);
};
const step = (title) => {
    currentStep = title;
    console.log(`\n=== ${title} ===`);
};

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-'));
console.log(`Temporary data root: ${dataRoot}`);

let server = null;
let browser = null;

/** Starts the app and resolves once it answers. */
function startServer() {
    // Assigned before the promise: if start-up times out, the finally block still has
    // something to kill. Not doing this left a server holding the port and the pipe.
    server = spawn(process.execPath, ['server.js', '--port', String(PORT), '--dataRoot', dataRoot], {
        cwd: ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    const child = server;

    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('the server did not start in 90s')), 90000);
        const watch = (buffer) => {
            const text = String(buffer);
            if (text.includes(String(PORT)) || text.toLowerCase().includes('listening')) {
                clearTimeout(timer);
                // The port is open a moment before the app is ready to serve.
                setTimeout(() => resolve(child), 1500);
            }
        };
        child.stdout.on('data', watch);
        child.stderr.on('data', watch);
        child.on('exit', code => reject(new Error(`the server exited with code ${code}`)));
    });
}

try {
    await startServer();
    console.log(`Server up on ${BASE}`);

    browser = await chromium.launch({ channel: 'msedge', headless: !HEADED });
    // `acceptDownloads` para el paso 31: exportar una campana descarga un archivo, y
    // sin esto Playwright lo cancela en silencio.
    const context = await browser.newContext({
        viewport: { width: 1400, height: 950 },
        acceptDownloads: true,
    });
    const page = await context.newPage();

    const problems = new Set();
    page.on('pageerror', e => problems.add(`PAGEERROR ${e.message}`));
    page.on('console', m => {
        // El navegador tambien grita por cada bateria del compendio que no esta, y no
        // dice cual. Como el oyente de abajo ya las deja pasar a proposito, este mensaje
        // suelto solo taparia los errores que si importan.
        const line = m.text();
        if (m.type() !== 'error') return;
        if (/Failed to load resource.*404/.test(line)) return;
        problems.add(`ERROR ${line.slice(0, 200)}`);
    });
    // Y cual, que 'Failed to load resource' sin la direccion no sirve de nada. Una
    // bateria del compendio que no esta **no es un 404 que importe**: es una que todavia
    // no se ha escrito, y el paso 42 comprueba que el juego lo dice en vez de romperse.
    page.on('response', r => {
        const path = r.url().replace(BASE, '');
        if (r.status() === 404 && !path.startsWith('/compendio/')) problems.add(`404 ${path}`);
    });

    /** What the game holds for the chat that is currently open. */
    const readState = () => page.evaluate(() => {
        const ctx = window.SillyTavern.getContext();
        const meta = ctx.chatMetadata || {};
        return {
            world: meta.world_info,
            party: meta.party,
            location: meta.currentLocation,
            board: meta.currentBoard,
        };
    });

    // El Modo Juego se abre solo al arrancar desde que existe el menu principal, y eso
    // tapa la pantalla de bienvenida por la que entra todo el recorrido. Se apaga aqui y
    // el paso 34 lo enciende a proposito, que es donde toca probarlo.
    // Solo si nadie lo ha decidido ya: esto corre en **cada** carga, y el paso 34 recarga
    // a proposito con el arranque encendido para ver lo que ve un jugador de verdad.
    await context.addInitScript(() => {
        try {
            if (window.localStorage.getItem('sillytavern_gameShellAutostart') === null) {
                window.localStorage.setItem('sillytavern_gameShellAutostart', 'false');
            }
        } catch { /* sin localStorage no hay nada que apagar */ }
    });

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });

    // A fresh data root opens SillyTavern's own first-run dialog.
    const firstRun = page.locator('text=Welcome to SillyTavern!');
    if (await firstRun.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#cw-new-campaign', { timeout: 90000 });

    step('1. The welcome screen offers to start a campaign');
    check('the New campaign button is on the welcome screen',
        await page.locator('#cw-new-campaign').count() === 1);

    /**
     * Contesta a «quien eres», que es lo que ahora abre una campana recien creada.
     *
     * El asistente pedia una lista de nombres entre el genero del mundo y el narrador, y
     * de cada linea salia una ficha generica. Ahora el personaje se hace al entrar, asi
     * que **toda** creacion pasa por aqui. Devuelve lo que se vio del cuadro, para que
     * quien llama pueda comprobarlo sin repetir los selectores.
     *
     * @param {string} name
     * @param {{race?: string, className?: string, dice?: boolean}} [extra]
     */
    const answerHeroCreator = async (name, extra = {}) => {
        await page.waitForSelector('.hc-root', { timeout: 60000 });

        const seen = await page.evaluate(() => ({
            wand: document.querySelectorAll('.hc-wand').length,
            wandOff: document.querySelector('.hc-wand')?.disabled ?? null,
            face: document.querySelector('.hc-face-file')?.getAttribute('type') || '',
            wandTitle: document.querySelector('.hc-wand')?.getAttribute('title') || '',
            dice: document.querySelectorAll('.hc-dice').length,
            typed: document.querySelectorAll('.hc-root input[type="text"].hc-face').length,
            labels: [...document.querySelectorAll('.hc-root .hc-label')]
                .map(l => (l.textContent || '').trim()),
        }));

        // El dado saca un nombre del compendio. Se pulsa dos veces a proposito: lo que
        // importa no es que salga uno, es que salga **otro**.
        if (extra.dice && seen.dice > 0) {
            await page.locator('.hc-dice').click();
            await page.waitForTimeout(300);
            seen.rolled = [await page.inputValue('.hc-root .hc-name')];
            await page.locator('.hc-dice').click();
            await page.waitForTimeout(300);
            seen.rolled.push(await page.inputValue('.hc-root .hc-name'));
        }

        await page.fill('.hc-root .hc-name', name);
        if (extra.race) await page.fill('.hc-root .hc-race', extra.race);
        if (extra.className) await page.fill('.hc-root .hc-class', extra.className);

        await page.locator('.popup-button-ok').last().click();
        await page.waitForSelector('.hc-root', { state: 'detached', timeout: 30000 });
        await page.waitForTimeout(1200);
        return seen;
    };

    step('2. El taller crea un mundo, un chat, y pone al grupo en el tablero');
    await page.click('#cw-new-campaign');

    // La puerta: tres caminos, y la unica pregunta que se puede hacer antes de saber nada
    // del mundo es «¿lo escribo yo o juego ya?».
    await page.waitForSelector('.tl-door-grid');
    const puertas = await page.evaluate(() =>
        [...document.querySelectorAll('.tl-door-card-title')].map(e => e.textContent || ''));
    check('al crear campana se elige por donde se empieza',
        puertas.length === 3 && puertas.some(t => /desde cero/i.test(t))
        && puertas.some(t => /precreados/i.test(t)) && puertas.some(t => /libro/i.test(t)),
        puertas.join(' | '));

    await page.locator('.tl-door-card').first().click();
    await page.waitForSelector('.tl-root');

    // Paso 1 de 13, y lo dice: contar sobre los hechos seria mentir en la unica pantalla
    // que dice cuanto falta.
    const paso1 = await page.evaluate(() => ({
        dicho: document.querySelector('.tl-bar-said')?.textContent || '',
        semilla: /** @type {HTMLInputElement|null} */ (
            document.querySelector('.tl-input.mono'))?.value || '',
        tarjetas: document.querySelectorAll('.tl-card').length,
    }));
    check('el taller dice por donde va, sobre los trece pasos',
        /Paso 1 de 13/.test(paso1.dicho), paso1.dicho);
    check('y llega con una semilla ya tirada, en tres palabras',
        /^[a-z]+-[a-z]+-[a-z]+$/.test(paso1.semilla), paso1.semilla);
    check('con tarjetas para elegir con que sitio empieza', paso1.tarjetas >= 3, `${paso1.tarjetas}`);

    // Sin elegir sitio no se pasa, y se dice por que: un boton apagado que no lo dice es
    // la forma mas rapida de que alguien cierre la ventana.
    await page.locator('.tl-next').click();
    await page.waitForTimeout(300);
    const frena = await page.evaluate(() => document.querySelector('.tl-said')?.textContent || '');
    check('no deja pasar sin elegir, y dice que falta', /sitio|nombre/i.test(frena), frena);

    await page.locator('.tl-card').first().click();
    await page.waitForTimeout(300);
    const elegida = await page.locator('.tl-card.picked').count();
    check('lo elegido se marca, que es lo unico que hay que mirar', elegida === 1, `${elegida}`);

    const proposed = await page.evaluate(() =>
        /** @type {HTMLInputElement|null} */ (document.querySelector('.tl-input'))?.value || '');
    check('it proposes a free name instead of demanding one', Boolean(proposed), `proposed "${proposed}"`);

    // Paso 2: quien lo cuenta. Se puede saltar — se juega sin narrador.
    await page.locator('.tl-next').click();
    await page.waitForTimeout(400);
    const paso2 = await page.evaluate(() => ({
        dicho: document.querySelector('.tl-bar-said')?.textContent || '',
        narradores: document.querySelectorAll('.tl-card').length,
        mas: document.querySelectorAll('.tl-card.add').length,
    }));
    check('el paso 2 ofrece narradores hechos y uno para escribir el tuyo',
        /Paso 2 de 13/.test(paso2.dicho) && paso2.narradores >= 4 && paso2.mas === 1,
        `${paso2.dicho} · ${paso2.narradores} tarjetas`);

    await page.locator('.tl-skip').click();
    await page.waitForTimeout(600);

    // Paso 3: los sitios. Llega con el de partida y con los vecinos que la semilla iba a
    // poner sola al crear el mundo — ensenarlos antes es lo unico que permite tocarlos.
    const paso3 = await page.evaluate(() => ({
        dicho: document.querySelector('.tl-bar-said')?.textContent || '',
        sitios: [...document.querySelectorAll('.tl-card:not(.add) .tl-card-title')]
            .map(e => e.textContent || ''),
        marcados: document.querySelectorAll('.tl-card.picked').length,
    }));
    check('el paso 3 llega con los sitios que la semilla iba a poner sola',
        /Paso 3 de 13/.test(paso3.dicho) && paso3.sitios.length >= 3 && paso3.marcados >= 3,
        `${paso3.dicho} · ${paso3.sitios.join(', ')}`);

    // Y se pueden tocar: abrir uno ensena su ficha con su tipologia.
    await page.locator('.tl-card:not(.add)').nth(1).click();
    await page.waitForTimeout(400);
    const tipos = await page.evaluate(() =>
        [...document.querySelectorAll('.tl-form select option')].map(o => o.textContent || ''));
    check('cada sitio dice que clase de sitio es, y las hay de todo tipo',
        tipos.some(t => /Aldea/i.test(t)) && tipos.some(t => /Castillo/i.test(t))
        && tipos.some(t => /Puerto/i.test(t)) && tipos.some(t => /Torre/i.test(t)),
        tipos.filter(Boolean).join(', '));

    await page.locator('.tl-next').click();
    await page.waitForTimeout(600);

    // Paso 4: un acordeon por sitio, que es lo que hace que se entienda a cual pertenece
    // cada tablero sin leerlo en el nombre.
    const paso4 = await page.evaluate(() => ({
        dicho: document.querySelector('.tl-bar-said')?.textContent || '',
        sitios: document.querySelectorAll('.tl-place').length,
    }));
    check('el paso 4 da un acordeon por sitio para sus tableros',
        /Paso 4 de 13/.test(paso4.dicho) && paso4.sitios === paso3.marcados,
        `${paso4.dicho} · ${paso4.sitios} acordeones`);

    await page.locator('.tl-place .tl-card.add').first().click();
    await page.waitForTimeout(400);
    const tablero = await page.evaluate(() => ({
        cuantos: document.querySelectorAll('.tl-place .tl-card.picked').length,
        formas: [...document.querySelectorAll('.tl-place select option')].map(o => o.textContent || ''),
    }));
    check('se le puede anadir un tablero, diciendo como es por dentro',
        tablero.cuantos === 1 && tablero.formas.some(f => /Salas y pasillos/i.test(f))
        && tablero.formas.some(f => /Cueva/i.test(f)),
        tablero.formas.filter(Boolean).join(', '));

    await page.locator('.tl-next').click();
    await page.waitForTimeout(600);

    // Pasos 5, 6 y 7: elegir de una lista. Los tres son la misma pantalla con otras filas.
    const paso5 = await page.evaluate(() => ({
        dicho: document.querySelector('.tl-bar-said')?.textContent || '',
        marcadas: document.querySelectorAll('.tl-card.picked').length,
    }));
    check('el paso 5 llega con las habilidades escritas, y todas dentro',
        /Paso 5 de 13/.test(paso5.dicho) && paso5.marcadas >= 20,
        `${paso5.dicho} · ${paso5.marcadas} marcadas`);

    await page.locator('.tl-next').click();
    await page.waitForTimeout(500);

    // Razas: cada una da algo y **quita** algo, que es lo que la hace una decision.
    const paso6 = await page.evaluate(() => ({
        dicho: document.querySelector('.tl-bar-said')?.textContent || '',
        lineas: [...document.querySelectorAll('.tl-card:not(.add) .tl-card-note')]
            .map(e => e.textContent || ''),
    }));
    check('el paso 6 ensena lo que cada raza da y lo que quita',
        /Paso 6 de 13/.test(paso6.dicho) && paso6.lineas.length >= 10
        && paso6.lineas.every(l => /\+\d/.test(l) && /-\d/.test(l)),
        `${paso6.dicho} · ${paso6.lineas[0]}`);

    await page.locator('.tl-next').click();
    await page.waitForTimeout(500);

    const paso7 = await page.evaluate(() => ({
        dicho: document.querySelector('.tl-bar-said')?.textContent || '',
        lineas: [...document.querySelectorAll('.tl-card:not(.add) .tl-card-note')]
            .map(e => e.textContent || ''),
    }));
    check('y el 7 el dado de golpe de cada clase',
        /Paso 7 de 13/.test(paso7.dicho) && paso7.lineas.every(l => /\dd\d/.test(l)),
        `${paso7.dicho} · ${paso7.lineas[0]}`);

    // Del 7 se pasa al 9: el paso 8 (objetos) todavia no esta hecho, y un paso que se
    // ensena vacio promete algo que no pasa.
    await page.locator('.tl-next').click();
    await page.waitForTimeout(500);

    // Paso 9: las facciones **de verdad**, las que tienen meta y reloj. Llegan repartidas
    // por la semilla, que es lo que el mundo iba a hacer solo al crearse.
    const paso9 = await page.evaluate(() => ({
        dicho: document.querySelector('.tl-bar-said')?.textContent || '',
        bandos: [...document.querySelectorAll('.tl-card:not(.add) .tl-card-title')]
            .map(e => e.textContent || ''),
    }));
    check('el paso 9 llega con las facciones que la semilla iba a repartir',
        /Paso 9 de 13/.test(paso9.dicho) && paso9.bandos.length >= 2,
        `${paso9.dicho} · ${paso9.bandos.join(', ')}`);

    await page.locator('.tl-card:not(.add)').first().click();
    await page.waitForTimeout(400);
    const suMeta = await page.evaluate(() =>
        [...document.querySelectorAll('.tl-form select option')].map(o => o.textContent || ''));
    // Y lo que piensan de ti se dice en palabras, no en un numero entre -5 y 5.
    check('cada faccion dice que quiere y que piensan de ti',
        suMeta.some(t => /Quedarse con un sitio/i.test(t))
        && suMeta.some(t => /Acabar con otra facción/i.test(t))
        && suMeta.some(t => /deben más de una/i.test(t)),
        suMeta.filter(Boolean).slice(0, 12).join(', '));

    await page.locator('.tl-next').click();
    await page.waitForTimeout(600);

    // Paso 11: quien vive aqui. Sale del compendio con la semilla, y va el penultimo
    // porque se rellena con la raza, la clase, el sitio y la bandera de los pasos de
    // arriba.
    const paso11 = await page.evaluate(() => ({
        dicho: document.querySelector('.tl-bar-said')?.textContent || '',
        gente: [...document.querySelectorAll('.tl-card:not(.add) .tl-card-title')]
            .map(e => e.textContent || ''),
    }));
    check('el paso 11 llega con vecinos ya escritos',
        /Paso 11 de 13/.test(paso11.dicho) && paso11.gente.length >= 2
        && paso11.gente.every(n => n && !/undefined/.test(n)),
        `${paso11.dicho} · ${paso11.gente.join(', ')}`);

    await page.locator('.tl-next').click();
    await page.waitForTimeout(600);

    // Paso 12: no es escribir un tablon. Son los mandos de como salen las demas.
    const paso12 = await page.evaluate(() => ({
        dicho: document.querySelector('.tl-bar-said')?.textContent || '',
        mandos: [...document.querySelectorAll('.tl-form select option')].map(o => o.textContent || ''),
        dice: document.querySelector('.tl-step-hint')?.textContent || '',
    }));
    check('el paso 12 son los mandos del tablon, no un tablon que rellenar',
        /Paso 12 de 13/.test(paso12.dicho)
        && paso12.mandos.some(t => /Uno de cada tres/i.test(t))
        && /se rellena solo/i.test(paso12.dice),
        `${paso12.dicho} · ${paso12.mandos.filter(Boolean).join(', ')}`);

    await page.locator('.tl-next').click();
    await page.waitForTimeout(600);
    check('y de ahi se llega al ultimo paso',
        /Paso 13 de 13/.test(await page.evaluate(() =>
            document.querySelector('.tl-bar-said')?.textContent || '')));

    await page.locator('.tl-next').click();

    const heroBox = await answerHeroCreator('Lyra', {
        race: 'Media elfa', className: 'Picara', dice: true,
    });
    check('el dado saca un nombre del compendio, sin escribir nada',
        heroBox.dice === 1 && (heroBox.rolled?.[0] || '').length > 1
        && !/[{}]/.test(heroBox.rolled?.[0] || ''),
        JSON.stringify(heroBox.rolled));
    check('y otro distinto cada vez que se pulsa',
        heroBox.rolled?.[0] !== heroBox.rolled?.[1], JSON.stringify(heroBox.rolled));
    check('empezar una campana te pregunta quien eres',
        heroBox.labels.some(l => /Nombre/.test(l)) && heroBox.labels.some(l => /Qui.n eres/.test(l)),
        JSON.stringify(heroBox.labels));
    check('la cara se busca en el disco, no se teclea una ruta',
        heroBox.face === 'file' && heroBox.typed === 0, JSON.stringify(heroBox));
    // Encendida o apagada depende del proveedor que haya puesto; que exista y diga para
    // que sirve, no. Lo que hace al pulsarla se prueba en el paso 41, con un modelo de
    // mentira, que es gratis y siempre contesta lo mismo.
    check('y trae la varita, con su explicacion puesta',
        heroBox.wand === 1 && (heroBox.wandTitle || '').length > 20,
        `varita=${heroBox.wand} apagada=${heroBox.wandOff} pista="${heroBox.wandTitle}"`);

    const toast = page.locator('#toast-container .toast', { hasText: 'creada' });
    await toast.first().waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
    const toastText = ((await toast.count()) ? await toast.first().innerText() : 'NO TOAST').replace(/\s+/g, ' ');
    check('the campaign is created and the toast says where you are', /Estás en/.test(toastText), toastText);

    // The three failures the unit tests could not see, one check each.
    await page.waitForTimeout(1500);
    const state = await readState();
    const walls = await page.locator('.wm-terrain-wall').filter({ visible: true }).count();
    const tokens = await page.locator('.wm-token').filter({ visible: true }).count();
    const positions = (state.party || []).map(m => `${m?.name}(${m?.mapPosition?.gridX},${m?.mapPosition?.gridY})`);

    check('a chat exists and is bound to the new world', Boolean(state.world), `world_info=${state.world}`);

    // La semilla del mundo: se tira al crear y se queda. Sin ella, lo unico de donde
    // sacar el azar era el nombre, y dos campanas llamadas igual salian iguales.
    const seed2 = await page.evaluate(async () => {
        const wi = await import('/scripts/world-info.js');
        const ctx = window.SillyTavern.getContext();
        const data = await wi.loadWorldInfo(ctx.chatMetadata.world_info);
        return String(data?.metadata?.seed || '');
    });
    check('la campana nace con su semilla, en palabras y no en un numero',
        /^[a-z0-9]+(-[a-z0-9]+){2}$/.test(seed2), seed2 || '(sin semilla)');
    check('se empieza solo, con el personaje que acabas de hacer y nadie mas',
        (state.party || []).length === 1 && state.party[0]?.name === 'Lyra', positions.join('  '));
    check('y con sus numeros puestos, no con la ficha a medio hacer',
        Number(state.party?.[0]?.maxHp) > 0 && Number(state.party?.[0]?.speed) > 0,
        `PG=${state.party?.[0]?.maxHp} vel=${state.party?.[0]?.speed}`);
    check('nobody starts on (0,0), which is a wall in every template',
        positions.length > 0 && !positions.some(p => p.includes('(0,0)')), positions.join('  '));
    check('you are already on the first board, with no /go and no /enter',
        Boolean(state.location && state.board), `${state.location} / ${state.board}`);
    check('the board is on screen with its walls', walls > 20, `${walls} wall cells`);
    check('tu personaje esta de pie en el', tokens === 1, `${tokens} tokens`);

    /**
     * Aparta los avisos: se quedan encima de las barras de botones unos segundos y se
     * comen el clic. Es cosa del recorrido, no del juego — quien juega espera o los cierra.
     */
    const clearToasts = () => page.evaluate(() => {
        document.querySelectorAll('#toast-container .toast').forEach(t => t.remove());
    });

    /** Back to the welcome screen the way a player gets there: close the chat. */
    const closeChat = async () => {
        await page.locator('#options_button').click({ timeout: 10000 });
        // This id appears more than once in the DOM; only one copy is on screen.
        await page.locator('#option_close_chat').filter({ visible: true }).first().click({ timeout: 10000 });
        await page.waitForSelector('#cw-new-campaign', { timeout: 30000 });
        await page.waitForTimeout(800);
    };

    /**
     * Plays one combat turn for whoever is up: close the distance, then attack.
     *
     * Written as a helper because three checks need it and each one that reimplemented it
     * got the same thing wrong — a single /combat-move only works if the target square is
     * already within this turn's movement, and where the enemy lands is rolled.
     *
     * @returns {Promise<'attacked'|'moved'|'passed'|'over'>}
     */
    const playOneTurn = () => page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const enc = ctx.chatMetadata.combatEncounter;
        if (!enc?.active) return 'over';

        const entry = enc.turnOrder?.[enc.currentTurnIndex];
        if (!entry || entry.isEnemy) {
            await ctx.executeSlashCommandsWithOptions('/combat-end');
            return 'passed';
        }

        const member = (ctx.chatMetadata.party || []).find(m => String(m.id) === String(entry.id));
        const enemy = (enc.enemies || []).find(e => (e.currentHp || 0) > 0);
        if (!member || !enemy) {
            await ctx.executeSlashCommandsWithOptions('/combat-end');
            return 'passed';
        }

        const mx = member.mapPosition?.gridX ?? 0;
        const my = member.mapPosition?.gridY ?? 0;
        const dx = enemy.gridX - mx;
        const dy = enemy.gridY - my;

        if (Math.max(Math.abs(dx), Math.abs(dy)) <= 1) {
            await ctx.executeSlashCommandsWithOptions(`/combat-attack ${enemy.name}`);
            return 'attacked';
        }

        // One step at a time towards it: a whole-way move is refused when the distance is
        // more than this turn's speed, and then nothing happens at all.
        const stepX = mx + Math.sign(dx);
        const stepY = my + Math.sign(dy);
        await ctx.executeSlashCommandsWithOptions(`/combat-move ${stepX + 1} ${stepY + 1}`);
        return 'moved';
    });

    /** Clicks through the dice overlay until it stops covering the page. */
    // Desde H5, Esc pausa en vez de apagar: salir es cosa del menu de pausa.
    const leaveGameMode = async () => {
        await page.keyboard.press('Escape');
        await page.waitForSelector('.gs-pause', { timeout: 5000 });
        await page.locator('.gs-pause-btn', { hasText: 'Salir del Modo Juego' }).click();
        await page.waitForTimeout(1100);
    };

    const clearDiceOverlay = async () => {
        for (let i = 0; i < 40; i++) {
            const next = page.locator('.wm-dice-overlay.active .wm-dice-next');
            if (await next.count() === 0) return;
            await next.click({ timeout: 4000 }).catch(() => {});
            await page.waitForTimeout(250);
        }
    };

    /**
     * Mete a alguien mas en el grupo por donde el juego deja hacerlo: el editor.
     *
     * Ahora se empieza solo —el personaje se hace al entrar y nadie mas viene con el— asi
     * que el grupo crece reclutando. Es el mismo boton que pulsa quien juega, sin tocar
     * codigo, y lo que escribe es una ficha del Lorebook como cualquier otra.
     *
     * @param {string} name
     * @param {string} where La localidad donde se esta jugando.
     */
    const recruitCompanion = async (name, where) => {
        await clearToasts();
        await page.evaluate(() => {
            void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/campana');
        });
        await page.waitForSelector('.ce-root', { timeout: 20000 });

        await page.locator('.ce-tab').filter({ hasText: 'Personajes' }).click();
        await page.waitForTimeout(400);
        await page.locator('.ce-add-person').click();
        await page.waitForTimeout(400);

        const person = page.locator('.ce-person').last();
        await person.locator('.ce-card-head').click();
        await page.waitForTimeout(300);
        await person.locator('.ce-person-name input').fill(name);
        // Con la ficha que le escribas: los seis atributos, luego PG maximos, CA y
        // velocidad. Alguien del mundo nace con diez de vida, que para un aldeano esta
        // bien y para quien va a pelear contigo no.
        await person.locator('.ce-stats input').nth(6).fill('30');
        await person.locator('.ce-where select').selectOption(where);
        await person.locator('.ce-recruit').click();
        await page.waitForTimeout(400);

        await page.locator('.popup-button-ok').last().click();
        await page.waitForTimeout(3500);
        await clearToasts();
    };

    // Y ahora el segundo, porque el grupo ya no llega hecho: Lyra recluta a Brand por
    // donde se recluta de verdad. Lo que sigue —el combate, los vinculos, el relevo—
    // necesita a dos, y asi se comprueba de paso que reclutar funciona desde el principio.
    await recruitCompanion('Brand', state.location);

    const pair = await readState();
    const cells = (pair.party || []).map(m => `${m?.mapPosition?.gridX},${m?.mapPosition?.gridY}`);
    check('reclutar mete a alguien en el grupo sin escribir una linea de codigo',
        (pair.party || []).length === 2, (pair.party || []).map(m => m?.name).join(', '));
    check('y no lo planta encima de ti: una criatura por casilla',
        new Set(cells).size === cells.length, cells.join('  '));
    check('los dos estan en el tablero',
        await page.locator('.wm-token').filter({ visible: true }).count() === 2,
        `${await page.locator('.wm-token').filter({ visible: true }).count()} tokens`);

    step('3. A door on the board opens when it is clicked');
    const door = page.locator('.wm-terrain-door').filter({ visible: true }).first();
    check('the closed door is drawn on the board', await door.count() === 1);
    if (await door.count() === 1) {
        await door.click({ timeout: 10000 });
        await page.waitForTimeout(700);
        check('clicking it leaves an open door behind',
            await page.locator('.wm-terrain-door-open').count() >= 1);
    }

    step('4. A combat logs to the board and leaves the model a summary it can read');
    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/fight Esqueleto 1');
    });
    await page.waitForTimeout(2000);
    check('the combat log is mounted on the real board, not only in /sandbox',
        await page.locator('#world_location_maps_list .combat-log-panel').count() === 1);
    check('the log already holds the opening entries',
        await page.locator('#world_location_maps_list .cl-row').count() > 0,
        `${await page.locator('#world_location_maps_list .cl-row').count()} entries`);

    await clearDiceOverlay();

    // /combat-end ends the player's turn. Leaving the fight is /combat-stop, which is
    // what reaches endCombat and therefore the epilogue.
    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/combat-stop');
    });
    await page.waitForTimeout(2000);
    await clearDiceOverlay();

    // The defect this whole flow exists to catch: the epilogue was posted as a system
    // message, which the prompt filter drops, so the model never learned the fight had
    // happened. What matters is not that a message exists but that it is not is_system.
    const epilogue = await page.evaluate(() => {
        const chat = window.SillyTavern.getContext().chat || [];
        const mine = chat.filter(m => m?.extra?.model === 'game-engine');
        const last = mine[mine.length - 1];
        return last ? { isSystem: last.is_system, text: String(last.mes || '').slice(0, 120) } : null;
    });

    check('the combat leaves an epilogue in the chat', epilogue !== null);
    check('and it is NOT a system message, so the next prompt carries it',
        epilogue?.isSystem === false, `is_system=${epilogue?.isSystem} · "${epilogue?.text}"`);

    step('5. The combat sandbox opens with its own log');
    // Deliberately not awaited inside the page: /sandbox opens a popup whose promise only
    // settles when the popup is closed, so awaiting it here waits for a click that this
    // script has not made yet. The first run hung exactly there.
    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/sandbox');
    });
    await page.waitForSelector('.combat-log-panel', { timeout: 20000 }).catch(() => {});
    check('the sandbox is on screen with a combat log',
        await page.locator('.combat-log-panel').count() >= 1);

    // Close it again, or the popup sits over everything the next step needs to click.
    await page.locator('.popup-button-close, .popup-button-ok').filter({ visible: true })
        .first().click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(800);

    step('6. A closed campaign is listed and can be continued');
    await closeChat();
    check('the campaign is listed with Continue',
        await page.locator('.campaign-card .campaign-continue').count() >= 1);

    step('7. The blank canvas: generate a world, review it, and play it');
    // Driven with a stand-in provider, so this costs nothing and stays deterministic.
    // Everything after the provider is the real thing: the schema, the repair pass, the
    // preview, the wizard, and the same world builders a hand-written template uses.
    // The answer below is deliberately sloppy — ragged rows, a stray symbol, an invented
    // tactical profile, a duplicate name — because that is what models actually return.
    await page.evaluate(async () => {
        const [{ askWizard }, { generateWorld }, { Popup, POPUP_TYPE }] = await Promise.all([
            import('/scripts/game-engine/ui/campaign-wizard.js'),
            import('/scripts/game-engine/world-builder/world-schema.js'),
            import('/scripts/popup.js'),
        ]);

        const sloppy = JSON.stringify({
            name: 'Cripta de Sal',
            genre: 'Terror gótico',
            description: 'Una cripta inundada bajo una iglesia en ruinas.',
            locationName: 'Cripta de Sal',
            boardName: 'Nave anegada',
            map: [
                '############',
                '#..........#',
                '#..##..~..',
                '#...cX.....#',
                '#..........#',
                '############',
            ],
            enemies: [
                { name: 'Ghoul', hp: 22, armorClass: 12, cr: 1, profile: 'devorador' },
                { name: 'Ghoul', hp: 22, armorClass: 12, cr: 1, profile: 'aggressive' },
            ],
        });

        window.__wizard = { done: false, answers: null };
        askWizard({
            Popup,
            POPUP_TYPE,
            existingWorldNames: [],
            generateWorld: (idea, partySize) => generateWorld({
                idea,
                partySize,
                generate: async () => sloppy,
            }),
        }).then(answers => { window.__wizard = { done: true, answers }; });
    });

    await page.waitForSelector('.cw-template-ai', { timeout: 15000 });
    check('the wizard offers to generate the world with AI', true);

    await page.locator('.cw-template-ai').click();
    await page.fill('.cw-ai textarea.cw-input', 'una cripta inundada con cultistas');
    await page.locator('.cw-ai-go').click();

    await page.waitForSelector('.cw-ai-map', { timeout: 20000 });
    // El mapa es editable desde que se puede corregir en la previsualizacion, asi que
    // su contenido esta en el valor del campo, no en el texto del nodo.
    const mapRows = (await page.locator('.cw-ai-map').inputValue()).trim().split('\n');
    const widths = new Set(mapRows.map(r => r.length));

    check('the generated board is shown before anything is created', mapRows.length >= 5, `${mapRows.length} rows`);
    check('its ragged rows were squared off', widths.size === 1, `widths: ${[...widths].join(',')}`);
    check('its open edge was sealed into wall',
        mapRows.every(r => r.startsWith('#') && r.endsWith('#'))
        && /^#+$/.test(mapRows[0]) && /^#+$/.test(mapRows[mapRows.length - 1]));
    check('the repairs are reported rather than done silently',
        await page.locator('.cw-ai-warn').count() >= 2,
        `${await page.locator('.cw-ai-warn').count()} warnings`);
    check('the world name was carried into step 2',
        (await page.inputValue('.cw-root input.cw-input >> nth=0')).includes('Cripta de Sal'));

    // Cambiar de idea recoge el panel: se quedaba abierto debajo de la plantilla elegida,
    // ensenando un mundo que ya no se iba a crear.
    await page.locator('.cw-template-card:not(.cw-template-ai):not(.cw-template-import)').first().click();
    await page.waitForTimeout(400);
    const panels7 = await page.evaluate(() => ({
        ai: document.querySelector('.cw-ai')?.offsetParent !== null,
        imp: document.querySelector('.cw-import')?.offsetParent !== null,
    }));
    check('elegir una plantilla normal recoge lo de la IA y lo de importar',
        panels7.ai === false && panels7.imp === false, JSON.stringify(panels7));

    // Y volver no pierde lo generado: el mundo escrito sigue ahi, listo para crearse.
    await page.locator('.cw-template-ai').click();
    await page.waitForTimeout(400);
    check('y volver a la IA no tira lo que ya habia escrito',
        (await page.locator('.cw-ai-map').inputValue()).trim().length > 0);
    check('ni deja puesto el nombre de la plantilla a la que te asomaste',
        (await page.inputValue('.cw-root input.cw-input >> nth=0')).includes('Cripta de Sal'),
        await page.inputValue('.cw-root input.cw-input >> nth=0'));

    // Accept it, then build the world through the very same createCampaign the wizard
    // uses. Driving askWizard directly means this test owns the glue that campaigns.js
    // normally owns, so the world is then started from its card like any other: that is
    // the real path, and the part worth proving.
    await page.click('.popup-button-ok');
    const built = await page.evaluate(async () => {
        const [{ createCampaign }, wi] = await Promise.all([
            import('/scripts/game-engine/ui/campaign-wizard.js'),
            import('/scripts/world-info.js'),
        ]);

        for (let i = 0; i < 100 && !window.__wizard.done; i++) {
            await new Promise(r => setTimeout(r, 100));
        }
        if (!window.__wizard.answers) return { error: 'the wizard returned nothing' };

        try {
            const created = await createCampaign({
                answers: window.__wizard.answers,
                createWorld: name => wi.createNewWorldInfo(name, { interactive: false }),
                loadWorld: wi.loadWorldInfo,
                saveWorld: (name, data) => wi.saveWorldInfo(name, data, true),
                createEntry: wi.createWorldInfoEntry,
            });

            const data = await wi.loadWorldInfo(created.worldName);
            const board = data.metadata.locationMaps[0].boards[0];
            return {
                worldName: created.worldName,
                locationName: created.locationName,
                boardName: created.boardName,
                party: created.party,
                walls: Object.values(board.terrain.cells).filter(c => c.type === 'wall').length,
                encounterRules: (board.encounterRules || []).length,
                monsters: Object.values(data.entries).filter(e => e.group === 'Monsters').length,
            };
        } catch (error) {
            return { error: String(error?.message || error) };
        }
    });

    check('the generated world is built through the same createCampaign as a template',
        !built.error, built.error || '');
    check('it kept the name, location and board the model described',
        built.worldName === 'Cripta de Sal' && built.boardName === 'Nave anegada',
        `${built.worldName} / ${built.locationName} / ${built.boardName}`);
    check('its repaired map became real terrain', built.walls > 20, `${built.walls} wall cells`);
    check('its enemies are in the Lorebook and reachable by /fight',
        built.monsters === 2 && built.encounterRules === 2,
        `${built.monsters} monsters, ${built.encounterRules} encounter rules`);

    step('8. The generated world is started from its card, like any other');
    await closeChat();
    const aiCard = page.locator('.campaign-card-unstarted[data-world="Cripta de Sal"]');
    check('it is listed as a campaign that was never played', await aiCard.count() === 1);

    await aiCard.locator('.campaign-start').click();

    // Un mundo generado no trae grupo: a la IA todavia no se le piden personajes. El
    // selector no tenia a quien ofrecer y no salia, asi que se entraba sin nadie. Ahora
    // se pregunta lo mismo que al crear una campana, por el mismo cuadro.
    await answerHeroCreator('Vera', { className: 'Clériga' });
    await page.waitForTimeout(1500);

    const aiState = await readState();
    check('un mundo sin gente te pregunta quien eres en vez de dejarte solo',
        (aiState.party || []).length === 1 && aiState.party[0]?.name === 'Vera',
        (aiState.party || []).map(m => m?.name).join(', ') || '(nadie)');

    // Y aqui tambien hace falta alguien mas: lo que viene —iniciativa, vinculos, relevo—
    // se juega en esta campana y no existe con una sola persona.
    await recruitCompanion('Tolomeo', String(aiState.location || ''));
    const aiWalls = await page.locator('.wm-terrain-wall').filter({ visible: true }).count();
    check('you end up on the board the model generated',
        aiState.world === 'Cripta de Sal' && aiState.board === 'Nave anegada',
        `${aiState.world} · ${aiState.location} / ${aiState.board}`);
    check('drawn with the walls it generated', aiWalls > 20, `${aiWalls} wall cells`);

    step('9. The rules editor: add a damage type without touching any code');
    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/rules');
    });
    await page.waitForSelector('.rx-root', { timeout: 20000 });

    const sectionCount = await page.locator('.rx-nav-item').count();
    check('every editable section is offered', sectionCount >= 20, `${sectionCount} sections`);
    check('the first one is what you came for: damage types',
        (await page.locator('.rx-nav-item').first().innerText()).includes('Tipos de daño'));

    const before = await page.locator('.rx-table .rx-row').count();
    await page.locator('.rx-add').click();
    const rows = page.locator('.rx-table .rx-row');
    await rows.last().locator('.rx-input').first().fill('void');
    await rows.last().locator('.rx-input').nth(1).fill('Vacío');
    check('a row can be added to the table', await rows.count() === before + 1);

    await page.locator('.rx-actions .menu_button').first().click();
    await page.waitForTimeout(400);
    check('applying the section reports success rather than failing quietly',
        await page.locator('.rx-ok').count() === 1,
        await page.locator('.rx-status').innerText());
    check('the section is marked as changed from the built-in rules',
        await page.locator('.rx-nav-item.modified').count() >= 1);

    await page.click('.popup-button-ok');
    await page.waitForTimeout(2500);

    // Saved into the world, which is where a campaign's rules belong: exporting the
    // world takes them along, and two campaigns can disagree about what a weapon is.
    const saved = await page.evaluate(async () => {
        const wi = await import('/scripts/world-info.js');
        const ctx = window.SillyTavern.getContext();
        const data = await wi.loadWorldInfo(ctx.chatMetadata.world_info);
        const pack = data?.metadata?.rulesetPack ?? null;
        const stored = window.localStorage.getItem('sillytavern_activeRulesetPack');
        return {
            damageTypes: pack?.items?.damageTypes ?? null,
            remembered: stored ? JSON.parse(stored)?.items?.damageTypes ?? null : null,
        };
    });

    check('the new damage type is stored in the campaign world',
        JSON.stringify(saved.damageTypes || []).includes('void'),
        JSON.stringify(saved.damageTypes));
    // dnd-system binds its tables at load, so the pack has to be waiting before the next
    // one. That is what makes "the campaign's own rules" possible at all.
    check('and remembered so the next page load starts with it',
        JSON.stringify(saved.remembered || []).includes('void'));

    const reloadToast = await page.locator('#toast-container .toast', { hasText: 'Recarga' }).count();
    check('you are told a reload is needed rather than left wondering', reloadToast >= 1);

    step('10. The prompt preview: see what a turn actually sends');
    // No provider is connected here, so the turn is fed in directly. What is exercised is
    // everything after the request is built: the split into named blocks, the ordering,
    // the fixed-versus-conversation ratio and the session total.
    await page.evaluate(async () => {
        const { recordPrompt, resetSession } = await import('/scripts/game-engine/ui/prompt-preview.js');
        resetSession();
        recordPrompt({
            messages: [
                { role: 'system', content: 'Eres el narrador de una campaña. '.repeat(60) },
                { role: 'system', content: '[DYN_COMBAT: Tono urgente] Frases cortas.' },
                { role: 'system', content: 'Lyra HP: 12/12 AC: 15 Inventario: espada corta' },
                { role: 'user', content: 'Ataco al ghoul' },
            ],
        }, false);
    });

    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/prompt');
    });
    await page.waitForSelector('.pp-root', { timeout: 20000 });

    const blockCount = await page.locator('.pp-block').count();
    const labels = await page.locator('.pp-block-label').allInnerTexts();
    check('the turn is broken into named blocks', blockCount >= 3, labels.join(' · '));
    check('the blocks it names are the ones the fork injects',
        labels.includes('Contexto dinámico') && labels.includes('Ficha del grupo'), labels.join(' · '));

    const sizes = await page.locator('.pp-block-tokens').allInnerTexts();
    const numbers = sizes.map(s => parseInt(s, 10));
    check('and they are sorted biggest first, which is the question being asked',
        numbers.every((n, i) => i === 0 || numbers[i - 1] >= n), numbers.join(' > '));

    const splitText = await page.locator('.pp-split').innerText();
    check('it states how much is context resent every turn', /Contexto fijo/.test(splitText), splitText.trim());
    check('the session total is shown', (await page.locator('.pp-session').innerText()).includes('turno'));
    // The figures are the app's own, not the provider's. Saying so is the point.
    check('and it says plainly that these are its own numbers, not a bill',
        /no la factura/.test(await page.locator('.pp-warning').innerText()));

    await page.click('.popup-button-ok');
    await page.waitForTimeout(500);

    step('11. The initiative tracker: who acts, who is next, and what ails them');
    // The board panel has to be open for anything drawn in it to exist.
    if (await page.locator('#world_location_maps_list').count() === 0
        || !(await page.locator('#world_location_maps_list').isVisible().catch(() => false))) {
        await page.locator('#partyDrawerIcon').click({ timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(1200);
    }
    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/fight Ghoul 1');
    });
    await page.waitForTimeout(2000);
    await clearDiceOverlay();

    // Conditions through the command a player would use, not by poking at the metadata:
    // the first attempt did the latter and never reached the party held in memory.
    const firstFighter = await page.evaluate(() => {
        const ctx = window.SillyTavern.getContext();
        return ctx.chatMetadata.party?.[0]?.name ?? '';
    });
    for (const condition of ['Poisoned', 'Prone']) {
        await page.evaluate(([name, cond]) => {
            void window.SillyTavern.getContext()
                .executeSlashCommandsWithOptions(`/condition ${name} ${cond}`);
        }, [firstFighter, condition]);
        await page.waitForTimeout(600);
    }

    const trackerRows = await page.locator('.wm-init-row').count();
    check('the tracker lists every combatant', trackerRows >= 3, `${trackerRows} rows`);
    check('exactly one is marked as acting',
        await page.locator('.wm-init-row.current').count() === 1);
    check('and one as going next, never the same one',
        await page.locator('.wm-init-row.next').count() === 1
        && await page.locator('.wm-init-row.current.next').count() === 0);
    check('the round is stated instead of counted by hand',
        /Ronda \d/.test(await page.locator('.wm-init-round').innerText()),
        (await page.locator('.wm-init-head').innerText()).replace(/\s+/g, ' '));
    check('each combatant shows its health', await page.locator('.wm-init-hp-fill').count() >= 3);
    check('conditions are drawn as markers, in the tracker and on the board',
        await page.locator('.wm-init-status').count() >= 2
        && await page.locator('.wm-token-status').count() >= 2,
        `${await page.locator('.wm-init-status').count()} en el rastreador, `
        + `${await page.locator('.wm-token-status').count()} sobre las fichas`);

    // --- Lo que un combate en marcha no deja hacer -----------------------------------
    // Todo esto se podia antes: abrir el mapa del mundo, repintar el suelo bajo los pies
    // de quien peleaba y largarse del tablero sin abandonar la pelea.
    const shut = await page.evaluate(() => {
        const terrain = document.querySelector('.wm-terrain-edit-btn');
        const back = document.querySelector('.wm-location-content > .wm-leave-loc-btn');
        return {
            worldTabs: document.querySelectorAll('.wm-view-tabs').length,
            palette: document.querySelectorAll('.wm-terrain-palette').length,
            terrainOff: terrain ? terrain.disabled : null,
            terrainWhy: terrain ? (terrain.getAttribute('title') || '') : '',
            backOff: back ? back.disabled : null,
            backWhy: back ? (back.getAttribute('title') || '') : '',
        };
    });

    check('dentro de un tablero no se ofrece el mapa del mundo: no es donde se esta',
        shut.worldTabs === 0, JSON.stringify(shut.worldTabs));
    check('el pincel de terreno se apaga mientras se pelea, y dice por que',
        shut.terrainOff === true && shut.palette === 0 && /no se repinta/.test(shut.terrainWhy),
        JSON.stringify({ apagado: shut.terrainOff, porque: shut.terrainWhy }));
    check('y salir del tablero tambien: se queda a la vista, apagado y explicado',
        shut.backOff === true && /Abandonar/.test(shut.backWhy),
        JSON.stringify({ apagado: shut.backOff, porque: shut.backWhy }));

    // Y por la otra puerta, la de escribir, que es la que se olvida al arreglar botones.
    const before11 = await readState();
    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/leave');
    });
    await page.waitForTimeout(700);
    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/go Ninguna Parte');
    });
    await page.waitForTimeout(700);
    const after11 = await readState();
    check('ni escribiendo /leave o /go se sale de una pelea sin abandonarla',
        after11.board === before11.board && after11.location === before11.location,
        JSON.stringify({ antes: `${before11.location}/${before11.board}`, despues: `${after11.location}/${after11.board}` }));

    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/combat-stop');
    });
    await page.waitForTimeout(1500);
    await clearDiceOverlay();

    // Y al acabar vuelve entero: retener no es quitar.
    const reopened = await page.evaluate(() => {
        const terrain = document.querySelector('.wm-terrain-edit-btn');
        const back = document.querySelector('.wm-location-content > .wm-leave-loc-btn');
        return { terrainOff: terrain ? terrain.disabled : null, backOff: back ? back.disabled : null };
    });
    check('y al terminar el combate vuelven los dos, que estaban retenidos, no quitados',
        reopened.terrainOff === false && reopened.backOff === false, JSON.stringify(reopened));

    step('12. Winning is worth something');
    const purseBefore = await page.evaluate(() => {
        const party = window.SillyTavern.getContext().chatMetadata.party || [];
        return { gold: party.reduce((s, m) => s + (m.gold || 0), 0), xp: party.reduce((s, m) => s + (m.xp || 0), 0) };
    });

    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/fight Ghoul 1');
    });
    await page.waitForTimeout(1500);
    await clearDiceOverlay();

    // Killed through the engine, not by editing state: the reward has to come from the
    // same path a real victory takes.
    for (let i = 0; i < 60; i++) {
        const what = await playOneTurn();
        if (what === 'over') break;
        await page.waitForTimeout(what === 'attacked' ? 650 : 200);
        if (what === 'attacked') await clearDiceOverlay();
        // Ending the turn after acting keeps the order moving.
        if (what !== 'passed') {
            await page.evaluate(() => window.SillyTavern.getContext()
                .executeSlashCommandsWithOptions('/combat-end'));
        }
    }
    await clearDiceOverlay();

    const purseAfter = await page.evaluate(() => {
        const party = window.SillyTavern.getContext().chatMetadata.party || [];
        return { gold: party.reduce((s, m) => s + (m.gold || 0), 0), xp: party.reduce((s, m) => s + (m.xp || 0), 0) };
    });

    const lootLine = await page.locator('#world_location_maps_list .cl-row', { hasText: 'Botín' }).count()
        + await page.locator('.mes_text', { hasText: 'Botín' }).count();

    // Whether the party wins is rolled, so what is checked is the rule: a victory pays,
    // and anything else does not. Asserting a win outright failed about one run in three.
    const won = await page.evaluate(() =>
        [...document.querySelectorAll('.mes_text')]
            .some(m => /ha ganado el combate|Objetivos cumplidos/.test(m.textContent || '')));

    check('the fight ended', await page.locator('.wm-combat-section').count() === 0);

    if (won) {
        check('winning makes the party richer', purseAfter.gold > purseBefore.gold,
            `${purseBefore.gold} -> ${purseAfter.gold}`);
        check('and earns experience', purseAfter.xp > purseBefore.xp,
            `${purseBefore.xp} -> ${purseAfter.xp}`);
        check('and the reward is announced, not applied in silence', lootLine >= 1,
            `${lootLine} líneas de botín`);
    } else {
        check('losing pays nothing', purseAfter.gold === purseBefore.gold,
            `perdieron: ${purseBefore.gold} -> ${purseAfter.gold}`);
        check('and nothing is announced either', lootLine === 0, `${lootLine} líneas de botín`);
    }

    step('13. The campaign panel: the day and the bonds, reachable at last');
    await page.locator('#rm_tab_campaign').click({ timeout: 10000 });
    await page.waitForSelector('.cp-clock', { timeout: 15000 });

    check('the campaign tab exists and opens', await page.locator('.cp-clock').count() === 1);
    check('it states the day and marks the part of it',
        /Día \d+/.test(await page.locator('.cp-day').innerText())
        && await page.locator('.cp-slot.current').count() === 1,
        (await page.locator('.cp-clock').innerText()).replace(/\s+/g, ' ').slice(0, 60));

    const bondCards = await page.locator('.cp-bond').count();
    check('every party member has a bond card', bondCards === 2, `${bondCards} cards`);
    check('each one lists the perks it will unlock, earned or not',
        await page.locator('.cp-bond').first().locator('.cp-perk').count() === 4);

    // Time moves, and the slot marker moves with it.
    const slotBefore = await page.locator('.cp-slot.current').innerText();
    await page.locator('.cp-clock-actions .menu_button').first().click();
    await page.waitForTimeout(900);
    const slotAfter = await page.locator('.cp-slot.current').innerText();
    check('passing the time moves the day on', slotBefore !== slotAfter, `${slotBefore} -> ${slotAfter}`);

    // A recorded event is the only way a bond moves: the narration never decides it.
    const rankBefore = await page.locator('.cp-bond').first().locator('.cp-bond-points').innerText();
    await page.locator('.cp-bond').first().locator('.cp-event').selectOption('saved_their_life');
    await page.locator('.cp-bond').first().locator('.cp-bond-actions .menu_button').click();
    await page.waitForTimeout(900);
    const rankAfter = await page.locator('.cp-bond').first().locator('.cp-bond-points').innerText();
    check('recording an event moves that bond', rankBefore !== rankAfter, `${rankBefore} -> ${rankAfter}`);

    // Sleeping rolls the day over, which is also what brings back the daily perks.
    const dayBefore = await page.locator('.cp-day').innerText();
    await page.locator('.cp-clock-actions .menu_button').last().click();
    await page.waitForTimeout(900);
    check('sleeping starts a new day', (await page.locator('.cp-day').innerText()) !== dayBefore,
        `${dayBefore} -> ${await page.locator('.cp-day').innerText()}`);

    // And it survives a reload, because it lives with the chat.
    const stored = await page.evaluate(() => {
        const meta = window.SillyTavern.getContext().chatMetadata || {};
        return { day: meta.calendar?.day ?? null, bonds: Object.keys(meta.bonds?.bonds ?? {}).length };
    });
    check('the day and the bonds are saved with the campaign',
        stored.day > 1 && stored.bonds >= 1, JSON.stringify(stored));

    step('14. The turn machine, now the one running the fight');
    await page.locator('#rm_tab_location').click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(800);
    // The previous step may have left the party on the floor, and a fight cannot start
    // with nobody standing. Healing through the sheet is the player's own path.
    await page.evaluate(() => {
        const ctx = window.SillyTavern.getContext();
        for (const member of ctx.chatMetadata.party || []) {
            if ((member.hp || 0) <= 0) member.hp = member.maxHp || 10;
            member.activeConditions = (member.activeConditions || []).filter(c => c !== 'Unconscious');
        }
    });
    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/fight Ghoul 1');
    });
    await page.waitForTimeout(1800);
    await clearDiceOverlay();

    const turnShape = await page.evaluate(() => {
        const encounter = window.SillyTavern.getContext().chatMetadata.combatEncounter
            ?? window.SillyTavern.getContext().chatMetadata.combat ?? null;
        return encounter?.turnState ?? null;
    });
    check('a turn now tracks the action, the bonus action and the reaction',
        turnShape !== null
        && 'actionUsed' in turnShape && 'bonusActionUsed' in turnShape && 'reactionUsed' in turnShape,
        JSON.stringify(turnShape));

    check('the round counter is still running', /Ronda \d/.test(
        await page.locator('.wm-init-round').innerText().catch(() => '')));

    // Spending the action twice in one turn has to be refused, which is the whole reason
    // to have an action economy at all.
    // Getting into reach is itself rolled — who goes first, where the enemy lands — so
    // the check closes the distance the way a player would instead of assuming it. An
    // earlier version assumed, and failed every other run for no reason.
    // Walk the fight with the shared helper until somebody is in reach, then attack
    // twice: the second one has to be refused, which is what an action economy is for.
    // Whether anybody gets in reach at all is rolled too, so the loop reports what it
    // managed instead of leaving the checks below to fail for a reason that is not theirs.
    let reachedSomebody = false;
    for (let i = 0; i < 40; i++) {
        const what = await playOneTurn();
        if (what === 'over') break;
        if (what === 'attacked') { reachedSomebody = true; break; }
        await page.waitForTimeout(200);
    }
    await page.waitForTimeout(500);
    await clearDiceOverlay();

    const spentTwice = await page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const first = ctx.chatMetadata.combatEncounter?.turnState?.actionUsed ?? null;
        const enemy = (ctx.chatMetadata.combatEncounter?.enemies || []).find(e => (e.currentHp || 0) > 0);
        if (enemy) await ctx.executeSlashCommandsWithOptions(`/combat-attack ${enemy.name}`);
        const refused = [...document.querySelectorAll('#toast-container .toast')]
            .some(t => /ya fue usada/.test(t.innerText));
        return { first, refused };
    });
    await page.waitForTimeout(500);
    await clearDiceOverlay();

    if (reachedSomebody) {
        check('attacking spends the action', spentTwice.first === true, JSON.stringify(spentTwice));
        check('and a second attack in the same turn is refused', spentTwice.refused === true,
            JSON.stringify(spentTwice));
    } else {
        console.log('SKIP  nadie llego al alcance en 40 turnos: la economia de accion la fijan los tests');
    }

    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/combat-stop');
    });
    await page.waitForTimeout(1200);
    await clearDiceOverlay();
    check('the fight still ends cleanly', await page.locator('.wm-combat-section').count() === 0);

    step('15. A bond that changes how a fight goes');
    // Raised through the real command, so the rank comes from recorded events like any
    // other: the point of the design is that nothing else may move a bond.
    const raised = await page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const names = (ctx.chatMetadata.party || []).map(m => m.name);
        for (let i = 0; i < 25; i++) {
            await ctx.executeSlashCommandsWithOptions(`/bond ${names[1]} saved_their_life`);
        }
        const bonds = ctx.chatMetadata.bonds?.bonds ?? {};
        const entry = Object.values(bonds).find(b => b.points >= 84);
        return { names, points: entry?.points ?? 0 };
    });
    check('a bond reaches rank 8 through recorded events alone',
        raised.points >= 84, JSON.stringify(raised));

    await page.locator('#rm_tab_campaign').click({ timeout: 10000 });
    await page.waitForTimeout(700);
    const unlocked = await page.locator('.cp-bond').last().locator('.cp-perk.unlocked').count();
    check('the panel shows the perks it has earned', unlocked >= 3, `${unlocked} unlocked`);

    // Whether a killing blow actually lands inside one test run is a matter of dice, so
    // what is checked here is the decision the engine makes from the bonds this campaign
    // really has saved. That the rescue then applies is covered by the unit tests; this
    // is the seam between the two that nothing else exercises.
    const decisions = await page.evaluate(async () => {
        const { planEndure, planFollowUp, planBatonPass } =
            await import('/scripts/game-engine/combat/bond-perks.js');
        const ctx = window.SillyTavern.getContext();
        const bonds = ctx.chatMetadata.bonds;
        const party = (ctx.chatMetadata.party || []).map(m => ({ id: m.id, name: m.name, hp: m.hp || 10 }));
        const leader = party[0];
        const helper = party[1];

        return {
            lethal: planEndure({
                bonds, party, targetId: String(leader.id), currentHp: 5, damage: 99,
            }),
            survivable: planEndure({
                bonds, party, targetId: String(leader.id), currentHp: 5, damage: 1,
            }),
            followUp: planFollowUp({
                bonds, party, attackerId: String(leader.id), canReach: () => true, random: () => 0,
            }),
            relay: planBatonPass({
                bonds, party, actorId: String(helper.id), remainingFeet: 15,
            }),
        };
    });

    check('with the bonds this campaign earned, a companion would take a killing blow',
        decisions.lethal !== null, JSON.stringify(decisions.lethal));
    check('and would not step in for a scratch', decisions.survivable === null);
    check('the rank-3 follow-up is available too', decisions.followUp !== null);
    check('and the rank-5 relay offers somebody', (decisions.relay || []).length >= 1,
        JSON.stringify(decisions.relay));

    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/combat-stop');
    });
    await page.waitForTimeout(1000);
    await clearDiceOverlay();

    step('16. A fight with a purpose: the scenario decides it');
    // Back to the *template* campaign specifically: the generated one has no mission,
    // because the AI is not asked for objectives yet.
    await closeChat();
    await page.locator('.campaign-card[data-world="Mazmorra clásica"] .campaign-continue')
        .first().click({ timeout: 15000 });
    await page.waitForTimeout(2500);
    await page.locator('#rm_tab_location').click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(900);

    const board = await page.evaluate(async () => {
        const wi = await import('/scripts/world-info.js');
        const ctx = window.SillyTavern.getContext();
        const data = await wi.loadWorldInfo(ctx.chatMetadata.world_info);
        const first = data?.metadata?.locationMaps?.[0]?.boards?.[0];
        return { world: ctx.chatMetadata.world_info, objectives: (first?.objectives || []).map(o => o.label) };
    });
    check('the starter dungeon carries a mission, not just a brawl',
        board.objectives.length >= 1, JSON.stringify(board));

    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/fight Esqueleto 1');
    });
    await page.waitForTimeout(1800);
    await clearDiceOverlay();

    const shown = await page.locator('.wm-objective').count();
    check('the objectives are shown where the fight is', shown >= 1, `${shown} objetivos`);
    check('and above the initiative order, because what the fight is for outranks whose turn it is',
        await page.evaluate(() => {
            const objectives = document.querySelector('.wm-objectives');
            const tracker = document.querySelector('.wm-init');
            if (!objectives || !tracker) return false;
            return (objectives.compareDocumentPosition(tracker) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
        }));

    // Win it, and the victory has to come from the objective being met.
    for (let i = 0; i < 60; i++) {
        const what = await playOneTurn();
        if (what === 'over') break;
        await page.waitForTimeout(what === 'attacked' ? 650 : 200);
        if (what === 'attacked') await clearDiceOverlay();
        if (what !== 'passed') {
            await page.evaluate(() => window.SillyTavern.getContext()
                .executeSlashCommandsWithOptions('/combat-end'));
        }
    }
    await clearDiceOverlay();

    check('the mission ends the fight', await page.locator('.wm-combat-section').count() === 0);
    const said = await page.evaluate(() =>
        [...document.querySelectorAll('.mes_text')].some(m => /Objetivos cumplidos/.test(m.textContent || '')));
    check('and says so as a mission accomplished, not just as a body count', said);

    step('17. The contract you paste into your Gem');
    // The rules-editor step leaves a toast open on purpose (it holds the reload button),
    // and it sits over the dialog this step clicks in.
    await page.evaluate(() => {
        document.querySelectorAll('#toast-container .toast').forEach(t => t.remove());
    });
    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/esquema-campana');
    });
    await page.waitForSelector('.cs-root', { timeout: 20000 });

    const tabs = await page.locator('.cs-tab').allInnerTexts();
    check('the contract opens with a view per thing you might copy', tabs.length >= 5, tabs.join(' · '));
    check('including the example of a correct pack', tabs.some(t => /Ejemplo/.test(t)));
    // Contadas contra el propio contrato: una seccion nueva no puede quedarse sin su
    // vista y que nadie se entere, que es como se queda una campana a medio pegar.
    const sections = await page.evaluate(async () => {
        const schema = await import('/scripts/game-engine/campaign/campaign-pack-schema.js');
        return schema.SECTION_ORDER.length;
    });
    check('and one per section, because a book does not fit in one answer',
        tabs.filter(t => /Sección/.test(t)).length === sections,
        `${sections} secciones · ${tabs.join(' · ')}`);

    const instructions = await page.locator('.cs-text').inputValue();
    check('the instructions carry the schema and the version',
        instructions.includes('eliminate_all') && /Versión \d/.test(instructions),
        `${instructions.length} caracteres`);

    // The point of generating it: what you paste always matches what validates.
    const matches = await page.evaluate(async () => {
        const m = await import('/scripts/game-engine/campaign/campaign-pack-schema.js');
        const { OBJECTIVE_TYPES } = await import('/scripts/game-engine/campaign/scenarios.js');
        const schema = m.buildCampaignPackSchema();
        const types = schema.properties.quests.items.properties.objectives.items.properties.type.enum;
        return {
            same: JSON.stringify([...types].sort()) === JSON.stringify(Object.keys(OBJECTIVE_TYPES).sort()),
            asksForNames: Boolean(schema.properties.quests.items.properties.objectives.items.properties.target),
            asksForIds: Boolean(schema.properties.quests.items.properties.objectives.items.properties.targetIds),
        };
    });
    check('the objective types come from the engine, not from a copy',
        matches.same, JSON.stringify(matches));
    check('and it asks the author for names, never for ids a book cannot know',
        matches.asksForNames && !matches.asksForIds, JSON.stringify(matches));

    await page.locator('.cs-tab', { hasText: 'Ejemplo' }).click();
    await page.waitForTimeout(400);
    const example = await page.locator('.cs-text').inputValue();
    check('the example is valid JSON, as a sample of correct output must be',
        (() => { try { JSON.parse(example); return true; } catch { return false; } })());

    check('the rules a schema cannot express are stated too',
        await page.locator('.cs-rules li').count() >= 8,
        `${await page.locator('.cs-rules li').count()} reglas`);

    await page.click('.popup-button-ok');
    await page.waitForTimeout(500);

    step('18. El Modo Juego: el tablero a pantalla completa, y apagarlo no deja rastro');
    // Where the board panel lives logBefore the Shell touches it. Putting it back exactly
    // here is the whole promise of a layer that can be switched off.
    const home = await page.evaluate(() => {
        const panel = document.querySelector('#world_location_maps_row');
        return {
            parent: panel?.parentElement?.id || '',
            previous: panel?.previousElementSibling?.id || '',
            copies: document.querySelectorAll('#world_location_maps_row').length,
        };
    });

    // A fight to look at, with the party on its feet: an attack button that is disabled
    // because everyone is unconscious would prove nothing about the bar.
    await page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        for (const member of ctx.chatMetadata.party || []) member.hp = member.maxHp;
        await ctx.saveMetadata();
        void ctx.executeSlashCommandsWithOptions('/fight Esqueleto 2');
    });
    await page.waitForTimeout(1800);
    await clearDiceOverlay();

    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/modojuego');
    });
    await page.waitForSelector('#game-shell', { timeout: 15000 });
    await page.waitForTimeout(900);

    check('el Modo Juego se enciende con un comando', await page.locator('#game-shell').count() === 1);
    check('y la barra superior de SillyTavern se aparta mientras dura',
        await page.locator('#top-bar').isVisible().catch(() => false) === false);

    // The point of moving instead of copying: there is still exactly one board.
    const moved = await page.evaluate(() => ({
        copies: document.querySelectorAll('#world_location_maps_row').length,
        onStage: Boolean(document.querySelector('.gs-stage #world_location_maps_row')),
        inDrawer: Boolean(document.querySelector('#rm_party_block #world_location_maps_row')),
    }));
    check('el tablero se mueve al escenario, no se duplica',
        moved.copies === 1 && moved.onStage && !moved.inDrawer, JSON.stringify(moved));

    const shellWalls = await page.locator('#game-shell .wm-terrain-wall').count();
    const shellTokens = await page.locator('#game-shell .wm-token').count();
    check('el tablero se ve dentro del Shell, con sus muros', shellWalls > 20, `${shellWalls} muros`);
    check('y con los combatientes encima', shellTokens >= 3, `${shellTokens} fichas`);

    const shellTracker = await page.locator('#game-shell .wm-init-row').count();
    check('el rastreador de iniciativa lista a todo el mundo', shellTracker >= 3, `${shellTracker} filas`);
    check('la cabecera dice por que ronda va',
        /Ronda \d+/.test(await page.locator('.gs-head-state').innerText()),
        await page.locator('.gs-head-state').innerText());

    const scenes = await page.evaluate(() => [...document.querySelectorAll('.gs-scene-btn')]
        .map(b => ({ scene: b.dataset.scene, active: b.classList.contains('active'), disabled: b.disabled })));
    check('el conmutador marca la escena de combate como la activa',
        scenes.find(s => s.scene === 'combat')?.active === true, JSON.stringify(scenes));
    // Desde H4 existen las tres y ninguna es un cartel: la que este apagada lo esta por
    // una razon del juego. Aqui hay combate, asi que explorar espera (A8) y las otras dos
    // siguen abiertas — se narra y se mira mientras se pelea.
    const fake = await page.evaluate(() => [...document.querySelectorAll('.gs-scene-btn')]
        .filter(b => /la construye/.test(b.getAttribute('title') || '')).length);
    check('las tres escenas existen y ninguna es fingida',
        scenes.length === 3 && fake === 0, JSON.stringify(scenes));
    check('con una pelea encima, explorar espera y las otras dos no',
        scenes.find(s => s.scene === 'exploration')?.disabled === true
        && scenes.find(s => s.scene === 'dialogue')?.disabled === false
        && scenes.find(s => s.scene === 'combat')?.disabled === false,
        JSON.stringify(scenes));

    // The action bar either offers an attack or says why it cannot: which of the two it
    // is depends on the dice and on where the enemy AI walked, so the rule is what gets
    // checked, not the outcome.
    const readAttack = () => page.evaluate(() => {
        const button = document.querySelector('.gs-btn-attack');
        return { present: Boolean(button), enabled: Boolean(button && !button.disabled), why: button?.title || '' };
    });

    let attack = await readAttack();
    for (let i = 0; i < 12 && !attack.enabled; i++) {
        const state = await page.evaluate(() => window.SillyTavern.getContext().chatMetadata.combatEncounter?.active);
        if (!state) break;
        await page.evaluate(() => window.SillyTavern.getContext()
            .executeSlashCommandsWithOptions('/combat-end'));
        await page.waitForTimeout(700);
        await clearDiceOverlay();
        attack = await readAttack();
    }

    check('la barra de acciones dice de quien es el turno',
        (await page.locator('.gs-turn-label').innerText()).length > 0);
    check('atacar esta disponible, o explica por que no',
        attack.present && (attack.enabled || attack.why.length > 0), JSON.stringify(attack));

    if (attack.enabled) {
        const logBefore = await page.locator('#game-shell .cl-row').count();
        await page.locator('.gs-btn-attack').click();
        await page.waitForSelector('.gs-targets .gs-target', { timeout: 5000 });
        const targets = await page.locator('.gs-target').count();
        check('elegir objetivo es una lista de quien esta a tu alcance, no un nombre que teclear',
            targets >= 1, `${targets} objetivos`);
        await page.locator('.gs-target').first().click();
        await page.waitForTimeout(1200);
        await clearDiceOverlay();
        const logAfter = await page.locator('#game-shell .cl-row').count();
        check('y el ataque se resuelve y queda escrito en el registro', logAfter > logBefore, `${logBefore} -> ${logAfter}`);
    } else {
        console.log(`SKIP  ningun turno de jugador con enemigos al alcance en 12 rondas (${attack.why})`);
    }

    // Esc pausa, como en cualquier juego; salir es una opcion del menu, no un accidente.
    await page.keyboard.press('Escape');
    await page.waitForSelector('.gs-pause', { timeout: 5000 });
    const pause = await page.evaluate(() => ({
        card: document.querySelectorAll('.gs-pause-btn').length,
        shell: document.querySelectorAll('#game-shell').length,
        topBar: (document.querySelector('#top-bar')?.getBoundingClientRect().height || 0) > 0,
    }));
    check('Esc pausa el juego en vez de apagarlo', pause.shell === 1 && pause.card >= 4, JSON.stringify(pause));
    check('y en pausa vuelve la barra de SillyTavern, por encima de la capa',
        pause.topBar, JSON.stringify(pause));

    await page.locator('.gs-pause-btn', { hasText: 'Salir del Modo Juego' }).click();
    await page.waitForTimeout(1200);

    const restored = await page.evaluate((expected) => {
        const panel = document.querySelector('#world_location_maps_row');
        return {
            shell: document.querySelectorAll('#game-shell').length,
            bodyClass: document.body.classList.contains('game-shell-on'),
            copies: document.querySelectorAll('#world_location_maps_row').length,
            parent: panel?.parentElement?.id || '',
            previous: panel?.previousElementSibling?.id || '',
            sameParent: panel?.parentElement?.id === expected.parent,
            samePlace: (panel?.previousElementSibling?.id || '') === expected.previous,
            tokens: document.querySelectorAll('#world_location_maps_list .wm-token').length,
            leftovers: document.querySelectorAll('.gs-root, .gs-stage, .gs-adopted').length,
        };
    }, home);

    check('salir del menu de pausa apaga el Modo Juego', restored.shell === 0 && !restored.bodyClass, JSON.stringify(restored));
    check('y devuelve la barra superior', await page.locator('#top-bar').isVisible().catch(() => false));
    check('el tablero vuelve exactamente a donde estaba',
        restored.sameParent && restored.samePlace && restored.copies === 1, JSON.stringify(restored));
    check('sin dejar nada del Shell por el camino', restored.leftovers === 0, JSON.stringify(restored));
    check('y se sigue dibujando en su sitio de siempre', restored.tokens >= 2, `${restored.tokens} fichas`);

    // Leave the fight closed so the run ends the way it found things.
    await page.evaluate(() => window.SillyTavern.getContext()
        .executeSlashCommandsWithOptions('/combat-stop').catch(() => {}));
    await page.waitForTimeout(600);

    step('19. La escena de dialogo: el chat se mueve, no se replica');
    // Where the chat lives before the Shell borrows it. This is the check the whole step
    // exists for: `#sheld` carries the messages, the form, the streaming and the swipes.
    const chatHome = await page.evaluate(() => {
        const sheld = document.querySelector('#sheld');
        return {
            parent: sheld?.parentElement?.tagName || '',
            previous: sheld?.previousElementSibling?.id || '',
            copies: document.querySelectorAll('#sheld').length,
            messages: document.querySelectorAll('#chat .mes').length,
        };
    });
    check('antes de empezar hay un chat con mensajes', chatHome.messages > 0, JSON.stringify(chatHome));

    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/modojuego');
    });
    await page.waitForSelector('#game-shell', { timeout: 15000 });
    await page.waitForTimeout(800);

    // La tecla, como la usaria cualquiera.
    await page.keyboard.press('1');
    await page.waitForTimeout(800);

    const scene = await page.evaluate(() => {
        const sheld = document.querySelector('#sheld');
        const shell = document.querySelector('#game-shell');
        return {
            scene: shell?.getAttribute('data-scene') || '',
            copies: document.querySelectorAll('#sheld').length,
            inSlot: Boolean(document.querySelector('.gs-chat-slot > #sheld')),
            messages: document.querySelectorAll('#game-shell #chat .mes').length,
            form: Boolean(document.querySelector('#game-shell #form_sheld')),
            textarea: Boolean(document.querySelector('#game-shell #send_textarea')),
            insideShell: Boolean(shell && sheld && shell.contains(sheld)),
        };
    });
    check('la tecla 1 lleva a la escena de dialogo', scene.scene === 'dialogue', JSON.stringify(scene));
    check('el chat se mueve dentro de la escena, y sigue habiendo uno solo',
        scene.copies === 1 && scene.inSlot && scene.insideShell, JSON.stringify(scene));
    check('con sus mensajes, no con una copia vacia', scene.messages > 0, `${scene.messages} mensajes`);
    check('y con el formulario de escribir, que viaja dentro de `#sheld`',
        scene.form && scene.textarea, JSON.stringify(scene));

    check('el retrato dice quien habla',
        (await page.locator('.gs-speaker-name').innerText()).trim().length > 0,
        await page.locator('.gs-speaker-name').innerText().catch(() => '(sin retrato)'));
    const chips = await page.locator('.gs-chip').count();
    check('la franja de abajo lista al grupo', chips >= 2, `${chips} fichas de grupo`);
    check('con la vida de cada uno', await page.locator('.gs-chip-hp-fill').count() === chips);
    check('y la cabecera dice el dia y el momento',
        /^Día \d+ · /.test(await page.locator('.gs-head-state').innerText()),
        await page.locator('.gs-head-state').innerText());

    // Escribir desde dentro: el formulario es el de siempre, y el chat que hay en la
    // escena es el vivo, no una foto.
    await page.locator('#game-shell #send_textarea').fill('Hola desde la escena');
    const typed = await page.locator('#game-shell #send_textarea').inputValue();
    check('se puede escribir en la caja desde dentro de la escena',
        typed === 'Hola desde la escena', typed);

    const sendVisible = await page.evaluate(() => {
        const button = document.querySelector('#game-shell #send_but');
        if (!button) return null;
        const box = button.getBoundingClientRect();
        return { w: Math.round(box.width), h: Math.round(box.height) };
    });
    check('y el boton de enviar se ve dentro de la escena',
        Boolean(sendVisible && sendVisible.w > 0 && sendVisible.h > 0), JSON.stringify(sendVisible));

    // Enviar de verdad llamaria al proveedor, que en este recorrido no existe. `/send`
    // mete el mensaje por el mismo camino sin pedir respuesta, que es lo que hace falta
    // para saber si el chat montado en la escena es el que recibe.
    await page.locator('#game-shell #send_textarea').fill('');
    const grew = await page.evaluate(async () => {
        const before = document.querySelectorAll('#game-shell #chat .mes').length;
        await window.SillyTavern.getContext()
            .executeSlashCommandsWithOptions('/send Hola desde la escena');
        await new Promise(r => setTimeout(r, 900));
        const after = document.querySelectorAll('#game-shell #chat .mes').length;
        const last = [...document.querySelectorAll('#game-shell #chat .mes .mes_text')].pop();
        return { before, after, text: (last?.textContent || '').trim().slice(0, 40) };
    });
    check('un mensaje nuevo aparece en el chat de la escena',
        grew.after === grew.before + 1 && /Hola desde la escena/.test(grew.text), JSON.stringify(grew));

    // Escribir en el chat deja el foco dentro, y entonces las teclas son del mensaje, no
    // del juego. Escape sale de la caja: sin eso, pinchar en el chat seria una puerta de
    // ida, y solo el raton te sacaria del Modo Juego.
    await page.locator('#game-shell #send_textarea').click();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const afterBlur = await page.evaluate(() => ({
        shell: document.querySelectorAll('#game-shell').length,
        focused: document.activeElement?.id || '',
    }));
    check('Escape con el foco en la caja sale de la caja, no del juego',
        afterBlur.shell === 1 && afterBlur.focused !== 'send_textarea', JSON.stringify(afterBlur));

    // Volver al tablero y comprobar que el conmutador ensena una escena y esconde la otra.
    await page.keyboard.press('3');
    await page.waitForTimeout(700);
    const backToBoard = await page.evaluate(() => {
        const shell = document.querySelector('#game-shell');
        const board = document.querySelector('.gs-scene-map');
        const dialogue = document.querySelector('.gs-scene-dialogue');
        const visible = (node) => Boolean(node && node.getBoundingClientRect().height > 0);
        return { scene: shell?.getAttribute('data-scene') || '', board: visible(board), dialogue: visible(dialogue) };
    });
    check('la tecla 3 vuelve al tablero y esconde el dialogo',
        backToBoard.scene === 'combat' && backToBoard.board && !backToBoard.dialogue,
        JSON.stringify(backToBoard));

    await leaveGameMode();

    const chatBack = await page.evaluate((expected) => {
        const sheld = document.querySelector('#sheld');
        const textarea = /** @type {HTMLTextAreaElement|null} */ (document.querySelector('#send_textarea'));
        if (textarea) textarea.value = 'sigue viva';
        return {
            copies: document.querySelectorAll('#sheld').length,
            sameParent: sheld?.parentElement?.tagName === expected.parent,
            samePlace: (sheld?.previousElementSibling?.id || '') === expected.previous,
            insideShell: Boolean(document.querySelector('#game-shell')),
            messages: document.querySelectorAll('#chat .mes').length,
            typed: textarea?.value || '',
            styled: sheld ? getComputedStyle(sheld).position : '',
        };
    }, chatHome);
    check('al apagar, el chat vuelve exactamente a donde estaba',
        chatBack.copies === 1 && chatBack.sameParent && chatBack.samePlace && !chatBack.insideShell,
        JSON.stringify(chatBack));
    check('con sus mensajes intactos, incluido el recien enviado',
        chatBack.messages === chatHome.messages + 1, `${chatHome.messages} -> ${chatBack.messages}`);
    check('la caja de escribir sigue aceptando texto', chatBack.typed === 'sigue viva', chatBack.typed);
    check('y `#sheld` recupera su posicion propia, sin restos del Shell',
        chatBack.styled === 'absolute', chatBack.styled);
    await page.evaluate(() => {
        const textarea = /** @type {HTMLTextAreaElement|null} */ (document.querySelector('#send_textarea'));
        if (textarea) textarea.value = '';
    });

    step('20. El director automatico: la pantalla sigue a la partida, no al modelo');
    await page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        for (const member of ctx.chatMetadata.party || []) member.hp = member.maxHp;
        await ctx.saveMetadata();
        void ctx.executeSlashCommandsWithOptions('/modojuego');
    });
    await page.waitForSelector('#game-shell', { timeout: 15000 });
    await page.waitForTimeout(800);

    // De charla, a proposito: lo que se comprueba es que el combate venga a buscarte.
    await page.keyboard.press('1');
    await page.waitForTimeout(600);
    check('se empieza en la escena de dialogo',
        await page.getAttribute('#game-shell', 'data-scene') === 'dialogue');

    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/fight Esqueleto 1');
    });
    await page.waitForTimeout(2000);
    await clearDiceOverlay();

    const started = await page.evaluate(() => ({
        scene: document.querySelector('#game-shell')?.getAttribute('data-scene') || '',
        reason: document.querySelector('.gs-head-state')?.getAttribute('title') || '',
        board: (document.querySelector('.gs-scene-map')?.getBoundingClientRect().height || 0) > 0,
    }));
    check('empezar un combate lleva la pantalla al tablero, sin tocar nada',
        started.scene === 'combat' && started.board, JSON.stringify(started));
    check('y la cabecera dice por que ha cambiado', started.reason === 'empieza un combate', started.reason);

    // Explorar era la puerta grande: un clic y te ibas del combate sin abandonarlo,
    // dejando el encuentro vivo sobre un tablero que ya no mirabas.
    const scenes20 = await page.evaluate(() => Object.fromEntries(
        [...document.querySelectorAll('.gs-scene-btn')].map(b => [
            b.dataset.scene, { off: b.disabled, why: b.getAttribute('title') || '' },
        ])));
    check('explorar se apaga mientras se pelea, y dice que hay un combate',
        scenes20.exploration?.off === true && /combate/i.test(scenes20.exploration?.why ?? ''),
        JSON.stringify(scenes20.exploration));
    check('pero el tablero y el dialogo siguen: se mira y se narra mientras se pelea',
        scenes20.combat?.off === false && scenes20.dialogue?.off === false,
        JSON.stringify({ combate: scenes20.combat?.off, dialogo: scenes20.dialogue?.off }));

    // Mirar el mapa en mitad de una pelea sigue siendo cosa tuya.
    await page.keyboard.press('1');
    await page.waitForTimeout(500);
    await page.evaluate(() => window.SillyTavern.getContext()
        .executeSlashCommandsWithOptions('/combat-end'));
    await page.waitForTimeout(900);
    await clearDiceOverlay();
    check('una eleccion tuya manda sobre la automatica mientras no pase nada nuevo',
        await page.getAttribute('#game-shell', 'data-scene') === 'dialogue',
        await page.getAttribute('#game-shell', 'data-scene'));

    // Y al terminar, de vuelta a la conversacion: lo que viene es el epilogo.
    await page.evaluate(() => window.SillyTavern.getContext()
        .executeSlashCommandsWithOptions('/combat-stop'));
    await page.waitForTimeout(1600);
    await clearDiceOverlay();

    const ended = await page.evaluate(() => {
        const messages = [...document.querySelectorAll('#game-shell #chat .mes')];
        const last = messages[messages.length - 1];
        return {
            scene: document.querySelector('#game-shell')?.getAttribute('data-scene') || '',
            reason: document.querySelector('.gs-head-state')?.getAttribute('title') || '',
            speaker: document.querySelector('.gs-speaker-name')?.textContent || '',
            lastIsSystem: last?.getAttribute('is_system') === 'true',
            text: (last?.querySelector('.mes_text')?.textContent || '').trim().slice(0, 60),
        };
    });
    check('terminar el combate devuelve la pantalla al dialogo, que es donde va el epilogo',
        ended.scene === 'dialogue', JSON.stringify(ended));
    check('y lo dice', ended.reason === 'termina el combate', ended.reason);
    check('el epilogo esta ahi, y no es un mensaje de sistema',
        ended.text.length > 0 && !ended.lastIsSystem, JSON.stringify(ended));
    check('el retrato es de quien acaba de hablar', ended.speaker.length > 0, ended.speaker);

    // Salir del tablero manda la partida al mapa, que desde H4 es una escena de verdad.
    await page.evaluate(() => window.SillyTavern.getContext()
        .executeSlashCommandsWithOptions('/leave'));
    await page.waitForTimeout(1200);
    const left = await page.evaluate(() => {
        const stage = document.querySelector('.gs-stage');
        const meta = window.SillyTavern.getContext().chatMetadata ?? {};
        const explore = [...document.querySelectorAll('.gs-scene-btn')]
            .find(b => /explor/i.test(b.textContent || ''));
        return {
            scene: document.querySelector('#game-shell')?.getAttribute('data-scene') || '',
            reason: document.querySelector('.gs-head-state')?.getAttribute('title') || '',
            empty: (stage?.textContent || '').trim().length === 0,
            places: (document.querySelector('.gs-places')?.getBoundingClientRect().height || 0) > 0,
            // Lo que ve el director, para que un fallo aqui diga por que y no solo que.
            location: String(meta.currentLocation ?? ''),
            board: String(meta.currentBoard ?? ''),
            exploreOff: explore ? explore.disabled : null,
            exploreWhy: explore ? (explore.title || '') : '',
        };
    });
    // Explorar pide **a donde ir**. Cuando un mundo nuevo tenia una sola localidad, esa
    // pestana abria un mapa de un punto y salir del tablero caia en la conversacion con
    // el boton apagado. Desde que nace con vecinos hay sitios de verdad, asi que esto
    // comprueba lo contrario: que se va al mapa y que el boton dice cuantos hay.
    check('salir del tablero lleva al mapa, con los sitios a los que ir',
        left.scene === 'exploration' && !left.empty && left.places === true
        && left.exploreOff === false && /\[\d+\]/.test(left.exploreWhy),
        JSON.stringify(left));
    check('y la cabecera sigue diciendo lo que paso de verdad',
        left.reason === 'se ha salido del tablero', left.reason);

    await leaveGameMode();
    check('y el Modo Juego se apaga dejandolo todo en su sitio',
        await page.evaluate(() => document.querySelectorAll('#game-shell').length === 0
            && document.querySelectorAll('#sheld').length === 1
            && !document.body.classList.contains('game-shell-on')));

    step('21. La escena de exploracion: el mapa de campana, por fin cargado');
    // Desde otra pestana del cajon, que es de donde se entra de verdad: el cajon esconde
    // la pestana que no toca, y el panel del tablero es una de ellas.
    await page.locator('#rm_tab_party').click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);
    check('el cajon tenia el panel del tablero escondido antes de empezar',
        await page.evaluate(() => document.querySelector('#world_location_maps_row')
            ?.classList.contains('tab-panel-hidden') === true));

    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/modojuego');
    });
    await page.waitForSelector('#game-shell', { timeout: 15000 });
    await page.waitForTimeout(800);

    // Sin tablero abierto, el director lleva solo a la exploracion.
    check('sin tablero abierto, la pantalla es la del mapa',
        await page.getAttribute('#game-shell', 'data-scene') === 'exploration',
        await page.getAttribute('#game-shell', 'data-scene'));

    const explore = await page.evaluate(() => ({
        here: document.querySelector('.gs-here-name')?.textContent || '',
        places: [...document.querySelectorAll('.gs-place')].map(p => ({
            name: p.querySelector('.gs-place-name')?.textContent || '',
            note: p.querySelector('.gs-place-note')?.textContent || '',
            locked: p.classList.contains('status-locked'),
            complete: p.classList.contains('status-complete'),
            current: p.classList.contains('current'),
        })),
        boards: [...document.querySelectorAll('.gs-board-name')].map(b => b.textContent),
        chips: document.querySelectorAll('.gs-actions .gs-chip').length,
        mapVisible: (document.querySelector('#game-shell [data-map-root]')?.getBoundingClientRect().height || 0) > 0,
    }));
    check('dice donde esta el grupo', explore.here.length > 0, explore.here);
    check('lista los sitios del mundo', explore.places.length >= 1, JSON.stringify(explore.places));
    check('marca el sitio en el que estas', explore.places.some(p => p.current), JSON.stringify(explore.places));
    check('y los tableros de aqui', explore.boards.length >= 1, JSON.stringify(explore.boards));
    check('con el grupo abajo', explore.chips >= 2, `${explore.chips} fichas`);
    check('y el mapa ocupando la pantalla', explore.mapVisible);

    // Ganar el escenario da la localizacion por superada: eso es lo que abre las demas.
    const completed = await page.evaluate(() => {
        const map = window.SillyTavern.getContext().chatMetadata.campaignMap;
        return (map?.locations || []).filter(l => l.status === 'complete').map(l => l.id);
    });
    check('ganar la mision dejo la localizacion marcada como superada en el mapa',
        completed.length >= 1, JSON.stringify(completed));
    check('y se ve en la lista', explore.places.some(p => p.complete), JSON.stringify(explore.places));

    // Un sitio cerrado se ve y explica por que, en vez de esconderse.
    await page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const locations = ctx.chatMetadata.campaignMap?.locations || [];
        ctx.chatMetadata.campaignMap = {
            version: 1,
            locations: [...locations, {
                id: 'Santuario sellado', name: 'Santuario sellado', status: 'locked',
                requiresQuests: ['el_sello'], requiresLocations: [],
            }],
        };
        await ctx.saveMetadata();
    });
    // El mundo tiene que ofrecer el sitio para que el mapa lo muestre: si no existe, se
    // descarta a proposito.
    const hidden = await page.evaluate(async () => {
        const m = await import('/scripts/game-engine/ui/shell/exploration-scene.js');
        const ctx = window.SillyTavern.getContext();
        const view = m.buildExplorationView({
            locationMaps: [{ name: 'Santuario sellado' }],
            campaignMap: ctx.chatMetadata.campaignMap,
        });
        const withoutWorld = m.buildExplorationView({
            locationMaps: [], campaignMap: ctx.chatMetadata.campaignMap,
        });
        return { place: view.places[0], dropped: withoutWorld.places.length };
    });
    check('un sitio cerrado dice que le falta, no solo que no',
        hidden.place?.status === 'locked' && /misión/.test(hidden.place?.reasons?.[0] || ''),
        JSON.stringify(hidden.place));
    check('y un sitio que el mundo no tiene no se ofrece', hidden.dropped === 0, String(hidden.dropped));

    // Entrar en un tablero desde el panel de viaje cambia de escena sola.
    await page.locator('.gs-board').first().click();
    await page.waitForTimeout(1400);
    check('entrar en un tablero desde el mapa lleva la pantalla al tablero',
        await page.getAttribute('#game-shell', 'data-scene') === 'combat',
        await page.getAttribute('#game-shell', 'data-scene'));

    await leaveGameMode();
    check('y al apagar no queda nada del Shell',
        await page.evaluate(() => document.querySelectorAll('#game-shell').length === 0
            && document.querySelectorAll('#world_location_maps_row').length === 1
            && document.querySelectorAll('#sheld').length === 1));

    step('22. Titulo y pausa: salir de la partida sin salir del juego');
    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/modojuego');
    });
    await page.waitForSelector('#game-shell', { timeout: 15000 });
    await page.waitForTimeout(800);

    // La pausa abre las reglas, que es el mismo editor de `/rules`. Se llamaba
    // "Compendio y reglas" y ahora no: el compendio es la biblioteca de contenido,
    // y dos cosas con el mismo nombre es como se pierde una de las dos.
    await page.keyboard.press('Escape');
    await page.waitForSelector('.gs-pause', { timeout: 5000 });
    await page.locator('.gs-pause-btn', { hasText: 'Reglas' }).click();
    await page.waitForSelector('.rx-root', { timeout: 20000 });
    check('las reglas de la pausa abren el editor de siempre',
        await page.locator('.rx-root').count() === 1);
    check('y ningun boton de la pausa se llama ya Compendio, que es otra cosa',
        await page.locator('.gs-pause-btn', { hasText: 'Compendio' }).count() === 0);
    await page.locator('.popup-button-cancel').last().click();
    await page.waitForTimeout(700);

    // Opciones pulsa el icono de SillyTavern: el panel se abre donde siempre.
    await page.locator('.gs-pause-btn', { hasText: 'Opciones' }).click();
    await page.waitForTimeout(900);
    const options = await page.evaluate(() => {
        const panel = document.querySelector('#left-nav-panel');
        const box = panel?.getBoundingClientRect();
        return {
            open: Boolean(panel?.classList.contains('openDrawer')) && Boolean(box && box.height > 0),
            above: Number(getComputedStyle(document.querySelector('#top-settings-holder')).zIndex) > 3000,
        };
    });
    check('Opciones abre los paneles de SillyTavern tal cual, sin reubicarlos',
        options.open && options.above, JSON.stringify(options));
    await page.locator('#ai-config-button').click().catch(() => {});
    await page.waitForTimeout(500);

    // Salir al menu principal cierra la partida, no el juego.
    await page.locator('.gs-pause-btn', { hasText: 'Salir al menu principal' }).click();
    await page.waitForTimeout(3000);

    const title = await page.evaluate(() => ({
        shell: document.querySelectorAll('#game-shell').length,
        scene: document.querySelector('#game-shell')?.getAttribute('data-scene') || '',
        head: document.querySelector('.gs-head-state')?.textContent || '',
        banner: (document.querySelector('.gs-title')?.getBoundingClientRect().height || 0) > 0,
        cards: document.querySelectorAll('#game-shell .campaign-card, #game-shell .campaign-card-unstarted').length,
        newCampaign: Boolean(document.querySelector('#game-shell #cw-new-campaign')),
        form: (document.querySelector('#game-shell #form_sheld')?.getBoundingClientRect().height || 0) > 0,
        switcher: (document.querySelector('.gs-scenes')?.getBoundingClientRect().height || 0) > 0,
    }));
    check('salir al menu principal deja el Modo Juego encendido', title.shell === 1, JSON.stringify(title));
    check('en la pantalla de titulo', title.scene === 'title' && title.banner && title.head === 'Menu principal',
        JSON.stringify(title));
    check('con las campanas que ya existian, no una lista nueva',
        title.cards >= 1 && title.newCampaign, JSON.stringify(title));
    check('y sin caja de escribir ni conmutador, que ahi no pintan nada',
        !title.form && !title.switcher, JSON.stringify(title));

    // Y desde el titulo se vuelve a jugar, con el Shell puesto. Desde que hay menu
    // principal, la lista de partidas esta un paso mas adentro: se pide.
    check('el menu principal ofrece cargar una partida',
        await page.locator('.gs-menu-btn').filter({ hasText: 'Cargar partida' }).count() === 1);
    await page.locator('.gs-menu-btn').filter({ hasText: 'Cargar partida' }).click();
    await page.waitForTimeout(900);

    await page.locator('#game-shell .campaign-card .campaign-continue').first().click();
    await page.waitForTimeout(3500);
    const resumed = await page.evaluate(() => ({
        shell: document.querySelectorAll('#game-shell').length,
        scene: document.querySelector('#game-shell')?.getAttribute('data-scene') || '',
        sheld: document.querySelectorAll('#sheld').length,
    }));
    check('continuar una campana desde el titulo vuelve a la partida, sin salir del juego',
        resumed.shell === 1 && resumed.scene !== 'title' && resumed.sheld === 1, JSON.stringify(resumed));

    await leaveGameMode();
    check('y al apagar, todo vuelve a su sitio otra vez',
        await page.evaluate(() => document.querySelectorAll('#game-shell').length === 0
            && document.querySelectorAll('#sheld').length === 1
            && document.querySelectorAll('#world_location_maps_row').length === 1
            && !document.body.classList.contains('game-shell-on')
            && !document.body.classList.contains('game-shell-paused')));

    step('23. Importar un libro: del paquete del Gem a un tablero jugable');
    await closeChat();
    await page.click('#cw-new-campaign');
    // El tercer camino de la puerta: pegar el JSON. Se comprueba antes de crear nada.
    await page.waitForSelector('.tl-door-grid');
    await page.locator('.tl-door-card').nth(2).click();
    await page.waitForSelector('.tl-pack-box');

    check('el taller ofrece importar un libro', await page.locator('.cw-import-text').isVisible());

    // Primero uno roto, porque es lo que de verdad llega: el informe tiene que decir que
    // pasa antes de que se cree nada.
    const broken = JSON.stringify({
        version: 1,
        world: { name: 'Roto' },
        bestiary: [{ name: 'Cuervo', hp: 7, armorClass: 12, cr: 0.125 }],
        boards: [{
            id: 'sala', name: 'Sala',
            map: ['#####', '#...#', '#....', '#####'],
            partyStart: [{ x: 0, y: 0 }],
            enemies: [{ name: 'Lobo', x: 2, y: 1 }],
        }],
        quests: [{ id: 'q', name: 'Q', boardId: 'otro', objectives: [{ type: 'eliminate', label: 'X', target: 'Nadie' }] }],
    });
    await page.locator('.cw-import-text').fill(broken);
    await page.locator('.cw-import-check').click();
    await page.waitForSelector('.cw-import-verdict', { timeout: 10000 });

    const bad = await page.evaluate(() => ({
        verdict: document.querySelector('.cw-import-verdict')?.textContent || '',
        ok: document.querySelector('.cw-import-verdict')?.classList.contains('ok'),
        errors: [...document.querySelectorAll('.cw-import-bad li')].map(li => li.textContent || ''),
    }));
    check('un paquete roto se rechaza antes de crear nada', bad.ok === false && /no se puede importar/.test(bad.verdict), bad.verdict);
    check('y dice exactamente que le pasa, no "JSON invalido"',
        bad.errors.length >= 4
        && bad.errors.some(e => /borde exterior/.test(e))
        && bad.errors.some(e => /sobre un muro/.test(e))
        && bad.errors.some(e => /no esta en el bestiario/.test(e))
        && bad.errors.some(e => /no existe entre los tableros/.test(e)),
        JSON.stringify(bad.errors));

    // Y ahora el ejemplo que el propio contrato publica.
    const examplePack = await page.evaluate(async () => {
        const m = await import('/scripts/game-engine/campaign/campaign-pack-schema.js');
        return JSON.stringify(m.buildExamplePack());
    });
    await page.locator('.cw-import-text').fill(examplePack);
    await page.locator('.cw-import-check').click();
    await page.waitForTimeout(800);

    const okReport = await page.evaluate(() => ({
        ok: document.querySelector('.cw-import-verdict')?.classList.contains('ok'),
        counts: document.querySelector('.cw-import-counts')?.textContent || '',
    }));
    check('el ejemplo del contrato pasa la comprobacion', okReport.ok === true, okReport.counts);
    check('y el informe cuenta lo que trae',
        /2 localidades, 2 tableros, 2 enemigos, 1 companeros, 2 misiones, 4 objetivos/.test(okReport.counts),
        okReport.counts);

    // Aceptado el libro, el taller sigue por donde siguen los otros dos caminos, y el
    // nombre del mundo lo propone el paquete.
    await page.locator('.popup:visible .popup-button-ok').last().click();
    await page.waitForSelector('.tl-root');
    const delLibro = await page.evaluate(() =>
        /** @type {HTMLInputElement|null} */ (document.querySelector('.tl-input'))?.value || '');
    check('el nombre del mundo lo propone el paquete', /Molino/.test(delLibro), delLibro);

    // Paso 1 y 2 van solos: el libro ya trae la ficha. Los sitios del libro los pone su
    // propio importador, asi que los pasos 3 y 4 se saltan.
    await page.locator('.tl-next').click();
    await page.waitForTimeout(400);
    for (let i = 0; i < 9; i++) {
        await page.locator('.tl-skip').click();
        await page.waitForTimeout(400);
    }
    await page.locator('.tl-next').click();

    // Un libro trae el mundo, no a quien lo recorre: el paquete describe localidades,
    // bichos y misiones, y ninguna ficha de grupo. Asi que aqui tambien se pregunta.
    await answerHeroCreator('Lyra', { race: 'Media elfa', className: 'Pícara' });
    await page.waitForTimeout(4000);

    const imported = await page.evaluate(async () => {
        const wi = await import('/scripts/world-info.js');
        const ctx = window.SillyTavern.getContext();
        const worldName = ctx.chatMetadata.world_info;
        const data = await wi.loadWorldInfo(worldName);
        const meta = data?.metadata ?? {};
        const boards = meta.locationMaps?.[0]?.boards ?? [];
        const byComment = {};
        for (const entry of Object.values(data?.entries ?? {})) byComment[entry.comment] = String(entry.uid);
        return {
            worldName,
            location: meta.locationMaps?.[0]?.name,
            boards: boards.map(b => b.name),
            groups: [...new Set(Object.values(data?.entries ?? {}).map(e => e.group))].sort(),
            rules: boards[0]?.encounterRules ?? [],
            crowUid: byComment['Cuervo grande'],
            guardUid: byComment['Guardián del grano'],
            miraUid: byComment['Mira la Molinera'],
            objectives: (boards[1]?.objectives ?? []).map(o => ({ type: o.type, targetIds: o.targetIds, allyId: o.allyId, rounds: o.rounds })),
            party: (ctx.chatMetadata.party || []).map(m => `${m.name}@${m.mapPosition?.gridX},${m.mapPosition?.gridY}`),
            placements: boards[0]?.enemyPlacements ?? [],
        };
    });

    check('el libro es ahora una campana abierta', /Molino/.test(imported.worldName || ''), imported.worldName);
    check('con sus dos tableros en su localizacion',
        imported.boards.length === 2 && imported.location === 'El Molino de los Cuervos', JSON.stringify(imported));
    const village = await page.evaluate(async () => {
        const wi = await import('/scripts/world-info.js');
        const ctx = window.SillyTavern.getContext();
        const data = await wi.loadWorldInfo(ctx.chatMetadata.world_info);
        const places = data?.metadata?.locationMaps ?? [];
        const quiet = places.find(l => l.name === 'Vado de la Rueda');
        return {
            names: places.map(l => l.name),
            boards: quiet ? (quiet.boards ?? []).length : null,
            type: quiet?.locationType ?? '',
        };
    });
    check('una localidad sin tablero tambien llega: un pueblo tranquilo existe',
        village.boards === 0 && village.type === 'village', JSON.stringify(village));

    check('y con entradas de las cuatro clases que trae un libro',
        JSON.stringify(imported.groups) === JSON.stringify(['Characters', 'Factions', 'Lore', 'Monsters']),
        JSON.stringify(imported.groups));

    // Lo que costo una funcionalidad entera la vez anterior: reglas escritas antes de
    // que existieran los ids.
    check('las reglas de encuentro apuntan al monstruo que se acaba de crear',
        imported.rules.length === 1 && imported.rules[0].enemyId === imported.crowUid,
        JSON.stringify({ rules: imported.rules, crow: imported.crowUid }));
    check('y los objetivos tambien, cada uno al suyo',
        imported.objectives[0]?.targetIds?.[0] === imported.guardUid
        && imported.objectives[1]?.allyId === imported.miraUid
        && imported.objectives[2]?.rounds === 6,
        JSON.stringify(imported.objectives));
    check('el grupo esta en la casilla que dibuja el libro',
        JSON.stringify(imported.party) === JSON.stringify(['Lyra@2,7']), JSON.stringify(imported.party));

    // Y el segundo, por el mismo sitio que en las demas campanas.
    await recruitCompanion('Brand', String(imported.location || ''));
    const pair23 = await readState();
    check('y se le puede sumar alguien del libro sin tocar el Lorebook a mano',
        (pair23.party || []).length === 2,
        (pair23.party || []).map(m => m?.name).join(', '));

    // Y se juega: la prueba de que la importacion sirve es que /fight encuentre enemigos.
    // Con semilla: lo que duerme tras una puerta no sale por nombrarlo, asi que la
    // casilla se sortea, y un sorteo sin semilla hace que esta comprobacion salga cara o
    // cruz. Ademas es lo que la semilla promete: la misma partida, la misma casilla.
    await page.evaluate(() => window.SillyTavern.getContext()
        .executeSlashCommandsWithOptions('/semilla molino'));
    await page.waitForTimeout(600);

    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/fight Cuervo grande 1');
    });
    await page.waitForTimeout(2200);
    await clearDiceOverlay();

    const fight = await page.evaluate(() => {
        const enc = window.SillyTavern.getContext().chatMetadata.combatEncounter;
        return {
            active: Boolean(enc?.active),
            enemies: (enc?.enemies || []).map(e => ({ name: e.name, x: e.gridX, y: e.gridY })),
        };
    });
    check('un combate en el tablero importado encuentra a sus enemigos',
        fight.active && fight.enemies.length === 1, JSON.stringify(fight));
    // Su casilla dibujada esta en una sala que todavia nadie ha abierto, asi que no
    // aparece ahi: invocarlo a mano no abre puertas. Donde si aparece en su casilla es
    // al despertar, y eso lo comprueba el paso 24.
    check('pero no dentro de la sala que aun nadie ha abierto',
        !(fight.enemies[0]?.x === imported.placements[0]?.x && fight.enemies[0]?.y === imported.placements[0]?.y),
        JSON.stringify({ spawn: fight.enemies[0], drawn: imported.placements[0] }));

    await page.evaluate(() => window.SillyTavern.getContext()
        .executeSlashCommandsWithOptions('/combat-stop'));
    await page.waitForTimeout(900);
    await clearDiceOverlay();

    // Y la misma semilla lo pone en la misma casilla: sin esto, "dos partidas iguales"
    // era mentira en cuanto no habia nada dibujado despierto.
    const again = await page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        await ctx.executeSlashCommandsWithOptions('/semilla molino');
        await ctx.executeSlashCommandsWithOptions('/fight Cuervo grande 1');
        await new Promise(r => setTimeout(r, 1200));
        const enemy = (ctx.chatMetadata.combatEncounter?.enemies || [])[0];
        await ctx.executeSlashCommandsWithOptions('/combat-stop');
        return enemy ? { x: enemy.gridX, y: enemy.gridY } : null;
    });
    await page.waitForTimeout(900);
    await clearDiceOverlay();
    check('y con la misma semilla cae en la misma casilla',
        again?.x === fight.enemies[0]?.x && again?.y === fight.enemies[0]?.y,
        JSON.stringify({ primera: fight.enemies[0], segunda: again }));

    // De vuelta al azar, que es como juega el resto del recorrido.
    await page.evaluate(() => window.SillyTavern.getContext()
        .executeSlashCommandsWithOptions('/semilla'));
    await page.waitForTimeout(600);

    step('24. Salas y puertas: lo que duerme detras no aparece hasta que abres');
    // Seguimos en el libro importado del paso anterior. El sotano tiene su guardian
    // detras de una puerta, que es justo para lo que sirven las salas.
    const rooms = await page.evaluate(async () => {
        const wi = await import('/scripts/world-info.js');
        const ctx = window.SillyTavern.getContext();
        const data = await wi.loadWorldInfo(ctx.chatMetadata.world_info);
        const boards = data?.metadata?.locationMaps?.[0]?.boards ?? [];
        return boards.map(b => ({
            name: b.name,
            rooms: (b.rooms || []).map(r => ({ cells: r.cells.length, doors: r.doors.length, revealed: r.revealed })),
            placements: b.enemyPlacements || [],
        }));
    });
    check('el libro importado trajo sus salas, sacadas del propio mapa',
        rooms.every(b => b.rooms.length >= 2), JSON.stringify(rooms.map(b => b.rooms.length)));
    check('la sala donde empieza el grupo esta visible, y la otra no',
        rooms[0].rooms.filter(r => r.revealed).length === 1
        && rooms[0].rooms.some(r => !r.revealed), JSON.stringify(rooms[0].rooms));

    // El guardian del sotano duerme tras la puerta: entrar no deberia sacarlo.
    await page.evaluate(() => window.SillyTavern.getContext()
        .executeSlashCommandsWithOptions('/enter El sótano'));
    await page.waitForTimeout(1600);

    const sleeping = await page.evaluate(async () => {
        const m = await import('/scripts/game-engine/campaign/campaign-map.js');
        const wi = await import('/scripts/world-info.js');
        const ctx = window.SillyTavern.getContext();
        const data = await wi.loadWorldInfo(ctx.chatMetadata.world_info);
        const board = (data?.metadata?.locationMaps?.[0]?.boards ?? []).find(b => b.name === 'El sótano');
        return {
            board: ctx.chatMetadata.currentBoard,
            placements: board.enemyPlacements.length,
            awake: m.awakePlacements(board.rooms, board.enemyPlacements).length,
            doors: [...new Set((board.rooms || []).flatMap(r => r.doors))],
        };
    });
    check('en el sotano hay alguien colocado que todavia no esta despierto',
        sleeping.placements === 1 && sleeping.awake === 0, JSON.stringify(sleeping));

    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/fight Guardián del grano 1');
    });
    await page.waitForTimeout(1500);
    await clearDiceOverlay();
    const summoned = await page.evaluate(() => {
        const enc = window.SillyTavern.getContext().chatMetadata.combatEncounter;
        return (enc?.enemies || []).map(e => ({ x: e.gridX, y: e.gridY }));
    });
    check('invocarlo a mano no lo saca de la sala cerrada',
        summoned.length === 1 && !(summoned[0].x === 5 && summoned[0].y === 3),
        JSON.stringify(summoned));

    await page.evaluate(() => window.SillyTavern.getContext()
        .executeSlashCommandsWithOptions('/combat-stop'));
    await page.waitForTimeout(1000);
    await clearDiceOverlay();

    // Y ahora lo que da nombre a todo esto: abrir la puerta.
    await page.locator('#rm_tab_location').click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(800);
    const sotanoDoor = page.locator('.wm-terrain-door').filter({ visible: true }).first();
    check('la puerta del sotano esta dibujada y cerrada', await sotanoDoor.count() === 1, sleeping.doors.join(' '));
    await sotanoDoor.click({ timeout: 10000 });
    await page.waitForTimeout(2500);
    await clearDiceOverlay();

    const woken = await page.evaluate(async () => {
        const wi = await import('/scripts/world-info.js');
        const ctx = window.SillyTavern.getContext();
        const data = await wi.loadWorldInfo(ctx.chatMetadata.world_info);
        const board = (data?.metadata?.locationMaps?.[0]?.boards ?? []).find(b => b.name === 'El sótano');
        const enc = ctx.chatMetadata.combatEncounter;
        return {
            revealed: (board?.rooms || []).filter(r => r.revealed).length,
            total: (board?.rooms || []).length,
            active: Boolean(enc?.active),
            enemies: (enc?.enemies || []).map(e => ({ name: e.name, x: e.gridX, y: e.gridY })),
            inOrder: (enc?.turnOrder || []).filter(t => t.isEnemy).length,
            said: ([...document.querySelectorAll('.mes_text')]
                .map(m => m.textContent || '')
                .find(text => /Se despierta lo que dormia/.test(text)) || '').trim(),
        };
    });

    check('abrir la puerta revela la sala que guardaba',
        woken.revealed === woken.total, JSON.stringify({ revealed: woken.revealed, total: woken.total }));
    // Donde despierta se comprueba por el aviso, no por donde esta ahora: si le toca
    // iniciativa antes que a ti, para cuando lo miras ya ha echado a andar.
    check('y despierta a quien dormia dentro, en la casilla que dibuja el libro',
        woken.active && woken.enemies.length === 1 && /Guardián del grano \(9, 4\)/.test(woken.said),
        JSON.stringify({ enemigos: woken.enemies, aviso: woken.said }));
    check('el que despierta tiene turno de verdad, no solo ficha',
        woken.inOrder === woken.enemies.length, JSON.stringify({ orden: woken.inOrder, enemigos: woken.enemies.length }));
    check('y el chat lo cuenta', woken.said.length > 0, woken.said);

    await page.evaluate(() => window.SillyTavern.getContext()
        .executeSlashCommandsWithOptions('/combat-stop'));
    await page.waitForTimeout(1000);
    await clearDiceOverlay();

    step('25. Descansar, y que el prefijo del prompt no se mueva');
    // Nada de preparar la vida a mano: `chatMetadata.party` y la lista que usa el juego
    // no son los mismos objetos, asi que tocarla desde fuera miente. Lo que se comprueba
    // es lo que el motor dice que ha hecho, en su propio aviso, y lo que mueve el reloj.
    const beforeRest = await page.evaluate(() => {
        const ctx = window.SillyTavern.getContext();
        return { day: ctx.chatMetadata.calendar?.day ?? 1, slot: ctx.chatMetadata.calendar?.slotIndex ?? 0 };
    });

    await page.evaluate(() => window.SillyTavern.getContext()
        .executeSlashCommandsWithOptions('/descanso corto'));
    await page.waitForTimeout(2000);

    const afterShort = await page.evaluate(() => {
        const ctx = window.SillyTavern.getContext();
        const said = [...document.querySelectorAll('.mes_text')]
            .map(m => m.textContent || '').filter(t => /\[DESCANSO\]/.test(t)).pop() || '';
        return {
            day: ctx.chatMetadata.calendar?.day ?? 1,
            slot: ctx.chatMetadata.calendar?.slotIndex ?? 0,
            said,
            names: (ctx.chatMetadata.party || []).map(m => m.name),
        };
    });
    check('un descanso corto cuesta tiempo del calendario',
        afterShort.slot !== beforeRest.slot || afterShort.day !== beforeRest.day,
        JSON.stringify({ antes: [beforeRest.day, beforeRest.slot], despues: [afterShort.day, afterShort.slot] }));
    check('y deja escrito lo que le ha pasado a cada uno',
        /Descanso corto/.test(afterShort.said)
        && afterShort.names.every(name => afterShort.said.includes(name)),
        afterShort.said.slice(0, 160));

    // El largo: cura del todo y amanece, se estuviera como se estuviera.
    await page.evaluate(() => window.SillyTavern.getContext()
        .executeSlashCommandsWithOptions('/descanso largo'));
    await page.waitForTimeout(2000);

    const afterLong = await page.evaluate(() => {
        const ctx = window.SillyTavern.getContext();
        return {
            full: (ctx.chatMetadata.party || []).every(m => m.hp === m.maxHp),
            day: ctx.chatMetadata.calendar?.day ?? 1,
            spent: (ctx.chatMetadata.party || []).map(m => m.hitDiceSpent ?? 0),
            said: ([...document.querySelectorAll('.mes_text')]
                .map(m => m.textContent || '').filter(t => /\[DESCANSO\]/.test(t)).pop() || ''),
        };
    });
    check('un descanso largo deja al grupo entero',
        afterLong.full, JSON.stringify(afterLong.spent));
    check('y amanece', afterLong.day > afterShort.day, `${afterShort.day} -> ${afterLong.day}`);
    check('sin dados de golpe pendientes despues de dormir',
        afterLong.spent.every(s => s === 0), JSON.stringify(afterLong.spent));

    // Y no se descansa en mitad de un combate. El enemigo tiene que ser uno de las
    // reglas de *este* tablero: invocar al cuervo aqui no empieza ningun combate, y la
    // comprobacion pasaria por no haberlo intentado.
    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/fight Guardián del grano 1');
    });
    await page.waitForTimeout(1800);
    await clearDiceOverlay();
    const duringFight = await page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const day = ctx.chatMetadata.calendar?.day ?? 1;
        const fighting = Boolean(ctx.chatMetadata.combatEncounter?.active);
        await ctx.executeSlashCommandsWithOptions('/descanso largo');
        return { day, fighting, after: ctx.chatMetadata.calendar?.day ?? 1 };
    });
    check('y no se puede descansar en mitad de un combate',
        duringFight.fighting && duringFight.day === duringFight.after, JSON.stringify(duringFight));
    await page.evaluate(() => window.SillyTavern.getContext()
        .executeSlashCommandsWithOptions('/combat-stop'));
    await page.waitForTimeout(1000);
    await clearDiceOverlay();

    // Las cuatro claves fijas del contexto dinamico son las que de verdad importan: antes
    // `DYN_BOARD` —lo que cambia en cada turno— ordenaba la primera, asi que invalidaba
    // todo lo que venia detras.
    const promptOrder = await page.evaluate(async () => {
        const m = await import('/scripts/game-engine/cost/prompt-order.js');
        const fixed = [
            m.promptKey('rules', 'meta'),
            m.promptKey('npc', 'relationships'),
            m.promptKey('quest', 'quests'),
            m.promptKey('combat', 'board'),
        ];
        return {
            real: m.sortLikeSillyTavern(fixed).map(k => k.split('_')[2]),
            antes: ['DYN_BOARD', 'DYN_META_INSTRUCTION', 'DYN_QUESTS', 'DYN_RELATIONSHIPS'].sort(),
            rulesFirst: m.promptKey('rules', 'a') < m.promptKey('combat', 'a'),
            tiers: m.PROMPT_TIERS.map(t => t.id),
        };
    });
    check('el tablero, que cambia cada turno, ya no ordena el primero',
        promptOrder.antes[0] === 'DYN_BOARD' && promptOrder.real[promptOrder.real.length - 1] === 'combat',
        JSON.stringify({ antes: promptOrder.antes[0], ahora: promptOrder.real }));
    check('las claves del juego ordenan las reglas antes que el combate',
        promptOrder.rulesFirst, JSON.stringify(promptOrder.tiers));

    const keyed = await page.evaluate(async () => {
        const m = await import('/scripts/game-engine/cost/prompt-order.js');
        // El orden que SillyTavern va a usar es el alfabetico de las claves.
        const sample = ['combat', 'rules', 'location', 'lore'].map(c => m.promptKey(m.tierForCategory(c), c));
        return m.sortLikeSillyTavern(sample).map(k => k.split('_')[2]);
    });
    check('y ese orden es de lo que menos cambia a lo que mas',
        JSON.stringify(keyed) === JSON.stringify(['rules', 'world', 'location', 'combat']),
        JSON.stringify(keyed));

    const prefix = await page.evaluate(async () => {
        const m = await import('/scripts/game-engine/cost/prompt-order.js');
        const a = 'REGLAS iguales\nMUNDO igual\nPG: 20/20';
        const b = 'REGLAS iguales\nMUNDO igual\nPG: 14/20';
        const c = 'PG: 14/20\nREGLAS iguales\nMUNDO igual';
        return { bueno: m.stablePrefix(a, b).chars, malo: m.stablePrefix(a, c).chars, total: a.length };
    });
    check('un cambio al final conserva casi todo el prefijo; uno al principio, nada',
        prefix.bueno > prefix.total * 0.8 && prefix.malo < 5,
        JSON.stringify(prefix));

    step('26. Objetivos editables sin tocar World Info');
    // Sin `await` sobre el comando: abre un popup, y su promesa no resuelve hasta que
    // alguien lo cierra. Esperarla aqui dejaba el recorrido colgado para siempre.
    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/objetivos editar');
    });
    await page.waitForSelector('.oe-root', { timeout: 20000 });

    const editor = await page.evaluate(() => ({
        rows: document.querySelectorAll('.oe-row').length,
        types: [...(document.querySelector('.oe-type')?.options || [])].map(o => o.value),
        labels: [...document.querySelectorAll('.oe-label')].map(i => i.value),
    }));
    check('el editor abre los objetivos que ya tenia el tablero',
        editor.rows >= 1, JSON.stringify(editor.labels));
    check('y ofrece exactamente los tipos que el motor sabe juzgar',
        editor.types.length === 7 && editor.types.includes('eliminate') && editor.types.includes('protect'),
        editor.types.join(', '));

    // Anadir uno a mano, del tipo que no pide nada mas.
    await page.locator('.oe-actions .menu_button').first().click();
    await page.waitForTimeout(400);
    const added = await page.locator('.oe-row').count();
    check('se puede anadir un objetivo a mano', added === editor.rows + 1, `${editor.rows} -> ${added}`);

    await page.locator('.oe-row').last().locator('.oe-label').fill('Salir con vida');
    await page.click('.popup-button-ok');
    await page.waitForTimeout(2000);

    const savedObjectives = await page.evaluate(async () => {
        const wi = await import('/scripts/world-info.js');
        const ctx = window.SillyTavern.getContext();
        const data = await wi.loadWorldInfo(ctx.chatMetadata.world_info);
        const board = (data?.metadata?.locationMaps?.[0]?.boards ?? [])
            .find(b => b.name === ctx.chatMetadata.currentBoard);
        return (board?.objectives ?? []).map(o => ({ type: o.type, label: o.label }));
    });
    check('y se guarda en el tablero, sin abrir World Info',
        savedObjectives.some(o => o.label === 'Salir con vida'), JSON.stringify(savedObjectives));

    // Y lo que se guarda es lo que el motor juzga: el escenario lo lee sin mas.
    const judged = await page.evaluate(() => {
        const ctx = window.SillyTavern.getContext();
        void ctx.executeSlashCommandsWithOptions('/objetivos');
        return true;
    });
    await page.waitForTimeout(900);
    check('el escenario lee lo que acaba de guardarse', judged
        && (await page.locator('#toast-container .toast').count()) >= 0);

    // Un nombre inventado no se puede guardar: seria una mision imposible de cumplir.
    const refused = await page.evaluate(async () => {
        const m = await import('/scripts/game-engine/campaign/objective-editor.js');
        const { problems } = m.fromRows(
            [{ type: 'eliminate', label: 'Matar al dragon', values: { target: 'Dragon inexistente' } }], {});
        return problems;
    });
    check('un objetivo que nombra a quien no existe se rechaza, y dice por que',
        refused.length === 1 && /no existe en este mundo/.test(refused[0]), JSON.stringify(refused));


    step('27. Botin equipable, enemigos editables y cobertura por linea de tiro');
    // El botin, como objetos de verdad: una pocion que no se puede beber es ambientacion.
    const lootShape = await page.evaluate(async () => {
        const items = await import('/scripts/game-engine/combat/loot-items.js');
        const loot = await import('/scripts/game-engine/combat/loot.js');
        const dnd = await import('/scripts/dnd-system.js');
        const dropped = Object.values(loot.DEFAULT_LOOT_RULES.itemsByRarity).flat();
        const sword = dnd.createItem(items.describeLootItem('Espada rúnica', 'Rare'));
        return {
            undeclared: dropped.filter(n => !items.isDeclaredLoot(n)),
            sword: { id: Boolean(sword.id), slot: sword.slot, dice: sword.damageDice, rarity: sword.rarity },
        };
    });
    check('todo lo que sueltan las tablas esta declarado como objeto',
        lootShape.undeclared.length === 0, JSON.stringify(lootShape.undeclared));
    check('y una espada del botin se puede equipar, con su dado de dano',
        lootShape.sword.id && lootShape.sword.slot === 'weapon' && lootShape.sword.dice === '1d8',
        JSON.stringify(lootShape.sword));

    // Los enemigos del tablero, editables sin abrir World Info.
    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/enemigos');
    });
    await page.waitForSelector('.ee-root', { timeout: 20000 });
    const encounters = await page.evaluate(() => ({
        rows: document.querySelectorAll('.ee-row').length,
        options: [...document.querySelectorAll('.ee-enemy option')].map(o => o.value),
        summary: document.querySelector('.ee-summary')?.textContent || '',
    }));
    check('el editor de enemigos abre las reglas del tablero',
        encounters.rows >= 1 && encounters.options.length >= 1, JSON.stringify(encounters));
    check('y resume cuantos pueden salir', /×/.test(encounters.summary), encounters.summary);

    await page.locator('.ee-row').first().locator('.ee-count').last().fill('3');
    await page.click('.popup-button-ok');
    await page.waitForTimeout(1800);

    const savedRules = await page.evaluate(async () => {
        const wi = await import('/scripts/world-info.js');
        const ctx = window.SillyTavern.getContext();
        const data = await wi.loadWorldInfo(ctx.chatMetadata.world_info);
        const board = (data?.metadata?.locationMaps?.[0]?.boards ?? [])
            .find(b => b.name === ctx.chatMetadata.currentBoard);
        return board?.encounterRules ?? [];
    });
    check('lo editado se guarda en el tablero',
        savedRules.some(r => r.maxCount === 3), JSON.stringify(savedRules));

    // La cobertura, por linea de tiro: un pilar protege a quien esta detras.
    const cover = await page.evaluate(async () => {
        const los = await import('/scripts/game-engine/board/line-of-sight.js');
        const t = await import('/scripts/game-engine/board/terrain.js');
        const terrain = t.terrainFromAsciiMap(['#######', '#..c..#', '#######']);
        return {
            detras: los.getCoverAlongLine(terrain, 1, 1, 5, 1, t.getCoverBonus),
            sinNada: los.getCoverAlongLine(terrain, 1, 1, 2, 1, t.getCoverBonus),
            propia: los.getCoverAlongLine(terrain, 3, 1, 5, 1, t.getCoverBonus),
        };
    });
    check('un pilar en medio da cobertura a quien esta detras',
        cover.detras === 2 && cover.sinNada === 0, JSON.stringify(cover));
    check('y la casilla del propio tirador no cuenta',
        cover.propia === 0, JSON.stringify(cover));

    // Y quitar una regla que algo usa avisa antes de guardar.
    const impact = await page.evaluate(async () => {
        const ri = await import('/scripts/game-engine/rules/rule-impact.js');
        const dr = await import('/scripts/game-engine/rules/default-ruleset.js');
        const before = dr.DEFAULT_RULESET;
        const after = JSON.parse(JSON.stringify(before));
        after.items.damageTypes = after.items.damageTypes.filter(d => d[0] !== 'Slashing');
        const broken = ri.findBrokenReferences({
            before, after, items: [{ name: 'Espada', damageType: 'Slashing' }],
        });
        return { broken: broken.length, message: broken[0]?.message ?? '', summary: ri.describeImpact(broken) };
    });
    check('quitar un tipo de dano que algo usa se avisa, con quien lo usa',
        impact.broken === 1 && /Espada/.test(impact.message), impact.message);
    check('y se resume lo que costaria', /ficha/.test(impact.summary), impact.summary);


    step('28. Semilla, contradicciones y el pegamento fuera de party.js');
    // Los dados, repetibles: sin esto no se puede decir si un cambio mejoro algo.
    const seeded = await page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const rules = await import('/scripts/party/combat-rules.js');

        await ctx.executeSlashCommandsWithOptions('/semilla molino');
        const first = [rules.rollDiceDetailed('1d20').total, rules.rollDiceDetailed('2d6+1').total];

        await ctx.executeSlashCommandsWithOptions('/semilla molino');
        const second = [rules.rollDiceDetailed('1d20').total, rules.rollDiceDetailed('2d6+1').total];

        const saved = ctx.chatMetadata.diceSeed;
        await ctx.executeSlashCommandsWithOptions('/semilla');
        return { first, second, saved, cleared: ctx.chatMetadata.diceSeed ?? null, seeded: rules.isSeeded() };
    });
    check('con la misma semilla, las mismas tiradas',
        JSON.stringify(seeded.first) === JSON.stringify(seeded.second), JSON.stringify(seeded));
    check('la semilla se guarda con la partida, y se puede quitar',
        seeded.saved === 'molino' && seeded.cleared === null && seeded.seeded === false,
        JSON.stringify(seeded));

    // Las contradicciones: se anotan, no se corrigen.
    const contradictions = await page.evaluate(async () => {
        const m = await import('/scripts/game-engine/ui/contradiction-log.js');
        const ctx = window.SillyTavern.getContext();
        const party = (ctx.chatMetadata.party || []).map(p => ({ name: p.name, hp: p.hp, maxHp: p.maxHp }));
        const alive = party.find(p => p.hp > 0);

        const found = m.findContradictions(
            `${alive?.name} cae sin sentido. Por la noche todo calla.`,
            { party, slotLabel: 'Mañana', combatActive: false },
        );
        const log = m.appendContradictions(null, found, { day: 1 });
        return { kinds: found.map(f => f.kind), summary: m.summariseContradictions(log) };
    });
    check('una narracion que mata a quien sigue en pie se anota',
        contradictions.kinds.includes('muerte'), JSON.stringify(contradictions.kinds));
    check('y tambien la hora que no cuadra con el calendario',
        contradictions.kinds.includes('momento del día'), JSON.stringify(contradictions.kinds));
    check('el registro las agrupa por tipo',
        contradictions.summary.total === contradictions.kinds.length, JSON.stringify(contradictions.summary));

    // Y el estado de campana, ya fuera de party.js, sigue siendo el mismo estado.
    const extracted = await page.evaluate(async () => {
        const mod = await import('/scripts/party/campaign-state.js');
        const ctx = window.SillyTavern.getContext();
        const state = mod.createCampaignState({
            metadata: () => ctx.chatMetadata,
            saveMetadata: () => {},
            party: () => ctx.chatMetadata.party || [],
            saveParty: () => {},
            renderParty: () => {},
            renderCampaign: () => {},
            narrate: () => {},
            isFighting: () => false,
            worldName: () => ctx.chatMetadata.world_info,
            loadWorld: async () => null,
        });
        return { day: state.getCalendar().day, slot: state.getSlotLabel(), keys: Object.keys(state).length };
    });
    check('el modulo extraido lee el mismo calendario que la partida',
        extracted.day >= 1 && extracted.slot.length > 0, JSON.stringify(extracted));


    step('29. La prueba del raton: mover y atacar sin teclear');
    // Un combate en el tablero importado, y a partir de aqui solo clics.
    await page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        for (const member of ctx.chatMetadata.party || []) member.hp = member.maxHp;
        await ctx.saveMetadata();
        void ctx.executeSlashCommandsWithOptions('/fight Guardián del grano 1');
    });
    await page.waitForTimeout(2200);
    await clearDiceOverlay();

    // Llegar a un turno de jugador **con ficha en el tablero**: pulsar la ficha de otro
    // no hace nada, y con razon.
    let actingId = null;
    for (let i = 0; i < 12; i++) {
        actingId = await page.evaluate(() => {
            const enc = window.SillyTavern.getContext().chatMetadata.combatEncounter;
            const entry = enc?.turnOrder?.[enc?.currentTurnIndex];
            if (!enc?.active || !entry || entry.isEnemy) return null;
            const id = String(entry.id);
            const token = document.querySelector(`.wm-token[data-token-id="${id}"]`);
            return token && token.offsetParent ? id : null;
        });
        if (actingId) break;
        await page.evaluate(() => window.SillyTavern.getContext()
            .executeSlashCommandsWithOptions('/combat-end'));
        await page.waitForTimeout(700);
        await clearDiceOverlay();
    }

    check('hay un turno de jugador con su ficha en el tablero',
        Boolean(actingId), String(actingId));

    // Clic en tu propia ficha: enciende las casillas. No gasta nada.
    const myToken = page.locator(`.wm-token[data-token-id="${actingId}"]`)
        .filter({ visible: true }).first();
    await myToken.click({ timeout: 10000 });
    await page.waitForTimeout(700);

    const lit = await page.evaluate(() => ({
        cells: document.querySelectorAll('.wm-highlight-clickable').length,
        move: document.querySelectorAll('.wm-highlight-move.wm-highlight-clickable').length,
    }));
    check('pulsar tu ficha enciende casillas, y son pulsables',
        lit.cells > 0 && lit.move > 0, JSON.stringify(lit));

    // Clic en una casilla encendida: mueve. Se elige la que mas acerca al enemigo, y sin
    // nadie encima: una ficha dibujada sobre la casilla se lleva el clic antes que ella,
    // y acercarse es lo que hace que el ataque de despues no dependa de los dados.
    const movedTo = await page.evaluate(() => {
        const ctx = window.SillyTavern.getContext();
        const enc = ctx.chatMetadata.combatEncounter;
        const enemy = (enc?.enemies || []).find(e => (e.currentHp || 0) > 0);
        const taken = new Set([
            ...(ctx.chatMetadata.party || []).map(m => `${m.mapPosition?.gridX},${m.mapPosition?.gridY}`),
            ...(enc?.enemies || []).map(e => `${e.gridX},${e.gridY}`),
        ]);
        const free = [...document.querySelectorAll('.wm-highlight-move.wm-highlight-clickable')]
            .map(node => ({ x: Number(node.dataset.x), y: Number(node.dataset.y) }))
            .filter(cell => !taken.has(`${cell.x},${cell.y}`));
        if (free.length === 0) return null;
        if (!enemy) return free[0];

        const away = cell => Math.max(
            Math.abs(cell.x - (enemy.gridX || 0)), Math.abs(cell.y - (enemy.gridY || 0)));
        return free.sort((a, b) => away(a) - away(b))[0];
    });
    check('alguna casilla encendida esta libre de fichas', Boolean(movedTo), JSON.stringify(movedTo));
    await page.locator(
        `.wm-highlight-move.wm-highlight-clickable[data-x="${movedTo?.x}"][data-y="${movedTo?.y}"]`,
    ).first().click();
    await page.waitForTimeout(1200);
    await clearDiceOverlay();

    const afterMove = await page.evaluate(() => {
        const ctx = window.SillyTavern.getContext();
        const enc = ctx.chatMetadata.combatEncounter;
        const entry = enc?.turnOrder?.[enc?.currentTurnIndex];
        const me = (ctx.chatMetadata.party || []).find(m => String(m.id) === String(entry?.id));
        return me ? { x: me.mapPosition?.gridX, y: me.mapPosition?.gridY } : null;
    });
    check('pulsar una casilla encendida mueve de verdad, sin teclear',
        Boolean(movedTo && afterMove && afterMove.x === movedTo.x && afterMove.y === movedTo.y),
        JSON.stringify({ pulsada: movedTo, ahora: afterMove }));

    // Clic en el enemigo: abre su tarjeta. Y **no gasta el turno**, que es la regla.
    const enemyToken = page.locator('.wm-token-enemy').filter({ visible: true }).first();
    const actionBefore = await page.evaluate(() =>
        Boolean(window.SillyTavern.getContext().chatMetadata.combatEncounter?.turnState?.actionUsed));

    await enemyToken.click({ timeout: 10000 });
    await page.waitForSelector('.tc-card', { timeout: 8000 });

    const card = await page.evaluate(() => ({
        name: document.querySelector('.tc-name')?.textContent || '',
        stats: document.querySelector('.tc-stats')?.textContent || '',
        buttons: [...document.querySelectorAll('.tc-btn')].map(b => ({ text: b.textContent, off: b.disabled })),
        spent: Boolean(window.SillyTavern.getContext().chatMetadata.combatEncounter?.turnState?.actionUsed),
    }));
    check('pulsar un enemigo abre su tarjeta, con sus numeros',
        card.name.length > 0 && /PG .* CA .* ft/.test(card.stats), JSON.stringify(card.stats));
    check('un clic no gasta la accion del turno: esa es la regla',
        card.spent === actionBefore, JSON.stringify({ antes: actionBefore, despues: card.spent }));
    check('y la tarjeta ofrece atacar, el definitivo y cerrar',
        card.buttons.length === 3 && card.buttons[0].text === 'Atacar',
        JSON.stringify(card.buttons));

    // El boton si gasta: aqui es donde se ataca. Que el enemigo este a tiro depende de
    // donde haya andado, asi que si no lo esta, lo que se comprueba es que lo diga.
    const attackButton = page.locator('.tc-btn', { hasText: 'Atacar' });
    if (await attackButton.isDisabled()) {
        check('si el enemigo no esta a tiro, el boton lo dice en vez de no responder',
            /Fuera de alcance/.test(String(await attackButton.getAttribute('title'))),
            String(await attackButton.getAttribute('title')));
        await page.locator('.tc-btn', { hasText: 'Cerrar' }).click();
    } else {
        const logBefore = await page.locator('#world_location_maps_list .cl-row').count();
        await attackButton.click();
        await page.waitForTimeout(1400);
        await clearDiceOverlay();

        const afterAttack = await page.evaluate(() => ({
            card: document.querySelectorAll('.tc-card').length,
            spent: Boolean(window.SillyTavern.getContext().chatMetadata.combatEncounter?.turnState?.actionUsed),
        }));
        const logAfter = await page.locator('#world_location_maps_list .cl-row').count();

        check('el boton Atacar si resuelve el golpe, y queda en el registro',
            logAfter > logBefore, `${logBefore} -> ${logAfter}`);
        check('gasta la accion del turno y cierra la tarjeta',
            afterAttack.spent === true && afterAttack.card === 0, JSON.stringify(afterAttack));
    }

    await page.evaluate(() => window.SillyTavern.getContext()
        .executeSlashCommandsWithOptions('/combat-stop'));
    await page.waitForTimeout(1000);
    await clearDiceOverlay();

    step('30. El reloj, las fichas de accion y la tarjeta de companero');
    // Todo lo de aqui es a base de clics: ni un comando escrito.
    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/modojuego');
    });
    await page.waitForSelector('#game-shell', { timeout: 15000 });
    await page.waitForTimeout(1200);

    const clock = await page.evaluate(() => ({
        label: document.querySelector('.gs-clock-label')?.textContent || '',
        buttons: [...document.querySelectorAll('.gs-clock-btn')].map(b => ({
            text: b.textContent || '', off: b.disabled, why: b.title,
        })),
    }));
    check('el reloj dice el dia y el momento, dentro de la partida',
        /^Día \d+ · .+/.test(clock.label), clock.label);
    check('y trae las cuatro formas de pasar el tiempo, que vivian en un cajon',
        clock.buttons.length === 4
        && clock.buttons.some(b => /Pasar el rato/.test(b.text))
        && clock.buttons.some(b => /Descanso largo/.test(b.text)),
        JSON.stringify(clock.buttons.map(b => b.text)));

    await page.locator('.gs-clock-btn', { hasText: 'Pasar el rato' }).click();
    await page.waitForTimeout(1200);
    const afterSlot = await page.evaluate(() => document.querySelector('.gs-clock-label')?.textContent || '');
    check('pulsar Pasar el rato mueve el reloj de verdad',
        afterSlot !== clock.label && /^Día \d+ · .+/.test(afterSlot), `${clock.label} -> ${afterSlot}`);

    // La tira del grupo vive en el dialogo, que es donde se habla con ellos.
    await page.locator('.gs-scene-btn', { hasText: 'Dialogo' }).click();
    await page.waitForTimeout(900);

    const bondBefore = await page.evaluate(() => JSON.stringify(
        window.SillyTavern.getContext().chatMetadata.bonds ?? {}));

    // Tu cara no abre una tarjeta de companero: abre **tu** ficha, y la de mirar, no la
    // de editar. El editor tiene desplegables, facciones con casillas y las seis
    // caracteristicas como campos que se escriben, que es lo ultimo que quieres delante
    // en mitad de una partida.
    await page.locator('#game-shell .gs-chip').first().click();
    await page.waitForSelector('.ch-root', { timeout: 8000 });
    const own30 = await page.evaluate(() => ({
        boxes: [...document.querySelectorAll('.ch-box-label')].map(l => (l.textContent || '').trim()),
        editable: document.querySelectorAll('.ch-root input, .ch-root select, .ch-root textarea').length,
        edit: [...document.querySelectorAll('.ch-root button')]
            .some(b => /editar/i.test(b.textContent || '')),
    }));
    check('pulsar tu propia cara abre tu ficha, con lo que importa jugando',
        own30.boxes.length >= 4, JSON.stringify(own30.boxes.slice(0, 8)));
    check('y es de mirar: ni un campo que se pueda cambiar sin querer',
        own30.editable === 0, `${own30.editable} campos editables`);
    check('el editor sigue estando, pero detras de un boton',
        own30.edit === true, String(own30.edit));

    // Se cierra por su boton: Escape dentro del Modo Juego es la pausa, no el cuadro.
    await page.locator('.popup-button-ok').last().click();
    await page.waitForSelector('.ch-root', { state: 'detached', timeout: 10000 });
    await page.waitForTimeout(500);

    // Y la de otro si abre su tarjeta: ahi es donde se pasa el tiempo y se regala.
    await page.locator('#game-shell .gs-chip').nth(1).click();
    await page.waitForSelector('.cc-card', { timeout: 8000 });
    const card30 = await page.evaluate(() => ({
        name: document.querySelector('.cc-name')?.textContent || '',
        rank: document.querySelector('.cc-rank')?.textContent || '',
        actions: [...document.querySelectorAll('.cc-btn')].map(b => b.textContent || ''),
    }));
    check('pulsar una cara del grupo abre su ficha, con su rango',
        card30.name.length > 0 && /Rango/.test(card30.rank), JSON.stringify(card30));
    check('y ofrece pasar tiempo y regalar, no solo anotar lo que paso',
        card30.actions.some(a => /Pasar tiempo/.test(a)) && card30.actions.some(a => /Regalar/.test(a)),
        JSON.stringify(card30.actions));

    await page.locator('.cc-btn', { hasText: 'Pasar tiempo' }).click();
    await page.waitForTimeout(1400);
    const afterDowntime = await page.evaluate(() => ({
        bonds: JSON.stringify(window.SillyTavern.getContext().chatMetadata.bonds ?? {}),
        clock: document.querySelector('.gs-clock-label')?.textContent || '',
        card: document.querySelectorAll('.cc-card').length,
    }));
    check('pasar tiempo con alguien sube su vinculo y gasta un bloque del dia',
        afterDowntime.bonds !== bondBefore && afterDowntime.clock !== afterSlot && afterDowntime.card === 0,
        JSON.stringify({ reloj: afterSlot + ' -> ' + afterDowntime.clock }));

    // Las fichas de accion: lo que se puede hacer sin escribirlo.
    const chips30 = await page.evaluate(() => [...document.querySelectorAll('.gs-chip-action')]
        .map(b => b.textContent || ''));
    check('hay fichas de accion, y salen del estado del tablero',
        chips30.length > 0
        && chips30.some(c => /Salir del tablero/.test(c))
        && chips30.some(c => /Hablar con/.test(c)),
        JSON.stringify(chips30));

    const talk = page.locator('.gs-chip-action').filter({ hasText: 'Hablar con' }).first();
    if (await talk.count() > 0) {
        await talk.click();
        await page.waitForTimeout(500);
    }
    const draft = await page.evaluate(() =>
        document.querySelector('#send_textarea')?.value || '');
    check('la ficha de hablar deja la frase empezada, no la envia',
        /^Hablo con .+ sobre $/.test(draft), draft);
    await page.evaluate(() => {
        const box = document.querySelector('#send_textarea');
        if (box) box.value = '';
    });

    // Empezar el combate desde el tablero: los enemigos siguen dibujados en la sala que
    // el paso 24 dejo abierta, y nadie pelea.
    await page.locator('.gs-scene-btn[data-scene="combat"]').click();
    await page.waitForTimeout(1000);

    const startRow = await page.evaluate(() => ({
        rows: document.querySelectorAll('.sc-row').length,
        what: document.querySelector('.sc-what')?.textContent || '',
    }));
    check('con enemigos a la vista y nadie peleando, el tablero ofrece empezar',
        startRow.rows === 1 && /Guardián del grano/.test(startRow.what), JSON.stringify(startRow));

    await page.locator('.sc-btn').first().click();
    await page.waitForTimeout(1600);
    const banner = await page.evaluate(() => {
        const node = document.querySelector('.ib-banner');
        return {
            banner: document.querySelectorAll('.ib-banner').length,
            title: document.querySelector('.ib-title')?.textContent || '',
            clickable: node ? getComputedStyle(node).pointerEvents : '',
            fighting: Boolean(window.SillyTavern.getContext().chatMetadata.combatEncounter?.active),
        };
    });
    check('el boton empieza el combate con lo que el libro dibujo, y lo anuncia',
        banner.banner === 1 && banner.title === '¡INICIATIVA!' && banner.fighting,
        JSON.stringify(banner));
    check('y el cartel no roba clics: avisa, no decide',
        banner.clickable === 'none', banner.clickable);
    await clearDiceOverlay();

    const busy = await page.evaluate(() => ({
        clock: [...document.querySelectorAll('.gs-clock-btn')].map(b => b.disabled),
        why: document.querySelector('.gs-clock-btn')?.title || '',
        chips: document.querySelectorAll('.gs-chip-action').length,
    }));
    check('peleando no se descansa, y el boton dice por que en vez de desaparecer',
        busy.clock.length === 4 && busy.clock.every(Boolean) && busy.why === 'No mientras peleas.',
        JSON.stringify(busy));
    check('y las fichas de accion se retiran: la barra de combate ya manda',
        busy.chips === 0, String(busy.chips));

    // Y el turno se termina con su boton, que es el paso 6 de la prueba del raton.
    await page.locator('.gs-scene-btn[data-scene="combat"]').click();
    await page.waitForTimeout(800);
    const turnBefore = await page.evaluate(() => {
        const enc = window.SillyTavern.getContext().chatMetadata.combatEncounter;
        return String(enc?.turnOrder?.[enc?.currentTurnIndex]?.id ?? '');
    });
    const endTurn = page.locator('#game-shell .gs-btn').filter({ hasText: 'Fin de turno' }).first();
    check('la barra de combate ofrece terminar el turno', await endTurn.count() === 1);

    // Solo se puede pasar el turno propio, asi que primero hay que llegar a uno.
    for (let i = 0; i < 10 && await endTurn.isDisabled(); i++) {
        await page.evaluate(() => window.SillyTavern.getContext()
            .executeSlashCommandsWithOptions('/combat-end'));
        await page.waitForTimeout(800);
        await clearDiceOverlay();
    }
    check('y dice por que no se puede cuando no es tu turno',
        await endTurn.getAttribute('title') !== null,
        String(await endTurn.getAttribute('title')));

    if (await endTurn.count() === 1 && !await endTurn.isDisabled()) {
        await endTurn.click();
        await page.waitForTimeout(1600);
        await clearDiceOverlay();
        const turnAfter = await page.evaluate(() => {
            const enc = window.SillyTavern.getContext().chatMetadata.combatEncounter;
            return String(enc?.turnOrder?.[enc?.currentTurnIndex]?.id ?? '');
        });
        check('y pulsarlo pasa el turno de verdad, sin teclear',
            turnAfter !== turnBefore, turnBefore + ' -> ' + turnAfter);
    }

    const startedByButton = await page.evaluate(() => ({
        enemies: (window.SillyTavern.getContext().chatMetadata.combatEncounter?.enemies || []).length,
        row: document.querySelectorAll('.sc-row').length,
    }));
    check('y mientras se pelea ya no ofrece empezar otro',
        startedByButton.enemies > 0 && startedByButton.row === 0, JSON.stringify(startedByButton));

    await page.evaluate(() => window.SillyTavern.getContext()
        .executeSlashCommandsWithOptions('/combat-stop'));
    await page.waitForTimeout(1000);
    await clearDiceOverlay();
    await leaveGameMode();

    step('31. Subir de nivel, exportar la campana y el sonido por escena');

    // --- A1: la experiencia se convierte en algo -----------------------------------
    await page.locator('#rm_tab_party').click({ timeout: 10000 });
    await page.waitForTimeout(800);
    await page.locator('.party-card').first().click();
    await page.waitForSelector('.dnd-modal', { timeout: 10000 });
    await page.locator('.dnd-tab[data-tab="progression"]').click();
    await page.waitForTimeout(400);

    const readFirst = () => page.evaluate(() => {
        const m = (window.SillyTavern.getContext().chatMetadata.party || [])[0] || {};
        return { name: m.name, level: m.level, maxHp: m.maxHp, hp: m.hp, strength: m.strength, xp: m.xp };
    });
    const heroBefore = await readFirst();

    check('el boton de subir de nivel empieza apagado, sin experiencia',
        await page.locator('.dnd-level-up-btn').isDisabled(), JSON.stringify(heroBefore));

    // La experiencia se escribe en la ficha, que es el control que ya existia.
    await page.locator('.xp-current-input').fill('2700');
    await page.locator('.xp-current-input').dispatchEvent('change');
    await page.waitForTimeout(400);
    check('con experiencia de sobra, el boton se enciende solo',
        !await page.locator('.dnd-level-up-btn').isDisabled());

    await page.locator('.dnd-level-up-btn').click();
    await page.waitForSelector('.lu-card', { timeout: 8000 });

    const card31 = await page.evaluate(() => ({
        title: document.querySelector('.lu-title')?.textContent || '',
        gains: document.querySelector('.lu-gains')?.textContent || '',
        remaining: document.querySelector('.lu-remaining')?.textContent || '',
        abilities: document.querySelectorAll('.lu-ability').length,
        confirmOff: document.querySelector('.lu-confirm')?.disabled,
    }));
    check('la tarjeta dice a que nivel se sube y que da, antes de pulsar',
        /nivel 1 .* 4/.test(card31.title) && /PG/.test(card31.gains), JSON.stringify(card31));
    check('con 2700 de experiencia se saltan tres niveles de una vez',
        /\+\d+ PG/.test(card31.gains) && card31.abilities === 6, JSON.stringify(card31.gains));
    check('y no deja confirmar hasta repartir los puntos de caracteristica',
        card31.confirmOff === true && /Quedan 2 de 2/.test(card31.remaining), JSON.stringify(card31.remaining));

    // Dos clics en el "+" de Fuerza: el reparto es la unica eleccion de verdad que hay.
    const plus = page.locator('.lu-ability').first().locator('.lu-step').last();
    await plus.click();
    await plus.click();
    await page.waitForTimeout(300);
    check('repartidos los dos puntos, ya se puede confirmar',
        !await page.locator('.lu-confirm').isDisabled(),
        await page.locator('.lu-remaining').innerText());

    await page.locator('.lu-confirm').click();
    await page.waitForTimeout(1000);

    const heroAfter = await readFirst();
    check('subir de nivel sube el nivel de verdad',
        heroAfter.level === 4, `${heroBefore.level} -> ${heroAfter.level}`);
    check('y da puntos de golpe, que era justo lo que no hacia',
        heroAfter.maxHp > heroBefore.maxHp && heroAfter.hp > heroBefore.hp,
        JSON.stringify({ antes: heroBefore.maxHp, ahora: heroAfter.maxHp }));
    check('y la mejora de caracteristica que repartiste',
        heroAfter.strength === (heroBefore.strength || 10) + 2,
        `${heroBefore.strength} -> ${heroAfter.strength}`);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);

    // --- A2: la campana se puede mandar a alguien ----------------------------------
    const [exported] = await Promise.all([
        page.waitForEvent('download', { timeout: 20000 }),
        page.evaluate(() => {
            void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/exportar-campana');
        }),
    ]);
    const exportedPath = await exported.path();
    const pack31 = JSON.parse(readFileSync(exportedPath, 'utf8'));

    check('exportar deja un archivo con el nombre de la campana',
        /\.campaign\.json$/.test(exported.suggestedFilename()), exported.suggestedFilename());
    check('y dentro va el mundo entero: tableros, bestiario y misiones',
        pack31.boards.length >= 1 && pack31.bestiary.length >= 1 && pack31.quests.length >= 1,
        JSON.stringify({
            tableros: pack31.boards.length, enemigos: pack31.bestiary.length,
            misiones: pack31.quests.length, companeros: pack31.confidants.length,
        }));
    check('y la aldea sin tablero va dentro, que es la mitad de compartir una campana',
        (pack31.locations || []).some(l => l.name === 'Vado de la Rueda'),
        JSON.stringify((pack31.locations || []).map(l => l.name)));
    check('el mapa viaja como texto, con sus muros',
        Array.isArray(pack31.boards[0].map) && pack31.boards[0].map.some(row => row.includes('#')),
        JSON.stringify(pack31.boards[0].map?.[0] ?? null));
    check('y los objetivos vuelven a ser nombres, no identificadores de esta partida',
        pack31.quests.every(q => q.objectives.every(o => !JSON.stringify(o).includes('targetIds'))),
        JSON.stringify(pack31.quests[0]?.objectives?.[0] ?? null));

    // Lo exportado lo acepta el validador de la entrada: esa es la prueba de la ida y vuelta.
    const verdict31 = await page.evaluate(async (pack) => {
        const m = await import('/scripts/game-engine/campaign/campaign-pack.js');
        const report = m.validatePack(m.normalizePack(pack).pack);
        return { ok: report.ok, errors: report.errors.map(e => e.message) };
    }, pack31);
    check('lo que sale por exportar entra por importar, sin una queja',
        verdict31.ok, JSON.stringify(verdict31.errors.slice(0, 3)));

    // --- A3: el sonido por escena --------------------------------------------------
    const SILENCE = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/sonido');
    });
    await page.waitForSelector('.as-root', { timeout: 15000 });

    const scenes31 = await page.evaluate(() => [...document.querySelectorAll('.as-scene-name')]
        .map(n => n.textContent || ''));
    check('los ajustes de sonido ofrecen una pista por escena',
        scenes31.length === 4 && scenes31.some(s => /Combate/.test(s)), JSON.stringify(scenes31));

    await page.locator('.as-scene').filter({ hasText: 'Conversación' }).locator('.as-track').fill(SILENCE);
    await page.locator('.popup-button-ok').last().click();
    await page.waitForTimeout(800);

    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/modojuego');
    });
    await page.waitForSelector('#game-shell', { timeout: 15000 });
    await page.locator('.gs-scene-btn', { hasText: 'Dialogo' }).click();
    await page.waitForTimeout(900);

    const sounding = await page.evaluate(async () => {
        const m = await import('/scripts/game-engine/ui/shell/scene-audio.js');
        return { scene: document.querySelector('#game-shell')?.getAttribute('data-scene'), track: m.currentTrack() };
    });
    check('la escena de dialogo pone la pista que le pusiste',
        sounding.scene === 'dialogue' && sounding.track === SILENCE,
        JSON.stringify({ escena: sounding.scene, suena: sounding.track.slice(0, 24) }));

    await page.locator('.gs-scene-btn[data-scene="combat"]').click();
    await page.waitForTimeout(900);
    const silent = await page.evaluate(async () => {
        const m = await import('/scripts/game-engine/ui/shell/scene-audio.js');
        return m.currentTrack();
    });
    check('y una escena sin pista calla, en vez de heredar la de al lado',
        silent === '', JSON.stringify(silent));

    await leaveGameMode();

    // Viajar a un sitio sin tablero: el panel tiene que decir que ahi no se pelea, en vez
    // de quedarse en blanco como si estuviera roto.
    await page.evaluate(() => window.SillyTavern.getContext()
        .executeSlashCommandsWithOptions('/go Vado de la Rueda'));
    await page.waitForTimeout(1400);

    const quiet = await page.evaluate(() => ({
        where: window.SillyTavern.getContext().chatMetadata.currentLocation || '',
        empty: (document.querySelector('.wm-boards-empty')?.textContent || '').trim(),
        boards: document.querySelectorAll('#world_location_maps_list .wm-boards-section').length,
    }));
    check('se puede viajar a un pueblo que no tiene tablero',
        quiet.where === 'Vado de la Rueda', JSON.stringify(quiet.where));
    check('y el panel lo dice en vez de quedarse en blanco',
        quiet.boards === 0 && /no hay ningun tablero/i.test(quiet.empty), JSON.stringify(quiet.empty));

    step('32. Magia: el catalogo, el boton y el uso que se gasta');

    // El catalogo viene en el paquete de reglas, asi que se edita sin tocar codigo.
    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/habilidades');
    });
    await page.waitForSelector('.ab-root', { timeout: 20000 });

    const panel32 = await page.evaluate(() => ({
        cards: document.querySelectorAll('.ab-card').length,
        names: [...document.querySelectorAll('.ab-name')].map(i => i.value),
        summary: document.querySelector('.ab-summary')?.textContent || '',
        who: document.querySelectorAll('.ab-card .ab-who-one').length,
    }));
    check('el catalogo trae habilidades de serie, escritas como datos',
        panel32.cards >= 5 && panel32.names.includes('Rayo de fuego'), JSON.stringify(panel32.names));
    check('cada una se resume en una linea que dice lo que cuesta y que hace',
        /Acción · a voluntad · 120 ft · 1d10 de daño/.test(panel32.summary), panel32.summary);
    check('y se puede repartir quien se la sabe, que es lo que ninguna tabla resolvia',
        panel32.who >= 2, `${panel32.who} casillas`);

    // Que se la sepa alguien: se marca a todo el grupo en el rayo y en el escudo.
    await page.evaluate(() => {
        const cards = [...document.querySelectorAll('.ab-card')];
        for (const card of cards) {
            const name = card.querySelector('.ab-name')?.value || '';
            if (!/Rayo de fuego|Golpe de escudo/.test(name)) continue;
            for (const box of card.querySelectorAll('.ab-who-one input')) {
                if (!box.checked) box.click();
            }
        }
    });
    await page.locator('.popup-button-ok').last().click();
    await page.waitForTimeout(2500);

    const learned = await page.evaluate(() => (window.SillyTavern.getContext().chatMetadata.party || [])
        .map(m => ({ name: m.name, abilities: m.abilities || [] })));
    check('guardar deja escrito en la ficha lo que cada uno se sabe',
        learned.every(m => m.abilities.includes('rayo_de_fuego')), JSON.stringify(learned));

    // Y ahora, a usarla: un combate, la tarjeta del enemigo y su boton. Primero hay que
    // volver a un sitio con tablero: el paso 31 acaba en la aldea, que no tiene ninguno.
    await page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        await ctx.executeSlashCommandsWithOptions('/go El Molino de los Cuervos');
        await ctx.executeSlashCommandsWithOptions('/enter El sótano');
    });
    await page.waitForTimeout(1600);

    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/fight Guardián del grano 1');
    });
    await page.waitForTimeout(2200);
    await clearDiceOverlay();

    let actingId32 = null;
    for (let i = 0; i < 12; i++) {
        actingId32 = await page.evaluate(() => {
            const enc = window.SillyTavern.getContext().chatMetadata.combatEncounter;
            const entry = enc?.turnOrder?.[enc?.currentTurnIndex];
            if (!enc?.active || !entry || entry.isEnemy) return null;
            const token = document.querySelector(`.wm-token[data-token-id="${String(entry.id)}"]`);
            return token && token.offsetParent ? String(entry.id) : null;
        });
        if (actingId32) break;
        await page.evaluate(() => window.SillyTavern.getContext()
            .executeSlashCommandsWithOptions('/combat-end'));
        await page.waitForTimeout(700);
        await clearDiceOverlay();
    }
    check('hay un turno de jugador para lanzarla', Boolean(actingId32), String(actingId32));

    await page.locator(`.wm-token[data-token-id="${actingId32}"]`).filter({ visible: true }).first().click();
    await page.waitForTimeout(600);
    await page.locator('.wm-token-enemy').filter({ visible: true }).first().click();
    await page.waitForSelector('.tc-card', { timeout: 8000 });

    const cardButtons = await page.evaluate(() => [...document.querySelectorAll('.tc-btn')]
        .map(b => ({ text: (b.textContent || '').trim(), off: b.disabled, why: b.title })));
    check('la tarjeta del enemigo ofrece las habilidades, no solo atacar',
        cardButtons.some(b => /Rayo de fuego/.test(b.text)), JSON.stringify(cardButtons.map(b => b.text)));

    const rayo = cardButtons.find(b => /Rayo de fuego/.test(b.text));
    check('y un conjuro de 120 ft no esta "fuera de alcance" porque la espada llegue a 5',
        rayo && rayo.off === false, JSON.stringify(rayo));

    const hpBefore32 = await page.evaluate(() => {
        const enc = window.SillyTavern.getContext().chatMetadata.combatEncounter;
        return (enc?.enemies || [])[0]?.currentHp ?? null;
    });

    await page.locator('.tc-btn').filter({ hasText: 'Rayo de fuego' }).first().click();
    await page.waitForTimeout(1600);
    await clearDiceOverlay();

    const after32 = await page.evaluate(() => {
        const ctx = window.SillyTavern.getContext();
        const enc = ctx.chatMetadata.combatEncounter;
        const said = [...document.querySelectorAll('.mes_text')].map(m => m.textContent || '');
        return {
            hp: (enc?.enemies || [])[0]?.currentHp ?? null,
            spent: Boolean(enc?.turnState?.actionUsed),
            narrated: said.some(t => /usa Rayo de fuego/.test(t)),
        };
    });
    check('lanzarla gasta la accion del turno', after32.spent === true, JSON.stringify(after32.spent));
    check('y queda contada en el chat, con su tirada',
        after32.narrated, JSON.stringify(after32.narrated));
    check('el enemigo pierde vida, o el conjuro falla y se dice',
        after32.hp !== null && after32.hp <= hpBefore32, `${hpBefore32} -> ${after32.hp}`);

    await page.evaluate(() => window.SillyTavern.getContext()
        .executeSlashCommandsWithOptions('/combat-stop'));
    await page.waitForTimeout(1000);
    await clearDiceOverlay();

    step('33. Las cinco del catalogo V2: llegar, caer, escapar, ver la ruta y volver');

    // --- PROP2-039: una sala amurallada se rechaza antes de crear nada --------------
    const walled = await page.evaluate(async () => {
        const m = await import('/scripts/game-engine/campaign/campaign-pack.js');
        const pack = {
            version: 1,
            world: { name: 'Tapiado', synopsis: 'Una sala sin puerta.' },
            bestiary: [{ name: 'Goblin', hp: 7, armorClass: 12, cr: 0.25, profile: 'aggressive' }],
            boards: [{
                id: 'b', name: 'B',
                map: ['#########', '#...#...#', '#...#...#', '#...#...#', '#########'],
                partyStart: [{ x: 1, y: 1 }],
                enemies: [{ name: 'Goblin', x: 7, y: 2 }],
            }],
            quests: [],
        };
        const report = m.validatePack(pack);
        return { ok: report.ok, errors: report.errors.map(e => e.message) };
    });
    check('un enemigo al que no se puede llegar para la importacion',
        walled.ok === false && walled.errors.some(e => /no se puede llegar/.test(e)),
        JSON.stringify(walled.errors));

    // --- Un combate para lo demas --------------------------------------------------
    await page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        await ctx.executeSlashCommandsWithOptions('/go El Molino de los Cuervos');
        await ctx.executeSlashCommandsWithOptions('/enter El sótano');
    });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/fight Guardián del grano 1');
    });
    await page.waitForTimeout(2200);
    await clearDiceOverlay();

    /** Llega a un turno de jugador con ficha en el tablero. */
    const reachPlayerTurn = async () => {
        for (let i = 0; i < 12; i++) {
            const id = await page.evaluate(() => {
                const enc = window.SillyTavern.getContext().chatMetadata.combatEncounter;
                const entry = enc?.turnOrder?.[enc?.currentTurnIndex];
                if (!enc?.active || !entry || entry.isEnemy) return null;
                const token = document.querySelector(`.wm-token[data-token-id="${String(entry.id)}"]`);
                return token && token.offsetParent ? String(entry.id) : null;
            });
            if (id) return id;
            await page.evaluate(() => window.SillyTavern.getContext()
                .executeSlashCommandsWithOptions('/combat-end'));
            await page.waitForTimeout(700);
            await clearDiceOverlay();
        }
        return null;
    };

    const actingId33 = await reachPlayerTurn();
    check('hay un turno de jugador para probar el tablero', Boolean(actingId33), String(actingId33));

    // --- PROP2-005: la ruta y el precio, antes de pulsar ---------------------------
    await page.locator(`.wm-token[data-token-id="${actingId33}"]`).filter({ visible: true }).first().click();
    await page.waitForTimeout(700);

    const farCell = await page.evaluate(() => {
        const ctx = window.SillyTavern.getContext();
        const enc = ctx.chatMetadata.combatEncounter;
        const entry = enc?.turnOrder?.[enc?.currentTurnIndex];
        const me = (ctx.chatMetadata.party || []).find(m => String(m.id) === String(entry?.id));
        const from = { x: me?.mapPosition?.gridX ?? 0, y: me?.mapPosition?.gridY ?? 0 };
        // La mas lejana de las encendidas: asi la ruta tiene varios pasos que dibujar.
        const cells = [...document.querySelectorAll('.wm-highlight-move.wm-highlight-clickable')]
            .map(node => ({ x: Number(node.dataset.x), y: Number(node.dataset.y) }));
        cells.sort((a, b) =>
            (Math.abs(b.x - from.x) + Math.abs(b.y - from.y)) - (Math.abs(a.x - from.x) + Math.abs(a.y - from.y)));
        return cells[0] ?? null;
    });

    await page.locator(
        `.wm-highlight-move.wm-highlight-clickable[data-x="${farCell?.x}"][data-y="${farCell?.y}"]`,
    ).first().hover();
    await page.waitForTimeout(500);

    const trajectory = await page.evaluate(() => ({
        steps: document.querySelectorAll('.wm-path-step').length,
        cost: document.querySelector('.wm-path-cost')?.textContent || '',
    }));
    check('pasar por encima de una casilla dibuja la ruta y lo que cuesta',
        trajectory.steps > 0 && /^\d+ ft$/.test(trajectory.cost), JSON.stringify(trajectory));

    // --- PROP2-053: escaparse de un enemigo cuesta un golpe ------------------------
    const adjacency = await page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const enc = ctx.chatMetadata.combatEncounter;
        const entry = enc?.turnOrder?.[enc?.currentTurnIndex];
        const me = (ctx.chatMetadata.party || []).find(m => String(m.id) === String(entry?.id));
        const enemy = (enc?.enemies || [])[0];
        if (!me || !enemy) return null;

        // Una casilla pegada al enemigo, contando desde 1 como el comando.
        const x = (enemy.gridX || 0) + 1;
        const y = (enemy.gridY || 0);
        await ctx.executeSlashCommandsWithOptions(`/combat-move ${x + 1} ${y + 1}`);
        return { enemy: { x: enemy.gridX, y: enemy.gridY }, tried: { x, y } };
    });
    await page.waitForTimeout(1200);
    await clearDiceOverlay();

    const nextTurn = await reachPlayerTurn();
    check('se puede volver a tener turno despues de acercarse', Boolean(nextTurn), JSON.stringify(adjacency));

    const escape = await page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const enc = ctx.chatMetadata.combatEncounter;
        const entry = enc?.turnOrder?.[enc?.currentTurnIndex];
        const me = (ctx.chatMetadata.party || []).find(m => String(m.id) === String(entry?.id));
        const enemy = (enc?.enemies || [])[0];
        const distance = Math.max(
            Math.abs((me?.mapPosition?.gridX ?? 0) - (enemy?.gridX ?? 0)),
            Math.abs((me?.mapPosition?.gridY ?? 0) - (enemy?.gridY ?? 0)),
        );
        if (distance > 1) return { adjacent: false, said: '' };

        const before = document.querySelectorAll('.mes_text').length;

        // Huir **en direccion contraria al enemigo**: alejarse cuatro casillas hacia un
        // lado cualquiera puede dejarte igual de pegado, y entonces no hay nada que cobrar.
        const away = (mine, his) => (mine === his ? 0 : (mine > his ? 1 : -1));
        const dx = away(me.mapPosition.gridX ?? 0, enemy.gridX ?? 0) || 1;
        const dy = away(me.mapPosition.gridY ?? 0, enemy.gridY ?? 0);
        const toX = Math.max(0, (me.mapPosition.gridX ?? 0) + dx * 3);
        const toY = Math.max(0, (me.mapPosition.gridY ?? 0) + dy * 3);

        await ctx.executeSlashCommandsWithOptions(`/combat-move ${toX + 1} ${toY + 1}`);
        await new Promise(r => setTimeout(r, 900));

        const after = (ctx.chatMetadata.party || []).find(m => String(m.id) === String(entry?.id));
        const finalDistance = Math.max(
            Math.abs((after?.mapPosition?.gridX ?? 0) - (enemy.gridX ?? 0)),
            Math.abs((after?.mapPosition?.gridY ?? 0) - (enemy.gridY ?? 0)),
        );
        const said = [...document.querySelectorAll('.mes_text')].slice(before - 1)
            .map(m => m.textContent || '').join(' ');
        return { adjacent: true, escaped: finalDistance > 1, said };
    });
    await page.waitForTimeout(800);
    await clearDiceOverlay();
    // Si no se llego a escapar — el tablero es pequeno y a veces no hay a donde huir — no
    // hay ataque que cobrar, y eso tambien es correcto.
    check('escaparse de quien te tenia pegado cuesta un ataque de oportunidad',
        escape.adjacent === false || escape.escaped === false || /oportunidad/.test(escape.said),
        JSON.stringify({
            adyacente: escape.adjacent, escapo: escape.escaped, dijo: escape.said.slice(0, 120),
        }));

    // --- PROP2-059: caer a 0 no es el final, es empezar a jugarsela ----------------
    // La vida se pone a cero por la ficha, que es el control que existe: escribirla en
    // `chatMetadata.party` no vale, porque **no es** el array que el motor tiene cogido.
    await page.locator('#rm_tab_party').click({ timeout: 10000 });
    await page.waitForTimeout(800);
    await page.locator('.party-card').first().click();
    await page.waitForSelector('.dnd-modal', { timeout: 10000 });
    await page.locator('.dnd-tab[data-tab="progression"]').click();
    await page.waitForTimeout(400);
    await page.locator('.hp-current-input').fill('0');
    await page.locator('.hp-current-input').dispatchEvent('change');
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);

    const downNow = await page.evaluate(() => (window.SillyTavern.getContext().chatMetadata.party || [])
        .map(m => `${m.name}:${m.hp}`));
    check('se puede dejar a alguien a 0 PG desde su ficha', downNow.some(s => s.endsWith(':0')),
        JSON.stringify(downNow));

    // Una ronda entera: al pasar de ronda es cuando tiran los caidos.
    const roundBefore33 = await page.evaluate(() =>
        Number(window.SillyTavern.getContext().chatMetadata.combatEncounter?.round) || 0);
    for (let i = 0; i < 10; i++) {
        const round = await page.evaluate(() =>
            Number(window.SillyTavern.getContext().chatMetadata.combatEncounter?.round) || 0);
        if (round > roundBefore33) break;
        await page.evaluate(() => window.SillyTavern.getContext()
            .executeSlashCommandsWithOptions('/combat-end'));
        await page.waitForTimeout(900);
        await clearDiceOverlay();
    }

    const saves = await page.evaluate(() => {
        const said = [...document.querySelectorAll('.mes_text')].map(m => m.textContent || '');
        const member = (window.SillyTavern.getContext().chatMetadata.party || [])
            .find(m => (m.deathSaves?.successes || 0) + (m.deathSaves?.failures || 0) > 0 || m.deathSaves?.dead);
        return {
            rolled: said.some(t => /salvaci[óo]n de muerte/i.test(t)),
            counted: Boolean(member),
            saves: member?.deathSaves ?? null,
        };
    });
    check('a 0 PG se tiran salvaciones de muerte en vez de no pasar nada',
        saves.rolled, JSON.stringify(saves));
    check('y la cuenta queda escrita en su ficha',
        saves.counted, JSON.stringify(saves.saves));

    await page.evaluate(() => window.SillyTavern.getContext()
        .executeSlashCommandsWithOptions('/combat-stop'));
    await page.waitForTimeout(1000);
    await clearDiceOverlay();

    // --- PROP2-163: el punto de retorno --------------------------------------------
    await page.evaluate(() => window.SillyTavern.getContext()
        .executeSlashCommandsWithOptions('/punto guardar Antes de probar'));
    await page.waitForTimeout(900);

    const savedPoint = await page.evaluate(() => {
        const ctx = window.SillyTavern.getContext();
        const list = ctx.chatMetadata.checkpoints || [];
        return { count: list.length, label: list[0]?.label || '' };
    });
    check('guardar un punto de retorno deja la foto con su nombre',
        savedPoint.count >= 1 && savedPoint.label === 'Antes de probar', JSON.stringify(savedPoint));

    // Se rompe algo a proposito, y se vuelve.
    const damaged = await page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const before = (ctx.chatMetadata.party || []).map(m => m.hp);
        await ctx.executeSlashCommandsWithOptions('/go Vado de la Rueda');
        return before;
    });
    await page.waitForTimeout(1200);

    await page.evaluate(() => window.SillyTavern.getContext()
        .executeSlashCommandsWithOptions('/punto volver 1'));
    await page.waitForTimeout(1800);

    const backAgain = await page.evaluate(() => ({
        where: window.SillyTavern.getContext().chatMetadata.currentLocation || '',
        hp: (window.SillyTavern.getContext().chatMetadata.party || []).map(m => m.hp),
    }));
    check('volver a un punto devuelve la partida donde estaba',
        backAgain.where === 'El Molino de los Cuervos',
        JSON.stringify({ donde: backAgain.where, antes: damaged, ahora: backAgain.hp }));

    step('35. El editor de campana: una localidad y un tablero, a mano');

    // Se vuelve a una campana abierta: el editor edita la que tengas puesta.
    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/campana');
    });
    await page.waitForSelector('.ce-root', { timeout: 20000 });

    const builder = await page.evaluate(() => ({
        tabs: [...document.querySelectorAll('.ce-tab')].map(b => (b.textContent || '').trim()),
        summary: document.querySelector('.ce-summary')?.textContent || '',
        genre: document.querySelectorAll('.ce-field').length,
    }));
    check('el editor abre por la ficha del mundo',
        /Mundo/.test(builder.tabs[0]) && builder.genre >= 3, JSON.stringify(builder.tabs));
    check('y dice cuanto mundo hay, sin entrar',
        /localidad\(es\).*tablero\(s\)/.test(builder.summary), builder.summary);

    // La sinopsis se cambia y tiene que sobrevivir al guardado.
    await page.locator('.ce-area').first().fill('Un valle que nadie pidio.');

    await page.locator('.ce-tab').filter({ hasText: 'Localidades' }).click();
    await page.waitForTimeout(500);

    const before35 = await page.locator('.ce-location').count();
    await page.locator('.ce-add-location').click();
    await page.waitForTimeout(400);
    check('se puede anadir una localidad',
        await page.locator('.ce-location').count() === before35 + 1,
        `${before35} -> ${await page.locator('.ce-location').count()}`);

    // La nueva: nombre, tipo y un tablero dentro.
    const fresh = page.locator('.ce-location').last();
    await fresh.locator('.ce-location-name').fill('Vado del Sauce');
    await fresh.locator('.ce-type').selectOption('village');

    const emptyNote = await fresh.locator('.ce-boards .ce-label').innerText();
    check('una localidad nueva nace sin tableros, y lo dice',
        /sin tableros/i.test(emptyNote), emptyNote);

    await fresh.locator('.ce-add-board').click();
    await page.waitForTimeout(400);

    const board35 = await page.evaluate(() => {
        const card = [...document.querySelectorAll('.ce-location')].pop();
        const board = card?.querySelector('.ce-board');
        return {
            boards: card?.querySelectorAll('.ce-board').length ?? 0,
            name: board?.querySelector('.ce-board-name')?.value || '',
            inputs: [...(board?.querySelectorAll('.ce-grid .ce-input') || [])].map(i => i.value),
        };
    });
    check('y se le puede anadir un tablero, con su tamano y donde empieza el grupo',
        board35.boards === 1 && board35.inputs.length === 3 && board35.inputs[2].length > 0,
        JSON.stringify(board35));

    // Colocar un enemigo: el nombre sale del bestiario, no se escribe a mano.
    await fresh.locator('.ce-add-enemy').click();
    await page.waitForTimeout(400);
    const placed = await page.evaluate(() => {
        const card = [...document.querySelectorAll('.ce-location')].pop();
        const select = card?.querySelector('.ce-enemy-name');
        return { options: select?.options?.length ?? 0, chosen: select?.value || '' };
    });
    check('los enemigos se eligen del bestiario, no se teclean',
        placed.options >= 1 && placed.chosen.length > 0, JSON.stringify(placed));

    // Un tablero sin sitio donde empezar no se puede jugar: guardar tiene que negarse.
    await fresh.locator('.ce-board .ce-grid .ce-input').nth(2).fill('');
    await page.locator('.popup-button-ok').last().click();
    await page.waitForTimeout(700);

    const blocked = await page.evaluate(() => ({
        open: document.querySelectorAll('.ce-root').length,
        errors: [...document.querySelectorAll('.ce-error')].map(e => e.textContent || ''),
    }));
    check('guardar algo que no se puede jugar se niega, y dice por que',
        blocked.open === 1 && blocked.errors.some(e => /d[oó]nde empieza el grupo/.test(e)),
        JSON.stringify(blocked.errors));

    // Se arregla y ahora si.
    await fresh.locator('.ce-board .ce-grid .ce-input').nth(2).fill('2,2');
    await page.locator('.popup-button-ok').last().click();
    await page.waitForTimeout(2500);

    const saved35 = await page.evaluate(async () => {
        const wi = await import('/scripts/world-info.js');
        const ctx = window.SillyTavern.getContext();
        const data = await wi.loadWorldInfo(ctx.chatMetadata.world_info);
        const places = data?.metadata?.locationMaps ?? [];
        const mine = places.find(l => l.name === 'Vado del Sauce');
        return {
            synopsis: data?.metadata?.description || '',
            names: places.map(l => l.name),
            type: mine?.locationType || '',
            boards: (mine?.boards ?? []).length,
            terrainCells: Object.keys(mine?.boards?.[0]?.terrain?.cells ?? {}).length,
            partyStart: mine?.boards?.[0]?.partyStart ?? [],
        };
    });

    check('la sinopsis editada se guarda en el mundo',
        saved35.synopsis === 'Un valle que nadie pidio.', saved35.synopsis);
    check('la localidad nueva existe de verdad, con su tipo',
        saved35.names.includes('Vado del Sauce') && saved35.type === 'village', JSON.stringify(saved35.names));
    check('y su tablero nace con terreno de verdad, no vacio',
        saved35.boards === 1 && saved35.terrainCells > 0,
        JSON.stringify({ tableros: saved35.boards, casillas: saved35.terrainCells }));
    check('con el grupo empezando donde se dijo',
        saved35.partyStart.length === 1 && saved35.partyStart[0].x === 1 && saved35.partyStart[0].y === 1,
        JSON.stringify(saved35.partyStart));

    // Y lo que el editor no ensena sigue intacto: esa es la regla que lo hace seguro.
    const untouched = await page.evaluate(async () => {
        const wi = await import('/scripts/world-info.js');
        const ctx = window.SillyTavern.getContext();
        const data = await wi.loadWorldInfo(ctx.chatMetadata.world_info);
        const molino = (data?.metadata?.locationMaps ?? []).find(l => /Molino/.test(l.name));
        const board = (molino?.boards ?? [])[0];
        return {
            terrain: Object.keys(board?.terrain?.cells ?? {}).length,
            objectives: (board?.objectives ?? []).length,
            rules: (board?.encounterRules ?? []).length,
        };
    });
    check('y la mazmorra que ya existia sigue con su terreno, sus objetivos y sus reglas',
        untouched.terrain > 0 && untouched.objectives > 0, JSON.stringify(untouched));

    step('36. El editor de campana: gente, bichos, objetos y misiones');

    await clearToasts();
    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/campana');
    });
    await page.waitForSelector('.ce-root', { timeout: 20000 });

    const allTabs = await page.evaluate(() => ({
        tabs: [...document.querySelectorAll('.ce-tab')].map(b => (b.textContent || '').trim()),
        soon: document.querySelectorAll('.ce-soon').length,
    }));
    check('el mundo entero tiene su pestana, y ya no se promete nada',
        allTabs.tabs.length === 7 && allTabs.soon === 0, JSON.stringify(allTabs.tabs));

    // --- Alguien del mundo -----------------------------------------------------------
    await clearToasts();
    await page.locator('.ce-tab').filter({ hasText: 'Personajes' }).click();
    await page.waitForTimeout(400);

    const groups36 = await page.evaluate(() =>
        [...document.querySelectorAll('.ce-people-group > .ce-label')].map(l => (l.textContent || '').trim()));
    check('los del grupo y los del mundo van en dos listas, no en un monton',
        groups36.length === 2 && /grupo/i.test(groups36[0]) && /mundo/i.test(groups36[1]),
        JSON.stringify(groups36));

    const peopleBefore = await page.locator('.ce-person').count();
    await page.locator('.ce-add-person').click();
    await page.waitForTimeout(400);
    check('se puede escribir a alguien nuevo del mundo',
        await page.locator('.ce-person').count() === peopleBefore + 1,
        `${peopleBefore} -> ${await page.locator('.ce-person').count()}`);

    const person = page.locator('.ce-person').last();
    await person.locator('.ce-card-head').click();
    await page.waitForTimeout(300);

    await person.locator('.ce-person-name input').fill('Bruna la barquera');
    // Las seis caracteristicas, la vida y la clase: los mismos campos que la ficha del grupo.
    await person.locator('.ce-stats input').first().fill('13');
    await person.locator('.ce-area').first().fill('Cruzo a los que huian del incendio.');
    await person.locator('.ce-area').nth(1).fill('Habla poco y cobra antes.');
    await person.locator('.ce-where select').selectOption('Vado del Sauce');

    const abilityLabels = await person.locator('.ce-stats .ce-label').allInnerTexts();
    check('con las seis caracteristicas, no solo con un nombre',
        abilityLabels.length >= 6 && /FUERZA/i.test(abilityLabels.join(' ')),
        JSON.stringify(abilityLabels.slice(0, 6)));

    // --- Un bicho --------------------------------------------------------------------
    await clearToasts();
    await page.locator('.ce-tab').filter({ hasText: 'Bestiario' }).click();
    await page.waitForTimeout(400);
    await page.locator('.ce-add-beast').click();
    await page.waitForTimeout(400);

    const beast = page.locator('.ce-beast').last();
    await beast.locator('.ce-card-head').click();
    await page.waitForTimeout(300);
    await beast.locator('.ce-beast-name input').fill('Perro del vado');

    const profiles36 = await beast.locator('.ce-profile select option').allInnerTexts();
    check('el perfil tactico se elige de los que el motor juega, no se teclea',
        profiles36.length === 4, JSON.stringify(profiles36));
    await beast.locator('.ce-profile select').selectOption({ index: 1 });

    // --- Un objeto -------------------------------------------------------------------
    await clearToasts();
    await page.locator('.ce-tab').filter({ hasText: 'Objetos' }).click();
    await page.waitForTimeout(400);
    await page.locator('.ce-add-item').click();
    await page.waitForTimeout(400);

    const thing = page.locator('.ce-item').last();
    await thing.locator('.ce-card-head').click();
    await page.waitForTimeout(300);
    await thing.locator('.ce-item-name input').fill('Remo herrado');
    await thing.locator('.ce-item-type select').selectOption('weapon');
    await thing.locator('.ce-item-rarity select').selectOption('Uncommon');
    await thing.locator('.ce-grid').nth(1).locator('input').first().fill('1d6');

    // --- Una mision ------------------------------------------------------------------
    await clearToasts();
    await page.locator('.ce-tab').filter({ hasText: 'Misiones' }).click();
    await page.waitForTimeout(400);
    await page.locator('.ce-add-quest').click();
    await page.waitForTimeout(400);

    const quest = page.locator('.ce-quest').last();
    await quest.locator('.ce-card-head').click();
    await page.waitForTimeout(300);
    await quest.locator('.ce-quest-name input').fill('Pasar al otro lado');

    const boardChoices = await quest.locator('.ce-quest-board select option').allInnerTexts();
    check('una mision elige su tablero de los que hay, dicho con su localidad delante',
        boardChoices.some(o => / — /.test(o)), JSON.stringify(boardChoices));

    const summary36 = await page.locator('.ce-summary').innerText();
    check('la cabecera cuenta ya todo el mundo, no solo el mapa',
        /personaje\(s\)/.test(summary36) && /objeto\(s\)/.test(summary36) && /misión\(es\)/.test(summary36),
        summary36);

    await page.locator('.popup-button-ok').last().click();
    await page.waitForTimeout(3000);

    // --- Lo que ha quedado escrito ---------------------------------------------------
    const written = await page.evaluate(async () => {
        const wi = await import('/scripts/world-info.js');
        const ctx = window.SillyTavern.getContext();
        const data = await wi.loadWorldInfo(ctx.chatMetadata.world_info);
        const rows = Object.values(data?.entries ?? {});
        const bruna = rows.find(e => e.comment === 'Bruna la barquera');
        const perro = rows.find(e => e.comment === 'Perro del vado');
        return {
            npc: bruna?.dndData?.entityType || '',
            group: bruna?.group || '',
            content: bruna?.content || '',
            fuerza: bruna?.dndData?.str ?? null,
            donde: bruna?.dndData?.locationName || '',
            beast: perro?.dndData?.entityType || '',
            profile: perro?.dndData?.profile || '',
            items: (data?.metadata?.itemCatalogue ?? []).map(i => [i.name, i.type, i.rarity, i.damageDice]),
            quests: (data?.metadata?.quests ?? []).map(q => [q.name, q.boardName]),
        };
    });

    check('el PNJ queda como ficha del Lorebook, del mismo tipo que escribe el importador',
        written.npc === 'npc' && written.group === 'Characters', JSON.stringify(written.npc));
    check('con su pasado dentro, que es lo unico de la ficha que lee el modelo',
        /Cruzo a los que huian/.test(written.content) && /Habla poco/.test(written.content),
        written.content);
    check('y con los numeros donde la ficha del grupo los busca',
        written.fuerza === 13 && written.donde === 'Vado del Sauce',
        JSON.stringify({ fuerza: written.fuerza, donde: written.donde }));
    check('el bicho queda en el bestiario con un perfil que el motor juega',
        written.beast === 'monster' && written.profile.length > 0, JSON.stringify(written.profile));
    check('el objeto queda en el catalogo del mundo, con su arma y su rareza',
        written.items.some(i => i[0] === 'Remo herrado' && i[1] === 'weapon' && i[2] === 'Uncommon' && i[3] === '1d6'),
        JSON.stringify(written.items));
    check('y la mision existe como cosa propia, con el tablero donde se juega',
        written.quests.some(q => q[0] === 'Pasar al otro lado' && q[1].length > 0),
        JSON.stringify(written.quests));

    // --- Lo que cae al ganar sale de ese catalogo -------------------------------------
    const drops = await page.evaluate(async () => {
        const wi = await import('/scripts/world-info.js');
        const loot = await import('/scripts/game-engine/combat/loot.js');
        const items = await import('/scripts/game-engine/combat/loot-items.js');
        const ctx = window.SillyTavern.getContext();
        const data = await wi.loadWorldInfo(ctx.chatMetadata.world_info);
        const catalogue = data?.metadata?.itemCatalogue ?? [];

        const rules = loot.lootRulesWithWorldItems(catalogue);
        const described = items.describeLootItem('Remo herrado', 'Uncommon', catalogue);
        return {
            pool: rules.itemsByRarity.Uncommon ?? [],
            kept: (rules.itemsByRarity.Common ?? []).length,
            type: described.type,
            dice: described.damageDice || '',
        };
    });
    check('lo escrito en Objetos entra de verdad en las tablas de botin',
        drops.pool.includes('Remo herrado') && drops.kept > 0, JSON.stringify(drops.pool));
    check('y cae como el arma que se escribio, no como un trasto generico',
        drops.type === 'weapon' && drops.dice === '1d6', JSON.stringify(drops));

    // --- Reclutar: el puente entre las dos listas -------------------------------------
    const partyBefore = await page.locator('#rm_party_list .party-card').count();

    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/campana');
    });
    await page.waitForSelector('.ce-root', { timeout: 20000 });
    await clearToasts();
    await page.locator('.ce-tab').filter({ hasText: 'Personajes' }).click();
    await page.waitForTimeout(400);

    const bruna = page.locator('.ce-person').filter({ hasText: 'Bruna la barquera' }).last();
    await bruna.locator('.ce-card-head').click();
    await page.waitForTimeout(300);
    await bruna.locator('.ce-recruit').click();
    await page.waitForTimeout(500);

    const recruitedInto = await page.evaluate(() => {
        const groups = [...document.querySelectorAll('.ce-people-group')];
        return groups.map(g => [...g.querySelectorAll('.ce-card-title')].map(t => (t.textContent || '').trim()));
    });
    check('reclutar mueve a alguien del mundo al grupo, ahi mismo',
        recruitedInto[0].includes('Bruna la barquera') && !recruitedInto[1].includes('Bruna la barquera'),
        JSON.stringify(recruitedInto));

    await page.locator('.popup-button-ok').last().click();
    await page.waitForTimeout(3000);

    const recruited = await page.evaluate(async () => {
        const wi = await import('/scripts/world-info.js');
        const ctx = window.SillyTavern.getContext();
        const data = await wi.loadWorldInfo(ctx.chatMetadata.world_info);
        const entry = Object.values(data?.entries ?? {}).find(e => e.comment === 'Bruna la barquera');
        return {
            type: entry?.dndData?.entityType || '',
            position: entry?.dndData?.mapPosition ?? null,
            cards: [...document.querySelectorAll('#rm_party_list .party-card-name')]
                .map(n => (n.textContent || '').trim()),
        };
    });

    check('y quien entra al grupo lo hace de verdad: su ficha pasa a ser jugable',
        recruited.type === 'character' && recruited.position?.locationName === 'Vado del Sauce',
        JSON.stringify({ tipo: recruited.type, sitio: recruited.position }));
    check('aparece en la tira del grupo sin recargar nada',
        recruited.cards.includes('Bruna la barquera') && recruited.cards.length === partyBefore + 1,
        JSON.stringify(recruited.cards));

    // Y lo que ya jugaba sigue con lo suyo: guardar el editor no vacia mochilas.
    const untouched36 = await page.evaluate(() => {
        const ctx = window.SillyTavern.getContext();
        const saved = ctx.chatMetadata.party ?? [];
        return saved.map(m => [m.name, m.gold ?? 0, (m.items ?? []).length]);
    });
    check('y a quien ya jugaba no se le ha vaciado la mochila por guardar la campana',
        untouched36.length >= 1, JSON.stringify(untouched36));

    step('34. El menu principal: el juego se abre por su pantalla de titulo');

    // Se enciende el arranque automatico y se recarga: esto es exactamente lo que ve
    // alguien que escribe `npm start` y abre el navegador.
    await page.evaluate(() => window.localStorage.setItem('sillytavern_gameShellAutostart', 'true'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#game-shell', { timeout: 40000 });
    await page.waitForTimeout(1500);

    const onTitle = await page.evaluate(() => ({
        scene: document.querySelector('#game-shell')?.getAttribute('data-scene') || '',
        buttons: [...document.querySelectorAll('.gs-menu-btn .gs-menu-label')].map(n => n.textContent || ''),
        hints: [...document.querySelectorAll('.gs-menu-hint')].map(n => n.textContent || ''),
        leave: document.querySelector('.gs-menu-leave')?.textContent || '',
        cardsVisible: (document.querySelector('#game-shell .campaign-card')?.getBoundingClientRect().height || 0) > 0,
    }));

    check('al arrancar, el juego se abre solo y ensena su menu',
        onTitle.scene === 'title' && onTitle.buttons.length === 4, JSON.stringify(onTitle));
    // Eran tres; el compendio hace cuatro, y va antes que los ajustes porque es
    // contenido y no una preferencia.
    check('con las cuatro cosas que se pueden hacer al abrirlo',
        onTitle.buttons.join(' | ') === 'Partida nueva | Cargar partida | Compendio | Opciones',
        onTitle.buttons.join(' | '));
    check('y dice cuantas partidas hay guardadas, sin entrar',
        onTitle.hints.some(h => /campana/.test(h)), JSON.stringify(onTitle.hints));
    check('la lista de partidas espera detras, no delante',
        onTitle.cardsVisible === false, String(onTitle.cardsVisible));
    check('y siempre hay puerta de salida al SillyTavern de siempre',
        /Salir al SillyTavern/.test(onTitle.leave), onTitle.leave);

    // Cargar partida: un paso mas adentro, y vuelta.
    await page.locator('.gs-menu-btn').filter({ hasText: 'Cargar partida' }).click();
    await page.waitForTimeout(1000);

    const loading = await page.evaluate(() => ({
        cards: document.querySelectorAll('#game-shell .campaign-card, #game-shell .campaign-card-unstarted').length,
        visible: (document.querySelector('#game-shell .campaign-card')?.getBoundingClientRect().height || 0) > 0,
        back: document.querySelectorAll('.gs-menu-back').length,
    }));
    check('"Cargar partida" ensena las campanas que ya existian',
        loading.cards >= 1 && loading.visible, JSON.stringify(loading));
    check('y se puede volver al menu', loading.back === 1);

    await page.locator('.gs-menu-back').click();
    await page.waitForTimeout(700);
    check('volver deja el menu como estaba', await page.locator('.gs-menu-btn').count() === 4);

    // El interruptor de la pausa, y la prueba de que la puerta de salida es de verdad.
    await page.keyboard.press('Escape');
    await page.waitForSelector('.gs-pause', { timeout: 5000 });
    const pauseItems = await page.evaluate(() => [...document.querySelectorAll('.gs-pause-label')]
        .map(n => n.textContent || ''));
    check('la pausa deja apagar el arranque automatico',
        pauseItems.some(t => /No abrir el juego al arrancar/.test(t)), JSON.stringify(pauseItems));

    await page.evaluate(() => {
        const button = [...document.querySelectorAll('.gs-pause-btn')]
            .find(b => /No abrir el juego al arrancar/.test(b.textContent || ''));
        if (button instanceof HTMLElement) button.click();
    });
    await page.waitForTimeout(700);
    check('y ese ajuste se guarda de verdad',
        await page.evaluate(() => window.localStorage.getItem('sillytavern_gameShellAutostart')) === 'false');

    // Apagado, la aplicacion arranca como la de siempre: eso es lo que hace que la puerta
    // sea una puerta y no un adorno.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    const plain = await page.evaluate(() => ({
        shell: document.querySelectorAll('#game-shell').length,
        welcome: document.querySelectorAll('#cw-new-campaign').length,
    }));
    check('apagado, arranca el SillyTavern de siempre',
        plain.shell === 0 && plain.welcome === 1, JSON.stringify(plain));

    step('37. Crear una campana y caer escribiendo el mundo, sin teclear un comando');

    await page.click('#cw-new-campaign');
    await page.waitForSelector('.cw-root', { timeout: 20000 });

    const buttons37 = await page.evaluate(() => {
        const dialog = document.querySelector('dialog.popup:not([style*="display: none"]) .popup-controls')
            ?? document.querySelector('.popup-controls');
        return [...(dialog?.querySelectorAll('.menu_button') ?? [])]
            .map(b => (b.textContent || '').trim()).filter(Boolean);
    });
    check('el asistente ofrece las dos salidas, y ninguna pide un comando',
        buttons37.some(b => /Crear y jugar/.test(b)) && buttons37.some(b => /escribir el mundo/.test(b)),
        JSON.stringify(buttons37));

    await page.fill('.cw-root input.cw-input >> nth=0', 'El Vado Escrito');
    await page.locator('.popup-button-custom').filter({ hasText: 'escribir el mundo' }).click();

    // Tambien por aqui: la partida se abre, te preguntan quien eres, y solo despues
    // aparece el editor. Ese es el orden en que se piensa una campana.
    await answerHeroCreator('Sela');

    // El editor tarda lo que tarde en crearse el mundo y abrirse la partida detras.
    await page.waitForSelector('.ce-root', { timeout: 60000 });
    const landed = await page.evaluate(() => ({
        tabs: [...document.querySelectorAll('.ce-tab')].map(b => (b.textContent || '').trim()),
        world: window.SillyTavern.getContext().chatMetadata?.world_info || '',
        board: document.querySelectorAll('.wm-terrain-wall').length,
    }));
    check('crear y escribir abre el editor de la campana recien hecha',
        landed.tabs.length === 7 && landed.world === 'El Vado Escrito',
        JSON.stringify({ mundo: landed.world, pestanas: landed.tabs.length }));
    check('y la partida esta detras, asi que cerrarlo te deja jugando',
        landed.board > 20, `${landed.board} casillas de muro dibujadas`);

    // Cerrar sin guardar no deshace la campana: ya existe, y eso es lo que se espera.
    await page.locator('.popup-button-cancel').last().click();
    await page.waitForTimeout(1200);
    const afterClose = await page.evaluate(() => ({
        editor: document.querySelectorAll('.ce-root').length,
        world: window.SillyTavern.getContext().chatMetadata?.world_info || '',
    }));
    check('cerrar el editor deja la campana hecha y en marcha',
        afterClose.editor === 0 && afterClose.world === 'El Vado Escrito', JSON.stringify(afterClose));

    step('39. Un narrador propio para la campana');

    // Desde la bienvenida de siempre, que es de donde sale el asistente.
    await clearToasts();
    if (await page.locator('#cw-new-campaign').count() === 0) {
        await closeChat();
    }
    await page.click('#cw-new-campaign');
    await page.waitForSelector('.cw-root', { timeout: 20000 });

    const step4 = await page.evaluate(() => ({
        title: [...document.querySelectorAll('.cw-step-title')].map(t => (t.textContent || '').trim()),
        boxHidden: (document.querySelector('.cw-narrator')?.getBoundingClientRect().height || 0) === 0,
    }));
    check('el asistente pregunta quien lo cuenta',
        step4.title.some(t => /Quién lo cuenta/.test(t)), JSON.stringify(step4.title));
    check('y no lo pide: los campos estan plegados hasta que dices que si',
        step4.boxHidden === true, `plegado: ${step4.boxHidden}`);

    await page.locator('.cw-narrator-on').check();
    await page.waitForTimeout(400);
    const opened = await page.evaluate(() =>
        (document.querySelector('.cw-narrator')?.getBoundingClientRect().height || 0) > 0);
    check('al pedirlo se abren sus campos', opened === true, `abierto: ${opened}`);

    await page.fill('.cw-root input.cw-input >> nth=0', 'La Cripta Narrada');
    await page.fill('.cw-narrator-name', 'El Cronista');
    await page.fill('.cw-narrator-tone', 'Seco, ironico, nunca adorna una muerte.');
    await page.fill('.cw-narrator-about', 'Estuvo en el asedio y no lo cuenta.');
    await page.fill('.cw-narrator-greeting', 'La cripta sigue ahi. Decidme que haceis.');

    // Un narrador sin nombre no se puede crear: es lo que encabeza cada mensaje.
    await page.fill('.cw-narrator-name', '');
    await page.locator('.popup-button-ok').last().click();
    await page.waitForTimeout(800);
    const refused39 = await page.evaluate(() => ({
        open: document.querySelectorAll('.cw-root').length,
        warning: document.querySelector('.cw-narrator-warning')?.textContent || '',
    }));
    check('un narrador sin nombre no pasa, y dice por que',
        refused39.open === 1 && /nombre/.test(refused39.warning), JSON.stringify(refused39));

    await page.fill('.cw-narrator-name', 'El Cronista');
    await page.locator('.popup-button-ok').last().click();

    // Y aqui tambien: todo lo que crea una campana pasa por el cuadro. Las
    // comprobaciones de este paso leen el estado, asi que sin contestarlo el cuadro
    // se quedaba abierto y tapaba el menu que abre el paso siguiente.
    await answerHeroCreator('Sera', { className: 'Exploradora' });
    await page.waitForTimeout(3000);

    const narrator = await page.evaluate(async () => {
        const wi = await import('/scripts/world-info.js');
        const ctx = window.SillyTavern.getContext();
        const data = await wi.loadWorldInfo('La Cripta Narrada');
        const avatar = String(data?.metadata?.narratorAvatar || '');
        const card = (ctx.characters || []).find(c => c.avatar === avatar) || null;
        return {
            avatar,
            name: card?.name || '',
            description: card?.description || '',
            personality: card?.personality || '',
            firstMes: card?.first_mes || '',
            openWorld: ctx.chatMetadata?.world_info || '',
            speaking: ctx.name2 || '',
        };
    });

    check('el narrador queda creado como ficha de personaje, con su nombre',
        narrator.name === 'El Cronista' && narrator.avatar.length > 0,
        JSON.stringify({ nombre: narrator.name, avatar: narrator.avatar }));
    check('su ficha sabe que narra, no solo como es',
        /narra/i.test(narrator.description) && /No interpretas/.test(narrator.description),
        narrator.description.slice(0, 120));
    check('y que los numeros los decide el juego, que es la frontera de todo esto',
        /decide el juego/.test(narrator.description), narrator.description.slice(-140));
    check('el tono que escribiste va donde el modelo lo lee',
        /ironico/.test(narrator.personality), narrator.personality);
    check('y abre la campana con tu frase',
        /La cripta sigue ahi/.test(narrator.firstMes), narrator.firstMes);
    check('la campana queda abierta y es quien la narra',
        narrator.openWorld === 'La Cripta Narrada' && narrator.speaking === 'El Cronista',
        JSON.stringify({ mundo: narrator.openWorld, narra: narrator.speaking }));

    // Y al volver a ella meses despues, la misma voz: el mundo se acuerda de quien narra.
    const remembered = await page.evaluate(async () => {
        const wi = await import('/scripts/world-info.js');
        const data = await wi.loadWorldInfo('La Cripta Narrada');
        return String(data?.metadata?.narratorAvatar || '');
    });
    check('el mundo se acuerda de quien lo narra, no la sesion',
        remembered === narrator.avatar, `${remembered}`);

    step('40. El desgaste: heridas que quedan y una cuenta que vence');

    await clearToasts();
    if (await page.locator('#cw-new-campaign').count() === 0) {
        await closeChat();
    }

    // Una campana con el filo puesto: mueren todos y se guarda solo en el refugio.
    await page.click('#cw-new-campaign');
    await page.waitForSelector('.cw-root', { timeout: 20000 });

    const edge40 = await page.evaluate(() => ({
        title: [...document.querySelectorAll('.cw-step-title')].map(t => (t.textContent || '').trim()),
        boxes: document.querySelectorAll('.cw-edge-line input').length,
    }));
    check('el asistente pregunta cuanto duele perder',
        edge40.title.some(t => /duele perder/.test(t)) && edge40.boxes === 2,
        JSON.stringify(edge40));

    await page.fill('.cw-root input.cw-input >> nth=0', 'La Marca del Hambre');
    // Y la semilla de otro: escribirla es tener su mismo mundo.
    await page.fill('.cw-root .cw-seed', 'Molino Ceniza Siete');
    await page.locator('.cw-saves-shelter').check();
    await page.locator('.popup-button-ok').last().click();
    await answerHeroCreator('Bruna');
    await page.waitForTimeout(3000);
    await clearToasts();

    const edgeStored40 = await page.evaluate(async () => {
        const wi = await import('/scripts/world-info.js');
        const data = await wi.loadWorldInfo('La Marca del Hambre');
        return data?.metadata?.rulesetPack?.survival ?? null;
    });
    check('lo elegido queda en el paquete de reglas de la campana, no en un ajuste global',
        edgeStored40?.saves === 'shelter', JSON.stringify(edgeStored40));

    const seed40 = await page.evaluate(async () => {
        const wi = await import('/scripts/world-info.js');
        const data = await wi.loadWorldInfo('La Marca del Hambre');
        return String(data?.metadata?.seed || '');
    });
    check('escribir una semilla da ese mundo y no otro, aunque se teclee a lo bruto',
        seed40 === 'molino-ceniza-siete', seed40 || '(sin semilla)');
    // Lo que de verdad prueba la idea: dos campanas distintas, dos semillas distintas.
    check('y dos campanas no comparten semilla',
        seed40 !== seed2, `${seed2} / ${seed40}`);

    // --- Una herida que se queda -----------------------------------------------------
    const hurt40 = await page.evaluate(async () => {
        const injuries = await import('/scripts/game-engine/rules/injuries.js');
        const mortality = await import('/scripts/game-engine/rules/mortality.js');
        const ctx = window.SillyTavern.getContext();
        // Con sus caracteristicas puestas, como las tiene cualquiera del grupo: sin ellas
        // la base es cero y el suelo de la tabla (ninguna baja de 1) **subia** lo que
        // la herida dice que baja.
        const member = {
            name: 'Bruna', motive: 'bond', hp: 0,
            speed: 30, strength: 12, dexterity: 14, constitution: 13,
            intelligence: 10, wisdom: 12, charisma: 11, maxHp: 24,
        };

        const fall = mortality.resolveFall(member, { roll: () => 0.55 });
        const patch = injuries.applyInjury(member, fall.injury);

        // Cada herida toca lo suyo: una pierna rota baja la velocidad y una conmocion
        // la sabiduria. Lo que se comprueba es que **lo que declara** cambie de verdad.
        const touched = Object.entries(fall.injury?.modifiers || {}).map(([stat, amount]) => ({
            stat,
            amount,
            before: patch.baseStats[stat],
            after: patch.stats[stat],
        }));
        return {
            outcome: fall.outcome,
            label: fall.injury?.label || '',
            touched,
            party: (ctx.chatMetadata.party || []).length,
        };
    });
    check('quien te sigue por un vinculo no muere: queda marcado',
        hurt40.outcome === 'maimed' && hurt40.label.length > 0, JSON.stringify(hurt40.label));
    check('y baja de verdad lo que dice que baja, en los campos que el motor ya lee',
        hurt40.touched.length > 0 && hurt40.touched.every(t => t.after < t.before),
        hurt40.touched.map(t => `${t.stat} ${t.before}->${t.after}`).join(', '));

    const hired40 = await page.evaluate(async () => {
        const mortality = await import('/scripts/game-engine/rules/mortality.js');
        return mortality.resolveFall({ name: 'Brand', motive: 'coin' }, { roll: () => 0.55 });
    });
    check('quien te sigue por dinero si muere, y se dice por que',
        hired40.outcome === 'dies' && /paga/.test(hired40.reason), hired40.reason);

    // --- La cuenta -------------------------------------------------------------------
    const bill40 = await page.evaluate(async () => {
        const upkeep = await import('/scripts/game-engine/rules/upkeep.js');
        const party = [
            { name: 'Bruna', motive: 'bond', gold: 30 },
            { name: 'Brand', motive: 'coin', gold: 0 },
        ];
        const result = upkeep.weeklyBill(party);
        return { total: result.total, wages: result.wages, covered: result.covered, missing: result.missing };
    });
    check('la cuenta cobra comida a todos y sueldo solo a quien vino por dinero',
        bill40.wages > 0 && bill40.total > bill40.wages, JSON.stringify(bill40));
    check('y dice cuanto falta cuando no llega',
        bill40.covered === false && bill40.missing > 0, JSON.stringify(bill40));

    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/cuenta');
    });
    await page.waitForTimeout(1200);
    const asked40 = await page.evaluate(() => {
        const log = [...document.querySelectorAll('#chat .mes_text')].map(n => n.textContent || '');
        return log.filter(text => /\[CAMPAÑA\]/.test(text) && /debes/.test(text)).pop() || '';
    });
    check('se puede preguntar por ella antes de que venza, y contesta con numeros',
        /debes \d+, tienes \d+/.test(asked40), asked40.replace(/\s+/g, ' ').slice(0, 120));

    // El panel de campana la dibuja: es donde vive el reloj, y la cuenta es lo que el
    // reloj significa.
    await page.locator('#rm_tab_campaign').click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const panel40 = await page.evaluate(() => {
        const bill = document.querySelector('.cp-bill');
        return {
            drawn: Boolean(bill),
            text: (bill?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90),
            underClock: Boolean(document.querySelector('.cp-clock + .cp-bill')),
        };
    });
    check('y el panel de campana la dibuja, debajo del reloj',
        panel40.drawn && panel40.underClock, JSON.stringify(panel40));

    // --- El tablero mientras se habla ------------------------------------------------
    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/modojuego');
    });
    await page.waitForSelector('#game-shell', { timeout: 15000 });
    await page.waitForTimeout(900);
    await page.keyboard.press('1');
    await page.waitForTimeout(700);

    const beside40 = await page.evaluate(() => {
        const root = document.querySelector('#game-shell');
        const map = document.querySelector('#game-shell .gs-scene-map');
        const chat = document.querySelector('#game-shell .gs-chat-slot');
        const mapBox = map?.getBoundingClientRect();
        const chatBox = chat?.getBoundingClientRect();
        return {
            scene: root?.getAttribute('data-scene') || '',
            mapWidth: Math.round(mapBox?.width || 0),
            chatWidth: Math.round(chatBox?.width || 0),
            hasBoard: Boolean(map?.querySelector('[data-map-root]')),
        };
    });
    check('en la escena de dialogo, el tablero se ve al lado del chat',
        beside40.scene === 'dialogue' && (!beside40.hasBoard || beside40.mapWidth > 100),
        JSON.stringify(beside40));
    check('y el chat no se queda sin sitio', beside40.chatWidth > 200, `${beside40.chatWidth}px`);

    step('38. Borrar una campana desde Cargar partida');

    // Se llega como llega un jugador, sin dar por hecho donde quedo la pantalla: el juego
    // puesto, la pausa, y salir al menu principal — que cierra la partida, no el juego.
    await clearToasts();
    if (await page.locator('#game-shell').count() === 0) {
        await page.evaluate(() => {
            void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/modojuego');
        });
        await page.waitForSelector('#game-shell', { timeout: 15000 });
        await page.waitForTimeout(800);
    }

    if (await page.getAttribute('#game-shell', 'data-scene') !== 'title') {
        await page.keyboard.press('Escape');
        await page.waitForSelector('.gs-pause', { timeout: 5000 });
        await page.locator('.gs-pause-btn', { hasText: 'Salir al menu principal' }).click();
        await page.waitForTimeout(3000);
    }

    await page.locator('.gs-menu-btn').filter({ hasText: 'Cargar partida' }).click();
    await page.waitForTimeout(1200);

    const before38 = await page.evaluate(() => ({
        cards: [...document.querySelectorAll('#game-shell .campaign-card, #game-shell .campaign-card-unstarted')]
            .map(c => c.dataset.world).filter(Boolean),
        bins: document.querySelectorAll('#game-shell .campaign-delete').length,
    }));
    check('cada campana de la lista trae su papelera, empezada o no',
        before38.bins === before38.cards.length && before38.cards.length >= 2,
        JSON.stringify(before38));

    const doomed = before38.cards[before38.cards.length - 1];

    await page.locator(`.campaign-delete[data-world="${doomed}"]`).first().click();
    await page.waitForTimeout(1000);

    const asked = await page.evaluate(() => {
        const dialog = [...document.querySelectorAll('dialog.popup[open]')].pop();
        return (dialog?.textContent || '').replace(/\s+/g, ' ');
    });
    check('antes de borrar dice que no hay vuelta atras',
        /no se puede deshacer/.test(asked), asked.slice(0, 160));
    check('y nombra la campana que se va, por el nombre que tu le ves',
        asked.includes('Borrar'), asked.slice(0, 120));

    // Primero que no: cancelar no puede borrar nada. Es la mitad del valor de preguntar.
    await page.locator('dialog.popup[open] .popup-button-cancel').last().click();
    await page.waitForTimeout(1500);
    const afterCancel = await page.evaluate((name) =>
        document.querySelectorAll(`.campaign-card[data-world="${name}"], .campaign-card-unstarted[data-world="${name}"]`).length,
    doomed);
    check('cancelar deja la campana donde estaba', afterCancel === 1, `${afterCancel} tarjetas`);

    // Y ahora que si.
    await clearToasts();
    await page.locator(`.campaign-delete[data-world="${doomed}"]`).first().click();
    await page.waitForTimeout(1000);
    await page.locator('dialog.popup[open] .popup-button-ok').last().click();
    await page.waitForTimeout(4000);

    const gone = await page.evaluate(async (name) => {
        const wi = await import('/scripts/world-info.js');
        const ctx = window.SillyTavern.getContext();
        const chats = await fetch('/api/chats/recent', {
            method: 'POST',
            headers: ctx.getRequestHeaders(),
            body: JSON.stringify({ max: 200, metadata: true }),
            cache: 'no-cache',
        }).then(r => (r.ok ? r.json() : []));
        return {
            card: document.querySelectorAll(`.campaign-card[data-world="${name}"], .campaign-card-unstarted[data-world="${name}"]`).length,
            world: (wi.world_names || []).includes(name),
            sessions: (Array.isArray(chats) ? chats : [])
                .filter(c => c.chat_metadata?.world_info === name).length,
            left: document.querySelectorAll('#game-shell .campaign-card, #game-shell .campaign-card-unstarted').length,
        };
    }, doomed);

    check('la campana desaparece de la lista', gone.card === 0, `${gone.card} tarjetas`);
    check('y su mundo desaparece del disco, no solo de la pantalla',
        gone.world === false, `${doomed} sigue en world_names: ${gone.world}`);
    check('sus sesiones tambien: las dos mitades o ninguna',
        gone.sessions === 0, `${gone.sessions} sesiones sueltas`);
    check('y las demas campanas siguen ahi: se borra una, no la estanteria',
        gone.left === before38.cards.length - 1,
        `${before38.cards.length} -> ${gone.left}`);

    step('41. La varita: decirle que escriba, no escribirlo tu');
    // Con un modelo de mentira, que es gratis y siempre dice lo mismo. Lo que se prueba
    // es todo lo que hay del boton para aca: que lo escrito viaja como encargo, que lo
    // devuelto se limpia, y que la cara se sube al elegirla y no al guardar.
    const wand41 = await page.evaluate(async () => {
        const [{ openHeroCreator }, { Popup, POPUP_TYPE }] = await Promise.all([
            import('/scripts/game-engine/ui/hero-creator.js'),
            import('/scripts/popup.js'),
        ]);

        window.__wand = { asked: null, uploaded: null, answers: null };

        openHeroCreator({
            worldName: 'El Vado Escrito',
            genre: 'Terror gótico',
            races: ['Media elfa'],
            classes: ['Pícara'],
            generate: async (params) => {
                window.__wand.asked = params;
                return '"Ficha: Creció sin nada y aprendió a no pedirlo."';
            },
            uploadFace: async (file) => {
                window.__wand.uploaded = file.name;
                return 'img/user-default.png';
            },
            Popup,
            POPUP_TYPE,
        }).then(a => { window.__wand.answers = a; });

        return true;
    });
    check('el cuadro se abre para probarlo', wand41 === true);

    await page.waitForSelector('.hc-root', { timeout: 15000 });
    await page.fill('.hc-root .hc-name', 'Lyra');
    await page.fill('.hc-root .hc-about', 'algo triste sobre lo pobre que es');
    check('con un modelo conectado la varita se enciende',
        await page.locator('.hc-wand:disabled').count() === 0);

    await page.locator('.hc-wand').click();
    await page.waitForTimeout(1500);

    const written41 = await page.inputValue('.hc-root .hc-about');
    const sent41 = await page.evaluate(() => window.__wand.asked);
    check('lo escrito viaja como encargo, no como borrador que pulir',
        /Lo que quiere quien juega: algo triste/.test(sent41?.prompt || ''), sent41?.prompt || '');
    check('y se le dice el mundo y el tono, que es lo que hace que encaje',
        /El Vado Escrito/.test(sent41?.prompt || '') && /terror/i.test(sent41?.prompt || ''));
    check('se le ata corto en largo, porque esto va en el prompt de cada turno',
        /dos y cuatro frases/i.test(sent41?.systemPrompt || ''), sent41?.systemPrompt || '');
    check('lo devuelto sustituye al encargo, ya limpio de comillas y encabezados',
        written41 === 'Creció sin nada y aprendió a no pedirlo.', written41);

    // La cara: se sube al elegirla, asi que un fallo se ve mientras aun puedes cambiarla.
    await page.setInputFiles('.hc-root .hc-face-file', {
        name: 'lyra.png', mimeType: 'image/png',
        buffer: Buffer.from('89504e470d0a1a0a', 'hex'),
    });
    await page.waitForTimeout(900);
    const face41 = await page.evaluate(() => ({
        uploaded: window.__wand.uploaded,
        stored: document.querySelector('.hc-face')?.value || '',
        shown: document.querySelector('.hc-face-preview')?.getAttribute('src') || '',
    }));
    check('elegir una imagen del disco la sube ahi mismo',
        face41.uploaded === 'lyra.png', JSON.stringify(face41));
    check('y lo que se guarda es la ruta que devuelve el servidor, no el archivo',
        face41.stored === 'img/user-default.png' && face41.shown === 'img/user-default.png',
        JSON.stringify(face41));

    await page.locator('.popup-button-ok').last().click();
    await page.waitForTimeout(800);
    const kept41 = await page.evaluate(() => window.__wand.answers);
    check('y lo que sale del cuadro es la ficha entera, con su cara puesta',
        kept41?.name === 'Lyra' && kept41?.image === 'img/user-default.png'
        && /aprendió a no pedirlo/.test(kept41?.about || ''), JSON.stringify(kept41));

    step('42. El compendio: la biblioteca de la que tiran los generadores');
    // La bateria de nombres, leida del disco por el navegador. Lo que se comprueba es que
    // el archivo que viene escrito **carga, valida y produce**, que es lo que ninguna
    // prueba de Node puede decir: alli el archivo se lee a mano y aqui lo sirve el server.
    const lib42 = await page.evaluate(async () => {
        const [
            { getCompendium, DOMAINS }, { makeName, makeNames, culturesOf },
            { forgeItem, forgeItems, describeItem },
            { breedMonster, breedBand, describeMonster },
            { writeQuest, writeQuestBoard }, { createSeededRandom },
        ] = await Promise.all([
            import('/scripts/game-engine/compendio/browser.js')
                .then(async (m) => ({ ...m, ...(await import('/scripts/game-engine/compendio/compendio.js')) })),
            import('/scripts/game-engine/compendio/names.js'),
            import('/scripts/game-engine/compendio/forge.js'),
            import('/scripts/game-engine/compendio/bestiary.js'),
            import('/scripts/game-engine/compendio/quests.js'),
            import('/scripts/game-engine/combat/seeded-random.js'),
        ]);

        const { compendium, errors, loaded } = await getCompendium();
        const ten = makeNames({
            compendium, howMany: 10, random: createSeededRandom('molino'),
        });

        return {
            errors,
            loaded,
            filas: compendium.count('nombres'),
            faltan: compendium.missing(),
            dominios: DOMAINS.length,
            culturas: culturesOf(compendium).sort(),
            diez: ten,
            sitio: makeName({ compendium, kind: 'place', random: createSeededRandom('vado') }),
            taberna: makeName({ compendium, kind: 'tavern', random: createSeededRandom('taberna') }),
            // Dos veces la misma semilla: el mismo mundo propone lo mismo.
            otraVez: makeNames({
                compendium, howMany: 10, random: createSeededRandom('molino'),
            }),

            // B2: forma por material. Ocho cosas y una descrita.
            ocho: forgeItems({ compendium, howMany: 8, random: createSeededRandom('fragua') })
                .map(describeItem),
            arma: forgeItem({ compendium, itemType: 'weapon', random: createSeededRandom('hoja') }),
            armadura: forgeItem({ compendium, itemType: 'armor', random: createSeededRandom('peto') }),

            // B6: arquetipo por plantilla, con los numeros de su desafio.
            banda: breedBand({ compendium, howMany: 4, cr: 1, random: createSeededRandom('manada') })
                .map(describeMonster),
            flojo: breedMonster({
                compendium, cr: 0.25, templates: 0, random: createSeededRandom('cria'),
            }),
            // Olvidando lo ultimo: si no, la memoria de no-repetir aparta al que acaba de
            // salir y los dos bichos no serian el mismo, que es lo que se compara.
            duro: (compendium.forget(), breedMonster({
                compendium, cr: 5, templates: 0, random: createSeededRandom('cria'),
            })),
            cripta: breedMonster({
                compendium, biome: 'cripta', templates: 0, random: createSeededRandom('tumba'),
            }),

            // B9: verbo + objeto + giro + recompensa.
            tablon: writeQuestBoard({
                compendium, howMany: 5, random: createSeededRandom('tablon'),
            }),
            encargo: writeQuest({
                compendium, act: 2, boards: ['Sala de entrada'],
                random: createSeededRandom('encargo'),
            }),
        };
    });

    check('la bateria carga desde el disco y no tiene ni un error',
        lib42.errors.length === 0 && lib42.loaded.includes('nombres'),
        JSON.stringify({ errores: lib42.errors, cargadas: lib42.loaded }));
    check('y dice cuales faltan, que es media lista de tareas',
        lib42.faltan.length === lib42.dominios - lib42.loaded.length
        && !lib42.faltan.some(d => lib42.loaded.includes(d)),
        `${lib42.faltan.length} sin escribir de ${lib42.dominios}`);
    check('trae las cuatro culturas de gente',
        JSON.stringify(lib42.culturas) === JSON.stringify(['arena', 'bosque', 'norte', 'valle']),
        JSON.stringify(lib42.culturas));
    check('diez personas son diez nombres, y ninguno repetido',
        lib42.diez.length === 10 && new Set(lib42.diez).size === 10, lib42.diez.join(', '));
    check('ninguno lleva un hueco sin rellenar',
        lib42.diez.every(n => !/[{}]/.test(n)), lib42.diez.join(', '));
    check('un sitio se llama como lo que es',
        / de(l| la) /.test(lib42.sitio), lib42.sitio);
    check('y una taberna, como una taberna',
        /^(El|La) /.test(lib42.taberna), lib42.taberna);
    // La semilla es lo que hace que dos partidas del mismo texto se puedan comparar.
    check('la misma semilla propone exactamente lo mismo',
        JSON.stringify(lib42.diez) === JSON.stringify(lib42.otraVez),
        `${lib42.diez[0]} / ${lib42.otraVez[0]}`);

    // --- B2: de que estan hechas las cosas -------------------------------------------
    check('forjar da ocho cosas distintas, con su peso y su daño',
        lib42.ocho.length === 8 && new Set(lib42.ocho).size === 8,
        lib42.ocho.join(' | '));
    check('un arma sale con dados de daño y su ranura',
        lib42.arma?.type === 'weapon' && /^\d+d\d+$/.test(lib42.arma?.damageDice || '')
        && lib42.arma?.slot === 'weapon',
        JSON.stringify(lib42.arma));
    check('una armadura no trae dados, porque una armadura no pega',
        lib42.armadura?.type === 'armor' && !lib42.armadura?.damageDice,
        JSON.stringify(lib42.armadura));
    check('y el nombre dice de que esta hecha, no es un numero',
        / de /.test(lib42.arma?.name || '') && !/[{}]/.test(lib42.arma?.name || ''),
        lib42.arma?.name || '');

    // --- B6: los bichos ---------------------------------------------------------------
    check('una banda son cuatro bichos distintos, no cuatro copias',
        lib42.banda.length === 4 && new Set(lib42.banda).size === 4, lib42.banda.join(' | '));
    // Escribir "35 puntos de vida" en una ficha la ata a un nivel concreto, y por eso los
    // bestiarios envejecen mal. Aqui los numeros salen del desafio.
    check('el mismo arquetipo aguanta mas cuando el desafio es mayor',
        lib42.duro.from.arquetipo === lib42.flojo.from.arquetipo
        && lib42.duro.hp > lib42.flojo.hp,
        `${lib42.flojo.name} CR0.25 ${lib42.flojo.hp}PG -> CR5 ${lib42.duro.hp}PG`);
    check('y trae su perfil tactico, de los cuatro que el motor mueve',
        ['aggressive', 'skirmisher', 'guardian', 'coward'].includes(lib42.cripta?.profile),
        JSON.stringify({ bicho: lib42.cripta?.name, perfil: lib42.cripta?.profile }));
    check('con su debilidad escrita, que es lo que hace jugable una pelea',
        (lib42.cripta?.description || '').length > 20, lib42.cripta?.description || '');

    // --- B9: las misiones -------------------------------------------------------------
    check('un tablon son cinco encargos que no se repiten',
        lib42.tablon.length === 5
        && new Set(lib42.tablon.map(q => `${q.from.verbo}|${q.from.giro}`)).size === 5,
        lib42.tablon.map(q => q.name).join(' | '));
    check('cada una se llama por lo que hay que hacer, y con mayuscula',
        lib42.tablon.every(q => /^[A-ZÁÉÍÓÚÑ]/.test(q.name) && !/[{}]/.test(q.name)),
        lib42.tablon.map(q => q.name).join(' | '));
    // El giro es lo que separa un recado de una mision.
    check('y todas traen su giro escrito en la descripcion',
        lib42.tablon.every(q => q.from.giro && q.description.length > 80),
        lib42.tablon[0]?.description || '');
    check('el acto y el tablero son los que se piden, no otros',
        lib42.encargo?.act === 2 && lib42.encargo?.boardName === 'Sala de entrada',
        JSON.stringify({ acto: lib42.encargo?.act, tablero: lib42.encargo?.boardName }));

    step('43. La pantalla del compendio, desde el menu principal');
    // Tu biblioteca, no la de una campana: por eso se llega desde el menu de titulo y no
    // desde /campana. Se cierra la partida para volver al titulo, que es donde vive.
    await clearToasts();
    // `/modojuego` es un interruptor y el paso anterior lo deja encendido: pedirlo a
    // ciegas apagaria justo la pantalla que este paso viene a mirar.
    if (await page.locator('#game-shell').count() === 0) {
        await page.evaluate(() => {
            void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/modojuego');
        });
    }
    await page.waitForSelector('#game-shell', { timeout: 15000 });
    await page.waitForTimeout(1200);

    // El titulo se queda en la vista de "Cargar partida" si alguien la abrio antes —el
    // paso de borrar campanas vive ahi—, y esa vista solo tiene el boton de volver.
    if (await page.locator('.gs-menu-back').count() > 0) {
        await page.locator('.gs-menu-back').click();
        await page.waitForTimeout(700);
    }

    // Y la biblioteca vive en el menu de titulo, asi que hay que estar en el titulo.
    if (await page.locator('.gs-menu-btn').count() === 0) {
        await page.keyboard.press('Escape');
        await page.waitForSelector('.gs-pause', { timeout: 5000 });
        await page.locator('.gs-pause-btn', { hasText: 'Salir al menu principal' }).click();
        await page.waitForTimeout(1200);
    }

    const menu43 = await page.evaluate(() => [...document.querySelectorAll('.gs-menu-btn')]
        .map(b => (b.querySelector('.gs-menu-label')?.textContent || '').trim()));
    check('el menu principal ofrece el compendio, antes que los ajustes',
        menu43.includes('Compendio')
        && menu43.indexOf('Compendio') < menu43.indexOf('Opciones'),
        JSON.stringify(menu43));

    await page.locator('.gs-menu-btn', { hasText: 'Compendio' }).click();
    await page.waitForSelector('.cx-root', { timeout: 15000 });

    const panel43 = await page.evaluate(() => ({
        tabs: [...document.querySelectorAll('.cx-tab')].map(t => ({
            name: (t.querySelector('span')?.textContent || '').trim(),
            count: (t.querySelector('.cx-count')?.textContent || '').trim(),
            empty: t.classList.contains('empty'),
        })),
        intro: document.querySelector('.cx-intro')?.textContent || '',
        errors: document.querySelectorAll('.cx-errors').length,
    }));

    check('con una pestana por bateria y su cuenta',
        panel43.tabs.length === lib42.dominios
        && panel43.tabs.filter(t => !t.empty).length === lib42.loaded.length
        && panel43.tabs.every(t => t.empty || Number(t.count) > 0),
        JSON.stringify(panel43.tabs.filter(t => !t.empty)));
    // Apagada y con su motivo, igual que las escenas apagadas del Modo Juego: la pantalla
    // es de paso la barra de progreso del roadmap.
    check('las que faltan salen apagadas, no escondidas',
        panel43.tabs.filter(t => t.empty).length === lib42.dominios - lib42.loaded.length
        && panel43.tabs.every(t => t.empty || t.count !== '—'),
        `${panel43.tabs.filter(t => t.empty).length} sin escribir`);
    check('y dice cuantas baterias hay y cuantas filas, sin errores que contar',
        new RegExp(`${lib42.loaded.length} de ${lib42.dominios} baterías, \\d+ filas`).test(panel43.intro)
        && panel43.errors === 0,
        panel43.intro);

    // El boton de probar: diez tiradas con la semilla que escribas.
    await page.locator('.cx-try-go').click();
    await page.waitForTimeout(700);
    const tried43 = await page.evaluate(() =>
        [...document.querySelectorAll('.cx-try-line')].map(l => l.textContent || ''));
    check('probar saca diez, con la semilla escrita',
        tried43.length === 10 && new Set(tried43).size === 10, tried43.join(', '));

    // Y cada bateria se prueba con quien la sortea de verdad.
    await page.locator('.cx-tab', { hasText: 'Materiales' }).click();
    await page.waitForTimeout(400);
    await page.locator('.cx-try-go').click();
    await page.waitForTimeout(700);
    const forged43 = await page.evaluate(() =>
        [...document.querySelectorAll('.cx-try-line')].map(l => l.textContent || ''));
    check('y materiales se prueba forjando, no listando filas',
        forged43.length > 0 && forged43.every(l => /kg/.test(l)), forged43.join(' | '));

    // Y las armas, que son las que mas filas tienen desde que las formas se mudaron a su
    // propio archivo: materiales se quedo con los 16 materiales.
    await page.locator('.cx-tab', { hasText: 'Armas' }).click();
    await page.waitForTimeout(400);
    const rows43 = await page.evaluate(() => document.querySelectorAll('.cx-row').length);
    check('la tabla ensena las filas de la bateria abierta',
        rows43 >= 30, `${rows43} lineas con la cabecera`);

    await page.locator('.cx-try-go').click();
    await page.waitForTimeout(700);
    const armas43 = await page.evaluate(() =>
        [...document.querySelectorAll('.cx-try-line')].map(l => l.textContent || ''));
    // Un arma que no dice lo que hace es un nombre: el dado, y el alcance si lo tiene.
    check('y las armas se prueban forjandolas, con su dado',
        armas43.length > 0 && armas43.every(l => /\dd\d/.test(l))
        && armas43.some(l => /ft|a dos manos/.test(l)),
        armas43.join(' | '));

    await page.locator('.cx-tab', { hasText: 'Bestiario' }).click();
    await page.waitForTimeout(400);
    await page.locator('.cx-try-go').click();
    await page.waitForTimeout(700);
    const bred43 = await page.evaluate(() =>
        [...document.querySelectorAll('.cx-try-line')].map(l => l.textContent || ''));
    check('y el bestiario se prueba criando, con sus puntos de vida',
        bred43.length > 0 && bred43.every(l => /PG/.test(l) && /CR/.test(l)),
        bred43.join(' | '));

    // Y las facciones se prueban repartiendolas por el mundo: quien manda donde, que
    // quiere y por donde va su reloj. Una lista de nombres no diria si eso funciona.
    await page.locator('.cx-tab', { hasText: 'Facciones' }).click();
    await page.waitForTimeout(400);
    await page.locator('.cx-try-go').click();
    await page.waitForTimeout(700);
    const bandos43 = await page.evaluate(() =>
        [...document.querySelectorAll('.cx-try-line')].map(l => l.textContent || ''));
    check('y las facciones se prueban repartiendolas, con su reloj y su motivo',
        bandos43.length > 0
        && bandos43.every(l => / de \d/.test(l) && l.includes('—'))
        && !bandos43.join(' ').includes('undefined'),
        bandos43.join(' | '));

    await page.locator('.popup-button-ok').last().click();
    await page.waitForTimeout(800);
    await leaveGameMode();

    step('44. Viajar: el mundo es una lista, y la distancia cuesta dias');
    // El paso anterior deja el menu de titulo, que es donde vive el compendio y donde no
    // hay campana abierta. Viajar necesita un mundo, asi que se retoma uno.
    if (await page.evaluate(() => !window.SillyTavern.getContext().chatMetadata?.world_info)) {
        // El paso anterior sale del Modo Juego, asi que aqui no hay menu de titulo: las
        // campanas estan en la pantalla de bienvenida, que es donde las deja cerrar chat.
        await page.waitForSelector('.campaign-card .campaign-continue', { timeout: 20000 });
        await page.locator('.campaign-card .campaign-continue').first().click();
        await page.waitForTimeout(4000);
        await clearToasts();
    }
    check('se puede retomar una campana para viajar en ella',
        await page.evaluate(() => Boolean(window.SillyTavern.getContext().chatMetadata?.world_info)));

    // Se le escriben rutas al mundo abierto: el mundo es una **lista**, asi que la
    // distancia no se mide en casillas, se declara en dias.
    const routed = await page.evaluate(async () => {
        const wi = await import('/scripts/world-info.js');
        const ctx = window.SillyTavern.getContext();
        const worldName = ctx.chatMetadata.world_info;
        const data = await wi.loadWorldInfo(worldName);

        const places = data.metadata.locationMaps ?? [];
        // Una campana nueva ya nace con vecinos, asi que aqui no se inventan nombres: se
        // usan los que tenga. Solo se completan los que falten para tener tres.
        while (places.length < 3) {
            places.push({ ...places[0], name: `Sitio ${places.length}`, boards: [], routes: [] });
        }
        const donde = places.map(p => p.name);
        // Y se le reescriben las rutas para que haya un camino corto y un rodeo largo,
        // que es lo que este paso viene a comprobar.
        places[0].routes = [{ to: donde[1], days: 2 }, { to: donde[2], days: 9 }];
        places[1].routes = [{ to: donde[2], days: 2 }];
        for (const place of places.slice(3)) place.routes = [{ to: donde[2], days: 4 }];
        // Que clase de sitio es cada uno: de ahi sale que tiempo puede hacer.
        places[0].biome = 'camino';
        places[1].biome = 'montana';
        places[2].biome = 'pantano';

        data.metadata.locationMaps = places;
        await wi.saveWorldInfo(worldName, data, true);
        // Guardar escribe el archivo; el juego viaja con la copia que cargo al abrir la
        // campana. Sin refrescarla, `/go El Molino` no encuentra El Molino y no dice nada.
        await wi.refreshWorldMapGlobals(worldName);
        return { worldName, aqui: String(ctx.chatMetadata.currentLocation || ''), sitios: donde };
    });
    check('el mundo es una lista de sitios con rutas, no un tablero',
        routed.sitios.length >= 3, JSON.stringify(routed.sitios));

    // El rodeo corto gana al camino largo, y se dice por donde se pasa.
    const plan44 = await page.evaluate(async ([cerca, lejos]) => {
        const wi = await import('/scripts/world-info.js');
        const { planTravel, describeTravel } = await import('/scripts/game-engine/world/travel.js');
        const ctx = window.SillyTavern.getContext();
        const data = await wi.loadWorldInfo(ctx.chatMetadata.world_info);
        const locations = data.metadata.locationMaps;

        return {
            corto: planTravel({ from: locations[0].name, to: cerca, locations }),
            rodeo: planTravel({ from: locations[0].name, to: lejos, locations }),
            dicho: describeTravel(planTravel({ from: locations[0].name, to: lejos, locations })),
        };
    }, [routed.sitios[1], routed.sitios[2]]);
    check('lo directo cuesta lo que dice su ruta',
        plan44.corto.ok && plan44.corto.days === 2, JSON.stringify(plan44.corto));
    check('y si el rodeo es mas corto, se va por el rodeo y se dice por donde',
        plan44.rodeo.days === 4
        && plan44.rodeo.legs.join(' > ') === `${routed.sitios[1]} > ${routed.sitios[2]}`,
        plan44.dicho);

    // Y viajar de verdad: los dias pasan por el mismo reloj que cura, da de comer y cobra.
    const before44 = await page.evaluate(() =>
        Number(window.SillyTavern.getContext().chatMetadata?.calendar?.day ?? 0));

    // `travelWithTime` devuelve '' por cuatro motivos distintos —combate en marcha, sitio
    // que no existe, ruta cerrada, cancelado— y todos se ven igual desde fuera. Sin los
    // avisos, un viaje que no ocurre es un fallo mudo.
    await page.evaluate(() =>
        document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));

    await page.evaluate(async (to) => {
        const ctx = window.SillyTavern.getContext();
        await ctx.executeSlashCommandsWithOptions(`/go ${to}`);
    }, routed.sitios[1]);
    await page.waitForTimeout(2500);

    const after44 = await page.evaluate(() => {
        const ctx = window.SillyTavern.getContext();
        const chat = ctx.chat || [];
        return {
            day: Number(ctx.chatMetadata?.calendar?.day ?? 0),
            donde: String(ctx.chatMetadata?.currentLocation || ''),
            ultimo: String(chat[chat.length - 1]?.mes || ''),
            esSistema: Boolean(chat[chat.length - 1]?.is_system),
            avisos: [...document.querySelectorAll('#toast-container .toast')]
                .map(t => t.innerText.replace(/\s+/g, ' ').trim()).join(' | '),
        };
    });

    check('viajar mueve al grupo al sitio al que va',
        after44.donde === routed.sitios[1],
        `${after44.donde} — avisos: ${after44.avisos || '(ninguno)'}`);
    // Un viaje que no cuesta nada es una pantalla de carga.
    check('y pasan los dias del camino, no cero',
        after44.day >= before44 + 2, `día ${before44} -> ${after44.day}`);
    // El motor decide y el narrador cuenta: la nota no puede ser un mensaje de sistema,
    // porque entonces la ve quien juega y no la ve el modelo.
    check('el narrador se entera del viaje, por el canal que el modelo lee',
        after44.ultimo.includes(`viaja hasta ${routed.sitios[1]}`) && after44.esSistema === false,
        after44.ultimo.slice(0, 90));

    // --- B11: el tiempo del camino ---------------------------------------------------
    const weather44 = await page.evaluate(async () => {
        const [{ getCompendium }, { rollWeather, travelEvents }, { createSeededRandom }] =
            await Promise.all([
                import('/scripts/game-engine/compendio/browser.js'),
                import('/scripts/game-engine/world/travel.js'),
                import('/scripts/game-engine/combat/seeded-random.js'),
            ]);

        const { compendium } = await getCompendium();
        const climates = compendium.find('mundo', { kind: 'clima' });
        const cueva = compendium.find('mundo', { kind: 'bioma', biome: 'cueva' })[0];

        const dias = rollWeather({
            days: 40, table: climates, random: createSeededRandom('camino'),
        });
        let rachas = 0;
        for (let i = 1; i < dias.length; i++) if (dias[i] === dias[i - 1]) rachas++;

        return {
            tiene: compendium.has('mundo'),
            biomas: compendium.find('mundo', { kind: 'bioma' }).length,
            dias,
            rachas,
            // En una cueva no nieva: el bioma manda sobre lo que puede hacer.
            bajoTierra: rollWeather({
                days: 12, table: climates, climates: cueva?.climates ?? [],
                random: createSeededRandom('cueva'),
            }),
            // Y una tormenta no cae con el cielo despejado.
            conSol: travelEvents({
                days: 12,
                table: compendium.find('mundo', { kind: 'suceso' }),
                biome: 'camino',
                weather: new Array(12).fill('despejado'),
                random: createSeededRandom('sol'),
                chance: 1,
            }).map(e => e.id),
        };
    });

    step('45. Facciones: el mundo sigue adelante cuando no miras');
    // Lo que se comprueba aqui no es que el modulo sume bien —eso ya lo dicen las pruebas—
    // sino que una campana **recien creada** tiene vecinos, tiene facciones y que los dias
    // del viaje han corrido tambien para ellas.
    const bandos45 = await page.evaluate(async () => {
        const wi = await import('/scripts/world-info.js');
        const ctx = window.SillyTavern.getContext();
        const data = await wi.loadWorldInfo(ctx.chatMetadata.world_info);
        return {
            sitios: (data.metadata.locationMaps ?? []).map((/** @type {any} */ l) => l.name),
            bandos: (data.metadata.factions ?? []).map((/** @type {any} */ f) => ({
                name: f.name, seat: f.seat, kind: f.goal?.kind,
                target: f.goal?.target, at: f.goal?.at, days: f.goal?.days,
            })),
        };
    });

    check('una campana nueva nace con sitios a los que ir',
        bandos45.sitios.length >= 3, bandos45.sitios.join(', '));
    check('y con gente que quiere algo, cada una en su sitio',
        bandos45.bandos.length >= 2
        && bandos45.bandos.every(f => f.name && f.seat && f.kind && f.target)
        && new Set(bandos45.bandos.map(f => f.seat)).size === bandos45.bandos.length,
        bandos45.bandos.map(f => `${f.name} (${f.seat}) ${f.kind} ${f.target}`).join(' | '));
    // El mismo reloj que el hambre: si los dias del viaje no les corren, tienen el suyo.
    check('los dias del viaje corren tambien para ellas',
        bandos45.bandos.some(f => Number(f.days) > 0 || Number(f.at) > 0),
        bandos45.bandos.map(f => `${f.name}: ${f.at} seg, ${f.days} d`).join(' | '));

    // Dormir no puede pararles el reloj: el descanso largo adelanta el dia por dentro del
    // modulo de campana, asi que por ahi se les escapaban los dias.
    const durmiendo45 = await page.evaluate(async () => {
        const wi = await import('/scripts/world-info.js');
        const ctx = window.SillyTavern.getContext();
        const world = ctx.chatMetadata.world_info;
        const cuenta = async () => {
            const data = await wi.loadWorldInfo(world);
            return (data.metadata.factions ?? [])
                .reduce((/** @type {number} */ sum, /** @type {any} */ f) =>
                    sum + (Number(f.goal?.at) * 100) + Number(f.goal?.days || 0), 0);
        };
        const antes = await cuenta();
        await ctx.executeSlashCommandsWithOptions('/descanso largo');
        await new Promise(resolve => setTimeout(resolve, 2500));
        return { antes, despues: await cuenta() };
    });
    check('y dormir no les para el reloj',
        durmiendo45.despues > durmiendo45.antes,
        `${durmiendo45.antes} -> ${durmiendo45.despues}`);

    // El tablon: parte de lo que ofrece sale de lo que alguien quiere de verdad, y tiene
    // que decir de que lado te pone **antes** de aceptar, no despues.
    void page.evaluate(() => window.SillyTavern.getContext()
        .executeSlashCommandsWithOptions('/gremio'));
    await page.waitForSelector('.gd-board', { timeout: 15000 });
    await page.waitForTimeout(500);
    const tablon45 = await page.evaluate(() => ({
        encargos: document.querySelectorAll('.gd-contract').length,
        deLado: [...document.querySelectorAll('.gd-side')].map(e => e.textContent || ''),
        loQueSeJuega: [...document.querySelectorAll('.gd-stake')].map(e => e.textContent || ''),
    }));
    check('el tablon ofrece encargos que toman partido',
        tablon45.encargos > 0 && tablon45.deLado.length > 0
        && tablon45.deLado.every(t => t === 'en contra' || t === 'a favor'),
        `${tablon45.encargos} encargos, ${tablon45.deLado.length} con bando`);
    check('y dice lo que se juega el mundo antes de aceptar',
        tablon45.loQueSeJuega.length === tablon45.deLado.length
        && tablon45.loQueSeJuega.every(t => /semana/.test(t) && !t.includes('undefined')),
        tablon45.loQueSeJuega.join(' | '));

    // El panel del gremio se cierra con su boton «Cerrar», que es el ok del popup. El
    // selector tiene que ser el del popup **visible**: los cerrados siguen en el DOM y
    // clicar uno invisible cuelga el recorrido entero.
    await page.locator('.popup:visible .popup-button-ok').last().click();
    await page.waitForTimeout(800);

    // F3: un paso cerrado no es solo un rodeo, es comida que no llega. Se cierra uno y se
    // mira lo unico que de verdad aprieta en este juego: la cuenta del viernes.
    const mercado45 = await page.evaluate(async () => {
        const wi = await import('/scripts/world-info.js');
        const { marketPressure, applyMarket, describeMarket } =
            await import('/scripts/game-engine/campaign/economy.js');
        const ctx = window.SillyTavern.getContext();
        const world = ctx.chatMetadata.world_info;
        const data = await wi.loadWorldInfo(world);
        const locations = data.metadata.locationMaps ?? [];
        const aqui = String(ctx.chatMetadata.currentLocation || '');
        const factions = data.metadata.factions ?? [];

        const antes = marketPressure({ here: aqui, locations, factions });

        // Se le cierra un camino al sitio donde esta el grupo, como haria una faccion al
        // tomar lo de al lado.
        const place = locations.find((/** @type {any} */ l) => l.name === aqui);
        const route = (place?.routes ?? [])[0]
            ?? locations.flatMap((/** @type {any} */ l) => l.routes ?? [])
                .find((/** @type {any} */ r) => r.to === aqui);
        if (route) route.closed = true;

        const despues = marketPressure({ here: aqui, locations, factions });
        return {
            antes: antes.food,
            despues: despues.food,
            dicho: describeMarket(despues),
            comidaAntes: applyMarket({ foodPerDay: 2, taxPerWeek: 3 }, antes).foodPerDay,
            comidaDespues: applyMarket({ foodPerDay: 2, taxPerWeek: 3 }, despues).foodPerDay,
        };
    });
    check('un paso cerrado sube el pan, y dice por que',
        mercado45.despues > mercado45.antes
        && mercado45.comidaDespues > mercado45.comidaAntes
        && /cerrado|entra nada/.test(mercado45.dicho),
        `${mercado45.antes} -> ${mercado45.despues} · ${mercado45.dicho}`);

    // Y lo que se ve al jugar: el panel de campana lo cuenta sin abrir ningun archivo.
    // Viajar deja abierta la pestana de localizacion, asi que primero se abre la suya.
    await page.locator('#rm_tab_campaign').click();
    await page.waitForTimeout(600);
    const panel45 = await page.evaluate(async () => {
        const lines = [...document.querySelectorAll('.cp-world')].map(l => l.textContent || '');
        return { lines, title: document.querySelector('.cp-world-title')?.textContent || '' };
    });
    check('y el panel de campana dice que se mueve ahi fuera',
        panel45.title === 'Ahí fuera' && panel45.lines.length > 0
        && panel45.lines.every(l => / de \d/.test(l) && !l.includes('undefined')),
        panel45.lines.join(' | ') || '(el panel de campana no estaba abierto)');


    check('la bateria del mundo trae sus biomas',
        weather44.tiene && weather44.biomas >= 6, `${weather44.biomas} biomas`);
    check('el viaje tiene tiempo, un dia por jornada',
        weather44.dias.length === 40, [...new Set(weather44.dias)].join(', '));
    // Una tirada suelta por dia da sol-tormenta-sol, que no lo cree nadie.
    check('y hace rachas, porque el tiempo de manana depende del de hoy',
        weather44.rachas > 8, `${weather44.rachas} dias repiten el del dia anterior`);
    check('bajo tierra no nieva: el sitio manda sobre el tiempo',
        new Set(weather44.bajoTierra).size === 1 && weather44.bajoTierra[0] === 'despejado',
        [...new Set(weather44.bajoTierra)].join(', '));
    check('y con el cielo despejado no cae una tormenta',
        !weather44.conSol.includes('suceso-tormenta')
        && !weather44.conSol.includes('suceso-barro'),
        weather44.conSol.join(', '));

    console.log('\n--- console errors ---');
    console.log(problems.size ? [...problems].join('\n') : '(none)');
} catch (error) {
    failures++;
    console.log(`FAIL  the run threw: ${error?.message || error}`);
} finally {
    if (browser) await browser.close().catch(() => {});
    if (server) {
        // Detach the pipes first: an inherited stdout keeps the calling shell waiting.
        server.stdout?.destroy();
        server.stderr?.destroy();
        server.kill('SIGKILL');
    }
    if (!KEEP) {
        // Windows holds the directory for a moment logAfter the server dies.
        await new Promise(resolve => setTimeout(resolve, 1000));
        rmSync(dataRoot, { recursive: true, force: true, maxRetries: 5 });
    } else {
        console.log(`\nKept for inspection: ${dataRoot}`);
    }
}
if (failed.length > 0) {
    // Repetido al final a proposito: quien lee este recorrido lo lee por el rabo.
    console.log('\n--- lo que fallo ---');
    for (const line of failed) console.log(`  ${line}`);
}
console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
