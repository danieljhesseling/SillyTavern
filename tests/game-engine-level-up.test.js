import { describe, test, expect } from '@jest/globals';
import {
    normalizeXpTable, normalizeAbilityLevels, levelForXp, xpForLevel, averageOfDie,
    planLevelUp, validateAbilityPicks, buildLevelUpPatch, describeLevelUp,
    DEFAULT_XP_THRESHOLDS, ABILITY_CAP,
} from '../public/scripts/game-engine/rules/level-up.js';

const hero = (over = {}) => ({
    id: 1, name: 'Lyra', level: 1, xp: 0, hp: 10, maxHp: 10,
    constitution: 14, class: 'guerrero', hitDie: 'd10', ...over,
});

describe('la tabla de experiencia', () => {
    test('la de 5e llega hasta el nivel 20', () => {
        const table = normalizeXpTable(DEFAULT_XP_THRESHOLDS);
        expect(table[0]).toEqual({ level: 2, xp: 300 });
        expect(table[table.length - 1]).toEqual({ level: 20, xp: 355000 });
    });

    test('se ordena sola, aunque venga desordenada', () => {
        const table = normalizeXpTable([['5', '6500'], ['2', '300'], ['3', '900']]);
        expect(table.map(r => r.level)).toEqual([2, 3, 5]);
    });

    test('una fila torcida se cae y el resto se juega igual', () => {
        const table = normalizeXpTable([['2', '300'], ['tres', 'novecientos'], null, ['4', '2700']]);
        expect(table.map(r => r.level)).toEqual([2, 4]);
    });

    test('sin tabla, la de 5e', () => {
        expect(normalizeXpTable(null)).toEqual(normalizeXpTable(DEFAULT_XP_THRESHOLDS));
        expect(normalizeXpTable('nada')).toEqual(normalizeXpTable(DEFAULT_XP_THRESHOLDS));
    });

    test('el nivel 1 no tiene umbral: se empieza ahí', () => {
        expect(normalizeXpTable([['1', '0'], ['2', '300']]).map(r => r.level)).toEqual([2]);
    });
});

describe('qué nivel toca con cuánta experiencia', () => {
    test('el nivel sale de la tabla', () => {
        expect(levelForXp(0)).toBe(1);
        expect(levelForXp(299)).toBe(1);
        expect(levelForXp(300)).toBe(2);
        expect(levelForXp(6500)).toBe(5);
        expect(levelForXp(999999)).toBe(20);
    });

    test('y la experiencia del siguiente, también', () => {
        expect(xpForLevel(2)).toBe(300);
        expect(xpForLevel(21)).toBeNull();
    });

    test('una tabla propia manda sobre la de 5e', () => {
        const rapido = [['2', '10'], ['3', '20']];
        expect(levelForXp(10, rapido)).toBe(2);
        expect(levelForXp(300, rapido)).toBe(3);
    });
});

describe('el plan de subida', () => {
    test('sin experiencia no hay nivel, y lo dice', () => {
        const plan = planLevelUp({ member: hero() });
        expect(plan.canLevel).toBe(false);
        expect(plan.reason).toMatch(/experiencia/);
    });

    test('con experiencia de sobra sube todos los niveles de una vez', () => {
        const plan = planLevelUp({ member: hero({ xp: 6500 }) });
        expect(plan.from).toBe(1);
        expect(plan.to).toBe(5);
        expect(plan.steps).toHaveLength(4);
        expect(plan.hitDiceGained).toBe(4);
    });

    test('los PG salen del dado de la clase más Constitución, con la media fija', () => {
        // d10 -> media 6, Constitución 14 -> +2, así que 8 por nivel.
        const plan = planLevelUp({ member: hero({ xp: 300 }) });
        expect(plan.steps[0].hpGained).toBe(8);
        expect(plan.hpGained).toBe(8);
    });

    test('o de una tirada, si se pasa una', () => {
        const plan = planLevelUp({ member: hero({ xp: 300 }), roll: () => 1 });
        expect(plan.steps[0].hpGained).toBe(3);
    });

    test('un nivel nunca quita vida, por mala que sea la Constitución', () => {
        const plan = planLevelUp({ member: hero({ xp: 300, constitution: 3 }), roll: () => 1 });
        expect(plan.steps[0].hpGained).toBe(1);
    });

    test('el dado sale de la clase cuando la ficha no lo declara', () => {
        const plan = planLevelUp({
            member: hero({ xp: 300, hitDie: '', class: 'mago' }),
            hitDieByClass: { mago: 'd6' },
        });
        expect(plan.steps[0].hitDie).toBe(6);
    });

    test('marca los niveles que traen mejora de característica', () => {
        const plan = planLevelUp({ member: hero({ xp: 6500 }) });
        expect(plan.steps.filter(s => s.ability).map(s => s.level)).toEqual([4]);
        expect(plan.abilityPicks).toBe(1);
        expect(plan.pointsToSpend).toBe(2);
    });

    test('y esos niveles también se editan', () => {
        const plan = planLevelUp({ member: hero({ xp: 900 }), abilityLevels: ['2', '3'] });
        expect(plan.pointsToSpend).toBe(4);
    });

    test('en el tope de la tabla no se sube más, y lo dice', () => {
        const plan = planLevelUp({ member: hero({ level: 20, xp: 999999 }) });
        expect(plan.canLevel).toBe(false);
        expect(plan.reason).toMatch(/máximo/);
        expect(plan.maxed).toBe(true);
    });

    test('una tabla corta pone su propio tope', () => {
        const plan = planLevelUp({ member: hero({ xp: 999999 }), table: [['2', '10'], ['3', '20']] });
        expect(plan.to).toBe(3);
        expect(plan.maxed).toBe(true);
        expect(plan.xpNext).toBeNull();
    });
});

describe('repartir los puntos de característica', () => {
    const plan = planLevelUp({ member: hero({ xp: 2700 }) });

    test('tienen que ser exactamente los que toca', () => {
        expect(validateAbilityPicks({ strength: 2 }, plan, hero()).ok).toBe(true);
        expect(validateAbilityPicks({ strength: 1, dexterity: 1 }, plan, hero()).ok).toBe(true);
        expect(validateAbilityPicks({ strength: 3 }, plan, hero()).ok).toBe(false);
        expect(validateAbilityPicks({}, plan, hero()).ok).toBe(false);
    });

    test('una característica que no existe se rechaza', () => {
        const verdict = validateAbilityPicks({ suerte: 2 }, plan, hero());
        expect(verdict.ok).toBe(false);
        expect(verdict.error).toMatch(/suerte/);
    });

    test('y ninguna pasa de 20', () => {
        const verdict = validateAbilityPicks({ strength: 2 }, plan, hero({ strength: 19 }));
        expect(verdict.ok).toBe(false);
        expect(verdict.error).toMatch(String(ABILITY_CAP));
    });
});

describe('el parche que se escribe en la ficha', () => {
    test('sube el nivel, el máximo y la vida actual', () => {
        const member = hero({ xp: 300, hp: 4, maxHp: 10 });
        const plan = planLevelUp({ member });
        const patch = buildLevelUpPatch(member, plan);
        expect(patch.level).toBe(2);
        expect(patch.maxHp).toBe(18);
        expect(patch.hp).toBe(12);
    });

    test('y deja apuntada la experiencia del siguiente', () => {
        const member = hero({ xp: 300 });
        expect(buildLevelUpPatch(member, planLevelUp({ member })).xpNext).toBe(900);
    });

    test('aplica los puntos repartidos, con su tope', () => {
        const member = hero({ xp: 2700, strength: 19 });
        const plan = planLevelUp({ member });
        const patch = buildLevelUpPatch(member, plan, { strength: 1, dexterity: 1 });
        expect(patch.strength).toBe(20);
        expect(patch.dexterity).toBe(11);
    });

    test('lo que no se reparte no se toca', () => {
        const member = hero({ xp: 300 });
        const patch = buildLevelUpPatch(member, planLevelUp({ member }), {});
        expect(patch.strength).toBeUndefined();
    });
});

describe('contado en una línea', () => {
    test('dice a qué nivel se sube y qué da', () => {
        const member = hero({ xp: 2700 });
        expect(describeLevelUp(member, planLevelUp({ member })))
            .toBe('Lyra sube al nivel 4 · +24 PG · +3 dado(s) de golpe · 2 punto(s) de característica.');
    });

    test('y cuando no se puede, por qué', () => {
        const member = hero();
        expect(describeLevelUp(member, planLevelUp({ member }))).toMatch(/Lyra: Le falta experiencia/);
    });

    test('la media de un dado es la de 5e', () => {
        expect(averageOfDie(6)).toBe(4);
        expect(averageOfDie(8)).toBe(5);
        expect(averageOfDie(10)).toBe(6);
        expect(averageOfDie(12)).toBe(7);
    });

    test('los niveles de mejora se leen del paquete', () => {
        expect([...normalizeAbilityLevels(null)]).toEqual([4, 8, 12, 16, 19]);
        expect([...normalizeAbilityLevels(['3', 'x', '6'])]).toEqual([3, 6]);
    });
});
