/**
 * Andar por el tablero cuando no hay nadie peleando.
 *
 * En combate el movimiento estaba bien resuelto —cuesta pies, se le ve la ruta y se paga
 * el ataque de oportunidad— y **fuera de combate no existía**: arrastrabas la ficha y
 * aparecía donde la soltaras. Atravesando muros, cruzando puertas cerradas y de una punta
 * del mapa a la otra. Eso no es moverse, es teletransportarse.
 *
 * Aquí está la regla que faltaba, y son tres cosas:
 *
 * 1. **Tiene que haber camino.** Si hay un muro en medio, no se pasa. Es lo mismo que el
 *    combate ya exige, y no exigirlo fuera hacía que las paredes fueran decoración.
 * 2. **Hay un alcance.** No es un turno —fuera de combate nadie cuenta turnos— pero tampoco
 *    es el mapa entero: se anda un trecho, y para ir más lejos se anda otra vez. Sin esto,
 *    la distancia deja de significar nada y con ella el mapa.
 * 3. **Estar sujeto impide andar, no actuar.** Atado, agarrado o paralizado te quedas
 *    donde estás, y sigues pudiendo abrir lo que tengas al lado o hablar con quien tengas
 *    delante. Es exactamente lo que se espera de estar atado.
 *
 * Puro: decide y explica. No mueve a nadie.
 *
 * Ver wiki/ROADMAP_MAESTRO.md, Nivel 1.
 */

import { findPath, getPathCost } from './pathfinding.js';
import { cellKey } from './terrain.js';

/**
 * Lo que te deja clavado en el sitio.
 *
 * Son las condiciones de 5e que quitan el movimiento. `Prone` no está: quien está en el
 * suelo se arrastra, que es lento pero es moverse.
 */
export const IMMOBILISING = {
    Restrained: 'está sujeto',
    Grappled: 'lo tienen agarrado',
    Paralyzed: 'no puede mover un músculo',
    Petrified: 'es piedra ahora mismo',
    Stunned: 'está aturdido',
    Unconscious: 'está inconsciente',
};

/**
 * Cuántas veces su velocidad se anda de una vez fuera de combate.
 *
 * Cuatro es un trecho generoso —una sala entera de las grandes— y sigue impidiendo cruzar
 * el mapa de una pasada. El número está aquí, y no repartido, para poder discutirlo.
 */
export const STRIDE_MULTIPLIER = 4;

/** Lo que mide una casilla, como en el resto del motor. */
const FEET_PER_CELL = 5;

/**
 * @param {any} value
 * @param {number} fallback
 * @returns {number}
 */
function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Si este puede andar, y si no, por qué.
 *
 * @param {any} member
 * @returns {{allowed: boolean, reason: string}}
 */
export function canWalk(member) {
    const conditions = Array.isArray(member?.activeConditions) ? member.activeConditions : [];
    const name = String(member?.name ?? 'Ese');

    for (const [condition, why] of Object.entries(IMMOBILISING)) {
        if (conditions.includes(condition)) {
            return { allowed: false, reason: `${name} ${why}: puede actuar, pero no moverse.` };
        }
    }

    if ((number(member?.hp, 1)) <= 0) {
        return { allowed: false, reason: `${name} está en el suelo.` };
    }

    return { allowed: true, reason: '' };
}

/**
 * Lo que anda alguien de una vez.
 *
 * @param {any} member
 * @returns {number}
 */
export function strideOf(member) {
    return Math.max(5, number(member?.speed, 30)) * STRIDE_MULTIPLIER;
}

/**
 * Si se puede ir de aquí a allí, por dónde y cuánto cuesta.
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {{x: number, y: number}} input.to
 * @param {any} input.terrain
 * @param {number} input.gridWidth
 * @param {number} input.gridHeight
 * @param {Array<{x: number, y: number}>} [input.occupied] Casillas con alguien encima.
 * @returns {{allowed: boolean, reason: string, path: Array<{x: number, y: number}>, costFeet: number}}
 */
export function planWalk({ member, to, terrain, gridWidth, gridHeight, occupied = [] }) {
    const stuck = canWalk(member);
    if (!stuck.allowed) return { allowed: false, reason: stuck.reason, path: [], costFeet: 0 };

    const from = {
        x: number(member?.mapPosition?.gridX),
        y: number(member?.mapPosition?.gridY),
    };
    if (from.x === to.x && from.y === to.y) {
        return { allowed: true, reason: '', path: [], costFeet: 0 };
    }

    // Con la llave que usa el buscador de caminos, no con una parecida: `${x},${y}` se
    // lee igual y no coincide con nada, asi que las fichas dejarian de estorbar en
    // silencio — el peor tipo de fallo, porque parece que funciona.
    const blocked = new Set((Array.isArray(occupied) ? occupied : [])
        .filter(cell => cell && !(cell.x === to.x && cell.y === to.y))
        .map(cell => cellKey(Number(cell.x) || 0, Number(cell.y) || 0)));

    const path = findPath(terrain, from.x, from.y, to.x, to.y, gridWidth, gridHeight, { occupied: blocked });
    if (!path || path.length === 0) {
        return {
            allowed: false,
            reason: 'No hay camino hasta ahí: algo se interpone.',
            path: [],
            costFeet: 0,
        };
    }

    // `getPathCost` cuenta **casillas**, no pies, y la velocidad esta en pies: compararlos
    // sin traducir dejaba el limite en un numero veinte veces mayor del que parecia, y
    // por tanto sin efecto. Una casilla son cinco pies, como en el resto del motor.
    const costFeet = getPathCost(terrain, path) * FEET_PER_CELL;
    const stride = strideOf(member);
    if (costFeet > stride) {
        return {
            allowed: false,
            reason: `Está demasiado lejos para un tirón: ${costFeet} pies, y de una vez se andan ${stride}.`,
            path,
            costFeet,
        };
    }

    return { allowed: true, reason: '', path, costFeet };
}
