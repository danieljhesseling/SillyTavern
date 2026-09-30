/**
 * Caminos que se abren por reputación y por llaves (J10.1 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * La historia ya cerraba caminos hasta un hito (`closedUntil`) y la estación, hasta el
 * invierno. Faltaba lo que se gana jugando: que los Lobos os dejen pasar por su sendero
 * cuando os miran bien, que la barrera de la calzada se levante con un salvoconducto, que el
 * río se baje en barca o que el hielo se cruce con alguien que sepa dónde aguanta.
 *
 * Un camino lo dice en sus datos, con la lista de formas de abrirlo (`opensWith`). Basta una:
 *
 * | Forma | Se abre si… |
 * | :--- | :--- |
 * | `{"standing": "id-de-faccion", "min": 2}` | esa facción os mira al menos así (de −5 a 5) |
 * | `{"fame": 2, "at": "Sitio"}` | sois conocidos en ese sitio (sin `at`, en el de destino) |
 * | `{"key": "Salvoconducto de Montesclaros"}` | lleváis eso: un objeto, o algo que os dieron (una barca) |
 * | `{"guide": "Finn"}` | esa persona va con vosotros, o se ha ofrecido a guiaros |
 *
 * Cada forma puede traer `label`, cómo se dice en la pantalla («una barca»). Y el camino,
 * `gateNote`: por qué está cerrado, en una frase llana.
 *
 * **La puerta guarda el sitio de destino.** El camino se escribe en el sentido en que se
 * entra. Mientras no se cumpla, el paso está cerrado en los dos sentidos, salvo para salir de
 * donde ya estáis: nadie se queda atrapado dentro.
 *
 * Puro: de los sitios y de lo que tenéis, a los mismos sitios con esos caminos cerrados (y su
 * motivo) o abiertos. El viaje (`travel.js`) no sabe nada de puertas: le llegan caminos
 * cerrados con su nota, como los de la estación.
 */

import { readFactions, speaksPlural } from '../campaign/factions.js';
import { fameAt, FAME_LEVELS } from '../campaign/fame.js';

/** Las formas de abrir un camino. */
export const GATE_KINDS = ['standing', 'fame', 'key', 'guide'];

/**
 * @typedef {Object} GateCondition
 * @property {'standing'|'fame'|'key'|'guide'} kind
 * @property {string} target El id de la facción, el nombre de la llave o de quien guía.
 * @property {number} min Desde cuánto (la reputación o la fama).
 * @property {string} at Dónde cuenta la fama. Vacío: en el sitio de destino.
 * @property {string} label Cómo se dice, si el paquete lo escribe.
 */

/**
 * @typedef {Object} Gate
 * @property {GateCondition[]} conditions
 * @property {string} note Por qué está cerrado, en una frase.
 */

/**
 * @typedef {Object} GateContext
 * @property {string} [here] Dónde está el grupo: de ahí siempre se puede salir.
 * @property {any[]} [factions] Las facciones del mundo, con su reputación.
 * @property {any} [fame] La fama por sitio (`fame.js`).
 * @property {string[]} [keys] Lo que tenéis: objetos, gente del grupo y lo que os dieron.
 */

/**
 * @typedef {Object} GateInfo
 * @property {string} from
 * @property {string} to
 * @property {boolean} open
 * @property {string} by Cómo se abrió (la forma cumplida), si está abierto.
 * @property {string} needs Lo que hace falta, dicho entero: «Se abre si…».
 * @property {string} note La frase del paquete.
 * @property {string[]} kinds Las formas que tiene (para el icono del mapa).
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Un nombre para comparar: sin mayúsculas, sin tildes y sin espacios de más.
 *
 * @param {any} value
 * @returns {string}
 */
export function plainName(value) {
    return text(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Si un nombre de facción pide el verbo en plural: «Los Lobos os miran», pero también
 * «Leales de Montesclaros os miran», que no lleva artículo.
 *
 * @param {string} name
 * @returns {boolean}
 */
function plural(name) {
    if (speaksPlural(name)) return true;
    const first = plainName(name).split(' ')[0] ?? '';
    return !/^(la|el|una?)$/.test(first) && first.length > 3 && first.endsWith('s');
}

/**
 * Una forma de abrir, tal como se puede usar, venga como venga escrita. Una que no se entiende
 * no sale: un camino con una forma rota se queda con las demás.
 *
 * @param {any} raw
 * @returns {GateCondition|null}
 */
export function readCondition(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const label = text(raw.label);
    const standing = text(raw.standing ?? raw.reputation ?? raw.faction);
    if (standing) {
        const min = Math.max(-5, Math.min(5, Math.round(Number(raw.min ?? 1))));
        return { kind: 'standing', target: standing, min: Number.isFinite(min) ? min : 1, at: '', label };
    }
    if (raw.fame !== undefined) {
        const min = Math.max(1, Math.round(Number(raw.fame) || 0));
        return { kind: 'fame', target: '', min, at: text(raw.at), label };
    }
    if (text(raw.key)) return { kind: 'key', target: text(raw.key), min: 0, at: '', label };
    if (text(raw.guide)) return { kind: 'guide', target: text(raw.guide), min: 0, at: '', label };
    return null;
}

/**
 * La puerta de un camino, o nada si no tiene.
 *
 * @param {any} route
 * @returns {Gate|null}
 */
export function readGate(route) {
    const list = Array.isArray(route?.opensWith) ? route.opensWith : [];
    const conditions = list.map(readCondition).filter(/** @returns {c is GateCondition} */ c => Boolean(c));
    if (conditions.length === 0) return null;
    return { conditions, note: text(route?.gateNote) };
}

/**
 * Lo que el grupo tiene, para las llaves y los guías: lo que lleva cada uno, quién va en el
 * grupo y lo que os dieron sin ser un objeto (una barca, un guía que os espera).
 *
 * @param {Object} input
 * @param {any[]} [input.party]
 * @param {string[]} [input.worldKeys]
 * @returns {string[]}
 */
export function keyringOf({ party = [], worldKeys = [] } = {}) {
    /** @type {string[]} */
    const out = [];
    for (const member of Array.isArray(party) ? party : []) {
        if (!member || member.dead) continue;
        if (text(member.name)) out.push(text(member.name));
        for (const item of Array.isArray(member.items) ? member.items : []) {
            const name = text(typeof item === 'string' ? item : item?.name);
            if (name) out.push(name);
        }
    }
    for (const key of Array.isArray(worldKeys) ? worldKeys : []) if (text(key)) out.push(text(key));
    return [...new Set(out)];
}

/**
 * Si entre lo que tenéis está eso. «Salvoconducto de Montesclaros (sellado)» vale por
 * «Salvoconducto de Montesclaros»: lo de después es el estado del objeto, no otro objeto.
 *
 * @param {string[]} keys
 * @param {string} wanted
 * @returns {boolean}
 */
export function hasKey(keys, wanted) {
    const goal = plainName(wanted);
    if (!goal) return false;
    return (Array.isArray(keys) ? keys : []).some(key => {
        const have = plainName(key);
        return have === goal || have.startsWith(`${goal} `);
    });
}

/**
 * Apuntar algo que abre caminos (la barca, el guía), sin repetirlo.
 *
 * @param {any} keys
 * @param {string} name
 * @returns {string[]}
 */
export function addWorldKey(keys, name) {
    const list = (Array.isArray(keys) ? keys : []).map(text).filter(Boolean);
    const clean = text(name);
    return clean && !hasKey(list, clean) ? [...list, clean] : list;
}

/**
 * La facción de una forma: por su id o por su nombre.
 *
 * @param {any[]} factions
 * @param {string} target
 * @returns {{id: string, name: string, reputation: number}|null}
 */
function factionOf(factions, target) {
    const want = plainName(target);
    return readFactions(factions).find(f => plainName(f.id) === want || plainName(f.name) === want) ?? null;
}

/**
 * Cómo se dice una forma, para «Se abre si…».
 *
 * @param {GateCondition} condition
 * @param {Object} input
 * @param {any[]} [input.factions]
 * @param {string} [input.to] El sitio de destino (donde cuenta la fama si no se dice).
 * @returns {string}
 */
export function describeCondition(condition, { factions = [], to = '' } = {}) {
    if (condition.label) return `con ${condition.label}`;
    switch (condition.kind) {
        case 'standing': {
            const name = factionOf(factions, condition.target)?.name || condition.target;
            const many = plural(name);
            const how = condition.min <= 0 ? (many ? 'no os tienen ganas' : 'no os tiene ganas')
                : condition.min === 1 ? (many ? 'os conocen' : 'os conoce')
                    : condition.min <= 3 ? (many ? 'os miran bien' : 'os mira bien')
                        : (many ? 'os deben una' : 'os debe una');
            return `si ${name} ${how}`;
        }
        case 'fame': {
            const step = [...FAME_LEVELS].reverse().find(level => condition.min >= level.at && level.label) ?? FAME_LEVELS[1];
            return `si en ${condition.at || to || 'ese sitio'} ${step.label}`;
        }
        case 'key':
            return `con ${condition.target}`;
        case 'guide':
            return `si ${condition.target} os guía`;
        default:
            return '';
    }
}

/**
 * Si una forma se cumple ahora.
 *
 * @param {GateCondition} condition
 * @param {GateContext & {to?: string}} context
 * @returns {boolean}
 */
export function conditionMet(condition, context = {}) {
    switch (condition.kind) {
        case 'standing': {
            const faction = factionOf(context.factions ?? [], condition.target);
            return (faction?.reputation ?? 0) >= condition.min;
        }
        case 'fame':
            return fameAt(context.fame, condition.at || text(context.to)).points >= condition.min;
        case 'key':
        case 'guide':
            return hasKey(context.keys ?? [], condition.target);
        default:
            return false;
    }
}

/**
 * Lo que hace falta para abrir una puerta, dicho entero: «Se abre si Los Lobos del Bosque
 * os miran bien, o con un salvoconducto de Montesclaros.»
 *
 * @param {Gate} gate
 * @param {{factions?: any[], to?: string}} [input]
 * @returns {string}
 */
export function describeGate(gate, input = {}) {
    const parts = gate.conditions.map(c => describeCondition(c, input)).filter(Boolean);
    if (parts.length === 0) return '';
    const said = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} o ${parts[parts.length - 1]}`;
    return `Se abre ${said}.`;
}

/**
 * Si una puerta está abierta ahora, y por qué forma.
 *
 * @param {Gate} gate
 * @param {GateContext & {to?: string}} context
 * @returns {{open: boolean, by: string}}
 */
export function gateOpen(gate, context = {}) {
    const met = gate.conditions.find(c => conditionMet(c, context));
    return met ? { open: true, by: describeCondition(met, context) } : { open: false, by: '' };
}

/**
 * La frase de un camino cerrado por su puerta: la del paquete y lo que hace falta.
 *
 * @param {Gate} gate
 * @param {{factions?: any[], to?: string}} input
 * @returns {string}
 */
function closedNote(gate, input) {
    const why = text(gate.note).replace(/\.$/, '');
    return [why, describeGate(gate, input).replace(/\.$/, '')].filter(Boolean).join('. ');
}

/**
 * Los sitios con sus caminos puestos según lo que tenéis: los de puerta sin cumplir, cerrados
 * (en los dos sentidos, salvo para salir de donde estáis) y con su motivo; los cumplidos,
 * abiertos. Lo demás no se toca. Devuelve copias: lo guardado se queda como estaba.
 *
 * @param {any[]} locations
 * @param {GateContext} [context]
 * @returns {any[]}
 */
export function gateRoutes(locations, context = {}) {
    const all = Array.isArray(locations) ? locations : [];
    const here = plainName(context.here);
    /** @type {Map<string, string>} Los pasos cerrados, «de→a» en llano, con su nota. */
    const shut = new Map();
    const pair = (/** @type {string} */ a, /** @type {string} */ b) => `${plainName(a)}→${plainName(b)}`;

    for (const location of all) {
        const from = text(location?.name);
        for (const route of Array.isArray(location?.routes) ? location.routes : []) {
            const gate = readGate(route);
            if (!gate || !text(route?.to)) continue;
            const input = { ...context, factions: context.factions ?? [], to: text(route.to) };
            if (gateOpen(gate, input).open) continue;
            const note = closedNote(gate, input);
            shut.set(pair(from, route.to), note);
            // La vuelta, salvo para salir de donde estáis.
            if (plainName(route.to) !== here) shut.set(pair(route.to, from), note);
        }
    }
    if (shut.size === 0) return all;

    return all.map(location => {
        const from = text(location?.name);
        if (!Array.isArray(location?.routes)) return location;
        return {
            ...location,
            routes: location.routes.map((/** @type {any} */ route) => {
                const note = shut.get(pair(from, route?.to));
                if (note === undefined) return route;
                return { ...route, closed: true, gated: true, note: [text(route.note), note].filter(Boolean).join('. ') };
            }),
        };
    });
}

/**
 * Todas las puertas del mundo, abiertas o no: para el mapa (su icono y su motivo) y para
 * decir, una vez, cuándo se abre una.
 *
 * @param {any[]} locations
 * @param {GateContext} [context]
 * @returns {GateInfo[]}
 */
export function gateStatus(locations, context = {}) {
    /** @type {GateInfo[]} */
    const out = [];
    for (const location of Array.isArray(locations) ? locations : []) {
        const from = text(location?.name);
        for (const route of Array.isArray(location?.routes) ? location.routes : []) {
            const gate = readGate(route);
            if (!gate || !text(route?.to)) continue;
            const input = { ...context, factions: context.factions ?? [], to: text(route.to) };
            const state = gateOpen(gate, input);
            out.push({
                from,
                to: text(route.to),
                open: state.open,
                by: state.by,
                needs: describeGate(gate, input),
                note: gate.note,
                kinds: [...new Set(gate.conditions.map(c => c.kind))],
            });
        }
    }
    return out;
}

/** @param {{from: string, to: string}} info @returns {string} */
const gateKey = (info) => `${info.from}→${info.to}`;

/**
 * Las puertas que se han abierto desde la última vez que se miró. La primera vez no se
 * anuncia nada: lo abierto desde el principio no es una novedad.
 *
 * @param {any} previous Las que estaban abiertas (`gateKey`), o nada si nunca se miró.
 * @param {GateInfo[]} status
 * @returns {{opened: GateInfo[], open: string[]}}
 */
export function newlyOpened(previous, status) {
    const open = status.filter(g => g.open).map(gateKey);
    if (!Array.isArray(previous)) return { opened: [], open };
    const before = new Set(previous.map(text));
    return { opened: status.filter(g => g.open && !before.has(gateKey(g))), open };
}

/**
 * Cómo se anuncia un camino que se acaba de abrir.
 *
 * @param {GateInfo} info
 * @returns {string}
 */
export function describeOpened(info) {
    const by = info.by.replace(/^si /, '').replace(/^con /, 'tenéis ');
    return `Se os abre el camino de ${info.from} a ${info.to}: ${by}.`;
}

/**
 * Lo que un paquete escribe mal en sus puertas, como avisos: una facción que no existe, una
 * fama en un sitio que no está, o una forma que no se entiende.
 *
 * @param {any} pack
 * @returns {Array<{path: string, message: string}>}
 */
export function gateWarnings(pack) {
    /** @type {Array<{path: string, message: string}>} */
    const out = [];
    const factions = Array.isArray(pack?.world?.factions) ? pack.world.factions : [];
    const places = new Set((Array.isArray(pack?.locations) ? pack.locations : []).map((/** @type {any} */ l) => plainName(l?.name)));
    (Array.isArray(pack?.locations) ? pack.locations : []).forEach((/** @type {any} */ location, /** @type {number} */ index) => {
        (Array.isArray(location?.routes) ? location.routes : []).forEach((/** @type {any} */ route, /** @type {number} */ at) => {
            if (route?.opensWith === undefined) return;
            const path = `locations[${index}].routes[${at}].opensWith`;
            if (!Array.isArray(route.opensWith)) {
                out.push({ path, message: 'Tiene que ser una lista de formas de abrir el camino; se ignora.' });
                return;
            }
            route.opensWith.forEach((/** @type {any} */ raw, /** @type {number} */ k) => {
                const condition = readCondition(raw);
                if (!condition) {
                    out.push({ path: `${path}[${k}]`, message: `No se entiende: tiene que decir ${GATE_KINDS.map(g => `\`${g}\``).join(', ')}. No cuenta.` });
                    return;
                }
                if (condition.kind === 'standing' && !factionOf(factions, condition.target)) {
                    out.push({ path: `${path}[${k}].standing`, message: `"${condition.target}" no es una facción del paquete: ese camino no se abrirá así.` });
                }
                if (condition.kind === 'fame' && condition.at && !places.has(plainName(condition.at))) {
                    out.push({ path: `${path}[${k}].at`, message: `"${condition.at}" no es una localización del paquete.` });
                }
            });
        });
    });
    return out;
}
