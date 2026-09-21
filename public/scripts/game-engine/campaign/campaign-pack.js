/**
 * The campaign pack: reading one, and saying what is wrong with it.
 *
 * A pack is what a Gem gives you after chewing through a campaign book. The schema in
 * `campaign-pack-schema.js` publishes what the fields are; this says whether a given pack
 * hangs together. The difference matters more than it sounds: **where a generated pack
 * fails is almost never a missing field**. It is a quest pointing at a board that is not
 * there, an enemy placed on a wall, two companions with the same name, a map whose rows
 * are not all the same length. A JSON Schema cannot see any of that.
 *
 * Three kinds of finding, because they call for three different things from the person
 * holding the pack:
 *
 * - **errors** stop the import. Something is missing or contradictory and guessing would
 *   invent content the book never had.
 * - **warnings** do not. The pack imports and plays; something is merely odd, like a
 *   board no quest sends you to.
 * - **repairs** are what `normalizePack` already fixed. They are listed, never silent:
 *   a pack that got quietly rewritten is a pack whose author cannot learn anything.
 *
 * Pure. See wiki/ROADMAP_INGESTA_CAMPANAS_LIBROS.md (G2) · wiki/POR_HACER.md.
 */

import { CAMPAIGN_PACK_VERSION, OBJECTIVE_FIELDS } from './campaign-pack-schema.js';
import { OBJECTIVE_TYPES } from './scenarios.js';
import { ASCII_TERRAIN } from '../board/terrain.js';

/**
 * @typedef {Object} Issue
 * @property {string} path Where it is, in the author's own terms: `quests[1].boardId`.
 * @property {string} message What is wrong, and where to look.
 */

/**
 * @typedef {Object} PackReport
 * @property {boolean} ok Whether the pack can be imported.
 * @property {Issue[]} errors
 * @property {Issue[]} warnings
 * @property {Issue[]} repairs What normalising already put right.
 * @property {{world: string, boards: number, enemies: number, confidants: number, quests: number, objectives: number}} counts
 */

/** Map characters that are not walkable floor. Everything else in the legend is. */
const BLOCKING = new Set(
    Object.entries(ASCII_TERRAIN)
        .filter(([, cell]) => cell.type === 'wall')
        .map(([char]) => char),
);

/** Every character the legend allows, plus the floor. */
const LEGAL_CHARS = new Set(['.', ...Object.keys(ASCII_TERRAIN)]);

/**
 * @param {string} value
 * @returns {string}
 */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * An id from a name, for a pack that left one out.
 *
 * @param {string} name
 * @param {string} fallback
 * @returns {string}
 */
function slug(name, fallback) {
    const base = text(name).toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return base || fallback;
}

/**
 * Read a pack into the shape the importer expects, and say what had to be put right.
 *
 * Normalising is deliberately narrow. It fills in what can be derived without inventing
 * anything — an id from a name, a boolean from a truthy value, a dropped field the
 * contract does not have — and it leaves everything else exactly as written, so the
 * validator below reports it rather than papering over it.
 *
 * @param {any} raw
 * @returns {{pack: any, repairs: Issue[]}}
 */
export function normalizePack(raw) {
    /** @type {Issue[]} */
    const repairs = [];
    const source = (raw && typeof raw === 'object') ? raw : {};
    const list = (/** @type {any} */ value) => (Array.isArray(value) ? value.filter(Boolean) : []);

    const world = (source.world && typeof source.world === 'object') ? source.world : {};

    const boards = list(source.boards).map((board, index) => {
        const name = text(board.name);
        let id = text(board.id);
        if (!id) {
            id = slug(name, `board_${index + 1}`);
            repairs.push({ path: `boards[${index}]`, message: `Sin \`id\`: se ha usado "${id}", derivado del nombre.` });
        }
        return {
            ...board,
            id,
            name: name || id,
            locationName: text(board.locationName) || text(world.name),
            map: list(board.map).map(row => String(row)),
            partyStart: list(board.partyStart),
            enemies: list(board.enemies),
        };
    });

    const quests = list(source.quests).map((quest, index) => {
        const name = text(quest.name);
        let id = text(quest.id);
        if (!id) {
            id = slug(name, `quest_${index + 1}`);
            repairs.push({ path: `quests[${index}]`, message: `Sin \`id\`: se ha usado "${id}", derivado del nombre.` });
        }

        const objectives = list(quest.objectives).map((objective, oIndex) => {
            const clean = { ...objective };
            // The contract has `optional`, and says so; `required` is the field authors
            // reach for anyway, and it means the opposite of nothing here.
            if ('required' in clean) {
                delete clean.required;
                repairs.push({
                    path: `quests[${index}].objectives[${oIndex}]`,
                    message: 'Se ha quitado `required`: el contrato solo tiene `optional`.',
                });
            }
            if ('optional' in clean) clean.optional = Boolean(clean.optional);
            return clean;
        });

        return { ...quest, id, name: name || id, objectives };
    });

    return {
        pack: {
            version: Number(source.version) || CAMPAIGN_PACK_VERSION,
            world: { ...world, name: text(world.name), factions: list(world.factions), loreEntries: list(world.loreEntries) },
            confidants: list(source.confidants),
            bestiary: list(source.bestiary),
            boards,
            quests,
        },
        repairs,
    };
}

/**
 * Check one map: rectangular, walled all the way round, and drawn with legal characters.
 *
 * A map that is not rectangular is the most common thing a generated pack gets wrong, and
 * the one that looks most like nothing at all: a row one character short shifts every
 * wall after it and the board silently stops making sense.
 *
 * @param {string[]} map
 * @param {string} path
 * @param {Issue[]} errors
 * @returns {{width: number, height: number}}
 */
function checkMap(map, path, errors) {
    const height = map.length;
    if (height < 3) {
        errors.push({ path, message: 'El mapa necesita al menos tres filas para tener borde y suelo.' });
        return { width: 0, height };
    }

    const width = map[0].length;
    for (let y = 0; y < height; y++) {
        if (map[y].length !== width) {
            errors.push({
                path: `${path}[${y}]`,
                message: `Las filas no miden lo mismo: esta tiene ${map[y].length} y la primera ${width}. El mapa tiene que ser rectangular.`,
            });
            return { width: 0, height };
        }
        for (let x = 0; x < width; x++) {
            if (!LEGAL_CHARS.has(map[y][x])) {
                errors.push({ path: `${path}[${y}]`, message: `Caracter "${map[y][x]}" en x=${x}: no esta en la leyenda.` });
                return { width: 0, height };
            }
        }
    }

    const edge = [];
    for (let x = 0; x < width; x++) {
        if (!BLOCKING.has(map[0][x])) edge.push(`(${x},0)`);
        if (!BLOCKING.has(map[height - 1][x])) edge.push(`(${x},${height - 1})`);
    }
    for (let y = 0; y < height; y++) {
        if (!BLOCKING.has(map[y][0])) edge.push(`(0,${y})`);
        if (!BLOCKING.has(map[y][width - 1])) edge.push(`(${width - 1},${y})`);
    }
    if (edge.length > 0) {
        errors.push({
            path,
            message: `El borde exterior tiene que ser todo muro. Se sale por: ${edge.slice(0, 6).join(' ')}${edge.length > 6 ? '…' : ''}.`,
        });
    }

    return { width, height };
}

/**
 * Whether a cell is inside the map and standable.
 *
 * @param {string[]} map
 * @param {{width: number, height: number}} size
 * @param {any} cell
 * @returns {'ok'|'outside'|'blocked'}
 */
function cellState(map, size, cell) {
    const x = Number(cell?.x);
    const y = Number(cell?.y);
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= size.width || y >= size.height) {
        return 'outside';
    }
    return BLOCKING.has(map[y][x]) ? 'blocked' : 'ok';
}

/**
 * Check a pack from end to end.
 *
 * The order of the checks follows the order a reader would notice them: the world, then
 * the people and the monsters, then the boards they stand on, then the quests that tie
 * the lot together.
 *
 * @param {any} raw A pack, normalised or not.
 * @returns {PackReport}
 */
export function validatePack(raw) {
    const { pack, repairs } = normalizePack(raw);
    /** @type {Issue[]} */
    const errors = [];
    /** @type {Issue[]} */
    const warnings = [];

    if (Number(pack.version) !== CAMPAIGN_PACK_VERSION) {
        warnings.push({
            path: 'version',
            message: `El paquete dice version ${pack.version} y el motor lee la ${CAMPAIGN_PACK_VERSION}. Puede que falten campos nuevos.`,
        });
    }

    if (!pack.world.name) errors.push({ path: 'world.name', message: 'El mundo necesita un nombre.' });
    if (pack.boards.length === 0) errors.push({ path: 'boards', message: 'Un paquete sin tableros no se puede jugar.' });

    // The Lorebook indexes entries by name: a second "Cuervo grande" would overwrite the
    // first, and the pack would import with one monster missing and no complaint.
    const seen = new Map();
    for (const [group, items] of [['bestiary', pack.bestiary], ['confidants', pack.confidants]]) {
        const names = new Set();
        items.forEach((/** @type {any} */ item, /** @type {number} */ index) => {
            const name = text(item.name);
            if (!name) {
                errors.push({ path: `${group}[${index}]`, message: 'Sin nombre: el importador indexa por nombre.' });
                return;
            }
            if (names.has(name.toLowerCase())) {
                errors.push({ path: `${group}[${index}]`, message: `"${name}" esta repetido: el segundo borraria al primero.` });
                return;
            }
            names.add(name.toLowerCase());
            seen.set(name.toLowerCase(), group);
        });
    }

    const bestiary = new Set(pack.bestiary.map((/** @type {any} */ e) => text(e.name).toLowerCase()).filter(Boolean));
    const allies = new Set(pack.confidants.map((/** @type {any} */ c) => text(c.name).toLowerCase()).filter(Boolean));
    const boardIds = new Set();
    /** @type {Map<string, {width: number, height: number, map: string[]}>} */
    const boardSizes = new Map();

    pack.boards.forEach((/** @type {any} */ board, /** @type {number} */ index) => {
        const path = `boards[${index}]`;
        if (boardIds.has(board.id)) {
            errors.push({ path: `${path}.id`, message: `El id "${board.id}" esta repetido.` });
        }
        boardIds.add(board.id);

        const size = checkMap(board.map, `${path}.map`, errors);
        boardSizes.set(board.id, { ...size, map: board.map });
        if (size.width === 0) return;

        if (board.partyStart.length === 0) {
            errors.push({ path: `${path}.partyStart`, message: 'Sin casillas de inicio: el grupo no sabria donde aparecer.' });
        }
        board.partyStart.forEach((/** @type {any} */ cell, /** @type {number} */ i) => {
            const state = cellState(board.map, size, cell);
            if (state === 'outside') {
                errors.push({ path: `${path}.partyStart[${i}]`, message: `(${cell?.x},${cell?.y}) cae fuera del mapa, que mide ${size.width}x${size.height}.` });
            } else if (state === 'blocked') {
                errors.push({ path: `${path}.partyStart[${i}]`, message: `(${cell.x},${cell.y}) cae sobre un muro: el grupo empezaria dentro de la pared.` });
            }
        });

        board.enemies.forEach((/** @type {any} */ enemy, /** @type {number} */ i) => {
            const name = text(enemy.name);
            if (!bestiary.has(name.toLowerCase())) {
                errors.push({ path: `${path}.enemies[${i}]`, message: `"${name}" no esta en el bestiario.` });
            }
            const state = cellState(board.map, size, enemy);
            if (state === 'outside') {
                errors.push({ path: `${path}.enemies[${i}]`, message: `(${enemy?.x},${enemy?.y}) cae fuera del mapa.` });
            } else if (state === 'blocked') {
                errors.push({ path: `${path}.enemies[${i}]`, message: `(${enemy.x},${enemy.y}) cae sobre un muro.` });
            }
        });
    });

    const usedBoards = new Set();
    let objectiveCount = 0;

    pack.quests.forEach((/** @type {any} */ quest, /** @type {number} */ index) => {
        const path = `quests[${index}]`;
        const boardId = text(quest.boardId);

        if (!boardId) {
            errors.push({ path: `${path}.boardId`, message: 'La mision no dice en que tablero se juega.' });
        } else if (!boardIds.has(boardId)) {
            errors.push({ path: `${path}.boardId`, message: `El tablero "${boardId}" no existe entre los tableros del paquete.` });
        } else {
            usedBoards.add(boardId);
        }

        const size = boardSizes.get(boardId);
        if (quest.objectives.length === 0) {
            warnings.push({ path: `${path}.objectives`, message: 'Una mision sin objetivos se gana limpiando el tablero.' });
        }

        quest.objectives.forEach((/** @type {any} */ objective, /** @type {number} */ i) => {
            const oPath = `${path}.objectives[${i}]`;
            objectiveCount++;
            const type = text(objective.type);

            if (!OBJECTIVE_TYPES[type]) {
                errors.push({ path: `${oPath}.type`, message: `"${type}" no es un tipo de objetivo. Los que hay: ${Object.keys(OBJECTIVE_TYPES).join(', ')}.` });
                return;
            }

            for (const field of OBJECTIVE_FIELDS[type] ?? []) {
                const value = objective[field.writes];

                if (field.kind === 'name') {
                    const name = text(value);
                    if (!name) {
                        errors.push({ path: `${oPath}.${field.writes}`, message: `Falta \`${field.writes}\`. ${field.help}` });
                        continue;
                    }
                    // `eliminate` points at the bestiary; `escort` and `protect` at the
                    // people you are keeping alive. Looking in the wrong list is the
                    // mistake, so the message says which list was searched.
                    const pool = field.engineField === 'allyId' ? allies : bestiary;
                    const where = field.engineField === 'allyId' ? 'confidants' : 'el bestiario';
                    if (!pool.has(name.toLowerCase())) {
                        const elsewhere = seen.get(name.toLowerCase());
                        errors.push({
                            path: `${oPath}.${field.writes}`,
                            message: elsewhere
                                ? `"${name}" no esta en ${where}: esta en \`${elsewhere}\`.`
                                : `"${name}" no esta en ${where}.`,
                        });
                    }
                } else if (field.kind === 'number') {
                    if (!Number.isFinite(Number(value)) || Number(value) <= 0) {
                        errors.push({ path: `${oPath}.${field.writes}`, message: `\`${field.writes}\` tiene que ser un numero mayor que cero.` });
                    }
                } else if (field.kind === 'cell') {
                    if (!size || size.width === 0) continue;
                    const state = cellState(size.map, size, value);
                    if (state === 'outside') {
                        errors.push({ path: `${oPath}.${field.writes}`, message: `(${value?.x},${value?.y}) cae fuera del tablero "${boardId}".` });
                    } else if (state === 'blocked') {
                        errors.push({ path: `${oPath}.${field.writes}`, message: `(${value.x},${value.y}) cae sobre un muro: nadie puede llegar ahi.` });
                    }
                }
            }
        });
    });

    for (const id of boardIds) {
        if (!usedBoards.has(id)) {
            warnings.push({ path: `boards.${id}`, message: `Ninguna mision lleva a "${id}": se puede entrar, pero nada te manda.` });
        }
    }

    return {
        ok: errors.length === 0,
        errors,
        warnings,
        repairs,
        counts: {
            world: pack.world.name,
            boards: pack.boards.length,
            enemies: pack.bestiary.length,
            confidants: pack.confidants.length,
            quests: pack.quests.length,
            objectives: objectiveCount,
        },
    };
}
