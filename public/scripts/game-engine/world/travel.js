/**
 * Viajar: el mundo es una **lista**, no un tablero.
 *
 * Un mapa de mundo en cuadricula obliga a inventarse coordenadas para sitios que solo
 * existen como nombres, y a dibujar el vacio que hay entre ellos. Una lista de sitios con
 * **rutas declaradas** dice lo unico que el juego necesita saber: a donde se puede ir
 * desde aqui y cuantos dias cuesta.
 *
 * Y la distancia cuenta de verdad, porque los dias pasan por el mismo reloj que cura, da
 * de comer y cobra la semana. Un viaje de cinco dias **se paga en comida**, y por eso
 * elegir la ruta corta o la segura es una decision y no un boton.
 *
 * Tres reglas que sostienen el resto:
 *
 * 1. **Las rutas son datos, no geometria.** `{ to: 'El Molino', days: 3 }`. Escribirlas es
 *    escribir una fila; cambiarlas no obliga a redibujar nada.
 * 2. **Un sitio sin rutas es un sitio al que se va directo.** Asi un mundo a medio
 *    escribir —o uno de antes de que esto existiera— sigue siendo jugable.
 * 3. **Cuando no se puede llegar, se dice por que.** Un boton apagado sin motivo parece
 *    roto; uno que explica que el paso esta cerrado es una meta.
 *
 * Puro: recibe la lista y el azar, y devuelve un plan. No mueve a nadie ni toca el reloj.
 *
 * Ver wiki/ALGORITMOS_GENERACION.md (#43-#66) y wiki/ROADMAP_MAESTRO.md.
 */

import { matches, pickWeighted } from '../compendio/compendio.js';

/** Lo que cuesta un viaje cuando el mundo no dice nada. */
export const DEFAULT_DAYS = 2;

/**
 * Lo que puede pasar por el camino cuando todavia no hay bateria que lo diga.
 *
 * Diez filas, y ninguna es un combate: una pelea en mitad de un viaje habria que jugarla,
 * y eso es una decision distinta de «viajar cuesta dias». Lo que hay aqui **cuesta
 * tiempo, cuesta algo o da algo**, que es lo que el reloj ya sabe cobrar.
 *
 * Cuando exista `mundo.json` (B11) esta tabla se queda de reserva: la del compendio manda.
 */
export const DEFAULT_TRAVEL_EVENTS = [
    {
        id: 'tormenta', name: 'Una tormenta', days: 1,
        note: 'Cayó agua toda la tarde y hubo que esperar bajo unas rocas. Se pierde un día.',
    },
    {
        id: 'camino-cortado', name: 'El camino cortado', days: 1,
        note: 'Un desprendimiento obliga a rodear por el monte. Un día más de lo previsto.',
    },
    {
        id: 'rueda', name: 'Una rueda partida', days: 1,
        note: 'Se parte algo del equipo y arreglarlo lleva toda una mañana y media tarde.',
    },
    {
        id: 'ermitano', name: 'Un ermitaño', days: 0,
        note: 'Un viejo que vive solo comparte agua y avisa de lo que hay más adelante.',
    },
    {
        id: 'carreta', name: 'Una carreta', days: 0,
        note: 'Una carreta que va en la misma dirección deja subir a quien quiera descansar.',
    },
    {
        id: 'humo', name: 'Humo a lo lejos', days: 0,
        note: 'Se ve humo hacia el norte. Nadie sabe de qué, y nadie quiere acercarse.',
    },
    {
        id: 'rastro', name: 'Un rastro', days: 0,
        note: 'Huellas frescas cruzan el camino y siguen hacia donde vosotros vais.',
    },
    {
        id: 'mojon', name: 'Un mojón caído', days: 0,
        note: 'Una piedra con letras gastadas, tirada en la cuneta. Alguien la tiró a propósito.',
    },
    {
        id: 'frio', name: 'Una noche mala', days: 0,
        note: 'La noche fue más fría de lo que nadie esperaba y se durmió poco.',
    },
    {
        id: 'peaje', name: 'Un peaje', days: 0,
        note: 'Dos hombres cobran por pasar el vado. Discutirlo cuesta más que pagarlo.',
    },
];

/** Ni un viaje instantaneo ni uno eterno: un dia es lo minimo que se nota. */
export const MIN_DAYS = 1;
export const MAX_DAYS = 60;

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
function number(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Los dias de una ruta, con los topes puestos.
 *
 * @param {any} value
 * @returns {number}
 */
function days(value) {
    return Math.max(MIN_DAYS, Math.min(MAX_DAYS, Math.round(number(value, DEFAULT_DAYS))));
}

/**
 * Las rutas que salen de un sitio, normalizadas.
 *
 * @param {any} location
 * @param {string[]} [friendly] Nombres de facciones que te dejarian pasar.
 * @returns {Array<{to: string, days: number, note: string, closed: boolean, oneWay: boolean}>}
 */
export function routesOf(location, friendly = []) {
    // Un paso cerrado por alguien que te debe una se abre para ti. Lo cierran las
    // facciones al tomar un sitio, y la nota dice quien: sin eso, ganarse a alguien no se
    // notaria en lo unico que de verdad se nota, que es donde puedes ir.
    const friends = (Array.isArray(friendly) ? friendly : []).map(text).filter(Boolean);
    const opensForYou = (/** @type {any} */ route) => friends.length > 0
        && friends.some(name => text(route?.note).includes(name));

    return (Array.isArray(location?.routes) ? location.routes : [])
        .map((/** @type {any} */ route) => ({
            to: text(route?.to),
            days: days(route?.days),
            note: text(route?.note),
            // Un paso cerrado sigue en la lista: se ve que existe y que ahora no se puede.
            closed: Boolean(route?.closed) && !opensForYou(route),
            // Y una ruta vale para ir y volver salvo que diga lo contrario. Sin esto el
            // campo existia en el archivo y no hacia nada, que es peor que no existir.
            oneWay: Boolean(route?.oneWay),
        }))
        .filter((/** @type {any} */ route) => route.to);
}

/**
 * El grafo de rutas del mundo, en las dos direcciones.
 *
 * Una ruta vale para ir y para volver salvo que diga lo contrario: un camino que solo se
 * puede andar en un sentido es raro, y obligar a escribirlo dos veces es la mejor forma
 * de que alguien escriba solo la mitad.
 *
 * @param {any[]} locations
 * @param {string[]} [friendly] Facciones que te abren lo que cerraron.
 * @returns {Map<string, Array<{to: string, days: number, note: string}>>}
 */
export function buildRouteMap(locations, friendly = []) {
    /** @type {Map<string, Array<{to: string, days: number, note: string}>>} */
    const graph = new Map();

    /** @param {string} from @param {{to: string, days: number, note: string}} edge */
    const add = (from, edge) => {
        if (!graph.has(from)) graph.set(from, []);
        const already = graph.get(from) ?? [];
        // Si hay dos rutas al mismo sitio manda la corta: alguien escribio un atajo.
        const existing = already.find(e => e.to === edge.to);
        if (!existing) already.push(edge);
        else if (edge.days < existing.days) Object.assign(existing, edge);
    };

    for (const location of (Array.isArray(locations) ? locations : [])) {
        const from = text(location?.name);
        if (!from) continue;
        if (!graph.has(from)) graph.set(from, []);

        for (const route of routesOf(location, friendly)) {
            if (route.closed) continue;
            add(from, { to: route.to, days: route.days, note: route.note });
            if (!route.oneWay) add(route.to, { to: from, days: route.days, note: route.note });
        }
    }

    return graph;
}

/**
 * Como se va de un sitio a otro, y lo que cuesta.
 *
 * Devuelve **el motivo** cuando no se puede, no un false: un boton apagado sin explicacion
 * parece roto, y uno que dice que el paso esta cerrado es una meta.
 *
 * @param {Object} input
 * @param {string} input.from
 * @param {string} input.to
 * @param {any[]} input.locations La lista del mundo. Es una lista, no un tablero.
 * @param {string[]} [input.friendly] Facciones que te abren lo que cerraron.
 * @returns {{ok: boolean, days: number, legs: string[], reason: string}}
 */
export function planTravel({ from, to, locations, friendly = [] }) {
    const start = text(from);
    const end = text(to);

    if (!end) return { ok: false, days: 0, legs: [], reason: 'No has dicho a dónde.' };
    if (start && start === end) {
        return { ok: false, days: 0, legs: [], reason: 'Ya estás aquí.' };
    }

    const known = new Set((Array.isArray(locations) ? locations : [])
        .map((/** @type {any} */ l) => text(l?.name)).filter(Boolean));
    if (!known.has(end)) {
        return { ok: false, days: 0, legs: [], reason: `"${end}" no está en el mapa.` };
    }

    const graph = buildRouteMap(locations, friendly);
    const fromHere = graph.get(start) ?? [];

    // Un sitio sin rutas es un sitio al que se va directo: un mundo a medio escribir
    // —o uno de antes de que esto existiera— tiene que seguir siendo jugable.
    if (!start || fromHere.length === 0) {
        return { ok: true, days: DEFAULT_DAYS, legs: [end], reason: '' };
    }

    // Dijkstra sobre una lista de rutas: son cuatro sitios, no cuatro mil, y lo que se
    // saca de aqui no es solo el coste sino **por donde se pasa**, que es la mitad de lo
    // que hace interesante un viaje.
    /** @type {Map<string, number>} */
    const cost = new Map([[start, 0]]);
    /** @type {Map<string, string>} */
    const cameFrom = new Map();
    /** @type {Set<string>} */
    const settled = new Set();

    while (settled.size < graph.size) {
        let here = '';
        let best = Infinity;
        for (const [place, spent] of cost) {
            if (!settled.has(place) && spent < best) {
                best = spent;
                here = place;
            }
        }
        if (!here) break;
        settled.add(here);
        if (here === end) break;

        for (const edge of graph.get(here) ?? []) {
            const total = best + edge.days;
            if (total < (cost.get(edge.to) ?? Infinity)) {
                cost.set(edge.to, total);
                cameFrom.set(edge.to, here);
            }
        }
    }

    if (!cost.has(end)) {
        return {
            ok: false,
            days: 0,
            legs: [],
            reason: `No hay camino abierto desde "${start}" hasta "${end}".`,
        };
    }

    /** @type {string[]} */
    const legs = [];
    for (let at = end; at && at !== start; at = cameFrom.get(at) ?? '') legs.unshift(at);

    return { ok: true, days: days(cost.get(end)), legs, reason: '' };
}

/**
 * Que tiempo hace cada dia del viaje.
 *
 * Cadena de Markov: **el tiempo de manana depende del de hoy**. Una tirada suelta por dia
 * da sol-tormenta-sol, que no lo cree nadie; una matriz de transiciones da rachas, que es
 * como se comporta el tiempo de verdad y ademas se puede ver venir.
 *
 * El primer dia sale de los climas que el bioma admite: en una cueva no nieva.
 *
 * @param {Object} input
 * @param {number} input.days
 * @param {any[]} [input.table]      Las filas `kind: 'clima'` del compendio.
 * @param {string[]} [input.climates] Los que admite el bioma. Vacio: todos.
 * @param {() => number} [input.random]
 * @returns {string[]} Uno por dia.
 */
export function rollWeather({ days: total, table = [], climates = [], random = Math.random }) {
    const rows = (Array.isArray(table) ? table : []).filter(row => text(row?.climate));
    if (rows.length === 0) return [];

    const byName = new Map(rows.map(row => [text(row.climate), row]));
    const allowed = climates.length > 0
        ? rows.filter(row => climates.map(text).includes(text(row.climate)))
        : rows;
    if (allowed.length === 0) return [];

    /** @type {string[]} */
    const out = [];
    let current = text(pickWeighted(allowed.map(row => ({ ...row, weight: number(row.weight, 1) })), random)?.climate);

    for (let day = 0; day < Math.max(0, Math.round(total)); day++) {
        out.push(current);

        // A donde puede ir manana. Una transicion a un clima que el bioma no admite se
        // ignora: el archivo describe el tiempo en general, y el sitio manda.
        const transitions = Object.entries(byName.get(current)?.transitions ?? {})
            .map(([to, weight]) => ({ id: to, weight: number(weight, 0) }))
            .filter(edge => byName.has(edge.id)
                && (climates.length === 0 || climates.map(text).includes(edge.id)));

        const next = pickWeighted(transitions, random);
        current = next ? text(next.id) : current;
    }

    return out;
}

/**
 * Lo que pasa por el camino.
 *
 * Un viaje que solo gasta dias es una pantalla de carga. Una tirada por dia contra una
 * tabla —y la tabla puede venir del compendio— convierte el camino en algo que se cuenta.
 *
 * Lo que devuelve son **hechos ya decididos**, con sus dias de retraso ya contados: el
 * motor decide y el narrador lo cuenta, que es la regla de toda la casa.
 *
 * @param {Object} input
 * @param {number} input.days      Los del viaje.
 * @param {any[]} [input.table]    Filas con `{id, name, note, days?, when?}`.
 * @param {() => number} [input.random]
 * @param {number} [input.chance]  Probabilidad por dia cuando la fila no diga la suya.
 * @param {string} [input.biome]   Por donde se pasa.
 * @param {string[]} [input.weather] Que tiempo hizo cada dia.
 * @returns {Array<{day: number, id: string, name: string, note: string, days: number, climate: string}>}
 */
export function travelEvents({
    days: total, table = [], random = Math.random, chance = 0.35, biome = '', weather = [],
}) {
    const rows = (Array.isArray(table) ? table : []).filter(Boolean);
    if (rows.length === 0) return [];

    /** @type {Array<{day: number, id: string, name: string, note: string, days: number, climate: string}>} */
    const out = [];
    // Lo mismo dos veces en el mismo viaje se lee como un error, no como mala suerte.
    const already = new Set();

    for (let day = 1; day <= Math.max(0, Math.round(total)); day++) {
        if (random() >= chance) continue;

        // Solo lo que pega con donde se esta y con el tiempo que hace: una tormenta no
        // cae con el cielo despejado, y eso lo dice la fila, no este codigo.
        const climate = text(weather[day - 1]);
        const fit = rows.filter(row => matches(row, { biome: text(biome), climate })
            && !already.has(text(row.id)));
        if (fit.length === 0) continue;

        const row = pickWeighted(fit.map(r => ({ ...r, weight: number(r.weight, 1) })), random);
        if (!row) continue;

        already.add(text(row.id));
        out.push({
            day,
            id: text(row.id),
            name: text(row.name),
            note: text(row.note),
            climate,
            // Dias de mas o de menos: el reloj ya sabe lo que cuesta un dia, y un atajo
            // que no pudiera restarlos seria un atajo que no existe.
            days: Math.round(number(row.days, 0)),
        });
    }

    return out;
}

/**
 * El viaje en una linea, para el boton que lo confirma.
 *
 * @param {{ok: boolean, days: number, legs: string[], reason: string}} plan
 * @returns {string}
 */
export function describeTravel(plan) {
    if (!plan?.ok) return text(plan?.reason);

    const jornadas = plan.days === 1 ? '1 día' : `${plan.days} días`;
    if (plan.legs.length <= 1) return jornadas;
    return `${jornadas}, pasando por ${plan.legs.slice(0, -1).join(', ')}`;
}
