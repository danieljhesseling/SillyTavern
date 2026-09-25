import { describe, test, expect } from '@jest/globals';
import { noteOutcome, shouldSoften, softenEnemy, readSafety } from '../public/scripts/game-engine/campaign/safety-net.js';
import { judgeDepartures, describeWarning, describeLeaving } from '../public/scripts/game-engine/campaign/departures.js';
import { talkPairs, campTalkPrompt, makePeace, roundPrompt, topicHits } from '../public/scripts/game-engine/campaign/camp-talk.js';
import { familyOf, nextTreeSteps, describeTree, TREE_NODES } from '../public/scripts/game-engine/rules/class-trees.js';
import { stairsOf, stairsReached, nextLevel, withStairs, levelName } from '../public/scripts/game-engine/board/dungeon-levels.js';
import { rivalOf, rivalsTake, describeRivalTake } from '../public/scripts/game-engine/campaign/rivals.js';
import { stealDC, stealOutcome, guardsAt, settleGuards, coolDown } from '../public/scripts/game-engine/campaign/crime.js';
import { guestMember, hirelingsHere, guestsLeave, wardLost, exitCell } from '../public/scripts/game-engine/campaign/guests.js';
import { readVillain, villainScenesDue, villainNote } from '../public/scripts/game-engine/campaign/villain.js';
import { store, retrieve, STORAGE_SLOTS } from '../public/scripts/game-engine/campaign/storage.js';
import { seaLeg, seaLegs, fareFor, sailingDays, describeVoyage } from '../public/scripts/game-engine/world/ships.js';
import { shiftAttitude, attitudeBonus, describeAttitude } from '../public/scripts/game-engine/campaign/attitudes.js';
import { summarizeAct, hideRange, addSummary, readSummaries, KEEP_TAIL } from '../public/scripts/game-engine/campaign/act-summary.js';
import { previewOf, describePreview } from '../public/scripts/game-engine/campaign/world-preview.js';
import { columnsOf, moveMilestone, editMilestone, edgesOf } from '../public/scripts/game-engine/campaign/plot-graph.js';
import { listVeterans, veteranHero, VETERAN_MAX_LEVEL } from '../public/scripts/game-engine/campaign/veterans.js';
import { readIllustrationSettings, promptFor, buildRequest, imageFrom } from '../public/scripts/game-engine/campaign/illustrations.js';
import { notForHero, forHero, backgroundsOf } from '../public/scripts/game-engine/campaign/hero-fit.js';
import { newPerson, newPlace } from '../public/scripts/game-engine/campaign/director.js';

const seq = (/** @type {number[]} */ values) => { let i = 0; return () => values[i++ % values.length]; };

describe('combate y compañeros', () => {
    test('25: dos derrotas seguidas y la red puesta: el siguiente baja un escalón; una victoria lo reinicia', () => {
        let state = noteOutcome(null, 'defeat');
        expect(shouldSoften(state, true)).toBe(false);
        state = noteOutcome(state, 'fled');
        expect(readSafety(state)).toEqual({ streak: 2 });
        expect(shouldSoften(state, true)).toBe(true);
        expect(shouldSoften(state, false)).toBe(false);
        expect(noteOutcome(state, 'victory')).toEqual({ streak: 0 });
        expect(softenEnemy({ maxHp: 20, currentHp: 20, armorClass: 14 })).toMatchObject({ maxHp: 15, currentHp: 15, armorClass: 13, softened: true });
    });

    test('29: quien acumula disgustos avisa primero y luego se va; el vínculo alto lo sujeta', () => {
        const party = [{ id: 'h' }, { id: 'a', name: 'Lyra' }, { id: 'b', name: 'Kael' }, { id: 'c', name: 'Bran' }, { id: 'g', name: 'Merc', guest: { kind: 'mercenary' } }];
        const scores = /** @type {Record<string, number>} */ ({ a: -2, b: -5, c: -5, g: -9 });
        const ranks = /** @type {Record<string, number>} */ ({ a: 0, b: 0, c: 3, g: 0 });
        const first = judgeDepartures({ party, approvalOf: m => scores[m.id], rankOf: m => ranks[m.id] });
        expect(first.warn.map(m => m.id)).toEqual(['a', 'b']);
        expect(first.leave).toEqual([]);
        const later = judgeDepartures({ party, approvalOf: m => scores[m.id], rankOf: m => ranks[m.id], warned: ['a', 'b'] });
        expect(later.leave.map(m => m.id)).toEqual(['b']);
        expect(describeWarning(party[1])).toMatch(/^Lyra está harto/);
        expect(describeLeaving(party[2])).toMatch(/^Kael recoge sus cosas/);
    });

    test('31: dos del grupo charlan junto al fuego, y si chocaron hoy hacen las paces', () => {
        const party = [{ id: 'h', hp: 5 }, { id: 'a', name: 'Lyra', hp: 5 }, { id: 'b', name: 'Kael', hp: 5 }, { id: 'c', name: 'X', hp: 0, dead: true }];
        expect(talkPairs(party).map(p => p.map(m => m.id))).toEqual([['a', 'b']]);
        const prompt = campTalkPrompt({ a: party[1], b: party[2], wantsOf: m => (m.id === 'a' ? 'quiet' : 'glory'), friction: 'Chocaron.' });
        expect(prompt).toMatch(/^\[CHARLA\] Junto al fuego, Lyra y Kael/);
        expect(prompt).toMatch(/Lyra busca tranquilidad; Kael, gloria/);
        const peace = makePeace({ log: [], frictions: [{ a: 'a', b: 'b', day: 3 }, { a: 'a', b: 'b', day: 2 }] }, 'b', 'a', 3);
        expect(peace.mended).toBe(true);
        expect(peace.state.frictions).toEqual([{ a: 'a', b: 'b', day: 2 }]);
    });

    test('40: la ronda tiene tema, y si toca lo que busca cuenta como escena de confidente', () => {
        expect(roundPrompt({ member: { name: 'Bran' }, topic: 'miedo', place: 'El Pueblo' })).toMatch(/que confiese lo que le quita el sueño/);
        expect(topicHits('ambicion', 'coin')).toBe(true);
        expect(topicHits('ambicion', 'quiet')).toBe(false);
    });

    test('48: cada oficio tiene tres ramas de tres, y se sube en orden', () => {
        expect(TREE_NODES).toHaveLength(45);
        expect(familyOf({ class: 'Guerrero' })).toBe('marcial');
        expect(familyOf({ class: 'Pícaro' })).toBe('astuto');
        expect(familyOf({ class: 'Nadie' })).toBe('');
        const fresh = nextTreeSteps({ class: 'guerrero', perks: [] });
        expect(fresh.map(n => n.id)).toEqual(['rama:marcial:baluarte:1', 'rama:marcial:filo:1', 'rama:marcial:mando:1']);
        const grown = nextTreeSteps({ class: 'guerrero', perks: ['rama:marcial:baluarte:1'] });
        expect(grown[0].id).toBe('rama:marcial:baluarte:2');
        expect(describeTree({ class: 'guerrero', perks: ['rama:marcial:baluarte:1', 'rama:marcial:baluarte:2'] })).toEqual(['Baluarte 2/3']);
        expect(nextTreeSteps({ class: 'nadie' })).toEqual([]);
    });
});

describe('el mundo', () => {
    test('75: una escalera lleva al nivel siguiente del mismo sitio', () => {
        const rows = withStairs(['#####', '#...#', '#...#', '#####'], { x: 1, y: 1 });
        expect(rows).toEqual(['#####', '#...#', '#..>#', '#####']);
        const terrain = { cells: { '3,2': { type: 'stairs' } } };
        expect(stairsOf(terrain)).toEqual([{ x: 3, y: 2 }]);
        expect(stairsReached(terrain, [{ x: 2, y: 1 }])).toEqual({ x: 3, y: 2 });
        expect(stairsReached(terrain, [{ x: 0, y: 0 }])).toBeNull();
        const boards = [{ name: 'Arriba', next: 'Arriba (nivel 2)' }, { name: 'Arriba (nivel 2)' }];
        expect(nextLevel(boards[0], boards)?.name).toBe('Arriba (nivel 2)');
        expect(nextLevel(boards[1], boards)).toBeNull();
        expect(levelName('Arriba')).toBe('Arriba (nivel 2)');
    });

    test('94: una compañía rival se lleva el mejor pagado de lo generado, nunca lo tuyo', () => {
        const rival = rivalOf(seq([0, 0, 0]));
        expect(rival).toEqual({ name: 'Los Cuervos Grises', leader: 'Mara la Tuerta' });
        const board = [{ id: 'a', reward: 50 }, { id: 'b', reward: 90, personal: 'x' }, { id: 'c', reward: 80 }, { id: 'd', reward: 200, written: true }];
        const took = rivalsTake(board);
        expect(took.taken?.id).toBe('c');
        expect(took.board.map(c => c.id)).toEqual(['a', 'b', 'd']);
        expect(rivalsTake([{ id: 'x', named: true }]).taken).toBeNull();
        expect(describeRivalTake(rival, { title: 'X' })).toMatch(/^Los Cuervos Grises \(los de Mara la Tuerta\) se os adelantan/);
    });

    test('96: robar: si os pillan, multa y os apuntan; con dos, os paran al llegar; pagar limpia', () => {
        expect(stealDC('city')).toBe(16);
        expect(stealOutcome({ success: true, price: 10, place: 'P', wanted: {} })).toMatchObject({ free: true, fine: 0 });
        const caught = stealOutcome({ success: false, price: 10, place: 'P', wanted: { P: 1 } });
        expect(caught).toMatchObject({ free: false, fine: 20, wanted: { P: 2 } });
        expect(guardsAt(caught.wanted, 'P')).toEqual({ stop: true, level: 2, fine: 30 });
        expect(guardsAt({}, 'P').stop).toBe(false);
        expect(settleGuards(caught.wanted, 'P', 'pay')).toEqual({});
        expect(settleGuards(caught.wanted, 'P', 'flee')).toEqual({ P: 3 });
        expect(coolDown({ P: 2, Q: 1 })).toEqual({ P: 1 });
    });

    test('105 y 131: quien se escolta y el mercenario van un encargo y se van con él', () => {
        const ward = guestMember({ id: 7, name: 'Tomás', kind: 'ward', contractId: 'c1', level: 2 });
        expect(ward).toMatchObject({ hp: 12, guest: { kind: 'ward', contractId: 'c1' } });
        const merc = guestMember({ id: 8, name: 'Gerd', kind: 'mercenary', contractId: 'c1', level: 2, stats: { strength: 15 } });
        expect(merc).toMatchObject({ hp: 22, strength: 15 });
        expect(hirelingsHere(seq([0]), 2)[0]).toMatchObject({ name: 'Gerd el Mellado', fee: 80 });
        const party = [{ id: 1 }, ward, merc, { id: 9, guest: { kind: 'ward', contractId: 'otro' } }];
        expect(guestsLeave(party, 'c1').party.map(m => m.id)).toEqual([1, 9]);
        expect(wardLost(party, 'c1')).toBeNull();
        expect(wardLost([{ ...ward, hp: 0 }], 'c1')?.name).toBe('Tomás');
        expect(exitCell(['#####', '#...#', '#####'], { x: 1, y: 1 })).toEqual({ x: 3, y: 1 });
    });

    test('115: el villano asoma al empezar su acto o al cumplirse su hito, una vez cada escena', () => {
        const villain = readVillain({ name: 'Keller', appears: [{ act: 2, scene: 'Os mira.' }, { milestone: 'm3', scene: 'Os señala.' }, { act: 3 }] });
        expect(villain?.appears).toHaveLength(2);
        expect(villainScenesDue({ villain, act: 1, done: [], seen: [] })).toEqual([]);
        expect(villainScenesDue({ villain, act: 2, done: ['m3'], seen: [] }).map(s => s.id)).toEqual(['v1', 'v2']);
        expect(villainScenesDue({ villain, act: 2, done: ['m3'], seen: ['v1'] }).map(s => s.id)).toEqual(['v2']);
        expect(villainNote(/** @type {any} */ (villain), 'Os mira.')).toMatch(/^\[VILLANO\] Keller se deja ver: Os mira\./);
        expect(readVillain({})).toBeNull();
    });

    test('124: en el almacén se guarda y se saca; lo puesto y lo maldito no', () => {
        const member = { name: 'W', items: [{ id: 'a', name: 'Piel' }, { id: 'b', name: 'Espada' }, { id: 'c', name: 'Anillo', cursed: true }], equippedItems: { weapon: 'b' } };
        const kept = store(member, [], 'a');
        expect(kept.ok).toBe(true);
        expect(kept.storage.map(i => i.id)).toEqual(['a']);
        expect(store(member, [], 'b').reason).toMatch(/puesto/);
        expect(store(member, [], 'c').reason).toMatch(/maldito/);
        const back = retrieve({ ...member, items: kept.items }, kept.storage, 'a');
        expect(back.items.map(i => i.id)).toEqual(['b', 'c', 'a']);
        expect(STORAGE_SLOTS).toBe(30);
    });

    test('130: por mar se paga pasaje y se llega antes', () => {
        const locations = [{ name: 'Puerto', routes: [{ to: 'Isla', days: 4, sea: true }, { to: 'Monte', days: 2 }] }, { name: 'Isla' }, { name: 'Monte' }];
        expect(seaLeg(locations, 'Isla', 'Puerto')).toBe(true);
        expect(seaLeg(locations, 'Puerto', 'Monte')).toBe(false);
        expect(seaLegs(locations, 'Monte', ['Puerto', 'Isla'])).toBe(1);
        expect(fareFor({ heads: 3, days: 2 })).toBe(18);
        expect(sailingDays(4)).toBe(2);
        expect(sailingDays(1)).toBe(1);
        expect(describeVoyage({ fare: 18, days: 2 })).toMatch(/^por mar: 2 día\(s\), 18 de oro/);
    });
});

describe('el chat y el narrador', () => {
    test('140: el narrador mueve la actitud de alguien, un paso al día y dentro de los límites', () => {
        const first = shiftAttitude(null, { name: 'Giles', delta: 2, day: 3 });
        expect(first).toMatchObject({ ok: true, value: 1 });
        expect(shiftAttitude(first.state, { name: 'Giles', delta: 1, day: 3 }).reason).toMatch(/ya cambió hoy/);
        expect(shiftAttitude(first.state, { name: 'Giles', delta: 0, day: 4 }).ok).toBe(false);
        expect(attitudeBonus(first.state, 'Giles')).toBe(1);
        let state = /** @type {any} */ (null);
        for (let d = 1; d <= 5; d++) state = shiftAttitude(state, { name: 'Torres', delta: -1, day: d }).state;
        expect(attitudeBonus(state, 'Torres')).toBe(-3);
        expect(describeAttitude(-3)).toBe('hostil');
        expect(describeAttitude(2)).toBe('amistosa');
    });

    test('143: al cerrarse un acto, su resumen va a la memoria y sus mensajes salen del prompt', () => {
        expect(summarizeAct({ act: 1, milestones: ['El cáliz'], deeds: ['Huisteis del peaje.'] })).toBe('Acto 1: se cumplió El cáliz. Huisteis del peaje.');
        expect(summarizeAct({ act: 2, milestones: [], deeds: [] })).toBe('Acto 2: pasó sin nada que apuntar.');
        expect(hideRange({ from: 3, to: 40 })).toEqual({ start: 3, end: 40 - KEEP_TAIL });
        expect(hideRange({ from: 38, to: 40 })).toBeNull();
        const saved = addSummary(addSummary(null, 2, 'Dos.'), 1, 'Uno.');
        expect(readSummaries(saved).map(s => s.act)).toEqual([1, 2]);
    });
});

describe('crear mundos', () => {
    const metadata = {
        displayName: 'Mundo',
        locationMaps: [{ name: 'A', locationType: 'village', routes: [{ to: 'B', days: 2 }] }, { name: 'B', routes: [] }],
        hiddenLocations: [{ name: 'C' }],
        factions: [{ name: 'Casa', seat: 'A', goal: { kind: 'conquistar', target: 'B' } }],
        plot: { milestones: [{ id: 'm1', act: 1, title: 'Uno', opens: { kind: 'start' } }, { id: 'm2', act: 2, title: 'Dos', opens: { kind: 'after', milestone: 'm1' } }, { id: 's', act: 2, title: 'Oculto', hidden: true }] },
    };

    test('175: la vista previa enseña sitios, caminos, facciones y el hilo por actos, sin destapar secretos', () => {
        const preview = previewOf(metadata);
        expect(preview.hidden).toBe(1);
        expect(preview.acts.map(a => a.milestones.map(m => m.title))).toEqual([['Uno'], ['Dos', '(un secreto)']]);
        const lines = describePreview(preview);
        expect(lines[0]).toBe('Mundo: 2 sitio(s), y 1 escondido(s).');
        expect(lines).toContain('A (village) → B (2 d)');
        expect(lines).toContain('Casa, en A: conquistar B');
    });

    test('176: el grafo del hilo: columnas por acto, mover, editar y no romperlo', () => {
        expect(columnsOf(metadata.plot).map(c => c.milestones.length)).toEqual([1, 2, 0]);
        const moved = moveMilestone(metadata.plot, 'm2', 3);
        expect(moved.plot.milestones.find((/** @type {any} */ m) => m.id === 'm2').act).toBe(3);
        expect(editMilestone(metadata.plot, 'm2', { after: 'm2' }).reason).toMatch(/sí mismo/);
        expect(editMilestone(metadata.plot, 'm2', { after: 'nada' }).ok).toBe(false);
        expect(editMilestone(metadata.plot, 'm2', { title: '' }).ok).toBe(false);
        const edited = editMilestone(metadata.plot, 'm2', { title: 'Dos bis', after: '' });
        expect(edited.plot.milestones.find((/** @type {any} */ m) => m.id === 'm2')).toMatchObject({ title: 'Dos bis', opens: { kind: 'start' } });
        expect(edgesOf(metadata.plot)).toEqual([{ from: 'm1', to: 'm2' }]);
    });

    test('179: un héroe de otra partida entra, con lo puesto y como mucho a nivel 5; los muertos no', () => {
        const chats = [
            { world: 'Viejo', meta: { party: [{ name: 'Wendel', class: 'guerrero', level: 8, gold: 400, items: [{ id: 'w' }, { id: 'x' }], equippedItems: { weapon: 'w' } }] } },
            { world: 'Otro', meta: { party: [{ name: 'Muerto', dead: true }] } },
            { world: 'Nuevo', meta: { party: [{ name: 'Yo' }] } },
        ];
        const list = listVeterans(chats, 'Nuevo');
        expect(list.map(v => v.line)).toEqual(['Wendel, guerrero de nivel 8 (de Viejo)']);
        const hero = veteranHero(list[0].hero, 5);
        expect(hero).toMatchObject({ id: 5, level: VETERAN_MAX_LEVEL, gold: 50, equippedItems: { weapon: 'w' } });
        expect(hero.items.map((/** @type {any} */ i) => i.id)).toEqual(['w']);
    });

    test('183: la petición de ilustración, solo con clave, y la imagen que vuelve', () => {
        const settings = readIllustrationSettings({ key: 'k', size: 999 });
        expect(settings.size).toBe(128);
        expect(buildRequest(readIllustrationSettings({}), 'x')).toBeNull();
        const request = buildRequest(settings, promptFor({ kind: 'place', name: 'El Peaje', about: 'Una torre.', genre: 'fantasía' }));
        expect(request?.init.headers.Authorization).toBe('Bearer k');
        expect(JSON.parse(String(request?.init.body)).description).toMatch(/^a location, wide view, no people: El Peaje\. Una torre\./);
        expect(imageFrom({ image: { base64: 'AAA' } })).toBe('data:image/png;base64,AAA');
        expect(imageFrom({})).toBe('');
    });

    test('184: los hitos de otro trasfondo se cierran al empezar; los del tuyo se quedan', () => {
        const plot = { milestones: [{ id: 'a', title: 'Sargento', backgrounds: ['soldado'] }, { id: 'b', title: 'Archivo', background: 'erudito' }, { id: 'c', title: 'De todos' }] };
        expect(backgroundsOf(plot.milestones[1])).toEqual(['erudito']);
        expect(notForHero(plot, { background: 'soldado' })).toEqual(['b']);
        expect(forHero(plot, { background: 'soldado' })).toEqual(['Sargento']);
        expect(notForHero(plot, {})).toEqual(['a', 'b']);
    });

    test('185: el director añade a alguien o un sitio, y no deja romper el mundo', () => {
        const known = { places: ['A'], people: ['Giles'] };
        expect(newPerson({ name: 'Nuevo', where: 'A', trade: 'Herrero' }, known).entry.dndData).toMatchObject({ entityType: 'npc', name: 'Nuevo', mapPosition: { locationName: 'A' } });
        expect(newPerson({ name: 'giles', where: 'A' }, known).ok).toBe(false);
        expect(newPerson({ name: 'X', where: 'Z' }, known).ok).toBe(false);
        const place = newPlace({ name: 'Cueva', type: 'dungeon', linkTo: 'A', days: 2 }, known);
        expect(place.place).toMatchObject({ name: 'Cueva', locationType: 'dungeon', routes: [{ to: 'A', days: 2 }] });
        expect(place.route).toEqual({ to: 'Cueva', days: 2 });
        expect(newPlace({ name: 'A', type: 'x', linkTo: 'A', days: 1 }, known).ok).toBe(false);
    });
});
