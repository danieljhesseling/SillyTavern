import { describe, test, expect } from '@jest/globals';
import {
    deriveRooms, getRoomAt, getRoomBehindDoor, openDoor, getRevealedCells,
} from '../public/scripts/game-engine/campaign/campaign-map.js';
import { terrainFromAsciiMap } from '../public/scripts/game-engine/board/terrain.js';

/** Two rooms of nine cells, joined by one door. */
const twoRooms = ['#########', '#...#...#', '#...D...#', '#...#...#', '#########'];
const rooms = (map, options) =>
    deriveRooms(terrainFromAsciiMap(map), map[0].length, map.length, options);

describe('rooms derived from the map itself', () => {
    // A book draws its rooms; it does not describe them. So nothing extra is asked of
    // the Gem, and an older board gains rooms the moment this runs over it.
    test('a wall between two halves makes two rooms', () => {
        const found = rooms(twoRooms);
        expect(found).toHaveLength(2);
        expect(found.map(r => r.cells.length)).toEqual([9, 9]);
    });

    test('the door between them belongs to both', () => {
        expect(rooms(twoRooms).every(r => r.doors.includes('4,2'))).toBe(true);
    });

    test('an open plan is one room with no doors', () => {
        const found = rooms(['#####', '#...#', '#...#', '#####']);
        expect(found).toHaveLength(1);
        expect(found[0].doors).toEqual([]);
        expect(found[0].cells).toHaveLength(6);
    });

    test('a corridor behind a door is a room of its own', () => {
        const found = rooms(['#######', '#..D..#', '#######']);
        expect(found).toHaveLength(2);
        expect(found.map(r => r.cells.length)).toEqual([2, 2]);
    });

    test('difficult ground and cover are still floor', () => {
        const found = rooms(['#####', '#.c~#', '#CCC#', '#####']);
        expect(found).toHaveLength(1);
        expect(found[0].cells).toHaveLength(6);
    });

    test('where the party stands is not a surprise', () => {
        const found = rooms(twoRooms, { revealFrom: [{ x: 1, y: 1 }, { x: 2, y: 1 }] });
        expect(found[0].revealed).toBe(true);
        expect(found[1].revealed).toBe(false);
    });

    test('a board with nothing on it derives nothing, and does not throw', () => {
        expect(deriveRooms(null, 0, 0)).toEqual([]);
        expect(deriveRooms(terrainFromAsciiMap(['###', '###']), 3, 2)).toEqual([]);
    });

    test('every floor cell belongs to exactly one room', () => {
        const map = ['#########', '#...#...#', '#...D...#', '#.#.#...#', '#########'];
        const found = rooms(map);
        const all = found.flatMap(r => r.cells);
        expect(new Set(all).size).toBe(all.length);
        expect(getRoomAt(found, 1, 1)).not.toBeNull();
        expect(getRoomAt(found, 0, 0)).toBeNull();
    });
});

describe('opening the door', () => {
    const terrain = terrainFromAsciiMap(twoRooms);

    test('reveals the room you have not seen, not the one you are in', () => {
        const start = rooms(twoRooms, { revealFrom: [{ x: 1, y: 1 }] });
        expect(getRoomBehindDoor(start, 4, 2)?.id).toBe(start[1].id);

        const result = openDoor(terrain, start, 4, 2);
        expect(result.revealedRoom?.id).toBe(start[1].id);
        expect(result.rooms[1].revealed).toBe(true);
        expect(result.rooms[0].revealed).toBe(true);
    });

    test('and the door is open afterwards', () => {
        const start = rooms(twoRooms, { revealFrom: [{ x: 1, y: 1 }] });
        expect(openDoor(terrain, start, 4, 2).terrain.cells['4,2'].open).toBe(true);
    });

    test('opening it twice reveals nothing the second time', () => {
        const start = rooms(twoRooms, { revealFrom: [{ x: 1, y: 1 }] });
        const once = openDoor(terrain, start, 4, 2);
        expect(openDoor(once.terrain, once.rooms, 4, 2).revealedRoom).toBeNull();
    });

    test('what the party may know about grows with the room', () => {
        const start = rooms(twoRooms, { revealFrom: [{ x: 1, y: 1 }] });
        const before = getRevealedCells(start);
        const after = getRevealedCells(openDoor(terrain, start, 4, 2).rooms);
        expect(before.size).toBe(9);
        expect(after.size).toBe(18);
    });
});

describe('who is asleep behind the door', () => {
    const placements = [
        { name: 'Cuervo', x: 2, y: 1 },
        { name: 'Guardián', x: 6, y: 2 },
        { name: 'Sombra', x: 7, y: 3 },
    ];

    test('the creatures of a room are the ones standing in it', async () => {
        const { enemiesInRoom } = await import('../public/scripts/game-engine/campaign/campaign-map.js');
        const found = rooms(twoRooms, { revealFrom: [{ x: 1, y: 1 }] });
        expect(enemiesInRoom(found[0], placements).map(p => p.name)).toEqual(['Cuervo']);
        expect(enemiesInRoom(found[1], placements).map(p => p.name)).toEqual(['Guardián', 'Sombra']);
        expect(enemiesInRoom(null, placements)).toEqual([]);
    });

    test('only the ones in a revealed room are awake', async () => {
        const { awakePlacements } = await import('../public/scripts/game-engine/campaign/campaign-map.js');
        const found = rooms(twoRooms, { revealFrom: [{ x: 1, y: 1 }] });
        expect(awakePlacements(found, placements).map(p => p.name)).toEqual(['Cuervo']);

        const opened = openDoor(terrainFromAsciiMap(twoRooms), found, 4, 2).rooms;
        expect(awakePlacements(opened, placements)).toHaveLength(3);
    });

    // Every board made before rooms existed has none, and must keep working as it did.
    test('a board with no rooms hides nobody', async () => {
        const { awakePlacements } = await import('../public/scripts/game-engine/campaign/campaign-map.js');
        expect(awakePlacements([], placements)).toHaveLength(3);
        expect(awakePlacements(null, placements)).toHaveLength(3);
    });
});
