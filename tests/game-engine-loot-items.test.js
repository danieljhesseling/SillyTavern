import { describe, test, expect } from '@jest/globals';
import { describeLootItem, isDeclaredLoot, declaredLootNames } from '../public/scripts/game-engine/combat/loot-items.js';
import { DEFAULT_LOOT_RULES, lootRulesWithWorldItems } from '../public/scripts/game-engine/combat/loot.js';
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

describe('lo que el mundo tiene escrito tambien cae', () => {
    /** El catálogo tal y como lo guarda el editor de campaña. */
    const catalogue = [
        {
            name: 'Hoz del vado', type: 'weapon', rarity: 'Uncommon', weight: 1.5,
            damageDice: '1d6', damageType: 'cortante', slot: 'weapon', description: 'Huele a grano.',
        },
        { name: 'Canica de vidrio', type: 'gear', rarity: '', weight: 0 },
    ];

    test('los objetos del mundo entran en las tablas por su rareza', () => {
        const rules = lootRulesWithWorldItems(catalogue);
        expect(rules.itemsByRarity.Uncommon).toContain('Hoz del vado');
        expect(rules.itemsByRarity.Common).toContain('Canica de vidrio');
    });

    test('sin borrar lo que ya caía', () => {
        const rules = lootRulesWithWorldItems(catalogue);
        for (const rarity of Object.keys(DEFAULT_LOOT_RULES.itemsByRarity)) {
            for (const name of DEFAULT_LOOT_RULES.itemsByRarity[rarity]) {
                expect(rules.itemsByRarity[rarity]).toContain(name);
            }
        }
    });

    test('y un mundo sin objetos escritos deja las reglas como estaban', () => {
        expect(lootRulesWithWorldItems([])).toBe(DEFAULT_LOOT_RULES);
        expect(lootRulesWithWorldItems(null)).toBe(DEFAULT_LOOT_RULES);
    });

    test('una rareza que las tablas no conocen cae como comun, no en ningun sitio', () => {
        const rules = lootRulesWithWorldItems([{ name: 'Corona rota', rarity: 'Legendaria' }]);
        expect(rules.itemsByRarity.Common).toContain('Corona rota');
    });

    test('lo que cae es el arma que el autor escribio, no un trasto generico', () => {
        const dropped = describeLootItem('Hoz del vado', 'Uncommon', catalogue);
        expect(dropped.type).toBe('weapon');
        expect(dropped.damageDice).toBe('1d6');
        expect(dropped.slot).toBe('weapon');
        expect(dropped.weight).toBe(1.5);
    });

    test('y se puede equipar de verdad, que es para lo que existe todo esto', () => {
        const item = createItem(describeLootItem('Hoz del vado', 'Uncommon', catalogue));
        expect(item.name).toBe('Hoz del vado');
        expect(item.type).toBe('weapon');
    });

    test('el mundo manda sobre la tabla de dentro del motor', () => {
        const mine = [{ name: 'Poción de curación', type: 'weapon', damageDice: '2d6', weight: 3 }];
        expect(describeLootItem('Poción de curación', 'Common', mine).type).toBe('weapon');
        // Y sin catálogo, sigue siendo la poción de siempre.
        expect(describeLootItem('Poción de curación', 'Common').type).toBe('gear');
    });
});
