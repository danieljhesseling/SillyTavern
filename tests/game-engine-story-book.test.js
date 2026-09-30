import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { readFileSync } from 'node:fs';
import {
    BOOK_KEYS, HUB_CHRONICLES_KEY, BOOK_LIMITS, listOf, chapterFrames, chapterNow, guildChapterLine, daysLeftLabel,
    deadlinesOf, focusClock, readDecisions, recordDecisions, sceneDecisionEntries, sucesoDecision, endingOf,
    buildStoryBook, searchDecided, bookInputFromMetadata, readStoryBook, bookSnapshot, readChronicles, withChronicle,
    chronicleOfCampaign,
} from '../public/scripts/game-engine/campaign/story-book.js';
import { readPlot, readChapters, startPlot, plotEvent, actOf, MAX_ACTS, STORY_DEADLINES } from '../public/scripts/game-engine/campaign/plot.js';
import { readHub, withHubCampaign, hubCampaignCards } from '../public/scripts/game-engine/campaign/hub.js';
import { validatePack } from '../public/scripts/game-engine/campaign/campaign-pack.js';
import { getSectionSchema } from '../public/scripts/game-engine/campaign/campaign-pack-schema.js';
import * as keys from '../public/scripts/party/keys.js';
import { nowLine } from '../public/scripts/game-engine/ui/story-book.js';

const pack = (/** @type {string} */ id) => JSON.parse(readFileSync(new URL(`../public/mundos/${id}.pack.json`, import.meta.url), 'utf8'));

/**
 * El valle, en pequeño: tres capítulos con nombre, una bifurcación, un plazo, un secreto y un
 * final. Con su marca de género donde se habla a quien juega.
 */
const valle = readPlot({
    title: 'El valle',
    chapters: [
        { act: 1, title: 'La posada', summary: 'Llegas {cansado|cansada} a la posada.' },
        { act: 2, title: 'El bosque', summary: 'Los lobos bajan.' },
        { act: 3, title: 'El castillo', summary: 'Aquí se acaba.' },
    ],
    milestones: [
        {
            id: 'llegar', act: 1, title: 'La llegada', hint: 'Habla con Giles.', scene: 'La posada huele a humo.',
            opens: { kind: 'start' }, asks: { kind: 'talk', npc: 'Giles' }, changes: { reveal: ['El bosque'], standing: { 'los-lobos': 1 } },
        },
        {
            id: 'ayudar-lobos', act: 2, title: 'Con los lobos', hint: 'Lleva comida al campamento.', scene: 'Karl te espera.',
            opens: { kind: 'after', milestone: 'llegar' }, asks: { kind: 'arrive', place: 'El campamento' },
            changes: { close: ['ayudar-vane'] }, backdrop: 'El campamento',
        },
        {
            id: 'ayudar-vane', act: 2, title: 'Con Lord Vane', hint: 'Ve al castillo.', scene: 'Vane paga bien.',
            opens: { kind: 'after', milestone: 'llegar' }, asks: { kind: 'arrive', place: 'El castillo' },
        },
        {
            id: 'la-nieve', act: 2, title: 'La nieve manchada', hint: 'Atrapa al espía.', scene: 'Hay sangre en la nieve.',
            within: 3, late: { open: ['tarde'] },
            opens: { kind: 'after', milestone: 'ayudar-lobos' }, asks: { kind: 'defeat', enemy: 'Espía' },
        },
        {
            id: 'tarde', act: 2, title: 'El espía se escapa', hint: 'Ya no hay nada que hacer.', scene: 'El espía cruzó el paso.',
            opens: { kind: 'after', milestone: 'nunca' }, asks: { kind: 'arrive', place: 'El paso' },
        },
        {
            id: 'el-final', act: 3, title: 'La última paga', hint: 'Asalta el castillo.', scene: 'Todo acaba aquí.',
            opens: { kind: 'after', milestone: 'tarde' }, asks: { kind: 'win', board: 'Las puertas' }, changes: { ending: 'libres' },
        },
        {
            id: 'secreto', act: 1, title: 'La soga de Darek', hidden: true, scene: 'Darek lo cuenta todo.',
            opens: { kind: 'start' }, asks: { kind: 'talk', npc: 'Darek' },
        },
    ],
    endings: { libres: { title: 'El valle libre', scene: 'Nadie manda ya en el valle.', epilogues: [{ who: 'Karl', text: 'Vuelve al bosque.' }] } },
});

/** Jugar el valle hasta el capítulo 2: Giles el día 1, el campamento el día 4. */
function midway() {
    let state = startPlot(/** @type {any} */ (valle), 1).state;
    state = plotEvent(/** @type {any} */ (valle), state, { kind: 'talk', npc: 'Giles' }, 2).state;
    state = plotEvent(/** @type {any} */ (valle), state, { kind: 'arrive', place: 'El campamento' }, 4).state;
    return state;
}

describe('J9.3: los capítulos', () => {
    test('se leen con tolerancia: en inglés o como los escribe un Gem, uno por acto, en orden', () => {
        expect(readChapters({ chapters: [{ act: 2, title: 'B' }, { act: 1, title: 'A', summary: 'x' }, { act: 2, title: 'Otra' }, { act: 0, title: 'No' }, { act: 3 }] }))
            .toEqual([{ act: 1, title: 'A', summary: 'x' }, { act: 2, title: 'B', summary: '' }]);
        expect(readChapters({ capitulos: [{ acto: 1, titulo: 'La posada', resumen: 'Llegas.' }] }))
            .toEqual([{ act: 1, title: 'La posada', summary: 'Llegas.' }]);
        expect(readChapters({ chapters: [{ act: MAX_ACTS + 1, title: 'Demasiado' }] })).toEqual([]);
    });

    test('con capítulos, el hilo tiene tantos actos como ellos; sin ellos, tres (como siempre)', () => {
        const five = readPlot({ chapters: [1, 2, 3, 4, 5].map(act => ({ act, title: `C${act}` })), milestones: [{ id: 'x', title: 'X', act: 5 }, { id: 'y', title: 'Y', act: 7 }] });
        expect(five?.milestones.map(m => m.act)).toEqual([5, 5]);
        expect(five?.chapters).toHaveLength(5);
        const plain = readPlot({ milestones: [{ id: 'x', title: 'X', act: 5 }] });
        expect(plain?.milestones[0].act).toBe(3);
        expect(plain).not.toHaveProperty('chapters');
    });

    test('Strahd trae sus cinco capítulos, y cada hito cae en uno con nombre', () => {
        const plot = readPlot(pack('strahd').plot);
        const frames = chapterFrames(plot);
        expect(frames.map(f => f.title)).toEqual(['La aldea de Barovia', 'El campamento vistani', 'Vallaki y sus alrededores', 'Camino del castillo', 'El castillo Ravenloft']);
        expect(new Set(plot?.milestones.map(m => m.act))).toEqual(new Set([1, 2, 3, 4, 5]));
        expect(validatePack(pack('strahd')).ok).toBe(true);
    });

    test('1387 trae sus tres capítulos, uno por acto, y el paquete sigue valiendo', () => {
        const data = pack('1387');
        const acts = new Set(readPlot(data.plot)?.milestones.filter(m => !m.hidden).map(m => m.act));
        expect(readChapters(data.plot).map(c => c.act)).toEqual([...acts].sort());
        expect(validatePack(data).ok).toBe(true);
    });

    test('el prólogo del gremio se llama así, aunque no traiga capítulos', () => {
        expect(chapterFrames(readPlot(pack('gremio').plot)).map(f => [f.name, f.title])).toEqual([['Capítulo 1', 'El prólogo']]);
    });

    test('el contrato publica los capítulos, y el acto llega hasta el último', () => {
        const plot = getSectionSchema('plot');
        expect(plot.properties.chapters.items.required).toEqual(['act', 'title']);
        expect(plot.properties.milestones.items.properties.act.maximum).toBe(MAX_ACTS);
    });

    test('un secreto abierto desde el principio no pone la partida en su acto', () => {
        const plot = readPlot(pack('strahd').plot);
        const start = startPlot(/** @type {any} */ (plot), 1).state;
        expect(start.open).toContain('la-puerta-sin-pomo');
        expect(actOf(plot, start)).toBe(1);
        expect(chapterNow(plot, start)).toMatchObject({ act: 1, number: 1, of: 5, line: 'Capítulo 1 de 5: La aldea de Barovia' });
    });

    test('por qué capítulo vais, para el tablón del gremio; nada si ya acabó', () => {
        const state = midway();
        expect(guildChapterLine(valle, state)).toBe('Capítulo 2 de 3: El bosque');
        const ended = { ...state, done: [...state.done, 'el-final'] };
        expect(chapterNow(valle, ended)).toMatchObject({ act: 3, ended: true });
        expect(guildChapterLine(valle, ended)).toBe('');
        expect(guildChapterLine(null, state)).toBe('');
        // Un hilo de un solo capítulo sin nombre no tiene nada que decir.
        expect(guildChapterLine(readPlot({ milestones: [{ id: 'a', title: 'A', opens: { kind: 'start' } }] }), { open: ['a'] })).toBe('');
    });

    test('el gremio apunta el capítulo y el tablón lo dice mientras está en curso', () => {
        const worlds = [{ id: 'valle', name: 'El valle', pack: '/mundos/valle.pack.json' }];
        const hub = withHubCampaign({}, 'valle', { worldName: 'El valle · Ada', chapter: 'Capítulo 2 de 3: El bosque' });
        expect(readHub(hub).campaigns.valle.chapter).toBe('Capítulo 2 de 3: El bosque');
        expect(hubCampaignCards({ worlds, hub })[0]).toMatchObject({ state: 'en-curso', chapter: 'Capítulo 2 de 3: El bosque' });
        const done = withHubCampaign(hub, 'valle', { finished: true, ending: 'El valle libre' });
        expect(hubCampaignCards({ worlds, hub: done })[0].chapter).toBe('');
        expect(hubCampaignCards({ worlds })[0].chapter).toBe('');
        expect(readHub({ campaigns: { x: { worldName: 'X', chapter: '   ' } } }).campaigns.x).not.toHaveProperty('chapter');
    });
});

describe('D-J46: los plazos, apagados por ahora', () => {
    test('apagados, ningún hito tiene reloj: ni arriba del libro, ni en su página, ni junto a lo que tenéis entre manos', () => {
        expect(STORY_DEADLINES.on).toBe(false);
        const state = midway();
        expect(deadlinesOf(valle, state, 5)).toEqual([]);
        expect(focusClock(valle, state, 5, 'la-nieve')).toBeNull();
        const read = buildStoryBook({ plot: valle, state, today: 5 });
        expect(read.clocks).toEqual([]);
        expect(read.chapters[1].pages[2].clock).toBeNull();
        const plot = readPlot(pack('1387').plot);
        expect(deadlinesOf(plot, { open: ['la-nieve-manchada'], since: { 'la-nieve-manchada': 20 } }, 21)).toEqual([]);
    });

    test('apagados, pasar los días no pierde nada, y lo escrito y lo guardado siguen ahí', () => {
        const state = midway();
        const step = plotEvent(valle, state, { kind: 'day', day: 30 });
        expect(step.missed).toEqual([]);
        expect(step.state.open).toContain('la-nieve');
        expect(step.state.since['la-nieve']).toBe(4);
        expect(valle?.milestones.find(m => m.id === 'la-nieve')?.within).toBe(3);
    });
});

describe('J9.5: los plazos a la vista (encendidos dentro de la prueba)', () => {
    // D-J46: están apagados; aquí se encienden para probar cómo funcionan cuando Daniel los encienda.
    beforeAll(() => { STORY_DEADLINES.on = true; });
    afterAll(() => { STORY_DEADLINES.on = false; });

    test('cuánto queda, en llano', () => {
        expect([daysLeftLabel(0), daysLeftLabel(1), daysLeftLabel(4)]).toEqual(['Hoy es el último día', 'Queda 1 día', 'Quedan 4 días']);
    });

    test('un hito con plazo dice cuánto le queda y cómo aprieta, día a día', () => {
        const state = midway();
        // La nieve se abrió el día 4, con tres días.
        expect(deadlinesOf(valle, state, 4)).toEqual([expect.objectContaining({
            id: 'la-nieve', left: 3, of: 3, urgency: 'holgado', label: 'Quedan 3 días', line: '«La nieve manchada»: quedan 3 días de 3.',
            late: 'Si se pasa el plazo, se pierde, y la historia sigue sin esperaros.',
        })]);
        expect(deadlinesOf(valle, state, 6)[0]).toMatchObject({ left: 1, urgency: 'pronto', label: 'Queda 1 día' });
        expect(deadlinesOf(valle, state, 7)[0]).toMatchObject({ left: 0, urgency: 'hoy', line: '«La nieve manchada»: hoy es el último día.' });
        // Sin saber qué día es, no se dice nada.
        expect(deadlinesOf(valle, state, 0)).toEqual([]);
    });

    test('1387: la nieve manchada tiene su reloj', () => {
        const plot = readPlot(pack('1387').plot);
        const clocks = deadlinesOf(plot, { open: ['la-nieve-manchada'], since: { 'la-nieve-manchada': 20 } }, 21);
        expect(clocks).toEqual([expect.objectContaining({ id: 'la-nieve-manchada', left: 2, of: 3, label: 'Quedan 2 días' })]);
    });

    test('lo cumplido, lo perdido y lo secreto no tienen reloj', () => {
        const secret = readPlot({ milestones: [{ id: 's', title: 'S', hidden: true, within: 2, opens: { kind: 'start' } }] });
        expect(deadlinesOf(secret, { open: ['s'], since: { s: 1 } }, 1)).toEqual([]);
        expect(deadlinesOf(valle, { done: ['la-nieve'], since: { 'la-nieve': 4 } }, 5)).toEqual([]);
    });

    test('el reloj de lo que tenéis entre manos; si no tiene, el más apurado', () => {
        const state = midway();
        expect(focusClock(valle, state, 5, 'la-nieve')?.id).toBe('la-nieve');
        expect(focusClock(valle, state, 5, 'otro')?.id).toBe('la-nieve');
        expect(focusClock(valle, { open: ['llegar'] }, 5, 'llegar')).toBeNull();
    });
});

describe('J9.6: lo decidido', () => {
    test('se lee lo de antes (texto suelto o {day, text}) y lo de ahora, con su hito y lo que salió', () => {
        expect(readDecisions(['Suelto', { day: 3, text: 'Con día' }, { day: 2, text: 'X', milestone: 'm', act: 2, came: ['A', ''] }, null, { text: '' }])).toEqual([
            { day: 0, text: 'Suelto', milestone: '', act: 0, came: [] },
            { day: 3, text: 'Con día', milestone: '', act: 0, came: [] },
            { day: 2, text: 'X', milestone: 'm', act: 2, came: ['A'] },
        ]);
    });

    test('apuntar no repite y olvida lo más viejo', () => {
        const once = recordDecisions([{ day: 1, text: 'A' }], [{ day: 1, text: 'A' }, { day: 2, text: 'B' }]);
        expect(once.map(d => d.text)).toEqual(['A', 'B']);
        const many = recordDecisions([], Array.from({ length: BOOK_LIMITS.decisions + 5 }, (_, i) => ({ day: i + 1, text: `D${i}` })));
        expect(many).toHaveLength(BOOK_LIMITS.decisions);
        expect(many[0].text).toBe('D5');
    });

    test('una escena deja lo que dijiste, con su hito, la tirada y lo que salió', () => {
        const entries = sceneDecisionEntries({
            scene: { id: 'llegar', title: 'La llegada' },
            milestone: { id: 'llegar', act: 1, title: 'La llegada' },
            day: 2,
            choices: [{ beat: 1, said: 'Te pago', outcome: null }, { beat: 3, said: 'Miento', outcome: 'mal' }, { beat: 4, said: '' }],
            came: { 1: ['Giles os mira mejor.'], 3: ['−5 de oro.'] },
            notes: ['Giles vio a un encapuchado.'],
        });
        expect(entries).toEqual([
            { day: 2, text: 'La llegada: «Te pago»', milestone: 'llegar', act: 1, came: ['Giles os mira mejor.'] },
            { day: 2, text: 'La llegada: «Miento»', milestone: 'llegar', act: 1, came: ['La tirada salió mal.', '−5 de oro.'] },
            { day: 2, text: 'Giles vio a un encapuchado.', milestone: 'llegar', act: 1, came: [] },
        ]);
    });

    test('un suceso de la crónica: lo elegido y lo que salió', () => {
        expect(sucesoDecision('Un mendigo: Le dais una moneda (Persuasión: 15 ✓). Os bendice (−1 de oro)'))
            .toEqual({ text: 'Un mendigo: Le dais una moneda (Persuasión: 15 ✓)', came: ['Os bendice (−1 de oro)'] });
        expect(sucesoDecision('Un cruce: Seguís de largo.')).toEqual({ text: 'Un cruce: Seguís de largo', came: [] });
    });

    test('las claves son las de la partida', () => {
        expect(BOOK_KEYS).toMatchObject({
            plot: keys.PLOT_KEY, plotState: keys.PLOT_STATE_KEY, decisions: keys.PLOT_DECISIONS_KEY, dialogues: keys.DIALOGUE_MEMORY_KEY,
            memories: keys.MEMORIES_KEY, deeds: keys.DEEDS_KEY, actStarts: keys.ACT_STARTS_KEY,
        });
    });
});

describe('J9.6: el Diario como un libro', () => {
    const chat = [
        { mes: '🃏 [SUCESO] Un mendigo: Le dais una moneda. Os bendice (−1 de oro)' },
        { mes: '⚰️ [MUERTE] Bran cae en el camino.' },
        { mes: '🎲 [TIRADA] Percepción: 12.' },
        { mes: '📜 [HILO] Una escena larga que ya está en las páginas.' },
        { mes: '⬆️ [NIVEL] Ada sube a nivel 2.' },
        { mes: 'Hola', is_user: true },
    ];

    const book = () => buildStoryBook({
        plot: valle,
        state: midway(),
        today: 5,
        decisions: [
            { day: 2, text: 'La llegada: «Te pago»', milestone: 'llegar', act: 1, came: ['Giles os mira mejor.'] },
            // De antes de J9.6: sin hito, va a su capítulo por el día.
            { day: 4, text: 'El bosque: «Nos quedamos»' },
        ],
        // El día en que empieza un capítulo, lo que pasa ya es suyo: lo de Giles fue el día antes.
        dialogueMemory: { giles: { learned: [{ who: 'Giles', text: 'Vio a un encapuchado.', day: 1 }] } },
        memories: [{ day: 4, text: 'Cantasteis junto al fuego.', who: ['Bran'] }],
        deeds: [{ day: 1, text: 'Pagasteis la cuenta de otro.' }],
        chat,
        actStarts: { 2: 3 },
        factions: [{ id: 'los-lobos', name: 'Los Lobos del Bosque' }],
        who: { heroe: 'Mujer' },
    });

    test('capítulos: el hecho, en el que estáis y los que siguen en blanco, sin destripar su nombre', () => {
        const read = book();
        expect(read.title).toBe('El valle');
        expect(read.now).toMatchObject({ act: 2, line: 'Capítulo 2 de 3: El bosque' });
        expect(read.chapters.map(c => [c.label, c.state])).toEqual([
            ['Capítulo 1 · La posada', 'hecho'],
            ['Capítulo 2 · El bosque', 'ahora'],
            ['Capítulo 3', 'en-blanco'],
        ]);
        expect(read.chapters[2]).toMatchObject({ title: '', summary: '', pages: [] });
        // La entrada del capítulo, con el género de quien juega.
        expect(read.chapters[0].summary).toBe('Llegas cansada a la posada.');
        expect(read.chapters[0].closing).toBe('Quedó hecho: La llegada.');
    });

    test('cada hito que se ha visto es una página; lo no abierto y el secreto sin encontrar no salen', () => {
        const read = book();
        expect(read.chapters[0].pages.map(p => [p.id, p.state])).toEqual([['llegar', 'hecho']]);
        expect(read.chapters[1].pages.map(p => [p.id, p.state])).toEqual([['ayudar-lobos', 'hecho'], ['ayudar-vane', 'cerrado'], ['la-nieve', 'abierto']]);
        const all = read.chapters.flatMap(c => c.pages.map(p => p.id));
        expect(all).not.toContain('secreto');
        expect(all).not.toContain('tarde');
        expect(read.chapters[1].pending).toBe(1);
    });

    test('lo que salió de cada hito: adónde llevó, qué cerró, qué apareció y cómo os miran', () => {
        const [first, second] = book().chapters;
        expect(first.pages[0].came).toEqual([
            // «Con Lord Vane» se cerró: eso lo cuenta su página, no esta.
            'Llevó a «Con los lobos».',
            'Apareció en el mapa: El bosque.',
            'Los Lobos del Bosque os miran mejor.',
        ]);
        expect(second.pages[0].came).toEqual(['Llevó a «La nieve manchada».', 'Se cerró otro camino: «Con Lord Vane».']);
        // El camino que no se tomó no cuenta su escena: no se vio.
        expect(second.pages[1]).toMatchObject({ text: '', came: ['Se cerró al cumplir «Con los lobos».'] });
    });

    test('lo abierto dice lo que toca y su reloj (con los plazos encendidos, D-J46)', () => {
        STORY_DEADLINES.on = true;
        try {
            const open = book().chapters[1].pages[2];
            expect(open).toMatchObject({ hint: 'Atrapa al espía.', came: [] });
            expect(open.clock).toMatchObject({ left: 2, label: 'Quedan 2 días' });
            expect(book().clocks.map(c => c.id)).toEqual(['la-nieve']);
        } finally {
            STORY_DEADLINES.on = false;
        }
    });

    test('lo decidido va a su página, o a su capítulo por el día; los sucesos, por dónde empezó el acto', () => {
        const [first, second] = book().chapters;
        expect(first.pages[0].decided).toEqual([expect.objectContaining({ text: 'La llegada: «Te pago»', came: ['Giles os mira mejor.'], page: 'La llegada' })]);
        expect(second.decided.map(d => d.text)).toEqual(['El bosque: «Nos quedamos»']);
        // El suceso es el primer mensaje: antes de que empezara el acto 2 (en el mensaje 3).
        expect(first.decided).toEqual([expect.objectContaining({ text: 'Un mendigo: Le dais una moneda', came: ['Os bendice (−1 de oro)'] })]);
    });

    test('por el camino, lo que movió la historia; no las tiradas ni el hilo', () => {
        const [first, second] = book().chapters;
        expect(first.road).toEqual(['Bran cae en el camino.', 'Pagasteis la cuenta de otro.']);
        expect(second.road).toEqual(['Ada sube a nivel 2.']);
        expect(first.told).toEqual(['Giles: Vio a un encapuchado.']);
        expect(second.moments).toEqual(['Cantasteis junto al fuego.']);
    });

    test('todo lo decidido, capítulo a capítulo, para la crónica', () => {
        expect(book().decided.map(d => [d.where, d.text])).toEqual([
            ['Capítulo 1 · La posada', 'La llegada: «Te pago»'],
            ['Capítulo 1 · La posada', 'Un mendigo: Le dais una moneda'],
            ['Capítulo 2 · El bosque', 'El bosque: «Nos quedamos»'],
        ]);
    });

    test('lo perdido por el plazo, y el secreto encontrado, en el capítulo en el que estáis', () => {
        const state = midway();
        const late = { ...state, open: ['tarde', 'secreto'], missed: ['la-nieve'], done: [...state.done, 'secreto'] };
        const read = buildStoryBook({ plot: valle, state: late, today: 9 });
        const pages = read.chapters[1].pages;
        expect(pages.find(p => p.id === 'la-nieve')).toMatchObject({ state: 'perdido', came: ['Se os pasó el plazo.', 'Por llegar tarde: «El espía se escapa».'] });
        expect(read.chapters[0].pages.find(p => p.id === 'secreto')).toMatchObject({ state: 'hecho', secret: true, text: 'Darek lo cuenta todo.' });
        expect(read.chapters[0].closing).toBe('Quedó hecho: La llegada.');
    });

    test('con el final, todo lo jugado queda hecho, y el final se cuenta', () => {
        const state = { ...midway(), done: ['llegar', 'ayudar-lobos', 'el-final'] };
        const read = buildStoryBook({ plot: valle, state, ending: endingOf(valle, 'libres') });
        expect(read.now).toMatchObject({ ended: true });
        expect(read.chapters.map(c => c.state)).toEqual(['hecho', 'hecho', 'hecho']);
        expect(read.ending).toEqual({ title: 'El valle libre', scene: 'Nadie manda ya en el valle.', epilogues: ['Karl: Vuelve al bosque.'] });
        expect(read.chapters[2].pages[0].came).toContain('Con esto, la historia llegó a su final.');
        expect(nowLine(read)).toBe('La historia llegó a su final: El valle libre.');
    });

    test('sin hilo, un libro vacío que no rompe', () => {
        expect(buildStoryBook({ plot: null })).toMatchObject({ title: 'Diario', chapters: [], empty: true });
        expect(buildStoryBook({ plot: valle, state: null }).chapters[0].state).toBe('ahora');
    });

    test('la línea de bajo el título', () => {
        expect(nowLine(book())).toBe('Vais por el capítulo 2 de 3: El bosque.');
        expect(nowLine(buildStoryBook({ plot: pack('gremio').plot, state: { open: ['el-muelle'] } }))).toBe('El prólogo.');
    });

    test('de los metadatos de la partida, con las mismas claves', () => {
        const meta = {
            [keys.PLOT_KEY]: valle, [keys.PLOT_STATE_KEY]: midway(), [keys.PLOT_DECISIONS_KEY]: [{ day: 2, text: 'A', milestone: 'llegar' }],
            [keys.MEMORIES_KEY]: [{ day: 1, text: 'M' }], [keys.ACT_STARTS_KEY]: { 2: 3 }, plotEnding: 'libres',
        };
        const input = bookInputFromMetadata(meta, { today: 5, chat });
        expect(input).toMatchObject({ today: 5, decisions: meta[keys.PLOT_DECISIONS_KEY], actStarts: { 2: 3 }, ending: { title: 'El valle libre' } });
        expect(buildStoryBook(input).chapters[0].pages[0].decided[0].text).toBe('A');
    });

    test('Strahd, a medio capítulo 2: su libro', () => {
        const plot = readPlot(pack('strahd').plot);
        let state = startPlot(/** @type {any} */ (plot), 1).state;
        state = plotEvent(/** @type {any} */ (plot), state, { kind: 'win', board: 'Taberna Sangre de la Enredadera' }, 2).state;
        state = plotEvent(/** @type {any} */ (plot), state, { kind: 'win', board: 'Mansión del Burgomaestre' }, 3).state;
        const read = buildStoryBook({ plot, state, today: 4, who: { heroe: 'Mujer', grupo: ['Mujer'] } });
        expect(read.now?.line).toBe('Capítulo 2 de 5: El campamento vistani');
        expect(read.chapters.map(c => c.state)).toEqual(['hecho', 'ahora', 'en-blanco', 'en-blanco', 'en-blanco']);
        expect(read.chapters[0].pages[0].text).toMatch(/estáis hechas/);
        // El secreto del acto 3 no sale hasta encontrarlo.
        expect(read.chapters.flatMap(c => c.pages).some(p => p.id === 'la-puerta-sin-pomo')).toBe(false);
    });
});

describe('J11.5: la crónica consultable', () => {
    const decided = [
        { day: 1, text: 'La llegada: «Te pago»', came: ['Giles os mira mejor.'], act: 1, where: 'Capítulo 1 · La posada', page: 'La llegada' },
        { day: 4, text: 'El bosque: «Nos quedamos con Karl»', came: ['Los Lobos os miran mejor.'], act: 2, where: 'Capítulo 2 · El bosque', page: '' },
    ];

    test('buscar: sin tildes ni mayúsculas, todas las palabras, en lo dicho, lo que salió o el capítulo', () => {
        expect(searchDecided(decided, '')).toHaveLength(2);
        expect(searchDecided(decided, 'giles').map(d => d.day)).toEqual([1]);
        expect(searchDecided(decided, 'CAPITULO 2 karl').map(d => d.day)).toEqual([4]);
        expect(searchDecided(decided, 'lobos posada')).toEqual([]);
    });

    test('la copia del gremio se lee igual que el libro, y sin lo que no hace falta', () => {
        const full = buildStoryBook({ plot: valle, state: midway(), today: 5, decisions: [{ day: 2, text: 'La llegada: «Te pago»', milestone: 'llegar' }], memories: [{ day: 4, text: 'M' }] });
        const back = readStoryBook(JSON.parse(JSON.stringify(bookSnapshot(full))));
        expect(back?.chapters.map(c => [c.label, c.state, c.pages.length])).toEqual(full.chapters.map(c => [c.label, c.state, c.pages.length]));
        expect(back?.decided.map(d => d.text)).toEqual(full.decided.map(d => d.text));
        expect(back?.clocks).toEqual([]);
        expect(back?.chapters[1].moments).toEqual([]);
        expect(back?.now?.line).toBe('Capítulo 2 de 3: El bosque');
    });

    test('recorta lo largo y lo mucho', () => {
        const long = 'palabra '.repeat(200);
        const many = Array.from({ length: 120 }, (_, i) => ({ day: 1, text: `${i}: ${long}`, milestone: 'llegar' }));
        const snap = bookSnapshot(buildStoryBook({ plot: valle, state: midway(), decisions: many }));
        const kept = snap.chapters.flatMap((/** @type {any} */ c) => [...c.decided, ...c.pages.flatMap((/** @type {any} */ p) => p.decided)]);
        expect(kept).toHaveLength(BOOK_LIMITS.snapshotDecided);
        expect(kept[0].text.length).toBeLessThanOrEqual(BOOK_LIMITS.snapshotText);
    });

    test('se guarda por campaña en el gremio, se lee aunque llegue roto, y una vacía no se ofrece', () => {
        const full = buildStoryBook({ plot: valle, state: midway(), decisions: [{ day: 2, text: 'A', milestone: 'llegar' }] });
        let stored = withChronicle(null, 'valle', full);
        stored = withChronicle(stored, 'strahd', buildStoryBook({ plot: null }));
        stored = { ...stored, roto: 'no', otro: { chapters: 'no' } };
        expect(Object.keys(readChronicles(stored)).sort()).toEqual(['strahd', 'valle']);
        expect(chronicleOfCampaign(stored, 'valle')?.decided.map(d => d.text)).toEqual(['A']);
        expect(chronicleOfCampaign(stored, 'strahd')).toBeNull();
        expect(chronicleOfCampaign(stored, 'nada')).toBeNull();
        expect(withChronicle(stored, '', full)).toEqual(stored);
        expect(HUB_CHRONICLES_KEY).toBe('hubChronicles');
    });

    test('un libro guardado mal escrito se pone en su sitio', () => {
        const read = readStoryBook({ title: '', chapters: [{ state: 'raro', pages: [{ title: 'P', state: 'x', decided: [{ text: 'D', came: 'no' }] }, { title: '' }] }, null] });
        expect(read).toMatchObject({ title: 'Diario', chapters: [{ act: 1, name: 'Capítulo 1', state: 'hecho', pages: [{ title: 'P', state: 'hecho' }] }] });
        expect(read?.decided).toEqual([expect.objectContaining({ text: 'D', came: [], where: 'Capítulo 1' })]);
        expect(readStoryBook(null)).toBeNull();
    });

    test('listas en llano', () => {
        expect([listOf([]), listOf(['A']), listOf(['A', 'B']), listOf(['A', 'B', 'C'])]).toEqual(['', 'A', 'A y B', 'A, B y C']);
    });
});
