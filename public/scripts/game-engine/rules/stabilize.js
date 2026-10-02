/**
 * Estabilizar a quien ha caído, como en D&D 2024: con la acción de Ayudar, junto a quien está
 * a 0 PG, una prueba de Sabiduría (Medicina) contra 10. Si sale, deja de desangrarse: sigue a
 * 0 PG y sin sentido, pero ya no tira salvaciones de muerte. Si no sale, sigue como estaba.
 *
 * En la pelea es una acción, pegado a quien ha caído (`stabilizeCheck`). Acabada la pelea ya no
 * hay prisa: quien mejor sabe de Medicina lo intenta hasta que sale (`tendFallen`), sin
 * salvaciones de por medio. Antes, quien caía seguía tirando ronda tras ronda mientras el héroe
 * andaba hasta la ventana, y al acabar la pelea se quedaba en el suelo sin que nadie le mirase.
 *
 * Puro: la tirada entra como número o como función; quien llama gasta la acción y lo cuenta.
 */

import { isDying, clearDeathSaves } from './death-saves.js';
import { rollLine } from './roll-line.js';

/** La CD de estabilizar (2024): Sabiduría (Medicina) contra 10. */
export const STABILIZE_DC = 10;

/**
 * Si alguien está para estabilizarle: en el suelo y tirando salvaciones (ni estable, ni
 * muerto). Una invocación no se desangra: a cero, se va.
 *
 * @param {any} member
 * @returns {boolean}
 */
export function needsStabilizing(member) {
    return Boolean(member) && !member.dead && !member.summon && isDying(member);
}

/**
 * Las salvaciones de quien queda estable: a cero, y sin tirar más.
 *
 * @returns {{successes: number, failures: number, stable: boolean, dead: boolean}}
 */
export function stableSaves() {
    return { ...clearDeathSaves(), stable: true };
}

/**
 * Una prueba de Medicina para estabilizar a alguien, en la pelea.
 *
 * @param {Object} input
 * @param {string} input.helper Quien atiende.
 * @param {string} input.target Quien está en el suelo.
 * @param {number} input.natural Lo que marca el d20.
 * @param {number} [input.modifier] Su Sabiduría (Medicina).
 * @returns {{success: boolean, total: number, lines: string[]}}
 */
export function stabilizeCheck({ helper, target, natural, modifier = 0 }) {
    const d20 = Math.max(1, Math.min(20, Math.floor(Number(natural) || 1)));
    const mod = Math.floor(Number(modifier) || 0);
    const total = d20 + mod;
    const success = total >= STABILIZE_DC;
    const roll = rollLine({ what: 'Medicina', who: helper, total, against: STABILIZE_DC, label: 'CD', success, natural: d20, modifier: mod });
    return {
        success,
        total,
        lines: success
            ? [roll, `🩹 ${helper} le tapona la herida a ${target}: deja de desangrarse. Sigue a 0 PG, pero ya no tira salvaciones de muerte.`]
            : [roll, `❌ ${helper} no consigue cortarle la sangre a ${target}: sigue tirando salvaciones de muerte.`],
    };
}

/**
 * Quien mejor atiende a los caídos: de los que siguen en pie, el de mejor Medicina (a igualdad,
 * el primero del grupo). Nadie, si no queda nadie en pie.
 *
 * @template T
 * @param {T[]} members
 * @param {(member: T) => number} medicineOf
 * @returns {T|null}
 */
export function bestTender(members, medicineOf) {
    /** @type {T|null} */
    let best = null;
    let bestMod = -Infinity;
    for (const member of Array.isArray(members) ? members : []) {
        const m = /** @type {any} */ (member);
        if (!m || m.dead || m.summon || (Number(m.hp) || 0) <= 0) continue;
        const mod = Number(medicineOf(member)) || 0;
        if (mod > bestMod) {
            best = member;
            bestMod = mod;
        }
    }
    return best;
}

/**
 * Acabada la pelea: atender a quien sigue en el suelo, sin prisa. Se intenta hasta que sale
 * (cada intento es un rato más, no una salvación de muerte); se cuenta la tirada que lo consigue.
 *
 * @param {Object} input
 * @param {string} input.helper
 * @param {string} input.target
 * @param {() => number} input.rollD20
 * @param {number} [input.modifier]
 * @param {number} [input.maxTries] Por si acaso: tras tantos, lo consigue igual, «tras mucho rato»
 *   (fuera de la pelea nadie se queda en el suelo porque los dados no quieran).
 * @returns {{tries: number, total: number, line: string}}
 */
export function tendFallen({ helper, target, rollD20, modifier = 0, maxTries = 20 }) {
    const mod = Math.floor(Number(modifier) || 0);
    let tries = 0;
    let natural = 1;
    let total = 1 + mod;
    while (tries < Math.max(1, maxTries)) {
        tries++;
        natural = Math.max(1, Math.min(20, Math.floor(Number(rollD20()) || 1)));
        total = natural + mod;
        if (total >= STABILIZE_DC) break;
    }
    const ok = total >= STABILIZE_DC;
    const roll = rollLine({ what: 'Medicina', who: helper, total, against: STABILIZE_DC, label: 'CD', success: ok, natural, modifier: mod });
    const when = !ok ? ' (tras mucho rato)' : tries === 1 ? '' : ` (a la ${ORDINALS[tries] ?? `${tries}.ª`}, con calma)`;
    return {
        tries,
        total,
        line: `${roll}\n🩹 Acabada la pelea, ${helper} atiende a ${target}${when}: deja de desangrarse. Sigue a 0 PG hasta que descanse o le curen.`,
    };
}

/** «a la segunda», «a la tercera»… */
const ORDINALS = ['', 'primera', 'segunda', 'tercera', 'cuarta', 'quinta', 'sexta', 'séptima', 'octava', 'novena', 'décima'];
