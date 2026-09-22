/**
 * What winning is worth.
 *
 * Until this existed, beating an encounter changed nothing: the enemies fell over and the
 * party walked on with the same gold, the same experience and the same equipment. A fight
 * with no consequence is a fight with no stakes, and the tactical engine underneath it
 * was doing careful work for nothing.
 *
 * The numbers live in a table, not in the code, so a rule pack can make a campaign poorer,
 * richer or faster to level without anybody editing JavaScript — which is the same promise
 * the rest of Fase C makes.
 *
 * Pure: the dice are injected, so a test knows exactly what was rolled.
 *
 * See wiki/ROADMAP.md, Fase B (B5) · PROP-067.
 */

/**
 * @typedef {Object} LootRules
 * @property {number} goldPerCr        Flat gold per point of challenge rating.
 * @property {string} goldDice         Rolled once per enemy.
 * @property {number} goldDieMultiplier
 * @property {Array<[number, number]>} xpByCr       Challenge rating to experience.
 * @property {Array<[number, number]>} itemChanceByCr  Challenge rating to drop chance, 0 to 1.
 * @property {Array<[number, string]>} rarityByCr   The best rarity a challenge rating can drop.
 * @property {Record<string, string[]>} itemsByRarity
 */

/**
 * The default rewards, as D&D 5e counts experience and as the design document proposed
 * for gold. Thresholds are read as "this challenge rating or higher", so a table only has
 * to name the steps that change.
 *
 * @type {LootRules}
 */
export const DEFAULT_LOOT_RULES = {
    goldPerCr: 10,
    goldDice: '2d6',
    goldDieMultiplier: 5,

    xpByCr: [
        [0, 10], [0.125, 25], [0.25, 50], [0.5, 100], [1, 200], [2, 450], [3, 700],
        [4, 1100], [5, 1800], [6, 2300], [7, 2900], [8, 3900], [9, 5000], [10, 5900],
    ],

    // A fight worth more is likelier to leave something behind, but never certainly:
    // loot that always drops stops being a reward and becomes an allowance.
    itemChanceByCr: [
        [0, 0.05], [0.25, 0.12], [1, 0.22], [3, 0.35], [5, 0.5], [8, 0.65],
    ],

    rarityByCr: [
        [0, 'Common'], [1, 'Common'], [3, 'Uncommon'], [6, 'Rare'], [9, 'Very Rare'],
    ],

    itemsByRarity: {
        'Common': [
            'Poción de curación', 'Cuerda de seda (15 m)', 'Raciones de viaje',
            'Antorcha bendecida', 'Daga mellada', 'Bolsa de canicas',
        ],
        'Uncommon': [
            'Poción de curación mayor', 'Capa del vagabundo', 'Amuleto de calor',
            'Aceite afilador', 'Botas silenciosas',
        ],
        'Rare': [
            'Espada rúnica', 'Anillo de resistencia', 'Varita de destellos',
            'Armadura de escamas verdes',
        ],
        'Very Rare': [
            'Capa de sombras', 'Hoja del alba', 'Talismán del corazón firme',
        ],
    },
};

/**
 * Las mismas reglas de botin, pero soltando tambien lo que el mundo tenga escrito.
 *
 * Sin esto, el catalogo de objetos del editor seria una lista bonita: se podrian escribir
 * cien objetos y seguiria cayendo lo de la tabla de `loot.js`. La rareza que el autor le
 * ponga a cada cosa es la que decide en que peldano cae, que es justo lo que hace que
 * escribir un objeto raro signifique algo.
 *
 * Se anaden a lo que ya habia en vez de sustituirlo: un mundo con tres objetos escritos no
 * deberia dejar al grupo sin pociones.
 *
 * @param {any[]} catalogue Los objetos del mundo.
 * @param {LootRules} [rules]
 * @returns {LootRules}
 */
export function lootRulesWithWorldItems(catalogue, rules = DEFAULT_LOOT_RULES) {
    const world = Array.isArray(catalogue) ? catalogue : [];
    if (world.length === 0) return rules;

    /** @type {Record<string, string[]>} */
    const byRarity = {};
    for (const [rarity, names] of Object.entries(rules.itemsByRarity ?? {})) {
        byRarity[rarity] = [...names];
    }

    for (const item of world) {
        const name = String(item?.name ?? '').trim();
        if (!name) continue;
        // Una rareza que las tablas no conocen no tiene peldano donde caer, asi que iria
        // a parar a ningun sitio: se trata como lo mas comun, que es lo que se ve.
        const declared = String(item?.rarity ?? '').trim();
        const rarity = Object.prototype.hasOwnProperty.call(byRarity, declared) ? declared : 'Common';
        byRarity[rarity] = byRarity[rarity] ?? [];
        if (!byRarity[rarity].includes(name)) byRarity[rarity].push(name);
    }

    return { ...rules, itemsByRarity: byRarity };
}

/**
 * Reads a threshold table: the value for the highest step at or below `cr`.
 *
 * @template T
 * @param {Array<[number, T]>} table
 * @param {number} cr
 * @param {T} fallback
 * @returns {T}
 */
function atChallengeRating(table, cr, fallback) {
    const rating = Number.isFinite(Number(cr)) ? Number(cr) : 0;
    let result = fallback;
    for (const [threshold, value] of (Array.isArray(table) ? table : [])) {
        if (rating >= threshold) result = value;
    }
    return result;
}

/**
 * Experience for defeating one creature.
 * @param {number} cr
 * @param {LootRules} [rules]
 * @returns {number}
 */
export function xpForChallenge(cr, rules = DEFAULT_LOOT_RULES) {
    return atChallengeRating(rules.xpByCr, cr, 10);
}

/**
 * Rolls what one defeated creature leaves behind.
 *
 * @param {{name?: string, cr?: number}} enemy
 * @param {Object} deps
 * @param {(formula: string) => number} deps.roll     Dice, injected.
 * @param {() => number} [deps.random]                0..1, injected for the drop chance.
 * @param {LootRules} [deps.rules]
 * @returns {{gold: number, xp: number, item: {name: string, rarity: string}|null}}
 */
export function rollEnemyLoot(enemy, { roll, random = Math.random, rules = DEFAULT_LOOT_RULES }) {
    const cr = Number(enemy?.cr) || 0;

    const dice = Number(roll(rules.goldDice)) || 0;
    const gold = Math.max(0, Math.round(cr * rules.goldPerCr + dice * rules.goldDieMultiplier));
    const xp = xpForChallenge(cr, rules);

    const chance = atChallengeRating(rules.itemChanceByCr, cr, 0);
    if (random() >= chance) return { gold, xp, item: null };

    const rarity = atChallengeRating(rules.rarityByCr, cr, 'Common');
    const pool = rules.itemsByRarity?.[rarity] ?? rules.itemsByRarity?.Common ?? [];
    if (pool.length === 0) return { gold, xp, item: null };

    const item = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
    return { gold, xp, item: { name: item, rarity } };
}

/**
 * @typedef {Object} LootResult
 * @property {number} gold          Total, before splitting.
 * @property {number} xp            Total, before splitting.
 * @property {Array<{name: string, rarity: string, from: string}>} items
 * @property {number} goldEach      What each surviving member receives.
 * @property {number} xpEach
 * @property {string[]} lines       Ready to print in the combat log.
 */

/**
 * Totals up an encounter and splits it among those still standing.
 *
 * Split between survivors rather than the whole party, because a character who is down
 * did not finish the fight — and because it gives the player one more reason to care
 * whether everyone is still up when the last enemy falls.
 *
 * @param {Array<{name?: string, cr?: number}>} enemies  The defeated.
 * @param {number} survivors
 * @param {Object} deps  As rollEnemyLoot.
 * @returns {LootResult}
 */
export function rollEncounterLoot(enemies, survivors, deps) {
    const defeated = Array.isArray(enemies) ? enemies : [];
    const shares = Math.max(1, Number(survivors) || 1);

    let gold = 0;
    let xp = 0;
    /** @type {Array<{name: string, rarity: string, from: string}>} */
    const items = [];

    for (const enemy of defeated) {
        const { gold: g, xp: x, item } = rollEnemyLoot(enemy, deps);
        gold += g;
        xp += x;
        if (item) items.push({ ...item, from: String(enemy?.name ?? '') });
    }

    // Rounded down, so the engine never hands out more than it rolled.
    const goldEach = Math.floor(gold / shares);
    const xpEach = Math.floor(xp / shares);

    /** @type {string[]} */
    const lines = [];
    if (defeated.length > 0) {
        lines.push(`💰 [COMBAT] Botín: ${gold} de oro y ${xp} PX (${goldEach} y ${xpEach} para cada superviviente).`);
        for (const item of items) {
            lines.push(`🎁 [COMBAT] ${item.from} llevaba: ${item.name} (${item.rarity}).`);
        }
    }

    return { gold, xp, items, goldEach, xpEach, lines };
}
