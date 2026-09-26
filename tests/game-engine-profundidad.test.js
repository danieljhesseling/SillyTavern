import fs from 'node:fs';
import { describe, test, expect } from '@jest/globals';
import {
    LETTERS, MODES, CUSTOM, DEFAULT_MODE, fixLetters, survivalFor, lettersOf, modeOf, modeLabel,
    hasLetter, describeMode, letterRows, setLetter, recordModeChange, readModeHistory,
    startModeHistory, isIronRun, stagesFor, keepOn, STAGE_LETTERS,
} from '../public/scripts/game-engine/rules/modes.js';
import { DAY_STAGES, WEEK_STAGES } from '../public/scripts/game-engine/campaign/time-stages.js';
import { readPremadeHeroes, premadeLine, premadeAnswers, PREMADE_MAX } from '../public/scripts/game-engine/campaign/premade-heroes.js';
import {
    startTaller, walkableSteps, goTo, firstBlock, baselineOf, tabStatus, stepSlice, writeField, pickCard, addPerson,
} from '../public/scripts/game-engine/campaign/taller.js';
import { readArea, isArea, areaCells, creaturesIn, describeArea } from '../public/scripts/game-engine/rules/area.js';
import { terrainFromAsciiMap } from '../public/scripts/game-engine/board/terrain.js';
import { travelShortcut, lockBonus, watchBonus, duelTricks, patchUpAfterFight, fieldUsesOf } from '../public/scripts/game-engine/rules/field-uses.js';
import { pairOptions, pairLine } from '../public/scripts/game-engine/rules/pair-moves.js';
import { readHall, describeHallEntry } from '../public/scripts/game-engine/campaign/legacy.js';
import { elementOf, describeElement, reactTerrain, comboFor } from '../public/scripts/game-engine/rules/tags.js';
import {
    SPELLS, SCHOOLS, spellById, spellAbility, spellsForClass, chargesLeft, spendCharge, canCast, describeCharges, magicInData, magicLine,
} from '../public/scripts/game-engine/rules/grimoire.js';
import { normalizeAbility } from '../public/scripts/game-engine/rules/abilities.js';
import {
    readPet, createPet, describePet, petComment, afterComment, shouldComment, petAdvice, supportActions, liveTogether, petDoes, petChoicesFor, tamableAs,
} from '../public/scripts/game-engine/campaign/pet.js';
import { threatOf, budgetFor, pickByBudget, dressingFor, generateIntended } from '../public/scripts/game-engine/world-builder/board-intent.js';
import { generateBoard } from '../public/scripts/game-engine/world-builder/dungeon-generator.js';
import { createSeededRandom } from '../public/scripts/game-engine/combat/seeded-random.js';
import { roleOf, pickTarget, leaderBonus, breaksAndRuns, tacticOf, flankCell, describeBand } from '../public/scripts/game-engine/combat/enemy-roles.js';
import { noteEscape, readNemeses, whoReturns, comeback, nemesisFalls } from '../public/scripts/game-engine/campaign/nemesis.js';
import { completeArc, homeFavors, favorDiscount, noteGone, whoComesBack, comebackOf, forgetGone } from '../public/scripts/game-engine/campaign/companion-arcs.js';
import { perkBonus } from '../public/scripts/game-engine/rules/level-perks.js';
import { rumorsFromPlay, chronicleMemory, reactionTo } from '../public/scripts/game-engine/campaign/world-echoes.js';
import { magicItemsOf, judgeMagicItems, afterUse, canLearnScroll } from '../public/scripts/game-engine/rules/magic-items.js';
import { bossPhase } from '../public/scripts/game-engine/combat/boss-phases.js';
import { isPassable, describeCell, ASCII_TERRAIN } from '../public/scripts/game-engine/board/terrain.js';
import { flammable } from '../public/scripts/game-engine/board/living-terrain.js';
import { DEFAULT_SURVIVAL, readSurvival } from '../public/scripts/game-engine/rules/mortality.js';
import { createCompendium } from '../public/scripts/game-engine/compendio/compendio.js';
import { breedMonster } from '../public/scripts/game-engine/compendio/bestiary.js';
import { buildPackEntries } from '../public/scripts/game-engine/campaign/campaign-importer.js';
import { normalizePack } from '../public/scripts/game-engine/campaign/campaign-pack.js';
import { getSectionSchema } from '../public/scripts/game-engine/campaign/campaign-pack-schema.js';
import { checkWorldDensity } from '../public/scripts/game-engine/campaign/world-density.js';

describe('R1: los modos de juego', () => {
    test('las seis letras, en orden, y los tres modos con las tuyas', () => {
        expect(LETTERS.map(l => l.id).join('')).toBe('abcdef');
        expect(MODES.relajado.letters).toBe('abc');
        expect(MODES.normal.letters).toBe('abcdf');
        expect(MODES.supervivencia.letters).toBe('abcdef');
    });

    test('cada modo se lee de vuelta de los interruptores que pone', () => {
        for (const [id, mode] of Object.entries(MODES)) {
            const survival = survivalFor(mode.letters);
            expect(modeOf(survival)).toBe(id);
            expect(lettersOf(survival)).toBe(mode.letters);
        }
    });

    test('una campaña que no dice nada está en Normal: es lo que se ha jugado hasta hoy', () => {
        expect(modeOf(null)).toBe(DEFAULT_MODE);
        expect(modeOf(DEFAULT_SURVIVAL)).toBe('normal');
        expect(readSurvival(null).upkeep).toBe(true);
        expect(readSurvival(null).world).toBe(true);
    });

    test('las dificultades de antes caen en su modo: Historia es Relajado y De hierro es Supervivencia', () => {
        const historia = { mortality: 'mercenaries', saves: 'free', needs: false, exposure: false, injuries: true, loyalty: false };
        const hierro = { mortality: 'everyone', saves: 'shelter', needs: true, exposure: true, injuries: true, loyalty: true };
        // Historia no pagaba a los mercenarios que se iban, pero sí tenía la cuenta: es
        // Relajado con un interruptor afinado, y así lo dice.
        expect(lettersOf(historia)).toBe('abc');
        expect(modeOf(hierro)).toBe('supervivencia');
    });

    test('la intemperie sin el cuerpo no se sostiene, y se dice por qué', () => {
        const fixed = fixLetters('abf');
        expect(fixed.letters).toBe('ab');
        expect(fixed.dropped).toEqual(['f']);
        expect(fixed.reasons[0]).toMatch(/necesita «El cuerpo»/);
        expect(survivalFor('abf').exposure).toBe(false);
    });

    test('lo que no es un modo con nombre es «A tu medida»', () => {
        const survival = survivalFor('ad');
        expect(modeOf(survival)).toBe(CUSTOM);
        expect(modeLabel(CUSTOM)).toBe('A tu medida');
        expect(describeMode(survival)).toBe('A tu medida · Heridas, El cuerpo');
    });

    test('afinar un interruptor por dentro de una letra saca del modo sin apagar la letra', () => {
        const survival = { ...survivalFor('abcdef'), saves: 'free' };
        expect(hasLetter(survival, 'e')).toBe(true);
        expect(modeOf(survival)).toBe(CUSTOM);
    });

    test('encender o apagar una letra solo toca lo suyo', () => {
        let survival = survivalFor('abcdf');
        survival = setLetter(survival, 'c', false);
        expect(lettersOf(survival)).toBe('abdf');
        survival = setLetter(survival, 'd', false);
        expect(lettersOf(survival)).toBe('ab');
        expect(survival.exposure).toBe(false);
        survival = setLetter(survival, 'f', true);
        expect(lettersOf(survival)).toBe('abdf');
        survival = setLetter(survival, 'e', true);
        expect(survival.saves).toBe('shelter');
        expect(survival.mortality).toBe('everyone');
    });

    test('las filas dicen qué está encendido y de qué depende cada una', () => {
        const rows = letterRows(survivalFor('abc'));
        expect(rows.filter(r => r.on).map(r => r.id)).toEqual(['a', 'b', 'c']);
        expect(rows.find(r => r.id === 'f')?.needs).toBe('El cuerpo');
    });

    test('cambiar de modo queda escrito, y bajar de Supervivencia deja de ser de hierro', () => {
        const iron = survivalFor(MODES.supervivencia.letters);
        let history = startModeHistory(iron);
        expect(history.iron).toBe(true);
        expect(isIronRun(iron, history)).toBe(true);

        const down = recordModeChange({ from: iron, to: survivalFor('abc'), day: 12, history });
        expect(down.changed).toBe(true);
        expect(down.line).toBe('Se cambia el modo: de Supervivencia a Relajado. Esta partida ya no cuenta como de hierro.');
        history = down.history;
        expect(history.iron).toBe(false);

        // Volver a subir no la devuelve.
        const up = recordModeChange({ from: survivalFor('abc'), to: iron, day: 13, history });
        expect(up.line).toBe('Se cambia el modo: de Relajado a Supervivencia.');
        expect(isIronRun(iron, up.history)).toBe(false);
        expect(readModeHistory(up.history).changes.map(c => c.to)).toEqual(['relajado', 'supervivencia']);
    });

    test('empezar en Relajado y subir no la hace de hierro', () => {
        const history = startModeHistory(survivalFor('abc'));
        const up = recordModeChange({ from: survivalFor('abc'), to: survivalFor('abcdef'), day: 3, history });
        expect(isIronRun(survivalFor('abcdef'), up.history)).toBe(false);
    });

    test('no cambiar nada no escribe nada', () => {
        const same = recordModeChange({ from: survivalFor('abc'), to: survivalFor('abc'), day: 1 });
        expect(same.changed).toBe(false);
        expect(same.line).toBe('');
    });

    test('en Relajado no pasan ni el hambre ni el clima; sin el mundo, ni rivales ni casos', () => {
        const ids = (/** @type {any[]} */ list) => list.map(s => s.id);
        expect(ids(stagesFor(DAY_STAGES, survivalFor('abc')))).not.toContain('necesidades');
        expect(ids(stagesFor(DAY_STAGES, survivalFor('abc')))).toContain('facciones');
        const noWorld = ids(stagesFor(WEEK_STAGES, survivalFor('abd')));
        expect(noWorld).toEqual(['deuda', 'hartos', 'buscados', 'cuenta', 'mesa']);
        const noBill = ids(stagesFor(WEEK_STAGES, survivalFor('acd')));
        expect(noBill).not.toContain('cuenta');
        expect(noBill).not.toContain('deuda');
        // Todas las etapas que dicen su letra existen de verdad.
        const all = new Set([...DAY_STAGES, ...WEEK_STAGES].map(s => s.id));
        for (const id of Object.keys(STAGE_LETTERS)) expect(all.has(id)).toBe(true);
    });

    test('lo apagado no sale en lo que viene ni en la mesa', () => {
        const items = [{ kind: 'cuenta' }, { kind: 'faccion' }, { kind: 'caso' }, { kind: 'hito' }, { kind: 'herida' }];
        expect(keepOn(items, survivalFor('a')).map(i => i.kind)).toEqual(['hito', 'herida']);
        expect(keepOn(items, survivalFor('abcdef'))).toHaveLength(5);
    });

    test('una partida anterior a los modos cuenta como de hierro si lo es ahora', () => {
        expect(isIronRun(survivalFor('abcdef'), null)).toBe(true);
        expect(isIronRun(survivalFor('abcdf'), null)).toBe(false);
    });
});

describe('R1: los héroes hechos', () => {
    const rows = [
        { name: 'Maren', race: 'Humano', className: 'Pícaro', background: 'marinero', about: 'Sabe qué barcas no vuelven.', pitch: 'La que no pregunta' },
        { nombre: 'Tobías', raza: 'Elfo', clase: 'Mago' },
        { name: 'Iñigo', race: 'humano', className: 'soldado', background: 'inventado' },
        { name: '' },
        { name: 'Ruth', race: 'Marcado', className: 'Clérigo' },
        { name: 'Sobra', race: 'Humano', className: 'Erudito' },
    ];

    test('solo entran los de razas y clases del mundo, y como mucho tres', () => {
        const { heroes, dropped } = readPremadeHeroes(rows, { races: ['Humano', 'Marcado'], classes: ['Pícaro', 'Soldado', 'Clérigo', 'Erudito'] });
        expect(heroes.map(h => h.name)).toEqual(['Maren', 'Iñigo', 'Ruth']);
        expect(heroes).toHaveLength(PREMADE_MAX);
        expect(dropped[0]).toMatch(/Tobías: la raza «Elfo» no entra/);
    });

    test('un pasado que no existe se queda en blanco, como en el creador', () => {
        const { heroes } = readPremadeHeroes(rows.slice(2, 3));
        expect(heroes[0].background).toBe('');
    });

    test('se enseña en una línea y da las mismas respuestas que el creador', () => {
        const { heroes } = readPremadeHeroes(rows.slice(0, 1));
        expect(premadeLine(heroes[0])).toBe('Maren · Humano, Pícaro — La que no pregunta');
        expect(premadeAnswers(heroes[0])).toEqual({
            name: 'Maren', race: 'Humano', className: 'Pícaro', gender: '', background: 'marinero',
            about: 'Sabe qué barcas no vuelven.', image: '',
        });
    });
});

describe('R2: el taller en pestañas', () => {
    test('se va a cualquier pestaña sin pasar por las de en medio', () => {
        const state = startTaller({ path: 'cero', random: () => 0.5 });
        const moved = goTo(state, 'bestiario');
        expect(walkableSteps()[moved.at].id).toBe('bestiario');
        expect(goTo(state, 'no-existe')).toBe(state);
    });

    test('crear mira todas las pestañas, no solo la de ahora', () => {
        let state = startTaller({ path: 'cero', random: () => 0.5 });
        expect(firstBlock(state)?.step).toBe('mundo');
        state = writeField(pickCard(state, 'mundo', 'tavern', true), 'worldName', 'Brumal');
        expect(firstBlock(state)).toBeNull();
        // Añadir ya la mete en el mundo.
        state = addPerson(state, { name: '' }).state;
        expect(firstBlock(state)).toEqual({ step: 'personajes', reason: 'Hay alguien sin nombre.' });
    });

    test('cada pestaña dice si está como viene, cambiada o con algo que no cuadra', () => {
        let state = writeField(pickCard(startTaller({ path: 'cero', random: () => 0.5 }), 'mundo', 'tavern', true), 'worldName', 'Brumal');
        const baseline = baselineOf(state);
        expect(tabStatus(state, 'jugabilidad', baseline)).toBe('default');
        state = { ...state, survival: { needs: false } };
        expect(tabStatus(state, 'jugabilidad', baseline)).toBe('changed');
        expect(tabStatus(state, 'razas', baseline)).toBe('default');
        expect(tabStatus(writeField(state, 'worldName', ''), 'mundo', baseline)).toBe('warn');
    });

    test('lo que toca cada pestaña es solo lo suyo', () => {
        const state = startTaller({ path: 'cero', random: () => 0.5 });
        const before = stepSlice(state, 'razas');
        const after = pickCard(state, 'clases', 'mago');
        expect(stepSlice(after, 'razas')).toBe(before);
        expect(stepSlice(after, 'clases')).not.toBe(stepSlice(state, 'clases'));
    });
});

describe('R3: las áreas', () => {
    const open = { width: 20, height: 20 };

    test('lo que no dice forma es a uno, y a uno toca solo el objetivo', () => {
        expect(readArea(null)).toEqual({ shape: 'single', size: 0 });
        expect(isArea({ shape: 'single' })).toBe(false);
        expect(areaCells({ area: null, origin: { x: 0, y: 0 }, aim: { x: 3, y: 3 }, ...open })).toEqual([{ x: 3, y: 3 }]);
    });

    test('un radio de 5 ft son las nueve casillas alrededor del punto', () => {
        const cells = areaCells({ area: { shape: 'radius', size: 5 }, origin: { x: 0, y: 0 }, aim: { x: 5, y: 5 }, ...open });
        expect(cells).toHaveLength(9);
        expect(describeArea({ shape: 'radius', size: 5 })).toBe('radio de 5 ft');
    });

    test('una pared protege de la explosión lo que tiene detrás', () => {
        const terrain = terrainFromAsciiMap([
            '.....',
            '..#..',
            '.....',
        ]);
        const cells = areaCells({ area: { shape: 'radius', size: 10 }, origin: { x: 0, y: 0 }, aim: { x: 2, y: 0 }, terrain, width: 5, height: 3 });
        const keys = cells.map(c => `${c.x},${c.y}`);
        expect(keys).not.toContain('2,1');
        expect(keys).not.toContain('2,2');
        expect(keys).toContain('0,2');
    });

    test('la línea sale de quien la lanza, tan larga como dice, y se para en la pared', () => {
        const line = areaCells({ area: { shape: 'line', size: 15 }, origin: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, ...open });
        expect(line).toEqual([{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }]);
        const terrain = terrainFromAsciiMap(['..#...']);
        const cut = areaCells({ area: { shape: 'line', size: 25 }, origin: { x: 0, y: 0 }, aim: { x: 5, y: 0 }, terrain, width: 6, height: 1 });
        expect(cut).toEqual([{ x: 1, y: 0 }]);
    });

    test('el cono se abre hacia donde se apunta, y no hacia atrás', () => {
        const cone = areaCells({ area: { shape: 'cone', size: 10 }, origin: { x: 5, y: 5 }, aim: { x: 7, y: 5 }, ...open });
        const keys = cone.map(c => `${c.x},${c.y}`);
        expect(keys).toEqual(expect.arrayContaining(['6,5', '7,5', '6,4', '6,6', '7,4', '7,6', '7,3', '7,7']));
        expect(keys).not.toContain('4,5');
        expect(keys).not.toContain('5,5');
    });

    test('el área no distingue bandos: lo que cae dentro, cae', () => {
        const cells = areaCells({ area: { shape: 'radius', size: 5 }, origin: { x: 0, y: 0 }, aim: { x: 5, y: 5 }, ...open });
        const hit = creaturesIn(cells, [{ id: 'lobo', x: 5, y: 5 }, { id: 'bruna', x: 6, y: 6 }, { id: 'lejos', x: 9, y: 9 }]);
        expect(hit.map(c => c.id)).toEqual(['lobo', 'bruna']);
    });
});

describe('R3: los usos fuera del combate', () => {
    const party = [
        { name: 'Wendel', hp: 10, abilities: ['hab-rastrear', 'hab-burla'] },
        { name: 'Bruna', hp: 0, abilities: ['hab-gritar'] },
        { name: 'Tess', hp: 8, abilities: ['hab-ganzua', 'hab-primeros-auxilios'] },
    ];

    test('leer el rastro quita un día a los viajes de dos o más, y lo dice', () => {
        expect(travelShortcut(party, 3)).toEqual({ days: 2, who: 'Wendel', line: 'Wendel lee el rastro y encuentra un atajo: un día menos.' });
        expect(travelShortcut(party, 1).days).toBe(1);
    });

    test('la ganzúa suma a las cerraduras; quien está en el suelo no hace guardia', () => {
        expect(lockBonus(party[2])).toBe(5);
        expect(lockBonus(party[0])).toBe(0);
        expect(watchBonus(party).amount).toBe(0);
        expect(watchBonus([{ ...party[1], hp: 5 }])).toEqual({ amount: 2, who: 'Bruna' });
    });

    test('la burla es una carta del duelo, y los primeros auxilios curan después de pelear', () => {
        expect(duelTricks(party[0])).toEqual([{ id: 'truco:hab-burla', kind: 'truco', label: 'Soltarle una burla que escuece', as: 'intimidar', power: 4 }]);
        expect(patchUpAfterFight(party)).toEqual({ who: 'Tess', formula: '1d4' });
        expect(fieldUsesOf(party).map(u => u.where)).toEqual(['viaje', 'duelo', 'campamento', 'cerradura', 'combate']);
    });
});

describe('R3: los ataques en pareja', () => {
    const hero = { id: 'h', name: 'Wendel', x: 5, y: 5, hp: 10, rank: 0 };
    const bruna = { id: 'b', name: 'Bruna', x: 6, y: 6, hp: 10, rank: 3 };
    const tess = { id: 't', name: 'Tess', x: 4, y: 6, hp: 10, rank: 1 };
    const wolf = { id: 'w', name: 'Lobo', x: 5, y: 6, hp: 7 };

    test('el héroe y un compañero con vínculo 3, pegados al mismo enemigo, pueden ir a una', () => {
        expect(pairOptions({ actor: hero, heroId: 'h', party: [hero, bruna, tess], enemies: [wolf] }))
            .toEqual([{ partnerId: 'b', partnerName: 'Bruna', enemyId: 'w', enemyName: 'Lobo' }]);
        expect(pairOptions({ actor: bruna, heroId: 'h', party: [hero, bruna, tess], enemies: [wolf] })[0]?.partnerId).toBe('h');
    });

    test('sin vínculo, sin reacción o sin estar pegado, no', () => {
        expect(pairOptions({ actor: tess, heroId: 'h', party: [hero, bruna, tess], enemies: [wolf] })).toEqual([]);
        expect(pairOptions({ actor: hero, heroId: 'h', party: [hero, { ...bruna, reactionUsed: true }], enemies: [wolf] })).toEqual([]);
        expect(pairOptions({ actor: hero, heroId: 'h', party: [hero, { ...bruna, x: 9, y: 9 }], enemies: [wolf] })).toEqual([]);
        expect(pairLine('Wendel', 'Bruna', 'Lobo')).toMatch(/^🤝 Wendel y Bruna van a una contra Lobo/);
    });
});

describe('R1: de hierro de verdad', () => {
    test('morir cualquiera con el guardado libre no es de hierro: se deshace volviendo atrás', () => {
        expect(isIronRun({ mortality: 'everyone', saves: 'free' }, null)).toBe(false);
        expect(isIronRun({ mortality: 'everyone', saves: 'shelter' }, null)).toBe(true);
    });

    test('en el salón, la partida de hierro lo dice al final de la línea', () => {
        const [entry] = readHall([{ name: 'Bruna', world: '1387', day: 3, epitaph: 'Bruna cayó en el paso.', when: '2026-09-26T10:00:00Z', mode: 'Supervivencia', iron: true }]);
        expect(describeHallEntry(entry)).toBe('Bruna cayó en el paso. (1387 · 2026-09-26 · de hierro)');
    });
});

describe('R3: las etiquetas de elemento', () => {
    const cellsOf = (/** @type {string[]} */ rows) => rows.flatMap((row, y) => [...row].map((_, x) => ({ x, y })));

    test('el elemento sale de la etiqueta, o del tipo de daño en inglés o en castellano', () => {
        expect(elementOf({ element: 'frio' })).toBe('frio');
        expect(elementOf({ damageType: 'Fire' })).toBe('fuego');
        expect(elementOf({ damageType: 'Radiant' })).toBe('luz');
        expect(elementOf({ damageType: 'Piercing' })).toBe('');
        expect(describeElement({ damageType: 'Cold' })).toBe('frío');
    });

    test('el fuego prende las cajas y la maleza, y funde el hielo', () => {
        const rows = ['cbi.'];
        const out = reactTerrain({ element: 'fuego', cells: cellsOf(rows), terrain: terrainFromAsciiMap(rows), round: 2 });
        expect(out.changed.map(c => `${c.from}>${c.to}`)).toEqual(['cover_half>floor', 'brush>floor', 'ice>water']);
        expect(out.hazards.filter(h => h.kind === 'fuego').map(h => `${h.x},${h.y}`)).toEqual(['0,0', '1,0']);
        expect(out.lines[0]).toBe('🔥 Arden las cajas, arde la maleza, el hielo se funde.');
    });

    test('con lluvia el fuego no prende nada, y se dice', () => {
        const rows = ['c'];
        const out = reactTerrain({ element: 'fuego', cells: cellsOf(rows), terrain: terrainFromAsciiMap(rows), wet: true });
        expect(out.changed).toEqual([]);
        expect(out.lines).toEqual(['💧 Con esta agua, el fuego no prende.']);
    });

    test('el frío hiela el agua y apaga lo que arde', () => {
        const rows = ['ww.'];
        const burning = [{ kind: 'fuego', x: 2, y: 0, armed: true }];
        const out = reactTerrain({ element: 'frio', cells: cellsOf(rows), terrain: terrainFromAsciiMap(rows), hazards: burning });
        expect(out.changed.map(c => c.to)).toEqual(['ice', 'ice', '']);
        expect(out.hazards[0].armed).toBe(false);
        expect(out.lines[0]).toBe('❄️ El agua se hiela (2), se apaga el fuego.');
    });

    test('el trueno revienta las puertas, y la naturaleza hace brotar maleza', () => {
        const door = reactTerrain({ element: 'trueno', cells: [{ x: 0, y: 0 }], terrain: terrainFromAsciiMap(['L']) });
        expect(door.terrain.cells['0,0']).toEqual({ type: 'door', open: true, broken: true });
        const grown = reactTerrain({ element: 'naturaleza', cells: [{ x: 0, y: 0 }], terrain: terrainFromAsciiMap(['.']) });
        expect(grown.terrain.cells['0,0'].type).toBe('brush');
    });

    test('la maleza pintada como terreno difícil solo arde a cielo abierto', () => {
        const inside = reactTerrain({ element: 'fuego', cells: [{ x: 0, y: 0 }], terrain: terrainFromAsciiMap(['~']) });
        const outside = reactTerrain({ element: 'fuego', cells: [{ x: 0, y: 0 }], terrain: terrainFromAsciiMap(['~']), outdoors: true });
        expect(inside.changed).toEqual([]);
        expect(outside.changed).toHaveLength(1);
    });

    test('quien está en el agua y recibe frío se queda helado; en el hielo, el trueno lo tira', () => {
        expect(comboFor({ element: 'frio', standingOn: 'water' })).toEqual({ add: 'Restrained', rounds: 1, remove: 'Mojado', line: 'se queda helado' });
        expect(comboFor({ element: 'trueno', standingOn: 'ice' })?.add).toBe('Prone');
        expect(comboFor({ element: 'fuego', conditions: ['Restrained'] })?.remove).toBe('Restrained');
        expect(comboFor({ element: 'veneno', standingOn: 'water' })).toBeNull();
    });
});

describe('R4: el grimorio', () => {
    test('los conjuros de siempre siguen ahí, con su id de fila de datos como alias', () => {
        expect(spellById('rayo_de_fuego')?.id).toBe('hab-rayo-fuego');
        expect(spellById('curar_heridas')?.name).toBe('Curar heridas');
        expect(spellById('hab-espinas')?.school).toBe('naturaleza');
        expect(spellById('no-existe')).toBeNull();
    });

    test('cada conjuro se resuelve con las piezas del motor, y los ids no se repiten', () => {
        const ids = SPELLS.flatMap(s => [s.id, ...(s.aliases ?? [])]);
        expect(new Set(ids).size).toBe(ids.length);
        for (const spell of SPELLS) {
            const ability = normalizeAbility(spellAbility(spell));
            expect(ability.name).toBe(spell.name);
            expect(Object.keys(SCHOOLS)).toContain(spell.school);
        }
        expect(spellAbility(spellById('mag-bola-fuego'))).toMatchObject({ circle: 3, component: 'Azufre', school: 'evocacion' });
    });

    test('lo que sabe cada clase depende de su nivel: el segundo círculo desde el 3, el tercero desde el 5', () => {
        const l1 = spellsForClass({ className: 'Mago', level: 1 });
        expect(l1).toEqual(expect.arrayContaining(['hab-rayo-fuego', 'hab-sueno']));
        expect(l1).not.toContain('mag-cono-escarcha');
        expect(spellsForClass({ className: 'Mago', level: 3 })).toContain('mag-cono-escarcha');
        expect(spellsForClass({ className: 'Mago', level: 5 })).toContain('mag-bola-fuego');
        expect(spellsForClass({ className: 'Guerrero', level: 9 })).toEqual([]);
        expect(spellsForClass({ className: 'Druida', level: 1 })).toContain('hab-espinas');
    });

    test('las cargas: tres de primero, dos de segundo y una de tercero; los trucos no gastan', () => {
        const mage = { level: 5, spellCharges: {} };
        expect(chargesLeft(mage, 1)).toBe(3);
        const once = { ...mage, spellCharges: spendCharge(mage, 3) };
        const spent = { ...once, spellCharges: spendCharge(once, 1) };
        expect(chargesLeft(spent, 3)).toBe(0);
        expect(chargesLeft(spent, 1)).toBe(2);
        expect(chargesLeft(spent, 0)).toBe(Infinity);
        expect(describeCharges(spent)).toBe('Cargas: 1.º 2/3 · 2.º 2/2 · 3.º 0/1');
    });

    test('lanzar pide nivel, cargas y lo que se gasta', () => {
        const fire = spellAbility(spellById('mag-bola-fuego'));
        expect(canCast({ member: { level: 3 }, spell: fire }).reason).toMatch(/desde el nivel 5/);
        expect(canCast({ member: { level: 5 }, spell: fire }).reason).toMatch(/Hace falta Azufre/);
        expect(canCast({ member: { level: 5 }, spell: fire, carried: ['azufre'] }).ok).toBe(true);
        expect(canCast({ member: { level: 5, spellCharges: { 3: 1 } }, spell: fire, carried: ['Azufre'] }).reason).toMatch(/Sin cargas/);
    });

    test('el narrador solo oye de magia si alguien la hace', () => {
        expect(magicLine([{ abilities: ['hab-embate'] }])).toBe('');
        expect(magicLine([{ abilities: ['rayo_de_fuego', 'hab-sueno'] }])).toBe('[MAGIA] Lo que el grupo sabe lanzar: Rayo de fuego, Sueño pesado. No existe otra magia: si alguien intenta otra cosa, no pasa nada.');
    });

    test('una fila de datos no puede ser magia: ni escuela, ni círculo, ni el nombre de un conjuro', () => {
        expect(magicInData({ name: 'Bola de hielo', school: 'evocacion' })).toMatch(/solo existe en el grimorio/);
        expect(magicInData({ id: 'mi-bola', name: 'Bola de fuego' })).toMatch(/mag-bola-fuego/);
        expect(magicInData({ id: 'tec-barrido', name: 'Barrido' })).toBe('');
    });

    test('ninguna habilidad escrita en datos es magia (compendio, reglas de serie y 1387)', async () => {
        const read = (/** @type {string} */ p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
        const rows = [
            ...read('../public/compendio/habilidades.json').rows,
            ...(read('../public/mundos/1387.pack.json').abilities ?? []),
        ];
        const { DEFAULT_RULESET } = await import('../public/scripts/game-engine/rules/default-ruleset.js');
        const found = [...rows, ...(DEFAULT_RULESET.abilities ?? [])].map(magicInData).filter(Boolean);
        expect(found).toEqual([]);
    });
});

describe('R5: la mascota', () => {

    test('se lee con tolerancia, y sin especie o sin nombre no hay mascota', () => {
        expect(readPet(null)).toBeNull();
        expect(readPet({ name: 'Graznido', species: 'dragon' })).toBeNull();
        const pet = readPet({ name: 'Graznido', species: 'Cuervo', character: 'CINICA' });
        expect(pet).toMatchObject({ name: 'Graznido', species: 'cuervo', character: 'cinica', bond: 0 });
        expect(describePet(/** @type {any} */ (pet))).toBe('Graznido, el cuervo · cínica · vínculo 0 · habla · distraer');
    });

    test('solo hablan algunas (DR5): el cuervo habla; el perro, con gestos', () => {
        const crow = /** @type {any} */ (createPet({ name: 'Graznido', species: 'cuervo', character: 'cinica' }));
        const dog = /** @type {any} */ (createPet({ name: 'Canela', species: 'perro' }));
        expect(petComment({ pet: crow, category: 'gremio', random: () => 0 })).toBe('🐾 [MASCOTA] Graznido, el cuervo: «Otra semana sin cobrar, y tú tan tranquilo.»');
        expect(petComment({ pet: dog, category: 'viaje', random: () => 0 })).toBe('🐾 [MASCOTA] Canela va delante, y vuelve, y va delante otra vez.');
    });

    test('no repite la última frase, y no habla más de una vez cada rato', () => {
        let crow = /** @type {any} */ (createPet({ name: 'Graznido', species: 'cuervo', character: 'cinica' }));
        const first = petComment({ pet: crow, category: 'gremio', random: () => 0 });
        crow = afterComment(crow, first, 10);
        expect(petComment({ pet: crow, category: 'gremio', random: () => 0 })).not.toBe(first);
        expect(shouldComment({ pet: crow, category: 'hilo', now: 12, random: () => 0 })).toBe(false);
        expect(shouldComment({ pet: crow, category: 'hilo', now: 20, random: () => 0 })).toBe(true);
        expect(shouldComment({ pet: crow, category: 'combate', now: 20, random: () => 0.5 })).toBe(false);
    });

    test('preguntarle es la ayuda del juego con cara: dice lo que aprieta con su voz', () => {
        const crow = /** @type {any} */ (createPet({ name: 'Graznido', species: 'cuervo', character: 'leal' }));
        const said = petAdvice({ pet: crow, urgent: { title: 'La deuda con Keller', in: 2 }, next: { in: 1, text: 'la cuenta' } });
        expect(said).toBe('🐾 [MASCOTA] Graznido, el cuervo: «Escucha: lo que más aprieta es «La deuda con Keller», en 2 días; mañana: la cuenta.»');
        const dog = /** @type {any} */ (createPet({ name: 'Canela', species: 'perro' }));
        expect(petAdvice({ pet: dog })).toMatch(/Canela te mira, bosteza/);
    });

    test('ayuda sin pelear (DR6), y aprende con el vínculo', () => {
        let dog = /** @type {any} */ (createPet({ name: 'Canela', species: 'perro' }));
        expect(supportActions(dog).map(a => a.id)).toEqual(['avisar']);
        let said = '';
        for (let i = 0; i < 10; i++) {
            const step = liveTogether(dog);
            dog = step.pet;
            if (step.line) said = step.line;
        }
        expect(dog.bond).toBe(2);
        expect(supportActions(dog).map(a => a.id)).toEqual(['avisar', 'distraer']);
        expect(said).toMatch(/ya sabe distraer/);
    });

    test('fuera del combate, cada una a lo suyo; y se ofrecen según el mundo', () => {
        expect(petDoes(/** @type {any} */ (createPet({ name: 'C', species: 'perro' })), 'olfato')).toBe(true);
        expect(petDoes(/** @type {any} */ (createPet({ name: 'H', species: 'halcon' })), 'explora')).toBe(true);
        expect(petDoes(null, 'guardia')).toBe(false);
        expect(petChoicesFor('Terror')).toEqual(['cuervo', 'gato', 'perro']);
        expect(petChoicesFor('Histórico')).toEqual(['perro', 'halcon', 'cuervo']);
        expect(tamableAs('Lobo famélico')).toBe('perro');
        expect(tamableAs('Infantería de Keller')).toBe('');
    });
});

describe('R6: tableros con intención', () => {
    const rows = [
        { name: 'Lobo', hpFactor: 0.85, acBonus: 1, profile: 'skirmisher' },
        { name: 'Oso', hpFactor: 1.4, profile: 'aggressive' },
        { name: 'Lobo alfa', hpFactor: 1, profile: 'aggressive', tags: ['alfa'] },
        { name: 'Rata gigante', hpFactor: 0.5 },
    ];
    const options = rows.map(r => ({ name: r.name, threat: threatOf(r) }));

    test('la amenaza sale de los números del bestiario, y un jefe pesa casi el doble', () => {
        expect(threatOf(rows[0])).toBe(9);
        expect(threatOf(rows[2])).toBeGreaterThan(threatOf({ hpFactor: 1, profile: 'aggressive' }) * 1.7);
        expect(threatOf({})).toBe(10);
        // Las fichas del mundo: su desafío, o su vida.
        expect(threatOf({ name: 'Infantería', cr: 1 })).toBe(15);
        expect(threatOf({ name: 'Capitán', cr: 1, boss: true })).toBe(27);
        expect(threatOf({ name: 'Rata', maxHp: 8 })).toBe(4);
    });

    test('el presupuesto crece con el nivel, el grupo y el encargo; Supervivencia aprieta más', () => {
        const base = budgetFor({ partyLevel: 1, partySize: 2, difficulty: 1 });
        expect(budgetFor({ partyLevel: 3, partySize: 2, difficulty: 1 })).toBeGreaterThan(base);
        expect(budgetFor({ partyLevel: 1, partySize: 4, difficulty: 1 })).toBe(base * 2);
        expect(budgetFor({ partyLevel: 1, partySize: 2, difficulty: 1, letters: 'abcdef' })).toBeGreaterThan(base);
        expect(budgetFor({ partyLevel: 1, partySize: 2, difficulty: 1, letters: 'abc' })).toBeLessThan(base);
    });

    test('se eligen enemigos que caben, y siempre al menos uno', () => {
        const picked = pickByBudget({ options, budget: 30, random: createSeededRandom('lobos') });
        expect(picked.spent).toBeLessThanOrEqual(30);
        expect(picked.names.length).toBeGreaterThan(0);
        expect(pickByBudget({ options, budget: 1, random: () => 0 }).names).toEqual(['Rata gigante']);
    });

    test('el sitio manda en lo que trae: una cripta, sarcófagos y losas; una costa, agua', () => {
        expect(dressingFor('Cripta de los Ahogados')).toEqual({ dress: { C: 2 }, traps: ['losa', 'dardos'] });
        expect(dressingFor('costa').dress).toEqual({ w: 5 });
        expect(dressingFor('Casa del herrero')).toEqual({ dress: {}, traps: [] });
    });

    for (const purpose of ['cull', 'hunt', 'escort', 'recover', 'hold', 'steal']) {
        test(`${purpose}: 150 semillas, y todas salen jugables y divertidas`, () => {
            /** @type {string[]} */
            const failed = [];
            let badTraps = 0;
            let badSpots = 0;
            for (let i = 0; i < 150; i++) {
                const made = generateIntended({
                    randomFor: attempt => createSeededRandom(`${purpose}-${i}-${attempt}`),
                    generate: generateBoard,
                    purpose,
                    site: ['cripta', 'bosque', 'mina', 'costa'][i % 4],
                    options,
                    budget: budgetFor({ partyLevel: 2, partySize: 3, difficulty: 1 }),
                    board: { size: i % 3 === 0 ? 'large' : 'medium', partySize: 3 },
                });
                if (made.issues.length > 0) failed.push(`${i}: ${made.issues.join(' ')}`);
                // Todas las trampas avisan, y los enemigos no pisan muros.
                badTraps += made.hazards.filter((/** @type {any} */ h) => !h.tell).length;
                badSpots += made.enemies.filter((/** @type {any} */ e) => made.map[e.y][e.x] !== '.').length;
            }
            expect({ failed, badTraps, badSpots }).toEqual({ failed: [], badTraps: 0, badSpots: 0 });
        });
    }

    test('robar: la cosa está en la sala más lejana, detrás de una puerta con llave', () => {
        let found = 0;
        for (let i = 0; i < 40; i++) {
            const made = generateIntended({ randomFor: a => createSeededRandom(`robo-${i}-${a}`), generate: generateBoard, purpose: 'steal', options, budget: 40, board: { size: 'medium', partySize: 2 } });
            if (made.lockedDoor && made.target) found++;
        }
        expect(found).toBeGreaterThan(30);
    });

    test('aguantar: parte de los enemigos llega en la ronda 3, con aviso', () => {
        const made = generateIntended({ randomFor: a => createSeededRandom(`aguante-${a}`), generate: generateBoard, purpose: 'hold', options, budget: 60, board: { size: 'large', partySize: 3 } });
        expect(made.waves[0]).toMatchObject({ round: 3, tell: 'Se oyen pasos que vienen del fondo.' });
        expect(made.waves[0].names.length).toBeGreaterThan(0);
    });
});

describe('R7: enemigos con cabeza', () => {
    test('cada uno tiene su papel, sacado de su ficha', () => {
        expect(roleOf({ name: 'Lobo alfa', tags: ['alfa'] })).toBe('lider');
        expect(roleOf({ name: 'Cultista' }, [{ healing: '1d8', target: 'ally' }])).toBe('sanador');
        expect(roleOf({ name: 'Arquero', profile: 'skirmisher' })).toBe('tirador');
        expect(roleOf({ name: 'Oso', hpFactor: 1.4 })).toBe('tanque');
        expect(roleOf({ name: 'Rata' })).toBe('bruto');
        expect(roleOf({ name: 'Cualquiera', role: 'tirador' })).toBe('tirador');
    });

    test('el tirador va a por el más débil que tiene a tiro; el tanque, a por el más cercano', () => {
        const options = [
            { id: 'bruna', distanceFeet: 5, reachable: true, hpFraction: 0.9 },
            { id: 'lyra', distanceFeet: 30, reachable: true, hpFraction: 0.3 },
            { id: 'lejos', distanceFeet: 200, reachable: true, hpFraction: 0.1 },
        ];
        expect(pickTarget('tirador', options, 60)).toBe('lyra');
        expect(pickTarget('tanque', options, 5)).toBe('bruna');
        expect(pickTarget('lider', options, 5)).toBe('bruna');
        expect(pickTarget('bruto', [], 5)).toBe('');
    });

    test('el líder empuja a quien tiene cerca; si cae, los malheridos huyen', () => {
        const allies = [{ id: 'l', x: 5, y: 5, hp: 10, role: 'lider' }, { id: 'b', x: 6, y: 6, hp: 4, role: 'bruto' }];
        expect(leaderBonus({ id: 'b', x: 6, y: 6 }, allies)).toBe(1);
        expect(leaderBonus({ id: 'b', x: 9, y: 9 }, allies)).toBe(0);
        expect(leaderBonus({ id: 'b', x: 6, y: 6 }, [{ ...allies[0], hp: 0 }])).toBe(0);
        expect(breaksAndRuns({ hp: 3, maxHp: 10, role: 'bruto' }, true)).toBe(true);
        expect(breaksAndRuns({ hp: 3, maxHp: 10, role: 'bruto' }, false)).toBe(false);
        expect(breaksAndRuns({ hp: 3, maxHp: 10, role: 'bruto', boss: true }, true)).toBe(false);
    });

    test('cada bando pelea a su manera, y se dice al empezar', () => {
        expect(tacticOf({ name: 'Lobo famélico' })?.id).toBe('rodear');
        expect(tacticOf({ name: 'Infantería de Keller 1' })?.id).toBe('linea');
        expect(tacticOf({ name: 'Rata' })).toBeNull();
        expect(flankCell({ x: 5, y: 5 }, { x: 4, y: 5 })).toEqual({ x: 6, y: 5 });
        expect(describeBand([{ name: 'Lobo alfa', role: 'lider' }, { name: 'Lobo', role: 'bruto' }], tacticOf({ name: 'Lobo' })))
            .toBe('Lobo alfa manda; rodean: buscan el flanco antes de morder.');
    });
});

describe('R7: la némesis', () => {
    test('quien escapa se lleva una cicatriz y rencor; si vuelve a escapar, sube', () => {
        const first = noteEscape({ raw: [], name: 'Capitán Rulf 1', cause: 'fuego', grudge: 'Ulrich', day: 3 });
        expect(first.line).toBe('Capitán Rulf escapa con la cara quemada, y se acordará de Ulrich.');
        const again = noteEscape({ raw: first.list, name: 'Capitán Rulf', day: 9 });
        expect(readNemeses(again.list)[0]).toMatchObject({ times: 2, since: 9 });
    });

    test('como mucho tres a la vez', () => {
        let list = /** @type {any[]} */ ([]);
        for (const name of ['A', 'B', 'C', 'D']) list = noteEscape({ raw: list, name, day: 1 }).list;
        expect(readNemeses(list).map(n => n.name)).toEqual(['A', 'B', 'C']);
    });

    test('vuelve pasados cinco días, más fuerte, y el narrador lo sabe', () => {
        const { list } = noteEscape({ raw: [], name: 'Rulf', grudge: 'Ulrich', day: 3 });
        expect(whoReturns({ raw: list, today: 5, random: () => 0 })).toBeNull();
        const back = whoReturns({ raw: list, today: 9, random: () => 0 });
        expect(back?.name).toBe('Rulf');
        const said = comeback(/** @type {any} */ (back));
        expect(said.hpFactor).toBe(1.25);
        expect(said.line).toMatch(/^😈 Rulf vuelve, con una mirada que no olvida\. «¿Os acordáis de mí\?/u);
        expect(said.forModel).toMatch(/^\[NÉMESIS\] Rulf vuelve: ya escapó una vez .*cuentas pendientes con Ulrich/);
    });

    test('si cae, se acaba', () => {
        const { list } = noteEscape({ raw: [], name: 'Rulf', day: 3 });
        const fell = nemesisFalls(list, 'Rulf 2');
        expect(fell.line).toBe('Rulf cae por fin. Después de una huida, se acabó.');
        expect(whoReturns({ raw: fell.list, today: 99, random: () => 0 })).toBeNull();
    });
});

describe('R8: compañeros con arco', () => {
    test('cumplir lo suyo deja un rasgo según lo que busca, una vez', () => {
        const done = completeArc({ name: 'Bruna', perks: ['rama:marcial:filo:1'] }, 'glory');
        expect(done?.perks).toEqual(['rama:marcial:filo:1', 'arco:glory']);
        expect(done?.line).toBe('Bruna ya no es quien era: sin miedo (+1 al ataque: ya no tiene nada que demostrar.)');
        expect(completeArc({ name: 'Bruna', perks: ['arco:glory'] }, 'coin')).toBeNull();
        expect(completeArc({ name: 'X' }, 'nada')).toBeNull();
        // El rasgo suma donde suman las mejoras de siempre.
        expect(perkBonus({ perks: ['arco:glory'] }, 'attack')).toBe(1);
        expect(perkBonus({ perks: ['arco:knowledge'] }, 'skill', 'investigation')).toBe(2);
    });

    test('la gente de aquí que os aprecia hace favores de su oficio', () => {
        const npcs = [
            { name: 'Marta', where: 'El Pueblo de Barro', service: 'posada' },
            { name: 'Anselmo', where: 'El Pueblo de Barro', service: 'herrería' },
            { name: 'Lejano', where: 'Otro sitio', service: 'tienda' },
            { name: 'Tibio', where: 'El Pueblo de Barro', service: 'tienda' },
        ];
        const favors = homeFavors({ npcs, attitudes: { values: { Marta: 2, Anselmo: 3, Lejano: 5, Tibio: 1 } }, here: 'El Pueblo de Barro' });
        expect(favors.map(f => `${f.name}: ${f.favor}`)).toEqual(['Marta: una noche gratis por semana', 'Anselmo: la herrería un 25 % más barata']);
        expect(favorDiscount(favors, 'herreria')).toEqual({ discount: 0.25, who: 'Anselmo' });
        expect(favorDiscount(favors, 'tienda')).toEqual({ discount: 0, who: '' });
    });

    test('quien se fue harto puede volver pasadas dos semanas, sin sus disgustos', () => {
        const gone = noteGone([], { name: 'Kael', hp: 12, unpaidWeeks: 3 }, 10, 'sin cobrar');
        expect(whoComesBack({ raw: gone, today: 20, random: () => 0 })).toBeNull();
        const back = whoComesBack({ raw: gone, today: 25, random: () => 0 });
        expect(back?.name).toBe('Kael');
        const said = comebackOf(/** @type {any} */ (back));
        expect(said.member).toMatchObject({ name: 'Kael', hp: 12, unpaidWeeks: 0 });
        expect(said.forModel).toMatch(/^\[VUELVE\] Kael, que se fue porque no cobraba/);
        expect(forgetGone(gone, 'Kael')).toEqual([]);
    });
});

describe('R9: el mundo que responde', () => {
    const chronicle = [
        { tag: 'COMBAT', category: 'combate', text: 'Ulrich ataca al guardia.' },
        { tag: 'CASO', category: 'hilo', text: 'Fue Marta. Encaja todo. (60 de oro)' },
        { tag: 'GUARDIAS', category: 'mundo', text: 'Alguien os ha visto usar nigromancia en el Pueblo de Barro: ahora os buscan (buscados: 1).' },
        { tag: 'TIENDA', category: 'comercio', text: 'Compráis una cuerda.' },
        { tag: 'MUERTE', category: 'grupo', text: 'Bruna cayó en el paso, luchando.' },
    ];

    test('lo que hicisteis se cuenta en las tabernas, lo último primero y sin repetir', () => {
        const rumors = rumorsFromPlay(chronicle);
        expect(rumors.map(r => r.text)).toEqual([
            'Se habla de una muerte: Bruna cayó en el paso, luchando.',
            'Andan diciendo que unos forasteros usan artes de muertos.',
            'Dicen que unos forasteros han resuelto un caso: fue Marta.',
        ]);
        const again = rumorsFromPlay(chronicle, { told: rumors.map(r => r.id) });
        expect(again).toEqual([]);
    });

    test('la memoria del narrador lee lo último que pasó de verdad, no lo menor', () => {
        expect(chronicleMemory(chronicle, 2)).toBe('Lo último que pasó: Alguien os ha visto usar nigromancia en el Pueblo de Barro: ahora os buscan (buscados: 1) · Bruna cayó en el paso, luchando.');
        expect(chronicleMemory([{ category: 'combate', text: 'x' }])).toBe('');
    });

    test('quien manda donde pasa algo lo nota: un caso resuelto sube, un crimen o la nigromancia bajan', () => {
        expect(reactionTo('caso-acierto')).toBe(1);
        expect(reactionTo('nigromancia')).toBe(-1);
        expect(reactionTo('nada')).toBe(0);
    });
});

describe('R4: pergaminos y varitas', () => {
    const member = {
        class: 'Guerrero',
        items: [
            { id: 'p1', name: 'Pergamino de Bola de fuego' },
            { id: 'w1', name: 'Varita de escarcha', charges: 2 },
            { id: 'w2', name: 'Varita de destellos', charges: 0 },
            { id: 'x', name: 'Cuerda' },
        ],
    };
    const abilityOf = (/** @type {string} */ id) => spellAbility(/** @type {any} */ (spellById(id)));

    test('lo mágico que se lleva, con lo que le queda; una varita sin cargas ya no cuenta', () => {
        expect(magicItemsOf(member).map(i => `${i.name}:${i.left}`)).toEqual(['Pergamino de Bola de fuego:1', 'Varita de escarcha:2']);
    });

    test('se usa como una maniobra, con sus objetivos a tiro', () => {
        const enemies = [{ id: 'e1', name: 'Lobo', distanceFeet: 30 }, { id: 'e2', name: 'Oso', distanceFeet: 200 }];
        const [scroll, wand] = judgeMagicItems({ member, hasAction: true, enemies, allies: [], abilityOf });
        expect(scroll).toMatchObject({ id: 'leer:p1', label: 'Leer Pergamino de Bola de fuego', enabled: true, needsTarget: true });
        expect(scroll.targets.map(t => t.name)).toEqual(['Lobo']);
        // El cono llega a 15 pies: el lobo, a 30, no.
        expect(wand).toMatchObject({ label: 'Varita de escarcha (2)', enabled: false });
        expect(judgeMagicItems({ member, hasAction: false, enemies, allies: [], abilityOf })[0].enabled).toBe(false);
    });

    test('el pergamino se gasta; la varita pierde una carga y sin ninguna se apaga', () => {
        expect(afterUse({ name: 'Pergamino de Bola de fuego' })).toEqual({ remove: true, charges: 0, line: 'Pergamino de Bola de fuego se deshace en ceniza.' });
        expect(afterUse({ name: 'Varita de escarcha', charges: 2 })).toEqual({ remove: false, charges: 1, line: 'A Varita de escarcha le quedan 1.' });
        expect(afterUse({ name: 'Varita de escarcha', charges: 1 }).remove).toBe(true);
    });

    test('quien ha estudiado puede aprender el conjuro de un pergamino, una vez', () => {
        const scroll = { name: 'Pergamino de Sueño pesado' };
        expect(canLearnScroll({ class: 'Guerrero' }, scroll).ok).toBe(false);
        expect(canLearnScroll({ class: 'Erudito' }, scroll)).toEqual({ ok: true, reason: '', spell: 'hab-sueno' });
        expect(canLearnScroll({ class: 'Maga', abilities: ['hab-sueno'] }, scroll).reason).toBe('Ese conjuro ya lo sabe.');
    });
});

describe('R6: jefes con fases', () => {
    test('solo los jefes, una vez, y al bajar de la mitad', () => {
        expect(bossPhase({ enemy: { name: 'Lobo', currentHp: 2, maxHp: 10 } })).toBeNull();
        expect(bossPhase({ enemy: { name: 'Garth', boss: true, currentHp: 6, maxHp: 10 } })).toBeNull();
        expect(bossPhase({ enemy: { name: 'Garth', boss: true, currentHp: 4, maxHp: 10, phased: true } })).toBeNull();
    });

    test('el que manda llama a los suyos; el que aguanta se acorrala; el que ataca se enfurece', () => {
        const leader = bossPhase({ enemy: { name: 'Capitán 1', role: 'lider', currentHp: 4, maxHp: 10 }, band: ['Perro', 'Guardia'] });
        expect(leader).toEqual({ kind: 'refuerzos', line: 'Capitán 1, malherido, da una voz: llegan dos de los suyos.', patch: { phased: true }, summon: ['Perro', 'Perro'] });
        const wall = bossPhase({ enemy: { name: 'Golem', boss: true, profile: 'guardian', armorClass: 14, currentHp: 5, maxHp: 20 } });
        expect(wall?.patch).toEqual({ phased: true, armorClass: 16, speed: 0 });
        const angry = bossPhase({ enemy: { name: 'Garth', boss: true, profile: 'aggressive', currentHp: 5, maxHp: 20 } });
        expect(angry).toMatchObject({ kind: 'furia', patch: { phased: true, rage: 2 } });
    });
});

describe('R6: barriles, cofres y piezas con propósito', () => {
    test('el fuego revienta un barril (y lo dice), y el fuego que se extiende también lo prende', () => {
        const out = reactTerrain({ element: 'fuego', cells: [{ x: 0, y: 0 }], terrain: terrainFromAsciiMap(['T']) });
        expect(out.changed).toEqual([{ x: 0, y: 0, from: 'barrel', to: 'floor' }]);
        expect(out.lines[0]).toBe('🔥 Revienta un barril.');
        expect(flammable({ type: 'barrel' }, false)).toBe(true);
    });

    test('un cofre no se pisa, cubre y se dice lo que es', () => {
        const terrain = terrainFromAsciiMap(['.k.']);
        expect(isPassable(terrain, 1, 0, 3, 1)).toBe(false);
        expect(describeCell(terrain, 1, 0)).toBe('Casilla (2, 1) · Cofre: estando al lado, se abre pulsándolo');
    });

    test('la sala del fondo trae un cofre que no corta el paso', () => {
        let withChest = 0;
        for (let i = 0; i < 30; i++) {
            const made = generateIntended({ randomFor: a => createSeededRandom(`cofre-${i}-${a}`), generate: generateBoard, purpose: 'recover', options: [{ name: 'Lobo', threat: 9 }], budget: 20, board: { size: 'medium', partySize: 2 } });
            if (made.map.some((/** @type {string} */ row) => row.includes('k'))) withChest++;
            expect(made.issues).toEqual([]);
        }
        expect(withChest).toBeGreaterThan(20);
    });

    test('las salas escritas se leen con la leyenda: el pozo es agua, la cámara trae cofre y barriles', () => {
        const rows = JSON.parse(fs.readFileSync(new URL('../public/compendio/sitios.json', import.meta.url), 'utf8')).rows.filter((/** @type {any} */ r) => r.kind === 'sala');
        const legend = new Set(['.', '#', ' ', ...Object.keys(ASCII_TERRAIN)]);
        for (const row of rows) for (const line of row.rows) for (const ch of line) expect(legend.has(ch)).toBe(true);
        expect(rows.find((/** @type {any} */ r) => r.id === 'sala-camara')?.when?.purpose).toEqual(['steal', 'recover']);
        expect(rows.find((/** @type {any} */ r) => r.id === 'sala-pozo')?.rows.join('')).toMatch(/www/);
    });
});

describe('T6: domar por dato, no por nombre', () => {
    test('manda el dato: un oso marcado se doma, un lobo marcado que no, no', () => {
        expect(tamableAs({ name: 'Oso pardo', domable: 'perro' })).toBe('perro');
        expect(tamableAs({ name: 'Lobo', domable: '' })).toBe('');
        expect(tamableAs({ name: 'Lobo', domable: 'no' })).toBe('');
        expect(tamableAs({ name: 'Rata', domable: 'Halcón' })).toBe('halcon');
    });

    test('sin el dato, el nombre, como antes: los mundos viejos siguen igual', () => {
        expect(tamableAs({ name: 'Cuervo grande' })).toBe('cuervo');
        expect(tamableAs('Lobo famélico')).toBe('perro');
        expect(tamableAs({ name: 'Infantería de Keller' })).toBe('');
    });

    test('el bestiario de serie lo dice por escrito, y en especies que existen', () => {
        const rows = JSON.parse(fs.readFileSync(new URL('../public/compendio/bestiario.json', import.meta.url), 'utf8')).rows;
        const marked = rows.filter((/** @type {any} */ r) => r.domable !== undefined);
        expect(marked.map((/** @type {any} */ r) => `${r.id}:${r.domable}`).sort()).toEqual([
            'bestia-cuervo:cuervo', 'bestia-gato-montes:gato', 'bestia-halcon:halcon', 'bestia-lobo:perro', 'bestia-zorro:zorro',
        ]);
        for (const row of marked) expect(tamableAs(row)).toBe(row.domable);
    });

    test('el generador copia el dato de su fila, y las plantillas no lo cambian', () => {
        const compendium = createCompendium({ bestiario: [
            { id: 'a-oso', name: 'Oso', kind: 'arquetipo', domable: 'perro', weight: 1 },
            { id: 'p-viejo', name: 'viejo', kind: 'plantilla', weight: 1 },
        ] });
        for (const templates of [0, 1]) {
            const monster = breedMonster({ compendium, templates, random: () => 0.3 });
            expect(monster?.domable).toBe('perro');
        }
        const plain = createCompendium({ bestiario: [{ id: 'a-rata', name: 'Rata', kind: 'arquetipo', weight: 1 }] });
        expect(breedMonster({ compendium: plain, templates: 0, random: () => 0.3 })).not.toHaveProperty('domable');
    });

    test('el paquete lo trae, el importador lo escribe y el comprobador lo cuenta', () => {
        const schema = /** @type {any} */ (getSectionSchema('bestiary'));
        expect(schema.items.properties.domable.enum).toEqual(expect.arrayContaining(['perro', 'cuervo', '']));
        const pack = normalizePack({ bestiary: [{ name: 'Oso', domable: 'perro' }, { name: 'Lobo', domable: '' }, { name: 'Sombra' }] }).pack;
        const entries = buildPackEntries(pack).filter((/** @type {any} */ e) => e.group === 'Monsters');
        expect(entries.map((/** @type {any} */ e) => e.dndData.domable)).toEqual(['perro', '', undefined]);
        const report = checkWorldDensity({ world: { name: 'Prueba' }, bestiary: [{ name: 'Oso', domable: 'perro' }, { name: 'Lobo', domable: '' }, { name: 'Cuervo' }] });
        expect(report.counts).toContain('· Bestias que se pueden domar: 2');
    });
});
