import { describe, test, expect } from '@jest/globals';
import {
    bestGear, applyGear, armorTraining, armourWeight, strengthNeeded, bodyArmourClass, cannotWear,
} from '../public/scripts/game-engine/rules/best-gear.js';

const dagger = { id: 'dag', name: 'Daga', damageDice: '1d4', slot: 'weapon', hands: 1, rangeFeet: 20 };
const longsword = { id: 'ls', name: 'Espada larga', damageDice: '1d8', slot: 'weapon', hands: 1, subcategory: 'martial_melee' };
const greatsword = { id: 'gs', name: 'Espadón', damageDice: '2d6', slot: 'weapon', hands: 2, subcategory: 'martial_melee' };
const shield = { id: 'sh', name: 'Escudo', slot: 'shield', armorClass: 2 };
const leather = { id: 'lea', name: 'Jubón', slot: 'body', armorClass: 11, dexMode: 'full' };
const chain = { id: 'ch', name: 'Cota de malla', slot: 'body', armorClass: 16, dexMode: 'none', tags: ['pesada'] };
const plate = { id: 'pl', name: 'Placa', slot: 'body', armorClass: 18, dexMode: 'none', strengthRequirement: 15 };
const helm = { id: 'he', name: 'Casco', slot: 'head', armorClass: 1 };

const fighter = (extra = {}) => ({
    id: 'f', name: 'Bruna', class: 'Guerrera', level: 3, strength: 16, dexterity: 12, constitution: 14,
    items: [dagger], equippedItems: { weapon: 'dag' }, ...extra,
});

describe('E7.3: equipar lo mejor según la clase y lo que domina', () => {
    test('el entrenamiento de 2024 por clase', () => {
        expect(armorTraining({ class: 'Guerrero' })).toContain('heavy');
        expect(armorTraining({ class: 'Clériga' })).toEqual(['light', 'medium', 'shield']);
        expect(armorTraining({ class: 'Maga' })).toEqual([]);
        expect(armourWeight(chain)).toBe('heavy');
        expect(armourWeight({ dexMode: 'half' })).toBe('medium');
        expect(strengthNeeded(chain)).toBe(13);
        expect(strengthNeeded(plate)).toBe(15);
        expect(strengthNeeded(leather)).toBe(0);
    });

    test('la guerrera deja la daga por la espada y se pone el escudo, la cota y el casco, y lo explica', () => {
        const member = fighter({ items: [dagger, longsword, shield, chain, helm] });
        const plan = bestGear({ member });
        const slots = Object.fromEntries(plan.changes.map(c => [c.slot, c.item?.name ?? null]));
        expect(slots).toEqual({ weapon: 'Espada larga', shield: 'Escudo', body: 'Cota de malla', head: 'Casco' });
        expect(plan.lines.join(' ')).toMatch(/Espada larga en vez de Daga/);
        expect(plan.lines.join(' ')).toMatch(/CA 16 en vez de 11/);
        const applied = applyGear(member, plan);
        expect(applied.member.equippedItems).toMatchObject({ weapon: 'ls', shield: 'sh', body: 'ch', head: 'he' });
    });

    test('sin la Fuerza que pide la placa no se la pone, y lo dice', () => {
        const member = fighter({ strength: 13, items: [dagger, plate, leather] });
        const plan = bestGear({ member });
        expect(plan.changes.find(c => c.slot === 'body')?.item?.name).toBe('Jubón');
        expect(plan.lines.join(' ')).toMatch(/No se pone Placa: le falta Fuerza \(pide 15\)/);
    });

    test('la maga no se pone armadura ni escudo, ni empuña un espadón', () => {
        const mage = { id: 'm', name: 'Nella', class: 'Maga', level: 3, strength: 8, dexterity: 14, items: [dagger, greatsword, leather, shield], equippedItems: {} };
        const plan = bestGear({ member: mage });
        expect(plan.changes.map(c => c.slot)).toEqual(['weapon']);
        expect(plan.changes[0].item.name).toBe('Daga');
        expect(cannotWear(mage, leather)).toMatch(/ligera/);
    });

    test('dos manos o escudo: con escudo a mano, la espada y el escudo tapan más de lo que pega el espadón', () => {
        const member = fighter({ items: [greatsword, longsword, shield], equippedItems: { weapon: 'gs' } });
        const plan = bestGear({ member });
        expect(plan.changes.map(c => [c.slot, c.item?.name])).toEqual([['weapon', 'Espada larga'], ['shield', 'Escudo']]);
        // Sin escudo, el espadón.
        const bare = bestGear({ member: fighter({ items: [greatsword, longsword], equippedItems: { weapon: 'ls' } }) });
        expect(bare.changes[0].item.name).toBe('Espadón');
    });

    test('quien lleva la antorcha (E2.1) no empuña nada a dos manos', () => {
        const member = fighter({ items: [greatsword, longsword], equippedItems: { weapon: 'ls' } });
        const plan = bestGear({ member, torchBearer: true });
        expect(plan.changes).toHaveLength(0);
        const fromDagger = bestGear({ member: fighter({ items: [dagger, greatsword, longsword] }), torchBearer: true });
        expect(fromDagger.changes[0].item.name).toBe('Espada larga');
        expect(fromDagger.lines.join(' ')).toMatch(/antorcha/);
    });

    test('lo maldito que se sabe y lo que pide sintonía no se toca; lo maldito que lleva puesto, tampoco se cambia', () => {
        const cursed = { ...longsword, id: 'c', name: 'Espada negra', cursed: true, identified: true };
        expect(bestGear({ member: fighter({ items: [dagger, cursed] }) }).changes).toHaveLength(0);
        const stuck = fighter({ items: [{ ...dagger, cursed: true }, longsword] });
        expect(bestGear({ member: stuck }).changes).toHaveLength(0);
        const tuned = { ...longsword, attunement: true };
        expect(bestGear({ member: fighter({ items: [dagger, tuned] }) }).changes).toHaveLength(0);
    });

    test('lo suelto de otro del grupo también vale, y pasa a su mochila', () => {
        const hero = { id: 'h', name: 'Héroe', items: [longsword], equippedItems: {} };
        const member = fighter();
        const plan = bestGear({ member, pool: [{ item: longsword, owner: 'h' }] });
        const applied = applyGear(member, plan, [hero]);
        expect(applied.member.items.map(i => i.id)).toContain('ls');
        expect(applied.mates).toEqual([{ id: 'h', items: [] }]);
    });

    test('el bárbaro sin armadura cuenta su Constitución', () => {
        expect(bodyArmourClass({ class: 'Bárbaro', dexterity: 14, constitution: 16 }, null)).toBe(15);
        const plan = bestGear({ member: { name: 'Ulf', class: 'Bárbaro', strength: 16, dexterity: 14, constitution: 16, items: [leather], equippedItems: {} } });
        expect(plan.changes.some(c => c.slot === 'body')).toBe(false);
    });
});
