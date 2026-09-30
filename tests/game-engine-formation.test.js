import { describe, test, expect } from '@jest/globals';
import {
    ROWS, DUTIES, readFormation, suggestOrder, orderOf, rowOf, moveInOrder, setDuty, suggestHealer, dutyHolder,
    healerFirst, travelRolesOf, guardsOf, ambushed, inMarchOrder, describeFormation, frontness,
} from '../public/scripts/game-engine/campaign/formation.js';
import { rollRoles, describeRoles } from '../public/scripts/game-engine/world/travel-roles.js';

const bran = { id: 1, name: 'Bran', class: 'Guerrero', armorClass: 16, maxHp: 14, hp: 14, wisdom: 10, charisma: 8 };
const lyra = { id: 2, name: 'Lyra', class: 'Clériga', armorClass: 15, maxHp: 10, hp: 10, wisdom: 16, charisma: 10 };
const mira = { id: 3, name: 'Mira', class: 'Maga', armorClass: 11, maxHp: 7, hp: 7, wisdom: 12, charisma: 12 };
const pip = { id: 4, name: 'Pip', class: 'Pícaro', armorClass: 14, maxHp: 9, hp: 9, wisdom: 14, charisma: 14, level: 1 };
const party = [mira, pip, bran, lyra];

describe('leer lo guardado', () => {
    test('vacío, con todos los papeles en automático', () => {
        const read = readFormation(null);
        expect(read.order).toEqual([]);
        expect(Object.keys(read.duties)).toEqual(Object.keys(DUTIES));
        expect(Object.values(read.duties).every(v => v === '')).toBe(true);
    });

    test('sin repetidos, y los ids como texto', () => {
        expect(readFormation({ order: [1, '1', 2], duties: { cura: 2 } })).toMatchObject({ order: ['1', '2'], duties: { cura: '2' } });
    });
});

describe('el orden de la marcha', () => {
    test('el juego propone: los que aguantan delante, los frágiles detrás', () => {
        expect(suggestOrder(party)).toEqual(['1', '2', '4', '3']);
        expect(frontness(bran)).toBeGreaterThan(frontness(mira));
    });

    test('lo elegido se respeta; los nuevos, detrás; los que ya no están, fuera', () => {
        const formation = readFormation({ order: ['3', '9', '1'] });
        expect(orderOf(formation, party)).toEqual(['3', '1', '2', '4']);
    });

    test('las filas según cuántos sois', () => {
        expect([0].map(i => rowOf(i, 1))).toEqual(['delante']);
        expect([0, 1].map(i => rowOf(i, 2))).toEqual(['delante', 'detras']);
        expect([0, 1, 2].map(i => rowOf(i, 3))).toEqual(['delante', 'medio', 'detras']);
        expect([0, 1, 2, 3].map(i => rowOf(i, 4))).toEqual(['delante', 'delante', 'medio', 'detras']);
        expect([0, 1, 2, 3, 4].map(i => rowOf(i, 5))).toEqual(['delante', 'delante', 'medio', 'detras', 'detras']);
        expect(Object.keys(ROWS)).toEqual(['delante', 'medio', 'detras']);
    });

    test('subir y bajar a alguien', () => {
        let formation = readFormation({});
        formation = moveInOrder(formation, party, 3, -1);
        expect(formation.order).toEqual(['1', '2', '3', '4']);
        formation = moveInOrder(formation, party, 1, -1);
        expect(formation.order).toEqual(['1', '2', '3', '4']);
        formation = moveInOrder(formation, party, 1, 1);
        expect(formation.order).toEqual(['2', '1', '3', '4']);
    });

    test('el grupo en el orden de la marcha, para las casillas de inicio', () => {
        expect(inMarchOrder(readFormation({ order: ['4'] }), party).map(m => m.name)).toEqual(['Pip', 'Bran', 'Lyra', 'Mira']);
    });

    test('quien se lleva el primer golpe de una emboscada', () => {
        const formation = readFormation({});
        expect(ambushed(formation, party, 'delante')?.name).toBe('Bran');
        expect(ambushed(formation, party, 'detras')?.name).toBe('Mira');
    });
});

describe('los papeles', () => {
    test('quién cura: la clériga, si no se elige', () => {
        expect(suggestHealer(party)?.name).toBe('Lyra');
        expect(dutyHolder(readFormation({}), 'cura', party)?.name).toBe('Lyra');
    });

    test('lo elegido manda mientras esté en pie', () => {
        const formation = setDuty(readFormation({}), 'cura', 4);
        expect(dutyHolder(formation, 'cura', party)?.name).toBe('Pip');
        expect(dutyHolder(formation, 'cura', [mira, { ...pip, hp: 0 }, bran, lyra])?.name).toBe('Lyra');
        expect(setDuty(formation, 'bailar', 1)).toEqual(formation);
    });

    test('quien cura, el primero: así lo encuentra quien venda tras la pelea', () => {
        expect(healerFirst(readFormation({}), party)[0].name).toBe('Lyra');
        expect(healerFirst(setDuty(readFormation({}), 'cura', 3), party).map(m => m.name)).toEqual(['Mira', 'Pip', 'Bran', 'Lyra']);
    });

    test('quién habla: el de más labia, o el elegido', () => {
        expect(dutyHolder(readFormation({}), 'portavoz', party)?.name).toBe('Pip');
        expect(dutyHolder(setDuty(readFormation({}), 'portavoz', 1), 'portavoz', party)?.name).toBe('Bran');
    });

    test('los papeles del camino respetan lo elegido y reparten el resto', () => {
        const modifierOf = (m, skill) => (skill === 'perception' ? Math.floor((m.wisdom - 10) / 2) + 5 : Math.floor((m.wisdom - 10) / 2));
        const auto = travelRolesOf({ formation: readFormation({}), party, modifierOf });
        expect(auto.map(r => r.role)).toEqual(['guia', 'vigia', 'cazador']);
        expect(auto[0].name).toBe('Lyra');
        const chosen = travelRolesOf({ formation: setDuty(readFormation({}), 'vigia', 1), party, modifierOf });
        expect(chosen.find(r => r.role === 'vigia')?.name).toBe('Bran');
        expect(new Set(chosen.map(r => r.id)).size).toBe(3);
        // La misma forma que `assignRoles`: se tira y se cuenta igual.
        const rolled = rollRoles({ roles: chosen, rollD20: () => 15, days: 2 });
        expect(rolled.dayLess).toBe(true);
        expect(describeRoles(rolled.results)).toMatch(/Vigía: Bran/);
    });

    test('con dos, un papel se queda sin hacer', () => {
        expect(travelRolesOf({ formation: readFormation({}), party: [bran, mira], modifierOf: () => 0 })).toHaveLength(2);
    });

    test('la guardia de la noche: el vigía elegido el primero', () => {
        const formation = setDuty(readFormation({}), 'vigia', 3);
        expect(guardsOf(formation, party, ['4', '2'])).toEqual(['3', '4']);
        expect(guardsOf(readFormation({}), party, ['4', '2'])).toEqual(['4', '2']);
    });

    test('dicha en una línea', () => {
        expect(describeFormation(readFormation({}), party)).toBe('Delante: Bran, Lyra · En medio: Pip · Detrás: Mira. Cura: Lyra. Habla: Pip.');
    });
});
