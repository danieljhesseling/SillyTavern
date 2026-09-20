/**
 * Tactical enemy AI.
 *
 * Deterministic on purpose. A monster that follows legible rules is cheaper than one
 * driven by a language model, and it also makes a better game: in a tactical fight the
 * player is supposed to be able to predict what the enemy will do and plan against it.
 * Gloomhaven is built on exactly that.
 *
 * Every function here returns a *plan* rather than performing anything. The caller applies
 * it. That is what lets the whole AI be tested exhaustively, which is the only reason to
 * trust an opponent nobody is supervising.
 *
 * Two things it fixes from the version inside party.js: movement went in a straight line
 * via Math.sign and walked through walls, and the attack range was hard-coded to five feet
 * no matter what the creature was holding.
 *
 * See wiki/ROADMAP.md, Fase B (B2).
 */

import { cellKey } from '../board/terrain.js';
import { findPath, getReachableCells, getPathCost } from '../board/pathfinding.js';

/** Fraction of maximum hit points below which a coward runs. */
export const FLEE_HP_FRACTION = 0.25;

/** Assumed when a creature declares no speed. */
export const DEFAULT_SPEED_FEET = 30;

/** Assumed when a creature declares no reach. */
export const DEFAULT_ATTACK_RANGE_FEET = 5;

/**
 * @typedef {'aggressive'|'skirmisher'|'guardian'|'coward'} TacticalProfile
 */

/** @type {Record<string, {label: string, description: string}>} */
export const TACTICAL_PROFILES = {
    aggressive: {
        label: 'Aggressive',
        description: 'Closes on the nearest target by the shortest route and attacks.',
    },
    skirmisher: {
        label: 'Skirmisher',
        description: 'Keeps its distance. Backs away from anything in melee, then shoots.',
    },
    guardian: {
        label: 'Guardian',
        description: 'Puts itself between the threat and its most wounded ally.',
    },
    coward: {
        label: 'Coward',
        description: 'Fights while healthy; runs once badly hurt.',
    },
};

export const DEFAULT_PROFILE = 'aggressive';

/**
 * @typedef {Object} Combatant
 * @property {string} id
 * @property {number} gridX
 * @property {number} gridY
 * @property {number} [currentHp]
 * @property {number} [maxHp]
 * @property {number} [speedFeet]
 * @property {number} [attackRangeFeet]
 * @property {TacticalProfile} [profile]
 */

/**
 * @typedef {Object} TurnPlan
 * @property {string|null} focusId        Whom it decided to go after.
 * @property {Array<{x: number, y: number}>} path   Including the starting cell.
 * @property {{x: number, y: number}} destination
 * @property {number} movementCostFeet
 * @property {'attack'|'none'} action
 * @property {string|null} targetId
 * @property {string} rationale           One line for the combat log.
 */

/** @param {number} cells */
const cellsToFeet = (cells) => cells * 5;

/** @param {number} feet */
const feetToCells = (feet) => Math.max(0, Math.floor((Number(feet) || 0) / 5));

/** @param {Combatant} c */
const speedOf = (c) => (Number.isFinite(Number(c?.speedFeet)) ? Number(c.speedFeet) : DEFAULT_SPEED_FEET);

/** @param {Combatant} c */
const rangeOf = (c) => (Number.isFinite(Number(c?.attackRangeFeet)) ? Number(c.attackRangeFeet) : DEFAULT_ATTACK_RANGE_FEET);

/** @param {number} ax @param {number} ay @param {number} bx @param {number} by */
function chebyshevFeet(ax, ay, bx, by) {
    return Math.max(Math.abs(ax - bx), Math.abs(ay - by)) * 5;
}

/**
 * Final tie-break between cells that are tactically identical.
 *
 * Without it the winner depends on the order the flood fill happened to visit cells, which
 * is stable within a build but not something anyone can reason about. A fixed top-left
 * preference costs nothing and means the same situation always produces the same move —
 * which is the whole promise of a deterministic opponent.
 *
 * @param {{gridX: number, gridY: number}} a
 * @param {{gridX: number, gridY: number}} b
 */
function compareCells(a, b) {
    return a.gridY - b.gridY || a.gridX - b.gridX;
}

/**
 * @param {Combatant} c
 * @returns {number} 0..1
 */
export function healthFraction(c) {
    const max = Number(c?.maxHp) || 0;
    if (max <= 0) return 1;
    return Math.max(0, Math.min(1, (Number(c?.currentHp) || 0) / max));
}

/**
 * Cells a creature may not enter because somebody else is standing there.
 * @param {Combatant[]} combatants
 * @param {string} [exceptId]
 * @returns {Set<string>}
 */
export function buildOccupiedSet(combatants, exceptId) {
    const occupied = new Set();
    for (const c of combatants || []) {
        if (!c || c.id === exceptId) continue;
        occupied.add(cellKey(c.gridX, c.gridY));
    }
    return occupied;
}

/**
 * Picks whom to go after: the one that can actually be reached soonest, breaking ties on
 * the lowest hit points. Path distance rather than straight-line distance, so a target
 * behind a wall stops looking closer than it is.
 *
 * @param {Combatant} actor
 * @param {Combatant[]} targets
 * @param {import('../board/terrain.js').BoardTerrain} terrain
 * @param {number} gridWidth @param {number} gridHeight
 * @param {Set<string>} occupied
 * @returns {{ target: Combatant, distanceFeet: number, reachable: boolean } | null}
 */
export function selectFocus(actor, targets, terrain, gridWidth, gridHeight, occupied) {
    const candidates = (targets || []).filter(t => t && (Number(t.currentHp) || 0) > 0);
    if (candidates.length === 0) return null;

    const scored = candidates.map(target => {
        // The target's own cell is occupied by the target, so path next to it instead.
        const withoutTarget = new Set(occupied);
        withoutTarget.delete(cellKey(target.gridX, target.gridY));

        const path = findPath(
            terrain, actor.gridX, actor.gridY, target.gridX, target.gridY,
            gridWidth, gridHeight, { occupied: withoutTarget },
        );

        return {
            target,
            reachable: path !== null,
            distanceFeet: path
                ? cellsToFeet(getPathCost(terrain, path))
                : chebyshevFeet(actor.gridX, actor.gridY, target.gridX, target.gridY),
        };
    });

    // Reachable targets always beat unreachable ones, then nearest, then most wounded.
    scored.sort((a, b) =>
        (a.reachable === b.reachable ? 0 : a.reachable ? -1 : 1)
        || a.distanceFeet - b.distanceFeet
        || healthFraction(a.target) - healthFraction(b.target));

    return scored[0];
}

/**
 * The reachable cell that gets the actor within attack range of the target, as cheaply as
 * possible. Returns null when no such cell is reachable this turn.
 *
 * @param {Combatant} actor
 * @param {Combatant} target
 * @param {number} attackRangeFeet
 * @param {import('../board/terrain.js').BoardTerrain} terrain
 * @param {number} gridWidth @param {number} gridHeight
 * @param {Set<string>} occupied
 * @returns {{ x: number, y: number, cost: number } | null}
 */
function findApproachCell(actor, target, attackRangeFeet, terrain, gridWidth, gridHeight, occupied) {
    const reachable = getReachableCells(
        terrain, actor.gridX, actor.gridY, speedOf(actor), gridWidth, gridHeight, { occupied },
    );

    const inRange = reachable
        .filter(cell => chebyshevFeet(cell.gridX, cell.gridY, target.gridX, target.gridY) <= attackRangeFeet)
        .sort((a, b) => a.cost - b.cost
            || chebyshevFeet(a.gridX, a.gridY, target.gridX, target.gridY)
             - chebyshevFeet(b.gridX, b.gridY, target.gridX, target.gridY)
            || compareCells(a, b));

    if (inRange.length === 0) return null;
    return { x: inRange[0].gridX, y: inRange[0].gridY, cost: inRange[0].cost };
}

/**
 * The reachable cell that gets furthest from every threat. Used by fleeing and by
 * skirmishers backing out of melee.
 *
 * @param {Combatant} actor
 * @param {Combatant[]} threats
 * @param {import('../board/terrain.js').BoardTerrain} terrain
 * @param {number} gridWidth @param {number} gridHeight
 * @param {Set<string>} occupied
 * @param {number} [minDistanceFeet] Stop looking once this far away; 0 means as far as possible.
 * @returns {{ x: number, y: number, cost: number } | null}
 */
function findRetreatCell(actor, threats, terrain, gridWidth, gridHeight, occupied, minDistanceFeet = 0) {
    const reachable = getReachableCells(
        terrain, actor.gridX, actor.gridY, speedOf(actor), gridWidth, gridHeight, { occupied },
    );
    if (reachable.length === 0) return null;

    /** @param {number} x @param {number} y */
    const nearestThreatFeet = (x, y) => threats.reduce(
        (min, t) => Math.min(min, chebyshevFeet(x, y, t.gridX, t.gridY)),
        Infinity,
    );

    const scored = reachable
        .map(cell => ({ cell, safety: nearestThreatFeet(cell.gridX, cell.gridY) }))
        .filter(entry => minDistanceFeet <= 0 || entry.safety >= minDistanceFeet)
        // Furthest from danger, and among equals the one that spent least getting there.
        .sort((a, b) => b.safety - a.safety || a.cell.cost - b.cell.cost || compareCells(a.cell, b.cell));

    if (scored.length === 0) return null;
    const best = scored[0];
    return { x: best.cell.gridX, y: best.cell.gridY, cost: best.cell.cost };
}

/**
 * Builds the path the actor actually walks to a chosen destination.
 * @returns {Array<{x: number, y: number}>}
 */
function pathTo(actor, destination, terrain, gridWidth, gridHeight, occupied) {
    if (destination.x === actor.gridX && destination.y === actor.gridY) {
        return [{ x: actor.gridX, y: actor.gridY }];
    }
    return findPath(
        terrain, actor.gridX, actor.gridY, destination.x, destination.y,
        gridWidth, gridHeight, { occupied },
    ) || [{ x: actor.gridX, y: actor.gridY }];
}

/**
 * Only the position is needed, so the parameter is typed to that: it is also called with
 * a bare origin when there is no actor at all.
 * @param {{gridX: number, gridY: number}} actor
 * @param {string} rationale
 * @param {string|null} [focusId]
 * @returns {TurnPlan}
 */
function standStill(actor, rationale, focusId = null) {
    return {
        focusId,
        path: [{ x: actor.gridX, y: actor.gridY }],
        destination: { x: actor.gridX, y: actor.gridY },
        movementCostFeet: 0,
        action: 'none',
        targetId: null,
        rationale,
    };
}

/**
 * Decides what an enemy does on its turn.
 *
 * @param {Object} input
 * @param {Combatant} input.actor
 * @param {Combatant[]} input.targets      The party.
 * @param {Combatant[]} [input.allies]     The actor's own side, for the guardian profile.
 * @param {import('../board/terrain.js').BoardTerrain} input.terrain
 * @param {number} input.gridWidth
 * @param {number} input.gridHeight
 * @returns {TurnPlan}
 */
export function planEnemyTurn({ actor, targets, allies = [], terrain, gridWidth, gridHeight }) {
    if (!actor) return standStill({ gridX: 0, gridY: 0 }, 'No actor.');

    const profile = TACTICAL_PROFILES[actor.profile] ? actor.profile : DEFAULT_PROFILE;
    const occupied = buildOccupiedSet([...(targets || []), ...(allies || [])], actor.id);
    const living = (targets || []).filter(t => t && (Number(t.currentHp) || 0) > 0);

    if (living.length === 0) {
        return standStill(actor, 'Nothing left to fight.');
    }

    // A coward that is badly hurt stops caring about everything else.
    if (profile === 'coward' && healthFraction(actor) < FLEE_HP_FRACTION) {
        const retreat = findRetreatCell(actor, living, terrain, gridWidth, gridHeight, occupied);
        if (!retreat || (retreat.x === actor.gridX && retreat.y === actor.gridY)) {
            return standStill(actor, 'Cornered, and too hurt to fight well.');
        }
        return {
            focusId: null,
            path: pathTo(actor, retreat, terrain, gridWidth, gridHeight, occupied),
            destination: { x: retreat.x, y: retreat.y },
            movementCostFeet: cellsToFeet(retreat.cost),
            action: 'none',
            targetId: null,
            rationale: 'Badly wounded, breaking away.',
        };
    }

    const focus = selectFocus(actor, living, terrain, gridWidth, gridHeight, occupied);
    if (!focus) return standStill(actor, 'No reachable target.');

    const target = focus.target;
    const range = rangeOf(actor);

    // A skirmisher caught in melee gives ground before shooting.
    if (profile === 'skirmisher' && range > 5) {
        const threatsInMelee = living.filter(
            t => chebyshevFeet(actor.gridX, actor.gridY, t.gridX, t.gridY) <= 5,
        );
        if (threatsInMelee.length > 0) {
            const retreat = findRetreatCell(actor, threatsInMelee, terrain, gridWidth, gridHeight, occupied, 10);
            if (retreat) {
                const stillInRange = chebyshevFeet(retreat.x, retreat.y, target.gridX, target.gridY) <= range;
                return {
                    focusId: target.id,
                    path: pathTo(actor, retreat, terrain, gridWidth, gridHeight, occupied),
                    destination: { x: retreat.x, y: retreat.y },
                    movementCostFeet: cellsToFeet(retreat.cost),
                    action: stillInRange ? 'attack' : 'none',
                    targetId: stillInRange ? target.id : null,
                    rationale: stillInRange
                        ? 'Backs out of melee and shoots.'
                        : 'Backs out of melee, losing the shot.',
                };
            }
        }
    }

    // A guardian tries to stand between the threat and whoever on its side is worst off.
    if (profile === 'guardian') {
        const wounded = (allies || [])
            .filter(a => a && a.id !== actor.id && (Number(a.currentHp) || 0) > 0)
            .sort((a, b) => healthFraction(a) - healthFraction(b))[0];

        if (wounded) {
            const midX = Math.round((wounded.gridX + target.gridX) / 2);
            const midY = Math.round((wounded.gridY + target.gridY) / 2);
            const reachable = getReachableCells(
                terrain, actor.gridX, actor.gridY, speedOf(actor), gridWidth, gridHeight, { occupied },
            );
            const interpose = reachable
                .map(cell => ({
                    cell,
                    offset: chebyshevFeet(cell.gridX, cell.gridY, midX, midY),
                }))
                .sort((a, b) => a.offset - b.offset || a.cell.cost - b.cell.cost || compareCells(a.cell, b.cell))[0];

            if (interpose) {
                const destination = { x: interpose.cell.gridX, y: interpose.cell.gridY };
                const inRange = chebyshevFeet(destination.x, destination.y, target.gridX, target.gridY) <= range;
                return {
                    focusId: target.id,
                    path: pathTo(actor, destination, terrain, gridWidth, gridHeight, occupied),
                    destination,
                    movementCostFeet: cellsToFeet(interpose.cell.cost),
                    action: inRange ? 'attack' : 'none',
                    targetId: inRange ? target.id : null,
                    rationale: inRange
                        ? 'Shields its ally and strikes.'
                        : 'Moves to shield its ally.',
                };
            }
        }
    }

    // Everything else, and every profile that found nothing special to do: close and hit.
    const alreadyInRange = chebyshevFeet(actor.gridX, actor.gridY, target.gridX, target.gridY) <= range;
    if (alreadyInRange) {
        return {
            focusId: target.id,
            path: [{ x: actor.gridX, y: actor.gridY }],
            destination: { x: actor.gridX, y: actor.gridY },
            movementCostFeet: 0,
            action: 'attack',
            targetId: target.id,
            rationale: 'Already in reach, attacks.',
        };
    }

    const approach = findApproachCell(actor, target, range, terrain, gridWidth, gridHeight, occupied);
    if (approach) {
        return {
            focusId: target.id,
            path: pathTo(actor, approach, terrain, gridWidth, gridHeight, occupied),
            destination: { x: approach.x, y: approach.y },
            movementCostFeet: cellsToFeet(approach.cost),
            action: 'attack',
            targetId: target.id,
            rationale: 'Closes the distance and attacks.',
        };
    }

    // Cannot reach it this turn: get as close as the legs allow.
    const reachable = getReachableCells(
        terrain, actor.gridX, actor.gridY, speedOf(actor), gridWidth, gridHeight, { occupied },
    );
    const closest = reachable
        .map(cell => ({
            cell,
            distance: chebyshevFeet(cell.gridX, cell.gridY, target.gridX, target.gridY),
        }))
        .sort((a, b) => a.distance - b.distance || a.cell.cost - b.cell.cost || compareCells(a.cell, b.cell))[0];

    if (!closest || (closest.cell.gridX === actor.gridX && closest.cell.gridY === actor.gridY)) {
        return standStill(actor, 'Cannot get any closer.', target.id);
    }

    return {
        focusId: target.id,
        path: pathTo(actor, { x: closest.cell.gridX, y: closest.cell.gridY }, terrain, gridWidth, gridHeight, occupied),
        destination: { x: closest.cell.gridX, y: closest.cell.gridY },
        movementCostFeet: cellsToFeet(closest.cell.cost),
        action: 'none',
        targetId: null,
        rationale: 'Advances, but cannot reach this turn.',
    };
}

/**
 * Lists the profiles for an editor, as [value, label] pairs.
 * @returns {Array<[string, string]>}
 */
export function getProfileOptions() {
    return Object.entries(TACTICAL_PROFILES).map(([value, definition]) => [value, definition.label]);
}

export { feetToCells };
