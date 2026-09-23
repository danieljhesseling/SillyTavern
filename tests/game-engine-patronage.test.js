import { describe, test, expect } from '@jest/globals';
import {
    readDebt, choosePatron, offerPatronage, settlesDebt, debtDue, describeDebt,
    DEBT_DAYS, LENDER_NAME, LENDER_INTEREST, BROKEN_FAVOR_STANDING,
} from '../public/scripts/game-engine/campaign/patronage.js';

const casa = {
    id: 'casa', name: 'La casa del Vado', seat: 'Vado', holds: ['Molino'], reputation: 2,
    enemies: ['cuervos'], goal: { kind: 'conquistar', target: 'Paso Alto' },
};
const cuervos = {
    id: 'cuervos', name: 'Los Cuervos', seat: 'Torre', holds: ['Mina vieja'], reputation: 0,
    enemies: ['casa'], goal: { kind: 'destruir', target: '' },
};
const odio = { id: 'odio', name: 'Los del Odio', seat: 'Cueva', holds: [], reputation: -4, enemies: [], goal: { kind: 'controlar', target: 'Cueva' } };

describe('choosePatron', () => {
    test('la que mejor os mira', () => {
        expect(choosePatron({ factions: [cuervos, casa] })?.id).toBe('casa');
    });

    test('quien os tiene ganas no presta', () => {
        expect(choosePatron({ factions: [odio] })).toBeNull();
    });

    test('a igualdad, la que manda donde estáis', () => {
        const a = { ...casa, reputation: 0 };
        expect(choosePatron({ factions: [a, cuervos], here: 'Torre' })?.id).toBe('cuervos');
    });
});

describe('offerPatronage', () => {
    test('una facción paga y pide un favor contra sus enemigos', () => {
        const offer = offerPatronage({ shortfall: 37.2, factions: [casa, cuervos], here: 'Vado', today: 5 });
        expect(offer?.debt).toMatchObject({ patron: 'casa', amount: 38, day: 5, dueDay: 5 + DEBT_DAYS });
        expect(offer?.contract).toMatchObject({
            faction: 'cuervos', against: true, reward: 0, favor: true, days: 5 + DEBT_DAYS,
            locationName: 'Mina vieja', kind: 'steal',
        });
        expect(offer?.debt.contractId).toBe(offer?.contract.id);
        expect(offer?.line).toMatch(/La casa del Vado pone los 38/);
    });

    test('sin enemigos, un trabajo para ellos', () => {
        const solos = { ...casa, enemies: [] };
        const offer = offerPatronage({ shortfall: 10, factions: [solos], today: 1 });
        expect(offer?.contract).toMatchObject({ faction: 'casa', against: false, locationName: 'Paso Alto' });
    });

    test('sin facciones, el prestamista, con intereses', () => {
        const offer = offerPatronage({ shortfall: 20, factions: [], today: 3 });
        expect(offer?.contract).toBeNull();
        expect(offer?.debt).toMatchObject({ patronName: LENDER_NAME, amount: 20, owed: 20 * (1 + LENDER_INTEREST) });
    });

    test('si no falta nada, no hay oferta', () => {
        expect(offerPatronage({ shortfall: 0, factions: [casa], today: 1 })).toBeNull();
    });
});

describe('saldar y vencer', () => {
    const favor = /** @type {any} */ (offerPatronage({ shortfall: 30, factions: [casa, cuervos], today: 1 })).debt;

    test('entregar el favor salda; otro encargo, no', () => {
        expect(settlesDebt(favor, { id: favor.contractId })).toBe(true);
        expect(settlesDebt(favor, { id: 'otro' })).toBe(false);
        expect(settlesDebt(null, { id: favor.contractId })).toBe(false);
    });

    test('antes del día, nada', () => {
        expect(debtDue({ debt: favor, today: favor.dueDay - 1, purse: 999 }).due).toBe(false);
    });

    test('favor sin hacer: quieren el doble en oro, y se enfadan', () => {
        const due = debtDue({ debt: favor, today: favor.dueDay, purse: 1000 });
        expect(due).toMatchObject({ due: true, take: 60, standing: BROKEN_FAVOR_STANDING, debt: null });
    });

    test('sin oro, se llevan lo que hay y el resto sigue una semana', () => {
        const due = debtDue({ debt: favor, today: favor.dueDay, purse: 25 });
        expect(due.take).toBe(25);
        expect(due.debt).toMatchObject({ owed: 35, dueDay: favor.dueDay + 7, contractId: '' });
        expect(due.line).toMatch(/faltan 35/);
    });

    test('el prestamista cobra lo pactado y no se enfada con nadie', () => {
        const loan = /** @type {any} */ (offerPatronage({ shortfall: 20, today: 1 })).debt;
        const due = debtDue({ debt: loan, today: loan.dueDay, purse: 100 });
        expect(due).toMatchObject({ take: 30, standing: 0, debt: null });
    });
});

describe('leer y contar', () => {
    test('una deuda vacía no es deuda', () => {
        expect(readDebt(null)).toBeNull();
        expect(readDebt({ amount: 0 })).toBeNull();
    });

    test('se dice lo que se debe y cuánto queda', () => {
        const favor = /** @type {any} */ (offerPatronage({ shortfall: 30, factions: [casa, cuervos], today: 1 })).debt;
        expect(describeDebt(favor, 5)).toMatch(/favor a La casa del Vado .* quedan 10 día/);
        expect(describeDebt(null, 1)).toBe('');
    });
});
