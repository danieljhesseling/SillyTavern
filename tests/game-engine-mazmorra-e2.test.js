/**
 * E2 de wiki/ROADMAP_ENTRETENIDO.md, «La mazmorra que pesa»: la luz (E2.1), las cerraduras con
 * riesgo (E2.2), dormir en la mazmorra (E2.3) y seguir o volver (E2.4).
 */
import { describe, test, expect } from '@jest/globals';
import {
    ambientLight, darkvisionOf, lightSources, lightLevelAt, seenAs, sightEdge, perceptionInLight, lightKindOf,
    torchesOf, carriesLantern, handFor, shieldBonusOf, pickBearer, torchBurning, planLight, spendTorch, describeLight,
    LIGHT_SOURCES, DIM_PASSIVE_PENALTY,
} from '../public/scripts/game-engine/board/light.js';
import {
    isKey, isThievesTools, toolsInParty, pickEdge, lockOutcome, lockLabels, dropBrokenTools, failLine, noToolsLine, BREAK_MARGIN, LOCK_DC,
} from '../public/scripts/game-engine/board/lock-picking.js';
import {
    isHostileGround, isRation, rationsOf, partyRations, eatRations, ambushChance, watchPassive, surpriseCheck,
    wearsHeavyArmour, armourOffPenalty, pickAmbushers, ambushCells, alarmLine, DARK_WATCH_PENALTY,
} from '../public/scripts/game-engine/campaign/dungeon-camp.js';
import { NIGHT_CHANCE } from '../public/scripts/game-engine/campaign/camp.js';
import {
    partyCondition, shouldAskPressOn, pickAsker, pressOnQuestion, safeDestination, toPlace,
} from '../public/scripts/game-engine/campaign/press-on.js';
import {
    isHealerKit, usesLeft, kitUsesOf, partyKitUses, kitCarrier, spendKitUse, describeKitLeft, KIT_USES,
} from '../public/scripts/game-engine/rules/healer-kit.js';
import { attackEdge, EDGE_UP } from '../public/scripts/game-engine/combat/maneuvers.js';
import { DUTIES, readFormation } from '../public/scripts/game-engine/campaign/formation.js';
import { describeLootItem } from '../public/scripts/game-engine/combat/loot-items.js';
import { createEmptyTerrain, setCell } from '../public/scripts/game-engine/board/terrain.js';

const shield = { id: 'e1', name: 'Escudo', armorClass: 2 };
const longsword = { id: 'w1', name: 'Espada larga', hands: 1 };
const greataxe = { id: 'w2', name: 'Hacha a dos manos', hands: 2 };
const plate = { id: 'a1', name: 'Cota de malla', armorClass: 16, dexMode: 'none' };
const torch = (quantity = 1) => ({ id: `t${quantity}`, name: 'Antorcha', quantity });

describe('E2.1: la luz cuenta', () => {
    test('el sitio: lo que dice el tablero manda, y si no, si es de los oscuros', () => {
        expect(ambientLight({ declared: 'penumbra' })).toBe('dim');
        expect(ambientLight({ declared: 'oscuro' })).toBe('dark');
        expect(ambientLight({ declared: 'luz', dark: true })).toBe('bright');
        expect(ambientLight({ dark: true })).toBe('dark');
        expect(ambientLight({})).toBe('bright');
    });

    test('visión en la oscuridad: por la especie (2024) o por lo que es el bicho', () => {
        expect(darkvisionOf({ race: 'Enano' })).toBe(120);
        expect(darkvisionOf({ race: 'Media elfa' })).toBe(60);
        expect(darkvisionOf({ race: 'Tiflin' })).toBe(60);
        expect(darkvisionOf({ race: 'Humano' })).toBe(0);
        expect(darkvisionOf({ race: 'Humano', darkvision: 30 })).toBe(30);
        // Un compañero que se llame como un bicho no ve a oscuras por eso.
        expect(darkvisionOf({ name: 'Sombra', race: 'Humano' })).toBe(0);
        expect(darkvisionOf({ name: 'Esqueleto' }, { monster: true })).toBe(60);
        expect(darkvisionOf({ name: 'Engendro hambriento' }, { monster: true })).toBe(60);
        expect(darkvisionOf({ name: 'Lobo famélico' }, { monster: true })).toBe(0);
        expect(darkvisionOf({ name: 'Cosa', senses: 'visión en la oscuridad 90 pies' }, { monster: true })).toBe(90);
    });

    test('la antorcha: 20 pies de luz y 20 de penumbra; más allá, oscuro', () => {
        const sources = lightSources([{ x: 0, y: 0, kind: 'antorcha' }]);
        expect(sources[0]).toMatchObject({ bright: LIGHT_SOURCES.antorcha.bright, dim: LIGHT_SOURCES.antorcha.dim });
        expect(lightLevelAt({ x: 4, y: 0 }, 'dark', sources)).toBe('bright');
        expect(lightLevelAt({ x: 6, y: 3 }, 'dark', sources)).toBe('dim');
        expect(lightLevelAt({ x: 9, y: 0 }, 'dark', sources)).toBe('dark');
        // En un sitio con luz, la antorcha no cambia nada; en penumbra, nunca baja de penumbra.
        expect(lightLevelAt({ x: 9, y: 0 }, 'bright', sources)).toBe('bright');
        expect(lightLevelAt({ x: 9, y: 0 }, 'dim', sources)).toBe('dim');
    });

    test('la luz no pasa paredes', () => {
        let terrain = createEmptyTerrain();
        terrain = setCell(terrain, 2, 0, 'wall');
        const sources = lightSources([{ x: 0, y: 0, kind: 'antorcha' }]);
        expect(lightLevelAt({ x: 3, y: 0 }, 'dark', sources)).toBe('bright');
        expect(lightLevelAt({ x: 3, y: 0 }, 'dark', sources, terrain)).toBe('dark');
    });

    test('ver a oscuras: la penumbra es luz y la oscuridad penumbra, dentro de su alcance', () => {
        expect(seenAs('dark', 60, 30)).toBe('dim');
        expect(seenAs('dim', 60, 30)).toBe('bright');
        expect(seenAs('dark', 60, 90)).toBe('dark');
        expect(seenAs('dark', 0, 5)).toBe('dark');
    });

    test('atacar a oscuras: quien no ve, desventaja; a quien no ve, ventaja; los dos, se anulan', () => {
        const none = [];
        const blind = sightEdge({ ambient: 'dark', sources: none, attacker: { x: 0, y: 0 }, target: { x: 1, y: 0 } });
        expect(blind.down).toHaveLength(1);
        expect(blind.up).toHaveLength(1);
        // El bicho que ve a oscuras contra el humano sin luz: él con ventaja.
        const ghoul = sightEdge({ ambient: 'dark', sources: none, attacker: { x: 0, y: 0, darkvision: 60 }, target: { x: 1, y: 0 } });
        expect(ghoul.down).toHaveLength(0);
        expect(ghoul.up).toHaveLength(1);
        // Con la antorcha, todos se ven.
        const lit = sightEdge({ ambient: 'dark', sources: lightSources([{ x: 0, y: 0, kind: 'antorcha' }]), attacker: { x: 0, y: 0 }, target: { x: 2, y: 0 } });
        expect(lit.up).toHaveLength(0);
        expect(lit.down).toHaveLength(0);
    });

    test('las razones de la luz llegan a attackEdge: la de ventaja va marcada', () => {
        const edge = attackEdge({ targetId: 'x', distanceFeet: 5, hindered: [`${EDGE_UP}a oscuras: no le ve venir`] });
        expect(edge.mode).toBe('advantage');
        expect(edge.reasons).toContain('a oscuras: no le ve venir');
        const both = attackEdge({ targetId: 'x', distanceFeet: 5, hindered: ['a oscuras: no ve a quien ataca', `${EDGE_UP}a oscuras: no le ve venir`] });
        expect(both.mode).toBe('normal');
    });

    test('mirar: en penumbra con desventaja (−5 en pasiva); a oscuras no se ve nada', () => {
        expect(perceptionInLight('dim')).toMatchObject({ edge: 'disadvantage', passivePenalty: DIM_PASSIVE_PENALTY, blind: false });
        expect(perceptionInLight('dark').blind).toBe(true);
        expect(perceptionInLight('bright')).toMatchObject({ edge: '', passivePenalty: 0, blind: false });
    });

    test('lo que alumbra en la mochila: antorchas (con su montón) y el farol', () => {
        expect(lightKindOf({ name: 'Antorcha bendecida' })).toBe('antorcha');
        expect(lightKindOf({ name: 'Farol de latón' })).toBe('farol');
        expect(lightKindOf({ name: 'Antorchero' })).toBe('');
        expect(torchesOf({ items: [torch(3), { name: 'Antorcha' }] })).toBe(4);
        expect(carriesLantern({ items: [{ name: 'Farol' }] })).toBe(true);
    });

    test('la mano de la antorcha: libre, la del escudo o ninguna', () => {
        const free = { id: '1', name: 'Mira', hp: 9, items: [longsword], equippedItems: { weapon: 'w1' } };
        const shielded = { id: '2', name: 'Bran', hp: 12, items: [longsword, shield], equippedItems: { weapon: 'w1', shield: 'e1' } };
        const twoHands = { id: '3', name: 'Gerd', hp: 14, items: [greataxe], equippedItems: { weapon: 'w2' } };
        expect(handFor(free)).toBe('free');
        expect(handFor(shielded)).toBe('shield');
        expect(handFor(twoHands)).toBe('two-handed');
        expect(shieldBonusOf(shielded)).toBe(2);
        expect(pickBearer([shielded, twoHands, free])?.member).toBe(free);
        expect(pickBearer([shielded, twoHands])?.member).toBe(shielded);
        // El de la formación manda.
        expect(pickBearer([shielded, free], '2')?.member).toBe(shielded);
    });

    test('la antorcha arde lo que queda de la parte del día', () => {
        const lit = { bearerId: '1', day: 3, slotIndex: 1 };
        expect(torchBurning(lit, { day: 3, slotIndex: 1 })).toBe(true);
        expect(torchBurning(lit, { day: 3, slotIndex: 2 })).toBe(false);
        expect(torchBurning(null, { day: 3, slotIndex: 1 })).toBe(false);
    });

    test('el plan: sin luz encendida y con antorchas, se enciende una (y se gasta)', () => {
        const mira = { id: '1', name: 'Mira', hp: 9, items: [torch(3)] };
        const bran = { id: '2', name: 'Bran', hp: 12, items: [longsword, shield], equippedItems: { weapon: 'w1', shield: 'e1' } };
        const party = [{ member: bran, x: 1, y: 1 }, { member: mira, x: 2, y: 1 }];
        const plan = planLight({ ambient: 'dark', party, calendar: { day: 1, slotIndex: 0 } });
        expect(plan.lightTorch).toBe(true);
        expect(plan.bearer).toBe(mira);
        expect(plan.torchFrom).toBe(mira);
        expect(plan.torchesLeft).toBe(2);
        expect(plan.carried).toEqual([{ x: 2, y: 1, kind: 'antorcha' }]);
        // Ya encendida: no se gasta otra.
        const burning = planLight({ ambient: 'dark', party, torch: { bearerId: '1', day: 1, slotIndex: 0 }, calendar: { day: 1, slotIndex: 0 } });
        expect(burning.lightTorch).toBe(false);
        expect(burning.handLight).toBe('antorcha');
        // Con luz plena, nada.
        expect(planLight({ ambient: 'bright', party }).carried).toHaveLength(0);
        // Sin antorchas ni farol, a oscuras.
        const dark = planLight({ ambient: 'dark', party: [{ member: bran, x: 1, y: 1 }] });
        expect(dark.carried).toHaveLength(0);
        expect(describeLight(dark)).toMatch(/A oscuras/);
    });

    test('el farol no se gasta, y la Luz alumbra en quien la lanzó', () => {
        const mago = { id: '5', name: 'Lyra', hp: 7, items: [{ name: 'Farol' }] };
        const plan = planLight({ ambient: 'dark', party: [{ member: mago, x: 0, y: 0 }], fieldLightBy: '5' });
        expect(plan.handLight).toBe('farol');
        expect(plan.lightTorch).toBe(false);
        expect(plan.carried.map(c => c.kind).sort()).toEqual(['farol', 'luz']);
        expect(describeLight(plan, [{ name: 'Lyra', darkvision: 0 }])).toMatch(/Farol: lo lleva Lyra/);
    });

    test('gastar una antorcha: el montón baja en uno; la última se va', () => {
        expect(spendTorch([torch(3)])[0].quantity).toBe(2);
        expect(spendTorch([torch(1), { name: 'Cuerda' }])).toEqual([{ name: 'Cuerda' }]);
    });

    test('la línea de la cabecera dice quién la lleva, lo que queda y la mano', () => {
        const bran = { id: '2', name: 'Bran', hp: 12, items: [longsword, shield, torch(2)], equippedItems: { weapon: 'w1', shield: 'e1' } };
        const plan = planLight({ ambient: 'dark', party: [{ member: bran, x: 0, y: 0 }], calendar: { day: 1, slotIndex: 0 } });
        const said = describeLight(plan, [{ name: 'Gerd', darkvision: 120 }]);
        expect(said).toMatch(/la lleva Bran \(quedan 1\)/);
        expect(said).toMatch(/Sin escudo/);
        expect(said).toMatch(/Gerd ve en la oscuridad/);
    });

    test('la formación tiene quién lleva la luz', () => {
        expect(DUTIES.antorcha.label).toMatch(/luz/);
        expect(readFormation({ duties: { antorcha: 7 } }).duties.antorcha).toBe('7');
    });
});

describe('E2.2: forzar cerraduras con riesgo', () => {
    test('las ganzúas no son una llave', () => {
        expect(isKey({ name: 'Llave de hierro' })).toBe(true);
        expect(isKey({ name: 'Ganzúas de acero' })).toBe(false);
        expect(isThievesTools({ name: 'Ganzúas de acero' })).toBe(true);
        const rogue = { name: 'Nella', items: [{ name: 'Ganzúas' }] };
        expect(toolsInParty([{ name: 'Bran', items: [] }, rogue])?.member).toBe(rogue);
        expect(toolsInParty([{ name: 'Bran', dead: true, items: [{ name: 'Ganzúas' }] }])).toBeNull();
    });

    test('con ganzúas y sabiendo de Juego de manos, con ventaja (2024)', () => {
        expect(pickEdge({ withTools: true, proficient: true })).toBe('advantage');
        expect(pickEdge({ withTools: true, proficient: false })).toBe('');
        expect(pickEdge({ withTools: false, proficient: true })).toBe('');
    });

    test('fallar hace ruido; fallar por 5 o más con ganzúas las rompe (cosecha propia)', () => {
        expect(lockOutcome({ how: 'pick', total: 15, natural: 10, dc: 14 })).toMatchObject({ opened: true, noisy: false, broke: false });
        expect(lockOutcome({ how: 'pick', total: 12, natural: 8, dc: 14, withTools: true })).toMatchObject({ opened: false, noisy: true, broke: false });
        expect(lockOutcome({ how: 'pick', total: 14 - BREAK_MARGIN, natural: 3, dc: 14, withTools: true })).toMatchObject({ opened: false, broke: true });
        // Sin ganzúas no hay nada que romper.
        expect(lockOutcome({ how: 'pick', total: 2, natural: 2, dc: 14 }).broke).toBe(false);
        // El 20 abre, el 1 no.
        expect(lockOutcome({ how: 'pick', total: 5, natural: 20, dc: 14 }).opened).toBe(true);
        expect(lockOutcome({ how: 'pick', total: 30, natural: 1, dc: 14 }).opened).toBe(false);
        // Echarla abajo se oye siempre, salga o no.
        expect(lockOutcome({ how: 'force', total: 20, natural: 15, dc: LOCK_DC.force })).toMatchObject({ opened: true, noisy: true });
    });

    test('los botones dicen lo que arriesgan (y lo que pide la prueba de siempre)', () => {
        const labels = lockLabels({ key: '', tools: 'Ganzúas', edge: 'advantage' });
        expect(labels.key).toBe('');
        expect(labels.pick).toMatch(/Juego de manos, CD 14, con ventaja/);
        expect(labels.pick).toMatch(/se rompen/);
        expect(labels.force).toMatch(/Atletismo, CD 16/);
        expect(lockLabels({ key: 'Llave oxidada' }).key).toBe('Usar Llave oxidada');
        expect(lockLabels({ tools: 'Ganzúas', trick: 5 }).pick).toMatch(/CD 9/);
    });

    test('sin ganzúas no se fuerza (Daniel, 2026-10-03, como 5e): el botón no sale y uno de los tuyos lo dice', () => {
        const labels = lockLabels({ key: '', tools: '' });
        expect(labels.pick).toBe('');
        expect(lockLabels({ trick: 5 }).pick).toBe('');
        // Quedan las otras salidas: echarla abajo, la llave u otro camino.
        expect(labels.force).toMatch(/A golpes/);
        expect(noToolsLine()).toMatch(/^Sin ganzúas no hay nada que hacer con esta cerradura\./);
        expect(noToolsLine()).toMatch(/echamos abajo.*llave.*otro lado/);
        expect(noToolsLine({ key: true })).toBe('');
    });

    test('las ganzúas rotas se van de la mochila', () => {
        const tools = { id: 'g', name: 'Ganzúas' };
        expect(dropBrokenTools([{ id: 'a' }, tools], tools)).toEqual([{ id: 'a' }]);
    });

    test('lo dice quien lo intenta, sin narrador', () => {
        expect(failLine({ how: 'pick', broke: true, heard: true, tools: 'Ganzúas' })).toMatch(/Se me han partido las ganzúas.*Al otro lado se mueve algo/);
        expect(failLine({ how: 'force', broke: false, heard: false })).toMatch(/nadie lo ha oído/);
    });
});

describe('E2.3: acampar en territorio hostil', () => {
    test('territorio hostil: un tablero oscuro o un sitio que es mazmorra o cueva', () => {
        expect(isHostileGround({ darkBoard: true })).toBe(true);
        expect(isHostileGround({ locationType: 'dungeon' })).toBe(true);
        expect(isHostileGround({ locationType: 'village' })).toBe(false);
    });

    test('las raciones: una por cabeza, de quien las lleve; sin bastantes no se gasta nada', () => {
        expect(isRation({ name: 'Raciones de viaje' })).toBe(true);
        expect(isRation({ name: 'Ración de invierno' })).toBe(true);
        const a = { id: 'a', hp: 5, items: [{ name: 'Raciones de viaje', quantity: 2 }] };
        const b = { id: 'b', hp: 5, items: [{ name: 'Raciones de viaje' }, { name: 'Cuerda' }] };
        const c = { id: 'c', hp: 5, items: [] };
        expect(rationsOf(a)).toBe(2);
        expect(partyRations([a, b, c])).toBe(3);
        const meal = eatRations([a, b, c], [a, b, c]);
        expect(meal.ok).toBe(true);
        expect(meal.eaten).toBe(3);
        expect(meal.items.get(a)).toEqual([]);
        expect(meal.items.get(b)).toEqual([{ name: 'Cuerda' }]);
        expect(eatRations([a, b, c, { id: 'd', hp: 4 }], [a, b, c]).ok).toBe(false);
    });

    test('la emboscada: la probabilidad de una noche en mazmorra, con su escala', () => {
        const before = NIGHT_CHANCE.scale;
        try {
            NIGHT_CHANCE.scale = 1;
            expect(ambushChance()).toBeCloseTo(NIGHT_CHANCE.base.dungeon);
            expect(ambushChance({ light: true })).toBeGreaterThan(ambushChance());
            NIGHT_CHANCE.scale = 0;
            expect(ambushChance({ light: true, hostile: true })).toBe(0);
        } finally {
            NIGHT_CHANCE.scale = before;
        }
    });

    test('la guardia: pasiva contra el Sigilo más torpe; a oscuras sin ver, solo oye (−5)', () => {
        expect(watchPassive({ perception: 3 })).toBe(13);
        expect(watchPassive({ perception: 3, dark: true })).toBe(13 - DARK_WATCH_PENALTY);
        expect(watchPassive({ perception: 3, dark: true, darkvision: 60 })).toBe(13);
        const seen = surpriseCheck({ guards: [{ name: 'Mira', passive: 14 }, { name: 'Bran', passive: 9 }], stealth: [16, 13] });
        expect(seen).toMatchObject({ surprised: false, worst: 13 });
        expect(seen.best?.name).toBe('Mira');
        expect(surpriseCheck({ guards: [{ name: 'Bran', passive: 9 }], stealth: [12, 15] }).surprised).toBe(true);
        expect(surpriseCheck({ guards: [], stealth: [3] }).surprised).toBe(true);
    });

    test('quien duerme en armadura pesada pelea sin ella: 10 + Destreza', () => {
        const knight = { id: 'k', items: [plate, shield], equippedItems: { body: 'a1', shield: 'e1' } };
        expect(wearsHeavyArmour(knight)).toBe(true);
        // Cota 16 + escudo 2 = 18; dormido, 10 + 0: pierde 8.
        expect(armourOffPenalty(knight, 0)).toBe(8);
        expect(wearsHeavyArmour({ items: [{ id: 'l', name: 'Cuero', armorClass: 11 }], equippedItems: { body: 'l' } })).toBe(false);
        expect(armourOffPenalty({ items: [] }, 2)).toBe(0);
    });

    test('quiénes llegan y dónde: los más flojos del sitio, de la oscuridad, no encima', () => {
        const names = pickAmbushers({ candidates: [{ name: 'Ghoul', cr: 1 }, { name: 'Rata gigante', cr: 0.125 }], partySize: 3, random: () => 0.5 });
        expect(names).toEqual(['Rata gigante', 'Rata gigante']);
        expect(pickAmbushers({ candidates: [], partySize: 3, random: () => 0 })).toEqual([]);
        const cells = ambushCells({ party: [{ x: 5, y: 5 }], free: () => true, width: 12, height: 12, count: 2, random: () => 0.3 });
        expect(cells).toHaveLength(2);
        for (const cell of cells) {
            const d = Math.max(Math.abs(cell.x - 5), Math.abs(cell.y - 5));
            expect(d).toBeGreaterThanOrEqual(3);
            expect(d).toBeLessThanOrEqual(5);
        }
    });

    test('la voz de alarma la da alguien del grupo', () => {
        expect(alarmLine({ surprised: true, foes: 'dos ratas' })).toMatch(/No los he oído llegar/);
        expect(alarmLine({ surprised: false, foes: 'dos ratas' })).toMatch(/Se acercan dos ratas/);
    });
});

describe('E2.4: seguir o volver, y el kit de curandero', () => {
    const bran = { id: '1', name: 'Bran', hp: 6, maxHp: 20 };
    const mira = { id: '2', name: 'Mira', hp: 14, maxHp: 14 };
    const nella = { id: '3', name: 'Nella', hp: 0, maxHp: 10 };

    test('cómo está el grupo', () => {
        const condition = partyCondition([bran, mira, nella]);
        expect(condition.worst?.name).toBe('Bran');
        expect(condition.down).toEqual(['Nella']);
        expect(condition.hurt).toBe(true);
        expect(condition.share).toBeCloseTo(20 / 44);
        expect(partyCondition([mira]).hurt).toBe(false);
    });

    test('se pregunta en una mazmorra, con algo más por delante y alguien tocado', () => {
        const condition = partyCondition([bran, mira]);
        expect(shouldAskPressOn({ dungeon: true, moreAhead: true, condition })).toBe(true);
        expect(shouldAskPressOn({ dungeon: false, moreAhead: true, condition })).toBe(false);
        expect(shouldAskPressOn({ dungeon: true, moreAhead: false, condition })).toBe(false);
        expect(shouldAskPressOn({ dungeon: true, moreAhead: true, condition: partyCondition([mira]) })).toBe(false);
    });

    test('pregunta uno de los tuyos: quien cura, o el más tocado; nunca tú', () => {
        const hero = { id: '9', name: 'Tú', hp: 3, maxHp: 20 };
        expect(pickAsker([hero, bran, mira], { heroId: '9', healerId: '2' })).toBe(mira);
        expect(pickAsker([hero, bran, mira], { heroId: '9' })).toBe(bran);
        expect(pickAsker([hero], { heroId: '9' })).toBeNull();
    });

    test('la pregunta: cómo vais, lo que falta, y seguir o volver perdiendo el día', () => {
        const q = pressOnQuestion({
            asker: mira,
            condition: partyCondition([bran, mira]),
            supplies: { torches: 0, rations: 1, kitUses: 0, mouths: 2, needsLight: true },
            destination: 'la posada',
        });
        expect(q.question).toMatch(/Bran está en 6 de 20/);
        expect(q.question).toMatch(/no quedan antorchas, no queda kit de curandero y las raciones no dan para dormir aquí/);
        expect(q.question).toMatch(/¿Seguimos así o volvemos a la posada\? Volver nos cuesta el día\./);
        expect(q.yes).toBe('Seguimos');
        expect(q.no).toBe('Volvemos a la posada');
        expect(q.notes[0]).toMatch(/antorchas: 0 · raciones: 1 · kit de curandero: 0 usos/);
        // Si quien pregunta es el más tocado, habla de sí.
        const self = pressOnQuestion({ asker: bran, condition: partyCondition([bran, mira]), supplies: { torches: 2, rations: 4, kitUses: 3, mouths: 2 }, destination: 'el gremio' });
        expect(self.question).toMatch(/^Yo estoy en 6 de 20\./);
        expect(self.other).toBe('');
        // Dentro de la mazmorra, también dormir ahí (E2.3), dicho con lo que cuesta.
        const inside = pressOnQuestion({ asker: mira, condition: partyCondition([bran, mira]), supplies: { torches: 2, rations: 4, kitUses: 3, mouths: 2 }, destination: 'la posada', campHere: true });
        expect(inside.other).toBe('Dormimos aquí');
        expect(inside.question).toMatch(/dormimos aquí dentro o volvemos a la posada\? Dormir aquí gasta una ración cada uno/);
    });

    test('a dónde se vuelve', () => {
        expect(safeDestination({ guild: true })).toEqual({ where: 'el gremio', under: 'techo' });
        expect(safeDestination({ settled: true }).where).toBe('la posada');
        expect(safeDestination({}).under).toBe('cielo');
        expect(toPlace('el gremio')).toBe('al gremio');
        expect(toPlace('la posada')).toBe('a la posada');
        expect(pressOnQuestion({ asker: mira, condition: partyCondition([bran, mira]), supplies: { torches: 1, rations: 2, kitUses: 1, mouths: 2 }, destination: 'el gremio' }).no).toBe('Volvemos al gremio');
    });

    test('el kit de curandero: diez usos, se gasta uno y el último se tira', () => {
        const kit = { id: 'k', name: 'Kit de curandero' };
        expect(isHealerKit(kit)).toBe(true);
        expect(usesLeft(kit)).toBe(KIT_USES);
        const medic = { name: 'Mira', items: [{ ...kit, uses: 2 }] };
        expect(kitUsesOf(medic)).toBe(2);
        expect(partyKitUses([medic, { items: [kit] }])).toBe(12);
        expect(kitCarrier([{ name: 'Bran', items: [] }, medic], { name: 'Bran', items: [] })).toBe(medic);
        const once = spendKitUse(medic.items);
        expect(once).toMatchObject({ spent: true, left: 1 });
        const twice = spendKitUse(once.items);
        expect(twice).toMatchObject({ spent: true, left: 0, items: [] });
        expect(spendKitUse([]).spent).toBe(false);
        expect(describeKitLeft(0)).toMatch(/último uso/);
        expect(describeKitLeft(3)).toMatch(/quedan 3 usos/);
    });

    test('la tienda los conoce: antorcha, raciones y kit, con su precio', () => {
        expect(describeLootItem('Antorcha')).toMatchObject({ price: 1 });
        expect(describeLootItem('Kit de curandero')).toMatchObject({ price: 5, uses: 10 });
        expect(describeLootItem('Raciones de viaje')).toMatchObject({ price: 1 });
    });
});
