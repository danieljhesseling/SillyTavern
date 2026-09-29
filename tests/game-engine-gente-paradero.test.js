/**
 * J14.4 y J14.6: quién está dónde (`whereabouts.js`), y lo que la pantalla de la quedada decide
 * sin dibujar (`ui/meetup-scene.js`).
 */
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import {
    PLACES, SCHEDULE_BY_WANTS, placesOf, placeLabel, placeOpen, companionPlace, townsfolkPlace, homeOf, whoIsWhere, meetPlaces, socialChips,
} from '../public/scripts/game-engine/campaign/whereabouts.js';
import { readMeetupRows, personOf } from '../public/scripts/game-engine/campaign/meetups.js';
import { townPlaces, PLACE_KINDS } from '../public/scripts/game-engine/campaign/town.js';
import { HIRELINGS } from '../public/scripts/game-engine/campaign/guests.js';
import { readManifest } from '../public/scripts/game-engine/ui/pixel-art.js';
import { portraitFor, backdropFor, beatLines, beatChips, pickerCards } from '../public/scripts/game-engine/ui/meetup-scene.js';
import { readScene, startScene, sceneStep, sceneView } from '../public/scripts/game-engine/campaign/meetups.js';

const read = (/** @type {string} */ path) => JSON.parse(readFileSync(new URL(`../public/${path}`, import.meta.url), 'utf8'));
const data = readMeetupRows(read('compendio/quedadas.json'));
const gremio = read('mundos/gremio.pack.json');
const strahd = read('mundos/strahd.pack.json');
const puertoAlba = gremio.locations[0];
const barovia = strahd.locations.find((/** @type {any} */ l) => l.name === 'Aldea de Barovia');
const vallaki = strahd.locations.find((/** @type {any} */ l) => l.name === 'Ciudad de Vallaki');

const HERO = { id: 1, name: 'Tessa', gender: 'Mujer', hp: 20, maxHp: 20 };
const merc = (/** @type {number} */ id, /** @type {string} */ name, hp = 16) => ({ id, name, hp, maxHp: 16, guest: { kind: 'mercenary', contractId: 'gremio' }, reasons: { wants: 'coin' } });
const townsfolk = gremio.npcs.map((/** @type {any} */ n) => ({ name: n.name, where: n.where, service: n.service }));

/**
 * @param {ReturnType<typeof whoIsWhere>} seen
 * @returns {Record<string, string>}
 */
const whereOf = (seen) => Object.fromEntries(seen.people.map(p => [p.name, p.place]));

describe('los sitios de un pueblo', () => {
    test('son los mismos de la pantalla del pueblo (town.js)', () => {
        expect(PLACES).toBe(PLACE_KINDS);
        expect(placeLabel('posada')).toBe('La posada');
    });

    test('Puerto Alba: lo que escribe el paquete, más la plaza y el muelle', () => {
        expect(placesOf(puertoAlba, { hub: true })).toEqual(['herreria', 'posada', 'tienda', 'templo', 'gremio', 'plaza', 'muelle']);
    });

    test('un pueblo sin lista: sus servicios y la plaza; sin muelle si no es puerto; unas ruinas, nada', () => {
        expect(placesOf(barovia)).toEqual(['posada', 'tienda', 'templo', 'plaza']);
        expect(placesOf(vallaki)).toEqual(['posada', 'tienda', 'herreria', 'templo', 'tablon', 'plaza']);
        expect(placesOf({ name: 'Ruinas', type: 'ruins', services: [] })).toEqual([]);
        expect(placesOf({ name: 'Algún sitio', type: 'village' }, { hub: true })).toEqual(['gremio', 'posada', 'tienda', 'herreria', 'tablon', 'plaza', 'muelle']);
    });

    test('se llaman como los llama el paquete; en un campamento, la plaza es el fuego; la tienda y la herrería cierran de noche', () => {
        expect(placeLabel('templo', puertoAlba)).toBe('La capilla');
        expect(placeLabel('posada', puertoAlba)).toBe('La taberna');
        expect(placeLabel('muelle', puertoAlba)).toBe('El muelle');
        expect(placeLabel('plaza', { type: 'camp' })).toBe('El fuego del campamento');
        expect(placeOpen('tienda', 'night')).toBe(false);
        expect(placeOpen('herreria', 'morning')).toBe(true);
        expect(placeOpen('muelle', 'night')).toBe(true);
        expect(placeOpen('posada', 'night')).toBe(true);
    });
});

describe('dónde está cada uno', () => {
    test('Puerto Alba por la mañana: cada uno en lo suyo, y los mercenarios donde dice su ficha', () => {
        const seen = whoIsWhere({
            town: 'Puerto Alba', location: puertoAlba, slot: 'morning', hub: true, data, townsfolk,
            party: [HERO, merc(2, 'Gerd el Mellado'), merc(3, 'Nella Tresflechas')],
            hirelings: HIRELINGS.filter(h => h.name === 'Osric Mediapaga'),
        });
        expect(whereOf(seen)).toEqual({
            'Gerd el Mellado': 'muelle', 'Nella Tresflechas': 'plaza', Brunilda: 'gremio', 'Tomás': 'posada',
            Marisa: 'tienda', Ramiro: 'herreria', 'Madre Elvira': 'templo', 'Osric Mediapaga': 'muelle',
        });
        const osric = seen.people.find(p => p.name === 'Osric Mediapaga');
        expect(osric).toMatchObject({ kind: 'mercenario', inParty: false, canMeet: true });
        expect(seen.people.find(p => p.name === 'Tomás')).toMatchObject({ kind: 'pueblo', canMeet: false });
        expect(seen.places.find(p => p.id === 'muelle')?.people.map(p => p.name)).toEqual(['Gerd el Mellado', 'Osric Mediapaga']);
        expect(seen.places.find(p => p.id === 'tienda')).toMatchObject({ label: 'La tienda', open: true });
    });

    test('de noche la tienda y la herrería cierran: quien las lleva, a la posada', () => {
        const seen = whoIsWhere({ town: 'Puerto Alba', location: puertoAlba, slot: 'night', hub: true, data, townsfolk, party: [HERO, merc(2, 'Gerd el Mellado')] });
        expect(whereOf(seen)).toMatchObject({ Marisa: 'posada', Ramiro: 'posada', 'Tomás': 'posada', 'Madre Elvira': 'templo', Brunilda: 'templo', 'Gerd el Mellado': 'posada' });
        expect(seen.places.find(p => p.id === 'tienda')).toMatchObject({ open: false, people: [] });
        // Sin horario escrito, lo mismo que dice `hours.js`: el tendero, en la posada.
        expect(townsfolkPlace({ npc: { name: 'Pepe', service: 'tienda' }, places: ['posada', 'tienda', 'plaza'], slot: 'night' })).toBe('posada');
        expect(townsfolkPlace({ npc: { name: 'Pepe', service: 'tienda' }, places: ['tienda', 'plaza'], slot: 'night' })).toBe('');
        expect(townsfolkPlace({ npc: { name: 'Sin oficio' }, places: ['posada', 'plaza'], slot: 'morning' })).toBe('plaza');
    });

    test('quien va mal de vida está en el templo; quien no tiene horario, donde le lleva lo que busca', () => {
        expect(companionPlace({ member: merc(2, 'Gerd el Mellado', 3), person: personOf(data, 'Gerd el Mellado'), places: placesOf(puertoAlba, { hub: true }), slot: 'morning' })).toBe('templo');
        const places = placesOf(vallaki);
        expect(companionPlace({ member: { name: 'Fulano', hp: 10, maxHp: 10 }, places, slot: 'morning', wants: 'blood' })).toBe(SCHEDULE_BY_WANTS.blood.morning);
        expect(companionPlace({ member: { name: 'Fulano', hp: 10, maxHp: 10 }, places: ['posada', 'plaza'], slot: 'morning', wants: 'blood' })).toBe('plaza');
        expect(companionPlace({ member: { name: 'Fulano', hp: 10, maxHp: 10 }, places: ['posada', 'plaza'], slot: 'night' })).toBe('posada');
    });

    test('J14.6: los compañeros de la campaña que no van contigo, solo en su pueblo', () => {
        const confidants = strahd.confidants;
        const inBarovia = whoIsWhere({ town: 'Aldea de Barovia', location: barovia, slot: 'night', data, confidants });
        expect(whereOf(inBarovia)).toEqual({ 'Ismark Kolyanovich': 'posada', 'Ireena Kolyana': 'posada' });
        expect(inBarovia.people.every(p => p.kind === 'confidente' && p.canMeet && !p.inParty)).toBe(true);
        const inVallaki = whoIsWhere({ town: 'Ciudad de Vallaki', location: vallaki, slot: 'afternoon', data, confidants });
        expect(whereOf(inVallaki)).toEqual({ 'Rudolph van Richten': 'plaza' });
        // Quien ya va contigo está donde estés, no en su pueblo.
        const withIsmark = whoIsWhere({ town: 'Ciudad de Vallaki', location: vallaki, slot: 'night', data, confidants, party: [HERO, { id: 5, name: 'Ismark Kolyanovich', hp: 10, maxHp: 10 }] });
        expect(withIsmark.people.find(p => p.name === 'Ismark Kolyanovich')).toMatchObject({ kind: 'grupo', inParty: true, place: 'posada' });
    });

    test('su pueblo: el de su ficha, o el primero de los sitios que dice al llegar', () => {
        expect(homeOf(personOf(data, 'Madam Eva'))).toBe('Campamento del Estanque Tser');
        expect(homeOf(null, { arrivals: [{ place: 'Krezk', line: 'x' }] })).toBe('Krezk');
        expect(homeOf(null, null)).toBe('');
    });

    test('quién quiere quedar: solo tu gente, con el porqué', () => {
        const seen = whoIsWhere({
            town: 'Puerto Alba', location: puertoAlba, slot: 'afternoon', hub: true, data, townsfolk,
            party: [HERO, merc(2, 'Gerd el Mellado')],
            wants: (here) => ({ wants: true, why: `${here.name} quiere contarte algo.` }),
        });
        expect(seen.people.find(p => p.name === 'Gerd el Mellado')).toMatchObject({ wantsToMeet: true, why: 'Gerd el Mellado quiere contarte algo.' });
        expect(seen.people.find(p => p.name === 'Tomás')).toMatchObject({ wantsToMeet: false, why: '' });
    });

    test('con los sitios de la pantalla del pueblo tal cual', () => {
        const screen = townPlaces({ location: puertoAlba, npcs: townsfolk, guild: true }).places;
        const seen = whoIsWhere({ town: 'Puerto Alba', location: puertoAlba, places: screen, slot: 'morning', hub: true, data, townsfolk });
        expect(seen.places.map(p => p.id)).toEqual(['herreria', 'posada', 'tienda', 'templo', 'gremio', 'plaza', 'muelle']);
        expect(whereOf(seen).Ramiro).toBe('herreria');
    });
});

describe('dónde quedar, y las fichas', () => {
    test('los sitios abiertos, el suyo primero y los que le gustan marcados', () => {
        const places = placesOf(puertoAlba, { hub: true });
        const night = meetPlaces({ places, slot: 'night', current: 'posada', person: personOf(data, 'Gerd el Mellado') });
        expect(night.map(p => p.id)).toEqual(['posada', 'templo', 'gremio', 'plaza', 'muelle']);
        expect(night.filter(p => p.liked).map(p => p.id)).toEqual(['posada', 'muelle']);
        expect(meetPlaces({ places, slot: 'morning', current: 'nada' })[0].id).toBe('herreria');
    });

    test('quedar, si la franja está libre y hay con quién; charlar, con quien está en tu sitio', () => {
        const people = /** @type {any[]} */ ([
            { key: 'gerd-el-mellado', name: 'Gerd el Mellado', place: 'posada', canMeet: true, wantsToMeet: true },
            { key: 'tomas', name: 'Tomás', place: 'posada', canMeet: false, wantsToMeet: false },
            { key: 'marisa', name: 'Marisa', place: 'tienda', canMeet: false, wantsToMeet: false },
        ]);
        expect(socialChips({ people, free: true, at: 'posada' })).toEqual([
            { id: 'quedar', label: 'Quedar con alguien (Gerd quiere)', icon: 'fa-mug-hot', command: '/quedar' },
            { id: 'charlar:gerd-el-mellado', label: 'Charlar con Gerd', icon: 'fa-comments', command: '/charlar Gerd el Mellado' },
            { id: 'charlar:tomas', label: 'Charlar con Tomás', icon: 'fa-comments', command: '/charlar Tomás' },
        ]);
        expect(socialChips({ people, free: false, at: 'tienda' }).map(c => c.id)).toEqual(['charlar:marisa']);
        expect(socialChips({ people: people.slice(1), free: true, limit: 0 })).toEqual([]);
    });
});

describe('la pantalla de la quedada, sin dibujar', () => {
    const manifest = readManifest({
        files: [
            'retratos/mercenarios/gerd-el-mellado.png', 'retratos/mercenarios/gerd-el-mellado--alegre.png',
            'retratos/gremio/brunilda.png', 'retratos/gremio/brunilda--triste.png', 'retratos/heroes/guerrero-hombre.png',
            'sitios/taberna.png', 'sitios/taberna-noche.png', 'escenarios/strahd/aldea-de-barovia.png',
        ],
    });

    test('el retrato con la cara que toca; sin esa cara, el de siempre; sin retrato, el de su clase', () => {
        const base = 'img/game-engine/pixel/';
        expect(portraitFor({ name: 'Gerd el Mellado', mood: 'alegre' }, manifest)).toBe(`${base}retratos/mercenarios/gerd-el-mellado--alegre.png`);
        expect(portraitFor({ name: 'Gerd el Mellado', mood: 'triste' }, manifest)).toBe(`${base}retratos/mercenarios/gerd-el-mellado.png`);
        expect(portraitFor({ name: 'Brunilda', pack: 'gremio', mood: 'triste' }, manifest)).toBe(`${base}retratos/gremio/brunilda--triste.png`);
        expect(portraitFor({ name: 'Nadie', className: 'Guerrero', gender: 'Hombre' }, manifest)).toBe(`${base}retratos/heroes/guerrero-hombre.png`);
        expect(portraitFor({ name: 'Nadie' }, manifest)).toBe('');
    });

    test('con el arte de verdad, las caras de los mercenarios y del gremio salen', () => {
        const real = readManifest(read('img/game-engine/pixel/manifest.json'));
        expect(portraitFor({ name: 'Gerd el Mellado', mood: 'alegre' }, real)).toMatch(/gerd-el-mellado--alegre\.png$/);
        expect(portraitFor({ name: 'Tomás', pack: 'gremio', mood: 'enfadado' }, real)).toMatch(/tomas--enfadado\.png$/);
        expect(portraitFor({ name: 'Ismark Kolyanovich', pack: 'strahd' }, real)).toMatch(/ismark-kolyanovich(--\w+)?\.png$/);
    });

    test('detrás, el sitio (de noche, si lo hay) o el escenario de la localización', () => {
        expect(backdropFor({ place: 'posada', night: true }, manifest)).toBe('img/game-engine/pixel/sitios/taberna-noche.png');
        expect(backdropFor({ place: 'posada' }, manifest)).toBe('img/game-engine/pixel/sitios/taberna.png');
        expect(backdropFor({ town: 'Aldea de Barovia', pack: 'strahd' }, manifest)).toBe('img/game-engine/pixel/escenarios/strahd/aldea-de-barovia.png');
        expect(backdropFor({}, manifest)).toBe('');
    });

    test('las líneas y las fichas de cada paso', () => {
        const scene = /** @type {any} */ (readScene({ who: 'X', beats: [
            { note: 'Llega.', say: '¿Qué tal?', replies: [{ text: 'Bien.', bond: 1, then: 'Me alegro.' }, { text: 'Pago yo.', bond: 0, gold: -3 }] },
            { say: 'Adiós.' },
        ] }));
        let state = startScene();
        let view = sceneView(scene, state);
        expect(beatLines(view)).toEqual([{ kind: 'note', text: 'Llega.' }, { kind: 'say', text: '¿Qué tal?' }]);
        expect(beatChips(view)).toEqual([
            { kind: 'reply', index: 0, key: '1', label: 'Bien.' },
            { kind: 'reply', index: 1, key: '2', label: 'Pago yo. (3 de oro)' },
        ]);
        state = sceneStep(scene, state, { reply: 0 });
        view = sceneView(scene, state);
        expect(beatLines(view).slice(2)).toEqual([{ kind: 'you', text: 'Bien.' }, { kind: 'then', text: 'Me alegro.' }]);
        expect(beatChips(view)).toEqual([{ kind: 'next', label: 'Seguir', key: '↵' }]);
        view = sceneView(scene, sceneStep(scene, state, { next: true }));
        expect(beatChips(view)).toEqual([{ kind: 'finish', label: 'Terminar', key: '↵' }]);
    });

    test('en el selector, primero quien quiere quedar contigo', () => {
        const cards = pickerCards([
            { name: 'Osric Mediapaga' }, { name: 'Gerd el Mellado', wantsToMeet: true, placeLabel: 'El muelle' }, { name: '' }, { name: 'Nella Tresflechas' },
        ]);
        expect(cards.map(c => c.name)).toEqual(['Gerd el Mellado', 'Nella Tresflechas', 'Osric Mediapaga']);
        expect(cards[0]).toMatchObject({ badge: 'Quiere quedar contigo', where: 'El muelle' });
    });
});
