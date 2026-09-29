import { describe, test, expect } from '@jest/globals';
import {
    isOwnHero, activeHero, readRestingHeroes, restingUids, withResting, seatHero, swapLine, carryLine, hubHeroCards,
} from '../public/scripts/game-engine/campaign/hub-heroes.js';

const tessa = {
    id: 1, name: 'Tessa', wiUid: 4, worldName: 'El Gremio', race: 'Humana', class: 'Guerrera', level: 3, xp: 250, hp: 20, maxHp: 28, gold: 57,
    items: [{ id: 'a', name: 'Antorcha' }, { id: 'e', name: 'Espada larga' }, { id: 'c', name: 'Cota de malla' }],
    equippedItems: { mainHand: 'e', body: 'c' },
    mapPosition: { locationName: 'Puerto Alba', gridX: 2, gridY: 3 },
};
const bram = {
    id: 2, name: 'Bram', wiUid: 7, worldName: 'El Gremio', race: 'Mediano', class: 'Pícaro', level: 1, xp: 0, hp: 9, maxHp: 9, gold: 100,
    items: [{ id: 'd', name: 'Daga' }], equippedItems: { mainHand: 'd' },
    mapPosition: { locationName: 'Puerto Alba', gridX: 9, gridY: 9 },
};
const gerd = { id: 3, name: 'Gerd el Mellado', guest: { kind: 'mercenary', contractId: 'gremio' }, level: 3, mapPosition: { locationName: 'Puerto Alba', gridX: 3, gridY: 3 } };

describe('quién es de los tuyos', () => {
    test('ni los mercenarios ni los confidentes', () => {
        expect(isOwnHero(tessa)).toBe(true);
        expect(isOwnHero(gerd)).toBe(false);
        expect(isOwnHero({ id: 5, name: 'Ireena', confidant: true })).toBe(false);
        expect(isOwnHero(null)).toBe(false);
    });

    test('el que va es el primero de los tuyos, aunque vaya detrás de un mercenario', () => {
        expect(activeHero([gerd, tessa])?.name).toBe('Tessa');
        expect(activeHero([gerd])).toBeNull();
    });
});

describe('los que se quedan en el gremio', () => {
    test('lo roto se lee vacío; cada uno una vez', () => {
        expect(readRestingHeroes(null)).toEqual([]);
        expect(readRestingHeroes([null, 'x', { name: 'Sin id' }, gerd])).toEqual([]);
        expect(readRestingHeroes([tessa, { ...tessa, level: 9 }]).map(h => h.level)).toEqual([3]);
    });

    test('se queda entero: su nivel, su experiencia, lo que lleva y su oro', () => {
        const list = withResting([], { add: tessa });
        expect(list).toHaveLength(1);
        expect(list[0]).toMatchObject({ name: 'Tessa', level: 3, xp: 250, gold: 57, hp: 20 });
        expect(list[0].items).toEqual(tessa.items);
        expect(list[0].equippedItems).toEqual(tessa.equippedItems);
        // Es una copia: lo que le pase al grupo después no le toca.
        list[0].items.push({ id: 'z', name: 'Otra' });
        expect(tessa.items).toHaveLength(3);
    });

    test('el que sale del gremio deja la lista; el que vuelve no se duplica', () => {
        let list = withResting([], { add: tessa });
        list = withResting(list, { add: bram });
        list = withResting(list, { add: { ...tessa, level: 4 }, remove: 2 });
        expect(list.map(h => `${h.name} ${h.level}`)).toEqual(['Tessa 4']);
    });

    test('los muertos no se quedan, y un mercenario tampoco', () => {
        expect(withResting([], { add: { ...tessa, dead: true } })).toEqual([]);
        expect(withResting([], { add: gerd })).toEqual([]);
    });

    test('sus fichas del mundo, para no meterlas en el grupo', () => {
        expect([...restingUids([tessa, bram, { id: 9, name: 'Sin ficha', wiUid: null }])]).toEqual([4, 7]);
    });
});

describe('cambiar quién va', () => {
    test('el que entra ocupa el sitio y la casilla del que sale; el mercenario sigue', () => {
        const { party, outgoing } = seatHero({ party: [tessa, gerd], incoming: bram });
        expect(party.map(m => m.name)).toEqual(['Bram', 'Gerd el Mellado']);
        expect(party[0].mapPosition).toEqual(tessa.mapPosition);
        expect(party[0]).toMatchObject({ level: 1, gold: 100, wiUid: 7 });
        expect(party[1]).toBe(gerd);
        expect(outgoing).toBe(tessa);
    });

    test('sin nadie tuyo en el grupo, el que entra va el primero, donde estaba', () => {
        const { party, outgoing } = seatHero({ party: [gerd], incoming: bram });
        expect(party.map(m => m.name)).toEqual(['Bram', 'Gerd el Mellado']);
        expect(party[0].mapPosition).toEqual(bram.mapPosition);
        expect(outgoing).toBeNull();
    });

    test('se cuenta quién va y quién se queda', () => {
        expect(swapLine(bram, tessa)).toBe('Bram va con el grupo. Tessa se queda en el gremio, con lo suyo.');
        expect(swapLine(bram)).toBe('Bram va con el grupo.');
    });
});

describe('las tarjetas', () => {
    test('lo que lleva: lo puesto primero, y el oro', () => {
        expect(carryLine(tessa)).toBe('Lleva: Espada larga, Cota de malla y Antorcha. 57 de oro.');
        expect(carryLine(bram)).toBe('Lleva: Daga. 100 de oro.');
        expect(carryLine({ items: [] })).toBe('No lleva nada.');
        const many = { items: ['A', 'B', 'C', 'D', 'E'].map(name => ({ id: name, name })) };
        expect(carryLine(many)).toBe('Lleva: A, B, C y 2 cosas más.');
    });

    test('primero el que va, luego los del gremio; los caídos no salen', () => {
        const cards = hubHeroCards({ party: [tessa, gerd], resting: [bram, { ...bram, id: 8, name: 'Caído', dead: true }] });
        expect(cards.map(c => `${c.name}:${c.active}`)).toEqual(['Tessa:true', 'Bram:false']);
        expect(cards[0]).toMatchObject({ id: '1', what: 'Humana · Guerrera · Nivel 3', icon: 'fa-shield-halved', face: '' });
        expect(cards[1].icon).toBe('fa-mask');
    });

    test('la cara, si tiene una suya; la de SillyTavern por defecto, no', () => {
        const [withFace] = hubHeroCards({ party: [{ ...tessa, avatar: '/user/images/tessa.png' }], resting: [] });
        const [plain] = hubHeroCards({ party: [{ ...tessa, avatar: 'img/user-default.png' }], resting: [] });
        expect(withFace.face).toBe('/user/images/tessa.png');
        expect(plain.face).toBe('');
    });

    test('sin nadie tuyo, no hay tarjetas', () => {
        expect(hubHeroCards({ party: [gerd], resting: null })).toEqual([]);
    });
});
