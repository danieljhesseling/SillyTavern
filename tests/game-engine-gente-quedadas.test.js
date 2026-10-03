/**
 * J14.3, J14.5 y J14.6: quedar con alguien (`meetups.js`), las escenas de confidente de cada
 * campaña pasadas a jugables, y su contenido (`compendio/quedadas.json`).
 */
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import {
    FACES, UNLOCK_TYPES, readScene, readMeetupRows, personOf, sentencesOf, beatsFromProse, scenesFor, convertPackConfidants,
    nextScene, wantsToMeet, ratoScene, meetupFor, renderScene, startScene, sceneStep, sceneView, sceneOutcome,
    unlocksAt, unlocksBetween, unlockedFor, applyMeetup, recordMeetup, meetupSummary, bondDiscounts, personalQuestsOpen,
} from '../public/scripts/game-engine/campaign/meetups.js';
import { readTalkRows } from '../public/scripts/game-engine/campaign/small-talk.js';
import { createSocial, bondKeyOf } from '../public/scripts/game-engine/campaign/social.js';
import { BOND_PERKS, CONTROL_RANK, canPlayerControl, createBondState, getRank, recordBondEvent } from '../public/scripts/game-engine/campaign/bonds.js';
import { favorDiscount } from '../public/scripts/game-engine/campaign/companion-arcs.js';
import { HIRELINGS } from '../public/scripts/game-engine/campaign/guests.js';
import { validateBattery, DOMAINS } from '../public/scripts/game-engine/compendio/compendio.js';
import { PLACE_KINDS } from '../public/scripts/game-engine/campaign/town.js';

const read = (/** @type {string} */ path) => JSON.parse(readFileSync(new URL(`../public/${path}`, import.meta.url), 'utf8'));
const file = read('compendio/quedadas.json');
const data = readMeetupRows(file);
const talkRows = readTalkRows(read('compendio/charlas.json'));
const packs = { strahd: read('mundos/strahd.pack.json'), 1387: read('mundos/1387.pack.json'), gremio: read('mundos/gremio.pack.json') };

const HERO_F = { name: 'Tessa', gender: 'Mujer' };
const HERO_M = { name: 'Bruno', gender: 'Hombre' };
const GERD = { id: 2, name: 'Gerd el Mellado', wants: 'coin' };

/**
 * Jugar una escena entera eligiendo con `choose` en cada paso con respuestas.
 *
 * @param {any} scene
 * @param {(replies: any[]) => number} choose
 */
function play(scene, choose) {
    let state = startScene();
    /** @type {any[]} */
    const views = [];
    for (let guard = 0; guard < 20 && !state.done; guard++) {
        const view = sceneView(scene, state);
        views.push(view);
        if (view.next === 'reply') {
            const beat = scene.beats[state.beat];
            state = sceneStep(scene, state, { reply: choose(beat.replies) });
        } else state = sceneStep(scene, state, { next: true });
    }
    return { state, views };
}

/** La respuesta neutra si la hay; si no, la primera. */
const neutral = (/** @type {any[]} */ replies) => Math.max(0, replies.findIndex(r => r.bond === 0));
/** La que más acerca. */
const best = (/** @type {any[]} */ replies) => replies.findIndex(r => r.bond === Math.max(...replies.map(x => x.bond)));

describe('el contenido: compendio/quedadas.json', () => {
    test('es una batería del compendio que se carga sin errores, con gente, escenas y rangos', () => {
        expect(DOMAINS).toContain('quedadas');
        expect(validateBattery('quedadas', file)).toEqual([]);
        expect(data.people.length).toBe(18);
        expect(data.unlocks.length).toBe(22);
        expect(data.scenes.length).toBe(file.rows.filter((/** @type {any} */ r) => r.kind === 'escena').length);
    });

    test('los tres mercenarios tienen escenas de al menos tres rangos, y cada rango abre algo', () => {
        for (const { name } of HIRELINGS) {
            const ranks = scenesFor({ person: { name }, data }).map(s => s.rank);
            expect([name, ranks]).toEqual([name, [1, 2, 3, 4]]);
            for (const rank of [2, 3, 4]) expect([name, rank, unlocksAt(data, name, rank).length > 0]).toEqual([name, rank, true]);
            expect(unlocksAt(data, name, 2).map(u => u.type)).toEqual(['descuento']);
            expect(unlocksAt(data, name, 3).map(u => u.type)).toEqual(['apoyo']);
            expect(unlocksAt(data, name, 4).map(u => u.type)).toEqual(['mision']);
            expect(unlocksAt(data, name, 5).map(u => u.type)).toEqual(['control', 'apoyo']);
        }
    });

    test('J7.3: el rango 5 («amigo») abre «Lo muevo yo» a todos, mercenarios incluidos, una vez y dicho como suyo', () => {
        const everyone = [...HIRELINGS.map(h => h.name), ...packs.strahd.confidants.map((/** @type {any} */ c) => c.name), ...packs[1387].confidants.map((/** @type {any} */ c) => c.name)];
        for (const name of everyone) {
            const control = unlocksAt(data, name, CONTROL_RANK).filter(u => u.type === 'control');
            expect([name, control.length, control[0]?.label]).toEqual([name, 1, 'Lo muevo yo']);
            expect(control[0].id).toMatch(/^rango-/);
        }
        expect(unlocksAt(data, 'Nella Tresflechas', 5)[0].describe).toBe('Nella ya es tu amiga: en combate puedes moverla tú. Si prefieres, se lo vuelves a dejar al juego.');
        // Quien no tiene nada escrito (un compañero de una campaña nueva) lo abre igual.
        expect(unlocksAt(data, 'Fulano', 5).map(u => [u.id, u.type])).toEqual([['vinculo-control', 'control'], ['vinculo-baton_pass', 'apoyo']]);
        expect(unlocksAt(data, 'Fulano', 5)[0].describe).toContain('mover tú a Fulano');
        expect(unlocksAt(data, 'Fulano', 4).some(u => u.type === 'control')).toBe(false);
    });

    test('J7.3: quién llevas tú en combate: tu héroe siempre; un compañero, desde «amigo»; una invocación, la de quien la lanza', () => {
        const hero = { id: 1, name: 'Tessa' };
        const gerd = { id: 2, name: 'Gerd el Mellado' };
        const nella = { id: 3, name: 'Nella Tresflechas' };
        const party = [hero, gerd, nella];
        let bonds = createBondState();
        for (let i = 0; i < 12; i++) bonds = recordBondEvent(bonds, '2', 'quest_together').state;
        for (let i = 0; i < 5; i++) bonds = recordBondEvent(bonds, '3', 'quest_together').state;
        expect([getRank(bonds, '2'), getRank(bonds, '3')]).toEqual([6, 4]);
        expect(canPlayerControl(hero, bonds, { party })).toBe(true);
        expect(canPlayerControl(hero, null, { party })).toBe(true);
        expect(canPlayerControl(gerd, bonds, { party })).toBe(true);
        expect(canPlayerControl(nella, bonds, { party })).toBe(false);
        expect(canPlayerControl({ ...nella, isHero: true }, bonds)).toBe(true);
        // Las invocaciones: del héroe, tuyas; de quien aún no es tu amigo, del juego; si el conjuro dice que va sola, sola.
        expect(canPlayerControl({ id: 'inv-lobo-1-3-1', casterId: '1', control: 'player' }, bonds, { party })).toBe(true);
        expect(canPlayerControl({ id: 'inv-lobo-3-3-1', casterId: '3', control: 'player' }, bonds, { party })).toBe(false);
        expect(canPlayerControl({ id: 'inv-lobo-2-3-1', casterId: '2' }, bonds, { party })).toBe(true);
        expect(canPlayerControl({ id: 'inv-x', casterId: '1', control: 'engine' }, bonds, { party })).toBe(false);
        expect(canPlayerControl({ id: 'inv-y', casterId: '99' }, bonds, { party })).toBe(true);
        expect(canPlayerControl(null, bonds, { party })).toBe(false);
        expect(CONTROL_RANK).toBe(5);
    });

    test('cada escena se juega: de dos a cuatro pasos, dos o tres respuestas con alguna que acerca', () => {
        for (const scene of data.scenes) {
            expect(scene.beats.length).toBeGreaterThanOrEqual(2);
            expect(scene.beats.length).toBeLessThanOrEqual(4);
            const asking = scene.beats.filter(b => b.replies.length > 0);
            expect([scene.id, asking.length > 0]).toEqual([scene.id, true]);
            for (const beat of asking) {
                expect(beat.replies.length).toBeGreaterThanOrEqual(2);
                expect(beat.replies.length).toBeLessThanOrEqual(3);
                expect([scene.id, beat.replies.some(r => r.bond === 1)]).toEqual([scene.id, true]);
                for (const reply of beat.replies) expect([-1, 0, 1]).toContain(reply.bond);
            }
            for (const beat of scene.beats) {
                expect(['', ...FACES]).toContain(beat.mood);
                for (const reply of beat.replies) expect(['', ...FACES]).toContain(reply.mood);
            }
        }
    });

    test('quien sale existe, y donde se queda es un sitio del pueblo', () => {
        const known = new Set([
            ...HIRELINGS.map(h => h.name),
            ...packs.gremio.npcs.map((/** @type {any} */ n) => n.name),
            ...packs.strahd.confidants.map((/** @type {any} */ c) => c.name),
            ...packs[1387].confidants.map((/** @type {any} */ c) => c.name),
        ]);
        const places = new Set([...Object.keys(PLACE_KINDS), 'camino']);
        expect(data.scenes.filter(s => !known.has(s.who)).map(s => s.id)).toEqual([]);
        expect(data.scenes.filter(s => s.where && !places.has(s.where)).map(s => s.id)).toEqual([]);
        expect(data.people.filter(p => !known.has(p.who)).map(p => p.who)).toEqual([]);
        expect(data.people.filter(p => [...Object.values(p.places), ...p.likes].some(place => !(place in PLACE_KINDS))).map(p => p.who)).toEqual([]);
        const perks = BOND_PERKS.map(p => p.id);
        expect(data.unlocks.filter(u => !UNLOCK_TYPES.includes(u.type) || (u.perk && !perks.includes(u.perk))).map(u => u.id)).toEqual([]);
        expect(data.unlocks.filter(u => u.type === 'descuento').map(u => u.on).sort()).toEqual(['herreria', 'posada', 'tienda']);
        expect(data.unlocks.filter(u => u.type === 'mision').map(u => u.quest.endings.length)).toEqual([2, 2, 2]);
    });

    test('J14.6: cada confidente de Strahd y de 1387 tiene su pueblo, una localización de su campaña; los del gremio, Puerto Alba', () => {
        for (const campaign of /** @type {const} */ (['strahd', '1387'])) {
            const places = new Set(packs[campaign].locations.map((/** @type {any} */ l) => l.name));
            for (const c of packs[campaign].confidants) {
                const person = personOf(data, c.name);
                expect([c.name, person?.campaign]).toEqual([c.name, campaign]);
                expect([c.name, places.has(String(person?.home))]).toEqual([c.name, true]);
            }
        }
        for (const { name } of HIRELINGS) expect(personOf(data, name)?.home).toBe('Puerto Alba');
        for (const npc of packs.gremio.npcs) expect(personOf(data, npc.name)?.home).toBe('Puerto Alba');
    });

    test('ninguna escena se lee con llaves, sea tu héroe quien sea', () => {
        for (const hero of [HERO_F, HERO_M, { name: 'Ari', gender: 'No binario' }]) {
            for (const scene of data.scenes) {
                const texts = renderScene(scene, { hero, party: [hero] }).beats.flatMap(b => [b.note, b.say, ...b.replies.flatMap(r => [r.text, r.then])]).join(' ');
                expect([scene.id, texts.match(/[{}|]/)?.[0] ?? '']).toEqual([scene.id, '']);
            }
        }
    });

    test('concuerda con tu héroe: van Richten te pregunta si estás {dispuesto|dispuesta}', () => {
        const scene = data.scenes.find(s => s.id === 'strahd-vanrichten-10');
        const text = (/** @type {any} */ hero) => JSON.stringify(renderScene(scene, { hero }));
        expect(text(HERO_F)).toContain('dispuesta');
        expect(text(HERO_M)).toContain('dispuesto');
    });
});

describe('J14.5: las escenas de confidente, jugadas', () => {
    test('cada escena de cada confidente de Strahd y de 1387 está pasada a pasos, con su rango y su título', () => {
        for (const campaign of /** @type {const} */ (['strahd', '1387'])) {
            const converted = convertPackConfidants({ pack: packs[campaign], campaign, data });
            expect(converted).toHaveLength(25);
            expect(converted.filter(s => s.auto).map(s => s.id)).toEqual([]);
            for (const c of packs[campaign].confidants) {
                for (const written of c.scenes) {
                    const scene = converted.find(s => s.who === c.name && s.rank === written.rank);
                    expect([c.name, written.rank, scene?.title]).toEqual([c.name, written.rank, written.title]);
                }
            }
        }
    });

    test('la escena de rango 2 de un confidente de Strahd, jugada entera', () => {
        const ismark = packs.strahd.confidants.find((/** @type {any} */ c) => c.name === 'Ismark Kolyanovich');
        // Como llega al juego: la ficha del confidente trae sus escenas en `bondScenes` (el importador).
        const scenes = scenesFor({ person: { name: ismark.name, bondScenes: ismark.scenes }, data, campaign: 'strahd' });
        const scene = renderScene(nextScene({ scenes, rank: 2, seen: [] }), { hero: HERO_F });
        expect(scene?.id).toBe('strahd-ismark-2');
        expect(scene?.title).toBe('El Menor');
        const { state, views } = play(scene, best);
        expect(state.done).toBe(true);
        expect(views.length).toBeGreaterThanOrEqual(scene.beats.length);
        for (const view of views) expect(`${view.note}${view.say}`.length).toBeGreaterThan(0);
        expect(views.at(-1)?.next).toBe('finish');
        const answered = views.filter(v => v.answer);
        expect(answered.length).toBe(scene.beats.filter((/** @type {any} */ b) => b.replies.length > 0).length);
        const outcome = sceneOutcome({ scene, choices: state.choices });
        // D-J63: la quedada tiene sus propios eventos de vínculo (su escena, o un rato).
        expect(outcome.events[0]).toBe('meetup_scene');
        expect(outcome.liked).toBe(answered.length);
        expect(outcome.points).toBeGreaterThan(3);
    });

    test('una campaña nueva sin escenas pasadas: se pasan solas de la prosa, jugables', () => {
        const person = { name: 'Nadie', scenes: [{ rank: 2, title: 'La noche', scene: 'Te sientas junto al fuego. Nadie te mira un buen rato. Te pregunta si volverías a hacerlo.' }] };
        const [scene] = scenesFor({ person, data, campaign: 'otra' });
        expect(scene.auto).toBe(true);
        expect(scene.id).toBe('otra-nadie-2');
        expect(scene.beats).toHaveLength(2);
        expect(scene.beats[0].note).toBe('Te sientas junto al fuego. Nadie te mira un buen rato.');
        expect(scene.beats[1].replies.map(r => r.bond)).toEqual([1, 0, -1]);
        const { state } = play(scene, () => 0);
        expect(state.done).toBe(true);
    });

    test('las frases de un párrafo, y la escena sin pregunta ofrece quedarse o dejarlo', () => {
        expect(sentencesOf('Hola. «Adiós», dice él. ¿Vienes? ¡Vamos!')).toEqual(['Hola.', '«Adiós», dice él.', '¿Vienes?', '¡Vamos!']);
        const quiet = beatsFromProse('Ella sonríe.');
        expect(quiet).toHaveLength(1);
        expect(quiet[0].replies.map(r => r.bond)).toEqual([1, 0]);
        expect(beatsFromProse('')).toEqual([]);
    });
});

describe('J14.3: qué escena sale', () => {
    test('la siguiente de su rango que no se ha jugado', () => {
        const scenes = scenesFor({ person: { name: 'Gerd el Mellado' }, data });
        expect(nextScene({ scenes, rank: 1 })?.id).toBe('gremio-gerd-1');
        expect(nextScene({ scenes, rank: 1, seen: ['gremio-gerd-1'] })).toBeNull();
        expect(nextScene({ scenes, rank: 3, seen: ['gremio-gerd-1'] })?.id).toBe('gremio-gerd-2');
        expect(nextScene({ scenes, rank: 10, seen: scenes.map(s => s.id) })).toBeNull();
    });

    test('quien tiene una escena por jugar quiere quedar contigo (el icono de J14.4)', () => {
        const ismark = { name: 'Ismark Kolyanovich', bondScenes: packs.strahd.confidants[0].scenes };
        expect(wantsToMeet({ person: ismark, rank: 1, data, social: null, campaign: 'strahd' }).wants).toBe(false);
        const eager = wantsToMeet({ person: ismark, rank: 2, data, social: null, campaign: 'strahd' });
        expect(eager).toMatchObject({ wants: true, why: 'Ismark Kolyanovich quiere contarte algo.' });
        expect(eager.scene?.id).toBe('strahd-ismark-2');
        const seen = { ...createSocial(), seen: { 'ismark-kolyanovich': ['strahd-ismark-2'] } };
        expect(wantsToMeet({ person: ismark, rank: 3, data, social: seen, campaign: 'strahd' }).wants).toBe(false);
    });

    test('sin escena a su rango, un rato juntos: una de sus charlas del pueblo, en el sitio elegido', () => {
        const social = { ...createSocial(), seen: { 'gerd-el-mellado': ['gremio-gerd-1'] } };
        const { scene, social: after } = meetupFor({ person: GERD, rank: 1, data, talkRows, social, random: () => 0, place: 'muelle', slot: 'morning', hero: HERO_F });
        expect(scene.kind).toBe('rato');
        expect(scene.beats).toHaveLength(1);
        expect(scene.beats[0].note).toBe('Pasas la mañana con Gerd el Mellado en el muelle.');
        expect(scene.beats[0].replies).toHaveLength(3);
        expect(after.heard).toHaveLength(1);
        // Sin charlas, un rato sin palabras escritas, que también se juega.
        const bare = ratoScene({ person: { name: 'Nadie' }, talkRows: [], social: null, random: () => 0 });
        expect(bare.scene.beats[0].note).toBe('Pasas un rato con Nadie.');
        expect(bare.scene.beats[0].replies.map(r => r.bond)).toEqual([1, 0]);
    });

    test('las escenas escritas leen con tolerancia, y sin pasos no hay escena', () => {
        expect(readScene({ who: 'X', beats: [] })).toBeNull();
        expect(readScene({ who: '', beats: [{ say: 'a' }] })).toBeNull();
        const scene = readScene({ who: 'X', rank: 99, beats: [{ say: 'a', mood: 'loco', replies: [{ text: 'b', bond: 5, gold: 3 }, { text: '' }] }] });
        expect(scene).toMatchObject({ id: 'x-10', kind: 'escena', rank: 10 });
        expect(scene?.beats[0]).toEqual({ note: '', say: 'a', mood: '', replies: [{ text: 'b', bond: 1, then: '', mood: '', gold: 0 }] });
    });
});

describe('cómo se juega un paso', () => {
    const scene = /** @type {any} */ (readScene({
        who: 'X', beats: [
            { say: 'Uno', replies: [{ text: 'a', bond: 1, then: 'bien', mood: 'alegre' }, { text: 'b', bond: -1, gold: -2 }] },
            { note: 'Dos' },
        ],
    }));

    test('hay que contestar para seguir; contestado, se ve tu respuesta y la suya', () => {
        let state = startScene();
        let view = sceneView(scene, state);
        expect(view).toMatchObject({ step: 1, steps: 2, say: 'Uno', next: 'reply', answer: null });
        expect(view.replies).toEqual([{ index: 0, text: 'a', gold: 0 }, { index: 1, text: 'b', gold: -2 }]);
        expect(sceneStep(scene, state, { next: true })).toBe(state);
        state = sceneStep(scene, state, { reply: 0 });
        view = sceneView(scene, state);
        expect(view).toMatchObject({ answer: { text: 'a', then: 'bien', gold: 0 }, face: 'alegre', next: 'continue', replies: [] });
        expect(sceneStep(scene, state, { reply: 1 })).toBe(state);
        state = sceneStep(scene, state, { next: true });
        expect(sceneView(scene, state)).toMatchObject({ step: 2, note: 'Dos', next: 'finish' });
        state = sceneStep(scene, state, { next: true });
        expect(state.done).toBe(true);
        expect(state.choices).toEqual([{ beat: 0, reply: 0 }]);
        expect(sceneView(scene, state).next).toBe('done');
    });

    test('lo que deja: sus eventos de vínculo, los puntos y el oro', () => {
        // D-J63: su escena vale 8 y un rato 6 (`meetup_scene`, `meetup_rato`); cada respuesta, uno arriba o abajo.
        expect(sceneOutcome({ scene, choices: [{ beat: 0, reply: 0 }] })).toEqual({ events: ['meetup_scene', 'approved'], points: 9, gold: 0, liked: 1, disliked: 0, fitted: 0 });
        expect(sceneOutcome({ scene, choices: [{ beat: 0, reply: 1 }], likedPlace: true })).toEqual({
            events: ['meetup_scene', 'disapproved', 'approved'], points: 8, gold: -2, liked: 0, disliked: 1, fitted: 0,
        });
        expect(sceneOutcome({ scene: { ...scene, kind: 'rato' }, choices: [] }).events).toEqual(['meetup_rato']);
        expect(sceneOutcome({ scene: { ...scene, kind: 'charla' }, choices: [{ beat: 0, reply: 0 }] }).events).toEqual(['approved']);
    });
});

describe('quedar tres veces con Gerd y subir un rango; se ve lo que abre', () => {
    /**
     * Quedar `times` veces con Gerd, en la plaza, contestando con `choose`.
     *
     * @param {number} times
     * @param {(replies: any[]) => number} choose
     */
    function meetGerd(times, choose) {
        let bonds = createBondState();
        let social = createSocial();
        const key = bondKeyOf(GERD);
        /** @type {any[]} */
        const results = [];
        for (let i = 0; i < times; i++) {
            const picked = meetupFor({ person: GERD, rank: getRank(bonds, key), data, talkRows, social, random: () => 0.4, place: 'plaza', slot: 'afternoon', hero: HERO_F });
            const scene = renderScene(picked.scene, { hero: HERO_F });
            const { state } = play(scene, choose);
            const outcome = sceneOutcome({ scene, choices: state.choices, likedPlace: false });
            const result = applyMeetup({ bonds, bondKey: key, outcome, data, name: GERD.name });
            social = recordMeetup(picked.social, { name: GERD.name, scene, elapsed: i, unlocks: result.unlocks });
            bonds = result.bonds;
            results.push({ scene, outcome, result, summary: meetupSummary({ name: GERD.name, result, outcome }) });
        }
        return { results, social, bonds, key };
    }

    test('contestando sin mojarse: al principio, como en Persona, cada quedada es su escena y sube un rango (D-J63)', () => {
        const { results, social, bonds, key } = meetGerd(3, neutral);
        expect(results.map(r => r.scene.kind)).toEqual(['escena', 'escena', 'escena']);
        expect(results.map(r => r.result.rankedUp)).toEqual([true, true, true]);
        expect(getRank(bonds, key)).toBe(4);
        const opened = results[0].result.unlocks;
        expect(opened.map((/** @type {any} */ u) => u.label)).toEqual(['Amigo de Ramiro']);
        // El momento, claro, lo primero: «Rango 2 con Gerd».
        expect(results[0].summary).toEqual([
            'Rango 2 con Gerd',
            'Te acercas a Gerd el Mellado (+8 de vínculo).',
            'Se abre: Amigo de Ramiro. Ramiro le debe a Gerd más de un favor de la guerra: la herrería os cobra un 10 % menos.',
        ]);
        expect(social.seen['gerd-el-mellado']).toEqual(['gremio-gerd-1', 'gremio-gerd-2', 'gremio-gerd-3']);
        expect(social.opened['gerd-el-mellado']).toEqual(['rango-gerd-2', 'rango-gerd-3', 'rango-gerd-4']);
        expect(social.met['gerd-el-mellado']).toBe(2);
        // Y la siguiente quedada es ya la escena de rango 4.
        expect(meetupFor({ person: GERD, rank: 4, data, talkRows, social, random: () => 0 }).scene.id).toBe('gremio-gerd-4');
    });

    test('contestando lo que le gusta, se acerca más; contestando lo que no, menos', () => {
        const worst = (/** @type {any[]} */ replies) => replies.findIndex(r => r.bond === Math.min(...replies.map(x => x.bond)));
        const pointsOf = (/** @type {(replies: any[]) => number} */ choose) => {
            const run = meetGerd(3, choose);
            return run.bonds.bonds[run.key].points;
        };
        expect(pointsOf(best)).toBeGreaterThan(pointsOf(neutral));
        expect(pointsOf(neutral)).toBeGreaterThan(pointsOf(worst));
        expect(getRank(meetGerd(3, best).bonds, bondKeyOf(GERD))).toBeGreaterThan(getRank(meetGerd(3, worst).bonds, bondKeyOf(GERD)));
    });

    test('lo que abre cada rango: el descuento cuenta con los favores de siempre, y la misión trae sus dos finales', () => {
        const discounts = bondDiscounts(data, [{ name: 'Gerd el Mellado', rank: 2 }, { name: 'Nella Tresflechas', rank: 1 }]);
        expect(discounts).toEqual([{ name: 'Gerd el Mellado', kind: 'herreria', favor: expect.any(String), discount: 0.1, on: 'herreria' }]);
        expect(favorDiscount(discounts, 'herreria')).toEqual({ discount: 0.1, who: 'Gerd el Mellado' });
        expect(favorDiscount(bondDiscounts(data, [{ name: 'Nella Tresflechas', rank: 2 }]), 'tienda').discount).toBe(0.1);
        const quests = personalQuestsOpen(data, [{ name: 'Gerd el Mellado', rank: 4 }, { name: 'Osric Mediapaga', rank: 3 }]);
        expect(quests.map(q => q.quest.id)).toEqual(['gerd-robledo']);
        expect(quests[0].quest.endings.map((/** @type {any} */ e) => e.id)).toEqual(['pagar', 'plantar-cara']);
    });

    test('su ayuda en combate es una de las ventajas de vínculo de siempre, dicha como suya y una vez', () => {
        const three = unlocksAt(data, 'Gerd el Mellado', 3);
        expect(three).toEqual([expect.objectContaining({ type: 'apoyo', perk: 'follow_up', label: 'Detrás de ti' })]);
        // Quien no tiene nada escrito abre las de siempre.
        expect(unlocksAt(data, 'Ismark Kolyanovich', 3)).toEqual([expect.objectContaining({ id: 'vinculo-follow_up', label: 'Ataque de seguimiento' })]);
        expect(unlocksAt(data, 'Ismark Kolyanovich', 4)).toEqual([]);
        expect(unlocksBetween(data, 'Gerd el Mellado', 1, 5).map(u => u.id)).toEqual(['rango-gerd-2', 'rango-gerd-3', 'rango-gerd-4', 'rango-gerd-5', 'vinculo-baton_pass']);
        expect(unlockedFor(data, 'Gerd el Mellado', 1)).toEqual([]);
    });

    test('lo que se cuenta cuando aleja, o cuando cuesta oro', () => {
        const result = /** @type {any} */ ({ points: -1, rankedUp: false, rankAfter: 1, unlocks: [] });
        expect(meetupSummary({ name: 'Isolda', result, outcome: /** @type {any} */ ({ gold: -5 }) })).toEqual(['Isolda se queda más lejos (-1 de vínculo).', 'Te cuesta 5 de oro.']);
        expect(meetupSummary({ name: 'Isolda', result: { ...result, points: 0 }, outcome: /** @type {any} */ ({ gold: 0 }) })).toEqual(['Con Isolda, todo sigue igual.']);
    });

    test('un rato no cuenta como escena vista', () => {
        const rato = /** @type {any} */ ({ id: 'rato-x', kind: 'rato' });
        const after = recordMeetup(null, { name: 'X', scene: rato, elapsed: 5 });
        expect(after.seen).toEqual({});
        expect(after.met).toEqual({ x: 5 });
    });
});
