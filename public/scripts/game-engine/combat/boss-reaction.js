/**
 * La reacción del jefe: una por ronda (idea 24).
 *
 * Un jefe era un enemigo con más vida: se le pegaba por turnos hasta vaciarlo, como a un
 * saco. Ahora contesta. Una vez por ronda, cuando alguien le pega y sigue en pie, le
 * devuelve el golpe en el acto, si le llega. Pegarle deja de ser gratis, y quién se acerca
 * a él pasa a ser una decisión.
 *
 * Puro: dice si puede contestar y lo apunta. Quien llama tira el golpe (el mismo de
 * siempre: `resolveEnemyAttackOn`).
 */

/** Lo que grita al contestar. Sin llamar al modelo. */
export const BOSS_LINES = [
    '¿Eso es todo?',
    '¡Ahora me toca a mí!',
    'Error tuyo, acercarte.',
    '¡Te vas a acordar de esta!',
];

/**
 * Si el jefe puede contestar ahora: vive, le llega y no ha contestado esta ronda.
 *
 * @param {Object} input
 * @param {{boss?: boolean, currentHp: number}} input.enemy
 * @param {any} input.reacted Lo apuntado: `{[id]: ronda}`.
 * @param {string} input.id
 * @param {number} input.round
 * @param {number} input.distanceFeet A quien le ha pegado.
 * @param {number} input.reachFeet Hasta dónde llega su golpe.
 * @returns {boolean}
 */
export function canReact({ enemy, reacted, id, round, distanceFeet, reachFeet }) {
    if (!enemy?.boss || (Number(enemy.currentHp) || 0) <= 0) return false;
    if (Number(reacted?.[String(id)]) === Math.floor(Number(round) || 0)) return false;
    return Number(distanceFeet) <= Math.max(5, Number(reachFeet) || 5);
}

/**
 * Apuntar que ya ha contestado esta ronda.
 *
 * @param {any} reacted
 * @param {string} id
 * @param {number} round
 * @returns {Record<string, number>}
 */
export function markReacted(reacted, id, round) {
    return { ...(reacted && typeof reacted === 'object' ? reacted : {}), [String(id)]: Math.floor(Number(round) || 0) };
}

/**
 * Lo que dice al contestar, sin repetir el último.
 *
 * @param {() => number} random
 * @param {string} [last]
 * @returns {string}
 */
export function bossLine(random, last = '') {
    const pool = BOSS_LINES.filter(line => line !== last);
    return pool[Math.floor(random() * pool.length) % pool.length];
}
