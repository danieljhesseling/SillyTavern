import { describe, test, expect } from '@jest/globals';
import {
    quickResolveOffer, lowBudget, foesXp, simFighterOf, XP_BUDGET_2024,
} from '../public/scripts/game-engine/combat/quick-resolve.js';

/** Un grupo de cuatro de un nivel, con espada y armadura. */
const party = (/** @type {number} */ level, hp = 10 * level) => ['Bruna', 'Teo', 'Nella', 'Grimm'].map((name, i) => ({
    id: String(i), name, level, hp, maxHp: hp, armorClass: 16, strength: 16, dexterity: 12,
    items: [{ id: `w${i}`, name: 'Espada larga', damageDice: '1d8', slot: 'weapon' }],
    equippedItems: { weapon: `w${i}` },
}));

const rat = { name: 'Rata de bodega', cr: 0, maxHp: 2, armorClass: 10, strength: 2, dexterity: 11 };
const ogre = { name: 'Ogro', cr: 2, maxHp: 59, armorClass: 11, strength: 19, dexterity: 8 };

describe('E7.2: resolver rápido las peleas claramente vuestras', () => {
    test('el presupuesto bajo de 2024 suma el de cada uno por su nivel', () => {
        expect(XP_BUDGET_2024[5]).toEqual([500, 750, 1100]);
        expect(lowBudget(party(5))).toBe(2000);
        expect(lowBudget([{ level: 1 }, { level: 3 }])).toBe(200);
        expect(foesXp([rat, rat, ogre])).toBe(10 + 10 + 450);
    });

    test('dos ratas contra un grupo de nivel 5: se ofrece, y cuesta poco', () => {
        const offer = quickResolveOffer({ party: party(5), foes: [rat, rat], seed: 's' });
        expect(offer.offer).toBe(true);
        expect(offer.winRate).toBeGreaterThanOrEqual(0.98);
        expect(offer.said).toMatch(/rasguño|PG/);
    });

    test('un ogro contra un grupo de nivel 1: no (pasa del presupuesto)', () => {
        const offer = quickResolveOffer({ party: party(1), foes: [ogre], seed: 's' });
        expect(offer.offer).toBe(false);
        expect(offer.reason).toMatch(/presupuesto/);
    });

    test('nunca contra un jefe, ni en la pelea que pide la historia o que se gana de otra forma', () => {
        expect(quickResolveOffer({ party: party(5), foes: [{ ...rat, boss: true }] }).reason).toMatch(/jefe/);
        expect(quickResolveOffer({ party: party(5), foes: [rat], blockers: { story: true } }).reason).toMatch(/historia/);
        expect(quickResolveOffer({ party: party(5), foes: [rat], blockers: { scenario: true } }).offer).toBe(false);
        expect(quickResolveOffer({ party: party(5), foes: [rat], blockers: { brawl: true } }).offer).toBe(false);
        expect(quickResolveOffer({ party: party(5), foes: [rat], blockers: { nemesis: true } }).offer).toBe(false);
    });

    test('con el grupo casi muerto, la cuenta no sale fácil aunque los enemigos valgan poco', () => {
        const hurt = party(2).map(m => ({ ...m, hp: 1 }));
        const wolves = Array.from({ length: 2 }, () => ({ name: 'Lobo', cr: 0.25, maxHp: 11, armorClass: 13, strength: 12, dexterity: 15 }));
        const offer = quickResolveOffer({ party: hurt, foes: wolves, seed: 's' });
        expect(offer.offer).toBe(false);
    });

    test('alguien del grupo, como lo cuenta la simulación: su vida de ahora, su arma y su puntería', () => {
        const fighter = simFighterOf({ name: 'Bruna', level: 5, hp: 30, maxHp: 44, armorClass: 18, strength: 18, dexterity: 10,
            items: [{ id: 'a', name: 'Espadón', damageDice: '2d6', magicalBonus: 1 }], equippedItems: { weapon: 'a' } });
        expect(fighter).toMatchObject({ maxHp: 30, hp: 30, ac: 18, damage: '2d6', attack: 4 + 3 + 1, damageBonus: 5, reach: 5 });
    });

    test('es siempre lo mismo con la misma semilla', () => {
        const a = quickResolveOffer({ party: party(3), foes: [rat, rat, rat], seed: 'x' });
        const b = quickResolveOffer({ party: party(3), foes: [rat, rat, rat], seed: 'x' });
        expect(a).toEqual(b);
    });
});
