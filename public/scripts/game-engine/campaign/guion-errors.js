/**
 * Los errores del guion, dichos para quien lo escribe (idea 174).
 *
 * El conversor de guiones (`tools/guion-a-paquete.mjs`) paraba en el primer bloque roto con
 * el mensaje de la libreria de YAML, en ingles, y la linea donde *empezaba* el bloque. Y los
 * fallos del paquete salian como `locations[3].boards[0].map[5]`, que no dice en que ronda
 * mirar. Aqui se traduce todo a: archivo, linea, que pasa y como se arregla.
 *
 * Puro: recibe el error y el texto; devuelve lo que hay que decir.
 */

/** Las causas de siempre, en castellano llano. */
const CAUSES = [
    {
        test: /mapping values are not allowed/i,
        why: 'Hay dos puntos «:» dentro de un texto sin comillas.',
        fix: 'Pon ese texto entre comillas: nombre: "Arthur: el Doc".',
    },
    {
        // J5.9: con la librería `yaml` del navegador (la de `lib.js`), los mismos fallos se llaman
        // de otra forma; van detrás de las de `js-yaml`, en cada causa.
        test: /bad indentation|end of the stream or a document separator|Nested mappings are not allowed|All mapping items must start|BAD_INDENT|BLOCK_AS_IMPLICIT_KEY/i,
        why: 'La sangría no cuadra: esta línea no está alineada con las de su nivel.',
        fix: 'Alinea la línea con sus hermanas (mismos espacios; nunca tabuladores).',
    },
    {
        test: /tab characters must not be used|\\t|Tabs are not allowed|TAB_AS_INDENT/i,
        why: 'Hay un tabulador.',
        fix: 'Cambia el tabulador por espacios.',
    },
    {
        test: /duplicated mapping key|Map keys must be unique|DUPLICATE_KEY/i,
        why: 'La misma clave aparece dos veces en el mismo bloque.',
        fix: 'Deja una sola, o junta lo que dicen las dos.',
    },
    {
        test: /unexpected end of the stream|missed comma|flow collection|end with an? [\]}]|Missing closing|MISSING_CHAR/i,
        why: 'Una lista o un texto entre corchetes o comillas no se cierra.',
        fix: 'Busca el [ o la " que falta cerrar.',
    },
    {
        test: /incomplete explicit mapping pair|can not read a block mapping entry|Implicit keys need to be on a single line|Implicit map keys need to be followed|MULTILINE_IMPLICIT_KEY/i,
        why: 'Una línea suelta de prosa se ha colado dentro del bloque.',
        fix: 'Sácala del bloque (sin sangría) o conviértela en un campo: nota: "…".',
    },
];

/**
 * Un error de YAML, con su linea de verdad.
 *
 * @param {any} error El de `js-yaml` (trae `mark.line`, desde 0, relativo al bloque) o, J5.9, el
 *   de la librería `yaml` del navegador (trae `linePos[0].line`, desde 1, y su `code`).
 * @param {number} blockLine La linea del archivo donde empieza el bloque, desde 1.
 * @param {string[]} lines Las lineas del archivo.
 * @returns {{line: number, text: string, why: string, fix: string}}
 */
export function explainYamlError(error, blockLine, lines) {
    const fromYaml = Number(error?.linePos?.[0]?.line);
    const relative = Number.isFinite(Number(error?.mark?.line)) ? Number(error.mark.line)
        : Number.isFinite(fromYaml) && fromYaml >= 1 ? fromYaml - 1 : 0;
    const line = Math.max(1, Math.floor(Number(blockLine) || 1) + relative);
    // La de `yaml` dice «at line 3, column 11» contando desde el bloque: esa línea no es la del archivo.
    const message = String(error?.reason ?? error?.message ?? '').replace(/ at line \d+, column \d+:?/, '');
    const said = String(lines?.[line - 1] ?? '');
    // Lo mas comun con diferencia: un valor sin comillas que lleva «: » dentro. La libreria
    // lo llama de varias formas (sangria, mapping values...), asi que se mira la linea.
    const colon = /^\s*-?\s*[^\s:"'][^:"']*:\s+[^"'\s].*:\s/.test(said);
    const tested = `${message} ${String(error?.code ?? '')}`;
    const cause = colon ? CAUSES[0] : CAUSES.find(c => c.test.test(tested));
    return {
        line,
        text: String(lines?.[line - 1] ?? '').trim().slice(0, 120),
        why: cause?.why ?? `El YAML no se entiende (${message.split('\n')[0]}).`,
        fix: cause?.fix ?? 'Revisa comillas, dos puntos y sangría en esa línea y la de encima.',
    };
}

/**
 * Donde esta en el guion lo que el validador del paquete señala.
 *
 * @param {string} path Como lo da `validatePack`: `locations[3].boards[0].map[5]`.
 * @param {any} pack
 * @param {Map<string, string>} index De id o nombre (en minusculas) a `archivo:linea`.
 * @returns {string} `archivo:linea (nombre)`, o vacio si no se encuentra.
 */
export function locateIssue(path, pack, index) {
    const raw = String(path ?? '');
    // `boards.el-gran-salon`: la seccion y el id, sin indice.
    const byId = /^([A-Za-z]+)\.([^.[\]]+)/.exec(raw);
    if (byId && !/^\d+$/.test(byId[2])) {
        const found = index.get(byId[2].trim().toLowerCase());
        return found ? `${found} (${byId[2]})` : '';
    }
    const match = /^([A-Za-z]+)\[(\d+)\]/.exec(raw);
    if (!match) return '';
    const item = pack?.[match[1]]?.[Number(match[2])];
    if (!item) return '';
    for (const key of [item.id, item.name, item.title, item.nombre]) {
        const found = index.get(String(key ?? '').trim().toLowerCase());
        if (found) return `${found} (${String(item.name ?? item.title ?? item.id)})`;
    }
    return '';
}

/**
 * La linea de un fallo, lista para imprimir.
 *
 * @param {'ERROR'|'AVISO'} level
 * @param {{path: string, message: string}} issue
 * @param {string} where
 * @returns {string}
 */
export function describeIssue(level, issue, where) {
    return `${level}  ${where ? `${where} → ` : ''}${issue.message}${where ? '' : `  [${issue.path}]`}`;
}
