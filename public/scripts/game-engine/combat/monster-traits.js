/**
 * Lo que un bicho resiste, a lo que es inmune, lo que le duele el doble y si se regenera
 * (wiki/gemini/ROADMAP_CONTENIDO_DND.md, sección 5).
 *
 * Arma elemental (E3.3) ya miraba `resistances`, `immunities` y `vulnerabilities` del
 * enemigo, pero ningún bicho los traía: se perdían entre el bestiario, el Lorebook y la
 * ficha del combate. Aquí está la lista de esos campos, para que cada paso los copie igual
 * (`traitsOf`), y lo que hacen en la pelea:
 *
 * - **El daño con tipo** de una habilidad o un conjuro: la mitad si lo resiste, nada si es
 *   inmune, el doble si le duele (`feltDamage`). Vale también para el grupo: el dracónido
 *   rojo resiste el fuego por su raza.
 * - **La regeneración** del trol: al empezar su turno recupera sus puntos, salvo si desde
 *   su último turno le ha dado fuego o ácido (`regenerationTurn`, `stopsRegeneration`).
 *
 * Los tipos se guardan en inglés, como los dice el resto del motor («Fire», «Cold»).
 *
 * Puro: decide y dice; quien llama lo apunta en la ficha.
 */

import { affinityOf, typeList } from '../rules/elemental-weapon.js';

/** Los campos de un bicho que dicen cómo le sienta cada tipo de daño. */
export const AFFINITY_KEYS = /** @type {const} */ (['resistances', 'immunities', 'vulnerabilities']);

/** Lo que corta la regeneración de un trol, como en 5e. */
const STOPS_REGENERATION = ['Fire', 'Acid'];

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Lo que un bicho trae de esto, ya limpio y solo si lo trae: una fila del bestiario, una
 * ficha del Lorebook o un enemigo del combate. Se esparce tal cual (`...traitsOf(row)`).
 *
 * @param {any} source
 * @returns {{resistances?: string[], immunities?: string[], vulnerabilities?: string[], regeneration?: number}}
 */
export function traitsOf(source) {
    /** @type {{resistances?: string[], immunities?: string[], vulnerabilities?: string[], regeneration?: number}} */
    const out = {};
    for (const key of AFFINITY_KEYS) {
        const list = [...new Set(typeList(source?.[key]))];
        if (list.length > 0) out[key] = list;
    }
    const regeneration = Math.floor(Number(source?.regeneration) || 0);
    if (regeneration > 0) out.regeneration = regeneration;
    return out;
}

/**
 * Un tipo de daño escrito como sea («Fire», «fuego»), en inglés. Vacío si no es un tipo.
 *
 * @param {any} value
 * @returns {string}
 */
export function damageTypeOf(value) {
    return typeList(text(value).split(/\s+/)[0])[0] ?? '';
}

/**
 * El daño que le llega a alguien de un golpe con tipo, con lo que resiste (lo suyo y, si
 * es del grupo, lo de su raza).
 *
 * @param {Object} input
 * @param {number} input.damage
 * @param {any} input.type
 * @param {any} input.target
 * @param {any} [input.raceRow] La fila de su raza en razas.json, si es del grupo.
 * @returns {{damage: number, affinity: 'immune'|'resist'|'vulnerable'|'normal', note: string}}
 */
export function feltDamage({ damage, type, target, raceRow = null }) {
    const base = Math.max(0, Math.floor(Number(damage) || 0));
    const kind = damageTypeOf(type);
    if (!kind || base <= 0) return { damage: base, affinity: 'normal', note: '' };
    /** @type {Record<string, string[]>} */
    const merged = {};
    for (const key of AFFINITY_KEYS) merged[key] = [...typeList(target?.[key]), ...typeList(raceRow?.[key])];
    const affinity = affinityOf(merged, kind);
    if (affinity === 'immune') return { damage: 0, affinity, note: 'no le hace nada' };
    if (affinity === 'resist') return { damage: Math.floor(base / 2), affinity, note: 'lo resiste: la mitad' };
    if (affinity === 'vulnerable') return { damage: base * 2, affinity, note: 'le duele el doble' };
    return { damage: base, affinity, note: '' };
}

/**
 * Si un daño de este tipo le corta la regeneración hasta su próximo turno.
 *
 * @param {any} type
 * @returns {boolean}
 */
export function stopsRegeneration(type) {
    return STOPS_REGENERATION.includes(damageTypeOf(type));
}

/**
 * Lo que se regenera al empezar su turno. `heal` es lo que hay que sumarle; `line`, lo que
 * se dice en el registro (vacío si no hay nada que decir).
 *
 * @param {any} enemy Con `regeneration`, `currentHp`, `maxHp` y, si le dio fuego o ácido, `regenBlocked`.
 * @returns {{heal: number, blocked: boolean, line: string}}
 */
export function regenerationTurn(enemy) {
    const amount = Math.floor(Number(enemy?.regeneration) || 0);
    const hp = Number(enemy?.currentHp) || 0;
    if (amount <= 0 || hp <= 0) return { heal: 0, blocked: false, line: '' };
    const name = text(enemy?.name) || 'El enemigo';
    if (enemy?.regenBlocked) return { heal: 0, blocked: true, line: `🔥 A ${name} no se le cierran las heridas: el fuego o el ácido se lo impiden.` };
    const heal = Math.max(0, Math.min(amount, (Number(enemy?.maxHp) || hp) - hp));
    if (heal <= 0) return { heal: 0, blocked: false, line: '' };
    return { heal, blocked: false, line: `🩸 ${name} se regenera: recupera ${heal} PV.` };
}
