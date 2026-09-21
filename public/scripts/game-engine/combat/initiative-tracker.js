/**
 * The initiative tracker: who is acting, who is next, and what is wrong with them.
 *
 * The board already knew all of this and showed almost none of it. A fight was a numbered
 * list of names and a wall of chat lines, so knowing whether the wounded one goes before
 * or after the ghoul meant counting down the list by hand every round. That is exactly
 * the kind of bookkeeping the engine exists to take over.
 *
 * Pure: it turns the encounter into a view model and draws nothing. The panel above it
 * has no decisions left to make, which is what keeps the ordering, the wrapping around a
 * round and the status icons testable.
 *
 * See wiki/ROADMAP.md, Fase B (B8) · PROP-081 · PROP-088 · PROP-099.
 */

/**
 * Icon and colour per D&D condition.
 *
 * Data, so a rule pack that adds a condition only has to name it here to get a marker.
 * Anything unknown still shows, with a neutral mark: a condition nobody drew is a
 * condition the player forgets they have.
 *
 * @type {Record<string, {icon: string, label: string}>}
 */
export const STATUS_ICONS = {
    blinded: { icon: 'fa-eye-slash', label: 'Cegado' },
    charmed: { icon: 'fa-heart', label: 'Encantado' },
    deafened: { icon: 'fa-ear-deaf', label: 'Ensordecido' },
    frightened: { icon: 'fa-face-scream', label: 'Asustado' },
    grappled: { icon: 'fa-hand-fist', label: 'Agarrado' },
    incapacitated: { icon: 'fa-ban', label: 'Incapacitado' },
    invisible: { icon: 'fa-ghost', label: 'Invisible' },
    paralyzed: { icon: 'fa-bolt', label: 'Paralizado' },
    petrified: { icon: 'fa-gem', label: 'Petrificado' },
    poisoned: { icon: 'fa-flask', label: 'Envenenado' },
    prone: { icon: 'fa-person-falling', label: 'Derribado' },
    restrained: { icon: 'fa-link', label: 'Apresado' },
    stunned: { icon: 'fa-star', label: 'Aturdido' },
    unconscious: { icon: 'fa-bed', label: 'Inconsciente' },
    exhaustion: { icon: 'fa-battery-quarter', label: 'Agotado' },
};

/** Shown for a condition the rule pack has but this table does not. */
const UNKNOWN_STATUS = { icon: 'fa-circle-exclamation', label: '' };

/**
 * Creature sizes and how many cells they occupy, as D&D 5e counts them.
 *
 * A token that is the same size as a goblin when it is an ogre misleads about reach,
 * about cover and about what fits through a door — all three of which the engine already
 * computes correctly underneath.
 */
export const SIZE_CELLS = {
    tiny: 1,
    small: 1,
    medium: 1,
    large: 2,
    huge: 3,
    gargantuan: 4,
};

/**
 * How many cells a creature covers, from whatever its sheet says.
 * @param {string} [size]
 * @returns {number}
 */
export function sizeToCells(size) {
    return SIZE_CELLS[String(size || '').trim().toLowerCase()] ?? 1;
}

/**
 * The markers to draw for a set of conditions.
 *
 * @param {string[]|string} conditions  A list, or the free-text field older sheets use.
 * @returns {Array<{key: string, icon: string, label: string}>}
 */
export function statusMarkers(conditions) {
    const list = Array.isArray(conditions)
        ? conditions
        // The older sheet keeps conditions as free text, comma or semicolon separated.
        : String(conditions ?? '').split(/[,;]/);

    /** @type {Array<{key: string, icon: string, label: string}>} */
    const markers = [];
    const seen = new Set();

    for (const raw of list) {
        const name = String(raw ?? '').trim();
        if (!name) continue;

        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        const known = STATUS_ICONS[key];
        markers.push({
            key,
            icon: known?.icon ?? UNKNOWN_STATUS.icon,
            // An unknown condition keeps the name it was written with.
            label: known?.label || name,
        });
    }

    return markers;
}

/**
 * @typedef {Object} TrackerEntry
 * @property {string} id
 * @property {string} name
 * @property {number} initiative
 * @property {boolean} isEnemy
 * @property {boolean} isCurrent    Acting right now.
 * @property {boolean} isNext       Acts immediately after, wrapping round the order.
 * @property {number} hp
 * @property {number} maxHp
 * @property {number} hpPct
 * @property {boolean} defeated
 * @property {boolean} bloodied     Below half, the point where tactics usually change.
 * @property {Array<{key: string, icon: string, label: string}>} statuses
 */

/**
 * Builds the tracker's view of the current encounter.
 *
 * Everything the panel needs is decided here, including who is next — which is not simply
 * the following row, because the order wraps and the fallen are skipped. Working that out
 * in the drawing code is how a tracker ends up pointing at a corpse.
 *
 * @param {Object} input
 * @param {Array<any>} input.turnOrder
 * @param {number} input.currentTurnIndex
 * @param {number} [input.round]
 * @param {Array<any>} [input.party]     Party members, for HP and conditions.
 * @param {Array<any>} [input.enemies]   Enemy instances, same.
 * @returns {{round: number, entries: TrackerEntry[], activeName: string, nextName: string}}
 */
export function buildTracker({ turnOrder, currentTurnIndex, round = 1, party = [], enemies = [] }) {
    const order = Array.isArray(turnOrder) ? turnOrder : [];
    if (order.length === 0) {
        return { round: Number(round) || 1, entries: [], activeName: '', nextName: '' };
    }

    const current = Math.max(0, Math.min(order.length - 1, Number(currentTurnIndex) || 0));

    /** Finds the combatant behind a turn entry, on either side. */
    const findActor = (/** @type {any} */ entry) => {
        const id = String(entry?.id ?? '');
        if (entry?.isEnemy) {
            return (enemies || []).find(e => String(e?.instanceId ?? '') === id) ?? null;
        }
        return (party || []).find(m => String(m?.id ?? '') === id) ?? null;
    };

    /** The next one still standing, wrapping past the end of the round. */
    const nextIndex = (() => {
        for (let step = 1; step <= order.length; step++) {
            const index = (current + step) % order.length;
            const actor = findActor(order[index]);
            const hp = Number(actor?.currentHp ?? actor?.hp ?? 1);
            if (!actor || hp > 0) return index;
        }
        return current;
    })();

    const entries = order.map((entry, index) => {
        const actor = findActor(entry);
        const hp = Number(actor?.currentHp ?? actor?.hp ?? 0);
        const maxHp = Number(actor?.maxHp ?? 0);
        const conditions = actor?.activeConditions ?? actor?.conditions ?? [];

        return {
            id: String(entry?.id ?? ''),
            name: String(entry?.name ?? ''),
            initiative: Number(entry?.initiative) || 0,
            isEnemy: Boolean(entry?.isEnemy),
            isCurrent: index === current,
            isNext: index === nextIndex && index !== current,
            hp,
            maxHp,
            hpPct: maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0,
            defeated: Boolean(actor) && hp <= 0,
            bloodied: Boolean(actor) && maxHp > 0 && hp > 0 && hp <= maxHp / 2,
            statuses: statusMarkers(conditions),
        };
    });

    return {
        round: Number(round) || 1,
        entries,
        activeName: entries[current]?.name ?? '',
        nextName: entries[nextIndex]?.name ?? '',
    };
}

/**
 * A one-line summary of the turn, for the panel header and for the combat log.
 *
 * @param {{round: number, activeName: string, nextName: string}} tracker
 * @returns {string}
 */
export function describeTurn(tracker) {
    if (!tracker?.activeName) return '';
    const next = tracker.nextName && tracker.nextName !== tracker.activeName
        ? ` · después ${tracker.nextName}`
        : '';
    return `Ronda ${tracker.round} · turno de ${tracker.activeName}${next}`;
}

/**
 * Adds or removes a condition, returning a new list.
 *
 * Toggling rather than separate add and remove because that is how a condition is used
 * at the table: it goes on, and later it comes off, and nobody wants two commands for it.
 * Matching ignores case, so the list never ends up holding both "Poisoned" and "poisoned".
 *
 * @param {string[]} conditions
 * @param {string} name
 * @returns {{conditions: string[], added: boolean}}
 */
export function toggleCondition(conditions, name) {
    const list = (Array.isArray(conditions) ? conditions : [])
        .map(c => String(c ?? '').trim())
        .filter(Boolean);
    const wanted = String(name ?? '').trim();

    if (!wanted) return { conditions: list, added: false };

    const index = list.findIndex(c => c.toLowerCase() === wanted.toLowerCase());
    if (index >= 0) {
        return { conditions: list.filter((_, i) => i !== index), added: false };
    }

    // Stored with the canonical spelling when there is one, so the sheet, the tracker and
    // the rule pack all agree on how it is written.
    const known = Object.keys(STATUS_ICONS).find(k => k === wanted.toLowerCase());
    const canonical = known
        ? wanted.charAt(0).toUpperCase() + wanted.slice(1).toLowerCase()
        : wanted;

    return { conditions: [...list, canonical], added: true };
}
