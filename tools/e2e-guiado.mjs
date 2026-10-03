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
 * - Lo de mirar y la gente están en el sitio del pueblo al que pertenecen: `buscarEnElPueblo`,
 *   `hablarCon(page, 'Tomás|el posadero')`. Lo que está a la vista fuera de la fila (lo que pide la
 *   historia, la gente de aquí, mirar, «Descansar»): `opcionesALaVista` y `pulsarALaVista`.
 * - A un tablero se entra hablando («Bajo a la bodega»): `jugarHistoria(page, ['bajar'])`.
 * - Las pruebas de lo que el modo guiado esconde (wiki/LO_OCULTO.md) lo apagan: `apagarModoGuiado`.
 *
 * Si no está (por ejemplo, con el modo guiado apagado), devuelven `false` y la vuelta lo dice.
 */

/* global window, document, HTMLElement */

/**
 * Apagar el modo guiado (`GUIDED_MODE.on`) en esta página: para las pruebas de lo que esconde
 * (viajar a cualquier vecino, «Tableros de aquí», la fila libre), que sigue en el código
 * (wiki/LO_OCULTO.md). Vuelve a pintar la pantalla del juego si está abierta.
 *
 * @param {any} page
 * @returns {Promise<boolean>} Si quedó apagado.
 */
export async function apagarModoGuiado(page) {
    return page.evaluate(async () => {
        const guided = await import('/scripts/game-engine/campaign/guided-mode.js');
        guided.GUIDED_MODE.on = false;
        const shell = await import('/scripts/game-engine/ui/shell/game-shell.js').catch(() => null);
        /** @type {any} */ (shell)?.refreshGameShell?.();
        return guided.GUIDED_MODE.on === false;
    });
}

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
        // J12.21: la pantalla de victoria tapa el sitio (y un clic fuera de ella solo la cierra): su ✕.
        const outcome = document.querySelector('.vo-layer-victory .vo-close');
        if (outcome instanceof HTMLElement) {
            outcome.click();
            return false;
        }
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
 * Buscar algo en los sitios del pueblo, entrando en cada uno: con el modo guiado, lo de mirar va al
 * sitio al que pertenece (los avisos al mercado, las barcas al muelle) y los rumores a la taberna.
 * Se queda dentro del sitio donde lo encuentra.
 *
 * @param {any} page
 * @param {(act: {id: string, label: string}) => boolean} test
 * @returns {Promise<{place: string, id: string, label: string}|null>}
 */
export async function buscarEnElPueblo(page, test) {
    await alSitio(page);
    await salirDelSitio(page);
    /** @type {string[]} */
    const places = await page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-town-place')].map(p => p.getAttribute('data-place') || ''));
    for (const place of places.filter(Boolean)) {
        if (!(await entrarEnSitio(page, place))) continue;
        /** @type {Array<{id: string, label: string}>} */
        const acts = await page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-town-scene .gs-town-act')].map(b => ({
            id: b.getAttribute('data-action') || '',
            label: (b.querySelector('.gs-btn-label')?.textContent || b.textContent || '').trim(),
        })));
        const found = acts.find(test);
        if (found) return { place, ...found };
    }
    await salirDelSitio(page);
    return null;
}

/**
 * Lo que se puede pulsar a la vista, por lo que dice: la fila (lo que se queda con el modo guiado),
 * lo que pide la historia, la gente de aquí, lo de mirar, lo de los servicios (acampar, cazar y
 * forrajear van en «Descansar») y, dentro de un sitio del pueblo, lo suyo.
 *
 * @param {any} page
 * @returns {Promise<string[]>}
 */
export function opcionesALaVista(page) {
    return page.evaluate(() => [...document.querySelectorAll('#game-shell .gs-chip-action, #game-shell .gs-story-step, #game-shell .gs-person, #game-shell .gs-look, #game-shell .gs-service-btn, #game-shell .gs-town-scene .gs-town-act')]
        .filter(b => !(/** @type {any} */ (b).disabled) && b.getClientRects().length > 0)
        .map(b => (b.classList.contains('gs-chip-action') ? b.textContent : (b.querySelector('.gs-place-name, .gs-btn-label')?.textContent ?? b.textContent)) || '')
        .map(t => t.trim()));
}

/**
 * Pulsar lo primero a la vista que diga lo que se pide (`opcionesALaVista`).
 *
 * @param {any} page
 * @param {RegExp} pattern
 * @returns {Promise<boolean>}
 */
export function pulsarALaVista(page, pattern) {
    return page.evaluate(({ source, flags }) => {
        const re = new RegExp(source, flags);
        const found = [...document.querySelectorAll('#game-shell .gs-chip-action, #game-shell .gs-story-step, #game-shell .gs-person, #game-shell .gs-look, #game-shell .gs-service-btn, #game-shell .gs-town-scene .gs-town-act')]
            .filter(b => !(/** @type {any} */ (b).disabled) && b.getClientRects().length > 0)
            .find(b => re.test(((b.classList.contains('gs-chip-action') ? b.textContent : (b.querySelector('.gs-place-name, .gs-btn-label')?.textContent ?? b.textContent)) || '').trim()));
        /** @type {any} */ (found)?.click();
        return Boolean(found);
    }, { source: pattern.source, flags: pattern.flags });
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
    const id = String(/** @type {any} */ (found).id);
    await page.evaluate(() => document.querySelectorAll('#toast-container .toast').forEach(t => t.remove()));
    const clicked = await page.locator(`#game-shell .gs-story-step[data-step="${id}"]`).first().click({ timeout: 5000 }).then(() => true).catch(() => false);
    // J11.1: un tablero que deja algo sin vuelta atrás pregunta antes de entrar; se entra.
    if (clicked && id.startsWith('story:board:') && await page.waitForSelector('.popup:visible .nr-confirm', { timeout: 2500 }).then(() => true).catch(() => false)) {
        await page.locator('.popup:visible .popup-button-ok').last().click({ timeout: 5000 }).catch(() => {});
    }
    return clicked;
}

/**
 * La ventana de historia abierta: una escena del hilo o una charla escrita, con sus opciones.
 *
 * @param {any} page
 * @returns {Promise<{kind: string, id: string, options: Array<{id: string, locked: boolean}>}|null>}
 */
export function historiaAbierta(page) {
    return page.evaluate(() => {
        const scene = document.querySelector('dialog.ps-dialog[open] .ps-root');
        const talk = document.querySelector('dialog.dw-dialog[open]:not(.ps-dialog) .dw-root');
        const root = scene ?? talk;
        if (!root) return null;
        return {
            kind: scene ? 'scene' : 'dialogue',
            id: scene ? root.getAttribute('data-scene') || '' : root.getAttribute('data-dialogue') || '',
            options: [...root.querySelectorAll('.dw-option')].map(o => ({ id: o.getAttribute('data-option') || '', locked: o.classList.contains('dw-locked') })),
        };
    });
}

/**
 * Jugar las ventanas de historia que se abran (escenas o charlas escritas), eligiendo lo de `pick`
 * si sale; si no, la primera opción (en una charla, «adiós» si está). Con el modo guiado, a un
 * tablero se entra así: «Hablar con Brunilda» → «Bajo a la bodega».
 *
 * @param {any} page
 * @param {string[]} [pick]
 * @param {number} [ms]
 * @returns {Promise<string[]>} Las ventanas jugadas, por su id.
 */
export async function jugarHistoria(page, pick = [], ms = 60000) {
    /** @type {string[]} */
    const played = [];
    const end = Date.now() + ms;
    while (Date.now() < end) {
        const now = await historiaAbierta(page);
        if (!now) break;
        if (played[played.length - 1] !== now.id) played.push(now.id);
        const free = now.options.filter(o => !o.locked);
        const sel = now.kind === 'scene' ? 'dialog.ps-dialog[open]' : 'dialog.dw-dialog[open]';
        if (free.length > 0) {
            const choice = pick.find(id => free.some(o => o.id === id)) ?? (now.kind === 'dialogue' ? free.find(o => o.id === 'adios')?.id : '') ?? free[0].id;
            const option = page.locator(`${sel} .dw-option[data-option="${choice || free[0].id}"]`);
            await option.click({ timeout: 4000 }).catch(() => {});
            await page.waitForTimeout(150);
            // Con el dedo (o una opción de peso), el primer toque la enciende y el segundo la elige.
            if (await page.locator(`${sel} .dw-option.nr-armed[data-option="${choice || free[0].id}"]`).count() > 0) await option.click({ timeout: 4000 }).catch(() => {});
        } else {
            await page.locator(`${sel} .ps-next, ${sel} .ps-finish, ${sel} .dw-finish, ${sel} .dw-leave`).first().click({ timeout: 4000 }).catch(() => {});
        }
        await page.waitForTimeout(250);
    }
    return played;
}

/**
 * Hablar con alguien como antes con «Hablar con…» de la fila: con el modo guiado está en lo que pide
 * la historia, en la gente de aquí o dentro de su sitio del pueblo (`talk-local:Nombre`).
 *
 * @param {any} page
 * @param {string} names Los nombres o el oficio, como en una expresión («Tomás|el posadero»).
 * @returns {Promise<boolean>} Si se ha pulsado.
 */
export async function hablarCon(page, names) {
    const label = new RegExp(`^Hablar con (?:${names})$`);
    if (await pulsarALaVista(page, label)) return true;
    const id = new RegExp(`^(?:talk-local|story:talk):(?:${names})$`);
    const found = await buscarEnElPueblo(page, act => id.test(act.id) || label.test(act.label));
    if (!found) return false;
    return page.locator(`#game-shell .gs-town-scene .gs-town-act[data-action="${found.id}"]`).first().click({ timeout: 5000 }).then(() => true).catch(() => false);
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
 * Seguir el viaje hasta llegar: lo que sale por el camino (un mercader, un rodeo, un peaje, un
 * suceso) se pasa con «Seguir el camino» o lo que haga sus veces, como quien tiene prisa.
 *
 * @param {any} page
 * @param {() => Promise<boolean>} llegado Si ya se ha llegado.
 * @param {number} [ms]
 * @returns {Promise<boolean>}
 */
export async function seguirElCamino(page, llegado, ms = 40000) {
    return until(page, async () => {
        if (await llegado()) return true;
        await page.evaluate(() => {
            const pick = [...document.querySelectorAll('.popup:not([closing]) button, .popup:not([closing]) .menu_button, dialog[open] button')]
                .filter(b => b.getClientRects().length > 0 && !(/** @type {any} */ (b).disabled))
                .find(b => b.matches('.tr-detour, .rd-pass, .gd-pay, .su-go') || /^(Seguir el camino|Seguir|Pasar de largo)\b/.test((b.textContent || '').trim()));
            /** @type {any} */ (pick)?.click();
        });
        return false;
    }, ms);
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
