import { describe, test, expect } from '@jest/globals';
import {
    createCalendar, normalizeCalendar, getCurrentSlot, advanceSlot, advanceSlots,
    advanceToNextDay, getRemainingSlots, formatCalendar, getElapsedSlots, DEFAULT_SLOTS,
} from '../public/scripts/game-engine/campaign/calendar.js';
import {
    createBondState, normalizeBondState, getRankForPoints, getRank, getBondProgress,
    recordBondEvent, getUnlockedPerks, isPerkAvailable, spendPerk, resetDailyPerks,
    suggestBondEvent, BOND_PERKS, MAX_RANK,
} from '../public/scripts/game-engine/campaign/bonds.js';
import {
    normalizeObjectives, evaluateObjective, evaluateScenario, describeObjectives,
    createQuestState, getQuestStatus, setQuestStatus, getActiveQuestIds,
} from '../public/scripts/game-engine/campaign/scenarios.js';
import {
    createRoomFromRect, getRoomAt, getRoomBehindDoor, openDoor, getRevealedCells,
    isEnemyAwake, normalizeCampaignMap, refreshAvailability, completeLocation, explainLock,
} from '../public/scripts/game-engine/campaign/campaign-map.js';
import { createEmptyTerrain, setCell, isPassable } from '../public/scripts/game-engine/board/terrain.js';

// ============================================================ CALENDAR

describe('calendar', () => {
    test('starts on day one, first slot', () => {
        const c = createCalendar();
        expect(c.day).toBe(1);
        expect(getCurrentSlot(c).id).toBe('morning');
    });

    test('walks the slots of a day', () => {
        let c = createCalendar();
        expect(getCurrentSlot(c).id).toBe('morning');
        c = advanceSlot(c).calendar;
        expect(getCurrentSlot(c).id).toBe('afternoon');
        c = advanceSlot(c).calendar;
        expect(getCurrentSlot(c).id).toBe('night');
    });

    test('night rolls the day over', () => {
        let c = createCalendar();
        c = advanceSlots(c, 2).calendar; // night
        const result = advanceSlot(c);
        expect(result.dayAdvanced).toBe(true);
        expect(result.calendar.day).toBe(2);
        expect(getCurrentSlot(result.calendar).id).toBe('morning');
    });

    test('counts the days that went by', () => {
        const result = advanceSlots(createCalendar(), 7);
        expect(result.daysAdvanced).toBe(2);
        expect(result.calendar.day).toBe(3);
    });

    test('a long rest writes off the rest of the day', () => {
        const c = advanceToNextDay(createCalendar());
        expect(c.day).toBe(2);
        expect(getCurrentSlot(c).id).toBe('morning');
    });

    test('reports what is left of today', () => {
        let c = createCalendar();
        expect(getRemainingSlots(c)).toBe(3);
        c = advanceSlot(c).calendar;
        expect(getRemainingSlots(c)).toBe(2);
    });

    test('elapsed slots count across days', () => {
        expect(getElapsedSlots(createCalendar())).toBe(0);
        expect(getElapsedSlots(advanceSlots(createCalendar(), 4).calendar)).toBe(4);
    });

    test('formats readably', () => {
        expect(formatCalendar(createCalendar())).toBe('Día 1 · Mañana');
    });

    test('a custom day shape is honoured', () => {
        const c = createCalendar([
            { id: 'dawn', label: 'Alba', advancesDay: false },
            { id: 'dusk', label: 'Ocaso', advancesDay: true },
        ]);
        expect(c.slots).toHaveLength(2);
        expect(advanceSlots(c, 2).calendar.day).toBe(2);
    });

    // Otherwise the campaign is stuck in day one for ever.
    test('a day with no rollover slot gets one anyway', () => {
        const c = createCalendar([
            { id: 'a', label: 'A', advancesDay: false },
            { id: 'b', label: 'B', advancesDay: false },
        ]);
        expect(c.slots[1].advancesDay).toBe(true);
    });

    test('junk input yields a fresh calendar', () => {
        expect(normalizeCalendar(null).day).toBe(1);
        expect(normalizeCalendar({ day: -5, slotIndex: 99 }).day).toBe(1);
        expect(normalizeCalendar({ day: 3, slotIndex: 99 }).slotIndex).toBe(DEFAULT_SLOTS.length - 1);
    });
});

// ============================================================ BONDS

describe('bonds', () => {
    test('everyone starts at rank one', () => {
        expect(getRank(createBondState(), 'lyra')).toBe(1);
        expect(getRankForPoints(0)).toBe(1);
    });

    test('ranks cost more as they rise', () => {
        expect(getRankForPoints(6)).toBe(2);
        expect(getRankForPoints(13)).toBe(2);
        expect(getRankForPoints(14)).toBe(3);
        expect(getRankForPoints(999)).toBe(MAX_RANK);
    });

    // The correction to the design document: bonds move on recorded events.
    test('a recorded event moves the bond', () => {
        const result = recordBondEvent(createBondState(), 'lyra', 'quest_together');
        expect(result.state.bonds.lyra.points).toBe(5);
    });

    test('an unknown event does nothing', () => {
        const state = createBondState();
        expect(recordBondEvent(state, 'lyra', 'vibes').state).toEqual(state);
    });

    test('a betrayal costs, and points never go below zero', () => {
        let state = recordBondEvent(createBondState(), 'lyra', 'gift_liked').state;
        state = recordBondEvent(state, 'lyra', 'betrayed').state;
        expect(state.bonds.lyra.points).toBe(0);
    });

    test('reports a rank up and what it unlocked', () => {
        let state = createBondState();
        for (let i = 0; i < 2; i++) state = recordBondEvent(state, 'lyra', 'quest_together').state;
        const result = recordBondEvent(state, 'lyra', 'gift_liked'); // 10 -> 14, rank 3

        expect(result.rankedUp).toBe(true);
        expect(result.rankAfter).toBe(3);
        expect(result.unlockedPerks.map(p => p.id)).toEqual(['follow_up']);
    });

    test('a jump of several ranks unlocks every perk it passed', () => {
        const result = recordBondEvent(createBondState(), 'lyra', 'manual', { points: 60 });
        expect(result.rankAfter).toBe(6); // 60 puntos: el umbral del 7 esta en 66
        expect(result.unlockedPerks.map(p => p.id)).toEqual(expect.arrayContaining(['follow_up', 'baton_pass']));
    });

    test('progress towards the next rank', () => {
        const state = recordBondEvent(createBondState(), 'lyra', 'quest_together').state;
        const progress = getBondProgress(state, 'lyra');
        expect(progress.rank).toBe(1);
        expect(progress.nextAt).toBe(6);
        expect(progress.progress).toBeGreaterThan(0);
    });

    test('the top rank has nothing left to reach', () => {
        const state = recordBondEvent(createBondState(), 'lyra', 'manual', { points: 999 }).state;
        expect(getBondProgress(state, 'lyra')).toMatchObject({ rank: MAX_RANK, nextAt: null, progress: 1 });
    });

    test('perks are earned by rank', () => {
        const state = recordBondEvent(createBondState(), 'lyra', 'manual', { points: 40 }).state;
        const perks = getUnlockedPerks(state, 'lyra');
        expect(perks.map(p => p.id)).toContain('follow_up');
        expect(perks.map(p => p.id)).not.toContain('ultimate');
    });

    test('a once-per-day perk can be spent and comes back with the day', () => {
        let state = recordBondEvent(createBondState(), 'lyra', 'manual', { points: 90 }).state;
        expect(isPerkAvailable(state, 'lyra', 'endure')).toBe(true);

        state = spendPerk(state, 'lyra', 'endure');
        expect(isPerkAvailable(state, 'lyra', 'endure')).toBe(false);

        state = resetDailyPerks(state);
        expect(isPerkAvailable(state, 'lyra', 'endure')).toBe(true);
    });

    test('a perk above your rank is not available', () => {
        const state = recordBondEvent(createBondState(), 'lyra', 'quest_together').state;
        expect(isPerkAvailable(state, 'lyra', 'endure')).toBe(false);
    });

    test('every perk changes something in combat', () => {
        expect(BOND_PERKS).toHaveLength(4);
        expect(BOND_PERKS.every(p => p.description.length > 0)).toBe(true);
    });

    // The heuristic is allowed to suggest, never to decide.
    test('the chat analyser only suggests', () => {
        const suggestion = suggestBondEvent('lyra', 25);
        expect(suggestion).toMatchObject({ characterId: 'lyra', points: 1 });
        expect(suggestion.reason).toContain('¿Confirmas');
    });

    test('a weak signal suggests nothing at all', () => {
        expect(suggestBondEvent('lyra', 3)).toBeNull();
    });

    test('junk state normalises', () => {
        expect(normalizeBondState(null).bonds).toEqual({});
        expect(normalizeBondState({ bonds: { lyra: { points: -5 } } }).bonds.lyra.points).toBe(0);
    });
});

// ============================================================ SCENARIOS

describe('scenario objectives', () => {
    const board = (overrides = {}) => ({
        round: 1,
        enemies: [{ id: 'gob1', currentHp: 5, gridX: 1, gridY: 1 }],
        allies: [{ id: 'lyra', currentHp: 10, gridX: 0, gridY: 0 }],
        collectedTreasures: [],
        ...overrides,
    });

    test('eliminate is done when the named targets are down', () => {
        const objective = { id: 'o1', type: 'eliminate', targetIds: ['gob1'] };
        expect(evaluateObjective(objective, board())).toBe('pending');
        expect(evaluateObjective(objective, board({
            enemies: [{ id: 'gob1', currentHp: 0, gridX: 1, gridY: 1 }],
        }))).toBe('complete');
    });

    test('clearing the board ignores who they were', () => {
        const objective = { id: 'o1', type: 'eliminate_all' };
        expect(evaluateObjective(objective, board())).toBe('pending');
        expect(evaluateObjective(objective, board({ enemies: [] }))).toBe('complete');
    });

    test('surviving needs the rounds and somebody left standing', () => {
        const objective = { id: 'o1', type: 'survive_rounds', rounds: 6 };
        expect(evaluateObjective(objective, board({ round: 3 }))).toBe('pending');
        expect(evaluateObjective(objective, board({ round: 6 }))).toBe('complete');
        expect(evaluateObjective(objective, board({
            round: 6, allies: [{ id: 'lyra', currentHp: 0, gridX: 0, gridY: 0 }],
        }))).toBe('failed');
    });

    test('reaching a cell needs somebody alive standing on it', () => {
        const objective = { id: 'o1', type: 'reach_cell', cell: { x: 4, y: 4 } };
        expect(evaluateObjective(objective, board())).toBe('pending');
        expect(evaluateObjective(objective, board({
            allies: [{ id: 'lyra', currentHp: 10, gridX: 4, gridY: 4 }],
        }))).toBe('complete');
    });

    test('an escort fails if the ward dies', () => {
        const objective = { id: 'o1', type: 'escort', allyId: 'ward', cell: { x: 4, y: 4 } };
        expect(evaluateObjective(objective, board({
            allies: [{ id: 'ward', currentHp: 0, gridX: 1, gridY: 1 }],
        }))).toBe('failed');
        expect(evaluateObjective(objective, board({
            allies: [{ id: 'ward', currentHp: 3, gridX: 4, gridY: 4 }],
        }))).toBe('complete');
    });

    test('protect stays pending while they live and fails when they do not', () => {
        const objective = { id: 'o1', type: 'protect', allyId: 'ward' };
        expect(evaluateObjective(objective, board({
            allies: [{ id: 'ward', currentHp: 3, gridX: 0, gridY: 0 }],
        }))).toBe('pending');
        expect(evaluateObjective(objective, board({
            allies: [{ id: 'ward', currentHp: 0, gridX: 0, gridY: 0 }],
        }))).toBe('failed');
    });

    test('loot needs every marked treasure', () => {
        const objective = { id: 'o1', type: 'loot', treasureIds: ['t1', 't2'] };
        expect(evaluateObjective(objective, board({ collectedTreasures: ['t1'] }))).toBe('pending');
        expect(evaluateObjective(objective, board({ collectedTreasures: ['t1', 't2'] }))).toBe('complete');
    });

    test('unknown objective types are dropped rather than guessed at', () => {
        expect(normalizeObjectives([{ id: 'x', type: 'vibes' }])).toEqual([]);
    });
});

describe('evaluateScenario', () => {
    const board = (overrides = {}) => ({
        round: 1, enemies: [], allies: [{ id: 'lyra', currentHp: 10, gridX: 0, gridY: 0 }],
        collectedTreasures: [], ...overrides,
    });

    test('all required objectives done means victory', () => {
        const result = evaluateScenario([{ id: 'o1', type: 'eliminate_all' }], board());
        expect(result.status).toBe('complete');
    });

    test('one failed required objective loses the scenario', () => {
        const result = evaluateScenario([
            { id: 'o1', type: 'eliminate_all' },
            { id: 'o2', type: 'protect', allyId: 'ward' },
        ], board({ allies: [{ id: 'ward', currentHp: 0, gridX: 0, gridY: 0 }] }));
        expect(result.status).toBe('failed');
    });

    // Optional means optional: it pays, it does not gate.
    test('an unfinished optional objective does not block victory', () => {
        const result = evaluateScenario([
            { id: 'o1', type: 'eliminate_all' },
            { id: 'o2', type: 'loot', treasureIds: ['t1'], optional: true },
        ], board());
        expect(result.status).toBe('complete');
        expect(result.bonusEarned).toBe(0);
    });

    test('a finished optional objective pays a bonus', () => {
        const result = evaluateScenario([
            { id: 'o1', type: 'eliminate_all' },
            { id: 'o2', type: 'loot', treasureIds: ['t1'], optional: true },
        ], board({ collectedTreasures: ['t1'] }));
        expect(result.bonusEarned).toBe(1);
    });

    test('a failed optional objective does not lose the scenario', () => {
        const result = evaluateScenario([
            { id: 'o1', type: 'eliminate_all' },
            { id: 'o2', type: 'protect', allyId: 'ward', optional: true },
        ], board({ allies: [{ id: 'ward', currentHp: 0, gridX: 0, gridY: 0 }] }));
        expect(result.status).toBe('complete');
    });

    test('summarises for the log', () => {
        const text = describeObjectives([{ id: 'o1', type: 'eliminate_all', label: 'Limpiar' }], board());
        expect(text).toContain('Limpiar');
        expect(text).toContain('✅');
    });
});

describe('quest state', () => {
    test('quests start not started', () => {
        expect(getQuestStatus(createQuestState(), 'q1')).toBe('not_started');
    });

    test('activating stamps the day it began', () => {
        const state = setQuestStatus(createQuestState(), 'q1', 'active', 3);
        expect(state.quests.q1).toMatchObject({ status: 'active', startedDay: 3 });
    });

    test('the start day survives completion', () => {
        let state = setQuestStatus(createQuestState(), 'q1', 'active', 3);
        state = setQuestStatus(state, 'q1', 'complete', 9);
        expect(state.quests.q1).toMatchObject({ startedDay: 3, completedDay: 9 });
    });

    // Finished quests in the prompt are tokens spent on nothing actionable.
    test('only active quests are offered to the prompt', () => {
        let state = setQuestStatus(createQuestState(), 'q1', 'active', 1);
        state = setQuestStatus(state, 'q2', 'complete', 2);
        state = setQuestStatus(state, 'q3', 'active', 3);
        expect(getActiveQuestIds(state).sort()).toEqual(['q1', 'q3']);
    });
});

// ============================================================ ROOMS & MAP

describe('rooms and doors', () => {
    const room = () => createRoomFromRect('vault', { x: 5, y: 5, width: 3, height: 3 }, {
        name: 'Cámara', doors: [{ x: 4, y: 6 }], enemyIds: ['guard1', 'guard2'],
    });

    test('a rectangle becomes its cells', () => {
        expect(room().cells).toHaveLength(9);
        expect(room().cells).toContain('5,5');
        expect(room().cells).toContain('7,7');
    });

    test('finds the room a cell belongs to', () => {
        expect(getRoomAt([room()], 6, 6).id).toBe('vault');
        expect(getRoomAt([room()], 0, 0)).toBeNull();
    });

    test('finds the room a door guards', () => {
        expect(getRoomBehindDoor([room()], 4, 6).id).toBe('vault');
        expect(getRoomBehindDoor([room()], 0, 0)).toBeNull();
    });

    test('opening a door reveals the room and wakes what is in it', () => {
        const terrain = setCell(createEmptyTerrain(), 4, 6, 'door', { open: false });
        const result = openDoor(terrain, [room()], 4, 6);

        expect(isPassable(result.terrain, 4, 6, 20, 20)).toBe(true);
        expect(result.revealedRoom.id).toBe('vault');
        expect(result.wokenEnemyIds).toEqual(['guard1', 'guard2']);
    });

    test('opening the same door twice wakes nothing more', () => {
        const terrain = setCell(createEmptyTerrain(), 4, 6, 'door', { open: false });
        const first = openDoor(terrain, [room()], 4, 6);
        const second = openDoor(first.terrain, first.rooms, 4, 6);
        expect(second.wokenEnemyIds).toEqual([]);
        expect(second.revealedRoom).toBeNull();
    });

    test('a door that guards nothing just opens', () => {
        const terrain = setCell(createEmptyTerrain(), 1, 1, 'door', { open: false });
        const result = openDoor(terrain, [room()], 1, 1);
        expect(isPassable(result.terrain, 1, 1, 20, 20)).toBe(true);
        expect(result.revealedRoom).toBeNull();
    });

    // This is what stops a dungeon being one enormous fight.
    test('enemies in an unopened room are asleep', () => {
        const rooms = [room()];
        expect(isEnemyAwake(rooms, 'guard1')).toBe(false);

        const terrain = setCell(createEmptyTerrain(), 4, 6, 'door', { open: false });
        const opened = openDoor(terrain, rooms, 4, 6);
        expect(isEnemyAwake(opened.rooms, 'guard1')).toBe(true);
    });

    test('an enemy placed outside any room is awake from the start', () => {
        expect(isEnemyAwake([room()], 'wanderer')).toBe(true);
    });

    test('revealed cells cover only the rooms that were opened', () => {
        expect(getRevealedCells([room()]).size).toBe(0);
        const terrain = setCell(createEmptyTerrain(), 4, 6, 'door', { open: false });
        expect(getRevealedCells(openDoor(terrain, [room()], 4, 6).rooms).size).toBe(9);
    });
});

describe('campaign map', () => {
    const map = () => normalizeCampaignMap({
        locations: [
            { id: 'village', name: 'Aldea', status: 'available' },
            { id: 'cave', name: 'Cueva', requiresLocations: ['village'] },
            { id: 'temple', name: 'Templo', requiresQuests: ['q1'] },
            { id: 'sanctum', name: 'Santuario', requiresBondWith: 'lyra', requiresBondRank: 5 },
        ],
    });

    const context = (overrides = {}) => ({
        isQuestComplete: () => false,
        getBondRank: () => 1,
        ...overrides,
    });

    test('locations start locked unless they say otherwise', () => {
        expect(map().locations.find(l => l.id === 'cave').status).toBe('locked');
    });

    test('a location opens when its prerequisite is done', () => {
        let current = completeLocation(map(), 'village');
        current = refreshAvailability(current, context());
        expect(current.locations.find(l => l.id === 'cave').status).toBe('available');
    });

    test('a quest requirement gates a location', () => {
        const locked = refreshAvailability(map(), context());
        expect(locked.locations.find(l => l.id === 'temple').status).toBe('locked');

        const open = refreshAvailability(map(), context({ isQuestComplete: id => id === 'q1' }));
        expect(open.locations.find(l => l.id === 'temple').status).toBe('available');
    });

    test('a bond requirement gates a location', () => {
        const locked = refreshAvailability(map(), context());
        expect(locked.locations.find(l => l.id === 'sanctum').status).toBe('locked');

        const open = refreshAvailability(map(), context({ getBondRank: () => 7 }));
        expect(open.locations.find(l => l.id === 'sanctum').status).toBe('available');
    });

    test('a completed location is never re-locked', () => {
        let current = completeLocation(map(), 'temple');
        current = refreshAvailability(current, context());
        expect(current.locations.find(l => l.id === 'temple').status).toBe('complete');
    });

    // A tooltip that explains beats one that just refuses.
    test('explains why something is shut', () => {
        const reasons = explainLock(refreshAvailability(map(), context()), 'sanctum', context());
        expect(reasons.join(' ')).toContain('vínculo 5');
        expect(reasons.join(' ')).toContain('lyra');
    });

    test('nothing to explain about an open location', () => {
        expect(explainLock(map(), 'village', context())).toEqual([]);
    });

    test('junk normalises to an empty map', () => {
        expect(normalizeCampaignMap(null).locations).toEqual([]);
        expect(normalizeCampaignMap({ locations: [null, { name: 'sin id' }] }).locations).toEqual([]);
    });
});
