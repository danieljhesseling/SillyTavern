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
 * @property {boolean} [consumable] Se gasta al usarse (idea 122: lo que se lanza).
 * @property {number} [uses]
 * @property {number} [charges] R4: las cargas de una varita.
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
    // R4: la Varita de destellos lanza Luz severa, tres veces (`rules/magic-items.js`).
    'Varita de destellos': { type: 'gear', category: 'magic', subcategory: 'wand', weight: 0.5, charges: 3, description: 'Lanza Luz severa. Tres cargas, y se apaga.' },
    'Armadura de escamas verdes': { type: 'armor', category: 'armor', subcategory: 'medium_armor', weight: 20, slot: 'body' },
    'Capa de sombras': { type: 'gear', category: 'magic', subcategory: 'wondrous', weight: 1 },
    'Hoja del alba': { type: 'weapon', category: 'weapon', subcategory: 'martial_melee', weight: 1.5, damageDice: '1d8', damageType: 'radiant', slot: 'weapon' },
    'Talismán del corazón firme': { type: 'gear', category: 'magic', subcategory: 'wondrous', weight: 0.2 },
    // Idea 122: lo que se lanza en combate (`combat/throwables.js`). Siempre en la tienda.
    'Frasco de aceite': { type: 'gear', category: 'gear', subcategory: 'throwable', weight: 0.5, consumable: true, uses: 1, description: 'Se lanza: si da, 2d4 de fuego; y la casilla arde para el primero que la pise.' },
    'Red': { type: 'gear', category: 'gear', subcategory: 'throwable', weight: 1.5, consumable: true, uses: 1, description: 'Se lanza: si da, deja al enemigo sujeto dos rondas.' },
    // R4: los pergaminos y la varita de escarcha (`rules/magic-items.js`).
    'Pergamino de Bola de fuego': { type: 'gear', category: 'magic', subcategory: 'scroll', weight: 0.1, consumable: true, uses: 1, description: 'Se lee una vez: Bola de fuego. Quien ha estudiado puede aprenderla (/pergamino).' },
    'Pergamino de Curar heridas': { type: 'gear', category: 'magic', subcategory: 'scroll', weight: 0.1, consumable: true, uses: 1, description: 'Se lee una vez: Curar heridas.' },
    'Pergamino de Sueño pesado': { type: 'gear', category: 'magic', subcategory: 'scroll', weight: 0.1, consumable: true, uses: 1, description: 'Se lee una vez: Sueño pesado.' },
    'Pergamino de Relámpago': { type: 'gear', category: 'magic', subcategory: 'scroll', weight: 0.1, consumable: true, uses: 1, description: 'Se lee una vez: Relámpago.' },
    'Pergamino de Paso sin rastro': { type: 'gear', category: 'magic', subcategory: 'scroll', weight: 0.1, consumable: true, uses: 1, description: 'Se aprende, no se lee en combate: Paso sin rastro.' },
    'Varita de escarcha': { type: 'gear', category: 'magic', subcategory: 'wand', weight: 0.5, charges: 3, description: 'Lanza Cono de escarcha. Tres cargas, y se apaga.' },
    // R4 del roadmap de profundidad: lo que gastan los conjuros gordos (`rules/grimoire.js`).
    'Ámbar': { type: 'gear', category: 'gear', subcategory: 'component', weight: 0.1, consumable: true, uses: 1, description: 'Se gasta al lanzar Relámpago.' },
    'Mirra': { type: 'gear', category: 'gear', subcategory: 'component', weight: 0.1, consumable: true, uses: 1, description: 'Se gasta en la Oración de curación y en Volver de la orilla.' },
    'Azufre': { type: 'gear', category: 'gear', subcategory: 'component', weight: 0.2, consumable: true, uses: 1, description: 'Se gasta en la Bola de fuego y en el Muro de fuego.' },
    'Polvo de hueso': { type: 'gear', category: 'gear', subcategory: 'component', weight: 0.1, consumable: true, uses: 1, description: 'Se gasta al Hablar con los muertos.' },
    'Plumas negras': { type: 'gear', category: 'gear', subcategory: 'component', weight: 0.1, consumable: true, uses: 1, description: 'Se gastan en la Invisibilidad.' },
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
export function describeLootItem(name, rarity = '', catalogue = []) {
    const clean = String(name ?? '').trim();
    const declared = worldSpec(clean, catalogue) ?? CATALOGUE[clean] ?? FALLBACK;
    return { name: clean || 'Objeto', rarity: String(rarity ?? ''), ...declared };
}

/**
 * Lo que un objeto escrito por el autor de la campana es, con la forma que pide el
 * inventario.
 *
 * El catalogo del mundo gana a esta tabla: si alguien llama a su espada igual que una de
 * aqui, la suya es la que vale. Es su mundo.
 *
 * @param {string} name
 * @param {any[]} catalogue Los objetos del mundo, tal y como los guarda el editor.
 * @returns {Partial<LootItemSpec>|null}
 */
function worldSpec(name, catalogue) {
    const wanted = String(name ?? '').trim().toLowerCase();
    if (!wanted) return null;

    const found = (Array.isArray(catalogue) ? catalogue : [])
        .find(item => String(item?.name ?? '').trim().toLowerCase() === wanted);
    if (!found) return null;

    const type = ['weapon', 'armor', 'gear'].includes(String(found.type)) ? String(found.type) : 'gear';
    const category = type === 'weapon' ? 'weapon' : (type === 'armor' ? 'armor' : 'gear');

    /** @type {any} */
    const spec = {
        type,
        category,
        subcategory: String(found.subcategory ?? '').trim() || 'generic',
        weight: Number(found.weight) || 0,
    };
    if (String(found.damageDice ?? '').trim()) spec.damageDice = String(found.damageDice).trim();
    if (String(found.damageType ?? '').trim()) spec.damageType = String(found.damageType).trim();
    if (String(found.slot ?? '').trim()) spec.slot = String(found.slot).trim().toLowerCase();
    if (String(found.description ?? '').trim()) spec.description = String(found.description).trim();
    return spec;
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
