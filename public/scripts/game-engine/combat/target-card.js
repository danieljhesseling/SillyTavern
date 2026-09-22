/**
 * What the card over an enemy says, and which buttons it offers.
 *
 * The rule the whole point-and-click layer rests on: **a click never spends anything, a
 * button does.** Attacking is irreversible and costs the action of the turn, so clicking
 * an enemy opens this card and nothing else happens. The card is where the spending
 * lives, and where it can be refused with a reason instead of silently doing nothing.
 *
 * Pure: it is handed the actor, the target and the turn, and returns what to draw.
 *
 * See wiki/ROADMAP_JUEGO_SIN_COMANDOS.md, K0 y K1.
 */

/**
 * @typedef {Object} TargetAction
 * @property {string} id
 * @property {string} label
 * @property {boolean} enabled
 * @property {string} reason Why it is off, when it is off.
 */

/**
 * @typedef {Object} TargetCard
 * @property {string} name
 * @property {number} hp
 * @property {number} maxHp
 * @property {number} armorClass
 * @property {number} cover Extra armour from cover, 0 when none.
 * @property {number} distanceFeet
 * @property {boolean} inRange
 * @property {TargetAction[]} actions
 */

/**
 * Build the card for one enemy.
 *
 * @param {Object} input
 * @param {any} input.actor Whoever is acting.
 * @param {any} input.target
 * @param {number} input.distanceFeet
 * @param {number} input.rangeFeet
 * @param {number} [input.cover]
 * @param {boolean} [input.hasAction] Whether the action of the turn is still unspent.
 * @param {boolean} [input.canUltimate] Whether the rank-10 blow is available.
 * @returns {TargetCard}
 */
export function buildTargetCard({
    actor, target, distanceFeet, rangeFeet, cover = 0, hasAction = true, canUltimate = false,
}) {
    const alive = (Number(target?.currentHp) || 0) > 0;
    const inRange = Number(distanceFeet) <= Number(rangeFeet);

    /**
     * @param {string} id
     * @param {string} label
     * @param {boolean} extra Whatever else this action needs.
     * @param {string} extraReason
     * @returns {TargetAction}
     */
    const action = (id, label, extra, extraReason) => {
        // The order of the reasons is the order somebody would notice them.
        const reason = !alive ? 'Ya está fuera de combate'
            : !inRange ? `Fuera de alcance: ${distanceFeet} ft de ${rangeFeet} ft`
                : !hasAction ? 'La acción de este turno ya está gastada'
                    : !extra ? extraReason : '';
        return { id, label, enabled: reason === '', reason };
    };

    return {
        name: String(target?.name ?? ''),
        hp: Math.max(0, Number(target?.currentHp) || 0),
        maxHp: Math.max(0, Number(target?.maxHp) || 0),
        armorClass: Number(target?.armorClass) || 10,
        cover: Math.max(0, Number(cover) || 0),
        distanceFeet: Number(distanceFeet) || 0,
        inRange,
        actions: [
            action('attack', 'Atacar', true, ''),
            action('ultimate', 'Golpe definitivo', canUltimate,
                'Pide un vínculo de rango 10 y no haberlo usado hoy'),
        ],
    };
}

/**
 * The line under the name: armour, cover and distance, in the words the log uses.
 *
 * @param {TargetCard} card
 * @returns {string}
 */
export function describeTargetCard(card) {
    const cover = card.cover > 0 ? ` (+${card.cover} por cobertura)` : '';
    return `PG ${card.hp}/${card.maxHp} · CA ${card.armorClass + card.cover}${cover} · ${card.distanceFeet} ft`;
}
