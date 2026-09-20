import { afterEach, describe, test, expect } from '@jest/globals';
import { DEFAULT_RULESET, RULESET_SCHEMA_VERSION } from '../public/scripts/game-engine/rules/default-ruleset.js';
import {
    validateRuleset,
    mergeRuleset,
    migrateRuleset,
    resolveRuleset,
    getActiveRuleset,
    setActiveRuleset,
    resetActiveRuleset,
    getEditableSections,
    toPortablePack,
} from '../public/scripts/game-engine/rules/ruleset.js';

/** A minimal pack that only changes one thing. */
const smallPack = (overrides = {}) => ({
    id: 'custom',
    name: 'Mi campaña',
    version: RULESET_SCHEMA_VERSION,
    ...overrides,
});

afterEach(() => {
    resetActiveRuleset();
});

describe('the default pack', () => {
    test('carries everything the engine needs', () => {
        expect(DEFAULT_RULESET.items.damageTypes.length).toBeGreaterThan(0);
        expect(DEFAULT_RULESET.character.conditions.length).toBeGreaterThan(0);
        expect(DEFAULT_RULESET.slots.WEAPON).toBe('weapon');
        expect(DEFAULT_RULESET.relationships.scoreMin).toBe(-100);
    });

    test('validates against its own rules', () => {
        expect(validateRuleset(DEFAULT_RULESET).valid).toBe(true);
    });
});

describe('validateRuleset', () => {
    test('rejects anything that is not an object', () => {
        expect(validateRuleset(null).valid).toBe(false);
        expect(validateRuleset('nope').valid).toBe(false);
        expect(validateRuleset([]).valid).toBe(false);
    });

    test('requires an id and a name', () => {
        const result = validateRuleset({ version: 1 });
        expect(result.valid).toBe(false);
        expect(result.errors.join(' ')).toContain('id');
        expect(result.errors.join(' ')).toContain('name');
    });

    test('a pack that only overrides one section is valid', () => {
        const result = validateRuleset(smallPack({
            items: { damageTypes: [['sonic', 'Sónico']] },
        }));
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    test('catches a section of the wrong shape', () => {
        const result = validateRuleset(smallPack({ character: { conditions: 'no es una lista' } }));
        expect(result.valid).toBe(false);
        expect(result.errors.join(' ')).toContain('character.conditions');
    });

    test('catches malformed value/label pairs', () => {
        const result = validateRuleset(smallPack({ items: { damageTypes: ['solo texto'] } }));
        expect(result.valid).toBe(false);
        expect(result.errors.join(' ')).toContain('damageTypes');
    });

    test('catches flag definitions without a key', () => {
        const result = validateRuleset(smallPack({ items: { weaponFlags: [{ label: 'Sin clave' }] } }));
        expect(result.valid).toBe(false);
        expect(result.errors.join(' ')).toContain('weaponFlags');
    });

    test('reports every problem at once, not just the first', () => {
        const result = validateRuleset({
            items: { damageTypes: 'mal', rarity: 42 },
        });
        expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });

    test('warns about a subcategory with no metadata', () => {
        const result = validateRuleset(smallPack({
            items: { subcategoryOptions: { weapon: [['siege_engine', 'Máquina de asedio']] } },
        }));
        expect(result.valid).toBe(true);
        expect(result.warnings.join(' ')).toContain('siege_engine');
    });

    test('warns about a pack from a newer engine', () => {
        const result = validateRuleset(smallPack({ version: RULESET_SCHEMA_VERSION + 5 }));
        expect(result.warnings.join(' ')).toContain('versión');
    });

    test('a non-integer version is an error', () => {
        expect(validateRuleset(smallPack({ version: 'uno' })).valid).toBe(false);
    });
});

describe('mergeRuleset', () => {
    test('a pack inherits everything it does not mention', () => {
        const merged = mergeRuleset(DEFAULT_RULESET, smallPack({
            items: { damageTypes: [['sonic', 'Sónico']] },
        }));
        expect(merged.items.damageTypes).toEqual([['sonic', 'Sónico']]);
        expect(merged.items.rarity).toEqual(DEFAULT_RULESET.items.rarity);
        expect(merged.character.conditions).toEqual(DEFAULT_RULESET.character.conditions);
    });

    test('replaces a list outright rather than interleaving it', () => {
        const merged = mergeRuleset(DEFAULT_RULESET, smallPack({
            character: { conditions: ['Maldito'] },
        }));
        expect(merged.character.conditions).toEqual(['Maldito']);
    });

    test('keeps the other keys of a partially overridden section', () => {
        const merged = mergeRuleset(DEFAULT_RULESET, smallPack({
            character: { conditions: ['Maldito'] },
        }));
        expect(merged.character.alignments).toEqual(DEFAULT_RULESET.character.alignments);
    });

    test('takes the identity fields', () => {
        const merged = mergeRuleset(DEFAULT_RULESET, smallPack());
        expect(merged.id).toBe('custom');
        expect(merged.name).toBe('Mi campaña');
    });

    test('nothing to merge leaves the base alone', () => {
        expect(mergeRuleset(DEFAULT_RULESET, null)).toBe(DEFAULT_RULESET);
    });

    test('does not mutate the base', () => {
        const snapshot = JSON.stringify(DEFAULT_RULESET);
        mergeRuleset(DEFAULT_RULESET, smallPack({ items: { rarity: ['X'] } }));
        expect(JSON.stringify(DEFAULT_RULESET)).toBe(snapshot);
    });
});

describe('migrateRuleset', () => {
    test('a pack from before versioning gets version 1', () => {
        expect(migrateRuleset({ id: 'old', name: 'Antiguo' }).version).toBe(1);
    });

    test('a current pack is left as it is', () => {
        const pack = smallPack();
        expect(migrateRuleset(pack).version).toBe(RULESET_SCHEMA_VERSION);
    });

    test('junk passes through without throwing', () => {
        expect(() => migrateRuleset(null)).not.toThrow();
        expect(migrateRuleset('nope')).toBe('nope');
    });
});

describe('resolveRuleset', () => {
    test('no pack means the default', () => {
        const result = resolveRuleset(null);
        expect(result.usedDefault).toBe(true);
        expect(result.ruleset).toBe(DEFAULT_RULESET);
    });

    // The reason a broken pack is refused rather than partially applied.
    test('a broken pack falls back to the default instead of half-loading', () => {
        const result = resolveRuleset({ id: 'roto', name: 'Roto', character: { conditions: 42 } });
        expect(result.usedDefault).toBe(true);
        expect(result.ruleset.character.conditions).toEqual(DEFAULT_RULESET.character.conditions);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    test('a valid pack is merged onto the default', () => {
        const result = resolveRuleset(smallPack({ items: { rarity: ['Común', 'Único'] } }));
        expect(result.usedDefault).toBe(false);
        expect(result.ruleset.items.rarity).toEqual(['Común', 'Único']);
        expect(result.ruleset.items.recharge).toEqual(DEFAULT_RULESET.items.recharge);
    });

    test('migrates before validating, so an old pack still loads', () => {
        const result = resolveRuleset({ id: 'old', name: 'Antiguo' });
        expect(result.usedDefault).toBe(false);
        expect(result.ruleset.version).toBe(1);
    });
});

describe('the active pack', () => {
    test('starts as the default', () => {
        expect(getActiveRuleset()).toBe(DEFAULT_RULESET);
    });

    test('can be installed and reset', () => {
        setActiveRuleset(smallPack({ items: { rarity: ['Único'] } }));
        expect(getActiveRuleset().items.rarity).toEqual(['Único']);

        resetActiveRuleset();
        expect(getActiveRuleset()).toBe(DEFAULT_RULESET);
    });

    test('a broken pack leaves the default in force', () => {
        setActiveRuleset({ id: 'x', name: 'x', items: { rarity: 99 } });
        expect(getActiveRuleset()).toBe(DEFAULT_RULESET);
    });
});

describe('getEditableSections', () => {
    test('lists every section an editor can offer, with its shape', () => {
        const sections = getEditableSections();
        expect(sections.length).toBe(25);
        expect(sections).toContainEqual({ path: 'items.damageTypes', kind: 'pairs' });
        expect(sections).toContainEqual({ path: 'character.conditions', kind: 'string[]' });
    });
});

describe('toPortablePack', () => {
    test('an unchanged pack exports only its identity', () => {
        const portable = toPortablePack(DEFAULT_RULESET);
        expect(portable.id).toBe('dnd5e');
        expect(portable.items).toBeUndefined();
        expect(portable.character).toBeUndefined();
    });

    test('exports only what differs from the default', () => {
        const custom = mergeRuleset(DEFAULT_RULESET, smallPack({
            items: { rarity: ['Único'] },
        }));
        const portable = toPortablePack(custom);
        expect(portable.items).toEqual({ rarity: ['Único'] });
        expect(portable.character).toBeUndefined();
    });

    test('a round trip preserves the differences', () => {
        const custom = mergeRuleset(DEFAULT_RULESET, smallPack({
            items: { rarity: ['Único'] },
            character: { conditions: ['Maldito'] },
        }));
        const reloaded = resolveRuleset(toPortablePack(custom)).ruleset;
        expect(reloaded.items.rarity).toEqual(['Único']);
        expect(reloaded.character.conditions).toEqual(['Maldito']);
        expect(reloaded.items.recharge).toEqual(DEFAULT_RULESET.items.recharge);
    });

    test('what it exports is itself valid', () => {
        const custom = mergeRuleset(DEFAULT_RULESET, smallPack({ items: { rarity: ['Único'] } }));
        expect(validateRuleset(toPortablePack(custom)).valid).toBe(true);
    });
});

describe('adding content without touching code', () => {
    // This is the whole point of Fase C.
    test('a new damage type reaches the engine through a pack', () => {
        const result = setActiveRuleset(smallPack({
            items: {
                damageTypes: [...DEFAULT_RULESET.items.damageTypes, ['void', 'Vacío']],
            },
        }));
        expect(result.usedDefault).toBe(false);
        expect(getActiveRuleset().items.damageTypes).toContainEqual(['void', 'Vacío']);
    });

    test('a new condition reaches the engine through a pack', () => {
        setActiveRuleset(smallPack({
            character: { conditions: [...DEFAULT_RULESET.character.conditions, 'Petrificado'] },
        }));
        expect(getActiveRuleset().character.conditions).toContain('Petrificado');
    });

    test('a new weapon property reaches the engine through a pack', () => {
        setActiveRuleset(smallPack({
            items: {
                weaponFlags: [...DEFAULT_RULESET.items.weaponFlags, { key: 'cursed', label: 'Maldita' }],
            },
        }));
        expect(getActiveRuleset().items.weaponFlags.some(f => f.key === 'cursed')).toBe(true);
    });
});
