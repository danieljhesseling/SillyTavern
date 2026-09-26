/**
 * Respuestas sugeridas al hablar con alguien (idea 144).
 *
 * «Hablar con Giles» dejaba en el chat «Le digo a Giles: » y ahí se acababa la ayuda: había
 * que saber qué preguntar. Mientras se habla con alguien del sitio, la fila de fichas ofrece
 * tres cosas que se le pueden decir, con lo que el motor sabe de esa persona:
 *
 * - **¿Qué se cuenta por aquí?**, si quedan rumores en el sitio.
 * - **¿Qué necesitas?**, siempre: todo el mundo quiere algo.
 * - **Sonsacarle** (Perspicacia), si esconde algo que aún no se sabe (idea 110).
 *
 * Lo que se pregunta se deja escrito en el chat, como hasta ahora: lo que se diga lo sigue
 * decidiendo quien juega. Sonsacar es una tirada, y la hace el motor.
 *
 * Puro: decide qué se ofrece.
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * @typedef {Object} Reply
 * @property {string} id
 * @property {string} label
 * @property {string} [draft] Lo que se deja escrito en el chat.
 * @property {string} [action] Lo que hace el motor, si no es escribir.
 * @property {string} icon
 */

/**
 * Lo que se le puede decir a quien se está hablando.
 *
 * @param {Object} input
 * @param {string} input.name
 * @param {number} [input.rumors] Los que quedan por oír aquí.
 * @param {boolean} [input.canPry] Si esconde algo que se puede sonsacar ahora.
 * @param {Reply[]} [input.extra] Lo que añade el pegamento: convencerle (U6), preguntarle por un caso (U8).
 * @returns {Reply[]}
 */
export function repliesFor({ name, rumors = 0, canPry = false, extra = [] }) {
    const who = text(name);
    if (!who) return [];
    // Por importancia: la fila enseña cuatro. Lo que mueve algo (sonsacar, el caso, convencer)
    // va antes que los rumores, que también se oyen en la posada.
    /** @type {Reply[]} */
    const out = [];
    out.push({ id: 'reply-want', label: `«¿Qué necesitas, ${who}?»`, draft: `Le pregunto a ${who} qué necesita, y si podemos ayudar.`, icon: 'fa-hand-holding-heart' });
    if (canPry) out.push({ id: 'reply-pry', label: `Sonsacar a ${who} (Perspicacia)`, action: 'pry', icon: 'fa-eye' });
    out.push(...(extra ?? []));
    if (Number(rumors) > 0) {
        out.push({ id: 'reply-rumor', label: `«¿Qué se cuenta por aquí, ${who}?»`, draft: `Le pregunto a ${who} qué se cuenta por aquí.`, icon: 'fa-ear-listen' });
    }
    out.push({ id: 'reply-bye', label: `Despedirse de ${who}`, draft: `Me despido de ${who}.`, icon: 'fa-hand' });
    return out.slice(0, 4);
}
