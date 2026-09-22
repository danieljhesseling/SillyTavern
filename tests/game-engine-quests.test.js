import fs from 'node:fs';
import { describe, test, expect } from '@jest/globals';
import { createCompendium, validateBattery } from '../public/scripts/game-engine/compendio/compendio.js';
import { SORTS, writeQuest, writeQuestBoard, describeQuest } from '../public/scripts/game-engine/compendio/quests.js';

const misiones = JSON.parse(fs.readFileSync(
    new URL('../public/compendio/misiones.json', import.meta.url), 'utf8',
));

const of = (kind) => misiones.rows.filter(r => r.kind === kind);
const byId = new Map(misiones.rows.map(r => [r.id, r]));

/** La biblioteca de verdad, la que viene escrita. */
const real = (config) => createCompendium({ misiones: misiones.rows }, config);

/** Un azar repetible. */
const rolling = (seed) => {
    let state = seed;
    return () => ((state = (state * 9301 + 49297) % 233280) / 233280);
};

describe('la batería que viene escrita', () => {
    test('misiones.json pasa su propia validación', () => {
        expect(validateBattery('misiones', misiones)).toEqual([]);
    });

    test('trae las cuatro piezas de la gramática', () => {
        expect(new Set(misiones.rows.map(r => r.kind)))
            .toEqual(new Set(['verbo', 'objeto', 'giro', 'recompensa']));
        expect(of('verbo').length).toBeGreaterThanOrEqual(12);
        expect(of('objeto').length).toBeGreaterThanOrEqual(20);
        expect(of('giro').length).toBeGreaterThanOrEqual(15);
    });

    test('cada verbo dice a qué clases le pega, y trae su frase', () => {
        for (const verb of of('verbo')) {
            expect(Array.isArray(verb.wants)).toBe(true);
            expect(verb.wants.length).toBeGreaterThan(0);
            for (const sort of verb.wants) expect(SORTS).toContain(sort);
            expect(String(verb.line)).toContain('{objeto}');
        }
    });

    test('cada objeto dice qué clase de cosa es, y trae sus dos formas', () => {
        for (const object of of('objeto')) {
            expect(SORTS).toContain(object.sort);
            expect(String(object.bare || '').length).toBeGreaterThan(3);
            expect(String(object.detail || '').length).toBeGreaterThan(10);
        }
    });

    // El giro es lo que separa un recado de una misión: sin él, «mata diez ratas»
    // escrito de quince formas.
    test('y cada giro dice qué cambia, en una frase que se puede leer en la mesa', () => {
        for (const twist of of('giro')) {
            expect(String(twist.note || '').length).toBeGreaterThan(25);
        }
    });

    // Una cifra se equilibra mal y se olvida; un favor no.
    test('la mayoría de las recompensas no son oro', () => {
        const oro = of('recompensa').filter(r => (r.tags ?? []).includes('oro'));
        expect(oro.length).toBeLessThanOrEqual(2);
    });

    // Un verbo sin objetos de su clase es un verbo que nunca sale bien.
    test('todos los verbos tienen a qué pegarse', () => {
        for (const verb of of('verbo')) {
            const fit = of('objeto').filter(o => verb.wants.includes(o.sort));
            expect(fit.length).toBeGreaterThan(0);
        }
    });

    // Un giro que no pega con lo que hay delante delata a la maquina mas que cualquier
    // otra cosa: «no quiere que lo salven» sobre un cargamento.
    test('el giro encaja con la clase del objeto, siempre', () => {
        const random = rolling(59);
        for (let i = 0; i < 400; i++) {
            const quest = writeQuest({ compendium: real(), random });
            const twist = byId.get(quest.from.giro);
            const object = byId.get(quest.from.objeto);
            if (Array.isArray(twist.sort)) expect(twist.sort).toContain(object.sort);
        }
    });

    test('y ninguna clase se queda sin giros que le peguen', () => {
        const twists = of('giro');
        for (const sort of new Set(of('objeto').map(o => o.sort))) {
            const fit = twists.filter(t => !Array.isArray(t.sort) || t.sort.includes(sort));
            expect(fit.length).toBeGreaterThanOrEqual(8);
        }
    });

    test('y todas las clases que un verbo pide existen entre los objetos', () => {
        const sorts = new Set(of('objeto').map(o => o.sort));
        for (const verb of of('verbo')) {
            for (const want of verb.wants) expect(sorts).toContain(want);
        }
    });
});

describe('escribir una misión', () => {
    test('sin batería no hay misión, y no revienta', () => {
        expect(writeQuest({ compendium: createCompendium({}), random: () => 0.5 })).toBe(null);
    });

    test('sale con los cuatro campos que la ficha pide', () => {
        const quest = writeQuest({ compendium: real(), act: 2, random: rolling(7) });
        expect(Object.keys(quest).sort()).toEqual(['act', 'boardName', 'description', 'from', 'name']);
        expect(quest.act).toBe(2);
    });

    test('el nombre empieza por mayúscula y no lleva huecos sin rellenar', () => {
        const random = rolling(11);
        for (let i = 0; i < 200; i++) {
            const quest = writeQuest({ compendium: real(), random });
            expect(quest.name[0]).toBe(quest.name[0].toUpperCase());
            expect(quest.name).not.toMatch(/[{}]/);
            expect(quest.description).not.toMatch(/[{}]/);
        }
    });

    // «Convencer al pozo» y «Entregar la cripta» no son misiones. Lo dice el verbo en su
    // fila, no este código.
    test('el verbo manda sobre el objeto, siempre', () => {
        const random = rolling(13);
        for (let i = 0; i < 400; i++) {
            const quest = writeQuest({ compendium: real(), random });
            const verb = byId.get(quest.from.verbo);
            const object = byId.get(quest.from.objeto);
            expect(verb.wants).toContain(object.sort);
        }
    });

    test('la descripción cuenta el encargo, el giro y la paga', () => {
        const quest = writeQuest({ compendium: real(), random: rolling(17) });
        expect(quest.description).toContain(byId.get(quest.from.giro).note);
        expect(quest.description).toContain(byId.get(quest.from.recompensa).note);
        expect(quest.description).toContain(byId.get(quest.from.objeto).detail);
    });

    // El detalle es una oración de relativo: si se cuelga del final de la frase del verbo
    // se ata al sustantivo equivocado.
    test('y el detalle va en su frase, con su antecedente delante', () => {
        const random = rolling(53);
        for (let i = 0; i < 100; i++) {
            const quest = writeQuest({ compendium: real(), random });
            const object = byId.get(quest.from.objeto);
            expect(quest.description).toContain(`Es ${object.bare} ${object.detail}.`);
        }
    });

    // Una misión que nombra un tablero que no existe no se puede guardar.
    test('el tablero sale de los que hay, o se queda en blanco', () => {
        const sinTableros = writeQuest({ compendium: real(), random: rolling(19) });
        expect(sinTableros.boardName).toBe('');

        const random = rolling(23);
        for (let i = 0; i < 50; i++) {
            const quest = writeQuest({
                compendium: real(), boards: ['Sala de entrada', 'El sótano'], random,
            });
            expect(['Sala de entrada', 'El sótano']).toContain(quest.boardName);
        }
    });

    test('el acto nunca baja de uno, diga lo que diga quien lo pide', () => {
        expect(writeQuest({ compendium: real(), act: 0, random: rolling(29) }).act).toBe(1);
        expect(writeQuest({ compendium: real(), act: -4, random: rolling(29) }).act).toBe(1);
    });

    test('la misma semilla escribe la misma misión', () => {
        const once = writeQuest({ compendium: real(), random: rolling(42) });
        const twice = writeQuest({ compendium: real(), random: rolling(42) });
        expect(once).toEqual(twice);
    });
});

describe('un tablón de contratos', () => {
    // Tres recados con el mismo giro son el mismo recado tres veces.
    test('cinco misiones: ni el mismo encargo dos veces ni el mismo giro', () => {
        const board = writeQuestBoard({ compendium: real(), howMany: 5, random: rolling(31) });
        expect(board).toHaveLength(5);
        expect(new Set(board.map(q => q.from.objeto)).size).toBe(5);
        expect(new Set(board.map(q => q.from.giro)).size).toBe(5);
        expect(new Set(board.map(q => q.name)).size).toBe(5);
    });

    test('sin batería, ninguno', () => {
        expect(writeQuestBoard({ compendium: createCompendium({}), howMany: 3, random: () => 0.5 }))
            .toEqual([]);
    });

    test('y todas caen en el acto que se pidió', () => {
        const board = writeQuestBoard({ compendium: real(), howMany: 4, act: 3, random: rolling(37) });
        for (const quest of board) expect(quest.act).toBe(3);
    });
});

describe('contado en una línea', () => {
    test('dice qué es y de qué acto', () => {
        expect(describeQuest({ name: 'Rescatar al testigo', act: 2, boardName: 'El sótano' }))
            .toBe('Rescatar al testigo · acto 2 · El sótano');
    });

    test('y sin tablero, no se inventa uno', () => {
        expect(describeQuest({ name: 'Limpiar el pozo', act: 1, boardName: '' }))
            .toBe('Limpiar el pozo · acto 1');
    });
});
