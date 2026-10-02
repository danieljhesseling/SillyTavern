/**
 * J13.7: solo sabes el nombre de quien se ha presentado.
 */
import fs from 'node:fs';
import { describe, test, expect, afterEach } from '@jest/globals';
import {
    MET, roleOf, nameFor, knowsName, meetPerson, readKnownPeople, learnFromLine, resolvePeopleTokens, maskNames,
    createNamer, introLine, isDescriptiveName, personGender, checkIntroductions, knownPeopleLines, packPeople, findPerson,
} from '../public/scripts/game-engine/campaign/known-people.js';
import { setNamesSource, shownName, shownText, hearLine, knowsName as shownKnows, introFor } from '../public/scripts/game-engine/ui/shown-names.js';
import { readSceneBeats } from '../public/scripts/game-engine/campaign/plot-scenes.js';
import { readDialogue } from '../public/scripts/game-engine/campaign/dialogues.js';
import { readPlot } from '../public/scripts/game-engine/campaign/plot.js';
import { STATE_KEYS } from '../public/scripts/game-engine/campaign/state-registry.js';
import { buildCampaignPackSchema, getPackRules } from '../public/scripts/game-engine/campaign/campaign-pack-schema.js';

const pack = (id) => JSON.parse(fs.readFileSync(new URL(`../public/mundos/${id}.pack.json`, import.meta.url), 'utf8'));

const PEOPLE = [
    { id: 'tomas', name: 'Tomás', trade: 'Posadero' },
    { id: 'brunilda', name: 'Brunilda', trade: 'Maestra del gremio' },
    { id: 'elvira', name: 'Madre Elvira', trade: 'Sacerdotisa de la capilla' },
    { id: 'garret', name: 'Garret', trade: 'Guardia de la puerta' },
    { id: 'nils', name: 'Nils', trade: 'Lugarteniente y cazadora', stranger: 'una cazadora' },
    { id: 'capitana-keller', name: 'Elara Keller', trade: 'Comandante de la Vanguardia', gender: 'Mujer' },
    { id: 'lord-vane', name: 'Lord Edmund Vane', trade: 'Señor del Valle', famous: true },
    { name: 'El ermitaño de la cascada', trade: 'Mago' },
    { name: 'El Abad', trade: 'Señor de la abadía' },
    { name: 'Isolda', className: 'picaro' },
    { name: 'Aldara', className: 'explorador' },
    { name: 'Bran', className: 'guerrero' },
    { name: 'Rosa', trade: 'Ama de llaves' },
];

describe('cómo se llama a quien no se ha presentado', () => {
    test('por su oficio, con su artículo y su género', () => {
        expect(roleOf(PEOPLE[0], 'el')).toBe('el posadero');
        expect(roleOf(PEOPLE[0], 'un')).toBe('un posadero');
        expect(roleOf(PEOPLE[0], 'placa')).toBe('Posadero');
        expect(roleOf(PEOPLE[1], 'el')).toBe('la maestra del gremio');
        expect(roleOf(PEOPLE[1], 'placa')).toBe('Maestra del gremio');
        expect(roleOf(PEOPLE[2], 'el')).toBe('la sacerdotisa de la capilla');
        // «Guardia» no dice el género: sin saberlo, en masculino, como el resto del motor.
        expect(roleOf(PEOPLE[3], 'el')).toBe('el guardia de la puerta');
        expect(roleOf(PEOPLE[5], 'el')).toBe('la comandante de la Vanguardia');
        // «el ama de llaves»: a tónica.
        expect(roleOf(PEOPLE[12], 'el')).toBe('el ama de llaves');
    });

    test('`stranger` manda: «una cazadora», y en la placa «Cazadora»', () => {
        expect(roleOf(PEOPLE[4], 'el')).toBe('una cazadora');
        expect(roleOf(PEOPLE[4], 'placa')).toBe('Cazadora');
    });

    test('un confidente sale por su clase, con tilde y en femenino si es mujer', () => {
        expect(personGender(PEOPLE[9])).toBe('f');
        expect(roleOf(PEOPLE[9], 'el')).toBe('la pícara');
        expect(roleOf(PEOPLE[9], 'placa')).toBe('Pícara');
        expect(roleOf(PEOPLE[10], 'el')).toBe('la exploradora');
        expect(roleOf(PEOPLE[11], 'el')).toBe('el guerrero');
    });

    test('quien se llama por lo que es, o es famoso, sale siempre con su nombre', () => {
        expect(isDescriptiveName('El ermitaño de la cascada')).toBe(true);
        expect(isDescriptiveName('El Abad')).toBe(true);
        expect(isDescriptiveName('Tomás')).toBe(false);
        expect(nameFor('El ermitaño de la cascada', { people: PEOPLE })).toBe('El ermitaño de la cascada');
        expect(nameFor('Lord Edmund Vane', { people: PEOPLE })).toBe('Lord Edmund Vane');
    });

    test('nameFor: su nombre si se sabe, lo que es si no; tu grupo y quien no es de la gente, siempre', () => {
        expect(nameFor('Tomás', { people: PEOPLE })).toBe('Posadero');
        expect(nameFor('Tomás', { people: PEOPLE, form: 'el' })).toBe('el posadero');
        expect(nameFor('Tomás', { people: PEOPLE, form: 'El' })).toBe('El posadero');
        const state = meetPerson(null, 'Tomás', 'presentado', { people: PEOPLE });
        expect(nameFor('Tomás', { people: PEOPLE, state })).toBe('Tomás');
        expect(nameFor('Bran', { people: PEOPLE, always: ['Bran'] })).toBe('Bran');
        expect(nameFor('Un lobo', { people: PEOPLE })).toBe('Un lobo');
    });

    test('se encuentra por el id, por el nombre sin tildes y por la forma que solo es suya', () => {
        expect(findPerson('tomas', PEOPLE)?.name).toBe('Tomás');
        expect(findPerson('capitana-keller', PEOPLE)?.name).toBe('Elara Keller');
        expect(findPerson('Elvira', PEOPLE)?.name).toBe('Madre Elvira');
    });
});

describe('lo que se sabe', () => {
    test('sin nada guardado no se conoce a nadie; una partida de antes conoce a todos', () => {
        expect(readKnownPeople(null)).toEqual({ all: false, people: {} });
        expect(readKnownPeople(null, { legacy: true }).all).toBe(true);
        expect(knowsName('Tomás', { people: PEOPLE, state: { all: true, people: {} } })).toBe(true);
    });

    test('la primera vez es la que cuenta', () => {
        let state = meetPerson(null, 'Tomás', 'nombrado', { people: PEOPLE, day: 1, by: 'Brunilda' });
        state = meetPerson(state, 'Tomás', 'presentado', { people: PEOPLE, day: 2 });
        expect(state.people.tomas).toEqual({ how: 'nombrado', day: 1, by: 'Brunilda' });
    });

    test('de una línea: quien dice su nombre se presenta; a quien nombra otro, te lo han dicho', () => {
        let out = learnFromLine(null, { who: 'Tomás', text: '¡Al ladrón! ¡Ese desgraciado me ha quitado la bolsa!' }, { people: PEOPLE });
        expect(out.learned).toEqual([]);
        out = learnFromLine(out.state, { who: 'Tomás', text: '¡Gracias! Soy Tomás, el de la posada del gremio.' }, { people: PEOPLE });
        expect(out.learned).toEqual([{ name: 'Tomás', how: 'presentado' }]);
        out = learnFromLine(out.state, { who: 'Tomás', text: '¡Brunilda! Mira, este es el que ha parado al ratero.' }, { people: PEOPLE });
        expect(out.learned).toEqual([{ name: 'Brunilda', how: 'nombrado' }]);
        expect(out.state.people.brunilda.by).toBe('Tomás');
    });

    test('`presenta` lo dice a mano, aunque el nombre no salga', () => {
        const out = learnFromLine(null, { who: 'Nils', text: 'Ni un paso más.', presenta: true }, { people: PEOPLE });
        expect(out.learned).toEqual([{ name: 'Nils', how: 'presentado' }]);
        const other = learnFromLine(null, { text: 'Es la capitana de la vanguardia.', presenta: 'capitana-keller' }, { people: PEOPLE });
        expect(other.learned).toEqual([{ name: 'Elara Keller', how: 'presentado' }]);
    });

    test('un apellido que es de una casa o de un sitio no nombra a la persona', () => {
        const out = learnFromLine(null, { text: 'La vanguardia de los Keller ha tomado el peaje.' }, { people: PEOPLE, skip: ['Casa Keller'] });
        expect(out.learned).toEqual([]);
    });

    test('el Diario cuenta a quién conoces y cómo', () => {
        const state = meetPerson(null, 'Tomás', 'presentado', { people: PEOPLE, day: 1 });
        expect(knownPeopleLines(state, PEOPLE)).toEqual(['Tomás, el posadero. Se presentó el día 1.']);
        expect(Object.keys(MET)).toEqual(expect.arrayContaining(['presentado', 'nombrado', 'contado', 'escrito', 'charla']));
    });
});

describe('los nombres en un texto', () => {
    test('{npc:id} sale como su nombre si se sabe, y si no por lo que es, contraído y en mayúscula al empezar', () => {
        const said = '{npc:tomas} te mira. Le das la bolsa a {npc:tomas} y hablas de {npc:tomas}. Habla con {npc:brunilda}.';
        expect(resolvePeopleTokens(said, { people: PEOPLE }))
            .toBe('El posadero te mira. Le das la bolsa al posadero y hablas del posadero. Habla con la maestra del gremio.');
        const state = meetPerson(null, 'Tomás', 'presentado', { people: PEOPLE });
        expect(resolvePeopleTokens('Gracias, {npc:tomas}.', { people: PEOPLE, state })).toBe('Gracias, Tomás.');
        expect(resolvePeopleTokens('Un {npc:tomas:placa}', { people: PEOPLE })).toBe('Un Posadero');
    });

    test('maskNames cambia a quien no se conoce por lo que es, y no toca los sitios', () => {
        const said = 'Un ratero le ha quitado la bolsa a Tomás. Tomás grita. Vas a la Casa Keller.';
        expect(maskNames(said, { people: PEOPLE, skip: ['Casa Keller'] }))
            .toBe('Un ratero le ha quitado la bolsa al posadero. El posadero grita. Vas a la Casa Keller.');
        const state = meetPerson(null, 'Tomás', 'presentado', { people: PEOPLE });
        expect(maskNames(said, { people: PEOPLE, state, skip: ['Casa Keller'] })).toBe(said);
        // Tras una cita que acaba en punto empieza frase; tras una que sigue, no.
        expect(maskNames('Tú: «Quédate atrás.» Tomás: «¡Gracias!»', { people: PEOPLE })).toBe('Tú: «Quédate atrás.» El posadero: «¡Gracias!»');
        expect(maskNames('Dices «vale» a Tomás.', { people: PEOPLE })).toBe('Dices «vale» al posadero.');
    });

    test('J9.1: si lo que es ya va delante del nombre, se quita el nombre y no se repite', () => {
        const torres = [...PEOPLE, { id: 'torres', name: 'Torres', trade: 'Alguacil' }];
        expect(maskNames('Abajo hay gritos. El alguacil Torres y sus guardias revientan la puerta.', { people: torres }))
            .toBe('Abajo hay gritos. El alguacil y sus guardias revientan la puerta.');
        expect(maskNames('La llave solo la tiene el alguacil Torres.', { people: torres })).toBe('La llave solo la tiene el alguacil.');
        expect(maskNames('Habla con la maestra del gremio Brunilda.', { people: PEOPLE })).toBe('Habla con la maestra del gremio.');
        // Sin el oficio delante, como siempre; y quien ya se presentó sale con su nombre.
        expect(maskNames('Torres grita.', { people: torres })).toBe('El alguacil grita.');
        expect(maskNames('Un vigilante Torres.', { people: torres })).toBe('Un vigilante el alguacil.');
        const state = meetPerson(null, 'Torres', 'presentado', { people: torres });
        expect(maskNames('El alguacil Torres grita.', { people: torres, state })).toBe('El alguacil Torres grita.');
    });

    test('la línea con que se presenta: su nombre y lo que es, siempre igual para la misma persona', () => {
        const line = introLine('Tomás', PEOPLE);
        expect(line).toMatch(/Tomás/);
        expect(line).toMatch(/el posadero/);
        expect(introLine('Tomás', PEOPLE)).toBe(line);
    });
});

describe('quien lleva la cuenta en una escena', () => {
    test('la placa cambia cuando se presenta, y se avisa para guardarlo', () => {
        /** @type {any[]} */
        const saved = [];
        const namer = createNamer({ people: PEOPLE, day: 1, onLearn: (state, learned) => saved.push({ state, learned }) });
        namer.hear({ who: 'Tomás', text: '¡Al ladrón!' });
        expect(namer.name('Tomás')).toBe('Posadero');
        expect(namer.intro('Tomás')).toMatch(/Tomás/);
        namer.hear({ who: 'Tomás', text: '¡Gracias! Soy Tomás, el de la posada del gremio.' });
        expect(namer.name('Tomás')).toBe('Tomás');
        expect(namer.intro('Tomás')).toBe('');
        expect(saved).toHaveLength(1);
        expect(saved[0].state.people.tomas.how).toBe('presentado');
        expect(namer.meet('Brunilda', 'charla')).toBe(true);
        expect(namer.meet('Brunilda', 'charla')).toBe(false);
    });
});

describe('las ventanas preguntan aquí (shown-names.js)', () => {
    afterEach(() => setNamesSource(null));

    test('sin partida, cada uno con su nombre', () => {
        expect(shownName('Tomás')).toBe('Tomás');
        expect(shownKnows('Tomás')).toBe(true);
        expect(shownText('Hablar con {npc:tomas}')).toBe('Hablar con Tomas');
        expect(introFor('Tomás')).toBe('');
    });

    test('con partida: lo que sabe quien lleva la cuenta, y lo que se lee lo enseña', () => {
        let state = null;
        setNamesSource(() => createNamer({ state, people: PEOPLE, onLearn: (next) => { state = next; } }));
        expect(shownName('Tomás')).toBe('Posadero');
        expect(shownName('Tomás', 'el')).toBe('el posadero');
        expect(shownText('Le dices a {npc:tomas} que se aparte.')).toBe('Le dices al posadero que se aparte.');
        expect(shownText('Tomás grita.', { mask: true })).toBe('El posadero grita.');
        expect(hearLine({ who: 'Tomás', text: 'Soy Tomás.' })).toEqual([{ name: 'Tomás', how: 'presentado' }]);
        expect(shownName('Tomás')).toBe('Tomás');
    });

    test('si la fuente falla, el nombre de siempre', () => {
        setNamesSource(() => { throw new Error('roto'); });
        const original = console.error;
        console.error = () => {};
        try {
            expect(shownName('Tomás')).toBe('Tomás');
        } finally {
            console.error = original;
        }
    });
});

describe('el paquete lo dice', () => {
    test('`presenta` llega a las escenas, a las charlas y a los hitos de texto', () => {
        const beats = readSceneBeats([{ who: 'Nils', text: 'Ni un paso más.', presenta: true }]);
        expect(beats[0].presenta).toBe(true);
        const dialogue = readDialogue({ id: 'd', speaker: 'Nils', nodes: [{ id: 'a', line: 'Hola.', presenta: true }] });
        expect(dialogue?.nodes[0].presenta).toBe(true);
        const plot = readPlot({ milestones: [{ id: 'm', title: 'M', scene: 'Llega Sombra.', presenta: 'sombra', opens: { kind: 'start' } }] });
        expect(plot?.milestones[0].presenta).toBe('sombra');
    });

    test('el esquema y las reglas del Gem lo cuentan', () => {
        const schema = /** @type {any} */ (buildCampaignPackSchema());
        expect(schema.properties.npcs.items.properties.stranger).toBeTruthy();
        expect(schema.properties.npcs.items.properties.gender).toBeTruthy();
        expect(JSON.stringify(schema)).toContain('presenta');
        expect(getPackRules().some(rule => rule.includes('{npc:id}'))).toBe(true);
    });

    test('la partida guarda lo sabido, y vuelve con un punto de retorno', () => {
        expect(STATE_KEYS.find(entry => entry.key === 'knownPeople')?.kind).toBe('juego');
    });
});

describe('los paquetes del juego: nadie llama a nadie por un nombre que no sabe', () => {
    for (const id of ['gremio', '1387', 'strahd']) {
        test(`${id}: sin errores ni avisos`, () => {
            const { errors, warnings } = checkIntroductions(pack(id));
            expect(errors).toEqual([]);
            expect(warnings).toEqual([]);
        });
    }

    test('el prólogo del gremio: antes de presentarse, «Posadero» y ninguna opción le nombra; después, «Tomás»', () => {
        const gremio = pack('gremio');
        const people = packPeople(gremio);
        const namer = createNamer({ people });
        const [ratero, charla] = gremio.plot.milestones.filter((/** @type {any} */ m) => m.prologue);
        const plates = ratero.beats.map((/** @type {any} */ beat) => {
            namer.hear({ who: beat.who ?? '', text: beat.text, presenta: beat.presenta });
            return beat.who === 'Tomás' ? namer.name('Tomás') : '';
        }).filter(Boolean);
        expect(plates.length).toBeGreaterThan(0);
        expect(new Set(plates)).toEqual(new Set(['Posadero']));
        const options = ratero.beats.flatMap((/** @type {any} */ beat) => beat.options ?? []).map((/** @type {any} */ o) => o.text);
        expect(options.filter((/** @type {string} */ t) => /Tomás/.test(t))).toEqual([]);
        expect(namer.knows('Tomás')).toBe(false);
        const seen = charla.beats.map((/** @type {any} */ beat) => {
            namer.hear({ who: beat.who ?? '', text: beat.text, presenta: beat.presenta });
            return beat.who === 'Tomás' ? namer.name('Tomás') : '';
        }).filter(Boolean);
        expect(seen[0]).toBe('Tomás');
        expect(namer.state().people.tomas.how).toBe('presentado');
    });
});
