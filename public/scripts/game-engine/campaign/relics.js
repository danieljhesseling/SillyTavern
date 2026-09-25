/**
 * Las reliquias del mundo: objetos con nombre y con historia, ligados a un momento (idea 132).
 *
 * El guionista ya escribía objetos con `historia` y `ligado_a` —el cáliz de Vane, la cota del
 * sargento de Keller—, pero el juego los metía en el montón del botín: podía caer el cáliz a
 * un lobo cualquiera, dos veces, o no caer nunca. Aquí se separan:
 *
 * - Un objeto **ligado** a un hito o a un encargo es una reliquia: no cae como botín. Llega al
 *   grupo cuando se cumple ese hito o se entrega ese encargo, una sola vez, con su historia.
 * - Lo demás sigue siendo botín, como siempre.
 *
 * Puro: separa y decide qué toca. Quien llama lo mete en la mochila y lo cuenta.
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * A qué está ligado un objeto del catálogo, si lo está.
 *
 * @param {any} item
 * @returns {{kind: 'milestone'|'contract', id: string}|null}
 */
export function boundOf(item) {
    const bound = item?.boundTo;
    if (!bound || typeof bound !== 'object') return null;
    const kind = bound.kind === 'contract' ? 'contract' : bound.kind === 'milestone' ? 'milestone' : '';
    const id = text(bound.id);
    return kind && id ? { kind, id } : null;
}

/**
 * Lo que puede caer como botín: todo menos las reliquias.
 *
 * @param {any[]} catalogue
 * @returns {any[]}
 */
export function lootable(catalogue) {
    return (Array.isArray(catalogue) ? catalogue : []).filter(item => !boundOf(item));
}

/**
 * Las reliquias que tocan con lo que acaba de pasar, sin las ya entregadas.
 *
 * @param {any[]} catalogue
 * @param {{kind: 'milestone'|'contract', id: string}} event
 * @param {string[]} [given] Los nombres ya entregados en esta partida.
 * @returns {any[]}
 */
export function relicsFor(catalogue, event, given = []) {
    const done = new Set((Array.isArray(given) ? given : []).map(n => text(n).toLowerCase()));
    return (Array.isArray(catalogue) ? catalogue : []).filter(item => {
        const bound = boundOf(item);
        return bound && bound.kind === event?.kind && bound.id.toLowerCase() === text(event?.id).toLowerCase()
            && !done.has(text(item?.name).toLowerCase());
    });
}

/**
 * Cómo se cuenta al llegar: el nombre y la historia.
 *
 * @param {any} item
 * @returns {string}
 */
export function describeRelic(item) {
    const story = text(item?.description);
    return `«${text(item?.name)}»${story ? `: ${story}` : ''}`;
}
