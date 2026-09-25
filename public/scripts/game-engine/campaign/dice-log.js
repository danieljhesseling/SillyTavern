/**
 * El historial de dados (idea 168): ¿el dado me odia?
 *
 * Cada d20 que tira el motor se apunta —quién, para qué, qué salió—, y de ahí salen las
 * cuentas: la media, los 20 y los 1, cuántas salieron. Contestar a «este dado está trucado»
 * con números es lo que hace que uno se fíe del dado.
 *
 * Puro: la lista y sus cuentas.
 */

/** Los que se guardan. */
export const MAX_ROLLS = 200;

/**
 * @typedef {Object} RollEntry
 * @property {string} title
 * @property {number} natural
 * @property {number} total
 * @property {number|null} dc
 */

/**
 * @param {any} raw
 * @returns {RollEntry[]}
 */
export function readRolls(raw) {
    return (Array.isArray(raw) ? raw : [])
        .filter(r => r && Number(r.natural) >= 1 && Number(r.natural) <= 20)
        .map(r => ({
            title: String(r.title ?? ''),
            natural: Math.floor(Number(r.natural)),
            total: Math.floor(Number(r.total) || 0),
            dc: Number.isFinite(Number(r.dc)) && r.dc !== null ? Number(r.dc) : null,
        }));
}

/**
 * Apuntar una tirada de d20.
 *
 * @param {any} raw
 * @param {RollEntry} roll
 * @returns {RollEntry[]}
 */
export function addRoll(raw, roll) {
    const list = readRolls(raw);
    if (!(Number(roll?.natural) >= 1 && Number(roll?.natural) <= 20)) return list;
    list.push(...readRolls([roll]));
    return list.slice(-MAX_ROLLS);
}

/**
 * Las cuentas, y el veredicto.
 *
 * El veredicto no exagera: con pocas tiradas, cualquier media es posible, y eso se dice.
 *
 * @param {any} raw
 * @returns {{count: number, average: number, twenties: number, ones: number, passed: number, judged: number, verdict: string}}
 */
export function diceStats(raw) {
    const list = readRolls(raw);
    const count = list.length;
    const average = count > 0 ? list.reduce((sum, r) => sum + r.natural, 0) / count : 0;
    const judged = list.filter(r => r.dc !== null).length;
    const passed = list.filter(r => r.dc !== null && (r.natural === 20 || r.total >= Number(r.dc))).length;
    const twenties = list.filter(r => r.natural === 20).length;
    const ones = list.filter(r => r.natural === 1).length;
    const verdict = count < 20 ? 'Pocas tiradas todavía: cualquier media es posible.'
        : average < 9.5 ? 'Por debajo de lo normal (10,5). Mala racha, pero el dado es el mismo para todos.'
            : average > 11.5 ? 'Por encima de lo normal (10,5). Aprovechad la racha.'
                : 'Lo normal: un d20 honrado ronda el 10,5.';
    return { count, average: Math.round(average * 10) / 10, twenties, ones, passed, judged, verdict };
}
