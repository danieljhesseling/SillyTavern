/**
 * El tablero en la ficha del taller: se ve entero y se pinta con el ratón (pedido por Daniel
 * el 2026-09-28, «¿no debería tener aquí el editor de tableros?»).
 *
 * Una rejilla de casillas y una fila de pinceles. Se pulsa y se arrastra; «Empieza el grupo»
 * pone o quita una casilla de inicio con cada clic. Pintar no redibuja la ficha: cambia solo
 * las casillas tocadas, y al soltar el ratón se guarda el trazo entero de una vez.
 *
 * Las reglas de lo que se puede pintar están en `campaign/board-draft.js`; aquí solo se dibuja.
 */

import {
    BRUSHES, CELL_NAMES, CELL_LABELS, START_BRUSH, paintCell, draftProblem,
} from '../../campaign/board-draft.js';

/** El pincel en la mano. Se recuerda entre tableros mientras la página siga abierta. */
let brush = '#';

/**
 * Dibujar el editor dentro de `into`.
 *
 * @param {JQuery} into
 * @param {Object} input
 * @param {import('../../campaign/board-draft.js').BoardDraft} input.draft
 * @param {(draft: import('../../campaign/board-draft.js').BoardDraft) => void} input.onPaint Al acabar cada trazo.
 * @returns {void}
 */
export function drawBoardPaint(into, { draft, onPaint }) {
    // Los enemigos que trae escritos no se enseñan aquí (Daniel, 2026-09-28): al crear se
    // recolocan solos si se ha pintado encima (`settleEnemies`).
    let current = draft;
    const height = current.map.length;
    const width = height > 0 ? current.map[0].length : 0;
    if (width === 0) return;

    const root = $('<div class="tl-bp"></div>');
    root.append($('<div class="tl-label"></div>').text(`El tablero · ${width}×${height} casillas`));

    const palette = $('<div class="tl-bp-palette" role="toolbar" aria-label="Pinceles"></div>');
    for (const option of BRUSHES) {
        const button = $('<button type="button" class="tl-bp-brush"></button>')
            .attr('data-brush', option.id)
            .attr('aria-pressed', String(option.id === brush))
            .toggleClass('on', option.id === brush)
            .append($('<span class="tl-bp-swatch"></span>')
                .attr('data-t', option.id === START_BRUSH ? 'inicio' : CELL_NAMES[option.id]))
            .append($('<span></span>').text(option.label));
        button.on('click', () => {
            brush = option.id;
            palette.children().each((unused, child) => {
                const on = $(child).attr('data-brush') === brush;
                $(child).toggleClass('on', on).attr('aria-pressed', String(on));
            });
        });
        palette.append(button);
    }
    root.append(palette);

    // A mano y de una vez: son hasta 26×18 casillas, y cada una con jQuery se nota.
    const startAt = (/** @type {number} */ x, /** @type {number} */ y) => current.partyStart.some(c => c.x === x && c.y === y);
    const titleOf = (/** @type {number} */ x, /** @type {number} */ y) =>
        [CELL_LABELS[current.map[y][x]] ?? 'Suelo', startAt(x, y) ? 'empieza el grupo' : ''].filter(Boolean).join(' · ');
    const cells = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const classes = ['tl-bp-cell', startAt(x, y) ? 'is-start' : '',
                x === 0 || y === 0 || x === width - 1 || y === height - 1 ? 'is-edge' : ''].filter(Boolean).join(' ');
            cells.push(`<div class="${classes}" data-x="${x}" data-y="${y}" data-t="${CELL_NAMES[current.map[y][x]] ?? 'suelo'}"></div>`);
        }
    }
    const grid = $('<div class="tl-bp-grid"></div>').html(cells.join(''));
    grid[0].style.setProperty('--w', String(width));
    grid.children().each((unused, cell) => {
        cell.title = titleOf(Number(cell.dataset.x), Number(cell.dataset.y));
    });
    root.append(grid);

    const said = $('<div class="tl-hint tl-bp-said"></div>');
    const tell = () => {
        const problem = draftProblem(current);
        const how = 'Pulsa y arrastra para pintar; el borde es muro siempre. En dorado, donde empieza el grupo.';
        said.text(problem || how).toggleClass('bad', Boolean(problem));
    };
    tell();
    root.append(said);

    /** Una casilla, como está ahora. */
    const refresh = (/** @type {number} */ x, /** @type {number} */ y) => {
        const cell = /** @type {HTMLElement|undefined} */ (grid[0].children[(y * width) + x]);
        if (!cell) return;
        cell.dataset.t = CELL_NAMES[current.map[y][x]] ?? 'suelo';
        cell.classList.toggle('is-start', startAt(x, y));
        cell.title = titleOf(x, y);
    };

    let painting = false;
    let changed = false;
    /** @param {PointerEvent} event */
    const paintAt = (event) => {
        const found = document.elementFromPoint(event.clientX, event.clientY);
        const cell = /** @type {HTMLElement|null} */ (found?.closest?.('.tl-bp-cell') ?? null);
        if (!cell || !grid[0].contains(cell)) return;
        const x = Number(cell.dataset.x);
        const y = Number(cell.dataset.y);
        const next = paintCell(current, x, y, brush);
        if (next === current) return;
        current = next;
        changed = true;
        refresh(x, y);
    };
    const finish = () => {
        if (!painting) return;
        painting = false;
        if (!changed) return;
        changed = false;
        tell();
        onPaint(current);
    };

    grid.on('pointerdown', (e) => {
        const event = /** @type {PointerEvent} */ (e.originalEvent);
        if (event.button !== 0) return;
        e.preventDefault();
        painting = true;
        // Con el puntero atrapado, soltar fuera de la rejilla también acaba el trazo.
        grid[0].setPointerCapture?.(event.pointerId);
        paintAt(event);
        // Poner o quitar el inicio es un clic, no un trazo: arrastrando se encendería y apagaría.
        if (brush === START_BRUSH) finish();
    });
    grid.on('pointermove', (e) => {
        if (painting && brush !== START_BRUSH) paintAt(/** @type {PointerEvent} */ (e.originalEvent));
    });
    grid.on('pointerup pointercancel lostpointercapture', finish);

    into.append(root);
}
