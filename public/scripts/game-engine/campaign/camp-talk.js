/**
 * Charlas de campamento entre dos compañeros, y rondas con tema en la posada (ideas 31 y 40).
 *
 * - **Charla de campamento** (31): junto al fuego, dos del grupo hablan entre ellos. Es una
 *   llamada al narrador, opcional, con lo que cada uno busca y el último roce que tuvieron.
 *   Y si habían chocado hoy, hacen las paces: el roce deja de pesar en la moral.
 * - **Ronda con tema** (40): invitar a una ronda ya no es solo «pasar el rato». Se elige de
 *   qué se habla —su pasado, lo que teme, lo que quiere—, y si el tema toca lo que busca,
 *   la escena cuenta como de confidente (más vínculo).
 *
 * Puro: arma lo que se le pide al narrador y dice lo que cambia.
 */

import { WANTS } from '../rules/companions.js';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** Los temas de una ronda: de qué se habla, y a quién le toca más. */
export const TOPICS = {
    pasado: { label: 'Su pasado', ask: 'que cuente de dónde viene y qué dejó atrás', likes: ['knowledge', 'quiet'] },
    miedo: { label: 'Lo que teme', ask: 'que confiese lo que le quita el sueño', likes: ['quiet', 'blood'] },
    ambicion: { label: 'Lo que quiere', ask: 'que diga qué quiere sacar de todo esto', likes: ['coin', 'glory'] },
};

/**
 * Las parejas que pueden charlar: dos compañeros vivos (el héroe no).
 *
 * @param {any[]} party
 * @returns {Array<[any, any]>}
 */
export function talkPairs(party) {
    const living = (Array.isArray(party) ? party : []).slice(1).filter(m => m && !m.dead && (Number(m.hp) || 0) > 0);
    /** @type {Array<[any, any]>} */
    const out = [];
    for (let i = 0; i < living.length; i++) for (let j = i + 1; j < living.length; j++) out.push([living[i], living[j]]);
    return out;
}

/**
 * Lo que se le pide al narrador para una charla de campamento.
 *
 * @param {Object} input
 * @param {any} input.a
 * @param {any} input.b
 * @param {(member: any) => string} input.wantsOf
 * @param {string} [input.friction] El último roce entre ellos, si lo hubo.
 * @returns {string}
 */
export function campTalkPrompt({ a, b, wantsOf, friction = '' }) {
    const want = (/** @type {any} */ m) => WANTS[/** @type {keyof typeof WANTS} */ (wantsOf(m))]?.label ?? 'algo suyo';
    return [
        `[CHARLA] Junto al fuego, ${text(a?.name)} y ${text(b?.name)} hablan entre ellos, sin el héroe.`,
        `${text(a?.name)} busca ${want(a)}; ${text(b?.name)}, ${want(b)}.`,
        friction ? `Hoy chocaron: ${text(friction)} Esta noche hacen las paces, a su manera.` : '',
        'Cuéntalo en un párrafo, con sus voces. No inventes hechos nuevos del mundo.',
    ].filter(Boolean).join(' ');
}

/**
 * Hacer las paces: los roces de hoy entre esos dos dejan de contar.
 *
 * @param {any} approval El estado de `approval.js`.
 * @param {string} a
 * @param {string} b
 * @param {number} day
 * @returns {{state: any, mended: boolean}}
 */
export function makePeace(approval, a, b, day) {
    const frictions = Array.isArray(approval?.frictions) ? approval.frictions : [];
    const pair = new Set([String(a), String(b)]);
    const kept = frictions.filter((/** @type {any} */ f) => !(Number(f.day) === Number(day) && pair.has(String(f.a)) && pair.has(String(f.b))));
    return { state: { ...(approval ?? {}), log: Array.isArray(approval?.log) ? approval.log : [], frictions: kept }, mended: kept.length < frictions.length };
}

/**
 * Lo que se le pide al narrador para una ronda con tema.
 *
 * @param {{member: any, topic: string, place: string, shared?: string}} input
 * @returns {string}
 */
export function roundPrompt({ member, topic, place, shared = '' }) {
    const spec = TOPICS[/** @type {keyof typeof TOPICS} */ (topic)] ?? TOPICS.pasado;
    return `[POSADA] Invitas a ${text(member?.name)} a una ronda en ${text(place)}, y le preguntas: ${spec.ask}. `
        + (shared ? `Puede salir algo que vivisteis juntos: ${shared} ` : '')
        + `Cuenta la conversación en un párrafo: que ${text(member?.name)} hable de eso. No inventes hechos nuevos del mundo.`;
}

/**
 * Si el tema toca lo que busca: entonces la escena cuenta como de confidente.
 *
 * @param {string} topic
 * @param {string} wants
 * @returns {boolean}
 */
export function topicHits(topic, wants) {
    return (TOPICS[/** @type {keyof typeof TOPICS} */ (topic)]?.likes ?? []).includes(text(wants));
}
