import { describe, test, expect } from '@jest/globals';
import {
    normalizeAbility, normalizeAbilities, knownAbilities, usesLeft, canUseAbility,
    planAbilityUse, spendAbilityUse, restoreAbilityUses, describeAbility,
} from '../public/scripts/game-engine/rules/abilities.js';

const rayo = {
    id: 'rayo', name: 'Rayo de fuego', cost: 'action', resource: 'at_will',
    rangeFeet: 120, target: 'enemy', resolution: 'attack', damage: '1d10', damageType: 'Fire',
};
const curar = {
    id: 'curar', name: 'Curar heridas', cost: 'action', resource: 'long_rest', usesPerRest: 2,
    rangeFeet: 5, target: 'ally', resolution: 'auto', healing: '1d8+3',
};
const aliento = {
    id: 'aliento', name: 'Tomar aliento', cost: 'bonus', resource: 'short_rest', usesPerRest: 1,
    target: 'self', resolution: 'auto', healing: '1d10+2',
};
const escudo = {
    id: 'escudo', name: 'Golpe de escudo', cost: 'action', resource: 'short_rest', usesPerRest: 1,
    rangeFeet: 5, target: 'enemy', resolution: 'save', saveAbility: 'strength', saveDc: 13,
    condition: 'Prone', conditionRounds: 1, damage: '1d4',
};

const catalogue = [rayo, curar, aliento, escudo];
const hero = (over = {}) => ({ id: 1, name: 'Lyra', abilities: ['rayo', 'aliento'], ...over });
const fixedRoll = (values) => {
    const queue = [...values];
    return (formula) => {
        const total = queue.length > 0 ? queue.shift() : 0;
        return { total, natural: total, rolls: [total], formula };
    };
};

describe('leer el catalogo', () => {
    test('una fila a medias sigue siendo una habilidad jugable', () => {
        const ability = normalizeAbility({ name: 'Chispa' });
        expect(ability.id).toBe('chispa');
        expect(ability.cost).toBe('action');
        expect(ability.resource).toBe('at_will');
        expect(ability.target).toBe('enemy');
        expect(ability.resolution).toBe('auto');
    });

    test('un valor inventado cae en el de por defecto, no rompe', () => {
        const ability = normalizeAbility({ name: 'X', cost: 'ritual', target: 'todos', resolution: 'magia' });
        expect(ability.cost).toBe('action');
        expect(ability.target).toBe('enemy');
        expect(ability.resolution).toBe('auto');
    });

    test('sobre uno mismo el alcance es cero: no significa nada', () => {
        expect(normalizeAbility({ name: 'Furia', target: 'self', rangeFeet: 30 }).rangeFeet).toBe(0);
    });

    test('los identificadores no se repiten: la segunda se cae', () => {
        const list = normalizeAbilities([{ id: 'a', name: 'Una' }, { id: 'a', name: 'Otra' }]);
        expect(list).toHaveLength(1);
        expect(list[0].name).toBe('Una');
    });

    test('solo se sabe lo que la ficha dice que se sabe', () => {
        expect(knownAbilities(hero(), catalogue).map(a => a.id)).toEqual(['rayo', 'aliento']);
        expect(knownAbilities({ abilities: [] }, catalogue)).toEqual([]);
        expect(knownAbilities(null, catalogue)).toEqual([]);
    });
});

describe('los usos que quedan', () => {
    test('a voluntad son infinitos', () => {
        expect(usesLeft(hero(), normalizeAbility(rayo))).toBe(Infinity);
    });

    test('y los demas se descuentan', () => {
        const member = hero({ abilityUses: { curar: 1 } });
        expect(usesLeft(member, normalizeAbility(curar))).toBe(1);
        expect(usesLeft(hero({ abilityUses: { curar: 2 } }), normalizeAbility(curar))).toBe(0);
    });

    test('gastar uno no pasa del tope', () => {
        const ability = normalizeAbility(curar);
        const once = spendAbilityUse(hero(), ability);
        expect(once.curar).toBe(1);
        expect(spendAbilityUse(hero({ abilityUses: { curar: 9 } }), ability).curar).toBe(2);
    });

    test('una a voluntad no gasta nada', () => {
        expect(spendAbilityUse(hero(), normalizeAbility(rayo))).toEqual({});
    });
});

describe('si se puede usar, y si no por que', () => {
    const ability = normalizeAbility(rayo);

    test('en su alcance y con accion, si', () => {
        expect(canUseAbility({ member: hero(), ability, distanceFeet: 30 }).ok).toBe(true);
    });

    test('fuera de alcance lo dice con los numeros', () => {
        const verdict = canUseAbility({ member: hero(), ability, distanceFeet: 200 });
        expect(verdict.ok).toBe(false);
        expect(verdict.reason).toBe('Fuera de alcance: 200 ft de 120 ft.');
    });

    test('sin accion, tampoco', () => {
        expect(canUseAbility({ member: hero(), ability, hasAction: false }).reason)
            .toMatch(/acción de este turno/);
    });

    test('una de accion adicional mira la suya, no la principal', () => {
        const bonus = normalizeAbility(aliento);
        expect(canUseAbility({ member: hero(), ability: bonus, hasAction: false }).ok).toBe(true);
        expect(canUseAbility({ member: hero(), ability: bonus, hasBonus: false }).ok).toBe(false);
    });

    test('sin usos dice con que descanso vuelve', () => {
        const spent = hero({ abilityUses: { aliento: 1 } });
        expect(canUseAbility({ member: spent, ability: normalizeAbility(aliento) }).reason)
            .toMatch(/descanso corto/);
    });

    test('sobre un objetivo que ya cayo, no', () => {
        expect(canUseAbility({ member: hero(), ability, targetAlive: false }).ok).toBe(false);
    });

    test('sobre uno mismo el alcance no estorba', () => {
        expect(canUseAbility({ member: hero(), ability: normalizeAbility(aliento), distanceFeet: 999 }).ok).toBe(true);
    });
});

describe('lo que pasa al usarla', () => {
    test('una tirada de ataque que falla no hace dano', () => {
        const plan = planAbilityUse({
            actor: hero(), target: { name: 'Goblin' }, ability: normalizeAbility(rayo),
            roll: fixedRoll([3]), attackModifier: 2, targetAc: 15,
        });
        expect(plan.hit).toBe(false);
        expect(plan.damage).toBe(0);
        expect(plan.lines.some(l => /Falla/.test(l))).toBe(true);
    });

    test('y una que acierta tira su dano', () => {
        const plan = planAbilityUse({
            actor: hero(), target: { name: 'Goblin' }, ability: normalizeAbility(rayo),
            roll: fixedRoll([18, 7]), attackModifier: 2, targetAc: 15,
        });
        expect(plan.hit).toBe(true);
        expect(plan.damage).toBe(7);
    });

    test('un 20 natural dobla los dados', () => {
        const plan = planAbilityUse({
            actor: hero(), target: { name: 'Goblin' }, ability: normalizeAbility(rayo),
            roll: fixedRoll([20, 6, 5]), attackModifier: 0, targetAc: 18,
        });
        expect(plan.crit).toBe(true);
        expect(plan.damage).toBe(11);
    });

    test('una salvacion superada parte el dano por la mitad y quita la condicion', () => {
        const plan = planAbilityUse({
            actor: hero(), target: { name: 'Goblin' }, ability: normalizeAbility(escudo),
            roll: fixedRoll([17, 4]), saveModifier: 0,
        });
        expect(plan.saved).toBe(true);
        expect(plan.damage).toBe(2);
        expect(plan.condition).toBe('');
        expect(plan.lines.some(l => /aguanta/.test(l))).toBe(true);
    });

    test('y una fallada deja la condicion puesta', () => {
        const plan = planAbilityUse({
            actor: hero(), target: { name: 'Goblin' }, ability: normalizeAbility(escudo),
            roll: fixedRoll([5, 4]), saveModifier: 0,
        });
        expect(plan.saved).toBe(false);
        expect(plan.damage).toBe(4);
        expect(plan.condition).toBe('Prone');
        expect(plan.conditionRounds).toBe(1);
    });

    test('curar no tira ataque: cura y ya', () => {
        const plan = planAbilityUse({
            actor: hero(), target: { name: 'Brand' }, ability: normalizeAbility(curar),
            roll: fixedRoll([9]),
        });
        expect(plan.healing).toBe(9);
        expect(plan.damage).toBe(0);
        expect(plan.lines[0]).toMatch(/Lyra usa Curar heridas sobre Brand/);
    });

    test('sobre uno mismo no se nombra dos veces', () => {
        const plan = planAbilityUse({
            actor: hero(), ability: normalizeAbility(aliento), roll: fixedRoll([8]),
        });
        expect(plan.lines[0]).toBe('✨ Lyra usa Tomar aliento.');
        expect(plan.healing).toBe(8);
    });
});

describe('lo que devuelve un descanso', () => {
    const member = hero({ abilityUses: { aliento: 1, curar: 2 } });

    test('uno corto devuelve solo lo de descanso corto', () => {
        expect(restoreAbilityUses(member, 'corto', catalogue)).toEqual({ curar: 2 });
    });

    test('y uno largo lo devuelve todo', () => {
        expect(restoreAbilityUses(member, 'largo', catalogue)).toEqual({});
    });
});

describe('contada en una linea', () => {
    test('dice lo que cuesta, cuanto alcanza y que hace', () => {
        expect(describeAbility(normalizeAbility(rayo)))
            .toBe('Acción · a voluntad · 120 ft · 1d10 de daño');
        expect(describeAbility(normalizeAbility(escudo)))
            .toBe('Acción · 1x por descanso corto · 5 ft · 1d4 de daño · Prone · salvación CD 13');
        expect(describeAbility(normalizeAbility(aliento)))
            .toBe('Acción adicional · 1x por descanso corto · sobre ti · cura 1d10+2');
    });
});
