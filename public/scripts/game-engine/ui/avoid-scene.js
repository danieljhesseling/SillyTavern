/**
 * Otra salida, en su ventana (J12.2 y J8.5 de wiki/ROADMAP_SIN_CONEXION.md): la elección antes
 * de una pelea escrita (hablar, pagar, huir o esconderse) y, en mitad de ella, hablar para salir
 * (entregarse, sobornar, convencer o engañar), como una escena de novela visual.
 *
 * Quien manda de los que esperan sale grande, con su cara si está dibujada, y su nombre en la
 * placa; en la caja, lo que pasa y lo que se puede hacer, cada cosa con su tirada, quién tira,
 * lo que cuesta y lo que se gana. Lo que no se puede sale apagado, con el porqué. Al elegir, la
 * misma caja dice lo que has hecho, la tirada y lo que ha pasado, y una sola ficha sigue.
 *
 * El mismo marco que las escenas del hilo (`plot-scene.js`: clases `qd-*`, `dw-*` y `ps-*`); lo
 * propio va en peleas.css, colgado de `.ev-dialog`.
 *
 * Se abre sola, sin `party.js`: tirar y aplicar lo hace quien la abre (`onPick`); la ventana
 * solo lo enseña. Teclas: del 1 al 9 eligen, Intro sigue y Escape cierra sin elegir.
 */

import { loadPixelManifest, firstArt } from './pixel-art.js';
import { portraitFor, backdropFor } from './meetup-scene.js';

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
 * @typedef {Object} ExitChoice Una opción de la caja.
 * @property {string} id
 * @property {string} label «Hablar», «Pelear».
 * @property {string} icon La clase de Font Awesome («fa-comments»).
 * @property {string} text Lo que se hace, visto desde quien juega.
 * @property {string} [check] La tirada: «Persuasión · CD 13».
 * @property {string} [who] Quién tira: «Tira Bran (+5)».
 * @property {string} [cost] Lo que cuesta: «Cuesta 20 de oro».
 * @property {string} [win] Lo que se gana: «Si sale, no hay pelea».
 * @property {string} [locked] Por qué no se puede, o vacío.
 */

/**
 * @typedef {Object} ExitOutcome Lo que pasó al elegir, para enseñarlo.
 * @property {string} said Lo que has hecho, en tu boca.
 * @property {string[]} rolls Las tiradas, ya escritas.
 * @property {string[]} lines Lo que pasa.
 * @property {string[]} notes Lo que ha cambiado (el oro, un día, quién os mira peor…).
 * @property {string} next La ficha que sigue: «¡A pelear!», «Seguir», «Salir del tablero».
 */

/**
 * Las fichas como se ven: la tecla (las que se pueden elegir, del 1 al 9), el detalle en una
 * línea y si está cerrada.
 *
 * @param {ExitChoice[]} choices
 * @returns {Array<ExitChoice & {key: string, detail: string}>}
 */
export function exitChips(choices) {
    let key = 0;
    return (Array.isArray(choices) ? choices : []).filter(c => text(c?.id)).map(choice => ({
        ...choice,
        key: !text(choice.locked) && key < 9 ? String(++key) : '',
        detail: [choice.who, choice.cost, choice.win].map(text).filter(Boolean).join(' · '),
    }));
}

/**
 * Abrir la elección.
 *
 * @param {Object} input
 * @param {string} input.title Lo que dice arriba («El cuarto de la posada»).
 * @param {string} [input.speaker] Quien manda de los que esperan: su cara y su nombre.
 * @param {string[]} input.intro Lo que pasa, antes de elegir.
 * @param {ExitChoice[]} input.choices
 * @param {(id: string) => Promise<ExitOutcome|null>} input.onPick Tirar y aplicar. Nulo: la
 *   opción no hace nada que enseñar (pelear sin más) y la ventana se cierra.
 * @param {string} [input.pack] Para los retratos y el escenario.
 * @param {string} [input.town] La localización, para el fondo.
 * @param {boolean} [input.night]
 * @param {string} [input.kind] `avoid` (antes de pelear) o `parley` (en mitad): para las pruebas y el estilo.
 * @param {HTMLElement|null} [input.mount]
 * @returns {Promise<{picked: string, outcome: ExitOutcome|null}>} `picked` vacío si se cerró sin elegir.
 */
export async function openExitScene({
    title, speaker = '', intro, choices, onPick, pack = '', town = '', night = false, kind = 'avoid', mount = null,
}) {
    await loadPixelManifest().catch(() => null);
    const dialog = /** @type {HTMLDialogElement} */ (el('dialog', `qd-dialog dw-dialog ps-dialog ev-dialog ev-${kind}`));
    dialog.setAttribute('aria-label', text(title) || 'Otra salida');
    (mount ?? document.querySelector('.gs-root') ?? document.body).appendChild(dialog);
    dialog.showModal();

    const root = el('div', 'qd-root dw-root ps-root ev-root');
    root.dataset.kind = kind;
    const backdrop = el('div', 'qd-backdrop');
    const art = backdropFor({ town, pack, night });
    if (art) backdrop.style.setProperty('--qd-backdrop', `url("${new URL(art, document.baseURI).href}")`);
    backdrop.hidden = !art;
    const portrait = el('div', 'qd-portrait ps-portrait ev-portrait');
    const box = el('div', 'qd-box dw-box ps-box ev-box');
    const plate = el('div', 'qd-nameplate');
    const head = el('div', 'qd-head');
    head.append(el('span', 'qd-title', text(title)));
    const lines = el('div', 'qd-text dw-text ps-text ev-text');
    lines.setAttribute('aria-live', 'polite');
    const chips = el('div', 'qd-chips dw-options ps-chips ev-chips');
    const foot = el('div', 'qd-foot dw-foot');
    box.append(plate, head, lines, chips, foot);
    root.append(backdrop, portrait, box);
    dialog.appendChild(root);

    // La cara de quien manda: la de su paquete, o su dibujo de criatura; si no, la silueta.
    const who = text(speaker);
    plate.textContent = who;
    plate.hidden = !who;
    portrait.hidden = !who;
    if (who) {
        const url = portraitFor({ name: who, pack }) || firstArt('creature', { name: who });
        if (url) {
            const image = /** @type {HTMLImageElement} */ (el('img', 'pixel-art qd-pixel'));
            image.src = url;
            image.alt = who;
            image.addEventListener('error', () => {
                image.remove();
                portrait.appendChild(el('i', 'fa-solid fa-user qd-silhouette'));
            });
            portrait.appendChild(image);
        } else {
            portrait.appendChild(el('i', 'fa-solid fa-user qd-silhouette'));
        }
    }

    const shown = exitChips(choices);
    let busy = false;
    /** @type {ExitOutcome|null} */
    let result = null;
    let picked = '';

    return new Promise(resolve => {
        const close = () => {
            dialog.close();
            dialog.remove();
            resolve({ picked, outcome: result });
        };

        const line = (/** @type {string} */ className, /** @type {string} */ said) => {
            if (!text(said)) return;
            lines.appendChild(el('p', `qd-line ${className}`, text(said)));
        };

        const chip = (/** @type {string} */ className, /** @type {() => void} */ onClick) => {
            const button = /** @type {HTMLButtonElement} */ (el('button', className));
            button.type = 'button';
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                onClick();
            });
            return button;
        };

        const drawChoice = () => {
            root.classList.add('ps-asking');
            lines.textContent = '';
            for (const said of intro ?? []) line('qd-note ps-narration', said);
            chips.textContent = '';
            for (const option of shown) {
                const button = chip(`qd-chip dw-option ps-option ev-option${option.locked ? ' dw-locked' : ''}${option.check ? ' dw-has-check' : ''}`, () => {
                    if (!option.locked) void pick(option.id);
                });
                button.dataset.exit = option.id;
                if (option.locked) {
                    button.setAttribute('aria-disabled', 'true');
                    button.title = text(option.locked);
                }
                button.appendChild(el('span', 'qd-key', option.locked ? '' : option.key));
                const body = el('span', 'dw-body');
                const saying = el('span', 'dw-said');
                const tag = el('span', 'dw-tag ev-tag');
                if (option.icon) tag.appendChild(el('i', `fa-solid ${option.icon}`));
                tag.appendChild(document.createTextNode(` ${text(option.label)}`));
                saying.appendChild(tag);
                saying.appendChild(document.createTextNode(text(option.text)));
                body.appendChild(saying);
                if (option.locked) {
                    const why = el('span', 'dw-why');
                    why.appendChild(el('i', 'fa-solid fa-lock'));
                    why.appendChild(document.createTextNode(` ${text(option.locked)}`));
                    body.appendChild(why);
                } else if (option.detail) {
                    body.appendChild(el('span', 'ev-detail', option.detail));
                }
                button.appendChild(body);
                if (option.check) {
                    const check = el('span', 'dw-check');
                    check.appendChild(el('i', 'fa-solid fa-dice-d20'));
                    check.appendChild(document.createTextNode(` ${text(option.check)}`));
                    button.appendChild(check);
                }
                chips.appendChild(button);
            }
            foot.textContent = '';
            const leave = chip('qd-leave ev-close', () => close());
            leave.textContent = 'Todavía no';
            leave.title = 'Cerrar sin decidir';
            foot.appendChild(leave);
            /** @type {HTMLElement|null} */ (chips.querySelector('.dw-option:not(.dw-locked)'))?.focus();
        };

        const drawOutcome = (/** @type {ExitOutcome} */ outcome) => {
            root.classList.remove('ps-asking');
            lines.textContent = '';
            if (text(outcome.said)) {
                const p = el('p', 'qd-line qd-you ps-you');
                p.appendChild(el('span', 'qd-who', 'Tú'));
                p.appendChild(document.createTextNode(text(outcome.said)));
                lines.appendChild(p);
            }
            for (const roll of outcome.rolls ?? []) line('dw-roll ev-roll', roll);
            for (const said of outcome.lines ?? []) line('qd-note ps-narration ev-outcome', said);
            for (const note of outcome.notes ?? []) line('qd-note dw-note ev-change', note);
            lines.scrollTop = lines.scrollHeight;
            chips.textContent = '';
            foot.textContent = '';
            const next = chip('qd-chip qd-chip-finish ps-finish ev-next', () => close());
            next.append(el('span', 'qd-key', '↵'), el('span', 'qd-label', text(outcome.next) || 'Seguir'));
            chips.appendChild(next);
            next.focus();
        };

        const pick = async (/** @type {string} */ id) => {
            if (busy || result) return;
            busy = true;
            try {
                picked = id;
                const outcome = await onPick(id);
                if (!outcome) {
                    close();
                    return;
                }
                result = outcome;
                drawOutcome(outcome);
            } catch (error) {
                console.error('[salidas] no se pudo resolver la salida', error);
                picked = '';
                line('qd-note ps-refused', 'No ha salido: inténtalo otra vez.');
            } finally {
                busy = false;
            }
        };

        dialog.addEventListener('cancel', (event) => {
            event.preventDefault();
            if (!busy) close();
        });
        dialog.addEventListener('keydown', (event) => {
            // Lo que se pulsa aquí es de la ventana, no del Modo Juego que hay detrás.
            event.stopPropagation();
            if (!result && /^[1-9]$/.test(event.key)) {
                const option = shown.find(o => o.key === event.key);
                if (option) {
                    event.preventDefault();
                    void pick(option.id);
                }
            } else if (result && (event.key === 'Enter' || event.key === ' ') && !(event.target instanceof HTMLButtonElement)) {
                event.preventDefault();
                close();
            }
        });
        // Tras elegir, un toque en cualquier sitio sigue (con el dedo, la ficha queda lejos).
        root.addEventListener('click', (event) => {
            if (!result || (event.target instanceof Element && event.target.closest('button'))) return;
            close();
        });
        drawChoice();
    });
}
