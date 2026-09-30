/**
 * D-J52: elegir tu cara sin arte, en pantalla. Lo usan la creación de personaje (debajo del
 * retrato) y tu ficha («Cambiar cara»).
 *
 * Cuatro formas: el retrato de tu clase (lo de siempre), tus iniciales en un color, un icono
 * sobre un color o un emoji. Cada una enseña lo suyo debajo: los colores, los iconos o los
 * emojis. Lo que se elige se ve al momento en el cuadro de la cara.
 *
 * Solo dibuja y devuelve lo elegido (`campaign/face-choice.js`); guardarlo es de quien lo abre.
 */

import { FACE_COLORS, FACE_ICONS, FACE_EMOJIS, readFaceChoice, describeFaceChoice } from '../campaign/face-choice.js';
import { hueOf } from './shell/speakers.js';
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
 * @param {string} className
 * @param {string} title
 * @returns {HTMLButtonElement}
 */
function button(className, title) {
    const node = /** @type {HTMLButtonElement} */ (el('button', className));
    node.type = 'button';
    node.title = title;
    node.setAttribute('aria-label', title);
    return node;
}

/** Las cuatro formas, como se dicen. */
const KINDS = [
    { id: 'auto', label: 'Retrato', icon: 'fa-image' },
    { id: 'initials', label: 'Iniciales', icon: 'fa-font' },
    { id: 'icon', label: 'Icono', icon: 'fa-icons' },
    { id: 'emoji', label: 'Emoji', icon: 'fa-face-smile' },
];

/**
 * El color de la paleta más parecido al de un nombre: el que sale al elegir «Iniciales» sin
 * tocar nada más, para que no cambie de golpe.
 *
 * @param {string} name
 * @returns {string}
 */
export function nearestColor(name) {
    const hue = hueOf(text(name));
    const gap = (/** @type {number} */ h) => Math.min(Math.abs(h - hue), 360 - Math.abs(h - hue));
    return [...FACE_COLORS].sort((a, b) => gap(a.hue) - gap(b.hue))[0].id;
}

/**
 * Lo que se elige al pasar a una forma, con lo que ya había: el color se guarda de iniciales a
 * icono, y el icono de partida es el de la clase si está en la lista.
 *
 * @param {string} kind
 * @param {any} before
 * @param {{name?: string, classIcon?: string}} who
 * @returns {import('../campaign/face-choice.js').FaceChoice|null}
 */
export function switchKind(kind, before, { name = '', classIcon = '' } = {}) {
    const was = readFaceChoice(before);
    const color = was?.color || nearestColor(name);
    if (kind === 'initials') return { kind: 'initials', color };
    if (kind === 'icon') {
        const icon = was?.icon || (FACE_ICONS.some(i => i.id === classIcon) ? classIcon : FACE_ICONS[0].id);
        return { kind: 'icon', icon, color };
    }
    if (kind === 'emoji') return { kind: 'emoji', emoji: was?.emoji || FACE_EMOJIS[0] };
    return null;
}

/**
 * El selector, ya dibujado. Cada cambio llama a `onChange` con lo elegido (`null`: el retrato de
 * siempre).
 *
 * @param {Object} input
 * @param {any} [input.value] Lo que ya tenía (`face`).
 * @param {() => {name?: string, classIcon?: string}} [input.who] Su nombre y el icono de su clase,
 *   para los colores y el icono de partida (se piden al cambiar: en la creación aún se escriben).
 * @param {(face: import('../campaign/face-choice.js').FaceChoice|null) => void} [input.onChange]
 * @returns {HTMLElement}
 */
export function faceChooser({ value = null, who = () => ({}), onChange = () => {} } = {}) {
    let face = readFaceChoice(value);
    const root = el('div', 'fc-root');
    const kinds = el('div', 'fc-kinds');
    kinds.setAttribute('role', 'group');
    kinds.setAttribute('aria-label', 'Tu cara');
    const detail = el('div', 'fc-detail');
    root.append(kinds, detail);

    const set = (/** @type {any} */ next) => {
        face = readFaceChoice(next);
        draw();
        onChange(face);
    };

    const swatches = () => {
        const row = el('div', 'fc-colors');
        for (const color of FACE_COLORS) {
            const pick = button(`fc-color${face?.color === color.id ? ' is-on' : ''}`, color.label);
            pick.dataset.color = color.id;
            pick.style.background = `hsl(${color.hue}, 42%, 30%)`;
            pick.style.borderColor = `hsl(${color.hue}, 55%, 58%)`;
            pick.addEventListener('click', () => set({ ...face, color: color.id }));
            row.appendChild(pick);
        }
        return row;
    };

    const draw = () => {
        const kind = face?.kind ?? 'auto';
        kinds.textContent = '';
        for (const one of KINDS) {
            const pick = button(`fc-kind${one.id === kind ? ' is-on' : ''}`, one.label);
            pick.dataset.kind = one.id;
            pick.setAttribute('aria-pressed', String(one.id === kind));
            pick.append(el('i', `fa-solid ${one.icon}`), el('span', '', one.label));
            pick.addEventListener('click', () => set(switchKind(one.id, face, who())));
            kinds.appendChild(pick);
        }
        detail.textContent = '';
        if (kind === 'auto') {
            detail.appendChild(el('p', 'fc-note', 'El retrato de tu clase. Si no lo hay, tus iniciales.'));
        } else if (kind === 'initials') {
            detail.appendChild(swatches());
        } else if (kind === 'icon') {
            const row = el('div', 'fc-icons');
            for (const icon of FACE_ICONS) {
                const pick = button(`fc-icon${face?.icon === icon.id ? ' is-on' : ''}`, icon.label);
                pick.dataset.icon = icon.id;
                pick.appendChild(el('i', `fa-solid ${icon.id}`));
                pick.addEventListener('click', () => set({ ...face, icon: icon.id }));
                row.appendChild(pick);
            }
            detail.append(row, swatches());
        } else {
            const row = el('div', 'fc-emojis');
            for (const emoji of FACE_EMOJIS) {
                const pick = button(`fc-emoji${face?.emoji === emoji ? ' is-on' : ''}`, emoji);
                pick.dataset.emoji = emoji;
                pick.textContent = emoji;
                pick.addEventListener('click', () => set({ kind: 'emoji', emoji }));
                row.appendChild(pick);
            }
            detail.appendChild(row);
        }
    };
    draw();
    return root;
}

/**
 * Desde la ficha: la ventana para cambiar la cara, con cómo queda. Devuelve lo elegido (`null`:
 * el retrato de siempre), o `undefined` si se cierra sin guardar.
 *
 * @param {Object} input
 * @param {any} input.member Su ficha (nombre, clase, cara subida y la elegida).
 * @param {string} [input.classIcon] El icono de su clase, para el icono de partida.
 * @param {any} input.Popup
 * @param {any} input.POPUP_TYPE
 * @returns {Promise<import('../campaign/face-choice.js').FaceChoice|null|undefined>}
 */
export async function openFacePicker({ member, classIcon = '', Popup, POPUP_TYPE }) {
    let face = readFaceChoice(member?.face);
    const body = el('div', 'fc-window');
    body.appendChild(el('h3', 'fc-title', 'Tu cara'));
    const preview = el('div', 'fc-preview');
    const said = el('p', 'fc-said');
    const who = () => ({ name: text(member?.name), classIcon });
    const show = () => {
        preview.textContent = '';
        preview.appendChild(faceElement({
            name: text(member?.name), avatar: '', className: text(member?.class ?? member?.charClass), gender: text(member?.gender),
            race: text(member?.race), face,
        }, { imageClass: 'fc-preview-face', pixelClass: 'fc-preview-face pixel-art', badgeClass: 'fc-preview-face' }));
        said.textContent = describeFaceChoice(face);
    };
    body.append(preview, said, faceChooser({ value: face, who, onChange: (next) => { face = next; show(); } }));
    if (text(member?.avatar) && !/user-default/.test(text(member?.avatar))) {
        body.appendChild(el('p', 'fc-note', 'Tienes una imagen propia: se ve esa. Esta cara sale si la quitas o no carga.'));
    }
    show();
    const popup = new Popup(body, POPUP_TYPE.CONFIRM, '', { okButton: 'Guardar', cancelButton: 'Cancelar' });
    const answer = await popup.show();
    return answer ? face : undefined;
}
