import { describe, test, expect } from '@jest/globals';
import { terrainFromAsciiMap, cellKey } from '../public/scripts/game-engine/board/terrain.js';
import { planExploreAhead, aheadLine, aheadNotice, thingKey } from '../public/scripts/game-engine/board/explore-ahead.js';

/** Un pasillo largo hacia la derecha y una sala al fondo. */
const MAP = [
    '##############################',
    '#....#.......................#',
    '#....#.......................#',
    '#............#########.......#',
    '#....#.......#.......#.......#',
    '##############################',
];
const terrain = terrainFromAsciiMap(MAP);
const W = MAP[0].length;
const H = MAP.length;
const base = { terrain, gridWidth: W, gridHeight: H, start: { x: 1, y: 3 }, sight: 4 };
/** Lo visto alrededor de la salida, como lo deja la niebla. */
const near = () => {
    const out = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < 6; x++) out.push(cellKey(x, y));
    return out;
};

describe('E7.1: explorar hacia delante', () => {
    test('sin nada por delante, anda hasta lo último sin ver y se para porque no queda nada', () => {
        const plan = planExploreAhead({ ...base, explored: near() });
        expect(['nothing', 'far']).toContain(plan.kind);
        expect(plan.path.length).toBeGreaterThan(10);
        expect(aheadLine(plan)).toBe('');
        expect(aheadNotice(plan)).toBeTruthy();
    });

    test('se para en seco al ver a alguien, antes de llegar a su lado', () => {
        const foe = { kind: /** @type {const} */ ('foe'), x: 20, y: 2, name: 'Lobo' };
        const plan = planExploreAhead({ ...base, explored: near(), things: [foe] });
        expect(plan.kind).toBe('foe');
        const end = plan.to;
        expect(Math.max(Math.abs(end.x - foe.x), Math.abs(end.y - foe.y))).toBeGreaterThan(1);
        expect(aheadLine(plan)).toBe('¡Alto! Ahí delante hay alguien: Lobo.');
        expect(plan.seen).toContain(thingKey(foe));
    });

    test('a un cofre que ya se ve se va hasta su lado, y lo dice', () => {
        const chest = { kind: /** @type {const} */ ('chest'), x: 4, y: 1 };
        const plan = planExploreAhead({ ...base, explored: near(), things: [chest] });
        expect(plan.kind).toBe('chest');
        expect(Math.max(Math.abs(plan.to.x - 4), Math.abs(plan.to.y - 1))).toBe(1);
        expect(aheadLine(plan)).toBe('Mirad, un cofre.');
        // Ya dicho, la vez siguiente no para ahí.
        const again = planExploreAhead({ ...base, start: plan.to, explored: near(), things: [chest], seen: plan.seen });
        expect(again.kind).not.toBe('chest');
    });

    test('una trampa vista que ya está a la vista para la marcha sin dar un paso', () => {
        const trap = { kind: /** @type {const} */ ('trap'), x: 3, y: 3, name: 'Foso' };
        const plan = planExploreAhead({ ...base, explored: near(), things: [trap] });
        expect(plan.kind).toBe('trap');
        expect(plan.path).toHaveLength(1);
        expect(aheadLine(plan)).toMatch(/trampa: foso/);
    });

    test('una puerta cerrada que aparece andando para la marcha', () => {
        const map = ['##########', '#........#', '#####D####', '#........#', '##########'];
        const t = terrainFromAsciiMap(map);
        const plan = planExploreAhead({ terrain: t, gridWidth: 10, gridHeight: 5, start: { x: 1, y: 1 }, sight: 2, explored: [cellKey(1, 1), cellKey(2, 1)], things: [{ kind: 'door', x: 5, y: 2 }] });
        expect(plan.kind).toBe('door');
        expect(aheadLine(plan)).toMatch(/puerta/);
    });

    test('a oscuras, sin luz ni visión en la oscuridad, no se avanza (E2.1)', () => {
        const plan = planExploreAhead({ ...base, explored: near(), canSee: false });
        expect(plan.kind).toBe('dark');
        expect(plan.path).toHaveLength(1);
        expect(aheadLine(plan)).toMatch(/luz/);
    });

    test('sin niebla, solo para en lo que queda por decir', () => {
        const chest = { kind: /** @type {const} */ ('chest'), x: 27, y: 4 };
        const plan = planExploreAhead({ ...base, explored: null, things: [chest] });
        expect(plan.kind).toBe('chest');
        const done = planExploreAhead({ ...base, start: plan.to, explored: null, things: [chest], seen: plan.seen });
        expect(done.kind).toBe('nothing');
    });
});
