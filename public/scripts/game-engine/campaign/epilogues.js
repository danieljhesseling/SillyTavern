/**
 * El epílogo de cada compañero: qué fue de él cuando todo acabó (idea 109).
 *
 * Un final contaba lo que le pasaba al mundo, y de la gente que te había seguido no decía
 * nada. Aquí cada uno tiene su línea, sacada de lo que el motor sabe: si sigue vivo, cuánto
 * vínculo había y si venía por el oro o por ti. Quien murió por el camino tiene la suya: su
 * epitafio.
 *
 * Sin llamar al modelo: son frases escritas, con dos formas por caso para que dos
 * compañeros iguales no digan lo mismo.
 *
 * Puro: redacta.
 */

/** Las frases, por caso. `{name}` es quien, `{ending}` el final. */
const LINES = {
    close: [
        '{name} se quedó a tu lado cuando llegó «{ending}». No hizo falta preguntarle.',
        'Cuando todo acabó, {name} seguía ahí. Dicen que aún cabalgáis juntos.',
    ],
    friend: [
        '{name} siguió contigo hasta «{ending}». Luego cada uno tiró por su lado, pero sabéis dónde encontraros.',
        'Tras «{ending}», {name} se despidió con un abrazo corto. Os debéis más de una.',
    ],
    coin: [
        '{name} cobró lo último que se le debía y se marchó por el primer camino abierto.',
        '{name} contó las monedas dos veces, asintió y no volvió a mirar atrás.',
    ],
    stranger: [
        '{name} nunca dijo adiós. Tampoco hacía falta: nunca llegó a decir hola del todo.',
        'A {name} se le perdió la pista antes de «{ending}». Alguien dice que lo vio en el sur.',
    ],
};

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** Un número fijo por nombre, para elegir la forma sin azar. */
const hashOf = (/** @type {string} */ value) => [...value].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/**
 * La línea de un compañero.
 *
 * @param {Object} input
 * @param {{name: string, motive?: string, dead?: boolean}} input.member
 * @param {number} input.rank El vínculo con quien lleva el grupo, de 0 a 10.
 * @param {string} input.ending El título del final.
 * @param {string} [input.epitaph] Si murió por el camino.
 * @returns {string}
 */
export function companionEpilogue({ member, rank, ending, epitaph = '' }) {
    const name = text(member?.name) || 'Alguien';
    if (member?.dead) return text(epitaph) ? `${text(epitaph)} No llegó a ver el final.` : `${name} no llegó a ver el final.`;
    const tier = Number(rank) >= 8 ? 'close'
        : Number(rank) >= 4 ? 'friend'
            : text(member?.motive) === 'coin' ? 'coin'
                : 'stranger';
    const options = LINES[tier];
    return options[hashOf(name) % options.length]
        .replace('{name}', name)
        .replace('{ending}', text(ending) || 'el final');
}

/**
 * Las de todos los compañeros, en el orden del grupo (sin quien lo lleva).
 *
 * @param {Object} input
 * @param {any[]} input.party
 * @param {Record<string, number>} input.ranks Por id.
 * @param {string} input.ending
 * @param {Array<{name: string, epitaph: string}>} [input.graves]
 * @returns {string[]}
 */
export function companionEpilogues({ party, ranks, ending, graves = [] }) {
    return (Array.isArray(party) ? party : []).slice(1).map(member => companionEpilogue({
        member,
        rank: Number(ranks?.[String(member?.id)]) || 0,
        ending,
        epitaph: (graves || []).find(g => text(g?.name) === text(member?.name))?.epitaph ?? '',
    }));
}
