/**
 * Huir de un combate, con su precio.
 *
 * Con muerte permanente, un combate que solo se puede ganar o morir es una trampa. Pero una
 * huida gratis tampoco vale: si salir cuesta lo mismo que no haber entrado, no hay
 * decision. Asi que huir se puede siempre, y se paga:
 *
 * - **Quien tiene un enemigo pegado se lleva un golpe al darse la vuelta**: el ataque de
 *   oportunidad de siempre, uno por enemigo pegado. Destrabarse antes es la forma de no
 *   pagarlo, y por eso esa maniobra existe.
 * - **Se deja el botin** y el tablero sin ganar: lo que habia que hacer alli sigue ahi.
 * - **Se sabe**: queda en la memoria del mundo y el narrador lo cuenta.
 *
 * Puro: dice lo que va a costar, antes de pulsar, y quien paga que.
 */

const MELEE_FEET = 5;

/**
 * @typedef {Object} RetreatPlan
 * @property {Array<{memberId: string, memberName: string, enemyId: string, enemyName: string}>} blows
 *   Los golpes al darse la vuelta: un enemigo pegado, un golpe.
 * @property {string[]} safe Quien sale sin que nadie le toque (destrabado o sin nadie pegado).
 * @property {string} summary Lo que cuesta, en una linea, para el aviso antes de huir.
 */

/**
 * @param {Object} input
 * @param {Array<{id: any, name: string, x: number, y: number, hp: number}>} input.party
 * @param {Array<{id: any, name: string, x: number, y: number, hp: number}>} input.enemies
 * @param {string[]} [input.disengaged] Quien se destrabo este turno.
 * @param {(ax: number, ay: number, bx: number, by: number) => number} input.distanceFeet
 * @returns {RetreatPlan}
 */
export function planRetreat({ party, enemies, disengaged = [], distanceFeet }) {
    const free = new Set(disengaged.map(String));
    const standing = (party || []).filter(m => Number(m.hp) > 0);
    const foes = (enemies || []).filter(e => Number(e.hp) > 0);

    /** @type {RetreatPlan['blows']} */
    const blows = [];
    /** @type {string[]} */
    const safe = [];
    for (const member of standing) {
        // Pegado es cuerpo a cuerpo: el arquero de lejos no tiene hueco que aprovechar.
        const close = free.has(String(member.id)) ? [] : foes.filter(e =>
            distanceFeet(member.x, member.y, e.x, e.y) <= MELEE_FEET);
        if (close.length === 0) safe.push(String(member.name));
        for (const enemy of close) {
            blows.push({
                memberId: String(member.id), memberName: String(member.name),
                enemyId: String(enemy.id), enemyName: String(enemy.name),
            });
        }
    }

    const summary = blows.length === 0
        ? 'Nadie os tiene trabados: salís sin que os toquen. Se deja el botín y el tablero sin ganar.'
        : `Al daros la vuelta: ${blows.map(b => `${b.enemyName} golpea a ${b.memberName}`).join(', ')}. `
            + 'Se deja el botín y el tablero sin ganar.';
    return { blows, safe, summary };
}
