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
 * Las líneas de la partida en números.
 *
 * @param {any} raw
 * @param {{days: number, places: number}} extra Lo que no se apunta: se lee del calendario y del mapa.
 * @returns {string[]}
 */
export function describeStats(raw, { days, places }) {
    const s = readStats(raw);
    return [
        `${Math.max(1, Math.floor(Number(days) || 1))} días de campaña · ${Math.max(0, Number(places) || 0)} sitios en el mapa`,
        `${s.fights} combates: ${s.wins} ganados${s.fled ? `, ${s.fled} huidas` : ''}`,
        `${s.contracts} encargos cumplidos · ${s.gold} de oro ganado`,
        `${s.trips} viajes · ${s.rumors} rumores oídos`,
        s.deaths > 0 ? `${s.deaths} ${s.deaths === 1 ? 'muerte' : 'muertes'} en el grupo` : 'Nadie del grupo ha muerto',
    ];
}
