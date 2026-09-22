/**
 * The default rule pack: D&D 5e as this engine plays it.
 *
 * These twenty-five tables used to be constants inside dnd-system.js, which meant adding a
 * weapon property or a damage type required editing JavaScript. They are data now, so the
 * editor can change them and a campaign can ship its own pack.
 *
 * Everything here is plain values. No imports, no logic, nothing that assumes a browser —
 * this file is meant to be readable as the reference for what a custom pack must look like.
 *
 * See wiki/ROADMAP.md, Fase C (C1).
 */

/** Equipment slot constants */
const EQUIPMENT_SLOTS = {
    HEAD: 'head',
    BODY: 'body',
    HANDS: 'hands',
    WEAPON: 'weapon',
    SHIELD: 'shield',
    RING: 'ring',
    FEET: 'feet',
};

/** Slot display info */
const SLOT_INFO = {
    [EQUIPMENT_SLOTS.HEAD]: { label: 'Head', icon: 'fa-hat-wizard' },
    [EQUIPMENT_SLOTS.BODY]: { label: 'Body', icon: 'fa-shirt' },
    [EQUIPMENT_SLOTS.HANDS]: { label: 'Hands', icon: 'fa-hand' },
    [EQUIPMENT_SLOTS.WEAPON]: { label: 'Weapon', icon: 'fa-sword' },
    [EQUIPMENT_SLOTS.SHIELD]: { label: 'Shield', icon: 'fa-shield-halved' },
    [EQUIPMENT_SLOTS.RING]: { label: 'Ring', icon: 'fa-ring' },
    [EQUIPMENT_SLOTS.FEET]: { label: 'Feet', icon: 'fa-shoe-prints' },
};

const RELATIONSHIP_CATEGORIES = ['normal', 'amoroso', 'familiar'];

const RELATIONSHIP_SCORE_MIN = -100;

const RELATIONSHIP_SCORE_MAX = 100;

const ITEM_TYPES = ['weapon', 'armor', 'gear'];

const ITEM_CATEGORIES = ['weapon', 'armor', 'gear', 'magic', 'mount_vehicle_trade'];

const ITEM_CATEGORY_OPTIONS = [
    ['weapon', 'Weapons'],
    ['armor', 'Armor & Shields'],
    ['gear', 'Adventuring Gear'],
    ['magic', 'Magic Items'],
    ['mount_vehicle_trade', 'Mounts, Vehicles & Trade'],
];

const ITEM_SUBCATEGORY_OPTIONS = {
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

const ITEM_SUBCATEGORY_META = {
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

const ITEM_RARITY_OPTIONS = ['', 'Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact'];

const ITEM_RECHARGE_OPTIONS = ['', 'At Dawn', 'At Dusk', 'Short Rest', 'Long Rest', 'Manual'];

const ITEM_CAPACITY_UNITS = ['', 'lb', 'cu ft', 'slots', 'creatures', 'charges'];

const ITEM_FOCUS_TYPES = ['', 'Arcane', 'Divine', 'Druidic'];

const ITEM_ARMOR_DEX_MODE_OPTIONS = [
    ['full', 'Full'],
    ['max_2', 'Max +2'],
    ['none', 'None'],
];

const ITEM_WEAPON_DAMAGE_TYPE_OPTIONS = [
    ['', 'None'],
    ['Slashing', 'Cortante'],
    ['Piercing', 'Perforante'],
    ['Bludgeoning', 'Contundente'],
];

const ITEM_ARMOR_RESISTANCE_OPTIONS = [
    'Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning',
    'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder',
    'Magical Bludgeoning', 'Magical Piercing', 'Magical Slashing',
];

const ITEM_MAGIC_BONUS_OPTIONS = [0, 1, 2, 3].map(value => [String(value), value > 0 ? `+${value}` : `${value}`]);

/** @type {{ key: keyof import('../../dnd-system.js').DndItem, label: string, subcategories: string[] }[]} */
const ITEM_WEAPON_FLAG_DEFINITIONS = [
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

/** @type {{ key: keyof import('../../dnd-system.js').DndItem, label: string, subcategories: string[] }[]} */
const ITEM_ARMOR_FLAG_DEFINITIONS = [
    { key: 'stealthDisadvantage', label: 'Stealth Disadvantage (Desventaja)', subcategories: ['generic', 'light_armor', 'medium_armor', 'heavy_armor'] },
    { key: 'magical', label: 'Magical (Mágico)', subcategories: ['generic', 'light_armor', 'medium_armor', 'heavy_armor', 'shield'] },
    { key: 'cursed', label: 'Cursed (Maldito)', subcategories: ['generic', 'light_armor', 'medium_armor', 'heavy_armor', 'shield'] },
    { key: 'attunement', label: 'Attunement Required (Sintonización)', subcategories: ['generic', 'heavy_armor', 'shield'] },
    { key: 'adamantine', label: 'Adamantine (Adamantina)', subcategories: ['generic', 'light_armor', 'medium_armor', 'heavy_armor', 'shield'] },
    { key: 'mithral', label: 'Mithral (Mitral)', subcategories: ['generic', 'light_armor', 'medium_armor', 'heavy_armor', 'shield'] },
    { key: 'resistanceEnabled', label: 'Resistances (Resistencias)', subcategories: ['generic', 'light_armor', 'medium_armor', 'heavy_armor', 'shield'] },
];

/** @type {{ key: keyof import('../../dnd-system.js').DndItem, label: string, subcategories: string[] }[]} */
const ITEM_GEAR_FLAG_DEFINITIONS = [
    { key: 'stackable', label: 'Stackable', subcategories: ['basic_consumable', 'exploration_tool', 'magic_focus', 'artisan_tool', 'container'] },
    { key: 'toolProficiency', label: 'Tool Proficiency Required', subcategories: ['exploration_tool', 'artisan_tool'] },
    { key: 'attunement', label: 'Attunement Required (Sintonizacion)', subcategories: ['magic_focus'] },
];

const ITEM_LINKED_ABILITY_OPTIONS = [
    ['', 'None'],
    ['strength', 'Strength'],
    ['dexterity', 'Dexterity'],
    ['constitution', 'Constitution'],
    ['intelligence', 'Intelligence'],
    ['wisdom', 'Wisdom'],
    ['charisma', 'Charisma'],
    ['sleight_of_hand', 'Dexterity (Sleight of Hand)'],
];

/** D&D 5e Alignments */
const ALIGNMENTS = [
    'Lawful Good', 'Neutral Good', 'Chaotic Good',
    'Lawful Neutral', 'True Neutral', 'Chaotic Neutral',
    'Lawful Evil', 'Neutral Evil', 'Chaotic Evil',
];

/** D&D 5e Standard Conditions */
const CONDITIONS = [
    'Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled',
    'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified',
    'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious',
    'Exhaustion',
];

/** Stats that can be modified by equipment */
const MODIFIABLE_STATS = [
    'armorClass', 'strength', 'dexterity', 'constitution',
    'intelligence', 'wisdom', 'charisma', 'speed', 'maxHp',
];

/** Bumped whenever the shape of a pack changes, so migrations have something to branch on. */
export const RULESET_SCHEMA_VERSION = 1;

/** @type {import('./ruleset.js').Ruleset} */
/**
 * Las habilidades que trae el juego de serie.
 *
 * Cinco, a proposito: una de cada forma que el motor sabe resolver, para que se vea como
 * se escriben las demas. Anadir un conjuro es anadir una fila aqui o desde `/habilidades`,
 * nunca tocar codigo — la misma regla que las armas y las condiciones.
 */
const ABILITIES = [
    {
        id: 'rayo_de_fuego',
        name: 'Rayo de fuego',
        description: 'Un dardo de fuego que no se acaba nunca. El truco de quien sabe algo de magia.',
        cost: 'action', resource: 'at_will',
        rangeFeet: 120, target: 'enemy', resolution: 'attack',
        damage: '1d10', damageType: 'Fire',
    },
    {
        id: 'curar_heridas',
        name: 'Curar heridas',
        description: 'Cierra lo que se pueda cerrar, con las manos encima.',
        cost: 'action', resource: 'long_rest', usesPerRest: 2,
        rangeFeet: 5, target: 'ally', resolution: 'auto',
        healing: '1d8+3',
    },
    {
        id: 'tomar_aliento',
        name: 'Tomar aliento',
        description: 'Un segundo de respiro en mitad de la pelea.',
        cost: 'bonus', resource: 'short_rest', usesPerRest: 1,
        target: 'self', resolution: 'auto',
        healing: '1d10+2',
    },
    {
        id: 'furia',
        name: 'Furia',
        description: 'Dejar de pensar, que a veces es lo que hace falta.',
        cost: 'bonus', resource: 'long_rest', usesPerRest: 2,
        target: 'self', resolution: 'auto',
        condition: 'Frightened', conditionRounds: 3,
    },
    {
        id: 'golpe_de_escudo',
        name: 'Golpe de escudo',
        description: 'El escudo tambien pega, y tira al suelo.',
        cost: 'action', resource: 'short_rest', usesPerRest: 1,
        rangeFeet: 5, target: 'enemy', resolution: 'save',
        saveAbility: 'strength', saveDc: 13,
        damage: '1d4', damageType: 'Bludgeoning',
        condition: 'Prone', conditionRounds: 1,
    },
];

/**
 * Cuanta experiencia pide cada nivel, como pares [nivel, XP].
 *
 * Pares y no objeto porque es la forma que el editor de reglas ya sabe dibujar: una
 * campana que quiera subir mas rapido, o parar en el nivel 10, se edita desde `/rules`
 * sin tocar una linea de codigo.
 */
const XP_THRESHOLDS = [
    ['2', '300'], ['3', '900'], ['4', '2700'], ['5', '6500'],
    ['6', '14000'], ['7', '23000'], ['8', '34000'], ['9', '48000'],
    ['10', '64000'], ['11', '85000'], ['12', '100000'], ['13', '120000'],
    ['14', '140000'], ['15', '165000'], ['16', '195000'], ['17', '225000'],
    ['18', '265000'], ['19', '305000'], ['20', '355000'],
];

/** Los niveles que traen mejora de caracteristica. */
const ABILITY_LEVELS = ['4', '8', '12', '16', '19'];

export const DEFAULT_RULESET = {
    version: RULESET_SCHEMA_VERSION,
    id: 'dnd5e',
    name: 'D&D 5e (por defecto)',
    slots: EQUIPMENT_SLOTS,
    slotInfo: SLOT_INFO,
    relationships: {
        categories: RELATIONSHIP_CATEGORIES,
        scoreMin: RELATIONSHIP_SCORE_MIN,
        scoreMax: RELATIONSHIP_SCORE_MAX,
    },
    items: {
        types: ITEM_TYPES,
        categories: ITEM_CATEGORIES,
        categoryOptions: ITEM_CATEGORY_OPTIONS,
        subcategoryOptions: ITEM_SUBCATEGORY_OPTIONS,
        subcategoryMeta: ITEM_SUBCATEGORY_META,
        rarity: ITEM_RARITY_OPTIONS,
        recharge: ITEM_RECHARGE_OPTIONS,
        capacityUnits: ITEM_CAPACITY_UNITS,
        focusTypes: ITEM_FOCUS_TYPES,
        armorDexModes: ITEM_ARMOR_DEX_MODE_OPTIONS,
        damageTypes: ITEM_WEAPON_DAMAGE_TYPE_OPTIONS,
        armorResistances: ITEM_ARMOR_RESISTANCE_OPTIONS,
        magicBonuses: ITEM_MAGIC_BONUS_OPTIONS,
        weaponFlags: ITEM_WEAPON_FLAG_DEFINITIONS,
        armorFlags: ITEM_ARMOR_FLAG_DEFINITIONS,
        gearFlags: ITEM_GEAR_FLAG_DEFINITIONS,
        linkedAbilities: ITEM_LINKED_ABILITY_OPTIONS,
    },
    character: {
        alignments: ALIGNMENTS,
        conditions: CONDITIONS,
        modifiableStats: MODIFIABLE_STATS,
    },
    progression: {
        xpThresholds: XP_THRESHOLDS,
        abilityLevels: ABILITY_LEVELS,
    },
    abilities: ABILITIES,
};
