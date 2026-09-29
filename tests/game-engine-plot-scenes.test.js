import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import {
    readSceneBeats, sceneBackdrop, milestoneScene, stepScenes, rememberScene, sceneOptions, chooseInScene,
    applySceneEffects, sceneTranscript, sceneDecisions, checkPlotScenes, SCENE_LIMITS,
} from '../public/scripts/game-engine/campaign/plot-scenes.js';
import { readPlot, startPlot, plotEvent } from '../public/scripts/game-engine/campaign/plot.js';
import { readDialogues } from '../public/scripts/game-engine/campaign/dialogues.js';
import { validatePack } from '../public/scripts/game-engine/campaign/campaign-pack.js';
import {
    getSectionSchema, SECTION_ORDER, buildCampaignPackSchema, buildGemInstructions, getPackRules,
} from '../public/scripts/game-engine/campaign/campaign-pack-schema.js';
import { sceneFrames, choiceFrames } from '../public/scripts/game-engine/ui/plot-scene.js';
import { artFor, readManifest } from '../public/scripts/game-engine/ui/pixel-art.js';

const pack = (/** @type {string} */ id) => JSON.parse(readFileSync(new URL(`../public/mundos/${id}.pack.json`, import.meta.url), 'utf8'));
const manifest = JSON.parse(readFileSync(new URL('../public/img/game-engine/pixel/manifest.json', import.meta.url), 'utf8'));

/** Una heroína con fichas de 10: tira con +0 salvo competencias. */
const hero = (/** @type {any} */ extra = {}) => ({
    name: 'Ada', race: 'Humana', class: 'Guerrera', gender: 'Mujer', background: '', level: 1,
    strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, ...extra,
});

/** Un hito con su escena escrita, con todo lo que hay que probar. */
const milestone = (/** @type {any} */ extra = {}) => ({
    id: 'el-muelle',
    title: 'El ratero del muelle',
    scene: 'Llegas {cansado|cansada} al muelle.',
    backdrop: 'muelle',
    beats: [
        'Huele a sal.',
        { who: 'Tomás', mood: 'enfadado', text: '¡Al ladrón!' },
        { who: 'Tomás', mood: 'raro', text: '' },
        {
            who: 'Tomás', mood: 'triste', text: '¿Me ayudas, {forastero|forastera}?',
            options: [
                { id: 'si', text: 'Yo me encargo.', effects: [{ attitude: 1 }], reply: { who: 'Tomás', mood: 'alegre', text: '¡Gracias, {amigo|amiga}!' } },
                { id: 'enano', text: 'Los enanos no huimos.', if: { species: 'Enano' }, effects: [{ gold: 1 }] },
                { id: 'pagar', text: 'Te lo cambio por la bolsa.', if: { gold: 5 }, effects: [{ gold: -5 }] },
                {
                    id: 'convencer', text: '¿Cuánto me das?',
                    check: {
                        skill: 'persuasion', dc: 12,
                        success: { effects: [{ gold: 3 }], reply: [{ who: 'Tomás', mood: 'alegre', text: 'Tres monedas.' }, 'Te las da.'] },
                        failure: { effects: [{ attitude: -1 }], reply: { who: 'Tomás', mood: 'enfadado', text: 'Ni una.' } },
                    },
                },
            ],
        },
        { text: 'El ratero saca un cuchillo.' },
    ],
    ...extra,
});

describe('leer una escena (J9.2)', () => {
    test('las líneas: un texto suelto es del narrador, la que no dice nada se cae y el gesto raro es neutral', () => {
        const beats = readSceneBeats(milestone().beats, { id: 'el-muelle', hero: hero() });
        expect(beats.map(b => b.who)).toEqual(['', 'Tomás', 'Tomás', '']);
        expect(beats[1].mood).toBe('enfadado');
        expect(readSceneBeats([{ text: 'x', mood: 'furioso' }])[0].mood).toBe('neutral');
        expect(beats[2].text).toBe('¿Me ayudas, forastera?');
        expect(beats[2].decision?.dialogue.nodes[0].options.map(o => o.id)).toEqual(['si', 'enano', 'pagar', 'convencer']);
        expect(beats[0].decision).toBeNull();
        expect(readSceneBeats('no')).toEqual([]);
    });

    test('el fondo: un sitio del pueblo va a su dibujo; lo demás es una localización', () => {
        expect(sceneBackdrop('muelle')).toEqual({ place: 'muelle', town: '' });
        expect(sceneBackdrop('El muelle')).toEqual({ place: 'muelle', town: '' });
        expect(sceneBackdrop('Castillo de Vane')).toEqual({ place: '', town: 'Castillo de Vane' });
        expect(sceneBackdrop('')).toEqual({ place: '', town: '' });
    });

    test('el hilo guarda la escena al leerse, y un hito sin ella se lee como siempre', () => {
        const plot = /** @type {any} */ (readPlot({ milestones: [milestone({ sceneDialogue: 'charla' }), { id: 'b', title: 'B', scene: 'Nada.' }] }));
        expect(plot.milestones[0].beats).toHaveLength(5);
        expect(plot.milestones[0].sceneDialogue).toBe('charla');
        expect(plot.milestones[0].backdrop).toBe('muelle');
        expect(Object.keys(plot.milestones[1])).not.toEqual(expect.arrayContaining(['beats']));
        expect('sceneDialogue' in plot.milestones[1] || 'backdrop' in plot.milestones[1]).toBe(false);
    });
});

describe('qué se enseña al abrirse un hito', () => {
    test('con líneas, se juega; sin ellas, el texto de siempre; sin nada, nada', () => {
        const scene = milestoneScene(milestone(), { hero: hero() });
        expect(scene.kind).toBe('scene');
        expect(scene.text).toBe('Llegas cansada al muelle.');
        expect(scene.backdrop).toEqual({ place: 'muelle', town: '' });
        expect(milestoneScene({ id: 'x', title: 'X', scene: 'Solo texto.' }).kind).toBe('text');
        expect(milestoneScene({ id: 'x', title: 'X' }).kind).toBe('none');
        expect(milestoneScene(null).kind).toBe('none');
    });

    test('lo oculto no se enseña hasta cumplirse; cumplido, es el secreto encontrado', () => {
        const secret = milestone({ hidden: true });
        expect(milestoneScene(secret, { state: { open: ['el-muelle'] } }).kind).toBe('none');
        expect(milestoneScene(secret, { state: { done: ['el-muelle'] } }).kind).toBe('scene');
    });

    test('una escena ya jugada no se juega dos veces: vuelve a ser texto', () => {
        expect(milestoneScene(milestone(), { played: ['el-muelle'] }).kind).toBe('text');
        expect(rememberScene(['a'], 'el-muelle')).toEqual(['a', 'el-muelle']);
        expect(rememberScene(['el-muelle'], 'el-muelle')).toEqual(['el-muelle']);
    });

    test('la charla que sigue: leída o tal cual, y sola también es escena', () => {
        const raw = [{ id: 'charla', speaker: 'Giles', nodes: [{ id: 'a', line: 'Hola.', options: [{ id: 'x', text: 'Adiós.', if: { gold: 2 }, end: true }] }] }];
        const withRaw = milestoneScene(milestone({ sceneDialogue: 'charla' }), { dialogues: raw });
        const withRead = milestoneScene(milestone({ sceneDialogue: 'charla' }), { dialogues: readDialogues(raw) });
        expect(withRaw.dialogue?.speaker).toBe('Giles');
        // Leer dos veces una charla la estropearía: la condición de la opción sigue ahí.
        expect(withRead.dialogue?.nodes[0].options[0].when).toEqual([{ gold: 2 }]);
        const alone = milestoneScene({ id: 'x', title: 'X', scene: 'Texto.', sceneDialogue: 'charla' }, { dialogues: raw });
        expect(alone.kind).toBe('scene');
        expect(alone.beats).toEqual([]);
        expect(milestoneScene({ id: 'x', title: 'X', scene: 'Texto.', sceneDialogue: 'otra' }, { dialogues: raw }).kind).toBe('text');
    });

    test('las escenas de un paso: los secretos encontrados y lo que se abre, menos lo oculto', () => {
        const plot = /** @type {any} */ (readPlot({
            milestones: [
                { id: 'a', title: 'A', scene: 'Empieza.', opens: { kind: 'start' }, asks: { kind: 'arrive', place: 'X' }, beats: ['Llegas.'] },
                { id: 'b', title: 'B', scene: 'Sigue.', opens: { kind: 'after', milestone: 'a' }, asks: { kind: 'arrive', place: 'Y' } },
                { id: 'c', title: 'C', scene: 'Secreto.', hidden: true, opens: { kind: 'after', milestone: 'a' }, asks: { kind: 'arrive', place: 'X' } },
            ],
        }));
        const start = startPlot(plot);
        expect(stepScenes(start).map(s => [s.milestone.id, s.scene.kind])).toEqual([['a', 'scene']]);
        const step = plotEvent(plot, start.state, { kind: 'arrive', place: 'X' }, 1);
        expect(stepScenes(step).map(s => [s.milestone.id, s.scene.kind])).toEqual([['b', 'text']]);
        const found = plotEvent(plot, step.state, { kind: 'arrive', place: 'X' }, 1);
        expect(stepScenes(found).map(s => [s.milestone.id, s.scene.kind])).toEqual([['c', 'text']]);
        expect(stepScenes(start, { played: ['a'] }).map(s => s.scene.kind)).toEqual(['text']);
    });
});

describe('decidir en una escena, con las reglas de las charlas', () => {
    const scene = milestoneScene(milestone(), { hero: hero() });

    test('las opciones: lo de quién eres solo a quien encaja, lo que se gana apagado y la tirada con su CD', () => {
        const human = sceneOptions(scene, 2, { hero: hero(), world: {} });
        expect(human.map(o => o.id)).toEqual(['si', 'pagar', 'convencer']);
        expect(human.find(o => o.id === 'pagar')?.locked).toMatch(/5 monedas/);
        expect(human.find(o => o.id === 'convencer')?.check).toMatchObject({ label: 'Persuasión', dc: 12 });
        const dwarf = sceneOptions(scene, 2, { hero: hero({ race: 'Enana' }), world: { attitude: 1 } });
        expect(dwarf.find(o => o.id === 'enano')?.tag).toBe('Enano');
        // Quien os aprecia se deja convencer mejor.
        expect(dwarf.find(o => o.id === 'convencer')?.check?.dc).toBe(11);
        expect(sceneOptions(scene, 0, { hero: hero() })).toEqual([]);
    });

    test('elegir: lo que dices, los efectos con quien habla y la respuesta con su género', () => {
        const result = chooseInScene(scene, 2, 'si', { hero: hero() });
        expect(result.ok).toBe(true);
        expect(result.said).toBe('Yo me encargo.');
        expect(result.effects).toEqual([{ kind: 'attitude', amount: 1, who: 'Tomás' }]);
        expect(result.reply).toEqual([{ who: 'Tomás', mood: 'alegre', text: '¡Gracias, amiga!' }]);
        expect(result.choice).toMatchObject({ beat: 2, option: 'si', outcome: null });
    });

    test('con tirada: bien, a medias (como bien, pagando) y mal, cada una con lo suyo', () => {
        const good = chooseInScene(scene, 2, 'convencer', { hero: hero(), rollD20: () => 15 });
        expect(good.outcome).toBe('bien');
        expect(good.effects).toEqual([{ kind: 'gold', amount: 3 }]);
        expect(good.reply.map(r => r.text)).toEqual(['Tres monedas.', 'Te las da.']);
        expect(good.reply[1].who).toBe('');
        const half = chooseInScene(scene, 2, 'convencer', { hero: hero(), rollD20: () => 10 });
        expect(half.outcome).toBe('medias');
        expect(half.reply.map(r => r.text)).toEqual(['Tres monedas.', 'Te las da.']);
        expect(half.effects.length).toBeGreaterThan(1);
        const bad = chooseInScene(scene, 2, 'convencer', { hero: hero(), rollD20: () => 2 });
        expect(bad.outcome).toBe('mal');
        expect(bad.effects).toEqual([{ kind: 'attitude', amount: -1, who: 'Tomás' }]);
        expect(bad.reply[0].mood).toBe('enfadado');
    });

    test('lo que no se puede elegir se rechaza, diciendo por qué', () => {
        expect(chooseInScene(scene, 2, 'pagar', { hero: hero() })).toMatchObject({ ok: false, reason: expect.stringMatching(/5 monedas/) });
        expect(chooseInScene(scene, 2, 'enano', { hero: hero() }).ok).toBe(false);
        expect(chooseInScene(scene, 0, 'si', { hero: hero() })).toMatchObject({ ok: false, reason: 'Aquí no hay nada que decidir.' });
    });

    test('lo que pasó, escrito: para el narrador, el chat y el Diario', () => {
        const choice = /** @type {any} */ (chooseInScene(scene, 2, 'convencer', { hero: hero(), rollD20: () => 15 }).choice);
        const lines = sceneTranscript(scene, [choice]);
        expect(lines).toEqual([
            'Huele a sal.',
            'Tomás: «¡Al ladrón!»',
            'Tomás: «¿Me ayudas, forastera?»',
            'Tú: «¿Cuánto me das?» (la tirada sale bien)',
            'Tomás: «Tres monedas.»',
            'Te las da.',
            'El ratero saca un cuchillo.',
        ]);
        expect(sceneTranscript(milestoneScene({ id: 'x', title: 'X', scene: 'Texto.' }))).toEqual(['Texto.']);
        expect(sceneDecisions(scene, [choice])).toEqual(['El ratero del muelle: «¿Cuánto me das?»']);
    });

    test('las pantallas de la ventana: una por línea, y lo que pasa al decidir', () => {
        const frames = sceneFrames(scene);
        expect(frames.map(f => [f.who, f.ask, f.lines[0].kind])).toEqual([['', false, 'narration'], ['Tomás', false, 'say'], ['Tomás', true, 'say'], ['', false, 'narration']]);
        const result = chooseInScene(scene, 2, 'convencer', { hero: hero(), rollD20: () => 15 });
        const after = choiceFrames(frames[2], result, ['+3 de oro.']);
        expect(after).toHaveLength(2);
        expect(after[0].lines.map(l => l.kind)).toEqual(['you', 'roll', 'say', 'note']);
        expect(after[1]).toMatchObject({ who: '', lines: [{ kind: 'narration', text: 'Te las da.' }] });
        const quiet = choiceFrames(frames[2], { ...result, reply: [], roll: null }, []);
        expect(quiet).toEqual([{ beat: 2, who: 'Tomás', mood: 'triste', lines: [{ kind: 'you', text: '¿Cuánto me das?' }], ask: false }]);
    });
});

describe('aplicar lo que cambia una decisión', () => {
    const rumors = [{ id: 'r1', by: 'Tomás', where: 'Puerto', text: 'Hay una cueva.', leadsTo: 'La cueva' }, { id: 'r2', text: 'Nada.' }];

    test('cómo os mira: un paso, entre −3 y +3, aunque ya cambiara hoy (lo escrito manda)', () => {
        const once = applySceneEffects([{ kind: 'attitude', amount: 1, who: 'Tomás' }], { day: 3, attitudes: { values: { Tomás: 1 }, changed: { Tomás: 3 } } });
        expect(once.attitudes).toEqual({ values: { Tomás: 2 }, changed: { Tomás: 3 } });
        expect(once.notes).toEqual(['Tomás os mira mejor.']);
        const top = applySceneEffects([{ kind: 'attitude', amount: 1, who: 'Tomás' }], { attitudes: { values: { Tomás: 3 } } });
        expect(top.attitudes.values.Tomás).toBe(3);
        expect(top.notes).toEqual([]);
        const back = applySceneEffects([{ kind: 'attitude', amount: -1, who: 'Tomás' }], { attitudes: { values: { Tomás: 1 } } });
        expect(back.attitudes.values).toEqual({});
        expect(applySceneEffects([{ kind: 'attitude', amount: 1, who: '' }]).notes).toEqual([]);
    });

    test('un rumor: se da por oído, con su día, y si lleva a un sitio lo pone en el mapa; dos veces no', () => {
        const out = applySceneEffects([{ kind: 'rumor', id: 'r1' }, { kind: 'rumor', id: 'r1' }], { rumors, day: 4, rumorsHeard: ['r2'] });
        expect(out.rumorsHeard).toEqual(['r2', 'r1']);
        expect(out.rumorsHeardOn).toEqual({ r1: 4 });
        expect(out.reveal).toEqual(['La cueva']);
        expect(out.heard).toEqual([{ id: 'r1', text: 'Hay una cueva.', by: 'Tomás' }]);
        expect(out.notes).toEqual(['Apuntado en el Diario: «Hay una cueva.»']);
        expect(applySceneEffects([{ kind: 'rumor', id: 'r2' }], { rumors, rumorsHeard: ['r2'] }).notes).toEqual([]);
    });

    test('oro, objetos, vínculo, pistas, un rato y los hitos: lo que es del grupo se devuelve para hacerlo', () => {
        const out = applySceneEffects([
            { kind: 'gold', amount: -5 }, { kind: 'give', item: 'Farol' }, { kind: 'take', item: 'pan' }, { kind: 'take', item: 'Nada' },
            { kind: 'bond', amount: 1, who: 'Bran' }, { kind: 'clue', text: 'Giles miente.' }, { kind: 'time' },
            { kind: 'milestone', id: 'la-charla' }, { kind: 'milestone', id: 'la-charla' }, { kind: 'unknown' },
        ], { gold: 3, items: ['Pan', 'Cuerda'] });
        expect(out.gold).toBe(0);
        expect(out.goldChange).toBe(-3);
        expect(out.items).toEqual(['Cuerda', 'Farol']);
        expect(out.give).toEqual(['Farol']);
        expect(out.take).toEqual(['pan']);
        expect(out.bonds).toEqual([{ who: 'Bran', amount: 1 }]);
        expect(out.clues).toEqual(['Giles miente.']);
        expect(out.time).toBe(1);
        expect(out.milestones).toEqual(['la-charla']);
        expect(out.notes).toEqual(['−3 de oro.', 'Recibes: Farol.', 'Entregas: pan.', 'Tu vínculo con Bran crece.', 'Apuntado en el Diario: Giles miente.', 'Se os va un rato.']);
    });
});

describe('lo que está mal escrito en las escenas', () => {
    const refs = { people: ['Tomás', 'Brunilda'], rumors: ['r1'], items: ['Farol'], dialogues: ['charla'], places: ['Puerto Alba'] };
    const plot = (/** @type {any} */ m) => ({ milestones: [{ id: 'a', title: 'A', scene: 'Texto.', ...m }, { id: 'b', title: 'B' }] });
    const paths = (/** @type {any[]} */ issues) => issues.map(i => i.path);

    test('una escena bien escrita no dice nada, y un hito sin escena tampoco', () => {
        const good = plot({ backdrop: 'Puerto Alba', sceneDialogue: 'charla', beats: [{ text: 'Llegas.' }, { who: 'Tomás', text: '¿Me ayudas?', options: [{ text: 'Sí.', effects: [{ attitude: 1 }, { rumor: 'r1' }, { give: 'Farol' }, { milestone: 'b' }] }] }] });
        expect(checkPlotScenes(good, refs)).toEqual({ errors: [], warnings: [] });
        expect(checkPlotScenes({ milestones: [{ id: 'a' }] }, refs)).toEqual({ errors: [], warnings: [] });
        expect(checkPlotScenes(null, refs)).toEqual({ errors: [], warnings: [] });
    });

    test('errores: beats que no es lista, una línea sin texto, una marca rota y una charla que no existe', () => {
        expect(paths(checkPlotScenes(plot({ beats: 'Hola' }), refs).errors)).toEqual(['plot.milestones[0].beats']);
        const found = checkPlotScenes(plot({ sceneDialogue: 'otra', beats: [{ who: 'Tomás' }, { text: 'Hola {amigo|amiga' }, 7] }), refs);
        expect(paths(found.errors)).toEqual(['plot.milestones[0].sceneDialogue', 'plot.milestones[0].beats[0].text', 'plot.milestones[0].beats[1].text', 'plot.milestones[0].beats[2]']);
    });

    test('las decisiones, con las reglas de las charlas, y en el sitio de la escena', () => {
        const found = checkPlotScenes(plot({
            beats: [{
                who: 'Tomás', text: 'Elige.',
                options: [
                    { id: 'x', text: 'Uno.', effects: [{ rumor: 'r9' }, { raro: 1 }, { milestone: 'z' }] },
                    { id: 'x', text: 'Dos.' },
                    { text: 'Tres.', check: { skill: 'magia', success: {} } },
                ],
            }],
        }), refs);
        expect(paths(found.errors)).toEqual([
            'plot.milestones[0].beats[0].options[0].effects[0]',
            'plot.milestones[0].beats[0].options[0].effects[1]',
            'plot.milestones[0].beats[0].options[0].effects[2]',
            'plot.milestones[0].beats[0].options[1].id',
            'plot.milestones[0].beats[0].options[2].check.skill',
            'plot.milestones[0].beats[0].options[2].check.failure',
        ]);
    });

    test('si decide el narrador, cambiar cómo os mira alguien dice con quién', () => {
        const found = checkPlotScenes(plot({
            beats: [{ text: 'Elige.', options: [{ text: 'A.', effects: [{ attitude: 1 }] }, { text: 'B.', effects: [{ attitude: 1, who: 'Tomás' }] }, { text: 'C.', check: { skill: 'stealth', success: { effects: [{ bond: 1 }] }, failure: {} } }] }],
        }), refs);
        expect(paths(found.errors)).toEqual(['plot.milestones[0].beats[0].options[0].effects', 'plot.milestones[0].beats[0].options[2].effects']);
    });

    test('avisos: alguien sin ficha, un gesto raro, un fondo que no existe, sin scene, larga o con muchas decisiones', () => {
        const ask = { who: 'Tomás', text: '¿Sí?', options: [{ text: 'Sí.', reply: [{ who: 'Nadie', mood: 'feliz', text: 'Vale.', options: [] }] }] };
        const found = checkPlotScenes({
            milestones: [{
                id: 'a', title: 'A', backdrop: 'Marte',
                beats: [{ who: 'Pepe', mood: 'feliz', text: 'Hola.' }, ask, ask, ask, ...Array.from({ length: SCENE_LIMITS.beats }, () => 'Y más.')],
            }],
        }, refs);
        expect(found.errors).toEqual([]);
        expect(paths(found.warnings)).toEqual([
            'plot.milestones[0].backdrop',
            'plot.milestones[0].scene',
            'plot.milestones[0].beats',
            'plot.milestones[0].beats',
            'plot.milestones[0].beats[0].who',
            'plot.milestones[0].beats[0].mood',
            ...[1, 2, 3].flatMap(b => [`plot.milestones[0].beats[${b}].options[0].reply[0].who`, `plot.milestones[0].beats[${b}].options[0].reply[0].mood`, `plot.milestones[0].beats[${b}].options[0].reply[0].options`]),
        ]);
    });

    test('validatePack las comprueba con lo que trae el paquete', () => {
        const p = pack('gremio');
        p.plot.milestones[0].beats[1].who = 'Tomasa';
        p.plot.milestones[0].beats[4].options[0].effects = [{ rumor: 'r-no-existe' }];
        const report = validatePack(p);
        expect(report.errors.map(e => e.path)).toEqual(['plot.milestones[0].beats[4].options[0].effects[0]']);
        expect(report.warnings.map(w => w.path)).toContain('plot.milestones[0].beats[1].who');
    });
});

describe('las escenas escritas: el prólogo, 1387 y Strahd', () => {
    const cases = [
        { id: 'gremio', ids: ['el-muelle', 'la-charla', 'el-gremio', 'la-prueba'] },
        { id: '1387', ids: ['el-caliz-ensangrentado', 'el-precio-del-escape', 'la-pista-en-el-barro', 'el-invierno-cierra-el-paso', 'el-hambre-de-los-lobos'] },
        { id: 'strahd', ids: ['sangrienta-bienvenida', 'asedio-en-la-mansion', 'el-grito-en-el-sotano'] },
    ];

    test('cada paquete valida sin errores ni avisos en sus escenas', () => {
        for (const { id } of cases) {
            const report = validatePack(pack(id));
            expect(report.errors).toEqual([]);
            expect(report.warnings.filter(w => w.path.startsWith('plot'))).toEqual([]);
        }
    });

    test('cada hito pedido es una escena de 3 a 8 líneas, con una decisión que cambia algo', () => {
        for (const { id, ids } of cases) {
            const p = pack(id);
            const plot = /** @type {any} */ (readPlot(p.plot));
            for (const wanted of ids) {
                const m = plot.milestones.find((/** @type {any} */ x) => x.id === wanted);
                const scene = milestoneScene(m, { dialogues: p.dialogues, hero: hero() });
                expect([id, wanted, scene.kind]).toEqual([id, wanted, 'scene']);
                expect(scene.beats.length).toBeGreaterThanOrEqual(3);
                expect(scene.beats.length).toBeLessThanOrEqual(8);
                const decisions = scene.beats.filter(b => b.decision);
                expect(decisions.length).toBeGreaterThanOrEqual(1);
                expect(decisions.length).toBeLessThanOrEqual(SCENE_LIMITS.decisions);
                // Alguna opción cambia algo de verdad: cómo os mira alguien, un rumor, un objeto, oro o un hito.
                const raw = m.beats.filter((/** @type {any} */ b) => b.options).flatMap((/** @type {any} */ b) => b.options);
                const effects = raw.flatMap((/** @type {any} */ o) => [...(o.effects ?? []), ...['success', 'failure'].flatMap(k => o.check?.[k]?.effects ?? [])]);
                expect(effects.some((/** @type {any} */ e) => ['attitude', 'rumor', 'give', 'gold', 'milestone', 'clue'].some(k => k in e))).toBe(true);
                // `scene` sigue: es lo que lee el narrador y lo de una partida de antes.
                expect(scene.text.length).toBeGreaterThan(20);
            }
        }
    });

    test('quien habla tiene su retrato dibujado, y el texto es llano', () => {
        const art = readManifest(manifest);
        for (const { id, ids } of cases) {
            const p = pack(id);
            const folder = `retratos/${id}`;
            const text = JSON.stringify(p.plot.milestones.filter((/** @type {any} */ m) => ids.includes(m.id)));
            expect(text).not.toMatch(/propio:|localidad|\[cite/i);
            const speakers = new Set([...text.matchAll(/"who":\s*"([^"]+)"/g)].map(match => match[1]));
            // Con el mismo resolutor que la ventana, y de su paquete (no el de relleno).
            for (const who of speakers) {
                expect([who, artFor('portrait', { name: who, pack: id }, art)[0]?.includes(`/${folder}/`)]).toEqual([who, true]);
            }
        }
    });

    test('el prólogo sigue igual: sus escenas no cumplen hitos, y el texto de siempre no ha cambiado', () => {
        const p = pack('gremio');
        const text = JSON.stringify(p.plot.milestones.map((/** @type {any} */ m) => m.beats ?? []));
        expect(text).not.toMatch(/"milestone"/);
        expect(text).toMatch(/\{cansado\|cansada\}/);
        expect(p.plot.milestones.find((/** @type {any} */ m) => m.id === 'la-prueba').scene).toMatch(/Baja a la bodega/);
    });

    test('en 1387, al precio del escape le sigue la charla de Giles, que cumple el hito', () => {
        const p = pack('1387');
        const m = readPlot(p.plot)?.milestones.find(x => x.id === 'el-precio-del-escape');
        const scene = milestoneScene(m, { dialogues: p.dialogues, hero: hero() });
        expect(scene.dialogue?.speaker).toBe('Giles');
        expect(JSON.stringify(p.dialogues.find((/** @type {any} */ d) => d.id === 'giles-lo-que-vio'))).toMatch(/"milestone":\s*"el-precio-del-escape"/);
    });
});

describe('el contrato del Gem (J5.2): el hilo, el prólogo y la tarjeta del tablón', () => {
    const schema = buildCampaignPackSchema();

    test('world trae levels y journey, y las facciones su id', () => {
        const world = getSectionSchema('world');
        expect(world.properties.levels).toMatchObject({ type: 'array', minItems: 2, maxItems: 2 });
        expect(Object.keys(world.properties.journey.properties)).toEqual(['days', 'how']);
        expect(world.properties.factions.items.properties.id).toBeDefined();
    });

    test('el hilo es una sección, la última, con el prólogo y las escenas', () => {
        expect(SECTION_ORDER[SECTION_ORDER.length - 1]).toBe('plot');
        const milestoneSchema = getSectionSchema('plot').properties.milestones.items;
        for (const key of ['prologue', 'beats', 'sceneDialogue', 'backdrop', 'hidden', 'within', 'opens', 'asks', 'changes']) {
            expect([key, Boolean(milestoneSchema.properties[key])]).toEqual([key, true]);
        }
        expect(milestoneSchema.properties.beats.items.properties.options.items.properties.reply).toBeDefined();
        // Las condiciones y los efectos se escriben una vez, en la raíz, para las charlas y el hilo.
        expect(Object.keys(schema.definitions)).toEqual(expect.arrayContaining(['dialogueCondition', 'dialogueEffect', 'sceneLine', 'sceneBranch']));
        expect(schema.properties.plot.definitions).toBeUndefined();
    });

    test('lo que el esquema dice se puede importar: los tres paquetes cumplen sus claves', () => {
        const known = new Set(Object.keys(getSectionSchema('plot').properties.milestones.items.properties));
        for (const id of ['gremio', '1387', 'strahd']) {
            for (const m of pack(id).plot.milestones) {
                expect(Object.keys(m).filter(key => !known.has(key))).toEqual([]);
            }
        }
    });

    test('las reglas y las instrucciones lo cuentan', () => {
        expect(getPackRules().join(' ')).toMatch(/beats/);
        const text = buildGemInstructions();
        expect(text).toContain('"prologue"');
        expect(text).toContain('"journey"');
        expect(text).toContain('"beats"');
    });
});
