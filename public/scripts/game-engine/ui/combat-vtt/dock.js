/**
 * J12.20 (Daniel, 2026-10-03; wiki/maquetas/ENCARGO_COMBATE_MUELLE_Y_RESULTADO.md): el muelle
 * táctico. El menú de la barra (Atacar, Magia, Acciones, Adicional) ya no se abre en el centro,
 * encima de la barra, tapando el tercio de abajo del tablero, que es donde están las fichas en una
 * pelea cuerpo a cuerpo. Se abre a la izquierda, encima del minimapa: 360 px de ancho, con su
 * propio scroll, a 175 px del borde de abajo y a 50 px como poco de la cabecera. Si la columna de
 * la cámara cae a su altura, va a su lado: la cámara no se tapa.
 *
 * El centro se queda limpio. Si aun así el muelle tapa alguna ficha, la cámara se aparta lo justo
 * (`dockNudge`). En el teléfono el muelle es una hoja que sube desde abajo, y la cámara sube el
 * tablero lo justo para que se vea el objetivo encima de ella.
 *
 * Puro: las cuentas. Lo aplica `action-bar.js`.
 */

/** Las medidas del muelle, en píxeles de pantalla. */
export const DOCK = Object.freeze({
    /** Su ancho. */
    width: 360,
    /** Del borde izquierdo del tablero. */
    left: 24,
    /** Del borde de abajo del tablero (encima del minimapa). */
    bottom: 175,
    /** Lo que deja, como poco, debajo de la cabecera. */
    headGap: 50,
    /** Lo más alto: el alto de la ventana menos esto. */
    viewportLess: 250,
    /** Lo más bajo que se le deja, aunque no quepa más. */
    minHeight: 160,
    /** Lo que deja a la derecha de la columna de la cámara. */
    cameraGap: 10,
    /** Lo que deja entre el muelle y una ficha. */
    tokenGap: 12,
    /** En el teléfono, la hoja no pasa de esta parte del alto de la pantalla. */
    sheetShare: 0.48,
});

/**
 * @typedef {Object} Box Una caja en la pantalla.
 * @property {number} left
 * @property {number} top
 * @property {number} right
 * @property {number} bottom
 */

/**
 * @typedef {Box & {key?: boolean}} TokenBox Una ficha: `key`, si es de las que importan (quien
 *   juega, los objetivos del menú abierto), y no se puede quedar tapada.
 */

/**
 * @param {any} value
 * @returns {number}
 */
function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

/**
 * Dónde va el muelle, en pantalla: a 24 px del borde izquierdo del tablero (o al lado de la
 * columna de la cámara, si cae a su altura), con su borde de abajo a 175 px del de abajo del
 * tablero, y lo más alto que puede ser sin pasar de la cabecera más 50 px ni del alto de la
 * ventana menos 250. El muelle crece hacia arriba desde su borde de abajo.
 *
 * @param {{board: Box, head?: number, viewportH: number, camera?: Box|null}} at
 * @returns {Box & {maxHeight: number}}
 */
export function dockPlace({ board, head = 0, viewportH, camera = null }) {
    const bottom = num(board?.bottom) - DOCK.bottom;
    const top = Math.max(num(board?.top), num(head)) + DOCK.headGap;
    let left = num(board?.left) + DOCK.left;
    if (camera && num(camera.right) > left && num(camera.left) < left + DOCK.width && num(camera.top) < bottom && num(camera.bottom) > top) {
        left = num(camera.right) + DOCK.cameraGap;
    }
    const maxHeight = Math.max(DOCK.minHeight, Math.min(num(viewportH) - DOCK.viewportLess, bottom - top));
    return { left, right: left + DOCK.width, top: bottom - maxHeight, bottom, maxHeight };
}

/**
 * Si dos cajas se tocan.
 *
 * @param {Box} a
 * @param {Box} b
 * @returns {boolean}
 */
export function overlaps(a, b) {
    return num(a.left) < num(b.right) && num(a.right) > num(b.left) && num(a.top) < num(b.bottom) && num(a.bottom) > num(b.top);
}

/**
 * Lo justo que se aparta la cámara para que el muelle no tape ninguna ficha.
 *
 * - `x` (el muelle de la izquierda): cuánto se corre el tablero a la derecha (0 o más). Si correrlo
 *   tanto esconde por la derecha otra ficha que se ve (bajo la columna de la iniciativa), se corre
 *   solo lo que haga falta para las que importan (`key`), y como mucho lo que quepa.
 * - `y` (la hoja del teléfono): cuánto sube el tablero (0 o menos), igual, por arriba.
 *
 * Las fichas que ya no se ven (fuera de `view`) no cuentan.
 *
 * @param {{dock: Box, view: Box, tokens: TokenBox[], axis?: 'x'|'y', gap?: number}} at
 * @returns {number}
 */
export function dockNudge({ dock, view, tokens, axis = 'x', gap = DOCK.tokenGap }) {
    const shown = (Array.isArray(tokens) ? tokens : []).filter(t => t && overlaps(t, view));
    if (shown.length === 0 || !dock) return 0;
    const g = Math.max(0, num(gap));
    if (axis === 'y') {
        const line = num(dock.top) - g;
        const under = shown.filter(t => num(t.bottom) > line && num(t.right) > num(dock.left) && num(t.left) < num(dock.right));
        if (under.length === 0) return 0;
        const lift = (/** @type {TokenBox[]} */ list) => Math.max(0, ...list.map(t => num(t.bottom) - line));
        const room = (/** @type {TokenBox[]} */ list) => Math.max(0, Math.min(...list.map(t => num(t.top))) - num(view.top));
        const all = lift(under);
        const keys = under.filter(t => t.key);
        let up = all;
        if (all > room(shown)) up = keys.length === 0 ? Math.min(all, room(shown)) : Math.min(lift(keys), room(shown.filter(t => t.key)));
        return up > 0 ? -up : 0;
    }
    const wall = { left: num(dock.left) - g, top: num(dock.top) - g, right: num(dock.right) + g, bottom: num(dock.bottom) + g };
    const under = shown.filter(t => overlaps(t, wall));
    if (under.length === 0) return 0;
    const push = (/** @type {TokenBox[]} */ list) => Math.max(0, ...list.map(t => wall.right - num(t.left)));
    const room = (/** @type {TokenBox[]} */ list) => Math.max(0, num(view.right) - Math.max(...list.map(t => num(t.right))));
    const all = push(under);
    if (all <= room(shown)) return all;
    const keys = under.filter(t => t.key);
    if (keys.length === 0) return Math.min(all, room(shown));
    return Math.min(push(keys), room(shown.filter(t => t.key)));
}
