/**
 * Los horarios: qué está abierto a cada hora del día (T9 de wiki/LO_QUE_FALTA.md).
 *
 * El día tiene mañana, tarde y noche, y hasta ahora daba igual a qué hora se llegaba: la
 * herrería forjaba a medianoche. Ahora la tienda y la herrería cierran de noche, y quien las
 * lleva está donde está la gente a esas horas, en la posada. La posada, el templo y el tablón
 * no cierran. Es poco, pero hace que la hora pese: llegar de noche a un pueblo es llegar a
 * cenar, no a comprar.
 *
 * D-J29: y cierran algunos días enteros. **El día de descanso**, el séptimo de cada semana
 * (el 7, el 14, el 21…), y **los días de fiesta** del pueblo (`world/festivals.js`). Se dice
 * llano: «Cerrado: es de noche», «Cerrado hoy: día de descanso», «Cerrado hoy: es fiesta».
 *
 * Puro: con el servicio, la hora, el día y quién lo lleva, dice si abre y qué se dice si no.
 */

import { normalizeCalendar } from './calendar.js';

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
 * @param {''|'fiesta'|'descanso'|'noche'} [input.reason] D-J29: por qué (`closedReason`).
 * @param {string} [input.festival] La fiesta de hoy, si es por eso.
 * @returns {string}
 */
export function closedLine({ service, keeper = '', innHere = false, reason = '', festival = '' }) {
    const what = /** @type {Record<string, string>} */ (SAID)[text(service)] ?? 'Esto';
    const shut = /^El /.test(what) || what === 'Esto' ? 'cerrado' : 'cerrada';
    const who = text(keeper);
    const where = who ? (innHere ? ` ${who} está en la posada, con una jarra.` : ` ${who} se ha ido a casa.`) : '';
    // D-J29: por qué, y cuándo vuelve a abrir.
    if (reason === 'descanso') return `${what} está ${shut} hoy: es el día de descanso.${where} Abre mañana.`;
    if (reason === 'fiesta') return `${what} está ${shut} hoy: es ${text(festival) || 'fiesta'}.${where} Abre mañana.`;
    const back = opensAt(service);
    const why = reason === 'noche' ? ': es de noche' : '';
    return `${what} está ${shut}${why}.${where}${back ? ` Abre ${back}.` : ''}`;
}

/** D-J29: lo que cierra días enteros. La posada, el templo y el tablón, nunca. */
export const SHOPS = ['tienda', 'herreria'];

/** D-J29: cada cuántos días toca el de descanso (el séptimo de cada semana). */
export const WEEK_DAYS = 7;

/**
 * Si ese día es el de descanso: el 7, el 14, el 21…
 *
 * @param {number} day El día de la campaña, desde el 1.
 * @returns {boolean}
 */
export function isRestDay(day) {
    const d = Math.floor(Number(day) || 0);
    return d > 0 && d % WEEK_DAYS === 0;
}

/**
 * Por qué está cerrado un servicio ahora, o vacío si abre. Un día de fiesta o de descanso
 * cierra todo el día; si no, la hora (`SERVICE_HOURS`).
 *
 * @param {Object} input
 * @param {string} input.service
 * @param {string} [input.slot] `morning`, `afternoon` o `night`.
 * @param {number} [input.day] El día de la campaña.
 * @param {string} [input.festival] La fiesta de hoy aquí, si la hay (su nombre).
 * @returns {''|'fiesta'|'descanso'|'noche'}
 */
export function closedReason({ service, slot = '', day = 0, festival = '' }) {
    const what = text(service);
    if (SHOPS.includes(what)) {
        if (text(festival)) return 'fiesta';
        if (isRestDay(day)) return 'descanso';
    }
    return isOpen(what, slot) ? '' : 'noche';
}

/**
 * El cartel de la puerta, para la tarjeta del sitio: corto y llano.
 *
 * @param {''|'fiesta'|'descanso'|'noche'} reason
 * @returns {string}
 */
export function closedSign(reason) {
    if (reason === 'noche') return 'Cerrado: es de noche';
    if (reason === 'descanso') return 'Cerrado hoy: día de descanso';
    if (reason === 'fiesta') return 'Cerrado hoy: es fiesta';
    return '';
}

/**
 * @typedef {Object} ClosedNote
 * @property {'fiesta'|'descanso'|'noche'} reason
 * @property {string} sign El cartel: «Cerrado: es de noche».
 * @property {string} line La frase entera, con dónde está quien lo lleva y cuándo abre.
 * @property {string} keeper Quien lo lleva, si se sabe.
 */

/**
 * D-J29: las tarjetas de servicios de aquí, con lo cerrado cerrado. Una tarjeta de la tienda
 * o de la herrería que no abre ahora lleva `closed` (su cartel y su frase) y sus acciones
 * apagadas, con la frase como motivo: se ven, pero no se pulsan.
 *
 * @template {{id: string, actions: Array<{enabled: boolean, detail: string}>}} T
 * @param {T[]} cards
 * @param {Object} [input]
 * @param {any} [input.calendar] El reloj de la campaña: de él salen la franja y el día.
 * @param {string} [input.slot] Sin reloj, la franja.
 * @param {number} [input.day] Sin reloj, el día.
 * @param {string} [input.festival] La fiesta de hoy aquí, si la hay.
 * @param {Array<{name: string, service?: string}>} [input.keepers] La gente de aquí, con lo que atiende.
 * @param {boolean} [input.innHere] Si hay posada aquí: entonces quien lo lleva está en ella.
 * @returns {Array<T & {closed?: ClosedNote}>}
 */
export function closeShopCards(cards, { calendar = null, slot = '', day = 0, festival = '', keepers = [], innHere = false } = {}) {
    const clock = calendar ? normalizeCalendar(calendar) : null;
    const said = clock ? clock.slots[clock.slotIndex]?.id ?? '' : text(slot);
    // Una franja que no es de las tres (un reloj a medida) no cierra nada: lo que no se sabe no se cierra.
    const now = Object.keys(WHEN).includes(said) ? said : '';
    const today = clock ? clock.day : Math.floor(Number(day) || 0);
    return (Array.isArray(cards) ? cards : []).map(card => {
        const reason = closedReason({ service: card?.id, slot: now, day: today, festival });
        if (!reason) return card;
        const keeper = text((Array.isArray(keepers) ? keepers : []).find(k => text(k?.service) === text(card.id))?.name);
        const line = closedLine({ service: card.id, keeper, innHere, reason, festival });
        return {
            ...card,
            closed: { reason, sign: closedSign(reason), line, keeper },
            actions: (Array.isArray(card.actions) ? card.actions : []).map(action => ({ ...action, enabled: false, detail: line })),
        };
    });
}
