import { describe, test, expect } from '@jest/globals';
import { splitModelNote } from '../public/scripts/game-engine/campaign/model-note.js';

describe('splitModelNote (Z0 de ROADMAP_SIN_TOKENS)', () => {
    test('la orden del final se va, lo que pasó se queda', () => {
        const { said, ask } = splitModelNote('[ENCARGO] El gremio paga 40 de oro por el lobo. Cuéntalo en una frase. No inventes nada que no esté aquí.');
        expect(said).toBe('[ENCARGO] El gremio paga 40 de oro por el lobo.');
        expect(ask).toMatch(/^Cuéntalo en una frase\. No inventes/);
    });

    test('el presagio conserva lo que se dice tal cual', () => {
        const { said } = splitModelNote('[PRESAGIO] Alguien lo murmura, o se sueña. Dilo tal cual, sin explicarlo: «El oro que no es tuyo pesará más que la nieve.» «Del norte bajará el hierro.»');
        expect(said).toBe('[PRESAGIO] Alguien lo murmura, o se sueña. «El oro que no es tuyo pesará más que la nieve.» «Del norte bajará el hierro.»');
    });

    test('el arranque: la escena se queda; quién juega y las órdenes, fuera', () => {
        const text = [
            '[HILO] Viernes por la mañana, en el cuarto más barato de la posada. Abajo, gritos.',
            'Quien juega es Ulrich Brand (Humano, Soldado). Mercenario de una compañía. Adapta la escena a quién es: no contradigas su pasado.',
            'Cuéntalo en uno o dos párrafos, en el tono de la campaña. No inventes nada que no esté aquí.',
        ].join('\n');
        const { said, ask } = splitModelNote(text);
        expect(said).toBe('[HILO] Viernes por la mañana, en el cuarto más barato de la posada. Abajo, gritos.');
        expect(ask).toMatch(/Quien juega es Ulrich Brand/);
        expect(ask).toMatch(/Cuéntalo en uno o dos párrafos/);
    });

    test('un rumor: lo que cuentan se queda, cómo contarlo se va', () => {
        const { said } = splitModelNote('[RUMOR] Alguien en la taberna cuenta: «Dicen que unos forasteros han resuelto un caso.» Cuéntalo tal cual, en su boca y con su voz. No digas si es verdad: eso lo descubre quien juega.');
        expect(said).toBe('[RUMOR] Alguien en la taberna cuenta: «Dicen que unos forasteros han resuelto un caso.»');
    });

    test('«Cuenta saldada» es un hecho, no una orden', () => {
        expect(splitModelNote('[CUENTA] Cuenta saldada. Os quedan 12 de oro.').said).toBe('[CUENTA] Cuenta saldada. Os quedan 12 de oro.');
    });

    test('una nota que es solo orden no deja nada en pantalla', () => {
        expect(splitModelNote('[CAMPAMENTO] Cuéntalo en una o dos frases: discuten, y nadie se va.').said).toBe('');
    });

    test('lo que no lleva orden sale igual', () => {
        const plain = '⚔️ [COMBAT] Bran cae. Quedan dos lobos.';
        expect(splitModelNote(plain)).toEqual({ said: plain, ask: '' });
    });

    test('«Que se note…» y «Describe la escena…» son órdenes', () => {
        const { said } = splitModelNote('[FIESTA] Hoy es la Fiesta del Santo Patrón en El Pueblo de Barro. Que se note en la calle: música, gente, puestos. No inventes nada más.');
        expect(said).toBe('[FIESTA] Hoy es la Fiesta del Santo Patrón en El Pueblo de Barro.');
        expect(splitModelNote('La pelea acabó: dos lobos muertos. Describe la escena en un párrafo breve.').said).toBe('La pelea acabó: dos lobos muertos.');
    });
});
