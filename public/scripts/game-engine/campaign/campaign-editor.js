/**
 * El editor de campaña: escribir a mano lo que hasta ahora solo traía un libro.
 *
 * El agujero que cierra, dicho en corto: **se puede leer todo y no se puede escribir casi
 * nada**. Una campaña se crea de una plantilla, de la IA o de un paquete importado, y a
 * partir de ahí el mundo está congelado: no hay forma de añadir una localidad, dibujar un
 * tablero nuevo o cambiar la sinopsis sin editar el Lorebook a mano.
 *
 * La regla que lo ordena: **un destino, dos puertas.** Lo que escribe este editor tiene
 * que ser exactamente lo que escribe el importador, o acabaríamos con campañas importadas
 * que se juegan enteras y campañas hechas a mano a las que les falta la mitad. Por eso los
 * campos son los del contrato y no otros.
 *
 * Puro: lee el mundo, devuelve el mundo. Ni guarda, ni dibuja, ni pregunta nada.
 *
 * Ver wiki/PLAN_CREAR_CAMPANA.md, M1 y M2.
 */

import { LOCATION_TYPES, BOARD_LIMITS } from './campaign-pack-schema.js';
import { terrainFromAsciiMap } from '../board/terrain.js';
import { DEFAULT_PROFILE, getProfileOptions } from '../combat/enemy-ai.js';

/** Lo que mide una localidad sin tableros, igual que en el importador. */
const DEFAULT_LOCATION_GRID = 50;

/**
 * @typedef {Object} EditorBoard
 * @property {string} name
 * @property {string} description
 * @property {number} gridWidth
 * @property {number} gridHeight
 * @property {Array<{x: number, y: number}>} partyStart
 * @property {Array<{name: string, x: number, y: number}>} enemyPlacements
 */

/**
 * @typedef {Object} EditorLocation
 * @property {string} name
 * @property {string} type
 * @property {string} description
 * @property {string} region
 * @property {string} factionName
 * @property {EditorBoard[]} boards
 */

/**
 * @typedef {Object} EditorItem
 * @property {string} name
 * @property {string} type weapon, armor o gear.
 * @property {string} rarity Decide en que peldano del botin cae.
 * @property {number} weight
 * @property {string} damageDice
 * @property {string} damageType
 * @property {string} slot
 * @property {string} description
 */

/**
 * @typedef {Object} EditorQuest
 * @property {string} name
 * @property {string} description
 * @property {number} act
 * @property {string} boardName Donde se juega.
 */

/**
 * @typedef {Object} EditorModel
 * @property {{displayName: string, genre: string, description: string}} world
 * @property {EditorLocation[]} locations
 * @property {EditorCharacter[]} characters
 * @property {any[]} bestiary
 * @property {any[]} factions
 * @property {EditorItem[]} items
 * @property {EditorQuest[]} quests
 * @property {Array<{item: string, to: string}>} [gifts] Lo que se regala al guardar.
 */

/**
 * @param {any} value
 * @returns {string}
 */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * @typedef {Object} EditorCharacter
 * @property {string} uid Vacio si todavia no existe en el Lorebook.
 * @property {'character'|'npc'} kind Del grupo, o del mundo.
 * @property {any} raw Su dndData tal cual estaba: lo que no se edita se conserva.
 * @property {string} name
 * @property {string} title
 * @property {string} className
 * @property {number} level
 * @property {string} race
 * @property {number} maxHp
 * @property {number} armorClass
 * @property {number} speed
 * @property {Record<string, number>} abilities Las seis, por su nombre en la ficha.
 * @property {string} locationName Donde esta.
 * @property {string} backstory
 * @property {string} personality
 * @property {string} arcana
 * @property {number} initialBondPoints
 * @property {string} image
 * @property {string[]} keys Las palabras que lo despiertan en el chat.
 */

/**
 * Las seis caracteristicas, con el nombre corto que de verdad lee la ficha del grupo.
 *
 * `party.js` escribe `str`, `dex`, `con`... y lee eso mismo al montar al personaje. Usar
 * aqui los nombres largos daria un editor que enseña 10 en todo y guarda en un sitio que
 * nadie mira: el clasico campo que parece que funciona.
 */
export const ABILITY_FIELDS = [
    ['str', 'Fuerza'], ['dex', 'Destreza'], ['con', 'Constitucion'],
    ['int', 'Inteligencia'], ['wis', 'Sabiduria'], ['cha', 'Carisma'],
];

/** El nombre largo del que tambien se acepta leer, por si la ficha vino de otro sitio. */
const ABILITY_ALIASES = {
    str: 'strength', dex: 'dexterity', con: 'constitution',
    int: 'intelligence', wis: 'wisdom', cha: 'charisma',
};

/**
 * @param {any} value
 * @param {number} fallback
 * @returns {number}
 */
function number(value, fallback) {
    const parsed = Math.floor(Number(value));
    return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Una ficha del Lorebook leida como personaje del mundo.
 *
 * @param {string} uid
 * @param {any} entry
 * @returns {EditorCharacter}
 */
function readCharacter(uid, entry, kind) {
    const d = entry?.dndData ?? {};
    /** @type {Record<string, number>} */
    const abilities = {};
    for (const [key] of ABILITY_FIELDS) {
        abilities[key] = number(d[key] ?? d[ABILITY_ALIASES[key]], 10);
    }

    // De donde sale "donde esta": el grupo lo guarda dentro de `mapPosition`, que ademas
    // lleva la casilla. Un NPC importado solo tiene `locationName`.
    const position = (d.mapPosition && typeof d.mapPosition === 'object') ? d.mapPosition : {};

    return {
        uid: String(uid),
        kind,
        raw: d,
        name: text(entry?.comment) || text(d.name),
        title: text(d.title),
        className: text(d.charClass ?? d.class),
        level: Math.max(1, number(d.level, 1)),
        race: text(d.race),
        maxHp: Math.max(1, number(d.maxHp ?? d.hp, 10)),
        armorClass: Math.max(1, number(d.ac ?? d.armorClass, 10)),
        speed: Math.max(0, number(d.speed, 30)),
        abilities,
        locationName: text(position.locationName ?? d.locationName ?? d.location),
        backstory: text(d.backstory),
        personality: text(d.personality),
        arcana: text(d.arcana),
        initialBondPoints: Math.max(0, number(d.initialBondPoints, 0)),
        image: text(d.image ?? d.avatar),
        keys: (Array.isArray(entry?.key) ? entry.key : []).map(text).filter(Boolean),
    };
}

/**
 * Lo que el editor enseña, sacado del mundo tal y como está guardado.
 *
 * Solo trae lo que se edita. Lo que no aparece aquí — el terreno, las salas, los objetivos
 * — se queda intacto en su sitio, porque tiene sus propios editores y pisarlo desde aquí
 * sería perderlo.
 *
 * @param {any} metadata
 * @returns {EditorModel}
 */
export function buildEditorModel(metadata, entries = {}) {
    const source = (metadata && typeof metadata === 'object') ? metadata : {};
    const fichas = Object.entries((entries && typeof entries === 'object') ? entries : {});

    /** A que grupo pertenece una ficha, mirando primero lo que ella misma declara. */
    const kindOf = (/** @type {any} */ entry) => {
        const explicit = text(entry?.dndData?.entityType).toLowerCase();
        if (explicit) return explicit;
        const group = text(entry?.group).toLowerCase();
        if (group.includes('monster')) return 'monster';
        if (group.includes('faction')) return 'faction';
        // Un grupo "Characters" sin `entityType` es del grupo para `party.js`, y aqui
        // tiene que serlo tambien: si no, editarlo lo echaria de la partida.
        if (group.includes('character')) return 'character';
        if (group.includes('npc')) return 'npc';
        return '';
    };

    return {
        world: {
            displayName: text(source.displayName),
            genre: text(source.genre),
            description: text(source.description),
        },
        locations: (Array.isArray(source.locationMaps) ? source.locationMaps : []).map(location => ({
            name: text(location?.name),
            type: LOCATION_TYPES.includes(text(location?.locationType)) ? text(location.locationType) : '',
            description: text(location?.description),
            region: text(location?.region),
            factionName: text(location?.controllingFaction),
            boards: (Array.isArray(location?.boards) ? location.boards : []).map(board => ({
                name: text(board?.name),
                description: text(board?.description),
                gridWidth: Math.max(0, Math.floor(Number(board?.gridWidth) || 0)),
                gridHeight: Math.max(0, Math.floor(Number(board?.gridHeight) || 0)),
                partyStart: (Array.isArray(board?.partyStart) ? board.partyStart : [])
                    .map((/** @type {any} */ c) => ({ x: Number(c?.x) || 0, y: Number(c?.y) || 0 })),
                enemyPlacements: (Array.isArray(board?.enemyPlacements) ? board.enemyPlacements : [])
                    .map((/** @type {any} */ e) => ({
                        name: text(e?.name), x: Number(e?.x) || 0, y: Number(e?.y) || 0,
                    })),
            })),
        })),
        characters: fichas
            .filter(([, entry]) => ['npc', 'character'].includes(kindOf(entry)))
            .map(([uid, entry]) => readCharacter(
                uid, entry, kindOf(entry) === 'character' ? 'character' : 'npc')),
        bestiary: fichas
            .filter(([, entry]) => kindOf(entry) === 'monster')
            .map(([uid, entry]) => {
                const d = /** @type {any} */ (entry)?.dndData ?? {};
                const profiles = getProfileOptions().map(([value]) => String(value));
                return {
                    uid: String(uid),
                    raw: d,
                    name: text(/** @type {any} */ (entry)?.comment) || text(d.name),
                    description: text(/** @type {any} */ (entry)?.content),
                    hp: Math.max(1, number(d.maxHp ?? d.hp, 10)),
                    armorClass: Math.max(1, number(d.armorClass ?? d.ac, 10)),
                    cr: Number(d.cr) || 0,
                    speed: Math.max(0, number(d.speed, 30)),
                    attackRangeFeet: Math.max(5, number(d.attackRangeFeet, 5)),
                    profile: profiles.includes(text(d.profile)) ? text(d.profile) : DEFAULT_PROFILE,
                };
            }),
        factions: fichas
            .filter(([, entry]) => kindOf(entry) === 'faction')
            .map(([uid, entry]) => ({
                uid: String(uid),
                raw: /** @type {any} */ (entry)?.dndData ?? {},
                name: text(/** @type {any} */ (entry)?.comment) || text(/** @type {any} */ (entry)?.dndData?.name),
                goals: text(/** @type {any} */ (entry)?.content),
                reputation: number(/** @type {any} */ (entry)?.dndData?.reputation, 0),
            })),
        items: (Array.isArray(source.itemCatalogue) ? source.itemCatalogue : []).map(item => ({
            name: text(item?.name),
            type: ['weapon', 'armor', 'gear'].includes(text(item?.type)) ? text(item.type) : 'gear',
            category: text(item?.category),
            rarity: text(item?.rarity) || 'Common',
            weight: Number(item?.weight) || 0,
            damageDice: text(item?.damageDice),
            damageType: text(item?.damageType),
            slot: text(item?.slot),
            description: text(item?.description),
        })),
        quests: (Array.isArray(source.quests) ? source.quests : []).map(quest => ({
            name: text(quest?.name),
            description: text(quest?.description),
            act: Math.max(1, number(quest?.act, 1)),
            boardName: text(quest?.boardName),
        })),
    };
}

/**
 * Un mapa vacío con el borde de muro puesto.
 *
 * El borde no es decoración: el validador lo exige, y un tablero abierto por fuera deja
 * al grupo andando sobre la nada. Poniéndolo desde el principio, un tablero recién creado
 * ya es válido.
 *
 * @param {number} width
 * @param {number} height
 * @returns {string[]}
 */
export function blankMap(width, height) {
    const w = Math.max(BOARD_LIMITS.minWidth, Math.min(BOARD_LIMITS.maxWidth, Math.floor(Number(width) || 0)));
    const h = Math.max(BOARD_LIMITS.minHeight, Math.min(BOARD_LIMITS.maxHeight, Math.floor(Number(height) || 0)));

    const rows = [];
    for (let y = 0; y < h; y++) {
        rows.push(y === 0 || y === h - 1 ? '#'.repeat(w) : `#${'.'.repeat(w - 2)}#`);
    }
    return rows;
}

/**
 * Un tablero nuevo, listo para pintarle el terreno encima.
 *
 * @param {string} name
 * @param {number} width
 * @param {number} height
 * @returns {any}
 */
export function createBoard(name, width, height) {
    const map = blankMap(width, height);

    return {
        name: text(name) || 'Tablero',
        description: '',
        url: '',
        gridWidth: map[0].length,
        gridHeight: map.length,
        isCombat: false,
        objectives: [],
        terrain: terrainFromAsciiMap(map),
        fogEnabled: false,
        npcPlacements: [],
        encounterRules: [],
        // El grupo empieza dentro, en la primera casilla de suelo: un tablero sin sitio
        // donde ponerse no se puede jugar, y es el fallo que más comete un libro.
        partyStart: [{ x: 1, y: 1 }],
        enemyPlacements: [],
    };
}

/**
 * Una localidad nueva, con o sin tableros.
 *
 * @param {string} name
 * @returns {any}
 */
export function createLocation(name) {
    return {
        name: text(name) || 'Sitio nuevo',
        description: '',
        url: '',
        gridWidth: DEFAULT_LOCATION_GRID,
        gridHeight: DEFAULT_LOCATION_GRID,
        region: '',
        locationType: '',
        controllingFaction: '',
        boards: [],
    };
}

/**
 * Lo que impide guardar, dicho entero y no de uno en uno.
 *
 * @param {EditorModel} model
 * @returns {string[]}
 */
export function validateModel(model) {
    /** @type {string[]} */
    const errors = [];

    const places = new Set();
    /** Los tableros de todo el mundo, que es donde una mision puede decir que se juega. */
    const playable = new Set();
    for (const location of model.locations) {
        const name = text(location.name);
        if (!name) {
            errors.push('Hay una localidad sin nombre: el mundo las indexa por nombre.');
            continue;
        }
        if (places.has(name.toLowerCase())) {
            errors.push(`"${name}" está repetida: la segunda borraría a la primera.`);
            continue;
        }
        places.add(name.toLowerCase());

        const boards = new Set();
        for (const board of location.boards) {
            const boardName = text(board.name);
            if (!boardName) {
                errors.push(`En "${name}" hay un tablero sin nombre.`);
                continue;
            }
            if (boards.has(boardName.toLowerCase())) {
                errors.push(`En "${name}", el tablero "${boardName}" está repetido.`);
                continue;
            }
            boards.add(boardName.toLowerCase());
            playable.add(boardName.toLowerCase());

            if (board.gridWidth < BOARD_LIMITS.minWidth || board.gridWidth > BOARD_LIMITS.maxWidth
                || board.gridHeight < BOARD_LIMITS.minHeight || board.gridHeight > BOARD_LIMITS.maxHeight) {
                errors.push(`"${boardName}" mide ${board.gridWidth}x${board.gridHeight}: `
                    + `tiene que estar entre ${BOARD_LIMITS.minWidth}x${BOARD_LIMITS.minHeight} `
                    + `y ${BOARD_LIMITS.maxWidth}x${BOARD_LIMITS.maxHeight}.`);
            }

            if (board.partyStart.length === 0) {
                errors.push(`"${boardName}" no dice dónde empieza el grupo, así que no se puede jugar.`);
            }

            for (const cell of [...board.partyStart, ...board.enemyPlacements]) {
                if (cell.x < 0 || cell.y < 0 || cell.x >= board.gridWidth || cell.y >= board.gridHeight) {
                    errors.push(`En "${boardName}", la casilla (${cell.x + 1}, ${cell.y + 1}) cae fuera del mapa.`);
                }
            }
        }
    }

    const seenPeople = new Set();
    for (const person of model.characters ?? []) {
        const name = text(person.name);
        if (!name) {
            errors.push('Hay un personaje sin nombre: el Lorebook indexa por nombre.');
            continue;
        }
        if (seenPeople.has(name.toLowerCase())) {
            errors.push(`El personaje "${name}" esta repetido: el segundo borraria al primero.`);
        }
        seenPeople.add(name.toLowerCase());

        const place = text(person.locationName);
        if (place && !places.has(place.toLowerCase())) {
            errors.push(`"${name}" dice estar en "${place}", que no es una localidad de este mundo.`);
        }
    }

    const seenBeasts = new Set();
    for (const enemy of model.bestiary ?? []) {
        const name = text(enemy.name);
        if (!name) {
            errors.push('Hay un enemigo sin nombre: el Lorebook indexa por nombre.');
            continue;
        }
        if (seenBeasts.has(name.toLowerCase()) || seenPeople.has(name.toLowerCase())) {
            errors.push(`"${name}" esta repetido entre las fichas del mundo.`);
        }
        seenBeasts.add(name.toLowerCase());
    }

    for (const quest of model.quests ?? []) {
        if (!text(quest.name)) {
            errors.push('Hay una mision sin nombre.');
            continue;
        }
        // Una mision se juega en un tablero: es lo que pide el contrato, y sin el la
        // campana exporta rota. Mejor no dejar guardarla que descubrirlo al mandarla.
        const board = text(quest.boardName);
        if (!board) {
            errors.push(`La mision "${text(quest.name)}" no dice en que tablero se juega.`);
        } else if (!playable.has(board.toLowerCase())) {
            errors.push(`La mision "${text(quest.name)}" se juega en "${board}", que no es un tablero de este mundo.`);
        }
    }

    return errors;
}

/**
 * Escribe lo editado sobre el mundo, sin tocar lo que este editor no enseña.
 *
 * Una localidad que ya existía conserva su terreno, sus salas, sus objetivos y sus reglas
 * de encuentro: aquí solo se cambian los campos del formulario. Lo contrario sería que
 * abrir el editor borrara una mazmorra entera.
 *
 * @param {any} metadata
 * @param {EditorModel} model
 * @returns {any}
 */
export function applyEditorModel(metadata, model) {
    const source = (metadata && typeof metadata === 'object') ? metadata : {};
    const previous = new Map(
        (Array.isArray(source.locationMaps) ? source.locationMaps : [])
            .filter(l => l && text(l.name))
            .map(l => [text(l.name).toLowerCase(), l]),
    );

    const locationMaps = model.locations.map(location => {
        const before = previous.get(text(location.name).toLowerCase()) ?? createLocation(location.name);
        const boardsBefore = new Map(
            (Array.isArray(before.boards) ? before.boards : [])
                .filter((/** @type {any} */ b) => b && text(b.name))
                .map((/** @type {any} */ b) => [text(b.name).toLowerCase(), b]),
        );

        const boards = location.boards.map(board => {
            const boardBefore = boardsBefore.get(text(board.name).toLowerCase());
            const base = boardBefore ?? createBoard(board.name, board.gridWidth, board.gridHeight);
            return {
                ...base,
                name: text(board.name),
                description: text(board.description),
                gridWidth: board.gridWidth,
                gridHeight: board.gridHeight,
                partyStart: board.partyStart.map(c => ({ x: c.x, y: c.y })),
                enemyPlacements: board.enemyPlacements
                    .filter(e => text(e.name))
                    .map(e => ({ name: text(e.name), x: e.x, y: e.y })),
                isCombat: board.enemyPlacements.length > 0,
            };
        });

        return {
            ...before,
            name: text(location.name),
            description: text(location.description),
            region: text(location.region),
            locationType: text(location.type),
            controllingFaction: text(location.factionName),
            gridWidth: Number(before.gridWidth) || DEFAULT_LOCATION_GRID,
            gridHeight: Number(before.gridHeight) || DEFAULT_LOCATION_GRID,
            boards,
        };
    });

    return {
        ...source,
        displayName: text(model.world.displayName),
        genre: text(model.world.genre),
        description: text(model.world.description),
        locationMaps,
        // El catalogo de objetos del mundo: de aqui sale el botin, asi que no es una lista
        // decorativa. Los que no tengan nombre no llegan a existir.
        itemCatalogue: (model.items ?? [])
            .filter((/** @type {any} */ item) => text(item.name))
            .map((/** @type {any} */ item) => ({
                name: text(item.name),
                type: ['weapon', 'armor', 'gear'].includes(text(item.type)) ? text(item.type) : 'gear',
                category: text(item.category),
                rarity: text(item.rarity) || 'Common',
                weight: Number(item.weight) || 0,
                damageDice: text(item.damageDice),
                damageType: text(item.damageType),
                slot: text(item.slot),
                description: text(item.description),
            })),
        quests: (model.quests ?? [])
            .filter((/** @type {any} */ quest) => text(quest.name))
            .map((/** @type {any} */ quest) => ({
                id: text(quest.name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'mision',
                name: text(quest.name),
                description: text(quest.description),
                act: Math.max(1, Math.floor(Number(quest.act) || 1)),
                boardName: text(quest.boardName),
            })),
    };
}

/**
 * El texto que el modelo lee cuando alguien nombra a este personaje.
 *
 * Es lo unico de una ficha que llega al chat, asi que aqui va lo que importa contar y no
 * los numeros: de la CA no se habla, del pasado si.
 *
 * @param {EditorCharacter} character
 * @returns {string}
 */
export function characterContent(character) {
    const parts = [];
    const who = [text(character.title), text(character.race), text(character.className)]
        .filter(Boolean).join(' · ');
    if (who) parts.push(who);
    if (text(character.personality)) parts.push(`Personalidad: ${text(character.personality)}`);
    if (text(character.backstory)) parts.push(`Pasado: ${text(character.backstory)}`);
    return parts.join('\n\n');
}

/**
 * Lo que hay que escribir, borrar o cambiar en el Lorebook.
 *
 * Devuelve un plan y no lo aplica: crear una ficha pide un `uid` que solo sabe dar
 * SillyTavern, asi que quien llama lo hace y este modulo sigue siendo puro. Es la misma
 * division que usa el importador de libros.
 *
 * @param {any} entries Las fichas actuales, por uid.
 * @param {any} model
 * @returns {{create: any[], update: any[], remove: string[]}}
 */
export function planEntryChanges(entries, model) {
    const create = [];
    const update = [];

    /**
     * @param {any} item
     * @param {string} group
     * @param {string} content
     * @param {string[]} keys
     * @param {any} dndData
     */
    const push = (item, group, content, keys, dndData) => {
        const spec = { group, title: text(item.name), content, keys, dndData };
        if (text(item.uid)) update.push({ uid: text(item.uid), ...spec });
        else create.push(spec);
    };

    for (const character of model.characters ?? []) {
        if (!text(character.name)) continue;
        const keys = [...new Set([text(character.name), ...(character.keys ?? []).map(text)])].filter(Boolean);
        const inParty = character.kind === 'character';
        const where = text(character.locationName);

        // Se escribe **encima** de lo que ya habia, no en lugar de ello: una ficha del
        // grupo lleva inventario, equipo y su casilla, y nada de eso se edita aqui.
        // Reemplazar el `dndData` entero seria vaciarle la mochila por cambiarle el pelo.
        const previous = (character.raw && typeof character.raw === 'object') ? character.raw : {};

        /** @type {any} */
        const dndData = {
            ...previous,
            entityType: inParty ? 'character' : 'npc',
            name: text(character.name),
            title: text(character.title),
            charClass: text(character.className),
            level: character.level,
            race: text(character.race),
            maxHp: character.maxHp,
            ac: character.armorClass,
            speed: character.speed,
            ...Object.fromEntries(ABILITY_FIELDS.map(([key]) => [key, character.abilities?.[key] ?? 10])),
            locationName: where,
            backstory: text(character.backstory),
            personality: text(character.personality),
            arcana: text(character.arcana),
            initialBondPoints: character.initialBondPoints,
            image: text(character.image),
        };

        if (inParty) {
            // Quien juega necesita una casilla. Si acaba de entrar al grupo se le pone
            // donde empieza el grupo en su sitio; si ya jugaba, se le deja donde estaba.
            const old = (previous.mapPosition && typeof previous.mapPosition === 'object')
                ? previous.mapPosition : {};
            const board = (model.locations ?? [])
                .find((/** @type {any} */ l) => text(l.name).toLowerCase() === where.toLowerCase())
                ?.boards?.[0];
            const start = board?.partyStart?.[0] ?? { x: 1, y: 1 };
            dndData.mapPosition = {
                locationName: where,
                gridX: number(old.gridX, start.x),
                gridY: number(old.gridY, start.y),
            };
        }

        push(character, 'Characters', characterContent(character), keys, dndData);
    }

    for (const enemy of model.bestiary ?? []) {
        if (!text(enemy.name)) continue;
        push(enemy, 'Monsters', text(enemy.description) || text(enemy.name), [text(enemy.name)], {
            ...(enemy.raw && typeof enemy.raw === 'object' ? enemy.raw : {}),
            entityType: 'monster',
            name: text(enemy.name),
            hp: enemy.hp,
            maxHp: enemy.hp,
            armorClass: enemy.armorClass,
            cr: enemy.cr,
            speed: enemy.speed,
            attackRangeFeet: enemy.attackRangeFeet,
            profile: text(enemy.profile) || DEFAULT_PROFILE,
        });
    }

    for (const faction of model.factions ?? []) {
        if (!text(faction.name)) continue;
        push(faction, 'Factions', text(faction.goals) || text(faction.name), [text(faction.name)], {
            ...(faction.raw && typeof faction.raw === 'object' ? faction.raw : {}),
            entityType: 'faction',
            name: text(faction.name),
            reputation: faction.reputation,
        });
    }

    // Lo que estaba y ya no: una ficha que el editor enseñaba y se quito.
    const kept = new Set([
        ...(model.characters ?? []), ...(model.bestiary ?? []), ...(model.factions ?? []),
    ].map(item => text(item.uid)).filter(Boolean));

    // Solo se borra de las listas que el editor de verdad trajo. Con un modelo a medias,
    // "no esta en la lista" no significa "lo han quitado", significa "no lo has mirado".
    const editable = new Set([
        ...(Array.isArray(model.characters) ? ['npc', 'character'] : []),
        ...(Array.isArray(model.bestiary) ? ['monster'] : []),
        ...(Array.isArray(model.factions) ? ['faction'] : []),
    ]);
    const remove = Object.entries((entries && typeof entries === 'object') ? entries : {})
        .filter(([uid, entry]) => {
            const kind = text(/** @type {any} */ (entry)?.dndData?.entityType).toLowerCase();
            return editable.has(kind) && !kept.has(String(uid));
        })
        .map(([uid]) => String(uid));

    return { create, update, remove };
}

/**
 * Quien usa a un enemigo, para avisar antes de borrarlo.
 *
 * Quitar un bicho que un tablero coloca deja ese tablero con una colocacion muerta, y eso
 * solo se descubre al entrar a pelear. Mejor decirlo antes, como ya hace el editor de
 * reglas al quitar un tipo de dano.
 *
 * @param {any} model
 * @param {string} enemyName
 * @returns {string[]}
 */
export function findEnemyUses(model, enemyName) {
    const wanted = text(enemyName).toLowerCase();
    if (!wanted) return [];

    const uses = [];
    for (const location of model.locations ?? []) {
        for (const board of location.boards ?? []) {
            const count = (board.enemyPlacements ?? [])
                .filter((/** @type {any} */ p) => text(p.name).toLowerCase() === wanted).length;
            if (count > 0) uses.push(`${location.name} — ${board.name} (${count})`);
        }
    }
    return uses;
}

/**
 * El mundo en una línea, para la cabecera del editor.
 *
 * @param {EditorModel} model
 * @returns {string}
 */
export function describeModel(model) {
    const boards = model.locations.reduce((total, location) => total + location.boards.length, 0);
    const quiet = model.locations.filter(location => location.boards.length === 0).length;

    const parts = [
        `${model.locations.length} localidad(es)`,
        `${boards} tablero(s)`,
    ];
    if (quiet > 0) parts.push(`${quiet} sin tablero`);

    const people = (model.characters ?? []).length;
    if (people > 0) parts.push(`${people} personaje(s)`);
    const beasts = (model.bestiary ?? []).length;
    if (beasts > 0) parts.push(`${beasts} enemigo(s)`);
    const things = (model.items ?? []).length;
    if (things > 0) parts.push(`${things} objeto(s)`);
    const quests = (model.quests ?? []).length;
    if (quests > 0) parts.push(`${quests} misión(es)`);

    return parts.join(' · ');
}
