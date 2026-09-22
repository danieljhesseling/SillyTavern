import { describe, test, expect } from '@jest/globals';
import {
    buildEditorModel, blankMap, createBoard, createLocation, validateModel,
    applyEditorModel, describeModel, planEntryChanges, findEnemyUses,
} from '../public/scripts/game-engine/campaign/campaign-editor.js';
import { terrainFromAsciiMap, getCell } from '../public/scripts/game-engine/board/terrain.js';
import { validatePack, normalizePack } from '../public/scripts/game-engine/campaign/campaign-pack.js';
import { buildPackFromWorld } from '../public/scripts/game-engine/campaign/campaign-export.js';
import { buildImportPlan } from '../public/scripts/game-engine/campaign/campaign-importer.js';

/** Un mundo como el que deja una plantilla. */
const world = () => ({
    displayName: 'El Molino',
    genre: 'Fantasía oscura',
    description: 'Un molino con algo debajo.',
    locationMaps: [{
        name: 'El molino',
        description: 'Tres pisos de madera podrida.',
        url: '',
        gridWidth: 12,
        gridHeight: 9,
        locationType: 'ruins',
        region: 'La ribera',
        controllingFaction: 'La Orden',
        boards: [{
            name: 'El sótano',
            description: 'Cerrado por fuera.',
            gridWidth: 12,
            gridHeight: 9,
            // Un mapa de 12x9 de verdad: declarar un tamano y dibujar otro es justo lo
            // que el validador caza, y el exportador dibuja lo que el tamano diga.
            terrain: terrainFromAsciiMap([
                '############',
                '#..........#',
                '#..........#',
                '#..........#',
                '#..........#',
                '#..........#',
                '#..........#',
                '#..........#',
                '############',
            ]),
            objectives: [{ type: 'eliminate_all', label: 'Despejar' }],
            encounterRules: [{ enemyId: '4', minCount: 1, maxCount: 2 }],
            partyStart: [{ x: 1, y: 1 }],
            enemyPlacements: [{ name: 'Guardián', x: 8, y: 1 }],
        }],
    }],
});

describe('lo que el editor enseña', () => {
    const model = buildEditorModel(world());

    test('la ficha del mundo', () => {
        expect(model.world).toEqual({
            displayName: 'El Molino',
            genre: 'Fantasía oscura',
            description: 'Un molino con algo debajo.',
        });
    });

    test('las localidades con sus campos', () => {
        expect(model.locations[0]).toMatchObject({
            name: 'El molino', type: 'ruins', region: 'La ribera', factionName: 'La Orden',
        });
    });

    test('y sus tableros, con donde empieza el grupo y quien hay dentro', () => {
        expect(model.locations[0].boards[0]).toMatchObject({
            name: 'El sótano',
            gridWidth: 12,
            partyStart: [{ x: 1, y: 1 }],
            enemyPlacements: [{ name: 'Guardián', x: 8, y: 1 }],
        });
    });

    test('un mundo vacío no revienta', () => {
        expect(buildEditorModel(null).locations).toEqual([]);
        expect(buildEditorModel({}).world.displayName).toBe('');
    });

    test('un tipo de localidad inventado se ignora', () => {
        const raw = world();
        raw.locationMaps[0].locationType = 'castillo volador';
        expect(buildEditorModel(raw).locations[0].type).toBe('');
    });
});

describe('un tablero nuevo', () => {
    test('nace con el borde de muro puesto', () => {
        const map = blankMap(10, 6);
        expect(map[0]).toBe('##########');
        expect(map[5]).toBe('##########');
        expect(map[1]).toBe('#........#');
    });

    test('y no se sale de los limites que el validador exige', () => {
        expect(blankMap(2, 2)[0].length).toBe(8);
        expect(blankMap(999, 999).length).toBe(30);
    });

    test('se crea jugable: terreno de verdad y sitio donde ponerse', () => {
        const board = createBoard('Cripta', 12, 8);
        expect(board.name).toBe('Cripta');
        expect(getCell(board.terrain, 0, 0)).toMatchObject({ type: 'wall' });
        expect(getCell(board.terrain, 1, 1).type).toBe('floor');
        expect(board.partyStart).toEqual([{ x: 1, y: 1 }]);
    });

    test('una localidad nueva nace sin tableros, que es legitimo', () => {
        expect(createLocation('Aldea').boards).toEqual([]);
    });
});

describe('lo que impide guardar', () => {
    const model = () => buildEditorModel(world());

    test('un mundo correcto no se queja', () => {
        expect(validateModel(model())).toEqual([]);
    });

    test('dos localidades con el mismo nombre', () => {
        const m = model();
        m.locations.push({ ...m.locations[0], boards: [] });
        expect(validateModel(m)[0]).toMatch(/repetida/);
    });

    test('una localidad sin nombre', () => {
        const m = model();
        m.locations[0].name = '';
        expect(validateModel(m)[0]).toMatch(/sin nombre/);
    });

    test('un tablero sin sitio donde empezar no se puede jugar', () => {
        const m = model();
        m.locations[0].boards[0].partyStart = [];
        expect(validateModel(m)[0]).toMatch(/dónde empieza el grupo/);
    });

    test('un tablero demasiado pequeno', () => {
        const m = model();
        m.locations[0].boards[0].gridWidth = 3;
        expect(validateModel(m)[0]).toMatch(/tiene que estar entre/);
    });

    test('una casilla fuera del mapa', () => {
        const m = model();
        m.locations[0].boards[0].enemyPlacements = [{ name: 'X', x: 99, y: 1 }];
        expect(validateModel(m)[0]).toMatch(/cae fuera del mapa/);
    });

    test('y una localidad sin tableros no es ningun problema', () => {
        const m = model();
        m.locations[0].boards = [];
        expect(validateModel(m)).toEqual([]);
    });
});

describe('guardar lo editado', () => {
    test('cambia lo del formulario', () => {
        const model = buildEditorModel(world());
        model.world.description = 'Otra cosa';
        model.locations[0].region = 'El vado';

        const after = applyEditorModel(world(), model);
        expect(after.description).toBe('Otra cosa');
        expect(after.locationMaps[0].region).toBe('El vado');
    });

    test('y **no toca** lo que el editor no ensena', () => {
        const before = world();
        const after = applyEditorModel(before, buildEditorModel(before));
        const board = after.locationMaps[0].boards[0];

        // El terreno, los objetivos y las reglas de encuentro tienen sus propios editores:
        // pisarlos desde aqui seria borrar una mazmorra por abrir un formulario.
        expect(board.terrain).toEqual(before.locationMaps[0].boards[0].terrain);
        expect(board.objectives).toEqual([{ type: 'eliminate_all', label: 'Despejar' }]);
        expect(board.encounterRules).toEqual([{ enemyId: '4', minCount: 1, maxCount: 2 }]);
    });

    test('una localidad nueva se anade entera', () => {
        const model = buildEditorModel(world());
        model.locations.push({
            name: 'Vado', type: 'village', description: 'Cuatro casas', region: '', factionName: '', boards: [],
        });

        const after = applyEditorModel(world(), model);
        expect(after.locationMaps.map(l => l.name)).toEqual(['El molino', 'Vado']);
        expect(after.locationMaps[1].boards).toEqual([]);
        expect(after.locationMaps[1].gridWidth).toBe(50);
    });

    test('una quitada desaparece', () => {
        const model = buildEditorModel(world());
        model.locations = [];
        expect(applyEditorModel(world(), model).locationMaps).toEqual([]);
    });

    test('un tablero nuevo nace con terreno de verdad', () => {
        const model = buildEditorModel(world());
        model.locations[0].boards.push({
            name: 'Ático', description: '', gridWidth: 10, gridHeight: 6,
            partyStart: [{ x: 1, y: 1 }], enemyPlacements: [],
        });

        const board = applyEditorModel(world(), model).locationMaps[0].boards[1];
        expect(board.name).toBe('Ático');
        expect(getCell(board.terrain, 0, 0)).toMatchObject({ type: 'wall' });
    });
});

describe('lo hecho a mano sobrevive a su propio exportador', () => {
    test('un mundo editado sale, valida y vuelve a entrar', () => {
        const model = buildEditorModel(world());
        model.locations.push({
            name: 'Vado de la Rueda', type: 'village', description: 'Cuatro casas',
            region: 'La ribera', factionName: '', boards: [],
        });
        const metadata = applyEditorModel(world(), model);

        const pack = buildPackFromWorld({
            worldName: 'El Molino',
            metadata,
            entries: { 4: { comment: 'Guardián', content: 'Grande', dndData: { entityType: 'monster', maxHp: 20, armorClass: 13 } } },
        });

        const report = validatePack(normalizePack(pack).pack);
        expect(report.errors).toEqual([]);
        expect(pack.locations.map(l => l.name)).toEqual(['El molino', 'Vado de la Rueda']);
    });
});

describe('contado en una linea', () => {
    test('dice cuanto mundo hay', () => {
        expect(describeModel(buildEditorModel(world()))).toBe('1 localidad(es) · 1 tablero(s)');
    });

    test('y avisa de los sitios donde no se pelea', () => {
        const model = buildEditorModel(world());
        model.locations.push({ name: 'Vado', type: '', description: '', region: '', factionName: '', boards: [] });
        expect(describeModel(model)).toBe('2 localidad(es) · 1 tablero(s) · 1 sin tablero');
    });
});

/** Las fichas del Lorebook tal y como las deja un libro importado, mas un miembro del grupo. */
const fichas = () => ({
    7: {
        uid: 7,
        comment: 'Mirena',
        key: ['Mirena'],
        content: 'Mirena forma parte del grupo.',
        group: 'Characters',
        dndData: {
            entityType: 'character',
            name: 'Mirena',
            charClass: 'Pícara',
            level: 3,
            str: 9, dex: 17, con: 12, int: 13, wis: 10, cha: 14,
            ac: 15,
            maxHp: 24,
            // Lo que el editor no enseña y no puede perderse.
            inventory: 'Ganzúas, una cuerda',
            xp: 900,
            mapPosition: { locationName: 'El molino', gridX: 3, gridY: 4 },
        },
    },
    8: {
        uid: 8,
        comment: 'El molinero',
        key: ['molinero', 'harina'],
        content: 'Sabe más de lo que cuenta.',
        group: 'Characters',
        dndData: { entityType: 'npc', name: 'El molinero', arcana: 'El Ermitaño', initialBondPoints: 1 },
    },
    9: {
        uid: 9,
        comment: 'Guardián',
        key: ['Guardián'],
        content: 'Piedra que respira.',
        group: 'Monsters',
        dndData: { entityType: 'monster', name: 'Guardián', hp: 22, maxHp: 22, armorClass: 14, cr: 2, profile: 'brute' },
    },
    10: {
        uid: 10,
        comment: 'La Orden',
        key: ['La Orden'],
        content: 'Quiere el molino cerrado.',
        group: 'Factions',
        dndData: { entityType: 'faction', name: 'La Orden', reputation: -2 },
    },
    11: {
        uid: 11,
        comment: 'El pacto del río',
        key: ['pacto'],
        content: 'Nadie cruza de noche.',
        group: 'Lore',
    },
});

describe('el mundo entero, no solo el mapa', () => {
    const model = buildEditorModel(world(), fichas());

    test('separa a quien juega de quien vive ahi', () => {
        expect(model.characters.map(c => [c.name, c.kind]))
            .toEqual([['Mirena', 'character'], ['El molinero', 'npc']]);
    });

    test('lee las caracteristicas por el nombre corto, que es el que usa la ficha viva', () => {
        const mirena = model.characters[0];
        expect(mirena.abilities).toEqual({ str: 9, dex: 17, con: 12, int: 13, wis: 10, cha: 14 });
        expect(mirena.className).toBe('Pícara');
        expect(mirena.armorClass).toBe(15);
        expect(mirena.maxHp).toBe(24);
    });

    test('y saca de donde esta del sitio donde el grupo lo guarda', () => {
        expect(model.characters[0].locationName).toBe('El molino');
    });

    test('el bestiario y las facciones salen de sus fichas', () => {
        expect(model.bestiary.map(e => e.name)).toEqual(['Guardián']);
        expect(model.bestiary[0].hp).toBe(22);
        expect(model.factions).toMatchObject([{ name: 'La Orden', reputation: -2 }]);
    });

    test('un perfil que el motor no juega no se queda escrito', () => {
        expect(model.bestiary[0].profile).not.toBe('brute');
    });

    test('lo que no se edita aqui ni aparece', () => {
        const names = [...model.characters, ...model.bestiary, ...model.factions].map(x => x.name);
        expect(names).not.toContain('El pacto del río');
    });

    test('los objetos y las misiones viven en el mundo, no en fichas', () => {
        const source = world();
        source.itemCatalogue = [{ name: 'Daga del vado', type: 'weapon', rarity: 'Uncommon', damageDice: '1d4' }];
        source.quests = [{ id: 'molino', name: 'Bajar al sótano', act: 1 }];
        const full = buildEditorModel(source, {});
        expect(full.items).toMatchObject([{ name: 'Daga del vado', type: 'weapon', rarity: 'Uncommon' }]);
        expect(full.quests).toMatchObject([{ name: 'Bajar al sótano', act: 1 }]);
    });
});

describe('lo que hay que escribir en el Lorebook', () => {
    test('lo que ya existia se cambia, no se duplica', () => {
        const entries = fichas();
        const model = buildEditorModel(world(), entries);
        const plan = planEntryChanges(entries, model);

        expect(plan.create).toEqual([]);
        expect(plan.remove).toEqual([]);
        expect(plan.update.map(u => u.uid).sort()).toEqual(['10', '7', '8', '9']);
    });

    test('un miembro del grupo sigue siendolo, con su mochila intacta', () => {
        const entries = fichas();
        const model = buildEditorModel(world(), entries);
        model.characters[0].race = 'Media elfa';

        const mirena = planEntryChanges(entries, model).update.find(u => u.uid === '7');
        expect(mirena.dndData.entityType).toBe('character');
        expect(mirena.dndData.inventory).toBe('Ganzúas, una cuerda');
        expect(mirena.dndData.xp).toBe(900);
        expect(mirena.dndData.race).toBe('Media elfa');
        // Y donde estaba de pie: cambiarle la raza no la mueve de casilla.
        expect(mirena.dndData.mapPosition).toEqual({ locationName: 'El molino', gridX: 3, gridY: 4 });
    });

    test('reclutar a un NPC le da sitio donde plantarse', () => {
        const entries = fichas();
        const model = buildEditorModel(world(), entries);
        model.characters[1].kind = 'character';
        model.characters[1].locationName = 'El molino';

        const molinero = planEntryChanges(entries, model).update.find(u => u.uid === '8');
        expect(molinero.dndData.entityType).toBe('character');
        expect(molinero.dndData.mapPosition).toEqual({ locationName: 'El molino', gridX: 1, gridY: 1 });
    });

    // El tablero es tactico: una criatura por casilla. Reclutar no pregunta donde te
    // pones —y no deberia—, asi que lo elige el codigo, y antes elegia siempre la primera.
    test('y dos reclutados no se apilan en la misma casilla', () => {
        const source = world();
        source.locationMaps[0].boards[0].partyStart = [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }];

        const entries = fichas();
        const model = buildEditorModel(source, entries);
        model.characters[1].kind = 'character';
        model.characters[1].locationName = 'El molino';
        model.characters.push({
            ...model.characters[1], uid: '8b', raw: {}, name: 'La barquera',
        });

        const plan = planEntryChanges(entries, model);
        const cells = plan.update
            .filter(u => u.dndData.entityType === 'character')
            .map(u => `${u.dndData.mapPosition.gridX},${u.dndData.mapPosition.gridY}`);

        expect(new Set(cells).size).toBe(cells.length);
    });

    test('y tampoco encima de quien ya estaba de pie ahi', () => {
        const source = world();
        source.locationMaps[0].boards[0].partyStart = [{ x: 3, y: 4 }, { x: 2, y: 1 }];

        const entries = fichas();
        const model = buildEditorModel(source, entries);
        // Mirena ya juega y esta en (3,4), que es la primera casilla de inicio.
        model.characters[1].kind = 'character';
        model.characters[1].locationName = 'El molino';

        const molinero = planEntryChanges(entries, model).update.find(u => u.uid === '8');
        expect(molinero.dndData.mapPosition).toEqual({ locationName: 'El molino', gridX: 2, gridY: 1 });
    });

    test('lo nuevo nace sin uid y con lo que el chat lee', () => {
        const entries = fichas();
        const model = buildEditorModel(world(), entries);
        model.characters.push({
            uid: '', kind: 'npc', raw: {}, name: 'La barquera', title: 'de noche',
            className: '', level: 1, race: '', maxHp: 10, armorClass: 10, speed: 30,
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            locationName: '', backstory: 'Cruzó a los que huían.', personality: 'Callada',
            arcana: '', initialBondPoints: 0, image: '', keys: ['barquera', 'río'],
        });

        const plan = planEntryChanges(entries, model);
        expect(plan.create).toHaveLength(1);
        expect(plan.create[0].group).toBe('Characters');
        expect(plan.create[0].keys).toEqual(['La barquera', 'barquera', 'río']);
        expect(plan.create[0].content).toContain('Cruzó a los que huían.');
        // Los numeros no viajan al chat: eso es ficha, no narracion.
        expect(plan.create[0].content).not.toMatch(/10/);
    });

    test('quitar a alguien de la lista lo borra de verdad', () => {
        const entries = fichas();
        const model = buildEditorModel(world(), entries);
        model.bestiary = [];

        expect(planEntryChanges(entries, model).remove).toEqual(['9']);
    });

    test('un modelo a medias no borra nada: no mirar no es quitar', () => {
        const entries = fichas();
        expect(planEntryChanges(entries, { locations: [] }).remove).toEqual([]);
    });
});

describe('antes de borrar un enemigo, quien lo usa', () => {
    test('dice en que tablero esta puesto', () => {
        const model = buildEditorModel(world(), fichas());
        expect(findEnemyUses(model, 'Guardián')).toEqual(['El molino — El sótano (1)']);
    });

    test('y calla si no lo usa nadie', () => {
        expect(findEnemyUses(buildEditorModel(world(), fichas()), 'Nadie')).toEqual([]);
    });
});

describe('lo que impide guardar el resto del mundo', () => {
    /** @param {(model: any) => void} mutate */
    const errorsAfter = (mutate) => {
        const model = buildEditorModel(world(), fichas());
        mutate(model);
        return validateModel(model);
    };

    test('dos personajes con el mismo nombre', () => {
        const errors = errorsAfter(m => { m.characters[1].name = 'Mirena'; });
        expect(errors.join(' ')).toMatch(/repetido/);
    });

    test('alguien que dice vivir en un sitio que no existe', () => {
        const errors = errorsAfter(m => { m.characters[1].locationName = 'Ninguna parte'; });
        expect(errors.join(' ')).toMatch(/Ninguna parte/);
    });

    test('una mision sin nombre', () => {
        const errors = errorsAfter(m => { m.quests.push({ name: '', description: '', act: 1, boardName: '' }); });
        expect(errors.join(' ')).toMatch(/mision sin nombre/);
    });

    test('y un mundo entero y bien escrito no se queja de nada', () => {
        expect(errorsAfter(() => {})).toEqual([]);
    });
});

describe('los objetos y las misiones se guardan en el mundo', () => {
    test('un objeto escrito a mano queda con su forma de contrato', () => {
        const model = buildEditorModel(world(), fichas());
        model.items.push({
            name: 'Daga del vado', type: 'weapon', category: 'Simple', rarity: 'Uncommon',
            weight: 1, damageDice: '1d4', damageType: 'perforante', slot: 'mainHand', description: '',
        });
        model.quests.push({ name: 'Bajar al sótano', description: '', act: 2, boardName: 'El sótano' });

        const saved = applyEditorModel(world(), model);
        expect(saved.itemCatalogue).toMatchObject([{ name: 'Daga del vado', damageDice: '1d4' }]);
        expect(saved.quests).toMatchObject([{ name: 'Bajar al sótano', act: 2 }]);
    });

    test('lo que no tiene nombre no llega a existir', () => {
        const model = buildEditorModel(world(), fichas());
        model.items.push({ name: '   ', type: 'gear', rarity: 'Common' });
        expect(applyEditorModel(world(), model).itemCatalogue).toEqual([]);
    });
});

describe('un mundo escrito entero a mano sobrevive a la ida y la vuelta', () => {
    /** Un mundo con de todo: gente, bichos, objetos y una mision con su tablero. */
    const built = () => {
        const entries = fichas();
        const model = buildEditorModel(world(), entries);
        model.items.push({
            name: 'Hoz del vado', type: 'weapon', rarity: 'Uncommon', weight: 1.5,
            damageDice: '1d6', damageType: 'cortante', slot: 'weapon', description: 'Huele a grano.',
        });
        model.quests.push({
            name: 'Bajar al sótano', description: 'Lo que hay debajo del molino.',
            act: 1, boardName: 'El sótano',
        });
        return { entries, model, metadata: applyEditorModel(world(), model) };
    };

    test('sale, valida y no pierde nada por el camino', () => {
        const { entries, metadata } = built();
        const pack = buildPackFromWorld({ worldName: 'El Molino', metadata, entries });

        const report = validatePack(normalizePack(pack).pack);
        expect(report.errors).toEqual([]);
        expect(pack.items.map(i => i.name)).toEqual(['Hoz del vado']);
        expect(pack.quests.map(q => q.name)).toEqual(['Bajar al sótano']);
        // La mision se lleva los objetivos del tablero que nombra: son los mismos.
        expect(pack.quests[0].objectives).toHaveLength(1);
        expect(report.counts.items).toBe(1);
    });

    test('y vuelve a entrar con los objetos y las misiones puestos', () => {
        const { entries, metadata } = built();
        const pack = normalizePack(buildPackFromWorld({ worldName: 'El Molino', metadata, entries })).pack;

        const plan = buildImportPlan(pack, { party: [] });
        expect(plan.metadata.itemCatalogue).toMatchObject([
            { name: 'Hoz del vado', type: 'weapon', rarity: 'Uncommon', damageDice: '1d6' },
        ]);
        expect(plan.metadata.quests).toMatchObject([
            { name: 'Bajar al sótano', act: 1, boardName: 'El sótano' },
        ]);
    });

    test('y lo importado se vuelve a abrir en el editor tal cual', () => {
        const { entries, metadata } = built();
        const pack = normalizePack(buildPackFromWorld({ worldName: 'El Molino', metadata, entries })).pack;
        const plan = buildImportPlan(pack, { party: [] });

        const reopened = buildEditorModel(plan.metadata, {});
        expect(reopened.items.map(i => i.name)).toEqual(['Hoz del vado']);
        expect(reopened.quests.map(q => [q.name, q.boardName])).toEqual([['Bajar al sótano', 'El sótano']]);
    });

    test('una mision que nombra un tablero que no existe no se puede guardar', () => {
        const { model } = built();
        model.quests[0].boardName = 'El desván';
        expect(validateModel(model).join(' ')).toMatch(/El desván/);
    });
});

describe('guardar no puede desmontar la campana', () => {
    // El editor no tiene interruptor para esto, asi que no puede decidirlo: las plantillas
    // sacan a los bichos por reglas de encuentro y no por fichas puestas en casillas, y
    // deducir `isCombat` de las colocaciones apagaba el tablero entero al guardar.
    test('un tablero de pelea sin nadie colocado sigue siendo de pelea', () => {
        const source = world();
        source.locationMaps[0].boards[0].isCombat = true;
        source.locationMaps[0].boards[0].enemyPlacements = [];

        const model = buildEditorModel(source, fichas());
        const after = applyEditorModel(source, model).locationMaps[0].boards[0];

        expect(after.isCombat).toBe(true);
    });

    test('y lo que el editor no edita se queda como estaba', () => {
        const source = world();
        const board = source.locationMaps[0].boards[0];
        board.isCombat = true;
        board.encounterRules = [{ monsterUid: '9', count: 2 }];
        board.objectives = [{ id: 'clear', type: 'eliminate_all', label: 'Limpiar' }];

        const model = buildEditorModel(source, fichas());
        const after = applyEditorModel(source, model).locationMaps[0].boards[0];

        expect(after.encounterRules).toEqual([{ monsterUid: '9', count: 2 }]);
        expect(after.objectives).toEqual([{ id: 'clear', type: 'eliminate_all', label: 'Limpiar' }]);
        expect(after.terrain).toEqual(board.terrain);
    });
});
