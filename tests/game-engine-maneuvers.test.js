import { describe, test, expect } from '@jest/globals';
import {
    MANEUVERS, readManeuvers, startTurn, recordManeuver, judgeManeuvers, attackEdge,
    consumeHelp, rollWithEdge, describeEdge, resolveShove,
} from '../public/scripts/game-engine/combat/maneuvers.js';

describe('el estado', () => {
    test('lo que no existe se lee vacío', () => {
        expect(readManeuvers(undefined)).toEqual({ dodging: [], disengaged: [], helped: [], combo: null, hidden: [] });
    });

    test('esquivar y destrabarse se apuntan una vez', () => {
        let state = recordManeuver(null, 'esquivar', '1');
        state = recordManeuver(state, 'esquivar', '1');
        state = recordManeuver(state, 'destrabarse', '1');
        expect(state.dodging).toEqual(['1']);
        expect(state.disengaged).toEqual(['1']);
    });

    test('al volver a tocarle, lo suyo caduca y lo de los demás no', () => {
        let state = recordManeuver(null, 'esquivar', '1');
        state = recordManeuver(state, 'esquivar', '2');
        state = recordManeuver(state, 'ayudar', '1', 'goblin');
        state = startTurn(state, '1');
        expect(state.dodging).toEqual(['2']);
        expect(state.helped).toEqual([]);
    });

    test('una ayuda nueva sobre el mismo enemigo sustituye a la vieja', () => {
        let state = recordManeuver(null, 'ayudar', '1', 'g');
        state = recordManeuver(state, 'ayudar', '2', 'g');
        expect(state.helped).toEqual([{ targetId: 'g', by: '2' }]);
    });
});

describe('judgeManeuvers', () => {
    const enemies = [{ id: 'g', name: 'Goblin', distanceFeet: 5 }, { id: 'o', name: 'Orco', distanceFeet: 20 }];

    test('todas, y empujar solo a quien tienes pegado', () => {
        const list = judgeManeuvers({ hasAction: true, enemies, hide: { ok: true, reason: '' } });
        expect(list.map(m => m.id)).toEqual(Object.keys(MANEUVERS));
        const shove = list.find(m => m.id === 'empujar');
        expect(shove?.targets).toEqual([{ id: 'g', name: 'Goblin' }]);
        expect(list.every(m => m.enabled)).toBe(true);
    });

    test('sin nadie pegado, empujar y ayudar dicen por qué no', () => {
        const list = judgeManeuvers({ hasAction: true, enemies: [enemies[1]] });
        expect(list.find(m => m.id === 'empujar')?.enabled).toBe(false);
        expect(list.find(m => m.id === 'ayudar')?.detail).toMatch(/pegado/);
        expect(list.find(m => m.id === 'esquivar')?.enabled).toBe(true);
    });

    test('sin acción, ninguna', () => {
        const list = judgeManeuvers({ hasAction: false, enemies });
        expect(list.every(m => !m.enabled)).toBe(true);
        expect(list[0].detail).toMatch(/gastada/);
    });
});

describe('attackEdge', () => {
    test('contra quien se cubre, desventaja', () => {
        const state = recordManeuver(null, 'esquivar', '1');
        expect(attackEdge({ targetId: '1', distanceFeet: 5, maneuvers: state }).mode).toBe('disadvantage');
    });

    test('en el suelo: de cerca ventaja, de lejos desventaja', () => {
        expect(attackEdge({ targetId: 'g', targetConditions: ['Prone'], distanceFeet: 5 }).mode).toBe('advantage');
        expect(attackEdge({ targetId: 'g', targetConditions: ['prone'], distanceFeet: 30 }).mode).toBe('disadvantage');
    });

    test('la ayuda solo vale para el grupo', () => {
        const state = recordManeuver(null, 'ayudar', '1', 'g');
        expect(attackEdge({ targetId: 'g', distanceFeet: 5, maneuvers: state, byParty: true }))
            .toMatchObject({ mode: 'advantage', usesHelp: true });
        expect(attackEdge({ targetId: 'g', distanceFeet: 5, maneuvers: state }).mode).toBe('normal');
    });

    test('una de cada se anulan', () => {
        const state = recordManeuver(null, 'esquivar', 'g');
        const edge = attackEdge({ targetId: 'g', targetConditions: ['Prone'], distanceFeet: 5, maneuvers: state });
        expect(edge.mode).toBe('normal');
        expect(edge.reasons).toHaveLength(2);
    });

    test('atacar desde el suelo, desventaja', () => {
        expect(attackEdge({ targetId: 'g', attackerConditions: ['Prone'], distanceFeet: 5 }).mode).toBe('disadvantage');
    });

    test('consumeHelp la gasta', () => {
        const state = consumeHelp(recordManeuver(null, 'ayudar', '1', 'g'), 'g');
        expect(state.helped).toEqual([]);
    });
});

describe('rollWithEdge', () => {
    const dice = (/** @type {number[]} */ values) => () => /** @type {number} */ (values.shift());

    test('normal, un dado', () => {
        expect(rollWithEdge(dice([7, 18]), 'normal')).toEqual({ natural: 7, rolls: [7] });
    });

    test('ventaja, el mayor; desventaja, el menor', () => {
        expect(rollWithEdge(dice([7, 18]), 'advantage').natural).toBe(18);
        expect(rollWithEdge(dice([7, 18]), 'disadvantage').natural).toBe(7);
    });

    test('se dice en el registro, y lo normal no dice nada', () => {
        expect(describeEdge({ natural: 18, rolls: [7, 18] }, 'advantage', ['está en el suelo']))
            .toMatch(/ventaja \(está en el suelo\): 7 y 18, se queda el 18/);
        expect(describeEdge({ natural: 7, rolls: [7] }, 'normal', [])).toBe('');
    });
});

describe('resolveShove', () => {
    const free = () => true;

    test('gana, y el otro retrocede en línea recta', () => {
        const result = resolveShove({ from: { x: 2, y: 2 }, target: { x: 3, y: 3 }, attackTotal: 15, defenseTotal: 10, isFree: free });
        expect(result).toEqual({ success: true, pushedTo: { x: 4, y: 4 }, prone: false, falls: false });
    });

    test('el empate lo gana quien se defiende', () => {
        expect(resolveShove({ from: { x: 2, y: 2 }, target: { x: 3, y: 2 }, attackTotal: 12, defenseTotal: 12, isFree: free }).success)
            .toBe(false);
    });

    test('con un precipicio detrás, cae al vacío', () => {
        const result = resolveShove({
            from: { x: 2, y: 2 }, target: { x: 3, y: 2 }, attackTotal: 15, defenseTotal: 3,
            isFree: () => false, isChasm: (x, y) => x === 4 && y === 2,
        });
        expect(result).toEqual({ success: true, pushedTo: { x: 4, y: 2 }, prone: false, falls: true });
    });

    test('sin sitio detrás, cae al suelo', () => {
        const result = resolveShove({ from: { x: 2, y: 2 }, target: { x: 3, y: 2 }, attackTotal: 15, defenseTotal: 3, isFree: () => false });
        expect(result).toEqual({ success: true, pushedTo: null, prone: true, falls: false });
    });
});
