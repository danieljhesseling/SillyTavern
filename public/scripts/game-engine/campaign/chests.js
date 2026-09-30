/**
 * Lo que guarda cada cofre de un tablero (J5.2 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * Un módulo de D&D cuenta el tesoro sala a sala y sitio a sitio: «en el altar de la cripta, un
 * cáliz de plata». Tu Gem lo escribe en `zones[].treasure` o en `locations[].treasure`, y el
 * motor (`pack-fill.js`) lo pone en un cofre del tablero, en `chests`:
 *
 *     "chests": [{ "x": 16, "y": 1, "items": ["Cáliz de la Dama"] }]
 *
 * Al abrir ese cofre (`party/loot.js`) sale lo suyo, además del oro de siempre. Un cofre sin
 * nada escrito sigue dando lo de antes: oro y, a veces, algo de las tablas de botín.
 *
 * Puro: del tablero, a lo que hay en una casilla.
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * @typedef {Object} BoardChest
 * @property {number} x
 * @property {number} y
 * @property {string[]} items Los objetos, por su nombre en el catálogo del mundo.
 */

/**
 * Los cofres de un tablero, limpios: los que no dicen dónde están o no guardan nada, fuera.
 *
 * @param {any} raw `board.chests`, tal y como venga.
 * @returns {BoardChest[]}
 */
export function readChests(raw) {
    return (Array.isArray(raw) ? raw : [])
        .filter(chest => chest && Number.isInteger(Number(chest.x)) && Number.isInteger(Number(chest.y)))
        .map(chest => ({
            x: Number(chest.x),
            y: Number(chest.y),
            items: (Array.isArray(chest.items) ? chest.items : []).map(text).filter(Boolean),
        }))
        .filter(chest => chest.items.length > 0);
}

/**
 * Lo que guarda el cofre de esa casilla, si el paquete le puso algo.
 *
 * @param {any} board
 * @param {number} x
 * @param {number} y
 * @returns {string[]}
 */
export function chestItemsAt(board, x, y) {
    return readChests(board?.chests).find(chest => chest.x === x && chest.y === y)?.items ?? [];
}
