/**
 * La partida en números (idea 200): lo que se cuenta al final, y en el diario mientras.
 *
 * El motor apunta al pasar —combates, huidas, muertes, oro ganado, rumores, sitios— y aquí se
 * convierte en unas líneas. Al acabar la partida es el cierre; antes, una forma de ver cuánto
 * se ha jugado.
 *
 * Puro: suma y describe.
 */

/** Lo que se cuenta, con cómo se dice. */
export const STAT_LABELS = {
    fights: 'combates',
    wins: 'ganados',
    fled: 'huidas',
    deaths: 'muertes en el grupo',
    gold: 'oro ganado',
    rumors: 'rumores oídos',
    trips: 'viajes',
    contracts: 'encargos cumplidos',
};

/**
 * @param {any} raw
 * @returns {Record<string, number>}
 */
export function readStats(raw) {
    /** @type {Record<string, number>} */
    const out = {};
    for (const key of Object.keys(STAT_LABELS)) out[key] = Math.max(0, Math.floor(Number(raw?.[key]) || 0));
    return out;
}

/**
 * Sumar a una cuenta.
 *
 * @param {any} raw
 * @param {keyof typeof STAT_LABELS} key
 * @param {number} [amount]
 * @returns {Record<string, number>}
 */
export function bump(raw, key, amount = 1) {
    const stats = readStats(raw);
    if (key in stats) stats[key] += Math.max(0, Math.floor(Number(amount) || 0));
    return stats;
}

/**
 * Un número con su palabra, en singular si es uno: «1 día», «3 días».
 *
 * @param {number} n
 * @param {string} one
 * @param {string} many
 * @returns {string}
 */
export function counted(n, one, many) {
    return `${n} ${n === 1 ? one : many}`;
}

/**
 * Las líneas de la partida en números.
 *
 * @param {any} raw
 * @param {{days: number, places: number}} extra Lo que no se apunta: se lee del calendario y del mapa.
 * @returns {string[]}
 */
export function describeStats(raw, { days, places }) {
    const s = readStats(raw);
    // Cada pelea acaba ganada, huida o de otra forma: nunca hay más ganadas y huidas que
    // peleas. Las partidas de antes no contaban las que empezaban desde el tablero, y
    // salía «0 combates: 1 ganados».
    const fights = Math.max(s.fights, s.wins + s.fled);
    const day = Math.max(1, Math.floor(Number(days) || 1));
    const place = Math.max(0, Math.floor(Number(places) || 0));
    return [
        `${counted(day, 'día', 'días')} de campaña · ${counted(place, 'sitio', 'sitios')} en el mapa`,
        fights > 0
            ? `${counted(fights, 'combate', 'combates')}: ${counted(s.wins, 'ganado', 'ganados')}${s.fled ? `, ${counted(s.fled, 'huida', 'huidas')}` : ''}`
            : 'Ningún combate',
        `${counted(s.contracts, 'encargo cumplido', 'encargos cumplidos')} · ${s.gold} de oro ganado`,
        `${counted(s.trips, 'viaje', 'viajes')} · ${counted(s.rumors, 'rumor oído', 'rumores oídos')}`,
        s.deaths > 0 ? `${counted(s.deaths, 'muerte', 'muertes')} en el grupo` : 'Nadie del grupo ha muerto',
    ];
}
