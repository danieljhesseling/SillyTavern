import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    ROMANCE_RANK, DATES, SIGNAL_REST, HEART, heroIdentity, readRomanceCard, readRomanceCards, romanceCardOf, allowsHero,
    readRomanceRows, hasWrittenRomance, canRomance, createRomanceState, readRomanceState, romanceOf, stageOf, isCouple, couplesOf,
    mergeRomance, romanceScene, romanceChoice, advanceRomance, romanceLabel, romanceWants, coupleNote, withCoupleNote,
    coupleEpilogue, coupleHallEntry,
} from '../public/scripts/game-engine/campaign/romance.js';
import { readRomanceOption, romanceOptionRow, withRomanceRow } from '../public/scripts/game-engine/ui/romance-option.js';
import { addToHall, readHall, describeHallEntry, describeHallCount } from '../public/scripts/game-engine/campaign/legacy.js';
import { renderScene } from '../public/scripts/game-engine/campaign/meetups.js';
import { leftoverMarkers } from '../public/scripts/game-engine/campaign/grammar.js';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const json = (/** @type {string} */ file) => JSON.parse(readFileSync(join(ROOT, 'public', 'compendio', file), 'utf8'));

const cards = readRomanceCards(json('companeros.json'));
const data = readRomanceRows(json('romances.json'));
const nella = /** @type {any} */ (romanceCardOf(cards, 'Nella Tresflechas'));
const osric = /** @type {any} */ (romanceCardOf(cards, 'Osric'));
const gerd = /** @type {any} */ (romanceCardOf(cards, 'Gerd el Mellado'));
const tessa = { name: 'Tessa', gender: 'Mujer' };
const bruno = { name: 'Bruno', gender: 'Hombre' };

/** Jugar una escena eligiendo, en cada paso, la respuesta con corazón (o la primera). */
const playHeart = (/** @type {any} */ scene) => scene.beats.map((/** @type {any} */ beat, /** @type {number} */ i) => {
    const heart = beat.replies.findIndex((/** @type {any} */ r) => r.text.startsWith(HEART));
    return { beat: i, reply: heart >= 0 ? heart : 0 };
});
/** Lo mismo, sin la del corazón nunca. */
const playCold = (/** @type {any} */ scene) => scene.beats.map((/** @type {any} */ beat, /** @type {number} */ i) => ({
    beat: i, reply: Math.max(0, beat.replies.findIndex((/** @type {any} */ r) => !r.text.startsWith(HEART) && !r.romance)),
}));

describe('J14.10: quién lo permite (el campo `romance` de cada compañero)', () => {
    test('quién eres, para el romance: lo que elegiste al crearte', () => {
        expect(heroIdentity(tessa)).toBe('mujer');
        expect(heroIdentity(bruno)).toBe('hombre');
        expect(heroIdentity({ gender: 'No binario (en femenino)' })).toBe('no-binario');
        expect(heroIdentity({ gender: 'No binario (en masculino)' })).toBe('no-binario');
        expect(heroIdentity({})).toBe('');
    });

    test('la ficha: con quién, o con nadie; sin campo, ni siquiera sale', () => {
        expect(readRomanceCard({ who: 'Ana', romance: { with: 'todos' } })?.with).toEqual(['todos']);
        expect(readRomanceCard({ who: 'Ana', romance: { with: ['Mujeres', 'no binario'] } })?.with).toEqual(['mujeres', 'no-binario']);
        expect(readRomanceCard({ who: 'Ana', romance: 'hombres' })?.with).toEqual(['hombres']);
        expect(readRomanceCard({ who: 'Ana', romance: { with: 'nadie', no: 'No.' } })).toMatchObject({ with: [], no: 'No.' });
        expect(readRomanceCard({ who: 'Ana', romance: false })?.with).toEqual([]);
        expect(readRomanceCard({ who: 'Ana' })).toBeNull();
        expect(readRomanceCard({ who: 'Ana', romance: { with: 'cualquiera' } })?.with).toEqual([]);
    });

    test('a quién deja cada palabra', () => {
        const card = (/** @type {any} */ w) => readRomanceCard({ who: 'Ana', romance: { with: w } });
        expect(allowsHero(card('todos'), tessa)).toBe(true);
        expect(allowsHero(card('todos'), {})).toBe(true);
        expect(allowsHero(card('mujeres'), tessa)).toBe(true);
        expect(allowsHero(card('mujeres'), bruno)).toBe(false);
        expect(allowsHero(card('hombres'), bruno)).toBe(true);
        expect(allowsHero(card('hombres'), tessa)).toBe(false);
        expect(allowsHero(card('hombres'), {})).toBe(false);
        expect(allowsHero(card(['mujeres', 'no-binario']), { gender: 'No binario (en masculino)' })).toBe(true);
        expect(allowsHero(card('nadie'), tessa)).toBe(false);
        expect(allowsHero(null, tessa)).toBe(false);
    });

    test('los del gremio: Nella y Osric, con cualquiera; Gerd, con nadie y su «no» escrito', () => {
        expect(nella.with).toEqual(['todos']);
        expect(osric.with).toEqual(['todos']);
        expect(gerd.with).toEqual([]);
        expect(gerd.no).toMatch(/Gerd/);
        for (const hero of [tessa, bruno, { gender: 'No binario (en femenino)' }]) {
            expect(canRomance(nella, data, hero)).toBe(true);
            expect(canRomance(osric, data, hero)).toBe(true);
            expect(canRomance(gerd, data, hero)).toBe(false);
        }
    });
});

describe('J14.10: los dos romances escritos', () => {
    for (const who of ['Nella Tresflechas', 'Osric Mediapaga']) {
        test(`${who}: su señal, tres citas con su corazón, la noche que funde a negro, frases y epílogo`, () => {
            expect(hasWrittenRomance(data, who)).toBe(true);
            const mine = data.scenes.filter(s => s.who === who);
            expect(mine.filter(s => s.stage === 'senal')).toHaveLength(1);
            expect(mine.filter(s => s.stage === 'cita').map(s => s.step).sort()).toEqual([1, 2, 3]);
            const lastOf = (/** @type {any} */ scene) => scene.beats[scene.beats.length - 1];
            expect(mine.every(s => s.beats.length >= 2)).toBe(true);
            // La decisión, en el último paso: con corazón, y (salvo la noche) también «como amigos».
            expect(mine.every(s => lastOf(s).replies.some((/** @type {any} */ r) => r.romance === 'avanza'))).toBe(true);
            expect(mine.filter(s => s.stage !== 'final').every(s => lastOf(s).replies.some((/** @type {any} */ r) => r.romance === 'amigos'))).toBe(true);
            // Y siempre una salida que ni avanza ni cierra.
            expect(mine.every(s => lastOf(s).replies.some((/** @type {any} */ r) => !r.romance))).toBe(true);
            const night = /** @type {any} */ (mine.find(s => s.stage === 'final'));
            expect(night.beats.flatMap((/** @type {any} */ b) => b.replies).filter((/** @type {any} */ r) => r.fade)).toHaveLength(1);
            expect(data.notes[mine[0].key].length).toBeGreaterThanOrEqual(3);
            expect(data.epilogues[mine[0].key]).toMatchObject({ home: expect.stringContaining('{ending}'), away: expect.stringContaining('{ending}'), hall: expect.stringContaining('{day}') });
        });
    }

    test('se leen a la primera, con las dos formas: sin llaves sueltas, para ella y para él', () => {
        const all = JSON.stringify(json('romances.json').rows);
        expect(leftoverMarkers(all)).toEqual([]);
        expect(all).not.toMatch(/localidad/i);
        for (const hero of [tessa, bruno]) {
            for (const scene of data.scenes) {
                const shown = JSON.stringify(renderScene(scene, { hero, party: [hero] }));
                expect(shown).not.toMatch(/\{[^}]*\|[^}]*\}/);
            }
        }
    });
});

describe('J14.10: la señal, las citas y la noche', () => {
    const base = { data, card: nella, name: 'Nella Tresflechas', hero: tessa, rank: ROMANCE_RANK, slot: 'afternoon' };

    test('la señal: a partir del vínculo 4, en un rato, con la respuesta del corazón', () => {
        expect(romanceScene({ ...base, state: null, rank: ROMANCE_RANK - 1 })).toBeNull();
        expect(romanceScene({ ...base, state: null, free: false })).toBeNull();
        const signal = /** @type {any} */ (romanceScene({ ...base, state: null }));
        expect(signal.stage).toBe('senal');
        expect(signal.allowed).toBe(true);
        expect(signal.scene.title).toBe('La última flecha');
        const hearts = signal.scene.beats.flatMap((/** @type {any} */ b) => b.replies).filter((/** @type {any} */ r) => r.text.startsWith(HEART));
        expect(hearts).toHaveLength(1);
        expect(hearts[0].romance).toBe('avanza');
    });

    test('apagado en las opciones, nada: ni la señal, ni las citas, ni «quiere quedar contigo»', () => {
        expect(romanceScene({ ...base, state: null, on: false })).toBeNull();
        const dating = advanceRomance(null, { name: 'Nella Tresflechas', stage: 'senal', choice: 'avanza' }).state;
        expect(romanceScene({ ...base, state: dating, on: false })).toBeNull();
        expect(romanceWants({ card: nella, state: dating, name: 'Nella Tresflechas', on: false })).toBeNull();
        expect(romanceWants({ card: nella, state: dating, name: 'Nella Tresflechas', on: true })?.wants).toBe(true);
    });

    test('quien no lo permite contesta lo suyo, con cariño, y no vuelve a salir', () => {
        const signal = /** @type {any} */ (romanceScene({ ...base, card: gerd, name: 'Gerd el Mellado', state: null }));
        expect(signal.allowed).toBe(false);
        const heart = signal.scene.beats.flatMap((/** @type {any} */ b) => b.replies).find((/** @type {any} */ r) => r.text.startsWith(HEART));
        expect(heart.then).toBe(gerd.no);
        const after = advanceRomance(null, { name: 'Gerd el Mellado', stage: 'senal', choice: 'avanza', allowed: false });
        expect(romanceOf(after.state, 'Gerd el Mellado')?.status).toBe('no');
        expect(after.news[0]).toMatch(/no, con cariño/);
        expect(romanceScene({ ...base, card: gerd, name: 'Gerd el Mellado', state: after.state })).toBeNull();
    });

    test('quien no tiene ficha no tiene pregunta', () => {
        expect(romanceScene({ ...base, card: null, name: 'Tomás', state: null })).toBeNull();
    });

    test('solo avanza con el corazón: lo demás deja la cita para otro día', () => {
        let state = advanceRomance(null, { name: 'Nella Tresflechas', stage: 'senal', choice: 'avanza', day: 4 }).state;
        const date = /** @type {any} */ (romanceScene({ ...base, state }));
        expect(date.stage).toBe('cita');
        expect(romanceChoice(date.scene, playCold(date.scene))).toBe('');
        const same = advanceRomance(state, { name: 'Nella Tresflechas', stage: 'cita', choice: romanceChoice(date.scene, playCold(date.scene)) });
        expect(same.changed).toBe(false);
        state = advanceRomance(state, { name: 'Nella Tresflechas', stage: 'cita', choice: romanceChoice(date.scene, playHeart(date.scene)) }).state;
        expect(romanceOf(state, 'Nella')?.step).toBe(1);
    });

    test('la señal que se deja pasar vuelve a los pocos días', () => {
        const signal = /** @type {any} */ (romanceScene({ ...base, state: null, day: 5 }));
        const passed = advanceRomance(null, { name: 'Nella Tresflechas', stage: 'senal', choice: romanceChoice(signal.scene, playCold(signal.scene)), day: 5 });
        expect(passed.changed).toBe(true);
        expect(stageOf(romanceOf(passed.state, 'Nella Tresflechas'), 6)).toBe('espera');
        expect(romanceScene({ ...base, state: passed.state, day: 6 })).toBeNull();
        expect(stageOf(romanceOf(passed.state, 'Nella Tresflechas'), 5 + SIGNAL_REST)).toBe('senal');
        expect(romanceScene({ ...base, state: passed.state, day: 5 + SIGNAL_REST })?.stage).toBe('senal');
        const yes = advanceRomance(passed.state, { name: 'Nella Tresflechas', stage: 'senal', choice: 'avanza', day: 9 });
        expect(romanceOf(yes.state, 'Nella Tresflechas')?.status).toBe('citas');
    });

    test('«como amigos» lo cierra para siempre', () => {
        const state = advanceRomance(null, { name: 'Osric Mediapaga', stage: 'senal', choice: 'amigos' }).state;
        expect(stageOf(romanceOf(state, 'Osric Mediapaga'), 99)).toBe('cerrado');
        expect(romanceScene({ ...base, card: osric, name: 'Osric Mediapaga', state })).toBeNull();
        expect(romanceLabel(romanceOf(state, 'Osric Mediapaga'))).toBe('');
    });

    test('las citas pasan delante de una escena suya pendiente; la noche, solo de noche', () => {
        let state = advanceRomance(null, { name: 'Nella Tresflechas', stage: 'senal', choice: 'avanza' }).state;
        expect(romanceScene({ ...base, state, free: false })?.stage).toBe('cita');
        for (let step = 1; step <= DATES; step++) state = advanceRomance(state, { name: 'Nella Tresflechas', stage: 'cita', choice: 'avanza' }).state;
        expect(stageOf(romanceOf(state, 'Nella'))).toBe('final');
        expect(romanceScene({ ...base, state, slot: 'afternoon' })).toBeNull();
        expect(romanceWants({ card: nella, state, name: 'Nella', slot: 'afternoon' })).toBeNull();
        expect(romanceWants({ card: nella, state, name: 'Nella', slot: 'night' })?.why).toMatch(/esta noche/);
        expect(romanceScene({ ...base, state, slot: 'night' })?.stage).toBe('final');
    });

    test('de la señal a pareja, entero, para Osric con un héroe', () => {
        const who = { ...base, card: osric, name: 'Osric Mediapaga', hero: bruno };
        let state = createRomanceState();
        /** @type {string[]} */
        const news = [];
        /** @type {string[]} */
        const stages = [];
        /** @type {boolean[]} */
        const couple = [];
        for (const slot of ['morning', 'morning', 'afternoon', 'night', 'night']) {
            const scene = /** @type {any} */ (romanceScene({ ...who, state, slot }));
            stages.push(scene.stage);
            const result = advanceRomance(state, { name: 'Osric Mediapaga', short: 'Osric', stage: scene.stage, choice: romanceChoice(scene.scene, playHeart(scene.scene)), allowed: scene.allowed, day: 10 });
            state = result.state;
            news.push(...result.news);
            couple.push(result.couple);
        }
        expect(stages).toEqual(['senal', 'cita', 'cita', 'cita', 'final']);
        expect(couple).toEqual([false, false, false, false, true]);
        expect(isCouple(state, 'Osric Mediapaga')).toBe(true);
        expect(couplesOf(state)).toEqual(['Osric Mediapaga']);
        expect(romanceLabel(romanceOf(state, 'Osric'))).toBe('Pareja');
        expect(news.join(' ')).toMatch(/empezáis algo.*van 1 de 3.*van 2 de 3.*Tercera cita.*sois pareja/);
        // Ya no hay escena que sustituir: el rato lleva una frase suya.
        expect(romanceScene({ ...who, state, slot: 'night' })).toBeNull();
        expect(coupleNote(data, 'Osric Mediapaga', 1)).toMatch(/Osric/);
        const rato = { beats: [{ note: 'Pasas la tarde con Osric.', say: '', replies: [] }] };
        expect(withCoupleNote(rato, 'Te roza la mano.').beats[0].note).toBe('Pasas la tarde con Osric. Te roza la mano.');
    });

    test('lo guardado: con forma aunque llegue roto, y viaja con el grupo (lo de quien llega manda)', () => {
        expect(readRomanceState({ people: { x: { status: 'raro' }, nella: { status: 'citas', step: 9 } } }).people)
            .toEqual({ nella: { name: 'nella', status: 'citas', step: DATES, since: 0 } });
        const here = advanceRomance(null, { name: 'Nella Tresflechas', stage: 'senal', choice: 'avanza' }).state;
        const there = advanceRomance(null, { name: 'Osric Mediapaga', stage: 'senal', choice: 'amigos' }).state;
        expect(Object.keys(mergeRomance(here, there).people).sort()).toEqual(['nella-tresflechas', 'osric-mediapaga']);
    });
});

describe('J14.10: el epílogo y el Salón de la fama', () => {
    const nellaCard = { name: 'Nella Tresflechas', gender: 'Mujer' };

    test('al final de una campaña, la línea de la pareja, con el final y concordando', () => {
        expect(coupleEpilogue({ data, name: 'Nella Tresflechas', hero: tessa, partner: nellaCard, ending: 'Barovia, libre', home: true }))
            .toMatch(/^Nella Tresflechas vuelve contigo al gremio\. Después de «Barovia, libre»/);
        expect(coupleEpilogue({ data, name: 'Nella Tresflechas', hero: tessa, partner: nellaCard, ending: 'Barovia, libre' })).toMatch(/se quedó contigo después de «Barovia, libre»/);
        // Sin línea escrita, la común: «juntas» solo si las dos son mujeres.
        expect(coupleEpilogue({ data: { scenes: [], notes: {}, epilogues: {} }, name: 'Ana', hero: tessa, partner: { gender: 'Mujer' }, ending: 'X' })).toMatch(/juntas/);
        expect(coupleEpilogue({ data: { scenes: [], notes: {}, epilogues: {} }, name: 'Ana', hero: bruno, partner: { gender: 'Mujer' }, ending: 'X' })).toMatch(/juntos/);
    });

    test('la entrada del salón: los dos nombres y su línea; una vez por partida', () => {
        const entry = coupleHallEntry({ data, name: 'Nella Tresflechas', hero: tessa, partner: nellaCard, world: 'Gremio', day: 9, when: '2026-10-01T10:00:00Z' });
        expect(entry).toMatchObject({ kind: 'couple', name: 'Tessa y Nella Tresflechas', day: 9 });
        expect(entry.epitaph).toBe('Tessa y Nella Tresflechas, juntas desde el día 9. En la posada de Puerto Alba hay una ventana que da al mar, y es de las dos.');
        const withBruno = coupleHallEntry({ data, name: 'Nella Tresflechas', hero: bruno, partner: nellaCard, world: 'Gremio', day: 9, when: '' });
        expect(withBruno.epitaph).toMatch(/juntos desde el día 9.*de los dos\.$/);
        let hall = addToHall([], entry);
        hall = addToHall(hall, { ...entry, day: 12 });
        expect(readHall(hall)).toHaveLength(1);
        expect(readHall(hall)[0].kind).toBe('couple');
        expect(describeHallEntry(readHall(hall)[0])).toMatch(/^♥ Tessa y Nella Tresflechas, juntas/);
        const fallen = { name: 'Gerd', world: 'Gremio', day: 3, epitaph: 'Aquí cayó Gerd.', when: '' };
        expect(describeHallCount(addToHall(hall, fallen))).toBe('1 caído · 1 pareja');
    });
});

describe('J14.10: la opción «Romance»', () => {
    test('encendida de salida; solo `off` la apaga', () => {
        expect(readRomanceOption(null)).toBe(true);
        expect(readRomanceOption('on')).toBe(true);
        expect(readRomanceOption('off')).toBe(false);
        expect(romanceOptionRow(true)).toMatchObject({ id: 'romance', label: 'Romance', value: 'Sí' });
        expect(romanceOptionRow(false).value).toBe('No');
    });

    test('en la ventana, detrás de los sucesos (y una vez)', () => {
        const rows = [{ id: 'narrator' }, { id: 'sucesos' }, { id: 'size' }];
        const row = { id: 'romance' };
        expect(withRomanceRow(rows, row).map(r => r.id)).toEqual(['narrator', 'sucesos', 'romance', 'size']);
        expect(withRomanceRow([...rows, row], row).filter(r => r.id === 'romance')).toHaveLength(1);
        expect(withRomanceRow([{ id: 'size' }], row).map(r => r.id)).toEqual(['size', 'romance']);
    });
});
