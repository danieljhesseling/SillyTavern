import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import {
    readDialogue, readDialogues, startDialogue, optionsFor, choose, dialogueView, dialogueFor, dialogueOffered,
    rememberDialogue, readDialogueMemory, dialogueJournal, checkDialogues, checkDc, partialCost, kindStem,
    dialogueMilestones, speakersWithDialogue, describeDialogueEffect, MOODS,
} from '../public/scripts/game-engine/campaign/dialogues.js';
import { validatePack } from '../public/scripts/game-engine/campaign/campaign-pack.js';
import { getSectionSchema, SECTION_ORDER, buildExamplePack, getPackRules } from '../public/scripts/game-engine/campaign/campaign-pack-schema.js';
import { buildImportPlan } from '../public/scripts/game-engine/campaign/campaign-importer.js';
import { readPlot, startPlot, plotEvent } from '../public/scripts/game-engine/campaign/plot.js';
import { optionChips, stepLines } from '../public/scripts/game-engine/ui/dialogue-window.js';

const pack = (/** @type {string} */ id) => JSON.parse(readFileSync(new URL(`../public/mundos/${id}.pack.json`, import.meta.url), 'utf8'));
const compendium = (/** @type {string} */ file) => JSON.parse(readFileSync(new URL(`../public/compendio/${file}.json`, import.meta.url), 'utf8')).rows;

/** Un héroe con fichas de 10 en todo: tira con +0 salvo competencias. */
const hero = (/** @type {any} */ extra = {}) => ({
    name: 'Ada', race: 'Humano', class: 'Guerrero', gender: 'Mujer', background: '', level: 1,
    strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, ...extra,
});

/** Una charla pequeña con todo lo que hay que probar. */
const sample = () => readDialogue({
    id: 'prueba',
    speaker: 'Marta',
    start: 'inicio',
    nodes: [
        {
            id: 'inicio', mood: 'enfadado',
            line: 'Llegas tarde, {forastero|forastera}.', again: 'Tú otra vez.',
            options: [
                { id: 'hola', text: 'Hola.', next: 'hola' },
                { id: 'enano', text: 'Los enanos siempre llegamos tarde.', if: { species: 'Enano' }, next: 'hola' },
                { id: 'veterano', text: 'Reconozco a una veterana.', if: [{ background: 'soldado' }, { class: 'Soldado' }], next: 'hola' },
                { id: 'secreto', text: '¿Qué escondes?', if: { attitude: 1 }, next: 'secreto' },
                { id: 'pan', text: 'Toma este pan.', if: { item: 'Pan' }, effects: [{ take: 'Pan' }, { attitude: 1 }], next: 'hola' },
                { id: 'pagar', text: 'Pagar cinco.', if: { gold: 5 }, effects: [{ gold: -5 }], next: 'hola' },
                { id: 'hito', text: 'Ya volví de la mina.', if: { milestone: { id: 'la-mina', is: 'done' } }, next: 'hola' },
                {
                    id: 'convencer', text: 'Ayúdame.',
                    check: { skill: 'persuasion', dc: 12, success: { next: 'si', effects: [{ attitude: 1 }] }, partial: { next: 'quizas' }, failure: { next: 'no', effects: [{ attitude: -1 }] } },
                },
                { id: 'amenazar', text: 'Habla.', check: { skill: 'intimidation', dc: 12, success: 'si', failure: 'no' } },
                { id: 'adios', text: 'Adiós.', end: true, repeat: true },
            ],
        },
        { id: 'hola', line: 'Hola, hola.', journal: 'Marta saluda de mala gana.', options: [{ id: 'volver', text: 'Sigamos.', next: 'inicio' }] },
        { id: 'secreto', mood: 'triste', line: 'Mi marido enterró la plata.', effects: [{ clue: 'La plata está en el huerto.' }, { milestone: 'la-plata' }], options: [{ id: 'gracias', text: 'Gracias.', next: 'inicio' }] },
        { id: 'si', mood: 'alegre', line: 'Está bien.' },
        { id: 'quizas', line: 'Quizás.' },
        { id: 'no', line: 'No.' },
    ],
});

const ids = (/** @type {any[]} */ list) => list.map(o => o.id);

describe('leer una charla (J8.1)', () => {
    test('lo que falta se deduce sin inventar: el inicio, el gesto y los ids', () => {
        const d = readDialogue({ id: 'x', speaker: 'Y', nodes: [{ id: 'a', line: 'Hola', mood: 'raro', options: [{ text: '¿Qué tal?' }] }] });
        expect(d?.start).toBe('a');
        expect(d?.nodes[0].mood).toBe('neutral');
        expect(d?.nodes[0].options[0].id).toBe('a:que-tal');
    });

    test('sin id o sin nudos no es una charla', () => {
        expect(readDialogue({ speaker: 'Y', nodes: [{ id: 'a' }] })).toBeNull();
        expect(readDialogue({ id: 'x', speaker: 'Y', nodes: [] })).toBeNull();
        expect(readDialogues([null, { id: 'x', nodes: [{ id: 'a' }] }, 'no'])).toHaveLength(1);
    });

    test('los efectos se escriben con una clave y se leen con su clase', () => {
        const d = readDialogue({ id: 'x', speaker: 'Y', nodes: [{ id: 'a', line: 'L', options: [{ text: 'T', effects: [{ attitude: 3 }, { gold: -2 }, { give: 'Pan' }, 'end', { raro: 1 }] }] }] });
        const option = d?.nodes[0].options[0];
        expect(option?.effects.map(e => e.kind)).toEqual(['attitude', 'gold', 'give', 'unknown']);
        expect(option?.effects[0].amount).toBe(1);
        expect(option?.end).toBe(true);
    });

    test('los cuatro gestos del retrato', () => {
        expect(MOODS).toEqual(['neutral', 'alegre', 'enfadado', 'triste']);
    });
});

describe('opciones según quién eres (J8.2)', () => {
    const d = /** @type {any} */ (sample());

    test('con dos personajes distintos, salen opciones distintas', () => {
        const human = ids(optionsFor(startDialogue(d), hero()));
        const dwarf = ids(optionsFor(startDialogue(d), hero({ race: 'Enana' })));
        expect(human).not.toContain('enano');
        expect(dwarf).toContain('enano');
        expect(human).not.toEqual(dwarf);
    });

    test('lo de quién eres lleva su etiqueta; «Enana» es «Enano» y «Clériga» es «Clérigo»', () => {
        const dwarf = optionsFor(startDialogue(d), hero({ race: 'Enana' })).find(o => o.id === 'enano');
        expect(dwarf?.tag).toBe('Enano');
        expect(kindStem('Enana')).toBe(kindStem('Enano'));
        expect(kindStem('Clériga')).toBe(kindStem('Clérigo'));
        expect(kindStem('raza-media-elfa')).toBe(kindStem('Medio elfo'));
    });

    test('[Soldado]: por el trasfondo o por la clase, la misma opción', () => {
        const byBackground = optionsFor(startDialogue(d), hero({ background: 'soldado' })).find(o => o.id === 'veterano');
        const byClass = optionsFor(startDialogue(d), hero({ class: 'Soldado' })).find(o => o.id === 'veterano');
        expect(byBackground?.tag).toBe('Soldado');
        expect(byClass?.tag).toBe('Soldado');
        expect(ids(optionsFor(startDialogue(d), hero()))).not.toContain('veterano');
    });

    test('el género también decide, sin etiqueta', () => {
        const g = readDialogue({ id: 'g', speaker: 'Y', nodes: [{ id: 'a', line: 'L', options: [{ id: 'ella', text: 'T', if: { gender: 'Mujer' } }] }] });
        expect(ids(optionsFor(startDialogue(/** @type {any} */ (g)), hero()))).toEqual(['ella']);
        expect(optionsFor(startDialogue(/** @type {any} */ (g)), hero()).find(o => o.id === 'ella')?.tag).toBe('');
        expect(ids(optionsFor(startDialogue(/** @type {any} */ (g)), hero({ gender: 'Hombre' })))).toEqual([]);
    });

    test('lo que se puede ganar sale apagado y dice por qué; el hito que no toca, ni sale', () => {
        const options = optionsFor(startDialogue(d), hero(), { attitude: 0, items: [], gold: 0 });
        expect(options.find(o => o.id === 'secreto')?.locked).toMatch(/Marta os mire de forma cordial/);
        expect(options.find(o => o.id === 'pan')?.locked).toMatch(/llevar «Pan»/);
        expect(options.find(o => o.id === 'pagar')?.locked).toMatch(/5 monedas/);
        expect(ids(options)).not.toContain('hito');
        const open = optionsFor(startDialogue(d), hero(), { attitude: 1, items: ['pan'], gold: 5, done: ['la-mina'] });
        expect(open.filter(o => o.locked)).toEqual([]);
        expect(ids(open)).toContain('hito');
    });

    test('el texto sale con el género de quien juega', () => {
        expect(dialogueView(startDialogue(d, { hero: hero() }), hero()).line).toBe('Llegas tarde, forastera.');
        expect(dialogueView(startDialogue(d, { hero: hero({ gender: 'Hombre' }) }), hero({ gender: 'Hombre' })).line).toBe('Llegas tarde, forastero.');
    });
});

describe('elegir', () => {
    const d = /** @type {any} */ (sample());

    test('lleva al nudo siguiente, con su gesto y lo que se apunta', () => {
        const result = choose(startDialogue(d), 'hola', { hero: hero() });
        expect(result.ok).toBe(true);
        expect(result.said).toBe('Hola.');
        expect(result.view?.line).toBe('Hola, hola.');
        expect(result.state.learned.map(l => l.text)).toEqual(['Marta saluda de mala gana.']);
    });

    test('los efectos salen con quién es cada cosa', () => {
        const result = choose(startDialogue(d), 'pan', { hero: hero(), world: { items: ['Pan'] } });
        expect(result.effects).toEqual([{ kind: 'take', item: 'Pan' }, { kind: 'attitude', amount: 1, who: 'Marta' }]);
        expect(describeDialogueEffect(result.effects[1])).toBe('Marta os mira mejor.');
    });

    test('lo cerrado no se elige, y «adiós» acaba', () => {
        expect(choose(startDialogue(d), 'secreto', { hero: hero() }).ok).toBe(false);
        expect(choose(startDialogue(d), 'inventada', { hero: hero() }).ok).toBe(false);
        const bye = choose(startDialogue(d), 'adios', { hero: hero() });
        expect(bye.ended).toBe(true);
        expect(choose(bye.state, 'hola', { hero: hero() }).ok).toBe(false);
    });

    test('lo que hace un nudo pasa la primera vez que se oye, se llegue por donde se llegue', () => {
        const first = choose(startDialogue(d), 'secreto', { hero: hero(), world: { attitude: 1 } });
        expect(first.effects).toEqual([{ kind: 'clue', text: 'La plata está en el huerto.' }, { kind: 'milestone', id: 'la-plata' }]);
        expect(first.state.learned.map(l => l.text)).toContain('La plata está en el huerto.');
        const memory = rememberDialogue(null, first.state);
        const again = choose(startDialogue(d, { memory }), 'secreto', { hero: hero(), world: { attitude: 1 }, memory });
        // Ya elegida en otra charla: no vuelve a salir.
        expect(again.ok).toBe(false);
        expect(dialogueMilestones(d)).toEqual(['la-plata']);
    });

    test('un nudo sin opciones cierra la charla', () => {
        const result = choose(startDialogue(d), 'amenazar', { hero: hero(), rollD20: () => 20 });
        expect(result.view?.final).toBe(true);
        expect(result.view?.options).toEqual([]);
    });
});

describe('tiradas en la charla (J8.3)', () => {
    const d = /** @type {any} */ (sample());
    const roll = (/** @type {number} */ natural, /** @type {any} */ world = {}) => choose(startDialogue(d), 'convencer', { hero: hero(), world, rollD20: () => natural });

    test('bien: la rama de éxito, con sus efectos', () => {
        const result = roll(15);
        expect(result.outcome).toBe('bien');
        expect(result.view?.line).toBe('Está bien.');
        expect(result.view?.mood).toBe('alegre');
        expect(result.effects).toEqual([{ kind: 'attitude', amount: 1, who: 'Marta' }]);
        expect(result.state.log.find(l => l.kind === 'roll')?.text).toMatch(/Persuasión/);
    });

    test('a medias (fallar por tres o menos): su rama', () => {
        const result = roll(10);
        expect(result.outcome).toBe('medias');
        expect(result.view?.line).toBe('Quizás.');
        expect(result.state.log.find(l => l.kind === 'roll')?.text).toMatch(/A medias/);
    });

    test('mal: la rama de fallo, y un 1 siempre falla', () => {
        expect(roll(3).view?.line).toBe('No.');
        expect(roll(3).effects).toEqual([{ kind: 'attitude', amount: -1, who: 'Marta' }]);
        expect(roll(1, { attitude: 3 }).outcome).toBe('mal');
    });

    test('a medias sin rama escrita: sale como bien, pero se paga lo de consequences.js', () => {
        // El guerrero intimida con +2: un 9 se queda en 11, a uno de la CD.
        const result = choose(startDialogue(d), 'amenazar', { hero: hero(), rollD20: () => 9 });
        expect(result.outcome).toBe('medias');
        expect(result.view?.line).toBe('Está bien.');
        expect(result.effects).toEqual([{ kind: 'attitude', amount: -1, who: 'Marta' }]);
        expect(partialCost('persuasion')).toEqual([{ kind: 'time' }]);
    });

    test('a quien os aprecia se le convence mejor (y la opción dice la CD de verdad)', () => {
        const check = /** @type {any} */ (d.nodes[0].options.find((/** @type {any} */ o) => o.id === 'convencer').check);
        expect(checkDc(check, { attitude: 2 })).toBe(10);
        expect(checkDc(check, { attitude: -2 })).toBe(14);
        expect(optionsFor(startDialogue(d), hero(), { attitude: 2 }).find(o => o.id === 'convencer')?.check).toEqual({ skill: 'persuasion', label: 'Persuasión', dc: 10 });
        // Intimidar no depende del aprecio.
        expect(optionsFor(startDialogue(d), hero(), { attitude: 2 }).find(o => o.id === 'amenazar')?.check?.dc).toBe(12);
        expect(roll(10, { attitude: 2 }).outcome).toBe('bien');
    });
});

describe('lo que ya os contó no se repite, y queda en el Diario (J8.6)', () => {
    const d = /** @type {any} */ (sample());

    test('lo ya dicho no vuelve a salir, ni en esta charla ni en la siguiente; «adiós», sí', () => {
        const once = choose(startDialogue(d), 'hola', { hero: hero() });
        const back = choose(once.state, 'volver', { hero: hero() });
        expect(ids(back.view?.options ?? [])).not.toContain('hola');
        expect(ids(back.view?.options ?? [])).toContain('adios');
        const memory = rememberDialogue(null, back.state);
        const later = startDialogue(d, { memory });
        expect(ids(optionsFor(later, hero()))).not.toContain('hola');
    });

    test('quien ya os lo dijo lo resume', () => {
        const once = choose(startDialogue(d), 'hola', { hero: hero() });
        const back = choose(once.state, 'volver', { hero: hero() });
        // J13.8: volver al principio sin haberse ido no es volver otro día: ni «Tú otra vez» ni la
        // frase del principio, sino algo corto para seguir.
        expect(back.view?.line).not.toBe('Tú otra vez.');
        expect(back.view?.line).not.toBe(dialogueView(startDialogue(d), hero()).line);
        const memory = rememberDialogue(null, back.state);
        expect(dialogueView(startDialogue(d, { memory }), hero()).line).toBe('Tú otra vez.');
    });

    test('lo aprendido va al Diario una vez, con quién lo dijo', () => {
        const once = choose(startDialogue(d), 'hola', { hero: hero(), world: { day: 3 } });
        let memory = rememberDialogue(null, once.state);
        memory = rememberDialogue(memory, once.state);
        expect(dialogueJournal(memory)).toEqual(['Marta: Marta saluda de mala gana.']);
        expect(readDialogueMemory(memory).prueba.learned[0].day).toBe(3);
        expect(readDialogueMemory({ roto: 'x', prueba: { heard: 'inicio' } })).toEqual({ prueba: { heard: ['inicio'], chosen: [], learned: [] } });
    });
});

describe('qué charla toca con quién', () => {
    const list = readDialogues([
        { id: 'antes', speaker: 'Giles', when: { milestone: { id: 'h1', is: 'not-done' } }, nodes: [{ id: 'a', line: 'A' }] },
        { id: 'despues', speaker: 'Giles', nodes: [{ id: 'a', line: 'B' }] },
    ]);

    test('la primera de esa persona que se ofrece ahora', () => {
        expect(dialogueFor(list, 'giles', hero(), {})?.id).toBe('antes');
        expect(dialogueFor(list, 'Giles', hero(), { done: ['h1'] })?.id).toBe('despues');
        expect(dialogueFor(list, 'Nadie', hero(), {})).toBeNull();
        expect(dialogueOffered(list[0], hero(), { done: ['h1'] })).toBe(false);
        expect(speakersWithDialogue(list)).toEqual(['Giles']);
    });
});

describe('comprobar las charlas de un paquete', () => {
    const refs = { people: ['Marta'], milestones: ['la-plata', 'la-mina'], rumors: ['r1'], items: ['Pan'] };
    const base = () => ({
        id: 'x', speaker: 'Marta', start: 'a',
        nodes: [
            { id: 'a', line: 'Hola', options: [{ id: 'o1', text: 'Ir', next: 'b' }] },
            { id: 'b', line: 'Adiós' },
        ],
    });
    const paths = (/** @type {any[]} */ list) => list.map(i => i.path);

    test('una charla bien escrita no da nada', () => {
        expect(checkDialogues([base()], refs)).toEqual({ errors: [], warnings: [] });
        expect(checkDialogues(undefined, refs)).toEqual({ errors: [], warnings: [] });
    });

    test('un enlace a un nudo que no existe es un error', () => {
        const d = base();
        d.nodes[0].options[0].next = 'z';
        expect(paths(checkDialogues([d], refs).errors)).toEqual(['dialogues[0].nodes[0].options[0].next']);
    });

    test('un nudo al que no se llega es un aviso', () => {
        const d = base();
        d.nodes.push({ id: 'c', line: 'Nunca' });
        const found = checkDialogues([d], refs);
        expect(found.errors).toEqual([]);
        expect(found.warnings).toEqual([{ path: 'dialogues[0].nodes[2]', message: expect.stringMatching(/no se llega desde "a"/) }]);
    });

    test('las ramas de una tirada también enlazan, y cuentan para llegar', () => {
        const d = /** @type {any} */ (base());
        d.nodes[0].options.push({ id: 'o2', text: 'T', check: { skill: 'persuasion', success: { next: 'c' }, failure: 'fantasma' } });
        d.nodes.push({ id: 'c', line: 'Bien' });
        const found = checkDialogues([d], refs);
        expect(paths(found.errors)).toEqual(['dialogues[0].nodes[0].options[1].check.failure']);
        expect(found.warnings).toEqual([]);
    });

    test('quien habla, los hitos, los rumores y las habilidades tienen que existir', () => {
        const d = /** @type {any} */ (base());
        d.speaker = 'Fantasma';
        d.nodes[0].options.push(
            { id: 'o2', text: 'T', if: { milestone: 'no-existe' } },
            { id: 'o3', text: 'T', effects: [{ rumor: 'r9' }, { milestone: 'otro' }, { vuela: true }] },
            { id: 'o4', text: 'T', check: { skill: 'volar', dc: 99 } },
        );
        const found = paths(checkDialogues([d], refs).errors);
        expect(found).toEqual(expect.arrayContaining([
            'dialogues[0].speaker',
            'dialogues[0].nodes[0].options[1].if.milestone',
            'dialogues[0].nodes[0].options[2].effects[0]',
            'dialogues[0].nodes[0].options[2].effects[1]',
            'dialogues[0].nodes[0].options[2].effects[2]',
            'dialogues[0].nodes[0].options[3].check.skill',
            'dialogues[0].nodes[0].options[3].check.dc',
            'dialogues[0].nodes[0].options[3].check.success',
            'dialogues[0].nodes[0].options[3].check.failure',
        ]));
    });

    test('un objeto que el paquete no trae y una condición que no se entiende son avisos', () => {
        const d = /** @type {any} */ (base());
        d.nodes[0].options.push({ id: 'o2', text: 'T', if: { item: 'Espada rara', color: 'rojo' } });
        const found = checkDialogues([d], refs);
        expect(found.errors).toEqual([]);
        expect(paths(found.warnings)).toEqual(['dialogues[0].nodes[0].options[1].if.color', 'dialogues[0].nodes[0].options[1].if.item']);
    });

    test('ids repetidos, marcas de género mal cerradas y una lista que no es lista', () => {
        const d = /** @type {any} */ (base());
        d.nodes[0].options.push({ id: 'o1', text: 'Otra' });
        d.nodes[1].line = 'Adiós, {amigo|amiga';
        const found = paths(checkDialogues([d, base()], refs).errors);
        expect(found).toEqual(expect.arrayContaining(['dialogues[0].nodes[0].options[1].id', 'dialogues[0].nodes[1].line', 'dialogues[1].id']));
        expect(paths(checkDialogues({}, refs).errors)).toEqual(['dialogues']);
    });

    test('validatePack las comprueba con lo que trae el paquete', () => {
        const p = buildExamplePack();
        p.dialogues[0].nodes[0].options[0].next = 'no-existe';
        const report = validatePack(p);
        expect(report.ok).toBe(false);
        expect(paths(report.errors)).toEqual(['dialogues[0].nodes[0].options[0].next']);
    });
});

describe('el contrato con el Gem', () => {
    test('las charlas son una sección, con su esquema, sus reglas y su ejemplo', () => {
        expect(SECTION_ORDER).toContain('dialogues');
        expect(getSectionSchema('dialogues')?.items?.required).toEqual(['id', 'speaker', 'nodes']);
        expect(getPackRules().join(' ')).toMatch(/dialogues/);
        const example = buildExamplePack();
        expect(example.dialogues).toHaveLength(1);
        const report = validatePack(example);
        expect(report.errors).toEqual([]);
        expect(report.warnings).toEqual([]);
    });

    test('el importador las lleva al mundo, tal cual', () => {
        const plan = buildImportPlan(buildExamplePack());
        expect(plan.metadata.dialogues.map((/** @type {any} */ d) => d.id)).toEqual(['mira-el-sotano']);
        expect(buildImportPlan({ ...buildExamplePack(), dialogues: [] }).metadata.dialogues).toBeUndefined();
    });
});

describe('una charla cumple un hito (J8.1)', () => {
    const plot = readPlot({
        title: 'P', milestones: [
            { id: 'h1', title: 'Uno', opens: { kind: 'start' }, asks: { kind: 'talk', npc: 'Giles' }, changes: { open: ['h2'] } },
            { id: 'h2', title: 'Dos', opens: { kind: 'after', milestone: 'h1' }, asks: { kind: 'win', board: 'X' } },
        ],
    });

    test('por su id, si está abierto', () => {
        const start = startPlot(/** @type {any} */ (plot), 1);
        const step = plotEvent(/** @type {any} */ (plot), start.state, { kind: 'milestone', id: 'h1' });
        expect(step.done.map(m => m.id)).toEqual(['h1']);
        expect(step.opened.map(m => m.id)).toEqual(['h2']);
        // Lo que no está abierto, no.
        expect(plotEvent(/** @type {any} */ (plot), start.state, { kind: 'milestone', id: 'h2' }).done).toEqual([]);
    });
});

describe('las fichas de la ventana (J8.4)', () => {
    const d = /** @type {any} */ (sample());

    test('se numeran las que se pueden elegir; las cerradas dicen por qué', () => {
        const chips = optionChips(dialogueView(startDialogue(d), hero({ race: 'Enano' }), { attitude: 0 }));
        const dwarf = chips.find(c => c.id === 'enano');
        expect(dwarf?.tag).toBe('[Enano]');
        expect(chips.find(c => c.id === 'secreto')?.key).toBe('');
        expect(chips.find(c => c.id === 'secreto')?.locked).toMatch(/cordial/);
        expect(chips.find(c => c.id === 'convencer')?.check).toBe('Persuasión · CD 12');
        expect(chips.filter(c => c.key).map(c => c.key)).toEqual(['1', '2', '3', '4', '5']);
        expect(chips.find(c => c.id === 'adios')?.ends).toBe(true);
    });

    test('las líneas de un paso: lo que dijiste, la tirada, lo que contesta y lo que pasó', () => {
        const state = startDialogue(d);
        const result = choose(state, 'convencer', { hero: hero(), rollD20: () => 15 });
        const lines = stepLines(result.state, state.log.length, ['Marta os mira mejor.']);
        expect(lines.map(l => l.kind)).toEqual(['you', 'roll', 'say', 'note']);
    });
});

describe('las charlas escritas: Brunilda, Giles e Ismark', () => {
    const cases = [
        { id: 'gremio', speaker: 'Brunilda' },
        { id: '1387', speaker: 'Giles' },
        { id: 'strahd', speaker: 'Ismark Kolyanovich' },
    ];
    const species = new Set(compendium('razas').map((/** @type {any} */ r) => kindStem(r.name)));
    const classes = new Set(compendium('clases').map((/** @type {any} */ r) => kindStem(r.name)));

    test('cada paquete valida sin errores ni avisos en sus charlas', () => {
        for (const { id, speaker } of cases) {
            const p = pack(id);
            const report = validatePack(p);
            expect(report.errors).toEqual([]);
            expect(report.warnings.filter(w => w.path.startsWith('dialogues'))).toEqual([]);
            expect(readDialogues(p.dialogues).map(d => d.speaker)).toContain(speaker);
        }
    });

    test('cada una tiene opciones según quién eres, una tirada con sus tres salidas y marcas de género', () => {
        for (const { id, speaker } of cases) {
            const d = /** @type {any} */ (readDialogues(pack(id).dialogues).find(x => x.speaker === speaker));
            const options = d.nodes.flatMap((/** @type {any} */ n) => n.options);
            const who = options.filter((/** @type {any} */ o) => o.when.some((/** @type {any} */ c) => c.species || c.class || c.background));
            expect(who.length).toBeGreaterThanOrEqual(2);
            // Las especies y clases escritas son las del compendio.
            const written = who.flatMap((/** @type {any} */ o) => o.when);
            expect(written.flatMap((/** @type {any} */ c) => c.species ?? []).filter((/** @type {string} */ s) => !species.has(kindStem(s)))).toEqual([]);
            expect(written.flatMap((/** @type {any} */ c) => c.class ?? []).filter((/** @type {string} */ k) => !classes.has(kindStem(k)))).toEqual([]);
            expect(options.some((/** @type {any} */ o) => o.check?.success && o.check?.failure)).toBe(true);
            expect(JSON.stringify(pack(id).dialogues)).toMatch(/\{[^{}|]+\|[^{}|]+\}/);
            // Todo con gesto conocido, y cada nudo dice algo.
            expect(d.nodes.filter((/** @type {any} */ n) => !MOODS.includes(n.mood) || !n.line)).toEqual([]);
            // Lo escrito en Strahd como propio no deja la marca.
            expect(JSON.stringify(pack(id).dialogues)).not.toMatch(/propio:/);
        }
    });

    test('Giles: la charla de 1387 se juega entera y cumple «El precio del escape»', () => {
        const d = /** @type {any} */ (readDialogues(pack('1387').dialogues).find(x => x.speaker === 'Giles'));
        const soldier = hero({ name: 'Bran', class: 'Soldado', gender: 'Hombre' });
        /** @type {any} */
        const world = { open: ['el-precio-del-escape'], done: ['el-caliz-ensangrentado'], gold: 5, items: ['Cáliz ensangrentado de Vane'], attitude: 0 };
        expect(dialogueFor(readDialogues(pack('1387').dialogues), 'Giles', soldier, world)?.id).toBe(d.id);
        let state = startDialogue(d, { hero: soldier, world });
        const effects = [];
        const step = (/** @type {string} */ id) => {
            const result = choose(state, id, { hero: soldier, world, rollD20: () => 15 });
            expect(result.ok).toBe(true);
            effects.push(...result.effects);
            // Lo que aplicaría el juego: cómo os mira y el oro.
            world.attitude += result.effects.filter(e => e.kind === 'attitude').reduce((sum, e) => sum + Number(e.amount), 0);
            world.gold += result.effects.filter(e => e.kind === 'gold').reduce((sum, e) => sum + Number(e.amount), 0);
            state = result.state;
            return result;
        };
        expect(optionsFor(state, soldier, world).find(o => o.id === 'soldado')?.tag).toBe('Soldado');
        step('soldado');
        step('soldado-gracias');
        step('quien-subio');
        // El soldado paga dos, no tres.
        expect(ids(optionsFor(state, soldier, world))).toContain('pagar-dos');
        step('pagar-dos');
        expect(effects).toEqual(expect.arrayContaining([
            { kind: 'gold', amount: -2 },
            { kind: 'milestone', id: 'el-precio-del-escape' },
            { kind: 'rumor', id: 'r-traicion-en-la-puerta' },
        ]));
        step('furtivos');
        // Con aprecio, algo para el camino.
        expect(optionsFor(state, soldier, world).find(o => o.id === 'comida')?.locked).toBe('');
        step('comida');
        const last = step('racion-gracias');
        expect(last.ended).toBe(true);
        expect(effects).toEqual(expect.arrayContaining([{ kind: 'give', item: 'Ración de invierno' }]));
        expect(dialogueJournal(rememberDialogue(null, state)).join(' ')).toMatch(/camino viejo/);
    });

    test('Giles, con otro personaje: otras opciones, y tres formas de sacárselo', () => {
        const d = /** @type {any} */ (readDialogues(pack('1387').dialogues).find(x => x.speaker === 'Giles'));
        const rogue = hero({ name: 'Nel', class: 'Pícaro' });
        const world = { open: ['el-precio-del-escape'], done: ['el-caliz-ensangrentado'], gold: 0, items: ['Dados de hueso limados'] };
        const at = choose(startDialogue(d), 'quien-subio', { hero: rogue, world });
        const options = ids(optionsFor(at.state, rogue, world));
        expect(options).toEqual(expect.arrayContaining(['convencer', 'amenazar', 'dados']));
        expect(optionsFor(at.state, rogue, world).find(o => o.id === 'pagar')?.locked).toMatch(/3 monedas/);
        expect(ids(optionsFor(startDialogue(d), rogue, world))).toContain('cerveza');
        expect(ids(optionsFor(startDialogue(d), rogue, world))).not.toContain('soldado');
        // Las tres salidas de la tirada de convencer.
        expect(choose(at.state, 'convencer', { hero: rogue, world, rollD20: () => 18 }).view?.line).toMatch(/furtivos del bosque/);
        expect(choose(at.state, 'convencer', { hero: rogue, world, rollD20: () => 11 }).view?.line).toMatch(/olía a bosque/);
        expect(choose(at.state, 'convencer', { hero: rogue, world, rollD20: () => 2 }).view?.mood).toBe('enfadado');
    });

    test('Brunilda: la prueba y el tablón se cumplen hablando con ella', () => {
        const d = /** @type {any} */ (readDialogues(pack('gremio').dialogues)[0]);
        expect(dialogueMilestones(d).sort()).toEqual(['el-gremio', 'el-tablon']);
        const dwarf = hero({ race: 'Enano', class: 'Clérigo', gender: 'Hombre' });
        const world = { open: ['el-gremio'], done: [] };
        const view = dialogueView(startDialogue(d, { hero: dwarf, world }), dwarf, world);
        expect(view.line).toMatch(/Bueno, el nuevo\./);
        expect(ids(view.options)).toEqual(expect.arrayContaining(['quiero-entrar', 'enano', 'clerigo']));
        const result = choose(startDialogue(d, { hero: dwarf, world }), 'quiero-entrar', { hero: dwarf, world });
        expect(result.effects).toEqual([{ kind: 'milestone', id: 'el-gremio' }]);
        expect(result.view?.line).toMatch(/subes entero/);
    });

    test('Ismark: el retrato tiene sus caras, y su charla usa las tres', () => {
        const d = /** @type {any} */ (readDialogues(pack('strahd').dialogues)[0]);
        const moods = new Set(d.nodes.map((/** @type {any} */ n) => n.mood));
        for (const face of ['alegre', 'enfadado', 'triste']) expect(moods.has(face)).toBe(true);
        const manifest = JSON.parse(readFileSync(new URL('../public/img/game-engine/pixel/manifest.json', import.meta.url), 'utf8'));
        for (const face of ['alegre', 'enfadado', 'triste']) expect(manifest.files).toContain(`retratos/strahd/ismark-kolyanovich--${face}.png`);
    });
});
