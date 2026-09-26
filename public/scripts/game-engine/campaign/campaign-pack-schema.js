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
 * Pure. See wiki/archivo/ROADMAP_INGESTA_CAMPANAS_LIBROS.md (G1).
 */

import { OBJECTIVE_TYPES } from './scenarios.js';
import { ASCII_TERRAIN } from '../board/terrain.js';
import { getProfileOptions } from '../combat/enemy-ai.js';
import { SPECIES as PET_SPECIES } from './pet.js';

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

/**
 * Qué clase de sitio es una localidad.
 *
 * Solo es sabor — el motor no cambia ninguna regla por el tipo — pero decirle a un libro
 * cuáles hay evita que cada paquete invente el suyo.
 */
export const LOCATION_TYPES = ['city', 'village', 'outpost', 'ruins', 'dungeon', 'camp', 'sanctuary', 'wilderness'];

/** Board limits, the same ones the world generator already enforces. */
export const BOARD_LIMITS = { minWidth: 8, maxWidth: 40, minHeight: 6, maxHeight: 30 };

/** The map characters, read from the terrain table so the two cannot disagree. */
export function getMapLegend() {
    const names = {
        wall: 'muro', door: 'puerta', difficult: 'terreno difícil',
        cover_half: 'cobertura media', cover_three_quarters: 'cobertura de tres cuartos',
        chasm: 'precipicio (no se anda; a quien empujan dentro, cae)',
        stairs: 'escalera al nivel siguiente',
        // R3 del roadmap de profundidad: el terreno que los elementos cambian.
        water: 'agua poco honda (cuesta el doble; el frío la hiela)',
        ice: 'hielo (el trueno lo quiebra, el fuego lo funde)',
        brush: 'maleza (cuesta el doble, y arde)',
        barrel: 'barril (cubre; con fuego, revienta)',
        chest: 'cofre (se abre estando al lado)',
        // B1 y B2 de LO_QUE_FALTA.
        high: 'en alto (subir cuesta el doble; desde arriba se ataca con ventaja): torres, escalones, la empalizada',
        exit: 'salida (quien la pisa puede irse de la pelea; con un objetivo «alcanzar» encima, salir es ganar): la ventana, la trampilla',
        // T1 y B3.
        lever: 'palanca (no se pisa; estando al lado, abre todas las puertas con llave del tablero): la reja del fondo',
        barricade: 'barricada (corta el paso, no la vista; cubre a quien está detrás y a golpes se rompe: 15 de vida)',
    };
    const legend = { '.': 'suelo transitable' };
    for (const [char, cell] of Object.entries(ASCII_TERRAIN)) {
        const base = names[cell.type] ?? cell.type;
        legend[char] = cell.type === 'door'
            ? `${base}${cell.open ? ' abierta' : /** @type {any} */ (cell).locked ? ' cerrada con llave (se abre con una llave, con maña o a golpes; el jefe del tablero suelta la llave)' : ' cerrada'}`
            : base;
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

/** Las seis secciones, cada una con su esquema. */
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
            season: { type: 'string', description: 'La estación en la que empieza: primavera, verano, otono o invierno. Cada una dura 56 días. Sin nada, otoño.' },
            factions: {
                type: 'array',
                items: {
                    type: 'object',
                    required: ['name'],
                    properties: {
                        name: { type: 'string' },
                        goals: { type: 'string' },
                        reputation: { type: 'integer' },
                        magia: {
                            type: 'string',
                            enum: ['persigue', 'tolera', 'comercia'],
                            description: 'Cómo ve la magia. Donde manda una que la persigue no se venden componentes; donde comercia con ella, salen más baratos. Sin nada, tolera.',
                        },
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

    const locations = {
        type: 'array',
        description: 'Los sitios del mundo. Una localidad puede tener 0 tableros (una aldea donde '
            + 'solo se habla y se comercia), 1 o varios. Opcional: las que no se declaren se '
            + 'deducen de los tableros que las nombren.',
        items: {
            type: 'object',
            required: ['name'],
            properties: {
                name: { type: 'string', description: 'Único en el paquete. Es el nombre al que apuntan los tableros.' },
                type: { type: 'string', enum: LOCATION_TYPES },
                description: { type: 'string' },
                region: { type: 'string', description: 'La comarca o zona a la que pertenece.' },
                factionName: { type: 'string', description: 'La facción que la controla, si alguna.' },
                hidden: { type: 'boolean', description: 'Si empieza escondida: no se puede ir hasta que un hito del hilo la revela.' },
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
                seasons: { type: 'array', items: { type: 'string' }, description: 'Si migra: las estaciones en que anda (primavera, verano, otono, invierno). Fuera de ellas no sale. Sin nada, todo el año.' },
                domable: {
                    type: 'string',
                    enum: [...Object.keys(PET_SPECIES), ''],
                    description: 'Si una cría suya se puede domar al vencerlo, y en qué mascota se queda. Vacío: no se doma. Sin el campo, lo decide su nombre (lobos, cuervos, zorros, halcones, gatos).',
                },
                abilities: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Ids del catálogo de habilidades (rules.abilities) que sabe usar. El motor decide cuándo: cura a los suyos, gasta lo que tiene usos contados en cuanto llega, y usa lo de siempre si pega más que su golpe.',
                },
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

    const items = {
        type: 'array',
        description: 'El catálogo de objetos del mundo: lo que existe antes de que nadie lo lleve '
            + 'encima. La rareza decide en qué peldaño del botín cae.',
        items: {
            type: 'object',
            required: ['name'],
            properties: {
                name: { type: 'string', description: 'Único en el paquete.' },
                type: { type: 'string', enum: ['weapon', 'armor', 'gear'] },
                rarity: { type: 'string', enum: ITEM_RARITIES, description: 'Decide con qué facilidad cae.' },
                weight: { type: 'number', description: 'En kilos. 0 si no pesa nada.' },
                damageDice: { type: 'string', description: 'Solo las armas. Por ejemplo 1d8.' },
                damageType: { type: 'string', description: 'Solo las armas: cortante, perforante…' },
                slot: { type: 'string', description: 'Dónde se equipa, si se equipa.' },
                description: { type: 'string' },
                boundTo: {
                    type: 'object',
                    description: 'Reliquia (idea 132): llega al cumplir ese hito o al entregar ese encargo, una vez, y nunca cae como botín.',
                    properties: {
                        kind: { type: 'string', enum: ['milestone', 'contract'] },
                        id: { type: 'string' },
                    },
                },
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
                arrivals: {
                    type: 'array',
                    description: 'Idea 45: lo que dice al llegar a un sitio, una vez, si va en el grupo.',
                    items: {
                        type: 'object',
                        properties: { place: { type: 'string' }, line: { type: 'string' } },
                    },
                },
            },
        },
    };

    // R1/R10 del roadmap de profundidad: los héroes hechos, para la partida rápida.
    const heroes = {
        type: 'array',
        maxItems: 3,
        description: 'Tres héroes hechos, pensados para este mundo: quien juega elige uno y entra sin crear a nadie. '
            + 'De las razas y clases que el mundo deja entrar.',
        items: {
            type: 'object',
            required: ['name', 'race', 'className', 'about', 'pitch'],
            properties: {
                name: { type: 'string' },
                race: { type: 'string', description: 'Como la llama el compendio: Humano, Enano, Media elfa…' },
                className: { type: 'string', description: 'Como la llama el compendio: Guerrero, Pícaro, Soldado…' },
                gender: { type: 'string', enum: ['Mujer', 'Hombre', 'No binario', 'Sin especificar'] },
                background: { type: 'string', enum: ['soldado', 'criminal', 'erudito', 'acolito', 'forastero', 'artesano', 'noble', 'marinero', 'charlatan', 'ermitano'] },
                about: { type: 'string', description: 'Quién es, en dos frases. Es lo que lee el narrador.' },
                pitch: { type: 'string', description: 'Una línea para elegirlo: lo que le hace distinto.' },
                spells: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Ids de conjuros del grimorio, si hace magia. La magia solo existe en el grimorio del juego: no se inventa.',
                },
                pet: {
                    type: 'object',
                    description: 'La mascota con la que llega, si tiene: su nombre, su especie y su carácter.',
                    properties: {
                        name: { type: 'string' },
                        species: { type: 'string', enum: Object.keys(PET_SPECIES) },
                        character: { type: 'string', enum: ['cinica', 'leal', 'curiosa', 'miedosa', 'orgullosa'] },
                    },
                },
            },
        },
    };

    return { world, locations, boards, bestiary, quests, confidants, items, heroes };
}

/** The order the sections are best generated in, and what each one needs first. */
export const SECTION_ORDER = ['world', 'locations', 'confidants', 'bestiary', 'items', 'boards', 'quests', 'heroes'];

/**
 * Las rarezas que las tablas de botín conocen.
 *
 * Escribir aquí "Legendaria" no la inventa: una rareza que las tablas no tienen no cae
 * nunca, así que el contrato solo ofrece las que de verdad tienen un peldaño.
 */
export const ITEM_RARITIES = ['Common', 'Uncommon', 'Rare', 'Very Rare'];

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
        'Una localidad puede tener **0 tableros**: una aldea donde solo se habla y se comercia es tan valida como una cripta. Declarala en `locations` aunque no tenga ninguno.',
        'El `locationName` de un tablero deberia coincidir con el nombre de una localidad de `locations`. Si no esta declarada, se crea a partir del tablero.',
        // Las tres que el validador ya aplicaba y las instrucciones callaban: un Gem que no
        // las sabe las rompe, y se entera dos libros mas tarde.
        `Cada tablero mide entre ${BOARD_LIMITS.minWidth}×${BOARD_LIMITS.minHeight} y ${BOARD_LIMITS.maxWidth}×${BOARD_LIMITS.maxHeight} casillas. Uno de 14×10 ya da una escena; por encima de 24×18 se juega lento.`,
        'Desde donde empieza el grupo tiene que poderse llegar a toda casilla de suelo, abriendo puertas. Un enemigo en una sala incomunicada es un error; una sala vacía incomunicada, un aviso.',
        'Los nombres de `items` tampoco se repiten, y su `rarity` es una de las cuatro que conocen las tablas de botín: una rareza inventada nunca cae.',
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
        items: [
            {
                name: 'Hoz del molino',
                type: 'weapon',
                rarity: 'Uncommon',
                weight: 1.5,
                damageDice: '1d6',
                damageType: 'cortante',
                slot: 'weapon',
                description: 'Sigue oliendo a grano mojado.',
            },
        ],
        locations: [
            {
                name: 'El Molino de los Cuervos',
                type: 'ruins',
                description: 'El molino y lo que guarda debajo.',
                factionName: 'La Orden de la Pluma',
            },
            {
                // Sin tableros a propósito: una localidad puede no tener ninguno, y este
                // ejemplo está para enseñarlo. Aquí se habla y se pasa el rato; no se pelea.
                name: 'Vado de la Rueda',
                type: 'village',
                description: 'Cuatro casas y un puente de tablones. Aquí nadie ha visto nada.',
                region: 'La ribera',
            },
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
