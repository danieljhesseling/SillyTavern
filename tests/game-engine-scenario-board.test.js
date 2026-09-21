import { describe, test, expect } from '@jest/globals';
import {
    buildBoardState,
    judgeScenario,
    hasScenario,
} from '../public/scripts/game-engine/combat/scenario-board.js';

/** A live encounter, shaped the way party.js holds it. */
const ENCOUNTER = {
    round: 3,
    enemies: [
        { instanceId: 'g1', currentHp: 0, gridX: 5, gridY: 5 },
        { instanceId: 'g2', currentHp: 10, gridX: 6, gridY: 5 },
    ],
    party: [
        { id: 1, hp: 8, mapPosition: { gridX: 2, gridY: 8 } },
        { id: 2, hp: 0, mapPosition: { gridX: 3, gridY: 8 } },
    ],
};

describe('turning a live encounter into a board the rules can read', () => {
    test('enemies keep their instance id, health and position', () => {
        const board = buildBoardState(ENCOUNTER);
        expect(board.enemies[0]).toEqual({ id: 'g1', currentHp: 0, gridX: 5, gridY: 5 });
    });

    // An escort objective's ally is a party member; a protect objective's may be an NPC.
    // Both have to arrive here the same way.
    test('party members become allies, reading position from mapPosition', () => {
        const board = buildBoardState(ENCOUNTER);
        expect(board.allies[0]).toEqual({ id: '1', currentHp: 8, gridX: 2, gridY: 8 });
    });

    test('the round comes through, because a scenario can be won by the clock', () => {
        expect(buildBoardState(ENCOUNTER).round).toBe(3);
        expect(buildBoardState({ ...ENCOUNTER, round: 0 }).round).toBe(1);
    });

    test('an empty or junk encounter still produces a usable board', () => {
        for (const value of [{}, { enemies: null, party: 'nobody' }]) {
            const board = buildBoardState(value);
            expect(Array.isArray(board.enemies)).toBe(true);
            expect(Array.isArray(board.allies)).toBe(true);
            expect(board.round).toBeGreaterThan(0);
        }
    });
});

describe('hasScenario', () => {
    test('a board with objectives has one', () => {
        expect(hasScenario({ objectives: [{ id: 'a', type: 'eliminate_all' }] })).toBe(true);
    });

    // Most boards do not, and those have to keep behaving exactly as before.
    test('a board without them does not', () => {
        expect(hasScenario({})).toBe(false);
        expect(hasScenario({ objectives: [] })).toBe(false);
        expect(hasScenario(null)).toBe(false);
    });

    test('objectives of a type the engine does not know do not count', () => {
        expect(hasScenario({ objectives: [{ id: 'a', type: 'inventado' }] })).toBe(false);
    });
});

describe('judging a scenario', () => {
    const board = buildBoardState(ENCOUNTER);

    test('a board with no objectives is not judged at all', () => {
        expect(judgeScenario([], board)).toMatchObject({ status: 'none', outcome: null, rows: [] });
    });

    test('an unfinished scenario neither wins nor loses', () => {
        const verdict = judgeScenario([{ id: 'a', type: 'eliminate_all' }], board);
        expect(verdict.status).toBe('active');
        expect(verdict.outcome).toBeNull();
    });

    test('meeting every required objective is a victory', () => {
        const verdict = judgeScenario(
            [{ id: 'kill', type: 'eliminate', label: 'Matar al chamán', targetIds: ['g1'] }],
            board,
        );
        expect(verdict.status).toBe('complete');
        expect(verdict.outcome).toBe('victory');
    });

    // The point of connecting this at all: a win with every enemy still standing.
    test('surviving the rounds wins even with enemies alive', () => {
        const late = buildBoardState({ ...ENCOUNTER, round: 7 });
        const verdict = judgeScenario([{ id: 's', type: 'survive_rounds', rounds: 6 }], late);
        expect(verdict.outcome).toBe('victory');
        expect(late.enemies.some(e => e.currentHp > 0)).toBe(true);
    });

    test('a failed required objective is a defeat', () => {
        const verdict = judgeScenario(
            [{ id: 'p', type: 'protect', label: 'Proteger a Brand', allyId: '2' }],
            board,
        );
        expect(verdict.status).toBe('failed');
        expect(verdict.outcome).toBe('defeat');
    });
});

describe('optional objectives pay, they do not block', () => {
    const board = buildBoardState(ENCOUNTER);

    test('an unmet optional objective does not stop the victory', () => {
        const verdict = judgeScenario([
            { id: 'kill', type: 'eliminate', label: 'Matar', targetIds: ['g1'] },
            { id: 'loot', type: 'loot', label: 'Saquear', treasureIds: ['t1'], optional: true },
        ], board);

        expect(verdict.outcome).toBe('victory');
        expect(verdict.bonusEarned).toBe(0);
    });

    test('a met optional objective counts as a bonus', () => {
        const looted = buildBoardState({ ...ENCOUNTER, collectedTreasures: ['t1'] });
        const verdict = judgeScenario([
            { id: 'kill', type: 'eliminate', label: 'Matar', targetIds: ['g1'] },
            { id: 'loot', type: 'loot', label: 'Saquear', treasureIds: ['t1'], optional: true },
        ], looted);

        expect(verdict.outcome).toBe('victory');
        expect(verdict.bonusEarned).toBe(1);
    });
});

describe('what the panel draws', () => {
    const board = buildBoardState(ENCOUNTER);

    test('every objective gets a row with a readable label', () => {
        const verdict = judgeScenario([
            { id: 'kill', type: 'eliminate', label: 'Matar al chamán', targetIds: ['g1'] },
            { id: 'clear', type: 'eliminate_all' },
        ], board);

        expect(verdict.rows).toHaveLength(2);
        expect(verdict.rows[0].label).toBe('Matar al chamán');
        // Falls back to the type's own name rather than showing a bare id.
        expect(verdict.rows[1].label).toBe('Limpiar el tablero');
    });

    test('marks which rows are optional, so the panel can say so', () => {
        const verdict = judgeScenario([
            { id: 'a', type: 'eliminate_all' },
            { id: 'b', type: 'loot', treasureIds: ['t1'], optional: true },
        ], board);
        expect(verdict.rows.map(r => r.optional)).toEqual([false, true]);
    });

    test('the summary names each objective and its state', () => {
        const verdict = judgeScenario(
            [{ id: 'kill', type: 'eliminate', label: 'Matar al chamán', targetIds: ['g1'] }],
            board,
        );
        expect(verdict.summary).toContain('Matar al chamán');
    });

    test('junk objectives are ignored rather than crashing the fight', () => {
        for (const value of [null, undefined, 'matar', [{ type: 'inventado' }]]) {
            expect(judgeScenario(value, board).status).toBe('none');
        }
    });
});
