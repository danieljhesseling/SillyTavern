/**
 * D&D Character System Module
 * Central module for D&D mechanics: stats, items, equipment, relationships, memories.
 */

/**
 * @typedef {Object} DndItemEffect
 * @property {string} stat - The stat to modify (e.g. 'armorClass', 'strength', 'dexterity', etc.)
 * @property {number} modifier - The modifier value (positive or negative)
 */

/**
 * @typedef {Object} DndItem
 * @property {string} id
 * @property {string} name
 * @property {'weapon'|'armor'|'gear'} type
 * @property {'weapon'|'armor'|'gear'|'magic'|'mount_vehicle_trade'} [category]
 * @property {string} [subcategory]
 * @property {'weapon'|'armor'|'gear'|''} [legacyType]
 * @property {string|null} slot - Equipment slot or null if not equippable
 * @property {string} image - URL or empty string
 * @property {number} weight
 * @property {DndItemEffect[]} effects
 * @property {string} description
 * @property {string} [rarity]
 * @property {string} [damageType]
 * @property {string} [damageDice]
 * @property {string} [baseDamage]
 * @property {string} [properties]
 * @property {number|null} [range]
 * @property {number|null} [longRange]
 * @property {number|null} [meleeRange]
 * @property {string} [versatileDamage]
 * @property {number|null} [baseArmorClass]
 * @property {number|null} [armorClass]
 * @property {'full'|'max_2'|'none'} [armorDexMode]
 * @property {number|null} [dexCap]
 * @property {number|null} [strengthRequirement]
 * @property {boolean} [stealthDisadvantage]
 * @property {string} [donTime]
 * @property {string} [doffTime]
 * @property {boolean} [consumable]
 * @property {number|null} [uses]
 * @property {number|null} [maxUses]
 * @property {string} [recharge]
 * @property {boolean} [attunement]
 * @property {boolean} [cursed]
 * @property {boolean} [magical]
 * @property {boolean} [adamantine]
 * @property {boolean} [mithral]
 * @property {boolean} [resistanceEnabled]
 * @property {boolean} [finesse]
 * @property {boolean} [heavy]
 * @property {boolean} [light]
 * @property {boolean} [reach]
 * @property {boolean} [thrown]
 * @property {boolean} [twoHanded]
 * @property {boolean} [versatile]
 * @property {boolean} [ammunition]
 * @property {boolean} [loading]
 * @property {string} [focusType]
 * @property {string} [toolType]
 * @property {number|null} [capacity]
 * @property {string} [capacityUnit]
 * @property {number|null} [vehicleCrew]
 * @property {number|null} [vehicleDamageThreshold]
 * @property {number|null} [costGp]
 * @property {number|null} [magicalBonus]
 * @property {string[]} [resistanceTypes]
 * @property {string} [notes]
 * @property {string} [linkedSpell]
 * @property {number|null} [spellLevel]
 * @property {number|null} [saveDC]
 * @property {number|null} [spellAttackBonus]
 * @property {number|null} [storageWeightLimit]
 * @property {number|null} [storageVolumeLimit]
 * @property {number|null} [brightLightRadius]
 * @property {number|null} [dimLightRadius]
 * @property {number|null} [capacityWeight]
 * @property {number|null} [capacityVolume]
 * @property {number|null} [lightBright]
 * @property {number|null} [lightDim]
 * @property {number|null} [stackSize]
 * @property {boolean} [stackable]
 * @property {boolean} [toolProficiency]
 * @property {string} [linkedAbility]
 * @property {boolean} [emitsLight]
 * @property {string} [containerItemId]
 */

/**
 * @typedef {Object} DndRelationship
 * @property {string} characterName
 * @property {string} characterAvatar
 * @property {'ally'|'rival'|'friend'|'enemy'|'neutral'|'romantic'|'family'} type
 * @property {string} description
 * @property {string} lastInteraction
 */

/**
 * @typedef {Object} DndMemory
 * @property {string} id
 * @property {string} text
 * @property {string} date
 * @property {string} worldInfoEntryId
 * @property {string} worldInfoBook
 * @property {string[]} tags
 */

/**
 * @typedef {Object} MapPosition
 * @property {string} locationName - Name of the location the character is at
 * @property {number} gridX - Grid X coordinate within the location
 * @property {number} gridY - Grid Y coordinate within the location
 */

/**
 * @typedef {Object} EnemyTemplate
 * @property {string} id
 * @property {string} name
 * @property {string} avatar - Image URL or empty string
 * @property {number} hp
 * @property {number} maxHp
 * @property {number} armorClass
 * @property {number} strength
 * @property {number} dexterity
 * @property {number} constitution
 * @property {number} intelligence
 * @property {number} wisdom
 * @property {number} charisma
 * @property {number} speed
 * @property {number} cr - Challenge rating
 */

/**
 * @typedef {Object} EnemyInstance
 * @property {string} instanceId - Unique per-encounter instance id
 * @property {string} templateId - References EnemyTemplate.id
 * @property {string} name - Display name (may include index, e.g. "Goblin 2")
 * @property {string} avatar
 * @property {number} currentHp
 * @property {number} maxHp
 * @property {number} armorClass
 * @property {number} strength
 * @property {number} dexterity
 * @property {number} constitution
 * @property {number} intelligence
 * @property {number} wisdom
 * @property {number} charisma
 * @property {number} speed
 * @property {number} cr
 * @property {number} gridX
 * @property {number} gridY
 */

/**
 * @typedef {Object} TurnEntry
 * @property {string} id - PartyMember id or EnemyInstance instanceId
 * @property {string} name
 * @property {number} initiative
 * @property {boolean} isEnemy
 */

/**
 * @typedef {Object} CombatEncounter
 * @property {boolean} active
 * @property {EnemyInstance[]} enemies
 * @property {TurnEntry[]} turnOrder
 * @property {number} currentTurnIndex
 */

/**
 * @typedef {Object} DndCharacterData
 * @property {number} strength
 * @property {number} dexterity
 * @property {number} constitution
 * @property {number} intelligence
 * @property {number} wisdom
 * @property {number} charisma
 * @property {number} armorClass
 * @property {number} speed
 * @property {DndItem[]} items
 * @property {Object<string, string|null>} equippedItems - slot name → item id or null
 * @property {DndRelationship[]} relationships
 * @property {DndMemory[]} memories
 * @property {MapPosition} mapPosition - Character's position on the world map grid
 */

/** Equipment slot constants */
export const EQUIPMENT_SLOTS = {
    HEAD: 'head',
    BODY: 'body',
    HANDS: 'hands',
    WEAPON: 'weapon',
    SHIELD: 'shield',
    RING: 'ring',
    FEET: 'feet',
};

/** Slot display info */
export const SLOT_INFO = {
    [EQUIPMENT_SLOTS.HEAD]: { label: 'Head', icon: 'fa-hat-wizard' },
    [EQUIPMENT_SLOTS.BODY]: { label: 'Body', icon: 'fa-shirt' },
    [EQUIPMENT_SLOTS.HANDS]: { label: 'Hands', icon: 'fa-hand' },
    [EQUIPMENT_SLOTS.WEAPON]: { label: 'Weapon', icon: 'fa-sword' },
    [EQUIPMENT_SLOTS.SHIELD]: { label: 'Shield', icon: 'fa-shield-halved' },
    [EQUIPMENT_SLOTS.RING]: { label: 'Ring', icon: 'fa-ring' },
    [EQUIPMENT_SLOTS.FEET]: { label: 'Feet', icon: 'fa-shoe-prints' },
};

export const RELATIONSHIP_TYPES = ['ally', 'rival', 'friend', 'enemy', 'neutral', 'romantic', 'family'];

export const ITEM_TYPES = ['weapon', 'armor', 'gear'];

export const ITEM_CATEGORIES = ['weapon', 'armor', 'gear', 'magic', 'mount_vehicle_trade'];

export const ITEM_CATEGORY_OPTIONS = [
    ['weapon', 'Weapons'],
    ['armor', 'Armor & Shields'],
    ['gear', 'Adventuring Gear'],
    ['magic', 'Magic Items'],
    ['mount_vehicle_trade', 'Mounts, Vehicles & Trade'],
];

export const ITEM_SUBCATEGORY_OPTIONS = {
    weapon: [
        ['generic', 'Generic Weapon'],
        ['simple_melee', 'Simple (Melee)'],
        ['simple_ranged', 'Simple (Ranged)'],
        ['martial_melee', 'Martial (Melee)'],
        ['martial_ranged', 'Martial (Ranged)'],
    ],
    armor: [
        ['generic', 'Generic Armor'],
        ['light_armor', 'Light Armor'],
        ['medium_armor', 'Medium Armor'],
        ['heavy_armor', 'Heavy Armor'],
        ['shield', 'Shield'],
    ],
    gear: [
        ['generic', 'Generic Gear'],
        ['basic_consumable', 'Basic Consumable'],
        ['exploration_tool', 'Exploration Tool'],
        ['magic_focus', 'Magical Focus'],
        ['artisan_tool', 'Artisan Tool'],
        ['container', 'Container'],
    ],
    magic: [
        ['generic', 'Generic Magic Item'],
        ['potion_oil', 'Potions & Oils'],
        ['scroll', 'Scrolls'],
        ['magic_weapon_armor', 'Magic Weapon / Armor'],
        ['ring_wand_staff', 'Rings, Wands & Staves'],
        ['wondrous', 'Wondrous Item'],
    ],
    mount_vehicle_trade: [
        ['generic', 'Generic Entry'],
        ['mount', 'Mount'],
        ['vehicle', 'Vehicle'],
        ['trade_good', 'Trade Good'],
    ],
};

export const ITEM_SUBCATEGORY_META = {
    generic: { label: 'Generic', primaryType: 'gear', suggestedSlot: null },
    simple_melee: { label: 'Simple (Melee)', primaryType: 'weapon', suggestedSlot: EQUIPMENT_SLOTS.WEAPON, weapon: true, damage: true, range: false, properties: true },
    simple_ranged: { label: 'Simple (Ranged)', primaryType: 'weapon', suggestedSlot: EQUIPMENT_SLOTS.WEAPON, weapon: true, damage: true, range: true, properties: true },
    martial_melee: { label: 'Martial (Melee)', primaryType: 'weapon', suggestedSlot: EQUIPMENT_SLOTS.WEAPON, weapon: true, damage: true, range: false, properties: true },
    martial_ranged: { label: 'Martial (Ranged)', primaryType: 'weapon', suggestedSlot: EQUIPMENT_SLOTS.WEAPON, weapon: true, damage: true, range: true, properties: true },
    light_armor: { label: 'Light Armor', primaryType: 'armor', suggestedSlot: EQUIPMENT_SLOTS.BODY, armor: true, armorDexMode: 'full', stealth: false },
    medium_armor: { label: 'Medium Armor', primaryType: 'armor', suggestedSlot: EQUIPMENT_SLOTS.BODY, armor: true, armorDexMode: 'max_2', stealth: true },
    heavy_armor: { label: 'Heavy Armor', primaryType: 'armor', suggestedSlot: EQUIPMENT_SLOTS.BODY, armor: true, armorDexMode: 'none', stealth: true, strengthRequirement: true },
    shield: { label: 'Shield', primaryType: 'armor', suggestedSlot: EQUIPMENT_SLOTS.SHIELD, armor: true, armorDexMode: 'none', shield: true },
    basic_consumable: { label: 'Basic Consumable', primaryType: 'gear', suggestedSlot: null, gear: true, consumable: true, cost: true, autoConsumable: true, hideCharges: true, showStack: true },
    exploration_tool: { label: 'Exploration Tool', primaryType: 'gear', suggestedSlot: EQUIPMENT_SLOTS.HANDS, gear: true, tool: true, cost: true },
    magic_focus: { label: 'Magical Focus', primaryType: 'gear', suggestedSlot: EQUIPMENT_SLOTS.HANDS, gear: true, focus: true, cost: true, showCharges: true, showSpellcasting: true },
    artisan_tool: { label: 'Artisan Tool', primaryType: 'gear', suggestedSlot: EQUIPMENT_SLOTS.HANDS, gear: true, tool: true, cost: true },
    container: { label: 'Container', primaryType: 'gear', suggestedSlot: 'container', gear: true, capacity: true, cost: true },
    potion_oil: { label: 'Potions & Oils', primaryType: 'gear', suggestedSlot: null, magic: true, rarity: true, consumable: true, uses: false, attunement: false, cost: true, autoConsumable: true, hideAttunement: true, hideCharges: true, showLinkedSpell: false, showSpellcasting: false, showWeaponMath: false, showArmorMath: false },
    scroll: { label: 'Scrolls', primaryType: 'gear', suggestedSlot: null, magic: true, rarity: true, consumable: true, uses: false, attunement: false, cost: true, autoConsumable: true, hideAttunement: true, hideCharges: true, showLinkedSpell: true, showSpellcasting: false, showWeaponMath: false, showArmorMath: false },
    magic_weapon_armor: { label: 'Magic Weapon / Armor', primaryType: 'gear', suggestedSlot: EQUIPMENT_SLOTS.WEAPON, magic: true, rarity: true, damage: true, armor: true, magicalBonus: true, attunement: true, autoConsumable: false, hideAttunement: false, hideCharges: false, showLinkedSpell: false, showSpellcasting: false, showWeaponMath: true, showArmorMath: true },
    ring_wand_staff: { label: 'Rings, Wands & Staves', primaryType: 'gear', suggestedSlot: EQUIPMENT_SLOTS.RING, magic: true, rarity: true, uses: true, magicalBonus: true, attunement: true, autoConsumable: false, hideAttunement: false, hideCharges: false, showLinkedSpell: false, showSpellcasting: true, showWeaponMath: false, showArmorMath: false },
    wondrous: { label: 'Wondrous Item', primaryType: 'gear', suggestedSlot: null, magic: true, rarity: true, uses: true, attunement: true, cost: true, autoConsumable: false, hideAttunement: false, hideCharges: false, showLinkedSpell: false, showSpellcasting: true, showWeaponMath: false, showArmorMath: false },
    mount: { label: 'Mount', primaryType: 'gear', suggestedSlot: null, transport: true, capacity: true, cost: true },
    vehicle: { label: 'Vehicle', primaryType: 'gear', suggestedSlot: null, transport: true, capacity: true, vehicle: true, cost: true },
    trade_good: { label: 'Trade Good', primaryType: 'gear', suggestedSlot: null, trade: true, cost: true },
};

export const ITEM_RARITY_OPTIONS = ['', 'Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact'];
export const ITEM_RECHARGE_OPTIONS = ['', 'At Dawn', 'At Dusk', 'Short Rest', 'Long Rest', 'Manual'];
export const ITEM_CAPACITY_UNITS = ['', 'lb', 'cu ft', 'slots', 'creatures', 'charges'];
export const ITEM_FOCUS_TYPES = ['', 'Arcane', 'Divine', 'Druidic'];
export const ITEM_ARMOR_DEX_MODE_OPTIONS = [
    ['full', 'Full'],
    ['max_2', 'Max +2'],
    ['none', 'None'],
];
export const ITEM_WEAPON_DAMAGE_TYPE_OPTIONS = [
    ['', 'None'],
    ['Slashing', 'Cortante'],
    ['Piercing', 'Perforante'],
    ['Bludgeoning', 'Contundente'],
];

export const ITEM_ARMOR_RESISTANCE_OPTIONS = [
    'Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning',
    'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder',
    'Magical Bludgeoning', 'Magical Piercing', 'Magical Slashing',
];

export const ITEM_MAGIC_BONUS_OPTIONS = [0, 1, 2, 3].map(value => [String(value), value > 0 ? `+${value}` : `${value}`]);

/** @type {{ key: keyof DndItem, label: string, subcategories: string[] }[]} */
export const ITEM_WEAPON_FLAG_DEFINITIONS = [
    { key: 'finesse', label: 'Finesse (Sutil)', subcategories: ['simple_melee', 'martial_melee'] },
    { key: 'heavy', label: 'Heavy (Pesada)', subcategories: ['simple_melee', 'martial_melee'] },
    { key: 'light', label: 'Light (Ligera)', subcategories: ['simple_melee', 'martial_melee'] },
    { key: 'reach', label: 'Reach (Alcance)', subcategories: ['martial_melee'] },
    { key: 'thrown', label: 'Thrown (Lanzable)', subcategories: ['generic', 'simple_melee', 'simple_ranged', 'martial_melee', 'martial_ranged'] },
    { key: 'twoHanded', label: 'Two-Handed (Dos Manos)', subcategories: ['simple_melee', 'martial_melee'] },
    { key: 'versatile', label: 'Versatile (Versátil)', subcategories: ['simple_melee', 'martial_melee'] },
    { key: 'ammunition', label: 'Ammunition (Munición)', subcategories: ['simple_ranged', 'martial_ranged'] },
    { key: 'loading', label: 'Loading (Carga)', subcategories: ['simple_ranged', 'martial_ranged'] },
    { key: 'magical', label: 'Magical (Mágico)', subcategories: ['generic', 'simple_melee', 'simple_ranged', 'martial_melee', 'martial_ranged', 'magic_weapon_armor'] },
    { key: 'cursed', label: 'Cursed (Maldito)', subcategories: ['generic', 'simple_melee', 'simple_ranged', 'martial_melee', 'martial_ranged', 'magic_weapon_armor'] },
];

/** @type {{ key: keyof DndItem, label: string, subcategories: string[] }[]} */
export const ITEM_ARMOR_FLAG_DEFINITIONS = [
    { key: 'stealthDisadvantage', label: 'Stealth Disadvantage (Desventaja)', subcategories: ['generic', 'light_armor', 'medium_armor', 'heavy_armor'] },
    { key: 'magical', label: 'Magical (Mágico)', subcategories: ['generic', 'light_armor', 'medium_armor', 'heavy_armor', 'shield'] },
    { key: 'cursed', label: 'Cursed (Maldito)', subcategories: ['generic', 'light_armor', 'medium_armor', 'heavy_armor', 'shield'] },
    { key: 'attunement', label: 'Attunement Required (Sintonización)', subcategories: ['generic', 'heavy_armor', 'shield'] },
    { key: 'adamantine', label: 'Adamantine (Adamantina)', subcategories: ['generic', 'light_armor', 'medium_armor', 'heavy_armor', 'shield'] },
    { key: 'mithral', label: 'Mithral (Mitral)', subcategories: ['generic', 'light_armor', 'medium_armor', 'heavy_armor', 'shield'] },
    { key: 'resistanceEnabled', label: 'Resistances (Resistencias)', subcategories: ['generic', 'light_armor', 'medium_armor', 'heavy_armor', 'shield'] },
];

/** @type {{ key: keyof DndItem, label: string, subcategories: string[] }[]} */
export const ITEM_GEAR_FLAG_DEFINITIONS = [
    { key: 'stackable', label: 'Stackable', subcategories: ['basic_consumable', 'exploration_tool', 'magic_focus', 'artisan_tool', 'container'] },
    { key: 'toolProficiency', label: 'Tool Proficiency Required', subcategories: ['exploration_tool', 'artisan_tool'] },
    { key: 'attunement', label: 'Attunement Required (Sintonizacion)', subcategories: ['magic_focus'] },
];

export const ITEM_LINKED_ABILITY_OPTIONS = [
    ['', 'None'],
    ['strength', 'Strength'],
    ['dexterity', 'Dexterity'],
    ['constitution', 'Constitution'],
    ['intelligence', 'Intelligence'],
    ['wisdom', 'Wisdom'],
    ['charisma', 'Charisma'],
    ['sleight_of_hand', 'Dexterity (Sleight of Hand)'],
];

const ITEM_DEFAULTS = {
    id: '',
    name: 'New Item',
    type: 'gear',
    category: 'gear',
    subcategory: 'generic',
    legacyType: '',
    slot: null,
    image: '',
    weight: 0,
    effects: [],
    description: '',
    rarity: '',
    damageType: '',
    damageDice: '',
    baseDamage: '',
    properties: '',
    range: null,
    longRange: null,
    meleeRange: 5,
    versatileDamage: '',
    baseArmorClass: null,
    armorClass: null,
    armorDexMode: 'full',
    dexCap: null,
    strengthRequirement: null,
    stealthDisadvantage: false,
    donTime: '',
    doffTime: '',
    consumable: false,
    uses: null,
    maxUses: null,
    recharge: '',
    attunement: false,
    cursed: false,
    magical: false,
    adamantine: false,
    mithral: false,
    resistanceEnabled: false,
    finesse: false,
    heavy: false,
    light: false,
    reach: false,
    thrown: false,
    twoHanded: false,
    versatile: false,
    ammunition: false,
    loading: false,
    focusType: '',
    toolType: '',
    capacity: null,
    capacityUnit: '',
    vehicleCrew: null,
    vehicleDamageThreshold: null,
    costGp: null,
    magicalBonus: null,
    resistanceTypes: [],
    notes: '',
    linkedSpell: '',
    spellLevel: null,
    saveDC: null,
    spellAttackBonus: null,
    storageWeightLimit: null,
    storageVolumeLimit: null,
    brightLightRadius: null,
    dimLightRadius: null,
    capacityWeight: null,
    capacityVolume: null,
    lightBright: null,
    lightDim: null,
    stackSize: null,
    stackable: false,
    toolProficiency: false,
    linkedAbility: '',
    emitsLight: false,
    containerItemId: '',
};

/** D&D 5e Alignments */
export const ALIGNMENTS = [
    'Lawful Good', 'Neutral Good', 'Chaotic Good',
    'Lawful Neutral', 'True Neutral', 'Chaotic Neutral',
    'Lawful Evil', 'Neutral Evil', 'Chaotic Evil',
];

/** D&D 5e Standard Conditions */
export const CONDITIONS = [
    'Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled',
    'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified',
    'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious',
    'Exhaustion',
];

/** Stats that can be modified by equipment */
export const MODIFIABLE_STATS = [
    'armorClass', 'strength', 'dexterity', 'constitution',
    'intelligence', 'wisdom', 'charisma', 'speed', 'maxHp',
];

export function getItemCategoryOptions() {
    return [...ITEM_CATEGORY_OPTIONS];
}

/**
 * @param {string} category
 * @returns {string[][]}
 */
export function getItemSubcategoryOptions(category) {
    return [...(ITEM_SUBCATEGORY_OPTIONS[/** @type {keyof typeof ITEM_SUBCATEGORY_OPTIONS} */ (category)] || ITEM_SUBCATEGORY_OPTIONS.gear)];
}

/**
 * @param {string} category
 * @returns {string}
 */
export function getItemCategoryLabel(category) {
    return ITEM_CATEGORY_OPTIONS.find(([value]) => value === category)?.[1] || 'Item';
}

/**
 * @param {string} subcategory
 * @returns {string}
 */
export function getItemSubcategoryLabel(subcategory) {
    for (const options of Object.values(ITEM_SUBCATEGORY_OPTIONS)) {
        const match = options.find(([value]) => value === subcategory);
        if (match) return match[1];
    }
    return 'Generic';
}

/**
 * @param {string} subcategory
 * @returns {any}
 */
export function getItemSubcategoryMeta(subcategory) {
    return ITEM_SUBCATEGORY_META[/** @type {keyof typeof ITEM_SUBCATEGORY_META} */ (subcategory)] || ITEM_SUBCATEGORY_META.generic;
}

/**
 * @param {string} subcategory
 * @returns {boolean}
 */
export function isWeaponLikeSubcategory(subcategory) {
    return ['generic', 'simple_melee', 'simple_ranged', 'martial_melee', 'martial_ranged', 'magic_weapon_armor'].includes(subcategory);
}

/**
 * @param {string} subcategory
 * @returns {boolean}
 */
export function isRangedWeaponSubcategory(subcategory) {
    return ['simple_ranged', 'martial_ranged'].includes(subcategory);
}

/**
 * @param {string} subcategory
 * @returns {boolean}
 */
export function isMeleeWeaponSubcategory(subcategory) {
    return ['generic', 'simple_melee', 'martial_melee'].includes(subcategory);
}

/**
 * @param {string} subcategory
 * @returns {boolean}
 */
export function isArmorSubcategory(subcategory) {
    return ['light_armor', 'medium_armor', 'heavy_armor', 'shield'].includes(subcategory);
}

/**
 * @param {string} category
 * @param {string} subcategory
 * @returns {boolean}
 */
export function isArmorLikeItem(category, subcategory) {
    return category === 'armor' && ['generic', 'light_armor', 'medium_armor', 'heavy_armor', 'shield'].includes(subcategory);
}

/**
 * @param {string} subcategory
 * @returns {'full'|'max_2'|'none'}
 */
export function getImplicitArmorDexMode(subcategory) {
    if (subcategory === 'medium_armor') return 'max_2';
    if (subcategory === 'heavy_armor' || subcategory === 'shield') return 'none';
    return 'full';
}

/**
 * @param {string} subcategory
 * @param {string | null | undefined} mode
 * @returns {'full'|'max_2'|'none'}
 */
export function getEffectiveArmorDexMode(subcategory, mode) {
    if (subcategory === 'generic') {
        return mode === 'max_2' || mode === 'none' ? mode : 'full';
    }

    return getImplicitArmorDexMode(subcategory);
}

/**
 * @param {'full'|'max_2'|'none'} mode
 * @returns {string}
 */
export function getArmorDexModeLabel(mode) {
    return ITEM_ARMOR_DEX_MODE_OPTIONS.find(([value]) => value === mode)?.[1] || 'Full';
}

/**
 * @param {string} subcategory
 * @param {string | null | undefined} mode
 * @returns {string}
 */
export function getArmorDexRuleLabel(subcategory, mode) {
    const effectiveMode = getEffectiveArmorDexMode(subcategory, mode);
    if (subcategory === 'shield') return 'Lógica: Base CA fija de escudo; DEX no participa';
    if (effectiveMode === 'max_2') return 'Lógica: Base CA + Destreza Máx +2';
    if (effectiveMode === 'none') return 'Lógica: Base CA solamente; DEX no aplica';
    return 'Lógica: Base CA + Destreza completa';
}

/**
 * @param {'full'|'max_2'|'none'} mode
 * @returns {number|null}
 */
export function getArmorDexCapForMode(mode) {
    if (mode === 'max_2') return 2;
    if (mode === 'none') return 0;
    return null;
}

/**
 * @param {string} subcategory
 * @returns {any[]}
 */
export function getWeaponFlagsForSubcategory(subcategory) {
    return ITEM_WEAPON_FLAG_DEFINITIONS.filter(flag => flag.subcategories.includes(subcategory));
}

/**
 * @param {string} subcategory
 * @returns {any[]}
 */
export function getArmorFlagsForSubcategory(subcategory) {
    return ITEM_ARMOR_FLAG_DEFINITIONS.filter(flag => flag.subcategories.includes(subcategory));
}

/**
 * @param {Partial<DndItem>|any} item
 * @returns {string[]}
 */
export function getEnabledWeaponFlagLabels(item) {
    const normalized = normalizeItem(item);
    return getWeaponFlagsForSubcategory(normalized.subcategory || 'generic')
        .filter(flag => Boolean(normalized[/** @type {keyof DndItem} */ (flag.key)]))
        .map(flag => flag.label);
}

/**
 * @param {Partial<DndItem>|any} item
 * @returns {string[]}
 */
export function getEnabledArmorFlagLabels(item) {
    const normalized = normalizeItem(item);
    return getArmorFlagsForSubcategory(normalized.subcategory || 'generic')
        .filter(flag => Boolean(normalized[/** @type {keyof DndItem} */ (flag.key)]))
        .map(flag => flag.label);
}

/**
 * Returns the behavior flags for a given magic subcategory.
 * @param {string} subcategory
 * @returns {{ autoConsumable: boolean, hideAttunement: boolean, hideCharges: boolean, showLinkedSpell: boolean, showSpellcasting: boolean, showWeaponMath: boolean, showArmorMath: boolean }}
 */
export function getMagicSubtypeFlags(subcategory) {
    const meta = /** @type {any} */ (ITEM_SUBCATEGORY_META[/** @type {keyof typeof ITEM_SUBCATEGORY_META} */ (subcategory)] || ITEM_SUBCATEGORY_META.generic);
    return {
        autoConsumable: !!meta.autoConsumable,
        hideAttunement: !!meta.hideAttunement,
        hideCharges: !!meta.hideCharges,
        showLinkedSpell: !!meta.showLinkedSpell,
        showSpellcasting: !!meta.showSpellcasting,
        showWeaponMath: !!meta.showWeaponMath,
        showArmorMath: !!meta.showArmorMath,
    };
}

/**
 * Returns true if the subcategory is a magic item type.
 * @param {string} category
 * @returns {boolean}
 */
export function isMagicCategory(category) {
    return category === 'magic';
}

/**
 * @param {string} category
 * @param {string} [subcategory='generic']
 * @returns {'weapon'|'armor'|'gear'}
 */
export function getPrimaryItemType(category, subcategory = 'generic') {
    if (category === 'weapon') return 'weapon';
    if (category === 'armor') return 'armor';
    return /** @type {'weapon'|'armor'|'gear'} */ (getItemSubcategoryMeta(subcategory).primaryType || 'gear');
}

/**
 * @param {string} category
 * @param {string} [subcategory='generic']
 * @returns {string|null}
 */
export function getSuggestedSlotForItem(category, subcategory = 'generic') {
    return getItemSubcategoryMeta(subcategory).suggestedSlot ?? null;
}

/**
 * @param {any} value
 * @returns {number|null}
 */
function normalizeNullableNumber(value) {
    if (value === '' || value == null) return null;
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
}

/**
 * @param {any} value
 * @returns {boolean}
 */
function normalizeBoolean(value) {
    return value === true || value === 'true' || value === 1 || value === '1';
}

/**
 * @param {any} value
 * @returns {string[]}
 */
function normalizeStringArray(value) {
    if (Array.isArray(value)) return value.map(entry => String(entry || '').trim()).filter(Boolean);
    if (typeof value === 'string') return value.split(',').map(entry => entry.trim()).filter(Boolean);
    return [];
}

/**
 * @param {Partial<DndItem>|any} item
 * @returns {DndItem}
 */
export function normalizeItem(item) {
    const source = item && typeof item === 'object' ? item : {};
    let category = String(source.category || '').trim();
    const originalType = String(source.type || '').trim();
    const legacyType = ITEM_TYPES.includes(originalType) ? originalType : '';

    if (!ITEM_CATEGORIES.includes(category)) {
        if (legacyType === 'weapon') category = 'weapon';
        else if (legacyType === 'armor') category = 'armor';
        else category = 'gear';
    }

    let subcategory = String(source.subcategory || '').trim();
    const subcategoryValues = getItemSubcategoryOptions(category).map(([value]) => value);
    if (!subcategoryValues.includes(subcategory)) {
        subcategory = 'generic';
    }

    const normalized = {
        ...ITEM_DEFAULTS,
        ...source,
        id: String(source.id || ITEM_DEFAULTS.id || generateItemId()),
        name: String(source.name || ITEM_DEFAULTS.name),
        category,
        subcategory,
        legacyType: String(source.legacyType || legacyType),
        type: getPrimaryItemType(category, subcategory),
        slot: source.slot === '' ? null : (source.slot ?? getSuggestedSlotForItem(category, subcategory)),
        image: String(source.image || ''),
        weight: Number(source.weight) || 0,
        effects: Array.isArray(source.effects) ? source.effects : [],
        description: String(source.description || ''),
        rarity: String(source.rarity || ''),
        damageType: String(source.damageType || ''),
        damageDice: String(source.damageDice || source.baseDamage || ''),
        baseDamage: String(source.baseDamage || ''),
        properties: String(source.properties || ''),
        range: normalizeNullableNumber(source.range),
        longRange: normalizeNullableNumber(source.longRange),
        meleeRange: normalizeNullableNumber(source.meleeRange) ?? 5,
        versatileDamage: String(source.versatileDamage || ''),
        baseArmorClass: normalizeNullableNumber(source.baseArmorClass ?? source.armorClass),
        armorClass: normalizeNullableNumber(source.armorClass ?? source.baseArmorClass),
        armorDexMode: getEffectiveArmorDexMode(subcategory, String(source.armorDexMode || 'full')),
        dexCap: normalizeNullableNumber(source.dexCap),
        strengthRequirement: normalizeNullableNumber(source.strengthRequirement),
        stealthDisadvantage: normalizeBoolean(source.stealthDisadvantage),
        donTime: String(source.donTime || ''),
        doffTime: String(source.doffTime || ''),
        consumable: normalizeBoolean(source.consumable),
        uses: normalizeNullableNumber(source.uses),
        maxUses: normalizeNullableNumber(source.maxUses),
        recharge: String(source.recharge || ''),
        attunement: normalizeBoolean(source.attunement),
        cursed: normalizeBoolean(source.cursed),
        magical: normalizeBoolean(source.magical) || (normalizeNullableNumber(source.magicalBonus) ?? 0) > 0,
        adamantine: normalizeBoolean(source.adamantine),
        mithral: normalizeBoolean(source.mithral),
        resistanceEnabled: normalizeBoolean(source.resistanceEnabled),
        finesse: normalizeBoolean(source.finesse),
        heavy: normalizeBoolean(source.heavy),
        light: normalizeBoolean(source.light),
        reach: normalizeBoolean(source.reach),
        thrown: normalizeBoolean(source.thrown),
        twoHanded: normalizeBoolean(source.twoHanded),
        versatile: normalizeBoolean(source.versatile),
        ammunition: normalizeBoolean(source.ammunition),
        loading: normalizeBoolean(source.loading),
        focusType: String(source.focusType || ''),
        toolType: String(source.toolType || ''),
        capacity: normalizeNullableNumber(source.capacity),
        capacityUnit: String(source.capacityUnit || ''),
        vehicleCrew: normalizeNullableNumber(source.vehicleCrew),
        vehicleDamageThreshold: normalizeNullableNumber(source.vehicleDamageThreshold),
        costGp: normalizeNullableNumber(source.costGp),
        magicalBonus: normalizeNullableNumber(source.magicalBonus),
        resistanceTypes: normalizeStringArray(source.resistanceTypes),
        notes: String(source.notes || ''),
        linkedSpell: String(source.linkedSpell || ''),
        spellLevel: normalizeNullableNumber(source.spellLevel),
        saveDC: normalizeNullableNumber(source.saveDC),
        spellAttackBonus: normalizeNullableNumber(source.spellAttackBonus),
        storageWeightLimit: normalizeNullableNumber(source.storageWeightLimit),
        storageVolumeLimit: normalizeNullableNumber(source.storageVolumeLimit),
        brightLightRadius: normalizeNullableNumber(source.brightLightRadius),
        dimLightRadius: normalizeNullableNumber(source.dimLightRadius),
        capacityWeight: normalizeNullableNumber(source.capacityWeight),
        capacityVolume: normalizeNullableNumber(source.capacityVolume),
        lightBright: normalizeNullableNumber(source.lightBright),
        lightDim: normalizeNullableNumber(source.lightDim),
        stackSize: normalizeNullableNumber(source.stackSize),
        stackable: normalizeBoolean(source.stackable),
        toolProficiency: normalizeBoolean(source.toolProficiency),
        linkedAbility: String(source.linkedAbility || ''),
        emitsLight: normalizeBoolean(source.emitsLight),
        containerItemId: String(source.containerItemId || ''),
    };

    if (isArmorLikeItem(normalized.category || 'gear', normalized.subcategory || 'generic')) {
        normalized.armorDexMode = getEffectiveArmorDexMode(normalized.subcategory || 'generic', normalized.armorDexMode);
        normalized.dexCap = normalizeNullableNumber(source.dexCap) ?? getArmorDexCapForMode(normalized.armorDexMode);
        normalized.armorClass = normalized.baseArmorClass;
        normalized.resistanceEnabled = normalized.resistanceEnabled || normalized.resistanceTypes.length > 0;
    }

    if (!Object.values(EQUIPMENT_SLOTS).includes(normalized.slot)) {
        normalized.slot = getSuggestedSlotForItem(normalized.category, normalized.subcategory);
    }

    // Enforce magic subtype behavior: auto-consumable, hide attunement, clear charges
    if (normalized.category === 'magic') {
        const magicFlags = getMagicSubtypeFlags(normalized.subcategory || 'generic');
        if (magicFlags.autoConsumable) normalized.consumable = true;
        if (magicFlags.hideAttunement) normalized.attunement = false;
        if (magicFlags.hideCharges) {
            normalized.uses = null;
            normalized.maxUses = null;
            normalized.recharge = '';
        }
    }

    if (normalized.subcategory === 'basic_consumable') {
        normalized.consumable = true;
    }

    if (normalized.subcategory !== 'exploration_tool' || !normalized.emitsLight) {
        normalized.lightBright = normalizeNullableNumber(source.lightBright);
        normalized.lightDim = normalizeNullableNumber(source.lightDim);
    }

    if (!normalized.stackable) {
        normalized.stackSize = null;
    }

    return normalized;
}

/**
 * @param {Partial<DndItem>|any} item
 * @returns {string[]}
 */
export function buildItemMetaSummary(item) {
    const normalized = normalizeItem(item);
    const isArmorItem = isArmorLikeItem(normalized.category || 'gear', normalized.subcategory || 'generic');
    const parts = [getItemCategoryLabel(normalized.category || 'gear'), getItemSubcategoryLabel(normalized.subcategory || 'generic')];
    if (normalized.rarity) parts.push(normalized.rarity);
    if (normalized.slot) parts.push(SLOT_INFO[normalized.slot]?.label || normalized.slot);
    if (normalized.damageDice || normalized.baseDamage) parts.push(normalized.damageDice || normalized.baseDamage || '');
    if (normalized.damageType) parts.push(normalized.damageType);
    if (normalized.baseArmorClass != null && isArmorItem) parts.push(`Base CA ${normalized.baseArmorClass}`);
    if (isRangedWeaponSubcategory(normalized.subcategory || '')) parts.push(`${normalized.range || 0}/${normalized.longRange || 0} ft`);
    else if (isMeleeWeaponSubcategory(normalized.subcategory || '')) parts.push(`${(normalized.meleeRange || 5) + (normalized.reach ? 5 : 0)} ft`);
    else if (isArmorItem) parts.push(getArmorDexModeLabel(getEffectiveArmorDexMode(normalized.subcategory || 'generic', normalized.armorDexMode)));
    if (normalized.weight) parts.push(`${normalized.weight} lbs`);
    if (normalized.magicalBonus != null && normalized.magicalBonus !== 0) parts.push(`${normalized.magicalBonus >= 0 ? '+' : ''}${normalized.magicalBonus}`);
    const weaponFlags = getEnabledWeaponFlagLabels(normalized);
    if (weaponFlags.length) parts.push(weaponFlags.join(', '));
    if (normalized.strengthRequirement != null && normalized.strengthRequirement > 0 && isArmorItem) parts.push(`Min STR ${normalized.strengthRequirement}`);
    const armorFlags = getEnabledArmorFlagLabels(normalized)
        .filter(label => label !== 'Resistances (Resistencias)');
    if (armorFlags.length && isArmorItem) parts.push(armorFlags.join(', '));
    if (normalized.resistanceTypes?.length && isArmorItem) parts.push(`Resists ${normalized.resistanceTypes.join(', ')}`);
    // Magic-item metadata
    if (normalized.linkedSpell) {
        parts.push(normalized.spellLevel != null ? `${normalized.linkedSpell} (Lvl ${normalized.spellLevel})` : normalized.linkedSpell);
    }
    if (normalized.saveDC != null) parts.push(`CD ${normalized.saveDC}`);
    if (normalized.spellAttackBonus != null) parts.push(`Atk +${normalized.spellAttackBonus}`);
    if (normalized.maxUses != null && normalized.category === 'magic') parts.push(`${normalized.uses ?? 0}/${normalized.maxUses} cargas`);
    if (normalized.brightLightRadius != null) parts.push(`Luz ${normalized.brightLightRadius}/${normalized.dimLightRadius ?? 0} ft`);
    if (normalized.storageWeightLimit != null) parts.push(`Almacena ${normalized.storageWeightLimit} lb`);
    return parts.filter(Boolean);
}

/**
 * Generate a unique item ID
 * @returns {string}
 */
export function generateItemId() {
    return `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a unique memory ID
 * @returns {string}
 */
export function generateMemoryId() {
    return `mem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a unique enemy template ID
 * @returns {string}
 */
export function generateEnemyId() {
    return `enemy_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a unique enemy instance ID for a combat encounter
 * @returns {string}
 */
export function generateEnemyInstanceId() {
    return `einst_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Returns a default EnemyTemplate object
 * @returns {EnemyTemplate}
 */
export function getDefaultEnemyTemplate() {
    return {
        id: generateEnemyId(),
        name: '',
        avatar: '',
        hp: 10,
        maxHp: 10,
        armorClass: 10,
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
        speed: 30,
        cr: 0.25,
    };
}

/**
 * Roll initiative for a combatant (1d20 + DEX modifier, D&D 5e)
 * @param {number} dexterity - Ability score
 * @returns {number} Initiative total
 */
export function rollInitiative(dexterity) {
    const mod = getAbilityModifier(dexterity);
    // @ts-ignore — droll is globally available via lib.js
    const roll = window.droll?.roll('1d20');
    const d20 = roll ? roll.total : Math.floor(Math.random() * 20) + 1;
    return d20 + mod;
}

/**
 * Get ability modifier from an ability score (D&D 5e formula)
 * @param {number} score
 * @returns {number}
 */
export function getAbilityModifier(score) {
    return Math.floor((score - 10) / 2);
}

/**
 * Format ability modifier as string (e.g., "+2" or "-1")
 * @param {number} modifier
 * @returns {string}
 */
export function formatModifier(modifier) {
    return modifier >= 0 ? `+${modifier}` : `${modifier}`;
}

/**
 * Calculate carrying capacity (D&D 5e: strength × 15)
 * @param {number} strength
 * @returns {number}
 */
export function calculateCarryingCapacity(strength) {
    return strength * 15;
}

/**
 * Calculate total weight of all items
 * @param {DndItem[]} items
 * @returns {number}
 */
export function calculateTotalWeight(items) {
    const normalizedItems = (Array.isArray(items) ? items : []).map(normalizeItem);
    const ids = new Set(normalizedItems.map(item => item.id));
    const nestedIds = new Set(
        normalizedItems
            .map(item => item.containerItemId)
            .filter(containerId => containerId && ids.has(containerId)),
    );

    const topLevelItems = normalizedItems.filter(item => !item.containerItemId || !ids.has(item.containerItemId));
    /**
     * @param {string} containerId
     * @param {Set<string>} stack
     * @returns {number}
     */
    function getNestedWeight(containerId, stack) {
        if (stack.has(containerId)) return 0;
        const nextStack = new Set(stack);
        nextStack.add(containerId);
        const contained = normalizedItems.filter(item => item.containerItemId === containerId);
        return contained.reduce((sum, item) => sum + (item.weight || 0) + getNestedWeight(item.id, nextStack), 0);
    }

    return topLevelItems.reduce((sum, item) => {
        if (nestedIds.has(item.id)) {
            return sum + (item.weight || 0) + getNestedWeight(item.id, new Set());
        }

        return sum + (item.weight || 0);
    }, 0);
}

/**
 * Returns default D&D character data
 * @returns {DndCharacterData}
 */
export function getDefaultDndData() {
    return {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
        armorClass: 10,
        speed: 30,
        items: [],
        equippedItems: {
            [EQUIPMENT_SLOTS.HEAD]: null,
            [EQUIPMENT_SLOTS.BODY]: null,
            [EQUIPMENT_SLOTS.HANDS]: null,
            [EQUIPMENT_SLOTS.WEAPON]: null,
            [EQUIPMENT_SLOTS.SHIELD]: null,
            [EQUIPMENT_SLOTS.RING]: null,
            [EQUIPMENT_SLOTS.FEET]: null,
        },
        relationships: [],
        memories: [],
        mapPosition: { locationName: '', gridX: 0, gridY: 0 },
    };
}

/**
 * Get effective stats after applying equipment effects
 * @param {DndCharacterData} dndData
 * @returns {{baseAC: number, effectiveAC: number, acBonus: number, statBonuses: Object<string, number>}}
 */
export function applyEquipmentEffects(dndData) {
    /** @type {Object<string, number>} */
    const statBonuses = {};
    const dexMod = getAbilityModifier(dndData.dexterity);
    let baseAC = 10 + dexMod;
    let acBonus = 0;

    for (const slot of Object.values(EQUIPMENT_SLOTS)) {
        const itemId = dndData.equippedItems[slot];
        if (!itemId) continue;

        const item = dndData.items.find(i => i.id === itemId);
        if (!item || !item.effects) continue;

        for (const effect of item.effects) {
            if (effect.stat === 'armorClass') {
                acBonus += effect.modifier;
            } else {
                statBonuses[effect.stat] = (statBonuses[effect.stat] || 0) + effect.modifier;
            }
        }
    }

    return {
        baseAC,
        effectiveAC: baseAC + acBonus,
        acBonus,
        statBonuses,
    };
}

/**
 * Add an item to inventory
 * @param {DndCharacterData} dndData
 * @param {DndItem} item
 */
export function addItemToInventory(dndData, item) {
    dndData.items.push(normalizeItem(item));
}

/**
 * Remove an item from inventory (and unequip if equipped)
 * @param {DndCharacterData} dndData
 * @param {string} itemId
 */
export function removeItemFromInventory(dndData, itemId) {
    // Unequip if equipped
    for (const [slot, eqId] of Object.entries(dndData.equippedItems)) {
        if (eqId === itemId) {
            dndData.equippedItems[slot] = null;
        }
    }
    dndData.items = dndData.items.filter(i => i.id !== itemId);
}

/**
 * Consume one use of an item. If uses reach 0 (or uses are not tracked), removes the item.
 * @param {DndCharacterData} dndData
 * @param {string} itemId
 * @returns {{ consumed: boolean, removed: boolean, item: DndItem|null }}
 */
export function consumeItemInInventory(dndData, itemId) {
    const index = dndData.items.findIndex(i => i.id === itemId);
    if (index === -1) return { consumed: false, removed: false, item: null };

    const item = normalizeItem(dndData.items[index]);
    if (!item.consumable) return { consumed: false, removed: false, item };

    if (item.uses == null || item.uses <= 1) {
        removeItemFromInventory(dndData, itemId);
        return { consumed: true, removed: true, item: null };
    }

    item.uses = Math.max(0, item.uses - 1);
    dndData.items[index] = item;
    return { consumed: true, removed: false, item };
}

/**
 * Equip an item to a slot (unequips current item in that slot)
 * @param {DndCharacterData} dndData
 * @param {string} itemId
 * @param {string} slot
 * @returns {boolean} success
 */
export function equipItem(dndData, itemId, slot) {
    const item = dndData.items.find(i => i.id === itemId);
    if (!item) return false;
    if (!Object.values(EQUIPMENT_SLOTS).includes(slot)) return false;

    // Unequip from any current slot first
    for (const [s, eqId] of Object.entries(dndData.equippedItems)) {
        if (eqId === itemId) {
            dndData.equippedItems[s] = null;
        }
    }

    dndData.equippedItems[slot] = itemId;
    return true;
}

/**
 * Unequip an item from a slot
 * @param {DndCharacterData} dndData
 * @param {string} slot
 */
export function unequipItem(dndData, slot) {
    if (dndData.equippedItems[slot] !== undefined) {
        dndData.equippedItems[slot] = null;
    }
}

/**
 * Get the equipped item for a slot
 * @param {DndCharacterData} dndData
 * @param {string} slot
 * @returns {DndItem|null}
 */
export function getEquippedItem(dndData, slot) {
    const itemId = dndData.equippedItems[slot];
    if (!itemId) return null;
    const item = dndData.items.find(i => i.id === itemId) || null;
    return item ? normalizeItem(item) : null;
}

/**
 * Get items filtered by type
 * @param {DndCharacterData} dndData
 * @param {'weapon'|'armor'|'gear'|null} type - null for all
 * @returns {DndItem[]}
 */
export function getItemsByType(dndData, type) {
    const items = Array.isArray(dndData.items) ? dndData.items.map(normalizeItem) : [];
    if (!type) return items;
    return items.filter(i => getPrimaryItemType(i.category || 'gear', i.subcategory || 'generic') === type);
}

/**
 * Analyze chat messages for relationships between characters
 * @param {Array<{name: string, mes: string, is_user: boolean}>} messages
 * @param {string} memberName
 * @param {string[]} otherNames - names of other characters/party members
 * @returns {DndRelationship[]}
 */
export function analyzeRelationshipsFromChat(messages, memberName, otherNames) {
    /** @type {Object<string, {mentions: number, contexts: string[]}>} */
    const interactions = {};

    for (const name of otherNames) {
        if (name.toLowerCase() === memberName.toLowerCase()) continue;
        interactions[name] = { mentions: 0, contexts: [] };
    }

    for (const msg of messages) {
        const text = msg.mes || '';
        for (const name of otherNames) {
            if (name.toLowerCase() === memberName.toLowerCase()) continue;
            if (text.toLowerCase().includes(name.toLowerCase())) {
                interactions[name].mentions++;
                if (interactions[name].contexts.length < 3) {
                    const excerpt = text.substring(0, 200);
                    interactions[name].contexts.push(excerpt);
                }
            }
        }
    }

    /** @type {DndRelationship[]} */
    const results = [];
    for (const [name, data] of Object.entries(interactions)) {
        if (data.mentions === 0) continue;
        results.push({
            characterName: name,
            characterAvatar: '',
            type: 'neutral',
            description: `${data.mentions} interaction(s) found in chat.`,
            lastInteraction: data.contexts[data.contexts.length - 1] || '',
        });
    }

    return results.sort((a, b) => {
        const aCount = interactions[a.characterName]?.mentions || 0;
        const bCount = interactions[b.characterName]?.mentions || 0;
        return bCount - aCount;
    });
}

/**
 * Migrate old party member data to include D&D fields
 * @param {any} member - Old or current party member data
 * @returns {any} member with all D&D fields populated
 */
export function migratePartyMember(member) {
    const defaults = getDefaultDndData();
    return {
        ...member,
        strength: member.strength ?? defaults.strength,
        dexterity: member.dexterity ?? defaults.dexterity,
        constitution: member.constitution ?? defaults.constitution,
        intelligence: member.intelligence ?? defaults.intelligence,
        wisdom: member.wisdom ?? defaults.wisdom,
        charisma: member.charisma ?? defaults.charisma,
        armorClass: member.armorClass ?? defaults.armorClass,
        speed: member.speed ?? defaults.speed,
        items: Array.isArray(member.items) ? member.items.map(normalizeItem) : [],
        equippedItems: member.equippedItems ?? { ...defaults.equippedItems },
        relationships: Array.isArray(member.relationships) ? member.relationships : [],
        memories: Array.isArray(member.memories) ? member.memories : [],
        mapPosition: member.mapPosition ?? { locationName: '', gridX: 0, gridY: 0 },
        alignment: member.alignment ?? '',
        personality: member.personality ?? '',
        activeConditions: Array.isArray(member.activeConditions) ? member.activeConditions : [],
        // Keep old text inventory/conditions for backward compat
        inventory: member.inventory ?? '',
        conditions: member.conditions ?? '',
    };
}

/**
 * Create a new DndItem with defaults
 * @param {Partial<DndItem>} overrides
 * @returns {DndItem}
 */
export function createItem(overrides = {}) {
    return normalizeItem({
        ...ITEM_DEFAULTS,
        ...overrides,
        id: overrides.id || generateItemId(),
    });
}
