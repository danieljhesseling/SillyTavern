/**
 * E8.7 (D-J64): «Modo duro», en las opciones del juego. Apagado de salida.
 *
 * Encendido, la muerte de un confidente es para siempre: el templo no le devuelve la vida, y la
 * pantalla de la derrota lo dice en rojo. Apagado, quien cae se puede llevar al templo y vuelve
 * pagando, con secuela (`rules/resurrection.js`). Los mercenarios mueren de verdad siempre.
 *
 * Compatibilidad: la letra «De hierro» del modo de juego (`rules/modes.js`, puede morir
 * cualquiera y solo se guarda en el refugio) ya decía que quien muere no vuelve. Con ella
 * encendida también cuenta como duro, aunque la opción esté apagada (`hardDeath`).
 *
 * Es de este navegador, como el romance o los sucesos. Aquí solo se guarda y se dibuja la fila.
 */

/** La clave en este navegador: `on` lo enciende; cualquier otra cosa (o nada), apagado. */
export const HARD_MODE_KEY = 'sillytavern_gameHardMode';

/**
 * Si está encendido, según lo guardado.
 *
 * @param {string|null|undefined} stored
 * @returns {boolean}
 */
export function readHardMode(stored) {
    return String(stored ?? '').trim().toLowerCase() === 'on';
}

/** @returns {boolean} Si el modo duro está encendido en este navegador (de salida, no). */
export function hardModeOn() {
    try {
        return readHardMode(globalThis.localStorage?.getItem(HARD_MODE_KEY));
    } catch {
        return false;
    }
}

/** @param {boolean} on */
export function setHardMode(on) {
    try {
        globalThis.localStorage?.setItem(HARD_MODE_KEY, on ? 'on' : 'off');
    } catch { /* sin almacenamiento, vale para esta visita */ }
}

/** @returns {boolean} Cómo queda. */
export function toggleHardMode() {
    const next = !hardModeOn();
    setHardMode(next);
    return next;
}

/**
 * Si la muerte es para siempre en esta partida: el modo duro, o la letra «De hierro».
 *
 * @param {{option?: boolean, iron?: boolean}} input
 * @returns {{hard: boolean, name: string}} `name`: cómo se dice en la derrota.
 */
export function hardDeath({ option = false, iron = false }) {
    if (option) return { hard: true, name: 'Modo duro' };
    if (iron) return { hard: true, name: 'Modo de hierro' };
    return { hard: false, name: '' };
}

/**
 * La fila de «Modo duro» para la ventana de opciones (`game-options.js`).
 *
 * @param {boolean} [on]
 * @returns {{id: string, icon: string, label: string, value: string, hint: string}}
 */
export function hardModeRow(on = hardModeOn()) {
    return {
        id: 'hard',
        icon: 'fa-skull-crossbones',
        label: 'Modo duro',
        value: on ? 'Sí' : 'No',
        hint: on
            ? 'Quien de los tuyos muere no vuelve: el templo no puede hacer nada'
            : 'Quien cae se puede llevar al templo y vuelve, pagando y con una secuela',
    };
}

/**
 * La lista con «Modo duro» detrás del romance (o de los sucesos); si ya la trae, se deja.
 *
 * @template {{id: string}} T
 * @param {T[]} list
 * @param {T} [row]
 * @returns {T[]}
 */
export function withHardModeRow(list, row = /** @type {T} */ (/** @type {unknown} */ (hardModeRow()))) {
    if (list.some(r => r.id === row.id)) return list;
    const after = list.findIndex(r => r.id === 'romance');
    const at = after >= 0 ? after : list.findIndex(r => r.id === 'sucesos');
    return at >= 0 ? [...list.slice(0, at + 1), row, ...list.slice(at + 1)] : [...list, row];
}
