/**
 * El mapa de la campaña, dibujado (J10.5 de wiki/ROADMAP_SIN_CONEXION.md): dónde va cada sitio
 * y qué se dibuja entre ellos.
 *
 * El mapa en texto (`text-map.js`, ideas 69 y 70) ya sabía lo que hace falta: qué habéis
 * pisado, qué caminos conocéis y vuestras notas. Aquí se le pone sitio a cada cosa:
 *
 * - **Dónde va cada sitio.** Si el paquete lo dice (`map: {x, y}`, de 0 a 100), ahí. Si no, se
 *   reparte solo, con muelles: los caminos tiran y los sitios se apartan, y un camino de tres
 *   días queda más largo que uno de uno. Sin azar: el mismo mundo sale siempre igual.
 * - **Los caminos, una vez cada uno**, aunque estén escritos en los dos sitios: conocido o no,
 *   abierto o cerrado (y por qué), con su puerta si la tiene (J10.1) y si sale de aquí.
 * - **Cada sitio**, con su estado (aquí, visitado, sin visitar), su nota y cómo se llega desde
 *   donde estáis (`reachFrom`).
 *
 * Lo escondido (lo que aún no ha revelado un hito o un rumor) no está en la lista que llega,
 * y no sale: no se sabe que existe.
 *
 * Puro: arma el dibujo en datos. Lo pinta `ui/campaign-map.js`.
 */

import { mapRows } from '../campaign/text-map.js';
import { reachFrom } from './travel.js';

/** El margen del dibujo, para que ningún sitio quede pegado al borde. */
export const MAP_MARGIN = { x: 9, y: 11 };

/** Lo más cerca que pueden quedar dos sitios (en puntos del dibujo, de 0 a 100). */
export const MIN_GAP = 11;

/**
 * @typedef {Object} MapPlace
 * @property {string} name
 * @property {number} x De 0 a 100, de izquierda a derecha.
 * @property {number} y De 0 a 100, de arriba abajo.
 * @property {'aqui'|'visitado'|'sin-visitar'} state
 * @property {string} type El tipo de sitio (`village`, `ruins`…).
 * @property {string} description
 * @property {string} note Tu nota.
 * @property {'here'|'near'|'shut'|'far'|'none'} reach Cómo se llega desde donde estáis.
 * @property {number} days Lo que cuesta llegar, si se llega.
 * @property {string} reason Por qué no se puede ir, o por dónde se pasa.
 */

/**
 * @typedef {Object} MapRoad
 * @property {string} a
 * @property {string} b
 * @property {number} days
 * @property {boolean} known Si habéis estado en uno de sus dos extremos.
 * @property {boolean} closed
 * @property {string} note Por qué está cerrado, si lo está.
 * @property {boolean} fromHere Si sale de donde estáis.
 * @property {{open: boolean, needs: string, by: string, kinds: string[]}|null} gate Su puerta (J10.1).
 */

/**
 * @typedef {Object} MapModel
 * @property {MapPlace[]} places
 * @property {MapRoad[]} roads
 * @property {string} here
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Un número del 0 al 1 sacado de un nombre, siempre el mismo: para desempatar sin azar.
 *
 * @param {string} name
 * @returns {number}
 */
function hashUnit(name) {
    let h = 2166136261;
    for (const ch of text(name)) {
        h ^= ch.codePointAt(0) ?? 0;
        h = Math.imul(h, 16777619) >>> 0;
    }
    return (h % 10000) / 10000;
}

/**
 * Dónde va cada sitio: el que trae su sitio en el paquete se queda ahí; los demás se reparten
 * con muelles alrededor.
 *
 * @param {Object} input
 * @param {string[]} input.names
 * @param {Array<{a: string, b: string, days: number}>} input.edges
 * @param {Record<string, {x: number, y: number}>} [input.fixed]
 * @param {number} [input.steps]
 * @returns {Record<string, {x: number, y: number}>}
 */
export function layoutPlaces({ names, edges, fixed = {}, steps = 420 }) {
    const list = [...new Set((Array.isArray(names) ? names : []).map(text).filter(Boolean))];
    /** @type {Record<string, {x: number, y: number}>} */
    const out = {};
    if (list.length === 0) return out;
    const pinned = new Set(list.filter(name => fixed[name] && Number.isFinite(fixed[name].x) && Number.isFinite(fixed[name].y)));

    // El orden de salida: de vecino en vecino desde el primero, para que en el círculo de
    // partida lo que está unido empiece junto.
    const neighbours = new Map(list.map(name => [name, /** @type {string[]} */ ([])]));
    for (const edge of edges) {
        if (!neighbours.has(edge.a) || !neighbours.has(edge.b)) continue;
        neighbours.get(edge.a)?.push(edge.b);
        neighbours.get(edge.b)?.push(edge.a);
    }
    /** @type {string[]} */
    const order = [];
    for (const start of list) {
        if (order.includes(start)) continue;
        const queue = [start];
        while (queue.length > 0) {
            const at = /** @type {string} */ (queue.shift());
            if (order.includes(at)) continue;
            order.push(at);
            for (const next of neighbours.get(at) ?? []) if (!order.includes(next)) queue.push(next);
        }
    }

    /** @type {Map<string, {x: number, y: number}>} */
    const pos = new Map();
    const free = order.filter(name => !pinned.has(name));
    free.forEach((name, index) => {
        const angle = (index / Math.max(1, free.length)) * Math.PI * 2 + hashUnit(name) * 0.3;
        pos.set(name, { x: 50 + Math.cos(angle) * 32, y: 50 + Math.sin(angle) * 32 });
    });
    for (const name of pinned) pos.set(name, { x: fixed[name].x, y: fixed[name].y });

    if (free.length > 0) {
        // Fruchterman y Reingold, con la temperatura bajando: al principio se mueve mucho, al
        // final solo se asienta.
        const k = Math.max(12, 70 / Math.sqrt(list.length));
        for (let step = 0; step < steps; step++) {
            const heat = 6 * (1 - step / steps) + 0.2;
            /** @type {Map<string, {x: number, y: number}>} */
            const push = new Map(list.map(name => [name, { x: 0, y: 0 }]));
            for (let i = 0; i < list.length; i++) {
                for (let j = i + 1; j < list.length; j++) {
                    const a = /** @type {{x: number, y: number}} */ (pos.get(list[i]));
                    const b = /** @type {{x: number, y: number}} */ (pos.get(list[j]));
                    let dx = a.x - b.x;
                    let dy = a.y - b.y;
                    let d = Math.hypot(dx, dy);
                    if (d < 0.01) {
                        dx = hashUnit(list[i]) - 0.5;
                        dy = hashUnit(list[j]) - 0.5;
                        d = Math.hypot(dx, dy) || 0.01;
                    }
                    const force = (k * k) / d;
                    const pi = /** @type {{x: number, y: number}} */ (push.get(list[i]));
                    const pj = /** @type {{x: number, y: number}} */ (push.get(list[j]));
                    pi.x += (dx / d) * force;
                    pi.y += (dy / d) * force;
                    pj.x -= (dx / d) * force;
                    pj.y -= (dy / d) * force;
                }
            }
            for (const edge of edges) {
                const a = pos.get(edge.a);
                const b = pos.get(edge.b);
                if (!a || !b) continue;
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const d = Math.hypot(dx, dy) || 0.01;
                // Un camino largo quiere quedar largo.
                const want = k * (0.75 + 0.25 * Math.min(4, Math.max(1, Number(edge.days) || 1)));
                const force = (d * d) / want;
                const pa = /** @type {{x: number, y: number}} */ (push.get(edge.a));
                const pb = /** @type {{x: number, y: number}} */ (push.get(edge.b));
                pa.x -= (dx / d) * force;
                pa.y -= (dy / d) * force;
                pb.x += (dx / d) * force;
                pb.y += (dy / d) * force;
            }
            for (const name of free) {
                const p = /** @type {{x: number, y: number}} */ (pos.get(name));
                const f = /** @type {{x: number, y: number}} */ (push.get(name));
                const len = Math.hypot(f.x, f.y) || 1;
                const move = Math.min(len, heat);
                // Un poco hacia el centro, para que lo suelto no se vaya del dibujo.
                p.x += (f.x / len) * move + (50 - p.x) * 0.01;
                p.y += (f.y / len) * move + (50 - p.y) * 0.01;
            }
        }
    }

    // Al dibujo: lo repartido se estira para llenarlo; lo fijado se queda donde dijo el paquete.
    if (pinned.size === 0) {
        const xs = list.map(name => /** @type {{x: number}} */ (pos.get(name)).x);
        const ys = list.map(name => /** @type {{y: number}} */ (pos.get(name)).y);
        const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
        const spanX = maxX - minX || 1;
        const spanY = maxY - minY || 1;
        for (const name of list) {
            const p = /** @type {{x: number, y: number}} */ (pos.get(name));
            p.x = list.length === 1 ? 50 : MAP_MARGIN.x + ((p.x - minX) / spanX) * (100 - 2 * MAP_MARGIN.x);
            p.y = list.length === 1 ? 50 : MAP_MARGIN.y + ((p.y - minY) / spanY) * (100 - 2 * MAP_MARGIN.y);
        }
    }
    separate(list, pos, pinned);
    for (const name of list) {
        const p = /** @type {{x: number, y: number}} */ (pos.get(name));
        out[name] = {
            x: Math.round(Math.max(4, Math.min(96, p.x)) * 10) / 10,
            y: Math.round(Math.max(6, Math.min(94, p.y)) * 10) / 10,
        };
    }
    return out;
}

/**
 * Que dos sitios no se pisen: si quedan demasiado cerca, se apartan (los fijados no se mueven).
 *
 * @param {string[]} list
 * @param {Map<string, {x: number, y: number}>} pos
 * @param {Set<string>} pinned
 */
function separate(list, pos, pinned) {
    for (let round = 0; round < 40; round++) {
        let moved = false;
        for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {
                const a = /** @type {{x: number, y: number}} */ (pos.get(list[i]));
                const b = /** @type {{x: number, y: number}} */ (pos.get(list[j]));
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const d = Math.hypot(dx, dy);
                if (d >= MIN_GAP) continue;
                const nudge = (MIN_GAP - d) / 2 + 0.1;
                const ux = d > 0.01 ? dx / d : hashUnit(list[i]) - 0.5;
                const uy = d > 0.01 ? dy / d : hashUnit(list[j]) - 0.5;
                if (!pinned.has(list[i])) {
                    a.x += ux * nudge;
                    a.y += uy * nudge;
                }
                if (!pinned.has(list[j])) {
                    b.x -= ux * nudge;
                    b.y -= uy * nudge;
                }
                moved = moved || !pinned.has(list[i]) || !pinned.has(list[j]);
            }
        }
        if (!moved) break;
    }
}

/**
 * El mapa entero, listo para pintar.
 *
 * @param {Object} input
 * @param {any[]} input.locations Los sitios que se ven (sin los escondidos), con sus caminos ya
 *   pasados por sus puertas (`gateRoutes`), si las hay.
 * @param {string} [input.here]
 * @param {string[]} [input.visited]
 * @param {Record<string, string>} [input.notes]
 * @param {string[]} [input.friendly]
 * @param {string} [input.season]
 * @param {string[]} [input.done]
 * @param {import('./route-gates.js').GateInfo[]} [input.gates] Las puertas (`gateStatus`), para su icono.
 * @returns {MapModel}
 */
export function mapModel({ locations, here = '', visited = [], notes = {}, friendly = [], season = '', done = [], gates = [] }) {
    const all = (Array.isArray(locations) ? locations : []).filter(l => text(l?.name));
    const rows = mapRows({ locations: all, here, visited, notes, friendly, season, done });
    const reach = text(here) ? reachFrom({ from: here, locations: all, friendly, season, done }) : {};
    const byName = new Map(all.map(l => [text(l.name), l]));

    // Los caminos, una vez cada uno: cada sitio trae los suyos (también los de vuelta), así que
    // cada camino llega una vez por cada extremo.
    /** @type {Map<string, Array<{from: string, route: {to: string, days: number, known: boolean, closed: boolean, note: string}}>>} */
    const sides = new Map();
    for (const row of rows) {
        for (const route of row.routes) {
            const key = [row.name, route.to].sort((x, y) => x.localeCompare(y)).join('|');
            if (!sides.has(key)) sides.set(key, []);
            sides.get(key)?.push({ from: row.name, route });
        }
    }
    const gateOf = (/** @type {string} */ a, /** @type {string} */ b) => (Array.isArray(gates) ? gates : [])
        .find(g => (g.from === a && g.to === b) || (g.from === b && g.to === a)) ?? null;
    /** @type {MapRoad[]} */
    const roads = [];
    for (const [key, list] of sides) {
        const [a, b] = key.split('|');
        const touchesHere = a === text(here) || b === text(here);
        // Si sale de aquí, manda lo que se ve desde aquí (se puede salir de donde estáis); si no,
        // está abierto si se anda en algún sentido.
        const mine = touchesHere ? list.find(side => side.from === text(here)) : null;
        const closed = mine ? mine.route.closed : list.every(side => side.route.closed);
        const gate = gateOf(a, b);
        roads.push({
            a,
            b,
            days: Math.min(...list.map(side => side.route.days)),
            known: list.some(side => side.route.known),
            closed,
            note: closed ? (mine?.route.note || list.find(side => side.route.closed)?.route.note || '') : '',
            fromHere: touchesHere,
            gate: gate ? { open: gate.open, needs: gate.needs, by: gate.by, kinds: gate.kinds } : null,
        });
    }

    /** @type {Record<string, {x: number, y: number}>} */
    const fixed = {};
    for (const location of all) {
        const x = Number(location?.map?.x);
        const y = Number(location?.map?.y);
        if (location?.map && Number.isFinite(x) && Number.isFinite(y)) fixed[text(location.name)] = { x, y };
    }
    const positions = layoutPlaces({ names: all.map(l => text(l.name)), edges: roads, fixed });

    /** @type {MapPlace[]} */
    const places = rows.map(row => {
        const location = byName.get(row.name);
        const way = reach[row.name];
        return {
            name: row.name,
            x: positions[row.name]?.x ?? 50,
            y: positions[row.name]?.y ?? 50,
            state: row.state,
            type: text(location?.locationType ?? location?.type),
            description: text(location?.description),
            note: row.note,
            reach: row.state === 'aqui' ? 'here' : way?.reach ?? 'none',
            days: way?.days ?? 0,
            reason: way?.reach === 'far' ? `Se llega pasando por ${way.via}.` : text(way?.reason),
        };
    });
    return { places, roads, here: text(here) };
}

/**
 * Lo que se dice de un sitio en el mapa, en una línea: aquí, a cuántos días, cerrado o lejos.
 *
 * @param {MapPlace} place
 * @returns {string}
 */
export function describeReach(place) {
    switch (place.reach) {
        case 'here': return 'Estáis aquí.';
        case 'near': return `A ${place.days} ${place.days === 1 ? 'día' : 'días'} de camino.`;
        case 'shut': return place.reason ? `El paso está cerrado: ${place.reason.replace(/\.$/, '')}.` : 'El paso está cerrado.';
        case 'far': return place.reason || 'Queda lejos: hay que pasar por otro sitio.';
        default: return 'No hay camino desde aquí.';
    }
}
