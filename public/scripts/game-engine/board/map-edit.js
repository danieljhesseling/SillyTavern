/**
 * La pantalla que convierte un mapa en imagen en un tablero (J12.8 a J12.11 de
 * wiki/ROADMAP_SIN_CONEXION.md): lo que decide, sin dibujar nada.
 *
 * `map-image.js` lee el dibujo (la cuadrícula, qué es cada casilla, una región pulsando). Aquí
 * está lo que hace quien crea el tablero con esa lectura: pintar encima, poner nombre a las
 * salas, dar altura a las mesetas y, al final, sacar lo que se guarda en el tablero.
 *
 * El terreno se lleva mientras se edita como filas de texto (`#` muro, `.` suelo…), la misma
 * leyenda que `terrainFromAsciiMap`: pintar es cambiar un carácter, y lo que se guarda sale de
 * ahí sin traducciones a medias.
 *
 * Lo que se guarda (`boardFromEdit`) va pensado para que la vista del tablero no cambie: la
 * imagen se recorta a la cuadrícula (`gridCrop`), así que cada casilla del tablero cae sobre una
 * del dibujo repartiendo la imagen entera, que es lo que ya hace `renderLocationView`.
 *
 * Puro: sin DOM ni estado.
 */

import { ASCII_TERRAIN, cellKey, normalizeTerrain, parseCellKey, terrainFromAsciiMap } from './terrain.js';
import { gridCrop, normalizeBoardGrid, toAsciiRows } from './map-image.js';
import { normalizeZones, validateZones, zoneCells } from './zones.js';
import { CLIFF_FEET, normalizeElevation, setElevation } from './heights.js';
import { asciiFromTerrain } from '../campaign/campaign-export.js';

/**
 * @typedef {import('./map-image.js').MapGrid} MapGrid
 * @typedef {import('./map-image.js').CellReading} CellReading
 * @typedef {import('./zones.js').BoardZone} BoardZone
 */

/**
 * @typedef {Object} ReadingMarks
 * @property {string[]} doubtful Casillas `"x,y"` que la lectura no ha tenido claras.
 * @property {string[]} doors    Puertas propuestas.
 * @property {string[]} bridges  Puentes propuestos.
 * @property {string[]} plains   Suelo sin cuadrícula: mesetas o salientes, para darles altura.
 * @property {Record<string, string>} notes Por qué se ha decidido cada casilla que no es evidente.
 */

/**
 * Lo que se puede pintar encima del mapa, en el orden en que se ofrece: los pinceles del editor
 * de tableros del taller (`BRUSHES` de `campaign/board-draft.js`), sin «empieza el grupo» (aquí
 * no toca) ni el barril (un objeto, no el dibujo del suelo).
 */
export const MAP_BRUSHES = [
    { id: '.', label: 'Suelo' },
    { id: '#', label: 'Muro' },
    { id: 'D', label: 'Puerta' },
    { id: '~', label: 'Terreno difícil' },
    { id: 'c', label: 'Cobertura' },
    { id: 'C', label: 'Cobertura alta' },
    { id: 'w', label: 'Agua' },
    { id: 'x', label: 'Salida' },
];

/** Cómo se llama cada carácter, para decir qué es la casilla bajo el ratón. */
const CHAR_WORDS = {
    '.': 'Suelo', '#': 'Muro', 'D': 'Puerta', 'L': 'Puerta con llave', 'o': 'Puerta abierta',
    '~': 'Terreno difícil', 'c': 'Cobertura', 'C': 'Cobertura alta', 'v': 'Sima', '>': 'Escalera',
    'w': 'Agua', 'i': 'Hielo', 'b': 'Maleza', 'T': 'Barril', 'k': 'Cofre', '^': 'En alto',
    'x': 'Salida', 'P': 'Palanca', '=': 'Barricada',
};

/**
 * Qué es un carácter del mapa, dicho corto.
 *
 * @param {string} char
 * @returns {string}
 */
export function charWord(char) {
    return CHAR_WORDS[char] ?? 'Suelo';
}

/**
 * Las marcas de una lectura, por casilla: lo dudoso y lo propuesto.
 *
 * @param {CellReading} reading
 * @returns {ReadingMarks}
 */
export function readingMarks(reading) {
    const keyOf = (/** @type {number} */ i) => cellKey(i % reading.cols, Math.floor(i / reading.cols));
    /** @type {Record<string, string>} */
    const notes = {};
    /** @type {string[]} */
    const doubtful = [];
    reading.notes.forEach((note, i) => {
        if (!note) return;
        notes[keyOf(i)] = note;
        if (note.startsWith('dudosa')) doubtful.push(keyOf(i));
    });
    const keys = (/** @type {Array<{x: number, y: number}>} */ cells) => cells.map(c => cellKey(c.x, c.y));
    return { doubtful, doors: keys(reading.doors), bridges: keys(reading.bridges), plains: keys(reading.plains), notes };
}

/**
 * El mapa leído, en filas de texto, listo para pintar encima.
 *
 * @param {CellReading} reading
 * @returns {string[]}
 */
export function rowsFromReading(reading) {
    return toAsciiRows(reading);
}

/**
 * Pintar una casilla. Lo que no cambia nada devuelve las mismas filas (el mismo objeto), así
 * quien pinta sabe que no hay que redibujar.
 *
 * @param {string[]} rows
 * @param {number} x
 * @param {number} y
 * @param {string} char Un carácter de la leyenda de `terrainFromAsciiMap`, o `.` para suelo.
 * @returns {string[]}
 */
export function paintAt(rows, x, y, char) {
    if (y < 0 || y >= rows.length || x < 0 || x >= rows[y].length) return rows;
    const value = char === '.' || Object.prototype.hasOwnProperty.call(ASCII_TERRAIN, char) ? char : null;
    if (value === null || rows[y][x] === value) return rows;
    const out = [...rows];
    out[y] = rows[y].slice(0, x) + value + rows[y].slice(x + 1);
    return out;
}

/**
 * Lo que `regionAt` necesita saber del mapa pintado: por dónde no se escapa la región. El muro,
 * y también las puertas: una puerta separa dos salas, pero en el dibujo es un rectángulo
 * sobre la línea con el paso abierto alrededor, y sin esto la sala se sale por ahí a la de al
 * lado.
 *
 * @param {string[]} rows
 * @returns {import('./map-image.js').CellKind[]}
 */
export function kindsFromRows(rows) {
    /** @type {import('./map-image.js').CellKind[]} */
    const kinds = [];
    for (const row of rows) {
        for (const char of row) {
            kinds.push(char === '#' || char === 'D' || char === 'L' || char === 'o' ? 'wall' : char === '~' ? 'rough' : 'floor');
        }
    }
    return kinds;
}

/**
 * Cuántas casillas hay de cada cosa.
 *
 * @param {string[]} rows
 * @returns {{floor: number, wall: number, rough: number, door: number, other: number}}
 */
export function countRows(rows) {
    const counts = { floor: 0, wall: 0, rough: 0, door: 0, other: 0 };
    for (const row of rows) {
        for (const char of row) {
            if (char === '.') counts.floor++;
            else if (char === '#') counts.wall++;
            else if (char === '~') counts.rough++;
            else if (char === 'D' || char === 'L' || char === 'o') counts.door++;
            else counts.other++;
        }
    }
    return counts;
}

/**
 * El mapa leído, dicho en una línea: «Suelo 486 · Muro 390 · Terreno difícil 13 · Puertas 11».
 *
 * @param {string[]} rows
 * @returns {string}
 */
export function describeRows(rows) {
    const c = countRows(rows);
    return [
        `Suelo ${c.floor}`, `Muro ${c.wall}`,
        c.rough ? `Terreno difícil ${c.rough}` : '',
        c.door ? `Puertas ${c.door}` : '',
        c.other ? `Otras ${c.other}` : '',
    ].filter(Boolean).join(' · ');
}

/**
 * La cuadrícula, dicha para quien la ajusta: el lado, cuántas casillas y si se ve clara.
 *
 * @param {MapGrid} grid
 * @returns {string}
 */
export function describeGrid(grid) {
    if (!grid || !(grid.cell > 0) || !grid.cols || !grid.rows) {
        return 'No se ha encontrado la cuadrícula. Dila a mano o marca una casilla.';
    }
    const px = String(Math.round(grid.cell * 10) / 10).replace('.', ',');
    const size = `Casillas de ${px} px · ${grid.cols} × ${grid.rows}.`;
    if (grid.source === 'manual') return size;
    const confidence = Number(grid.confidence ?? 0);
    if (confidence >= 0.5) return `${size} Se ve clara.`;
    if (confidence >= 0.25) return `${size} Se ve a medias: compruébala.`;
    return `${size} No se ve bien: ajústala a mano.`;
}

/**
 * La cuadrícula que corresponde a la imagen ya recortada (`gridCrop`): empieza casi en la
 * esquina (lo que queda es menos de medio píxel del redondeo) y tiene las mismas casillas.
 *
 * @param {MapGrid} grid
 * @returns {{cell: number, offsetX: number, offsetY: number, cols: number, rows: number}}
 */
export function croppedGrid(grid) {
    const crop = gridCrop(grid);
    const rest = (/** @type {number} */ value) => Math.max(0, Math.round(value * 100) / 100);
    return {
        cell: grid.cell,
        offsetX: rest(grid.offsetX - crop.x),
        offsetY: rest(grid.offsetY - crop.y),
        cols: grid.cols,
        rows: grid.rows,
    };
}

/**
 * La misma cuadrícula sobre otra versión del dibujo (la limpia, sin etiquetas: J12.11). Si
 * mide lo mismo, la misma; si es el mismo dibujo a otra escala, escalada. Si no guarda la
 * proporción, no es el mismo mapa, y se dice con `null`.
 *
 * @param {MapGrid} grid
 * @param {{width: number, height: number}} from La imagen sobre la que se ajustó.
 * @param {{width: number, height: number}} to   La otra.
 * @returns {MapGrid|null}
 */
export function gridForOtherImage(grid, from, to) {
    if (!(from?.width > 0) || !(from?.height > 0) || !(to?.width > 0) || !(to?.height > 0)) return null;
    const sx = to.width / from.width;
    const sy = to.height / from.height;
    if (Math.abs(sx - sy) > 0.01 * Math.max(sx, sy)) return null;
    if (sx === 1 && sy === 1) return { ...grid };
    const round = (/** @type {number} */ value) => Math.round(value * 100) / 100;
    return { ...grid, cell: round(grid.cell * sx), offsetX: round(grid.offsetX * sx), offsetY: round(grid.offsetY * sy) };
}

/**
 * La cuadrícula de un tablero que ya existe, sobre su imagen, para volver a retocarlo. Con
 * `grid` guardado, esa; si no, la imagen entera repartida entre sus casillas (`gridWidth` ×
 * `gridHeight`), que es como la pinta la vista del tablero.
 *
 * @param {any} board
 * @param {number} width  Ancho de la imagen en píxeles.
 * @param {number} height Alto.
 * @returns {MapGrid|null}
 */
export function gridFromBoard(board, width, height) {
    const saved = normalizeBoardGrid(board?.grid);
    const cols = Math.floor(Number(saved?.cols ?? board?.gridWidth) || 0);
    const rows = Math.floor(Number(saved?.rows ?? board?.gridHeight) || 0);
    if (cols < 1 || rows < 1 || !(width > 0) || !(height > 0)) return null;
    if (saved) return { ...saved, cols, rows, confidence: 1, source: 'manual' };
    return { cell: Math.round((width / cols) * 100) / 100, offsetX: 0, offsetY: 0, cols, rows, confidence: 1, source: 'manual' };
}

/**
 * Las filas de texto de un tablero que ya existe.
 *
 * @param {any} board
 * @param {number} cols
 * @param {number} rows
 * @returns {string[]}
 */
export function rowsFromBoard(board, cols, rows) {
    return asciiFromTerrain(normalizeTerrain(board?.terrain), cols, rows);
}

/**
 * Qué zona tiene una casilla: su posición en la lista, o -1.
 *
 * @param {BoardZone[]} zones
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export function zoneIndexAt(zones, x, y) {
    const key = cellKey(x, y);
    let best = -1;
    let bestSize = Infinity;
    (zones ?? []).forEach((zone, i) => {
        const cells = zoneCells(zone);
        if (cells.includes(key) && cells.length < bestSize) {
            best = i;
            bestSize = cells.length;
        }
    });
    return best;
}

/**
 * Guardar una sala: nueva o la que se está cambiando (`editing`, su posición). Un nombre que ya
 * tiene otra sala no se admite: dos «B1» en el mismo tablero no se distinguen.
 *
 * @param {BoardZone[]} zones
 * @param {{name: string, cells: Array<{x: number, y: number}|string>, note?: string}} zone
 * @param {number} [editing] -1 (o nada) para una sala nueva.
 * @returns {{zones: BoardZone[], error: string}}
 */
export function saveZone(zones, zone, editing = -1) {
    const name = String(zone?.name ?? '').trim();
    const list = normalizeZones(zones);
    if (!name) return { zones: list, error: 'Ponle un nombre a la sala (B1, «La capilla»).' };
    const taken = list.findIndex((other, i) => i !== editing && other.name.toLowerCase() === name.toLowerCase());
    if (taken >= 0) return { zones: list, error: `Ya hay una sala «${list[taken].name}».` };
    const [clean] = normalizeZones([{ name, cells: zone.cells, note: zone.note }]);
    if (!clean.cells || clean.cells.length === 0) return { zones: list, error: 'Pulsa antes en la sala del mapa.' };
    const out = [...list];
    if (editing >= 0 && editing < out.length) out[editing] = clean;
    else out.push(clean);
    return { zones: out, error: '' };
}

/**
 * Quitar una sala.
 *
 * @param {BoardZone[]} zones
 * @param {number} index
 * @returns {BoardZone[]}
 */
export function removeZone(zones, index) {
    return normalizeZones(zones).filter((unused, i) => i !== index);
}

/**
 * Lo que hay que decir de las salas: repetidas, fuera del tablero o sobre muro.
 *
 * @param {BoardZone[]} zones
 * @param {string[]} rows
 * @returns {string[]}
 */
export function zoneProblems(zones, rows) {
    const width = rows[0]?.length ?? 0;
    const found = validateZones(zones, width, rows.length, { terrain: terrainFromAsciiMap(rows) });
    return [...found.errors, ...found.warnings].map(issue => issue.message);
}

/**
 * Dar una altura a unas casillas. 0 las devuelve al suelo.
 *
 * @param {Record<string, number>} elevation
 * @param {Array<{x: number, y: number}|string>} cells
 * @param {number} feet
 * @returns {Record<string, number>}
 */
export function applyHeight(elevation, cells, feet) {
    return setElevation(elevation, cells, feet);
}

/**
 * Las alturas, por trozos: cada grupo de casillas vecinas a la misma altura, con su centro
 * (para poner «+60» encima) y cuántas casillas tiene. Del más grande al más pequeño.
 *
 * @param {Record<string, number>} elevation
 * @returns {Array<{feet: number, cells: Array<{x: number, y: number}>, x: number, y: number}>}
 */
export function heightGroups(elevation) {
    const clean = normalizeElevation(elevation);
    const seen = new Set();
    /** @type {Array<{feet: number, cells: Array<{x: number, y: number}>, x: number, y: number}>} */
    const groups = [];
    for (const key of Object.keys(clean)) {
        if (seen.has(key)) continue;
        const feet = clean[key];
        const start = /** @type {{x: number, y: number}} */ (parseCellKey(key));
        const cells = [start];
        seen.add(key);
        for (let k = 0; k < cells.length; k++) {
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const next = { x: cells[k].x + dx, y: cells[k].y + dy };
                const nextKey = cellKey(next.x, next.y);
                if (seen.has(nextKey) || clean[nextKey] !== feet) continue;
                seen.add(nextKey);
                cells.push(next);
            }
        }
        const x = cells.reduce((sum, c) => sum + c.x, 0) / cells.length;
        const y = cells.reduce((sum, c) => sum + c.y, 0) / cells.length;
        groups.push({ feet, cells, x, y });
    }
    return groups.sort((a, b) => b.cells.length - a.cells.length);
}

/**
 * La altura, dicha: «+60 pies», «−10 pies», «a ras de suelo».
 *
 * @param {number} feet
 * @returns {string}
 */
export function feetWord(feet) {
    const value = Math.round(Number(feet) || 0);
    if (value === 0) return 'a ras de suelo';
    return `${value > 0 ? '+' : '−'}${Math.abs(value)} pies`;
}

/** Diferencia de altura a partir de la cual hay un risco entre dos casillas. */
export const MAP_CLIFF_FEET = CLIFF_FEET;

/**
 * Lo que se guarda en el tablero: la imagen (ya recortada y subida), su cuadrícula, el tamaño,
 * el terreno, las salas y las alturas. Las listas vacías van vacías, para que retocar un mapa
 * y quitar todas sus salas las quite de verdad.
 *
 * @param {{url: string, grid: MapGrid, rows: string[], zones?: BoardZone[], elevation?: Record<string, number>}} edit
 * @returns {{url: string, grid: {cell: number, offsetX: number, offsetY: number, cols: number, rows: number}, gridWidth: number, gridHeight: number, terrain: import('./terrain.js').BoardTerrain, zones: BoardZone[], elevation: Record<string, number>}}
 */
export function boardFromEdit(edit) {
    const width = edit.grid.cols;
    const height = edit.grid.rows;
    const inside = (/** @type {string} */ key) => {
        const at = parseCellKey(key);
        return Boolean(at) && /** @type {{x: number, y: number}} */ (at).x < width && /** @type {{x: number, y: number}} */ (at).y < height;
    };
    const elevation = Object.fromEntries(Object.entries(normalizeElevation(edit.elevation)).filter(([key]) => inside(key)));
    return {
        url: String(edit.url ?? ''),
        grid: croppedGrid(edit.grid),
        gridWidth: width,
        gridHeight: height,
        terrain: terrainFromAsciiMap(edit.rows),
        zones: normalizeZones(edit.zones),
        elevation,
    };
}
