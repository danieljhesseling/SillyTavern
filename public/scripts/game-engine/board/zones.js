/**
 * Las salas con nombre de un tablero (J12.11 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * Un mapa de mazmorra rotula sus salas —B1, B2… A, C— y el libro cuenta qué hay en cada una:
 * quién espera, qué se encuentra, el texto que se lee al entrar. Aquí una **zona** es eso: un
 * nombre, unas casillas y una nota.
 *
 * Las casillas se escriben de dos maneras, la que sea más cómoda:
 *
 * - `rect`: `{x, y, width, height}`, para una sala cuadrada;
 * - `cells`: `["3,4", "4,4", …]` (o `{x, y}`), para una cueva, o para lo que sale de pulsar
 *   en el dibujo (`regionAt` de `map-image.js`).
 *
 * Se trabaja sobre el mapa **con** etiquetas y se juega sobre el **limpio**: las zonas no
 * dependen de la imagen, solo de la cuadrícula, así que valen para las dos versiones.
 *
 * No se leen las etiquetas del dibujo (eso sería leer letras): quien crea el tablero pulsa en
 * la sala y le pone nombre.
 *
 * Puro: sin DOM ni estado.
 */

import { cellKey, parseCellKey, getCellDefinition } from './terrain.js';

/**
 * @typedef {Object} BoardZone
 * @property {string} name  Único en el tablero: B1, «La capilla».
 * @property {string[]} [cells] Casillas `"x,y"`.
 * @property {{x: number, y: number, width: number, height: number}} [rect]
 * @property {string} [note] Lo que hay: quién espera, qué se encuentra, el texto de la sala.
 */

/**
 * @typedef {Object} ZoneIssue
 * @property {string} path
 * @property {string} message
 */

/** Como mucho tantas casillas por zona: una errata en un `rect` no debe crear un millón. */
const MAX_ZONE_CELLS = 10000;

/**
 * Una casilla escrita como `"x,y"`, `{x, y}` o `[x, y]`, en su clave; o nada.
 *
 * @param {any} value
 * @returns {string|null}
 */
function keyOf(value) {
    if (typeof value === 'string') {
        const at = parseCellKey(value.replace(/\s+/g, ''));
        return at ? cellKey(at.x, at.y) : null;
    }
    if (Array.isArray(value) && value.length >= 2) {
        const [x, y] = value.map(Number);
        return Number.isInteger(x) && Number.isInteger(y) ? cellKey(x, y) : null;
    }
    if (value && typeof value === 'object') {
        const x = Number(value.x);
        const y = Number(value.y);
        return Number.isInteger(x) && Number.isInteger(y) ? cellKey(x, y) : null;
    }
    return null;
}

/**
 * Un rectángulo bien formado, o nada.
 *
 * @param {any} raw
 * @returns {{x: number, y: number, width: number, height: number}|null}
 */
function rectOf(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const rect = {
        x: Math.trunc(Number(raw.x)),
        y: Math.trunc(Number(raw.y)),
        width: Math.trunc(Number(raw.width ?? raw.w)),
        height: Math.trunc(Number(raw.height ?? raw.h)),
    };
    if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)) return null;
    if (rect.width < 1 || rect.height < 1 || rect.width * rect.height > MAX_ZONE_CELLS) return null;
    return rect;
}

/**
 * Las zonas leídas de disco. Lo que no tiene forma se tira; lo que tiene forma se deja como
 * se escribió (un `rect` sigue siendo un `rect`), para que el JSON siga siendo legible.
 *
 * @param {any} raw
 * @returns {BoardZone[]}
 */
export function normalizeZones(raw) {
    return (Array.isArray(raw) ? raw : [])
        .filter(zone => zone && typeof zone === 'object')
        .map(zone => {
            /** @type {BoardZone} */
            const out = { name: String(zone.name ?? '').trim() };
            const rect = rectOf(zone.rect);
            if (rect) out.rect = rect;
            const cells = [...new Set((Array.isArray(zone.cells) ? zone.cells : []).map(keyOf).filter(Boolean))];
            if (cells.length > 0) out.cells = /** @type {string[]} */ (cells);
            const note = String(zone.note ?? '').trim();
            if (note) out.note = note;
            return out;
        });
}

/**
 * Las casillas de una zona, juntando el `rect` y las `cells`.
 *
 * @param {BoardZone} zone
 * @returns {string[]}
 */
export function zoneCells(zone) {
    const cells = new Set(zone?.cells ?? []);
    const rect = rectOf(zone?.rect);
    if (rect) {
        for (let y = rect.y; y < rect.y + rect.height; y++) {
            for (let x = rect.x; x < rect.x + rect.width; x++) cells.add(cellKey(x, y));
        }
    }
    return [...cells];
}

/**
 * Una zona hecha de las casillas que se han pulsado (o de una región del dibujo).
 *
 * @param {string} name
 * @param {Array<{x: number, y: number}|string>} cells
 * @param {string} [note]
 * @returns {BoardZone}
 */
export function zoneFromCells(name, cells, note = '') {
    return normalizeZones([{ name, cells, note }])[0];
}

/**
 * La zona en la que cae una casilla. Si caen dos (una sala dentro de otra: «el altar» dentro
 * de «la capilla»), la más pequeña, que es la que dice más.
 *
 * @param {{zones?: any}|any[]|null|undefined} board El tablero, o directamente sus zonas.
 * @param {number} x
 * @param {number} y
 * @returns {BoardZone|null}
 */
export function zoneAt(board, x, y) {
    const zones = normalizeZones(Array.isArray(board) ? board : board?.zones);
    const key = cellKey(x, y);
    let best = null;
    let bestSize = Infinity;
    for (const zone of zones) {
        const cells = zoneCells(zone);
        if (cells.includes(key) && cells.length < bestSize) {
            best = zone;
            bestSize = cells.length;
        }
    }
    return best;
}

/**
 * Lo que está mal en las zonas de un tablero, en palabras de quien las escribe.
 *
 * - **Errores**: una zona sin nombre, repetida, vacía o con casillas fuera del tablero.
 * - **Avisos**: dos zonas que se pisan sin que una esté dentro de la otra, o una zona que
 *   está entera sobre muro (casi siempre, la cuadrícula corrida).
 *
 * @param {any} zones
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @param {{path?: string, terrain?: any}} [options] `path`: dónde están, para los mensajes.
 * @returns {{errors: ZoneIssue[], warnings: ZoneIssue[]}}
 */
export function validateZones(zones, gridWidth, gridHeight, options = {}) {
    const base = options.path ?? 'zones';
    /** @type {ZoneIssue[]} */
    const errors = [];
    /** @type {ZoneIssue[]} */
    const warnings = [];
    if (zones === undefined || zones === null) return { errors, warnings };
    if (!Array.isArray(zones)) {
        errors.push({ path: base, message: 'Las zonas van en una lista: [{ "name": "B1", "rect": {…} }, …].' });
        return { errors, warnings };
    }

    const names = new Set();
    /** @type {Array<{name: string, cells: Set<string>}>} */
    const seen = [];
    zones.forEach((raw, index) => {
        const path = `${base}[${index}]`;
        const [zone] = normalizeZones([raw]);
        if (!zone) {
            errors.push({ path, message: 'Una zona es un objeto con `name` y `rect` o `cells`.' });
            return;
        }
        if (!zone.name) errors.push({ path, message: 'Sin nombre: una zona se llama como su sala (B1, «La capilla»).' });
        else if (names.has(zone.name.toLowerCase())) errors.push({ path, message: `"${zone.name}" está repetida.` });
        names.add(zone.name.toLowerCase());

        if (raw?.rect !== undefined && !zone.rect) {
            errors.push({ path: `${path}.rect`, message: 'El rectángulo necesita x, y, width y height, con ancho y alto de al menos 1.' });
        }
        const dropped = (Array.isArray(raw?.cells) ? raw.cells : []).filter((/** @type {any} */ c) => !keyOf(c));
        if (dropped.length > 0) {
            errors.push({ path: `${path}.cells`, message: `${dropped.length} casilla(s) no se entienden: se escriben "x,y".` });
        }

        const cells = zoneCells(zone);
        if (cells.length === 0) {
            errors.push({ path, message: `"${zone.name || 'La zona'}" no tiene casillas: dale un \`rect\` o unas \`cells\`.` });
            return;
        }
        const outside = cells.filter(key => {
            const at = /** @type {{x: number, y: number}} */ (parseCellKey(key));
            return at.x < 0 || at.y < 0 || at.x >= gridWidth || at.y >= gridHeight;
        });
        if (outside.length > 0) {
            errors.push({
                path,
                message: `"${zone.name}" tiene ${outside.length} casilla(s) fuera del tablero, que mide ${gridWidth}×${gridHeight}: ${outside.slice(0, 4).join(' ')}${outside.length > 4 ? '…' : ''}.`,
            });
        }
        if (options.terrain) {
            const onWall = cells.filter(key => {
                const at = /** @type {{x: number, y: number}} */ (parseCellKey(key));
                return getCellDefinition(options.terrain, at.x, at.y).blocksMovement;
            });
            if (onWall.length === cells.length) {
                warnings.push({ path, message: `"${zone.name}" cae entera sobre muro: ¿la cuadrícula está corrida?` });
            }
        }

        const own = new Set(cells);
        for (const other of seen) {
            const shared = cells.filter(key => other.cells.has(key)).length;
            if (shared === 0) continue;
            const nested = shared === own.size || shared === other.cells.size;
            if (!nested) {
                warnings.push({ path, message: `"${zone.name}" y "${other.name}" comparten ${shared} casilla(s) sin que una esté dentro de la otra.` });
            }
        }
        seen.push({ name: zone.name, cells: own });
    });
    return { errors, warnings };
}

/**
 * Pone a las salas del tablero (las que `deriveRooms` saca del terreno, sin nombre) el nombre
 * de la zona que más casillas les cubre, si les cubre al menos la mitad. Así «habéis entrado
 * en B3» sale del mismo sitio que la niebla de las salas.
 *
 * @template {{cells: string[], name?: string}} R
 * @param {R[]} rooms
 * @param {any} zones
 * @returns {R[]}
 */
export function nameRoomsFromZones(rooms, zones) {
    const list = normalizeZones(zones).map(zone => ({ name: zone.name, cells: new Set(zoneCells(zone)) }))
        .filter(zone => zone.name);
    if (list.length === 0) return Array.isArray(rooms) ? rooms : [];
    return (Array.isArray(rooms) ? rooms : []).map(room => {
        if (room?.name) return room;
        let best = null;
        let bestShared = 0;
        for (const zone of list) {
            const shared = (room.cells ?? []).filter(key => zone.cells.has(key)).length;
            if (shared > bestShared) {
                best = zone;
                bestShared = shared;
            }
        }
        return best && bestShared * 2 >= (room.cells ?? []).length ? { ...room, name: best.name } : room;
    });
}
