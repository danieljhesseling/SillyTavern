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
import { PLACE_KINDS } from './town.js';
import { MOODS, EFFECT_KINDS, MILESTONE_STATES, DC_LIMITS } from './dialogues.js';
import { SKILLS, DEFAULT_DC } from '../rules/checks.js';
import { ATTITUDE } from './attitudes.js';
import { OPENS, ASKS } from './plot.js';
import { BACKGROUNDS } from './backgrounds.js';

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

/** Las secciones, cada una con su esquema. */
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
            // J5.2: lo que los paquetes ya traen y el Gem no sabía: para qué nivel es y a
            // cuántos días queda del gremio. Salen en la tarjeta del tablón.
            levels: {
                type: 'array',
                items: { type: 'integer', minimum: 1, maximum: 20 },
                minItems: 2,
                maxItems: 2,
                description: 'Para qué nivel es, desde y hasta: [1, 4]. Sale en el tablón del gremio. Sin nada, se calcula del desafío de los bichos.',
            },
            journey: {
                type: 'object',
                description: 'A cuántos días queda del gremio de Puerto Alba y cómo se llega. Sale en el tablón y se cuenta al salir. Sin nada, 5 días.',
                properties: {
                    days: { type: 'integer', minimum: 1, maximum: 60 },
                    how: { type: 'string', description: 'Una frase: «Subís por el camino del norte hasta un valle de montaña».' },
                },
            },
            factions: {
                type: 'array',
                items: {
                    type: 'object',
                    required: ['name'],
                    properties: {
                        id: { type: 'string', description: 'Corto, en minúsculas y con guiones («los-vistani»): así la nombran el hilo y los encargos.' },
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
                // J12.8 a J12.12: el tablero hecho de un mapa dibujado. Lo escribe
                // `tools/mapa-a-tablero.mjs` a partir de la imagen; un libro sin mapas no lo trae.
                image: {
                    type: 'string',
                    description: 'Solo si el tablero se juega encima de un mapa dibujado: la ruta de la imagen '
                        + 'desde public/, por ejemplo "mundos/strahd/mapas/sotano.png". Sin mapa, no lo escribas. '
                        + 'Con imagen, el borde del mapa puede tener suelo.',
                },
                grid: {
                    type: 'object',
                    description: 'Dónde cae cada casilla sobre el dibujo: el lado de la casilla en píxeles (cell) y dónde '
                        + 'empieza la primera (offsetX, offsetY). cols y rows tienen que ser el ancho y el alto de map.',
                    required: ['cell'],
                    properties: {
                        cell: { type: 'number' },
                        offsetX: { type: 'number' },
                        offsetY: { type: 'number' },
                        cols: { type: 'integer' },
                        rows: { type: 'integer' },
                    },
                },
                zones: {
                    type: 'array',
                    description: 'Las salas con nombre del tablero (B1, «La capilla»): su nombre, sus casillas y lo que '
                        + 'hay en ellas. Las casillas, con rect (una sala cuadrada) o con cells ("x,y").',
                    items: {
                        type: 'object',
                        required: ['name'],
                        properties: {
                            name: { type: 'string', description: 'Único en el tablero.' },
                            rect: {
                                type: 'object',
                                properties: { x: { type: 'integer' }, y: { type: 'integer' }, width: { type: 'integer' }, height: { type: 'integer' } },
                            },
                            cells: { type: 'array', items: { type: 'string' }, description: 'Casillas "x,y".' },
                            note: { type: 'string', description: 'Quién espera, qué se encuentra, el texto de la sala.' },
                        },
                    },
                },
                elevation: {
                    type: 'object',
                    description: 'Las cotas en pies de las casillas que no están a ras de suelo, como {"4,2": 30}. '
                        + 'Entre dos casillas vecinas con 10 pies o más de diferencia hay un acantilado: no se cruza '
                        + 'andando, y desde arriba se ataca con ventaja. Los puentes y las rampas llevan su cota.',
                    additionalProperties: { type: 'number' },
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
                hidden: { type: 'boolean', description: 'Si empieza escondida: no se puede ir hasta que la revela un hito del hilo (`changes.reveal`) o un rumor que lleva a ella (`leadsTo`).' },
                places: {
                    type: 'array',
                    description: 'Opcional, para pueblos y ciudades: los sitios de dentro (la herrería, la posada, '
                        + 'el templo…), en el orden en que se enseñan. Sin la lista salen de sus servicios, cada uno con '
                        + 'quien tenga ese servicio. Lo que se puede hacer en cada sitio lo pone el juego.',
                    items: {
                        type: 'object',
                        required: ['kind'],
                        properties: {
                            kind: { type: 'string', enum: Object.keys(PLACE_KINDS), description: 'Qué clase de sitio es.' },
                            name: { type: 'string', description: 'Su nombre aquí: «El Agua Azul». Sin él, el de su clase: «La posada».' },
                            keeper: { type: 'string', description: 'Quién lo atiende: el nombre de alguien de la gente del paquete. Sin él, el primero de aquí con ese servicio.' },
                            description: { type: 'string', description: 'Una línea, si hace falta.' },
                        },
                    },
                },
                sights: {
                    type: 'array',
                    description: 'Lo que se puede examinar aquí (J10.2): dos o tres cosas concretas de este sitio, '
                        + 'cada una con su tirada. Salen como «Examinar…» antes que las genéricas. Una tirada buena '
                        + 'aquí también encuentra la pista de un hito que se busca aquí (`asks.clues`): así se esconde un secreto.',
                    items: {
                        type: 'object',
                        required: ['text'],
                        properties: {
                            verbo: { type: 'string', description: 'Qué se hace, en infinitivo: «examinar», «mirar», «buscar», «leer». Sin él, «examinar».' },
                            text: { type: 'string', description: 'Sobre qué, corto y concreto: «el hueco del roble», «las huellas de la nieve».' },
                            skill: { type: 'string', enum: Object.keys(SKILLS), description: 'Con qué se tira. Sin ella, investigation.' },
                            found: { type: 'string', description: 'Lo que se ve si la tirada sale bien: una o dos frases llanas.' },
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

    // R1/R10 del roadmap de profundidad: los héroes hechos, para entrar sin crear a nadie.
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
                gender: {
                    type: 'string',
                    enum: ['Mujer', 'Hombre', 'No binario (en masculino)', 'No binario (en femenino)'],
                    description: 'No cambia ninguna regla: dice cómo le habla el texto. Quien es no binario lleva detrás si en masculino o en femenino.',
                },
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

    // J8.1 de ROADMAP_SIN_CONEXION: las charlas con ramas. Quien habla, lo que dice con su
    // gesto, y lo que se le puede contestar según quién eres y cómo va la historia.
    const condition = {
        type: 'object',
        description: 'Todo lo que se escriba tiene que cumplirse. Una lista de estos objetos: basta con uno. '
            + 'Lo de quién eres (species, class, background, gender), el hito y said, si no se cumplen, esconden la opción; '
            + 'attitude (min), item y gold la enseñan apagada, diciendo qué falta.',
        properties: {
            attitude: {
                description: `Cómo os mira quien habla, de ${ATTITUDE.min} a ${ATTITUDE.max}. Un número es «al menos»; `
                    + 'o {"min": 1} / {"max": -1}.',
                anyOf: [{ type: 'integer' }, { type: 'object', properties: { min: { type: 'integer' }, max: { type: 'integer' } } }],
            },
            milestone: {
                description: 'Un hito del hilo, por su id. Solo el id es «cumplido»; con is: open (abierto), done (cumplido) o not-done.',
                anyOf: [{ type: 'string' }, { type: 'object', required: ['id'], properties: { id: { type: 'string' }, is: { type: 'string', enum: MILESTONE_STATES } } }],
            },
            item: { type: 'string', description: 'Algo que lleva el grupo, por su nombre en items.' },
            gold: { type: 'integer', description: 'El oro que hace falta llevar.' },
            species: { anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }], description: 'La especie, como la llama el compendio: Enano, Elfo, Humano… Sale como «[Enano] …».' },
            class: { anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }], description: 'La clase: Clérigo, Soldado, Pícaro… Sale como «[Clérigo] …».' },
            background: { anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }], description: 'El trasfondo: soldado, criminal, erudito, acolito, forastero, artesano, noble, marinero, charlatan, ermitano.' },
            gender: { type: 'string', enum: ['Mujer', 'Hombre'], description: 'Cómo le habla el texto a quien juega: Mujer, en femenino; Hombre, en masculino (también a quien es no binario y lo eligió así).' },
            said: { type: 'string', description: 'El id de una opción de esta charla que ya se eligió.' },
        },
    };
    // Lo que se repite (condición, efecto, rama) va una vez, en `definitions`, y se nombra con
    // `$ref`: escrito en cada sitio, el esquema de las charlas ocupaba más que todo lo demás.
    const ref = (/** @type {string} */ name) => ({ $ref: `#/definitions/${name}` });
    const conditions = { anyOf: [ref('dialogueCondition'), { type: 'array', items: ref('dialogueCondition') }] };
    const effect = {
        type: 'object',
        minProperties: 1,
        description: `Una cosa por objeto. Los que hay: ${EFFECT_KINDS.join(', ')}.`,
        properties: {
            attitude: { type: 'integer', description: '+1 o -1: cómo os mira. Sin who, quien habla.' },
            clue: { type: 'string', description: 'Algo que se aprende: queda en el Diario.' },
            rumor: { type: 'string', description: 'El id de un rumor de rumors: se da por oído.' },
            milestone: { type: 'string', description: 'El id de un hito: se cumple.' },
            give: { type: 'string', description: 'Un objeto que os da, por su nombre.' },
            take: { type: 'string', description: 'Un objeto que os quita, por su nombre.' },
            bond: { type: 'integer', description: 'Puntos de vínculo con un compañero. Sin who, quien habla.' },
            gold: { type: 'integer', description: 'Oro que os da (positivo) o que pagáis (negativo).' },
            who: { type: 'string', description: 'Con attitude o bond: con quién, si no es quien habla.' },
            time: { type: 'boolean', description: 'Se va un rato del día.' },
            end: { type: 'boolean', description: 'Se acaba la charla.' },
        },
    };
    const branch = {
        type: 'object',
        properties: {
            next: { type: 'string', description: 'El nudo al que lleva.' },
            effects: { type: 'array', items: ref('dialogueEffect') },
            journal: { type: 'string', description: 'Lo que queda en el Diario.' },
            end: { type: 'boolean' },
        },
    };
    const dialogues = {
        type: 'array',
        description: 'Charlas escritas con ramas, para la gente que importa. Se juegan sin modelo: quien habla dice su línea '
            + 'con su gesto, y quien juega elige. Lo ya dicho no vuelve a salir, y lo aprendido queda en el Diario.',
        definitions: { dialogueCondition: condition, dialogueEffect: effect, dialogueBranch: branch },
        items: {
            type: 'object',
            required: ['id', 'speaker', 'nodes'],
            properties: {
                id: { type: 'string', description: 'Único en el paquete: es lo que la partida recuerda.' },
                speaker: { type: 'string', description: 'Quién habla: el nombre de alguien de npcs o de confidants.' },
                title: { type: 'string' },
                start: { type: 'string', description: 'El nudo por el que empieza. Sin él, el primero.' },
                when: { ...conditions, description: 'Cuándo se ofrece. Una persona puede tener varias charlas: vale la primera que se cumpla.' },
                nodes: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: ['id', 'line'],
                        properties: {
                            id: { type: 'string' },
                            line: { type: 'string', description: 'Lo que dice, en una a tres frases llanas. Con {forma|forma} donde se habla a quien juega.' },
                            again: { type: 'string', description: 'Lo que dice si ya os lo había dicho: más corto.' },
                            mood: { type: 'string', enum: MOODS, description: 'La cara del retrato.' },
                            journal: { type: 'string', description: 'Lo que queda en el Diario al oírlo.' },
                            effects: { type: 'array', items: ref('dialogueEffect'), description: 'Lo que pasa al oírlo la primera vez, se llegue por donde se llegue (el hito que cumple lo que cuenta).' },
                            options: {
                                type: 'array',
                                description: 'Sin opciones, el nudo acaba la charla.',
                                items: {
                                    type: 'object',
                                    required: ['text'],
                                    properties: {
                                        id: { type: 'string', description: 'Único en la charla. Lo ya elegido no vuelve a salir.' },
                                        text: { type: 'string', description: 'Lo que dice o hace quien juega.' },
                                        if: conditions,
                                        next: { type: 'string', description: 'El nudo al que lleva. Sin él, se queda en este.' },
                                        effects: { type: 'array', items: ref('dialogueEffect') },
                                        end: { type: 'boolean', description: 'Acaba la charla.' },
                                        repeat: { type: 'boolean', description: 'Se puede elegir más de una vez («Me voy»).' },
                                        hidden: { type: 'boolean', description: 'Si no se cumple, no se enseña ni apagada.' },
                                        tag: { type: 'string', description: 'La etiqueta de delante, si no vale la de su condición.' },
                                        journal: { type: 'string' },
                                        check: {
                                            type: 'object',
                                            required: ['skill', 'success', 'failure'],
                                            description: 'Una tirada: bien, a medias (sin escribirla, como bien pero pagando) o mal.',
                                            properties: {
                                                skill: { type: 'string', enum: Object.keys(SKILLS) },
                                                dc: { type: 'integer', description: `De ${DC_LIMITS.min} a ${DC_LIMITS.max}; ${DEFAULT_DC} es un intento normal.` },
                                                success: ref('dialogueBranch'),
                                                partial: ref('dialogueBranch'),
                                                failure: ref('dialogueBranch'),
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    };

    // J5.2 y J9.2: el hilo, que el Gem no conocía. Sus hitos (qué los abre, qué piden y qué
    // cambian), el prólogo, los finales y, en los hitos importantes, su escena jugada: líneas
    // con quien las dice y su cara, y una o dos decisiones escritas como opciones de charla.
    const sceneLine = {
        type: 'object',
        required: ['text'],
        properties: {
            who: { type: 'string', description: 'Quién lo dice: alguien de npcs o de confidants, con su nombre exacto (sale su retrato). Sin who, lo cuenta el narrador, sin retrato.' },
            mood: { type: 'string', enum: MOODS, description: 'La cara del retrato.' },
            text: { type: 'string', description: 'De una a tres frases llanas, sin acertijos. Con {forma|forma} donde se habla a quien juega.' },
        },
    };
    const reply = { anyOf: [ref('sceneLine'), { type: 'array', items: ref('sceneLine') }] };
    const sceneBranch = {
        type: 'object',
        properties: {
            effects: { type: 'array', items: ref('dialogueEffect') },
            journal: { type: 'string', description: 'Lo que queda en el Diario.' },
            reply: { ...reply, description: 'Lo que se oye si sale así.' },
        },
    };
    const beat = {
        type: 'object',
        required: ['text'],
        properties: {
            ...sceneLine.properties,
            options: {
                type: 'array',
                description: 'Una decisión, tras esta línea: lo que puede decir o hacer quien juega. Como las opciones de una charla, '
                    + 'pero sin next: la escena sigue. Los efectos sin who son con quien dice la línea; si la dice el narrador, '
                    + 'attitude y bond llevan who.',
                items: {
                    type: 'object',
                    required: ['text'],
                    properties: {
                        id: { type: 'string', description: 'Único en la decisión.' },
                        text: { type: 'string', description: 'Lo que dice o hace quien juega.' },
                        if: conditions,
                        effects: { type: 'array', items: ref('dialogueEffect') },
                        reply: { ...reply, description: 'Lo que se oye al elegirla: una línea o varias.' },
                        tag: { type: 'string' },
                        hidden: { type: 'boolean' },
                        journal: { type: 'string' },
                        check: {
                            type: 'object',
                            required: ['skill', 'success', 'failure'],
                            properties: {
                                skill: { type: 'string', enum: Object.keys(SKILLS) },
                                dc: { type: 'integer', description: `De ${DC_LIMITS.min} a ${DC_LIMITS.max}; ${DEFAULT_DC} es un intento normal.` },
                                success: ref('sceneBranch'),
                                partial: ref('sceneBranch'),
                                failure: ref('sceneBranch'),
                            },
                        },
                    },
                },
            },
        },
    };
    const names = (/** @type {string} */ description) => ({ type: 'array', items: { type: 'string' }, description });
    const standing = { type: 'object', additionalProperties: { type: 'integer' }, description: 'Cómo os mira cada facción, por su id: {"los-vistani": 1}.' };
    const milestone = {
        type: 'object',
        required: ['id', 'title', 'hint', 'scene', 'opens', 'asks'],
        properties: {
            id: { type: 'string', description: 'Único en el hilo: es a lo que apuntan opens, changes y las charlas.' },
            act: { type: 'integer', minimum: 1, maximum: 3 },
            title: { type: 'string' },
            hint: { type: 'string', description: 'Lo que se ve en pantalla mientras está abierto: qué hacer y dónde, en una frase.' },
            scene: { type: 'string', description: 'Lo que pasa al abrirse, en dos a cuatro frases. Hace falta aunque traiga beats: es lo que lee el narrador.' },
            beats: {
                type: 'array',
                items: beat,
                description: 'Solo en los hitos importantes: la escena jugada, de 3 a 8 líneas, con una o dos decisiones que cambien algo '
                    + '(cómo os mira alguien, un rumor, un objeto, un hito). Ejemplo: [{"text": "Llegas al muelle al caer la tarde."}, '
                    + '{"who": "Tomás", "mood": "enfadado", "text": "¡Al ladrón!", "options": [{"id": "yo", "text": "¡Yo lo paro!", '
                    + '"effects": [{"attitude": 1}], "reply": {"who": "Tomás", "mood": "alegre", "text": "¡Gracias!"}}]}].',
            },
            sceneDialogue: { type: 'string', description: 'El id de una charla de dialogues que se abre al acabar la escena.' },
            backdrop: { type: 'string', description: `Dónde pasa la escena, para el fondo: ${Object.keys(PLACE_KINDS).join(', ')}, o el nombre de una localización.` },
            prologue: {
                type: 'boolean',
                description: 'Del prólogo: los primeros hitos, hasta la prueba (el último del prólogo que pide ganar un tablero). '
                    + 'Ganar la prueba da el prólogo entero por hecho, aunque se haya saltado algo.',
            },
            hidden: { type: 'boolean', description: 'Un secreto: no se ve hasta que se cumple por casualidad.' },
            within: { type: 'integer', description: 'Días para cumplirlo desde que se abre. Sin él, sin plazo.' },
            late: {
                type: 'object',
                description: 'Lo que pasa si se pasa el plazo.',
                properties: { reveal: names('Localizaciones que se ponen en el mapa.'), open: names('Hitos que se abren.'), standing },
            },
            backgrounds: { type: 'array', items: { type: 'string', enum: Object.keys(BACKGROUNDS) }, description: 'Solo para héroes con uno de estos trasfondos. Sin nada, para todos.' },
            opens: {
                type: 'object',
                required: ['kind'],
                description: 'Qué lo abre. start: al empezar. after: al cumplirse milestone. arrive: al llegar a place. '
                    + 'contract: al entregar el encargo id. day: el día day. clock: cuando la facción faction llena su reloj.',
                properties: {
                    kind: { type: 'string', enum: OPENS },
                    milestone: { type: 'string' }, place: { type: 'string' }, id: { type: 'string' }, day: { type: 'integer' }, faction: { type: 'string' },
                },
            },
            asks: {
                type: 'object',
                required: ['kind'],
                description: 'Qué pide. arrive: llegar a place. win: ganar el tablero board (su name). defeat: derrotar a enemy. '
                    + 'talk: hablar con npc. check: sacar una tirada de skill. contract: entregar el encargo id, o uno de faction '
                    + '(against: en su contra). none: nada, se cumple al abrirse. any: cualquiera de options. clues: need pistas, '
                    + 'cada una una tirada en un sitio.',
                properties: {
                    kind: { type: 'string', enum: ASKS },
                    place: { type: 'string' }, board: { type: 'string' }, enemy: { type: 'string' }, npc: { type: 'string' },
                    skill: { type: 'string', enum: Object.keys(SKILLS) }, id: { type: 'string' }, faction: { type: 'string' },
                    against: { type: 'boolean' }, need: { type: 'integer' },
                    options: { type: 'array', items: { type: 'object', required: ['kind'], properties: { kind: { type: 'string' } } } },
                    clues: { type: 'array', items: { type: 'object', required: ['place', 'skill'], properties: { place: { type: 'string' }, skill: { type: 'string', enum: Object.keys(SKILLS) } } } },
                },
            },
            changes: {
                type: 'object',
                description: 'Lo que cambia al cumplirse.',
                properties: {
                    reveal: names('Localizaciones ocultas que se ponen en el mapa.'),
                    open: names('Hitos que se abren.'),
                    close: names('Hitos que se cierran para siempre: el camino que no se tomó.'),
                    standing,
                    ending: { type: 'string', description: 'El final al que lleva, de endings.' },
                    endingBy: { type: 'object', additionalProperties: { type: 'string' }, description: 'El final según con quién os hayáis aliado: {"id-de-faccion": "id-de-final"}; decide la que mejor os mire.' },
                },
            },
        },
    };
    const plot = {
        type: 'object',
        required: ['milestones'],
        description: 'El hilo de la campaña: lo que tienes entre manos en cada momento, de la primera escena a uno de sus finales.',
        definitions: { dialogueCondition: condition, dialogueEffect: effect, sceneLine, sceneBranch },
        properties: {
            title: { type: 'string' },
            milestones: { type: 'array', items: milestone },
            endings: {
                type: 'object',
                description: 'Los finales, por su id.',
                additionalProperties: {
                    type: 'object',
                    required: ['title', 'scene'],
                    properties: {
                        title: { type: 'string' },
                        scene: { type: 'string' },
                        epilogues: {
                            type: 'array',
                            items: {
                                type: 'object',
                                required: ['who', 'text'],
                                properties: {
                                    who: { type: 'string', description: 'De quién: alguien de npcs o de confidants, o una facción de world.factions, por su nombre.' },
                                    text: { type: 'string', description: 'Una o dos frases llanas: qué fue de él, de ella o de la facción con este final.' },
                                },
                            },
                            description: 'Qué fue de la gente con este final: una línea por persona o facción que haya pesado en la historia (3 a 5). Sin ellos, el juego los saca de cómo os miran las facciones al acabar.',
                        },
                    },
                },
            },
            omens: {
                type: 'array',
                maxItems: 3,
                description: 'El presagio: hasta tres frases al empezar, cada una ligada al hito que la cumple.',
                items: { type: 'object', required: ['text', 'milestone'], properties: { text: { type: 'string' }, milestone: { type: 'string' } } },
            },
        },
    };

    return { world, locations, boards, bestiary, quests, confidants, items, heroes, dialogues, plot };
}

/** The order the sections are best generated in, and what each one needs first. */
export const SECTION_ORDER = ['world', 'locations', 'confidants', 'bestiary', 'items', 'boards', 'quests', 'heroes', 'dialogues', 'plot'];

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
    // Lo que las charlas y el hilo nombran con `$ref` sube a la raíz: `#/definitions/…` es desde
    // aquí. Las dos secciones comparten las condiciones y los efectos: quedan una vez.
    const { definitions, ...dialogues } = sections.dialogues;
    const { definitions: plotDefinitions, ...plot } = sections.plot;

    return {
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: 'Paquete de campaña',
        description: 'Una campaña completa lista para importar: el mundo, sus compañeros, '
            + 'su bestiario, sus tableros, sus misiones y su hilo.',
        type: 'object',
        required: ['version', 'world'],
        definitions: { ...definitions, ...plotDefinitions },
        properties: {
            version: {
                type: 'integer',
                const: CAMPAIGN_PACK_VERSION,
                description: 'Versión del contrato con la que se escribió este paquete.',
            },
            ...sections,
            dialogues,
            plot,
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
        // J12.8 a J12.12: los tableros hechos de un mapa dibujado.
        'Solo un tablero hecho de un mapa dibujado lleva `image` y `grid`, y su `map` mide lo mismo que la cuadrícula (lo escribe `tools/mapa-a-tablero.mjs` a partir de la imagen). Sin imagen, no escribas ninguno de los dos. Las `zones` (las salas con nombre) sí valen en cualquier tablero.',
        // J8.1: las charlas con ramas.
        'En `dialogues`, el `speaker` de cada charla es alguien de `npcs` o de `confidants`, cada `next` lleva a un nudo que existe, y a todos los nudos se llega desde el de inicio. Un hito, un rumor o un objeto de una condición o de un efecto se nombra como está en el paquete (el hito y el rumor, por su id).',
        'En una charla, lo que depende de quién eres (`species`, `class`, `background`, `gender`) solo le sale a quien encaja, con su etiqueta delante: «[Enano] …». Cada tirada lleva `success` y `failure`; `partial` es opcional. Las líneas son de una a tres frases llanas, sin acertijos, con `{forma|forma}` donde se habla a quien juega.',
        // J5.2 y J9.2: el hilo y sus escenas.
        'En `plot`, cada `opens.milestone`, `changes.open` y `changes.close` nombra un hito del hilo por su id, cada `asks.board` un tablero por su `name`, y cada `changes.ending` un final de `endings`. El primer hito se abre con `start`: es la mecha de la campaña.',
        'Los hitos importantes traen su escena en `beats`: de 3 a 8 líneas, cada una de alguien de `npcs` o `confidants` (sin `who`, del narrador), y una o dos decisiones que cambien algo: cómo os mira alguien, un rumor, un objeto o un hito. `scene` sigue haciendo falta: es lo que lee el narrador. `sceneDialogue` nombra una charla de `dialogues` por su id.',
        // D-J18: los epílogos.
        'Cada final de `plot.endings` trae sus `epilogues`: qué fue de 3 a 5 personas o facciones que pesaron en la historia, una línea cada una. El `who` de cada uno es un nombre de `npcs`, `confidants` o `world.factions`, letra por letra.',
        // D-J15 y D-J17: el género.
        'Donde se le habla a quien juega —la sinopsis, la `description` de un compañero y sus escenas, las del hilo y sus finales, los epílogos, las charlas, los rumores, las misiones y el `twist` de un encargo—, lo que concuerda con su género lleva sus dos formas entre llaves: «Eres {un mercenario|una mercenaria}»; al grupo, en plural: «estáis {hechos|hechas}». Solo dos formas: quien es no binario elige si el texto le habla en masculino o en femenino. En los demás campos (la gente, los objetos, el resto de un encargo), escribe sin nada que concuerde con quien juega. Nunca «cansado/a».',
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
        // Una charla con ramas (J8.1): una opción que solo sale a quien encaja, otra que se
        // gana con aprecio, una tirada con sus tres resultados y un nudo final.
        dialogues: [
            {
                id: 'mira-el-sotano',
                speaker: 'Mira la Molinera',
                start: 'puerta',
                nodes: [
                    {
                        id: 'puerta',
                        mood: 'triste',
                        line: 'No bajéis al sótano. Mi padre bajó una noche y no volvió a ser el mismo.',
                        again: '¿Otra vez vosotros? Ya os he dicho lo que sé.',
                        options: [
                            { id: 'padre', text: '¿Qué le pasó a tu padre?', next: 'padre' },
                            { id: 'enano', text: 'Los sótanos no me asustan: me crié en uno.', if: { species: 'Enano' }, effects: [{ attitude: 1 }], next: 'risa' },
                            { id: 'llave', text: 'Déjanos la llave de la trampilla.', if: { attitude: 1 }, next: 'llave' },
                            {
                                id: 'convencer', text: 'Si no bajamos, los cuervos seguirán aquí.',
                                check: {
                                    skill: 'persuasion', dc: 12,
                                    success: { next: 'llave', effects: [{ attitude: 1 }] },
                                    partial: { next: 'llave', effects: [{ attitude: -1 }] },
                                    failure: { next: 'no' },
                                },
                            },
                            { id: 'adios', text: 'Ya volveremos.', end: true, repeat: true },
                        ],
                    },
                    { id: 'padre', line: 'Subió con los ojos blancos y no habló nunca más de ello.', journal: 'El padre de Mira bajó al sótano y volvió cambiado.', options: [{ id: 'volver', text: 'Lo siento.', next: 'puerta' }] },
                    { id: 'risa', mood: 'alegre', line: 'Pues bajad {tranquilo|tranquila}, que ya somos dos.', options: [{ id: 'seguir', text: 'Sigamos.', next: 'puerta' }] },
                    { id: 'llave', line: 'Tomad la llave, y la hoz de mi padre: abajo os hará falta. Cerrad por fuera al salir.', options: [{ id: 'gracias', text: 'Gracias, Mira.', effects: [{ give: 'Hoz del molino' }, { bond: 1 }], end: true }] },
                    { id: 'no', mood: 'enfadado', line: 'He dicho que no. Idos.' },
                ],
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
