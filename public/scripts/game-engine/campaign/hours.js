/**
 * Los horarios: qué está abierto a cada hora del día (T9 de wiki/LO_QUE_FALTA.md).
 *
 * El día tiene mañana, tarde y noche, y hasta ahora daba igual a qué hora se llegaba: la
 * herrería forjaba a medianoche. Ahora la tienda y la herrería cierran de noche, y quien las
 * lleva está donde está la gente a esas horas, en la posada. La posada, el templo y el tablón
 * no cierran. Es poco, pero hace que la hora pese: llegar de noche a un pueblo es llegar a
 * cenar, no a comprar.
 *
 * Puro: con el servicio, la hora y quién lo lleva, dice si abre y qué se dice si no.
 */

/** A qué horas abre cada servicio (los ids de las franjas de `calendar.js`). */
export const SERVICE_HOURS = {
    posada: ['morning', 'afternoon', 'night'],
    templo: ['morning', 'afternoon', 'night'],
    tablon: ['morning', 'afternoon', 'night'],
    tienda: ['morning', 'afternoon'],
    herreria: ['morning', 'afternoon'],
};

/** Cómo se dice cada franja: «por la mañana». */
const WHEN = { morning: 'por la mañana', afternoon: 'por la tarde', night: 'por la noche' };

/** Cómo se llama cada servicio en una frase. */
const SAID = { tienda: 'La tienda', herreria: 'La herrería', posada: 'La posada', templo: 'El templo', tablon: 'El tablón' };

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Si un servicio está abierto a esta hora. Sin hora, sí: lo que no se sabe no se cierra.
 *
 * @param {string} service
 * @param {string} [slot] `morning`, `afternoon` o `night`.
 * @returns {boolean}
 */
export function isOpen(service, slot = '') {
    const hours = /** @type {Record<string, string[]>} */ (SERVICE_HOURS)[text(service)];
    if (!hours || !text(slot)) return true;
    return hours.includes(text(slot));
}

/**
 * Cuándo vuelve a abrir: la primera franja abierta.
 *
 * @param {string} service
 * @returns {string}
 */
export function opensAt(service) {
    const hours = /** @type {Record<string, string[]>} */ (SERVICE_HOURS)[text(service)] ?? [];
    return /** @type {Record<string, string>} */ (WHEN)[hours[0]] ?? '';
}

/**
 * Lo que se dice de un servicio cerrado, con dónde está quien lo lleva.
 *
 * @param {Object} input
 * @param {string} input.service
 * @param {string} [input.keeper] Quien lo lleva.
 * @param {boolean} [input.innHere] Si hay posada aquí (entonces está en ella).
 * @returns {string}
 */
export function closedLine({ service, keeper = '', innHere = false }) {
    const what = /** @type {Record<string, string>} */ (SAID)[text(service)] ?? 'Esto';
    const who = text(keeper);
    const where = who ? (innHere ? ` ${who} está en la posada, con una jarra.` : ` ${who} se ha ido a casa.`) : '';
    const back = opensAt(service);
    return `${what} está cerrada.${where}${back ? ` Abre ${back}.` : ''}`;
}
