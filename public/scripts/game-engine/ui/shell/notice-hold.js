/**
 * Los avisos esperan a la tarjeta del centro (H18 de las vueltas, tanda 22).
 *
 * Al ganar, al llegar a un final o al volver al gremio salen a la vez una tarjeta en el centro (la
 * victoria o la derrota, el final de la campaña, el Salón de la fama) y varios avisos («Fama»,
 * «Final», «Tras la pelea — Gerd quiere decirte algo», «Lo que tienes entre manos»). Los avisos
 * salían arriba en el centro, justo encima del título de la tarjeta, y se leía «Final: La anar…».
 *
 * Ahora, mientras hay una de esas tarjetas, los avisos nuevos se apuntan pero no se ven ni corre
 * su tiempo; los que ya estaban se paran y se esconden. Al cerrarse la tarjeta salen todos, con su
 * tiempo entero. Los errores no esperan: son para verlos ya.
 *
 * Lo de decidir es puro (`noticeWaits`, `heldTimeout`, `waitingOptions`); `installNoticeHold`
 * mira el documento y mueve los avisos de toastr.
 */

/**
 * Las tarjetas del centro: la de victoria o derrota (y la escondida que la anuncia), la del final,
 * el Salón de la fama y la del grupo caído. Y las conversaciones de novela visual (`.qd-dialog`):
 * son modales, y un aviso que salía mientras tanto quedaba debajo, sin verse ni poder pulsarse
 * («Escuchar»), y se iba solo antes de que acabara la escena que abría la victoria.
 */
export const CENTER_CARDS = 'body > .vs-card, dialog[open] .end-root, dialog[open] .hall-root, dialog[open] .pf-root, dialog[open].qd-dialog';

/** La clase de un aviso que espera. */
export const HELD_CLASS = 'gs-toast-held';

/** Lo que dura un aviso si no lo dice nadie (el valor de toastr). */
const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Lo que se espera, cerrada la tarjeta, antes de soltar los avisos: tras la victoria sale a veces
 * la escena que abría (en cuanto se puede, unos 300 ms); sin esto se veían un instante entre las dos.
 */
const RELEASE_DELAY_MS = 600;

/**
 * Si un aviso nuevo espera: solo en el Modo Juego, con una tarjeta en el centro, y si no es un error.
 *
 * @param {{kind: string, shellOpen: boolean, cardUp: boolean}} input
 * @returns {boolean}
 */
export function noticeWaits({ kind, shellOpen, cardUp }) {
    return Boolean(shellOpen && cardUp) && String(kind) !== 'error';
}

/**
 * Cuánto tiene que durar el aviso cuando por fin se vea: el suyo, el de toastr o el de siempre.
 * Cero es «hasta que se cierre a mano», y se respeta.
 *
 * @param {any} opts Las opciones de esa llamada.
 * @param {any} [defaults] `toastr.options`.
 * @returns {number}
 */
export function heldTimeout(opts, defaults) {
    for (const value of [opts?.timeOut, defaults?.timeOut]) {
        const ms = Number(value);
        if (value !== undefined && value !== null && value !== '' && Number.isFinite(ms) && ms >= 0) return ms;
    }
    return DEFAULT_TIMEOUT_MS;
}

/**
 * Las opciones de un aviso que espera: sin tiempo (no se va solo); lo cierra quien lo suelta.
 *
 * @param {any} opts
 * @returns {Record<string, any>}
 */
export function waitingOptions(opts) {
    return { ...(opts && typeof opts === 'object' ? opts : {}), timeOut: 0, extendedTimeOut: 0 };
}

/** @typedef {{el: any, timeOut: number}} HeldNotice */

/** @type {HeldNotice[]} */
let held = [];
/** @type {MutationObserver|null} */
let observer = null;
/** @type {any} */
let toast = null;
/** @type {() => boolean} */
let shellIsOpen = () => false;
/** Mientras hay avisos esperando, se mira cada poco si la tarjeta sigue (una ventana quitada de dentro de otra no avisa). */
let poll = 0;
/** La suelta que espera a ver si sale otra tarjeta. */
let releaseTimer = 0;
/**
 * El contenedor de los avisos, visto la última vez. SillyTavern lo mete dentro de la ventana que
 * esté abierta (`fixToastrForDialogs`, para que se vean encima); si esa ventana se quita (una
 * escena de novela visual al acabar), se iba con ella, y con los avisos que esperaban dentro: la
 * charla de después de pelear («Escuchar») no salía nunca.
 *
 * @type {HTMLElement|null}
 */
let lastContainer = null;

/**
 * Si hay ahora una tarjeta en el centro.
 *
 * @param {Document} [doc]
 * @returns {boolean}
 */
export function centerCardUp(doc = typeof document === 'undefined' ? undefined : document) {
    return Boolean(doc?.querySelector?.(CENTER_CARDS));
}

/**
 * Dejar un aviso esperando: escondido y quieto.
 *
 * @param {any} el El aviso (lo que devuelve toastr: un objeto de jQuery).
 * @param {number} timeOut Lo que durará al soltarlo.
 */
export function holdNotice(el, timeOut) {
    if (!el || typeof el.addClass !== 'function') return;
    // Si ya se había soltado (y corría su tiempo), su tiempo se para otra vez.
    const running = typeof el.data === 'function' ? el.data('gsHoldClear') : 0;
    if (running) clearTimeout(running);
    el.addClass(HELD_CLASS);
    held.push({ el, timeOut });
    if (!poll && typeof document !== 'undefined') poll = Number(setInterval(check, 500));
}

/** Soltar los que esperan: se ven, y se van a su tiempo. */
function releaseAll() {
    const list = held;
    held = [];
    if (poll) clearInterval(poll);
    poll = 0;
    for (const { el, timeOut } of list) {
        if (!el?.closest || el.closest('body').length === 0) continue;
        el.removeClass(HELD_CLASS);
        if (timeOut > 0) {
            const timer = setTimeout(() => toast?.clear?.(el, { force: true }), timeOut);
            if (typeof el.data === 'function') el.data('gsHoldClear', timer);
        }
    }
}

/** Con una tarjeta delante: los avisos que ya estaban (o que han salido sin pasar por aquí) se paran y esperan también. */
function holdShown() {
    const $ = /** @type {any} */ (globalThis).jQuery;
    if (typeof $ !== 'function') return;
    $('#toast-container > .toast').not(`.${HELD_CLASS}`).not('.toast-error').each((/** @type {number} */ _, /** @type {HTMLElement} */ node) => {
        const el = $(node);
        // toastr para su reloj al pasar el ratón por encima: lo mismo, sin ratón.
        el.trigger('mouseenter');
        holdNotice(el, heldTimeout(null, toast?.options));
    });
}

/** Si el contenedor de los avisos se ha ido con una ventana quitada, sus avisos vuelven a la página. */
function rescueContainer() {
    if (typeof document === 'undefined') return;
    const live = document.getElementById('toast-container');
    if (lastContainer && lastContainer !== live && !lastContainer.isConnected && lastContainer.querySelector('.toast')) {
        if (live) live.append(...lastContainer.querySelectorAll(':scope > .toast'));
        else document.body.appendChild(lastContainer);
    }
    lastContainer = document.getElementById('toast-container');
}

/**
 * Mirar si hay una tarjeta del centro: con ella, todo aviso a la vista espera; sin ella, salen
 * los que esperaban. Sin marcas de «ya estaba esperando»: una que se quedara puesta (una ventana
 * quitada sin cerrarse) dejaba pasar los avisos de la tarjeta siguiente.
 */
function check() {
    rescueContainer();
    const up = shellIsOpen() && centerCardUp();
    if (up) {
        if (releaseTimer) clearTimeout(releaseTimer);
        releaseTimer = 0;
        holdShown();
    } else if (held.length > 0 && !releaseTimer) {
        releaseTimer = Number(setTimeout(() => {
            releaseTimer = 0;
            if (!(shellIsOpen() && centerCardUp())) releaseAll();
        }, RELEASE_DELAY_MS));
    }
}

/**
 * Empezar a mirar el documento (una vez). Quien envuelve a toastr pregunta luego `noticeWaits`
 * y, si espera, crea el aviso con `waitingOptions` y lo pasa a `holdNotice`.
 *
 * @param {any} toastr
 * @param {() => boolean} shellOpen
 */
export function installNoticeHold(toastr, shellOpen) {
    toast = toastr;
    shellIsOpen = shellOpen;
    if (observer || typeof MutationObserver === 'undefined' || !document?.body) return;
    // Las tarjetas y las ventanas cuelgan del body (solo sus hijos: lo de dentro del tablero cambia
    // sin parar y no importa); las ventanas se abren y cierran con `open`, estén donde estén.
    observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true });
    new MutationObserver(check).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
}
