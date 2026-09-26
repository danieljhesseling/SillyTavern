/**
 * Cosas que tocar en el tablero: la palanca y la barricada (T1 y B3 de wiki/LO_QUE_FALTA.md).
 *
 * R6 trajo los barriles y los cofres. Esto es lo mismo con otro verbo:
 *
 * - **La palanca** (`P`): estando al lado, se tira de ella y **se abren las puertas con
 *   llave del tablero** — la reja del fondo. Es la cuarta forma de pasar una puerta cerrada
 *   (con la llave, con maña, a golpes y ahora con la palanca), y la que obliga a ir a otro
 *   sitio primero.
 * - **La barricada** (`=`): corta el paso pero no la vista, y cubre a quien está detrás
 *   (su cobertura cuenta en la línea de tiro, como las cajas). Tiene vida: a golpes se
 *   rompe y deja escombros (terreno difícil). El guion de 1387 pedía lo mismo con las
 *   puertas de la granja y las columnas de la tienda.
 *
 * Puro: recibe el terreno y devuelve el nuevo, con la línea que se dice.
 */

import { getCell, setCell, lockedDoors, unlockDoor, setDoorOpen, BARRICADE_HP } from './terrain.js';

/** La vida de una barricada entera (vive en `terrain.js`, que la dice al describir la casilla). */
export { BARRICADE_HP };

/**
 * Qué se puede hacer con una casilla, si algo.
 *
 * @param {any} terrain
 * @param {number} x
 * @param {number} y
 * @returns {'lever'|'barricade'|''}
 */
export function interactionAt(terrain, x, y) {
    const type = getCell(terrain, Math.trunc(Number(x) || 0), Math.trunc(Number(y) || 0))?.type;
    return type === 'lever' ? 'lever' : type === 'barricade' ? 'barricade' : '';
}

/**
 * Si dos casillas se tocan (también en diagonal).
 *
 * @param {{x: number, y: number}} a
 * @param {{x: number, y: number}} b
 * @returns {boolean}
 */
export function nextTo(a, b) {
    return Math.max(Math.abs(Number(a?.x) - Number(b?.x)), Math.abs(Number(a?.y) - Number(b?.y))) === 1;
}

/**
 * La vida que le queda a una barricada.
 *
 * @param {any} terrain
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export function barricadeHp(terrain, x, y) {
    const cell = /** @type {any} */ (getCell(terrain, x, y));
    if (cell?.type !== 'barricade') return 0;
    const hp = Number(cell.hp);
    return Number.isFinite(hp) && hp > 0 ? Math.trunc(hp) : BARRICADE_HP;
}

/**
 * Golpear una barricada. Rota, deja escombros.
 *
 * @param {any} terrain
 * @param {number} x
 * @param {number} y
 * @param {number} damage
 * @returns {{terrain: any, hp: number, broken: boolean, line: string}}
 */
export function hitBarricade(terrain, x, y, damage) {
    const before = barricadeHp(terrain, x, y);
    if (before <= 0) return { terrain, hp: 0, broken: false, line: '' };
    const hp = Math.max(0, before - Math.max(0, Math.trunc(Number(damage) || 0)));
    if (hp === 0) {
        return { terrain: setCell(terrain, x, y, 'difficult'), hp: 0, broken: true, line: 'La barricada cede: quedan los escombros.' };
    }
    return { terrain: setCell(terrain, x, y, 'barricade', { hp }), hp, broken: false, line: `La barricada aguanta (le quedan ${hp} de ${BARRICADE_HP}).` };
}

/**
 * Tirar de la palanca: se abren las puertas con llave del tablero.
 *
 * @param {any} terrain
 * @returns {{terrain: any, opened: Array<{x: number, y: number}>, line: string}}
 */
export function pullLever(terrain) {
    const doors = lockedDoors(terrain);
    let next = terrain;
    for (const door of doors) {
        next = setDoorOpen(unlockDoor(next, door.x, door.y), door.x, door.y, true);
    }
    return {
        terrain: next,
        opened: doors.map(d => ({ x: d.x, y: d.y })),
        line: doors.length === 0
            ? 'La palanca cruje, pero no abre nada que siga cerrado.'
            : doors.length === 1 ? 'Chirría una reja: la puerta cerrada con llave se abre.' : `Chirrían ${doors.length} rejas: las puertas cerradas con llave se abren.`,
    };
}
