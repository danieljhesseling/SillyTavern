/**
 * La pantalla que convierte un mapa de D&D en imagen en un tablero (J12.8 a J12.11 de
 * wiki/ROADMAP_SIN_CONEXION.md). Se abre desde el editor de tableros del mundo
 * (`world-info.js`, «Subir mapa en cuadrícula» y «Retocar el mapa»).
 *
 * Cuatro pasos sobre el mismo dibujo, con lo leído pintado encima:
 * 1. **La cuadrícula**: se busca sola. Si no cae sobre la del dibujo, se dice el lado de la
 *    casilla, cuántas casillas tiene de ancho, o se marca una casilla arrastrando.
 * 2. **Las casillas**: muro, suelo, terreno difícil y puertas. Lo dudoso sale en amarillo, y se
 *    pinta encima con los pinceles del taller.
 * 3. **Las salas**: se pulsa en una y se le pone nombre y nota (`regionAt` → una zona). Aquí se
 *    sube también la versión limpia del mapa, sin etiquetas: se trabaja sobre la que las tiene
 *    y se juega sobre la otra.
 * 4. **Las alturas**: se pulsa en una meseta o un puente y se le da su cota en pies.
 *
 * Al aceptar, la imagen se recorta a la cuadrícula y se sube como archivo, no como data URL
 * dentro del mundo (un mapa así pesa un mega), y se devuelve lo que va en el tablero. La vista
 * del tablero no cambia: reparte la imagen entera entre las casillas, como siempre.
 *
 * Solo dibuja y recoge: lo que decide está en `board/map-image.js` y `board/map-edit.js`.
 */

import { classifyCells, detectGrid, gridCrop, gridFromCell, makeGrid, regionAt } from '../board/map-image.js';
import { cliffEdges, elevationAt, normalizeElevation } from '../board/heights.js';
import { normalizeZones, zoneCells } from '../board/zones.js';
import { cellKey, parseCellKey } from '../board/terrain.js';
import {
    MAP_BRUSHES, MAP_CLIFF_FEET, applyHeight, boardFromEdit, charWord, describeGrid, describeRows, feetWord,
    gridForOtherImage, gridFromBoard, heightGroups, kindsFromRows, paintAt, readingMarks, removeZone,
    rowsFromBoard, rowsFromReading, saveZone, zoneIndexAt, zoneProblems,
} from '../board/map-edit.js';

/**
 * @typedef {import('../board/map-image.js').MapGrid} MapGrid
 * @typedef {import('../board/map-image.js').MapPixels} MapPixels
 * @typedef {import('../board/zones.js').BoardZone} BoardZone
 */

/**
 * @typedef {Object} Picture
 * @property {string} src     Lo que se pone en el `<img>`.
 * @property {HTMLImageElement} img
 * @property {MapPixels} pixels
 * @property {'png'|'jpg'} type Cómo se guarda el recorte: un PNG sigue siendo PNG.
 * @property {string} name
 * @property {boolean} owned  Si `src` es un object URL de aquí, que hay que soltar al cerrar.
 */

/** Más grande que esto no se lee: solo los píxeles serían 160 MB. */
const MAX_PIXELS = 40_000_000;

/** Los pasos, en orden. */
const STEPS = [
    { id: 'grid', label: '1 · Cuadrícula' },
    { id: 'terrain', label: '2 · Casillas' },
    { id: 'zones', label: '3 · Salas' },
    { id: 'heights', label: '4 · Alturas' },
];

/** Lo que se dice arriba de cada paso: qué hay que mirar y qué hacer. */
const STEP_HINTS = {
    grid: '¿Cae la cuadrícula azul sobre la del dibujo? Si no, ajústala.',
    terrain: 'Mira lo leído. Si algo está mal, elige un pincel y pinta encima.',
    zones: 'Pulsa en una sala del mapa. Luego ponle nombre y, si quieres, una nota.',
    heights: 'Pulsa en una meseta, un puente o una escalera. Luego di su altura en pies.',
};

/** El color de cada casilla pintada, encima del dibujo. El suelo no se pinta. */
const CHAR_FILL = {
    '#': 'rgba(170, 30, 30, 0.5)',
    '~': 'rgba(215, 150, 40, 0.5)',
    'D': 'rgba(40, 120, 235, 0.65)',
    'L': 'rgba(40, 120, 235, 0.65)',
    'o': 'rgba(40, 120, 235, 0.45)',
    'c': 'rgba(120, 120, 120, 0.5)',
    'C': 'rgba(70, 70, 70, 0.6)',
    'w': 'rgba(40, 170, 230, 0.5)',
    'W': 'rgba(20, 70, 150, 0.65)',
    'x': 'rgba(40, 190, 100, 0.55)',
};

/** Colores de las salas, uno por sala, por turnos. */
const ZONE_HUES = [45, 160, 280, 10, 200, 100, 320, 240];

/** Los tamaños del mapa en pantalla, respecto a caber de ancho. */
const ZOOMS = [1, 1.5, 2, 3, 4];

/**
 * Un elemento con clase y texto.
 *
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {string} [className]
 * @param {string} [text]
 * @returns {HTMLElementTagNameMap[K]}
 */
function el(tag, className = '', text = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
}

/**
 * Un botón.
 *
 * @param {string} label
 * @param {string} className
 * @param {() => void} onClick
 * @returns {HTMLButtonElement}
 */
function button(label, className, onClick) {
    const node = el('button', `menu_button mie-btn ${className}`.trim(), label);
    node.type = 'button';
    node.addEventListener('click', (event) => {
        event.preventDefault();
        onClick();
    });
    return node;
}

/**
 * Un campo con su etiqueta.
 *
 * @param {string} label
 * @param {HTMLElement} control
 * @returns {HTMLLabelElement}
 */
function field(label, control) {
    const wrap = el('label', 'mie-field');
    wrap.append(el('span', 'mie-field-label', label), control);
    return wrap;
}

/**
 * Una caja de número.
 *
 * @param {string} className
 * @param {{step?: string, min?: string}} [options]
 * @returns {HTMLInputElement}
 */
function numberBox(className, options = {}) {
    const input = el('input', `text_pole mie-num ${className}`);
    input.type = 'number';
    input.step = options.step ?? 'any';
    if (options.min !== undefined) input.min = options.min;
    return input;
}

/**
 * «1 casilla», «5 casillas».
 *
 * @param {number} n
 * @returns {string}
 */
function cellCount(n) {
    return n === 1 ? '1 casilla' : `${n} casillas`;
}

/** Espera a que el navegador pinte (para que «Leyendo el mapa…» se vea antes de ponerse a leer). */
const nextFrame = () => new Promise(resolve => setTimeout(resolve, 30));

/**
 * Abre una imagen y lee sus píxeles.
 *
 * @param {File|string} source Un archivo recién elegido, o la ruta de la imagen de un tablero.
 * @returns {Promise<Picture>}
 */
export async function loadPicture(source) {
    const owned = typeof source !== 'string';
    const src = owned ? URL.createObjectURL(/** @type {File} */ (source)) : String(source);
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    try {
        await img.decode();
    } catch {
        if (owned) URL.revokeObjectURL(src);
        throw new Error('No se puede abrir esa imagen.');
    }
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (!width || !height || width * height > MAX_PIXELS) {
        if (owned) URL.revokeObjectURL(src);
        throw new Error(width * height > MAX_PIXELS
            ? 'La imagen es demasiado grande. Redúcela a menos de 6000 píxeles de lado.'
            : 'No se puede abrir esa imagen.');
    }
    const canvas = el('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d', { willReadFrequently: true }));
    context.drawImage(img, 0, 0);
    /** @type {Uint8ClampedArray} */
    let data;
    try {
        data = context.getImageData(0, 0, width, height).data;
    } catch {
        if (owned) URL.revokeObjectURL(src);
        throw new Error('Esta imagen no se puede leer desde aquí. Súbela desde tu equipo.');
    }
    const file = owned ? /** @type {File} */ (source) : null;
    const isPng = file ? /png/i.test(file.type) : /^data:image\/png|\.png($|[?#])/i.test(src);
    return {
        src,
        img,
        pixels: { width, height, data },
        type: isPng ? 'png' : 'jpg',
        name: file ? file.name : src.startsWith('data:') ? 'imagen' : decodeURIComponent(src.split(/[?#]/)[0].split('/').pop() || 'imagen'),
        owned,
    };
}

/**
 * El trozo de la imagen que ocupa la cuadrícula, en base64, listo para subir.
 *
 * @param {Picture} picture
 * @param {MapGrid} grid
 * @returns {{base64: string, width: number, height: number}}
 */
function cropToBase64(picture, grid) {
    const crop = gridCrop(grid);
    const canvas = el('canvas');
    canvas.width = Math.max(1, crop.width);
    canvas.height = Math.max(1, crop.height);
    const context = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
    // Papel blanco debajo: si la última casilla se sale un pelo de la imagen, no queda un
    // borde transparente.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(picture.img, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
    const url = picture.type === 'png' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.92);
    return { base64: url.slice(url.indexOf(',') + 1), width: canvas.width, height: canvas.height };
}

/**
 * @typedef {Object} MapEditorInput
 * @property {File|null} [file]     Un mapa recién elegido.
 * @property {string} [imageUrl]    O la imagen de un tablero que ya tiene mapa, para retocarlo.
 * @property {any} [board]          El tablero, con lo que ya tenga (`grid`, `terrain`, `zones`, `elevation`).
 * @property {any} Popup
 * @property {any} POPUP_TYPE
 * @property {any} POPUP_RESULT
 * @property {(base64: string, extension: string, name: string) => Promise<string>} saveImage Sube la
 *   imagen recortada y dice su ruta. La pone quien abre la pantalla (en el mundo, `saveBase64AsFile`).
 */

/**
 * @typedef {Object} MapBoardPatch Lo que va en el tablero.
 * @property {string} url
 * @property {{cell: number, offsetX: number, offsetY: number, cols: number, rows: number}} grid
 * @property {number} gridWidth
 * @property {number} gridHeight
 * @property {import('../board/terrain.js').BoardTerrain} terrain
 * @property {BoardZone[]} zones
 * @property {Record<string, number>} elevation
 */

/**
 * Abrir la pantalla. Devuelve lo que va en el tablero, o `null` si se cancela.
 *
 * @param {MapEditorInput} input
 * @returns {Promise<MapBoardPatch|null>}
 */
export async function openMapImageEditor(input) {
    const { file = null, imageUrl = '', board = {}, Popup, POPUP_TYPE, POPUP_RESULT, saveImage } = input;
    const picture = await loadPicture(file ?? imageUrl);
    const { pixels } = picture;
    const retouch = !file;

    // ---- Lo que se edita ------------------------------------------------------------------
    const state = {
        step: 'grid',
        /** @type {MapGrid} */
        grid: /** @type {MapGrid} */ ({ cell: 0, offsetX: 0, offsetY: 0, cols: 0, rows: 0, confidence: 0, source: 'auto' }),
        /** Si `rows` es la lectura de la cuadrícula de ahora. */
        rowsValid: false,
        /** Si se ha pintado algo desde la última lectura (para avisar antes de perderlo). */
        painted: false,
        /** @type {string[]} */
        rows: [],
        /** @type {import('../board/map-edit.js').ReadingMarks|null} */
        marks: null,
        /** Las casillas dudosas que ya se han mirado (pintado encima). */
        reviewed: new Set(),
        /** @type {BoardZone[]} */
        zones: normalizeZones(board?.zones),
        /** @type {Record<string, number>} */
        elevation: normalizeElevation(board?.elevation),
        brush: '#',
        showTerrain: true,
        /** @type {Set<string>} */
        selection: new Set(),
        /** @type {'region'|'cell'} */
        selectMode: 'region',
        editingZone: -1,
        /** Lo escrito de la sala que se está haciendo: no se pierde al elegir más casillas. */
        zoneDraft: { name: '', note: '' },
        /** La altura escrita. */
        feet: 30,
        /** @type {string|null} La casilla dudosa que se está enseñando. */
        focus: null,
        /** @type {Picture|null} La versión limpia, para jugar (J12.11). */
        playPicture: null,
        /** Si hay que recortar y subir la imagen al aceptar. */
        imageDirty: !retouch,
        zoom: 0,
        /** @type {{x: number, y: number}|null} */
        hover: null,
        marking: false,
        /** @type {{x0: number, y0: number, x1: number, y1: number}|null} */
        mark: null,
        busy: false,
    };

    // Retocar: la cuadrícula, el terreno, las salas y las alturas que ya tiene el tablero.
    const saved = retouch ? gridFromBoard(board, pixels.width, pixels.height) : null;
    if (saved) {
        state.grid = saved;
        state.rows = rowsFromBoard(board, saved.cols, saved.rows);
        state.rowsValid = true;
    }

    // ---- La pantalla ----------------------------------------------------------------------
    const root = el('div', 'mie-root');
    const head = el('div', 'mie-head');
    head.append(el('div', 'mie-title', 'Mapa en cuadrícula'), el('div', 'mie-file', picture.name));
    const tabs = el('div', 'mie-tabs');
    tabs.setAttribute('role', 'tablist');
    for (const step of STEPS) {
        const tab = button(step.label, 'mie-tab', () => void goTo(step.id));
        tab.dataset.step = step.id;
        tab.setAttribute('role', 'tab');
        tabs.append(tab);
    }
    head.append(tabs);

    const body = el('div', 'mie-body');
    const side = el('div', 'mie-side');
    const hint = el('div', 'mie-hint');
    const panel = el('div', 'mie-panel');
    const say = el('div', 'mie-say');
    say.setAttribute('role', 'status');
    side.append(hint, panel, say);

    const viewWrap = el('div', 'mie-view-wrap');
    const zoomBar = el('div', 'mie-zoom');
    const view = el('div', 'mie-view');
    const stage = el('div', 'mie-stage');
    const image = el('img', 'mie-img');
    image.src = picture.src;
    image.alt = 'El mapa';
    image.draggable = false;
    const overlay = el('canvas', 'mie-overlay');
    stage.append(image, overlay);
    view.append(stage);
    const status = el('div', 'mie-status', ' ');
    viewWrap.append(zoomBar, view, status);
    body.append(side, viewWrap);
    root.append(head, body);

    zoomBar.append(
        button('−', 'mie-zoom-out', () => setZoom(state.zoom - 1)),
        button('+', 'mie-zoom-in', () => setZoom(state.zoom + 1)),
        button('Ajustar', 'mie-zoom-fit', () => setZoom(0)),
    );

    /**
     * Decir algo en el panel.
     * @param {string} text
     * @param {'info'|'error'|'ok'} [kind]
     */
    function tell(text, kind = 'info') {
        say.textContent = text;
        say.dataset.kind = kind;
    }

    /** @param {number} level */
    function setZoom(level) {
        state.zoom = Math.max(0, Math.min(ZOOMS.length - 1, level));
        stage.style.width = `${ZOOMS[state.zoom] * 100}%`;
        draw();
    }

    // ---- La cuadrícula y la lectura -----------------------------------------------------------

    /**
     * Poner una cuadrícula nueva. Si cambia, lo leído deja de valer (las casillas son otras); las
     * salas y las alturas se quedan si el tablero sigue midiendo lo mismo.
     *
     * @param {MapGrid} grid
     */
    function setGrid(grid) {
        const before = state.grid;
        const same = before.cell === grid.cell && before.offsetX === grid.offsetX && before.offsetY === grid.offsetY
            && before.cols === grid.cols && before.rows === grid.rows;
        state.grid = grid;
        if (same) return;
        const lost = state.painted;
        state.rowsValid = false;
        state.painted = false;
        state.marks = null;
        state.reviewed = new Set();
        state.imageDirty = true;
        state.selection = new Set();
        const resized = before.cols !== grid.cols || before.rows !== grid.rows;
        const hadMore = state.zones.length > 0 || Object.keys(state.elevation).length > 0;
        if (resized) {
            state.zones = [];
            state.elevation = {};
            state.editingZone = -1;
        }
        const notes = [describeGrid(grid)];
        if (lost) notes.push('Lo pintado se pierde: se vuelve a leer el mapa.');
        if (resized && hadMore) notes.push('Las salas y alturas se han quitado: el tablero mide otra cosa.');
        tell(notes.join(' '), grid.cols > 0 ? 'info' : 'error');
    }

    /** Leer qué es cada casilla con la cuadrícula de ahora. */
    function read() {
        const reading = classifyCells(pixels, state.grid);
        state.rows = rowsFromReading(reading);
        state.marks = readingMarks(reading);
        state.reviewed = new Set();
        state.rowsValid = true;
        state.painted = false;
        state.focus = null;
    }

    /**
     * Algo que tarda (buscar la cuadrícula, leer el mapa): se dice antes, y se espera a que se vea.
     *
     * @param {string} label
     * @param {() => void} work
     */
    async function busy(label, work) {
        state.busy = true;
        root.classList.add('is-busy');
        tell(label);
        await nextFrame();
        try {
            work();
        } finally {
            state.busy = false;
            root.classList.remove('is-busy');
            // Si lo hecho no ha dicho nada, el aviso de espera se quita.
            if (say.textContent === label) tell('');
        }
    }

    /** Que haya lectura para la cuadrícula de ahora. */
    async function ensureRows() {
        if (state.rowsValid || !(state.grid.cols > 0)) return;
        await busy('Leyendo el mapa…', read);
    }

    /** @param {string} step */
    async function goTo(step) {
        if (state.busy) return;
        if (step !== 'grid' && !(state.grid.cols > 0)) {
            tell('Antes hace falta la cuadrícula.', 'error');
            step = 'grid';
        }
        state.step = step;
        state.selection = new Set();
        state.editingZone = -1;
        state.marking = false;
        state.mark = null;
        if (step !== 'grid') await ensureRows();
        render();
    }

    // ---- Los paneles de cada paso -----------------------------------------------------------

    function render() {
        for (const tab of tabs.querySelectorAll('.mie-tab')) {
            const on = /** @type {HTMLElement} */ (tab).dataset.step === state.step;
            tab.classList.toggle('on', on);
            tab.setAttribute('aria-selected', String(on));
        }
        root.dataset.step = state.step;
        hint.textContent = STEP_HINTS[state.step];
        panel.replaceChildren();
        if (state.step === 'grid') renderGrid();
        else if (state.step === 'terrain') renderTerrain();
        else if (state.step === 'zones') renderZones();
        else renderHeights();
        draw();
    }

    /** @param {string} label @param {string} step */
    function nextButton(label, step) {
        return button(label, 'mie-next', () => void goTo(step));
    }

    function renderGrid() {
        const summary = el('div', 'mie-summary', describeGrid(state.grid));
        panel.append(summary);

        const cell = numberBox('mie-cell', { step: '0.01', min: '4' });
        const offX = numberBox('mie-offx', { step: '0.01' });
        const offY = numberBox('mie-offy', { step: '0.01' });
        cell.value = String(state.grid.cell || '');
        offX.value = String(state.grid.offsetX ?? 0);
        offY.value = String(state.grid.offsetY ?? 0);
        const exact = el('div', 'mie-group');
        exact.append(el('div', 'mie-group-title', 'A mano'), field('Lado de la casilla (px)', cell));
        const offsets = el('div', 'mie-pair');
        offsets.append(field('Empieza en x', offX), field('y', offY));
        exact.append(offsets, button('Aplicar', 'mie-apply', () => {
            const size = Number(cell.value);
            if (!(size >= 4)) {
                tell('El lado de la casilla tiene que ser de 4 píxeles o más.', 'error');
                return;
            }
            setGrid(makeGrid({ cell: size, offsetX: Number(offX.value) || 0, offsetY: Number(offY.value) || 0 }, pixels.width, pixels.height));
            render();
        }));

        const across = numberBox('mie-across', { step: '1', min: '2' });
        if (state.grid.cols > 0) across.value = String(state.grid.cols);
        const count = el('div', 'mie-group');
        count.append(el('div', 'mie-group-title', 'Contando casillas'), field('Casillas de ancho', across), button('Buscar', 'mie-across-go', () => {
            const n = Math.floor(Number(across.value));
            if (!(n >= 2)) {
                tell('Cuenta las casillas del dibujo de lado a lado: al menos 2.', 'error');
                return;
            }
            void busy('Buscando la cuadrícula…', () => {
                // Quien cuenta, cuenta las casillas dibujadas; la imagen suele tener además un
                // margen. Así que la casilla mide entre el ancho entre n y el ancho entre n + 2
                // (hasta una casilla de margen a cada lado), y se busca solo ahí.
                const found = detectGrid(pixels, { minCell: (pixels.width / (n + 2)) * 0.99, maxCell: (pixels.width / n) * 1.01 });
                setGrid(found.cols > 0 && Math.abs(found.cols - n) <= 1
                    ? { ...found, source: 'manual' }
                    : makeGrid({ cell: pixels.width / n }, pixels.width, pixels.height));
            }).then(render);
        }));

        const marking = el('div', 'mie-group');
        const markButton = button(state.marking ? 'Arrastra sobre una casilla…' : 'Marcar una casilla', 'mie-mark', () => {
            state.marking = !state.marking;
            state.mark = null;
            render();
            if (state.marking) tell('Arrastra un recuadro de esquina a esquina de una casilla del dibujo.');
        });
        markButton.classList.toggle('on', state.marking);
        marking.append(el('div', 'mie-group-title', 'Sobre el dibujo'), markButton,
            button('Buscar sola', 'mie-auto', () => void busy('Buscando la cuadrícula…', () => setGrid(detectGrid(pixels))).then(render)));

        panel.append(exact, count, marking, nextButton('Siguiente: las casillas', 'terrain'));
    }

    function renderTerrain() {
        const marks = state.marks;
        panel.append(el('div', 'mie-summary', describeRows(state.rows)));
        const left = pendingDoubtful();
        if (marks) {
            const legend = el('ul', 'mie-legend');
            const item = (/** @type {string} */ swatch, /** @type {string} */ text) => {
                const li = el('li');
                li.append(el('span', `mie-swatch ${swatch}`), document.createTextNode(text));
                legend.append(li);
            };
            item('is-doubt', marks.doubtful.length ? `Dudosas: ${left.length} de ${marks.doubtful.length}` : 'Dudosas: ninguna');
            if (marks.doors.length) item('is-door', `Puertas propuestas: ${marks.doors.length}`);
            if (marks.bridges.length) item('is-bridge', `Puentes propuestos: ${marks.bridges.length}`);
            panel.append(legend);
            if (left.length > 0) {
                panel.append(button('Ver la siguiente dudosa', 'mie-next-doubt', () => {
                    const pending = pendingDoubtful();
                    if (pending.length === 0) return;
                    const at = state.focus ? pending.indexOf(state.focus) : -1;
                    state.focus = pending[(at + 1) % pending.length];
                    const cell = /** @type {{x: number, y: number}} */ (parseCellKey(state.focus));
                    tell(`Casilla (${cell.x + 1}, ${cell.y + 1}): ${marks.notes[state.focus] ?? ''}. Si está bien, déjala; si no, píntala.`);
                    scrollToCell(cell.x, cell.y);
                    draw();
                }));
            }
        }

        const palette = el('div', 'mie-palette');
        palette.setAttribute('role', 'toolbar');
        palette.setAttribute('aria-label', 'Pinceles');
        for (const option of MAP_BRUSHES) {
            const brush = button('', 'mie-brush', () => {
                state.brush = option.id;
                for (const other of palette.children) {
                    const on = /** @type {HTMLElement} */ (other).dataset.brush === state.brush;
                    other.classList.toggle('on', on);
                    other.setAttribute('aria-pressed', String(on));
                }
            });
            brush.dataset.brush = option.id;
            const swatch = el('span', 'mie-swatch');
            swatch.style.background = CHAR_FILL[option.id] ?? 'transparent';
            brush.append(swatch, document.createTextNode(option.label));
            brush.classList.toggle('on', option.id === state.brush);
            brush.setAttribute('aria-pressed', String(option.id === state.brush));
            palette.append(brush);
        }
        panel.append(el('div', 'mie-group-title', 'Pincel'), palette);

        const show = el('input');
        show.type = 'checkbox';
        show.checked = state.showTerrain;
        show.addEventListener('change', () => {
            state.showTerrain = show.checked;
            draw();
        });
        const showLabel = el('label', 'mie-check');
        showLabel.append(show, document.createTextNode(' Ver los colores encima'));
        panel.append(showLabel, button('Leer otra vez', 'mie-reread', () => {
            void busy('Leyendo el mapa…', read).then(() => {
                tell('Leído otra vez. Lo pintado se ha perdido.');
                render();
            });
        }), nextButton('Siguiente: las salas', 'zones'));
    }

    /** Las dudosas que nadie ha mirado todavía. */
    function pendingDoubtful() {
        return (state.marks?.doubtful ?? []).filter(key => !state.reviewed.has(key));
    }

    /**
     * Elegir entre pulsar una región entera o casilla a casilla.
     * @param {string} regionLabel
     * @returns {HTMLDivElement}
     */
    function modeSwitch(regionLabel) {
        const wrap = el('div', 'mie-mode');
        for (const [mode, label] of /** @type {Array<['region'|'cell', string]>} */ ([['region', regionLabel], ['cell', 'Casilla a casilla']])) {
            const option = button(label, 'mie-mode-btn', () => {
                state.selectMode = mode;
                render();
            });
            option.dataset.mode = mode;
            option.classList.toggle('on', state.selectMode === mode);
            wrap.append(option);
        }
        return wrap;
    }

    function renderZones() {
        panel.append(modeSwitch('Sala entera'));
        const editing = state.editingZone >= 0 ? state.zones[state.editingZone] : null;
        const name = el('input', 'text_pole mie-zone-name');
        name.type = 'text';
        name.placeholder = 'B1, La capilla…';
        name.value = state.zoneDraft.name;
        name.addEventListener('input', () => { state.zoneDraft.name = name.value; });
        const note = el('textarea', 'text_pole mie-zone-note');
        note.rows = 3;
        note.placeholder = 'Quién espera, qué hay, qué se lee al entrar.';
        note.value = state.zoneDraft.note;
        note.addEventListener('input', () => { state.zoneDraft.note = note.value; });
        const selected = el('div', 'mie-selected', state.selection.size
            ? `${cellCount(state.selection.size)} ${state.selection.size === 1 ? 'elegida' : 'elegidas'}${editing ? ` · cambiando «${editing.name}»` : ''}`
            : 'Ninguna casilla elegida: pulsa en el mapa.');
        const saveIt = () => {
            const result = saveZone(state.zones, { name: name.value, note: note.value, cells: [...state.selection] }, state.editingZone);
            if (result.error) {
                tell(result.error, 'error');
                return;
            }
            const savedName = name.value.trim();
            state.zones = result.zones;
            state.editingZone = -1;
            state.selection = new Set();
            state.zoneDraft = { name: '', note: '' };
            render();
            tell(`Sala «${savedName}» guardada.`, 'ok');
        };
        name.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            event.stopPropagation();
            saveIt();
        });
        const actions = el('div', 'mie-actions');
        actions.append(button('Guardar sala', 'mie-zone-save', saveIt));
        if (editing) {
            actions.append(button('Quitar sala', 'mie-zone-remove', () => {
                state.zones = removeZone(state.zones, state.editingZone);
                state.editingZone = -1;
                state.selection = new Set();
                state.zoneDraft = { name: '', note: '' };
                render();
                tell('Sala quitada.');
            }));
        }
        if (state.selection.size) {
            actions.append(button('Soltar', 'mie-zone-clear', () => {
                state.selection = new Set();
                state.editingZone = -1;
                state.zoneDraft = { name: '', note: '' };
                render();
            }));
        }
        panel.append(selected, field('Nombre', name), field('Nota', note), actions);

        if (state.zones.length) {
            const list = el('ul', 'mie-list');
            state.zones.forEach((zone, index) => {
                const li = el('li', 'mie-list-item');
                const pick = button('', 'mie-list-pick', () => selectZone(index));
                const dot = el('span', 'mie-dot');
                dot.style.background = zoneColor(index, 1);
                pick.append(dot, el('b', '', zone.name), document.createTextNode(` · ${cellCount(zoneCells(zone).length)}`));
                li.append(pick, button('×', 'mie-list-remove', () => {
                    state.zones = removeZone(state.zones, index);
                    if (state.editingZone === index) {
                        state.selection = new Set();
                        state.zoneDraft = { name: '', note: '' };
                    }
                    state.editingZone = -1;
                    render();
                }));
                li.querySelector('.mie-list-remove')?.setAttribute('title', `Quitar ${zone.name}`);
                list.append(li);
            });
            panel.append(el('div', 'mie-group-title', `Salas: ${state.zones.length}`), list);
            const problems = zoneProblems(state.zones, state.rows);
            if (problems.length) panel.append(el('div', 'mie-warn', problems.join(' ')));
        }

        // J12.11: se trabaja sobre el mapa con etiquetas y se juega sobre el limpio.
        const clean = el('div', 'mie-group');
        const input = el('input', 'mie-clean-file');
        input.type = 'file';
        input.accept = 'image/png,image/jpeg,image/webp';
        input.style.display = 'none';
        input.addEventListener('change', () => {
            const chosen = input.files?.[0];
            input.value = '';
            if (chosen) void useCleanMap(chosen);
        });
        clean.append(
            el('div', 'mie-group-title', 'Para jugar'),
            el('div', 'mie-small', state.playPicture
                ? `Se jugará sobre «${state.playPicture.name}».`
                : '¿El mapa lleva etiquetas (B1, B2…)? Sube también el limpio: se juega sobre ese.'),
            button(state.playPicture ? 'Cambiar el mapa limpio' : 'Subir el mapa limpio', 'mie-clean', () => input.click()),
            input,
        );
        if (state.playPicture) {
            clean.append(button('Jugar sobre este', 'mie-clean-drop', () => {
                releasePicture(state.playPicture);
                state.playPicture = null;
                render();
            }));
        }
        panel.append(clean, nextButton('Siguiente: las alturas', 'heights'));
        if (state.selection.size && state.selectMode === 'region') setTimeout(() => name.focus(), 0);
    }

    /**
     * Elegir una sala ya hecha, para cambiarla.
     * @param {number} index
     */
    function selectZone(index) {
        const zone = state.zones[index];
        if (!zone) return;
        state.editingZone = index;
        state.selection = new Set(zoneCells(zone));
        state.zoneDraft = { name: zone.name, note: zone.note ?? '' };
        render();
    }

    /** @param {File} chosen */
    async function useCleanMap(chosen) {
        try {
            const other = await loadPicture(chosen);
            if (!gridForOtherImage(state.grid, pixels, other.pixels)) {
                releasePicture(other);
                tell('Ese mapa no tiene la misma forma que este. Tiene que ser el mismo dibujo, sin las etiquetas.', 'error');
                return;
            }
            releasePicture(state.playPicture);
            state.playPicture = other;
            state.imageDirty = true;
            render();
            tell(`Se jugará sobre «${other.name}». Las salas valen para los dos.`, 'ok');
        } catch (error) {
            tell(error instanceof Error ? error.message : String(error), 'error');
        }
    }

    function renderHeights() {
        panel.append(modeSwitch('Zona entera'));
        const feet = numberBox('mie-feet', { step: '5' });
        feet.value = String(state.feet);
        feet.addEventListener('input', () => { state.feet = Math.round(Number(feet.value) || 0); });
        const apply = (/** @type {number} */ value) => {
            if (state.selection.size === 0) {
                tell('Pulsa antes en el mapa.', 'error');
                return;
            }
            state.elevation = applyHeight(state.elevation, [...state.selection], value);
            const count = state.selection.size;
            state.selection = new Set();
            render();
            tell(`${cellCount(count)} ${value ? `a ${feetWord(value)}` : 'a ras de suelo'}.`, 'ok');
        };
        feet.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            event.stopPropagation();
            apply(Math.round(Number(feet.value) || 0));
        });
        const actions = el('div', 'mie-actions');
        actions.append(
            button('Poner altura', 'mie-height-set', () => apply(Math.round(Number(feet.value) || 0))),
            button('Quitar altura', 'mie-height-clear', () => apply(0)),
        );
        panel.append(
            el('div', 'mie-selected', state.selection.size ? `${cellCount(state.selection.size)} ${state.selection.size === 1 ? 'elegida' : 'elegidas'}.` : 'Ninguna casilla elegida: pulsa en el mapa.'),
            field('Altura en pies', feet),
            actions,
        );

        const legend = el('ul', 'mie-legend');
        const item = (/** @type {string} */ swatch, /** @type {string} */ text) => {
            const li = el('li');
            li.append(el('span', `mie-swatch ${swatch}`), document.createTextNode(text));
            legend.append(li);
        };
        item('is-cliff', `Naranja: un risco (${MAP_CLIFF_FEET} pies o más de diferencia). No se cruza andando.`);
        if (state.marks?.plains.length) item('is-plain', 'Morado: parece una meseta.');
        if (state.marks?.bridges.length) item('is-bridge', 'Verde: parece un puente.');
        panel.append(legend);

        const groups = heightGroups(state.elevation);
        if (groups.length) {
            const list = el('ul', 'mie-list');
            for (const group of groups.slice(0, 12)) {
                const li = el('li', 'mie-list-item');
                li.append(button(`${feetWord(group.feet)} · ${cellCount(group.cells.length)}`, 'mie-list-pick', () => {
                    state.selection = new Set(group.cells.map(c => cellKey(c.x, c.y)));
                    state.feet = group.feet;
                    render();
                }));
                list.append(li);
            }
            panel.append(el('div', 'mie-group-title', 'Alturas puestas'), list);
        }
        if (state.selection.size && state.selectMode === 'region') setTimeout(() => feet.focus(), 0);
    }

    // ---- El dibujo de encima ----------------------------------------------------------------

    /** @param {number} index @param {number} alpha */
    function zoneColor(index, alpha) {
        return `hsla(${ZONE_HUES[index % ZONE_HUES.length]}, 85%, 55%, ${alpha})`;
    }

    /** @param {number} x @param {number} y */
    function scrollToCell(x, y) {
        const scale = stage.clientWidth / pixels.width;
        const cx = (state.grid.offsetX + (x + 0.5) * state.grid.cell) * scale;
        const cy = (state.grid.offsetY + (y + 0.5) * state.grid.cell) * scale;
        view.scrollLeft = Math.max(0, cx - view.clientWidth / 2);
        view.scrollTop = Math.max(0, cy - view.clientHeight / 2);
    }

    function draw() {
        const width = stage.clientWidth;
        const height = stage.clientHeight;
        if (!width || !height) return;
        const ratio = window.devicePixelRatio || 1;
        overlay.width = Math.round(width * ratio);
        overlay.height = Math.round(height * ratio);
        const ctx = overlay.getContext('2d');
        if (!ctx) return;
        const scale = width / pixels.width;
        // Se dibuja en píxeles de la imagen: el trazo se divide por la escala para que se vea igual.
        ctx.setTransform(ratio * scale, 0, 0, ratio * scale, 0, 0);
        ctx.clearRect(0, 0, pixels.width, pixels.height);
        const px = (/** @type {number} */ n) => n / scale;
        const { cell, offsetX, offsetY, cols, rows } = state.grid;
        if (!(cell > 0) || !cols || !rows) return;
        const box = (/** @type {number} */ x, /** @type {number} */ y) => ({ x: offsetX + x * cell, y: offsetY + y * cell });

        // Lo que hay en cada casilla.
        if (state.step === 'terrain' && state.showTerrain) {
            for (let y = 0; y < state.rows.length; y++) {
                for (let x = 0; x < state.rows[y].length; x++) {
                    const fill = CHAR_FILL[state.rows[y][x]];
                    if (!fill && state.rows[y][x] !== '.') ctx.fillStyle = 'rgba(160, 60, 200, 0.45)';
                    else if (!fill) continue;
                    else ctx.fillStyle = fill;
                    const at = box(x, y);
                    ctx.fillRect(at.x, at.y, cell, cell);
                }
            }
        }
        if (state.step === 'zones') {
            state.zones.forEach((zone, index) => {
                ctx.fillStyle = zoneColor(index, 0.35);
                for (const key of zoneCells(zone)) {
                    const at = parseCellKey(key);
                    if (!at) continue;
                    const corner = box(at.x, at.y);
                    ctx.fillRect(corner.x, corner.y, cell, cell);
                }
            });
        }
        if (state.step === 'heights') {
            for (const [key, feet] of Object.entries(state.elevation)) {
                const at = parseCellKey(key);
                if (!at) continue;
                const corner = box(at.x, at.y);
                ctx.fillStyle = `hsla(${feet >= 0 ? 190 : 285}, 80%, 50%, ${0.2 + Math.min(Math.abs(feet), 100) / 300})`;
                ctx.fillRect(corner.x, corner.y, cell, cell);
            }
        }

        // La cuadrícula.
        ctx.strokeStyle = state.step === 'grid' ? 'rgba(0, 170, 255, 0.95)' : 'rgba(0, 170, 255, 0.35)';
        ctx.lineWidth = px(state.step === 'grid' ? 1.5 : 1);
        ctx.beginPath();
        for (let x = 0; x <= cols; x++) {
            ctx.moveTo(offsetX + x * cell, offsetY);
            ctx.lineTo(offsetX + x * cell, offsetY + rows * cell);
        }
        for (let y = 0; y <= rows; y++) {
            ctx.moveTo(offsetX, offsetY + y * cell);
            ctx.lineTo(offsetX + cols * cell, offsetY + y * cell);
        }
        ctx.stroke();

        /** Un recuadro por dentro de cada casilla de la lista. */
        const outline = (/** @type {string[]} */ keys, /** @type {string} */ color, /** @type {number[]} */ dash = []) => {
            ctx.strokeStyle = color;
            ctx.lineWidth = px(2);
            ctx.setLineDash(dash.map(px));
            const inset = px(2);
            for (const key of keys) {
                const at = parseCellKey(key);
                if (!at) continue;
                const corner = box(at.x, at.y);
                ctx.strokeRect(corner.x + inset, corner.y + inset, cell - inset * 2, cell - inset * 2);
            }
            ctx.setLineDash([]);
        };
        if (state.step === 'terrain' && state.marks) {
            outline(pendingDoubtful(), 'rgba(255, 215, 0, 0.95)', [4, 3]);
            outline(state.marks.doors, 'rgba(60, 140, 255, 0.95)');
            outline(state.marks.bridges, 'rgba(40, 200, 90, 0.95)');
            if (state.focus) {
                ctx.lineWidth = px(4);
                ctx.strokeStyle = 'rgba(255, 60, 60, 1)';
                const at = /** @type {{x: number, y: number}} */ (parseCellKey(state.focus));
                const corner = box(at.x, at.y);
                ctx.strokeRect(corner.x - px(3), corner.y - px(3), cell + px(6), cell + px(6));
            }
        }
        if (state.step === 'heights' && state.marks) {
            outline(state.marks.plains, 'rgba(170, 80, 230, 0.9)', [3, 3]);
            outline(state.marks.bridges, 'rgba(40, 200, 90, 0.9)', [3, 3]);
        }
        if (state.step === 'heights') {
            // Los riscos: el borde entre dos casillas con mucha diferencia.
            ctx.strokeStyle = 'rgba(255, 140, 0, 1)';
            ctx.lineWidth = px(4);
            ctx.beginPath();
            for (const edge of cliffEdges(state.elevation, cols, rows)) {
                const corner = box(edge.x, edge.y);
                if (edge.side === 'right') {
                    ctx.moveTo(corner.x + cell, corner.y);
                    ctx.lineTo(corner.x + cell, corner.y + cell);
                } else {
                    ctx.moveTo(corner.x, corner.y + cell);
                    ctx.lineTo(corner.x + cell, corner.y + cell);
                }
            }
            ctx.stroke();
        }

        // Lo elegido: solo el borde de fuera, para que se vea la forma.
        if (state.selection.size) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
            ctx.strokeStyle = 'rgba(255, 230, 0, 1)';
            ctx.lineWidth = px(3);
            ctx.beginPath();
            for (const key of state.selection) {
                const at = parseCellKey(key);
                if (!at) continue;
                const corner = box(at.x, at.y);
                ctx.fillRect(corner.x, corner.y, cell, cell);
                if (!state.selection.has(cellKey(at.x, at.y - 1))) { ctx.moveTo(corner.x, corner.y); ctx.lineTo(corner.x + cell, corner.y); }
                if (!state.selection.has(cellKey(at.x, at.y + 1))) { ctx.moveTo(corner.x, corner.y + cell); ctx.lineTo(corner.x + cell, corner.y + cell); }
                if (!state.selection.has(cellKey(at.x - 1, at.y))) { ctx.moveTo(corner.x, corner.y); ctx.lineTo(corner.x, corner.y + cell); }
                if (!state.selection.has(cellKey(at.x + 1, at.y))) { ctx.moveTo(corner.x + cell, corner.y); ctx.lineTo(corner.x + cell, corner.y + cell); }
            }
            ctx.stroke();
        }

        // Los nombres de las salas y las alturas, encima de todo.
        const label = (/** @type {string} */ text, /** @type {number} */ cx, /** @type {number} */ cy) => {
            ctx.font = `bold ${px(16)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.lineJoin = 'round';
            ctx.lineWidth = px(4);
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
            ctx.fillStyle = '#ffffff';
            const x = offsetX + (cx + 0.5) * cell;
            const y = offsetY + (cy + 0.5) * cell;
            ctx.strokeText(text, x, y);
            ctx.fillText(text, x, y);
        };
        if (state.step === 'zones') {
            for (const zone of state.zones) {
                const cells = zoneCells(zone).map(parseCellKey).filter(Boolean);
                if (!cells.length) continue;
                // El nombre, en la casilla de la sala más cerca de su centro (una sala en L no
                // tiene el centro dentro).
                const mx = cells.reduce((s, c) => s + c.x, 0) / cells.length;
                const my = cells.reduce((s, c) => s + c.y, 0) / cells.length;
                const spot = cells.reduce((a, b) => (Math.hypot(a.x - mx, a.y - my) <= Math.hypot(b.x - mx, b.y - my) ? a : b));
                label(zone.name, spot.x, spot.y);
            }
        }
        if (state.step === 'heights') {
            for (const group of heightGroups(state.elevation)) {
                const spot = group.cells.reduce((a, b) => (Math.hypot(a.x - group.x, a.y - group.y) <= Math.hypot(b.x - group.x, b.y - group.y) ? a : b));
                label(`${group.feet > 0 ? '+' : ''}${group.feet}`, spot.x, spot.y);
            }
        }

        // El recuadro que se está marcando (paso 1).
        if (state.mark) {
            ctx.strokeStyle = 'rgba(255, 60, 60, 1)';
            ctx.lineWidth = px(2);
            ctx.strokeRect(Math.min(state.mark.x0, state.mark.x1), Math.min(state.mark.y0, state.mark.y1),
                Math.abs(state.mark.x1 - state.mark.x0), Math.abs(state.mark.y1 - state.mark.y0));
        }
    }

    // ---- El ratón sobre el mapa -------------------------------------------------------------

    /** @param {MouseEvent} event */
    function pointOf(event) {
        const rect = overlay.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * pixels.width;
        const y = ((event.clientY - rect.top) / rect.height) * pixels.height;
        const { cell, offsetX, offsetY, cols, rows } = state.grid;
        const cx = cell > 0 ? Math.floor((x - offsetX) / cell) : -1;
        const cy = cell > 0 ? Math.floor((y - offsetY) / cell) : -1;
        const inside = cx >= 0 && cy >= 0 && cx < cols && cy < rows;
        return { x, y, cx, cy, inside };
    }

    /** @type {null|'paint'|'add'|'remove'} Lo que hace arrastrar. */
    let dragging = null;

    /** @param {number} cx @param {number} cy */
    function paint(cx, cy) {
        const next = paintAt(state.rows, cx, cy, state.brush);
        state.reviewed.add(cellKey(cx, cy));
        if (next === state.rows) return false;
        state.rows = next;
        state.painted = true;
        return true;
    }

    overlay.addEventListener('mousedown', (event) => {
        if (event.button !== 0 || state.busy) return;
        const at = pointOf(event);
        if (state.step === 'grid') {
            if (!state.marking) return;
            event.preventDefault();
            state.mark = { x0: at.x, y0: at.y, x1: at.x, y1: at.y };
            dragging = 'paint';
            draw();
            return;
        }
        if (!at.inside) return;
        event.preventDefault();
        if (state.step === 'terrain') {
            // Se pinta al soltar entero (cuentas y lista); mientras se arrastra, solo el dibujo.
            dragging = 'paint';
            paint(at.cx, at.cy);
            draw();
            return;
        }
        const key = cellKey(at.cx, at.cy);
        if (state.selectMode === 'cell') {
            dragging = state.selection.has(key) ? 'remove' : 'add';
            if (dragging === 'add') state.selection.add(key);
            else state.selection.delete(key);
            render();
            return;
        }
        // Una región entera: la sala o la meseta que dibuja el mapa alrededor.
        if (state.step === 'zones') {
            const index = zoneIndexAt(state.zones, at.cx, at.cy);
            if (index >= 0) {
                selectZone(index);
                return;
            }
            // Una sala nueva: lo escrito para otra que se estaba cambiando no vale.
            if (state.editingZone >= 0) state.zoneDraft = { name: '', note: '' };
            state.editingZone = -1;
        }
        const cells = regionAt(pixels, state.grid, at.cx, at.cy, { kinds: kindsFromRows(state.rows), pixel: { x: at.x, y: at.y } });
        state.selection = new Set(cells.map(c => cellKey(c.x, c.y)));
        render();
        const feet = state.step === 'heights' ? elevationAt(state.elevation, at.cx, at.cy) : 0;
        tell(state.step === 'zones'
            ? `${cellCount(cells.length)}. Ponle nombre y pulsa «Guardar sala».`
            : `${cellCount(cells.length)}, ahora ${feetWord(feet)}. Escribe la altura y pulsa «Poner altura».`);
    });

    overlay.addEventListener('mousemove', (event) => {
        const at = pointOf(event);
        showStatus(at);
        if (!dragging) return;
        if (state.step === 'grid' && state.mark) {
            state.mark.x1 = at.x;
            state.mark.y1 = at.y;
            draw();
            return;
        }
        if (!at.inside) return;
        if (state.step === 'terrain' && dragging === 'paint') {
            if (paint(at.cx, at.cy)) draw();
            return;
        }
        const key = cellKey(at.cx, at.cy);
        if (dragging === 'add' && !state.selection.has(key)) {
            state.selection.add(key);
            draw();
        } else if (dragging === 'remove' && state.selection.has(key)) {
            state.selection.delete(key);
            draw();
        }
    });

    overlay.addEventListener('mouseleave', () => {
        status.textContent = ' ';
    });

    const stopDragging = () => {
        if (!dragging) return;
        const was = dragging;
        dragging = null;
        if (state.step === 'grid' && state.mark) {
            const mark = state.mark;
            state.mark = null;
            state.marking = false;
            const rect = {
                x: Math.min(mark.x0, mark.x1), y: Math.min(mark.y0, mark.y1),
                width: Math.abs(mark.x1 - mark.x0), height: Math.abs(mark.y1 - mark.y0),
            };
            if (rect.width < 4 || rect.height < 4) {
                tell('El recuadro es muy pequeño. Arrastra de esquina a esquina de una casilla.', 'error');
                render();
                return;
            }
            void busy('Buscando la cuadrícula…', () => {
                // Se afina sobre las líneas del dibujo; si no las hay, vale el recuadro tal cual.
                const found = detectGrid(pixels, { cellRect: rect });
                const size = (rect.width + rect.height) / 2;
                setGrid(found.cols > 0 && Math.abs(found.cell - size) <= size * 0.08 ? found : gridFromCell(rect, pixels.width, pixels.height));
            }).then(render);
            return;
        }
        if (was === 'paint' || was === 'add' || was === 'remove') render();
    };
    window.addEventListener('mouseup', stopDragging);

    /** @param {{cx: number, cy: number, inside: boolean}} at */
    function showStatus(at) {
        if (!at.inside) {
            status.textContent = ' ';
            return;
        }
        const key = cellKey(at.cx, at.cy);
        const parts = [`Casilla (${at.cx + 1}, ${at.cy + 1})`];
        if (state.rowsValid && state.rows[at.cy]) parts.push(charWord(state.rows[at.cy][at.cx]));
        const note = state.marks?.notes[key];
        if (note && state.step === 'terrain') parts.push(note);
        const zone = zoneIndexAt(state.zones, at.cx, at.cy);
        if (zone >= 0) parts.push(`sala ${state.zones[zone].name}`);
        const feet = elevationAt(state.elevation, at.cx, at.cy);
        if (feet) parts.push(feetWord(feet));
        status.textContent = parts.join(' · ');
    }

    // ---- Abrir, y al aceptar, subir -----------------------------------------------------------

    /** @param {Picture|null} which */
    function releasePicture(which) {
        if (which?.owned) URL.revokeObjectURL(which.src);
    }

    /** @type {MapBoardPatch|null} */
    let result = null;

    /** Lo que se guarda: recortar, subir y juntar. */
    async function finish() {
        if (!(state.grid.cols > 0) || !(state.grid.rows > 0)) throw new Error('Falta la cuadrícula: ajústala en el paso 1.');
        if (!state.rowsValid) read();
        let url = String(board?.url ?? '');
        let grid = state.grid;
        if (state.imageDirty || !url) {
            const play = state.playPicture ?? picture;
            const playGrid = state.playPicture ? gridForOtherImage(state.grid, pixels, state.playPicture.pixels) : state.grid;
            if (!playGrid) throw new Error('El mapa limpio no tiene la misma forma que este.');
            grid = playGrid;
            const crop = cropToBase64(play, playGrid);
            url = await saveImage(crop.base64, play.type, `mapa-${Date.now()}`);
            if (!url) throw new Error('No se ha podido guardar la imagen.');
        }
        return boardFromEdit({ url, grid, rows: state.rows, zones: state.zones, elevation: state.elevation });
    }

    const resizeWatch = new ResizeObserver(() => draw());
    const popup = new Popup(root, POPUP_TYPE.CONFIRM, '', {
        okButton: 'Usar este mapa',
        cancelButton: 'Cancelar',
        wider: true,
        large: true,
        allowVerticalScrolling: true,
        onOpen: () => {
            // La primera vez: buscar la cuadrícula, con el aviso ya en pantalla.
            setZoom(0);
            render();
            resizeWatch.observe(stage);
            if (!saved) {
                void busy('Buscando la cuadrícula…', () => setGrid(detectGrid(pixels))).then(render);
            } else {
                tell(describeGrid(state.grid));
            }
        },
        onClosing: async (/** @type {any} */ self) => {
            if (self.result !== POPUP_RESULT.AFFIRMATIVE) return true;
            if (state.busy) return false;
            try {
                state.busy = true;
                root.classList.add('is-busy');
                tell('Guardando el mapa…');
                result = await finish();
                return true;
            } catch (error) {
                tell(error instanceof Error ? error.message : String(error), 'error');
                return false;
            } finally {
                state.busy = false;
                root.classList.remove('is-busy');
            }
        },
    });

    try {
        const answer = await popup.show();
        return answer === POPUP_RESULT.AFFIRMATIVE ? result : null;
    } finally {
        window.removeEventListener('mouseup', stopDragging);
        resizeWatch.disconnect();
        releasePicture(picture);
        releasePicture(state.playPicture);
    }
}
