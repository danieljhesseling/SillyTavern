/**
 * Combat turn machine: initiative, rounds and the action economy.
 *
 * Extracted from the version living inside party.js, with two differences that matter.
 *
 * First, it is pure. State goes in, new state comes out; nothing here saves, renders or
 * posts a message. That is what lets a whole encounter be replayed in a test, and it is
 * the precondition for resolving combat without asking the model anything.
 *
 * Second, rounds are counted explicitly. The old machine only tracked an index into the
 * turn order, so "survive six rounds" had nothing to count and spell durations had no
 * clock to tick against.
 *
 * Liveness is injected rather than read: the machine never looks at hit points, it asks
 * the caller whether a combatant can still act. That keeps hit points, conditions and
 * death saves out of here, where they would not belong.
 *
 * See wiki/ROADMAP.md, Fase B (B1, B3).
 */

/**
 * @typedef {Object} TurnEntry
 * @property {string} id
 * @property {string} name
 * @property {number} initiative
 * @property {boolean} isEnemy
 */

/**
 * @typedef {Object} TurnState
 * @property {string} actorId
 * @property {boolean} isEnemy
 * @property {number} movementSpentFeet
 * @property {boolean} actionUsed
 * @property {boolean} bonusActionUsed
 * @property {boolean} reactionUsed
 */

/**
 * @typedef {Object} Encounter
 * @property {boolean} active
 * @property {any[]} enemies
 * @property {TurnEntry[]} turnOrder
 * @property {number} currentTurnIndex
 * @property {number} round
 * @property {TurnState|null} turnState
 */

/** The three things a combatant may spend besides movement. */
export const ACTION_KINDS = /** @type {const} */ (['action', 'bonus', 'reaction']);

/** @returns {Encounter} */
export function createEncounter() {
    return { active: false, enemies: [], turnOrder: [], currentTurnIndex: 0, round: 0, turnState: null };
}

/**
 * Repairs an encounter read from disk.
 *
 * Accepts encounters saved before rounds existed: they resume at round 1 rather than
 * refusing to load.
 *
 * @param {any} raw
 * @returns {Encounter}
 */
export function normalizeEncounter(raw) {
    if (!raw || typeof raw !== 'object') return createEncounter();

    const turnOrder = Array.isArray(raw.turnOrder)
        ? raw.turnOrder
            .filter((/** @type {any} */ e) => e && e.id != null)
            .map((/** @type {any} */ e) => ({
                id: String(e.id),
                name: String(e.name || ''),
                initiative: Number(e.initiative) || 0,
                isEnemy: Boolean(e.isEnemy),
            }))
        : [];

    const active = Boolean(raw.active);
    const index = Number.isInteger(raw.currentTurnIndex) ? raw.currentTurnIndex : 0;

    return {
        active,
        enemies: Array.isArray(raw.enemies) ? raw.enemies : [],
        turnOrder,
        currentTurnIndex: turnOrder.length > 0 ? Math.min(Math.max(0, index), turnOrder.length - 1) : 0,
        round: Number.isInteger(raw.round) && raw.round > 0 ? raw.round : (active ? 1 : 0),
        turnState: normalizeTurnState(raw.turnState),
    };
}

/**
 * @param {any} raw
 * @returns {TurnState|null}
 */
export function normalizeTurnState(raw) {
    if (!raw || typeof raw !== 'object') return null;
    return {
        actorId: String(raw.actorId || ''),
        isEnemy: Boolean(raw.isEnemy),
        movementSpentFeet: Math.max(0, Number(raw.movementSpentFeet) || 0),
        actionUsed: Boolean(raw.actionUsed),
        bonusActionUsed: Boolean(raw.bonusActionUsed),
        reactionUsed: Boolean(raw.reactionUsed),
    };
}

/**
 * A fresh turn: full movement, all actions available.
 * @param {TurnEntry|null} entry
 * @returns {TurnState|null}
 */
export function createTurnState(entry) {
    if (!entry) return null;
    return {
        actorId: entry.id,
        isEnemy: Boolean(entry.isEnemy),
        movementSpentFeet: 0,
        actionUsed: false,
        bonusActionUsed: false,
        reactionUsed: false,
    };
}

/**
 * Orders combatants by initiative.
 *
 * Ties go to the party, which is the friendlier reading of an ambiguous rule and spares
 * the player a coin flip they cannot influence.
 *
 * @param {Array<{id: string, name: string, isEnemy: boolean, dexterity?: number}>} participants
 * @param {(dexterity: number) => number} rollInitiative
 * @returns {TurnEntry[]}
 */
export function buildTurnOrder(participants, rollInitiative) {
    const entries = (Array.isArray(participants) ? participants : []).map(p => ({
        id: String(p.id),
        name: String(p.name || ''),
        initiative: Number(rollInitiative(Number(p.dexterity) || 10)) || 0,
        isEnemy: Boolean(p.isEnemy),
    }));

    return entries.sort((a, b) => b.initiative - a.initiative || (a.isEnemy ? 1 : 0) - (b.isEnemy ? 1 : 0));
}

/**
 * Opens an encounter.
 * @param {Array<{id: string, name: string, isEnemy: boolean, dexterity?: number}>} participants
 * @param {(dexterity: number) => number} rollInitiative
 * @param {any[]} [enemies]
 * @returns {Encounter}
 */
export function startEncounter(participants, rollInitiative, enemies = []) {
    const turnOrder = buildTurnOrder(participants, rollInitiative);
    if (turnOrder.length === 0) return createEncounter();

    return {
        active: true,
        enemies: Array.isArray(enemies) ? enemies : [],
        turnOrder,
        currentTurnIndex: 0,
        round: 1,
        turnState: createTurnState(turnOrder[0]),
    };
}

/**
 * @param {Encounter} encounter
 * @returns {TurnEntry|null}
 */
export function getCurrentEntry(encounter) {
    if (!encounter?.active) return null;
    return encounter.turnOrder?.[encounter.currentTurnIndex] || null;
}

/**
 * Moves to the next combatant that can still act, counting a new round each time the
 * order wraps. Returns the encounter unchanged when nobody left can act.
 *
 * @param {Encounter} encounter
 * @param {(entry: TurnEntry) => boolean} isAlive
 * @returns {Encounter}
 */
export function advanceTurn(encounter, isAlive) {
    if (!encounter?.active || !encounter.turnOrder?.length) return encounter;

    const total = encounter.turnOrder.length;
    let index = encounter.currentTurnIndex;
    let round = encounter.round;

    for (let step = 0; step < total; step++) {
        const next = (index + 1) % total;
        if (next <= index) round += 1; // the order wrapped
        index = next;

        const candidate = encounter.turnOrder[index];
        if (candidate && isAlive(candidate)) {
            return { ...encounter, currentTurnIndex: index, round, turnState: createTurnState(candidate) };
        }
    }

    return encounter;
}

/**
 * Movement left for the current actor, in feet.
 * @param {Encounter} encounter
 * @param {number} speedFeet
 * @returns {number}
 */
export function getRemainingMovement(encounter, speedFeet) {
    const speed = Math.max(0, Number(speedFeet) || 0);
    const spent = Math.max(0, Number(encounter?.turnState?.movementSpentFeet) || 0);
    return Math.max(0, speed - spent);
}

/**
 * Spends movement. Never spends more than remains.
 * @param {Encounter} encounter
 * @param {number} feet
 * @param {number} speedFeet
 * @returns {Encounter}
 */
export function spendMovement(encounter, feet, speedFeet) {
    if (!encounter?.turnState) return encounter;
    const remaining = getRemainingMovement(encounter, speedFeet);
    const spend = Math.min(Math.max(0, Number(feet) || 0), remaining);
    return {
        ...encounter,
        turnState: { ...encounter.turnState, movementSpentFeet: encounter.turnState.movementSpentFeet + spend },
    };
}

/**
 * @param {Encounter} encounter
 * @param {'action'|'bonus'|'reaction'} kind
 * @returns {boolean}
 */
export function hasAction(encounter, kind) {
    const state = encounter?.turnState;
    if (!state) return false;
    if (kind === 'action') return !state.actionUsed;
    if (kind === 'bonus') return !state.bonusActionUsed;
    if (kind === 'reaction') return !state.reactionUsed;
    return false;
}

/**
 * Spends an action. Spending one that is already gone leaves the encounter untouched, so
 * callers can check with hasAction and act, or just act and compare.
 *
 * @param {Encounter} encounter
 * @param {'action'|'bonus'|'reaction'} kind
 * @returns {Encounter}
 */
export function useAction(encounter, kind) {
    if (!hasAction(encounter, kind)) return encounter;
    const field = kind === 'action' ? 'actionUsed' : kind === 'bonus' ? 'bonusActionUsed' : 'reactionUsed';
    return { ...encounter, turnState: { ...encounter.turnState, [field]: true } };
}

/**
 * Whether the current actor has anything left to do.
 * @param {Encounter} encounter
 * @param {number} speedFeet
 * @returns {boolean}
 */
export function isTurnSpent(encounter, speedFeet) {
    const state = encounter?.turnState;
    if (!state) return true;
    return state.actionUsed && state.bonusActionUsed && getRemainingMovement(encounter, speedFeet) <= 0;
}

/**
 * Closes the encounter, keeping the enemy list for the after-action summary.
 * @param {Encounter} encounter
 * @returns {Encounter}
 */
export function endEncounter(encounter) {
    return { ...createEncounter(), enemies: encounter?.enemies ?? [] };
}

/**
 * Removes a combatant from the order, keeping the current actor pointing at the same
 * combatant. Used when something is removed mid-fight rather than merely downed.
 *
 * @param {Encounter} encounter
 * @param {string} id
 * @returns {Encounter}
 */
export function removeFromTurnOrder(encounter, id) {
    if (!encounter?.turnOrder?.length) return encounter;

    const target = String(id);
    const removedIndex = encounter.turnOrder.findIndex(e => e.id === target);
    if (removedIndex === -1) return encounter;

    const turnOrder = encounter.turnOrder.filter(e => e.id !== target);
    if (turnOrder.length === 0) return endEncounter(encounter);

    let index = encounter.currentTurnIndex;
    if (removedIndex < index) index -= 1;
    index = Math.min(index, turnOrder.length - 1);

    return { ...encounter, turnOrder, currentTurnIndex: index };
}
