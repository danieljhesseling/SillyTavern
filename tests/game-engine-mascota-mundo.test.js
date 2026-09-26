import { describe, test, expect } from '@jest/globals';
import { moodToward, reactionsHere, RECEPTION, CONTRARIAN_EVERY } from '../public/scripts/game-engine/campaign/pet-reception.js';
import { readPet, createPet } from '../public/scripts/game-engine/campaign/pet.js';

describe('T3: el mundo ve a la mascota', () => {
    const npcs = [
        { name: 'Giles', where: 'El Pueblo de Barro', service: 'posada' },
        { name: 'Vera', where: 'El Pueblo de Barro', service: 'tienda' },
        { name: 'Marta', where: 'El Pueblo de Barro' },
        { name: 'Torres', where: 'Vane', service: 'herreria' },
        { name: 'Muerto', where: 'El Pueblo de Barro', service: 'templo', dead: true },
    ];

    test('cada oficio tiene sus gustos, y a lo que no está le da igual', () => {
        expect(RECEPTION.posada.perro).toBe(-1);
        expect(RECEPTION.herreria.perro).toBe(1);
        expect(moodToward({ species: 'halcon', service: 'posada', npc: 'Giles' })).toBe(0);
        expect(moodToward({ species: 'perro', service: 'nada', npc: 'Giles' })).toBe(0);
    });

    test('una de cada cinco personas piensa lo contrario, siempre la misma', () => {
        const names = Array.from({ length: 200 }, (_, i) => `Persona ${i}`);
        const contrarians = names.filter(npc => moodToward({ species: 'perro', service: 'herreria', npc }) === -1);
        expect(contrarians.length).toBeGreaterThan(200 / CONTRARIAN_EVERY / 2);
        expect(contrarians.length).toBeLessThan((200 / CONTRARIAN_EVERY) * 2);
        for (const npc of contrarians.slice(0, 5)) expect(moodToward({ species: 'perro', service: 'herreria', npc })).toBe(-1);
    });

    test('reaccionan los de oficio de aquí, vivos, que no la habían visto; y lo dicen', () => {
        const pet = { name: 'Canelo', species: 'perro' };
        const out = reactionsHere({ pet, npcs, here: 'el pueblo de barro', speciesLabel: 'perro' });
        expect(out.map(r => r.npc)).toEqual(['Giles', 'Vera'].filter(n => moodToward({ species: 'perro', service: n === 'Giles' ? 'posada' : 'tienda', npc: n }) !== 0));
        for (const r of out) {
            expect(r.line).toMatch(r.mood > 0 ? /^.+ se agacha a saludar a Canelo: «Qué buen perro\. Aquí es bienvenido\.»$/ : /^.+ mira a Canelo de reojo: «Ese perro, fuera de mi vista\.»$/);
        }
        expect(reactionsHere({ pet, npcs, here: 'El Pueblo de Barro', met: ['Giles', 'Vera'] })).toEqual([]);
        expect(reactionsHere({ pet: null, npcs, here: 'El Pueblo de Barro' })).toEqual([]);
    });

    test('la mascota recuerda a quién ha visto; una nueva no conoce a nadie', () => {
        expect(createPet({ name: 'Canelo', species: 'perro' })?.met).toEqual([]);
        expect(readPet({ name: 'Canelo', species: 'perro', met: ['Giles', 'Giles', '', 'Vera'] })?.met).toEqual(['Giles', 'Vera']);
    });
});
