import { describe, test, expect } from '@jest/globals';
import {
    BUILDINGS, LOYALTY, RENOWN_BY_RANK, readGuild, upgradeCost,
    upkeepWithBuildings, boardSize, settleLoyalty, completeContract, describeGuild,
} from '../public/scripts/game-engine/campaign/guild.js';
import { DEFAULT_UPKEEP } from '../public/scripts/game-engine/rules/upkeep.js';

const guild = (extra = {}) => readGuild({ name: 'La Rueda Rota', theme: 'mercenaries', renown: 5, ...extra });

describe('leer un gremio', () => {
    test('de lo que haya guardado', () => {
        expect(guild().name).toBe('La Rueda Rota');
        expect(guild().renown).toBe(5);
    });

    test('y de nada, sin romperse', () => {
        expect(readGuild(null)).toEqual({ name: '', theme: 'general', renown: 0, buildings: {} });
    });

    test('un edificio no sube más allá de su último nivel, se guarde lo que se guarde', () => {
        const cheated = readGuild({ buildings: { kitchen: 99 } });
        expect(cheated.buildings.kitchen).toBe(BUILDINGS.kitchen.cost.length);
    });

    test('ni existe un edificio que no está en la lista', () => {
        expect(readGuild({ buildings: { piscina: 3 } }).buildings.piscina).toBeUndefined();
    });
});

describe('construir', () => {
    test('el primer nivel cuesta lo que dice la tabla', () => {
        expect(upgradeCost(guild(), 'kitchen')).toEqual({ cost: BUILDINGS.kitchen.cost[0], nextLevel: 1, maxed: false });
    });

    test('y cada nivel cuesta más que el anterior', () => {
        for (const building of Object.values(BUILDINGS)) {
            for (let i = 1; i < building.cost.length; i++) {
                expect(building.cost[i]).toBeGreaterThan(building.cost[i - 1]);
            }
        }
    });

    test('al máximo ya no se puede subir', () => {
        const full = guild({ buildings: { kitchen: BUILDINGS.kitchen.cost.length } });
        expect(upgradeCost(full, 'kitchen').maxed).toBe(true);
    });

    test('un edificio inventado no cuesta nada porque no existe', () => {
        expect(upgradeCost(guild(), 'piscina').maxed).toBe(true);
    });
});

describe('lo que hacen los edificios', () => {
    // Un edificio que solo diera puntos seria una barra de progreso con ladrillos: cada
    // uno toca un numero que la cuenta semanal ya usa.
    test('cada uno toca un número que la cuenta ya lee, o trae trabajo', () => {
        for (const [key, building] of Object.entries(BUILDINGS)) {
            const touches = Object.keys(building.effect);
            const bringsWork = key === 'library' || key === 'forge';
            expect(touches.length > 0 || bringsWork).toBe(true);
            for (const field of touches) expect(DEFAULT_UPKEEP).toHaveProperty(field);
        }
    });

    test('la cocina abarata la comida', () => {
        const prices = upkeepWithBuildings(DEFAULT_UPKEEP, guild({ buildings: { kitchen: 2 } }));
        expect(prices.foodPerDay).toBeLessThan(DEFAULT_UPKEEP.foodPerDay);
    });

    test('los dormitorios abaratan la posada', () => {
        const prices = upkeepWithBuildings(DEFAULT_UPKEEP, guild({ buildings: { bunks: 1 } }));
        expect(prices.lodgingPerWeek).toBe(DEFAULT_UPKEEP.lodgingPerWeek - 3);
    });

    // Una cocina muy buena abarata la comida; no hace que te paguen por comer.
    test('pero nada baja de cero', () => {
        const prices = upkeepWithBuildings({ foodPerDay: 1 }, guild({ buildings: { kitchen: 3 } }));
        expect(prices.foodPerDay).toBe(0);
    });

    test('sin construir nada, los precios son los de la campaña', () => {
        expect(upkeepWithBuildings(DEFAULT_UPKEEP, guild())).toEqual(DEFAULT_UPKEEP);
    });

    test('la biblioteca trae más trabajo al tablón', () => {
        expect(boardSize(guild({ buildings: { library: 2 } }))).toBeGreaterThan(boardSize(guild()));
    });
});

describe('la lealtad', () => {
    const roster = () => ([
        { name: 'Brand', motive: 'coin', loyalty: 3 },
        { name: 'Sela', motive: 'coin', loyalty: 1 },
        { name: 'Bruna', motive: 'bond' },
    ]);

    test('quien cobra se queda igual', () => {
        const result = settleLoyalty(roster(), []);
        expect(result.leaving).toEqual([]);
        expect(result.roster).toHaveLength(3);
    });

    test('quien no cobra pierde lealtad, y se dice', () => {
        const result = settleLoyalty(roster(), ['Brand']);
        expect(result.roster.find(m => m.name === 'Brand').loyalty).toBe(3 - LOYALTY.lossPerUnpaidWeek);
        expect(result.lines.join(' ')).toMatch(/boca pequeña/);
    });

    test('y quien llega al fondo se va', () => {
        const result = settleLoyalty(roster(), ['Sela']);
        expect(result.leaving).toEqual(['Sela']);
        expect(result.roster.map(m => m.name)).not.toContain('Sela');
        expect(result.lines.join(' ')).toMatch(/se va/);
    });

    // A quien te sigue por un vinculo no se le paga: cobrarle lealtad por una semana mala
    // seria castigar la amistad.
    test('a quien va contigo por un vínculo no le pasa nada', () => {
        const result = settleLoyalty(roster(), ['Brand', 'Sela', 'Bruna']);
        expect(result.leaving).not.toContain('Bruna');
        expect(result.roster.find(m => m.name === 'Bruna').loyalty).toBeUndefined();
    });

    test('una plantilla vacía no da problemas', () => {
        expect(settleLoyalty(null, ['nadie'])).toEqual({ roster: [], leaving: [], lines: [] });
    });
});

describe('entregar un encargo', () => {
    test('paga y da reputación según el rango', () => {
        const done = completeContract(guild(), { rank: 'B', reward: 150 });
        expect(done.gold).toBe(150);
        expect(done.renown).toBe(5 + RENOWN_BY_RANK.B);
    });

    test('y los rangos altos dan más', () => {
        expect(RENOWN_BY_RANK.S).toBeGreaterThan(RENOWN_BY_RANK.D);
    });

    test('un rango que no existe no rompe la cuenta', () => {
        expect(completeContract(guild(), { rank: 'Z', reward: 10 }).renown).toBe(6);
    });
});

describe('contado en una línea', () => {
    test('nombre, reputación y lo que hay levantado', () => {
        expect(describeGuild(guild({ buildings: { kitchen: 1 } })))
            .toBe('La Rueda Rota · reputación 5 · Cocina 1');
    });

    test('y sin construir nada lo dice', () => {
        expect(describeGuild(guild())).toMatch(/sin construir nada/);
    });
});
