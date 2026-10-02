/**
 * Tanda 17 (Daniel, 2026-10-02): «En el movimiento del tablero quiero que haya un efecto de
 * deslizar, para que sea menos teletransporte». Las fichas (la tuya, los compañeros y los
 * enemigos) andan casilla a casilla por el camino de verdad, deprisa pero a la vista.
 *
 * El tablero se dibuja entero tras cada cosa que pasa, así que una ficha no «se mueve»: aparece
 * en otra casilla. `world-map-renderer.js` recuerda dónde estaba cada ficha en el dibujo anterior
 * y, si ha cambiado, la hace andar desde allí con una animación (Web Animations sobre `left` y
 * `top`). Si el tablero se vuelve a dibujar a medio camino (una tirada, un aviso), la animación
 * sigue donde iba en vez de saltar al final.
 *
 * Con «reducir movimiento» (ui/motion.js) no anda nada: la ficha aparece donde va, como antes.
 *
 * Puro: las cuentas. Quien dibuja las aplica.
 */

/** Lo que tarda en cruzar una casilla, normalmente. */
export const STEP_MS = 110;
/** Lo más que dura un camino entero: más largo (el grupo cruzando la sala), cada casilla va más deprisa. */
export const MAX_SLIDE_MS = 1100;
/** Más casillas que esto no es andar: es aparecer en otro sitio (colocarse, otra sala). */
export const MAX_SLIDE_STEPS = 40;

/**
 * @typedef {Object} Cell
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} Slide Una ficha andando: su camino (con la casilla de salida y la de llegada),
 * cuándo empezó y lo que dura.
 * @property {Cell[]} cells
 * @property {number} start En milisegundos (`performance.now()`).
 * @property {number} duration
 */

/**
 * @param {any} value
 * @returns {number}
 */
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

/**
 * @param {Cell|null|undefined} a
 * @param {Cell|null|undefined} b
 * @returns {boolean}
 */
export function sameCell(a, b) {
    return Boolean(a && b) && num(a?.x) === num(b?.x) && num(a?.y) === num(b?.y);
}

/**
 * El camino recto de una casilla a otra, paso a paso (también en diagonal), con las dos puntas.
 * Es lo que se anda si no hay camino calculado (un tablero sin terreno).
 *
 * @param {Cell} from
 * @param {Cell} to
 * @returns {Cell[]}
 */
export function stepLine(from, to) {
    const fx = num(from?.x);
    const fy = num(from?.y);
    const dx = num(to?.x) - fx;
    const dy = num(to?.y) - fy;
    const n = Math.max(Math.abs(dx), Math.abs(dy));
    /** @type {Cell[]} */
    const cells = [];
    for (let i = 0; i <= n; i++) {
        cells.push({ x: fx + (n ? Math.round((dx * i) / n) : 0), y: fy + (n ? Math.round((dy * i) / n) : 0) });
    }
    return cells;
}

/**
 * Si un camino sirve para andarlo: empieza en `from`, acaba en `to` y cada paso es a una casilla
 * de al lado.
 *
 * @param {any} path
 * @param {Cell} from
 * @param {Cell} to
 * @returns {boolean}
 */
function walkable(path, from, to) {
    if (!Array.isArray(path) || path.length < 2) return false;
    if (!sameCell(path[0], from) || !sameCell(path[path.length - 1], to)) return false;
    for (let i = 1; i < path.length; i++) {
        if (Math.max(Math.abs(num(path[i].x) - num(path[i - 1].x)), Math.abs(num(path[i].y) - num(path[i - 1].y))) !== 1) return false;
    }
    return true;
}

/**
 * Las casillas que se andan de `from` a `to`: el camino calculado (el mismo A* que usa el juego)
 * si sirve; si no, el recto. Nada si no se mueve o si está tan lejos que es un salto.
 *
 * @param {Cell} from
 * @param {Cell} to
 * @param {Cell[]|null} [path] Lo que da `findPath`, con las dos puntas.
 * @returns {Cell[]}
 */
export function slidePath(from, to, path = null) {
    if (!from || !to || sameCell(from, to)) return [];
    const cells = walkable(path, from, to) ? /** @type {Cell[]} */ (path) : stepLine(from, to);
    if (cells.length - 1 > MAX_SLIDE_STEPS) return [];
    return cells.map(c => ({ x: num(c.x), y: num(c.y) }));
}

/**
 * Lo que dura andar `steps` casillas: `STEP_MS` cada una, sin pasar de `MAX_SLIDE_MS` en total.
 * `scale` es el de ui/motion.js: 1 normal, 0,5 corto, 0 nada.
 *
 * @param {number} steps
 * @param {number} [scale]
 * @returns {number}
 */
export function slideDuration(steps, scale = 1) {
    const n = Math.max(0, Math.floor(num(steps)));
    const k = num(scale);
    if (n === 0 || k <= 0) return 0;
    const per = Math.min(STEP_MS, MAX_SLIDE_MS / n);
    return Math.round(per * n * k);
}

/**
 * Lo que le queda a una ficha andando, en milisegundos.
 *
 * @param {Slide|null|undefined} slide
 * @param {number} now
 * @returns {number}
 */
export function slideLeft(slide, now) {
    if (!slide || !(slide.duration > 0)) return 0;
    return Math.max(0, slide.start + slide.duration - num(now));
}

/**
 * Lo que le queda por andar, desde la casilla por la que va (la última que ha pisado).
 *
 * @param {Slide} slide
 * @param {number} now
 * @returns {Cell[]}
 */
export function cellsAhead(slide, now) {
    const steps = slide.cells.length - 1;
    const done = slide.duration > 0 ? Math.min(1, Math.max(0, (num(now) - slide.start) / slide.duration)) : 1;
    return slide.cells.slice(Math.min(steps, Math.floor(done * steps)));
}

/**
 * Lo que hace una ficha al dibujar el tablero otra vez.
 *
 * - Si iba andando y va a la misma casilla, sigue igual (la misma animación, por donde iba).
 * - Si iba andando y ahora va a otra, sigue desde la casilla por la que iba hasta la nueva.
 * - Si estaba quieta en otra casilla, anda desde allí.
 * - Si no se sabe dónde estaba (el primer dibujo, otro tablero) o no se ha movido, nada.
 *
 * @param {Object} input
 * @param {Cell|null} input.before Dónde estaba en el dibujo anterior.
 * @param {Slide|null} input.moving Lo que estaba andando, si no ha acabado.
 * @param {Cell} input.to Dónde está ahora.
 * @param {number} input.now
 * @param {(from: Cell, to: Cell) => (Cell[]|null)} [input.route] El camino entre dos casillas.
 * @param {number} [input.scale] El de ui/motion.js.
 * @returns {Slide|null}
 */
export function planSlide({ before, moving, to, now, route = () => null, scale = 1 }) {
    if (!(num(scale) > 0)) return null;
    if (moving && slideLeft(moving, now) > 0) {
        const end = moving.cells[moving.cells.length - 1];
        if (sameCell(end, to)) return moving;
        const ahead = cellsAhead(moving, now);
        const from = ahead[ahead.length - 1];
        const more = slidePath(from, to, safeRoute(route, from, to));
        if (more.length < 2) return null;
        const cells = [...ahead, ...more.slice(1)];
        if (cells.length - 1 > MAX_SLIDE_STEPS) return null;
        return { cells, start: num(now), duration: slideDuration(cells.length - 1, scale) };
    }
    if (!before || sameCell(before, to)) return null;
    const cells = slidePath(before, to, safeRoute(route, before, to));
    if (cells.length < 2) return null;
    return { cells, start: num(now), duration: slideDuration(cells.length - 1, scale) };
}

/**
 * @param {(from: Cell, to: Cell) => (Cell[]|null)} route
 * @param {Cell} from
 * @param {Cell} to
 * @returns {Cell[]|null}
 */
function safeRoute(route, from, to) {
    try {
        return route(from, to);
    } catch {
        return null;
    }
}

/**
 * Los fotogramas de la animación: el centro de cada casilla del camino, en píxeles del dibujo.
 *
 * @param {Cell[]} cells
 * @param {number} cellW
 * @param {number} cellH
 * @returns {Array<{left: string, top: string}>}
 */
export function slideFrames(cells, cellW, cellH) {
    return cells.map(c => ({ left: `${(num(c.x) + 0.5) * num(cellW)}px`, top: `${(num(c.y) + 0.5) * num(cellH)}px` }));
}
