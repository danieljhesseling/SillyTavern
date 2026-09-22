import { describe, test, expect } from '@jest/globals';
import {
    INJURY_TABLE, rollInjury, applyInjury, healInjuries, readInjuries,
    totalModifiers, treatmentCost, describeInjuries,
} from '../public/scripts/game-engine/rules/injuries.js';

/** Alguien entero, como sale de la ficha del grupo. */
const whole = () => ({ name: 'Bruna', speed: 30, armorClass: 15, strength: 14, maxHp: 24, dexterity: 16 });

/** Una tirada fija, para que la tabla no dependa de la suerte del que prueba. */
const fixed = (value) => () => value;

describe('la tabla de heridas', () => {
    test('va de leve a grave, y las peores no curan', () => {
        const first = INJURY_TABLE[0];
        const last = INJURY_TABLE[INJURY_TABLE.length - 1];
        expect(first.days).toBeGreaterThan(0);
        expect(last.days).toBe(0);
    });

    test('todas tocan algo que el motor lee de verdad', () => {
        const readable = ['speed', 'armorClass', 'strength', 'dexterity', 'constitution', 'wisdom', 'intelligence', 'charisma', 'maxHp'];
        for (const injury of INJURY_TABLE) {
            const stats = Object.keys(injury.modifiers);
            expect(stats.length).toBeGreaterThan(0);
            for (const stat of stats) expect(readable).toContain(stat);
        }
    });

    test('y todas hacen daño: ninguna es un adorno', () => {
        for (const injury of INJURY_TABLE) {
            for (const amount of Object.values(injury.modifiers)) expect(amount).toBeLessThan(0);
        }
    });
});

describe('qué herida toca', () => {
    test('una tirada baja deja lo leve; una alta, lo que no cura', () => {
        expect(rollInjury(fixed(0)).permanent).toBe(false);
        expect(rollInjury(fixed(0.99)).permanent).toBe(true);
    });

    test('caer por un critico empuja hacia lo grave, pero no lo garantiza', () => {
        const normal = rollInjury(fixed(0.4));
        const brutal = rollInjury(fixed(0.4), { severity: 1 });
        const normalIndex = INJURY_TABLE.findIndex(i => i.id === normal.id);
        const brutalIndex = INJURY_TABLE.findIndex(i => i.id === brutal.id);
        expect(brutalIndex).toBeGreaterThan(normalIndex);
        // Empuja, no salta: con una tirada baja sigue sin salir lo peor de todo.
        expect(rollInjury(fixed(0), { severity: 1 }).permanent).toBe(false);
    });

    test('nace con sus dias por delante, y lo permanente nace sabiendolo', () => {
        const sprain = rollInjury(fixed(0.1));
        expect(sprain.daysLeft).toBe(sprain.days);
        expect(rollInjury(fixed(0.99)).daysLeft).toBe(0);
    });
});

describe('lo que una herida le hace a alguien', () => {
    test('una pierna rota es velocidad de verdad, no una etiqueta', () => {
        const broken = INJURY_TABLE.find(i => i.id === 'broken_leg');
        const patch = applyInjury(whole(), { ...broken, daysLeft: broken.days, permanent: false });
        expect(patch.stats.speed).toBe(20);
    });

    test('guarda el numero de antes para poder volver', () => {
        const patch = applyInjury(whole(), rollInjury(fixed(0.1)));
        expect(patch.baseStats.speed).toBe(30);
    });

    test('dos heridas se suman', () => {
        const hurt = whole();
        const first = applyInjury(hurt, INJURY_TABLE.find(i => i.id === 'sprain'));
        Object.assign(hurt, first.stats, { injuries: first.injuries, baseStats: first.baseStats });

        const second = applyInjury(hurt, INJURY_TABLE.find(i => i.id === 'broken_leg'));
        expect(second.stats.speed).toBe(15);
        expect(second.injuries).toHaveLength(2);
    });

    // Sin esto, dos heridas y una curada dejarian la velocidad donde nadie la puso.
    test('el suelo no se mueve aunque se hiera dos veces seguidas', () => {
        const hurt = whole();
        const first = applyInjury(hurt, INJURY_TABLE.find(i => i.id === 'sprain'));
        Object.assign(hurt, first.stats, { injuries: first.injuries, baseStats: first.baseStats });
        const second = applyInjury(hurt, INJURY_TABLE.find(i => i.id === 'sprain'));
        expect(second.baseStats.speed).toBe(30);
    });

    test('nadie se queda clavado en el sitio: quien vive puede moverse', () => {
        const hurt = whole();
        hurt.speed = 10;
        const patch = applyInjury(hurt, INJURY_TABLE.find(i => i.id === 'lost_leg'));
        expect(patch.stats.speed).toBe(5);
    });

    test('lo que suman todas juntas se puede preguntar', () => {
        const injuries = [
            { ...INJURY_TABLE.find(i => i.id === 'sprain'), daysLeft: 5, permanent: false },
            { ...INJURY_TABLE.find(i => i.id === 'broken_leg'), daysLeft: 14, permanent: false },
        ];
        expect(totalModifiers(injuries).speed).toBe(-15);
    });
});

describe('curar', () => {
    test('los dias pasan y lo leve se va', () => {
        const hurt = whole();
        const patch = applyInjury(hurt, INJURY_TABLE.find(i => i.id === 'sprain'));
        Object.assign(hurt, patch.stats, { injuries: patch.injuries, baseStats: patch.baseStats });

        const after = healInjuries(hurt, 5);
        expect(after.healed.map(i => i.id)).toEqual(['sprain']);
        expect(after.injuries).toEqual([]);
        expect(after.stats.speed).toBe(30);
    });

    test('a medio curar, sigue doliendo', () => {
        const hurt = whole();
        const patch = applyInjury(hurt, INJURY_TABLE.find(i => i.id === 'broken_leg'));
        Object.assign(hurt, patch.stats, { injuries: patch.injuries, baseStats: patch.baseStats });

        const after = healInjuries(hurt, 4);
        expect(after.injuries[0].daysLeft).toBe(10);
        expect(after.stats.speed).toBe(20);
    });

    test('lo permanente no cura por mucho que se espere', () => {
        const hurt = whole();
        const patch = applyInjury(hurt, INJURY_TABLE.find(i => i.id === 'lost_eye'));
        Object.assign(hurt, patch.stats, { injuries: patch.injuries, baseStats: patch.baseStats });

        const after = healInjuries(hurt, 9999);
        expect(after.injuries).toHaveLength(1);
        expect(after.healed).toEqual([]);
    });

    test('y quien no tiene nada no cura nada', () => {
        expect(healInjuries(whole(), 3).healed).toEqual([]);
    });
});

describe('lo que cuesta curarse', () => {
    const hurt = () => {
        const member = whole();
        const patch = applyInjury(member, INJURY_TABLE.find(i => i.id === 'broken_leg'));
        Object.assign(member, patch.stats, { injuries: patch.injuries, baseStats: patch.baseStats });
        return member;
    };

    test('se puede poner precio a lo que cura', () => {
        expect(treatmentCost(hurt(), 5).gold).toBe(70);
        expect(treatmentCost(hurt(), 5).days).toBe(14);
    });

    // Es lo que hace que una herida sea una decision de dinero y no solo una penalizacion.
    test('lo que no cura no tiene precio, y se dice aparte', () => {
        const member = whole();
        const patch = applyInjury(member, INJURY_TABLE.find(i => i.id === 'lost_leg'));
        Object.assign(member, patch.stats, { injuries: patch.injuries, baseStats: patch.baseStats });

        const cost = treatmentCost(member, 5);
        expect(cost.gold).toBe(0);
        expect(cost.permanent).toHaveLength(1);
        expect(cost.treatable).toEqual([]);
    });
});

describe('contado para leerlo', () => {
    test('dice qué es, cuánto duele y cuánto queda', () => {
        const member = whole();
        const patch = applyInjury(member, INJURY_TABLE.find(i => i.id === 'broken_leg'));
        Object.assign(member, { injuries: patch.injuries });

        const [line] = describeInjuries(member);
        expect(line).toMatch(/Pierna rota/);
        expect(line).toMatch(/speed -10/);
        expect(line).toMatch(/14 día\(s\)/);
    });

    test('y lo que no cura lo dice sin rodeos', () => {
        const member = whole();
        const patch = applyInjury(member, INJURY_TABLE.find(i => i.id === 'lost_leg'));
        Object.assign(member, { injuries: patch.injuries });
        expect(describeInjuries(member)[0]).toMatch(/para siempre/);
    });

    test('una ficha sin heridas se lee sin romperse', () => {
        expect(readInjuries({})).toEqual([]);
        expect(readInjuries(null)).toEqual([]);
        expect(describeInjuries({ injuries: 'no soy una lista' })).toEqual([]);
    });
});
