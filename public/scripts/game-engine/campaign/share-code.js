/**
 * El código de un mundo: la semilla y de dónde sale, para jugar el mismo mundo sin pasarse
 * archivos (idea 180).
 *
 * La semilla ya decía casi todo («la de otro se puede jugar escribiendo su semilla»), pero
 * no de qué mundo o plantilla partía: la misma semilla sobre otra plantilla es otro mundo.
 * El código lleva las dos cosas, y se dicta igual de fácil:
 *
 *     molino-ceniza-siete@aldea-del-molino
 *
 * Se copia desde la pausa de la partida y se pega en la semilla del taller: el taller
 * pone la semilla y elige la plantilla (o el mundo) de partida. Lo que se escriba a mano
 * en el taller no viaja en el código: eso es tuyo.
 *
 * Puro: hace y lee códigos.
 */

import { cleanSeed } from './seed.js';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * El código de un mundo: la semilla, y su origen si lo tiene.
 *
 * @param {{seed: string, origin?: string}} input
 * @returns {string}
 */
export function makeShareCode({ seed, origin = '' }) {
    const clean = cleanSeed(seed);
    if (!clean) return '';
    const from = text(origin).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9ñ_-]/g, '');
    return from ? `${clean}@${from}` : clean;
}

/**
 * Leer un código: la semilla y el origen. Un código sin `@` es solo una semilla.
 *
 * @param {any} code
 * @returns {{seed: string, origin: string}}
 */
export function readShareCode(code) {
    const [seedPart, ...rest] = text(code).split('@');
    return { seed: cleanSeed(seedPart), origin: text(rest.join('@')).toLowerCase() };
}

/**
 * Si algo escrito parece un código con origen, y no una semilla suelta.
 *
 * @param {any} value
 * @returns {boolean}
 */
export function isShareCode(value) {
    const read = readShareCode(value);
    return Boolean(read.seed && read.origin);
}
