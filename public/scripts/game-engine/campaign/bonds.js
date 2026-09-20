/**
 * Social bonds: ranks one to ten, and the combat perks they unlock.
 *
 * The design document proposed raising ranks with analyzeRelationshipsFromChat — a
 * heuristic over whatever the model wrote. That is the exact coupling the same document
 * condemns for combat, just moved somewhere less obvious: the model would be deciding,
 * indirectly and unreproducibly, when the player unlocks Baton Pass.
 *
 * So bonds move on *recorded events*. Completing a quest together, giving a gift, choosing
 * an option in a confidant scene — things the engine did and can point at. The chat
 * analyser can still suggest ("that conversation went well, +1?"), but it never decides.
 *
 * Pure module.
 *
 * See wiki/ROADMAP.md, Fase D (D2, D3, D4).
 */

export const BONDS_SCHEMA_VERSION = 1;

export const MAX_RANK = 10;

/**
 * Points needed to reach each rank. Rising costs, so the last ranks are earned rather than
 * accumulated by turning up.
 */
export const RANK_THRESHOLDS = [0, 0, 6, 14, 24, 36, 50, 66, 84, 104, 126];

/**
 * What the engine is willing to pay for. Every entry is something it can verify happened;
 * none of them is "the model said something nice".
 */
export const BOND_EVENTS = {
    quest_together: { points: 5, label: 'Misión completada juntos' },
    combat_together: { points: 2, label: 'Combate superado juntos' },
    gift_liked: { points: 4, label: 'Regalo acertado' },
    gift_disliked: { points: -2, label: 'Regalo desafortunado' },
    confidant_scene: { points: 3, label: 'Escena de confidente' },
    shared_downtime: { points: 2, label: 'Tiempo libre compartido' },
    saved_their_life: { points: 6, label: 'Le salvaste la vida' },
    let_them_fall: { points: -5, label: 'Le dejaste caer' },
    betrayed: { points: -12, label: 'Traición' },
    manual: { points: 1, label: 'Ajuste manual' },
};

/**
 * Mechanical rewards. Each one is a combat effect, which is why this file exists at all:
 * a bond that does not change how a fight goes is just a number on a screen.
 */
export const BOND_PERKS = [
    {
        rank: 3,
        id: 'follow_up',
        label: 'Ataque de seguimiento',
        description: 'Cuando el líder asesta un crítico, este compañero tiene un 50% de realizar un ataque gratuito.',
    },
    {
        rank: 5,
        id: 'baton_pass',
        label: 'Relevo',
        description: 'Tras derrotar a un enemigo, puede ceder su movimiento restante a otro compañero.',
    },
    {
        rank: 8,
        id: 'endure',
        label: 'Aguantar',
        description: 'Si el líder fuese a caer a 0 HP, se interpone y le deja a 1 HP. Una vez por día.',
    },
    {
        rank: 10,
        id: 'ultimate',
        label: 'Vínculo máximo',
        description: 'Desbloquea su habilidad definitiva y su arma personal.',
    },
];

/**
 * @typedef {Object} Bond
 * @property {string} characterId
 * @property {number} points
 * @property {string[]} usedOncePerDay  Perk ids already spent today.
 */

/**
 * @typedef {Object} BondState
 * @property {number} version
 * @property {Record<string, Bond>} bonds
 */

/** @returns {BondState} */
export function createBondState() {
    return { version: BONDS_SCHEMA_VERSION, bonds: {} };
}

/**
 * @param {any} raw
 * @returns {BondState}
 */
export function normalizeBondState(raw) {
    if (!raw || typeof raw !== 'object') return createBondState();

    const source = raw.bonds && typeof raw.bonds === 'object' ? raw.bonds : {};
    /** @type {Record<string, Bond>} */
    const bonds = {};

    for (const [id, value] of Object.entries(source)) {
        if (!id || !value || typeof value !== 'object') continue;
        bonds[id] = {
            characterId: id,
            points: Math.max(0, Number(value.points) || 0),
            usedOncePerDay: Array.isArray(value.usedOncePerDay)
                ? value.usedOncePerDay.filter(p => typeof p === 'string')
                : [],
        };
    }

    return { version: BONDS_SCHEMA_VERSION, bonds };
}

/**
 * The rank a given number of points buys.
 * @param {number} points
 * @returns {number} 1..MAX_RANK
 */
export function getRankForPoints(points) {
    const value = Math.max(0, Number(points) || 0);
    let rank = 1;
    for (let r = 2; r <= MAX_RANK; r++) {
        if (value >= RANK_THRESHOLDS[r]) rank = r;
    }
    return rank;
}

/**
 * @param {BondState} state
 * @param {string} characterId
 * @returns {number}
 */
export function getRank(state, characterId) {
    const bond = normalizeBondState(state).bonds[characterId];
    return getRankForPoints(bond?.points ?? 0);
}

/**
 * Progress towards the next rank, for a bar in the UI.
 * @param {BondState} state
 * @param {string} characterId
 * @returns {{rank: number, points: number, nextAt: number|null, progress: number}}
 */
export function getBondProgress(state, characterId) {
    const points = normalizeBondState(state).bonds[characterId]?.points ?? 0;
    const rank = getRankForPoints(points);

    if (rank >= MAX_RANK) {
        return { rank, points, nextAt: null, progress: 1 };
    }

    const floor = RANK_THRESHOLDS[rank];
    const nextAt = RANK_THRESHOLDS[rank + 1];
    const span = nextAt - floor;

    return {
        rank,
        points,
        nextAt,
        progress: span <= 0 ? 1 : Math.min(1, (points - floor) / span),
    };
}

/**
 * Records an event and returns the new state plus what it changed.
 *
 * The caller gets `rankedUp` and the perks that just became available, because that is the
 * moment to show a scene — and the scene is written by the model, from an event the engine
 * already decided happened.
 *
 * @param {BondState} state
 * @param {string} characterId
 * @param {string} eventType
 * @param {{points?: number}} [options] Override for 'manual'.
 * @returns {{state: BondState, rankBefore: number, rankAfter: number, rankedUp: boolean, unlockedPerks: typeof BOND_PERKS}}
 */
export function recordBondEvent(state, characterId, eventType, options = {}) {
    const current = normalizeBondState(state);
    const id = String(characterId || '').trim();

    const definition = BOND_EVENTS[eventType];
    if (!id || !definition) {
        return { state: current, rankBefore: 1, rankAfter: 1, rankedUp: false, unlockedPerks: [] };
    }

    const delta = eventType === 'manual' && Number.isFinite(Number(options.points))
        ? Number(options.points)
        : definition.points;

    const before = current.bonds[id] ?? { characterId: id, points: 0, usedOncePerDay: [] };
    const rankBefore = getRankForPoints(before.points);
    const points = Math.max(0, before.points + delta);
    const rankAfter = getRankForPoints(points);

    const unlockedPerks = BOND_PERKS.filter(p => p.rank > rankBefore && p.rank <= rankAfter);

    return {
        state: {
            version: BONDS_SCHEMA_VERSION,
            bonds: { ...current.bonds, [id]: { ...before, points } },
        },
        rankBefore,
        rankAfter,
        rankedUp: rankAfter > rankBefore,
        unlockedPerks,
    };
}

/**
 * Every perk a character has earned.
 * @param {BondState} state
 * @param {string} characterId
 * @returns {typeof BOND_PERKS}
 */
export function getUnlockedPerks(state, characterId) {
    const rank = getRank(state, characterId);
    return BOND_PERKS.filter(p => p.rank <= rank);
}

/**
 * Whether a perk is both earned and still available today.
 * @param {BondState} state
 * @param {string} characterId
 * @param {string} perkId
 * @returns {boolean}
 */
export function isPerkAvailable(state, characterId, perkId) {
    const current = normalizeBondState(state);
    const bond = current.bonds[characterId];
    const perk = BOND_PERKS.find(p => p.id === perkId);
    if (!perk) return false;
    if (getRankForPoints(bond?.points ?? 0) < perk.rank) return false;
    return !(bond?.usedOncePerDay ?? []).includes(perkId);
}

/**
 * Marks a once-per-day perk as spent.
 * @param {BondState} state
 * @param {string} characterId
 * @param {string} perkId
 * @returns {BondState}
 */
export function spendPerk(state, characterId, perkId) {
    const current = normalizeBondState(state);
    const bond = current.bonds[characterId];
    if (!bond || bond.usedOncePerDay.includes(perkId)) return current;

    return {
        version: BONDS_SCHEMA_VERSION,
        bonds: {
            ...current.bonds,
            [characterId]: { ...bond, usedOncePerDay: [...bond.usedOncePerDay, perkId] },
        },
    };
}

/**
 * Clears the once-per-day marks. Called when the calendar rolls the day over.
 * @param {BondState} state
 * @returns {BondState}
 */
export function resetDailyPerks(state) {
    const current = normalizeBondState(state);
    /** @type {Record<string, Bond>} */
    const bonds = {};
    for (const [id, bond] of Object.entries(current.bonds)) {
        bonds[id] = { ...bond, usedOncePerDay: [] };
    }
    return { version: BONDS_SCHEMA_VERSION, bonds };
}

/**
 * A suggestion the chat analyser may raise. Explicitly *not* applied: it is offered to the
 * player, who decides. This is the seam where the heuristic is allowed to live.
 *
 * @param {string} characterId
 * @param {number} affinityDelta  Whatever the analyser measured.
 * @returns {{characterId: string, eventType: string, points: number, reason: string}|null}
 */
export function suggestBondEvent(characterId, affinityDelta) {
    const delta = Number(affinityDelta) || 0;
    if (Math.abs(delta) < 10) return null;

    return {
        characterId,
        eventType: 'manual',
        points: delta > 0 ? 1 : -1,
        reason: delta > 0
            ? 'La conversación reforzó el vínculo. ¿Confirmas +1?'
            : 'La conversación tensó el vínculo. ¿Confirmas -1?',
    };
}
