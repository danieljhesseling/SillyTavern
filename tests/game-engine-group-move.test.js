import { describe, test, expect } from '@jest/globals';
import {
    planGroupMove, walkFrames, marchOrder, gatherCells, hoverOf, describeGroupMove,
} from '../public/scripts/game-engine/board/group-move.js';
import { terrainFromAsciiMap, cellKey } from '../public/scripts/game-engine/board/terrain.js';

/** Dos salas unidas por una puerta abierta, y una tercera tras una puerta cerrada. */
const MAP = [
    '################',
    '#.....#........#',
    '#.....o........#',
    '#.....#........#',
    '#.....#####D####',
    '#.....#........#',
    '################',
];
const terrain = () => terrainFromAsciiMap(MAP);
const W = 16;
const H = 7;

const group = () => [
    { id: 1, name: 'Bran', x: 1, y: 1, speed: 30, hp: 12 },
    { id: 2, name: 'Mira', x: 2, y: 1, speed: 30, hp: 8 },
    { id: 3, name: 'Pip', x: 1, y: 2, speed: 30, hp: 9 },
];

const plan = (extra = {}) => planGroupMove({ members: group(), to: { x: 12, y: 2 }, terrain: terrain(), gridWidth: W, gridHeight: H, ...extra });

describe('un clic, y va el grupo entero', () => {
    test('quien abre la marcha llega; los demás le siguen y se ponen alrededor', () => {
        const result = plan();
        expect(result.allowed).toBe(true);
        expect(result.leader).toBe('1');
        expect(result.path.at(-1)).toEqual({ x: 12, y: 2 });
        expect(result.moves).toHaveLength(3);
        const ends = result.moves.map(m => m.to);
        // Nadie encima de otro, y todos cerca de la llegada.
        expect(new Set(ends.map(e => cellKey(e.x, e.y))).size).toBe(3);
        for (const end of ends) expect(Math.max(Math.abs(end.x - 12), Math.abs(end.y - 2))).toBeLessThanOrEqual(2);
    });

    test('los que siguen se quedan detrás, según de dónde se viene', () => {
        const result = plan();
        const followers = result.moves.filter(m => m.id !== '1');
        // Se viene de la izquierda: detrás es x menor o igual que la llegada.
        for (const move of followers) expect(move.to.x).toBeLessThanOrEqual(12);
    });

    test('la formación decide quién va delante', () => {
        const result = plan({ order: [3, 1, 2] });
        expect(result.leader).toBe('3');
        expect(result.moves[0].id).toBe('3');
        expect(marchOrder(group(), [2]).map(m => m.id)).toEqual([2, 1, 3]);
    });

    test('nadie atraviesa muros: el camino pasa por la puerta abierta', () => {
        const result = plan();
        expect(result.path.some(c => c.x === 6 && c.y === 2)).toBe(true);
        const t = terrain();
        for (const move of result.moves) {
            for (const cell of move.path) expect(t.cells?.[cellKey(cell.x, cell.y)]?.type === 'wall').toBe(false);
        }
    });

    test('a un muro o a una casilla ocupada no se va', () => {
        expect(plan({ to: { x: 6, y: 1 } })).toMatchObject({ allowed: false, reason: expect.stringMatching(/muro/) });
        expect(plan({ blocked: [{ x: 12, y: 2 }] })).toMatchObject({ allowed: false, reason: 'Ahí ya hay alguien.' });
    });

    test('tras una puerta cerrada no hay camino', () => {
        expect(plan({ to: { x: 9, y: 5 } })).toMatchObject({ allowed: false, reason: expect.stringMatching(/No hay camino/) });
    });

    test('quien no puede andar se queda, y se dice', () => {
        const members = group();
        members[1].activeConditions = ['Restrained'];
        const result = planGroupMove({ members, to: { x: 12, y: 2 }, terrain: terrain(), gridWidth: W, gridHeight: H });
        expect(result.allowed).toBe(true);
        expect(result.moves.map(m => m.id)).toEqual(['1', '3']);
        expect(result.stayed).toEqual([{ id: '2', name: 'Mira', reason: expect.stringMatching(/sujeto/) }]);
        expect(describeGroupMove(result)).toMatch(/Mira está sujeto/);
    });

    test('si nadie puede andar, no se va', () => {
        const members = group().map(m => ({ ...m, hp: 0 }));
        expect(planGroupMove({ members, to: { x: 3, y: 3 }, terrain: terrain(), gridWidth: W, gridHeight: H }).allowed).toBe(false);
    });

    test('los enemigos y la gente estorban; los del grupo no se estorban entre sí', () => {
        const result = plan({ to: { x: 2, y: 1 } });
        expect(result.allowed).toBe(true);
        const blocked = plan({ blocked: [{ x: 11, y: 2 }, { x: 11, y: 1 }, { x: 11, y: 3 }] });
        for (const move of blocked.moves) expect(move.to).not.toEqual({ x: 11, y: 2 });
    });
});

describe('la marcha se para', () => {
    test('donde diga quien llama (alguien a la vista), y lo dice', () => {
        const result = plan({ stopAt: (cell) => (cell.x === 8 ? 'Veis a alguien esperando.' : false) });
        expect(result.path.at(-1).x).toBe(8);
        expect(result.stopped).toBe('Veis a alguien esperando.');
        expect(describeGroupMove(result)).toBe('Veis a alguien esperando.');
    });

    test('con un trecho, se anda como mucho eso', () => {
        const result = plan({ maxFeet: 20 });
        expect(result.costFeet).toBeLessThanOrEqual(20);
        expect(result.stopped).toMatch(/20 pies/);
    });
});

describe('verla andar', () => {
    test('cada paso dice dónde está cada uno; los que siguen salen uno detrás de otro', () => {
        const result = plan();
        const frames = walkFrames(result);
        expect(frames.length).toBeGreaterThan(5);
        const last = frames.at(-1);
        for (const move of result.moves) expect(last.find(p => p.id === move.id)).toEqual({ id: move.id, x: move.to.x, y: move.to.y });
        // En el primer paso, el segundo aún no se ha movido.
        const second = result.moves[1];
        expect(frames[0].find(p => p.id === second.id)).toEqual({ id: second.id, x: second.path[0].x, y: second.path[0].y });
    });

    test('sin nada que andar, no hay pasos', () => {
        expect(walkFrames({ moves: [] })).toEqual([]);
    });

    test('lo que se enseña al pasar por encima', () => {
        const hover = hoverOf(plan());
        expect(hover?.ok).toBe(true);
        expect(hover?.cells.at(-1)).toEqual({ gridX: 12, gridY: 2 });
        expect(hover?.feet).toBeGreaterThan(0);
        expect(hoverOf(plan({ to: { x: 6, y: 1 } }))).toBeNull();
    });

    test('los sitios alrededor: los de detrás primero', () => {
        const cells = gatherCells({ end: { x: 10, y: 2 }, from: { x: 9, y: 2 }, terrain: terrain(), gridWidth: W, gridHeight: H, blocked: new Set() });
        expect(cells[0].x).toBeLessThan(10);
    });
});
