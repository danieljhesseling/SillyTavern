import { describe, test, expect } from '@jest/globals';
import { servicesOf, serviceActions, SERVICES_BY_TYPE, INN_PRICES } from '../public/scripts/game-engine/campaign/services.js';
import { chooseBark, BARKS, CHANCE } from '../public/scripts/game-engine/combat/barks.js';
import { bodyOf, bodyLine } from '../public/scripts/game-engine/campaign/body.js';

describe('los servicios de un sitio (L1)', () => {
    test('lo que dice la localidad manda', () => {
        expect(servicesOf({ services: ['templo', 'nada'], locationType: 'village' })).toEqual(['templo']);
    });

    test('sin decir nada, lo de su tipo', () => {
        expect(servicesOf({ locationType: 'village' })).toEqual(SERVICES_BY_TYPE.village);
        expect(servicesOf({ type: 'ruins' })).toEqual([]);
    });

    test('una lista vacía escrita a propósito es «aquí no hay nada»', () => {
        expect(servicesOf({ services: [], locationType: 'city' })).toEqual([]);
    });
});

describe('lo que se hace en cada uno (L3 y compañía)', () => {
    const base = { location: { services: ['posada', 'herreria', 'templo', 'tablon'] }, purse: 100, partySize: 2 };

    test('la posada: dormir, comer, rondas, rumores y quien atiende, con el precio dicho', () => {
        const cards = serviceActions({ ...base, companions: [{ id: '7', name: 'Bruna' }], rumors: 2, innkeeper: 'Giles' });
        const inn = cards.find(c => c.id === 'posada');
        expect(inn?.actions.map(a => a.id)).toEqual(['inn-common', 'inn-room', 'inn-meal', 'inn-round:7', 'inn-rumor', 'inn-talk']);
        expect(inn?.actions.find(a => a.id === 'inn-room')?.cost).toBe(INN_PRICES.room * 2);
        expect(inn?.actions.find(a => a.id === 'inn-round:7')?.target).toBe('7');
    });

    test('sin oro, se dice por qué no', () => {
        const inn = serviceActions({ ...base, purse: 1 }).find(c => c.id === 'posada');
        const room = inn?.actions.find(a => a.id === 'inn-room');
        expect(room?.enabled).toBe(false);
        expect(room?.detail).toMatch(/No llega el oro/);
    });

    test('peleando, nada', () => {
        const cards = serviceActions({ ...base, fighting: true });
        expect(cards.flatMap(c => c.actions).every(a => !a.enabled)).toBe(true);
    });

    test('la herrería hace los remedios, y el templo cura lo que se cura con tiempo', () => {
        const cards = serviceActions({
            ...base,
            remedies: [{ id: 'lost_leg', name: 'Bruna', label: 'Pierna de palo', cost: 150 }],
            cure: { gold: 30, days: 6 },
        });
        expect(cards.find(c => c.id === 'herreria')?.actions[0]).toMatchObject({ label: 'Pierna de palo para Bruna', enabled: false });
        expect(cards.find(c => c.id === 'templo')?.actions[0]).toMatchObject({ id: 'temple-cure', cost: 30, enabled: true });
    });

    test('un servicio sin nada que hacer no se enseña', () => {
        const ids = serviceActions(base).map(c => c.id);
        expect(ids).not.toContain('herreria');
        expect(ids).not.toContain('templo');
        expect(ids).toEqual(['posada', 'tablon']);
    });
});

describe('lo que dicen los compañeros (C7)', () => {
    const always = () => 0;

    test('habla según lo que le mueve', () => {
        const line = chooseBark({ event: 'kill', wants: 'coin', random: always });
        expect(BARKS.coin.kill).toContain(line);
    });

    test('grita el nombre de quien cae', () => {
        expect(chooseBark({ event: 'ally_down', wants: 'glory', about: 'Lyra', random: always })).toBe('¡Lyra, aguanta!');
    });

    test('no siempre habla, y no repite lo último', () => {
        expect(chooseBark({ event: 'hit', random: () => 0.99 })).toBe('');
        const first = BARKS.glory.hit[0];
        expect(chooseBark({ event: 'hit', last: first, random: always })).not.toBe(first);
    });

    test('un suceso que no existe, silencio', () => {
        expect(chooseBark({ event: 'bailar', random: always })).toBe('');
        expect(Object.keys(CHANCE)).toEqual(expect.arrayContaining(['hit', 'crit', 'kill', 'ally_down', 'victory']));
    });
});

describe('cómo está el grupo (C1)', () => {
    test('quien está bien no se nombra', () => {
        expect(bodyOf({ name: 'Brand', hp: 20, maxHp: 20 })).toBe('');
    });

    test('herido, en el suelo o con heridas que se arrastran', () => {
        expect(bodyOf({ name: 'Bruna', hp: 5, maxHp: 20 })).toBe('Bruna: muy malherido.');
        expect(bodyOf({ name: 'Lyra', hp: 0, maxHp: 20 })).toMatch(/en el suelo/);
        const leg = bodyOf({ name: 'Bruna', hp: 20, maxHp: 20, injuries: [{ id: 'wooden_leg', label: 'Pierna de palo', days: 0 }] });
        expect(leg).toBe('Bruna: pierna de palo.');
    });

    test('la línea entera, con día, sitio y tiempo', () => {
        const line = bodyLine({
            party: [{ name: 'Brand', hp: 20, maxHp: 20 }, { name: 'Bruna', hp: 8, maxHp: 20 }],
            day: 3, slot: 'Noche', climate: 'frio', place: 'El Pueblo de Barro',
        });
        expect(line.split('\n')).toEqual([
            '[CÓMO ESTÁ EL GRUPO]',
            'Día 3, Noche · El Pueblo de Barro, tiempo frio',
            'Bruna: herido.',
            'Que se note en la narración, sin exagerarlo.',
        ]);
        expect(bodyLine({ party: [{ name: 'Brand', hp: 1, maxHp: 1 }] })).toMatch(/Todos están bien/);
        expect(bodyLine({ party: [] })).toBe('');
    });
});
