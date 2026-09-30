/**
 * La magia fuera de combate, en su ventana (J19.10 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * Quien del grupo lanza conjuros, con los espacios que le quedan, y lo que puede hacer ahora
 * sin pelear: cada conjuro con su dibujo, lo que cuesta (un truco no gasta nada, un ritual
 * lleva diez minutos, lo demás gasta un espacio), lo que hará **aquí** y, si no se puede, por
 * qué. Al lanzar uno se cuenta arriba lo que ha pasado, y la lista se vuelve a mirar: los
 * espacios han bajado y quizá ya nadie está herido.
 *
 * Se abre sola, sin `party.js`: es un `<dialog>` modal. Qué se puede y qué pasa lo decide
 * `rules/field-magic.js`; lanzarlo y guardarlo, quien la abre (`onCast`).
 */

import { firstArt, loadPixelManifest } from './pixel-art.js';

/**
 * @typedef {Object} FieldCaster
 * @property {any} member
 * @property {string} [slots] Sus espacios, en una línea («Espacios: 1.º 3/4 · 2.º 2/3»).
 * @property {import('../rules/field-magic.js').FieldChoice[]} choices
 */

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
 * @param {string} name
 * @returns {HTMLElement}
 */
function icon(name) {
    const node = el('i', `fa-solid ${name}`);
    node.setAttribute('aria-hidden', 'true');
    return node;
}

/** El icono de cada cosa que hace, si el conjuro no tiene dibujo. */
const KIND_ICONS = {
    luz: 'fa-sun', curar: 'fa-heart-pulse', muertos: 'fa-skull', detect: 'fa-eye', identify: 'fa-magnifying-glass',
    alarm: 'fa-bell', familiar: 'fa-feather', purify: 'fa-hand-sparkles', tongues: 'fa-scroll',
};

/**
 * La lista de quien lanza y lo que puede, lista para meter en un cuadro.
 *
 * @param {Object} input
 * @param {FieldCaster[]} input.casters
 * @param {(member: any, choice: import('../rules/field-magic.js').FieldChoice) => void} input.onPick
 * @returns {HTMLElement}
 */
export function buildFieldMagicList({ casters, onPick }) {
    const list = el('div', 'fm-list');
    const shown = (Array.isArray(casters) ? casters : []).filter(c => c?.member && Array.isArray(c.choices) && c.choices.length > 0);
    if (shown.length === 0) {
        list.appendChild(el('p', 'fm-empty', 'Nadie del grupo tiene a mano magia que sirva fuera de una pelea.'));
        return list;
    }
    for (const { member, slots = '', choices } of shown) {
        const box = el('section', 'fm-caster');
        box.dataset.member = text(member.id ?? member.name);
        const who = el('div', 'fm-who');
        const art = firstArt('class', { name: text(member.class ?? member.charClass) });
        if (art) {
            const image = /** @type {HTMLImageElement} */ (el('img', 'pixel-art fm-class-art'));
            image.src = art;
            image.alt = '';
            who.appendChild(image);
        }
        who.appendChild(el('span', 'fm-name', `${text(member.name)} · nivel ${Number(member.level) || 1}`));
        if (slots) who.appendChild(el('span', 'fm-slots', slots));
        box.appendChild(who);
        for (const choice of choices) {
            const row = el('div', 'fm-spell');
            row.dataset.spell = choice.id;
            row.dataset.how = choice.how;
            row.dataset.ok = String(choice.ok);
            const picture = firstArt('spell', { id: choice.id, name: choice.name });
            if (picture) {
                const image = /** @type {HTMLImageElement} */ (el('img', 'pixel-art fm-spell-art'));
                image.src = picture;
                image.alt = '';
                row.appendChild(image);
            } else {
                const mark = icon(/** @type {Record<string, string>} */ (KIND_ICONS)[choice.kind] ?? 'fa-wand-sparkles');
                mark.classList.add('fm-spell-icon');
                row.appendChild(mark);
            }
            const body = el('div', 'fm-spell-body');
            const name = el('div', 'fm-spell-name', choice.name);
            const cost = el('span', 'fm-cost', choice.cost);
            cost.dataset.how = choice.how;
            name.appendChild(cost);
            body.appendChild(name);
            if (choice.does) body.appendChild(el('div', 'fm-does', choice.does));
            if (!choice.ok && choice.reason) body.appendChild(el('div', 'fm-why', choice.reason));
            row.appendChild(body);
            const cast = /** @type {HTMLButtonElement} */ (el('button', 'menu_button fm-cast', choice.how === 'ritual' ? 'Lanzar ritual' : 'Lanzar'));
            cast.type = 'button';
            cast.disabled = !choice.ok;
            cast.title = choice.ok ? choice.does : choice.reason;
            cast.addEventListener('click', () => onPick(member, choice));
            row.appendChild(cast);
            box.appendChild(row);
        }
        list.appendChild(box);
    }
    return list;
}

/**
 * Abrir la magia fuera de combate. Se puede lanzar una cosa detrás de otra; se cierra con
 * «Cerrar» o con Escape.
 *
 * @param {Object} input
 * @param {() => FieldCaster[]} input.getCasters Se pide cada vez: lo lanzado cambia lo que queda.
 * @param {(member: any, choice: import('../rules/field-magic.js').FieldChoice) => (string[]|Promise<string[]>)} input.onCast
 *   Lo lanza y lo guarda; devuelve lo que se cuenta.
 * @param {HTMLElement|null} [input.mount]
 * @returns {Promise<{cast: number}>} Cuántos se lanzaron.
 */
export async function openFieldMagic({ getCasters, onCast, mount = null }) {
    await loadPixelManifest().catch(() => null);
    const dialog = /** @type {HTMLDialogElement} */ (el('dialog', 'fm-dialog'));
    dialog.setAttribute('aria-label', 'Magia fuera de combate');
    (mount ?? document.querySelector('.gs-root') ?? document.body).appendChild(dialog);
    const root = el('div', 'fm-root');
    const head = el('div', 'fm-head');
    const title = el('h3', 'fm-title');
    title.append(icon('fa-wand-sparkles'), document.createTextNode(' Magia fuera de combate'));
    const close = /** @type {HTMLButtonElement} */ (el('button', 'menu_button fm-close'));
    close.type = 'button';
    close.append(icon('fa-xmark'), document.createTextNode(' Cerrar'));
    head.append(title, close);
    root.appendChild(head);
    root.appendChild(el('p', 'fm-intro', 'Lo que se puede lanzar ahora, sin pelear. Lo que gasta un espacio vuelve con un descanso largo; un truco no gasta nada.'));
    const result = el('div', 'fm-result');
    result.hidden = true;
    result.setAttribute('aria-live', 'polite');
    root.appendChild(result);
    const holder = el('div', 'fm-holder');
    root.appendChild(holder);
    dialog.appendChild(root);

    let count = 0;
    let busy = false;
    return new Promise(resolve => {
        const finish = () => {
            if (dialog.open) dialog.close();
            dialog.remove();
            resolve({ cast: count });
        };
        const draw = () => {
            holder.textContent = '';
            holder.appendChild(buildFieldMagicList({
                casters: getCasters(),
                onPick: async (member, choice) => {
                    if (busy) return;
                    busy = true;
                    try {
                        const lines = await onCast(member, choice);
                        count += 1;
                        result.textContent = '';
                        for (const line of (Array.isArray(lines) ? lines : []).map(text).filter(Boolean)) result.appendChild(el('p', '', line));
                        result.hidden = result.childElementCount === 0;
                    } catch (error) {
                        console.error('[magia] no se pudo lanzar', error);
                    } finally {
                        busy = false;
                        draw();
                    }
                },
            }));
        };
        close.addEventListener('click', finish);
        dialog.addEventListener('cancel', (event) => {
            event.preventDefault();
            finish();
        });
        draw();
        dialog.showModal();
        close.focus();
    });
}
