/**
 * D-J63: quedar y el romance, como en *Persona*. Sin botones de charlar, quedar ni romance: se
 * pulsa a la persona (su invitación), la quedada sube el vínculo con un momento claro, y el
 * romance llega en el rango 9, un punto de inflexión con dos rutas que llegan al 10.
 */
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import {
    DIRECT_SOCIAL_BUTTONS, INVITE_CHOICES, inviteOptions, hangoutReach, rankUpHint, invitationFor,
} from '../public/scripts/game-engine/campaign/invitations.js';
import {
    readMeetupRows, meetupFor, renderScene, startScene, sceneStep, sceneView, sceneOutcome, applyMeetup, recordMeetup,
    meetupSummary, replyTraits, RANK_UP_LINE, MEETUP_EVENTS,
} from '../public/scripts/game-engine/campaign/meetups.js';
import { readTalkRows } from '../public/scripts/game-engine/campaign/small-talk.js';
import {
    BOND_EVENTS, MAX_RANK, RANK_THRESHOLDS, createBondState, getRank, getUnlockedPerks, recordBondEvent,
} from '../public/scripts/game-engine/campaign/bonds.js';
import {
    ROMANCE_RANK, TURNING_WARNING, HEART, readRomanceCards, readRomanceRows, romanceCardOf, romanceScene, romanceChoice,
    advanceRomance, romanceOf, stageOf, coupleNote,
} from '../public/scripts/game-engine/campaign/romance.js';
import { leanOn } from '../public/scripts/game-engine/campaign/companion-opinions.js';

const read = (/** @type {string} */ path) => JSON.parse(readFileSync(new URL(`../public/${path}`, import.meta.url), 'utf8'));
const data = readMeetupRows(read('compendio/quedadas.json'));
const talkRows = readTalkRows(read('compendio/charlas.json'));
const cards = readRomanceCards(read('compendio/companeros.json'));
const romances = readRomanceRows(read('compendio/romances.json'));
const nella = /** @type {any} */ (romanceCardOf(cards, 'Nella Tresflechas'));
const gerd = /** @type {any} */ (romanceCardOf(cards, 'Gerd el Mellado'));
const tessa = { name: 'Tessa', gender: 'Mujer' };

/** Los puntos justos para estar en un rango. */
const at = (/** @type {number} */ rank) => recordBondEvent(createBondState(), 'k', 'manual', { points: RANK_THRESHOLDS[rank] }).state;

/**
 * Jugar una escena entera eligiendo con `choose` en cada paso con respuestas.
 *
 * @param {any} scene
 * @param {(replies: any[]) => number} choose
 */
function play(scene, choose) {
    let state = startScene();
    for (let guard = 0; guard < 20 && !state.done; guard++) {
        const view = sceneView(scene, state);
        if (view.next === 'reply') state = sceneStep(scene, state, { reply: choose(scene.beats[state.beat].replies) });
        else state = sceneStep(scene, state, { next: true });
    }
    return state.choices;
}

const best = (/** @type {any[]} */ replies) => replies.findIndex(r => r.bond === Math.max(...replies.map(x => x.bond)));
const neutral = (/** @type {any[]} */ replies) => Math.max(0, replies.findIndex(r => r.bond === 0));

/**
 * Quedar con Nella, de noche, desde el rango 9 hasta el 10, como en el juego (`playMeetup` de
 * party/social.js): si el romance trae su escena (una cita, la noche), esa; si no, la quedada de
 * siempre. Devuelve los vínculos, lo que sacó el romance en cada quedada y cómo acaba.
 *
 * @param {any} romance Su estado al llegar al rango 9.
 * @param {(replies: any[]) => number} choose
 */
function hangOutToTop(romance, choose) {
    let bonds = recordBondEvent(createBondState(), 'k', 'manual', { points: RANK_THRESHOLDS[ROMANCE_RANK] }).state;
    let social = null;
    let state = romance;
    const love = [];
    // Hasta el rango 10, y si estáis en las citas, hasta acabarlas (siguen después del 10).
    for (let i = 0; i < 20 && (getRank(bonds, 'k') < MAX_RANK || romanceOf(state, 'Nella Tresflechas')?.status === 'citas'); i++) {
        const turn = romanceScene({ data: romances, card: nella, name: 'Nella Tresflechas', hero: tessa, slot: 'night', state, rank: getRank(bonds, 'k'), day: i });
        love.push(turn);
        const picked = meetupFor({ person: { name: 'Nella Tresflechas' }, rank: getRank(bonds, 'k'), data, talkRows, social, random: () => 0.3, place: 'plaza', slot: 'night' });
        const scene = renderScene(turn?.scene ?? picked.scene, { hero: tessa });
        const choices = play(scene, choose);
        bonds = applyMeetup({ bonds, bondKey: 'k', outcome: sceneOutcome({ scene, choices }), data, name: 'Nella Tresflechas' }).bonds;
        social = recordMeetup(picked.social, { name: 'Nella Tresflechas', scene, elapsed: i, unlocks: [] });
        if (turn) state = advanceRomance(state, { name: 'Nella Tresflechas', stage: turn.stage, choice: romanceChoice(scene, choices), allowed: turn.allowed, day: i }).state;
    }
    return { bonds, love, state };
}

/** La respuesta que sigue adelante con el romance, si la hay; si no, la que más acerca. */
const onward = (/** @type {any[]} */ replies) => (replies.some(r => r.romance === 'avanza') ? replies.findIndex(r => r.romance === 'avanza') : best(replies));

describe('D-J63: pulsar a alguien es su invitación, no un menú', () => {
    test('los botones directos («Quedar con», «Charlar con», los corazones) están escondidos, con su interruptor', () => {
        expect(DIRECT_SOCIAL_BUTTONS).toBe(false);
        expect(inviteOptions('Gerd')).toEqual([
            { id: INVITE_CHOICES.quedar, label: 'Pasar el rato con Gerd' },
            { id: INVITE_CHOICES.luego, label: 'Hablamos en otro momento' },
        ]);
    });

    test('te saluda en contexto y con su voz: la hora, dónde está, lo de hace poco y su pregunta', () => {
        const hi = invitationFor({ name: 'Gerd el Mellado', place: 'muelle', slot: 'morning', lately: 'pelea', wants: 'coin', hero: tessa });
        expect(hi.intro).toBe(false);
        expect(hi.lines).toEqual([
            'Buenos días. Estaba en el muelle, viendo entrar las barcas.',
            'Lo de antes, la pelea, estuvo cerca. Me alegro de verte entera.',
        ]);
        expect(hi.ask).toBe('¿Tienes un rato? Te cuento un negocio que me ronda la cabeza.');
        expect(hi.options.map(o => o.label)).toEqual(['Pasar el rato con Gerd', 'Hablamos en otro momento']);
        // Sin narrador (D-J60): todo lo dice ella o él, sin comillas ni nombres en tercera persona.
        for (const line of [...hi.lines, hi.ask]) expect(line).not.toMatch(/«|Gerd/);
        // Si tiene su escena por contarte, lo dice; la fiesta del día, también.
        expect(invitationFor({ name: 'Gerd el Mellado', slot: 'night', scene: true }).ask).toBe('Oye, ¿tienes un rato? Hay algo que quiero contarte.');
        expect(invitationFor({ name: 'Nella', slot: 'afternoon', festival: 'la Fiesta de la Sal' }).lines).toContain('Hoy es la Fiesta de la Sal. Todo el pueblo está en la calle.');
        // Ya en la ruta de pareja, te espera.
        expect(invitationFor({ name: 'Nella', slot: 'night', date: 'final' }).ask).toBe('Esta noche quiero verte. ¿Vienes conmigo?');
    });

    test('dice el sitio como se llama en este pueblo: «en la taberna», «a la capilla», «al templo»', () => {
        const where = (/** @type {string} */ place, /** @type {string} */ placeName) => invitationFor({ name: 'Osric', place, placeName, slot: 'night' }).lines[0];
        // En Puerto Alba la posada es «La taberna» y el templo, «La capilla».
        expect(where('posada', 'La taberna')).toBe('Buenas noches. Aquí, en la taberna, con algo caliente delante.');
        expect(where('templo', 'La capilla')).toBe('Buenas noches. Me he acercado a la capilla a estar un rato en calma.');
        expect(where('gremio', 'La Casa del Gremio')).toBe('Buenas noches. Aquí, en la Casa del Gremio, sin mucho que hacer.');
        expect(where('tienda', 'La tienda de Bildrath')).toBe('Buenas noches. He venido a la tienda de Bildrath a por cuatro cosas.');
        // Sin nombre, el de siempre, con «al»; sin artículo, no se adivina.
        expect(where('templo', '')).toBe('Buenas noches. Me he acercado al templo a estar un rato en calma.');
        expect(where('posada', 'Taberna Sangre de la Enredadera')).toBe('Buenas noches. Aquí, en la posada, con algo caliente delante.');
        expect(where('plaza', 'El fuego del campamento')).toBe('Buenas noches. Estaba dando una vuelta por la plaza.');
    });

    test('quien aún no conoces (J13.7) se presenta primero', () => {
        const first = invitationFor({ name: 'Gerd el Mellado', known: false, place: 'posada', slot: 'night', lately: 'quedada' });
        expect(first.intro).toBe(true);
        expect(first.lines[0]).toBe('Creo que no nos conocemos. Soy Gerd.');
        // Lo de «el otro día» no: no os conocíais.
        expect(first.lines).toHaveLength(2);
        expect(invitationFor({ name: 'Ramiro', known: false, intro: 'Soy Ramiro, el herrero.' }).lines[0]).toBe('Soy Ramiro, el herrero.');
    });

    test('la pista: «Sientes que tu relación con Gerd se profundizará hoy», solo si quedar hoy sube el rango', () => {
        const base = BOND_EVENTS[MEETUP_EVENTS.rato].points;
        const near = RANK_THRESHOLDS[3] - base;
        expect(hangoutReach({ points: near })).toMatchObject({ rank: 2, reaches: 3, rankingUp: true, base });
        expect(rankUpHint({ name: 'Gerd el Mellado', points: near })).toBe('Sientes que tu relación con Gerd se profundizará hoy.');
        expect(rankUpHint({ name: 'Gerd el Mellado', points: near - 1 })).toBe('');
        // Su escena suma más que un rato: con ella, sube antes.
        expect(rankUpHint({ name: 'Gerd el Mellado', points: near - 1, scene: true })).not.toBe('');
        // Ni con quien no conoces, ni con quien no se queda, ni en el rango 10.
        expect(rankUpHint({ name: 'Gerd el Mellado', points: near, known: false })).toBe('');
        expect(rankUpHint({ name: 'Tomás', points: near, canMeet: false })).toBe('');
        expect(rankUpHint({ name: 'Gerd el Mellado', points: RANK_THRESHOLDS[MAX_RANK] + 50 })).toBe('');
    });
});

describe('D-J63: la quedada sube el vínculo, con un momento claro', () => {
    test('al subir, lo primero que se cuenta es «Rango 3 con Gerd»', () => {
        const picked = meetupFor({ person: { name: 'Gerd el Mellado' }, rank: 2, data, talkRows, social: null, random: () => 0.4, place: 'posada', slot: 'afternoon' });
        const scene = renderScene(picked.scene, { hero: tessa });
        const outcome = sceneOutcome({ scene, choices: play(scene, best) });
        const result = applyMeetup({ bonds: at(2), bondKey: 'k', outcome, data, name: 'Gerd el Mellado' });
        expect(result.rankedUp).toBe(true);
        const summary = meetupSummary({ name: 'Gerd el Mellado', result, outcome });
        expect(summary[0]).toBe(`Rango ${result.rankAfter} con Gerd`);
        expect(RANK_UP_LINE.test(summary[0])).toBe(true);
        expect(summary.slice(1).some(line => RANK_UP_LINE.test(line))).toBe(false);
    });

    test('las respuestas que van con su forma de pensar dan más (companion-opinions)', () => {
        expect(replyTraits({ text: '¿Y de dónde lo sacaste?' })).toContain('preguntar');
        expect(replyTraits({ text: 'Invito yo.', gold: -2 })).toContain('pagar');
        expect(replyTraits({ text: 'Vale.', decision: ['amable'] })).toEqual(['amable']);
        const scene = /** @type {any} */ ({
            kind: 'escena',
            beats: [{ say: 'He leído algo.', replies: [{ text: '¿Qué has leído?', bond: 1, then: '', mood: '', gold: 0 }, { text: 'Ajá.', bond: 0, then: '', mood: '', gold: 0 }] }],
        });
        const sage = { wants: 'knowledge', likes: [], dislikes: [] };
        const fits = (/** @type {any} */ reply) => replyTraits(reply).some(trait => leanOn(sage, trait) > 0);
        const plain = sceneOutcome({ scene, choices: [{ beat: 0, reply: 0 }] });
        const minded = sceneOutcome({ scene, choices: [{ beat: 0, reply: 0 }], fits });
        expect(minded.fitted).toBe(1);
        expect(minded.points).toBe(plain.points + BOND_EVENTS.approved.points);
        // Lo que no le gusta no suma por encajar.
        expect(sceneOutcome({ scene, choices: [{ beat: 0, reply: 1 }], fits }).fitted).toBe(0);
        expect(meetupSummary({ name: 'X', result: /** @type {any} */ ({ points: 3, rankedUp: false, rankAfter: 1, unlocks: [] }), outcome: minded }))
            .toContain('Lo que dijiste va con su forma de pensar: le llega más.');
    });
});

describe('D-J63: el ritmo, el rango 9 en una o dos campañas', () => {
    /**
     * Quedar con alguien hasta el rango `target`, solo quedando (sin peleas ni viajes).
     *
     * @param {string} name
     * @param {string} campaign
     * @param {(replies: any[]) => number} choose
     * @param {boolean} likedPlace
     * @param {number} [start] Los puntos con los que se empieza (lo de la aventura).
     */
    function hangoutsTo(name, campaign, choose, likedPlace, start = 0, target = ROMANCE_RANK) {
        let bonds = recordBondEvent(createBondState(), 'k', 'manual', { points: start }).state;
        let social = null;
        let n = 0;
        while (getRank(bonds, 'k') < target && n < 100) {
            n++;
            const picked = meetupFor({ person: { name }, rank: getRank(bonds, 'k'), data, talkRows, social, random: () => (n * 0.37) % 1, campaign, place: 'posada', slot: 'afternoon' });
            const scene = renderScene(picked.scene, { hero: tessa });
            const outcome = sceneOutcome({ scene, choices: play(scene, choose), likedPlace });
            bonds = applyMeetup({ bonds, bondKey: 'k', outcome, data, name }).bonds;
            social = recordMeetup(picked.social, { name, scene, elapsed: n, unlocks: [] });
        }
        return n;
    }

    test('solo quedando, el rango 9 llega en unas 12 quedadas contestando bien y unas 15 sin mojarse', () => {
        for (const [name, campaign] of [['Gerd el Mellado', 'gremio'], ['Bran', '1387'], ['Ismark Kolyanovich', 'strahd']]) {
            const good = hangoutsTo(name, campaign, best, true);
            const plain = hangoutsTo(name, campaign, neutral, false);
            expect(good).toBeGreaterThanOrEqual(10);
            expect(good).toBeLessThanOrEqual(14);
            expect(plain).toBeGreaterThanOrEqual(good);
            expect(plain).toBeLessThanOrEqual(18);
        }
    });

    test('con quien va contigo (unos 40 puntos de aventura por campaña), bastan unas pocas quedadas', () => {
        // Una campaña: unas 15 peleas ganadas juntos (2 cada una), alguna noche de charla y alguna aprobación.
        expect(hangoutsTo('Gerd el Mellado', 'gremio', neutral, false, 40)).toBeLessThanOrEqual(10);
        expect(hangoutsTo('Gerd el Mellado', 'gremio', neutral, false, 80)).toBeLessThanOrEqual(4);
    });
});

describe('D-J63: el romance es el punto de inflexión del rango 9', () => {
    const base = { data: romances, card: nella, name: 'Nella Tresflechas', hero: tessa, slot: 'afternoon' };

    test('antes del rango 9, nada de romance; la quedada que llega al 9, sí', () => {
        for (let rank = 1; rank < ROMANCE_RANK; rank++) expect(romanceScene({ ...base, state: null, rank })).toBeNull();
        // En el 8, si lo que suma esta quedada lleva al 9, es el punto de inflexión.
        expect(romanceScene({ ...base, state: null, rank: 8, reaches: 8 })).toBeNull();
        expect(romanceScene({ ...base, state: null, rank: 8, reaches: 9 })?.stage).toBe('senal');
        expect(romanceScene({ ...base, state: null, rank: 9 })?.stage).toBe('senal');
    });

    test('con quien no se ha presentado (J13.7), nunca', () => {
        expect(romanceScene({ ...base, state: null, rank: 10, known: false })).toBeNull();
        const dating = advanceRomance(null, { name: 'Nella Tresflechas', stage: 'senal', choice: 'avanza' }).state;
        expect(romanceScene({ ...base, state: dating, rank: 10, known: false })).toBeNull();
    });

    test('el aviso, sin corazones; la íntima abre la ruta de pareja, la de apoyo la de amigos inseparables, sin castigo', () => {
        const turning = /** @type {any} */ (romanceScene({ ...base, state: null, rank: 9 }));
        const decision = turning.scene.beats.find((/** @type {any} */ b) => b.warn);
        expect(decision.warn).toBe(TURNING_WARNING);
        expect(decision.replies.some((/** @type {any} */ r) => r.text.startsWith(HEART))).toBe(false);
        const intimate = decision.replies.findIndex((/** @type {any} */ r) => r.romance === 'avanza');
        const support = decision.replies.findIndex((/** @type {any} */ r) => r.romance === 'amigos');
        const last = turning.scene.beats.indexOf(decision);
        const answer = (/** @type {number} */ reply) => [...turning.scene.beats.map((/** @type {any} */ _b, /** @type {number} */ i) => ({ beat: i, reply: 0 })).slice(0, last), { beat: last, reply }];
        // Íntima: empezáis (las citas vienen después).
        const couple = advanceRomance(null, { name: 'Nella Tresflechas', short: 'Nella', stage: 'senal', choice: romanceChoice(turning.scene, answer(intimate)), allowed: true });
        expect(romanceOf(couple.state, 'Nella')?.status).toBe('citas');
        expect(romanceScene({ ...base, state: couple.state, rank: 9 })?.stage).toBe('cita');
        // De apoyo: amigos inseparables, y sin castigo: no aleja.
        const friends = advanceRomance(null, { name: 'Nella Tresflechas', short: 'Nella', stage: 'senal', choice: romanceChoice(turning.scene, answer(support)), allowed: true });
        expect(romanceOf(friends.state, 'Nella')?.status).toBe('amigos');
        expect(friends.news[0]).toBe('Desde hoy, Nella y tú sois inseparables: una amistad de las que duran.');
        expect(sceneOutcome({ scene: turning.scene, choices: answer(support) }).disliked).toBe(0);
        // En todos los puntos de inflexión escritos, la de apoyo nunca aleja.
        const supportive = romances.scenes.filter(s => s.stage === 'senal').flatMap(s => s.beats.flatMap(b => b.replies)).filter(r => r.romance === 'amigos');
        expect(supportive.length).toBeGreaterThanOrEqual(3);
        expect(supportive.map(r => r.bond).filter(b => b < 0)).toEqual([]);
    });

    test('quien no lo permite (Gerd) dice que no con cariño, y seguís igual', () => {
        const turning = /** @type {any} */ (romanceScene({ ...base, card: gerd, name: 'Gerd el Mellado', state: null, rank: 9 }));
        expect(turning.allowed).toBe(false);
        expect(turning.scene.beats.some((/** @type {any} */ b) => b.warn === TURNING_WARNING)).toBe(true);
        const after = advanceRomance(null, { name: 'Gerd el Mellado', stage: 'senal', choice: 'avanza', allowed: false });
        expect(stageOf(romanceOf(after.state, 'Gerd el Mellado'), 99)).toBe('cerrado');
    });

    test('la ruta de amigos llega al rango 10 con todas las ventajas del vínculo', () => {
        const friends = advanceRomance(null, { name: 'Nella Tresflechas', stage: 'senal', choice: 'amigos' }).state;
        const { bonds, love } = hangOutToTop(friends, neutral);
        // Ya no sale nada del romance: ratos y escenas de siempre.
        expect(love.filter(Boolean)).toEqual([]);
        expect(getRank(bonds, 'k')).toBe(MAX_RANK);
        expect(getUnlockedPerks(bonds, 'k').map(p => p.id)).toEqual(['follow_up', 'baton_pass', 'pair_move', 'endure', 'ultimate']);
    });

    test('la ruta de pareja (tres citas y la noche) también llega al rango 10 con todas las ventajas', () => {
        // Las citas suman vínculo como cualquier quedada: el rango 10 llega por el camino.
        const dating = advanceRomance(null, { name: 'Nella Tresflechas', stage: 'senal', choice: 'avanza' }).state;
        const { bonds, love, state } = hangOutToTop(dating, onward);
        expect(love.filter(Boolean).map(l => l.stage)).toEqual(['cita', 'cita', 'cita', 'final']);
        expect(romanceOf(state, 'Nella Tresflechas')?.status).toBe('pareja');
        expect(getRank(bonds, 'k')).toBe(MAX_RANK);
        expect(getUnlockedPerks(bonds, 'k').map(p => p.id)).toEqual(['follow_up', 'baton_pass', 'pair_move', 'endure', 'ultimate']);
    });

    test('las parejas tienen sus variantes en las fiestas y en las noches libres', () => {
        expect(coupleNote(romances, 'Nella Tresflechas', 0, { festival: 'la Fiesta de la Sal' })).toBe('Hoy es la Fiesta de la Sal. Ven, que esta vez bailas conmigo, aunque sea mal.');
        expect(coupleNote(romances, 'Nella Tresflechas', 0, { night: true })).toBe('Ya ha anochecido. Quédate un rato más conmigo: esta noche es nuestra.');
        expect(coupleNote(romances, 'Nella Tresflechas', 0)).toBe(romances.notes['nella-tresflechas'][0]);
        // Lo suyo, si su fila lo trae.
        const own = readRomanceRows([{ kind: 'pareja', who: 'Ana', lines: ['Hola.'], festival: ['¡A bailar en {fiesta}!'], night: ['Quédate.'] }]);
        expect(coupleNote(own, 'Ana', 0, { festival: 'Mayo' })).toBe('¡A bailar en Mayo!');
        expect(coupleNote(own, 'Ana', 0, { night: true })).toBe('Quédate.');
    });
});
