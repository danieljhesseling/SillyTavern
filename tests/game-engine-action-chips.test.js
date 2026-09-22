import { describe, test, expect } from '@jest/globals';
import {
    buildActionChips, describeChips,
} from '../public/scripts/game-engine/ui/shell/action-chips.js';

describe('las fichas de accion', () => {
    test('en combate no hay ninguna: la barra de abajo ya manda', () => {
        expect(buildActionChips({
            fighting: true, doors: [{ x: 1, y: 1, distance: 5 }], companions: [{ name: 'Brand' }],
        })).toEqual([]);
    });

    test('sin nada alrededor, no se inventa nada', () => {
        expect(buildActionChips({})).toEqual([]);
        expect(describeChips([])).toBe('Nada que ofrecer: lo que toca es escribir.');
    });
});

describe('las puertas', () => {
    test('salen con su casilla, contada como la ve el jugador', () => {
        const chips = buildActionChips({ doors: [{ x: 4, y: 2, distance: 10 }] });
        expect(chips[0].label).toBe('Abrir la puerta (5, 3)');
        expect(chips[0].cell).toEqual({ x: 4, y: 2 });
        expect(chips[0].source).toBe('motor');
    });

    test('la mas cercana primero, y como mucho dos', () => {
        const chips = buildActionChips({
            doors: [
                { x: 9, y: 9, distance: 60 },
                { x: 1, y: 1, distance: 5 },
                { x: 3, y: 3, distance: 20 },
            ],
        });
        expect(chips.map(c => c.label)).toEqual([
            'Abrir la puerta (2, 2)', 'Abrir la puerta (4, 4)',
        ]);
    });

    test('una puerta sin casilla no llega a ficha', () => {
        expect(buildActionChips({ doors: [{ distance: 5 }, null] })).toEqual([]);
    });
});

describe('hablar', () => {
    test('deja el texto empezado, no lo envia', () => {
        const chips = buildActionChips({ companions: [{ name: 'Lyra' }] });
        expect(chips[0].draft).toBe('Hablo con Lyra sobre ');
        expect(chips[0].command).toBeUndefined();
    });

    test('quien acaba de ser nombrado va delante', () => {
        const chips = buildActionChips({
            companions: [{ name: 'Lyra' }, { name: 'Brand' }, { name: 'Wren' }],
            mentioned: ['brand'],
        });
        expect(chips[0].label).toBe('Hablar con Brand');
        expect(chips[0].source).toBe('sabor');
        expect(chips[1].source).toBe('motor');
    });

    test('nombrar a alguien que no esta no lo trae', () => {
        const chips = buildActionChips({ companions: [], mentioned: ['El rey Arturo'] });
        expect(chips).toEqual([]);
    });
});

describe('descansar y moverse', () => {
    test('el descanso corto solo si hay heridas y dados', () => {
        expect(buildActionChips({ hurt: true, hitDice: 2 }).map(c => c.id)).toContain('rest:corto');
        expect(buildActionChips({ hurt: true, hitDice: 0 }).map(c => c.id)).not.toContain('rest:corto');
        expect(buildActionChips({ hurt: false, hitDice: 3 }).map(c => c.id)).not.toContain('rest:corto');
    });

    test('con un tablero abierto, lo que se ofrece es salir', () => {
        const chips = buildActionChips({ hasBoard: true, boards: [{ name: 'Sótano' }], places: [{ name: 'Molino' }] });
        expect(chips.map(c => c.command)).toEqual(['/leave']);
    });

    test('sin tablero, entrar y viajar, con el comando que ya existe', () => {
        const chips = buildActionChips({
            boards: [{ name: 'Sótano' }], places: [{ name: 'Molino' }],
        });
        expect(chips.map(c => c.command)).toEqual(['/enter Sótano', '/go Molino']);
    });
});

describe('la fila se lee de un vistazo', () => {
    test('nunca pasa de seis', () => {
        const chips = buildActionChips({
            doors: [{ x: 1, y: 1, distance: 1 }, { x: 2, y: 2, distance: 2 }],
            companions: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
            hurt: true, hitDice: 4,
            boards: [{ name: 'X' }, { name: 'Y' }],
            places: [{ name: 'Z' }],
        });
        expect(chips).toHaveLength(6);
    });

    test('y se cuenta en una linea', () => {
        const chips = buildActionChips({ companions: [{ name: 'Lyra' }], hurt: true, hitDice: 1 });
        expect(describeChips(chips)).toBe('Hablar con Lyra · Descanso corto');
    });
});
