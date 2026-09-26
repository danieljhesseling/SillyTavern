/**
 * El mapa, en texto: con niebla y con notas (ideas 69 y 70, aparcadas hasta que hubiera mapa;
 * U5 del pegamento).
 *
 * Las dos esperaban a un mapa dibujado. No hace falta: la lista de sitios con sus caminos ya
 * es un mapa, y la niebla y las notas son cosas que se dicen, no que se pintan.
 *
 * - **La niebla (69)**: lo que no habéis pisado sale en gris, y un camino que no sale de
 *   ningún sitio donde hayáis estado es un camino que no conocéis: se sabe que existe, no a
 *   dónde lleva ni cuánto cuesta.
 * - **Las notas (70)**: una línea tuya en cada sitio, para acordarte de tus propias pistas.
 *
 * Lo que está escondido (los sitios que revela un hito o un rumor) no sale: no se sabe que
 * existe.
 *
 * Puro: arma las filas. Quien llama las dibuja y guarda las notas.
 *
 * Ver wiki/ROADMAP_PEGAMENTO.md, U5.
 */

import { routesOf } from '../world/travel.js';

/** Lo que cabe en una nota. */
export const NOTE_MAX = 140;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * @typedef {Object} MapRow
 * @property {string} name
 * @property {'aqui'|'visitado'|'sin-visitar'} state
 * @property {Array<{to: string, days: number, known: boolean, closed: boolean, note: string}>} routes
 * @property {string} note
 */

/**
 * El mapa en filas: primero donde estáis, luego lo visitado y al final lo que no.
 *
 * @param {Object} input
 * @param {any[]} input.locations
 * @param {string} [input.here]
 * @param {string[]} [input.visited]
 * @param {Record<string, string>} [input.notes]
 * @param {string[]} [input.friendly]
 * @param {string} [input.season]
 * @param {string[]} [input.done]
 * @returns {MapRow[]}
 */
export function mapRows({ locations, here = '', visited = [], notes = {}, friendly = [], season = '', done = [] }) {
    const seen = new Set([...(visited ?? []).map(text), text(here)].filter(Boolean));
    const all = (Array.isArray(locations) ? locations : []).filter(l => text(l?.name));
    // Los caminos valen para ir y volver: los de vuelta se añaden al otro extremo.
    /** @type {Map<string, Array<{to: string, days: number, closed: boolean, note: string}>>} */
    const edges = new Map(all.map(l => [text(l.name), []]));
    for (const location of all) {
        for (const route of routesOf(location, friendly, season, done)) {
            edges.get(text(location.name))?.push({ to: route.to, days: route.days, closed: route.closed, note: route.note });
            if (!route.oneWay && edges.has(route.to) && !edges.get(route.to)?.some(e => e.to === text(location.name))) {
                edges.get(route.to)?.push({ to: text(location.name), days: route.days, closed: route.closed, note: route.note });
            }
        }
    }
    const rank = { aqui: 0, visitado: 1, 'sin-visitar': 2 };
    return all.map(location => {
        const name = text(location.name);
        const state = /** @type {MapRow['state']} */ (name === text(here) ? 'aqui' : seen.has(name) ? 'visitado' : 'sin-visitar');
        return {
            name,
            state,
            // Un camino se conoce si habéis estado en uno de sus dos extremos.
            routes: (edges.get(name) ?? []).map(edge => ({ ...edge, known: seen.has(name) || seen.has(edge.to) })),
            note: text(notes?.[name]).slice(0, NOTE_MAX),
        };
    }).sort((a, b) => rank[a.state] - rank[b.state] || a.name.localeCompare(b.name));
}

/**
 * Cómo se dice un camino en el mapa: con días si se conoce, y sin destino si no.
 *
 * @param {{to: string, days: number, known: boolean, closed: boolean, note: string}} route
 * @returns {string}
 */
export function describeRoute(route) {
    if (!route.known) return '→ un camino que no conocéis';
    const days = `${route.days} ${route.days === 1 ? 'día' : 'días'}`;
    return `→ ${route.to}, ${days}${route.closed ? ` (cerrado${route.note ? `: ${route.note}` : ''})` : ''}`;
}

/**
 * Apuntar o borrar una nota.
 *
 * @param {any} notes
 * @param {string} place
 * @param {string} note
 * @returns {Record<string, string>}
 */
export function setNote(notes, place, note) {
    /** @type {Record<string, string>} */
    const out = {};
    for (const [key, value] of Object.entries(notes && typeof notes === 'object' ? notes : {})) {
        if (text(key) && text(value)) out[text(key)] = text(value).slice(0, NOTE_MAX);
    }
    const clean = text(note).slice(0, NOTE_MAX);
    if (clean) out[text(place)] = clean;
    else delete out[text(place)];
    return out;
}

/**
 * Apuntar que se ha estado en un sitio.
 *
 * @param {any} visited
 * @param {string} place
 * @returns {string[]}
 */
export function markVisited(visited, place) {
    const list = (Array.isArray(visited) ? visited : []).map(text).filter(Boolean);
    const name = text(place);
    return name && !list.includes(name) ? [...list, name] : list;
}
