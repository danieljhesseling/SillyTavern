/**
 * Dice you can roll twice and get the same answer.
 *
 * Every question about whether a change helped — a new prompt, a different rule, a fix to
 * the enemy AI — runs into the same wall: the fight went differently, so who knows. With
 * a seed the fight goes the same way, and the only thing that differs is the thing you
 * changed.
 *
 * `mulberry32`: thirty-two bits of state, four operations, and a period long enough that
 * nothing in a session will see it repeat. It is not cryptography and does not pretend
 * to be; it is a die that remembers.
 *
 * Pure. See wiki/ROADMAP.md, Transversales · wiki/POR_HACER.md.
 */

/**
 * Turn any text into a seed, so a seed can be a word you remember.
 *
 * @param {string|number} value
 * @returns {number} A 32-bit unsigned integer.
 */
export function seedFrom(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.abs(Math.trunc(value)) >>> 0;

    const text = String(value ?? '');
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

/**
 * A random function that always produces the same sequence for the same seed.
 *
 * @param {string|number} seed
 * @returns {() => number} Numbers in [0, 1), like `Math.random`.
 */
export function createSeededRandom(seed) {
    let state = seedFrom(seed);

    return function next() {
        state = (state + 0x6D2B79F5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * A seed for a turn, built from what the turn *is* rather than from the clock.
 *
 * Two runs of the same turn of the same fight get the same seed without anybody writing
 * it down, which is what makes a replay possible after the fact instead of only when
 * somebody remembered to record one.
 *
 * @param {Object} input
 * @param {string} [input.campaign]
 * @param {number} [input.round]
 * @param {number} [input.turnIndex]
 * @param {string} [input.actorId]
 * @param {string|number} [input.salt] Anything that should make an otherwise identical
 *   turn roll differently, such as the attempt number.
 * @returns {number}
 */
export function seedForTurn({ campaign = '', round = 1, turnIndex = 0, actorId = '', salt = '' }) {
    return seedFrom(`${campaign}|${round}|${turnIndex}|${actorId}|${salt}`);
}

/**
 * Roll a formula with a given source of randomness.
 *
 * The same arithmetic the game uses, with the die injected, so a replay and a live turn
 * cannot drift apart because one of them counted differently.
 *
 * @param {string} formula Such as "2d6+3".
 * @param {() => number} random
 * @returns {{total: number, rolls: number[], modifier: number}}
 */
export function rollWith(formula, random) {
    const match = String(formula ?? '').trim().match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (!match) return { total: 0, rolls: [], modifier: 0 };

    const count = Math.max(1, Math.min(100, Number(match[1]) || 1));
    const faces = Math.max(1, Math.min(1000, Number(match[2]) || 6));
    const modifier = Number(match[3] ?? 0) || 0;

    /** @type {number[]} */
    const rolls = [];
    for (let i = 0; i < count; i++) {
        rolls.push(Math.floor(random() * faces) + 1);
    }

    return { total: rolls.reduce((sum, roll) => sum + roll, 0) + modifier, rolls, modifier };
}
