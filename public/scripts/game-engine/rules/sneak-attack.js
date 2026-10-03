/**
 * El ataque furtivo del pícaro, como en D&D 2024 (E3.1 de wiki/ROADMAP_ENTRETENIDO.md).
 *
 * Una vez por turno, el pícaro suma 1d6 por cada dos niveles (redondeando hacia arriba) al daño
 * de un golpe que entra, si ataca con un arma sutil o a distancia y:
 *
 * - tiene **ventaja** en esa tirada (el enemigo está en el suelo, le han abierto la guardia, le
 *   tiene molestado…), o
 * - un **aliado** suyo está pegado al objetivo (a 5 pies), ese aliado puede actuar (no está
 *   incapacitado) y el pícaro **no** ataca con desventaja.
 *
 * Así las reglas encadenan solas: el guerrero derriba, el pícaro llega y mete su furtivo. Y se
 * dice por qué: «Furtivo: +2d6 (7), está en el suelo».
 *
 * Puro: decide y dice. Los dados y el estado del combate los pone quien llama.
 */

import { classKey } from './checks.js';
import { isRangedWeapon } from './weapon-mastery.js';

/** Las armas sutiles de 2024 (y sus nombres en castellano), para las que no lo dicen en sus etiquetas. */
const FINESSE_NAMES = /\b(daga|dagger|estoque|rapier|cimitarra|scimitar|espada corta|shortsword|l[aá]tigo|whip|dardo|dart)\b/i;

/** Los estados que dejan a un aliado sin poder distraer a nadie (5e: incapacitado). */
const OUT_OF_IT = ['unconscious', 'stunned', 'paralyzed', 'incapacitated', 'petrified'];

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Si alguien es pícaro, por su clase escrita («Pícara», «Rogue», «Ladrón»).
 *
 * @param {any} member
 * @returns {boolean}
 */
export function isRogue(member) {
    return classKey(member?.class ?? member?.className) === 'rogue';
}

/**
 * Cuántos d6 mete el furtivo a un nivel: 1 al 1, 2 al 3, 3 al 5… hasta 10 al 19.
 *
 * @param {number} level
 * @returns {number}
 */
export function sneakDiceCount(level) {
    const lv = Math.max(1, Math.min(20, Math.floor(Number(level) || 1)));
    return Math.ceil(lv / 2);
}

/**
 * Si un arma vale para el furtivo: sutil o a distancia. Los puños no.
 *
 * @param {any} weapon
 * @returns {boolean}
 */
export function isSneakWeapon(weapon) {
    if (!weapon) return false;
    if (weapon.finesse === true) return true;
    if (isRangedWeapon(weapon)) return true;
    const tags = Array.isArray(weapon.tags) ? weapon.tags.join(' ') : '';
    const props = Array.isArray(weapon.properties) ? weapon.properties.join(' ') : text(weapon.properties);
    if (/finesse|sutil/i.test(`${tags} ${props}`)) return true;
    return FINESSE_NAMES.test(text(weapon.name));
}

/**
 * Si un aliado cuenta para el furtivo: en pie y sin estar incapacitado.
 *
 * @param {{hp?: number, conditions?: string[]}} ally
 * @returns {boolean}
 */
export function allyCounts(ally) {
    if (!ally || (Number(ally.hp) || 0) <= 0) return false;
    const said = (Array.isArray(ally.conditions) ? ally.conditions : []).map(c => text(c).toLowerCase());
    return !OUT_OF_IT.some(c => said.includes(c));
}

/**
 * @typedef {Object} SneakPlan
 * @property {boolean} ok Si este golpe lleva furtivo.
 * @property {number} count Cuántos d6.
 * @property {string} dice «2d6».
 * @property {string} why Por qué, en palabras («está en el suelo», «Gerd está a su lado»).
 * @property {string} reason Si no, por qué no (para quien lo mira antes de atacar); vacío si sí.
 */

/**
 * Si un golpe del pícaro lleva su ataque furtivo, y por qué.
 *
 * @param {Object} input
 * @param {any} input.member Quien ataca (su clase y su nivel).
 * @param {any} input.weapon El arma con la que ataca, o null (puños).
 * @param {'advantage'|'disadvantage'|'normal'} input.mode Cómo va la tirada.
 * @param {string[]} [input.reasons] Por qué va así (`attackEdge`): la primera de ventaja se cuenta.
 * @param {Array<{name: string, hp?: number, conditions?: string[]}>} [input.alliesBeside] Los suyos
 *   pegados al objetivo (sin contarle a él).
 * @param {boolean} [input.used] Si ya lo ha metido en este turno.
 * @returns {SneakPlan}
 */
export function planSneakAttack({ member, weapon, mode, reasons = [], alliesBeside = [], used = false }) {
    const count = sneakDiceCount(member?.level);
    const dice = `${count}d6`;
    const no = (/** @type {string} */ reason) => ({ ok: false, count, dice, why: '', reason });
    if (!isRogue(member)) return no('');
    if (!isSneakWeapon(weapon)) return no('El furtivo pide un arma sutil o a distancia.');
    if (used) return no('Ya has metido el furtivo este turno.');
    if (mode === 'advantage') {
        // La primera razón de la ventaja: es la que se dice («está en el suelo»).
        const why = text((Array.isArray(reasons) ? reasons : [])[0]) || 'va con ventaja';
        return { ok: true, count, dice, why, reason: '' };
    }
    if (mode === 'disadvantage') return no('Con desventaja no hay furtivo.');
    const friend = (Array.isArray(alliesBeside) ? alliesBeside : []).find(allyCounts);
    if (friend) return { ok: true, count, dice, why: `${text(friend.name) || 'un aliado'} está a su lado`, reason: '' };
    return no('El furtivo pide ventaja o un aliado pegado a él.');
}

/**
 * La línea del furtivo en el resumen: «🗡️ Furtivo: +2d6 (7), está en el suelo.»
 *
 * @param {{dice: string, total: number, why: string, crit?: boolean}} input
 * @returns {string}
 */
export function sneakLine({ dice, total, why, crit = false }) {
    const shown = crit ? `${dice} x2` : dice;
    return `🗡️ Furtivo: +${shown} (${Math.max(0, Math.floor(Number(total) || 0))}), ${text(why)}.`;
}

/**
 * Lo que se enseña antes de atacar, en la fila del objetivo: «Furtivo +2d6».
 *
 * @param {SneakPlan} plan
 * @returns {string}
 */
export function sneakBadge(plan) {
    return plan?.ok ? `Furtivo +${plan.dice}` : '';
}

/**
 * La clave de «una vez por turno»: quien ataca, de quién es el turno y la ronda. En el turno de
 * otro (un ataque de seguimiento) el pícaro puede volver a meterlo, como en la mesa.
 *
 * @param {string} by
 * @param {string} turnOf
 * @param {number} round
 * @returns {string}
 */
export function sneakKey(by, turnOf, round) {
    return `${text(by)}@${text(turnOf)}@${Math.floor(Number(round) || 0)}`;
}
