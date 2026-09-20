import { describe, test, expect } from '@jest/globals';
import {
    EQUIPMENT_SLOTS,
    getAbilityModifier,
    formatModifier,
    calculateCarryingCapacity,
    calculateTotalWeight,
    clampRelationshipScore,
    normalizeItem,
    getDefaultDndData,
    applyEquipmentEffects,
    addItemToInventory,
    removeItemFromInventory,
    consumeItemInInventory,
    equipItem,
    unequipItem,
    getEquippedItem,
} from '../public/scripts/dnd-system.js';

/**
 * Builds a character with the given items already in the inventory.
 * @param {any[]} items
 * @returns {any}
 */
function characterWith(items = []) {
    const data = getDefaultDndData();
    for (const item of items) {
        addItemToInventory(data, item);
    }
    return data;
}

describe('getAbilityModifier', () => {
    // Written as a loop rather than test.each: tests/.eslintrc.cjs applies the Playwright
    // plugin to every file here, and its no-standalone-expect rule misreads test.each on a
    // pure Jest file unless the surrounding describe also declares a hook.
    const abilityScores = [
        [1, -5],
        [8, -1],
        [9, -1],
        [10, 0],
        [11, 0],
        [12, 1],
        [15, 2],
        [20, 5],
        [30, 10],
    ];

    for (const [score, expected] of abilityScores) {
        test(`score ${score} yields modifier ${expected}`, () => {
            expect(getAbilityModifier(score)).toBe(expected);
        });
    }

    test('rounds down for odd scores below 10', () => {
        // 7 -> (7-10)/2 = -1.5 -> floor -> -2
        expect(getAbilityModifier(7)).toBe(-2);
    });
});

describe('formatModifier', () => {
    test('prefixes non-negative values with a plus sign', () => {
        expect(formatModifier(0)).toBe('+0');
        expect(formatModifier(3)).toBe('+3');
    });

    test('keeps the minus sign for negative values', () => {
        expect(formatModifier(-2)).toBe('-2');
    });
});

describe('calculateCarryingCapacity', () => {
    test('is strength times fifteen', () => {
        expect(calculateCarryingCapacity(10)).toBe(150);
        expect(calculateCarryingCapacity(18)).toBe(270);
    });
});

describe('calculateTotalWeight', () => {
    test('returns zero for a missing or empty inventory', () => {
        expect(calculateTotalWeight([])).toBe(0);
        expect(calculateTotalWeight(null)).toBe(0);
    });

    test('sums the weight of loose items', () => {
        const items = [
            { id: 'a', name: 'Sword', weight: 3 },
            { id: 'b', name: 'Shield', weight: 6 },
        ];
        expect(calculateTotalWeight(items)).toBe(9);
    });

    test('counts items stored inside a container exactly once', () => {
        const items = [
            { id: 'bag', name: 'Backpack', weight: 5 },
            { id: 'rope', name: 'Rope', weight: 10, containerItemId: 'bag' },
        ];
        expect(calculateTotalWeight(items)).toBe(15);
    });

    test('walks nested containers', () => {
        const items = [
            { id: 'bag', name: 'Backpack', weight: 5 },
            { id: 'pouch', name: 'Pouch', weight: 1, containerItemId: 'bag' },
            { id: 'gem', name: 'Gem', weight: 0.5, containerItemId: 'pouch' },
        ];
        expect(calculateTotalWeight(items)).toBe(6.5);
    });

    test('treats an item whose container does not exist as loose', () => {
        const items = [{ id: 'rope', name: 'Rope', weight: 10, containerItemId: 'ghost' }];
        expect(calculateTotalWeight(items)).toBe(10);
    });

    test('does not hang on a container cycle', () => {
        const items = [
            { id: 'a', name: 'A', weight: 1, containerItemId: 'b' },
            { id: 'b', name: 'B', weight: 1, containerItemId: 'a' },
        ];
        expect(calculateTotalWeight(items)).toBe(0);
    });
});

describe('clampRelationshipScore', () => {
    test('keeps values inside the -100..100 range', () => {
        expect(clampRelationshipScore(250)).toBe(100);
        expect(clampRelationshipScore(-250)).toBe(-100);
        expect(clampRelationshipScore(42)).toBe(42);
    });

    test('rounds fractional values', () => {
        expect(clampRelationshipScore(12.6)).toBe(13);
    });

    test('falls back to zero for anything that is not a finite number', () => {
        expect(clampRelationshipScore('abc')).toBe(0);
        expect(clampRelationshipScore(undefined)).toBe(0);
        // Infinity is rejected by the finite check rather than clamped to the maximum.
        expect(clampRelationshipScore(Infinity)).toBe(0);
    });

    test('accepts numeric strings', () => {
        expect(clampRelationshipScore('55')).toBe(55);
    });
});

describe('normalizeItem', () => {
    test('defaults an unknown category to gear', () => {
        expect(normalizeItem({ name: 'Thing' }).category).toBe('gear');
        expect(normalizeItem({ category: 'nonsense' }).category).toBe('gear');
    });

    test('migrates the legacy type field into a category', () => {
        expect(normalizeItem({ type: 'weapon' }).category).toBe('weapon');
        expect(normalizeItem({ type: 'armor' }).category).toBe('armor');
    });

    test('coerces a non-numeric weight to zero', () => {
        expect(normalizeItem({ weight: 'heavy' }).weight).toBe(0);
        expect(normalizeItem({ weight: '2.5' }).weight).toBe(2.5);
    });

    test('always produces an effects array', () => {
        expect(normalizeItem({}).effects).toEqual([]);
        expect(normalizeItem({ effects: 'nope' }).effects).toEqual([]);
    });

    test('tolerates null and non-object input', () => {
        expect(() => normalizeItem(null)).not.toThrow();
        expect(normalizeItem(null).category).toBe('gear');
    });
});

describe('applyEquipmentEffects', () => {
    test('base AC is 10 plus the dexterity modifier', () => {
        const data = getDefaultDndData();
        data.dexterity = 16; // +3
        expect(applyEquipmentEffects(data).baseAC).toBe(13);
    });

    test('adds armorClass effects from equipped items only', () => {
        const data = characterWith([
            { id: 'plate', name: 'Plate', category: 'armor', effects: [{ stat: 'armorClass', modifier: 5 }] },
            { id: 'spare', name: 'Spare', category: 'armor', effects: [{ stat: 'armorClass', modifier: 9 }] },
        ]);
        equipItem(data, 'plate', EQUIPMENT_SLOTS.BODY);

        const result = applyEquipmentEffects(data);
        expect(result.acBonus).toBe(5);
        expect(result.effectiveAC).toBe(result.baseAC + 5);
    });

    test('accumulates non-AC effects into statBonuses', () => {
        const data = characterWith([
            { id: 'belt', name: 'Belt of Giant Strength', effects: [{ stat: 'strength', modifier: 4 }] },
            { id: 'ring', name: 'Ring of Might', effects: [{ stat: 'strength', modifier: 1 }] },
        ]);
        equipItem(data, 'belt', EQUIPMENT_SLOTS.BODY);
        equipItem(data, 'ring', EQUIPMENT_SLOTS.RING);

        expect(applyEquipmentEffects(data).statBonuses.strength).toBe(5);
    });

    test('ignores an equipped id that is no longer in the inventory', () => {
        const data = getDefaultDndData();
        data.equippedItems[EQUIPMENT_SLOTS.BODY] = 'ghost';
        expect(() => applyEquipmentEffects(data)).not.toThrow();
        expect(applyEquipmentEffects(data).acBonus).toBe(0);
    });
});

describe('inventory management', () => {
    test('addItemToInventory stores a normalized copy', () => {
        const data = characterWith([{ id: 'x', name: 'Torch', type: 'gear', weight: '1' }]);
        expect(data.items).toHaveLength(1);
        expect(data.items[0].weight).toBe(1);
        expect(data.items[0].effects).toEqual([]);
    });

    test('removeItemFromInventory also clears the item from its slot', () => {
        const data = characterWith([{ id: 'sword', name: 'Sword', category: 'weapon' }]);
        equipItem(data, 'sword', EQUIPMENT_SLOTS.WEAPON);
        expect(data.equippedItems[EQUIPMENT_SLOTS.WEAPON]).toBe('sword');

        removeItemFromInventory(data, 'sword');
        expect(data.items).toHaveLength(0);
        expect(data.equippedItems[EQUIPMENT_SLOTS.WEAPON]).toBeNull();
    });

    test('removing an unknown id is a no-op', () => {
        const data = characterWith([{ id: 'sword', name: 'Sword' }]);
        removeItemFromInventory(data, 'nope');
        expect(data.items).toHaveLength(1);
    });
});

describe('consumeItemInInventory', () => {
    test('reports nothing consumed for an unknown id', () => {
        const data = characterWith([]);
        expect(consumeItemInInventory(data, 'nope')).toEqual({ consumed: false, removed: false, item: null });
    });

    test('refuses to consume a non-consumable item', () => {
        const data = characterWith([{ id: 'sword', name: 'Sword' }]);
        const result = consumeItemInInventory(data, 'sword');
        expect(result.consumed).toBe(false);
        expect(data.items).toHaveLength(1);
    });

    test('removes a consumable that tracks no uses', () => {
        const data = characterWith([{ id: 'potion', name: 'Potion', consumable: true }]);
        const result = consumeItemInInventory(data, 'potion');
        expect(result).toMatchObject({ consumed: true, removed: true });
        expect(data.items).toHaveLength(0);
    });

    test('decrements remaining uses without removing the item', () => {
        const data = characterWith([{ id: 'wand', name: 'Wand', consumable: true, uses: 3 }]);
        const result = consumeItemInInventory(data, 'wand');
        expect(result.consumed).toBe(true);
        expect(result.removed).toBe(false);
        expect(data.items[0].uses).toBe(2);
    });

    test('removes the item on the last use', () => {
        const data = characterWith([{ id: 'wand', name: 'Wand', consumable: true, uses: 1 }]);
        const result = consumeItemInInventory(data, 'wand');
        expect(result.removed).toBe(true);
        expect(data.items).toHaveLength(0);
    });
});

describe('equipping', () => {
    test('equipItem rejects an unknown item', () => {
        const data = characterWith([]);
        expect(equipItem(data, 'ghost', EQUIPMENT_SLOTS.WEAPON)).toBe(false);
    });

    test('equipItem rejects an invalid slot', () => {
        const data = characterWith([{ id: 'sword', name: 'Sword' }]);
        expect(equipItem(data, 'sword', 'tail')).toBe(false);
        expect(data.equippedItems.tail).toBeUndefined();
    });

    test('moving an item to another slot leaves the old one empty', () => {
        const data = characterWith([{ id: 'ring', name: 'Ring' }]);
        equipItem(data, 'ring', EQUIPMENT_SLOTS.RING);
        equipItem(data, 'ring', EQUIPMENT_SLOTS.HANDS);

        expect(data.equippedItems[EQUIPMENT_SLOTS.RING]).toBeNull();
        expect(data.equippedItems[EQUIPMENT_SLOTS.HANDS]).toBe('ring');
    });

    test('equipping into an occupied slot replaces the occupant', () => {
        const data = characterWith([
            { id: 'sword', name: 'Sword' },
            { id: 'axe', name: 'Axe' },
        ]);
        equipItem(data, 'sword', EQUIPMENT_SLOTS.WEAPON);
        equipItem(data, 'axe', EQUIPMENT_SLOTS.WEAPON);
        expect(data.equippedItems[EQUIPMENT_SLOTS.WEAPON]).toBe('axe');
    });

    test('unequipItem clears the slot', () => {
        const data = characterWith([{ id: 'sword', name: 'Sword' }]);
        equipItem(data, 'sword', EQUIPMENT_SLOTS.WEAPON);
        unequipItem(data, EQUIPMENT_SLOTS.WEAPON);
        expect(data.equippedItems[EQUIPMENT_SLOTS.WEAPON]).toBeNull();
    });

    test('getEquippedItem returns null for an empty slot', () => {
        const data = characterWith([]);
        expect(getEquippedItem(data, EQUIPMENT_SLOTS.WEAPON)).toBeNull();
    });

    test('getEquippedItem returns the normalized item', () => {
        const data = characterWith([{ id: 'sword', name: 'Sword', weight: '3' }]);
        equipItem(data, 'sword', EQUIPMENT_SLOTS.WEAPON);
        expect(getEquippedItem(data, EQUIPMENT_SLOTS.WEAPON)).toMatchObject({ id: 'sword', weight: 3 });
    });
});
