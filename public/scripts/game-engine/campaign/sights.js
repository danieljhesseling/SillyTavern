/**
 * Lo que se puede mirar en cada localización (J10.2 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * El motor ya ofrecía «Examinar…» en cada sitio (Z3), pero con cosas de su tipo sacadas del
 * compendio: un pozo en cualquier aldea, unos carteles en cualquier ciudad. Un mundo escrito
 * sabe más: en la ermita de 1387 hay un monje que cose a los heridos, y en el lago, fardos
 * bajo el hielo. Aquí se leen las cosas que el paquete escribe para cada localización
 * (`sights`), y se ponen delante de las del compendio.
 *
 * Cada una dice qué se hace («examinar»), sobre qué («el hueco del roble»), con qué tirada y,
 * si sale bien, qué se ve (`found`). Una tirada buena aquí cuenta para el hilo como cualquier
 * otra: así se encuentra un secreto que el guion esconde con una pista en este sitio.
 *
 * Cómo se escribe en el paquete, dentro de cada localización:
 *
 *     "sights": [
 *       { "verbo": "examinar", "text": "el hueco del roble", "skill": "investigation",
 *         "found": "Dentro hay una carta doblada en cuatro, sin firma." } ]
 *
 * Puro: de la localización, a filas con la forma de las de «mirar» del compendio.
 */

import { SKILLS } from '../rules/checks.js';

/** Lo que se hace si el paquete no lo dice. */
export const DEFAULT_SIGHT_VERB = 'examinar';

/** Con qué se tira si el paquete no lo dice: examinar es registrar con cuidado. */
export const DEFAULT_SIGHT_SKILL = 'investigation';

/** Cuántas cosas se ofrecen cada día en un sitio (las mismas dos que antes). */
export const LOOKS_PER_DAY = 2;

/**
 * @typedef {Object} SightRow Una cosa que mirar, con la forma de las filas `mirar` del compendio.
 * @property {string} id
 * @property {'mirar'} kind
 * @property {string} verbo
 * @property {string} text
 * @property {string} skill
 * @property {string} found Lo que se ve si la tirada sale bien; vacío si no se escribió.
 * @property {boolean} own Es del paquete, no del compendio.
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * La parte del id que sale del nombre del sitio: sin tildes, en minúscula y con guiones.
 *
 * @param {string} name
 * @returns {string}
 */
function slugOf(name) {
    return text(name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'sitio';
}

/**
 * Las cosas que mirar que escribe una localización, limpias: sin las que no dicen sobre qué,
 * y con la tirada de examinar si la suya no existe. El id es estable (el sitio y el orden) si
 * el paquete no trae uno.
 *
 * @param {any} raw La lista `sights` tal y como venga.
 * @param {string} [place] El nombre de la localización, para los ids.
 * @returns {SightRow[]}
 */
export function readSights(raw, place = '') {
    if (!Array.isArray(raw)) return [];
    const base = `sitio-${slugOf(place)}`;
    /** @type {SightRow[]} */
    const out = [];
    raw.forEach((/** @type {any} */ row, index) => {
        const what = typeof row === 'string' ? text(row) : text(row?.text);
        if (!what) return;
        const skill = text(row?.skill);
        out.push({
            id: text(row?.id) || `${base}-${index + 1}`,
            kind: 'mirar',
            verbo: text(row?.verbo) || DEFAULT_SIGHT_VERB,
            text: what,
            skill: skill in SKILLS ? skill : DEFAULT_SIGHT_SKILL,
            found: text(row?.found),
            own: true,
        });
    });
    return out;
}

/**
 * Las de una localización del mundo (de `locationMaps` o del paquete).
 *
 * @param {any} location
 * @returns {SightRow[]}
 */
export function sightsOf(location) {
    return readSights(location?.sights, text(location?.name));
}

/**
 * Qué se ofrece hoy para examinar aquí: primero lo que escribe el sitio, después lo del
 * compendio, las dos cosas barajadas con el azar del día. Lo ya examinado hoy no vuelve: se
 * quita después de elegir, para que tirar dos veces no saque una tercera.
 *
 * @param {Object} input
 * @param {SightRow[]} [input.sights] Las del sitio (`sightsOf`).
 * @param {any[]} [input.rows] Las filas `mirar` del compendio que valen aquí.
 * @param {() => number} input.random
 * @param {string[]} [input.looked] Lo examinado hoy, como `sitio|id`.
 * @param {string} [input.here] El nombre del sitio.
 * @param {number} [input.max]
 * @returns {any[]}
 */
export function pickLooks({ sights = [], rows = [], random, looked = [], here = '', max = LOOKS_PER_DAY }) {
    const shuffle = (/** @type {any[]} */ list) => list.map(row => ({ row, at: random() }))
        .sort((a, b) => a.at - b.at).map(({ row }) => row);
    const own = shuffle(Array.isArray(sights) ? sights : []);
    const generic = shuffle(Array.isArray(rows) ? rows : []);
    const done = new Set((Array.isArray(looked) ? looked : []).map(text));
    return [...own, ...generic]
        .slice(0, Math.max(0, max))
        .filter(row => !done.has(`${text(here)}|${text(row?.id)}`));
}

/**
 * Una cosa que mirar por su id: primero las del sitio, luego las del compendio.
 *
 * @param {string} id
 * @param {{sights?: SightRow[], rows?: any[]}} from
 * @returns {any|null}
 */
export function findLook(id, { sights = [], rows = [] } = {}) {
    const wanted = text(id);
    if (!wanted) return null;
    return (Array.isArray(sights) ? sights : []).find(row => row.id === wanted)
        ?? (Array.isArray(rows) ? rows : []).find(row => text(row?.id) === wanted)
        ?? null;
}

/**
 * Lo que se lee en su ficha: «Examinar el hueco del roble».
 *
 * @param {any} row
 * @returns {string}
 */
export function lookLabel(row) {
    const verb = text(row?.verbo) || DEFAULT_SIGHT_VERB;
    return `${verb.charAt(0).toLocaleUpperCase('es')}${verb.slice(1)} ${text(row?.text)}`.trim();
}

/**
 * Lo que se ve al examinarla: lo escrito, solo si la tirada sale bien.
 *
 * @param {any} row
 * @param {boolean} success
 * @returns {string}
 */
export function lookFound(row, success) {
    return success ? text(row?.found) : '';
}
