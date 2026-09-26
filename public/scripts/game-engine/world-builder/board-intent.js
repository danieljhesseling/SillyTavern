/**
 * Tableros con intención: el generador sabe **para qué** es el tablero (R6 del roadmap de
 * profundidad).
 *
 * El generador hacía sitios, pero no sabía para qué eran: una escolta, un robo y una caza
 * salían con la misma forma, y los enemigos se repartían a ciegas, uno por sala. Esto va
 * detrás del generador y le da cinco cosas:
 *
 * 1. **El propósito manda en la forma.** Escoltar pide la salida lejos y emboscadas en los
 *    estrechos; aguantar, una sala con dos entradas y refuerzos que llegan; robar, la cosa
 *    detrás de una puerta con llave; cazar, la guarida al fondo; recuperar, lo que se busca
 *    en la sala más lejana.
 * 2. **El sitio manda en el contenido**: una cripta trae sarcófagos y losas sueltas; un
 *    bosque, maleza que arde; una costa, agua; una mina, pozos y cajas.
 * 3. **Presupuesto de encuentro** (la idea 83): la amenaza se reparte según el nivel y el
 *    tamaño del grupo, el encargo y el modo. La pelea imposible de la tercera sala deja de
 *    pasar.
 * 4. **Las trampas las pone el generador**, cada una con su aviso (`board/hazards.js`).
 * 5. **Un comprobador de que es divertido**, no solo de que se puede recorrer: nadie a tiro
 *    de la entrada, cobertura en las salas grandes, al menos un estrecho y el objetivo al
 *    alcance. Si sale mal, quien llama vuelve a tirar con la semilla siguiente.
 *
 * Puro y determinista: con el mismo azar, el mismo tablero.
 *
 * Ver wiki/ROADMAP_PROFUNDIDAD.md, R6.
 */

/** Lo que pide cada clase de encargo. Las claves son las de `CONTRACT_KINDS`. */
export const PURPOSES = {
    cull: { label: 'Limpiar', note: 'Todo el sitio, sala a sala.' },
    hunt: { label: 'Cazar', note: 'La guarida al fondo, y lo más fuerte en ella.' },
    escort: { label: 'Escoltar', note: 'Un recorrido largo, con emboscadas en los estrechos.' },
    recover: { label: 'Recuperar', note: 'Lo que se busca está en la sala más lejana.' },
    hold: { label: 'Aguantar', note: 'Una sala que defender; los refuerzos llegan por la otra puerta.' },
    steal: { label: 'Robar', note: 'La cosa, detrás de una puerta con llave; y alguien vigila.' },
    silence: { label: 'Silenciar', note: 'Uno en concreto, bien guardado.' },
};

/**
 * Lo que trae cada clase de sitio, por palabras de su nombre o su bioma. `dress`: qué
 * casillas siembra y cuántas por sala grande. `traps`: las trampas que le pegan.
 */
export const DRESSING = [
    { match: /cripta|tumba|necr|panteon|osario/, dress: { C: 2 }, traps: ['losa', 'dardos'] },
    { match: /bosque|arboleda|claro|selva/, dress: { b: 5, c: 1 }, traps: ['cepo'] },
    { match: /costa|playa|puerto|pantano|lago|cienaga|rio/, dress: { w: 5 }, traps: ['cepo'] },
    { match: /mina|cueva|gruta|cantera/, dress: { v: 1, c: 1, T: 1 }, traps: ['hundido'] },
    { match: /templo|santuario|capilla|monasterio/, dress: { C: 2 }, traps: ['dardos'] },
    { match: /ruina|castillo|fuerte|torre|granja|almacen|puerto/, dress: { '~': 2, c: 1, T: 1 }, traps: ['losa'] },
    { match: /nieve|norte|glaciar|helad|montana/, dress: { i: 4 }, traps: ['hundido'] },
];

/** Las trampas, en la forma de `board/hazards.js`: todas con su aviso. */
export const TRAPS = {
    losa: { name: 'Losa suelta', kind: 'trampa', effect: 'damage', damageDice: '1d6', cause: 'caida', tell: 'Una losa más limpia que las de alrededor.' },
    dardos: { name: 'Dardos en la pared', kind: 'trampa', effect: 'condition', condition: 'Poisoned', tell: 'Agujeros pequeños a la altura del pecho.' },
    cepo: { name: 'Cepo', kind: 'trampa', effect: 'condition', condition: 'Restrained', tell: 'Hojas amontonadas donde no sopla el viento.' },
    hundido: { name: 'Suelo hundido', kind: 'trampa', effect: 'damage', damageDice: '1d8', cause: 'caida', tell: 'La tierra cruje distinto aquí.' },
};

/** Cuánto pesa cada perfil de enemigo en el presupuesto. */
const PROFILE_WEIGHT = { aggressive: 1.1, skirmisher: 1, ranged: 1.1, support: 0.9, cautious: 0.9 };

/** @param {any} value @returns {string} */
const plain = (value) => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Lo que amenaza un enemigo, en puntos. Vale para las dos formas de escribirlo: una ficha
 * del mundo (con su desafío, o su vida) y una fila del bestiario del compendio (con sus
 * factores). Sin números, diez.
 *
 * @param {any} row
 * @returns {number}
 */
export function threatOf(row) {
    const tags = (Array.isArray(row?.tags) ? row.tags : []).map(plain);
    const leader = row?.boss || tags.some(t => /jefe|alfa|lider/.test(t)) ? 1.8 : 1;
    // Una ficha del mundo: su desafío manda; si no lo dice, su vida.
    if (Number(row?.cr) > 0) return Math.max(4, Math.round(10 * (0.5 + Number(row.cr)) * leader));
    if (Number(row?.maxHp) > 0 && row?.hpFactor === undefined) return Math.max(4, Math.round((Number(row.maxHp) / 2) * leader));
    const hp = Number(row?.hpFactor) || 1;
    const ac = Number(row?.acBonus) || 0;
    const profile = /** @type {Record<string, number>} */ (PROFILE_WEIGHT)[plain(row?.profile)] ?? 1;
    return Math.max(4, Math.round(10 * hp * (1 + ac * 0.1) * profile * leader));
}

/**
 * El presupuesto de un encuentro (la idea 83).
 *
 * @param {Object} input
 * @param {number} input.partyLevel
 * @param {number} input.partySize
 * @param {number} [input.difficulty] La del encargo: 0.25 recados, 1 honrado, 3 peligroso…
 * @param {string} [input.letters] Las letras del modo (R1): con «e», más duro; sin «d», menos.
 * @returns {number}
 */
export function budgetFor({ partyLevel, partySize, difficulty = 1, letters = 'abcdf' }) {
    const level = Math.max(1, Math.floor(Number(partyLevel) || 1));
    const size = Math.max(1, Math.floor(Number(partySize) || 1));
    const scale = 0.6 + 0.2 * Math.min(5, Math.max(0, Number(difficulty) || 0));
    const mode = String(letters).includes('e') ? 1.15 : String(letters).includes('d') ? 1 : 0.8;
    return Math.round(size * (8 + 4 * level) * scale * mode);
}

/**
 * Elegir enemigos que quepan en el presupuesto: al azar, de lo que queda que quepa, sin
 * pasar del máximo. Siempre uno, aunque no quepa: un encargo sin nadie no es un encargo.
 *
 * @param {Object} input
 * @param {Array<{name: string, threat: number}>} input.options
 * @param {number} input.budget
 * @param {() => number} input.random
 * @param {number} [input.max]
 * @returns {{names: string[], spent: number}}
 */
export function pickByBudget({ options, budget, random, max = 8 }) {
    const pool = (Array.isArray(options) ? options : []).filter(o => o && o.name && o.threat > 0);
    /** @type {string[]} */
    const names = [];
    let spent = 0;
    while (names.length < max) {
        const fits = pool.filter(o => spent + o.threat <= budget);
        if (fits.length === 0) break;
        const pick = fits[Math.floor(random() * fits.length) % fits.length];
        names.push(pick.name);
        spent += pick.threat;
    }
    if (names.length === 0 && pool.length > 0) {
        const weakest = [...pool].sort((a, b) => a.threat - b.threat)[0];
        names.push(weakest.name);
        spent = weakest.threat;
    }
    return { names, spent };
}

/**
 * Lo que trae un sitio por su nombre o su bioma.
 *
 * @param {string} site
 * @returns {{dress: Record<string, number>, traps: string[]}}
 */
export function dressingFor(site) {
    const said = plain(site);
    const found = DRESSING.find(d => d.match.test(said));
    return found ? { dress: found.dress, traps: found.traps } : { dress: {}, traps: [] };
}

/**
 * @param {string[][]} grid
 * @param {{x: number, y: number, width: number, height: number}} room
 * @returns {Array<{x: number, y: number}>}
 */
function floorsOf(grid, room) {
    /** @type {Array<{x: number, y: number}>} */
    const out = [];
    for (let y = room.y + 1; y < room.y + room.height - 1; y++) {
        for (let x = room.x + 1; x < room.x + room.width - 1; x++) {
            if (grid[y]?.[x] === '.') out.push({ x, y });
        }
    }
    return out;
}

/**
 * Las casillas de suelo a las que se llega desde una, andando (sin muros ni precipicios ni
 * puertas cerradas con llave), con su distancia en pasos.
 *
 * @param {string[][]} grid
 * @param {{x: number, y: number}} from
 * @returns {Map<string, number>}
 */
export function walkFrom(grid, from) {
    const blocked = new Set(['#', 'v', 'L']);
    /** @type {Map<string, number>} */
    const seen = new Map([[`${from.x},${from.y}`, 0]]);
    const queue = [from];
    while (queue.length > 0) {
        const at = /** @type {{x: number, y: number}} */ (queue.shift());
        const d = /** @type {number} */ (seen.get(`${at.x},${at.y}`));
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const x = at.x + dx;
            const y = at.y + dy;
            const cell = grid[y]?.[x];
            if (cell === undefined || blocked.has(cell) || seen.has(`${x},${y}`)) continue;
            seen.set(`${x},${y}`, d + 1);
            queue.push({ x, y });
        }
    }
    return seen;
}

/**
 * Vestir el sitio: sembrar lo suyo en las salas que no son la de entrada, sin tapar puertas
 * ni pasillos (solo casillas de suelo con suelo a los cuatro lados).
 *
 * @param {Object} input
 * @param {string[][]} input.grid
 * @param {Array<{x: number, y: number, width: number, height: number}>} input.rooms
 * @param {string} input.site
 * @param {() => number} input.random
 * @returns {number} Cuántas casillas se han vestido.
 */
export function dressRooms({ grid, rooms, site, random }) {
    const { dress } = dressingFor(site);
    let done = 0;
    for (const room of rooms.slice(1)) {
        const open = floorsOf(grid, room).filter(({ x, y }) => [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => grid[y + dy]?.[x + dx] === '.'));
        for (const [char, count] of Object.entries(dress)) {
            // Solo en salas con sitio: la mitad en las pequeñas.
            const wanted = room.width * room.height >= 42 ? count : Math.floor(count / 2);
            for (let i = 0; i < wanted && open.length > 0; i++) {
                const spot = open.splice(Math.floor(random() * open.length) % open.length, 1)[0];
                grid[spot.y][spot.x] = char;
                done++;
            }
        }
    }
    return done;
}

/**
 * Que ninguna sala grande se quede sin nada detrás de lo que cubrirse: si el sitio no la
 * trae, una columna o unas cajas. Una sala vacía se juega sola —todo el mundo se pega y
 * tira— y con un estorbo ya hay que elegir por dónde ir.
 *
 * @param {Object} input
 * @param {string[][]} input.grid
 * @param {Array<{x: number, y: number, width: number, height: number}>} input.rooms
 * @param {() => number} input.random
 * @returns {number} Cuántas se han puesto.
 */
export function coverBigRooms({ grid, rooms, random }) {
    let placed = 0;
    for (const room of rooms.slice(1)) {
        if (room.width * room.height < 42) continue;
        const has = floorsOf(grid, room).length > 0 && [...Array(room.height).keys()]
            .some(dy => [...Array(room.width).keys()].some(dx => ['c', 'C', 'T', 'k'].includes(grid[room.y + dy]?.[room.x + dx] ?? '')));
        if (has) continue;
        // La cobertura no corta el paso (se anda por ella), así que vale cualquier suelo.
        const open = floorsOf(grid, room);
        if (open.length === 0) continue;
        const spot = open[Math.floor(random() * open.length) % open.length];
        grid[spot.y][spot.x] = random() < 0.5 ? 'c' : 'C';
        placed++;
    }
    return placed;
}

/**
 * Las trampas del sitio, en los pasillos y las puertas de paso, cada una con su aviso. Una
 * por cada dos salas, como mucho tres; ninguna en la sala de entrada.
 *
 * @param {Object} input
 * @param {string[][]} input.grid
 * @param {Array<{x: number, y: number, width: number, height: number}>} input.rooms
 * @param {string} input.site
 * @param {() => number} input.random
 * @returns {any[]} En la forma de `board/hazards.js`.
 */
export function placeTraps({ grid, rooms, site, random }) {
    const { traps } = dressingFor(site);
    if (traps.length === 0) return [];
    const inRoom = (/** @type {number} */ x, /** @type {number} */ y) => rooms.some(r => x > r.x && x < r.x + r.width - 1 && y > r.y && y < r.y + r.height - 1);
    const first = rooms[0];
    /** @type {Array<{x: number, y: number}>} */
    const corridor = [];
    for (let y = 1; y < grid.length - 1; y++) {
        for (let x = 1; x < (grid[y]?.length ?? 0) - 1; x++) {
            if (grid[y][x] !== '.' || inRoom(x, y)) continue;
            if (first && x >= first.x && x < first.x + first.width && y >= first.y && y < first.y + first.height) continue;
            corridor.push({ x, y });
        }
    }
    const count = Math.min(3, Math.max(0, Math.floor(rooms.length / 2)), corridor.length);
    /** @type {any[]} */
    const out = [];
    for (let i = 0; i < count; i++) {
        const spot = corridor.splice(Math.floor(random() * corridor.length) % corridor.length, 1)[0];
        const kind = traps[Math.floor(random() * traps.length) % traps.length];
        const trap = /** @type {any} */ (TRAPS)[kind];
        out.push({ id: `trampa-${kind}-${spot.x}-${spot.y}`, ...trap, trigger: 'enter', x: spot.x, y: spot.y, once: true, seen: false, armed: true });
    }
    return out;
}

/**
 * La sala más lejana de la entrada, andando.
 *
 * @param {string[][]} grid
 * @param {Array<{x: number, y: number, width: number, height: number}>} rooms
 * @param {{x: number, y: number}} start
 * @returns {number} Su índice, o -1.
 */
export function farthestRoom(grid, rooms, start) {
    const steps = walkFrom(grid, start);
    let best = -1;
    let bestDistance = -1;
    rooms.forEach((room, index) => {
        if (index === 0) return;
        const distance = Math.max(-1, ...floorsOf(grid, room).map(c => steps.get(`${c.x},${c.y}`) ?? -1));
        if (distance > bestDistance) {
            bestDistance = distance;
            best = index;
        }
    });
    return best;
}

/**
 * Aplicar el propósito al tablero generado: dónde está lo que se busca, dónde espera quién,
 * qué puerta va con llave y por dónde llegan los refuerzos.
 *
 * @param {Object} input
 * @param {{map: string[], rooms: any[], partyStart: Array<{x: number, y: number}>, enemies: Array<{name: string, x: number, y: number}>, doors: Array<{x: number, y: number}>}} input.board
 * @param {string} input.purpose Una clave de `PURPOSES`.
 * @param {string[]} input.names Los enemigos ya elegidos por presupuesto, del más fuerte al más débil.
 * @param {() => number} input.random
 * @returns {{map: string[], enemies: Array<{name: string, x: number, y: number}>, target: {x: number, y: number}|null, waves: any[], lockedDoor: {x: number, y: number}|null}}
 */
export function applyPurpose({ board, purpose, names, random }) {
    const grid = board.map.map(row => [...row]);
    const rooms = Array.isArray(board.rooms) ? board.rooms : [];
    const start = board.partyStart?.[0] ?? { x: 1, y: 1 };
    const far = farthestRoom(grid, rooms, start);
    const farRoom = far >= 0 ? rooms[far] : null;
    const taken = new Set(board.partyStart.map(c => `${c.x},${c.y}`));
    // Nadie a tiro de la entrada, si hay otro sitio: el primer turno es para mirar.
    const clear = (/** @type {{x: number, y: number}} */ c) => board.partyStart.every(s => Math.max(Math.abs(s.x - c.x), Math.abs(s.y - c.y)) > 4);
    const free = (/** @type {any} */ room) => {
        const open = floorsOf(grid, room).filter(c => !taken.has(`${c.x},${c.y}`));
        const away = open.filter(clear);
        return away.length > 0 ? away : open;
    };
    const put = (/** @type {Array<{x: number, y: number}>} */ cells) => {
        if (cells.length === 0) return null;
        const cell = cells.splice(Math.floor(random() * cells.length) % cells.length, 1)[0];
        taken.add(`${cell.x},${cell.y}`);
        return cell;
    };

    /** @type {Array<{name: string, x: number, y: number}>} */
    const enemies = [];
    const others = rooms.slice(1).filter((_, i) => i + 1 !== far);
    const spread = (/** @type {string[]} */ list, /** @type {any[]} */ where) => {
        list.forEach((name, i) => {
            const room = where[i % Math.max(1, where.length)];
            const cell = room ? put(free(room)) : null;
            if (cell) enemies.push({ name, ...cell });
        });
    };

    /** @type {{x: number, y: number}|null} */
    let target = null;
    /** @type {{x: number, y: number}|null} */
    let lockedDoor = null;
    /** @type {any[]} */
    const waves = [];
    const [first, ...rest] = names;

    if ((purpose === 'hunt' || purpose === 'silence') && farRoom && first) {
        // La guarida: lo más fuerte, al fondo; lo demás, por el camino.
        const lair = put(free(farRoom));
        if (lair) enemies.push({ name: first, ...lair });
        spread(rest, others.length > 0 ? others : [farRoom]);
    } else if ((purpose === 'recover' || purpose === 'steal') && farRoom) {
        target = put(free(farRoom));
        if (purpose === 'steal') {
            // B2: por dónde escapar con lo robado: una ventana en la pared de la sala del fondo.
            const edge = free(farRoom).filter(({ x, y }) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => grid[y + dy]?.[x + dx] === '#'));
            const window = put(edge);
            if (window) grid[window.y][window.x] = 'x';
            // La puerta de la sala del fondo, con llave; y alguien que vigila delante.
            const door = board.doors.find(d => d.x >= farRoom.x && d.x < farRoom.x + farRoom.width && d.y >= farRoom.y && d.y < farRoom.y + farRoom.height);
            if (door && grid[door.y]?.[door.x] === 'D') {
                grid[door.y][door.x] = 'L';
                lockedDoor = { x: door.x, y: door.y };
                // T1: y en otra sala, pegada a la pared, la palanca que la abre.
                const middle = others.length > 0 ? others[Math.floor(random() * others.length) % others.length] : null;
                const walls = middle ? free(middle).filter(({ x, y }) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => grid[y + dy]?.[x + dx] === '#')) : [];
                const lever = put(walls);
                if (lever) grid[lever.y][lever.x] = 'P';
            }
        }
        spread(names, others.length > 0 ? others : [farRoom]);
    } else if (purpose === 'hold') {
        // Se aguanta en la sala de entrada; unos esperan fuera y el resto llega en la ronda 3,
        // por la sala más lejana, con un aviso la ronda antes.
        // B3: barricadas junto a las puertas de la sala (las puertas quedan justo fuera de su
        // borde): a dos casillas y fuera de su fila y su columna, para cubrir sin tapar el paso.
        if (rooms[0]) {
            const first = rooms[0];
            const inside = (/** @type {number} */ x, /** @type {number} */ y) => x > first.x && x < first.x + first.width - 1 && y > first.y && y < first.y + first.height - 1;
            const doorsHere = board.doors.filter((/** @type {any} */ d) => d.x >= first.x - 1 && d.x <= first.x + first.width && d.y >= first.y - 1 && d.y <= first.y + first.height);
            for (const door of doorsHere) {
                let placed = 0;
                for (let dy = -2; dy <= 2 && placed < 2; dy++) {
                    for (let dx = -2; dx <= 2 && placed < 2; dx++) {
                        const x = door.x + dx;
                        const y = door.y + dy;
                        if (Math.max(Math.abs(dx), Math.abs(dy)) !== 2 || dx === 0 || dy === 0) continue;
                        if (!inside(x, y) || grid[y]?.[x] !== '.' || taken.has(`${x},${y}`)) continue;
                        grid[y][x] = '=';
                        taken.add(`${x},${y}`);
                        placed++;
                    }
                }
            }
        }
        // B1: y en esa sala, dos sitios altos desde donde defenderse.
        if (rooms[0]) {
            const spots = floorsOf(grid, rooms[0]).filter(c => !taken.has(`${c.x},${c.y}`));
            for (let i = 0; i < 2; i++) {
                const spot = put(spots);
                if (spot) grid[spot.y][spot.x] = '^';
            }
        }
        const half = Math.max(1, Math.ceil(names.length / 2));
        spread(names.slice(0, half), others.length > 0 ? others : rooms.slice(1));
        const gate = farRoom ? free(farRoom)[0] : null;
        if (gate && names.length > half) {
            waves.push({ round: 3, names: names.slice(half), x: gate.x, y: gate.y, tell: 'Se oyen pasos que vienen del fondo.' });
        }
    } else if (purpose === 'escort') {
        // Las emboscadas, junto a las puertas de paso: los estrechos.
        const doors = [...board.doors].filter(d => !taken.has(`${d.x},${d.y}`));
        names.forEach((name, i) => {
            const door = doors[i % Math.max(1, doors.length)];
            const near = door
                ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]
                    .map(([dx, dy]) => ({ x: door.x + dx, y: door.y + dy }))
                    .filter(c => grid[c.y]?.[c.x] === '.' && !taken.has(`${c.x},${c.y}`) && clear(c))
                : [];
            const cell = put(near) ?? (others[i % Math.max(1, others.length)] ? put(free(others[i % others.length])) : null);
            if (cell) enemies.push({ name, ...cell });
        });
    } else {
        spread(names, rooms.slice(1));
    }

    // Un cofre en la sala del fondo, donde no corte el paso: lo que se gana por llegar.
    if (farRoom) {
        const spot = free(farRoom).find(({ x, y }) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => grid[y + dy]?.[x + dx] === '.').length >= 3
            && (!target || x !== target.x || y !== target.y));
        if (spot) grid[spot.y][spot.x] = 'k';
    }

    return { map: grid.map(row => row.join('')), enemies, target, waves, lockedDoor };
}

/**
 * El comprobador de que un tablero es divertido, no solo recorrible.
 *
 * @param {Object} input
 * @param {string[]} input.map
 * @param {any[]} input.rooms
 * @param {Array<{x: number, y: number}>} input.partyStart
 * @param {Array<{x: number, y: number}>} input.enemies
 * @param {{x: number, y: number}|null} [input.target]
 * @returns {{ok: boolean, issues: string[]}}
 */
export function funCheck({ map, rooms, partyStart, enemies, target = null }) {
    const grid = map.map(row => [...row]);
    /** @type {string[]} */
    const issues = [];
    const start = partyStart?.[0];
    if (!start) return { ok: false, issues: ['No hay por dónde entrar.'] };
    const close = enemies.filter(e => partyStart.some(s => Math.max(Math.abs(s.x - e.x), Math.abs(s.y - e.y)) <= 4));
    if (close.length > 0) issues.push(`${close.length} enemigo(s) a tiro de la entrada.`);
    const covered = (/** @type {any} */ r) => [...Array(r.height).keys()]
        .some(dy => [...Array(r.width).keys()].some(dx => ['c', 'C', 'T', 'k'].includes(grid[r.y + dy]?.[r.x + dx] ?? '')));
    const bare = rooms.slice(1).filter(r => r.width * r.height >= 42 && floorsOf(grid, r).length > 0 && !covered(r));
    if (bare.length > 0) issues.push(`${bare.length} sala(s) grande(s) sin nada detrás de lo que cubrirse.`);
    const narrows = grid.flatMap((row, y) => row.map((cell, x) => ({ cell, x, y })))
        .filter(({ cell }) => ['D', 'L', 'o'].includes(cell)).length;
    if (narrows === 0 && rooms.length > 1) issues.push('Ningún estrecho: todo se pelea en campo abierto.');
    if (target) {
        const steps = walkFrom(grid.map(row => row.map(c => (c === 'L' ? 'D' : c))), start);
        if (!steps.has(`${target.x},${target.y}`)) issues.push('Lo que se busca no se alcanza.');
    }
    return { ok: issues.length === 0, issues };
}

/**
 * Todo junto: generar el sitio, vestirlo, poner sus trampas, elegir a los enemigos por
 * presupuesto, aplicar el propósito y comprobar que es divertido. Si no lo es, se vuelve a
 * tirar con el azar siguiente, hasta seis veces; si ninguna sale, se queda la mejor.
 *
 * @param {Object} input
 * @param {(attempt: number) => () => number} input.randomFor El azar de cada intento.
 * @param {(options: any) => any} input.generate El generador (`generateBoard`).
 * @param {string} [input.purpose]
 * @param {string} [input.site] El nombre o el bioma del sitio, para vestirlo.
 * @param {Array<{name: string, threat: number}>} [input.options] Los enemigos posibles, con su amenaza.
 * @param {number} [input.budget]
 * @param {Record<string, any>} [input.board] Lo que se le pasa al generador (tamaño, forma, salas escritas…).
 * @returns {any}
 */
export function generateIntended({ randomFor, generate, purpose = 'cull', site = '', options = [], budget = 30, board = {} }) {
    /** @type {any} */
    let best = null;
    for (let attempt = 0; attempt < 6; attempt++) {
        const random = randomFor(attempt);
        const base = generate({ ...board, random, bestiary: [], enemyCount: 0 });
        const grid = base.map.map((/** @type {string} */ row) => [...row]);
        // Solo las formas con salas se visten y llevan trampas: una cueva ya es lo que es.
        const rooms = Array.isArray(base.rooms) ? base.rooms : [];
        if (rooms.length > 1) {
            dressRooms({ grid, rooms, site, random });
            coverBigRooms({ grid, rooms, random });
        }
        const hazards = rooms.length > 1 ? placeTraps({ grid, rooms, site, random }) : [];
        const picked = pickByBudget({ options, budget, random });
        // Del más fuerte al más débil: el primero es el que va a la guarida.
        const threat = (/** @type {string} */ name) => options.find(o => o.name === name)?.threat ?? 0;
        const byThreat = [...picked.names].sort((a, b) => threat(b) - threat(a));
        /** @type {any} */
        let shaped;
        if (rooms.length > 1) {
            shaped = applyPurpose({ board: { ...base, map: grid.map((/** @type {string[]} */ row) => row.join('')) }, purpose, names: byThreat, random });
        } else {
            // Las formas sin salas: los nombres del presupuesto en el suelo más lejano de la entrada.
            const start = base.partyStart?.[0] ?? { x: 1, y: 1 };
            const steps = walkFrom(grid, start);
            const far = [...steps.entries()].filter(([, d]) => d >= 6).map(([key]) => key.split(',').map(Number)).map(([x, y]) => ({ x, y }))
                .filter(c => grid[c.y]?.[c.x] === '.');
            shaped = { map: grid.map((/** @type {string[]} */ row) => row.join('')), enemies: [], target: null, waves: [], lockedDoor: null };
            for (const name of byThreat) {
                if (far.length === 0) break;
                const cell = far.splice(Math.floor(random() * far.length) % far.length, 1)[0];
                shaped.enemies.push({ name, ...cell });
            }
        }
        const check = funCheck({ map: shaped.map, rooms, partyStart: base.partyStart, enemies: shaped.enemies, target: shaped.target });
        const result = { ...base, ...shaped, hazards, budget, spent: picked.spent, purpose, issues: check.issues, tries: attempt + 1 };
        if (check.ok) return result;
        if (!best || check.issues.length < best.issues.length) best = result;
    }
    return best;
}
