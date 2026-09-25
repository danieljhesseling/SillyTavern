/**
 * Pasajes en barco desde los puertos (idea 130).
 *
 * Una ruta puede ser **por mar** (`barco: true` en el guion). Por mar no hay cazarrecompensas
 * ni peajes, y se va más rápido, pero se paga pasaje por cabeza y por día, y una tormenta
 * retrasa lo suyo. Si no llega el oro, no se embarca: se va por tierra si hay camino.
 *
 * Puro: qué tramos son por mar, lo que cuesta y cómo se dice.
 */

/** Lo que cuesta el pasaje, por cabeza y día. */
export const FARE_PER_DAY = 3;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Si el tramo de un sitio a otro es por mar.
 *
 * @param {any[]} locations
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
export function seaLeg(locations, from, to) {
    const list = Array.isArray(locations) ? locations : [];
    const has = (/** @type {string} */ a, /** @type {string} */ b) => (list.find(l => text(l?.name) === a)?.routes ?? [])
        .some((/** @type {any} */ r) => text(r?.to) === b && Boolean(r?.sea));
    return has(text(from), text(to)) || has(text(to), text(from));
}

/**
 * Los tramos por mar de un viaje.
 *
 * @param {any[]} locations
 * @param {string} from
 * @param {string[]} legs Por dónde se pasa, en orden, hasta el destino.
 * @returns {number} Cuántos tramos son por mar.
 */
export function seaLegs(locations, from, legs) {
    let here = text(from);
    let count = 0;
    for (const next of Array.isArray(legs) ? legs : []) {
        if (seaLeg(locations, here, next)) count += 1;
        here = text(next);
    }
    return count;
}

/**
 * El pasaje.
 *
 * @param {{heads: number, days: number}} input
 * @returns {number}
 */
export function fareFor({ heads, days }) {
    return Math.max(1, Math.floor(Number(heads) || 1)) * Math.max(1, Math.floor(Number(days) || 1)) * FARE_PER_DAY;
}

/**
 * Por mar se llega antes: un día menos cada dos (nunca menos de uno).
 *
 * @param {number} days
 * @returns {number}
 */
export function sailingDays(days) {
    const d = Math.max(1, Math.floor(Number(days) || 1));
    return Math.max(1, d - Math.floor(d / 2));
}

/**
 * @param {{fare: number, days: number}} input
 * @returns {string}
 */
export function describeVoyage({ fare, days }) {
    return `por mar: ${days} día(s), ${fare} de oro de pasaje; ni peajes ni cazarrecompensas`;
}
