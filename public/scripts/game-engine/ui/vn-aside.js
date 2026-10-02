/**
 * Lo que no dice nadie, fuera de la caja (D-J60 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * «La figura del narrador en un juego sin conexión no la quiero» (Daniel, 2026-10-02). En la caja
 * de la novela solo habla alguien que está allí: la gente del sitio, tus compañeros o tú, al
 * elegir. Lo demás no va en la caja:
 *
 * - lo que ha cambiado («Tomás os mira mejor»), una tirada, lo que no se ha podido hacer;
 * - y el ambiente que un paquete aún trae sin `who` (de un Gem de antes de D-J60).
 *
 * Sale en un aviso pequeño encima de la caja, a la derecha (el retrato va a la izquierda), y se
 * va con la pantalla siguiente. Lo usan las ventanas de la novela: las escenas del hilo, las
 * charlas, las quedadas y las demás que comparten el marco `qd-*` (quedadas.css).
 *
 * `splitLines` es puro: dice qué va a la caja y qué al aviso. `asideBox` y `fillAside` pintan.
 */

import { shownText } from './shown-names.js';

/** Las clases de línea que no dice nadie: van al aviso, nunca a la caja. */
export const ASIDE_KINDS = Object.freeze(['narration', 'note', 'roll', 'summary', 'refused']);

/** El icono de cada clase de aviso (Font Awesome). */
const ICONS = {
    roll: 'fa-dice-d20',
    refused: 'fa-lock',
    summary: 'fa-bookmark',
    narration: 'fa-eye',
};

/**
 * Si una línea de esta clase va al aviso (no la dice nadie).
 *
 * @param {any} kind
 * @returns {boolean}
 */
export function isAsideKind(kind) {
    return ASIDE_KINDS.includes(String(kind ?? ''));
}

/**
 * Repartir las líneas de una pantalla: las que dice alguien, a la caja; las demás, al aviso.
 * El orden de cada lado se respeta.
 *
 * @template {{kind: string, text: string}} T
 * @param {T[]} lines
 * @returns {{box: T[], aside: T[]}}
 */
export function splitLines(lines) {
    /** @type {T[]} */
    const box = [];
    /** @type {T[]} */
    const aside = [];
    for (const line of Array.isArray(lines) ? lines : []) {
        if (!line || !String(line.text ?? '').trim()) continue;
        (isAsideKind(line.kind) ? aside : box).push(line);
    }
    return { box, aside };
}

/**
 * El sitio del aviso, vacío y escondido. Va dentro de la raíz de la ventana, fuera de la caja.
 *
 * @param {string} [className] `qd-aside` en las ventanas; `gs-vn-aside` en la caja del Modo Juego.
 * @returns {HTMLElement}
 */
export function asideBox(className = 'qd-aside') {
    const node = document.createElement('div');
    node.className = `vn-aside ${className}`;
    node.setAttribute('role', 'status');
    node.setAttribute('aria-live', 'polite');
    node.hidden = true;
    return node;
}

/**
 * Pintar el aviso con sus líneas (y esconderlo si no hay ninguna). Los nombres de quien aún no se
 * ha presentado salen por lo que es (J13.7), como en la caja.
 *
 * @param {HTMLElement|null} node
 * @param {Array<{kind: string, text: string}>} lines
 */
export function fillAside(node, lines) {
    if (!node) return;
    node.textContent = '';
    const shown = (Array.isArray(lines) ? lines : []).filter(line => String(line?.text ?? '').trim());
    for (const line of shown) {
        const p = document.createElement('p');
        p.className = `vn-aside-line vn-aside-${String(line.kind || 'note')}`;
        const icon = document.createElement('i');
        icon.className = `fa-solid ${ICONS[/** @type {keyof typeof ICONS} */ (line.kind)] ?? 'fa-circle-info'}`;
        icon.setAttribute('aria-hidden', 'true');
        p.appendChild(icon);
        // El icono ya dice qué es: sin el emoji que traiga delante («🎲 Persuasión…»).
        const said = String(line.text).trim().replace(/^(?:\p{Extended_Pictographic}️?\s*)+/u, '');
        p.appendChild(document.createTextNode(` ${shownText(said, { mask: true })}`));
        node.appendChild(p);
    }
    node.hidden = shown.length === 0;
}
