/**
 * Modo director: añadir un PNJ o un sitio en mitad de la partida (idea 185).
 *
 * Arreglar un mundo sobre la marcha pedía salir al editor de la campaña. Ahora, desde la
 * pausa, se escribe a alguien (nombre, dónde vive, oficio, qué quiere) o un sitio (nombre,
 * tipo y a qué sitio conocido se une, y en cuántos días), y entra en el mundo al momento:
 * el PNJ con su ficha para el narrador, el sitio con su camino en las dos direcciones.
 *
 * Puro: comprueba lo escrito y arma lo que se guarda.
 */

/** Los tipos de sitio que se pueden añadir. */
export const PLACE_TYPES = ['village', 'city', 'outpost', 'ruins', 'dungeon', 'camp', 'sanctuary', 'wilderness', 'port'];

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Una persona nueva: la entrada del mundo, o el motivo si falta algo.
 *
 * @param {{name: string, where: string, trade?: string, wants?: string}} input
 * @param {{places: string[], people: string[]}} known
 * @returns {{ok: boolean, reason: string, entry: any}}
 */
export function newPerson({ name, where, trade = '', wants = '' }, known) {
    const who = text(name);
    const place = text(where);
    if (!who) return { ok: false, reason: 'Falta el nombre.', entry: null };
    if ((known.people || []).some(p => text(p).toLowerCase() === who.toLowerCase())) return { ok: false, reason: `Ya hay alguien que se llama ${who}.`, entry: null };
    if (!(known.places || []).includes(place)) return { ok: false, reason: 'Tiene que vivir en un sitio que exista.', entry: null };
    return {
        ok: true, reason: '',
        entry: {
            group: 'NPCs',
            title: who,
            content: [text(trade) ? `${who}, ${text(trade).toLowerCase()}.` : who, text(wants) ? `Quiere: ${text(wants)}` : ''].filter(Boolean).join(' '),
            keys: [who],
            dndData: { entityType: 'npc', name: who, title: text(trade), wants: text(wants), mapPosition: { locationName: place, gridX: 0, gridY: 0 } },
        },
    };
}

/**
 * Un sitio nuevo, unido a uno conocido.
 *
 * @param {{name: string, type: string, linkTo: string, days: number, description?: string}} input
 * @param {{places: string[]}} known
 * @returns {{ok: boolean, reason: string, place: any, route: any}}
 */
export function newPlace({ name, type, linkTo, days, description = '' }, known) {
    const title = text(name);
    const link = text(linkTo);
    if (!title) return { ok: false, reason: 'Falta el nombre.', place: null, route: null };
    if ((known.places || []).some(p => text(p).toLowerCase() === title.toLowerCase())) return { ok: false, reason: `${title} ya existe.`, place: null, route: null };
    if (!(known.places || []).includes(link)) return { ok: false, reason: 'Tiene que unirse a un sitio que exista.', place: null, route: null };
    const d = Math.max(1, Math.min(9, Math.floor(Number(days) || 1)));
    return {
        ok: true, reason: '',
        place: {
            name: title, description: text(description), url: '', gridWidth: 50, gridHeight: 50, boards: [],
            locationType: PLACE_TYPES.includes(text(type)) ? text(type) : 'wilderness',
            routes: [{ to: link, days: d }],
        },
        route: { to: title, days: d },
    };
}
