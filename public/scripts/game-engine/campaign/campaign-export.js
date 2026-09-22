/**
 * Empaquetar una campaña: el camino de vuelta del importador.
 *
 * Se podía **meter** el libro de otro y no se podía **mandar** el tuyo, que es media
 * historia de «sin marketplace»: compartir una campaña exigía pasar una carpeta de datos
 * entera y cruzar los dedos.
 *
 * Esto produce exactamente la misma forma que `campaign-pack.js` valida, así que lo que
 * sale por aquí entra por allí. Esa es la prueba que importa y la que se ejecuta: exportar
 * → validar → importar → contar lo mismo. Un exportador que escribe un formato parecido
 * pero no idéntico es peor que no tenerlo, porque el fallo aparece en casa de otro.
 *
 * Dos cosas no vuelven, y se dicen en voz alta en vez de fingirse:
 *
 * - **La estructura de misiones del libro.** Un tablero guarda los objetivos de todas las
 *   misiones que se juegan en él, sin marca de cuál era cuál. Se exporta una misión por
 *   tablero: al reimportar quedan los mismos objetivos en el mismo sitio.
 * - **Lo jugado.** Vida, posiciones, vínculos y día no son la campaña, son *tu* partida.
 *   Un paquete es el libro, no la sesión.
 *
 * Puro: recibe el mundo leído y devuelve el objeto. Quien lo guarde, que lo guarde.
 *
 * Ver wiki/POR_HACER.md, A2 · wiki/ROADMAP_INGESTA_CAMPANAS_LIBROS.md (G1).
 */

import { CAMPAIGN_PACK_VERSION, OBJECTIVE_FIELDS } from './campaign-pack-schema.js';
import { ASCII_TERRAIN, getCell } from '../board/terrain.js';
import { DEFAULT_PROFILE } from '../combat/enemy-ai.js';

/**
 * Del tipo de casilla al carácter que lo dibuja.
 *
 * Se construye dándole la vuelta a la misma tabla que lee los mapas, para que añadir un
 * tipo de terreno no deje al exportador escribiendo suelo donde había un muro.
 */
const CHAR_BY_CELL = Object.entries(ASCII_TERRAIN).reduce((map, [char, cell]) => {
    map[`${cell.type}:${cell.open === true}`] = char;
    return map;
}, /** @type {Record<string, string>} */ ({}));

/**
 * @param {any} value
 * @returns {string}
 */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * El carácter de una casilla, o suelo si su tipo no se dibuja.
 *
 * @param {any} cell
 * @returns {string}
 */
function charFor(cell) {
    if (!cell || cell.type === 'floor') return '.';
    return CHAR_BY_CELL[`${cell.type}:${cell.open === true}`]
        ?? CHAR_BY_CELL[`${cell.type}:false`]
        ?? '.';
}

/**
 * El mapa de un tablero, como las filas de texto que entiende el importador.
 *
 * @param {any} terrain
 * @param {number} width
 * @param {number} height
 * @returns {string[]}
 */
export function asciiFromTerrain(terrain, width, height) {
    const w = Math.max(0, Math.floor(Number(width) || 0));
    const h = Math.max(0, Math.floor(Number(height) || 0));

    const rows = [];
    for (let y = 0; y < h; y++) {
        let row = '';
        for (let x = 0; x < w; x++) row += charFor(getCell(terrain, x, y));
        rows.push(row);
    }
    return rows;
}

/**
 * Los nombres de las fichas del mundo, por uid.
 *
 * Los objetivos guardan uids porque es lo único estable dentro de una partida; un paquete
 * viaja a otra, donde esos uids no significan nada. Así que salen como nombres, que es
 * como el autor los escribió — el mismo cruce que hace el importador, al revés.
 *
 * @param {any} entries
 * @returns {Map<string, string>}
 */
function namesByUid(entries) {
    const map = new Map();
    for (const [uid, entry] of Object.entries(entries ?? {})) {
        const name = text(entry?.comment) || text(entry?.dndData?.name) || text(entry?.key?.[0]);
        if (name) map.set(String(uid), name);
    }
    return map;
}

/**
 * Un objetivo del motor, devuelto a los nombres con los que se escribió.
 *
 * @param {any} objective
 * @param {Map<string, string>} names
 * @returns {any}
 */
function objectiveToPack(objective, names) {
    const type = text(objective?.type);
    /** @type {any} */
    const out = { type, label: text(objective?.label) };
    if (objective?.optional) out.optional = true;

    for (const field of OBJECTIVE_FIELDS[type] ?? []) {
        const value = objective?.[field.engineField];

        if (field.kind === 'name') {
            const uid = Array.isArray(value) ? value[0] : value;
            const name = names.get(String(uid)) ?? text(objective?.[`${field.writes}Name`]);
            if (name) out[field.writes] = name;
        } else if (field.kind === 'names') {
            const list = (Array.isArray(value) ? value : [])
                .map(uid => names.get(String(uid)))
                .filter(Boolean);
            if (list.length > 0) out[field.writes] = list;
        } else if (field.kind === 'number') {
            if (value != null) out[field.writes] = Number(value) || 0;
        } else if (field.kind === 'cell') {
            if (value) out[field.writes] = { x: Number(value.x) || 0, y: Number(value.y) || 0 };
        }
    }

    return out;
}

/**
 * Una ficha del Lorebook, en la forma que el paquete le da a cada clase de cosa.
 *
 * @param {any} entry
 * @returns {string}
 */
function entityTypeOf(entry) {
    const explicit = text(entry?.dndData?.entityType).toLowerCase();
    if (explicit) return explicit;

    const group = text(entry?.group).toLowerCase();
    if (group.includes('monster')) return 'monster';
    if (group.includes('faction')) return 'faction';
    if (group.includes('character') || group.includes('npc')) return 'npc';
    return '';
}

/**
 * Empaqueta el mundo abierto.
 *
 * @param {Object} input
 * @param {string} input.worldName
 * @param {any} input.metadata El bloque `metadata` del Lorebook: localizaciones y tableros.
 * @param {any} input.entries Las fichas del Lorebook, por uid.
 * @param {string} [input.synopsis]
 * @returns {any} El paquete, listo para validar.
 */
export function buildPackFromWorld({ worldName, metadata, entries, synopsis = '' }) {
    const names = namesByUid(entries);

    /** @type {any[]} */
    const bestiary = [];
    /** @type {any[]} */
    const confidants = [];
    /** @type {any[]} */
    const factions = [];
    /** @type {any[]} */
    const loreEntries = [];

    for (const entry of Object.values(entries ?? {})) {
        const name = text(/** @type {any} */ (entry)?.comment) || text(/** @type {any} */ (entry)?.dndData?.name);
        if (!name) continue;
        const d = /** @type {any} */ (entry)?.dndData ?? {};
        const content = text(/** @type {any} */ (entry)?.content);

        switch (entityTypeOf(entry)) {
            case 'monster':
                bestiary.push({
                    name,
                    description: content,
                    hp: Number(d.maxHp ?? d.hp) || 1,
                    armorClass: Number(d.armorClass ?? d.ac) || 10,
                    cr: Number(d.cr) || 0,
                    speed: Number(d.speed) || 30,
                    profile: text(d.profile) || DEFAULT_PROFILE,
                    attackRangeFeet: Number(d.attackRangeFeet) || 5,
                });
                break;
            case 'npc':
            case 'character':
                confidants.push({
                    name,
                    description: content,
                    arcana: text(d.arcana),
                    initialBondPoints: Number(d.initialBondPoints) || 0,
                });
                break;
            case 'faction':
                factions.push({ name, goals: content, reputation: Number(d.reputation) || 0 });
                break;
            default:
                // Todo lo demás es lore: una ficha sin tipo sigue siendo algo que el libro
                // contaba, y tirarla al exportar sería perder parte del mundo.
                if (content) loreEntries.push({ key: name, content });
        }
    }

    /** @type {any[]} */
    const boards = [];
    /** @type {any[]} */
    const quests = [];
    /** @type {any[]} */
    const locations = [];

    for (const location of Array.isArray(metadata?.locationMaps) ? metadata.locationMaps : []) {
        // Todas, tengan tableros o no: un pueblo tranquilo es parte de la campaña, y si
        // solo se exportaran los sitios con tablero desaparecería al mandarla.
        const place = { name: text(location?.name) };
        if (text(location?.locationType)) place.type = text(location.locationType);
        if (text(location?.description)) place.description = text(location.description);
        if (text(location?.region)) place.region = text(location.region);
        if (text(location?.controllingFaction)) place.factionName = text(location.controllingFaction);
        if (place.name) locations.push(place);

        for (const board of Array.isArray(location?.boards) ? location.boards : []) {
            const width = Number(board?.gridWidth) || 0;
            const height = Number(board?.gridHeight) || 0;
            const id = text(board?.packBoardId) || text(board?.name).toLowerCase().replace(/[^a-z0-9]+/g, '_');

            boards.push({
                id,
                name: text(board?.name),
                locationName: text(location?.name),
                map: asciiFromTerrain(board?.terrain, width, height),
                partyStart: (Array.isArray(board?.partyStart) ? board.partyStart : [])
                    .map((/** @type {any} */ c) => ({ x: Number(c?.x) || 0, y: Number(c?.y) || 0 })),
                enemies: (Array.isArray(board?.enemyPlacements) ? board.enemyPlacements : [])
                    .map((/** @type {any} */ e) => ({ name: text(e?.name), x: Number(e?.x) || 0, y: Number(e?.y) || 0 })),
            });

            const objectives = (Array.isArray(board?.objectives) ? board.objectives : [])
                .map((/** @type {any} */ o) => objectiveToPack(o, names));
            if (objectives.length > 0) {
                quests.push({
                    id: `q_${id}`,
                    name: text(board?.name),
                    description: text(board?.description),
                    boardId: id,
                    objectives,
                });
            }
        }
    }

    return {
        version: CAMPAIGN_PACK_VERSION,
        world: {
            name: text(worldName),
            synopsis: text(synopsis),
            factions,
            loreEntries,
        },
        confidants,
        bestiary,
        locations,
        boards,
        quests,
    };
}

/**
 * Lo que lleva el paquete, en una línea.
 *
 * @param {any} pack
 * @returns {string}
 */
export function describeExport(pack) {
    return [
        `"${pack?.world?.name ?? ''}"`,
        `${pack?.locations?.length ?? 0} localidad(es)`,
        `${pack?.boards?.length ?? 0} tablero(s)`,
        `${pack?.bestiary?.length ?? 0} enemigo(s)`,
        `${pack?.confidants?.length ?? 0} compañero(s)`,
        `${pack?.quests?.length ?? 0} misión(es)`,
    ].join(' · ');
}
