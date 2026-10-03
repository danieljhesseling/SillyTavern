/**
 * Empujar donde duele y pisar donde resbala (E1.2 y E1.3 de wiki/ROADMAP_ENTRETENIDO.md).
 *
 * - **Caer** (5e): 1d6 de daño contundente por cada 10 pies, hasta 20d6, y se queda derribado.
 *   Un desnivel es una casilla alta (`high`) que da a una que no lo es (10 pies), o dos
 *   casillas con cotas (`elevation`) que se llevan 10 pies o más.
 * - **El agua honda**: quien cae dentro no se ahoga en un turno, pero sale como puede por donde
 *   cayó: derribado y andando menos (como ya le pasaba al grupo, `enemy-turn.js`).
 * - **El vacío** (`chasm`): no tiene fondo a la vista. Quien cae, se acaba la pelea para él.
 * - **El hielo resbaladizo** (Guía del máster de 5e): es terreno difícil, y quien lo pisa por
 *   primera vez en su turno hace una prueba de Destreza (Acrobacias) CD 10 o cae derribado.
 *
 * Puro: con el tablero preguntado por casilla y los dados de quien llama.
 */

import { getCell, isPassable } from './terrain.js';
import { elevationAt } from './heights.js';

/** La caída más corta que hace daño (5e). */
export const FALL_STEP_FEET = 10;

/** La CD del hielo resbaladizo (Guía del máster de 5e). */
export const ICE_DC = 10;

/**
 * Los dados de una caída: 1d6 por cada 10 pies, de 1 a 20.
 *
 * @param {number} feet
 * @returns {string} `2d6`, o vacío si no llega a 10 pies.
 */
export function fallDice(feet) {
    const steps = Math.floor((Number(feet) || 0) / FALL_STEP_FEET);
    if (steps < 1) return '';
    return `${Math.min(20, steps)}d6`;
}

/**
 * Lo que hay que preguntarle al tablero para apartar a alguien (`pushTrail` de `ai-2024.js`):
 * lo que se pisa, los desniveles, el agua honda, el vacío y lo que quema.
 *
 * @param {Object} input
 * @param {any} input.terrain
 * @param {number} input.width
 * @param {number} input.height
 * @param {Set<string>|string[]} [input.taken] Casillas con alguien encima («x,y»).
 * @param {Record<string, number>|null} [input.elevation] Las cotas del tablero.
 * @param {(x: number, y: number) => boolean} [input.isHazard]
 * @returns {import('../combat/ai-2024.js').Ground}
 */
export function pushGround({ terrain, width, height, taken = [], elevation = null, isHazard = () => false }) {
    const busy = taken instanceof Set ? taken : new Set(taken);
    const high = (/** @type {number} */ x, /** @type {number} */ y) => getCell(terrain, x, y)?.type === 'high';
    return {
        isFree: (x, y) => isPassable(terrain, x, y, width, height) && !busy.has(`${x},${y}`),
        isChasm: (x, y) => getCell(terrain, x, y)?.type === 'chasm',
        isDeepWater: (x, y) => getCell(terrain, x, y)?.type === 'deep_water',
        isHazard,
        drop: (a, b) => {
            if (elevation && Object.keys(elevation).length > 0) {
                const feet = elevationAt(elevation, a.x, a.y) - elevationAt(elevation, b.x, b.y);
                if (Math.abs(feet) >= FALL_STEP_FEET) return feet;
            }
            return high(a.x, a.y) && !high(b.x, b.y) ? FALL_STEP_FEET : 0;
        },
    };
}

/**
 * Lo que le pasa a quien acaba de ir a parar a otra casilla, dicho y con lo que hay que aplicar.
 *
 * @param {Object} input
 * @param {string} input.name
 * @param {{to: {x: number, y: number}, moved: number, why: string, dropFeet: number}} input.trail `pushTrail`.
 * @param {(formula: string) => number} input.roll
 * @returns {{lines: string[], damage: number, prone: boolean, slowed: boolean, out: boolean}}
 */
export function landing({ name, trail, roll }) {
    const at = `(${trail.to.x + 1}, ${trail.to.y + 1})`;
    if (trail.why === 'chasm') {
        return { lines: [`🕳️ ${name} pierde pie y cae al vacío.`], damage: 0, prone: false, slowed: false, out: true };
    }
    const pushed = `💨 ${name} sale despedido ${trail.moved * 5} pies, hasta ${at}.`;
    if (trail.why === 'water') {
        return {
            lines: [...(trail.moved > 0 ? [pushed] : []),
                `💦 ${name} cae al agua honda y sale como puede por donde cayó: chorreando, en el suelo y andando 10 pies menos.`],
            damage: 0, prone: true, slowed: true, out: false,
        };
    }
    /** @type {string[]} */
    const lines = trail.moved > 0 ? [pushed] : [`🧱 ${name} no tiene a dónde ir: se queda donde está.`];
    if (trail.why === 'ledge') {
        const dice = fallDice(trail.dropFeet);
        const damage = dice ? Math.max(0, Math.floor(Number(roll(dice)) || 0)) : 0;
        lines.push(`🪨 Cae ${trail.dropFeet} pies desnivel abajo: ${damage} de daño (${dice}), y queda en el suelo.`);
        return { lines, damage, prone: true, slowed: false, out: false };
    }
    return { lines, damage: 0, prone: false, slowed: false, out: false };
}

/**
 * La primera casilla de hielo de un camino que aún no ha pisado en este turno, o -1.
 *
 * @param {any} terrain
 * @param {Array<{x: number, y: number}>} path Con la casilla de salida delante.
 * @returns {number} Su índice en `path`.
 */
export function firstIce(terrain, path) {
    const steps = Array.isArray(path) ? path : [];
    for (let i = 1; i < steps.length; i++) {
        if (getCell(terrain, steps[i].x, steps[i].y)?.type === 'ice') return i;
    }
    return -1;
}
