/**
 * El arte en pixel del juego: qué imagen le toca a cada cosa (una clase, una especie, una
 * persona de un paquete, un bicho, un objeto del compendio…).
 *
 * Las imágenes viven en `public/img/game-engine/pixel/`, una carpeta por tipo, y cada
 * carpeta tiene su README con qué archivo es qué. Aquí no se decide cómo se pintan: se
 * dice **qué archivos valen**, en orden, y quien pinta usa el primero o, si no hay ninguno,
 * su icono de siempre (Font Awesome, el ☠ del tablero, la silueta).
 *
 * Nunca se devuelve un archivo que no existe. El índice (`manifest.json`, que escribe
 * `tools/pixel-manifest.mjs`) lista todos los PNG, y se lee una vez: pedir a ciegas
 * `retratos/strahd/giles.png` para ver si está es un 404 en la consola por cada persona
 * del chat, y un hueco en blanco mientras llega el error.
 *
 * El índice trae también los **alias**: el nombre de una fila (el que sale en pantalla)
 * frente al archivo, cuando no coinciden. «Tiflin» es `raza-tiefling.png`, «Giles» es
 * `el-tabernero-giles.png` y «Lobo» es `bestia-lobo.png`.
 *
 * Puro, salvo `loadPixelManifest` (lee el índice) y `openPack` (mira qué partida está
 * abierta); los dos solo tocan el navegador cuando se les llama.
 */

import { HUB_CAMPAIGN_KEY, HUB_PACK, isHubWorld } from '../campaign/hub.js';
import { CLIFF_FEET } from '../board/heights.js';

/** Donde están las imágenes, relativo a la página. */
export const PIXEL_BASE = 'img/game-engine/pixel/';

/** El índice, dentro de la misma carpeta. */
export const PIXEL_MANIFEST_URL = `${PIXEL_BASE}manifest.json`;

/**
 * La carpeta de cada batería del compendio que tiene arte. Los archivos se llaman como el
 * `id` de la fila.
 */
export const PIXEL_DOMAINS = {
    clases: 'clases',
    razas: 'especies',
    armas: 'armas',
    armaduras: 'armaduras',
    trastos: 'trastos',
    habilidades: 'habilidades',
    estados: 'estados',
    conjuros: 'conjuros',
    bestiario: 'bestias',
};

/** Las de los objetos, en el orden en que se buscan. */
const ITEM_FOLDERS = ['armas', 'armaduras', 'trastos'];

/** El sitio del pueblo (`sitios/`) de cada servicio de `campaign/services.js`. */
const SERVICE_PLACES = { posada: 'taberna', herreria: 'herreria', tienda: 'tienda', templo: 'templo', tablon: 'gremio' };

/**
 * Los biomas de las casillas del tablero: cada uno trae su suelo y su muro (`tablero/`). Tanda 12:
 * el muelle (tablas sobre el mar, muro de sillares del puerto) y la playa (arena y rocas).
 */
export const BOARD_BIOMES = ['mazmorra', 'madera', 'exterior', 'cueva', 'calle', 'nieve', 'pantano', 'cripta', 'muelle', 'playa'];

/**
 * Las palabras del nombre de un tablero que dicen dónde se pelea. Lo que no dice nada es
 * piedra: una mazmorra, una bodega, un sótano. Gana la primera lista que acierte, así que
 * lo más concreto (una cripta, la nieve, un pantano, una calle) va antes que el exterior.
 *
 * @type {Array<[string, string[]]>}
 */
const BIOME_WORDS = [
    ['cripta', ['cripta', 'catacumba', 'catacumbas', 'tumba', 'mausoleo', 'panteon', 'osario', 'sepulcro']],
    ['cueva', ['cueva', 'gruta', 'caverna', 'mina', 'guarida', 'cubil', 'madriguera', 'tunel']],
    ['nieve', ['nieve', 'nevado', 'nevada', 'helado', 'helada', 'hielo', 'glaciar', 'ventisca', 'escarcha']],
    // Tanda 12: la choza de una bruja (la de Baba Lysaga) está en el barro, no en una mazmorra.
    ['pantano', ['pantano', 'cienaga', 'marisma', 'estanque', 'charca', 'turbera', 'lodazal', 'choza']],
    // Tanda 12: el muelle es de tablas, no de hierba; la playa y las salinas, de arena.
    ['muelle', ['muelle', 'muelles', 'embarcadero', 'pantalan', 'atracadero', 'malecon', 'astillero', 'dique']],
    ['playa', ['playa', 'playas', 'cala', 'salinas', 'salina', 'arenal', 'duna', 'dunas']],
    ['calle', ['calle', 'callejon', 'plaza', 'mercado', 'aldea', 'pueblo', 'ciudad', 'barrio', 'arrabal']],
    // Tanda 12: las empalizadas, un islote, un viñedo y las puertas de una villa están al aire libre.
    ['exterior', ['bosque', 'claro', 'claros', 'camino', 'sendero', 'campo', 'prado', 'patio',
        'jardin', 'lago', 'orilla', 'rio', 'puente', 'colina', 'monte', 'cruce', 'peaje', 'campamento',
        'puerto', 'cementerio', 'huerto', 'granja', 'asedio', 'valle', 'ruinas',
        'empalizada', 'empalizadas', 'islote', 'isla', 'vinedo', 'vinedos', 'puertas']],
    ['madera', ['taberna', 'posada', 'casa', 'mansion', 'cuarto', 'habitacion', 'salon', 'comedor', 'tienda', 'molino',
        'cabana', 'establo', 'almacen', 'burdel', 'taller', 'cocina', 'dormitorio', 'biblioteca']],
];

/** Las casillas que tienen un solo dibujo, sea cual sea el bioma. */
const TILE_FILES = {
    difficult: 'dificil', cover_half: 'cobertura-media', cover_three_quarters: 'cobertura-tres-cuartos', chasm: 'abismo',
    stairs: 'escalera', water: 'agua', deep_water: 'agua-honda', ice: 'hielo', brush: 'maleza', barrel: 'barril', chest: 'cofre', exit: 'salida',
    mud: 'barro',
    lever: 'palanca', barricade: 'barricada',
};

/**
 * Tanda 12: las casillas que cambian con el bioma. El dibujo de siempre es el de la mazmorra
 * (escombros, una caja, una columna); fuera, otro (`dificil-exterior` son raíces y ramas,
 * `cobertura-tres-cuartos-exterior` un árbol). Si el del bioma no está dibujado, el de siempre.
 */
const BIOME_TILES = ['difficult', 'cover_half', 'cover_three_quarters'];

/**
 * Tanda 12: el dibujo que hace las veces de otro que no está, antes que el de siempre: la
 * playa y el pantano usan los del exterior (una peña, un árbol); el terreno difícil del
 * pantano es barro; el agua honda sin el suyo, la poco honda.
 *
 * @type {Record<string, string[]>}
 */
const TILE_STAND_INS = {
    'agua-honda': ['agua'],
    'dificil-pantano': ['barro', 'dificil-exterior'],
    'dificil-playa': ['dificil-exterior'],
    'cobertura-media-playa': ['cobertura-media-exterior'],
    'cobertura-tres-cuartos-playa': ['cobertura-tres-cuartos-exterior'],
    'cobertura-media-pantano': ['cobertura-media-exterior'],
    'cobertura-tres-cuartos-pantano': ['cobertura-tres-cuartos-exterior'],
};

/**
 * El bioma de un tablero: el que se diga, o el que se lea en su nombre («Taberna…» es
 * madera, «…del bosque» es exterior, «Guarida…» es cueva), o el del tipo de su localización;
 * si nada lo dice, mazmorra.
 *
 * @param {{biome?: string, name?: string, type?: string}} [input]
 * @returns {string}
 */
export function boardBiome({ biome = '', name = '', type = '' } = {}) {
    const said = slugify(biome);
    if (BOARD_BIOMES.includes(said)) return said;
    const words = `-${slugify(name)}-`;
    for (const [found, list] of BIOME_WORDS) {
        if (list.some(word => words.includes(`-${word}-`))) return found;
    }
    const kind = slugify(type);
    if (/^(swamp|marsh|pantano|cienaga)$/.test(kind)) return 'pantano';
    if (/^(snow|tundra|nieve|glaciar)$/.test(kind)) return 'nieve';
    if (/^(wilderness|camp|outdoor|bosque|llanura|montana|costa|exterior)$/.test(kind)) return 'exterior';
    if (/^(cave|cueva|mine|mina)$/.test(kind)) return 'cueva';
    return 'mazmorra';
}

/**
 * El dibujo de una casilla del tablero (sin `.png`), o vacío si es suelo: el suelo va debajo
 * de todo. `edge` es para lo alto: la última fila de una zona alta lleva el borde.
 *
 * @param {{type?: string, open?: boolean, locked?: boolean, broken?: boolean}|null|undefined} cell
 * @param {{biome?: string, edge?: boolean}} [input]
 * @returns {string}
 */
export function terrainTile(cell, { biome = 'mazmorra', edge = false } = {}) {
    const type = text(cell?.type);
    if (type === 'wall') return `muro-${biome}`;
    if (type === 'door') return cell?.broken ? 'puerta-rota' : cell?.open ? 'puerta-abierta' : cell?.locked ? 'puerta-cerrojo' : 'puerta-cerrada';
    if (type === 'high') return edge ? 'alto-borde' : 'alto';
    const file = /** @type {Record<string, string>} */ (TILE_FILES)[type] ?? '';
    // Tanda 12: fuera de la mazmorra, el del bioma (`artFor` vuelve al de siempre si falta).
    if (file && BIOME_TILES.includes(type) && biome !== 'mazmorra' && BOARD_BIOMES.includes(biome)) return `${file}-${biome}`;
    return file;
}

/**
 * El dibujo de lo ya visto en el suelo (`hazards.js`): el fuego que arde, o una trampa
 * descubierta. Sin él, una trampa vista era solo un cuadro de rayas.
 *
 * @param {{kind?: string}|null|undefined} hazard
 * @returns {string}
 */
export function hazardTile(hazard) {
    return /fuego|fire/i.test(text(hazard?.kind)) ? 'fuego' : 'trampa';
}

/**
 * Tanda 12: lo que no se pisa a la altura de un puente. Lo que va debajo de las tablas ya se ve
 * en las casillas de al lado (el agua, el abismo), así que el puente tapa la suya entera.
 */
const BRIDGE_GAPS = new Set(['deep_water', 'water', 'chasm']);

/** Lo más ancho que se dibuja como puente: más, ya es un dique o una calzada. */
const BRIDGE_WIDTH = 3;

/**
 * Tanda 12: los puentes del tablero. El motor no tiene un tipo «puente», ni le hace falta: un
 * puente es suelo que cruza algo que no se pisa a su altura, y se anda como el suelo. Aquí se
 * encuentran para dibujarlos: una tira de suelo de 1 a 3 casillas de ancho con el agua, el
 * abismo o un barranco de las cotas (J12.10: 10 pies o más por debajo) a los dos lados, que
 * llega a tierra por las dos puntas. Un embarcadero que acaba en el agua no es un puente, ni
 * una isla rodeada de agua.
 *
 * Cada casilla trae sus capas, la de encima primero: la baranda de su lado si está en el borde
 * de la tira, y las tablas (`puente-ns` se cruza de norte a sur; `puente-eo`, de este a oeste).
 *
 * @param {{cells?: Record<string, {type?: string}>}|null|undefined} terrain
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @param {Record<string, number>|null} [elevation] Las cotas del tablero, si las tiene.
 * @returns {Array<{x: number, y: number, along: 'ns'|'eo', layers: string[]}>}
 */
export function bridgeTiles(terrain, gridWidth, gridHeight, elevation = null) {
    const cells = terrain?.cells && typeof terrain.cells === 'object' ? terrain.cells : {};
    const width = Math.trunc(Number(gridWidth) || 0);
    const height = Math.trunc(Number(gridHeight) || 0);
    const inside = (/** @type {number} */ x, /** @type {number} */ y) => x >= 0 && y >= 0 && x < width && y < height;
    const typeAt = (/** @type {number} */ x, /** @type {number} */ y) => text(cells[`${x},${y}`]?.type) || 'floor';
    const feetAt = (/** @type {number} */ x, /** @type {number} */ y) => {
        const feet = Number(elevation?.[`${x},${y}`]);
        return Number.isFinite(feet) ? feet : 0;
    };
    const deck = (/** @type {number} */ x, /** @type {number} */ y) => inside(x, y) && typeAt(x, y) === 'floor';
    // Un hueco, mirado desde una casilla a `level` pies: el agua, el abismo, o una caída.
    const gap = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ level) => inside(x, y)
        && (BRIDGE_GAPS.has(typeAt(x, y)) || level - feetAt(x, y) >= CLIFF_FEET);
    // `along` es por dónde se cruza; el ancho va de lado. Se guarda lo ya visto: cada tira se mira una vez.
    /** @type {Map<string, {from: number, to: number}|null>} */
    const seen = new Map();
    const crossing = (/** @type {number} */ x, /** @type {number} */ y, /** @type {'ns'|'eo'} */ along) => {
        const id = `${x},${y},${along}`;
        if (seen.has(id)) return seen.get(id);
        let found = null;
        if (deck(x, y)) {
            const level = feetAt(x, y);
            const [dx, dy] = along === 'ns' ? [1, 0] : [0, 1];
            const same = (/** @type {number} */ k) => deck(x + dx * k, y + dy * k) && feetAt(x + dx * k, y + dy * k) === level;
            let from = 0;
            let to = 0;
            while (from > -BRIDGE_WIDTH && same(from - 1)) from--;
            while (to < BRIDGE_WIDTH && same(to + 1)) to++;
            if (to - from < BRIDGE_WIDTH && gap(x + dx * (from - 1), y + dy * (from - 1), level) && gap(x + dx * (to + 1), y + dy * (to + 1), level)) {
                found = { from, to };
            }
        }
        seen.set(id, found);
        return found;
    };
    // Que la tira llegue a tierra por las dos puntas: siguiendo el cruce, lo primero que no es
    // puente tiene que ser algo que se pisa a su altura (no el agua, ni el borde del tablero).
    const landsBothEnds = (/** @type {number} */ x, /** @type {number} */ y, /** @type {'ns'|'eo'} */ along) => {
        const [dx, dy] = along === 'ns' ? [0, 1] : [1, 0];
        const level = feetAt(x, y);
        for (const sign of [-1, 1]) {
            let k = sign;
            while (crossing(x + dx * k, y + dy * k, along) && Math.abs(k) <= width + height) k += sign;
            const ex = x + dx * k;
            const ey = y + dy * k;
            if (!inside(ex, ey) || gap(ex, ey, level)) return false;
        }
        return true;
    };
    // Solo se mira junto a lo que puede ser un hueco: el agua, el abismo y lo que tiene cota.
    const near = new Set();
    for (const key of [...Object.keys(cells).filter(k => BRIDGE_GAPS.has(text(cells[k]?.type))), ...Object.keys(elevation ?? {})]) {
        const [cx, cy] = key.split(',').map(Number);
        if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;
        for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
            if (inside(cx + dx, cy + dy)) near.add(`${cx + dx},${cy + dy}`);
        }
    }
    /** @type {Array<{x: number, y: number, along: 'ns'|'eo', layers: string[]}>} */
    const out = [];
    for (const key of near) {
        const [x, y] = key.split(',').map(Number);
        const ns = crossing(x, y, 'ns');
        const eo = crossing(x, y, 'eo');
        // Con hueco por los cuatro lados es una isla o un pilar, no un puente.
        if (Boolean(ns) === Boolean(eo)) continue;
        const along = ns ? 'ns' : 'eo';
        const run = /** @type {{from: number, to: number}} */ (ns ?? eo);
        if (!landsBothEnds(x, y, along)) continue;
        const layers = [];
        if (run.from === 0) layers.push(along === 'ns' ? 'puente-baranda-oeste' : 'puente-baranda-norte');
        if (run.to === 0) layers.push(along === 'ns' ? 'puente-baranda-este' : 'puente-baranda-sur');
        layers.push(`puente-${along}`);
        out.push({ x, y, along, layers });
    }
    return out.sort((a, b) => a.y - b.y || a.x - b.x);
}

/** Lo que mide de grueso la cara de un acantilado, en casillas (`acantilado-sur.png` es de 48×16). */
export const CLIFF_FACE = 1 / 3;

/**
 * Tanda 12: el dibujo de un acantilado de las cotas (J12.10, `cliffEdges` en `board/heights.js`):
 * la cara de roca va en la casilla de abajo, pegada al borde, con la luz en el lado alto. El
 * nombre dice hacia dónde se cae (`acantilado-sur`: lo alto está al norte). La caja va en
 * casillas: quien pinta la multiplica por lo que mide una.
 *
 * @param {{x: number, y: number, side: 'right'|'down'|string, drop: number}} edge
 * @returns {{id: string, x: number, y: number, width: number, height: number}}
 */
export function cliffFace(edge) {
    const x = Number(edge?.x) || 0;
    const y = Number(edge?.y) || 0;
    const fallsAway = Number(edge?.drop) > 0;
    if (edge?.side === 'right') {
        return fallsAway
            ? { id: 'acantilado-este', x: x + 1, y, width: CLIFF_FACE, height: 1 }
            : { id: 'acantilado-oeste', x: x + 1 - CLIFF_FACE, y, width: CLIFF_FACE, height: 1 };
    }
    return fallsAway
        ? { id: 'acantilado-sur', x, y: y + 1, width: 1, height: CLIFF_FACE }
        : { id: 'acantilado-norte', x, y: y + 1 - CLIFF_FACE, width: 1, height: CLIFF_FACE };
}

/**
 * @typedef {Object} PixelManifest
 * @property {Set<string>} files Cada PNG, con su carpeta: `clases/guerrero.png`.
 * @property {Record<string, Record<string, string>>} aliases Por carpeta, el nombre en slug
 *   frente al archivo (sin `.png`), cuando no son lo mismo.
 * @property {string[]} packs Los paquetes con retratos (`1387`, `gremio`, `strahd`).
 */

/**
 * @typedef {Object} ArtQuery
 * @property {string} [id]        El id de la fila o de la persona, si se sabe.
 * @property {string} [name]      El nombre que sale en pantalla.
 * @property {string} [pack]      El paquete (`gremio`, `1387`, `strahd`).
 * @property {string} [gender]    Cómo se presenta: `Mujer`, `Hombre`…
 * @property {string} [classId]   El id de la clase (`guerrero`).
 * @property {string} [className] La clase como se escribe (`Pícara`).
 * @property {string} [race]      La especie como se escribe (`Humana`), para el retrato de relleno.
 * @property {string} [archetype] El arquetipo del bestiario (`bestia-lobo`).
 * @property {string} [domain]    La batería del compendio (`armas`, `razas`…).
 * @property {boolean} [night]    Si es de noche: los escenarios tienen su versión.
 * @property {string} [mood]      El gesto de un retrato (`alegre`, `enfadado`, `triste`), si lo hay.
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * El nombre de un archivo a partir de un nombre escrito: minúsculas ASCII, sin tildes («ñ»
 * es «n»), lo que no es letra ni número pasa a `-`, sin guiones repetidos ni en los bordes.
 *
 * @param {any} name
 * @returns {string}
 */
export function slugify(name) {
    return text(name).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

/**
 * Cada clase y cómo empieza su nombre, en masculino o en femenino.
 *
 * @type {Array<[string, RegExp]>}
 */
const CLASS_STARTS = [
    ['guerrero', /^guerrer/], ['barbaro', /^barbar/], ['picaro', /^picar/], ['clerigo', /^clerig/],
    ['druida', /^druid/], ['mago', /^mag[oa](-|$)/], ['bardo', /^bard[oa](-|$)/], ['explorador', /^explorador/],
    ['soldado', /^soldad/], ['erudito', /^erudit/],
];

/**
 * El id de una clase por cómo se escribe: «Pícara» es `picaro`, «Maga» es `mago`.
 *
 * @param {any} name
 * @returns {string} Vacío si no es ninguna de las diez.
 */
export function classIdOf(name) {
    const said = slugify(name);
    if (!said) return '';
    return CLASS_STARTS.find(([, start]) => start.test(said))?.[0] ?? '';
}

/**
 * Qué retrato de relleno le va: `hombre` o `mujer`. Lo dice quien juega al crear; si no lo
 * dijo (o no es ninguno de los dos), se mira el nombre, que en castellano suele avisar.
 *
 * @param {any} gender
 * @param {any} [name]
 * @returns {'hombre'|'mujer'}
 */
export function genderFileOf(gender, name = '') {
    const said = slugify(gender);
    if (/^(mujer|femenin|chica|ella$)/.test(said)) return 'mujer';
    if (/^(hombre|masculin|chico|el$)/.test(said)) return 'hombre';
    return /a$/.test(slugify(name)) ? 'mujer' : 'hombre';
}

/**
 * El índice, con forma aunque llegue roto.
 *
 * @param {any} raw
 * @returns {PixelManifest}
 */
export function readManifest(raw) {
    const files = new Set((Array.isArray(raw?.files) ? raw.files : []).map(text).filter(f => f.endsWith('.png')));
    /** @type {Record<string, Record<string, string>>} */
    const aliases = {};
    for (const [folder, table] of Object.entries(raw?.aliases && typeof raw.aliases === 'object' ? raw.aliases : {})) {
        if (!table || typeof table !== 'object') continue;
        aliases[folder] = {};
        for (const [key, base] of Object.entries(table)) {
            if (text(key) && text(base)) aliases[folder][text(key)] = text(base);
        }
    }
    const packs = [...new Set([...files]
        .map(f => f.split('/'))
        .filter(parts => parts.length === 3 && parts[0] === 'retratos' && parts[1] !== 'heroes' && parts[1] !== 'mercenarios')
        .map(parts => parts[1]))].sort();
    return { files, aliases, packs };
}

/**
 * La parte del nombre que no es el número: «Rata de bodega 2» es «rata-de-bodega».
 *
 * @param {string} slug
 * @returns {string}
 */
function withoutNumber(slug) {
    return slug.replace(/-\d+$/, '');
}

/**
 * «Humana» y «Enana» buscan también «humano» y «enano»: el compendio las nombra en masculino.
 *
 * @param {string} slug
 * @returns {string}
 */
function masculine(slug) {
    return slug.endsWith('a') ? `${slug.slice(0, -1)}o` : slug;
}

/**
 * Los gestos de los retratos (alegre, enfadado, triste). Apagados por ahora: Daniel quiere a todos
 * neutros hasta que los gestos estén más cuidados (2026-10-03). Se pide el gesto igual que siempre,
 * pero mientras esto esté en `false` sale el retrato neutro. Para volver a encenderlos: `on: true`.
 */
export const PORTRAIT_MOODS = { on: false };

/**
 * Los archivos que le tocan a algo, en orden, y solo los que existen.
 *
 * - `class`: el icono de la clase (`clases/`).
 * - `race`: el de la especie (`especies/`).
 * - `hero`: el retrato de relleno de un héroe sin cara (`retratos/heroes/<clase>-<hombre|mujer>`,
 *   o `<especie>-<clase>-<hombre|mujer>` si lo hay de su especie).
 * - `mercenary`: el retrato de un mercenario del gremio.
 * - `portrait`: el de una persona de un paquete (y, si no, de un mercenario). Sin `pack`, se
 *   busca en todos. Con `mood`, antes su gesto (`<persona>--<gesto>.png`) si está dibujado.
 * - `creature`: la ficha de un bicho: por su nombre, por su arquetipo o por el arquetipo que
 *   se lee en el nombre («Lobo viejo» es un lobo).
 * - `template`: el emblema de una plantilla del bestiario.
 * - `item`, `ability`, `spell`, `condition`: los iconos del compendio, por id o por nombre. Un
 *   objeto propio de un paquete, antes, por su nombre (`objetos/<paquete>/`).
 * - `scene`: el escenario de una localización de un paquete (de noche, si lo hay).
 * - `place`: un sitio del pueblo (`sitios/`), de noche si lo hay. Vale el id de un servicio:
 *   la posada es la taberna y el tablón, la sala del gremio.
 * - `tile`: una casilla del tablero (`tablero/`), por el nombre que da `terrainTile`.
 * - `compendium`: una fila de cualquier batería con arte, por su `domain`.
 *
 * @param {string} kind
 * @param {ArtQuery} [query]
 * @param {PixelManifest|null} [manifest] El leído, si no se da otro.
 * @returns {string[]} Las URL, la mejor primero. Vacío sin índice o sin imagen.
 */
export function artFor(kind, query = {}, manifest = loaded) {
    if (!manifest) return [];
    const { files, aliases, packs } = manifest;
    const id = slugify(query.id);
    const slug = slugify(query.name);
    /** @type {string[]} */
    const paths = [];
    const add = (/** @type {string} */ folder, /** @type {string|undefined} */ base) => {
        if (base) paths.push(`${folder}/${base}.png`);
    };
    const alias = (/** @type {string} */ folder, /** @type {string} */ key) => (key ? aliases[folder]?.[key] : undefined);
    // El alias más largo que está entero dentro del nombre: «espada-larga» en «espada-larga-de-acero».
    const inside = (/** @type {string} */ folder, /** @type {string} */ key) => {
        if (!key) return undefined;
        const padded = `-${key}-`;
        const found = Object.keys(aliases[folder] ?? {})
            .filter(k => padded.includes(`-${k}-`))
            .sort((a, b) => b.length - a.length)[0];
        return found ? aliases[folder][found] : undefined;
    };
    const fromFolder = (/** @type {string} */ folder) => {
        add(folder, id);
        add(folder, alias(folder, slug));
        add(folder, slug);
    };

    switch (kind) {
        case 'class': {
            const folder = 'clases';
            add(folder, id);
            add(folder, classIdOf(query.name));
            add(folder, alias(folder, slug));
            break;
        }
        case 'race': {
            const folder = 'especies';
            add(folder, id);
            for (const key of [slug, masculine(slug)]) {
                add(folder, alias(folder, key));
                if (key) add(folder, `raza-${key}`);
            }
            add(folder, slug);
            break;
        }
        case 'hero': {
            const cls = slugify(query.classId) || classIdOf(query.className);
            if (!cls) break;
            const gender = genderFileOf(query.gender, query.name);
            const other = gender === 'mujer' ? 'hombre' : 'mujer';
            // Con su especie, si hay retrato de esa especie y esa clase (`raza-humano-mago-mujer`).
            const race = slugify(query.race);
            const races = race ? [...new Set([race, alias('especies', race), alias('especies', masculine(race)), `raza-${race}`, `raza-${masculine(race)}`])] : [];
            for (const base of races) add('retratos/heroes', base && `${base}-${cls}-${gender}`);
            add('retratos/heroes', `${cls}-${gender}`);
            for (const base of races) add('retratos/heroes', base && `${base}-${cls}-${other}`);
            add('retratos/heroes', `${cls}-${other}`);
            break;
        }
        case 'mercenary': {
            // Con su gesto (`gerd-el-mellado--alegre`), si lo tiene dibujado (J14).
            const mood = PORTRAIT_MOODS.on ? slugify(query.mood) : '';
            if (mood) add('retratos/mercenarios', slug && `${slug}--${mood}`);
            add('retratos/mercenarios', slug);
            break;
        }
        case 'portrait': {
            const pack = slugify(query.pack);
            // Con su gesto, si lo tiene dibujado (`brunilda--enfadado`), y si no, el de siempre.
            const mood = PORTRAIT_MOODS.on ? slugify(query.mood) : '';
            for (const one of pack ? [pack] : packs) {
                const folder = `retratos/${one}`;
                for (const base of [id, alias(folder, slug), slug]) {
                    if (base && mood) add(folder, `${base}--${mood}`);
                    add(folder, base);
                }
            }
            if (mood) add('retratos/mercenarios', slug && `${slug}--${mood}`);
            add('retratos/mercenarios', slug);
            break;
        }
        case 'creature': {
            const folder = 'bestias';
            const bare = withoutNumber(slug);
            add(folder, id);
            add(folder, slug);
            add(folder, bare);
            add(folder, slugify(query.archetype));
            add(folder, alias(folder, slug));
            add(folder, alias(folder, bare));
            add(folder, inside(folder, bare));
            break;
        }
        case 'template':
            add('bestias', id);
            break;
        case 'item': {
            // Los objetos propios de un paquete, por su nombre (`objetos/strahd/…`).
            const pack = slugify(query.pack);
            const own = pack ? [`objetos/${pack}`]
                : [...new Set([...files].filter(f => f.startsWith('objetos/')).map(f => f.split('/').slice(0, 2).join('/')))].sort();
            for (const folder of own) add(folder, slug);
            for (const folder of ITEM_FOLDERS) add(folder, id);
            for (const folder of ITEM_FOLDERS) add(folder, alias(folder, slug));
            // El más largo de los tres gana: «cota-de-malla» antes que «malla».
            const best = ITEM_FOLDERS
                .map(folder => ({ folder, base: inside(folder, slug) }))
                .filter(found => found.base)
                .sort((a, b) => String(b.base).length - String(a.base).length)[0];
            if (best) add(best.folder, best.base);
            break;
        }
        case 'ability':
            add('habilidades', id);
            add('conjuros', id);
            add('habilidades', alias('habilidades', slug));
            add('conjuros', alias('conjuros', slug));
            // Lo que se lee en el botón puede traer algo más: «Segundo aliento (1/1)».
            add('habilidades', inside('habilidades', slug));
            add('conjuros', inside('conjuros', slug));
            break;
        case 'spell':
            fromFolder('conjuros');
            break;
        case 'condition':
            fromFolder('estados');
            add('estados', inside('estados', slug));
            break;
        case 'scene': {
            const pack = slugify(query.pack);
            const folders = pack ? [`escenarios/${pack}`]
                : [...new Set([...files].filter(f => f.startsWith('escenarios/')).map(f => f.split('/').slice(0, 2).join('/')))].sort();
            for (const folder of folders) {
                if (query.night) add(folder, slug && `${slug}-noche`);
                add(folder, slug);
            }
            break;
        }
        case 'place': {
            const place = /** @type {Record<string, string>} */ (SERVICE_PLACES)[id] || id || slug;
            if (query.night) add('sitios', place && `${place}-noche`);
            add('sitios', place);
            break;
        }
        case 'tile': {
            add('tablero', id);
            // El suelo o el muro de un bioma sin dibujo: los de la mazmorra.
            const pair = /^(suelo|muro)-/.exec(id);
            if (pair) add('tablero', `${pair[1]}-mazmorra`);
            // Tanda 12: lo que hace sus veces (la peña del exterior en la playa), y después el de
            // siempre, sin el bioma (`dificil-nieve` sin dibujo es `dificil`).
            for (const other of TILE_STAND_INS[id] ?? []) add('tablero', other);
            const biome = BOARD_BIOMES.find(b => id.endsWith(`-${b}`));
            if (!pair && biome) add('tablero', id.slice(0, -biome.length - 1));
            break;
        }
        case 'compendium': {
            const domain = text(query.domain);
            if (domain === 'clases') return artFor('class', query, manifest);
            if (domain === 'razas') return artFor('race', query, manifest);
            const folder = /** @type {Record<string, string>} */ (PIXEL_DOMAINS)[domain];
            if (folder) fromFolder(folder);
            break;
        }
        default:
            break;
    }

    return [...new Set(paths)].filter(path => files.has(path)).map(path => `${PIXEL_BASE}${path}`);
}

/**
 * El primero de `artFor`, o vacío.
 *
 * @param {string} kind
 * @param {ArtQuery} [query]
 * @param {PixelManifest|null} [manifest]
 * @returns {string}
 */
export function firstArt(kind, query = {}, manifest = loaded) {
    return artFor(kind, query, manifest)[0] ?? '';
}

/** El dibujo de un enemigo que no tiene el suyo (`bestias/enemigo-sin-dibujo.png`). */
export const UNDRAWN_ENEMY = 'enemigo-sin-dibujo';

/**
 * El dibujo de un enemigo en el tablero. Si es alguien del paquete con retrato (el rival de un
 * duelo: Izek, Luvash, Ramiro), su retrato, salvo que tenga su bicho propio dibujado; si no, su
 * bicho, por su nombre o por su arquetipo. Sin paquete abierto no se busca retrato: un «Ramiro»
 * de otra campaña no es el del gremio.
 *
 * @param {{name?: string, archetype?: string, pack?: string}} [query]
 * @param {PixelManifest|null} [manifest]
 * @returns {string}
 */
export function enemyArt({ name = '', archetype = '', pack = '' } = {}, manifest = loaded) {
    const face = pack ? firstArt('portrait', { name, pack }, manifest) : '';
    if (face && !firstArt('creature', { id: name }, manifest)) return face;
    return firstArt('creature', { name, archetype }, manifest)
        // Uno sin dibujo (el jefe propio de una campaña tuya): una sombra encapuchada, no la calavera.
        || firstArt('creature', { id: UNDRAWN_ENEMY }, manifest);
}

/**
 * El sitio dibujado detrás de un rato libre (J14.11): leer en la biblioteca del gremio, si ya
 * la tiene, o entrenar en el patio (`sitios/biblioteca.png`, `sitios/patio.png`). Los demás, y
 * estos si falta su dibujo, el del sitio donde se hacen (la sala del gremio, la posada…).
 *
 * @param {string} pastime El rato (`leer`, `patio`, `cartas`…).
 * @param {string} placeArt El dibujo del sitio (`gremio`, `taberna`…).
 * @param {{library?: number}} [guild] Lo que tiene el gremio: el nivel de la biblioteca.
 * @param {PixelManifest|null} [manifest]
 * @returns {string} El id para `firstArt('place', …)`.
 */
export function pastimePlace(pastime, placeArt, { library = 0 } = {}, manifest = loaded) {
    const own = pastime === 'patio' ? 'patio' : pastime === 'leer' && Number(library) > 0 ? 'biblioteca' : '';
    return own && firstArt('place', { id: own }, manifest) ? own : placeArt;
}

/**
 * Si una imagen es la cara por defecto de SillyTavern (o no hay): la de «sin cara».
 *
 * @param {any} avatar
 * @returns {boolean}
 */
export function isPlainFace(avatar) {
    const said = text(avatar);
    return !said || /user-default\.png|default_avatar/i.test(said);
}

/**
 * El índice, hecho a partir de lo que hay en disco. Lo escribe `tools/pixel-manifest.mjs`;
 * aquí para que la prueba de que no está viejo haga lo mismo que la herramienta.
 *
 * Los alias salen de las filas del compendio con arte (su nombre frente a su id) y de la
 * gente de cada paquete (su nombre frente a su id, o al slug de su nombre). Solo entran los
 * que llevan a un archivo que existe y no son ya el mismo nombre.
 *
 * @param {Object} input
 * @param {string[]} input.files Los PNG, relativos a la carpeta: `clases/guerrero.png`.
 * @param {Record<string, any[]>} [input.domains] Las filas de cada batería, por su nombre.
 * @param {Record<string, any>} [input.packs] Cada paquete, por su id (`strahd`).
 * @returns {{version: number, files: string[], aliases: Record<string, Record<string, string>>}}
 */
export function buildPixelManifest({ files, domains = {}, packs = {} }) {
    const list = [...new Set((Array.isArray(files) ? files : []).map(f => text(f).replace(/\\/g, '/')).filter(f => f.endsWith('.png')))].sort();
    const has = new Set(list);
    /** @type {Record<string, Record<string, string>>} */
    const aliases = {};
    const note = (/** @type {string} */ folder, /** @type {string} */ key, /** @type {string} */ base) => {
        if (!key || !base || key === base || !has.has(`${folder}/${base}.png`)) return;
        aliases[folder] = aliases[folder] ?? {};
        // El primero que llega se queda: dos filas con el mismo nombre no se pisan.
        if (!(key in aliases[folder])) aliases[folder][key] = base;
    };

    for (const [domain, folder] of Object.entries(PIXEL_DOMAINS)) {
        for (const row of Array.isArray(domains[domain]) ? domains[domain] : []) {
            // Las plantillas del bestiario son emblemas, no bichos: no se buscan por nombre.
            if (domain === 'bestiario' && text(row?.kind) !== 'arquetipo') continue;
            note(folder, slugify(row?.name), slugify(row?.id));
        }
    }

    for (const [pack, data] of Object.entries(packs)) {
        const folder = `retratos/${slugify(pack)}`;
        for (const person of [...(Array.isArray(data?.npcs) ? data.npcs : []), ...(Array.isArray(data?.confidants) ? data.confidants : [])]) {
            const base = has.has(`${folder}/${slugify(person?.id)}.png`) ? slugify(person?.id) : slugify(person?.name);
            note(folder, slugify(person?.name), base);
        }
    }

    /** @type {Record<string, Record<string, string>>} */
    const sorted = {};
    for (const folder of Object.keys(aliases).sort()) {
        sorted[folder] = Object.fromEntries(Object.entries(aliases[folder]).sort(([a], [b]) => a.localeCompare(b)));
    }
    return { version: 1, files: list, aliases: sorted };
}

/** @type {PixelManifest|null} */
let loaded = null;
/** @type {Promise<PixelManifest>|null} */
let loading = null;

/**
 * El índice ya leído, o null si todavía no.
 *
 * @returns {PixelManifest|null}
 */
export function pixelManifest() {
    return loaded;
}

/**
 * Poner el índice a mano (las pruebas), o quitarlo con null.
 *
 * @param {any} raw
 * @returns {PixelManifest|null}
 */
export function setPixelManifest(raw) {
    loaded = raw ? readManifest(raw) : null;
    loading = null;
    return loaded;
}

/**
 * Lee el índice, una vez. Si no se puede, queda uno vacío: todo sale con su icono de siempre.
 *
 * @param {(url: string) => Promise<any>} [fetcher]
 * @returns {Promise<PixelManifest>}
 */
export function loadPixelManifest(fetcher = (url) => globalThis.fetch(url)) {
    if (loaded) return Promise.resolve(loaded);
    if (!loading) {
        loading = Promise.resolve()
            .then(() => fetcher(PIXEL_MANIFEST_URL))
            .then(response => (response?.ok ? response.json() : null))
            .catch(() => null)
            .then(raw => {
                loaded = readManifest(raw);
                return loaded;
            });
    }
    return loading;
}

/** El paquete del gremio, por el nombre de su archivo: `gremio`. */
const HUB_PACK_ID = slugify(text(HUB_PACK).split('/').pop()?.replace(/\.pack\.json$/, ''));

/**
 * De qué paquete es un mundo, por sus metadatos: una campaña del tablón dice cuál es; el
 * mundo del gremio es el del gremio. Un mundo hecho con el asistente no es de ninguno.
 *
 * @param {any} meta
 * @returns {string}
 */
export function packOfWorld(meta) {
    const campaign = slugify(meta?.[HUB_CAMPAIGN_KEY]);
    if (campaign) return campaign;
    return isHubWorld(meta) ? HUB_PACK_ID : '';
}

/** @type {Map<string, {pack: string, at: number}>} */
const packByWorld = new Map();

/** Cada cuánto se vuelve a mirar un mundo que no era de ningún paquete: el gremio se marca después de crearse. */
const PACK_RECHECK_MS = 4000;

/**
 * El paquete de la partida abierta, o vacío si no se sabe (todavía). La primera vez que se
 * pide para un mundo se leen sus metadatos, y `onReady` avisa cuando se sabe.
 *
 * @param {((pack: string) => void)|null} [onReady]
 * @returns {string}
 */
export function openPack(onReady = null) {
    const context = /** @type {any} */ (globalThis).SillyTavern?.getContext?.();
    const world = text(context?.chatMetadata?.world_info);
    if (!world || typeof context?.loadWorldInfo !== 'function') return '';
    const known = packByWorld.get(world);
    if (known && (known.pack || Date.now() - known.at < PACK_RECHECK_MS)) return known.pack;
    packByWorld.set(world, { pack: known?.pack ?? '', at: Date.now() });
    Promise.resolve(context.loadWorldInfo(world))
        .then((/** @type {any} */ data) => {
            const pack = packOfWorld(data?.metadata);
            packByWorld.set(world, { pack, at: Date.now() });
            if (pack && onReady) onReady(pack);
        })
        .catch(() => {});
    return known?.pack ?? '';
}
