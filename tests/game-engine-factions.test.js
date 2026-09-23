import { describe, test, expect } from '@jest/globals';
import {
    GOALS, readFaction, readFactions, clockOf, heldBack, tickFactions,
    outcomeOf, applyOutcome, newsFor, describeFaction, rollFactions, validateFactionRows,
    pushClock, pushFaction, busyFactions,
} from '../public/scripts/game-engine/campaign/factions.js';
import { createCompendium, validateBattery } from '../public/scripts/game-engine/compendio/compendio.js';
import { createSeededRandom } from '../public/scripts/game-engine/combat/seeded-random.js';
import fs from 'node:fs';

const faction = (extra = {}) => ({
    id: 'molino', name: 'Los del Molino', seat: 'El Molino',
    goal: { kind: 'conquistar', target: 'La Ermita', pace: 7, of: 3 },
    ...extra,
});

const world = () => ([
    { name: 'Cripta olvidada', routes: [{ to: 'El Molino', days: 2 }] },
    { name: 'El Molino', routes: [{ to: 'La Ermita', days: 2 }] },
    { name: 'La Ermita', routes: [{ to: 'Cripta olvidada', days: 3 }] },
]);

describe('leer una facción venga como venga', () => {
    test('una a medias se queda quieta en vez de romper', () => {
        const read = readFaction({ id: 'x' });
        expect(read.goal.kind).toBe('');
        expect(clockOf(read).moving).toBe(false);
    });

    test('una meta que no existe no es una meta', () => {
        expect(readFaction(faction({ goal: { kind: 'invadir' } })).goal.kind).toBe('');
        expect(GOALS).toContain('conquistar');
    });

    test('el reloj nunca pasa de su último segmento', () => {
        expect(readFaction(faction({ goal: { kind: 'conquistar', of: 3, at: 9 } })).goal.at).toBe(3);
    });

    test('y sin identificador no es nadie', () => {
        expect(readFactions([{ name: 'Sin id' }, faction()])).toHaveLength(1);
    });
});

describe('el reloj', () => {
    // Lo que separa esto de Bannerlord: se puede planear contra ello.
    test('avanza un segmento cada tantos días, sin azar', () => {
        const uno = tickFactions({ factions: [faction()], days: 7 });
        const otro = tickFactions({ factions: [faction()], days: 7 });
        expect(uno.factions[0].goal.at).toBe(1);
        expect(otro.factions[0].goal.at).toBe(uno.factions[0].goal.at);
    });

    test('los días sueltos se guardan, no se pierden', () => {
        let state = [faction()];
        for (let day = 0; day < 7; day++) state = tickFactions({ factions: state }).factions;
        expect(state[0].goal.at).toBe(1);
    });

    test('y se puede decir cuántos días faltan', () => {
        const [after] = tickFactions({ factions: [faction()], days: 10 }).factions;
        expect(clockOf(after).at).toBe(1);
        expect(clockOf(after).days).toBe(11);
    });

    // Estar delante es la primera forma de frenar a alguien, y no cuesta interfaz.
    test('no avanza el día que el grupo está en el sitio que quieren', () => {
        const { factions, events } = tickFactions({ factions: [faction()], days: 30, here: 'La Ermita' });
        expect(factions[0].goal.at).toBe(0);
        expect(events[0].kind).toBe('quieto');
        expect(heldBack(faction(), 'La Ermita')).toMatch(/mientras esté no avanzan/);
    });

    test('pero estar en otro sitio no frena nada', () => {
        expect(heldBack(faction(), 'El Molino')).toBe('');
    });

    test('tira lo que le echen sin pasarse del final', () => {
        const { factions, events } = tickFactions({ factions: [faction()], days: 500 });
        expect(factions[0].goal.at).toBe(3);
        expect(events.filter(e => e.kind === 'cumple')).toHaveLength(1);
    });

    test('y lo ya cumplido no vuelve a cumplirse', () => {
        const done = tickFactions({ factions: [faction()], days: 500 }).factions;
        expect(tickFactions({ factions: done, days: 500 }).events).toEqual([]);
    });

    test('no toca lo que recibe', () => {
        const before = faction();
        tickFactions({ factions: [before], days: 100 });
        expect(before.goal.at).toBeUndefined();
    });
});

describe('lo que pasa cuando se llena', () => {
    test('las cinco metas aterrizan en algo', () => {
        for (const kind of GOALS) {
            expect(outcomeOf(faction({ goal: { kind, target: 'La Ermita' } })).kind).not.toBe('');
        }
    });

    test('conquistar cambia de dueño el sitio', () => {
        const { locations, factions, changed } = applyOutcome({
            locations: world(), factions: [faction()], outcome: outcomeOf(faction()),
        });
        expect(locations.find(l => l.name === 'La Ermita').holder).toBe('molino');
        expect(factions[0].holds).toContain('La Ermita');
        expect(changed.join(' ')).toMatch(/pasa a manos de/);
    });

    // Dos dueños del mismo sitio es un mundo roto.
    test('y el que lo tenía deja de tenerlo', () => {
        const otra = { id: 'ermita', name: 'Los de la Ermita', seat: 'La Ermita', holds: ['La Ermita'] };
        const places = world();
        places[2].holder = 'ermita';
        const { factions } = applyOutcome({
            locations: places, factions: [faction(), otra], outcome: outcomeOf(faction()),
        });
        expect(factions.find(f => f.id === 'ermita').holds).not.toContain('La Ermita');
    });

    // El viaje ya obedece `closed`: por eso la meta aterriza ahí y no en una barra.
    test('cierra el camino a casa de sus enemigos', () => {
        const otra = { id: 'cripta', name: 'Los de la Cripta', seat: 'Cripta olvidada' };
        const { locations } = applyOutcome({
            locations: world(),
            factions: [faction({ enemies: ['cripta'] }), otra],
            outcome: outcomeOf(faction({ enemies: ['cripta'] })),
        });
        const ermita = locations.find(l => l.name === 'La Ermita');
        expect(ermita.routes.find(r => r.to === 'Cripta olvidada').closed).toBe(true);
    });

    test('destruir borra la facción y reabre lo que cerró', () => {
        const cerrada = world();
        cerrada[1].routes[0].closed = true;
        cerrada[1].routes[0].note = 'Cerrado por Los de la Ermita.';
        const suya = faction({ goal: { kind: 'destruir', target: 'ermita' } });
        const otra = { id: 'ermita', name: 'Los de la Ermita', seat: 'La Ermita' };

        const { locations, factions, changed } = applyOutcome({
            locations: cerrada, factions: [suya, otra], outcome: outcomeOf(suya),
        });
        expect(factions.map(f => f.id)).toEqual(['molino']);
        expect(locations[1].routes[0].closed).toBe(false);
        expect(changed.join(' ')).toMatch(/vuelve a estar abierto/);
    });

    test('encontrar abre un camino que no estaba', () => {
        const suya = faction({ goal: { kind: 'encontrar', target: 'Cripta olvidada' } });
        const { locations, changed } = applyOutcome({
            locations: world(), factions: [suya], outcome: outcomeOf(suya),
        });
        expect(locations.find(l => l.name === 'El Molino').routes.map(r => r.to))
            .toContain('Cripta olvidada');
        expect(changed.join(' ')).toMatch(/Se abre un camino/);
    });

    test('y no lo abre dos veces', () => {
        const suya = faction({ goal: { kind: 'encontrar', target: 'La Ermita' } });
        const { locations } = applyOutcome({
            locations: world(), factions: [suya], outcome: outcomeOf(suya),
        });
        expect(locations.find(l => l.name === 'El Molino').routes).toHaveLength(1);
    });

    // Un peaje no cierra el camino: lo hace caro, y un día más es un día de comida.
    test('controlar sube el precio del camino en días', () => {
        const suya = faction({ goal: { kind: 'controlar', target: 'La Ermita' } });
        const { locations, changed } = applyOutcome({
            locations: world(), factions: [suya], outcome: outcomeOf(suya),
        });
        expect(locations.find(l => l.name === 'El Molino').routes[0].days).toBe(3);
        expect(changed.join(' ')).toMatch(/peaje/i);
    });

    test('una meta cumplida no se cumple otra vez', () => {
        const { factions } = applyOutcome({
            locations: world(), factions: [faction()], outcome: outcomeOf(faction()),
        });
        expect(clockOf(factions[0]).moving).toBe(false);
    });

    test('y no toca la lista que recibe', () => {
        const places = world();
        applyOutcome({ locations: places, factions: [faction()], outcome: outcomeOf(faction()) });
        expect(places[2].holder).toBeUndefined();
    });
});

describe('lo que llega al grupo', () => {
    const lejos = { id: 'lejos', name: 'Los de allá', seat: 'Sitio lejano' };
    const events = [
        { faction: 'molino', name: 'Los del Molino', kind: 'avanza', target: 'La Ermita', note: 'aquí al lado' },
        { faction: 'lejos', name: 'Los de allá', kind: 'avanza', target: 'Sitio lejano', note: 'muy lejos' },
    ];

    // La línea que separa esto de un menú de noticias.
    test('lo de un camino de aquí se oye; lo de la otra punta, no', () => {
        const dicho = newsFor({
            events, here: 'El Molino', locations: world(), factions: [faction(), lejos],
        });
        expect(dicho).toEqual(['aquí al lado']);
    });

    // Con el paso cerrado no llega ni lo de al lado: por eso cerrar un camino es un hecho
    // del mundo y no un numero.
    test('un camino cerrado deja de traer noticias', () => {
        const suyos = { id: 'ermita', name: 'Los de la Ermita', seat: 'La Ermita' };
        const deAlli = [{ faction: 'ermita', kind: 'avanza', target: 'La Ermita', note: 'se mueven' }];
        const abierto = { events: deAlli, here: 'El Molino', locations: world(), factions: [suyos] };
        expect(newsFor(abierto)).toEqual(['se mueven']);

        const cerrado = world();
        cerrado[1].routes[0].closed = true;
        expect(newsFor({ ...abierto, locations: cerrado })).toEqual([]);
    });

    test('lo que se queda quieto no es noticia', () => {
        const quieto = [{ faction: 'molino', kind: 'quieto', target: 'La Ermita', note: 'no avanzan' }];
        expect(newsFor({ events: quieto, here: 'La Ermita', locations: world(), factions: [faction()] }))
            .toEqual([]);
    });

    test('y sin saber dónde estás no se inventa nada', () => {
        expect(newsFor({ events, locations: world(), factions: [faction()] })).toEqual([]);
    });
});

describe('contada en una línea', () => {
    test('dice qué quiere y por dónde va', () => {
        const line = describeFaction(faction());
        expect(line).toMatch(/Los del Molino \(El Molino\)/);
        expect(line).toMatch(/quiere La Ermita/);
        expect(line).toMatch(/0 de 3/);
    });

    test('y sin meta lo dice también', () => {
        expect(describeFaction({ id: 'x', name: 'Nadie' })).toMatch(/sin nada entre manos/);
    });

    test('ninguna línea sale con un hueco sin rellenar', () => {
        for (const kind of GOALS) {
            expect(describeFaction(faction({ goal: { kind, target: 'La Ermita', of: 3 } })))
                .not.toMatch(/undefined|NaN/);
        }
    });
});

const facciones = JSON.parse(fs.readFileSync(
    new URL('../public/compendio/facciones.json', import.meta.url), 'utf8',
));

const real = () => createCompendium({ facciones: facciones.rows });
const roll = (seed = 'semilla', count = 4) => rollFactions({
    compendium: real(), locations: world(), random: createSeededRandom(seed), count,
});

describe('repartir facciones por un mundo nuevo', () => {
    test('sin batería no hay facciones, y la campaña sale igual', () => {
        expect(rollFactions({
            compendium: createCompendium({}), locations: world(), random: createSeededRandom('x'),
        })).toEqual([]);
    });

    test('un mundo de un solo sitio no da para querer nada', () => {
        expect(roll('x', 4).length).toBeGreaterThan(0);
        expect(rollFactions({
            compendium: real(), locations: [{ name: 'Solo' }], random: createSeededRandom('x'),
        })).toEqual([]);
    });

    // Pocas y con nombre: cuatro se siguen, treinta son ruido.
    test('nunca más facciones que sitios', () => {
        expect(roll('x', 99)).toHaveLength(3);
    });

    test('cada una se sienta en un sitio distinto', () => {
        const seats = roll().map(f => f.seat);
        expect(new Set(seats).size).toBe(seats.length);
    });

    // Querer lo que ya tienes no mueve a nadie.
    test('y ninguna quiere el sitio en el que vive', () => {
        const sobreSuCasa = roll()
            .filter(f => f.goal.kind !== 'destruir')
            .filter(f => f.goal.target === f.seat);
        expect(sobreSuCasa).toEqual([]);
    });

    test('la que quiere destruir tiene enfrente a alguien, no a un sitio', () => {
        const rolled = roll();
        const ids = rolled.map(f => f.id);
        for (const faction of rolled.filter(f => f.goal.kind === 'destruir')) {
            expect(ids).toContain(faction.goal.target);
        }
    });

    test('todas tienen enemigo: una facción sola no tiene contra quién', () => {
        for (const faction of roll()) expect(faction.enemies.length).toBeGreaterThan(0);
    });

    test('la meta que persiguen es una de las que su molde dice', () => {
        for (const faction of roll()) expect(GOALS).toContain(faction.goal.kind);
    });

    test('el nombre sale del sitio, y sin huecos sin rellenar', () => {
        for (const faction of roll()) {
            expect(faction.name).not.toMatch(/[{}]|undefined/);
            expect(describeFaction(faction)).not.toMatch(/undefined|NaN/);
        }
    });

    // La semilla no es el texto: la misma semilla, el mismo mundo.
    test('la misma semilla da las mismas facciones, y otra da otras', () => {
        expect(roll('una').map(f => f.name)).toEqual(roll('una').map(f => f.name));
        expect(roll('una').map(f => f.name)).not.toEqual(roll('otra').map(f => f.name));
    });

    // La prueba de que esto es un mundo y no una lista: déjalo correr y algo cambia.
    test('déjalas correr un año y el mundo es otro', () => {
        let people = roll();
        const { factions, events } = tickFactions({ factions: people, days: 365 });
        people = factions;
        expect(events.filter(e => e.kind === 'cumple').length).toBeGreaterThan(0);

        let places = world();
        for (const event of events.filter(e => e.kind === 'cumple')) {
            const who = people.find(f => f.id === event.faction);
            const applied = applyOutcome({ locations: places, factions: people, outcome: outcomeOf(who) });
            places = applied.locations;
            people = applied.factions;
        }
        const antes = JSON.stringify(world());
        expect(JSON.stringify(places)).not.toBe(antes);
    });
});

describe('la batería de facciones', () => {
    test('facciones.json pasa su propia validación', () => {
        expect(validateBattery('facciones', facciones)).toEqual([]);
    });

    // La que importa: un valor fuera de vocabulario pasa la de arriba y luego no hace nada.
    test('y ninguna fila usa una meta que el motor no conoce', () => {
        expect(validateFactionRows(real())).toEqual([]);
    });

    test('una meta inventada se caza, y se dice cuáles valen', () => {
        const [message] = validateFactionRows(createCompendium({
            facciones: [{ id: 'm', name: 'Mala', kind: 'meta', goal: 'invadir', note: 'x' }],
        }));
        expect(message).toMatch(/invadir/);
        expect(message).toContain(GOALS.join(', '));
    });

    test('una plantilla sin {sitio} se caza: si no, todas se llaman igual', () => {
        expect(validateFactionRows(createCompendium({
            facciones: [{
                id: 'f', name: 'Fija', kind: 'faccion',
                goals: ['conquistar'], patterns: ['Los de siempre'],
            }],
        })).join(' ')).toMatch(/no cambia nunca/);
    });

    test('y una meta sin motivo tampoco vale', () => {
        expect(validateFactionRows(createCompendium({
            facciones: [{ id: 'm', name: 'Muda', kind: 'meta', goal: 'conquistar' }],
        })).join(' ')).toMatch(/sin motivo/);
    });

    test('hay metas para las cinco finalidades', () => {
        for (const goal of GOALS) {
            expect(facciones.rows.filter(r => r.goal === goal).length).toBeGreaterThanOrEqual(3);
        }
    });

    test('sin batería no hay nada que validar', () => {
        expect(validateFactionRows(createCompendium({}))).toEqual([]);
    });
});

describe('empujar un reloj', () => {
    // Sin esto el mundo se mueve y tú miras: es la mitad que convierte las facciones en
    // algo con lo que se juega.
    test('en contra les quita trabajo hecho', () => {
        const antes = tickFactions({ factions: [faction()], days: 14 }).factions[0];
        expect(clockOf(antes).at).toBe(2);
        const { faction: despues, event } = pushClock(antes, -1);
        expect(clockOf(despues).at).toBe(1);
        expect(event.kind).toBe('atras');
        expect(event.note).toMatch(/pierde terreno/);
    });

    test('a favor se lo adelanta', () => {
        const { faction: despues, event } = pushClock(faction(), 1);
        expect(clockOf(despues).at).toBe(1);
        expect(event.note).toMatch(/gana terreno/);
    });

    // Un empujón vale un segmento entero: has deshecho su trabajo, no lo has pausado.
    test('y los días sueltos que llevaba se pierden', () => {
        const medio = tickFactions({ factions: [faction()], days: 10 }).factions[0];
        expect(medio.goal.days).toBe(3);
        expect(pushClock(medio, -1).faction.goal.days).toBe(0);
    });

    test('nunca por debajo de cero ni por encima del final', () => {
        expect(clockOf(pushClock(faction(), -9).faction).at).toBe(0);
        expect(pushClock(faction(), -9).event).toBeNull();
        expect(clockOf(pushClock(faction(), 99).faction).at).toBe(3);
    });

    // El sitio ya cambió de manos: eso no se deshace con un encargo.
    test('lo ya cumplido no se deshace', () => {
        const hecha = applyOutcome({
            locations: world(), factions: [faction()], outcome: outcomeOf(faction()),
        }).factions[0];
        expect(pushClock(hecha, -2).event).toBeNull();
    });

    test('empujar hasta el final cumple la meta, como cumplirla con el tiempo', () => {
        const { event } = pushClock(faction(), 3);
        expect(event.kind).toBe('cumple');
        expect(event.note).toMatch(/se queda con La Ermita/);
    });

    test('sobre la lista, solo se mueve la que se nombra', () => {
        const otra = { id: 'otra', name: 'Otra', seat: 'La Ermita', goal: { kind: 'controlar', target: 'El Molino', of: 4 } };
        const { factions, event } = pushFaction([faction(), otra], 'otra', 1);
        expect(clockOf(factions[0]).at).toBe(0);
        expect(clockOf(factions[1]).at).toBe(1);
        expect(event.faction).toBe('otra');
    });

    test('y un nombre que no está no mueve nada', () => {
        expect(pushFaction([faction()], 'nadie', 1).event).toBeNull();
    });

    test('las que tienen algo entre manos se pueden listar', () => {
        const quieta = { id: 'q', name: 'Quieta' };
        expect(busyFactions([faction(), quieta]).map(f => f.id)).toEqual(['molino']);
    });
});
