import { describe, test, expect, beforeAll } from '@jest/globals';
import { readFileSync } from 'node:fs';
import {
    readDialogues, readDialogue, startDialogue, choose, dialogueView, rememberDialogue, checkDialogues,
} from '../public/scripts/game-engine/campaign/dialogues.js';
import {
    setPhraseBank, phraseBank, followUpLine, humanNote, townGreeting, noteGreeting, knowsYou, readGreetMemory,
    beatVariant, altMatches, checkBeatAlts, toWhom, attitudeBand, hourOf, rememberChoices, readChoices, pickPhrase,
    HUMAN_KINDS,
} from '../public/scripts/game-engine/campaign/human-lines.js';
import { readSceneBeats, checkPlotScenes } from '../public/scripts/game-engine/campaign/plot-scenes.js';
import { validatePack } from '../public/scripts/game-engine/campaign/campaign-pack.js';

const pack = (/** @type {string} */ id) => JSON.parse(readFileSync(new URL(`../public/mundos/${id}.pack.json`, import.meta.url), 'utf8'));
const frases = JSON.parse(readFileSync(new URL('../public/compendio/frases.json', import.meta.url), 'utf8')).rows;

const hero = (/** @type {any} */ extra = {}) => ({
    name: 'Tessa', race: 'Humano', class: 'Guerrero', gender: 'Mujer', background: '', level: 1,
    strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, ...extra,
});
const brunilda = () => /** @type {any} */ (readDialogues(pack('gremio').dialogues).find(d => d.id === 'brunilda-la-casa'));
const npcLines = (/** @type {any} */ state) => state.log.filter((/** @type {any} */ l) => l.kind === 'npc').map((/** @type {any} */ l) => l.text);

beforeAll(() => setPhraseBank(frases));

describe('J13.8: volver al principio de una charla no es volver otro día', () => {
    test('«Entiendo» tras lo de la veterana: Brunilda contesta a eso y sigue, sin «¿Otra vez tú?»', () => {
        const me = hero({ class: 'Soldado' });
        const world = { open: ['el-gremio'], done: [] };
        let state = startDialogue(brunilda(), { hero: me, world });
        state = choose(state, 'veterana', { hero: me, world }).state;
        const back = choose(state, 'veterana-vale', { hero: me, world });
        expect(back.view?.line).toBe('No hace falta que lo entiendas. Con que vuelvas, me basta.');
        expect(back.view?.mood).toBe('triste');
        expect(npcLines(back.state).join(' ')).not.toMatch(/Otra vez/);
        // Está otra vez en el principio: sus opciones, menos lo ya dicho.
        expect(back.view?.options.map(o => o.id)).toEqual(expect.arrayContaining(['quiero-entrar', 'como-funciona']));
        expect(back.view?.options.map(o => o.id)).not.toContain('veterana');
    });

    test('sin respuesta escrita, lo que el nudo dice para seguir (`more`), cada vez una', () => {
        const me = hero({ race: 'Enano' });
        const world = { open: ['el-gremio'], done: [] };
        let state = startDialogue(brunilda(), { hero: me, world });
        state = choose(state, 'enano', { hero: me, world }).state;
        const first = choose(state, 'enano-sigue', { hero: me, world });
        const more = /** @type {string[]} */ (brunilda().nodes.find((/** @type {any} */ n) => n.id === 'inicio').more);
        expect(more).toContain(first.view?.line);
        let again = choose(first.state, 'como-funciona', { hero: me, world }).state;
        again = choose(again, 'gremio-vale', { hero: me, world }).state;
        // «Entendido» trae su respuesta; la siguiente vuelta sin respuesta dice otra frase de `more`.
        expect(npcLines(again).slice(-1)[0]).toBe('Bien. Lo demás se aprende fuera.');
    });

    test('una charla sin nada escrito para seguir usa una frase corta del compendio', () => {
        const d = readDialogue({
            id: 'x', speaker: 'Marta', start: 'inicio',
            nodes: [
                { id: 'inicio', line: 'Llegas tarde.', again: 'Tú otra vez.', options: [{ id: 'a', text: 'Hola.', next: 'hola' }, { id: 'b', text: 'Adiós.', end: true, repeat: true }] },
                { id: 'hola', line: 'Hola, hola.', options: [{ id: 'volver', text: 'Sigamos.', next: 'inicio' }] },
            ],
        });
        const once = choose(startDialogue(/** @type {any} */ (d)), 'a', { hero: hero() });
        const back = choose(once.state, 'volver', { hero: hero(), world: { attitude: -2 } });
        const rows = frases.filter((/** @type {any} */ r) => r.kind === 'charla-sigue' && r.when?.actitud === 'mala').map((/** @type {any} */ r) => r.text);
        expect(rows).toContain(back.view?.line);
        // Y otro día, sí: «Tú otra vez».
        const memory = rememberDialogue(null, back.state);
        expect(dialogueView(startDialogue(/** @type {any} */ (d), { memory }), hero()).line).toBe('Tú otra vez.');
    });

    test('pedir dos veces el mismo consejo: lo resume, no lo repite palabra por palabra', () => {
        const me = hero();
        const world = { open: ['el-gremio', 'la-prueba'], done: [] };
        let state = startDialogue(brunilda(), { hero: me, world });
        state = choose(state, 'quiero-entrar', { hero: me, world }).state;
        state = choose(state, 'prueba-consejo', { hero: me, world }).state;
        expect(npcLines(state).slice(-1)[0]).toMatch(/^Pelea con la pared a la espalda/);
        const thanks = choose(state, 'consejo-gracias', { hero: me, world });
        expect(thanks.view?.line).toBe('No me las des. Sube entera y me las das arriba.');
        state = choose(thanks.state, 'bodega', { hero: me, world }).state;
        state = choose(state, 'bodega-consejo', { hero: me, world }).state;
        expect(npcLines(state).slice(-1)[0]).toMatch(/^Ya te lo he dicho/);
    });

    test('otro día, el saludo según lo que toca: de vuelta de la bodega, pregunta por las ratas', () => {
        const me = hero();
        const memory = rememberDialogue(null, startDialogue(brunilda(), { hero: me }));
        const back = (/** @type {any} */ world) => dialogueView(startDialogue(brunilda(), { memory, hero: me, world }), me, world).line;
        expect(back({ open: ['el-tablon'], done: ['la-prueba'] })).toMatch(/Has subido por tu pie/);
        expect(back({ open: ['la-prueba'], done: ['el-gremio'] })).toMatch(/Todavía aquí/);
        const plain = brunilda().nodes[0].agains.filter((/** @type {any} */ a) => a.when.length === 0).map((/** @type {any} */ a) => a.text);
        expect(plain).toContain(back({ open: [], done: ['el-tablon'], day: 3 }));
        // Y cambia según el día.
        const days = new Set([1, 2, 3, 4, 5, 6, 7].map(day => back({ open: [], done: ['el-tablon'], day })));
        expect(days.size).toBeGreaterThan(1);
    });

    test('una charla recuerda lo que hiciste en una escena (`chose`)', () => {
        const d = readDialogue({
            id: 'x', speaker: 'Tomás', start: 'inicio',
            nodes: [{
                id: 'inicio', line: 'Hola.',
                options: [
                    { id: 'cobro', text: 'Lo de las tres monedas…', if: { chose: 'cuanto-pagas' }, end: true },
                    { id: 'adios', text: 'Adiós.', end: true },
                ],
            }],
        });
        const seen = (/** @type {string[]} */ chose) => dialogueView(startDialogue(/** @type {any} */ (d)), hero(), { chose }).options.map(o => o.id);
        expect(seen(['cuanto-pagas'])).toContain('cobro');
        expect(seen(['yo-me-encargo'])).not.toContain('cobro');
    });

    test('lo nuevo se comprueba al importar: respuestas y saludos con marcas bien escritas', () => {
        const bad = checkDialogues([{
            id: 'x', speaker: 'Brunilda',
            nodes: [{
                id: 'a', line: 'Hola', again: [{ if: { milestone: 'nada' }, text: 'Hola {a|b' }, 3], more: ['Sigue {ya|yo'],
                options: [{ text: 'Vale', reply: {}, next: 'a' }],
            }],
        }], { people: ['Brunilda'], milestones: ['algo'] });
        const paths = bad.errors.map(e => e.path);
        expect(paths).toEqual(expect.arrayContaining([
            'dialogues[0].nodes[0].again[0].text', 'dialogues[0].nodes[0].again[0].if.milestone', 'dialogues[0].nodes[0].again[1]',
            'dialogues[0].nodes[0].more[0]', 'dialogues[0].nodes[0].options[0].reply',
        ]));
        for (const id of ['gremio', '1387', 'strahd']) expect(validatePack(pack(id)).errors).toEqual([]);
    });
});

describe('J13.8: cómo te mira alguien, dicho como lo diría quien mira', () => {
    test('«os mira mejor» y «os mira peor» pasan a ser gestos; lo demás, tal cual', () => {
        const better = humanNote('Brunilda os mira mejor.', { seed: 'a', turn: 0 });
        expect(better).toMatch(/Brunilda/);
        expect(better).not.toMatch(/os mira/);
        const rows = frases.filter((/** @type {any} */ r) => r.kind === 'mirada-peor');
        const worse = new Set([0, 1, 2, 3, 4, 5, 6, 7].map(turn => humanNote('El Tuerto os mira peor.', { seed: 'b', turn })));
        expect(worse.size).toBeGreaterThan(4);
        for (const line of worse) expect(line).not.toMatch(/\bA El\b|\ba El\b/);
        expect(rows.length).toBeGreaterThanOrEqual(8);
        expect(humanNote('+5 de oro.')).toBe('+5 de oro.');
        expect(toWhom('El Tuerto')).toBe('al Tuerto');
        expect(toWhom('Brunilda')).toBe('a Brunilda');
    });

    test('sin banco, frases de reserva: nunca se queda sin decir nada', () => {
        const before = phraseBank();
        setPhraseBank([]);
        try {
            expect(humanNote('Giles os mira mejor.')).toMatch(/Giles/);
            expect(followUpLine({ attitude: 0, seed: 'x' })).toBeTruthy();
        } finally {
            setPhraseBank(before);
        }
    });
});

describe('J13.8: el saludo de quien atiende un sitio', () => {
    const place = (/** @type {string} */ kind, /** @type {string} */ name) => ({ kind, keeper: { name, trade: '' }, people: [], cards: [] });

    test('la primera vez no sabe tu nombre; la siguiente, sí', () => {
        for (const [kind, name] of [['herreria', 'Ramiro'], ['tienda', 'Marisa'], ['posada', 'Alguien'], ['templo', 'Madre Elvira'], ['gremio', 'Brunilda']]) {
            for (let turn = 0; turn < 6; turn++) {
                const first = townGreeting({ place: place(kind, name), slot: 'Mañana', hero: hero(), met: false, seed: 's', turn });
                expect(first).toBeTruthy();
                expect(first).not.toMatch(/Tessa/);
            }
            const lines = [0, 1, 2, 3, 4, 5].map(turn => townGreeting({ place: place(kind, name), slot: 'Tarde', hero: hero(), met: true, seed: 's', turn }));
            expect(lines.some(line => /Tessa/.test(line))).toBe(true);
            // Y no siempre la misma.
            expect(new Set(lines).size).toBeGreaterThan(1);
        }
    });

    test('cada uno con su voz: Madre Elvira te llama «hija» o «hijo»; Ramiro se presenta con el martillo en la mano', () => {
        const elvira = [0, 1, 2, 3].map(turn => townGreeting({ place: place('templo', 'Madre Elvira'), slot: 'Mañana', hero: hero(), met: true, seed: 'e', turn }));
        expect(elvira.some(line => /\bhija\b/.test(line))).toBe(true);
        expect(elvira.some(line => /\bhijo\b/.test(line))).toBe(false);
        const him = [0, 1, 2, 3].map(turn => townGreeting({ place: place('templo', 'Madre Elvira'), slot: 'Mañana', hero: hero({ gender: 'Hombre', name: 'Bran' }), met: true, seed: 'e', turn }));
        expect(him.some(line => /\bhijo\b/.test(line))).toBe(true);
        const ramiro = [0, 1, 2, 3, 4, 5, 6, 7].map(turn => townGreeting({ place: place('herreria', 'Ramiro'), slot: 'Mañana', hero: hero(), met: false, seed: 'r', turn }));
        expect(ramiro.some(line => /Ramiro\. Herrero|Soy Ramiro/.test(line))).toBe(true);
    });

    test('de noche y según te mire; cerrado, nada (vale el cartel)', () => {
        const night = [0, 1, 2, 3, 4, 5].map(turn => townGreeting({ place: place('posada', 'Tomás'), slot: 'Noche', hero: hero(), met: true, seed: 'n', turn }));
        expect(night.some(line => /Buenas noches|medio vacía/.test(line))).toBe(true);
        expect(night.every(line => !/Buenos días/.test(line))).toBe(true);
        const cold = [0, 1, 2, 3, 4, 5].map(turn => townGreeting({ place: place('tienda', 'Marisa'), slot: 'Tarde', hero: hero(), met: true, attitude: -2, seed: 'm', turn }));
        expect(cold.some(line => /no te quita ojo/.test(line))).toBe(true);
        expect(cold.every(line => !/apartado lo mejor/.test(line))).toBe(true);
        expect(townGreeting({ place: { ...place('tienda', 'Marisa'), closed: 'Cerrado' }, hero: hero() })).toBe('');
        expect(townGreeting({ place: { kind: 'plaza', keeper: null }, hero: hero() })).toBe('');
    });

    test('la primera vez, a veces se fija en tu clase', () => {
        const priest = hero({ class: 'Clérigo' });
        const lines = [0, 1, 2, 3, 4, 5, 6, 7].map(turn => townGreeting({ place: place('posada', 'Alguien'), slot: 'Tarde', hero: priest, met: false, seed: 'c', turn }));
        expect(lines.some(line => /símbolo sagrado/.test(line))).toBe(true);
        const known = [0, 1, 2, 3, 4, 5, 6, 7].map(turn => townGreeting({ place: place('posada', 'Alguien'), slot: 'Tarde', hero: priest, met: true, seed: 'c', turn }));
        expect(known.some(line => /símbolo sagrado/.test(line))).toBe(false);
        // «Pícara» (la clase del creador) vale para la frase escrita para «Pícaro».
        const thief = [0, 1, 2, 3, 4, 5, 6, 7].map(turn => townGreeting({ place: place('tienda', 'Alguien'), slot: 'Tarde', hero: hero({ class: 'Pícara' }), met: false, seed: 'p', turn }));
        expect(thief.some(line => /mano a la bolsa/.test(line))).toBe(true);
    });

    test('visita tras visita, ninguna frase vuelve antes de tres visitas, a ninguna hora ni con ninguna cara', () => {
        for (const [kind, name] of [['gremio', 'Brunilda'], ['posada', 'Tomás'], ['herreria', 'Ramiro'], ['tienda', 'Marisa'], ['templo', 'Madre Elvira'], ['posada', 'Alguien'], ['herreria', 'Alguien'], ['tienda', 'Alguien'], ['templo', 'Alguien'], ['gremio', 'Alguien']]) {
            for (const slot of ['Mañana', 'Tarde', 'Noche']) {
                for (const attitude of [2, 0, -2]) {
                    const lines = Array.from({ length: 12 }, (_, turn) => townGreeting({ place: place(kind, name), slot, hero: hero(), met: true, attitude, seed: `${kind}${name}`, turn }));
                    expect(new Set(lines).size).toBeGreaterThanOrEqual(4);
                    lines.forEach((line, i) => expect(lines.slice(Math.max(0, i - 3), i)).not.toContain(line));
                }
            }
        }
    });

    test('quien te tiene manía no te recibe con una sonrisa', () => {
        for (const [kind, name] of [['posada', 'Tomás'], ['tienda', 'Marisa'], ['posada', 'Alguien'], ['tienda', 'Alguien']]) {
            const lines = Array.from({ length: 10 }, (_, turn) => townGreeting({ place: place(kind, name), slot: 'Tarde', hero: hero(), met: true, attitude: -2, seed: 'x', turn }));
            expect(lines.join(' ')).not.toMatch(/sonríe|Mira quién está aquí|ha pasado de todo|lo de siempre/);
        }
    });

    test('lo que recuerda de tus visitas: la primera dura toda esa franja; luego ya te conoce', () => {
        let memory = noteGreeting(null, 'Ramiro', '1|mañana');
        expect(knowsYou(memory, 'Ramiro', '1|mañana')).toBe(false);
        memory = noteGreeting(memory, 'Ramiro', '1|mañana');
        expect(readGreetMemory(memory).ramiro.visits).toBe(1);
        memory = noteGreeting(memory, 'Ramiro', '1|tarde');
        expect(knowsYou(memory, 'Ramiro', '1|tarde')).toBe(true);
        expect(readGreetMemory(memory).ramiro.visits).toBe(2);
        expect(knowsYou(null, 'Tomás', '1|mañana', true)).toBe(true);
        expect(readGreetMemory({ x: 'roto', '': { first: '1|a' } })).toEqual({});
    });

    test('las bandas y las horas, como las escriben las frases', () => {
        expect([attitudeBand(2), attitudeBand(0), attitudeBand(-1)]).toEqual(['buena', 'neutra', 'mala']);
        expect([hourOf('Mañana'), hourOf('night'), hourOf('Tarde'), hourOf('')]).toEqual(['mañana', 'noche', 'tarde', '']);
    });
});

describe('J13.8: las escenas se acuerdan de lo que hiciste', () => {
    const charla = () => pack('gremio').plot.milestones.find((/** @type {any} */ m) => m.id === 'la-charla');
    const gremio = () => pack('gremio').plot.milestones.find((/** @type {any} */ m) => m.id === 'el-gremio');

    test('si le cobraste a Tomás, Tomás y Brunilda lo dicen', () => {
        const paid = readSceneBeats(charla().beats, { id: 'la-charla', hero: hero(), chose: ['cuanto-pagas'] });
        const kind = readSceneBeats(charla().beats, { id: 'la-charla', hero: hero(), chose: ['yo-me-encargo'] });
        // D-J60: empieza el ratero mientras se lo llevan; Tomás habla en la segunda.
        expect(paid[1].text).toMatch(/aunque me hayas cobrado/);
        expect(paid[1].mood).toBe('neutral');
        expect(kind[1].text).toMatch(/Te debo una/);
        expect(paid[2].text).toMatch(/tres monedas/);
        // La decisión sigue en su sitio, con sus opciones.
        expect(paid[2].decision?.dialogue.nodes[0].options.map(o => o.id)).toEqual(['una-cerveza', 'unas-monedas', 'que-se-cuenta']);
        // D-J60: en la Casa del Gremio ya no hay línea del narrador: empieza Tomás.
        const told = readSceneBeats(gremio().beats, { id: 'el-gremio', hero: hero(), chose: ['cuanto-pagas'] });
        expect(told[0].text).toMatch(/Cobrando, eso sí/);
        expect(told[1].text).toMatch(/lo de las tres monedas/);
    });

    test('Brunilda se fija en tu clase al preguntarte qué te trae', () => {
        const ask = (/** @type {any} */ who) => readSceneBeats(gremio().beats, { id: 'el-gremio', hero: who })[3].text;
        expect(ask(hero({ class: 'Pícaro' }))).toMatch(/no se roba/);
        expect(ask(hero({ class: 'Maga' }))).toMatch(/chispas/);
        expect(ask(hero({ class: 'Soldado' }))).toMatch(/primera pelea/);
        expect(ask(hero({ class: 'Bardo' }))).toBe('Aquí se vuelve con oro, aunque no siempre vuelven todos. ¿Qué te trae a Puerto Alba?');
    });

    test('las versiones: la primera que vale manda; sin ninguna, la línea tal cual', () => {
        const line = { who: 'X', text: 'Base', alt: [{ if: { chose: 'a' }, text: 'Por a' }, { if: { species: 'Enano' }, text: 'Enano', mood: 'alegre' }] };
        expect(beatVariant(line, { chose: ['a'] }).text).toBe('Por a');
        expect(beatVariant(line, { hero: { race: 'Enana' } })).toEqual(expect.objectContaining({ text: 'Enano', mood: 'alegre', who: 'X' }));
        expect(beatVariant(line, {}).text).toBe('Base');
        expect(beatVariant('suelta', {})).toBe('suelta');
        expect(altMatches({ gender: 'Mujer' }, { hero: { gender: 'Mujer' } })).toBe(true);
        expect(altMatches({ background: 'soldado' }, { hero: { background: 'Soldado' } })).toBe(true);
        expect(altMatches(null, {})).toBe(false);
    });

    test('lo mal escrito en las versiones se dice al importar', () => {
        expect(checkBeatAlts('no', 'p').errors).toHaveLength(1);
        const found = checkBeatAlts([{ text: '' }, { text: 'Hola' }, { if: { luna: 'llena' }, text: 'Hola' }], 'p');
        expect(found.errors.map(e => e.path)).toEqual(['p[0]', 'p[1].if']);
        expect(found.warnings.map(e => e.path)).toEqual(['p[2].if.luna']);
        const plot = { milestones: [{ id: 'a', scene: 'x', beats: [{ text: 'Hola', alt: [{ if: { chose: 'b' }, text: 'Hola {a|b' }] }] }] };
        expect(checkPlotScenes(plot).errors.map(e => e.path)).toContain('plot.milestones[0].beats[0].alt[0].text');
    });

    test('lo elegido se guarda una vez, sin pasarse', () => {
        expect(rememberChoices(['a'], ['b', 'a', ''])).toEqual(['a', 'b']);
        expect(readChoices('roto')).toEqual([]);
        expect(readChoices(Array.from({ length: 300 }, (_, i) => `o${i}`))).toHaveLength(200);
    });
});

describe('J13.8: las tablas del compendio', () => {
    test('cada clase de frase tiene al menos ocho, y se rellenan sin huecos', () => {
        for (const kind of HUMAN_KINDS) expect(frases.filter((/** @type {any} */ r) => r.kind === kind).length).toBeGreaterThanOrEqual(8);
        for (const band of ['buena', 'neutra', 'mala']) {
            expect(frases.filter((/** @type {any} */ r) => r.kind === 'charla-sigue' && r.when?.actitud === band).length).toBeGreaterThanOrEqual(8);
        }
        // Cada sitio con quien atiende tiene su primera vez y su «ya te conozco», sin frases de una persona.
        for (const servicio of ['gremio', 'posada', 'herreria', 'tienda', 'templo']) {
            for (const primera of ['sí', 'no']) {
                const generic = frases.filter((/** @type {any} */ r) => r.kind === 'saludo' && r.when?.servicio === servicio && r.when?.primera === primera && !r.when?.persona);
                expect(generic.length).toBeGreaterThanOrEqual(2);
            }
        }
        // Todas se leen enteras con lo que da el juego.
        const facts = { quien: 'Ramiro', a_quien: 'a Ramiro', hola: 'Buenas tardes', nombre: 'Tessa' };
        for (const row of frases.filter((/** @type {any} */ r) => HUMAN_KINDS.includes(r.kind))) {
            // Una condición con varios valores («buena» o «neutra») se prueba con el primero.
            const when = Object.fromEntries(Object.entries(row.when ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
            const said = pickPhrase(row.kind, { ...facts, ...when }, { rows: [row], who: { heroe: hero() } });
            expect(said).toBeTruthy();
            expect(said).not.toMatch(/[{}|]/);
        }
    });

    test('quien aún no te conoce no dice tu nombre: ninguna frase de primera vez lo lleva', () => {
        for (const row of frases.filter((/** @type {any} */ r) => r.kind === 'saludo' && r.when?.primera !== 'no')) {
            expect(row.text).not.toMatch(/\{nombre\}/);
        }
    });
});

describe('J13.8: la gente del pueblo tiene su charla, y se acuerda', () => {
    const gremio = () => readDialogues(pack('gremio').dialogues);

    test('Tomás, Ramiro, Marisa y Madre Elvira tienen charla escrita, con su vuelta y sus respuestas', () => {
        const people = pack('gremio').npcs.map((/** @type {any} */ n) => n.name);
        for (const name of ['Tomás', 'Ramiro', 'Marisa', 'Madre Elvira']) {
            const d = /** @type {any} */ (gremio().find(x => x.speaker === name));
            expect(d).toBeTruthy();
            expect(people).toContain(d.speaker);
            const start = d.nodes.find((/** @type {any} */ n) => n.id === d.start);
            // Al volver otro día, varias frases; al seguir la charla, otras.
            expect(start.agains?.length ?? 0).toBeGreaterThanOrEqual(3);
            expect(start.more?.length ?? 0).toBeGreaterThanOrEqual(3);
            // Lo que vuelve al principio sin que quien habla conteste algo, solo los temas.
            const back = d.nodes.flatMap((/** @type {any} */ n) => n.options).filter((/** @type {any} */ o) => o.next === d.start);
            expect(back.length).toBeGreaterThan(0);
            for (const option of back) expect(option.reply?.text).toBeTruthy();
        }
        expect(validatePack(pack('gremio')).errors).toEqual([]);
    });

    test('Madre Elvira te llama «hija» o «hijo», y nadie dice «Otra vez tú» sin haberse ido', () => {
        const elvira = /** @type {any} */ (gremio().find(x => x.speaker === 'Madre Elvira'));
        const her = hero();
        let state = startDialogue(elvira, { hero: her, world: {} });
        expect(state.log[0].text).toMatch(/\bhija\b/);
        state = choose(state, 'las-tumbas', { hero: her, world: {} }).state;
        const back = choose(state, 'por-que-los-sabes', { hero: her, world: {} });
        expect(back.view?.line).toMatch(/alguien tiene que acordarse/);
        expect(npcLines(back.state).join(' ')).not.toMatch(/Otra vez/);
        const him = startDialogue(elvira, { hero: hero({ gender: 'Hombre' }), world: {} });
        expect(him.log[0].text).toMatch(/\bhijo\b/);
    });

    test('Tomás se acuerda de si le cobraste en el muelle', () => {
        const tomas = /** @type {any} */ (gremio().find(x => x.speaker === 'Tomás'));
        const ids = (/** @type {string[]} */ chose) => (dialogueView(startDialogue(tomas, { hero: hero(), world: { chose } }), hero(), { chose }).options ?? []).map(o => o.id);
        expect(ids(['cuanto-pagas'])).toContain('tres-monedas');
        expect(ids(['cuanto-pagas'])).not.toContain('esa-cerveza');
        expect(ids(['una-cerveza'])).toContain('esa-cerveza');
        expect(ids([])).not.toContain('tres-monedas');
    });

    test('Ismark, otro día, se acuerda de la noche que le hiciste guardia', () => {
        const ismark = /** @type {any} */ (readDialogues(pack('strahd').dialogues).find(d => d.speaker === 'Ismark Kolyanovich'));
        const memory = rememberDialogue(null, { ...startDialogue(ismark, { hero: hero(), world: {} }), chosen: ['ireena', 'calar', 'vigilo'] });
        const later = startDialogue(ismark, { memory, hero: hero(), world: { day: 3 } });
        expect(later.log[0].text).toMatch(/Dormí/);
        const plain = startDialogue(ismark, { memory: rememberDialogue(null, startDialogue(ismark, { hero: hero(), world: {} })), hero: hero(), world: { day: 3 } });
        expect(plain.log[0].text).not.toMatch(/Dormí/);
    });
});
