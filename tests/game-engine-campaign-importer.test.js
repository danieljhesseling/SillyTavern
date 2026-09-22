import { describe, test, expect, jest } from '@jest/globals';
import {
    buildImportPlan, buildPackEntries, resolveNames, importPack,
} from '../public/scripts/game-engine/campaign/campaign-importer.js';
import { buildExamplePack } from '../public/scripts/game-engine/campaign/campaign-pack-schema.js';
import { normalizePack } from '../public/scripts/game-engine/campaign/campaign-pack.js';

const example = () => buildExamplePack();

/** Ids the way the Lorebook hands them back: one per entry title. */
const fakeIds = plan => Object.fromEntries(plan.entries.map((e, i) => [e.title, `uid${i}`]));

describe('the entries a pack implies', () => {
    test('one per companion, monster, lore note and faction', () => {
        const entries = buildPackEntries(normalizePack(example()).pack);
        expect(entries.map(e => `${e.group}:${e.title}`)).toEqual([
            'Characters:Mira la Molinera',
            'Monsters:Cuervo grande',
            'Monsters:Guardián del grano',
            'Lore:Molino',
            'Lore:Cuervos',
            'Factions:La Orden de la Pluma',
        ]);
    });

    test('a monster carries the numbers the engine fights with', () => {
        const [, crow] = buildPackEntries(normalizePack(example()).pack);
        expect(crow.dndData).toMatchObject({
            entityType: 'monster', name: 'Cuervo grande', hp: 7, maxHp: 7,
            armorClass: 12, cr: 0.125, profile: 'skirmisher', attackRangeFeet: 5,
        });
    });

    test('a companion is an npc, with its arcana', () => {
        const [mira] = buildPackEntries(normalizePack(example()).pack);
        expect(mira.dndData).toMatchObject({ entityType: 'npc', arcana: 'La Ermitaña' });
    });

    test('a monster with nothing but a name still gets playable numbers', () => {
        const [enemy] = buildPackEntries(normalizePack({ bestiary: [{ name: 'Sombra' }] }).pack);
        // `aggressive` y no `brute`: el segundo no es un perfil del motor, y enemy-ai lo
        // tomaba por desconocido y lo jugaba como agresivo sin decir nada.
        expect(enemy.dndData).toMatchObject({ hp: 1, armorClass: 10, speed: 30, profile: 'aggressive' });
    });

    test('anything without a name is skipped rather than written blank', () => {
        expect(buildPackEntries(normalizePack({ bestiary: [{ hp: 3 }], confidants: [{ }] }).pack)).toEqual([]);
    });
});

describe('the world a pack draws', () => {
    test('boards of the same place land in one location', () => {
        const plan = buildImportPlan(example());
        expect(plan.metadata.locationMaps).toHaveLength(1);
        expect(plan.metadata.locationMaps[0].boards.map(b => b.name))
            .toEqual(['Planta baja del molino', 'El sótano']);
    });

    test('and the location is big enough for its biggest board', () => {
        const location = buildImportPlan(example()).metadata.locationMaps[0];
        expect(location.gridWidth).toBe(14);
        expect(location.gridHeight).toBe(9);
    });

    test('two places make two locations', () => {
        const pack = example();
        pack.boards[1].locationName = 'El bosque';
        const plan = buildImportPlan(pack);
        expect(plan.metadata.locationMaps.map(l => l.name)).toEqual(['El Molino de los Cuervos', 'El bosque']);
    });

    test('the map becomes terrain, not a pile of characters', () => {
        const [board] = buildImportPlan(example()).metadata.locationMaps[0].boards;
        expect(board.terrain.cells['0,0']).toMatchObject({ type: 'wall' });
        expect(board.terrain.cells['5,2']).toMatchObject({ type: 'door' });
        expect(board.terrain.cells['1,1']).toBeUndefined();
    });

    test('a board with enemies is marked as one where a fight happens', () => {
        const boards = buildImportPlan(example()).metadata.locationMaps[0].boards;
        expect(boards.every(b => b.isCombat)).toBe(true);
    });

    test('the quest objectives are written onto the board they are played on', () => {
        const [entrada, sotano] = buildImportPlan(example()).metadata.locationMaps[0].boards;
        expect(entrada.objectives.map(o => o.type)).toEqual(['eliminate_all']);
        expect(sotano.objectives.map(o => o.type)).toEqual(['eliminate', 'protect', 'survive_rounds']);
        expect(sotano.objectives[2].optional).toBe(true);
    });

    test('two quests on one board put their objectives together', () => {
        const pack = example();
        pack.quests[1].boardId = 'molino_planta_baja';
        const [entrada] = buildImportPlan(pack).metadata.locationMaps[0].boards;
        expect(entrada.objectives).toHaveLength(4);
    });

    test('nothing in an empty pack, and no crash', () => {
        const plan = buildImportPlan({});
        expect(plan.metadata.locationMaps).toEqual([]);
        expect(plan.counts).toEqual({ boards: 0, entries: 0, quests: 0, placements: 0 });
    });
});

describe('names into ids, after the entries exist', () => {
    test('an objective that named a monster ends up pointing at its entry', () => {
        const plan = buildImportPlan(example());
        const { metadata, unresolved } = resolveNames(plan, fakeIds(plan));
        const sotano = metadata.locationMaps[0].boards[1];
        expect(sotano.objectives[0].targetIds).toEqual(['uid2']);
        expect(sotano.objectives[1].allyId).toBe('uid0');
        expect(unresolved).toEqual([]);
    });

    // The bug this module is shaped around: rules written before the ids existed.
    test('the board gets encounter rules that point at real monsters', () => {
        const plan = buildImportPlan(example());
        const { metadata } = resolveNames(plan, fakeIds(plan));
        expect(metadata.locationMaps[0].boards[0].encounterRules).toEqual([
            { enemyId: 'uid1', minCount: 1, maxCount: 1 },
        ]);
    });

    test('three crows on a board field three crows, not a range', () => {
        const pack = example();
        pack.boards[0].enemies = [
            { name: 'Cuervo grande', x: 9, y: 2 },
            { name: 'Cuervo grande', x: 8, y: 2 },
            { name: 'Cuervo grande', x: 7, y: 2 },
        ];
        const plan = buildImportPlan(pack);
        const { metadata } = resolveNames(plan, fakeIds(plan));
        expect(metadata.locationMaps[0].boards[0].encounterRules)
            .toEqual([{ enemyId: 'uid1', minCount: 3, maxCount: 3 }]);
    });

    test('the temporary name field does not survive into the saved board', () => {
        const plan = buildImportPlan(example());
        const { metadata } = resolveNames(plan, fakeIds(plan));
        for (const board of metadata.locationMaps[0].boards) {
            for (const objective of board.objectives) {
                expect(objective).not.toHaveProperty('pendingName');
            }
        }
    });

    // An objective silently pointing at nobody is a mission that can never be completed
    // and never explains itself.
    test('a name with no entry is reported, not left empty', () => {
        const plan = buildImportPlan(example());
        const { unresolved } = resolveNames(plan, { 'Mira la Molinera': 'uid0' });
        expect(unresolved).toEqual(expect.arrayContaining([
            expect.stringContaining('Cuervo grande'),
            expect.stringContaining('Guardián del grano'),
        ]));
    });

    test('matching a name ignores case, because a book is not a database', () => {
        const plan = buildImportPlan(example());
        const ids = Object.fromEntries(plan.entries.map((e, i) => [e.title.toUpperCase(), `uid${i}`]));
        const { unresolved } = resolveNames(plan, ids);
        expect(unresolved).toEqual([]);
    });

    test('where an objective needs no name, nothing is looked up', () => {
        const plan = buildImportPlan(example());
        const { metadata } = resolveNames(plan, fakeIds(plan));
        expect(metadata.locationMaps[0].boards[1].objectives[2].rounds).toBe(6);
    });
});

describe('importing, end to end', () => {
    /** A Lorebook that hands out uids the way the real one does. */
    const fakeWorld = () => {
        let next = 0;
        const data = { entries: {} };
        return {
            data,
            createWorld: jest.fn(async () => true),
            loadWorld: jest.fn(async () => data),
            saveWorld: jest.fn(async () => true),
            createEntry: jest.fn(() => {
                const entry = { uid: next++ };
                data.entries[entry.uid] = entry;
                return entry;
            }),
        };
    };

    test('creates the world, writes the entries and saves it once', async () => {
        const fake = fakeWorld();
        const result = await importPack({ pack: example(), worldName: 'El Molino', ...fake });

        expect(fake.createWorld).toHaveBeenCalledWith('El Molino');
        expect(fake.createEntry).toHaveBeenCalledTimes(6);
        expect(fake.saveWorld).toHaveBeenCalledTimes(1);
        expect(result).toMatchObject({
            worldName: 'El Molino',
            locationName: 'El Molino de los Cuervos',
            boardName: 'Planta baja del molino',
            unresolved: [],
        });
    });

    // The order is the point: entries first, ids second, rules third.
    test('the saved world has rules pointing at the entries it just created', async () => {
        const fake = fakeWorld();
        await importPack({ pack: example(), worldName: 'El Molino', ...fake });

        const saved = fake.saveWorld.mock.calls[0][1];
        const [entrada, sotano] = saved.metadata.locationMaps[0].boards;
        const crowUid = String(Object.values(saved.entries).find(e => e.comment === 'Cuervo grande').uid);

        expect(entrada.encounterRules[0].enemyId).toBe(crowUid);
        expect(sotano.objectives[0].targetIds[0])
            .toBe(String(Object.values(saved.entries).find(e => e.comment === 'Guardián del grano').uid));
    });

    test('a world that cannot be created stops everything', async () => {
        const fake = fakeWorld();
        fake.createWorld = jest.fn(async () => false);
        await expect(importPack({ pack: example(), worldName: 'Repetido', ...fake }))
            .rejects.toThrow(/No se pudo crear el mundo/);
        expect(fake.saveWorld).not.toHaveBeenCalled();
    });

    test('a world that cannot be loaded stops before writing anything', async () => {
        const fake = fakeWorld();
        fake.loadWorld = jest.fn(async () => null);
        await expect(importPack({ pack: example(), worldName: 'Roto', ...fake }))
            .rejects.toThrow(/No se pudo cargar/);
        expect(fake.createEntry).not.toHaveBeenCalled();
    });
});

describe('the rooms a board draws for itself', () => {
    test('every imported board carries the rooms its map implies', () => {
        const boards = buildImportPlan(example()).metadata.locationMaps[0].boards;
        expect(boards.every(b => b.rooms.length >= 2)).toBe(true);
    });

    // The point of the whole thing: what is behind a closed door is not known yet.
    test('the party starts in a revealed room and the rest are shut', () => {
        const [, sotano] = buildImportPlan(example()).metadata.locationMaps[0].boards;
        expect(sotano.rooms.filter(r => r.revealed)).toHaveLength(1);
        expect(sotano.rooms.filter(r => !r.revealed)).toHaveLength(1);
        expect(sotano.rooms.find(r => r.revealed).cells).toContain('2,7');
    });

    test('and the guardian of the example sleeps behind the door', async () => {
        const { awakePlacements, enemiesInRoom } = await import('../public/scripts/game-engine/campaign/campaign-map.js');
        const [, sotano] = buildImportPlan(example()).metadata.locationMaps[0].boards;
        expect(awakePlacements(sotano.rooms, sotano.enemyPlacements)).toEqual([]);
        const shut = sotano.rooms.find(r => !r.revealed);
        expect(enemiesInRoom(shut, sotano.enemyPlacements).map(p => p.name)).toEqual(['Guardián del grano']);
    });
});
