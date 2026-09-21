/**
 * What a piece of loot actually *is*.
 *
 * Until now what an enemy dropped was appended to the first survivor's inventory as a
 * comma-separated string. It read fine and it could not be used: a potion you cannot
 * drink and a sword you cannot equip are flavour text with extra steps.
 *
 * So each name in the loot tables is declared here with the fields the item system needs
 * — what kind of thing it is, what it weighs, what it does when it is a weapon. Declared
 * rather than guessed from the name: inferring that "Daga mellada" is a dagger works
 * until somebody adds "Dagas de recuerdo, decorativas" to a rule pack.
 *
 * Anything not declared still becomes a real item, as generic gear. An undeclared name is
 * a gap in this table, not a reason to hand the player a string.
 *
 * Pure. See wiki/ROADMAP.md, Fase B · wiki/POR_HACER.md.
 */

/**
 * @typedef {Object} LootItemSpec
 * @property {string} name
 * @property {string} type
 * @property {string} category
 * @property {string} subcategory
 * @property {number} weight
 * @property {string} [damageDice]
 * @property {string} [damageType]
 * @property {string} [description]
 * @property {string} [slot] Una de las ranuras del motor, en minusculas.
 */

/** What each thing the loot tables can drop is made of. */
const CATALOGUE = {
    'Poción de curación': { type: 'gear', category: 'magic', subcategory: 'potion', weight: 0.5, description: 'Recupera 2d4+2 puntos de vida al beberla.' },
    'Poción de curación mayor': { type: 'gear', category: 'magic', subcategory: 'potion', weight: 0.5, description: 'Recupera 4d4+4 puntos de vida al beberla.' },
    'Cuerda de seda (15 m)': { type: 'gear', category: 'gear', subcategory: 'tool', weight: 2.5 },
    'Raciones de viaje': { type: 'gear', category: 'gear', subcategory: 'consumable', weight: 1 },
    'Antorcha bendecida': { type: 'gear', category: 'gear', subcategory: 'consumable', weight: 0.5 },
    'Daga mellada': { type: 'weapon', category: 'weapon', subcategory: 'simple_melee', weight: 0.5, damageDice: '1d4', damageType: 'piercing', slot: 'weapon' },
    'Bolsa de canicas': { type: 'gear', category: 'gear', subcategory: 'tool', weight: 1 },
    'Capa del vagabundo': { type: 'gear', category: 'magic', subcategory: 'wondrous', weight: 1 },
    'Amuleto de calor': { type: 'gear', category: 'magic', subcategory: 'wondrous', weight: 0.2 },
    'Aceite afilador': { type: 'gear', category: 'gear', subcategory: 'consumable', weight: 0.5 },
    'Botas silenciosas': { type: 'gear', category: 'magic', subcategory: 'wondrous', weight: 0.5, slot: 'feet' },
    'Espada rúnica': { type: 'weapon', category: 'weapon', subcategory: 'martial_melee', weight: 1.5, damageDice: '1d8', damageType: 'slashing', slot: 'weapon' },
    'Anillo de resistencia': { type: 'gear', category: 'magic', subcategory: 'ring', weight: 0, slot: 'ring' },
    'Varita de destellos': { type: 'gear', category: 'magic', subcategory: 'wand', weight: 0.5 },
    'Armadura de escamas verdes': { type: 'armor', category: 'armor', subcategory: 'medium_armor', weight: 20, slot: 'body' },
    'Capa de sombras': { type: 'gear', category: 'magic', subcategory: 'wondrous', weight: 1 },
    'Hoja del alba': { type: 'weapon', category: 'weapon', subcategory: 'martial_melee', weight: 1.5, damageDice: '1d8', damageType: 'radiant', slot: 'weapon' },
    'Talismán del corazón firme': { type: 'gear', category: 'magic', subcategory: 'wondrous', weight: 0.2 },
};

/** What anything undeclared becomes: a real item, of the most ordinary kind. */
const FALLBACK = { type: 'gear', category: 'gear', subcategory: 'generic', weight: 0.5 };

/**
 * The item a dropped name stands for, ready for `createItem`.
 *
 * @param {string} name
 * @param {string} [rarity]
 * @returns {LootItemSpec & {rarity: string}}
 */
export function describeLootItem(name, rarity = '') {
    const clean = String(name ?? '').trim();
    const declared = CATALOGUE[clean] ?? FALLBACK;
    return { name: clean || 'Objeto', rarity: String(rarity ?? ''), ...declared };
}

/**
 * Whether this table knows what a name is, for a check that a rule pack has not added
 * loot nobody declared.
 *
 * @param {string} name
 * @returns {boolean}
 */
export function isDeclaredLoot(name) {
    return Object.prototype.hasOwnProperty.call(CATALOGUE, String(name ?? '').trim());
}

/** Every name this table declares. */
export function declaredLootNames() {
    return Object.keys(CATALOGUE);
}
