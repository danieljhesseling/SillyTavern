/**
 * Las puertas que un combate cierra mientras dura, y lo que se dice al encontrarlas cerradas.
 *
 * Hasta ahora no cerraba ninguna: con un enemigo delante se podía abrir el mapa del mundo,
 * viajar a otra localidad, salir del tablero o repintar el suelo bajo los pies de quien
 * estaba peleando. Nada de eso lo impedía el motor — ni los botones ni `/go`, `/enter` y
 * `/leave` — y la partida quedaba en un estado que nadie había querido: un encuentro vivo
 * sobre un tablero que ya no estabas mirando.
 *
 * Aquí está la **política**, no el dibujo: qué acciones aguantan hasta que la pelea acabe y
 * con qué palabras se explica. En un sitio porque hay cuatro puertas distintas — la barra de
 * escenas, las pestañas del mapa, el botón de terreno y los comandos — y una regla repartida
 * en cuatro sitios es una regla que dentro de un mes solo se cumple en tres.
 *
 * Nunca impide **abandonar**: salir de un combate es una decisión del jugador y tiene su
 * propio botón. Lo que se frena es irse sin decidirlo.
 *
 * Puro. Ver wiki/POR_HACER.md · wiki/ROADMAP_JUEGO_SIN_COMANDOS.md.
 */

/**
 * @typedef {'travel'|'board'|'world'|'terrain'|'exploration'} HeldAction
 */

/** Lo que se dice en cada puerta. Escrito una vez para que las cuatro digan lo mismo. */
const REASONS = {
    travel: 'No se viaja en mitad de un combate. Termínalo, o pulsa Abandonar.',
    board: 'No se sale del tablero en mitad de un combate. Termínalo, o pulsa Abandonar.',
    world: 'El mapa del mundo no se abre en mitad de un combate.',
    exploration: 'Hay un combate en marcha: primero se termina.',
    terrain: 'El terreno no se repinta en mitad de un combate: '
        + 'cambiaría el tablero bajo los pies de quien está peleando.',
};

/** Todo lo que un combate retiene, para que una prueba pueda recorrerlas sin listarlas a mano. */
export const HELD_ACTIONS = /** @type {HeldAction[]} */ (Object.keys(REASONS));

/**
 * Por qué esta acción tiene que esperar, o cadena vacía si no tiene que esperar nada.
 *
 * Devuelve el motivo en vez de un booleano a propósito: quien pregunta casi siempre
 * necesita escribirlo en un `title` o en un aviso, y un `false` obliga a redactar el
 * mensaje otra vez en cada sitio — que es justo como cuatro puertas acaban diciendo cuatro
 * cosas distintas.
 *
 * @param {{active?: boolean}|null|undefined} encounter El encuentro tal y como lo guarda la partida.
 * @param {HeldAction} action
 * @returns {string}
 */
export function holdDuringCombat(encounter, action) {
    if (!encounter || encounter.active !== true) return '';
    return REASONS[action] ?? '';
}
