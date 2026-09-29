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
 *   marca y se deja el texto.
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

/** Quita las marcas del resumidor y la de «texto propio». */
function clean(value) {
    if (typeof value === 'string') {
        return value.replace(/\s*\[cite:[^\]]*\]/g, '').replace(/^propio:\s*/, '').trim();
    }
    if (Array.isArray(value)) return value.map(clean);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clean(v)]));
    }
    return value;
}

/** @param {any[]} base @param {any[]} over @param {string} key */
function mergeBy(base, over, key) {
    const out = (Array.isArray(base) ? base : []).map(row => ({ ...row }));
    for (const row of Array.isArray(over) ? over : []) {
        const at = out.findIndex(r => String(r?.[key]).toLowerCase() === String(row?.[key]).toLowerCase());
        if (at >= 0) out[at] = { ...out[at], ...row };
        else out.push({ ...row });
    }
    return out;
}

/** Cada ruta, también de vuelta. */
function bothWays(locations) {
    const byName = new Map(locations.map(l => [String(l.name).toLowerCase(), l]));
    for (const place of locations) {
        for (const route of Array.isArray(place.routes) ? place.routes : []) {
            const other = byName.get(String(route.to).toLowerCase());
            if (!other) continue;
            other.routes = Array.isArray(other.routes) ? other.routes : [];
            if (other.routes.some(r => String(r.to).toLowerCase() === String(place.name).toLowerCase())) continue;
            other.routes.push({ to: place.name, days: route.days, ...(route.closedUntil ? { closedUntil: route.closedUntil } : {}) });
        }
    }
    return locations;
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
            opens: m.opens ?? { kind: 'after', milestone: m.after },
            asks: m.asks ?? (board ? { kind: 'win', board: board.name } : { kind: 'none' }),
            changes: {
                reveal: m.reveal ?? [],
                open: m.open ?? [],
                standing: m.standing ?? {},
                ending: m.ending ?? '',
                endingBy: m.endingBy ?? {},
            },
        };
    });
    return { title: plot.title, milestones, endings: plot.endings ?? {}, omens: plot.omens ?? [] };
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
pack.boards = layered('boards', 'id');
pack.quests = layered('quests', 'id');
for (const [section, key] of [['npcs', 'id'], ['contracts', 'id'], ['rumors', 'id']]) {
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
