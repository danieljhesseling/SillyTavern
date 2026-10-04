/**
 * Los huecos de una campaña, rellenos con el motor (J5.3 y J12.5 de ROADMAP_SIN_CONEXION).
 *
 * Una campaña que llega de tu Gem puede traer solo la historia y las misiones: sin tableros,
 * sin bichos y sin describir sus sitios. Aquí se rellena lo que falta, sin inventar la
 * campaña:
 *
 * - **Tableros**: una misión sin tablero, un hito que pide ganar en uno que no existe, un
 *   encargo con pelea, una mazmorra vacía o un tablero escrito sin mapa se dibujan con la
 *   semilla (`dungeon-generator.js` y `board-intent.js`, como los encargos del tablón). Un
 *   tablero con mapa pero sin dónde empezar, o con enemigos sin casilla, se completa (J12.5).
 *   Uno con una sala cerrada, con alguien dentro y sin puerta por la que entrar (la Mansión
 *   del Burgomaestre de tu JSON de Strahd), recibe una puerta en la pared que la separa.
 * - **Bichos**: el que una misión nombra y el bestiario no trae sale del bestiario del juego
 *   (`compendio/bestiario.json`) si se llama igual; si no, con los números de su desafío.
 *   Un tablero dibujado sin nadie que poner saca a los suyos del bestiario del juego, por el
 *   bioma del sitio.
 * - **Frases**: la localización sin descripción, la misión sin texto, el hito sin escena y el
 *   final sin contar toman las frases de relleno del narrador del motor
 *   (`compendio/frases.json`, las filas `relleno-*`).
 * - **El hilo**: un hito que dice de qué misión es (`quest`) toma de ella su título, su escena y
 *   lo que pide; uno sin `opens` va detrás del anterior; y si nada lleva a un final, el último
 *   lleva a uno. Una campaña sin hilo y con sus misiones repartidas en actos (tu JSON de Strahd
 *   solo trae misiones, del acto 1 al 5) lo saca de ellas: un hito por misión, acto a acto.
 * - **Salas y tesoros** (J5.2): el encuentro de cada sala (`zones[].enemies`) se pone en sus
 *   casillas; el tesoro de una sala (`zones[].treasure`) o de un sitio (`locations[].treasure`),
 *   en un cofre que no corta el paso (`chests`, que abre `party/loot.js`). Un sitio con tesoro y
 *   sin tablero recibe uno pequeño, sin pelea.
 * - **Quién lo cuenta** (J5.2): un hito con `pov` (o de un capítulo con `pov`) y sin escena
 *   jugada sale en boca de esa persona, con su retrato.
 * - **Trampas** (J5.2): la que viene sin casilla, o en un tablero que se dibuja con la semilla (su
 *   casilla era de otro mapa), se pone en el camino, lejos de donde empieza el grupo. El estado que
 *   deja, escrito en castellano («derribado»), pasa a la clave del juego (`prone`).
 * - **Un dibujo sin mapa** (J12.5): un tablero con `image` que no trae `map` (y que
 *   `pack-maps.js` no ha podido leer) se dibuja con la semilla, sin el dibujo, que no casaría.
 *
 * Todo con la semilla de la campaña: la misma campaña da siempre los mismos tableros. Lo que
 * se rellena se dice, cosa a cosa (`FillNote`): un paquete reescrito en silencio es un paquete
 * del que su autor no aprende nada.
 *
 * Puro: el compendio entra como argumento. Sin él, los bichos salen con los números de su
 * desafío y las descripciones se quedan como estaban.
 */

import { generateBoard } from '../world-builder/dungeon-generator.js';
import { generateIntended, budgetFor, threatOf } from '../world-builder/board-intent.js';
import { createSeededRandom } from '../combat/seeded-random.js';
import { readLevelRange } from '../combat/level-adjust.js';
import { baselineFor, breedBand, PROFILES } from '../compendio/bestiary.js';
import { traitsOf } from '../combat/monster-traits.js';
import { pickWeighted } from '../compendio/compendio.js';
import { derive, cleanSeed } from './seed.js';
import { walkable } from './board-draft.js';
import { zoneCells } from '../board/zones.js';
import { terrainFromAsciiMap } from '../board/terrain.js';
import { floodFrom } from '../board/reachability.js';
import { TRAP_CONDITIONS } from './campaign-pack-schema.js';
import { STATUS_ICONS } from '../combat/initiative-tracker.js';

/**
 * @typedef {Object} FillNote Una cosa que ha puesto el motor.
 * @property {'tablero'|'criatura'|'sitio'|'tipo'|'camino'|'texto'|'hilo'|'historia'|'final'|'aliado'|'sala'|'cofre'|'objeto'|'voz'|'mapa'|'puerta'|'trampa'} kind
 * @property {string} name Lo que se ha puesto: el tablero, el bicho, el sitio.
 * @property {string} detail Para qué, en una frase corta: «para la misión «Los lobos»».
 */

/** Cómo se dice cada clase de cosa puesta, en singular y en plural. */
export const FILL_KINDS = {
    tablero: ['tablero dibujado con la semilla', 'tableros dibujados con la semilla'],
    criatura: ['criatura', 'criaturas'],
    sitio: ['localización que la historia nombra', 'localizaciones que la historia nombra'],
    tipo: ['localización sin tipo, por su nombre', 'localizaciones sin tipo, por su nombre'],
    camino: ['camino a una localización suelta', 'caminos a localizaciones sueltas'],
    texto: ['texto del narrador del motor', 'textos del narrador del motor'],
    hilo: ['hito completado', 'hitos completados'],
    historia: ['hilo sacado de las misiones', 'hilos sacados de las misiones'],
    final: ['final', 'finales'],
    aliado: ['compañero que una misión pide proteger', 'compañeros que una misión pide proteger'],
    // J5.2: lo que un módulo cuenta sala a sala y sitio a sitio, y quién cuenta cada trozo.
    sala: ['sala con su encuentro puesto', 'salas con su encuentro puesto'],
    cofre: ['cofre con su tesoro', 'cofres con su tesoro'],
    objeto: ['objeto de un tesoro, hecho sencillo', 'objetos de un tesoro, hechos sencillos'],
    voz: ['escena contada por quien la vive', 'escenas contadas por quien las vive'],
    // J12.5: un tablero con su dibujo y sin mapa, leído del dibujo (`pack-maps.js`).
    mapa: ['tablero leído de su dibujo', 'tableros leídos de su dibujo'],
    // J5.3: una sala cerrada con alguien dentro, con una puerta para llegar.
    puerta: ['puerta para entrar en una sala cerrada', 'puertas para entrar en salas cerradas'],
    // J5.2: una trampa sin casilla, o de un tablero que se ha dibujado con la semilla.
    trampa: ['trampa puesta en el camino', 'trampas puestas en el camino'],
};

/**
 * El estado que deja una trampa, por su nombre en castellano y sin el género («derribada»,
 * «envenenado»), a la clave del juego (`STATUS_ICONS`).
 *
 * @param {string} word
 * @returns {string} La clave, o '' si no se entiende.
 */
function trapConditionKey(word) {
    const stem = (/** @type {string} */ value) => plain(value).replace(/[ao]s?$/, '');
    const wanted = stem(word);
    if (!wanted) return '';
    return TRAP_CONDITIONS.find(key => stem(key) === wanted
        || stem(/** @type {Record<string, {label: string}>} */ (STATUS_ICONS)[key]?.label ?? '') === wanted) ?? '';
}

/** Qué clase de sitio es, por las palabras de su nombre. En orden: la primera que encaja. */
const TYPE_WORDS = /** @type {Array<[string, RegExp]>} */ ([
    ['dungeon', /cripta|mazmorra|catacumba|pozo|sotano|mina\b|minas|cueva|gruta|tunel|cloaca|tumba|osario|subterr/],
    ['sanctuary', /templo|santuario|capilla|ermita|abadia|monasterio|iglesia/],
    ['camp', /campamento|acampada/],
    ['outpost', /atalaya|fuerte|puesto|avanzada|empalizada|guarnicion/],
    ['ruins', /ruina|castillo|torre|fortaleza|mansion|palacio|molino|granja/],
    ['city', /ciudad|capital|puerto|urbe/],
    ['village', /aldea|pueblo|villa|caserio|arrabal|poblado/],
]);

/** Cada tipo de sitio, dicho. */
const TYPE_LABELS = /** @type {Record<string, string>} */ ({
    city: 'una ciudad', village: 'una aldea', outpost: 'un puesto', ruins: 'unas ruinas', dungeon: 'una mazmorra',
    camp: 'un campamento', sanctuary: 'un santuario', wilderness: 'campo abierto',
});

/** El bioma del bestiario del juego, por las palabras del sitio; si no, por su tipo. */
const BIOME_WORDS = /** @type {Array<[string, RegExp]>} */ ([
    ['cripta', /cripta|tumba|osario|panteon|catacumba|cementerio/],
    ['pantano', /pantano|cienaga|marisma/],
    ['cueva', /cueva|gruta|mina\b|minas|pozo|sotano|tunel/],
    ['montana', /montana|monte\b|pico|risco|paso de/],
    ['costa', /costa|playa|acantilado/],
    ['bosque', /bosque|arboleda|selva|claro/],
    ['ciudad', /ciudad|calle|barrio|mercado|puerto/],
    ['ruina', /ruina|castillo|torre|mansion|fortaleza/],
    ['llanura', /llanura|pradera|valle/],
    ['camino', /camino|sendero|cruce|posada/],
]);
const BIOME_OF_TYPE = /** @type {Record<string, string>} */ ({
    dungeon: 'cueva', ruins: 'ruina', wilderness: 'bosque', city: 'ciudad', village: 'camino',
    outpost: 'camino', camp: 'bosque', sanctuary: 'ruina',
});

/** La forma del tablero, por el tipo del sitio. Lo demás, salas y pasillos. */
const SHAPE_OF_TYPE = /** @type {Record<string, string>} */ ({ camp: 'camp', sanctuary: 'temple', wilderness: 'cave' });

/** Los tipos de sitio donde se pelea, para una misión que no dice dónde. */
const FIGHT_TYPES = ['dungeon', 'ruins', 'wilderness', 'camp', 'outpost'];

/** Los tamaños que entiende el generador. */
const SIZES = ['small', 'medium', 'large'];
/** Las formas que entiende el generador. */
const SHAPES = ['rooms', 'cave', 'camp', 'temple'];

/** Las puertas: se cruzan (se abren), pero no se empieza ni se espera encima. */
const DOORS = new Set(['D', 'L', 'o']);

/** Lo que pide cada objetivo al generador. Ni «aguantar» ni «robar»: dejan gente y llaves fuera del mapa. */
const PURPOSE_OF_OBJECTIVE = /** @type {Record<string, string>} */ ({
    eliminate: 'hunt', reach_cell: 'recover', escort: 'escort', loot: 'recover',
});

/** Los encargos, a los propósitos que caben en un tablero del paquete. */
const PURPOSE_OF_CONTRACT = /** @type {Record<string, string>} */ ({
    cull: 'cull', hunt: 'hunt', escort: 'escort', recover: 'recover', hold: 'cull', steal: 'recover', silence: 'hunt',
});

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();
/** @param {any} value @returns {string} */
const low = (value) => text(value).toLowerCase();
/** @param {any} value @returns {string} */
const plain = (value) => low(value).normalize('NFD').replace(/\p{M}/gu, '');
/** @param {any} value @returns {any[]} */
const list = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);
/** @param {any} value @returns {string} */
const slug = (value) => plain(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/**
 * Una lista dicha: «a», «a y b», «a, b y c».
 *
 * @param {string[]} items
 * @returns {string}
 */
const sayList = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`);

/**
 * Qué clase de sitio es uno que la campaña no dice, por su nombre.
 *
 * @param {string} name
 * @returns {string} Un tipo de `LOCATION_TYPES`.
 */
export function guessPlaceType(name) {
    const words = plain(name);
    return TYPE_WORDS.find(([, pattern]) => pattern.test(words))?.[0] ?? 'wilderness';
}

/**
 * El bioma del bestiario del juego para un sitio: el suyo si lo dice, el de sus palabras o
 * el de su tipo.
 *
 * @param {any} place
 * @param {string} name
 * @returns {string}
 */
function biomeOf(place, name) {
    if (text(place?.biome)) return plain(place.biome);
    const words = plain(`${name} ${text(place?.region)}`);
    return BIOME_WORDS.find(([, pattern]) => pattern.test(words))?.[0]
        ?? BIOME_OF_TYPE[text(place?.type) || guessPlaceType(name)] ?? '';
}

/**
 * El desafío de un bicho corriente y el de uno al que se va a buscar, por el nivel del grupo.
 *
 * @param {number} level
 * @param {boolean} leader
 * @returns {number}
 */
function crFor(level, leader) {
    if (leader) return Math.max(1, level);
    if (level <= 1) return 0.25;
    if (level <= 3) return 0.5;
    if (level <= 6) return 1;
    return Math.round(level / 3);
}

/**
 * Un bicho con los números de su desafío, y lo demás de un arquetipo del bestiario del juego
 * si lo hay (como `breedMonster`, sin plantillas: el nombre es el que la campaña escribió).
 *
 * @param {string} name
 * @param {number} cr
 * @param {any} [archetype]
 * @returns {any}
 */
function creatureOf(name, cr, archetype = null) {
    const base = baselineFor(cr);
    const profile = text(archetype?.profile);
    const abilities = list(archetype?.abilities).map(text).filter(Boolean);
    return {
        name,
        hp: Math.max(1, Math.round(base.hp * (Number(archetype?.hpFactor) || 1))),
        armorClass: Math.max(5, base.armorClass + (Number(archetype?.acBonus) || 0)),
        cr,
        profile: PROFILES.includes(profile) ? profile : 'aggressive',
        attackRangeFeet: Math.max(5, Number(archetype?.rangeFeet) || 5),
        ...(abilities.length > 0 ? { abilities } : {}),
        // Lo que resiste y si se regenera (`combat/monster-traits.js`).
        ...traitsOf(archetype),
        description: [text(archetype?.quirk), text(archetype?.weakness)].filter(Boolean).join(' '),
    };
}

/**
 * Las casillas de un mapa: dónde se puede estar y cuánto se tarda en llegar desde una.
 *
 * @param {string[]} map
 * @param {{x: number, y: number}} from
 * @returns {Map<string, number>} Las casillas a las que se llega (abriendo puertas), con sus pasos.
 */
function stepsFrom(map, from) {
    /** @type {Map<string, number>} */
    const seen = new Map([[`${from.x},${from.y}`, 0]]);
    const queue = [from];
    while (queue.length > 0) {
        const at = /** @type {{x: number, y: number}} */ (queue.shift());
        const d = /** @type {number} */ (seen.get(`${at.x},${at.y}`));
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const x = at.x + dx;
            const y = at.y + dy;
            const cell = map[y]?.[x];
            if (cell === undefined || seen.has(`${x},${y}`) || (!walkable(cell) && !DOORS.has(cell))) continue;
            seen.set(`${x},${y}`, d + 1);
            queue.push({ x, y });
        }
    }
    return seen;
}

/**
 * @param {string[]} map
 * @param {number} x
 * @param {number} y
 * @returns {boolean} Si ahí se puede empezar o esperar: suelo que se pisa y no una puerta.
 */
const standable = (map, x, y) => {
    const cell = map[y]?.[x];
    return cell !== undefined && walkable(cell) && !DOORS.has(cell);
};

/**
 * Si un mapa se puede leer: filas de la misma longitud y al menos tres.
 *
 * @param {any} map
 * @returns {boolean}
 */
const readableMap = (map) => Array.isArray(map) && map.length >= 3
    && map.every(row => typeof row === 'string' && row.length === String(map[0]).length && row.length >= 3);

/**
 * Las casillas más lejanas a las que se llega desde el inicio, sin repetir las ya tomadas.
 *
 * @param {string[]} map
 * @param {Array<{x: number, y: number}>} starts
 * @param {Set<string>} taken
 * @returns {Array<{x: number, y: number}>} De la más lejana a la más cercana.
 */
function farCells(map, starts, taken) {
    if (starts.length === 0) return [];
    const steps = stepsFrom(map, starts[0]);
    return [...steps.entries()]
        .map(([key, d]) => ({ x: Number(key.split(',')[0]), y: Number(key.split(',')[1]), d }))
        .filter(c => standable(map, c.x, c.y) && !taken.has(`${c.x},${c.y}`))
        .sort((a, b) => b.d - a.d || a.y - b.y || a.x - b.x)
        .map(({ x, y }) => ({ x, y }));
}

/**
 * Dónde empieza el grupo en un mapa que no lo dice: lo más lejos que se pueda de los enemigos
 * (o, sin ellos, abajo a la izquierda), y hasta tres casillas más a su lado.
 *
 * @param {string[]} map
 * @param {Array<{x: number, y: number}>} enemies Los que tienen casilla.
 * @returns {Array<{x: number, y: number}>}
 */
function startCells(map, enemies) {
    /** @type {Array<{x: number, y: number}>} */
    const open = [];
    for (let y = 0; y < map.length; y++) {
        for (let x = 0; x < map[y].length; x++) if (standable(map, x, y)) open.push({ x, y });
    }
    if (open.length === 0) return [];
    let first = [...open].sort((a, b) => (b.y - a.y) || (a.x - b.x))[0];
    const placed = enemies.filter(e => standable(map, e.x, e.y));
    if (placed.length > 0) {
        const near = stepsFrom(map, placed[0]);
        const far = open.filter(c => near.has(`${c.x},${c.y}`))
            .sort((a, b) => /** @type {number} */ (near.get(`${b.x},${b.y}`)) - /** @type {number} */ (near.get(`${a.x},${a.y}`)));
        if (far.length > 0) first = far[0];
    }
    const around = stepsFrom(map, first);
    return [...around.entries()]
        .map(([key, d]) => ({ x: Number(key.split(',')[0]), y: Number(key.split(',')[1]), d }))
        .filter(c => standable(map, c.x, c.y))
        .sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x)
        .slice(0, 4)
        .map(({ x, y }) => ({ x, y }));
}

/**
 * Una frase de relleno del narrador del motor (`relleno-*` en `frases.json`), con sus huecos.
 *
 * @param {any} compendium
 * @param {string} kind
 * @param {Record<string, string>} facts Los huecos, y el `tipo` del sitio si importa.
 * @param {() => number} random
 * @returns {string} Vacío si no hay compendio o ninguna vale.
 */
function fillerLine(compendium, kind, facts, random) {
    if (!compendium?.has?.('frases')) return '';
    const where = /** @type {Record<string, any>} */ ({ kind });
    if (facts.tipo) where.tipo = facts.tipo;
    const rows = compendium.find('frases', where);
    // Las de su tipo primero: la genérica solo si no hay ninguna escrita para él.
    const own = rows.filter((/** @type {any} */ row) => row.when?.tipo !== undefined);
    const row = pickWeighted(own.length > 0 ? own : rows, random);
    if (!row) return '';
    return text(row.text).replace(/\{([a-z_]+)\}/g, (all, key) => (facts[key] !== undefined ? facts[key] : all));
}

/**
 * Lo que dice el hito mientras está abierto, si no lo dice él: qué hay que hacer y dónde.
 *
 * @param {any} asks
 * @param {Map<string, any>} boardsByName
 * @returns {string}
 */
function hintFor(asks, boardsByName) {
    switch (text(asks?.kind)) {
        case 'arrive': return `Ve a ${text(asks.place)}.`;
        case 'win': {
            const board = boardsByName.get(low(asks.board));
            const where = text(board?.locationName);
            return `Gana en ${text(asks.board)}${where && low(where) !== low(asks.board) ? ` (${where})` : ''}.`;
        }
        case 'defeat': return `Derrota a ${text(asks.enemy)}.`;
        case 'talk': return `Habla con ${text(asks.npc)}.`;
        case 'check': return 'Supera la tirada que pide.';
        default: return '';
    }
}

/**
 * Rellenar los huecos de una campaña.
 *
 * No cambia lo que ya está: un paquete completo sale igual que entró, y sin notas. Rellenar
 * lo ya relleno no pone nada más.
 *
 * @param {any} raw El paquete, en limpio (ya sin la cabecera del Gem).
 * @param {Object} [options]
 * @param {any} [options.compendium] El compendio del juego (`createCompendium`): el bestiario y
 *   las frases de relleno. Mejor uno recién abierto (`freshCompendium`), sin memoria: así la
 *   misma campaña da lo mismo siempre.
 * @param {string} [options.seed] La semilla. Sin ella, la del mundo o su nombre.
 * @returns {{pack: any, filled: FillNote[]}}
 */
export function fillPackGaps(raw, { compendium = null, seed = '' } = {}) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { pack: raw, filled: [] };
    const pack = JSON.parse(JSON.stringify(raw));
    /** @type {FillNote[]} */
    const filled = [];
    /** @type {(kind: FillNote['kind'], name: string, detail: string) => void} */
    const note = (kind, name, detail) => { filled.push({ kind, name, detail }); };

    const world = pack.world && typeof pack.world === 'object' ? pack.world : {};
    const theSeed = cleanSeed(seed) || cleanSeed(world.seed) || cleanSeed(slug(world.name)) || 'campana';
    /** @param {...string} parts */
    const randomOf = (...parts) => createSeededRandom(derive(theSeed, 'relleno', ...parts));

    const quests = list(pack.quests);
    const milestones = list(pack.plot?.milestones);
    const contracts = list(pack.contracts);
    const hadLocations = Array.isArray(pack.locations);
    const locations = list(pack.locations);
    const boards = list(pack.boards);
    const bestiary = list(pack.bestiary);
    const confidants = list(pack.confidants);
    const items = list(pack.items);
    const questKey = (/** @type {any} */ q, /** @type {number} */ i) => text(q?.id) || slug(q?.name) || `mision-${i + 1}`;
    const questById = new Map(quests.map((q, i) => [questKey(q, i), q]));

    // Los actos y el nivel del grupo en cada uno: lo que dice la campaña, o del 1 al 3.
    const acts = Math.max(1, ...quests.map(q => Number(q?.act) || 1), ...milestones.map(m => Number(m?.act) || 1));
    const range = readLevelRange(world.levels) ?? { min: 1, max: 3 };
    /** @param {any} act */
    const levelAt = (act) => {
        const a = Math.min(acts, Math.max(1, Number(act) || 1));
        return acts <= 1 ? range.min : Math.round(range.min + ((range.max - range.min) * (a - 1)) / (acts - 1));
    };

    // ------------------------------------------------------------ las localizaciones
    /** @type {Map<string, any>} */
    const placeByName = new Map(locations.filter(l => text(l?.name)).map(l => [low(l.name), l]));
    /**
     * Declarar un sitio que la historia nombra y el paquete no: con su tipo, por su nombre.
     *
     * @param {any} name
     * @param {string} why
     * @param {boolean} [hidden]
     */
    const mention = (name, why, hidden = false) => {
        const clean = text(name);
        if (!clean || placeByName.has(low(clean))) return;
        const place = { name: clean, type: guessPlaceType(clean), ...(hidden ? { hidden: true } : {}) };
        locations.push(place);
        placeByName.set(low(clean), place);
        note('sitio', clean, why);
    };
    // Solo si la campaña declara sus sitios: si no declara ninguno, salen de los tableros, como siempre.
    if (locations.length > 0 || boards.length === 0) {
        for (const b of boards) mention(b?.locationName, 'un tablero está allí');
        quests.forEach(q => mention(q?.locationName ?? q?.where, `la misión «${text(q?.name)}» se juega allí`));
        for (const c of contracts) mention(c?.where, `el encargo «${text(c?.title)}» se juega allí`);
        for (const m of milestones) {
            for (const asks of [m?.asks, ...list(m?.asks?.options)]) mention(asks?.place, `el hito «${text(m?.title) || text(m?.id)}» pide ir`);
            mention(m?.opens?.place, `el hito «${text(m?.title) || text(m?.id)}» se abre al llegar`);
            for (const clue of list(m?.asks?.clues)) mention(clue?.place, `una pista del hito «${text(m?.title) || text(m?.id)}» está allí`);
            for (const r of [...list(m?.changes?.reveal), ...list(m?.reveal)]) mention(r, `el hito «${text(m?.title) || text(m?.id)}» la descubre`, true);
        }
        for (const p of list(pack.npcs)) mention(p?.where, `${text(p?.name)} vive allí`);
        // Sin ningún sitio, la campaña entera pasa en uno: el que da nombre al mundo.
        if (locations.length === 0 && text(world.name)) {
            locations.push({ name: text(world.name), type: guessPlaceType(world.name) === 'wilderness' ? 'village' : guessPlaceType(world.name) });
            placeByName.set(low(world.name), locations[0]);
            note('sitio', text(world.name), 'la campaña no dice dónde pasa');
        }
    }
    // Un sitio declarado sin tipo toma el de su nombre: es lo que dice qué hay que mirar y qué
    // servicios tiene. Uno con un tipo que no existe se deja: eso lo dice el validador.
    for (const place of locations) {
        if (!text(place?.name) || text(place.type)) continue;
        place.type = guessPlaceType(place.name);
        note('tipo', text(place.name), `no decía qué es: por su nombre, ${TYPE_LABELS[place.type] ?? place.type}`);
    }
    /** El sitio donde se pelea por defecto: el primero de pelea, o el primero. */
    const fightPlace = () => text(locations.find(l => FIGHT_TYPES.includes(text(l?.type)))?.name) || text(locations[0]?.name) || text(world.name);

    // ------------------------------------------------------------ los bichos
    const archetypes = compendium?.has?.('bestiario') ? compendium.find('bestiario', { kind: 'arquetipo' }) : [];
    /** @type {Map<string, any>} */
    const creatureByName = new Map(bestiary.filter(b => text(b?.name)).map(b => [low(b.name), b]));
    /** Los que alguien va a buscar: jefes o no, no se usan de relleno. */
    const leaders = new Set();
    /**
     * Que exista en el bestiario un bicho que la campaña nombra.
     *
     * @param {any} name
     * @param {any} act
     * @param {boolean} leader Si es a quien se va a buscar (un objetivo), no uno más.
     * @param {string} why
     */
    const ensureCreature = (name, act, leader, why) => {
        const clean = text(name);
        if (!clean) return;
        if (leader) leaders.add(low(clean));
        if (creatureByName.has(low(clean))) return;
        const wanted = plain(clean);
        const archetype = [...archetypes]
            .sort((a, b) => plain(b.name).length - plain(a.name).length)
            .find((/** @type {any} */ row) => {
                const own = plain(row?.name);
                return own && (wanted === own || new RegExp(`(^|\\s)${own.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(s|es)?(\\s|$)`).test(wanted));
            }) ?? null;
        // Un bicho del SRD (`cr` en su fila: el trol, 5) sale con su desafío; si es a quien se va
        // a buscar, con el del jefe si es mayor. Los demás, con el del nivel del acto.
        const own = Number(archetype?.cr) > 0 ? Number(archetype.cr) : 0;
        const byAct = crFor(levelAt(act), leader);
        const creature = creatureOf(clean, own > 0 ? (leader ? Math.max(own, byAct) : own) : byAct, archetype);
        bestiary.push(creature);
        creatureByName.set(low(clean), creature);
        note('criatura', clean, archetype
            ? `${why}; del bestiario del juego (${text(archetype.name)})`
            : `${why}; con los números de su desafío`);
    };
    quests.forEach((q, i) => {
        for (const o of list(q?.objectives)) {
            if (text(o?.type) === 'eliminate') ensureCreature(o.target, q.act, true, `la misión «${text(q?.name) || questKey(q, i)}» pide derrotarla`);
        }
        for (const e of list(q?.enemies)) ensureCreature(typeof e === 'string' ? e : e?.name, q.act, false, `sale en la misión «${text(q?.name)}»`);
    });
    for (const b of boards) {
        for (const e of list(b?.enemies)) ensureCreature(typeof e === 'string' ? e : e?.name, 1, false, `está en el tablero «${text(b?.name) || text(b?.id)}»`);
        // J5.2: el encuentro de cada sala.
        for (const z of list(b?.zones)) {
            for (const e of list(z?.enemies)) ensureCreature(typeof e === 'string' ? e : e?.name, 1, false, `espera en la sala «${text(z?.name)}» de «${text(b?.name) || text(b?.id)}»`);
        }
    }
    for (const m of milestones) {
        for (const asks of [m?.asks, ...list(m?.asks?.options)]) {
            if (text(asks?.kind) === 'defeat') ensureCreature(asks.enemy, m.act, true, `el hito «${text(m?.title) || text(m?.id)}» pide derrotarla`);
        }
    }

    // Dónde sale ya cada bicho: el que la campaña pone en un sitio no se lleva a otro.
    /** @type {Map<string, Set<string>>} */
    const tiedTo = new Map();
    /** @param {any} name @param {any} place */
    const tie = (name, place) => {
        const key = low(typeof name === 'string' ? name : name?.name);
        if (!key || !text(place)) return;
        tiedTo.set(key, new Set([...(tiedTo.get(key) ?? []), low(place)]));
    };
    for (const b of boards) for (const e of [...list(b?.enemies), ...list(b?.zones).flatMap(z => list(z?.enemies))]) tie(e, b?.locationName);
    for (const q of quests) for (const e of list(q?.enemies)) tie(e, q?.locationName ?? q?.where);

    /** @type {Map<string, any[]>} Los bichos de relleno de cada bioma y acto, para no criarlos dos veces. */
    const bred = new Map();
    /** @type {Map<string, any>} Los criados que todavía no ha puesto nadie: al bestiario, solo si salen. */
    const pending = new Map();
    /**
     * Pasar al bestiario los criados que un tablero ha puesto.
     *
     * @param {Array<{name: string}>} enemies
     * @param {string} place
     * @param {string} biome
     */
    const commitBred = (enemies, place, biome) => {
        for (const enemy of enemies) {
            const key = low(enemy.name);
            const row = pending.get(key);
            if (!row || creatureByName.has(key)) continue;
            pending.delete(key);
            bestiary.push(row);
            creatureByName.set(key, row);
            tie(row.name, place);
            note('criatura', row.name, `para ${place}, del bestiario del juego (${biome || 'cualquier sitio'})`);
        }
    };
    /**
     * Con quién poblar un tablero dibujado: los bichos de la campaña que no son a quien se va a
     * buscar, que no le vienen grandes al grupo y que no son de otro sitio; si no hay, del
     * bestiario del juego, por el bioma.
     *
     * @param {string} biome
     * @param {number} act
     * @param {string} place
     * @returns {any[]}
     */
    const poolFor = (biome, act, place) => {
        const level = levelAt(act);
        const own = bestiary.filter(b => !leaders.has(low(b?.name)) && !b?.boss && (Number(b?.cr) || 0) <= Math.max(1, level)
            && (!tiedTo.has(low(b?.name)) || /** @type {Set<string>} */ (tiedTo.get(low(b?.name))).has(low(place))));
        if (own.length > 0) return own;
        const key = `${biome}|${act}`;
        if (!bred.has(key)) {
            const band = compendium?.has?.('bestiario')
                ? breedBand({ compendium, howMany: 3, random: randomOf('bichos', biome, String(act)), cr: crFor(level, false), biome })
                : [];
            /** @type {any[]} */
            const kept = [];
            for (const monster of band) {
                if (creatureByName.has(low(monster.name))) {
                    kept.push(creatureByName.get(low(monster.name)));
                    continue;
                }
                // La criatura nueva, sin lo que solo servía para criarla (de dónde sale y su paso).
                const row = /** @type {any} */ ({ ...monster });
                delete row.from;
                delete row.speed;
                pending.set(low(row.name), row);
                kept.push(row);
            }
            bred.set(key, kept);
        }
        return /** @type {any[]} */ (bred.get(key));
    };

    // ------------------------------------------------------------ los tableros
    const boardIds = new Set(boards.map(b => text(b?.id)).filter(Boolean));
    /** @type {Map<string, any>} */
    const boardsByName = new Map(boards.filter(b => text(b?.name)).map(b => [low(b.name), b]));
    /** @param {string} wanted */
    const freeId = (wanted) => {
        const base = slug(wanted) || 'tablero';
        let id = base;
        for (let n = 2; boardIds.has(id); n++) id = `${base}-${n}`;
        return id;
    };
    /** @param {string} place @param {string} what */
    const freeName = (place, what) => {
        const first = text(place) || text(what) || 'Tablero';
        if (!boardsByName.has(low(first))) return first;
        const second = what && low(what) !== low(first) ? `${first} (${text(what)})` : first;
        let name = second;
        for (let n = 2; boardsByName.has(low(name)); n++) name = `${second} ${n}`;
        return name;
    };

    /**
     * Dibujar un tablero con la semilla, con quien la campaña pide y, si cabe, alguno más.
     *
     * @param {Object} input
     * @param {string} input.id
     * @param {string} input.name
     * @param {string} input.place
     * @param {string} [input.purpose]
     * @param {string[]} [input.forced] Quien tiene que estar: a quien se va a buscar primero.
     * @param {boolean} [input.crowd] Si se añaden bichos por presupuesto.
     * @param {any} [input.act]
     * @param {string} [input.size]
     * @param {string} [input.shape]
     * @returns {any}
     */
    const drawBoard = ({ id, name, place, purpose = 'cull', forced = [], crowd = true, act = 1, size = '', shape = '' }) => {
        const where = placeByName.get(low(place));
        const type = text(where?.type) || guessPlaceType(place);
        const biome = biomeOf(where, place);
        const level = levelAt(act);
        const leaderThreat = forced.reduce((sum, n) => sum + threatOf(creatureByName.get(low(n)) ?? {}), 0);
        const budget = budgetFor({ partyLevel: level, partySize: 3, difficulty: 1 }) - leaderThreat;
        const options = crowd && (forced.length === 0 || budget >= 8)
            ? poolFor(biome, act, place).map(c => ({ name: text(c.name), threat: threatOf(c) }))
            : [];
        const drawn = generateIntended({
            randomFor: (attempt) => randomOf('tablero', id, attempt > 0 ? String(attempt) : ''),
            generate: generateBoard,
            purpose,
            site: `${place} ${type} ${biome}`,
            options,
            budget: Math.max(1, budget),
            board: {
                size: SIZES.includes(size) ? size : (Number(act) >= 3 ? 'large' : 'medium'),
                shape: SHAPES.includes(shape) ? shape : (SHAPE_OF_TYPE[type] ?? 'rooms'),
                partySize: 4,
            },
        });
        const map = /** @type {string[]} */ (drawn.map);
        const partyStart = list(drawn.partyStart).map((/** @type {any} */ c) => ({ x: c.x, y: c.y }));
        const enemies = list(drawn.enemies).map((/** @type {any} */ e) => ({ name: text(e.name), x: e.x, y: e.y }));
        // A quien se va a buscar, en lo más hondo: lo más lejos que se llega desde la entrada.
        const taken = new Set([...partyStart, ...enemies].map(c => `${c.x},${c.y}`));
        const far = farCells(map, partyStart, taken);
        /** @type {Array<{name: string, x: number, y: number}>} */
        const leading = [];
        for (const wanted of forced) {
            const cell = far.shift();
            if (cell) leading.push({ name: text(wanted), ...cell });
        }
        enemies.unshift(...leading);
        commitBred(enemies, place, biome);
        const board = { id, name, locationName: place, map, partyStart, enemies, seeded: true };
        // A todo el que espera se llega: la semilla puede dejar un cofre tapando una puerta.
        openWalledRooms(board, id, true);
        boards.push(board);
        boardIds.add(id);
        boardsByName.set(low(name), board);
        return { board, target: drawn.target ?? far[0] ?? null };
    };

    // ------------------------------------------------------------ los tesoros (J5.2)
    /** @type {Map<string, any>} */
    const itemByName = new Map(items.filter(i => text(i?.name)).map(i => [low(i.name), i]));
    /**
     * Que exista en `items` un objeto que un tesoro nombra: si no, sencillo, para que se pueda
     * llevar.
     *
     * @param {string} name
     * @param {string} why
     */
    const ensureItem = (name, why) => {
        if (!name || itemByName.has(low(name))) return;
        const item = { name, type: 'gear', rarity: 'Uncommon' };
        items.push(item);
        itemByName.set(low(name), item);
        note('objeto', name, why);
    };
    /**
     * Un cofre con su tesoro en un tablero con mapa: en una casilla de suelo de `cells` (la sala
     * o, sin ella, todo el tablero), pegada a una pared si se puede, y que no corte el paso a
     * ninguna parte (un cofre no se pisa). Si ahí ya hay un cofre dibujado sin dueño, ese.
     *
     * @param {any} board
     * @param {string[]|null} cells Casillas `"x,y"`, o null para todo el tablero.
     * @param {any[]} things Los objetos, por su nombre.
     * @param {string} why
     * @returns {boolean} Si el tesoro está en un cofre (ya lo estaba, o se ha puesto).
     */
    const placeChest = (board, cells, things, why) => {
        const wanted = [...new Set(list(things).map(t => text(typeof t === 'string' ? t : t?.name)).filter(Boolean))];
        if (wanted.length === 0 || !readableMap(board?.map)) return false;
        const chests = list(board.chests);
        // Rellenar lo relleno no pone otro cofre.
        if (chests.some(c => wanted.every(w => list(c?.items).map(low).includes(low(w))))) return true;
        const starts = list(board.partyStart).filter(c => Number.isInteger(c?.x) && Number.isInteger(c?.y));
        if (starts.length === 0) return false;
        const map = board.map.map(String);
        const inside = cells ? new Set(cells) : null;
        const fits = (/** @type {number} */ x, /** @type {number} */ y) => !inside || inside.has(`${x},${y}`);
        const enemies = list(board.enemies).filter(e => typeof e === 'object' && Number.isInteger(e?.x) && Number.isInteger(e?.y));
        // Ni encima de una trampa: abrir el cofre no es pisarla.
        const traps = list(board.traps).filter(t => Number.isInteger(t?.x) && Number.isInteger(t?.y));
        const used = new Set([...starts, ...enemies, ...chests, ...traps].map(c => `${c.x},${c.y}`));
        /** @type {{x: number, y: number}|null} */
        let spot = null;
        for (let y = 0; y < map.length && !spot; y++) {
            for (let x = 0; x < map[y].length && !spot; x++) {
                if (map[y][x] === 'k' && fits(x, y) && !used.has(`${x},${y}`)) spot = { x, y };
            }
        }
        if (!spot) {
            const reach = stepsFrom(map, starts[0]);
            const wall = (/** @type {number} */ x, /** @type {number} */ y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => map[y + dy]?.[x + dx] === '#');
            const candidates = [...reach.entries()]
                .map(([key, d]) => ({ x: Number(key.split(',')[0]), y: Number(key.split(',')[1]), d }))
                .filter(c => map[c.y][c.x] === '.' && fits(c.x, c.y) && !used.has(`${c.x},${c.y}`))
                .sort((a, b) => Number(wall(b.x, b.y)) - Number(wall(a.x, a.y)) || b.d - a.d || a.y - b.y || a.x - b.x);
            for (const c of candidates.slice(0, 60)) {
                const trial = map.map((row, y) => (y === c.y ? `${row.slice(0, c.x)}k${row.slice(c.x + 1)}` : row));
                const after = stepsFrom(trial, starts[0]);
                // Todo lo que se alcanzaba se sigue alcanzando, salvo la casilla del cofre.
                if (after.size === reach.size - 1 && enemies.every(e => !reach.has(`${e.x},${e.y}`) || after.has(`${e.x},${e.y}`))) {
                    spot = { x: c.x, y: c.y };
                    board.map = trial;
                    break;
                }
            }
        }
        if (!spot) return false;
        for (const thing of wanted) ensureItem(thing, why);
        board.chests = [...chests, { x: spot.x, y: spot.y, items: wanted }];
        note('cofre', text(board.name) || text(board.id), `${why}: ${sayList(wanted)}`);
        return true;
    };
    /**
     * J5.2: el encuentro y el tesoro de cada sala de un tablero con mapa. Quien la sala pide y
     * todavía no está en ella se pone en sus casillas libres; su tesoro, en un cofre dentro.
     *
     * @param {any} board
     * @param {string} id
     */
    const fillRooms = (board, id) => {
        for (const zone of list(board.zones)) {
            const cells = zoneCells(zone);
            if (cells.length === 0) continue;
            const inZone = new Set(cells);
            const want = list(zone?.enemies).map(e => text(typeof e === 'string' ? e : e?.name)).filter(Boolean);
            if (want.length > 0 && readableMap(board.map)) {
                const map = board.map.map(String);
                const current = list(board.enemies);
                const placed = current.filter(e => typeof e === 'object' && Number.isInteger(e?.x) && inZone.has(`${e.x},${e.y}`));
                const pool = placed.map(e => low(e.name));
                const missing = want.filter(name => {
                    const at = pool.indexOf(low(name));
                    if (at < 0) return true;
                    pool.splice(at, 1);
                    return false;
                });
                const taken = new Set([...list(board.partyStart), ...current.filter(e => typeof e === 'object'), ...list(board.chests)].map(c => `${c?.x},${c?.y}`));
                const random = randomOf('sala', id, text(zone.name));
                const free = cells.map(key => ({ x: Number(key.split(',')[0]), y: Number(key.split(',')[1]) }))
                    .filter(c => standable(map, c.x, c.y) && !taken.has(`${c.x},${c.y}`))
                    .map(c => ({ c, at: random() })).sort((a, b) => a.at - b.at).map(({ c }) => c);
                /** @type {Array<{name: string, x: number, y: number}>} */
                const added = [];
                missing.forEach((name, i) => { if (free[i]) added.push({ name, ...free[i] }); });
                if (added.length > 0) {
                    board.enemies = [...current, ...added];
                    note('sala', `${text(zone.name)} (${text(board.name) || id})`, `quien espera en ella: ${sayList(added.map(e => e.name))}`);
                }
            }
            placeChest(board, cells, list(zone?.treasure), `el tesoro de la sala «${text(zone.name)}»`);
        }
    };

    /**
     * J5.3: una sala cerrada. Si alguien espera donde no se llega desde donde empieza el grupo
     * (una sala sin puerta, o con la puerta dibujada contra otra pared), se abre una puerta en
     * una casilla de muro que tenga a un lado lo que se alcanza y al otro su sala: la más cerca
     * de quien espera. Lo mismo que mira el validador (`reachability.js`: las puertas se abren,
     * y se va en diagonal). El mapa sigue siendo el suyo: solo cambia esa casilla, y se dice.
     * Una pared de dos casillas de grueso no se abre: eso lo avisa el validador.
     *
     * En un tablero de la semilla pasa sin que nadie lo escriba: un cofre o un barril justo
     * detrás de la única puerta de una sala. Ahí se quita lo que estorba antes de abrir la pared,
     * y no se dice: el mapa es del motor, no de la campaña.
     *
     * @param {any} board
     * @param {string} id
     * @param {boolean} [seeded] Si el mapa lo ha dibujado la semilla.
     */
    const openWalledRooms = (board, id, seeded = false) => {
        if (!readableMap(board?.map)) return;
        const starts = list(board.partyStart).filter(c => Number.isInteger(c?.x) && Number.isInteger(c?.y));
        const waiting = list(board.enemies).filter(e => typeof e === 'object' && Number.isInteger(e?.x) && Number.isInteger(e?.y));
        if (starts.length === 0 || waiting.length === 0) return;
        for (let round = 0; round < 8; round++) {
            const map = board.map.map(String);
            const size = { gridWidth: map[0].length, gridHeight: map.length };
            const terrain = terrainFromAsciiMap(map);
            const reached = floodFrom({ terrain, ...size, starts });
            const stuck = waiting.find(e => !reached.has(`${e.x},${e.y}`));
            if (!stuck) return;
            const room = floodFrom({ terrain, ...size, starts: [stuck] });
            /** @type {{x: number, y: number, d: number}|null} */
            let best = null;
            for (let y = 1; y < map.length - 1; y++) {
                for (let x = 1; x < map[y].length - 1; x++) {
                    const wall = map[y][x] === '#';
                    // Lo que estorba y no es muro (un cofre, un barril), solo en un mapa de la semilla.
                    if (!wall && !(seeded && !walkable(map[y][x]) && !DOORS.has(map[y][x]))) continue;
                    const joins = [[1, 0], [0, 1]].some(([dx, dy]) => {
                        const a = `${x - dx},${y - dy}`;
                        const b = `${x + dx},${y + dy}`;
                        return (reached.has(a) && room.has(b)) || (reached.has(b) && room.has(a));
                    });
                    const d = Math.abs(x - stuck.x) + Math.abs(y - stuck.y) + (seeded && wall ? 100 : 0);
                    if (joins && (!best || d < best.d)) best = { x, y, d };
                }
            }
            if (!best) return;
            const at = best;
            const put = map[at.y][at.x] === '#' ? 'D' : '.';
            board.map = map.map((row, y) => (y === at.y ? `${row.slice(0, at.x)}${put}${row.slice(at.x + 1)}` : row));
            if (seeded) continue;
            note('puerta', text(board.name) || id, `para llegar a ${text(stuck.name) || 'quien espera'}, en la casilla (${at.x + 1}, ${at.y + 1})`);
        }
    };

    /**
     * J5.2: las trampas de un tablero con mapa. La que no trae casilla (o toda la de un tablero
     * que se ha dibujado con la semilla: su casilla era de otro mapa) se pone en el camino: suelo
     * a medio camino de lo más lejos, sin tocar donde empieza el grupo, quien espera ni un cofre.
     * El estado escrito en castellano pasa a su clave.
     *
     * @param {any} board
     * @param {string} id
     * @param {boolean} redrawn Si el mapa lo ha dibujado la semilla.
     */
    const fillTraps = (board, id, redrawn) => {
        if (!Array.isArray(board?.traps) || board.traps.length === 0 || !readableMap(board.map)) return;
        const map = board.map.map(String);
        const starts = list(board.partyStart).filter(c => Number.isInteger(c?.x) && Number.isInteger(c?.y));
        const at = (/** @type {any} */ c) => `${c?.x},${c?.y}`;
        const taken = new Set([...starts, ...list(board.enemies).filter(e => typeof e === 'object'), ...list(board.chests)].map(at));
        const kept = redrawn ? [] : board.traps.filter((/** @type {any} */ t) => Number.isInteger(t?.x) && Number.isInteger(t?.y));
        for (const t of kept) taken.add(at(t));
        const steps = starts.length > 0 ? stepsFrom(map, starts[0]) : new Map();
        const far = Math.max(0, ...steps.values());
        const random = randomOf('trampa', id);
        const spots = [...steps.entries()]
            .map(([key, d]) => ({ x: Number(key.split(',')[0]), y: Number(key.split(',')[1]), d }))
            // Ni pegada a donde empieza el grupo: dos pasos como poco.
            .filter(c => c.d >= 2 && map[c.y][c.x] === '.' && !taken.has(`${c.x},${c.y}`))
            .map(c => ({ c, score: Math.abs(c.d - far / 2) + random() * 3 }))
            .sort((a, b) => a.score - b.score)
            .map(({ c }) => ({ x: c.x, y: c.y }));
        /** @type {string[]} */
        const moved = [];
        board.traps = board.traps.map((/** @type {any} */ trap) => {
            if (!trap || typeof trap !== 'object') return trap;
            let out = trap;
            const word = text(trap.condition);
            if (word && !TRAP_CONDITIONS.includes(word)) {
                const key = trapConditionKey(word);
                if (key) out = { ...out, condition: key };
            }
            if (!redrawn && kept.includes(trap)) return out;
            const spot = spots.shift();
            if (!spot) return out;
            moved.push(text(trap.name) || 'una trampa');
            return { ...out, x: spot.x, y: spot.y };
        });
        if (moved.length > 0) note('trampa', text(board.name) || id, sayList(moved));
    };

    // J12.5: los tableros que la campaña trae. Sin mapa, se dibujan con la semilla; con mapa,
    // se completa lo que les falte: dónde empieza el grupo y dónde espera cada enemigo.
    for (let i = 0; i < boards.length; i++) {
        const board = boards[i];
        if (!board || typeof board !== 'object' || board.seeded) continue;
        const id = text(board.id) || freeId(board.name || `tablero-${i + 1}`);
        if (!Array.isArray(board.map) || board.map.length === 0) {
            // J5.2: quien espera en sus salas va también, y su tesoro, en un cofre: las salas se
            // escribieron sobre otro mapa y aquí no casan.
            const rooms = list(board.zones);
            const named = [...list(board.enemies), ...rooms.flatMap(z => list(z?.enemies))].map(e => text(typeof e === 'string' ? e : e?.name)).filter(Boolean);
            const loot = rooms.flatMap(z => list(z?.treasure));
            const uses = quests.filter(q => text(q?.boardId) === id);
            const objectives = uses.flatMap(q => list(q?.objectives)).map(o => text(o?.type));
            const purpose = PURPOSE_OF_OBJECTIVE[objectives.find(t => PURPOSE_OF_OBJECTIVE[t]) ?? ''] ?? 'cull';
            boards.splice(i, 1);
            boardIds.delete(text(board.id));
            boardsByName.delete(low(board.name));
            const place = text(board.locationName) || fightPlace();
            const { board: drawn } = drawBoard({
                id, name: text(board.name) || freeName(place, ''), place, purpose, forced: named, crowd: named.length === 0,
                act: uses[0]?.act ?? 1, size: text(board.size), shape: text(board.shape),
            });
            // Lo demás que traía (su descripción), tal cual; el dibujo, del motor. J12.5: el dibujo,
            // su cuadrícula, sus salas y sus alturas eran de otro mapa: fuera, y se dice.
            const rest = { ...board };
            for (const key of ['map', 'partyStart', 'enemies', 'size', 'shape', 'image', 'grid', 'zones', 'elevation']) delete rest[key];
            const merged = { ...rest, ...drawn };
            boards.splice(boards.indexOf(drawn), 1);
            boards.splice(i, 0, merged);
            boardsByName.set(low(merged.name), merged);
            note('tablero', merged.name, text(board.image)
                ? 'traía su dibujo pero no su mapa, y el dibujo no se ha podido leer: se ha dibujado con la semilla, sin él'
                : 'venía sin mapa');
            placeChest(merged, null, loot, `el tesoro de «${merged.name}»`);
            fillTraps(merged, id, true);
            continue;
        }
        if (!readableMap(board.map)) continue;
        const map = board.map.map(String);
        const enemies = list(board.enemies);
        const placed = enemies.filter(e => typeof e === 'object' && Number.isInteger(e?.x) && Number.isInteger(e?.y));
        let changed = false;
        if (list(board.partyStart).length === 0) {
            board.partyStart = startCells(map, placed.map(e => ({ x: e.x, y: e.y })));
            changed = board.partyStart.length > 0;
        }
        const loose = enemies.filter(e => !placed.includes(e));
        if (loose.length > 0 && list(board.partyStart).length > 0) {
            const taken = new Set([...list(board.partyStart), ...placed].map(c => `${c.x},${c.y}`));
            const far = farCells(map, list(board.partyStart), taken);
            board.enemies = enemies.map(e => {
                if (placed.includes(e)) return e;
                const cell = far.shift();
                return cell ? { ...(typeof e === 'object' ? e : {}), name: text(typeof e === 'string' ? e : e?.name), ...cell } : e;
            });
            changed = true;
        }
        if (changed) note('tablero', text(board.name) || id, 'traía mapa: se ha puesto dónde empieza el grupo y dónde espera cada uno');
        fillRooms(board, id);
        openWalledRooms(board, id);
        fillTraps(board, id, false);
    }

    /**
     * Dónde se juega una misión que no lo dice: su sitio, el del hito que la cuenta o el
     * primero donde se pelea.
     *
     * @param {any} quest
     * @param {string} key
     * @returns {string}
     */
    const placeOfQuest = (quest, key) => {
        const own = text(quest?.locationName) || text(quest?.where) || text(quest?.place);
        if (own) return own;
        const told = milestones.find(m => text(m?.quest) === key);
        return text(told?.asks?.place) || text(told?.opens?.place) || fightPlace();
    };

    // J5.3: cada misión, en un tablero que exista.
    quests.forEach((quest, i) => {
        const key = questKey(quest, i);
        if (text(quest?.boardId) && boardIds.has(text(quest.boardId))) return;
        const place = placeOfQuest(quest, key);
        const objectives = list(quest?.objectives);
        const purpose = PURPOSE_OF_OBJECTIVE[objectives.map(o => text(o?.type)).find(t => PURPOSE_OF_OBJECTIVE[t]) ?? ''] ?? 'cull';
        const forced = [
            ...objectives.filter(o => text(o?.type) === 'eliminate').map(o => text(o.target)),
            ...list(quest?.enemies).map(e => text(typeof e === 'string' ? e : e?.name)),
        ].filter(Boolean);
        const { board, target } = drawBoard({
            id: text(quest?.boardId) || freeId(`${key}-tablero`), name: freeName(place, text(quest?.name)), place,
            purpose, forced, act: quest?.act, size: text(quest?.size), shape: text(quest?.shape),
        });
        quest.boardId = board.id;
        // La casilla a la que hay que llegar, si la misión no la dice: lo que se busca, al fondo.
        for (const o of objectives) {
            if (['reach_cell', 'escort'].includes(text(o?.type)) && !(Number.isInteger(o?.cell?.x) && Number.isInteger(o?.cell?.y)) && target) {
                o.cell = { x: target.x, y: target.y };
            }
        }
        note('tablero', board.name, `para la misión «${text(quest?.name) || key}»`);
    });

    // Quien una misión pide escoltar o proteger, entre los compañeros. E1.1: salvo quien está en
    // su tablero para que se le proteja (`ward`): entra en la pelea como invitado, no como compañero.
    const allies = new Set(confidants.map(c => low(c?.name)).filter(Boolean));
    const wards = new Set(boards.map(b => low(b?.ward?.name)).filter(Boolean));
    for (const quest of quests) {
        for (const o of list(quest?.objectives)) {
            const ally = text(o?.ally);
            if (!['escort', 'protect'].includes(text(o?.type)) || !ally || allies.has(low(ally)) || wards.has(low(ally))) continue;
            confidants.push({ name: ally, description: `Va con vosotros en «${text(quest?.name)}».`, initialBondPoints: 0 });
            allies.add(low(ally));
            note('aliado', ally, `la misión «${text(quest?.name)}» pide que salga entero`);
        }
    }

    // La misión sin texto, con el del narrador del motor: antes del hilo, que es de donde el
    // hito que la cuenta saca su escena.
    quests.forEach((quest, i) => {
        if (text(quest?.description)) return;
        const board = boards.find(b => text(b?.id) === text(quest?.boardId));
        const line = fillerLine(compendium, 'relleno-mision', { sitio: text(board?.locationName) || fightPlace(), mision: text(quest?.name) }, randomOf('mision', questKey(quest, i)));
        if (!line) return;
        quest.description = line;
        note('texto', text(quest?.name) || questKey(quest, i), 'la misión no tenía texto');
    });

    // ------------------------------------------------------------ el hilo
    // J5.3: una campaña sin hilo, solo con misiones repartidas en actos (como tu JSON de Strahd,
    // del acto 1 al 5): el hilo sale de ellas, un hito por misión, acto a acto y, en cada acto, en
    // el orden en que vienen. Lo demás de cada hito (título, escena, qué pide, detrás de cuál va y
    // el final) lo pone lo de abajo, como a cualquier hito que dice de qué misión es. Con todas en
    // el mismo acto no hay orden que seguir: se juegan sueltas, como hasta ahora.
    const madeThread = milestones.length === 0 && list(pack.plot?.milestones).length === 0
        && new Set(quests.map(q => Number(q?.act) || 1)).size > 1;
    if (madeThread) {
        const order = quests.map((q, i) => ({ key: questKey(q, i), act: Number(q?.act) || 1, i }))
            .sort((a, b) => a.act - b.act || a.i - b.i);
        for (const { key } of order) milestones.push({ id: key, quest: key });
        const plot = pack.plot && typeof pack.plot === 'object' && !Array.isArray(pack.plot) ? pack.plot : {};
        pack.plot = { ...plot, milestones };
        note('historia', `${milestones.length} ${milestones.length === 1 ? 'misión' : 'misiones'}`, 'la campaña no traía hilo');
        // Una misión en un sitio escondido: lo descubre la de antes al acabarse. Sin ninguna
        // antes, el sitio no puede empezar escondido.
        milestones.forEach((m, i) => {
            const quest = questById.get(m.quest);
            const where = text(boards.find(b => text(b?.id) === text(quest?.boardId))?.locationName) || text(quest?.locationName);
            const place = placeByName.get(low(where));
            if (!place?.hidden) return;
            if (i === 0) {
                delete place.hidden;
                note('sitio', text(place.name), 'la primera misión se juega allí: ya no empieza escondida');
                return;
            }
            const before = milestones[i - 1];
            before.reveal = [...new Set([...list(before.reveal), text(place.name)])];
        });
    }
    const random = randomOf('frases');
    let touched = 0;
    milestones.forEach((m, i) => {
        const quest = text(m?.quest) ? questById.get(text(m.quest)) : null;
        const board = quest ? boards.find(b => text(b?.id) === text(quest.boardId)) : null;
        let changed = false;
        /**
         * Poner lo que no trae. Un texto vacío escrito a propósito (la pista de un secreto, un
         * suceso que llega por el reloj) se respeta, salvo en un hito de una misión.
         *
         * @param {string} field
         * @param {any} value
         */
        const set = (field, value) => {
            if (m[field] !== undefined && !(quest && typeof m[field] === 'string' && !text(m[field]))) return;
            if (value === undefined || value === '') return;
            m[field] = value;
            changed = true;
        };
        set('act', quest ? (Number(quest.act) || 1) : undefined);
        set('title', text(quest?.name) || text(m.id));
        if (!m.opens || !text(m.opens.kind)) {
            m.opens = text(m.after) ? { kind: 'after', milestone: text(m.after) }
                : i === 0 ? { kind: 'start' } : { kind: 'after', milestone: text(milestones[i - 1]?.id) };
            delete m.after;
            changed = true;
        }
        if (!m.asks || !text(m.asks.kind)) {
            m.asks = board ? { kind: 'win', board: text(board.name) } : { kind: 'none' };
            changed = true;
        }
        // Lo escrito a mano como en mejoras.json (`reveal`, `open`, `ending` sueltos), a su sitio.
        const changes = m.changes && typeof m.changes === 'object' ? m.changes : {};
        for (const key of ['reveal', 'open', 'close', 'ending', 'endingBy', 'standing']) {
            if (m[key] === undefined) continue;
            if (changes[key] === undefined) changes[key] = m[key];
            delete m[key];
            m.changes = changes;
            changed = true;
        }
        const goals = list(quest?.objectives).filter(o => !o.optional && o.type !== 'protect').map(o => text(o.label)).filter(Boolean);
        // Un secreto no dice qué hacer: se encuentra.
        if (!m.hidden) set('hint', [goals.length > 0 ? `${goals.join('. ')}.` : '', hintFor(m.asks, boardsByName)].filter(Boolean).join(' '));
        set('scene', text(quest?.description) || fillerLine(compendium, 'relleno-hito', { titulo: text(m.title) }, random));
        if (changed) touched++;
    });
    if (touched > 0 && !madeThread) note('hilo', `${touched} ${touched === 1 ? 'hito' : 'hitos'}`, 'con lo que dicen sus misiones, o detrás del anterior');

    // J5.2: el punto de vista. Un hito que dice quién lo cuenta (`pov`, o el de su capítulo) y no
    // trae escena jugada sale en boca de esa persona, con su retrato. Si no es de la gente del
    // paquete, lo cuenta el narrador (y el validador lo avisa).
    const people = new Map([...list(pack.npcs), ...confidants].filter(p => text(p?.name)).map(p => [low(p.name), text(p.name)]));
    const chapterPov = new Map(list(pack.plot?.chapters).filter(c => text(c?.pov)).map(c => [Number(c.act) || 1, text(c.pov)]));
    for (const m of milestones) {
        const who = people.get(low(text(m?.pov) || chapterPov.get(Number(m?.act) || 1)));
        if (!who || list(m?.beats).length > 0 || !text(m?.scene)) continue;
        m.beats = [{ who, text: text(m.scene) }];
        note('voz', who, `cuenta «${text(m.title) || text(m.id)}»`);
    }

    // Cada hito que pide ganar un tablero o derrotar a alguien, con su tablero.
    for (const m of milestones) {
        for (const asks of [m?.asks, ...list(m?.asks?.options)]) {
            const place = text(asks?.place) || text(m?.opens?.place) || fightPlace();
            if (text(asks?.kind) === 'win' && text(asks.board) && !boardsByName.has(low(asks.board))) {
                const { board } = drawBoard({ id: freeId(asks.board), name: text(asks.board), place, act: m.act });
                note('tablero', board.name, `el hito «${text(m.title) || text(m.id)}» pide ganar allí`);
            }
            if (text(asks?.kind) === 'defeat' && text(asks.enemy)
                && !boards.some(b => list(b?.enemies).some(e => low(typeof e === 'string' ? e : e?.name).startsWith(low(asks.enemy))))) {
                const { board } = drawBoard({ id: freeId(`${text(m.id)}-tablero`), name: freeName(place, text(m.title)), place, purpose: 'hunt', forced: [text(asks.enemy)], act: m.act });
                note('tablero', board.name, `el hito «${text(m.title) || text(m.id)}» pide derrotar a ${text(asks.enemy)}`);
            }
        }
    }

    // Los encargos con pelea, y las mazmorras, con su tablero.
    for (const c of contracts) {
        if (c?.noFight || (text(c?.boardId) && boardIds.has(text(c.boardId)))) continue;
        const place = text(c?.where) || fightPlace();
        const { board } = drawBoard({
            id: text(c?.boardId) || freeId(`${text(c?.id) || slug(c?.title)}-tablero`), name: freeName(text(c?.title) || place, place), place,
            purpose: PURPOSE_OF_CONTRACT[text(c?.kind)] ?? 'cull', act: c?.act,
        });
        c.boardId = board.id;
        note('tablero', board.name, `para el encargo «${text(c?.title) || text(c?.id)}»`);
    }
    for (const place of locations) {
        if (text(place?.type) !== 'dungeon' || boards.some(b => low(b?.locationName) === low(place.name))) continue;
        const { board } = drawBoard({ id: freeId(place.name), name: freeName(place.name, ''), place: text(place.name) });
        note('tablero', board.name, 'una mazmorra sin tablero no se juega');
    }
    // J5.2: el tesoro de cada sitio, en un cofre de uno de sus tableros; si no tiene ninguno, en
    // uno pequeño y sin pelea, para ir a buscarlo.
    for (const place of locations) {
        const things = list(place?.treasure);
        if (!text(place?.name) || things.length === 0) continue;
        let board = boards.find(b => low(b?.locationName) === low(place.name) && readableMap(b?.map));
        if (!board) {
            ({ board } = drawBoard({ id: freeId(`${place.name}-tesoro`), name: freeName(place.name, 'el tesoro'), place: text(place.name), purpose: 'recover', crowd: false }));
            note('tablero', board.name, `para buscar el tesoro de ${text(place.name)}`);
        }
        placeChest(board, null, things, `el tesoro de ${text(place.name)}`);
    }

    // Sin ningún tablero no hay dónde poner al grupo: uno tranquilo, en el primer sitio. Con
    // alguno, la campaña empieza en su primera localización aunque no tenga tablero: el grupo
    // llega a ella y ve el sitio, como en el pueblo del gremio (`enterStartingLocation`).
    if (boards.length === 0 && (text(locations[0]?.name) || text(world.name))) {
        const place = text(locations[0]?.name) || text(world.name);
        const { board } = drawBoard({ id: freeId(place), name: place, place, crowd: false });
        note('tablero', board.name, 'la campaña no trae ninguno: sin pelea, para empezar');
    }

    // ------------------------------------------------------------ los caminos
    // Con caminos escritos, el viaje va de vecino en vecino: un sitio sin ninguno no se
    // alcanza. Se le pone uno de un día desde donde lo descubre la historia (el sitio del hito
    // que lo revela) o, si no, desde el de antes en la lista. Sin ningún camino escrito, se va
    // de un sitio a otro directo, como siempre, y no se toca.
    const routed = (/** @type {any} */ l) => list(l?.routes).some(r => text(r?.to));
    if (locations.some(routed)) {
        for (let i = 0; i < locations.length; i++) {
            const place = locations[i];
            const name = low(place?.name);
            if (!name || routed(place) || locations.some(l => list(l?.routes).some(r => low(r?.to) === name))) continue;
            const revealer = milestones.find(m => [...list(m?.changes?.reveal), ...list(m?.late?.reveal)].map(low).includes(name));
            const quest = revealer && text(revealer.quest) ? questById.get(text(revealer.quest)) : null;
            const from = [
                text(revealer?.asks?.place),
                text(boards.find(b => text(b?.id) === text(quest?.boardId))?.locationName),
                text(boardsByName.get(low(revealer?.asks?.board))?.locationName),
                text(locations.slice(0, i).reverse().find(l => !l?.hidden)?.name),
                text(locations.find(l => low(l?.name) !== name)?.name),
            ].find(candidate => candidate && low(candidate) !== name && placeByName.has(low(candidate)));
            if (!from) continue;
            place.routes = [...list(place.routes), { to: from, days: 1 }];
            note('camino', text(place.name), `de un día, desde ${from}`);
        }
    }

    // ------------------------------------------------------------ los finales
    if (milestones.length > 0) {
        const plot = pack.plot;
        const endings = plot.endings && typeof plot.endings === 'object' && !Array.isArray(plot.endings) ? plot.endings : {};
        if (!plot.endings || Object.keys(endings).length === 0) {
            endings.final = { title: 'El final' };
            plot.endings = endings;
            note('final', 'El final', 'la campaña no traía ninguno');
        }
        const leads = milestones.some(m => text(m?.changes?.ending) || Object.keys(m?.changes?.endingBy ?? {}).length > 0);
        if (!leads) {
            const opened = new Set([
                ...milestones.filter(m => m?.opens?.kind === 'after').map(m => text(m.opens.milestone)),
                ...milestones.flatMap(m => list(m?.changes?.open).map(text)),
            ]);
            const last = [...milestones].reverse().find(m => !opened.has(text(m?.id))) ?? milestones[milestones.length - 1];
            last.changes = { ...(last.changes ?? {}), ending: Object.keys(endings)[0] };
            note('final', text(endings[Object.keys(endings)[0]]?.title) || Object.keys(endings)[0], `el hito «${text(last.title) || text(last.id)}» lleva a él`);
        }
        for (const [id, ending] of Object.entries(endings)) {
            if (!ending || typeof ending !== 'object' || text(ending.scene)) continue;
            const scene = fillerLine(compendium, 'relleno-final', { mundo: text(world.name) }, random);
            if (!scene) continue;
            ending.scene = scene;
            if (!text(ending.title)) ending.title = 'El final';
            note('texto', text(ending.title) || id, 'el final no contaba nada');
        }
    }

    // ------------------------------------------------------------ las frases
    for (const place of locations) {
        if (!text(place?.name) || text(place.description)) continue;
        const line = fillerLine(compendium, 'relleno-sitio', { tipo: text(place.type), nombre: text(place.name) }, randomOf('sitio', text(place.name)));
        if (!line) continue;
        place.description = line;
        note('texto', text(place.name), 'la localización no tenía descripción');
    }

    if (hadLocations || locations.length > 0) pack.locations = locations;
    if (boards.length > 0 || Array.isArray(pack.boards)) pack.boards = boards;
    if (bestiary.length > 0 || Array.isArray(pack.bestiary)) pack.bestiary = bestiary;
    if (confidants.length > 0 || Array.isArray(pack.confidants)) pack.confidants = confidants;
    if (items.length > 0 || Array.isArray(pack.items)) pack.items = items;
    return { pack, filled };
}

/**
 * J5.5: una campaña en el formato corto, el que un Gem escribe sin dibujar nada: el mundo,
 * sus sitios (uno sin tipo ni descripción), tres misiones sin tablero y el hilo que las cuenta.
 * Ni tableros, ni bestiario, ni finales: los pone el juego (`fillPackGaps`). Es la muestra de
 * [[GEM_CREAR_CAMPANA]] y la de las pruebas.
 *
 * J5.2: lleva también lo que un Gem puede traer sin dibujar: a cuántos días queda y para qué
 * nivel es, los capítulos, una persona que cuenta la primera escena (`pov`) y el tesoro de un
 * sitio, que el juego pone en un cofre.
 *
 * @returns {any}
 */
export function buildShortExamplePack() {
    return {
        version: 1,
        world: {
            name: 'El Pozo de la Ermita',
            genre: 'Fantasía oscura',
            synopsis: 'En la aldea de Brezo los pozos se secan y los perros aúllan de noche. La ermita del monte lleva años cerrada, y alguien ha vuelto a encender sus velas.',
            levels: [1, 3],
            journey: { days: 3, how: 'Subís por la costa y, al tercer día, os metéis tierra adentro, hasta los montes de Brezo.' },
        },
        locations: [
            {
                name: 'Aldea de Brezo',
                type: 'village',
                description: 'Veinte casas de piedra, un molino parado y un pozo seco en mitad de la plaza.',
                routes: [{ to: 'El camino del monte', days: 1 }],
            },
            { name: 'El camino del monte', routes: [{ to: 'La ermita', days: 1 }] },
            { name: 'La ermita', type: 'sanctuary' },
            { name: 'La cripta de la ermita', type: 'dungeon', hidden: true, treasure: ['Cáliz de la Dama'] },
        ],
        npcs: [
            {
                name: 'Tobías el molinero',
                where: 'Aldea de Brezo',
                trade: 'Molinero',
                wants: 'Que el agua vuelva a mover la rueda del molino.',
                knows: 'Que las velas de la ermita se encendieron la misma noche en que se secó el primer pozo.',
                voice: 'Habla bajo y mira a la puerta cada poco.',
            },
        ],
        quests: [
            {
                id: 'lobos',
                name: 'Los lobos del camino',
                act: 1,
                locationName: 'El camino del monte',
                enemies: ['Lobo', 'Lobo', 'Lobo'],
                objectives: [{ type: 'eliminate_all', label: 'Espantar a los lobos' }],
            },
            {
                id: 'velas',
                name: 'Quién enciende las velas',
                act: 2,
                locationName: 'La ermita',
                description: 'Las velas de la ermita arden cada noche, y nadie del pueblo sube al monte desde hace años.',
                objectives: [{ type: 'eliminate', label: 'Acabar con el cultista', target: 'Cultista de la vela' }],
            },
            {
                id: 'cripta',
                name: 'Lo que duerme debajo',
                act: 3,
                locationName: 'La cripta de la ermita',
                description: 'Bajo el altar hay una escalera que baja al agua. Allí abajo algo se ha bebido los pozos de Brezo.',
                objectives: [
                    { type: 'eliminate', label: 'Acabar con la Dama del Pozo', target: 'La Dama del Pozo' },
                    { type: 'survive_rounds', label: 'Aguantar hasta que se apague la última vela', rounds: 4, optional: true },
                ],
            },
        ],
        plot: {
            milestones: [
                {
                    id: 'llegada',
                    title: 'Los pozos secos',
                    pov: 'Tobías el molinero',
                    scene: 'Aquí nadie os va a abrir la puerta. Los lobos bajan del monte cada noche, y arriba, en la ermita, vuelve a haber luz. Si queréis ayudar, empezad por el camino.',
                    asks: { kind: 'none' },
                },
                { id: 'camino', quest: 'lobos' },
                { id: 'ermita', quest: 'velas', reveal: ['La cripta de la ermita'] },
                { id: 'fondo', quest: 'cripta' },
            ],
            chapters: [
                { act: 1, title: 'Los pozos secos', summary: 'Brezo se queda sin agua y los lobos bajan del monte.' },
                { act: 2, title: 'Las velas de la ermita', summary: 'Alguien ha vuelto a encender las velas de la ermita cerrada.' },
                { act: 3, title: 'Lo que duerme debajo', summary: 'Bajo el altar, una escalera baja al agua que le falta a Brezo.' },
            ],
        },
    };
}

/**
 * J5.2: un tablero escrito como lo cuenta un módulo, sala a sala: quién espera en cada una
 * (`zones[].enemies`) y qué tesoro guarda (`zones[].treasure`). El juego pone a cada uno en su
 * sala y el tesoro en un cofre. Es la muestra de [[GEM_CREAR_CAMPANA]] y la de las pruebas.
 *
 * @returns {any}
 */
export function buildRoomsExampleBoard() {
    return {
        id: 'cripta_capilla',
        name: 'La capilla de la cripta',
        locationName: 'La cripta',
        map: [
            '##############',
            '#....#.......#',
            '#....#.......#',
            '#....D.......#',
            '#....#.......#',
            '#....#.......#',
            '##############',
        ],
        partyStart: [{ x: 1, y: 5 }, { x: 2, y: 5 }],
        zones: [
            { name: 'B1 · La escalera', rect: { x: 1, y: 1, width: 4, height: 5 }, note: 'Una escalera de piedra mojada baja hasta aquí.' },
            {
                name: 'B2 · La capilla',
                rect: { x: 6, y: 1, width: 7, height: 5 },
                note: 'Un altar partido y velas negras que alguien ha encendido hace poco.',
                enemies: ['Esqueleto', 'Esqueleto'],
                treasure: ['Cáliz de plata'],
            },
        ],
        // J5.2: una trampa, con su casilla y lo que se ve sin buscarla.
        traps: [
            { name: 'Losa suelta', x: 3, y: 2, tell: 'Al pie de la escalera, una losa baila bajo el polvo.', damage: '1d6', condition: 'prone', spotDC: 12 },
        ],
    };
}

/**
 * Lo puesto, contado por clases, para decirlo en pocas líneas: «3 tableros dibujados con la
 * semilla: La ermita, El pozo y …».
 *
 * @param {FillNote[]} filled
 * @param {number} [names] Cuántos nombres se dicen de cada clase.
 * @returns {string[]}
 */
export function describeFill(filled, names = 4) {
    /** @type {Map<string, FillNote[]>} */
    const byKind = new Map();
    for (const one of Array.isArray(filled) ? filled : []) {
        byKind.set(one.kind, [...(byKind.get(one.kind) ?? []), one]);
    }
    return [...byKind.entries()].map(([kind, rows]) => {
        const [one, many] = FILL_KINDS[/** @type {keyof typeof FILL_KINDS} */ (kind)] ?? [kind, kind];
        if (kind === 'hilo') return `El hilo: ${rows.map(r => r.name).join(', ')} ${rows.length === 1 && /^1 /.test(rows[0].name) ? 'completado' : 'completados'} con sus misiones.`;
        if (kind === 'historia') return `La historia: no traía hilo, y sale de sus ${rows[0].name}, una detrás de otra, acto a acto.`;
        const shown = [...new Set(rows.map(r => r.name))];
        const head = shown.length <= names ? sayList(shown) : `${shown.slice(0, names).join(', ')} y ${shown.length - names} más`;
        return `${shown.length} ${shown.length === 1 ? one : many}: ${head}.`;
    });
}
