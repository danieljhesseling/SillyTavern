import { describe, test, expect } from '@jest/globals';
import {
    buildPackFromWorld, asciiFromTerrain, describeExport,
} from '../public/scripts/game-engine/campaign/campaign-export.js';
import { normalizePack, validatePack } from '../public/scripts/game-engine/campaign/campaign-pack.js';
import { buildImportPlan } from '../public/scripts/game-engine/campaign/campaign-importer.js';
import { terrainFromAsciiMap } from '../public/scripts/game-engine/board/terrain.js';

const MAP = [
    '##########',
    '#........#',
    '#..c..D..#',
    '#........#',
    '#...~....#',
    '##########',
];

/** Un mundo como el que deja el importador, que es el que hay que saber exportar. */
const world = () => ({
    worldName: 'Valle del Molino',
    synopsis: 'Un valle con un molino.',
    metadata: {
        locationMaps: [{
            name: 'El molino',
            boards: [{
                name: 'El sótano',
                packBoardId: 'sotano',
                gridWidth: 10,
                gridHeight: 6,
                terrain: terrainFromAsciiMap(MAP),
                partyStart: [{ x: 1, y: 1 }, { x: 2, y: 1 }],
                enemyPlacements: [{ name: 'Guardián del grano', x: 8, y: 3 }],
                objectives: [
                    { type: 'eliminate', label: 'Acaba con el guardián', targetIds: ['42'] },
                    { type: 'survive_rounds', label: 'Aguanta', rounds: 4, optional: true },
                    { type: 'reach_cell', label: 'Llega a la trampilla', cell: { x: 7, y: 4 } },
                    { type: 'loot', label: 'Recoge el grano', treasureIds: ['43', '44'] },
                ],
            }],
        }],
    },
    entries: {
        42: { comment: 'Guardián del grano', content: 'Un bicho grande.', dndData: { entityType: 'monster', maxHp: 26, armorClass: 14, cr: 1, speed: 30, profile: 'skirmisher', attackRangeFeet: 5 } },
        43: { comment: 'Saco de grano', content: 'Pesa.' },
        44: { comment: 'Moneda vieja', content: 'Brilla poco.' },
        45: { comment: 'Lyra', content: 'La molinera.', dndData: { entityType: 'npc', arcana: 'La Sacerdotisa', initialBondPoints: 3 } },
        46: { comment: 'Los Cuervos', content: 'Quieren el molino.', dndData: { entityType: 'faction', reputation: -2 } },
    },
});

describe('el mapa, de vuelta a texto', () => {
    test('sale igual que entró', () => {
        expect(asciiFromTerrain(terrainFromAsciiMap(MAP), 10, 6)).toEqual(MAP);
    });

    test('una puerta abierta y una cerrada no se confunden', () => {
        const rows = ['Do'];
        expect(asciiFromTerrain(terrainFromAsciiMap(rows), 2, 1)).toEqual(rows);
    });

    test('un tablero sin terreno es todo suelo', () => {
        expect(asciiFromTerrain(null, 3, 2)).toEqual(['...', '...']);
    });
});

describe('lo que lleva el paquete', () => {
    const pack = buildPackFromWorld(world());

    test('el mundo, con su nombre y su sinopsis', () => {
        expect(pack.world.name).toBe('Valle del Molino');
        expect(pack.world.synopsis).toBe('Un valle con un molino.');
    });

    test('los enemigos, con sus números', () => {
        expect(pack.bestiary).toHaveLength(1);
        expect(pack.bestiary[0]).toMatchObject({ name: 'Guardián del grano', hp: 26, armorClass: 14, profile: 'skirmisher' });
    });

    test('los compañeros, con su arcana', () => {
        expect(pack.confidants[0]).toMatchObject({ name: 'Lyra', arcana: 'La Sacerdotisa', initialBondPoints: 3 });
    });

    test('las facciones, con lo que quieren', () => {
        expect(pack.world.factions[0]).toMatchObject({ name: 'Los Cuervos', reputation: -2 });
    });

    test('y lo que no es ninguna de esas cosas se va al lore, no a la basura', () => {
        expect(pack.world.loreEntries.map(l => l.key)).toEqual(['Saco de grano', 'Moneda vieja']);
    });

    test('el tablero, con su mapa y donde empieza el grupo', () => {
        expect(pack.boards[0].map).toEqual(MAP);
        expect(pack.boards[0].partyStart).toEqual([{ x: 1, y: 1 }, { x: 2, y: 1 }]);
        expect(pack.boards[0].enemies).toEqual([{ name: 'Guardián del grano', x: 8, y: 3 }]);
    });
});

describe('los objetivos vuelven a ser nombres', () => {
    const pack = buildPackFromWorld(world());
    const objectives = pack.quests[0].objectives;

    test('un uid de enemigo se escribe con su nombre', () => {
        expect(objectives[0]).toMatchObject({ type: 'eliminate', target: 'Guardián del grano' });
    });

    test('los tesoros, también, y en lista', () => {
        expect(objectives[3]).toMatchObject({ type: 'loot', treasures: ['Saco de grano', 'Moneda vieja'] });
    });

    test('los números y las casillas viajan tal cual', () => {
        expect(objectives[1]).toMatchObject({ type: 'survive_rounds', rounds: 4, optional: true });
        expect(objectives[2]).toMatchObject({ type: 'reach_cell', cell: { x: 7, y: 4 } });
    });

    test('una misión por tablero, apuntando a ese tablero', () => {
        expect(pack.quests).toHaveLength(1);
        expect(pack.quests[0].boardId).toBe(pack.boards[0].id);
    });
});

describe('la ida y la vuelta', () => {
    test('lo que sale de aquí lo acepta el validador sin una queja', () => {
        const { pack } = normalizePack(buildPackFromWorld(world()));
        const report = validatePack(pack);
        expect(report.errors).toEqual([]);
        expect(report.ok).toBe(true);
    });

    test('y al reimportarlo sale el mismo tablero, en el mismo sitio', () => {
        const { pack } = normalizePack(buildPackFromWorld(world()));
        const plan = buildImportPlan(pack, { party: [] });
        const board = plan.metadata.locationMaps[0].boards[0];

        expect(plan.counts.boards).toBe(1);
        expect(board.name).toBe('El sótano');
        expect(board.enemyPlacements).toEqual([{ name: 'Guardián del grano', x: 8, y: 3 }]);
        expect(board.objectives).toHaveLength(4);
    });

    test('un mundo vacío da un paquete vacío, no una excepción', () => {
        const pack = buildPackFromWorld({ worldName: 'Nada', metadata: null, entries: null });
        expect(pack.boards).toEqual([]);
        expect(pack.bestiary).toEqual([]);
        expect(validatePack(normalizePack(pack).pack).ok).toBe(false);
    });
});

describe('contado en una línea', () => {
    test('dice lo que lleva', () => {
        expect(describeExport(buildPackFromWorld(world())))
            .toBe('"Valle del Molino" · 1 localidad(es) · 1 tablero(s) · 1 enemigo(s) · 1 compañero(s) · 1 misión(es)');
    });
});

describe('los sitios sin tablero tambien viajan', () => {
    const withVillage = () => {
        const w = world();
        w.metadata.locationMaps.push({
            name: 'Aldea del Vado',
            description: 'Un puñado de casas junto al río.',
            locationType: 'village',
            region: 'El Vado',
            controllingFaction: 'Los Cuervos',
            boards: [],
        });
        return w;
    };

    test('una aldea sin tablero sale en el paquete', () => {
        const pack = buildPackFromWorld(withVillage());
        expect(pack.locations.map(l => l.name)).toEqual(['El molino', 'Aldea del Vado']);
        expect(pack.locations[1]).toMatchObject({
            type: 'village', region: 'El Vado', factionName: 'Los Cuervos',
        });
    });

    test('y al reimportarla sigue estando, con cero tableros', () => {
        const { pack } = normalizePack(buildPackFromWorld(withVillage()));
        const plan = buildImportPlan(pack, { party: [] });
        const village = plan.metadata.locationMaps.find(l => l.name === 'Aldea del Vado');

        expect(village).toBeDefined();
        expect(village.boards).toEqual([]);
        expect(village.locationType).toBe('village');
        expect(plan.counts.locations).toBe(2);
    });

    test('el validador no se queja de un sitio al que no se va a pelear', () => {
        const report = validatePack(normalizePack(buildPackFromWorld(withVillage())).pack);
        expect(report.errors).toEqual([]);
        expect(report.ok).toBe(true);
    });

    test('y lo cuenta en la linea de resumen', () => {
        expect(describeExport(buildPackFromWorld(withVillage()))).toMatch('2 localidad(es)');
    });
});
