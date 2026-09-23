/**
 * Un sitio donde pelear, construido con una semilla y ni un token.
 *
 * La idea que lo ordena, y que vale para todo el Nivel 3: **las tablas deciden la
 * estructura y el modelo solo pone los nombres.** Cuántas salas tiene la cripta, por dónde
 * se pasa, dónde van las puertas y en qué esquina está el bicho son decisiones
 * geométricas, y la geometría no necesita un modelo de lenguaje: necesita un algoritmo y
 * un dado. Lo que sí necesita un modelo es cómo huele la sala, y eso se pide **una vez y
 * en lote**, no una llamada por pasillo.
 *
 * Determinista de arriba abajo: la misma semilla da el mismo sitio, siempre. Eso es lo que
 * separa «generar un mundo» de «tener un mundo»: una cripta que cambia cada vez que entras
 * no es un lugar, es un fondo de pantalla — no hay mapa que aprender ni sitio al que
 * volver.
 *
 * Produce **exactamente** la forma que ya leen el importador y el editor: un mapa ASCII
 * con la leyenda de `terrain.js`, casillas de inicio y enemigos colocados por nombre. Es la
 * tercera puerta al mismo destino, detrás del libro importado y de la mano.
 *
 * Puro: la aleatoriedad entra como función. No dibuja, no guarda y no llama a nadie.
 *
 * Ver wiki/ROADMAP_MAESTRO.md, Nivel 3.
 */

import {
    SHAPES, carveCave, carveCamp, carveTemple, floodRegions,
    connectRegions, applyCoverBudget, placeRoom, COVER_BUDGET,
} from './shapes.js';

/**
 * @typedef {Object} GeneratedRoom
 * @property {number} x  Esquina superior izquierda, contando el muro.
 * @property {number} y
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {Object} GeneratedBoard
 * @property {string[]} map            Filas ASCII, con la leyenda de `terrain.js`.
 * @property {number} gridWidth
 * @property {number} gridHeight
 * @property {GeneratedRoom[]} rooms
 * @property {Array<{x: number, y: number}>} partyStart
 * @property {Array<{name: string, x: number, y: number}>} enemies
 * @property {Array<{x: number, y: number}>} doors
 */

/** Lo que mide un sitio de cada tamaño, y cuántas salas le caben. */
export const BOARD_SHAPES = {
    small: { width: 14, height: 10, rooms: 3 },
    medium: { width: 20, height: 14, rooms: 5 },
    large: { width: 26, height: 18, rooms: 7 },
};

/** Lo mínimo que puede medir una sala por dentro, sin contar sus muros. */
const MIN_ROOM = 3;

/**
 * @param {() => number} random
 * @param {number} min
 * @param {number} max Incluido.
 * @returns {number}
 */
function between(random, min, max) {
    if (max <= min) return min;
    const value = Math.floor(random() * (max - min + 1));
    return min + Math.max(0, Math.min(max - min, value));
}

/**
 * Corta un rectángulo en dos, una y otra vez, hasta tener salas.
 *
 * Es el método de siempre —partición binaria— y se usa aquí por una razón concreta: **no
 * puede producir salas superpuestas**, que es el fallo que convierte un generador en un
 * borrón. Cada hoja del árbol es una sala, y entre hermanas siempre cabe un pasillo.
 *
 * @param {() => number} random
 * @param {{x: number, y: number, width: number, height: number}} area
 * @param {number} depth
 * @returns {GeneratedRoom[]}
 */
function split(random, area, depth) {
    const minSize = MIN_ROOM + 2; // la sala más pequeña, con sus dos muros
    if (depth <= 0 || (area.width < minSize * 2 && area.height < minSize * 2)) {
        return [{ ...area }];
    }

    // Se parte por el lado largo: partir siempre por el mismo da pasillos de tren.
    const horizontal = area.height > area.width
        ? true
        : (area.width === area.height ? random() < 0.5 : false);

    if (horizontal) {
        if (area.height < minSize * 2) return [{ ...area }];
        const cut = between(random, minSize, area.height - minSize);
        return [
            ...split(random, { ...area, height: cut }, depth - 1),
            ...split(random, { ...area, y: area.y + cut, height: area.height - cut }, depth - 1),
        ];
    }

    if (area.width < minSize * 2) return [{ ...area }];
    const cut = between(random, minSize, area.width - minSize);
    return [
        ...split(random, { ...area, width: cut }, depth - 1),
        ...split(random, { ...area, x: area.x + cut, width: area.width - cut }, depth - 1),
    ];
}

/**
 * El centro de una sala, que es por donde se la atraviesa.
 *
 * @param {GeneratedRoom} room
 * @returns {{x: number, y: number}}
 */
function centreOf(room) {
    return {
        x: room.x + Math.floor(room.width / 2),
        y: room.y + Math.floor(room.height / 2),
    };
}

/**
 * Genera un tablero jugable.
 *
 * @param {Object} [options]
 * @param {() => number} [options.random] El dado. Sin él, `Math.random` — pero entonces
 *        deja de ser repetible, que es medio sentido de esto.
 * @param {'small'|'medium'|'large'} [options.size]
 * @param {string} [options.shape] De que forma es: salas, cueva, campamento o templo.
 *        Una cueva no tiene salas y un campamento no tiene pasillos: cada uno pide otro
 *        algoritmo, no otro tamano.
 * @param {string[][]} [options.templates] Salas escritas a mano, para estampar dentro. Un
 *        algoritmo hace sitios variados y ninguno memorable; una sala escrita es
 *        memorable y siempre la misma. Estampar una dentro del otro da las dos cosas.
 * @param {{cover?: number, rough?: number}} [options.state] En que estado esta el sitio.
 *        Una cripta inundada y una saqueada no se juegan igual.
 * @param {string[]} [options.bestiary] Nombres del bestiario del mundo, para poblarlo.
 * @param {number} [options.partySize]
 * @param {number} [options.enemyCount] Cuántos bichos. Por defecto, uno por sala menos una.
 * @returns {GeneratedBoard}
 */
export function generateBoard(options = {}) {
    const random = typeof options.random === 'function' ? options.random : Math.random;
    const shape = BOARD_SHAPES[options.size ?? 'medium'] ?? BOARD_SHAPES.medium;
    const { width, height } = shape;

    // De que forma es el sitio. Una cueva no tiene salas y un campamento no tiene
    // pasillos: cada uno pide **otro algoritmo**, no otro tamano.
    const style = SHAPES.includes(String(options.shape || '')) ? String(options.shape) : 'rooms';
    if (style !== 'rooms') {
        return generateShaped(style, { width, height, random, ...options });
    }

    // Todo muro, y las salas se excavan. Empezar lleno y vaciar garantiza el borde
    // exterior cerrado, que es lo primero que comprueba el validador del paquete.
    const grid = Array.from({ length: height }, () => Array.from({ length: width }, () => '#'));

    const rooms = split(random, { x: 0, y: 0, width, height }, 3)
        .filter(room => room.width >= MIN_ROOM + 2 && room.height >= MIN_ROOM + 2)
        .slice(0, shape.rooms);

    for (const room of rooms) {
        for (let y = room.y + 1; y < room.y + room.height - 1; y++) {
            for (let x = room.x + 1; x < room.x + room.width - 1; x++) {
                grid[y][x] = '.';
            }
        }
    }

    // Pasillos en L entre sala y sala consecutiva: con eso, todas quedan conectadas en
    // cadena y no hay forma de que nazca una sala a la que no se puede llegar. Es el
    // error que el validador caza y que arruina un tablero entero.
    /** @type {Array<{x: number, y: number}>} */
    const doors = [];

    for (let i = 1; i < rooms.length; i++) {
        const from = centreOf(rooms[i - 1]);
        const to = centreOf(rooms[i]);

        /**
         * Excava una casilla del pasillo.
         *
         * Una puerta es **cruzar una pared**, no excavar un tunel. Lo que decide cual de
         * las dos cosas esta pasando es lo que hay **delante**: si al otro lado ya hay
         * suelo, este muro es la pared de una sala y ahi va la puerta; si delante sigue
         * habiendo roca, esto es un tunel y una puerta en mitad de la roca no la pone
         * nadie. Sin esta distincion salian pasillos enteros de puertas.
         *
         * @param {number} x
         * @param {number} y
         * @param {number} dx Hacia donde avanza el pasillo.
         * @param {number} dy
         */
        const carve = (x, y, dx, dy) => {
            if (y <= 0 || y >= height - 1 || x <= 0 || x >= width - 1) return;
            if (grid[y][x] !== '#') return;

            const acrossWall = dx !== 0
                ? grid[y - 1]?.[x] === '#' && grid[y + 1]?.[x] === '#'
                : grid[y][x - 1] === '#' && grid[y][x + 1] === '#';
            const ahead = grid[y + dy]?.[x + dx];
            const opens = ahead !== undefined && ahead !== '#';

            grid[y][x] = (acrossWall && opens) ? 'D' : '.';
            if (grid[y][x] === 'D') doors.push({ x, y });
        };

        const stepX = from.x < to.x ? 1 : -1;
        for (let x = from.x; x !== to.x; x += stepX) carve(x, from.y, stepX, 0);
        const stepY = from.y < to.y ? 1 : -1;
        for (let y = from.y; y !== to.y; y += stepY) carve(to.x, y, 0, stepY);
        carve(to.x, to.y, stepX, 0);
    }

    // Cobertura: unas pocas columnas sueltas dentro de las salas grandes. Una sala vacía
    // se juega sola —todo el mundo se pega y tira— y con dos estorbos ya hay que elegir
    // por dónde ir.
    for (const room of rooms) {
        if (room.width < 7 || room.height < 6) continue;
        const pillars = between(random, 1, 2);
        for (let i = 0; i < pillars; i++) {
            const x = between(random, room.x + 2, room.x + room.width - 3);
            const y = between(random, room.y + 2, room.y + room.height - 3);
            if (grid[y][x] === '.') grid[y][x] = random() < 0.5 ? 'c' : 'C';
        }
    }

    // Las salas escritas a mano y el estado del sitio, **antes** de colocar a nadie: si
    // se estampa despues, una sala puede caerle encima al grupo y dejarlo dentro de un
    // muro. Primero se termina el mapa, luego se reparte la gente.
    stampWritten(grid, options, random);
    applyState(grid, options, random);
    connectRegions(grid);

    const floorsOf = (/** @type {GeneratedRoom} */ room) => {
        /** @type {Array<{x: number, y: number}>} */
        const cells = [];
        for (let y = room.y + 1; y < room.y + room.height - 1; y++) {
            for (let x = room.x + 1; x < room.x + room.width - 1; x++) {
                if (grid[y][x] === '.') cells.push({ x, y });
            }
        }
        return cells;
    };

    // El grupo entra por la primera sala; los bichos esperan en las demás. Que no
    // compartan sala es lo que da un turno para mirar antes de que empiece el ruido.
    const entrance = rooms[0] ? floorsOf(rooms[0]) : [];
    const partyStart = entrance.slice(0, Math.max(1, Math.floor(Number(options.partySize) || 2)));

    /** @type {Array<{name: string, x: number, y: number}>} */
    const enemies = [];
    const bestiary = (Array.isArray(options.bestiary) ? options.bestiary : []).filter(Boolean);

    if (bestiary.length > 0 && rooms.length > 1) {
        const wanted = Math.max(1, Math.floor(Number(options.enemyCount) || (rooms.length - 1)));
        for (let i = 0; i < wanted; i++) {
            const room = rooms[1 + (i % (rooms.length - 1))];
            const cells = floorsOf(room);
            if (cells.length === 0) continue;
            const cell = cells[between(random, 0, cells.length - 1)];
            const taken = enemies.some(e => e.x === cell.x && e.y === cell.y);
            if (taken) continue;
            enemies.push({ name: bestiary[between(random, 0, bestiary.length - 1)], ...cell });
        }
    }

    return {
        map: grid.map(row => row.join('')),
        gridWidth: width,
        gridHeight: height,
        rooms,
        partyStart,
        enemies,
        doors,
    };
}

/**
 * Estampa las salas escritas a mano que quepan.
 *
 * @param {string[][]} grid
 * @param {any} options
 * @param {() => number} random
 */
function stampWritten(grid, options, random) {
    const templates = (Array.isArray(options.templates) ? options.templates : [])
        .filter(rows => Array.isArray(rows) && rows.length > 0);
    if (templates.length === 0) return;

    // Una o dos, no cinco: un tablero hecho solo de salas escritas es un tablero escrito
    // a mano con pasos de mas.
    const wanted = between(random, 1, Math.min(2, templates.length));
    const used = new Set();

    for (let i = 0; i < wanted; i++) {
        let at = between(random, 0, templates.length - 1);
        for (let guard = 0; guard < templates.length && used.has(at); guard++) {
            at = (at + 1) % templates.length;
        }
        if (used.has(at)) break;
        used.add(at);
        placeRoom(grid, templates[at], random);
    }
}

/**
 * Deja el sitio como su estado dice que esta.
 *
 * @param {string[][]} grid
 * @param {any} options
 * @param {() => number} random
 */
function applyState(grid, options, random) {
    const state = (options.state && typeof options.state === 'object') ? options.state : null;
    if (!state) return;

    const cover = Number(state.cover);
    if (Number.isFinite(cover)) {
        // Un margen estrecho alrededor de lo que pide el estado: exigir el numero exacto
        // haria dar vueltas al presupuesto sin que se note la diferencia.
        applyCoverBudget(grid, random, {
            min: Math.max(0, cover - 0.03),
            max: Math.min(1, cover + 0.03),
        });
    }

    const rough = Number(state.rough);
    if (!Number.isFinite(rough) || rough <= 0) return;

    const height = grid.length;
    const width = grid[0]?.length ?? 0;
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            if (grid[y][x] === '.' && random() < rough) grid[y][x] = '~';
        }
    }
}

/**
 * Un sitio que no se construye con salas y pasillos.
 *
 * Lo que cambia es **como se excava**; lo demas —quien entra por donde, donde esperan los
 * bichos, que haya cobertura de sobra— es lo mismo, porque son decisiones de juego y no
 * de geometria.
 *
 * Como no hay salas rectangulares, el grupo y los bichos se reparten por **los trozos de
 * suelo unidos entre si**: el grupo en el mas grande y los bichos lejos de el. Que no
 * compartan sitio es lo que da un turno para mirar antes de que empiece el ruido.
 *
 * @param {string} style
 * @param {any} options
 * @returns {GeneratedBoard}
 */
function generateShaped(style, options) {
    const { width, height, random } = options;
    const grid = Array.from({ length: height }, () => Array.from({ length: width }, () => '#'));

    if (style === 'cave') carveCave(grid, random);
    else if (style === 'camp') carveCamp(grid, random);
    else carveTemple(grid, random);

    // Las dos guardas que valen para todas las formas: que se llegue a todo y que no
    // salga pelado. Las dos se arreglan aqui y no en el validador, porque cazarlo tarde
    // solo sirve para tirar el tablero.
    stampWritten(grid, options, random);
    connectRegions(grid);

    // El estado manda sobre el presupuesto de siempre; sin estado, el de siempre.
    if (options.state) applyState(grid, options, random);
    else applyCoverBudget(grid, random, COVER_BUDGET);

    const regions = floodRegions(grid);
    const floor = regions[0] ?? [];

    // Un rectangulo que envuelve cada trozo, para que lo que venga detras —el editor, el
    // paquete, las salas con puerta— siga leyendo lo mismo que siempre.
    const rooms = regions.slice(0, 6).map(region => {
        const xs = region.map(cell => cell.x);
        const ys = region.map(cell => cell.y);
        const x = Math.min(...xs);
        const y = Math.min(...ys);
        return { x, y, width: Math.max(...xs) - x + 1, height: Math.max(...ys) - y + 1 };
    });

    const wanted = Math.max(1, Math.floor(Number(options.partySize) || 2));

    /** @type {Array<{name: string, x: number, y: number}>} */
    const enemies = [];
    const bestiary = (Array.isArray(options.bestiary) ? options.bestiary : []).filter(Boolean);

    // Suelo limpio: un bicho encima de una columna no se puede dibujar, y descartarlas
    // de una en una dejaba campamentos enteros sin un solo enemigo.
    const clear = floor.filter(cell => grid[cell.y]?.[cell.x] === '.');

    if (bestiary.length > 0 && clear.length > wanted) {
        const count = Math.max(1, Math.floor(Number(options.enemyCount) || 3));
        // Del final de la lista hacia atras: es lo mas lejos del inicio que hay sin
        // medir distancias, y medirlas aqui no compra nada.
        for (let i = 0; i < count && i < clear.length - wanted; i++) {
            enemies.push({
                name: bestiary[between(random, 0, bestiary.length - 1)],
                ...clear[clear.length - 1 - i],
            });
        }
    }

    return {
        map: grid.map(row => row.join('')),
        gridWidth: width,
        gridHeight: height,
        rooms,
        partyStart: clear.slice(0, wanted),
        enemies,
        // Una cueva no tiene puertas, y fingirlas seria dibujar una puerta en la roca.
        doors: [],
    };
}

/**
 * Lo que lleva el sitio, en una línea.
 *
 * @param {GeneratedBoard} board
 * @returns {string}
 */
export function describeBoard(board) {
    return [
        `${board.gridWidth}x${board.gridHeight}`,
        `${board.rooms.length} sala(s)`,
        `${board.doors.length} puerta(s)`,
        `${board.enemies.length} enemigo(s)`,
    ].join(' · ');
}
