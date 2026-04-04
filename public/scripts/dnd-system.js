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
 * @property {string|null} slot - Equipment slot or null if not equippable
 * @property {string} image - URL or empty string
 * @property {number} weight
 * @property {DndItemEffect[]} effects
 * @property {string} description
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
    return items.reduce((sum, item) => sum + (item.weight || 0), 0);
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
    dndData.items.push(item);
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
    return dndData.items.find(i => i.id === itemId) || null;
}

/**
 * Get items filtered by type
 * @param {DndCharacterData} dndData
 * @param {'weapon'|'armor'|'gear'|null} type - null for all
 * @returns {DndItem[]}
 */
export function getItemsByType(dndData, type) {
    if (!type) return [...dndData.items];
    return dndData.items.filter(i => i.type === type);
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
        items: Array.isArray(member.items) ? member.items : [],
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
    return {
        id: overrides.id || generateItemId(),
        name: overrides.name || 'New Item',
        type: overrides.type || 'gear',
        slot: overrides.slot ?? null,
        image: overrides.image || '',
        weight: overrides.weight ?? 0,
        effects: overrides.effects || [],
        description: overrides.description || '',
    };
}
