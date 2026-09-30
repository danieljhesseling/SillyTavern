/**
 * J1.8 de wiki/ROADMAP_SIN_CONEXION.md: tu cara sin arte.
 *
 * La cara de alguien del grupo, en este orden: la suya, si la ha subido; su retrato en pixel
 * (el suyo si es un mercenario, y si no el de relleno de su clase); y si no hay ninguno —una
 * clase inventada en el taller, o la imagen que subió ya no está—, sus iniciales en su color,
 * que es siempre el mismo para el mismo nombre. Nunca una imagen rota, ni la silueta gris de
 * SillyTavern, ni «???».
 *
 * Lo usan la ficha, la tira del grupo y el tablero, para que tu cara sea la misma en los tres.
 *
 * D-J52: sin imagen propia, la cara que eligió quien juega (`face`: iniciales en un color, un
 * icono o un emoji, `campaign/face-choice.js`) va antes que el retrato de relleno de su clase.
 */

import { firstArt, isPlainFace } from './pixel-art.js';
import { initialsOf, hueOf } from './shell/speakers.js';
import { readFaceChoice, faceHue } from '../campaign/face-choice.js';

/**
 * @typedef {Object} FaceQuery
 * @property {string} name
 * @property {string} [avatar] La cara subida, si la hay.
 * @property {string} [className]
 * @property {string} [gender]
 * @property {string} [race]
 * @property {boolean} [mercenary] Un mercenario tiene su propio retrato.
 * @property {any} [face] D-J52: la cara que eligió sin arte (`readFaceChoice`).
 */

/**
 * @typedef {Object} Face
 * @property {'own'|'pixel'|'initials'|'icon'|'emoji'} kind
 * @property {string} src La imagen (vacía si son iniciales).
 * @property {string} initials «LÍ», «GM».
 * @property {number} hue Su color, de 0 a 359.
 * @property {string} [icon] D-J52: el icono elegido (clase de Font Awesome).
 * @property {string} [emoji] D-J52: el emoji elegido.
 */

/** Las caras que se dibujan sin imagen: un cuadro con su color. */
const BADGE_KINDS = ['initials', 'icon', 'emoji'];

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Qué cara se enseña de alguien.
 *
 * @param {FaceQuery} who
 * @returns {Face}
 */
export function faceOf(who) {
    const name = text(who?.name);
    const initials = initialsOf(name);
    const hue = hueOf(name);
    const avatar = text(who?.avatar);
    if (!isPlainFace(avatar)) return { kind: 'own', src: avatar, initials, hue };
    // D-J52: la que eligió, antes que el retrato de relleno de su clase.
    const choice = readFaceChoice(who?.face);
    if (choice) {
        return { kind: choice.kind, src: '', initials, hue: faceHue(choice.color) ?? hue, icon: choice.icon ?? '', emoji: choice.emoji ?? '' };
    }
    const drawn = (who?.mercenary ? firstArt('mercenary', { name }) : '')
        || firstArt('hero', { className: text(who?.className), gender: text(who?.gender), race: text(who?.race), name });
    return drawn ? { kind: 'pixel', src: drawn, initials, hue } : { kind: 'initials', src: '', initials, hue };
}

/**
 * Los colores de las iniciales: el fondo oscuro y el borde claro del mismo tono.
 *
 * @param {number} hue
 * @returns {{background: string, border: string}}
 */
export function initialsColors(hue) {
    const h = Math.max(0, Math.min(359, Math.floor(Number(hue) || 0)));
    return { background: `hsl(${h}, 42%, 26%)`, border: `hsl(${h}, 55%, 58%)` };
}

/**
 * Las iniciales, como elemento: un cuadro con su color y sus letras. D-J52: o el icono o el
 * emoji que eligió, en el mismo cuadro.
 *
 * @param {{initials: string, hue: number, kind?: string, icon?: string, emoji?: string}} face
 * @param {string} [className]
 * @returns {HTMLElement}
 */
export function initialsBadge(face, className = '') {
    const badge = document.createElement('span');
    badge.className = `hero-initials ${className}`.trim();
    if (face.kind === 'icon' && text(face.icon)) {
        badge.classList.add('hero-face-icon');
        const icon = document.createElement('i');
        icon.className = `fa-solid ${text(face.icon)}`;
        badge.appendChild(icon);
    } else if (face.kind === 'emoji' && text(face.emoji)) {
        badge.classList.add('hero-face-emoji');
        badge.textContent = text(face.emoji);
    } else {
        badge.textContent = text(face.initials) || '?';
    }
    const colors = initialsColors(face.hue);
    badge.style.background = colors.background;
    badge.style.borderColor = colors.border;
    // El tono, legible (el navegador pasa el color a rgb): para las pruebas y el estilo.
    badge.dataset.hue = String(Math.floor(Number(face.hue) || 0));
    badge.setAttribute('aria-hidden', 'true');
    return badge;
}

/**
 * Las iniciales de alguien por su nombre, ya como elemento (para el tablero, que elige la
 * imagen por su cuenta y solo necesita el último recurso). D-J52: con la cara que eligió, esa.
 *
 * @param {string} name
 * @param {string} [className]
 * @param {any} [face] La cara elegida (`face` del héroe), si la hay.
 * @returns {HTMLElement}
 */
export function initialsFor(name, className = '', face = null) {
    const choice = readFaceChoice(face);
    const initials = initialsOf(text(name));
    if (choice) return initialsBadge({ kind: choice.kind, initials, hue: faceHue(choice.color) ?? hueOf(text(name)), icon: choice.icon, emoji: choice.emoji }, className);
    return initialsBadge({ initials, hue: hueOf(text(name)) }, className);
}

/**
 * La cara, como elemento. Si la imagen no carga, se prueba lo siguiente: la suya rota da paso a
 * su retrato en pixel, y el retrato que falta, a las iniciales.
 *
 * @param {FaceQuery} who
 * @param {{imageClass?: string, pixelClass?: string, badgeClass?: string}} [classes]
 *   `imageClass` va en la imagen siempre; `pixelClass`, además, si es un retrato en pixel;
 *   `badgeClass`, en las iniciales.
 * @returns {HTMLElement}
 */
export function faceElement(who, { imageClass = '', pixelClass = 'pixel-art', badgeClass = '' } = {}) {
    const face = faceOf(who);
    if (BADGE_KINDS.includes(face.kind)) return initialsBadge(face, badgeClass);
    const image = document.createElement('img');
    image.alt = '';
    /** @param {Face} shown */
    const show = (shown) => {
        image.className = `${imageClass} ${shown.kind === 'pixel' ? pixelClass : ''}`.trim();
        image.src = shown.src;
    };
    show(face);
    // Lo que se prueba si falla: su retrato en pixel (si lo que fallaba era su cara) y, al final,
    // las iniciales (o la cara que eligió, D-J52).
    const next = face.kind === 'own' ? faceOf({ ...who, avatar: '' }) : null;
    let tried = false;
    image.addEventListener('error', () => {
        if (!tried && next?.kind === 'pixel') {
            tried = true;
            show(next);
            return;
        }
        // D-J52: la que eligió, si la hay; si no, las iniciales.
        image.replaceWith(initialsBadge(next && BADGE_KINDS.includes(next.kind) ? next : face, badgeClass));
    });
    return image;
}
