/**
 * El taller de campañas del gremio, lo que no dibuja (J5.9 de ROADMAP_SIN_CONEXION).
 *
 * Lo que se hizo con 1387 a mano, con el chat y la consola —el Gem guionista escribe las rondas,
 * `tools/guion-a-paquete.mjs` las convierte, `tools/check-world-density.mjs` dice lo que falta,
 * `tools/sim-campana.mjs` juega las peleas—, ahora desde el gremio y sin IA. Aquí está la parte
 * que se puede probar sin navegador:
 *
 * - **Qué ha subido**: las rondas del guion (`ronda-N….md`), un paquete JSON, un Word, y lo
 *   que sobra (`workshopUpload`).
 * - **Para qué nivel es cada tablero**, con la misma cuenta que el ajuste de nivel del combate
 *   (`workshopBands`), para la simulación rápida (`combat/quick-sim.js`).
 * - **La lista para tu Gem** (`workshopGemText`): lo que no se ha podido leer, con su ronda y
 *   su línea; lo que impide jugarla o se quedaría a medias; y lo que le falta para durar como
 *   las del juego (`gemRequest`). Pide una ronda nueva, no la campaña entera.
 * - **Otro nombre** para añadirla al tablón sin pisar la que ya hay (`renamedPack`).
 * - **Un tablero sobre un mapa en imagen**, con lo que devuelve el editor (`withMapPatch`).
 *
 * Puro: recibe y devuelve datos.
 */

import { levelsOfPack } from './campaign-import.js';
import { levelPlanOf, boardBand } from '../combat/level-adjust.js';
import { levelMetaOfPack } from '../combat/quick-sim.js';
import { gemRequest } from './world-density.js';
import { isRoundFile } from './guion-pack.js';
import { rowsFromBoard } from '../board/map-edit.js';
import { buildScript, reviewScript } from './script-doc.js';
import { scriptToDocx, docxBlocks } from './script-docx.js';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** Lo más grande que se lee de una vez: las doce rondas de 1387 pesan 400 KB. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/**
 * @typedef {Object} UploadSorted
 * @property {Array<{name: string, text: string}>} rounds Las rondas del guion.
 * @property {{name: string, text: string}|null} json Un paquete JSON (el primero).
 * @property {string[]} words Los Word (`.docx`).
 * @property {string[]} skipped Lo que no es nada de eso, o un Markdown que no es una ronda.
 * @property {'guion'|'json'|'word'|''} kind Qué se va a hacer con ello.
 * @property {string} said Lo que se dice al subirlo.
 */

/**
 * Qué ha subido quien usa el taller.
 *
 * Las rondas se reconocen por su nombre, como en la herramienta (`ronda-1.md`,
 * `ronda-8-claude.md`). Si no hay ninguna con ese nombre pero sí Markdown, se toman todos los
 * Markdown, en el orden de su nombre: quien sube «capitulo-1.md» y «capitulo-2.md» no tiene por
 * qué saber cómo los llama el conversor.
 *
 * @param {Array<{name: string, text?: string}>} files Lo subido, ya leído (el zip, abierto).
 * @returns {UploadSorted}
 */
export function workshopUpload(files) {
    const list = (Array.isArray(files) ? files : []).filter(f => f && text(f.name));
    const base = (/** @type {string} */ name) => text(name).split(/[\\/]/).pop() ?? '';
    const markdown = list.filter(f => /\.(md|markdown|txt)$/i.test(f.name));
    const named = markdown.filter(f => isRoundFile(base(f.name)));
    const rounds = (named.length > 0 ? named : markdown).map(f => ({ name: base(f.name), text: String(f.text ?? '') }));
    const jsonFile = list.find(f => /\.json$/i.test(f.name)) ?? null;
    const words = list.filter(f => /\.docx$/i.test(f.name)).map(f => base(f.name));
    const used = new Set([...(named.length > 0 ? named : markdown), ...(jsonFile ? [jsonFile] : [])]);
    const skipped = list.filter(f => !used.has(f) && !/\.docx$/i.test(f.name)).map(f => base(f.name));
    /** @type {UploadSorted['kind']} */
    const kind = rounds.length > 0 ? 'guion' : jsonFile ? 'json' : words.length > 0 ? 'word' : '';
    const said = kind === 'guion'
        ? `${rounds.length} ${rounds.length === 1 ? 'ronda' : 'rondas'} del guion${skipped.length > 0 ? `; no se leen: ${skipped.join(', ')}` : ''}.`
        : kind === 'json' ? `El paquete «${base(jsonFile?.name ?? '')}».`
            : kind === 'word' ? `El guion en Word: ${words.join(', ')}.`
                : list.length > 0 ? `Nada de esto es un guion: ${list.map(f => base(f.name)).join(', ')}. Sube las rondas en Markdown (.md), un .zip con ellas o el paquete .json.`
                    : 'No has elegido nada.';
    return { rounds, json: jsonFile ? { name: base(jsonFile.name), text: String(jsonFile.text ?? '') } : null, words, skipped, kind, said };
}

/**
 * Para qué nivel es cada tablero del paquete: lo que diga la campaña (`world.levels`) o lo que
 * sale de sus bichos, repartido entre sus actos como en el ajuste de nivel del combate.
 *
 * @param {any} pack
 * @returns {{levels: [number, number]|null, bandOf: (board: any) => {low: number, high: number}|null}}
 */
export function workshopBands(pack) {
    const levels = levelsOfPack(pack);
    const plan = levels ? levelPlanOf(levelMetaOfPack(pack), levels) : null;
    return {
        levels,
        bandOf: (board) => {
            if (!plan) return { low: 1, high: 1 };
            const band = boardBand(plan, text(board?.name));
            return { low: band.low, high: band.high };
        },
    };
}

/**
 * Lo que se cuenta de la simulación, en una línea: cuántas peleas de cada clase.
 *
 * @param {Array<{verdict: string}>} sims
 * @returns {string}
 */
export function simSummary(sims) {
    const list = Array.isArray(sims) ? sims : [];
    if (list.length === 0) return 'No hay ninguna pelea que simular: ningún tablero trae enemigos.';
    const count = (/** @type {string} */ key) => list.filter(s => s.verdict === key).length;
    const parts = [
        [count('muy-facil'), 'demasiado fácil', 'demasiado fáciles'],
        [count('justa'), 'justa', 'justas'],
        [count('dificil'), 'difícil', 'difíciles'],
        [count('muy-dificil'), 'demasiado difícil', 'demasiado difíciles'],
    ].filter(([n]) => Number(n) > 0).map(([n, one, many]) => `${n} ${Number(n) === 1 ? one : many}`);
    return `${list.length} ${list.length === 1 ? 'pelea' : 'peleas'}: ${parts.join(', ')}.`;
}

/**
 * La lista para tu Gem guionista: lo que hay que arreglar y lo que falta, lista para pegar.
 *
 * Con un guion pide **una ronda nueva** con los mismos ids (así se corrige en el guion, como
 * con 1387); con un paquete JSON, la campaña entera corregida.
 *
 * @param {Object} input
 * @param {'guion'|'json'} input.source
 * @param {string} input.name
 * @param {Array<{file: string, line: number, why: string, said: string, fix: string}>} [input.problems] Los bloques sin leer.
 * @param {Array<{level: string, where: string, message: string}>} [input.issues] Lo que dice el validador, con su ronda.
 * @param {string[]} [input.notes] Los avisos del conversor.
 * @param {any} [input.check] El informe de `checkCampaign`.
 * @param {any} [input.density] El de `checkWorldDensity`.
 * @param {string[]} [input.wordNotes] J5.8: las líneas nuevas del Word, sin sitio en la campaña.
 * @returns {string} Vacío si no hay nada que pedir.
 */
export function workshopGemText({ source, name, problems = [], issues = [], notes = [], check = null, density = null, wordNotes = [] }) {
    const title = text(name) || 'sin nombre';
    /** @type {string[]} */
    const blocks = [];
    if (problems.length > 0) {
        blocks.push('Estos bloques no se pueden leer (arréglalos primero; lo demás no se comprueba hasta entonces):',
            ...problems.map(p => `- ${p.file}, línea ${p.line}: ${p.why}${p.said ? ` («${p.said}»)` : ''} ${p.fix}`), '');
    }
    const errors = issues.filter(i => i.level === 'ERROR');
    if (errors.length > 0) {
        blocks.push('Lo que impide jugarla:', ...errors.map(i => `- ${i.message}${i.where ? ` (en ${i.where})` : ''}`), '');
    }
    const holes = (Array.isArray(check?.groups) ? check.groups : []).filter((/** @type {any} */ g) => g.key === 'huecos' || (g.key === 'rota' && errors.length === 0));
    for (const group of holes) {
        blocks.push(`${group.title}:`, ...group.items.map((/** @type {any} */ item) => `- ${item.text}${item.where && source === 'json' ? ` (en ${item.where})` : ''}`), '');
    }
    if (notes.length > 0) blocks.push('El conversor avisa de esto:', ...notes.map(n => `- ${n}.`), '');
    if (wordNotes.length > 0) blocks.push('Líneas nuevas que escribí en el Word del guion (ponlas donde toque, con quién las dice):', ...wordNotes.map(n => `- ${n}`), '');
    const more = density ? gemRequest(density) : '';
    // La petición del listón trae su propio saludo; aquí solo sus listas.
    const moreLines = more ? more.split('\n').filter(line => !/^Hola\.|^Usa ids nuevos|^Que todo encaje/.test(line)) : [];
    if (blocks.length === 0 && moreLines.filter(Boolean).length === 0) return '';
    const head = source === 'guion'
        ? [
            `Hola. Al pasar el guion de «${title}» por el taller del juego sale esto. Escribe una ronda nueva del guion (la siguiente a la última), con bloques YAML como las anteriores.`,
            'Para corregir un bloque que ya existe, repite su id y pon solo lo que cambia; para lo nuevo, ids nuevos.',
        ]
        : [`Hola. Al comprobar la campaña «${title}» en el juego sale esto. Arréglalo y devuélveme la campaña entera, en un solo bloque JSON y en el mismo formato.`];
    return [
        ...head,
        '',
        ...blocks,
        ...moreLines,
        'Que todo encaje con lo que ya está escrito: los mismos sitios, la misma gente y el mismo tono.',
    ].join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * El paquete con otro nombre, para añadirlo al tablón al lado del que ya hay. El id en el
 * tablón sale del nombre (`importedCampaignId`), así que otro nombre es otra campaña.
 *
 * @param {any} pack
 * @param {string} name
 * @returns {any} Una copia; el original no se toca.
 */
export function renamedPack(pack, name) {
    const copy = JSON.parse(JSON.stringify(pack ?? {}));
    const wanted = text(name);
    if (!wanted) return copy;
    const before = text(copy?.world?.name);
    copy.world = { ...(copy.world ?? {}), name: wanted };
    if (copy.plot && (!text(copy.plot.title) || text(copy.plot.title) === before)) copy.plot.title = wanted;
    return copy;
}

/**
 * Un tablero del paquete puesto encima de un mapa en imagen, con lo que devuelve el editor
 * (`openMapImageEditor`): el dibujo, su cuadrícula, las casillas leídas, las salas y las
 * alturas. Dónde empieza el grupo y dónde está cada enemigo se borran: eran casillas del mapa
 * de antes, y el juego los pone en el nuevo al añadirla (`pack-fill.js`, J12.5). La casilla a la
 * que hay que llegar en una misión de ese tablero (`reach_cell`), si cae fuera del dibujo o en una
 * pared, pasa a la casilla de suelo más lejos de la esquina de arriba, y se dice.
 *
 * @param {any} pack
 * @param {string} boardId
 * @param {{url: string, grid: any, gridWidth: number, gridHeight: number, terrain: any, zones?: any[], elevation?: Record<string, number>}} patch
 * @returns {{pack: any, moved: string[]}} Una copia (el original no se toca) y lo que se ha movido.
 */
export function withMapPatch(pack, boardId, patch) {
    const copy = JSON.parse(JSON.stringify(pack ?? {}));
    /** @type {string[]} */
    const moved = [];
    const board = (Array.isArray(copy.boards) ? copy.boards : []).find((/** @type {any} */ b) => text(b?.id) === text(boardId));
    if (!board || !patch) return { pack: copy, moved };
    const cols = Math.max(1, Math.floor(Number(patch.gridWidth) || 0));
    const rows = Math.max(1, Math.floor(Number(patch.gridHeight) || 0));
    board.image = text(patch.url).replace(/^\/+/, '');
    board.grid = { ...patch.grid, cols, rows };
    board.map = rowsFromBoard(patch, cols, rows);
    if (Array.isArray(patch.zones) && patch.zones.length > 0) board.zones = patch.zones;
    else delete board.zones;
    if (patch.elevation && Object.keys(patch.elevation).length > 0) board.elevation = patch.elevation;
    else delete board.elevation;
    board.partyStart = [];
    board.enemies = (Array.isArray(board.enemies) ? board.enemies : []).map((/** @type {any} */ e) => ({ name: text(e?.name) }));
    for (const key of ['chests', 'hazards', 'doors', 'interactables']) delete board[key];
    // La casilla de llegar: dentro del dibujo y en el suelo; si no, la de suelo más lejana.
    const floor = (/** @type {number} */ x, /** @type {number} */ y) => y >= 0 && y < board.map.length && x >= 0 && x < String(board.map[y]).length && String(board.map[y])[x] === '.';
    /** @type {{x: number, y: number}|null} */
    let far = null;
    for (let y = 0; y < board.map.length; y++) {
        for (let x = 0; x < String(board.map[y]).length; x++) if (floor(x, y) && (!far || x + y > far.x + far.y)) far = { x, y };
    }
    for (const quest of Array.isArray(copy.quests) ? copy.quests : []) {
        if (text(quest?.boardId) !== text(boardId)) continue;
        for (const objective of Array.isArray(quest.objectives) ? quest.objectives : []) {
            if (!objective?.cell || floor(Number(objective.cell.x), Number(objective.cell.y)) || !far) continue;
            moved.push(`La casilla a la que hay que llegar en «${text(quest.name) || text(quest.id)}» (${objective.cell.x},${objective.cell.y}) no cae en el suelo del dibujo: va ahora en (${far.x},${far.y}).`);
            objective.cell = { ...far };
        }
    }
    return { pack: copy, moved };
}

/**
 * J5.7 en el taller: el guion de la campaña que se prepara, como los archivos de un .docx
 * (`script-docx.js`), listos para meterlos en el zip. Lo mismo que `tools/guion-word.mjs export`,
 * sin las filas del compendio (una campaña nueva no tiene).
 *
 * @param {any} pack
 * @param {string} [when] La fecha y hora de la portada, como `2026-10-02T12:00:00Z`.
 * @returns {{title: string, files: Record<string, string>, lines: number}}
 */
export function workshopWord(pack, when = '2026-01-01T00:00:00Z') {
    const script = buildScript(pack, { date: String(when).slice(0, 10) });
    return { title: script.title, files: scriptToDocx(script, { when }), lines: script.counts.lines };
}

/**
 * @typedef {Object} WordImport
 * @property {any} pack El paquete con lo cambiado (una copia).
 * @property {string[]} applied Lo que se ha cambiado, dicho: «Tomás: "…" → "…"».
 * @property {Array<{path: Array<string|number>, before: string, after: string}>} changes J5.10: lo
 *   mismo, con su sitio en el paquete, para sacarlo como una ronda del guion (`guion-round.js`).
 * @property {string[]} refused Lo que no, con por qué.
 * @property {string[]} notes Las líneas nuevas sin marca: para el Gem guionista.
 * @property {number} same Las que siguen igual.
 * @property {string} said El resumen, en una frase.
 */

/**
 * J5.8 en el taller: el Word corregido, sobre la campaña que se prepara. Cambia solo los textos
 * tocados; no toca lo que rompe una marca de género o un hueco (`checkEdit`), lo que cambió el
 * juego después de exportarlo, ni dos líneas del mismo texto cambiadas distinto. Las líneas
 * nuevas, sin marca, no se pueden poner en ningún sitio: quedan como notas para el Gem.
 *
 * @param {any} pack La campaña del taller.
 * @param {string} documentXml El `word/document.xml` del .docx.
 * @returns {WordImport}
 */
export function importWordInto(pack, documentXml) {
    const copy = JSON.parse(JSON.stringify(pack ?? {}));
    const review = reviewScript(buildScript(copy), docxBlocks(documentXml));
    /** @type {string[]} */
    const applied = [];
    /** @type {string[]} */
    const refused = [];
    /** @type {WordImport['changes']} */
    const changes = [];
    /** @type {Map<string, Set<string>>} */
    const wanted = new Map();
    const key = (/** @type {any} */ change) => JSON.stringify(change.block?.src?.path ?? []);
    for (const change of review.changed) wanted.set(key(change), (wanted.get(key(change)) ?? new Set()).add(change.after));
    for (const change of review.changed) {
        const path = /** @type {Array<string|number>} */ (change.block?.src?.path ?? []);
        const who = text(change.block?.label);
        if (change.errors.length > 0) {
            refused.push(`${who ? `${who}: ` : ''}«${change.after}» — ${change.errors.join('; ')}`);
            continue;
        }
        if (change.block?.src?.doc && change.block.src.doc !== 'pack') {
            refused.push(`${who ? `${who}: ` : ''}«${change.after}» — es del compendio del juego, no de esta campaña.`);
            continue;
        }
        if ((wanted.get(key(change))?.size ?? 0) > 1) {
            refused.push(`${who ? `${who}: ` : ''}«${change.after}» — otra línea que sale del mismo texto se cambió distinto.`);
            continue;
        }
        let at = copy;
        for (const step of path.slice(0, -1)) at = at?.[step];
        const last = path[path.length - 1];
        if (!at || typeof at !== 'object' || last === undefined || typeof at[last] !== 'string') {
            refused.push(`${who ? `${who}: ` : ''}«${change.after}» — no encuentro esa línea en la campaña.`);
            continue;
        }
        at[last] = change.after;
        changes.push({ path: [...path], before: String(change.before ?? ''), after: String(change.after ?? '') });
        applied.push(`${who ? `${who}: ` : ''}«${change.before}» → «${change.after}»`);
    }
    for (const line of review.newer) refused.push(`«${line.word}» — el juego la cambió después de exportar el guion: se queda «${line.now}».`);
    for (const line of review.conflicts) refused.push(`«${line.word}» — la cambiasteis los dos: se queda «${line.now}».`);
    if (review.broken.length > 0) refused.push(`${review.broken.length} ${review.broken.length === 1 ? 'línea ha perdido' : 'líneas han perdido'} los dos puntos de detrás del nombre: no se sabe qué es el texto.`);
    if (review.unknown.length > 0) refused.push(`${review.unknown.length} ${review.unknown.length === 1 ? 'línea del Word ya no está' : 'líneas del Word ya no están'} en la campaña.`);
    const notes = review.notes.map(n => n.text);
    const said = [
        `${applied.length} ${applied.length === 1 ? 'línea cambiada' : 'líneas cambiadas'}`,
        refused.length > 0 ? `${refused.length} sin cambiar` : '',
        notes.length > 0 ? `${notes.length} ${notes.length === 1 ? 'línea nueva' : 'líneas nuevas'} para tu Gem` : '',
        `${review.same} igual`,
    ].filter(Boolean).join(', ');
    return { pack: copy, applied, changes, refused, notes, same: review.same, said: `${said}.` };
}
