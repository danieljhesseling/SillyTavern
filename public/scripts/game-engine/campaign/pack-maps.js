/**
 * Los tableros de tu JSON hechos de un mapa dibujado (J12.5 de ROADMAP_SIN_CONEXION, con J12.12).
 *
 * Un tablero de campaña puede jugarse encima de un mapa de D&D en imagen: lleva `image` (la ruta
 * del dibujo desde `public/`) y `grid` (dónde cae cada casilla). Lo normal es que traiga también
 * su `map` en texto, que escribe `tools/mapa-a-tablero.mjs` o el editor de tableros. Pero un Gem
 * no puede mirar un dibujo: escribe `image` y, como mucho, el lado de la casilla, y no el mapa.
 *
 * Aquí se lee ese mapa del propio dibujo, con lo mismo que usa el editor («Subir mapa en
 * cuadrícula», `board/map-image.js`): la cuadrícula (la que diga `grid`, o buscada en el dibujo),
 * y cada casilla, suelo, muro, puerta o terreno difícil. Lo que no se sepa leer queda como suelo,
 * como en el editor, y se retoca después con su pincel.
 *
 * Si el dibujo no se abre, el tablero se queda sin mapa y lo dibuja la semilla (`pack-fill.js`),
 * sin el dibujo, que no casaría, y se dice.
 *
 * Puro salvo por `loadPixels`, que pone quien llama (en el navegador, `loadPicture` del editor).
 */

import { classifyCells, detectGrid, makeGrid, normalizeBoardGrid, toAsciiRows } from '../board/map-image.js';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** Menos casillas que esto por lado no es un tablero: es que no se ha encontrado la cuadrícula. */
const MIN_SIDE = 3;

/**
 * Dónde se abre un dibujo escrito en el paquete: desde `public/`, o tal cual si es una dirección
 * entera.
 *
 * @param {string} image
 * @returns {string}
 */
export function packImageUrl(image) {
    const clean = text(image);
    if (!clean || /^(?:[a-z]+:)?\/\//i.test(clean) || /^(?:data|blob):/i.test(clean)) return clean;
    return `/${clean.replace(/^\/+/, '')}`;
}

/**
 * Leer del dibujo el mapa de cada tablero que trae `image` y no trae `map`.
 *
 * @param {any} raw El paquete, en limpio.
 * @param {Object} options
 * @param {(src: string) => Promise<import('../board/map-image.js').MapPixels>} options.loadPixels
 *   Abre una imagen y da sus píxeles.
 * @returns {Promise<{pack: any, filled: import('./pack-fill.js').FillNote[]}>} El paquete, con
 *   los mapas leídos, y lo que se ha leído (`mapa`).
 */
export async function readPackMaps(raw, { loadPixels }) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.boards) || typeof loadPixels !== 'function') {
        return { pack: raw, filled: [] };
    }
    const boards = [...raw.boards];
    /** @type {import('./pack-fill.js').FillNote[]} */
    const filled = [];
    for (let i = 0; i < boards.length; i++) {
        const board = boards[i];
        if (!board || typeof board !== 'object' || Array.isArray(board)) continue;
        const image = text(board.image);
        if (!image || (Array.isArray(board.map) && board.map.length > 0)) continue;
        /** @type {import('../board/map-image.js').MapPixels|null} */
        let pixels = null;
        try {
            pixels = await loadPixels(packImageUrl(image));
        } catch {
            pixels = null;
        }
        if (!pixels || !(pixels.width > 0) || !(pixels.height > 0)) continue;
        // La cuadrícula que dice el paquete; si no dice ninguna, la que se ve en el dibujo.
        const spec = normalizeBoardGrid(board.grid);
        const grid = spec ? makeGrid(spec, pixels.width, pixels.height) : detectGrid(pixels);
        if (spec?.cols !== undefined) grid.cols = Math.min(grid.cols, spec.cols);
        if (spec?.rows !== undefined) grid.rows = Math.min(grid.rows, spec.rows);
        if (!(grid.cols >= MIN_SIDE) || !(grid.rows >= MIN_SIDE)) continue;
        const reading = classifyCells(pixels, grid);
        const map = toAsciiRows(reading);
        if (map.length < MIN_SIDE) continue;
        boards[i] = {
            ...board,
            map,
            grid: { cell: grid.cell, offsetX: grid.offsetX, offsetY: grid.offsetY, cols: reading.cols, rows: reading.rows },
        };
        filled.push({
            kind: 'mapa',
            name: text(board.name) || text(board.id) || image,
            detail: `${reading.cols} × ${reading.rows} casillas, leídas de su dibujo (${image}). Lo que no se ha sabido leer queda como suelo: se retoca en el editor de tableros.`,
        });
    }
    return { pack: filled.length > 0 ? { ...raw, boards } : raw, filled };
}
