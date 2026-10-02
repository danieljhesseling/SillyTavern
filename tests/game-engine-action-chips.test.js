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
    test('nunca pasa de siete: seis, y la que dice cuántas quedan (idea 169)', () => {
        const chips = buildActionChips({
            doors: [{ x: 1, y: 1, distance: 1 }, { x: 2, y: 2, distance: 2 }],
            companions: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
            hurt: true, hitDice: 4,
            boards: [{ name: 'X' }, { name: 'Y' }],
            places: [{ name: 'Z' }],
        });
        expect(chips).toHaveLength(7);
        expect(chips.at(-1)).toMatchObject({ id: 'more', label: '+3 más' });
    });

    test('y se cuenta en una linea', () => {
        const chips = buildActionChips({ companions: [{ name: 'Lyra' }], hurt: true, hitDice: 1 });
        expect(describeChips(chips)).toBe('Hablar con Lyra · Descanso corto');
    });
});

describe('el gremio y la pelea que espera', () => {
    // Tanda 10: la pelea del tablero empieza sola (`party/fight-entry.js`): ninguna ficha la empieza.
    test('ninguna ficha empieza la pelea ni la evita: delante va el gremio', () => {
        const chips = buildActionChips({
            hub: [{ id: 'hub-board', label: 'Tablón de campañas', icon: 'fa-scroll', command: '/campanas' }],
            hasBoard: true,
        });
        expect(chips.map(c => c.id)).toEqual(['hub-board', 'leave']);
        expect(chips.some(c => /Iniciar combate|Evitar la pelea/.test(c.label))).toBe(false);
    });

    test('en combate no hay gremio', () => {
        expect(buildActionChips({ fighting: true, hub: [{ id: 'hub-home', label: 'Volver al gremio', icon: 'x', command: '/volver-gremio' }] })).toEqual([]);
    });
});

describe('el tablero que pide la historia', () => {
    const boards = [{ name: 'Taberna' }, { name: 'Mansión' }, { name: 'Sótano' }];

    test('sus fichas van delante; los demás, al final, como siempre', () => {
        const chips = buildActionChips({ boards, thread: ['Mansión', 'Sótano'], explore: true, companions: [{ name: 'Gerd' }] });
        expect(chips.map(c => c.id)).toEqual(['enter:Mansión', 'enter:Sótano', 'talk:Gerd', 'explore', 'enter:Taberna']);
    });

    test('sin historia que lo pida, el orden de siempre', () => {
        const chips = buildActionChips({ boards, explore: true });
        expect(chips.map(c => c.id)).toEqual(['explore', 'enter:Taberna', 'enter:Mansión']);
    });

    test('J2.1: desde otro tablero de aquí también se ofrece, si se sabe cuál está abierto; el abierto, no', () => {
        const onPier = buildActionChips({ boards, thread: ['Mansión'], hasBoard: true, board: 'Taberna' });
        expect(onPier.map(c => c.id)).toEqual(['enter:Mansión', 'leave']);
        expect(onPier[0].command).toBe('/enter Mansión');
        expect(buildActionChips({ boards, thread: ['Mansión'], hasBoard: true, board: 'Mansión' }).map(c => c.id)).toEqual(['leave']);
        // Sin decir cuál, como antes: en un tablero, solo salir.
        expect(buildActionChips({ boards, thread: ['Mansión'], hasBoard: true }).map(c => c.id)).toEqual(['leave']);
    });
});

describe('J12.3: las trampas del tablero', () => {
    const traps = [
        { id: 'trap-disarm:losa', label: 'Desarmar: losa hundida', icon: 'fa-screwdriver-wrench', urgent: true },
        { id: 'trap-search', label: 'Buscar trampas', icon: 'fa-magnifying-glass' },
    ];

    test('desarmar la de al lado va con las puertas; buscar, al final, detrás de salir', () => {
        const chips = buildActionChips({ hasBoard: true, doors: [{ x: 1, y: 2, distance: 5 }], traps, companions: [{ name: 'Gerd' }] });
        expect(chips.map(c => c.id)).toEqual(['door:1,2', 'trap-disarm:losa', 'talk:Gerd', 'leave', 'trap-search']);
        // Sin comando: se resuelven al pulsarlas (`runTrapChip`), no escribiendo nada.
        expect(chips.filter(c => c.id.startsWith('trap-')).every(c => !c.command)).toBe(true);
    });

    test('en combate, nada', () => {
        expect(buildActionChips({ fighting: true, hasBoard: true, traps })).toEqual([]);
    });
});
