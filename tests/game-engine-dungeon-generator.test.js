import { describe, test, expect } from '@jest/globals';
import {
    generateBoard, describeBoard, BOARD_SHAPES,
} from '../public/scripts/game-engine/world-builder/dungeon-generator.js';
import { createSeededRandom } from '../public/scripts/game-engine/combat/seeded-random.js';
import { terrainFromAsciiMap, getCell } from '../public/scripts/game-engine/board/terrain.js';
import { findUnreachable } from '../public/scripts/game-engine/board/reachability.js';

const seeded = (seed) => generateBoard({ random: createSeededRandom(seed), bestiary: ['Sabueso'], partySize: 2 });

describe('un sitio generado', () => {
    const board = seeded('el molino');

    test('mide lo que dice su tamaño', () => {
        expect(board.gridWidth).toBe(BOARD_SHAPES.medium.width);
        expect(board.map).toHaveLength(BOARD_SHAPES.medium.height);
    });

    // Es lo primero que comprueba el validador del paquete, y lo que mas rompe un mapa
    // generado: una fila corta desplaza todos los muros que vienen detras.
    test('todas las filas miden lo mismo', () => {
        expect(new Set(board.map.map(row => row.length)).size).toBe(1);
    });

    test('y el borde exterior es muro entero', () => {
        const rows = board.map;
        expect([...rows[0]].every(c => c === '#')).toBe(true);
        expect([...rows[rows.length - 1]].every(c => c === '#')).toBe(true);
        for (const row of rows) {
            expect(row[0]).toBe('#');
            expect(row[row.length - 1]).toBe('#');
        }
    });

    test('usa solo caracteres que el motor entiende', () => {
        const legal = new Set(['#', '.', 'D', 'o', '~', 'c', 'C']);
        for (const row of board.map) {
            for (const char of row) expect(legal.has(char)).toBe(true);
        }
    });

    test('tiene salas de verdad, no una nave diáfana', () => {
        expect(board.rooms.length).toBeGreaterThan(1);
        expect(board.doors.length).toBeGreaterThan(0);
    });
});

describe('se puede jugar, que es lo que importa', () => {
    // El fallo que arruina un tablero entero y solo se descubre al entrar a pelear.
    test('desde donde empieza el grupo se llega a todo el suelo, abriendo puertas', () => {
        for (const seed of ['uno', 'dos', 'tres', 'la cripta', 'vado']) {
            const board = seeded(seed);
            const terrain = terrainFromAsciiMap(board.map);
            const report = findUnreachable({
                terrain,
                gridWidth: board.gridWidth,
                gridHeight: board.gridHeight,
                starts: board.partyStart,
                enemies: board.enemies,
            });
            expect({ seed, huerfanas: report.orphanCells, bichos: report.enemies.length })
                .toEqual({ seed, huerfanas: 0, bichos: 0 });
        }
    });

    test('el grupo no empieza dentro de un muro', () => {
        const board = seeded('el molino');
        const terrain = terrainFromAsciiMap(board.map);
        expect(board.partyStart.length).toBeGreaterThan(0);
        for (const cell of board.partyStart) {
            expect(getCell(terrain, cell.x, cell.y).type).not.toBe('wall');
        }
    });

    test('ni los enemigos', () => {
        const board = seeded('la cripta');
        const terrain = terrainFromAsciiMap(board.map);
        for (const enemy of board.enemies) {
            expect(getCell(terrain, enemy.x, enemy.y).type).not.toBe('wall');
        }
    });

    // Compartir sala con el grupo quita el turno de mirar antes de que empiece el ruido.
    test('y no aparecen encima del grupo', () => {
        const board = seeded('el molino');
        for (const enemy of board.enemies) {
            expect(board.partyStart.some(c => c.x === enemy.x && c.y === enemy.y)).toBe(false);
        }
    });

    test('dos enemigos no comparten casilla', () => {
        const board = generateBoard({
            random: createSeededRandom('apretado'), bestiary: ['Sabueso'], enemyCount: 8,
        });
        const seen = new Set(board.enemies.map(e => `${e.x},${e.y}`));
        expect(seen.size).toBe(board.enemies.length);
    });
});

describe('la semilla manda', () => {
    // Una cripta que cambia cada vez que entras no es un lugar, es un fondo de pantalla.
    test('la misma semilla da el mismo sitio, siempre', () => {
        expect(seeded('el molino').map).toEqual(seeded('el molino').map);
        expect(seeded('el molino').enemies).toEqual(seeded('el molino').enemies);
    });

    test('y semillas distintas dan sitios distintos', () => {
        expect(seeded('el molino').map).not.toEqual(seeded('la cripta').map);
    });
});

describe('lo que se le puede pedir', () => {
    test('un sitio pequeño y uno grande no miden igual', () => {
        const small = generateBoard({ random: createSeededRandom('x'), size: 'small' });
        const large = generateBoard({ random: createSeededRandom('x'), size: 'large' });
        expect(large.gridWidth).toBeGreaterThan(small.gridWidth);
    });

    test('sin bestiario, un sitio vacío en vez de un enemigo inventado', () => {
        expect(generateBoard({ random: createSeededRandom('x') }).enemies).toEqual([]);
    });

    test('los enemigos salen del bestiario que le des, no de ningún sitio', () => {
        const board = generateBoard({
            random: createSeededRandom('x'), bestiary: ['Sabueso', 'Guardián'], enemyCount: 4,
        });
        for (const enemy of board.enemies) {
            expect(['Sabueso', 'Guardián']).toContain(enemy.name);
        }
    });

    test('y el grupo cabe entero en la entrada', () => {
        const board = generateBoard({ random: createSeededRandom('x'), partySize: 4 });
        expect(board.partyStart.length).toBe(4);
    });
});

describe('contado en una línea', () => {
    test('dice lo que lleva', () => {
        expect(describeBoard(seeded('el molino'))).toMatch(/\d+x\d+ · \d+ sala\(s\) · \d+ puerta\(s\) · \d+ enemigo\(s\)/);
    });
});
