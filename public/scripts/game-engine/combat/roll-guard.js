/**
 * Catches dice results the model made up and replaces them with the engine's.
 *
 * Language models are fond of writing "1d20+5 = 23" where the arithmetic, or the die, or
 * both, are invented. Left alone that is not a cosmetic problem: the number goes on to
 * decide whether an attack lands, and the player has no way to tell a real roll from a
 * plausible one. The engine rolls; the prose is corrected to match.
 *
 * Only explicit, structured claims are touched — dice notation followed by a stated total.
 * Loose prose like "she rolled well" is left alone, because rewriting it would need the
 * module to understand the sentence, and a rewrite that guesses wrong is worse than none.
 * The prompt should ask the model for the structured form; this enforces it.
 *
 * Pure module: the caller injects the roller, so tests are deterministic.
 *
 * See wiki/ROADMAP.md, Fase B (B7) · PROP-135.
 */

/**
 * Dice notation followed by a claimed total.
 *
 * Matches "1d20+5 = 23", "2d6 -> 9", "1d8: 4" and the parenthesised "1d20+5 (23)".
 * The separator must be present: bare notation with no claimed number is not a claim.
 */
const CLAIM_PATTERN = /\b(\d{1,3})\s*d\s*(\d{1,3})\s*([+-]\s*\d{1,3})?\s*(?:=|=>|->|→|:)\s*(-?\d{1,4})\b/gi;

/** The same, in the parenthesised form. */
const PAREN_PATTERN = /\b(\d{1,3})\s*d\s*(\d{1,3})\s*([+-]\s*\d{1,3})?\s*\(\s*(-?\d{1,4})\s*\)/gi;

/**
 * @typedef {Object} RollCorrection
 * @property {string} formula   Normalised, e.g. "1d20+5".
 * @property {number} claimed   What the model said.
 * @property {number} actual    What the engine rolled.
 */

/**
 * @typedef {Object} GuardResult
 * @property {string} text               The prose, with fabricated totals replaced.
 * @property {RollCorrection[]} corrections
 */

/**
 * Normalises "1 d 20 + 5" into "1d20+5".
 * @param {string} count @param {string} sides @param {string|undefined} modifier
 * @returns {string}
 */
function normaliseFormula(count, sides, modifier) {
    const mod = (modifier || '').replace(/\s+/g, '');
    return `${Number(count)}d${Number(sides)}${mod}`;
}

/**
 * Finds every structured dice claim in a piece of text.
 *
 * @param {string} text
 * @returns {Array<{formula: string, claimed: number, index: number, match: string}>}
 */
export function findRollClaims(text) {
    const source = String(text ?? '');
    /** @type {Array<{formula: string, claimed: number, index: number, match: string}>} */
    const claims = [];

    for (const pattern of [CLAIM_PATTERN, PAREN_PATTERN]) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(source)) !== null) {
            claims.push({
                formula: normaliseFormula(match[1], match[2], match[3]),
                claimed: Number(match[4]),
                index: match.index,
                match: match[0],
            });
        }
    }

    return claims.sort((a, b) => a.index - b.index);
}

/**
 * The range a formula can possibly produce. Used to spot claims that are not merely
 * unlucky but impossible.
 *
 * @param {string} formula
 * @returns {{min: number, max: number} | null}
 */
export function getFormulaBounds(formula) {
    const match = /^(\d{1,3})d(\d{1,3})([+-]\d{1,3})?$/i.exec(String(formula ?? '').trim());
    if (!match) return null;

    const count = Number(match[1]);
    const sides = Number(match[2]);
    const modifier = Number(match[3] || 0);
    if (count < 1 || sides < 1) return null;

    return { min: count + modifier, max: count * sides + modifier };
}

/**
 * Whether a claimed total is even possible for that formula.
 * @param {string} formula
 * @param {number} claimed
 * @returns {boolean}
 */
export function isClaimPossible(formula, claimed) {
    const bounds = getFormulaBounds(formula);
    if (!bounds) return true; // unparseable: no grounds to call it wrong
    return claimed >= bounds.min && claimed <= bounds.max;
}

/**
 * Replaces every fabricated total with one the engine actually rolled.
 *
 * @param {string} text
 * @param {(formula: string) => number} roll  Injected so results are reproducible in tests.
 * @returns {GuardResult}
 */
export function guardRolls(text, roll) {
    const source = String(text ?? '');
    const claims = findRollClaims(source);
    if (claims.length === 0) return { text: source, corrections: [] };

    /** @type {RollCorrection[]} */
    const corrections = [];
    let output = '';
    let cursor = 0;

    for (const claim of claims) {
        // Overlapping matches can happen when both patterns hit the same span.
        if (claim.index < cursor) continue;

        const actual = Number(roll(claim.formula));
        output += source.slice(cursor, claim.index);

        if (Number.isFinite(actual) && actual !== claim.claimed) {
            // Replace only the number, keeping whatever separator the model wrote.
            const replaced = claim.match.replace(
                new RegExp(`${claim.claimed}(?!.*\\d)`),
                String(actual),
            );
            output += replaced;
            corrections.push({ formula: claim.formula, claimed: claim.claimed, actual });
        } else {
            output += claim.match;
        }

        cursor = claim.index + claim.match.length;
    }

    output += source.slice(cursor);
    return { text: output, corrections };
}

/**
 * A one-line note for the combat log, or null when nothing was wrong.
 * @param {RollCorrection[]} corrections
 * @returns {string|null}
 */
export function describeCorrections(corrections) {
    if (!Array.isArray(corrections) || corrections.length === 0) return null;
    const parts = corrections.map(c => `${c.formula}: ${c.claimed} → ${c.actual}`);
    return `🎲 Tiradas corregidas por el motor · ${parts.join(' · ')}`;
}
