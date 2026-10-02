/**
 * Tanda 16, «arreglos del combate» (wiki/ROADMAP_SIN_CONEXION.md): Estabilizar (Medicina contra
 * 10, en la barra y para los compañeros que lleva el juego), la pelea que se acaba con el último
 * enemigo aunque quede algo de la misión por hacer andando, el resumen del golpe especial en
 * castellano y, de D-J59, el nivel en el aviso de antes de un final.
 */

import fs from 'node:fs';
import { describe, test, expect } from '@jest/globals';
import {
    STABILIZE_DC, needsStabilizing, stableSaves, stabilizeCheck, bestTender, tendFallen,
} from '../public/scripts/game-engine/rules/stabilize.js';
import { objectivesLeftWalking, walkingObjectiveStatus } from '../public/scripts/game-engine/combat/scenario-board.js';
import { damageTypeWord, conditionSaid, planAbilityUse } from '../public/scripts/game-engine/rules/abilities.js';
import { planRescue, URGENT_FAILURES } from '../public/scripts/game-engine/combat/ally-ai.js';
import { createEmptyTerrain } from '../public/scripts/game-engine/board/terrain.js';
import { boardLevelSaid, boardBand, levelPlanOf, partyLevelOf } from '../public/scripts/game-engine/combat/level-adjust.js';
import { buildImportPlan } from '../public/scripts/game-engine/campaign/campaign-importer.js';
import { ACTIONS_2024 } from '../public/scripts/game-engine/rules/actions-2024.js';

const read = (/** @type {string} */ path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'));

// ---------------------------------------------------------------- Estabilizar

describe('Estabilizar a quien ha caído (2024: Medicina contra 10)', () => {
    test('la CD es 10, y la acción sale en la barra con su nombre', () => {
        expect(STABILIZE_DC).toBe(10);
        expect(ACTIONS_2024.estabilizar).toMatchObject({ label: 'Estabilizar', cost: 'action' });
    });

    test('solo se estabiliza a quien se desangra: ni al que está en pie, ni al estable, ni al muerto, ni a una invocación', () => {
        expect(needsStabilizing({ hp: 0 })).toBe(true);
        expect(needsStabilizing({ hp: 0, deathSaves: { failures: 2 } })).toBe(true);
        expect(needsStabilizing({ hp: 5 })).toBe(false);
        expect(needsStabilizing({ hp: 0, deathSaves: stableSaves() })).toBe(false);
        expect(needsStabilizing({ hp: 0, dead: true })).toBe(false);
        expect(needsStabilizing({ hp: 0, summon: true })).toBe(false);
        expect(needsStabilizing(null)).toBe(false);
    });

    test('estable es a cero y sin tirar más', () => {
        expect(stableSaves()).toEqual({ successes: 0, failures: 0, stable: true, dead: false });
    });

    test('con 10 o más, deja de desangrarse; con menos, sigue tirando', () => {
        const ok = stabilizeCheck({ helper: 'Gerd', target: 'Iria', natural: 8, modifier: 2 });
        expect(ok.success).toBe(true);
        expect(ok.total).toBe(10);
        expect(ok.lines[0]).toMatch(/Medicina de Gerd: 10 contra CD 10 ✓/);
        expect(ok.lines[1]).toMatch(/Gerd le tapona la herida a Iria: deja de desangrarse/);
        const bad = stabilizeCheck({ helper: 'Gerd', target: 'Iria', natural: 7, modifier: 2 });
        expect(bad.success).toBe(false);
        expect(bad.lines[1]).toMatch(/sigue tirando salvaciones de muerte/);
    });

    test('atiende el de mejor Medicina de los que siguen en pie', () => {
        const members = [
            { name: 'Iria', hp: 0 },
            { name: 'Gerd', hp: 12 },
            { name: 'Lobo', hp: 9, summon: true },
            { name: 'Mara', hp: 7 },
        ];
        const medicine = { Iria: 9, Gerd: 1, Lobo: 8, Mara: 4 };
        expect(bestTender(members, m => medicine[/** @type {keyof typeof medicine} */ (m.name)])?.name).toBe('Mara');
        expect(bestTender([{ name: 'Iria', hp: 0 }], () => 5)).toBeNull();
    });

    test('acabada la pelea se intenta con calma hasta que sale, y se dice a la cuántas', () => {
        const rolls = [3, 4, 12];
        const tended = tendFallen({ helper: 'Gerd', target: 'Iria', modifier: 0, rollD20: () => rolls.shift() ?? 20 });
        expect(tended.tries).toBe(3);
        expect(tended.line).toMatch(/a la tercera, con calma/);
        expect(tended.line).toMatch(/deja de desangrarse/);
        // Nadie se queda en el suelo porque los dados no quieran.
        const stubborn = tendFallen({ helper: 'Gerd', target: 'Iria', modifier: -5, rollD20: () => 1, maxTries: 4 });
        expect(stubborn.tries).toBe(4);
        expect(stubborn.line).toMatch(/tras mucho rato/);
    });
});

describe('un compañero que lleva el juego va a atender a quien se desangra', () => {
    const terrain = createEmptyTerrain();
    const base = { terrain, gridWidth: 12, gridHeight: 12 };
    const actor = { id: 'gerd', gridX: 2, gridY: 2, speedFeet: 30 };

    test('sin poción, va a su lado a estabilizarle', () => {
        const plan = planRescue({ ...base, actor, dying: [{ id: 'iria', gridX: 5, gridY: 2 }], enemies: [] });
        expect(plan?.kind).toBe('stabilize');
        expect(plan?.targetId).toBe('iria');
        const to = /** @type {any} */ (plan).destination;
        expect(Math.max(Math.abs(to.x - 5), Math.abs(to.y - 2))).toBe(1);
    });

    test('con una poción encima, se la da', () => {
        const plan = planRescue({ ...base, actor: { ...actor, potions: 1 }, dying: [{ id: 'iria', gridX: 5, gridY: 2 }], enemies: [] });
        expect(plan?.kind).toBe('give-potion');
    });

    test('no se mete al lado de un enemigo si no es urgente; con dos fallos, sí', () => {
        // El caído, en un pasillo con un enemigo a cada lado de las casillas libres de al lado.
        const dying = [{ id: 'iria', gridX: 5, gridY: 0, failures: 0 }];
        const enemies = [{ id: 'g1', gridX: 5, gridY: 1, currentHp: 7 }];
        const calm = planRescue({ ...base, actor: { ...actor, gridX: 0, gridY: 0 }, dying, enemies });
        expect(calm).toBeNull();
        const urgent = planRescue({ ...base, actor: { ...actor, gridX: 0, gridY: 0 }, dying: [{ ...dying[0], failures: URGENT_FAILURES }], enemies });
        expect(urgent?.kind).toBe('stabilize');
    });

    test('nadie en el suelo, nada que hacer', () => {
        expect(planRescue({ ...base, actor, dying: [], enemies: [] })).toBeNull();
        expect(planRescue({ ...base, actor, dying: [{ id: 'gerd', gridX: 2, gridY: 2 }], enemies: [] })).toBeNull();
    });
});

// ---------------------------------------------------------------- la pelea se acaba con el último enemigo

describe('la pelea se acaba con el último enemigo; lo que falta de la misión se hace andando', () => {
    // La ventana de la posada de 1387: salir por (7,9).
    const window = [{ id: 'ventana', type: 'reach_cell', label: 'Salir por la ventana', cell: { x: 7, y: 9 } }];
    const hero = { id: '1', currentHp: 10, gridX: 2, gridY: 2 };
    const deadFoe = { id: 'g1', currentHp: 0, gridX: 4, gridY: 4 };

    test('sin nadie en pie y sin refuerzos, lo que queda se hace fuera de la pelea', () => {
        expect(objectivesLeftWalking(window, { round: 3, enemies: [deadFoe], allies: [hero] })).toEqual(['ventana']);
    });

    test('con alguien en pie, o con refuerzos por llegar, la pelea sigue', () => {
        expect(objectivesLeftWalking(window, { round: 3, enemies: [{ ...deadFoe, currentHp: 4 }], allies: [hero] })).toEqual([]);
        expect(objectivesLeftWalking(window, { round: 3, enemies: [deadFoe], allies: [hero] }, { wavesLeft: true })).toEqual([]);
    });

    test('aguantar rondas no se hace andando: esa pelea sigue como estaba', () => {
        const hold = [{ id: 'aguantar', type: 'survive_rounds', rounds: 6 }];
        expect(objectivesLeftWalking(hold, { round: 3, enemies: [deadFoe], allies: [hero] })).toEqual([]);
    });

    test('ya cumplida, o sin objetivos, no hay nada que dejar para luego', () => {
        expect(objectivesLeftWalking(window, { round: 3, enemies: [deadFoe], allies: [{ ...hero, gridX: 7, gridY: 9 }] })).toEqual([]);
        expect(objectivesLeftWalking([], { round: 3, enemies: [deadFoe], allies: [hero] })).toEqual([]);
    });

    test('fuera de la pelea: pendiente hasta llegar; al llegar, cumplida', () => {
        expect(walkingObjectiveStatus(window, ['ventana'], { round: 3, enemies: [], allies: [hero] }).status).toBe('pending');
        const done = walkingObjectiveStatus(window, ['ventana'], { round: 3, enemies: [], allies: [{ ...hero, gridX: 7, gridY: 9 }] });
        expect(done).toEqual({ status: 'done', labels: ['Salir por la ventana'] });
    });

    test('llevar a alguien que cae por el camino es fracasar', () => {
        const escort = [{ id: 'monje', type: 'escort', allyId: '2', cell: { x: 9, y: 9 } }];
        const board = { round: 3, enemies: [], allies: [hero, { id: '2', currentHp: 0, gridX: 3, gridY: 3 }] };
        expect(walkingObjectiveStatus(escort, ['monje'], board).status).toBe('failed');
    });
});

// ---------------------------------------------------------------- el golpe especial, en castellano

describe('el resumen del golpe especial, en castellano', () => {
    test('los tipos de daño de 5e, en una palabra', () => {
        expect(damageTypeWord('bludgeoning')).toBe('contundente');
        expect(damageTypeWord('Necrotic')).toBe('necrótico');
        expect(damageTypeWord('fuego')).toBe('fuego');
        expect(damageTypeWord('')).toBe('');
    });

    test('el estado, como se dice detrás de «queda», y con el género de quien lo sufre', () => {
        expect(conditionSaid('Prone', { gender: 'Hombre' })).toBe('derribado');
        expect(conditionSaid('Prone', { gender: 'Mujer' })).toBe('derribada');
        expect(conditionSaid('Invisible', { gender: 'Mujer' })).toBe('invisible');
    });

    test('el golpe de un jefe ya no dice «bludgeoning» ni «Prone»', () => {
        const use = planAbilityUse({
            ability: /** @type {any} */ ({
                id: 'barrido', name: 'Barrido', cost: 'action', target: 'enemy', resolution: 'save',
                saveAbility: 'dexterity', saveDc: 30, damage: '2d6', damageType: 'bludgeoning', condition: 'Prone', conditionRounds: 1,
            }),
            actor: { name: 'Jefe', gender: 'Hombre' },
            target: { name: 'Iria', gender: 'Mujer' },
            roll: (formula) => ({ total: formula === '1d20' ? 2 : 7, natural: 2 }),
        });
        const said = use.lines.join('\n');
        expect(said).not.toMatch(/bludgeoning|Prone/);
        expect(said).toMatch(/Daño contundente/);
        expect(said).toMatch(/Iria queda derribada/);
    });
});

// ---------------------------------------------------------------- D-J59: el nivel en el aviso de un final

describe('D-J59: antes de un final, para qué nivel es y en cuál está tu grupo', () => {
    test('dicho llano, con un nivel o con un tramo', () => {
        expect(boardLevelSaid({ low: 6, high: 7 }, 5)).toBe('Este combate es para nivel 6-7; tu grupo está en 5.');
        expect(boardLevelSaid({ low: 4, high: 4 }, 4)).toBe('Este combate es para nivel 4; tu grupo está en 4.');
        expect(boardLevelSaid(null, 3)).toBe('');
    });

    test('la cripta de Strahd es para nivel 6-7, la diga quien la diga', () => {
        const pack = read('../public/mundos/strahd.pack.json');
        const row = read('../public/mundos/mundos.json').worlds.find((/** @type {any} */ w) => w.id === 'strahd');
        const plan = levelPlanOf(buildImportPlan(pack).metadata, row.levels);
        expect(plan).not.toBeNull();
        const { level } = partyLevelOf([{ level: 5 }, { level: 5 }, { level: 4 }, { level: 6 }]);
        expect(boardLevelSaid(boardBand(/** @type {any} */ (plan), 'La Cripta de Strahd'), level))
            .toBe('Este combate es para nivel 6-7; tu grupo está en 5.');
    });

    test('las puertas del castillo de 1387, como están: el tramo de su acto', () => {
        const pack = read('../public/mundos/1387.pack.json');
        const row = read('../public/mundos/mundos.json').worlds.find((/** @type {any} */ w) => w.id === '1387');
        const plan = levelPlanOf(buildImportPlan(pack).metadata, row.levels);
        const said = boardLevelSaid(boardBand(/** @type {any} */ (plan), 'Las puertas del castillo'), 2);
        expect(said).toMatch(/^Este combate es para nivel \d(-\d)?; tu grupo está en 2\.$/);
        expect(said).toMatch(/nivel 3-4/);
    });
});
