import { describe, test, expect } from '@jest/globals';
import fs from 'node:fs';
import {
    DEFAULT_DAYS, MIN_DAYS, MAX_DAYS, routesOf, buildRouteMap,
    planTravel, travelEvents, describeTravel, rollWeather,
} from '../public/scripts/game-engine/world/travel.js';
import { validateBattery } from '../public/scripts/game-engine/compendio/compendio.js';

const mundo = JSON.parse(fs.readFileSync(
    new URL('../public/compendio/mundo.json', import.meta.url), 'utf8',
));
const of = (kind) => mundo.rows.filter(r => r.kind === kind);

/** Un mundo de cuatro sitios: una lista, no un tablero. */
const world = () => [
    { name: 'El Vado', routes: [{ to: 'El Molino', days: 2 }, { to: 'La Ermita', days: 5 }] },
    { name: 'El Molino', routes: [{ to: 'La Ermita', days: 2 }] },
    { name: 'La Ermita', routes: [] },
    { name: 'La Cripta', routes: [{ to: 'La Ermita', days: 1, closed: true }] },
];

/** Un azar repetible. */
const rolling = (seed) => {
    let state = seed;
    return () => ((state = (state * 9301 + 49297) % 233280) / 233280);
};

describe('las rutas de un sitio', () => {
    test('salen normalizadas, con sus días', () => {
        expect(routesOf({ routes: [{ to: 'El Molino', days: 3 }] }))
            .toEqual([{ to: 'El Molino', days: 3, note: '', closed: false, oneWay: false }]);
    });

    test('una sin destino no es una ruta', () => {
        expect(routesOf({ routes: [{ days: 3 }, { to: '  ' }] })).toEqual([]);
    });

    test('un sitio sin rutas no tiene ninguna, y no revienta', () => {
        expect(routesOf({})).toEqual([]);
        expect(routesOf(null)).toEqual([]);
    });

    // Ni un viaje instantáneo ni uno eterno.
    test('los días tienen tope por arriba y por abajo', () => {
        expect(routesOf({ routes: [{ to: 'x', days: 0 }] })[0].days).toBe(MIN_DAYS);
        expect(routesOf({ routes: [{ to: 'x', days: 9999 }] })[0].days).toBe(MAX_DAYS);
        expect(routesOf({ routes: [{ to: 'x' }] })[0].days).toBe(DEFAULT_DAYS);
    });

    // El campo existía en el archivo y no hacía nada, que es peor que no existir.
    test('y el sentido único se lee', () => {
        expect(routesOf({ routes: [{ to: 'x', oneWay: true }] })[0].oneWay).toBe(true);
    });
});

describe('el grafo del mundo', () => {
    // Obligar a escribir la vuelta es la mejor forma de que alguien escriba solo la ida.
    test('una ruta vale para ir y para volver', () => {
        const graph = buildRouteMap(world());
        expect(graph.get('El Molino').map(e => e.to)).toContain('El Vado');
    });

    test('salvo que diga lo contrario', () => {
        const graph = buildRouteMap([
            { name: 'Alto', routes: [{ to: 'Bajo', days: 1, oneWay: true }] },
            { name: 'Bajo', routes: [] },
        ]);
        expect(graph.get('Alto').map(e => e.to)).toEqual(['Bajo']);
        expect(graph.get('Bajo') ?? []).toEqual([]);
    });

    test('una cerrada no está en el grafo, aunque esté escrita', () => {
        const graph = buildRouteMap(world());
        expect((graph.get('La Cripta') ?? []).length).toBe(0);
    });

    test('y si hay dos al mismo sitio, manda la corta', () => {
        const graph = buildRouteMap([
            { name: 'A', routes: [{ to: 'B', days: 6 }, { to: 'B', days: 2 }] },
            { name: 'B', routes: [] },
        ]);
        expect(graph.get('A')).toEqual([{ to: 'B', days: 2, note: '' }]);
    });
});

describe('planear un viaje', () => {
    test('lo directo cuesta lo que dice la ruta', () => {
        const plan = planTravel({ from: 'El Vado', to: 'El Molino', locations: world() });
        expect(plan.ok).toBe(true);
        expect(plan.days).toBe(2);
        expect(plan.legs).toEqual(['El Molino']);
    });

    // La mitad de lo que hace interesante un viaje es por dónde se pasa.
    test('y si el rodeo es más corto, se va por el rodeo y se dice', () => {
        const plan = planTravel({ from: 'El Vado', to: 'La Ermita', locations: world() });
        expect(plan.days).toBe(4);
        expect(plan.legs).toEqual(['El Molino', 'La Ermita']);
    });

    // Un botón apagado sin motivo parece roto.
    test('cuando no se puede llegar, se dice por qué', () => {
        const plan = planTravel({ from: 'El Vado', to: 'La Cripta', locations: world() });
        expect(plan.ok).toBe(false);
        expect(plan.reason).toMatch(/No hay camino abierto/);
    });

    test('a un sitio que no existe, también', () => {
        expect(planTravel({ from: 'El Vado', to: 'Atlántida', locations: world() }).reason)
            .toMatch(/no está en el mapa/);
    });

    test('y quedarse donde estás no es viajar', () => {
        expect(planTravel({ from: 'El Vado', to: 'El Vado', locations: world() }).reason)
            .toBe('Ya estás aquí.');
    });

    // Un mundo a medio escribir —o uno de antes de que esto existiera— sigue jugándose.
    test('un sitio sin rutas escritas va directo, y cuesta lo de siempre', () => {
        const plain = [{ name: 'A' }, { name: 'B' }];
        const plan = planTravel({ from: 'A', to: 'B', locations: plain });
        expect(plan.ok).toBe(true);
        expect(plan.days).toBe(DEFAULT_DAYS);
        expect(plan.legs).toEqual(['B']);
    });

    test('y empezar en ninguna parte tampoco te deja encerrado', () => {
        expect(planTravel({ from: '', to: 'La Ermita', locations: world() }).ok).toBe(true);
    });
});

describe('lo que pasa por el camino', () => {
    const table = [
        { id: 'tormenta', name: 'Una tormenta', note: 'Hay que parar.', days: 1 },
        { id: 'ermitano', name: 'Un ermitaño', note: 'Ofrece agua.' },
    ];

    test('sin tabla no pasa nada, y no revienta', () => {
        expect(travelEvents({ days: 5, random: () => 0 })).toEqual([]);
    });

    test('cada suceso dice en qué día fue', () => {
        const events = travelEvents({ days: 4, table, random: () => 0, chance: 1 });
        expect(events.map(e => e.day)).toEqual([1, 2]);
    });

    // Lo mismo dos veces en el mismo viaje se lee como un error, no como mala suerte.
    test('y no se repite ninguno, aunque sobren días', () => {
        const events = travelEvents({ days: 10, table, random: () => 0, chance: 1 });
        expect(events).toHaveLength(table.length);
        expect(new Set(events.map(e => e.id)).size).toBe(events.length);
    });

    test('con probabilidad cero, el viaje es aburrido', () => {
        expect(travelEvents({ days: 6, table, random: () => 0.99, chance: 0 })).toEqual([]);
    });

    // El reloj ya sabe lo que cuesta un día de más: no hace falta otra moneda.
    test('un retraso viene contado en días', () => {
        const [first] = travelEvents({ days: 1, table, random: () => 0, chance: 1 });
        expect(first.days).toBe(1);
        expect(first.name).toBe('Una tormenta');
    });

    test('y uno sin retraso no inventa ninguno', () => {
        const events = travelEvents({ days: 1, table, random: () => 0.9, chance: 1 });
        expect(events[0].days).toBe(0);
    });

    test('la misma semilla da el mismo viaje', () => {
        const once = travelEvents({ days: 8, table, random: rolling(7) });
        const twice = travelEvents({ days: 8, table, random: rolling(7) });
        expect(once).toEqual(twice);
    });

    test('un viaje de cero días no tiene camino', () => {
        expect(travelEvents({ days: 0, table, random: () => 0, chance: 1 })).toEqual([]);
    });
});

describe('contado para el botón', () => {
    test('dice los días y por dónde se pasa', () => {
        expect(describeTravel({ ok: true, days: 4, legs: ['El Molino', 'La Ermita'], reason: '' }))
            .toBe('4 días, pasando por El Molino');
    });

    test('un salto directo solo dice los días', () => {
        expect(describeTravel({ ok: true, days: 1, legs: ['B'], reason: '' })).toBe('1 día');
    });

    test('y si no se puede, dice el motivo y no los días', () => {
        expect(describeTravel({ ok: false, days: 0, legs: [], reason: 'El paso está cerrado.' }))
            .toBe('El paso está cerrado.');
    });
});

describe('la batería del mundo', () => {
    test('mundo.json pasa su propia validación', () => {
        expect(validateBattery('mundo', mundo)).toEqual([]);
    });

    test('trae biomas, climas y sucesos', () => {
        expect(new Set(mundo.rows.map(r => r.kind)))
            .toEqual(new Set(['bioma', 'clima', 'suceso']));
    });

    // Un bioma que admite un clima que no existe deja el tiempo colgado.
    test('los climas que un bioma admite existen', () => {
        const known = new Set(of('clima').map(c => c.climate));
        for (const biome of of('bioma')) {
            for (const climate of biome.climates) expect(known).toContain(climate);
        }
    });

    // Una transición a un clima que no existe es un callejón sin salida.
    test('y las transiciones de un clima llevan a climas que existen', () => {
        const known = new Set(of('clima').map(c => c.climate));
        for (const climate of of('clima')) {
            for (const to of Object.keys(climate.transitions)) expect(known).toContain(to);
        }
    });

    test('todo clima puede salir de sí mismo a alguna parte', () => {
        for (const climate of of('clima')) {
            expect(Object.keys(climate.transitions).length).toBeGreaterThan(1);
        }
    });

    // Un suceso que pide algo que ningún bioma ni clima tiene no sale nunca.
    test('lo que un suceso pide existe en el mundo', () => {
        const biomes = new Set(of('bioma').map(b => b.biome));
        const climates = new Set(of('clima').map(c => c.climate));
        for (const event of of('suceso')) {
            for (const biome of event.when?.biome ?? []) expect(biomes).toContain(biome);
            for (const climate of event.when?.climate ?? []) expect(climates).toContain(climate);
        }
    });

    test('y hay sucesos que valen en cualquier sitio, para que el camino nunca esté vacío', () => {
        expect(of('suceso').filter(e => !e.when).length).toBeGreaterThanOrEqual(3);
    });
});

describe('el tiempo del viaje', () => {
    const climates = of('clima');

    test('sin tabla no hay tiempo, y no revienta', () => {
        expect(rollWeather({ days: 5, random: () => 0 })).toEqual([]);
    });

    test('sale un día por cada día de camino', () => {
        expect(rollWeather({ days: 6, table: climates, random: rolling(7) })).toHaveLength(6);
    });

    // En una cueva no nieva.
    test('el bioma manda sobre lo que puede hacer', () => {
        const weather = rollWeather({
            days: 10, table: climates, climates: ['despejado'], random: rolling(3),
        });
        expect(new Set(weather)).toEqual(new Set(['despejado']));
    });

    // Una tirada suelta por día da sol-tormenta-sol, que no lo cree nadie.
    test('hay rachas: el tiempo de mañana depende del de hoy', () => {
        const weather = rollWeather({ days: 60, table: climates, random: rolling(11) });
        let repeats = 0;
        for (let i = 1; i < weather.length; i++) if (weather[i] === weather[i - 1]) repeats++;
        expect(repeats).toBeGreaterThan(10);
    });

    test('y la misma semilla da el mismo tiempo', () => {
        expect(rollWeather({ days: 8, table: climates, random: rolling(5) }))
            .toEqual(rollWeather({ days: 8, table: climates, random: rolling(5) }));
    });
});

describe('sucesos que piden sitio y tiempo', () => {
    const events = of('suceso');

    // Una tormenta no cae con el cielo despejado, y eso lo dice la fila.
    test('solo sale lo que pega con el tiempo que hace', () => {
        const random = rolling(13);
        for (let i = 0; i < 60; i++) {
            const out = travelEvents({
                days: 3, table: events, random, chance: 1,
                biome: 'camino', weather: ['despejado', 'despejado', 'despejado'],
            });
            for (const event of out) {
                const row = events.find(e => e.id === event.id);
                if (row.when?.climate) expect(row.when.climate).toContain('despejado');
            }
        }
    });

    test('ni con el bioma equivocado', () => {
        const random = rolling(17);
        const out = travelEvents({
            days: 20, table: events, random, chance: 1,
            biome: 'camino', weather: new Array(20).fill('despejado'),
        });
        for (const event of out) {
            const row = events.find(e => e.id === event.id);
            if (row.when?.biome) expect(row.when.biome).toContain('camino');
        }
    });

    // Un atajo que no pudiera restar días sería un atajo que no existe.
    test('un atajo resta días, no los redondea a cero', () => {
        const shortcut = [{ id: 'atajo', name: 'Un atajo', days: -1, note: 'Se gana un día.' }];
        const [event] = travelEvents({ days: 1, table: shortcut, random: () => 0, chance: 1 });
        expect(event.days).toBe(-1);
    });

    test('y cada suceso dice con qué tiempo pasó', () => {
        const out = travelEvents({
            days: 2, table: events, random: rolling(19), chance: 1,
            biome: 'camino', weather: ['lluvia', 'lluvia'],
        });
        for (const event of out) expect(event.climate).toBe('lluvia');
    });
});

describe('lo que te abren por caerles bien', () => {
    const cerrado = () => ([
        {
            name: 'El Molino',
            routes: [
                { to: 'La Ermita', days: 2, closed: true, note: 'Cerrado por Los del Vado.' },
                { to: 'La Cripta', days: 9 },
            ],
        },
        { name: 'La Ermita', routes: [] },
        { name: 'La Cripta', routes: [{ to: 'La Ermita', days: 2 }] },
    ]);

    // Es donde de verdad se nota haberse ganado a alguien.
    test('un paso que cerró quien te debe una se abre para ti', () => {
        const sinAmigos = planTravel({ from: 'El Molino', to: 'La Ermita', locations: cerrado() });
        const conAmigos = planTravel({
            from: 'El Molino', to: 'La Ermita', locations: cerrado(), friendly: ['Los del Vado'],
        });
        expect(sinAmigos.days).toBe(11);
        expect(conAmigos.days).toBe(2);
    });

    test('pero solo el que cerró esa facción', () => {
        const otros = planTravel({
            from: 'El Molino', to: 'La Ermita', locations: cerrado(), friendly: ['Los de la Sal'],
        });
        expect(otros.days).toBe(11);
    });

    test('y sin amigos, todo sigue como estaba', () => {
        expect(routesOf(cerrado()[0])[0].closed).toBe(true);
        expect(routesOf(cerrado()[0], [])[0].closed).toBe(true);
    });
});
