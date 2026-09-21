/**
 * The campaign's own state: the clock, the bonds, the rests and the map.
 *
 * All of this lived in `party.js`, which is how that file got past six thousand lines.
 * The engine modules underneath were always pure and tested; what accumulated was the
 * glue — the part that knows where the state is kept and who to tell when it changes.
 *
 * So the glue moves here, with its dependencies handed in rather than reached for. That
 * is the difference between a file that grows and one that can be read: everything below
 * says what it needs at the top, and nothing reaches into the application.
 *
 * See wiki/ROADMAP.md, Bateria 2 · wiki/POR_HACER.md.
 */

import {
    normalizeCalendar, advanceSlot, advanceToNextDay, formatCalendar,
} from '../game-engine/campaign/calendar.js';
import {
    normalizeBondState, recordBondEvent, resetDailyPerks, BOND_EVENTS,
} from '../game-engine/campaign/bonds.js';
import { completeLocation, normalizeCampaignMap } from '../game-engine/campaign/campaign-map.js';
import { planShortRest, planLongRest, describeRest, getHitDice } from '../game-engine/rules/rest.js';
import { buildPersonalWeapon } from '../game-engine/combat/bond-perks.js';
import { addItemToInventory, createItem } from '../dnd-system.js';
import { rollDice } from './combat-rules.js';

/** Where each piece lives in the chat's metadata. */
export const CALENDAR_KEY = 'calendar';
export const BONDS_KEY = 'bonds';
export const CAMPAIGN_MAP_KEY = 'campaignMap';

/**
 * @typedef {Object} CampaignStateDeps
 * @property {() => any} metadata The chat's metadata object.
 * @property {() => void} saveMetadata
 * @property {() => any[]} party
 * @property {() => void} saveParty
 * @property {() => void} renderParty
 * @property {() => void} renderCampaign
 * @property {(text: string) => void} narrate
 * @property {() => boolean} isFighting
 * @property {() => string} worldName
 * @property {(name: string) => Promise<any>} loadWorld
 */

/**
 * Build the campaign-state functions over a particular application.
 *
 * @param {CampaignStateDeps} deps
 */
export function createCampaignState(deps) {
    /** @returns {any} */
    function getCalendar() {
        return normalizeCalendar(deps.metadata()?.[CALENDAR_KEY]);
    }

    /** @returns {any} */
    function getBonds() {
        return normalizeBondState(deps.metadata()?.[BONDS_KEY]);
    }

    /**
     * @param {any} calendar
     * @param {any} bonds
     */
    function save(calendar, bonds) {
        const metadata = deps.metadata();
        if (!metadata) return;
        if (calendar) metadata[CALENDAR_KEY] = calendar;
        if (bonds) metadata[BONDS_KEY] = bonds;
        deps.saveMetadata();
    }

    /** The label of the block of time the campaign is in. */
    function getSlotLabel() {
        const calendar = getCalendar();
        return String(calendar.slots?.[calendar.slotIndex]?.label ?? '');
    }

    /**
     * Moves the clock on by one slot, and a whole day when the night rolls over.
     *
     * Once-a-day perks come back with the new day. Doing it here rather than in the panel
     * means it happens however the day turns over, including from a long rest.
     */
    function advanceSlotOfDay() {
        const { calendar, dayAdvanced } = advanceSlot(getCalendar());
        const bonds = dayAdvanced ? resetDailyPerks(getBonds()) : null;

        save(calendar, bonds);
        deps.narrate(dayAdvanced
            ? `🌅 [CAMPAÑA] Amanece el día ${calendar.day}.`
            : `🕐 [CAMPAÑA] ${formatCalendar(calendar)}.`);
        deps.renderCampaign();
    }

    /** Skips whatever is left of today. */
    function advanceDay() {
        const calendar = advanceToNextDay(getCalendar());
        save(calendar, resetDailyPerks(getBonds()));
        deps.narrate(`🌅 [CAMPAÑA] Amanece el día ${calendar.day}.`);
        deps.renderCampaign();
    }

    /**
     * Records something that happened between the player and a companion.
     *
     * A rank-up is announced rather than applied quietly, because it is the moment the
     * model is supposed to write a scene about — from a fact the engine already decided.
     *
     * @param {string} characterId
     * @param {string} eventType
     */
    function recordBond(characterId, eventType) {
        const member = deps.party().find(m => String(m.id) === String(characterId));
        if (!member) return;

        const result = recordBondEvent(getBonds(), String(characterId), eventType);
        save(null, result.state);

        const label = BOND_EVENTS[eventType]?.label ?? eventType;
        deps.narrate(`💞 [CAMPAÑA] ${member.name}: ${label}.`);

        if (result.rankedUp) {
            deps.narrate(`✨ [CAMPAÑA] Tu vínculo con ${member.name} sube al rango ${result.rankAfter}.`);

            for (const perk of result.unlockedPerks) {
                deps.narrate(`🎖️ [CAMPAÑA] Desbloqueado: ${perk.label} — ${perk.description}`);

                // El rango 10 no es solo un aviso: deja un arma en la ficha, una vez, y
                // se queda ahí después del combate. Un bonus invisible no sería una
                // recompensa.
                if (perk.id !== 'ultimate') continue;

                const spec = buildPersonalWeapon(member);
                member.items = member.items ?? [];
                if (member.items.some((/** @type {any} */ i) => i?.name === spec.name)) continue;

                addItemToInventory(member, createItem(/** @type {any} */ (spec)));
                deps.saveParty();
                deps.narrate(`⚔️ [CAMPAÑA] ${member.name} recibe su arma personal: ${spec.name}.`);
            }
        }

        deps.renderCampaign();
    }

    /**
     * The hit die each class of this world declares, by name.
     *
     * Classes are Lorebook entries like any other and already carry their `hitDie`.
     * Reading it from there is what stops a second table going stale.
     *
     * @returns {Promise<Record<string, string>>}
     */
    async function getHitDiceByClass() {
        /** @type {Record<string, string>} */
        const byClass = {};
        try {
            const world = deps.worldName();
            if (!world) return byClass;

            const data = await deps.loadWorld(world);
            for (const entry of Object.values(data?.entries ?? {})) {
                const dnd = /** @type {any} */ (entry)?.dndData;
                if (!dnd?.hitDie) continue;
                byClass[String(/** @type {any} */ (entry).comment || dnd.name || '').toLowerCase()] = String(dnd.hitDie);
            }
        } catch (error) {
            console.warn('[party] could not read hit dice from the world', error);
        }
        return byClass;
    }

    /**
     * Resting: the only way of spending time that gives something back.
     *
     * A short rest costs a block of the day; a long one jumps to the next and brings the
     * daily perks back, which is what sunrise already did. Without this, hit points were
     * not a resource: a fight either killed you or cost you nothing that did not heal on
     * its own.
     *
     * @param {'corto'|'largo'} kind
     * @returns {Promise<string>}
     */
    async function rest(kind) {
        if (deps.isFighting()) {
            toastr.warning('No se puede descansar en mitad de un combate.');
            return '';
        }

        const party = deps.party();
        if (party.length === 0) {
            toastr.warning('No hay grupo que descanse.');
            return '';
        }

        const hitDieByClass = await getHitDiceByClass();

        const plan = kind === 'corto'
            ? planShortRest({
                party,
                hitDieByClass,
                // El dado que le toca a cada uno, con la misma función de tirada que
                // todo lo demás, para que el registro lo explique igual.
                rollDie: (faces) => rollDice(`1d${faces}`, faces),
            })
            : planLongRest({ party, hitDieByClass });

        for (const entry of plan.entries) {
            const member = party.find(m => String(m.id) === entry.id);
            if (!member) continue;
            member.hp = entry.hpAfter;
            const dice = getHitDice(member, hitDieByClass);
            member.hitDiceSpent = Math.max(0, Math.min(dice.total, dice.spent + entry.diceSpent - entry.diceRegained));
        }

        deps.saveParty();

        if (kind === 'corto') advanceSlotOfDay();
        else advanceDay();

        const lines = describeRest(kind, plan);
        deps.narrate(`[DESCANSO] ${lines.join('\n')}`);
        deps.renderParty();
        toastr.success(lines.slice(1).join('\n') || 'Nadie necesitaba descansar.', `Descanso ${kind}`, { timeOut: 9000 });
        return lines.join(' ');
    }

    /**
     * The campaign map of this game: which places are open, which are shut and why.
     *
     * @returns {import('../game-engine/campaign/campaign-map.js').CampaignMap}
     */
    function getMap() {
        return normalizeCampaignMap(deps.metadata()?.[CAMPAIGN_MAP_KEY]);
    }

    /**
     * @param {import('../game-engine/campaign/campaign-map.js').CampaignMap} map
     */
    function saveMap(map) {
        const metadata = deps.metadata();
        if (!metadata) return;
        metadata[CAMPAIGN_MAP_KEY] = map;
        deps.saveMetadata();
    }

    /**
     * Marks a location as finished on the campaign map.
     *
     * It is what opens the next ones: a place that requires having been through another
     * does not take the player's word for it, it checks the map. Called on **winning** a
     * board's scenario, because winning should be the only thing that opens doors.
     *
     * @param {string} locationName
     */
    function markLocationComplete(locationName) {
        const name = String(locationName || '').trim();
        if (!name) return;

        const before = getMap();
        const entry = before.locations.find(l => l.id === name);
        if (entry && entry.status === 'complete') return;

        // A place the map never knew about is added as it is completed: that way a
        // campaign with no declared map still accumulates where it has been.
        const withPlace = entry
            ? before
            : {
                version: before.version,
                locations: [...before.locations, {
                    id: name, name, status: /** @type {'available'} */ ('available'),
                    requiresQuests: [], requiresLocations: [],
                }],
            };

        saveMap(completeLocation(withPlace, name));
    }

    return {
        getCalendar,
        getBonds,
        save,
        getSlotLabel,
        advanceSlot: advanceSlotOfDay,
        advanceDay,
        recordBond,
        getHitDiceByClass,
        rest,
        getMap,
        saveMap,
        markLocationComplete,
    };
}
