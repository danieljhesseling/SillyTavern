/**
 * E1 de wiki/ROADMAP_ENTRETENIDO.md: el tablero que se usa. Otras formas de ganar (escapar con
 * plazo, romper objetos, defender, proteger con oleadas, robar sin despertar), empujar donde
 * duele y las superficies que reaccionan.
 */
import { describe, test, expect } from '@jest/globals';
import {
    evaluateObjective, evaluateScenario, normalizeObjectives, describeObjectives, deadlineText,
} from '../public/scripts/game-engine/campaign/scenarios.js';
import {
    buildBoardState, judgeScenario, lastRoundFor, wantsEscape, heldCellsOf, leftToDo,
} from '../public/scripts/game-engine/combat/scenario-board.js';
import {
    isAsleep, sleepersOf, awakeOf, wakeAll, sleeperDC, sleepersNear, sneakPast,
} from '../public/scripts/game-engine/board/sleepers.js';
import { fallDice, pushGround, landing, firstIce } from '../public/scripts/game-engine/board/falls.js';
import { pushTrail } from '../public/scripts/game-engine/combat/ai-2024.js';
import { terrainFromAsciiMap, getMovementCost } from '../public/scripts/game-engine/board/terrain.js';
import { waterArc, isLightning } from '../public/scripts/game-engine/rules/tags.js';
import { planEnemyTurn, isObjectFoe } from '../public/scripts/game-engine/combat/enemy-ai.js';
import { adjustPlacements, adjustForSize } from '../public/scripts/game-engine/combat/level-adjust.js';
import { buildImportPlan, wavesFromPack, wardFromPack } from '../public/scripts/game-engine/campaign/campaign-importer.js';
import { validatePack } from '../public/scripts/game-engine/campaign/campaign-pack.js';

const ally = (id, hp, x = 0, y = 0, extra = {}) => ({ id, currentHp: hp, gridX: x, gridY: y, ...extra });
const foe = (id, hp, x = 5, y = 5, extra = {}) => ({ id, currentHp: hp, gridX: x, gridY: y, ...extra });

describe('E1.1: el plazo de un objetivo', () => {
    const [ritual] = normalizeObjectives([{ type: 'eliminate', targetIds: ['cristal'], beforeRound: 5, label: 'Romper los cristales' }]);

    test('pendiente antes de la ronda del plazo; perdido al empezar esa ronda', () => {
        const live = { enemies: [foe('cristal', 5)], allies: [ally('1', 10)] };
        expect(evaluateObjective(ritual, { ...live, round: 4 })).toBe('pending');
        expect(evaluateObjective(ritual, { ...live, round: 5 })).toBe('failed');
    });

    test('hecho a tiempo, se queda hecho', () => {
        expect(evaluateObjective(ritual, { round: 6, enemies: [foe('cristal', 0)], allies: [ally('1', 10)] })).toBe('complete');
    });

    test('el plazo se ve en la cabecera y en el resumen', () => {
        expect(deadlineText(ritual)).toBe(' (antes de la ronda 5)');
        const board = { round: 2, enemies: [foe('cristal', 5)], allies: [ally('1', 10)] };
        expect(judgeScenario([ritual], board).rows[0].label).toBe('Romper los cristales (antes de la ronda 5)');
        expect(describeObjectives([ritual], board)).toContain('(antes de la ronda 5)');
    });

    test('se avisa una ronda antes, y solo si aún falta', () => {
        const board = { round: 4, enemies: [foe('cristal', 5)], allies: [ally('1', 10)] };
        expect(lastRoundFor([ritual], board)).toEqual(['Romper los cristales']);
        expect(lastRoundFor([ritual], { ...board, round: 3 })).toEqual([]);
        expect(lastRoundFor([ritual], { ...board, enemies: [foe('cristal', 0)] })).toEqual([]);
    });

    test('sobrevivir, defender, proteger y sin despertar no llevan plazo', () => {
        const list = normalizeObjectives([
            { type: 'survive_rounds', rounds: 4, beforeRound: 3 },
            { type: 'protect', allyName: 'Ana', beforeRound: 3 },
        ]);
        expect(list.every(o => o.beforeRound === undefined)).toBe(true);
    });
});

describe('E1.1: escapar', () => {
    const objectives = [{ type: 'escape', label: 'Salir todos por la ventana', beforeRound: 5 }];

    test('se gana cuando han salido todos los que siguen en pie', () => {
        const allies = [ally('1', 10), ally('2', 5), ally('3', 0)];
        const board = buildBoardState({ round: 3, enemies: [{ instanceId: 'g', currentHp: 9 }], party: [] });
        const state = { ...board, allies, left: ['1'] };
        expect(evaluateScenario(objectives, state).status).toBe('active');
        expect(evaluateScenario(objectives, { ...state, left: ['1', '2'] }).status).toBe('complete');
    });

    test('se pierde si al empezar la ronda 5 aún queda alguien dentro', () => {
        const state = { round: 5, enemies: [foe('g', 9)], allies: [ally('1', 10)], left: [] };
        expect(evaluateScenario(objectives, state).status).toBe('failed');
    });

    test('sin enemigos en pie ya no hace falta correr', () => {
        expect(evaluateScenario(objectives, { round: 2, enemies: [foe('g', 0)], allies: [ally('1', 10)] }).status).toBe('complete');
    });

    test('todos dentro y en el suelo, perdido', () => {
        expect(evaluateScenario(objectives, { round: 2, enemies: [foe('g', 3)], allies: [ally('1', 0)] }).status).toBe('failed');
    });

    test('quién ha salido llega desde la pelea', () => {
        const state = buildBoardState({ round: 2, enemies: [], party: [{ id: 7, hp: 3, name: 'Ana', wiUid: 12 }], left: [7] });
        expect(state.left).toEqual(['7']);
        expect(state.allies[0]).toMatchObject({ id: '7', name: 'Ana', uid: '12' });
    });

    test('un tablero de escapar lo dice', () => {
        expect(wantsEscape(objectives)).toBe(true);
        expect(wantsEscape([{ type: 'escape', optional: true }])).toBe(false);
        expect(wantsEscape([{ type: 'eliminate_all' }])).toBe(false);
    });
});

describe('E1.1: defender unas casillas', () => {
    const objectives = [{ type: 'hold', label: 'Aguantar en la puerta de la cripta', rounds: 4, cells: [{ x: 3, y: 1 }, { x: 4, y: 1 }] }];

    test('si un enemigo pisa lo que se defiende, se pierde', () => {
        expect(evaluateScenario(objectives, { round: 2, enemies: [foe('z', 5, 4, 1)], allies: [ally('1', 9)] }).status).toBe('failed');
    });

    test('uno caído encima no cuenta', () => {
        expect(evaluateScenario(objectives, { round: 2, enemies: [foe('z', 0, 4, 1)], allies: [ally('1', 9)] }).status).toBe('active');
    });

    test('aguantado hasta la ronda, ganado aunque queden enemigos', () => {
        expect(evaluateScenario(objectives, { round: 4, enemies: [foe('z', 5, 6, 6)], allies: [ally('1', 9)] }).status).toBe('complete');
    });

    test('las casillas se leen también de una sola `cell`', () => {
        expect(heldCellsOf([{ type: 'hold', rounds: 3, cell: { x: 2, y: 2 } }])).toEqual([{ x: 2, y: 2 }]);
    });

    test('lo que falta se dice como aguantar', () => {
        expect(leftToDo(objectives, { round: 2, enemies: [], allies: [ally('1', 9)] })).toContain('aguantad hasta la ronda 4');
    });
});

describe('E1.1: proteger a alguien (también por su nombre) y sin despertar a nadie', () => {
    test('proteger encuentra a quien se protege por su nombre o por su entrada del mundo', () => {
        const [byName] = normalizeObjectives([{ type: 'protect', allyName: 'Hermano Lucas' }]);
        const [byUid] = normalizeObjectives([{ type: 'protect', allyId: '44' }]);
        const allies = [ally('9', 0, 0, 0, { name: 'Hermano Lucas', uid: '44' })];
        expect(evaluateObjective(byName, { round: 1, enemies: [], allies })).toBe('failed');
        expect(evaluateObjective(byUid, { round: 1, enemies: [], allies })).toBe('failed');
    });

    test('proteger frente a oleadas: se gana aguantando con él en pie', () => {
        const objectives = [{ type: 'survive_rounds', rounds: 5 }, { type: 'protect', allyName: 'Hermano Lucas' }];
        const allies = [ally('1', 9), ally('9', 4, 0, 0, { name: 'Hermano Lucas' })];
        expect(evaluateScenario(objectives, { round: 5, enemies: [foe('z', 5)], allies }).status).toBe('complete');
        expect(evaluateScenario(objectives, { round: 3, enemies: [foe('z', 5)], allies: [allies[0], { ...allies[1], currentHp: 0 }] }).status).toBe('failed');
    });

    test('sin despertar a nadie es una condición: no gana sola, y se pierde si alguien despierta', () => {
        const objectives = [{ type: 'loot', treasureIds: ['cofre'] }, { type: 'unseen', label: 'Sin despertar a los guardias', optional: true }];
        const board = { round: 1, enemies: [], allies: [ally('1', 9)], collectedTreasures: ['cofre'] };
        const quiet = evaluateScenario(objectives, board);
        expect(quiet.status).toBe('complete');
        expect(quiet.results[1].status).toBe('pending');
        expect(evaluateScenario(objectives, { ...board, awakened: true }).results[1].status).toBe('failed');
        expect(evaluateScenario([{ type: 'unseen' }], board).status).toBe('active');
    });
});

describe('E1.1: los que duermen', () => {
    const placements = [{ name: 'Guardia', x: 5, y: 5, asleep: true }, { name: 'Perro', x: 9, y: 9 }];

    test('se separan los dormidos de los despiertos, y despertar los quita a todos', () => {
        expect(sleepersOf(placements).map(p => p.name)).toEqual(['Guardia']);
        expect(awakeOf(placements).map(p => p.name)).toEqual(['Perro']);
        expect(wakeAll(placements).some(isAsleep)).toBe(false);
        expect(wakeAll(placements)[0]).toEqual({ name: 'Guardia', x: 5, y: 5 });
    });

    test('se oye a quien pasa a 10 pies', () => {
        expect(sleepersNear(placements, { x: 7, y: 5 })).toHaveLength(1);
        expect(sleepersNear(placements, { x: 8, y: 5 })).toHaveLength(0);
    });

    test('su Percepción pasiva, dormido, es 5 menos', () => {
        expect(sleeperDC({ wisdom: 10 })).toBe(5);
        expect(sleeperDC({ wisdom: 14, perception: 4 })).toBe(9);
        expect(sleeperDC(undefined)).toBe(5);
    });

    test('una tirada de Sigilo contra cada uno que oye; el empate no despierta', () => {
        const listeners = [{ name: 'Guardia', dc: 9 }, { name: 'Sargento', dc: 12 }];
        const quiet = sneakPast({ who: 'Mara', modifier: 3, listeners, rollD20: () => 9 });
        expect(quiet.woke).toEqual([]);
        expect(quiet.line).toContain('Nadie se despierta');
        const loud = sneakPast({ who: 'Mara', modifier: 3, listeners, rollD20: () => 6 });
        expect(loud.woke).toEqual(['Sargento']);
        expect(loud.line).toContain('Sargento se despierta');
    });

    test('con armadura que estorba, con desventaja', () => {
        const dice = [15, 2];
        const result = sneakPast({ who: 'Gerd', modifier: 0, listeners: [{ name: 'Guardia', dc: 5 }], rollD20: () => dice.shift(), clumsy: true });
        expect(result.natural).toBe(2);
        expect(result.woke).toEqual(['Guardia']);
    });
});

describe('E1.1: los objetos que romper', () => {
    test('un objeto no se mueve ni ataca', () => {
        const plan = planEnemyTurn({
            actor: { id: 'c', gridX: 2, gridY: 2, profile: 'object', currentHp: 10, maxHp: 10 },
            targets: [{ id: '1', gridX: 3, gridY: 2, currentHp: 10 }],
            terrain: terrainFromAsciiMap(['.....', '.....', '.....']), gridWidth: 5, gridHeight: 3,
        });
        expect(plan.action).toBe('none');
        expect(plan.destination).toEqual({ x: 2, y: 2 });
        expect(isObjectFoe({ profile: 'object' })).toBe(true);
        expect(isObjectFoe({ profile: 'guardian' })).toBe(false);
    });

    test('ni el nivel ni el tamaño del grupo copian ni quitan un objeto', () => {
        const bestiary = [{ name: 'Cristal', profile: 'object', cr: 0, armorClass: 10, hp: 10 }, { name: 'Zombi', cr: 0.25, armorClass: 8, hp: 15 }];
        const placements = [{ name: 'Cristal', x: 1, y: 1 }, { name: 'Cristal', x: 3, y: 1 }];
        const up = adjustPlacements({
            placements, adjustment: { steps: 4, minions: 2 }, bestiary, partyLevel: 9, partySize: 4, band: { low: 1, high: 2 },
        });
        expect(up.added).toEqual([]);
        const fewer = adjustForSize({ placements, partySize: 1, partyLevel: 3, bestiary });
        expect(fewer.removed).toEqual([]);
    });
});

describe('E1.2: empujar donde duele', () => {
    test('1d6 por cada 10 pies, hasta 20d6', () => {
        expect(fallDice(5)).toBe('');
        expect(fallDice(10)).toBe('1d6');
        expect(fallDice(35)).toBe('3d6');
        expect(fallDice(400)).toBe('20d6');
    });

    test('de lo alto al suelo: un desnivel de 10 pies, con daño y al suelo', () => {
        const terrain = terrainFromAsciiMap(['......', '..^^..', '......']);
        const ground = pushGround({ terrain, width: 6, height: 3 });
        const trail = pushTrail({ from: { x: 2, y: 1 }, target: { x: 3, y: 1 }, cells: 2, ground });
        expect(trail).toMatchObject({ to: { x: 4, y: 1 }, why: 'ledge', dropFeet: 10 });
        const fell = landing({ name: 'Bandido', trail, roll: () => 4 });
        expect(fell).toMatchObject({ damage: 4, prone: true, out: false });
        expect(fell.lines.join(' ')).toContain('Cae 10 pies desnivel abajo: 4 de daño (1d6)');
    });

    test('con cotas, lo que se llevan las dos casillas', () => {
        const terrain = terrainFromAsciiMap(['....', '....']);
        const ground = pushGround({ terrain, width: 4, height: 2, elevation: { '1,0': 30 } });
        const trail = pushTrail({ from: { x: 0, y: 0 }, target: { x: 1, y: 0 }, cells: 1, ground });
        expect(trail).toMatchObject({ why: 'ledge', dropFeet: 30 });
        expect(landing({ name: 'X', trail, roll: f => (f === '3d6' ? 11 : 0) }).damage).toBe(11);
    });

    test('al agua honda: cae dentro y sale por donde cayó, en el suelo y lento', () => {
        const terrain = terrainFromAsciiMap(['....W.']);
        const ground = pushGround({ terrain, width: 6, height: 1 });
        const trail = pushTrail({ from: { x: 1, y: 0 }, target: { x: 2, y: 0 }, cells: 2, ground });
        expect(trail).toMatchObject({ to: { x: 3, y: 0 }, moved: 1, why: 'water' });
        const fell = landing({ name: 'Bandido', trail, roll: () => 0 });
        expect(fell).toMatchObject({ prone: true, slowed: true, damage: 0 });
        expect(fell.lines).toHaveLength(2);
    });

    test('al vacío: fuera de la pelea', () => {
        const terrain = terrainFromAsciiMap(['..v']);
        const trail = pushTrail({ from: { x: 0, y: 0 }, target: { x: 1, y: 0 }, cells: 1, ground: pushGround({ terrain, width: 3, height: 1 }) });
        expect(landing({ name: 'Bandido', trail, roll: () => 0 }).out).toBe(true);
    });

    test('quien está encima no deja pasar', () => {
        const terrain = terrainFromAsciiMap(['.....']);
        const trail = pushTrail({ from: { x: 0, y: 0 }, target: { x: 1, y: 0 }, cells: 2, ground: pushGround({ terrain, width: 5, height: 1, taken: ['2,0'] }) });
        expect(trail.moved).toBe(0);
    });
});

describe('E1.3: superficies que reaccionan', () => {
    test('el hielo y el barro son terreno difícil', () => {
        const terrain = terrainFromAsciiMap(['im.']);
        expect(getMovementCost(terrain, 0, 0)).toBe(2);
        expect(getMovementCost(terrain, 1, 0)).toBe(2);
        expect(getMovementCost(terrain, 2, 0)).toBe(1);
    });

    test('la primera casilla de hielo de un camino', () => {
        const terrain = terrainFromAsciiMap(['..i.']);
        expect(firstIce(terrain, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }])).toBe(2);
        expect(firstIce(terrain, [{ x: 0, y: 0 }, { x: 1, y: 0 }])).toBe(-1);
    });

    test('el agua lleva el rayo a quien está en la misma agua, a 15 pies como mucho', () => {
        const terrain = terrainFromAsciiMap(['wwww.ww', '.......']);
        const others = [{ x: 2, y: 0, n: 'a' }, { x: 3, y: 0, n: 'b' }, { x: 5, y: 0, n: 'lejos' }, { x: 1, y: 1, n: 'seco' }];
        expect(waterArc({ terrain, from: { x: 0, y: 0 }, others }).map(o => o.n)).toEqual(['a', 'b']);
        expect(waterArc({ terrain, from: { x: 0, y: 1 }, others })).toEqual([]);
    });

    test('solo el rayo de verdad, no el trueno', () => {
        expect(isLightning({ damageType: 'lightning' })).toBe(true);
        expect(isLightning({ damageType: 'Rayo' })).toBe(true);
        expect(isLightning({ damageType: 'thunder' })).toBe(false);
    });
});

describe('E1.1: lo que trae el paquete', () => {
    const pack = {
        world: { name: 'Prueba' },
        confidants: [],
        bestiary: [
            { name: 'Zombi', hp: 15, armorClass: 8, cr: 0.25, profile: 'aggressive' },
            { name: 'Cristal del ritual', hp: 10, armorClass: 13, cr: 0, profile: 'object' },
        ],
        boards: [{
            id: 'cripta', name: 'La cripta', locationName: 'Aldea',
            map: ['########', '#......#', '#..x...#', '########'],
            partyStart: [{ x: 1, y: 1 }],
            enemies: [{ name: 'Zombi', x: 6, y: 1, asleep: true }, { name: 'Cristal del ritual', x: 5, y: 2 }],
            waves: [{ round: 3, names: ['Zombi', 'Zombi'], x: 6, y: 2, tell: 'Golpes en la puerta: vienen más.' }],
            ward: { name: 'Hermano Lucas', x: 2, y: 1, hp: 9 },
        }],
        quests: [{
            id: 'q', name: 'La cripta', boardId: 'cripta',
            objectives: [
                { type: 'protect', label: 'Que el hermano Lucas no caiga', ally: 'Hermano Lucas' },
                { type: 'hold', label: 'Aguantar en la puerta', cells: [{ x: 5, y: 1 }], rounds: 4 },
                { type: 'eliminate', label: 'Romper el cristal', target: 'Cristal del ritual', beforeRound: 5 },
                { type: 'escape', label: 'Salir', optional: true },
            ],
        }],
    };

    test('se valida sin errores', () => {
        const report = validatePack(pack);
        expect(report.errors).toEqual([]);
    });

    test('escapar sin salidas en el mapa, o una oleada de alguien que no existe, son errores', () => {
        const broken = JSON.parse(JSON.stringify(pack));
        broken.boards[0].map[2] = '#......#';
        broken.boards[0].waves[0].names = ['Nadie'];
        const messages = validatePack(broken).errors.map(e => e.message).join(' | ');
        expect(messages).toContain('casillas de salida');
        expect(messages).toContain('"Nadie" no está en el bestiario');
    });

    test('el tablero importado lleva sus oleadas, quien se protege, los dormidos y los objetivos nuevos', () => {
        const plan = buildImportPlan(pack);
        const board = plan.metadata.locationMaps[0].boards[0];
        expect(board.waves).toEqual([{ round: 3, names: ['Zombi', 'Zombi'], x: 6, y: 2, tell: 'Golpes en la puerta: vienen más.' }]);
        expect(board.ward).toEqual({ name: 'Hermano Lucas', x: 2, y: 1, hp: 9 });
        expect(board.enemyPlacements[0]).toEqual({ name: 'Zombi', x: 6, y: 1, asleep: true });
        const [protect, hold, ritual] = board.objectives;
        expect(protect).toMatchObject({ type: 'protect', allyName: 'Hermano Lucas' });
        expect(protect.pendingName).toBeUndefined();
        expect(hold).toMatchObject({ type: 'hold', cells: [{ x: 5, y: 1 }], rounds: 4 });
        expect(ritual).toMatchObject({ type: 'eliminate', beforeRound: 5 });
    });

    test('las oleadas y quien se protege, limpios', () => {
        expect(wavesFromPack([{ round: 0, names: ['A'] }, { round: 2, names: [] }, { round: 2.7, names: [' A '], x: '3' }]))
            .toEqual([{ round: 2, names: ['A'], x: 3, y: 0, tell: '' }]);
        expect(wardFromPack({ name: ' Ana ', x: 1, y: 2, gender: 'Mujer' })).toEqual({ name: 'Ana', x: 1, y: 2, gender: 'Mujer' });
    });
});
