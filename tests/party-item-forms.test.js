import { describe, test, expect } from '@jest/globals';
import {
    escItemText,
    getItemBooleanFlag,
    buildPartyField,
    buildPartyConditional,
    buildPartyItemSection,
    buildPartyArmorDexRuleNote,
    buildPartyArmorResistanceChoices,
    buildPartyItemSections,
} from '../public/scripts/party/item-forms.js';

describe('escItemText', () => {
    test('escapes the five XML entities', () => {
        expect(escItemText('&')).toBe('&amp;');
        expect(escItemText('<')).toBe('&lt;');
        expect(escItemText('>')).toBe('&gt;');
        expect(escItemText('"')).toBe('&quot;');
    });

    test('also escapes single quotes, which the old local copy did not', () => {
        expect(escItemText('O\'Brien')).toBe('O&#39;Brien');
    });

    test('neutralises an attribute breakout attempt', () => {
        const payload = '" onerror="alert(1)';
        expect(escItemText(payload)).not.toContain('"');
        expect(escItemText(payload)).toBe('&quot; onerror=&quot;alert(1)');
    });

    test('renders null and undefined as an empty string', () => {
        expect(escItemText(null)).toBe('');
        expect(escItemText(undefined)).toBe('');
    });

    test('stringifies non-string input', () => {
        expect(escItemText(42)).toBe('42');
        expect(escItemText(0)).toBe('0');
        expect(escItemText(false)).toBe('false');
    });

    // party/html.js deliberately duplicates utils.js's escapeHtml, because importing
    // utils.js pulls in browser-only code and would make this module untestable. This
    // asserts the two stay byte-identical in behaviour, which is the point of the copy.
    test('matches the escaping contract of utils.js escapeHtml', () => {
        const reference = (/** @type {any} */ value) => String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const samples = ['', 'plain', '<a href="x">&</a>', 'it\'s', null, undefined, 0, 7, '&amp;', '<>&"\''];
        for (const sample of samples) {
            expect(escItemText(sample)).toBe(reference(sample));
        }
    });
});

describe('getItemBooleanFlag', () => {
    test('coerces the flag to a boolean', () => {
        expect(getItemBooleanFlag({ finesse: 1 }, 'finesse')).toBe(true);
        expect(getItemBooleanFlag({ finesse: 0 }, 'finesse')).toBe(false);
        expect(getItemBooleanFlag({}, 'finesse')).toBe(false);
    });

    test('tolerates a missing item', () => {
        expect(getItemBooleanFlag(null, 'finesse')).toBe(false);
        expect(getItemBooleanFlag(undefined, 'finesse')).toBe(false);
    });
});

describe('buildPartyField', () => {
    test('wraps the label and the field markup in a row', () => {
        expect(buildPartyField('Damage', '<input />'))
            .toBe('<div class="dnd-form-row"><label>Damage</label><input /></div>');
    });
});

describe('buildPartyItemSection', () => {
    test('wraps the title and body in a section', () => {
        const html = buildPartyItemSection('Combat', '<p>body</p>');
        expect(html).toContain('dnd-item-form-section-title">Combat<');
        expect(html).toContain('<p>body</p>');
    });
});

describe('buildPartyConditional', () => {
    test('emits no data attributes when no filter is given', () => {
        expect(buildPartyConditional('<p>x</p>'))
            .toBe('<div class="dnd-item-conditional"><p>x</p></div>');
    });

    test('serialises categories and subcategories as comma-separated attributes', () => {
        const html = buildPartyConditional('<p>x</p>', {
            categories: ['weapon', 'armor'],
            subcategories: ['simple_melee'],
        });
        expect(html).toContain('data-item-categories="weapon,armor"');
        expect(html).toContain('data-item-subcategories="simple_melee"');
    });

    test('escapes the filter values', () => {
        const html = buildPartyConditional('<p>x</p>', { categories: ['a"b'] });
        expect(html).toContain('data-item-categories="a&quot;b"');
    });

    test('an empty list adds no attribute at all', () => {
        expect(buildPartyConditional('<p>x</p>', { categories: [], subcategories: [] }))
            .toBe('<div class="dnd-item-conditional"><p>x</p></div>');
    });
});

describe('buildPartyArmorDexRuleNote', () => {
    test('renders a note for an armour item', () => {
        const html = buildPartyArmorDexRuleNote({ subcategory: 'heavy_armor', armorDexMode: 'none' });
        expect(html).toContain('dnd-armor-dex-note');
    });

    test('falls back to the generic rule when fields are missing', () => {
        expect(() => buildPartyArmorDexRuleNote({})).not.toThrow();
    });
});

describe('buildPartyArmorResistanceChoices', () => {
    test('ticks only the resistances the item has', () => {
        const html = buildPartyArmorResistanceChoices({ resistanceTypes: ['Fire'] });
        const fireRow = html.split('<label').find(chunk => chunk.includes('data-value="Fire"'));
        expect(fireRow).toContain('checked');
        const otherRow = html.split('<label').find(chunk => chunk.includes('data-value="Cold"'));
        expect(otherRow).not.toContain('checked');
    });

    test('tolerates a missing resistance list', () => {
        expect(buildPartyArmorResistanceChoices({})).not.toContain('checked');
        expect(buildPartyArmorResistanceChoices({ resistanceTypes: 'nope' })).not.toContain('checked');
    });
});

describe('buildPartyItemSections', () => {
    test('produces the weapon, defence and flag sections', () => {
        const html = buildPartyItemSections({ category: 'weapon', subcategory: 'martial_melee' });
        expect(html).toContain('Combat');
        expect(html).toContain('Defense Stats');
        expect(html).toContain('Flags');
    });

    test('does not blow up on an empty item', () => {
        expect(() => buildPartyItemSections({})).not.toThrow();
    });

    test('escapes hostile item values instead of emitting raw markup', () => {
        const html = buildPartyItemSections({ damageDice: '"><script>alert(1)</script>' });
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
    });
});
