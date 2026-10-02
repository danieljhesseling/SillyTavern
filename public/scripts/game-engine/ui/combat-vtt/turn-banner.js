/**
 * Tanda 17 (Daniel, 2026-10-02): «Quiero que se vea de quién es el turno de cada uno, para que el
 * usuario sepa que le toca a él». Al empezar cada turno sale un cartel grande encima del tablero
 * («Tu turno, Laedor», en oro; «Turno del ratero del muelle», en rojo) que se desvanece solo.
 *
 * El tablero se dibuja entero tras cada cosa que pasa, así que el cartel no va dentro de él: va
 * en la raíz del juego (`.gs-root`), fijo encima del tablero, y un redibujado no lo corta. Si en
 * ese momento hay algo encima (los dados, una ventana, la tarjeta de un enemigo), espera a que se
 * cierre: un cartel detrás de los dados no lo lee nadie.
 *
 * Con «reducir movimiento» (ui/motion.js) sale y se va sin moverse ni desvanecerse.
 *
 * Lo que dice (`turnBannerText`) es puro y tiene sus pruebas; lo demás toca la página.
 */

import { withArticle } from '../../combat/avoid-fight.js';
import { motionLevel, motionMs } from '../motion.js';

/** @typedef {'yours'|'ally'|'enemy'} TurnSide De quién es el turno: tuyo, de un compañero que lleva el juego o de un enemigo. */

/** Lo que dura el cartel a la vista, sin contar lo que tarda en aparecer y en irse. */
export const BANNER_HOLD_MS = 1100;
/** Lo que tarda en aparecer. */
export const BANNER_IN_MS = 180;
/** Lo que tarda en irse. */
export const BANNER_OUT_MS = 450;
/** Lo más que espera a que se cierren los dados o una ventana: después, el turno ya es viejo. */
export const BANNER_WAIT_MS = 15000;

/**
 * Lo que tapa el tablero: mientras esté, el cartel espera. También el de «¡INICIATIVA!» al empezar
 * la pelea (combat-flow.js), que dice primero que esto es un combate.
 */
const COVERS = '.wm-dice-overlay.active, dialog[open], .tc-overlay, .cv-place, body.game-shell-paused, .ib-banner:not(.ib-out)';

/**
 * Lo que, si sale con el cartel a la vista, lo quita antes de tiempo: la tarjeta del dado de un
 * golpe (`fx.js`), los dados de antes, una ventana. El cartel no se queda encima de una tirada.
 */
const CUTS = '.vfx-card:not(.vfx-out), .wm-dice-overlay.active, dialog[open], .tc-overlay';

/**
 * Lo que dice el cartel.
 *
 * - Tuyo: «Tu turno, Laedor».
 * - De un enemigo con nombre de lo que es: «Turno del ratero del muelle», «Turno de la bruja del
 *   pantano». Con nombre propio: «Turno de Torres».
 * - De un compañero que juega el juego: «Turno de Mirela».
 *
 * @param {{name: string, side: TurnSide}} input
 * @returns {string}
 */
export function turnBannerText({ name, side }) {
    const said = String(name ?? '').trim();
    if (!said) return side === 'yours' ? 'Tu turno' : '';
    if (side === 'yours') return `Tu turno, ${said}`;
    const named = withArticle(said);
    if (named.startsWith('El ')) return `Turno del ${named.slice(3)}`;
    if (named.startsWith('La ')) return `Turno de la ${named.slice(3)}`;
    return `Turno de ${said}`;
}

/**
 * Si toca anunciar un turno: uno nuevo, distinto del último anunciado.
 *
 * @param {string} key El turno (ronda y quién), o vacío fuera de combate.
 * @param {string} last El último anunciado.
 * @returns {boolean}
 */
export function shouldAnnounce(key, last) {
    const now = String(key ?? '');
    return Boolean(now) && now !== String(last ?? '');
}

// ---------------------------------------------------------------- lo que toca la página

/**
 * @typedef {Object} TurnAnnouncement
 * @property {string} key El turno: ronda y quién.
 * @property {string} text Lo que dice (`turnBannerText`).
 * @property {TurnSide} side
 * @property {() => (HTMLElement|null)} anchor El tablero de ahora (el de antes puede haberse ido).
 * @property {() => ({x: number, y: number}|null)} [at] Dónde va el cartel en la pantalla: en el centro
 *   de lo que se mira del tablero, sin lo que tapa el HUD. Sin esto, a un tercio del alto del tablero.
 */

/** El último turno anunciado, lo que espera a salir y el cartel a la vista. */
const banner = {
    last: '',
    /** @type {TurnAnnouncement|null} */
    pending: null,
    since: 0,
    timer: 0,
    /** @type {HTMLElement|null} */
    node: null,
};

/**
 * Anuncia el turno, si es nuevo: el cartel sale en cuanto no haya nada encima del tablero.
 *
 * @param {TurnAnnouncement} input
 * @returns {boolean} Si es un turno nuevo.
 */
export function announceTurn(input) {
    if (!input) return false;
    // El mismo turno, que aún espera a salir, desde un tablero redibujado: que salga en el nuevo.
    if (banner.pending && String(input.key) === banner.pending.key) {
        banner.pending = { ...banner.pending, anchor: input.anchor, at: input.at };
        return false;
    }
    if (!shouldAnnounce(input.key, banner.last)) return false;
    banner.last = String(input.key);
    if (!input.text) return true;
    banner.pending = input;
    banner.since = Date.now();
    window.clearTimeout(banner.timer);
    tryShow();
    return true;
}

/**
 * Fuera de combate: lo anunciado se olvida, para que la próxima pelea (en el mismo tablero y con
 * el mismo héroe primero, «1:id») tenga su cartel. Lo que esperaba a salir, ya no sale.
 */
export function forgetTurn() {
    window.clearTimeout(banner.timer);
    banner.last = '';
    banner.pending = null;
}

/** El cartel a la vista, si hay alguno (para las pruebas). */
export function turnBannerNode() {
    return banner.node?.isConnected ? banner.node : null;
}

/** Para las pruebas: olvidar lo anunciado y quitar el cartel. */
export function resetTurnBanner() {
    forgetTurn();
    banner.node?.remove();
    banner.node = null;
}

/** Saca el cartel que espera, o vuelve a mirar dentro de un momento si algo tapa el tablero. */
function tryShow() {
    const wanted = banner.pending;
    if (!wanted) return;
    const board = wanted.anchor();
    if (Date.now() - banner.since > BANNER_WAIT_MS || (board && !board.isConnected)) {
        banner.pending = null;
        return;
    }
    // Con el tablero escondido (otra escena) o tapado, se espera.
    const box = board?.getBoundingClientRect();
    if (!board || !box || box.width < 40 || box.height < 40 || document.querySelector(COVERS)) {
        banner.timer = window.setTimeout(tryShow, 150);
        return;
    }
    banner.pending = null;
    show(wanted, board, box);
}

/**
 * @param {TurnAnnouncement} wanted
 * @param {HTMLElement} board
 * @param {DOMRect} box Dónde está el tablero en la pantalla.
 */
function show(wanted, board, box) {
    banner.node?.remove();
    const node = document.createElement('div');
    node.className = 'vtt-turn-banner';
    node.dataset.side = wanted.side;
    node.setAttribute('role', 'status');
    node.setAttribute('aria-live', 'polite');
    const icon = document.createElement('i');
    icon.className = `fa-solid ${wanted.side === 'enemy' ? 'fa-skull' : wanted.side === 'yours' ? 'fa-hand-fist' : 'fa-user-shield'}`;
    icon.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.className = 'vtt-turn-banner-text';
    text.textContent = wanted.text;
    node.append(icon, text);
    // En lo que se mira del tablero, a un tercio de su alto: encima de las fichas y lejos de la barra.
    let spot = null;
    try {
        spot = wanted.at?.() ?? null;
    } catch { /* sin cámara: a un tercio del tablero */ }
    node.style.left = `${Math.round(spot?.x ?? box.left + box.width / 2)}px`;
    node.style.top = `${Math.round(spot?.y ?? box.top + box.height * 0.34)}px`;
    (board.closest('.gs-root') ?? document.body).appendChild(node);
    banner.node = node;

    const still = motionLevel() === 'none';
    const fadeIn = motionMs(BANNER_IN_MS);
    const fadeOut = motionMs(BANNER_OUT_MS);
    const total = fadeIn + BANNER_HOLD_MS + fadeOut;
    if (!still && typeof node.animate === 'function') {
        node.animate([
            { opacity: 0, transform: 'translate(-50%, -50%) scale(0.9)' },
            { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: fadeIn / total },
            { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: (fadeIn + BANNER_HOLD_MS) / total },
            { opacity: 0, transform: 'translate(-50%, -50%) scale(1)' },
        ], { duration: total, easing: 'ease-out', fill: 'forwards' });
    }
    const gone = () => {
        window.clearInterval(watch);
        window.clearTimeout(end);
        node.remove();
        if (banner.node === node) banner.node = null;
    };
    const end = window.setTimeout(gone, total);
    // Si sale la tirada de un golpe mientras se lee, el cartel se va: no tapa el dado.
    const watch = window.setInterval(() => {
        if (!node.isConnected) {
            gone();
            return;
        }
        if (!document.querySelector(CUTS)) return;
        window.clearInterval(watch);
        if (still || typeof node.animate !== 'function') {
            gone();
            return;
        }
        node.getAnimations().forEach(run => run.cancel());
        node.animate([{ opacity: 1 }, { opacity: 0 }], { duration: motionMs(150), fill: 'forwards' });
        window.clearTimeout(end);
        window.setTimeout(gone, motionMs(150));
    }, 120);
}
