import { describe, test, expect } from '@jest/globals';
import {
    TRIGGERS, EFFECTS, DEFAULT_SPOT_DC, cellKey, readHazard, hazardsOf, hazardsAt,
    visibleHazards, tellsOf, enterCell, startRound, searchCell, disarmHazard, describeHazard,
} from '../public/scripts/game-engine/board/hazards.js';

/** Un tablero con las tres cosas: una trampa, un hito de ronda y algo que crece. */
const board = () => ({
    hazards: [
        {
            id: 'losa', name: 'Losa hundida', kind: 'trampa', trigger: 'enter', x: 3, y: 4,
            tell: 'Una losa más gastada que las de al lado.',
            effect: 'damage', damageDice: '2d6', spotDC: 13, disarmDC: 12,
        },
        {
            id: 'techo', name: 'El techo cede', kind: 'suceso', trigger: 'round', round: 3,
            effect: 'terrain', terrain: 'difficult', note: 'Cae media bóveda.',
        },
        {
            id: 'fuego', name: 'El fuego', kind: 'estado', trigger: 'round', every: 2,
            x: 6, y: 6, spreads: 1, effect: 'terrain', terrain: 'difficult',
        },
    ],
});

describe('leer lo que hay puesto', () => {
    test('se normaliza con lo que falte', () => {
        const hazard = readHazard({ id: 'x' });
        expect(hazard.trigger).toBe('enter');
        expect(hazard.effect).toBe('none');
        expect(hazard.armed).toBe(true);
        expect(hazard.seen).toBe(false);
        expect(hazard.spotDC).toBe(DEFAULT_SPOT_DC);
    });

    // Escribir un disparador que nadie mira sería una ficha que no hace nada.
    test('un disparador o un efecto inventados caen en el de siempre', () => {
        expect(readHazard({ trigger: 'cuando me apetezca' }).trigger).toBe('enter');
        expect(readHazard({ effect: 'explotar el mundo' }).effect).toBe('none');
        expect(TRIGGERS).toContain(readHazard({}).trigger);
        expect(EFFECTS).toContain(readHazard({}).effect);
    });

    test('un tablero sin nada puesto no tiene nada, y no revienta', () => {
        expect(hazardsOf({})).toEqual([]);
        expect(hazardsOf(null)).toEqual([]);
    });

    test('se busca por casilla', () => {
        expect(hazardsAt(board(), 3, 4).map(h => h.id)).toEqual(['losa']);
        expect(hazardsAt(board(), 9, 9)).toEqual([]);
    });

    test('y la clave de casilla es la misma que usa el terreno', () => {
        expect(cellKey(3, 4)).toBe('3,4');
    });
});

describe('lo que se ve y lo que no', () => {
    // Enseñar todas las trampas convierte el tablero en una lista de casillas prohibidas.
    test('lo que no se ha encontrado no se dibuja', () => {
        expect(visibleHazards(board())).toEqual([]);
    });

    test('lo encontrado sí', () => {
        const found = { hazards: [{ id: 'a', x: 1, y: 1, seen: true }] };
        expect(visibleHazards(found).map(h => h.id)).toEqual(['a']);
    });

    // Una trampa sin aviso no es una trampa: es un impuesto aleatorio.
    test('pero su aviso se lee aunque no se haya encontrado', () => {
        const tells = tellsOf(board());
        expect(tells).toHaveLength(1);
        expect(tells[0]).toEqual({ x: 3, y: 4, tell: 'Una losa más gastada que las de al lado.' });
    });

    test('y lo ya encontrado deja de avisar, porque ya se ve', () => {
        const seen = { hazards: [{ id: 'a', x: 1, y: 1, tell: 'algo', seen: true }] };
        expect(tellsOf(seen)).toEqual([]);
    });
});

describe('pisar una casilla', () => {
    test('lo que hay salta, y se dice qué', () => {
        const { fired } = enterCell(board(), { x: 3, y: 4 });
        expect(fired).toHaveLength(1);
        expect(fired[0].name).toBe('Losa hundida');
        expect(fired[0].damageDice).toBe('2d6');
    });

    test('pisar otra casilla no dispara nada', () => {
        expect(enterCell(board(), { x: 0, y: 0 }).fired).toEqual([]);
    });

    // Una trampa que salta y sigue invisible haría que la segunda vez fuera la misma
    // sorpresa, y eso no lo aguanta nadie.
    test('lo que salta queda descubierto', () => {
        const { hazards } = enterCell(board(), { x: 3, y: 4 });
        expect(hazards.find(h => h.id === 'losa').seen).toBe(true);
    });

    test('y una de un solo uso se gasta', () => {
        const once = { hazards: [{ id: 'a', x: 1, y: 1, trigger: 'enter', once: true }] };
        const { hazards } = enterCell(once, { x: 1, y: 1 });
        expect(hazards[0].armed).toBe(false);
        expect(enterCell({ hazards }, { x: 1, y: 1 }).fired).toEqual([]);
    });

    test('lo desarmado no salta', () => {
        const off = { hazards: [{ id: 'a', x: 1, y: 1, trigger: 'enter', armed: false }] };
        expect(enterCell(off, { x: 1, y: 1 }).fired).toEqual([]);
    });
});

describe('las rondas', () => {
    // Un tablero que cambia mientras peleas es lo que hace que quedarse quieto tenga precio.
    test('un hito salta en su ronda y no en otra', () => {
        expect(startRound(board(), 2).fired.map(h => h.id)).not.toContain('techo');
        expect(startRound(board(), 3).fired.map(h => h.id)).toContain('techo');
    });

    test('lo que va cada N rondas salta en todas las suyas', () => {
        expect(startRound(board(), 2).fired.map(h => h.id)).toContain('fuego');
        expect(startRound(board(), 4).fired.map(h => h.id)).toContain('fuego');
        expect(startRound(board(), 3).fired.map(h => h.id)).not.toContain('fuego');
    });

    test('lo que crece dice qué casillas se lleva', () => {
        const { spread } = startRound(board(), 2);
        expect(spread).toHaveLength(8);
        expect(spread).toContainEqual({ x: 5, y: 5, terrain: 'difficult' });
        expect(spread).not.toContainEqual({ x: 6, y: 6, terrain: 'difficult' });
    });

    test('y lo que no crece no se lleva nada', () => {
        expect(startRound(board(), 3).spread).toEqual([]);
    });
});

describe('buscar', () => {
    test('una tirada que llega encuentra lo que hay', () => {
        const { found, hazards, reason } = searchCell(board(), { x: 3, y: 4 }, 15);
        expect(found.map(h => h.id)).toEqual(['losa']);
        expect(hazards.find(h => h.id === 'losa').seen).toBe(true);
        expect(reason).toMatch(/Encuentras/);
    });

    // «No hay nada» y «hay algo y no lo ves» no son lo mismo, y decirlo igual sería mentir.
    test('una que no llega lo dice sin decir dónde', () => {
        const { found, missed, reason } = searchCell(board(), { x: 3, y: 4 }, 5);
        expect(found).toEqual([]);
        expect(missed).toHaveLength(1);
        expect(reason).toMatch(/no sabes qué/);
    });

    test('y donde no hay nada, se dice que no hay nada', () => {
        expect(searchCell(board(), { x: 0, y: 0 }, 20).reason).toBe('Aquí no hay nada raro.');
    });
});

describe('desarmar', () => {
    // Buscar primero es media mecánica; saltárselo la convierte en un botón que siempre
    // funciona.
    test('no se puede desarmar lo que no se ha encontrado', () => {
        const { ok, reason } = disarmHazard(board(), 'losa', 20);
        expect(ok).toBe(false);
        expect(reason).toMatch(/encontrarla/);
    });

    test('una vez encontrada, una tirada que llega la quita', () => {
        const { hazards } = searchCell(board(), { x: 3, y: 4 }, 15);
        const { ok, hazards: after, reason } = disarmHazard({ hazards }, 'losa', 14);
        expect(ok).toBe(true);
        expect(after.find(h => h.id === 'losa').armed).toBe(false);
        expect(reason).toMatch(/desarmada/);
    });

    test('y una que no llega la deja puesta, y lo dice', () => {
        const { hazards } = searchCell(board(), { x: 3, y: 4 }, 15);
        const { ok, reason } = disarmHazard({ hazards }, 'losa', 4);
        expect(ok).toBe(false);
        expect(reason).toMatch(/sigue puesta/);
    });

    test('lo que no existe se dice, no se traga', () => {
        expect(disarmHazard(board(), 'no-existe', 20).reason).toMatch(/nada que desarmar/);
    });
});

describe('contado en una línea', () => {
    test('dice qué es y qué hace', () => {
        expect(describeHazard(readHazard({
            name: 'Losa hundida', effect: 'damage', damageDice: '2d6',
        }))).toBe('Losa hundida · 2d6');
    });

    test('y lo que solo cambia el suelo cuenta su nota', () => {
        expect(describeHazard(readHazard({
            name: 'El techo cede', effect: 'terrain', note: 'Cae media bóveda.',
        }))).toBe('El techo cede · Cae media bóveda.');
    });
});
