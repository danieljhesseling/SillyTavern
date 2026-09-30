#!/usr/bin/env node
/**
 * ¿Llega este mundo al listón? El comprobador de densidad (M6).
 *
 * Un mundo precreado tiene que dar unas veinte horas, empezando 80 % escrito
 * (wiki/archivo/ROADMAP_MUNDOS_VIVOS.md, M1). Escribir tanto sin perderse es imposible a ojo: esto
 * cuenta lo que hay contra el listón y, sobre todo, **busca huecos** — un sitio al que no se
 * puede llegar, un rumor que apunta a la nada, un hito que nunca se abre, un PNJ que no
 * quiere nada o un encargo cuyo tablero no existe. Es a los mundos lo que
 * `check-engine-wiring.mjs` es al código.
 *
 * La cuenta vive en el motor (`campaign/world-density.js`), para que el taller enseñe lo
 * mismo que esto (idea 181). Aquí solo se lee el archivo y se imprime.
 *
 * Uso:
 *   node tools/check-world-density.mjs public/mundos/1387.pack.json
 *
 * Sale con 1 si hay algún ERROR (falta algo del listón o algo está roto). Los AVISOS son
 * cosas que conviene mirar, pero que pueden estar así a propósito.
 *
 * J10.2 y J10.4: después de las cifras sale cada localización con lo que tiene (gente o
 * servicios, algo que mirar, un rumor o un hito, un secreto y, si le toca, un tablero) y los
 * secretos del mundo con cómo se descubre cada uno. Una localización corta es un ERROR.
 *
 * J5.6: **una campaña de tu Gem, antes de jugarla.** Con el JSON que devuelve tu Gem (el que
 * trae la cabecera del esquema o las marcas `[cite]`, como `wiki/campanas/strahd/original.json`),
 * o con cualquiera y `--campana`, sale lo mismo que enseña «Añadir una campaña» en el tablón del
 * gremio: se lee igual (en limpio, con los mapas leídos de su dibujo y con lo que falte puesto
 * por el motor, J5.3 y J12.5) y se dice si se puede jugar entera, lo que lo impide, lo que se
 * quedaría a medias, lo que ha puesto el juego, las cosas raras y lo que le falta para durar
 * como las del juego. Sale con 1 solo si algo impide jugarla. Con `--gem`, la lista para
 * pegársela a tu Gem.
 *
 *   node tools/check-world-density.mjs wiki/campanas/strahd/original.json
 *   node tools/check-world-density.mjs mi-campana.json --campana --gem
 */

import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('..', import.meta.url);
const { checkWorldDensity, gemRequest, PLACE_NEEDS, SECRET_WAYS } = await import(new URL('public/scripts/game-engine/campaign/world-density.js', ROOT).href);
const { isGemJson } = await import(new URL('public/scripts/game-engine/campaign/campaign-import.js', ROOT).href);

const file = process.argv[2];
// Idea 182: con --gem, en vez del informe sale el encargo para el Gem guionista, listo para pegar.
const forGem = process.argv.includes('--gem');
if (!file) {
    console.error('Uso: node tools/check-world-density.mjs <paquete.json> [--campana] [--gem]');
    process.exit(2);
}
const source = readFileSync(file, 'utf8');
/** @type {any} */
let pack = null;
try {
    pack = JSON.parse(source);
} catch {
    pack = null;
}
// J5.6: lo que da tu Gem, o lo que se pida como campaña, se comprueba como en el tablón. Un
// archivo que no se lee como JSON también: el tablón dice dónde falla.
if (!pack || isGemJson(pack) || process.argv.includes('--campana')) {
    process.exit(await checkAsCampaign(source));
}
const report = checkWorldDensity(pack);

if (forGem) {
    const request = gemRequest(report);
    if (!request) {
        console.log(`«${report.name || 'este mundo'}» llega al listón y no tiene huecos: no hace falta pedirle nada al Gem.`);
        process.exit(0);
    }
    console.log(request);
    process.exit(report.errors.length === 0 ? 0 : 1);
}

console.log(`Mundo: ${report.name}\n`);
for (const line of report.counts) console.log(`  ${line}`);

// J10.2: sitio por sitio. Una marca por cosa que pide, en el orden de PLACE_NEEDS.
const needs = Object.keys(PLACE_NEEDS);
console.log(`\nLocalizaciones (${needs.map(key => PLACE_NEEDS[key]).join(' · ')}):`);
for (const place of report.places) {
    const marks = needs.map(key => (place.has[key] ? '✓' : key === 'board' && !place.needsBoard ? '·' : '✗')).join(' ');
    const said = place.ok ? `${place.reasons} razones para ir` : `le falta ${place.missing.join(', ')}`;
    console.log(`  ${place.ok ? '✓' : '✗'} ${marks}  ${place.name}${place.hidden ? ' (escondida)' : ''}: ${said}`);
}

// J10.4: los secretos, y cómo se descubre cada uno.
console.log(`\nSecretos (${report.secrets.length}):`);
for (const secret of report.secrets) {
    const how = secret.ways.map(way => SECRET_WAYS[way] ?? way).join(' o ');
    console.log(`  · ${secret.what} (${secret.kind}): por ${how}${secret.where.length ? `, en ${secret.where.join(', ')}` : ''}`);
}
if (report.warnings.length) console.log('');
for (const line of report.warnings) console.log(`AVISO  ${line}`);
if (report.errors.length) console.log('');
for (const line of report.errors) console.log(`ERROR  ${line}`);
console.log(`\n${report.errors.length === 0 ? 'Llega al listón.' : `${report.errors.length} cosa(s) por arreglar.`}`);
process.exit(report.errors.length === 0 ? 0 : 1);

/**
 * J5.6: la campaña, leída y comprobada como en «Añadir una campaña» del gremio.
 *
 * @param {string} content El texto del archivo.
 * @returns {Promise<number>} El código de salida: 1 si algo impide jugarla.
 */
async function checkAsCampaign(content) {
    const { readCampaignFile } = await import(new URL('public/scripts/game-engine/campaign/campaign-import.js', ROOT).href);
    const { checkText } = await import(new URL('public/scripts/game-engine/campaign/campaign-check.js', ROOT).href);
    const { loadCompendium, createCompendium, DOMAINS } = await import(new URL('public/scripts/game-engine/compendio/compendio.js', ROOT).href);
    // El compendio del juego, el mismo que abre el tablón: los bichos del bestiario y las frases del narrador.
    const { batteries } = await loadCompendium({
        domains: DOMAINS,
        read: async (/** @type {string} */ domain) => {
            try {
                return JSON.parse(readFileSync(new URL(`public/compendio/${domain}.json`, ROOT), 'utf8'));
            } catch {
                return null;
            }
        },
    });
    const read = await readCampaignFile(content, { compendium: createCompendium(batteries ?? {}), loadPixels });

    if (forGem) {
        const said = read.check ? checkText(read.check) : '';
        console.log(said || (read.check
            ? `«${read.check.name || 'Esta campaña'}» se puede jugar entera: no hace falta pedirle nada a tu Gem.`
            : read.headline));
        return read.check?.verdict === 'rota' || !read.check ? 1 : 0;
    }

    console.log(`Campaña: ${read.check?.name || read.pack?.world?.name || file}${read.kind === 'gem' ? ' (de tu Gem)' : ''}\n`);
    for (const note of read.notes) console.log(`  ${note}`);
    if (read.notes.length > 0) console.log('');
    if (!read.check) {
        // Ni siquiera es una campaña: no es JSON, o no trae mundo ni tableros.
        console.log(read.headline);
        return 1;
    }
    if (!read.ok) console.log(read.headline);
    console.log(read.check.headline);
    const marks = { rota: '✗', huecos: '!', relleno: '+', avisos: '?', liston: '·' };
    for (const group of read.check.groups) {
        console.log(`\n${group.title} (${group.items.length}): ${group.note}`);
        for (const item of group.items) {
            console.log(`  ${marks[/** @type {keyof typeof marks} */ (group.key)] ?? '·'} ${item.text}${item.where ? `  (en ${item.where})` : ''}`);
        }
    }
    if (read.check.groups.some((/** @type {any} */ g) => g.key === 'rota' || g.key === 'huecos')) {
        console.log('\nCon --gem sale esa lista, para pegársela a tu Gem.');
    }
    return read.check.verdict === 'rota' ? 1 : 0;
}

/**
 * J12.5: abrir el dibujo de un tablero (`image`, desde `public/`) y dar sus píxeles, como el
 * editor en el navegador. PNG y JPG, con los mismos de `mapa-a-tablero.mjs`.
 *
 * @param {string} src
 * @returns {Promise<{width: number, height: number, data: Uint8Array}>}
 */
async function loadPixels(src) {
    if (/^(?:[a-z]+:)?\/\//i.test(src) || /^(?:data|blob):/i.test(src)) throw new Error('solo se abren dibujos de public/');
    const path = fileURLToPath(new URL(`public/${src.replace(/^\/+/, '')}`, ROOT));
    const bytes = readFileSync(path);
    const ext = extname(path).toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg') {
        const { default: jpeg } = await import('@jimp/js-jpeg');
        const decoded = jpeg().decode(bytes, { useTArray: true, formatAsRGBA: true });
        return { width: decoded.width, height: decoded.height, data: decoded.data };
    }
    const { default: png } = await import('@jimp/js-png');
    const decoded = png().decode(bytes);
    return { width: decoded.width, height: decoded.height, data: decoded.data };
}
