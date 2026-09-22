#!/usr/bin/env node
/**
 * Escribe wiki/GEM_CREAR_CAMPANA.md: lo que hay que pegarle a un Gem de Gemini para que
 * devuelva paquetes de campaña que el importador lea enteros.
 *
 * Generado desde el motor y no escrito a mano, por la misma razón que `/esquema-campana`:
 * una copia guardada aparte se queda vieja sin avisar, y el fallo aparece dos libros más
 * tarde como una sección que importa vacía. Aquí el esquema, las reglas, la leyenda del
 * mapa y la muestra salen de `campaign-pack-schema.js`; lo único escrito a mano es cómo
 * montar el Gem y cómo hablar con él.
 *
 * Uso:
 *   node tools/gem-instructions.mjs            # escribe el documento
 *   node tools/gem-instructions.mjs --check    # falla si el documento se ha quedado viejo
 *
 * Ver wiki/ROADMAP_INGESTA_CAMPANAS_LIBROS.md (§4) · wiki/POR_HACER.md.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    buildGemInstructions, buildExamplePack, getSectionSchema, SECTION_ORDER,
    CAMPAIGN_PACK_VERSION, BOARD_LIMITS,
} from '../public/scripts/game-engine/campaign/campaign-pack-schema.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(root, 'wiki/GEM_CREAR_CAMPANA.md');
const CHECK = process.argv.includes('--check');

/** El día en que este documento nació; `updated` es el de la última generación. */
const CREATED = '2026-09-22';
const today = new Date().toISOString().slice(0, 10);

/**
 * Lo que el Gem tiene que saber antes del contrato: quién es, cómo trabaja y qué no hace.
 *
 * Escrito para el Gem, no para quien lo monta: es la parte que decide si devuelve un
 * paquete o una charla sobre el paquete.
 */
function gemPreamble() {
    return [
        '# Quién eres',
        '',
        'Eres el compilador de campañas de un juego de rol táctico: D&D 5e por casillas, con',
        'vínculos entre personajes al estilo Persona y escenarios con objetivos al estilo',
        'Gloomhaven. Conviertes un libro, un resumen o una idea en un **paquete de campaña**:',
        'JSON que un importador lee tal cual para crear el mundo, sus localidades, sus tableros,',
        'su gente, sus enemigos, sus objetos y sus misiones.',
        '',
        'Tu única salida útil es JSON válido que cumpla el contrato de más abajo. No inventas',
        'campos, no omites los obligatorios y no escribes identificadores: escribes **nombres**,',
        'y el importador los resuelve al crear las entradas.',
        '',
        '# Cómo trabajas',
        '',
        '1. El usuario te da el material. Si falta algo sin lo que no se puede empezar —el tono,',
        '   la escala, cuántos tableros quiere— preguntas **una vez**, en una sola línea, y sigues.',
        `2. Produces el paquete por secciones, en este orden: **${SECTION_ORDER.join(' → ')}**.`,
        '   Una sección por respuesta, cada una en un único bloque ```json. Antes del bloque, como',
        '   mucho una línea diciendo qué sección es. Nada después.',
        '3. Cada sección reutiliza **letra por letra** los nombres de las anteriores: la localidad',
        '   de un tablero, el enemigo colocado en una casilla, el compañero que protege un objetivo.',
        '   Un nombre que no coincide exactamente es un error de importación.',
        '4. Cuando el usuario diga **«ensambla»**, devuelves el paquete **completo** en un único',
        '   bloque ```json, sin comentarios ni texto alrededor. Es lo único que el juego acepta:',
        '   pega un solo objeto, no siete.',
        '5. Si el usuario te pega errores del validador, corriges **solo** lo señalado y devuelves',
        '   la sección o el paquete corregido **entero**, no un parche.',
        '6. Escribes en español, con sus tildes. Los nombres propios del libro se respetan.',
        '',
        '# Cuánto',
        '',
        '- Un libro entero: entre 4 y 8 tableros, 6 a 12 enemigos distintos, 3 a 6 compañeros,',
        '  una misión por tablero como mínimo. Una escena suelta: 1 a 3 tableros.',
        `- Cada tablero mide entre ${BOARD_LIMITS.minWidth}×${BOARD_LIMITS.minHeight} y`,
        `  ${BOARD_LIMITS.maxWidth}×${BOARD_LIMITS.maxHeight} casillas; 14×10 a 20×14 es lo que mejor se juega.`,
        '- Las descripciones son de una a tres frases. Lo que el modelo del juego lee en partida',
        '  es eso, así que cuentan lo que importa contar, no estadísticas.',
        '',
        '# Lo que no haces',
        '',
        '- No escribes `required`: existe `optional`, y significa lo contrario.',
        '- No dibujas mapas decorativos. Cada tablero se juega: pasillos por los que se pasa,',
        '  muros interiores que dan cobertura, puertas que abren salas, y ninguna sala aislada.',
        '- No inventas rarezas, perfiles tácticos ni tipos de objetivo fuera de los enumerados.',
        '- No dejas al grupo empezando sobre un muro, ni a un enemigo en una sala sin entrada.',
        '- No repites un nombre: el juego indexa por nombre y el segundo borraría al primero.',
        '',
    ].join('\n');
}

/** El bloque que va en la caja de instrucciones del Gem, entero. */
function instructionBlock() {
    return [
        gemPreamble(),
        buildGemInstructions(),
        '',
        '## Muestra de salida correcta',
        '',
        'Un paquete pequeño y completo. Dos tableros para que una misión apunte a uno, un',
        'objetivo de cada tipo incómodo y un compañero al que protege un objetivo: lo que un',
        'ejemplo fácil no enseña.',
        '',
        '```json',
        JSON.stringify(buildExamplePack(), null, 2),
        '```',
    ].join('\n');
}

/** Las secciones sueltas, para pedir una y comprobar que cumple la suya. */
function sectionBlocks() {
    return SECTION_ORDER.map(section => [
        `### \`${section}\``,
        '',
        '```json',
        JSON.stringify(getSectionSchema(section), null, 2),
        '```',
        '',
    ].join('\n')).join('\n');
}

function buildDocument() {
    return [
        '---',
        'title: Instrucciones para el Gem — el paquete de una campaña',
        'tags: [gem, gemini, campanas, importar, contrato, seeding]',
        `created: ${CREATED}`,
        `updated: ${today}`,
        'author: generado por tools/gem-instructions.mjs',
        '---',
        '',
        '# 🧠 El Gem que escribe campañas',
        '',
        `> **Generado desde el motor**, contrato versión ${CAMPAIGN_PACK_VERSION}. No lo edites a mano: si el motor cambia,`,
        '> ejecuta `node tools/gem-instructions.mjs` y vuelve a pegarlo en el Gem. Con `--check` avisa de',
        '> que se ha quedado viejo, y es una de las comprobaciones que se pasan antes de dar algo por hecho.',
        '',
        '> **Para qué**: un Gem de Gemini que, con un libro, un resumen o una idea, devuelve el JSON que',
        '> **Nueva campaña → Importar un libro** lee tal cual. Es el *seeding* de una campaña: el mundo entero',
        '> —localidades, tableros, gente, bichos, objetos y misiones— antes de la primera sesión.',
        '',
        '---',
        '',
        '## 1. Montar el Gem, en cinco minutos',
        '',
        '1. En Gemini, entra en **Gems** y crea uno nuevo.',
        '2. Nombre: *Compilador de campañas*. Descripción, si la pide: *Convierte libros en paquetes JSON para mi juego*.',
        '3. En **Instrucciones**, pega el bloque de la sección 2 **entero**, desde `# Quién eres` hasta el cierre de la muestra.',
        '4. Si la caja no admite tanto texto, deja en Instrucciones todo lo anterior a `## Esquema` y sube el resto',
        '   como archivo de conocimiento del Gem (o pégalo en tu primer mensaje). El Gem lo lee igual.',
        '5. Guarda. No hace falta nada más: el validador del juego es quien decide si lo que devuelve sirve.',
        '',
        '---',
        '',
        '## 2. Lo que va en la caja de instrucciones',
        '',
        'Copia desde la primera línea del bloque hasta la última.',
        '',
        '````markdown',
        instructionBlock(),
        '````',
        '',
        '---',
        '',
        '## 3. Cómo se usa, mensaje a mensaje',
        '',
        '| Paso | Tú | El Gem |',
        '| :--- | :--- | :--- |',
        '| 1 | Pegas el libro, un resumen largo o una idea, y dices *«Empieza por `world`»* | Devuelve `world` en un bloque JSON. Si le falta algo esencial, una pregunta y sigue |',
        `| 2 | *«Siguiente»*, sección a sección: ${SECTION_ORDER.slice(1).map(s => `\`${s}\``).join(' → ')} | Una por respuesta, reutilizando los nombres exactos de las anteriores |`,
        '| 3 | Lees cada una y corriges lo que no te guste **antes** de seguir: un nombre cambiado tarde arrastra a todo lo que lo usaba | Reescribe la sección entera |',
        '| 4 | *«Ensambla»* | El paquete completo en **un solo** bloque JSON. Es lo único que el juego acepta |',
        '| 5 | SillyTavern → **Partida nueva** → **Importar un libro** → pegas → **Comprobar el paquete** | — |',
        '| 6 | Si Comprobar señala errores, se los pegas tal cual | Corrige solo eso y devuelve el paquete entero |',
        '| 7 | Cuando pase: **Crear y jugar**, o **Crear y escribir el mundo** si quieres retocar algo en el editor antes | — |',
        '',
        'Dos cosas que ahorran vueltas:',
        '',
        '- **El validador no perdona, y eso es a favor.** Dice qué falta, qué sobra y qué reparó solo. Un paquete',
        '  que entra a medias sin avisar sería mucho peor que uno rechazado con la lista delante.',
        '- **Los nombres son la llave.** El Gem escribe *«Guardián del grano»* y el importador lo convierte en el',
        '  identificador que el motor usa. Si un tablero coloca a *«Guardian del grano»* sin tilde, no es el mismo.',
        '',
        '---',
        '',
        '## 4. Las secciones, de una en una',
        '',
        'Para pedirle una sección concreta o comprobar que cumple la suya. Son trozos del esquema completo',
        'que ya está en el bloque de instrucciones; se ofrecen sueltos porque un libro no cabe en una respuesta.',
        '',
        sectionBlocks(),
        '---',
        '',
        '## Enlaces',
        '',
        '- [[ROADMAP_INGESTA_CAMPANAS_LIBROS]] — por qué el contrato es como es: nombres dentro, ids fuera.',
        '- [[EMPEZAR_UNA_CAMPANA]] — dónde se pega lo que el Gem devuelve.',
        '- [[PLAN_CREAR_CAMPANA]] — el editor con el que se retoca después lo importado.',
        '- `/esquema-campana`, dentro del juego: las mismas vistas, siempre al día.',
        '',
    ].join('\n');
}

/** Lo que cambia por generar dos días distintos no cuenta como diferencia. */
function stable(text) {
    return String(text)
        .replace(/^updated: \d{4}-\d{2}-\d{2}$/m, 'updated: <fecha>')
        .replace(/Generado desde el motor el \d{4}-\d{2}-\d{2}/g, 'Generado desde el motor el <fecha>')
        .replace(/\r\n/g, '\n');
}

const document = buildDocument();

if (CHECK) {
    let current = '';
    try {
        current = readFileSync(OUT, 'utf8');
    } catch {
        console.log(`Falta ${OUT}. Ejecuta: node tools/gem-instructions.mjs`);
        process.exit(1);
    }
    if (stable(current) !== stable(document)) {
        console.log('wiki/GEM_CREAR_CAMPANA.md se ha quedado viejo respecto al motor.');
        console.log('Ejecuta: node tools/gem-instructions.mjs  (y vuelve a pegarlo en el Gem)');
        process.exit(1);
    }
    console.log(`wiki/GEM_CREAR_CAMPANA.md está al día con el contrato versión ${CAMPAIGN_PACK_VERSION}.`);
    process.exit(0);
}

writeFileSync(OUT, document, 'utf8');
console.log(`Escrito ${OUT}: ${document.length} caracteres, contrato versión ${CAMPAIGN_PACK_VERSION}, ${SECTION_ORDER.length} secciones.`);
