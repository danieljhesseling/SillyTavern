/**
 * What the campaign panel shows: the day, and where every bond stands.
 *
 * The calendar and the bonds have been the best-tested logic in the project and the only
 * part nobody could reach: 62 tests, no way in. This turns both into one view model, so
 * the panel above it draws and decides nothing — including which perks are earned, which
 * are still ahead, and which have already been spent today.
 *
 * Pure. See wiki/ROADMAP.md, Fase D (D6).
 */

import { getCurrentSlot, getRemainingSlots } from './calendar.js';
import {
    BOND_PERKS, BOND_EVENTS, MAX_RANK, getBondProgress, getUnlockedPerks,
} from './bonds.js';

/**
 * @typedef {Object} PerkView
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {number} rank
 * @property {boolean} unlocked
 * @property {boolean} spentToday  Only meaningful for once-a-day perks.
 */

/**
 * @typedef {Object} BondView
 * @property {string} id
 * @property {string} name
 * @property {string} avatar
 * @property {number} rank
 * @property {number} points
 * @property {number|null} nextAt
 * @property {number} progress    0..1 towards the next rank.
 * @property {boolean} maxed
 * @property {PerkView[]} perks
 */

/**
 * Builds everything the campaign panel needs.
 *
 * @param {Object} input
 * @param {any} input.calendar
 * @param {any} input.bonds
 * @param {Array<{id: any, name: string, avatar?: string}>} input.party
 * @returns {{day: number, slotLabel: string, slotId: string, remainingSlots: number, slots: Array<{id: string, label: string, current: boolean}>, characters: BondView[]}}
 */
export function buildCampaignView({ calendar, bonds, party = [] }) {
    const slot = getCurrentSlot(calendar);
    const slots = (calendar?.slots ?? []).map((/** @type {any} */ s) => ({
        id: String(s?.id ?? ''),
        label: String(s?.label ?? ''),
        current: String(s?.id ?? '') === slot.id,
    }));

    const characters = (Array.isArray(party) ? party : []).map(member => {
        const id = String(member?.id ?? '');
        const { rank, points, nextAt, progress } = getBondProgress(bonds, id);
        const earned = new Set(getUnlockedPerks(bonds, id).map(p => p.id));
        const spent = new Set(bonds?.bonds?.[id]?.usedOncePerDay ?? []);

        return {
            id,
            name: String(member?.name ?? ''),
            avatar: String(member?.avatar ?? ''),
            rank,
            points,
            nextAt,
            progress,
            maxed: rank >= MAX_RANK,
            // Every perk, not only the earned ones: seeing what rank 8 unlocks is the
            // reason to keep spending evenings with somebody.
            perks: BOND_PERKS.map(perk => ({
                id: perk.id,
                label: perk.label,
                description: perk.description,
                rank: perk.rank,
                unlocked: earned.has(perk.id),
                spentToday: spent.has(perk.id),
            })),
        };
    });

    return {
        day: Number(calendar?.day) || 1,
        slotLabel: slot.label,
        slotId: slot.id,
        remainingSlots: getRemainingSlots(calendar),
        slots,
        characters,
    };
}

/**
 * The bond events a player can record by hand, as buttons.
 *
 * Only the ones a person would choose deliberately. The engine records the rest — a
 * combat survived together, a quest finished — and `manual` is an adjustment, not an
 * event, so neither belongs on a button.
 *
 * @returns {Array<{type: string, label: string, points: number}>}
 */
export function getRecordableEvents() {
    const hidden = new Set(['manual', 'combat_together', 'quest_together']);
    return Object.entries(BOND_EVENTS)
        .filter(([type]) => !hidden.has(type))
        .map(([type, def]) => ({ type, label: def.label, points: def.points }))
        .sort((a, b) => b.points - a.points);
}
