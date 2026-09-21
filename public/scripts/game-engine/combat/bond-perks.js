/**
 * What a bond actually does in a fight.
 *
 * The design document's own argument for the Persona loop was that the bonds had to be
 * mechanical: *"a bond that does not change how a fight goes is just a number on a
 * screen"*. Until this module existed that is precisely what they were — earned, listed
 * in the panel, and inert.
 *
 * Each perk here answers one question: given the state of the fight, does it fire, and on
 * whom? Deciding is all this does; applying the damage, spending the perk and writing the
 * log line belong to the caller, which is what makes an unsupervised combat effect
 * testable at all.
 *
 * Pure: the dice and the coin flip are injected.
 *
 * See wiki/ROADMAP.md, Fase D (D3) · BOND_PERKS in campaign/bonds.js.
 */

import { isPerkAvailable } from '../campaign/bonds.js';

/** How often the rank-3 perk grants its free attack. */
export const FOLLOW_UP_CHANCE = 0.5;

/**
 * Whether a companion steps in when somebody is about to be dropped.
 *
 * The rank-8 perk, and the only one that can undo a killing blow, so it is deliberately
 * narrow: it fires once a day, only when the blow would actually reduce the target to
 * zero, and never for the companion saving themselves. A perk that triggers on every
 * scratch would make a fight unloseable rather than tense.
 *
 * @param {Object} input
 * @param {any} input.bonds
 * @param {Array<{id: any, name: string, hp?: number}>} input.party
 * @param {string} input.targetId       Who is about to be hit.
 * @param {number} input.currentHp
 * @param {number} input.damage
 * @returns {{saviourId: string, saviourName: string, perkId: string}|null}
 */
export function planEndure({ bonds, party, targetId, currentHp, damage }) {
    const hp = Number(currentHp) || 0;
    if (hp <= 0) return null;                      // already down: nothing to save
    if ((Number(damage) || 0) < hp) return null;   // survives anyway

    const candidates = (Array.isArray(party) ? party : [])
        .filter(member => String(member?.id ?? '') !== String(targetId))
        .filter(member => (Number(member?.hp) || 0) > 0)   // a fallen friend saves nobody
        .filter(member => isPerkAvailable(bonds, String(member?.id ?? ''), 'endure'));

    const saviour = candidates[0];
    if (!saviour) return null;

    return {
        saviourId: String(saviour.id),
        saviourName: String(saviour.name ?? ''),
        perkId: 'endure',
    };
}

/**
 * Whether a companion gets a free swing after the leader lands a critical hit.
 *
 * The rank-3 perk. It needs a companion who is up, who has the rank, and who could reach
 * the target anyway: a free attack from across the room would make position meaningless,
 * and position is the whole game underneath.
 *
 * @param {Object} input
 * @param {any} input.bonds
 * @param {Array<{id: any, name: string, hp?: number}>} input.party
 * @param {string} input.attackerId     Who landed the critical.
 * @param {(member: any) => boolean} input.canReach
 * @param {() => number} [input.random]
 * @returns {{actorId: string, actorName: string, perkId: string}|null}
 */
export function planFollowUp({ bonds, party, attackerId, canReach, random = Math.random }) {
    const candidates = (Array.isArray(party) ? party : [])
        .filter(member => String(member?.id ?? '') !== String(attackerId))
        .filter(member => (Number(member?.hp) || 0) > 0)
        .filter(member => isPerkAvailable(bonds, String(member?.id ?? ''), 'follow_up'))
        .filter(member => (typeof canReach === 'function' ? canReach(member) : true));

    if (candidates.length === 0) return null;
    if (random() >= FOLLOW_UP_CHANCE) return null;

    const actor = candidates[0];
    return {
        actorId: String(actor.id),
        actorName: String(actor.name ?? ''),
        perkId: 'follow_up',
    };
}

/**
 * Who may be handed the leftover movement after an enemy falls.
 *
 * The rank-5 perk. Unlike the other two this one is an offer rather than an event: the
 * player chooses whether to pass and to whom, so this only says who is eligible.
 *
 * @param {Object} input
 * @param {any} input.bonds
 * @param {Array<{id: any, name: string, hp?: number}>} input.party
 * @param {string} input.actorId        Who just made the kill.
 * @param {number} input.remainingFeet
 * @returns {Array<{id: string, name: string}>}
 */
export function planBatonPass({ bonds, party, actorId, remainingFeet }) {
    if ((Number(remainingFeet) || 0) <= 0) return [];
    if (!isPerkAvailable(bonds, String(actorId), 'baton_pass')) return [];

    return (Array.isArray(party) ? party : [])
        .filter(member => String(member?.id ?? '') !== String(actorId))
        .filter(member => (Number(member?.hp) || 0) > 0)
        .map(member => ({ id: String(member.id), name: String(member.name ?? '') }));
}
