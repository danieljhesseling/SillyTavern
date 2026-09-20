/**
 * Rooms, doors and the campaign map.
 *
 * Two related things live here.
 *
 * Rooms sit on top of the terrain from Fase A: a room is a set of cells plus the doors
 * that lead into it. Opening a door reveals the room behind it and wakes whatever is
 * inside, which is how a Gloomhaven dungeon is paced — you meet the next fight when you
 * choose to, not when the map loads.
 *
 * The campaign map is the layer above: locations that are locked, available or done, with
 * requirements the engine checks rather than the player remembering.
 *
 * Pure module.
 *
 * See wiki/ROADMAP.md, Fase E (E2, E3).
 */

import { cellKey, parseCellKey, setDoorOpen } from '../board/terrain.js';

export const CAMPAIGN_MAP_SCHEMA_VERSION = 1;

/** @typedef {'locked'|'available'|'complete'} LocationStatus */

/**
 * @typedef {Object} Room
 * @property {string} id
 * @property {string} [name]
 * @property {string[]} cells       Cell keys, "x,y".
 * @property {string[]} doors       Cell keys of the doors leading in.
 * @property {string[]} [enemyIds]  Woken when the room is revealed.
 * @property {boolean} revealed
 */

/**
 * @param {any} raw
 * @returns {Room[]}
 */
export function normalizeRooms(raw) {
    return (Array.isArray(raw) ? raw : [])
        .filter(r => r && typeof r === 'object' && r.id != null)
        .map((r, index) => ({
            id: String(r.id || `room_${index}`),
            name: String(r.name || ''),
            cells: (Array.isArray(r.cells) ? r.cells : []).map(String).filter(k => parseCellKey(k)),
            doors: (Array.isArray(r.doors) ? r.doors : []).map(String).filter(k => parseCellKey(k)),
            enemyIds: Array.isArray(r.enemyIds) ? r.enemyIds.map(String) : [],
            revealed: Boolean(r.revealed),
        }));
}

/**
 * Builds a room from a rectangle, which is how most of them get drawn.
 * @param {string} id
 * @param {{x: number, y: number, width: number, height: number}} rect
 * @param {{name?: string, doors?: Array<{x: number, y: number}>, enemyIds?: string[]}} [options]
 * @returns {Room}
 */
export function createRoomFromRect(id, rect, options = {}) {
    /** @type {string[]} */
    const cells = [];
    for (let y = rect.y; y < rect.y + rect.height; y++) {
        for (let x = rect.x; x < rect.x + rect.width; x++) {
            cells.push(cellKey(x, y));
        }
    }

    return {
        id: String(id),
        name: String(options.name || ''),
        cells,
        doors: (options.doors ?? []).map(d => cellKey(d.x, d.y)),
        enemyIds: options.enemyIds ?? [],
        revealed: false,
    };
}

/**
 * The room a cell belongs to, or null for corridor.
 * @param {Room[]} rooms
 * @param {number} x @param {number} y
 * @returns {Room|null}
 */
export function getRoomAt(rooms, x, y) {
    const key = cellKey(x, y);
    return normalizeRooms(rooms).find(r => r.cells.includes(key)) ?? null;
}

/**
 * The room a door leads into.
 * @param {Room[]} rooms
 * @param {number} x @param {number} y
 * @returns {Room|null}
 */
export function getRoomBehindDoor(rooms, x, y) {
    const key = cellKey(x, y);
    return normalizeRooms(rooms).find(r => r.doors.includes(key)) ?? null;
}

/**
 * Opens a door and reveals what it guards.
 *
 * Returns the new terrain, the new rooms and the enemies that just woke up, because those
 * three things always move together and separating them invites forgetting one.
 *
 * @param {import('../board/terrain.js').BoardTerrain} terrain
 * @param {Room[]} rooms
 * @param {number} x @param {number} y
 * @returns {{terrain: any, rooms: Room[], revealedRoom: Room|null, wokenEnemyIds: string[]}}
 */
export function openDoor(terrain, rooms, x, y) {
    const list = normalizeRooms(rooms);
    const nextTerrain = setDoorOpen(terrain, x, y, true);
    const room = getRoomBehindDoor(list, x, y);

    if (!room || room.revealed) {
        return { terrain: nextTerrain, rooms: list, revealedRoom: null, wokenEnemyIds: [] };
    }

    return {
        terrain: nextTerrain,
        rooms: list.map(r => (r.id === room.id ? { ...r, revealed: true } : r)),
        revealedRoom: { ...room, revealed: true },
        wokenEnemyIds: room.enemyIds ?? [],
    };
}

/**
 * Cells the party is allowed to know about: every revealed room, plus anything outside a
 * room. Corridors are not a surprise worth hiding.
 * @param {Room[]} rooms
 * @returns {Set<string>}
 */
export function getRevealedCells(rooms) {
    const revealed = new Set();
    for (const room of normalizeRooms(rooms)) {
        if (!room.revealed) continue;
        for (const key of room.cells) revealed.add(key);
    }
    return revealed;
}

/**
 * Whether an enemy should be acting yet. One asleep in an unopened room does not take
 * turns, which is what stops a dungeon being one enormous fight.
 * @param {Room[]} rooms
 * @param {string} enemyId
 * @returns {boolean}
 */
export function isEnemyAwake(rooms, enemyId) {
    const list = normalizeRooms(rooms);
    const home = list.find(r => (r.enemyIds ?? []).includes(String(enemyId)));
    return home ? home.revealed : true; // no room means it was placed loose, so it is awake
}

/**
 * @typedef {Object} MapLocation
 * @property {string} id
 * @property {string} name
 * @property {LocationStatus} status
 * @property {string[]} [requiresQuests]     Quest ids that must be complete.
 * @property {string[]} [requiresLocations]  Locations that must be complete.
 * @property {number} [requiresBondRank]
 * @property {string} [requiresBondWith]
 */

/**
 * @typedef {Object} CampaignMap
 * @property {number} version
 * @property {MapLocation[]} locations
 */

/** @returns {CampaignMap} */
export function createCampaignMap() {
    return { version: CAMPAIGN_MAP_SCHEMA_VERSION, locations: [] };
}

/**
 * @param {any} raw
 * @returns {CampaignMap}
 */
export function normalizeCampaignMap(raw) {
    if (!raw || typeof raw !== 'object') return createCampaignMap();

    const valid = ['locked', 'available', 'complete'];
    const locations = (Array.isArray(raw.locations) ? raw.locations : [])
        .filter(l => l && l.id != null)
        .map((l, index) => ({
            id: String(l.id || `loc_${index}`),
            name: String(l.name || ''),
            status: valid.includes(l.status) ? l.status : 'locked',
            requiresQuests: Array.isArray(l.requiresQuests) ? l.requiresQuests.map(String) : [],
            requiresLocations: Array.isArray(l.requiresLocations) ? l.requiresLocations.map(String) : [],
            requiresBondRank: Number.isFinite(Number(l.requiresBondRank)) ? Number(l.requiresBondRank) : undefined,
            requiresBondWith: l.requiresBondWith != null ? String(l.requiresBondWith) : undefined,
        }));

    return { version: CAMPAIGN_MAP_SCHEMA_VERSION, locations };
}

/**
 * Recomputes which locations are open.
 *
 * Requirements are checked rather than trusted: a location stays locked until the engine
 * can see its conditions met, so a campaign cannot drift into an inconsistent state
 * because somebody clicked the wrong thing once.
 *
 * @param {CampaignMap} map
 * @param {{ isQuestComplete: (id: string) => boolean, getBondRank: (id: string) => number }} context
 * @returns {CampaignMap}
 */
export function refreshAvailability(map, context) {
    const current = normalizeCampaignMap(map);
    const completed = new Set(current.locations.filter(l => l.status === 'complete').map(l => l.id));

    const locations = current.locations.map(location => {
        if (location.status === 'complete') return location;

        const questsOk = (location.requiresQuests ?? []).every(q => context.isQuestComplete(q));
        const placesOk = (location.requiresLocations ?? []).every(l => completed.has(l));
        const bondOk = location.requiresBondRank == null || location.requiresBondWith == null
            ? true
            : context.getBondRank(location.requiresBondWith) >= location.requiresBondRank;

        const unlocked = questsOk && placesOk && bondOk;
        return { ...location, status: /** @type {LocationStatus} */ (unlocked ? 'available' : 'locked') };
    });

    return { version: CAMPAIGN_MAP_SCHEMA_VERSION, locations };
}

/**
 * Marks a location finished.
 * @param {CampaignMap} map
 * @param {string} locationId
 * @returns {CampaignMap}
 */
export function completeLocation(map, locationId) {
    const current = normalizeCampaignMap(map);
    return {
        version: CAMPAIGN_MAP_SCHEMA_VERSION,
        locations: current.locations.map(l =>
            (l.id === String(locationId) ? { ...l, status: /** @type {LocationStatus} */ ('complete') } : l)),
    };
}

/**
 * Why a location is still shut, for a tooltip that explains instead of just refusing.
 * @param {CampaignMap} map
 * @param {string} locationId
 * @param {{ isQuestComplete: (id: string) => boolean, getBondRank: (id: string) => number }} context
 * @returns {string[]}
 */
export function explainLock(map, locationId, context) {
    const location = normalizeCampaignMap(map).locations.find(l => l.id === String(locationId));
    if (!location || location.status !== 'locked') return [];

    const completed = new Set(normalizeCampaignMap(map).locations.filter(l => l.status === 'complete').map(l => l.id));
    /** @type {string[]} */
    const reasons = [];

    for (const quest of location.requiresQuests ?? []) {
        if (!context.isQuestComplete(quest)) reasons.push(`Requiere completar la misión "${quest}".`);
    }
    for (const place of location.requiresLocations ?? []) {
        if (!completed.has(place)) reasons.push(`Requiere haber superado "${place}".`);
    }
    if (location.requiresBondRank != null && location.requiresBondWith != null
        && context.getBondRank(location.requiresBondWith) < location.requiresBondRank) {
        reasons.push(`Requiere vínculo ${location.requiresBondRank} con ${location.requiresBondWith}.`);
    }

    return reasons;
}
