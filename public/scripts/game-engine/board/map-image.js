/**
 * Un tablero a partir de un mapa en imagen (J12.8 a J12.11 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * Daniel sube un mapa de D&D dibujado sobre cuadrícula —el de la mazmorra con sus salas B1 a
 * B9— y quiere jugarlo **encima del dibujo**. Aquí se lee la imagen sin IA, mirando los
 * píxeles:
 *
 * 1. **La cuadrícula** (`detectGrid`): las líneas grises finas se repiten cada N píxeles. Se
 *    cuenta, por columnas y por filas, cuántos píxeles grises hay, y se busca el paso y el
 *    desfase que mejor caen sobre los picos. Si falla, quien crea el tablero dice el tamaño de
 *    una casilla, marca una o dice cuántas caben de ancho.
 * 2. **Qué es cada casilla** (`classifyCells`): unas pocas medidas por casilla (cuánta tinta,
 *    si se ve la cuadrícula en sus bordes, cuántas piedras cerradas) y unos umbrales a la
 *    vista, en `MAP_THRESHOLDS`. La trama rayada es roca; la cuadrícula limpia, suelo; las
 *    piedras sueltas, terreno difícil. Lo que no se sabe se dice, y se retoca con el pincel.
 * 3. **El terreno del motor** (`toTerrain`, `toAsciiRows`): el mismo formato que
 *    `terrainFromAsciiMap`, para que el tablero entre tal cual en lo que ya existe.
 * 4. **Una región pulsando** (`regionAt`): se inunda el dibujo desde una casilla hasta los
 *    trazos negros. Sirve para las salas con nombre (`zones.js`) y para las alturas
 *    (`heights.js`): se pulsa en la meseta y se le da su cota.
 *
 * Funciona igual en el navegador (`getImageData` de un canvas) y en Node (pngjs): solo pide
 * `{width, height, data}` con los píxeles en RGBA.
 *
 * Puro: no toca el DOM ni guarda estado; lo único que recuerda, por imagen, es su luminancia
 * y dónde queda la tinta (`lumaOf`, `analyzeInk`), para no calcularlas en cada pulsación.
 *
 * En el mapa de ejemplo (2749 × 1912 px, 36 × 25 casillas) todo junto tarda un par de
 * segundos en Node; en el navegador, lo mismo, una vez al subir el mapa.
 */

import { ASCII_TERRAIN, cellKey, createEmptyTerrain, setCell } from './terrain.js';

/**
 * @typedef {Object} MapPixels
 * @property {number} width
 * @property {number} height
 * @property {ArrayLike<number>} data  RGBA, cuatro bytes por píxel, fila a fila.
 */

/**
 * @typedef {Object} MapGrid
 * @property {number} cell     Lado de una casilla, en píxeles de la imagen. Puede llevar decimales.
 * @property {number} offsetX  Dónde cae la primera línea vertical de la cuadrícula, en píxeles.
 * @property {number} offsetY  Dónde cae la primera línea horizontal.
 * @property {number} cols     Casillas enteras de ancho.
 * @property {number} rows     Casillas enteras de alto.
 * @property {number} [confidence] De 0 a 1: lo claro que se ve la cuadrícula en el dibujo.
 * @property {string} [source] `auto` si se ha encontrado sola; `manual` si la ha dicho alguien.
 */

/**
 * @typedef {Object} CellFeatures
 * @property {number} ink        Parte del interior de la casilla que es tinta negra (0 a 1).
 * @property {number} open       Parte de la casilla lejos de cualquier trazo (0 a 1): el sitio
 *   que hay para ponerse. Casi nada en la trama rayada; casi todo en una sala.
 * @property {number} stones     Huecos claros cerrados con centro en la casilla: piedras,
 *   columnas, mesas.
 * @property {number} gridEdges  Bordes (0 a 4) en los que se ve la línea gris de la cuadrícula.
 * @property {number} inkEdges   Bordes (0 a 4) cubiertos por un trazo negro (una pared).
 */

/**
 * @typedef {'floor'|'wall'|'rough'|'door'|'unknown'} CellKind
 */

/**
 * @typedef {Object} CellReading
 * @property {number} cols
 * @property {number} rows
 * @property {CellKind[]} kinds       Fila a fila: `kinds[y * cols + x]`.
 * @property {CellFeatures[]} features Lo medido en cada casilla, para explicar la decisión.
 * @property {string[]} notes         Por qué se ha decidido lo que no es evidente, por casilla.
 * @property {Array<{x: number, y: number}>} doors   Puertas propuestas.
 * @property {Array<{x: number, y: number}>} plains  Suelo sin cuadrícula dibujada: casi siempre
 *   una meseta o un saliente a otra altura. Se propone para las cotas.
 * @property {Array<{x: number, y: number}>} bridges Puentes propuestos: tiras de trama sueltas
 *   que se leen como suelo.
 * @property {boolean} gridless Si el dibujo no enseña la cuadrícula y se ha leído sin ella.
 */

/**
 * Los umbrales, a la vista. Cada uno dice qué mide y por qué ese número: un umbral que no se
 * entiende no se puede corregir cuando un mapa nuevo lo rompe.
 */
export const MAP_THRESHOLDS = {
    /** Luminancia (0 negro, 255 blanco) por debajo de la cual un píxel es tinta. */
    ink: 100,
    /** La cuadrícula gris clara: entre estos dos valores. La del mapa de ejemplo ronda 166. */
    greyMin: 110,
    greyMax: 232,
    /** Margen del interior de la casilla, en fracción del lado: deja fuera las líneas de la cuadrícula. */
    inset: 0.14,
    /**
     * A qué distancia de un trazo (en fracción del lado) un píxel cuenta como «sitio». Entre
     * dos rayas de la trama nunca hay tanto; en una sala, casi todo.
     */
    openDepth: 0.1,
    /** Sitio a partir del cual la casilla se puede pisar: la mitad, como en la mesa de juego. */
    openFloor: 0.5,
    /** Sitio por debajo del cual es roca, con tinta de trama. */
    openRock: 0.25,
    /** Tinta en el interior a partir de la cual, sin sitio, la casilla es roca rayada. */
    rockInk: 0.15,
    /** Parte de un borde que tiene que verse gris para contar como línea de la cuadrícula. */
    gridEdge: 0.5,
    /**
     * Piedras en la casilla y sus ocho vecinas para que sea terreno difícil: una sola es una
     * columna o una mesa; tres juntas, un montón de escombros.
     */
    rubbleStones: 3,
    /** Una casilla con tanto sitio es suelo aunque tenga una piedra al lado. */
    rubbleOpen: 0.85,
    /** Tamaño de un hueco para ser piedra, en casillas: ni una rendija ni una sala. */
    stoneMinArea: 0.15,
    stoneMaxArea: 2.5,
    /**
     * Hondura mínima de una piedra, en fracción del lado: que quepa algo dentro. Los huecos
     * que deja la trama en zigzag son del tamaño de una piedra, pero estrechos.
     */
    stoneDepth: 0.14,
    /** Lo alargado que puede ser una piedra: su área entre la del círculo que cabe dentro. */
    stoneRound: 7,
    /**
     * Papel en blanco rodeado de roca rayada es roca (en estos mapas la trama solo se dibuja
     * por el borde del macizo). Rodeado de otra cosa, es suelo sin cuadrícula: una meseta.
     */
    enclosedRock: 0.4,
    /** Parte de un borde que tiene que tener los dos lados del rectángulo de una puerta. */
    doorCover: 0.6,
    /**
     * Parte de las casillas con sitio que tienen que enseñar la cuadrícula para fiarse de
     * ella. Por debajo, el mapa se lee como si no la tuviera.
     */
    gridSeen: 0.15,
    /** Un puente: como mucho tantas casillas de trama suelta, y así de negras de media. */
    bridgeMaxCells: 10,
    bridgeInk: 0.35,
    /** Un mueble: «roca» suelta de como mucho tantas casillas. */
    looseMaxCells: 2,
    /**
     * Un paso que puntúa al menos esto respecto al mejor se prefiere si es más corto: tres
     * casillas juntas también caen sobre líneas de la cuadrícula.
     */
    gridHarmonic: 0.7,
};

/** Luminancia ya calculada de cada imagen. */
const lumaMemo = new WeakMap();

/**
 * La luminancia de cada píxel (0 a 255), con la transparencia puesta sobre papel blanco.
 *
 * @param {MapPixels} pixels
 * @returns {Uint8Array}
 */
export function lumaOf(pixels) {
    const known = lumaMemo.get(pixels);
    if (known) return known;
    const { width, height, data } = pixels;
    const luma = new Uint8Array(width * height);
    for (let i = 0, p = 0; i < luma.length; i++, p += 4) {
        const alpha = data[p + 3] ?? 255;
        const value = (data[p] * 299 + data[p + 1] * 587 + data[p + 2] * 114) / 1000;
        luma[i] = Math.round((value * alpha + 255 * (255 - alpha)) / 255);
    }
    lumaMemo.set(pixels, luma);
    return luma;
}

/**
 * Suaviza un perfil con un núcleo triangular de cinco: una línea de dos píxeles y una de
 * seis dan un pico parecido, y el pico cae en su centro.
 *
 * @param {Float64Array} profile
 * @returns {Float64Array}
 */
function smooth(profile) {
    const out = new Float64Array(profile.length);
    const kernel = [1, 2, 3, 2, 1];
    for (let i = 0; i < profile.length; i++) {
        let sum = 0;
        let weight = 0;
        for (let k = -2; k <= 2; k++) {
            const j = i + k;
            if (j < 0 || j >= profile.length) continue;
            sum += profile[j] * kernel[k + 2];
            weight += kernel[k + 2];
        }
        out[i] = sum / weight;
    }
    return out;
}

/**
 * Deja solo los picos estrechos de un perfil: el perfil menos su apertura (el mínimo y luego
 * el máximo en una ventana). Lo ancho —una zona con mucha trama, una sala grande— se va; las
 * líneas de la cuadrícula, que miden unos pocos píxeles, se quedan. Sin esto, el paso que
 * mejor «cae» es el de las salas, no el de las casillas.
 *
 * @param {Float64Array} profile
 * @param {number} radius Media anchura de la ventana: más que media línea.
 * @returns {Float64Array}
 */
function topHat(profile, radius) {
    const n = profile.length;
    const eroded = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        let low = Infinity;
        for (let k = Math.max(0, i - radius); k <= Math.min(n - 1, i + radius); k++) low = Math.min(low, profile[k]);
        eroded[i] = low;
    }
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        let high = -Infinity;
        for (let k = Math.max(0, i - radius); k <= Math.min(n - 1, i + radius); k++) high = Math.max(high, eroded[k]);
        out[i] = profile[i] - high;
    }
    return out;
}

/**
 * Cuántos píxeles de cada columna y de cada fila están entre dos luminancias: solo los picos
 * estrechos (`topHat`), suavizados para buscar a grandes rasgos y sin suavizar para afinar.
 *
 * @param {Uint8Array} luma
 * @param {number} width
 * @param {number} height
 * @param {number} low
 * @param {number} high
 * @returns {GridProfile}
 */
function profiles(luma, width, height, low, high) {
    const cols = new Float64Array(width);
    const rows = new Float64Array(height);
    for (let y = 0; y < height; y++) {
        const row = y * width;
        let count = 0;
        for (let x = 0; x < width; x++) {
            const l = luma[row + x];
            if (l >= low && l <= high) {
                cols[x]++;
                count++;
            }
        }
        rows[y] = count;
    }
    const sharpCols = topHat(cols, LINE_RADIUS);
    const sharpRows = topHat(rows, LINE_RADIUS);
    return { cols: smooth(sharpCols), rows: smooth(sharpRows), sharpCols, sharpRows };
}

/**
 * @typedef {Object} GridProfile
 * @property {Float64Array} cols      Por columna, suavizado.
 * @property {Float64Array} rows      Por fila, suavizado.
 * @property {Float64Array} sharpCols Por columna, sin suavizar.
 * @property {Float64Array} sharpRows Por fila, sin suavizar.
 */

/** Media anchura de ventana del `topHat`: las líneas de más de 12 píxeles no son cuadrícula. */
const LINE_RADIUS = 6;

/**
 * El valor de un perfil en una posición con decimales.
 *
 * @param {Float64Array} profile
 * @param {number} at
 * @returns {number}
 */
function sampleAt(profile, at) {
    const i = Math.floor(at);
    if (i < 0 || i >= profile.length - 1) return profile[Math.max(0, Math.min(profile.length - 1, i))] ?? 0;
    const t = at - i;
    return profile[i] * (1 - t) + profile[i + 1] * t;
}

/**
 * Lo bien que un peine de paso `period` y desfase `phase` cae sobre las líneas: la media en
 * los dientes menos la media a medio camino entre dos dientes.
 *
 * Por qué restar el medio camino: con el doble del paso de verdad, los dientes siguen cayendo
 * sobre líneas, pero el medio camino también, y la diferencia se anula. Con la mitad, la
 * mitad de los dientes cae en blanco. Así el máximo es el paso de verdad y no un múltiplo.
 *
 * @param {Float64Array} profile
 * @param {number} period
 * @param {number} phase
 * @returns {{line: number, mid: number, teeth: number}}
 */
function comb(profile, period, phase) {
    let line = 0;
    let mid = 0;
    let teeth = 0;
    for (let at = phase; at + period / 2 < profile.length - 1; at += period) {
        line += sampleAt(profile, at);
        mid += sampleAt(profile, at + period / 2);
        teeth++;
    }
    if (teeth === 0) return { line: 0, mid: 0, teeth: 0 };
    return { line: line / teeth, mid: mid / teeth, teeth };
}

/**
 * El mejor desfase para un paso dado.
 *
 * @param {Float64Array} profile
 * @param {number} period
 * @param {number} step
 * @param {[number, number]} [range] Desfases a probar; sin nada, todo el paso.
 * @returns {{phase: number, score: number, line: number, mid: number}}
 */
function bestPhase(profile, period, step, range) {
    const [from, to] = range ?? [0, period];
    let best = { phase: 0, score: -Infinity, line: 0, mid: 0 };
    for (let phase = from; phase < to; phase += step) {
        const start = ((phase % period) + period) % period;
        const found = comb(profile, period, start);
        if (found.teeth < 3) continue;
        const score = found.line - found.mid;
        if (score > best.score) best = { phase: start, score, line: found.line, mid: found.mid };
    }
    return best;
}

/**
 * Cuántas casillas enteras caben desde el desfase hasta el borde. Una última casilla a la
 * que le falte un pelo (menos de un 5 %) se cuenta.
 *
 * @param {number} size
 * @param {number} offset
 * @param {number} cell
 * @returns {number}
 */
function wholeCells(size, offset, cell) {
    return Math.max(0, Math.floor((size - offset) / cell + 0.05));
}

/**
 * Una cuadrícula dicha a mano, completada con cuántas casillas caben en la imagen.
 *
 * @param {{cell: number, offsetX?: number, offsetY?: number}} spec
 * @param {number} width  Ancho de la imagen en píxeles.
 * @param {number} height Alto de la imagen en píxeles.
 * @returns {MapGrid}
 */
export function makeGrid(spec, width, height) {
    const cell = Math.max(1, Number(spec?.cell) || 0);
    const wrap = (/** @type {number} */ value) => Math.round(((((Number(value) || 0) % cell) + cell) % cell) * 100) / 100;
    const offsetX = wrap(spec?.offsetX);
    const offsetY = wrap(spec?.offsetY);
    return {
        cell,
        offsetX,
        offsetY,
        cols: wholeCells(width, offsetX, cell),
        rows: wholeCells(height, offsetY, cell),
        confidence: 1,
        source: 'manual',
    };
}

/**
 * La cuadrícula a partir de una casilla marcada en el dibujo: sus dos esquinas opuestas.
 *
 * @param {{x: number, y: number, width: number, height: number}} rect
 * @param {number} width
 * @param {number} height
 * @returns {MapGrid}
 */
export function gridFromCell(rect, width, height) {
    const w = Math.abs(Number(rect?.width) || 0);
    const h = Math.abs(Number(rect?.height) || 0);
    const cell = (w + h) / 2 || 1;
    return makeGrid({ cell, offsetX: Number(rect?.x) || 0, offsetY: Number(rect?.y) || 0 }, width, height);
}

/**
 * @typedef {Object} GridOptions
 * @property {number} [cell]        Lado de la casilla, si se sabe. Solo se busca el desfase.
 * @property {number} [offsetX]     Desfase, si se sabe (con `cell`, no se busca nada).
 * @property {number} [offsetY]
 * @property {number} [cellsAcross] Cuántas casillas tiene la imagen de ancho, contadas en el dibujo.
 * @property {{x: number, y: number, width: number, height: number}} [cellRect] Una casilla marcada.
 * @property {number} [minCell]     Casilla más pequeña que se busca (8 px).
 * @property {number} [maxCell]     Casilla más grande que se busca (un tercio del lado menor).
 */

/**
 * Encuentra la cuadrícula dibujada: el lado de la casilla y dónde empieza.
 *
 * Se cuentan los píxeles grises claros por columna y por fila: donde pasa una línea de la
 * cuadrícula hay un pico, y los picos se repiten. Se prueba cada paso posible con un peine
 * (`comb`) y se queda el que mejor cae en las dos direcciones a la vez, porque las casillas
 * son cuadradas. Luego se afina con decimales (`fitLines`): se busca el centro de cada línea
 * y se traza la recta que pasa por todas. Hace falta: en un mapa de 37 casillas, medio píxel
 * de error por casilla son 18 píxeles de desvío al otro lado. En el mapa de ejemplo, ninguna
 * línea del dibujo queda a más de 0,72 píxeles de la del juego.
 *
 * Si la cuadrícula no es gris sino negra (otros dibujantes), se prueba también con la tinta
 * y se queda la que se vea más clara.
 *
 * @param {MapPixels} pixels
 * @param {GridOptions} [options]
 * @returns {MapGrid}
 */
export function detectGrid(pixels, options = {}) {
    const { width, height } = pixels;
    if (Number(options.cell) > 0 && Number.isFinite(Number(options.offsetX)) && Number.isFinite(Number(options.offsetY))) {
        return makeGrid({ cell: Number(options.cell), offsetX: Number(options.offsetX), offsetY: Number(options.offsetY) }, width, height);
    }

    const luma = lumaOf(pixels);
    const minCell = Math.max(4, Number(options.minCell) || 8);
    const maxCell = Math.max(minCell + 1, Number(options.maxCell) || Math.floor(Math.min(width, height) / 3));

    // Los pasos que se prueban: todos, o solo los cercanos a lo que se ha dicho.
    /** @type {[number, number]} */
    let span = [minCell, maxCell];
    if (Number(options.cell) > 0) {
        span = [Number(options.cell), Number(options.cell)];
    } else if (Number(options.cellsAcross) > 0) {
        const guess = width / Number(options.cellsAcross);
        span = [guess * 0.97, guess * 1.03];
    } else if (options.cellRect && Number(options.cellRect.width) > 0) {
        const guess = (Math.abs(Number(options.cellRect.width)) + Math.abs(Number(options.cellRect.height) || Number(options.cellRect.width))) / 2;
        span = [guess * 0.96, guess * 1.04];
    }

    const tries = [
        profiles(luma, width, height, MAP_THRESHOLDS.greyMin, MAP_THRESHOLDS.greyMax),
        profiles(luma, width, height, 0, MAP_THRESHOLDS.ink),
    ];

    /** @type {MapGrid|null} */
    let best = null;
    for (const profile of tries) {
        const found = searchGrid(profile, span, options);
        if (!found) continue;
        const grid = {
            cell: found.cell,
            offsetX: found.offsetX,
            offsetY: found.offsetY,
            cols: wholeCells(width, found.offsetX, found.cell),
            rows: wholeCells(height, found.offsetY, found.cell),
            confidence: found.confidence,
            source: span[0] === minCell && span[1] === maxCell ? 'auto' : 'manual',
        };
        if (!best || grid.confidence > (best.confidence ?? 0)) best = grid;
        // Una cuadrícula gris que se ve bien no necesita la segunda prueba.
        if (grid.confidence >= 0.5) break;
    }

    return best ?? { cell: 0, offsetX: 0, offsetY: 0, cols: 0, rows: 0, confidence: 0, source: 'auto' };
}

/**
 * La búsqueda de paso y desfase sobre dos perfiles.
 *
 * @param {GridProfile} profile
 * @param {[number, number]} span
 * @param {GridOptions} options
 * @returns {{cell: number, offsetX: number, offsetY: number, confidence: number}|null}
 */
function searchGrid(profile, span, options) {
    const hintX = Number.isFinite(Number(options.offsetX)) ? Number(options.offsetX)
        : options.cellRect ? Number(options.cellRect.x) : null;
    const hintY = Number.isFinite(Number(options.offsetY)) ? Number(options.offsetY)
        : options.cellRect ? Number(options.cellRect.y) : null;

    /**
     * @param {Float64Array} axis
     * @param {number} period
     * @param {number} step
     * @param {number|null} hint
     */
    const phaseFor = (axis, period, step, hint) => (hint === null
        ? bestPhase(axis, period, step)
        : bestPhase(axis, period, step / 2, [hint - period * 0.12, hint + period * 0.12]));

    // Grueso: pasos tan finos que, de un lado al otro de la imagen, el peine no se desvía más
    // de un par de píxeles (con 37 casillas, 0,3 píxeles de error son 11 al final).
    const size = Math.max(profile.cols.length, profile.rows.length);
    /** @type {Array<{period: number, x: number, y: number}>} */
    const tried = [];
    for (let period = span[0]; period <= span[1] + 1e-9; period += Math.max(0.01, (1.5 * period) / size)) {
        tried.push({
            period,
            x: Math.max(0, phaseFor(profile.cols, period, 1, hintX).score),
            y: Math.max(0, phaseFor(profile.rows, period, 1, hintY).score),
        });
        if (span[0] === span[1]) break;
    }
    // Las dos direcciones tienen que caer a la vez: con el producto, un lado corto (seis
    // filas, donde casi cualquier paso cae bien) no tapa que el largo no cuadra.
    const topX = Math.max(...tried.map(t => t.x));
    const topY = Math.max(...tried.map(t => t.y));
    if (!(topX > 0) || !(topY > 0)) return null;
    // La media geométrica: las dos direcciones tienen que caer a la vez.
    const scores = tried.map(t => Math.sqrt((t.x / topX) * (t.y / topY)));
    let best = scores.indexOf(Math.max(...scores));
    const top = scores[best];
    // Tres o siete casillas de golpe también caen sobre líneas, y con el medio camino en
    // blanco: puntúan casi igual que una (o más, si el peine elige las líneas más marcadas).
    // Se prueba cada divisor del mejor paso y se queda el más corto que puntúa casi igual.
    const largest = tried[best].period;
    for (let k = 2; k <= 9; k++) {
        const target = largest / k;
        if (target < span[0]) break;
        let found = -1;
        for (let i = 0; i < tried.length; i++) {
            if (Math.abs(tried[i].period - target) > target * 0.015) continue;
            if (found < 0 || scores[i] > scores[found]) found = i;
        }
        if (found >= 0 && scores[found] >= top * MAP_THRESHOLDS.gridHarmonic) best = found;
    }
    const coarse = tried[best].period;

    // Fino: cada línea donde de verdad está (el centro de su pico), y una recta que pasa por
    // todas. Su pendiente es el lado de la casilla, con décimas y centésimas de píxel.
    const x = fitLines(profile.sharpCols, coarse, phaseFor(profile.cols, coarse, 0.25, hintX).phase);
    const y = fitLines(profile.sharpRows, coarse, phaseFor(profile.rows, coarse, 0.25, hintY).phase);
    const weight = x.lines + y.lines;
    // Un lado dicho a mano se respeta: solo se busca dónde empieza.
    const cell = span[0] !== span[1] && weight > 0 && (x.lines >= 2 || y.lines >= 2)
        ? (x.slope * x.lines + y.slope * y.lines) / weight
        : coarse;
    const phaseX = x.lines > 0 ? x.offsetFor(cell) : 0;
    const phaseY = y.lines > 0 ? y.offsetFor(cell) : 0;

    const clarity = (/** @type {{line: number, mid: number}} */ found) => (found.line + found.mid > 0
        ? Math.max(0, (found.line - found.mid) / (found.line + found.mid)) : 0);
    const final = { x: comb(profile.cols, cell, phaseX), y: comb(profile.rows, cell, phaseY) };

    return {
        cell: Math.round(cell * 100) / 100,
        offsetX: Math.round((((phaseX % cell) + cell) % cell) * 100) / 100,
        offsetY: Math.round((((phaseY % cell) + cell) % cell) * 100) / 100,
        confidence: Math.round(((clarity(final.x) + clarity(final.y)) / 2) * 100) / 100,
    };
}

/**
 * Las líneas de un perfil, cerca de donde las pone un peine de paso y desfase dados: el centro
 * de cada pico (la media de lo que pasa de la mitad de su altura), y la recta que mejor pasa
 * por ellos. Los picos flojos (menos de un cuarto de lo normal) no cuentan: son una línea
 * tapada por una pared, o nada.
 *
 * @param {Float64Array} profile
 * @param {number} period
 * @param {number} phase
 * @returns {{lines: number, slope: number, offsetFor: (cell: number) => number}}
 */
function fitLines(profile, period, phase) {
    const n = profile.length;
    /** @type {Array<{k: number, at: number, weight: number}>} */
    const centres = [];
    const start = ((phase % period) + period) % period;
    for (let k = 0; start + k * period < n; k++) {
        const guess = start + k * period;
        const from = Math.max(0, Math.floor(guess - period / 4));
        const to = Math.min(n - 1, Math.ceil(guess + period / 4));
        let peak = 0;
        for (let i = from; i <= to; i++) peak = Math.max(peak, profile[i]);
        if (!(peak > 0)) continue;
        let sum = 0;
        let moment = 0;
        for (let i = from; i <= to; i++) {
            if (profile[i] < peak / 2) continue;
            sum += profile[i];
            moment += profile[i] * i;
        }
        centres.push({ k, at: moment / sum, weight: peak });
    }
    const typical = centres.map(c => c.weight).sort((a, b) => a - b)[Math.floor(centres.length / 2)] ?? 0;
    const strong = centres.filter(c => c.weight >= typical / 4);
    if (strong.length === 0) return { lines: 0, slope: period, offsetFor: () => start };

    // Mínimos cuadrados, pesando cada línea por lo marcada que está.
    let w = 0;
    let sk = 0;
    let sa = 0;
    let skk = 0;
    let ska = 0;
    for (const c of strong) {
        w += c.weight;
        sk += c.weight * c.k;
        sa += c.weight * c.at;
        skk += c.weight * c.k * c.k;
        ska += c.weight * c.k * c.at;
    }
    const spread = w * skk - sk * sk;
    const slope = strong.length >= 2 && spread > 0 ? (w * ska - sk * sa) / spread : period;
    return {
        lines: strong.length,
        slope,
        // Con el lado ya decidido (el de las dos direcciones), dónde empieza esta.
        offsetFor: (cell) => strong.reduce((acc, c) => acc + c.weight * (c.at - c.k * cell), 0) / w,
    };
}

/**
 * La cuadrícula de un tablero dibujado, leída de disco (J12.12): lo que lleva `board.grid`.
 * `cell` es obligatorio; los desfases, 0 si no se dicen; `cols` y `rows`, si vienen, tienen
 * que ser enteros. Lo que no tiene forma devuelve `null`, para que quien valida lo diga.
 *
 * @param {any} raw
 * @returns {{cell: number, offsetX: number, offsetY: number, cols?: number, rows?: number}|null}
 */
export function normalizeBoardGrid(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const cell = Number(raw.cell);
    const offsetX = Number(raw.offsetX ?? 0);
    const offsetY = Number(raw.offsetY ?? 0);
    if (!Number.isFinite(cell) || cell <= 0) return null;
    if (!Number.isFinite(offsetX) || !Number.isFinite(offsetY) || offsetX < 0 || offsetY < 0) return null;
    /** @type {{cell: number, offsetX: number, offsetY: number, cols?: number, rows?: number}} */
    const grid = { cell, offsetX, offsetY };
    for (const side of /** @type {Array<'cols'|'rows'>} */ (['cols', 'rows'])) {
        if (raw[side] === undefined) continue;
        const count = Number(raw[side]);
        if (!Number.isInteger(count) || count < 1) return null;
        grid[side] = count;
    }
    return grid;
}

/**
 * El rectángulo de la imagen que ocupa la cuadrícula entera. Recortando la imagen a esto,
 * cada casilla del tablero cae sobre una del dibujo sin que quien pinta tenga que saber nada
 * de desfases: es lo que espera hoy `renderLocationView`, que reparte la imagen entera entre
 * las casillas.
 *
 * @param {MapGrid} grid
 * @returns {{x: number, y: number, width: number, height: number}}
 */
export function gridCrop(grid) {
    return {
        x: Math.round(grid.offsetX),
        y: Math.round(grid.offsetY),
        width: Math.round(grid.cols * grid.cell),
        height: Math.round(grid.rows * grid.cell),
    };
}

/**
 * Los píxeles de una casilla: de línea a línea.
 *
 * @param {MapGrid} grid
 * @param {number} cx
 * @param {number} cy
 * @returns {{x0: number, y0: number, x1: number, y1: number}}
 */
export function cellBox(grid, cx, cy) {
    return {
        x0: Math.round(grid.offsetX + cx * grid.cell),
        y0: Math.round(grid.offsetY + cy * grid.cell),
        x1: Math.round(grid.offsetX + (cx + 1) * grid.cell),
        y1: Math.round(grid.offsetY + (cy + 1) * grid.cell),
    };
}

/**
 * @typedef {Object} InkAnalysis
 * @property {Float32Array} dist Para cada píxel, a cuántos píxeles queda la tinta más cercana
 *   (0 sobre la tinta). Es lo que dice si hay sitio: en la trama rayada nunca hay más de unos
 *   pocos píxeles hasta el siguiente trazo; en una sala, media casilla.
 * @property {Array<{area: number, x: number, y: number, depth: number}>} pockets Los huecos
 *   claros cerrados por tinta (que no llegan al borde de la imagen): su tamaño en píxeles, su
 *   centro y su hondura (la distancia a la tinta en su punto más hondo). El blanco de dentro
 *   de una piedra, de una columna, de una mesa.
 */

/** Lo ya analizado de cada imagen. */
const inkMemo = new WeakMap();

/**
 * La tinta de la imagen entera: a qué distancia queda de cada píxel, y qué huecos cierra.
 * No depende de la cuadrícula, así que se hace una vez por imagen.
 *
 * @param {MapPixels} pixels
 * @returns {InkAnalysis}
 */
export function analyzeInk(pixels) {
    const known = inkMemo.get(pixels);
    if (known) return known;
    const { width, height } = pixels;
    const luma = lumaOf(pixels);
    const T = MAP_THRESHOLDS;
    const n = width * height;

    // Distancia de chaflán en dos pasadas: 1 en recto, 1,41 en diagonal.
    const dist = new Float32Array(n);
    for (let i = 0; i < n; i++) dist[i] = luma[i] < T.ink ? 0 : 1e6;
    const D = Math.SQRT2;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x;
            let d = dist[i];
            if (d === 0) continue;
            if (x > 0) d = Math.min(d, dist[i - 1] + 1);
            if (y > 0) {
                d = Math.min(d, dist[i - width] + 1);
                if (x > 0) d = Math.min(d, dist[i - width - 1] + D);
                if (x < width - 1) d = Math.min(d, dist[i - width + 1] + D);
            }
            dist[i] = d;
        }
    }
    for (let y = height - 1; y >= 0; y--) {
        for (let x = width - 1; x >= 0; x--) {
            const i = y * width + x;
            let d = dist[i];
            if (d === 0) continue;
            if (x < width - 1) d = Math.min(d, dist[i + 1] + 1);
            if (y < height - 1) {
                d = Math.min(d, dist[i + width] + 1);
                if (x < width - 1) d = Math.min(d, dist[i + width + 1] + D);
                if (x > 0) d = Math.min(d, dist[i + width - 1] + D);
            }
            dist[i] = d;
        }
    }

    // Los huecos claros: se inunda cada uno una vez.
    const seen = new Uint8Array(n);
    const stack = new Int32Array(n);
    /** @type {Array<{area: number, x: number, y: number, depth: number}>} */
    const pockets = [];
    for (let start = 0; start < n; start++) {
        if (seen[start] || luma[start] < T.ink) continue;
        let top = 0;
        stack[top++] = start;
        seen[start] = 1;
        let area = 0;
        let sumX = 0;
        let sumY = 0;
        let depth = 0;
        let touches = false;
        while (top > 0) {
            const at = stack[--top];
            const x = at % width;
            const y = (at - x) / width;
            area++;
            sumX += x;
            sumY += y;
            if (dist[at] > depth) depth = dist[at];
            if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touches = true;
            if (x + 1 < width && !seen[at + 1] && luma[at + 1] >= T.ink) { seen[at + 1] = 1; stack[top++] = at + 1; }
            if (x > 0 && !seen[at - 1] && luma[at - 1] >= T.ink) { seen[at - 1] = 1; stack[top++] = at - 1; }
            if (y + 1 < height && !seen[at + width] && luma[at + width] >= T.ink) { seen[at + width] = 1; stack[top++] = at + width; }
            if (y > 0 && !seen[at - width] && luma[at - width] >= T.ink) { seen[at - width] = 1; stack[top++] = at - width; }
        }
        if (!touches) pockets.push({ area, x: sumX / area, y: sumY / area, depth });
    }

    const analysis = { dist, pockets };
    inkMemo.set(pixels, analysis);
    return analysis;
}

/**
 * Lo que se mide en una casilla.
 *
 * @param {MapPixels} pixels
 * @param {MapGrid} grid
 * @param {number} cx
 * @param {number} cy
 * @returns {CellFeatures}
 */
export function measureCell(pixels, grid, cx, cy) {
    const T = MAP_THRESHOLDS;
    const { width, height } = pixels;
    const luma = lumaOf(pixels);
    const { dist } = analyzeInk(pixels);
    const box = cellBox(grid, cx, cy);
    const inset = Math.max(1, Math.round(grid.cell * T.inset));
    const ix0 = Math.max(0, box.x0 + inset);
    const iy0 = Math.max(0, box.y0 + inset);
    const ix1 = Math.min(width, box.x1 - inset);
    const iy1 = Math.min(height, box.y1 - inset);
    if (ix1 <= ix0 || iy1 <= iy0) return { ink: 0, open: 0, stones: 0, gridEdges: 0, inkEdges: 0 };

    // La tinta, en el interior (sin las líneas de la cuadrícula).
    let inkCount = 0;
    for (let y = iy0; y < iy1; y++) {
        for (let x = ix0; x < ix1; x++) if (luma[y * width + x] < T.ink) inkCount++;
    }

    // El sitio, en la casilla entera: lo que queda lejos de cualquier trazo.
    const depth = grid.cell * T.openDepth;
    let openCount = 0;
    let total = 0;
    for (let y = Math.max(0, box.y0); y < Math.min(height, box.y1); y++) {
        for (let x = Math.max(0, box.x0); x < Math.min(width, box.x1); x++) {
            total++;
            if (dist[y * width + x] >= depth) openCount++;
        }
    }

    return {
        ink: inkCount / ((ix1 - ix0) * (iy1 - iy0)),
        open: total > 0 ? openCount / total : 0,
        stones: 0,
        ...measureEdges(luma, width, height, box, grid.cell),
    };
}

/**
 * Cuántas piedras tiene cada casilla: huecos cerrados de tamaño de piedra (ni una rendija de
 * la trama, ni una sala entera), con hondura (una piedra tiene dentro; una rendija, no) y
 * más o menos redondos (el hueco largo y estrecho entre dos rayas no es una piedra),
 * contados en la casilla donde cae su centro.
 *
 * @param {MapPixels} pixels
 * @param {MapGrid} grid
 * @returns {Uint16Array} Fila a fila.
 */
function countStones(pixels, grid) {
    const T = MAP_THRESHOLDS;
    const { pockets } = analyzeInk(pixels);
    const area = grid.cell * grid.cell;
    const stones = new Uint16Array(grid.cols * grid.rows);
    for (const pocket of pockets) {
        if (pocket.area < area * T.stoneMinArea || pocket.area > area * T.stoneMaxArea) continue;
        if (pocket.depth < grid.cell * T.stoneDepth) continue;
        // Un círculo da 1; un cuadrado, 1,3; una tira cinco veces más larga que ancha, 6,4.
        if (pocket.area / (Math.PI * pocket.depth * pocket.depth) > T.stoneRound) continue;
        const x = Math.floor((pocket.x - grid.offsetX) / grid.cell);
        const y = Math.floor((pocket.y - grid.offsetY) / grid.cell);
        if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows) continue;
        stones[y * grid.cols + x]++;
    }
    return stones;
}

/**
 * Los cuatro bordes de una casilla: en cuántos se ve la línea gris de la cuadrícula y en
 * cuántos un trazo negro. Solo se mira el 60 % central de cada borde: en las esquinas se
 * cruzan las líneas (o, en el mapa de ejemplo, se cortan a propósito).
 *
 * @param {Uint8Array} luma
 * @param {number} width
 * @param {number} height
 * @param {{x0: number, y0: number, x1: number, y1: number}} box
 * @param {number} cell
 * @returns {{gridEdges: number, inkEdges: number}}
 */
function measureEdges(luma, width, height, box, cell) {
    const T = MAP_THRESHOLDS;
    const half = Math.max(1, Math.round(cell * 0.03));
    let gridEdges = 0;
    let inkEdges = 0;
    const edges = [
        { vertical: true, at: box.x0, from: box.y0, to: box.y1 },
        { vertical: true, at: box.x1, from: box.y0, to: box.y1 },
        { vertical: false, at: box.y0, from: box.x0, to: box.x1 },
        { vertical: false, at: box.y1, from: box.x0, to: box.x1 },
    ];
    for (const edge of edges) {
        const length = edge.to - edge.from;
        const a = Math.round(edge.from + length * 0.2);
        const b = Math.round(edge.to - length * 0.2);
        let grey = 0;
        let ink = 0;
        let total = 0;
        for (let t = a; t < b; t++) {
            let darkest = 255;
            for (let d = -half; d <= half; d++) {
                const x = edge.vertical ? edge.at + d : t;
                const y = edge.vertical ? t : edge.at + d;
                if (x < 0 || y < 0 || x >= width || y >= height) continue;
                darkest = Math.min(darkest, luma[y * width + x]);
            }
            total++;
            if (darkest < T.ink) ink++;
            else if (darkest <= T.greyMax) grey++;
        }
        if (total === 0) continue;
        if (grey / total >= T.gridEdge) gridEdges++;
        if (ink / total >= T.gridEdge) inkEdges++;
    }
    return { gridEdges, inkEdges };
}

/**
 * Lo que es una casilla por lo que se ha medido en ella, sin mirar a las vecinas.
 *
 * - Sitio de sobra (`open`) y la cuadrícula en algún borde: suelo.
 * - Sitio de sobra y sin cuadrícula: papel en blanco. Fuera del mapa, una meseta o el
 *   interior de un macizo de roca; lo decide `classifyCells` mirando alrededor.
 * - Sin sitio y con tinta: roca (la trama rayada), o una mancha negra, que tampoco se pisa.
 * - A medias (una pared que pasa por la casilla, las rayas de un acantilado): lo dice la
 *   cuadrícula. Se ve en dos bordes o más, suelo: el dibujante no la pinta sobre la roca. No
 *   se ve en ninguno, roca. En uno solo, no se sabe, y lo deciden las vecinas.
 *
 * Sin cuadrícula en el dibujo (`gridless`), solo cuenta el sitio.
 *
 * Los escombros no se ven casilla a casilla, sino en montón: también lo decide `classifyCells`.
 *
 * @param {CellFeatures} f
 * @param {boolean} [gridless]
 * @returns {CellKind|'blank'}
 */
export function kindFromFeatures(f, gridless = false) {
    const T = MAP_THRESHOLDS;
    if (f.open >= T.openFloor) return !gridless && f.gridEdges > 0 ? 'floor' : 'blank';
    // La cuadrícula en dos bordes gana a la tinta: es una cama, una mesa o una pared que
    // pasa por la casilla, dibujadas sobre el suelo.
    if (!gridless && f.gridEdges >= 2) return 'floor';
    if (f.open < T.openRock && f.ink >= T.rockInk) return 'wall';
    if (gridless) return 'unknown';
    if (f.gridEdges === 0) return 'wall';
    return 'unknown';
}

/** Las cuatro vecinas de lado. */
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Las ocho vecinas. */
const AROUND = [...SIDES, [1, 1], [1, -1], [-1, 1], [-1, -1]];

/**
 * Los grupos de casillas unidas por un lado (o también en diagonal) que cumplen algo.
 *
 * @param {number} cols
 * @param {number} rows
 * @param {(i: number) => boolean} member
 * @param {boolean} [diagonal]
 * @returns {number[][]}
 */
function groupsOf(cols, rows, member, diagonal = false) {
    const seen = new Uint8Array(cols * rows);
    /** @type {number[][]} */
    const groups = [];
    for (let start = 0; start < cols * rows; start++) {
        if (seen[start] || !member(start)) continue;
        const group = [start];
        seen[start] = 1;
        for (let k = 0; k < group.length; k++) {
            const x = group[k] % cols;
            const y = (group[k] - x) / cols;
            for (const [dx, dy] of diagonal ? AROUND : SIDES) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
                const j = ny * cols + nx;
                if (seen[j] || !member(j)) continue;
                seen[j] = 1;
                group.push(j);
            }
        }
        groups.push(group);
    }
    return groups;
}

/**
 * Qué es cada casilla del dibujo.
 *
 * Primero cada una por sí sola (`kindFromFeatures`). Luego lo que depende de las vecinas, en
 * este orden:
 *
 * 1. Los escombros: piedras en montón (`rubbleStones` en una casilla y sus vecinas).
 * 2. El papel en blanco que llega al borde de la imagen es lo de fuera del mapa: muro. El que
 *    queda encerrado es el interior de un macizo si lo rodea la roca, y si no, suelo sin
 *    cuadrícula: en estos mapas, una meseta o un saliente. Se propone en `plains` para darle
 *    altura.
 * 3. Lo que no se sabe y une dos suelos enfrentados es un pasillo: suelo.
 * 4. Lo demás que no se sabe, por mayoría de las ocho vecinas; sin mayoría, suelo.
 * 5. La «roca» suelta en medio del suelo: un puente (trama apretada) o un mueble. Suelo.
 * 6. Las puertas: un rectángulo sobre la línea que separa dos casillas de suelo.
 *
 * En el mapa de ejemplo (36 × 25 casillas) quedan unas 13 casillas de 900 con el paso mal
 * (muro por suelo o al revés) y otras 6 con el tipo cambiado (una puerta de más, escombros
 * leídos como suelo): menos de una de cada veinte de las que son mapa.
 *
 * @param {MapPixels} pixels
 * @param {MapGrid} grid
 * @returns {CellReading}
 */
export function classifyCells(pixels, grid) {
    const { width, height } = pixels;
    const luma = lumaOf(pixels);
    const cols = grid.cols;
    const rows = grid.rows;
    const stones = countStones(pixels, grid);
    /** @type {CellFeatures[]} */
    const features = [];
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            features.push({ ...measureCell(pixels, grid, x, y), stones: stones[y * cols + x] });
        }
    }
    // Si el dibujo no tiene cuadrícula a la vista (o la han dicho a mano sobre un mapa sin
    // ella), la cuadrícula no puede decidir nada.
    const roomy = features.filter(f => f.open >= MAP_THRESHOLDS.openFloor);
    const gridless = roomy.length === 0
        || roomy.filter(f => f.gridEdges >= 2).length / roomy.length < MAP_THRESHOLDS.gridSeen;
    /** @type {Array<CellKind|'blank'>} */
    const first = features.map(f => kindFromFeatures(f, gridless));

    /** @type {string[]} */
    const notes = new Array(cols * rows).fill('');
    /** @type {Array<CellKind|'blank'|'plain'>} */
    const kinds = [...first];
    /** @type {(i: number, dx: number, dy: number) => number} La vecina, o -1 fuera. */
    const neighbour = (i, dx, dy) => {
        const x = (i % cols) + dx;
        const y = Math.floor(i / cols) + dy;
        return x < 0 || y < 0 || x >= cols || y >= rows ? -1 : y * cols + x;
    };

    // Los escombros: piedras en montón. Una casilla con una piedra y otras dos cerca.
    for (let i = 0; i < kinds.length; i++) {
        if (stones[i] === 0 || features[i].open >= MAP_THRESHOLDS.rubbleOpen) continue;
        let near = 0;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const j = neighbour(i, dx, dy);
                if (j >= 0) near += stones[j];
            }
        }
        if (near >= MAP_THRESHOLDS.rubbleStones) {
            kinds[i] = 'rough';
            notes[i] = `escombros: ${near} piedras juntas`;
        }
    }

    // El papel en blanco que llega al borde de la imagen, de blanco en blanco, es lo de fuera.
    const outside = new Uint8Array(cols * rows);
    for (const group of groupsOf(cols, rows, i => kinds[i] === 'blank')) {
        const reachesEdge = group.some(i => {
            const x = i % cols;
            const y = (i - x) / cols;
            return x === 0 || y === 0 || x === cols - 1 || y === rows - 1;
        });
        if (reachesEdge) {
            for (const i of group) outside[i] = 1;
            continue;
        }
        // El blanco encerrado: dentro de un macizo si lo rodea la roca; si no, una meseta.
        const ring = new Set();
        for (const i of group) {
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const j = neighbour(i, dx, dy);
                    if (j >= 0 && kinds[j] !== 'blank') ring.add(j);
                }
            }
        }
        // Sin cuadrícula en el dibujo no hay forma de distinguirlo de una sala: suelo.
        const rock = [...ring].filter(j => kinds[j] === 'wall').length;
        const inRock = !gridless && ring.size > 0 && rock / ring.size >= MAP_THRESHOLDS.enclosedRock;
        for (const i of group) {
            kinds[i] = inRock ? 'wall' : gridless ? 'floor' : 'plain';
            notes[i] = inRock ? 'dentro de la roca' : gridless ? '' : 'suelo sin cuadrícula';
        }
    }
    for (let i = 0; i < kinds.length; i++) {
        if (!outside[i]) continue;
        kinds[i] = 'wall';
        notes[i] = 'fuera del mapa';
    }

    // Lo que no se sabe y une dos suelos enfrentados es un paso (un pasillo de una casilla
    // entre dos paredes): un muro ahí cortaría el camino que el dibujo deja abierto.
    for (let i = 0; i < kinds.length; i++) {
        if (kinds[i] !== 'unknown') continue;
        const walk = (/** @type {number} */ dx, /** @type {number} */ dy) => {
            const j = neighbour(i, dx, dy);
            return j >= 0 && (kinds[j] === 'floor' || kinds[j] === 'plain' || kinds[j] === 'rough');
        };
        if ((walk(1, 0) && walk(-1, 0)) || (walk(0, 1) && walk(0, -1))) {
            kinds[i] = 'floor';
            notes[i] = 'dudosa: suelo, une dos suelos';
        }
    }

    // Lo que no se sabe, por mayoría de vecinas.
    for (let pass = 0; pass < 2; pass++) {
        const before = [...kinds];
        for (let i = 0; i < kinds.length; i++) {
            if (before[i] !== 'unknown') continue;
            const x = i % cols;
            const y = (i - x) / cols;
            /** @type {Record<string, number>} */
            const votes = {};
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (!dx && !dy) continue;
                    const nx = x + dx;
                    const ny = y + dy;
                    // Más allá del borde del dibujo no se pasa: cuenta como muro.
                    const k = nx < 0 || ny < 0 || nx >= cols || ny >= rows ? 'wall' : before[ny * cols + nx];
                    if (k === 'unknown') continue;
                    const vote = k === 'plain' ? 'floor' : k;
                    votes[vote] = (votes[vote] ?? 0) + 1;
                }
            }
            const winner = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
            if (winner && winner[1] >= 3) {
                kinds[i] = /** @type {CellKind} */ (winner[0]);
                notes[i] = `dudosa: ${winner[0] === 'wall' ? 'muro' : winner[0] === 'rough' ? 'terreno difícil' : 'suelo'} por sus vecinas`;
            } else if (pass === 1) {
                // Sin mayoría: suelo. Un suelo de más se ve enseguida; un muro de más encierra
                // una sala sin que nadie lo note.
                kinds[i] = 'floor';
                notes[i] = 'dudosa: suelo';
            }
        }
    }

    // La «roca» suelta, que no toca el macizo ni el borde: en medio de una sala es un mueble
    // (una cama, una mesa dibujada con trazo gordo), y entre dos alturas, un puente (la trama
    // apretada de sus tablas). Las dos se pisan: se leen como suelo y se dice por qué.
    /** @type {Array<{x: number, y: number}>} */
    const bridges = [];
    for (const group of groupsOf(cols, rows, i => kinds[i] === 'wall' && !outside[i], true)) {
        if (group.length > MAP_THRESHOLDS.bridgeMaxCells) continue;
        // Suelta de verdad: ni en el borde ni pegada a lo de fuera del mapa.
        const touchesOutside = group.some(i => AROUND.some(([dx, dy]) => {
            const j = neighbour(i, dx, dy);
            return j < 0 || outside[j] === 1;
        }));
        if (touchesOutside) continue;
        const ink = group.reduce((sum, i) => sum + features[i].ink, 0) / group.length;
        const bridge = ink >= MAP_THRESHOLDS.bridgeInk && group.length >= 2;
        if (!bridge && group.length > MAP_THRESHOLDS.looseMaxCells) continue;
        for (const i of group) {
            kinds[i] = 'floor';
            notes[i] = bridge ? 'puente (propuesto): una tira de trama suelta' : 'dudosa: trazo suelto en el suelo (un mueble)';
            if (bridge) bridges.push({ x: i % cols, y: Math.floor(i / cols) });
        }
    }

    /** @type {Array<{x: number, y: number}>} */
    const plains = [];
    /** @type {CellKind[]} */
    const finalKinds = kinds.map((kind, i) => {
        if (kind === 'plain') {
            plains.push({ x: i % cols, y: Math.floor(i / cols) });
            return 'floor';
        }
        return /** @type {CellKind} */ (kind);
    });

    const doors = findDoors(luma, width, height, grid, finalKinds);
    for (const door of doors) {
        finalKinds[door.y * cols + door.x] = 'door';
        notes[door.y * cols + door.x] = 'puerta: un rectángulo sobre la pared';
    }

    return { cols, rows, kinds: finalKinds, features, notes, doors, plains, bridges, gridless };
}

/**
 * Las puertas: en el dibujo, un rectángulo pequeño sobre la línea de una pared, entre dos
 * casillas de suelo. Al cruzar ese borde se atraviesan **dos** trazos (los lados largos del
 * rectángulo) con blanco en medio; una pared lisa es un solo trazo, y la cuadrícula, ninguno.
 *
 * El motor pone las puertas en casillas, no en bordes: se convierte en puerta la casilla del
 * lado del pasillo, la que tiene paredes a los dos lados.
 *
 * @param {Uint8Array} luma
 * @param {number} width
 * @param {number} height
 * @param {MapGrid} grid
 * @param {CellKind[]} kinds
 * @returns {Array<{x: number, y: number}>}
 */
function findDoors(luma, width, height, grid, kinds) {
    const T = MAP_THRESHOLDS;
    const { cols, rows, cell } = grid;
    // Solo entre suelo y suelo: las piedras de un montón también dibujan dos trazos paralelos.
    const walkable = (/** @type {number} */ x, /** @type {number} */ y) =>
        x >= 0 && y >= 0 && x < cols && y < rows && kinds[y * cols + x] === 'floor';
    const blocked = (/** @type {number} */ x, /** @type {number} */ y) =>
        x < 0 || y < 0 || x >= cols || y >= rows || kinds[y * cols + x] === 'wall';
    const reach = Math.max(2, Math.round(cell * 0.22));
    /** @type {Array<{x: number, y: number}>} */
    const doors = [];
    const taken = new Set();

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            for (const [dx, dy] of [[1, 0], [0, 1]]) {
                const nx = x + dx;
                const ny = y + dy;
                if (!walkable(x, y) || !walkable(nx, ny)) continue;
                // El borde compartido, en píxeles.
                const vertical = dx === 1;
                const line = vertical ? grid.offsetX + nx * cell : grid.offsetY + ny * cell;
                const from = vertical ? grid.offsetY + y * cell : grid.offsetX + x * cell;
                // Donde empieza el primer trazo y acaba el último, en cada punto del borde.
                /** @type {number[]} */
                const firsts = [];
                /** @type {number[]} */
                const lasts = [];
                let total = 0;
                for (let t = Math.round(from + cell * 0.25); t < Math.round(from + cell * 0.75); t++) {
                    /** @type {number[]} */
                    const centres = [];
                    let inRun = false;
                    let start = 0;
                    for (let d = -reach; d <= reach + 1; d++) {
                        const px = vertical ? Math.round(line) + d : t;
                        const py = vertical ? t : Math.round(line) + d;
                        const isInk = d <= reach && px >= 0 && py >= 0 && px < width && py < height && luma[py * width + px] < T.ink;
                        if (isInk && !inRun) {
                            inRun = true;
                            start = d;
                        } else if (!isInk && inRun) {
                            inRun = false;
                            centres.push((start + d - 1) / 2);
                        }
                    }
                    total++;
                    if (centres.length >= 2) {
                        firsts.push(centres[0]);
                        lasts.push(centres[centres.length - 1]);
                    }
                }
                if (total === 0 || firsts.length / total < T.doorCover) continue;
                // Un rectángulo tiene dos lados rectos y paralelos, separados: los dos trazos
                // caen siempre en el mismo sitio. La trama cruza el borde donde le da.
                const spread = (/** @type {number[]} */ values) => {
                    const mean = values.reduce((a, b) => a + b, 0) / values.length;
                    return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
                };
                const middle = (/** @type {number[]} */ values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
                const gap = middle(lasts.map((last, k) => last - firsts[k]));
                if (spread(firsts) > cell * 0.05 || spread(lasts) > cell * 0.05 || gap < cell * 0.12) continue;
                // Y va montado sobre la línea de la pared, no al lado: un mueble pegado a la
                // pared también son dos trazos paralelos, pero caen a un lado.
                if (Math.abs(middle(lasts.map((last, k) => (last + firsts[k]) / 2))) > cell * 0.1) continue;

                // La casilla del pasillo: la que tiene muro a los lados de la puerta. Si
                // ninguna lo tiene, no es una puerta sino un dibujo en medio de la sala.
                const sides = (/** @type {number} */ cx, /** @type {number} */ cy) => (vertical
                    ? Number(blocked(cx, cy - 1)) + Number(blocked(cx, cy + 1))
                    : Number(blocked(cx - 1, cy)) + Number(blocked(cx + 1, cy)));
                if (sides(x, y) === 0 && sides(nx, ny) === 0) continue;
                const pick = sides(nx, ny) > sides(x, y) ? { x: nx, y: ny } : { x, y };
                const key = cellKey(pick.x, pick.y);
                if (taken.has(key)) continue;
                taken.add(key);
                doors.push(pick);
            }
        }
    }
    return doors;
}

/** El tipo de terreno del motor que corresponde a cada lectura. */
const KIND_TERRAIN = {
    floor: 'floor',
    wall: 'wall',
    rough: 'difficult',
    door: 'door',
    unknown: 'floor',
};

/**
 * El terreno del motor: el mismo formato disperso que `terrainFromAsciiMap`, listo para
 * `board.terrain`. Lo que no se ha sabido leer queda como suelo (y en `notes`), para que el
 * pincel lo arregle: un muro de más encierra salas; un suelo de más se ve enseguida.
 *
 * @param {CellReading} reading
 * @returns {import('./terrain.js').BoardTerrain}
 */
export function toTerrain(reading) {
    let terrain = createEmptyTerrain();
    for (let y = 0; y < reading.rows; y++) {
        for (let x = 0; x < reading.cols; x++) {
            const type = KIND_TERRAIN[reading.kinds[y * reading.cols + x]] ?? 'floor';
            if (type === 'floor') continue;
            terrain = setCell(terrain, x, y, type, { open: false });
        }
    }
    return terrain;
}

/** El carácter de `ASCII_TERRAIN` para cada tipo de terreno. */
const TERRAIN_CHAR = Object.fromEntries(Object.entries(ASCII_TERRAIN)
    .filter(([, cell]) => !(/** @type {any} */ (cell).open) && !(/** @type {any} */ (cell).locked))
    .map(([char, cell]) => [cell.type, char]));

/**
 * El mapa en filas de texto, con la leyenda de `terrainFromAsciiMap`: `#` muro, `.` suelo,
 * `~` terreno difícil, `D` puerta. Es lo que lleva un tablero del paquete de campaña.
 *
 * Con `preview`, además, `?` donde no se ha sabido leer y `,` en el suelo sin cuadrícula
 * (las mesetas): para enseñarlo, no para guardarlo.
 *
 * @param {CellReading} reading
 * @param {{preview?: boolean}} [options]
 * @returns {string[]}
 */
export function toAsciiRows(reading, options = {}) {
    const plains = new Set(reading.plains.map(c => cellKey(c.x, c.y)));
    /** @type {string[]} */
    const rows = [];
    for (let y = 0; y < reading.rows; y++) {
        let row = '';
        for (let x = 0; x < reading.cols; x++) {
            const i = y * reading.cols + x;
            const kind = reading.kinds[i];
            if (options.preview && reading.notes[i].startsWith('dudosa')) {
                row += '?';
                continue;
            }
            if (options.preview && kind === 'floor' && plains.has(cellKey(x, y))) {
                row += ',';
                continue;
            }
            const type = KIND_TERRAIN[kind] ?? 'floor';
            row += type === 'floor' ? '.' : (TERRAIN_CHAR[type] ?? '.');
        }
        rows.push(row);
    }
    return rows;
}

/**
 * El suelo sin cuadrícula, por trozos: cada meseta o saliente por separado, del más grande al
 * más pequeño. Es lo que se ofrece para darle altura.
 *
 * @param {CellReading} reading
 * @returns {Array<{cells: Array<{x: number, y: number}>}>}
 */
export function plainGroups(reading) {
    const plain = new Set(reading.plains.map(c => c.y * reading.cols + c.x));
    return groupsOf(reading.cols, reading.rows, i => plain.has(i))
        .sort((a, b) => b.length - a.length)
        .map(group => ({ cells: group.map(i => ({ x: i % reading.cols, y: Math.floor(i / reading.cols) })) }));
}

/**
 * La región del dibujo alrededor de una casilla: se inunda desde su centro por los píxeles
 * claros (el papel y la cuadrícula gris) hasta dar con trazo negro, sin salir de las casillas
 * que no son muro. Sirve para pulsar en una sala y ponerle nombre, o en una meseta y darle
 * su altura: el borde lo pone el dibujo, no quien pulsa.
 *
 * Una casilla entra si la inundación cubre al menos la mitad (`cover`): así dos regiones
 * vecinas (la cueva y el risco) nunca se quedan la misma casilla.
 *
 * @param {MapPixels} pixels
 * @param {MapGrid} grid
 * @param {number} cx
 * @param {number} cy
 * @param {{kinds?: CellKind[], cover?: number, pixel?: {x: number, y: number}}} [options]
 *   `kinds`: la lectura, para no escaparse por casillas que ya se sabe que son muro (lo de
 *   fuera del mapa). `pixel`: el punto exacto pulsado en la imagen, si se sabe.
 * @returns {Array<{x: number, y: number}>}
 */
export function regionAt(pixels, grid, cx, cy, options = {}) {
    const { width, height } = pixels;
    const luma = lumaOf(pixels);
    const T = MAP_THRESHOLDS;
    const { cols, rows } = grid;
    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return [];
    const kinds = options.kinds ?? null;
    const cover = Number(options.cover) > 0 ? Number(options.cover) : 0.5;

    const origin = cellBox(grid, 0, 0);
    const left = origin.x0;
    const top = origin.y0;
    const right = Math.min(width, Math.round(grid.offsetX + cols * grid.cell));
    const bottom = Math.min(height, Math.round(grid.offsetY + rows * grid.cell));

    /** Qué casilla es un píxel. */
    const cellOf = (/** @type {number} */ px, /** @type {number} */ py) => ({
        x: Math.min(cols - 1, Math.floor((px - grid.offsetX) / grid.cell)),
        y: Math.min(rows - 1, Math.floor((py - grid.offsetY) / grid.cell)),
    });
    const allowed = (/** @type {number} */ px, /** @type {number} */ py) => {
        if (px < left || py < top || px >= right || py >= bottom) return false;
        if (luma[py * width + px] < T.ink) return false;
        if (!kinds) return true;
        const c = cellOf(px, py);
        return kinds[c.y * cols + c.x] !== 'wall';
    };

    const area = grid.cell * grid.cell;
    /**
     * Inunda desde un píxel y dice qué casillas cubre.
     * @param {number} seed
     * @returns {{cells: Array<{x: number, y: number}>, pixels: number}}
     */
    const floodFrom = (seed) => {
        const seen = new Uint8Array(width * height);
        const counts = new Float64Array(cols * rows);
        const stack = [seed];
        seen[seed] = 1;
        let total = 0;
        while (stack.length > 0) {
            const at = /** @type {number} */ (stack.pop());
            const px = at % width;
            const py = (at - px) / width;
            const c = cellOf(px, py);
            counts[c.y * cols + c.x]++;
            total++;
            if (px + 1 < width && !seen[at + 1] && allowed(px + 1, py)) { seen[at + 1] = 1; stack.push(at + 1); }
            if (px > 0 && !seen[at - 1] && allowed(px - 1, py)) { seen[at - 1] = 1; stack.push(at - 1); }
            if (py + 1 < height && !seen[at + width] && allowed(px, py + 1)) { seen[at + width] = 1; stack.push(at + width); }
            if (py > 0 && !seen[at - width] && allowed(px, py - 1)) { seen[at - width] = 1; stack.push(at - width); }
        }
        /** @type {Array<{x: number, y: number}>} */
        const cells = [];
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                if (counts[y * cols + x] >= area * cover) cells.push({ x, y });
            }
        }
        return { cells, pixels: total };
    };

    // Por dónde empezar. Con un píxel pulsado, por él. Con una casilla, se prueba cada trozo
    // claro que tenga (el centro puede caer en una letra de la etiqueta, «B6», o en una
    // columna) y se queda la región que se queda con la casilla; si ninguna, la más grande.
    // La casilla pulsada entra siempre: es la que ha elegido quien pulsa.
    const pixel = options.pixel;
    /** @type {{cells: Array<{x: number, y: number}>, pixels: number}|null} */
    let best = null;
    if (pixel && allowed(Math.round(pixel.x), Math.round(pixel.y))) {
        best = floodFrom(Math.round(pixel.y) * width + Math.round(pixel.x));
    } else {
        let owns = false;
        for (const seed of cellPatches(grid, cx, cy, width, height, allowed)) {
            const found = floodFrom(seed);
            const hasCell = found.cells.some(c => c.x === cx && c.y === cy);
            if (!best || (hasCell && !owns) || (hasCell === owns && found.pixels > best.pixels)) {
                best = found;
                owns = hasCell;
            }
        }
    }
    if (!best) return [];
    if (!best.cells.some(c => c.x === cx && c.y === cy)) best.cells.push({ x: cx, y: cy });
    return best.cells.sort((a, b) => a.y - b.y || a.x - b.x);
}

/**
 * Un píxel de cada trozo claro de una casilla (sin salir de ella) que ocupe al menos un
 * veinteavo, del más grande al más pequeño.
 *
 * @param {MapGrid} grid
 * @param {number} cx
 * @param {number} cy
 * @param {number} width
 * @param {number} height
 * @param {(px: number, py: number) => boolean} allowed
 * @returns {number[]}
 */
function cellPatches(grid, cx, cy, width, height, allowed) {
    const box = cellBox(grid, cx, cy);
    const x0 = Math.max(0, box.x0);
    const y0 = Math.max(0, box.y0);
    const w = Math.min(width, box.x1) - x0;
    const h = Math.min(height, box.y1) - y0;
    if (w <= 0 || h <= 0) return [];
    const seen = new Uint8Array(w * h);
    /** @type {Array<{seed: number, area: number}>} */
    const patches = [];
    for (let start = 0; start < w * h; start++) {
        if (seen[start] || !allowed(x0 + (start % w), y0 + Math.floor(start / w))) continue;
        const stack = [start];
        seen[start] = 1;
        let area = 0;
        while (stack.length > 0) {
            const at = /** @type {number} */ (stack.pop());
            area++;
            const x = at % w;
            const y = (at - x) / w;
            for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
                if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                const next = ny * w + nx;
                if (seen[next] || !allowed(x0 + nx, y0 + ny)) continue;
                seen[next] = 1;
                stack.push(next);
            }
        }
        if (area >= (w * h) / 20) patches.push({ seed: (y0 + Math.floor(start / w)) * width + x0 + (start % w), area });
    }
    return patches.sort((a, b) => b.area - a.area).map(p => p.seed);
}

/**
 * El trozo de tablero que sale de un mapa en imagen: lo que se pega en un tablero del
 * paquete (`map`) y lo que lleva uno del juego (`terrain`, `gridWidth`, `gridHeight`).
 *
 * @param {CellReading} reading
 * @param {MapGrid} grid
 * @param {{image?: string}} [options] `image`: la ruta del dibujo, desde `public/`.
 * @returns {{image: string, grid: {cell: number, offsetX: number, offsetY: number, cols: number, rows: number}, gridWidth: number, gridHeight: number, map: string[], terrain: import('./terrain.js').BoardTerrain}}
 */
export function toBoardFragment(reading, grid, options = {}) {
    return {
        image: String(options.image ?? ''),
        grid: { cell: grid.cell, offsetX: grid.offsetX, offsetY: grid.offsetY, cols: grid.cols, rows: grid.rows },
        gridWidth: reading.cols,
        gridHeight: reading.rows,
        map: toAsciiRows(reading),
        terrain: toTerrain(reading),
    };
}
