/**
 * Tanda 10: la cámara del tablero, como en una mesa virtual (Foundry, Owlbear). El mapa ocupa
 * toda la pantalla de juego; se arrastra para moverlo y la rueda (o dos dedos) lo acerca hacia
 * donde apunta el cursor, de 0,45× a 2,2×. Ver wiki/maquetas/ENCARGO_COMBATE_VTT.md.
 *
 * El acercamiento se cuenta en casillas, no en el dibujo: 1× es una casilla de 44 px en pantalla,
 * lo que mide en un tablero sin imagen. Así un mapa dibujado, con casillas de 20 o de 70 px, se
 * acerca y se aleja lo mismo que uno de casillas.
 *
 * Puro: las cuentas de la vista. Quien dibuja (`world-map-renderer.js`) las aplica.
 */

/** Lo más lejos que se aleja la cámara. */
export const ZOOM_MIN = 0.45;
/** Lo más cerca que se acerca. */
export const ZOOM_MAX = 2.2;
/** Lo que mide una casilla en pantalla a 1×. */
export const BASE_CELL_PX = 44;
/** Lo que acerca o aleja cada botón. */
export const BUTTON_STEP = 1.25;
/** Lo que acerca o aleja cada golpe de rueda. */
export const WHEEL_STEP = 1.15;
/** Lo que se deja ver del tablero, como poco, al arrastrarlo hacia fuera (en píxeles de pantalla). */
export const KEEP_ON_SCREEN = 96;

/**
 * @typedef {Object} CameraView
 * @property {number} scale
 * @property {number} offsetX
 * @property {number} offsetY
 */

/**
 * @typedef {Object} ScreenRect La parte de la pantalla que se mira, sin lo que tapa el HUD.
 * @property {number} left
 * @property {number} top
 * @property {number} right
 * @property {number} bottom
 */

/**
 * @param {any} value
 * @param {number} [fallback]
 * @returns {number}
 */
function num(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Los límites de la cámara en la escala del dibujo, para casillas de `cellPx` sin acercar.
 *
 * @param {number} cellPx
 * @returns {{min: number, max: number}}
 */
export function zoomLimits(cellPx) {
    const cell = num(cellPx) > 0 ? num(cellPx) : BASE_CELL_PX;
    return { min: (ZOOM_MIN * BASE_CELL_PX) / cell, max: (ZOOM_MAX * BASE_CELL_PX) / cell };
}

/**
 * El acercamiento que se le dice a quien juega (1× es una casilla de 44 px).
 *
 * @param {number} scale
 * @param {number} cellPx
 * @returns {number}
 */
export function zoomOf(scale, cellPx) {
    const cell = num(cellPx) > 0 ? num(cellPx) : BASE_CELL_PX;
    return (num(scale, 1) * cell) / BASE_CELL_PX;
}

/**
 * El acercamiento, dicho: «1,2×».
 *
 * @param {number} scale
 * @param {number} cellPx
 * @returns {string}
 */
export function zoomLabel(scale, cellPx) {
    return `${zoomOf(scale, cellPx).toFixed(1).replace('.', ',')}×`;
}

/**
 * @param {number} scale
 * @param {{min: number, max: number}} limits
 * @returns {number}
 */
export function clampScale(scale, limits) {
    const wanted = num(scale, 1);
    return Math.min(num(limits?.max, wanted), Math.max(num(limits?.min, wanted), wanted));
}

/**
 * Acercar o alejar dejando quieto el punto de la pantalla `at`: lo que hay bajo el cursor se
 * queda bajo el cursor.
 *
 * @param {CameraView} view
 * @param {number} nextScale
 * @param {{x: number, y: number}} at Un punto de la pantalla, contado desde la esquina del tablero.
 * @param {{min: number, max: number}} limits
 * @returns {CameraView}
 */
export function zoomAt(view, nextScale, at, limits) {
    const scale = num(view?.scale, 1) || 1;
    const next = clampScale(nextScale, limits);
    const ratio = next / scale;
    const x = num(at?.x);
    const y = num(at?.y);
    return {
        scale: next,
        offsetX: x - ratio * (x - num(view?.offsetX)),
        offsetY: y - ratio * (y - num(view?.offsetY)),
    };
}

/**
 * La escala tras un golpe de rueda: hacia arriba acerca y hacia abajo aleja.
 *
 * @param {number} scale
 * @param {number} deltaY
 * @returns {number}
 */
export function wheelScale(scale, deltaY) {
    const now = num(scale, 1);
    if (!num(deltaY)) return now;
    return num(deltaY) < 0 ? now * WHEEL_STEP : now / WHEEL_STEP;
}

/**
 * La parte de la pantalla que se mira: la vista menos lo que tapan las islas del HUD.
 *
 * @param {number} viewW
 * @param {number} viewH
 * @param {{top?: number, right?: number, bottom?: number, left?: number}} [insets]
 * @returns {ScreenRect}
 */
export function safeRect(viewW, viewH, insets = {}) {
    const w = Math.max(0, num(viewW));
    const h = Math.max(0, num(viewH));
    const left = Math.max(0, num(insets.left));
    const top = Math.max(0, num(insets.top));
    const right = Math.max(left, w - Math.max(0, num(insets.right)));
    const bottom = Math.max(top, h - Math.max(0, num(insets.bottom)));
    // Si el HUD se come casi todo (más de tres cuartos), se mira la vista entera. En el teléfono de
    // pie, el HUD de arriba y la fila de la cámara dejan algo más de un tercio, y eso sí se mira.
    if (right - left < w * 0.25 || bottom - top < h * 0.25) return { left: 0, top: 0, right: w, bottom: h };
    return { left, top, right, bottom };
}

/**
 * Dónde poner la vista para que un punto del tablero (en píxeles del dibujo) quede en el centro
 * de `rect`.
 *
 * @param {CameraView} view
 * @param {{x: number, y: number}} point
 * @param {ScreenRect} rect
 * @returns {CameraView}
 */
export function centerPoint(view, point, rect) {
    const scale = num(view?.scale, 1);
    const cx = (num(rect?.left) + num(rect?.right)) / 2;
    const cy = (num(rect?.top) + num(rect?.bottom)) / 2;
    return { scale, offsetX: cx - num(point?.x) * scale, offsetY: cy - num(point?.y) * scale };
}

/**
 * Como `centerPoint`, pero en el eje en que el tablero entero cabe en `rect` se centra el tablero,
 * no el punto: se ve todo igual (el punto también) y no se queda pegado a un lado con vacío al
 * otro (el muelle en 1920 × 1080 quedaba arriba, con 440 px negros debajo). En el eje en que no
 * cabe, el punto va al centro.
 *
 * @param {CameraView} view
 * @param {{x: number, y: number}} point
 * @param {ScreenRect} rect
 * @param {{width: number, height: number}} board Lo que mide el tablero sin acercar.
 * @returns {CameraView}
 */
export function centerPointFit(view, point, rect, board) {
    const scale = num(view?.scale, 1);
    const axis = (/** @type {number} */ at, /** @type {number} */ size, /** @type {number} */ start, /** @type {number} */ end) => {
        const drawn = Math.max(0, size * scale);
        return drawn <= end - start ? start + (end - start - drawn) / 2 : (start + end) / 2 - at * scale;
    };
    return {
        scale,
        offsetX: axis(num(point?.x), num(board?.width), num(rect?.left), num(rect?.right)),
        offsetY: axis(num(point?.y), num(board?.height), num(rect?.top), num(rect?.bottom)),
    };
}

/**
 * El centro de una casilla, en píxeles del dibujo.
 *
 * @param {{x: number, y: number}} cell
 * @param {number} cellW
 * @param {number} cellH
 * @returns {{x: number, y: number}}
 */
export function cellCenter(cell, cellW, cellH) {
    return { x: (num(cell?.x) + 0.5) * num(cellW), y: (num(cell?.y) + 0.5) * num(cellH) };
}

/**
 * Dónde cae en la pantalla un punto del tablero.
 *
 * @param {CameraView} view
 * @param {{x: number, y: number}} point
 * @returns {{x: number, y: number}}
 */
export function toScreen(view, point) {
    const scale = num(view?.scale, 1);
    return { x: num(view?.offsetX) + num(point?.x) * scale, y: num(view?.offsetY) + num(point?.y) * scale };
}

/**
 * Qué punto del tablero hay bajo un punto de la pantalla.
 *
 * @param {CameraView} view
 * @param {{x: number, y: number}} at
 * @returns {{x: number, y: number}}
 */
export function toBoard(view, at) {
    const scale = num(view?.scale, 1) || 1;
    return { x: (num(at?.x) - num(view?.offsetX)) / scale, y: (num(at?.y) - num(view?.offsetY)) / scale };
}

/**
 * La parte del tablero que se ve, en píxeles del dibujo.
 *
 * @param {CameraView} view
 * @param {number} viewW
 * @param {number} viewH
 * @returns {{x: number, y: number, width: number, height: number}}
 */
export function visibleArea(view, viewW, viewH) {
    const scale = num(view?.scale, 1) || 1;
    const from = toBoard(view, { x: 0, y: 0 });
    return { x: from.x, y: from.y, width: num(viewW) / scale, height: num(viewH) / scale };
}

/**
 * Si un punto del tablero se ve con holgura dentro de `rect` (`margin`, en píxeles de pantalla,
 * lo que se deja a cada lado).
 *
 * @param {CameraView} view
 * @param {{x: number, y: number}} point
 * @param {ScreenRect} rect
 * @param {number} [margin]
 * @returns {boolean}
 */
export function isPointShown(view, point, rect, margin = 0) {
    const at = toScreen(view, point);
    const m = num(margin);
    return at.x >= num(rect?.left) + m && at.x <= num(rect?.right) - m && at.y >= num(rect?.top) + m && at.y <= num(rect?.bottom) - m;
}

/**
 * Tanda 17: lo poco que hay que mover la vista para que un punto del tablero se vea con holgura
 * dentro de `rect` (`margin` por cada lado). Si ya se ve, la misma vista. Es lo que hace la cámara
 * al seguir a una ficha que anda: no la centra a cada paso, la acompaña cuando se acerca al borde.
 *
 * @param {CameraView} view
 * @param {{x: number, y: number}} point
 * @param {ScreenRect} rect
 * @param {number} [margin]
 * @returns {CameraView}
 */
export function panToShow(view, point, rect, margin = 0) {
    const scale = num(view?.scale, 1);
    const at = toScreen(view, point);
    const m = Math.max(0, num(margin));
    const axis = (/** @type {number} */ pos, /** @type {number} */ lo, /** @type {number} */ hi) => {
        // Sin sitio para el margen (una vista diminuta), al centro.
        if (hi - lo < 2 * m) return (lo + hi) / 2 - pos;
        if (pos < lo + m) return lo + m - pos;
        if (pos > hi - m) return hi - m - pos;
        return 0;
    };
    return {
        scale,
        offsetX: num(view?.offsetX) + axis(at.x, num(rect?.left), num(rect?.right)),
        offsetY: num(view?.offsetY) + axis(at.y, num(rect?.top), num(rect?.bottom)),
    };
}

/**
 * Que el tablero no se pierda: al arrastrarlo, como poco `keep` píxeles suyos se quedan en la
 * pantalla por cada lado (o el tablero entero, si es más pequeño).
 *
 * @param {CameraView} view
 * @param {{width: number, height: number}} board Lo que mide el dibujo sin acercar.
 * @param {{width: number, height: number}} screen Lo que mide la vista.
 * @param {number} [keep]
 * @returns {CameraView}
 */
export function clampPan(view, board, screen, keep = KEEP_ON_SCREEN) {
    const scale = num(view?.scale, 1);
    const axis = (/** @type {number} */ offset, /** @type {number} */ size, /** @type {number} */ space) => {
        const drawn = Math.max(0, size * scale);
        const hold = Math.min(drawn, Math.max(0, keep));
        // El borde derecho del dibujo no pasa de `hold` por la izquierda, ni el izquierdo de
        // `space - hold` por la derecha.
        return Math.min(space - hold, Math.max(hold - drawn, offset));
    };
    return {
        scale,
        offsetX: axis(num(view?.offsetX), num(board?.width), num(screen?.width)),
        offsetY: axis(num(view?.offsetY), num(board?.height), num(screen?.height)),
    };
}

/**
 * El encuadre que enseña el tablero entero dentro de `rect`, centrado, sin pasar de los
 * límites de la cámara (un tablero enorme se queda en 0,45× y se recorre arrastrando).
 *
 * @param {{width: number, height: number}} board
 * @param {ScreenRect} rect
 * @param {{min: number, max: number}} limits
 * @param {number} [most] Lo más que se acerca al encuadrar (un tablero pequeño no se pone a 2,2×).
 * @returns {CameraView}
 */
export function fitBoard(board, rect, limits, most = Infinity) {
    const w = Math.max(1, num(board?.width, 1));
    const h = Math.max(1, num(board?.height, 1));
    const rw = Math.max(1, num(rect?.right) - num(rect?.left));
    const rh = Math.max(1, num(rect?.bottom) - num(rect?.top));
    const scale = clampScale(Math.min(rw / w, rh / h, num(most, Infinity)), limits);
    return centerPoint({ scale, offsetX: 0, offsetY: 0 }, { x: w / 2, y: h / 2 }, rect);
}

/**
 * Tanda 10: si la cámara va a buscar a quien tiene el turno. Una vez al empezar cada turno, y
 * solo si no se le ve bien. Si quien juega ha movido la cámara a mano en este turno, o hace un
 * momento (está mirando algo mientras juegan los enemigos), no se le quita de donde la ha puesto.
 *
 * @param {Object} input
 * @param {string} input.turnKey El turno de ahora (ronda y quién), o vacío fuera de combate.
 * @param {string} input.followedKey El último turno al que ya se fue a buscar.
 * @param {string} [input.handKey] El turno en el que se movió la cámara a mano por última vez.
 * @param {boolean} [input.recentHand] Si se ha movido a mano hace nada.
 * @param {boolean} input.shown Si se le ve bien ahora.
 * @returns {{follow: boolean, mark: boolean}} `mark`: apuntar este turno como ya buscado.
 */
export function followDecision({ turnKey, followedKey, handKey = '', recentHand = false, shown }) {
    const turn = String(turnKey ?? '');
    if (!turn || turn === String(followedKey ?? '')) return { follow: false, mark: false };
    if (turn === String(handKey ?? '') || recentHand) return { follow: false, mark: true };
    return { follow: !shown, mark: true };
}

/**
 * Hace cuánto se movió la cámara a mano para contar como «hace nada».
 */
export const RECENT_HAND_MS = 2500;
