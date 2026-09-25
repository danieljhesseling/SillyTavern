import { describe, test, expect } from '@jest/globals';
import { seasonOf, daysLeftInSeason, readSeasons, openInSeason, seasonClimates, describeSeasons, describeSeason, SEASON_DAYS } from '../public/scripts/game-engine/world/seasons.js';
import { canCamp, nightRisk, defaultGuards, resolveNight, campMorning, wrappedUp, NIGHT_CHANCE, WATCH_DC } from '../public/scripts/game-engine/campaign/camp.js';
import { approvalFor, approvalFromOpinions, frictionOf, describeApproval, noteApproval, frictionsOn, approvalOf } from '../public/scripts/game-engine/campaign/approval.js';
import { duePersonalQuests, personalQuestFor, describePersonalAsk, PERSONAL_RANK } from '../public/scripts/game-engine/campaign/personal-quests.js';
import { benchMember, callFromBench, whereHired, describeBench } from '../public/scripts/game-engine/campaign/bench.js';
import { respecCost, undoPerks, redoPerks, RESPEC_PRICE } from '../public/scripts/game-engine/rules/respec.js';
import { languagesOf, speaks, languageBarrier } from '../public/scripts/game-engine/rules/languages.js';
import { saveSet, applySet, readSets, MAX_SETS } from '../public/scripts/game-engine/rules/equipment-sets.js';
import { neighboursOf, fateAt, driftOf, describeFate, FATE_CHANCE } from '../public/scripts/game-engine/world/people-fate.js';
import { namedContract, hasNamed } from '../public/scripts/game-engine/campaign/named-contracts.js';
import { trophiesOf, trophyItem, materialKind, materialsOf, canCraft, cloakItem, upgradedWeapon } from '../public/scripts/game-engine/campaign/trophies.js';
import { addOffer, takeOffer, resolveOffer, offerChips, readOffers } from '../public/scripts/game-engine/campaign/item-offers.js';
import { toneNow, toneNote, nextTone, describeTone, readTone } from '../public/scripts/game-engine/campaign/scene-tone.js';
import { speakerOf, initialsOf, hueOf } from '../public/scripts/game-engine/ui/shell/speakers.js';
import { giveItem } from '../public/scripts/game-engine/rules/give-item.js';
import { makeShareCode, readShareCode, isShareCode } from '../public/scripts/game-engine/campaign/share-code.js';
import { cueForAttack, playCue, lastCues, CUES } from '../public/scripts/game-engine/ui/shell/action-sounds.js';
import { spreadFire, fireAt, flammable, FIRE } from '../public/scripts/game-engine/board/living-terrain.js';
import { terrainFromAsciiMap, getCell, breakDoor, setDoorOpen, describeCell, normalizeTerrain } from '../public/scripts/game-engine/board/terrain.js';
import { sceneryNear, judgeSceneryThrow, SCENERY } from '../public/scripts/game-engine/combat/throwables.js';
import { weaponBonus } from '../public/scripts/game-engine/rules/equipment.js';
import { routesOf, planTravel } from '../public/scripts/game-engine/world/travel.js';
import { groupMorale } from '../public/scripts/game-engine/campaign/company.js';
import { recruitActions, MAX_PARTY } from '../public/scripts/game-engine/campaign/recruit.js';
import { rollCheck } from '../public/scripts/game-engine/rules/checks.js';
import { buildClockView } from '../public/scripts/game-engine/ui/shell/clock-widget.js';

/** Un azar que va dando lo que se le pide, en orden. */
const seq = (/** @type {number[]} */ values) => { let i = 0; return () => values[i++ % values.length]; };

describe('el calendario cambia el mapa', () => {
    test('74: cuatro estaciones de dos meses, desde la que empiece la partida', () => {
        expect(SEASON_DAYS).toBe(56);
        expect(seasonOf(1)).toBe('otono');
        expect(seasonOf(56)).toBe('otono');
        expect(seasonOf(57)).toBe('invierno');
        expect(seasonOf(1, 'Invierno')).toBe('invierno');
        expect(seasonOf(57, 'invierno')).toBe('primavera');
        expect(daysLeftInSeason(1)).toBe(56);
        expect(daysLeftInSeason(56)).toBe(1);
        expect(describeSeason(45)).toBe('Otoño · quedan 12 días');
        expect(readSeasons('invierno, Otoño')).toEqual(['invierno', 'otono']);
        expect(buildClockView({ day: 3, slotLabel: 'Tarde', season: describeSeason(3) }).label).toBe('Día 3 · Tarde · Otoño · quedan 54 días');
        expect(buildClockView({ day: 3, slotLabel: 'Tarde' }).label).toBe('Día 3 · Tarde');
        expect(openInSeason(['invierno'], 'invierno')).toBe(true);
        expect(openInSeason(['invierno'], 'verano')).toBe(false);
        expect(openInSeason([], 'verano')).toBe(true);
        expect(describeSeasons(['invierno'])).toBe('solo en invierno');
        expect(describeSeasons(['invierno', 'otono'])).toBe('solo en invierno y otoño');
    });

    test('74: una ruta que solo se pasa en invierno se cierra el resto del año, y lo dice', () => {
        const locations = [
            { name: 'La Orilla', routes: [{ to: 'El Islote', days: 1, seasons: ['invierno'] }] },
            { name: 'El Islote', routes: [] },
        ];
        const winter = routesOf(locations[0], [], 'invierno');
        const summer = routesOf(locations[0], [], 'verano');
        expect(winter[0].closed).toBe(false);
        expect(summer[0].closed).toBe(true);
        expect(summer[0].note).toMatch(/solo en invierno/);
        expect(planTravel({ from: 'La Orilla', to: 'El Islote', locations, season: 'invierno' }).ok).toBe(true);
        const blocked = planTravel({ from: 'La Orilla', to: 'El Islote', locations, season: 'verano' });
        expect(blocked.ok).toBe(false);
        // Sin estación, lo de siempre: abierta.
        expect(planTravel({ from: 'La Orilla', to: 'El Islote', locations }).ok).toBe(true);
    });

    test('74: el tiempo de la estación, sin chocar con el bioma', () => {
        expect(seasonClimates(['despejado', 'lluvia', 'niebla'], 'invierno')).toEqual(['despejado', 'lluvia', 'niebla', 'nieve']);
        expect(seasonClimates(['despejado', 'bochorno', 'viento'], 'invierno')).toEqual(['despejado', 'viento']);
        expect(seasonClimates(['despejado', 'nieve'], 'verano')).toEqual(['despejado']);
        expect(seasonClimates(['nieve'], 'verano')).toEqual(['nieve']);
        expect(seasonClimates([], 'verano')).toEqual([]);
    });
});

describe('el campamento', () => {
    const wendel = { id: '1', name: 'Wendel', hp: 20, items: [] };
    const bran = { id: '2', name: 'Bran', hp: 20, items: [{ name: 'Capa de pieles' }] };
    const dead = { id: '3', name: 'Lyra', hp: 0, dead: true, items: [] };
    const perception = (/** @type {any} */ m) => (m.id === '2' ? 3 : 0);

    test('67: se acampa fuera de pueblos y ciudades, y no peleando', () => {
        expect(canCamp({ locationType: 'wilderness' }).ok).toBe(true);
        expect(canCamp({ locationType: 'village' }).reason).toMatch(/posada/);
        expect(canCamp({ locationType: 'wilderness', fighting: true }).ok).toBe(false);
    });

    test('67: el riesgo de noche: el sitio, el fuego y la tierra hostil; y la escala a cero lo quita', () => {
        expect(nightRisk({ locationType: 'wilderness' })).toBeCloseTo(0.25);
        expect(nightRisk({ locationType: 'wilderness', fire: true, hostile: true })).toBeCloseTo(0.5);
        expect(nightRisk({ locationType: 'nada' })).toBeCloseTo(0.2);
        const old = NIGHT_CHANCE.scale;
        NIGHT_CHANCE.scale = 0;
        expect(nightRisk({ locationType: 'dungeon', fire: true })).toBe(0);
        NIGHT_CHANCE.scale = old;
    });

    test('67: vigila quien mejor ve; si lo ve venir se va sin nada, y si no, roba', () => {
        expect(defaultGuards([wendel, bran, dead], perception)).toEqual(['2', '1']);
        const quiet = resolveNight({ risk: 0.3, guards: [bran], random: seq([0.9]), rollD20: () => 10, perceptionOf: perception });
        expect(quiet.came).toBe(false);
        const seen = resolveNight({ risk: 0.3, guards: [bran], random: seq([0.1]), rollD20: () => 10, perceptionOf: perception, intruder: 'Un lobo' });
        expect(seen).toMatchObject({ came: true, spotted: true, loss: null });
        expect(seen.line).toBe(`Un lobo se acerca de noche, pero Bran lo ve venir (13 contra ${WATCH_DC}): se va sin nada.`);
        const robbed = resolveNight({ risk: 0.3, guards: [], random: seq([0.1, 0.9]), rollD20: () => 10, perceptionOf: perception, purse: 100 });
        expect(robbed).toMatchObject({ came: true, spotted: false, loss: { kind: 'oro', amount: 19 } });
        expect(robbed.line).toBe('Algo entra en el campamento de noche: nadie hacía guardia. Se lleva 19 de oro.');
        const missed = resolveNight({ risk: 0.3, guards: [wendel], random: seq([0.1, 0]), rollD20: () => 2, perceptionOf: perception, purse: 30 });
        expect(missed.loss).toEqual({ kind: 'oro', amount: 5 });
        expect(missed.line).toMatch(/Wendel no lo ve venir \(2 contra 12\)/);
        const broke = resolveNight({ risk: 0.3, guards: [], random: seq([0.1, 0]), rollD20: () => 2, perceptionOf: perception });
        expect(broke.loss).toBeNull();
        expect(broke.line).toMatch(/no encuentra nada que llevarse/);
    });

    test('67: sin fuego en la nieve no se duerme, salvo con capa; y con fuego y algo que cazar se cena', () => {
        expect(wrappedUp(bran)).toBe(true);
        const cold = campMorning({ party: [wendel, bran, dead], fire: false, weather: 'nieve' });
        expect(cold.restless).toEqual(['1']);
        const warm = campMorning({ party: [wendel, bran], fire: true, weather: 'nieve', cook: true, caught: true });
        expect(warm).toMatchObject({ restless: [], fed: true });
        expect(campMorning({ party: [wendel, bran], fire: true, cook: true, caught: false }).lines).toContain('No sale nada que echar al fuego: se cena frío, y poco.');
        expect(campMorning({ party: [wendel], fire: false, cook: true, caught: true }).lines).toContain('Sin fuego no hay cena caliente.');
    });
});

describe('lo que les parece a los compañeros', () => {
    const party = [
        { id: 'h', name: 'Wendel', hp: 10 },
        { id: 'b', name: 'Bran', hp: 10, wants: 'glory' },
        { id: 'l', name: 'Lyra', hp: 10, wants: 'quiet' },
        { id: 'k', name: 'Kael', hp: 10, wants: 'knowledge' },
        { id: 'd', name: 'Muerto', hp: 0, dead: true, wants: 'glory' },
    ];
    const wantsOf = (/** @type {any} */ m) => m.wants;

    test('28: cada uno aprueba o no según lo que busca; el héroe y los muertos no opinan', () => {
        const verdicts = approvalFor({ party, decision: 'plantar-cara', wantsOf });
        expect(verdicts.map(v => [v.name, v.mood])).toEqual([['Bran', 1], ['Lyra', -1]]);
        expect(describeApproval(verdicts)).toBe('👍 Bran · 👎 Lyra');
        expect(approvalFor({ party, decision: 'nada', wantsOf })).toEqual([]);
        const opinions = approvalFromOpinions([{ member: party[3], opinion: { mood: 'like', line: 'Bien.' } }, { member: party[1], opinion: null }], wantsOf, 'aceptar «X»');
        expect(opinions).toEqual([{ id: 'k', name: 'Kael', want: 'knowledge', mood: 1, what: 'aceptar «X»' }]);
    });

    test('32: si a uno le gusta y a otro no, chocan; se apunta y pesa en la moral de hoy', () => {
        const verdicts = approvalFor({ party, decision: 'plantar-cara', wantsOf });
        expect(frictionOf(verdicts)?.line).toBe('Bran y Lyra chocan por plantar cara: uno busca gloria y el otro tranquilidad.');
        expect(frictionOf(approvalFor({ party, decision: 'interrogar', wantsOf }))).toBeNull();
        const { state, friction } = noteApproval(null, verdicts, 4);
        expect(friction).not.toBeNull();
        expect(frictionsOn(state, 4)).toBe(1);
        expect(frictionsOn(state, 5)).toBe(0);
        expect(approvalOf(state, 'l')).toEqual({ score: -1, recent: ['👎 plantar cara'] });
        expect(groupMorale({ ranks: [3, 3], hungry: 0, wounded: 0, size: 3, friction: 1 }).value).toBe(0);
        expect(groupMorale({ ranks: [3, 3], hungry: 0, wounded: 0, size: 3 }).value).toBe(1);
    });
});

describe('el grupo por dentro', () => {
    test('30: al llegar a vínculo 3 cada compañero pide lo suyo, una vez, y sale de lo que busca', () => {
        const party = [{ id: 'h', name: 'Wendel', rank: 0 }, { id: 'b', name: 'Bran', rank: PERSONAL_RANK }, { id: 'l', name: 'Lyra', rank: 1 }];
        const rank = (/** @type {any} */ m) => m.rank;
        expect(duePersonalQuests({ party, rankOf: rank, asked: [] }).map(m => m.id)).toEqual(['b']);
        expect(duePersonalQuests({ party, rankOf: rank, asked: ['b'] })).toEqual([]);
        const quest = personalQuestFor({ member: party[1], wants: 'blood', hates: 'La Casa Keller', places: ['Aquí', 'Allí'], here: 'Aquí', random: seq([0]), day: 5 });
        expect(quest).toMatchObject({ id: 'p_b', kind: 'hunt', title: 'Bran quiere hacérselo pagar a La Casa Keller en Allí', locationName: 'Allí', personal: 'b', days: 19 });
        expect(personalQuestFor({ member: party[2], wants: 'quiet', places: ['Allí'], random: seq([0]), day: 1 }).kind).toBe('escort');
        expect(describePersonalAsk(party[1], quest)).toMatch(/^Bran tiene algo que pedirte/);
    });

    test('42: se deja a alguien en casa y se le llama si hay hueco; lleno el grupo, el nuevo va a casa', () => {
        const party = [{ id: 'h', name: 'Wendel' }, { id: 'b', name: 'Bran' }];
        const benched = benchMember({ party, bench: [], id: 'b' });
        expect(benched.ok).toBe(true);
        expect(benched.party.map(m => m.id)).toEqual(['h']);
        expect(describeBench(benched.bench)).toBe('En casa: Bran.');
        expect(benchMember({ party, bench: [], id: 'h' }).ok).toBe(false);
        const called = callFromBench({ party: benched.party, bench: benched.bench, id: 'b' });
        expect(called).toMatchObject({ ok: true, days: 1 });
        expect(called.party.map(m => m.id)).toEqual(['h', 'b']);
        const full = [1, 2, 3, 4, 5].map(i => ({ id: String(i), name: `P${i}` }));
        expect(whereHired(full)).toBe('bench');
        expect(whereHired(party)).toBe('party');
        expect(callFromBench({ party: full, bench: [{ id: 'x', name: 'X' }], id: 'x' }).ok).toBe(false);
    });

    test('42: con casa, el grupo lleno contrata igual y el nuevo se va a casa', () => {
        const recruit = { uid: '9', name: 'Kael', className: '', cost: 0, motive: 'bond', met: true };
        const hire = recruitActions([/** @type {any} */ (recruit)], { purse: 100, partySize: MAX_PARTY, bench: true })[0];
        expect(hire).toMatchObject({ id: 'inn-hire:9', enabled: true });
        expect(hire.label).toMatch(/· a casa$/);
        expect(hire.detail).toMatch(/se queda en casa/);
    });

    test('58: en el templo se rehacen las mejoras: se deshacen y se eligen otras tantas', () => {
        const member = { perks: ['aguante', 'reflejos'], maxHp: 24, hp: 20, speed: 30 };
        expect(respecCost(member)).toBe(2 * RESPEC_PRICE);
        expect(undoPerks(member)).toEqual({ perks: [], maxHp: 20, hp: 16, speed: 30 });
        expect(redoPerks(member, ['pies-ligeros']).ok).toBe(false);
        const redone = redoPerks(member, ['pies-ligeros', 'labia']);
        expect(redone.patch).toEqual({ perks: ['pies-ligeros', 'labia'], maxHp: 20, hp: 16, speed: 35 });
        expect(redoPerks({ perks: [] }, []).reason).toMatch(/No tiene/);
    });

    test('59: cada uno habla lo de su raza; si nadie habla la del otro, con desventaja, y si alguien sí, traduce', () => {
        const elf = { name: 'Lyra', race: 'Elfo', hp: 5 };
        const human = { name: 'Wendel', race: 'Humano', hp: 5, languages: ['norteño'] };
        expect(languagesOf(elf)).toEqual(['común', 'élfico']);
        expect(speaks(human, 'Norteño')).toBe(true);
        expect(languageBarrier({ speaker: human, party: [human, elf], language: 'élfico', skill: 'persuasion', listener: 'Aerin' }))
            .toEqual({ edge: '', by: 'Lyra', note: 'Aerin habla élfico: Lyra traduce.' });
        expect(languageBarrier({ speaker: elf, party: [elf], language: 'enano', skill: 'deception' }).edge).toBe('disadvantage');
        expect(languageBarrier({ speaker: elf, party: [elf], language: 'enano', skill: 'athletics' }).edge).toBe('');
        expect(languageBarrier({ speaker: elf, party: [elf], language: 'Común', skill: 'persuasion' }).edge).toBe('');
    });

    test('59: sin la lengua, la tirada tira dos dados y se queda el peor, y lo dice', () => {
        const member = { name: 'Wendel', charisma: 10 };
        const worse = rollCheck({ member, skill: 'persuasion', rollD20: seq([15, 4]), dc: 10, edge: 'disadvantage', why: 'no habla su lengua' });
        expect(worse?.natural).toBe(4);
        expect(worse?.success).toBe(false);
        expect(worse?.said).toMatch(/desventaja: 15 y 4, no habla su lengua/);
        expect(rollCheck({ member, skill: 'persuasion', rollD20: seq([15, 4]), dc: 10 })?.natural).toBe(15);
    });

    test('62: se guarda lo que se lleva y se vuelve a ello de una vez; lo maldito se queda', () => {
        const member = { name: 'Wendel', items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], equippedItems: { weapon: 'a', armor: 'b' } };
        const saved = saveSet(member, 'Combate');
        expect(saved.ok).toBe(true);
        expect(readSets({ equipmentSets: saved.sets })).toEqual([{ name: 'Combate', equipped: { weapon: 'a', armor: 'b' } }]);
        const light = { ...member, equipmentSets: saved.sets, equippedItems: { weapon: 'c' } };
        const back = applySet(light, 'combate');
        expect(back.equippedItems).toEqual({ weapon: 'a', armor: 'b' });
        const cursed = applySet(light, 'Combate', slot => slot === 'weapon');
        expect(cursed.equippedItems).toEqual({ weapon: 'c', armor: 'b' });
        const lost = applySet({ ...light, items: [{ id: 'a' }] }, 'Combate');
        expect(lost.missing).toEqual(['armor']);
        expect(saveSet({ equippedItems: {} }, 'X').ok).toBe(false);
        let many = { ...member, equipmentSets: /** @type {any[]} */ ([]) };
        for (const name of ['A', 'B', 'C', 'D']) many = { ...many, equipmentSets: saveSet(many, name).sets };
        expect(readSets(many).map(s => s.name)).toEqual(['B', 'C', 'D']);
        expect(MAX_SETS).toBe(3);
    });

    test('163: se da un objeto a otro; lo puesto se quita antes, y lo maldito no se suelta', () => {
        const from = { id: '1', name: 'Wendel', items: [{ id: 'x', name: 'Daga' }, { id: 'y', name: 'Anillo', cursed: true }], equippedItems: { weapon: 'x', ring: 'y' } };
        const to = { id: '2', name: 'Bran', items: [] };
        const given = giveItem({ from, to, itemId: 'x' });
        expect(given.ok).toBe(true);
        expect(given.from?.equippedItems).toEqual({ ring: 'y' });
        expect(given.to?.items.map(i => i.id)).toEqual(['x']);
        expect(given.line).toBe('Wendel le da Daga a Bran (se lo quita antes).');
        expect(giveItem({ from, to, itemId: 'y' }).reason).toMatch(/maldito/);
        expect(giveItem({ from, to: from, itemId: 'x' }).ok).toBe(false);
        expect(giveItem({ from, to: { ...to, dead: true }, itemId: 'x' }).ok).toBe(false);
    });
});

describe('el mundo sigue', () => {
    const locations = [
        { name: 'El Pueblo', routes: [{ to: 'El Castillo', days: 1 }] },
        { name: 'El Castillo', routes: [{ to: 'El Peaje', days: 2 }] },
        { name: 'El Peaje', routes: [] },
    ];
    const npcs = [{ name: 'Giles', where: 'El Pueblo' }, { name: 'Torres', where: 'El Pueblo' }, { name: 'Vane', where: 'El Castillo' }];

    test('87: cuando toman un sitio, alguno muere y otro se va al de al lado; quien necesita el hilo, no', () => {
        const near = neighboursOf(locations);
        expect(near).toEqual({ 'El Pueblo': ['El Castillo'], 'El Castillo': ['El Peaje', 'El Pueblo'], 'El Peaje': ['El Castillo'] });
        const fates = fateAt({ npcs, place: 'El Pueblo', cause: 'cuando La Casa Keller lo tomó', neighbours: near, random: seq([0.1, 0.5, 0]) });
        expect(fates).toEqual([
            { name: 'Giles', kind: 'muere', from: 'El Pueblo', to: '', why: 'cuando La Casa Keller lo tomó' },
            { name: 'Torres', kind: 'se-muda', from: 'El Pueblo', to: 'El Castillo', why: 'cuando La Casa Keller lo tomó' },
        ]);
        expect(fateAt({ npcs, place: 'El Pueblo', cause: '', neighbours: near, keep: ['giles', 'Torres'], random: seq([0]) })).toEqual([]);
        expect(describeFate(fates[0])).toBe('Dicen que Giles murió en El Pueblo cuando La Casa Keller lo tomó.');
        expect(describeFate(fates[1])).toBe('Torres se ha ido de El Pueblo cuando La Casa Keller lo tomó: ahora vive en El Castillo.');
    });

    test('87: sin guerra, de vez en cuando alguien se muda; y con la escala a cero, nadie', () => {
        const near = neighboursOf(locations);
        expect(driftOf({ npcs, neighbours: near, random: seq([0.05, 0.9, 0]) })).toEqual({ name: 'Vane', kind: 'se-muda', from: 'El Castillo', to: 'El Peaje', why: '' });
        expect(driftOf({ npcs, neighbours: near, random: seq([0.5]) })).toBeNull();
        const old = FATE_CHANCE.scale;
        FATE_CHANCE.scale = 0;
        expect(fateAt({ npcs, place: 'El Pueblo', cause: '', neighbours: near, random: seq([0]) })).toEqual([]);
        FATE_CHANCE.scale = old;
    });

    test('116: un encargo del tablón te nombra por tu trasfondo, y solo uno a la vez', () => {
        const hero = { name: 'Wendel', background: 'soldado' };
        const contract = namedContract({ hero, places: ['El Peaje'], random: seq([0]), day: 3 });
        expect(contract).toMatchObject({ kind: 'hold', named: true, locationName: 'El Peaje', title: 'Para Wendel: un viejo compañero de armas pide ayuda para aguantar en El Peaje', days: 15 });
        expect(hasNamed([contract])).toBe(true);
        expect(hasNamed([{ id: 'x' }])).toBe(false);
        expect(namedContract({ hero: { name: 'X', background: '' }, places: ['A'], random: seq([0]), day: 1 })).toBeNull();
        expect(namedContract({ hero: { name: 'X', background: 'forastero' }, places: ['A'], random: seq([0]), day: 1 })?.kind).toBe('cull');
        expect(namedContract({ hero: { name: 'X', background: 'forastero' }, places: ['A'], bestiary: ['Lobo'], random: seq([0]), day: 1 })?.title).toBe('Para X: los de tu tierra piden que caces a Lobo en A');
    });
});

describe('la caza y la herrería', () => {
    test('121: las bestias dejan materiales, y cada uno es de una clase', () => {
        expect(trophiesOf({ name: 'Lobo famélico 1' }, seq([0.1, 0]))).toEqual(['Piel de lobo']);
        expect(trophiesOf({ name: 'Lobo famélico 1' }, seq([0.9]))).toEqual([]);
        expect(trophiesOf({ name: 'Infantería de Keller' }, seq([0]))).toEqual([]);
        expect(materialKind('Piel de oso')).toBe('piel');
        expect(materialKind('Colmillo de jabalí')).toBe('duro');
        expect(materialKind('Seda de araña')).toBe('fibra');
        expect(materialKind('Espada')).toBe('');
        expect(trophyItem('Piel de lobo')).toMatchObject({ subcategory: 'material', weight: 2 });
    });

    test('121 y 120: dos pieles hacen una capa; algo duro y oro mejoran el arma a +1, una vez', () => {
        const party = [
            { id: '1', items: [{ id: 'p1', name: 'Piel de lobo' }, { id: 'c1', name: 'Colmillo de lobo' }] },
            { id: '2', items: [{ id: 'p2', name: 'Piel de oso' }] },
        ];
        expect(materialsOf(party).piel.map(m => m.itemId)).toEqual(['p1', 'p2']);
        const cloak = canCraft({ recipe: 'capa', party, purse: 50 });
        expect(cloak).toMatchObject({ ok: true, gold: 10 });
        expect(cloak.use.map(m => m.itemId)).toEqual(['p1', 'p2']);
        expect(canCraft({ recipe: 'capa', party: [party[1]], purse: 50 }).reason).toMatch(/Faltan materiales/);
        expect(canCraft({ recipe: 'mejora', party, purse: 50, weapon: { name: 'Espada' } }).reason).toMatch(/No llega el oro/);
        expect(canCraft({ recipe: 'mejora', party, purse: 100, weapon: { name: 'Espada' } }).use.map(m => m.itemId)).toEqual(['c1']);
        expect(canCraft({ recipe: 'mejora', party, purse: 100, weapon: { name: 'Espada +1', magicalBonus: 1 } }).ok).toBe(false);
        expect(canCraft({ recipe: 'mejora', party, purse: 100 }).reason).toMatch(/No empuña/);
        expect(cloakItem().name).toBe('Capa de pieles');
        expect(upgradedWeapon({ name: 'Espada larga' })).toEqual({ magicalBonus: 1, name: 'Espada larga +1' });
        expect(weaponBonus({ items: [{ id: 'w', magicalBonus: 1 }], equippedItems: { weapon: 'w' } })).toBe(1);
        expect(weaponBonus({ items: [], equippedItems: {} })).toBe(0);
    });
});

describe('el chat y el narrador', () => {
    test('139: el narrador propone un objeto; entra lo corriente del catálogo, y lo demás es una curiosidad', () => {
        const first = addOffer(null, { name: 'Manta de lana', note: 'La posadera os la deja.' }, { day: 2 });
        expect(first.added).toBe(true);
        expect(addOffer(first.offers, { name: 'manta de lana' }, { day: 2 }).added).toBe(false);
        expect(addOffer(first.offers, { name: '' }, { day: 2 }).reason).toBe('Sin nombre.');
        expect(offerChips(first.offers)).toEqual([{ id: `offer:${first.offer?.id}`, label: 'Coger: Manta de lana', icon: 'fa-gift', command: `/aceptar-objeto ${first.offer?.id}` }]);
        const taken = takeOffer(first.offers, 'Manta de lana');
        expect(taken.offer?.name).toBe('Manta de lana');
        expect(readOffers(taken.offers)).toEqual([]);
        const catalogue = [{ name: 'Manta de lana', rarity: 'Common', value: 2 }, { name: 'Espada llameante', rarity: 'Rare', magical: true }];
        expect(resolveOffer(/** @type {any} */ (taken.offer), catalogue)).toEqual({ known: true, item: { name: 'Manta de lana', rarity: 'Common', value: 2 } });
        const magic = resolveOffer({ id: 'o', name: 'Espada llameante', note: 'Brilla.', to: '', day: 1 }, catalogue);
        expect(magic.known).toBe(false);
        expect(magic.item).toMatchObject({ subcategory: 'trinket', value: 1 });
        expect(magic.item.description).toMatch(/curiosidad/);
        expect(resolveOffer({ id: 'o', name: 'Anillo', note: '', to: '', day: 1 }, [{ name: 'Anillo', category: 'magic' }]).known).toBe(false);
    });

    test('142: el tono de la escena: automático en combate es tenso; el elegido manda', () => {
        expect(toneNow({ fighting: true })).toBe('tensa');
        expect(toneNow({ fighting: false })).toBe('');
        expect(toneNow({ chosen: 'comica', fighting: true })).toBe('comica');
        expect(toneNote({ chosen: 'auto', fighting: false })).toBe('');
        expect(toneNote({ chosen: 'sombria' })).toMatch(/^Tono de la escena: sombrío/);
        expect(nextTone('auto')).toBe('tensa');
        expect(nextTone('epica')).toBe('auto');
        expect(readTone('raro')).toBe('auto');
        expect(describeTone('comica')).toBe('Tono: cómico');
    });

    test('145: se sabe quién habla por cómo se da la palabra, no por un nombre suelto', () => {
        const names = ['Giles', 'Oswald el Senescal', 'Bran'];
        expect(speakerOf('—No pienso pagar —dice Giles—. Ni hoy ni mañana.', names)).toBe('Giles');
        expect(speakerOf('**Giles:** Ni hablar.', names)).toBe('Giles');
        expect(speakerOf('«Ni hablar», responde Oswald el Senescal.', names)).toBe('Oswald el Senescal');
        expect(speakerOf('Bran dice: vámonos.', names)).toBe('Bran');
        expect(speakerOf('Giles os mira desde la barra.', names)).toBe('');
        expect(speakerOf('—Ni hablar —dice Gilesito.', names)).toBe('');
        expect(initialsOf('Oswald el Senescal')).toBe('OS');
        expect(initialsOf('Maese Ambrosio')).toBe('A');
        expect(hueOf('Giles')).toBe(hueOf('giles'));
    });
});

describe('crear mundos y sensación', () => {
    test('180: el código lleva la semilla y el mundo de partida, y se lee de vuelta', () => {
        expect(makeShareCode({ seed: 'Molino Ceniza Siete', origin: 'Aldea del Molino' })).toBe('molino-ceniza-siete@aldea-del-molino');
        expect(makeShareCode({ seed: 'yunque-hiel-catorce' })).toBe('yunque-hiel-catorce');
        expect(makeShareCode({ seed: '' })).toBe('');
        expect(readShareCode('molino-ceniza-siete@1387')).toEqual({ seed: 'molino-ceniza-siete', origin: '1387' });
        expect(readShareCode('molino-ceniza-siete')).toEqual({ seed: 'molino-ceniza-siete', origin: '' });
        expect(isShareCode('a-b-c@x')).toBe(true);
        expect(isShareCode('a-b-c')).toBe(false);
    });

    test('186: cada ataque suena según salga, y lo que suena se apunta aunque no haya altavoz', () => {
        expect(cueForAttack({ hit: true, crit: true })).toBe('crit');
        expect(cueForAttack({ hit: true })).toBe('hit');
        expect(cueForAttack({ hit: false, crit: true })).toBe('miss');
        expect(playCue('hit')).toBe(true);
        expect(playCue('nada')).toBe(false);
        expect(playCue('door', { enabled: false })).toBe(false);
        expect(lastCues().slice(-1)).toEqual(['hit']);
        expect(Object.keys(CUES)).toEqual(['hit', 'crit', 'miss', 'door', 'coin', 'level']);
    });
});

describe('el tablero cambia', () => {
    const map = terrainFromAsciiMap(['#####', '#.cD#', '#~..#', '#####']);

    test('23: la puerta rota se queda abierta para siempre, y lo dice', () => {
        const broken = breakDoor(map, 3, 1);
        expect(getCell(broken, 3, 1)).toEqual({ type: 'door', open: true, broken: true });
        expect(getCell(setDoorOpen(broken, 3, 1, false), 3, 1).open).toBe(true);
        expect(describeCell(broken, 3, 1)).toMatch(/Puerta rota/);
        expect(getCell(normalizeTerrain(JSON.parse(JSON.stringify(broken))), 3, 1).broken).toBe(true);
        expect(breakDoor(map, 1, 1)).toEqual(normalizeTerrain(map));
    });

    test('23: el fuego prende en lo que arde de al lado, lo deja en ceniza y se apaga a las tres rondas', () => {
        expect(flammable({ type: 'cover_half' }, false)).toBe(true);
        expect(flammable({ type: 'difficult' }, false)).toBe(false);
        expect(flammable({ type: 'difficult' }, true)).toBe(true);
        expect(flammable({ type: 'door', broken: true }, true)).toBe(false);
        const fire = fireAt({ x: 1, y: 1, round: 1 });
        expect(fire.until).toBe(1 + FIRE.rounds);
        const step = spreadFire({ hazards: [fire], terrain: map, round: 2, random: () => 0, outdoors: true, width: 5, height: 4 });
        expect(step.burnt.map(b => `${b.x},${b.y}`).sort()).toEqual(['1,2', '2,1']);
        expect(getCell(step.terrain, 2, 1).type).toBe('floor');
        expect(getCell(step.terrain, 1, 2).type).toBe('floor');
        expect(step.lines.join(' ')).toMatch(/El fuego se extiende: arden las cajas en \(3, 2\)/);
        const later = spreadFire({ hazards: step.hazards, terrain: step.terrain, round: 1 + FIRE.rounds, random: () => 0.9, width: 5, height: 4 });
        expect(later.lines[0]).toBe('El fuego se apaga en 1 casilla(s).');
        const rain = spreadFire({ hazards: [fire], terrain: map, round: 2, random: () => 0, wet: true });
        expect(rain.hazards.every(h => h.armed === false)).toBe(true);
        expect(spreadFire({ hazards: [], terrain: map, round: 2, random: () => 0 }).lines).toEqual([]);
    });

    test('8: lo que hay a mano en el tablero se lanza: una caja o un barril al lado', () => {
        const near = sceneryNear(map, 1, 1, 5, 4);
        expect(near).toEqual([{ x: 2, y: 1 }]);
        expect(sceneryNear(map, 3, 2, 5, 4)).toEqual([{ x: 2, y: 1 }]);
        expect(sceneryNear(map, 1, 2, 5, 4)).toEqual([{ x: 2, y: 1 }]);
        const offer = judgeSceneryThrow({ near, hasAction: true, enemies: [{ id: 'e1', name: 'Lobo', distanceFeet: 15 }, { id: 'e2', name: 'Oso', distanceFeet: 40 }] });
        expect(offer).toMatchObject({ id: 'lanzar:objeto', enabled: true, targets: [{ id: 'e1', name: 'Lobo' }] });
        expect(judgeSceneryThrow({ near: [], hasAction: true, enemies: [] })).toBeNull();
        expect(judgeSceneryThrow({ near, hasAction: false, enemies: [] })?.enabled).toBe(false);
        expect(SCENERY.rangeFeet).toBe(20);
    });
});
