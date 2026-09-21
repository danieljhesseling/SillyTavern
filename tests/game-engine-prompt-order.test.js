import { describe, test, expect } from '@jest/globals';
import {
    PROMPT_TIERS, tierForCategory, promptKey, sortLikeSillyTavern, stablePrefix, describeOrder,
} from '../public/scripts/game-engine/cost/prompt-order.js';

describe('the tiers', () => {
    test('go from what never changes to what changes every turn', () => {
        const orders = PROMPT_TIERS.map(t => t.order);
        expect(orders).toEqual([...orders].sort((a, b) => a - b));
        expect(PROMPT_TIERS[0].id).toBe('rules');
        expect(PROMPT_TIERS[PROMPT_TIERS.length - 1].id).toBe('custom');
    });

    test('every tier says why it is where it is', () => {
        expect(PROMPT_TIERS.every(t => t.label && t.why)).toBe(true);
    });

    test('the categories the model can write all land somewhere', () => {
        for (const category of ['combat', 'relationship', 'quest', 'location', 'item', 'lore', 'rules', 'npc', 'custom']) {
            expect(PROMPT_TIERS.some(t => t.id === tierForCategory(category))).toBe(true);
        }
    });

    test('anything unknown goes last, not first', () => {
        expect(tierForCategory('inventado')).toBe('custom');
        expect(tierForCategory('')).toBe('custom');
        expect(tierForCategory(null)).toBe('custom');
    });

    test('and the category is read whatever the case', () => {
        expect(tierForCategory('COMBAT')).toBe('combat');
        expect(tierForCategory('  Lore ')).toBe('world');
    });
});

describe('the key a block is injected under', () => {
    // This is the whole point: SillyTavern sorts the keys alphabetically, so the key has
    // to encode the order.
    test('sorts by how often the block changes, not by its id', () => {
        const keys = [
            promptKey('combat', 'zzz'),
            promptKey('rules', 'aaa'),
            promptKey('party', 'mmm'),
            promptKey('world', '999'),
        ];
        expect(sortLikeSillyTavern(keys).map(k => k.split('_')[2]))
            .toEqual(['rules', 'world', 'party', 'combat']);
    });

    // Without padding, tier 100 would sort before tier 20.
    test('the number is padded so string order is number order', () => {
        expect(promptKey('rules', 'x')).toMatch(/^GAME_010_/);
        expect(promptKey('custom', 'x')).toMatch(/^GAME_080_/);
    });

    test('two blocks of the same tier keep a stable order between them', () => {
        const keys = [promptKey('quest', 'b'), promptKey('quest', 'a')];
        expect(sortLikeSillyTavern(keys)).toEqual([promptKey('quest', 'a'), promptKey('quest', 'b')]);
    });

    test('an id with odd characters does not break the key', () => {
        expect(promptKey('quest', 'la misión #3 (bis)')).toBe('GAME_040_quest_dyn_la_misi_n__3__bis_');
    });

    test('an unknown tier still produces a usable key, at the end', () => {
        expect(promptKey('inventado', 'x')).toMatch(/^GAME_080_custom_/);
    });

    test('every block this game injects shares one prefix, away from other extensions', () => {
        expect(promptKey('rules', 'x').startsWith('GAME_')).toBe(true);
        expect(sortLikeSillyTavern(['ZZZ_other', promptKey('combat', 'x'), 'AAA_other']))
            .toEqual(['AAA_other', promptKey('combat', 'x'), 'ZZZ_other']);
    });
});

describe('how much of the prompt survives from one turn to the next', () => {
    test('two identical prompts share all of it', () => {
        const result = stablePrefix('reglas mundo grupo', 'reglas mundo grupo');
        expect(result.chars).toBe(18);
        expect(result.ratio).toBe(1);
        expect(result.divergedAt).toBe(-1);
    });

    test('a change at the end costs only the end', () => {
        const result = stablePrefix('reglas mundo PG:20', 'reglas mundo PG:14');
        expect(result.chars).toBe(16);
        expect(result.ratio).toBeGreaterThan(0.8);
    });

    // The failure this module exists to prevent.
    test('a change at the beginning costs everything', () => {
        expect(stablePrefix('PG:20 reglas mundo', 'PG:14 reglas mundo').chars).toBe(3);
    });

    test('a longer prompt keeps whatever prefix it shares', () => {
        expect(stablePrefix('reglas', 'reglas mundo').chars).toBe(6);
        expect(stablePrefix('reglas mundo', 'reglas').chars).toBe(6);
    });

    test('nothing at all is not a crash', () => {
        expect(stablePrefix('', '')).toMatchObject({ chars: 0, ratio: 0 });
        expect(stablePrefix(null, undefined)).toMatchObject({ chars: 0 });
    });
});

describe('where the cache stops paying', () => {
    const blocks = [
        { key: promptKey('combat', 'c'), label: 'Estado del combate', tokens: 120 },
        { key: promptKey('rules', 'r'), label: 'Reglas', tokens: 900 },
        { key: promptKey('party', 'p'), label: 'Ficha del grupo', tokens: 300 },
        { key: promptKey('world', 'w'), label: 'Mundo', tokens: 600 },
    ];

    test('the stable part is everything before the party sheet', () => {
        const { stableTokens, volatileTokens } = describeOrder(blocks);
        expect(stableTokens).toBe(1500);
        expect(volatileTokens).toBe(420);
    });

    test('and it names the block where the volatile part starts', () => {
        expect(describeOrder(blocks).boundary).toBe('Ficha del grupo');
    });

    test('the order it reports is the order SillyTavern will use', () => {
        expect(describeOrder(blocks).ordered.map(b => b.label))
            .toEqual(['Reglas', 'Mundo', 'Ficha del grupo', 'Estado del combate']);
    });

    test('a prompt with nothing volatile has no boundary to report', () => {
        const { boundary, volatileTokens } = describeOrder([blocks[1], blocks[3]]);
        expect(boundary).toBe('');
        expect(volatileTokens).toBe(0);
    });

    test('junk in the list does not throw', () => {
        expect(describeOrder(null).ordered).toEqual([]);
        expect(describeOrder([null, { key: 'raro' }]).ordered).toHaveLength(1);
    });
});

describe('who injected a block', () => {
    // Each injector clears its own orphaned keys by prefix. Without the source in the
    // key, the dynamic context would wipe the blocks active instructions just wrote.
    test('two injectors do not share a namespace', async () => {
        const { isPromptKey } = await import('../public/scripts/game-engine/cost/prompt-order.js');
        const dyn = promptKey('quest', '7', 'dyn');
        const instr = promptKey('custom', '7', 'instr');

        expect(isPromptKey(dyn, 'dyn')).toBe(true);
        expect(isPromptKey(dyn, 'instr')).toBe(false);
        expect(isPromptKey(instr, 'instr')).toBe(true);
    });

    test('anything that is not ours is not ours', async () => {
        const { isPromptKey } = await import('../public/scripts/game-engine/cost/prompt-order.js');
        expect(isPromptKey('CUSTOM_INSTR_3')).toBe(false);
        expect(isPromptKey('')).toBe(false);
        expect(isPromptKey(promptKey('rules', 'x'))).toBe(true);
    });

    test('the source does not disturb the order', () => {
        const keys = [promptKey('party', 'a', 'instr'), promptKey('rules', 'b', 'dyn')];
        expect(sortLikeSillyTavern(keys)[0]).toContain('_rules_');
    });
});
