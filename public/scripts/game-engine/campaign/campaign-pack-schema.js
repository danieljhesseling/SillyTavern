/**
 * The contract between a campaign pack and this engine.
 *
 * A pack is what comes back from processing a book — a module, a novel — somewhere else
 * entirely: a Gemini Gem the player drives by hand, outside this repository. That is the
 * whole reason this file matters more than it looks. When the producer of the data lives
 * outside the code, the schema stops being an internal detail and becomes the border, and
 * a border that is written twice drifts.
 *
 * So it is **generated**, never hand-written: the objective types come from
 * `campaign/scenarios.js`, the tactical profiles from `combat/enemy-ai.js`, the map
 * characters from `board/terrain.js`. Change the engine and the schema you paste into the
 * Gem changes with it. A copy kept by hand goes stale silently, and the failure shows up
 * a whole book later.
 *
 * Pure. See wiki/ROADMAP_INGESTA_CAMPANAS_LIBROS.md (G1).
 */

import { OBJECTIVE_TYPES } from './scenarios.js';
import { ASCII_TERRAIN } from '../board/terrain.js';
import { getProfileOptions } from '../combat/enemy-ai.js';

/** Schema version, so a pack can say which contract it was written against. */
export const CAMPAIGN_PACK_VERSION = 1;

/**
 * What each objective type asks the author for, in the words a book can supply.
 *
 * This is the translation the whole pipeline turns on. The engine judges objectives with
 * `targetIds` — the uids of Lorebook entries — and a book cannot possibly know those:
 * they do not exist until the pack is imported. So the author writes **names**, and the
 * importer resolves them once the entries exist.
 *
 * Exactly the mistake that already cost this project a working feature: the campaign
 * wizard wrote its boards with an empty encounter list because the monster ids were not
 * created yet, and `/fight` found no enemies in any new campaign.
 *
 * Data, so the validator and the importer read the same mapping this schema publishes.
 *
 * @type {Record<string, {writes: string, engineField: string, kind: string, help: string}[]>}
 */
export const OBJECTIVE_FIELDS = {
    eliminate: [{
        writes: 'target', engineField: 'targetIds', kind: 'name',
        help: 'Nombre del enemigo que hay que derrotar, tal y como aparece en el bestiario.',
    }],
    eliminate_all: [],
    survive_rounds: [{
        writes: 'rounds', engineField: 'rounds', kind: 'number',
        help: 'Cuántas rondas hay que aguantar.',
    }],
    reach_cell: [{
        writes: 'cell', engineField: 'cell', kind: 'cell',
        help: 'Casilla a la que debe llegar alguien del grupo, contando desde 0.',
    }],
    escort: [
        { writes: 'ally', engineField: 'allyId', kind: 'name', help: 'Nombre del aliado a escoltar.' },
        { writes: 'cell', engineField: 'cell', kind: 'cell', help: 'Casilla a la que debe llegar.' },
    ],
    protect: [{
        writes: 'ally', engineField: 'allyId', kind: 'name',
        help: 'Nombre del aliado que debe seguir en pie al terminar.',
    }],
    loot: [{
        writes: 'treasures', engineField: 'treasureIds', kind: 'names',
        help: 'Nombres de los tesoros que hay que recoger.',
    }],
};

/** Board limits, the same ones the world generator already enforces. */
export const BOARD_LIMITS = { minWidth: 8, maxWidth: 40, minHeight: 6, maxHeight: 30 };

/** The map characters, read from the terrain table so the two cannot disagree. */
export function getMapLegend() {
    const names = {
        wall: 'muro', door: 'puerta', difficult: 'terreno difícil',
        cover_half: 'cobertura media', cover_three_quarters: 'cobertura de tres cuartos',
    };
    const legend = { '.': 'suelo transitable' };
    for (const [char, cell] of Object.entries(ASCII_TERRAIN)) {
        const base = names[cell.type] ?? cell.type;
        legend[char] = cell.type === 'door' ? `${base}${cell.open ? ' abierta' : ' cerrada'}` : base;
    }
    return legend;
}

/** The objective schema, built from the seven types the engine actually judges. */
function buildObjectiveSchema() {
    const properties = {
        type: {
            type: 'string',
            enum: Object.keys(OBJECTIVE_TYPES),
            description: Object.entries(OBJECTIVE_TYPES)
                .map(([type, def]) => `${type}: ${def.description}`)
                .join(' | '),
        },
        label: { type: 'string', description: 'Cómo se le enseña al jugador.' },
        optional: {
            type: 'boolean',
            description: 'Un objetivo opcional paga pero no bloquea: no impide la victoria ni causa la derrota.',
        },
    };

    // One property per field any type can ask for, described in the author's words.
    for (const fields of Object.values(OBJECTIVE_FIELDS)) {
        for (const field of fields) {
            if (properties[field.writes]) continue;

            if (field.kind === 'number') {
                properties[field.writes] = { type: 'integer', description: field.help };
            } else if (field.kind === 'names') {
                properties[field.writes] = { type: 'array', items: { type: 'string' }, description: field.help };
            } else if (field.kind === 'cell') {
                properties[field.writes] = {
                    type: 'object',
                    properties: { x: { type: 'integer' }, y: { type: 'integer' } },
                    required: ['x', 'y'],
                    description: field.help,
                };
            } else {
                properties[field.writes] = { type: 'string', description: field.help };
            }
        }
    }

    const perType = Object.entries(OBJECTIVE_FIELDS)
        .map(([type, fields]) => `${type} → ${fields.map(f => f.writes).join(', ') || 'nada'}`)
        .join(' · ');

    return {
        type: 'object',
        required: ['type'],
        properties,
        description: `Un objetivo. Cada tipo pide sus campos: ${perType}`,
    };
}

/** The five sections, each one a schema of its own. */
function buildSectionSchemas() {
    const legend = getMapLegend();
    const legendText = Object.entries(legend).map(([c, name]) => `'${c}' ${name}`).join(', ');
    const profiles = getProfileOptions().map(([value]) => value);

    const world = {
        type: 'object',
        required: ['name', 'synopsis'],
        properties: {
            name: { type: 'string', description: 'Nombre de la campaña o del libro.' },
            genre: { type: 'string' },
            synopsis: { type: 'string', description: 'Un párrafo sobre el mundo.' },
            factions: {
                type: 'array',
                items: {
                    type: 'object',
                    required: ['name'],
                    properties: {
                        name: { type: 'string' },
                        goals: { type: 'string' },
                        reputation: { type: 'integer' },
                    },
                },
            },
            loreEntries: {
                type: 'array',
                description: 'Entradas del Lorebook: lugares, personajes, objetos, secretos.',
                items: {
                    type: 'object',
                    required: ['key', 'content'],
                    properties: {
                        key: { type: 'string', description: 'La palabra que la activa en el chat.' },
                        content: { type: 'string' },
                        type: { type: 'string', enum: ['location', 'npc', 'item', 'faction', 'event', 'other'] },
                    },
                },
            },
        },
    };

    const boards = {
        type: 'array',
        description: 'Tableros tácticos. El mapa se recorre por casillas, no es una ilustración.',
        items: {
            type: 'object',
            required: ['id', 'name', 'map'],
            properties: {
                id: { type: 'string', description: 'Identificador propio del paquete, al que apuntan las misiones.' },
                name: { type: 'string' },
                locationName: { type: 'string', description: 'La localización a la que pertenece.' },
                map: {
                    type: 'array',
                    items: { type: 'string' },
                    description: `Filas de la misma longitud, entre ${BOARD_LIMITS.minWidth} y ${BOARD_LIMITS.maxWidth} columnas `
                        + `y entre ${BOARD_LIMITS.minHeight} y ${BOARD_LIMITS.maxHeight} filas. Borde exterior siempre de muro. `
                        + `Solo estos caracteres: ${legendText}.`,
                },
                partyStart: {
                    type: 'array',
                    description: 'Casillas donde empieza el grupo. Tienen que ser suelo transitable.',
                    items: {
                        type: 'object',
                        required: ['x', 'y'],
                        properties: { x: { type: 'integer' }, y: { type: 'integer' } },
                    },
                },
                enemies: {
                    type: 'array',
                    description: 'Enemigos colocados aquí. El nombre tiene que estar en el bestiario.',
                    items: {
                        type: 'object',
                        required: ['name'],
                        properties: {
                            name: { type: 'string' },
                            x: { type: 'integer' },
                            y: { type: 'integer' },
                        },
                    },
                },
            },
        },
    };

    const bestiary = {
        type: 'array',
        items: {
            type: 'object',
            required: ['name', 'hp', 'armorClass', 'cr', 'profile'],
            properties: {
                name: { type: 'string', description: 'Único en todo el paquete: el Lorebook indexa por nombre.' },
                hp: { type: 'integer' },
                armorClass: { type: 'integer' },
                cr: { type: 'number', description: 'Desafío. Decide la experiencia y el botín.' },
                profile: {
                    type: 'string',
                    enum: profiles,
                    description: 'Comportamiento táctico. Solo estos cuatro.',
                },
                attackRangeFeet: { type: 'integer', description: '5 en cuerpo a cuerpo, 30 a 120 a distancia.' },
                description: { type: 'string' },
            },
        },
    };

    const quests = {
        type: 'array',
        items: {
            type: 'object',
            required: ['id', 'name', 'objectives'],
            properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                act: { type: 'integer', description: 'Capítulo o acto al que pertenece.' },
                description: { type: 'string' },
                boardId: { type: 'string', description: 'Dónde se juega. Tiene que existir en boards.' },
                objectives: { type: 'array', items: buildObjectiveSchema() },
            },
        },
    };

    const confidants = {
        type: 'array',
        description: 'Compañeros con los que el grupo puede estrechar vínculos.',
        items: {
            type: 'object',
            required: ['name'],
            properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                arcana: { type: 'string', description: 'Sabor, como en Persona. No cambia ninguna regla.' },
                initialBondPoints: { type: 'integer', description: 'Puntos de vínculo de partida. 0 es lo normal.' },
            },
        },
    };

    return { world, boards, bestiary, quests, confidants };
}

/** The order the sections are best generated in, and what each one needs first. */
export const SECTION_ORDER = ['world', 'confidants', 'bestiary', 'boards', 'quests'];

/**
 * The schema of one section.
 *
 * Offered on its own because a book does not fit in one answer: a model has a cap on how
 * much it can write at a time, so a pack is produced section by section. Each one can be
 * pasted into the Gem for its own step.
 *
 * @param {string} section
 * @returns {any|null}
 */
export function getSectionSchema(section) {
    return buildSectionSchemas()[section] ?? null;
}

/**
 * The whole pack, as one schema.
 *
 * @returns {any}
 */
export function buildCampaignPackSchema() {
    const sections = buildSectionSchemas();

    return {
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: 'Paquete de campaña',
        description: 'Una campaña completa lista para importar: el mundo, sus compañeros, '
            + 'su bestiario, sus tableros y sus misiones.',
        type: 'object',
        required: ['version', 'world'],
        properties: {
            version: {
                type: 'integer',
                const: CAMPAIGN_PACK_VERSION,
                description: 'Versión del contrato con la que se escribió este paquete.',
            },
            ...sections,
        },
    };
}

/**
 * The rules that no JSON Schema can express, written for whoever authors a pack.
 *
 * Cross-references, mostly: that a quest names a board that exists, that a spawn names a
 * creature that exists. Those are where a generated pack really fails — not in the shape
 * of one field — and a schema cannot check them, so they are said out loud instead.
 *
 * @returns {string[]}
 */
export function getPackRules() {
    return [
        'Cada `boardId` de una misión tiene que existir entre los tableros.',
        'Cada nombre de enemigo colocado en un tablero tiene que existir en el bestiario.',
        'Cada `target` de un objetivo `eliminate` tiene que ser un enemigo del bestiario.',
        'Cada `ally` de un objetivo `escort` o `protect` tiene que ser un compañero de `confidants`.',
        'Los nombres de enemigos y de compañeros no pueden repetirse: el Lorebook indexa por nombre y el segundo borraría al primero.',
        'Cada mapa tiene que ser rectangular, con el borde exterior entero de muro.',
        'Cada casilla de `partyStart` tiene que caer sobre suelo transitable, no sobre un muro.',
        'Las coordenadas cuentan desde 0, y la primera fila del mapa es y=0.',
        'Usa `optional: true` para los objetivos que pagan pero no bloquean. No existe `required`.',
        'Escribe **nombres**, nunca identificadores internos: el importador los resuelve al crear las entradas.',
    ];
}

/**
 * Everything the author of a Gem needs, in one piece of text ready to paste.
 *
 * One block rather than a file to download, because the place it is going is a text box
 * in somebody else's web app.
 *
 * @returns {string}
 */
export function buildGemInstructions() {
    const schema = JSON.stringify(buildCampaignPackSchema(), null, 2);
    const rules = getPackRules().map((rule, i) => `${i + 1}. ${rule}`).join('\n');
    const order = SECTION_ORDER.join(' → ');

    return [
        '# Contrato del paquete de campaña',
        '',
        `Versión ${CAMPAIGN_PACK_VERSION}. Generado desde el motor el ${new Date().toISOString().slice(0, 10)}.`,
        '',
        'Devuelve **solo JSON válido** que cumpla este esquema. Una sección por respuesta si el',
        `libro es largo; el orden recomendado es: ${order}.`,
        '',
        '## Esquema',
        '',
        '```json',
        schema,
        '```',
        '',
        '## Reglas que el esquema no puede comprobar',
        '',
        rules,
        '',
        '## Sobre los mapas',
        '',
        'El mapa es un tablero de combate por casillas, no una ilustración: tiene que poder',
        'recorrerse. Deja pasillos de al menos una casilla de ancho, usa muros interiores para',
        'crear cobertura y rutas, y no dibujes una sala vacía.',
        '',
        Object.entries(getMapLegend()).map(([c, name]) => `- \`${c}\` ${name}`).join('\n'),
    ].join('\n');
}

/**
 * A small, correct pack — the one you show the Gem as an example of good output.
 *
 * Deliberately tiny and deliberately complete: two boards so the cross-reference between
 * a quest and a board is exercised, an objective of each awkward kind, and a companion
 * who is named by a protect objective. An example that only covers the easy cases teaches
 * the easy cases.
 *
 * @returns {any}
 */
export function buildExamplePack() {
    return {
        version: CAMPAIGN_PACK_VERSION,
        world: {
            name: 'El Molino de los Cuervos',
            genre: 'Fantasía oscura',
            synopsis: 'Un molino abandonado a las afueras del pueblo, donde los cuervos '
                + 'traen noticias que nadie pidió y el grano lleva años sin molerse.',
            factions: [
                { name: 'La Orden de la Pluma', goals: 'Vigilar en secreto lo que duerme bajo el molino', reputation: 10 },
            ],
            loreEntries: [
                { key: 'Molino', content: 'Tres pisos de madera podrida sobre un sótano que nadie admite haber visto.', type: 'location' },
                { key: 'Cuervos', content: 'Demasiado atentos para ser pájaros.', type: 'other' },
            ],
        },
        confidants: [
            { name: 'Mira la Molinera', description: 'Heredó el molino y la costumbre de no bajar al sótano.', arcana: 'La Ermitaña', initialBondPoints: 0 },
        ],
        bestiary: [
            { name: 'Cuervo grande', hp: 7, armorClass: 12, cr: 0.125, profile: 'skirmisher', attackRangeFeet: 5 },
            { name: 'Guardián del grano', hp: 26, armorClass: 14, cr: 1, profile: 'guardian', attackRangeFeet: 5, description: 'Un espantapájaros que se mueve cuando nadie mira.' },
        ],
        boards: [
            {
                id: 'molino_planta_baja',
                name: 'Planta baja del molino',
                locationName: 'El Molino de los Cuervos',
                map: [
                    '##############',
                    '#....#.......#',
                    '#.c..D...~~..#',
                    '#....#...~~..#',
                    '#....#####D###',
                    '#............#',
                    '#..C......c..#',
                    '#............#',
                    '##############',
                ],
                partyStart: [{ x: 2, y: 7 }, { x: 3, y: 7 }],
                enemies: [{ name: 'Cuervo grande', x: 9, y: 2 }],
            },
            {
                id: 'molino_sotano',
                name: 'El sótano',
                locationName: 'El Molino de los Cuervos',
                // La puerta no es decoracion: separa dos salas, y lo que hay detras no
                // se sabe hasta abrirla. Asi es como el motor marca el ritmo de una
                // mazmorra, y por eso el ejemplo lo ensena.
                map: [
                    '############',
                    '#....#.....#',
                    '#....#.....#',
                    '#....D.....#',
                    '#....#.....#',
                    '#....#.....#',
                    '#....#.....#',
                    '#....#.....#',
                    '############',
                ],
                partyStart: [{ x: 2, y: 7 }, { x: 3, y: 7 }],
                enemies: [{ name: 'Guardián del grano', x: 8, y: 3 }],
            },
        ],
        quests: [
            {
                id: 'q_molino_1',
                name: 'Los cuervos del molino',
                act: 1,
                description: 'Mira dice que los pájaros no la dejan trabajar. No es del todo mentira.',
                boardId: 'molino_planta_baja',
                objectives: [
                    { type: 'eliminate_all', label: 'Despejar la planta baja' },
                ],
            },
            {
                id: 'q_molino_2',
                name: 'Lo que hay debajo',
                act: 1,
                description: 'La trampilla del sótano lleva años cerrada por fuera.',
                boardId: 'molino_sotano',
                objectives: [
                    { type: 'eliminate', label: 'Acabar con el guardián', target: 'Guardián del grano' },
                    { type: 'protect', label: 'Que Mira salga entera', ally: 'Mira la Molinera' },
                    { type: 'survive_rounds', label: 'Aguantar hasta el amanecer', rounds: 6, optional: true },
                ],
            },
        ],
    };
}
