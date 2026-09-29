import { describe, test, expect } from '@jest/globals';
import {
    detectGrid, makeGrid, gridFromCell, gridCrop, classifyCells, toTerrain, toAsciiRows, plainGroups,
    regionAt, toBoardFragment, normalizeBoardGrid, MAP_THRESHOLDS,
} from '../public/scripts/game-engine/board/map-image.js';
import { terrainFromAsciiMap } from '../public/scripts/game-engine/board/terrain.js';
import {
    CLIFF_FEET, normalizeElevation, elevationAt, setElevation, isCliff, canStepBetween, walkableFrom,
    cliffEdges, levelRegion, heightBetween,
} from '../public/scripts/game-engine/board/heights.js';
import { normalizeZones, zoneCells, zoneAt, zoneFromCells, validateZones, nameRoomsFromZones } from '../public/scripts/game-engine/board/zones.js';
import { validatePack } from '../public/scripts/game-engine/campaign/campaign-pack.js';
import { buildImportPlan } from '../public/scripts/game-engine/campaign/campaign-importer.js';
import { CAMPAIGN_PACK_VERSION, getSectionSchema } from '../public/scripts/game-engine/campaign/campaign-pack-schema.js';

/**
 * Un mapa dibujado de mentira, como los de mazmorra de verdad pero pequeño: papel blanco,
 * cuadrícula gris clara sobre el suelo, trama negra en diagonal sobre la roca, piedras
 * redondas cerradas y puertas como un rectángulo sobre la línea de la pared.
 *
 * @param {{rows: string[], cell?: number, offsetX?: number, offsetY?: number, margin?: number,
 *   doors?: Array<{x: number, y: number, side: 'right'|'down'}>, noGrid?: string[], dense?: string[], lines?: Array<{x: number, y: number, side: 'right'|'down'}>}} spec
 *   `rows`: `#` roca, `.` suelo, `~` escombros, ` ` papel sin nada. `noGrid`: casillas `"x,y"` de
 *   suelo sin cuadrícula (una meseta). `dense`: casillas de trama muy apretada (un puente).
 *   `lines`: una pared negra fina sobre el borde de la casilla.
 */
function drawMap(spec) {
    const cell = spec.cell ?? 20;
    const offsetX = spec.offsetX ?? 7;
    const offsetY = spec.offsetY ?? 5;
    const cols = spec.rows[0].length;
    const rows = spec.rows.length;
    const width = Math.ceil(offsetX + cols * cell + (spec.margin ?? 13));
    const height = Math.ceil(offsetY + rows * cell + (spec.margin ?? 13));
    const data = new Uint8ClampedArray(width * height * 4).fill(255);
    const put = (x, y, value) => {
        x = Math.round(x);
        y = Math.round(y);
        if (x < 0 || y < 0 || x >= width || y >= height) return;
        const i = (y * width + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = Math.min(data[i], value);
    };
    const noGrid = new Set(spec.noGrid ?? []);
    const dense = new Set(spec.dense ?? []);
    const box = (cx, cy) => ({ x0: offsetX + cx * cell, y0: offsetY + cy * cell });

    for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
            const kind = spec.rows[cy][cx];
            const { x0, y0 } = box(cx, cy);
            if ((kind === '.' || kind === '~') && !noGrid.has(`${cx},${cy}`)) {
                // Las cuatro líneas grises de la casilla, de tres píxeles.
                for (let t = 0; t < cell; t++) {
                    for (const d of [-1, 0, 1]) {
                        put(x0 + t, y0 + d, 166);
                        put(x0 + t, y0 + cell + d, 166);
                        put(x0 + d, y0 + t, 166);
                        put(x0 + cell + d, y0 + t, 166);
                    }
                }
            }
            if (kind === '#' || dense.has(`${cx},${cy}`)) {
                const step = dense.has(`${cx},${cy}`) ? 3 : 6;
                for (let y = 0; y < cell; y++) {
                    for (let x = 0; x < cell; x++) {
                        if ((x + y + cx * cell + cy * cell) % step < 2) put(x0 + x, y0 + y, 0);
                    }
                }
            }
            if (kind === '~') {
                // Una piedra: un anillo cerrado con el blanco dentro.
                const mx = x0 + cell / 2;
                const my = y0 + cell / 2;
                for (let y = -8; y <= 8; y++) {
                    for (let x = -8; x <= 8; x++) {
                        const r = Math.hypot(x, y);
                        if (r >= cell * 0.3 && r <= cell * 0.3 + 1.6) put(mx + x, my + y, 0);
                    }
                }
            }
        }
    }
    // La pared: un trazo negro gordo donde la roca toca el suelo, como en los mapas de verdad.
    const walkable = (cx, cy) => cy >= 0 && cy < rows && cx >= 0 && cx < cols && spec.rows[cy][cx] !== '#' && spec.rows[cy][cx] !== ' ';
    const outline = [];
    for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
            if (spec.rows[cy][cx] !== '#') continue;
            if (walkable(cx + 1, cy)) outline.push({ x: cx, y: cy, side: 'right' });
            if (walkable(cx - 1, cy)) outline.push({ x: cx - 1, y: cy, side: 'right' });
            if (walkable(cx, cy + 1)) outline.push({ x: cx, y: cy, side: 'down' });
            if (walkable(cx, cy - 1)) outline.push({ x: cx, y: cy - 1, side: 'down' });
        }
    }
    for (const line of [...outline, ...(spec.lines ?? [])]) {
        const { x0, y0 } = box(line.x, line.y);
        for (let t = -1; t <= cell + 1; t++) {
            for (const d of [-1, 0, 1]) {
                if (line.side === 'right') put(x0 + cell + d, y0 + t, 0);
                else put(x0 + t, y0 + cell + d, 0);
            }
        }
    }
    for (const door of spec.doors ?? []) {
        // Un rectángulo montado sobre la línea: dos lados largos a 3 píxeles de ella.
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

/** La mazmorra de las pruebas: dos salas, una puerta entre ellas y un montón de escombros. */
const DUNGEON = [
    '##########',
    '#...#....#',
    '#...#....#',
    '#........#',
    '#...#....#',
    '#...#~~..#',
    '#...#~~..#',
    '##########',
];

describe('J12.8: la cuadrícula del dibujo', () => {
    test('se encuentra sola: el lado de la casilla, dónde empieza y cuántas caben', () => {
        const grid = detectGrid(drawMap({ rows: DUNGEON }));
        expect(Math.abs(grid.cell - 20)).toBeLessThan(0.15);
        expect(grid.offsetX).toBeCloseTo(7, 0);
        expect(grid.offsetY).toBeCloseTo(5, 0);
        expect(grid.cols).toBe(10);
        expect(grid.rows).toBe(8);
        expect(grid.confidence).toBeGreaterThan(0.5);
        expect(grid.source).toBe('auto');
    });

    test('con decimales: 30 casillas de 20,5 px caen casilla a casilla hasta el otro lado', () => {
        const rows = Array.from({ length: 6 }, (_, y) => (y === 0 || y === 5 ? '#'.repeat(30) : `#${'.'.repeat(28)}#`));
        const grid = detectGrid(drawMap({ rows, cell: 20.5, offsetX: 11, offsetY: 4 }));
        expect(Math.abs(grid.cell - 20.5)).toBeLessThan(0.05);
        // La última línea, a 30 casillas, cae a menos de un píxel de donde está dibujada.
        expect(Math.abs(grid.offsetX + 30 * grid.cell - (11 + 30 * 20.5))).toBeLessThan(1.5);
        expect(grid.cols).toBe(30);
    });

    test('a mano: el tamaño y el desfase dichos, cuántas casillas de ancho, o una casilla marcada', () => {
        const pixels = drawMap({ rows: DUNGEON });
        expect(detectGrid(pixels, { cell: 20, offsetX: 7, offsetY: 5 })).toEqual(expect.objectContaining({ cell: 20, offsetX: 7, offsetY: 5, cols: 10, rows: 8, source: 'manual' }));
        const across = detectGrid(pixels, { cellsAcross: pixels.width / 20 });
        expect(Math.abs(across.cell - 20)).toBeLessThan(0.15);
        expect(across.offsetX).toBeCloseTo(7, 0);
        const marked = detectGrid(pixels, { cellRect: { x: 67, y: 45, width: 21, height: 19 } });
        expect(Math.abs(marked.cell - 20)).toBeLessThan(0.15);
        expect(marked.offsetY).toBeCloseTo(5, 0);
        expect(gridFromCell({ x: 67, y: 45, width: 20, height: 20 }, 220, 180)).toEqual(expect.objectContaining({ cell: 20, offsetX: 7, offsetY: 5, cols: 10, rows: 8 }));
        expect(makeGrid({ cell: 20, offsetX: 47, offsetY: 5 }, 220, 180).offsetX).toBe(7);
    });

    test('el recorte deja la cuadrícula justa: la imagen entera repartida entre las casillas', () => {
        const grid = detectGrid(drawMap({ rows: DUNGEON }), { cell: 20, offsetX: 7, offsetY: 5 });
        expect(gridCrop(grid)).toEqual({ x: 7, y: 5, width: 200, height: 160 });
    });
});

describe('J12.9 y J12.10: muros, suelo, escombros y puertas leídos del dibujo', () => {
    const pixels = drawMap({ rows: DUNGEON, doors: [{ x: 3, y: 3, side: 'right' }] });
    const grid = detectGrid(pixels);
    const reading = classifyCells(pixels, grid);

    test('la trama es muro, la cuadrícula es suelo, las piedras son terreno difícil y el rectángulo, una puerta', () => {
        expect(toAsciiRows(reading)).toEqual([
            '##########',
            '#...#....#',
            '#...#....#',
            '#...D....#',
            '#...#....#',
            '#...#~~..#',
            '#...#~~..#',
            '##########',
        ]);
        // La puerta va en la casilla del paso, la que tiene pared a los dos lados.
        expect(reading.doors).toEqual([{ x: 4, y: 3 }]);
    });

    test('cada casilla dice lo que se ha medido en ella, para poder explicar la decisión', () => {
        const wall = reading.features[0];
        const floor = reading.features[1 * 10 + 1];
        expect(wall.open).toBeLessThan(MAP_THRESHOLDS.openRock);
        expect(floor.open).toBeGreaterThan(MAP_THRESHOLDS.openFloor);
        expect(floor.gridEdges).toBeGreaterThanOrEqual(2);
        expect(reading.features[5 * 10 + 5].stones).toBe(1);
    });

    test('el terreno sale en el formato del motor, igual que si se hubiera escrito a mano', () => {
        expect(toTerrain(reading)).toEqual(terrainFromAsciiMap(toAsciiRows(reading)));
        const fragment = toBoardFragment(reading, grid, { image: 'mundos/prueba/mazmorra.png' });
        expect(fragment).toEqual(expect.objectContaining({
            image: 'mundos/prueba/mazmorra.png',
            gridWidth: 10,
            gridHeight: 8,
            map: toAsciiRows(reading),
        }));
        expect(fragment.grid).toEqual({ cell: grid.cell, offsetX: grid.offsetX, offsetY: grid.offsetY, cols: 10, rows: 8 });
        expect(normalizeBoardGrid(fragment.grid)).toEqual(fragment.grid);
    });

    test('lo de fuera del mapa (papel sin cuadrícula que llega al borde) es muro', () => {
        const withPaper = drawMap({ rows: ['          ', ' ######## ', ' #......# ', ' #......# ', ' ######## ', '          '] });
        const read = classifyCells(withPaper, detectGrid(withPaper, { cell: 20, offsetX: 7, offsetY: 5 }));
        expect(toAsciiRows(read)[0]).toBe('##########');
        expect(toAsciiRows(read)[2]).toBe('##......##');
        expect(read.notes[0]).toBe('fuera del mapa');
    });

    test('el suelo sin cuadrícula en medio del suelo es una meseta: se pisa y se propone para darle altura', () => {
        const rows = ['#######', '#.....#', '#.....#', '#.....#', '#.....#', '#.....#', '#######'];
        const noGrid = ['2,2', '3,2', '4,2', '2,3', '3,3', '4,3', '2,4', '3,4', '4,4'];
        const plateau = drawMap({ rows, noGrid });
        const read = classifyCells(plateau, detectGrid(plateau, { cell: 20, offsetX: 7, offsetY: 5 }));
        expect(toAsciiRows(read)).toEqual(rows);
        expect(read.plains).toContainEqual({ x: 3, y: 3 });
        expect(toAsciiRows(read, { preview: true })[3]).toBe('#..,..#');
        expect(plainGroups(read)[0].cells).toContainEqual({ x: 3, y: 3 });
    });

    test('una tira de trama apretada suelta en medio del suelo es un puente: se lee como suelo', () => {
        const rows = ['########', '#......#', '#......#', '#......#', '#......#', '#......#', '########'];
        const bridge = drawMap({ rows, dense: ['2,2', '3,3', '4,4'] });
        const read = classifyCells(bridge, detectGrid(bridge, { cell: 20, offsetX: 7, offsetY: 5 }));
        expect(read.bridges).toEqual(expect.arrayContaining([{ x: 2, y: 2 }, { x: 3, y: 3 }, { x: 4, y: 4 }]));
        expect(toAsciiRows(read)).toEqual(rows);
    });

    test('sin cuadrícula en el dibujo se lee por el sitio que hay: la sala encerrada es suelo', () => {
        const rows = ['          ', ' ######## ', ' #      # ', ' #      # ', ' ######## ', '          '];
        const bare = drawMap({ rows });
        const read = classifyCells(bare, makeGrid({ cell: 20, offsetX: 7, offsetY: 5 }, bare.width, bare.height));
        expect(read.gridless).toBe(true);
        expect(toAsciiRows(read)).toEqual(['##########', '##########', '##......##', '##......##', '##########', '##########']);
    });
});

describe('J12.10 y J12.11: pulsar en el dibujo para sacar una sala o una meseta', () => {
    test('la región se inunda hasta los trazos negros, sin salir por las casillas de muro', () => {
        const rows = ['########', '#......#', '#......#', '#......#', '########'];
        // Una pared fina entre la columna 3 y la 4: dos salas.
        const lines = [1, 2, 3].map(y => ({ x: 3, y, side: /** @type {'right'} */ ('right') }));
        const pixels = drawMap({ rows, lines });
        const grid = detectGrid(pixels, { cell: 20, offsetX: 7, offsetY: 5 });
        const reading = classifyCells(pixels, grid);
        const left = regionAt(pixels, grid, 1, 2, { kinds: reading.kinds });
        expect(left).toHaveLength(9);
        expect(left).toContainEqual({ x: 3, y: 1 });
        expect(left).not.toContainEqual({ x: 4, y: 1 });
        expect(regionAt(pixels, grid, 5, 1, { kinds: reading.kinds })).toHaveLength(9);
        expect(regionAt(pixels, grid, 99, 1)).toEqual([]);
    });
});

describe('J12.10: las cotas (heights.js)', () => {
    // Un risco (60 pies) y una isla (60) unidos por un puente (60) sobre el suelo (0).
    const rows = [
        '#########',
        '#.......#',
        '#.......#',
        '#.......#',
        '#########',
    ];
    const terrain = terrainFromAsciiMap(rows);
    const ridge = [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 1, y: 3 }, { x: 2, y: 3 }];
    const island = [{ x: 5, y: 2 }, { x: 6, y: 2 }, { x: 7, y: 2 }, { x: 6, y: 1 }, { x: 6, y: 3 }];
    let elevation = setElevation({}, ridge, 60);
    elevation = setElevation(elevation, island, 60);
    elevation = setElevation(elevation, ['4,2'], 60);

    test('una región pulsada recibe su cota; 0 la devuelve al suelo; lo raro se tira', () => {
        expect(elevationAt(elevation, 2, 2)).toBe(60);
        expect(elevationAt(elevation, 4, 1)).toBe(0);
        expect(setElevation(elevation, ['4,2'], 0)['4,2']).toBeUndefined();
        expect(normalizeElevation({ '1,1': '30', 'x': 5, '2,2': 'alto', '3,3': 0, '4,4': 99999 })).toEqual({ '1,1': 30, '4,4': 1000 });
    });

    test('entre dos alturas hay un acantilado: no se baja andando; el puente se cruza', () => {
        expect(isCliff(elevation, { x: 3, y: 2 }, { x: 3, y: 1 })).toBe(true);
        expect(canStepBetween(terrain, elevation, { x: 3, y: 2 }, { x: 4, y: 2 }, 9, 5)).toBe(true);
        expect(canStepBetween(terrain, elevation, { x: 4, y: 2 }, { x: 4, y: 1 }, 9, 5)).toBe(false);
        const fromRidge = walkableFrom(terrain, elevation, 9, 5, { x: 1, y: 1 });
        expect(fromRidge.has('7,2')).toBe(true); // la isla, por el puente
        expect(fromRidge.has('4,1')).toBe(false); // el suelo de abajo, no
        const fromGround = walkableFrom(terrain, elevation, 9, 5, { x: 4, y: 1 });
        expect(fromGround.has('1,1')).toBe(false);
        expect(fromGround.has('3,1')).toBe(true);
    });

    test('una rampa de 5 en 5 pies se sube; el borde del acantilado se dibuja', () => {
        const ramp = setElevation(setElevation({}, ['2,1'], 5), ['3,1'], CLIFF_FEET);
        expect(walkableFrom(terrain, ramp, 9, 5, { x: 1, y: 1 }).has('3,1')).toBe(true);
        const edges = cliffEdges(elevation, 9, 5);
        expect(edges).toContainEqual({ x: 3, y: 1, side: 'down', drop: -60 });
        expect(edges.every(e => Math.abs(e.drop) >= CLIFF_FEET)).toBe(true);
    });

    test('desde más arriba se ataca desde arriba, con cotas o con la casilla alta de siempre', () => {
        expect(heightBetween(terrain, { x: 1, y: 1 }, { x: 4, y: 1 }, elevation)).toBe('above');
        expect(heightBetween(terrain, { x: 4, y: 1 }, { x: 1, y: 1 }, elevation)).toBe('below');
        expect(heightBetween(terrain, { x: 1, y: 1 }, { x: 6, y: 2 }, elevation)).toBe('level');
        expect(heightBetween(terrainFromAsciiMap(['^.']), { x: 0, y: 0 }, { x: 1, y: 0 }, {})).toBe('above');
    });

    test('en un tablero sin imagen, la región a la misma altura para sin muros ni cambios de cota', () => {
        const cells = levelRegion(terrain, 9, 5, 2, 2, elevation);
        expect(cells).toHaveLength(ridge.length + 1 + island.length);
        expect(levelRegion(terrain, 9, 5, 0, 0, elevation)).toEqual([]);
        // Desde el suelo bajo el puente: lo de abajo que se toca por un lado, y nada más.
        expect(levelRegion(terrain, 9, 5, 4, 1, elevation)).toEqual(expect.arrayContaining([{ x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 }]));
        expect(levelRegion(terrain, 9, 5, 4, 1, elevation)).toHaveLength(3);
    });
});

describe('J12.11: las salas con nombre (zones.js)', () => {
    const zones = [
        { name: 'B1', rect: { x: 1, y: 1, width: 3, height: 2 }, note: 'Cuatro columnas y escombros.' },
        { name: 'El altar', cells: ['2,1', { x: 3, y: 1 }], note: 'Aquí espera el sacerdote.' },
        { name: 'B2', cells: ['5,1', '6,1', [7, 1]] },
    ];

    test('se leen con rect o con cells, y se dejan como se escribieron', () => {
        const clean = normalizeZones([...zones, null, 'x', { name: ' C ', rect: { x: 0, y: 0, w: 1, h: 1 } }]);
        expect(clean).toHaveLength(4);
        expect(clean[0]).toEqual({ name: 'B1', rect: { x: 1, y: 1, width: 3, height: 2 }, note: 'Cuatro columnas y escombros.' });
        expect(clean[1].cells).toEqual(['2,1', '3,1']);
        expect(clean[3]).toEqual({ name: 'C', rect: { x: 0, y: 0, width: 1, height: 1 } });
        expect(zoneCells(clean[0])).toHaveLength(6);
        expect(zoneFromCells('B3', [{ x: 1, y: 1 }, '2,1'], 'Nota')).toEqual({ name: 'B3', cells: ['1,1', '2,1'], note: 'Nota' });
    });

    test('zoneAt dice en qué sala cae una casilla; si caen dos, la de dentro', () => {
        const board = { zones };
        expect(zoneAt(board, 1, 2)?.name).toBe('B1');
        expect(zoneAt(board, 2, 1)?.name).toBe('El altar');
        expect(zoneAt(zones, 7, 1)?.name).toBe('B2');
        expect(zoneAt(board, 4, 4)).toBeNull();
        expect(zoneAt(null, 1, 1)).toBeNull();
    });

    test('se valida lo que un autor escribe mal', () => {
        const terrain = terrainFromAsciiMap(['#########', '#...#...#', '#...#...#', '#########']);
        expect(validateZones(zones, 9, 4, { terrain })).toEqual({ errors: [], warnings: [] });
        const bad = validateZones([
            { rect: { x: 1, y: 1, width: 1, height: 1 } },
            { name: 'B1', cells: ['1,1'] },
            { name: 'b1', cells: ['2,1'] },
            { name: 'Fuera', cells: ['20,1'] },
            { name: 'Vacía', rect: { x: 1, y: 1, width: 0, height: 2 } },
            { name: 'Pared', cells: ['0,0', '1,0'] },
            { name: 'Cruce', rect: { x: 1, y: 1, width: 2, height: 1 } },
        ], 9, 4, { terrain, path: 'boards[0].zones' });
        const messages = bad.errors.map(e => `${e.path}: ${e.message}`).join('\n');
        expect(messages).toMatch(/zones\[0\]: Sin nombre/);
        expect(messages).toMatch(/zones\[2\]: "b1" está repetida/);
        expect(messages).toMatch(/"Fuera" tiene 1 casilla\(s\) fuera del tablero/);
        expect(messages).toMatch(/zones\[4\]\.rect/);
        expect(bad.warnings.map(w => w.message).join('\n')).toMatch(/"Pared" cae entera sobre muro/);
        expect(validateZones('B1', 9, 4).errors[0].message).toMatch(/lista/);
        expect(validateZones(undefined, 9, 4)).toEqual({ errors: [], warnings: [] });
    });

    test('las salas del tablero toman el nombre de la zona que las cubre', () => {
        const rooms = [
            { id: 'room_1', name: '', cells: ['1,1', '2,1', '3,1', '1,2', '2,2', '3,2'] },
            { id: 'room_2', name: '', cells: ['5,1', '6,1', '7,1', '5,2', '6,2', '7,2'] },
            { id: 'room_3', name: '', cells: ['9,9'] },
            { id: 'room_4', name: 'Ya tenía', cells: ['1,1'] },
        ];
        const named = nameRoomsFromZones(rooms, zones);
        expect(named.map(r => r.name)).toEqual(['B1', 'B2', '', 'Ya tenía']);
        expect(nameRoomsFromZones(rooms, [])).toBe(rooms);
    });
});

describe('J12.12: el tablero dibujado en el paquete de campaña', () => {
    const MAP = ['#######', '..#....', '#......', '#######'];
    const pack = (board = {}) => ({
        version: CAMPAIGN_PACK_VERSION,
        world: { name: 'Mundo' },
        bestiary: [{ name: 'Cuervo', hp: 7, armorClass: 12, cr: 0.125, profile: 'skirmisher' }],
        boards: [{
            id: 'cueva', name: 'La cueva', locationName: 'Mundo', map: MAP,
            partyStart: [{ x: 1, y: 2 }], enemies: [{ name: 'Cuervo', x: 5, y: 2 }],
            image: 'mundos/prueba/cueva.png',
            grid: { cell: 74.37, offsetX: 31, offsetY: 5.5, cols: 7, rows: 4 },
            zones: [{ name: 'B1', rect: { x: 3, y: 1, width: 4, height: 2 }, note: 'El cuervo.' }],
            elevation: { '5,1': 30, '6,1': 30 },
            ...board,
        }],
        quests: [{ id: 'q1', name: 'Mision', boardId: 'cueva', objectives: [{ type: 'eliminate_all', label: 'Limpiar' }] }],
    });

    test('image, grid, zones y elevation pasan; y con imagen el borde puede tener suelo', () => {
        const report = validatePack(pack());
        expect(report.errors).toEqual([]);
        expect(report.ok).toBe(true);
        // Sin imagen, el borde abierto sigue siendo un error.
        const plain = validatePack(pack({ image: undefined, grid: undefined }));
        expect(plain.errors.map(e => e.message).join()).toMatch(/borde exterior/);
    });

    test('lo que no cuadra se dice: la cuadrícula con otro tamaño, zonas fuera, cotas raras', () => {
        const report = validatePack(pack({
            image: '',
            grid: { cell: 74, cols: 8, rows: 4 },
            zones: [{ name: 'B1', cells: ['30,1'] }],
            elevation: { '1,1': 'alto', '40,1': 30 },
        }));
        const text = report.errors.map(e => `${e.path}: ${e.message}`).join('\n');
        expect(text).toMatch(/boards\[0\]\.image/);
        expect(text).toMatch(/boards\[0\]\.grid\.cols: La cuadrícula tiene 8 columnas y el mapa 7/);
        expect(text).toMatch(/boards\[0\]\.zones\[0\]/);
        expect(text).toMatch(/1 cota\(s\) no se entienden/);
        expect(text).toMatch(/1 cota\(s\) caen fuera del mapa/);
        expect(validatePack(pack({ grid: { offsetX: 3 } })).errors.map(e => e.path)).toContain('boards[0].grid');
        expect(validatePack(pack({ image: 'https://example.com/m.png' })).warnings.map(w => w.path)).toContain('boards[0].image');
        expect(validatePack(pack({ image: undefined })).warnings.map(w => w.message).join()).toMatch(/no hay dibujo/);
    });

    test('el esquema lo cuenta, y el importador lo lleva al tablero del juego', () => {
        const props = getSectionSchema('boards').items.properties;
        expect(Object.keys(props)).toEqual(expect.arrayContaining(['image', 'grid', 'zones', 'elevation']));
        const board = buildImportPlan(pack()).metadata.locationMaps[0].boards[0];
        expect(board.url).toBe('mundos/prueba/cueva.png');
        expect(board.grid).toEqual({ cell: 74.37, offsetX: 31, offsetY: 5.5, cols: 7, rows: 4 });
        expect(board.zones[0].name).toBe('B1');
        expect(board.elevation).toEqual({ '5,1': 30, '6,1': 30 });
        expect(board.rooms.find(r => r.cells.includes('4,1'))?.name).toBe('B1');
        // Un tablero de siempre, sin nada de esto, sale como salía.
        const old = buildImportPlan(pack({ image: undefined, grid: undefined, zones: undefined, elevation: undefined, map: ['#######', '#..#..#', '#.....#', '#######'] })).metadata.locationMaps[0].boards[0];
        expect(old.url).toBe('');
        expect(old).not.toHaveProperty('grid');
        expect(old).not.toHaveProperty('zones');
        expect(old).not.toHaveProperty('elevation');
    });
});
