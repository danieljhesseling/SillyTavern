import { describe, test, expect } from '@jest/globals';
import {
    startTaller, addLocation, editLocation, removeLocation, locationsOf, pickedLocations,
    proposeLocations, addBoard, editBoard, removeBoard, blocksNext, toAnswers, pickCard,
    writeField, addFaction, editFaction, removeFaction, factionsOf, pickedFactions,
    addPerson, editPerson, removePerson, peopleOf, pickedPeople,
    addQuest, editQuest, removeQuest, questsOf, boardRulesOf, setBoardRules,
} from '../public/scripts/game-engine/campaign/taller.js';
import { createSeededRandom } from '../public/scripts/game-engine/combat/seeded-random.js';

const dado = (seed = 'sitios') => createSeededRandom(seed);

/** Un taller con el sitio de partida puesto, que es como llega al paso 3. */
const empezado = () => {
    let state = startTaller({ path: 'cero', random: dado() });
    state = writeField(state, 'worldName', 'Mi mundo');
    state = pickCard(state, 'mundo', 'dungeon', true);
    return addLocation(state, {
        name: 'Mazmorra clásica', type: 'tipo-cripta', biome: 'cueva', fixed: true,
    }).state;
};

describe('las localidades del mundo', () => {
    test('un taller recién abierto no tiene ninguna', () => {
        expect(locationsOf(startTaller({ path: 'cero', random: dado() }))).toEqual([]);
    });

    test('la de partida entra, y entra marcada', () => {
        const state = empezado();
        expect(locationsOf(state)).toHaveLength(1);
        expect(pickedLocations(state).map(l => l.name)).toEqual(['Mazmorra clásica']);
    });

    // Donde empieza el grupo no se puede quitar: sin tablero no hay partida.
    test('la de partida no se puede quitar', () => {
        const state = empezado();
        const id = locationsOf(state)[0].id;
        expect(locationsOf(removeLocation(state, id))).toHaveLength(1);
    });

    test('una escrita a mano sí, y entra marcada', () => {
        const { state, id } = addLocation(empezado(), { name: 'El Molino', type: 'tipo-aldea' });
        expect(pickedLocations(state).map(l => l.name)).toContain('El Molino');
        expect(locationsOf(removeLocation(state, id))).toHaveLength(1);
    });

    // El viaje empareja por nombre: dos sitios iguales son un mundo roto.
    test('dos sitios no se pueden llamar igual', () => {
        const state = addLocation(empezado(), { name: 'El Molino' }).state;
        const otra = addLocation(state, { name: 'El Molino' }).state;
        expect(blocksNext(otra, 'localidades')).toMatch(/El Molino/);
    });

    test('y un sitio sin nombre tampoco vale', () => {
        const state = addLocation(empezado(), { name: '   ' }).state;
        expect(blocksNext(state, 'localidades')).toMatch(/nombre/i);
    });

    test('con lo mínimo puesto, se pasa', () => {
        expect(blocksNext(empezado(), 'localidades')).toBe('');
    });

    test('editar cambia lo que dice', () => {
        const { state, id } = addLocation(empezado(), { name: 'El Molino' });
        const editado = editLocation(state, id, { name: 'El Molino Viejo', type: 'tipo-ciudad' });
        const found = locationsOf(editado).find(l => l.id === id);
        expect(found.name).toBe('El Molino Viejo');
        expect(found.type).toBe('tipo-ciudad');
    });

    test('quitar la marca la deja fuera sin borrarla', () => {
        const { state, id } = addLocation(empezado(), { name: 'El Molino' });
        const fuera = pickCard(state, 'localidades', id);
        expect(locationsOf(fuera)).toHaveLength(2);
        expect(pickedLocations(fuera).map(l => l.name)).not.toContain('El Molino');
    });

    test('no toca el estado que recibe', () => {
        const antes = empezado();
        addLocation(antes, { name: 'Otro' });
        expect(locationsOf(antes)).toHaveLength(1);
    });
});

describe('las que propone la semilla', () => {
    const vecinos = [
        { name: 'Ribera del Yunque', biome: 'camino', routes: [{ to: 'Mazmorra clásica', days: 2 }] },
        { name: 'Cañada de la Sal', biome: 'montana', routes: [] },
    ];

    // Lo que el juego iba a poner solo, ahora se ve y se puede tocar antes de crear nada.
    test('se añaden marcadas, con sus caminos', () => {
        const state = proposeLocations(empezado(), vecinos);
        expect(pickedLocations(state)).toHaveLength(3);
        expect(locationsOf(state)[1].routes).toHaveLength(1);
    });

    // Lo que tocas se queda.
    test('volver a proponer no pisa lo que has escrito tú', () => {
        let state = proposeLocations(empezado(), vecinos);
        const id = locationsOf(state)[1].id;
        state = editLocation(state, id, { name: 'Mi ribera' });

        const otra = proposeLocations(state, [{ name: 'Otra cosa', biome: 'llanura' }]);
        expect(locationsOf(otra).find(l => l.id === id).name).toBe('Mi ribera');
    });

    test('ni duplica lo que ya estaba', () => {
        const state = proposeLocations(proposeLocations(empezado(), vecinos), vecinos);
        expect(locationsOf(state).filter(l => l.name === 'Cañada de la Sal')).toHaveLength(1);
    });

    test('y sin vecinos que proponer, no pasa nada', () => {
        expect(locationsOf(proposeLocations(empezado(), []))).toHaveLength(1);
    });
});

describe('los tableros de cada sitio', () => {
    test('un sitio nuevo no trae ninguno', () => {
        const { state, id } = addLocation(empezado(), { name: 'El Molino' });
        expect(locationsOf(state).find(l => l.id === id).boards).toEqual([]);
    });

    test('se añaden al sitio que toca, no a otro', () => {
        const { state, id } = addLocation(empezado(), { name: 'El Molino' });
        const conTablero = addBoard(state, id, { name: 'La era', shape: 'camp' }).state;
        expect(locationsOf(conTablero).find(l => l.id === id).boards).toHaveLength(1);
        expect(locationsOf(conTablero)[0].boards).toHaveLength(0);
    });

    test('se editan y se quitan', () => {
        const { state, id } = addLocation(empezado(), { name: 'El Molino' });
        const puesto = addBoard(state, id, { name: 'La era', shape: 'camp' });
        const editado = editBoard(puesto.state, id, puesto.id, { name: 'El granero' });
        expect(locationsOf(editado).find(l => l.id === id).boards[0].name).toBe('El granero');

        const quitado = removeBoard(editado, id, puesto.id);
        expect(locationsOf(quitado).find(l => l.id === id).boards).toEqual([]);
    });

    // Entrar en un tablero se hace por nombre, igual que viajar.
    test('dos tableros del mismo sitio no se llaman igual', () => {
        const { state, id } = addLocation(empezado(), { name: 'El Molino' });
        let conDos = addBoard(state, id, { name: 'La era' }).state;
        conDos = addBoard(conDos, id, { name: 'La era' }).state;
        expect(blocksNext(conDos, 'tableros')).toMatch(/La era/);
    });

    test('pero en sitios distintos sí, que son sitios distintos', () => {
        const uno = addLocation(empezado(), { name: 'El Molino' });
        const dos = addLocation(uno.state, { name: 'La Ermita' });
        let state = addBoard(dos.state, uno.id, { name: 'La era' }).state;
        state = addBoard(state, dos.id, { name: 'La era' }).state;
        expect(blocksNext(state, 'tableros')).toBe('');
    });

    test('un sitio que no existe no acepta tableros', () => {
        const state = empezado();
        expect(addBoard(state, 'no-existe', { name: 'X' }).state).toBe(state);
    });
});

describe('lo que sale hacia la campaña', () => {
    // Si tocas la lista, lo que hayas puesto manda: los vecinos automáticos no se añaden.
    test('las localidades marcadas viajan en las respuestas', () => {
        let state = proposeLocations(empezado(), [{ name: 'El Molino', biome: 'camino' }]);
        state = addBoard(state, locationsOf(state)[0].id, { name: 'Entrada', shape: 'rooms' }).state;

        const answers = toAnswers(state);
        expect(answers.locations).toHaveLength(2);
        expect(answers.locations[0].name).toBe('Mazmorra clásica');
        expect(answers.locations[0].boards[0].name).toBe('Entrada');
    });

    test('lo que no está marcado no viaja', () => {
        const { state, id } = addLocation(empezado(), { name: 'El Molino' });
        expect(toAnswers(pickCard(state, 'localidades', id)).locations).toHaveLength(1);
    });

    // Sin tocar el paso 3, el mundo sigue naciendo con sus vecinos como hasta ahora.
    test('sin localidades escritas, las respuestas no las traen', () => {
        const state = writeField(startTaller({ path: 'cero', random: dado() }), 'worldName', 'X');
        expect(toAnswers(state).locations).toEqual([]);
    });
});

describe('un libro trae sus propios sitios', () => {
    // Su importador los coloca; los de aquí solo podrían pisarlos.
    test('las localidades del taller no viajan en el camino del libro', () => {
        let state = startTaller({ path: 'libro', source: { pack: { world: { name: 'X' } } }, random: dado() });
        state = writeField(state, 'worldName', 'X');
        state = addLocation(state, { name: 'Un sitio', fixed: true }).state;
        expect(toAnswers(state).locations).toEqual([]);
    });

    test('pero desde cero sí', () => {
        let state = startTaller({ path: 'cero', random: dado() });
        state = writeField(state, 'worldName', 'X');
        state = addLocation(state, { name: 'Un sitio', fixed: true }).state;
        expect(toAnswers(state).locations).toHaveLength(1);
    });
});

describe('las facciones del paso 9', () => {
    // Las de verdad: las que tienen meta, reloj y reputación.
    test('se añaden marcadas, con su meta', () => {
        const { state } = addFaction(empezado(), {
            name: 'Los del Molino', seat: 'Mazmorra clásica',
            goal: { kind: 'conquistar', target: 'La Ermita' },
        });
        expect(pickedFactions(state)).toHaveLength(1);
        expect(pickedFactions(state)[0].goal.kind).toBe('conquistar');
        expect(pickedFactions(state)[0].goal.of).toBeGreaterThan(0);
    });

    test('se editan, también su meta', () => {
        const { state, id } = addFaction(empezado(), { name: 'Los del Molino' });
        const editada = editFaction(state, id, {
            name: 'Los del Vado', goal: { kind: 'controlar', target: 'La Ermita' },
        });
        expect(factionsOf(editada)[0].name).toBe('Los del Vado');
        expect(factionsOf(editada)[0].goal.kind).toBe('controlar');
        // Editar la meta no borra lo demás de la meta.
        expect(factionsOf(editada)[0].goal.of).toBeGreaterThan(0);
    });

    test('y se quitan', () => {
        const { state, id } = addFaction(empezado(), { name: 'Los del Molino' });
        expect(factionsOf(removeFaction(state, id))).toEqual([]);
    });

    test('dos no se pueden llamar igual', () => {
        let state = addFaction(empezado(), { name: 'Los del Molino' }).state;
        state = addFaction(state, { name: 'Los del Molino' }).state;
        expect(blocksNext(state, 'facciones')).toMatch(/Los del Molino/);
    });

    // Un reloj que no llega a ninguna parte no es una meta.
    test('querer algo sin decir qué no vale', () => {
        const { state } = addFaction(empezado(), {
            name: 'Los del Molino', goal: { kind: 'conquistar', target: '' },
        });
        expect(blocksNext(state, 'facciones')).toMatch(/no dice qué/);
    });

    test('pero no querer nada sí: no todas tienen planes', () => {
        const { state } = addFaction(empezado(), { name: 'Los del Molino' });
        expect(blocksNext(state, 'facciones')).toBe('');
    });

    test('viajan hacia la campaña, y un libro trae las suyas', () => {
        const { state } = addFaction(empezado(), {
            name: 'Los del Molino', goal: { kind: 'conquistar', target: 'La Ermita' },
        });
        expect(toAnswers(state).factions).toHaveLength(1);

        let libro = startTaller({ path: 'libro', source: { pack: {} }, random: dado() });
        libro = writeField(libro, 'worldName', 'X');
        libro = addFaction(libro, { name: 'Los del Libro' }).state;
        expect(toAnswers(libro).factions).toEqual([]);
    });
});

describe('quien vive aquí y qué se cuenta', () => {
    test('la gente entra marcada y se edita', () => {
        const { state, id } = addPerson(empezado(), { name: 'Mira', title: 'la molinera' });
        expect(pickedPeople(state)).toHaveLength(1);
        expect(peopleOf(editPerson(state, id, { race: 'Enano' }))[0].race).toBe('Enano');
        expect(peopleOf(removePerson(state, id))).toEqual([]);
    });

    // Dos personas con el mismo nombre se pisan la entrada del Lorebook.
    test('dos personas no se pueden llamar igual', () => {
        let state = addPerson(empezado(), { name: 'Mira' }).state;
        state = addPerson(state, { name: 'Mira' }).state;
        expect(blocksNext(state, 'personajes')).toMatch(/Mira/);
    });

    test('y sin nombre tampoco vale', () => {
        expect(blocksNext(addPerson(empezado(), { name: '' }).state, 'personajes'))
            .toMatch(/sin nombre/i);
    });

    // El paso 12 no es escribir un tablón: son las pocas que dan el tono.
    test('las misiones escritas entran marcadas, con dónde y cuánto pagan', () => {
        const { state, id } = addQuest(empezado(), {
            title: 'Sacar lo que hay en el pozo', where: 'Mazmorra clásica', reward: 80, atStart: true,
        });
        expect(questsOf(state)).toHaveLength(1);
        expect(questsOf(state)[0].reward).toBe(80);
        expect(questsOf(editQuest(state, id, { title: 'Otra cosa' }))[0].title).toBe('Otra cosa');
        expect(questsOf(removeQuest(state, id))).toEqual([]);
    });

    test('una misión sin título no vale', () => {
        expect(blocksNext(addQuest(empezado(), { title: '' }).state, 'misiones'))
            .toMatch(/sin título/i);
    });

    // Un tablón que solo habla de facciones deja de ofrecer trabajo.
    test('los mandos del tablón traen lo de siempre si nadie los toca', () => {
        expect(boardRulesOf(empezado()).factionShare).toBe(3);
        expect(boardRulesOf(setBoardRules(empezado(), { factionShare: 5 })).factionShare).toBe(5);
        expect(boardRulesOf(setBoardRules(empezado(), { factionShare: 0 })).factionShare).toBe(1);
    });

    test('y todo eso viaja hacia la campaña', () => {
        let state = addPerson(empezado(), { name: 'Mira' }).state;
        state = addQuest(state, { title: 'El pozo' }).state;
        const answers = toAnswers(state);
        expect(answers.people).toHaveLength(1);
        expect(answers.quests).toHaveLength(1);
        expect(answers.board.factionShare).toBe(3);
    });
});
