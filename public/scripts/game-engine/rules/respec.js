/**
 * Rehacerse en el templo: volver a elegir las mejoras de nivel, pagando (idea 58).
 *
 * Una mejora mal elegida al subir de nivel se arrastraba toda la partida. En el templo se
 * puede corregir: se deshacen todas las que tiene y se eligen otras tantas, las que se
 * quieran de la lista entera. Cuesta oro por cada una, para que sea una decisión y no un
 * botón que se pulsa antes de cada combate.
 *
 * Puro: dice lo que cuesta y deja la ficha como tiene que quedar. Quien llama cobra.
 */

import { ALL_PERKS, perksOf, takePerk } from './level-perks.js';

/** Lo que cuesta rehacer cada mejora. */
export const RESPEC_PRICE = 30;

/**
 * Lo que cuesta rehacer a alguien: nada si no tiene mejoras que rehacer.
 *
 * @param {any} member
 * @returns {number}
 */
export function respecCost(member) {
    return perksOf(member).length * RESPEC_PRICE;
}

/**
 * La ficha sin ninguna mejora: se quita lo que ya estaba escrito (la vida y la velocidad).
 *
 * @param {any} member
 * @returns {{perks: string[], maxHp: number, hp: number, speed: number}}
 */
export function undoPerks(member) {
    const had = perksOf(member);
    const lessHp = had.reduce((sum, p) => sum + (Number(p.effect.maxHp) || 0), 0);
    const lessSpeed = had.reduce((sum, p) => sum + (Number(p.effect.speed) || 0), 0);
    const maxHp = Math.max(1, (Number(member?.maxHp) || 1) - lessHp);
    return {
        perks: [],
        maxHp,
        hp: Math.max(0, Math.min(maxHp, (Number(member?.hp) || 0) - lessHp)),
        speed: Math.max(0, (Number(member?.speed) || 30) - lessSpeed),
    };
}

/**
 * Rehacer: tantas mejoras como tenía, sin repetir y de las que existen.
 *
 * @param {any} member
 * @param {string[]} chosen
 * @returns {{ok: boolean, reason: string, patch: {perks: string[], maxHp: number, hp: number, speed: number}|null}}
 */
export function redoPerks(member, chosen) {
    const count = perksOf(member).length;
    const ids = [...new Set((Array.isArray(chosen) ? chosen : []).map(String))];
    if (count === 0) return { ok: false, reason: 'No tiene mejoras que rehacer.', patch: null };
    if (ids.length !== count) return { ok: false, reason: `Hay que elegir ${count}.`, patch: null };
    if (ids.some(id => !ALL_PERKS.some(p => p.id === id))) return { ok: false, reason: 'Esa mejora no existe.', patch: null };
    /** @type {any} */
    let sheet = { ...member, ...undoPerks(member) };
    for (const id of ids) {
        const patch = takePerk(sheet, id);
        if (patch) sheet = { ...sheet, ...patch };
    }
    return {
        ok: true,
        reason: '',
        patch: { perks: sheet.perks, maxHp: sheet.maxHp, hp: sheet.hp, speed: sheet.speed },
    };
}
