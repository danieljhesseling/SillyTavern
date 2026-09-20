import { describe, test, expect } from '@jest/globals';
import {
    entry,
    rollEntry,
    append,
    buildEpiloguePrompt,
    MAX_ENTRIES,
} from '../public/scripts/game-engine/ui/combat-log.js';

describe('entry', () => {
    test('keeps a known kind', () => {
        expect(entry('attack', 'ataca').kind).toBe('attack');
    });

    test('falls back to info for an unknown kind', () => {
        expect(entry('explodes', 'x').kind).toBe('info');
    });

    test('carries extra fields', () => {
        expect(entry('move', 'avanza', { actor: 'Lyra', round: 2 }))
            .toMatchObject({ actor: 'Lyra', round: 2 });
    });

    test('non-string text is coerced', () => {
        expect(entry('info', null).text).toBe('');
        expect(entry('info', 42).text).toBe('42');
    });
});

describe('rollEntry', () => {
    test('a natural 20 is a crit whatever the target number', () => {
        const result = rollEntry('Lyra', { formula: '1d20+5', rolls: [20], total: 25, natural: 20 }, 99, 'ataca');
        expect(result.kind).toBe('crit');
    });

    test('a natural 1 misses whatever the total', () => {
        const result = rollEntry('Lyra', { formula: '1d20+5', rolls: [1], total: 6, natural: 1 }, 2, 'ataca');
        expect(result.kind).toBe('miss');
    });

    test('compares against the target number', () => {
        const hit = rollEntry('Lyra', { formula: '1d20+5', rolls: [12], total: 17, natural: 12 }, 15, 'ataca');
        const miss = rollEntry('Lyra', { formula: '1d20+5', rolls: [4], total: 9, natural: 4 }, 15, 'ataca');
        expect(hit.kind).toBe('hit');
        expect(miss.kind).toBe('miss');
    });

    test('with no target number anything non-critical counts as a hit', () => {
        const result = rollEntry('Lyra', { formula: '1d20', rolls: [7], total: 7, natural: 7 }, null, 'tira');
        expect(result.kind).toBe('hit');
    });

    test('keeps the breakdown so the player can audit it', () => {
        const result = rollEntry('Lyra', { formula: '1d20+5', rolls: [12], total: 17, natural: 12 }, 15, 'ataca');
        expect(result.roll).toEqual({ formula: '1d20+5', rolls: [12], total: 17, natural: 12, dc: 15 });
    });
});

describe('append', () => {
    test('adds to the end without mutating', () => {
        const before = [entry('info', 'uno')];
        const after = append(before, entry('info', 'dos'));
        expect(before).toHaveLength(1);
        expect(after).toHaveLength(2);
    });

    test('tolerates a missing list', () => {
        expect(append(null, entry('info', 'x'))).toHaveLength(1);
    });

    test('drops the oldest once full', () => {
        let entries = [];
        for (let i = 0; i < MAX_ENTRIES + 25; i++) {
            entries = append(entries, entry('info', `linea ${i}`));
        }
        expect(entries).toHaveLength(MAX_ENTRIES);
        expect(entries[0].text).toBe('linea 25');
        expect(entries[entries.length - 1].text).toBe(`linea ${MAX_ENTRIES + 24}`);
    });
});

describe('buildEpiloguePrompt', () => {
    const entries = [
        entry('crit', 'parte el escudo de un tajo', { actor: 'Lyra' }),
        entry('miss', 'falla', { actor: 'Brand' }),
    ];

    test('states the outcome and the length', () => {
        const prompt = buildEpiloguePrompt(entries, {
            rounds: 4, victory: true, survivors: ['Lyra'], defeated: ['Goblin'],
        });
        expect(prompt).toContain('ganado');
        expect(prompt).toContain('4 rondas');
    });

    test('gets the singular right for a one-round fight', () => {
        const prompt = buildEpiloguePrompt([], { rounds: 1, victory: true, survivors: [], defeated: [] });
        expect(prompt).toContain('1 ronda.');
        expect(prompt).not.toContain('1 rondas');
    });

    test('reports a defeat', () => {
        const prompt = buildEpiloguePrompt([], { rounds: 2, victory: false, survivors: [], defeated: [] });
        expect(prompt).toContain('derrotado');
    });

    test('mentions the killing blow when there was one', () => {
        const prompt = buildEpiloguePrompt(entries, {
            rounds: 3, victory: true, survivors: ['Lyra'], defeated: ['Goblin'],
            killingBlow: { actor: 'Lyra', target: 'Goblin' },
        });
        expect(prompt).toContain('golpe final');
        expect(prompt).toContain('Lyra');
    });

    test('includes critical moments', () => {
        const prompt = buildEpiloguePrompt(entries, { rounds: 4, victory: true, survivors: [], defeated: [] });
        expect(prompt).toContain('parte el escudo');
    });

    // The epilogue only saves money if it stays small.
    test('stays short even after a long fight', () => {
        let long = [];
        for (let i = 0; i < 200; i++) {
            long = append(long, entry('crit', `golpe critico numero ${i}`, { actor: `Heroe${i}` }));
        }
        const prompt = buildEpiloguePrompt(long, {
            rounds: 12, victory: true, survivors: ['Lyra', 'Brand'], defeated: ['A', 'B', 'C'],
        });
        expect(prompt.length).toBeLessThan(700);
    });

    test('always forbids the model from inventing results', () => {
        const prompt = buildEpiloguePrompt([], { rounds: 1, victory: true, survivors: [], defeated: [] });
        expect(prompt).toContain('No inventes');
    });
});
