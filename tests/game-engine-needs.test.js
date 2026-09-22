import { describe, test, expect } from '@jest/globals';
import {
    NEED_LIMITS, EXHAUSTION, LETHAL_EXHAUSTION, CLIMATES,
    readNeeds, levelsFrom, exhaustionOf, exhaustionInjury, tickNeeds, relieve, describeNeeds,
} from '../public/scripts/game-engine/rules/needs.js';
import { setInjury, readInjuries } from '../public/scripts/game-engine/rules/injuries.js';

const lyra = (needs = {}) => ({ name: 'Lyra', speed: 30, maxHp: 24, strength: 14, dexterity: 14, needs });

describe('las cuatro necesidades', () => {
    test('empiezan a cero y no se rompen si no hay nada escrito', () => {
        expect(readNeeds({})).toEqual({ hunger: 0, thirst: 0, rest: 0, exposure: 0 });
        expect(readNeeds(null)).toEqual({ hunger: 0, thirst: 0, rest: 0, exposure: 0 });
    });

    // Se puede salir sin cena; sin cantimplora, no. Y eso hace del agua una decision.
    test('la sed aprieta antes que el hambre', () => {
        expect(NEED_LIMITS.thirst.grace).toBeLessThan(NEED_LIMITS.hunger.grace);
    });

    test('hay un margen antes de que duela nada', () => {
        expect(levelsFrom({ hunger: 40, thirst: 10, rest: 10, exposure: 0 }))
            .toEqual({ hunger: 0, thirst: 0, rest: 0, exposure: 0 });
    });

    test('y a partir de ahí va subiendo', () => {
        expect(levelsFrom({ hunger: 73, thirst: 0, rest: 0, exposure: 0 }).hunger).toBe(1);
        expect(levelsFrom({ hunger: 73 + 24, thirst: 0, rest: 0, exposure: 0 }).hunger).toBe(2);
    });
});

describe('el agotamiento', () => {
    // Sumarlos haria que tres molestias pequenas mataran antes que una grave.
    test('es el peor de tus motivos, no la suma', () => {
        const level = exhaustionOf({ hunger: 73, thirst: 25, rest: 25, exposure: 0 });
        expect(level).toBe(1);
    });

    test('con nada encima, cero', () => {
        expect(exhaustionOf({ hunger: 0, thirst: 0, rest: 0, exposure: 0 })).toBe(0);
    });

    test('no pasa del último nivel por mucho que se alargue', () => {
        expect(exhaustionOf({ hunger: 9999, thirst: 9999, rest: 9999, exposure: 9999 }))
            .toBe(LETHAL_EXHAUSTION);
    });

    test('va de cansado a no levantarse, y cada nivel pesa más', () => {
        expect(EXHAUSTION).toHaveLength(LETHAL_EXHAUSTION);
        for (let i = 1; i < EXHAUSTION.length; i++) {
            const before = Math.abs(EXHAUSTION[i - 1].modifiers.speed ?? 0);
            const after = Math.abs(EXHAUSTION[i].modifiers.speed ?? 0);
            expect(after).toBeGreaterThanOrEqual(before);
        }
    });
});

describe('el agotamiento se pone como una herida', () => {
    // Dos sistemas escribiendo `speed` a la vez es como se pierde el numero de partida.
    test('baja la velocidad por el mismo sitio que una pierna rota', () => {
        const patch = setInjury(lyra(), exhaustionInjury(3), 'exhaustion');
        expect(patch.stats.speed).toBe(20);
        expect(patch.baseStats.speed).toBe(30);
    });

    test('y no se acumulan dos agotamientos: hay uno, de un nivel', () => {
        const member = lyra();
        const first = setInjury(member, exhaustionInjury(2), 'exhaustion');
        Object.assign(member, first.stats, { injuries: first.injuries, baseStats: first.baseStats });

        const second = setInjury(member, exhaustionInjury(4), 'exhaustion');
        expect(second.injuries.filter(i => i.id === 'exhaustion')).toHaveLength(1);
        expect(second.stats.speed).toBe(15);
    });

    test('descansar lo quita y devuelve lo suyo', () => {
        const member = lyra();
        const tired = setInjury(member, exhaustionInjury(3), 'exhaustion');
        Object.assign(member, tired.stats, { injuries: tired.injuries, baseStats: tired.baseStats });

        const rested = setInjury(member, null, 'exhaustion');
        expect(rested.stats.speed).toBe(30);
        expect(readInjuries({ injuries: rested.injuries })).toEqual([]);
    });

    test('y no pisa una herida de verdad que ya estuviera puesta', () => {
        const member = lyra();
        const broken = setInjury(member, { id: 'broken_leg', label: 'Pierna rota', modifiers: { speed: -10 }, days: 14 }, 'broken_leg');
        Object.assign(member, broken.stats, { injuries: broken.injuries, baseStats: broken.baseStats });

        const also = setInjury(member, exhaustionInjury(2), 'exhaustion');
        expect(also.injuries).toHaveLength(2);
        expect(also.stats.speed).toBe(10);
    });
});

describe('que pasen las horas', () => {
    test('suma lo que no has hecho y pone a cero lo que sí', () => {
        const after = tickNeeds(lyra({ hunger: 10, thirst: 10, rest: 10 }), { hours: 8, drank: true });
        expect(after.needs.hunger).toBe(18);
        expect(after.needs.thirst).toBe(0);
        expect(after.needs.rest).toBe(18);
    });

    test('un clima templado no hace nada', () => {
        const after = tickNeeds(lyra(), { hours: 24, climate: 'mild' });
        expect(after.damage).toBe(0);
        expect(after.needs.exposure).toBe(0);
    });

    test('pero el frío y el calor hacen daño de verdad', () => {
        expect(tickNeeds(lyra(), { hours: 24, climate: 'freezing' }).damage).toBe(CLIMATES.freezing.damagePerDay);
        expect(tickNeeds(lyra(), { hours: 24, climate: 'scorching' }).damage).toBe(CLIMATES.scorching.damagePerDay);
    });

    test('y bajo techo no pasa nada de eso', () => {
        const after = tickNeeds(lyra({ exposure: 10 }), { hours: 6, climate: 'freezing', sheltered: true });
        expect(after.damage).toBe(0);
        expect(after.needs.exposure).toBe(4);
    });

    test('avisa cuando algo empieza a apretar', () => {
        const after = tickNeeds(lyra({ thirst: 23 }), { hours: 4 });
        expect(after.lines.join(' ')).toMatch(/sed/);
    });

    test('y no repite el aviso cada hora', () => {
        const after = tickNeeds(lyra({ thirst: 30 }), { hours: 1 });
        expect(after.lines.join(' ')).not.toMatch(/sed/);
    });
});

describe('morirse de esto', () => {
    // Lo que pidio: golpe de calor, de frio, y caer de cansancio.
    test('se llega al final, y se dice', () => {
        const after = tickNeeds(lyra({ thirst: 200 }), { hours: 1 });
        expect(after.exhaustion).toBe(LETHAL_EXHAUSTION);
        expect(after.collapsed).toBe(true);
        expect(after.lines.join(' ')).toMatch(/no puede más/);
    });

    // El modulo no mata a nadie: quien llama conoce las reglas de esta campana, y ahi es
    // donde se decide si los tuyos mueren o quedan marcados.
    test('pero no mata: lo dice y deja decidir a quien conoce las reglas', () => {
        const after = tickNeeds(lyra({ thirst: 200 }), { hours: 1 });
        expect(after).not.toHaveProperty('dead');
        expect(Object.keys(after).sort()).toEqual(['collapsed', 'damage', 'exhaustion', 'lines', 'needs']);
    });

    test('aguantar la intemperie también acaba tumbándote', () => {
        const after = tickNeeds(lyra({ exposure: 100 }), { hours: 1, climate: 'freezing' });
        expect(after.exhaustion).toBeGreaterThan(3);
    });
});

describe('comer, beber, dormir', () => {
    test('cada cosa arregla lo suyo y solo lo suyo', () => {
        const member = lyra({ hunger: 80, thirst: 40, rest: 40 });
        expect(relieve(member, 'ate')).toEqual({ hunger: 0, thirst: 40, rest: 40, exposure: 0 });
        expect(relieve(member, 'drank').thirst).toBe(0);
        expect(relieve(member, 'slept').rest).toBe(0);
    });
});

describe('contado en una línea', () => {
    test('solo dice algo cuando hay algo que decir', () => {
        expect(describeNeeds(lyra())).toBe('');
    });

    test('y entonces dice qué y cuánto', () => {
        const said = describeNeeds(lyra({ thirst: 50 }));
        expect(said).toMatch(/sed/);
        expect(said).toMatch(/Cansado|Agotado|Exhausto/);
    });
});
