#!/usr/bin/env node
/**
 * Convierte una campaña escrita (el JSON que trae Daniel) en el paquete que el juego importa.
 *
 *   node tools/campana-a-paquete.mjs strahd          escribe public/mundos/strahd.pack.json
 *   node tools/campana-a-paquete.mjs strahd --check  falla si el escrito no es lo que saldría
 *
 * Lee tres archivos de wiki/campanas/<id>/, cada uno encima del anterior:
 *
 * - `original.json`: la campaña tal cual llegó. No se toca a mano: si llega otra versión, se
 *   pisa y ya.
 * - `libro.json` (si lo hay): lo que sale del libro y el original no traía, contado con
 *   palabras propias: la gente de cada sitio, los rumores, los encargos, las facciones con su
 *   meta, las escenas de los confidentes, los sitios que se descubren y más combates.
 * - `mejoras.json`: lo que se pone encima para que se juegue. Rutas y servicios de cada
 *   localización, tableros arreglados o nuevos, enemigos para niveles bajos, misiones nuevas
 *   y la trama (los hitos), que se escribe con referencias a las misiones: el título, la
 *   escena y lo que pide salen de la misión, así el texto sigue siendo el del original.
 *
 * Lo que junta:
 * - quita las marcas `[cite: N]` que deja el que resume el libro;
 * - las localizaciones, el bestiario y los objetos, por nombre; los tableros y las misiones,
 *   por id. Lo de mejoras gana campo a campo;
 * - las rutas, en los dos sentidos: escribir una basta;
 * - lo marcado «propio: » en mejoras es texto escrito aquí, no del original: se quita la
 *   marca y se deja el texto;
 * - un tablero con `mapFrom` toma su `map` y su `grid` del JSON que escribe
 *   `tools/mapa-a-tablero.mjs` a partir de un mapa dibujado (J12.12), y su `image`, sus
 *   `zones` y su `elevation` si no trae los suyos. Todo eso pasa al paquete tal cual.
 *
 * Y lo valida con el mismo `validatePack` que usa el juego al importar.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const id = args.find(a => !a.startsWith('--'));
const check = args.includes('--check');

if (!id) {
    console.error('Uso: node tools/campana-a-paquete.mjs <id> [--check]');
    process.exit(2);
}

const folder = join(ROOT, 'wiki', 'campanas', id);
const original = JSON.parse(readFileSync(join(folder, 'original.json'), 'utf8'));
/** @param {string} name */
const optional = (name) => (existsSync(join(folder, name)) ? JSON.parse(readFileSync(join(folder, name), 'utf8')) : {});
const book = optional('libro.json');
const extra = optional('mejoras.json');

const { validatePack } = await import(pathToFileURL(join(ROOT, 'public/scripts/game-engine/campaign/campaign-pack.js')).href);

// Quitar las marcas del resumidor y la de «texto propio», juntar dos listas por su clave y
// poner cada ruta también de vuelta: lo mismo que hace el gremio al añadir una campaña
// desde un archivo (J5.4), así que vive allí y se usa desde aquí.
const { cleanGemText: clean, mergeBy, bothWays } = await import(pathToFileURL(join(ROOT, 'public/scripts/game-engine/campaign/campaign-import.js')).href);

/**
 * J12.12: un tablero hecho de un mapa dibujado. `mapFrom` apunta (desde la raíz del repo) al
 * JSON que escribe `node tools/mapa-a-tablero.mjs mapa.png --salida …`: de él salen `map` y
 * `grid`, y `image`, `zones` y `elevation` si el tablero no trae los suyos. Lo demás del
 * tablero (id, nombre, enemigos, inicio) se escribe en mejoras.json como siempre.
 *
 * @param {any} board
 */
function fromDrawnMap(board) {
    if (!board?.mapFrom) return board;
    const fragment = JSON.parse(readFileSync(join(ROOT, board.mapFrom), 'utf8'));
    const rest = { ...board };
    delete rest.mapFrom;
    return {
        ...rest,
        map: fragment.map,
        grid: fragment.grid,
        image: rest.image || fragment.image,
        // Las salas y las cotas marcadas con --zona y --altura, si el tablero no trae las suyas.
        ...(rest.zones || !fragment.zones ? {} : { zones: fragment.zones }),
        ...(rest.elevation || !fragment.elevation ? {} : { elevation: fragment.elevation }),
    };
}

/** Los hitos, sacados de sus misiones. */
function buildPlot(plot, quests, boards) {
    if (!plot) return undefined;
    const questById = new Map(quests.map(q => [q.id, q]));
    const boardById = new Map(boards.map(b => [b.id, b]));
    const milestones = plot.milestones.map(m => {
        const quest = questById.get(m.quest);
        if (m.quest && !quest) throw new Error(`El hito ${m.id} apunta a la misión ${m.quest}, que no existe.`);
        const board = quest ? boardById.get(quest.boardId) : null;
        // «Proteger» es una condición, no algo que hacer: y si no está en el tablero, confunde.
        const goals = (quest?.objectives ?? []).filter(o => !o.optional && o.type !== 'protect').map(o => o.label).filter(Boolean);
        const where = board ? `Está en ${board.name}${board.locationName ? ` (${board.locationName})` : ''}.` : '';
        return {
            id: m.id,
            act: m.act ?? quest?.act ?? 1,
            title: m.title ?? quest?.name ?? m.id,
            hint: m.hint ?? [goals.length > 0 ? `${goals.join('. ')}.` : '', where].filter(Boolean).join(' '),
            scene: m.scene ?? quest?.description ?? '',
            // J9.2: la escena jugada, y lo demás que el hilo sabe leer y el contrato publica
            // (J5.2). Solo si lo trae: un hito sin nada de esto sale igual que siempre.
            // J11.1: `irreversible`, si el hito pesa aunque no cierre nada ni acabe la campaña.
            ...Object.fromEntries(['backdrop', 'beats', 'sceneDialogue', 'prologue', 'hidden', 'within', 'late', 'backgrounds', 'irreversible']
                .filter(key => m[key] !== undefined).map(key => [key, m[key]])),
            opens: m.opens ?? { kind: 'after', milestone: m.after },
            asks: m.asks ?? (board ? { kind: 'win', board: board.name } : { kind: 'none' }),
            changes: {
                reveal: m.reveal ?? [],
                open: m.open ?? [],
                standing: m.standing ?? {},
                ending: m.ending ?? '',
                endingBy: m.endingBy ?? {},
                ...(m.close ? { close: m.close } : {}),
            },
        };
    });
    // J9.3: los capítulos, si los trae, pasan tal cual: el Diario los sigue y el tablón dice por cuál vais.
    return { title: plot.title, milestones, endings: plot.endings ?? {}, omens: plot.omens ?? [], ...(plot.chapters ? { chapters: plot.chapters } : {}) };
}

const base = clean(original);
const mid = clean(book);
const over = clean(extra);
delete base.$schema;
delete base.title;
delete base.description;

/**
 * Las tres capas de una lista, por su clave: el original, lo del libro y las mejoras.
 *
 * @param {string} section
 * @param {string} key
 */
const layered = (section, key) => mergeBy(mergeBy(base[section], mid[section], key), over[section], key);

const pack = { ...base };
pack.version = 1;
const { factions: bookFactions, ...bookWorld } = mid.world ?? {};
pack.world = { ...base.world, ...bookWorld, ...(over.world ?? {}) };
if (bookFactions) pack.world.factions = mergeBy(base.world?.factions, bookFactions, 'name');
pack.locations = bothWays(layered('locations', 'name'));
pack.confidants = layered('confidants', 'name');
pack.bestiary = layered('bestiary', 'name');
pack.items = layered('items', 'name');
pack.boards = layered('boards', 'id').map(fromDrawnMap);
pack.quests = layered('quests', 'id');
// J8.1: las charlas con ramas van por id, como los encargos y los rumores.
// J10.3 y D-J42: los sucesos propios de la campaña, también por id.
for (const [section, key] of [['npcs', 'id'], ['contracts', 'id'], ['rumors', 'id'], ['dialogues', 'id'], ['sucesos', 'id']]) {
    const rows = layered(section, key);
    if (rows.length > 0) pack[section] = rows;
}
if (over.abilitiesFrom) {
    const source = JSON.parse(readFileSync(join(ROOT, over.abilitiesFrom.pack), 'utf8'));
    const wanted = new Set(over.abilitiesFrom.ids);
    pack.abilities = mergeBy((source.abilities ?? []).filter(a => wanted.has(a.id)), base.abilities ?? [], 'id');
}
const plot = buildPlot(over.plot, pack.quests, pack.boards);
if (plot) pack.plot = plot;

const found = validatePack(pack);
for (const issue of found.errors ?? []) console.error(`ERROR  ${issue.path}: ${issue.message}`);
for (const issue of found.warnings ?? []) console.warn(`aviso  ${issue.path}: ${issue.message}`);
// Que la imagen de cada tablero dibujado esté donde dice (desde public/).
for (const board of pack.boards) {
    const image = typeof board.image === 'string' ? board.image.trim() : '';
    if (image && !/^[a-z]+:\/\//i.test(image) && !existsSync(join(ROOT, 'public', image))) {
        console.warn(`aviso  boards.${board.id}.image: no hay nada en public/${image}.`);
    }
}

// Que cada hito que pide ganar un tablero nombre uno que existe, y que los que abre existan.
const boardNames = new Set(pack.boards.map(b => String(b.name).toLowerCase()));
const milestoneIds = new Set((plot?.milestones ?? []).map(m => m.id));
const plotErrors = [];
for (const m of plot?.milestones ?? []) {
    if (m.asks.kind === 'win' && !boardNames.has(String(m.asks.board).toLowerCase())) plotErrors.push(`${m.id}: el tablero «${m.asks.board}» no existe`);
    for (const next of m.changes.open) if (!milestoneIds.has(next)) plotErrors.push(`${m.id}: abre «${next}», que no existe`);
    if (m.opens.kind === 'after' && !milestoneIds.has(m.opens.milestone)) plotErrors.push(`${m.id}: va después de «${m.opens.milestone}», que no existe`);
    if (m.changes.ending && !plot.endings[m.changes.ending]) plotErrors.push(`${m.id}: el final «${m.changes.ending}» no existe`);
}
for (const place of pack.locations) {
    for (const route of place.routes ?? []) {
        if (route.closedUntil && !milestoneIds.has(route.closedUntil)) plotErrors.push(`${place.name} → ${route.to}: cerrado hasta «${route.closedUntil}», que no es un hito`);
    }
}
for (const line of plotErrors) console.error(`ERROR  trama: ${line}`);

if (!found.ok || plotErrors.length > 0) {
    console.error(`\n${id}: el paquete no vale (${(found.errors ?? []).length + plotErrors.length} errores).`);
    process.exit(1);
}

const out = join(ROOT, 'public', 'mundos', `${id}.pack.json`);
const written = `${JSON.stringify(pack, null, 2)}\n`;
if (check) {
    const now = existsSync(out) ? readFileSync(out, 'utf8') : '';
    if (now !== written) {
        console.error(`${out} no es lo que sale de wiki/campanas/${id}: vuelve a generarlo sin --check.`);
        process.exit(1);
    }
    console.log(`${id}: al día.`);
} else {
    writeFileSync(out, written);
    const c = found.counts ?? {};
    console.log(`${id}: ${c.locations} localizaciones, ${c.boards} tableros, ${c.enemies} enemigos, ${c.quests} misiones, ${plot?.milestones.length ?? 0} hitos → ${out}`);
}
