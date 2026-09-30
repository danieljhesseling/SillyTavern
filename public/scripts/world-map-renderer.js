/**
 * World Map Renderer Module
 * Provides zoomable world map with location markers and location/board grid views with character tokens.
 */

import { parseCellKey, describeCell } from './game-engine/board/terrain.js';
import { getCellVisibility } from './game-engine/board/fog-of-war.js';
import { cliffEdges, elevationAt } from './game-engine/board/heights.js';
import { zoneAt } from './game-engine/board/zones.js';
import { boardBiome, firstArt, isPlainFace, loadPixelManifest, openPack, pixelManifest, terrainTile } from './game-engine/ui/pixel-art.js';

/** Si cada casilla en pixel carga: la que no, se pinta con los colores de antes. */
const tileLoads = new Map();

/**
 * La URL de una casilla en pixel si se puede usar: la que ya se sabe que no carga, no. La
 * primera vez que se pide se prueba a cargar, y `onBroken` avisa si no llega.
 *
 * @param {string} url
 * @param {() => void} onBroken
 * @returns {string}
 */
function usableTile(url, onBroken) {
    if (!url) return '';
    if (!tileLoads.has(url)) {
        tileLoads.set(url, 'probando');
        const probe = new Image();
        probe.onload = () => tileLoads.set(url, 'bien');
        probe.onerror = () => {
            tileLoads.set(url, 'rota');
            onBroken();
        };
        probe.src = url;
    }
    return tileLoads.get(url) === 'rota' ? '' : url;
}

/**
 * El dibujo en pixel de una ficha que no trae cara propia: un enemigo, su bicho (por su
 * nombre o por su arquetipo); alguien del paquete, su retrato; uno del grupo, el suyo si es
 * un mercenario o el de relleno de su clase. Se recorta en redondo como cualquier cara.
 *
 * También la usan la fila de iniciativa y las tarjetas de enemigo (`party/board-view.js`), para
 * que un bicho se vea igual en el tablero y en su tarjeta.
 *
 * @param {Partial<TokenData>} token
 * @returns {string} Vacío si trae cara propia o no hay dibujo.
 */
export function tokenArt(token) {
    if (!isPlainFace(token.avatar)) return '';
    // J19.5: una invocación es un bicho, del lado del grupo.
    if (token.isEnemy || token.isSummon) return firstArt('creature', { name: token.name, archetype: token.archetype });
    if (token.isNPC) return firstArt('portrait', { name: token.name, pack: openPack() });
    return firstArt('mercenary', { name: token.name })
        || firstArt('hero', { className: token.className, gender: token.gender, name: token.name, race: token.race });
}

// ============================================================
//  ZOOMABLE CONTAINER ENGINE
// ============================================================

/** Cuenta los mapas creados, para darle a cada uno su espacio de nombres en el documento. */
let zoomSequence = 0;

/**
 * @typedef {Object} ZoomableState
 * @property {number} scale
 * @property {number} offsetX
 * @property {number} offsetY
 * @property {boolean} isDragging
 * @property {number} lastX
 * @property {number} lastY
 */

/**
 * Create a zoomable, pannable container for an image.
 * All zoom/pan happens via CSS transform on the inner content; the container stays fixed.
 * @param {Object} options
 * @param {string} [options.imageUrl] - The map/board image URL
 * @param {number} [options.minZoom=0.5]
 * @param {number} [options.maxZoom=6]
 * @param {number} [options.initialScale=1]
 * @param {number} [options.containerHeight=420]
 * @returns {{ container: JQuery, content: JQuery, state: ZoomableState, applyTransform: () => void, setZoom: (s: number) => void, reset: () => void, getImageSize: () => {w: number, h: number} }}
 */
export function createZoomableContainer(options = {}) {
    const {
        imageUrl = '',
        minZoom = 0.5,
        maxZoom = 6,
        initialScale = 1,
        containerHeight = 420,
    } = options;

    /** @type {ZoomableState} */
    const state = {
        scale: initialScale,
        offsetX: 0,
        offsetY: 0,
        isDragging: false,
        lastX: 0,
        lastY: 0,
    };

    const container = $('<div class="wm-container"></div>').css('height', containerHeight + 'px');
    const content = $('<div class="wm-content"></div>');

    // An empty src renders as a broken-image icon, so a board without art gets no img at
    // all and the caller sizes the canvas itself.
    const img = $('<img />').attr('alt', 'map');
    if (imageUrl) {
        img.attr('src', imageUrl);
        content.append(img);
    }

    container.append(content);

    let imgNatW = 0;
    let imgNatH = 0;

    function applyTransform() {
        content.css('transform', `translate(${state.offsetX}px, ${state.offsetY}px) scale(${state.scale})`);
    }

    /** @param {number} newScale */
    function setZoom(newScale) {
        state.scale = Math.min(maxZoom, Math.max(minZoom, newScale));
        applyTransform();
    }

    function reset() {
        state.scale = initialScale;
        state.offsetX = 0;
        state.offsetY = 0;
        applyTransform();
    }

    function getImageSize() {
        return { w: imgNatW, h: imgNatH };
    }

    // Fit image to container on load
    img.on('load', function () {
        imgNatW = /** @type {HTMLImageElement} */ (this).naturalWidth;
        imgNatH = /** @type {HTMLImageElement} */ (this).naturalHeight;
        const containerW = container.width() || 300;
        const fitScale = Math.min(containerW / imgNatW, containerHeight / imgNatH, 1);
        state.scale = fitScale;
        state.offsetX = (containerW - imgNatW * fitScale) / 2;
        state.offsetY = (containerHeight - imgNatH * fitScale) / 2;
        applyTransform();
    });

    // Wheel zoom (zoom toward cursor position)
    container.on('wheel', function (e) {
        e.preventDefault();
        const oe = /** @type {WheelEvent} */ (e.originalEvent);
        const rect = container[0].getBoundingClientRect();
        const mx = oe.clientX - rect.left;
        const my = oe.clientY - rect.top;

        const delta = oe.deltaY < 0 ? 0.15 : -0.15;
        const newScale = Math.min(maxZoom, Math.max(minZoom, state.scale + delta * state.scale));

        // Zoom toward cursor
        const ratio = newScale / state.scale;
        state.offsetX = mx - ratio * (mx - state.offsetX);
        state.offsetY = my - ratio * (my - state.offsetY);
        state.scale = newScale;
        applyTransform();
    });

    // Drag pan
    content.on('mousedown', function (e) {
        if (/** @type {HTMLElement} */ (e.target).closest('.wm-token, .wm-marker')) return;
        e.preventDefault();
        state.isDragging = true;
        state.lastX = e.pageX;
        state.lastY = e.pageY;
        content.addClass('grabbing');
    });

    // Con su propio espacio de nombres, y fuera al quitar el mapa: antes cada tablero dibujado
    // dejaba dos oyentes más en el documento para siempre, y el tablero se redibuja en cada
    // paso de un combate (J20.6: que no caliente el teléfono).
    const zoomNs = `wmZoom_${++zoomSequence}`;
    $(document).on(`mousemove.${zoomNs}`, function (e) {
        if (!state.isDragging) return;
        state.offsetX += e.pageX - state.lastX;
        state.offsetY += e.pageY - state.lastY;
        state.lastX = e.pageX;
        state.lastY = e.pageY;
        applyTransform();
    });

    $(document).on(`mouseup.${zoomNs}`, function () {
        if (!state.isDragging) return;
        state.isDragging = false;
        content.removeClass('grabbing');
    });
    container.on('remove', () => $(document).off(`.${zoomNs}`));

    // Double-click reset
    container.on('dblclick', function (e) {
        if (/** @type {HTMLElement} */ (e.target).closest('.wm-token, .wm-marker')) return;
        reset();
    });

    return { container, content, state, applyTransform, setZoom, reset, getImageSize };
}

// ============================================================
//  COORDINATE AXES
// ============================================================

/**
 * Render coordinate axis labels along top (X) and left (Y) of the container.
 * @param {JQuery} container - The .wm-container element
 * @param {ZoomableState} state
 * @param {{w: number, h: number}} imgSize
 * @param {{xMin?: number, xMax?: number, yMin?: number, yMax?: number}} coordRange - The world coordinate range
 */
export function renderAxes(container, state, imgSize, coordRange) {
    container.find('.wm-axes-x, .wm-axes-y').remove();

    if (!imgSize.w || !imgSize.h) return;

    const cw = container.width() || 300;
    const ch = container.height() || 420;

    const xMin = coordRange.xMin ?? 0;
    const xMax = coordRange.xMax ?? imgSize.w;
    const yMin = coordRange.yMin ?? 0;
    const yMax = coordRange.yMax ?? imgSize.h;

    const xRange = xMax - xMin;
    const yRange = yMax - yMin;

    // Determine step size based on zoom level (show fewer labels when zoomed out)
    const pixelsPerUnit = (imgSize.w * state.scale) / xRange;
    const targetLabelSpacing = 60; // pixels between labels
    let step = Math.max(1, Math.round(targetLabelSpacing / pixelsPerUnit));
    // Round step to nice numbers
    const niceSteps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
    step = niceSteps.find(s => s >= step) || step;

    const axesX = $('<div class="wm-axes-x"></div>');
    const axesY = $('<div class="wm-axes-y"></div>');

    // X axis labels
    const xStart = Math.ceil(xMin / step) * step;
    for (let x = xStart; x <= xMax; x += step) {
        const frac = (x - xMin) / xRange;
        const px = state.offsetX + frac * imgSize.w * state.scale;
        if (px < -20 || px > cw + 20) continue;
        axesX.append(`<span class="wm-axis-label" style="left:${px}px;top:2px;">${x}</span>`);
    }

    // Y axis labels
    const yStart = Math.ceil(yMin / step) * step;
    for (let y = yStart; y <= yMax; y += step) {
        const frac = (y - yMin) / yRange;
        const py = state.offsetY + frac * imgSize.h * state.scale;
        if (py < -15 || py > ch + 15) continue;
        axesY.append(`<span class="wm-axis-label" style="top:${py}px;left:2px;">${y}</span>`);
    }

    container.append(axesX, axesY);
}

// ============================================================
//  WORLD MAP VIEW
// ============================================================

/**
 * @typedef {Object} LocationMapEntry
 * @property {string} name
 * @property {string} url
 * @property {number} [x]
 * @property {number} [y]
 * @property {string} [description]
 * @property {string} [region]
 * @property {number} [gridWidth]
 * @property {number} [gridHeight]
 * @property {string} [boardName]
 * @property {Array<{name: string, url: string}>} [boards]
 */

/**
 * Render the interactive world map view with location markers.
 * @param {JQuery} target - Container to render into
 * @param {string} worldMapUrl
 * @param {LocationMapEntry[]} locationMaps
 * @param {Object} [callbacks]
 * @param {(loc: LocationMapEntry) => void} [callbacks.onLocationSelect]
 * @param {(loc: LocationMapEntry) => void} [callbacks.onLocationNavigate]
 */
export function renderWorldMapView(target, worldMapUrl, locationMaps, callbacks = {}) {
    target.empty();

    if (!worldMapUrl) {
        target.html('<div class="wm-empty-state">Este mundo no tiene mapa.</div>');
        return;
    }

    // Compute coordinate range from location data
    const xs = locationMaps.filter(l => l.x != null).map(l => l.x || 0);
    const ys = locationMaps.filter(l => l.y != null).map(l => l.y || 0);
    const padding = 500;
    const coordRange = {
        xMin: xs.length ? Math.min(...xs) - padding : -8000,
        xMax: xs.length ? Math.max(...xs) + padding : 0,
        yMin: ys.length ? Math.min(...ys) - padding : -3000,
        yMax: ys.length ? Math.max(...ys) + padding : 5000,
    };

    const zoomable = createZoomableContainer({ imageUrl: worldMapUrl, containerHeight: 420 });
    const { container, content, state, applyTransform, getImageSize } = zoomable;

    // Marker layer (inside content so it scales/moves with the image)
    const markerLayer = $('<div style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;"></div>');
    content.append(markerLayer);

    /** @type {LocationMapEntry|null} */
    let selectedLocation = null;
    const infoCardContainer = $('<div></div>');

    function placeMarkers() {
        markerLayer.empty();
        const imgSize = getImageSize();
        if (!imgSize.w || !imgSize.h) return;

        const xRange = (coordRange.xMax || 1) - (coordRange.xMin || 0);
        const yRange = (coordRange.yMax || 1) - (coordRange.yMin || 0);

        for (const loc of locationMaps) {
            if (loc.x == null || loc.y == null) continue;

            const fracX = ((loc.x || 0) - (coordRange.xMin || 0)) / xRange;
            const fracY = ((loc.y || 0) - (coordRange.yMin || 0)) / yRange;
            const px = fracX * imgSize.w;
            const py = fracY * imgSize.h;

            const marker = $(`
                <div class="wm-marker ${selectedLocation === loc ? 'selected' : ''}" style="pointer-events:auto;">
                    <div class="wm-marker-label"></div>
                    <div class="wm-marker-pin"><i class="fa-solid fa-location-dot"></i></div>
                </div>
            `);
            marker.css({ left: px + 'px', top: py + 'px' });
            marker.find('.wm-marker-label').text(loc.name ?? '');

            marker.on('click', function (e) {
                e.stopPropagation();
                selectedLocation = loc;
                placeMarkers();
                renderInfoCard();
                if (callbacks.onLocationSelect) callbacks.onLocationSelect(loc);
            });

            marker.on('dblclick', function (e) {
                e.stopPropagation();
                if (callbacks.onLocationNavigate) callbacks.onLocationNavigate(loc);
            });

            markerLayer.append(marker);
        }
    }

    function renderInfoCard() {
        infoCardContainer.empty();
        if (!selectedLocation) return;

        const loc = selectedLocation;
        const card = $(`
            <div class="wm-info-card">
                <div class="wm-info-card-image-wrapper">
                    <img class="wm-info-card-image" alt="" />
                    <div class="wm-info-card-badge"><i class="fa-solid fa-location-dot"></i> <span class="wm-info-card-badge-name"></span></div>
                    <div class="wm-info-card-coords"></div>
                </div>
                <div class="wm-info-card-body">
                    <div class="wm-info-card-title"></div>
                    <div class="wm-info-card-region"></div>
                </div>
            </div>
        `);

        const imageWrapper = card.find('.wm-info-card-image-wrapper');
        if (loc.url) {
            imageWrapper.find('.wm-info-card-image').attr('src', loc.url).attr('alt', loc.name ?? '');
            imageWrapper.find('.wm-info-card-badge-name').text(loc.name ?? '');
            imageWrapper.find('.wm-info-card-coords').text(`${loc.x ?? 0},  ${loc.y ?? 0}`);
        } else {
            imageWrapper.remove();
        }

        card.find('.wm-info-card-title').text(`${loc.name ?? ''}${loc.description ? ' in ' + loc.description : ''}`);

        const regionEl = card.find('.wm-info-card-region');
        if (loc.region) {
            regionEl.text(loc.region);
        } else {
            regionEl.remove();
        }

        infoCardContainer.append(card);
    }

    // Re-render axes and markers on transform change
    const origApply = applyTransform;
    const updateOverlays = () => {
        origApply();
        const imgSize = getImageSize();
        renderAxes(container, state, imgSize, coordRange);
    };

    // Patch applyTransform
    zoomable.applyTransform = updateOverlays;

    // Re-patch all transform triggers
    container.off('wheel').on('wheel', function (e) {
        e.preventDefault();
        const oe = /** @type {WheelEvent} */ (e.originalEvent);
        const rect = container[0].getBoundingClientRect();
        const mx = oe.clientX - rect.left;
        const my = oe.clientY - rect.top;
        const delta = oe.deltaY < 0 ? 0.15 : -0.15;
        const newScale = Math.min(6, Math.max(0.5, state.scale + delta * state.scale));
        const ratio = newScale / state.scale;
        state.offsetX = mx - ratio * (mx - state.offsetX);
        state.offsetY = my - ratio * (my - state.offsetY);
        state.scale = newScale;
        updateOverlays();
    });

    content.off('mousedown').on('mousedown', function (e) {
        if (/** @type {HTMLElement} */ (e.target).closest('.wm-marker')) return;
        e.preventDefault();
        state.isDragging = true;
        state.lastX = e.pageX;
        state.lastY = e.pageY;
        content.addClass('grabbing');
    });

    const nsId = 'wmWorld_' + Date.now();
    $(document).on(`mousemove.${nsId}`, function (e) {
        if (!state.isDragging) return;
        state.offsetX += e.pageX - state.lastX;
        state.offsetY += e.pageY - state.lastY;
        state.lastX = e.pageX;
        state.lastY = e.pageY;
        updateOverlays();
    });
    $(document).on(`mouseup.${nsId}`, function () {
        if (!state.isDragging) return;
        state.isDragging = false;
        content.removeClass('grabbing');
    });

    container.off('dblclick').on('dblclick', function (e) {
        if (/** @type {HTMLElement} */ (e.target).closest('.wm-marker')) return;
        zoomable.reset();
        updateOverlays();
    });

    // Markers placed after image loads
    content.find('img').on('load', () => {
        placeMarkers();
        updateOverlays();
    });

    // Zoom controls
    const zoomControls = $(`
        <div class="wm-zoom-controls">
            <button class="wm-zoom-btn" data-action="in" title="Acercar"><i class="fa-solid fa-magnifying-glass-plus"></i></button>
            <button class="wm-zoom-btn" data-action="out" title="Alejar"><i class="fa-solid fa-magnifying-glass-minus"></i></button>
        </div>
    `);
    zoomControls.find('[data-action="in"]').on('click', () => { state.scale = Math.min(6, state.scale * 1.3); updateOverlays(); });
    zoomControls.find('[data-action="out"]').on('click', () => { state.scale = Math.max(0.5, state.scale / 1.3); updateOverlays(); });
    container.append(zoomControls);

    // Compass
    container.append('<div class="wm-compass"><span class="wm-compass-n">N</span><i class="fa-solid fa-location-arrow" style="transform:rotate(-45deg);"></i></div>');

    // Change Location button
    const changeBtn = $('<div class="wm-change-location-btn"><i class="fa-solid fa-route"></i> Change Location</div>');
    changeBtn.on('click', () => {
        if (callbacks.onLocationNavigate && selectedLocation) {
            callbacks.onLocationNavigate(selectedLocation);
        }
    });

    target.append(container, infoCardContainer, changeBtn);

    // Cleanup namespace on removal
    container.on('remove', () => {
        $(document).off(`.${nsId}`);
    });
}

// ============================================================
//  LOCATION / BOARD GRID VIEW
// ============================================================

/**
 * @typedef {Object} TokenData
 * @property {number} id
 * @property {string} name
 * @property {string} avatar
 * @property {number} gridX
 * @property {number} gridY
 * @property {number} [level]
 * @property {string} [className]
 * @property {number} [hp]
 * @property {number} [maxHp]
 * @property {boolean} [isEnemy]
 * @property {boolean} [isNPC]
 * @property {number} [sightFeet] - Vision radius for fog of war; defaults when absent.
 * @property {Array<{key: string, icon: string, label: string, effect?: string}>} [statuses] - Condition markers to draw over the token.
 * @property {number} [sizeCells] - How many cells the creature covers. 1 unless it is Large or bigger.
 * @property {{id: string, icon: string, label: string}} [role] - Idea 13: como pelea, en un icono.
 * @property {string} [weapon] - Idea 61: lo que lleva en la mano.
 * @property {boolean} [idle] - Un enemigo que está en el tablero y todavía no pelea: se ve, no se mueve.
 * @property {string} [archetype] - El arquetipo del bestiario (`bestia-lobo`), para su dibujo en pixel.
 * @property {string} [gender] - Cómo se presenta, para el retrato de relleno de quien no tiene cara.
 * @property {string} [race] - Su especie, para lo mismo.
 * @property {boolean} [isSummon] - J19.5: una invocación, del lado del grupo.
 * @property {string} [summoner] - Quién la invocó, para su ayuda.
 */

/**
 * @typedef {Object} HighlightCell
 * @property {number} gridX
 * @property {number} gridY
 * @property {'move'|'attack'} [kind]
 */

/** @type {Map<string, {scale: number, offsetX: number, offsetY: number, gridVisible: boolean, auto?: boolean}>} */
const locationViewStateMemory = new Map();

/** K3: el último turno que se centró en cada tablero, para centrar una vez por turno y no más. */
const focusMemory = new Map();

/**
 * Render an interactive location or board view with grid and character tokens.
 * @param {JQuery} target - Container to render into
 * @param {Object} options
 * @param {string} options.name - Location or board name
 * @param {string} options.imageUrl - Location/board image URL
 * @param {string} [options.description]
 * @param {number} [options.gridWidth=50]
 * @param {number} [options.gridHeight=50]
 * @param {TokenData[]} options.tokens
 * @param {(tokenId: number, gridX: number, gridY: number) => void} [options.onTokenMove]
 * @param {(tokenId: number) => void} [options.onTokenClick]
 * @param {(gridX: number, gridY: number) => {cells: Array<{gridX: number, gridY: number}>, feet: number, ok: boolean, provokes?: string[]}|null} [options.onCellHover] -
 *   Al pasar por encima de una casilla encendida: devuelve la ruta y lo que cuesta, para
 *   dibujarla antes de pulsar. Sin esto, mover es una apuesta.
 * @param {(gridX: number, gridY: number, kind: string) => void} [options.onCellClick] -
 *   Pulsar una casilla **encendida**. Solo las encendidas responden, a proposito: una
 *   casilla apagada es una a la que no puedes ir, y un clic ahi no deberia hacer nada.
 * @param {HighlightCell[]} [options.highlightedCells]
 * @param {number[]} [options.highlightedTokenIds]
 * @param {number|null} [options.selectedTokenId]
 * @param {string} [options.overlayLegend]
 * @param {number[]} [options.draggableTokenIds] - Only these token IDs can be dragged. If absent, all tokens are draggable.
 * @param {(tokenId: number, tentativeGX: number, tentativeGY: number) => HighlightCell[]} [options.onTokenDragging] - Called during drag mousemove for live highlight update.
 * @param {string} [options.viewStateKey] - Optional explicit key to persist zoom/pan/grid state across re-renders.
 * @param {import('./game-engine/board/terrain.js').BoardTerrain|null} [options.terrain] - Walls, cover, difficult ground and doors.
 * @param {import('./game-engine/board/fog-of-war.js').BoardFog|null} [options.fog] - Explored memory.
 * @param {Set<string>|null} [options.visibleCells] - Cell keys currently in sight.
 * @param {boolean} [options.fogEnabled] - Whether to draw fog at all.
 * @param {string|null} [options.paintMode] - Terrain type being painted, or null when not editing.
 * @param {(gridX: number, gridY: number, type: string) => void} [options.onPaintCell]
 * @param {(gridX: number, gridY: number, open: boolean) => void} [options.onDoorToggle] - Click a door to open or close it. Ignored while painting.
 * @param {number|string|null} [options.focusTokenId] - La ficha a la que le toca: si no se ve (fuera del tablero o bajo otra cosa), se centra.
 * @param {string} [options.focusKey] - Qué turno es: se centra una vez por turno, no en cada redibujado.
 * @param {Array<{x: number, y: number, name: string, kind?: string, note?: string}>} [options.hazards] - Lo que ya se ha visto
 *   en el tablero: una trampa descubierta, el aceite que arde (idea 122). Se dibuja, y la casilla lo dice.
 * @param {string} [options.biome] - El bioma de las casillas en pixel (`mazmorra`, `madera`, `exterior`, `cueva`).
 *   Sin decirlo, se lee en el nombre del tablero (`boardBiome`).
 * @param {string} [options.locationType] - El tipo de su localización (`cave`, `wilderness`…), para el bioma
 *   cuando el nombre no lo dice.
 * @param {Record<string, number>|null} [options.elevation] - J12.10: las cotas del tablero; los acantilados se dibujan.
 * @param {Array<{name: string, cells?: string[], rect?: any, note?: string}>} [options.zones] - J12.11: las salas con
 *   nombre, para decir en cuál está una casilla.
 * @param {Array<{x: number, y: number, zoneId: string, kind: string, icon: string, label: string, tell: string}>} [options.spellZones] -
 *   J19.6: las zonas de conjuro, como las da `zoneOverlay`.
 */
export function renderLocationView(target, options) {
    const {
        name = 'Unknown',
        imageUrl = '',
        description = '',
        gridWidth = 50,
        gridHeight = 50,
        tokens = [],
        onTokenMove,
        onTokenClick,
        onCellClick,
        onCellHover = null,
        highlightedCells = [],
        highlightedTokenIds = [],
        selectedTokenId = null,
        overlayLegend = '',
        draggableTokenIds = null,
        onTokenDragging = null,
        viewStateKey = '',
        terrain = null,
        fog = null,
        visibleCells = null,
        fogEnabled = false,
        paintMode = null,
        onPaintCell = null,
        onDoorToggle = null,
        hazards = [],
        focusTokenId = null,
        focusKey = '',
        biome = '',
        locationType = '',
        elevation = null,
        zones = [],
        spellZones = [],
    } = options;

    target.empty();

    // A board with no art is still a board: the grid, terrain, tokens and fog only need
    // dimensions, not a picture. Refusing to render without one made every gridded map
    // depend on somebody having uploaded an image first.
    const hasImage = Boolean(imageUrl);

    // Location header. Built as nodes rather than interpolated, like the rest of this file:
    // name and description come from world info, which is user- and AI-authored.
    const header = $(`
        <div class="wm-location-header">
            <div class="wm-location-header-info">
                <div class="wm-location-header-name"></div>
                <div class="wm-location-header-desc"></div>
            </div>
        </div>
    `);
    header.find('.wm-location-header-name').text(name);
    const descEl = header.find('.wm-location-header-desc');
    if (description) {
        descEl.text(description);
    } else {
        descEl.remove();
    }
    if (hasImage) {
        $('<img class="wm-location-header-icon">')
            .attr('src', imageUrl)
            .attr('alt', name)
            .prependTo(header);
    }
    target.append(header);

    const zoomable = createZoomableContainer({ imageUrl, containerHeight: 420 });
    const { container, content, state } = zoomable;

    let gridVisible = true;
    let imgW = 0;
    let imgH = 0;
    /** Si alguien ha movido la vista a mano: mientras no, el tablero se encuadra solo. */
    let userMoved = false;
    /**
     * J20.2: con qué se pulsó lo último (`mouse`, `touch`, `pen`). A toques no hay «pasar por
     * encima», así que lo que el ratón enseña al pasar, el dedo lo enseña con el primer toque.
     */
    let lastPointer = '';
    /** J20.2: la casilla encendida que ya enseña su ruta; un segundo toque en ella mueve. */
    let armedCell = '';
    /** J20.2: cuándo acabó el último arrastre con el dedo: el toque que lo cierra no es un clic. */
    let panEndedAt = 0;
    const touchy = () => lastPointer === 'touch' || lastPointer === 'pen';
    const justPanned = () => Date.now() - panEndedAt < 400;
    const derivedViewStateKey = String(viewStateKey || `${name}::${imageUrl}::${gridWidth}x${gridHeight}`);

    function persistViewState() {
        if (!derivedViewStateKey) return;
        locationViewStateMemory.set(derivedViewStateKey, {
            scale: state.scale,
            offsetX: state.offsetX,
            offsetY: state.offsetY,
            gridVisible,
            auto: !userMoved,
        });
    }

    /**
     * El encuadre que llena el sitio que hay, centrado. Un tablero sin arte puede crecer
     * hasta el doble (sus casillas no se pixelan); una imagen, no más allá de su tamaño.
     */
    function fitView() {
        const cw = container.width() || 300;
        const ch = container.height() || 420;
        const fitScale = Math.min(cw / imgW, ch / imgH, hasImage ? 1 : 2);
        state.scale = fitScale;
        state.offsetX = (cw - imgW * fitScale) / 2;
        state.offsetY = (ch - imgH * fitScale) / 2;
    }

    // Terrain sits under everything: it is the board itself, not an overlay on it.
    const terrainLayer = $('<div class="wm-terrain-layer"></div>');
    content.append(terrainLayer);

    // Idea 164: lo que es la casilla bajo el raton, dicho en una esquina del tablero. Solo
    // en tableros con terreno: en un mapa de localidad no hay casillas que explicar.
    /** La casilla bajo un punto de la pantalla, o nada si cae fuera del tablero. */
    const cellUnder = (/** @type {number} */ clientX, /** @type {number} */ clientY) => {
        const box = content[0].getBoundingClientRect();
        if (!imgW || !box.width) return null;
        const gx = Math.floor(((clientX - box.left) / box.width) * gridWidth);
        const gy = Math.floor(((clientY - box.top) / box.height) * gridHeight);
        return gx < 0 || gy < 0 || gx >= gridWidth || gy >= gridHeight ? null : { gx, gy };
    };
    /** @type {JQuery|null} */
    let cellInfo = null;
    /**
     * Lo que se sabe de una casilla: su terreno, la sala en la que cae (J12.11), su altura
     * (J12.10), lo que se ha visto en ella y las zonas de conjuro que la cubren (J19.6).
     *
     * @param {number} gx
     * @param {number} gy
     * @returns {string}
     */
    const describeAt = (gx, gy) => {
        const parts = [describeCell(terrain, gx, gy)];
        const room = Array.isArray(zones) && zones.length > 0 ? zoneAt(zones, gx, gy) : null;
        if (room?.name) parts.push(room.name);
        const feet = elevation ? elevationAt(elevation, gx, gy) : 0;
        if (feet) parts.push(`${feet > 0 ? '+' : ''}${feet} pies de alto`);
        const there = [
            ...(hazards || []).filter(h => h.x === gx && h.y === gy).map(h => h.name),
            ...[...new Set((spellZones || []).filter(z => z.x === gx && z.y === gy).map(z => `${z.label}: ${z.tell}`))],
        ];
        return [...parts, ...there].join(' · ');
    };
    if (terrain) {
        cellInfo = $('<div class="wm-cell-info"></div>').hide();
        container.append(cellInfo);
        const info = cellInfo;
        content.on('mousemove', (event) => {
            const at = cellUnder(event.clientX, event.clientY);
            if (!at) return info.hide();
            info.text(describeAt(at.gx, at.gy)).show();
        });
        content.on('mouseleave', () => info.hide());
    }

    // Grid overlay (drawn via CSS background-image)
    const gridOverlay = $('<div class="wm-grid-overlay"></div>');
    content.append(gridOverlay);

    // Tokens layer
    const tokensLayer = $('<div class="wm-tokens-layer"></div>');
    content.append(tokensLayer);

    // Tactical overlays
    const highlightsLayer = $('<div class="wm-highlight-layer"></div>');
    content.append(highlightsLayer);

    // Fog goes on top of everything: it hides the board, the terrain and the creatures.
    const fogLayer = $('<div class="wm-fog-layer"></div>');
    content.append(fogLayer);

    /**
     * Paints the terrain cells that are not plain floor.
     *
     * Only the exceptions are drawn, which matches how terrain is stored and keeps a 50x50
     * board from spawning 2500 nodes for a room with four walls in it.
     */
    function renderTerrain() {
        terrainLayer.empty();
        if (!imgW || !imgH || !terrain?.cells) return;

        const cellW = imgW / gridWidth;
        const cellH = imgH / gridHeight;
        terrainLayer.css({ width: imgW + 'px', height: imgH + 'px' });

        // Las casillas en pixel (`tablero/`): el suelo de su bioma debajo de todo, y cada
        // casilla con su dibujo. Solo sin imagen: un mapa dibujado ya trae suelo y muros. La
        // que no carga se pinta con los colores de antes.
        const tiled = !hasImage && Boolean(pixelManifest());
        const kind = boardBiome({ biome, name, type: locationType });
        const redraw = () => { if (container.closest('body').length > 0) renderTerrain(); };
        const tile = (/** @type {string} */ id) => (tiled && id ? usableTile(firstArt('tile', { id }), redraw) : '');
        const floor = tile(`suelo-${kind}`);
        terrainLayer.toggleClass('wm-terrain-tiled-floor', Boolean(floor)).attr('data-biome', floor ? kind : null).css({
            'background-image': floor ? `url("${floor}")` : '',
            'background-size': floor ? `${cellW}px ${cellH}px` : '',
        });

        for (const [key, cell] of Object.entries(terrain.cells)) {
            const parsed = parseCellKey(key);
            if (!parsed || !cell) continue;

            const type = cell.type === 'door' && cell.open ? 'door-open' : cell.type;
            const el = $('<div class="wm-terrain-cell"></div>')
                .addClass(`wm-terrain-${type}`)
                .css({
                    left: parsed.x * cellW + 'px',
                    top: parsed.y * cellH + 'px',
                    width: cellW + 'px',
                    height: cellH + 'px',
                });
            // Lo alto lleva el borde en su última fila: la de debajo ya no es alta.
            const edge = cell.type === 'high' && terrain.cells[`${parsed.x},${parsed.y + 1}`]?.type !== 'high';
            const drawn = tile(terrainTile(cell, { biome: kind, edge }));
            if (drawn) el.addClass('wm-terrain-tiled').css('background-image', `url("${drawn}")`);

            // A door is the one piece of terrain that answers to the player. The layer
            // ignores pointer events so it never eats a drag; the door opts back in.
            // While painting, a click means "paint here", so the door stays inert.
            // R6: un cofre también responde: se abre estando al lado.
            // T1 y B3: la palanca y la barricada, igual.
            if (['door', 'chest', 'lever', 'barricade'].includes(cell.type) && typeof onDoorToggle === 'function' && !paintMode) {
                const open = Boolean(cell.open);
                el.addClass('wm-terrain-door-actionable')
                    .attr('title', cell.type === 'chest' ? 'Abrir el cofre' : cell.type === 'lever' ? 'Tirar de la palanca' : cell.type === 'barricade' ? 'Golpear la barricada' : open ? 'Cerrar la puerta' : 'Abrir la puerta')
                    .on('mousedown', function (e) {
                        // Stops the board's own pan handler from starting a drag.
                        e.preventDefault();
                        e.stopPropagation();
                    })
                    .on('click', function (e) {
                        e.preventDefault();
                        e.stopPropagation();
                        onDoorToggle(parsed.x, parsed.y, !open);
                    });
            }

            terrainLayer.append(el);
        }

        // Lo que ya se ha visto: una trampa descubierta, un charco de aceite ardiendo. Sin
        // esto, «el suelo arde» solo lo contaba el chat, y cerrar un pasillo con fuego era
        // una promesa que no se veía.
        for (const hazard of hazards || []) {
            if (!(hazard.x >= 0 && hazard.y >= 0)) continue;
            terrainLayer.append($('<div class="wm-hazard"></div>')
                .toggleClass('wm-hazard-fire', /fuego|fire/i.test(String(hazard.kind ?? '')))
                .attr('title', [hazard.name, hazard.note].filter(Boolean).join(': '))
                .css({
                    left: hazard.x * cellW + 'px',
                    top: hazard.y * cellH + 'px',
                    width: cellW + 'px',
                    height: cellH + 'px',
                }));
        }

        // J19.6: las zonas de conjuro, junto a lo demás que se ve en el suelo: cada casilla con
        // el color de su tipo, y el icono una vez por zona. Lo que hacen lo dice la casilla.
        const iconed = new Set();
        for (const cell of spellZones || []) {
            if (!(cell.x >= 0 && cell.y >= 0 && cell.x < gridWidth && cell.y < gridHeight)) continue;
            const el = $('<div class="wm-spell-zone"></div>')
                .attr('data-kind', cell.kind)
                .attr('data-zone', cell.zoneId)
                .attr('title', `${cell.label}: ${cell.tell}`)
                .css({ left: cell.x * cellW + 'px', top: cell.y * cellH + 'px', width: cellW + 'px', height: cellH + 'px' });
            if (!iconed.has(cell.zoneId)) {
                iconed.add(cell.zoneId);
                el.append($('<span class="wm-spell-zone-icon"></span>').text(cell.icon));
            }
            terrainLayer.append(el);
        }

        // J12.10: lo alto de un mapa con cotas, un poco más claro cuanto más alto, y los
        // acantilados como una raya gruesa en el borde que no se cruza andando.
        if (elevation) {
            for (const [key, feet] of Object.entries(elevation)) {
                const at = parseCellKey(key);
                if (!at || !(Number(feet) > 0) || at.x >= gridWidth || at.y >= gridHeight) continue;
                terrainLayer.append($('<div class="wm-elevated"></div>')
                    .css({
                        left: at.x * cellW + 'px', top: at.y * cellH + 'px', width: cellW + 'px', height: cellH + 'px',
                        opacity: Math.min(0.9, 0.3 + Number(feet) / 100),
                    }));
            }
            for (const edge of cliffEdges(elevation, gridWidth, gridHeight)) {
                const right = edge.side === 'right';
                // El lado alto lleva la luz: se ve hacia dónde se cae.
                const highFirst = edge.drop > 0;
                terrainLayer.append($('<div class="wm-cliff"></div>')
                    .addClass(right ? 'wm-cliff-v' : 'wm-cliff-h')
                    .addClass(highFirst ? 'wm-cliff-high-first' : 'wm-cliff-high-second')
                    .attr('title', `Acantilado: ${Math.abs(edge.drop)} pies. No se cruza andando.`)
                    .css(right
                        ? { left: (edge.x + 1) * cellW - 2 + 'px', top: edge.y * cellH + 'px', width: '4px', height: cellH + 'px' }
                        : { left: edge.x * cellW + 'px', top: (edge.y + 1) * cellH - 2 + 'px', width: cellW + 'px', height: '4px' }));
            }
        }
    }

    /**
     * Draws the fog. Unknown cells are opaque, explored-but-unseen ones are dimmed, and
     * anything currently in sight is left clear.
     */
    function renderFog() {
        fogLayer.empty();
        if (!imgW || !imgH || !fogEnabled) return;

        const cellW = imgW / gridWidth;
        const cellH = imgH / gridHeight;
        fogLayer.css({ width: imgW + 'px', height: imgH + 'px' });

        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                const visibility = getCellVisibility(fog, visibleCells, x, y);
                if (visibility === 'visible') continue;

                fogLayer.append($('<div class="wm-fog-cell"></div>')
                    .addClass(`wm-fog-${visibility}`)
                    .css({
                        left: x * cellW + 'px',
                        top: y * cellH + 'px',
                        width: cellW + 'px',
                        height: cellH + 'px',
                    }));
            }
        }
    }

    function updateGrid() {
        if (!imgW || !imgH) return;
        const cellW = imgW / gridWidth;
        const cellH = imgH / gridHeight;
        gridOverlay.css({
            width: imgW + 'px',
            height: imgH + 'px',
            'background-image': `
                repeating-linear-gradient(to right, rgba(255,255,255,0.12) 0px, rgba(255,255,255,0.12) 1px, transparent 1px, transparent ${cellW}px),
                repeating-linear-gradient(to bottom, rgba(255,255,255,0.12) 0px, rgba(255,255,255,0.12) 1px, transparent 1px, transparent ${cellH}px)
            `,
        });
    }

    function renderHighlights() {
        highlightsLayer.empty();
        if (!imgW || !imgH || !Array.isArray(highlightedCells) || highlightedCells.length === 0) return;

        const cellW = imgW / gridWidth;
        const cellH = imgH / gridHeight;
        highlightsLayer.css({ width: imgW + 'px', height: imgH + 'px' });

        for (const cell of highlightedCells) {
            if (!cell) continue;
            const kind = cell.kind === 'attack' ? 'attack' : 'move';

            const node = $(`<div class="wm-highlight-cell wm-highlight-${kind}" style="left:${cell.gridX * cellW}px;top:${cell.gridY * cellH}px;width:${cellW}px;height:${cellH}px;"></div>`);

            // La capa entera tiene `pointer-events: none` para no comerse los clics del
            // tablero; solo las casillas que de verdad se pueden pulsar los recuperan.
            if (typeof onCellClick === 'function') {
                node.addClass('wm-highlight-clickable');
                node.attr('data-x', String(cell.gridX));
                node.attr('data-y', String(cell.gridY));
                node.on('click', (event) => {
                    event.stopPropagation();
                    if (justPanned()) return;
                    // J20.2: con el dedo, el primer toque en una casilla de andar enseña la ruta
                    // y lo que cuesta; el segundo, en la misma, mueve. Con el ratón eso ya lo
                    // hace pasar por encima, y un clic mueve como siempre.
                    const key = `${cell.gridX},${cell.gridY}`;
                    if (kind === 'move' && typeof onCellHover === 'function' && touchy() && armedCell !== key) {
                        armedCell = key;
                        highlightsLayer.find('.wm-highlight-armed').removeClass('wm-highlight-armed');
                        node.addClass('wm-highlight-armed');
                        drawTrajectory(cell.gridX, cell.gridY, cellW, cellH, true);
                        return;
                    }
                    armedCell = '';
                    onCellClick(cell.gridX, cell.gridY, kind);
                });

                // Ensenar la ruta y lo que cuesta **antes** de pulsar. Mover sin esto es
                // contar casillas a ojo y descubrir el precio cuando ya lo has pagado.
                if (typeof onCellHover === 'function' && kind === 'move') {
                    node.on('mouseenter', () => drawTrajectory(cell.gridX, cell.gridY, cellW, cellH));
                    node.on('mouseleave', () => clearTrajectory());
                }
            }

            highlightsLayer.append(node);
        }
    }

    /** Borra la ruta dibujada, si hay alguna. */
    function clearTrajectory() {
        highlightsLayer.find('.wm-path-step, .wm-path-cost').remove();
    }

    /**
     * Dibuja la ruta hasta una casilla y lo que cuesta llegar.
     *
     * Quien decide la ruta es el motor — el mismo A* que usa la IA —; aqui solo se pinta
     * lo que devuelva. Una ruta dibujada a ojo diria una cosa y el movimiento haria otra.
     *
     * @param {number} gridX
     * @param {number} gridY
     * @param {number} cellW
     * @param {number} cellH
     * @param {boolean} [armed] J20.2: enseñada con un toque; el siguiente, en la misma casilla, mueve.
     */
    function drawTrajectory(gridX, gridY, cellW, cellH, armed = false) {
        clearTrajectory();
        if (typeof onCellHover !== 'function') return;

        const plan = onCellHover(gridX, gridY);
        if (!plan || !Array.isArray(plan.cells) || plan.cells.length === 0) return;

        for (const step of plan.cells) {
            highlightsLayer.append(
                `<div class="wm-path-step${plan.ok ? '' : ' wm-path-far'}" style="`
                + `left:${(step.gridX + 0.5) * cellW}px;top:${(step.gridY + 0.5) * cellH}px;"></div>`,
            );
        }

        const last = plan.cells[plan.cells.length - 1];
        // Idea 1: quien te golpearia al salir de su alcance, dicho antes de pulsar.
        const provokes = Array.isArray(plan.provokes) ? plan.provokes : [];
        if (provokes.length > 0) highlightsLayer.find('.wm-path-step').addClass('wm-path-provoke');
        const said = [`${plan.feet} pies`];
        if (provokes.length > 0) said.push(`te golpea ${provokes.join(', ')}`);
        if (armed) said.push(plan.ok ? 'toca otra vez para ir' : 'no llegas');
        const cost = $('<div class="wm-path-cost"></div>')
            .text(said.join(' · '))
            .toggleClass('wm-path-far', !plan.ok)
            .toggleClass('wm-path-provoke', provokes.length > 0)
            .toggleClass('wm-path-armed', armed)
            .css({ left: `${(last.gridX + 0.5) * cellW}px`, top: `${last.gridY * cellH}px` });
        highlightsLayer.append(cost);
    }

    function placeTokens() {
        tokensLayer.empty();
        if (!imgW || !imgH) return;
        const cellW = imgW / gridWidth;
        const cellH = imgH / gridHeight;

        tokensLayer.css({ width: imgW + 'px', height: imgH + 'px' });

        for (const token of tokens) {
            const px = (token.gridX + 0.5) * cellW;
            const py = (token.gridY + 0.5) * cellH;
            const hpPct = (token.maxHp && token.maxHp > 0) ? Math.min(100, ((token.hp || 0) / token.maxHp) * 100) : 100;

            const enemyClass = token.isEnemy ? ` wm-token-enemy${token.idle ? ' wm-token-idle' : ''}` : (token.isSummon ? ' wm-token-summon' : '');
            const metaText = token.isEnemy
                ? (token.idle ? 'Aquí, sin pelear todavía' : `${token.role ? `${token.role.label} · ` : ''}CA ${token.level || 10}`)
                : token.isSummon
                    ? `Invocación${token.summoner ? ` de ${token.summoner}` : ''}`
                    : `${token.className || 'Aventurero'} de nivel ${token.level || 1}${token.weapon ? ` · ${token.weapon}` : ''}`;
            const selectedClass = selectedTokenId === token.id ? ' wm-token-selected' : '';
            const inRangeClass = Array.isArray(highlightedTokenIds) && highlightedTokenIds.includes(token.id) ? ' wm-token-in-range' : '';

            // A creature bigger than Medium covers more than one cell, and a token drawn
            // the size of a goblin when it is an ogre misleads about reach and about what
            // fits through a door — all of which the engine already computes correctly.
            const sizeCells = Math.max(1, Number(token.sizeCells) || 1);
            const sizeClass = sizeCells > 1 ? ` wm-token-size-${Math.min(4, sizeCells)}` : '';

            const el = $(`
                <div class="wm-token${enemyClass}${selectedClass}${inRangeClass}${sizeClass}">
                    <div class="wm-token-tooltip">
                        <div class="wm-token-tooltip-name"></div>
                        <div class="wm-token-tooltip-meta"></div>
                        <div class="wm-token-tooltip-hp"><div class="wm-token-tooltip-hp-fill"></div></div>
                    </div>
                    <span class="wm-token-name"></span>
                </div>
            `);
            el.attr('data-token-id', token.id);
            el.css({ left: px + 'px', top: py + 'px' });
            el.find('.wm-token-tooltip-name').text(token.name ?? '');
            el.find('.wm-token-tooltip-meta').text(metaText);
            el.find('.wm-token-tooltip-hp-fill').css('width', hpPct + '%');

            const tokenNameEl = el.find('.wm-token-name').text(token.name ?? '');
            // Sin cara propia, su dibujo en pixel; si no carga, lo de siempre.
            const drawn = tokenArt(token);
            if (drawn || token.avatar) {
                const image = $('<img>')
                    .addClass('wm-token-avatar')
                    .attr('src', drawn || token.avatar)
                    .attr('alt', token.name ?? '')
                    .insertBefore(tokenNameEl);
                if (drawn) {
                    image.addClass(`pixel-art ${token.isEnemy || token.isSummon ? 'wm-token-creature' : 'wm-token-bust'}`)
                        .attr('data-pixel', 'true')
                        .one('error', () => {
                            image.removeClass('pixel-art wm-token-creature wm-token-bust').removeAttr('data-pixel');
                            if (token.avatar) image.attr('src', token.avatar);
                            else image.replaceWith($('<div>').addClass('wm-token-unknown').css('background', token.isEnemy ? '#7f1d1d' : '').text(token.isEnemy ? '☠' : '???'));
                        });
                }
            } else if (token.isEnemy) {
                $('<div>')
                    .addClass('wm-token-unknown')
                    .css('background', '#7f1d1d')
                    .text('☠')
                    .insertBefore(tokenNameEl);
            } else {
                $('<div>').addClass('wm-token-unknown').text('???').insertBefore(tokenNameEl);
            }

            // Conditions as small marks on the token itself. The tracker lists them too,
            // but a player looking at the board should not have to look away to find out
            // that the character they are about to move is restrained.
            if (Array.isArray(token.statuses) && token.statuses.length > 0) {
                const strip = $('<div class="wm-token-statuses"></div>');
                for (const status of token.statuses.slice(0, 4)) {
                    strip.append(
                        $('<i class="wm-token-status fa-solid"></i>')
                            .addClass(String(status?.icon || 'fa-circle-exclamation'))
                            .attr('title', status?.effect ? `${status.label}: ${status.effect}` : String(status?.label || '')),
                    );
                }
                el.append(strip);
            }

            // Idea 13: como pelea, en un icono en la esquina de la ficha.
            if (token.isEnemy && token.role) {
                el.append($('<i class="wm-token-role fa-solid"></i>')
                    .addClass(String(token.role.icon))
                    .attr('title', String(token.role.label))
                    .attr('data-role', String(token.role.id)));
            }
            // J19.5: la invocación lleva su marca, para no confundirla con un enemigo.
            if (token.isSummon) {
                el.append($('<i class="wm-token-role wm-token-summon-mark fa-solid fa-paw"></i>')
                    .attr('title', metaText));
            }

            // Drag token
            setupTokenDrag(el, token, cellW, cellH);
            tokensLayer.append(el);
        }
    }

    /**
     * Make a token draggable with grid snap
     * @param {JQuery} el
     * @param {TokenData} token
     * @param {number} cellW
     * @param {number} cellH
     */
    function setupTokenDrag(el, token, cellW, cellH) {
        const isDraggable = !Array.isArray(draggableTokenIds)
            || draggableTokenIds.length === 0
            || draggableTokenIds.includes(token.id);

        if (!isDraggable) {
            // Non-draggable tokens: only respond to clicks (selection, tooltip)
            el.on('click', function (e) {
                e.stopPropagation();
                if (justPanned()) return;
                if (touchy()) showTokenTip(el);
                if (onTokenClick) onTokenClick(token.id);
            });
            return;
        }

        el.on('mousedown', function (e) {
            e.stopPropagation();
            e.preventDefault();
            el.addClass('dragging');
            el.data('wmMoved', false);

            const startMX = e.pageX;
            const startMY = e.pageY;
            const startPX = (token.gridX + 0.5) * cellW;
            const startPY = (token.gridY + 0.5) * cellH;

            const dragNs = 'wmTokenDrag_' + token.id + '_' + Date.now();

            $(document).on(`mousemove.${dragNs}`, function (me) {
                const dx = (me.pageX - startMX) / state.scale;
                const dy = (me.pageY - startMY) / state.scale;
                if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
                    el.data('wmMoved', true);
                }
                el.css({ left: (startPX + dx) + 'px', top: (startPY + dy) + 'px' });

                // Live highlight update during drag
                if (onTokenDragging && imgW && imgH) {
                    const tentGX = Math.max(0, Math.min(gridWidth - 1, Math.floor((startPX + dx) / cellW)));
                    const tentGY = Math.max(0, Math.min(gridHeight - 1, Math.floor((startPY + dy) / cellH)));
                    const newCells = onTokenDragging(token.id, tentGX, tentGY);
                    highlightsLayer.empty();
                    if (newCells && newCells.length > 0) {
                        highlightsLayer.css({ width: imgW + 'px', height: imgH + 'px' });
                        for (const cell of newCells) {
                            if (!cell) continue;
                            const kind = cell.kind === 'attack' ? 'attack' : 'move';
                            highlightsLayer.append(
                                `<div class="wm-highlight-cell wm-highlight-${kind}" style="left:${cell.gridX * cellW}px;top:${cell.gridY * cellH}px;width:${cellW}px;height:${cellH}px;"></div>`,
                            );
                        }
                    }
                }
            });

            $(document).on(`mouseup.${dragNs}`, function (ue) {
                $(document).off(`.${dragNs}`);
                el.removeClass('dragging');

                // Soltar sin haber movido no es un movimiento, es un clic. Avisar de un
                // movimiento aqui redibujaba el tablero entero, y ese redibujado se
                // llevaba por delante la propia ficha: el `click` que venia detras no
                // llegaba a dispararse nunca, asi que pulsar tu ficha no encendia nada.
                if (!el.data('wmMoved')) {
                    el.css({ left: startPX + 'px', top: startPY + 'px' });
                    return;
                }

                const dx = (ue.pageX - startMX) / state.scale;
                const dy = (ue.pageY - startMY) / state.scale;
                const rawX = startPX + dx;
                const rawY = startPY + dy;

                // Snap to grid cell
                let newGX = Math.floor(rawX / cellW);
                let newGY = Math.floor(rawY / cellH);
                newGX = Math.max(0, Math.min(gridWidth - 1, newGX));
                newGY = Math.max(0, Math.min(gridHeight - 1, newGY));

                token.gridX = newGX;
                token.gridY = newGY;

                // Snap visually
                el.css({ left: ((newGX + 0.5) * cellW) + 'px', top: ((newGY + 0.5) * cellH) + 'px' });

                if (onTokenMove) onTokenMove(token.id, newGX, newGY);

                // Update character accordion inputs
                container.closest('.wm-view-panel, [data-map-root]')
                    .find('.wm-char-coord-input')
                    .filter(function () { return $(this).attr('data-token-id') === String(token.id); })
                    .each(function () {
                        const axis = $(this).data('axis');
                        if (axis === 'x') $(this).val(newGX);
                        if (axis === 'y') $(this).val(newGY);
                    });

                window.setTimeout(() => el.removeData('wmMoved'), 0);
            });
        });

        el.on('click', function (e) {
            e.stopPropagation();
            if (el.data('wmMoved') || justPanned()) return;
            if (touchy()) showTokenTip(el);
            if (onTokenClick) onTokenClick(token.id);
        });
    }

    /**
     * J20.2: a toques, lo que el ratón enseña al pasar por encima de una ficha (quién es, su
     * vida, su arma) sale al tocarla, un rato.
     *
     * @param {JQuery} el
     */
    function showTokenTip(el) {
        tokensLayer.find('.wm-token-tip').removeClass('wm-token-tip');
        el.addClass('wm-token-tip');
        window.setTimeout(() => el.removeClass('wm-token-tip'), 3500);
    }

    // Axes for grid (numbered 1..gridWidth / 1..gridHeight)
    function renderGridAxes() {
        container.find('.wm-axes-x, .wm-axes-y').remove();
        if (!imgW || !imgH) return;

        const cellW = imgW / gridWidth;
        const cellH = imgH / gridHeight;
        const cw = container.width() || 300;
        const ch = container.height() || 420;

        // Determine step to avoid overcrowding
        const scaledCellW = cellW * state.scale;
        const scaledCellH = cellH * state.scale;
        const stepX = scaledCellW < 25 ? Math.max(1, Math.round(25 / scaledCellW)) : 1;
        const stepY = scaledCellH < 15 ? Math.max(1, Math.round(15 / scaledCellH)) : 1;

        const axesX = $('<div class="wm-axes-x"></div>');
        const axesY = $('<div class="wm-axes-y"></div>');

        // Una etiqueta por columna, de 1 a su ancho: con `<=` salía una de más, fuera del tablero.
        for (let i = 0; i < gridWidth; i += stepX) {
            const px = state.offsetX + (i + 0.5) * cellW * state.scale;
            if (px < -20 || px > cw + 20) continue;
            axesX.append(`<span class="wm-axis-label" style="left:${px}px;top:2px;">${i + 1}</span>`);
        }

        for (let j = 0; j < gridHeight; j += stepY) {
            const py = state.offsetY + (j + 0.5) * cellH * state.scale;
            if (py < -15 || py > ch + 15) continue;
            axesY.append(`<span class="wm-axis-label" style="top:${py}px;left:2px;">${j + 1}</span>`);
        }

        container.append(axesX, axesY);
    }

    // Override transform to update axes
    const nsId = 'wmLoc_' + Date.now();
    // Sits above the board rather than floating over a corner of it: as an overlay it
    // covered the coordinate axes, and it is information about the selected token, not
    // about any particular part of the map.
    // Se pone encima del tablero al meterlo en la página (abajo): aquí el tablero todavía no
    // está en ella, y `before` sobre algo suelto no hace nada. Por eso no salía nunca.
    const tacticalHud = overlayLegend ? $('<div class="wm-tactical-hud"></div>').text(overlayLegend) : null;

    function fullUpdate() {
        content.css('transform', `translate(${state.offsetX}px, ${state.offsetY}px) scale(${state.scale})`);
        renderGridAxes();
        persistViewState();
    }

    container.off('wheel').on('wheel', function (e) {
        e.preventDefault();
        const oe = /** @type {WheelEvent} */ (e.originalEvent);
        const rect = container[0].getBoundingClientRect();
        const mx = oe.clientX - rect.left;
        const my = oe.clientY - rect.top;
        const delta = oe.deltaY < 0 ? 0.15 : -0.15;
        const newScale = Math.min(6, Math.max(0.5, state.scale + delta * state.scale));
        const ratio = newScale / state.scale;
        state.offsetX = mx - ratio * (mx - state.offsetX);
        state.offsetY = my - ratio * (my - state.offsetY);
        state.scale = newScale;
        userMoved = true;
        fullUpdate();
    });

    content.off('mousedown').on('mousedown', function (e) {
        if (/** @type {HTMLElement} */ (e.target).closest('.wm-token')) return;
        e.preventDefault();
        state.isDragging = true;
        state.lastX = e.pageX;
        state.lastY = e.pageY;
        content.addClass('grabbing');
    });

    $(document).on(`mousemove.${nsId}`, function (e) {
        if (!state.isDragging) return;
        state.offsetX += e.pageX - state.lastX;
        state.offsetY += e.pageY - state.lastY;
        state.lastX = e.pageX;
        state.lastY = e.pageY;
        userMoved = true;
        fullUpdate();
    });
    $(document).on(`mouseup.${nsId}`, function () {
        if (!state.isDragging) return;
        state.isDragging = false;
        content.removeClass('grabbing');
    });

    // ---- J20.2: el tablero a toques ----
    // Un dedo que se arrastra mueve la cámara; dos dedos la acercan o la alejan, y la mueven
    // con ellos. Un toque sin arrastrar es un toque: elige una ficha, enseña una ruta o dice
    // qué hay en la casilla. El ratón sigue con lo suyo (la rueda, arrastrar el fondo).
    container.addClass('wm-touch-board');
    /** @type {Map<number, {x: number, y: number}>} */
    const fingers = new Map();
    /** @type {{x: number, y: number, ox: number, oy: number, moved: boolean}|null} */
    let pan = null;
    /** @type {{distance: number, scale: number, cx: number, cy: number}|null} */
    let pinch = null;
    let pinched = false;
    /** @type {number} */
    let infoTimer = 0;
    const local = (/** @type {{x: number, y: number}} */ p) => {
        const rect = container[0].getBoundingClientRect();
        return { x: p.x - rect.left, y: p.y - rect.top };
    };
    const startPinch = () => {
        const [a, b] = [...fingers.values()];
        const mid = local({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        pinch = {
            distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
            scale: state.scale,
            // El punto del tablero que queda entre los dos dedos, para que se quede ahí.
            cx: (mid.x - state.offsetX) / state.scale,
            cy: (mid.y - state.offsetY) / state.scale,
        };
        pinched = true;
    };
    container[0].addEventListener('pointerdown', (event) => {
        lastPointer = event.pointerType;
        if (event.pointerType === 'mouse') return;
        fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (fingers.size === 1) {
            pinched = false;
            pan = { x: event.clientX, y: event.clientY, ox: state.offsetX, oy: state.offsetY, moved: false };
        } else if (fingers.size === 2) {
            pan = null;
            startPinch();
        }
    }, true);
    container[0].addEventListener('pointermove', (event) => {
        if (event.pointerType === 'mouse' || !fingers.has(event.pointerId)) return;
        fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pinch && fingers.size >= 2) {
            const [a, b] = [...fingers.values()];
            const mid = local({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
            state.scale = Math.min(6, Math.max(0.5, pinch.scale * Math.hypot(a.x - b.x, a.y - b.y) / pinch.distance));
            state.offsetX = mid.x - pinch.cx * state.scale;
            state.offsetY = mid.y - pinch.cy * state.scale;
            userMoved = true;
            fullUpdate();
            return;
        }
        if (!pan) return;
        const dx = event.clientX - pan.x;
        const dy = event.clientY - pan.y;
        // Un dedo tiembla: hasta unos píxeles, sigue siendo un toque.
        if (!pan.moved && Math.hypot(dx, dy) < 10) return;
        pan.moved = true;
        state.offsetX = pan.ox + dx;
        state.offsetY = pan.oy + dy;
        userMoved = true;
        fullUpdate();
    });
    const liftFinger = (/** @type {PointerEvent} */ event) => {
        if (event.pointerType === 'mouse' || !fingers.has(event.pointerId)) return;
        fingers.delete(event.pointerId);
        const wasPan = Boolean(pan?.moved) || pinched;
        if (wasPan) panEndedAt = Date.now();
        if (fingers.size === 1) {
            // Queda un dedo tras pellizcar: sigue moviendo la cámara desde donde está.
            const [rest] = [...fingers.values()];
            pinch = null;
            pan = { x: rest.x, y: rest.y, ox: state.offsetX, oy: state.offsetY, moved: true };
            return;
        }
        if (fingers.size > 0) return;
        pan = null;
        pinch = null;
        // Un toque quieto en el tablero dice qué hay en la casilla, como el ratón al pasar.
        const onButton = Boolean(/** @type {HTMLElement} */ (event.target).closest?.('.wm-zoom-controls'));
        if (!wasPan && event.type === 'pointerup' && cellInfo && !onButton) {
            const at = cellUnder(event.clientX, event.clientY);
            if (at) {
                cellInfo.text(describeAt(at.gx, at.gy)).show();
                window.clearTimeout(infoTimer);
                const info = cellInfo;
                infoTimer = window.setTimeout(() => info.hide(), 4000);
            }
        }
    };
    container[0].addEventListener('pointerup', liftFinger);
    container[0].addEventListener('pointercancel', liftFinger);

    // Doble clic: volver a encuadrar, y que se encuadre solo otra vez. (Antes llevaba la
    // vista a la esquina con el zoom a 1, que no servía para nada.)
    container.off('dblclick').on('dblclick', function (e) {
        if (/** @type {HTMLElement} */ (e.target).closest('.wm-token')) return;
        userMoved = false;
        if (imgW && imgH) fitView();
        else zoomable.reset();
        fullUpdate();
    });

    // Si el sitio cambia de tamaño (otra escena, otra ventana, la columna del diálogo) y
    // nadie ha movido la vista, se vuelve a encuadrar: el primer encuadre se hacía con el
    // tamaño que hubiera en ese momento, a veces ninguno, y ahí se quedaba.
    if (typeof ResizeObserver === 'function') {
        const watcher = new ResizeObserver(() => {
            if (!document.body.contains(container[0])) {
                watcher.disconnect();
                return;
            }
            if (userMoved || !imgW || !imgH || container.width() < 40 || container.height() < 40) return;
            fitView();
            fullUpdate();
        });
        watcher.observe(container[0]);
    }

    /**
     * Lays the board out once its size is known.
     *
     * With a background image that is the image's natural size; without one it is derived
     * from the grid, so an art-less board still lands on a sane canvas.
     *
     * @param {number} width
     * @param {number} height
     */
    function setupLayout(width, height) {
        imgW = width;
        imgH = height;

        // Without an image there is nothing giving the canvas a size, so it is set here.
        if (!hasImage) {
            content.css({ width: imgW + 'px', height: imgH + 'px' });
        }

        const saved = locationViewStateMemory.get(derivedViewStateKey);
        if (saved) gridVisible = Boolean(saved.gridVisible);
        // La vista que alguien movió a mano se respeta; la que se encuadró sola se vuelve a
        // encuadrar, porque el sitio puede no ser el mismo (otra escena, otra ventana).
        if (saved && saved.auto === false) {
            userMoved = true;
            state.scale = Math.max(0.5, Math.min(6, Number(saved.scale) || 1));
            state.offsetX = Number(saved.offsetX) || 0;
            state.offsetY = Number(saved.offsetY) || 0;
        } else {
            fitView();
        }

        updateGrid();
        renderTerrain();
        renderHighlights();
        placeTokens();
        renderFog();
        fullUpdate();
        gridOverlay.toggleClass('hidden', !gridVisible);
        focusActiveToken();
    }

    /**
     * K3: al empezar el turno de alguien, su ficha a la vista. Si en su centro hay otra cosa
     * que el tablero (la cabecera, o nada porque está fuera), se centra; si se ve, no se toca.
     * Una vez por turno: quien mueve el tablero a mano no se lo encuentra movido.
     */
    function focusActiveToken() {
        if (focusTokenId === null || focusTokenId === undefined || !focusKey) return;
        // Hasta que el tablero no está en la página no se sabe qué se ve.
        if (!document.body.contains(container[0]) || !container.width()) return;
        if (focusMemory.get(derivedViewStateKey) === focusKey) return;
        const token = tokens.find(t => String(t.id) === String(focusTokenId));
        if (!token || !imgW || !imgH) return;
        focusMemory.set(derivedViewStateKey, focusKey);
        const element = container.find(`.wm-token[data-token-id="${String(focusTokenId)}"]`)[0];
        const rect = element?.getBoundingClientRect();
        if (rect && rect.width > 0 && rect.height > 0) {
            const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
            if (hit && container[0].contains(hit)) return;
        }
        const cw = container.width() || 300;
        const ch = container.height() || 420;
        state.offsetX = cw / 2 - (Number(token.gridX) + 0.5) * (imgW / gridWidth) * state.scale;
        state.offsetY = ch / 2 - (Number(token.gridY) + 0.5) * (imgH / gridHeight) * state.scale;
        fullUpdate();
    }

    if (hasImage) {
        content.find('img').first().on('load', function () {
            setupLayout(
                /** @type {HTMLImageElement} */ (this).naturalWidth,
                /** @type {HTMLImageElement} */ (this).naturalHeight,
            );
        });
    } else {
        // No image to wait for, so size the canvas from the grid and lay out immediately.
        const CELL_PX = 44;
        setupLayout(gridWidth * CELL_PX, gridHeight * CELL_PX);
    }

    // Terrain painting. Click, or drag with the button held, to paint a run of cells.
    if (paintMode && typeof onPaintCell === 'function') {
        container.addClass('wm-painting');
        let painting = false;
        /** @type {string} */
        let lastPainted = '';

        /** @param {number} clientX @param {number} clientY */
        const paintAt = (clientX, clientY) => {
            if (!imgW || !imgH) return;
            const rect = content[0].getBoundingClientRect();
            const cellW = (imgW * state.scale) / gridWidth;
            const cellH = (imgH * state.scale) / gridHeight;
            const gx = Math.floor((clientX - rect.left) / cellW);
            const gy = Math.floor((clientY - rect.top) / cellH);
            if (gx < 0 || gy < 0 || gx >= gridWidth || gy >= gridHeight) return;

            const key = `${gx},${gy}`;
            if (key === lastPainted) return; // do not repaint the cell under a slow drag
            lastPainted = key;
            onPaintCell(gx, gy, paintMode);
        };

        content.on('mousedown.wmpaint', function (e) {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            painting = true;
            lastPainted = '';
            paintAt(e.clientX, e.clientY);
        });

        $(document).on('mousemove.wmpaint', function (e) {
            if (painting) paintAt(e.clientX, e.clientY);
        });

        $(document).on('mouseup.wmpaint', function () {
            painting = false;
            lastPainted = '';
        });
    }

    // Zoom controls
    const zoomControls = $(`
        <div class="wm-zoom-controls">
            <button class="wm-zoom-btn" data-action="in" title="Acercar"><i class="fa-solid fa-magnifying-glass-plus"></i></button>
            <button class="wm-zoom-btn" data-action="out" title="Alejar"><i class="fa-solid fa-magnifying-glass-minus"></i></button>
            <button class="wm-zoom-btn ${gridVisible ? 'active' : ''}" data-action="grid" title="Ver u ocultar las casillas"><i class="fa-solid fa-border-all"></i></button>
        </div>
    `);
    zoomControls.find('[data-action="in"]').on('click', () => { state.scale = Math.min(6, state.scale * 1.3); userMoved = true; fullUpdate(); });
    zoomControls.find('[data-action="out"]').on('click', () => { state.scale = Math.max(0.5, state.scale / 1.3); userMoved = true; fullUpdate(); });
    zoomControls.find('[data-action="grid"]').on('click', function () {
        gridVisible = !gridVisible;
        $(this).toggleClass('active', gridVisible);
        gridOverlay.toggleClass('hidden', !gridVisible);
        persistViewState();
    });
    container.append(zoomControls);

    // Lo que dice la ficha elegida (lo que le queda por andar, su alcance, o que se pulse una
    // casilla encendida para ir), justo encima del tablero.
    if (tacticalHud) target.append(tacticalHud);
    target.append(container);
    // K3: con el tablero ya en la página, la ficha a la que le toca, a la vista.
    requestAnimationFrame(() => focusActiveToken());

    // Characters accordion
    renderCharactersAccordion(target, tokens, (tokenId, gx, gy) => {
        // Update token data
        const tk = tokens.find(t => t.id === tokenId);
        if (tk) {
            tk.gridX = gx;
            tk.gridY = gy;
        }
        placeTokens();
        if (onTokenMove) onTokenMove(tokenId, gx, gy);
    });

    // El arte en pixel de las casillas y las fichas: si el índice todavía no ha llegado, se
    // vuelven a poner cuando llegue (sin él salen como siempre).
    if (!pixelManifest()) {
        void loadPixelManifest().then(() => {
            if (container.closest('body').length === 0) return;
            renderTerrain();
            placeTokens();
        });
    }

    // Cleanup
    container.on('remove', () => {
        $(document).off(`.${nsId}`);
    });
}

// ============================================================
//  CHARACTERS ACCORDION
// ============================================================

/**
 * Render the collapsible characters panel with coordinate inputs.
 * @param {JQuery} target
 * @param {TokenData[]} tokens
 * @param {(tokenId: number, gridX: number, gridY: number) => void} onCoordChange
 */
function renderCharactersAccordion(target, tokens, onCoordChange) {
    const panel = $('<div class="wm-characters-panel"></div>');

    const toggle = $(`
        <div class="wm-characters-toggle">
            <span><i class="fa-solid fa-users" style="margin-right:6px;"></i>Quién hay en el tablero</span>
            <i class="fa-solid fa-chevron-down chevron"></i>
        </div>
    `);
    const body = $('<div class="wm-characters-body"></div>');

    toggle.on('click', function () {
        toggle.toggleClass('open');
        body.toggleClass('open');
    });

    if (tokens.length === 0) {
        body.append('<div style="font-size:0.78rem;opacity:0.5;text-align:center;padding:8px;">No characters on this map.</div>');
    } else {
        for (const token of tokens) {
            const row = $(`
                <div class="wm-char-row">
                    <span class="wm-char-name"></span>
                    <div class="wm-char-coords">
                        <span class="wm-char-coord-label">X</span>
                        <input type="number" class="wm-char-coord-input" data-axis="x" min="0" />
                        <span class="wm-char-coord-label">Y</span>
                        <input type="number" class="wm-char-coord-input" data-axis="y" min="0" />
                    </div>
                </div>
            `);

            const charNameEl = row.find('.wm-char-name').text(token.name ?? '');
            const drawn = tokenArt(token);
            if (drawn || token.avatar) {
                $('<img>')
                    .addClass('wm-char-avatar')
                    .toggleClass('pixel-art wm-char-pixel', Boolean(drawn))
                    .attr('src', drawn || token.avatar)
                    .attr('alt', token.name ?? '')
                    .insertBefore(charNameEl);
            } else {
                $('<div>')
                    .addClass('wm-char-avatar')
                    .css({
                        display: 'flex',
                        'align-items': 'center',
                        'justify-content': 'center',
                        background: '#1a1a2e',
                        color: '#f59e0b',
                        'font-size': '0.6rem',
                        'font-weight': '700',
                    })
                    .text('???')
                    .insertBefore(charNameEl);
            }

            row.find('.wm-char-coord-input').attr('data-token-id', token.id);
            row.find('.wm-char-coord-input[data-axis="x"]').val(token.gridX);
            row.find('.wm-char-coord-input[data-axis="y"]').val(token.gridY);
            // Quien todavía no pelea está donde lo puso el tablero: se ve, no se mueve.
            if (token.idle) row.addClass('wm-char-idle').find('.wm-char-coord-input').prop('disabled', true);

            row.find('.wm-char-coord-input').on('change', function () {
                const axis = $(this).data('axis');
                const val = parseInt(String($(this).val()), 10) || 0;
                const gx = axis === 'x' ? val : token.gridX;
                const gy = axis === 'y' ? val : token.gridY;
                onCoordChange(token.id, gx, gy);
            });

            body.append(row);
        }
    }

    panel.append(toggle, body);
    target.append(panel);
}
