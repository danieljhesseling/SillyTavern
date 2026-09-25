/**
 * Cazar y forrajear (idea 68): el hambre tiene respuesta fuera del pueblo.
 *
 * Gasta un bloque del día. Tira quien mejor mire (Percepción), contra lo que cuesta
 * encontrar comida en ese sitio: un bosque junto al río da de comer; la nieve, poco; en un
 * pueblo no se caza, se compra. Si sale, todos comen y beben; si no, al menos agua.
 *
 * Puro: dice si se puede, cuánto cuesta y qué pasa.
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim().toLowerCase();

/**
 * Si aquí se puede forrajear, y contra qué.
 *
 * @param {{biome?: string, locationType?: string, type?: string}} location
 * @returns {{allowed: boolean, dc: number, why: string}}
 */
export function forageCheck(location) {
    const type = text(location?.locationType || location?.type);
    if (['city', 'village', 'ciudad', 'aldea', 'pueblo'].includes(type)) {
        return { allowed: false, dc: 0, why: 'Aquí la comida se compra: la posada da de comer.' };
    }
    const biome = text(location?.biome);
    const dc = /bosque|forest|pradera|campo|rio|río|lago|valle|llanura/.test(biome) ? 10
        : /nieve|hielo|tundra|desierto|paramo|páramo|montañ|volcan|cueva|mazmorra/.test(biome) ? 15
            : 12;
    return { allowed: true, dc, why: '' };
}

/**
 * Lo que sale de la batida.
 *
 * @param {{success: boolean, who: string}} roll
 * @returns {{ate: boolean, drank: boolean, line: string}}
 */
export function forageResult({ success, who }) {
    return success
        ? { ate: true, drank: true, line: `${who} encuentra de comer para todos: hoy nadie pasa hambre.` }
        : { ate: false, drank: true, line: `${who} vuelve con agua y poco más: la comida tendrá que esperar.` };
}
