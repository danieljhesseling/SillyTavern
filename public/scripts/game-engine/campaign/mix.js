/**
 * La mezcla: de dónde sale cada cosa nueva que el mundo necesita (M7).
 *
 * Un mundo precreado empieza **80 % escrito y 20 % generado con la semilla**, y según avanza
 * el hilo pesan más la semilla y lo que propone el chat. Cada vez que el juego tiene que
 * llenar un hueco —el siguiente encargo, la gente de un sitio, un bicho, un objeto del
 * botín— pregunta aquí de dónde sale.
 *
 * Tres reglas:
 *
 * - **El hilo no se mezcla**: la trama es siempre escrita. Esto es para lo de alrededor.
 * - **Lo que no hay, no se elige**: si lo escrito se ha acabado, o no hay propuestas del
 *   chat, se genera con la semilla, diga lo que diga la curva.
 * - **Con el dado de la partida**: dos partidas iguales mezclan igual.
 *
 * Un mundo puede traer su propia curva (`mix` en su paquete): uno de terror puede querer
 * seguir escrito hasta el final.
 *
 * Ver wiki/ROADMAP_MUNDOS_VIVOS.md, M7.
 */

/** La curva de serie, por acto: qué parte sale de cada sitio. */
export const DEFAULT_CURVE = {
    1: { written: 0.8, seed: 0.2, chat: 0 },
    2: { written: 0.6, seed: 0.3, chat: 0.1 },
    3: { written: 0.4, seed: 0.35, chat: 0.25 },
    after: { written: 0.1, seed: 0.5, chat: 0.4 },
};

/**
 * @typedef {{written: number, seed: number, chat: number}} Share
 */

/**
 * Lo que toca en este momento de la partida, ya normalizado a 1.
 *
 * `mix` del mundo puede traer solo lo escrito por acto (`{1: 0.5}`, como los encargos) o el
 * reparto entero (`{1: {written, seed, chat}}`); lo que no diga se queda como la de serie.
 *
 * @param {number} act
 * @param {boolean} [ended]
 * @param {any} [mix]
 * @returns {Share}
 */
export function shareFor(act, ended = false, mix = null) {
    const key = ended ? 'after' : Math.max(1, Math.min(3, Math.floor(Number(act) || 1)));
    const base = DEFAULT_CURVE[/** @type {keyof typeof DEFAULT_CURVE} */ (key)];
    const custom = mix && typeof mix === 'object' ? mix[key] : undefined;

    /** @type {Share} */
    let share = { ...base };
    if (typeof custom === 'number') {
        // Solo lo escrito: el resto se reparte entre semilla y chat como en la de serie.
        const written = Math.max(0, Math.min(1, custom));
        const rest = base.seed + base.chat;
        share = {
            written,
            seed: rest > 0 ? (1 - written) * (base.seed / rest) : 1 - written,
            chat: rest > 0 ? (1 - written) * (base.chat / rest) : 0,
        };
    } else if (custom && typeof custom === 'object') {
        share = { ...base, ...custom };
    }

    const total = share.written + share.seed + share.chat;
    return total > 0
        ? { written: share.written / total, seed: share.seed / total, chat: share.chat / total }
        : { written: 0, seed: 1, chat: 0 };
}

/**
 * De dónde sale lo siguiente.
 *
 * @param {Object} input
 * @param {number} input.act
 * @param {boolean} [input.ended]
 * @param {any} [input.mix]
 * @param {number} input.roll Un número entre 0 y 1, del dado de la partida.
 * @param {{written?: boolean, chat?: boolean}} [input.have] Si queda algo escrito, y si hay
 *   propuestas del chat. Sin decirlo, se da por hecho que no.
 * @returns {'written'|'seed'|'chat'}
 */
export function chooseSource({ act, ended = false, mix = null, roll, have = {} }) {
    const share = shareFor(act, ended, mix);
    const r = Math.max(0, Math.min(0.999999, Number(roll) || 0));
    const pick = r < share.written ? 'written' : (r < share.written + share.seed ? 'seed' : 'chat');
    if (pick === 'written' && !have.written) return 'seed';
    if (pick === 'chat' && !have.chat) return 'seed';
    return pick;
}
