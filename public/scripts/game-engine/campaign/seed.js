/**
 * La semilla de un mundo: lo que hace que dos campanas de la misma idea no se parezcan.
 *
 * La regla, y es una sola:
 *
 * > **La semilla no es el texto.** Se tira al crear la campana y se guarda con ella. Lo
 * > que escribes es un *sesgo*, no un identificador.
 *
 * Sin esto, «una cripta inundada» daba siempre la misma cripta, porque lo unico de donde
 * se podia sacar el azar era el nombre del mundo. Con esto, cada campana trae la suya y
 * **sigue siendo reproducible**: la tuya vuelve exacta siempre que la abras, y la de otro
 * se puede jugar escribiendo su semilla.
 *
 * Se escribe en palabras y no en numeros a proposito. `molino-ceniza-siete` se dicta por
 * telefono, se apunta en un papel y se reconoce de un vistazo; `1749302811` no.
 *
 * Y las semillas **derivadas** existen para que tocar una cosa no mueva las demas: el
 * boton de forjar y el de criar tiran del mismo mundo y de bolsas distintas. Un solo
 * flujo global significa que regenerar el botin te cambia el mapa.
 *
 * Puro. Ver wiki/ALGORITMOS_GENERACION.md (#1-#12).
 */

/**
 * De donde salen las semillas legibles.
 *
 * Palabras cortas, sin acentos y sin ene: una semilla se teclea, y un caracter que
 * obligue a buscar en el teclado es una semilla que nadie comparte.
 */
export const SEED_WORDS = [
    'molino', 'ceniza', 'vado', 'cuervo', 'sal', 'hiel', 'sauce', 'yunque',
    'niebla', 'espino', 'roble', 'zorro', 'lobo', 'junco', 'losa', 'arena',
    'cripta', 'puente', 'pozo', 'torre', 'ermita', 'soto', 'cruce', 'alto',
    'hierro', 'plata', 'hueso', 'cuerno', 'piedra', 'ambar', 'bronce', 'estano',
    'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho',
    'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'veinte',
    'norte', 'sur', 'este', 'oeste', 'invierno', 'otono', 'verano', 'lluvia',
    'humo', 'brasa', 'raiz', 'rama', 'cuenca', 'quebrada', 'majada', 'talud',
];

/** Cuantas palabras lleva una semilla. Tres dan mas de un cuarto de millon. */
export const SEED_LENGTH = 3;

/**
 * @param {any} value
 * @returns {string}
 */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * Una semilla nueva.
 *
 * Se **tira**: no sale del nombre ni de la idea. Eso es lo que hace que escribir dos veces
 * «una cripta inundada» de dos criptas distintas.
 *
 * @param {() => number} [random]
 * @returns {string}
 */
export function rollSeed(random = Math.random) {
    /** @type {string[]} */
    const parts = [];
    for (let i = 0; i < SEED_LENGTH; i++) {
        const at = Math.floor(random() * SEED_WORDS.length) % SEED_WORDS.length;
        parts.push(SEED_WORDS[at]);
    }
    return parts.join('-');
}

/**
 * Deja una semilla como se guarda: minusculas, guiones y nada raro.
 *
 * Se acepta lo que escriba quien la teclee —mayusculas, espacios, un punto al final— y se
 * guarda de una sola forma. Dos semillas que solo se diferencian en un espacio serian dos
 * mundos distintos, y nadie entenderia por que.
 *
 * @param {string} value
 * @returns {string}
 */
export function cleanSeed(value) {
    return text(value)
        .toLowerCase()
        .replace(/[\s_]+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

/**
 * La semilla de un mundo, o cadena vacia si todavia no tiene.
 *
 * Vacio importa: un mundo sin semilla guardada **no es reproducible**, y quien llama tiene
 * que decidir si le pone una o tira con lo que haya.
 *
 * @param {any} metadata
 * @returns {string}
 */
export function seedOf(metadata) {
    return cleanSeed(metadata?.seed);
}

/**
 * Le pone semilla a un mundo que no la tenga, y respeta la que ya tenga.
 *
 * No se sobrescribe nunca: cambiarle la semilla a una campana empezada haria que lo que
 * se genere a partir de ahora no pegue con lo que ya se genero.
 *
 * @param {any} metadata
 * @param {{seed?: string, random?: () => number}} [options]
 * @returns {{metadata: any, seed: string, rolled: boolean}}
 */
export function ensureSeed(metadata, options = {}) {
    const source = (metadata && typeof metadata === 'object') ? metadata : {};
    const already = seedOf(source);
    if (already) return { metadata: source, seed: already, rolled: false };

    const asked = cleanSeed(options.seed);
    const seed = asked || rollSeed(options.random ?? Math.random);
    return { metadata: { ...source, seed }, seed, rolled: !asked };
}

/**
 * Una semilla derivada, para que cada cosa tire de su bolsa.
 *
 * `derive(seed, 'botin', 'sala7')` y `derive(seed, 'nombres', 3)` salen del mismo mundo y
 * no se pisan: regenerar el botin no te cambia los nombres. El formato es el contrato, y
 * por eso esta aqui y no repetido en cada sitio que lo usa.
 *
 * @param {string} seed
 * @param {...(string|number)} parts
 * @returns {string}
 */
export function derive(seed, ...parts) {
    return [cleanSeed(seed) || 'sin-semilla', ...parts.map(part => text(part))]
        .filter(Boolean)
        .join('|');
}

/**
 * La semilla en una linea, para ensenarla.
 *
 * @param {string} seed
 * @returns {string}
 */
export function describeSeed(seed) {
    const clean = cleanSeed(seed);
    return clean ? `Semilla del mundo: ${clean}` : 'Este mundo no tiene semilla guardada.';
}
