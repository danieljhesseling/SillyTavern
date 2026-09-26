/**
 * ¿Se puede llegar? La pregunta que un libro generado nunca se hace.
 *
 * Un modelo dibuja una mazmorra bonita y deja una sala amurallada por los cuatro costados,
 * con su cofre y sus dos goblins dentro. El mapa valida — es rectangular, tiene su borde de
 * muro, los enemigos están sobre suelo — y **no se nota hasta que estás dentro buscando la
 * puerta que no existe**. Media hora de partida tirada.
 *
 * Esto es una inundación desde donde empieza el grupo: lo que no se moja, no se alcanza.
 *
 * **Las puertas cerradas no cortan la inundación.** Una puerta se abre; un muro no. Para
 * saber si una sala es *alcanzable* hay que contar las puertas como pasos, o toda mazmorra
 * con ritmo de Gloomhaven saldría rota.
 *
 * Puro, y del lado del motor: usa la misma tabla de terreno que el tablero.
 *
 * Ver wiki/archivo/PROPUESTAS_MEJORA_V2.md, PROP2-039.
 */

import { cellKey, getCell, isInsideGrid, TERRAIN_TYPES } from './terrain.js';

/** Los ocho vecinos, porque el tablero se mueve en diagonal. */
const STEPS = [
    [0, -1], [1, 0], [0, 1], [-1, 0],
    [1, -1], [1, 1], [-1, 1], [-1, -1],
];

/**
 * Si se puede poner un pie ahí, contando una puerta cerrada como abrible.
 *
 * @param {any} terrain
 * @param {number} x
 * @param {number} y
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {boolean}
 */
export function isWalkableEventually(terrain, x, y, gridWidth, gridHeight) {
    if (!isInsideGrid(x, y, gridWidth, gridHeight)) return false;

    const cell = getCell(terrain, x, y);
    if (cell.type === 'door') return true;

    const definition = TERRAIN_TYPES[cell.type];
    return !definition?.blocksMovement;
}

/**
 * Todas las casillas que se alcanzan desde donde empieza el grupo.
 *
 * @param {Object} input
 * @param {any} input.terrain
 * @param {number} input.gridWidth
 * @param {number} input.gridHeight
 * @param {Array<{x: number, y: number}>} input.starts
 * @returns {Set<string>}
 */
export function floodFrom({ terrain, gridWidth, gridHeight, starts }) {
    /** @type {Set<string>} */
    const seen = new Set();
    /** @type {Array<{x: number, y: number}>} */
    const queue = [];

    for (const start of (Array.isArray(starts) ? starts : [])) {
        const x = Math.floor(Number(start?.x) || 0);
        const y = Math.floor(Number(start?.y) || 0);
        if (!isWalkableEventually(terrain, x, y, gridWidth, gridHeight)) continue;
        const key = cellKey(x, y);
        if (seen.has(key)) continue;
        seen.add(key);
        queue.push({ x, y });
    }

    while (queue.length > 0) {
        const current = /** @type {{x: number, y: number}} */ (queue.shift());
        for (const [dx, dy] of STEPS) {
            const nx = current.x + dx;
            const ny = current.y + dy;
            if (!isWalkableEventually(terrain, nx, ny, gridWidth, gridHeight)) continue;

            // Una diagonal no se cuela entre dos muros en contacto: si por ahí no cabe un
            // personaje al jugar, tampoco debería contar como alcanzable al comprobarlo.
            if (dx !== 0 && dy !== 0) {
                const sideA = isWalkableEventually(terrain, nx, current.y, gridWidth, gridHeight);
                const sideB = isWalkableEventually(terrain, current.x, ny, gridWidth, gridHeight);
                if (!sideA && !sideB) continue;
            }

            const key = cellKey(nx, ny);
            if (seen.has(key)) continue;
            seen.add(key);
            queue.push({ x: nx, y: ny });
        }
    }

    return seen;
}

/**
 * Lo que queda incomunicado en un tablero.
 *
 * Devuelve tres cosas por separado porque son tres problemas distintos: una casilla suelta
 * sin salida es una rareza, un enemigo al que no se puede llegar es un objetivo imposible,
 * y un trozo grande de mapa aislado es una sala que el autor creyó conectada.
 *
 * @param {Object} input
 * @param {any} input.terrain
 * @param {number} input.gridWidth
 * @param {number} input.gridHeight
 * @param {Array<{x: number, y: number}>} input.starts
 * @param {Array<{name?: string, x: number, y: number}>} [input.enemies]
 * @param {Array<{x: number, y: number}>} [input.cells] Otras casillas que tienen que alcanzarse.
 * @returns {{
 *   reachable: number, total: number, orphanCells: number,
 *   enemies: Array<{name: string, x: number, y: number}>,
 *   cells: Array<{x: number, y: number}>,
 * }}
 */
export function findUnreachable({ terrain, gridWidth, gridHeight, starts, enemies = [], cells = [] }) {
    const reached = floodFrom({ terrain, gridWidth, gridHeight, starts });

    let total = 0;
    let orphanCells = 0;
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            if (!isWalkableEventually(terrain, x, y, gridWidth, gridHeight)) continue;
            total += 1;
            if (!reached.has(cellKey(x, y))) orphanCells += 1;
        }
    }

    return {
        reachable: reached.size,
        total,
        orphanCells,
        enemies: (Array.isArray(enemies) ? enemies : [])
            .filter(enemy => enemy && !reached.has(cellKey(Number(enemy.x) || 0, Number(enemy.y) || 0)))
            .map(enemy => ({ name: String(enemy.name ?? ''), x: Number(enemy.x) || 0, y: Number(enemy.y) || 0 })),
        cells: (Array.isArray(cells) ? cells : [])
            .filter(cell => cell && !reached.has(cellKey(Number(cell.x) || 0, Number(cell.y) || 0)))
            .map(cell => ({ x: Number(cell.x) || 0, y: Number(cell.y) || 0 })),
    };
}

/**
 * El veredicto en palabras, para el informe de importación.
 *
 * @param {ReturnType<typeof findUnreachable>} report
 * @returns {string}
 */
export function describeReachability(report) {
    if (report.total === 0) return 'El tablero no tiene ni una casilla transitable.';

    const parts = [`${report.reachable} de ${report.total} casillas se alcanzan`];
    if (report.orphanCells > 0) parts.push(`${report.orphanCells} incomunicadas`);
    if (report.enemies.length > 0) parts.push(`${report.enemies.length} enemigo(s) inalcanzables`);
    if (report.cells.length > 0) parts.push(`${report.cells.length} casilla(s) de objetivo inalcanzables`);

    return `${parts.join(', ')}.`;
}
