#!/usr/bin/env node
/**
 * Convierte los guiones de un mundo en su paquete de campaña.
 *
 * El Gem guionista (wiki/GEM_GUIONISTA.md) escribe la biblia de un mundo por rondas, en
 * Markdown con bloques YAML: hitos, localidades, gente, encargos, tableros… Esto los lee en
 * orden y construye el paquete que el juego importa (el mismo formato que valida
 * `/esquema-campana`), con los nombres ya resueltos: el guion se refiere a todo por su id,
 * y el juego enlaza por nombres.
 *
 * **Un bloque posterior con el mismo id corrige al anterior**, campo a campo. Así las
 * correcciones van en su propia ronda (`ronda-8-claude.md`, por ejemplo) y lo que escribió
 * el guionista se queda como lo escribió.
 *
 * Uso:
 *   node tools/guion-a-paquete.mjs wiki/guiones/<mundo>           # escribe public/mundos/<id>.pack.json si no existe
 *   node tools/guion-a-paquete.mjs wiki/guiones/1387 --check      # solo comprueba
 *   node tools/guion-a-paquete.mjs wiki/guiones/1387 --forzar     # pisa el paquete que ya hay
 *   node tools/guion-a-paquete.mjs wiki/guiones/1387 --salida x.json   # lo escribe aparte, para comparar
 *
 * D-J37: la fuente de 1387 es su paquete, `public/mundos/1387.pack.json`, que se corrige a mano;
 * las rondas de `wiki/guiones/1387` son la historia de cómo se escribió. Por eso un paquete que
 * ya existe no se pisa sin `--forzar`: lo que sale del guion no trae las correcciones.
 *
 * D-J18: un `final` puede traer `epilogos`, qué fue de cada uno: `{quien: <id>, texto: …}`,
 * con `quien` el id de alguien del guion o de una facción. Van al paquete como `epilogues`.
 *
 * Ver wiki/archivo/ROADMAP_MUNDOS_VIVOS.md, fase M.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import yaml from 'js-yaml';

const ROOT = new URL('..', import.meta.url);

// J5.9: la conversión vive en el motor (`campaign/guion-pack.js`), para que el taller de
// campañas del gremio la haga en el navegador con el mismo código. Aquí solo se lee la carpeta,
// se imprime y se escribe.
const { convertGuion, guionReportLines, isRoundFile } = await import(new URL('public/scripts/game-engine/campaign/guion-pack.js', ROOT).href);

/** @param {any} value */
const text = (value) => String(value ?? '').trim();

// ---------------------------------------------------------------- run
const [dirArg, ...flags] = process.argv.slice(2);
if (!dirArg) {
    console.error('Uso: node tools/guion-a-paquete.mjs <carpeta de guiones> [--check] [--forzar] [--salida <archivo>]');
    process.exit(2);
}
// Desde la raíz del repositorio, o una ruta entera (`C:\…`, `/tmp/…`).
const dir = isAbsolute(dirArg)
    ? new URL(`${pathToFileURL(dirArg).href.replace(/\/?$/, '/')}`)
    : new URL(dirArg.replace(/\\/g, '/').replace(/\/?$/, '/'), ROOT);
// Las rondas, con su texto; el orden lo pone el motor.
const rounds = readdirSync(dir).filter(isRoundFile).map(name => ({ name, text: readFileSync(new URL(name, dir), 'utf8') }));
const library = JSON.parse(readFileSync(new URL('public/compendio/habilidades.json', ROOT), 'utf8'));
const result = convertGuion(rounds, { parseYaml: yaml.load, abilityRows: library.rows ?? [] });
if (result.stage === 'leido') {
    for (const line of guionReportLines(result)) console.log(line);
    process.exit(1);
}
if (result.stage === 'sin-mundo') {
    for (const line of guionReportLines(result)) console.error(line);
    process.exit(2);
}
const { pack } = result;
for (const line of guionReportLines(result)) console.log(line);

// `--salida <archivo>`: escribirlo en otro sitio, para compararlo con el paquete sin tocarlo.
const aside = flags.includes('--salida') ? flags[flags.indexOf('--salida') + 1] : '';
if (aside) {
    writeFileSync(aside, `${JSON.stringify(pack, null, 2)}\n`);
    console.log(`Escrito ${aside} (el paquete de public/mundos no se toca)`);
} else if (!flags.includes('--check')) {
    const out = new URL(`public/mundos/${text(result.worldId)}.pack.json`, ROOT);
    // D-J37: un paquete que ya existe es la fuente (el de 1387 se corrige a mano), y lo que sale
    // del guion no trae esas correcciones. No se pisa sin pedirlo.
    if (existsSync(out) && !flags.includes('--forzar')) {
        console.log(`\nNO se escribe public/mundos/${text(result.worldId)}.pack.json: ya existe, y el paquete es la fuente`
            + ' (D-J37: se corrige a mano, no desde el guion).');
        console.log('       Lo que sale de estas rondas pisaría esas correcciones. Para comprobar sin escribir: --check;');
        console.log('       para verlo al lado y compararlo: --salida <archivo>.');
        console.log('       Si de verdad quieres pisarlo con lo del guion: --forzar (y mira el diff antes de guardarlo).');
        process.exit(1);
    }
    writeFileSync(out, `${JSON.stringify(pack, null, 2)}\n`);
    console.log(`Escrito ${out.pathname}`);
}
process.exit(result.ok ? 0 : 1);
