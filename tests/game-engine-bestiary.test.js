import fs from 'node:fs';
import { describe, test, expect } from '@jest/globals';
import { createCompendium, validateBattery } from '../public/scripts/game-engine/compendio/compendio.js';
import {
    PROFILES, MAX_TEMPLATES, baselineFor, archetypeCost, breedName,
    breedMonster, breedBand, describeMonster,
} from '../public/scripts/game-engine/compendio/bestiary.js';

const bestiario = JSON.parse(fs.readFileSync(
    new URL('../public/compendio/bestiario.json', import.meta.url), 'utf8',
));

const archetypes = bestiario.rows.filter(r => r.kind === 'arquetipo');
const templates = bestiario.rows.filter(r => r.kind === 'plantilla');

/** La biblioteca de verdad, la que viene escrita. */
const real = (config) => createCompendium({ bestiario: bestiario.rows }, config);

/** Un azar repetible. */
const rolling = (seed) => {
    let state = seed;
    return () => ((state = (state * 9301 + 49297) % 233280) / 233280);
};

describe('la batería que viene escrita', () => {
    test('bestiario.json pasa su propia validación', () => {
        expect(validateBattery('bestiario', bestiario)).toEqual([]);
    });

    test('trae arquetipos y plantillas, que son las dos mitades', () => {
        expect(archetypes.length).toBeGreaterThanOrEqual(20);
        expect(templates.length).toBeGreaterThanOrEqual(15);
    });

    test('cada arquetipo juega uno de los cuatro perfiles que el motor mueve', () => {
        for (const row of archetypes) expect(PROFILES).toContain(row.profile);
    });

    // Un bicho sin debilidad es un saco de puntos de vida: lo que convierte un combate en
    // un problema es saber por dónde se le hace daño.
    test('y todos traen debilidad y manía, que es lo que los hace jugables', () => {
        for (const row of archetypes) {
            expect(String(row.weakness || '').length).toBeGreaterThan(10);
            expect(String(row.quirk || '').length).toBeGreaterThan(10);
        }
    });

    test('el género está puesto, que es lo que concuerda el adjetivo', () => {
        for (const row of archetypes) expect(['m', 'f']).toContain(row.gender);
    });

    test('y las plantillas traen las dos formas del adjetivo, o un lugar', () => {
        for (const row of templates) {
            if (String(row.pattern).includes('{lugar}')) expect(String(row.lugar || '').length).toBeGreaterThan(2);
            else {
                expect(String(row.adj || '').length).toBeGreaterThan(2);
                expect(String(row.adjf || '').length).toBeGreaterThan(2);
            }
        }
    });

    // Vida y armadura salen de la misma bolsa: uno que aguanta el doble Y es más difícil
    // de acertar no es una variante, es un error de escritura.
    test('ninguno se pasa de presupuesto', () => {
        for (const row of archetypes) {
            const cost = archetypeCost(row);
            expect(cost).toBeGreaterThan(-8);
            expect(cost).toBeLessThan(9);
        }
    });

    test('y el bestiario entero está más o menos centrado', () => {
        const average = archetypes.reduce((sum, r) => sum + archetypeCost(r), 0) / archetypes.length;
        expect(Math.abs(average)).toBeLessThan(4);
    });
});

describe('la línea base del desafío', () => {
    // Escribir "35 puntos de vida" en una ficha la ata a un nivel concreto, y por eso los
    // bestiarios envejecen mal. Aquí los números son relativos.
    test('un desafío mayor da más vida y más armadura', () => {
        expect(baselineFor(2).hp).toBeGreaterThan(baselineFor(0.25).hp);
        expect(baselineFor(6).armorClass).toBeGreaterThan(baselineFor(0).armorClass);
    });

    test('y un desafío raro no la rompe', () => {
        expect(baselineFor(0).hp).toBeGreaterThan(0);
        expect(baselineFor(-3).hp).toBeGreaterThan(0);
        expect(baselineFor(NaN).hp).toBeGreaterThan(0);
    });
});

describe('el nombre concuerda', () => {
    const lobo = { name: 'Lobo', gender: 'm' };
    const arana = { name: 'Araña', gender: 'f' };
    const rabioso = { pattern: '{bicho} {adj}', adj: 'rabioso', adjf: 'rabiosa' };
    const minas = { pattern: '{bicho} de {lugar}', lugar: 'las minas' };

    test('en masculino y en femenino', () => {
        expect(breedName(lobo, [rabioso], () => 0)).toBe('Lobo rabioso');
        expect(breedName(arana, [rabioso], () => 0)).toBe('Araña rabiosa');
    });

    test('un lugar no se concuerda, porque es un lugar', () => {
        expect(breedName(arana, [minas], () => 0)).toBe('Araña de las minas');
    });

    test('y dos plantillas se apilan en orden', () => {
        expect(breedName(lobo, [rabioso, minas], () => 0)).toBe('Lobo rabioso de las minas');
    });

    test('sin plantillas, el bicho se llama como se llama', () => {
        expect(breedName(lobo, [], () => 0)).toBe('Lobo');
    });
});

describe('criar un bicho', () => {
    test('sin batería no hay bicho, y no revienta', () => {
        expect(breedMonster({ compendium: createCompendium({}), random: () => 0.5 })).toBe(null);
    });

    test('sale con los campos que la ficha de enemigo pide', () => {
        const monster = breedMonster({ compendium: real(), cr: 1, random: rolling(7) });
        expect(Object.keys(monster).sort()).toEqual([
            'armorClass', 'attackRangeFeet', 'cr', 'description', 'from',
            'hp', 'name', 'profile', 'speed',
        ]);
        expect(PROFILES).toContain(monster.profile);
    });

    test('el desafío manda sobre la vida', () => {
        const random = rolling(3);
        const weak = breedMonster({ compendium: real(), cr: 0.25, templates: 0, random });
        const strong = breedMonster({ compendium: real(), cr: 5, templates: 0, random: rolling(3) });
        expect(strong.hp).toBeGreaterThan(weak.hp);
    });

    test('y nada sale con números imposibles', () => {
        const random = rolling(5);
        for (let i = 0; i < 300; i++) {
            const monster = breedMonster({ compendium: real(), cr: 1, random });
            expect(monster.hp).toBeGreaterThanOrEqual(1);
            expect(monster.armorClass).toBeGreaterThanOrEqual(5);
            expect(monster.speed).toBeGreaterThanOrEqual(5);
            expect(monster.attackRangeFeet).toBeGreaterThanOrEqual(5);
            expect(monster.cr).toBeGreaterThanOrEqual(0);
            expect(monster.name).not.toMatch(/[{}]/);
        }
    });

    test('pedir plantillas las apila, y no más de las que caben', () => {
        const none = breedMonster({ compendium: real(), templates: 0, random: rolling(11) });
        expect(none.from.plantillas).toEqual([]);

        const many = breedMonster({ compendium: real(), templates: 5, random: rolling(11) });
        expect(many.from.plantillas.length).toBeLessThanOrEqual(MAX_TEMPLATES);
    });

    // El pantano no da lobos de nieve, pero un bioma sin bichos escritos tampoco puede
    // dejar el tablero vacío.
    test('el bioma filtra, y un bioma vacío no te deja sin bicho', () => {
        const cripta = breedMonster({ compendium: real(), biome: 'cripta', templates: 0, random: rolling(2) });
        expect(cripta).not.toBe(null);

        const inventado = breedMonster({ compendium: real(), biome: 'luna', random: rolling(2) });
        expect(inventado).not.toBe(null);
    });

    test('la última plantilla manda sobre el perfil, que es lo que dice el nombre', () => {
        const byId = new Map(bestiario.rows.map(r => [r.id, r]));
        const random = rolling(13);
        for (let i = 0; i < 200; i++) {
            const monster = breedMonster({ compendium: real(), random });
            const last = [...monster.from.plantillas].reverse()
                .map(id => byId.get(id)).find(t => PROFILES.includes(t?.profile));
            if (last) expect(monster.profile).toBe(last.profile);
        }
    });

    test('la descripción cuenta su manía y su debilidad', () => {
        const byId = new Map(bestiario.rows.map(r => [r.id, r]));
        const monster = breedMonster({ compendium: real(), templates: 0, random: rolling(17) });
        const archetype = byId.get(monster.from.arquetipo);
        expect(monster.description).toContain(archetype.weakness);
        expect(monster.description).toContain(archetype.quirk);
    });

    test('la misma semilla cría el mismo bicho', () => {
        const once = breedMonster({ compendium: real(), cr: 2, random: rolling(42) });
        const twice = breedMonster({ compendium: real(), cr: 2, random: rolling(42) });
        expect(once).toEqual(twice);
    });
});

describe('una banda', () => {
    // Cinco copias del mismo esqueleto son una pelea; dos matones, un tirador y uno que
    // huye son un problema.
    test('cuatro bichos son cuatro combinaciones distintas', () => {
        const band = breedBand({ compendium: real(), howMany: 4, cr: 1, random: rolling(19) });
        expect(band).toHaveLength(4);
        const keys = band.map(m => `${m.from.arquetipo}|${m.from.plantillas.join(',')}`);
        expect(new Set(keys).size).toBe(4);
    });

    test('sin batería, ninguna', () => {
        expect(breedBand({ compendium: createCompendium({}), howMany: 3, random: () => 0.5 }))
            .toEqual([]);
    });
});

describe('contado en una línea', () => {
    test('dice lo que aguanta y cómo pelea', () => {
        expect(describeMonster({
            name: 'Lobo rabioso', hp: 14, armorClass: 12, cr: 0.5, profile: 'aggressive',
        })).toBe('Lobo rabioso · 14 PG · CA 12 · CR 0.5 · aggressive');
    });
});
