/**
 * D-J52 de wiki/ROADMAP_SIN_CONEXION.md: elegir tu cara sin arte.
 *
 * Sin una imagen tuya, el juego ponía el retrato de relleno de tu clase y, si no lo había, tus
 * iniciales en un color sacado de tu nombre (J1.8, `ui/hero-face.js`). Ahora lo eliges tú, al
 * crear el personaje o después desde tu ficha:
 *
 * - **Iniciales**, en uno de los colores de `FACE_COLORS`.
 * - **Un icono**, de los de `FACE_ICONS` (Font Awesome: la clase, la magia, un animal…), sobre
 *   el color que elijas.
 * - **Un emoji**, de los de `FACE_EMOJIS`.
 *
 * Sin elegir nada (`null`), lo de siempre: el retrato de relleno de tu clase, o tus iniciales en
 * el color de tu nombre. Lo que elijas va en el héroe (`face`) y sale donde salía la cara: la
 * ficha, la tira del grupo, el tablero y la novela. Una imagen subida manda sobre todo esto.
 *
 * Puro: lo que se puede elegir y cómo se lee lo guardado. Lo dibuja `ui/hero-face.js`.
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Los colores que se pueden elegir: pocos y que se distingan, con su nombre en llano. `hue` es
 * el tono (de 0 a 359) con el que `hero-face.js` pinta el fondo y el borde.
 *
 * @type {Array<{id: string, label: string, hue: number}>}
 */
export const FACE_COLORS = [
    { id: 'rojo', label: 'Rojo', hue: 0 },
    { id: 'naranja', label: 'Naranja', hue: 28 },
    { id: 'oro', label: 'Oro', hue: 46 },
    { id: 'verde', label: 'Verde', hue: 125 },
    { id: 'turquesa', label: 'Turquesa', hue: 172 },
    { id: 'azul', label: 'Azul', hue: 215 },
    { id: 'morado', label: 'Morado', hue: 272 },
    { id: 'rosa', label: 'Rosa', hue: 325 },
];

/**
 * Los iconos: de Font Awesome (los que ya carga el juego), uno por cada cosa que puede ser
 * alguien. `id` es la clase de Font Awesome.
 *
 * @type {Array<{id: string, label: string}>}
 */
export const FACE_ICONS = [
    { id: 'fa-shield-halved', label: 'Escudo' },
    { id: 'fa-khanda', label: 'Espadas' },
    { id: 'fa-hat-wizard', label: 'Sombrero de mago' },
    { id: 'fa-wand-sparkles', label: 'Varita' },
    { id: 'fa-book', label: 'Libro' },
    { id: 'fa-mask', label: 'Máscara' },
    { id: 'fa-hand-fist', label: 'Puño' },
    { id: 'fa-leaf', label: 'Hoja' },
    { id: 'fa-paw', label: 'Huella' },
    { id: 'fa-dragon', label: 'Dragón' },
    { id: 'fa-skull', label: 'Calavera' },
    { id: 'fa-crown', label: 'Corona' },
    { id: 'fa-fire', label: 'Fuego' },
    { id: 'fa-moon', label: 'Luna' },
    { id: 'fa-sun', label: 'Sol' },
    { id: 'fa-music', label: 'Música' },
];

/**
 * Los emojis: pocos, de fantasía, que se lean pequeños.
 *
 * @type {string[]}
 */
export const FACE_EMOJIS = ['🧙', '🧝', '🧛', '🧚', '🐉', '🦊', '🐺', '🦉', '🐻', '🗡️', '🏹', '🛡️', '🔥', '🌙', '💀', '👑'];

/** Las formas de la cara que se pueden elegir. */
export const FACE_KINDS = ['initials', 'icon', 'emoji'];

/**
 * @typedef {Object} FaceChoice Lo que eligió quien juega.
 * @property {'initials'|'icon'|'emoji'} kind
 * @property {string} [color] El id de `FACE_COLORS` (iniciales e icono).
 * @property {string} [icon] El id de `FACE_ICONS`.
 * @property {string} [emoji] Uno de `FACE_EMOJIS`.
 */

/**
 * Lo guardado en el héroe (`face`), leído: solo lo que está en las listas. Algo que no se
 * entiende es no haber elegido (`null`), y sale la cara de siempre.
 *
 * @param {any} raw
 * @returns {FaceChoice|null}
 */
export function readFaceChoice(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const kind = text(raw.kind);
    const color = FACE_COLORS.some(c => c.id === text(raw.color)) ? text(raw.color) : '';
    if (kind === 'initials') return { kind, ...(color ? { color } : {}) };
    if (kind === 'icon') {
        const icon = text(raw.icon);
        return FACE_ICONS.some(i => i.id === icon) ? { kind, icon, ...(color ? { color } : {}) } : null;
    }
    if (kind === 'emoji') {
        const emoji = text(raw.emoji);
        return FACE_EMOJIS.includes(emoji) ? { kind, emoji } : null;
    }
    return null;
}

/**
 * El tono de un color elegido, o nada si no se eligió (sale el del nombre).
 *
 * @param {string} [colorId]
 * @returns {number|null}
 */
export function faceHue(colorId) {
    const found = FACE_COLORS.find(c => c.id === text(colorId));
    return found ? found.hue : null;
}

/**
 * Cómo se dice lo elegido, para la ficha y las pruebas: «Iniciales en azul», «Icono: Dragón»,
 * «Emoji 🐉». Sin elegir: «Retrato de tu clase».
 *
 * @param {any} raw
 * @returns {string}
 */
export function describeFaceChoice(raw) {
    const choice = readFaceChoice(raw);
    if (!choice) return 'Retrato de tu clase';
    const color = FACE_COLORS.find(c => c.id === choice.color)?.label.toLowerCase() ?? '';
    if (choice.kind === 'initials') return color ? `Iniciales en ${color}` : 'Iniciales';
    if (choice.kind === 'icon') return `Icono: ${FACE_ICONS.find(i => i.id === choice.icon)?.label ?? ''}${color ? `, en ${color}` : ''}`;
    return `Emoji ${choice.emoji}`;
}
