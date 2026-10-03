/**
 * J13.9 (D-J60): lo que se cuenta, dicho por la gente. Las quedadas, las noches y los romances ya
 * no traen notas de narrador: lo dice alguien que está allí. «Anteriormente…» lo dice uno de los
 * tuyos. Y el guion en Word ya no pone «Narrador» a lo que no lo es.
 */
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { readScene, readMeetupRows, renderScene, startScene, sceneStep, sceneView } from '../public/scripts/game-engine/campaign/meetups.js';
import { recapSaid, saidByUs } from '../public/scripts/game-engine/campaign/guidance.js';
import { buildScript, NARRATOR } from '../public/scripts/game-engine/campaign/script-doc.js';

const read = (/** @type {string} */ path) => JSON.parse(readFileSync(new URL(`../public/${path}`, import.meta.url), 'utf8'));

describe('J13.9: sin notas de narrador en quedadas, noches y romances', () => {
    for (const name of ['quedadas', 'noches', 'romances']) {
        test(`${name}.json: ningún paso trae «note», y cada paso dice algo`, () => {
            const rows = read(`compendio/${name}.json`).rows.filter((/** @type {any} */ r) => Array.isArray(r.beats));
            const noted = rows.flatMap((/** @type {any} */ r) => r.beats.map((/** @type {any} */ b, /** @type {number} */ i) => (String(b.note ?? '').trim() ? `${r.id}/${i}` : '')).filter(Boolean));
            expect(noted).toEqual([]);
            const silent = rows.flatMap((/** @type {any} */ r) => r.beats.map((/** @type {any} */ b, /** @type {number} */ i) => (String(b.say ?? '').trim() ? '' : `${r.id}/${i}`)).filter(Boolean));
            expect(silent).toEqual([]);
        });
    }

    test('el «about» de cada archivo ya no pide NOTE', () => {
        for (const name of ['quedadas', 'noches', 'romances']) expect(read(`compendio/${name}.json`).about).not.toMatch(/\bNOTE\b/);
    });

    test('Grimm no habla hasta su rango 8: lo de antes lo dicen otros que están allí o tus respuestas', () => {
        const data = readMeetupRows(read('compendio/quedadas.json'));
        const grimm = data.scenes.filter(s => s.who === 'Grimm');
        expect(grimm.map(s => s.rank)).toEqual([2, 4, 6, 8, 10]);
        for (const scene of grimm.filter(s => s.rank < 8)) {
            for (const beat of scene.beats.filter(b => !b.who)) expect(beat.say).toBe('Mm.');
        }
        expect(grimm.find(s => s.rank === 2)?.beats[0]).toMatchObject({ who: 'El tabernero', say: expect.stringContaining('todo el sueldo de la semana') });
        expect(grimm.find(s => s.rank === 6)?.beats.flatMap(b => b.replies.map(r => r.text)).join(' ')).toMatch(/doble/);
    });
});

describe('J13.9: un paso de quedada que dice otro que está allí', () => {
    const scene = /** @type {any} */ (readScene({
        id: 'x', who: 'Grimm', rank: 2, beats: [
            { who: 'El tabernero', say: 'El grandullón lo ha dado todo.' },
            { say: 'Mm.', replies: [{ text: 'Es tu familia, ¿verdad?', bond: 1, then: '(Asiente.)' }, { text: 'Vale.', bond: 0 }] },
        ],
    }));

    test('`readScene` guarda quién lo dice, y `sceneView` lo pone en la placa', () => {
        expect(scene.beats[0]).toMatchObject({ who: 'El tabernero', say: 'El grandullón lo ha dado todo.' });
        expect(scene.beats[1].who).toBeUndefined();
        let state = startScene();
        expect(sceneView(scene, state)).toMatchObject({ speaker: 'El tabernero', who: 'Grimm', next: 'continue' });
        state = sceneStep(scene, state, { next: true });
        expect(sceneView(scene, state)).toMatchObject({ speaker: 'Grimm', say: 'Mm.', next: 'reply' });
    });

    test('con el texto de tu héroe resuelto, quien habla sigue ahí', () => {
        expect(renderScene(scene, { hero: { name: 'Tessa', gender: 'Mujer' } }).beats[0].who).toBe('El tabernero');
    });
});

describe('J13.9: «Anteriormente…» dicho por alguien', () => {
    const focus = { title: 'El cáliz ensangrentado', hint: 'Sal viva del cuarto.' };
    const deeds = [{ day: 3, text: 'Bran se unió al grupo en El Pueblo de Barro.' }, { day: 5, text: 'Huisteis de El Peaje Norte.' }];

    test('uno de los tuyos: en «nosotros», con lo que tenéis entre manos y lo último que pasó', () => {
        expect(recapSaid({ who: 'Bran', along: true, focus, deeds })).toEqual({
            who: 'Bran',
            lines: ['Íbamos con lo de «El cáliz ensangrentado». Sal viva del cuarto.', '¿Te acuerdas? Huimos de El Peaje Norte.'],
        });
    });

    test('quien lleva el gremio no iba contigo: en «vosotros»; sin hilo, el encargo', () => {
        const said = recapSaid({ who: 'Brunilda', along: false, taken: { title: 'Las ratas', locationName: 'Puerto Alba' }, deeds: deeds.slice(1) });
        expect(said?.lines).toEqual(['Tenéis el encargo «Las ratas», en Puerto Alba.', '¿Te acuerdas? Huisteis de El Peaje Norte.']);
    });

    test('de la pista, solo la primera frase: lo que toca, no cómo se juega', () => {
        const prologue = { title: 'El ratero del muelle', hint: 'Para al ratero. En el tablero, colócate y pulsa «Empezar».' };
        expect(recapSaid({ who: 'Gerd', focus: prologue })?.lines).toEqual(['Íbamos con lo de «El ratero del muelle». Para al ratero.']);
    });

    test('sin nadie que lo diga, o sin nada que decir, nada', () => {
        expect(recapSaid({ who: '', focus, deeds })).toBeNull();
        expect(recapSaid({ who: 'Bran' })).toBeNull();
    });

    test('«vosotros» pasa a «nosotros» solo donde toca', () => {
        expect(saidByUs('Os entregasteis en el patio.')).toBe('Nos entregamos en el patio.');
        expect(saidByUs('Salisteis de la pelea de El Muelle hablando (convencer).')).toBe('Salimos de la pelea de El Muelle hablando (convencer).');
        expect(saidByUs('Gerd os la guarda. Es vuestra.')).toBe('Gerd nos la guarda. Es nuestra.');
        expect(saidByUs('Dos osos y nosotros.')).toBe('Dos osos y nosotros.');
    });
});

describe('J13.9: el guion en Word ya no llama «Narrador» a lo que no lo es', () => {
    const PACK = {
        version: 1,
        world: { name: 'Villa Prueba' },
        locations: [{ name: 'Villa Prueba', type: 'village' }],
        confidants: [{
            name: 'Ana', description: 'Herrera.',
            scenes: [{ rank: 2, title: 'La forja', scene: 'Ana te enseña la forja.' }, { rank: 4, title: 'El martillo', scene: 'Ana rompe su martillo.' }],
        }],
        plot: { title: 'Prueba', milestones: [] },
    };
    const compendio = {
        quedadas: { rows: [{ id: 'prueba-ana-2', kind: 'escena', who: 'Ana', campaign: 'prueba', rank: 2, title: 'La forja', beats: [{ say: 'Mira mi forja.' }] }] },
        romances: { rows: [{ id: 'romance-ana-epilogo', kind: 'epilogo', who: 'Ana', home: 'Ana vuelve contigo.', away: 'Ana se queda contigo.', hall: 'Juntos desde el día {day}.' }] },
    };
    const lines = new Map(buildScript(PACK, { campaign: 'prueba', compendio }).blocks.filter(b => b.id).map(b => [b.id, b]));

    test('la escena en prosa con su quedada escrita es su resumen; sin ella, sigue siendo del narrador', () => {
        expect(lines.get('K:ana/vinculo2')).toMatchObject({ label: 'Resumen', kind: 'pantalla' });
        expect(lines.get('K:ana/vinculo4')).toMatchObject({ label: NARRATOR, kind: 'narrador' });
    });

    test('el epílogo del romance se lee escrito, en «Qué fue de» y en el Salón de la fama', () => {
        expect(lines.get('RO:romance-ana-epilogo/home')).toMatchObject({ label: 'Qué fue de', kind: 'pantalla', pre: 'Si volvéis al gremio' });
        expect(lines.get('RO:romance-ana-epilogo/hall')).toMatchObject({ label: 'En el Salón de la fama', kind: 'pantalla' });
    });
});
