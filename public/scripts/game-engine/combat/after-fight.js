/**
 * D-J45 (decidido el 2026-09-30): a dónde lleva «Continuar» después de ganar una pelea en un
 * tablero. Sigue el hilo, como en un juego normal:
 *
 * 1. **Si hay una escena o un suceso**, a eso: la escena del hilo que espera a que se cierre
 *    el panel de victoria, la tarjeta de un suceso o el paso de una misión personal.
 * 2. **En una campaña, a lo que toque en ella**: si lo que tenéis entre manos (el hito de la
 *    cabecera) está en otro tablero o en otra localización, se sale del tablero y se ve el
 *    sitio, desde donde se va. En el gremio no: no es una campaña.
 * 3. **Si no, a donde estabas**: al tablero en el que se ha peleado (o al sitio, si ya no hay
 *    tablero), como hasta ahora (J18.8).
 *
 * Puro: dice a dónde y con qué palabras. Salir del tablero y cambiar de escena lo hace quien
 * llama (`party/combat-flow.js`).
 */

/**
 * @typedef {'story'|'next'|'board'|'place'} AfterFightKind
 *   `story`: se queda en la novela y sale la escena (o el suceso); `next`: se sale del tablero
 *   al sitio, camino de lo siguiente; `board`: se vuelve al tablero; `place`: al sitio.
 */

/**
 * @typedef {Object} AfterFightStep
 * @property {AfterFightKind} kind
 * @property {string} title Lo que dice el botón al pasar por encima: a dónde lleva.
 * @property {string} [next] El hito que toca, si es `next`.
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string} */
const fold = (value) => text(value).toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Dónde pide ir un hito: su localización y su tablero, si los dice. Un hito con varias formas
 * de cumplirse (`any`) dice la primera que tenga sitio.
 *
 * @param {{kind?: string, place?: string, board?: string, options?: any[]}|null|undefined} asks
 * @returns {{place: string, board: string}}
 */
export function whereItAsks(asks) {
    if (!asks || typeof asks !== 'object') return { place: '', board: '' };
    if (text(asks.place) || text(asks.board)) return { place: text(asks.place), board: text(asks.board) };
    for (const option of Array.isArray(asks.options) ? asks.options : []) {
        const found = whereItAsks(option);
        if (found.place || found.board) return found;
    }
    return { place: '', board: '' };
}

/**
 * A dónde lleva «Continuar» tras ganar en un tablero.
 *
 * @param {Object} [input]
 * @param {boolean} [input.story] Espera una escena, un suceso o el paso de una misión personal.
 * @param {boolean} [input.inCampaign] Si se juega una campaña (no el gremio).
 * @param {{title?: string, place?: string, board?: string}|null} [input.next] Lo que toca en
 *   la campaña (el hito de la cabecera), con dónde está.
 * @param {{place?: string, board?: string}} [input.here] Dónde se ha ganado.
 * @returns {AfterFightStep}
 */
export function afterFightStep({ story = false, inCampaign = false, next = null, here = {} } = {}) {
    const place = text(here?.place);
    const board = text(here?.board);
    if (story) return { kind: 'story', title: 'Sigue la historia' };

    const title = text(next?.title);
    const nextPlace = text(next?.place);
    const nextBoard = text(next?.board);
    const elsewhere = inCampaign && Boolean(title) && (
        (nextBoard && fold(nextBoard) !== fold(board))
        || (!nextBoard && nextPlace && fold(nextPlace) !== fold(place))
        // Un hito en esta localización pero sin tablero (hablar con alguien): se hace fuera.
        || (!nextBoard && nextPlace && fold(nextPlace) === fold(place) && Boolean(board))
    );
    if (elsewhere) {
        const where = nextBoard && nextPlace ? `${nextBoard} (${nextPlace})` : (nextBoard || nextPlace);
        return { kind: 'next', title: `Lo siguiente: ${title}${where ? `, en ${where}` : ''}`, next: title };
    }

    if (board) return { kind: 'board', title: `Volver al tablero: ${board}` };
    return { kind: 'place', title: place ? `Seguir en ${place}` : 'Seguir' };
}
