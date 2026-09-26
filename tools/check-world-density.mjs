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
 */

import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url);
const { checkWorldDensity, gemRequest } = await import(new URL('public/scripts/game-engine/campaign/world-density.js', ROOT).href);

const file = process.argv[2];
// Idea 182: con --gem, en vez del informe sale el encargo para el Gem guionista, listo para pegar.
const forGem = process.argv.includes('--gem');
if (!file) {
    console.error('Uso: node tools/check-world-density.mjs <paquete.json> [--gem]');
    process.exit(2);
}
const pack = JSON.parse(readFileSync(file, 'utf8'));
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
if (report.warnings.length) console.log('');
for (const line of report.warnings) console.log(`AVISO  ${line}`);
if (report.errors.length) console.log('');
for (const line of report.errors) console.log(`ERROR  ${line}`);
console.log(`\n${report.errors.length === 0 ? 'Llega al listón.' : `${report.errors.length} cosa(s) por arreglar.`}`);
process.exit(report.errors.length === 0 ? 0 : 1);
