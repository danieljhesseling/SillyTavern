import { describe, test, expect } from '@jest/globals';
import {
    MORTALITY, SAVES, DEFAULT_SURVIVAL, readSurvival, motiveOf,
    resolveFall, canCheckpoint, describeSurvival,
} from '../public/scripts/game-engine/rules/mortality.js';

const roll = (value) => () => value;
const bonded = { name: 'Bruna', motive: 'bond', speed: 30 };
const hired = { name: 'Brand', motive: 'coin', speed: 30 };

describe('las dos casillas', () => {
    test('una campaña que no dice nada juega con lo más suave', () => {
        expect(readSurvival(null)).toEqual(DEFAULT_SURVIVAL);
        expect(DEFAULT_SURVIVAL.mortality).toBe(MORTALITY.MERCENARIES);
        expect(DEFAULT_SURVIVAL.saves).toBe(SAVES.FREE);
    });

    test('un valor que no existe no cuela', () => {
        expect(readSurvival({ mortality: 'a_veces', saves: 'los_martes' })).toEqual(DEFAULT_SURVIVAL);
    });

    test('y lo elegido se respeta', () => {
        expect(readSurvival({ mortality: MORTALITY.EVERYONE, saves: SAVES.SHELTER }))
            .toEqual({ mortality: MORTALITY.EVERYONE, saves: SAVES.SHELTER });
    });
});

describe('por qué te sigue alguien', () => {
    test('por la paga, si lo dice', () => {
        expect(motiveOf(hired)).toBe('coin');
    });

    // Una partida vieja no tiene este campo en ninguna ficha. Empezar a matar gente por
    // un valor que nadie escribió seria la peor manera de estrenar la regla.
    test('y por vinculo cuando nadie lo ha escrito', () => {
        expect(motiveOf({})).toBe('bond');
        expect(motiveOf(null)).toBe('bond');
        expect(motiveOf({ motive: '' })).toBe('bond');
    });
});

describe('quien cae, con la casilla suave', () => {
    test('el que vino por dinero muere, y se dice por qué', () => {
        const fall = resolveFall(hired, { roll: roll(0.5) });
        expect(fall.outcome).toBe('dies');
        expect(fall.reason).toMatch(/paga/);
        expect(fall.injury).toBeNull();
    });

    test('el tuyo sobrevive, pero no entero', () => {
        const fall = resolveFall(bonded, { roll: roll(0.5) });
        expect(fall.outcome).toBe('maimed');
        expect(fall.injury).not.toBeNull();
        expect(fall.reason).toMatch(/Bruna sobrevive/);
    });

    test('y caer por un crítico deja peor recuerdo', () => {
        const normal = resolveFall(bonded, { roll: roll(0.3) }).injury;
        const brutal = resolveFall(bonded, { roll: roll(0.3), severity: 1 }).injury;
        expect(brutal.days === 0 || brutal.days > normal.days).toBe(true);
    });
});

describe('quien cae, con la casilla dura', () => {
    const hard = { mortality: MORTALITY.EVERYONE };

    test('muere cualquiera, también los tuyos', () => {
        expect(resolveFall(bonded, { roll: roll(0.1), rules: hard }).outcome).toBe('dies');
        expect(resolveFall(hired, { roll: roll(0.1), rules: hard }).outcome).toBe('dies');
    });

    test('y no se reparte ninguna herida a un muerto', () => {
        expect(resolveFall(bonded, { roll: roll(0.1), rules: hard }).injury).toBeNull();
    });
});

describe('cuándo se guarda', () => {
    test('con guardado libre, siempre', () => {
        expect(canCheckpoint({ inCombat: true }, { saves: SAVES.FREE }).allowed).toBe(true);
    });

    const shelter = { saves: SAVES.SHELTER };

    test('en el refugio, sí', () => {
        expect(canCheckpoint({ inShelter: true }, shelter).allowed).toBe(true);
    });

    test('fuera del refugio, no, y dice dónde sí', () => {
        const answer = canCheckpoint({ inShelter: false }, shelter);
        expect(answer.allowed).toBe(false);
        expect(answer.reason).toMatch(/refugio/);
    });

    test('y en mitad de un combate, menos todavía', () => {
        const answer = canCheckpoint({ inShelter: true, inCombat: true }, shelter);
        expect(answer.allowed).toBe(false);
        expect(answer.reason).toMatch(/combate/);
    });

    // Las dos casillas van juntas porque una sin la otra no significa nada: con guardado
    // libre, la muerte permanente es opcional de facto.
    test('guardar libre y muerte total es una combinación que se puede elegir, y se nota', () => {
        const said = describeSurvival({ mortality: MORTALITY.EVERYONE, saves: SAVES.FREE });
        expect(said).toMatch(/cualquiera/);
        expect(said).toMatch(/cuando quieras/);
    });
});

describe('contado donde se elige', () => {
    test('lo suave', () => {
        expect(describeSurvival(null)).toBe(
            'Solo muere quien viene por dinero; los tuyos quedan marcados · se guarda cuando quieras');
    });

    test('lo duro', () => {
        expect(describeSurvival({ mortality: MORTALITY.EVERYONE, saves: SAVES.SHELTER })).toBe(
            'Puede morir cualquiera, también los tuyos · se guarda solo en el refugio');
    });
});

describe('las dos copias de los valores por defecto', () => {
    // `default-ruleset.js` declara en su cabecera que no importa nada: es la referencia
    // de como tiene que ser un paquete. Por eso los valores estan escritos dos veces, y
    // por eso esta prueba existe: para que no se separen en silencio.
    test('el paquete por defecto dice lo mismo que el modulo', async () => {
        const { DEFAULT_RULESET } = await import('../public/scripts/game-engine/rules/default-ruleset.js');
        expect(DEFAULT_RULESET.survival).toEqual(DEFAULT_SURVIVAL);
    });
});
