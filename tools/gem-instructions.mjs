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
 * J5.5 de ROADMAP_SIN_CONEXION: explica las dos formas de escribir una campaña (la corta, con
 * solo la historia y las misiones, y la completa) y los dos formatos que el tablón del gremio lee
 * (el de tu Gem, con su cabecera y sus marcas, y el del juego).
 *
 * Los Gems al día (2026-10-02): dos archivos.
 * - `wiki/GEM_CREAR_CAMPANA.md`: cómo montar el Gem y, en su sección 3, **las instrucciones
 *   cortas** para la caja del Gem: quién es, cómo trabaja, cómo se escribe hoy (las reglas de
 *   `gem-guide.js`: conversaciones, presentaciones, grupo de 4, facciones como reputación, plazos
 *   apagados y aspecto, cada una con su ejemplo bueno y malo), el formato en resumen (los campos
 *   de cada sección, sacados del esquema) y una muestra corta.
 * - `wiki/GEM_CREAR_CAMPANA_ANEXO.md`: **el anexo**, para subir como archivo de conocimiento: el
 *   contrato entero, las reglas que el esquema no ve y las muestras largas (un paquete completo,
 *   un compañero con romance y misión personal, un tablero por salas).
 *
 * Uso:
 *   node tools/gem-instructions.mjs            # escribe los dos documentos
 *   node tools/gem-instructions.mjs --check    # falla si alguno se ha quedado viejo
 *
 * Ver wiki/archivo/ROADMAP_INGESTA_CAMPANAS_LIBROS.md (§4) · wiki/GEM_COMO_HACER_CAMPANA.md.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    buildGemInstructions, buildExamplePack, getSectionSchema, SECTION_ORDER,
    CAMPAIGN_PACK_VERSION, BOARD_LIMITS,
} from '../public/scripts/game-engine/campaign/campaign-pack-schema.js';
import { buildRoomsExampleBoard } from '../public/scripts/game-engine/campaign/pack-fill.js';
import { SPELLS, CIRCLE_LABELS } from '../public/scripts/game-engine/rules/grimoire.js';
import {
    writingRulesText, buildConversationSamplePack, buildCompanionSample,
} from '../public/scripts/game-engine/campaign/gem-guide.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(root, 'wiki/GEM_CREAR_CAMPANA.md');
const ANNEX = resolve(root, 'wiki/GEM_CREAR_CAMPANA_ANEXO.md');
const CHECK = process.argv.includes('--check');

/** El día en que este documento nació; `updated` es el de la última generación. */
const CREATED = '2026-09-22';
const today = new Date().toISOString().slice(0, 10);

/**
 * Lo que el Gem tiene que saber antes que nada: quién es, cómo trabaja y cuánto escribe.
 *
 * Escrito para el Gem, no para quien lo monta: es la parte que decide si devuelve un
 * paquete o una charla sobre el paquete.
 */
function gemPreamble() {
    return [
        '# Quién eres',
        '',
        'Eres el compilador de campañas de un juego de rol táctico en castellano: D&D 5e por casillas,',
        'con vínculos entre compañeros al estilo Persona, y una historia que se cuenta como una novela',
        'visual, con retratos, al estilo Etrian Odyssey. Conviertes un libro, un resumen o una idea en un',
        '**paquete de campaña**: JSON que el juego lee tal cual para crear el mundo, sus localizaciones,',
        'su gente, sus misiones y su historia.',
        '',
        'Tu única salida útil es JSON válido que cumpla el contrato. **El contrato entero y las muestras',
        'largas están en tu archivo de conocimiento, `GEM_CREAR_CAMPANA_ANEXO.md`**: míralo antes de',
        'escribir una sección que no domines (los tableros, las charlas, el hilo, los romances, las',
        'misiones personales). No inventas campos, no omites los obligatorios y no escribes',
        'identificadores internos: escribes **nombres**, y el juego los resuelve.',
        '',
        '# Cómo trabajas',
        '',
        '1. El usuario te da el material. Si falta algo sin lo que no se puede empezar (el tono, la escala),',
        '   preguntas **una vez**, en una sola línea, y sigues.',
        `2. Produces el paquete por secciones, en este orden: **${SECTION_ORDER.join(' → ')}**.`,
        '   Una sección por respuesta, en un único bloque ```json. Antes del bloque, como mucho una línea',
        '   diciendo qué sección es. Nada después.',
        '3. Cada sección reutiliza **letra por letra** los nombres de las anteriores. Un nombre que no',
        '   coincide exactamente («Guardian» sin tilde) es otra persona, otro sitio u otro bicho.',
        '4. Cuando el usuario diga **«ensambla»**, devuelves el paquete **completo** en un único bloque',
        '   ```json, sin nada alrededor. Es lo único que el juego acepta.',
        '5. Si el usuario te pega el informe del juego («Copiar la lista para tu Gem»), corriges **solo**',
        '   lo señalado y devuelves el paquete **entero**, no un parche.',
        '6. Si el usuario te pega **piezas del guionista** (otro Gem: escenas en `beats`, charlas, escenas de',
        '   vínculo, romances, misiones personales), las pones en su sitio del paquete sin cambiarles el texto',
        '   y devuelves la sección entera que las lleva. Si una nombra a alguien o algo que no existe, lo dices.',
        '7. Español de España, con sus tildes. Los nombres propios del libro se respetan; el texto va en',
        '   tus palabras: nunca copies frases del libro.',
        '',
        '# Dos formas',
        '',
        '- **La corta**: `world`, `locations`, `npcs`, `quests` y `plot` (y, si quieres, `confidants` y',
        '  `dialogues`), sin tableros ni bestiario. Cada misión dice dónde se juega (`locationName`) y',
        '  contra quién (`enemies`). El juego dibuja el tablero y pone los bichos de su bestiario si se',
        '  llaman igual (Lobo, Bandido, Arquero, Esqueleto, Zombi, Cultista, Trasgo, Ogro…). Para una idea',
        '  o un resumen.',
        '- **La completa**: todo, con los tableros dibujados y un bestiario propio. Para un libro o un',
        '  módulo. Lo que dejes sin escribir lo pone el juego, igual que en la corta.',
        '',
        '# Cuánto',
        '',
        '- Un libro entero: 4 a 8 tableros, 6 a 12 enemigos distintos, 3 a 6 compañeros y una misión por',
        '  tablero como mínimo. Una escena suelta: 1 a 3 tableros.',
        '- Las peleas, para un grupo de 4 (el héroe y tres compañeros).',
        `- Cada tablero mide entre ${BOARD_LIMITS.minWidth}×${BOARD_LIMITS.minHeight} y ${BOARD_LIMITS.maxWidth}×${BOARD_LIMITS.maxHeight} casillas; 14×10 a 20×14 es lo que mejor se juega.`,
        '- Una escena importante: de 3 a 8 líneas, con una o dos decisiones. Cada línea, de una a tres frases.',
        '',
    ].join('\n');
}

/**
 * Los campos de una parte del esquema, en una línea: los obligatorios con asterisco.
 *
 * @param {any} schema Un objeto del esquema (con `properties`).
 * @param {string[]} [skip] Los que se cuentan aparte.
 * @returns {string}
 */
function fieldsOf(schema, skip = []) {
    const required = new Set(schema?.required ?? []);
    return Object.keys(schema?.properties ?? {})
        .filter(key => !skip.includes(key))
        .map(key => (required.has(key) ? `\`${key}\`*` : `\`${key}\``))
        .join(', ');
}

/**
 * El formato en resumen, sacado del esquema: cada sección con sus campos, y lo de dentro que
 * más se escribe (las líneas de una escena, los nudos de una charla). Lo largo, en el anexo.
 */
function formatSummary() {
    const item = (/** @type {string} */ section) => {
        const schema = getSectionSchema(section);
        return schema?.type === 'array' ? schema.items : schema;
    };
    const plot = getSectionSchema('plot');
    const milestone = plot.properties.milestones.items;
    const beat = milestone.properties.beats.items;
    const talk = item('dialogues');
    const node = talk.properties.nodes.items;
    const option = node.properties.options.items;
    const lines = SECTION_ORDER.map(section => {
        if (section === 'plot') return `- \`plot\`: ${fieldsOf(plot)}`;
        if (section === 'dialogues') return `- \`dialogues\` (una charla por objeto): ${fieldsOf(talk)}`;
        return `- \`${section}\`: ${fieldsOf(item(section))}`;
    });
    return [
        '# El formato, en resumen',
        '',
        'Con asterisco, lo obligatorio. El esquema entero, con lo que significa cada campo, está en el anexo.',
        '',
        `- El paquete: \`version\`* (${CAMPAIGN_PACK_VERSION}) y las secciones.`,
        ...lines,
        `- Un hito de \`plot.milestones\`: ${fieldsOf(milestone)}`,
        `- Una línea de \`beats\` (la conversación): ${fieldsOf(beat)}`,
        `- Un nudo de una charla: ${fieldsOf(node)}`,
        `- Una opción de un nudo: ${fieldsOf(option)}`,
        '- Las caras (`mood`): `neutral`, `alegre`, `enfadado`, `triste`.',
        '- El `romance` y la `misionPersonal` de un compañero: mira la muestra del anexo y cópiale la forma.',
        '',
    ].join('\n');
}

/** Lo que nunca hace: corto, porque lo largo ya está en las reglas. */
function gemDonts() {
    return [
        '# Lo que no haces',
        '',
        '- No escribes `required` en un objetivo: existe `optional`, y significa lo contrario.',
        '- No cuentas la historia con el narrador: si alguien está en la escena, lo dice él.',
        '- No nombras a nadie antes de que se presente, ni en el título del hito.',
        '- No escribes relojes de facción, sitios que cambian de manos ni precios por facción.',
        '- No haces que la historia dependa de un plazo.',
        '- No dibujas mapas decorativos: cada tablero se juega, sin salas aisladas ni el grupo sobre un muro.',
        '- No inventas el mapa de un dibujo que no ves: con una imagen, escribe su `image` y su `grid` y deja `map` fuera.',
        '- No inventas magia: los conjuros son los del grimorio del juego, por su id.',
        '- No repites un nombre: el segundo borraría al primero.',
        '- No escribes acertijos ni presagios crípticos.',
        '',
    ].join('\n');
}

/** El bloque que va en la caja de instrucciones del Gem, entero. */
function compactBlock() {
    return [
        gemPreamble(),
        '# Cómo se escribe hoy',
        '',
        'Estas reglas mandan sobre cualquier costumbre tuya. Cada una con un ejemplo de cómo no y de cómo sí.',
        '',
        writingRulesText(),
        '',
        formatSummary(),
        gemDonts(),
        '# Muestra: una campaña corta bien escrita',
        '',
        'Conversaciones con su cara, gente que se presenta, el aspecto de cada uno, una charla con ramas',
        'y una reacción a lo que eligió quien juega. Sin tableros ni bestiario: los pone el juego.',
        '',
        '```json',
        JSON.stringify(buildConversationSamplePack(), null, 1),
        '```',
    ].join('\n');
}

/** El anexo: lo que se sube como archivo de conocimiento del Gem. */
function buildAnnex() {
    return [
        '---',
        'title: Anexo del Gem de campañas — el contrato entero y las muestras largas',
        'tags: [gem, gemini, campanas, contrato, anexo]',
        'created: 2026-10-02',
        `updated: ${today}`,
        'author: generado por tools/gem-instructions.mjs',
        '---',
        '',
        '# Anexo: el contrato del paquete de campaña',
        '',
        `> **Generado desde el motor**, contrato versión ${CAMPAIGN_PACK_VERSION}. No lo edites a mano: ejecuta`,
        '> `node tools/gem-instructions.mjs`. Se sube **entero** al Gem como archivo de conocimiento; las',
        '> instrucciones cortas de [[GEM_CREAR_CAMPANA]] le dicen cuándo mirarlo.',
        '',
        'Para el Gem: esto es la referencia. Las reglas de cómo se escribe (conversaciones, presentaciones,',
        'grupo de 4, facciones como reputación, plazos apagados, aspecto) están en tus instrucciones y',
        'mandan sobre cualquier cosa de aquí.',
        '',
        buildGemInstructions(),
        '',
        '## Muestra de un paquete completo',
        '',
        'Pequeño y completo: dos tableros para que una misión apunte a uno, un objetivo de cada tipo',
        'incómodo, un compañero al que protege un objetivo y una charla con ramas.',
        '',
        '```json',
        JSON.stringify(buildExamplePack(), null, 2),
        '```',
        '',
        '## Muestra de un compañero con romance y misión personal',
        '',
        'Va en `confidants`. El romance: tres citas (`cita` con `step` 1, 2 y 3), la noche (`final`, con una',
        'respuesta `fade`: fundido a negro, nada explícito), frases de pareja y su epílogo. En cada escena,',
        '`note` es lo que se ve (una línea corta, sin nombre) y `say` lo que dice. La misión personal: un',
        'viaje, una conversación con una decisión, una pelea y sus dos finales; cada `routes` lleva a un paso',
        'que existe y desde `start` se llega a los dos finales.',
        '',
        '```json',
        JSON.stringify(buildCompanionSample(), null, 2),
        '```',
        '',
        '## Muestra de un tablero por salas',
        '',
        'Como lo cuenta un módulo: quién espera en cada sala (`enemies`), qué tesoro guarda (`treasure`) y sus',
        'trampas (`traps`). El juego pone a cada uno en su sala (tras una puerta cerrada, duermen hasta que se',
        'abre) y el tesoro en un cofre. No hace falta repetir a los de las salas en `enemies` del tablero.',
        '',
        '```json',
        JSON.stringify(buildRoomsExampleBoard(), null, 2),
        '```',
        '',
        '## Los conjuros del grimorio',
        '',
        'La magia solo existe aquí. En `spells` (un héroe) y en `abilities` (un bicho) se nombran por su id; no se',
        'inventa ninguno. Los trucos son a voluntad; los de círculo gastan cargas.',
        '',
        ...[0, 1, 2, 3].map(circle => `- **${CIRCLE_LABELS[circle]}**: ${SPELLS.filter(s => s.circle === circle).map(s => `\`${s.id}\` (${s.name}${s.classes?.length ? `, ${s.classes.join(' o ')}` : ''})`).join(', ')}.`),
        '',
    ].join('\n');
}

function buildDocument() {
    const compact = compactBlock();
    const annexSize = buildAnnex().length;
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
        '> **Añadir una campaña**, en el tablón del gremio, lee tal cual. El proceso entero, paso a paso, está en',
        '> [[GEM_COMO_HACER_CAMPANA]]; las escenas y los diálogos los escribe el otro Gem, [[GEM_GUIONISTA]].',
        '',
        '---',
        '',
        '## 0. Qué va dónde',
        '',
        '| Qué | Dónde va | Tamaño |',
        '| :--- | :--- | :--- |',
        `| **Las instrucciones cortas** (la sección 3 de este documento) | En la caja **Instrucciones** del Gem, enteras | ${Math.round(compact.length / 1000)} mil caracteres |`,
        `| **El anexo**: \`wiki/GEM_CREAR_CAMPANA_ANEXO.md\` | Se sube **tal cual** como archivo de conocimiento del Gem | ${Math.round(annexSize / 1000)} mil caracteres |`,
        '',
        'Las instrucciones cortas dicen quién es el Gem, cómo trabaja, **cómo se escribe hoy** (las reglas de',
        'las conversaciones, las presentaciones, el grupo de 4, las facciones, los plazos y el aspecto, cada una',
        'con su ejemplo) y el formato en resumen, con una muestra corta. El anexo es la referencia: el contrato',
        'entero y las muestras largas. El Gem lo mira cuando le hace falta.',
        '',
        '---',
        '',
        '## 1. Montar el Gem, en cinco minutos',
        '',
        '1. En Gemini, entra en **Gems** y crea uno nuevo (o abre el que ya tienes y cámbiale lo de dentro).',
        '2. Nombre: *Compilador de campañas*. Descripción, si la pide: *Convierte libros en paquetes JSON para mi juego*.',
        '3. En **Instrucciones**, borra lo que hubiera y pega el bloque de la sección 3 **entero**, desde `# Quién eres` hasta el cierre de la muestra.',
        '4. En **Conocimiento**, sube `wiki/GEM_CREAR_CAMPANA_ANEXO.md` (si ya había uno, quítalo antes: tiene que ser el nuevo).',
        '5. Guarda. No hace falta nada más: el tablón del gremio es quien decide si lo que devuelve sirve.',
        '',
        'Cada vez que cambie el juego, este documento y el anexo se regeneran solos: repite los pasos 3 y 4.',
        '',
        '---',
        '',
        '## 2. Dos formas y dos formatos',
        '',
        'El tablón del gremio lee cualquiera de las cuatro combinaciones. Lo que falte lo pone el juego con la',
        'semilla de la campaña, y al añadirla te dice qué ha puesto.',
        '',
        '| | Qué es | Cuándo |',
        '| :--- | :--- | :--- |',
        '| **La corta** | `world`, `locations`, `npcs`, `quests` y `plot`, sin tableros ni bestiario. El juego pone los tableros, los bichos, las descripciones y un final | Una idea, un resumen o un libro sin mapas. Se juega entera igual |',
        '| **La completa** | El paquete entero, sección a sección: tableros dibujados, bestiario, gente, charlas, escenas, romances | Un libro o un módulo con sus mapas y sus salas |',
        '| **Tu formato** | Lo que devuelve tu Gem tal cual, como `wiki/campanas/strahd/original.json`: con la cabecera del esquema (`$schema`, `title`, `description`), las marcas `[cite: N]` y cada camino escrito en un solo sentido | Lo normal: se pega o se sube así, y el juego lo pone en limpio |',
        '| **El del juego** | El paquete en limpio, como `public/mundos/strahd.pack.json`: sin cabecera ni marcas, y con los caminos de ida y de vuelta | Lo que guarda el juego al añadirla, y lo que junta `tools/campana-a-paquete.mjs` para Strahd |',
        '',
        'Lo que el juego pone si falta (y lo dice al añadirla): el tablero de cada misión, los bichos de su bestiario',
        'si se llaman igual, las descripciones, la historia (con las misiones en varios actos, una detrás de otra) y',
        'un final. Antes de añadirla puedes comprobarla con `node tools/check-world-density.mjs tu-campana.json`; con',
        '`--gem`, la lista para pegársela a tu Gem.',
        '',
        '---',
        '',
        '## 3. Las instrucciones cortas: lo que va en la caja del Gem',
        '',
        'Copia desde la primera línea del bloque hasta la última.',
        '',
        '````markdown',
        compact,
        '````',
        '',
        '---',
        '',
        '## 4. Cómo se usa, mensaje a mensaje',
        '',
        '| Paso | Tú | El Gem |',
        '| :--- | :--- | :--- |',
        '| 1 | Pegas el libro, un resumen largo o una idea, y dices *«Empieza por `world`»*. Para la corta: *«Hazla corta»* | Devuelve `world` en un bloque JSON. Si le falta algo esencial, una pregunta y sigue |',
        `| 2 | *«Siguiente»*, sección a sección: ${SECTION_ORDER.slice(1).map(s => `\`${s}\``).join(' → ')} | Una por respuesta, reutilizando los nombres exactos de las anteriores |`,
        '| 3 | Lees cada una y corriges lo que no te guste **antes** de seguir: un nombre cambiado tarde arrastra a todo lo que lo usaba | Reescribe la sección entera |',
        '| 4 | *«Ensambla»* | El paquete completo en **un solo** bloque JSON |',
        '| 5 | **Jugar sin conexión** → el gremio → **Tablón de campañas** → **Añadir una campaña**: eliges el archivo, o **Pegar el texto de una campaña** | — |',
        '| 6 | El tablón la comprueba antes de guardarla. Si algo lo impide, **Copiar la lista para tu Gem** y se la pegas | Corrige solo eso y devuelve el paquete entero |',
        '| 7 | Cuando entra, su tarjeta sale en el tablón: se empieza pulsándola. Si la añades otra vez, se pone al día | — |',
        '',
        'Dos cosas que ahorran vueltas:',
        '',
        '- **El validador no perdona, y eso es a favor.** Dice qué falta, qué sobra y qué reparó solo. Un paquete',
        '  que entra a medias sin avisar sería mucho peor que uno rechazado con la lista delante.',
        '- **Los nombres son la llave.** El Gem escribe *«Guardián del grano»* y el juego lo convierte en el',
        '  identificador que usa. Si un tablero coloca a *«Guardian del grano»* sin tilde, no es el mismo.',
        '',
        '---',
        '',
        '## Enlaces',
        '',
        '- [[GEM_COMO_HACER_CAMPANA]] — el proceso entero: qué Gem hace qué, qué se pega dónde, los retratos.',
        '- [[GEM_GUIONISTA]] — el otro Gem: las conversaciones, las charlas, los romances y las misiones personales.',
        '- [[ROADMAP_INGESTA_CAMPANAS_LIBROS]] — por qué el contrato es como es: nombres dentro, ids fuera.',
        '- [[EMPEZAR_UNA_CAMPANA]] — dónde se pega lo que el Gem devuelve.',
        '- `/esquema-campana`, dentro del juego: el contrato, siempre al día.',
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
const annex = buildAnnex();
const outputs = [[OUT, document, 'wiki/GEM_CREAR_CAMPANA.md'], [ANNEX, annex, 'wiki/GEM_CREAR_CAMPANA_ANEXO.md']];

if (CHECK) {
    let stale = 0;
    for (const [path, content, name] of outputs) {
        let current = '';
        try {
            current = readFileSync(path, 'utf8');
        } catch {
            console.log(`Falta ${name}. Ejecuta: node tools/gem-instructions.mjs`);
            stale++;
            continue;
        }
        if (stable(current) !== stable(content)) {
            console.log(`${name} se ha quedado viejo respecto al motor.`);
            stale++;
        }
    }
    if (stale > 0) {
        console.log('Ejecuta: node tools/gem-instructions.mjs  (y vuelve a ponerlos en el Gem)');
        process.exit(1);
    }
    console.log(`wiki/GEM_CREAR_CAMPANA.md y su anexo están al día con el contrato versión ${CAMPAIGN_PACK_VERSION}.`);
    process.exit(0);
}

for (const [path, content] of outputs) writeFileSync(path, content, 'utf8');
console.log(`Escrito ${OUT}: ${document.length} caracteres (las instrucciones cortas, ${compactBlock().length}).`);
console.log(`Escrito ${ANNEX}: ${annex.length} caracteres, contrato versión ${CAMPAIGN_PACK_VERSION}, ${SECTION_ORDER.length} secciones.`);
