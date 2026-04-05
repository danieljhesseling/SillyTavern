/**
 * World Map Renderer Module
 * Provides zoomable world map with location markers and location/board grid views with character tokens.
 */

// ============================================================
//  ZOOMABLE CONTAINER ENGINE
// ============================================================

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
    const img = $('<img />').attr('src', imageUrl).attr('alt', 'map');

    content.append(img);
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

    $(document).on('mousemove.wmZoom', function (e) {
        if (!state.isDragging) return;
        state.offsetX += e.pageX - state.lastX;
        state.offsetY += e.pageY - state.lastY;
        state.lastX = e.pageX;
        state.lastY = e.pageY;
        applyTransform();
    });

    $(document).on('mouseup.wmZoom', function () {
        if (!state.isDragging) return;
        state.isDragging = false;
        content.removeClass('grabbing');
    });

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
        target.html('<div class="wm-empty-state">No world map selected</div>');
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
                <div class="wm-marker ${selectedLocation === loc ? 'selected' : ''}" style="left:${px}px;top:${py}px;pointer-events:auto;">
                    <div class="wm-marker-label">${loc.name}</div>
                    <div class="wm-marker-pin"><i class="fa-solid fa-location-dot"></i></div>
                </div>
            `);

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
                ${loc.url ? `
                    <div class="wm-info-card-image-wrapper">
                        <img class="wm-info-card-image" src="${loc.url}" alt="${loc.name}" />
                        <div class="wm-info-card-badge"><i class="fa-solid fa-location-dot"></i> ${loc.name}</div>
                        <div class="wm-info-card-coords">${loc.x ?? 0},  ${loc.y ?? 0}</div>
                    </div>
                ` : ''}
                <div class="wm-info-card-body">
                    <div class="wm-info-card-title">${loc.name}${loc.description ? ' in ' + (loc.description) : ''}</div>
                    ${loc.region ? `<div class="wm-info-card-region">${loc.region}</div>` : ''}
                </div>
            </div>
        `);
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
            <button class="wm-zoom-btn" data-action="in" title="Zoom In"><i class="fa-solid fa-magnifying-glass-plus"></i></button>
            <button class="wm-zoom-btn" data-action="out" title="Zoom Out"><i class="fa-solid fa-magnifying-glass-minus"></i></button>
        </div>
    `);
    zoomControls.find('[data-action="in"]').on('click', () => { state.scale = Math.min(6, state.scale * 1.3); updateOverlays(); });
    zoomControls.find('[data-action="out"]').on('click', () => { state.scale = Math.max(0.5, state.scale / 1.3); updateOverlays(); });
    container.append(zoomControls);

    // Compass
    container.append('<div class="wm-compass"><span class="wm-compass-n">N</span><i class="fa-solid fa-location-arrow" style="transform:rotate(-45deg);"></i></div>');

    // Change Location button
    const changeBtn = $(`<div class="wm-change-location-btn"><i class="fa-solid fa-route"></i> Change Location</div>`);
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
    } = options;

    target.empty();

    if (!imageUrl) {
        target.html('<div class="wm-empty-state">No location map available</div>');
        return;
    }

    // Location header
    target.append(`
        <div class="wm-location-header">
            <img class="wm-location-header-icon" src="${imageUrl}" alt="${name}" />
            <div class="wm-location-header-info">
                <div class="wm-location-header-name">${name}</div>
                ${description ? `<div class="wm-location-header-desc">${description}</div>` : ''}
            </div>
        </div>
    `);

    const zoomable = createZoomableContainer({ imageUrl, containerHeight: 420 });
    const { container, content, state } = zoomable;

    let gridVisible = true;
    let imgW = 0;
    let imgH = 0;

    // Grid overlay (drawn via CSS background-image)
    const gridOverlay = $('<div class="wm-grid-overlay"></div>');
    content.append(gridOverlay);

    // Tokens layer
    const tokensLayer = $('<div class="wm-tokens-layer"></div>');
    content.append(tokensLayer);

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

            const el = $(`
                <div class="wm-token" data-token-id="${token.id}" style="left:${px}px;top:${py}px;">
                    <div class="wm-token-tooltip">
                        <div class="wm-token-tooltip-name">${token.name}</div>
                        <div class="wm-token-tooltip-meta">Lvl ${token.level || 1} ${token.className || 'Adventurer'}</div>
                        <div class="wm-token-tooltip-hp"><div class="wm-token-tooltip-hp-fill" style="width:${hpPct}%"></div></div>
                    </div>
                    ${token.avatar
                        ? `<img class="wm-token-avatar" src="${token.avatar}" alt="${token.name}" />`
                        : `<div class="wm-token-unknown">???</div>`}
                    <span class="wm-token-name">${token.name}</span>
                </div>
            `);

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
        el.on('mousedown', function (e) {
            e.stopPropagation();
            e.preventDefault();
            el.addClass('dragging');

            const startMX = e.pageX;
            const startMY = e.pageY;
            const startPX = (token.gridX + 0.5) * cellW;
            const startPY = (token.gridY + 0.5) * cellH;

            const dragNs = 'wmTokenDrag_' + token.id + '_' + Date.now();

            $(document).on(`mousemove.${dragNs}`, function (me) {
                const dx = (me.pageX - startMX) / state.scale;
                const dy = (me.pageY - startMY) / state.scale;
                el.css({ left: (startPX + dx) + 'px', top: (startPY + dy) + 'px' });
            });

            $(document).on(`mouseup.${dragNs}`, function (ue) {
                $(document).off(`.${dragNs}`);
                el.removeClass('dragging');

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
                container.closest('.wm-view-panel, [data-map-root]').find(`.wm-char-coord-input[data-token-id="${token.id}"]`).each(function () {
                    const axis = $(this).data('axis');
                    if (axis === 'x') $(this).val(newGX);
                    if (axis === 'y') $(this).val(newGY);
                });
            });
        });
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

        for (let i = 0; i <= gridWidth; i += stepX) {
            const px = state.offsetX + (i + 0.5) * cellW * state.scale;
            if (px < -20 || px > cw + 20) continue;
            axesX.append(`<span class="wm-axis-label" style="left:${px}px;top:2px;">${i + 1}</span>`);
        }

        for (let j = 0; j <= gridHeight; j += stepY) {
            const py = state.offsetY + (j + 0.5) * cellH * state.scale;
            if (py < -15 || py > ch + 15) continue;
            axesY.append(`<span class="wm-axis-label" style="top:${py}px;left:2px;">${j + 1}</span>`);
        }

        container.append(axesX, axesY);
    }

    // Override transform to update axes
    const nsId = 'wmLoc_' + Date.now();

    function fullUpdate() {
        content.css('transform', `translate(${state.offsetX}px, ${state.offsetY}px) scale(${state.scale})`);
        renderGridAxes();
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
        fullUpdate();
    });
    $(document).on(`mouseup.${nsId}`, function () {
        if (!state.isDragging) return;
        state.isDragging = false;
        content.removeClass('grabbing');
    });

    container.off('dblclick').on('dblclick', function (e) {
        if (/** @type {HTMLElement} */ (e.target).closest('.wm-token')) return;
        zoomable.reset();
        fullUpdate();
    });

    // Image load → place grid + tokens
    content.find('img').first().on('load', function () {
        imgW = /** @type {HTMLImageElement} */ (this).naturalWidth;
        imgH = /** @type {HTMLImageElement} */ (this).naturalHeight;

        // Fit
        const cw = container.width() || 300;
        const ch = container.height() || 420;
        const fitScale = Math.min(cw / imgW, ch / imgH, 1);
        state.scale = fitScale;
        state.offsetX = (cw - imgW * fitScale) / 2;
        state.offsetY = (ch - imgH * fitScale) / 2;

        updateGrid();
        placeTokens();
        fullUpdate();
    });

    // Zoom controls
    const zoomControls = $(`
        <div class="wm-zoom-controls">
            <button class="wm-zoom-btn" data-action="in" title="Zoom In"><i class="fa-solid fa-magnifying-glass-plus"></i></button>
            <button class="wm-zoom-btn" data-action="out" title="Zoom Out"><i class="fa-solid fa-magnifying-glass-minus"></i></button>
            <button class="wm-zoom-btn ${gridVisible ? 'active' : ''}" data-action="grid" title="Toggle Grid"><i class="fa-solid fa-border-all"></i></button>
        </div>
    `);
    zoomControls.find('[data-action="in"]').on('click', () => { state.scale = Math.min(6, state.scale * 1.3); fullUpdate(); });
    zoomControls.find('[data-action="out"]').on('click', () => { state.scale = Math.max(0.5, state.scale / 1.3); fullUpdate(); });
    zoomControls.find('[data-action="grid"]').on('click', function () {
        gridVisible = !gridVisible;
        $(this).toggleClass('active', gridVisible);
        gridOverlay.toggleClass('hidden', !gridVisible);
    });
    container.append(zoomControls);

    target.append(container);

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
            <span><i class="fa-solid fa-users" style="margin-right:6px;"></i>Characters</span>
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
                    ${token.avatar
                        ? `<img class="wm-char-avatar" src="${token.avatar}" alt="${token.name}" />`
                        : `<div class="wm-char-avatar" style="display:flex;align-items:center;justify-content:center;background:#1a1a2e;color:#f59e0b;font-size:0.6rem;font-weight:700;">???</div>`}
                    <span class="wm-char-name">${token.name}</span>
                    <div class="wm-char-coords">
                        <span class="wm-char-coord-label">X</span>
                        <input type="number" class="wm-char-coord-input" data-token-id="${token.id}" data-axis="x" value="${token.gridX}" min="0" />
                        <span class="wm-char-coord-label">Y</span>
                        <input type="number" class="wm-char-coord-input" data-token-id="${token.id}" data-axis="y" value="${token.gridY}" min="0" />
                    </div>
                </div>
            `);

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
