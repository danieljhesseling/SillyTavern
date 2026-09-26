import fs from 'node:fs';
import { describe, test, expect } from '@jest/globals';
import { terrainFromAsciiMap, isPassable, getMovementCost, describeCell, ASCII_TERRAIN, createEmptyTerrain } from '../public/scripts/game-engine/board/terrain.js';
import { isHigh, heightBetween, heightReason, highCells, heightScore } from '../public/scripts/game-engine/board/heights.js';
import { isExit, exitCells, readLeft, leaveBoard, hasLeft, stillFighting, everyoneOut, leaveLine } from '../public/scripts/game-engine/board/exits.js';
import { attackEdge } from '../public/scripts/game-engine/combat/maneuvers.js';
import { planEnemyTurn } from '../public/scripts/game-engine/combat/enemy-ai.js';
import { generateIntended, walkFrom } from '../public/scripts/game-engine/world-builder/board-intent.js';
import { generateBoard } from '../public/scripts/game-engine/world-builder/dungeon-generator.js';
import { createSeededRandom } from '../public/scripts/game-engine/combat/seeded-random.js';
import { getMapLegend } from '../public/scripts/game-engine/campaign/campaign-pack-schema.js';

describe('B1: la altura', () => {
    test('«^» es una casilla alta: se pisa, cuesta el doble subir y se dice lo que es', () => {
        const terrain = terrainFromAsciiMap(['.^.']);
        expect(ASCII_TERRAIN['^']).toEqual({ type: 'high' });
        expect(isPassable(terrain, 1, 0, 3, 1)).toBe(true);
        expect(getMovementCost(terrain, 1, 0)).toBe(2);
        expect(describeCell(terrain, 1, 0)).toBe('Casilla (2, 1) · En alto: subir cuesta el doble, y desde aquí se ataca con ventaja');
        expect(getMapLegend()['^']).toMatch(/alto/);
    });

    test('desde arriba contra abajo, ventaja; al revés o a la par, nada', () => {
        const terrain = terrainFromAsciiMap(['^..', '^..']);
        expect(isHigh(terrain, 0, 0)).toBe(true);
        expect(heightBetween(terrain, { x: 0, y: 0 }, { x: 2, y: 0 })).toBe('above');
        expect(heightBetween(terrain, { x: 2, y: 0 }, { x: 0, y: 0 })).toBe('below');
        expect(heightBetween(terrain, { x: 0, y: 0 }, { x: 0, y: 1 })).toBe('level');
        expect(heightReason('above')).toBe('ataca desde arriba');
        expect(heightReason('below')).toBe('');
        expect(highCells(terrain)).toEqual([{ x: 0, y: 0 }, { x: 0, y: 1 }]);
        expect(heightScore(terrain, { x: 0, y: 0 }, true)).toBeGreaterThan(heightScore(terrain, { x: 0, y: 0 }, false));
    });

    test('la altura entra en la tirada como una razón más, y se anula con las contrarias', () => {
        const up = attackEdge({ targetId: 'a', distanceFeet: 30, height: 'above' });
        expect(up.mode).toBe('advantage');
        expect(up.reasons).toContain('ataca desde arriba');
        expect(attackEdge({ targetId: 'a', distanceFeet: 30, height: 'below' }).mode).toBe('normal');
        expect(attackEdge({ targetId: 'a', distanceFeet: 30, height: 'above', attackerConditions: ['Poisoned'] }).mode).toBe('normal');
    });

    test('el que dispara sube a lo alto si puede sin perder el tiro; el de cuerpo a cuerpo, no', () => {
        const terrain = terrainFromAsciiMap(['......', '.^....']);
        const shooter = planEnemyTurn({
            actor: { id: 'foe', gridX: 0, gridY: 0, currentHp: 10, maxHp: 10, speedFeet: 30, attackRangeFeet: 60, profile: 'aggressive' },
            targets: [{ id: 'hero', gridX: 4, gridY: 0, currentHp: 20, maxHp: 20 }],
            terrain, gridWidth: 6, gridHeight: 2,
        });
        expect(shooter.destination).toEqual({ x: 1, y: 1 });
        expect(shooter.action).toBe('attack');
        const brute = planEnemyTurn({
            actor: { id: 'foe', gridX: 3, gridY: 0, currentHp: 10, maxHp: 10, speedFeet: 30, attackRangeFeet: 5, profile: 'aggressive' },
            targets: [{ id: 'hero', gridX: 4, gridY: 0, currentHp: 20, maxHp: 20 }],
            terrain, gridWidth: 6, gridHeight: 2,
        });
        expect(brute.destination).toEqual({ x: 3, y: 0 });
    });
});

describe('B2: las salidas', () => {
    test('«x» es una salida: se pisa y se dice lo que es', () => {
        const terrain = terrainFromAsciiMap(['.x.']);
        expect(ASCII_TERRAIN.x).toEqual({ type: 'exit' });
        expect(isPassable(terrain, 1, 0, 3, 1)).toBe(true);
        expect(getMovementCost(terrain, 1, 0)).toBe(1);
        expect(isExit(terrain, 1, 0)).toBe(true);
        expect(isExit(createEmptyTerrain(), 1, 0)).toBe(false);
        expect(exitCells(terrain)).toEqual([{ x: 1, y: 0 }]);
        expect(describeCell(terrain, 1, 0)).toBe('Casilla (2, 1) · Salida: quien la pisa puede irse de la pelea');
        expect(getMapLegend().x).toMatch(/salida/);
    });

    test('cada uno sale por su cuenta, y salir dos veces no cambia nada', () => {
        let left = readLeft(undefined);
        left = leaveBoard(left, 1);
        left = leaveBoard(left, '1');
        expect(left).toEqual(['1']);
        expect(hasLeft(left, 1)).toBe(true);
        expect(hasLeft(left, 2)).toBe(false);
    });

    test('quien ha salido ya no pelea, y cuando salen todos los que siguen en pie, se acaba', () => {
        const party = [{ id: 1, hp: 10 }, { id: 2, hp: 0 }, { id: 3, hp: 5 }];
        expect(stillFighting(party, ['1']).map(m => m.id)).toEqual([3]);
        expect(everyoneOut(party, ['1'])).toBe(false);
        expect(everyoneOut(party, ['1', '3'])).toBe(true);
        // Sin nadie fuera no es una huida: si están todos caídos, es una derrota.
        expect(everyoneOut([{ id: 1, hp: 0 }], [])).toBe(false);
        expect(leaveLine('Ulrich', 1)).toBe('🚪 [COMBAT] Ulrich sale por la salida: fuera de esta pelea. Quedan dentro 1.');
        expect(leaveLine('Inés', 0)).toBe('🚪 [COMBAT] Inés sale por la salida, el último.');
    });
});

describe('B1 y B2 en los tableros generados', () => {
    const options = [{ name: 'Bandido', threat: 9 }, { name: 'Arquero', threat: 8 }];
    const make = (/** @type {string} */ purpose, /** @type {number} */ i) => generateIntended({
        randomFor: attempt => createSeededRandom(`${purpose}-alto-${i}-${attempt}`),
        generate: generateBoard, purpose, options, budget: 25, board: { size: 'medium', partySize: 2 },
    });

    test('un robo trae por dónde escapar, y se llega a ella desde la entrada', () => {
        let withExit = 0;
        for (let i = 0; i < 40; i++) {
            const made = make('steal', i);
            expect(made.issues).toEqual([]);
            const exits = made.map.flatMap((/** @type {string} */ row, y) => [...row].map((c, x) => (c === 'x' ? { x, y } : null))).filter(Boolean);
            if (exits.length === 0) continue;
            withExit++;
            const steps = walkFrom(made.map.map((/** @type {string} */ row) => [...row].map(c => (c === 'L' ? 'D' : c))), made.partyStart[0]);
            expect(exits.some((/** @type {any} */ e) => steps.has(`${e.x},${e.y}`))).toBe(true);
        }
        expect(withExit).toBeGreaterThan(30);
    });

    test('aguantar trae algo alto en la sala de entrada, desde donde defenderse', () => {
        let withHigh = 0;
        for (let i = 0; i < 40; i++) {
            const made = make('hold', i);
            expect(made.issues).toEqual([]);
            const first = made.rooms?.[0];
            if (!first) continue;
            const inside = [...Array(first.height).keys()].some(dy => [...Array(first.width).keys()].some(dx => made.map[first.y + dy]?.[first.x + dx] === '^'));
            if (inside) withHigh++;
        }
        expect(withHigh).toBeGreaterThan(30);
    });

    test('las salas escritas usan la leyenda: la torre tiene altura y la cámara, ventana', () => {
        const rows = JSON.parse(fs.readFileSync(new URL('../public/compendio/sitios.json', import.meta.url), 'utf8')).rows.filter((/** @type {any} */ r) => r.kind === 'sala');
        const legend = new Set(['.', '#', ' ', ...Object.keys(ASCII_TERRAIN)]);
        for (const row of rows) for (const line of row.rows) for (const ch of line) expect(legend.has(ch)).toBe(true);
        expect(rows.find((/** @type {any} */ r) => r.id === 'sala-torre')?.rows.join('')).toMatch(/\^/);
        expect(rows.find((/** @type {any} */ r) => r.id === 'sala-camara')?.rows.join('')).toMatch(/x/);
    });
});
