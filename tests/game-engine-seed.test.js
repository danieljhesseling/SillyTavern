import { describe, test, expect } from '@jest/globals';
import {
    SEED_WORDS, SEED_LENGTH, rollSeed, cleanSeed, seedOf, ensureSeed, derive, describeSeed,
} from '../public/scripts/game-engine/campaign/seed.js';

/** Un azar repetible. */
const rolling = (seed) => {
    let state = seed;
    return () => ((state = (state * 9301 + 49297) % 233280) / 233280);
};

describe('tirar una semilla', () => {
    test('salen tres palabras con guiones', () => {
        const seed = rollSeed(rolling(7));
        expect(seed.split('-')).toHaveLength(SEED_LENGTH);
        for (const word of seed.split('-')) expect(SEED_WORDS).toContain(word);
    });

    // Lo que hace que escribir dos veces «una cripta inundada» dé dos criptas distintas.
    test('dos tiradas distintas dan semillas distintas', () => {
        const many = new Set();
        const random = rolling(3);
        for (let i = 0; i < 200; i++) many.add(rollSeed(random));
        expect(many.size).toBeGreaterThan(150);
    });

    test('y la misma tirada da la misma', () => {
        expect(rollSeed(rolling(11))).toBe(rollSeed(rolling(11)));
    });

    // Una semilla se teclea y se dicta: un carácter que obligue a buscar en el teclado es
    // una semilla que nadie comparte.
    test('no hay acentos ni eñes en el saco de palabras', () => {
        for (const word of SEED_WORDS) expect(word).toMatch(/^[a-z]+$/);
    });

    test('hay saco de sobra para no repetirse', () => {
        expect(SEED_WORDS.length ** SEED_LENGTH).toBeGreaterThan(100000);
    });
});

describe('limpiar lo que alguien teclee', () => {
    test('mayúsculas, espacios y basura se van', () => {
        expect(cleanSeed('  Molino Ceniza_Siete. ')).toBe('molino-ceniza-siete');
    });

    // Dos semillas que solo se diferencian en un espacio serían dos mundos distintos, y
    // nadie entendería por qué.
    test('dos formas de escribir lo mismo son lo mismo', () => {
        expect(cleanSeed('molino ceniza')).toBe(cleanSeed('Molino-Ceniza'));
    });

    test('y lo que no deja nada, no es semilla', () => {
        expect(cleanSeed('   ')).toBe('');
        expect(cleanSeed('¡¿!')).toBe('');
        expect(cleanSeed(null)).toBe('');
    });
});

describe('la semilla de un mundo', () => {
    test('se lee de su metadata', () => {
        expect(seedOf({ seed: 'Molino-Ceniza' })).toBe('molino-ceniza');
    });

    // Vacío importa: un mundo sin semilla guardada no es reproducible.
    test('y un mundo sin ella lo dice, en vez de inventarse una', () => {
        expect(seedOf({})).toBe('');
        expect(seedOf(null)).toBe('');
        expect(seedOf({ displayName: 'Molino' })).toBe('');
    });
});

describe('ponerle semilla a un mundo', () => {
    test('uno sin ella se lleva una tirada', () => {
        const { metadata, seed, rolled } = ensureSeed({ displayName: 'x' }, { random: rolling(5) });
        expect(rolled).toBe(true);
        expect(seed.split('-')).toHaveLength(SEED_LENGTH);
        expect(metadata.seed).toBe(seed);
        expect(metadata.displayName).toBe('x');
    });

    test('y se puede pedir una concreta, que es como se juega la de otro', () => {
        const { seed, rolled } = ensureSeed({}, { seed: 'Molino Ceniza Siete' });
        expect(seed).toBe('molino-ceniza-siete');
        expect(rolled).toBe(false);
    });

    // Cambiarle la semilla a una campaña empezada haría que lo que se genere a partir de
    // ahora no pegue con lo que ya se generó.
    test('la que ya tiene no se toca, ni pidiendo otra', () => {
        const { metadata, seed, rolled } = ensureSeed(
            { seed: 'vado-lobo-tres' }, { seed: 'otra-cosa-cuatro' },
        );
        expect(seed).toBe('vado-lobo-tres');
        expect(metadata.seed).toBe('vado-lobo-tres');
        expect(rolled).toBe(false);
    });

    test('y no se destroza lo que hubiera al lado', () => {
        const before = { displayName: 'Molino', genre: 'Oscuro', locationMaps: [1, 2] };
        const { metadata } = ensureSeed(before, { random: rolling(9) });
        expect(metadata.genre).toBe('Oscuro');
        expect(metadata.locationMaps).toEqual([1, 2]);
    });
});

describe('semillas derivadas', () => {
    // Regenerar el botín no puede cambiarte el mapa.
    test('cada cosa tira de su bolsa', () => {
        expect(derive('molino', 'botin', 'sala7')).not.toBe(derive('molino', 'nombres', 3));
    });

    test('la misma pregunta da la misma respuesta', () => {
        expect(derive('molino', 'forja', 2)).toBe(derive('Molino', 'forja', 2));
    });

    test('y mundos distintos no comparten nada', () => {
        expect(derive('molino', 'forja', 1)).not.toBe(derive('vado', 'forja', 1));
    });

    // Sin semilla sigue habiendo partida: lo que no hay es forma de repetirla.
    test('sin semilla se sigue pudiendo derivar, y se nota que no la hay', () => {
        expect(derive('', 'forja', 1)).toBe('sin-semilla|forja|1');
    });
});

describe('contada en una línea', () => {
    test('dice cuál es', () => {
        expect(describeSeed('molino-ceniza-siete')).toContain('molino-ceniza-siete');
    });

    test('y si no hay, lo dice claro', () => {
        expect(describeSeed('')).toMatch(/no tiene semilla/);
    });
});
