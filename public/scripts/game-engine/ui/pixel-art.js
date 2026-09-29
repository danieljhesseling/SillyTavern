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

/** Los biomas de las casillas del tablero: cada uno trae su suelo y su muro (`tablero/`). */
export const BOARD_BIOMES = ['mazmorra', 'madera', 'exterior', 'cueva'];

/**
 * Las palabras del nombre de un tablero que dicen dónde se pelea. Lo que no dice nada es
 * piedra: una mazmorra, una bodega, un sótano.
 *
 * @type {Array<[string, string[]]>}
 */
const BIOME_WORDS = [
    ['cueva', ['cueva', 'gruta', 'caverna', 'mina', 'guarida', 'cubil', 'madriguera', 'tunel']],
    ['exterior', ['bosque', 'claro', 'claros', 'camino', 'sendero', 'campo', 'prado', 'plaza', 'calle', 'callejon', 'patio',
        'jardin', 'lago', 'orilla', 'rio', 'puente', 'colina', 'monte', 'cruce', 'peaje', 'campamento', 'aldea', 'pueblo',
        'puerto', 'muelle', 'playa', 'cementerio', 'huerto', 'granja', 'asedio', 'valle', 'ruinas']],
    ['madera', ['taberna', 'posada', 'casa', 'mansion', 'cuarto', 'habitacion', 'salon', 'comedor', 'tienda', 'molino',
        'cabana', 'establo', 'almacen', 'burdel']],
];

/** Las casillas que tienen un solo dibujo, sea cual sea el bioma. */
const TILE_FILES = {
    difficult: 'dificil', cover_half: 'cobertura-media', cover_three_quarters: 'cobertura-tres-cuartos', chasm: 'abismo',
    stairs: 'escalera', water: 'agua', ice: 'hielo', brush: 'maleza', barrel: 'barril', chest: 'cofre', exit: 'salida',
    lever: 'palanca', barricade: 'barricada',
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
    if (/^(wilderness|camp|outdoor|bosque|llanura|pantano|montana|costa|exterior)$/.test(kind)) return 'exterior';
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
    return /** @type {Record<string, string>} */ (TILE_FILES)[type] ?? '';
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
        case 'mercenary':
            add('retratos/mercenarios', slug);
            break;
        case 'portrait': {
            const pack = slugify(query.pack);
            // Con su gesto, si lo tiene dibujado (`brunilda--enfadado`), y si no, el de siempre.
            const mood = slugify(query.mood);
            for (const one of pack ? [pack] : packs) {
                const folder = `retratos/${one}`;
                for (const base of [id, alias(folder, slug), slug]) {
                    if (base && mood) add(folder, `${base}--${mood}`);
                    add(folder, base);
                }
            }
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
