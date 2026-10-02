/**
 * Tanda 10, «entrar en la pelea y moverse» (wiki/maquetas/ENCARGO_COMBATE_VTT.md): el agua honda
 * no se cruza andando, el camino más recto gana a igual precio, y la regla de las diagonales
 * alternas (5, 10, 5…) va en un solo interruptor.
 */
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import {
    createEmptyTerrain, setCell, terrainFromAsciiMap, describeCell, isPassable, blocksSight, ASCII_TERRAIN, TERRAIN_TYPES,
} from '../public/scripts/game-engine/board/terrain.js';
import {
    findPath, getPathCost, getReachableCells, countDiagonals, DIAGONAL_RULE,
} from '../public/scripts/game-engine/board/pathfinding.js';
import { getMapLegend } from '../public/scripts/game-engine/campaign/campaign-pack-schema.js';

/** Los giros de un camino: cuántas veces cambia de dirección. */
function turnsOf(path) {
    let turns = 0;
    for (let i = 2; i < path.length; i++) {
        const a = `${path[i - 1].x - path[i - 2].x},${path[i - 1].y - path[i - 2].y}`;
        const b = `${path[i].x - path[i - 1].x},${path[i].y - path[i - 1].y}`;
        if (a !== b) turns++;
    }
    return turns;
}

/** El tablero del muelle del prólogo, tal y como lo trae el paquete del gremio. */
function dock() {
    const pack = JSON.parse(readFileSync(new URL('../public/mundos/gremio.pack.json', import.meta.url), 'utf8'));
    const board = pack.boards.find(b => b.id === 'muelle_puerto_alba');
    return {
        board,
        terrain: terrainFromAsciiMap(board.map),
        width: Math.max(...board.map.map(r => r.length)),
        height: board.map.length,
    };
}

describe('el agua honda', () => {
    test('no se pisa ni se cruza, pero se ve a través', () => {
        const terrain = setCell(createEmptyTerrain(), 2, 2, 'deep_water');
        expect(isPassable(terrain, 2, 2, 5, 5)).toBe(false);
        expect(blocksSight(terrain, 2, 2)).toBe(false);
        expect(TERRAIN_TYPES.deep_water.blocksMovement).toBe(true);
    });

    test('se escribe con «W» en los mapas, y la poco honda sigue siendo «w», terreno difícil', () => {
        expect(ASCII_TERRAIN.W).toEqual({ type: 'deep_water' });
        const terrain = terrainFromAsciiMap(['wW']);
        expect(isPassable(terrain, 0, 0, 2, 1)).toBe(true);
        expect(isPassable(terrain, 1, 0, 2, 1)).toBe(false);
        expect(getPathCost(terrain, [{ x: 1, y: 1 }, { x: 0, y: 0 }], { diagonals: 'todas-a-5' })).toBe(2);
    });

    test('al pasar el ratón por encima, la casilla lo dice claro', () => {
        const terrain = terrainFromAsciiMap(['wW']);
        expect(describeCell(terrain, 1, 0)).toBe('Casilla (2, 1) · Agua honda: no se cruza andando');
        expect(describeCell(terrain, 0, 0)).toMatch(/^Casilla \(1, 1\) · Agua poco honda: cada casilla cuesta el doble/);
    });

    test('la leyenda de los mapas (lo que lee el Gem) la explica', () => {
        expect(getMapLegend().W).toMatch(/agua honda.*no se cruza andando/);
    });

    test('el camino la rodea, y lo que se enciende al mover no la incluye', () => {
        const terrain = terrainFromAsciiMap([
            '.....',
            '.WWW.',
            '.....',
        ]);
        const path = findPath(terrain, 2, 0, 2, 2, 5, 3);
        expect(path).not.toBeNull();
        expect(path.some(c => c.y === 1 && c.x >= 1 && c.x <= 3)).toBe(false);
        const cells = getReachableCells(terrain, 2, 0, 60, 5, 3);
        expect(cells.some(c => c.gridY === 1 && c.gridX >= 1 && c.gridX <= 3)).toBe(false);
    });

    test('en el muelle del prólogo, el mar es hondo: no se anda por él', () => {
        const { terrain, width, height, board } = dock();
        const sea = [];
        board.map.forEach((row, y) => [...row].forEach((char, x) => { if (char === 'W') sea.push({ x, y }); }));
        expect(sea.length).toBeGreaterThan(15);
        const start = board.partyStart[0];
        const reach = new Set(getReachableCells(terrain, start.x, start.y, Infinity, width, height).map(c => `${c.gridX},${c.gridY}`));
        expect(sea.every(c => !reach.has(`${c.x},${c.y}`))).toBe(true);
        // El ratero sigue en las tablas del embarcadero, que sí se pisan.
        const thief = board.enemies[0];
        expect(isPassable(terrain, thief.x, thief.y, width, height)).toBe(true);
    });
});

describe('las diagonales alternas', () => {
    test('van encendidas por defecto, en un solo interruptor', () => {
        expect(DIAGONAL_RULE).toBe('alternas');
    });

    test('la primera cuesta 5 pies, la segunda 10, la tercera 5', () => {
        const terrain = createEmptyTerrain();
        const diagonal = (n) => Array.from({ length: n + 1 }, (_, i) => ({ x: i, y: i }));
        expect(getPathCost(terrain, diagonal(1)) * 5).toBe(5);
        expect(getPathCost(terrain, diagonal(2)) * 5).toBe(15);
        expect(getPathCost(terrain, diagonal(3)) * 5).toBe(20);
        expect(getPathCost(terrain, diagonal(4)) * 5).toBe(30);
        // Con la de siempre, todas a 5.
        expect(getPathCost(terrain, diagonal(4), { diagonals: 'todas-a-5' }) * 5).toBe(20);
    });

    test('los pasos rectos entre medias no reinician la cuenta', () => {
        const terrain = createEmptyTerrain();
        const path = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 2 }];
        // 5 (diagonal) + 5 (recto) + 10 (segunda diagonal).
        expect(getPathCost(terrain, path) * 5).toBe(20);
        expect(countDiagonals(path)).toBe(2);
    });

    test('lo ya andado en el turno cuenta: tras una diagonal, la siguiente cuesta 10', () => {
        const terrain = createEmptyTerrain();
        const step = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
        expect(getPathCost(terrain, step, { diagonalsTaken: 1 }) * 5).toBe(10);
        expect(getPathCost(terrain, step, { diagonalsTaken: 2 }) * 5).toBe(5);
        const near = new Map(getReachableCells(terrain, 0, 0, 5, 5, 5, { diagonalsTaken: 1 }).map(c => [`${c.gridX},${c.gridY}`, c.cost]));
        expect(near.has('1,1')).toBe(false);
        expect(near.get('1,0')).toBe(1);
    });

    test('una diagonal por terreno difícil que toca de 10 cuesta 20', () => {
        const terrain = terrainFromAsciiMap(['...', '..~']);
        expect(getPathCost(terrain, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 1 }], { diagonalsTaken: 1 }) * 5).toBe(5 + 20);
    });
});

describe('el camino más recto', () => {
    test('a igual precio, el de menos giros: nada de eses', () => {
        const terrain = createEmptyTerrain();
        for (const [gx, gy] of [[4, 2], [2, 4], [5, 1], [6, 3], [3, 6], [7, 2]]) {
            for (const diagonals of ['alternas', 'todas-a-5']) {
                const path = findPath(terrain, 0, 0, gx, gy, 12, 12, { diagonals });
                expect(turnsOf(path)).toBeLessThanOrEqual(1);
            }
        }
    });

    test('en línea recta no se desvía nunca', () => {
        const terrain = createEmptyTerrain();
        expect(findPath(terrain, 1, 5, 1, 0, 6, 6).every(c => c.x === 1)).toBe(true);
        expect(findPath(terrain, 0, 3, 5, 3, 6, 6).every(c => c.y === 3)).toBe(true);
    });

    test('el desempate no cambia el precio: cuesta lo mismo que lo más barato posible', () => {
        // Tableros al azar (con semilla), comparados con la inundación, que no desempata.
        let seed = 7;
        const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
        for (let round = 0; round < 25; round++) {
            const rows = Array.from({ length: 9 }, () => Array.from({ length: 11 }, () => {
                const r = random();
                return r < 0.15 ? '#' : r < 0.25 ? '~' : r < 0.3 ? 'W' : '.';
            }).join(''));
            const terrain = terrainFromAsciiMap(rows);
            const sx = Math.floor(random() * 11);
            const sy = Math.floor(random() * 9);
            for (const diagonals of ['alternas', 'todas-a-5']) {
                const costs = new Map(getReachableCells(terrain, sx, sy, Infinity, 11, 9, { diagonals }).map(c => [`${c.gridX},${c.gridY}`, c.cost]));
                for (let k = 0; k < 6; k++) {
                    const gx = Math.floor(random() * 11);
                    const gy = Math.floor(random() * 9);
                    const path = findPath(terrain, sx, sy, gx, gy, 11, 9, { diagonals });
                    // Sin camino, nulo; con él, lo mismo que la inundación.
                    const found = path ? getPathCost(terrain, path, { diagonals }) : null;
                    expect(found).toBe(costs.get(`${gx},${gy}`) ?? null);
                }
            }
        }
    });

    test('en el muelle, de cada casilla de salida hasta el ratero, la ruta va recta (un giro como mucho)', () => {
        const { terrain, width, height, board } = dock();
        const thief = board.enemies[0];
        const occupied = new Set([`${thief.x},${thief.y}`]);
        for (const start of board.partyStart) {
            const goals = [[0, 1], [1, 1], [-1, 1], [1, 0], [-1, 0]]
                .map(([dx, dy]) => ({ x: thief.x + dx, y: thief.y + dy }))
                .filter(goal => isPassable(terrain, goal.x, goal.y, width, height));
            expect(goals.length).toBeGreaterThan(2);
            for (const goal of goals) {
                const path = findPath(terrain, start.x, start.y, goal.x, goal.y, width, height, { occupied });
                expect(path).not.toBeNull();
                expect(turnsOf(path)).toBeLessThanOrEqual(1);
            }
        }
    });
});
