import { describe, test, expect } from '@jest/globals';
import {
    findOpportunityAttacks, describeOpportunity,
} from '../public/scripts/game-engine/combat/opportunity.js';

const goblin = (x, y, over = {}) => ({ name: 'Goblin', gridX: x, gridY: y, currentHp: 7, ...over });
const lyra = { name: 'Lyra' };

const attacks = (from, to, threats, options = {}) =>
    findOpportunityAttacks({ mover: lyra, from, to, threats, ...options });

describe('cuando alguien se escapa', () => {
    test('quien lo tenia pegado se lleva un ataque gratis', () => {
        const result = attacks({ x: 5, y: 5 }, { x: 8, y: 5 }, [goblin(5, 6)]);
        expect(result).toHaveLength(1);
        expect(result[0].reason).toMatch(/sale del alcance/);
        expect(result[0].fromFeet).toBe(5);
    });

    test('moverse sin salir de su alcance no cuenta', () => {
        // De (5,5) a (4,6): sigue pegado al goblin de (5,6).
        expect(attacks({ x: 5, y: 5 }, { x: 4, y: 6 }, [goblin(5, 6)])).toEqual([]);
    });

    test('ni acercarse', () => {
        expect(attacks({ x: 9, y: 5 }, { x: 6, y: 5 }, [goblin(5, 5)])).toEqual([]);
    });

    test('quien ya estaba lejos no tenia nada que perder', () => {
        expect(attacks({ x: 5, y: 5 }, { x: 9, y: 5 }, [goblin(1, 1)])).toEqual([]);
    });

    test('quedarse quieto no es escaparse', () => {
        expect(attacks({ x: 5, y: 5 }, { x: 5, y: 5 }, [goblin(5, 6)])).toEqual([]);
    });

    test('la diagonal cuenta igual que el recto', () => {
        // A (7,7) sigues pegado al goblin de (6,6): en diagonal, adyacente es adyacente.
        expect(attacks({ x: 5, y: 5 }, { x: 7, y: 7 }, [goblin(6, 6)])).toEqual([]);
        expect(attacks({ x: 5, y: 5 }, { x: 8, y: 8 }, [goblin(6, 6)])).toHaveLength(1);
    });
});

describe('quien puede reaccionar', () => {
    test('un muerto no ataca', () => {
        const result = attacks({ x: 5, y: 5 }, { x: 8, y: 5 }, [goblin(5, 6, { currentHp: 0 })],
            { isAlive: (t) => (t.currentHp || 0) > 0 });
        expect(result).toEqual([]);
    });

    test('ni quien ya gasto su reaccion', () => {
        const result = attacks({ x: 5, y: 5 }, { x: 8, y: 5 }, [goblin(5, 6)], { canReact: () => false });
        expect(result).toEqual([]);
    });

    test('un arquero no amenaza a quien le pasa por delante', () => {
        const result = attacks({ x: 5, y: 5 }, { x: 8, y: 5 }, [goblin(5, 6, { name: 'Arquero' })],
            { reachOf: () => 120 });
        expect(result).toEqual([]);
    });

    test('y varios a la vez se llevan uno cada uno', () => {
        const result = attacks({ x: 5, y: 5 }, { x: 9, y: 9 }, [goblin(5, 6), goblin(4, 5, { name: 'Lobo' })]);
        expect(result.map(a => a.name)).toEqual(['Goblin', 'Lobo']);
    });
});

describe('lo que se anuncia', () => {
    test('nombra a quien ataca', () => {
        const result = attacks({ x: 5, y: 5 }, { x: 9, y: 9 }, [goblin(5, 6), goblin(4, 5, { name: 'Lobo' })]);
        expect(describeOpportunity(result, lyra))
            .toBe('⚔️ Lyra se aleja y deja el flanco: ataque de oportunidad de Goblin, Lobo.');
    });

    test('y si no hay nadie, no dice nada', () => {
        expect(describeOpportunity([], lyra)).toBe('');
    });
});
