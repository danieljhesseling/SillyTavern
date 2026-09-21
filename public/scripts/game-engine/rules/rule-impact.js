/**
 * What a change to the rules would break.
 *
 * The rules editor lets a campaign drop a damage type, a condition, a rarity. Nothing
 * stopped it, and nothing said what it would cost: the sword that dealt "Radiante" kept
 * pointing at a damage type that no longer existed, and the only sign was that it stopped
 * behaving like a magic sword, quietly, three sessions later.
 *
 * So before a pack is saved, the things already written against the old one are counted.
 * Not to refuse the change — it is the player's campaign — but so the choice is made with
 * the bill in view.
 *
 * Pure: it is handed the lists and the sheets, and it reads no files.
 *
 * See wiki/ROADMAP.md, Fase C · wiki/POR_HACER.md.
 */

/**
 * @typedef {Object} BrokenReference
 * @property {string} field What kind of thing lost its meaning.
 * @property {string} value The value that is going away.
 * @property {string[]} owners Who is left holding it, by name.
 * @property {string} message Ready to show.
 */

/**
 * Values of a list, whether it is a plain list or a list of [value, label] pairs.
 *
 * The rule pack uses both shapes, and a check that only understood one would report
 * every damage type as removed the first time it met the other.
 *
 * @param {any} list
 * @returns {Set<string>}
 */
function valuesOf(list) {
    // Three shapes in one pack: a plain list, a list of [value, label] pairs, and a map
    // from category to one of those. A check that understood only one would report every
    // value as removed the first time it met another.
    const items = Array.isArray(list)
        ? list
        : (list && typeof list === 'object' ? Object.values(list).flat() : []);

    return new Set(items
        .map(entry => (Array.isArray(entry) ? entry[0] : entry))
        .filter(value => value !== undefined && value !== null && value !== '')
        .map(value => String(value)));
}

/** Where each checked list lives in a pack, and what it is called when it breaks. */
const CHECKS = [
    { field: 'damageTypes', label: 'tipo de daño', path: ['items', 'damageTypes'] },
    { field: 'rarity', label: 'rareza', path: ['items', 'rarity'] },
    { field: 'subcategoryOptions', label: 'subcategoría de objeto', path: ['items', 'subcategoryOptions'] },
    { field: 'conditions', label: 'condición', path: ['character', 'conditions'] },
];

/**
 * @param {any} pack
 * @param {string[]} path
 * @returns {any}
 */
function at(pack, path) {
    return path.reduce((value, key) => (value == null ? value : value[key]), pack);
}

/**
 * What the sheets are holding, per checked field.
 *
 * @param {any[]} items
 * @param {any[]} characters
 * @returns {Record<string, Map<string, string[]>>}
 */
function collectUses(items, characters) {
    /** @type {Record<string, Map<string, string[]>>} */
    const used = { damageTypes: new Map(), rarity: new Map(), subcategoryOptions: new Map(), conditions: new Map() };

    const note = (/** @type {string} */ field, /** @type {any} */ value, /** @type {string} */ owner) => {
        const key = String(value ?? '').trim();
        if (!key) return;
        const list = used[field].get(key) ?? [];
        if (!list.includes(owner)) list.push(owner);
        used[field].set(key, list);
    };

    for (const item of (Array.isArray(items) ? items : []).filter(Boolean)) {
        const owner = String(item.name ?? 'Un objeto');
        note('damageTypes', item.damageType, owner);
        note('rarity', item.rarity, owner);
        note('subcategoryOptions', item.subcategory, owner);
    }

    for (const character of (Array.isArray(characters) ? characters : []).filter(Boolean)) {
        const owner = String(character.name ?? 'Alguien');
        for (const condition of (Array.isArray(character.activeConditions) ? character.activeConditions : [])) {
            note('conditions', condition, owner);
        }
    }

    return used;
}

/**
 * Everything that would lose its meaning if this pack replaced the current one.
 *
 * Only removals are reported. Adding a damage type breaks nothing, renaming a label
 * breaks nothing; taking a value away that something already points at is the only change
 * that leaves a dead reference behind.
 *
 * @param {Object} input
 * @param {any} input.before The pack in force.
 * @param {any} input.after The pack about to be saved.
 * @param {any[]} [input.items] Every item on every sheet.
 * @param {any[]} [input.characters]
 * @returns {BrokenReference[]}
 */
export function findBrokenReferences({ before, after, items = [], characters = [] }) {
    const used = collectUses(items, characters);
    /** @type {BrokenReference[]} */
    const broken = [];

    for (const check of CHECKS) {
        const had = valuesOf(at(before, check.path));
        const has = valuesOf(at(after, check.path));

        for (const [value, owners] of used[check.field]) {
            // Only what the old pack had and the new one does not: something already
            // pointing at a value neither pack knows is a separate mess.
            if (!had.has(value) || has.has(value)) continue;

            broken.push({
                field: check.field,
                value,
                owners,
                message: `Se quita el ${check.label} "${value}", que usa`
                    + `${owners.length === 1 ? '' : 'n'}: ${owners.slice(0, 4).join(', ')}`
                    + `${owners.length > 4 ? ` y ${owners.length - 4} más` : ''}.`,
            });
        }
    }

    return broken;
}

/**
 * One line summarising the damage, for a confirmation that has to fit in a dialog.
 *
 * @param {BrokenReference[]} broken
 * @returns {string}
 */
export function describeImpact(broken) {
    const list = Array.isArray(broken) ? broken : [];
    if (list.length === 0) return 'Ningún objeto ni personaje se queda con una referencia muerta.';

    const owners = new Set(list.flatMap(b => b.owners));
    return `${list.length} valor(es) que se quitan afectan a ${owners.size} ficha(s). `
        + 'Lo que apunte a ellos se queda sin significado.';
}
