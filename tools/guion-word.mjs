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

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve, basename, extname, relative } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const engine = (/** @type {string} */ path) => import(pathToFileURL(join(ROOT, 'public/scripts/game-engine', path)).href);

const { buildScript, reviewScript, blockParts, COMPENDIO_DOCS } = await engine('campaign/script-doc.js');
const { scriptToDocx, docxBlocks } = await engine('campaign/script-docx.js');
const { validatePack } = await engine('campaign/campaign-pack.js');
const { checkWorldDensity } = await engine('campaign/world-density.js');
const { cleanGemText } = await engine('campaign/campaign-import.js');

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
 */

/**
 * La campaña, leída: su paquete y las filas del compendio.
 *
 * @param {string} which `gremio`, `1387`, `strahd` o la ruta de un paquete o JSON del Gem.
 * @param {{root?: string, compendio?: boolean}} [input]
 * @returns {Campaign}
 */
export function loadCampaign(which, { root = ROOT, compendio = true } = {}) {
    const known = CAMPAIGNS.includes(String(which));
    const packFile = known ? join(root, 'public', 'mundos', `${which}.pack.json`) : resolve(String(which));
    if (!existsSync(packFile)) throw new Error(`No encuentro ${packFile}.`);
    const id = known ? String(which) : (/^(gremio|1387|strahd)\.pack\.json$/.exec(basename(packFile))?.[1] ?? '');
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
    return { id, packFile, pack: readJson(packFile), compendio: docs, compendioFiles: files, root };
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
// Exportar
// ---------------------------------------------------------------------------------------------

/** Dónde se guardan los guiones si no se dice: Documentos\Guiones, o guiones/ en el repositorio. */
function defaultFolder() {
    const documents = join(homedir(), 'Documents');
    return existsSync(documents) ? join(documents, 'Guiones') : join(ROOT, 'guiones');
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
 * @param {string} which
 * @param {{out?: string, md?: boolean, root?: string, compendio?: boolean}} [input]
 * @returns {{file: string, md: string, script: any}}
 */
export function exportScript(which, { out = '', md = false, root = ROOT, compendio = true } = {}) {
    const campaign = loadCampaign(which, { root, compendio });
    const script = scriptOf(campaign);
    const name = campaign.id || basename(campaign.packFile, extname(campaign.packFile)).replace(/\.pack$/, '');
    const file = resolve(out || join(defaultFolder(), `${name}-guion.docx`));
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
 */

/**
 * Comparar un guion corregido con el juego y, si se pide, guardar lo cambiado.
 *
 * @param {string} file El .docx (o .txt, .md).
 * @param {string} which La campaña.
 * @param {{apply?: boolean, root?: string, compendio?: boolean, regenerate?: (root: string) => {ok: boolean, output: string}}} [input]
 * @returns {ImportResult}
 */
export function importScript(file, which, { apply = false, root = ROOT, compendio = true, regenerate = regenerateStrahd } = {}) {
    const campaign = loadCampaign(which, { root, compendio });
    const script = scriptOf(campaign);
    const review = reviewScript(script, readParagraphs(file));
    const layers = campaign.id === 'strahd' ? strahdLayers(root) : null;
    /** @type {Array<{change: any, plan: Plan}>} */
    const planned = [];
    /** @type {Array<{change: any, error: string}>} */
    const refused = [];
    for (const change of review.changed) {
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
    const result = { title: script.title, root, review, ready, refused, written: [], checks: [], undone: false };
    if (!apply || ready.length === 0) return result;
    applyPlans(campaign, ready, result, regenerate);
    return result;
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
 */
function applyPlans(campaign, ready, result, regenerate) {
    const before = packHealth(campaign.pack);
    /** @type {Map<string, JsonEdit[]>} */
    const byFile = new Map();
    for (const { plan } of ready) byFile.set(plan.file, [...(byFile.get(plan.file) ?? []), plan.edit]);
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
    out.push('');
    out.push(`${count(changes.length, 'línea cambiada', 'líneas cambiadas')}${changes.length > 0 ? ':' : '.'}`);
    for (const { changes: group, plan } of ready) {
        const where = `${relative(result.root || ROOT, plan.file).replace(/\\/g, '/')}${plan.edit.op === 'replace' ? '' : ' (encima de lo que viene del original, marcado «propio:»)'}`;
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
        out.push(changes.length > 0
            ? `No se ha cambiado nada. Para guardarlo: node tools/guion-word.mjs import "${file}" ${which} --aplicar`
            : 'No hay nada que guardar.');
    } else if (result.undone) {
        out.push('No se ha guardado nada:');
        for (const check of result.checks) out.push(`  ${check}`);
    } else if (result.written.length > 0) {
        out.push(`Guardado en ${result.written.map(path => relative(result.root || ROOT, path).replace(/\\/g, '/')).join(', ')}.`);
        for (const check of result.checks) out.push(`  ${check}`);
    } else {
        out.push('No había nada que guardar.');
    }
    return out.join('\n');
}

// ---------------------------------------------------------------------------------------------
// La línea de órdenes
// ---------------------------------------------------------------------------------------------

function main() {
    const args = process.argv.slice(2);
    const flag = (/** @type {string} */ name) => args.includes(name);
    const option = (/** @type {string} */ name) => {
        const at = args.indexOf(name);
        return at >= 0 ? args[at + 1] ?? '' : '';
    };
    const plain = args.filter((arg, i) => !arg.startsWith('--') && args[i - 1] !== '--salida');
    const [command, first, second] = plain;
    const usage = 'Uso:\n  node tools/guion-word.mjs export <gremio|1387|strahd|paquete.json> [--salida guion.docx] [--md]\n'
        + '  node tools/guion-word.mjs import <guion.docx> <gremio|1387|strahd|paquete.json> [--aplicar]';
    if (command === 'export' && first) {
        const { file, md, script } = exportScript(first, { out: option('--salida'), md: flag('--md'), compendio: !flag('--sin-compendio') });
        const c = script.counts;
        console.log(`El guion de «${script.title}»: ${c.lines} líneas (${c.said} dichas por alguien, ${c.choices} tuyas, ${c.narrator} sin nadie que las diga).`);
        console.log(`Word: ${file}`);
        if (md) console.log(`Texto: ${md}`);
        return 0;
    }
    if (command === 'import' && first && second) {
        const apply = flag('--aplicar');
        // Sin ruta, se busca donde los deja exportar.
        const file = existsSync(resolve(first)) || !existsSync(join(defaultFolder(), first)) ? resolve(first) : join(defaultFolder(), first);
        if (!existsSync(file)) {
            console.error(`No encuentro ${file}.`);
            return 2;
        }
        const result = importScript(file, second, { apply, compendio: !flag('--sin-compendio') });
        console.log(describeImport(result, { file, which: second, apply }));
        // Las notas para el Gem, al lado del Word, listas para pegar.
        if (result.review.notes.length > 0) {
            const notes = file.replace(/\.(docx|txt|md)$/i, '') + '-notas-para-el-gem.txt';
            writeFileSync(notes, result.review.notes.map((/** @type {any} */ n) => `${n.after ? `[después de ${n.after}] ` : ''}${n.text}`).join('\n') + '\n');
            console.log(`\nLas notas para el Gem, en ${notes}`);
        }
        return result.undone ? 1 : 0;
    }
    console.error(usage);
    return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exitCode = main();
}
