/**
 * E8 de wiki/ROADMAP_ENTRETENIDO.md, «La larga vida» (D-J64): los tramos de nivel del tablón,
 * los dones épicos tras el 20, retirarse al gremio, por qué llevar mercenarios, los veteranos,
 * devolver la vida en el templo y el modo duro.
 */

/* global globalThis */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { tierOf, campaignTier, sortByTier, tierLine, tierBoardLine } from '../public/scripts/game-engine/campaign/level-tiers.js';
import {
    EPIC_BOONS, EPIC_XP_START, EPIC_XP_STEP, boonsEarned, pendingBoons, takeBoon, boonBonus, xpToNextBoon, epicStart,
} from '../public/scripts/game-engine/rules/epic-boons.js';
import { perkBonus } from '../public/scripts/game-engine/rules/level-perks.js';
import {
    RETIRE_MIN_LEVEL, canRetire, retireHero, mentorStartLevel, mentorStartXp, guildPerkFor, lessonsOf, lessonsFor,
    noteTaught, readMentors, mentorPrice, retirementScene, retireChoice, lessonScene, lessonChoice, guildPerks,
} from '../public/scripts/game-engine/campaign/retirement.js';
import {
    VETERAN_TRIPS, hireReasons, noteTrip, dueVeterans, promoteVeteran, readVeteran, veteranScene,
} from '../public/scripts/game-engine/campaign/mercenary-life.js';
import {
    RAISE_SPELLS, raiseOffer, isRaisable, diamondsOf, raiseScar, raisedWeakness, raisedBasics, raiseScene,
} from '../public/scripts/game-engine/rules/resurrection.js';
import {
    HARD_MODE_KEY, readHardMode, hardModeOn, toggleHardMode, hardDeath, hardModeRow, withHardModeRow,
} from '../public/scripts/game-engine/ui/hard-mode-option.js';
import { addToHall, readHall, describeHallEntry, describeHallCount, withoutFallen } from '../public/scripts/game-engine/campaign/legacy.js';
import { resolveFall } from '../public/scripts/game-engine/rules/mortality.js';
import { outcomeView } from '../public/scripts/game-engine/combat/outcome.js';

const XP_TABLE = [['2', '300'], ['5', '6500'], ['9', '48000'], ['20', '355000']];

describe('E8.1: los tramos de nivel', () => {
    test('los cuatro tramos de 5e', () => {
        expect(tierOf(1).id).toBe(1);
        expect(tierOf(4).id).toBe(1);
        expect(tierOf(5).id).toBe(2);
        expect(tierOf(10).id).toBe(2);
        expect(tierOf(11).id).toBe(3);
        expect(tierOf(17).id).toBe(4);
        expect(tierOf(25).id).toBe(4);
        expect(campaignTier([10, 12])?.id).toBe(2);
        expect(campaignTier(null)).toBeNull();
        expect(tierLine(tierOf(1))).toBe('Tramo 1 · Héroes del lugar (niveles 1 a 4)');
        expect(tierBoardLine(6)).toMatch(/nivel 6: tramo 2/);
    });

    test('el tablón ofrece primero las de tu tramo, sin esconder las demás', () => {
        const cards = [
            { id: 'strahd', minLevel: 1 }, { id: 'alta', minLevel: 11 }, { id: 'media', minLevel: 5 }, { id: 'libre', minLevel: 0 },
        ];
        expect(sortByTier(cards, 1).map(c => c.id)).toEqual(['strahd', 'libre', 'media', 'alta']);
        const mid = sortByTier(cards, 7);
        expect(mid.map(c => c.id)).toEqual(['media', 'libre', 'strahd', 'alta']);
        expect(mid.find(c => c.id === 'media')?.yourTier).toBe(true);
        expect(mid.find(c => c.id === 'strahd')?.yourTier).toBe(false);
        expect(mid.find(c => c.id === 'alta')?.tierLabel).toMatch(/Tramo 3/);
    });
});

describe('E8.2: los dones épicos', () => {
    const hero = (over = {}) => ({ name: 'Tessa', level: 20, xp: EPIC_XP_START, maxHp: 150, hp: 150, speed: 30, strength: 20, constitution: 18, ...over });

    test('hasta el nivel 20 no hay dones; luego, uno cada 30.000 PX', () => {
        expect(boonsEarned(hero({ level: 19, xp: 900000 }), XP_TABLE)).toBe(0);
        expect(boonsEarned(hero(), XP_TABLE)).toBe(0);
        expect(boonsEarned(hero({ xp: EPIC_XP_START + EPIC_XP_STEP }), XP_TABLE)).toBe(1);
        expect(boonsEarned(hero({ xp: EPIC_XP_START + 2 * EPIC_XP_STEP + 10 }), XP_TABLE)).toBe(2);
        expect(pendingBoons(hero({ xp: EPIC_XP_START + 2 * EPIC_XP_STEP, epicBoons: ['don-velocidad'] }), XP_TABLE)).toBe(1);
        expect(xpToNextBoon(hero({ xp: EPIC_XP_START + 1000 }), XP_TABLE)).toBe(EPIC_XP_STEP - 1000);
        expect(epicStart([['20', '400000']])).toBe(400000);
    });

    test('coger un don cambia la ficha y sube una característica, hasta 30', () => {
        const ready = hero({ xp: EPIC_XP_START + EPIC_XP_STEP });
        const done = takeBoon(ready, 'don-fortaleza', { table: XP_TABLE });
        expect(done.ok).toBe(true);
        expect(done.patch).toMatchObject({ epicBoons: ['don-fortaleza'], maxHp: 190, hp: 190, strength: 21 });
        expect(done.line).toMatch(/Tessa gana el don de la fortaleza/);
        // Sin dones pendientes, no.
        expect(takeBoon(hero(), 'don-fortaleza', { table: XP_TABLE }).ok).toBe(false);
        // La característica no pasa de 30.
        const capped = takeBoon(hero({ xp: EPIC_XP_START + EPIC_XP_STEP, strength: 30, constitution: 30, dexterity: 30, intelligence: 30, wisdom: 30, charisma: 29 }), 'don-velocidad', { table: XP_TABLE });
        expect(capped.patch).toMatchObject({ speed: 60, charisma: 30 });
    });

    test('los que suman al ataque o a una habilidad se leen donde las mejoras', () => {
        const strong = { epicBoons: ['don-proeza', 'don-vision'], perks: ['mano-firme'] };
        expect(boonBonus(strong, 'attack')).toBe(2);
        expect(perkBonus(strong, 'attack')).toBe(3);
        expect(perkBonus(strong, 'skill', 'perception')).toBe(5);
        expect(EPIC_BOONS.filter(b => b.adapted).every(b => /En el libro/.test(b.describe))).toBe(true);
    });
});

describe('E8.3: retirarse al gremio', () => {
    const veteran = { name: 'Tessa', class: 'Guerrero', level: 9, gender: 'Mujer', perks: ['piel-dura', 'nodo-de-arbol'] };

    test('solo los tuyos, desde el nivel 5, en el gremio y fuera de combate', () => {
        expect(canRetire(veteran).ok).toBe(true);
        expect(canRetire({ ...veteran, level: RETIRE_MIN_LEVEL - 1 }).reason).toMatch(/nivel 5/);
        expect(canRetire({ ...veteran, guest: { kind: 'mercenary' } }).ok).toBe(false);
        expect(canRetire(veteran, { fighting: true }).ok).toBe(false);
        expect(canRetire(veteran, { inGuild: false }).ok).toBe(false);
    });

    test('se queda de maestro: más nivel para los nuevos, su dote, la ventaja del gremio y el Salón', () => {
        const done = retireHero(veteran, { day: 40, world: 'El Gremio', guild: 'Puerto Alba' });
        expect(done.mentor).toMatchObject({ name: 'Tessa', level: 9, lessons: ['piel-dura'], perk: 'armas' });
        expect(mentorStartLevel(done.mentors)).toBe(3);
        expect(mentorStartXp(done.mentors, XP_TABLE)).toBe(0); // la tabla corta no tiene el 3
        expect(mentorStartXp(done.mentors, [['2', '300'], ['3', '900']])).toBe(900);
        expect(done.hall.kind).toBe('retired');
        expect(done.hall.epitaph).toMatch(/Tessa, guerrero de nivel 9, se retiró al gremio de Puerto Alba el día 40/);
        expect(done.line).toMatch(/Los nuevos empezarán en el nivel 3/);
        expect(mentorStartLevel([{ name: 'Viejo', level: 20 }])).toBe(5);
        expect(mentorStartLevel([])).toBe(1);
    });

    test('lo que da cada oficio y lo que se enseña', () => {
        expect(guildPerkFor('Clérigo')).toBe('templo');
        expect(guildPerkFor('Pícaro')).toBe('bolsa');
        expect(guildPerkFor('Bárbaro')).toBe('armas');
        expect(lessonsOf({ class: 'Explorador', perks: [] })).toEqual(['paso-de-gato']);
        const mentors = retireHero(veteran, { day: 1 }).mentors;
        expect(mentorPrice(40, mentors, 'armas')).toBe(30);
        expect(mentorPrice(600, mentors, 'templo')).toBe(600);
        expect(guildPerks(mentors)[0]).toMatchObject({ id: 'armas', who: 'Tessa' });
        const lessons = lessonsFor(mentors, { name: 'Nuevo', perks: [] });
        expect(lessons).toEqual([{ mentor: 'Tessa', gender: 'Mujer', perk: expect.objectContaining({ id: 'piel-dura' }) }]);
        // Cada nuevo aprende una vez.
        const taught = noteTaught(mentors, 'Tessa', 'Nuevo');
        expect(lessonsFor(taught, { name: 'Nuevo', perks: [] })).toEqual([]);
        expect(readMentors([{ name: '', level: 3 }, { name: 'X', perk: 'raro' }])).toEqual([expect.objectContaining({ name: 'X', perk: 'bolsa' })]);
    });

    test('la despedida y la lección son charlas, sin narrador', () => {
        const scene = retirementScene({ hero: veteran, master: 'Brunilda' });
        expect(scene.who).toBe('Brunilda');
        expect(scene.beats.every(b => !b.note)).toBe(true);
        expect(retireChoice(scene, [{ beat: 0, reply: 0 }])).toBe('retira');
        expect(retireChoice(scene, [{ beat: 0, reply: 1 }])).toBe('sigue');
        const lesson = lessonScene({ hero: { name: 'Nuevo' }, lessons: lessonsFor(retireHero(veteran, {}).mentors, { name: 'Nuevo' }), start: 3 });
        expect(lesson?.who).toBe('Tessa');
        expect(lesson?.title).toBe('Lo que enseña la maestra');
        expect(scene.beats[0].say).toMatch(/¿Te quedas de maestra\?/);
        expect(lesson?.beats[0].say).toMatch(/nivel 3/);
        expect(lessonChoice(lesson, [{ beat: 0, reply: 0 }])).toEqual({ lesson: 'piel-dura', mentor: 'Tessa' });
        expect(lessonChoice(lesson, [{ beat: 0, reply: 1 }])).toBeNull();
    });

    test('el Salón de la fama guarda a los maestros aparte, y una vez', () => {
        const entry = retireHero(veteran, { day: 3, world: 'El Gremio' }).hall;
        const hall = addToHall(addToHall([], entry), entry);
        expect(hall).toHaveLength(1);
        expect(readHall(hall)[0].kind).toBe('retired');
        expect(describeHallEntry(readHall(hall)[0])).toMatch(/^🎓 Tessa/);
        expect(describeHallCount(hall)).toBe('1 maestro');
    });
});

describe('E8.5 y E8.6: los mercenarios', () => {
    const hero = { name: 'Tessa', class: 'Guerrero' };
    const nella = { name: 'Nella', class: 'Clérigo', gender: 'Mujer', injuries: [{ label: 'Pierna rota', daysLeft: 5 }] };

    test('por qué llevarle: riesgo, siempre está, su oficio y lo que cuesta', () => {
        const reasons = hireReasons({
            offer: { name: 'Nella Tresflechas', className: 'explorador', fee: 30, gender: 'Mujer' },
            party: [hero, nella], wage: 20, baseFee: 40, cheaperBy: 'Tessa',
        });
        expect(reasons.map(r => r.kind)).toEqual(['riesgo', 'disponible', 'oficio', 'coste']);
        expect(reasons[0].text).toMatch(/si cae, no vuelve.*mejor ella/);
        expect(reasons[1].text).toMatch(/Hoy no pueden venir: Nella \(herida\)/);
        expect(reasons[2].text).toMatch(/trampas.*Os viene justo: ahora nadie ve las trampas/);
        expect(reasons[3].text).toBe('30 de oro al contratarle (10 menos: lo consigue Tessa) y 20 cada semana. Los tuyos no cobran.');
        const fighter = hireReasons({ offer: { name: 'Gerd', className: 'guerrero', fee: 40 }, party: [hero] });
        expect(fighter[2].text).not.toMatch(/Os viene justo/);
        expect(fighter[3].text).toBe('40 de oro al contratarle. Los tuyos no cobran.');
    });

    test('tres salidas con vida hacen un veterano', () => {
        const gerd = { id: 7, name: 'Gerd el Mellado', class: 'guerrero', gender: 'Hombre', guest: { kind: 'mercenary' }, perks: [], feats: { kills: 6 } };
        let party = [hero, gerd, { ...gerd, id: 8, name: 'Caído', dead: true }];
        for (let i = 0; i < VETERAN_TRIPS; i++) party = noteTrip(party, i === 0 ? '1387' : 'La Maldición de Strahd');
        expect(readVeteran(party[1])).toMatchObject({ trips: 3, campaigns: ['1387', 'La Maldición de Strahd'], promoted: false });
        expect(readVeteran(party[2]).trips).toBe(0);
        expect(party[0].veteran).toBeUndefined();
        const due = dueVeterans(party);
        expect(due.map(m => m.name)).toEqual(['Gerd el Mellado']);
        const up = promoteVeteran(due[0], { random: () => 0, places: ['Valdés', 'Puerto Alba'], here: 'Puerto Alba', day: 10, heroName: 'Tessa' });
        expect(up.nickname).toBe('el Muro');
        expect(up.trait?.id).toBe('piel-dura');
        expect(up.patch.perks).toEqual(['piel-dura']);
        expect(up.memory).toBe('No olvido 1387 y La Maldición de Strahd, Tessa. Ni los 6 que tumbamos juntos.');
        expect(up.mission).toMatchObject({ id: 'v_7', locationName: 'Valdés', veteran: true });
        expect(up.mission.title).toMatch(/Gerd el Mellado «el Muro» quiere/);
        expect(dueVeterans([{ ...due[0], ...up.patch }])).toEqual([]);
        const scene = veteranScene({ member: { ...due[0], ...up.patch }, nickname: up.nickname, trait: up.trait, memory: up.memory, mission: up.mission });
        expect(scene.beats[0].say).toMatch(/^Tres salidas y aquí sigo.*«el Muro»/);
        expect(scene.beats.every(b => !b.note)).toBe(true);
    });
});

describe('E8.7: el templo y el modo duro', () => {
    const nella = { id: 2, name: 'Nella', dead: true, diedOn: 5, maxHp: 30, hp: 0, confidant: true };

    test('a quién se puede llevar al templo', () => {
        expect(isRaisable(nella)).toBe(true);
        expect(isRaisable({ ...nella, guest: { kind: 'mercenary' } })).toBe(false);
        expect(isRaisable({ ...nella, dead: false })).toBe(false);
    });

    test('alzar a los muertos hasta 10 días, resurrección después; los diamantes vuestros primero', () => {
        const party = [{ id: 1, items: [{ id: 'd1', name: 'Diamante', price: 300 }] }, nella];
        const raise = raiseOffer({ member: nella, today: 8, purse: 500, party });
        expect(raise.spell?.id).toBe('alzar');
        expect(raise.diamonds).toHaveLength(1);
        expect(raise.gold).toBe(500 - 300 + 100);
        expect(raise.enabled).toBe(true);
        expect(raise.detail).toMatch(/Alzar a los muertos: murió hace 3 días/);
        const late = raiseOffer({ member: nella, today: 30, purse: 100, party: [] });
        expect(late.spell?.id).toBe('resurreccion');
        expect(late.gold).toBe(RAISE_SPELLS[1].diamond + RAISE_SPELLS[1].donation);
        expect(late.enabled).toBe(false);
        expect(late.reason).toMatch(/No llega el oro/);
        // La rebaja de un maestro del templo.
        expect(raiseOffer({ member: nella, today: 5, purse: 9999, discount: 0.25 }).gold).toBe(375 + 75);
        expect(diamondsOf([{ id: 1, items: [{ id: 'x', name: 'Diamante', quantity: 2 }] }])).toHaveLength(2);
    });

    test('con el modo duro, no vuelve; un mercenario, nunca', () => {
        const hard = raiseOffer({ member: nella, today: 6, purse: 9999, hard: true });
        expect(hard.enabled).toBe(false);
        expect(hard.reason).toMatch(/Modo duro: Nella no vuelve/);
        expect(raiseOffer({ member: { ...nella, guest: { kind: 'mercenary' } }, today: 6, purse: 9999 }).reason).toMatch(/venía por la paga/);
    });

    test('vuelve débil, con una secuela que no tenía, y lo cuentan quienes están', () => {
        const scar = raiseScar({ injuries: [{ id: 'vuelta-frio' }] }, () => 0);
        expect(scar.id).not.toBe('vuelta-frio');
        expect(scar.days).toBe(0);
        expect(raisedWeakness().days).toBe(4);
        expect(raisedBasics(nella, RAISE_SPELLS[0])).toMatchObject({ dead: false, hp: 1 });
        expect(raisedBasics(nella, RAISE_SPELLS[1]).hp).toBe(30);
        const scene = raiseScene({ member: nella, spell: RAISE_SPELLS[0], scar, priest: 'Madre Elvira', hero: 'Tessa' });
        expect(scene.beats.map(b => b.who)).toEqual(['Madre Elvira', 'Nella', 'Madre Elvira']);
        expect(scene.beats.every(b => !b.note)).toBe(true);
    });

    test('un confidente muere como cualquiera; sin modo duro, se le puede devolver la vida', () => {
        const fall = resolveFall({ name: 'Nella', motive: 'bond', confidant: true }, { roll: () => 0.5 });
        expect(fall).toMatchObject({ outcome: 'dies', revivable: true });
        expect(fall.reason).toMatch(/En un templo/);
        expect(resolveFall({ name: 'Nella', confidant: true }, { roll: () => 0.5, hard: true })).toMatchObject({ outcome: 'dies', revivable: false });
        // Quien no es confidente, como siempre: marcado, no muerto.
        expect(resolveFall({ name: 'Tessa', motive: 'bond' }, { roll: () => 0.5 }).outcome).toBe('maimed');
        expect(resolveFall({ name: 'Brand', motive: 'coin' }, { roll: () => 0.5 }).revivable).toBe(false);
    });

    test('quien vuelve sale de los caídos del Salón', () => {
        const hall = addToHall([], { name: 'Nella', world: 'Gremio', day: 5, epitaph: 'Nella cayó.', when: '' });
        expect(withoutFallen(hall, { name: 'Nella', world: 'Gremio' })).toEqual([]);
        expect(withoutFallen(hall, { name: 'Nella', world: 'Otro' })).toHaveLength(1);
    });
});

describe('E8.7: la opción «Modo duro»', () => {
    beforeEach(() => {
        const store = new Map();
        globalThis.localStorage = /** @type {any} */ ({
            getItem: (/** @type {string} */ k) => store.get(k) ?? null,
            setItem: (/** @type {string} */ k, /** @type {string} */ v) => store.set(k, v),
        });
    });

    test('apagada de salida; se enciende y se apaga', () => {
        expect(readHardMode(null)).toBe(false);
        expect(hardModeOn()).toBe(false);
        expect(toggleHardMode()).toBe(true);
        expect(globalThis.localStorage.getItem(HARD_MODE_KEY)).toBe('on');
        expect(hardModeRow().value).toBe('Sí');
        expect(toggleHardMode()).toBe(false);
    });

    test('la letra «De hierro» sigue contando como dura', () => {
        expect(hardDeath({ option: true })).toEqual({ hard: true, name: 'Modo duro' });
        expect(hardDeath({ iron: true })).toEqual({ hard: true, name: 'Modo de hierro' });
        expect(hardDeath({})).toEqual({ hard: false, name: '' });
    });

    test('va detrás del romance en la ventana de opciones', () => {
        const rows = withHardModeRow([{ id: 'sucesos' }, { id: 'romance' }, { id: 'size' }]);
        expect(rows.map(r => r.id)).toEqual(['sucesos', 'romance', 'hard', 'size']);
    });

    test('la derrota lo dice con su nombre, y sin él recuerda el templo', () => {
        const dead = { id: '2', name: 'Nella', hp: 0, maxHp: 30, dead: true, confidant: true };
        const alive = { id: '1', name: 'Tessa', hp: 4, maxHp: 30 };
        const hard = outcomeView({ kind: 'defeat', hard: true, hardName: 'Modo duro', members: [alive, dead] });
        expect(hard.hardNote).toBe('Modo duro: quien muere no vuelve, tampoco un confidente.');
        expect(hard.note.text).not.toMatch(/templo/);
        const soft = outcomeView({ kind: 'defeat', members: [alive, dead] });
        expect(soft.hardNote).toBe('');
        expect(soft.note.text).toMatch(/En el templo se puede devolver la vida a Nella, pagando/);
    });
});
