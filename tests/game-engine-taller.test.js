import { describe, test, expect } from '@jest/globals';
import {
    PATHS, STEPS, stepById, walkableSteps, startTaller, writeField, isPinned, reroll,
    pickCard, pickedIn, isPicked, blocksNext, goNext, goBack, progressOf, toAnswers,
    PACK_STEPS, carriesPack, packContents,
} from '../public/scripts/game-engine/campaign/taller.js';
import { createSeededRandom } from '../public/scripts/game-engine/combat/seeded-random.js';

const dado = (seed = 'taller') => createSeededRandom(seed);
const desdeCero = () => startTaller({ path: 'cero', random: dado() });

describe('los trece pasos', () => {
    test('están los trece desde el primer día', () => {
        expect(STEPS).toHaveLength(13);
        expect(STEPS[0].id).toBe('mundo');
        expect(STEPS[STEPS.length - 1].id).toBe('jugabilidad');
    });

    test('cada uno dice para qué sirve, y ninguno se repite', () => {
        const ids = STEPS.map(s => s.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const step of STEPS) {
            expect(step.title).not.toBe('');
            expect(step.hint).not.toBe('');
        }
    });

    // Un mundo sin nombre no es un mundo.
    test('el primero no se puede saltar; los demás sí', () => {
        expect(stepById('mundo').optional).toBe(false);
        expect(STEPS.filter(s => s.optional).length).toBe(12);
    });

    // Un paso que se enseña vacío promete algo que no pasa. Ya están los trece, así que
    // se recorren los trece — y si alguno se apagara, el recorrido lo saltaría solo.
    test('solo se recorren los que están hechos, y ya están todos', () => {
        expect(walkableSteps().every(s => s.built)).toBe(true);
        expect(walkableSteps()).toHaveLength(STEPS.length);
    });

    test('y un id que no existe no es un paso', () => {
        expect(stepById('inventado')).toBe(null);
    });
});

describe('empezar por uno de los tres caminos', () => {
    test('los tres existen, y lo que no es ninguno empieza desde cero', () => {
        expect(PATHS).toEqual(['cero', 'mundo', 'libro']);
        expect(startTaller({ path: 'vete a saber', random: dado() }).path).toBe('cero');
    });

    // Desde cero: la semilla la tira el juego.
    test('desde cero se tira una semilla nueva', () => {
        const state = desdeCero();
        expect(state.fields.seed).toMatch(/^[a-z]+-[a-z]+-[a-z]+$/);
        expect(state.seedRolled).toBe(true);
    });

    // El mundo *es* esa semilla: dos personas que jueguen «el de Lovecraft» ven lo mismo.
    test('un mundo precreado trae la suya, y se respeta', () => {
        const state = startTaller({
            path: 'mundo',
            source: { name: 'La costa que no duerme', seed: 'sal-niebla-tres', genre: 'Terror' },
            random: dado(),
        });
        expect(state.fields.seed).toBe('sal-niebla-tres');
        expect(state.fields.worldName).toBe('La costa que no duerme');
        expect(state.fields.genre).toBe('Terror');
        expect(state.seedRolled).toBe(false);
    });

    // Si el archivo no la trae, deja de ser el mismo mundo para todos: hay que saberlo.
    test('y si el mundo no trae semilla, se tira y se dice', () => {
        const state = startTaller({ path: 'mundo', source: { name: 'Sin semilla' }, random: dado() });
        expect(state.fields.seed).not.toBe('');
        expect(state.seedRolled).toBe(true);
    });

    // Importar tiene que ser reproducible.
    test('un libro con semilla la conserva', () => {
        const state = startTaller({
            path: 'libro',
            source: { metadata: { displayName: 'El Molino', seed: 'vado-hueso-dos' } },
            random: dado(),
        });
        expect(state.fields.seed).toBe('vado-hueso-dos');
        expect(state.fields.worldName).toBe('El Molino');
    });
});

describe('lo que tocas se queda', () => {
    test('escribir un campo lo fija', () => {
        const state = writeField(desdeCero(), 'worldName', 'Mi mundo');
        expect(state.fields.worldName).toBe('Mi mundo');
        expect(isPinned(state, 'worldName')).toBe(true);
        expect(isPinned(state, 'genre')).toBe(false);
    });

    // El botón de volver a tirar no puede borrarte nada escrito.
    test('volver a tirar cambia la semilla y no toca lo escrito', () => {
        const escrito = writeField(desdeCero(), 'worldName', 'Mi mundo');
        const otra = reroll(escrito, dado('otra'));
        expect(otra.fields.seed).not.toBe(escrito.fields.seed);
        expect(otra.fields.worldName).toBe('Mi mundo');
        expect(isPinned(otra, 'worldName')).toBe(true);
    });

    test('y la semilla tirada no cuenta como escrita a mano', () => {
        expect(isPinned(reroll(desdeCero(), dado('x')), 'seed')).toBe(false);
    });

    test('pero si la escribes tú, se queda', () => {
        const mia = writeField(desdeCero(), 'seed', 'molino-ceniza-siete');
        expect(isPinned(mia, 'seed')).toBe(true);
        expect(mia.fields.seed).toBe('molino-ceniza-siete');
    });

    test('no toca el estado que recibe', () => {
        const antes = desdeCero();
        writeField(antes, 'worldName', 'Otro');
        expect(antes.fields.worldName).toBe('');
    });
});

describe('marcar tarjetas', () => {
    test('marcar y desmarcar', () => {
        let state = pickCard(desdeCero(), 'bestiario', 'lobo');
        expect(isPicked(state, 'bestiario', 'lobo')).toBe(true);
        state = pickCard(state, 'bestiario', 'lobo');
        expect(isPicked(state, 'bestiario', 'lobo')).toBe(false);
    });

    test('se pueden marcar varias', () => {
        let state = pickCard(desdeCero(), 'bestiario', 'lobo');
        state = pickCard(state, 'bestiario', 'oso');
        expect(pickedIn(state, 'bestiario')).toEqual(['lobo', 'oso']);
    });

    // El paso 1 es de una sola: no empiezas en dos sitios.
    test('donde solo cabe una, la nueva sustituye a la vieja', () => {
        let state = pickCard(desdeCero(), 'mundo', 'cripta', true);
        state = pickCard(state, 'mundo', 'taberna', true);
        expect(pickedIn(state, 'mundo')).toEqual(['taberna']);
    });

    test('un id repetido en dos pasos no se pisa', () => {
        let state = pickCard(desdeCero(), 'bestiario', 'lobo');
        state = pickCard(state, 'personajes', 'lobo');
        expect(pickedIn(state, 'bestiario')).toEqual(['lobo']);
        expect(pickedIn(state, 'personajes')).toEqual(['lobo']);
    });

    test('y un paso sin nada marcado no revienta', () => {
        expect(pickedIn(desdeCero(), 'lo que sea')).toEqual([]);
        expect(isPicked(null, 'x', 'y')).toBe(false);
    });
});

describe('pasar de paso', () => {
    // Un botón apagado que no dice por qué es la forma más rápida de cerrar la ventana.
    test('sin nombre no se pasa, y se dice', () => {
        expect(blocksNext(desdeCero(), 'mundo')).toMatch(/nombre/i);
    });

    test('desde cero hay que elegir con qué sitio se empieza', () => {
        const conNombre = writeField(desdeCero(), 'worldName', 'Mi mundo');
        expect(blocksNext(conNombre, 'mundo')).toMatch(/sitio/i);
        expect(blocksNext(pickCard(conNombre, 'mundo', 'cripta', true), 'mundo')).toBe('');
    });

    test('y en un mundo precreado, cuál', () => {
        const state = startTaller({ path: 'mundo', source: { name: 'X', seed: 'a-b-c' }, random: dado() });
        expect(blocksNext(state, 'mundo')).toMatch(/mundos/i);
    });

    test('el paso 2 no bloquea nada: se puede jugar sin narrador', () => {
        expect(blocksNext(desdeCero(), 'narrador')).toBe('');
    });

    test('avanzar devuelve el motivo en vez de moverse a medias', () => {
        const { state, reason } = goNext(desdeCero());
        expect(reason).toMatch(/nombre/i);
        expect(state.at).toBe(0);
    });

    test('y con todo puesto, avanza', () => {
        let state = writeField(desdeCero(), 'worldName', 'Mi mundo');
        state = pickCard(state, 'mundo', 'cripta', true);
        const paso = goNext(state);
        expect(paso.reason).toBe('');
        expect(paso.state.at).toBe(1);
        expect(paso.done).toBe(false);
    });

    test('atrás nunca se sale por abajo', () => {
        expect(goBack(desdeCero()).at).toBe(0);
    });

    test('el último dice que ha terminado', () => {
        let state = writeField(desdeCero(), 'worldName', 'Mi mundo');
        state = pickCard(state, 'mundo', 'cripta', true);
        for (let i = 0; i < walkableSteps().length; i++) state = goNext(state).state;
        expect(goNext(state).done).toBe(true);
    });
});

describe('por dónde va', () => {
    // Decir «2 de 2» cuando quedan once por hacer es mentir en la única pantalla que dice
    // cuánto falta.
    test('cuenta sobre los trece, no sobre los hechos', () => {
        const dicho = progressOf(desdeCero());
        expect(dicho.of).toBe(13);
        expect(dicho.at).toBe(1);
        expect(dicho.said).toBe('Paso 1 de 13');
    });

    test('y el segundo paso es el segundo de los trece', () => {
        expect(progressOf({ at: 1 }).step.id).toBe('narrador');
    });
});

describe('el puente con lo que ya hay', () => {
    // Mientras el taller crece, lo de abajo no cambia ni una línea.
    test('sale exactamente lo que el creador de campañas espera', () => {
        let state = writeField(desdeCero(), 'worldName', 'Mi mundo');
        state = writeField(state, 'genre', 'Terror');
        state = pickCard(state, 'mundo', 'cripta', true);

        expect(Object.keys(toAnswers(state)).sort()).toEqual([
            'board', 'description', 'factions', 'generatedTemplate', 'genre',
            'importedPack', 'locations', 'narrator', 'party', 'people', 'picks', 'quests',
            'seed', 'survival', 'templateId', 'worldName', 'writeWorld',
        ]);
    });

    test('la tarjeta elegida en el paso 1 es la plantilla', () => {
        const state = pickCard(desdeCero(), 'mundo', 'taberna', true);
        expect(toAnswers(state).templateId).toBe('taberna');
    });

    test('la semilla sale limpia, escriba lo que escriba quien la teclee', () => {
        const state = writeField(desdeCero(), 'seed', '  Molino Ceniza SIETE!  ');
        expect(toAnswers(state).seed).toBe('molino-ceniza-siete');
    });

    test('un libro viaja con su paquete; los otros caminos no', () => {
        const libro = startTaller({ path: 'libro', source: { pack: { hola: 1 } }, random: dado() });
        expect(toAnswers(libro).importedPack).toEqual({ hola: 1 });
        expect(toAnswers(desdeCero()).importedPack).toBe(null);
    });

    test('un mundo precreado con paquete viaja con él, y conserva su semilla', () => {
        const mundo = startTaller({ path: 'mundo', random: dado() });
        const escrito = { ...writeField(mundo, 'seed', 'sal-niebla-tres'),
            source: { pack: { world: { name: 'La costa' } }, templateId: 'imported' } };
        const answers = toAnswers(escrito);
        expect(carriesPack(escrito)).toBe(true);
        expect(answers.templateId).toBe('imported');
        expect(answers.importedPack).toEqual({ world: { name: 'La costa' } });
        expect(answers.seed).toBe('sal-niebla-tres');
        // Lo que trae el paquete no se elige en el taller: su importador lo pone.
        expect(answers.locations).toEqual([]);
        expect(answers.factions).toEqual([]);
        expect(answers.people).toEqual([]);
    });

    test('sin paquete, un mundo precreado sigue siendo el de siempre', () => {
        const mundo = startTaller({ path: 'mundo', random: dado() });
        expect(carriesPack(mundo)).toBe(false);
        expect(toAnswers(mundo).importedPack).toBe(null);
    });

    test('lo que trae el paquete, paso por paso, en nombres', () => {
        const pack = {
            world: { factions: [{ name: 'La Orden' }] },
            locations: [{ name: 'El Molino' }, { name: 'El Vado' }],
            boards: [{ name: 'Planta baja' }],
            confidants: [{ name: 'Mira' }],
            quests: [{ name: 'El sótano' }],
        };
        expect(packContents(pack, 'localidades')).toEqual(['El Molino', 'El Vado']);
        expect(packContents(pack, 'tableros')).toEqual(['Planta baja']);
        expect(packContents(pack, 'facciones')).toEqual(['La Orden']);
        expect(packContents(pack, 'personajes')).toEqual(['Mira']);
        expect(packContents(pack, 'misiones')).toEqual(['El sótano']);
        expect(packContents(pack, 'razas')).toEqual([]);
        expect(PACK_STEPS.every(id => STEPS.some(step => step.id === id))).toBe(true);
    });

    test('y el grupo va vacío: el personaje se hace al entrar', () => {
        expect(toAnswers(desdeCero()).party).toEqual([]);
    });
});
