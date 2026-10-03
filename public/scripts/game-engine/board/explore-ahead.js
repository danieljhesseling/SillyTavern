/**
 * E7.1 de wiki/ROADMAP_ENTRETENIDO.md (G5.1 de ROADMAP_AUTOMATIZAR): «Explorar hacia delante».
 *
 * Un toque y el grupo avanza en formación por el pasillo o la sala, hacia lo que aún no ha visto,
 * y se para en seco ante lo que importa:
 *
 * - **alguien** que espera (un enemigo a la vista, despierto o dormido);
 * - **una trampa** ya vista;
 * - **un cofre** o **una puerta** cerrada (se para al lado);
 * - **la oscuridad** (E2.1): a oscuras, sin luz y sin nadie que vea en la oscuridad, no se avanza.
 *
 * Lo que ya estaba a la vista al empezar y nadie ha dicho todavía para la marcha al momento (sin
 * dar un paso) o, si es un cofre o una puerta, se va hasta su lado. Lo que aparece andando para
 * la marcha donde se ve. Sin nada de eso, se sigue hasta lo último sin ver (la niebla) y desde
 * ahí, otra vez, hasta que se encuentra algo o no queda nada por ver.
 *
 * La vista es la de la niebla (`fog-of-war.js`): las casillas a su alcance sin pared de por
 * medio. Las trampas escondidas no se saben aquí: las encuentra quien anda (`walkPath`, en la
 * marcha de siempre).
 *
 * Puro: planea y explica. No mueve a nadie.
 */

import { cellKey, isPassable } from './terrain.js';
import { getVisibleCells } from './line-of-sight.js';

/** Lo más que se anda de un toque, en casillas. */
export const AHEAD_MAX_STEPS = 80;

/** Lo que ve quien abre la marcha, en casillas, si no se dice (los 60 pies de la niebla). */
export const AHEAD_SIGHT = 12;

/**
 * @typedef {'foe'|'trap'|'chest'|'door'|'dark'|'nothing'|'blocked'|'far'} AheadKind
 */

/**
 * @typedef {Object} AheadThing Algo del tablero que para la marcha.
 * @property {'foe'|'trap'|'chest'|'door'} kind
 * @property {number} x
 * @property {number} y
 * @property {string} [name]
 */

/**
 * @typedef {Object} AheadPlan
 * @property {AheadKind} kind Por qué se para.
 * @property {Array<{x: number, y: number}>} path El camino de quien abre la marcha, con la salida.
 * @property {{x: number, y: number}} to Donde se para.
 * @property {AheadThing[]} found Lo que lo ha parado (lo que se dice).
 * @property {string[]} seen Las claves de lo que ya se ha visto y dicho, con lo de ahora.
 */

/** @param {any} value @returns {number} */
const num = (value) => (Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0);

/** Las ocho de alrededor. */
const AROUND = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/**
 * La clave de algo del tablero, para saber si ya se ha dicho.
 *
 * @param {AheadThing} thing
 * @returns {string}
 */
export function thingKey(thing) {
    return `${thing.kind}@${num(thing.x)},${num(thing.y)}`;
}

/**
 * Planear la marcha hacia delante.
 *
 * @param {Object} input
 * @param {any} input.terrain
 * @param {number} input.gridWidth
 * @param {number} input.gridHeight
 * @param {{x: number, y: number}} input.start Donde está quien abre la marcha.
 * @param {AheadThing[]} [input.things] Lo que hay: enemigos, trampas vistas, cofres y puertas cerradas.
 * @param {Iterable<string>|null} [input.explored] Las casillas ya vistas (la niebla); nulo si el
 *   tablero no tiene niebla (todo se ve).
 * @param {Iterable<string>} [input.seen] Lo que ya se ha dicho (`thingKey`).
 * @param {Array<{x: number, y: number}>} [input.blocked] Por donde no se anda (los del grupo que
 *   no andan, los enemigos).
 * @param {number} [input.sight] Lo que se ve, en casillas.
 * @param {boolean} [input.canSee] Si se ve algo (E2.1): a oscuras, sin luz ni visión en la oscuridad, no.
 * @param {number} [input.maxSteps]
 * @returns {AheadPlan}
 */
export function planExploreAhead({
    terrain, gridWidth, gridHeight, start, things = [], explored = null, seen = [], blocked = [],
    sight = AHEAD_SIGHT, canSee = true, maxSteps = AHEAD_MAX_STEPS,
}) {
    const from = { x: num(start?.x), y: num(start?.y) };
    const said = new Set(seen ?? []);
    /** @type {AheadPlan} */
    const plan = { kind: 'nothing', path: [from], to: from, found: [], seen: [...said] };
    if (!canSee) {
        plan.kind = 'dark';
        return plan;
    }
    const list = (Array.isArray(things) ? things : []).filter(t => t && ['foe', 'trap', 'chest', 'door'].includes(t.kind));
    const fog = explored ? new Set(explored) : null;
    const stopKeys = new Set((Array.isArray(blocked) ? blocked : []).map(c => cellKey(num(c?.x), num(c?.y))));
    // Las trampas vistas y los enemigos no se pisan.
    for (const thing of list) if (thing.kind === 'trap' || thing.kind === 'foe') stopKeys.add(cellKey(thing.x, thing.y));
    const walkable = (/** @type {number} */ x, /** @type {number} */ y) => isPassable(terrain, x, y, gridWidth, gridHeight) && !stopKeys.has(cellKey(x, y));
    const view = (/** @type {{x: number, y: number}} */ at) => new Set(getVisibleCells(terrain, at.x, at.y, Math.max(1, num(sight)), gridWidth, gridHeight).map(c => cellKey(c.x, c.y)));
    const look = (/** @type {Set<string>} */ visible) => {
        if (fog) for (const key of visible) fog.add(key);
    };
    const fresh = (/** @type {Set<string>} */ visible) => list.filter(t => !said.has(thingKey(t)) && visible.has(cellKey(t.x, t.y)));
    const finish = (/** @type {AheadKind} */ kind, /** @type {AheadThing[]} */ found) => {
        plan.kind = kind;
        plan.found = found;
        for (const thing of found) said.add(thingKey(thing));
        plan.to = plan.path[plan.path.length - 1];
        plan.seen = [...said];
        return plan;
    };

    // Lo que ya se ve al empezar: un enemigo o una trampa sin decir paran ya.
    let here = from;
    let visible = view(here);
    look(visible);
    const urgent = fresh(visible).filter(t => t.kind === 'foe' || t.kind === 'trap');
    if (urgent.length > 0) return finish(urgent[0].kind, urgent);
    // Lo que se ve al empezar y no para (un cofre, una puerta) ya no para andando: se va a por ello.
    const known = new Set(fresh(visible).map(thingKey));

    let steps = 0;
    while (steps < maxSteps) {
        // A dónde: lo más cerca de lo que queda por decir (al lado de un cofre o de una puerta) o
        // de lo que queda por ver (al borde de la niebla).
        const route = nearestGoal({ from: here, walkable, gridWidth, gridHeight, things: list.filter(t => (t.kind === 'chest' || t.kind === 'door') && !said.has(thingKey(t))), fog, terrain });
        if (!route) return finish(plan.path.length > 1 ? 'far' : 'nothing', []);
        for (let i = 1; i < route.path.length; i++) {
            const cell = route.path[i];
            plan.path.push(cell);
            steps++;
            here = cell;
            visible = view(here);
            look(visible);
            const appear = fresh(visible).filter(t => !known.has(thingKey(t)));
            if (appear.length > 0) {
                // Lo más urgente primero: alguien, una trampa, y luego lo demás.
                const order = ['foe', 'trap', 'door', 'chest'];
                appear.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
                return finish(appear[0].kind, appear.filter(t => t.kind === appear[0].kind));
            }
            if (steps >= maxSteps) return finish('far', []);
        }
        if (route.thing) return finish(route.thing.kind, [route.thing]);
        // Al borde de la niebla: lo de alrededor ya se ha visto; se sigue desde aquí.
    }
    return finish('far', []);
}

/**
 * El camino más corto a lo siguiente: al lado de un cofre o de una puerta por decir, o al borde
 * de lo que no se ha visto (una casilla por la que se anda junto a otra sin ver por la que también
 * se andaría).
 *
 * @param {Object} input
 * @param {{x: number, y: number}} input.from
 * @param {(x: number, y: number) => boolean} input.walkable
 * @param {number} input.gridWidth
 * @param {number} input.gridHeight
 * @param {AheadThing[]} input.things
 * @param {Set<string>|null} input.fog
 * @param {any} input.terrain
 * @returns {{path: Array<{x: number, y: number}>, thing: AheadThing|null}|null}
 */
function nearestGoal({ from, walkable, gridWidth, gridHeight, things, fog, terrain }) {
    const besideThing = new Map();
    for (const thing of things) {
        for (const [dx, dy] of AROUND) besideThing.set(cellKey(thing.x + dx, thing.y + dy), besideThing.get(cellKey(thing.x + dx, thing.y + dy)) ?? thing);
    }
    const edge = (/** @type {number} */ x, /** @type {number} */ y) => {
        if (!fog) return false;
        for (const [dx, dy] of AROUND) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) continue;
            if (!fog.has(cellKey(nx, ny)) && isPassable(terrain, nx, ny, gridWidth, gridHeight)) return true;
        }
        return false;
    };
    /** @type {Map<string, string>} */
    const parent = new Map([[cellKey(from.x, from.y), '']]);
    const queue = [from];
    while (queue.length > 0) {
        const cell = /** @type {{x: number, y: number}} */ (queue.shift());
        const key = cellKey(cell.x, cell.y);
        const isStart = key === cellKey(from.x, from.y);
        const thing = besideThing.get(key) ?? null;
        if (thing || (!isStart && edge(cell.x, cell.y))) {
            /** @type {Array<{x: number, y: number}>} */
            const path = [];
            let at = key;
            while (at) {
                const [x, y] = at.split(',').map(Number);
                path.unshift({ x, y });
                at = parent.get(at) ?? '';
            }
            return { path, thing };
        }
        for (const [dx, dy] of AROUND) {
            const x = cell.x + dx;
            const y = cell.y + dy;
            const next = cellKey(x, y);
            if (parent.has(next) || !walkable(x, y)) continue;
            // Sin colarse entre dos muros que se tocan en la esquina.
            if (dx !== 0 && dy !== 0 && (!walkable(cell.x + dx, cell.y) || !walkable(cell.x, cell.y + dy))) continue;
            parent.set(next, key);
            queue.push({ x, y });
        }
    }
    return null;
}

/**
 * Lo que dice quien lo ve: una frase corta y llana (D-J60: la dice alguien del grupo).
 *
 * @param {AheadPlan} plan
 * @returns {string} Vacío si no hay nada que decir.
 */
export function aheadLine(plan) {
    const found = Array.isArray(plan?.found) ? plan.found : [];
    const names = [...new Set(found.map(t => String(t.name ?? '').trim()).filter(Boolean))];
    switch (plan?.kind) {
        case 'foe': return names.length > 0 ? `¡Alto! Ahí delante hay alguien: ${names.join(', ')}.` : '¡Alto! Ahí delante hay alguien.';
        case 'trap': return names.length > 0 ? `¡Quietos! Ahí hay una trampa: ${names[0].toLowerCase()}.` : '¡Quietos! Ahí hay una trampa.';
        case 'chest': return found.length > 1 ? 'Mirad, cofres.' : 'Mirad, un cofre.';
        case 'door': return 'Aquí hay una puerta. La abrimos cuando digas.';
        case 'dark': return 'Está demasiado oscuro para seguir. Necesitamos luz.';
        default: return '';
    }
}

/**
 * Lo que se dice fuera de la novela cuando no hay nadie que lo diga, o no se ha encontrado nada.
 *
 * @param {AheadPlan} plan
 * @returns {string}
 */
export function aheadNotice(plan) {
    switch (plan?.kind) {
        case 'nothing': return 'No queda nada a la vista por explorar aquí.';
        case 'far': return 'Habéis avanzado un buen trecho sin encontrar nada.';
        case 'foe': return 'Hay alguien delante.';
        case 'trap': return 'Hay una trampa delante.';
        case 'chest': return 'Hay un cofre.';
        case 'door': return 'Hay una puerta.';
        case 'dark': return 'A oscuras no se puede seguir: hace falta luz.';
        default: return '';
    }
}
