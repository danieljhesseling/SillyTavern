import fs from 'node:fs';
import { describe, test, expect } from '@jest/globals';
import { startSession, readSession, enterScene, noteSent, noteClick, minutesByScene, describeSession } from '../public/scripts/game-engine/campaign/session-log.js';
import { proposeDeed, readDeeds, recordDeed, worldMemoryBlock, PROPOSED_MAX, MAX_DEEDS } from '../public/scripts/game-engine/campaign/world-memory.js';
import { upcoming, describeUpcoming, whenText } from '../public/scripts/game-engine/campaign/upcoming.js';
import { DAY_STAGES, WEEK_STAGES, runStages, weeksDue } from '../public/scripts/game-engine/campaign/time-stages.js';
import { readTaggedLine, chronicleOf, chronicleSections, foldPlan, describeFold, TAG_CATEGORIES } from '../public/scripts/game-engine/campaign/chronicle.js';
import { affairsOf, standingsOf, weekSummary, TABLE_MAX } from '../public/scripts/game-engine/campaign/week-table.js';
import { createSeededRandom } from '../public/scripts/game-engine/combat/seeded-random.js';
import { planTravel } from '../public/scripts/game-engine/world/travel.js';
import { handFrom, startDuel, playArgument, duelOutcome, duelPrompt, STANCES } from '../public/scripts/game-engine/campaign/word-duel.js';
import { STATE_KEYS, checkpointKeys, captureKeys, restoreKeys, captureWorld, restoreWorld, describeState, entryOf } from '../public/scripts/game-engine/campaign/state-registry.js';

const MIN = 60000;

describe('U0: el diario de sesión', () => {
    test('los minutos se apuntan a la escena en la que se estuvo, contando la de ahora', () => {
        let log = startSession(0, 'title');
        log = enterScene(log, 'dialogue', 2 * MIN);
        log = enterScene(log, 'combat', 12 * MIN);
        const rows = minutesByScene(log, 30 * MIN);
        expect(rows).toEqual([
            { scene: 'combat', label: 'combatiendo', minutes: 18 },
            { scene: 'dialogue', label: 'hablando', minutes: 10 },
            { scene: 'title', label: 'en el menú', minutes: 2 },
        ]);
    });

    test('lo de fuera del juego no cuenta como jugado, y volver a la misma escena no reinicia nada', () => {
        let log = startSession(0, 'out');
        log = enterScene(log, 'exploration', 20 * MIN);
        const same = enterScene(log, 'exploration', 25 * MIN);
        expect(same).toBe(log);
        expect(minutesByScene(log, 30 * MIN)).toEqual([{ scene: 'exploration', label: 'en el sitio', minutes: 10 }]);
    });

    test('mensajes y botones se cuentan aparte, y la descripción dice cada cuánto se llama al modelo', () => {
        let log = startSession(0, 'dialogue');
        for (let i = 0; i < 3; i++) log = noteSent(log);
        for (let i = 0; i < 7; i++) log = noteClick(log);
        const lines = describeSession(log, 30 * MIN, { turns: 3, promptTokens: 18400 });
        expect(lines).toEqual([
            'Llevas 30 minutos jugando: hablando 30.',
            'Al narrador: 3 mensajes · 3 llamadas (≈18k tokens enviados).',
            'Con botón: 7 acciones.',
            'Una llamada cada 10 minutos de juego.',
        ]);
    });

    test('sin minutos todavía, lo dice en vez de enseñar un cero; y en singular cuando toca', () => {
        const lines = describeSession(noteClick(noteSent(startSession(0, 'dialogue'))), 10000, { turns: 1 });
        expect(lines[0]).toBe('Acabas de empezar: aún no hay minutos que contar.');
        expect(lines[1]).toBe('Al narrador: 1 mensaje · 1 llamada.');
        expect(lines[2]).toBe('Con botón: 1 acción.');
    });

    test('lo guardado se lee de vuelta; lo roto empieza de cero, y un reloj que va hacia atrás no resta', () => {
        const saved = JSON.parse(JSON.stringify(enterScene(noteSent(startSession(1000, 'title')), 'combat', 5 * MIN)));
        expect(readSession(saved, 6 * MIN)).toEqual(saved);
        expect(readSession(null, 42)).toEqual(startSession(42));
        expect(readSession({ startedAt: 'x' }, 42)).toEqual(startSession(42));
        expect(readSession({ ...saved, since: 99 * MIN }, 6 * MIN).since).toBe(6 * MIN);
    });
});

describe('U1: el narrador propone un hecho, y el motor decide', () => {
    test('una frase se apunta, marcada como suya, y va al bloque de memoria como cualquier hecho', () => {
        const result = proposeDeed([], 4, '  El molinero juró   venganza contra Vane. ');
        expect(result.ok).toBe(true);
        expect(result.deeds).toEqual([{ day: 4, text: 'El molinero juró venganza contra Vane.', from: 'narrador' }]);
        expect(worldMemoryBlock({ deeds: result.deeds, today: 4 })).toContain('El molinero juró venganza contra Vane.');
    });

    test('ni vacío, ni un párrafo, ni repetido', () => {
        expect(proposeDeed([], 1, 'Nada').ok).toBe(false);
        expect(proposeDeed([], 1, 'x'.repeat(PROPOSED_MAX + 1)).reason).toMatch(/Demasiado largo/);
        const deeds = recordDeed([], 1, 'Entregasteis el carro a Vane.');
        expect(proposeDeed(deeds, 2, 'entregasteis el carro a vane.').reason).toBe('Eso ya se recuerda.');
    });

    test('uno propuesto al día: el segundo espera a mañana, y lo que ve el motor no cuenta para ese límite', () => {
        let deeds = recordDeed([], 3, 'Cumplisteis el encargo del molino.');
        const first = proposeDeed(deeds, 3, 'La barquera tiene oro nuevo.');
        expect(first.ok).toBe(true);
        deeds = first.deeds;
        expect(proposeDeed(deeds, 3, 'El alcalde esconde algo en el sótano.').reason).toMatch(/Hoy ya/);
        expect(proposeDeed(deeds, 4, 'El alcalde esconde algo en el sótano.').ok).toBe(true);
    });

    test('la marca sobrevive a leer lo guardado, y los más viejos se siguen olvidando', () => {
        const saved = JSON.parse(JSON.stringify(proposeDeed([], 1, 'La barquera tiene oro nuevo.').deeds));
        expect(readDeeds(saved)[0].from).toBe('narrador');
        expect(readDeeds([{ day: 1, text: 'Algo', from: 'otro' }])[0]).toEqual({ day: 1, text: 'Algo' });
        let many = [];
        for (let day = 1; day <= MAX_DEEDS + 2; day++) many = proposeDeed(many, day, `Pasó algo el día ${day}.`).deeds;
        expect(many).toHaveLength(MAX_DEEDS);
        expect(many[0].text).toBe('Pasó algo el día 3.');
    });
});

describe('U2: un solo estado de partida', () => {
    test('cada clave está una vez, con dueño, qué es y una clase conocida', () => {
        const keys = STATE_KEYS.map(e => e.key);
        expect(new Set(keys).size).toBe(keys.length);
        for (const entry of STATE_KEYS) {
            expect(['juego', 'ajuste', 'registro', 'puntos', 'sistema']).toContain(entry.kind);
            expect(entry.owner.length).toBeGreaterThan(0);
            expect(entry.what.length).toBeGreaterThan(0);
        }
        expect(entryOf('plotState')?.kind).toBe('juego');
        expect(entryOf('nada')).toBeNull();
    });

    test('un punto de retorno guarda todo lo de juego, y nada de ajustes, registros, puntos o SillyTavern', () => {
        const keys = checkpointKeys();
        for (const key of ['party', 'plotState', 'contractBoard', 'approval', 'attitudes', 'wanted', 'guildStorage', 'calendar']) expect(keys).toContain(key);
        for (const key of ['sceneTone', 'diceLog', 'checkpoints', 'world_info', 'dynamicContext']) expect(keys).not.toContain(key);
        const meta = { party: [{ id: 1, hp: 5 }], wanted: { Peaje: 2 }, sceneTone: 'tensa', checkpoints: [1], world_info: '1387' };
        expect(captureKeys(meta)).toEqual({ party: [{ id: 1, hp: 5 }], wanted: { Peaje: 2 } });
    });

    test('volver a un punto devuelve lo de juego, borra lo que no existía entonces y no toca tus ajustes', () => {
        const meta = { party: [{ id: 1, hp: 5 }], wanted: { Peaje: 2 }, sceneTone: 'tensa' };
        const saved = captureKeys(meta);
        meta.party[0].hp = 0;
        meta.wanted.Peaje = 3;
        meta.attitudes = { Giles: 2 };
        meta.sceneTone = 'ligera';
        const changed = restoreKeys(meta, saved);
        expect(meta).toEqual({ party: [{ id: 1, hp: 5 }], wanted: { Peaje: 2 }, sceneTone: 'ligera' });
        expect(changed.sort()).toEqual(['attitudes', 'party', 'wanted']);
        // Una copia de verdad: cambiar lo restaurado no cambia el punto.
        meta.party[0].hp = 1;
        expect(saved.party[0].hp).toBe(5);
    });

    test('un punto de antes del registro devuelve lo que trae y no borra lo que no guardaba', () => {
        const meta = { party: [{ id: 1, hp: 0 }], plotState: { open: ['b'] } };
        const changed = restoreKeys(meta, { party: [{ id: 1, hp: 9 }] }, false);
        expect(meta).toEqual({ party: [{ id: 1, hp: 9 }], plotState: { open: ['b'] } });
        expect(changed).toEqual(['party']);
    });

    test('del mundo vuelve lo que cambia jugando; lo escrito después se queda', () => {
        const world = {
            metadata: { locationMaps: [{ name: 'El molino', fortune: 0 }], factions: [{ id: 'vane', clock: 2 }], plot: { title: 'no cambia' } },
            entries: { 1: { uid: 1, dndData: { name: 'Oria', mapPosition: { locationName: 'El molino' } } }, 2: { uid: 2, content: 'sin ficha' } },
        };
        const saved = captureWorld(world);
        expect(Object.keys(saved.metadata)).toEqual(['locationMaps', 'factions']);
        world.metadata.locationMaps[0].fortune = -2;
        world.metadata.factions[0].clock = 6;
        world.entries[1].dndData.mapPosition.locationName = 'El Peaje';
        world.entries[3] = { uid: 3, dndData: { name: 'Nueva, del modo director' } };
        expect(restoreWorld(world, saved)).toBe(3);
        expect(world.metadata.locationMaps[0].fortune).toBe(0);
        expect(world.metadata.factions[0].clock).toBe(2);
        expect(world.entries[1].dndData.mapPosition.locationName).toBe('El molino');
        expect(world.entries[3].dndData.name).toBe('Nueva, del modo director');
        expect(world.metadata.plot.title).toBe('no cambia');
    });

    test('el panel dice cada clave por clases, con cuánto hay', () => {
        const sections = describeState({ party: [{}, {}], wanted: {}, sceneTone: 'tensa' });
        expect(sections.map(s => s.kind)).toEqual(['juego', 'ajuste', 'registro', 'puntos', 'sistema']);
        const game = sections[0].rows;
        expect(game.find(r => r.key === 'party')?.size).toBe('2');
        expect(game.find(r => r.key === 'wanted')?.size).toBe('vacío');
        expect(game.find(r => r.key === 'plot')?.size).toBe('—');
        expect(sections[1].rows.find(r => r.key === 'sceneTone')?.size).toBe('tensa');
    });
});

describe('U3: lo que viene, de todos los relojes a la vez', () => {
    const faction = { id: 'vane', name: 'Vane', goal: { kind: 'conquistar', target: 'El molino', of: 6, at: 4, pace: 3, days: 1 } };

    test('cada reloj dice cuándo le toca, y sale una lista ordenada por días', () => {
        const list = upcoming({
            today: 10,
            factions: [faction],
            billDue: 12, bill: 140, purse: 95,
            debt: { amount: 50, owed: 80, day: 3, dueDay: 13, contractId: 'favor' },
            taken: { title: 'Escoltar a Tomás', days: 15 },
            party: [{ name: 'Bran', injuries: [{ id: 'costilla', label: 'Costilla rota', days: 6, daysLeft: 4 }, { id: 'ojo', label: 'Ojo perdido', days: 0 }] }],
            festivals: { 'Soto del Roble': { day: 20, name: 'La fiesta del grano' } },
        });
        expect(describeUpcoming(list, 10)).toEqual([
            'La cuenta de la semana: debéis 140, y tenéis 95, en 2 días.',
            'Vence la deuda: 80 de oro si no cumplís el favor, en 3 días.',
            'Bran se cura de costilla rota, en 4 días.',
            'Se acaba el plazo de «Escoltar a Tomás», en 5 días.',
            'Vane toma El molino, en 5 días.',
            'La fiesta del grano en Soto del Roble, en 10 días.',
        ]);
        // Lo permanente no se cura, y no sale.
        expect(list.some(i => /ojo perdido/.test(i.text))).toBe(false);
    });

    test('a igual día, primero lo que se paga y lo que caduca, luego lo que avanza solo', () => {
        const list = upcoming({ today: 10, factions: [faction], taken: { title: 'Escoltar a Tomás', days: 15 } });
        const sameDay = list.filter(i => i.in === 5).map(i => i.kind);
        expect(sameDay).toEqual(['encargo', 'faccion']);
    });

    test('la estación que viene, contando desde la de inicio del mundo', () => {
        const list = upcoming({ today: 55, seasonStart: 'otono' });
        expect(list).toEqual([{ in: 2, kind: 'estacion', text: 'Empieza invierno' }]);
        expect(upcoming({ today: 56, seasonStart: 'otono' })[0]).toEqual({ in: 1, kind: 'estacion', text: 'Empieza invierno' });
    });

    test('lo que queda lejos no sale, y lo que ya pasó tampoco', () => {
        const list = upcoming({ today: 10, billDue: 40, taken: { title: 'Viejo', days: 3 }, horizon: 14 });
        expect(list.some(i => i.kind === 'cuenta' || i.kind === 'encargo')).toBe(false);
    });

    test('hoy, mañana, en N días', () => {
        expect([whenText(0), whenText(1), whenText(6)]).toEqual(['hoy', 'mañana', 'en 6 días']);
    });
});

describe('U3: un solo paso del tiempo', () => {
    test('el orden está escrito una vez: curar y comer antes que el mundo, y la semana al final', () => {
        const day = DAY_STAGES.map(s => s.id);
        expect(day.indexOf('curar')).toBeLessThan(day.indexOf('facciones'));
        expect(day.indexOf('necesidades')).toBeLessThan(day.indexOf('facciones'));
        expect(day[day.length - 1]).toBe('semana');
        const week = WEEK_STAGES.map(s => s.id);
        expect(week.slice(-3)).toEqual(['cuenta', 'caso', 'mesa']);
        const all = [...day, ...WEEK_STAGES.map(s => s.id)];
        expect(new Set(all).size).toBe(all.length);
    });

    test('se recorren en orden, sin esperar, y una etapa que falla no para a las demás', async () => {
        const seen = [];
        const late = [];
        const handlers = {
            deuda: () => { seen.push('deuda'); },
            gente: async () => { seen.push('gente'); throw new Error('tarde'); },
            hartos: () => { throw new Error('se rompió'); },
            rivales: () => { seen.push('rivales'); },
            cuenta: (ctx) => { seen.push(`cuenta ${ctx.today}`); },
        };
        const result = runStages(WEEK_STAGES, handlers, { today: 14 }, (id, error) => late.push(`${id}: ${error}`));
        // Todo lo síncrono ya ha pasado al volver: quien pasa el tiempo lo ve cobrado.
        expect(seen).toEqual(['deuda', 'gente', 'rivales', 'cuenta 14']);
        await Promise.resolve();
        await Promise.resolve();
        expect(late).toEqual(['gente: tarde']);
        expect(result.ran).toEqual(['deuda', 'gente', 'rivales', 'cuenta']);
        expect(result.failed).toEqual([{ id: 'hartos', error: 'se rompió' }]);
        expect(result.missing).toEqual(['buscados', 'caso', 'mesa']);
    });

    test('la cuenta: la primera vez no se cobra; luego, las semanas que hayan pasado', () => {
        expect(weeksDue(3, 0, 7)).toEqual({ weeks: 0, nextDue: 10 });
        expect(weeksDue(9, 10, 7)).toEqual({ weeks: 0, nextDue: 10 });
        expect(weeksDue(10, 10, 7)).toEqual({ weeks: 1, nextDue: 17 });
        expect(weeksDue(25, 10, 7)).toEqual({ weeks: 3, nextDue: 31 });
    });
});

describe('U4: una sola crónica', () => {
    test('una línea del juego se lee con su etiqueta y su categoría; sin etiqueta, nada', () => {
        expect(readTaggedLine('🩹 [CAMPAÑA] Bran: costilla rota, curado.')).toEqual({ tag: 'CAMPAÑA', category: 'viaje', text: 'Bran: costilla rota, curado.', minor: true });
        expect(readTaggedLine('[RIVALES] Los Perros de Hierro se os adelantan.')).toEqual({ tag: 'RIVALES', category: 'mundo', text: 'Los Perros de Hierro se os adelantan.', minor: false });
        expect(readTaggedLine('⚔️ [COMBAT] Turno de Wendel')?.category).toBe('combate');
        expect(readTaggedLine('[ALGO NUEVO] x')?.category).toBe('otros');
        expect(readTaggedLine('El narrador cuenta algo.')).toBeNull();
    });

    test('la crónica sale del chat: solo lo del juego, sin lo que escribe quien juega', () => {
        const chat = [
            { mes: '[HILO] Se abre: La cueva bajo la hiedra.' },
            { mes: '[GREMIO] Nada', is_user: true },
            { mes: 'Prosa del narrador.' },
            { mes: '🛒 [TIENDA] Wendel compra una cuerda.' },
            { mes: '[HILO] Se cumple: Los cuervos callados.' },
        ];
        const entries = chronicleOf(chat);
        expect(entries.map(e => e.index)).toEqual([0, 3, 4]);
        expect(chronicleSections(entries)).toEqual([
            { category: 'hilo', title: 'El hilo', items: ['Se cumple: Los cuervos callados.', 'Se abre: La cueva bajo la hiedra.'] },
            { category: 'comercio', title: 'Pueblo y comercio', items: ['Wendel compra una cuerda.'] },
        ]);
        expect(chronicleSections(entries, { only: 'comercio' }).map(s => s.category)).toEqual(['comercio']);
    });

    test('el chat se pliega por tandas de lo menor; lo importante corta la tanda y nunca se pliega', () => {
        const line = (index, minor, category = 'combate') => ({ index, minor, category });
        const plan = foldPlan([line(0, true), line(1, true), line(2, true, 'comercio'), line(3, false, 'hilo'), line(4, true), null, line(6, true), line(7, true)]);
        expect(plan).toEqual([
            { hide: [0, 1], show: 2, categories: ['combate'] },
            { hide: [6], show: 7, categories: ['combate'] },
        ]);
        expect(describeFold(plan[0])).toBe('y 2 más: combate');
        expect(foldPlan([line(0, true)])).toEqual([]);
    });

    test('cada etiqueta que usa el código tiene su categoría', () => {
        const files = ['../public/scripts/party.js', '../public/scripts/campaigns.js', '../public/scripts/party/campaign-state.js'];
        const tags = new Set();
        for (const file of files) {
            const text = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
            for (const match of text.matchAll(/[`'"](?:[^\s`'"]{1,4}\s)?\[([A-ZÁÉÍÓÚÑ ]{3,22})\]/gu)) tags.add(match[1].trim());
        }
        const missing = [...tags].filter(tag => !(tag in TAG_CATEGORIES)).sort();
        expect(missing).toEqual([]);
        expect(tags.size).toBeGreaterThan(30);
    });
});

describe('U5: la Mesa de la Semana', () => {
    const vane = { id: 'vane', name: 'Vane', reputation: -2, goal: { kind: 'conquistar', target: 'El molino', of: 6, at: 4, pace: 3, days: 1 } };

    test('los asuntos salen de todos los relojes, con su plazo y lo que pasa si no se atienden', () => {
        const affairs = affairsOf({
            today: 10,
            factions: [vane],
            taken: { id: 'c1', title: 'Escoltar a Tomás', locationName: 'El Peaje', reward: 70, days: 14 },
            board: [
                { id: 'c1', title: 'Escoltar a Tomás', reward: 70, days: 14 },
                { id: 'c2', title: 'Limpiar la bodega', rank: 'D', reward: 20, days: 20 },
                { id: 'c3', title: 'Cazar al lobo blanco', rank: 'C', reward: 90, days: 18, locationName: 'El bosque' },
                { id: 'p1', title: 'Poner a salvo a los suyos', personal: 'lyra', days: 16 },
            ],
            debt: { amount: 50, owed: 80, day: 3, dueDay: 12 },
            party: [{ id: 'lyra', name: 'Lyra' }],
            rivals: true,
        });
        expect(affairs.map(a => `${a.kind}:${a.in}`)).toEqual(['deuda:2', 'encargo:4', 'faccion:5', 'personal:6', 'tablon:8']);
        expect(affairs.find(a => a.kind === 'faccion')?.ifIgnored).toBe('Vane toma El molino, porque nadie fue a impedirlo');
        expect(affairs.find(a => a.kind === 'tablon')).toMatchObject({ title: 'Cazar al lobo blanco', ifIgnored: 'Caduca, o se lo llevan los rivales', where: 'El bosque' });
        expect(affairs.find(a => a.kind === 'personal')?.ifIgnored).toBe('Lyra se acuerda de que no fuisteis');
    });

    test('cinco como mucho: una mesa, no un menú', () => {
        const board = Array.from({ length: 3 }, (_, i) => ({ id: `p${i}`, title: `Personal ${i}`, personal: 'lyra', days: 12 + i }));
        const affairs = affairsOf({ today: 10, factions: [vane], board, debt: { owed: 10, dueDay: 11 }, taken: { id: 't', title: 'T', days: 13 } });
        expect(affairs.length).toBe(TABLE_MAX);
    });

    test('cómo os ven: las formas de opinión juntas, solo lo que no es indiferente', () => {
        const sections = standingsOf({
            guild: { name: 'La Compañía Gris', renown: 12 },
            factions: [vane, { id: 'leales', name: 'Los Leales', reputation: 0, goal: {} }],
            places: [{ name: 'El molino', fortune: -2 }, { name: 'El Peaje', fortune: 0 }],
            wanted: { 'El Peaje Norte': 2 },
            attitudes: { values: { Giles: 2 } },
            companions: [{ name: 'Lyra', rank: 3 }, { name: 'Kael', rank: 0 }],
        });
        expect(sections.map(s => s.title)).toEqual(['El gremio', 'Las facciones', 'Cómo les va a los sitios', 'Dónde os buscan', 'La gente', 'Los compañeros']);
        expect(sections[1].items).toEqual(['Vane: no os quieren cerca']);
        expect(sections[2].items).toEqual(['El molino: lo están pasando mal (-2)']);
        expect(sections[3].items).toEqual(['El Peaje Norte: os paran los guardias (2)']);
        expect(sections[5].items).toEqual(['Lyra: vínculo 3']);
    });

    test('la semana que pasó: lo que movió la historia, y cuánto de lo menor', () => {
        const entries = [
            { index: 1, category: 'hilo', text: 'Viejo', minor: false },
            { index: 5, category: 'combate', text: 'Golpe', minor: true },
            { index: 6, category: 'mundo', text: 'Vane toma El molino.', minor: false },
            { index: 7, category: 'comercio', text: 'Compra', minor: true },
        ];
        expect(weekSummary(entries, 4)).toEqual(['Vane toma El molino.', 'Y 2 cosas menores más: combates, compras, caminos.']);
        expect(weekSummary(entries, 50)).toEqual([]);
    });
});

describe('U6: el Duelo de Palabras', () => {
    const mods = { persuasion: 3, deception: 1, intimidation: 0 };
    const d20 = (/** @type {number[]} */ values) => { let i = 0; return () => values[i++ % values.length]; };

    test('la mano sale de lo que tienes: habilidades, pruebas, favores, oro y un compañero con vínculo', () => {
        const hand = handFrom({ modifiers: mods, evidence: ['la carta del molinero'], favors: ['Los Leales'], purse: 30, companions: [{ name: 'Bran', rank: 4 }, { name: 'Kael', rank: 1 }] });
        expect(hand.map(a => a.id)).toEqual(['persuadir', 'enganar', 'intimidar', 'prueba:0', 'favor:0', 'oro', 'companero']);
        expect(hand.find(a => a.id === 'companero')?.label).toBe('Que hable Bran');
        expect(hand.find(a => a.id === 'persuadir')?.modifier).toBe(3);
        // Sin oro suficiente, o donde el oro no sirve (un regateo), no hay carta de oro.
        expect(handFrom({ modifiers: mods, purse: 5 }).some(a => a.kind === 'oro')).toBe(false);
        expect(handFrom({ modifiers: mods, purse: 50, allowCoin: false }).some(a => a.kind === 'oro')).toBe(false);
    });

    test('tres rondas que salen: cede; y cada carta se juega una vez', () => {
        const hand = handFrom({ modifiers: mods, evidence: ['la carta'] });
        let state = startDuel({ npc: { name: 'El capitán', stance: 'desconfiado' }, patience: 10, hand });
        let played = playArgument(state, 'prueba:0', d20([10]));
        expect(played.state.patience).toBe(4); // una prueba, con quien desconfía, pesa más: 4 × 1,5
        expect(played.reply).toBe('¿Y quién me dice que no me estáis engañando?');
        state = played.state;
        expect(playArgument(state, 'prueba:0', d20([10])).ok).toBe(false);
        state = playArgument(state, 'persuadir', d20([15])).state;
        expect(state.patience).toBe(1);
        state = playArgument(state, 'intimidar', d20([12])).state;
        expect(duelOutcome(state)).toBe('cede');
    });

    test('la postura cambia qué funciona: a un orgulloso, amenazarle le endurece', () => {
        const state = startDuel({ npc: { name: 'La jueza', stance: 'orgulloso' }, patience: 8, hand: handFrom({ modifiers: mods }) });
        const played = playArgument(state, 'intimidar', d20([16]));
        expect(played.state.patience).toBe(11);
        expect(played.line).toMatch(/le endurece \(orgulloso\)/);
        expect(played.state.composure).toBeLessThan(state.composure);
    });

    test('se acaban las rondas: a medias si se le gastó la mitad de la paciencia; si no, no cede', () => {
        const hand = handFrom({ modifiers: mods });
        let half = startDuel({ npc: { name: 'El tendero', stance: 'codicioso' }, patience: 6, hand, rounds: 2 });
        half = playArgument(half, 'persuadir', d20([15])).state;
        half = playArgument(half, 'enganar', d20([2])).state;
        expect(duelOutcome(half)).toBe('a-medias');
        let none = startDuel({ npc: { name: 'El tendero', stance: 'codicioso' }, patience: 6, hand, rounds: 2 });
        none = playArgument(none, 'persuadir', d20([2])).state;
        none = playArgument(none, 'enganar', d20([3])).state;
        expect(duelOutcome(none)).toBe('no-cede');
    });

    test('al narrador se le da una sola vez: las rondas en pocas líneas y el resultado, sin cambiarlo', () => {
        let state = startDuel({ npc: { name: 'El capitán', stance: 'leal' }, patience: 3, hand: handFrom({ modifiers: mods, companions: [{ name: 'Bran', rank: 3 }] }) });
        state = playArgument(state, 'companero', d20([1])).state;
        expect(duelOutcome(state)).toBe('cede');
        const prompt = duelPrompt(state, 'que os deje pasar sin pagar');
        expect(prompt.split('\n')).toEqual([
            '[DUELO] Una conversación con El capitán (leal) para que os deje pasar sin pagar. Así fue:',
            '- Ronda 1: Que hable Bran — le pesa más (leal).',
            'Al final cede. Cuéntalo en cuatro o cinco frases, con lo que se dijo. No cambies el resultado ni inventes nada más.',
        ]);
        expect(Object.keys(STANCES)).toEqual(['desconfiado', 'orgulloso', 'asustado', 'codicioso', 'leal']);
    });
});

describe('U8: los despachos', () => {
    const load = async () => import('../public/scripts/game-engine/campaign/dispatch.js');

    test('solo lo menor se despacha, y lo personal pide al héroe', async () => {
        const { canDispatch } = await load();
        expect(canDispatch({ rank: 'D' }).ok).toBe(true);
        expect(canDispatch({ rank: 'B' }).reason).toMatch(/peligroso/);
        expect(canDispatch({ rank: 'D', personal: 'lyra' }).reason).toMatch(/personal/);
    });

    test('la probabilidad se ve antes, con sus motivos: nivel, oficio y heridas', async () => {
        const { dispatchOdds } = await load();
        const bran = { id: 1, name: 'Bran', class: 'Guerrero', level: 2 };
        const kael = { id: 2, name: 'Kael', class: 'Pícaro', level: 1, injuries: [{ id: 'c', label: 'Costilla', days: 6, daysLeft: 3 }] };
        const odds = dispatchOdds({ members: [bran, kael], contract: { rank: 'C', kind: 'cull' } });
        // fuerza 2 + 1 (encaja) + 1 - 1 (herido) = 3, contra 4: 0,35 - 0,12 ≈ 0,25
        expect(odds.chance).toBe(0.25);
        expect(odds.reasons).toEqual(['Bran es de armas: le va este trabajo', 'Kael va herido']);
        expect(dispatchOdds({ members: [bran], contract: { rank: 'D', kind: 'hunt' } }).chance).toBe(0.45);
    });

    test('se van unos días, y vuelven cuando toca', async () => {
        const { startDispatch, dispatchesDue } = await load();
        const d = startDispatch({ contract: { id: 'c1', rank: 'C', kind: 'escort', title: 'Escoltar' }, members: [{ id: 1, name: 'Bran' }], today: 10, chance: 0.6 });
        expect([d.leftOn, d.backOn]).toEqual([10, 15]);
        expect(dispatchesDue([d], 14).due).toEqual([]);
        expect(dispatchesDue([d], 15).due.map(x => x.id)).toEqual([d.id]);
    });

    test('vuelven con el resultado: el oro si sale; heridos o, si la campaña lo permite y sale muy mal, uno menos', async () => {
        const { startDispatch, resolveDispatch } = await load();
        const seq = (/** @type {number[]} */ v) => { let i = 0; return () => v[i++ % v.length]; };
        const d = startDispatch({ contract: { id: 'c1', rank: 'D', kind: 'cull', title: 'Limpiar la bodega', reward: 30 }, members: [{ id: 1, name: 'Bran' }, { id: 2, name: 'Kael' }], today: 1, chance: 0.6 });
        const good = resolveDispatch({ dispatch: d, random: seq([0.2, 0.9]) });
        expect(good).toEqual({ success: true, reward: 30, hurt: '', dead: '', line: 'Bran y Kael vuelven de «Limpiar la bodega»: hecho, y traen 30 de oro.' });
        const bad = resolveDispatch({ dispatch: d, random: seq([0.7, 0.1, 0.0]) });
        expect(bad).toMatchObject({ success: false, reward: 0, dead: '', hurt: '1' });
        expect(resolveDispatch({ dispatch: d, random: seq([0.99, 0.6]), allowDeath: true })).toMatchObject({ dead: '2', line: 'Bran y Kael vuelven de «Limpiar la bodega» sin nada. Kael no vuelve.' });
        expect(resolveDispatch({ dispatch: d, random: seq([0.99, 0.9]), allowDeath: false }).dead).toBe('');
    });
});

describe('U8: casos con verdad (F1: la verdad, las pistas y el comprobador)', () => {
    const load = async () => import('../public/scripts/game-engine/campaign/cases.js');
    const people = ['Oria', 'Giles', 'Tomás', 'Ilda', 'Bruno', 'Marta', 'Sela', 'Quino'].map((name, i) => ({ name, place: i % 2 ? 'El molino' : 'El muelle' }));
    const places = ['El molino', 'El muelle', 'La posada', 'El granero'];

    test('mil casos generados: todos se pueden resolver, y ninguna pista falsa pesa más que la verdad', async () => {
        const { generateCase, checkCase } = await load();
        const broken = Array.from({ length: 1000 }, (_, i) => i + 1)
            .map(seed => ({ seed, result: checkCase(generateCase({ people, places, random: createSeededRandom(seed), day: seed })) }))
            .filter(({ result }) => !result.ok)
            .map(({ seed, result }) => `${seed}: ${result.problems.join(' ')}`);
        expect(broken).toEqual([]);
    });

    test('la misma semilla da el mismo caso; sin gente suficiente, no hay caso', async () => {
        const { generateCase } = await load();
        const a = generateCase({ people, places, random: createSeededRandom(7), day: 3 });
        const b = generateCase({ people, places, random: createSeededRandom(7), day: 3 });
        expect(a).toEqual(b);
        expect(generateCase({ people: people.slice(0, 5), places, random: createSeededRandom(7) })).toBeNull();
        // Nadie cuenta lo que vio siendo la víctima.
        expect(a.clues.some(c => c.source.kind === 'persona' && c.source.name === a.victim)).toBe(false);
    });

    test('acusar: las tres cosas es acierto; el culpable sin lo demás, a medias; otro, error con su secreto', async () => {
        const { generateCase, accuse } = await load();
        const m = generateCase({ people, places, random: createSeededRandom(11), day: 1 });
        expect(accuse(m, m.truth).verdict).toBe('acierto');
        const wrongWhy = m.motives.find(x => x !== m.truth.motive);
        expect(accuse(m, { ...m.truth, motive: wrongWhy }).verdict).toBe('a-medias');
        const innocent = m.suspects.find(s => s !== m.truth.culprit);
        const wrong = accuse(m, { culprit: innocent, motive: m.truth.motive, method: m.truth.method });
        expect(wrong.verdict).toBe('error');
        expect(wrong.line).toContain(m.secrets[innocent]);
    });

    test('el narrador solo ve lo encontrado: nunca la verdad', async () => {
        const { generateCase, caseForNarrator } = await load();
        const m = generateCase({ people, places, random: createSeededRandom(5), day: 1 });
        const honest = m.clues.find(c => !c.misleading && c.points === 'movil');
        const told = caseForNarrator(m, [honest.id]);
        expect(told).toContain(honest.fact);
        for (const other of m.clues.filter(c => c.id !== honest.id)) expect(told).not.toContain(other.fact);
        expect(caseForNarrator(m, [])).toContain('- Nada todavía.');
    });
});

describe('U5: el mapa en texto, con niebla y notas (ideas 69 y 70)', () => {
    const load = async () => import('../public/scripts/game-engine/campaign/text-map.js');
    const locations = [
        { name: 'El Pueblo', routes: [{ to: 'El Molino', days: 1 }, { to: 'La Cueva', days: 3 }] },
        { name: 'El Molino', routes: [{ to: 'El Vado', days: 2 }] },
        { name: 'El Vado', routes: [] },
        { name: 'La Cueva', routes: [] },
    ];

    test('lo no visitado en gris, y un camino que no toca nada visitado, sin destino', async () => {
        const { mapRows, describeRoute } = await load();
        const rows = mapRows({ locations, here: 'El Molino', visited: ['El Pueblo'] });
        expect(rows.map(r => `${r.name}:${r.state}`)).toEqual(['El Molino:aqui', 'El Pueblo:visitado', 'El Vado:sin-visitar', 'La Cueva:sin-visitar']);
        const vado = rows.find(r => r.name === 'El Vado');
        expect(vado.routes.map(describeRoute)).toEqual(['→ El Molino, 2 días']);
        const cave = rows.find(r => r.name === 'La Cueva');
        expect(cave.routes.map(describeRoute)).toEqual(['→ El Pueblo, 3 días']);
        const lonely = mapRows({ locations, here: 'El Pueblo' }).find(r => r.name === 'El Vado');
        expect(lonely.routes.map(describeRoute)).toEqual(['→ un camino que no conocéis']);
    });

    test('las notas: una línea por sitio; vacía, se borra', async () => {
        const { setNote, mapRows, markVisited, NOTE_MAX } = await load();
        let notes = setNote({}, 'El Vado', 'El barquero sabe algo del molinero.');
        expect(mapRows({ locations, notes }).find(r => r.name === 'El Vado').note).toBe('El barquero sabe algo del molinero.');
        notes = setNote(notes, 'El Vado', '  ');
        expect(notes).toEqual({});
        expect(setNote({}, 'X', 'a'.repeat(300)).X.length).toBe(NOTE_MAX);
        expect(markVisited(['A'], 'A')).toEqual(['A']);
        expect(markVisited(['A'], 'B')).toEqual(['A', 'B']);
    });
});

describe('U8: casos con verdad (F2–F4: dónde están las pistas, el tablero y la mesa)', () => {
    const people = ['Oria', 'Giles', 'Tomás', 'Ilda', 'Bruno', 'Marta', 'Sela'].map((name, i) => ({ name, place: i % 2 ? 'El molino' : 'El muelle' }));

    test('cada pista está en una persona o en un sitio, y se van encontrando', async () => {
        const { generateCase, readCases, cluesHere, suspectsBoard } = await import('../public/scripts/game-engine/campaign/cases.js');
        const active = generateCase({ people, places: ['El molino', 'El muelle', 'La posada'], random: createSeededRandom(3), day: 1 });
        let state = readCases({ active, found: [] });
        const talk = active.clues.find(c => c.source.kind === 'persona');
        expect(cluesHere(state, { person: talk.source.name }).map(c => c.id)).toContain(talk.id);
        state = readCases({ active, found: [talk.id, 'no-existe'] });
        expect(state.found).toEqual([talk.id]);
        expect(cluesHere(state, { person: talk.source.name }).map(c => c.id)).not.toContain(talk.id);
        const board = suspectsBoard(state);
        expect(board.map(s => s.name).sort()).toEqual([...active.suspects].sort());
        expect(readCases(null)).toEqual({ active: null, found: [], closed: [] });
    });

    test('el caso abierto entra en la mesa aunque no tenga plazo', async () => {
        const { generateCase } = await import('../public/scripts/game-engine/campaign/cases.js');
        const active = generateCase({ people, places: ['El molino', 'El muelle'], random: createSeededRandom(4), day: 1 });
        const board = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, title: `P${i}`, personal: 'x', days: 11 + i }));
        const affairs = affairsOf({ today: 10, board, debt: { owed: 5, dueDay: 12 }, mystery: { active, found: [] } });
        expect(affairs.length).toBe(TABLE_MAX);
        expect(affairs.some(a => a.kind === 'caso' && a.title === active.title)).toBe(true);
    });
});

describe('U7: una sola forma de mundo', () => {
    test('un camino «cerrado hasta» un hito está cerrado, sin decir cuál, hasta que se cumple', () => {
        const locations = [
            { name: 'Puerto de Gris', routes: [{ to: 'Cala de los Votos', days: 1, closedUntil: 'la-firma' }] },
            { name: 'Cala de los Votos', routes: [] },
        ];
        const shut = planTravel({ from: 'Puerto de Gris', to: 'Cala de los Votos', locations });
        expect(shut.ok).toBe(false);
        expect(shut.reason).toBe('El paso de "Puerto de Gris" a "Cala de los Votos" está cerrado. Cerrado por ahora: se abrirá más adelante en la historia.');
        expect(shut.reason).not.toMatch(/la-firma/);
        expect(planTravel({ from: 'Puerto de Gris', to: 'Cala de los Votos', locations, done: ['la-firma'] })).toEqual({ ok: true, days: 1, legs: ['Cala de los Votos'], reason: '' });
    });
});

describe('U8: la víctima de un caso nunca es quien hace falta', () => {
    test('en cien casos, quien necesita el hilo o atiende un servicio no muere; si todos hacen falta, no hay caso', async () => {
        const { generateCase } = await import('../public/scripts/game-engine/campaign/cases.js');
        const people = ['Oria', 'Giles', 'Tomás', 'Ilda', 'Bruno', 'Marta', 'Sela'].map(name => ({ name, place: 'El molino' }));
        const protectedNames = ['Giles', 'Oria', 'Sela'];
        const victims = Array.from({ length: 100 }, (_, seed) => generateCase({ people, places: ['El molino', 'El muelle'], random: createSeededRandom(seed + 1), protectedNames }).victim);
        expect(victims.filter(v => protectedNames.includes(v))).toEqual([]);
        expect(generateCase({ people, places: ['El molino', 'El muelle'], random: createSeededRandom(1), protectedNames: people.map(p => p.name) })).toBeNull();
    });
});

describe('la fila de fichas: con cuatro respuestas, la escalera sigue cabiendo', () => {
    test('la escalera va la primera, aunque se esté hablando con alguien y haya puertas', async () => {
        const { buildActionChips } = await import('../public/scripts/game-engine/ui/shell/action-chips.js');
        const replies = ['a', 'b', 'c', 'd'].map(id => ({ id: `reply-${id}`, label: id, icon: 'x', draft: id }));
        const chips = buildActionChips({ hasBoard: true, stairs: true, replies, doors: [{ x: 1, y: 1, distance: 1 }, { x: 2, y: 2, distance: 2 }] });
        expect(chips[0].id).toBe('stairs');
        expect(chips.filter(c => c.id.startsWith('reply-')).length).toBe(4);
    });
});
