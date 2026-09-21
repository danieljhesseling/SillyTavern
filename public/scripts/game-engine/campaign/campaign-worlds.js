/**
 * Worlds and campaigns are two different things, and the UI had drifted into treating them
 * as one.
 *
 * A *world* is a Lorebook: it exists as soon as it is created and shows up in World Info.
 * A *campaign* is a chat bound to a world, and that is all the welcome screen used to list.
 * So a world with locations and characters but no chat was visible in one place and
 * invisible in the other, with no path from one to the other. That is exactly what the
 * first version of the campaign wizard left behind, and it also happens to anyone who
 * builds a world by hand and has not started playing it yet.
 *
 * The functions here are the small pure rules that let the two lists agree.
 *
 * See wiki/POR_HACER.md.
 */

/**
 * Whether a world was built to be played: it has at least one location on a map.
 *
 * Deliberately narrow. Lorebooks are also used for plain character or setting lore, and
 * those should not turn up as campaigns, so the test is for the data a campaign needs and
 * a lore book does not.
 *
 * @param {any} metadata A world's `metadata` block.
 * @returns {boolean}
 */
export function isCampaignWorld(metadata) {
    return Array.isArray(metadata?.locationMaps) && metadata.locationMaps.length > 0;
}

/**
 * Where a campaign in this world starts: its first location and that location's first board.
 *
 * Boards live on the location in the current model, and a location can still name a global
 * board with `boardName`, which is the older shape. Either is honoured.
 *
 * @param {any} metadata
 * @returns {{locationName: string, boardName: string}}
 */
export function getStartingPoint(metadata) {
    const location = Array.isArray(metadata?.locationMaps) ? metadata.locationMaps[0] : null;
    if (!location || typeof location !== 'object') return { locationName: '', boardName: '' };

    const firstBoard = Array.isArray(location.boards) ? location.boards[0] : null;
    return {
        locationName: String(location.name ?? ''),
        boardName: String(firstBoard?.name ?? location.boardName ?? ''),
    };
}

/**
 * A world name that is free, starting from a suggestion.
 *
 * The wizard proposes the template's name, and on a second attempt that name is taken by
 * the world the first attempt made. Refusing it, when the user has not typed anything, is
 * a dead end they did nothing to cause; numbering it is not. Comparison is
 * case-insensitive because a Lorebook is a file and the filesystem may not tell
 * "Cripta" from "cripta".
 *
 * @param {string} base
 * @param {string[]} existingNames
 * @returns {string}
 */
export function uniqueWorldName(base, existingNames) {
    const wanted = String(base ?? '').trim() || 'Nueva campaña';
    const taken = new Set((Array.isArray(existingNames) ? existingNames : []).map(n => String(n).trim().toLowerCase()));

    if (!taken.has(wanted.toLowerCase())) return wanted;

    for (let n = 2; n < 1000; n++) {
        const candidate = `${wanted} (${n})`;
        if (!taken.has(candidate.toLowerCase())) return candidate;
    }
    // A thousand copies of the same world is not a real situation, but this must still
    // return something that cannot collide.
    return `${wanted} (${Date.now()})`;
}
