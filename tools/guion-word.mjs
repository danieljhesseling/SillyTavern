#!/usr/bin/env node
/**
 * El guion de una campaña en Word, de ida y vuelta (J5.7 y J5.8 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 *   node tools/guion-word.mjs export gremio                 el guion de El Gremio, en Documentos\Guiones
 *   node tools/guion-word.mjs export strahd --salida x.docx donde se quiera
 *   node tools/guion-word.mjs export mi-campana.json --md   un paquete o un JSON del Gem, y también en .md
 *   node tools/guion-word.mjs import gremio-guion.docx gremio            qué cambiaría (no toca nada)
 *   node tools/guion-word.mjs import gremio-guion.docx gremio --aplicar  y lo guarda
 *
 * Exportar: todo lo que se dice en la campaña, en orden de lectura y con quién lo dice (lo
 * escribe `campaign/script-doc.js`; el Word, `campaign/script-docx.js`). Cada línea lleva al final
 * una marca pequeña y gris con su id y la huella de su texto.
 *
 * Importar: lee el Word (o un .txt o .md con las mismas marcas), compara cada línea con la del
 * juego y dice en castellano llano qué cambió, qué no encuentra, qué cambió el juego mientras
 * tanto, qué marcas de género o huecos se han roto y qué texto nuevo trae sin marca (notas para
 * el Gem guionista: nunca se meten solas). Sin `--aplicar` no cambia nada.
 *
 * Con `--aplicar` escribe cada texto cambiado **en su fuente**, y solo ese trozo:
 *
 * - El Gremio y 1387: su paquete, `public/mundos/<id>.pack.json` (D-J37: se corrigen a mano).
 * - Strahd: `wiki/campanas/strahd/mejoras.json` o `libro.json`, la capa de donde sale el texto, y
 *   luego `node tools/campana-a-paquete.mjs strahd`. Lo que sale de `original.json` (que no se
 *   toca a mano) se escribe encima, en mejoras.json, marcado «propio:».
 * - Las charlas, quedadas, noches, romances, misiones personales y frases de la gente: su archivo
 *   de `public/compendio/`.
 *
 * Cada archivo se vuelve a leer justo antes de escribir, y cada cambio comprueba que el texto
 * sigue siendo el que había (si otro lo cambió mientras tanto, no se pisa). Después se valida:
 * el validador de paquetes y la densidad del mundo, comparados con lo de antes; si algo empeora,
 * se deshace.
 *
 * Usa fflate (ya en package.json) para el zip del .docx.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve, basename, extname, relative } from 'node:path';
import { homedir } from 'node:os';
import { isDeepStrictEqual } from 'node:util';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import yaml from 'js-yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const engine = (/** @type {string} */ path) => import(pathToFileURL(join(ROOT, 'public/scripts/game-engine', path)).href);

const { buildScript, reviewScript, blockParts, readParagraph, normalizeText, COMPENDIO_DOCS } = await engine('campaign/script-doc.js');
const { scriptToDocx, docxBlocks } = await engine('campaign/script-docx.js');
const { validatePack } = await engine('campaign/campaign-pack.js');
const { checkWorldDensity } = await engine('campaign/world-density.js');
const { cleanGemText } = await engine('campaign/campaign-import.js');
const { convertGuion, isRoundFile } = await engine('campaign/guion-pack.js');
const { correctionsRound } = await engine('campaign/guion-round.js');

/** Las campañas del juego, por su id. */
const CAMPAIGNS = ['gremio', '1387', 'strahd'];

/** Las capas de Strahd, de la que manda a la que menos (`tools/campana-a-paquete.mjs`). */
const LAYERS = ['mejoras', 'libro', 'original'];

/** La clave de cada lista al juntar las capas (`campana-a-paquete.mjs`). */
const LAYER_KEYS = {
    locations: 'name', confidants: 'name', bestiary: 'name', items: 'name', boards: 'id', quests: 'id',
    npcs: 'id', contracts: 'id', rumors: 'id', dialogues: 'id', sucesos: 'id',
};

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** @param {string} file @returns {any} */
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

/**
 * Lo que hay en una ruta de un objeto.
 *
 * @param {any} value
 * @param {Array<string|number>} path
 * @returns {any}
 */
const valueAt = (value, path) => path.reduce((at, key) => (at == null ? undefined : at[key]), value);

/** Una ruta, dicha corta: `plot.milestones[2].beats[3].text`. */
const showPath = (/** @type {Array<string|number>} */ path) => path.map((k, i) => (typeof k === 'number' ? `[${k}]` : `${i ? '.' : ''}${k}`)).join('');

// ---------------------------------------------------------------------------------------------
// La campaña: dónde está cada cosa
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} Campaign
 * @property {string} id El del compendio (`gremio`, `1387`, `strahd`), o vacío para otro JSON.
 * @property {string} packFile
 * @property {any} pack
 * @property {Record<string, any>} compendio Los archivos del compendio leídos, por nombre.
 * @property {Record<string, string>} compendioFiles
 * @property {string} root
 * @property {string} rounds La carpeta de sus rondas si sale de ellas (las experimentales); si no, vacío.
 */

/**
 * La campaña, leída: su paquete y las filas del compendio.
 *
 * @param {string} which `gremio`, `1387`, `strahd` o la ruta de un paquete o JSON del Gem.
 * @param {{root?: string, compendio?: boolean}} [input]
 * @returns {Campaign}
 */
export function loadCampaign(which, { root = ROOT, compendio = true } = {}) {
    // Por su nombre: las del juego y cualquier paquete de public/mundos (`ocaso`, `costa`…).
    const named = /^[\w-]+$/.test(String(which)) && existsSync(join(root, 'public', 'mundos', `${which}.pack.json`));
    const packFile = named ? join(root, 'public', 'mundos', `${which}.pack.json`) : resolve(String(which));
    if (!existsSync(packFile)) throw new Error(`No encuentro ${packFile}.`);
    const id = CAMPAIGNS.includes(String(which)) ? String(which) : (/^(gremio|1387|strahd)\.pack\.json$/.exec(basename(packFile))?.[1] ?? '');
    /** @type {Record<string, any>} */
    const docs = {};
    /** @type {Record<string, string>} */
    const files = {};
    if (compendio) {
        for (const doc of COMPENDIO_DOCS) {
            const file = join(root, 'public', 'compendio', `${doc}.json`);
            if (!existsSync(file)) continue;
            docs[doc] = readJson(file);
            files[doc] = file;
        }
    }
    return { id, packFile, pack: readJson(packFile), compendio: docs, compendioFiles: files, root, rounds: roundsFolder(packFile, id, root) };
}

/**
 * Las experimentales (ocaso, costa, pantalla) salen de las rondas de su guion, en
 * `wiki/guiones/<nombre>`: su paquete no se corrige a mano, se corrige con una ronda más (J5.10).
 * El gremio, 1387 y Strahd no (D-J37: su fuente es su paquete o sus capas).
 *
 * @param {string} packFile
 * @param {string} id
 * @param {string} root
 * @returns {string} La carpeta de sus rondas, o vacío.
 */
function roundsFolder(packFile, id, root) {
    if (id) return '';
    const name = /^([\w-]+)\.pack\.json$/.exec(basename(packFile))?.[1] ?? '';
    if (!name || resolve(dirname(packFile)) !== resolve(join(root, 'public', 'mundos'))) return '';
    const folder = join(root, 'wiki', 'guiones', name);
    try {
        return readdirSync(folder).some(file => isRoundFile(file)) ? folder : '';
    } catch {
        return '';
    }
}

/** La fecha de hoy, dicha: «2 de octubre de 2026». */
function today() {
    const now = new Date();
    return `${now.getDate()} de ${MESES[now.getMonth()]} de ${now.getFullYear()}`;
}

/**
 * El guion de una campaña, tal como está ahora.
 *
 * @param {Campaign} campaign
 * @returns {any}
 */
export function scriptOf(campaign) {
    return buildScript(campaign.pack, { campaign: campaign.id, compendio: campaign.compendio, date: today() });
}

// ---------------------------------------------------------------------------------------------
// Las categorías: sacar solo una parte del guion
// ---------------------------------------------------------------------------------------------

/**
 * Las categorías del guion, por de dónde sale cada línea: `sections`, las listas del paquete
 * (`plot.endings` antes que `plot`); `docs`, los archivos del compendio. Lo que no cae en
 * ninguna va a «Lo demás».
 *
 * @type {Array<{id: string, name: string, about: string, sections?: string[], docs?: string[]}>}
 */
export const CATEGORIES = [
    { id: 'historia', name: 'La historia', about: 'Los capítulos y los hitos: sus escenas, lo que dice la gente en ellas y tus opciones.', sections: ['plot'] },
    { id: 'conversaciones', name: 'Conversaciones', about: 'Las conversaciones con la gente, con todas sus ramas.', sections: ['dialogues'] },
    { id: 'peleas', name: 'Tableros y peleas', about: 'Lo que se dice al empezar, durante y al acabar cada pelea, y sus salidas habladas.', sections: ['boards'] },
    { id: 'misiones', name: 'Misiones y encargos', about: 'El nombre, la descripción y los objetivos de las misiones, y los encargos del tablón.', sections: ['quests', 'contracts'] },
    { id: 'finales', name: 'Los finales', about: 'Los finales, lo que fue de cada uno (los epílogos) y los presagios.', sections: ['plot.endings', 'plot.omens'] },
    { id: 'sitios', name: 'Los sitios', about: 'Lo que se ve al mirar cada sitio y lo que te ofrecen allí.', sections: ['locations'] },
    { id: 'gente', name: 'La gente', about: 'Quién es cada uno, lo que sabe, sus secretos y sus saludos.', sections: ['npcs'], docs: ['frases'] },
    { id: 'rumores', name: 'Rumores y sucesos', about: 'Lo que se oye por ahí y lo que pasa de repente (las tarjetas de sucesos).', sections: ['rumors', 'sucesos'] },
    { id: 'charlas', name: 'Charlas', about: 'Las charlas sueltas con la gente y con los tuyos, con sus ramas.', docs: ['charlas'] },
    { id: 'companeros', name: 'Los compañeros', about: 'Cómo se presentan, sus escenas de vínculo, lo que dicen al llegar a cada sitio y sus misiones personales.', sections: ['confidants'], docs: ['companeros', 'personales'] },
    { id: 'quedadas', name: 'Quedadas, noches y romance', about: 'Las quedadas con los tuyos, las noches en la posada y las escenas de romance.', docs: ['quedadas', 'noches', 'romances'] },
    { id: 'mundo', name: 'La presentación', about: 'De qué va la campaña: lo que se lee antes de empezar.', sections: ['world'] },
    { id: 'otros', name: 'Lo demás', about: 'Lo que no cabe en las otras (lo que traiga una campaña nueva).' },
];

/** El nombre de cada categoría, por su id. */
const CATEGORY_NAME = new Map(CATEGORIES.map(c => [c.id, c.name]));

/**
 * La categoría de una línea, por de dónde sale su texto.
 *
 * @param {any} block Una línea del guion (con `src`).
 * @returns {string}
 */
export function categoryOf(block) {
    const doc = String(block?.src?.doc ?? '');
    const path = Array.isArray(block?.src?.path) ? block.src.path : [];
    if (doc && doc !== 'pack') return CATEGORIES.find(c => c.docs?.includes(doc))?.id ?? 'otros';
    const section = String(path[0] ?? '');
    const sub = section === 'plot' ? `plot.${path[1]}` : '';
    return CATEGORIES.find(c => sub && c.sections?.includes(sub))?.id
        ?? CATEGORIES.find(c => c.sections?.includes(section))?.id
        ?? 'otros';
}

/**
 * Las categorías que tiene un guion, en su orden, con cuántas líneas trae cada una.
 *
 * @param {any} script
 * @returns {Array<{id: string, name: string, about: string, lines: number}>}
 */
export function categoriesIn(script) {
    /** @type {Map<string, number>} */
    const count = new Map();
    for (const block of script.blocks) {
        if (!block.id) continue;
        const id = categoryOf(block);
        count.set(id, (count.get(id) ?? 0) + 1);
    }
    return CATEGORIES.filter(c => count.has(c.id)).map(({ id, name, about }) => ({ id, name, about, lines: count.get(id) ?? 0 }));
}

/**
 * Las categorías pedidas, en limpio: `historia,charlas` o una lista. Vacío o «todo»: null (todas).
 * Una que no existe es un error, dicho con las que hay.
 *
 * @param {string|string[]|null|undefined} value
 * @returns {string[]|null}
 */
export function parseCategories(value) {
    const asked = (Array.isArray(value) ? value : String(value ?? '').split(/[\s,;]+/)).map(v => String(v).trim().toLowerCase()).filter(Boolean);
    if (asked.length === 0 || asked.includes('todo') || asked.includes('todas')) return null;
    const wrong = asked.filter(id => !CATEGORY_NAME.has(id));
    if (wrong.length > 0) throw new Error(`No hay ninguna categoría «${wrong.join('», «')}». Las que hay: ${CATEGORIES.map(c => c.id).join(', ')} (o «todo»).`);
    return CATEGORIES.map(c => c.id).filter(id => asked.includes(id));
}

/** Las notas que pone el guion por partes al principio: no son notas tuyas para el Gem. */
const ONLY_NOTE = 'Este guion trae solo: ';
const COUNT_NOTE = /^\d+ líneas?: \d+ dichas? por alguien/;

/** Cómo de alto es un título: la parte manda sobre el capítulo, y así. */
const DEPTH = /** @type {Record<string, number>} */ ({ parte: 1, capitulo: 2, seccion: 3, apartado: 4 });

/**
 * El guion con solo las líneas de unas categorías. Se quedan los títulos que tienen debajo
 * alguna línea que sale, para saber dónde se está; un título que se puede corregir pero es de
 * otra categoría sale sin su marca (solo para leer). La portada y la ayuda se quedan siempre.
 *
 * @param {any} script
 * @param {string[]|null} categories Null: el guion entero, tal cual.
 * @returns {any}
 */
export function filterScript(script, categories) {
    if (!categories) return script;
    const wanted = new Set(categories);
    /** @type {any[]} */
    const blocks = script.blocks;
    const first = blocks.findIndex(b => b.type === 'parte');
    const intro = first < 0 ? blocks.length : first;
    const keepLine = (/** @type {any} */ b) => Boolean(b?.id) && wanted.has(categoryOf(b));
    const heading = (/** @type {any} */ b) => Boolean(b && DEPTH[b.type]);
    /** @type {any[]} */
    const out = [];
    for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        if (i < intro) {
            if (!b.id || keepLine(b)) out.push(b);
            continue;
        }
        if (!heading(b)) {
            if (b.id) {
                if (keepLine(b)) out.push(b);
                continue;
            }
            // Una nota sin marca va con la línea de su lado: la de después o, si no hay, la de antes.
            let near = null;
            for (let j = i + 1; j < blocks.length && !heading(blocks[j]); j++) if (blocks[j].id) { near = blocks[j]; break; }
            for (let j = i - 1; !near && j >= intro && !heading(blocks[j]); j--) if (blocks[j].id) near = blocks[j];
            if (near && keepLine(near)) out.push(b);
            continue;
        }
        // Un título sale si debajo (hasta el siguiente igual o más alto) sale alguna línea.
        let has = keepLine(b);
        for (let j = i + 1; !has && j < blocks.length; j++) {
            if (heading(blocks[j]) && DEPTH[blocks[j].type] <= DEPTH[b.type]) break;
            if (keepLine(blocks[j])) has = true;
        }
        if (!has) continue;
        if (!b.id || keepLine(b)) out.push(b);
        else out.push({ type: b.type, text: b.text, label: b.label, ...(b.depth ? { depth: b.depth } : {}) });
    }
    const lines = out.filter(b => b.id);
    const counts = {
        lines: lines.length,
        said: lines.filter(b => b.kind === 'linea').length,
        choices: lines.filter(b => b.kind === 'tu').length,
        narrator: lines.filter(b => b.kind === 'narrador').length,
    };
    const names = CATEGORIES.filter(c => wanted.has(c.id)).map(c => c.name);
    const notes = [
        {
            type: 'nota', text: `${counts.lines} líneas: ${counts.said} dichas por alguien, ${counts.choices} tuyas, `
                + `${counts.lines - counts.said - counts.choices - counts.narrator} escritas en pantalla y ${counts.narrator} sin nadie que las diga (Narrador).`,
        },
        { type: 'nota', text: `${ONLY_NOTE}${names.join(', ')}. Lo demás no sale, y al importarlo no se toca.` },
    ];
    const at = out.findIndex(b => b.type === 'nota' && COUNT_NOTE.test(String(b.text)));
    if (at >= 0) out.splice(at, 1, ...notes);
    else out.splice(Math.min(out.length, 2), 0, ...notes);
    return { ...script, blocks: out, counts, categories: [...wanted] };
}

// ---------------------------------------------------------------------------------------------
// Exportar
// ---------------------------------------------------------------------------------------------

/**
 * Dónde se guardan los guiones si no se dice: Documentos\Guiones, o guiones/ en el repositorio.
 * `GUION_DOCUMENTOS` dice dónde está Documentos (el lanzador del .exe lo pasa: puede estar en
 * OneDrive).
 */
export function defaultFolder() {
    const documents = documentsFolder();
    return existsSync(documents) ? join(documents, 'Guiones') : join(ROOT, 'guiones');
}

/** @type {string} */
let documentsCache = '';

/**
 * La carpeta Documentos de verdad, la que enseña el Explorador: puede estar en OneDrive
 * («Documentos»), y eso lo dice el registro (como en ProbarCampañas). Antes del 2026-10-04 los
 * guiones iban a `%USERPROFILE%\Documents\Guiones` (`OLD_FOLDER`).
 *
 * @returns {string}
 */
function documentsFolder() {
    const given = process.env.GUION_DOCUMENTOS;
    if (given && existsSync(given)) return given;
    if (documentsCache) return documentsCache;
    documentsCache = join(homedir(), 'Documents');
    if (process.platform === 'win32') {
        try {
            const said = spawnSync('reg', ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Shell Folders', '/v', 'Personal'], { encoding: 'utf8', windowsHide: true });
            const found = /Personal\s+REG_\w+\s+(.+)/.exec(String(said.stdout ?? ''))?.[1]?.trim();
            if (found && existsSync(found)) documentsCache = found;
        } catch { /* sin registro: la de siempre */ }
    }
    return documentsCache;
}

/** Donde se guardaban los guiones antes (si Documentos está en OneDrive, es otra carpeta). */
const OLD_FOLDER = join(homedir(), 'Documents', 'Guiones');

/**
 * El nombre del Word de una campaña: `1387-guion.docx`, o con sus categorías si no va entero
 * (`1387-guion-historia-charlas.docx`; con más de tres, `1387-guion-por-partes.docx`).
 *
 * @param {Campaign} campaign
 * @param {string[]|null} [categories]
 * @returns {string}
 */
export function defaultName(campaign, categories = null) {
    const name = campaign.id || basename(campaign.packFile, extname(campaign.packFile)).replace(/\.pack$/, '');
    if (!categories) return `${name}-guion.docx`;
    return `${name}-guion-${categories.length <= 3 ? categories.join('-') : 'por-partes'}.docx`;
}

/**
 * El guion en Markdown, por si se quiere pegar en el Gem como texto.
 *
 * @param {any} script
 * @returns {string}
 */
export function scriptToMarkdown(script) {
    const heads = { titulo: '# ', parte: '## ', capitulo: '### ', seccion: '#### ', apartado: '##### ' };
    return script.blocks.map((/** @type {any} */ block) => {
        const head = heads[/** @type {keyof typeof heads} */ (block.type)];
        const parts = blockParts(block);
        if (head) return `\n${head}${parts.map(p => p.text).join('')}\n`;
        const said = parts.map(p => {
            if (p.style === 'pre') return `*${p.text.replace(/ · $/, '')}* · `;
            if (p.style === 'label' && p.text !== ': ') return `**${p.text}**`;
            if (p.style === 'mood') return ` *${p.text.trim()}*`;
            return p.text;
        }).join('');
        const indent = '  '.repeat(Number(block.depth) || 0);
        if (block.type === 'nota' || block.type === 'subtitulo') return `${indent}${block.bullet ? '- ' : ''}_${said}_`;
        return `${indent}${block.bullet ? '- ' : ''}${said}`;
    }).join('\n') + '\n';
}

/**
 * Exportar el guion de una campaña a Word.
 *
 * Con `categories`, solo esas (`filterScript`); sin ellas, el guion entero.
 *
 * @param {string} which
 * @param {{out?: string, md?: boolean, root?: string, compendio?: boolean, categories?: string[]|null}} [input]
 * @returns {{file: string, md: string, script: any}}
 */
export function exportScript(which, { out = '', md = false, root = ROOT, compendio = true, categories = null } = {}) {
    const campaign = loadCampaign(which, { root, compendio });
    const script = filterScript(scriptOf(campaign), categories);
    const file = resolve(out || join(defaultFolder(), defaultName(campaign, categories)));
    mkdirSync(dirname(file), { recursive: true });
    const parts = scriptToDocx(script, { when: new Date().toISOString().replace(/\.\d+Z$/, 'Z') });
    /** @type {Record<string, Uint8Array>} */
    const zipped = {};
    for (const [path, xml] of Object.entries(parts)) zipped[path] = strToU8(xml);
    writeFileSync(file, zipSync(zipped, { level: 6 }));
    let mdFile = '';
    if (md) {
        mdFile = file.replace(/\.docx$/i, '') + '.md';
        writeFileSync(mdFile, scriptToMarkdown(script));
    }
    return { file, md: mdFile, script };
}

// ---------------------------------------------------------------------------------------------
// Leer el Word corregido
// ---------------------------------------------------------------------------------------------

/**
 * Los párrafos de un guion corregido, con su estilo: de un .docx, o de un .txt o .md con las
 * mismas marcas.
 *
 * @param {string} file
 * @returns {Array<{text: string, style: string}>}
 */
export function readParagraphs(file) {
    if (/\.docx$/i.test(file)) {
        const entries = unzipSync(readFileSync(file), { filter: entry => entry.name === 'word/document.xml' });
        const xml = entries['word/document.xml'];
        if (!xml) throw new Error(`${file} no parece un Word: no trae word/document.xml.`);
        return docxBlocks(strFromU8(xml));
    }
    // Texto: una línea por párrafo. Lo de Markdown (#, viñetas, negritas) se quita solo delante
    // de los dos puntos: lo de detrás es el texto y no se toca. Un título (#) y una nota (_…_)
    // no son líneas.
    return readFileSync(file, 'utf8').split(/\r?\n/).map(line => {
        const heading = /^\s*#{1,6}\s+/.test(line);
        let said = line.replace(/^\s*#{1,6}\s+/, '').replace(/^\s*(?:[-*•◦▪–]\s+)+/, '');
        const note = /^_.*_$/.test(said.trim());
        if (note) said = said.trim().replace(/^_(.*)_$/, '$1');
        const cut = said.indexOf(': ');
        const head = cut >= 0 ? said.slice(0, cut) : said;
        const rest = cut >= 0 ? said.slice(cut) : '';
        said = head.replace(/\*\*|__/g, '').replace(/(^|\s)[*_]([^*_]+)[*_]/g, '$1$2') + rest;
        return { text: said, style: heading ? 'Heading' : note ? 'GuionNota' : '' };
    });
}

// ---------------------------------------------------------------------------------------------
// El JSON con posiciones: cambiar solo un trozo
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} JsonNode
 * @property {'object'|'array'|'string'|'literal'} type
 * @property {number} start
 * @property {number} end
 * @property {any} [value] En una cadena, su texto.
 * @property {Array<{key: string, keyStart: number, node: JsonNode}>} [props]
 * @property {JsonNode[]} [items]
 */

/**
 * Un JSON leído con dónde empieza y acaba cada valor.
 *
 * @param {string} source
 * @returns {JsonNode}
 */
export function parseWithSpans(source) {
    let i = 0;
    const space = () => { while (i < source.length && ' \t\n\r'.includes(source[i])) i++; };
    const fail = (/** @type {string} */ what) => { throw new Error(`JSON roto cerca de la posición ${i}: ${what}`); };
    /** @returns {JsonNode} */
    const string = () => {
        const start = i;
        if (source[i] !== '"') fail('falta una cadena');
        i++;
        while (i < source.length && source[i] !== '"') i += source[i] === '\\' ? 2 : 1;
        i++;
        return { type: 'string', start, end: i, value: JSON.parse(source.slice(start, i)) };
    };
    /** @returns {JsonNode} */
    const value = () => {
        space();
        const start = i;
        const c = source[i];
        if (c === '{') {
            i++;
            /** @type {JsonNode['props']} */
            const props = [];
            space();
            if (source[i] === '}') { i++; return { type: 'object', start, end: i, props }; }
            for (;;) {
                space();
                const key = string();
                space();
                if (source[i] !== ':') fail('faltan los dos puntos');
                i++;
                props.push({ key: key.value, keyStart: key.start, node: value() });
                space();
                if (source[i] === ',') { i++; continue; }
                if (source[i] !== '}') fail('falta «}»');
                i++;
                return { type: 'object', start, end: i, props };
            }
        }
        if (c === '[') {
            i++;
            /** @type {JsonNode[]} */
            const items = [];
            space();
            if (source[i] === ']') { i++; return { type: 'array', start, end: i, items }; }
            for (;;) {
                items.push(value());
                space();
                if (source[i] === ',') { i++; continue; }
                if (source[i] !== ']') fail('falta «]»');
                i++;
                return { type: 'array', start, end: i, items };
            }
        }
        if (c === '"') return string();
        const literal = /^(?:-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(source.slice(i, i + 64));
        if (!literal) fail('valor desconocido');
        i += /** @type {RegExpExecArray} */ (literal)[0].length;
        return { type: 'literal', start, end: i };
    };
    const root = value();
    space();
    if (i < source.length) fail('sobra algo al final');
    return root;
}

/**
 * El nodo de una ruta.
 *
 * @param {JsonNode} root
 * @param {Array<string|number>} path
 * @returns {JsonNode|null}
 */
function nodeAt(root, path) {
    let node = /** @type {JsonNode|null} */ (root);
    for (const key of path) {
        if (!node) return null;
        if (node.type === 'object') node = node.props?.find(p => p.key === String(key))?.node ?? null;
        else if (node.type === 'array' && typeof key === 'number') node = node.items?.[key] ?? null;
        else return null;
    }
    return node;
}

/** Lo que hay delante en el renglón de una posición, si es solo sangría. */
function indentAt(/** @type {string} */ source, /** @type {number} */ at) {
    const lineStart = source.lastIndexOf('\n', at - 1) + 1;
    const before = source.slice(lineStart, at);
    return /^[ \t]*$/.test(before) ? before : null;
}

/** Un valor en JSON, con la sangría de donde va. */
function jsonAt(/** @type {any} */ value, /** @type {string|null} */ indent) {
    if (typeof value !== 'object' || value === null || indent === null) return JSON.stringify(value);
    return JSON.stringify(value, null, 2).split('\n').map((row, i) => (i === 0 ? row : `${indent}${row}`)).join('\n');
}

/**
 * @typedef {Object} JsonEdit Un cambio en un archivo JSON.
 * @property {'replace'|'add'|'append'} op replace: una cadena por otra. add: un campo nuevo en un
 *   objeto. append: una fila nueva al final de una lista.
 * @property {Array<string|number>} path La cadena (replace), el objeto (add) o la lista (append).
 * @property {string} [expect] replace: lo que tiene que decir ahora.
 * @property {string} [key] add: el campo.
 * @property {any} value
 */

/**
 * Hacer unos cambios en el texto de un JSON, tocando solo sus trozos. Falla (sin cambiar nada)
 * si algo no está donde se esperaba.
 *
 * @param {string} source
 * @param {JsonEdit[]} edits
 * @returns {string}
 */
export function editJson(source, edits) {
    const root = parseWithSpans(source);
    /** @type {Array<{start: number, end: number, text: string}>} */
    const cuts = [];
    for (const edit of edits) {
        const node = nodeAt(root, edit.path);
        if (!node) throw new Error(`no encuentro ${showPath(edit.path)}`);
        if (edit.op === 'replace') {
            if (node.type !== 'string') throw new Error(`${showPath(edit.path)} no es un texto`);
            if (edit.expect !== undefined && node.value !== edit.expect) throw new Error(`${showPath(edit.path)} ha cambiado mientras tanto`);
            cuts.push({ start: node.start, end: node.end, text: JSON.stringify(edit.value) });
        } else if (edit.op === 'add') {
            if (node.type !== 'object') throw new Error(`${showPath(edit.path)} no es un objeto`);
            const key = String(edit.key);
            if (node.props?.some(p => p.key === key)) throw new Error(`${showPath(edit.path)} ya tiene «${key}»`);
            const last = node.props?.[node.props.length - 1];
            if (!last) {
                cuts.push({ start: node.start, end: node.end, text: `{ ${JSON.stringify(key)}: ${JSON.stringify(edit.value)} }` });
                continue;
            }
            const indent = indentAt(source, last.keyStart);
            const glue = indent === null ? ', ' : `,\n${indent}`;
            cuts.push({ start: last.node.end, end: last.node.end, text: `${glue}${JSON.stringify(key)}: ${jsonAt(edit.value, indent)}` });
        } else {
            if (node.type !== 'array') throw new Error(`${showPath(edit.path)} no es una lista`);
            const last = node.items?.[node.items.length - 1];
            if (!last) {
                cuts.push({ start: node.start, end: node.end, text: `[${JSON.stringify(edit.value)}]` });
                continue;
            }
            const indent = indentAt(source, last.start);
            cuts.push({ start: last.end, end: last.end, text: `${indent === null ? ', ' : `,\n${indent}`}${jsonAt(edit.value, indent)}` });
        }
    }
    // De atrás adelante, para que las posiciones de delante sigan valiendo.
    cuts.sort((a, b) => b.start - a.start || b.end - a.end);
    let out = source;
    for (const cut of cuts) out = out.slice(0, cut.start) + cut.text + out.slice(cut.end);
    JSON.parse(out);
    return out;
}

// ---------------------------------------------------------------------------------------------
// De cada línea cambiada, a su fuente
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} Plan Dónde se escribe un texto cambiado.
 * @property {string} file
 * @property {JsonEdit} edit
 * @property {string} target Para juntar dos cambios al mismo sitio.
 * @property {string} [nested] add de una parte de un campo: la ruta dentro de él.
 */

/** Strahd: las tres capas, leídas. */
function strahdLayers(/** @type {string} */ root) {
    const folder = join(root, 'wiki', 'campanas', 'strahd');
    /** @type {Record<string, {file: string, json: any}>} */
    const layers = {};
    for (const layer of LAYERS) {
        const file = join(folder, `${layer}.json`);
        layers[layer] = { file, json: existsSync(file) ? readJson(file) : {} };
    }
    return layers;
}

/** Lo de «propio:» delante de un texto escrito a mano en las capas de Strahd. */
const ownPrefix = (/** @type {any} */ raw) => /^propio:\s*/.exec(String(raw ?? ''))?.[0] ?? '';

/**
 * Dónde se escribe, en Strahd, un texto del paquete: la capa de donde sale (mejoras o libro), o
 * encima, en mejoras, si sale del original.
 *
 * @param {any} pack
 * @param {Array<string|number>} path La ruta en el paquete.
 * @param {string} said El texto nuevo.
 * @param {Record<string, {file: string, json: any}>} layers
 * @returns {Plan|{error: string}}
 */
function strahdPlan(pack, path, said, layers) {
    const [section, index, field, ...rest] = path;
    const replaceIn = (/** @type {string} */ layer, /** @type {Array<string|number>} */ at) => {
        const raw = valueAt(layers[layer].json, at);
        if (typeof raw !== 'string') return { error: `en ${layer}.json no hay texto en ${showPath(at)}` };
        if (cleanGemText(raw) !== valueAt(pack, path)) return { error: `${layer}.json no dice lo mismo que el paquete en ${showPath(at)}: vuelve a generar el paquete` };
        return { file: layers[layer].file, target: `${layer}:${showPath(at)}`, edit: { op: /** @type {const} */ ('replace'), path: at, expect: raw, value: `${ownPrefix(raw)}${said}` } };
    };
    // Lo del original va encima, en la capa más alta que tenga esa lista (mejoras; si no, libro).
    const overOriginal = (/** @type {string} */ list, /** @type {string} */ keyName, /** @type {string} */ key, /** @type {string} */ top, /** @type {Array<string|number>} */ inner) => {
        const layer = LAYERS.slice(0, 2).find(name => Array.isArray(layers[name].json[list])) ?? '';
        if (!layer) return { error: `${list} no está en mejoras.json ni en libro.json` };
        const rows = layers[layer].json[list];
        const at = rows.map((/** @type {any} */ r, /** @type {number} */ k) => k).reverse()
            .find((/** @type {number} */ k) => String(rows[k]?.[keyName]).toLowerCase() === String(key).toLowerCase());
        const target = `${layer}:${list}:${String(key).toLowerCase()}:${top}`;
        const file = layers[layer].file;
        if (inner.length === 0) {
            const value = `propio: ${said}`;
            if (at == null) return { file, target, edit: { op: /** @type {const} */ ('append'), path: [list], value: { [keyName]: key, [top]: value } } };
            return { file, target, edit: { op: /** @type {const} */ ('add'), path: [list, at], key: top, value } };
        }
        // Una parte de un campo (un objetivo de una misión): va el campo entero, con el cambio dentro.
        const whole = structuredClone(valueAt(pack, [section, index, top]));
        if (at == null) return { file, target, nested: showPath(inner), edit: { op: /** @type {const} */ ('append'), path: [list], value: { [keyName]: key, [top]: whole } } };
        return { file, target, nested: showPath(inner), edit: { op: /** @type {const} */ ('add'), path: [list, at], key: top, value: whole } };
    };

    if (section === 'world') {
        const layer = LAYERS.find(name => layers[name].json.world?.[path[1]] !== undefined);
        if (!layer || layer === 'original' || path[1] === 'factions') return { error: 'este texto del mundo no se puede cambiar desde aquí' };
        return replaceIn(layer, path);
    }
    const keyName = LAYER_KEYS[/** @type {keyof typeof LAYER_KEYS} */ (String(section))];
    if (keyName) {
        const key = valueAt(pack, [section, index, keyName]);
        for (const layer of LAYERS) {
            const rows = layers[layer].json[section];
            if (!Array.isArray(rows)) continue;
            // Dos filas con la misma clave se juntan en orden: manda la última que trae el campo.
            for (let k = rows.length - 1; k >= 0; k--) {
                if (String(rows[k]?.[keyName]).toLowerCase() !== String(key).toLowerCase() || rows[k][field] === undefined) continue;
                if (layer !== 'original') return replaceIn(layer, [section, k, field, ...rest]);
                return overOriginal(String(section), keyName, key, String(field), rest);
            }
        }
        return { error: 'no sé de qué archivo de Strahd sale' };
    }
    if (section === 'plot') {
        const over = layers.mejoras.json.plot ?? {};
        if (path[1] !== 'milestones') return replaceIn('mejoras', path);
        const id = valueAt(pack, ['plot', 'milestones', path[2], 'id']);
        const mi = (over.milestones ?? []).findIndex((/** @type {any} */ m) => m?.id === id);
        if (mi < 0) return { error: `el hito ${id} no está en mejoras.json` };
        const fieldName = String(path[3]);
        const milestone = over.milestones[mi];
        if (milestone[fieldName] !== undefined) return replaceIn('mejoras', ['plot', 'milestones', mi, ...path.slice(3)]);
        // El título y la escena salen de su misión; la pista la escribe el juego: se pone en el hito.
        if (fieldName === 'title' || fieldName === 'scene') {
            const q = (pack.quests ?? []).findIndex((/** @type {any} */ quest) => quest?.id === milestone.quest);
            if (q >= 0) return strahdPlan(pack, ['quests', q, fieldName === 'title' ? 'name' : 'description'], said, layers);
        }
        return {
            file: layers.mejoras.file, target: `mejoras:plot.milestones[${mi}].${fieldName}`,
            edit: { op: 'add', path: ['plot', 'milestones', mi], key: fieldName, value: `propio: ${said}` },
        };
    }
    return { error: 'no sé de qué archivo de Strahd sale' };
}

/**
 * Dónde se escribe un texto cambiado.
 *
 * @param {Campaign} campaign
 * @param {any} block La línea, con su `src`.
 * @param {string} said
 * @param {any} layers Strahd: sus capas.
 * @returns {Plan|{error: string}}
 */
function planFor(campaign, block, said, layers) {
    const { doc, path } = block.src ?? {};
    if (doc && doc !== 'pack') {
        const file = campaign.compendioFiles[doc];
        if (!file) return { error: `no encuentro compendio/${doc}.json` };
        return { file, target: `${doc}:${showPath(path)}`, edit: { op: 'replace', path, expect: valueAt(campaign.compendio[doc], path), value: said } };
    }
    if (campaign.id === 'strahd') return strahdPlan(campaign.pack, path, said, layers);
    // Las experimentales: a una ronda nueva de su guion (`applyRound`).
    if (campaign.rounds) return { file: campaign.rounds, target: `pack:${showPath(path)}`, edit: { op: 'round', path, expect: valueAt(campaign.pack, path), value: said } };
    return { file: campaign.packFile, target: `pack:${showPath(path)}`, edit: { op: 'replace', path, expect: valueAt(campaign.pack, path), value: said } };
}

/**
 * Los cambios de un mismo campo del original (dos objetivos de una misión) van en un solo campo.
 *
 * @param {Array<{change: any, plan: Plan}>} planned
 * @returns {Array<{changes: any[], plan: Plan}>}
 */
function mergePlans(planned) {
    /** @type {Map<string, {changes: any[], plan: Plan}>} */
    const byTarget = new Map();
    for (const { change, plan } of planned) {
        const same = byTarget.get(plan.target);
        if (!same) {
            byTarget.set(plan.target, { changes: [change], plan: structuredClone(plan) });
            continue;
        }
        same.changes.push(change);
    }
    // Lo anidado: cada cambio pone su texto dentro del campo copiado.
    for (const entry of byTarget.values()) {
        if (!entry.plan.nested) continue;
        const value = entry.plan.edit.op === 'append' ? entry.plan.edit.value[Object.keys(entry.plan.edit.value)[1]] : entry.plan.edit.value;
        for (const change of entry.changes) {
            const inner = change.block.src.path.slice(3);
            const parent = valueAt(value, inner.slice(0, -1));
            if (parent) parent[inner[inner.length - 1]] = `propio: ${change.after}`;
        }
    }
    // Dos campos de una fila que aún no está en la capa (la descripción y los objetivos de una
    // misión del original): una sola fila nueva con los dos.
    /** @type {Map<string, {changes: any[], plan: Plan}>} */
    const rows = new Map();
    const out = [];
    for (const entry of byTarget.values()) {
        if (entry.plan.edit.op !== 'append') {
            out.push(entry);
            continue;
        }
        const [keyName] = Object.keys(entry.plan.edit.value);
        const row = `${entry.plan.file}|${showPath(entry.plan.edit.path)}|${String(entry.plan.edit.value[keyName]).toLowerCase()}`;
        const same = rows.get(row);
        if (!same) {
            rows.set(row, entry);
            out.push(entry);
            continue;
        }
        Object.assign(same.plan.edit.value, entry.plan.edit.value);
        same.changes.push(...entry.changes);
    }
    return out;
}

// ---------------------------------------------------------------------------------------------
// Importar
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} ImportResult
 * @property {string} title El nombre de la campaña.
 * @property {string} root La raíz del repositorio (para decir los archivos cortos).
 * @property {any} review Lo que dice `reviewScript`.
 * @property {Array<{changes: any[], plan: Plan}>} ready Lo que se puede guardar.
 * @property {Array<{change: any, error: string}>} refused Lo que no.
 * @property {string[]} written Los archivos escritos (con `apply`).
 * @property {string[]} checks Lo que dijeron los validadores.
 * @property {boolean} undone Si se deshizo por empeorar algo.
 * @property {string[]} present Las categorías que trae el Word (las de sus marcas).
 * @property {string[]|null} only Las que se pidió guardar (null: todas las que trae).
 * @property {any[]} skipped Líneas cambiadas de categorías que no se pidió guardar: no se tocan.
 * @property {Array<{id: string, name: string, lines: number, changed: number, refused: number, skipped: number, newer: number, conflicts: number, missing: number}>} byCategory
 * @property {string} backup La carpeta con la copia de lo que había antes de guardar.
 * @property {string} round Las experimentales: la ronda escrita.
 */

/**
 * Los párrafos del Word sin las notas que pone el guion por partes (la cuenta y «Este guion trae
 * solo…»): no son notas tuyas para el Gem.
 *
 * @param {Array<{text: string, style: string}>} paragraphs
 */
function withoutOwnNotes(paragraphs) {
    return paragraphs.filter(p => {
        const said = normalizeText(p.text);
        return !said.startsWith(ONLY_NOTE) && !COUNT_NOTE.test(said);
    });
}

/**
 * Comparar un guion corregido con el juego y, si se pide, guardar lo cambiado.
 *
 * @param {string} file El .docx (o .txt, .md).
 * @param {string} which La campaña.
 * Un Word por partes (de unas categorías) solo cuenta como «no está en el Word» lo de esas. Con
 * `categories`, solo se guarda lo de esas; lo demás que cambió se dice aparte y no se toca. Con
 * `backup`, antes de escribir se copia ahí cada archivo que se va a tocar.
 *
 * @param {{apply?: boolean, root?: string, compendio?: boolean, categories?: string[]|null, backup?: string,
 *   regenerate?: (root: string) => {ok: boolean, output: string}}} [input]
 * @returns {ImportResult}
 */
export function importScript(file, which, { apply = false, root = ROOT, compendio = true, categories = null, backup = '', regenerate = regenerateStrahd } = {}) {
    const campaign = loadCampaign(which, { root, compendio });
    const script = scriptOf(campaign);
    const paragraphs = withoutOwnNotes(readParagraphs(file));
    const review = reviewScript(script, paragraphs);
    /** @type {Map<string, any>} */
    const byId = new Map(script.blocks.filter((/** @type {any} */ b) => b.id).map((/** @type {any} */ b) => [b.id, b]));
    const catOfId = (/** @type {string} */ id) => (byId.has(id) ? categoryOf(byId.get(id)) : '');
    // Las categorías del Word: las de las marcas que trae.
    /** @type {Map<string, number>} */
    const inWord = new Map();
    for (const paragraph of paragraphs) {
        const read = readParagraph(normalizeText(paragraph.text));
        const cat = read ? catOfId(read.id) : '';
        if (cat) inWord.set(cat, (inWord.get(cat) ?? 0) + 1);
    }
    review.missing = review.missing.filter((/** @type {string} */ id) => inWord.has(catOfId(id)));
    const only = categories ? new Set(categories) : null;
    /** @type {any[]} */
    const skipped = [];
    const layers = campaign.id === 'strahd' ? strahdLayers(root) : null;
    /** @type {Array<{change: any, plan: Plan}>} */
    const planned = [];
    /** @type {Array<{change: any, error: string}>} */
    const refused = [];
    for (const change of review.changed) {
        if (only && !only.has(categoryOf(change.block))) {
            skipped.push(change);
            continue;
        }
        if (change.errors.length > 0) {
            refused.push({ change, error: change.errors.join('; ') });
            continue;
        }
        const plan = planFor(campaign, change.block, change.after, layers);
        if ('error' in plan) refused.push({ change, error: plan.error });
        else planned.push({ change, plan });
    }
    // Dos líneas que salen del mismo texto (el título de un hito y el nombre de su misión) y se
    // cambiaron distinto: no se elige por nadie.
    /** @type {Map<string, Set<string>>} */
    const wanted = new Map();
    for (const { change, plan } of planned) {
        if (plan.nested) continue;
        wanted.set(plan.target, (wanted.get(plan.target) ?? new Set()).add(change.after));
    }
    const clashing = planned.filter(({ plan }) => !plan.nested && (wanted.get(plan.target)?.size ?? 0) > 1);
    for (const { change } of clashing) refused.push({ change, error: 'otra línea que sale del mismo texto se cambió distinto' });
    const ready = mergePlans(planned.filter(entry => !clashing.includes(entry)));

    /** @type {ImportResult} */
    const result = {
        title: script.title, root, review, ready, refused, written: [], checks: [], undone: false,
        present: CATEGORIES.map(c => c.id).filter(id => inWord.has(id)), only: categories, skipped, byCategory: [], backup: '', round: '',
    };
    tallyCategories(result, inWord, catOfId);
    if (!apply || ready.length === 0) return result;
    if (campaign.rounds) applyRound(campaign, ready, result, backup);
    else applyPlans(campaign, ready, result, regenerate, backup);
    tallyCategories(result, inWord, catOfId);
    return result;
}

/**
 * La cuenta por categorías: cuántas líneas trae el Word de cada una y qué pasa con ellas.
 *
 * @param {ImportResult} result
 * @param {Map<string, number>} inWord
 * @param {(id: string) => string} catOfId
 */
function tallyCategories(result, inWord, catOfId) {
    const { review } = result;
    result.byCategory = [];
    const row = (/** @type {string} */ id) => {
        let found = result.byCategory.find(r => r.id === id);
        if (!found) {
            found = { id, name: CATEGORY_NAME.get(id) ?? id, lines: inWord.get(id) ?? 0, changed: 0, refused: 0, skipped: 0, newer: 0, conflicts: 0, missing: 0 };
            result.byCategory.push(found);
        }
        return found;
    };
    for (const id of result.present) row(id);
    for (const entry of result.ready) for (const change of entry.changes) row(categoryOf(change.block)).changed++;
    for (const { change } of result.refused) row(categoryOf(change.block)).refused++;
    for (const change of result.skipped) row(categoryOf(change.block)).skipped++;
    for (const { id } of review.newer) row(catOfId(id) || 'otros').newer++;
    for (const { id } of review.conflicts) row(catOfId(id) || 'otros').conflicts++;
    for (const id of review.missing) row(catOfId(id) || 'otros').missing++;
    const order = CATEGORIES.map(c => c.id);
    result.byCategory.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}

/**
 * Antes de guardar: una copia de cada archivo que se va a tocar, en `folder`, con su ruta
 * dentro del juego (`public/mundos/1387.pack.json`). Los de fuera del juego, por su nombre.
 *
 * @param {string[]} files
 * @param {string} folder
 * @param {string} [root]
 * @returns {string[]} Las copias.
 */
export function backupFiles(files, folder, root = ROOT) {
    /** @type {string[]} */
    const made = [];
    for (const file of new Set(files)) {
        if (!existsSync(file)) continue;
        const inside = relative(root, file);
        const target = join(folder, !inside || inside.startsWith('..') || resolve(inside) === inside ? basename(file) : inside);
        mkdirSync(dirname(target), { recursive: true });
        copyFileSync(file, target);
        made.push(target);
    }
    return made;
}

/**
 * La carpeta de una copia nueva: `<base>/2026-10-04_18-05-12_1387`.
 *
 * @param {string} base
 * @param {string} name
 * @returns {string}
 */
export function backupFolder(base, name) {
    const d = new Date();
    const two = (/** @type {number} */ n) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}_${two(d.getHours())}-${two(d.getMinutes())}-${two(d.getSeconds())}`;
    const tag = String(name).replace(/[^\w-]+/g, '-');
    let folder = join(base, `${stamp}_${tag}`);
    for (let i = 2; existsSync(folder); i++) folder = join(base, `${stamp}_${tag}-${i}`);
    return folder;
}

/**
 * Lo que dicen el validador y la densidad de un paquete, para comparar antes y después.
 *
 * @param {any} pack
 */
function packHealth(pack) {
    const valid = validatePack(pack);
    const density = checkWorldDensity(pack);
    return { errors: valid.errors.length, density: density.errors.length, messages: [...valid.errors.map((/** @type {any} */ e) => `${e.path}: ${e.message}`), ...density.errors] };
}

/** Strahd: volver a hacer el paquete desde sus capas. */
function regenerateStrahd(/** @type {string} */ root) {
    const run = spawnSync(process.execPath, [join(root, 'tools', 'campana-a-paquete.mjs'), 'strahd'], { encoding: 'utf8', cwd: root });
    return { ok: run.status === 0, output: `${run.stdout ?? ''}${run.stderr ?? ''}`.trim() };
}

/**
 * Guardar: cada archivo, vuelto a leer justo antes, con sus trozos cambiados. Después, validar;
 * si algo empeora, se deja como estaba.
 *
 * @param {Campaign} campaign
 * @param {Array<{changes: any[], plan: Plan}>} ready
 * @param {ImportResult} result
 * @param {(root: string) => {ok: boolean, output: string}} regenerate
 * @param {string} [backup] Dónde copiar antes lo que se va a tocar.
 */
function applyPlans(campaign, ready, result, regenerate, backup = '') {
    const before = packHealth(campaign.pack);
    /** @type {Map<string, JsonEdit[]>} */
    const byFile = new Map();
    for (const { plan } of ready) byFile.set(plan.file, [...(byFile.get(plan.file) ?? []), plan.edit]);
    if (backup) {
        backupFiles([...byFile.keys(), campaign.packFile], backup, campaign.root);
        result.backup = backup;
    }
    /** @type {Map<string, string>} */
    const previous = new Map();
    const undo = () => {
        for (const [path, text] of previous) writeFileSync(path, text);
        result.written = [];
        result.undone = true;
    };
    for (const [path, edits] of byFile) {
        const now = readFileSync(path, 'utf8');
        let next = '';
        try {
            next = editJson(now, edits);
        } catch (error) {
            result.checks.push(`${path}: no se ha tocado (${/** @type {Error} */ (error).message}).`);
            undo();
            return;
        }
        previous.set(path, now);
        writeFileSync(path, next);
        result.written.push(path);
    }
    if (campaign.id === 'strahd') {
        const made = regenerate(campaign.root);
        if (!made.ok) {
            result.checks.push(`El paquete de Strahd no sale con los cambios:\n${made.output}`);
            undo();
            regenerate(campaign.root);
            return;
        }
        result.checks.push(made.output.split('\n').pop() ?? 'Paquete de Strahd hecho de nuevo.');
    }
    const after = packHealth(readJson(campaign.packFile));
    if (after.errors > before.errors || after.density > before.density) {
        const fresh = after.messages.filter(m => !before.messages.includes(m));
        result.checks.push(`Con los cambios, el paquete tiene más errores que antes:\n  ${fresh.join('\n  ')}`);
        undo();
        if (campaign.id === 'strahd') regenerate(campaign.root);
        return;
    }
    result.checks.push(`El validador de paquetes: ${after.errors === 0 ? 'sin errores' : `${after.errors} errores, como antes`}.`);
    result.checks.push(`La densidad del mundo: ${after.density === 0 ? 'sin errores' : `${after.density} avisos del listón, como antes`}.`);
}

/**
 * Los textos que cambian de un JSON a otro, como cambios de `editJson`. Null si cambia algo más
 * que textos (una lista más larga, un número).
 *
 * @param {any} before
 * @param {any} after
 * @param {Array<string|number>} [path]
 * @param {JsonEdit[]} [out]
 * @returns {JsonEdit[]|null}
 */
function textEdits(before, after, path = [], out = []) {
    if (typeof before === 'string' && typeof after === 'string') {
        if (before !== after) out.push({ op: 'replace', path, expect: before, value: after });
        return out;
    }
    if (Array.isArray(before) && Array.isArray(after)) {
        if (before.length !== after.length) return null;
        for (let i = 0; i < before.length; i++) if (!textEdits(before[i], after[i], [...path, i], out)) return null;
        return out;
    }
    if (before && after && typeof before === 'object' && typeof after === 'object' && !Array.isArray(before) && !Array.isArray(after)) {
        const keys = Object.keys(before);
        if (keys.length !== Object.keys(after).length || keys.some(k => !(k in after))) return null;
        for (const key of keys) if (!textEdits(before[key], after[key], [...path, key], out)) return null;
        return out;
    }
    return isDeepStrictEqual(before, after) ? out : null;
}

/**
 * Las experimentales: lo corregido va a una ronda nueva de su guion (`ronda-N-correcciones.md`,
 * J5.10) y el paquete se vuelve a hacer de las rondas, como `tools/guion-a-paquete.mjs`. Antes se
 * comprueba que el paquete de ahora es el que sale de ellas (si no, se pisaría algo hecho a mano).
 * Si el paquete nuevo no trae los cambios o queda peor, se quita la ronda y se deja como estaba.
 *
 * @param {Campaign} campaign
 * @param {Array<{changes: any[], plan: Plan}>} ready
 * @param {ImportResult} result
 * @param {string} backup
 */
function applyRound(campaign, ready, result, backup) {
    const abilityRows = readJson(join(campaign.root, 'public', 'compendio', 'habilidades.json')).rows ?? [];
    const convert = (/** @type {any[]} */ rounds) => convertGuion(rounds, { parseYaml: yaml.load, abilityRows });
    const rounds = readdirSync(campaign.rounds).filter(name => isRoundFile(name)).map(name => ({ name, text: readFileSync(join(campaign.rounds, name), 'utf8') }));
    const base = convert(rounds);
    const where = relative(campaign.root, campaign.rounds).replace(/\\/g, '/');
    if (base.stage !== 'hecho' || !isDeepStrictEqual(JSON.parse(JSON.stringify(base.pack)), campaign.pack)) {
        result.checks.push(`El paquete no es el que sale de las rondas de ${where} (alguien lo cambió a mano, o faltan rondas): no se toca nada.`);
        result.undone = true;
        return;
    }
    const all = ready.flatMap(entry => entry.changes);
    const changes = all.map(change => ({ path: change.block.src.path, before: String(valueAt(campaign.pack, change.block.src.path) ?? ''), after: change.after }));
    const round = correctionsRound({
        changes, pack: base.pack, byKind: base.byKind, files: base.files ?? rounds.map(r => r.name),
        title: base.pack?.world?.name ?? result.title, date: new Date().toISOString().slice(0, 10),
    });
    // Lo que la ronda no puede poner en un bloque no entra en el juego (se dice por qué).
    const lost = new Set(round.unplaced.map((/** @type {any} */ c) => showPath(c.path)));
    const kept = (/** @type {any} */ change) => !lost.has(showPath(change.block.src.path));
    for (const change of all.filter(c => !kept(c))) result.refused.push({ change, error: 'no sale de ningún bloque de las rondas del guion' });
    result.ready = ready.map(entry => ({ ...entry, changes: entry.changes.filter(kept) })).filter(entry => entry.changes.length > 0);
    if (round.placed === 0) {
        result.checks.push('Ninguna línea cambiada sale de un bloque de las rondas: no se ha escrito nada.');
        return;
    }
    if (backup) {
        backupFiles([campaign.packFile], backup, campaign.root);
        result.backup = backup;
    }
    const roundFile = join(campaign.rounds, round.name);
    const packBefore = readFileSync(campaign.packFile, 'utf8');
    const undo = (/** @type {string} */ why) => {
        rmSync(roundFile, { force: true });
        writeFileSync(campaign.packFile, packBefore);
        result.checks.push(why);
        result.written = [];
        result.undone = true;
    };
    // Solo lo que entra va en la ronda: se rehace sin lo perdido, para no dejar texto suelto.
    const placedOnly = lost.size === 0 ? round : correctionsRound({
        changes: changes.filter(c => !lost.has(showPath(c.path))), pack: base.pack, byKind: base.byKind, files: base.files ?? rounds.map(r => r.name),
        title: base.pack?.world?.name ?? result.title, date: new Date().toISOString().slice(0, 10),
    });
    writeFileSync(roundFile, placedOnly.text.replace('desde el taller de campañas del juego', 'con GuionEnWord (tools/guion-word.mjs)'));
    const again = convert([...rounds, { name: round.name, text: readFileSync(roundFile, 'utf8') }]);
    if (again.stage !== 'hecho' || !again.pack) return undo('Con la ronda nueva, el guion no se convierte: se ha quitado.');
    for (const change of result.ready.flatMap(entry => entry.changes)) {
        if (valueAt(again.pack, change.block.src.path) !== change.after) return undo(`El paquete nuevo no trae el cambio de ${change.id}: se ha quitado la ronda.`);
    }
    const before = packHealth(campaign.pack);
    const after = packHealth(again.pack);
    if (after.errors > before.errors || after.density > before.density) {
        const fresh = after.messages.filter(m => !before.messages.includes(m));
        return undo(`Con los cambios, el paquete tiene más errores que antes:\n  ${fresh.join('\n  ')}`);
    }
    // En el paquete se cambian solo los textos que cambian (como al corregir a mano): el resto del
    // archivo se queda igual. Si cambiara algo más que textos, se escribe entero.
    const fresh = JSON.parse(JSON.stringify(again.pack));
    const edits = textEdits(campaign.pack, fresh);
    let written = edits ? editJson(packBefore, edits) : '';
    if (!written || !isDeepStrictEqual(JSON.parse(written), fresh)) written = `${JSON.stringify(fresh, null, 2)}\n`;
    writeFileSync(campaign.packFile, written);
    result.written = [roundFile, campaign.packFile];
    result.round = roundFile;
    result.checks.push(placedOnly.said);
    result.checks.push(`El validador de paquetes: ${after.errors === 0 ? 'sin errores' : `${after.errors} errores, como antes`}.`);
    result.checks.push(`La densidad del mundo: ${after.density === 0 ? 'sin errores' : `${after.density} avisos del listón, como antes`}.`);
}

// ---------------------------------------------------------------------------------------------
// El informe, en castellano llano
// ---------------------------------------------------------------------------------------------

/**
 * @param {ImportResult} result
 * @param {{file: string, which: string, apply: boolean}} input
 * @returns {string}
 */
export function describeImport(result, { file, which, apply }) {
    const { review, ready, refused } = result;
    const out = [];
    const count = (/** @type {number} */ n, /** @type {string} */ one, /** @type {string} */ many) => `${n} ${n === 1 ? one : many}`;
    const changes = ready.flatMap(entry => entry.changes);
    out.push(`El guion de «${result.title || which}», leído de ${file}`);
    const byCategory = result.byCategory ?? [];
    if (byCategory.length > 0) {
        out.push('');
        out.push('Por categorías:');
        for (const row of byCategory) {
            const bits = [
                row.changed ? count(row.changed, 'cambiada', 'cambiadas') : '',
                row.refused ? count(row.refused, 'que no se guarda', 'que no se guardan') : '',
                row.skipped ? count(row.skipped, 'cambiada sin marcar (no se toca)', 'cambiadas sin marcar (no se tocan)') : '',
                row.newer ? count(row.newer, 'que cambió el juego', 'que cambió el juego') : '',
                row.conflicts ? count(row.conflicts, 'que cambiasteis los dos', 'que cambiasteis los dos') : '',
            ].filter(Boolean);
            out.push(`  ${row.name}: ${count(row.lines, 'línea', 'líneas')} en el Word${bits.length ? `; ${bits.join(', ')}` : ', sin cambios'}.`);
        }
    }
    out.push('');
    out.push(`${count(changes.length, 'línea cambiada', 'líneas cambiadas')}${changes.length > 0 ? ':' : '.'}`);
    for (const { changes: group, plan } of ready) {
        const shortFile = relative(result.root || ROOT, plan.file).replace(/\\/g, '/');
        const where = plan.edit.op === 'round' ? `${shortFile} (una ronda nueva con lo corregido, y el paquete se rehace de las rondas)`
            : `${shortFile}${plan.edit.op === 'replace' ? '' : ' (encima de lo que viene del original, marcado «propio:»)'}`;
        for (const change of group) {
            out.push(`  ${change.id} · ${change.block.label}`);
            out.push(`    antes: ${change.before}`);
            out.push(`    ahora: ${change.after}`);
            for (const warning of change.warnings) out.push(`    aviso: ${warning}`);
            out.push(`    va a: ${where}`);
        }
    }
    if (refused.length > 0) {
        out.push('');
        out.push(`${count(refused.length, 'línea cambiada que no se guarda', 'líneas cambiadas que no se guardan')}:`);
        for (const { change, error } of refused) {
            out.push(`  ${change.id} · ${change.block.label}`);
            out.push(`    ahora: ${change.after}`);
            out.push(`    por qué: ${error}`);
        }
    }
    const skipped = result.skipped ?? [];
    if (skipped.length > 0) {
        out.push('');
        out.push(`${count(skipped.length, 'línea cambiada', 'líneas cambiadas')} de categorías que no has marcado (no se tocan):`);
        for (const change of skipped) out.push(`  ${change.id} · ${change.block.label}: ${change.after}`);
    }
    if (review.newer.length > 0) {
        out.push('');
        out.push(`${count(review.newer.length, 'línea que el juego cambió', 'líneas que el juego cambió')} después de exportar (tú no las tocaste: se queda lo del juego):`);
        for (const entry of review.newer) out.push(`  ${entry.id}: ${entry.now}`);
    }
    if (review.conflicts.length > 0) {
        out.push('');
        out.push(`${count(review.conflicts.length, 'línea que cambiasteis', 'líneas que cambiasteis')} el juego y tú (no se toca; vuelve a exportar y corrígela otra vez):`);
        for (const entry of review.conflicts) {
            out.push(`  ${entry.id}`);
            out.push(`    en el juego: ${entry.now}`);
            out.push(`    en el Word:  ${entry.word}`);
        }
    }
    if (review.broken.length > 0) {
        out.push('');
        out.push(`${count(review.broken.length, 'línea', 'líneas')} sin los dos puntos (no sé dónde empieza el texto): ${review.broken.join(', ')}`);
    }
    if (review.unknown.length > 0) {
        out.push('');
        out.push(`${count(review.unknown.length, 'marca que no encuentro', 'marcas que no encuentro')} (el juego ya no tiene esa línea): ${review.unknown.join(', ')}`);
    }
    if (review.notes.length > 0) {
        out.push('');
        out.push(`${count(review.notes.length, 'línea nueva', 'líneas nuevas')} sin marca: no entran en el juego; son notas para el Gem guionista:`);
        for (const note of review.notes) out.push(`  ${note.after ? `(después de ${note.after}) ` : ''}${note.text}`);
    }
    if (review.missing.length > 0) {
        out.push('');
        out.push(`${count(review.missing.length, 'línea del juego no está', 'líneas del juego no están')} en el Word: se quedan como están.`);
    }
    out.push('');
    out.push(`${count(review.same, 'línea sigue igual', 'líneas siguen igual')}.`);
    out.push('');
    if (!apply) {
        const only = result.only ? ` --categorias ${result.only.join(',')}` : '';
        out.push(changes.length > 0
            ? `No se ha cambiado nada. Para guardarlo: node tools/guion-word.mjs import "${file}" ${which}${only} --aplicar`
            : 'No hay nada que guardar.');
    } else if (result.undone) {
        out.push('No se ha guardado nada:');
        for (const check of result.checks) out.push(`  ${check}`);
    } else if (result.written.length > 0) {
        out.push(`Guardado en ${result.written.map(path => relative(result.root || ROOT, path).replace(/\\/g, '/')).join(', ')}.`);
        for (const check of result.checks) out.push(`  ${check}`);
        if (result.backup) out.push(`  Lo de antes, copiado en ${result.backup}.`);
    } else {
        out.push('No había nada que guardar.');
        for (const check of result.checks) out.push(`  ${check}`);
    }
    return out.join('\n');
}

// ---------------------------------------------------------------------------------------------
// La línea de órdenes
// ---------------------------------------------------------------------------------------------

/**
 * Las notas para el Gem (lo escrito sin marca), al lado del Word y listas para pegar.
 *
 * @param {string} file El Word.
 * @param {ImportResult} result
 * @returns {string} El archivo de notas, o vacío si no hay.
 */
export function writeGemNotes(file, result) {
    if (result.review.notes.length === 0) return '';
    const notes = file.replace(/\.(docx|txt|md)$/i, '') + '-notas-para-el-gem.txt';
    writeFileSync(notes, result.review.notes.map((/** @type {any} */ n) => `${n.after ? `[después de ${n.after}] ` : ''}${n.text}`).join('\n') + '\n');
    return notes;
}

function main() {
    const args = process.argv.slice(2);
    const flag = (/** @type {string} */ name) => args.includes(name);
    const option = (/** @type {string} */ name) => {
        const at = args.indexOf(name);
        return at >= 0 ? args[at + 1] ?? '' : '';
    };
    const plain = args.filter((arg, i) => !arg.startsWith('--') && args[i - 1] !== '--salida' && args[i - 1] !== '--categorias');
    const [command, first, second] = plain;
    const usage = 'Uso:\n  node tools/guion-word.mjs export <campaña|paquete.json> [--categorias historia,charlas] [--salida guion.docx] [--md]\n'
        + '  node tools/guion-word.mjs import <guion.docx> <campaña|paquete.json> [--categorias historia,charlas] [--aplicar]\n'
        + '  node tools/guion-word.mjs categorias <campaña|paquete.json>\n'
        + `La campaña: gremio, 1387, strahd o cualquier paquete de public/mundos (ocaso, costa, pantalla…). Las categorías: ${CATEGORIES.map(c => c.id).join(', ')} (o todo).`;
    /** @type {string[]|null} */
    let categories = null;
    try {
        categories = parseCategories(option('--categorias'));
    } catch (error) {
        console.error(/** @type {Error} */ (error).message);
        return 2;
    }
    if (command === 'categorias' && first) {
        const script = scriptOf(loadCampaign(first));
        console.log(`Las categorías del guion de «${script.title}»:`);
        for (const c of categoriesIn(script)) console.log(`  ${c.id.padEnd(15)} ${String(c.lines).padStart(5)} líneas  ${c.name}: ${c.about}`);
        return 0;
    }
    if (command === 'export' && first) {
        const { file, md, script } = exportScript(first, { out: option('--salida'), md: flag('--md'), compendio: !flag('--sin-compendio'), categories });
        const c = script.counts;
        console.log(`El guion de «${script.title}»${categories ? ` (solo ${categories.join(', ')})` : ''}: ${c.lines} líneas (${c.said} dichas por alguien, ${c.choices} tuyas, ${c.narrator} sin nadie que las diga).`);
        console.log(`Word: ${file}`);
        if (md) console.log(`Texto: ${md}`);
        return 0;
    }
    if (command === 'import' && first && second) {
        const apply = flag('--aplicar');
        // Sin ruta, se busca donde los deja exportar.
        const file = existsSync(resolve(first)) ? resolve(first)
            : [defaultFolder(), OLD_FOLDER].map(folder => join(folder, first)).find(path => existsSync(path)) ?? resolve(first);
        if (!existsSync(file)) {
            console.error(`No encuentro ${file}.`);
            return 2;
        }
        // Al guardar, antes se copia lo que se va a tocar (en Documentos\Guiones\copias).
        const backup = apply ? backupFolder(join(defaultFolder(), 'copias'), basename(second).replace(/\.json$/i, '')) : '';
        const result = importScript(file, second, { apply, compendio: !flag('--sin-compendio'), categories, backup });
        console.log(describeImport(result, { file, which: second, apply }));
        const notes = writeGemNotes(file, result);
        if (notes) console.log(`\nLas notas para el Gem, en ${notes}`);
        return result.undone ? 1 : 0;
    }
    console.error(usage);
    return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exitCode = main();
}
