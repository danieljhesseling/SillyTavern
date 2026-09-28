import { describe, test, expect } from '@jest/globals';
import {
    BRUSHES, START_BRUSH, MAX_STARTS, draftFor, draftOf, paintCell, draftProblem, storedBoard, walkable, settleEnemies,
} from '../public/scripts/game-engine/campaign/board-draft.js';
import { createCampaign } from '../public/scripts/game-engine/ui/campaign-wizard.js';
import {
    startTaller, addLocation, addBoard, editBoard, toAnswers, blocksNext, writeField, pickCard, locationsOf,
} from '../public/scripts/game-engine/campaign/taller.js';
import { createSeededRandom } from '../public/scripts/game-engine/combat/seeded-random.js';

const box = () => ({
    map: ['#######', '#.....#', '#.....#', '#.....#', '#######'],
    partyStart: [{ x: 1, y: 1 }],
});

describe('dibujar un tablero con la semilla', () => {
    test('el mismo mundo y la misma clave dan el mismo tablero; otra vez, otro', () => {
        const one = draftFor({ key: 'loc-2-b1', shape: 'cave', size: 'small', seed: 'uno-dos-tres' });
        const two = draftFor({ key: 'loc-2-b1', shape: 'cave', size: 'small', seed: 'uno-dos-tres' });
        const other = draftFor({ key: 'loc-2-b1', shape: 'cave', size: 'small', seed: 'uno-dos-tres', take: 1 });
        expect(two).toEqual(one);
        expect(other.map).not.toEqual(one.map);
        expect(one.partyStart.length).toBeGreaterThan(0);
        expect(draftProblem(one)).toBe('');
    });

    test('lo pintado manda sobre la semilla', () => {
        const painted = { id: 'x', shape: 'rooms', map: box().map, partyStart: box().partyStart };
        expect(draftOf(painted, 'lo-que-sea')).toEqual(box());
        // Sin mapa, el de la semilla.
        expect(draftOf({ id: 'x', shape: 'rooms', size: 'small' }, 's').map.length).toBe(10);
    });
});

describe('pintar', () => {
    test('una casilla cambia, y el resto se queda', () => {
        const next = paintCell(box(), 3, 2, '#');
        expect(next.map[2]).toBe('#..#..#');
        expect(next.map[1]).toBe(box().map[1]);
    });

    test('el borde no se toca, y pintar lo mismo no cambia nada', () => {
        const draft = box();
        expect(paintCell(draft, 0, 2, '.')).toBe(draft);
        expect(paintCell(draft, 3, 4, '.')).toBe(draft);
        expect(paintCell(draft, 3, 2, '.')).toBe(draft);
        expect(paintCell(draft, 3, 2, 'Z')).toBe(draft);
    });

    test('tapar el inicio lo quita; en una pared no se pone', () => {
        const walled = paintCell(box(), 1, 1, '#');
        expect(walled.partyStart).toEqual([]);
        expect(draftProblem(walled)).toMatch(/dónde empieza el grupo/);
        expect(paintCell(walled, 1, 1, START_BRUSH)).toBe(walled);
        const back = paintCell(box(), 2, 2, START_BRUSH);
        expect(back.partyStart).toEqual([{ x: 1, y: 1 }, { x: 2, y: 2 }]);
        // Otra vez en la misma, se quita.
        expect(paintCell(back, 2, 2, START_BRUSH).partyStart).toEqual([{ x: 1, y: 1 }]);
    });

    test('no caben más inicios de la cuenta', () => {
        let draft = box();
        for (let x = 2; x <= 5; x++) draft = paintCell(draft, x, 1, START_BRUSH);
        for (let x = 1; x <= 5; x++) draft = paintCell(draft, x, 2, START_BRUSH);
        expect(draft.partyStart).toHaveLength(MAX_STARTS);
    });

    // Los enemigos no se enseñan en el taller: se puede pintar encima, y al crear se recolocan.
    test('un enemigo que quedó en un muro o encerrado pasa a la casilla libre más cercana a la que se llega', () => {
        let draft = box();
        for (let y = 1; y <= 3; y++) draft = paintCell(draft, 4, y, '#');
        const walled = paintCell(box(), 3, 2, '#');
        expect(settleEnemies(draft, [{ name: 'Lobo', x: 5, y: 2 }])).toEqual([{ name: 'Lobo', x: 3, y: 2 }]);
        expect(settleEnemies(walled, [{ name: 'Lobo', x: 3, y: 2 }])[0]).not.toEqual({ name: 'Lobo', x: 3, y: 2 });
        // El que está bien, se queda; y dos no acaban en la misma casilla.
        expect(settleEnemies(box(), [{ name: 'Lobo', x: 4, y: 3 }])).toEqual([{ name: 'Lobo', x: 4, y: 3 }]);
        const two = settleEnemies(draft, [{ name: 'A', x: 5, y: 1 }, { name: 'B', x: 5, y: 3 }]);
        expect(new Set(two.map(e => `${e.x},${e.y}`)).size).toBe(2);
        // Tampoco donde empieza el grupo.
        expect(two.some(e => e.x === 1 && e.y === 1)).toBe(false);
    });

    test('quien no se ve no avisa: el taller solo mira que el grupo tenga dónde empezar', () => {
        let draft = box();
        for (let y = 1; y <= 3; y++) draft = paintCell(draft, 4, y, '#');
        expect(draftProblem(draft)).toBe('');
    });

    test('los pinceles son de la leyenda, más el inicio', () => {
        expect(BRUSHES.map(b => b.id)).toContain(START_BRUSH);
        expect(walkable('#')).toBe(false);
        expect(walkable('.')).toBe(true);
        expect(walkable('~')).toBe(true);
    });
});

describe('lo que se crea es lo que se ve', () => {
    test('el tablero guardado lleva el mapa pintado y dónde empieza el grupo', () => {
        const board = storedBoard(paintCell(box(), 3, 2, 'w'), { name: 'La poza' });
        expect(board).toMatchObject({ name: 'La poza', gridWidth: 7, gridHeight: 5, partyStart: [{ x: 1, y: 1 }], isCombat: false });
        expect(board.terrain.cells['3,2'].type).toBe('water');
    });

    const conTablero = () => {
        let state = startTaller({ path: 'cero', random: createSeededRandom('tablero') });
        state = writeField(state, 'worldName', 'Mi mundo');
        state = writeField(state, 'seed', 'uno-dos-tres');
        state = pickCard(state, 'mundo', 'dungeon', true);
        const place = addLocation(state, { name: 'El Soto', fixed: true });
        const made = addBoard(place.state, place.id, { name: 'La cueva', shape: 'cave', size: 'small' });
        return { state: made.state, placeId: place.id, boardId: made.id };
    };

    test('el taller manda cada tablero con su mapa, el de la semilla o el pintado', () => {
        const { state, placeId, boardId } = conTablero();
        const sent = toAnswers(state).locations.find(l => l.name === 'El Soto').boards[0];
        const board = locationsOf(state).find(p => p.id === placeId).boards.find(b => b.id === boardId);
        expect(sent.map).toEqual(draftOf(board, 'uno-dos-tres').map);

        const painted = editBoard(state, placeId, boardId, box());
        expect(toAnswers(painted).locations.find(l => l.name === 'El Soto').boards[0].map).toEqual(box().map);
    });

    test('un tablero pintado sin inicio para el taller', () => {
        const { state, placeId, boardId } = conTablero();
        const broken = editBoard(state, placeId, boardId, { map: box().map, partyStart: [] });
        expect(blocksNext(broken, 'tableros')).toMatch(/La cueva: no dice dónde empieza/);
    });

    // A15 de POR_HACER: antes se guardaban como «pedidos» y no salía ninguno.
    test('y al crear la campaña, los tableros del taller existen', async () => {
        let saved = null;
        let uid = 0;
        await createCampaign({
            answers: {
                templateId: 'dungeon', worldName: 'Mi mundo', genre: '', description: '', party: [],
                locations: [
                    { name: 'Cripta', boards: [] },
                    { name: 'El Soto', routes: [{ to: 'Cripta', days: 1 }], boards: [{ id: 'b1', name: 'La cueva', ...paintCell(box(), 3, 2, 'w') }] },
                ],
            },
            createWorld: async () => true,
            loadWorld: async () => ({ entries: {}, metadata: {} }),
            saveWorld: async (/** @type {string} */ name, /** @type {any} */ data) => { saved = data; },
            createEntry: (/** @type {string} */ name, /** @type {any} */ data) => { const entry = { uid: uid++ }; data.entries[entry.uid] = entry; return entry; },
        });
        const soto = saved.metadata.locationMaps.find((/** @type {any} */ l) => l.name === 'El Soto');
        expect(soto.boards.map((/** @type {any} */ b) => b.name)).toEqual(['La cueva']);
        expect(soto.boards[0].terrain.cells['3,2'].type).toBe('water');
        expect(soto.boards[0].partyStart).toEqual([{ x: 1, y: 1 }]);
        // El de partida conserva el de la plantilla.
        expect(saved.metadata.locationMaps[0].boards[0].name).toBe('Sala de entrada');
    });
});
