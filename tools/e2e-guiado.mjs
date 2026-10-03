/**
 * Para las vueltas de prueba (D-J62, el modo guiado): hacer lo que antes estaba en la fila de abajo
 * como lo hace ahora quien juega.
 *
 * - Lo del gremio (el tablón, contratar, los encargos, tus personajes, el salón…) está dentro de la
 *   Casa del Gremio: `enElGremio(page, 'hub-board')` entra y lo pulsa.
 * - Viajar, ir al tablero donde espera la pelea, hablar con quien pide la historia o intentarlo
 *   están en «Lo que pide la historia»: `pasoDeLaHistoria(page, /Ir a La Granja/)`.
 * - «Volver al gremio» y «El final» de una campaña siguen en la fila (y en la plaza):
 *   `volverAlGremio(page)`.
 *
 * Si no está (por ejemplo, con el modo guiado apagado), devuelven `false` y la vuelta lo dice.
 */

/* global window, document, HTMLElement */

/**
 * Esperar a que se cumpla algo, sin dormir de más.
 *
 * @param {any} page
 * @param {() => Promise<boolean>} test
 * @param {number} [ms]
 * @returns {Promise<boolean>}
 */
async function until(page, test, ms = 10000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
        if (await test().catch(() => false)) return true;
        await page.waitForTimeout(250);
    }
    return false;
}

/**
 * Llegar a la pantalla del sitio (la Exploración): «Continuar» si se está leyendo la novela.
 *
 * @param {any} page
 * @returns {Promise<boolean>}
 */
export async function alSitio(page) {
    return until(page, async () => page.evaluate(() => {
        const shell = document.querySelector('#game-shell');
        if (shell?.getAttribute('data-scene') === 'exploration') return true;
        const go = document.querySelector('#game-shell .gs-vn-box .gs-chip-continue');
        if (go instanceof HTMLElement) go.click();
        return false;
    }), 12000);
}

/**
 * Entrar en un sitio del pueblo (`gremio`, `posada`…), saliendo antes del que esté abierto.
 *
 * @param {any} page
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function entrarEnSitio(page, id) {
    await alSitio(page);
    const open = await page.evaluate(() => document.querySelector('#game-shell .gs-town-scene')?.getAttribute('data-place') || '');
    if (open === id) return true;
    if (open) {
        await page.locator('#game-shell .gs-town-back').click({ timeout: 5000 }).catch(() => {});
        await until(page, () => page.evaluate(() => !document.querySelector('#game-shell .gs-town-scene')), 5000);
    }
    await page.locator(`#game-shell .gs-town-place[data-place="${id}"]`).click({ timeout: 8000 }).catch(() => {});
    return until(page, () => page.evaluate((want) => document.querySelector('#game-shell .gs-town-scene')?.getAttribute('data-place') === want, id), 8000);
}

/**
 * Salir del sitio abierto a la plaza.
 *
 * @param {any} page
 * @returns {Promise<void>}
 */
export async function salirDelSitio(page) {
    if (await page.locator('#game-shell .gs-town-scene').count() === 0) return;
    await page.locator('#game-shell .gs-town-back').click({ timeout: 5000 }).catch(() => {});
    await until(page, () => page.evaluate(() => !document.querySelector('#game-shell .gs-town-scene')), 5000);
}

/**
 * Lo que se puede pulsar dentro del sitio abierto, por su id (`hub-board`, `talk-local:Tomás`…).
 *
 * @param {any} page
 * @returns {Promise<string[]>}
 */
export function accionesDelSitio(page) {
    return page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-town-scene .gs-town-act')].map(b => b.getAttribute('data-action') || ''));
}

/**
 * Salir del tablero abierto (sin pelea) al sitio, con su botón de arriba a la izquierda.
 *
 * @param {any} page
 * @returns {Promise<boolean>}
 */
export async function salirDelTablero(page) {
    return until(page, () => page.evaluate(() => {
        const meta = /** @type {any} */ (window).SillyTavern?.getContext?.()?.chatMetadata ?? {};
        if (!meta.currentBoard) return true;
        // «Salir del tablero» en la fila (sigue con el modo guiado), o el botón de arriba a la izquierda.
        const back = document.querySelector('#game-shell .gs-chip-action[data-chip="leave"]') ?? document.querySelector('#game-shell .vtt-tools .wm-leave-loc-btn');
        if (back instanceof HTMLElement) back.click();
        return false;
    }), 10000);
}

/**
 * Pulsar algo de la Casa del Gremio: `hub-board` (el tablón), `hub-hire` (contratar),
 * `hub-errands`, `hub-heroes`, `hub-hall` (el salón de la fama), `hub-skip`…
 *
 * @param {any} page
 * @param {string} id
 * @returns {Promise<boolean>} Si estaba y se ha pulsado.
 */
export async function enElGremio(page, id) {
    if (!(await entrarEnSitio(page, 'gremio'))) return false;
    return page.locator(`#game-shell .gs-town-scene .gs-town-act[data-action="${id}"]`).first().click({ timeout: 5000 }).then(() => true).catch(() => false);
}

/**
 * Lo que pide la historia en la pantalla del sitio.
 *
 * @param {any} page
 * @returns {Promise<Array<{id: string, kind: string, label: string, note: string, on: boolean}>>}
 */
export function pasosDeLaHistoria(page) {
    return page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-story-step')].map(s => ({
        id: s.getAttribute('data-step') || '',
        kind: s.getAttribute('data-kind') || '',
        label: (s.querySelector('.gs-place-name')?.textContent || '').trim(),
        note: (s.querySelector('.gs-card-note')?.textContent || '').trim(),
        on: !(/** @type {HTMLButtonElement} */ (s).disabled),
    })));
}

/**
 * Pulsar un paso de lo que pide la historia, por su id (`story:go:La Granja`) o por lo que dice.
 * Fuera de la plaza, sale antes del sitio abierto.
 *
 * @param {any} page
 * @param {RegExp|string} pattern Con texto, el id exacto.
 * @param {{ms?: number}} [options] Cuánto esperar a que salga.
 * @returns {Promise<boolean>}
 */
export async function pasoDeLaHistoria(page, pattern, { ms = 8000 } = {}) {
    const matches = (/** @type {string} */ value) => (typeof pattern === 'string' ? value === pattern : pattern.test(value));
    await alSitio(page);
    await salirDelSitio(page);
    /** @type {{id: string}|null} */
    let found = null;
    await until(page, async () => {
        found = (await pasosDeLaHistoria(page)).find(s => s.on && (matches(s.id) || matches(s.label))) ?? null;
        return Boolean(found);
    }, ms);
    if (!found) return false;
    await page.evaluate(() => document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));
    return page.locator(`#game-shell .gs-story-step[data-step="${/** @type {any} */ (found).id}"]`).first().click({ timeout: 5000 }).then(() => true).catch(() => false);
}

/**
 * La ventana del viaje: elegir el paso normal.
 *
 * @param {any} page
 * @returns {Promise<boolean>} Si salió.
 */
export async function viajarAPasoNormal(page) {
    const asked = await page.waitForSelector('.popup:visible .tr-ask', { timeout: 10000 }).then(() => true).catch(() => false);
    if (asked) await page.locator('.popup:visible .tr-pace-normal').first().click({ timeout: 5000 }).catch(() => {});
    return asked;
}

/**
 * «Volver al gremio» desde una campaña: en la fila, o en la plaza.
 *
 * @param {any} page
 * @returns {Promise<boolean>}
 */
export async function volverAlGremio(page) {
    return page.evaluate(() => {
        const button = [...document.querySelectorAll('#game-shell .gs-chip-action, #game-shell .gs-town-extra-btn')]
            .find(b => (b.getAttribute('data-chip') || '') === 'hub-home' || /Volver al gremio/.test(b.textContent || ''));
        if (button instanceof HTMLElement) button.click();
        return Boolean(button);
    });
}
