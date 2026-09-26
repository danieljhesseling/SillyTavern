/**
 * Las otras salidas de la moral: pedir tregua y llamar refuerzos (T2 de wiki/LO_QUE_FALTA.md).
 *
 * La moral ya hacía dos cosas: el malherido de un bando que cae se rinde (idea 6) y, con su
 * líder caído, el malherido huye (R7). Faltaban las dos que hacen que una pelea se decida
 * hablando o se complique:
 *
 * - **La tregua**: con su líder caído y la mitad de los suyos fuera, los que quedan (dos o
 *   más, ninguno jefe) bajan las armas y piden irse. Aceptarla gana el tablero, pero lo que se
 *   llevan no deja botín, y los tuyos lo juzgan. Rechazarla también se juzga. Se ofrece una
 *   vez por pelea.
 * - **Los refuerzos**: quien huye puede volver con ayuda. Dos rondas después entran dos como
 *   él por donde se fue (la salida, si la hay: B2), con el aviso una ronda antes. Una vez por
 *   pelea, como las oleadas de R6, que es lo que usa.
 *
 * Puro: decide con lo que le pasan; el azar, de fuera.
 */

/** La probabilidad de que quien huye vuelva con ayuda: más si hay por dónde. */
export const HELP_CHANCE = { exit: 0.8, none: 0.5 };

/**
 * @typedef {Object} FoeState
 * @property {string} name
 * @property {number} hp
 * @property {number} maxHp
 * @property {boolean} [boss]
 * @property {string} [role]
 */

/**
 * Si el bando pide tregua ahora.
 *
 * @param {Object} input
 * @param {FoeState[]} input.enemies Todos los del combate, caídos incluidos.
 * @param {boolean} [input.offered] Si ya se ofreció en esta pelea.
 * @returns {boolean}
 */
export function truceOffered({ enemies, offered = false }) {
    if (offered) return false;
    const all = Array.isArray(enemies) ? enemies : [];
    const standing = all.filter(e => (Number(e?.hp) || 0) > 0);
    if (standing.length < 2) return false;
    if (standing.some(e => e?.boss)) return false;
    const down = all.length - standing.length;
    if (down * 2 < all.length) return false;
    const leaderDown = all.some(e => e?.role === 'lider' && (Number(e?.hp) || 0) <= 0);
    const allHurt = standing.every(e => (Number(e.hp) || 0) * 2 < (Number(e.maxHp) || 1));
    return leaderDown || allHurt;
}

/**
 * Lo que se dice al pedirla.
 *
 * @param {string[]} names Los que quedan en pie.
 * @returns {string}
 */
export function truceLine(names) {
    const who = names.length > 0 ? names.join(', ') : 'Los que quedan';
    return `🏳️ [COMBAT] ${who} bajan las armas y piden tregua: se van si les dejáis.`;
}

/**
 * Si quien huye vuelve con ayuda.
 *
 * @param {Object} input
 * @param {() => number} input.random
 * @param {boolean} [input.hasExit]
 * @param {boolean} [input.called] Si alguien ya fue a por ayuda en esta pelea.
 * @returns {boolean}
 */
export function callsForHelp({ random, hasExit = false, called = false }) {
    if (called) return false;
    return random() < (hasExit ? HELP_CHANCE.exit : HELP_CHANCE.none);
}

/**
 * La oleada que trae: dos como él, dos rondas después, por donde se fue.
 *
 * @param {Object} input
 * @param {string} input.name El nombre de su ficha (sin el número de la instancia).
 * @param {number} input.round La ronda de ahora.
 * @param {{x: number, y: number}} input.at Por dónde entran.
 * @returns {{round: number, names: string[], x: number, y: number, tell: string, help: boolean}}
 */
export function helpWave({ name, round, at }) {
    return {
        round: (Number(round) || 1) + 2,
        names: [name, name],
        x: Math.trunc(Number(at?.x) || 0),
        y: Math.trunc(Number(at?.y) || 0),
        tell: 'Se oyen voces que se acercan: vuelven con ayuda.',
        help: true,
    };
}
