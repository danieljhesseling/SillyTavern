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
const MAX_CHIPS = 7;

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
 * @param {number} [input.rumors] Los rumores que quedan por oir aqui.
 * @param {boolean} [input.explore] Si se puede explorar los alrededores.
 * @param {boolean} [input.forage] Si se puede cazar y forrajear aqui (idea 68).
 * @param {Array<{name: string}>} [input.people] La gente del sitio con quien se puede hablar (idea 151).
 * @param {Array<{id: string, label: string, icon: string, command: string}>} [input.prisoners] Lo que se
 *   puede hacer con los prisioneros (idea 7), ya decidido.
 * @param {number} [input.limit] Cuántas caben en la fila; las demás van en «+N más» (idea 169).
 * @param {Array<{skill: string, label: string}>} [input.typed] Lo que pide lo que se está escribiendo (idea 137).
 * @param {Array<{name: string}>} [input.proposals] Los sitios que el narrador ha propuesto.
 * @param {Array<{skill: string, label: string, reason: string, dc: number}>} [input.requests] Las tiradas que
 *   ha pedido el narrador y esperan (idea 138).
 * @param {Array<{id: string, label: string, icon: string, draft?: string, command?: string}>} [input.replies] Lo que se
 *   le puede decir a quien se está hablando (idea 144). Va delante: la conversación está en marcha.
 * @param {Array<{id: string, label: string, icon: string, command: string}>} [input.extras] Lo que ofrece el
 *   narrador (idea 139) y acampar donde no hay posada (idea 67). Van con lo propuesto.
 * @returns {ActionChip[]}
 */
export function buildActionChips({
    fighting = false, hasBoard = false, doors = [], companions = [], mentioned = [],
    places = [], boards = [], hurt = false, hitDice = 0, rumors = 0, explore = false, proposals = [], requests = [], forage = false,
    people = [], prisoners = [], limit = MAX_CHIPS, typed = [], replies = [], extras = [],
} = {}) {
    if (fighting) return [];

    /** @type {ActionChip[]} */
    const chips = [];

    // Idea 144: si se está hablando con alguien, lo que se le puede decir.
    for (const reply of replies.slice(0, 3)) {
        chips.push({
            id: reply.id,
            label: reply.label,
            icon: reply.icon,
            source: reply.command ? 'motor' : 'sabor',
            ...(reply.draft ? { draft: reply.draft } : {}),
            ...(reply.command ? { command: reply.command } : {}),
        });
    }

    // Lo que se esta escribiendo, antes que nada: es lo que se quiere hacer ahora mismo.
    for (const intent of typed.slice(0, 2)) {
        chips.push({
            id: `typed:${intent.skill}`,
            label: `🎲 ${intent.label} (por lo que escribes)`,
            icon: 'fa-dice-d20',
            source: 'sabor',
        });
    }

    // Lo que el narrador acaba de pedir va lo primero: la escena esta esperando esa tirada.
    for (const request of requests.slice(0, 2)) {
        chips.push({
            id: `check-request:${request.skill}`,
            label: `Tirar ${request.label}${request.reason ? ` (${request.reason})` : ''} · CD ${request.dc}`,
            icon: 'fa-dice-d20',
            source: 'motor',
            command: `/tirada ${request.skill}`,
        });
    }

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

    // Ideas 139 y 67: lo que el narrador ofrece coger, y acampar.
    for (const extra of extras.slice(0, 3)) {
        chips.push({ id: extra.id, label: extra.label, icon: extra.icon, source: 'motor', command: extra.command });
    }

    // Lo que el narrador ha propuesto: es de lo que se estaba hablando, y existe solo si se
    // va a buscar. Va delante de casi todo.
    for (const proposal of proposals.slice(0, 2)) {
        chips.push({
            id: `seek:${proposal.name}`,
            label: `Buscar ${proposal.name}`,
            icon: 'fa-magnifying-glass-location',
            source: 'sabor',
            command: `/explorar ${proposal.name}`,
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

    // La gente de aqui: tambien se habla con quien no es del grupo (idea 151).
    const ours = new Set(companions.map(c => String(c.name).toLowerCase()));
    const locals = [...people]
        .filter(p => p && String(p.name).trim() && !ours.has(String(p.name).toLowerCase()))
        .sort((a, b) => Number(named.has(String(b.name).toLowerCase())) - Number(named.has(String(a.name).toLowerCase())));
    for (const person of locals.slice(0, 2)) {
        chips.push({
            id: `talk-local:${person.name}`,
            label: `Hablar con ${person.name}`,
            icon: 'fa-comments',
            source: named.has(String(person.name).toLowerCase()) ? 'sabor' : 'motor',
            draft: `Le digo a ${person.name}: `,
        });
    }

    // Los prisioneros: interrogar, entregar o soltar.
    for (const chip of prisoners.slice(0, 3)) {
        chips.push({ id: chip.id, label: chip.label, icon: chip.icon, source: 'motor', command: chip.command });
    }

    // Lo que se cuenta aqui. Va antes que descansar: oir es gratis y lleva a sitios.
    if (rumors > 0) {
        chips.push({
            id: 'rumor',
            label: `Escuchar rumores (${rumors})`,
            icon: 'fa-ear-listen',
            source: 'motor',
            command: '/rumor',
        });
    }

    if (explore && !hasBoard) {
        chips.push({
            id: 'explore',
            label: 'Explorar los alrededores',
            icon: 'fa-compass',
            source: 'motor',
            command: '/explorar',
        });
    }

    if (forage && !hasBoard) {
        chips.push({
            id: 'forage',
            label: 'Cazar y forrajear',
            icon: 'fa-leaf',
            source: 'motor',
            command: '/forrajear',
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

    // Idea 169: si no caben, la ultima dice cuantas quedan y las abre todas. Antes se
    // cortaban sin avisar, y lo que no salia parecia no existir.
    if (chips.length <= limit) return chips;
    const shown = chips.slice(0, Math.max(0, limit - 1));
    shown.push({
        id: 'more',
        label: `+${chips.length - shown.length} más`,
        icon: 'fa-ellipsis',
        source: 'motor',
    });
    return shown;
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
