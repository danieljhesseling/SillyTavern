import { describe, test, expect } from '@jest/globals';
import {
    RANKS, CONTRACT_KINDS, GUILD_THEMES, ranksFor, generateBoardOfContracts,
    deadlineOf, expireContracts, describeContract, contractsFromFactions, describeStake,
} from '../public/scripts/game-engine/campaign/contracts.js';
import { createSeededRandom } from '../public/scripts/game-engine/combat/seeded-random.js';

const board = (options = {}) => generateBoardOfContracts({
    random: createSeededRandom(options.seed ?? 'el tablon'),
    places: ['El molino', 'Vado del Sauce'],
    bestiary: ['Sabueso', 'Guardián'],
    day: 10,
    count: 6,
    ...options,
});

describe('los rangos', () => {
    test('pagan más cuanto más arriesgan', () => {
        for (let i = 1; i < RANKS.length; i++) {
            expect(RANKS[i].reward[0]).toBeGreaterThan(RANKS[i - 1].reward[0]);
            expect(RANKS[i].difficulty).toBeGreaterThan(RANKS[i - 1].difficulty);
        }
    });

    test('y aprietan más: los buenos vencen antes', () => {
        expect(RANKS[RANKS.length - 1].days[1]).toBeLessThan(RANKS[0].days[1]);
    });

    test('sin reputación solo hay recados, y uno más', () => {
        const open = ranksFor(0).map(r => r.id);
        expect(open[0]).toBe('D');
        expect(open).toHaveLength(2);
    });

    // El tablon tiene que ensenar siempre algo que todavia no deberias coger: es lo que
    // hace que la reputacion se sienta como una puerta y no como un numero.
    test('siempre asoma uno por encima del que te toca', () => {
        for (const renown of [0, 3, 8, 16]) {
            const open = ranksFor(renown);
            const earned = RANKS.filter(r => renown >= r.minRenown);
            expect(open).toHaveLength(earned.length + 1);
        }
    });

    test('y con toda la reputación del mundo no se inventa un rango que no existe', () => {
        expect(ranksFor(9999)).toHaveLength(RANKS.length);
    });
});

describe('el tablón', () => {
    test('se llena con lo que se le pide', () => {
        expect(board()).toHaveLength(6);
    });

    test('cada encargo paga, vence y dice quién lo pide', () => {
        for (const contract of board()) {
            expect(contract.reward).toBeGreaterThan(0);
            expect(contract.days).toBeGreaterThan(10);
            expect(contract.patron.length).toBeGreaterThan(0);
            expect(contract.title.length).toBeGreaterThan(0);
        }
    });

    test('y ninguno ofrece un rango que no te has ganado', () => {
        const allowed = new Set(ranksFor(0).map(r => r.id));
        for (const contract of board({ renown: 0 })) {
            expect(allowed.has(contract.rank)).toBe(true);
        }
    });

    test('los sitios salen del mundo, no de la nada', () => {
        for (const contract of board()) {
            if (!contract.locationName) continue;
            expect(['El molino', 'Vado del Sauce']).toContain(contract.locationName);
        }
    });

    // "Acabar con undefined" es el clasico encargo generado que delata al generador.
    test('sin bestiario, ningún encargo nombra a un bicho que no existe', () => {
        for (const contract of board({ bestiary: [], seed: 'sin bichos' })) {
            expect(contract.title).not.toMatch(/undefined|null/);
            expect(['hunt', 'silence']).not.toContain(contract.kind);
        }
    });

    test('y sin sitios tampoco se rompe', () => {
        expect(board({ places: [], seed: 'sin sitios' }).length).toBe(6);
    });
});

describe('la semilla manda aquí también', () => {
    test('el mismo tablón dos veces', () => {
        expect(board({ seed: 'martes' })).toEqual(board({ seed: 'martes' }));
    });

    test('y otro distinto con otra semilla', () => {
        expect(board({ seed: 'martes' })).not.toEqual(board({ seed: 'jueves' }));
    });
});

describe('la temática del gremio', () => {
    // Un gremio de ladrones tiene que sentirse distinto, no ser el mismo tablon con otro
    // rotulo. Un peso 0 no es "poco probable": es que ese gremio no recibe eso.
    test('un gremio de ladrones no recibe escoltas', () => {
        const kinds = board({ theme: 'thieves', count: 30, seed: 'ladrones' }).map(c => c.kind);
        expect(kinds).not.toContain('escort');
        expect(kinds).not.toContain('hold');
    });

    test('y roba más que nadie', () => {
        const thieves = board({ theme: 'thieves', count: 30, seed: 'x' }).filter(c => c.kind === 'steal').length;
        const general = board({ theme: 'general', count: 30, seed: 'x' }).filter(c => c.kind === 'steal').length;
        expect(thieves).toBeGreaterThan(general);
    });

    test('los asesinos silencian; los mercenarios aguantan', () => {
        const killers = board({ theme: 'assassins', count: 30, seed: 'y' }).map(c => c.kind);
        expect(killers).toContain('silence');
        expect(killers).not.toContain('escort');

        const hired = board({ theme: 'mercenaries', count: 30, seed: 'y' }).map(c => c.kind);
        expect(hired).not.toContain('silence');
    });

    test('una temática que no existe se juega como general, sin romperse', () => {
        expect(board({ theme: 'panaderos', count: 4 })).toHaveLength(4);
    });

    test('cada clase de trabajo sabe qué objetivo lleva al tablero', () => {
        for (const kind of Object.values(CONTRACT_KINDS)) {
            expect(kind.objective.length).toBeGreaterThan(0);
            expect(kind.phrase).toMatch(/\{place\}|\{target\}/);
        }
        expect(Object.keys(GUILD_THEMES)).toContain('general');
    });
});

describe('los plazos', () => {
    const contract = { id: 'x', rank: 'C', kind: 'cull', title: 'Despejar', reward: 50, days: 14, patron: 'nadie', locationName: '', difficulty: 1 };

    test('dicen cuánto queda', () => {
        expect(deadlineOf(contract, 10).daysLeft).toBe(4);
        expect(deadlineOf(contract, 10).expired).toBe(false);
    });

    test('avisan cuando aprietan', () => {
        expect(deadlineOf(contract, 13).urgent).toBe(true);
        expect(deadlineOf(contract, 10).urgent).toBe(false);
    });

    test('y se acaban', () => {
        expect(deadlineOf(contract, 15).expired).toBe(true);
    });

    // Dejar pasar un plazo es una decision, aunque sea por no mirar: merece decirse.
    test('lo vencido se cae del tablón, pero no en silencio', () => {
        const result = expireContracts([contract, { ...contract, id: 'y', days: 30 }], 20);
        expect(result.kept.map(c => c.id)).toEqual(['y']);
        expect(result.expired.map(c => c.id)).toEqual(['x']);
    });

    test('un tablón vacío no da problemas', () => {
        expect(expireContracts(null, 5)).toEqual({ kept: [], expired: [] });
    });
});

describe('leído en el tablón', () => {
    test('rango, qué es, cuánto paga, cuánto queda y quién lo pide', () => {
        const said = describeContract({
            id: 'x', rank: 'B', kind: 'cull', title: 'Despejar el molino',
            reward: 150, days: 14, patron: 'el concejo', locationName: 'El molino', difficulty: 3,
        }, 10);
        expect(said).toBe('[B] Despejar el molino — 150 de oro · 4 día(s) · el concejo');
    });

    test('y lo vencido lo dice', () => {
        const said = describeContract({
            id: 'x', rank: 'D', kind: 'cull', title: 'Tarde', reward: 10, days: 2, patron: 'nadie', locationName: '', difficulty: 0.25,
        }, 10);
        expect(said).toMatch(/vencido/);
    });
});

describe('encargos que toman partido', () => {
    const bandos = () => ([
        {
            id: 'molino', name: 'Los del Molino', seat: 'El molino', enemies: ['ermita'],
            goal: { kind: 'conquistar', target: 'Vado del Sauce', pace: 8, of: 6, at: 1 },
        },
        {
            id: 'ermita', name: 'Los de la Ermita', seat: 'Vado del Sauce', enemies: ['molino'],
            goal: { kind: 'controlar', target: 'El molino', pace: 5, of: 4, at: 0 },
        },
    ]);
    const suyos = (seed = 'toma partido', count = 2) => contractsFromFactions({
        factions: bandos(), random: createSeededRandom(seed), renown: 30, day: 10, count,
    });

    test('sin facciones no hay ninguno, y el tablón sigue como estaba', () => {
        expect(contractsFromFactions({ factions: [], random: createSeededRandom('x') })).toEqual([]);
    });

    test('una facción sin meta no genera encargo', () => {
        expect(contractsFromFactions({
            factions: [{ id: 'q', name: 'Quieta', goal: {} }], random: createSeededRandom('x'),
        })).toEqual([]);
    });

    // Lo que lo separa de un recado: al entregarlo, el reloj de alguien se mueve.
    test('cada uno dice a quién mueve y hacia dónde', () => {
        for (const contract of suyos()) {
            expect(['molino', 'ermita']).toContain(contract.faction);
            expect(typeof contract.against).toBe('boolean');
            expect(contract.segments).toBeGreaterThan(0);
        }
    });

    test('y tiene la misma forma que cualquier otro encargo del tablón', () => {
        for (const contract of suyos()) {
            expect(Object.keys(CONTRACT_KINDS)).toContain(contract.kind);
            expect(RANKS.map(r => r.id)).toContain(contract.rank);
            expect(contract.title).not.toMatch(/[{}]|undefined/);
            expect(contract.reward).toBeGreaterThan(0);
            expect(contract.days).toBeGreaterThan(10);
        }
    });

    // Su reloj no espera: el plazo es lo que tarda un segmento suyo, no lo que tarda un recado.
    test('el plazo no pasa de lo que tarda un segmento suyo', () => {
        for (const contract of suyos()) {
            expect(contract.days - 10).toBeLessThanOrEqual(8);
        }
    });

    test('quien lo paga no es quien lo sufre', () => {
        const suyo = suyos().filter(c => c.faction === 'molino');
        expect(suyo.map(c => c.patron))
            .toEqual(suyo.map(c => (c.against ? 'Los de la Ermita' : 'Los del Molino')));
    });

    test('nombra el sitio que está en juego', () => {
        for (const contract of suyos()) {
            expect(['Vado del Sauce', 'El molino']).toContain(contract.locationName);
        }
    });

    // La misma semilla, el mismo tablón: dos partidas iguales se pueden comparar.
    test('la misma semilla da los mismos, y otra da otros', () => {
        expect(suyos('una').map(c => c.title)).toEqual(suyos('una').map(c => c.title));
        expect(suyos('una').map(c => c.title)).not.toEqual(suyos('otra').map(c => c.title));
    });

    test('no pide más de los que hay', () => {
        expect(suyos('x', 9)).toHaveLength(2);
    });

    // Hay que poder verlo antes de aceptar, no después.
    test('se puede decir qué se juega el mundo', () => {
        const [contract] = suyos();
        expect(describeStake(contract, 'Los del Molino')).toMatch(/pierde una semana|gana una semana/);
    });

    test('y un encargo normal no se juega nada', () => {
        expect(describeStake({ id: 'c1', title: 'Recado' }, 'Nadie')).toBe('');
    });
});
