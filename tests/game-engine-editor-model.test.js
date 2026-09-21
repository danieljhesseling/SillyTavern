import { describe, test, expect } from '@jest/globals';
import {
    listSections,
    getSection,
    setSection,
    toRows,
    fromRows,
    defaultSection,
    isSectionModified,
    SECTION_LABELS,
} from '../public/scripts/game-engine/rules/editor-model.js';
import { resolveRuleset, getEditableSections } from '../public/scripts/game-engine/rules/ruleset.js';

describe('the sections offered to a person', () => {
    test('covers every section the validator knows, so nothing is uneditable', () => {
        expect(listSections().map(s => s.path).sort())
            .toEqual(getEditableSections().map(s => s.path).sort());
    });

    test('puts what you came to change first: damage types and weapon properties', () => {
        const first = listSections().slice(0, 4).map(s => s.path);
        expect(first).toContain('items.damageTypes');
        expect(first).toContain('items.weaponFlags');
    });

    test('every section has a human label, never a bare path', () => {
        for (const section of listSections()) {
            expect(section.label).toBeTruthy();
            expect(SECTION_LABELS[section.path] ?? section.path).toBe(section.label);
        }
    });
});

describe('reading and writing a section by path', () => {
    test('reads a nested value', () => {
        expect(getSection({ items: { rarity: ['Común'] } }, 'items.rarity')).toEqual(['Común']);
    });

    test('a missing path reads as undefined instead of throwing', () => {
        expect(getSection({}, 'items.rarity')).toBeUndefined();
        expect(getSection(null, 'items.rarity')).toBeUndefined();
    });

    test('writing returns a new pack and leaves the original alone', () => {
        const original = { items: { rarity: ['Común'] } };
        const updated = setSection(original, 'items.rarity', ['Raro']);
        expect(updated.items.rarity).toEqual(['Raro']);
        expect(original.items.rarity).toEqual(['Común']);
    });

    test('writing creates the branch when it does not exist yet', () => {
        expect(setSection({}, 'character.conditions', ['Cegado']))
            .toEqual({ character: { conditions: ['Cegado'] } });
    });
});

describe('turning a section into rows and back', () => {
    // The property that matters most: opening the editor and saving without typing
    // anything must not alter the pack.
    test('a round trip through the editor changes nothing', () => {
        for (const { path, kind } of listSections()) {
            const value = defaultSection(path);
            if (value == null) continue;
            const { rows, raw } = toRows(value, kind);
            const { value: back, errors } = fromRows(rows, kind, raw);
            expect({ path, errors }).toEqual({ path, errors: [] });
            expect({ path, back }).toEqual({ path, back: value });
        }
    });

    test('a list of strings becomes one row each', () => {
        const { rows, columns } = toRows(['Cegado', 'Aturdido'], 'string[]');
        expect(columns).toEqual(['Valor']);
        expect(rows.map(r => r.a)).toEqual(['Cegado', 'Aturdido']);
    });

    test('pairs keep the internal value apart from the visible name', () => {
        const { rows, columns } = toRows([['fire', 'Fuego']], 'pairs');
        expect(columns).toHaveLength(2);
        expect(rows[0]).toMatchObject({ a: 'fire', b: 'Fuego' });
    });

    test('flags carry their description too', () => {
        const { rows } = toRows([{ key: 'finesse', label: 'Sutil', description: 'Usa Destreza' }], 'flags');
        expect(rows[0]).toMatchObject({ a: 'finesse', b: 'Sutil', c: 'Usa Destreza' });
    });

    // A flag can carry fields no column shows. Dropping them on save would silently
    // break which item types a property applies to.
    test('fields the table cannot show survive the round trip', () => {
        const flags = [{ key: 'finesse', label: 'Sutil', subcategories: ['simple_melee'] }];
        const { rows } = toRows(flags, 'flags');
        expect(fromRows(rows, 'flags').value).toEqual(flags);
    });

    test('a nested map is handed over as JSON, not flattened into a table', () => {
        const { editable, raw } = toRows({ head: ['Casco'] }, 'object');
        expect(editable).toBe(false);
        expect(JSON.parse(raw)).toEqual({ head: ['Casco'] });
    });
});

describe('rebuilding a section from edited rows', () => {
    test('adding a damage type produces a pack the validator accepts', () => {
        const rows = toRows(defaultSection('items.damageTypes'), 'pairs').rows;
        const { value, errors } = fromRows([...rows, { a: 'void', b: 'Vacío', c: '' }], 'pairs');

        expect(errors).toEqual([]);
        const pack = setSection({ id: 'mi', name: 'Mi campaña', version: 1 }, 'items.damageTypes', value);
        expect(resolveRuleset(pack).usedDefault).toBe(false);
        expect(resolveRuleset(pack).ruleset.items.damageTypes).toContainEqual(['void', 'Vacío']);
    });

    // The built-in pack ships with ['', 'None']: the empty option every select needs.
    test('an empty internal value is kept, because it is the "none" option', () => {
        const { value, errors } = fromRows([{ a: '', b: 'None', c: '' }, { a: 'fire', b: 'Fuego', c: '' }], 'pairs');
        expect(errors).toEqual([]);
        expect(value).toEqual([['', 'None'], ['fire', 'Fuego']]);
    });

    test('but a second empty option is reported', () => {
        const { errors } = fromRows([{ a: '', b: 'None' }, { a: '', b: 'Otra' }], 'pairs');
        expect(errors.join(' ')).toMatch(/valor vacío/);
    });

    test('a blank row is dropped, so a half-typed line does not block saving', () => {
        const { value, errors } = fromRows([{ a: 'Cegado' }, { a: '', b: '', c: '' }], 'string[]');
        expect(value).toEqual(['Cegado']);
        expect(errors).toEqual([]);
    });

    test('duplicates are reported rather than silently collapsing', () => {
        expect(fromRows([{ a: 'Cegado' }, { a: 'Cegado' }], 'string[]').errors).toHaveLength(1);
        expect(fromRows([{ a: 'f', b: 'A' }, { a: 'f', b: 'B' }], 'pairs').errors).toHaveLength(1);
        expect(fromRows([{ a: 'k', b: 'A' }, { a: 'k', b: 'B' }], 'flags').errors).toHaveLength(1);
    });

    test('a flag without a key is refused, since the key is what the game stores', () => {
        expect(fromRows([{ a: '', b: 'Sutil' }], 'flags').errors).toHaveLength(1);
    });

    test('a pair with no visible name falls back to its value instead of showing blank', () => {
        expect(fromRows([{ a: 'fire', b: '' }], 'pairs').value).toEqual([['fire', 'fire']]);
    });

    test('a number that is not a number is reported', () => {
        expect(fromRows([{ a: 'diez' }], 'number').errors).toHaveLength(1);
        expect(fromRows([{ a: '-100' }], 'number')).toEqual({ value: -100, errors: [] });
    });

    test('invalid JSON is reported instead of wiping the section', () => {
        const { errors } = fromRows([], 'object', '{no es json');
        expect(errors.join(' ')).toMatch(/JSON/);
    });

    test('JSON that is not an object is refused', () => {
        expect(fromRows([], 'object', '[1,2,3]').errors).toHaveLength(1);
    });
});

describe('isSectionModified', () => {
    test('an untouched section does not claim to be changed', () => {
        const pack = setSection({}, 'items.damageTypes', defaultSection('items.damageTypes'));
        expect(isSectionModified(pack, 'items.damageTypes')).toBe(false);
    });

    test('a changed section says so', () => {
        const pack = setSection({}, 'items.damageTypes', [['void', 'Vacío']]);
        expect(isSectionModified(pack, 'items.damageTypes')).toBe(true);
    });

    // A change made and then undone is not a change.
    test('a change that is reverted stops counting', () => {
        let pack = setSection({}, 'character.conditions', ['Inventado']);
        pack = setSection(pack, 'character.conditions', defaultSection('character.conditions'));
        expect(isSectionModified(pack, 'character.conditions')).toBe(false);
    });
});
