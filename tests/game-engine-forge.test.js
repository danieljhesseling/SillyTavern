import fs from 'node:fs';
import { describe, test, expect } from '@jest/globals';
import { createCompendium, validateBattery } from '../public/scripts/game-engine/compendio/compendio.js';
import { forgeItem, forgeItems, describeItem, ITEM_TYPES } from '../public/scripts/game-engine/compendio/forge.js';

const materiales = JSON.parse(fs.readFileSync(
    new URL('../public/compendio/materiales.json', import.meta.url), 'utf8',
));

/** La biblioteca de verdad, la que viene escrita. */
const real = (config) => createCompendium({ materiales: materiales.rows }, config);

/** Un azar que va diciendo lo que le mandes. */
const fixed = (...values) => {
    let i = 0;
    return () => values[Math.min(i++, values.length - 1)];
};

/** Un azar repetible, para pedir muchas cosas sin escribir cien números. */
const rolling = (seed) => {
    let state = seed;
    return () => ((state = (state * 9301 + 49297) % 233280) / 233280);
};

describe('la batería que viene escrita', () => {
    test('materiales.json pasa su propia validación', () => {
        expect(validateBattery('materiales', materiales)).toEqual([]);
    });

    test('trae formas y materiales, que son las dos mitades', () => {
        const kinds = new Set(materiales.rows.map(r => r.kind));
        expect(kinds).toEqual(new Set(['forma', 'material']));
        expect(materiales.rows.filter(r => r.kind === 'forma').length).toBeGreaterThanOrEqual(20);
        expect(materiales.rows.filter(r => r.kind === 'material').length).toBeGreaterThanOrEqual(12);
    });

    test('cada forma dice qué es, y es algo que el editor sabe dibujar', () => {
        for (const forma of materiales.rows.filter(r => r.kind === 'forma')) {
            expect(ITEM_TYPES).toContain(forma.itemType);
            expect(Number(forma.kg)).toBeGreaterThan(0);
        }
    });

    // Un material que no encaja con ninguna forma es una fila que no sale nunca.
    test('y cada material encaja con algo', () => {
        const types = new Set(materiales.rows.filter(r => r.kind === 'forma').map(r => r.itemType));
        for (const material of materiales.rows.filter(r => r.kind === 'material')) {
            const fits = (material.when?.itemType ?? []).filter(t => types.has(t));
            expect(fits.length).toBeGreaterThan(0);
        }
    });

    test('las armas traen dados de daño y las armaduras no', () => {
        for (const forma of materiales.rows.filter(r => r.kind === 'forma')) {
            if (forma.itemType === 'weapon') expect(forma.damageDice).toMatch(/^\d+d\d+$/);
            else expect(forma.damageDice ?? '').toBe('');
        }
    });
});

describe('forjar una cosa', () => {
    test('sin batería no hay objeto, y no revienta', () => {
        expect(forgeItem({ compendium: createCompendium({}), random: () => 0.5 })).toBe(null);
    });

    test('sale con todos los campos que la ficha de objeto pide', () => {
        const item = forgeItem({ compendium: real(), random: fixed(0.1, 0.4) });
        expect(Object.keys(item).sort()).toEqual([
            'category', 'damageDice', 'damageType', 'description', 'from',
            'name', 'rarity', 'slot', 'type', 'weight',
        ]);
        expect(ITEM_TYPES).toContain(item.type);
        expect(item.weight).toBeGreaterThan(0);
    });

    test('el nombre es la forma y el material, no un número', () => {
        const item = forgeItem({ compendium: real(), random: fixed(0.02, 0.02) });
        expect(item.name).toMatch(/^.+ de .+$/);
        expect(item.name).not.toMatch(/[{}]/);
    });

    test('pedir un arma da un arma', () => {
        for (const type of ITEM_TYPES) {
            const item = forgeItem({ compendium: real(), itemType: type, random: rolling(7) });
            expect(item.type).toBe(type);
        }
    });

    // No hay cotas de malla de roble. Lo dice el material en su `when`, no este código.
    test('el material encaja con la forma, siempre', () => {
        const byId = new Map(materiales.rows.map(r => [r.id, r]));
        const random = rolling(11);
        for (let i = 0; i < 200; i++) {
            const item = forgeItem({ compendium: real(), random });
            const forma = byId.get(item.from.forma);
            const material = byId.get(item.from.material);
            expect(material.when.itemType).toContain(forma.itemType);
        }
    });

    test('los kilos salen de la forma por el material, con un decimal', () => {
        const random = rolling(3);
        for (let i = 0; i < 100; i++) {
            const item = forgeItem({ compendium: real(), random });
            expect(item.weight).toBe(Math.round(item.weight * 10) / 10);
            expect(item.weight).toBeGreaterThan(0);
        }
    });

    test('la rareza la pone el material', () => {
        const byId = new Map(materiales.rows.map(r => [r.id, r]));
        const random = rolling(5);
        for (let i = 0; i < 100; i++) {
            const item = forgeItem({ compendium: real(), random });
            expect(item.rarity).toBe(byId.get(item.from.material).rarity);
        }
    });

    // Quien pidió una rareza que no existe ya verá que no es la que quería; quedarse sin
    // objeto no le dice nada.
    test('una rareza imposible da el objeto igual, no un hueco', () => {
        const item = forgeItem({ compendium: real(), rarity: 'Very Rare', random: rolling(2) });
        expect(item).not.toBe(null);
        expect(item.name.length).toBeGreaterThan(2);
    });

    test('la misma semilla forja lo mismo', () => {
        const once = forgeItem({ compendium: real(), random: rolling(42) });
        const twice = forgeItem({ compendium: real(), random: rolling(42) });
        expect(once.name).toBe(twice.name);
        expect(once.weight).toBe(twice.weight);
    });
});

describe('forjar un montón', () => {
    test('ocho cosas son ocho combinaciones distintas', () => {
        const items = forgeItems({ compendium: real(), howMany: 8, random: rolling(13) });
        expect(items).toHaveLength(8);
        const keys = items.map(i => `${i.from.forma}|${i.from.material}`);
        expect(new Set(keys).size).toBe(8);
    });

    test('sin batería, ninguna', () => {
        expect(forgeItems({ compendium: createCompendium({}), howMany: 5, random: () => 0.5 }))
            .toEqual([]);
    });

    test('y pedir un tipo concreto lo respeta en todas', () => {
        const items = forgeItems({ compendium: real(), howMany: 6, itemType: 'armor', random: rolling(17) });
        expect(items.length).toBeGreaterThan(0);
        for (const item of items) expect(item.type).toBe('armor');
    });
});

describe('contado en una línea', () => {
    test('dice lo que es y lo que pesa', () => {
        const line = describeItem({
            name: 'Daga de plata', damageDice: '1d4', damageType: 'perforante',
            weight: 0.5, rarity: 'Uncommon',
        });
        expect(line).toBe('Daga de plata · 1d4 perforante · 0.5 kg · Uncommon');
    });

    test('y lo corriente no se anuncia como raro', () => {
        expect(describeItem({ name: 'Morral de cuero', weight: 0.9, rarity: 'Common' }))
            .toBe('Morral de cuero · 0.9 kg');
    });
});
