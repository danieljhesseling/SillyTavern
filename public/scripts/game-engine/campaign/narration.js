/**
 * Cuánto se extiende el narrador, y el modo ahorro (ideas 149 y 148), desde la partida.
 *
 * - **El largo** se elige en el taller al crear al narrador, y queda escrito en su ficha. Aquí
 *   se puede cambiar sin volver al taller: una línea corta al final del prompt, que manda
 *   sobre lo de la ficha mientras esté puesta.
 * - **El modo ahorro** recorta lo que el juego añade al prompt (la memoria del mundo, a lo
 *   justo; el estado del grupo, fuera). Para quien juega con el contador de tokens delante.
 *
 * Puro: qué dice cada opción.
 */

/** Los largos, con la nota que recibe el narrador. `''` es «lo de su ficha». */
export const LENGTHS = {
    ficha: { label: 'Lo de su ficha', note: '' },
    breve: { label: 'Breve', note: '[LARGO] Responde en un párrafo corto: lo que pasa y lo que se ve, sin adornos.' },
    normal: { label: 'Normal', note: '[LARGO] Responde en dos o tres párrafos.' },
    extenso: { label: 'Extenso', note: '[LARGO] Tómate tu tiempo: cuatro o cinco párrafos, con detalle y voces.' },
};

/**
 * La nota de un largo, o vacía si no hay que decir nada.
 *
 * @param {string} length
 * @returns {string}
 */
export function lengthNote(length) {
    return LENGTHS[/** @type {keyof typeof LENGTHS} */ (String(length ?? ''))]?.note ?? '';
}

/**
 * El siguiente largo, para un botón que cambia de uno en uno.
 *
 * @param {string} length
 * @returns {string}
 */
export function nextLength(length) {
    const ids = Object.keys(LENGTHS);
    const at = ids.indexOf(String(length ?? 'ficha'));
    return ids[(at + 1) % ids.length];
}
