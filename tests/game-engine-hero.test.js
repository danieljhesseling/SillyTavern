import { describe, test, expect } from '@jest/globals';
import {
    DEFAULT_RACES, DEFAULT_CLASSES, GENDERS,
    validateHero, heroContent, buildHeroEntry, describeHero,
    buildHeroPrompt, cleanHeroAbout,
} from '../public/scripts/game-engine/campaign/hero.js';

const lyra = (extra = {}) => ({
    name: 'Lyra', gender: 'Mujer', race: 'Media elfa', className: 'Pícara',
    about: 'Creció robando en el puerto.', image: 'img/lyra.png', ...extra,
});

describe('lo que hay que rellenar', () => {
    // Pedir doce campos antes de la primera frase es la mejor forma de que nadie llegue a
    // la primera frase.
    test('solo el nombre es obligatorio', () => {
        expect(validateHero({ name: 'Lyra' })).toEqual([]);
        expect(validateHero({ name: '  ' }).join(' ')).toMatch(/nombre/);
    });

    test('y tiene que caber en una cabecera', () => {
        expect(validateHero({ name: 'a'.repeat(61) }).join(' ')).toMatch(/no cabe/);
    });

    test('hay razas, clases y géneros que ofrecer sin inventar nada', () => {
        expect(DEFAULT_RACES.length).toBeGreaterThan(4);
        expect(DEFAULT_CLASSES.length).toBeGreaterThan(4);
        expect(GENDERS).toContain('Sin especificar');
    });
});

describe('lo que el modelo lee', () => {
    test('quién eres, en una línea, y lo que cuentes de ti', () => {
        const said = heroContent(lyra());
        expect(said).toMatch(/Lyra: Mujer · Media elfa · Pícara\./);
        expect(said).toMatch(/Creció robando en el puerto\./);
    });

    test('sin nada más que el nombre, no queda una frase rota', () => {
        expect(heroContent({ name: 'Lyra' })).toBe('Lyra forma parte del grupo.');
    });

    test('y los números no viajan al chat: eso es ficha, no narración', () => {
        expect(heroContent(lyra())).not.toMatch(/\b10\b|\b30\b/);
    });
});

describe('la ficha que se escribe', () => {
    const entry = buildHeroEntry(lyra(), { locationName: 'La cripta', cell: { x: 2, y: 3 } });

    // De esta forma cuelga todo lo demas: el grupo, las heridas, el hambre y la cuenta.
    test('es la misma que escribía el asistente, para que todo lo demás siga valiendo', () => {
        expect(entry.group).toBe('Characters');
        expect(entry.dndData.entityType).toBe('character');
        expect(entry.title).toBe('Lyra');
        expect(entry.keys).toEqual(['Lyra']);
    });

    test('con los campos que la ficha viva busca, por su nombre corto', () => {
        expect(entry.dndData.charClass).toBe('Pícara');
        expect(entry.dndData.race).toBe('Media elfa');
        expect(entry.dndData.str).toBe(10);
        expect(entry.dndData.ac).toBe(10);
    });

    test('y sabe dónde empieza', () => {
        expect(entry.dndData.mapPosition).toEqual({ locationName: 'La cripta', gridX: 2, gridY: 3 });
    });

    test('sin decir dónde, empieza en una casilla que no es un muro', () => {
        const loose = buildHeroEntry(lyra());
        expect(loose.dndData.mapPosition.gridX).toBe(1);
        expect(loose.dndData.mapPosition.gridY).toBe(1);
    });

    // Es lo que hace que elegir "Picara" signifique algo y no sea una palabra en la
    // cabecera.
    test('los números salen de la clase cuando el mundo la describe', () => {
        const withPreset = buildHeroEntry(lyra(), {
            preset: { dexterity: 17, armorClass: 15, maxHp: 24, speed: 35 },
        });
        expect(withPreset.dndData.dex).toBe(17);
        expect(withPreset.dndData.ac).toBe(15);
        expect(withPreset.dndData.maxHp).toBe(24);
        expect(withPreset.dndData.speed).toBe(35);
    });

    test('y lo que la clase no diga cae en lo de siempre', () => {
        const half = buildHeroEntry(lyra(), { preset: { dexterity: 17 } });
        expect(half.dndData.dex).toBe(17);
        expect(half.dndData.str).toBe(10);
    });

    // Lo que el motor le da a cualquiera del grupo. Con diez, el personaje entraba con la
    // mitad de vida de la que tienen medidos los enemigos de las plantillas.
    test('sin clase descrita, la vida es la que el motor da al resto del grupo', () => {
        expect(buildHeroEntry(lyra()).dndData.maxHp).toBe(30);
    });

    test('el género se guarda: es de quien juega, no del motor', () => {
        expect(entry.dndData.gender).toBe('Mujer');
    });

    test('empieza a nivel 1, que para eso es el principio', () => {
        expect(entry.dndData.level).toBe(1);
    });
});

describe('contado en una línea', () => {
    test('nombre, raza y clase', () => {
        expect(describeHero(lyra())).toBe('Lyra · Media elfa Pícara');
    });

    test('y solo el nombre si no dijiste más', () => {
        expect(describeHero({ name: 'Lyra' })).toBe('Lyra');
    });
});

describe('la varita', () => {
    // Lo escrito no es un borrador que pulir, es un encargo: «algo triste sobre su
    // pobreza» no se mejora, se cumple.
    test('lo escrito viaja como encargo, no como texto a mejorar', () => {
        const { prompt } = buildHeroPrompt(
            { name: 'Lyra', about: 'algo triste sobre lo pobre que es' },
            { worldName: 'El Puerto Ahogado', genre: 'Oscuro' },
        );

        expect(prompt).toMatch(/Lo que quiere quien juega: algo triste/);
        expect(prompt).toMatch(/El Puerto Ahogado/);
        expect(prompt).toMatch(/tono es oscuro/);
    });

    test('y sin nada escrito se le pide que invente', () => {
        const { prompt } = buildHeroPrompt({ name: 'Lyra', race: 'Elfa' });
        expect(prompt).toMatch(/Invéntale un pasado/);
        expect(prompt).toMatch(/Es Elfa\./);
    });

    // Esto acaba en el Lorebook y se inyecta cada vez que alguien te nombra: un parrafo
    // de novela aqui se paga en todos los turnos de la partida.
    test('se le ata corto en largo, porque va en cada turno', () => {
        const { systemPrompt } = buildHeroPrompt({ name: 'Lyra' });
        expect(systemPrompt).toMatch(/dos y cuatro frases/i);
        expect(systemPrompt).toMatch(/sin comillas/i);
    });

    test('se le quitan las comillas y el encabezado que suelta el modelo', () => {
        expect(cleanHeroAbout('"Creció robando en el puerto."'))
            .toBe('Creció robando en el puerto.');
        expect(cleanHeroAbout('Ficha: Creció robando.')).toBe('Creció robando.');
        expect(cleanHeroAbout('   ')).toBe('');
    });
});
