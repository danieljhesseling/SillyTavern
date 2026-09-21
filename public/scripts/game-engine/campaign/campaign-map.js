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
 *
 * A door between two rooms belongs to both, and the one that matters is the one you have
 * not seen: taking the first match would mean that standing in room A and opening the
 * door to room B revealed nothing, because A was already revealed and came first.
 *
 * @param {Room[]} rooms
 * @param {number} x @param {number} y
 * @returns {Room|null}
 */
export function getRoomBehindDoor(rooms, x, y) {
    const key = cellKey(x, y);
    const touching = normalizeRooms(rooms).filter(r => r.doors.includes(key));
    return touching.find(r => !r.revealed) ?? touching[0] ?? null;
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

/**
 * Work out the rooms of a board from its own terrain.
 *
 * A book does not describe its rooms in words — it draws them. The ASCII map already has
 * everything needed: walls enclose, doors separate. So the rooms are **derived** rather
 * than authored, which means the pack contract asks the Gem for nothing extra and an
 * older board gains rooms the moment this runs over it.
 *
 * A region is a group of floor cells joined orthogonally, bounded by walls and by doors.
 * Doors are boundaries, not floor: otherwise two rooms joined by a doorway would be one
 * room and the door would guard nothing.
 *
 * @param {import('../board/terrain.js').BoardTerrain} terrain
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @param {{revealFrom?: Array<{x: number, y: number}>}} [options] Cells whose room starts
 *   revealed — where the party is standing when the board opens.
 * @returns {Room[]}
 */
export function deriveRooms(terrain, gridWidth, gridHeight, options = {}) {
    const width = Math.max(0, Number(gridWidth) || 0);
    const height = Math.max(0, Number(gridHeight) || 0);
    const typeAt = (/** @type {number} */ x, /** @type {number} */ y) =>
        String(terrain?.cells?.[cellKey(x, y)]?.type ?? 'floor');

    const isFloor = (/** @type {number} */ x, /** @type {number} */ y) => {
        if (x < 0 || y < 0 || x >= width || y >= height) return false;
        const type = typeAt(x, y);
        return type !== 'wall' && type !== 'door';
    };

    /** @type {Set<string>} */
    const seen = new Set();
    /** @type {Room[]} */
    const rooms = [];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const key = cellKey(x, y);
            if (seen.has(key) || !isFloor(x, y)) continue;

            /** @type {string[]} */
            const cells = [];
            /** @type {Set<string>} */
            const doors = new Set();
            const queue = [{ x, y }];
            seen.add(key);

            while (queue.length > 0) {
                const cell = queue.pop();
                if (!cell) break;
                cells.push(cellKey(cell.x, cell.y));

                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    const nx = cell.x + dx;
                    const ny = cell.y + dy;
                    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;

                    if (typeAt(nx, ny) === 'door') {
                        doors.add(cellKey(nx, ny));
                        continue;
                    }
                    const next = cellKey(nx, ny);
                    if (seen.has(next) || !isFloor(nx, ny)) continue;
                    seen.add(next);
                    queue.push({ x: nx, y: ny });
                }
            }

            rooms.push({
                id: `room_${rooms.length + 1}`,
                name: '',
                cells,
                doors: [...doors],
                enemyIds: [],
                revealed: false,
            });
        }
    }

    // Where the party starts is not a surprise.
    const start = (options.revealFrom ?? []).map(cell => cellKey(Number(cell?.x) || 0, Number(cell?.y) || 0));
    return rooms.map(room => (room.cells.some(cell => start.includes(cell)) ? { ...room, revealed: true } : room));
}

/**
 * Which of a board's placed creatures are standing inside a room.
 *
 * The board says where each creature was drawn and the room says which cells it covers;
 * putting the two together is what makes "the enemies of that room wake up" a fact rather
 * than a guess. Keeping the answer here, rather than a list copied onto the room, means
 * there is one place that knows where anybody stands.
 *
 * @param {Room|null} room
 * @param {Array<{name: string, x: number, y: number}>} placements
 * @returns {Array<{name: string, x: number, y: number}>}
 */
export function enemiesInRoom(room, placements) {
    if (!room) return [];
    const cells = new Set(room.cells ?? []);
    return (Array.isArray(placements) ? placements : [])
        .filter(p => p && cells.has(cellKey(Number(p.x) || 0, Number(p.y) || 0)));
}

/**
 * The placements the party can see: those in a revealed room.
 *
 * A board with no rooms at all hides nothing — that is every board made before rooms
 * existed, and they should keep working exactly as they did.
 *
 * @param {Room[]} rooms
 * @param {Array<{name: string, x: number, y: number}>} placements
 * @returns {Array<{name: string, x: number, y: number}>}
 */
export function awakePlacements(rooms, placements) {
    const list = normalizeRooms(rooms);
    if (list.length === 0) return Array.isArray(placements) ? placements : [];

    const visible = new Set(list.filter(r => r.revealed).flatMap(r => r.cells));
    return (Array.isArray(placements) ? placements : [])
        .filter(p => p && visible.has(cellKey(Number(p.x) || 0, Number(p.y) || 0)));
}
