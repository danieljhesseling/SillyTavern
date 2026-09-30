/**
 * J20.6 de ROADMAP_SIN_CONEXION: el tablero, ligero en el móvil.
 *
 * El tablero se vuelve a dibujar entero en cada paso de un combate. Lo que más pesa es la
 * niebla: una caja por casilla sin ver, y en un tablero de 50 × 50 a oscuras son 2.500 cajas
 * cada vez. Aquí se juntan las casillas iguales en rectángulos (una sala sin ver es una caja,
 * no cuatrocientas), y se dice qué parte del tablero cabe en la pantalla, para no dibujar lo
 * que queda fuera.
 *
 * Todo es cálculo: quien dibuja es `world-map-renderer.js`. Ver
 * `enganches-movil-app.md` para cómo se enchufa.
 */

import { getCellVisibility } from './fog-of-war.js';

/**
 * @typedef {Object} CellRect Casillas iguales juntas: `w` × `h` desde la casilla `x`, `y`.
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 * @property {string} kind
 */

/**
 * @typedef {Object} CellWindow Las casillas de `x0`…`x1` y `y0`…`y1`, las dos incluidas.
 * @property {number} x0
 * @property {number} y0
 * @property {number} x1
 * @property {number} y1
 */

/**
 * Junta las casillas del mismo tipo en rectángulos. Cada fila se parte en tramos seguidos del
 * mismo tipo, y un tramo que se repite igual (mismo principio, mismo largo, mismo tipo) en la
 * fila de debajo alarga el rectángulo de arriba. Se mira cada casilla una vez.
 *
 * @param {number} width Casillas de ancho.
 * @param {number} height Casillas de alto.
 * @param {(x: number, y: number) => (string|null|undefined)} kindAt El tipo de una casilla;
 *   `null` (o vacío) es que no se dibuja.
 * @param {CellWindow|null} [area] Solo esta parte del tablero.
 * @returns {CellRect[]}
 */
export function mergeCellRects(width, height, kindAt, area = null) {
    const w = Math.max(0, Math.floor(Number(width) || 0));
    const h = Math.max(0, Math.floor(Number(height) || 0));
    const x0 = Math.max(0, area ? area.x0 : 0);
    const y0 = Math.max(0, area ? area.y0 : 0);
    const x1 = Math.min(w - 1, area ? area.x1 : w - 1);
    const y1 = Math.min(h - 1, area ? area.y1 : h - 1);
    /** @type {CellRect[]} */
    const rects = [];
    /** Los rectángulos que siguen abiertos desde la fila de arriba, por tramo. @type {Map<string, CellRect>} */
    let open = new Map();
    for (let y = y0; y <= y1; y++) {
        /** @type {Map<string, CellRect>} */
        const next = new Map();
        let x = x0;
        while (x <= x1) {
            const kind = kindAt(x, y);
            if (!kind) {
                x++;
                continue;
            }
            let end = x + 1;
            while (end <= x1 && kindAt(end, y) === kind) end++;
            const key = `${x}:${end - x}:${kind}`;
            const above = open.get(key);
            if (above) {
                above.h++;
                next.set(key, above);
            } else {
                const rect = { x, y, w: end - x, h: 1, kind: String(kind) };
                rects.push(rect);
                next.set(key, rect);
            }
            x = end;
        }
        open = next;
    }
    return rects;
}

/**
 * La niebla en rectángulos: lo nunca visto (`unknown`) y lo visto antes pero no ahora
 * (`explored`). Lo que se ve ahora no se dibuja.
 *
 * @param {import('./fog-of-war.js').BoardFog|null|undefined} fog
 * @param {Set<string>|null|undefined} visible
 * @param {number} width
 * @param {number} height
 * @param {CellWindow|null} [area]
 * @returns {CellRect[]}
 */
export function fogRects(fog, visible, width, height, area = null) {
    return mergeCellRects(width, height, (x, y) => {
        const seen = getCellVisibility(/** @type {any} */ (fog), /** @type {any} */ (visible), x, y);
        return seen === 'visible' ? null : seen;
    }, area);
}

/**
 * Los rectángulos como HTML, para ponerlos de una vez (`innerHTML`) en vez de caja a caja.
 * El tipo solo puede traer letras, cifras y guiones: va en una clase.
 *
 * @param {CellRect[]} rects
 * @param {{cellWidth: number, cellHeight: number, className: string, kindPrefix?: string}} options
 * @returns {string}
 */
export function cellRectsHtml(rects, { cellWidth, cellHeight, className, kindPrefix = '' }) {
    const px = (/** @type {number} */ n) => `${Math.round(n * 1000) / 1000}px`;
    const safe = (/** @type {string} */ s) => String(s).replace(/[^a-z0-9-]/gi, '');
    return rects.map(r => `<div class="${safe(className)} ${safe(kindPrefix + r.kind)}" style="left:${px(r.x * cellWidth)};top:${px(r.y * cellHeight)};width:${px(r.w * cellWidth)};height:${px(r.h * cellHeight)}"></div>`).join('');
}

/**
 * @typedef {Object} ViewInput Lo que se sabe de la vista del tablero.
 * @property {number} viewWidth Lo que mide la caja del tablero en pantalla.
 * @property {number} viewHeight
 * @property {number} scale El zoom (`state.scale`).
 * @property {number} offsetX Cuánto se ha movido (`state.offsetX`).
 * @property {number} offsetY
 * @property {number} cellWidth Lo que mide una casilla sin zoom.
 * @property {number} cellHeight
 * @property {number} gridWidth
 * @property {number} gridHeight
 * @property {number} [margin] Casillas de más por cada lado, para poder mover un poco la vista sin redibujar.
 */

/**
 * Las casillas que caben en la pantalla, con un margen. `null` si el tablero queda entero
 * fuera de la vista (no hay nada que dibujar).
 *
 * El tablero se pinta con `translate(offsetX, offsetY) scale(scale)` desde su esquina: una
 * casilla `x` empieza en pantalla en `offsetX + x × cellWidth × scale`.
 *
 * @param {ViewInput} view
 * @returns {CellWindow|null}
 */
export function visibleWindow(view) {
    const scale = Number(view.scale) > 0 ? Number(view.scale) : 1;
    const cw = Number(view.cellWidth) > 0 ? Number(view.cellWidth) : 1;
    const ch = Number(view.cellHeight) > 0 ? Number(view.cellHeight) : 1;
    const gw = Math.max(0, Math.floor(Number(view.gridWidth) || 0));
    const gh = Math.max(0, Math.floor(Number(view.gridHeight) || 0));
    const margin = Math.max(0, Math.floor(view.margin ?? 2));
    if (!gw || !gh) return null;
    const left = -Number(view.offsetX || 0) / scale;
    const top = -Number(view.offsetY || 0) / scale;
    const right = left + Math.max(0, Number(view.viewWidth) || 0) / scale;
    const bottom = top + Math.max(0, Number(view.viewHeight) || 0) / scale;
    const x0 = Math.max(0, Math.floor(left / cw) - margin);
    const y0 = Math.max(0, Math.floor(top / ch) - margin);
    const x1 = Math.min(gw - 1, Math.ceil(right / cw) - 1 + margin);
    const y1 = Math.min(gh - 1, Math.ceil(bottom / ch) - 1 + margin);
    return x0 > x1 || y0 > y1 ? null : { x0, y0, x1, y1 };
}

/**
 * Si una casilla está dentro de la parte dibujada. Sin parte (`null`), todas lo están.
 *
 * @param {CellWindow|null} area
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function inWindow(area, x, y) {
    return !area || (x >= area.x0 && x <= area.x1 && y >= area.y0 && y <= area.y1);
}

/**
 * Si lo que ya está dibujado cubre lo que ahora se ve: si no, al mover o ampliar la vista hay
 * que redibujar. Mover la vista dentro del margen no cuesta nada.
 *
 * @param {CellWindow|null} drawn
 * @param {CellWindow|null} wanted
 * @returns {boolean}
 */
export function windowCovers(drawn, wanted) {
    if (!wanted) return true;
    if (!drawn) return false;
    return wanted.x0 >= drawn.x0 && wanted.x1 <= drawn.x1 && wanted.y0 >= drawn.y0 && wanted.y1 <= drawn.y1;
}
