import { describe, test, expect } from '@jest/globals';
import {
    buildSandboxTerrain, buildSandboxTokens, SANDBOX_WIDTH, SANDBOX_HEIGHT,
} from '../public/scripts/game-engine/ui/sandbox.js';
import { getCell, isPassable } from '../public/scripts/game-engine/board/terrain.js';
import { findPath, getReachableCells } from '../public/scripts/game-engine/board/pathfinding.js';
import { hasLineOfSight } from '../public/scripts/game-engine/board/line-of-sight.js';
import { TACTICAL_PROFILES } from '../public/scripts/game-engine/combat/enemy-ai.js';
import fs from 'node:fs';

describe('sandbox terrain', () => {
    const terrain = buildSandboxTerrain();

    test('every terrain type appears at least once, so all of them can be looked at', () => {
        const types = new Set();
        for (let y = 0; y < SANDBOX_HEIGHT; y++) {
            for (let x = 0; x < SANDBOX_WIDTH; x++) {
                types.add(getCell(terrain, x, y).type);
            }
        }
        expect(types).toContain('wall');
        expect(types).toContain('door');
        expect(types).toContain('difficult');
        expect(types).toContain('cover_half');
        expect(types).toContain('cover_three_quarters');
    });

    test('the board is walled in, so nothing walks off the edge', () => {
        for (let x = 0; x < SANDBOX_WIDTH; x++) {
            expect(isPassable(terrain, x, 0, SANDBOX_WIDTH, SANDBOX_HEIGHT)).toBe(false);
            expect(isPassable(terrain, x, SANDBOX_HEIGHT - 1, SANDBOX_WIDTH, SANDBOX_HEIGHT)).toBe(false);
        }
        for (let y = 0; y < SANDBOX_HEIGHT; y++) {
            expect(isPassable(terrain, 0, y, SANDBOX_WIDTH, SANDBOX_HEIGHT)).toBe(false);
            expect(isPassable(terrain, SANDBOX_WIDTH - 1, y, SANDBOX_WIDTH, SANDBOX_HEIGHT)).toBe(false);
        }
    });

    test('there is a wall that actually blocks the view', () => {
        // The vertical wall at x=5 separates the top-left room from the rest.
        expect(hasLineOfSight(terrain, 2, 2, 10, 2)).toBe(false);
    });

    test('the closed door seals its room and the open one does not', () => {
        expect(isPassable(terrain, 5, 3, SANDBOX_WIDTH, SANDBOX_HEIGHT)).toBe(false); // closed
        expect(isPassable(terrain, 9, 6, SANDBOX_WIDTH, SANDBOX_HEIGHT)).toBe(true);  // open
    });
});

describe('sandbox tokens', () => {
    const tokens = buildSandboxTokens();
    const terrain = buildSandboxTerrain();

    test('there are heroes and monsters', () => {
        expect(tokens.filter(t => !t.isEnemy).length).toBeGreaterThanOrEqual(2);
        expect(tokens.filter(t => t.isEnemy).length).toBeGreaterThanOrEqual(3);
    });

    test('nobody is standing inside a wall', () => {
        for (const token of tokens) {
            expect(isPassable(terrain, token.gridX, token.gridY, SANDBOX_WIDTH, SANDBOX_HEIGHT)).toBe(true);
        }
    });

    test('nobody shares a cell with anybody else', () => {
        const cells = tokens.map(t => `${t.gridX},${t.gridY}`);
        expect(new Set(cells).size).toBe(cells.length);
    });

    test('every monster declares a profile the AI knows', () => {
        for (const foe of tokens.filter(t => t.isEnemy)) {
            expect(TACTICAL_PROFILES[foe.profile]).toBeDefined();
        }
    });

    // Otherwise the coward never demonstrates the thing it is there to demonstrate.
    test('the coward starts below the threshold that makes it run', () => {
        const coward = tokens.find(t => t.profile === 'coward');
        expect(coward.hp / coward.maxHp).toBeLessThan(0.25);
    });

    test('a hero can reach a monster, so a fight is possible', () => {
        const hero = tokens.find(t => !t.isEnemy);
        const foe = tokens.find(t => t.isEnemy && t.gridY > 6);
        const path = findPath(
            terrain, hero.gridX, hero.gridY, foe.gridX, foe.gridY,
            SANDBOX_WIDTH, SANDBOX_HEIGHT,
        );
        expect(path).not.toBeNull();
    });

    // The point of the sandbox: you can see movement bend around a wall.
    test('a hero cannot reach everywhere in one move, so walls visibly matter', () => {
        const hero = tokens.find(t => !t.isEnemy);
        const reachable = getReachableCells(
            terrain, hero.gridX, hero.gridY, hero.speedFeet,
            SANDBOX_WIDTH, SANDBOX_HEIGHT,
        );
        const openSquare = 13 * 13; // what 30 ft would cover on an empty board
        expect(reachable.length).toBeLessThan(openSquare);
        expect(reachable.length).toBeGreaterThan(1);
    });
});

describe('a board without art', () => {
    // The sandbox passes no imageUrl, and renderLocationView used to bail out with
    // "No location map available" and draw nothing at all.
    test('the renderer no longer refuses a board with no image', () => {
        const source = fs.readFileSync(
            new URL('../public/scripts/world-map-renderer.js', import.meta.url), 'utf8',
        );
        expect(source).not.toMatch(/if\s*\(\s*!imageUrl\s*\)\s*\{[\s\S]{0,120}return;/);
        expect(source).toContain('const hasImage = Boolean(imageUrl)');
    });

    test('the header builds its text as nodes rather than interpolating it', () => {
        const source = fs.readFileSync(
            new URL('../public/scripts/world-map-renderer.js', import.meta.url), 'utf8',
        );
        // name and description come from world info, which is user- and AI-authored.
        expect(source).not.toContain('wm-location-header-name">${name}');
        expect(source).not.toContain('src="${imageUrl}"');
    });
});
