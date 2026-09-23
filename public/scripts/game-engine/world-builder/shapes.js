/**
 * De que forma es un sitio.
 *
 * El generador sabia hacer una cosa —salas rectangulares unidas por pasillos en L— y por
 * eso todas las mazmorras se parecian. Una cueva no tiene salas; un campamento no tiene
 * pasillos; un templo es simetrico. Cada uno pide **otro algoritmo**, no otro tamano.
 *
 * Lo que hay aqui son las formas y dos guardas que valen para todas:
 *
 * - **Que se pueda llegar a todo.** Un sitio con una sala inalcanzable es un sitio roto, y
 *   con un algoritmo organico pasa constantemente. Se comprueba y se arregla.
 * - **Que no salga pelado.** Una sala vacia se juega sola: todo el mundo se pega y tira.
 *   Entre el 8 % y el 15 % de cobertura, medido y corregido.
 *
 * Trabajan sobre una rejilla de caracteres con la leyenda de `terrain.js`, que es la misma
 * que leen el importador, el editor y las plantillas escritas a mano.
 *
 * Puro: la aleatoriedad entra como funcion.
 *
 * Ver wiki/ALGORITMOS_GENERACION.md (#13-#21, #27).
 */

/** Las formas que sabe hacer. La primera es la de siempre. */
export const SHAPES = ['rooms', 'cave', 'camp', 'temple'];

/** Cuanta cobertura tiene que tener un sitio para que se juegue. */
export const COVER_BUDGET = { min: 0.08, max: 0.15 };

const WALL = '#';
const FLOOR = '.';
const HALF = 'c';
const FULL = 'C';
const ROUGH = '~';

/**
 * @param {() => number} random
 * @param {number} min
 * @param {number} max Incluido.
 * @returns {number}
 */
function between(random, min, max) {
    if (max <= min) return min;
    return min + Math.floor(random() * (max - min + 1));
}

/**
 * Una rejilla llena de muro.
 *
 * Empezar lleno y excavar garantiza el borde exterior cerrado, que es lo primero que
 * comprueba el validador del paquete.
 *
 * @param {number} width
 * @param {number} height
 * @returns {string[][]}
 */
export function solidGrid(width, height) {
    return Array.from({ length: height }, () => Array.from({ length: width }, () => WALL));
}

/**
 * Si una casilla se puede pisar.
 *
 * @param {string[][]} grid
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
function walkable(grid, x, y) {
    const cell = grid[y]?.[x];
    return cell !== undefined && cell !== WALL;
}

/**
 * Los trozos de suelo que estan unidos entre si.
 *
 * Es la base de todo lo demas: sin saber que partes hay, no se puede decir si se llega a
 * todas ni donde poner al grupo.
 *
 * @param {string[][]} grid
 * @returns {Array<Array<{x: number, y: number}>>} De mayor a menor.
 */
export function floodRegions(grid) {
    const height = grid.length;
    const width = grid[0]?.length ?? 0;
    const seen = new Set();
    /** @type {Array<Array<{x: number, y: number}>>} */
    const regions = [];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (!walkable(grid, x, y) || seen.has(`${x},${y}`)) continue;

            /** @type {Array<{x: number, y: number}>} */
            const region = [];
            const queue = [{ x, y }];
            seen.add(`${x},${y}`);

            while (queue.length > 0) {
                const at = queue.pop();
                if (!at) break;
                region.push(at);

                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    const nx = at.x + dx;
                    const ny = at.y + dy;
                    if (!walkable(grid, nx, ny) || seen.has(`${nx},${ny}`)) continue;
                    seen.add(`${nx},${ny}`);
                    queue.push({ x: nx, y: ny });
                }
            }

            regions.push(region);
        }
    }

    return regions.sort((a, b) => b.length - a.length);
}

/**
 * Une lo que haya quedado suelto, excavando en linea recta.
 *
 * Un sitio con una parte a la que no se puede llegar es un sitio roto, y con un algoritmo
 * organico eso pasa casi siempre. Se arregla aqui y no se deja para el validador: cazarlo
 * tarde solo sirve para tirar el tablero.
 *
 * @param {string[][]} grid
 * @returns {number} Cuantos trozos hubo que unir.
 */
export function connectRegions(grid) {
    let joined = 0;

    for (let guard = 0; guard < 20; guard++) {
        const regions = floodRegions(grid);
        if (regions.length <= 1) break;

        const main = regions[0];
        const loose = regions[1];
        // Los dos puntos mas cercanos entre el trozo grande y el suelto. Excavar entre
        // ellos es el tunel mas corto, y el mas corto es el que menos se nota.
        let best = { from: main[0], to: loose[0], distance: Infinity };
        for (const a of main) {
            for (const b of loose) {
                const distance = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
                if (distance < best.distance) best = { from: a, to: b, distance };
            }
        }

        const stepX = best.from.x < best.to.x ? 1 : -1;
        for (let x = best.from.x; x !== best.to.x; x += stepX) {
            if (grid[best.from.y]?.[x] === WALL) grid[best.from.y][x] = FLOOR;
        }
        const stepY = best.from.y < best.to.y ? 1 : -1;
        for (let y = best.from.y; y !== best.to.y; y += stepY) {
            if (grid[y]?.[best.to.x] === WALL) grid[y][best.to.x] = FLOOR;
        }

        joined++;
    }

    return joined;
}

/**
 * Quita las esquinas sueltas.
 *
 * Una sola pasada, y con eso un automata celular deja de parecer una rejilla. Es la
 * diferencia entre una cueva y un dibujo de una cueva.
 *
 * @param {string[][]} grid
 */
export function erode(grid) {
    const height = grid.length;
    const width = grid[0]?.length ?? 0;
    /** @type {Array<{x: number, y: number}>} */
    const lonely = [];

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            if (grid[y][x] !== WALL) continue;
            const neighbours = [[1, 0], [-1, 0], [0, 1], [0, -1]]
                .filter(([dx, dy]) => grid[y + dy]?.[x + dx] === WALL).length;
            // Un muro con un solo muro al lado es una pua: sobra.
            if (neighbours <= 1) lonely.push({ x, y });
        }
    }

    for (const cell of lonely) grid[cell.y][cell.x] = FLOOR;
}

/**
 * Cuanta cobertura tiene un sitio, sobre el suelo que tiene.
 *
 * @param {string[][]} grid
 * @returns {number} Entre 0 y 1.
 */
export function coverRatio(grid) {
    let floors = 0;
    let cover = 0;
    for (const row of grid) {
        for (const cell of row) {
            if (cell === WALL) continue;
            floors++;
            if (cell === HALF || cell === FULL) cover++;
        }
    }
    return floors === 0 ? 0 : cover / floors;
}

/**
 * Pone o quita cobertura hasta que el sitio se pueda jugar.
 *
 * Una sala vacia se juega sola: todo el mundo se pega y tira. Con estorbos hay que elegir
 * por donde ir, y eso es lo unico que separa un combate tactico de una tirada de dados.
 *
 * @param {string[][]} grid
 * @param {() => number} random
 * @param {{min?: number, max?: number}} [budget]
 */
export function applyCoverBudget(grid, random, budget = {}) {
    const min = budget.min ?? COVER_BUDGET.min;
    const max = budget.max ?? COVER_BUDGET.max;
    const height = grid.length;
    const width = grid[0]?.length ?? 0;

    for (let guard = 0; guard < 400; guard++) {
        const ratio = coverRatio(grid);
        if (ratio >= min && ratio <= max) return;

        const x = between(random, 1, Math.max(1, width - 2));
        const y = between(random, 1, Math.max(1, height - 2));

        if (ratio < min) {
            // No se tapa un paso de una casilla: eso no es cobertura, es un muro.
            if (grid[y][x] !== FLOOR) continue;
            const open = [[1, 0], [-1, 0], [0, 1], [0, -1]]
                .filter(([dx, dy]) => walkable(grid, x + dx, y + dy)).length;
            if (open < 3) continue;
            grid[y][x] = random() < 0.6 ? HALF : FULL;
        } else if (grid[y][x] === HALF || grid[y][x] === FULL) {
            grid[y][x] = FLOOR;
        }
    }
}

/**
 * Una cueva: automata celular.
 *
 * Ruido, y luego cuatro pasadas en las que cada casilla se parece a sus vecinas. Sale algo
 * organico y sin una sola esquina recta, que es justo lo que un BSP no sabe hacer.
 *
 * @param {string[][]} grid
 * @param {() => number} random
 * @param {{fill?: number, steps?: number}} [options]
 */
export function carveCave(grid, random, options = {}) {
    const fill = options.fill ?? 0.45;
    const steps = options.steps ?? 4;
    const height = grid.length;
    const width = grid[0]?.length ?? 0;

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            grid[y][x] = random() < fill ? WALL : FLOOR;
        }
    }

    for (let step = 0; step < steps; step++) {
        const before = grid.map(row => [...row]);
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let walls = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        if ((before[y + dy]?.[x + dx] ?? WALL) === WALL) walls++;
                    }
                }
                // Cinco o mas vecinos de muro, muro. Es la regla de toda la vida, y la que
                // convierte ruido en cuevas en cuatro pasadas.
                grid[y][x] = walls >= 5 ? WALL : FLOOR;
            }
        }
    }

    erode(grid);
    connectRegions(grid);

    // Un poco de suelo malo: charcos, no casillas sueltas. Una casilla dificil suelta solo
    // es un impuesto; un charco de tres es algo que se rodea.
    const puddles = between(random, 1, 3);
    for (let i = 0; i < puddles; i++) {
        const cx = between(random, 2, Math.max(2, width - 3));
        const cy = between(random, 2, Math.max(2, height - 3));
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (grid[cy + dy]?.[cx + dx] === FLOOR && random() < 0.7) {
                    grid[cy + dy][cx + dx] = ROUGH;
                }
            }
        }
    }
}

/**
 * Un campamento: un claro con cosas puestas.
 *
 * Sin pasillos y sin salas. Lo que da forma no son los muros sino **donde esta puesto lo
 * que estorba**: las tiendas, las carretas, la hoguera. Se ve de lado a lado y aun asi hay
 * que elegir por donde ir.
 *
 * @param {string[][]} grid
 * @param {() => number} random
 * @param {{clusters?: number}} [options]
 */
export function carveCamp(grid, random, options = {}) {
    const height = grid.length;
    const width = grid[0]?.length ?? 0;

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) grid[y][x] = FLOOR;
    }

    const clusters = options.clusters ?? between(random, 4, 7);
    for (let i = 0; i < clusters; i++) {
        const cx = between(random, 2, Math.max(2, width - 3));
        const cy = between(random, 2, Math.max(2, height - 3));
        const size = between(random, 1, 2);

        for (let dy = -size; dy <= size; dy++) {
            for (let dx = -size; dx <= size; dx++) {
                const x = cx + dx;
                const y = cy + dy;
                if (x <= 0 || y <= 0 || x >= width - 1 || y >= height - 1) continue;
                if (random() < 0.35) continue;
                grid[y][x] = random() < 0.5 ? HALF : FULL;
            }
        }
    }

    connectRegions(grid);
}

/**
 * Un templo: simetrico, y con un fallo.
 *
 * La simetria dice que alguien lo construyo. El fallo dice que lleva ahi mucho tiempo: un
 * sitio simetrico al cien por cien no es un sitio, es un patron.
 *
 * @param {string[][]} grid
 * @param {() => number} random
 */
export function carveTemple(grid, random) {
    const height = grid.length;
    const width = grid[0]?.length ?? 0;
    const half = Math.floor(width / 2);

    // Nave central de lado a lado, y capillas a los lados.
    const naveTop = Math.max(1, Math.floor(height / 2) - 2);
    const naveBottom = Math.min(height - 2, Math.floor(height / 2) + 2);
    for (let y = naveTop; y <= naveBottom; y++) {
        for (let x = 1; x < width - 1; x++) grid[y][x] = FLOOR;
    }

    const chapels = between(random, 2, 3);
    for (let i = 0; i < chapels; i++) {
        const cx = between(random, 3, Math.max(3, half - 2));
        const depth = between(random, 2, 3);

        for (let d = 1; d <= depth; d++) {
            for (let dx = -1; dx <= 1; dx++) {
                const up = naveTop - d;
                const down = naveBottom + d;
                const left = cx + dx;
                const right = width - 1 - (cx + dx);
                if (up > 0) {
                    grid[up][left] = FLOOR;
                    grid[up][right] = FLOOR;
                }
                if (down < height - 1) {
                    grid[down][left] = FLOOR;
                    grid[down][right] = FLOOR;
                }
            }
        }
    }

    // Columnas en la nave, tambien a pares: es lo que hace que se lea como un templo.
    for (let x = 3; x < half - 1; x += 3) {
        const y = random() < 0.5 ? naveTop : naveBottom;
        grid[y][x] = FULL;
        grid[y][width - 1 - x] = FULL;
    }

    // Y el fallo: un trozo derrumbado que rompe el espejo.
    const bx = between(random, half + 1, Math.max(half + 1, width - 3));
    const by = between(random, naveTop, naveBottom);
    for (let dy = 0; dy <= 1; dy++) {
        for (let dx = 0; dx <= 1; dx++) {
            if (grid[by + dy]?.[bx + dx] !== undefined) grid[by + dy][bx + dx] = WALL;
        }
    }

    connectRegions(grid);
}

/**
 * Gira una sala escrita a mano.
 *
 * Cuatro giros por dos espejos son **ocho salas por cada una que escribas**, y ninguna se
 * reconoce como la misma de un vistazo. Es la forma mas barata que hay de multiplicar
 * trabajo hecho a mano.
 *
 * @param {string[]} rows
 * @param {number} quarters Cuartos de vuelta, a la derecha.
 * @returns {string[]}
 */
export function rotateTemplate(rows, quarters = 1) {
    let out = (Array.isArray(rows) ? rows : []).map(row => [...String(row)]);

    for (let turn = 0; turn < ((Math.round(quarters) % 4) + 4) % 4; turn++) {
        const height = out.length;
        const width = out[0]?.length ?? 0;
        const turned = Array.from({ length: width }, () => Array.from({ length: height }, () => ' '));
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) turned[x][height - 1 - y] = out[y][x] ?? ' ';
        }
        out = turned;
    }

    return out.map(row => row.join(''));
}

/**
 * La misma sala, del reves.
 *
 * @param {string[]} rows
 * @returns {string[]}
 */
export function mirrorTemplate(rows) {
    return (Array.isArray(rows) ? rows : []).map(row => [...String(row)].reverse().join(''));
}

/**
 * Pega una sala escrita a mano dentro de un mapa generado.
 *
 * Un algoritmo hace sitios variados y ninguno memorable; una sala escrita a mano es
 * memorable y siempre la misma. Estampar una dentro del otro da las dos cosas.
 *
 * **El espacio en blanco no se toca.** Es lo que permite que una sala tenga forma de cruz
 * o de ele sin arrastrar un rectangulo de muro alrededor.
 *
 * @param {string[][]} grid
 * @param {string[]} rows
 * @param {number} atX Esquina superior izquierda.
 * @param {number} atY
 * @returns {boolean} Si cupo. Media fuera no se estampa: seria una sala partida.
 */
export function stampRoom(grid, rows, atX, atY) {
    const template = (Array.isArray(rows) ? rows : []).map(row => String(row));
    if (template.length === 0) return false;

    const height = grid.length;
    const width = grid[0]?.length ?? 0;
    const tall = template.length;
    const wide = Math.max(...template.map(row => row.length));

    // Dentro y sin tocar el borde: el borde exterior cerrado es lo primero que comprueba
    // el validador, y una sala pegada a el lo abriria.
    if (atX < 1 || atY < 1 || atX + wide > width - 1 || atY + tall > height - 1) return false;

    for (let y = 0; y < tall; y++) {
        for (let x = 0; x < wide; x++) {
            const cell = template[y][x];
            if (cell === undefined || cell === ' ') continue;
            grid[atY + y][atX + x] = cell;
        }
    }

    return true;
}

/**
 * Una sala escrita a mano, girada y estampada donde quepa.
 *
 * @param {string[][]} grid
 * @param {string[]} rows
 * @param {() => number} random
 * @param {number} [tries]
 * @returns {{x: number, y: number, rows: string[]}|null}
 */
export function placeRoom(grid, rows, random, tries = 30) {
    const turned = rotateTemplate(rows, between(random, 0, 3));
    const shaped = random() < 0.5 ? mirrorTemplate(turned) : turned;

    const height = grid.length;
    const width = grid[0]?.length ?? 0;

    for (let attempt = 0; attempt < tries; attempt++) {
        const x = between(random, 1, Math.max(1, width - 2));
        const y = between(random, 1, Math.max(1, height - 2));
        if (stampRoom(grid, shaped, x, y)) return { x, y, rows: shaped };
    }

    return null;
}

/**
 * Cuanta simetria tiene un sitio, de izquierda a derecha.
 *
 * Existe para poder exigir que un templo la tenga **y que no sea perfecta**.
 *
 * @param {string[][]} grid
 * @returns {number} Entre 0 y 1.
 */
export function symmetry(grid) {
    const width = grid[0]?.length ?? 0;
    let same = 0;
    let total = 0;

    for (const row of grid) {
        for (let x = 0; x < Math.floor(width / 2); x++) {
            total++;
            if (row[x] === row[width - 1 - x]) same++;
        }
    }

    return total === 0 ? 0 : same / total;
}
