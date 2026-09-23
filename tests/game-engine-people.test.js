import fs from 'node:fs';
import { describe, test, expect } from '@jest/globals';
import { createCompendium, validateBattery } from '../public/scripts/game-engine/compendio/compendio.js';
import {
    ABILITIES, TRAITS, pickTraits, writePerson, writeVillage, describePerson,
} from '../public/scripts/game-engine/compendio/people.js';

const personas = JSON.parse(fs.readFileSync(
    new URL('../public/compendio/personas.json', import.meta.url), 'utf8',
));
const nombres = JSON.parse(fs.readFileSync(
    new URL('../public/compendio/nombres.json', import.meta.url), 'utf8',
));

const of = (kind) => personas.rows.filter(r => r.kind === kind);
const byId = new Map(personas.rows.map(r => [r.id, r]));

/** Con nombres, que es como se usa de verdad. */
const real = (config) => createCompendium({
    personas: personas.rows, nombres: nombres.rows,
}, config);

/** Un azar repetible. */
const rolling = (seed) => {
    let state = seed;
    return () => ((state = (state * 9301 + 49297) % 233280) / 233280);
};

describe('la batería de personas', () => {
    test('personas.json pasa su propia validación', () => {
        expect(validateBattery('personas', personas)).toEqual([]);
    });

    test('trae las siete clases de fila', () => {
        expect(new Set(personas.rows.map(r => r.kind))).toEqual(
            new Set(['rasgo', 'deseo', 'miedo', 'oficio', 'secreto', 'voz', 'arcano']),
        );
    });

    // «Es agarrado» para una cazadora delata que detrás hay una máquina.
    test('cada rasgo trae sus dos formas', () => {
        for (const trait of of('rasgo')) {
            expect(String(trait.namef || '').length).toBeGreaterThan(3);
        }
    });

    // El oficio es una mecánica, no un adorno.
    test('cada oficio dice qué hace por ti, y con qué género se le llama', () => {
        for (const job of of('oficio')) {
            expect(['m', 'f']).toContain(job.gender);
            expect(String(job.does || '').length).toBeGreaterThan(20);
            expect(String(job.title || '').length).toBeGreaterThan(2);
        }
    });

    test('y sube una característica que el motor lee', () => {
        for (const job of of('oficio')) expect(ABILITIES).toContain(job.stat);
    });

    // Un secreto sin salida no es una trama: es una nota que nadie va a leer nunca.
    test('cada secreto trae escrito qué lo saca a la luz', () => {
        for (const secret of of('secreto')) {
            expect(String(secret.outIf || '').length).toBeGreaterThan(10);
        }
    });

    // Un deseo sin su línea es media tirada.
    test('deseos y miedos traen su porqué', () => {
        for (const row of [...of('deseo'), ...of('miedo')]) {
            expect(String(row.note || '').length).toBeGreaterThan(20);
        }
    });

    test('y lo que un rasgo dice que choca existe de verdad', () => {
        for (const trait of of('rasgo')) {
            for (const other of (trait.conflictsWith ?? [])) {
                expect(of('rasgo').some(r => r.id.endsWith(other))).toBe(true);
            }
        }
    });
});

describe('rasgos que no se contradicen', () => {
    // «Terco y conciliador» no describe a nadie: describe a quien escribió la tabla.
    test('dos rasgos que chocan no salen juntos, nunca', () => {
        const random = rolling(7);
        for (let i = 0; i < 300; i++) {
            const traits = pickTraits(real(), random);
            for (const trait of traits) {
                for (const other of traits) {
                    if (trait === other) continue;
                    for (const clash of (trait.conflictsWith ?? [])) {
                        expect(other.id.endsWith(clash)).toBe(false);
                    }
                }
            }
        }
    });

    // Dos se leen; cuatro son un horóscopo.
    test('salen dos, y ninguno repetido', () => {
        const traits = pickTraits(real(), rolling(11));
        expect(traits).toHaveLength(TRAITS);
        expect(new Set(traits.map(t => t.id)).size).toBe(TRAITS);
    });
});

describe('escribir a alguien', () => {
    test('sin batería no hay nadie, y no revienta', () => {
        expect(writePerson({ compendium: createCompendium({}), random: () => 0.5 })).toBe(null);
    });

    test('sale con los campos que la ficha de persona pide', () => {
        const person = writePerson({ compendium: real(), random: rolling(7) });
        for (const field of ['name', 'title', 'abilities', 'backstory', 'personality', 'arcana', 'keys']) {
            expect(person).toHaveProperty(field);
        }
        expect(Object.keys(person.abilities).sort()).toEqual([...ABILITIES].sort());
    });

    // Lo que convierte una ficha en una persona son dos tiradas: qué quiere y qué teme.
    test('siempre quiere algo y teme algo', () => {
        const random = rolling(13);
        for (let i = 0; i < 100; i++) {
            const person = writePerson({ compendium: real(), random });
            expect(person.from.deseo).toBeTruthy();
            expect(person.from.miedo).toBeTruthy();
            expect(person.backstory).toMatch(/Quiere /);
            expect(person.personality).toMatch(/Teme /);
        }
    });

    test('el oficio sube su característica, y las demás se quedan en diez', () => {
        const random = rolling(17);
        for (let i = 0; i < 60; i++) {
            const person = writePerson({ compendium: real(), random });
            const job = byId.get(person.from.oficio);
            expect(person.abilities[job.stat]).toBeGreaterThan(10);
            const lasDemas = ABILITIES.filter(ability => ability !== job.stat);
            expect(lasDemas.map(ability => person.abilities[ability]))
                .toEqual(lasDemas.map(() => 10));
        }
    });

    test('el adjetivo concuerda con cómo llama la gente a esa persona', () => {
        const random = rolling(19);
        for (let i = 0; i < 150; i++) {
            const person = writePerson({ compendium: real(), random });
            const job = byId.get(person.from.oficio);
            for (const id of person.from.rasgos) {
                const trait = byId.get(id);
                const wanted = job.gender === 'f' ? trait.namef : trait.name;
                expect(person.personality).toContain(wanted);
            }
        }
    });

    // «Saldría si aparezca» no lo escribe nadie.
    test('el secreto se cuenta en indicativo, y dice qué lo destapa', () => {
        const person = writePerson({ compendium: real(), random: rolling(23) });
        const secret = byId.get(person.from.secreto);
        expect(person.backstory).toContain(`Sale a la luz si ${secret.outIf}.`);
    });

    test('el nombre sale de la batería de nombres', () => {
        expect(writePerson({ compendium: real(), culture: 'norte', random: rolling(29) }).name)
            .not.toBe('');
    });

    // Sin ella el nombre se queda vacío y quien llama pone el suyo: aditivo, como todo.
    test('y sin ella se queda vacío, sin romper nada', () => {
        const solo = createCompendium({ personas: personas.rows });
        const person = writePerson({ compendium: solo, random: rolling(31) });
        expect(person.name).toBe('');
        expect(person.backstory.length).toBeGreaterThan(40);
    });

    test('la misma semilla escribe a la misma persona', () => {
        expect(writePerson({ compendium: real(), random: rolling(42) }))
            .toEqual(writePerson({ compendium: real(), random: rolling(42) }));
    });
});

describe('un pueblo', () => {
    // Tres vecinos que quieren lo mismo y temen lo mismo son el mismo escrito tres veces.
    test('cuatro vecinos, cuatro oficios, cuatro deseos y cuatro miedos', () => {
        const village = writeVillage({
            compendium: real(), howMany: 4, culture: 'valle',
            locationName: 'El Molino', random: rolling(37),
        });
        expect(village).toHaveLength(4);
        expect(new Set(village.map(p => p.from.oficio)).size).toBe(4);
        expect(new Set(village.map(p => p.from.deseo)).size).toBe(4);
        expect(new Set(village.map(p => p.from.miedo)).size).toBe(4);
        expect(new Set(village.map(p => p.name)).size).toBe(4);
    });

    test('y todos viven donde se les dijo', () => {
        const village = writeVillage({
            compendium: real(), howMany: 3, locationName: 'El Vado', random: rolling(41),
        });
        for (const person of village) expect(person.locationName).toBe('El Vado');
    });

    test('sin batería, ninguno', () => {
        expect(writeVillage({ compendium: createCompendium({}), howMany: 3, random: () => 0.5 }))
            .toEqual([]);
    });
});

describe('contado en una línea', () => {
    test('dice quién es y cómo lo llaman', () => {
        expect(describePerson({ name: 'Bruna', title: 'la barquera', arcana: 'La Torre' }))
            .toBe('Bruna · la barquera · La Torre');
    });

    test('y sin nombre lo dice, en vez de dejar un hueco', () => {
        expect(describePerson({ name: '', title: 'el herrero', arcana: '' }))
            .toBe('(sin nombre) · el herrero');
    });
});

describe('un vecino con bandera', () => {
    const banner = {
        name: 'Los del Molino',
        wants: 'quieren La Ermita',
        note: 'Necesitan más tierra de la que tienen.',
    };
    const conBandera = () => writePerson({
        compendium: real(), random: rolling(77),
        locationName: 'El Molino', banner,
    });

    // El campo de facción de la ficha ya existía; ahora trae una que existe de verdad.
    test('lleva la facción en la ficha, donde el editor ya la lee', () => {
        expect(conBandera().factions).toEqual(['Los del Molino']);
    });

    // Es lo que le da un motivo que no es suyo, sin escribirle uno a mano.
    test('y en lo que el modelo lee, con lo que los suyos quieren', () => {
        const dicho = conBandera().backstory;
        expect(dicho).toContain('Es de Los del Molino');
        expect(dicho).toContain('quieren La Ermita');
        expect(dicho).toContain('Necesitan más tierra');
    });

    test('sin bandera, un vecino es de nadie y sale como siempre', () => {
        const suelto = writePerson({
            compendium: real(), random: rolling(77), locationName: 'El Molino',
        });
        expect(suelto.factions).toEqual([]);
        expect(suelto.backstory).not.toContain('Es de');
    });

    test('y en una línea se dice de quién es', () => {
        expect(describePerson(conBandera())).toContain('Los del Molino');
    });
});
