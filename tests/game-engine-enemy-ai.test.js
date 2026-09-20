import { describe, test, expect } from '@jest/globals';
import { createEmptyTerrain, setCell } from '../public/scripts/game-engine/board/terrain.js';
import {
    planEnemyTurn,
    selectFocus,
    buildOccupiedSet,
    healthFraction,
    getProfileOptions,
    TACTICAL_PROFILES,
    FLEE_HP_FRACTION,
} from '../public/scripts/game-engine/combat/enemy-ai.js';

/** @param {string[]} rows */
function terrainFromMap(rows) {
    let terrain = createEmptyTerrain();
    rows.forEach((row, y) => {
        [...row].forEach((char, x) => {
            if (char === '#') terrain = setCell(terrain, x, y, 'wall');
            if (char === '~') terrain = setCell(terrain, x, y, 'difficult');
        });
    });
    return terrain;
}

/** @param {object} overrides */
const foe = (overrides = {}) => ({
    id: 'foe', gridX: 0, gridY: 0, currentHp: 10, maxHp: 10,
    speedFeet: 30, attackRangeFeet: 5, profile: 'aggressive', ...overrides,
});

/** @param {object} overrides */
const hero = (overrides = {}) => ({
    id: 'hero', gridX: 5, gridY: 0, currentHp: 20, maxHp: 20, ...overrides,
});

const OPEN = createEmptyTerrain();

describe('healthFraction', () => {
    test('reports the share of hit points left', () => {
        expect(healthFraction({ currentHp: 5, maxHp: 10 })).toBe(0.5);
        expect(healthFraction({ currentHp: 0, maxHp: 10 })).toBe(0);
    });

    test('treats a creature with no maximum as unhurt', () => {
        expect(healthFraction({ currentHp: 3 })).toBe(1);
        expect(healthFraction(null)).toBe(1);
    });

    test('clamps values outside the range', () => {
        expect(healthFraction({ currentHp: 99, maxHp: 10 })).toBe(1);
        expect(healthFraction({ currentHp: -5, maxHp: 10 })).toBe(0);
    });
});

describe('buildOccupiedSet', () => {
    test('collects everyone else', () => {
        const set = buildOccupiedSet([{ id: 'a', gridX: 1, gridY: 1 }, { id: 'b', gridX: 2, gridY: 2 }], 'a');
        expect(set.has('1,1')).toBe(false);
        expect(set.has('2,2')).toBe(true);
    });
});

describe('selectFocus', () => {
    test('goes for the nearest', () => {
        const result = selectFocus(foe(), [
            hero({ id: 'far', gridX: 9, gridY: 0 }),
            hero({ id: 'near', gridX: 2, gridY: 0 }),
        ], OPEN, 12, 12, new Set());
        expect(result.target.id).toBe('near');
    });

    test('breaks a tie on the most wounded', () => {
        const result = selectFocus(foe(), [
            hero({ id: 'healthy', gridX: 3, gridY: 0, currentHp: 20, maxHp: 20 }),
            hero({ id: 'hurt', gridX: 0, gridY: 3, currentHp: 2, maxHp: 20 }),
        ], OPEN, 12, 12, new Set());
        expect(result.target.id).toBe('hurt');
    });

    test('ignores the dead', () => {
        const result = selectFocus(foe(), [
            hero({ id: 'corpse', gridX: 1, gridY: 0, currentHp: 0 }),
            hero({ id: 'alive', gridX: 8, gridY: 0 }),
        ], OPEN, 12, 12, new Set());
        expect(result.target.id).toBe('alive');
    });

    test('nobody left means no focus', () => {
        expect(selectFocus(foe(), [], OPEN, 12, 12, new Set())).toBeNull();
        expect(selectFocus(foe(), [hero({ currentHp: 0 })], OPEN, 12, 12, new Set())).toBeNull();
    });

    // The reason focus uses path distance rather than straight-line distance.
    test('prefers a target it can actually walk to over a nearer one behind a wall', () => {
        const terrain = terrainFromMap([
            '..#...',
            '..#...',
            '..#...',
            '..#...',
        ]);
        const result = selectFocus(
            foe({ gridX: 0, gridY: 0 }),
            [
                hero({ id: 'walled', gridX: 3, gridY: 0 }),  // closer as the crow flies
                hero({ id: 'open', gridX: 0, gridY: 3 }),    // further, but reachable
            ],
            terrain, 6, 4, new Set(),
        );
        expect(result.target.id).toBe('open');
        expect(result.reachable).toBe(true);
    });
});

describe('aggressive profile', () => {
    test('attacks without moving when already in reach', () => {
        const plan = planEnemyTurn({
            actor: foe({ gridX: 4, gridY: 0 }),
            targets: [hero()],
            terrain: OPEN, gridWidth: 12, gridHeight: 12,
        });
        expect(plan.action).toBe('attack');
        expect(plan.targetId).toBe('hero');
        expect(plan.movementCostFeet).toBe(0);
        expect(plan.destination).toEqual({ x: 4, y: 0 });
    });

    test('closes the distance and attacks', () => {
        const plan = planEnemyTurn({
            actor: foe({ gridX: 0, gridY: 0 }),
            targets: [hero({ gridX: 5, gridY: 0 })],
            terrain: OPEN, gridWidth: 12, gridHeight: 12,
        });
        expect(plan.action).toBe('attack');
        expect(plan.destination).toEqual({ x: 4, y: 0 });
        expect(plan.movementCostFeet).toBe(20);
    });

    // The reason the old straight-line movement had to go.
    test('walks around a wall instead of through it', () => {
        const terrain = terrainFromMap([
            '..#..',
            '..#..',
            '.....',
        ]);
        const plan = planEnemyTurn({
            actor: foe({ gridX: 0, gridY: 0, speedFeet: 60 }),
            targets: [hero({ gridX: 4, gridY: 0 })],
            terrain, gridWidth: 5, gridHeight: 3,
        });
        expect(plan.path.some(c => c.x === 2 && (c.y === 0 || c.y === 1))).toBe(false);
        expect(plan.action).toBe('attack');
    });

    test('advances without attacking when the target is too far', () => {
        const plan = planEnemyTurn({
            actor: foe({ gridX: 0, gridY: 0, speedFeet: 10 }),
            targets: [hero({ gridX: 11, gridY: 0 })],
            terrain: OPEN, gridWidth: 12, gridHeight: 12,
        });
        expect(plan.action).toBe('none');
        expect(plan.destination).toEqual({ x: 2, y: 0 });
        expect(plan.rationale).toContain('cannot reach');
    });

    test('stands still when the target is sealed away', () => {
        const terrain = terrainFromMap([
            '.#.',
            '.#.',
            '.#.',
        ]);
        const plan = planEnemyTurn({
            actor: foe({ gridX: 0, gridY: 1 }),
            targets: [hero({ gridX: 2, gridY: 1 })],
            terrain, gridWidth: 3, gridHeight: 3,
        });
        expect(plan.action).toBe('none');
        expect(plan.movementCostFeet).toBe(0);
    });

    test('a reach weapon attacks from further out', () => {
        const plan = planEnemyTurn({
            actor: foe({ gridX: 0, gridY: 0, attackRangeFeet: 10 }),
            targets: [hero({ gridX: 2, gridY: 0 })],
            terrain: OPEN, gridWidth: 12, gridHeight: 12,
        });
        expect(plan.action).toBe('attack');
        expect(plan.movementCostFeet).toBe(0);
    });
});

describe('skirmisher profile', () => {
    test('shoots from where it stands when nothing is in melee', () => {
        const plan = planEnemyTurn({
            actor: foe({ gridX: 0, gridY: 0, profile: 'skirmisher', attackRangeFeet: 60 }),
            targets: [hero({ gridX: 6, gridY: 0 })],
            terrain: OPEN, gridWidth: 20, gridHeight: 20,
        });
        expect(plan.action).toBe('attack');
        expect(plan.movementCostFeet).toBe(0);
    });

    test('backs away when something closes to melee, then shoots', () => {
        const plan = planEnemyTurn({
            actor: foe({ gridX: 5, gridY: 5, profile: 'skirmisher', attackRangeFeet: 60 }),
            targets: [hero({ gridX: 6, gridY: 5 })],
            terrain: OPEN, gridWidth: 20, gridHeight: 20,
        });
        expect(plan.movementCostFeet).toBeGreaterThan(0);
        expect(plan.action).toBe('attack');
        expect(plan.rationale).toContain('Backs out of melee');

        const distanceAfter = Math.max(
            Math.abs(plan.destination.x - 6), Math.abs(plan.destination.y - 5),
        ) * 5;
        expect(distanceAfter).toBeGreaterThan(5);
    });

    test('a melee skirmisher behaves like an aggressive one', () => {
        const plan = planEnemyTurn({
            actor: foe({ gridX: 5, gridY: 5, profile: 'skirmisher', attackRangeFeet: 5 }),
            targets: [hero({ gridX: 6, gridY: 5 })],
            terrain: OPEN, gridWidth: 20, gridHeight: 20,
        });
        expect(plan.action).toBe('attack');
        expect(plan.movementCostFeet).toBe(0);
    });
});

describe('coward profile', () => {
    test('fights while it is healthy', () => {
        const plan = planEnemyTurn({
            actor: foe({ gridX: 0, gridY: 0, profile: 'coward', currentHp: 10, maxHp: 10 }),
            targets: [hero({ gridX: 2, gridY: 0 })],
            terrain: OPEN, gridWidth: 12, gridHeight: 12,
        });
        expect(plan.action).toBe('attack');
    });

    test('runs once badly hurt, and does not attack', () => {
        const plan = planEnemyTurn({
            actor: foe({ gridX: 5, gridY: 5, profile: 'coward', currentHp: 1, maxHp: 10 }),
            targets: [hero({ gridX: 6, gridY: 5 })],
            terrain: OPEN, gridWidth: 20, gridHeight: 20,
        });
        expect(plan.action).toBe('none');
        expect(plan.movementCostFeet).toBeGreaterThan(0);
        expect(plan.rationale).toContain('Badly wounded');

        const distanceAfter = Math.max(
            Math.abs(plan.destination.x - 6), Math.abs(plan.destination.y - 5),
        );
        expect(distanceAfter).toBeGreaterThan(1);
    });

    test('the threshold is a quarter of its hit points', () => {
        const justAbove = planEnemyTurn({
            actor: foe({ gridX: 5, gridY: 5, profile: 'coward', currentHp: 3, maxHp: 10 }),
            targets: [hero({ gridX: 6, gridY: 5 })],
            terrain: OPEN, gridWidth: 20, gridHeight: 20,
        });
        expect(FLEE_HP_FRACTION).toBe(0.25);
        expect(justAbove.action).toBe('attack');
    });

    test('cornered, it gives up on running', () => {
        const terrain = terrainFromMap([
            '###',
            '#..',
            '###',
        ]);
        const plan = planEnemyTurn({
            actor: foe({ gridX: 1, gridY: 1, profile: 'coward', currentHp: 1, maxHp: 10, speedFeet: 5 }),
            targets: [hero({ gridX: 2, gridY: 1 })],
            terrain, gridWidth: 3, gridHeight: 3,
        });
        expect(plan.movementCostFeet).toBe(0);
    });
});

describe('guardian profile', () => {
    test('moves between the threat and its most wounded ally', () => {
        const plan = planEnemyTurn({
            actor: foe({ id: 'tank', gridX: 5, gridY: 5, profile: 'guardian', speedFeet: 30 }),
            targets: [hero({ gridX: 10, gridY: 5 })],
            allies: [
                { id: 'hurt', gridX: 0, gridY: 5, currentHp: 1, maxHp: 10 },
                { id: 'fine', gridX: 0, gridY: 0, currentHp: 10, maxHp: 10 },
            ],
            terrain: OPEN, gridWidth: 20, gridHeight: 20,
        });
        // Midpoint between the wounded ally at x=0 and the threat at x=10 is x=5.
        expect(plan.destination.y).toBe(5);
        expect(Math.abs(plan.destination.x - 5)).toBeLessThanOrEqual(1);
        expect(plan.rationale).toContain('ally');
    });

    test('with nobody to protect it just fights', () => {
        const plan = planEnemyTurn({
            actor: foe({ gridX: 0, gridY: 0, profile: 'guardian' }),
            targets: [hero({ gridX: 2, gridY: 0 })],
            allies: [],
            terrain: OPEN, gridWidth: 12, gridHeight: 12,
        });
        expect(plan.action).toBe('attack');
    });

    test('ignores fallen allies when choosing whom to shield', () => {
        const plan = planEnemyTurn({
            actor: foe({ id: 'tank', gridX: 5, gridY: 5, profile: 'guardian' }),
            targets: [hero({ gridX: 10, gridY: 5 })],
            allies: [{ id: 'dead', gridX: 0, gridY: 0, currentHp: 0, maxHp: 10 }],
            terrain: OPEN, gridWidth: 20, gridHeight: 20,
        });
        expect(plan.rationale).not.toContain('ally');
    });
});

describe('plan integrity', () => {
    test('an unknown profile falls back to aggressive', () => {
        const plan = planEnemyTurn({
            actor: foe({ gridX: 0, gridY: 0, profile: 'philosopher' }),
            targets: [hero({ gridX: 2, gridY: 0 })],
            terrain: OPEN, gridWidth: 12, gridHeight: 12,
        });
        expect(plan.action).toBe('attack');
    });

    test('nothing to fight means nothing to do', () => {
        const plan = planEnemyTurn({
            actor: foe(), targets: [], terrain: OPEN, gridWidth: 12, gridHeight: 12,
        });
        expect(plan.action).toBe('none');
        expect(plan.focusId).toBeNull();
    });

    test('the path always starts where the actor stands and ends at the destination', () => {
        const plan = planEnemyTurn({
            actor: foe({ gridX: 1, gridY: 1 }),
            targets: [hero({ gridX: 8, gridY: 6 })],
            terrain: OPEN, gridWidth: 12, gridHeight: 12,
        });
        expect(plan.path[0]).toEqual({ x: 1, y: 1 });
        expect(plan.path[plan.path.length - 1]).toEqual(plan.destination);
    });

    test('never spends more movement than its speed', () => {
        for (const speed of [5, 15, 30, 60]) {
            const plan = planEnemyTurn({
                actor: foe({ gridX: 0, gridY: 0, speedFeet: speed }),
                targets: [hero({ gridX: 19, gridY: 19 })],
                terrain: OPEN, gridWidth: 20, gridHeight: 20,
            });
            expect(plan.movementCostFeet).toBeLessThanOrEqual(speed);
        }
    });

    test('never walks onto another combatant', () => {
        const plan = planEnemyTurn({
            actor: foe({ gridX: 0, gridY: 0, speedFeet: 60 }),
            targets: [hero({ gridX: 5, gridY: 0 })],
            allies: [{ id: 'blocker', gridX: 2, gridY: 0, currentHp: 5, maxHp: 5 }],
            terrain: OPEN, gridWidth: 12, gridHeight: 12,
        });
        expect(plan.path.some(c => c.x === 2 && c.y === 0)).toBe(false);
    });

    test('difficult ground shortens how far it gets', () => {
        const rough = terrainFromMap([
            '~~~~~~~~~~',
            '~~~~~~~~~~',
        ]);
        const overRough = planEnemyTurn({
            actor: foe({ gridX: 0, gridY: 0, speedFeet: 30 }),
            targets: [hero({ gridX: 9, gridY: 0 })],
            terrain: rough, gridWidth: 10, gridHeight: 2,
        });
        const overOpen = planEnemyTurn({
            actor: foe({ gridX: 0, gridY: 0, speedFeet: 30 }),
            targets: [hero({ gridX: 9, gridY: 0 })],
            terrain: OPEN, gridWidth: 10, gridHeight: 2,
        });
        expect(overRough.destination.x).toBeLessThan(overOpen.destination.x);
    });

    test('the same situation always yields the same plan', () => {
        const situation = {
            actor: foe({ gridX: 2, gridY: 3 }),
            targets: [hero({ gridX: 9, gridY: 7 }), hero({ id: 'other', gridX: 1, gridY: 9 })],
            terrain: terrainFromMap(['..........', '..####....', '..........']),
            gridWidth: 10, gridHeight: 10,
        };
        expect(JSON.stringify(planEnemyTurn(situation)))
            .toBe(JSON.stringify(planEnemyTurn(situation)));
    });
});

describe('getProfileOptions', () => {
    test('offers every profile for an editor', () => {
        const options = getProfileOptions();
        expect(options).toHaveLength(Object.keys(TACTICAL_PROFILES).length);
        expect(options).toContainEqual(['aggressive', 'Aggressive']);
    });
});
