/**
 * Para las vueltas de prueba (tanda 10): entrar en la pelea de un tablero como quien juega.
 *
 * Ya no hay ficha ni botón de «Iniciar combate»: al ver el tablero con enemigos que os ven, la
 * pelea se abre sola. Esto hace lo que haría quien juega hasta que hay pelea:
 *
 * 1. Si se está leyendo la novela, «Continuar» lleva al tablero (es donde se abre la pelea).
 * 2. Si sale la decisión (`dialog.ev-avoid`), elige la opción pedida (por defecto, «Pelear»).
 * 3. Si sale la barra de colocar (`.cv-place`), pulsa «Empezar» (o deja que la vuelta coloque
 *    antes, con `place: false`).
 *
 * Si nada de eso sale (un tablero sin pantalla del Modo Juego, por ejemplo), no hace trampas:
 * devuelve `false` y la vuelta lo dice.
 */

/* global window, document, HTMLElement */

/**
 * @param {any} page La página de Playwright.
 * @param {Object} [options]
 * @param {string} [options.choose] La salida de la decisión: `pelear` (por defecto) o el id de otra.
 * @param {boolean} [options.place] Si pulsa «Empezar» él mismo (por defecto, sí).
 * @param {number} [options.ms] Cuánto espera como mucho.
 * @returns {Promise<boolean>} Si hay pelea (o, con `place: false`, si se está colocando).
 */
export async function entrarEnLaPelea(page, { choose = 'pelear', place = true, ms = 30000 } = {}) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
        const step = await page.evaluate(({ wanted, pressStart }) => {
            const ctx = window.SillyTavern.getContext();
            if (ctx.chatMetadata?.combatEncounter?.active) return 'fighting';
            const option = document.querySelector(`dialog.ev-avoid[open] [data-exit="${wanted}"]`);
            if (option instanceof HTMLElement) {
                option.click();
                return 'chose';
            }
            // Tras elegir otra salida, la ventana dice lo que ha pasado y una ficha sigue.
            const next = document.querySelector('dialog.ev-avoid[open] .ev-next');
            if (next instanceof HTMLElement) {
                next.click();
                return 'next';
            }
            const start = document.querySelector('.cv-place .cv-place-start');
            if (start instanceof HTMLElement) {
                if (!pressStart) return 'placing';
                start.click();
                return 'started';
            }
            const shell = document.querySelector('#game-shell');
            if (shell && shell.getAttribute('data-scene') !== 'combat') {
                const go = document.querySelector('#game-shell .gs-vn-box .gs-chip-continue');
                if (go instanceof HTMLElement) {
                    go.click();
                    return 'continue';
                }
            }
            return 'waiting';
        }, { wanted: choose, pressStart: place });
        if (step === 'fighting') return true;
        if (step === 'placing') return true;
        // Los dados de la iniciativa los pasa cada vuelta a su manera (alguna los mira).
        await page.waitForTimeout(step === 'waiting' ? 400 : 250);
    }
    return false;
}

/**
 * Cómo va la entrada en la pelea, leído de la pantalla: si está la decisión, la barra de colocar,
 * y las opciones de la decisión.
 *
 * @param {any} page
 * @returns {Promise<{deciding: boolean, options: string[], closable: boolean, placing: boolean, faces: number, fighting: boolean}>}
 */
export function comoVaLaEntrada(page) {
    return page.evaluate(() => ({
        deciding: Boolean(document.querySelector('dialog.ev-avoid[open]')),
        options: [...document.querySelectorAll('dialog.ev-avoid[open] [data-exit]')].map(b => String(b.getAttribute('data-exit'))),
        closable: Boolean(document.querySelector('dialog.ev-avoid[open] .ev-close')),
        placing: Boolean(document.querySelector('.cv-place')),
        faces: document.querySelectorAll('.cv-place .cv-place-face').length,
        fighting: Boolean(window.SillyTavern.getContext().chatMetadata?.combatEncounter?.active),
    }));
}
