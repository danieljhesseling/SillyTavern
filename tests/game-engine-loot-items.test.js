import { describe, test, expect } from '@jest/globals';
import { describeLootItem, isDeclaredLoot, declaredLootNames } from '../public/scripts/game-engine/combat/loot-items.js';
import { DEFAULT_LOOT_RULES } from '../public/scripts/game-engine/combat/loot.js';
import { createItem } from '../public/scripts/dnd-system.js';

describe('what the loot tables drop', () => {
    // A name the tables can drop but this file does not declare would reach the player as
    // generic gear: not broken, but not what it says on the tin either.
    test('every name in the default tables is declared', () => {
        const dropped = Object.values(DEFAULT_LOOT_RULES.itemsByRarity).flat();
        expect(dropped.filter(name => !isDeclaredLoot(name))).toEqual([]);
        expect(dropped.length).toBeGreaterThan(10);
    });

    test('a weapon comes with what it takes to swing it', () => {
        expect(describeLootItem('Espada rúnica', 'Rare')).toMatchObject({
            type: 'weapon', damageDice: '1d8', damageType: 'slashing', slot: 'weapon', rarity: 'Rare',
        });
    });

    test('a potion is a potion, not gear', () => {
        expect(describeLootItem('Poción de curación')).toMatchObject({ category: 'magic', subcategory: 'potion' });
    });

    test('armour knows where it goes', () => {
        expect(describeLootItem('Armadura de escamas verdes')).toMatchObject({ slot: 'body', weight: 20 });
    });

    // An undeclared name is a gap in the table, not a reason to hand out a string.
    test('anything undeclared still becomes a real item', () => {
        expect(describeLootItem('Reliquia inventada por un pack')).toMatchObject({
            name: 'Reliquia inventada por un pack', type: 'gear', subcategory: 'generic',
        });
    });

    test('an empty name still produces something namable', () => {
        expect(describeLootItem('')).toMatchObject({ name: 'Objeto' });
        expect(describeLootItem(null).name).toBe('Objeto');
    });

    test('the declared list is not empty and has no blanks', () => {
        const names = declaredLootNames();
        expect(names.length).toBeGreaterThan(10);
        expect(names.every(n => n.trim().length > 0)).toBe(true);
    });
});

describe('the specs go straight into the item system', () => {
    test('every declared name survives createItem with its fields intact', () => {
        for (const name of declaredLootNames()) {
            const spec = describeLootItem(name, 'Common');
            const item = createItem(spec);
            expect(item.name).toBe(name);
            expect(item.id).toBeTruthy();
            expect(item.type).toBe(spec.type);
        }
    });

    test('a looted weapon can be equipped, because it has a slot', () => {
        const item = createItem(describeLootItem('Hoja del alba', 'Very Rare'));
        expect(item.slot).toBe('weapon');
        expect(item.damageDice).toBe('1d8');
        expect(item.rarity).toBe('Very Rare');
    });
});
