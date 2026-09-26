/**
 * Las etiquetas de elemento: lo que una habilidad **le hace al mundo**, además del daño (R3
 * del roadmap de profundidad).
 *
 * Un *Rayo de fuego* no prendía las cajas aunque el fuego ya se extendía solo (idea 23), y
 * unas *Zarzas* no eran terreno difícil. Una etiqueta no es un número: es una regla que se
 * cumple en el tablero.
 *
 * | Elemento | En el terreno | En quien lo recibe |
 * | :--- | :--- | :--- |
 * | Fuego | Prende cajas, puertas y maleza; funde el hielo | Quema las zarzas que le sujetan |
 * | Frío | Hiela el agua; apaga el fuego | Quien está mojado o en el agua se queda helado |
 * | Trueno | Revienta las puertas | Quien pisa hielo se cae |
 * | Naturaleza | Hace brotar maleza | — |
 * | Luz | Despeja la oscuridad (R6) | — |
 * | Veneno | — | — |
 *
 * Y el tiempo cuenta: con lluvia, el fuego no prende nada.
 *
 * Todo en una tabla, en un solo sitio, en código (DR7): una etiqueta nueva es una fila aquí,
 * no un `if` repartido por el motor.
 *
 * Puro: con el terreno y los fuegos de quien llama, dice cómo quedan.
 *
 * Ver wiki/ROADMAP_PROFUNDIDAD.md, R3.
 */

import { getCell, setCell, normalizeTerrain, breakDoor } from '../board/terrain.js';
import { fireAt } from '../board/living-terrain.js';

/**
 * Los elementos, con los tipos de daño de 5e que caen en cada uno. El daño de las fichas
 * viene en inglés (`Fire`) o en castellano (`Fuego`): se reconocen los dos.
 */
export const ELEMENTS = {
    fuego: { label: 'Fuego', damageTypes: ['fire', 'fuego'] },
    frio: { label: 'Frío', damageTypes: ['cold', 'frio', 'hielo'] },
    trueno: { label: 'Trueno', damageTypes: ['thunder', 'trueno', 'lightning', 'rayo', 'electricidad'] },
    luz: { label: 'Luz', damageTypes: ['radiant', 'radiante', 'luz'] },
    veneno: { label: 'Veneno', damageTypes: ['poison', 'veneno'] },
    naturaleza: { label: 'Naturaleza', damageTypes: ['naturaleza'] },
};

/**
 * Qué le hace cada elemento a cada terreno. `to` es el terreno que queda; `fire`, si deja
 * una casilla ardiendo; `door`, si revienta la puerta.
 *
 * @type {Record<string, Record<string, {to?: string, fire?: boolean, door?: boolean, outdoors?: boolean, line: string}>>}
 */
export const TERRAIN_REACTIONS = {
    fuego: {
        cover_half: { to: 'floor', fire: true, line: 'arden las cajas' },
        door: { fire: true, door: true, line: 'arde la puerta' },
        brush: { to: 'floor', fire: true, line: 'arde la maleza' },
        // La maleza dibujada como terreno difícil solo arde a cielo abierto.
        difficult: { to: 'floor', fire: true, outdoors: true, line: 'arde la maleza' },
        ice: { to: 'water', line: 'el hielo se funde' },
        // R6: revienta, y quien esté al lado lo nota (lo aplica quien llama).
        barrel: { to: 'floor', fire: true, line: 'revienta un barril' },
    },
    frio: {
        water: { to: 'ice', line: 'el agua se hiela' },
    },
    trueno: {
        door: { door: true, line: 'la puerta revienta' },
    },
    naturaleza: {
        floor: { to: 'brush', line: 'brota la maleza' },
    },
    luz: {
        dark: { to: 'floor', line: 'la luz despeja la oscuridad' },
    },
    veneno: {},
};

/**
 * @param {any} value
 * @returns {string}
 */
function plain(value) {
    return String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * El elemento de una habilidad: el que diga, y si no dice, el de su tipo de daño.
 *
 * @param {any} ability
 * @returns {string} Una clave de `ELEMENTS`, o vacío.
 */
export function elementOf(ability) {
    const said = plain(ability?.element);
    if (Object.hasOwn(ELEMENTS, said)) return said;
    const type = plain(ability?.damageType);
    if (!type) return '';
    for (const [id, element] of Object.entries(ELEMENTS)) {
        if (element.damageTypes.includes(type)) return id;
    }
    return '';
}

/** El icono de cada elemento, para las líneas del registro. */
export const ELEMENT_ICONS = {
    fuego: '🔥',
    frio: '❄️',
    trueno: '⚡',
    naturaleza: '🌿',
    luz: '☀️',
    veneno: '☠️',
};

/**
 * Cómo queda el tablero después de que un elemento toque unas casillas.
 *
 * @param {Object} input
 * @param {string} input.element
 * @param {Array<{x: number, y: number}>} input.cells
 * @param {any} input.terrain
 * @param {any[]} [input.hazards]
 * @param {number} [input.round]
 * @param {boolean} [input.outdoors]
 * @param {boolean} [input.wet] Si llueve: el fuego no prende.
 * @returns {{terrain: any, hazards: any[], lines: string[], changed: Array<{x: number, y: number, from: string, to: string}>}}
 */
export function reactTerrain({ element, cells, terrain, hazards = [], round = 1, outdoors = false, wet = false }) {
    let map = normalizeTerrain(terrain);
    let fires = Array.isArray(hazards) ? [...hazards] : [];
    /** @type {string[]} */
    const said = [];
    /** @type {Array<{x: number, y: number, from: string, to: string}>} */
    const changed = [];
    const table = TERRAIN_REACTIONS[element] ?? {};
    const burning = (/** @type {number} */ x, /** @type {number} */ y) => fires.some(h => String(h?.kind) === 'fuego' && h.armed !== false && Number(h.x) === x && Number(h.y) === y);

    for (const { x, y } of cells) {
        // El frío apaga lo que arde, esté en el terreno que esté.
        if (element === 'frio' && burning(x, y)) {
            fires = fires.map(h => (String(h?.kind) === 'fuego' && Number(h.x) === x && Number(h.y) === y ? { ...h, armed: false } : h));
            said.push('se apaga el fuego');
            changed.push({ x, y, from: 'fuego', to: '' });
        }
        const cell = getCell(map, x, y);
        const reaction = table[cell.type];
        if (!reaction) continue;
        if (reaction.outdoors && !outdoors) continue;
        // Una puerta ya rota no vuelve a reventar ni a arder.
        if (reaction.door && cell.broken) continue;
        if (reaction.fire && wet) continue;

        if (reaction.door) map = breakDoor(map, x, y);
        if (reaction.to) map = setCell(map, x, y, reaction.to);
        if (reaction.fire && !burning(x, y)) fires.push(fireAt({ x, y, round, what: reaction.line.replace(/^arden? /, '') }));
        said.push(reaction.line);
        changed.push({ x, y, from: cell.type, to: reaction.to ?? cell.type });
    }

    // Una línea por cosa distinta, con cuántas casillas: «Arden las cajas (2), el agua se hiela (3)».
    const counts = new Map();
    for (const line of said) counts.set(line, (counts.get(line) ?? 0) + 1);
    const lines = counts.size === 0 ? [] : [`${ELEMENT_ICONS[element] ?? '✨'} ${[...counts].map(([line, n]) => (n > 1 ? `${line} (${n})` : line)).join(', ').replace(/^./, c => c.toUpperCase())}.`];
    if (element === 'fuego' && wet && cells.some(c => table[getCell(normalizeTerrain(terrain), c.x, c.y).type]?.fire)) {
        lines.push('💧 Con esta agua, el fuego no prende.');
    }
    return { terrain: map, hazards: fires, lines, changed };
}

/**
 * Lo que pasa además a quien recibe un elemento, según dónde está y cómo está.
 *
 * @param {Object} input
 * @param {string} input.element
 * @param {string} [input.standingOn] El tipo de terreno de su casilla.
 * @param {string[]} [input.conditions] Lo que ya tiene encima.
 * @returns {{add: string, rounds: number, remove: string, line: string}|null}
 */
export function comboFor({ element, standingOn = 'floor', conditions = [] }) {
    const has = (/** @type {string} */ c) => conditions.map(String).includes(c);
    if (element === 'frio' && (standingOn === 'water' || standingOn === 'ice' || has('Mojado'))) {
        return { add: 'Restrained', rounds: 1, remove: 'Mojado', line: 'se queda helado' };
    }
    if (element === 'trueno' && standingOn === 'ice') {
        return { add: 'Prone', rounds: 1, remove: '', line: 'el hielo se quiebra bajo sus pies y cae' };
    }
    if (element === 'fuego' && has('Restrained')) {
        return { add: '', rounds: 0, remove: 'Restrained', line: 'lo que le sujetaba arde y le suelta' };
    }
    if (element === 'fuego' && has('Mojado')) {
        return { add: '', rounds: 0, remove: 'Mojado', line: 'se seca de golpe entre vapor' };
    }
    return null;
}

/**
 * La etiqueta en pocas palabras, para la ficha y el botón: «fuego».
 *
 * @param {any} ability
 * @returns {string}
 */
export function describeElement(ability) {
    const id = elementOf(ability);
    return id ? /** @type {any} */ (ELEMENTS)[id].label.toLowerCase() : '';
}
