/**
 * «Esto no tiene vuelta atrás», en pantalla (J11.1 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * Lo que decide el motor (`campaign/weighty.js`) se ve de tres formas:
 *
 * - **En una ficha de opción** (una charla, una escena del hilo, un suceso): debajo de lo que se
 *   dice, una línea con su aviso. Sin decir qué se pierde.
 * - **Pulsar dos veces**: la primera vez la ficha se marca y pide otra pulsación; la segunda,
 *   decide. Con el teclado igual: el número dos veces. Así nadie decide lo que pesa por un
 *   dedo que se escapa.
 * - **Una acción fuera de una ventana** (entrar a pelear en el tablero que acaba la campaña):
 *   una ventana pequeña que pregunta antes, con «Seguir» y «Todavía no».
 *
 * Se abre sola, sin `party.js`. Lo propio va en decisiones.css.
 */

import { NO_RETURN, noReturnConfirm } from '../campaign/weighty.js';

/** Lo que se dice mientras una ficha espera la segunda pulsación. */
export const ARMED_HINT = 'Pulsa otra vez para decidirlo.';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [content]
 * @returns {HTMLElement}
 */
function el(tag, className = '', content = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content) node.textContent = content;
    return node;
}

/**
 * La línea del aviso, para ponerla debajo de lo que dice una opción.
 *
 * @param {string} [warn] El de la opción; vacío, el de siempre.
 * @returns {HTMLElement}
 */
export function noReturnBadge(warn = '') {
    const badge = el('span', 'nr-badge');
    badge.appendChild(el('i', 'fa-solid fa-triangle-exclamation'));
    badge.appendChild(document.createTextNode(` ${text(warn) || NO_RETURN}`));
    return badge;
}

/**
 * @typedef {Object} NoReturnGuard
 * @property {(id: string, warn?: string) => boolean} request Si se puede decidir ya: una opción
 *   sin aviso, sí; una con aviso, a la segunda.
 * @property {() => void} reset Al pintar otra vez las fichas, nada queda marcado.
 * @property {() => string} armed La que espera la segunda pulsación, o vacío.
 */

/**
 * Pedir dos pulsaciones para lo que pesa. Marca la ficha (`data-option`) dentro de `container`.
 *
 * @param {HTMLElement} container Donde están las fichas.
 * @returns {NoReturnGuard}
 */
export function noReturnGuard(container) {
    let armed = '';
    const clear = () => {
        for (const button of container.querySelectorAll('.nr-armed')) {
            button.classList.remove('nr-armed');
            button.querySelector('.nr-hint')?.remove();
        }
    };
    return {
        request(id, warn = '') {
            if (!text(warn)) return true;
            if (armed === id) {
                armed = '';
                clear();
                return true;
            }
            clear();
            armed = id;
            const button = [...container.querySelectorAll('[data-option]')].find(b => /** @type {HTMLElement} */ (b).dataset.option === id);
            if (button) {
                button.classList.add('nr-armed');
                const hint = el('span', 'nr-hint', ARMED_HINT);
                (button.querySelector('.dw-body') ?? button).appendChild(hint);
                /** @type {HTMLElement} */ (button).focus();
            }
            return false;
        },
        reset() {
            armed = '';
        },
        armed() {
            return armed;
        },
    };
}

/**
 * Preguntar antes de una acción que pesa, fuera de una charla: una ventana pequeña, con lo que
 * se va a hacer y el aviso. Escape o «Todavía no» es que no.
 *
 * @param {Object} input
 * @param {string} input.warning El de `actionNoReturn`.
 * @param {string} [input.what] Lo que se va a hacer: «Entrar en El salón del trono».
 * @param {HTMLElement|null} [input.mount]
 * @returns {Promise<boolean>}
 */
export function confirmNoReturn({ warning, what = '', mount = null }) {
    const said = noReturnConfirm({ warning, what });
    const dialog = /** @type {HTMLDialogElement} */ (el('dialog', 'nr-dialog'));
    dialog.setAttribute('aria-label', said.title);
    const box = el('div', 'nr-box');
    const head = el('div', 'nr-title');
    head.appendChild(el('i', 'fa-solid fa-triangle-exclamation'));
    head.appendChild(document.createTextNode(` ${said.title}`));
    const body = el('p', 'nr-text', said.text);
    const row = el('div', 'nr-buttons');
    const ok = /** @type {HTMLButtonElement} */ (el('button', 'nr-ok', said.ok));
    const cancel = /** @type {HTMLButtonElement} */ (el('button', 'nr-cancel', said.cancel));
    ok.type = 'button';
    cancel.type = 'button';
    row.append(cancel, ok);
    box.append(head, body, row);
    dialog.appendChild(box);
    (mount ?? document.querySelector('.gs-root') ?? document.body).appendChild(dialog);
    dialog.showModal();
    // Lo seguro, a mano: Intro sin pensar no decide nada que pese.
    cancel.focus();
    return new Promise(resolve => {
        const done = (/** @type {boolean} */ yes) => {
            dialog.close();
            dialog.remove();
            resolve(yes);
        };
        ok.addEventListener('click', () => done(true));
        cancel.addEventListener('click', () => done(false));
        dialog.addEventListener('cancel', (event) => {
            event.preventDefault();
            done(false);
        });
        dialog.addEventListener('keydown', (event) => event.stopPropagation());
    });
}
