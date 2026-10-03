import { describe, test, expect } from '@jest/globals';
import {
    grudgeScore, grudgeOf, dueRaise, raiseAsk, raiseScene, raiseChoice, settleRaise, noteRaise, readGrudges, easeVerdicts,
    GRUDGE_DAYS, RAISE_WEEKLY,
} from '../public/scripts/game-engine/campaign/grudges.js';
import {
    hardDay, topicOf, frictionWants, argumentFor, argumentChoice, argumentVerdicts,
} from '../public/scripts/game-engine/campaign/campfire-arguments.js';
import {
    mercQuestFor, readMercQuests, addMercQuest, dueMercQuests, markTold, mercAskScene,
} from '../public/scripts/game-engine/campaign/merc-quests.js';
import { readQuestRows, checkQuest } from '../public/scripts/game-engine/campaign/companion-quests.js';
import { bindCast, castOutcome } from '../public/scripts/game-engine/campaign/cast-scenes.js';
import { noteApproval } from '../public/scripts/game-engine/campaign/approval.js';

const hero = { id: 'h', name: 'Aldo', hp: 20, maxHp: 20 };
const bruna = { id: 'm1', name: 'Bruna Piedrahita', gender: 'f', class: 'guerrero', hp: 12, maxHp: 12, level: 2, guest: { kind: 'mercenary' }, reasons: { wants: 'coin' } };
const gerd = { id: 'c1', name: 'Gerd el Mellado', hp: 15, maxHp: 15, reasons: { wants: 'glory' } };
const nella = { id: 'c2', name: 'Nella Tresflechas', gender: 'f', hp: 10, maxHp: 10, reasons: { wants: 'quiet' } };

/** @param {number} seed */
function seeded(seed) {
    let s = seed;
    return () => {
        s = (s * 16807) % 2147483647;
        return s / 2147483647;
    };
}

/** El texto de todos los pasos de una escena, para buscar huecos sin rellenar. */
const allText = (scene) => JSON.stringify(scene.beats);

describe('E4.1: el disgusto', () => {
    const log = (id, moods, day) => ({ log: moods.map(mood => ({ id, mood, what: 'pagar para que os dejen pasar', day })), frictions: [] });

    test('solo cuenta lo de las dos últimas semanas', () => {
        const approval = { log: [...log('m1', [-1, -1, -1], 1).log, ...log('m1', [-1], 20).log], frictions: [] };
        expect(grudgeScore(approval, 'm1', 20)).toBe(-1);
        const old = log('m1', [-1, -1, -1], 1);
        expect(grudgeScore(old, 'm1', GRUDGE_DAYS)).toBe(-3);
        expect(grudgeScore(old, 'm1', GRUDGE_DAYS + 1)).toBe(0);
    });

    test('molesto con −2: no hace ataques en pareja; un mercenario pide más paga con −3', () => {
        expect(grudgeOf(gerd, -1).sulks).toBe(false);
        expect(grudgeOf(gerd, -2).sulks).toBe(true);
        expect(grudgeOf(gerd, -2).label).toMatch(/molesto contigo: no hará ataques en pareja/);
        expect(grudgeOf(nella, -2).label).toMatch(/molesta contigo/);
        expect(grudgeOf(gerd, -5).asksRaise).toBe(false);
        expect(grudgeOf(bruna, -2).asksRaise).toBe(false);
        expect(grudgeOf(bruna, -3).asksRaise).toBe(true);
    });

    test('pide quien está harto, y no vuelve a pedir en una semana', () => {
        const party = [hero, gerd, bruna];
        const scores = new Map([[bruna, -3], [gerd, -6]]);
        const scoreOf = (m) => Number(scores.get(m));
        expect(dueRaise({ party, scoreOf, state: {}, day: 5 })).toBe(bruna);
        const asked = noteRaise({}, { id: 'm1', day: 5 });
        expect(dueRaise({ party, scoreOf, state: asked, day: 8 })).toBeNull();
        expect(dueRaise({ party, scoreOf, state: asked, day: 12 })).toBe(bruna);
    });

    test('lo que pide: más sueldo con la cuenta de la semana, o una paga extra sin ella', () => {
        expect(raiseAsk(bruna, { weekly: true })).toEqual({ amount: RAISE_WEEKLY, weekly: true });
        expect(raiseAsk(bruna, { weekly: false })).toEqual({ amount: 25, weekly: false });
    });

    test('la charla la dice ella, con sus tres respuestas, y sin oro no se ofrece pagar', () => {
        const persuasion = { total: 15, dc: 13, success: true };
        const { row, kinds } = raiseScene({ member: bruna, ask: { amount: 10, weekly: true }, canPay: true, persuasion, why: 'pagar para que os dejen pasar' });
        expect(kinds).toEqual(['pagar', 'convencer', 'dejar']);
        const scene = bindCast({ row, kind: 'pareja', slots: { a: bruna }, hero, party: [hero, bruna] });
        expect(scene.beats.every(b => b.who === 'Bruna Piedrahita')).toBe(true);
        expect(scene.beats[0].say).toMatch(/cansada/);
        expect(scene.beats[0].say).toMatch(/pagar para que nos dejen pasar/);
        expect(scene.beats[1].say).toMatch(/10 de oro más a la semana/);
        expect(allText(scene)).not.toMatch(/\{[ab]\}/);
        const broke = raiseScene({ member: bruna, ask: { amount: 25, weekly: false }, canPay: false, persuasion });
        expect(broke.kinds).toEqual(['convencer', 'dejar']);
        expect(raiseChoice(broke.kinds, [{ beat: 1, reply: 1 }])).toBe('dejar');
        expect(raiseChoice(kinds, [])).toBe('');
    });

    test('pagar se lo quita; convencer depende de la tirada; dejarla, se va', () => {
        const ask = { amount: 10, weekly: true };
        const ok = { total: 15, dc: 13, success: true };
        const ko = { total: 8, dc: 13, success: false };
        expect(settleRaise({ member: bruna, choice: 'pagar', ask, persuasion: ok, score: -4 })).toMatchObject({ stays: true, weekly: 10, ease: 4 });
        expect(settleRaise({ member: bruna, choice: 'convencer', ask, persuasion: ok, score: -4 })).toMatchObject({ stays: true, ease: 3 });
        expect(settleRaise({ member: bruna, choice: 'convencer', ask, persuasion: ko, score: -4 })).toMatchObject({ stays: false });
        expect(settleRaise({ member: bruna, choice: 'dejar', ask, persuasion: ok, score: -4 }).line).toMatch(/se va del gremio/);
        expect(settleRaise({ member: bruna, choice: '', ask, persuasion: ok, score: -4 })).toMatchObject({ stays: true, line: '' });
    });

    test('lo que se le sube queda apuntado, y los 👍 de arreglarlo le quitan el enfado', () => {
        const state = noteRaise(noteRaise({}, { id: 'm1', day: 3, weekly: 10 }), { id: 'm1', day: 11, weekly: 10 });
        expect(readGrudges(state).raises.m1).toBe(20);
        const approval = log('m1', [-1, -1, -1], 3);
        const eased = noteApproval(approval, easeVerdicts(bruna, 3, 'le subiste la paga'), 3).state;
        expect(grudgeScore(eased, 'm1', 3)).toBe(0);
        expect(noteApproval(approval, easeVerdicts(bruna, 3, 'x'), 3).friction).toBeNull();
    });
});

describe('E4.2: discusiones junto al fuego', () => {
    test('un día duro: alguien muerto, alguien en las últimas o dos a media vida', () => {
        expect(hardDay({ party: [hero, gerd, nella] })).toBe(false);
        expect(hardDay({ party: [hero, gerd, nella], deadToday: 1 })).toBe(true);
        expect(hardDay({ party: [hero, { ...gerd, hp: 3 }, nella] })).toBe(true);
        expect(hardDay({ party: [hero, { ...gerd, hp: 6 }, { ...nella, hp: 4 }] })).toBe(true);
        expect(hardDay({ party: [hero, { ...gerd, hp: 6 }, nella] })).toBe(false);
    });

    test('lo que se hizo, dicho por uno del grupo', () => {
        expect(topicOf('Gerd y Nella chocan por pagar para que os dejen pasar: uno busca gloria y el otro tranquilidad.')).toBe('pagar para que nos dejen pasar');
        expect(topicOf('otra cosa')).toBe('');
        expect(frictionWants('A y B chocan por pagar: uno busca gloria y el otro tranquilidad.')).toEqual(['glory', 'quiet']);
        expect(frictionWants('otra cosa')).toEqual(['', '']);
    });

    test('lo que les hizo chocar manda sobre lo que busca cada uno', () => {
        const frictions = [{ a: 'c2', b: 'c1', day: 2, line: 'Nella y Gerd chocan por apostar: uno busca oro y el otro sangre.' }];
        const arg = argumentFor({ party: [hero, gerd, nella], frictions, day: 2, random: seeded(9) });
        expect(allText(arg.scene)).toMatch(/Eso deja dinero/);
        expect(allText(arg.scene)).toMatch(/Así se nos escapan/);
    });

    test('tras un roce de hoy discuten esos dos, cada uno con lo que busca, y tú das la razón', () => {
        const frictions = [{ a: 'c1', b: 'c2', day: 4, line: 'Gerd el Mellado y Nella Tresflechas chocan por plantar cara: uno busca gloria y el otro tranquilidad.' }];
        const arg = argumentFor({ party: [hero, gerd, nella], frictions, day: 4, random: seeded(3) });
        expect(arg?.kind).toBe('decision');
        expect(arg?.a).toBe(gerd);
        const text = allText(arg.scene);
        expect(text).toMatch(/plantar cara/);
        expect(text).toMatch(/Así se gana un nombre/);
        expect(text).toMatch(/Así vamos a acabar todos en una zanja/);
        expect(text).toMatch(/Aldo, dilo tú/);
        expect(text).not.toMatch(/\{[ab]\}|\{heroe\}/);
        // Nadie sin cara: cada paso lo dice uno de los dos (D-J60).
        expect(arg.scene.beats.every(b => ['Gerd el Mellado', 'Nella Tresflechas'].includes(b.who))).toBe(true);
        const choices = [{ beat: 2, reply: 0 }];
        expect(argumentChoice(arg.scene, choices)).toBe('a');
        const outcome = castOutcome({ scene: arg.scene, choices, party: [hero, gerd, nella] });
        expect(outcome.bonds.find(b => b.id === 'c1')?.points).toBe(1);
        expect(outcome.bonds.find(b => b.id === 'c2')?.points).toBe(-1);
        expect(argumentVerdicts('a', gerd, nella).map(v => [v.id, v.mood])).toEqual([['c1', 1], ['c2', -1]]);
        expect(argumentChoice(arg.scene, [{ beat: 2, reply: 2 }])).toBe('paz');
        expect(argumentVerdicts('paz', gerd, nella)).toEqual([]);
    });

    test('tras un día duro discuten uno que quiere seguir y otro que quiere volver', () => {
        const hurt = { ...nella, hp: 2 };
        const arg = argumentFor({ party: [hero, gerd, hurt], hard: true, day: 6, random: seeded(5) });
        expect(arg?.kind).toBe('dura');
        expect(arg?.a).toBe(gerd);
        expect(arg?.b).toBe(hurt);
        expect(allText(arg.scene)).toMatch(/Mírame: apenas me tengo en pie/);
        expect(allText(arg.scene)).toMatch(/¿Seguimos mañana o volvemos\?/);
    });

    test('sin roce ni día duro, o ya discutieron hoy, no hay discusión', () => {
        expect(argumentFor({ party: [hero, gerd, nella], day: 6, random: seeded(1) })).toBeNull();
        expect(argumentFor({ party: [hero, gerd, nella], hard: true, day: 6, lastArgued: 6, random: seeded(1) })).toBeNull();
        expect(argumentFor({ party: [hero, gerd, nella], hard: true, day: 7, lastArgued: 6, random: seeded(1) })).toBeNull();
        expect(argumentFor({ party: [hero, gerd], hard: true, day: 6, random: seeded(1) })).toBeNull();
    });
});

describe('E4.3: misiones de los mercenarios', () => {
    for (const [wants, word] of [['coin', 'herencia'], ['blood', 'Quien mató'], ['quiet', 'cantera']]) test(`con ${wants}, una misión jugable con sus finales alcanzables`, () => {
        const quest = mercQuestFor({ member: bruna, wants, random: seeded(7), heroName: 'Aldo', size: 3 });
        const rows = readQuestRows([quest.row]);
        expect(rows).toHaveLength(1);
        expect(rows[0].who).toBe('Bruna Piedrahita');
        expect(checkQuest(rows[0], quest.info)).toEqual([]);
        expect(`${quest.info.title} ${quest.info.pitch}`).toMatch(new RegExp(word, 'i'));
        // Camino, escena con decisión, pelea y finales: de dos a tres pasos antes del final.
        expect(rows[0].steps.map(s => s.kind).slice(0, 3)).toEqual(['viaje', 'escena', 'tablero']);
        const fight = rows[0].steps.find(s => s.kind === 'tablero');
        expect(fight.raw.board.enemies).toHaveLength(3);
        expect(fight.raw.bestiary.length).toBeGreaterThan(0);
        // Todo lo dice alguien (D-J60): ninguna línea sin quién.
        const scene = rows[0].steps.find(s => s.kind === 'escena');
        expect(scene.raw.beats.every(b => b.who)).toBe(true);
        expect(JSON.stringify(quest)).not.toMatch(/undefined|\{[a-z]+\}/);
    });

    test('la misma semilla, la misma misión; con concordancia de quien la pide', () => {
        const one = mercQuestFor({ member: bruna, wants: 'blood', random: seeded(11) });
        const two = mercQuestFor({ member: bruna, wants: 'blood', random: seeded(11) });
        expect(one).toEqual(two);
        expect(one.info.ask).toMatch(/No pienso ir sola/);
    });

    test('se guarda una por mercenario, a partir del vínculo 3, y se apunta cuando la pide', () => {
        const party = [hero, gerd, bruna];
        const ranks = new Map([[bruna, 3], [gerd, 5]]);
        const rankOf = (m) => Number(ranks.get(m));
        expect(dueMercQuests({ party, rankOf, store: {} })).toEqual([bruna]);
        expect(dueMercQuests({ party, rankOf: () => 2, store: {} })).toEqual([]);
        const quest = mercQuestFor({ member: bruna, wants: 'coin', random: seeded(2) });
        const store = addMercQuest({}, quest);
        expect(addMercQuest(store, mercQuestFor({ member: bruna, wants: 'quiet', random: seeded(2) })).rows).toHaveLength(1);
        expect(dueMercQuests({ party, rankOf, store })).toEqual([]);
        expect(readMercQuests(markTold(store, quest.row.id)).told).toEqual([quest.row.id]);
        expect(readMercQuests(JSON.parse(JSON.stringify(store))).infos[quest.row.id].title).toBe(quest.info.title);
    });

    test('te la pide él junto al fuego, con sus palabras', () => {
        const quest = mercQuestFor({ member: bruna, wants: 'quiet', random: seeded(4) });
        const scene = bindCast({ row: mercAskScene(quest.info), kind: 'pareja', slots: { a: bruna }, hero, party: [hero, bruna] });
        expect(scene.beats.every(b => b.who === 'Bruna Piedrahita')).toBe(true);
        expect(scene.beats[1].say).toBe(quest.info.ask);
        expect(scene.beats[2].replies.map(r => r.text)).toEqual(['Cuenta conmigo.', 'Ahora no puedo, pero no me olvido.']);
    });
});
