import { describe, test, expect } from '@jest/globals';
import {
    DEFAULT_UPKEEP, readUpkeepRules, upkeepPerHead, weeklyBill,
    settleWeek, describeBill, woundedOf,
} from '../public/scripts/game-engine/rules/upkeep.js';
import { applyInjury, INJURY_TABLE } from '../public/scripts/game-engine/rules/injuries.js';

/** Tú y dos: una que va contigo, uno que va por la paga. */
const party = () => ([
    { name: 'Lyra', gold: 60, speed: 30 },
    { name: 'Bruna', motive: 'bond', gold: 20, speed: 30 },
    { name: 'Brand', motive: 'coin', gold: 0, speed: 30 },
]);

/** Alguien con la pierna rota, como sale de un mal combate. */
const withBrokenLeg = (member) => {
    const patch = applyInjury(member, INJURY_TABLE.find(i => i.id === 'broken_leg'));
    return Object.assign({}, member, patch.stats, { injuries: patch.injuries, baseStats: patch.baseStats });
};

describe('los precios', () => {
    test('una campaña que no dice nada usa los de casa', () => {
        expect(readUpkeepRules(null)).toEqual(DEFAULT_UPKEEP);
    });

    test('y los suyos si los dice', () => {
        expect(readUpkeepRules({ wagePerWeek: 50 }).wagePerWeek).toBe(50);
        expect(readUpkeepRules({ wagePerWeek: 50 }).foodPerDay).toBe(DEFAULT_UPKEEP.foodPerDay);
    });

    test('nada es negativo, y una semana dura al menos un día', () => {
        const odd = readUpkeepRules({ foodPerDay: -10, weekLength: 0 });
        expect(odd.foodPerDay).toBe(0);
        expect(odd.weekLength).toBe(1);
    });
});

describe('lo que cuesta cada uno', () => {
    const heads = upkeepPerHead(party());

    test('come todo el mundo, cobre o no', () => {
        expect(heads.every(head => head.food > 0)).toBe(true);
    });

    // Es lo que hace que tener amigos salga barato y una compañía salga cara.
    test('pero solo cobra quien vino por dinero', () => {
        expect(heads.find(h => h.name === 'Brand').wage).toBe(DEFAULT_UPKEEP.wagePerWeek);
        expect(heads.find(h => h.name === 'Bruna').wage).toBe(0);
        expect(heads.find(h => h.name === 'Lyra').wage).toBe(0);
    });

    test('y cada uno sabe lo que suma', () => {
        const brand = heads.find(h => h.name === 'Brand');
        expect(brand.total).toBe(brand.food + brand.lodging + brand.tax + brand.wage);
    });
});

describe('la cuenta de la semana', () => {
    test('suma lo de todos y mira lo que hay', () => {
        const bill = weeklyBill(party());
        // 3 bocas × 2 × 7 = 42 de comida, 21 de posada, 9 de tasas, 20 de sueldo.
        expect(bill.food).toBe(42);
        expect(bill.lodging).toBe(21);
        expect(bill.tax).toBe(9);
        expect(bill.wages).toBe(20);
        expect(bill.total).toBe(92);
        expect(bill.purse).toBe(80);
    });

    test('y dice si llega, y cuánto falta', () => {
        const bill = weeklyBill(party());
        expect(bill.covered).toBe(false);
        expect(bill.missing).toBe(12);
    });

    test('con dinero de sobra, no falta nada', () => {
        const bill = weeklyBill(party(), { purse: 500 });
        expect(bill.covered).toBe(true);
        expect(bill.missing).toBe(0);
    });

    // Pagar la cena no es opcional; curar a Bruna sí. Mezclarlas escondería la decisión.
    test('curar va aparte del total, porque es lo único que eliges', () => {
        const hurt = party();
        hurt[1] = withBrokenLeg(hurt[1]);

        const bill = weeklyBill(hurt);
        expect(bill.healing).toBe(70);
        expect(bill.total).toBe(92);
        expect(bill.withCare).toBe(162);
        expect(bill.wounded).toEqual([{ name: 'Bruna', days: 14, gold: 70, permanent: 0 }]);
    });

    test('un grupo vacío no debe nada', () => {
        expect(weeklyBill([]).total).toBe(0);
        expect(weeklyBill(null).covered).toBe(true);
    });
});

describe('cuando no llega', () => {
    test('quien vino por dinero se queda sin cobrar, y se dice', () => {
        const people = party();
        const bill = weeklyBill(people, { purse: 50 });
        const week = settleWeek(people, bill);

        expect(week.paid).toBe(false);
        expect(week.unpaid).toEqual(['Brand']);
        expect(week.lines.join(' ')).toMatch(/lealtad baja/i);
    });

    test('si no llega ni para comer, no come nadie', () => {
        const people = party();
        const bill = weeklyBill(people, { purse: 10 });
        expect(settleWeek(people, bill).hungry).toHaveLength(3);
    });

    test('y con la cuenta pagada no pasa nada de eso', () => {
        const people = party();
        const week = settleWeek(people, weeklyBill(people, { purse: 500 }));
        expect(week.paid).toBe(true);
        expect(week.unpaid).toEqual([]);
        expect(week.hungry).toEqual([]);
    });
});

describe('la cuenta, dicha antes de vencer', () => {
    test('dice cuándo vence, cuánto debes y cuánto tienes', () => {
        const lines = describeBill(weeklyBill(party()), 3);
        expect(lines[0]).toBe('Vence en 3 día(s): debes 92, tienes 80.');
        expect(lines.join(' ')).toMatch(/Faltan 12/);
    });

    test('y lo desglosa, para que se pueda discutir', () => {
        expect(describeBill(weeklyBill(party()))[1])
            .toBe('Comida 42 · posada 21 · tasas 9 · sueldos 20.');
    });

    test('lo que no se cura con dinero se dice aparte', () => {
        const people = party();
        const patch = applyInjury(people[1], INJURY_TABLE.find(i => i.id === 'lost_leg'));
        people[1] = Object.assign({}, people[1], { injuries: patch.injuries });

        expect(describeBill(weeklyBill(people)).join(' ')).toMatch(/no se cura con dinero/);
    });
});

describe('quién arrastra heridas', () => {
    test('se puede preguntar de un vistazo', () => {
        const people = party();
        people[1] = withBrokenLeg(people[1]);
        expect(woundedOf(people)).toEqual([{ name: 'Bruna', injuries: ['Pierna rota'] }]);
    });

    test('y un grupo entero no aparece', () => {
        expect(woundedOf(party())).toEqual([]);
    });
});

describe('las dos copias de los precios', () => {
    test('el paquete por defecto cobra lo mismo que el modulo', async () => {
        const { DEFAULT_RULESET } = await import('../public/scripts/game-engine/rules/default-ruleset.js');
        expect(DEFAULT_RULESET.upkeep).toEqual(DEFAULT_UPKEEP);
    });
});
