#!/usr/bin/env node
/**
 * El índice del arte en pixel: `public/img/game-engine/pixel/manifest.json`.
 *
 *   node tools/pixel-manifest.mjs          lo escribe
 *   node tools/pixel-manifest.mjs --check  falla si el escrito no es lo que saldría
 *
 * El juego lo lee una vez (`ui/pixel-art.js`) y solo pide imágenes que están en él: así no
 * hay un 404 por cada persona del chat que no tiene retrato. Lista cada PNG de la carpeta,
 * con su subcarpeta, y los alias: el nombre de una fila del compendio o de una persona de un
 * paquete frente a su archivo, cuando no coinciden («Tiflin» es `raza-tiefling.png`).
 *
 * Se vuelve a pasar cada vez que se añaden imágenes. Si no, la prueba
 * `tests/game-engine-pixel-art.test.js` avisa de que el índice está viejo.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Donde están las imágenes. */
export const PIXEL_DIR = join(ROOT, 'public/img/game-engine/pixel');

/** Donde se escribe el índice. */
export const MANIFEST_PATH = join(PIXEL_DIR, 'manifest.json');

/**
 * Los PNG de una carpeta y de las de dentro, relativos a ella y con `/`.
 *
 * @param {string} dir
 * @param {string} [prefix]
 * @returns {string[]}
 */
function listPngs(dir, prefix = '') {
    /** @type {string[]} */
    const found = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) found.push(...listPngs(join(dir, entry.name), path));
        else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) found.push(path);
    }
    return found;
}

/**
 * Un JSON del disco, o null si no está o no se lee.
 *
 * @param {string} path
 * @returns {any}
 */
function readJson(path) {
    try {
        return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
    } catch {
        return null;
    }
}

/**
 * El índice que sale de lo que hay ahora en disco, en texto, tal y como se escribe.
 *
 * @returns {Promise<string>}
 */
export async function pixelManifestText() {
    const { buildPixelManifest, PIXEL_DOMAINS } = await import(pathToFileURL(join(ROOT, 'public/scripts/game-engine/ui/pixel-art.js')).href);
    /** @type {Record<string, any[]>} */
    const domains = {};
    for (const domain of Object.keys(PIXEL_DOMAINS)) {
        domains[domain] = readJson(join(ROOT, 'public/compendio', `${domain}.json`))?.rows ?? [];
    }
    /** @type {Record<string, any>} */
    const packs = {};
    for (const file of readdirSync(join(ROOT, 'public/mundos')).filter(f => f.endsWith('.pack.json')).sort()) {
        const pack = readJson(join(ROOT, 'public/mundos', file));
        if (pack) packs[file.replace(/\.pack\.json$/, '')] = pack;
    }
    const manifest = buildPixelManifest({ files: listPngs(PIXEL_DIR), domains, packs });
    return `${JSON.stringify(manifest, null, 1)}\n`;
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
    const wanted = await pixelManifestText();
    const written = existsSync(MANIFEST_PATH) ? readFileSync(MANIFEST_PATH, 'utf8') : '';
    if (process.argv.includes('--check')) {
        if (wanted !== written) {
            console.error('El índice del arte en pixel está viejo: pasa `node tools/pixel-manifest.mjs`.');
            process.exit(1);
        }
        console.log('El índice del arte en pixel está al día.');
    } else {
        writeFileSync(MANIFEST_PATH, wanted);
        const count = JSON.parse(wanted).files.length;
        console.log(`Escrito ${MANIFEST_PATH.replace(ROOT, '').replace(/^[\\/]/, '')}: ${count} imágenes.`);
    }
}
