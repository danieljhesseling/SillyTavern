/**
 * J12.13: la cámara de un tablero grande.
 *
 * Un mapa entero de mazmorra (unas 40 × 28 casillas) no cabe en la pantalla con casillas que se
 * lean: encuadrado entero, cada casilla mide menos que la yema de un dedo. Así que un tablero
 * grande se juega **por partes**: la vista se acerca hasta que las casillas se leen, sigue al
 * grupo por el mapa, y la niebla de guerra (`fog-of-war.js`) tapa lo que aún no se ha visto.
 *
 * Puro: las cuentas de la vista. Quien dibuja (`world-map-renderer.js`) las aplica.
 */

/** Lo menos que mide una casilla en pantalla para leerse y tocarse con cuidado. */
export const READABLE_CELL_PX = 28;

/**
 * Desde aquí un tablero es grande: se juega por partes y con niebla. Los de los paquetes de hoy
 * no llegan (el mayor, 22 × 13); un mapa de mazmorra entero, sí (36 × 25, 40 × 28).
 */
export const LARGE_BOARD = Object.freeze({ cols: 30, rows: 20, cells: 500 });

/** Lo más que se acerca la vista, como la rueda y los botones. */
const MAX_SCALE = 6;

/**
 * @param {any} value
 * @returns {number}
 */
function num(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Si un tablero de estas medidas es grande.
 *
 * @param {number} cols
 * @param {number} rows
 * @returns {boolean}
 */
export function isLargeBoard(cols, rows) {
    const w = Math.max(0, Math.trunc(num(cols)));
    const h = Math.max(0, Math.trunc(num(rows)));
    return w >= LARGE_BOARD.cols || h >= LARGE_BOARD.rows || w * h >= LARGE_BOARD.cells;
}

/**
 * Si el tablero lleva niebla: lo que diga el propio tablero (el pincel «Niebla», o su paquete);
 * sin decirlo, los grandes sí y los demás no.
 *
 * @param {any} board
 * @param {number} cols
 * @param {number} rows
 * @returns {boolean}
 */
export function fogOnFor(board, cols, rows) {
    if (typeof board?.fogEnabled === 'boolean') return board.fogEnabled;
    return isLargeBoard(cols, rows);
}

/**
 * El acercamiento con el que se juega: el que encuadra el tablero entero si así las casillas
 * se leen; si no, el que las deja de `minCellPx` (y entonces el tablero se ve por partes).
 *
 * @param {Object} input
 * @param {number} input.fitScale El que encuadra el tablero entero.
 * @param {number} input.cellPx Lo que mide una casilla sin acercar (en el dibujo).
 * @param {number} [input.minCellPx]
 * @param {number} [input.maxScale]
 * @returns {{scale: number, partial: boolean}} `partial`: si ya no se ve entero.
 */
export function readableScale({ fitScale, cellPx, minCellPx = READABLE_CELL_PX, maxScale = MAX_SCALE }) {
    const fit = num(fitScale) > 0 ? num(fitScale) : 1;
    const cell = num(cellPx);
    if (cell <= 0 || fit * cell >= minCellPx) return { scale: fit, partial: false };
    return { scale: Math.min(maxScale, minCellPx / cell), partial: true };
}

/**
 * Dónde poner la vista para que una casilla quede en el centro, sin enseñar más vacío del
 * necesario: si el tablero es más grande que la vista, no se deja ver por fuera de sus bordes;
 * si es más pequeño, se queda centrado.
 *
 * @param {Object} input
 * @param {{x: number, y: number}} input.cell
 * @param {number} input.cellW Lo que mide una casilla sin acercar.
 * @param {number} input.cellH
 * @param {number} input.scale
 * @param {number} input.viewW
 * @param {number} input.viewH
 * @param {number} input.boardW Lo que mide el tablero entero sin acercar.
 * @param {number} input.boardH
 * @returns {{offsetX: number, offsetY: number}}
 */
export function centerOn({ cell, cellW, cellH, scale, viewW, viewH, boardW, boardH }) {
    const axis = (/** @type {number} */ at, /** @type {number} */ size, /** @type {number} */ view, /** @type {number} */ total) => {
        const drawn = total * scale;
        if (drawn <= view) return (view - drawn) / 2;
        const wanted = view / 2 - (at + 0.5) * size * scale;
        return Math.min(0, Math.max(view - drawn, wanted));
    };
    return {
        offsetX: axis(num(cell?.x), num(cellW), num(viewW), num(boardW)),
        offsetY: axis(num(cell?.y), num(cellH), num(viewH), num(boardH)),
    };
}

/**
 * Si una casilla se ve bien: su centro cae dentro de la vista, lejos del borde (`margin`, la
 * parte de la vista que se deja a cada lado). Cerca del borde ya toca mover la cámara: lo que
 * hay delante del grupo tiene que verse.
 *
 * @param {Object} input
 * @param {{x: number, y: number}} input.cell
 * @param {number} input.cellW
 * @param {number} input.cellH
 * @param {number} input.scale
 * @param {number} input.offsetX
 * @param {number} input.offsetY
 * @param {number} input.viewW
 * @param {number} input.viewH
 * @param {number} [input.margin]
 * @returns {boolean}
 */
export function isInView({ cell, cellW, cellH, scale, offsetX, offsetY, viewW, viewH, margin = 0.2 }) {
    const px = num(offsetX) + (num(cell?.x) + 0.5) * num(cellW) * num(scale);
    const py = num(offsetY) + (num(cell?.y) + 0.5) * num(cellH) * num(scale);
    const mx = num(viewW) * margin;
    const my = num(viewH) * margin;
    return px >= mx && px <= num(viewW) - mx && py >= my && py <= num(viewH) - my;
}
