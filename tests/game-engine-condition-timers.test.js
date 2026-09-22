import { describe, test, expect } from '@jest/globals';
import {
    normalizeTimers, addConditionTimer, expireConditions, clearTimersFor, describeTimers,
} from '../public/scripts/game-engine/combat/condition-timers.js';

describe('apuntar una condicion que caduca', () => {
    test('se apunta con la ronda en la que se va', () => {
        const timers = addConditionTimer([], { who: 'e1', condition: 'Prone', round: 2, rounds: 1 });
        expect(timers).toEqual([{ who: 'e1', condition: 'Prone', until: 3 }]);
    });

    test('la misma sobre el mismo no se duplica: se queda la que mas dura', () => {
        let timers = addConditionTimer([], { who: 'e1', condition: 'Prone', round: 2, rounds: 3 });
        timers = addConditionTimer(timers, { who: 'e1', condition: 'prone', round: 2, rounds: 1 });
        expect(timers).toHaveLength(1);
        expect(timers[0].until).toBe(5);
    });

    test('sobre otro, si es otra', () => {
        let timers = addConditionTimer([], { who: 'e1', condition: 'Prone', round: 1, rounds: 1 });
        timers = addConditionTimer(timers, { who: 'e2', condition: 'Prone', round: 1, rounds: 1 });
        expect(timers).toHaveLength(2);
    });

    test('lo que no se sostiene se cae al leerlo', () => {
        expect(normalizeTimers([{ who: '', condition: 'Prone', until: 2 }, null, { who: 'e1' }])).toEqual([]);
        expect(normalizeTimers('nada')).toEqual([]);
    });
});

describe('barrerlas al pasar de ronda', () => {
    const timers = [
        { who: 'e1', condition: 'Prone', until: 3 },
        { who: 'e2', condition: 'Stunned', until: 5 },
    ];

    test('antes de su ronda no se van', () => {
        const result = expireConditions(timers, 2);
        expect(result.expired).toEqual([]);
        expect(result.timers).toHaveLength(2);
    });

    test('y al llegar, si', () => {
        const result = expireConditions(timers, 3);
        expect(result.expired).toEqual([{ who: 'e1', condition: 'Prone' }]);
        expect(result.timers).toEqual([{ who: 'e2', condition: 'Stunned', until: 5 }]);
    });

    test('una ronda muy posterior las barre todas', () => {
        expect(expireConditions(timers, 99).timers).toEqual([]);
        expect(expireConditions(timers, 99).expired).toHaveLength(2);
    });
});

describe('cuando alguien cae', () => {
    test('se le quitan todos los apuntes', () => {
        const timers = [
            { who: 'e1', condition: 'Prone', until: 3 },
            { who: 'e1', condition: 'Stunned', until: 4 },
            { who: 'e2', condition: 'Prone', until: 3 },
        ];
        expect(clearTimersFor(timers, 'e1')).toEqual([{ who: 'e2', condition: 'Prone', until: 3 }]);
    });
});

describe('contado en palabras', () => {
    test('dice lo que queda puesto y cuanto', () => {
        const timers = [{ who: 'e1', condition: 'Prone', until: 5 }, { who: 'e1', condition: 'Stunned', until: 4 }];
        expect(describeTimers(timers, 'e1', 2)).toBe('Prone (3 ronda(s)), Stunned (2 ronda(s))');
    });

    test('y si no hay nada, no dice nada', () => {
        expect(describeTimers([], 'e1', 1)).toBe('');
    });
});
