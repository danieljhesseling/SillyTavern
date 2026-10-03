/**
 * E2.3 de wiki/ROADMAP_ENTRETENIDO.md: acampar en territorio hostil.
 *
 * Dormir en una cripta era igual que dormir en la posada. Ahora un descanso largo dentro de una
 * mazmorra (en un tablero oscuro, o en un sitio que es mazmorra, ruinas o cueva) se paga y se
 * arriesga, con las reglas de 5e:
 *
 * - **Raciones.** Una por cabeza. Sin raciones para todos no se descansa largo ahí dentro (5e:
 *   comer es parte del día; aquí, la condición para quedarse a dormir en la mazmorra).
 * - **Emboscada de noche** (encuentros aleatorios del máster). La probabilidad es la de la noche
 *   del campamento (`camp.js`, la de una mazmorra), con su escala para las pruebas.
 * - **La guardia decide la sorpresa** (2024): los que llegan tiran Sigilo; si la Percepción pasiva
 *   de alguno de los que vigilan (J7.4: el vigía primero) llega a la del más torpe de ellos, los
 *   ven venir. Si no, el grupo está **sorprendido**: tira la iniciativa con desventaja (2024). A
 *   oscuras, quien vigila sin visión en la oscuridad solo oye: −5.
 * - **Quien duerme lo hace sin armadura pesada** (5e: ponérsela son 10 minutos). Si hay pelea, la
 *   pelea así: 10 + Destreza.
 * - **El descanso se reanuda** (2024): acabada la pelea, se vuelve a dormir y el descanso largo se
 *   termina (una hora más).
 *
 * Puro: decide con el azar y los dados de quien llama.
 */

import { nightRisk } from './camp.js';
import { equippedIn, armourClassOf } from '../rules/equipment.js';

/** Los tipos de sitio que son territorio hostil por sí mismos. */
export const HOSTILE_PLACES = ['dungeon', 'ruins', 'cave', 'cueva', 'mazmorra', 'cripta', 'mina'];

/** Lo que da la guardia a oscuras sin visión en la oscuridad: solo oye (−5, la desventaja en pasiva). */
export const DARK_WATCH_PENALTY = 5;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {number} */
const num = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

/** @param {any} member @returns {boolean} */
const able = (member) => Boolean(member) && !member.dead && num(member.hp ?? 1) > 0;

/**
 * Si aquí dormir es dormir en territorio hostil.
 *
 * @param {{darkBoard?: boolean, locationType?: string}} input `darkBoard`: se está en un tablero
 *   oscuro (una cripta, una cueva).
 * @returns {boolean}
 */
export function isHostileGround({ darkBoard = false, locationType = '' } = {}) {
    return Boolean(darkBoard) || HOSTILE_PLACES.includes(text(locationType).toLowerCase());
}

/**
 * Si un objeto son raciones.
 *
 * @param {any} item
 * @returns {boolean}
 */
export function isRation(item) {
    return /raci[oó]n|raciones/i.test(text(item?.name));
}

/**
 * Las raciones de alguien (un montón cuenta por su `quantity`).
 *
 * @param {any} member
 * @returns {number}
 */
export function rationsOf(member) {
    return (Array.isArray(member?.items) ? member.items : [])
        .filter(isRation)
        .reduce((/** @type {number} */ sum, /** @type {any} */ item) => sum + Math.max(1, Math.floor(num(item.quantity) || 1)), 0);
}

/**
 * Las raciones de todo el grupo.
 *
 * @param {any[]} members
 * @returns {number}
 */
export function partyRations(members) {
    return (Array.isArray(members) ? members : []).filter(m => m && !m.dead).reduce((sum, m) => sum + rationsOf(m), 0);
}

/**
 * Gastar raciones: una por cabeza, de quien las lleve (primero de la mochila de cada uno).
 *
 * @param {any[]} members Los que comen.
 * @param {any[]} carriers Todos los que pueden llevar raciones.
 * @returns {{ok: boolean, eaten: number, items: Map<any, any[]>}} `items`: la mochila nueva de cada
 *   uno que ha puesto raciones. Sin bastantes, nada se gasta (`ok` falso).
 */
export function eatRations(members, carriers) {
    const need = (Array.isArray(members) ? members : []).filter(able).length;
    const people = (Array.isArray(carriers) ? carriers : []).filter(m => m && !m.dead);
    /** @type {Map<any, any[]>} */
    const items = new Map();
    if (need === 0) return { ok: true, eaten: 0, items };
    if (partyRations(people) < need) return { ok: false, eaten: 0, items };
    let left = need;
    for (const member of people) {
        if (left <= 0) break;
        const bag = Array.isArray(member.items) ? [...member.items] : [];
        for (let at = 0; at < bag.length && left > 0;) {
            if (!isRation(bag[at])) {
                at++;
                continue;
            }
            const count = Math.max(1, Math.floor(num(bag[at].quantity) || 1));
            const take = Math.min(count, left);
            left -= take;
            if (count > take) {
                bag[at] = { ...bag[at], quantity: count - take };
                at++;
            } else {
                bag.splice(at, 1);
            }
        }
        if (bag.length !== (member.items ?? []).length || bag.some((item, i) => item !== member.items[i])) items.set(member, bag);
    }
    return { ok: true, eaten: need, items };
}

/**
 * La probabilidad de que algo os encuentre durmiendo aquí: la de una noche en una mazmorra.
 *
 * @param {{hostile?: boolean, light?: boolean}} [input] `hostile`: la tierra es de quien os tiene
 *   ganas; `light`: dormís con luz (se ve de lejos, como el fuego).
 * @returns {number}
 */
export function ambushChance({ hostile = false, light = false } = {}) {
    return nightRisk({ locationType: 'dungeon', fire: light, hostile });
}

/**
 * La Percepción pasiva de quien vigila: 10 + su Percepción; a oscuras sin visión en la
 * oscuridad, solo oye (−5).
 *
 * @param {{perception: number, dark?: boolean, darkvision?: number}} input
 * @returns {number}
 */
export function watchPassive({ perception, dark = false, darkvision = 0 }) {
    return 10 + Math.trunc(num(perception)) - (dark && num(darkvision) <= 0 ? DARK_WATCH_PENALTY : 0);
}

/**
 * Si los que llegan pillan al grupo por sorpresa (2024): cada uno tira Sigilo; si la mejor pasiva
 * de la guardia llega al Sigilo más bajo de ellos, los ven venir y despiertan a todos.
 *
 * @param {Object} input
 * @param {Array<{name: string, passive: number}>} input.guards
 * @param {number[]} input.stealth Los Sigilos de los que llegan, ya tirados.
 * @returns {{surprised: boolean, best: {name: string, passive: number}|null, worst: number}}
 */
export function surpriseCheck({ guards, stealth }) {
    const list = (Array.isArray(guards) ? guards : []).filter(g => g && text(g.name));
    const best = list.reduce((/** @type {{name: string, passive: number}|null} */ top, g) => (!top || num(g.passive) > num(top.passive) ? g : top), null);
    const rolls = (Array.isArray(stealth) ? stealth : []).map(num);
    const worst = rolls.length > 0 ? Math.min(...rolls) : 0;
    return { surprised: !best || num(best.passive) < worst, best, worst };
}

/**
 * Si alguien duerme en armadura pesada (que se quita para dormir).
 *
 * @param {any} member
 * @returns {boolean}
 */
export function wearsHeavyArmour(member) {
    const body = equippedIn(member, 'body');
    if (!body) return false;
    return text(body.dexMode) === 'none' || /heavy/i.test(text(body.subcategory)) || /pesad/i.test(text(body.weightClass ?? body.category));
}

/**
 * Lo que pierde de clase de armadura quien pelea sin la armadura pesada que se quitó para dormir:
 * de lo que da puesta a 10 + Destreza.
 *
 * @param {any} member
 * @param {number} dexModifier
 * @returns {number}
 */
export function armourOffPenalty(member, dexModifier) {
    if (!wearsHeavyArmour(member)) return 0;
    const worn = armourClassOf({ member, dexModifier }).armorClass;
    return Math.max(0, worn - (10 + Math.trunc(num(dexModifier))));
}

/**
 * Quiénes llegan: los del sitio, del tipo más flojo que haya, tantos como el grupo menos uno (de
 * uno a tres).
 *
 * @param {Object} input
 * @param {Array<{name: string, cr?: number}>} input.candidates
 * @param {number} input.partySize
 * @param {() => number} input.random
 * @returns {string[]}
 */
export function pickAmbushers({ candidates, partySize, random }) {
    const list = (Array.isArray(candidates) ? candidates : []).filter(c => text(c?.name));
    if (list.length === 0) return [];
    const lowest = Math.min(...list.map(c => num(c.cr)));
    const pool = list.filter(c => num(c.cr) === lowest);
    const pick = pool[Math.floor(Math.max(0, Math.min(0.9999, Number(random()) || 0)) * pool.length)];
    const count = Math.max(1, Math.min(3, Math.floor(num(partySize)) - 1));
    return Array.from({ length: count }, () => text(pick.name));
}

/**
 * Dónde aparecen: casillas libres a 3–5 de alguien del grupo (llegan de la oscuridad, no encima),
 * repartidas.
 *
 * @param {Object} input
 * @param {Array<{x: number, y: number}>} input.party
 * @param {(x: number, y: number) => boolean} input.free Si se puede estar en esa casilla.
 * @param {number} input.width
 * @param {number} input.height
 * @param {number} input.count
 * @param {() => number} input.random
 * @returns {Array<{x: number, y: number}>}
 */
export function ambushCells({ party, free, width, height, count, random }) {
    const at = (Array.isArray(party) ? party : []).map(p => ({ x: Math.trunc(num(p.x)), y: Math.trunc(num(p.y)) }));
    const taken = new Set(at.map(p => `${p.x},${p.y}`));
    const near = (/** @type {number} */ x, /** @type {number} */ y) => at.reduce((min, p) => Math.min(min, Math.max(Math.abs(p.x - x), Math.abs(p.y - y))), Infinity);
    /** @type {Array<{x: number, y: number}>} */
    const ring = [];
    for (let y = 0; y < Math.max(0, num(height)); y++) {
        for (let x = 0; x < Math.max(0, num(width)); x++) {
            const d = near(x, y);
            if (d >= 3 && d <= 5 && !taken.has(`${x},${y}`) && free(x, y)) ring.push({ x, y });
        }
    }
    /** @type {Array<{x: number, y: number}>} */
    const out = [];
    while (out.length < count && ring.length > 0) {
        const at2 = Math.floor(Math.max(0, Math.min(0.9999, Number(random()) || 0)) * ring.length);
        const [cell] = ring.splice(at2, 1);
        // Repartidos: no dos pegados si hay sitio.
        if (out.some(o => Math.max(Math.abs(o.x - cell.x), Math.abs(o.y - cell.y)) < 2) && ring.length > count) continue;
        out.push(cell);
    }
    return out;
}

/**
 * Lo que dice quien vigila (o quien se despierta) cuando llegan: con sus palabras (D-J60).
 *
 * @param {{surprised: boolean, foes: string}} input `foes`: quiénes, contados («dos esqueletos»).
 * @returns {string}
 */
export function alarmLine({ surprised, foes }) {
    const who = text(foes) || 'algo';
    return surprised
        ? `¡Arriba, arriba! ¡Ya los tenemos encima: ${who}! No los he oído llegar.`
        : `¡Despertad! Se acercan ${who} por la oscuridad. ¡Las armas!`;
}
