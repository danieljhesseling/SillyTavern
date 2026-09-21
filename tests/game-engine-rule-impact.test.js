import { describe, test, expect } from '@jest/globals';
import { findBrokenReferences, describeImpact } from '../public/scripts/game-engine/rules/rule-impact.js';
import { DEFAULT_RULESET } from '../public/scripts/game-engine/rules/default-ruleset.js';

const clone = () => JSON.parse(JSON.stringify(DEFAULT_RULESET));

describe('what a rules change would break', () => {
    // The failure this exists for: a sword that dealt "Slashing" kept pointing at a
    // damage type that no longer existed, and nothing said so.
    test('removing a damage type an item uses is reported, with who holds it', () => {
        const after = clone();
        after.items.damageTypes = after.items.damageTypes.filter(d => d[0] !== 'Slashing');

        const broken = findBrokenReferences({
            before: DEFAULT_RULESET, after,
            items: [{ name: 'Espada', damageType: 'Slashing' }, { name: 'Hacha', damageType: 'Slashing' }],
        });

        expect(broken).toHaveLength(1);
        expect(broken[0]).toMatchObject({ field: 'damageTypes', value: 'Slashing', owners: ['Espada', 'Hacha'] });
        expect(broken[0].message).toContain('Espada, Hacha');
    });

    test('removing one nobody uses costs nothing', () => {
        const after = clone();
        after.items.damageTypes = after.items.damageTypes.filter(d => d[0] !== 'Slashing');
        expect(findBrokenReferences({ before: DEFAULT_RULESET, after, items: [{ name: 'Bastón', damageType: 'Bludgeoning' }] }))
            .toEqual([]);
    });

    // Adding breaks nothing. Only taking something away leaves a dead reference.
    test('adding a damage type breaks nothing', () => {
        const after = clone();
        after.items.damageTypes.push(['Void', 'Vacío']);
        expect(findBrokenReferences({ before: DEFAULT_RULESET, after, items: [{ name: 'Espada', damageType: 'Slashing' }] }))
            .toEqual([]);
    });

    test('a condition somebody is under is reported too', () => {
        const after = clone();
        after.character.conditions = after.character.conditions.filter(c => c !== 'Poisoned');
        const broken = findBrokenReferences({
            before: DEFAULT_RULESET, after,
            characters: [{ name: 'Lyra', activeConditions: ['Poisoned', 'Prone'] }],
        });
        expect(broken).toHaveLength(1);
        expect(broken[0]).toMatchObject({ field: 'conditions', value: 'Poisoned', owners: ['Lyra'] });
    });

    test('a rarity an item carries counts as well', () => {
        const after = clone();
        after.items.rarity = after.items.rarity.filter(r => r !== 'Legendary');
        const broken = findBrokenReferences({
            before: DEFAULT_RULESET, after, items: [{ name: 'Corona', rarity: 'Legendary' }],
        });
        expect(broken[0]).toMatchObject({ field: 'rarity', value: 'Legendary' });
    });

    // subcategoryOptions is a map of category to pairs, not a list. A check that only
    // understood one shape would report every value as removed.
    test('a subcategory is read out of the map it lives in', () => {
        const after = clone();
        after.items.subcategoryOptions.weapon = after.items.subcategoryOptions.weapon
            .filter(s => s[0] !== 'martial_melee');
        const broken = findBrokenReferences({
            before: DEFAULT_RULESET, after, items: [{ name: 'Espada', subcategory: 'martial_melee' }],
        });
        expect(broken[0]).toMatchObject({ field: 'subcategoryOptions', value: 'martial_melee' });
    });

    test('an identical pack breaks nothing at all', () => {
        expect(findBrokenReferences({
            before: DEFAULT_RULESET, after: clone(),
            items: [{ name: 'Espada', damageType: 'Slashing', rarity: 'Rare', subcategory: 'martial_melee' }],
            characters: [{ name: 'Lyra', activeConditions: ['Poisoned'] }],
        })).toEqual([]);
    });

    // Something pointing at a value neither pack knows is a separate mess, not this one.
    test('a value neither pack ever had is not blamed on this change', () => {
        const after = clone();
        expect(findBrokenReferences({
            before: DEFAULT_RULESET, after, items: [{ name: 'Rareza', damageType: 'Inventado' }],
        })).toEqual([]);
    });

    test('nothing at all does not throw', () => {
        expect(findBrokenReferences({ before: null, after: null })).toEqual([]);
        expect(findBrokenReferences({ before: DEFAULT_RULESET, after: clone(), items: [null], characters: [null] }))
            .toEqual([]);
    });
});

describe('the one-line summary', () => {
    test('says so when nothing breaks', () => {
        expect(describeImpact([])).toMatch(/Ningún objeto ni personaje/);
        expect(describeImpact(null)).toMatch(/Ningún objeto/);
    });

    test('and counts values and sheets when something does', () => {
        const line = describeImpact([
            { field: 'damageTypes', value: 'Slashing', owners: ['Espada', 'Hacha'], message: '' },
            { field: 'conditions', value: 'Poisoned', owners: ['Lyra'], message: '' },
        ]);
        expect(line).toContain('2 valor(es)');
        expect(line).toContain('3 ficha(s)');
    });
});
