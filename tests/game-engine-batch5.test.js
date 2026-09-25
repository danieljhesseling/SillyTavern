import { describe, test, expect } from '@jest/globals';
import { recordManeuver, startTurn, attackEdge, canHide, hideDC, isHidden, revealHidden, judgeManeuvers } from '../public/scripts/game-engine/combat/maneuvers.js';
import { throwablesOf, judgeThrows, burningPuddle, THROWABLES } from '../public/scripts/game-engine/combat/throwables.js';
import { buildTracker } from '../public/scripts/game-engine/combat/initiative-tracker.js';
import { filterLog } from '../public/scripts/game-engine/ui/combat-log.js';
import { trainingFor, TRAINING_XP } from '../public/scripts/game-engine/campaign/guild.js';
import { epitaphFor, heirloomOf, heirOf, addGrave, gravesAt, addToHall, readHall, describeHallEntry } from '../public/scripts/game-engine/campaign/legacy.js';
import { addFame, fameAt, fameNote, describeFame } from '../public/scripts/game-engine/campaign/fame.js';
import { priceToday, weeklyStock, junkOf } from '../public/scripts/game-engine/campaign/shop.js';
import { roadStop, ROAD_CHANCE, STOPS } from '../public/scripts/game-engine/world/road.js';
import { warPressure, WAR_PRICE } from '../public/scripts/game-engine/campaign/economy.js';
import { readPlot, startPlot, plotEvent, focusOf, describeFocus, visibleOpen, secretsOf, omensOf } from '../public/scripts/game-engine/campaign/plot.js';
import { boundOf, lootable, relicsFor, describeRelic } from '../public/scripts/game-engine/campaign/relics.js';
import { dressLoot, curseInjury, identify, liftCurse, canTakeOff, templeWork, shownName, LOOT_ODDS } from '../public/scripts/game-engine/campaign/item-lore.js';
import { borrow, repay, LOAN } from '../public/scripts/game-engine/campaign/patronage.js';
import { findContradictions } from '../public/scripts/game-engine/ui/contradiction-log.js';
import { rollLine, damageLine } from '../public/scripts/game-engine/rules/roll-line.js';
import { arrivalLines } from '../public/scripts/game-engine/campaign/recruit.js';
import { serviceActions } from '../public/scripts/game-engine/campaign/services.js';
import { buildPackEntries } from '../public/scripts/game-engine/campaign/campaign-importer.js';
import { planLongRest, planShortRest } from '../public/scripts/game-engine/rules/rest.js';

/** Un azar que va dando lo que se le pide, en orden. */
const seq = (/** @type {number[]} */ values) => { let i = 0; return () => values[i++ % values.length]; };

describe('combate', () => {
    test('11: esconderse pide algo delante de cada uno que mira', () => {
        expect(canHide([{ name: 'Lobo', cover: 2 }, { name: 'Orco', cover: 5 }]).ok).toBe(true);
        expect(canHide([{ name: 'Lobo', cover: 2 }, { name: 'Orco', cover: 0 }])).toMatchObject({ ok: false, reason: expect.stringMatching(/Orco te ve/) });
        expect(canHide([]).ok).toBe(false);
        expect(hideDC([{ wisdom: 14 }, { wisdom: 8 }])).toBe(12);
        const list = judgeManeuvers({ hasAction: true, enemies: [], hide: { ok: false, reason: 'Nada delante.' } });
        expect(list.find(m => m.id === 'esconderse')).toMatchObject({ enabled: false, detail: 'Nada delante.' });
    });

    test('11: escondido, el próximo ataque va con ventaja; aguanta un turno y se gasta al atacar', () => {
        let state = recordManeuver(null, 'esconderse', '1');
        expect(isHidden(state, '1')).toBe(true);
        state = startTurn(state, '1');
        expect(isHidden(state, '1')).toBe(true);
        const edge = attackEdge({ targetId: 'g', distanceFeet: 5, maneuvers: state, byParty: true, attackerId: '1' });
        expect(edge).toMatchObject({ mode: 'advantage', usesHidden: true });
        expect(attackEdge({ targetId: '1', distanceFeet: 5, maneuvers: state }).mode).toBe('disadvantage');
        expect(isHidden(revealHidden(state, '1'), '1')).toBe(false);
        expect(isHidden(startTurn(state, '1'), '1')).toBe(false);
    });

    test('122: la red sujeta, y a quien está sujeto se le pega mejor', () => {
        expect(attackEdge({ targetId: 'g', targetConditions: ['Restrained'], distanceFeet: 5 }).mode).toBe('advantage');
        expect(attackEdge({ targetId: 'g', attackerConditions: ['Restrained'], distanceFeet: 5 }).mode).toBe('disadvantage');
    });

    test('122: lo que se lanza, a quién llega y lo que deja el aceite', () => {
        const member = { items: [{ id: 'a', name: 'Frasco de aceite', uses: 1 }, { id: 'b', name: 'Frasco de aceite' }, { id: 'r', name: 'Red' }] };
        expect(throwablesOf(member)).toEqual([{ kind: 'aceite', itemId: 'a', count: 2 }, { kind: 'red', itemId: 'r', count: 1 }]);
        const buttons = judgeThrows({ member, hasAction: true, enemies: [{ id: 'g', name: 'Goblin', distanceFeet: 20 }] });
        expect(buttons.map(b => [b.id, b.enabled])).toEqual([['lanzar:aceite', true], ['lanzar:red', false]]);
        expect(buttons[1].detail).toMatch(/15 pies/);
        expect(judgeThrows({ member, hasAction: false, enemies: [] }).every(b => !b.enabled)).toBe(true);
        expect(burningPuddle({ x: 3, y: 4, round: 2 })).toMatchObject({ x: 3, y: 4, trigger: 'enter', effect: 'damage', seen: true, once: true });
        expect(THROWABLES.red.condition).toBe('Restrained');
    });

    test('5: la barra de iniciativa trae la cara de cada uno', () => {
        const tracker = buildTracker({
            turnOrder: [{ id: '1', name: 'Bran', initiative: 15 }, { id: 'g', name: 'Lobo', initiative: 10, isEnemy: true }],
            currentTurnIndex: 0,
            party: [{ id: '1', name: 'Bran', hp: 10, maxHp: 10, avatar: 'bran.png' }],
            enemies: [{ instanceId: 'g', name: 'Lobo', currentHp: 5, maxHp: 5 }],
        });
        expect(tracker.entries.map(e => e.avatar)).toEqual(['bran.png', '']);
    });

    test('20: el registro se filtra por clase de línea y por persona', () => {
        const entries = [
            { kind: 'round', text: 'Ronda 1' },
            { kind: 'attack', text: 'Bran ataca a Lobo.' },
            { kind: 'hit', text: 'Tirada', actor: 'Bran ataca', roll: { formula: '1d20', rolls: [], total: 15, natural: 12, dc: 12 } },
            { kind: 'damage', text: 'Lobo muerde a Aldara: 4 de daño.' },
            { kind: 'info', text: 'Aldara se mueve.' },
        ];
        expect(filterLog(entries, { kind: 'rolls' })).toHaveLength(1);
        expect(filterLog(entries, { kind: 'damage', who: 'Aldara' }).map(e => e.text)).toEqual(['Lobo muerde a Aldara: 4 de daño.']);
        expect(filterLog(entries, { who: 'Bran' })).toHaveLength(2);
        expect(filterLog(entries, {})).toHaveLength(5);
    });

    test('146: todas las tiradas se dicen igual', () => {
        expect(rollLine({ what: 'Persuasión', who: 'Bran', total: 15, against: 12, success: true, verdict: 'Éxito', natural: 12, modifier: 3 }))
            .toBe('🎲 Persuasión de Bran: 15 contra CD 12 ✓ Éxito (d20 12 +3)');
        expect(rollLine({ what: 'Ataque', who: 'Bran', at: 'Lobo', total: 9, against: 14, label: 'CA', success: false, natural: 10, modifier: -1, extra: '· con ventaja (x)' }))
            .toBe('🎲 Ataque de Bran a Lobo: 9 contra CA 14 ✗ (d20 10 -1 · con ventaja (x))');
        expect(damageLine({ total: 11, formula: '1d8', rolled: 5, modifier: 3, crit: 3 })).toBe('💥 Daño: 11 (1d8 5 crítico +3 +3)');
    });
});

describe('el grupo', () => {
    test('37: el maestro de armas enseña a quien va por detrás', () => {
        const party = [{ id: 1, name: 'Hero', level: 3 }, { id: 2, name: 'Bran', level: 2 }, { id: 3, name: 'Muerto', level: 1, dead: true }];
        expect(trainingFor({ staff: [] }, party)).toEqual([]);
        expect(trainingFor({ staff: [{ name: 'Viejo', role: 'maestro' }] }, party)).toEqual([{ id: '2', name: 'Bran', xp: TRAINING_XP }]);
    });

    test('36: epitafio, herencia y tumba', () => {
        const bran = {
            id: 2, name: 'Bran', nickname: 'el Tuerto', level: 3, charClass: 'guerrero', feats: { kills: 4, rescues: 1 },
            items: [{ id: 's', name: 'Espada', category: 'weapon', subcategory: 'martial_melee' }, { id: 'p', name: 'Poción', consumable: true }],
            equippedItems: { weapon: 's' },
        };
        const line = epitaphFor(bran, { day: 12, place: 'El Peaje Norte' });
        expect(line).toBe('Bran «el Tuerto», guerrero de nivel 3. Cayó en El Peaje Norte el día 12. Tumbó a 4 enemigos, se puso delante de los suyos 1 vez.');
        expect(heirloomOf(bran)?.id).toBe('s');
        const hero = { id: 1, name: 'Hero', hp: 5 };
        const aldara = { id: 3, name: 'Aldara', hp: 5 };
        expect(heirOf({ dead: bran, party: [hero, bran, aldara] })).toBe(hero);
        expect(heirOf({ dead: hero, party: [hero, bran, aldara], bondRanks: { 2: 1, 3: 4 } })).toBe(aldara);
        const graves = addGrave(addGrave(null, { name: 'Bran', place: 'El Peaje Norte', day: 12, epitaph: line }), { name: 'Bran', place: 'x', day: 1, epitaph: '' });
        expect(graves).toHaveLength(1);
        expect(gravesAt(graves, 'el peaje norte')).toHaveLength(1);
    });

    test('36: quien ha muerto no se levanta al descansar', () => {
        const party = [{ id: 1, name: 'Hero', hp: 0, maxHp: 10 }, { id: 2, name: 'Bran', hp: 0, maxHp: 10, dead: true }];
        expect(planLongRest({ party }).entries.map(e => [e.name, e.hpAfter])).toEqual([['Hero', 1]]);
        expect(planShortRest({ party, rollDie: () => 4 }).entries.map(e => e.name)).toEqual(['Hero']);
    });

    test('199: el salón de la fama, el más reciente arriba y sin repetir', () => {
        let hall = addToHall(null, { name: 'Bran', world: '1387', day: 12, epitaph: 'Bran, guerrero.', when: '2026-09-24T10:00:00Z' });
        hall = addToHall(hall, { name: 'Aldara', world: '1387', day: 20, epitaph: 'Aldara.', when: '' });
        hall = addToHall(hall, { name: 'Bran', world: '1387', day: 12, epitaph: 'Bran, guerrero.', when: '' });
        expect(readHall(hall).map(e => e.name)).toEqual(['Bran', 'Aldara']);
        expect(describeHallEntry(readHall(hall)[1])).toBe('Aldara. (1387)');
    });

    test('45: cada confidente dice lo suyo al llegar, una vez', () => {
        const entries = { 7: { uid: 7, dndData: { arrivals: [{ place: 'El Peaje Norte', line: 'Por aquí salió mi hijo.' }] } } };
        const party = [{ name: 'Hero' }, { name: 'Bran', wiUid: 7 }];
        const first = arrivalLines({ party, entries, place: 'el peaje norte' });
        expect(first).toEqual([{ key: '7:el peaje norte', name: 'Bran', line: 'Por aquí salió mi hijo.' }]);
        expect(arrivalLines({ party, entries, place: 'El Peaje Norte', heard: [first[0].key] })).toEqual([]);
        expect(arrivalLines({ party, entries, place: 'Castillo' })).toEqual([]);
        // Quien se une las lleva consigo, aunque su ficha ya no esté entre los reclutables.
        const joined = [{ name: 'Aldara', wiUid: 9, arrivals: [{ place: 'El Lago', line: 'El hielo escucha.' }] }];
        expect(arrivalLines({ party: joined, entries: {}, place: 'El Lago' })).toEqual([{ key: '9:el lago', name: 'Aldara', line: 'El hielo escucha.' }]);
    });

    test('45: el importador guarda lo que dicen al llegar', () => {
        const entries = buildPackEntries({ confidants: [{ name: 'Bran', arrivals: [{ place: 'El Peaje Norte', line: 'Hola.' }, { place: '', line: 'x' }] }], npcs: [], locations: [], bestiary: [], items: [], boards: [], quests: [], world: { factions: [], loreEntries: [] } });
        expect(entries[0].dndData.arrivals).toEqual([{ place: 'El Peaje Norte', line: 'Hola.' }]);
    });
});

describe('el mundo', () => {
    test('52: la fama, peldaño a peldaño, y lo que rebaja', () => {
        let out = addFame(null, 'El Pueblo', 1);
        expect(out.rose).toBe(false);
        out = addFame(out.fame, 'el pueblo', 1);
        expect(out).toMatchObject({ rose: true, label: 'os conocen' });
        expect(fameAt(out.fame, 'El Pueblo')).toMatchObject({ points: 2, level: 1, discount: 0.05 });
        expect(fameNote(out.fame, 'El Pueblo')).toMatch(/En El Pueblo os conocen/);
        expect(fameNote(out.fame, 'Otro')).toBe('');
        expect(describeFame(out.fame)).toEqual(['El Pueblo: os conocen']);
        expect(priceToday({ base: 100, fame: { discount: 0.1, label: 'sois alguien' } })).toEqual({ price: 90, reasons: ['−10 %: aquí sois alguien'] });
    });

    test('71: una parada del camino, con el azar del viaje', () => {
        expect(roadStop({ days: 1, random: seq([0.99]) })).toBeNull();
        const stop = roadStop({ days: 2, random: seq([0.1, 0]) });
        expect(stop).toMatchObject({ id: Object.keys(STOPS)[0], relieve: ['drank'] });
        expect(ROAD_CHANCE.stop).toBeGreaterThan(0);
    });

    test('84: con una guerra en marcha, el acero sube; más donde manda quien la hace', () => {
        const factions = [{ name: 'Keller', seat: 'El Campamento', holds: ['El Peaje'], goal: { kind: 'conquistar', at: 1, of: 4 } }];
        expect(warPressure({ here: 'El Pueblo', factions })).toMatchObject({ steel: WAR_PRICE.anywhere, reasons: [expect.stringMatching(/en guerra/)] });
        expect(warPressure({ here: 'El Peaje', factions }).steel).toBe(WAR_PRICE.here);
        expect(warPressure({ here: 'El Pueblo', factions: [{ name: 'Otros', goal: { kind: 'encontrar' } }] })).toEqual({ steel: 1, reasons: [] });
    });

    test('125: pedir prestado y devolverlo', () => {
        const lent = borrow({ amount: 50, today: 3, here: 'El Pueblo' });
        expect(lent.debt).toMatchObject({ amount: 50, owed: Math.ceil(50 * (1 + LOAN.interest)), dueDay: 3 + LOAN.days, patronName: 'El prestamista de El Pueblo' });
        expect(borrow({ amount: 50, today: 3, here: 'x', debt: lent.debt }).debt).toBeNull();
        expect(repay(lent.debt, 10)).toMatchObject({ ok: false });
        expect(repay(lent.debt, 100)).toMatchObject({ ok: true, pay: lent.debt?.owed });
        expect(repay({ ...lent.debt, contractId: 'favor' }, 100).ok).toBe(false);
    });
});

describe('el hilo', () => {
    const plot = readPlot({
        milestones: [
            { id: 'a', title: 'Empezar', opens: { kind: 'start' }, asks: { kind: 'arrive', place: 'Castillo' } },
            { id: 'espia', title: 'El espía', hint: 'No debe escapar.', opens: { kind: 'after', milestone: 'a' }, asks: { kind: 'defeat', enemy: 'Sombra' }, within: 3, late: { open: ['b'], standing: { vane: -2 } } },
            { id: 'b', title: 'El asalto', opens: { kind: 'after', milestone: 'espia' }, asks: { kind: 'win' } },
            { id: 'secreto', title: 'El hielo', opens: { kind: 'start' }, asks: { kind: 'arrive', place: 'Lago' }, hidden: true },
        ],
        omens: [{ text: 'El hierro bajará.', milestone: 'a' }, { text: 'Roto', milestone: 'no-existe' }],
    });

    test('111: lo oculto no se ve hasta que se cumple', () => {
        const start = startPlot(/** @type {any} */ (plot), 1);
        expect(start.state.open).toEqual(['a', 'secreto']);
        expect(visibleOpen(plot, start.state).map(m => m.id)).toEqual(['a']);
        expect(focusOf(plot, start.state)?.id).toBe('a');
        const found = plotEvent(plot, start.state, { kind: 'arrive', place: 'Lago' }, 2);
        expect(found.done.map(m => m.id)).toEqual(['secreto']);
        expect(secretsOf(plot, found.state)).toEqual({ found: ['El hielo'], total: 1 });
    });

    test('114: el presagio se cumple con su hito', () => {
        expect(plot?.omens).toEqual([{ text: 'El hierro bajará.', milestone: 'a' }]);
        const start = startPlot(/** @type {any} */ (plot), 1);
        const step = plotEvent(plot, start.state, { kind: 'arrive', place: 'Castillo' }, 2);
        expect(step.omens).toEqual(['El hierro bajará.']);
        expect(omensOf(plot, step.state)).toEqual([{ text: 'El hierro bajará.', fulfilled: true }]);
    });

    test('106: el plazo se dice, y si pasa, se pierde y abre lo siguiente', () => {
        const start = startPlot(/** @type {any} */ (plot), 1);
        const opened = plotEvent(plot, start.state, { kind: 'arrive', place: 'Castillo' }, 4);
        expect(opened.state.since.espia).toBe(4);
        const focus = focusOf(plot, opened.state, 5);
        expect(focus?.daysLeft).toBe(2);
        expect(describeFocus(focus)).toBe('El espía — No debe escapar. · quedan 2 día(s)');
        expect(plotEvent(plot, opened.state, { kind: 'day', day: 7 }).missed).toEqual([]);
        const late = plotEvent(plot, opened.state, { kind: 'day', day: 8 });
        expect(late.missed.map(m => m.id)).toEqual(['espia']);
        expect(late.state.open).toContain('b');
        expect(late.state.missed).toEqual(['espia']);
        expect(late.changes.standing).toEqual({ vane: -2 });
    });
});

describe('los objetos', () => {
    const catalogue = [
        { name: 'Cáliz', rarity: 'Very Rare', description: 'Pesa.', boundTo: { kind: 'milestone', id: 'a' } },
        { name: 'Cota', boundTo: { kind: 'contract', id: 'e-1' } },
        { name: 'Espada de leva' },
    ];

    test('132: las reliquias no caen como botín, llegan con su hito o su encargo, una vez', () => {
        expect(boundOf(catalogue[0])).toEqual({ kind: 'milestone', id: 'a' });
        expect(lootable(catalogue).map(i => i.name)).toEqual(['Espada de leva']);
        expect(relicsFor(catalogue, { kind: 'milestone', id: 'a' }).map(i => i.name)).toEqual(['Cáliz']);
        expect(relicsFor(catalogue, { kind: 'milestone', id: 'a' }, ['cáliz'])).toEqual([]);
        expect(relicsFor(catalogue, { kind: 'contract', id: 'E-1' }).map(i => i.name)).toEqual(['Cota']);
        expect(describeRelic(catalogue[0])).toBe('«Cáliz»: Pesa.');
    });

    test('119: lo que cae de poco común para arriba trae historia; lo común, no', () => {
        const lore = { owner: 'Brunilda', place: 'El Peaje', random: seq([0, 0.99]) };
        expect(dressLoot({ name: 'Daga', rarity: 'Common' }, lore)).toEqual({ name: 'Daga', rarity: 'Common' });
        const ring = dressLoot({ name: 'Anillo', rarity: 'Rare', description: 'Brilla.', slot: 'ring' }, lore);
        expect(ring.description).toBe('Brilla. Fue de Brunilda, que cayó con ello en la mano en El Peaje.');
        expect(ring).toMatchObject({ identified: false });
        expect(ring.cursed).toBeUndefined();
        expect(shownName(ring)).toBe('Anillo (sin identificar)');
    });

    test('135: lo maldito resta como una herida, no se suelta, y el templo lo mira y lo quita', () => {
        const before = LOOT_ODDS.curse;
        LOOT_ODDS.curse = 1;
        const sword = { ...dressLoot({ id: 's', name: 'Espada', rarity: 'Uncommon', slot: 'weapon' }, { owner: 'X', place: 'Y', random: seq([0, 0, 0]) }) };
        LOOT_ODDS.curse = before;
        expect(sword).toMatchObject({ cursed: true, curse: { id: 'torpeza', stat: 'dexterity' } });
        expect(canTakeOff(sword).ok).toBe(false);
        const member = { id: 1, items: [sword], equippedItems: { weapon: 's' } };
        expect(curseInjury(member)).toMatchObject({ id: 'curse', modifiers: { dexterity: -2 }, days: 0, permanent: true });
        expect(curseInjury({ ...member, equippedItems: {} })).toBeNull();
        expect(templeWork([member]).unknown).toHaveLength(1);
        const seen = identify(sword);
        expect(seen.line).toMatch(/Maldición de la torpeza/);
        expect(templeWork([{ ...member, items: [seen.item] }]).cursed).toHaveLength(1);
        const clean = liftCurse(seen.item);
        expect(clean).toMatchObject({ cursed: false, identified: true });
        expect(clean.curse).toBeUndefined();
        expect(canTakeOff(clean).ok).toBe(true);
    });

    test('122 y 125: el aceite y la red siempre están; lo que se gasta y las reliquias no son chatarra', () => {
        const stock = weeklyStock({ names: ['A', 'B', 'C', 'D', 'E'], describe: () => ({ category: 'gear' }), random: seq([0]), always: ['Red'] });
        expect(stock[0]).toBe('Red');
        expect(stock).toHaveLength(5);
        const member = { id: 1, items: [{ id: 'r', name: 'Red', consumable: true }, { id: 'c', name: 'Cáliz', relic: true }, { id: 'd', name: 'Daga' }] };
        expect(junkOf([member]).map(j => j.name)).toEqual(['Daga']);
    });

    test('135: el templo ofrece mirar y quitar, con su precio', () => {
        const cards = serviceActions({ location: { services: ['templo'] }, purse: 100, partySize: 2, relics: { unknown: 2, cursed: 1, identify: 5, lift: 40 } });
        const ids = cards[0].actions.map(a => [a.id, a.cost]);
        expect(ids).toEqual([['temple-identify', 10], ['temple-lift', 40]]);
    });
});

describe('el chat', () => {
    test('141: un muerto que habla se ve; recordarlo, no', () => {
        const dead = [{ name: 'Bran', day: 12 }];
        const found = findContradictions('Bran se acerca al fuego y dice: «Vamos».', { dead });
        expect(found.map(f => f.kind)).toEqual(['muerto que habla']);
        expect(found[0].message).toBe('La narración hace hablar a Bran, que murió el día 12.');
        expect(findContradictions('—Vamos —respondió Bran.', { dead })).toHaveLength(1);
        expect(findContradictions('Recuerdas lo que Bran dijo antes de morir.', { dead })).toEqual([]);
        expect(findContradictions('Aldara dice que no.', { dead })).toEqual([]);
    });
});
