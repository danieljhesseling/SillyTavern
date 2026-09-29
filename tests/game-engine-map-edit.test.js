import { describe, test, expect } from '@jest/globals';
import { classifyCells, detectGrid, makeGrid, normalizeBoardGrid, regionAt } from '../public/scripts/game-engine/board/map-image.js';
import { terrainFromAsciiMap } from '../public/scripts/game-engine/board/terrain.js';
import { validateZones } from '../public/scripts/game-engine/board/zones.js';
import {
    MAP_BRUSHES, applyHeight, boardFromEdit, countRows, croppedGrid, describeGrid, describeRows, feetWord,
    gridForOtherImage, gridFromBoard, heightGroups, kindsFromRows, paintAt, readingMarks, removeZone, rowsFromBoard,
    rowsFromReading, saveZone, zoneIndexAt, zoneProblems,
} from '../public/scripts/game-engine/board/map-edit.js';

/**
 * Un mapa dibujado de mentira, lo justo para la pantalla: papel blanco, cuadrícula gris sobre
 * el suelo, trama negra sobre la roca, el trazo de la pared y las puertas como un rectángulo
 * sobre la línea (como en `game-engine-map-image.test.js`, que prueba la lectura a fondo).
 *
 * @param {{rows: string[], cell?: number, offsetX?: number, offsetY?: number, doors?: Array<{x: number, y: number, side: 'right'|'down'}>, lines?: Array<{x: number, y: number, side: 'right'|'down'}>}} spec
 */
function drawMap(spec) {
    const cell = spec.cell ?? 20;
    const offsetX = spec.offsetX ?? 7;
    const offsetY = spec.offsetY ?? 5;
    const cols = spec.rows[0].length;
    const rows = spec.rows.length;
    const width = Math.ceil(offsetX + cols * cell + 13);
    const height = Math.ceil(offsetY + rows * cell + 13);
    const data = new Uint8ClampedArray(width * height * 4).fill(255);
    const put = (x, y, value) => {
        x = Math.round(x);
        y = Math.round(y);
        if (x < 0 || y < 0 || x >= width || y >= height) return;
        const i = (y * width + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = Math.min(data[i], value);
    };
    const box = (cx, cy) => ({ x0: offsetX + cx * cell, y0: offsetY + cy * cell });
    for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
            const { x0, y0 } = box(cx, cy);
            if (spec.rows[cy][cx] === '.') {
                for (let t = 0; t < cell; t++) {
                    for (const d of [-1, 0, 1]) {
                        put(x0 + t, y0 + d, 166);
                        put(x0 + t, y0 + cell + d, 166);
                        put(x0 + d, y0 + t, 166);
                        put(x0 + cell + d, y0 + t, 166);
                    }
                }
            } else {
                for (let y = 0; y < cell; y++) {
                    for (let x = 0; x < cell; x++) if ((x + y + cx * cell + cy * cell) % 6 < 2) put(x0 + x, y0 + y, 0);
                }
            }
        }
    }
    const walkable = (cx, cy) => cy >= 0 && cy < rows && cx >= 0 && cx < cols && spec.rows[cy][cx] === '.';
    const lines = [...(spec.lines ?? [])];
    for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
            if (spec.rows[cy][cx] !== '#') continue;
            if (walkable(cx + 1, cy)) lines.push({ x: cx, y: cy, side: 'right' });
            if (walkable(cx - 1, cy)) lines.push({ x: cx - 1, y: cy, side: 'right' });
            if (walkable(cx, cy + 1)) lines.push({ x: cx, y: cy, side: 'down' });
            if (walkable(cx, cy - 1)) lines.push({ x: cx, y: cy - 1, side: 'down' });
        }
    }
    for (const line of lines) {
        const { x0, y0 } = box(line.x, line.y);
        for (let t = -1; t <= cell + 1; t++) {
            for (const d of [-1, 0, 1]) {
                if (line.side === 'right') put(x0 + cell + d, y0 + t, 0);
                else put(x0 + t, y0 + cell + d, 0);
            }
        }
    }
    for (const door of spec.doors ?? []) {
        const { x0, y0 } = box(door.x, door.y);
        for (let t = 3; t < cell - 3; t++) {
            for (const d of [-4, -3, 3, 4]) {
                if (door.side === 'right') put(x0 + cell + d, y0 + t, 0);
                else put(x0 + t, y0 + cell + d, 0);
            }
        }
        for (let d = -4; d <= 4; d++) {
            for (const t of [3, cell - 4]) {
                if (door.side === 'right') put(x0 + cell + d, y0 + t, 0);
                else put(x0 + t, y0 + cell + d, 0);
            }
        }
    }
    return { width, height, data };
}

/** Dos salas separadas por una pared fina, con una puerta entre ellas. */
const ROOMS = [
    '##########',
    '#...#....#',
    '#...#....#',
    '#........#',
    '#...#....#',
    '##########',
];

describe('J12.8 a J12.11: la pantalla del mapa en cuadrícula, de punta a punta', () => {
    const pixels = drawMap({ rows: ROOMS, doors: [{ x: 3, y: 3, side: 'right' }] });
    const grid = detectGrid(pixels);
    const reading = classifyCells(pixels, grid);

    test('subir, leer, pintar, nombrar una sala, darle altura y guardar', () => {
        let rows = rowsFromReading(reading);
        expect(rows[3]).toBe('#...D....#');
        const marks = readingMarks(reading);
        expect(marks.doors).toEqual(['4,3']);

        // Pintar: un muro donde el dibujo tiene suelo.
        rows = paintAt(rows, 7, 1, '#');
        expect(rows[1]).toBe('#...#..#.#');

        // Una sala pulsando: la de la izquierda, sin salirse por la pared ni por la puerta.
        const left = regionAt(pixels, grid, 1, 1, { kinds: kindsFromRows(rows) });
        expect(left).toHaveLength(12);
        expect(left).toContainEqual({ x: 3, y: 4 });
        expect(left).not.toContainEqual({ x: 4, y: 3 });
        expect(left).not.toContainEqual({ x: 5, y: 1 });
        const named = saveZone([], { name: 'B1', cells: left, note: 'Un goblin duerme aquí.' });
        expect(named.error).toBe('');

        // Y una altura a la otra sala.
        const right = regionAt(pixels, grid, 6, 2, { kinds: kindsFromRows(rows) });
        const elevation = applyHeight({}, right, 30);

        const board = boardFromEdit({ url: 'user/images/Mundo/mapa-1.png', grid, rows, zones: named.zones, elevation });
        expect(board).toEqual(expect.objectContaining({ url: 'user/images/Mundo/mapa-1.png', gridWidth: 10, gridHeight: 6 }));
        expect(board.terrain).toEqual(terrainFromAsciiMap(rows));
        expect(board.zones).toEqual([expect.objectContaining({ name: 'B1', note: 'Un goblin duerme aquí.' })]);
        expect(board.zones[0].cells).toContain('1,1');
        expect(board.elevation['6,2']).toBe(30);
        expect(board.elevation['1,1']).toBeUndefined();
        // La cuadrícula es la de la imagen recortada: empieza en la esquina.
        expect(board.grid).toEqual({ cell: grid.cell, offsetX: expect.any(Number), offsetY: expect.any(Number), cols: 10, rows: 6 });
        expect(board.grid.offsetX).toBeLessThan(0.5);
        expect(normalizeBoardGrid(board.grid)).toEqual(board.grid);
        expect(validateZones(board.zones, 10, 6).errors).toEqual([]);
    });

    test('retocar: el tablero guardado vuelve a la pantalla tal cual', () => {
        const rows = rowsFromReading(reading);
        const board = boardFromEdit({ url: 'x.png', grid, rows, zones: [], elevation: {} });
        const again = gridFromBoard(board, 200, 120);
        expect(again).toEqual(expect.objectContaining({ cell: grid.cell, cols: 10, rows: 6, source: 'manual' }));
        expect(rowsFromBoard(board, 10, 6)).toEqual(rows);
        // Sin cuadrícula guardada, la imagen entera repartida entre sus casillas.
        expect(gridFromBoard({ gridWidth: 20, gridHeight: 10 }, 400, 200)).toEqual(expect.objectContaining({ cell: 20, offsetX: 0, offsetY: 0, cols: 20, rows: 10 }));
        expect(gridFromBoard({}, 400, 200)).toBeNull();
    });
});

describe('pintar encima', () => {
    test('cambia una casilla; lo que no cambia nada devuelve lo mismo', () => {
        const rows = ['###', '#.#'];
        expect(paintAt(rows, 1, 1, '~')).toEqual(['###', '#~#']);
        expect(paintAt(rows, 1, 1, '.')).toBe(rows);
        expect(paintAt(rows, 9, 9, '#')).toBe(rows);
        expect(paintAt(rows, 1, 1, 'Q')).toBe(rows);
        expect(paintAt(['#'], 0, 0, '.')).toEqual(['.']);
    });

    test('los pinceles son de la leyenda del motor', () => {
        const legend = terrainFromAsciiMap([MAP_BRUSHES.map(b => b.id).join('')]);
        // Todo menos el suelo deja una casilla en el terreno.
        expect(Object.keys(legend.cells)).toHaveLength(MAP_BRUSHES.length - 1);
    });

    test('se cuenta y se dice lo que hay', () => {
        const rows = ['#D#', '.~.', 'xw.'];
        expect(countRows(rows)).toEqual({ floor: 3, wall: 2, rough: 1, door: 1, other: 2 });
        expect(describeRows(rows)).toBe('Suelo 3 · Muro 2 · Terreno difícil 1 · Puertas 1 · Otras 2');
        // Para sacar una sala pulsando, la puerta corta como el muro.
        expect(kindsFromRows(['#D.~'])).toEqual(['wall', 'wall', 'floor', 'rough']);
    });
});

describe('la cuadrícula, dicha y llevada a otra imagen', () => {
    test('se dice si se ve clara, a medias o nada', () => {
        expect(describeGrid({ cell: 74.38, offsetX: 0, offsetY: 0, cols: 36, rows: 25, confidence: 0.97, source: 'auto' }))
            .toBe('Casillas de 74,4 px · 36 × 25. Se ve clara.');
        expect(describeGrid({ cell: 20, offsetX: 0, offsetY: 0, cols: 5, rows: 5, confidence: 0.3, source: 'auto' })).toMatch(/a medias/);
        expect(describeGrid({ cell: 20, offsetX: 0, offsetY: 0, cols: 5, rows: 5, confidence: 0.1, source: 'auto' })).toMatch(/ajústala/);
        expect(describeGrid({ cell: 20, offsetX: 0, offsetY: 0, cols: 5, rows: 5, confidence: 1, source: 'manual' })).toBe('Casillas de 20 px · 5 × 5.');
        expect(describeGrid({ cell: 0, offsetX: 0, offsetY: 0, cols: 0, rows: 0 })).toMatch(/No se ha encontrado/);
    });

    test('recortada, empieza en la esquina con lo que quede del redondeo', () => {
        expect(croppedGrid({ cell: 74.38, offsetX: 30.78, offsetY: 5.42, cols: 36, rows: 25 }))
            .toEqual({ cell: 74.38, offsetX: 0, offsetY: 0.42, cols: 36, rows: 25 });
    });

    test('el mapa limpio: la misma si mide lo mismo, escalada si es el mismo a otro tamaño, nada si no', () => {
        const grid = makeGrid({ cell: 20, offsetX: 7, offsetY: 5 }, 220, 140);
        expect(gridForOtherImage(grid, { width: 220, height: 140 }, { width: 220, height: 140 })).toEqual(grid);
        expect(gridForOtherImage(grid, { width: 220, height: 140 }, { width: 440, height: 280 }))
            .toEqual(expect.objectContaining({ cell: 40, offsetX: 14, offsetY: 10, cols: grid.cols, rows: grid.rows }));
        expect(gridForOtherImage(grid, { width: 220, height: 140 }, { width: 220, height: 200 })).toBeNull();
    });
});

describe('las salas', () => {
    const cells = [{ x: 1, y: 1 }, { x: 2, y: 1 }];

    test('se guardan con nombre; sin nombre, sin casillas o repetidas, no', () => {
        const first = saveZone([], { name: 'B1', cells });
        expect(first.zones).toEqual([{ name: 'B1', cells: ['1,1', '2,1'] }]);
        expect(saveZone(first.zones, { name: ' ', cells }).error).toMatch(/nombre/);
        expect(saveZone(first.zones, { name: 'B2', cells: [] }).error).toMatch(/Pulsa/);
        expect(saveZone(first.zones, { name: 'b1', cells: [{ x: 5, y: 5 }] }).error).toMatch(/Ya hay una sala «B1»/);
        // Cambiando la misma, el nombre repetido es el suyo.
        const renamed = saveZone(first.zones, { name: 'b1', cells: [{ x: 5, y: 5 }], note: 'Otra' }, 0);
        expect(renamed.zones).toEqual([{ name: 'b1', cells: ['5,5'], note: 'Otra' }]);
    });

    test('se encuentran por casilla (la más pequeña si hay dos) y se quitan', () => {
        const zones = [{ name: 'Capilla', cells: ['1,1', '2,1', '3,1'] }, { name: 'Altar', cells: ['2,1'] }];
        expect(zoneIndexAt(zones, 2, 1)).toBe(1);
        expect(zoneIndexAt(zones, 1, 1)).toBe(0);
        expect(zoneIndexAt(zones, 9, 9)).toBe(-1);
        expect(removeZone(zones, 0).map(z => z.name)).toEqual(['Altar']);
    });

    test('se avisa de la sala que cae sobre muro', () => {
        expect(zoneProblems([{ name: 'B1', cells: ['0,0'] }], ['##', '..'])).toEqual([expect.stringMatching(/sobre muro/)]);
        expect(zoneProblems([{ name: 'B1', cells: ['0,1'] }], ['##', '..'])).toEqual([]);
    });
});

describe('las alturas', () => {
    test('por trozos vecinos a la misma altura, del más grande al más pequeño', () => {
        let elevation = applyHeight({}, ['1,1', '2,1', '1,2'], 60);
        elevation = applyHeight(elevation, ['5,5'], 60);
        elevation = applyHeight(elevation, ['3,1'], 30);
        const groups = heightGroups(elevation);
        expect(groups.map(g => [g.feet, g.cells.length])).toEqual([[60, 3], [60, 1], [30, 1]]);
        expect(applyHeight(elevation, ['5,5'], 0)['5,5']).toBeUndefined();
    });

    test('se dicen claras', () => {
        expect(feetWord(60)).toBe('+60 pies');
        expect(feetWord(-10)).toBe('−10 pies');
        expect(feetWord(0)).toBe('a ras de suelo');
    });

    test('las que caen fuera del tablero no se guardan', () => {
        const grid = makeGrid({ cell: 20, offsetX: 0, offsetY: 0 }, 40, 40);
        const board = boardFromEdit({ url: 'a.png', grid, rows: ['..', '..'], elevation: { '1,1': 30, '5,5': 30 } });
        expect(board.elevation).toEqual({ '1,1': 30 });
        expect(board.zones).toEqual([]);
    });
});
