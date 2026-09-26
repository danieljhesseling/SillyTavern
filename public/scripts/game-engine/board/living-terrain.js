/**
 * El tablero cambia mientras se pelea: el fuego se extiende y las puertas se rompen (idea
 * 23, que amplía el fuego de la fase T5).
 *
 * El aceite ya dejaba una casilla ardiendo, pero se quedaba en su casilla. Ahora, al
 * empezar cada ronda:
 *
 * - **El fuego se extiende** a lo que arde de al lado: cajas y barriles (la media
 *   cobertura), puertas de madera y, a cielo abierto, la maleza. Lo que arde deja de
 *   cubrir: las cajas se quedan en ceniza y la puerta, rota y abierta para siempre.
 * - **Se apaga**: cada fuego dura tres rondas. Y con lluvia no se extiende: se apaga.
 * - Como mucho tres casillas nuevas por ronda: un tablero que se quema entero en dos turnos
 *   no es un tablero vivo, es un tablero perdido.
 *
 * Puro: con el azar de quien llama, dice qué arde, qué se apaga y cómo queda el terreno.
 */

import { getCell, setCell, normalizeTerrain, breakDoor } from './terrain.js';

/**
 * Cómo se porta el fuego: cuántas rondas dura, la probabilidad de que prenda cada casilla de
 * al lado que arde, y lo más que se extiende en una ronda. A la vista y cambiable, como las
 * demás tablas de azar: el recorrido del navegador sube `spread` a 1 para verlo prender.
 */
export const FIRE = { rounds: 3, spread: 0.5, maxNew: 3 };

/** Lo que arde, y cómo se dice. */
const BURNS = /** @type {Record<string, string>} */ ({
    cover_half: 'Arden las cajas',
    door: 'Arde la puerta',
    difficult: 'Arde la maleza',
    brush: 'Arde la maleza',
    barrel: 'Revienta un barril',
});

/** @param {any} hazard @returns {boolean} */
function isFire(hazard) {
    return Boolean(hazard) && String(hazard.kind ?? '') === 'fuego' && hazard.armed !== false
        && Number.isFinite(Number(hazard.x)) && Number(hazard.x) >= 0 && Number(hazard.y) >= 0;
}

/**
 * Si una casilla arde.
 *
 * @param {{type: string, broken?: boolean}} cell
 * @param {boolean} outdoors
 * @returns {boolean}
 */
export function flammable(cell, outdoors) {
    // R3: la maleza de verdad arde siempre; la dibujada como terreno difícil, a cielo abierto.
    if (cell.type === 'cover_half' || cell.type === 'brush' || cell.type === 'barrel') return true;
    if (cell.type === 'door') return !cell.broken;
    return cell.type === 'difficult' && outdoors;
}

/**
 * Un fuego en una casilla, con la forma de `hazards.js`: quema al que entra, cada vez.
 *
 * @param {{x: number, y: number, round: number, what?: string}} at
 * @returns {any}
 */
export function fireAt({ x, y, round, what = '' }) {
    const now = Math.max(1, Math.floor(Number(round) || 1));
    return {
        id: `fuego-${x}-${y}-${now}`,
        name: what || 'Fuego',
        kind: 'fuego',
        trigger: 'enter',
        x,
        y,
        tell: 'Aquí arde algo.',
        effect: 'damage',
        damageDice: '1d6',
        cause: 'fuego',
        seen: true,
        armed: true,
        once: false,
        until: now + FIRE.rounds,
    };
}

/**
 * Lo que pasa con el fuego al empezar una ronda.
 *
 * @param {Object} input
 * @param {any[]} input.hazards Lo que el tablero tiene puesto, tal cual se guarda.
 * @param {any} input.terrain
 * @param {number} input.round
 * @param {() => number} input.random
 * @param {boolean} [input.wet] Si llueve: no se extiende, se apaga.
 * @param {boolean} [input.outdoors] A cielo abierto también arde la maleza.
 * @param {number} [input.width]
 * @param {number} [input.height]
 * @returns {{hazards: any[], terrain: any, lines: string[], burnt: Array<{x: number, y: number, what: string}>}}
 */
export function spreadFire({ hazards, terrain, round, random, wet = false, outdoors = false, width = 50, height = 50 }) {
    const now = Math.max(1, Math.floor(Number(round) || 1));
    const raw = Array.isArray(hazards) ? hazards : [];
    /** @type {string[]} */
    const lines = [];
    const burning = raw.filter(isFire);
    if (burning.length === 0) return { hazards: raw, terrain, lines, burnt: [] };

    if (wet) {
        lines.push('💧 Con esta agua, el fuego se apaga.');
        return { hazards: raw.map(h => (isFire(h) ? { ...h, armed: false } : h)), terrain, lines, burnt: [] };
    }

    // Lo que no dice hasta cuándo arde, arde desde ahora sus tres rondas.
    let out = 0;
    const next = raw.map(h => {
        if (!isFire(h)) return h;
        const until = Number(h.until) > 0 ? Number(h.until) : now + FIRE.rounds;
        if (now >= until) {
            out += 1;
            return { ...h, armed: false, until };
        }
        return { ...h, until };
    });
    if (out > 0) lines.push(`El fuego se apaga en ${out} casilla(s).`);

    let map = normalizeTerrain(terrain);
    const lit = new Set(next.filter(isFire).map(h => `${h.x},${h.y}`));
    /** @type {Array<{x: number, y: number, what: string}>} */
    const burnt = [];
    for (const fire of next.filter(isFire)) {
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if ((dx === 0 && dy === 0) || burnt.length >= FIRE.maxNew) continue;
                const x = Number(fire.x) + dx;
                const y = Number(fire.y) + dy;
                if (x < 0 || y < 0 || x >= width || y >= height || lit.has(`${x},${y}`)) continue;
                const cell = getCell(map, x, y);
                if (!flammable(cell, outdoors) || !(random() < FIRE.spread)) continue;
                const what = BURNS[cell.type] ?? 'Fuego';
                lit.add(`${x},${y}`);
                burnt.push({ x, y, what });
                next.push(fireAt({ x, y, round: now, what }));
                map = cell.type === 'door' ? breakDoor(map, x, y) : setCell(map, x, y, 'floor');
            }
        }
    }
    if (burnt.length > 0) {
        lines.push(`🔥 El fuego se extiende: ${burnt.map(b => `${b.what.toLowerCase()} en (${b.x + 1}, ${b.y + 1})`).join(', ')}.`);
    }
    return { hazards: next, terrain: map, lines, burnt };
}
