/**
 * Shared domain types for the party subsystem.
 *
 * Kept in its own module so the submodules split out of party.js can all refer to the
 * same contract without importing each other. Types only: this file emits no runtime code.
 *
 * See wiki/ROADMAP.md, Bateria 2.
 */

/**
 * @typedef {Object} PartyMember
 * @property {number} id
 * @property {string|null} personaId
 * @property {number|null} [wiUid]
 * @property {string|null} [worldName]
 * @property {string} name
 * @property {string} avatar
 * @property {string} [group]
 * @property {number} level
 * @property {string} class
 * @property {string} race
 * @property {string[]} factions
 * @property {number} hp
 * @property {number} maxHp
 * @property {number} xp
 * @property {number} xpNext
 * @property {string[]} [abilities] Los ids del catalogo que este personaje se sabe.
 * @property {Record<string, number>} [abilityUses] Cuantas veces ha usado cada una desde el ultimo descanso.
 * @property {number} gold
 * @property {number} silver
 * @property {number} copper
 * @property {string} inventory
 * @property {string} conditions
 * @property {number} [hitDiceSpent] - Dados de golpe gastados. Un descanso corto los gasta y uno largo devuelve la mitad.
 * @property {string} [hitDie] - Dado de golpe propio, si no vale el de su clase.
 * @property {string} alignment
 * @property {string} personality
 * @property {string[]} activeConditions
 * @property {string} [size] - D&D creature size. Decides how many cells the token covers; Medium when absent.
 * @property {number} strength
 * @property {number} dexterity
 * @property {number} constitution
 * @property {number} intelligence
 * @property {number} wisdom
 * @property {number} charisma
 * @property {number} armorClass
 * @property {number} speed
 * @property {string} [classPresetSource]
 * @property {boolean} [classPresetDirty]
 * @property {import('../dnd-system.js').DndItem[]} items
 * @property {Object<string, string|null>} equippedItems
 * @property {import('../dnd-system.js').DndRelationship[]} relationships
 * @property {import('../dnd-system.js').DndMemory[]} memories
 * @property {import('../dnd-system.js').MapPosition} mapPosition
 */

export {};
