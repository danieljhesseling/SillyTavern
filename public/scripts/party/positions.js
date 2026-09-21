/**
 * Where a party member starts on the board.
 *
 * A character's starting place has been written three different ways over time: the
 * content browser saves `location`, `board`, `boardX` and `boardY`; hand-written world
 * info tends to use `locationName`; and the starter templates describe it as a
 * `mapPosition` object, which is the shape the party itself uses at runtime.
 *
 * setPartyFromWorldEntries used to read only `locationName`/`location` and then put
 * everybody at (0, 0). The coordinates the content browser saves were never read, and a
 * `mapPosition` was ignored outright — so a new campaign put its whole party on the
 * corner cell, which on a walled board is a wall, and buildTokens hides anyone whose
 * location name does not match the current one.
 *
 * Kept as its own pure module so the contract between what gets written and what gets
 * read can be tested without loading the party panel, which needs a browser.
 *
 * See wiki/POR_HACER.md.
 */

/**
 * @typedef {Object} ResolvedMapPosition
 * @property {string} locationName
 * @property {number} gridX
 * @property {number} gridY
 */

/**
 * The first value that is present and not an empty string.
 * @param {...any} candidates
 * @returns {any}
 */
function firstPresent(...candidates) {
    return candidates.find(value => value !== undefined && value !== null && value !== '');
}

/**
 * A board coordinate: a non-negative whole number, or 0 for anything else.
 * @param {any} value
 * @returns {number}
 */
function toCell(value) {
    const cell = Math.trunc(Number(value));
    return Number.isFinite(cell) && cell >= 0 ? cell : 0;
}

/**
 * Resolves a world-info entry's `dndData` to the position its party member starts at.
 *
 * `mapPosition` wins when present. Otherwise the fields the content browser writes are
 * used, so characters authored by hand start where their form says they do.
 *
 * @param {any} dndData
 * @returns {ResolvedMapPosition}
 */
export function resolveEntryMapPosition(dndData) {
    const d = dndData && typeof dndData === 'object' ? dndData : {};
    const position = d.mapPosition && typeof d.mapPosition === 'object' ? d.mapPosition : {};

    return {
        locationName: String(firstPresent(position.locationName, d.locationName, d.location) ?? ''),
        gridX: toCell(firstPresent(position.gridX, d.boardX)),
        gridY: toCell(firstPresent(position.gridY, d.boardY)),
    };
}
