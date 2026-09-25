/**
 * Short and long rests.
 *
 * The calendar has always been able to say what time it is; nothing could spend that
 * time. And without rests, hit points are not a resource: a fight either kills you or
 * costs you nothing you cannot walk off. Both halves were written and neither was
 * connected to the other.
 *
 * The 5e rules, as the table plays them:
 *
 * - A **short rest** spends hit dice. Each die spent heals its roll plus the character's
 *   Constitution modifier, and it is gone until a long rest gives it back.
 * - A **long rest** restores every hit point and gives back **half** your hit dice,
 *   rounded down, minimum one. That asymmetry is the whole economy: you can patch
 *   yourself up over an afternoon, but only sleeping refills the tank, and even then not
 *   all of it.
 *
 * Pure: the dice are injected, so what a rest is worth can be tested without rolling.
 *
 * See wiki/ROADMAP.md, Fase D (D5) · wiki/POR_HACER.md.
 */

/** What somebody with no class entry rolls. The most common die in the book. */
export const DEFAULT_HIT_DIE = 8;

/**
 * Read a hit die out of the text a class entry carries: "d10", "D8", "1d6".
 *
 * @param {any} value
 * @returns {number} The number of faces, or 0 when there is nothing to read.
 */
export function parseHitDie(value) {
    const match = String(value ?? '').match(/d\s*(\d{1,3})/i);
    const faces = match ? Number(match[1]) : 0;
    return faces > 0 && faces <= 100 ? faces : 0;
}

/**
 * The hit dice a character has, and how many are already spent.
 *
 * One die per level, which is what 5e gives a single-class character. A campaign that
 * wants multiclassing can write the count itself; this only fills in what is missing.
 *
 * @param {any} member
 * @param {Record<string, any>} [hitDieByClass] Class name to its die, from the world.
 * @returns {{faces: number, total: number, spent: number, available: number}}
 */
export function getHitDice(member, hitDieByClass = {}) {
    const declared = parseHitDie(member?.hitDie);
    const fromClass = parseHitDie(hitDieByClass?.[String(member?.class ?? '').toLowerCase()]);
    const faces = declared || fromClass || DEFAULT_HIT_DIE;

    const total = Math.max(1, Math.floor(Number(member?.level) || 1));
    const spent = Math.min(total, Math.max(0, Math.floor(Number(member?.hitDiceSpent) || 0)));

    return { faces, total, spent, available: total - spent };
}

/**
 * The Constitution modifier, which every spent die adds to its roll.
 *
 * @param {any} member
 * @returns {number}
 */
function conModifier(member) {
    return Math.floor(((Number(member?.constitution) || 10) - 10) / 2);
}

/**
 * @typedef {Object} RestEntry
 * @property {string} id
 * @property {string} name
 * @property {number} hpBefore
 * @property {number} hpAfter
 * @property {number} healed
 * @property {number} diceSpent
 * @property {number} diceRegained
 * @property {number[]} rolls What each spent die rolled, before the modifier.
 * @property {string} note Why nothing happened, when nothing did.
 */

/**
 * Plan a short rest.
 *
 * Everybody hurt spends dice one at a time until they are whole or out of dice, which is
 * what a table does when it stops to catch its breath. Somebody at full health spends
 * nothing: hit dice are too scarce to burn on nothing.
 *
 * Nobody who is down gets up. A short rest is a breather, not a resurrection — in 5e you
 * need a spell, or somebody to stabilise you.
 *
 * @param {Object} input
 * @param {any[]} input.party
 * @param {(faces: number) => number} input.rollDie Rolls one hit die of that many faces.
 * @param {Record<string, any>} [input.hitDieByClass]
 * @returns {{entries: RestEntry[], healed: number, diceSpent: number}}
 */
export function planShortRest({ party = [], rollDie, hitDieByClass = {} }) {
    /** @type {RestEntry[]} */
    const entries = [];
    let healed = 0;
    let diceSpent = 0;

    // Quien ha muerto no se levanta durmiendo: la muerte es para siempre (idea 36).
    for (const member of (Array.isArray(party) ? party : []).filter(m => m && !m.dead)) {
        const maxHp = Math.max(0, Number(member?.maxHp) || 0);
        const hpBefore = Math.max(0, Number(member?.hp) || 0);
        const dice = getHitDice(member, hitDieByClass);
        const modifier = conModifier(member);

        /** @type {number[]} */
        const rolls = [];
        let hp = hpBefore;
        let spent = 0;

        if (hpBefore <= 0) {
            entries.push({
                id: String(member?.id ?? ''), name: String(member?.name ?? ''),
                hpBefore, hpAfter: hpBefore, healed: 0, diceSpent: 0, diceRegained: 0,
                rolls, note: 'Esta fuera de combate: un respiro no levanta a nadie.',
            });
            continue;
        }

        while (hp < maxHp && spent < dice.available) {
            const roll = Math.max(1, Math.floor(rollDie(dice.faces)));
            rolls.push(roll);
            // A die can never take hit points away, however bad the Constitution.
            hp = Math.min(maxHp, hp + Math.max(0, roll + modifier));
            spent++;
        }

        entries.push({
            id: String(member?.id ?? ''), name: String(member?.name ?? ''),
            hpBefore, hpAfter: hp, healed: hp - hpBefore, diceSpent: spent, diceRegained: 0, rolls,
            note: spent === 0
                ? (hp >= maxHp ? 'Ya estaba entero.' : 'Sin dados de golpe: solo un descanso largo los devuelve.')
                : '',
        });

        healed += hp - hpBefore;
        diceSpent += spent;
    }

    return { entries, healed, diceSpent };
}

/**
 * Plan a long rest.
 *
 * Every hit point back, and half the hit dice — rounded down, never fewer than one. The
 * rounding is what stops a long rest from erasing the day: a fifth-level character who
 * burned everything gets two dice back, not five.
 *
 * Somebody at zero wakes up at one hit point rather than at full. Sleeping through it is
 * how 5e brings you back from dying, but waking healthy from a night on the floor would
 * make being knocked out cost nothing at all.
 *
 * @param {Object} input
 * @param {any[]} input.party
 * @param {Record<string, any>} [input.hitDieByClass]
 * @returns {{entries: RestEntry[], healed: number, diceRegained: number}}
 */
export function planLongRest({ party = [], hitDieByClass = {} }) {
    /** @type {RestEntry[]} */
    const entries = [];
    let healed = 0;
    let diceRegained = 0;

    // Quien ha muerto no se levanta durmiendo: la muerte es para siempre (idea 36).
    for (const member of (Array.isArray(party) ? party : []).filter(m => m && !m.dead)) {
        const maxHp = Math.max(0, Number(member?.maxHp) || 0);
        const hpBefore = Math.max(0, Number(member?.hp) || 0);
        const dice = getHitDice(member, hitDieByClass);

        const hpAfter = hpBefore <= 0 ? Math.min(1, maxHp) : maxHp;
        const regained = Math.min(dice.spent, Math.max(1, Math.floor(dice.total / 2)));

        entries.push({
            id: String(member?.id ?? ''), name: String(member?.name ?? ''),
            hpBefore, hpAfter, healed: hpAfter - hpBefore, diceSpent: 0, diceRegained: regained,
            rolls: [],
            note: hpBefore <= 0 ? 'Despierta en pie, pero con un solo punto de vida.' : '',
        });

        healed += hpAfter - hpBefore;
        diceRegained += regained;
    }

    return { entries, healed, diceRegained };
}

/**
 * The rest, in the words the log and the chat use.
 *
 * @param {'corto'|'largo'} kind
 * @param {{entries: RestEntry[], healed: number, diceSpent?: number, diceRegained?: number}} plan
 * @returns {string[]}
 */
export function describeRest(kind, plan) {
    const lines = [`Descanso ${kind}.`];

    for (const entry of plan.entries) {
        if (entry.note && entry.healed === 0 && entry.diceRegained === 0) {
            lines.push(`${entry.name}: ${entry.note}`);
            continue;
        }
        const rolls = entry.rolls.length > 0 ? ` (${entry.rolls.join(' + ')})` : '';
        const dice = entry.diceSpent > 0
            ? `, ${entry.diceSpent} dado${entry.diceSpent === 1 ? '' : 's'} de golpe${rolls}`
            : entry.diceRegained > 0
                ? `, recupera ${entry.diceRegained} dado${entry.diceRegained === 1 ? '' : 's'} de golpe`
                : '';
        lines.push(`${entry.name}: ${entry.hpBefore} → ${entry.hpAfter} PG${dice}.`);
    }

    return lines;
}
