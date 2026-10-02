/**
 * Tanda 10: el minimapa, abajo a la izquierda. Enseña el tablero entero en pequeño, con los
 * tuyos en azul y los enemigos que se ven en rojo, y un recuadro con lo que se ve ahora. Pulsarlo
 * lleva la cámara a ese punto. Ver wiki/maquetas/ENCARGO_COMBATE_VTT.md.
 *
 * No chiva nada: con niebla, lo que no se ha visto sale a oscuras, y un enemigo solo sale si se
 * le ve ahora, igual que en el tablero grande.
 *
 * Las cuentas son puras (`minimapLayout`, `viewOnMinimap`, `minimapToBoard`, `minimapCells`); el
 * dibujo va en un `<canvas>`, que se pinta de una vez, y el recuadro de la vista es una caja que
 * se mueve sin volver a pintar nada.
 */

import { parseCellKey } from '../../board/terrain.js';

/**
 * @typedef {Object} MinimapLayout Dónde cae el tablero dentro del minimapa.
 * @property {number} scale Píxeles del minimapa por píxel del dibujo.
 * @property {number} left
 * @property {number} top
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {Object} MinimapBlip Una ficha en el minimapa.
 * @property {number} x Columna.
 * @property {number} y Fila.
 * @property {'ally'|'enemy'|'npc'} side
 * @property {boolean} [active] La de quien tiene el turno.
 */

/**
 * @param {any} value
 * @returns {number}
 */
function num(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * El tablero entero dentro de la caja del minimapa, sin deformarlo y centrado.
 *
 * @param {Object} input
 * @param {number} input.boardW Lo que mide el dibujo sin acercar.
 * @param {number} input.boardH
 * @param {number} input.boxW Lo que mide la caja del minimapa.
 * @param {number} input.boxH
 * @returns {MinimapLayout}
 */
export function minimapLayout({ boardW, boardH, boxW, boxH }) {
    const bw = Math.max(1, num(boardW));
    const bh = Math.max(1, num(boardH));
    const scale = Math.min(Math.max(1, num(boxW)) / bw, Math.max(1, num(boxH)) / bh);
    const width = bw * scale;
    const height = bh * scale;
    return { scale, width, height, left: (num(boxW) - width) / 2, top: (num(boxH) - height) / 2 };
}

/**
 * El recuadro de lo que se ve, en el minimapa, recortado al tablero.
 *
 * @param {{scale: number, offsetX: number, offsetY: number}} view
 * @param {number} viewW
 * @param {number} viewH
 * @param {MinimapLayout} layout
 * @returns {{left: number, top: number, width: number, height: number}}
 */
export function viewOnMinimap(view, viewW, viewH, layout) {
    const scale = num(view?.scale) || 1;
    const x0 = (-num(view?.offsetX) / scale) * layout.scale;
    const y0 = (-num(view?.offsetY) / scale) * layout.scale;
    const x1 = x0 + (num(viewW) / scale) * layout.scale;
    const y1 = y0 + (num(viewH) / scale) * layout.scale;
    const left = Math.max(0, Math.min(layout.width, x0));
    const top = Math.max(0, Math.min(layout.height, y0));
    const right = Math.max(left, Math.min(layout.width, x1));
    const bottom = Math.max(top, Math.min(layout.height, y1));
    return { left: layout.left + left, top: layout.top + top, width: right - left, height: bottom - top };
}

/**
 * El punto del tablero (en píxeles del dibujo) que hay bajo un punto del minimapa.
 *
 * @param {number} px Contado desde la esquina de la caja del minimapa.
 * @param {number} py
 * @param {MinimapLayout} layout
 * @param {{width: number, height: number}} board
 * @returns {{x: number, y: number}}
 */
export function minimapToBoard(px, py, layout, board) {
    const s = layout.scale || 1;
    return {
        x: Math.max(0, Math.min(num(board?.width), (num(px) - layout.left) / s)),
        y: Math.max(0, Math.min(num(board?.height), (num(py) - layout.top) / s)),
    };
}

/** El color de cada clase de casilla en el minimapa; el suelo es el fondo. */
export const MINIMAP_COLORS = {
    floor: '#3b3a2e',
    wall: '#6b6b78',
    water: '#2d6e96',
    deep_water: '#1c4a73',
    difficult: '#7a6233',
    brush: '#3f6b2c',
    ice: '#8fb7c9',
    chasm: '#0a0a0a',
    high: '#57523f',
    door: '#a4793d',
    chest: '#c9a24a',
    lever: '#c9a24a',
    barricade: '#8a5a2b',
    stairs: '#8c8470',
    exit: '#6f9e5d',
    barrel: '#7a5a34',
    cover_half: '#5a5a62',
    cover_three_quarters: '#5a5a62',
    unknown: '#050505',
    explored: 'rgba(0, 0, 0, 0.45)',
};

/**
 * Las casillas que hay que pintar, de una clase cada una: el terreno que no es suelo y, con
 * niebla, lo no visto (`unknown`) y lo visto antes (`explored`, por encima de su terreno).
 *
 * @param {Object} input
 * @param {{cells?: Record<string, {type: string}>}|null} [input.terrain]
 * @param {{explored?: Record<string, true>}|null} [input.fog]
 * @param {Set<string>|null} [input.visible]
 * @param {boolean} [input.fogEnabled]
 * @param {number} input.gridW
 * @param {number} input.gridH
 * @returns {Array<{x: number, y: number, kind: string}>}
 */
export function minimapCells({ terrain = null, fog = null, visible = null, fogEnabled = false, gridW, gridH }) {
    /** @type {Array<{x: number, y: number, kind: string}>} */
    const cells = [];
    const known = (/** @type {string} */ key) => !fogEnabled || (visible instanceof Set && visible.has(key)) || Boolean(fog?.explored?.[key]);
    for (const [key, cell] of Object.entries(terrain?.cells ?? {})) {
        const at = parseCellKey(key);
        if (!at || !cell || at.x < 0 || at.y < 0 || at.x >= gridW || at.y >= gridH) continue;
        if (!known(key)) continue;
        const kind = cell.type === 'door' && /** @type {any} */ (cell).open ? 'floor' : String(cell.type);
        if (kind !== 'floor') cells.push({ x: at.x, y: at.y, kind });
    }
    if (fogEnabled) {
        for (let y = 0; y < gridH; y++) {
            for (let x = 0; x < gridW; x++) {
                const key = `${x},${y}`;
                if (visible instanceof Set && visible.has(key)) continue;
                cells.push({ x, y, kind: fog?.explored?.[key] ? 'explored' : 'unknown' });
            }
        }
    }
    return cells;
}

/**
 * @typedef {Object} MinimapModel Lo que se pinta.
 * @property {number} gridW
 * @property {number} gridH
 * @property {number} boardW Lo que mide el dibujo sin acercar.
 * @property {number} boardH
 * @property {Array<{x: number, y: number, kind: string}>} cells
 * @property {MinimapBlip[]} blips
 */

/**
 * @typedef {Object} MinimapHandle
 * @property {HTMLElement} root
 * @property {(model: MinimapModel) => void} draw Pinta el tablero y las fichas.
 * @property {(view: {scale: number, offsetX: number, offsetY: number}, viewW: number, viewH: number) => void} setView
 * @property {(label: string) => void} setZoom
 */

/**
 * La isla del minimapa. `onPick` recibe el punto del tablero (en píxeles del dibujo) que se ha
 * pulsado; la cámara va ahí.
 *
 * @param {{onPick: (point: {x: number, y: number}) => void, title?: string}} options
 * @returns {MinimapHandle}
 */
export function createMinimap({ onPick, title = 'Vista del tablero' }) {
    const root = document.createElement('div');
    root.className = 'vtt-minimap vtt-island';

    const head = document.createElement('div');
    head.className = 'vtt-minimap-head';
    const name = document.createElement('span');
    name.className = 'vtt-minimap-title';
    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-map';
    icon.setAttribute('aria-hidden', 'true');
    name.append(icon, document.createTextNode(` ${title}`));
    const zoom = document.createElement('span');
    zoom.className = 'vtt-minimap-zoom';
    head.append(name, zoom);

    const box = document.createElement('div');
    box.className = 'vtt-minimap-box';
    box.setAttribute('role', 'button');
    box.title = 'Pulsa para llevar la vista ahí';
    const canvas = document.createElement('canvas');
    canvas.className = 'vtt-minimap-canvas';
    const frame = document.createElement('div');
    frame.className = 'vtt-minimap-view';
    box.append(canvas, frame);
    root.append(head, box);

    /** @type {MinimapModel|null} */
    let model = null;
    /** @type {MinimapLayout|null} */
    let layout = null;
    /** @type {{view: any, viewW: number, viewH: number}|null} */
    let lastView = null;

    const measure = () => {
        const w = box.clientWidth || 180;
        const h = box.clientHeight || 110;
        return { w, h };
    };

    const paint = () => {
        if (!model) return;
        const { w, h } = measure();
        layout = minimapLayout({ boardW: model.boardW, boardH: model.boardH, boxW: w, boxH: h });
        const ratio = Math.max(1, Math.min(2, globalThis.devicePixelRatio || 1));
        if (canvas.width !== Math.round(w * ratio)) canvas.width = Math.round(w * ratio);
        if (canvas.height !== Math.round(h * ratio)) canvas.height = Math.round(h * ratio);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.clearRect(0, 0, w, h);
        const cw = layout.width / Math.max(1, model.gridW);
        const ch = layout.height / Math.max(1, model.gridH);
        ctx.fillStyle = MINIMAP_COLORS.floor;
        ctx.fillRect(layout.left, layout.top, layout.width, layout.height);
        for (const cell of model.cells) {
            ctx.fillStyle = MINIMAP_COLORS[/** @type {keyof typeof MINIMAP_COLORS} */ (cell.kind)] ?? MINIMAP_COLORS.wall;
            // Medio píxel de más: sin él, entre casilla y casilla se ven rayas del fondo.
            ctx.fillRect(layout.left + cell.x * cw, layout.top + cell.y * ch, cw + 0.5, ch + 0.5);
        }
        const dot = Math.max(3, Math.min(7, Math.min(cw, ch) * 0.9));
        for (const blip of model.blips) {
            const x = layout.left + (num(blip.x) + 0.5) * cw;
            const y = layout.top + (num(blip.y) + 0.5) * ch;
            ctx.beginPath();
            ctx.arc(x, y, dot / 2 + (blip.active ? 1 : 0), 0, Math.PI * 2);
            ctx.fillStyle = blip.side === 'enemy' ? '#f87171' : blip.side === 'npc' ? '#e2c27a' : '#60a5fa';
            ctx.fill();
            if (blip.active) {
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = '#ffd27a';
                ctx.stroke();
            }
        }
        if (lastView) placeFrame();
    };

    const placeFrame = () => {
        if (!layout || !lastView) return;
        const rect = viewOnMinimap(lastView.view, lastView.viewW, lastView.viewH, layout);
        frame.style.left = `${rect.left}px`;
        frame.style.top = `${rect.top}px`;
        frame.style.width = `${rect.width}px`;
        frame.style.height = `${rect.height}px`;
        frame.hidden = rect.width <= 0 || rect.height <= 0;
    };

    box.addEventListener('click', (event) => {
        event.stopPropagation();
        if (!model) return;
        if (!layout) paint();
        if (!layout) return;
        const at = box.getBoundingClientRect();
        onPick(minimapToBoard(event.clientX - at.left, event.clientY - at.top, layout, { width: model.boardW, height: model.boardH }));
    });

    return {
        root,
        draw(next) {
            model = next;
            paint();
        },
        setView(view, viewW, viewH) {
            lastView = { view: { scale: view.scale, offsetX: view.offsetX, offsetY: view.offsetY }, viewW, viewH };
            if (!layout && model) paint();
            placeFrame();
        },
        setZoom(label) {
            if (zoom.textContent !== label) zoom.textContent = label;
        },
    };
}
