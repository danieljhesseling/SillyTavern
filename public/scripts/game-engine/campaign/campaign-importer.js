/**
 * From a campaign pack to a world you can play.
 *
 * The whole job turns on one ordering problem. The engine judges objectives with ids —
 * the uids of Lorebook entries — and picks enemies for a fight with ids too. A book
 * cannot possibly know those: they do not exist until the entries are created. So the
 * author writes **names**, and the resolution happens **after** the entries exist.
 *
 * That order is not a detail. Getting it wrong already cost this project a working
 * feature once: the campaign wizard wrote every board with an empty encounter list
 * because the monster ids were not created yet, and `/fight` found no enemies in any new
 * campaign. Every test passed. The fix was to write the rules after creating the entries,
 * and this module is built around that shape from the start.
 *
 * Split in two on purpose:
 *
 * - `buildImportPlan` is **pure**: pack in, world metadata and entry specs out, with the
 *   places that need ids marked rather than filled.
 * - `importPack` does the writing, with its dependencies injected, and calls
 *   `resolveNames` once the ids are known.
 *
 * See wiki/ROADMAP_INGESTA_CAMPANAS_LIBROS.md (G3) · wiki/POR_HACER.md.
 */

import { terrainFromAsciiMap } from '../board/terrain.js';
import { DEFAULT_PROFILE } from '../combat/enemy-ai.js';

/** Lo que mide la vista de una localizacion, igual que en una campana nueva. */
const DEFAULT_LOCATION_GRID = 50;
import { deriveRooms } from './campaign-map.js';
import { OBJECTIVE_FIELDS } from './campaign-pack-schema.js';
import { normalizePack } from './campaign-pack.js';

/**
 * @typedef {Object} EntrySpec
 * @property {string} group Lorebook group: Characters, Monsters, Lore, Factions.
 * @property {string} title
 * @property {string} content
 * @property {string[]} keys
 * @property {any} [dndData]
 */

/**
 * @typedef {Object} ImportPlan
 * @property {any} metadata World metadata, with the boards drawn and the objectives
 *   written in the author's names, waiting to be resolved.
 * @property {EntrySpec[]} entries
 * @property {Record<string, string[]>} enemiesByBoard Board id to the enemy names on it,
 *   in the order they were placed.
 * @property {{locations: number, boards: number, entries: number, quests: number, placements: number}} counts
 */

/**
 * @param {any} value
 * @returns {string}
 */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * Which location a board belongs to, for the party's starting position.
 *
 * @param {Map<string, any>} locations
 * @param {any} board
 * @returns {string}
 */
function locationNameOf(locations, board) {
    for (const [name, location] of locations) {
        if (location.boards.includes(board)) return name;
    }
    return '';
}

/**
 * El nombre del tablero donde se juega una mision.
 *
 * El paquete apunta al tablero por `id`, pero el mundo guardado no tiene ids: los
 * tableros viven dentro de su localidad y se llaman por su nombre. Traducirlo aqui es lo
 * que hace que una mision importada siga sabiendo donde se juega.
 *
 * @param {any} pack
 * @param {string} boardId
 * @returns {string}
 */
function boardNameOf(pack, boardId) {
    if (!boardId) return '';
    const board = (Array.isArray(pack?.boards) ? pack.boards : [])
        .find(b => text(b?.id) === boardId);
    return text(board?.name);
}

/**
 * The Lorebook entries a pack implies: its companions, its monsters, its lore and its
 * factions.
 *
 * Returned as descriptions rather than written here, so the caller owns the Lorebook and
 * this stays testable — the same split the starter templates use.
 *
 * @param {any} pack A normalised pack.
 * @returns {EntrySpec[]}
 */
export function buildPackEntries(pack) {
    /** @type {EntrySpec[]} */
    const entries = [];

    for (const person of pack.confidants) {
        const name = text(person.name);
        if (!name) continue;
        entries.push({
            group: 'Characters',
            title: name,
            content: text(person.description) || name,
            keys: [name],
            dndData: {
                entityType: 'npc',
                name,
                arcana: text(person.arcana),
                initialBondPoints: Number(person.initialBondPoints) || 0,
            },
        });
    }

    for (const enemy of pack.bestiary) {
        const name = text(enemy.name);
        if (!name) continue;
        entries.push({
            group: 'Monsters',
            title: name,
            content: text(enemy.description) || name,
            keys: [name],
            dndData: {
                entityType: 'monster',
                name,
                hp: Number(enemy.hp) || 1,
                maxHp: Number(enemy.hp) || 1,
                armorClass: Number(enemy.armorClass) || 10,
                cr: Number(enemy.cr) || 0,
                speed: Number(enemy.speed) || 30,
                // `brute` no es un perfil del motor — lo era en el diseño, nunca en el
                // código — y enemy-ai lo tomaba por desconocido y lo jugaba como
                // `aggressive` sin decir nada. Ahora se escribe el que de verdad se juega.
                profile: text(enemy.profile) || DEFAULT_PROFILE,
                attackRangeFeet: Number(enemy.attackRangeFeet) || 5,
            },
        });
    }

    for (const lore of pack.world.loreEntries) {
        const key = text(lore.key);
        if (!key) continue;
        entries.push({
            group: 'Lore',
            title: key,
            content: text(lore.content),
            keys: [key],
        });
    }

    for (const faction of pack.world.factions) {
        const name = text(faction.name);
        if (!name) continue;
        entries.push({
            group: 'Factions',
            title: name,
            content: text(faction.goals) || name,
            keys: [name],
            dndData: { entityType: 'faction', name, reputation: Number(faction.reputation) || 0 },
        });
    }

    return entries;
}

/**
 * The objectives of a quest, in the engine's shape but still holding the author's names.
 *
 * The fields that need an id are written as `pendingName`, so `resolveNames` knows what
 * to look up and, just as importantly, so an unresolved one is visible instead of being
 * an innocent-looking empty array.
 *
 * @param {any} quest
 * @returns {any[]}
 */
function buildObjectives(quest) {
    return quest.objectives.map((/** @type {any} */ objective, /** @type {number} */ index) => {
        const type = text(objective.type);
        /** @type {any} */
        const built = {
            id: text(objective.id) || `${quest.id}_o${index + 1}`,
            type,
            label: text(objective.label) || type,
            optional: Boolean(objective.optional),
        };

        for (const field of OBJECTIVE_FIELDS[type] ?? []) {
            const value = objective[field.writes];
            if (field.kind === 'name') {
                built.pendingName = built.pendingName ?? {};
                built.pendingName[field.engineField] = text(value);
            } else {
                built[field.engineField] = value;
            }
        }

        return built;
    });
}

/**
 * Turn a validated pack into the world metadata and the entries it implies.
 *
 * Pure: nothing here touches the Lorebook, and nothing here knows an id.
 *
 * @param {any} raw A pack; it is normalised on the way in.
 * @param {{party?: string[]}} [options] The player's own characters, who are not in the
 *   pack: a book brings the people you meet, not the people you bring.
 * @returns {ImportPlan}
 */
export function buildImportPlan(raw, options = {}) {
    const { pack } = normalizePack(raw);

    /** @type {Record<string, any[]>} */
    const questsByBoard = {};
    for (const quest of pack.quests) {
        const boardId = text(quest.boardId);
        (questsByBoard[boardId] = questsByBoard[boardId] ?? []).push(quest);
    }

    /** @type {Record<string, string[]>} */
    const enemiesByBoard = {};
    /** @type {Map<string, any>} */
    const locations = new Map();
    let placements = 0;

    // Primero las que el paquete declara, y en su orden. Antes las localidades se
    // deducian **solo** de los tableros, asi que un sitio sin tablero no llegaba a
    // existir: una aldea donde solo se habla y se comercia era inexpresable. Las que solo
    // aparezcan nombradas por un tablero se siguen deduciendo, justo debajo.
    for (const place of pack.locations) {
        const name = text(place.name);
        if (!name || locations.has(name)) continue;
        locations.set(name, {
            name,
            description: text(place.description) || text(pack.world.synopsis),
            url: '',
            // A cero: si la localidad acaba teniendo tableros, la vista crece con el mas
            // grande, como siempre. Las que se queden sin ninguno toman el tamano de una
            // campana nueva, mas abajo.
            gridWidth: 0,
            gridHeight: 0,
            region: text(place.region),
            locationType: text(place.type),
            controllingFaction: text(place.factionName),
            boards: [],
        });
    }

    for (const board of pack.boards) {
        const locationName = text(board.locationName) || text(pack.world.name);
        const height = board.map.length;
        const width = height > 0 ? board.map[0].length : 0;
        const quests = questsByBoard[board.id] ?? [];

        enemiesByBoard[board.id] = board.enemies.map((/** @type {any} */ e) => text(e.name)).filter(Boolean);
        placements += board.enemies.length;

        if (!locations.has(locationName)) {
            locations.set(locationName, {
                name: locationName,
                description: text(pack.world.synopsis),
                url: '',
                gridWidth: width,
                gridHeight: height,
                boards: [],
            });
        }

        const location = locations.get(locationName);
        location.gridWidth = Math.max(location.gridWidth, width);
        location.gridHeight = Math.max(location.gridHeight, height);

        const terrain = terrainFromAsciiMap(board.map);
        const partyStart = board.partyStart.map((/** @type {any} */ c) => ({ x: Number(c.x) || 0, y: Number(c.y) || 0 }));

        location.boards.push({
            name: board.name,
            description: quests.map((/** @type {any} */ q) => text(q.description)).filter(Boolean).join(' '),
            url: '',
            gridWidth: width,
            gridHeight: height,
            isCombat: board.enemies.length > 0,
            // One board holds the objectives of every quest played on it. A book that
            // splits a room into two missions is describing two goals in one place.
            objectives: quests.flatMap(buildObjectives),
            terrain,
            // Las salas salen del propio mapa: el libro las dibuja, no las describe. Lo
            // que hay detras de una puerta cerrada no se sabe hasta abrirla, que es como
            // se marca el ritmo de una mazmorra.
            rooms: deriveRooms(terrain, width, height, { revealFrom: partyStart }),
            fogEnabled: false,
            npcPlacements: [],
            encounterRules: [],
            // Where the pack says each creature stands. Kept as written so the fight can
            // set them down where the book drew them.
            enemyPlacements: board.enemies.map((/** @type {any} */ e) => ({
                name: text(e.name), x: Number(e.x) || 0, y: Number(e.y) || 0,
            })),
            partyStart,
            packBoardId: board.id,
        });
    }

    // Un sitio sin tableros no tiene de donde sacar su tamano: se le da el de una
    // campana nueva, que es lo que espera la vista de localizacion.
    for (const location of locations.values()) {
        if (!location.gridWidth) location.gridWidth = DEFAULT_LOCATION_GRID;
        if (!location.gridHeight) location.gridHeight = DEFAULT_LOCATION_GRID;
    }

    // The party stands on the first board's starting cells, the same way a template
    // campaign does. Without this an imported world opens with nobody on it. They go
    // first, in the order they were named.
    const first = [...locations.values()][0]?.boards?.[0] ?? null;
    const names = (Array.isArray(options.party) ? options.party : [])
        .map(name => text(name)).filter(Boolean);

    /** @type {EntrySpec[]} */
    const partySpecs = [];
    names.forEach((name, index) => {
        const start = first?.partyStart?.[index] ?? first?.partyStart?.[0] ?? { x: 1, y: 1 };
        partySpecs.push({
            group: 'Characters',
            title: name,
            content: `${name} forma parte del grupo.`,
            keys: [name],
            dndData: {
                entityType: 'character',
                name,
                mapPosition: { locationName: first ? locationNameOf(locations, first) : '', gridX: start.x, gridY: start.y },
            },
        });
    });

    const entries = [...partySpecs, ...buildPackEntries(pack)];

    return {
        metadata: {
            displayName: text(pack.world.name),
            genre: text(pack.world.genre),
            description: text(pack.world.synopsis),
            worldMapUrl: '',
            locationMaps: [...locations.values()],
            boards: [],
            packVersion: pack.version,
            // El catalogo del mundo: los objetos que existen antes de que nadie los lleve
            // encima. De aqui sale el botin, asi que entra con el mundo y no en fichas.
            itemCatalogue: (Array.isArray(pack.items) ? pack.items : [])
                .filter(item => text(item?.name))
                .map(item => ({
                    name: text(item.name),
                    type: ['weapon', 'armor', 'gear'].includes(text(item.type)) ? text(item.type) : 'gear',
                    rarity: text(item.rarity) || 'Common',
                    weight: Number(item.weight) || 0,
                    damageDice: text(item.damageDice),
                    damageType: text(item.damageType),
                    slot: text(item.slot),
                    description: text(item.description),
                })),
            // Las misiones, como cosa propia y no como el nombre de un tablero. El motor
            // ya las sabe encadenar; hasta ahora nadie podia escribirlas.
            quests: pack.quests
                .filter((/** @type {any} */ quest) => text(quest?.name))
                .map((/** @type {any} */ quest) => ({
                    id: text(quest.id),
                    name: text(quest.name),
                    description: text(quest.description),
                    act: Math.max(1, Math.floor(Number(quest.act) || 1)),
                    boardName: boardNameOf(pack, text(quest.boardId)),
                })),
        },
        entries,
        enemiesByBoard,
        counts: {
            locations: locations.size,
            boards: pack.boards.length,
            entries: entries.length,
            quests: pack.quests.length,
            placements,
        },
    };
}

/**
 * Fill in every id, now that the entries exist.
 *
 * This is the step the whole module is shaped around, and the one that has to run
 * **after** the Lorebook write. It reports what it could not resolve instead of leaving
 * an empty field behind: an objective quietly pointing at nobody is a mission that can
 * never be completed and never explains itself.
 *
 * @param {ImportPlan} plan
 * @param {Record<string, string>} idsByName Entry title to uid.
 * @returns {{metadata: any, unresolved: string[]}}
 */
export function resolveNames(plan, idsByName) {
    const ids = new Map(Object.entries(idsByName ?? {}).map(([name, id]) => [name.toLowerCase(), String(id)]));
    /** @type {string[]} */
    const unresolved = [];
    const idOf = (/** @type {string} */ name) => ids.get(String(name).toLowerCase()) ?? '';

    for (const location of plan.metadata.locationMaps) {
        for (const board of location.boards) {
            const names = plan.enemiesByBoard[board.packBoardId] ?? [];

            // One rule per distinct creature, with the count the book drew. A board with
            // three crows should field three crows, not "between one and two".
            /** @type {Map<string, number>} */
            const counts = new Map();
            for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);

            board.encounterRules = [...counts.entries()].map(([name, count]) => {
                const enemyId = idOf(name);
                if (!enemyId) unresolved.push(`enemigo "${name}" del tablero "${board.name}"`);
                return enemyId ? { enemyId, minCount: count, maxCount: count } : null;
            }).filter(Boolean);

            for (const objective of board.objectives) {
                if (!objective.pendingName) continue;
                for (const [engineField, name] of Object.entries(objective.pendingName)) {
                    const id = idOf(/** @type {string} */ (name));
                    if (!id) {
                        unresolved.push(`"${name}" del objetivo "${objective.label}"`);
                        continue;
                    }
                    // `targetIds` is a list because an objective can name several; the
                    // contract lets a book name one, which is the common case.
                    objective[engineField] = engineField.endsWith('Ids') ? [id] : id;
                }
                delete objective.pendingName;
            }
        }
    }

    return { metadata: plan.metadata, unresolved };
}

/**
 * Import a pack into a new world.
 *
 * Every dependency is injected, so the order of operations — create the world, write the
 * entries, **then** resolve the names — is what gets tested, not the Lorebook.
 *
 * @param {Object} input
 * @param {any} input.pack
 * @param {string} input.worldName
 * @param {string[]} [input.party] The player's own characters.
 * @param {(name: string) => Promise<any>} input.createWorld
 * @param {(name: string) => Promise<any>} input.loadWorld
 * @param {(name: string, data: any) => Promise<any>} input.saveWorld
 * @param {(name: string, data: any) => any} input.createEntry
 * @returns {Promise<{worldName: string, party: string[], partyEntries: any[], locationName: string, boardName: string, counts: any, unresolved: string[]}>}
 */
export async function importPack({ pack, worldName, party = [], createWorld, loadWorld, saveWorld, createEntry }) {
    const plan = buildImportPlan(pack, { party });

    const created = await createWorld(worldName);
    if (created === false) {
        throw new Error(`No se pudo crear el mundo "${worldName}". Puede que ya exista uno con un nombre casi idéntico.`);
    }

    const data = await loadWorld(worldName);
    if (!data) throw new Error(`No se pudo cargar el mundo "${worldName}".`);

    /** @type {Record<string, string>} */
    const idsByName = {};
    /** @type {any[]} */
    const partyEntries = [];
    for (const spec of plan.entries) {
        const entry = createEntry(worldName, data);
        if (!entry) continue;
        entry.comment = spec.title;
        entry.key = spec.keys;
        entry.content = spec.content;
        entry.group = spec.group;
        if (spec.dndData) entry.dndData = spec.dndData;
        if (spec.dndData?.entityType === 'character') partyEntries.push(entry);
        idsByName[spec.title] = String(entry.uid);
    }

    // Only now are the ids known. Doing this any earlier is the bug this module exists
    // to avoid.
    const { metadata, unresolved } = resolveNames(plan, idsByName);
    data.metadata = Object.assign(data.metadata ?? {}, metadata);

    await saveWorld(worldName, data);

    const location = metadata.locationMaps[0];
    return {
        worldName,
        party: partyEntries.map(entry => entry.comment),
        partyEntries,
        locationName: location?.name ?? '',
        boardName: location?.boards?.[0]?.name ?? '',
        counts: plan.counts,
        unresolved,
    };
}
