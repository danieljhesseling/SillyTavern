/**
 * Board terrain: walls, cover, difficult ground and doors.
 *
 * This is the foundation the rest of the tactical engine stands on. Line of sight, fog of
 * war and pathfinding all ask this module what a cell is. Before it existed the board was
 * an open plain, which is why A* would have been pointless: with nothing to walk around,
 * the shortest path is always the straight Chebyshev line.
 *
 * Storage is sparse. A 50x50 board is 2500 cells and nearly all of them are plain floor,
 * so only the exceptions are written down. The whole structure lives on the board metadata
 * inside the world info file, so it has to stay small and JSON-friendly.
 *
 * Pure module: no DOM, no imports, no shared state.
 *
 * See wiki/ROADMAP.md, Fase A (A1).
 */

/**
 * @typedef {Object} TerrainDefinition
 * @property {string} label
 * @property {boolean} blocksMovement
 * @property {boolean} blocksSight
 * @property {number} movementCost  Multiplier applied per cell entered; Infinity if impassable.
 * @property {number} coverBonus    AC bonus granted to a target standing behind it.
 * @property {boolean} [stateful]   Whether individual cells carry extra state (doors).
 */

/**
 * The terrain catalogue.
 *
 * Deliberately a plain data table rather than a switch: Fase C lifts definitions like this
 * one out of the code and into editable rule packs. Keeping the shape data-like now means
 * that move is a relocation, not a rewrite.
 *
 * @type {Record<string, TerrainDefinition>}
 */
export const TERRAIN_TYPES = {
    floor: {
        label: 'Floor',
        blocksMovement: false,
        blocksSight: false,
        movementCost: 1,
        coverBonus: 0,
    },
    wall: {
        label: 'Wall',
        blocksMovement: true,
        blocksSight: true,
        movementCost: Infinity,
        coverBonus: 0,
    },
    difficult: {
        label: 'Difficult terrain',
        blocksMovement: false,
        blocksSight: false,
        movementCost: 2,
        coverBonus: 0,
    },
    cover_half: {
        label: 'Half cover',
        blocksMovement: false,
        blocksSight: false,
        movementCost: 1,
        coverBonus: 2,
    },
    cover_three_quarters: {
        label: 'Three-quarters cover',
        blocksMovement: false,
        blocksSight: false,
        movementCost: 1,
        coverBonus: 5,
    },
    /**
     * Doors are the one stateful type: closed they are a wall, open they are floor.
     * Per-cell state lives on the cell itself, not here.
     */
    door: {
        label: 'Door',
        blocksMovement: true,
        blocksSight: true,
        movementCost: Infinity,
        coverBonus: 0,
        stateful: true,
    },
};

/** The type assumed for any cell not present in the sparse map. */
export const DEFAULT_TERRAIN = 'floor';

/** Bumped when the stored shape changes, so migrations have something to branch on. */
export const TERRAIN_SCHEMA_VERSION = 1;

/**
 * @typedef {Object} TerrainCell
 * @property {string} type
 * @property {boolean} [open]  Doors only.
 */

/**
 * @typedef {Object} BoardTerrain
 * @property {number} version
 * @property {Record<string, TerrainCell>} cells  Keyed by "x,y".
 */

/**
 * Builds the sparse-map key for a cell.
 * @param {number} x
 * @param {number} y
 * @returns {string}
 */
export function cellKey(x, y) {
    return `${Math.trunc(Number(x) || 0)},${Math.trunc(Number(y) || 0)}`;
}

/**
 * Parses a sparse-map key back into coordinates.
 * @param {string} key
 * @returns {{ x: number, y: number } | null}
 */
export function parseCellKey(key) {
    const match = /^(-?\d+),(-?\d+)$/.exec(String(key));
    if (!match) return null;
    return { x: Number(match[1]), y: Number(match[2]) };
}

/**
 * @returns {BoardTerrain}
 */
export function createEmptyTerrain() {
    return { version: TERRAIN_SCHEMA_VERSION, cells: {} };
}

/**
 * Repairs terrain read from disk. World info files are hand-edited and AI-generated, so
 * anything can turn up here; unknown types and malformed keys are dropped rather than
 * allowed to blow up mid-combat.
 * @param {any} raw
 * @returns {BoardTerrain}
 */
export function normalizeTerrain(raw) {
    if (!raw || typeof raw !== 'object') return createEmptyTerrain();

    const sourceCells = raw.cells && typeof raw.cells === 'object' ? raw.cells : {};
    /** @type {Record<string, TerrainCell>} */
    const cells = {};

    for (const [key, value] of Object.entries(sourceCells)) {
        if (!parseCellKey(key)) continue;

        const type = String(value && typeof value === 'object' ? value.type : value || '');
        if (!Object.prototype.hasOwnProperty.call(TERRAIN_TYPES, type)) continue;
        // Storing the default explicitly would just bloat the file.
        if (type === DEFAULT_TERRAIN) continue;

        /** @type {TerrainCell} */
        const cell = { type };
        if (TERRAIN_TYPES[type].stateful) {
            cell.open = Boolean(value && typeof value === 'object' && value.open);
        }
        cells[key] = cell;
    }

    return { version: TERRAIN_SCHEMA_VERSION, cells };
}

/**
 * @param {BoardTerrain} terrain
 * @param {number} x
 * @param {number} y
 * @returns {TerrainCell}
 */
export function getCell(terrain, x, y) {
    const cell = terrain?.cells?.[cellKey(x, y)];
    if (!cell || !Object.prototype.hasOwnProperty.call(TERRAIN_TYPES, cell.type)) {
        return { type: DEFAULT_TERRAIN };
    }
    return cell;
}

/**
 * Resolves a cell to its effective definition, applying per-cell state.
 * An open door behaves as floor; a closed one as a wall.
 * @param {BoardTerrain} terrain
 * @param {number} x
 * @param {number} y
 * @returns {TerrainDefinition}
 */
export function getCellDefinition(terrain, x, y) {
    const cell = getCell(terrain, x, y);
    const definition = TERRAIN_TYPES[cell.type];
    if (cell.type === 'door' && cell.open) {
        return TERRAIN_TYPES[DEFAULT_TERRAIN];
    }
    return definition;
}

/**
 * Writes a cell. Setting a cell back to the default removes it, keeping the map sparse.
 * Returns a new object: callers should not rely on mutation.
 * @param {BoardTerrain} terrain
 * @param {number} x
 * @param {number} y
 * @param {string} type
 * @param {{ open?: boolean }} [options]
 * @returns {BoardTerrain}
 */
export function setCell(terrain, x, y, type, options = {}) {
    const base = normalizeTerrain(terrain);
    const key = cellKey(x, y);

    if (!Object.prototype.hasOwnProperty.call(TERRAIN_TYPES, type) || type === DEFAULT_TERRAIN) {
        const cells = { ...base.cells };
        delete cells[key];
        return { version: TERRAIN_SCHEMA_VERSION, cells };
    }

    /** @type {TerrainCell} */
    const cell = { type };
    if (TERRAIN_TYPES[type].stateful) {
        cell.open = Boolean(options.open);
    }
    return { version: TERRAIN_SCHEMA_VERSION, cells: { ...base.cells, [key]: cell } };
}

/**
 * Opens or closes a door. Any other terrain is left untouched.
 * @param {BoardTerrain} terrain
 * @param {number} x
 * @param {number} y
 * @param {boolean} open
 * @returns {BoardTerrain}
 */
export function setDoorOpen(terrain, x, y, open) {
    const cell = getCell(terrain, x, y);
    if (cell.type !== 'door') return normalizeTerrain(terrain);
    return setCell(terrain, x, y, 'door', { open: Boolean(open) });
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {boolean}
 */
export function isInsideGrid(x, y, gridWidth, gridHeight) {
    return Number.isFinite(x) && Number.isFinite(y)
        && x >= 0 && y >= 0
        && x < gridWidth && y < gridHeight;
}

/**
 * Whether a creature may stand on this cell. Cells outside the board never can.
 * @param {BoardTerrain} terrain
 * @param {number} x
 * @param {number} y
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {boolean}
 */
export function isPassable(terrain, x, y, gridWidth, gridHeight) {
    if (!isInsideGrid(x, y, gridWidth, gridHeight)) return false;
    return !getCellDefinition(terrain, x, y).blocksMovement;
}

/**
 * Whether this cell stops a line of sight passing through it.
 * @param {BoardTerrain} terrain
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function blocksSight(terrain, x, y) {
    return getCellDefinition(terrain, x, y).blocksSight;
}

/**
 * Movement cost of entering this cell, in cells. Infinity when impassable.
 * @param {BoardTerrain} terrain
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export function getMovementCost(terrain, x, y) {
    return getCellDefinition(terrain, x, y).movementCost;
}

/**
 * AC bonus granted to a creature standing on this cell.
 * @param {BoardTerrain} terrain
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export function getCoverBonus(terrain, x, y) {
    return getCellDefinition(terrain, x, y).coverBonus;
}

/**
 * Characters accepted by terrainFromAsciiMap, so a layout can be read in the source.
 * Anything not listed is plain floor.
 */
export const ASCII_TERRAIN = {
    '#': { type: 'wall' },
    'D': { type: 'door', open: false },
    'o': { type: 'door', open: true },
    '~': { type: 'difficult' },
    'c': { type: 'cover_half' },
    'C': { type: 'cover_three_quarters' },
};

/**
 * Builds terrain from an ASCII map.
 *
 * A layout you can see in the source is a layout you can check against the screen, which
 * is why the starter templates and the sandbox are both written this way.
 *
 * @param {string[]} rows
 * @returns {BoardTerrain}
 */
export function terrainFromAsciiMap(rows) {
    let terrain = createEmptyTerrain();
    if (!Array.isArray(rows)) return terrain;

    rows.forEach((row, y) => {
        [...String(row ?? '')].forEach((char, x) => {
            const cell = ASCII_TERRAIN[char];
            if (cell) {
                terrain = setCell(terrain, x, y, cell.type, { open: cell.open });
            }
        });
    });

    return terrain;
}

/**
 * Lists the terrain types available to an editor, as [value, label] pairs.
 * @returns {Array<[string, string]>}
 */
export function getTerrainOptions() {
    return Object.entries(TERRAIN_TYPES).map(([value, definition]) => [value, definition.label]);
}
