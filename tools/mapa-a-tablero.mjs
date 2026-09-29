#!/usr/bin/env node
/**
 * Lee un mapa de D&D en imagen y lo convierte en un tablero (J12.8 a J12.12 de
 * wiki/ROADMAP_SIN_CONEXION.md).
 *
 *   node tools/mapa-a-tablero.mjs mapa.png
 *   node tools/mapa-a-tablero.mjs mapa.png --salida tablero.json --imagen mundos/strahd/mapas/sotano.png
 *   node tools/mapa-a-tablero.mjs mapa.png --celda 74.37 --desde 31,5.5
 *   node tools/mapa-a-tablero.mjs mapa.png --ancho 37
 *   node tools/mapa-a-tablero.mjs mapa.png --region 10,11
 *   node tools/mapa-a-tablero.mjs con-etiquetas.png --zona B1=6,5 --zona B3=10,11 --altura 22,10=60 --salida t.json
 *
 * Opciones:
 *   --celda N          Lado de la casilla en píxeles, si se sabe. Solo se busca dónde empieza.
 *   --desde x,y        Dónde empieza la cuadrícula (una esquina de casilla), con --celda.
 *   --ancho N          Cuántas casillas tiene la imagen de ancho, contadas en el dibujo.
 *   --casilla x,y,w,h  Una casilla marcada en el dibujo, en píxeles.
 *   --salida f.json    Escribe el trozo de tablero: image, grid, gridWidth, gridHeight, map y terrain.
 *   --imagen ruta      Lo que se escribe en `image`: la ruta del dibujo desde public/.
 *   --recorte f.png    Escribe la imagen recortada a la cuadrícula (cada casilla del tablero
 *                      cae sobre una del dibujo sin desfases).
 *   --notas            Lista cada casilla dudosa con el porqué.
 *   --region x,y       Las casillas de la sala o meseta donde cae esa casilla (para zonas y alturas).
 *   --zona B1=x,y      Una sala con nombre (J12.11): la región de esa casilla. Se repite, una por sala.
 *                      Mejor sobre el mapa con etiquetas: se ve qué sala es cuál.
 *   --altura x,y=PIES  La cota de la meseta donde cae esa casilla (J12.10). Se repite.
 *   --puentes PIES     La cota de los puentes propuestos (los que unen dos mesetas van a su altura).
 *   --sin-ascii        No enseña el mapa leído.
 *
 * Con --salida, las zonas y las cotas van en el trozo de tablero (`zones`, `elevation`).
 * Los tableros de una campaña lo usan con `mapFrom` en su mejoras.json (tools/campana-a-paquete.mjs).
 *
 * Lee PNG y JPG. Todo lo que decide está en `public/scripts/game-engine/board/map-image.js`,
 * con sus umbrales a la vista.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
/** Las opciones que llevan un valor detrás. */
const VALUED = new Set(['celda', 'desde', 'ancho', 'casilla', 'salida', 'imagen', 'recorte', 'region', 'zona', 'altura', 'puentes']);
/** @type {string|undefined} */
let file;
for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
        if (VALUED.has(args[i].slice(2))) i++;
        continue;
    }
    file ??= args[i];
}

/** @param {string} name */
const option = (name) => {
    const at = args.indexOf(`--${name}`);
    return at >= 0 ? args[at + 1] : undefined;
};
/** Todos los valores de una opción que se repite. @param {string} name @returns {string[]} */
const options = (name) => args.flatMap((a, i) => (a === `--${name}` && args[i + 1] !== undefined ? [args[i + 1]] : []));
/** @param {string} name */
const flag = (name) => args.includes(`--${name}`);
/** @param {string|undefined} value @returns {number[]} */
const numbers = (value) => String(value ?? '').split(',').map(Number).filter(Number.isFinite);

if (!file) {
    console.error('Uso: node tools/mapa-a-tablero.mjs <imagen.png|jpg> [--celda N] [--desde x,y] [--ancho N] [--casilla x,y,w,h] [--salida f.json] [--imagen ruta] [--recorte f.png] [--notas] [--region x,y]');
    process.exit(2);
}

const mapImage = await import(pathToFileURL(join(ROOT, 'public/scripts/game-engine/board/map-image.js')).href);
const { zoneFromCells } = await import(pathToFileURL(join(ROOT, 'public/scripts/game-engine/board/zones.js')).href);
const { setElevation } = await import(pathToFileURL(join(ROOT, 'public/scripts/game-engine/board/heights.js')).href);
const { default: png } = await import('@jimp/js-png');

/**
 * La imagen en RGBA. PNG con pngjs; JPG con jpeg-js, los dos de la familia @jimp que ya usa
 * el servidor.
 *
 * @param {string} path
 * @returns {Promise<{width: number, height: number, data: Uint8Array}>}
 */
async function readImage(path) {
    const bytes = readFileSync(path);
    const ext = extname(path).toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg') {
        const { default: jpeg } = await import('@jimp/js-jpeg');
        const decoded = jpeg().decode(bytes, { useTArray: true, formatAsRGBA: true });
        return { width: decoded.width, height: decoded.height, data: decoded.data };
    }
    const decoded = png().decode(bytes);
    return { width: decoded.width, height: decoded.height, data: decoded.data };
}

const pixels = await readImage(file);

/** @type {Record<string, any>} */
const hints = {};
if (option('celda')) hints.cell = Number(option('celda'));
if (option('desde')) [hints.offsetX, hints.offsetY] = numbers(option('desde'));
if (option('ancho')) hints.cellsAcross = Number(option('ancho'));
if (option('casilla')) {
    const [x, y, width, height] = numbers(option('casilla'));
    hints.cellRect = { x, y, width, height: height || width };
}

const started = Date.now();
const grid = mapImage.detectGrid(pixels, hints);
if (!(grid.cell > 0) || grid.cols === 0) {
    console.error('No se ve la cuadrícula. Di el tamaño de una casilla (--celda N), marca una (--casilla x,y,w,h) o di cuántas caben de ancho (--ancho N).');
    process.exit(1);
}
const reading = mapImage.classifyCells(pixels, grid);
const took = Date.now() - started;

console.log(`${file}: ${pixels.width}×${pixels.height} px`);
console.log(`Cuadrícula ${grid.source === 'auto' ? 'encontrada' : 'dicha a mano'}: casilla de ${grid.cell} px, empieza en (${grid.offsetX}, ${grid.offsetY}), `
    + `${grid.cols} × ${grid.rows} casillas. Se ve ${grid.confidence >= 0.7 ? 'clara' : grid.confidence >= 0.4 ? 'regular' : 'mal'} (${grid.confidence}).`
    + `${reading.gridless ? ' El dibujo no enseña la cuadrícula: se lee solo por el sitio que hay.' : ''} (${took} ms)`);

const counts = { floor: 0, wall: 0, rough: 0, door: 0, unknown: 0 };
reading.kinds.forEach((/** @type {keyof typeof counts} */ kind) => { counts[kind]++; });
const doubtful = reading.notes.filter((/** @type {string} */ n) => n.startsWith('dudosa')).length;
console.log(`Suelo ${counts.floor}, muro ${counts.wall}, terreno difícil ${counts.rough}, puertas ${counts.door}. `
    + `Dudosas ${doubtful} (${Math.round((100 * doubtful) / reading.kinds.length)} %): míralas y retócalas con el pincel.`);

if (!flag('sin-ascii')) {
    console.log('');
    console.log('Leyenda: # muro · . suelo · , suelo sin cuadrícula (meseta) · ~ terreno difícil · D puerta · ? dudosa');
    const header = Array.from({ length: reading.cols }, (_, x) => (x % 5 === 0 ? String(x % 100).padEnd(5) : '')).join('');
    console.log(`     ${header}`);
    mapImage.toAsciiRows(reading, { preview: true }).forEach((/** @type {string} */ row, /** @type {number} */ y) => {
        console.log(`${String(y).padStart(3)}  ${row}`);
    });
    console.log('');
}

// Lo que se propone y quien crea decide.
if (reading.doors.length > 0) {
    console.log(`Puertas propuestas: ${reading.doors.map((/** @type {{x: number, y: number}} */ d) => `(${d.x},${d.y})`).join(' ')}`);
}
if (reading.bridges.length > 0) {
    console.log(`Puentes propuestos (trama suelta leída como suelo): ${reading.bridges.map((/** @type {{x: number, y: number}} */ d) => `(${d.x},${d.y})`).join(' ')}`);
}
const plains = mapImage.plainGroups(reading);
if (plains.length > 0) {
    console.log('Suelo sin cuadrícula (mesetas o salientes: dales su altura con heights.js):');
    for (const group of plains) {
        console.log(`  ${group.cells.length} casillas, por ejemplo (${group.cells[0].x},${group.cells[0].y})`);
    }
}

if (flag('notas')) {
    console.log('\nPor qué, casilla a casilla:');
    reading.notes.forEach((/** @type {string} */ note, /** @type {number} */ i) => {
        if (note) console.log(`  (${i % reading.cols},${Math.floor(i / reading.cols)}) ${note}`);
    });
}

if (option('region')) {
    const [x, y] = numbers(option('region'));
    const cells = mapImage.regionAt(pixels, grid, x, y, { kinds: reading.kinds });
    console.log(`\nRegión de (${x},${y}): ${cells.length} casillas`);
    console.log(JSON.stringify(cells.map((/** @type {{x: number, y: number}} */ c) => `${c.x},${c.y}`)));
}

// Las salas con nombre (una región por sala) y las cotas (una región por meseta). Para las
// cotas se pulsa con más manga (un tercio de casilla basta): así entran los bordes de la
// meseta y los extremos de los puentes, que si no quedarían a ras de suelo.
/** @type {any[]} */
const zones = [];
for (const spec of options('zona')) {
    const [name, at] = spec.split('=');
    const [x, y] = numbers(at);
    const cells = mapImage.regionAt(pixels, grid, x, y, { kinds: reading.kinds });
    zones.push(zoneFromCells(name, cells));
    console.log(`Zona ${name}: ${cells.length} casillas desde (${x},${y}).`);
}
/** @type {Record<string, number>} */
let elevation = {};
for (const spec of options('altura')) {
    const [at, feet] = spec.split('=');
    const [x, y] = numbers(at);
    const cells = mapImage.regionAt(pixels, grid, x, y, { kinds: reading.kinds, cover: 1 / 3 });
    elevation = setElevation(elevation, cells, Number(feet));
    console.log(`Cota de ${Number(feet)} pies: ${cells.length} casillas desde (${x},${y}).`);
}
if (option('puentes')) {
    elevation = setElevation(elevation, reading.bridges, Number(option('puentes')));
    console.log(`Cota de ${Number(option('puentes'))} pies en los ${reading.bridges.length} tramos de puente propuestos.`);
}

if (option('salida')) {
    const fragment = {
        ...mapImage.toBoardFragment(reading, grid, { image: option('imagen') ?? '' }),
        ...(zones.length > 0 ? { zones } : {}),
        ...(Object.keys(elevation).length > 0 ? { elevation } : {}),
    };
    writeFileSync(option('salida'), `${JSON.stringify(fragment, null, 2)}\n`);
    console.log(`\nEscrito ${option('salida')}: ${fragment.gridWidth} × ${fragment.gridHeight}, ${Object.keys(fragment.terrain.cells).length} casillas que no son suelo.`);
}

if (option('recorte')) {
    const crop = mapImage.gridCrop(grid);
    const out = new Uint8Array(crop.width * crop.height * 4);
    for (let y = 0; y < crop.height; y++) {
        for (let x = 0; x < crop.width; x++) {
            const sx = Math.min(pixels.width - 1, crop.x + x);
            const sy = Math.min(pixels.height - 1, crop.y + y);
            const from = (sy * pixels.width + sx) * 4;
            const to = (y * crop.width + x) * 4;
            for (let c = 0; c < 4; c++) out[to + c] = pixels.data[from + c];
        }
    }
    writeFileSync(option('recorte'), png().encode({ width: crop.width, height: crop.height, data: /** @type {any} */ (Buffer.from(out)) }));
    console.log(`Escrito ${option('recorte')}: ${crop.width} × ${crop.height} px, ${grid.cols} × ${grid.rows} casillas de ${grid.cell} px.`);
}
