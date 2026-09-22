/**
 * Las fichas de accion: lo que se puede hacer ahora mismo, sin escribirlo.
 *
 * Nacen del motor, no del modelo. El estado ya sabe si hay una puerta cerrada al lado,
 * si queda alguien con quien hablar, si el grupo esta herido y si hay a donde ir; todo
 * eso es gratis y siempre es verdad. Una ficha que el modelo se inventara podria ofrecer
 * abrir una puerta que no existe, y pulsarla no haria nada — que es exactamente la clase
 * de mentira que este proyecto evita.
 *
 * Lo unico que viene del texto es a quien nombra la escena, y solo para ordenar a los que
 * ya estan ahi: nombrar a alguien no lo crea.
 *
 * Decide y no dibuja, y no ejecuta nada: cada ficha dice que hay que hacer y quien la
 * pulse lo hace. Ver wiki/ROADMAP_JUEGO_SIN_COMANDOS.md, K4a.
 */

/**
 * @typedef {Object} ActionChip
 * @property {string} id
 * @property {string} label Lo que se lee en la ficha.
 * @property {string} icon
 * @property {'motor'|'sabor'} source De donde sale: del estado, o de lo que se narro.
 * @property {string} [command] El comando que resuelve la ficha, si lo hay.
 * @property {string} [draft] El texto que se deja escrito en el chat, si toca hablar.
 * @property {{x: number, y: number}} [cell] La casilla, para las puertas.
 */

/** Mas de esto y la fila deja de leerse de un vistazo. */
const MAX_CHIPS = 6;

/**
 * Que se puede hacer, dado lo que el motor sabe.
 *
 * En combate no devuelve nada: la barra de acciones ya esta abajo, y dos filas de botones
 * compitiendo por el mismo turno es peor que una.
 *
 * @param {Object} input
 * @param {boolean} [input.fighting]
 * @param {boolean} [input.hasBoard] Si hay un tablero abierto.
 * @param {Array<{x: number, y: number, distance: number}>} [input.doors] Puertas cerradas, con su distancia al grupo.
 * @param {Array<{name: string}>} [input.companions] Quien esta con el grupo.
 * @param {string[]} [input.mentioned] Nombres que la ultima narracion menciona.
 * @param {Array<{name: string}>} [input.places] A donde se puede viajar.
 * @param {Array<{name: string}>} [input.boards] Tableros de aqui, si no hay ninguno abierto.
 * @param {boolean} [input.hurt] Si alguien esta por debajo de su maximo.
 * @param {number} [input.hitDice] Dados de golpe que le quedan al grupo.
 * @returns {ActionChip[]}
 */
export function buildActionChips({
    fighting = false, hasBoard = false, doors = [], companions = [], mentioned = [],
    places = [], boards = [], hurt = false, hitDice = 0,
} = {}) {
    if (fighting) return [];

    /** @type {ActionChip[]} */
    const chips = [];

    // Las puertas primero: son lo unico que cambia el mapa, y de lo que depende el
    // siguiente combate. La mas cercana antes que la de la otra punta.
    const sortedDoors = [...doors]
        .filter(door => door && Number.isFinite(door.x) && Number.isFinite(door.y))
        .sort((a, b) => (Number(a.distance) || 0) - (Number(b.distance) || 0))
        .slice(0, 2);
    for (const door of sortedDoors) {
        chips.push({
            id: `door:${door.x},${door.y}`,
            label: `Abrir la puerta (${door.x + 1}, ${door.y + 1})`,
            icon: 'fa-door-open',
            source: 'motor',
            cell: { x: door.x, y: door.y },
        });
    }

    // Hablar. Los que la escena acaba de nombrar van delante: es de quien se estaba
    // hablando, y lo normal es querer responderle.
    const named = new Set(mentioned.map(name => String(name).toLowerCase()));
    const ordered = [...companions].sort((a, b) =>
        Number(named.has(String(b.name).toLowerCase())) - Number(named.has(String(a.name).toLowerCase())));
    for (const companion of ordered.slice(0, 3)) {
        const isNamed = named.has(String(companion.name).toLowerCase());
        chips.push({
            id: `talk:${companion.name}`,
            label: `Hablar con ${companion.name}`,
            icon: 'fa-comment',
            // Hablar lo resuelve el modelo, siempre: el motor no sabe que se dicen.
            source: isNamed ? 'sabor' : 'motor',
            draft: `Hablo con ${companion.name} sobre `,
        });
    }

    if (hurt && hitDice > 0) {
        chips.push({
            id: 'rest:corto',
            label: 'Descanso corto',
            icon: 'fa-campground',
            source: 'motor',
            command: '/descanso corto',
        });
    }

    if (hasBoard) {
        chips.push({
            id: 'leave',
            label: 'Salir del tablero',
            icon: 'fa-arrow-right-from-bracket',
            source: 'motor',
            command: '/leave',
        });
    } else {
        for (const board of boards.slice(0, 2)) {
            chips.push({
                id: `enter:${board.name}`,
                label: `Entrar en ${board.name}`,
                icon: 'fa-chess-board',
                source: 'motor',
                command: `/enter ${board.name}`,
            });
        }
        for (const place of places.slice(0, 2)) {
            chips.push({
                id: `go:${place.name}`,
                label: `Ir a ${place.name}`,
                icon: 'fa-person-walking',
                source: 'motor',
                command: `/go ${place.name}`,
            });
        }
    }

    return chips.slice(0, MAX_CHIPS);
}

/**
 * Las fichas en una linea, para el registro y para las pruebas.
 *
 * @param {ActionChip[]} chips
 * @returns {string}
 */
export function describeChips(chips) {
    return chips.length === 0
        ? 'Nada que ofrecer: lo que toca es escribir.'
        : chips.map(chip => chip.label).join(' · ');
}
