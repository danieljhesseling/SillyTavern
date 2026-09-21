/**
 * What the exploration scene shows: where the party is, what else is on the map, and
 * what is still shut.
 *
 * This is where `campaign-map.js` finally gets used. It had been written and tested for
 * a long time with nothing loading it: locations that are locked, available or done, with
 * requirements the engine checks instead of the player remembering. A map that only
 * listed places would not have needed it; one that can say *why* a place is shut does.
 *
 * The places come from the world, not from the stored map. A campaign that never declared
 * a campaign map still has locations — they are simply all open — and a stored entry for
 * a place the world does not have is dropped, because offering somewhere you cannot go is
 * worse than not offering it.
 *
 * Pure. See wiki/PROPUESTA_FRONTEND_MODO_JUEGO.md, H4 · wiki/ROADMAP.md, Fase E (E3).
 */

import { normalizeCampaignMap, refreshAvailability, explainLock } from '../../campaign/campaign-map.js';
import { getBondProgress } from '../../campaign/bonds.js';
import { buildPartyStrip } from './party-strip.js';

/**
 * @typedef {Object} PlaceView
 * @property {string} id
 * @property {string} name
 * @property {'locked'|'available'|'complete'} status
 * @property {boolean} current Whether the party is standing there.
 * @property {number} boards How many boards the place holds.
 * @property {string[]} reasons Why it is shut, when it is.
 */

/**
 * @typedef {Object} BoardView
 * @property {string} name
 * @property {boolean} current
 */

/**
 * @typedef {Object} ExplorationView
 * @property {string} moment
 * @property {string} here The location the party is in, or an empty string.
 * @property {string} description
 * @property {BoardView[]} boards
 * @property {PlaceView[]} places
 * @property {import('./party-strip.js').PartyChip[]} party
 */

/**
 * The boards of a location, under either of the two shapes the world files use.
 *
 * @param {any} location
 * @returns {any[]}
 */
function boardsOf(location) {
    if (Array.isArray(location?.boards)) return location.boards.filter(Boolean);
    return location?.boardName ? [{ name: location.boardName }] : [];
}

/**
 * Merge what the world has with what the campaign map says about it.
 *
 * The world decides which places exist; the stored map decides what is required to get
 * in and what has already been finished. A place the map never mentioned is open, which
 * is what makes this work on every campaign that exists today.
 *
 * @param {any[]} locationMaps
 * @param {any} campaignMap
 * @returns {import('../../campaign/campaign-map.js').CampaignMap}
 */
function mergeMap(locationMaps, campaignMap) {
    const stored = normalizeCampaignMap(campaignMap);
    const byId = new Map(stored.locations.map(l => [l.id, l]));

    const locations = (Array.isArray(locationMaps) ? locationMaps : [])
        .filter(l => l && l.name)
        .map(l => {
            const name = String(l.name);
            const entry = byId.get(name);
            return entry
                ? { ...entry, name }
                : { id: name, name, status: /** @type {'available'} */ ('available'), requiresQuests: [], requiresLocations: [] };
        });

    return { version: stored.version, locations };
}

/**
 * Build everything the exploration scene draws.
 *
 * @param {Object} input
 * @param {any[]} [input.locationMaps] The world's locations.
 * @param {any} [input.campaignMap] What the campaign has stored about them.
 * @param {string} [input.currentLocation]
 * @param {string} [input.currentBoard]
 * @param {any[]} [input.party]
 * @param {any} [input.bonds]
 * @param {any} [input.calendar]
 * @param {(questId: string) => boolean} [input.isQuestComplete]
 * @returns {ExplorationView}
 */
export function buildExplorationView({
    locationMaps = [], campaignMap = null, currentLocation = '', currentBoard = '',
    party = [], bonds = null, calendar = null, isQuestComplete = () => false,
} = {}) {
    const { chips, moment } = buildPartyStrip({ party, bonds, calendar });

    // A requirement names a companion; the bonds are kept by id. Either spelling works.
    const byName = new Map(chips.map(c => [c.name.toLowerCase(), c.id]));
    const context = {
        isQuestComplete: (/** @type {string} */ id) => Boolean(isQuestComplete(id)),
        getBondRank: (/** @type {string} */ who) => {
            const id = byName.get(String(who).toLowerCase()) ?? String(who);
            return getBondProgress(bonds, id).rank;
        },
    };

    const merged = mergeMap(locationMaps, campaignMap);
    const resolved = refreshAvailability(merged, context);
    const boardCount = new Map((Array.isArray(locationMaps) ? locationMaps : [])
        .filter(l => l && l.name).map(l => [String(l.name), boardsOf(l).length]));

    const places = resolved.locations.map(location => ({
        id: location.id,
        name: location.name || location.id,
        status: location.status,
        current: location.id === String(currentLocation),
        boards: boardCount.get(location.id) ?? 0,
        reasons: location.status === 'locked' ? explainLock(resolved, location.id, context) : [],
    }));

    const here = (Array.isArray(locationMaps) ? locationMaps : [])
        .find(l => l && String(l.name) === String(currentLocation)) || null;

    return {
        moment,
        here: here ? String(here.name) : '',
        description: String(here?.description || ''),
        boards: boardsOf(here).map(b => ({
            name: String(b?.name || ''),
            current: String(b?.name || '') === String(currentBoard),
        })),
        places,
        party: chips,
    };
}
