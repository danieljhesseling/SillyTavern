import { describe, test, expect } from '@jest/globals';
import {
    DEFAULT_DAYS, MIN_DAYS, MAX_DAYS, routesOf, buildRouteMap,
    planTravel, travelEvents, describeTravel,
} from '../public/scripts/game-engine/world/travel.js';

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
        expect(events).toHaveLength(4);
        expect(events.map(e => e.day)).toEqual([1, 2, 3, 4]);
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
