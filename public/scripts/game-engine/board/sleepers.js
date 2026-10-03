/**
 * Los que duermen en un tablero, y pasar a su lado sin despertarlos (E1.1 de
 * wiki/ROADMAP_ENTRETENIDO.md: «robar el cofre y llegar a la salida sin despertar a los
 * guardias»).
 *
 * Un enemigo escrito con `"asleep": true` en el tablero no espera despierto: no empieza la
 * pelea al verle. Pero quien pasa cerca hace ruido. Es la regla de 5e para esconderse: una
 * tirada de **Sigilo** de quien se mueve contra la **Percepción pasiva** de cada uno que
 * podría oírle. Dormido, su Percepción pasiva va con desventaja (−5, como en 5e). Una tirada
 * por movimiento, comparada con cada uno de los que están cerca. Con armadura que estorba
 * (`stealthDisadvantage`, la pesada), la tirada va con desventaja.
 *
 * Si alguno se despierta, despierta a los demás y empieza la pelea: eso lo hace quien llama.
 *
 * Puro: con los dados de quien llama.
 */

/** Hasta dónde se oye a quien pasa: 10 pies (dos casillas). */
export const HEAR_CELLS = 2;

/** Dormido, se oye peor: la Percepción pasiva con desventaja, −5 (5e). */
export const ASLEEP_PENALTY = 5;

/**
 * Si un enemigo del tablero duerme.
 *
 * @param {any} placement
 * @returns {boolean}
 */
export function isAsleep(placement) {
    return Boolean(placement && placement.asleep === true);
}

/**
 * Los que duermen de una lista de enemigos del tablero.
 *
 * @template T
 * @param {T[]} placements
 * @returns {T[]}
 */
export function sleepersOf(placements) {
    return (Array.isArray(placements) ? placements : []).filter(isAsleep);
}

/**
 * Los que están despiertos (los que esperan y empiezan la pelea al veros).
 *
 * @template T
 * @param {T[]} placements
 * @returns {T[]}
 */
export function awakeOf(placements) {
    return (Array.isArray(placements) ? placements : []).filter(p => !isAsleep(p));
}

/**
 * Todos despiertos: la lista nueva, sin la marca.
 *
 * @param {any[]} placements
 * @returns {any[]}
 */
export function wakeAll(placements) {
    return (Array.isArray(placements) ? placements : []).map(p => {
        if (!isAsleep(p)) return p;
        const rest = { ...p };
        delete rest.asleep;
        return rest;
    });
}

/**
 * La Percepción pasiva de quien duerme: 10 + su Sabiduría (+ su competencia si la dice la
 * ficha, `perception`), −5 por estar dormido. Nunca menos de 1.
 *
 * @param {{wisdom?: number, perception?: number}} [template]
 * @returns {number}
 */
export function sleeperDC(template) {
    const wis = Math.floor(((Number(template?.wisdom) || 10) - 10) / 2);
    const skill = Number(template?.perception);
    const passive = 10 + (Number.isFinite(skill) && template?.perception !== undefined ? skill : wis);
    return Math.max(1, passive - ASLEEP_PENALTY);
}

/**
 * Los que duermen lo bastante cerca para oír a quien está en `cell`.
 *
 * @template {{x: number, y: number}} T
 * @param {T[]} sleepers
 * @param {{x: number, y: number}} cell
 * @param {number} [reach]
 * @returns {T[]}
 */
export function sleepersNear(sleepers, cell, reach = HEAR_CELLS) {
    return (Array.isArray(sleepers) ? sleepers : []).filter(s => Math.max(
        Math.abs((Number(s.x) || 0) - (Number(cell?.x) || 0)),
        Math.abs((Number(s.y) || 0) - (Number(cell?.y) || 0)),
    ) <= reach);
}

/**
 * Pasar sin hacer ruido: una tirada de Sigilo, comparada con cada uno de los que oyen.
 *
 * @param {Object} input
 * @param {string} input.who Quien se mueve.
 * @param {number} input.modifier Su Sigilo.
 * @param {Array<{name: string, dc: number}>} input.listeners Los que duermen cerca, con su Percepción pasiva ya dormida.
 * @param {() => number} input.rollD20
 * @param {boolean} [input.clumsy] Con desventaja (armadura que estorba).
 * @returns {{natural: number, total: number, woke: string[], line: string}}
 */
export function sneakPast({ who, modifier, listeners, rollD20, clumsy = false }) {
    const die = () => Math.max(1, Math.min(20, Math.floor(Number(rollD20()) || 1)));
    const first = die();
    const natural = clumsy ? Math.min(first, die()) : first;
    const total = natural + (Math.trunc(Number(modifier)) || 0);
    const list = Array.isArray(listeners) ? listeners : [];
    const woke = list.filter(l => total < (Number(l.dc) || 0)).map(l => String(l.name));
    const hardest = list.reduce((top, l) => Math.max(top, Number(l.dc) || 0), 0);
    const sign = modifier >= 0 ? '+' : '';
    const roll = `Sigilo de ${who}: ${natural}${sign}${modifier} = ${total} contra ${hardest}${clumsy ? ' (con desventaja por la armadura)' : ''}`;
    const line = woke.length > 0
        ? `🔔 ${roll}. ${woke.join(', ')} se despierta${woke.length > 1 ? 'n' : ''}.`
        : `🤫 ${roll}. Nadie se despierta.`;
    return { natural, total, woke, line };
}
