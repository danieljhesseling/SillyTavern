/**
 * Ataques en pareja: con vínculo, dos pelean como uno (R3 del roadmap de profundidad).
 *
 * Los vínculos daban mejoras sueltas (interponerse, animar). Con esto, a partir del rango 3,
 * el héroe y ese compañero pueden hacer una jugada juntos cuando los dos están pegados al
 * mismo enemigo: atacan los dos, con ventaja, y el compañero gasta su reacción. Es la forma
 * más clara de que invertir en alguien se note en el tablero.
 *
 * Puro: quién puede hacerla con quién, y cómo se cuenta.
 *
 * Ver wiki/ROADMAP_PROFUNDIDAD.md, R3.
 */

/** El rango de vínculo desde el que se puede. */
export const PAIR_RANK = 3;

/**
 * @typedef {Object} PairFighter
 * @property {string} id
 * @property {string} name
 * @property {number} x
 * @property {number} y
 * @property {number} hp
 * @property {number} rank El rango de vínculo con el héroe (el héroe no lo usa).
 * @property {boolean} [reactionUsed]
 */

/**
 * @param {{x: number, y: number}} a
 * @param {{x: number, y: number}} b
 * @returns {boolean}
 */
function adjacent(a, b) {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 1;
}

/**
 * Con quién puede hacer una jugada en pareja quien tiene el turno, y contra quién.
 *
 * Solo entre el héroe y un compañero con vínculo: el vínculo es con el héroe. Si le toca al
 * héroe, vale cualquier compañero con rango; si le toca a un compañero con rango, solo el
 * héroe.
 *
 * @param {Object} input
 * @param {PairFighter} input.actor
 * @param {string} input.heroId
 * @param {PairFighter[]} input.party
 * @param {Array<{id: string, name: string, x: number, y: number, hp: number}>} input.enemies
 * @returns {Array<{partnerId: string, partnerName: string, enemyId: string, enemyName: string}>}
 */
export function pairOptions({ actor, heroId, party, enemies }) {
    if (!actor || (Number(actor.hp) || 0) <= 0) return [];
    const isHero = String(actor.id) === String(heroId);
    if (!isHero && (Number(actor.rank) || 0) < PAIR_RANK) return [];
    const partners = (Array.isArray(party) ? party : []).filter(p => String(p.id) !== String(actor.id)
        && (Number(p.hp) || 0) > 0 && !p.reactionUsed
        && (isHero ? (Number(p.rank) || 0) >= PAIR_RANK : String(p.id) === String(heroId)));
    /** @type {Array<{partnerId: string, partnerName: string, enemyId: string, enemyName: string}>} */
    const out = [];
    for (const enemy of Array.isArray(enemies) ? enemies : []) {
        if ((Number(enemy.hp) || 0) <= 0 || !adjacent(actor, enemy)) continue;
        for (const partner of partners) {
            if (adjacent(partner, enemy)) {
                out.push({ partnerId: String(partner.id), partnerName: String(partner.name), enemyId: String(enemy.id), enemyName: String(enemy.name) });
            }
        }
    }
    return out;
}

/**
 * La línea que abre la jugada.
 *
 * @param {string} actorName
 * @param {string} partnerName
 * @param {string} enemyName
 * @returns {string}
 */
export function pairLine(actorName, partnerName, enemyName) {
    return `🤝 ${actorName} y ${partnerName} van a una contra ${enemyName}: los dos atacan con ventaja.`;
}
