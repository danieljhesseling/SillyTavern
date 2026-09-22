import { describe, test, expect } from '@jest/globals';
import { buildTargetCard, describeTargetCard } from '../public/scripts/game-engine/combat/target-card.js';

const crow = { name: 'Cuervo grande', currentHp: 5, maxHp: 7, armorClass: 12 };
const card = (over = {}) => buildTargetCard({
    actor: { name: 'Lyra' }, target: crow, distanceFeet: 5, rangeFeet: 5, ...over,
});

describe('what the card says', () => {
    test('the numbers a player needs to decide', () => {
        expect(card()).toMatchObject({
            name: 'Cuervo grande', hp: 5, maxHp: 7, armorClass: 12, distanceFeet: 5, inRange: true,
        });
    });

    test('cover is shown as what it adds, not folded into the armour', () => {
        const withCover = card({ cover: 2 });
        expect(withCover.cover).toBe(2);
        expect(withCover.armorClass).toBe(12);
        expect(describeTargetCard(withCover)).toContain('CA 14 (+2 por cobertura)');
    });

    test('and without cover it is not mentioned', () => {
        expect(describeTargetCard(card())).toBe('PG 5/7 · CA 12 · 5 ft');
    });

    test('junk in the target does not produce a card full of NaN', () => {
        const empty = buildTargetCard({ actor: {}, target: null, distanceFeet: 0, rangeFeet: 5 });
        expect(empty).toMatchObject({ name: '', hp: 0, maxHp: 0, armorClass: 10 });
    });
});

describe('the buttons, which are what actually spends', () => {
    // The rule the whole layer rests on: a click opens this, a button spends.
    test('attacking is offered when everything is in place', () => {
        const attack = card().actions.find(a => a.id === 'attack');
        expect(attack).toMatchObject({ enabled: true, reason: '' });
    });

    test('out of range says how far, not just no', () => {
        const attack = card({ distanceFeet: 30, rangeFeet: 5 }).actions[0];
        expect(attack.enabled).toBe(false);
        expect(attack.reason).toBe('Fuera de alcance: 30 ft de 5 ft');
    });

    test('with the action spent, it says so', () => {
        expect(card({ hasAction: false }).actions[0].reason).toMatch(/ya está gastada/);
    });

    test('on somebody already down, it says that first', () => {
        const dead = card({ target: { ...crow, currentHp: 0 }, hasAction: false });
        expect(dead.actions[0].reason).toBe('Ya está fuera de combate');
    });

    test('the ultimate is offered only when the bond allows it', () => {
        expect(card().actions.find(a => a.id === 'ultimate')?.enabled).toBe(false);
        expect(card({ canUltimate: true }).actions.find(a => a.id === 'ultimate')?.enabled).toBe(true);
    });

    test('and its own reason does not hide a more basic one', () => {
        const far = card({ canUltimate: true, distanceFeet: 40 });
        expect(far.actions.find(a => a.id === 'ultimate')?.reason).toMatch(/Fuera de alcance/);
    });

    test('every action always carries a label and a reason field', () => {
        for (const action of card({ hasAction: false }).actions) {
            expect(action.label).toBeTruthy();
            expect(typeof action.reason).toBe('string');
        }
    });
});
