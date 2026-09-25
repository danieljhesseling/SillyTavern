/**
 * Starter templates: a playable world in one click.
 *
 * Creating a campaign used to mean authoring a Lorebook, then locations, then boards, then
 * monsters, across four different panels, with nothing telling you the order. These
 * templates fill all of that in from a single choice, so the first thing a new campaign
 * shows is a board you can already fight on rather than an empty form.
 *
 * Boards arrive with terrain already painted, because a board with no walls cannot show
 * what the tactical engine does — movement would just be a square.
 *
 * Pure module: it returns the data to write, and writes nothing itself.
 *
 * See wiki/ROADMAP.md, Fase C / onboarding.
 */

import { terrainFromAsciiMap } from '../board/terrain.js';

/**
 * @typedef {Object} StarterTemplate
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} genre
 * @property {string[]} map          ASCII layout, see terrainFromAsciiMap.
 * @property {string} locationName
 * @property {string} boardName
 * @property {Array<{name: string, hp: number, armorClass: number, cr: number, profile: string, attackRangeFeet?: number, abilities?: string[]}>} enemies
 * @property {Array<{x: number, y: number}>} partyStart
 * @property {Array<any>} [objectives]  Scenario objectives, if the board is a mission.
 * @property {Array<{name: string, type: string, description: string, routes: Array<{to: string, days: number, sea?: boolean}>}>} [places]
 *   Idea 178: los sitios de alrededor, con sus caminos, para empezar de cero con más base.
 * @property {string} [season] La estación en la que empieza.
 */

/** @type {StarterTemplate[]} */
export const STARTER_TEMPLATES = [
    {
        id: 'dungeon',
        name: 'Mazmorra clásica',
        description: 'Dos salas unidas por un pasillo, con una puerta cerrada que esconde lo que hay detrás.',
        genre: 'Fantasía',
        locationName: 'Cripta olvidada',
        boardName: 'Sala de entrada',
        map: [
            '################',
            '#......#.......#',
            '#..c...#...~~..#',
            '#......D...~~..#',
            '#......#.......#',
            '#......#####o###',
            '#..............#',
            '#...C......c...#',
            '#..............#',
            '################',
        ],
        enemies: [
            // Con escudo: una vez por combate lo usa para tirarte al suelo.
            { name: 'Esqueleto', hp: 13, armorClass: 13, cr: 0.25, profile: 'aggressive', abilities: ['golpe_de_escudo'] },
            { name: 'Arquero esquelético', hp: 9, armorClass: 12, cr: 0.25, profile: 'skirmisher', attackRangeFeet: 60 },
        ],
        partyStart: [{ x: 2, y: 8 }, { x: 3, y: 8 }, { x: 2, y: 7 }, { x: 3, y: 7 }],
        // A mission rather than a brawl: the one template that shows what the scenario
        // rules are for, without anybody having to author objectives by hand first.
        objectives: [
            { id: 'clear', type: 'eliminate_all', label: 'Limpiar la sala de entrada' },
            { id: 'hold', type: 'survive_rounds', label: 'Aguantar 3 rondas', rounds: 3, optional: true },
        ],
    },
    {
        id: 'forest',
        name: 'Claro del bosque',
        description: 'Terreno abierto con maleza y árboles que dan cobertura. Bueno para aprender a moverse.',
        genre: 'Aventura',
        locationName: 'Bosque de Thanel',
        boardName: 'Claro',
        map: [
            '################',
            '#..~~..........#',
            '#..~~....c.....#',
            '#........c.....#',
            '#....C.........#',
            '#..........~~~.#',
            '#...c......~~~.#',
            '#..............#',
            '################',
        ],
        enemies: [
            { name: 'Lobo', hp: 11, armorClass: 13, cr: 0.25, profile: 'aggressive' },
            { name: 'Lobo joven', hp: 7, armorClass: 12, cr: 0.125, profile: 'coward' },
        ],
        partyStart: [{ x: 2, y: 6 }, { x: 3, y: 6 }, { x: 2, y: 5 }, { x: 3, y: 5 }],
    },
    {
        id: 'tavern',
        name: 'Taberna',
        description: 'Un interior cerrado con mesas y una barra. Pensado para escenas sociales más que para pelear.',
        genre: 'Intriga',
        locationName: 'Villa de Arden',
        boardName: 'El Jabalí Dorado',
        map: [
            '##############',
            '#............#',
            '#..cc....cc..#',
            '#..cc....cc..#',
            '#............#',
            '#..cc........#',
            '#..cc...CCCC.#',
            '#............#',
            '######oo######',
        ],
        enemies: [],
        partyStart: [{ x: 6, y: 7 }, { x: 7, y: 7 }, { x: 5, y: 7 }, { x: 8, y: 7 }],
    },
    // Idea 178: dos mundos de cero con más base: su género, su tablero y los sitios de
    // alrededor ya unidos por caminos.
    {
        id: 'terror',
        name: 'Casa del ahorcado',
        description: 'Terror: una casa de campo cerrada desde que colgaron al dueño, un pueblo que no habla de ello y un cementerio con la verja rota.',
        genre: 'Terror',
        season: 'otono',
        locationName: 'La casa del ahorcado',
        boardName: 'El vestíbulo',
        map: [
            '################',
            '#......#.......#',
            '#..c...#...C...#',
            '#......D.......#',
            '#......#.......#',
            '###D####....c..#',
            '#..............#',
            '#...~~.....c...#',
            '################',
        ],
        enemies: [
            { name: 'Aparecido', hp: 14, armorClass: 12, cr: 0.5, profile: 'aggressive' },
            { name: 'Rata del sótano', hp: 5, armorClass: 11, cr: 0.125, profile: 'coward' },
        ],
        partyStart: [{ x: 2, y: 6 }, { x: 3, y: 6 }, { x: 2, y: 7 }, { x: 3, y: 7 }],
        places: [
            { name: 'Villacerrada', type: 'village', description: 'Un pueblo de ventanas cerradas: nadie habla de la casa.', routes: [{ to: 'La casa del ahorcado', days: 1 }] },
            { name: 'El cementerio viejo', type: 'ruins', description: 'La verja está rota por dentro.', routes: [{ to: 'Villacerrada', days: 1 }, { to: 'La casa del ahorcado', days: 1 }] },
        ],
    },
    {
        id: 'piratas',
        name: 'La costa de los naufragios',
        description: 'Piratas: un puerto donde todo se compra, una cala escondida y un islote al que solo se llega en barco.',
        genre: 'Piratas',
        season: 'verano',
        locationName: 'Puerto Salobre',
        boardName: 'El muelle',
        map: [
            '################',
            '#..............#',
            '#..cc....cc....#',
            '#..............#',
            '#~~~~~~.....c..#',
            '#~~~~~~........#',
            '#~~~~~~....C...#',
            '################',
        ],
        enemies: [
            { name: 'Contrabandista', hp: 11, armorClass: 12, cr: 0.25, profile: 'skirmisher' },
            { name: 'Tirador del muelle', hp: 9, armorClass: 12, cr: 0.25, profile: 'skirmisher', attackRangeFeet: 60 },
        ],
        partyStart: [{ x: 10, y: 2 }, { x: 11, y: 2 }, { x: 10, y: 3 }, { x: 11, y: 3 }],
        places: [
            { name: 'La cala del tuerto', type: 'camp', description: 'Donde se descarga lo que no pasa por la aduana.', routes: [{ to: 'Puerto Salobre', days: 1 }] },
            { name: 'El islote de los ahogados', type: 'ruins', description: 'Un faro apagado y lo que dejó el mar.', routes: [{ to: 'Puerto Salobre', days: 2, sea: true }] },
        ],
    },
    {
        id: 'blank',
        name: 'Mundo vacío',
        description: 'Solo un tablero abierto sin nada pintado. Para construirlo todo tú.',
        genre: '',
        locationName: 'Sin nombre',
        boardName: 'Tablero',
        map: [],
        enemies: [],
        partyStart: [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 3 }],
    },
];

/**
 * @param {string} id
 * @returns {StarterTemplate|null}
 */
export function getTemplate(id) {
    return STARTER_TEMPLATES.find(t => t.id === id) ?? null;
}

/**
 * Board dimensions implied by a template's layout.
 *
 * A blank template has no layout, so it falls back to a size big enough to be worth
 * panning around but small enough to see at once.
 *
 * @param {StarterTemplate} template
 * @returns {{gridWidth: number, gridHeight: number}}
 */
export function getTemplateSize(template) {
    const rows = Array.isArray(template?.map) ? template.map : [];
    if (rows.length === 0) return { gridWidth: 20, gridHeight: 16 };

    return {
        gridWidth: Math.max(...rows.map(r => String(r).length)),
        gridHeight: rows.length,
    };
}

/**
 * Builds the world metadata a template implies: one location holding one board, with the
 * board's terrain already painted.
 *
 * @param {StarterTemplate} template
 * @param {{displayName?: string, genre?: string, description?: string}} [overrides]
 * @returns {any}
 */
export function buildWorldMetadata(template, overrides = {}) {
    const { gridWidth, gridHeight } = getTemplateSize(template);

    return {
        displayName: String(overrides.displayName || '').trim() || template.name,
        genre: String(overrides.genre ?? template.genre ?? ''),
        description: String(overrides.description || '').trim() || template.description,
        worldMapUrl: '',
        locationMaps: [
            {
                name: template.locationName,
                description: template.description,
                url: '',
                gridWidth,
                gridHeight,
                boards: [
                    {
                        name: template.boardName,
                        description: '',
                        url: '',
                        gridWidth,
                        gridHeight,
                        isCombat: template.enemies.length > 0,
                        objectives: template.objectives ?? [],
                        terrain: terrainFromAsciiMap(template.map),
                        // Donde se planta quien juega. La plantilla siempre lo ha sabido y
                        // el tablero no lo guardaba: solo lo usaba, al vuelo, para colocar
                        // los nombres que pedia el asistente. Ahora el personaje se hace al
                        // entrar y quien recluta llega despues, asi que el tablero tiene
                        // que decirlo — si no, todos caen en (1,1), que en la mitad de las
                        // plantillas es un muro.
                        partyStart: (Array.isArray(template.partyStart) ? template.partyStart : [])
                            .map(c => ({ x: Number(c.x) || 0, y: Number(c.y) || 0 })),
                        fogEnabled: false,
                        npcPlacements: [],
                        encounterRules: [],
                    },
                ],
                routes: (template.places ?? []).flatMap(place => place.routes.filter(r => r.to === template.locationName)
                    .map(r => ({ to: place.name, days: r.days, ...(r.sea ? { sea: true } : {}) }))),
            },
            ...(template.places ?? []).map(place => ({
                name: place.name, description: place.description, url: '', gridWidth, gridHeight, boards: [],
                locationType: place.type,
                routes: place.routes.filter(r => r.to !== template.locationName).map(r => ({ ...r })),
            })),
        ],
        // Idea 178: los sitios de alrededor, unidos por caminos, y la estación en que empieza.
        ...(template.season ? { season: template.season } : {}),
        boards: [],
    };
}

/**
 * The world-info entries a template implies: one per party member, one per monster.
 *
 * Returned as plain descriptions rather than written directly, so the caller owns the
 * Lorebook write and this module stays testable.
 *
 * @param {StarterTemplate} template
 * @param {string[]} partyNames
 * @returns {Array<{group: string, title: string, content: string, keys: string[], dndData: any}>}
 */
export function buildWorldEntries(template, partyNames) {
    /** @type {Array<{group: string, title: string, content: string, keys: string[], dndData: any}>} */
    const entries = [];

    const names = (Array.isArray(partyNames) ? partyNames : [])
        .map(n => String(n || '').trim())
        .filter(Boolean);

    names.forEach((name, index) => {
        const start = template.partyStart[index] ?? template.partyStart[0] ?? { x: 1, y: 1 };
        entries.push({
            group: 'Characters',
            title: name,
            content: `${name} forma parte del grupo.`,
            keys: [name],
            dndData: {
                entityType: 'character',
                name,
                mapPosition: {
                    locationName: template.locationName,
                    gridX: start.x,
                    gridY: start.y,
                },
            },
        });
    });

    for (const enemy of template.enemies) {
        entries.push({
            group: 'Monsters',
            title: enemy.name,
            content: enemy.name,
            keys: [enemy.name],
            dndData: {
                entityType: 'monster',
                name: enemy.name,
                hp: enemy.hp,
                maxHp: enemy.hp,
                armorClass: enemy.armorClass,
                cr: enemy.cr,
                speed: 30,
                profile: enemy.profile,
                attackRangeFeet: enemy.attackRangeFeet ?? 5,
                abilities: enemy.abilities ?? [],
            },
        });
    }

    return entries;
}

/**
 * Encounter rules for the starting board, given the id each monster entry ended up with.
 *
 * Separate from buildWorldMetadata because those ids do not exist yet when the metadata
 * is built: a monster's id is the uid of its world-info entry, assigned on creation. The
 * board was therefore written with an empty rule list, and /fight answered "enemy not
 * found in encounter rules" on every campaign the wizard produced — a board with enemies
 * defined and no way to fight them.
 *
 * @param {StarterTemplate} template
 * @param {Record<string, string>} idsByName  Monster name to world-info entry id.
 * @returns {Array<{enemyId: string, minCount: number, maxCount: number}>}
 */
export function buildEncounterRules(template, idsByName) {
    /** @type {Array<{enemyId: string, minCount: number, maxCount: number}>} */
    const rules = [];

    for (const enemy of template.enemies) {
        const enemyId = idsByName?.[enemy.name];
        if (!enemyId) continue;
        // A small, fixed spread: enough that two runs differ, few enough that a starter
        // board stays winnable by two level-one characters.
        rules.push({ enemyId: String(enemyId), minCount: 1, maxCount: 2 });
    }

    return rules;
}

/**
 * Options for a template picker.
 * @returns {Array<{id: string, name: string, description: string}>}
 */
export function getTemplateOptions() {
    return STARTER_TEMPLATES.map(({ id, name, description }) => ({ id, name, description }));
}
