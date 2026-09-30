/**
 * Una pregunta corta, como en una novela visual (D-J53 de wiki/ROADMAP_SIN_CONEXION.md): la cara
 * de quien la hace, grande; en la caja, lo que pasa y la pregunta; y dos fichas, «Sí» y «No».
 *
 * La primera: al llegar de un viaje con alguien herido y alguien que cura con magia, «¿Curar a
 * Bran con magia? (gasta un espacio de nivel 1)». El mismo marco que las quedadas y las charlas
 * (`qd-*`, quedadas.css).
 *
 * Se abre sola, sin `party.js`: dice qué se eligió y quien la abre lo hace. Teclas: 1 (o S) es
 * sí, 2 (o N) es no; Escape es no.
 */

import { loadPixelManifest } from './pixel-art.js';
import { portraitFor, backdropFor } from './meetup-scene.js';
import { faceElement } from './hero-face.js';

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
 * Preguntar.
 *
 * @param {Object} input
 * @param {string} input.title Lo que dice arriba («Al llegar»).
 * @param {any} [input.who] Quien pregunta (una ficha del grupo: nombre, clase, cara…), para su
 *   cara y su nombre en la placa. Sin él, la pregunta es del narrador.
 * @param {string[]} [input.notes] Lo que pasa, antes de la pregunta.
 * @param {string} input.question
 * @param {string} [input.yes]
 * @param {string} [input.no]
 * @param {string} [input.kind] Para las pruebas y el estilo (`curar`).
 * @param {string} [input.pack]
 * @param {string} [input.town]
 * @param {boolean} [input.night]
 * @param {HTMLElement|null} [input.mount]
 * @returns {Promise<boolean>} Si se dijo que sí.
 */
export async function askInScene({
    title, who = null, notes = [], question, yes = 'Sí', no = 'No', kind = '', pack = '', town = '', night = false, mount = null,
}) {
    await loadPixelManifest().catch(() => null);
    const dialog = /** @type {HTMLDialogElement} */ (el('dialog', `qd-dialog vq-dialog${kind ? ` vq-${kind}` : ''}`));
    dialog.setAttribute('aria-label', text(title) || 'Una pregunta');
    (mount ?? document.querySelector('.gs-root') ?? document.body).appendChild(dialog);
    dialog.showModal();

    const root = el('div', 'qd-root vq-root');
    root.dataset.kind = kind;
    const backdrop = el('div', 'qd-backdrop');
    const art = backdropFor({ town, pack, night });
    if (art) backdrop.style.setProperty('--qd-backdrop', `url("${new URL(art, document.baseURI).href}")`);
    backdrop.hidden = !art;
    const portrait = el('div', 'qd-portrait vq-portrait');
    const box = el('div', 'qd-box vq-box');
    const name = text(who?.name);
    const plate = el('div', 'qd-nameplate', name);
    plate.hidden = !name;
    const head = el('div', 'qd-head');
    head.appendChild(el('span', 'qd-title', text(title)));
    const lines = el('div', 'qd-text vq-text');
    lines.setAttribute('aria-live', 'polite');
    for (const note of notes.map(text).filter(Boolean)) lines.appendChild(el('p', 'qd-line qd-note', note));
    lines.appendChild(el('p', 'qd-line qd-say vq-question', text(question)));
    const chips = el('div', 'qd-chips vq-chips');
    box.append(plate, head, lines, chips);
    root.append(backdrop, portrait, box);
    dialog.appendChild(root);

    // La cara de quien pregunta: su retrato del paquete o, si es de los tuyos, la de la tira (la
    // elegida, su retrato de relleno o sus iniciales).
    portrait.hidden = !name;
    if (name) {
        const drawn = portraitFor({ name, pack, className: text(who?.class ?? who?.className), gender: text(who?.gender), race: text(who?.race) });
        if (drawn && !who?.face) {
            const image = /** @type {HTMLImageElement} */ (el('img', 'pixel-art qd-pixel'));
            image.src = drawn;
            image.alt = name;
            image.addEventListener('error', () => image.replaceWith(el('i', 'fa-solid fa-user qd-silhouette')));
            portrait.appendChild(image);
        } else {
            portrait.appendChild(faceElement({
                name, avatar: text(who?.avatar), className: text(who?.class ?? who?.className), gender: text(who?.gender),
                race: text(who?.race), mercenary: who?.guest?.kind === 'mercenary', face: who?.face ?? null,
            }, { imageClass: 'qd-pixel', pixelClass: 'pixel-art', badgeClass: 'vq-face' }));
        }
    }

    return new Promise(resolve => {
        let done = false;
        const close = (/** @type {boolean} */ answer) => {
            if (done) return;
            done = true;
            dialog.close();
            dialog.remove();
            resolve(answer);
        };
        const chip = (/** @type {string} */ label, /** @type {string} */ key, /** @type {boolean} */ answer) => {
            const button = /** @type {HTMLButtonElement} */ (el('button', `qd-chip qd-chip-reply vq-${answer ? 'yes' : 'no'}`));
            button.type = 'button';
            button.dataset.answer = answer ? 'si' : 'no';
            button.append(el('span', 'qd-key', key), el('span', 'qd-label', label));
            button.addEventListener('click', () => close(answer));
            chips.appendChild(button);
            return button;
        };
        chip(yes, '1', true).focus();
        chip(no, '2', false);
        dialog.addEventListener('cancel', (event) => {
            event.preventDefault();
            close(false);
        });
        dialog.addEventListener('keydown', (event) => {
            // Lo que se pulsa aquí es de la pregunta, no del Modo Juego que hay detrás.
            event.stopPropagation();
            const key = event.key.toLowerCase();
            if (key === '1' || key === 's') {
                event.preventDefault();
                close(true);
            } else if (key === '2' || key === 'n') {
                event.preventDefault();
                close(false);
            }
        });
    });
}
