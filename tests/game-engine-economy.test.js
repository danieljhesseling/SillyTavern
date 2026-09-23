import { describe, test, expect } from '@jest/globals';
import {
    marketPressure, applyMarket, describeMarket,
} from '../public/scripts/game-engine/campaign/economy.js';
import { DEFAULT_UPKEEP, weeklyBill } from '../public/scripts/game-engine/rules/upkeep.js';

const world = (extra = {}) => ([
    {
        name: 'El Molino',
        routes: [{ to: 'La Ermita', days: 2 }, { to: 'La Cripta', days: 3 }],
        ...extra,
    },
    { name: 'La Ermita', routes: [] },
    { name: 'La Cripta', routes: [] },
]);

const bando = (extra = {}) => ({
    id: 'molino', name: 'Los del Molino', seat: 'El Molino', holds: ['El Molino'],
    goal: { kind: 'conquistar', target: 'La Ermita', at: 1, of: 6 }, ...extra,
});

const here = (locations, factions = []) =>
    marketPressure({ here: 'El Molino', locations, factions });

describe('cómo está el mercado', () => {
    // Sin nada de esto, la cuenta sale exactamente como salía.
    test('un mundo tranquilo no encarece nada, y no inventa motivos', () => {
        const sum = here(world());
        expect(sum.food).toBe(1);
        expect(sum.tax).toBe(1);
        expect(sum.reasons).toEqual([]);
        expect(describeMarket(sum)).toBe('');
    });

    test('y un sitio que no existe tampoco', () => {
        expect(marketPressure({ here: 'En ninguna parte', locations: world() }).food).toBe(1);
    });

    // Un camino cerrado es comida que no llega.
    test('un camino cerrado sube el pan, y dice cuál', () => {
        const cerrado = world();
        cerrado[0].routes[0].closed = true;
        const sum = here(cerrado);
        expect(sum.food).toBeGreaterThan(1);
        expect(sum.reasons.join(' ')).toContain('La Ermita');
    });

    // El mundo es una lista y un camino vale en los dos sentidos.
    test('también cuenta el camino cerrado que llega desde fuera', () => {
        const cerrado = world();
        cerrado[1].routes = [{ to: 'El Molino', days: 2, closed: true }];
        expect(here(cerrado).food).toBeGreaterThan(1);
    });

    test('dos cerrados pesan más que uno', () => {
        const uno = world();
        uno[0].routes[0].closed = true;
        const dos = world();
        dos[0].routes[0].closed = true;
        dos[0].routes[1].closed = true;
        expect(here(dos).food).toBeGreaterThan(here(uno).food);
    });

    // Quedarse sin ningún camino abierto no es caro: es otra cosa.
    test('sin ningún camino abierto, el sitio queda incomunicado', () => {
        const aislado = world();
        for (const route of aislado[0].routes) route.closed = true;
        const sum = here(aislado);
        expect(sum.cut).toBe(true);
        expect(sum.food).toBeGreaterThanOrEqual(2);
        expect(sum.reasons.join(' ')).toMatch(/ya no entra nada/);
    });

    // Lo paga también quien trae la harina.
    test('un peaje sube el pan aunque el camino siga abierto', () => {
        const peaje = world();
        peaje[0].routes[0].note = 'Peaje de Los del Molino.';
        const sum = here(peaje);
        expect(sum.food).toBeGreaterThan(1);
        expect(sum.cut).toBe(false);
        expect(sum.reasons.join(' ')).toMatch(/peaje/i);
    });

    test('pero un camino cerrado no cobra peaje además', () => {
        const ambos = world();
        ambos[0].routes[0].closed = true;
        ambos[0].routes[0].note = 'Peaje de Los del Molino.';
        expect(here(ambos).reasons.filter(r => /peaje/i.test(r))).toEqual([]);
    });

    // `taxPerWeek` se llamaba «lo que pide el señor del sitio» y no había ningún señor.
    test('quien manda aquí cobra', () => {
        const sum = here(world(), [bando({ goal: { kind: '', done: true } })]);
        expect(sum.tax).toBe(1.5);
        expect(sum.holder).toBe('molino');
        expect(sum.reasons.join(' ')).toMatch(/cobra por ello/);
    });

    test('y si anda pagando una guerra, cobra el doble', () => {
        const sum = here(world(), [bando()]);
        expect(sum.tax).toBe(2);
        expect(sum.reasons.join(' ')).toMatch(/pagando lo suyo con tus impuestos/);
    });

    test('quien manda en otro sitio no cobra aquí', () => {
        const fuera = bando({ seat: 'La Ermita', holds: ['La Ermita'] });
        expect(here(world(), [fuera]).tax).toBe(1);
    });

    // Por muy mal que se ponga, el pan tiene un techo.
    test('el pan no sube sin límite', () => {
        const fatal = world();
        fatal[0].routes = Array.from({ length: 20 }, (unused, i) => ({
            to: `Sitio ${i}`, days: 2, closed: true,
        }));
        expect(here(fatal).food).toBeLessThanOrEqual(2.5);
    });
});

describe('lo que eso le hace a la cuenta', () => {
    test('sin presión, los precios no se tocan', () => {
        const sum = here(world());
        expect(applyMarket(DEFAULT_UPKEEP, sum)).toEqual(DEFAULT_UPKEEP);
    });

    test('la comida y la posada suben con el pan; el sueldo no', () => {
        const cerrado = world();
        cerrado[0].routes[0].closed = true;
        const prices = applyMarket(DEFAULT_UPKEEP, here(cerrado));

        expect(prices.foodPerDay).toBeGreaterThan(DEFAULT_UPKEEP.foodPerDay);
        expect(prices.lodgingPerWeek).toBeGreaterThan(DEFAULT_UPKEEP.lodgingPerWeek);
        // Quien va contigo por dinero cobra lo pactado, no lo que valga el pan.
        expect(prices.wagePerWeek).toBe(DEFAULT_UPKEEP.wagePerWeek);
        expect(prices.healingPerDay).toBe(DEFAULT_UPKEEP.healingPerDay);
    });

    test('y el impuesto sube con quien manda', () => {
        const prices = applyMarket(DEFAULT_UPKEEP, here(world(), [bando()]));
        expect(prices.taxPerWeek).toBe(DEFAULT_UPKEEP.taxPerWeek * 2);
    });

    // Una cuenta con decimales no la entiende nadie.
    test('no salen céntimos', () => {
        const cerrado = world();
        cerrado[0].routes[0].closed = true;
        for (const value of Object.values(applyMarket(DEFAULT_UPKEEP, here(cerrado)))) {
            expect(Number.isInteger(value)).toBe(true);
        }
    });

    // La prueba que importa: el viernes se paga más.
    test('la cuenta del viernes sube de verdad', () => {
        const party = [
            { name: 'Lyra', hp: 10, maxHp: 10 },
            { name: 'Brand', hp: 10, maxHp: 10, joinedFor: 'dinero' },
        ];
        const cerrado = world();
        cerrado[0].routes[0].closed = true;

        const antes = weeklyBill(party, { rules: DEFAULT_UPKEEP });
        const despues = weeklyBill(party, {
            rules: applyMarket(DEFAULT_UPKEEP, here(cerrado, [bando()])),
        });
        expect(despues.total).toBeGreaterThan(antes.total);
    });
});

describe('y por qué cuesta lo que cuesta', () => {
    // Una cuenta que sube sin decir por qué es un impuesto.
    test('se dice el motivo y cuánto ha subido', () => {
        const cerrado = world();
        cerrado[0].routes[0].closed = true;
        const dicho = describeMarket(here(cerrado, [bando()]));
        expect(dicho).toContain('La Ermita');
        expect(dicho).toMatch(/\d+% más/);
        expect(dicho).not.toMatch(/undefined|NaN/);
    });

    test('y sin motivos no se dice nada', () => {
        expect(describeMarket({ food: 1, tax: 1, reasons: [] })).toBe('');
        expect(describeMarket(null)).toBe('');
    });
});
