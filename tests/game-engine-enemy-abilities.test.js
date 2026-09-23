import { describe, test, expect } from '@jest/globals';
import { normalizeAbility } from '../public/scripts/game-engine/rules/abilities.js';
import {
    averageOf, chooseEnemyAbility, longestReach,
} from '../public/scripts/game-engine/combat/enemy-abilities.js';

const rayo = normalizeAbility({
    id: 'rayo', name: 'Rayo', cost: 'action', resource: 'at_will',
    rangeFeet: 120, target: 'enemy', resolution: 'attack', damage: '1d10',
});
const curar = normalizeAbility({
    id: 'curar', name: 'Curar', cost: 'action', resource: 'long_rest', usesPerRest: 1,
    rangeFeet: 5, target: 'ally', resolution: 'auto', healing: '1d8+3',
});
const escudo = normalizeAbility({
    id: 'escudo', name: 'Golpe de escudo', cost: 'action', resource: 'short_rest', usesPerRest: 1,
    rangeFeet: 5, target: 'enemy', resolution: 'save', saveAbility: 'strength', saveDc: 13,
    damage: '1d4', condition: 'Prone', conditionRounds: 1,
});

const actor = { id: 'c1', currentHp: 10, maxHp: 10 };
const here = { x: 0, y: 0 };
const hero = (x, y, extra = {}) => ({ id: 'h', gridX: x, gridY: y, currentHp: 10, maxHp: 10, ...extra });

describe('averageOf', () => {
    test('la media de una fórmula', () => {
        expect(averageOf('2d6+3')).toBe(10);
        expect(averageOf('1d10')).toBe(5.5);
        expect(averageOf('d4')).toBe(2.5);
        expect(averageOf('')).toBe(0);
    });
});

describe('chooseEnemyAbility', () => {
    test('sin habilidades, nada', () => {
        expect(chooseEnemyAbility({ actor, from: here, abilities: [], targets: [hero(1, 0)] })).toBeNull();
    });

    test('un rayo a voluntad sustituye al golpe cuando el golpe no llega', () => {
        const choice = chooseEnemyAbility({ actor, from: here, abilities: [rayo], targets: [hero(6, 0)] });
        expect(choice?.ability.id).toBe('rayo');
        expect(choice?.targetId).toBe('h');
    });

    test('pero si el golpe llega y pega más, pega', () => {
        const choice = chooseEnemyAbility({
            actor, from: here, abilities: [rayo], targets: [hero(1, 0)], basicAverage: 8,
        });
        expect(choice).toBeNull();
    });

    test('lo de usos contados se gasta en cuanto llega', () => {
        const choice = chooseEnemyAbility({ actor, from: here, abilities: [rayo, escudo], targets: [hero(1, 0)] });
        expect(choice?.ability.id).toBe('escudo');
    });

    test('gastado, ya no', () => {
        const spent = { ...actor, abilityUses: { escudo: 1 } };
        const choice = chooseEnemyAbility({ actor: spent, from: here, abilities: [escudo], targets: [hero(1, 0)] });
        expect(choice).toBeNull();
    });

    test('fuera de alcance, no', () => {
        expect(chooseEnemyAbility({ actor, from: here, abilities: [escudo], targets: [hero(4, 0)] })).toBeNull();
    });

    test('cura primero al más herido de los suyos, si le llega', () => {
        const choice = chooseEnemyAbility({
            actor, from: here, abilities: [rayo, curar], targets: [hero(6, 0)],
            allies: [
                { id: 'a1', gridX: 1, gridY: 0, currentHp: 4, maxHp: 10 },
                { id: 'a2', gridX: 1, gridY: 1, currentHp: 2, maxHp: 10 },
            ],
        });
        expect(choice).toMatchObject({ targetId: 'a2', side: 'ally' });
        expect(choice?.ability.id).toBe('curar');
    });

    test('se cura a sí mismo con una de aliado', () => {
        const hurt = { ...actor, currentHp: 2 };
        const choice = chooseEnemyAbility({ actor: hurt, from: here, abilities: [curar], targets: [hero(6, 0)] });
        expect(choice).toMatchObject({ targetId: 'c1', side: 'ally' });
    });

    test('prefiere a quien iba', () => {
        const choice = chooseEnemyAbility({
            actor, from: here, abilities: [rayo],
            targets: [hero(6, 0), hero(7, 0, { id: 'otro', currentHp: 1 })],
            focusId: 'h',
        });
        expect(choice?.targetId).toBe('h');
    });

    test('a los caídos no', () => {
        expect(chooseEnemyAbility({
            actor, from: here, abilities: [rayo], targets: [hero(6, 0, { currentHp: 0 })],
        })).toBeNull();
    });
});

describe('longestReach', () => {
    test('lo más lejos que llega con algo que haga daño', () => {
        expect(longestReach(actor, [rayo, escudo, curar])).toBe(120);
        expect(longestReach(actor, [curar])).toBe(0);
    });
});
