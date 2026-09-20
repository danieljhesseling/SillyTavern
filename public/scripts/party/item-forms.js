/**
 * HTML builders for the item editor form.
 *
 * Second slice extracted from party.js. These only turn data into markup strings: no DOM
 * access, no module state, so they can be asserted on directly in tests.
 *
 * See wiki/ROADMAP.md, Bateria 2.
 */

import { escapeHtml } from './html.js';
import {
    getArmorDexRuleLabel,
    ITEM_ARMOR_DEX_MODE_OPTIONS, ITEM_ARMOR_FLAG_DEFINITIONS, ITEM_ARMOR_RESISTANCE_OPTIONS,
    ITEM_CAPACITY_UNITS, ITEM_FOCUS_TYPES, ITEM_GEAR_FLAG_DEFINITIONS,
    ITEM_LINKED_ABILITY_OPTIONS, ITEM_MAGIC_BONUS_OPTIONS, ITEM_RARITY_OPTIONS,
    ITEM_RECHARGE_OPTIONS, ITEM_WEAPON_DAMAGE_TYPE_OPTIONS, ITEM_WEAPON_FLAG_DEFINITIONS,
} from '../dnd-system.js';

/**
 * @param {any} value
 * @returns {string}
 */
export function escItemText(value) {
    // Was a private copy that left single quotes unescaped. Delegates to the shared leaf
    // helper so every party submodule escapes identically (see SEC-03 and ./html.js).
    return escapeHtml(value);
}

/**
 * @param {import('../dnd-system.js').DndItem | null | undefined} item
 * @param {keyof import('../dnd-system.js').DndItem} key
 * @returns {boolean}
 */
export function getItemBooleanFlag(item, key) {
    return Boolean(item?.[key]);
}

/**
 * @param {string} label
 * @param {string} fieldHtml
 * @returns {string}
 */
export function buildPartyField(label, fieldHtml) {
    return `<div class="dnd-form-row"><label>${label}</label>${fieldHtml}</div>`;
}

/**
 * @param {string} content
 * @param {{ categories?: string[], subcategories?: string[] }} [options]
 * @returns {string}
 */
export function buildPartyConditional(content, options = {}) {
    const { categories = /** @type {string[]} */ ([]), subcategories = /** @type {string[]} */ ([]) } = options;
    const categoryAttr = categories.length ? ` data-item-categories="${escItemText(categories.join(','))}"` : '';
    const subcategoryAttr = subcategories.length ? ` data-item-subcategories="${escItemText(subcategories.join(','))}"` : '';
    return `<div class="dnd-item-conditional"${categoryAttr}${subcategoryAttr}>${content}</div>`;
}

/**
 * @param {string} title
 * @param {string} body
 * @returns {string}
 */
export function buildPartyItemSection(title, body) {
    return `<div class="dnd-item-form-section"><div class="dnd-item-form-section-title">${title}</div>${body}</div>`;
}

/**
 * @param {import('../dnd-system.js').DndItem} item
 * @returns {string}
 */
export function buildPartyArmorDexRuleNote(item) {
    return `<div class="dnd-item-form-note dnd-armor-dex-note">${escItemText(getArmorDexRuleLabel(item.subcategory || 'generic', item.armorDexMode || 'full'))}</div>`;
}

/**
 * @param {import('../dnd-system.js').DndItem} item
 * @returns {string}
 */
export function buildPartyArmorResistanceChoices(item) {
    const resistanceTypes = Array.isArray(item.resistanceTypes) ? item.resistanceTypes : [];
    return `<div class="dnd-item-flag-grid">${ITEM_ARMOR_RESISTANCE_OPTIONS.map(value => `
        <label class="checkbox_label dnd-item-flag-toggle">
            <input type="checkbox" class="item-resistance" data-value="${escItemText(value)}" ${resistanceTypes.includes(value) ? 'checked' : ''} />
            <span>${escItemText(value)}</span>
        </label>
    `).join('')}</div>`;
}

/**
 * @param {import('../dnd-system.js').DndItem} item
 * @returns {string}
 */
export function buildPartyItemSections(item) {
    return [
        buildPartyConditional(buildPartyItemSection('Combat', [
            buildPartyField('Damage Dice', `<input type="text" class="item-damage-dice" value="${escItemText(item.damageDice || item.baseDamage)}" placeholder="1d8" />`),
            buildPartyField('Damage Type', `<select class="item-damage-type">${ITEM_WEAPON_DAMAGE_TYPE_OPTIONS.map(([value, label]) => `<option value="${escItemText(value)}" ${value === (item.damageType || '') ? 'selected' : ''}>${escItemText(label)}</option>`).join('')}</select>`),
            buildPartyField('Magical Bonus', `<select class="item-magical-bonus">${ITEM_MAGIC_BONUS_OPTIONS.map(([value, label]) => `<option value="${escItemText(value)}" ${String(item.magicalBonus ?? 0) === String(value) ? 'selected' : ''}>${escItemText(label)}</option>`).join('')}</select>`),
            buildPartyConditional(buildPartyField('Melee Range', `<input type="number" class="item-melee-range" value="${item.meleeRange ?? 5}" min="5" step="5" />`), { subcategories: ['generic', 'simple_melee', 'martial_melee'] }),
            buildPartyConditional(buildPartyField('Normal Range', `<input type="number" class="item-range" value="${item.range ?? ''}" min="0" step="1" />`), { subcategories: ['simple_ranged', 'martial_ranged'] }),
            buildPartyConditional(buildPartyField('Long Range', `<input type="number" class="item-long-range" value="${item.longRange ?? ''}" min="0" step="1" />`), { subcategories: ['simple_ranged', 'martial_ranged'] }),
            buildPartyConditional(buildPartyField('Versatile Damage', `<input type="text" class="item-versatile-damage" value="${escItemText(item.versatileDamage)}" placeholder="1d10" />`), { subcategories: ['simple_melee', 'martial_melee'] }),
        ].join('')), { categories: ['weapon'] }),
        buildPartyConditional(buildPartyItemSection('Defense Stats', [
            buildPartyField('Base CA', `<input type="number" class="item-base-armor-class" value="${item.baseArmorClass ?? item.armorClass ?? ''}" min="0" step="1" />`),
            buildPartyField('Magical Bonus', `<select class="item-magical-bonus">${ITEM_MAGIC_BONUS_OPTIONS.map(([value, label]) => `<option value="${escItemText(value)}" ${String(item.magicalBonus ?? 0) === String(value) ? 'selected' : ''}>${escItemText(label)}</option>`).join('')}</select>`),
            buildPartyConditional(buildPartyField('Min Str', `<input type="number" class="item-strength-req" value="${item.strengthRequirement ?? ''}" min="0" max="20" step="1" />`), { subcategories: ['generic', 'heavy_armor'] }),
            buildPartyConditional(buildPartyField('Dexterity Mode', `<select class="item-armor-dex-mode">${ITEM_ARMOR_DEX_MODE_OPTIONS.map(([value, label]) => `<option value="${escItemText(value)}" ${value === (item.armorDexMode || 'full') ? 'selected' : ''}>${escItemText(label)}</option>`).join('')}</select>`), { subcategories: ['generic'] }),
            buildPartyArmorDexRuleNote(item),
            buildPartyField('Don Time', `<input type="text" class="item-don-time" value="${escItemText(item.donTime)}" placeholder="1 minute" />`),
            buildPartyField('Doff Time', `<input type="text" class="item-doff-time" value="${escItemText(item.doffTime)}" placeholder="1 minute" />`),
        ].join('')), { categories: ['armor'] }),
        buildPartyConditional(buildPartyItemSection('Flags', `
            <div class="dnd-item-flag-grid">
                ${ITEM_WEAPON_FLAG_DEFINITIONS.map(flag => buildPartyConditional(
        `<label class="checkbox_label dnd-item-flag-toggle"><input type="checkbox" class="item-flag" data-flag="${flag.key}" ${getItemBooleanFlag(item, /** @type {keyof import('../dnd-system.js').DndItem} */ (flag.key)) ? 'checked' : ''} /><span>${escItemText(flag.label)}</span></label>`,
        { subcategories: flag.subcategories },
    )).join('')}
                ${ITEM_ARMOR_FLAG_DEFINITIONS.map(flag => buildPartyConditional(
        `<label class="checkbox_label dnd-item-flag-toggle"><input type="checkbox" class="item-flag" data-flag="${flag.key}" ${getItemBooleanFlag(item, /** @type {keyof import('../dnd-system.js').DndItem} */ (flag.key)) ? 'checked' : ''} /><span>${escItemText(flag.label)}</span></label>`,
        { categories: ['armor'], subcategories: flag.subcategories },
    )).join('')}
                ${ITEM_GEAR_FLAG_DEFINITIONS.map(flag => buildPartyConditional(
        `<label class="checkbox_label dnd-item-flag-toggle"><input type="checkbox" class="item-flag" data-flag="${flag.key}" ${getItemBooleanFlag(item, /** @type {keyof import('../dnd-system.js').DndItem} */ (flag.key)) ? 'checked' : ''} /><span>${escItemText(flag.label)}</span></label>`,
        { categories: ['gear'], subcategories: flag.subcategories },
    )).join('')}
            </div>
            <div class="dnd-item-resistance-conditional">
                ${buildPartyField('Resistances', buildPartyArmorResistanceChoices(item))}
            </div>
        `), { categories: ['weapon', 'armor', 'gear'] }),
        buildPartyConditional(buildPartyItemSection('Utility', [
            buildPartyConditional(buildPartyField('Consumable', `<label class="checkbox_label"><input type="checkbox" class="item-consumable" ${item.consumable ? 'checked' : ''} /><span>Single-use or expendable</span></label>`), { categories: ['gear', 'magic'] }),
            buildPartyConditional(buildPartyField('Current Uses', `<input type="number" class="item-uses" value="${item.uses ?? ''}" min="0" step="1" />`), { subcategories: ['basic_consumable'] }),
            buildPartyConditional(buildPartyField('Max Uses', `<input type="number" class="item-max-uses" value="${item.maxUses ?? ''}" min="0" step="1" />`), { subcategories: ['basic_consumable'] }),
            buildPartyConditional(buildPartyField('Focus Type', `<select class="item-focus-type">${ITEM_FOCUS_TYPES.map(value => `<option value="${escItemText(value)}" ${value === (item.focusType || '') ? 'selected' : ''}>${escItemText(value || 'None')}</option>`).join('')}</select>`), { subcategories: ['magic_focus'] }),
            buildPartyConditional(buildPartyField('Tool Type', `<input type="text" class="item-tool-type" value="${escItemText(item.toolType)}" placeholder="Thieves' tools" />`), { subcategories: ['exploration_tool', 'artisan_tool'] }),
            buildPartyConditional(buildPartyField('Linked Ability', `<select class="item-linked-ability">${ITEM_LINKED_ABILITY_OPTIONS.map(([value, label]) => `<option value="${escItemText(value)}" ${String(item.linkedAbility || '') === value ? 'selected' : ''}>${escItemText(label)}</option>`).join('')}</select>`), { subcategories: ['artisan_tool'] }),
            buildPartyConditional(buildPartyField('Stack Size (items/slot)', `<input type="number" class="item-stack-size" value="${item.stackSize ?? ''}" min="1" step="1" />`), { subcategories: ['basic_consumable'] }),
            buildPartyConditional(buildPartyField('Stored In Container', `<input type="text" class="item-container-id" value="${escItemText(item.containerItemId || '')}" placeholder="Container item id (optional)" />`), { categories: ['gear', 'magic', 'mount_vehicle_trade'] }),
            buildPartyConditional(buildPartyField('Capacity', `<input type="number" class="item-capacity" value="${item.capacity ?? ''}" min="0" step="1" />`), { subcategories: ['container', 'mount', 'vehicle'] }),
            buildPartyConditional(buildPartyField('Capacity Unit', `<select class="item-capacity-unit">${ITEM_CAPACITY_UNITS.map(value => `<option value="${escItemText(value)}" ${value === (item.capacityUnit || '') ? 'selected' : ''}>${escItemText(value || 'None')}</option>`).join('')}</select>`), { subcategories: ['container', 'mount', 'vehicle'] }),
            buildPartyConditional(buildPartyField('Capacity Weight (lb)', `<input type="number" class="item-capacity-weight" value="${item.capacityWeight ?? ''}" min="0" step="1" />`), { subcategories: ['container'] }),
            buildPartyConditional(buildPartyField('Capacity Volume (ft³)', `<input type="number" class="item-capacity-volume" value="${item.capacityVolume ?? ''}" min="0" step="0.1" />`), { subcategories: ['container'] }),
            buildPartyConditional(buildPartyField('Emits Light', `<label class="checkbox_label"><input type="checkbox" class="item-emits-light" ${item.emitsLight ? 'checked' : ''} /><span>This tool emits light</span></label>`), { subcategories: ['exploration_tool'] }),
            buildPartyConditional(`<div class="dnd-item-light-fields">
                ${buildPartyField('Bright Light (ft)', `<input type="number" class="item-light-bright" value="${item.lightBright ?? ''}" min="0" step="5" />`)}
                ${buildPartyField('Dim Light (ft)', `<input type="number" class="item-light-dim" value="${item.lightDim ?? ''}" min="0" step="5" />`)}
            </div>`, { subcategories: ['exploration_tool'] }),
            buildPartyConditional(buildPartyField('Storage Weight (lb)', `<input type="number" class="item-storage-weight" value="${item.storageWeightLimit ?? ''}" min="0" step="1" />`), { categories: ['magic'] }),
            buildPartyConditional(buildPartyField('Storage Volume (ft³)', `<input type="number" class="item-storage-volume" value="${item.storageVolumeLimit ?? ''}" min="0" step="1" />`), { categories: ['magic'] }),
            buildPartyConditional(buildPartyField('Bright Light (ft)', `<input type="number" class="item-bright-light" value="${item.brightLightRadius ?? ''}" min="0" step="5" />`), { categories: ['magic'] }),
            buildPartyConditional(buildPartyField('Dim Light (ft)', `<input type="number" class="item-dim-light" value="${item.dimLightRadius ?? ''}" min="0" step="5" />`), { categories: ['magic'] }),
            buildPartyConditional(buildPartyField('Cost (gp)', `<input type="number" class="item-cost-gp" value="${item.costGp ?? ''}" min="0" step="1" />`), { categories: ['gear', 'magic', 'mount_vehicle_trade'] }),
        ].join('')), { categories: ['gear', 'magic', 'mount_vehicle_trade'] }),
        buildPartyConditional(buildPartyItemSection('Magic & Charges', [
            buildPartyField('Attunement', `<label class="checkbox_label"><input type="checkbox" class="item-attunement" ${item.attunement ? 'checked' : ''} /><span>Required</span></label>`),
            buildPartyField('Current Uses', `<input type="number" class="item-uses" value="${item.uses ?? ''}" min="0" step="1" />`),
            buildPartyField('Max Uses', `<input type="number" class="item-max-uses" value="${item.maxUses ?? ''}" min="0" step="1" />`),
            buildPartyField('Recharge', `<select class="item-recharge">${ITEM_RECHARGE_OPTIONS.map(value => `<option value="${escItemText(value)}" ${value === (item.recharge || '') ? 'selected' : ''}>${escItemText(value || 'None')}</option>`).join('')}</select>`),
            buildPartyField('Save DC', `<input type="number" class="item-save-dc" value="${item.saveDC ?? ''}" min="0" max="30" step="1" />`),
            buildPartyField('Spell Attack', `<input type="number" class="item-spell-attack" value="${item.spellAttackBonus ?? ''}" min="0" max="20" step="1" />`),
        ].join('')), { categories: ['gear'], subcategories: ['magic_focus'] }),
        buildPartyConditional(buildPartyItemSection('Magic', [
            buildPartyField('Rarity', `<select class="item-rarity">${ITEM_RARITY_OPTIONS.map(value => `<option value="${escItemText(value)}" ${value === (item.rarity || '') ? 'selected' : ''}>${escItemText(value || 'None')}</option>`).join('')}</select>`),
            buildPartyConditional(buildPartyField('Attunement', `<label class="checkbox_label"><input type="checkbox" class="item-attunement" ${item.attunement ? 'checked' : ''} /><span>Required</span></label>`), { subcategories: ['generic', 'magic_weapon_armor', 'ring_wand_staff', 'wondrous'] }),
            buildPartyField('Magical', `<label class="checkbox_label"><input type="checkbox" class="item-magical" ${item.magical ? 'checked' : ''} /><span>Counts as magical</span></label>`),
            buildPartyField('Cursed', `<label class="checkbox_label"><input type="checkbox" class="item-cursed" ${item.cursed ? 'checked' : ''} /><span>Yes</span></label>`),
            buildPartyConditional(buildPartyField('Current Uses', `<input type="number" class="item-uses" value="${item.uses ?? ''}" min="0" step="1" />`), { subcategories: ['generic', 'magic_weapon_armor', 'ring_wand_staff', 'wondrous'] }),
            buildPartyConditional(buildPartyField('Max Uses', `<input type="number" class="item-max-uses" value="${item.maxUses ?? ''}" min="0" step="1" />`), { subcategories: ['generic', 'magic_weapon_armor', 'ring_wand_staff', 'wondrous'] }),
            buildPartyConditional(buildPartyField('Recharge', `<select class="item-recharge">${ITEM_RECHARGE_OPTIONS.map(value => `<option value="${escItemText(value)}" ${value === (item.recharge || '') ? 'selected' : ''}>${escItemText(value || 'None')}</option>`).join('')}</select>`), { subcategories: ['generic', 'magic_weapon_armor', 'ring_wand_staff', 'wondrous'] }),
            buildPartyConditional(buildPartyField('Linked Spell', `<input type="text" class="item-linked-spell" value="${escItemText(item.linkedSpell || '')}" placeholder="Cure Wounds, Fireball..." />`), { subcategories: ['scroll'] }),
            buildPartyConditional(buildPartyField('Spell Level', `<input type="number" class="item-spell-level" value="${item.spellLevel ?? ''}" min="0" max="9" step="1" />`), { subcategories: ['scroll'] }),
            buildPartyConditional(buildPartyField('Save DC', `<input type="number" class="item-save-dc" value="${item.saveDC ?? ''}" min="0" max="30" step="1" />`), { subcategories: ['generic', 'ring_wand_staff', 'wondrous'] }),
            buildPartyConditional(buildPartyField('Spell Attack', `<input type="number" class="item-spell-attack" value="${item.spellAttackBonus ?? ''}" min="0" max="20" step="1" />`), { subcategories: ['generic', 'ring_wand_staff', 'wondrous'] }),
        ].join('')), { categories: ['magic'] }),
        buildPartyConditional(buildPartyItemSection('Transport & Trade', [
            buildPartyConditional(buildPartyField('Crew Required', `<input type="number" class="item-vehicle-crew" value="${item.vehicleCrew ?? ''}" min="0" step="1" />`), { subcategories: ['vehicle'] }),
            buildPartyConditional(buildPartyField('Damage Threshold', `<input type="number" class="item-vehicle-threshold" value="${item.vehicleDamageThreshold ?? ''}" min="0" step="1" />`), { subcategories: ['vehicle'] }),
        ].join('')), { categories: ['mount_vehicle_trade'] }),
    ].join('');
}
