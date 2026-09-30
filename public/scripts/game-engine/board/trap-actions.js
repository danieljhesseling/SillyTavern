/**
 * J12.3: las trampas fuera de combate: buscarlas, desarmarlas y pisarlas andando.
 *
 * `hazards.js` ya sabía buscar en una casilla (`searchCell`), desarmar (`disarmHazard`) y lo
 * que salta al entrar (`enterCell`), pero nada lo usaba fuera de la pelea: el grupo cruzaba un
 * pasillo con una losa hundida y no pasaba nada, y buscar no era una acción. Aquí están las tres
 * cosas como las hace quien juega:
 *
 * - **Buscar** mira las casillas de alrededor (`SEARCH_RADIUS`), con una sola tirada. Lo buscado
 *   se queda buscado: repetir el botón hasta que salga no es buscar.
 * - **Desarmar** solo lo que ya se ha visto y está al lado de alguien. Fallar por mucho la hace
 *   saltar en quien lo intenta.
 * - **Andar** por un camino: la trampa sin ver salta al pisarla y quien anda se queda en ella; si
 *   de camino ve una (su Percepción pasiva), se para para decidir. Las ya vistas no se pisan: el
 *   camino las rodea (`knownTrapCells`).
 *
 * Puro: recibe el tablero y las tiradas ya hechas, y dice lo que pasa. Quien llama tira, cuenta y
 * guarda (`party/board.js`).
 */

import { cellKey, enterCell, hazardsOf, passiveSpot, searchCell, disarmHazard } from './hazards.js';

/** Cuántas casillas alrededor mira quien busca. */
export const SEARCH_RADIUS = 2;

/** Por cuánto hay que fallar al desarmar para que salte. */
export const SPRING_MARGIN = 5;

/**
 * @param {any} value
 * @returns {number}
 */
function num(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Si es algo que hace daño al pisarlo (en una casilla, al entrar): una trampa, o un charco de
 * aceite ardiendo. Una pista de un caso no: pisarla es encontrarla, no hacerse daño.
 *
 * @param {any} hazard
 * @returns {boolean}
 */
function isHazardous(hazard) {
    return hazard?.trigger === 'enter' && hazard.kind !== 'pista' && num(hazard.x) >= 0 && num(hazard.y) >= 0;
}

/**
 * Si es una trampa: lo que se busca y se desarma. Un fuego no se desarma: se rodea.
 *
 * @param {any} hazard
 * @returns {boolean}
 */
function isTrap(hazard) {
    return isHazardous(hazard) && hazard.kind === 'trampa';
}

/**
 * Lo puesto en el tablero con un id cada una: las de un paquete pueden venir sin él, y desarmar
 * va por id.
 *
 * @param {any[]} hazards
 * @returns {any[]}
 */
export function withIds(hazards) {
    return (Array.isArray(hazards) ? hazards : []).map((hazard, index) => (String(hazard?.id ?? '').trim()
        ? hazard
        : { ...hazard, id: `trampa-${index}-${Math.round(num(hazard?.x))}-${Math.round(num(hazard?.y))}` }));
}

/**
 * Las trampas que trae un tablero de un paquete de campaña (`traps`), en la forma de
 * `hazards.js`: cada una en su casilla, sin ver, armada y con su aviso. Se admite `damage` por
 * `damageDice`, como lo escribiría un Gem.
 *
 * @param {any} raw
 * @returns {any[]}
 */
export function trapsFromPack(raw) {
    const list = Array.isArray(raw) ? raw : [];
    return withIds(list
        .filter(t => t && typeof t === 'object' && Number.isFinite(Number(t.x)) && Number.isFinite(Number(t.y)))
        .map(t => {
            const dice = String(t.damageDice ?? t.damage ?? '').trim();
            const effect = String(t.effect ?? '').trim() || (dice ? 'damage' : String(t.condition ?? '').trim() ? 'condition' : 'none');
            return {
                ...t, kind: 'trampa', trigger: 'enter', effect, damageDice: dice,
                x: Math.trunc(Number(t.x)), y: Math.trunc(Number(t.y)), seen: false, armed: true,
            };
        }));
}

/**
 * Las casillas con una trampa ya vista y armada: el camino las rodea.
 *
 * @param {any} board
 * @returns {Set<string>}
 */
export function knownTrapCells(board) {
    return new Set(hazardsOf(board).filter(h => isTrap(h) && h.armed && h.seen).map(h => cellKey(h.x, h.y)));
}

/**
 * Las casillas a `radius` o menos de una, dentro del tablero.
 *
 * @param {{x: number, y: number}} center
 * @param {number} radius
 * @param {number} cols
 * @param {number} rows
 * @returns {Array<{x: number, y: number}>}
 */
function around(center, radius, cols, rows) {
    const cx = Math.round(num(center?.x));
    const cy = Math.round(num(center?.y));
    /** @type {Array<{x: number, y: number}>} */
    const out = [];
    for (let y = cy - radius; y <= cy + radius; y++) {
        for (let x = cx - radius; x <= cx + radius; x++) {
            if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
            out.push({ x, y });
        }
    }
    return out;
}

/**
 * Si alrededor de una casilla queda algo por buscar.
 *
 * @param {Object} input
 * @param {any} input.board
 * @param {{x: number, y: number}} input.center
 * @param {number} input.cols
 * @param {number} input.rows
 * @param {number} [input.radius]
 * @returns {boolean}
 */
export function canSearchAround({ board, center, cols, rows, radius = SEARCH_RADIUS }) {
    const done = new Set(Array.isArray(board?.searchedCells) ? board.searchedCells : []);
    return around(center, radius, cols, rows).some(cell => !done.has(cellKey(cell.x, cell.y)));
}

/**
 * Buscar trampas alrededor de alguien, con una tirada (Percepción, ya sumada).
 *
 * @param {Object} input
 * @param {any} input.board
 * @param {{x: number, y: number}} input.center
 * @param {number} input.roll
 * @param {number} input.cols
 * @param {number} input.rows
 * @param {number} [input.radius]
 * @returns {{fresh: boolean, found: any[], missed: any[], hazards: any[], searched: string[]}}
 *   `fresh`: si había algo sin buscar. `searched`: todas las casillas ya buscadas del tablero.
 */
export function searchAround({ board, center, roll, cols, rows, radius = SEARCH_RADIUS }) {
    const done = Array.isArray(board?.searchedCells) ? board.searchedCells.map(String) : [];
    const already = new Set(done);
    const cells = around(center, radius, cols, rows).filter(cell => !already.has(cellKey(cell.x, cell.y)));
    let hazards = withIds(hazardsOf(board));
    if (cells.length === 0) return { fresh: false, found: [], missed: [], hazards, searched: done };
    /** @type {any[]} */
    const found = [];
    /** @type {any[]} */
    const missed = [];
    for (const cell of cells) {
        const result = searchCell({ hazards }, cell, roll);
        found.push(...result.found.filter(isTrap));
        missed.push(...result.missed.filter(isTrap));
        hazards = result.hazards;
    }
    return { fresh: true, found, missed, hazards, searched: [...done, ...cells.map(cell => cellKey(cell.x, cell.y))] };
}

/**
 * Lo que se puede desarmar desde donde está el grupo: lo ya visto, armado, al lado de alguien.
 *
 * @param {any} board
 * @param {Array<{x: number, y: number}>} positions Donde está cada uno del grupo (vivo).
 * @returns {Array<{hazard: any, by: number}>} `by`: el índice en `positions` de quien está al lado.
 */
export function disarmable(board, positions) {
    const at = Array.isArray(positions) ? positions : [];
    /** @type {Array<{hazard: any, by: number}>} */
    const out = [];
    for (const hazard of withIds(hazardsOf(board))) {
        if (!isTrap(hazard) || !hazard.armed || !hazard.seen) continue;
        const by = at.findIndex(p => Math.max(Math.abs(num(p?.x) - hazard.x), Math.abs(num(p?.y) - hazard.y)) <= 1);
        if (by >= 0) out.push({ hazard, by });
    }
    return out;
}

/**
 * Intentar desarmar una trampa ya vista, con la tirada hecha.
 *
 * @param {any} board
 * @param {string} id
 * @param {number} roll
 * @returns {{ok: boolean, sprung: boolean, hazard: any|null, hazards: any[], reason: string}}
 *   `sprung`: falló por `SPRING_MARGIN` o más, y la trampa salta en quien la tocaba.
 */
export function tryDisarm(board, id, roll) {
    const all = withIds(hazardsOf(board));
    const result = disarmHazard({ hazards: all }, id, roll);
    const target = all.find(h => h.id === String(id ?? '').trim()) ?? null;
    const sprung = !result.ok && Boolean(target?.armed && target.seen) && num(roll) <= num(target?.disarmDC) - SPRING_MARGIN;
    if (!sprung) return { ok: result.ok, sprung: false, hazard: target, hazards: result.hazards, reason: result.reason };
    // Salta y se descubre (ya lo estaba); si era de una vez, se acaba ahí.
    const fired = enterCell({ hazards: all }, { x: target.x, y: target.y });
    return { ok: false, sprung: true, hazard: target, hazards: fired.hazards, reason: `Se toca donde no se debe: ${target.name} salta.` };
}

/**
 * Andar por un camino con trampas.
 *
 * - Una trampa ya vista en el camino: se para en la casilla de antes (el camino debió rodearla).
 * - Una sin ver: salta al pisarla, y quien anda se queda en ella.
 * - Una pista de un caso: se encuentra al pisarla, sin pararse.
 * - Lo que se ve de camino (Percepción pasiva, las casillas de al lado): se para ahí.
 *
 * @param {Object} input
 * @param {any} input.board
 * @param {Array<{x: number, y: number}>} input.path Con la casilla de salida.
 * @param {number} input.passive La Percepción pasiva de quien anda.
 * @returns {{stopAt: number, fired: any[], clues: any[], spotted: any[], blockedBy: any|null, hazards: any[]}}
 *   `stopAt`: el índice del camino donde se queda (0, si no llega a moverse).
 */
export function walkPath({ board, path, passive }) {
    const steps = Array.isArray(path) ? path : [];
    let hazards = withIds(hazardsOf(board));
    /** @type {any[]} */
    const clues = [];
    const done = (/** @type {number} */ stopAt, /** @type {Partial<{fired: any[], spotted: any[], blockedBy: any}>} */ extra = {}) => ({
        stopAt, fired: extra.fired ?? [], clues, spotted: extra.spotted ?? [], blockedBy: extra.blockedBy ?? null, hazards,
    });
    for (let index = 1; index < steps.length; index++) {
        const cell = { x: Math.round(num(steps[index]?.x)), y: Math.round(num(steps[index]?.y)) };
        const key = cellKey(cell.x, cell.y);
        const known = hazards.find(h => isTrap(h) && h.armed && h.seen && cellKey(h.x, h.y) === key);
        if (known) return done(index - 1, { blockedBy: known });
        const entered = enterCell({ hazards }, cell);
        hazards = entered.hazards;
        clues.push(...entered.fired.filter(h => h.kind === 'pista'));
        // Una trampa salta al pisarla, esté donde esté del camino. Lo demás que quema (un charco
        // de aceite ardiendo) se cruza como siempre: solo hace daño si se acaba encima.
        const last = index === steps.length - 1;
        const fired = entered.fired.filter(h => (last ? isHazardous(h) : isTrap(h)));
        if (fired.length > 0) return done(index, { fired });
        const seen = passiveSpot({ hazards }, cell, passive);
        hazards = seen.hazards;
        const spotted = seen.spotted.filter(isTrap);
        if (spotted.length > 0) return done(index, { spotted });
    }
    return done(Math.max(0, steps.length - 1));
}
