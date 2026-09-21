import { describe, test, expect } from '@jest/globals';
import {
    roughTokens,
    extractBlocks,
    labelBlock,
    describePrompt,
    emptySession,
    addTurn,
    estimateSpend,
    splitFixedFromConversation,
    SOURCE_PATTERNS,
} from '../public/scripts/game-engine/cost/prompt-meter.js';

/** A chat-completion request shaped like the ones the app builds. */
const CHAT_REQUEST = {
    messages: [
        { role: 'system', content: 'Eres el narrador de una campaña de rol.' },
        { role: 'system', content: '[DYN_COMBAT: Tono urgente]\nFrases cortas en combate.' },
        { role: 'system', content: 'Lyra HP: 12/12 AC: 15 Inventario: espada corta' },
        { role: 'user', content: 'Ataco al goblin' },
        { role: 'assistant', content: 'El goblin retrocede sangrando.' },
    ],
};

describe('reading a request whatever API built it', () => {
    test('chat completion yields one block per message', () => {
        expect(extractBlocks(CHAT_REQUEST)).toHaveLength(5);
    });

    test('text completion yields the single prompt', () => {
        const blocks = extractBlocks({ prompt: 'Un prompt de texto plano' });
        expect(blocks).toHaveLength(1);
        expect(blocks[0].text).toBe('Un prompt de texto plano');
    });

    test('empty messages are dropped rather than counted as blocks', () => {
        expect(extractBlocks({ messages: [{ role: 'system', content: '   ' }] })).toEqual([]);
    });

    test('multimodal content contributes its text and nothing else', () => {
        const blocks = extractBlocks({
            messages: [{ role: 'user', content: [{ type: 'text', text: 'mira esto' }, { type: 'image_url' }] }],
        });
        expect(blocks[0].text).toContain('mira esto');
    });

    test('junk in place of a request is not an error', () => {
        for (const value of [null, undefined, 'texto', 42, {}]) {
            expect(extractBlocks(value)).toEqual([]);
        }
    });
});

describe('naming a block by what it holds', () => {
    test('recognises the context the fork injects', () => {
        expect(labelBlock({ role: 'system', text: '[DYN_SOCIAL: Tono]' })).toBe('Contexto dinámico');
    });

    test('recognises a party sheet', () => {
        expect(labelBlock({ role: 'system', text: 'Brand HP: 9/14 AC: 13' })).toBe('Ficha del grupo');
    });

    test('falls back to the role, never to a blank label', () => {
        expect(labelBlock({ role: 'user', text: 'hola' })).toBe('Mensajes del jugador');
        expect(labelBlock({ role: 'rarito', text: 'hola' })).toBe('rarito');
    });

    test('every pattern is a usable regex with a label', () => {
        for (const { label, test: pattern } of SOURCE_PATTERNS) {
            expect(label).toBeTruthy();
            expect(pattern).toBeInstanceOf(RegExp);
        }
    });
});

describe('describing a whole turn', () => {
    test('groups blocks by label and sorts them biggest first', () => {
        const { blocks } = describePrompt(CHAT_REQUEST);
        const sizes = blocks.map(b => b.tokens);
        expect([...sizes].sort((a, b) => b - a)).toEqual(sizes);
    });

    test('adds up to the sum of its parts', () => {
        const { blocks, totalTokens } = describePrompt(CHAT_REQUEST);
        expect(totalTokens).toBe(blocks.reduce((sum, b) => sum + b.tokens, 0));
    });

    test('uses the real tokenizer when given one, and says it is not estimating', () => {
        const { totalTokens, estimated } = describePrompt(CHAT_REQUEST, () => 100);
        expect(estimated).toBe(false);
        expect(totalTokens).toBe(500);
    });

    // A number presented as fact when it is a guess is how this project went wrong once.
    test('marks itself as an estimate when it had to approximate', () => {
        expect(describePrompt(CHAT_REQUEST).estimated).toBe(true);
    });

    test('an empty request describes nothing instead of throwing', () => {
        expect(describePrompt(null)).toMatchObject({ blocks: [], totalTokens: 0 });
    });

    test('each block keeps a preview, so you can see what it actually is', () => {
        for (const block of describePrompt(CHAT_REQUEST).blocks) {
            expect(block.preview.length).toBeGreaterThan(0);
            expect(block.preview.length).toBeLessThanOrEqual(400);
        }
    });
});

describe('the ratio that decides whether a campaign gets dearer', () => {
    test('separates what is resent every turn from the conversation', () => {
        const { blocks } = describePrompt(CHAT_REQUEST);
        const { fixed, conversation, ratio } = splitFixedFromConversation(blocks);

        expect(fixed).toBeGreaterThan(0);
        expect(conversation).toBeGreaterThan(0);
        expect(ratio).toBeCloseTo(fixed / (fixed + conversation), 5);
    });

    test('a request that is all context is all fixed', () => {
        expect(splitFixedFromConversation([{ label: 'Ficha del grupo', tokens: 50 }]).ratio).toBe(1);
    });

    test('nothing at all is not a division by zero', () => {
        expect(splitFixedFromConversation([])).toEqual({ fixed: 0, conversation: 0, ratio: 0 });
    });
});

describe('what the session has cost', () => {
    test('a fresh session has spent nothing', () => {
        expect(emptySession()).toMatchObject({ turns: 0, promptTokens: 0 });
    });

    test('each turn adds to the total without mutating the previous one', () => {
        const first = emptySession();
        const second = addTurn(first, { totalTokens: 100, blocks: [{ label: 'A', tokens: 100 }], estimated: true });

        expect(first.turns).toBe(0);
        expect(second).toMatchObject({ turns: 1, promptTokens: 100, largestTurn: 100, largestBlock: 'A' });
    });

    test('remembers the biggest turn and what made it big', () => {
        let session = emptySession();
        session = addTurn(session, { totalTokens: 100, blocks: [{ label: 'Pequeño', tokens: 100 }] });
        session = addTurn(session, { totalTokens: 900, blocks: [{ label: 'Lorebook', tokens: 900 }] });
        session = addTurn(session, { totalTokens: 50, blocks: [{ label: 'Otro', tokens: 50 }] });

        expect(session).toMatchObject({ turns: 3, promptTokens: 1050, largestTurn: 900, largestBlock: 'Lorebook' });
    });

    test('one estimated turn makes the whole session an estimate', () => {
        let session = addTurn(emptySession(), { totalTokens: 10, blocks: [], estimated: false });
        session = addTurn(session, { totalTokens: 10, blocks: [], estimated: true });
        expect(session.estimated).toBe(true);
    });

    test('a junk turn does not corrupt the running total', () => {
        expect(addTurn(emptySession(), {})).toMatchObject({ turns: 1, promptTokens: 0 });
        expect(addTurn(emptySession(), null)).toMatchObject({ turns: 1, promptTokens: 0 });
    });
});

describe('estimateSpend', () => {
    const session = { turns: 4, promptTokens: 2000000, largestTurn: 0, largestBlock: '', estimated: true };

    test('converts tokens to money at the price you give it', () => {
        expect(estimateSpend(session, 3).spend).toBeCloseTo(6, 5);
    });

    test('reports tokens per turn, which is the number you can act on', () => {
        expect(estimateSpend(session, 3).perTurn).toBe(500000);
    });

    // Rates change and differ per provider; a hard-coded one would be believed.
    test('with no price it reports tokens and no money at all', () => {
        expect(estimateSpend(session, 0).spend).toBe(0);
        expect(estimateSpend(session, null).spend).toBe(0);
        expect(estimateSpend(session, 'gratis').spend).toBe(0);
    });

    test('an empty session divides by zero turns without producing NaN', () => {
        expect(estimateSpend(emptySession(), 3)).toEqual({ tokens: 0, spend: 0, perTurn: 0 });
    });
});

describe('roughTokens', () => {
    test('grows with the text', () => {
        expect(roughTokens('x'.repeat(400))).toBeGreaterThan(roughTokens('x'.repeat(40)));
    });

    test('empty text costs nothing', () => {
        expect(roughTokens('')).toBe(0);
        expect(roughTokens(null)).toBe(0);
    });
});
