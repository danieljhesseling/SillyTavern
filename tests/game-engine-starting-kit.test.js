import { describe, expect, test } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { kitFor, kitSlots, describeKit, startingGear, STARTING_TORCHES } from '../public/scripts/game-engine/campaign/starting-kit.js';
import { torchesOf } from '../public/scripts/game-engine/board/light.js';
import { describeLootItem } from '../public/scripts/game-engine/combat/loot-items.js';
import { armourClassOf } from '../public/scripts/game-engine/rules/equipment.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const classes = read('../public/compendio/clases.json').rows;
const forms = ['armas', 'armaduras', 'trastos'].flatMap(domain => read(`../public/compendio/${domain}.json`).rows);
const row = (id) => classes.find(c => c.id === id);

/** Una ficha con el kit puesto, como la deja el juego. */
function wearing(classId) {
    const pieces = kitFor({ classRow: row(classId), forms });
    const items = pieces.map((piece, i) => ({ ...piece, id: `k${i}` }));
    const equippedItems = Object.fromEntries(Object.entries(kitSlots(pieces)).map(([slot, index]) => [slot, `k${index}`]));
    return { pieces, member: { items, equippedItems } };
}

describe('el equipo inicial por clase (J1.3)', () => {
    test('todas las clases del compendio traen kit, y todo lo que nombra existe', () => {
        const ids = new Set(forms.map(f => f.id));
        for (const c of classes) {
            expect(Array.isArray(c.kit) && c.kit.length > 0).toBe(true);
            for (const id of c.kit) expect(ids.has(id)).toBe(true);
        }
    });

    test('todas empiezan con un arma en la mano', () => {
        for (const c of classes) {
            const { member } = wearing(c.id);
            expect(member.equippedItems.weapon).toBeTruthy();
        }
    });

    test('el guerrero ya no empieza con CA 10: cota de malla, espada y escudo', () => {
        const { pieces, member } = wearing('guerrero');
        expect(pieces.map(p => p.name)).toEqual(['Cota de malla', 'Espada larga', 'Escudo']);
        expect(armourClassOf({ member, dexModifier: 0 }).armorClass).toBe(16);
    });

    test('con un arma a dos manos no se lleva el escudo', () => {
        const pieces = [
            { name: 'Espadón', slot: 'weapon', hands: 2 },
            { name: 'Escudo', slot: 'shield', hands: 1 },
        ];
        expect(kitSlots(/** @type {any} */ (pieces))).toEqual({ weapon: 0 });
    });

    test('lo que no tiene sitio va a la mochila, y lo que el compendio no tiene se salta', () => {
        const pieces = kitFor({ classRow: { kit: ['forma-daga', 'forma-ganzuas', 'no-existe'] }, forms });
        expect(pieces.map(p => p.name)).toEqual(['Daga', 'Ganzúas']);
        expect(kitSlots(pieces)).toEqual({ weapon: 0 });
        expect(describeKit(pieces)).toBe('Llevas: Daga, Ganzúas.');
    });

    test('E2 (Daniel, 2026-10-03): todos empiezan con 5 antorchas, y el pícaro y el criminal con ganzúas', () => {
        const fighter = startingGear({ classRow: row('guerrero'), forms });
        const torch = fighter.find(p => p.name === 'Antorcha');
        expect(torch?.quantity).toBe(STARTING_TORCHES);
        expect(STARTING_TORCHES).toBe(5);
        // La antorcha va a la mochila: no quita sitio a nada de lo puesto.
        expect(kitSlots(fighter)).toEqual({ body: 0, weapon: 1, shield: 2 });
        expect(describeKit(fighter)).toBe('Llevas: Cota de malla, Espada larga, Escudo, 5 antorchas.');
        // Lo que lee la luz (E2.1): cinco antorchas en la mochila.
        expect(torchesOf({ items: fighter })).toBe(5);
        // Herramientas de ladrón: el pícaro por su clase; el criminal por su trasfondo; sin repetir.
        expect(startingGear({ classRow: row('picaro'), forms }).filter(p => p.name === 'Ganzúas')).toHaveLength(1);
        expect(startingGear({ classRow: row('picaro'), forms, background: 'criminal' }).filter(p => p.name === 'Ganzúas')).toHaveLength(1);
        expect(startingGear({ classRow: row('guerrero'), forms, background: 'criminal' }).some(p => p.name === 'Ganzúas')).toBe(true);
        expect(startingGear({ classRow: row('guerrero'), forms, background: 'soldado' }).some(p => p.name === 'Ganzúas')).toBe(false);
        // Sin fila de clase (una clase de fuera del compendio), al menos las antorchas; sin compendio, también.
        expect(startingGear({ classRow: null, forms }).map(p => [p.name, p.quantity])).toEqual([['Antorcha', 5]]);
        expect(startingGear({ classRow: null, forms: [] }).map(p => [p.name, p.quantity])).toEqual([['Antorcha', 5]]);
    });

    test('las ganzúas y las antorchas se venden siempre en la tienda, con su precio', () => {
        expect(describeLootItem('Ganzúas')).toMatchObject({ price: 25, subcategory: 'tool' });
        expect(describeLootItem('Antorcha')).toMatchObject({ price: 1 });
        const town = readFileSync(new URL('../public/scripts/party/town.js', import.meta.url), 'utf8');
        expect(town).toMatch(/DUNGEON_SUPPLIES = \[[^\]]*'Antorcha'[^\]]*'Ganzúas'/);
    });
});

describe('los atributos al crear: repartir o tirar (J1.2)', () => {
    test('lo repartido se suma a la base, y se limpia', async () => {
        const { buildHeroEntry, readStatBonus, spreadLeft } = await import('../public/scripts/game-engine/campaign/hero.js');
        expect(readStatBonus({ strength: 5, charisma: -9, suerte: 3 })).toEqual({ strength: 2, dexterity: 0, constitution: 0, intelligence: 0, wisdom: 0, charisma: -2 });
        expect(spreadLeft({ strength: 2, dexterity: 1 })).toBe(0);
        const plain = buildHeroEntry({ name: 'Tessa' }).dndData;
        const spread = buildHeroEntry({ name: 'Tessa', statBonus: { strength: 2, wisdom: 1 } }).dndData;
        expect(spread.str - plain.str).toBe(2);
        expect(spread.wis - plain.wis).toBe(1);
    });

    test('tirar da lo mismo con la misma semilla, y otra cosa con otra', async () => {
        const { rollStatBonus } = await import('../public/scripts/game-engine/campaign/hero.js');
        const { createSeededRandom } = await import('../public/scripts/game-engine/combat/seeded-random.js');
        const a = rollStatBonus(createSeededRandom('uno'));
        expect(rollStatBonus(createSeededRandom('uno'))).toEqual(a);
        const others = ['dos', 'tres', 'cuatro', 'cinco'].map(seed => JSON.stringify(rollStatBonus(createSeededRandom(seed))));
        expect(others.some(o => o !== JSON.stringify(a))).toBe(true);
        for (const value of Object.values(a)) expect(Math.abs(value)).toBeLessThanOrEqual(2);
    });
});
