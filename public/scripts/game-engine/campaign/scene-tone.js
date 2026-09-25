/**
 * El tono de la escena: tensa, cómica, sombría o épica, en un bloque del prompt (idea 142).
 *
 * El narrador contaba igual una pelea a vida o muerte que una borrachera en la posada.
 * Ahora la escena tiene un tono, y el tono es una frase corta al final del prompt:
 *
 * - **Automático** (lo de siempre): en combate, tenso; fuera, sin nada.
 * - O el que se elija en la pausa, que manda hasta que se cambie.
 *
 * Una frase y no un párrafo: cambia con la escena, así que va con lo que cambia en cada
 * turno, y todo lo que va ahí se paga en cada turno.
 *
 * Puro: dice qué tono toca y qué se le dice al narrador.
 */

/** Los tonos, con lo que se le dice al narrador. */
export const TONES = {
    auto: { label: 'Automático', note: '' },
    tensa: { label: 'Tenso', note: 'Tono de la escena: tenso. Frases cortas, el peligro cerca, nada de chistes.' },
    comica: { label: 'Cómico', note: 'Tono de la escena: cómico. Se puede reír, sin romper el mundo ni sus reglas.' },
    sombria: { label: 'Sombrío', note: 'Tono de la escena: sombrío. Pesa lo perdido; poca luz y pocas palabras amables.' },
    epica: { label: 'Épico', note: 'Tono de la escena: épico. Lo que se hace aquí se contará después.' },
};

/** El orden en que se cambian desde la pausa. */
export const TONE_ORDER = ['auto', 'tensa', 'comica', 'sombria', 'epica'];

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim().toLowerCase();

/**
 * @param {any} value
 * @returns {string}
 */
export function readTone(value) {
    const id = text(value);
    return id in TONES ? id : 'auto';
}

/**
 * El siguiente, para el botón de la pausa.
 *
 * @param {any} value
 * @returns {string}
 */
export function nextTone(value) {
    const at = TONE_ORDER.indexOf(readTone(value));
    return TONE_ORDER[(at + 1) % TONE_ORDER.length];
}

/**
 * El tono que toca ahora.
 *
 * @param {{chosen?: string, fighting?: boolean}} input
 * @returns {string} Un id de `TONES` que no es `auto`, o vacío si no toca ninguno.
 */
export function toneNow({ chosen = 'auto', fighting = false }) {
    const picked = readTone(chosen);
    if (picked !== 'auto') return picked;
    return fighting ? 'tensa' : '';
}

/**
 * Lo que se le dice al narrador: nada si no toca ningún tono.
 *
 * @param {{chosen?: string, fighting?: boolean}} input
 * @returns {string}
 */
export function toneNote(input) {
    const tone = toneNow(input);
    return tone ? TONES[/** @type {keyof typeof TONES} */ (tone)].note : '';
}

/**
 * Para el botón: «Tono: automático».
 *
 * @param {any} value
 * @returns {string}
 */
export function describeTone(value) {
    return `Tono: ${TONES[/** @type {keyof typeof TONES} */ (readTone(value))].label.toLowerCase()}`;
}
