import { describe, test, expect } from '@jest/globals';
import {
    CAMPAIGN_PACK_VERSION,
    OBJECTIVE_FIELDS,
    BOARD_LIMITS,
    SECTION_ORDER,
    getMapLegend,
    getSectionSchema,
    buildCampaignPackSchema,
    getPackRules,
    buildGemInstructions,
    buildExamplePack,
} from '../public/scripts/game-engine/campaign/campaign-pack-schema.js';
import { OBJECTIVE_TYPES } from '../public/scripts/game-engine/campaign/scenarios.js';
import { ASCII_TERRAIN } from '../public/scripts/game-engine/board/terrain.js';
import { getProfileOptions } from '../public/scripts/game-engine/combat/enemy-ai.js';

// The schema is the border between a Gem that lives outside this repository and the
// engine inside it. A border written twice drifts, so these check it is written once.
describe('the schema is generated from the engine, not typed out beside it', () => {
    const schema = buildCampaignPackSchema();
    const objective = schema.properties.quests.items.properties.objectives.items;

    test('the objective types are exactly the ones the engine judges', () => {
        expect(objective.properties.type.enum.sort()).toEqual(Object.keys(OBJECTIVE_TYPES).sort());
    });

    test('the tactical profiles are exactly the ones the enemy AI runs', () => {
        expect(schema.properties.bestiary.items.properties.profile.enum)
            .toEqual(getProfileOptions().map(([value]) => value));
    });

    test('the map legend covers every character the board understands', () => {
        const legend = getMapLegend();
        for (const char of Object.keys(ASCII_TERRAIN)) {
            expect(legend[char]).toBeTruthy();
        }
        expect(legend['.']).toBeTruthy();
    });

    test('every objective type has an entry saying what it asks for', () => {
        for (const type of Object.keys(OBJECTIVE_TYPES)) {
            expect(OBJECTIVE_FIELDS[type]).toBeDefined();
        }
    });

    test('and every field it asks for has a property in the schema', () => {
        for (const fields of Object.values(OBJECTIVE_FIELDS)) {
            for (const field of fields) {
                expect(objective.properties[field.writes]).toBeDefined();
            }
        }
    });
});

describe('the author writes names, never internal ids', () => {
    const objective = buildCampaignPackSchema()
        .properties.quests.items.properties.objectives.items;

    // A book cannot know a Lorebook uid: it does not exist until the pack is imported.
    // Asking for one is asking the author to invent something that will match nothing.
    test('the schema never asks for targetIds, allyId or treasureIds', () => {
        for (const forbidden of ['targetIds', 'allyId', 'treasureIds']) {
            expect(objective.properties[forbidden]).toBeUndefined();
        }
    });

    test('it asks for target, ally and treasures instead', () => {
        expect(objective.properties.target).toBeDefined();
        expect(objective.properties.ally).toBeDefined();
        expect(objective.properties.treasures).toBeDefined();
    });

    // The engine reasons in optional objectives. `required` was in the original draft and
    // would have been read as nothing at all.
    test('it asks for optional, not required', () => {
        expect(objective.properties.optional).toBeDefined();
        expect(objective.properties.required).toBeUndefined();
    });

    test('each field maps to the engine field it will become', () => {
        expect(OBJECTIVE_FIELDS.eliminate[0]).toMatchObject({ writes: 'target', engineField: 'targetIds' });
        expect(OBJECTIVE_FIELDS.protect[0]).toMatchObject({ writes: 'ally', engineField: 'allyId' });
        expect(OBJECTIVE_FIELDS.loot[0]).toMatchObject({ writes: 'treasures', engineField: 'treasureIds' });
    });
});

describe('the sections', () => {
    test('there is one schema per section of the pack', () => {
        for (const section of SECTION_ORDER) {
            expect(getSectionSchema(section)).not.toBeNull();
        }
    });

    // A book does not fit in one answer, so a pack is produced section by section.
    test('the recommended order puts what others reference first', () => {
        expect(SECTION_ORDER.indexOf('bestiary')).toBeLessThan(SECTION_ORDER.indexOf('boards'));
        expect(SECTION_ORDER.indexOf('boards')).toBeLessThan(SECTION_ORDER.indexOf('quests'));
        expect(SECTION_ORDER.indexOf('confidants')).toBeLessThan(SECTION_ORDER.indexOf('quests'));
    });

    test('an unknown section is null rather than an empty object', () => {
        expect(getSectionSchema('inventado')).toBeNull();
        expect(getSectionSchema('')).toBeNull();
    });

    test('the whole pack carries its contract version', () => {
        expect(buildCampaignPackSchema().properties.version.const).toBe(CAMPAIGN_PACK_VERSION);
    });
});

describe('the rules a JSON Schema cannot express', () => {
    const rules = getPackRules().join(' ');

    // Cross-references are where a generated pack really fails, not in one field's shape.
    test('cover the cross-references between sections', () => {
        expect(rules).toMatch(/boardId/);
        expect(rules).toMatch(/bestiario/);
    });

    test('warn about duplicate names, which the Lorebook would collapse', () => {
        expect(rules).toMatch(/repetir|repetidos/);
    });

    test('state the two board rules that have already been broken once', () => {
        expect(rules).toMatch(/borde/);
        expect(rules).toMatch(/partyStart|transitable/);
    });

    test('say plainly that names go in, not ids', () => {
        expect(rules).toMatch(/nombres/);
    });
});

describe('the text you paste into the Gem', () => {
    const text = buildGemInstructions();

    test('carries the schema, the rules and the legend', () => {
        expect(text).toContain('eliminate_all');
        for (const rule of getPackRules()) {
            expect(text).toContain(rule);
        }
        expect(text).toContain('muro');
    });

    test('states the version it was generated against', () => {
        expect(text).toContain(String(CAMPAIGN_PACK_VERSION));
    });

    test('holds valid JSON inside its code fence', () => {
        const json = text.split('```json')[1].split('```')[0];
        expect(() => JSON.parse(json)).not.toThrow();
    });
});

describe('the example pack', () => {
    const pack = buildExamplePack();

    test('is written against the current contract', () => {
        expect(pack.version).toBe(CAMPAIGN_PACK_VERSION);
    });

    // An example that only covers the easy cases teaches the easy cases.
    test('exercises the awkward parts: two boards, a cross-reference and an optional', () => {
        expect(pack.boards.length).toBeGreaterThanOrEqual(2);
        expect(pack.quests.some(q => q.objectives.some(o => o.optional))).toBe(true);
        expect(pack.quests.some(q => q.objectives.some(o => o.type === 'protect'))).toBe(true);
    });

    test('every quest names a board that exists', () => {
        const ids = new Set(pack.boards.map(b => b.id));
        for (const quest of pack.quests) {
            expect(ids.has(quest.boardId)).toBe(true);
        }
    });

    test('every enemy placed on a board exists in the bestiary', () => {
        const known = new Set(pack.bestiary.map(e => e.name));
        for (const board of pack.boards) {
            for (const enemy of board.enemies ?? []) {
                expect(known.has(enemy.name)).toBe(true);
            }
        }
    });

    test('every eliminate target is a creature from the bestiary', () => {
        const known = new Set(pack.bestiary.map(e => e.name));
        for (const quest of pack.quests) {
            for (const objective of quest.objectives) {
                if (objective.type === 'eliminate') expect(known.has(objective.target)).toBe(true);
            }
        }
    });

    test('every protected ally is one of the companions', () => {
        const known = new Set(pack.confidants.map(c => c.name));
        for (const quest of pack.quests) {
            for (const objective of quest.objectives) {
                if (objective.type === 'protect') expect(known.has(objective.ally)).toBe(true);
            }
        }
    });

    test('no name is used twice, since the Lorebook indexes by name', () => {
        const names = [...pack.bestiary.map(e => e.name), ...pack.confidants.map(c => c.name)];
        expect(new Set(names).size).toBe(names.length);
    });

    // The mistake that put two characters inside a wall, checked on the example itself.
    test('every board is rectangular, sealed, and starts the party on floor', () => {
        for (const board of pack.boards) {
            const widths = new Set(board.map.map(row => row.length));
            expect(widths.size).toBe(1);

            const width = board.map[0].length;
            const height = board.map.length;
            expect(width).toBeGreaterThanOrEqual(BOARD_LIMITS.minWidth);
            expect(height).toBeGreaterThanOrEqual(BOARD_LIMITS.minHeight);

            expect(/^#+$/.test(board.map[0])).toBe(true);
            expect(/^#+$/.test(board.map[height - 1])).toBe(true);
            for (const row of board.map) {
                expect(row.startsWith('#') && row.endsWith('#')).toBe(true);
            }

            for (const start of board.partyStart) {
                expect(board.map[start.y][start.x]).toBe('.');
            }
        }
    });

    test('uses only characters the board understands', () => {
        const allowed = new Set(['.', ...Object.keys(ASCII_TERRAIN)]);
        for (const board of pack.boards) {
            for (const row of board.map) {
                for (const char of row) expect(allowed.has(char)).toBe(true);
            }
        }
    });

    test('uses only tactical profiles the enemy AI knows', () => {
        const profiles = new Set(getProfileOptions().map(([value]) => value));
        for (const enemy of pack.bestiary) {
            expect(profiles.has(enemy.profile)).toBe(true);
        }
    });

    test('uses only objective types the engine judges', () => {
        for (const quest of pack.quests) {
            for (const objective of quest.objectives) {
                expect(OBJECTIVE_TYPES[objective.type]).toBeDefined();
            }
        }
    });
});
