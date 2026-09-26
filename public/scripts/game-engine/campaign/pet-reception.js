/**
 * Cómo recibe la gente del mundo a la mascota (T3 de wiki/LO_QUE_FALTA.md).
 *
 * La mascota comentaba el mundo, pero el mundo no la veía. Ahora cada oficio tiene sus
 * gustos —al posadero no le hacen gracia los perros en el comedor, el herrero agradece
 * uno que guarde la puerta, en el templo no quieren cuervos—, y cada persona tiene su giro:
 * una de cada cinco piensa lo contrario que su oficio, siempre la misma (sale de su nombre).
 * Cada uno reacciona una vez, al encontrársela: una línea, sin llamar al modelo, y un paso
 * de actitud, que ya mueve precios y tratos.
 *
 * Puro: decide con lo que le pasan.
 */

/** Lo que piensa cada oficio de cada especie: +1 le gusta, −1 no. Lo que no está, le da igual. */
export const RECEPTION = {
    posada: { gato: 1, perro: -1, zorro: -1, loro: 1 },
    tienda: { perro: 1, cuervo: -1, loro: -1, zorro: -1 },
    herreria: { perro: 1, halcon: 1, gato: -1 },
    templo: { perro: 1, cuervo: -1, familiar: -1, espiritu: -1 },
};

/** Una de cada cuántas personas piensa lo contrario que su oficio. */
export const CONTRARIAN_EVERY = 5;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Un número fijo por nombre, para que la misma persona piense siempre lo mismo.
 *
 * @param {string} value
 * @returns {number}
 */
function hashOf(value) {
    let h = 0;
    for (const ch of text(value)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return h;
}

/**
 * Lo que piensa alguien de una mascota.
 *
 * @param {Object} input
 * @param {string} input.species
 * @param {string} input.service El oficio de quien la ve (`posada`, `tienda`, `herreria`, `templo`).
 * @param {string} input.npc Su nombre.
 * @returns {-1|0|1}
 */
export function moodToward({ species, service, npc }) {
    const table = /** @type {Record<string, Record<string, number>>} */ (RECEPTION)[text(service)] ?? {};
    const base = Number(table[text(species)] ?? 0);
    if (base === 0) return 0;
    const contrarian = hashOf(`${text(npc)}|${text(species)}`) % CONTRARIAN_EVERY === 0;
    return /** @type {-1|1} */ (contrarian ? -base : base);
}

/**
 * Quién reacciona ahora: la gente con oficio de este sitio que aún no la había visto.
 *
 * @param {Object} input
 * @param {{name: string, species: string}|null} input.pet
 * @param {Array<{name: string, where: string, service?: string, dead?: boolean}>} input.npcs
 * @param {string} input.here
 * @param {string[]} [input.met] A quién le ha visto ya la mascota.
 * @param {string} [input.speciesLabel] Cómo se dice la especie («perro», «halcón»).
 * @returns {Array<{npc: string, mood: -1|1, line: string}>}
 */
export function reactionsHere({ pet, npcs, here, met = [], speciesLabel = '' }) {
    if (!pet?.species) return [];
    const seen = new Set((Array.isArray(met) ? met : []).map(text));
    const label = text(speciesLabel) || text(pet.species);
    /** @type {Array<{npc: string, mood: -1|1, line: string}>} */
    const out = [];
    for (const npc of Array.isArray(npcs) ? npcs : []) {
        if (!npc || npc.dead || !text(npc.service) || text(npc.where).toLowerCase() !== text(here).toLowerCase()) continue;
        if (seen.has(text(npc.name))) continue;
        const mood = moodToward({ species: pet.species, service: text(npc.service), npc: text(npc.name) });
        if (mood === 0) continue;
        out.push({
            npc: text(npc.name),
            mood,
            line: mood > 0
                ? `${text(npc.name)} se agacha a saludar a ${text(pet.name)}: «Qué buen ${label}. Aquí es bienvenido.»`
                : `${text(npc.name)} mira a ${text(pet.name)} de reojo: «Ese ${label}, fuera de mi vista.»`,
        });
    }
    return out;
}
