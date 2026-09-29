import { describe, expect, test } from '@jest/globals';
import { TEXT_SIZES, TEXT_SPEEDS, readChoice, nextChoice } from '../public/scripts/game-engine/ui/game-options.js';

describe('las opciones del juego (J0.4)', () => {
    test('lo guardado se lee; lo que no se entiende, como la primera', () => {
        expect(readChoice(TEXT_SIZES, 'grande').label).toBe('Grande');
        expect(readChoice(TEXT_SIZES, 'gigante').id).toBe('normal');
        expect(readChoice(TEXT_SPEEDS, null).seconds).toBe(0);
    });

    test('pulsar pasa a la siguiente y da la vuelta', () => {
        expect(nextChoice(TEXT_SIZES, 'normal').id).toBe('grande');
        expect(nextChoice(TEXT_SIZES, 'enorme').id).toBe('normal');
        expect(TEXT_SPEEDS.map(s => nextChoice(TEXT_SPEEDS, s.id).id)).toEqual(['suave', 'pausada', 'momento']);
    });

    test('más grande es más grande, y más pausado tarda más', () => {
        const scales = TEXT_SIZES.map(s => s.scale);
        const seconds = TEXT_SPEEDS.map(s => s.seconds);
        expect([...scales].sort((a, b) => a - b)).toEqual(scales);
        expect([...seconds].sort((a, b) => a - b)).toEqual(seconds);
        expect(scales[0]).toBe(1);
        expect(seconds[0]).toBe(0);
    });
});
