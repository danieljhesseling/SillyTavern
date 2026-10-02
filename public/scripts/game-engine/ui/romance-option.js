/**
 * J14.10 de ROADMAP_SIN_CONEXION: «Romance», en las opciones del juego. Es de este navegador,
 * como los sucesos o el tamaño del texto, y va encendido de salida.
 *
 * Encendido, el romance solo avanza si eliges tú una respuesta claramente romántica (lleva un
 * corazón). Apagado, no sale nada romántico: ni la pregunta, ni las citas, ni las frases de
 * pareja, ni su línea al final o en el Salón de la fama. Lo vivido se guarda igual, por si se
 * vuelve a encender.
 *
 * Aquí solo se guarda y se dibuja la fila; lo demás es de `party/romance.js`.
 */

/** La clave en este navegador: `off` lo apaga; cualquier otra cosa (o nada), encendido. */
export const ROMANCE_OPTION_KEY = 'sillytavern_gameRomance';

/**
 * Si está encendido, según lo guardado.
 *
 * @param {string|null|undefined} stored
 * @returns {boolean}
 */
export function readRomanceOption(stored) {
    return String(stored ?? '').trim().toLowerCase() !== 'off';
}

/** @returns {boolean} Si el romance está encendido en este navegador (lo está de salida). */
export function romanceOn() {
    try {
        return readRomanceOption(globalThis.localStorage?.getItem(ROMANCE_OPTION_KEY));
    } catch {
        return true;
    }
}

/** @param {boolean} on */
export function setRomanceOn(on) {
    try {
        globalThis.localStorage?.setItem(ROMANCE_OPTION_KEY, on ? 'on' : 'off');
    } catch { /* sin almacenamiento, vale para esta visita */ }
}

/** @returns {boolean} Cómo queda: encendido o apagado. */
export function toggleRomance() {
    const next = !romanceOn();
    setRomanceOn(next);
    return next;
}

/**
 * La fila de «Romance» para la ventana de opciones (`game-options.js`).
 *
 * @param {boolean} [on]
 * @returns {{id: string, icon: string, label: string, value: string, hint: string}}
 */
export function romanceOptionRow(on = romanceOn()) {
    return {
        id: 'romance',
        icon: 'fa-heart',
        label: 'Romance',
        value: on ? 'Sí' : 'No',
        hint: on
            ? 'Con quien lo permita, y solo si eliges tú la respuesta con corazón'
            : 'No sale nada romántico: ni la pregunta, ni las citas',
    };
}

/**
 * La lista con «Romance» detrás de los sucesos (si quien abre la ventana ya la trae, se deja).
 *
 * @template {{id: string}} T
 * @param {T[]} list
 * @param {T} [row]
 * @returns {T[]}
 */
export function withRomanceRow(list, row = /** @type {T} */ (/** @type {unknown} */ (romanceOptionRow()))) {
    if (list.some(r => r.id === row.id)) return list;
    const at = list.findIndex(r => r.id === 'sucesos');
    return at >= 0 ? [...list.slice(0, at + 1), row, ...list.slice(at + 1)] : [...list, row];
}
