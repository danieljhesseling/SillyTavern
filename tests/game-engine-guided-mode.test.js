/**
 * D-J62, el modo guiado: sin la fila de acciones libres, sin «Tableros de aquí» ni «Viajar»; se va
 * adonde manda la historia, y a cada tablero de los paquetes se llega por una conversación, un
 * encargo o un hito.
 */
import fs from 'node:fs';
import { describe, test, expect, afterEach } from '@jest/globals';
import {
    GUIDED_MODE, guidedOn, keptInGuided, guidedRow, sightHome, spreadLooks, storySteps, boardOnArrival,
    boardsByTalk, boardLinks, unreachableBoards, SECRET_WHY, RUMOR_WHY,
} from '../public/scripts/game-engine/campaign/guided-mode.js';
import { reachFrom } from '../public/scripts/game-engine/world/travel.js';
import { buildActionChips } from '../public/scripts/game-engine/ui/shell/action-chips.js';
import { readPlot } from '../public/scripts/game-engine/campaign/plot.js';
import { readDialogues, checkDialogues, EFFECT_KINDS } from '../public/scripts/game-engine/campaign/dialogues.js';
import { applySceneEffects } from '../public/scripts/game-engine/campaign/plot-scenes.js';
import { buildImportPlan } from '../public/scripts/game-engine/campaign/campaign-importer.js';
import { validatePack } from '../public/scripts/game-engine/campaign/campaign-pack.js';
import { createCompendium } from '../public/scripts/game-engine/compendio/compendio.js';
import { seedCampaignPack } from '../public/scripts/game-engine/campaign/seed-pack.js';

const read = (/** @type {string} */ path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'));
const GREMIO = read('../public/mundos/gremio.pack.json');
const P1387 = read('../public/mundos/1387.pack.json');
const STRAHD = read('../public/mundos/strahd.pack.json');
const battery = (/** @type {string} */ name) => read(`../public/compendio/${name}.json`).rows;
const compendium = () => createCompendium(Object.fromEntries(
    ['actos', 'nombres', 'mundo', 'facciones', 'bestiario', 'frases'].map(d => [d, battery(d)]),
));
const SEEDS = read('../public/mundos/mundos.json').worlds.filter((/** @type {any} */ w) => !w.pack);

afterEach(() => {
    GUIDED_MODE.on = true;
});

describe('el interruptor', () => {
    test('manda solo sin conexión, y se apaga en un sitio', () => {
        expect(guidedOn(true)).toBe(true);
        expect(guidedOn(false)).toBe(false);
        GUIDED_MODE.on = false;
        expect(guidedOn(true)).toBe(false);
    });
});

describe('la fila de abajo, guiada', () => {
    test('la fila de Puerto Alba de la captura se queda vacía: el gremio, mirar, los rumores y «+N más» se esconden', () => {
        const chips = buildActionChips({
            limit: Infinity,
            hub: [
                { id: 'hub-board', label: 'Tablón de campañas', icon: 'fa-scroll', command: '/campanas' },
                { id: 'hub-hire', label: 'Contratar mercenarios', icon: 'fa-coins', command: '/contratar' },
                { id: 'hub-errands', label: 'Encargos del tablón', icon: 'fa-clipboard-list', command: '/encargos-gremio' },
                { id: 'hub-heroes', label: 'Tus personajes', icon: 'fa-users', command: '/personajes' },
            ],
            extras: [
                { id: 'look:avisos', label: 'Leer los avisos clavados en la lonja', icon: 'fa-eye', command: '/examinar avisos' },
                { id: 'look:redes', label: 'Escuchar a los pescadores que remiendan redes', icon: 'fa-eye', command: '/examinar redes' },
            ],
            rumors: 2,
            people: [{ name: 'Tomás' }],
            boards: [{ name: 'La bodega del gremio' }],
            places: [{ name: 'La cala del norte' }],
            explore: true,
            forage: true,
            social: [{ id: 'charlar:gerd', label: 'Charlar con Gerd', icon: 'fa-comments', command: '/charlar Gerd' }],
        });
        expect(chips.length).toBeGreaterThan(8);
        expect(guidedRow(chips)).toEqual([]);
    });

    test('en un tablero se queda lo del tablero: puertas, trampas, la escalera, salir y volver al gremio', () => {
        const chips = buildActionChips({
            limit: Infinity,
            hasBoard: true,
            stairs: true,
            doors: [{ x: 1, y: 1, distance: 5 }],
            traps: [{ id: 'trap-search', label: 'Buscar trampas', icon: 'fa-magnifying-glass' }],
            hub: [{ id: 'hub-home', label: 'Volver al gremio', icon: 'fa-house-flag', command: '/volver-gremio' }],
            boards: [{ name: 'La bodega' }],
            thread: ['La bodega'],
            board: 'El muelle',
        });
        const kept = guidedRow(chips).map(c => c.id);
        expect(kept).toEqual(expect.arrayContaining(['stairs', 'door:1,1', 'trap-search', 'hub-home', 'leave']));
        expect(kept.some(id => id.startsWith('enter:'))).toBe(false);
    });

    test('lo que se le contesta a quien habla, los prisioneros y la magia que sirve aquí se quedan', () => {
        for (const id of ['reply-bye', 'prisoner:ask:1', 'field-heal', 'field-magic', 'offer:o1', 'story:go:X']) expect(keptInGuided({ id })).toBe(true);
        for (const id of ['hub-board', 'hub-sleep', 'look:x', 'rumor', 'more', 'enter:X', 'go:X', 'explore', 'forage', 'camp', 'talk-local:Tomás', 'typed:persuasion', '']) {
            expect(keptInGuided({ id })).toBe(false);
        }
    });

    test('caben pocas, sin «+N más»', () => {
        const doors = Array.from({ length: 9 }, (_, i) => ({ id: `door:${i},0` }));
        expect(guidedRow(doors)).toHaveLength(6);
        expect(guidedRow(doors, 2)).toHaveLength(2);
    });
});

describe('lo de mirar, en su sitio', () => {
    const PUERTO = ['gremio', 'herreria', 'posada', 'tienda', 'templo', 'muelle'];

    test('los avisos de la lonja, en el mercado; las barcas y los pescadores, en el muelle', () => {
        expect(sightHome('Leer los avisos clavados en la lonja', PUERTO)).toBe('tienda');
        expect(sightHome('Mirar las barcas del muelle', PUERTO)).toBe('muelle');
        expect(sightHome('Escuchar a los pescadores que remiendan redes', PUERTO)).toBe('muelle');
        expect(sightHome('Mirar el faro de la punta, al caer la tarde', PUERTO)).toBe('muelle');
        expect(sightHome('Escuchar lo que se habla en la barra', PUERTO)).toBe('posada');
    });

    test('sin pista, a la plaza o a la taberna; sin sitios, a ninguno', () => {
        expect(sightHome('Mirar el cielo', ['herreria', 'plaza'])).toBe('plaza');
        expect(sightHome('Mirar el cielo', ['herreria', 'posada'])).toBe('posada');
        expect(sightHome('Mirar el cielo', ['herreria'])).toBe('herreria');
        expect(sightHome('Mirar el cielo', [])).toBe('');
        // Sin muelle en el pueblo, lo del puerto va adonde se oye de todo.
        expect(sightHome('Mirar las barcas del muelle', ['posada', 'herreria'])).toBe('posada');
    });

    test('se reparten por sitio', () => {
        const out = spreadLooks([{ label: 'Leer los avisos clavados en la lonja' }, { label: 'Mirar las barcas del muelle' }], PUERTO);
        expect(out.tienda).toHaveLength(1);
        expect(out.muelle).toHaveLength(1);
    });
});

/** Un mundo pequeño: el pueblo, la granja (vecina) y el castillo (pasando por la granja). */
const WORLD = [
    { name: 'El Pueblo', boards: [{ name: 'El callejón', enemyPlacements: [{ name: 'Garth', x: 1, y: 1 }] }, { name: 'El salón', enemyPlacements: [] }] },
    { name: 'La Granja', boards: [{ name: 'El granero', enemyPlacements: [{ name: 'Lobo famélico', x: 2, y: 2 }] }] },
    { name: 'El Castillo', boards: [{ name: 'Las puertas', enemyPlacements: [{ name: 'Sombra, el espía', x: 2, y: 2 }] }] },
];
const REACH = {
    'La Granja': { reach: 'near', days: 1 },
    'El Castillo': { reach: 'far', days: 3, via: 'La Granja', reason: '' },
    'El Paso': { reach: 'shut', days: 2, reason: 'Se abre en invierno.' },
};
/** @param {any} milestone */
const plotWith = (milestone) => ({ milestones: [{ id: 'm', title: 'El hito', act: 1, ...milestone }], state: { open: ['m'] } });

describe('lo que pide la historia', () => {
    test('ganar en otro sitio: «Ir a…» con quién lo pide, y el tablero que espera allí', () => {
        const [step] = storySteps({ ...plotWith({ asks: { kind: 'win', board: 'El granero' } }), here: 'El Pueblo', locations: WORLD, reach: REACH });
        expect(step).toMatchObject({ id: 'story:go:La Granja', kind: 'go', label: 'Ir a La Granja', place: 'La Granja', board: 'El granero', enabled: true });
        expect(step.detail).toBe('Lo pide la historia: El hito · 1 día de viaje');
    });

    test('lejos: al primer sitio del camino, diciendo adónde se va', () => {
        const [step] = storySteps({ ...plotWith({ asks: { kind: 'defeat', enemy: 'Sombra' } }), here: 'El Pueblo', locations: WORLD, reach: REACH });
        expect(step).toMatchObject({ kind: 'go', place: 'La Granja', target: 'El Castillo' });
        expect(step.detail).toContain('De camino a El Castillo');
        expect(step.board).toBeUndefined();
    });

    test('un camino cerrado se enseña apagado y con su motivo; un sitio que no sale en el mapa, no', () => {
        const [shut] = storySteps({ ...plotWith({ asks: { kind: 'arrive', place: 'El Paso' } }), here: 'El Pueblo', locations: WORLD, reach: REACH });
        expect(shut.enabled).toBe(false);
        expect(shut.detail).toContain('Se abre en invierno.');
        expect(storySteps({ ...plotWith({ asks: { kind: 'arrive', place: 'La Cueva Escondida' } }), here: 'El Pueblo', locations: WORLD, reach: REACH })).toEqual([]);
    });

    test('el tablero de aquí: «Ir a…», salvo el abierto, uno ganado o uno al que ya lleva una conversación', () => {
        const input = { ...plotWith({ asks: { kind: 'win', board: 'El callejón' } }), here: 'El Pueblo', locations: WORLD, reach: REACH };
        expect(storySteps(input)).toEqual([expect.objectContaining({ id: 'story:board:El callejón', kind: 'board', label: 'Ir a El callejón', board: 'El callejón' })]);
        expect(storySteps({ ...input, board: 'El callejón' })).toEqual([]);
        expect(storySteps({ ...input, won: (_place, board) => board === 'El callejón' })).toEqual([]);
        expect(storySteps({ ...input, talked: ['el callejón'] })).toEqual([]);
    });

    test('ganado con la misión a medias (falta salir por la ventana): se vuelve a él, diciendo lo que falta', () => {
        const input = { ...plotWith({ asks: { kind: 'win', board: 'El callejón' } }), here: 'El Pueblo', locations: WORLD, reach: REACH, won: () => true };
        expect(storySteps(input)).toEqual([]);
        const [back] = storySteps({ ...input, unfinished: { 'El callejón': 'Salir por la ventana' } });
        expect(back).toMatchObject({ id: 'story:board:El callejón', kind: 'board', label: 'Ir a El callejón', board: 'El callejón', enabled: true });
        expect(back.detail).toBe('Lo pide la historia: El hito · Falta: Salir por la ventana');
        // Estando en él, no; y al llegar de lejos, se entra solo.
        expect(storySteps({ ...input, board: 'El callejón', unfinished: { 'El callejón': 'Salir por la ventana' } })).toEqual([]);
        expect(boardOnArrival({ ...input, unfinished: { 'el callejón': '' } })).toBe('El callejón');
    });

    test('un rumor oído que dice dónde está algo: «Ir a…», detrás de lo que pide la historia', () => {
        const [go] = storySteps({ here: 'El Pueblo', locations: WORLD, reach: REACH, leads: ['La Granja'] });
        expect(go).toMatchObject({ id: 'story:go:La Granja', kind: 'go', label: 'Ir a La Granja', detail: `${RUMOR_WHY} · 1 día de viaje`, enabled: true });
        expect(storySteps({ here: 'El Pueblo', locations: WORLD, reach: REACH, leads: ['El Castillo'] })[0]).toMatchObject({ place: 'La Granja', target: 'El Castillo', detail: `${RUMOR_WHY}. De camino a El Castillo` });
        // Un camino cerrado, un sitio que no sale en el mapa, aquí mismo o en un tablero: nada.
        expect(storySteps({ here: 'El Pueblo', locations: WORLD, reach: REACH, leads: ['El Paso', 'La Cueva', 'El Pueblo'] })).toEqual([]);
        expect(storySteps({ here: 'El Pueblo', board: 'El callejón', locations: WORLD, reach: REACH, leads: ['La Granja'] })).toEqual([]);
        // Si la historia ya manda allí, un solo botón, el de la historia.
        const both = storySteps({ ...plotWith({ asks: { kind: 'arrive', place: 'La Granja' } }), here: 'El Pueblo', locations: WORLD, reach: REACH, leads: ['La Granja'] });
        expect(both.map(s => s.detail)).toEqual(['Lo pide la historia: El hito · 1 día de viaje']);
    });

    test('un secreto no manda a ninguna parte; estando en su sitio, su pelea se ve, sin entrar sola al llegar', () => {
        const secret = { milestones: [{ id: 's', title: 'El mapa del explorador', act: 1, hidden: true, asks: { kind: 'win', board: 'El granero' } }], state: { open: ['s'] }, locations: WORLD };
        expect(storySteps({ ...secret, here: 'El Pueblo', reach: REACH })).toEqual([]);
        const [there] = storySteps({ ...secret, here: 'La Granja', reach: {} });
        expect(there).toMatchObject({ id: 'story:board:El granero', kind: 'board', board: 'El granero', secret: true, detail: SECRET_WHY });
        expect(there.detail).not.toContain('El mapa del explorador');
        expect(boardOnArrival({ ...secret, here: 'La Granja', reach: {} })).toBe('');
        // Si la historia también lo pide, va como lo que pide la historia (y al llegar se entra).
        const both = { ...secret, milestones: [{ id: 'm', title: 'El hito', act: 1, asks: { kind: 'win', board: 'El granero' } }, ...secret.milestones], state: { open: ['m', 's'] } };
        expect(storySteps({ ...both, here: 'La Granja', reach: {} })).toEqual([expect.objectContaining({ detail: 'Lo pide la historia: El hito' })]);
        expect(storySteps({ ...both, here: 'La Granja', reach: {} })[0].secret).toBeUndefined();
        expect(boardOnArrival({ ...both, here: 'La Granja', reach: {} })).toBe('El granero');
    });

    test('hablar con alguien: si está en otro sitio, ir allí; si está aquí, «Hablar con…», como se le conoce', () => {
        const steps = storySteps({ ...plotWith({ asks: { kind: 'talk', npc: 'Marta' } }), here: 'El Pueblo', locations: WORLD, reach: REACH, where: { Marta: 'La Granja' } });
        expect(steps.map(s => s.id)).toEqual(['story:go:La Granja']);
        const here = { ...plotWith({ asks: { kind: 'talk', npc: 'Marta' } }), here: 'La Granja', locations: WORLD, reach: {}, where: { Marta: 'La Granja' } };
        expect(storySteps(here)).toEqual([{ id: 'story:talk:Marta', kind: 'talk', label: 'Hablar con Marta', detail: 'Lo pide la historia: El hito', enabled: true, npc: 'Marta' }]);
        expect(storySteps({ ...here, called: () => 'la granjera' })[0].label).toBe('Hablar con la granjera');
        // En un tablero, no: allí se pelea.
        expect(storySteps({ ...here, board: 'El granero' })).toEqual([]);
    });

    test('una tirada: donde pasa su escena; sin «Tirada» suelta, es por donde se intenta', () => {
        const milestone = { asks: { kind: 'check', skill: 'persuasion' }, backdrop: 'La Granja' };
        expect(storySteps({ ...plotWith(milestone), here: 'El Pueblo', locations: WORLD, reach: REACH })[0].kind).toBe('go');
        const [here] = storySteps({ ...plotWith(milestone), here: 'La Granja', locations: WORLD, reach: {} });
        expect(here).toMatchObject({ id: 'story:check:persuasion', kind: 'check', skill: 'persuasion', label: 'Intentarlo (Persuasión)' });
        // En un tablero, no: allí se pelea.
        expect(storySteps({ ...plotWith(milestone), here: 'La Granja', board: 'El granero', locations: WORLD, reach: {} })).toEqual([]);
    });

    test('unas pistas: solo las que faltan', () => {
        const milestone = { asks: { kind: 'clues', need: 1, clues: [{ place: 'El Pueblo', skill: 'investigation' }, { place: 'La Granja', skill: 'survival' }] } };
        const steps = storySteps({ milestones: [{ id: 'm', title: 'Pistas', act: 1, ...milestone }], state: { open: ['m'], clues: { m: [0] } }, here: 'El Pueblo', locations: WORLD, reach: REACH });
        expect(steps.map(s => s.id)).toEqual(['story:go:La Granja']);
        const there = storySteps({ milestones: [{ id: 'm', title: 'Pistas', act: 1, ...milestone }], state: { open: ['m'] }, here: 'El Pueblo', locations: WORLD, reach: REACH });
        expect(there[0]).toMatchObject({ kind: 'check', skill: 'investigation', label: 'Buscar una pista (Investigación)' });
    });

    test('un encargo aceptado: «Ir a…» con quién lo pide; en su sitio, su tablero; sin pelea, hablando', () => {
        const taken = { title: 'Noche en la granja', patron: 'Marta', locationName: 'La Granja', boardName: 'El granero' };
        const [go] = storySteps({ here: 'El Pueblo', locations: WORLD, reach: REACH, taken });
        expect(go).toMatchObject({ kind: 'go', place: 'La Granja', board: 'El granero' });
        expect(go.detail).toBe('El encargo de Marta: Noche en la granja · 1 día de viaje');
        expect(storySteps({ here: 'La Granja', locations: WORLD, reach: {}, taken })[0]).toMatchObject({ kind: 'board', board: 'El granero' });
        expect(storySteps({ here: 'La Granja', locations: WORLD, reach: {}, taken: { ...taken, boardName: '', noFight: true } })[0])
            .toMatchObject({ kind: 'check', skill: 'persuasion', label: 'Resolverlo hablando (Persuasión)' });
        // Uno generado se juega en su tablero «(encargo)».
        const made = { title: 'Ratas', patron: 'Tomás', locationName: 'El Pueblo' };
        const world = [{ name: 'El Pueblo', boards: [{ name: 'Ratas (encargo)', enemyPlacements: [{ name: 'Rata' }] }] }];
        expect(storySteps({ here: 'El Pueblo', locations: world, reach: {}, taken: made })[0]).toMatchObject({ kind: 'board', board: 'Ratas (encargo)' });
    });

    test('lo oculto no se dice, y dos motivos para el mismo sitio van juntos', () => {
        expect(storySteps({ ...plotWith({ hidden: true, asks: { kind: 'arrive', place: 'La Granja' } }), here: 'El Pueblo', locations: WORLD, reach: REACH })).toEqual([]);
        const steps = storySteps({
            milestones: [{ id: 'a', title: 'Uno', act: 1, asks: { kind: 'arrive', place: 'La Granja' } }, { id: 'b', title: 'Dos', act: 1, asks: { kind: 'win', board: 'El granero' } }],
            state: { open: ['a', 'b'] }, here: 'El Pueblo', locations: WORLD, reach: REACH,
        });
        expect(steps).toHaveLength(1);
        expect(steps[0].detail).toContain('Uno');
        expect(steps[0].detail).toContain('Dos');
    });

    test('fuera del pueblo de donde se sale, siempre se puede volver; no en un tablero, ni estando en él', () => {
        const back = storySteps({ here: 'La Granja', locations: WORLD, reach: { 'El Pueblo': { reach: 'near', days: 1 } }, home: 'El Pueblo' });
        expect(back).toEqual([expect.objectContaining({ id: 'story:go:El Pueblo', label: 'Volver a El Pueblo', place: 'El Pueblo', enabled: true })]);
        expect(back[0].detail).toBe('De vuelta al pueblo · 1 día de viaje');
        const far = storySteps({ here: 'El Castillo', locations: WORLD, reach: { 'El Pueblo': { reach: 'far', days: 3, via: 'La Granja' } }, home: 'El Pueblo' });
        expect(far[0]).toMatchObject({ label: 'Ir a La Granja', detail: 'De vuelta a El Pueblo', target: 'El Pueblo' });
        expect(storySteps({ here: 'La Granja', board: 'El granero', locations: WORLD, reach: { 'El Pueblo': { reach: 'near', days: 1 } }, home: 'El Pueblo' })).toEqual([]);
        expect(storySteps({ here: 'El Pueblo', locations: WORLD, reach: REACH, home: 'El Pueblo' })).toEqual([]);
        // Si la historia ya manda allí, un solo botón, con su porqué.
        const both = storySteps({ ...plotWith({ asks: { kind: 'arrive', place: 'El Pueblo' } }), here: 'La Granja', locations: WORLD, reach: { 'El Pueblo': { reach: 'near', days: 1 } }, home: 'El Pueblo' });
        expect(both).toHaveLength(1);
        expect(both[0].detail).toBe('Lo pide la historia: El hito · 1 día de viaje');
    });

    test('al llegar, el tablero de la pelea: el que se buscaba, aunque una conversación también lleve a él', () => {
        const input = { ...plotWith({ asks: { kind: 'win', board: 'El granero' } }), here: 'La Granja', locations: WORLD, reach: {}, talked: ['El granero'] };
        expect(boardOnArrival(input)).toBe('El granero');
        expect(boardOnArrival({ ...input, wanted: 'El granero' })).toBe('El granero');
        expect(boardOnArrival({ ...input, won: () => true })).toBe('');
        expect(boardOnArrival({ ...plotWith({ asks: { kind: 'arrive', place: 'La Granja' } }), here: 'La Granja', locations: WORLD, reach: {} })).toBe('');
    });
});

describe('el prólogo: a la bodega se baja hablando con Brunilda', () => {
    const milestones = /** @type {any} */ (readPlot(GREMIO.plot)).milestones;
    const plan = buildImportPlan(GREMIO);
    const talked = [...boardsByTalk(readDialogues(GREMIO.dialogues)), ...boardsByTalk(milestones)];

    test('la escena de la prueba acaba con «Bajo a la bodega», y la charla de Brunilda lo ofrece mientras la prueba está abierta', () => {
        const prueba = GREMIO.plot.milestones.find((/** @type {any} */ m) => m.id === 'la-prueba');
        const last = prueba.beats[prueba.beats.length - 1];
        expect(last.options.find((/** @type {any} */ o) => o.id === 'bajo-a-la-bodega')).toMatchObject({ text: 'Bajo a la bodega.', effects: [{ board: 'La bodega del gremio' }] });
        const brunilda = GREMIO.dialogues.find((/** @type {any} */ d) => d.id === 'brunilda-la-casa');
        const bajar = brunilda.nodes[0].options.find((/** @type {any} */ o) => o.id === 'bajar');
        expect(bajar).toMatchObject({ if: { milestone: { id: 'la-prueba', is: 'open' } }, effects: [{ board: 'La bodega del gremio' }], end: true });
        expect(prueba.hint).not.toMatch(/Entrar en La bodega/);
        expect(talked).toContain('La bodega del gremio');
    });

    test('con la prueba abierta en Puerto Alba no sale ningún botón para entrar en la bodega: se entra hablando', () => {
        const steps = storySteps({
            milestones: milestones, state: { open: ['la-prueba'] }, here: 'Puerto Alba',
            locations: plan.metadata.locationMaps, reach: {}, talked,
        });
        expect(steps).toEqual([]);
    });

    test('antes, lo que pide el prólogo es hablar con Tomás y con Brunilda, que están en el pueblo', () => {
        const where = Object.fromEntries(GREMIO.npcs.map((/** @type {any} */ n) => [n.name, n.where]));
        const input = { milestones: milestones, here: 'Puerto Alba', locations: plan.metadata.locationMaps, reach: {}, talked, where };
        expect(storySteps({ ...input, state: { open: ['la-charla'] } }).map(s => s.label)).toEqual(['Hablar con Tomás']);
        expect(storySteps({ ...input, state: { open: ['el-gremio'] } }).map(s => s.label)).toEqual(['Hablar con Brunilda']);
    });

    test('un encargo del tablón del gremio: «Ir a La cala del norte», y al llegar, su pelea', () => {
        const contract = plan.metadata.writtenContracts.find((/** @type {any} */ c) => c.id === 'gremio-la-cala');
        const taken = { ...contract, locationName: contract.where };
        const cala = plan.metadata.hiddenLocations.find((/** @type {any} */ l) => l.name === 'La cala del norte');
        const locations = [...plan.metadata.locationMaps, cala];
        const [go] = storySteps({ here: 'Puerto Alba', locations, reach: { 'La cala del norte': { reach: 'near', days: 1 } }, taken, talked });
        expect(go).toMatchObject({ label: 'Ir a La cala del norte', board: 'La playa de la cala' });
        expect(go.detail).toContain('El encargo de Marisa');
        expect(boardOnArrival({ here: 'La cala del norte', locations, reach: {}, taken, wanted: go.board })).toBe('La playa de la cala');
    });
});

describe('las conversaciones que mandan ir a un tablero o a un sitio', () => {
    test('«board» y «go» son efectos que se entienden y se comprueban', () => {
        expect(EFFECT_KINDS).toEqual(expect.arrayContaining(['board', 'go']));
        const talk = [{ id: 't', speaker: 'Ana', start: 'a', nodes: [{ id: 'a', line: 'Hola.', options: [
            { id: 'b', text: 'Bajo.', effects: [{ board: 'La bodega' }], end: true },
            { id: 'c', text: 'Vamos.', effects: [{ go: 'La Granja' }], end: true },
            { id: 'd', text: 'Mal.', effects: [{ board: '' }], end: true },
        ] }] }];
        const { errors } = checkDialogues(talk, { people: ['Ana'], milestones: [] });
        expect(errors.map(e => e.path)).toEqual(['dialogues[0].nodes[0].options[2].effects[0]']);
        const [dialogue] = readDialogues(talk);
        expect(dialogue.nodes[0].options[0].effects).toEqual([{ kind: 'board', board: 'La bodega' }]);
        expect(dialogue.nodes[0].options[1].effects).toEqual([{ kind: 'go', place: 'La Granja' }]);
    });

    test('se apuntan para hacerlas al cerrar la ventana; lo último de cada clase manda', () => {
        const out = applySceneEffects([{ kind: 'board', board: 'A' }, { kind: 'go', place: 'B' }, { kind: 'board', board: 'C' }], {});
        expect(out.moves).toEqual([{ kind: 'go', name: 'B' }, { kind: 'board', name: 'C' }]);
        expect(applySceneEffects([{ kind: 'gold', amount: 2 }], { gold: 0 }).moves).toEqual([]);
    });
});

/**
 * Los secretos del hilo (idea 111) cuyo sitio no pide ningún hito a la vista ni lo dice ningún
 * rumor: con el modo guiado, solo se llega a ellos si están de camino.
 *
 * @param {any} pack
 * @returns {string[]} `id @ sitio`.
 */
function secretsLost(pack) {
    const boardPlace = Object.fromEntries((pack.boards ?? []).map((/** @type {any} */ b) => [b.name, b.locationName]));
    const npcPlace = Object.fromEntries((pack.npcs ?? []).map((/** @type {any} */ n) => [n.name, n.where]));
    /** @param {any} asks @returns {string[]} */
    const placesOf = (asks) => {
        if (asks?.kind === 'any') return (asks.options ?? []).flatMap(placesOf);
        if (asks?.kind === 'clues') return (asks.clues ?? []).map((/** @type {any} */ c) => c.place);
        return [asks?.place || boardPlace[asks?.board] || npcPlace[asks?.npc] || ''].filter(Boolean);
    };
    const milestones = pack.plot?.milestones ?? [];
    const known = new Set([
        ...milestones.filter((/** @type {any} */ m) => !m.hidden).flatMap((/** @type {any} */ m) => placesOf(m.asks)),
        ...(pack.rumors ?? []).map((/** @type {any} */ r) => r.leadsTo).filter(Boolean),
    ]);
    return milestones.filter((/** @type {any} */ m) => m.hidden)
        .flatMap((/** @type {any} */ m) => placesOf(m.asks).filter(p => !known.has(p)).map(p => `${m.id} @ ${p}`));
}

describe('a cada tablero se llega con el modo guiado', () => {
    /** @type {Array<[string, any]>} */
    const PACKS = [
        ['el gremio', GREMIO],
        ['1387', P1387],
        ['Strahd', STRAHD],
        ...SEEDS.map((/** @type {any} */ row) => /** @type {[string, any]} */ ([`la semilla «${row.name}»`, seedCampaignPack({ row, compendium: compendium() }).pack])),
    ];

    test('cada tablero con pelea lo pide un hito, una conversación o un encargo, en todos los paquetes', () => {
        expect(PACKS.map(([name, pack]) => [name, unreachableBoards(pack).fights])).toEqual(PACKS.map(([name]) => [name, []]));
    });

    test('lo que lleva a un tablero lleva a uno que existe', () => {
        const missing = PACKS.flatMap(([name, pack]) => {
            const names = new Set((pack.boards ?? []).map((/** @type {any} */ b) => String(b.name)));
            return boardsByTalk(pack).filter(board => !names.has(board)).map(board => `${name}: ${board}`);
        });
        expect(missing).toEqual([]);
    });

    test('en 1387, los únicos sin nada que lleve a ellos son los tres mapas sin nadie (decide Daniel, en LO_OCULTO)', () => {
        expect(unreachableBoards(P1387).empty.sort()).toEqual(['El fuego del campamento', 'El gran salón de Vane', 'El patio de la ermita']);
        const links = boardLinks(P1387);
        expect(links.find(l => l.board === 'El callejón inundado')?.by).toEqual(['encargo:e-las-deudas-de-garth']);
        expect(links.find(l => l.board === 'Lobos en el pueblo')?.by).toEqual(['encargo:e-lobos-en-el-callejon']);
        expect(links.find(l => l.board === 'Los túneles de la mina')?.by).toEqual(['hito:la-nieve-manchada']);
    });

    test('a cada secreto del hilo se llega: su sitio lo pide la historia, lo dice un rumor o está de camino', () => {
        // El Camino Viejo, de camino a Campamento Furtivo: lo comprueba la prueba de abajo.
        expect(secretsLost(P1387)).toEqual(['la-soga-de-darek @ El Camino Viejo', 'el-mapa-del-explorador @ El Camino Viejo']);
        expect(secretsLost(STRAHD)).toEqual([]);
        expect(secretsLost(GREMIO)).toEqual([]);
    });

    test('en 1387, el único tablero que solo pide un secreto (Los claros) está en El Camino Viejo, por donde la historia pasa', () => {
        expect(PACKS.map(([name, pack]) => [name, unreachableBoards(pack).secret])).toEqual(PACKS.map(([name]) => [name, name === '1387' ? ['Los claros del Camino Viejo'] : []]));
        const plan = buildImportPlan(P1387);
        const locations = [...plan.metadata.locationMaps, ...plan.metadata.hiddenLocations];
        const milestones = /** @type {any} */ (readPlot(P1387.plot)).milestones;
        const done = ['el-caliz-ensangrentado', 'el-precio-del-escape'];
        const state = { open: ['la-pista-en-el-barro', 'el-mapa-del-explorador'], done };
        const at = (/** @type {string} */ here) => storySteps({ milestones, state, here, locations, reach: reachFrom({ from: here, locations, done }) });
        // Tras Giles, la pista en el barro manda a Campamento Furtivo, pasando por El Camino Viejo…
        expect(at('El Pueblo de Barro')).toEqual([expect.objectContaining({ id: 'story:go:El Camino Viejo', target: 'Campamento Furtivo' })]);
        // …y allí, además de seguir, se ve la pelea de Los claros.
        expect(at('El Camino Viejo').map(s => s.id)).toEqual(['story:go:Campamento Furtivo', 'story:board:Los claros del Camino Viejo']);
    });

    test('los paquetes siguen siendo válidos', () => {
        for (const pack of [GREMIO, P1387, STRAHD]) expect(validatePack(pack).errors).toEqual([]);
    });
});
