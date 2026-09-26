import fs from 'node:fs';
import { describe, test, expect } from '@jest/globals';
import { readPremadeHeroes } from '../public/scripts/game-engine/campaign/premade-heroes.js';
import { createPet } from '../public/scripts/game-engine/campaign/pet.js';
import { getSectionSchema } from '../public/scripts/game-engine/campaign/campaign-pack-schema.js';

describe('T5: el héroe hecho llega con su mascota', () => {
    test('la mascota se lee del héroe, en castellano o en inglés, y se puede crear tal cual', () => {
        const { heroes } = readPremadeHeroes([
            { name: 'Fray Rodrigo', race: 'Humano', className: 'Clérigo', mascota: { nombre: 'Salmo', especie: 'Cuervo', caracter: 'Cínica' } },
            { name: 'Ulrich', race: 'Humano', className: 'Soldado', pet: { name: 'Tizón', species: 'perro' } },
            { name: 'Inés', race: 'Humano', className: 'Erudito', pet: { name: '', species: 'gato' } },
        ]);
        expect(heroes[0].pet).toEqual({ name: 'Salmo', species: 'cuervo', character: 'cinica' });
        expect(heroes[1].pet).toEqual({ name: 'Tizón', species: 'perro', character: 'leal' });
        expect(heroes[2].pet).toBeUndefined();
        expect(createPet(/** @type {any} */ (heroes[0].pet))).toMatchObject({ name: 'Salmo', species: 'cuervo', character: 'cinica' });
    });

    test('en los mundos para elegir, el tercer héroe de cada uno llega con una mascota que existe', () => {
        const data = JSON.parse(fs.readFileSync(new URL('../public/mundos/mundos.json', import.meta.url), 'utf8'));
        const worlds = Array.isArray(data) ? data : data.worlds;
        for (const world of worlds) {
            const { heroes } = readPremadeHeroes(world.heroes);
            expect(heroes[0].pet).toBeUndefined();
            expect(heroes[2].pet).toBeDefined();
            expect(createPet(/** @type {any} */ (heroes[2].pet))).not.toBeNull();
        }
    });

    test('el paquete lo puede decir', () => {
        const schema = /** @type {any} */ (getSectionSchema('heroes'));
        expect(schema.items.properties.pet.properties.species.enum).toEqual(expect.arrayContaining(['perro', 'cuervo', 'familiar']));
    });
});
