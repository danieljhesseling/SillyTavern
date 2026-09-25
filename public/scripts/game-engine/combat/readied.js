/**
 * Preparar una acción: «si alguien se me acerca, le pego» (idea 4).
 *
 * Las puertas y los pasillos no tenían juego: el enemigo llegaba, pegaba, y había que
 * esperar al turno propio. Preparar gasta la acción de este turno a cambio de un golpe
 * **fuera de turno**: el primer enemigo que entre en tu alcance antes de que vuelvas a
 * actuar se lo lleva, antes de hacer nada.
 *
 * Solo el que **entra**: quien ya estaba pegado a ti no dispara nada, porque para eso ya
 * tenías tu turno.
 *
 * Puro: apunta, dice a quién le salta y lo borra. Quien llama tira el golpe.
 */

/**
 * @typedef {{id: string, round: number}} Readied
 */

/**
 * @param {any} raw
 * @returns {Readied[]}
 */
export function readReadied(raw) {
    return (Array.isArray(raw) ? raw : [])
        .filter(r => r && r.id != null)
        .map(r => ({ id: String(r.id), round: Math.max(0, Math.floor(Number(r.round) || 0)) }));
}

/**
 * Preparar: gasta la acción; dura hasta que le vuelva a tocar.
 *
 * @param {any} raw
 * @param {string} id
 * @param {number} round
 * @returns {Readied[]}
 */
export function readyAttack(raw, id, round) {
    return [...readReadied(raw).filter(r => r.id !== String(id)), { id: String(id), round: Math.floor(Number(round) || 0) }];
}

/**
 * Quitarlo: al saltar, o al volver a tocarle a quien lo preparó.
 *
 * @param {any} raw
 * @param {string} id
 * @returns {Readied[]}
 */
export function dropReadied(raw, id) {
    return readReadied(raw).filter(r => r.id !== String(id));
}

/**
 * A quién le salta el golpe preparado cuando un enemigo se mueve de `from` a `to`.
 *
 * Al primero (en el orden en que se preparó) que ahora lo tiene al alcance y antes no.
 *
 * @param {Object} input
 * @param {any} input.readied
 * @param {Array<{id: string, x: number, y: number, reachFeet: number}>} input.members Quienes pueden golpear.
 * @param {{x: number, y: number}} input.from
 * @param {{x: number, y: number}} input.to
 * @param {(a: {x: number, y: number}, b: {x: number, y: number}) => number} input.distanceFeet
 * @returns {string|null} El id de quien golpea.
 */
export function readiedAgainst({ readied, members, from, to, distanceFeet }) {
    for (const ready of readReadied(readied)) {
        const member = (members || []).find(m => String(m.id) === ready.id);
        if (!member) continue;
        const at = { x: member.x, y: member.y };
        const reach = Math.max(5, Number(member.reachFeet) || 5);
        if (distanceFeet(at, to) <= reach && distanceFeet(at, from) > reach) return ready.id;
    }
    return null;
}
