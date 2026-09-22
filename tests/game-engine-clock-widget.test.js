import { describe, test, expect } from '@jest/globals';
import {
    buildClockView, describeClock, availableHitDice,
} from '../public/scripts/game-engine/ui/shell/clock-widget.js';

const member = (over = {}) => ({
    id: 1, name: 'Lyra', hp: 4, maxHp: 20, level: 3, constitution: 14, class: 'guerrero', ...over,
});

describe('el reloj del Modo Juego', () => {
    test('dice el dia y el momento', () => {
        const view = buildClockView({ day: 3, slotLabel: 'Tarde', party: [member()] });
        expect(view.label).toBe('Día 3 · Tarde');
        expect(view.day).toBe(3);
        expect(view.slot).toBe('Tarde');
    });

    test('y sin momento, solo el dia', () => {
        expect(buildClockView({ day: 2, party: [member()] }).label).toBe('Día 2');
    });

    test('un dia imposible se queda en el primero', () => {
        expect(buildClockView({ day: 0 }).day).toBe(1);
        expect(buildClockView({ day: -4 }).day).toBe(1);
        expect(buildClockView({}).day).toBe(1);
    });

    test('ofrece las cuatro cosas que se pueden hacer con el tiempo', () => {
        const view = buildClockView({ party: [member()] });
        expect(view.actions.map(a => a.id)).toEqual(['slot', 'day', 'short', 'long']);
        expect(view.actions.every(a => a.enabled)).toBe(true);
    });
});

describe('lo que el combate impide', () => {
    test('peleando no se pasa el tiempo, y lo dice', () => {
        const view = buildClockView({ fighting: true, party: [member()] });
        expect(view.actions.every(a => !a.enabled)).toBe(true);
        expect(view.actions.every(a => a.why === 'No mientras peleas.')).toBe(true);
    });

    test('pero los botones siguen a la vista: apagados, no escondidos', () => {
        expect(buildClockView({ fighting: true }).actions).toHaveLength(4);
    });
});

describe('los dados de golpe deciden el descanso corto', () => {
    test('sin dados disponibles no hay descanso corto', () => {
        const spent = member({ level: 2, hitDiceSpent: 2 });
        const view = buildClockView({ party: [spent] });
        const short = view.actions.find(a => a.id === 'short');
        expect(short.enabled).toBe(false);
        expect(short.why).toMatch(/descanso largo/);
    });

    test('y el largo sigue disponible, que es lo que los devuelve', () => {
        const spent = member({ level: 2, hitDiceSpent: 2 });
        const view = buildClockView({ party: [spent] });
        expect(view.actions.find(a => a.id === 'long').enabled).toBe(true);
    });

    test('basta con que a uno le quede alguno', () => {
        const party = [member({ level: 2, hitDiceSpent: 2 }), member({ id: 2, name: 'Brand', level: 3, hitDiceSpent: 1 })];
        expect(availableHitDice(party)).toBe(2);
        expect(buildClockView({ party }).actions.find(a => a.id === 'short').enabled).toBe(true);
    });

    test('un grupo vacio no tiene dados', () => {
        expect(availableHitDice([])).toBe(0);
        expect(availableHitDice(null)).toBe(0);
    });
});

describe('el reloj contado en una linea', () => {
    test('lista lo que se puede', () => {
        const view = buildClockView({ day: 1, slotLabel: 'Mañana', party: [member()] });
        expect(describeClock(view)).toBe(
            'Día 1 · Mañana. Puedes: Pasar el rato, Dormir, Descanso corto, Descanso largo.');
    });

    test('y peleando, que no se puede nada', () => {
        const view = buildClockView({ day: 1, slotLabel: 'Noche', fighting: true });
        expect(describeClock(view)).toBe('Día 1 · Noche. No se puede pasar el tiempo ahora.');
    });
});
