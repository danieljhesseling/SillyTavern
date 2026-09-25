/**
 * Las fiestas de cada sitio (idea 89): un calendario con vida.
 *
 * Cada pueblo y cada ciudad tiene su día de fiesta en el mes, sacado de la semilla del mundo
 * (el mismo mundo, las mismas fiestas). Ese día, en la posada comer sale gratis, la tienda
 * rebaja un 10 % y se cuenta más de lo normal.
 *
 * Puro: qué fiesta hay dónde y cuándo.
 */

/** Los días de un mes del calendario de la partida. */
export const MONTH_DAYS = 28;

const NAMES = [
    'la Feria del Grano', 'la Noche de las Hogueras', 'el Día de los Difuntos', 'la Fiesta del Santo Patrón',
    'la Matanza', 'la Romería del Pozo', 'el Mercado de las Lanas', 'la Vendimia',
];

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * El día y el nombre de la fiesta de cada sitio con gente.
 *
 * @param {Array<{name: string, locationType?: string, type?: string}>} locations
 * @param {(key: string) => () => number} randomFor Da un azar con semilla para cada sitio.
 * @returns {Record<string, {day: number, name: string}>}
 */
export function festivalsOf(locations, randomFor) {
    /** @type {Record<string, {day: number, name: string}>} */
    const out = {};
    for (const place of locations || []) {
        const type = text(place?.locationType || place?.type).toLowerCase();
        if (!['village', 'city', 'aldea', 'ciudad', 'pueblo'].includes(type)) continue;
        const random = randomFor(text(place.name));
        out[text(place.name)] = {
            day: 1 + (Math.floor(random() * MONTH_DAYS) % MONTH_DAYS),
            name: NAMES[Math.floor(random() * NAMES.length) % NAMES.length],
        };
    }
    return out;
}

/**
 * La fiesta de hoy aquí, si la hay.
 *
 * @param {Record<string, {day: number, name: string}>} festivals
 * @param {string} place
 * @param {number} today
 * @returns {{day: number, name: string}|null}
 */
export function festivalToday(festivals, place, today) {
    const found = festivals?.[text(place)];
    if (!found) return null;
    const dayOfMonth = ((Math.max(1, Math.floor(Number(today) || 1)) - 1) % MONTH_DAYS) + 1;
    return found.day === dayOfMonth ? found : null;
}

/**
 * Cuántos días faltan para la fiesta de un sitio, para anunciarla.
 *
 * @param {{day: number}} festival
 * @param {number} today
 * @returns {number}
 */
export function daysUntil(festival, today) {
    const dayOfMonth = ((Math.max(1, Math.floor(Number(today) || 1)) - 1) % MONTH_DAYS) + 1;
    return (festival.day - dayOfMonth + MONTH_DAYS) % MONTH_DAYS;
}
