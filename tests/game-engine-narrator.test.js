import { describe, test, expect } from '@jest/globals';
import {
    buildNarratorCard, validateNarrator, describeNarrator, DEFAULT_NARRATOR_NAME,
    VERBOSITY, DEFAULT_VERBOSITY,
} from '../public/scripts/game-engine/campaign/narrator.js';

const world = { worldName: 'El Molino de los Cuervos', genre: 'Fantasía oscura', synopsis: 'Un molino con algo debajo.' };

describe('la ficha de quien narra', () => {
    const card = buildNarratorCard({
        name: 'El Cronista',
        personality: 'Seco, irónico, nunca adorna una muerte.',
        description: 'Estuvo en el asedio y no lo cuenta.',
        greeting: 'El molino sigue ahí. ¿Entráis?',
    }, world);

    test('lleva el nombre que le pusiste', () => {
        expect(card.ch_name).toBe('El Cronista');
    });

    // El fallo que esto evita: una ficha que solo dice "seco e irónico" produce alguien
    // seco e irónico, no alguien que dirija una partida.
    test('dice antes que nada qué oficio tiene, no solo cómo es', () => {
        expect(card.description).toMatch(/narra/i);
        expect(card.description.indexOf('narra')).toBeLessThan(card.description.indexOf('asedio'));
    });

    test('y que no interpreta al grupo, que es de quien juega', () => {
        expect(card.description).toMatch(/No interpretas a ningún miembro del grupo/);
    });

    // La frontera del proyecto entero, dicha donde el modelo la lee.
    test('deja escrito que los números los decide el juego, no él', () => {
        expect(card.description).toMatch(/las decide el juego|los decide el juego/);
    });

    test('sabe dónde narra, para que la primera frase no salga de la nada', () => {
        expect(card.description).toContain('El Molino de los Cuervos');
        expect(card.scenario).toContain('El Molino de los Cuervos');
    });

    test('el tono va donde va el tono, y el género donde va el mundo', () => {
        expect(card.personality).toBe('Seco, irónico, nunca adorna una muerte.');
        expect(card.personality).not.toMatch(/fantasía/i);
        expect(card.scenario).toMatch(/fantasía oscura/i);
    });

    test('y lo que escribiste de él sigue ahí, detrás del oficio', () => {
        expect(card.description).toContain('Estuvo en el asedio y no lo cuenta.');
    });

    test('abre con tu frase', () => {
        expect(card.first_mes).toBe('El molino sigue ahí. ¿Entráis?');
    });

    test('un narrador habla siempre que le toca: no es un personaje que a veces calla', () => {
        expect(card.talkativeness).toBe('1');
    });
});

describe('lo que se rellena solo', () => {
    test('sin nombre, narra igual', () => {
        expect(buildNarratorCard({}).ch_name).toBe(DEFAULT_NARRATOR_NAME);
    });

    test('sin frase de apertura, una corta que no inventa trama', () => {
        const card = buildNarratorCard({ name: 'El Cronista' }, world);
        expect(card.first_mes).toContain('El Molino de los Cuervos');
        expect(card.first_mes.length).toBeLessThan(90);
    });

    test('y sin mundo tampoco se rompe: el asistente puede preguntar antes de crearlo', () => {
        const card = buildNarratorCard({ name: 'Voz' });
        expect(card.first_mes).toContain('Voz');
        expect(card.description).toMatch(/narra/i);
        expect(card.scenario).toBe('');
    });

    test('sin personalidad escrita, el campo queda vacío en vez de inventado', () => {
        expect(buildNarratorCard({ name: 'Voz' }, world).personality).toBe('');
    });

    test('la ficha queda marcada como narrador, para reconocerla entre las demás', () => {
        expect(buildNarratorCard({ name: 'Voz' }, world).tags).toBe('narrador');
        expect(buildNarratorCard({ name: 'Voz' }, world).creator_notes).toMatch(/Narrador de la campaña/);
    });
});

describe('lo que impide crearlo', () => {
    test('un narrador sin nombre: es lo que encabeza cada mensaje', () => {
        expect(validateNarrator({ name: '   ' }).join(' ')).toMatch(/nombre/);
    });

    test('un nombre que no cabe en una cabecera', () => {
        expect(validateNarrator({ name: 'a'.repeat(61) }).join(' ')).toMatch(/demasiado largo/);
    });

    test('y uno normal no se queja', () => {
        expect(validateNarrator({ name: 'El Cronista' })).toEqual([]);
    });
});

describe('contado en una línea', () => {
    test('el nombre y por dónde va el tono', () => {
        const card = buildNarratorCard({ name: 'El Cronista', personality: 'Seco' }, world);
        expect(describeNarrator(card)).toBe('El Cronista · Seco');
    });

    test('y solo el nombre cuando no hay tono', () => {
        expect(describeNarrator(buildNarratorCard({ name: 'Voz' }, world))).toBe('Voz');
    });
});

describe('cuánto se extiende al contar', () => {
    // «Sé breve» no funciona: el modelo escribe lo mismo con frases mas cortas. Lo que
    // funciona es un presupuesto de frases y una lista de lo que NO hay que contar.
    test('lo de por defecto pone un presupuesto de frases', () => {
        const card = buildNarratorCard({ name: 'Voz' }, world);
        expect(card.description).toMatch(/dos a cuatro frases/i);
    });

    test('y dice qué recortar, que es lo que de verdad acorta', () => {
        const card = buildNarratorCard({ name: 'Voz' }, world);
        expect(card.description).toMatch(/No repites lo que el jugador ya sabe/);
        expect(card.description).toMatch(/Una sola pregunta/);
    });

    test('seco aprieta más que al grano, y al grano más que con ambiente', () => {
        const said = (verbosity) => buildNarratorCard({ name: 'Voz', verbosity }, world).description;
        expect(said('terse')).toMatch(/una o dos frases/i);
        expect(said('full')).toMatch(/cuatro a seis frases/i);
    });

    test('sin freno no impone nada', () => {
        const card = buildNarratorCard({ name: 'Voz', verbosity: 'novel' }, world);
        expect(card.description).not.toMatch(/frases\*\*/);
    });

    test('un ritmo inventado cae en el de por defecto', () => {
        expect(buildNarratorCard({ name: 'Voz', verbosity: 'susurrando' }, world).description)
            .toMatch(/dos a cuatro frases/i);
    });

    // Va con el oficio y no al final: lo que se cuelga al final de una descripcion larga
    // es lo primero que se diluye.
    test('el ritmo va antes de lo que el jugador escribio', () => {
        const card = buildNarratorCard({ name: 'Voz', description: 'Estuvo en el asedio.' }, world);
        expect(card.description.indexOf('frases')).toBeLessThan(card.description.indexOf('asedio'));
    });

    test('cada ritmo se puede enseñar en un desplegable', () => {
        for (const pace of Object.values(VERBOSITY)) {
            expect(pace.label.length).toBeGreaterThan(0);
            expect(pace.describe.length).toBeGreaterThan(10);
        }
        expect(VERBOSITY[DEFAULT_VERBOSITY]).toBeTruthy();
    });
});
