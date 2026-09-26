/**
 * Jefes con fases: al bajar de la mitad, un jefe cambia (la P22, R6 del roadmap de
 * profundidad).
 *
 * Un jefe que pelea igual con cien puntos de vida que con diez es un saco de puntos. Con
 * esto, al bajar de la mitad, cambia **una vez**, según cómo pelea:
 *
 * - **El que manda llama a los suyos**: llegan dos más, de lo más flojo de su banda.
 * - **El que aguanta se acorrala**: +2 a la CA, y ya no se mueve de ahí.
 * - **El que ataca se enfurece**: +2 al ataque hasta que caiga.
 *
 * Y se dice, que es lo que lo convierte en un momento y no en un número que cambia.
 *
 * Puro: decide la fase. Aplicarla es de quien llama.
 *
 * Ver wiki/ROADMAP_PROFUNDIDAD.md, R6.
 */

/** Por debajo de cuánto cambia. */
export const PHASE_AT = 0.5;

/**
 * @typedef {Object} BossPhase
 * @property {'refuerzos'|'acorralado'|'furia'} kind
 * @property {string} line
 * @property {Record<string, any>} patch Lo que cambia en su ficha.
 * @property {string[]} summon A quién llama (por nombre), si llama.
 */

/**
 * La fase de un jefe, si le toca ahora. Una vez por combate.
 *
 * @param {Object} input
 * @param {any} input.enemy
 * @param {string[]} [input.band] Los nombres de su banda, del más flojo al más fuerte.
 * @returns {BossPhase|null}
 */
export function bossPhase({ enemy, band = [] }) {
    const boss = Boolean(enemy?.boss) || enemy?.role === 'lider';
    const hp = Number(enemy?.currentHp) || 0;
    const max = Number(enemy?.maxHp) || 0;
    if (!boss || enemy?.phased || hp <= 0 || max <= 0 || hp / max > PHASE_AT) return null;
    const name = String(enemy?.name ?? 'El jefe');
    const minions = (Array.isArray(band) ? band : []).filter(n => n && n !== name.replace(/\s+\d+$/, ''));
    if (enemy?.role === 'lider' && minions.length > 0) {
        const weakest = minions[0];
        return {
            kind: 'refuerzos',
            line: `${name}, malherido, da una voz: llegan dos de los suyos.`,
            patch: { phased: true },
            summon: [weakest, weakest],
        };
    }
    if (enemy?.profile === 'guardian' || enemy?.role === 'tanque') {
        return {
            kind: 'acorralado',
            line: `${name} se acorrala: +2 a la CA, y ya no se mueve de ahí.`,
            patch: { phased: true, armorClass: (Number(enemy?.armorClass) || 10) + 2, speed: 0 },
            summon: [],
        };
    }
    return {
        kind: 'furia',
        line: `${name} se enfurece al verse herido: +2 al ataque hasta que caiga.`,
        patch: { phased: true, rage: 2 },
        summon: [],
    };
}
