import { describe, test, expect } from '@jest/globals';
import {
    ROW_STEPS, domainOf, effectsText, parseEffects, rowForm, applyRowField, rowProblems,
    newRow, mergeRows, worldRowsFor, mergeWorldRows,
} from '../public/scripts/game-engine/campaign/world-rows.js';
import {
    startTaller, ownRows, writeRow, dropRow, blocksNext, toAnswers, stepSlice,
} from '../public/scripts/game-engine/campaign/taller.js';
import { createSeededRandom } from '../public/scripts/game-engine/combat/seeded-random.js';

const humano = {
    id: 'raza-humano', name: 'Humano', kind: 'raza',
    effects: [{ stat: 'charisma', modifier: 1 }, { stat: 'wisdom', modifier: -1 }],
    note: 'Llegan a todo.',
};
const espada = { id: 'arma-espada', name: 'Espada', itemType: 'weapon', damageDice: '1d8' };
const golpe = {
    id: 'hab-golpe', name: 'Golpe', kind: 'habilidad', cost: 'accion', resolution: 'ataque',
    damage: '1d6', rangeFeet: 5, when: { class: ['guerrero'] },
};

describe('las pestañas de filas', () => {
    test('son cinco, y los objetos se reparten entre tres baterías', () => {
        expect(ROW_STEPS).toEqual(['habilidades', 'razas', 'clases', 'objetos', 'bestiario']);
        expect(domainOf('objetos', espada)).toBe('armas');
        expect(domainOf('objetos', { itemType: 'armor' })).toBe('armaduras');
        expect(domainOf('objetos', { itemType: 'tool' })).toBe('trastos');
        expect(domainOf('razas', humano)).toBe('razas');
    });
});

describe('lo que da y lo que quita, escrito como se lee', () => {
    test('se escribe y se vuelve a leer igual', () => {
        const said = effectsText(humano);
        expect(said).toMatch(/Carisma/);
        expect(parseEffects(said).effects).toEqual(humano.effects);
    });

    test('lo que no entiende no se inventa: se dice', () => {
        const read = parseEffects('+2 Fuerza, muy guapo');
        expect(read.effects).toEqual([{ stat: 'strength', modifier: 2 }]);
        expect(read.unread).toEqual(['muy guapo']);
    });
});

describe('retocar una fila', () => {
    test('escribir lo que da cambia los efectos y guarda lo escrito', () => {
        const row = applyRowField('razas', humano, 'effects', '+2 Fuerza, -1 Carisma');
        expect(row.effects).toEqual([{ stat: 'strength', modifier: 2 }, { stat: 'charisma', modifier: -1 }]);
        expect(rowProblems('razas', row)).toEqual([]);
    });

    // Una raza que solo suma se elegiría siempre.
    test('una raza que solo suma, o que no da nada, se dice', () => {
        expect(rowProblems('razas', { name: 'X', effects: [{ stat: 'strength', modifier: 2 }] })[0]).toMatch(/Solo suma/);
        expect(rowProblems('razas', { name: 'X', effects: [] })[0]).toMatch(/No da nada/);
        expect(rowProblems('razas', { name: '' })[0]).toMatch(/nombre/);
    });

    // DR3: la magia no se inventa en datos. Una habilidad nueva funciona como otra.
    test('una habilidad copia de otra cómo funciona, y se queda con su nombre', () => {
        const mine = newRow('habilidades', golpe, 1);
        const other = { id: 'hab-dardo', name: 'Dardo', cost: 'accion', resolution: 'salvacion', damage: '2d4', rangeFeet: 60 };
        const row = applyRowField('habilidades', { ...mine, name: 'Mi dardo' }, 'base', 'hab-dardo', { abilities: [golpe, other] });
        expect(row.name).toBe('Mi dardo');
        expect(row.damage).toBe('2d4');
        expect(row.rangeFeet).toBe(60);
        expect(row.base).toBe('hab-dardo');
    });

    test('la ficha de cada pestaña enseña lo que tiene sentido', () => {
        const keys = (/** @type {string} */ step, /** @type {any} */ row) => rowForm(step, row).map(f => f.key);
        expect(keys('razas', humano)).toEqual(expect.arrayContaining(['name', 'effects', 'note']));
        expect(keys('objetos', espada)).toEqual(expect.arrayContaining(['name', 'damageDice']));
        expect(keys('habilidades', golpe)).toEqual(expect.arrayContaining(['name', 'class', 'base']));
    });
});

describe('las nuevas y las retocadas', () => {
    test('una nueva nace de otra, con su id propio', () => {
        const row = newRow('razas', humano, 3);
        expect(row.id).toBe('mio-razas-3');
        expect(row.mine).toBe(true);
        expect(row.effects).toEqual(humano.effects);
        expect(row.note).toBe('');
    });

    test('se mezclan con las de serie: la retocada tapa, la nueva va al final', () => {
        const merged = mergeRows([humano, { id: 'raza-enano', name: 'Enano' }], {
            'raza-humano': { ...humano, name: 'Humana' },
            'mio-razas-1': { id: 'mio-razas-1', name: 'Trasgo', mine: true },
        });
        expect(merged.map(r => r.name)).toEqual(['Humana', 'Enano', 'Trasgo']);
        expect(merged[0].changed).toBe(true);
    });

    test('el mundo las guarda por batería, sin las marcas del taller', () => {
        const saved = worldRowsFor({
            objetos: { 'mio-objetos-1': { ...espada, id: 'mio-objetos-1', mine: true } },
            razas: { 'raza-humano': { ...humano, changed: true, effectsSaid: '+1 Carisma' } },
        });
        expect(Object.keys(saved).sort()).toEqual(['armas', 'razas']);
        expect(saved.armas[0].mine).toBeUndefined();
        expect(saved.razas[0].effectsSaid).toBeUndefined();
    });

    test('y el juego las pone encima de las de todos al leer el compendio', () => {
        const batteries = { razas: [humano, { id: 'raza-enano', name: 'Enano' }], armas: [espada] };
        const out = mergeWorldRows(batteries, { razas: [{ ...humano, name: 'Humana' }, { id: 'mio-razas-1', name: 'Trasgo' }] });
        expect(out.razas.map(r => r.name)).toEqual(['Humana', 'Enano', 'Trasgo']);
        expect(out.armas).toBe(batteries.armas);
        // Sin filas, las de siempre.
        expect(mergeWorldRows(batteries, null)).toBe(batteries);
    });
});

describe('en el taller', () => {
    const empezado = () => startTaller({ path: 'cero', random: createSeededRandom('filas') });

    test('guardar, leer y quitar una fila propia', () => {
        let state = writeRow(empezado(), 'razas', { id: 'mio-razas-1', name: 'Trasgo', mine: true });
        expect(Object.keys(ownRows(state, 'razas'))).toEqual(['mio-razas-1']);
        state = dropRow(state, 'razas', 'mio-razas-1');
        expect(ownRows(state, 'razas')).toEqual({});
    });

    test('una raza que no cuadra para el taller, y dice cuál', () => {
        const state = writeRow(empezado(), 'razas', { id: 'mio-razas-1', name: 'Trasgo', effects: [] });
        expect(blocksNext(state, 'razas')).toMatch(/Trasgo/);
    });

    test('tocar una fila marca la pestaña como cambiada', () => {
        const before = stepSlice(empezado(), 'razas');
        const after = stepSlice(writeRow(empezado(), 'razas', { ...humano, name: 'Humana' }), 'razas');
        expect(after).not.toBe(before);
    });

    test('y lo tuyo sale del taller para que el mundo lo guarde', () => {
        const state = writeRow(empezado(), 'objetos', { ...espada, id: 'mio-objetos-1', mine: true });
        expect(toAnswers(state).worldRows.armas[0].id).toBe('mio-objetos-1');
    });
});
