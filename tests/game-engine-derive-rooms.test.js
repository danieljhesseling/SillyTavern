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

// Tanda 16: la tienda de mando de 1387 dibuja sus dos puertas abiertas («o»), y la Capitana
// Keller y su escolta dormían al otro lado sin que nadie las viera: una puerta abierta no se
// puede abrir (pulsarla la cierra), así que nunca despertaban.
describe('an open door hides nothing', () => {
    const tent = [
        '#################',
        '#C..c.......c..C#',
        '#...............#',
        '#...c..C.C..c...#',
        '#...............#',
        '##o###########o##',
        '#.~...........~.#',
        '#.~~.........~~.#',
        '#...............#',
        '#################',
    ];
    const start = [{ x: 7, y: 8 }, { x: 8, y: 8 }, { x: 9, y: 8 }];
    const keller = [{ name: 'Capitana Keller', x: 8, y: 2 }, { name: 'Rompehielos de Keller', x: 4, y: 4 }, { name: 'Rompehielos de Keller', x: 12, y: 4 }];

    test('both sides of an open door are one room, seen from the start, and Keller is awake', async () => {
        const { awakePlacements } = await import('../public/scripts/game-engine/campaign/campaign-map.js');
        const found = rooms(tent, { revealFrom: start });
        expect(found).toHaveLength(1);
        expect(found[0].revealed).toBe(true);
        // Las puertas siguen siendo puertas de la sala, y su casilla no es suelo de ella.
        expect(found[0].doors.sort()).toEqual(['14,5', '2,5']);
        expect(found[0].cells).not.toContain('2,5');
        expect(awakePlacements(found, keller)).toHaveLength(3);
    });

    test('the same map with its doors closed still keeps Keller asleep until a door opens', async () => {
        const { awakePlacements } = await import('../public/scripts/game-engine/campaign/campaign-map.js');
        const shut = tent.map(row => row.replace(/o/g, 'D'));
        const found = rooms(shut, { revealFrom: start });
        expect(found).toHaveLength(2);
        expect(awakePlacements(found, keller)).toHaveLength(0);
    });

    test('a board saved before this is put right: a room behind an open door of a revealed one is revealed, in chain', async () => {
        const { revealThroughOpenDoors } = await import('../public/scripts/game-engine/campaign/campaign-map.js');
        // Tres salas en fila: A | o | B | o | C, y una D tras una puerta cerrada.
        const map = ['#############', '#..o..o..D..#', '#############'];
        const terrain = terrainFromAsciiMap(map);
        const saved = [
            { id: 'room_1', name: 'A', cells: ['1,1', '2,1'], doors: ['3,1'], revealed: true },
            { id: 'room_2', name: 'B', cells: ['4,1', '5,1'], doors: ['3,1', '6,1'], revealed: false },
            { id: 'room_3', name: 'C', cells: ['7,1', '8,1'], doors: ['6,1', '9,1'], revealed: false },
            { id: 'room_4', name: 'D', cells: ['10,1', '11,1'], doors: ['9,1'], revealed: false },
        ];
        const fixed = revealThroughOpenDoors(saved, terrain);
        expect(fixed.map((/** @type {any} */ r) => r.revealed)).toEqual([true, true, true, false]);
        // Lo que guardaba (el nombre de la sala) se queda.
        expect(fixed[1].name).toBe('B');
        // Sin nada que cambiar, devuelve las mismas salas (no se guarda otra vez).
        expect(revealThroughOpenDoors(fixed, terrain)).toBe(fixed);
        expect(revealThroughOpenDoors(null, terrain)).toBeNull();
    });
});
