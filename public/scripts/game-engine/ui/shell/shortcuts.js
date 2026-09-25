/**
 * Los atajos de teclado del Modo Juego (idea 152), y su chuleta.
 *
 * Una sola tabla: la usa quien atiende las teclas y la que las enseña, así que la chuleta
 * no puede mentir.
 *
 * Puro: qué hace cada tecla.
 */

/** Las teclas, en el orden en que se enseñan. */
export const SHORTCUTS = [
    { key: '1', action: 'scene:dialogue', label: 'La conversación' },
    { key: '2', action: 'scene:exploration', label: 'Explorar: el sitio y el mapa' },
    { key: '3', action: 'scene:combat', label: 'El tablero' },
    { key: 'd', action: 'journal', label: 'Diario' },
    { key: 'g', action: 'glance', label: 'El grupo de un vistazo' },
    { key: 'h', action: 'help', label: '¿Qué hago?' },
    { key: 'b', action: 'tray', label: 'Bandeja de avisos' },
    { key: 't', action: 'dice', label: 'Historial de dados' },
    { key: 'l', action: 'glossary', label: 'Glosario: las palabras de las reglas' },
    { key: '?', action: 'keys', label: 'Esta chuleta' },
    { key: 'Esc', action: 'pause', label: 'Pausa' },
];

/**
 * La acción de una tecla, o vacío. Las de escena y la pausa ya las atiende el Shell por su
 * lado; aquí se resuelven las demás. Con Ctrl, Alt o Cmd no es un atajo del juego.
 *
 * @param {{key: string, ctrlKey?: boolean, altKey?: boolean, metaKey?: boolean}} event
 * @returns {string}
 */
export function actionForKey(event) {
    if (event.ctrlKey || event.altKey || event.metaKey) return '';
    const key = String(event.key ?? '');
    const found = SHORTCUTS.find(s => s.key === key || s.key === key.toLowerCase());
    if (!found || found.action.startsWith('scene:') || found.action === 'pause') return '';
    return found.action;
}
