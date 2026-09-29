/**
 * La altura en el tablero: quien pelea desde arriba, pega mejor (B1 de wiki/LO_QUE_FALTA.md).
 *
 * El guion de 1387 lo pedía cuatro veces con otras palabras: las torres desde las que se
 * dispara, los escalones, la empalizada, «pelear en escalones da ventaja por altura». Aquí
 * es una sola regla, para los dos bandos y para cualquier arma: **desde una casilla alta
 * contra una que no lo es, ventaja**. Subir cuesta, eso sí: la casilla alta se paga doble al
 * entrar, como el terreno difícil (lo dice su definición en `terrain.js`).
 *
 * Puro: lee el terreno y dice. Quién lo aprovecha lo decide quien llama (`attackEdge`, la
 * IA que busca sitio, el generador que pone los parapetos).
 *
 * J12.10 añade **las cotas**: la altura en pies de cada casilla (`board.elevation`), para los
 * mapas dibujados con mesetas, riscos y puentes («+60 ft», «+30 ft», «+0 ft»). Entre dos
 * casillas vecinas con `CLIFF_FEET` o más de diferencia hay un acantilado: no se cruza
 * andando. Y quien está más alto ataca desde arriba, igual que desde una casilla `high`.
 */

import { cellKey, getCell, getCellDefinition, isInsideGrid, parseCellKey } from './terrain.js';

/** El tipo de terreno que es «arriba». */
export const HIGH = 'high';

/**
 * Si una casilla está en alto.
 *
 * @param {any} terrain
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function isHigh(terrain, x, y) {
    if (!terrain) return false;
    return getCell(terrain, Math.trunc(Number(x) || 0), Math.trunc(Number(y) || 0))?.type === HIGH;
}

/**
 * Cómo está quien ataca respecto a quien recibe.
 *
 * Con cotas (J12.10), mandan ellas cuando hay diferencia de verdad (`CLIFF_FEET` o más); si
 * no, la casilla `high` de siempre.
 *
 * @param {any} terrain
 * @param {{x: number, y: number}} from Quien ataca.
 * @param {{x: number, y: number}} to   Quien recibe.
 * @param {any} [elevation] Las cotas del tablero (`board.elevation`), si las tiene.
 * @returns {'above'|'below'|'level'}
 */
export function heightBetween(terrain, from, to, elevation) {
    if (elevation) {
        const drop = elevationAt(elevation, from?.x, from?.y) - elevationAt(elevation, to?.x, to?.y);
        if (drop >= CLIFF_FEET) return 'above';
        if (drop <= -CLIFF_FEET) return 'below';
    }
    const up = isHigh(terrain, from?.x, from?.y);
    const down = isHigh(terrain, to?.x, to?.y);
    if (up && !down) return 'above';
    if (down && !up) return 'below';
    return 'level';
}

/**
 * La razón que entra en la tirada, o nada. Solo arriba cuenta: estar abajo no estorba más
 * que no tener la altura, y una regla que castiga dos veces se nota injusta.
 *
 * @param {'above'|'below'|'level'|string} height
 * @returns {string}
 */
export function heightReason(height) {
    return height === 'above' ? 'ataca desde arriba' : '';
}

/**
 * Las casillas altas de un tablero, para quien busca dónde ponerse (el tirador de R7).
 *
 * @param {any} terrain
 * @returns {Array<{x: number, y: number}>}
 */
export function highCells(terrain) {
    const cells = terrain?.cells && typeof terrain.cells === 'object' ? terrain.cells : {};
    return Object.entries(cells)
        .filter(([, cell]) => /** @type {any} */ (cell)?.type === HIGH)
        .map(([key]) => {
            const [x, y] = key.split(',').map(Number);
            return { x, y };
        })
        .filter(cell => Number.isFinite(cell.x) && Number.isFinite(cell.y));
}

/**
 * Cuánto le gusta una casilla a quien pelea: la altura es media cobertura para el tirador,
 * y nada para quien va cuerpo a cuerpo (que la pagaría al subir sin sacarle partido).
 *
 * @param {any} terrain
 * @param {{x: number, y: number}} cell
 * @param {boolean} ranged
 * @returns {number}
 */
export function heightScore(terrain, cell, ranged) {
    return ranged && isHigh(terrain, cell?.x, cell?.y) ? 3 : 0;
}

// ---------------------------------------------------------------------------------------
// J12.10: las cotas. La altura en pies de cada casilla, para los mapas dibujados con riscos.
// ---------------------------------------------------------------------------------------

/**
 * Diferencia de altura, en pies, a partir de la cual dos casillas vecinas no se cruzan
 * andando (un acantilado) y quien está arriba ataca con ventaja. Tres metros: lo que no se
 * sube de un paso. Una rampa o una escalera se escribe de 5 en 5 pies.
 */
export const CLIFF_FEET = 10;

/** Lo más alto (o hondo) que se admite, para que una errata no deje una cota absurda. */
const ELEVATION_LIMIT = 1000;

/**
 * Las cotas leídas de disco: `{"x,y": pies}`, solo las que no son 0 (como el terreno, se
 * guarda lo que se sale de lo normal). Lo que no es un número o no es una casilla se tira.
 *
 * @param {any} raw
 * @returns {Record<string, number>}
 */
export function normalizeElevation(raw) {
    /** @type {Record<string, number>} */
    const out = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    for (const [key, value] of Object.entries(raw)) {
        const cell = parseCellKey(key);
        const feet = Math.round(Number(value));
        if (!cell || !Number.isFinite(feet) || feet === 0) continue;
        out[cellKey(cell.x, cell.y)] = Math.max(-ELEVATION_LIMIT, Math.min(ELEVATION_LIMIT, feet));
    }
    return out;
}

/**
 * La altura de una casilla en pies. Sin cota, 0: el suelo de referencia del mapa.
 *
 * @param {any} elevation
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export function elevationAt(elevation, x, y) {
    const feet = Number(elevation?.[cellKey(Number(x) || 0, Number(y) || 0)]);
    return Number.isFinite(feet) ? feet : 0;
}

/**
 * Le da una altura a un trozo del tablero: la meseta que se ha pulsado (`regionAt` en
 * `map-image.js`, o `levelRegion` aquí), un puente, una torre. Devuelve unas cotas nuevas.
 *
 * @param {any} elevation
 * @param {Array<{x: number, y: number}|string>} cells Casillas, como `{x, y}` o `"x,y"`.
 * @param {number} feet 0 la devuelve al suelo de referencia.
 * @returns {Record<string, number>}
 */
export function setElevation(elevation, cells, feet) {
    const out = normalizeElevation(elevation);
    const value = Math.max(-ELEVATION_LIMIT, Math.min(ELEVATION_LIMIT, Math.round(Number(feet) || 0)));
    for (const cell of Array.isArray(cells) ? cells : []) {
        const at = typeof cell === 'string' ? parseCellKey(cell) : { x: Math.trunc(Number(cell?.x)), y: Math.trunc(Number(cell?.y)) };
        if (!at || !Number.isFinite(at.x) || !Number.isFinite(at.y)) continue;
        const key = cellKey(at.x, at.y);
        if (value === 0) delete out[key];
        else out[key] = value;
    }
    return out;
}

/**
 * Si entre dos casillas vecinas hay un acantilado.
 *
 * @param {any} elevation
 * @param {{x: number, y: number}} from
 * @param {{x: number, y: number}} to
 * @returns {boolean}
 */
export function isCliff(elevation, from, to) {
    return Math.abs(elevationAt(elevation, from?.x, from?.y) - elevationAt(elevation, to?.x, to?.y)) >= CLIFF_FEET;
}

/**
 * Si se puede dar un paso de una casilla a una vecina: las dos se pisan (una puerta cerrada
 * cuenta como que se abre) y no hay un acantilado en medio. En diagonal, no vale colarse por
 * la esquina de dos muros (como en `pathfinding.js`), pero sí seguir una cresta estrecha en
 * diagonal entre dos acantilados: dibujada sobre la cuadrícula, una cresta así es una
 * escalera de casillas que solo se tocan por la esquina.
 *
 * Es la regla que tendrá que usar `pathfinding.js` cuando el tablero lleve cotas.
 *
 * @param {any} terrain
 * @param {any} elevation
 * @param {{x: number, y: number}} from
 * @param {{x: number, y: number}} to
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {boolean}
 */
export function canStepBetween(terrain, elevation, from, to, gridWidth, gridHeight) {
    const standable = (/** @type {number} */ x, /** @type {number} */ y) => {
        if (!isInsideGrid(x, y, gridWidth, gridHeight)) return false;
        const cell = getCell(terrain, x, y);
        return cell.type === 'door' || !getCellDefinition(terrain, x, y).blocksMovement;
    };
    if (!standable(to.x, to.y) || isCliff(elevation, from, to)) return false;
    if (from.x === to.x || from.y === to.y) return true;
    return standable(to.x, from.y) && standable(from.x, to.y);
}

/**
 * Hasta dónde se llega andando desde una casilla, sin saltar acantilados. Sirve para
 * comprobar un mapa con alturas: que los puentes unan lo que tienen que unir, y que a la
 * meseta no se suba por donde no hay camino.
 *
 * @param {any} terrain
 * @param {any} elevation
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @param {{x: number, y: number}} start
 * @returns {Set<string>} Claves `"x,y"`.
 */
export function walkableFrom(terrain, elevation, gridWidth, gridHeight, start) {
    const reached = new Set();
    if (!isInsideGrid(start?.x, start?.y, gridWidth, gridHeight)) return reached;
    const queue = [{ x: start.x, y: start.y }];
    reached.add(cellKey(start.x, start.y));
    while (queue.length > 0) {
        const cell = /** @type {{x: number, y: number}} */ (queue.shift());
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (!dx && !dy) continue;
                const next = { x: cell.x + dx, y: cell.y + dy };
                const key = cellKey(next.x, next.y);
                if (reached.has(key) || !canStepBetween(terrain, elevation, cell, next, gridWidth, gridHeight)) continue;
                reached.add(key);
                queue.push(next);
            }
        }
    }
    return reached;
}

/**
 * Los bordes con acantilado, para dibujarlos: cada uno entre una casilla y su vecina de la
 * derecha (`right`) o de abajo (`down`), con lo que se cae (positivo si la casilla está más
 * alta que la vecina).
 *
 * @param {any} elevation
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {Array<{x: number, y: number, side: 'right'|'down', drop: number}>}
 */
export function cliffEdges(elevation, gridWidth, gridHeight) {
    /** @type {Array<{x: number, y: number, side: 'right'|'down', drop: number}>} */
    const edges = [];
    const clean = normalizeElevation(elevation);
    // Solo hace falta mirar alrededor de las casillas con cota: el resto está a 0.
    const seen = new Set();
    for (const key of Object.keys(clean)) {
        const at = /** @type {{x: number, y: number}} */ (parseCellKey(key));
        for (const [x, y] of [[at.x, at.y], [at.x - 1, at.y], [at.x, at.y - 1]]) {
            for (const side of /** @type {Array<'right'|'down'>} */ (['right', 'down'])) {
                const nx = side === 'right' ? x + 1 : x;
                const ny = side === 'down' ? y + 1 : y;
                const id = `${x},${y},${side}`;
                if (seen.has(id) || !isInsideGrid(x, y, gridWidth, gridHeight) || !isInsideGrid(nx, ny, gridWidth, gridHeight)) continue;
                seen.add(id);
                const drop = elevationAt(clean, x, y) - elevationAt(clean, nx, ny);
                if (Math.abs(drop) >= CLIFF_FEET) edges.push({ x, y, side, drop });
            }
        }
    }
    return edges;
}

/**
 * Un trozo del tablero a la misma altura, alrededor de una casilla, en un tablero sin imagen:
 * las casillas que se pisan, unidas por un lado, sin cruzar muros, puertas ni un cambio de
 * cota. Con imagen es mejor `regionAt` de `map-image.js`, que sigue el trazo del dibujo.
 *
 * @param {any} terrain
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @param {number} x
 * @param {number} y
 * @param {any} [elevation]
 * @returns {Array<{x: number, y: number}>}
 */
export function levelRegion(terrain, gridWidth, gridHeight, x, y, elevation) {
    const open = (/** @type {number} */ cx, /** @type {number} */ cy) => isInsideGrid(cx, cy, gridWidth, gridHeight)
        && getCell(terrain, cx, cy).type !== 'door' && !getCellDefinition(terrain, cx, cy).blocksMovement;
    if (!open(x, y)) return [];
    const level = elevationAt(elevation, x, y);
    const seen = new Set([cellKey(x, y)]);
    const out = [{ x, y }];
    for (let k = 0; k < out.length; k++) {
        const cell = out[k];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cell.x + dx;
            const ny = cell.y + dy;
            const key = cellKey(nx, ny);
            if (seen.has(key) || !open(nx, ny) || elevationAt(elevation, nx, ny) !== level) continue;
            seen.add(key);
            out.push({ x: nx, y: ny });
        }
    }
    return out;
}
