/**
 * Quién habla en cada párrafo del narrador, para ponerle cara (idea 145).
 *
 * En una escena con tres personas, el narrador escribe «—No pienso pagar —dice Giles» y
 * quien lee tiene que buscar el nombre al final de la frase. Ahora, cuando un párrafo es
 * de alguien conocido (la gente del mundo y el grupo), lleva delante su retrato, o sus
 * iniciales en un color que es siempre el mismo para esa persona.
 *
 * Solo se mira lo que el texto ya dice: `Giles:` al empezar, «—dice Giles», «Giles dice:».
 * Un nombre suelto en mitad de la frase no es alguien hablando.
 *
 * Puro: dice quién habla y cómo se dibuja su insignia. No toca el mensaje: lo que se
 * dibuja va encima, y el texto que lee el modelo sigue siendo el mismo.
 */

/** Los verbos con los que se da la palabra en castellano. */
const SAYS = 'dice|dijo|responde|respondió|contesta|contestó|pregunta|preguntó|grita|gritó|susurra|susurró|murmura|murmuró|añade|añadió|replica|replicó|gruñe|gruñó|masculla|musita|insiste|ríe|suspira';

/** Lo que no cuenta para las iniciales. */
const PARTICLES = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'maese', 'lord', 'lady', 'hermano', 'hermana', 'don', 'doña', 'sir']);

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {string} value @returns {string} */
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Quién habla en un párrafo, o vacío si no se sabe.
 *
 * @param {string} paragraph
 * @param {string[]} names Los que pueden hablar.
 * @returns {string}
 */
export function speakerOf(paragraph, names) {
    const said = text(paragraph).replace(/\*+/g, '');
    if (!said) return '';
    const known = [...new Set((Array.isArray(names) ? names : []).map(text).filter(n => n.length >= 2))]
        .sort((a, b) => b.length - a.length);
    for (const name of known) {
        const n = escape(name);
        const edge = '(?![\\p{L}\\p{N}])';
        const patterns = [
            new RegExp(`^${n}${edge}\\s*:`, 'u'),
            new RegExp(`[—–-]\\s*(?:${SAYS})\\s+${n}${edge}`, 'u'),
            new RegExp(`[»”"]\\s*,?\\s*(?:${SAYS})\\s+${n}${edge}`, 'u'),
            new RegExp(`^${n}${edge}\\s+(?:${SAYS})\\s*:`, 'u'),
        ];
        if (patterns.some(p => p.test(said))) return name;
    }
    return '';
}

/**
 * Las iniciales de alguien: «Oswald el Senescal» → «OS».
 *
 * @param {string} name
 * @returns {string}
 */
export function initialsOf(name) {
    const words = text(name).split(/\s+/).filter(w => w && !PARTICLES.has(w.toLowerCase()));
    const letters = (words.length > 0 ? words : text(name).split(/\s+/)).slice(0, 2).map(w => w[0] ?? '');
    return letters.join('').toUpperCase() || '?';
}

/**
 * El color de alguien: siempre el mismo para el mismo nombre.
 *
 * @param {string} name
 * @returns {number} Un tono de 0 a 359.
 */
export function hueOf(name) {
    let hash = 0;
    for (const char of text(name).toLowerCase()) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 360;
    return hash;
}
