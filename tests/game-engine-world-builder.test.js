import { describe, test, expect, jest } from '@jest/globals';
import {
    WORLD_JSON_SCHEMA,
    buildWorldPrompt,
    normalizeMap,
    findPartyStart,
    normalizeGeneratedWorld,
    generateWorld,
} from '../public/scripts/game-engine/world-builder/world-schema.js';
import { buildWorldMetadata, buildWorldEntries } from '../public/scripts/game-engine/campaign/starter-templates.js';
import { isCampaignWorld, getStartingPoint } from '../public/scripts/game-engine/campaign/campaign-worlds.js';
import { isPassable } from '../public/scripts/game-engine/board/terrain.js';

/** A well-formed answer, as a cooperative model would return it. */
const GOOD = {
    name: 'Cripta de Sal',
    genre: 'Terror gótico',
    description: 'Una cripta inundada bajo una iglesia.',
    locationName: 'Cripta de Sal',
    boardName: 'Nave anegada',
    map: [
        '##########',
        '#........#',
        '#..##..~.#',
        '#...c....#',
        '#........#',
        '##########',
    ],
    enemies: [
        { name: 'Ghoul', hp: 22, armorClass: 12, cr: 1, profile: 'aggressive' },
        { name: 'Acólito', hp: 9, armorClass: 10, cr: 0.25, profile: 'skirmisher', attackRangeFeet: 60 },
    ],
};

describe('the schema sent to the model', () => {
    test('asks for everything a template needs to be playable', () => {
        for (const field of ['name', 'genre', 'description', 'locationName', 'boardName', 'map', 'enemies']) {
            expect(WORLD_JSON_SCHEMA.value.required).toContain(field);
        }
    });

    test('restricts tactical profiles to the ones the combat engine knows', () => {
        const profiles = WORLD_JSON_SCHEMA.value.properties.enemies.items.properties.profile.enum;
        expect(profiles).toEqual(['aggressive', 'skirmisher', 'guardian', 'coward']);
    });

    test('tells the model which map characters exist', () => {
        const description = WORLD_JSON_SCHEMA.value.properties.map.description;
        for (const char of ['#', 'D', '~', 'c', 'C']) {
            expect(description).toContain(char);
        }
    });
});

describe('buildWorldPrompt', () => {
    test('carries the player idea into the prompt', () => {
        const { prompt } = buildWorldPrompt('una ciudad flotante de dirigibles');
        expect(prompt).toContain('una ciudad flotante de dirigibles');
    });

    test('still asks for a world when the player wrote nothing', () => {
        const { prompt } = buildWorldPrompt('');
        expect(prompt.length).toBeGreaterThan(10);
    });

    // The map is walked on, so the instructions have to say so.
    test('the system prompt states the board rules', () => {
        const { systemPrompt } = buildWorldPrompt('algo');
        expect(systemPrompt).toContain('muro');
        expect(systemPrompt).toMatch(/filas/i);
    });

    test('an enormous idea is truncated rather than sent whole', () => {
        const { prompt } = buildWorldPrompt('x'.repeat(5000));
        expect(prompt.length).toBeLessThan(700);
    });
});

describe('normalizeMap', () => {
    test('squares off rows of different lengths, and says so', () => {
        const { map, warnings } = normalizeMap(['########', '#..#', '########']);
        expect(new Set(map.map(r => r.length)).size).toBe(1);
        expect(warnings.join(' ')).toMatch(/no medían lo mismo/);
    });

    test('seals the outer edge, so the party cannot walk off the board', () => {
        const { map } = normalizeMap(['........', '........', '........', '........', '........', '........']);
        expect(map[0]).toBe('########');
        expect(map[map.length - 1]).toBe('########');
        for (const row of map) {
            expect(row.startsWith('#')).toBe(true);
            expect(row.endsWith('#')).toBe(true);
        }
    });

    test('an unknown symbol becomes floor instead of losing the whole map', () => {
        const { map, warnings } = normalizeMap(['########', '#..XY..#', '#......#', '#......#', '#......#', '########']);
        expect(map[1]).toBe('#......#');
        expect(warnings.join(' ')).toMatch(/símbolo desconocido/);
    });

    test('keeps the terrain characters the board understands', () => {
        const { map } = normalizeMap(['##########', '#..D~cC..#', '#........#', '#........#', '#........#', '##########']);
        expect(map[1]).toContain('D');
        expect(map[1]).toContain('~');
        expect(map[1]).toContain('c');
        expect(map[1]).toContain('C');
    });

    test('an empty or junk map is reported rather than guessed at', () => {
        expect(normalizeMap([]).map).toEqual([]);
        expect(normalizeMap(null).map).toEqual([]);
        expect(normalizeMap('no soy un mapa').map).toEqual([]);
        expect(normalizeMap([]).warnings.length).toBeGreaterThan(0);
    });

    test('an oversized map is cut down to what fits on screen', () => {
        const huge = Array.from({ length: 60 }, () => '.'.repeat(120));
        const { map } = normalizeMap(huge);
        expect(map.length).toBeLessThanOrEqual(24);
        expect(map[0].length).toBeLessThanOrEqual(30);
    });
});

describe('findPartyStart', () => {
    const map = ['########', '#......#', '#.####.#', '#......#', '########'];

    test('only returns cells that are plain floor', () => {
        for (const { x, y } of findPartyStart(map, 4)) {
            expect(map[y][x]).toBe('.');
        }
    });

    test('never returns the edge, which is always wall', () => {
        for (const { x, y } of findPartyStart(map, 6)) {
            expect(x).toBeGreaterThan(0);
            expect(y).toBeGreaterThan(0);
            expect(y).toBeLessThan(map.length - 1);
        }
    });

    test('a map with no floor yields nowhere to stand', () => {
        expect(findPartyStart(['####', '####', '####'], 2)).toEqual([]);
    });

    test('returns as many cells as asked for when there is room', () => {
        expect(findPartyStart(map, 3)).toHaveLength(3);
    });
});

describe('normalizeGeneratedWorld', () => {
    test('a good answer becomes a template ready to build a world from', () => {
        const { template, errors } = normalizeGeneratedWorld(GOOD, 2);
        expect(errors).toEqual([]);
        expect(template).toMatchObject({
            name: 'Cripta de Sal',
            locationName: 'Cripta de Sal',
            boardName: 'Nave anegada',
        });
        expect(template.enemies).toHaveLength(2);
    });

    // The bug that put two characters inside a wall, checked at its source this time.
    test('every starting cell is somewhere a character can actually stand', () => {
        const { template } = normalizeGeneratedWorld(GOOD, 2);
        const board = buildWorldMetadata(template).locationMaps[0].boards[0];
        expect(template.partyStart.length).toBeGreaterThan(0);
        for (const { x, y } of template.partyStart) {
            expect(isPassable(board.terrain, x, y, board.gridWidth, board.gridHeight)).toBe(true);
        }
    });

    test('an invented tactical profile is replaced by a real one, with a warning', () => {
        const { template, warnings } = normalizeGeneratedWorld({
            ...GOOD,
            enemies: [{ name: 'Cosa', hp: 10, armorClass: 12, cr: 1, profile: 'berserker_supremo' }],
        });
        expect(['aggressive', 'skirmisher', 'guardian', 'coward']).toContain(template.enemies[0].profile);
        expect(warnings.join(' ')).toMatch(/perfil táctico/);
    });

    test('absurd statistics are clamped instead of reaching the board', () => {
        const { template } = normalizeGeneratedWorld({
            ...GOOD,
            enemies: [{ name: 'Dios', hp: 99999, armorClass: 400, cr: 900, profile: 'aggressive' }],
        });
        expect(template.enemies[0].hp).toBeLessThanOrEqual(60);
        expect(template.enemies[0].armorClass).toBeLessThanOrEqual(20);
        expect(template.enemies[0].cr).toBeLessThanOrEqual(5);
    });

    test('two enemies with the same name are separated, since the Lorebook keys by name', () => {
        const { template } = normalizeGeneratedWorld({
            ...GOOD,
            enemies: [
                { name: 'Ghoul', hp: 10, armorClass: 12, cr: 1, profile: 'aggressive' },
                { name: 'Ghoul', hp: 10, armorClass: 12, cr: 1, profile: 'aggressive' },
            ],
        });
        expect(new Set(template.enemies.map(e => e.name)).size).toBe(2);
    });

    test('missing text fields fall back instead of producing an unnamed world', () => {
        const { template } = normalizeGeneratedWorld({ map: GOOD.map, enemies: [] });
        expect(template.name).toBeTruthy();
        expect(template.locationName).toBeTruthy();
        expect(template.boardName).toBeTruthy();
    });

    test('a board with no enemies is allowed, and says so', () => {
        const { template, warnings, errors } = normalizeGeneratedWorld({ ...GOOD, enemies: [] });
        expect(errors).toEqual([]);
        expect(template.enemies).toEqual([]);
        expect(warnings.join(' ')).toMatch(/ningún enemigo/);
    });

    test('an unusable map is an error, not a repaired guess', () => {
        expect(normalizeGeneratedWorld({ ...GOOD, map: [] }).template).toBeNull();
        expect(normalizeGeneratedWorld({ ...GOOD, map: [] }).errors.length).toBeGreaterThan(0);
    });

    test('a solid block of wall has nowhere to put the party', () => {
        const walls = Array.from({ length: 8 }, () => '#'.repeat(10));
        const { template, errors } = normalizeGeneratedWorld({ ...GOOD, map: walls });
        expect(template).toBeNull();
        expect(errors.join(' ')).toMatch(/casilla libre/);
    });

    test('junk in place of an object is refused without throwing', () => {
        for (const value of [null, undefined, 'texto', 42, []]) {
            const result = normalizeGeneratedWorld(value);
            expect(result.template).toBeNull();
            expect(result.errors.length).toBeGreaterThan(0);
        }
    });

    // The whole point: a generated world walks the same path as a hand-written one.
    test('what it returns feeds the same builders the templates use', () => {
        const { template } = normalizeGeneratedWorld(GOOD, 2);
        const metadata = buildWorldMetadata(template);

        expect(isCampaignWorld(metadata)).toBe(true);
        expect(getStartingPoint(metadata)).toEqual({
            locationName: template.locationName,
            boardName: template.boardName,
        });

        const entries = buildWorldEntries(template, ['Lyra', 'Brand']);
        expect(entries.filter(e => e.group === 'Characters')).toHaveLength(2);
        expect(entries.filter(e => e.group === 'Monsters')).toHaveLength(2);
    });
});

describe('generateWorld', () => {
    const answer = () => JSON.stringify(GOOD);

    test('asks the injected generator, not any particular provider', async () => {
        const generate = jest.fn(async () => answer());
        const result = await generateWorld({ idea: 'una cripta', partySize: 2, generate });

        expect(generate).toHaveBeenCalledTimes(1);
        const params = generate.mock.calls[0][0];
        expect(params.jsonSchema).toBe(WORLD_JSON_SCHEMA);
        expect(params.prompt).toContain('una cripta');
        expect(result.template.name).toBe('Cripta de Sal');
    });

    test('accepts an already-parsed object, as some backends return', async () => {
        const result = await generateWorld({ idea: 'x', generate: async () => GOOD });
        expect(result.template.name).toBe('Cripta de Sal');
    });

    // Every failure below has to leave the wizard usable: the templates are the floor.
    test('prose instead of JSON is an error, not a crash', async () => {
        const result = await generateWorld({ idea: 'x', generate: async () => 'Claro, aquí tienes tu mundo:' });
        expect(result.template).toBeNull();
        expect(result.errors.join(' ')).toMatch(/JSON/);
    });

    test('a provider that throws is reported, not propagated', async () => {
        const result = await generateWorld({
            idea: 'x',
            generate: async () => { throw new Error('401 sin clave'); },
        });
        expect(result.template).toBeNull();
        expect(result.errors.join(' ')).toContain('401 sin clave');
    });

    test('valid JSON that is not a world is refused', async () => {
        const result = await generateWorld({ idea: 'x', generate: async () => '{"hola":"mundo"}' });
        expect(result.template).toBeNull();
    });

    test('a half-usable answer still yields a playable world plus warnings', async () => {
        const sloppy = { ...GOOD, map: ['####', '#..#', '#..#'], enemies: [{ name: 'X' }] };
        const result = await generateWorld({ idea: 'x', generate: async () => JSON.stringify(sloppy) });
        expect(result.template).not.toBeNull();
        expect(result.warnings.length).toBeGreaterThan(0);
    });
});
