/**
 * Los rumores: lo que se oye en cada sitio.
 *
 * Un mundo escrito trae sus rumores con quién los dice, dónde, si son verdad y a dónde
 * llevan. Escucharlos es barato y es la forma más natural de descubrir: un rumor puede
 * **llevar a un sitio escondido**, y oírlo lo pone en el mapa.
 *
 * Se oyen en orden, uno cada vez, y no se repiten: el segundo que se escucha en la taberna
 * es otro, no el mismo contado dos veces. Si es verdad o no, no se dice: el narrador lo
 * cuenta en boca de quien lo dice, y descubrirlo es cosa de quien juega.
 *
 * Puro: elige y dice. Quien llama revela y guarda.
 */

/** @param {any} value */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * @typedef {{id: string, by: string, where: string, text: string, truth: string, leadsTo: string}} Rumor
 */

/**
 * @param {any} raw
 * @returns {Rumor[]}
 */
export function readRumors(raw) {
    return (Array.isArray(raw) ? raw : [])
        .filter(r => r && text(r.text))
        .map((r, index) => ({
            id: text(r.id) || `rumor_${index + 1}`,
            by: text(r.by),
            where: text(r.where),
            text: text(r.text),
            truth: text(r.truth),
            leadsTo: text(r.leadsTo),
        }));
}

/**
 * Los que quedan por oír aquí.
 *
 * @param {Object} input
 * @param {any} input.rumors
 * @param {string} input.here
 * @param {string[]} [input.heard]
 * @returns {Rumor[]}
 */
export function rumorsHere({ rumors, here, heard = [] }) {
    const done = new Set(heard.map(text));
    const where = text(here).toLowerCase();
    return readRumors(rumors).filter(r => r.where.toLowerCase() === where && !done.has(r.id));
}

/**
 * El siguiente que se oye aquí, o null si ya no queda ninguno.
 *
 * @param {Object} input
 * @param {any} input.rumors
 * @param {string} input.here
 * @param {string[]} [input.heard]
 * @returns {Rumor|null}
 */
export function nextRumor({ rumors, here, heard = [] }) {
    return rumorsHere({ rumors, here, heard })[0] ?? null;
}

/**
 * Lo que se le manda al narrador: el rumor, en boca de quien lo dice, y sin su verdad.
 *
 * @param {Rumor} rumor
 * @returns {string}
 */
export function describeRumor(rumor) {
    const who = rumor.by || 'Alguien del lugar';
    return `${who} cuenta: «${rumor.text}» Cuéntalo tal cual, en su boca y con su voz. `
        + 'No digas si es verdad: eso lo descubre quien juega.';
}
