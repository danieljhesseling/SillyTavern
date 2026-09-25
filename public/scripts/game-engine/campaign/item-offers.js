/**
 * El narrador propone objetos, y quien juega los acepta (idea 139).
 *
 * El chat contaba que encontrabais una daga en el cadáver o que la posadera os regalaba una
 * manta, y en la mochila no aparecía nada: el modelo no puede tocar el estado del juego, y
 * no debe. Ahora puede **proponerlo** (`dar_objeto`), igual que propone un sitio, y quien
 * juega decide si lo coge.
 *
 * Y lo que entra lo decide el motor, no la frase: si el objeto existe en el catálogo del
 * mundo o de la tienda, entra tal cual; si no, o si es algo mágico o raro, entra como una
 * **curiosidad** que no hace nada que el juego sepa. Así el chat da botín sin inventarse
 * una espada +3.
 *
 * Puro: apunta, saca y decide qué entra. Quien llama lo mete en la mochila.
 */

/** Cuántas ofertas esperan a la vez. */
export const MAX_OFFERS = 3;

/** Las rarezas que el chat puede dar tal cual. */
const PLAIN_RARITY = ['', 'common', 'común', 'comun', 'uncommon', 'poco común', 'poco comun'];

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * @typedef {{id: string, name: string, note: string, to: string, day: number}} ItemOffer
 */

/**
 * @param {any} raw
 * @returns {ItemOffer[]}
 */
export function readOffers(raw) {
    return (Array.isArray(raw) ? raw : [])
        .filter((/** @type {any} */ o) => o && text(o.id) && text(o.name))
        .map((/** @type {any} */ o) => ({ id: text(o.id), name: text(o.name), note: text(o.note), to: text(o.to), day: Math.max(1, Math.floor(Number(o.day) || 1)) }))
        .slice(-MAX_OFFERS);
}

/**
 * Apuntar lo que propone el narrador.
 *
 * @param {any} raw
 * @param {{name?: string, note?: string, to?: string}} offer
 * @param {{day: number}} context
 * @returns {{offers: ItemOffer[], added: boolean, reason: string, offer: ItemOffer|null}}
 */
export function addOffer(raw, offer, { day }) {
    const list = readOffers(raw);
    const name = text(offer?.name).slice(0, 60);
    if (!name) return { offers: list, added: false, reason: 'Sin nombre.', offer: null };
    if (list.some(o => o.name.toLowerCase() === name.toLowerCase())) {
        return { offers: list, added: false, reason: 'Ya está ofrecido.', offer: null };
    }
    const today = Math.max(1, Math.floor(Number(day) || 1));
    const made = { id: `o${today}-${list.length + 1}-${name.length}`, name, note: text(offer?.note).slice(0, 200), to: text(offer?.to), day: today };
    return { offers: [...list, made].slice(-MAX_OFFERS), added: true, reason: '', offer: made };
}

/**
 * Sacar una oferta, al aceptarla o rechazarla.
 *
 * @param {any} raw
 * @param {string} idOrName
 * @returns {{offer: ItemOffer|null, offers: ItemOffer[]}}
 */
export function takeOffer(raw, idOrName) {
    const list = readOffers(raw);
    const wanted = text(idOrName).toLowerCase();
    const offer = list.find(o => o.id.toLowerCase() === wanted || o.name.toLowerCase() === wanted) ?? null;
    return { offer, offers: list.filter(o => o !== offer) };
}

/**
 * Lo que entra de verdad: lo del catálogo si es corriente, y si no, una curiosidad.
 *
 * @param {ItemOffer} offer
 * @param {any[]} catalogue Lo que el mundo y la tienda conocen.
 * @returns {{item: any, known: boolean}}
 */
export function resolveOffer(offer, catalogue) {
    const found = (Array.isArray(catalogue) ? catalogue : [])
        .find(i => text(i?.name).toLowerCase() === text(offer?.name).toLowerCase());
    const plain = found
        && PLAIN_RARITY.includes(text(found.rarity).toLowerCase())
        && !(Number(found.magicalBonus) > 0)
        && !found.magical
        && text(found.category).toLowerCase() !== 'magic';
    if (plain) return { item: { ...found }, known: true };
    return {
        known: false,
        item: {
            name: text(offer?.name),
            type: 'gear',
            category: 'gear',
            subcategory: 'trinket',
            weight: 0.5,
            value: 1,
            description: `${text(offer?.note) || 'Os lo dieron en el camino.'} (Una curiosidad: no hace nada que el juego sepa.)`,
        },
    };
}

/**
 * Las fichas de la fila: coger cada una.
 *
 * @param {any} raw
 * @returns {Array<{id: string, label: string, icon: string, command: string}>}
 */
export function offerChips(raw) {
    return readOffers(raw).map(o => ({
        id: `offer:${o.id}`,
        label: `Coger: ${o.name}`,
        icon: 'fa-gift',
        command: `/aceptar-objeto ${o.id}`,
    }));
}
