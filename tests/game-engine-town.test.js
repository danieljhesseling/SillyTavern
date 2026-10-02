import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import {
    PLACE_KINDS, readPlaces, townPlaces, townNpcsFromEntries, slotOf, greetingFor, describeWho,
} from '../public/scripts/game-engine/campaign/town.js';
import { validatePack } from '../public/scripts/game-engine/campaign/campaign-pack.js';
import { buildImportPlan } from '../public/scripts/game-engine/campaign/campaign-importer.js';
import { buildCampaignPackSchema } from '../public/scripts/game-engine/campaign/campaign-pack-schema.js';

/** @param {string} path */
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

/** Puerto Alba, como la deja el importador: los sitios, con quien atiende por nombre. */
const alba = {
    name: 'Puerto Alba',
    locationType: 'city',
    services: ['posada', 'tienda', 'templo', 'herreria'],
    places: [
        { kind: 'herreria', keeper: 'Ramiro' },
        { kind: 'posada', name: 'La taberna', keeper: 'Tomás' },
        { kind: 'gremio', name: 'La Casa del Gremio', keeper: 'Brunilda' },
    ],
};
const people = [
    { name: 'Brunilda', where: 'Puerto Alba', service: 'gremio', trade: 'Maestra del gremio' },
    { name: 'Tomás', where: 'Puerto Alba', service: 'posada', trade: 'Posadero' },
    { name: 'Ramiro', where: 'Puerto Alba', service: 'herreria', trade: 'Herrero' },
    { name: 'Marisa', where: 'Puerto Alba', service: 'tienda', trade: 'Tendera' },
];

describe('los sitios de un pueblo (J3.11)', () => {
    test('la lista escrita manda: sus nombres, su orden y quien atiende cada uno; el gremio, primero', () => {
        const { places } = townPlaces({ location: alba, npcs: people });
        // D-J30: el gremio va el primero aunque la lista (de una partida de antes) lo ponga al final.
        expect(places.map(p => p.id)).toEqual(['gremio', 'herreria', 'posada', 'plaza']);
        expect(places[1]).toMatchObject({ name: 'La herrería', art: 'herreria', keeper: { name: 'Ramiro', trade: 'Herrero' } });
        expect(places[2]).toMatchObject({ name: 'La taberna', art: 'taberna', keeper: { name: 'Tomás' } });
        expect(places[0].keeper?.name).toBe('Brunilda');
        // Marisa atiende la tienda, que no está en la lista: sale en la plaza, no se pierde.
        expect(places[3].people.map(p => p.name)).toEqual(['Marisa']);
    });

    test('sin lista, un sitio por servicio, con el primero de aquí que lo atiende', () => {
        const village = { name: 'Krezk', locationType: 'village', services: ['posada', 'templo'] };
        const npcs = [
            { name: 'Dmitri', where: 'Krezk', service: 'posada' },
            { name: 'El Abad', where: 'Krezk', service: 'templo' },
            { name: 'Clovin', where: 'Krezk', service: '' },
            { name: 'Anna', where: 'Krezk', service: 'posada' },
            { name: 'Otro', where: 'Vallaki', service: 'posada' },
        ];
        const { places } = townPlaces({ location: village, npcs });
        expect(places.map(p => [p.id, p.keeper?.name ?? '', p.people.map(x => x.name)])).toEqual([
            ['posada', 'Dmitri', ['Anna']],
            ['templo', 'El Abad', []],
            ['plaza', '', ['Clovin']],
        ]);
    });

    test('las tarjetas de servicios, cada una a su sitio; lo que no es de ninguno, a la plaza', () => {
        const cards = ['posada', 'herreria', 'tienda', 'maestro', 'caso'].map(id => ({ id }));
        const { places, rest } = townPlaces({ location: alba, npcs: people, cards });
        const byId = Object.fromEntries(places.map(p => [p.id, p.cards]));
        expect(byId).toEqual({ herreria: ['herreria'], posada: ['posada'], gremio: ['maestro'], plaza: ['tienda', 'caso'] });
        expect(rest).toEqual([]);
    });

    test('el gremio sale en el pueblo del gremio aunque su lista no lo diga', () => {
        const old = { name: 'Puerto Alba', locationType: 'city', services: ['posada'] };
        // Un gremio de antes: Brunilda sin servicio, pero con su oficio.
        const found = townPlaces({ location: old, npcs: [{ name: 'Brunilda', where: 'Puerto Alba', service: '', trade: 'Maestra del gremio' }], guild: true });
        expect(found.places.map(p => [p.id, p.keeper?.name ?? ''])).toEqual([['gremio', 'Brunilda'], ['posada', '']]);
        // Y sin nadie que lo diga, el gremio sale igual: lleva el tablón de campañas.
        expect(townPlaces({ location: old, guild: true, cards: [] }).places.map(p => p.id)).toEqual(['gremio']);
    });

    test('quien ha muerto ya no atiende; y un sitio vacío de un servicio que no hay, sobra', () => {
        const npcs = [{ name: 'Ramiro', where: 'Puerto Alba', service: 'herreria', dead: true }];
        const place = { name: 'Puerto Alba', locationType: 'city', services: ['posada'], places: [{ kind: 'herreria', keeper: 'Ramiro' }, { kind: 'muelle' }] };
        expect(townPlaces({ location: place, npcs, cards: [] }).places).toEqual([]);
        // Al contar (sin tarjetas), la posada cuenta por estar en sus servicios.
        const town = { name: 'Puerto Alba', locationType: 'city', services: ['posada'] };
        expect(townPlaces({ location: town, npcs }).places.map(p => p.id)).toEqual(['posada']);
    });

    test('unas ruinas con un ermitaño no abren plaza: sin sitios, las tarjetas se quedan fuera', () => {
        const ruins = { name: 'Ruinas', locationType: 'ruins', services: [] };
        const found = townPlaces({ location: ruins, npcs: [{ name: 'Ermitaño', where: 'Ruinas' }], cards: [{ id: 'caso' }] });
        expect(found.places).toEqual([]);
        expect(found.rest).toEqual(['caso']);
    });

    test('un campamento con gente suelta no tiene plaza: es «La gente de aquí», sin dibujo de plaza', () => {
        const camp = { name: 'Campamento', locationType: 'camp', services: ['tienda'] };
        const { places } = townPlaces({ location: camp, npcs: [{ name: 'Stanimir', where: 'Campamento', service: 'tienda' }, { name: 'Luvash', where: 'Campamento' }] });
        expect(places.map(p => [p.id, p.name, p.art])).toEqual([['tienda', 'La tienda', 'tienda'], ['plaza', 'La gente de aquí', '']]);
    });

    test('dos sitios de la misma clase llevan número', () => {
        const town = { name: 'X', locationType: 'city', services: ['posada'], places: [{ kind: 'posada', name: 'Una' }, { kind: 'posada', name: 'Otra' }] };
        expect(townPlaces({ location: town }).places.map(p => p.id)).toEqual(['posada', 'posada-2']);
    });
});

describe('lo que el pueblo lee', () => {
    test('readPlaces tira las clases que no existen y cambia el id de quien atiende por su nombre', () => {
        const found = readPlaces([{ kind: 'herreria', keeper: 'ramiro' }, { kind: 'castillo' }, null, { kind: ' templo ', name: ' La capilla ' }],
            [{ id: 'ramiro', name: 'Ramiro' }]);
        expect(found).toEqual([{ kind: 'herreria', keeper: 'Ramiro' }, { kind: 'templo', name: 'La capilla' }]);
        expect(readPlaces('herreria')).toEqual([]);
    });

    test('la gente sale de las entradas del mundo; los confidentes no', () => {
        const npcs = townNpcsFromEntries({
            1: { comment: 'Ramiro', dndData: { entityType: 'npc', name: 'Ramiro', title: 'Herrero', service: 'herreria', mapPosition: { locationName: 'Puerto Alba' } } },
            2: { dndData: { entityType: 'npc', name: 'Mira', confidant: true } },
            3: { dndData: { entityType: 'monster', name: 'Rata' } },
            4: { dndData: { entityType: 'npc', name: 'Muerto', dead: true } },
        });
        expect(npcs).toEqual([
            { name: 'Ramiro', where: 'Puerto Alba', service: 'herreria', trade: 'Herrero', dead: false },
            { name: 'Muerto', where: '', service: '', trade: '', dead: true },
        ]);
    });

    test('la franja por su nombre en el reloj', () => {
        expect(slotOf('Mañana')).toBe('morning');
        expect(slotOf('Tarde')).toBe('afternoon');
        expect(slotOf('Noche')).toBe('night');
        expect(slotOf('')).toBe('');
    });
});

describe('lo que se lee al entrar', () => {
    const smithy = /** @type {any} */ (townPlaces({ location: alba, npcs: people }).places.find(p => p.id === 'herreria'));

    test('quien atiende saluda según la hora, y por tu nombre', () => {
        expect(greetingFor({ place: smithy, slot: 'Mañana', hero: 'Tessa' })).toBe('Ramiro deja el martillo sobre el yunque: «Buenos días, Tessa. ¿Qué hay que arreglar?»');
        expect(greetingFor({ place: smithy, slot: 'Noche' })).toMatch(/^Ramiro .*«Buenas noches\. Iba a apagar la fragua, pero pasa\./);
    });

    test('donde no atiende nadie, se dice lo que hay, sin adivinanzas', () => {
        const board = { ...smithy, kind: /** @type {'tablon'} */ ('tablon'), name: 'El tablón', keeper: null, people: [] };
        expect(greetingFor({ place: board })).toMatch(/^Un tablón de madera/);
        const square = { ...smithy, kind: /** @type {'plaza'} */ ('plaza'), name: 'La plaza', keeper: null };
        expect(greetingFor({ place: square, town: 'Vallaki' })).toBe('La plaza de Vallaki. Por aquí pasa todo el mundo.');
    });

    test('quién está, en una línea', () => {
        expect(describeWho(smithy)).toBe('Ramiro, herrero');
        expect(describeWho({ ...smithy, people: [{ name: 'Ana', trade: '' }, { name: 'Luis', trade: '' }] })).toBe('Ramiro, herrero y 2 más');
        expect(describeWho({ ...smithy, keeper: null, people: [] })).toBe('Nadie atiende');
    });
});

describe('los sitios en el paquete', () => {
    test('el esquema los publica, con las clases que el motor sabe dibujar', () => {
        const places = buildCampaignPackSchema().properties.locations.items.properties.places;
        expect(places.items.properties.kind.enum).toEqual(Object.keys(PLACE_KINDS));
    });

    test('el validador avisa de una clase que no existe y de quien no está en la gente', () => {
        const pack = read('../public/mundos/gremio.pack.json');
        pack.locations[0].places = [{ kind: 'castillo' }, { kind: 'herreria', keeper: 'nadie' }];
        const found = validatePack(pack);
        expect(found.ok).toBe(true);
        expect(found.warnings.map(w => w.path)).toEqual(expect.arrayContaining(['locations[0].places[0].kind', 'locations[0].places[1].keeper']));
    });

    test('Vallaki, de Strahd: sus sitios con quien los lleva, y el resto de la gente en la plaza', () => {
        const pack = read('../public/mundos/strahd.pack.json');
        const plan = buildImportPlan(pack);
        const vallaki = plan.metadata.locationMaps.find((/** @type {any} */ l) => l.name === 'Ciudad de Vallaki');
        const npcs = pack.npcs.map((/** @type {any} */ n) => ({ name: n.name, where: n.where, service: n.service, trade: n.trade }));
        const { places } = townPlaces({ location: vallaki, npcs });
        expect(places.map(p => [p.id, p.name, p.keeper?.name ?? ''])).toEqual([
            ['posada', 'El Agua Azul', 'Urwin Martikov'],
            ['tienda', 'El almacén de Arasek', 'Gunther Arasek'],
            ['herreria', 'La herrería', 'Bogdan Rusu'],
            ['templo', 'La iglesia de San Andral', 'Padre Lucian Petrovich'],
            ['tablon', 'El tablón de la plaza', ''],
            ['plaza', 'La plaza', ''],
        ]);
        expect(places[5].people.map(p => p.name)).toContain('Barón Vargas Vallakovich');
        // Y Krezk, con su abadía y (M4) el tablón de su puerta, para su encargo.
        const krezk = plan.metadata.locationMaps.find((/** @type {any} */ l) => l.name === 'Aldea de Krezk');
        expect(townPlaces({ location: krezk, npcs }).places.map(p => p.keeper?.name ?? '')).toEqual(['Dmitri Krezkov', 'El Abad', '', '']);
    });

    test('el gremio escribe sus sitios, y el importador los deja con quien atiende por nombre', () => {
        const pack = read('../public/mundos/gremio.pack.json');
        expect(validatePack(pack).warnings.filter(w => /places/.test(w.path))).toEqual([]);
        const plan = buildImportPlan(pack);
        const town = plan.metadata.locationMaps.find((/** @type {any} */ l) => l.name === 'Puerto Alba');
        // D-J30: el gremio, el primero.
        expect(town.places.map((/** @type {any} */ p) => [p.kind, p.keeper])).toEqual([
            ['gremio', 'Brunilda'], ['herreria', 'Ramiro'], ['posada', 'Tomás'], ['tienda', 'Marisa'], ['templo', 'Madre Elvira'],
        ]);
    });
});
