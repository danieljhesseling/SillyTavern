/**
 * Ley y crimen: robar sube «buscado», y aparecen guardias (idea 96).
 *
 * Solo pasa algo si se roba. En la tienda se puede intentar llevarse algo sin pagar (Juego
 * de manos contra la vigilancia del sitio). Si sale, gratis. Si no, os pillan: se paga una
 * multa del doble, y el sitio os apunta. Cada robo pillado sube lo buscados que estáis
 * allí; con 2 o más, al llegar os paran los guardias: multa o huir (y huir sube más).
 * Se olvida con el tiempo: un punto por semana.
 *
 * Puro: la tirada que hace falta, lo que cuesta y lo que se apunta.
 */

/** La vigilancia por tipo de sitio: lo que hay que sacar para robar. */
export const WATCH = /** @type {Record<string, number>} */ ({ city: 16, port: 15, village: 13, outpost: 14 });

/** Desde cuánto os paran los guardias al llegar. */
export const WANTED_GUARDS = 2;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * @param {any} raw
 * @returns {Record<string, number>}
 */
export function readWanted(raw) {
    const out = /** @type {Record<string, number>} */ ({});
    for (const [place, level] of Object.entries(raw && typeof raw === 'object' ? raw : {})) {
        const n = Math.max(0, Math.floor(Number(level) || 0));
        if (text(place) && n > 0) out[text(place)] = n;
    }
    return out;
}

/**
 * La CD de robar aquí.
 *
 * @param {string} locationType
 * @returns {number}
 */
export function stealDC(locationType) {
    return WATCH[text(locationType).toLowerCase()] ?? 14;
}

/**
 * Lo que pasa al intentarlo.
 *
 * @param {Object} input
 * @param {boolean} input.success
 * @param {number} input.price Lo que valía.
 * @param {string} input.place
 * @param {any} input.wanted
 * @returns {{free: boolean, fine: number, wanted: Record<string, number>, line: string}}
 */
export function stealOutcome({ success, price, place, wanted }) {
    const list = readWanted(wanted);
    if (success) return { free: true, fine: 0, wanted: list, line: 'Nadie lo ve: sale por la puerta sin pagar.' };
    const fine = Math.max(5, Math.round((Number(price) || 0) * 2));
    const next = { ...list, [text(place)]: (list[text(place)] ?? 0) + 1 };
    return { free: false, fine, wanted: next, line: `Os pillan. Multa de ${fine} de oro, y en ${text(place)} os tienen apuntados (buscados: ${next[text(place)]}).` };
}

/**
 * Si al llegar os paran.
 *
 * @param {any} wanted
 * @param {string} place
 * @returns {{stop: boolean, level: number, fine: number}}
 */
export function guardsAt(wanted, place) {
    const level = readWanted(wanted)[text(place)] ?? 0;
    return { stop: level >= WANTED_GUARDS, level, fine: level * 15 };
}

/**
 * Pagar la multa limpia el sitio; huir lo empeora.
 *
 * @param {any} wanted
 * @param {string} place
 * @param {'pay'|'flee'} what
 * @returns {Record<string, number>}
 */
export function settleGuards(wanted, place, what) {
    const list = readWanted(wanted);
    if (what === 'pay') {
        const rest = { ...list };
        delete rest[text(place)];
        return rest;
    }
    return { ...list, [text(place)]: (list[text(place)] ?? 0) + 1 };
}

/**
 * Una semana más: todo baja un punto.
 *
 * @param {any} wanted
 * @returns {Record<string, number>}
 */
export function coolDown(wanted) {
    return readWanted(Object.fromEntries(Object.entries(readWanted(wanted)).map(([p, n]) => [p, n - 1])));
}
