/**
 * El taller: un mundo en trece pasos, con tres formas de empezarlo.
 *
 * Hoy hay **dos pantallas que hacen lo mismo a medias** — el asistente de nueva campana y el
 * editor de `/campana`—, lo que se escribe en una no se ve en la otra, y hay cosas que estan
 * en las dos con nombres distintos. Esto es el estado de las dos juntas.
 *
 * Tres decisiones que hacen que esto sea construible:
 *
 * 1. **Un paso, trece configuraciones.** Todos los pasos son lo mismo: unas tarjetas —la
 *    primera con un `+`—, lo elegido en ambar, y el formulario debajo. Trece pantallas
 *    distintas serian trece sitios donde arreglar el mismo fallo.
 * 2. **Los tres caminos entran al mismo sitio.** Lo unico que cambia es con que llega el paso
 *    1 y cuantas tarjetas vienen marcadas. No hay tres asistentes.
 * 3. **Lo que tocas se queda; lo que no, se vuelve a tirar.** Un campo que has escrito queda
 *    fijado y la semilla ya no lo toca, asi que volver a tirar nunca borra nada escrito.
 *
 * Y el puente con lo que ya hay: `toAnswers()` devuelve **exactamente** lo que el creador de
 * campanas de hoy ya sabe comerse. Mientras el taller crece paso a paso, lo de abajo no
 * cambia ni una linea.
 *
 * Puro: lleva el estado y responde preguntas. No dibuja, no guarda y no crea nada.
 *
 * Ver wiki/ROADMAP_CREACION.md.
 */

import { cleanSeed, rollSeed } from './seed.js';

/** Por donde se empieza. Vocabulario cerrado: cada camino llena el paso 1 de otra forma. */
export const PATHS = ['cero', 'mundo', 'libro'];

/**
 * Los trece pasos, en orden.
 *
 * Estan los trece desde el primer dia aunque solo haya dos hechos: el contador dice «2 de
 * 13» y no miente, y anadir uno es cambiar `built` — no reescribir la barra de progreso.
 *
 * `optional` es lo que se puede saltar. El 1 no: un mundo sin nombre no es un mundo.
 */
export const STEPS = [
    { id: 'mundo', title: 'El mundo', hint: 'Lo que es antes de que nadie entre.', optional: false, built: true },
    { id: 'narrador', title: 'Quién lo cuenta', hint: 'Lo que escribas aquí llega al modelo en cada turno.', optional: true, built: true },
    { id: 'localidades', title: 'Localidades', hint: 'Los sitios a los que se puede ir.', optional: true, built: true },
    { id: 'tableros', title: 'Tableros', hint: 'Dónde se pelea, uno por localidad.', optional: true, built: true },
    { id: 'habilidades', title: 'Habilidades', hint: 'Lo que sabe hacer la gente.', optional: true, built: true },
    { id: 'razas', title: 'Razas', hint: 'De qué está hecha la gente, y qué les da.', optional: true, built: true },
    { id: 'clases', title: 'Clases', hint: 'A qué se dedican, y qué les da.', optional: true, built: true },
    { id: 'objetos', title: 'Objetos', hint: 'Lo que se lleva encima.', optional: true, built: true },
    { id: 'facciones', title: 'Facciones', hint: 'Quién quiere qué, y contra quién.', optional: true, built: true },
    { id: 'bestiario', title: 'Bestiario', hint: 'Lo que hay ahí fuera.', optional: true, built: true },
    { id: 'personajes', title: 'Personajes', hint: 'Quién vive aquí.', optional: true, built: true },
    { id: 'misiones', title: 'Misiones', hint: 'Las que trae el mundo, y cómo salen las demás.', optional: true, built: true },
    { id: 'jugabilidad', title: 'Jugabilidad', hint: 'Cuánto duele perder.', optional: true, built: true },
];

/**
 * @param {any} value
 * @returns {string}
 */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * @param {any} value
 * @param {number} fallback
 * @returns {number}
 */
function whole(value, fallback) {
    const parsed = Math.floor(Number(value));
    return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * El paso que toca, por id.
 *
 * @param {string} id
 * @returns {any}
 */
export function stepById(id) {
    return STEPS.find(step => step.id === text(id)) ?? null;
}

/**
 * Los pasos que este taller va a recorrer.
 *
 * Solo los construidos. Un paso que se ensena vacio es peor que uno que todavia no esta:
 * el primero promete algo que no pasa.
 *
 * @returns {any[]}
 */
export function walkableSteps() {
    return STEPS.filter(step => step.built);
}

/**
 * Empezar un taller.
 *
 * La semilla es lo unico que cambia de verdad entre caminos:
 *
 * - **desde cero**: se tira una. Lo que no escribas lo decide ella.
 * - **mundo precreado**: la que trae el mundo, porque el mundo *es* esa semilla. Si el
 *   archivo no la trae, se tira, y entonces deja de ser el mismo mundo para todos.
 * - **un libro**: la del paquete si la trae —importar tiene que ser reproducible— y si no,
 *   una nueva.
 *
 * @param {Object} input
 * @param {string} input.path
 * @param {any} [input.source] El mundo precreado o el paquete importado.
 * @param {() => number} [input.random]
 * @returns {any}
 */
export function startTaller({ path, source = null, random = Math.random }) {
    const chosen = PATHS.includes(text(path)) ? text(path) : 'cero';
    const carried = cleanSeed(source?.seed ?? source?.metadata?.seed);

    return {
        path: chosen,
        source,
        at: 0,
        // Lo que se ha escrito a mano, por campo. La semilla no toca nada de aqui.
        pinned: {},
        fields: {
            worldName: text(source?.displayName ?? source?.name ?? source?.metadata?.displayName),
            genre: text(source?.genre ?? source?.metadata?.genre),
            description: text(source?.description ?? source?.metadata?.description),
            seed: chosen === 'cero' ? rollSeed(random) : (carried || rollSeed(random)),
        },
        // Lo elegido en cada paso, por id de tarjeta.
        picked: {},
        // Los sitios del mundo, con sus tableros dentro. Lo que se escriba aqui manda
        // sobre lo que la semilla iba a proponer.
        locations: [],
        nextId: 1,
        // Las de verdad: las que tienen meta, reloj y reputacion. La lista vieja del
        // Lorebook se migra aqui en vez de perderse.
        factions: [],
        // Quien vive aqui, y las cuatro misiones que dan el tono. Las demas las hace el
        // motor mientras juegas.
        people: [],
        quests: [],
        // Los mandos del tablon: cuantos caben, de que tira y cuanto pesan las facciones.
        board: { size: 0, theme: '', factionShare: 3 },
        narrator: null,
        survival: null,
        seedRolled: chosen === 'cero' || !carried,
    };
}

/**
 * Escribir un campo a mano.
 *
 * Queda **fijado**: a partir de aqui la semilla no lo toca. Es lo que hace que el boton de
 * volver a tirar sea seguro — no puede borrarte nada de lo que hayas escrito.
 *
 * @param {any} state
 * @param {string} field
 * @param {string} value
 * @returns {any}
 */
export function writeField(state, field, value) {
    const key = text(field);
    if (!key) return state;

    return {
        ...state,
        fields: { ...state.fields, [key]: text(value) },
        pinned: { ...state.pinned, [key]: true },
    };
}

/**
 * Si un campo lo escribio una persona.
 *
 * @param {any} state
 * @param {string} field
 * @returns {boolean}
 */
export function isPinned(state, field) {
    return Boolean(state?.pinned?.[text(field)]);
}

/**
 * Volver a tirar: cambia la semilla y lo que ella decidia.
 *
 * Lo escrito a mano no se toca. Lo demas —los vecinos, las facciones que salen de cada
 * molde, el clima— se genera despues con la semilla nueva, asi que aqui solo hay que
 * cambiarla.
 *
 * @param {any} state
 * @param {() => number} [random]
 * @returns {any}
 */
export function reroll(state, random = Math.random) {
    return {
        ...state,
        fields: { ...state.fields, seed: rollSeed(random) },
        // La semilla nueva no se considera escrita a mano: se puede volver a tirar.
        pinned: { ...state.pinned, seed: false },
        seedRolled: true,
    };
}

/**
 * Elegir o quitar una tarjeta de un paso.
 *
 * Marcar es lo unico que decide si algo entra en el mundo. Se guarda por paso, no por
 * tarjeta, para que un id repetido en dos pasos no se pise.
 *
 * @param {any} state
 * @param {string} stepId
 * @param {string} cardId
 * @param {boolean} [only] Si solo puede haber una elegida, como en el paso 1.
 * @returns {any}
 */
export function pickCard(state, stepId, cardId, only = false) {
    const step = text(stepId);
    const card = text(cardId);
    if (!step || !card) return state;

    const before = Array.isArray(state?.picked?.[step]) ? state.picked[step] : [];
    const after = only
        ? (before.includes(card) ? [] : [card])
        : (before.includes(card) ? before.filter((/** @type {string} */ id) => id !== card) : [...before, card]);

    return { ...state, picked: { ...state.picked, [step]: after } };
}

/**
 * @param {any} state
 * @param {string} stepId
 * @returns {string[]}
 */
export function pickedIn(state, stepId) {
    const list = state?.picked?.[text(stepId)];
    return Array.isArray(list) ? list : [];
}

/**
 * @param {any} state
 * @param {string} stepId
 * @param {string} cardId
 * @returns {boolean}
 */
export function isPicked(state, stepId, cardId) {
    return pickedIn(state, stepId).includes(text(cardId));
}

/**
 * Los sitios que hay, tocados o no.
 *
 * @param {any} state
 * @returns {any[]}
 */
export function locationsOf(state) {
    return Array.isArray(state?.locations) ? state.locations : [];
}

/**
 * Los que entran en el mundo.
 *
 * @param {any} state
 * @returns {any[]}
 */
export function pickedLocations(state) {
    const marked = pickedIn(state, 'localidades');
    return locationsOf(state).filter(place => marked.includes(text(place.id)));
}

/**
 * Anadir un sitio. Entra marcado: se anade lo que se quiere, no lo que luego hay que
 * acordarse de marcar.
 *
 * @param {any} state
 * @param {any} place
 * @returns {{state: any, id: string}}
 */
export function addLocation(state, place) {
    const id = `loc-${state?.nextId ?? 1}`;
    const made = {
        id,
        name: text(place?.name),
        type: text(place?.type),
        biome: text(place?.biome),
        note: text(place?.note),
        routes: Array.isArray(place?.routes) ? place.routes : [],
        boards: Array.isArray(place?.boards) ? place.boards : [],
        // Donde empieza el grupo no se quita: sin tablero no hay partida.
        fixed: Boolean(place?.fixed),
        // Lo escrito a mano no lo pisa ninguna propuesta.
        touched: Boolean(place?.touched),
        nextBoard: 1,
    };

    const next = {
        ...state,
        locations: [...locationsOf(state), made],
        nextId: (state?.nextId ?? 1) + 1,
    };
    return { state: pickCard(next, 'localidades', id), id };
}

/**
 * Cambiar un sitio. Lo deja **tocado**, asi que la semilla ya no lo toca.
 *
 * @param {any} state
 * @param {string} id
 * @param {any} patch
 * @returns {any}
 */
export function editLocation(state, id, patch) {
    return {
        ...state,
        locations: locationsOf(state).map(place => (place.id === text(id)
            ? { ...place, ...(patch ?? {}), id: place.id, touched: true }
            : place)),
    };
}

/**
 * @param {any} state
 * @param {string} id
 * @returns {any}
 */
export function removeLocation(state, id) {
    const place = locationsOf(state).find(p => p.id === text(id));
    if (!place || place.fixed) return state;
    return { ...state, locations: locationsOf(state).filter(p => p.id !== text(id)) };
}

/**
 * Meter las que propone la semilla, sin pisar nada.
 *
 * Es lo que el juego iba a anadir solo al crear el mundo; ensenarlo antes es lo que
 * permite cambiarlo. Una propuesta que ya esta —por nombre— no se duplica, y una que has
 * tocado no se vuelve a proponer.
 *
 * @param {any} state
 * @param {any[]} made
 * @returns {any}
 */
export function proposeLocations(state, made) {
    let next = state;
    const taken = new Set(locationsOf(state).map(p => text(p.name).toLowerCase()));

    for (const place of (Array.isArray(made) ? made : [])) {
        const name = text(place?.name);
        if (!name || taken.has(name.toLowerCase())) continue;
        taken.add(name.toLowerCase());
        next = addLocation(next, place).state;
    }
    return next;
}

/**
 * @param {any} state
 * @param {string} locationId
 * @param {any} board
 * @returns {{state: any, id: string}}
 */
export function addBoard(state, locationId, board) {
    const place = locationsOf(state).find(p => p.id === text(locationId));
    if (!place) return { state, id: '' };

    const id = `${place.id}-b${place.nextBoard ?? 1}`;
    const made = {
        id,
        name: text(board?.name),
        shape: text(board?.shape) || 'rooms',
        size: text(board?.size) || 'medium',
        note: text(board?.note),
    };

    return {
        state: {
            ...state,
            locations: locationsOf(state).map(p => (p.id === place.id
                ? { ...p, boards: [...p.boards, made], nextBoard: (p.nextBoard ?? 1) + 1, touched: true }
                : p)),
        },
        id,
    };
}

/**
 * @param {any} state
 * @param {string} locationId
 * @param {string} boardId
 * @param {any} patch
 * @returns {any}
 */
export function editBoard(state, locationId, boardId, patch) {
    return {
        ...state,
        locations: locationsOf(state).map(place => (place.id === text(locationId)
            ? {
                ...place,
                touched: true,
                boards: place.boards.map((/** @type {any} */ b) => (b.id === text(boardId)
                    ? { ...b, ...(patch ?? {}), id: b.id }
                    : b)),
            }
            : place)),
    };
}

/**
 * @param {any} state
 * @param {string} locationId
 * @param {string} boardId
 * @returns {any}
 */
export function removeBoard(state, locationId, boardId) {
    return {
        ...state,
        locations: locationsOf(state).map(place => (place.id === text(locationId)
            ? { ...place, boards: place.boards.filter((/** @type {any} */ b) => b.id !== text(boardId)) }
            : place)),
    };
}

/**
 * Lo primero que se repite, o cadena vacia.
 *
 * @param {string[]} names
 * @returns {string}
 */
function firstRepeat(names) {
    const seen = new Set();
    for (const name of names) {
        const key = text(name).toLowerCase();
        if (!key) continue;
        if (seen.has(key)) return text(name);
        seen.add(key);
    }
    return '';
}

/**
 * Las facciones que hay en el taller.
 *
 * @param {any} state
 * @returns {any[]}
 */
export function factionsOf(state) {
    return Array.isArray(state?.factions) ? state.factions : [];
}

/**
 * Las que entran en el mundo.
 *
 * @param {any} state
 * @returns {any[]}
 */
export function pickedFactions(state) {
    const marked = pickedIn(state, 'facciones');
    return factionsOf(state).filter(faction => marked.includes(text(faction.id)));
}

/**
 * Anadir una faccion. Entra marcada.
 *
 * @param {any} state
 * @param {any} faction
 * @returns {{state: any, id: string}}
 */
export function addFaction(state, faction) {
    const id = text(faction?.id) || `fac-t${state?.nextId ?? 1}`;
    const made = {
        id,
        name: text(faction?.name),
        seat: text(faction?.seat),
        holds: Array.isArray(faction?.holds) ? faction.holds : [],
        enemies: Array.isArray(faction?.enemies) ? faction.enemies : [],
        note: text(faction?.note),
        reputation: Number(faction?.reputation) || 0,
        goal: {
            kind: text(faction?.goal?.kind),
            target: text(faction?.goal?.target),
            pace: Math.max(1, whole(faction?.goal?.pace, 7)),
            of: Math.max(1, whole(faction?.goal?.of, 6)),
            at: Math.max(0, whole(faction?.goal?.at, 0)),
            days: 0,
            done: false,
        },
    };

    const next = {
        ...state,
        factions: [...factionsOf(state), made],
        nextId: (state?.nextId ?? 1) + 1,
    };
    return { state: pickCard(next, 'facciones', id), id };
}

/**
 * @param {any} state
 * @param {string} id
 * @param {any} patch
 * @returns {any}
 */
export function editFaction(state, id, patch) {
    return {
        ...state,
        factions: factionsOf(state).map(faction => (faction.id === text(id)
            ? {
                ...faction,
                ...(patch ?? {}),
                id: faction.id,
                goal: { ...faction.goal, ...((patch ?? {}).goal ?? {}) },
            }
            : faction)),
    };
}

/**
 * @param {any} state
 * @param {string} id
 * @returns {any}
 */
export function removeFaction(state, id) {
    return { ...state, factions: factionsOf(state).filter(f => f.id !== text(id)) };
}

/**
 * Quien vive en este mundo.
 *
 * @param {any} state
 * @returns {any[]}
 */
export function peopleOf(state) {
    return Array.isArray(state?.people) ? state.people : [];
}

/**
 * @param {any} state
 * @returns {any[]}
 */
export function pickedPeople(state) {
    const marked = pickedIn(state, 'personajes');
    return peopleOf(state).filter(person => marked.includes(text(person.id)));
}

/**
 * @param {any} state
 * @param {any} person
 * @returns {{state: any, id: string}}
 */
export function addPerson(state, person) {
    const id = `per-${state?.nextId ?? 1}`;
    const made = {
        ...(person ?? {}),
        id,
        name: text(person?.name),
        title: text(person?.title),
        race: text(person?.race),
        className: text(person?.className),
        locationName: text(person?.locationName),
        factions: Array.isArray(person?.factions) ? person.factions : [],
        backstory: text(person?.backstory),
        personality: text(person?.personality),
    };

    const next = { ...state, people: [...peopleOf(state), made], nextId: (state?.nextId ?? 1) + 1 };
    return { state: pickCard(next, 'personajes', id), id };
}

/**
 * @param {any} state
 * @param {string} id
 * @param {any} patch
 * @returns {any}
 */
export function editPerson(state, id, patch) {
    return {
        ...state,
        people: peopleOf(state).map(person => (person.id === text(id)
            ? { ...person, ...(patch ?? {}), id: person.id }
            : person)),
    };
}

/**
 * @param {any} state
 * @param {string} id
 * @returns {any}
 */
export function removePerson(state, id) {
    return { ...state, people: peopleOf(state).filter(p => p.id !== text(id)) };
}

/**
 * Las misiones escritas a mano: las de la historia, las que dan el tono.
 *
 * Son pocas a proposito. El tablon se llena solo y **uno de cada tres** sale de lo que una
 * faccion quiere esa semana; escribir un tablon entero antes de jugar es papeleo, y un
 * tablon que se llena una vez se acaba.
 *
 * @param {any} state
 * @returns {any[]}
 */
export function questsOf(state) {
    return Array.isArray(state?.quests) ? state.quests : [];
}

/**
 * @param {any} state
 * @returns {any[]}
 */
export function pickedQuests(state) {
    const marked = pickedIn(state, 'misiones');
    return questsOf(state).filter(quest => marked.includes(text(quest.id)));
}

/**
 * @param {any} state
 * @param {any} quest
 * @returns {{state: any, id: string}}
 */
export function addQuest(state, quest) {
    const id = `mis-${state?.nextId ?? 1}`;
    const made = {
        id,
        title: text(quest?.title),
        note: text(quest?.note),
        where: text(quest?.where),
        reward: Math.max(0, whole(quest?.reward, 0)),
        // Cuando sale: al empezar, o mezclada con lo que el tablon genere.
        atStart: Boolean(quest?.atStart),
    };
    const next = { ...state, quests: [...questsOf(state), made], nextId: (state?.nextId ?? 1) + 1 };
    return { state: pickCard(next, 'misiones', id), id };
}

/**
 * @param {any} state
 * @param {string} id
 * @param {any} patch
 * @returns {any}
 */
export function editQuest(state, id, patch) {
    return {
        ...state,
        quests: questsOf(state).map(quest => (quest.id === text(id)
            ? { ...quest, ...(patch ?? {}), id: quest.id }
            : quest)),
    };
}

/**
 * @param {any} state
 * @param {string} id
 * @returns {any}
 */
export function removeQuest(state, id) {
    return { ...state, quests: questsOf(state).filter(q => q.id !== text(id)) };
}

/**
 * Los mandos del tablon.
 *
 * @param {any} state
 * @returns {{size: number, theme: string, factionShare: number}}
 */
export function boardRulesOf(state) {
    const rules = state?.board ?? {};
    return {
        size: Math.max(0, whole(rules.size, 0)),
        theme: text(rules.theme),
        // Uno de cada N sale de lo que una faccion quiere. Tres por defecto: un tablon que
        // solo habla de facciones deja de ofrecer trabajo y pasa a ser una guerra.
        factionShare: Math.max(1, whole(rules.factionShare, 3)),
    };
}

/**
 * @param {any} state
 * @param {any} patch
 * @returns {any}
 */
export function setBoardRules(state, patch) {
    return { ...state, board: { ...boardRulesOf(state), ...(patch ?? {}) } };
}

/**
 * Lo que impide pasar al siguiente, o cadena vacia.
 *
 * Devuelve **el motivo**, no un booleano: un boton apagado que no dice por que es la forma
 * mas rapida de que alguien cierre la ventana.
 *
 * @param {any} state
 * @param {string} stepId
 * @returns {string}
 */
export function blocksNext(state, stepId) {
    const step = stepById(stepId);
    if (!step) return '';

    if (step.id === 'mundo') {
        if (!text(state?.fields?.worldName)) return 'Ponle un nombre al mundo.';
        if (state.path === 'mundo' && pickedIn(state, 'mundo').length === 0) {
            return 'Elige uno de los mundos.';
        }
        if (state.path === 'cero' && pickedIn(state, 'mundo').length === 0) {
            return 'Elige con qué sitio empieza.';
        }
    }

    if (step.id === 'narrador') {
        // Se puede jugar sin narrador; lo que no se puede es tener uno sin nombre, porque
        // es lo que encabeza cada mensaje suyo.
        if (pickedIn(state, 'narrador').length > 0 && !text(state?.narrator?.name)) {
            return 'Ponle nombre a quien narra.';
        }
    }

    if (step.id === 'localidades') {
        const places = pickedLocations(state);
        if (places.some(place => !text(place.name))) return 'Hay un sitio sin nombre.';
        // Viajar empareja por nombre: dos sitios iguales son un mundo roto.
        const repeated = firstRepeat(places.map(place => place.name));
        if (repeated) return `Hay dos sitios que se llaman "${repeated}".`;
    }

    if (step.id === 'facciones') {
        const all = pickedFactions(state);
        if (all.some(faction => !text(faction.name))) return 'Hay una facción sin nombre.';
        const repeated = firstRepeat(all.map(faction => faction.name));
        if (repeated) return `Hay dos facciones que se llaman "${repeated}".`;
        // Una meta sin sitio al que apuntar es un reloj que no llega a ninguna parte.
        const lost = all.find(faction => text(faction.goal?.kind) && !text(faction.goal?.target));
        if (lost) return `${lost.name} quiere algo, pero no dice qué.`;
    }

    if (step.id === 'personajes') {
        const all = pickedPeople(state);
        if (all.some(person => !text(person.name))) return 'Hay alguien sin nombre.';
        const repeated = firstRepeat(all.map(person => person.name));
        // Dos personas con el mismo nombre en el Lorebook se pisan la entrada.
        if (repeated) return `Hay dos personas que se llaman "${repeated}".`;
    }

    if (step.id === 'misiones') {
        const all = pickedQuests(state);
        if (all.some(quest => !text(quest.title))) return 'Hay una misión sin título.';
    }

    if (step.id === 'tableros') {
        for (const place of pickedLocations(state)) {
            const repeated = firstRepeat(place.boards.map((/** @type {any} */ b) => b.name));
            if (repeated) return `En ${place.name} hay dos tableros que se llaman "${repeated}".`;
            if (place.boards.some((/** @type {any} */ b) => !text(b.name))) {
                return `Hay un tablero sin nombre en ${place.name}.`;
            }
        }
    }

    return '';
}

/**
 * Ir al siguiente paso, si se puede.
 *
 * @param {any} state
 * @returns {{state: any, reason: string, done: boolean}}
 */
export function goNext(state) {
    const steps = walkableSteps();
    const step = steps[state?.at ?? 0];
    if (!step) return { state, reason: '', done: true };

    const reason = blocksNext(state, step.id);
    if (reason) return { state, reason, done: false };

    const at = (state.at ?? 0) + 1;
    return { state: { ...state, at }, reason: '', done: at >= steps.length };
}

/**
 * @param {any} state
 * @returns {any}
 */
export function goBack(state) {
    return { ...state, at: Math.max(0, (state?.at ?? 0) - 1) };
}

/**
 * Por donde va, para la barra de arriba.
 *
 * Cuenta sobre los **trece**, no sobre los construidos: decir «2 de 2» cuando quedan once
 * por hacer seria mentir en la unica pantalla que dice cuanto falta.
 *
 * @param {any} state
 * @returns {{at: number, of: number, step: any, said: string}}
 */
export function progressOf(state) {
    const steps = walkableSteps();
    const step = steps[state?.at ?? 0] ?? steps[steps.length - 1];
    const at = STEPS.findIndex(s => s.id === step?.id) + 1;

    return { at, of: STEPS.length, step, said: `Paso ${at} de ${STEPS.length}` };
}

/**
 * Los pasos cuyo contenido trae escrito el paquete de un mundo.
 *
 * Con un paquete, las localidades, los tableros, las facciones, la gente y las misiones
 * ya estan escritos: elegirlos aqui seria ofrecer cambiar algo que luego no se usa. Lo
 * demas —quien narra, razas, clases, cuanto duele— sigue siendo del taller.
 */
export const PACK_STEPS = ['localidades', 'tableros', 'facciones', 'personajes', 'misiones'];

/**
 * Si el contenido de este taller lo trae un paquete escrito.
 *
 * Dos caminos lo traen: **un libro** pegado del Gem, y **un mundo precreado** que apunta a
 * su paquete (`pack` en `mundos.json`). Por dentro son lo mismo: el importador pone los
 * sitios, la gente y los tableros. Lo que cambia es que el mundo precreado conserva lo
 * suyo —semilla, narrador, dureza y tablon—, porque eso es lo que lo hace *ese* mundo.
 *
 * @param {any} state
 * @returns {boolean}
 */
export function carriesPack(state) {
    return state?.path === 'libro' || Boolean(state?.source?.pack);
}

/**
 * Lo que trae el paquete para un paso, en nombres, para ensenarlo en vez del formulario.
 *
 * @param {any} pack
 * @param {string} stepId
 * @returns {string[]}
 */
export function packContents(pack, stepId) {
    const names = (/** @type {any} */ list) => (Array.isArray(list) ? list : [])
        .map((/** @type {any} */ row) => text(row?.name ?? row?.title ?? row?.key))
        .filter(Boolean);
    switch (stepId) {
        case 'localidades': return names(pack?.locations);
        case 'tableros': return names(pack?.boards);
        case 'facciones': return names(pack?.world?.factions);
        case 'personajes': return names(pack?.confidants);
        case 'misiones': return names(pack?.quests);
        default: return [];
    }
}

/**
 * Lo que el creador de campanas de hoy sabe comerse.
 *
 * Este es el puente entero. Mientras el taller crece paso a paso, lo de abajo —crear el
 * mundo, escribir las entradas, repartir vecinos y facciones— no cambia ni una linea.
 *
 * @param {any} state
 * @returns {any}
 */
export function toAnswers(state) {
    const fields = state?.fields ?? {};
    const elegido = pickedIn(state, 'mundo')[0] ?? '';
    // Lo que trae un paquete —un libro, o un mundo precreado escrito entero— no se elige
    // aqui: lo pone su importador, y lo del taller solo podria pisarlo.
    const fromPack = carriesPack(state);

    return {
        // De donde sale el primer tablero. En los otros dos caminos lo dice la fuente.
        templateId: state?.path === 'cero' ? elegido : text(state?.source?.templateId) || elegido,
        worldName: text(fields.worldName),
        genre: text(fields.genre),
        description: text(fields.description),
        seed: cleanSeed(fields.seed),
        // Vacio a proposito: el personaje se hace al entrar, con su propia pantalla.
        party: [],
        generatedTemplate: state?.source?.generatedTemplate ?? null,
        importedPack: fromPack ? (state?.source?.pack ?? state?.source ?? null) : null,
        writeWorld: Boolean(state?.writeWorld),
        survival: state?.survival ?? null,
        narrator: state?.narrator ?? null,
        // Quien vive aqui y las misiones que dan el tono, con los mandos del tablon.
        people: fromPack ? [] : pickedPeople(state),
        quests: fromPack ? [] : pickedQuests(state),
        board: boardRulesOf(state),
        // Lo que entra en el mundo de cada bateria. Sin esto, marcar y desmarcar seria
        // decoracion: los generadores seguirian tirando de todo lo escrito.
        picks: {
            razas: pickedIn(state, 'razas'),
            clases: pickedIn(state, 'clases'),
            habilidades: pickedIn(state, 'habilidades'),
            objetos: pickedIn(state, 'objetos'),
            bestiario: pickedIn(state, 'bestiario'),
        },
        // Igual que los sitios: si has tocado el paso 9, mandan las tuyas.
        factions: fromPack ? [] : pickedFactions(state),
        // Si has tocado el paso 3, lo que hayas puesto manda y el mundo no se puebla solo.
        // Salvo con un libro: sus localidades las pone su importador, y las de aqui solo
        // podrian pisarlas.
        locations: fromPack ? [] : pickedLocations(state).map(place => ({
            name: text(place.name),
            type: text(place.type),
            biome: text(place.biome),
            description: text(place.note),
            routes: Array.isArray(place.routes) ? place.routes : [],
            boards: Array.isArray(place.boards) ? place.boards : [],
        })),
    };
}
