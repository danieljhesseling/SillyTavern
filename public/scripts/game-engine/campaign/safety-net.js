/**
 * La red de seguridad: tras dos derrotas seguidas, el siguiente encuentro baja un escalón
 * (idea 25). Opcional: se enciende en la pausa.
 *
 * Perder un combate deja al grupo peor para el siguiente, y el siguiente se pierde más
 * fácil: es la espiral que hace que una partida se abandone. Con la red puesta, tras dos
 * derrotas (o huidas) seguidas, los enemigos del siguiente combate salen con menos vida y
 * peor defensa, **y se dice**: una ayuda que se esconde es una trampa al revés.
 *
 * Una victoria vuelve a poner la cuenta a cero.
 *
 * Puro: cuenta y dice cómo sale cada enemigo. Quien llama lo aplica.
 */

/** Cuántas derrotas seguidas hacen falta. */
export const SAFETY_STREAK = 2;

/** Lo que baja el escalón. */
export const SOFTEN = { hp: 0.75, armorClass: 1 };

/**
 * @param {any} raw
 * @returns {{streak: number}}
 */
export function readSafety(raw) {
    return { streak: Math.max(0, Math.floor(Number(raw?.streak) || 0)) };
}

/**
 * Apuntar cómo acabó un combate.
 *
 * @param {any} raw
 * @param {string} outcome `victory`, `defeat` o `fled`.
 * @returns {{streak: number}}
 */
export function noteOutcome(raw, outcome) {
    const { streak } = readSafety(raw);
    if (outcome === 'victory') return { streak: 0 };
    if (outcome === 'defeat' || outcome === 'fled') return { streak: streak + 1 };
    return { streak };
}

/**
 * Si al siguiente le toca bajar.
 *
 * @param {any} raw
 * @param {boolean} on Si la red está puesta.
 * @returns {boolean}
 */
export function shouldSoften(raw, on) {
    return Boolean(on) && readSafety(raw).streak >= SAFETY_STREAK;
}

/**
 * Un enemigo, un escalón más fácil.
 *
 * @param {any} enemy
 * @returns {any}
 */
export function softenEnemy(enemy) {
    const maxHp = Math.max(1, Math.ceil((Number(enemy?.maxHp) || 1) * SOFTEN.hp));
    return {
        ...enemy,
        maxHp,
        currentHp: Math.min(maxHp, Math.max(1, Math.ceil((Number(enemy?.currentHp) || maxHp) * SOFTEN.hp))),
        armorClass: Math.max(5, (Number(enemy?.armorClass) || 10) - SOFTEN.armorClass),
        softened: true,
    };
}

/** Lo que se dice al empezar. */
export const SOFTEN_NOTE = 'Red de seguridad: tras dos derrotas seguidas, este encuentro baja un escalón (menos vida y peor defensa).';
