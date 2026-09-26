import { describe, test, expect } from '@jest/globals';
import { PERKS, perkChoices, takePerk, perkBonus, describePerks } from '../public/scripts/game-engine/rules/level-perks.js';
import { hasMaster, lessonsHere, canLearn, describeLesson, LESSON } from '../public/scripts/game-engine/campaign/masters.js';
import { startGame, drawDie, stand, cheat, payout, describeGame, roundsLeft, total, CHEAT_DC, ROUNDS_PER_DAY } from '../public/scripts/game-engine/campaign/tavern-dice.js';
import { addMount, mountedDays, feedPerWeek, describeMounts } from '../public/scripts/game-engine/world/mounts.js';
import { assignRoles, rollRoles, describeRoles } from '../public/scripts/game-engine/world/travel-roles.js';
import { isNight, isIndoors, carriesLight, combatVisibility, visibilityPenalties, sightFeetFor } from '../public/scripts/game-engine/world/visibility.js';
import { readyAttack, dropReadied, readiedAgainst } from '../public/scripts/game-engine/combat/readied.js';
import { canReact, markReacted, bossLine, BOSS_LINES } from '../public/scripts/game-engine/combat/boss-reaction.js';
import { companionEpilogue, companionEpilogues } from '../public/scripts/game-engine/campaign/epilogues.js';
import { canPry, notePry, secretNote, describeSecrets } from '../public/scripts/game-engine/campaign/npc-secrets.js';
import { repliesFor } from '../public/scripts/game-engine/ui/shell/replies.js';
import { saveSummary, describeSave, describeSaveParty } from '../public/scripts/game-engine/campaign/save-card.js';
import { checkWorldDensity, gemRequest } from '../public/scripts/game-engine/campaign/world-density.js';
import { readPlot, startPlot, plotEvent, cluesOf, closedOf } from '../public/scripts/game-engine/campaign/plot.js';
import { hintFor } from '../public/scripts/game-engine/campaign/guidance.js';

/** Un azar que va dando lo que se le pide, en orden. */
const seq = (/** @type {number[]} */ values) => { let i = 0; return () => values[i++ % values.length]; };
/** Un dado de seis que saca lo que se le pide. */
const dice = (/** @type {number[]} */ faces) => seq(faces.map(f => (f - 1) / 6 + 0.01));

describe('progresión', () => {
    test('46: al subir se eligen tres, sin repetir lo que ya se tiene, y cada una se nota', () => {
        const member = { perks: ['reflejos'], maxHp: 10, hp: 7, speed: 30 };
        const offer = perkChoices({ member, random: seq([0, 0, 0]) });
        expect(offer).toHaveLength(3);
        expect(offer.some(p => p.id === 'reflejos')).toBe(false);
        expect(new Set(offer.map(p => p.id)).size).toBe(3);
        expect(takePerk(member, 'aguante')).toEqual({ perks: ['reflejos', 'aguante'], maxHp: 14, hp: 11 });
        expect(takePerk(member, 'pies-ligeros')).toMatchObject({ speed: 35 });
        expect(takePerk(member, 'nada')).toBeNull();
        const grown = { perks: ['reflejos', 'labia', 'mano-firme'] };
        expect(perkBonus(grown, 'initiative')).toBe(2);
        expect(perkBonus(grown, 'attack')).toBe(1);
        expect(perkBonus(grown, 'skill', 'persuasion')).toBe(2);
        expect(perkBonus(grown, 'skill', 'stealth')).toBe(0);
        expect(describePerks(grown)).toHaveLength(3);
        expect(PERKS.every(p => p.label && p.describe)).toBe(true);
    });

    test('54: en cada pueblo enseñan un par de cosas, siempre las mismas, a quien no las sabe', () => {
        expect(hasMaster({ locationType: 'village' })).toBe(true);
        expect(hasMaster({ locationType: 'dungeon' })).toBe(false);
        const candidates = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }];
        const here = lessonsHere({ candidates, random: seq([0, 0]) });
        expect(here.map(l => l.ability.id)).toEqual(['a', 'b']);
        expect(lessonsHere({ candidates, random: seq([0, 0]), known: ['a'] }).map(l => l.ability.id)).toEqual(['b']);
        expect(here[0]).toMatchObject({ price: LESSON.price, days: LESSON.days });
        expect(canLearn({ purse: 10 }, here[0])).toMatchObject({ ok: false });
        expect(canLearn({ purse: 100 }, here[0]).ok).toBe(true);
        expect(describeLesson('Bran', { name: 'Embate', description: 'Un golpe.' }, 'El Pueblo')).toMatch(/Bran pasa 2 días .* aprende «Embate». Un golpe\./);
    });
});

describe('el pueblo', () => {
    test('128: a veintiuno: pedir, plantarse, la casa hasta 17, y quien se pasa pierde', () => {
        let game = startGame(10, dice([6, 5]));
        expect(total(game.mine)).toBe(11);
        game = drawDie(game, dice([6]));
        expect(total(game.mine)).toBe(17);
        const won = stand(game, dice([6, 6, 2]));
        expect(won.state).toBe('lost');
        const beat = stand(game, dice([5, 5, 6, 6]));
        expect(beat.state).toBe('won');
        expect(payout(beat)).toBe(10);
        expect(drawDie(drawDie(game, dice([6])), dice([6])).state).toBe('lost');
        expect(describeGame(beat)).toMatch(/Ganas 10 de oro/);
        expect(startGame(3, dice([1, 1])).bet).toBe(5);
    });

    test('128: hacer trampa: si sale, el último dado es un seis; si no, te pillan', () => {
        const game = startGame(20, dice([2, 3]));
        expect(cheat(game, { total: CHEAT_DC }).mine).toEqual([2, 6]);
        const caught = cheat(game, { total: CHEAT_DC - 1 });
        expect(caught.state).toBe('caught');
        expect(payout(caught)).toBe(-20);
        expect(cheat(cheat(game, { total: 20 }), { total: 20 }).mine).toEqual([2, 6]);
        expect(roundsLeft(null, 'X', 3)).toEqual({ left: ROUNDS_PER_DAY, banned: false });
        expect(roundsLeft({ place: 'X', day: 3, played: 2, banned: true }, 'X', 3)).toEqual({ left: 1, banned: true });
        expect(roundsLeft({ place: 'X', day: 2, played: 3 }, 'X', 3).left).toBe(ROUNDS_PER_DAY);
    });
});

describe('el viaje', () => {
    test('129: con montura para todos se llega antes; si no, al paso del que anda', () => {
        let mounts = addMount(null, 'caballo');
        expect(mountedDays({ days: 4, mounts, riders: 2 })).toMatchObject({ days: 4, saved: 0 });
        mounts = addMount(mounts, 'mula');
        expect(mountedDays({ days: 4, mounts, riders: 2 })).toMatchObject({ days: 3, saved: 1 });
        mounts = addMount(mounts, 'caballo');
        expect(mountedDays({ days: 4, mounts, riders: 2 })).toMatchObject({ days: 2, saved: 2 });
        expect(mountedDays({ days: 1, mounts, riders: 2 }).days).toBe(1);
        expect(feedPerWeek(mounts)).toBe(10);
        expect(describeMounts(mounts)).toBe('Monturas: 1 mula, 2 caballos (10 de oro de pienso a la semana)');
    });

    test('65: cada papel al que mejor lo hace, y cada uno tira', () => {
        const party = [{ id: 1, name: 'Aldara' }, { id: 2, name: 'Bran' }];
        const mods = { Aldara: { survival: 5, perception: 3 }, Bran: { survival: 0, perception: 1 } };
        const roles = assignRoles({ party, modifierOf: (m, s) => mods[/** @type {'Aldara'|'Bran'} */ (m.name)][/** @type {'survival'|'perception'} */ (s)] });
        expect(roles.map(r => [r.role, r.name])).toEqual([['guia', 'Aldara'], ['vigia', 'Bran']]);
        const outcome = rollRoles({ roles, rollD20: seq([10, 20]), days: 3 });
        expect(outcome).toMatchObject({ dayLess: true, dodge: true, fed: false });
        expect(rollRoles({ roles, rollD20: seq([10, 20]), days: 1 }).dayLess).toBe(false);
        expect(describeRoles(outcome.results)).toMatch(/^Guía: Aldara \(15 contra 12 ✓\) — un día menos de camino · Vigía: Bran/);
    });
});

describe('el tablero', () => {
    test('73 y 90: niebla, viento, lluvia y noche; bajo techo, nada', () => {
        expect(isNight('Noche')).toBe(true);
        expect(isNight('Tarde')).toBe(false);
        const fog = combatVisibility({ weather: 'niebla', slot: 'Mañana' });
        expect(fog).toMatchObject({ maxFeet: 30, windy: false });
        expect(visibilityPenalties(fog, 40)).toEqual(['con esta niebla no se ve']);
        expect(visibilityPenalties(fog, 20)).toEqual([]);
        const night = combatVisibility({ slot: 'Noche', lit: true });
        expect(night.maxFeet).toBe(60);
        expect(combatVisibility({ slot: 'Noche' }).maxFeet).toBe(30);
        const wind = combatVisibility({ weather: 'viento' });
        expect(visibilityPenalties(wind, 10)).toEqual(['el viento lo desvía']);
        expect(combatVisibility({ weather: 'lluvia' }).wet).toBe(true);
        expect(combatVisibility({ weather: 'niebla', slot: 'Noche', indoors: true }).maxFeet).toBeNull();
        expect(sightFeetFor(fog, 60)).toBe(30);
        expect(isIndoors({ name: 'El cuarto de la posada' })).toBe(true);
        expect(isIndoors({ name: 'La vanguardia en el peaje' })).toBe(false);
        expect(isIndoors({ name: 'Algo', indoors: true })).toBe(true);
        expect(carriesLight([{ items: [{ name: 'Antorcha bendecida' }] }])).toBe(true);
        expect(carriesLight([{ dead: true, items: [{ name: 'Farol' }] }])).toBe(false);
    });

    test('4: el golpe preparado salta con el primero que entra en tu alcance, no con quien ya estaba', () => {
        const feet = (/** @type {{x: number, y: number}} */ a, /** @type {{x: number, y: number}} */ b) => 5 * Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
        const readied = readyAttack(null, '1', 2);
        const members = [{ id: '1', x: 5, y: 5, reachFeet: 5 }];
        expect(readiedAgainst({ readied, members, from: { x: 9, y: 5 }, to: { x: 6, y: 5 }, distanceFeet: feet })).toBe('1');
        expect(readiedAgainst({ readied, members, from: { x: 6, y: 6 }, to: { x: 6, y: 5 }, distanceFeet: feet })).toBeNull();
        expect(readiedAgainst({ readied, members, from: { x: 9, y: 5 }, to: { x: 8, y: 5 }, distanceFeet: feet })).toBeNull();
        expect(dropReadied(readied, '1')).toEqual([]);
    });

    test('24: el jefe contesta una vez por ronda, si le llega', () => {
        const boss = { boss: true, currentHp: 20 };
        expect(canReact({ enemy: boss, reacted: {}, id: 'j', round: 2, distanceFeet: 5, reachFeet: 5 })).toBe(true);
        expect(canReact({ enemy: boss, reacted: markReacted({}, 'j', 2), id: 'j', round: 2, distanceFeet: 5, reachFeet: 5 })).toBe(false);
        expect(canReact({ enemy: boss, reacted: markReacted({}, 'j', 1), id: 'j', round: 2, distanceFeet: 5, reachFeet: 5 })).toBe(true);
        expect(canReact({ enemy: boss, reacted: {}, id: 'j', round: 2, distanceFeet: 30, reachFeet: 5 })).toBe(false);
        expect(canReact({ enemy: { currentHp: 20 }, reacted: {}, id: 'j', round: 2, distanceFeet: 5, reachFeet: 5 })).toBe(false);
        expect(BOSS_LINES).toContain(bossLine(seq([0]), ''));
        expect(bossLine(seq([0]), BOSS_LINES[0])).not.toBe(BOSS_LINES[0]);
    });
});

describe('el hilo y la gente', () => {
    test('109: el epílogo de cada uno, por su vínculo, su motivo y si llegó al final', () => {
        expect(companionEpilogue({ member: { name: 'Aldara' }, rank: 9, ending: 'La anarquía del barro' })).toMatch(/Aldara|«La anarquía del barro»/);
        expect(companionEpilogue({ member: { name: 'Bran', motive: 'coin' }, rank: 1, ending: 'X' })).toMatch(/^Bran (cobró|contó)/);
        expect(companionEpilogue({ member: { name: 'Grimm', dead: true }, rank: 5, ending: 'X', epitaph: 'Grimm, soldado.' })).toBe('Grimm, soldado. No llegó a ver el final.');
        const all = companionEpilogues({ party: [{ id: 1, name: 'Hero' }, { id: 2, name: 'Bran', motive: 'coin' }], ranks: { 2: 2 }, ending: 'X' });
        expect(all).toHaveLength(1);
    });

    test('110: sonsacar un secreto: una vez al día, donde está, y se apunta', () => {
        const npc = { name: 'Giles', secret: 'Vio quién entró.', where: 'El Pueblo' };
        expect(canPry({ npc, here: 'El Pueblo', secrets: null, today: 3 }).ok).toBe(true);
        expect(canPry({ npc, here: 'Otro', secrets: null, today: 3 }).reason).toMatch(/no está aquí/);
        expect(canPry({ npc: { name: 'Nadie' }, here: 'X', secrets: null, today: 3 }).ok).toBe(false);
        const failed = notePry(null, npc, false, 3);
        expect(canPry({ npc, here: 'El Pueblo', secrets: failed, today: 3 }).reason).toMatch(/en guardia/);
        expect(canPry({ npc, here: 'El Pueblo', secrets: failed, today: 4 }).ok).toBe(true);
        const known = notePry(failed, npc, true, 4);
        expect(canPry({ npc, here: 'El Pueblo', secrets: known, today: 5 }).reason).toMatch(/ya lo sabéis/);
        expect(describeSecrets(known)).toEqual(['Giles: Vio quién entró.']);
        expect(secretNote('Vio quién entró.')).toMatch(/que el grupo ya conoce: Vio quién entró\./);
    });

    test('144: tres cosas que decirle a quien se habla', () => {
        expect(repliesFor({ name: 'Giles', rumors: 2, canPry: true }).map(r => r.id)).toEqual(['reply-want', 'reply-pry', 'reply-rumor', 'reply-bye']);
        expect(repliesFor({ name: 'Giles' }).map(r => r.id)).toEqual(['reply-want', 'reply-bye']);
        // U6 y U8: convencer y el caso van antes que los rumores; la fila enseña cuatro.
        const extra = [{ id: 'reply-case', label: 'Caso', icon: 'x' }, { id: 'reply-duel', label: 'Convencer', icon: 'x' }];
        expect(repliesFor({ name: 'Giles', rumors: 2, canPry: true, extra }).map(r => r.id)).toEqual(['reply-want', 'reply-pry', 'reply-case', 'reply-duel']);
        expect(repliesFor({ name: '' })).toEqual([]);
        expect(repliesFor({ name: 'Giles', rumors: 1 }).find(r => r.id === 'reply-rumor')?.draft).toBe('Le pregunto a Giles qué se cuenta por aquí.');
    });

    test('160: la tarjeta de una partida: día, sitio, lo que hay entre manos y quién va', () => {
        const meta = {
            calendar: { day: 12 },
            currentLocation: 'El Peaje Norte',
            plot: { milestones: [{ id: 'a', title: 'La vanguardia', opens: { kind: 'start' }, asks: { kind: 'win' } }] },
            plotState: { open: ['a'], done: [] },
            party: [{ name: 'Wendel', avatar: 'w.png' }, { name: 'Bran', dead: true }],
        };
        const summary = saveSummary(meta);
        expect(describeSave(summary)).toBe('Día 12 · El Peaje Norte · La vanguardia');
        expect(describeSaveParty(summary)).toBe('Wendel, Bran ✝');
        const ended = saveSummary({ ...meta, plotEnding: 'x', plot: { ...meta.plot, endings: { x: { title: 'El yugo' } } } });
        expect(describeSave(ended)).toBe('Día 12 · El Peaje Norte · Final: El yugo');
    });
});

describe('crear mundos', () => {
    test('181: el comprobador de densidad, como pieza del motor', () => {
        const report = checkWorldDensity({
            world: { name: 'Pequeño', factions: [] },
            locations: [{ name: 'A', routes: [{ to: 'B' }] }, { name: 'B' }, { name: 'C', hidden: true }],
            plot: { milestones: [{ id: 'm', opens: { kind: 'start' }, asks: { kind: 'arrive', place: 'C' } }] },
        });
        expect(report.ok).toBe(false);
        expect(report.counts[0]).toMatch(/^✗ Hitos del hilo: 1/);
        expect(report.errors).toEqual(expect.arrayContaining([
            '«C» empieza escondida y nada la revela: nunca se podrá ir',
            'Hito m pide llegar a «C», que nada revela',
        ]));
        expect(gemRequest(report)).toMatch(/^Hola\. El mundo «Pequeño» todavía no está completo/);
    });
});

describe('el hilo con decisiones', () => {
    const plot = readPlot({
        milestones: [
            { id: 'formas', title: 'Quitarse de encima al alguacil', opens: { kind: 'start' },
                asks: { kind: 'any', options: [{ kind: 'win', board: 'El callejón' }, { kind: 'check', skill: 'deception' }, { kind: 'nada' }] },
                changes: { close: ['entregarse'] } },
            { id: 'entregarse', title: 'Entregarse a Torres', opens: { kind: 'start' }, asks: { kind: 'talk', npc: 'Torres' } },
            { id: 'pistas', title: 'Las cuentas del recaudador', opens: { kind: 'start' },
                asks: { kind: 'clues', need: 2, clues: [{ place: 'El Pueblo', skill: 'investigation' }, { place: 'El Castillo', skill: 'insight' }, { place: 'El Pueblo', skill: 'perception' }] } },
            { id: 'despues', title: 'Lo que viene', opens: { kind: 'after', milestone: 'entregarse' }, asks: { kind: 'none' } },
        ],
    });

    test('101: varias formas; cualquiera lo cumple, y se sabe cuál fue', () => {
        const formas = plot?.milestones.find(m => m.id === 'formas');
        expect(formas?.asks.options?.map(o => o.kind)).toEqual(['win', 'check']);
        const start = startPlot(/** @type {any} */ (plot), 1);
        const step = plotEvent(plot, start.state, { kind: 'check', skill: 'deception', success: true, place: 'El Pueblo' }, 2);
        expect(step.done.map(m => m.id)).toEqual(['formas']);
        expect(step.via).toEqual({ formas: 'check' });
        expect(hintFor(/** @type {any} */ (formas), 2, s => (s === 'deception' ? 'Engaño' : s))).toMatch(/^Hay más de una forma\. Hay que ganar «El callejón»\. O bien, una tirada de Engaño lo resuelve\.$/);
    });

    test('102: al cumplir uno se cierra el otro, y lo cerrado ya no se abre ni se cumple', () => {
        const start = startPlot(/** @type {any} */ (plot), 1);
        const step = plotEvent(plot, start.state, { kind: 'check', skill: 'deception', success: true }, 2);
        expect(step.closed.map(m => m.id)).toEqual(['entregarse']);
        expect(step.state.open).not.toContain('entregarse');
        expect(closedOf(plot, step.state)).toEqual(['Entregarse a Torres']);
        const later = plotEvent(plot, step.state, { kind: 'say', text: 'Hola, Torres' }, 3);
        expect(later.done).toEqual([]);
    });

    test('107: las pistas se juntan con tiradas en su sitio, y con las que pide se cumple', () => {
        const start = startPlot(/** @type {any} */ (plot), 1);
        const wrongPlace = plotEvent(plot, start.state, { kind: 'check', skill: 'insight', success: true, place: 'El Pueblo' }, 2);
        expect(wrongPlace.clues).toEqual([]);
        const first = plotEvent(plot, start.state, { kind: 'check', skill: 'investigation', success: true, place: 'El Pueblo' }, 2);
        expect(first.clues.map(c => [c.found, c.need])).toEqual([[1, 2]]);
        expect(cluesOf(plot, first.state)).toEqual([{ id: 'pistas', title: 'Las cuentas del recaudador', found: 1, need: 2,
            missing: [{ place: 'El Castillo', skill: 'insight' }, { place: 'El Pueblo', skill: 'perception' }] }]);
        const again = plotEvent(plot, first.state, { kind: 'check', skill: 'investigation', success: true, place: 'El Pueblo' }, 3);
        expect(again.clues).toEqual([]);
        const failed = plotEvent(plot, first.state, { kind: 'check', skill: 'perception', success: false, place: 'El Pueblo' }, 3);
        expect(failed.clues).toEqual([]);
        const solved = plotEvent(plot, first.state, { kind: 'check', skill: 'perception', success: true, place: 'El Pueblo' }, 3);
        expect(solved.done.map(m => m.id)).toEqual(['pistas']);
        const clues = plot?.milestones.find(m => m.id === 'pistas');
        expect(hintFor(/** @type {any} */ (clues), 2)).toBe('Las pistas están en: El Pueblo (investigation), El Castillo (insight), El Pueblo (perception).');
    });
});
