/**
 * Facciones: lo unico del mundo que tiene planes propios.
 *
 * Todo lo demas de este juego reacciona a ti — el tablero, el viaje, la cuenta del
 * viernes—. Una faccion con una meta es la primera cosa que **sigue adelante cuando no
 * estas mirando**, y eso es lo que convierte una lista de sitios en un mundo.
 *
 * La trampa que evita este modulo es la de Bannerlord: alli las guerras avanzan tic a tic
 * las juegues o no, y el 90% de lo que pasa es ruido que lees en un menu. Aqui son **pocas
 * facciones, metas visibles y relojes lentos**, y un avance solo se cuenta cuando **llega
 * al grupo**. El motor las mueve todas; el modelo narra lo que te alcanza.
 *
 * Tres decisiones que valen mas que el codigo:
 *
 * 1. **No hay azar en el reloj.** Un segmento cada `pace` dias, y ya. El azar de
 *    Bannerlord es justo lo que hace que sus guerras se sientan ruido: no puedes planear
 *    contra ellas. Un reloj que avanza solo es una promesa contra la que **si** se puede
 *    jugar. La semilla decide quienes son y que quieren, no cuando llegan.
 * 2. **El reloj no avanza el dia que el grupo esta en el sitio que quieren.** Estar
 *    presente es la primera forma de frenarlos, no cuesta interfaz ninguna, y da un motivo
 *    para viajar que antes no existia.
 * 3. **Cumplir una meta cambia la lista de sitios**, que es lo que el viaje ya lee: un paso
 *    que se cierra, un camino viejo que se abre, un peaje que suma un dia. Una barra que
 *    sube y no mueve nada seria decorado.
 *
 * Puro: cuenta dias y decide. No guarda, no dibuja y no narra.
 *
 * Ver wiki/ROADMAP_COMPENDIO.md, B10, y wiki/ALGORITMOS_GENERACION.md (#131, #142).
 */

/** Para que existe una faccion. Vocabulario cerrado: cada meta aterriza en un sitio. */
export const GOALS = ['encontrar', 'conquistar', 'recuperar', 'destruir', 'controlar'];

/** Lo que tarda un segmento cuando nadie lo dice. Lento a proposito: se juega contra el. */
export const DEFAULT_PACE = 7;

/** Segmentos de un reloj cuando nadie lo dice. Seis semanas es una campana entera. */
export const DEFAULT_SEGMENTS = 6;

/**
 * Lo lejos que puede llegar lo que piensan de ti, para arriba y para abajo.
 *
 * Corta a proposito: cinco encargos a favor de alguien es tenerlos de tu lado, no una
 * barra que se llena durante cien horas.
 */
export const STANDING = 5;

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
 * @param {any} value
 * @returns {string[]}
 */
function names(value) {
    return (Array.isArray(value) ? value : []).map(text).filter(Boolean);
}

/**
 * Si el nombre de una faccion pide verbo en plural.
 *
 * «Los de Ribera del Yunque **manda** aqui» lo escribe una maquina. En castellano el
 * articulo lo dice todo: «Los de…» y «Las…» son varios; «La casa de…» y «El gremio de…»
 * son uno. No hace falta un campo en el archivo para algo que ya esta en el nombre.
 *
 * @param {any} name
 * @returns {boolean}
 */
export function speaksPlural(name) {
    return /^(los|las)\b/i.test(text(name));
}

/**
 * El verbo que le toca a ese nombre.
 *
 * @param {any} name
 * @param {string} one Como se dice de uno.
 * @param {string} many Como se dice de varios.
 * @returns {string}
 */
export function saysWith(name, one, many) {
    return speaksPlural(name) ? many : one;
}

/**
 * Una faccion tal como se puede usar, venga como venga escrita.
 *
 * Tolerante igual que el compendio: una faccion a medias no puede dejar la campana sin
 * mundo. Lo que no se entiende se queda quieto, que es distinto de romper.
 *
 * @param {any} raw
 * @returns {any}
 */
export function readFaction(raw) {
    const source = (raw && typeof raw === 'object') ? raw : {};
    const kind = GOALS.includes(text(source.goal?.kind)) ? text(source.goal.kind) : '';
    const of = Math.max(1, whole(source.goal?.of, DEFAULT_SEGMENTS));

    return {
        id: text(source.id),
        name: text(source.name) || text(source.id),
        // Donde manda, que es tambien donde se le puede ir a buscar.
        seat: text(source.seat),
        holds: names(source.holds),
        enemies: names(source.enemies),
        note: text(source.note),
        // Lo que piensan de ti. Hasta F4 esto era un numero que no cambiaba ninguna regla.
        reputation: Math.max(-STANDING, Math.min(STANDING, whole(source.reputation, 0))),
        goal: {
            kind,
            target: text(source.goal?.target),
            pace: Math.max(1, whole(source.goal?.pace, DEFAULT_PACE)),
            of,
            // Un reloj nunca pasa de su ultimo segmento: cumplir es un suceso, no un numero.
            at: Math.min(of, Math.max(0, whole(source.goal?.at, 0))),
            // Los dias sueltos que aun no han llenado un segmento.
            days: Math.max(0, whole(source.goal?.days, 0)),
            done: Boolean(source.goal?.done),
        },
    };
}

/**
 * @param {any[]} raw
 * @returns {any[]}
 */
export function readFactions(raw) {
    return (Array.isArray(raw) ? raw : []).map(readFaction).filter(f => f.id);
}

/**
 * Como se llama cada faccion, por id.
 *
 * Lo que quiere una meta `destruir` es **otra faccion**, asi que su objetivo es un id. Sin
 * esto el panel decia «van a por fac-4-fac-corte», que no lo lee nadie.
 *
 * @param {any[]} factions
 * @returns {Record<string, string>}
 */
export function namesOf(factions) {
    /** @type {Record<string, string>} */
    const out = {};
    for (const faction of readFactions(factions)) out[faction.id] = faction.name;
    return out;
}

/**
 * Como va el reloj, para poder enseñarlo.
 *
 * @param {any} faction
 * @returns {{at: number, of: number, left: number, days: number, moving: boolean}}
 */
export function clockOf(faction) {
    const goal = readFaction(faction).goal;
    const left = Math.max(0, goal.of - goal.at);
    return {
        at: goal.at,
        of: goal.of,
        left,
        // Cuantos dias faltan para cumplirla, si nadie los frena.
        days: left === 0 ? 0 : (left * goal.pace) - goal.days,
        moving: Boolean(goal.kind) && !goal.done && left > 0,
    };
}

/**
 * Si hoy este reloj se queda quieto, y por que.
 *
 * Estar delante es la primera forma de frenar a alguien. No cuesta interfaz y hace que
 * viajar tenga un motivo que no sea la mision.
 *
 * @param {any} faction
 * @param {string} here
 * @returns {string}
 */
export function heldBack(faction, here) {
    const read = readFaction(faction);
    const where = text(here);
    if (!where) return '';
    if (read.goal.target && where.toLowerCase() === read.goal.target.toLowerCase()) {
        return `El grupo está en ${read.goal.target}, y mientras esté `
            + `${saysWith(read.name, 'no avanza', 'no avanzan')}.`;
    }
    return '';
}

/**
 * Un dia (o varios) de facciones.
 *
 * Devuelve facciones **nuevas** y los hechos ya decididos. No toca lo que recibe: el que
 * llama guarda si quiere, y asi una prueba puede tirar mil dias sin ensuciar nada.
 *
 * @param {Object} input
 * @param {any[]} input.factions
 * @param {number} [input.days] Cuantos dias pasan de golpe.
 * @param {string} [input.here] Donde esta el grupo.
 * @returns {{factions: any[], events: any[]}}
 */
export function tickFactions({ factions, days = 1, here = '' }) {
    const total = Math.max(0, whole(days, 1));
    const names = namesOf(factions);
    /** @type {any[]} */
    const events = [];

    const moved = readFactions(factions).map((faction) => {
        const goal = { ...faction.goal };
        if (!goal.kind || goal.done || goal.at >= goal.of) return { ...faction, goal };

        const stopped = heldBack(faction, here);
        if (stopped) {
            events.push({
                faction: faction.id, name: faction.name, kind: 'quieto',
                at: goal.at, of: goal.of, target: goal.target, note: stopped,
            });
            return { ...faction, goal };
        }

        goal.days += total;
        while (goal.days >= goal.pace && goal.at < goal.of) {
            goal.days -= goal.pace;
            goal.at += 1;
            events.push({
                faction: faction.id, name: faction.name,
                kind: goal.at >= goal.of ? 'cumple' : 'avanza',
                at: goal.at, of: goal.of, target: goal.target, goalKind: goal.kind,
                note: goal.at >= goal.of
                    ? describeOutcome({ ...faction, goal }, names)
                    : `${faction.name}: ${goal.at} de ${goal.of}.`,
            });
        }
        // Cumplida no sigue contando dias: el mundo ya cambio.
        if (goal.at >= goal.of) goal.days = 0;

        return { ...faction, goal };
    });

    return { factions: moved, events };
}

/**
 * En que se convierte un reloj lleno.
 *
 * Las cinco metas aterrizan en la **lista de sitios**, que es lo que el viaje ya lee. Una
 * meta que al cumplirse no mueve ninguna de esas cosas seria una barra y nada mas.
 *
 * @param {any} faction
 * @returns {any}
 */
export function outcomeOf(faction) {
    const read = readFaction(faction);
    const { kind, target } = read.goal;

    if (kind === 'conquistar' || kind === 'recuperar') {
        // Toman el sitio, y cierran lo que lleva a casa de sus enemigos.
        return { kind: 'toma', faction: read.id, place: target, enemies: read.enemies };
    }
    if (kind === 'destruir') {
        return { kind: 'cae', faction: read.id, other: target };
    }
    if (kind === 'encontrar') {
        // Lo que encuentran es el camino viejo: un atajo que antes no estaba en el mapa.
        return { kind: 'halla', faction: read.id, from: read.seat, place: target };
    }
    if (kind === 'controlar') {
        return { kind: 'peaje', faction: read.id, place: target, from: read.seat };
    }
    return { kind: '', faction: read.id };
}

/**
 * Lo que cambia en el mundo, en una linea.
 *
 * @param {any} faction
 * @param {Record<string, string>} [names] Como se llama cada faccion, por id.
 * @returns {string}
 */
export function describeOutcome(faction, names = {}) {
    const read = readFaction(faction);
    const outcome = outcomeOf(read);
    const quien = (/** @type {string} */ id) => text(names?.[text(id)]) || text(id);
    const dice = (/** @type {string} */ one, /** @type {string} */ many) =>
        saysWith(read.name, one, many);

    if (outcome.kind === 'toma') return `${read.name} ${dice('se queda', 'se quedan')} con ${outcome.place}.`;
    if (outcome.kind === 'cae') {
        return `${read.name} ${dice('acaba', 'acaban')} con ${quien(outcome.other)}.`;
    }
    if (outcome.kind === 'halla') {
        return `${read.name} ${dice('encuentra', 'encuentran')} el camino viejo a ${outcome.place}.`;
    }
    if (outcome.kind === 'peaje') {
        return `${read.name} ${dice('cobra', 'cobran')} peaje en el camino a ${outcome.place}.`;
    }
    return `${read.name} ${dice('consigue', 'consiguen')} lo que quería.`;
}

/**
 * @param {any} location
 * @param {string} to
 * @returns {any}
 */
function routeTo(location, to) {
    return (Array.isArray(location?.routes) ? location.routes : [])
        .find((/** @type {any} */ r) => text(r?.to).toLowerCase() === text(to).toLowerCase());
}

/**
 * Aplicar lo que ha pasado a la lista de sitios y a las facciones.
 *
 * Devuelve copias: el que llama guarda. Y devuelve **que ha cambiado**, en palabras, para
 * que el narrador tenga algo que contar que no sea un identificador.
 *
 * @param {Object} input
 * @param {any[]} input.locations
 * @param {any[]} input.factions
 * @param {any} input.outcome
 * @returns {{locations: any[], factions: any[], changed: string[]}}
 */
export function applyOutcome({ locations, factions, outcome }) {
    const places = (Array.isArray(locations) ? locations : []).map(l => ({
        ...l,
        routes: (Array.isArray(l?.routes) ? l.routes : []).map((/** @type {any} */ r) => ({ ...r })),
    }));
    let people = readFactions(factions);
    /** @type {string[]} */
    const changed = [];

    const mine = people.find(f => f.id === text(outcome?.faction));
    const place = places.find(p => text(p?.name).toLowerCase() === text(outcome?.place).toLowerCase());

    if (outcome?.kind === 'toma' && mine && place) {
        const before = text(place.holder);
        place.holder = mine.id;
        changed.push(`${place.name} pasa a manos de ${mine.name}.`);

        people = people.map((faction) => {
            if (faction.id === mine.id) {
                return {
                    ...faction,
                    holds: [...new Set([...faction.holds, place.name])],
                    goal: { ...faction.goal, done: true },
                };
            }
            // Y el que lo tenia deja de tenerlo: dos duenos del mismo sitio es un mundo roto.
            if (faction.id === before) {
                return { ...faction, holds: faction.holds.filter(h => h !== place.name) };
            }
            return faction;
        });

        // Se cierra lo que lleva a casa de sus enemigos: el viaje ya obedece `closed`.
        for (const enemyId of mine.enemies) {
            const enemy = people.find(f => f.id === enemyId);
            for (const seat of (enemy ? [enemy.seat, ...enemy.holds] : []).filter(Boolean)) {
                const route = routeTo(place, seat);
                if (route && !route.closed) {
                    route.closed = true;
                    route.note = `Cerrado por ${mine.name}.`;
                    changed.push(`El camino de ${place.name} a ${seat} queda cerrado.`);
                }
            }
        }
    }

    if (outcome?.kind === 'cae' && mine) {
        const dead = people.find(f => f.id === text(outcome.other) || f.name === text(outcome.other));
        if (dead) {
            // Lo que cerro al caer se vuelve a abrir: un muerto no cobra peajes.
            for (const p of places) {
                for (const route of p.routes) {
                    if (text(route.note).includes(dead.name)) {
                        route.closed = false;
                        route.note = '';
                        changed.push(`El camino de ${p.name} a ${route.to} vuelve a estar abierto.`);
                    }
                }
                if (text(p.holder) === dead.id) p.holder = '';
            }
            people = people
                .filter(f => f.id !== dead.id)
                .map(f => (f.id === mine.id ? { ...f, goal: { ...f.goal, done: true } } : f));
            changed.push(`${dead.name} deja de existir.`);
        }
    }

    if (outcome?.kind === 'halla' && mine) {
        // Un camino que no estaba: el mundo es una lista, asi que esto es una ruta nueva.
        const from = places.find(p => text(p?.name).toLowerCase() === text(outcome.from).toLowerCase());
        if (from && place && !routeTo(from, place.name)) {
            from.routes.push({ to: place.name, days: 1, note: `Camino viejo, abierto por ${mine.name}.` });
            changed.push(`Se abre un camino de ${from.name} a ${place.name}: un día.`);
        }
        people = people.map(f => (f.id === mine.id ? { ...f, goal: { ...f.goal, done: true } } : f));
    }

    if (outcome?.kind === 'peaje' && mine) {
        const from = places.find(p => text(p?.name).toLowerCase() === text(outcome.from).toLowerCase());
        const route = from && place ? routeTo(from, place.name) : null;
        if (route) {
            // Un peaje no cierra el camino: lo hace caro. Un dia mas es un dia de comida.
            route.days = Math.max(1, whole(route.days, 1)) + 1;
            route.note = `Peaje de ${mine.name}.`;
            changed.push(`El camino de ${from.name} a ${place.name} cuesta un día más: peaje de ${mine.name}.`);
        }
        people = people.map(f => (f.id === mine.id ? { ...f, goal: { ...f.goal, done: true } } : f));
    }

    return { locations: places, factions: people, changed };
}

/**
 * Lo que piensan de ti los de esa faccion.
 *
 * @param {any[]} factions
 * @param {string} id
 * @returns {number}
 */
export function standingWith(factions, id) {
    const found = readFactions(factions).find(faction => faction.id === text(id));
    return found ? found.reputation : 0;
}

/**
 * Cambiar lo que piensan de ti, sin pasarse de la escala.
 *
 * Ayudar a alguien **es ponerse en contra de su enemigo**: el mismo encargo mueve las dos
 * reputaciones en sentidos contrarios, que es lo que convierte tomar partido en una
 * decision y no en una forma de caerle bien a todo el mundo.
 *
 * @param {any[]} factions
 * @param {string} id
 * @param {number} amount
 * @returns {any[]}
 */
export function changeStanding(factions, id, amount) {
    const all = readFactions(factions);
    const who = all.find(faction => faction.id === text(id));
    if (!who || whole(amount, 0) === 0) return all;

    const move = whole(amount, 0);
    const enemies = new Set(who.enemies);

    return all.map((faction) => {
        if (faction.id === who.id) return withStanding(faction, faction.reputation + move);
        if (enemies.has(faction.id)) return withStanding(faction, faction.reputation - move);
        return faction;
    });
}

/**
 * @param {any} faction
 * @param {number} value
 * @returns {any}
 */
function withStanding(faction, value) {
    return {
        ...faction,
        reputation: Math.max(-STANDING, Math.min(STANDING, Math.round(value))),
    };
}

/**
 * Lo que piensan de ti, en palabras.
 *
 * Un numero entre -5 y 5 no dice nada; «os deben una» si. Y es lo que el narrador puede
 * leer sin tener que interpretar una escala.
 *
 * @param {number} value
 * @returns {string}
 */
export function describeStanding(value) {
    const at = whole(value, 0);
    if (at >= 4) return 'os deben más de una';
    if (at >= 2) return 'os miran bien';
    if (at >= 1) return 'os conocen, y no les molestáis';
    if (at <= -4) return 'os tienen ganas';
    if (at <= -2) return 'no os quieren cerca';
    if (at <= -1) return 'os han tomado ojeriza';
    return 'no saben quién sois';
}

/**
 * Lo que la reputacion le hace a lo que te cobran.
 *
 * Quien te debe una no te cobra el maximo, y quien te tiene ganas te cobra de mas. Se
 * devuelve un multiplicador para que quien llama siga decidiendo el precio.
 *
 * @param {number} value
 * @returns {number}
 */
export function priceFactor(value) {
    const at = Math.max(-STANDING, Math.min(STANDING, whole(value, 0)));
    // Un 5% por escalon: cinco encargos cambian el precio un cuarto, que se nota en la
    // cuenta del viernes sin volverla gratis.
    return Math.round((1 - (at * 0.05)) * 100) / 100;
}

/**
 * Empujar un reloj, hacia delante o hacia atras.
 *
 * Esto es lo que convierte a las facciones en algo con lo que se **juega** y no en clima.
 * Sin una forma de empujar, el mundo se mueve y tu miras; con ella, cada encargo del
 * tablon es tomar partido: lo que frena a unos adelanta a otros.
 *
 * Un empujon vale un segmento entero, asi que los dias sueltos que llevara acumulados se
 * pierden: has deshecho esa parte de su trabajo, no la has puesto en pausa.
 *
 * @param {any} faction
 * @param {number} segments En contra, negativo.
 * @param {Record<string, string>} [names] Como se llama cada faccion, por id.
 * @returns {{faction: any, event: any}}
 */
export function pushClock(faction, segments, names = {}) {
    const read = readFaction(faction);
    const move = whole(segments, 0);
    // Lo ya cumplido no se deshace: el sitio ya cambio de manos.
    if (!read.goal.kind || read.goal.done || move === 0) return { faction: read, event: null };

    const at = Math.min(read.goal.of, Math.max(0, read.goal.at + move));
    if (at === read.goal.at) return { faction: read, event: null };

    const goal = { ...read.goal, at, days: 0 };
    const moved = { ...read, goal };

    return {
        faction: moved,
        event: {
            faction: read.id, name: read.name,
            kind: at >= goal.of ? 'cumple' : (move > 0 ? 'avanza' : 'atras'),
            at, of: goal.of, target: goal.target, goalKind: goal.kind,
            note: at >= goal.of
                ? describeOutcome(moved, names)
                : (move > 0
                    ? `${read.name} ${saysWith(read.name, 'gana', 'ganan')} terreno: ${at} de ${goal.of}.`
                    : `${read.name} ${saysWith(read.name, 'pierde', 'pierden')} terreno: ${at} de ${goal.of}.`),
        },
    };
}

/**
 * Lo mismo, sobre la lista entera.
 *
 * @param {any[]} factions
 * @param {string} id
 * @param {number} segments
 * @returns {{factions: any[], event: any}}
 */
export function pushFaction(factions, id, segments) {
    /** @type {any} */
    let event = null;
    const names = namesOf(factions);
    const moved = readFactions(factions).map((faction) => {
        if (faction.id !== text(id)) return faction;
        const pushed = pushClock(faction, segments, names);
        event = pushed.event;
        return pushed.faction;
    });
    return { factions: moved, event };
}

/**
 * Quien tiene algo entre manos, para que el tablon pueda ofrecerlo.
 *
 * @param {any[]} factions
 * @returns {any[]}
 */
export function busyFactions(factions) {
    return readFactions(factions).filter(faction => clockOf(faction).moving);
}

/**
 * Lo que llega al grupo, que no es todo lo que pasa.
 *
 * Esta es la linea que separa esto de un menu de noticias: el motor mueve las cinco
 * facciones, y solo se cuenta lo que ocurre **donde estas, o en un camino que sale de
 * donde estas**. Lo demas se sabra al llegar.
 *
 * @param {Object} input
 * @param {any[]} input.events
 * @param {string} [input.here]
 * @param {any[]} [input.locations]
 * @param {any[]} [input.factions]
 * @returns {string[]}
 */
export function newsFor({ events, here = '', locations = [], factions = [] }) {
    const where = text(here);
    const place = (Array.isArray(locations) ? locations : [])
        .find(l => text(l?.name).toLowerCase() === where.toLowerCase());
    const reachable = new Set(
        [where, ...(Array.isArray(place?.routes) ? place.routes : [])
            .filter((/** @type {any} */ r) => !r?.closed)
            .map((/** @type {any} */ r) => text(r?.to))]
            .filter(Boolean)
            .map(n => n.toLowerCase()),
    );
    const seats = new Map(readFactions(factions).map(f => [f.id, [f.seat, ...f.holds]]));

    return (Array.isArray(events) ? events : [])
        .filter((/** @type {any} */ event) => {
            if (event?.kind === 'quieto') return false;
            // Lo que pasa donde estas o a un camino de aqui se oye; lo demas, no.
            if (reachable.has(text(event?.target).toLowerCase())) return true;
            return (seats.get(event?.faction) ?? [])
                .some((/** @type {string} */ n) => reachable.has(text(n).toLowerCase()));
        })
        .map((/** @type {any} */ event) => text(event.note))
        .filter(Boolean);
}

/**
 * Lo que impide usar la bateria de facciones.
 *
 * Igual que con las habilidades: `goal` es un **vocabulario cerrado** del motor y escribir
 * otro valor no da error, se queda en una faccion que nunca hace nada. Eso no se ve hasta
 * media campana despues, asi que se dice aqui.
 *
 * @param {any} compendium
 * @returns {string[]}
 */
export function validateFactionRows(compendium) {
    if (!compendium?.has?.('facciones')) return [];
    /** @type {string[]} */
    const errors = [];

    for (const row of compendium.find('facciones', {})) {
        const name = text(row?.name) || text(row?.id) || '(sin nombre)';
        const kind = text(row?.kind);

        if (kind === 'meta') {
            if (!GOALS.includes(text(row?.goal))) {
                errors.push(`${name}: "goal" dice "${text(row?.goal)}", que no existe. `
                    + `Vale: ${GOALS.join(', ')}.`);
            }
            // Una meta sin motivo es una barra que sube porque si.
            if (!text(row?.note)) errors.push(`${name}: una meta sin motivo ("note") no mueve a nadie.`);
            continue;
        }

        if (kind !== 'faccion') {
            errors.push(`${name}: "${kind}" no es ni faccion ni meta.`);
            continue;
        }

        const wants = Array.isArray(row?.goals) ? row.goals.map(text) : [];
        if (wants.length === 0) errors.push(`${name}: no dice qué clase de metas persigue ("goals").`);
        for (const goal of wants.filter(g => !GOALS.includes(g))) {
            errors.push(`${name}: persigue "${goal}", que no existe. Vale: ${GOALS.join(', ')}.`);
        }
        // Sin plantilla de nombre, todas las de ese molde se llaman igual.
        const patterns = Array.isArray(row?.patterns) ? row.patterns.filter(Boolean) : [];
        if (patterns.length === 0) errors.push(`${name}: sin "patterns" no tiene nombre propio.`);
        for (const pattern of patterns.filter((/** @type {string} */ p) => !text(p).includes('{sitio}'))) {
            errors.push(`${name}: la plantilla "${pattern}" no lleva {sitio}, así que no cambia nunca.`);
        }
    }

    return errors;
}

/**
 * Repartir facciones por un mundo recien hecho.
 *
 * **Pocas y con nombre**: cuatro se pueden seguir, treinta son ruido. Cada una se sienta
 * en un sitio distinto y quiere algo que **no es donde vive**, que es lo que la pone en
 * camino. Y cada una tiene al menos un enemigo, porque una faccion sola no tiene contra
 * quien, y sin contra quien no hay mundo, hay decorado.
 *
 * Aditivo: sin la bateria escrita devuelve una lista vacia y la campana sale como salia.
 *
 * @param {Object} input
 * @param {any} input.compendium
 * @param {any[]} input.locations
 * @param {() => number} input.random
 * @param {number} [input.count]
 * @returns {any[]}
 */
export function rollFactions({ compendium, locations, random, count = 4 }) {
    if (!compendium?.has?.('facciones')) return [];

    const places = (Array.isArray(locations) ? locations : [])
        .map((/** @type {any} */ l) => text(l?.name)).filter(Boolean);
    // Con un solo sitio no hay nada que querer que no sea lo de uno mismo.
    if (places.length < 2) return [];

    const molds = compendium.find('facciones', { kind: 'faccion' });
    const goals = compendium.find('facciones', { kind: 'meta' });
    if (molds.length === 0 || goals.length === 0) return [];

    const howMany = Math.max(1, Math.min(whole(count, 4), places.length, molds.length));
    const left = [...molds];
    const seats = [...places];
    /** @type {any[]} */
    const rolled = [];

    for (let i = 0; i < howMany; i++) {
        const mold = left.splice(Math.floor(random() * left.length) % left.length, 1)[0];
        const seat = seats.splice(Math.floor(random() * seats.length) % seats.length, 1)[0];

        const wants = (Array.isArray(mold.goals) ? mold.goals : []).filter(g => GOALS.includes(g));
        const mine = goals.filter((/** @type {any} */ g) => wants.includes(text(g.goal)));
        const goal = mine.length > 0
            ? mine[Math.floor(random() * mine.length) % mine.length]
            : goals[Math.floor(random() * goals.length) % goals.length];

        // Lo que quieren esta en otro sitio: querer lo que ya tienes no mueve a nadie.
        const others = places.filter(p => p !== seat);
        const target = others[Math.floor(random() * others.length) % others.length];

        rolled.push({
            id: `fac-${i + 1}-${text(mold.id)}`,
            name: fillName(mold, seat, random),
            seat,
            holds: [seat],
            enemies: [],
            note: text(goal.note),
            goal: {
                kind: text(goal.goal),
                target,
                pace: Math.max(1, whole(mold.pace, DEFAULT_PACE)),
                of: Math.max(1, whole(mold.of, DEFAULT_SEGMENTS)),
                at: 0,
                days: 0,
                done: false,
            },
        });
    }

    // En corro: cada una tiene enemigo y cada una es enemiga de alguien. Con dos, se odian
    // mutuamente y ya esta.
    return rolled.map((faction, i) => {
        const other = rolled[(i + 1) % rolled.length];
        const enemies = other.id === faction.id ? [] : [other.id];
        // Y a la que quiere destruir se le pone delante a quien destruir, no un sitio.
        const goal = faction.goal.kind === 'destruir'
            ? { ...faction.goal, target: enemies[0] ?? '' }
            : faction.goal;
        return { ...faction, enemies, goal };
    }).filter(faction => faction.goal.kind !== 'destruir' || faction.goal.target);
}

/**
 * El nombre, del molde y del sitio donde se sienta.
 *
 * @param {any} mold
 * @param {string} seat
 * @param {() => number} random
 * @returns {string}
 */
function fillName(mold, seat, random) {
    const patterns = (Array.isArray(mold?.patterns) ? mold.patterns : []).filter(Boolean);
    if (patterns.length === 0) return text(mold?.name);
    const pattern = patterns[Math.floor(random() * patterns.length) % patterns.length];
    return text(pattern).replace('{sitio}', seat);
}

/**
 * La faccion en una linea, con su reloj.
 *
 * @param {any} faction
 * @param {Record<string, string>} [names] Como se llama cada faccion, por id.
 * @returns {string}
 */
export function describeFaction(faction, names = {}) {
    const read = readFaction(faction);
    const clock = clockOf(read);
    // Lo que quiere una meta `destruir` es otra faccion, y su objetivo es un id.
    const target = text(names?.[read.goal.target]) || read.goal.target;
    const where = read.seat ? ` (${read.seat})` : '';
    if (!clock.moving) return `${read.name}${where} · sin nada entre manos`;

    const many = speaksPlural(read.name);
    const wants = {
        encontrar: `${many ? 'buscan' : 'busca'} el camino a ${target}`,
        conquistar: `${many ? 'quieren' : 'quiere'} ${target}`,
        recuperar: `${many ? 'quieren' : 'quiere'} recuperar ${target}`,
        destruir: `${many ? 'van' : 'va'} a por ${target}`,
        controlar: `${many ? 'quieren' : 'quiere'} el camino a ${target}`,
    }[read.goal.kind] ?? `${many ? 'tienen' : 'tiene'} planes`;

    return `${read.name}${where} · ${wants} · ${clock.at} de ${clock.of}`
        + (clock.days > 0 ? ` · ${clock.days} días` : '')
        // El motivo va detras porque es lo que hace que te importe quien gana.
        + (read.note ? ` — ${read.note}` : '');
}
