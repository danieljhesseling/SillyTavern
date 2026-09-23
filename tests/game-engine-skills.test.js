import fs from 'node:fs';
import { describe, test, expect } from '@jest/globals';
import { createCompendium, validateBattery } from '../public/scripts/game-engine/compendio/compendio.js';
import {
    CLOSED_FIELDS, validateAbility, validateAbilities, asAbility,
    abilitiesFor, classesOf, nameAndAbility,
} from '../public/scripts/game-engine/compendio/skills.js';
import { ABILITY_RESOURCES } from '../public/scripts/game-engine/rules/abilities.js';

const habilidades = JSON.parse(fs.readFileSync(
    new URL('../public/compendio/habilidades.json', import.meta.url), 'utf8',
));

const real = () => createCompendium({ habilidades: habilidades.rows });

const ok = (extra = {}) => ({
    id: 'x', name: 'Algo', note: 'Hace algo.',
    cost: 'action', resource: 'at_will', target: 'enemy', resolution: 'attack', ...extra,
});

describe('la batería de habilidades', () => {
    test('habilidades.json pasa su propia validación', () => {
        expect(validateBattery('habilidades', habilidades)).toEqual([]);
    });

    // La que de verdad importa: un valor fuera de vocabulario pasa la validación de
    // arriba y luego no hace lo que dice.
    test('y ninguna usa un valor que el motor no conoce', () => {
        expect(validateAbilities(real())).toEqual([]);
    });

    test('cada clase que se menciona tiene con qué empezar a nivel 1', () => {
        for (const className of classesOf(real())) {
            expect(abilitiesFor({ compendium: real(), className, level: 1 }).length)
                .toBeGreaterThanOrEqual(3);
        }
    });

    test('y hay cosas que sabe cualquiera, para no repetirlas en cada clase', () => {
        const común = habilidades.rows.filter(r => (r.when?.class ?? []).includes('*'));
        expect(común.length).toBeGreaterThanOrEqual(3);
    });
});

describe('los cuatro vocabularios cerrados', () => {
    test('una fila correcta no tiene nada que decir', () => {
        expect(validateAbility(ok())).toEqual([]);
    });

    // `per_long_rest` se convertía en `at_will` sin avisar, y una habilidad de una vez al
    // día pasaba a poder usarse cada turno.
    test('un recurso inventado se caza, y se dice cuáles valen', () => {
        const [message] = validateAbility(ok({ resource: 'per_long_rest', usesPerRest: 1 }));
        expect(message).toMatch(/per_long_rest/);
        expect(message).toContain(ABILITY_RESOURCES.join(', '));
    });

    test('y lo mismo con coste, objetivo y resolución', () => {
        for (const field of Object.keys(CLOSED_FIELDS)) {
            expect(validateAbility(ok({ [field]: 'inventado' })).join(' ')).toMatch(/no existe/);
        }
    });

    test('un campo que falta también se dice', () => {
        expect(validateAbility(ok({ target: '' })).join(' ')).toMatch(/falta "target"/);
    });

    // Un número que nadie mira es peor que no ponerlo.
    test('usos por descanso en algo a voluntad no pinta nada', () => {
        expect(validateAbility(ok({ resource: 'at_will', usesPerRest: 2 })).join(' '))
            .toMatch(/no pinta nada/);
    });

    test('y lo que se gasta tiene que decir cuántas veces', () => {
        expect(validateAbility(ok({ resource: 'long_rest' })).join(' '))
            .toMatch(/cuántas veces/);
    });

    // El describeAbility del motor escribe «salvación CD undefined» y nadie sabe contra qué
    // se tiraba.
    test('una salvación tiene que decir contra qué CD', () => {
        expect(validateAbility(ok({ resolution: 'save' })).join(' ')).toMatch(/saveDc/);
        expect(validateAbility(ok({ resolution: 'save', saveDc: 13, damage: '1d6' }))).toEqual([]);
    });

    test('y una CD en algo que no se salva sobra', () => {
        expect(validateAbility(ok({ resolution: 'attack', saveDc: 13 })).join(' '))
            .toMatch(/no pide salvación/);
    });

    // El motor tira la salvacion del OBJETIVO: sobre uno mismo no hay nadie al otro lado.
    test('una salvación sobre uno mismo no salva nadie', () => {
        expect(validateAbility(ok({ resolution: 'save', saveDc: 12, target: 'self' })).join(' '))
            .toMatch(/no salva nadie/);
    });

    // Tirar un dado y que no cambie nada en el tablero.
    test('y una salvación que no deja nada detrás se dice', () => {
        expect(validateAbility(ok({ resolution: 'save', saveDc: 12 })).join(' '))
            .toMatch(/se salva de nada/);
        expect(validateAbility(ok({ resolution: 'save', saveDc: 12, condition: 'Prone' }))).toEqual([]);
    });

    // Casi siempre es una fila mal copiada.
    test('curar a un enemigo o hacerse daño a uno mismo se dicen', () => {
        expect(validateAbility(ok({ healing: '1d8', target: 'enemy' })).join(' '))
            .toMatch(/apunta a un enemigo/);
        expect(validateAbility(ok({ damage: '1d8', target: 'self', resolution: 'auto' })).join(' '))
            .toMatch(/apunta a uno mismo/);
    });
});

describe('traducir una fila a ficha de habilidad', () => {
    test('sale con lo que el catálogo del motor lee', () => {
        const ability = asAbility(ok({ note: 'Quema.', damage: '1d10', damageType: 'Fire', rangeFeet: 120 }));
        expect(ability).toEqual({
            id: 'x', name: 'Algo', description: 'Quema.',
            cost: 'action', resource: 'at_will', target: 'enemy', resolution: 'attack',
            rangeFeet: 120, damage: '1d10', damageType: 'Fire',
        });
    });

    // `party.js` saca el modificador de la salvación de `saveAbility`, y el combate lee
    // `condition`: sin pasarlos, «Sueño pesado» tiraba el dado y no dormía a nadie.
    test('lleva con qué se salva y qué deja detrás', () => {
        const ability = asAbility(ok({
            resolution: 'save', saveDc: 13, saveAbility: 'wisdom',
            condition: 'Unconscious', conditionRounds: 2,
        }));
        expect(ability.saveDc).toBe(13);
        expect(ability.saveAbility).toBe('wisdom');
        expect(ability.condition).toBe('Unconscious');
        expect(ability.conditionRounds).toBe(2);
    });

    // Un `usesPerRest: 0` en algo a voluntad sería un cero que el panel dibuja.
    test('y lo que no aplica no aparece', () => {
        expect(asAbility(ok())).not.toHaveProperty('usesPerRest');
        expect(asAbility(ok())).not.toHaveProperty('healing');
    });
});

describe('lo que sabe hacer una clase', () => {
    test('sin batería no sabe nada, y no revienta', () => {
        expect(abilitiesFor({ compendium: createCompendium({}), className: 'picaro' })).toEqual([]);
    });

    test('lo suyo y lo de todos, y nada de otra clase', () => {
        const byId = new Map(habilidades.rows.map(r => [r.id, r]));
        for (const ability of abilitiesFor({ compendium: real(), className: 'mago', level: 3 })) {
            const classes = byId.get(ability.id).when.class;
            expect(classes.includes('mago') || classes.includes('*')).toBe(true);
        }
    });

    // Elegir «Pícara» tiene que significar algo distinto de elegir «Clérigo».
    test('dos clases no saben lo mismo', () => {
        const picaro = abilitiesFor({ compendium: real(), className: 'picaro', level: 3 }).map(a => a.id);
        const clerigo = abilitiesFor({ compendium: real(), className: 'clerigo', level: 3 }).map(a => a.id);
        expect(picaro.join()).not.toBe(clerigo.join());
        expect(picaro.some(id => !clerigo.includes(id))).toBe(true);
    });

    test('a nivel 1 no se sabe lo de nivel 3', () => {
        const uno = abilitiesFor({ compendium: real(), className: 'druida', level: 1 });
        const tres = abilitiesFor({ compendium: real(), className: 'druida', level: 3 });
        expect(tres.length).toBeGreaterThan(uno.length);
    });

    test('y sin clase solo sale lo que sabe cualquiera', () => {
        const byId = new Map(habilidades.rows.map(r => [r.id, r]));
        for (const ability of abilitiesFor({ compendium: real(), className: '', level: 9 })) {
            expect(byId.get(ability.id).when.class).toContain('*');
        }
    });

    test('una clase que nadie escribió se queda con lo común', () => {
        const none = abilitiesFor({ compendium: real(), className: 'alquimista', level: 5 });
        expect(none.length).toBeGreaterThan(0);
    });
});

describe('contada en una línea', () => {
    // Lo de detrás lo cuenta el describeAbility del motor: dos versiones de lo mismo son
    // dos sitios donde arreglar el mismo fallo.
    test('el nombre delante, y lo que cuesta detrás', () => {
        const line = nameAndAbility(asAbility(ok({
            name: 'Furia', cost: 'bonus', resource: 'long_rest', usesPerRest: 2,
            target: 'self', resolution: 'auto',
        })));
        expect(line.startsWith('Furia · ')).toBe(true);
        expect(line).toMatch(/2x por descanso largo/);
    });

    test('y sin habilidad, nada', () => {
        expect(nameAndAbility(null)).toBe('');
    });
});

describe('lo que la lista no puede decir', () => {
    // Sin alcance, el describeAbility del motor escribe «undefined ft».
    test('ninguna línea sale con un hueco sin rellenar', () => {
        for (const className of classesOf(real())) {
            for (const ability of abilitiesFor({ compendium: real(), className, level: 3 })) {
                expect(nameAndAbility(ability)).not.toMatch(/undefined|NaN/);
            }
        }
    });
});
