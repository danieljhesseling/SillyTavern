/**
 * ¿Está registrada cada clave que la partida guarda? (U2 del pegamento)
 *
 * Una partida guarda su estado en los metadatos del chat. Cada vez que alguien añadía una
 * clave nueva, la declaraba donde le hacía falta, y nadie tenía la lista: por eso el punto
 * de retorno se quedó guardando siete cosas. `game-engine/campaign/state-registry.js` es la
 * lista, y esto falla si el código usa una clave que no está en ella.
 *
 * Lee el código del fork buscando tres formas de tocar los metadatos:
 *
 *   chat_metadata.plotEnding          chat_metadata['currentLocation']
 *   chat_metadata[DEEDS_KEY]          metadata()?.[CALENDAR_KEY]   (con la constante resuelta)
 *
 * Uso: node tools/check-state-keys.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCRIPTS = join(ROOT, 'public', 'scripts');

/** El código del fork que guarda estado de partida. */
const SCANNED = [
    join(SCRIPTS, 'party.js'),
    join(SCRIPTS, 'campaigns.js'),
    join(SCRIPTS, 'dynamic-context-manager.js'),
    ...walk(join(SCRIPTS, 'party')),
    ...walk(join(SCRIPTS, 'game-engine')),
];

/** De aquí solo se leen constantes (`METADATA_KEY`), no usos: es de SillyTavern. */
const DEFINITIONS_ONLY = [join(SCRIPTS, 'world-info.js')];

/** @param {string} dir @returns {string[]} */
function walk(dir) {
    return readdirSync(dir).flatMap(name => {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) return walk(full);
        return name.endsWith('.js') ? [full] : [];
    });
}

/** @type {Map<string, Set<string>>} constante → valores */
const definitions = new Map();
for (const file of [...SCANNED, ...DEFINITIONS_ONLY]) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\bconst ([A-Z][A-Z0-9_]*) = '([a-zA-Z_][\w]*)'/g)) {
        if (!definitions.has(match[1])) definitions.set(match[1], new Set());
        definitions.get(match[1]).add(match[2]);
    }
}

/** @type {Map<string, string[]>} clave → dónde se usa */
const used = new Map();
/** @type {string[]} */
const unresolved = [];
const note = (/** @type {string} */ key, /** @type {string} */ where) => {
    if (!used.has(key)) used.set(key, []);
    used.get(key).push(where);
};

for (const file of SCANNED) {
    const lines = readFileSync(file, 'utf8').split('\n');
    const rel = relative(ROOT, file).replaceAll('\\', '/');
    lines.forEach((line, index) => {
        const where = `${rel}:${index + 1}`;
        for (const match of line.matchAll(/chat_metadata(?:\?)?\.([a-zA-Z_]\w*)/g)) note(match[1], where);
        for (const match of line.matchAll(/chat_metadata(?:\?\.)?\[\s*['"]([a-zA-Z_]\w*)['"]\s*\]/g)) note(match[1], where);
        for (const match of line.matchAll(/(?:chat_metadata|chatMetadata|metadata\(\)|(?<![.\w])metadata)(?:\?\.)?\[\s*([A-Z][A-Z0-9_]*)\s*\]/g)) {
            const values = definitions.get(match[1]);
            if (!values) unresolved.push(`${match[1]} (${where})`);
            else for (const value of values) note(value, where);
        }
    });
}

const { STATE_KEYS } = await import(pathToFileURL(join(SCRIPTS, 'game-engine', 'campaign', 'state-registry.js')).href);
const registered = new Set(STATE_KEYS.map((/** @type {{key: string}} */ e) => e.key));

const missing = [...used.keys()].filter(key => !registered.has(key)).sort();
const stale = [...registered].filter(key => !used.has(key)).sort();

console.log(`Claves de la partida usadas en el código: ${used.size}. Registradas: ${registered.size}.`);
if (unresolved.length > 0) console.log(`Constantes sin resolver (no se comprueban): ${unresolved.join(', ')}`);
if (stale.length > 0) console.log(`Registradas pero no vistas en el código (¿sobran?): ${stale.join(', ')}`);

if (missing.length > 0) {
    console.error('\nClaves que el código usa y el registro no conoce:\n');
    for (const key of missing) console.error(`  ${key}  ←  ${used.get(key).slice(0, 3).join(', ')}`);
    console.error('\nAñádelas a public/scripts/game-engine/campaign/state-registry.js, diciendo de quién');
    console.error('son, qué son y de qué clase: si no, un punto de retorno no sabrá que existen.\n');
    process.exit(1);
}
console.log('Todas registradas.');
