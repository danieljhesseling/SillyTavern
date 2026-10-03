/**
 * World Map Renderer Module
 * Provides zoomable world map with location markers and location/board grid views with character tokens.
 */

import { parseCellKey, describeCell } from './game-engine/board/terrain.js';
import { cliffEdges, elevationAt, isCliff } from './game-engine/board/heights.js';
import { centerOn, isInView, isLargeBoard, readableScale } from './game-engine/board/board-camera.js';
import { zoneAt } from './game-engine/board/zones.js';
import { cellRectsHtml, fogRects, inWindow, visibleWindow, windowCovers } from './game-engine/board/draw-light.js';
import { boardBiome, bridgeTiles, cliffFace, enemyArt, firstArt, hazardTile, isPlainFace, loadPixelManifest, openPack, pixelManifest, terrainTile } from './game-engine/ui/pixel-art.js';
import { initialsFor } from './game-engine/ui/hero-face.js';
import { attachBoardKeys } from './game-engine/ui/board-keys.js';
import { keyboardInUse } from './game-engine/ui/keyboard-nav.js';
import {
    BUTTON_STEP, RECENT_HAND_MS, cellCenter, centerPoint, centerPointFit, clampPan, clampScale, fitBoard, followDecision, isPointShown,
    panToShow, safeRect, toScreen, wheelScale, zoomAt, zoomLabel, zoomLimits,
} from './game-engine/ui/combat-vtt/camera.js';
import { createMinimap, minimapCells } from './game-engine/ui/combat-vtt/minimap.js';
import { placeEdgeMarkers, renderEdgeMarkers } from './game-engine/ui/combat-vtt/edge-markers.js';
import { findPath } from './game-engine/board/pathfinding.js';
import { motionMs } from './game-engine/ui/motion.js';
import { planSlide, slideFrames, slideLeft } from './game-engine/ui/combat-vtt/token-slide.js';
import { tokenLabel } from './game-engine/ui/combat-vtt/token-label.js';
import { announceTurn, forgetTurn } from './game-engine/ui/combat-vtt/turn-banner.js';
import { deathSavesNode, downMarkNode, isDownToken } from './game-engine/ui/combat-vtt/impact.js';

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
 * J20.6: una caja del tablero en su sitio, como se escribe en un `style`.
 *
 * @param {number} left
 * @param {number} top
 * @param {number} width
 * @param {number} height
 * @returns {string}
 */
function boxStyle(left, top, width, height) {
    return `left:${left}px;top:${top}px;width:${width}px;height:${height}px`;
}

/** Lo que va en una clase: letras, cifras y guiones. @param {unknown} text */
const classSafe = (text) => String(text ?? '').replace(/[^a-z0-9_-]/gi, '');

/**
 * Una dirección para `url('…')` dentro de un `style="…"`: sin comillas, espacios ni nada que
 * cierre antes de tiempo el `url` o el atributo.
 *
 * @param {string} url
 * @returns {string}
 */
const cssUrl = (url) => String(url).replace(/["'\\()<>&\s]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`);

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
    if (token.isSummon) return firstArt('creature', { name: token.name, archetype: token.archetype });
    // Tanda 9: un enemigo que es alguien del paquete (el rival de un duelo) lleva su retrato.
    if (token.isEnemy) return enemyArt({ name: token.name, archetype: token.archetype, pack: openPack() });
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
 * @property {any} [face] - D-J52: la cara sin arte que eligió uno del grupo (iniciales, icono o emoji).
 * @property {boolean} [isSummon] - J19.5: una invocación, del lado del grupo.
 * @property {string} [summoner] - Quién la invocó, para su ayuda.
 * @property {boolean} [boss] - Un jefe: lleva su corona y un cerco que se ve desde lejos.
 * @property {{successes?: number, failures?: number, stable?: boolean}} [deathSaves] - Tanda 22: las salvaciones de muerte de uno de los tuyos en el suelo.
 */

/**
 * @typedef {Object} HighlightCell
 * @property {number} gridX
 * @property {number} gridY
 * @property {'move'|'attack'|'place'} [kind] Tanda 10: `place`, una casilla de salida antes de la pelea.
 */

/** @type {Map<string, {scale: number, offsetX: number, offsetY: number, gridVisible: boolean, auto?: boolean}>} */
const locationViewStateMemory = new Map();

/** K3: el último turno que se centró en cada tablero, para centrar una vez por turno y no más. */
const focusMemory = new Map();

/** J12.13: dónde estaba la última vez la ficha que sigue la cámara, por tablero. */
const followMemory = new Map();

/**
 * Tanda 10: lo que se sabe de la cámara de cada tablero entre un dibujo y el siguiente: el turno
 * al que ya fue a buscar a quien le toca, el turno en el que se movió a mano y cuándo.
 *
 * @type {Map<string, {followed: string, handTurn: string, handAt: number}>}
 */
const vttMemory = new Map();

/**
 * Tanda 17: dónde estaba cada ficha en el último dibujo de cada tablero y las que van andando
 * (`token-slide.js`): al redibujar, una ficha que ha cambiado de casilla anda hasta ella en vez de
 * aparecer allí. Por tablero (`derivedViewStateKey`) y por ficha.
 *
 * @type {Map<string, {cells: Map<string, {x: number, y: number}>, slides: Map<string, import('./game-engine/ui/combat-vtt/token-slide.js').Slide>}>}
 */
const tokenMemory = new Map();

/**
 * Tanda 17: lo que les queda por andar a las fichas que van andando, en milisegundos (0 si no anda
 * ninguna). Para quien quiera esperar a que acaben antes de enseñar otra cosa (los dados de un
 * ataque que viene después de moverse).
 *
 * @returns {number}
 */
export function boardMotionLeftMs() {
    const now = performance.now();
    let most = 0;
    for (const memo of tokenMemory.values()) {
        for (const slide of memo.slides.values()) most = Math.max(most, slideLeft(slide, now));
    }
    return most;
}

/**
 * Tanda 17: una ficha que ya se ha visto llegar a `cell` por otro lado (la secuencia del combate la
 * hace andar en el tablero sin redibujarlo, `combat-vtt/fx.js`): al redibujar, no vuelve a andar
 * el mismo camino.
 *
 * @param {number|string} tokenId
 * @param {{x: number, y: number}} cell
 */
export function noteTokenShownAt(tokenId, cell) {
    const id = String(tokenId);
    for (const memo of tokenMemory.values()) {
        if (!memo.cells.has(id)) continue;
        memo.cells.set(id, { x: Number(cell?.x) || 0, y: Number(cell?.y) || 0 });
        memo.slides.delete(id);
    }
}

/**
 * Tanda 17: con qué se juega ahora, el teclado (`key`) o el ratón y el dedo (`pointer`). Se apunta
 * en la página (`html[data-gs-input]`): el cuadro amarillo del cursor del teclado (board-keys.js)
 * solo sale con el teclado; tras un clic o un toque se va (combat-vtt.css, sección 1). Daniel: «¿por
 * qué sigue ese símbolo amarillo ahí?»: pulsar el tablero con el ratón le daba el foco, y con el
 * foco salía el cursor en la casilla de antes.
 */
let boardInput = '';
let watchingInput = false;

/** Pone a escuchar con qué se juega, una vez. */
function watchBoardInput() {
    if (watchingInput || typeof document === 'undefined') return;
    watchingInput = true;
    const mark = (/** @type {string} */ how) => {
        if (boardInput === how) return;
        boardInput = how;
        document.documentElement.dataset.gsInput = how;
    };
    document.addEventListener('keydown', (event) => {
        if (!['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) mark('key');
    }, true);
    document.addEventListener('pointerdown', () => mark('pointer'), true);
}

/**
 * Tanda 10: el tablero como una mesa virtual (wiki/maquetas/ENCARGO_COMBATE_VTT.md).
 *
 * @typedef {Object} VttOptions
 * @property {boolean} [combat] Si hay pelea: entonces salen los marcadores de borde de los enemigos.
 * @property {number|string|null} [activeTokenId] Quien tiene el turno: Espacio y «Centrar» van a su ficha.
 * @property {string} [turnKey] Qué turno es (ronda y quién): al empezar cada uno, la cámara le busca.
 * @property {boolean} [yours] Si el turno es tuyo: entonces se le busca aunque acabes de mover la
 *   cámara; en el de un enemigo, no, que estarás mirando algo.
 * @property {Array<{id: number|string, name: string, feet?: number}>} [edgeTargets] Quién lleva marcador
 *   de borde si no se le ve (los enemigos que el grupo ve), con su distancia en pies.
 * @property {(tokenId: number|string) => HighlightCell[]|null} [reachOf] Hasta dónde llega una ficha
 *   tuya: se enciende en azul al pasar el ratón por encima, sin pulsar.
 * @property {string} [turnTitle] Tanda 17: lo que dice el cartel al empezar el turno («Tu turno, Laedor»,
 *   «Turno del ratero del muelle»; `turn-banner.js`). Sin esto, no sale cartel.
 * @property {'yours'|'ally'|'enemy'} [turnSide] De quién es el turno, para el color del cartel y del aro.
 */

/**
 * Tanda 10: lo que `renderLocationView` devuelve con `vtt`: la cámara, para que la iniciativa y
 * los demás lleven la vista a una ficha, y las esquinas del HUD donde poner sus islas.
 *
 * @typedef {Object} VttHandle
 * @property {(tokenId: number|string, smooth?: boolean) => boolean} centerOnToken
 * @property {(factor: number) => void} zoomBy
 * @property {() => {scale: number, offsetX: number, offsetY: number}} view
 * @property {{root: HTMLElement, topLeft: HTMLElement, topCenter: HTMLElement, topRight: HTMLElement, bottomLeft: HTMLElement, edges: HTMLElement}} hud
 */

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
 * @param {number|string|null} [options.followTokenId] - J12.13: la ficha que sigue la cámara (quien abre la marcha,
 *   o a quien le toca). En un tablero grande, que no cabe entero con casillas que se lean, la vista se acerca y,
 *   cada vez que esa ficha cambia de sitio (`followKey`), si se acerca al borde, se centra en ella.
 * @param {string} [options.followKey] - Dónde está esa ficha ahora: cuando cambia, la cámara mira si seguirla.
 * @param {VttOptions|null} [options.vtt] - Tanda 10: el tablero a toda la pantalla de juego, con su cámara
 *   (arrastrar, la rueda hacia el cursor, dos dedos; de 0,45× a 2,2×), el minimapa, los botones de la
 *   cámara y, en combate, los marcadores de borde. Sin esto, el tablero de siempre (el del cajón).
 * @returns {VttHandle|null} Con `vtt`, la cámara y las esquinas del HUD.
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
        followTokenId = null,
        followKey = '',
        vtt = null,
    } = options;

    target.empty();
    // Tanda 10: el tablero como una mesa virtual: la capa del HUD encima, en la que solo las
    // islas reciben clics. Va al lado del tablero, no dentro: un clic en una isla nunca llega a
    // una casilla, y la rueda sobre el resumen no acerca el mapa.
    const vttOn = Boolean(vtt);
    const hud = vttOn ? buildVttHud() : null;
    target.toggleClass('vtt-board', vttOn);
    /** Tanda 10: el minimapa de la esquina, con el HUD. @type {import('./game-engine/ui/combat-vtt/minimap.js').MinimapHandle|null} */
    let minimap = null;

    // A board with no art is still a board: the grid, terrain, tokens and fog only need
    // dimensions, not a picture. Refusing to render without one made every gridded map
    // depend on somebody having uploaded an image first.
    const hasImage = Boolean(imageUrl);
    // J12.13: un tablero (con terreno) grande se juega por partes; un mapa de localización, no.
    const bigBoard = Boolean(terrain) && isLargeBoard(gridWidth, gridHeight);

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
    if (hasImage && !vttOn) {
        $('<img class="wm-location-header-icon">')
            .attr('src', imageUrl)
            .attr('alt', name)
            .prependTo(header);
    }
    // Tanda 10: en la mesa virtual, el nombre del sitio (y de la sala, J12.11) va en una placa
    // arriba a la izquierda, encima del mapa.
    if (hud) hud.topLeft.appendChild(header[0]);
    else target.append(header);

    const zoomable = createZoomableContainer({ imageUrl, containerHeight: 420 });
    const { container, content, state } = zoomable;

    let gridVisible = true;
    let imgW = 0;
    let imgH = 0;
    /** Si alguien ha movido la vista a mano: mientras no, el tablero se encuadra solo. */
    let userMoved = false;
    /** Tanda 10: el encuadre que se dejó para cuando el tablero tenga sitio (`fitView`). */
    let fitPending = false;
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
    // Tanda 17: el cursor del teclado, solo con el teclado (`watchBoardInput`).
    watchBoardInput();
    /**
     * Tanda 17: las fichas que han echado a andar en este dibujo, para que la cámara las acompañe.
     *
     * @type {Array<{id: string, slide: import('./game-engine/ui/combat-vtt/token-slide.js').Slide}>}
     */
    let freshSlides = [];
    /** Tanda 17: la vista del dibujo anterior de este tablero: la nueva llega deslizándose desde ella. */
    const viewBefore = vttOn && locationViewStateMemory.has(derivedViewStateKey) ? { ...locationViewStateMemory.get(derivedViewStateKey) } : null;

    /** J20.6: lo que mide la caja del tablero, leído en lo que se está haciendo ahora. @type {{width: number, height: number}|null} */
    let sizeMemo = null;
    /**
     * J20.6: lo que mide la caja del tablero. Preguntarlo obliga al navegador a colocar la página
     * entera si algo ha cambiado, y dibujar el tablero lo preguntaba seis o siete veces seguidas
     * cambiando cosas entre medias: en un teléfono, cada vez se nota. Se lee una vez y vale hasta
     * que acaba lo que se está haciendo (la caja mide lo mismo dibuje lo que dibuje dentro). Fuera
     * de la página mide 0, y eso no se apunta.
     *
     * @returns {{width: number, height: number}}
     */
    function viewSize() {
        if (sizeMemo) return sizeMemo;
        const size = { width: container.width() || 0, height: container.height() || 0 };
        if (container[0].isConnected) {
            sizeMemo = size;
            setTimeout(() => { sizeMemo = null; }, 0);
        }
        return size;
    }

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

    /** Lo que mide una casilla en el dibujo, sin acercar. */
    const cellPx = () => (imgW && imgH ? Math.min(imgW / gridWidth, imgH / gridHeight) : 0);

    /** Tanda 10: hasta dónde se acerca y se aleja la cámara: en la mesa virtual, de 0,45× a 2,2×. */
    function limitsOf() {
        return vttOn ? zoomLimits(cellPx()) : { min: 0.5, max: 6 };
    }

    /**
     * Tanda 10: la parte de la vista que se mira, sin lo que tapan las islas del HUD: la columna de
     * la iniciativa (si baja por la derecha) y la barra de abajo, si flota encima del tablero.
     *
     * @returns {import('./game-engine/ui/combat-vtt/camera.js').ScreenRect}
     */
    function lookRect() {
        const { width, height } = viewSize();
        if (!hud || !width || !height || !container[0].isConnected) return safeRect(width || 300, height || 420);
        const box = container[0].getBoundingClientRect();
        const insets = { top: 0, right: 0, bottom: 0, left: 0 };
        const column = hud.topRight.getBoundingClientRect();
        if (column.width > 0 && column.height > 0) {
            if (column.left > box.left + box.width / 2 && column.height > box.height * 0.3) insets.right = Math.max(0, box.right - column.left + 8);
            else if (column.width > box.width / 2) {
                // El teléfono: el HUD de arriba va de lado a lado, en una columna (la iniciativa,
                // el resumen y, debajo, el sitio): se mira lo que queda por debajo de todo él.
                let lowest = column.bottom;
                for (const part of [hud.topLeft, hud.topCenter]) {
                    const r = part.getBoundingClientRect();
                    if (r.height > 0 && r.top < box.top + box.height / 2) lowest = Math.max(lowest, r.bottom);
                }
                insets.top = Math.max(0, lowest - box.top + 6);
                // Y por encima de la cámara y el minimapa, que ahí van en una fila al pie.
                const low = hud.bottomLeft.getBoundingClientRect();
                if (low.height > 0 && low.top > box.top + box.height / 2) insets.bottom = Math.max(0, box.bottom - low.top + 6);
            }
        }
        for (const node of document.querySelectorAll('.gs-root .gs-actions')) {
            const bar = node.getBoundingClientRect();
            if (bar.width > 0 && bar.height > 0 && bar.top < box.bottom && bar.bottom > box.top + box.height / 2) {
                insets.bottom = Math.max(insets.bottom, box.bottom - bar.top + 8);
            }
        }
        return safeRect(width, height, insets);
    }

    /**
     * Tanda 10: la vista que pone `cell` en el centro de `rect`, sin enseñar vacío por fuera de un
     * tablero que es más grande que lo que se mira (J12.13).
     *
     * @param {{x: number, y: number}} cell
     * @param {import('./game-engine/ui/combat-vtt/camera.js').ScreenRect} rect
     */
    function centerCellIn(cell, rect) {
        const placed = centerOn({
            cell, cellW: imgW / gridWidth, cellH: imgH / gridHeight, scale: state.scale,
            viewW: rect.right - rect.left, viewH: rect.bottom - rect.top, boardW: imgW, boardH: imgH,
        });
        return { offsetX: placed.offsetX + rect.left, offsetY: placed.offsetY + rect.top };
    }

    /**
     * Tanda 10: el encuadre de la mesa virtual: el tablero entero en lo que se mira, entre 0,45× y
     * 2,2×; uno grande (J12.13), con casillas que se lean y mirando al grupo.
     */
    function fitVtt() {
        const rect = lookRect();
        const limits = limitsOf();
        if (bigBoard) {
            const readable = readableScale({
                fitScale: Math.min((rect.right - rect.left) / imgW, (rect.bottom - rect.top) / imgH),
                cellPx: cellPx(),
            });
            if (readable.partial) {
                state.scale = clampScale(readable.scale, limits);
                Object.assign(state, centerCellIn(followCell() ?? { x: (gridWidth - 1) / 2, y: (gridHeight - 1) / 2 }, rect));
                return;
            }
        }
        Object.assign(state, fitBoard({ width: imgW, height: imgH }, rect, limits, hasImage ? 1 : 2));
    }

    /**
     * El encuadre que llena el sitio que hay, centrado. Un tablero sin arte puede crecer
     * hasta el doble (sus casillas no se pixelan); una imagen, no más allá de su tamaño.
     */
    function fitView() {
        if (vttOn) {
            // Tanda 10: sin medida (el tablero aún fuera de la página, o en una escena escondida)
            // no se encuadra: se encuadraba a 300 × 420, y esa vista diminuta se quedaba para
            // siempre. Se espera a que el tablero tenga sitio (`ResizeObserver`, abajo).
            if (!container[0].isConnected || viewSize().width < 40 || viewSize().height < 40) {
                fitPending = true;
                return;
            }
            fitPending = false;
            fitVtt();
            return;
        }
        const cw = viewSize().width || 300;
        const ch = viewSize().height || 420;
        const fitScale = Math.min(cw / imgW, ch / imgH, hasImage ? 1 : 2);
        // J12.13: un tablero grande, entero, tiene las casillas demasiado pequeñas: se acerca
        // hasta que se leen, y se mira donde está el grupo. El resto se ve moviendo la cámara.
        const readable = bigBoard
            ? readableScale({ fitScale, cellPx: Math.min(imgW / gridWidth, imgH / gridHeight) })
            : { scale: fitScale, partial: false };
        state.scale = readable.scale;
        if (readable.partial) {
            const at = followCell() ?? { x: (gridWidth - 1) / 2, y: (gridHeight - 1) / 2 };
            Object.assign(state, centerOn({
                cell: at, cellW: imgW / gridWidth, cellH: imgH / gridHeight, scale: state.scale,
                viewW: cw, viewH: ch, boardW: imgW, boardH: imgH,
            }));
            return;
        }
        state.offsetX = (cw - imgW * fitScale) / 2;
        state.offsetY = (ch - imgH * fitScale) / 2;
    }

    /**
     * J12.13: la casilla de la ficha que sigue la cámara; si no está, la de a quien le toca o la
     * primera del grupo.
     *
     * @returns {{x: number, y: number}|null}
     */
    function followCell() {
        // Tanda 10: en la mesa virtual, quien tiene el turno (también un enemigo) va primero.
        const wanted = [vtt?.activeTokenId, followTokenId, focusTokenId].filter(id => id !== null && id !== undefined);
        const token = wanted.map(id => tokens.find(t => String(t.id) === String(id))).find(Boolean)
            ?? tokens.find(t => !t.isEnemy && !t.isNPC);
        return token ? { x: Number(token.gridX) || 0, y: Number(token.gridY) || 0 } : null;
    }

    /**
     * J12.13: la cámara sigue al grupo. Cada vez que la ficha que se sigue cambia de sitio, si se
     * ha ido cerca del borde de la vista (o fuera), la vista se centra en ella; si se ve bien, no
     * se toca: quien ha movido la cámara a mano no se la encuentra movida sin motivo.
     */
    function followParty() {
        if (!bigBoard || !followKey || !imgW || !imgH) return;
        if (!document.body.contains(container[0]) || !viewSize().width) return;
        if (followMemory.get(derivedViewStateKey) === followKey) return;
        followMemory.set(derivedViewStateKey, followKey);
        const cell = followCell();
        if (!cell) return;
        // Tanda 10: en la mesa virtual se mira lo que no tapa el HUD, con una quinta parte de margen.
        if (vttOn) {
            const rect = lookRect();
            const margin = Math.min(rect.right - rect.left, rect.bottom - rect.top) * 0.2;
            if (isPointShown(state, cellCenter(cell, imgW / gridWidth, imgH / gridHeight), rect, margin)) return;
            // Lo mueve el juego, no quien juega: el tablero puede volver a encuadrarse solo.
            Object.assign(state, centerCellIn(cell, rect));
            fullUpdate();
            return;
        }
        const view = {
            cellW: imgW / gridWidth, cellH: imgH / gridHeight, scale: state.scale,
            viewW: viewSize().width || 300, viewH: viewSize().height || 420,
        };
        if (isInView({ ...view, cell, offsetX: state.offsetX, offsetY: state.offsetY })) return;
        Object.assign(state, centerOn({ ...view, cell, boardW: imgW, boardH: imgH }));
        fullUpdate();
    }

    /**
     * Tanda 10: lo que hace la cámara al moverla a mano (arrastrar, la rueda, dos dedos, los
     * botones): se apunta, para que al empezar el turno no se la quiten de donde la ha puesto.
     */
    function noteHand() {
        userMoved = true;
        if (!vttOn) return;
        const memo = vttMemory.get(derivedViewStateKey) ?? { followed: '', handTurn: '', handAt: 0 };
        memo.handTurn = String(vtt?.turnKey ?? '');
        memo.handAt = Date.now();
        vttMemory.set(derivedViewStateKey, memo);
    }

    /**
     * Tanda 10: lleva la cámara a una ficha, en el centro de lo que se mira. `smooth`: deslizándose.
     *
     * @param {number|string} tokenId
     * @param {boolean} [smooth]
     * @param {boolean} [auto] Si la mueve el juego (al empezar un turno) y no quien juega: entonces
     *   no cuenta como movida a mano, y el tablero puede volver a encuadrarse solo (otra ventana).
     * @returns {boolean} Si estaba en el tablero.
     */
    function centerOnToken(tokenId, smooth = false, auto = false) {
        const token = tokens.find(t => String(t.id) === String(tokenId));
        if (!token || !imgW || !imgH) return false;
        const cell = { x: Number(token.gridX) || 0, y: Number(token.gridY) || 0 };
        // Un tablero que cabe entero se queda centrado: se ve a todos igual, y en 1920 × 1080 el
        // muelle quedaba pegado arriba por centrar a quien jugaba. Si la mueve el juego, uno más
        // grande no se deja ver por fuera de sus bordes; pedido a mano, la ficha va al centro.
        if (auto) Object.assign(state, centerCellIn(cell, lookRect()));
        else Object.assign(state, centerPointFit(state, cellCenter(cell, imgW / gridWidth, imgH / gridHeight), lookRect(), { width: imgW, height: imgH }));
        if (!auto) userMoved = true;
        glide(smooth);
        fullUpdate();
        return true;
    }

    /** Tanda 17: el aviso que quita el deslizamiento de la cámara al acabar. */
    let glideTimer = 0;
    /**
     * Tanda 10: el siguiente cambio de la cámara se desliza (los botones, el minimapa, una fila de
     * la iniciativa) en vez de saltar; arrastrar y la rueda van al momento.
     *
     * @param {boolean} on
     * @param {number} [ms] Tanda 17: lo que dura, si no es lo de siempre (la cámara que acompaña a
     *   una ficha que anda tarda lo que tarda ella).
     */
    function glide(on, ms = 0) {
        if (!vttOn) return;
        content.toggleClass('vtt-glide', on);
        content[0].style.transitionDuration = on && ms > 0 ? `${ms}ms` : '';
        window.clearTimeout(glideTimer);
        if (on) {
            glideTimer = window.setTimeout(() => {
                content.removeClass('vtt-glide');
                content[0].style.transitionDuration = '';
            }, Math.max(320, ms + 60));
        }
    }

    /**
     * Tanda 10: al empezar cada turno, la cámara busca a quien le toca si no se le ve bien, una vez
     * por turno y sin quitarle la cámara a quien la acaba de mover (`followDecision`).
     */
    function followTurn() {
        if (!vttOn || !vtt?.turnKey || !imgW || !imgH) return;
        if (!document.body.contains(container[0]) || !viewSize().width) return;
        const memo = vttMemory.get(derivedViewStateKey) ?? { followed: '', handTurn: '', handAt: 0 };
        const token = tokens.find(t => String(t.id) === String(vtt.activeTokenId));
        const shown = token
            ? isPointShown(state, cellCenter({ x: Number(token.gridX) || 0, y: Number(token.gridY) || 0 }, imgW / gridWidth, imgH / gridHeight), lookRect(), 40)
            : true;
        const decision = followDecision({
            turnKey: String(vtt.turnKey), followedKey: memo.followed, handKey: memo.handTurn,
            recentHand: !vtt.yours && Date.now() - memo.handAt < RECENT_HAND_MS, shown,
        });
        if (decision.mark) {
            memo.followed = String(vtt.turnKey);
            vttMemory.set(derivedViewStateKey, memo);
        }
        if (decision.follow && token) centerOnToken(token.id, true, true);
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
        // J20.2: el acantilado se dice también tocando, no solo con el ratón encima de su raya.
        if (elevation && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isCliff(elevation, { x: gx, y: gy }, { x: gx + dx, y: gy + dy })
            && gx + dx >= 0 && gy + dy >= 0 && gx + dx < gridWidth && gy + dy < gridHeight)) {
            parts.push('al borde de un acantilado: no se baja andando');
        }
        const there = [
            ...(hazards || []).filter(h => h.x === gx && h.y === gy).map(h => (h.note ? `${h.name}: ${h.note}` : h.name)),
            ...[...new Set((spellZones || []).filter(z => z.x === gx && z.y === gy).map(z => `${z.label}: ${z.tell}`))],
        ];
        return [...parts, ...there].join(' · ');
    };
    if (terrain) {
        cellInfo = $('<div class="wm-cell-info"></div>').hide();
        // Tanda 10: con el HUD, debajo de la placa del sitio: en la esquina de abajo va el minimapa.
        if (hud) hud.topLeft.appendChild(cellInfo[0]);
        else container.append(cellInfo);
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
    // Tanda 10: lo que cuesta la ruta («15 pies · toca otra vez para ir») va en su propia capa,
    // encima de las fichas y de la niebla; en la de las casillas quedaba debajo de quien estuviera allí.
    const pathCostLayer = $('<div class="wm-path-cost-layer"></div>');
    content.append(pathCostLayer);

    // Tanda 10: hasta dónde llega tu ficha, en azul, al pasar el ratón por encima, sin pulsar.
    // Solo se mira: no responde a nada (para ir, se pulsa la ficha y luego la casilla).
    const reachLayer = vttOn ? $('<div class="vtt-reach-layer" aria-hidden="true"></div>') : null;
    if (reachLayer) content.append(reachLayer);

    /**
     * Enciende el alcance de una ficha tuya (lo que dice `vtt.reachOf`), o lo apaga.
     *
     * @param {number|string|null} tokenId
     */
    function showReach(tokenId) {
        if (!reachLayer) return;
        const layer = reachLayer[0];
        layer.textContent = '';
        layer.classList.remove('on');
        if (tokenId === null || typeof vtt?.reachOf !== 'function' || !imgW || !imgH) return;
        const cells = vtt.reachOf(tokenId) ?? [];
        if (cells.length === 0) return;
        const cellW = imgW / gridWidth;
        const cellH = imgH / gridHeight;
        const lit = new Set(cells.map(c => `${c.gridX},${c.gridY}`));
        let html = '';
        for (const cell of cells) {
            // Las esquinas del borde, redondeadas, como en la maqueta: se lee como una zona.
            const edge = ['', 'n', 'e', 's', 'w'].filter((side, i) => i > 0 && !lit.has(`${cell.gridX + [0, 0, 1, 0, -1][i]},${cell.gridY + [0, -1, 0, 1, 0][i]}`)).join('');
            html += `<div class="vtt-reach-cell" data-edge="${edge}" style="${boxStyle(cell.gridX * cellW, cell.gridY * cellH, cellW, cellH)}"></div>`;
        }
        layer.innerHTML = html;
        layer.classList.add('on');
    }

    // Fog goes on top of everything: it hides the board, the terrain and the creatures.
    const fogLayer = $('<div class="wm-fog-layer"></div>');
    content.append(fogLayer);

    // J20.6: en un tablero grande (J12.13) el terreno se dibuja solo en lo que cabe en la pantalla,
    // con unas casillas de margen para poder mover la vista sin redibujar; al salir de ellas, se
    // redibuja. Lo que responde a un toque (puertas, cofres, palancas) y lo que se ha descubierto
    // se dibuja siempre: son pocos. Con el pincel, todo: se pinta en cualquier sitio.
    const culls = bigBoard && !paintMode;
    /** Casillas de más por cada lado de la vista. */
    const CULL_MARGIN = 6;
    /** @type {import('./game-engine/board/draw-light.js').CellWindow|null} Lo dibujado; `null` es todo. */
    let drawnArea = null;
    /**
     * La parte del tablero que se ve ahora, con `margin` casillas de más por cada lado. Si no
     * se ve nada (la vista está fuera del tablero), una parte vacía.
     *
     * @param {number} margin
     * @returns {import('./game-engine/board/draw-light.js').CellWindow}
     */
    function viewArea(margin) {
        return visibleWindow({
            viewWidth: viewSize().width || 300, viewHeight: viewSize().height || 420,
            scale: state.scale, offsetX: state.offsetX, offsetY: state.offsetY,
            cellWidth: imgW / gridWidth, cellHeight: imgH / gridHeight, gridWidth, gridHeight, margin,
        }) ?? { x0: 0, y0: 0, x1: -1, y1: -1 };
    }

    /**
     * Paints the terrain cells that are not plain floor.
     *
     * Only the exceptions are drawn, which matches how terrain is stored and keeps a 50x50
     * board from spawning 2500 nodes for a room with four walls in it.
     */
    function renderTerrain() {
        terrainLayer.empty();
        drawnArea = null;
        if (!imgW || !imgH || !terrain?.cells) return;
        // J20.6: lo que se dibuja. Sin recorte (`null`), todo el tablero.
        const area = culls ? viewArea(CULL_MARGIN) : null;
        drawnArea = area;

        const cellW = imgW / gridWidth;
        const cellH = imgH / gridHeight;
        terrainLayer.css({ width: imgW + 'px', height: imgH + 'px' });

        // Las casillas en pixel (`tablero/`): el suelo de su bioma debajo de todo, y cada
        // casilla con su dibujo. Solo sin imagen: un mapa dibujado ya trae suelo y muros. La
        // que no carga se pinta con los colores de antes.
        const tiled = !hasImage && Boolean(pixelManifest());
        // J12.8: sobre un mapa dibujado, el terreno se marca sin taparlo: el muro ya está en el
        // dibujo, y lo que se ve es el dibujo limpio con las puertas y lo difícil señalados.
        terrainLayer.toggleClass('wm-terrain-over-image', hasImage);
        const kind = boardBiome({ biome, name, type: locationType });
        const redraw = () => { if (container.closest('body').length > 0) renderTerrain(); };
        const tile = (/** @type {string} */ id) => (tiled && id ? usableTile(firstArt('tile', { id }), redraw) : '');
        const floor = tile(`suelo-${kind}`);
        terrainLayer.toggleClass('wm-terrain-tiled-floor', Boolean(floor)).attr('data-biome', floor ? kind : null).css({
            'background-image': floor ? `url("${floor}")` : '',
            'background-size': floor ? `${cellW}px ${cellH}px` : '',
        });

        // J20.6: lo que no responde a nada (muros, suelos, agua…) va en un trozo de HTML que se pone
        // de una vez; antes era un nodo de jQuery por casilla, en cada paso de la pelea.
        let plain = '';
        for (const [key, cell] of Object.entries(terrain.cells)) {
            const parsed = parseCellKey(key);
            if (!parsed || !cell) continue;

            const type = cell.type === 'door' && cell.open ? 'door-open' : cell.type;
            // A door is the one piece of terrain that answers to the player. The layer
            // ignores pointer events so it never eats a drag; the door opts back in.
            // While painting, a click means "paint here", so the door stays inert.
            // R6: un cofre también responde: se abre estando al lado.
            // T1 y B3: la palanca y la barricada, igual.
            const actionable = ['door', 'chest', 'lever', 'barricade'].includes(cell.type) && typeof onDoorToggle === 'function' && !paintMode;
            if (!actionable && !inWindow(area, parsed.x, parsed.y)) continue;
            // Lo alto lleva el borde en su última fila: la de debajo ya no es alta.
            const edge = cell.type === 'high' && terrain.cells[`${parsed.x},${parsed.y + 1}`]?.type !== 'high';
            const drawn = tile(terrainTile(cell, { biome: kind, edge }));
            if (!actionable) {
                plain += `<div class="wm-terrain-cell wm-terrain-${classSafe(type)}${drawn ? ' wm-terrain-tiled' : ''}" style="`
                    + `${boxStyle(parsed.x * cellW, parsed.y * cellH, cellW, cellH)}${drawn ? `;background-image:url('${cssUrl(drawn)}')` : ''}"></div>`;
                continue;
            }
            const el = $('<div class="wm-terrain-cell"></div>')
                .addClass(`wm-terrain-${type}`)
                .css({
                    left: parsed.x * cellW + 'px',
                    top: parsed.y * cellH + 'px',
                    width: cellW + 'px',
                    height: cellH + 'px',
                });
            if (drawn) el.addClass('wm-terrain-tiled').css('background-image', `url("${drawn}")`);

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

            terrainLayer.append(el);
        }
        // Tanda 12: los puentes, el suelo que cruza el agua, el abismo o un barranco (`bridgeTiles`
        // en `pixel-art.js`): sus tablas y su baranda, por capas. Sobre un mapa dibujado ya están.
        const bridges = tiled ? bridgeTiles(terrain, gridWidth, gridHeight, elevation) : [];
        for (const bridge of bridges) {
            const boards = tile(bridge.layers[bridge.layers.length - 1]);
            if (!boards || !inWindow(area, bridge.x, bridge.y)) continue;
            const layers = [...bridge.layers.slice(0, -1).map(id => tile(id)).filter(Boolean), boards];
            plain += '<div class="wm-terrain-cell wm-terrain-bridge wm-terrain-tiled" style="'
                + `${boxStyle(bridge.x * cellW, bridge.y * cellH, cellW, cellH)};background-image:${layers.map(url => `url('${cssUrl(url)}')`).join(',')}"></div>`;
        }
        // Debajo de lo demás (puertas, trampas, zonas), como cuando se ponían una a una.
        terrainLayer[0].insertAdjacentHTML('afterbegin', plain);

        // Lo que ya se ha visto: una trampa descubierta, un charco de aceite ardiendo. Sin
        // esto, «el suelo arde» solo lo contaba el chat, y cerrar un pasillo con fuego era
        // una promesa que no se veía.
        for (const hazard of hazards || []) {
            if (!(hazard.x >= 0 && hazard.y >= 0)) continue;
            // Su dibujo (`tablero/trampa.png`, `tablero/fuego.png`) dentro del recuadro, también
            // sobre un mapa dibujado; si no carga, el recuadro solo.
            const drawn = usableTile(firstArt('tile', { id: hazardTile(hazard) }), redraw);
            terrainLayer.append($('<div class="wm-hazard"></div>')
                .toggleClass('wm-hazard-fire', /fuego|fire/i.test(String(hazard.kind ?? '')))
                .toggleClass('wm-hazard-drawn', Boolean(drawn))
                .css('background-image', drawn ? `url("${drawn}")` : '')
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
        // J20.6: también de una vez, y en un tablero grande solo lo que se ve.
        if (elevation) {
            let marks = '';
            for (const [key, feet] of Object.entries(elevation)) {
                const at = parseCellKey(key);
                if (!at || !(Number(feet) > 0) || at.x >= gridWidth || at.y >= gridHeight || !inWindow(area, at.x, at.y)) continue;
                marks += `<div class="wm-elevated" style="${boxStyle(at.x * cellW, at.y * cellH, cellW, cellH)};opacity:${Math.min(0.9, 0.3 + Number(feet) / 100)}"></div>`;
            }
            // Tanda 12: el borde de un puente alto se queda con la raya; la roca es para los riscos.
            const onBridge = new Set(bridges.map(bridge => `${bridge.x},${bridge.y}`));
            for (const edge of cliffEdges(elevation, gridWidth, gridHeight)) {
                if (!inWindow(area, edge.x, edge.y)) continue;
                const right = edge.side === 'right';
                // El lado alto lleva la luz: se ve hacia dónde se cae.
                const highFirst = edge.drop > 0;
                // Tanda 12: en un tablero sin imagen, la cara de roca en la casilla de abajo
                // (`cliffFace`); sin su dibujo, o sobre un mapa dibujado, la raya de siempre. Si
                // abajo hay un muro, la roca no se pinta encima: también la raya.
                const high = highFirst ? `${edge.x},${edge.y}` : right ? `${edge.x + 1},${edge.y}` : `${edge.x},${edge.y + 1}`;
                const face = cliffFace(edge);
                const below = terrain.cells[`${Math.floor(face.x)},${Math.floor(face.y)}`]?.type;
                const rock = onBridge.has(high) || below === 'wall' ? '' : tile(face.id);
                const box = rock
                    ? boxStyle(face.x * cellW, face.y * cellH, face.width * cellW, face.height * cellH)
                    : right
                        ? boxStyle((edge.x + 1) * cellW - 2, edge.y * cellH, 4, cellH)
                        : boxStyle(edge.x * cellW, (edge.y + 1) * cellH - 2, cellW, 4);
                marks += `<div class="wm-cliff ${right ? 'wm-cliff-v' : 'wm-cliff-h'} ${highFirst ? 'wm-cliff-high-first' : 'wm-cliff-high-second'}${rock ? ' wm-cliff-drawn' : ''}"`
                    + ` title="Acantilado: ${Math.abs(Number(edge.drop) || 0)} pies. No se cruza andando." style="${box}${rock ? `;background-image:url('${cssUrl(rock)}')` : ''}"></div>`;
            }
            terrainLayer[0].insertAdjacentHTML('beforeend', marks);
        }
    }

    /**
     * Draws the fog. Unknown cells are opaque, explored-but-unseen ones are dimmed, and
     * anything currently in sight is left clear.
     */
    function renderFog() {
        const layer = fogLayer[0];
        if (!imgW || !imgH || !fogEnabled) {
            layer.textContent = '';
            return;
        }

        const cellW = imgW / gridWidth;
        const cellH = imgH / gridHeight;
        fogLayer.css({ width: imgW + 'px', height: imgH + 'px' });

        // J20.6: las casillas iguales, juntas en rectángulos (una sala sin ver es una caja, no
        // cuatrocientas), y puestas de una vez. Antes era una caja por casilla, con jQuery, en
        // cada paso de la pelea: en un tablero de 40 × 28 a oscuras, más de mil.
        layer.innerHTML = cellRectsHtml(fogRects(fog, visibleCells, gridWidth, gridHeight), {
            cellWidth: cellW, cellHeight: cellH, className: 'wm-fog-cell', kindPrefix: 'wm-fog-',
        });
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
        pathCostLayer.empty();
        if (!imgW || !imgH || !Array.isArray(highlightedCells) || highlightedCells.length === 0) return;

        const cellW = imgW / gridWidth;
        const cellH = imgH / gridHeight;
        highlightsLayer.css({ width: imgW + 'px', height: imgH + 'px' });

        for (const cell of highlightedCells) {
            if (!cell) continue;
            // Tanda 10: `place`, una casilla de salida antes de la pelea: un toque coloca, sin ruta.
            const kind = cell.kind === 'attack' ? 'attack' : cell.kind === 'place' ? 'place' : 'move';

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
                // J20.2: a toques no hay «pasar por encima». El navegador manda sus eventos de
                // ratón de mentira tras cada toque, y uno de salida (al moverse algo en la página)
                // borraba la ruta que el toque acababa de enseñar: con el dedo, la ruta la ponen y
                // la quitan los toques.
                if (typeof onCellHover === 'function' && kind === 'move') {
                    // Tanda 17: el cursor del teclado (board-keys.js) enseña la ruta de su casilla
                    // con un «pasar por encima» de mentira; jugando con el ratón, no: pulsar el
                    // tablero le daba el foco, y salía la ruta a una casilla de antes.
                    node.on('mouseenter', (event) => {
                        if (touchy() || (!event.originalEvent && boardInput !== 'key')) return;
                        drawTrajectory(cell.gridX, cell.gridY, cellW, cellH);
                    });
                    node.on('mouseleave', () => { if (!touchy()) clearTrajectory(); });
                }
            }

            highlightsLayer.append(node);
        }
    }

    /** Borra la ruta dibujada, si hay alguna. */
    function clearTrajectory() {
        highlightsLayer.find('.wm-path-step, .wm-path-cost').remove();
        pathCostLayer.empty();
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
        pathCostLayer.css({ width: imgW + 'px', height: imgH + 'px' }).append(cost);
    }

    function placeTokens() {
        tokensLayer.empty();
        if (!imgW || !imgH) return;
        const cellW = imgW / gridWidth;
        const cellH = imgH / gridHeight;

        tokensLayer.css({ width: imgW + 'px', height: imgH + 'px' });
        // J12.18: el tamaño de la cuadrícula, para pintar encima las casillas de un área (aim-glow.js).
        tokensLayer.attr({ 'data-grid-w': gridWidth, 'data-grid-h': gridHeight });

        // Tanda 17: la ficha que ha cambiado de casilla desde el dibujo anterior anda hasta ella por
        // el camino (el mismo A* del juego, sin pasar por encima de nadie), en vez de aparecer allí.
        // Colocándose antes de la pelea, se pone, no se anda; con «reducir movimiento», tampoco.
        const memo = tokenMemory.get(derivedViewStateKey) ?? { cells: new Map(), slides: new Map() };
        tokenMemory.set(derivedViewStateKey, memo);
        const now = performance.now();
        const pace = motionMs(1000) / 1000;
        const placing = Array.isArray(highlightedCells) && highlightedCells.some(cell => cell?.kind === 'place');
        const taken = tokens.map(t => `${Number(t.gridX) || 0},${Number(t.gridY) || 0}`);
        const route = (/** @type {{x: number, y: number}} */ from, /** @type {{x: number, y: number}} */ to) => (terrain
            ? findPath(terrain, from.x, from.y, to.x, to.y, gridWidth, gridHeight, {
                occupied: new Set(taken.filter(key => key !== `${from.x},${from.y}` && key !== `${to.x},${to.y}`)),
            })
            : null);
        /** @type {Map<string, {x: number, y: number}>} */
        const seenNow = new Map();
        freshSlides = [];
        // Tanda 17: el nombre corto debajo de la ficha («Ratero», «Keller»; `token-label.js`).
        const names = tokens.map(t => String(t.name ?? ''));
        // Tanda 17: quien tiene el turno lleva un aro que late.
        const activeId = vtt?.combat && vtt.activeTokenId !== null && vtt.activeTokenId !== undefined ? String(vtt.activeTokenId) : '';

        for (const token of tokens) {
            const px = (token.gridX + 0.5) * cellW;
            const py = (token.gridY + 0.5) * cellH;
            const tokenId = String(token.id);
            const cellNow = { x: Number(token.gridX) || 0, y: Number(token.gridY) || 0 };
            seenNow.set(tokenId, cellNow);
            const slide = placing ? null : planSlide({
                before: memo.cells.get(tokenId) ?? null, moving: memo.slides.get(tokenId) ?? null, to: cellNow, now, route, scale: pace,
            });
            const hpPct = (token.maxHp && token.maxHp > 0) ? Math.min(100, ((token.hp || 0) / token.maxHp) * 100) : 100;

            const enemyClass = token.isEnemy ? ` wm-token-enemy${token.idle ? ' wm-token-idle' : ''}${token.boss ? ' wm-token-boss' : ''}` : (token.isSummon ? ' wm-token-summon' : token.isNPC ? ' wm-token-npc' : '');
            const metaText = token.isEnemy
                ? `${token.boss && !token.role ? 'Jefe · ' : ''}${token.idle ? 'Aquí, sin pelear todavía' : `${token.role ? `${token.role.label} · ` : ''}CA ${token.level || 10}`}`
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
            // J20.2: lo que le pasa, escrito: los iconos de estado solo lo dicen con el ratón encima.
            const said = (Array.isArray(token.statuses) ? token.statuses : []).map(s => String(s?.label || '')).filter(Boolean);
            if (said.length > 0) el.find('.wm-token-tooltip-meta').after($('<div class="wm-token-tooltip-statuses"></div>').text(said.join(' · ')));

            // Tanda 17: el nombre entero se queda en la página (lo leen el teclado y las pruebas) y en
            // su tarjeta; en la mesa virtual se ve el corto (`data-label`, combat-vtt.css sección 1).
            const tokenNameEl = el.find('.wm-token-name').text(token.name ?? '').attr('data-label', tokenLabel(String(token.name ?? ''), names));
            // Sin cara propia, su dibujo en pixel; si no carga, lo de siempre. J1.8: uno del grupo
            // sin cara ni retrato (o con una imagen que ya no está) lleva sus iniciales en su
            // color, como en su ficha y en la tira del grupo; no «???» ni la silueta gris.
            const ours = !token.isEnemy && !token.isNPC && !token.isSummon;
            // D-J52: uno del grupo que eligió su cara sin arte (iniciales, icono o emoji) sale con
            // ella, en vez del retrato de relleno de su clase. Una cara subida manda igual.
            const chosenFace = ours && token.face ? token.face : null;
            const drawn = chosenFace ? '' : tokenArt(token);
            const ownFace = token.avatar && !(ours && isPlainFace(token.avatar)) ? token.avatar : '';
            const initials = () => $(initialsFor(String(token.name ?? ''), 'wm-token-unknown wm-token-initials', chosenFace));
            if (drawn || ownFace) {
                const image = $('<img>')
                    .addClass('wm-token-avatar')
                    .attr('src', drawn || ownFace)
                    .attr('alt', token.name ?? '')
                    .insertBefore(tokenNameEl);
                if (drawn) {
                    image.addClass(`pixel-art ${(token.isEnemy || token.isSummon) && !drawn.includes('/retratos/') ? 'wm-token-creature' : 'wm-token-bust'}`)
                        .attr('data-pixel', 'true')
                        .one('error', () => {
                            image.removeClass('pixel-art wm-token-creature wm-token-bust').removeAttr('data-pixel');
                            if (ownFace) image.attr('src', ownFace);
                            else image.replaceWith(ours ? initials() : $('<div>').addClass('wm-token-unknown').css('background', token.isEnemy ? '#7f1d1d' : '').text(token.isEnemy ? '☠' : '???'));
                        });
                } else if (ours) {
                    image.one('error', () => image.replaceWith(initials()));
                }
            } else if (ours) {
                initials().insertBefore(tokenNameEl);
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
            // Un jefe lleva su corona encima, también antes de pelear (en la pelea ya la lleva su papel).
            if (token.isEnemy && token.boss && !token.role) {
                el.append($('<i class="wm-token-boss-mark fa-solid fa-crown"></i>').attr('title', 'Jefe'));
            }
            // J19.5: la invocación lleva su marca, para no confundirla con un enemigo.
            if (token.isSummon) {
                el.append($('<i class="wm-token-role wm-token-summon-mark fa-solid fa-paw"></i>')
                    .attr('title', metaText));
            }

            // J12.19: quien ha caído se queda tumbado y apagado, con su marca (una calavera, o el
            // corazón roto de uno de los tuyos): al redibujarse el tablero no vuelve a parecer en pie.
            if (isDownToken(token, vtt ? Boolean(vtt.combat) : true)) {
                const team = token.isEnemy ? 'enemy' : 'party';
                el.addClass('wm-token-down').attr('data-down', team);
                el.append(downMarkNode(document, team));
                el.find('.wm-token-tooltip-meta').text(token.isEnemy ? 'Derrotado' : 'En el suelo, inconsciente');
                // Tanda 22: uno de los tuyos, con sus salvaciones de muerte en puntos debajo.
                if (!token.isEnemy && !token.isSummon) el.append($(deathSavesNode(document, token.deathSaves, { word: '' })).addClass('wm-token-death'));
            }

            // Tanda 10: tu ficha enseña hasta dónde llega al pasar el ratón por encima, sin pulsar.
            // Con el dedo no hay «pasar por encima»: el primer toque la elige y lo enciende.
            if (reachLayer && typeof vtt?.reachOf === 'function' && !token.isEnemy && !token.isNPC) {
                el.on('mouseenter', () => {
                    if (!touchy() && !mouseDrag && !el.hasClass('wm-token-selected')) showReach(token.id);
                });
                el.on('mouseleave', () => showReach(null));
            }

            // Tanda 17: el aro de quien tiene el turno, en oro si es tuyo y en rojo si es de un enemigo.
            if (activeId && tokenId === activeId) {
                el.addClass('wm-token-active')
                    .attr('data-turn-side', vtt?.turnSide ?? (token.isEnemy ? 'enemy' : 'yours'))
                    .prepend('<span class="wm-token-turn-ring" aria-hidden="true"></span>');
            }

            // Drag token
            setupTokenDrag(el, token, cellW, cellH);
            tokensLayer.append(el);

            // Tanda 17: anda casilla a casilla; si ya iba andando (otro dibujo a medio camino),
            // sigue por donde iba.
            if (slide && slide.duration > 0 && typeof el[0].animate === 'function') {
                const walk = el[0].animate(slideFrames(slide.cells, cellW, cellH), { duration: slide.duration, easing: 'linear' });
                walk.currentTime = Math.max(0, now - slide.start);
                memo.slides.set(tokenId, slide);
                if (slide.start === now) freshSlides.push({ id: tokenId, slide });
                el.addClass('wm-token-walking');
                walk.addEventListener('finish', () => el.removeClass('wm-token-walking'));
            } else {
                memo.slides.delete(tokenId);
            }
        }
        memo.cells = seenNow;
        for (const id of [...memo.slides.keys()]) {
            if (!seenNow.has(id)) memo.slides.delete(id);
        }
    }

    /**
     * Tanda 17: la ficha que sigue la cámara (quien tiene el turno, o la que sigue la cámara fuera de
     * combate), si ha echado a andar en este dibujo.
     *
     * @returns {{id: string, slide: import('./game-engine/ui/combat-vtt/token-slide.js').Slide}|null}
     */
    function walkerNow() {
        const wanted = [vtt?.activeTokenId, followTokenId].filter(id => id !== null && id !== undefined).map(String);
        return freshSlides.find(s => wanted.includes(s.id)) ?? null;
    }

    /**
     * Tanda 17: la cámara no salta mientras alguien anda. Si este dibujo la deja en otro sitio que el
     * anterior del mismo tablero (un tablero grande se encuadra solo en quien tiene el turno, y le
     * sigue), llega deslizándose desde donde estaba, al paso de quien anda. Sin nadie andando, como
     * siempre: al momento.
     */
    function carryCamera() {
        const walker = walkerNow();
        if (!walker || !viewBefore || !imgW || !imgH || viewSize().width < 40) return;
        const from = {
            scale: Number(viewBefore.scale) || state.scale,
            offsetX: Number(viewBefore.offsetX) || 0,
            offsetY: Number(viewBefore.offsetY) || 0,
        };
        const moved = Math.abs(from.offsetX - state.offsetX) > 2 || Math.abs(from.offsetY - state.offsetY) > 2
            || Math.abs(from.scale - state.scale) > 0.005;
        if (!moved) return;
        const ms = walker.slide.duration;
        if (ms <= 0) return;
        const goal = content[0].style.transform;
        content.removeClass('vtt-glide');
        content[0].style.transitionDuration = '';
        content[0].style.transform = `translate(${from.offsetX}px, ${from.offsetY}px) scale(${from.scale})`;
        // El navegador apunta dónde estaba antes de mandarle a dónde va: si no, no hay camino.
        void content[0].offsetWidth;
        glide(true, ms);
        content[0].style.transform = goal;
    }

    /**
     * Tanda 17: la cámara acompaña a la ficha que echa a andar (la de quien tiene el turno, o la que
     * sigue la cámara): si su casilla de llegada no se ve con holgura, la vista se desliza lo justo
     * para verla, al paso de la ficha. No a quien acaba de mover la cámara a mano en el turno de un
     * enemigo: estará mirando otra cosa.
     */
    function followWalkers() {
        if (!vttOn || !imgW || !imgH || !viewSize().width) return;
        const walker = walkerNow();
        if (!walker) return;
        const memo = vttMemory.get(derivedViewStateKey);
        if (!vtt?.yours && memo && Date.now() - memo.handAt < RECENT_HAND_MS) return;
        const end = walker.slide.cells[walker.slide.cells.length - 1];
        const rect = lookRect();
        const margin = Math.min(rect.right - rect.left, rect.bottom - rect.top) * 0.18;
        const point = cellCenter(end, imgW / gridWidth, imgH / gridHeight);
        if (isPointShown(state, point, rect, margin)) return;
        Object.assign(state, panToShow(state, point, rect, margin));
        glide(true, walker.slide.duration);
        fullUpdate();
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
            showReach(null);
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
                    pathCostLayer.empty();
                    if (newCells && newCells.length > 0) {
                        highlightsLayer.css({ width: imgW + 'px', height: imgH + 'px' });
                        for (const cell of newCells) {
                            if (!cell) continue;
                            const kind = cell.kind === 'attack' ? 'attack' : cell.kind === 'place' ? 'place' : 'move';
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
                // Tanda 17: arrastrada, ya está donde va: al redibujar no anda otra vez hasta allí
                // (si el juego no la deja, sí: vuelve andando a su casilla).
                tokenMemory.get(derivedViewStateKey)?.cells.set(String(token.id), { x: newGX, y: newGY });
                tokenMemory.get(derivedViewStateKey)?.slides.delete(String(token.id));

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
        const cw = viewSize().width || 300;
        const ch = viewSize().height || 420;

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

    /** J20.6: el fotograma que ya tiene pedido lo que no corre prisa (ejes, recuerdo, recorte). */
    let viewFrame = 0;
    function fullUpdate() {
        // Tanda 10: en la mesa virtual el tablero no se pierde: algo suyo queda siempre a la vista.
        if (vttOn && imgW && imgH && viewSize().width > 0) {
            Object.assign(state, clampPan(state, { width: imgW, height: imgH }, viewSize()));
        }
        content.css('transform', `translate(${state.offsetX}px, ${state.offsetY}px) scale(${state.scale})`);
        // Tanda 17: lo acercada que está la cámara, para que el nombre de las fichas se lea también
        // con el tablero alejado (en el teléfono, a 0,6×, salía de 6 píxeles; combat-vtt.css).
        if (vttOn) content[0].style.setProperty('--vtt-scale', String(Math.round(state.scale * 100) / 100));
        persistViewState();
        // J20.6: arrastrar con el dedo manda decenas de movimientos por fotograma. Mover el tablero
        // es barato y va al momento; los números de los bordes y dibujar lo que entra en la vista
        // se hacen una vez por fotograma, justo antes de pintarlo.
        if (viewFrame) return;
        viewFrame = requestAnimationFrame(() => {
            viewFrame = 0;
            // Tanda 10: en la mesa virtual no hay números en los bordes (quedarían bajo el HUD).
            if (!vttOn) renderGridAxes();
            // Lo que entra en la vista y no estaba dibujado (se ha salido del margen): se redibuja.
            const wanted = culls ? viewArea(0) : null;
            if (wanted && wanted.x0 <= wanted.x1 && !windowCovers(drawnArea, wanted)) renderTerrain();
            updateHud();
        });
    }

    container.off('wheel').on('wheel', function (e) {
        e.preventDefault();
        const oe = /** @type {WheelEvent} */ (e.originalEvent);
        const rect = container[0].getBoundingClientRect();
        const mx = oe.clientX - rect.left;
        const my = oe.clientY - rect.top;
        // Tanda 10: hacia el cursor, de 0,45× a 2,2× (camera.js).
        if (vttOn) {
            Object.assign(state, zoomAt(state, wheelScale(state.scale, oe.deltaY), { x: mx, y: my }, limitsOf()));
            noteHand();
            fullUpdate();
            return;
        }
        const delta = oe.deltaY < 0 ? 0.15 : -0.15;
        const newScale = Math.min(6, Math.max(0.5, state.scale + delta * state.scale));
        const ratio = newScale / state.scale;
        state.offsetX = mx - ratio * (mx - state.offsetX);
        state.offsetY = my - ratio * (my - state.offsetY);
        state.scale = newScale;
        userMoved = true;
        fullUpdate();
    });

    /** Tanda 10: cuánto se ha arrastrado con el ratón desde que se pulsó (para saber si fue un clic). */
    let mouseTravel = 0;
    /**
     * Tanda 10: el arrastre con el ratón, aquí y no en `state.isDragging`: con ese, el arrastre de
     * `createZoomableContainer` (sus oyentes siguen en el documento) movía el tablero antes que
     * este, y este creía que el ratón no se había movido: soltar contaba como un clic en la casilla.
     *
     * @type {{x: number, y: number}|null}
     */
    let mouseDrag = null;
    /**
     * Empieza a arrastrar el tablero con el ratón. En la mesa virtual, desde cualquier sitio de la
     * vista (también fuera del dibujo) y con el botón izquierdo o el de en medio.
     *
     * @param {JQuery.MouseDownEvent} e
     */
    const startMousePan = (e) => {
        if (/** @type {HTMLElement} */ (e.target).closest('.wm-token, .wm-terrain-door-actionable, .wm-zoom-controls')) return;
        if (vttOn && e.button !== 0 && e.button !== 1) return;
        e.preventDefault();
        mouseDrag = { x: e.pageX, y: e.pageY };
        mouseTravel = 0;
        content.addClass('grabbing');
        container.addClass('grabbing');
    };
    content.off('mousedown');
    if (vttOn) container.on('mousedown', startMousePan);
    else content.on('mousedown', startMousePan);

    $(document).on(`mousemove.${nsId}`, function (e) {
        if (!mouseDrag) return;
        const dx = e.pageX - mouseDrag.x;
        const dy = e.pageY - mouseDrag.y;
        mouseTravel += Math.abs(dx) + Math.abs(dy);
        state.offsetX += dx;
        state.offsetY += dy;
        mouseDrag = { x: e.pageX, y: e.pageY };
        noteHand();
        fullUpdate();
    });
    $(document).on(`mouseup.${nsId}`, function () {
        if (!mouseDrag) return;
        mouseDrag = null;
        content.removeClass('grabbing');
        container.removeClass('grabbing');
        // Tanda 10: soltar tras arrastrar no es un clic. El tablero se mueve con el ratón, así que
        // al soltar se está otra vez sobre la misma casilla: sin esto, arrastrar el mapa desde una
        // casilla encendida movía a tu ficha hasta ella (un clic fantasma).
        if (mouseTravel > 4) panEndedAt = Date.now();
    });
    // El clic que cierra un arrastre no llega a nada del tablero (casillas, fichas, puertas).
    container[0].addEventListener('click', (event) => {
        if (!vttOn || !justPanned()) return;
        event.stopPropagation();
        event.preventDefault();
    }, true);

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
        // Un ratón de verdad que se mueve (en un portátil con pantalla táctil, tras un toque)
        // vuelve a enseñar la ruta al pasar por encima. Los eventos de ratón que el navegador
        // inventa tras un toque no son de puntero: no llegan aquí.
        if (event.pointerType === 'mouse') {
            lastPointer = 'mouse';
            return;
        }
        if (!fingers.has(event.pointerId)) return;
        fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pinch && fingers.size >= 2) {
            const [a, b] = [...fingers.values()];
            const mid = local({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
            state.scale = clampScale(pinch.scale * Math.hypot(a.x - b.x, a.y - b.y) / pinch.distance, limitsOf());
            state.offsetX = mid.x - pinch.cx * state.scale;
            state.offsetY = mid.y - pinch.cy * state.scale;
            noteHand();
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
        noteHand();
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
        /** Tanda 10: lo que medía la vista la última vez, para no perder lo que se miraba al girar. @type {{width: number, height: number}|null} */
        let lastSize = null;
        const watcher = new ResizeObserver(() => {
            if (!document.body.contains(container[0])) {
                watcher.disconnect();
                return;
            }
            // Ha cambiado de tamaño: lo apuntado ya no vale.
            sizeMemo = null;
            if (!imgW || !imgH || viewSize().width < 40 || viewSize().height < 40) return;
            const before = lastSize;
            lastSize = { ...viewSize() };
            // J20.6: la vista movida a mano se queda como está, pero al crecer el sitio (el teléfono,
            // tumbado) entra más tablero: sus números y, en uno grande, su terreno.
            if (!userMoved || fitPending) fitView();
            // Tanda 10: en la mesa virtual, lo que estaba en el centro sigue en el centro (girar el
            // teléfono, otra ventana): si no, se acababa mirando un trozo de muro.
            else if (vttOn && before) {
                state.offsetX += (lastSize.width - before.width) / 2;
                state.offsetY += (lastSize.height - before.height) / 2;
            }
            // Tanda 10: el minimapa se pinta otra vez a su medida (en el teléfono, tumbado, cambia).
            drawMinimap();
            fullUpdate();
            // Tanda 10: el tablero acaba de tener sitio (la escena del tablero, tras la novela): si
            // empezaba un turno, la cámara busca ahora a quien le toca.
            if (vttOn) followTurn();
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
            state.scale = clampScale(Number(saved.scale) || 1, limitsOf());
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
        // Tanda 10: en la mesa virtual, al empezar cada turno se busca a quien le toca (K3, con el HUD).
        if (vttOn) followTurn();
        else focusActiveToken();
        followParty();
        drawMinimap();
    }

    /**
     * K3: al empezar el turno de alguien, su ficha a la vista. Si en su centro hay otra cosa
     * que el tablero (la cabecera, o nada porque está fuera), se centra; si se ve, no se toca.
     * Una vez por turno: quien mueve el tablero a mano no se lo encuentra movido.
     */
    function focusActiveToken() {
        if (focusTokenId === null || focusTokenId === undefined || !focusKey) return;
        // Hasta que el tablero no está en la página no se sabe qué se ve.
        if (!document.body.contains(container[0]) || !viewSize().width) return;
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
        const cw = viewSize().width || 300;
        const ch = viewSize().height || 420;
        state.offsetX = cw / 2 - (Number(token.gridX) + 0.5) * (imgW / gridWidth) * state.scale;
        state.offsetY = ch / 2 - (Number(token.gridY) + 0.5) * (imgH / gridHeight) * state.scale;
        fullUpdate();
    }

    // ---- Tanda 10: la cámara y el minimapa, abajo a la izquierda ----
    /** El centro de lo que se mira, para acercar y alejar con los botones. */
    const lookCenter = () => {
        const rect = lookRect();
        return { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 };
    };
    /**
     * Acerca (`factor` > 1) o aleja la cámara, hacia el centro de lo que se mira.
     *
     * @param {number} factor
     */
    function zoomBy(factor) {
        Object.assign(state, zoomAt(state, state.scale * factor, lookCenter(), limitsOf()));
        noteHand();
        glide(true);
        fullUpdate();
    }
    /** A quién va «Centrar» (y Espacio): quien tiene el turno, o a quien sigue la cámara, o el grupo. */
    const centerTarget = () => [vtt?.activeTokenId, followTokenId, focusTokenId]
        .find(id => id !== null && id !== undefined && tokens.some(t => String(t.id) === String(id)))
        ?? tokens.find(t => !t.isEnemy && !t.isNPC)?.id ?? null;
    /** «Centrar»: en quien toca; si no hay nadie, el tablero entero. */
    function centerActive() {
        const id = centerTarget();
        if (id !== null && centerOnToken(id, true)) return;
        userMoved = false;
        fitView();
        glide(true);
        fullUpdate();
    }
    if (hud) {
        const camera = document.createElement('div');
        camera.className = 'vtt-camera vtt-island';
        camera.setAttribute('role', 'group');
        camera.setAttribute('aria-label', 'Cámara');
        const camButton = (/** @type {string} */ id, /** @type {string} */ icon, /** @type {string} */ title, /** @type {() => void} */ act) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'vtt-cam-btn';
            button.dataset.cam = id;
            button.title = title;
            button.setAttribute('aria-label', title);
            const glyph = document.createElement('i');
            glyph.className = `fa-solid ${icon}`;
            glyph.setAttribute('aria-hidden', 'true');
            button.appendChild(glyph);
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                act();
            });
            camera.appendChild(button);
            return button;
        };
        camButton('in', 'fa-plus', 'Acercar', () => zoomBy(BUTTON_STEP));
        camButton('out', 'fa-minus', 'Alejar', () => zoomBy(1 / BUTTON_STEP));
        camButton('center', 'fa-crosshairs', vtt?.combat ? 'Centrar en quien tiene el turno (Espacio)' : 'Centrar en el grupo (Espacio)', () => centerActive());
        const gridButton = camButton('grid', 'fa-border-all', 'Ver u ocultar las casillas', () => {
            gridVisible = !gridVisible;
            gridButton.classList.toggle('active', gridVisible);
            gridOverlay.toggleClass('hidden', !gridVisible);
            persistViewState();
        });
        minimap = createMinimap({
            onPick: (point) => {
                Object.assign(state, centerPoint(state, point, lookRect()));
                noteHand();
                glide(true);
                fullUpdate();
            },
        });
        hud.bottomLeft.append(camera, minimap.root);
        // La rejilla, como estaba (se apunta con la vista); el botón lo dice.
        requestAnimationFrame(() => gridButton.classList.toggle('active', gridVisible));
    }

    /** Tanda 10: pinta el minimapa: el terreno que se conoce y las fichas que se ven. */
    function drawMinimap() {
        if (!minimap || !imgW || !imgH) return;
        const seen = (/** @type {TokenData} */ t) => !fogEnabled || !(visibleCells instanceof Set) || visibleCells.has(`${Number(t.gridX) || 0},${Number(t.gridY) || 0}`);
        minimap.draw({
            gridW: gridWidth, gridH: gridHeight, boardW: imgW, boardH: imgH,
            cells: minimapCells({ terrain, fog, visible: visibleCells, fogEnabled, gridW: gridWidth, gridH: gridHeight }),
            blips: tokens
                .filter(t => !t.isEnemy || seen(t))
                .map(t => ({
                    x: Number(t.gridX) || 0, y: Number(t.gridY) || 0,
                    side: /** @type {'ally'|'enemy'|'npc'} */ (t.isEnemy ? 'enemy' : t.isNPC ? 'npc' : 'ally'),
                    active: vtt?.activeTokenId !== null && vtt?.activeTokenId !== undefined && String(t.id) === String(vtt.activeTokenId),
                })),
        });
        updateHud();
    }

    /**
     * Tanda 10: lo del HUD que depende de la cámara: el recuadro del minimapa, el acercamiento
     * dicho y los marcadores de borde de los enemigos que no se ven. Una vez por fotograma.
     */
    function updateHud() {
        if (!hud || !imgW || !imgH) return;
        const { width, height } = viewSize();
        if (!width || !height) return;
        minimap?.setView(state, width, height);
        minimap?.setZoom(zoomLabel(state.scale, cellPx()));
        if (!vtt?.combat) {
            hud.edges.textContent = '';
            return;
        }
        const cellW = imgW / gridWidth;
        const cellH = imgH / gridHeight;
        const targets = [];
        for (const wanted of vtt.edgeTargets ?? []) {
            const token = tokens.find(t => String(t.id) === String(wanted.id));
            if (!token) continue;
            const at = toScreen(state, cellCenter({ x: Number(token.gridX) || 0, y: Number(token.gridY) || 0 }, cellW, cellH));
            targets.push({ id: wanted.id, name: wanted.name, feet: wanted.feet, x: at.x, y: at.y });
        }
        renderEdgeMarkers(hud.edges, placeEdgeMarkers({ targets, rect: lookRect() }), (id) => centerOnToken(id, true),
            { left: 0, top: 0, right: width, bottom: height }, targets.length > 0 ? islandBoxes() : []);
    }

    /**
     * Tanda 10: dónde están las islas del HUD (y la barra de acciones, si flota encima), contadas
     * desde la esquina del tablero: los marcadores de borde no se ponen encima de ellas.
     *
     * @returns {Array<{left: number, top: number, right: number, bottom: number}>}
     */
    function islandBoxes() {
        if (!hud) return [];
        const origin = hud.root.getBoundingClientRect();
        const nodes = [...hud.root.querySelectorAll('.vtt-island:not(.vtt-edge)'), ...document.querySelectorAll('.gs-root .gs-actions')];
        return nodes.map(node => node.getBoundingClientRect())
            .filter(r => r.width > 0 && r.height > 0)
            .map(r => ({ left: r.left - origin.left, top: r.top - origin.top, right: r.right - origin.left, bottom: r.bottom - origin.top }));
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
    // Tanda 10: en la mesa virtual, los botones de la cámara van abajo a la izquierda, sobre el minimapa.
    if (!hud) container.append(zoomControls);

    // Lo que dice la ficha elegida (lo que le queda por andar, su alcance, o que se pulse una
    // casilla encendida para ir), justo encima del tablero. Con el HUD, en su esquina de arriba.
    if (tacticalHud && hud) hud.topLeft.insertBefore(tacticalHud[0], cellInfo?.[0] ?? null);
    else if (tacticalHud) target.append(tacticalHud);
    target.append(container);
    if (hud) target.append(hud.root);
    // K3: con el tablero ya en la página, la ficha a la que le toca, a la vista; y J12.13, en un
    // tablero grande, el grupo.
    requestAnimationFrame(() => {
        if (vttOn) {
            // Tanda 10: con las islas del HUD ya puestas se sabe qué tapan: se encuadra otra vez.
            sizeMemo = null;
            if ((!userMoved || fitPending) && imgW && imgH) {
                fitView();
                fullUpdate();
            }
            drawMinimap();
            followTurn();
        } else {
            focusActiveToken();
        }
        followParty();
        // Tanda 17: la cámara acompaña a quien anda y no salta al redibujar; y el cartel del turno.
        if (vttOn) {
            followWalkers();
            carryCamera();
            // De quién es el turno, en la página: la barra de abajo lo dice en su color (combat-vtt.css).
            if (vtt?.combat && vtt.turnSide) document.documentElement.dataset.gsTurnSide = vtt.turnSide;
            else delete document.documentElement.dataset.gsTurnSide;
            if (vtt?.combat && vtt.turnKey) {
                announceTurn({
                    key: `${derivedViewStateKey}|${vtt.turnKey}`,
                    text: String(vtt.turnTitle ?? ''),
                    side: vtt.turnSide ?? 'yours',
                    // El tablero de ahora: si se ha redibujado mientras esperaba, el nuevo.
                    anchor: () => (container[0].isConnected ? container[0] : document.querySelector('.gs-root .wm-vtt .wm-container')),
                    // A un tercio de lo que se mira (sin el HUD de arriba ni la barra de abajo).
                    at: () => {
                        if (!container[0].isConnected) return null;
                        const box = container[0].getBoundingClientRect();
                        const look = lookRect();
                        return { x: box.left + (look.left + look.right) / 2, y: box.top + look.top + (look.bottom - look.top) * 0.3 };
                    },
                });
            } else if (!vtt?.combat) {
                forgetTurn();
            }
        }
        // J15.5: el tablero con el teclado (board-keys.js): un cursor con las flechas; Intro, un clic.
        if (!paintMode) {
            attachBoardKeys(container[0], content[0], {
                gridWidth, gridHeight, tokens, start: followCell(), describe: describeAt,
                reveal: (cell) => {
                    if (!imgW || !imgH) return;
                    if (vttOn) {
                        // Solo con el cursor del teclado en uso: al montarse el tablero, el cursor
                        // se pinta solo, y eso movía la cámara (y la daba por movida a mano, sin
                        // encuadrar el tablero nunca).
                        if (document.activeElement !== container[0]) return;
                        const rect = lookRect();
                        if (isPointShown(state, cellCenter(cell, imgW / gridWidth, imgH / gridHeight), rect, 30)) return;
                        Object.assign(state, centerPoint(state, cellCenter(cell, imgW / gridWidth, imgH / gridHeight), rect));
                        userMoved = true;
                        fullUpdate();
                        return;
                    }
                    const view = { cellW: imgW / gridWidth, cellH: imgH / gridHeight, scale: state.scale, viewW: viewSize().width || 300, viewH: viewSize().height || 420 };
                    if (isInView({ ...view, cell, offsetX: state.offsetX, offsetY: state.offsetY })) return;
                    Object.assign(state, centerOn({ ...view, cell, boardW: imgW, boardH: imgH }));
                    fullUpdate();
                },
            });
        }
    });

    // Tanda 10: Espacio centra la cámara en quien tiene el turno, mientras se mira el tablero: no
    // escribiendo, ni con una ventana, la tarjeta de un enemigo, los dados o la pausa encima. Quien
    // juega con el teclado y tiene el foco en un botón, con Espacio lo pulsa, como siempre; con el
    // ratón, el foco se queda en el último botón pulsado, y Espacio centra igual. Va antes que el
    // teclado del juego (en la ventana, en la fase de captura), que si no lo usaría para traer el foco.
    if (vttOn) {
        const onSpace = (/** @type {KeyboardEvent} */ event) => {
            if (event.key !== ' ' || event.ctrlKey || event.altKey || event.metaKey || event.defaultPrevented) return;
            if (!container[0].isConnected) {
                window.removeEventListener('keydown', onSpace, true);
                return;
            }
            if (!container[0].closest('.gs-root[data-scene="combat"]')) return;
            const focus = /** @type {HTMLElement|null} */ (document.activeElement);
            if (focus?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
            const onControl = focus && focus !== document.body && focus !== container[0]
                && focus.matches('button, a[href], summary, [role="button"], [role="option"], [role="menuitem"], [role="tab"], [tabindex]');
            if (onControl && keyboardInUse()) return;
            if (document.body.classList.contains('game-shell-paused') || document.querySelector('dialog[open], .tc-overlay, .wm-dice-overlay.active')) return;
            event.preventDefault();
            event.stopPropagation();
            centerActive();
        };
        window.addEventListener('keydown', onSpace, true);
        container.on('remove', () => window.removeEventListener('keydown', onSpace, true));
    }

    // Characters accordion (con sus casillas de escribir: en la mesa virtual no va).
    if (!vttOn) renderCharactersAccordion(target, tokens, (tokenId, gx, gy) => {
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

    if (!hud) return null;
    return {
        centerOnToken,
        zoomBy,
        view: () => ({ scale: state.scale, offsetX: state.offsetX, offsetY: state.offsetY }),
        hud,
    };
}

/**
 * Tanda 10: la capa del HUD de la mesa virtual, encima del tablero. No recibe clics (`pointer-events:
 * none` en su CSS); solo sus islas (`.vtt-island`). Cada esquina es una columna donde se apilan.
 *
 * @returns {VttHandle['hud']}
 */
function buildVttHud() {
    const part = (/** @type {string} */ className) => {
        const node = document.createElement('div');
        node.className = className;
        return node;
    };
    const root = part('vtt-hud');
    const edges = part('vtt-edges');
    const topLeft = part('vtt-top-left');
    const topCenter = part('vtt-top-center');
    const topRight = part('vtt-top-right');
    const bottomLeft = part('vtt-bottom-left');
    root.append(edges, topLeft, topCenter, topRight, bottomLeft);
    return { root, topLeft, topCenter, topRight, bottomLeft, edges };
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
