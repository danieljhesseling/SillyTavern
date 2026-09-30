import { describe, test, expect } from '@jest/globals';
import { buildTown } from '../public/scripts/game-engine/ui/shell/town-scene.js';

/** Puerto Alba, como la deja el importador: los sitios, con quien atiende por nombre. */
const alba = {
    name: 'Puerto Alba',
    locationType: 'city',
    services: ['posada', 'tienda', 'templo', 'herreria'],
    places: [
        { kind: 'gremio', name: 'La Casa del Gremio', keeper: 'Brunilda' },
        { kind: 'herreria', keeper: 'Ramiro' },
        { kind: 'posada', name: 'La taberna', keeper: 'Tomás' },
        { kind: 'tienda', keeper: 'Marisa' },
    ],
};
const npcs = [
    { name: 'Brunilda', where: 'Puerto Alba', service: 'gremio', trade: 'Maestra del gremio' },
    { name: 'Tomás', where: 'Puerto Alba', service: 'posada', trade: 'Posadero' },
    { name: 'Ramiro', where: 'Puerto Alba', service: 'herreria', trade: 'Herrero' },
    { name: 'Marisa', where: 'Puerto Alba', service: 'tienda', trade: 'Tendera' },
];

/**
 * Alguien de tu gente, como lo da `townPeople` (`party/social.js`).
 *
 * @param {string} name
 * @param {string} place
 * @param {Partial<import('../public/scripts/game-engine/ui/shell/town-scene.js').YourPerson>} [over]
 * @returns {import('../public/scripts/game-engine/ui/shell/town-scene.js').YourPerson}
 */
const person = (name, place, over = {}) => ({
    key: name.toLowerCase().replace(/\s+/g, '-'), name, kind: 'mercenario', place, placeLabel: place, canMeet: true, wantsToMeet: false,
    canTalk: true, talk: `/charlar ${name}`, meet: `/quedar ${name}`, ...over,
});

/** @param {any[]} people */
const townWith = (people) => buildTown({
    here: 'Puerto Alba', hero: 'Iria', slot: 'Tarde', cards: [], chips: [],
    data: { location: alba, npcs, people }, onService: () => {}, onChip: () => {}, refresh: () => {},
});

describe('J14.4: tu gente en la pantalla del pueblo', () => {
    test('cada uno en su sitio; quien anda por uno sin tarjeta (el muelle), aparte', () => {
        const town = townWith([
            person('Nella Tresflechas', 'tienda', { wantsToMeet: true }),
            person('Gerd el Mellado', 'muelle'),
            person('Osric Mediapaga', 'posada'),
        ]);
        expect(town?.yours.tienda?.map(p => p.name)).toEqual(['Nella Tresflechas']);
        expect(town?.yours.tienda?.[0].wantsToMeet).toBe(true);
        expect(town?.yours.posada?.map(p => p.name)).toEqual(['Osric Mediapaga']);
        expect(town?.loose.map(p => p.name)).toEqual(['Gerd el Mellado']);
    });

    test('la gente del pueblo no se repite (ya sale en su sitio), ni quien no tiene nada que hacer contigo', () => {
        const town = townWith([
            person('Tomás', 'posada', { kind: 'pueblo', canMeet: false }),
            person('Alguien', 'plaza', { canMeet: false, canTalk: false }),
        ]);
        expect(town?.yours).toEqual({});
        expect(town?.loose).toEqual([]);
    });

    test('sin gente (fuera de una partida), la pantalla sale igual', () => {
        const town = townWith([]);
        expect(town?.places.map(p => p.id)).toEqual(['gremio', 'herreria', 'posada', 'tienda']);
        expect(town?.yours).toEqual({});
    });
});
