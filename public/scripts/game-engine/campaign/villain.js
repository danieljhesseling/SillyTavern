/**
 * Un villano que se deja ver en mitad del hilo, no solo al final (idea 115).
 *
 * El antagonista de un guion aparecía en el último tablero, y hasta entonces era un nombre
 * en las escenas. Ahora el guion puede decir quién es y **cuándo asoma**: al empezar cada
 * acto (o al cumplirse un hito), una escena corta en la que se deja ver, se cuenta al
 * narrador y queda en el diario. Una vez cada una.
 *
 * En el guion:
 *
 *     villano:
 *       nombre: Capitana Keller
 *       asoma:
 *         - { acto: 2, escena: "Desde la loma, alguien os mira con catalejo." }
 *         - { hito: la-vanguardia, escena: "Keller sale de su tienda y os señala." }
 *
 * Puro: dice qué escenas tocan ahora.
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * @typedef {{name: string, appears: Array<{id: string, act: number, milestone: string, scene: string}>}} Villain
 */

/**
 * @param {any} raw
 * @returns {Villain|null}
 */
export function readVillain(raw) {
    const name = text(raw?.name);
    if (!name) return null;
    const appears = (Array.isArray(raw?.appears) ? raw.appears : [])
        .filter((/** @type {any} */ a) => text(a?.scene))
        .map((/** @type {any} */ a, /** @type {number} */ i) => ({
            id: `v${i + 1}`,
            act: Math.max(0, Math.floor(Number(a.act) || 0)),
            milestone: text(a.milestone),
            scene: text(a.scene),
        }));
    return { name, appears };
}

/**
 * Las escenas que tocan ya y no se han contado.
 *
 * @param {Object} input
 * @param {Villain|null} input.villain
 * @param {number} input.act El acto en el que va el hilo.
 * @param {string[]} input.done Los hitos cumplidos.
 * @param {string[]} input.seen Las escenas ya contadas.
 * @returns {Array<{id: string, scene: string}>}
 */
export function villainScenesDue({ villain, act, done, seen }) {
    if (!villain) return [];
    const told = new Set((seen || []).map(String));
    const finished = new Set((done || []).map(String));
    return villain.appears
        .filter(a => !told.has(a.id))
        .filter(a => (a.milestone ? finished.has(a.milestone) : a.act > 0 && Number(act) >= a.act))
        .map(a => ({ id: a.id, scene: a.scene }));
}

/**
 * Lo que se le dice al narrador.
 *
 * @param {Villain} villain
 * @param {string} scene
 * @returns {string}
 */
export function villainNote(villain, scene) {
    return `[VILLANO] ${villain.name} se deja ver: ${scene} Cuéntalo en dos o tres frases, con presencia, sin que haya combate. No inventes nada más.`;
}
