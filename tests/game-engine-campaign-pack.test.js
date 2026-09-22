import { describe, test, expect } from '@jest/globals';
import { validatePack, normalizePack } from '../public/scripts/game-engine/campaign/campaign-pack.js';
import { buildExamplePack, CAMPAIGN_PACK_VERSION } from '../public/scripts/game-engine/campaign/campaign-pack-schema.js';

/** A minimal pack that passes, to break on purpose one piece at a time. */
const good = () => ({
    version: CAMPAIGN_PACK_VERSION,
    world: { name: 'Mundo' },
    confidants: [{ name: 'Mira' }],
    bestiary: [{ name: 'Cuervo', hp: 7, armorClass: 12, cr: 0.125 }],
    boards: [{
        id: 'sala', name: 'Sala', locationName: 'Mundo',
        map: ['#####', '#...#', '#...#', '#####'],
        partyStart: [{ x: 1, y: 2 }],
        enemies: [{ name: 'Cuervo', x: 3, y: 1 }],
    }],
    quests: [{
        id: 'q1', name: 'Mision', boardId: 'sala',
        objectives: [{ type: 'eliminate', label: 'Matar al cuervo', target: 'Cuervo' }],
    }],
});

const paths = (issues) => issues.map(i => i.path);

describe('the example the contract publishes', () => {
    // If the sample the Gem is told to imitate did not validate, everything downstream
    // would be arguing with itself.
    test('validates clean', () => {
        const report = validatePack(buildExamplePack());
        expect(report.errors).toEqual([]);
        expect(report.warnings).toEqual([]);
        expect(report.ok).toBe(true);
    });

    test('and is counted correctly', () => {
        expect(validatePack(buildExamplePack()).counts)
            .toEqual({ world: 'El Molino de los Cuervos', boards: 2, enemies: 2, confidants: 1, quests: 2, objectives: 4 });
    });
});

describe('the pack as a whole', () => {
    test('a minimal correct pack passes', () => {
        expect(validatePack(good()).ok).toBe(true);
    });

    test('nothing at all is refused, not crashed', () => {
        expect(validatePack(null).ok).toBe(false);
        expect(validatePack(undefined).ok).toBe(false);
        expect(validatePack('{}').ok).toBe(false);
        expect(paths(validatePack({}).errors)).toEqual(['world.name', 'boards']);
    });

    test('a pack written against another contract version warns but still imports', () => {
        const report = validatePack({ ...good(), version: 99 });
        expect(report.ok).toBe(true);
        expect(paths(report.warnings)).toContain('version');
    });
});

describe('the cross-references the schema cannot see', () => {
    test('a quest pointing at a board that is not there', () => {
        const pack = good();
        pack.quests[0].boardId = 'inexistente';
        const report = validatePack(pack);
        expect(report.ok).toBe(false);
        expect(report.errors[0].message).toMatch(/"inexistente" no existe/);
    });

    test('a quest that does not say where it is played', () => {
        const pack = good();
        delete pack.quests[0].boardId;
        expect(paths(validatePack(pack).errors)).toContain('quests[0].boardId');
    });

    test('an enemy on the board that is not in the bestiary', () => {
        const pack = good();
        pack.boards[0].enemies[0].name = 'Lobo';
        expect(validatePack(pack).errors[0].message).toMatch(/"Lobo" no esta en el bestiario/);
    });

    test('an eliminate objective naming somebody outside the bestiary', () => {
        const pack = good();
        pack.quests[0].objectives[0].target = 'Nadie';
        expect(paths(validatePack(pack).errors)).toContain('quests[0].objectives[0].target');
    });

    // The mistake worth naming: the ally is real, but it was looked for in the wrong list.
    test('and says which list the name is actually in', () => {
        const pack = good();
        pack.quests[0].objectives[0].target = 'Mira';
        expect(validatePack(pack).errors[0].message).toMatch(/esta en `confidants`/);
    });

    test('a protect objective naming somebody who is not a companion', () => {
        const pack = good();
        pack.quests[0].objectives = [{ type: 'protect', label: 'Cuidar', ally: 'Cuervo' }];
        expect(validatePack(pack).errors[0].message).toMatch(/no esta en confidants: esta en `bestiary`/);
    });

    test('two companions with the same name, which the Lorebook would merge', () => {
        const pack = good();
        pack.confidants.push({ name: 'mira' });
        expect(validatePack(pack).errors[0].message).toMatch(/repetido/);
    });

    test('two boards with the same id', () => {
        const pack = good();
        pack.boards.push({ ...pack.boards[0] });
        expect(paths(validatePack(pack).errors)).toContain('boards[1].id');
    });

    test('a board nobody sends you to is only a warning', () => {
        const pack = good();
        pack.boards.push({ ...pack.boards[0], id: 'otra', name: 'Otra' });
        const report = validatePack(pack);
        expect(report.ok).toBe(true);
        expect(report.warnings[0].message).toMatch(/Ninguna mision lleva a "otra"/);
    });
});

describe('the maps', () => {
    // The one that looks like nothing: a row one character short shifts every wall after
    // it and the board quietly stops making sense.
    test('a map whose rows are not all the same length', () => {
        const pack = good();
        pack.boards[0].map = ['#####', '#..#', '#...#', '#####'];
        expect(validatePack(pack).errors[0].message).toMatch(/Las filas no miden lo mismo/);
    });

    test('a map with a hole in the outer wall', () => {
        const pack = good();
        pack.boards[0].map = ['#####', '#...#', '#....', '#####'];
        expect(validatePack(pack).errors[0].message).toMatch(/borde exterior tiene que ser todo muro/);
    });

    test('a character that is not in the legend', () => {
        const pack = good();
        pack.boards[0].map = ['#####', '#.X.#', '#...#', '#####'];
        expect(validatePack(pack).errors[0].message).toMatch(/Caracter "X"/);
    });

    test('a map too small to have an inside', () => {
        const pack = good();
        pack.boards[0].map = ['###', '###'];
        expect(validatePack(pack).errors[0].message).toMatch(/al menos tres filas/);
    });

    test('the legend characters that are not walls are walkable', () => {
        const pack = good();
        pack.boards[0].map = ['#####', '#cD~#', '#...#', '#####'];
        pack.boards[0].partyStart = [{ x: 1, y: 1 }];
        pack.boards[0].enemies = [{ name: 'Cuervo', x: 3, y: 1 }];
        expect(validatePack(pack).ok).toBe(true);
    });
});

describe('where things stand on the board', () => {
    test('the party starting inside a wall', () => {
        const pack = good();
        pack.boards[0].partyStart = [{ x: 0, y: 0 }];
        expect(validatePack(pack).errors[0].message).toMatch(/sobre un muro/);
    });

    test('the party starting off the map', () => {
        const pack = good();
        pack.boards[0].partyStart = [{ x: 40, y: 2 }];
        expect(validatePack(pack).errors[0].message).toMatch(/fuera del mapa, que mide 5x4/);
    });

    test('a board with nowhere for the party to stand', () => {
        const pack = good();
        pack.boards[0].partyStart = [];
        expect(paths(validatePack(pack).errors)).toContain('boards[0].partyStart');
    });

    test('an enemy standing in a wall', () => {
        const pack = good();
        pack.boards[0].enemies = [{ name: 'Cuervo', x: 0, y: 1 }];
        expect(validatePack(pack).errors[0].message).toMatch(/sobre un muro/);
    });

    test('a reach_cell objective pointing into a wall', () => {
        const pack = good();
        pack.quests[0].objectives = [{ type: 'reach_cell', label: 'Llegar', cell: { x: 0, y: 0 } }];
        expect(validatePack(pack).errors[0].message).toMatch(/nadie puede llegar ahi/);
    });
});

describe('the objectives', () => {
    test('a type the engine does not judge', () => {
        const pack = good();
        pack.quests[0].objectives = [{ type: 'convencer_al_rey', label: 'Hablar' }];
        expect(validatePack(pack).errors[0].message).toMatch(/no es un tipo de objetivo/);
    });

    test('survive_rounds without a number of rounds', () => {
        const pack = good();
        pack.quests[0].objectives = [{ type: 'survive_rounds', label: 'Aguantar' }];
        expect(validatePack(pack).errors[0].message).toMatch(/numero mayor que cero/);
        pack.quests[0].objectives = [{ type: 'survive_rounds', label: 'Aguantar', rounds: 0 }];
        expect(validatePack(pack).ok).toBe(false);
    });

    test('eliminate_all asks for nothing else', () => {
        const pack = good();
        pack.quests[0].objectives = [{ type: 'eliminate_all', label: 'Despejar' }];
        expect(validatePack(pack).ok).toBe(true);
    });

    test('a quest with no objectives is playable, and says so', () => {
        const pack = good();
        pack.quests[0].objectives = [];
        const report = validatePack(pack);
        expect(report.ok).toBe(true);
        expect(report.warnings[0].message).toMatch(/limpiando el tablero/);
    });
});

describe('what normalising puts right, out loud', () => {
    test('a board or a quest with no id gets one from its name', () => {
        const pack = good();
        delete pack.boards[0].id;
        delete pack.quests[0].id;
        pack.quests[0].boardId = 'sala';
        const { pack: fixed, repairs } = normalizePack(pack);
        expect(fixed.boards[0].id).toBe('sala');
        expect(fixed.quests[0].id).toBe('mision');
        expect(repairs).toHaveLength(2);
        expect(repairs[0].message).toMatch(/derivado del nombre/);
    });

    test('accents and punctuation do not end up in an id', () => {
        const { pack } = normalizePack({ boards: [{ name: 'El sótano, por fin' }] });
        expect(pack.boards[0].id).toBe('el_sotano_por_fin');
    });

    // The field authors reach for that the contract does not have.
    test('`required` is dropped, and reported', () => {
        const pack = good();
        pack.quests[0].objectives[0].required = true;
        const report = validatePack(pack);
        expect(report.ok).toBe(true);
        expect(report.repairs[0].message).toMatch(/solo tiene `optional`/);
        expect(normalizePack(pack).pack.quests[0].objectives[0]).not.toHaveProperty('required');
    });

    test('a truthy `optional` becomes a boolean', () => {
        const pack = good();
        pack.quests[0].objectives[0].optional = 'si';
        expect(normalizePack(pack).pack.quests[0].objectives[0].optional).toBe(true);
    });

    test('a board with no location falls back to the world', () => {
        const pack = good();
        delete pack.boards[0].locationName;
        expect(normalizePack(pack).pack.boards[0].locationName).toBe('Mundo');
    });

    test('junk in the lists is dropped rather than carried', () => {
        const { pack } = normalizePack({ world: { name: 'M' }, bestiary: [null, false], boards: 'no', quests: [undefined] });
        expect(pack.bestiary).toEqual([]);
        expect(pack.boards).toEqual([]);
        expect(pack.quests).toEqual([]);
    });
});

describe('el perfil tactico, que el motor cambia en silencio si no lo conoce', () => {
    test('un perfil inventado se avisa, con los que si existen', () => {
        const pack = normalizePack({
            version: 1,
            world: { name: 'Mundo' },
            bestiary: [{ name: 'Francotirador', hp: 10, armorClass: 12, profile: 'sniper' }],
            boards: [{ id: 'b', name: 'B', map: ['####', '#..#', '####'], partyStart: [{ x: 1, y: 1 }], enemies: [] }],
            quests: [],
        }).pack;

        const report = validatePack(pack);
        const warning = report.warnings.find(w => w.path === 'bestiary[0].profile');
        expect(warning).toBeDefined();
        expect(warning.message).toMatch(/aggressive/);
        // Avisa, no bloquea: el paquete se juega igual, solo que sabiendo que se juega.
        expect(report.ok).toBe(true);
    });

    test('y uno de verdad no se avisa', () => {
        const pack = normalizePack({
            version: 1,
            world: { name: 'Mundo' },
            bestiary: [{ name: 'Lobo', hp: 10, armorClass: 12, profile: 'skirmisher' }],
            boards: [{ id: 'b', name: 'B', map: ['####', '#..#', '####'], partyStart: [{ x: 1, y: 1 }], enemies: [] }],
            quests: [],
        }).pack;

        expect(validatePack(pack).warnings.some(w => w.path.includes('profile'))).toBe(false);
    });
});
