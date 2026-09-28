import { describe, test, expect } from '@jest/globals';
import { readBox, pickName, boxExamples, explainMiss, topicOf } from '../public/scripts/game-engine/campaign/read-box.js';

/** El Pueblo de Barro, en 1387: lo que hay aquí y a dónde se va. */
const here = {
    places: ['Castillo de Vane', 'El Camino Viejo', 'La Granja Quemada'],
    boards: ['El cuarto de la posada', 'El callejón inundado', 'Lobos en el pueblo'],
    people: ['Giles', 'Alguacil Torres', 'Dunstan'],
    companions: ['Bran'],
    services: ['posada', 'herreria', 'tienda', 'tablon'],
    wares: ['Cuerda de cáñamo', 'Antorcha', 'Mula'],
    goods: ['Espada corta', 'Daga oxidada'],
};

describe('la caja que entiende (Z3 de ROADMAP_SIN_TOKENS)', () => {
    test('ir: a un sitio, a un tablero de aquí o a un edificio', () => {
        expect(readBox('voy a la posada', here)).toEqual({ do: 'service', name: 'posada' });
        expect(readBox('Vamos al castillo', here)).toEqual({ do: 'go', name: 'Castillo de Vane' });
        expect(readBox('viajamos a vane', here)).toEqual({ do: 'go', name: 'Castillo de Vane' });
        expect(readBox('entro en el callejón', here)).toEqual({ do: 'enter', name: 'El callejón inundado' });
        expect(readBox('Me voy a la taberna.', here)).toEqual({ do: 'service', name: 'posada' });
    });

    test('lo que no hay aquí, se dice', () => {
        const temple = readBox('voy al templo', here);
        expect(temple.do).toBe('unknown');
        expect(explainMiss(temple, here)).toBe('Aquí no hay templo.');
        const nowhere = readBox('voy a Pekín', here);
        expect(explainMiss(nowhere, here)).toMatch(/No conozco ningún sitio que se llame «pekín»\. Se puede ir a: Castillo de Vane/);
    });

    test('hablar y preguntar, con los nombres de aquí', () => {
        expect(readBox('hablo con Giles', here)).toEqual({ do: 'talk', name: 'Giles' });
        expect(readBox('le pregunto al alguacil por los rumores', here)).toEqual({ do: 'talk', name: 'Alguacil Torres', topic: 'rumor' });
        expect(readBox('voy a hablar con torres', here)).toEqual({ do: 'talk', name: 'Alguacil Torres' });
        expect(readBox('busco a Dunstan', here)).toEqual({ do: 'talk', name: 'Dunstan' });
        expect(readBox('amenazo a Giles', here)).toEqual({ do: 'threaten', name: 'Giles' });
        expect(readBox('intento convencer a Torres', here)).toEqual({ do: 'duel', name: 'Alguacil Torres' });
        expect(readBox('invito a Bran a una ronda', here)).toEqual({ do: 'round', name: 'Bran', companion: true });
        expect(explainMiss(readBox('hablo con Marta', here), here)).toMatch(/Aquí no hay nadie que se llame «marta»/);
    });

    test('intentar algo es una tirada, con la habilidad de lo que se busca', () => {
        expect(readBox('busco huellas en el barro', here)).toEqual({ do: 'check', skill: 'survival', what: 'buscar huellas en el barro' });
        expect(readBox('examino el cadáver', here)).toEqual({ do: 'check', skill: 'investigation', what: 'examinar el cadáver' });
        expect(readBox('escucho detrás de la puerta', here)).toMatchObject({ do: 'check', skill: 'perception' });
        expect(readBox('trepo el muro', here)).toMatchObject({ do: 'check', skill: 'athletics' });
        // Mirar una pared no es trepar por ella.
        expect(readBox('examino las paredes del patio', here)).toMatchObject({ do: 'check', skill: 'investigation' });
        expect(readBox('intento abrir la cerradura', here)).toMatchObject({ do: 'check', skill: 'sleight' });
        expect(readBox('me escondo', here)).toMatchObject({ do: 'check', skill: 'stealth' });
        expect(readBox('observo a Torres', here)).toMatchObject({ do: 'check', skill: 'insight', name: 'Alguacil Torres' });
    });

    test('descansar, esperar, acampar, el campo', () => {
        expect(readBox('descansamos un rato', here)).toEqual({ do: 'rest', long: false });
        expect(readBox('dormimos', here)).toEqual({ do: 'rest', long: true });
        expect(readBox('espero a la noche', here)).toEqual({ do: 'wait', until: 'night' });
        expect(readBox('esperamos hasta mañana', here)).toEqual({ do: 'wait', until: 'morning' });
        expect(readBox('acampamos aquí', here)).toEqual({ do: 'camp' });
        expect(readBox('busco comida', here)).toEqual({ do: 'forage' });
        expect(readBox('exploramos los alrededores', here)).toEqual({ do: 'explore' });
        expect(readBox('escucho rumores', here)).toEqual({ do: 'rumor' });
    });

    test('comprar y vender, si hay tienda', () => {
        expect(readBox('compro una antorcha', here)).toEqual({ do: 'buy', name: 'Antorcha' });
        expect(readBox('vendo la daga', here)).toEqual({ do: 'sell', name: 'Daga oxidada' });
        expect(readBox('vendo la chatarra', here)).toEqual({ do: 'sell', name: '*' });
        expect(explainMiss(readBox('compro pan', { ...here, services: [] }), here)).toBe('Aquí no hay tienda.');
    });

    test('en combate: atacar, moverse y pasar turno; lo demás, a la barra', () => {
        const fight = { fighting: true, foes: ['Bandido', 'Lobo gris'] };
        expect(readBox('ataco al lobo', fight)).toEqual({ do: 'attack', name: 'Lobo gris' });
        expect(readBox('me muevo a 5 4', fight)).toEqual({ do: 'move', x: 5, y: 4 });
        expect(readBox('paso turno', fight)).toEqual({ do: 'end-turn' });
        expect(explainMiss(readBox('bailo una jota', fight), fight)).toMatch(/En combate, la caja entiende/);
        expect(explainMiss(readBox('ataco a Giles', here), here)).toMatch(/Aquí no hay pelea\. Para pelear, entra en un tablero/);
    });

    test('lo que no entiende no es nada, y se enseña qué sí', () => {
        expect(readBox('me pongo a cantar una balada triste', here).do).toBe('unknown');
        expect(readBox('ayuda', here)).toEqual({ do: 'help' });
        expect(readBox('¿Qué hago?', here)).toEqual({ do: 'help' });
        expect(boxExamples(here)).toEqual(['hablo con Giles', 'entro en El cuarto de la posada', 'voy a Castillo de Vane', 'voy a la posada', 'busco huellas']);
    });

    test('un nombre se reconoce entero, por el principio o por una palabra que lo distinga', () => {
        expect(pickName('castillo', here.places)).toBe('Castillo de Vane');
        expect(pickName('la granja', here.places)).toBe('La Granja Quemada');
        expect(pickName('giles el tabernero', here.people)).toBe('Giles');
        expect(pickName('el molino', here.places)).toBe('');
    });

    test('de qué se pregunta', () => {
        expect(['por lo que sabe', 'por el muerto', 'por lo que necesita', 'qué piensa de nosotros', 'por el camino'].map(topicOf))
            .toEqual(['sabe', 'caso', 'quiere', 'vosotros', 'hilo']);
    });
});
