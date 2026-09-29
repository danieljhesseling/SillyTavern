/**
 * J14.1: la charla corta con tu gente (`small-talk.js`), lo que se guarda de ella (`social.js`)
 * y su contenido (`compendio/charlas.json`).
 */
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import {
    MOMENTS, HURT_AT, WARMTH_STEP, TALK_WANTS, readTalkRows, isHurt, momentOf, talkRowsFor, hasTalk, shouldTalk,
    markSpontaneous, chooseSpeaker, pickTalk, answerTalk, talkScene, talkCoverage,
} from '../public/scripts/game-engine/campaign/small-talk.js';
import {
    SOCIAL_KEY, createSocial, readSocial, keyOf, bondKeyOf, carryBonds, adoptBond,
} from '../public/scripts/game-engine/campaign/social.js';
import { validateBattery, DOMAINS } from '../public/scripts/game-engine/compendio/compendio.js';
import { HIRELINGS } from '../public/scripts/game-engine/campaign/guests.js';
import { leftoverMarkers, genderHacks } from '../public/scripts/game-engine/campaign/grammar.js';

const read = (/** @type {string} */ path) => JSON.parse(readFileSync(new URL(`../public/${path}`, import.meta.url), 'utf8'));
const file = read('compendio/charlas.json');
const rows = readTalkRows(file);
const packs = { strahd: read('mundos/strahd.pack.json'), 1387: read('mundos/1387.pack.json'), gremio: read('mundos/gremio.pack.json') };

/** Un azar con semilla, para que las pruebas digan siempre lo mismo. */
const seeded = (seed = 7) => () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
};

const HERO_F = { name: 'Tessa', gender: 'Mujer', hp: 20, maxHp: 20 };
const HERO_M = { name: 'Bruno', gender: 'Hombre', hp: 20, maxHp: 20 };
const gerd = { id: 2, name: 'Gerd el Mellado', hp: 16, maxHp: 16, guest: { kind: 'mercenary' }, reasons: { wants: 'coin' } };
const nella = { id: 3, name: 'Nella Tresflechas', hp: 16, maxHp: 16, guest: { kind: 'mercenary' }, reasons: { wants: 'coin' } };
const osric = { id: 4, name: 'Osric Mediapaga', hp: 16, maxHp: 16, guest: { kind: 'mercenary' }, reasons: { wants: 'coin' } };

describe('el contenido: compendio/charlas.json', () => {
    test('es una batería del compendio que se carga sin errores', () => {
        expect(DOMAINS).toContain('charlas');
        expect(validateBattery('charlas', file)).toEqual([]);
        expect(rows.length).toBe(file.rows.length);
    });

    test('cada fila tiene una o dos frases y tres respuestas: una que gusta, una que no y una neutra', () => {
        for (const row of rows) {
            expect(row.lines.length).toBeGreaterThanOrEqual(1);
            expect(row.lines.length).toBeLessThanOrEqual(2);
            expect(row.replies.map(r => r.mood).sort()).toEqual([-1, 0, 1]);
            expect(Object.keys(MOMENTS)).toContain(row.moment);
        }
    });

    test('al menos ocho por mercenario y por persona del gremio, y de todos los momentos los mercenarios', () => {
        const coverage = talkCoverage(rows);
        for (const { name } of HIRELINGS) {
            const total = Object.values(coverage[name] ?? {}).reduce((a, b) => a + b, 0);
            expect(total).toBeGreaterThanOrEqual(8);
            expect(Object.keys(coverage[name]).sort()).toEqual(Object.keys(MOMENTS).sort());
        }
        for (const npc of packs.gremio.npcs) {
            const total = Object.values(coverage[npc.name] ?? {}).reduce((a, b) => a + b, 0);
            expect([npc.name, total >= 8]).toEqual([npc.name, true]);
        }
    });

    test('los confidentes de Strahd y de 1387 tienen frases de los cinco momentos', () => {
        const coverage = talkCoverage(rows);
        for (const pack of [packs.strahd, packs[1387]]) {
            for (const c of pack.confidants) {
                expect([c.name, Object.keys(coverage[c.name] ?? {}).sort()]).toEqual([c.name, Object.keys(MOMENTS).sort()]);
            }
        }
    });

    test('y cada deseo, para quien no tiene frases propias, también de los cinco', () => {
        const coverage = talkCoverage(rows);
        for (const want of TALK_WANTS) expect(Object.keys(coverage[`(${want})`] ?? {}).sort()).toEqual(Object.keys(MOMENTS).sort());
    });

    test('quien habla existe: un mercenario, alguien del gremio o un confidente de su campaña', () => {
        const known = new Set([
            ...HIRELINGS.map(h => h.name),
            ...packs.gremio.npcs.map(/** @param {any} n */ n => n.name),
            ...packs.strahd.confidants.map(/** @param {any} c */ c => c.name),
            ...packs[1387].confidants.map(/** @param {any} c */ c => c.name),
        ]);
        expect(rows.filter(r => r.who && !known.has(r.who)).map(r => r.id)).toEqual([]);
        expect(rows.filter(r => !r.who && !TALK_WANTS.includes(r.wants)).map(r => r.id)).toEqual([]);
    });

    test('ninguna frase se lee con llaves ni apaños, sea tu héroe quien sea', () => {
        for (const hero of [HERO_F, HERO_M, { name: 'Ari', gender: 'No binario' }]) {
            const social = createSocial();
            for (const row of rows) {
                const person = { name: row.who || 'Alguien', wants: row.wants };
                const only = [row];
                const { talk } = pickTalk({ rows: only, person, moment: row.moment, social, random: () => 0, hero, party: [hero, gerd], place: 'Puerto Alba' });
                const said = [...(talk?.lines ?? []), ...(talk?.replies ?? []).flatMap(r => [r.text, r.then])].join(' ');
                expect(talk).not.toBeNull();
                expect([row.id, said.match(/[{}|]/)?.[0] ?? '']).toEqual([row.id, '']);
                expect(leftoverMarkers(said)).toEqual([]);
                expect(genderHacks(said)).toEqual([]);
            }
        }
    });
});

describe('cuándo y qué se dice', () => {
    test('el momento sale de lo que pasa; si vas mal de vida, manda eso', () => {
        expect(momentOf({ event: 'combat' })).toBe('pelea');
        expect(momentOf({ event: 'arrive' })).toBe('llegada');
        expect(momentOf({ event: 'travel' })).toBe('viaje');
        expect(momentOf({ event: 'town' })).toBe('pueblo');
        expect(momentOf({ event: 'nada' })).toBe('');
        const hurt = { hp: Math.floor(20 * HURT_AT), maxHp: 20 };
        expect(isHurt(hurt)).toBe(true);
        expect(momentOf({ event: 'combat', hero: hurt })).toBe('herido');
        expect(isHurt({ hp: 0, maxHp: 0 })).toBe(false);
        expect(isHurt({ hp: 2, maxHp: 20, dead: true })).toBe(false);
    });

    test('las suyas primero; sin frases propias, las de lo que busca; sin nada, nada', () => {
        const own = talkRowsFor({ rows, person: { name: 'Gerd el Mellado', wants: 'coin' }, moment: 'pelea', place: 'x' });
        expect(own.length).toBeGreaterThan(0);
        expect(own.every(r => r.who === 'Gerd el Mellado')).toBe(true);
        const stranger = talkRowsFor({ rows, person: { name: 'Fulano', wants: 'glory' }, moment: 'viaje', place: 'x' });
        expect(stranger.length).toBeGreaterThan(0);
        expect(stranger.every(r => r.wants === 'glory' && !r.who)).toBe(true);
        expect(talkRowsFor({ rows, person: { name: 'Fulano' }, moment: 'viaje' })).toEqual([]);
        expect(hasTalk(rows, { name: 'Tomás' }, 'pueblo')).toBe(true);
        expect(hasTalk(rows, { name: 'Tomás' }, 'pelea')).toBe(false);
    });

    test('una frase con {sitio} solo sale si se sabe el sitio, y con la hora que dice', () => {
        const mine = readTalkRows([
            { id: 'a', who: 'X', moment: 'llegada', lines: ['Por fin, {sitio}.'], replies: [{ text: 'a', mood: 1 }, { text: 'b', mood: 0 }, { text: 'c', mood: -1 }] },
            { id: 'b', who: 'X', moment: 'pueblo', when: { hora: 'night' }, lines: ['Qué noche.'], replies: [{ text: 'a', mood: 1 }, { text: 'b', mood: 0 }, { text: 'c', mood: -1 }] },
        ]);
        expect(talkRowsFor({ rows: mine, person: { name: 'X' }, moment: 'llegada' })).toEqual([]);
        expect(talkRowsFor({ rows: mine, person: { name: 'X' }, moment: 'llegada', place: 'Vallaki' })).toHaveLength(1);
        expect(talkRowsFor({ rows: mine, person: { name: 'X' }, moment: 'pueblo', slot: 'morning' })).toEqual([]);
        expect(talkRowsFor({ rows: mine, person: { name: 'X' }, moment: 'pueblo', slot: 'night' })).toHaveLength(1);
        const { talk } = pickTalk({ rows: mine, person: { name: 'X' }, moment: 'llegada', social: null, random: () => 0, place: 'Vallaki' });
        expect(talk?.lines).toEqual(['Por fin, Vallaki.']);
    });

    test('las filas rotas no entran', () => {
        expect(readTalkRows({ rows: [
            { id: 'sin-frases', who: 'X', moment: 'pueblo', lines: [], replies: [{ text: 'a' }, { text: 'b' }, { text: 'c' }] },
            { id: 'dos-respuestas', who: 'X', moment: 'pueblo', lines: ['Hola.'], replies: [{ text: 'a' }, { text: 'b' }] },
            { id: 'momento-raro', who: 'X', moment: 'baile', lines: ['Hola.'], replies: [{ text: 'a' }, { text: 'b' }, { text: 'c' }] },
        ] })).toEqual([]);
        expect(readTalkRows(null)).toEqual([]);
    });

    test('concuerda con tu héroe y pone su nombre', () => {
        const mine = readTalkRows([{ id: 'x', who: 'X', moment: 'herido', lines: ['Estás {pálido|pálida}, {heroe}.'], replies: [{ text: 'Estoy {bien|bien}.', mood: 0 }, { text: 'a', mood: 1 }, { text: 'b', mood: -1 }] }]);
        const said = (/** @type {any} */ hero) => pickTalk({ rows: mine, person: { name: 'X' }, moment: 'herido', social: null, random: () => 0, hero }).talk?.lines[0];
        expect(said(HERO_F)).toBe('Estás pálida, Tessa.');
        expect(said(HERO_M)).toBe('Estás pálido, Bruno.');
        // Sin nombre, la frase con {heroe} no sale.
        expect(pickTalk({ rows: mine, person: { name: 'X' }, moment: 'herido', social: null, random: () => 0 }).talk).toBeNull();
    });
});

describe('sin repetir hasta agotarlas', () => {
    test('las de una persona y un momento salen todas antes de repetir, y nunca la misma dos veces seguidas', () => {
        const person = { name: 'Gerd el Mellado', wants: 'coin' };
        const pool = talkRowsFor({ rows, person, moment: 'pueblo' });
        let social = createSocial();
        const random = seeded(3);
        /** @type {string[]} */
        const said = [];
        for (let i = 0; i < pool.length * 3; i++) {
            const picked = pickTalk({ rows, person, moment: 'pueblo', social, random, hero: HERO_F });
            social = picked.social;
            said.push(String(picked.talk?.id));
        }
        expect(new Set(said.slice(0, pool.length)).size).toBe(pool.length);
        for (let i = 1; i < said.length; i++) expect(said[i]).not.toBe(said[i - 1]);
    });

    test('una vuelta por el gremio oye al menos diez distintas, sin repetir', () => {
        const party = [HERO_F, gerd, nella, osric];
        let social = createSocial();
        const random = seeded(11);
        /** @type {string[]} */
        const heard = [];
        const moments = ['pelea', 'llegada', 'viaje', 'pueblo', 'herido'];
        for (let i = 0; i < 12; i++) {
            const moment = moments[i % moments.length];
            const speaker = chooseSpeaker({ party, moment, rows, social, random });
            expect(speaker).not.toBeNull();
            const picked = pickTalk({ rows, person: { name: speaker.name, wants: 'coin' }, moment, social, random, hero: HERO_F, party, place: 'Puerto Alba' });
            social = picked.social;
            heard.push(String(picked.talk?.id));
        }
        expect(new Set(heard).size).toBe(heard.length);
        expect(heard.length).toBeGreaterThanOrEqual(10);
    });

    test('lo oído se recuerda al guardar y volver a leer', () => {
        const picked = pickTalk({ rows, person: { name: 'Tomás' }, moment: 'pueblo', social: null, random: () => 0 });
        const again = readSocial(JSON.parse(JSON.stringify(picked.social)));
        expect(again.heard).toEqual([picked.talk?.id]);
        expect(again.lastSpeaker).toBe('tomas');
    });
});

describe('quién habla y cuándo sale sola', () => {
    test('habla un compañero vivo con algo que decir, no el héroe, ni quien se escolta, y mejor no el de la última vez', () => {
        const ward = { id: 9, name: 'El viajero', hp: 5, maxHp: 5, guest: { kind: 'ward' } };
        const dead = { ...nella, dead: true };
        const party = [HERO_F, ward, dead, gerd, osric];
        const social = { ...createSocial(), lastSpeaker: 'gerd-el-mellado' };
        for (const r of [0, 0.3, 0.6, 0.99]) {
            expect(chooseSpeaker({ party, moment: 'pelea', rows, social, random: () => r })?.name).toBe('Osric Mediapaga');
        }
        expect(chooseSpeaker({ party: [HERO_F], moment: 'pelea', rows, social, random: () => 0 })).toBeNull();
    });

    test('la del pueblo sale siempre; las demás, con su probabilidad y una por franja', () => {
        const social = createSocial();
        expect(shouldTalk({ moment: 'pueblo', social, elapsed: 3, random: () => 0.99 })).toBe(true);
        expect(shouldTalk({ moment: 'pelea', social, elapsed: 3, random: () => 0.1 })).toBe(true);
        expect(shouldTalk({ moment: 'pelea', social, elapsed: 3, random: () => 0.99 })).toBe(false);
        const said = markSpontaneous(social, 3);
        expect(shouldTalk({ moment: 'pelea', social: said, elapsed: 3, random: () => 0 })).toBe(false);
        expect(shouldTalk({ moment: 'pelea', social: said, elapsed: 4, random: () => 0 })).toBe(true);
        expect(shouldTalk({ moment: 'baile', social, elapsed: 4, random: () => 0 })).toBe(false);
    });
});

describe('lo que mueve contestar', () => {
    const talk = /** @type {any} */ ({
        id: 't', who: 'Gerd el Mellado', key: 'gerd-el-mellado', moment: 'pelea', mood: '', lines: ['¡Ja!'],
        replies: [{ text: 'Bien.', mood: 1, then: 'Gracias.', face: 'alegre' }, { text: 'Ya.', mood: 0, then: '', face: '' }, { text: 'Calla.', mood: -1, then: 'Vale.', face: 'enfadado' }],
    });

    test('a un compañero: un punto de vínculo arriba o abajo, una vez al día', () => {
        const liked = answerTalk({ talk, index: 0, social: null, day: 3, id: '2', wants: 'coin' });
        expect(liked.event).toBe('approved');
        expect(liked.counted).toBe(true);
        expect(liked.note).toBe('A Gerd el Mellado le ha gustado.');
        expect(liked.verdict).toEqual({ id: '2', name: 'Gerd el Mellado', want: 'coin', mood: 1, what: 'lo que le dijiste en una charla' });
        const again = answerTalk({ talk, index: 2, social: liked.social, day: 3 });
        expect(again.event).toBeNull();
        expect(again.counted).toBe(false);
        expect(again.note).toBe('A Gerd el Mellado no le ha gustado.');
        expect(answerTalk({ talk, index: 2, social: liked.social, day: 4 }).event).toBe('disapproved');
        const neutral = answerTalk({ talk, index: 1, social: null, day: 3 });
        expect([neutral.event, neutral.counted, neutral.note]).toEqual([null, false, '']);
        expect(answerTalk({ talk, index: 7, social: null, day: 3 }).reply).toBeNull();
    });

    test('a alguien del pueblo: su trato, y cada tres buenas os mira mejor', () => {
        const tomas = { ...talk, who: 'Tomás', key: 'tomas' };
        let social = createSocial();
        /** @type {number[]} */
        const steps = [];
        for (let day = 1; day <= WARMTH_STEP; day++) {
            const answer = answerTalk({ talk: tomas, index: 0, social, day, inParty: false });
            expect(answer.event).toBeNull();
            social = answer.social;
            steps.push(answer.attitude);
        }
        expect(steps).toEqual([0, 0, 1]);
        expect(social.warmth.tomas).toBe(0);
        let cold = createSocial();
        let last = 0;
        for (let day = 1; day <= WARMTH_STEP; day++) {
            const answer = answerTalk({ talk: tomas, index: 2, social: cold, day, inParty: false });
            cold = answer.social;
            last = answer.attitude;
        }
        expect(last).toBe(-1);
    });

    test('una charla se enseña como una escena de un paso', () => {
        const scene = talkScene(talk);
        expect(scene.kind).toBe('charla');
        expect(scene.title).toBe('Tras la pelea');
        expect(scene.beats).toHaveLength(1);
        expect(scene.beats[0].replies.map((/** @type {any} */ r) => r.bond)).toEqual([1, 0, -1]);
    });
});

describe('lo que se guarda (social.js)', () => {
    test('la clave, el nombre sin tildes; el vínculo, por la ficha o por el nombre', () => {
        expect(SOCIAL_KEY).toBe('social');
        expect(keyOf('Tomás')).toBe('tomas');
        expect(keyOf('Arthur «Doc»')).toBe('arthur-doc');
        expect(keyOf('Ezmerelda d\'Avenir')).toBe('ezmerelda-d-avenir');
        expect(bondKeyOf({ id: 3, name: 'Gerd el Mellado' })).toBe('3');
        expect(bondKeyOf({ name: 'Gerd el Mellado' })).toBe('gente:gerd-el-mellado');
        expect(bondKeyOf(null)).toBe('');
    });

    test('lo que llega roto se repara', () => {
        const fixed = readSocial({ heard: ['a', 7, null], seen: { gerd: ['x', 'x'], nadie: [] }, day: { day: 2, done: [{ slot: 'morning', what: 'entrenar' }, { nada: 1 }] }, errand: { what: '' } });
        expect(fixed.heard).toEqual(['a', '7']);
        expect(fixed.seen).toEqual({ gerd: ['x'] });
        expect(fixed.day).toEqual({ day: 2, done: [{ slot: 'morning', what: 'entrenar', label: 'entrenar' }] });
        expect(fixed.errand).toBeNull();
        expect(readSocial('basura')).toEqual(createSocial());
    });

    test('los vínculos viajan de un chat a otro por el nombre, y la gente del pueblo va con ellos', () => {
        const bonds = { bonds: { 2: { points: 9 }, 7: { points: 4 }, 'gente:tomas': { points: 3 } } };
        const carried = carryBonds({
            bonds,
            from: [{ id: 1, name: 'Tessa' }, { id: 2, name: 'Gerd el Mellado' }],
            to: [{ id: 1, name: 'Tessa' }, { id: 5, name: 'Gerd el Mellado' }],
            here: { bonds: { 8: { points: 2 } } },
        });
        expect(carried.bonds['5'].points).toBe(9);
        expect(carried.bonds['8'].points).toBe(2);
        expect(carried.bonds['gente:tomas'].points).toBe(3);
        expect(carried.bonds['2']).toBeUndefined();
        expect(carried.bonds['7']).toBeUndefined();
    });

    test('quien se une trae lo que ya había entre vosotros', () => {
        const adopted = adoptBond({ bonds: { 'gente:gerd-el-mellado': { points: 5 }, 9: { points: 1 } } }, 'gente:gerd-el-mellado', '9');
        expect(adopted.bonds['9'].points).toBe(6);
        expect(adopted.bonds['gente:gerd-el-mellado']).toBeUndefined();
        expect(adoptBond({ bonds: {} }, 'gente:x', '9').bonds).toEqual({});
    });
});
