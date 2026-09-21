import { describe, test, expect } from '@jest/globals';
import {
    STARTER_TEMPLATES, getTemplate, getTemplateSize, buildWorldMetadata,
    buildWorldEntries, getTemplateOptions,
} from '../public/scripts/game-engine/campaign/starter-templates.js';
import { isPassable, getCell } from '../public/scripts/game-engine/board/terrain.js';
import { findPath } from '../public/scripts/game-engine/board/pathfinding.js';
import { TACTICAL_PROFILES } from '../public/scripts/game-engine/combat/enemy-ai.js';

describe('the templates themselves', () => {
    test('every template has the fields the wizard needs', () => {
        for (const template of STARTER_TEMPLATES) {
            expect(typeof template.id).toBe('string');
            expect(template.name.length).toBeGreaterThan(0);
            expect(template.description.length).toBeGreaterThan(0);
            expect(template.locationName.length).toBeGreaterThan(0);
            expect(template.boardName.length).toBeGreaterThan(0);
            expect(Array.isArray(template.partyStart)).toBe(true);
            expect(template.partyStart.length).toBeGreaterThan(0);
        }
    });

    test('ids are unique', () => {
        const ids = STARTER_TEMPLATES.map(t => t.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    test('every monster declares a profile the AI knows', () => {
        for (const template of STARTER_TEMPLATES) {
            for (const enemy of template.enemies) {
                expect(TACTICAL_PROFILES[enemy.profile]).toBeDefined();
            }
        }
    });

    test('getTemplate finds one by id and refuses an unknown one', () => {
        expect(getTemplate('dungeon').id).toBe('dungeon');
        expect(getTemplate('atlantis')).toBeNull();
    });
});

describe('getTemplateSize', () => {
    test('derives the board size from the layout', () => {
        expect(getTemplateSize(getTemplate('dungeon'))).toEqual({ gridWidth: 16, gridHeight: 10 });
    });

    test('a blank template still gets a usable board', () => {
        const size = getTemplateSize(getTemplate('blank'));
        expect(size.gridWidth).toBeGreaterThan(5);
        expect(size.gridHeight).toBeGreaterThan(5);
    });
});

describe('buildWorldMetadata', () => {
    test('produces one location holding one board', () => {
        const meta = buildWorldMetadata(getTemplate('dungeon'));
        expect(meta.locationMaps).toHaveLength(1);
        expect(meta.locationMaps[0].boards).toHaveLength(1);
        expect(meta.locationMaps[0].name).toBe('Cripta olvidada');
        expect(meta.locationMaps[0].boards[0].name).toBe('Sala de entrada');
    });

    test('the board arrives with terrain already painted', () => {
        const board = buildWorldMetadata(getTemplate('dungeon')).locationMaps[0].boards[0];
        expect(Object.keys(board.terrain.cells).length).toBeGreaterThan(20);
        expect(getCell(board.terrain, 0, 0).type).toBe('wall');
    });

    test('the board is walled in, so nothing walks off the edge', () => {
        const { gridWidth, gridHeight } = getTemplateSize(getTemplate('dungeon'));
        const board = buildWorldMetadata(getTemplate('dungeon')).locationMaps[0].boards[0];
        for (let x = 0; x < gridWidth; x++) {
            expect(isPassable(board.terrain, x, 0, gridWidth, gridHeight)).toBe(false);
        }
    });

    // A board with no walls cannot show what the tactical engine does.
    test('the combat templates have something to walk around', () => {
        for (const template of STARTER_TEMPLATES.filter(t => t.enemies.length > 0)) {
            const board = buildWorldMetadata(template).locationMaps[0].boards[0];
            const walls = Object.values(board.terrain.cells).filter(c => c.type === 'wall');
            expect(walls.length).toBeGreaterThan(10);
        }
    });

    test('a template with monsters is marked as a combat board', () => {
        expect(buildWorldMetadata(getTemplate('dungeon')).locationMaps[0].boards[0].isCombat).toBe(true);
        expect(buildWorldMetadata(getTemplate('tavern')).locationMaps[0].boards[0].isCombat).toBe(false);
    });

    test('overrides win over the template defaults', () => {
        const meta = buildWorldMetadata(getTemplate('dungeon'), {
            displayName: 'Mi mundo', genre: 'Terror', description: 'Oscuro.',
        });
        expect(meta.displayName).toBe('Mi mundo');
        expect(meta.genre).toBe('Terror');
        expect(meta.description).toBe('Oscuro.');
    });

    test('empty overrides fall back to the template', () => {
        const meta = buildWorldMetadata(getTemplate('dungeon'), { displayName: '   ', description: '' });
        expect(meta.displayName).toBe('Mazmorra clásica');
        expect(meta.description.length).toBeGreaterThan(0);
    });

    test('the blank template gives an open board', () => {
        const board = buildWorldMetadata(getTemplate('blank')).locationMaps[0].boards[0];
        expect(board.terrain.cells).toEqual({});
    });
});

describe('the party starts somewhere sensible', () => {
    // The first thing a new campaign shows must not be a character stuck in a wall.
    test('nobody starts inside a wall', () => {
        for (const template of STARTER_TEMPLATES) {
            const { gridWidth, gridHeight } = getTemplateSize(template);
            const board = buildWorldMetadata(template).locationMaps[0].boards[0];
            for (const start of template.partyStart) {
                expect(isPassable(board.terrain, start.x, start.y, gridWidth, gridHeight)).toBe(true);
            }
        }
    });

    test('the party can walk to each other', () => {
        for (const template of STARTER_TEMPLATES) {
            const { gridWidth, gridHeight } = getTemplateSize(template);
            const board = buildWorldMetadata(template).locationMaps[0].boards[0];
            const [first, ...rest] = template.partyStart;
            for (const other of rest) {
                const path = findPath(
                    board.terrain, first.x, first.y, other.x, other.y, gridWidth, gridHeight,
                );
                expect(path).not.toBeNull();
            }
        }
    });
});

describe('buildWorldEntries', () => {
    test('one entry per party member, in the Characters group', () => {
        const entries = buildWorldEntries(getTemplate('dungeon'), ['Lyra', 'Brand']);
        const characters = entries.filter(e => e.group === 'Characters');
        expect(characters.map(e => e.title)).toEqual(['Lyra', 'Brand']);
    });

    test('party members are placed at the template start cells', () => {
        const entries = buildWorldEntries(getTemplate('dungeon'), ['Lyra', 'Brand']);
        const lyra = entries.find(e => e.title === 'Lyra');
        expect(lyra.dndData.mapPosition).toEqual({
            locationName: 'Cripta olvidada', gridX: 2, gridY: 8,
        });
    });

    test('more party members than start cells still all get placed', () => {
        const entries = buildWorldEntries(getTemplate('dungeon'), ['A', 'B', 'C', 'D', 'E', 'F']);
        const characters = entries.filter(e => e.group === 'Characters');
        expect(characters).toHaveLength(6);
        for (const entry of characters) {
            expect(entry.dndData.mapPosition).toBeDefined();
        }
    });

    test('one entry per monster, in the Monsters group', () => {
        const entries = buildWorldEntries(getTemplate('dungeon'), ['Lyra']);
        const monsters = entries.filter(e => e.group === 'Monsters');
        expect(monsters).toHaveLength(2);
        expect(monsters[0].dndData.profile).toBeDefined();
    });

    test('blank and junk names are dropped', () => {
        const entries = buildWorldEntries(getTemplate('dungeon'), ['Lyra', '', '   ', null]);
        expect(entries.filter(e => e.group === 'Characters')).toHaveLength(1);
    });

    test('every entry has a key, so world info can match it', () => {
        for (const entry of buildWorldEntries(getTemplate('dungeon'), ['Lyra'])) {
            expect(entry.keys.length).toBeGreaterThan(0);
            expect(entry.keys[0]).toBe(entry.title);
        }
    });

    test('a template with no monsters yields only characters', () => {
        const entries = buildWorldEntries(getTemplate('tavern'), ['Lyra']);
        expect(entries.every(e => e.group === 'Characters')).toBe(true);
    });
});

describe('getTemplateOptions', () => {
    test('offers every template to the picker', () => {
        const options = getTemplateOptions();
        expect(options).toHaveLength(STARTER_TEMPLATES.length);
        expect(options[0]).toHaveProperty('name');
        expect(options[0]).toHaveProperty('description');
    });
});
