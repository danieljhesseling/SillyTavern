#!/usr/bin/env node
/**
 * Los retratos que faltan, campaña a campaña, con lo que hay que pedirle a PixelLab
 * (los Gems al día, 2026-10-02).
 *
 * Cada persona de un paquete (`npcs`, `confidants`, y los del bestiario que hablan en una escena)
 * sale en las conversaciones con su retrato: `public/img/game-engine/pixel/retratos/<campaña>/<id>.png`
 * y sus tres caras (`<id>--alegre.png`, `--enfadado`, `--triste`). Sin él, una silueta. El Gem
 * escribe cómo es cada uno (`aspecto`); esto dice quién no tiene retrato y da la descripción
 * para dibujarlo.
 *
 * Uso:
 *   node tools/retratos-pendientes.mjs                    # las campañas del juego (public/mundos/*.pack.json)
 *   node tools/retratos-pendientes.mjs strahd             # una de ellas
 *   node tools/retratos-pendientes.mjs mi-campana.json    # una tuya: el JSON de tu Gem (su carpeta es tuya-<nombre>)
 *   node tools/retratos-pendientes.mjs strahd --caras     # y, de quien ya tiene retrato, las caras que le faltan
 *   node tools/retratos-pendientes.mjs mi.json --json     # la lista en JSON, para hacerlos de una vez
 *
 * Para hacerlos, a Claude: «Haz con PixelLab los retratos pendientes de <campaña>». Después,
 * `node tools/pixel-manifest.mjs` para que el juego los vea.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCampaignText, importedCampaignId } from '../public/scripts/game-engine/campaign/campaign-import.js';
import { slugify } from '../public/scripts/game-engine/ui/pixel-art.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORTRAITS = join(ROOT, 'public/img/game-engine/pixel/retratos');
const MANIFEST = join(ROOT, 'public/img/game-engine/pixel/manifest.json');

/** Las tres caras de la novela visual, y cómo se le piden a PixelLab. */
export const MOODS = {
    alegre: 'happy, a warm smile',
    enfadado: 'angry, frowning, jaw clenched',
    triste: 'sad, worried eyes, mouth turned down',
};

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * La línea de estilo, según el género de la campaña: lo que tienen en común todos sus retratos.
 *
 * @param {string} genre
 * @returns {string}
 */
export function styleOf(genre) {
    const g = slugify(genre);
    const mood = /terror|horror|gotic/.test(g) ? 'gothic horror, cold desaturated palette'
        : /historic/.test(g) ? 'late medieval, earthy realistic palette'
            : /isekai/.test(g) ? 'bright fantasy, clean saturated palette'
                : 'dark fantasy, muted palette with gold accents';
    return `Pixel art bust portrait, 128x160, transparent background, ${mood}, no text, no frame.`;
}

/**
 * Quién habla en las escenas o en las charlas: los del bestiario que hablan también necesitan cara.
 *
 * @param {any} pack
 * @returns {Set<string>}
 */
function speakers(pack) {
    /** @type {Set<string>} */
    const out = new Set();
    for (const m of Array.isArray(pack?.plot?.milestones) ? pack.plot.milestones : []) {
        for (const beat of Array.isArray(m?.beats) ? m.beats : []) if (text(beat?.who)) out.add(text(beat.who));
        if (text(m?.pov)) out.add(text(m.pov));
    }
    for (const talk of Array.isArray(pack?.dialogues) ? pack.dialogues : []) if (text(talk?.speaker)) out.add(text(talk.speaker));
    // Tanda 22 (D-J60): y quien dice lo que pasa al evitar una pelea o al hablar en mitad de ella
    // (quien manda del tablero, o el `who` de la rama).
    for (const board of Array.isArray(pack?.boards) ? pack.boards : []) {
        const leader = text(board?.parley?.leader);
        if (leader) out.add(leader);
        const ways = [...(Array.isArray(board?.avoid) ? board.avoid : []), ...Object.values(board?.parley && typeof board.parley === 'object' ? board.parley : {})];
        for (const way of ways) {
            for (const key of ['success', 'partial', 'failure']) {
                const who = text(way?.[key]?.who).replace(/\{leader\}/g, leader);
                if (who && who !== '{companero}') out.add(who);
            }
        }
    }
    return out;
}

/**
 * La gente de una campaña que sale con retrato: su archivo, si lo tiene, y su aspecto.
 *
 * @param {any} pack
 * @param {{folder: string, files: Set<string>, aliases: Record<string, string>}} where
 * @returns {Array<{name: string, file: string, has: boolean, moods: string[], aspecto: string, about: string, kind: string}>}
 */
export function peopleOf(pack, { folder, files, aliases }) {
    const talkers = speakers(pack);
    const people = [
        ...(Array.isArray(pack?.confidants) ? pack.confidants : []).map((/** @type {any} */ p) => ({ ...p, kind: 'compañero' })),
        ...(Array.isArray(pack?.npcs) ? pack.npcs : []).map((/** @type {any} */ p) => ({ ...p, kind: 'gente' })),
        ...(Array.isArray(pack?.bestiary) ? pack.bestiary : []).filter((/** @type {any} */ b) => talkers.has(text(b?.name))).map((/** @type {any} */ p) => ({ ...p, kind: 'habla en escena' })),
    ];
    /** @type {Set<string>} */
    const seen = new Set();
    return people.filter(p => text(p.name) && !seen.has(text(p.name)) && seen.add(text(p.name))).map(p => {
        const slug = slugify(p.name);
        const bases = [slugify(p.id), aliases[slug], slug].filter(Boolean);
        const found = bases.find(base => files.has(`${base}.png`)) ?? '';
        // Uno nuevo, con el nombre entero: así lo encuentra el juego también en una campaña tuya, que
        // no tiene alias en el índice (el id solo vale en las de `public/mundos/`).
        const file = found || slug;
        return {
            name: text(p.name),
            file: `retratos/${folder}/${file}.png`,
            has: Boolean(found),
            moods: Object.keys(MOODS).filter(mood => !files.has(`${file}--${mood}.png`)),
            aspecto: text(p.aspecto),
            about: [text(p.trade) || text(p.className), text(p.gender), text(p.description)].filter(Boolean).join('. '),
            kind: p.kind,
        };
    });
}

/**
 * Lo que se le pide a PixelLab para el retrato de alguien, y para cada cara.
 *
 * @param {{name: string, aspecto: string, about: string}} person
 * @param {string} genre
 * @returns {{base: string, moods: Record<string, string>}}
 */
export function promptFor(person, genre) {
    const who = person.aspecto || person.about || person.name;
    const base = `${styleOf(genre)} ${who}`;
    return {
        base,
        moods: Object.fromEntries(Object.entries(MOODS).map(([mood, face]) => [mood, `Same character, same clothes, framing and colors; expression: ${face}.`])),
    };
}

/** @returns {Record<string, Record<string, string>>} Los alias del índice, por carpeta. */
function readAliases() {
    try {
        return JSON.parse(readFileSync(MANIFEST, 'utf8')).aliases ?? {};
    } catch {
        return {};
    }
}

/**
 * Las campañas a mirar: las del juego o las que se piden.
 *
 * @param {string[]} asked
 * @returns {Array<{label: string, folder: string, pack: any}>}
 */
function campaigns(asked) {
    const mundos = join(ROOT, 'public/mundos');
    const builtIn = readdirSync(mundos).filter(f => f.endsWith('.pack.json')).map(f => f.replace(/\.pack\.json$/, ''));
    const wanted = asked.length > 0 ? asked : builtIn;
    return wanted.map(one => {
        if (builtIn.includes(one)) {
            return { label: one, folder: one, pack: JSON.parse(readFileSync(join(mundos, `${one}.pack.json`), 'utf8')) };
        }
        const path = resolve(one);
        if (!existsSync(path)) throw new Error(`No encuentro «${one}»: ni es una campaña del juego (${builtIn.join(', ')}) ni un archivo.`);
        const read = readCampaignText(readFileSync(path, 'utf8'));
        const pack = read.pack ?? JSON.parse(readFileSync(path, 'utf8'));
        return { label: basename(path), folder: importedCampaignId(pack?.world?.name), pack };
    });
}

const args = process.argv.slice(2);
const FACES = args.includes('--caras');
const AS_JSON = args.includes('--json');
const asked = args.filter(a => !a.startsWith('--'));
const aliases = readAliases();
const report = campaigns(asked).map(({ label, folder, pack }) => {
    const dir = join(PORTRAITS, folder);
    const files = new Set(existsSync(dir) ? readdirSync(dir) : []);
    const genre = text(pack?.world?.genre);
    const people = peopleOf(pack, { folder, files, aliases: aliases[`retratos/${folder}`] ?? {} });
    return { label, name: text(pack?.world?.name), folder, genre, people };
});

if (AS_JSON) {
    const out = report.map(c => ({
        campaign: c.name,
        folder: `public/img/game-engine/pixel/retratos/${c.folder}/`,
        missing: c.people.filter(p => !p.has || (FACES && p.moods.length > 0)).map(p => ({
            name: p.name, file: p.file, portrait: !p.has, moods: p.has ? p.moods : Object.keys(MOODS), aspecto: p.aspecto, prompt: promptFor(p, c.genre),
        })),
    }));
    console.log(JSON.stringify(out, null, 2));
    process.exit(0);
}

for (const c of report) {
    const missing = c.people.filter(p => !p.has);
    const faces = c.people.filter(p => p.has && p.moods.length > 0);
    const noLook = c.people.filter(p => !p.aspecto);
    console.log(`\n== ${c.name || c.label} (retratos/${c.folder}/): ${c.people.length} personas, ${missing.length} sin retrato, `
        + `${faces.length} con caras por hacer, ${noLook.length} sin aspecto`);
    for (const p of missing) {
        const prompt = promptFor(p, c.genre);
        console.log(`- ${p.file.split('/').pop()}: ${p.name} (${p.kind})${p.aspecto ? '' : '  [sin aspecto: pídeselo a tu Gem]'}`);
        console.log(`    ${prompt.base}`);
        console.log(`    y sus caras: ${Object.keys(MOODS).map(m => `${p.file.split('/').pop().replace(/\.png$/, '')}--${m}.png`).join(', ')}`);
    }
    if (FACES) {
        for (const p of faces) console.log(`- ${p.name}: le faltan las caras ${p.moods.join(', ')}`);
    } else if (faces.length > 0) {
        console.log(`  (${faces.length} ya tienen retrato pero no todas sus caras: --caras para verlas)`);
    }
    if (noLook.length > 0 && missing.length === 0) console.log(`  Sin aspecto: ${noLook.map(p => p.name).join(', ')}.`);
}
