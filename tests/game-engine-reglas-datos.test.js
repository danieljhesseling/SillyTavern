/**
 * Las decisiones de reglas y datos del 2026-09-29 (sección 2.1 de ROADMAP_SIN_CONEXION):
 *
 * - D-J25: los materiales de conjuro, en las tiendas, con su precio; y el foco, exigido.
 * - D-J26: la nigromancia es delito solo si daña o levanta muertos.
 * - D-J29: la tienda y la herrería tienen horario, y cierran el día de descanso y en fiestas.
 * - D-J27 (y J19.8): los rituales se lanzan fuera de combate, y cada uno hace algo.
 *
 * (D-J21, D-J27, D-J30, D-J31 y D-J32 van con los tests de su módulo.)
 */
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { SPELL_SUPPLIES, basePrice, weeklyStock, junkOf, sellPrice, isSpellSupply } from '../public/scripts/game-engine/campaign/shop.js';
import { describeLootItem, declaredLootNames } from '../public/scripts/game-engine/combat/loot-items.js';
import { seasonalMarket } from '../public/scripts/game-engine/campaign/season-market.js';
import { kitFor } from '../public/scripts/game-engine/campaign/starting-kit.js';
import { hasFocus, componentsCheck } from '../public/scripts/game-engine/rules/spell-cast.js';
import { casterOf } from '../public/scripts/game-engine/rules/spell-slots.js';
import { normalizeSpell } from '../public/scripts/game-engine/rules/spell-catalogue.js';
import { magicIsCrime } from '../public/scripts/game-engine/campaign/crime.js';
import { SPELLS, grimoireAbilities } from '../public/scripts/game-engine/rules/grimoire.js';
import {
    SHOPS, WEEK_DAYS, isRestDay, closedReason, closedSign, closedLine, closeShopCards,
} from '../public/scripts/game-engine/campaign/hours.js';
import { townPlaces, greetingFor, describeWho } from '../public/scripts/game-engine/campaign/town.js';
import { whoIsWhere, townsfolkPlace, placeOpen, meetPlaces } from '../public/scripts/game-engine/campaign/whereabouts.js';
import { createCalendar } from '../public/scripts/game-engine/campaign/calendar.js';
import { focusItemFor, focusGift, supplyHolder, carries, canCastSpell } from '../public/scripts/game-engine/rules/spell-cast.js';
import {
    ritualKind, ritualChoices, isMagical, detectMagic, identifyAll, purifyAll, summonFamiliar, setAlarm, alarmActive,
    understandTongues, ALARM_WATCH_BONUS,
} from '../public/scripts/game-engine/rules/rituals.js';
import { languageBarrier, understandsAll } from '../public/scripts/game-engine/rules/languages.js';

const read = (/** @type {string} */ path) => JSON.parse(readFileSync(new URL(`../public/${path}`, import.meta.url), 'utf8'));
const catalogue = read('compendio/conjuros.json').rows;
const classes = read('compendio/clases.json').rows;
const forms = ['armas', 'armaduras', 'trastos'].flatMap(domain => read(`compendio/${domain}.json`).rows);
const spell = (/** @type {string} */ id) => normalizeSpell(catalogue.find((/** @type {any} */ r) => r.id === id));
const cls = (/** @type {string} */ id) => classes.find((/** @type {any} */ r) => r.id === id);

describe('D-J25: los materiales de conjuro se venden, y después se exigen', () => {
    test('cada material que pide un conjuro está en la tienda, con el precio que se decidió', () => {
        const prices = Object.fromEntries(SPELL_SUPPLIES.map(name => [name, basePrice(describeLootItem(name))]));
        expect(prices).toEqual({
            'Bolsa de componentes': 25, 'Laúd': 35, 'Incienso y hierbas': 10, 'Agua bendita': 25, 'Perla': 100, 'Diamante': 300,
        });
        const wanted = catalogue.filter((/** @type {any} */ r) => r.material?.name).map((/** @type {any} */ r) => r.material.name);
        expect(wanted.length).toBeGreaterThan(0);
        for (const name of wanted) expect(SPELL_SUPPLIES).toContain(name);
        for (const name of SPELL_SUPPLIES) expect(declaredLootNames()).toContain(name);
    });

    test('siempre en el género: delante de lo de la semana, sin quitarle sitio', () => {
        const describe = () => ({ category: 'gear' });
        const stock = weeklyStock({ names: ['A', 'B', 'C', 'D', 'E', ...SPELL_SUPPLIES], describe, random: () => 0.3, always: ['Red', ...SPELL_SUPPLIES] });
        expect(stock.slice(0, 1 + SPELL_SUPPLIES.length)).toEqual(['Red', ...SPELL_SUPPLIES]);
        expect(stock.filter(n => /^[A-E]$/.test(n))).toHaveLength(4);
    });

    test('donde persiguen la magia, los componentes no; la perla, el agua bendita y el laúd, sí', () => {
        const banned = SPELL_SUPPLIES.filter(name => seasonalMarket({ name, spec: describeLootItem(name), magic: 'persigue' }).banned);
        expect(banned.sort()).toEqual(['Bolsa de componentes', 'Incienso y hierbas']);
    });

    test('lo que piden los conjuros no es chatarra, ni se malvende', () => {
        const member = { id: 1, items: [
            { id: 'l', name: 'Laúd' }, { id: 'p', name: 'Perla', price: 100 }, { id: 'b', name: 'Bolsa de componentes' }, { id: 'd', name: 'Daga' },
        ] };
        expect(junkOf([member]).map(j => j.name)).toEqual(['Daga']);
        expect(isSpellSupply({ name: 'Ámbar', subcategory: 'component' })).toBe(true);
        expect(sellPrice({ name: 'Perla', price: 100 })).toBe(40);
    });

    test('quien lanza con foco empieza con él: el bardo con su laúd; el explorador y el erudito, con la bolsa', () => {
        for (const row of classes.filter((/** @type {any} */ r) => casterOf(r))) {
            const kit = kitFor({ classRow: row, forms }).map(p => p.name);
            expect({ id: row.id, ok: hasFocus(kit, casterOf(row)?.focus ?? '') }).toEqual({ id: row.id, ok: true });
        }
        expect(kitFor({ classRow: cls('bardo'), forms }).map(p => p.name)).toContain('Laúd');
    });

    test('el foco se exige, y lo que falta se dice llano', () => {
        expect(componentsCheck(spell('mag-bola-fuego'), { carried: [], focus: 'Arcane' }).reason)
            .toBe('Para Bola de fuego hace falta un foco (un bastón, una varita o un orbe) o una bolsa de componentes. Se compran en las tiendas.');
        expect(componentsCheck(spell('conj-identificar'), { carried: ['Bolsa de componentes'], focus: 'Arcane' }).reason)
            .toBe('Para Identificar hace falta: perla (100 de oro). Se compra en las tiendas.');
        expect(componentsCheck(spell('conj-encontrar-familiar'), { carried: [] }).reason)
            .toBe('Para Encontrar familiar hace falta: incienso y hierbas (10 de oro), que se gasta al lanzarlo. Se compra en las tiendas.');
    });

    test('si lo lleva otro del grupo, se dice quién, no que se compra', () => {
        const others = [{ name: 'Tessa', carried: [{ name: 'Perla' }, { name: 'Bolsa de componentes' }], focus: '' }];
        expect(componentsCheck(spell('conj-identificar'), { carried: ['Bolsa de componentes'], focus: 'Arcane', others }).reason)
            .toBe('Para Identificar hace falta: perla (100 de oro). Lo lleva Tessa: pásaselo desde su ficha («Dar a…»).');
        expect(componentsCheck(spell('mag-bola-fuego'), { carried: [], focus: 'Arcane', others }).reason)
            .toBe('Para Bola de fuego hace falta un foco (un bastón, una varita o un orbe) o una bolsa de componentes. Lo lleva Tessa: pásaselo desde su ficha («Dar a…»).');
        // El foco de quien también lanza no se ofrece: le hace falta a él.
        const cleric = [{ name: 'Doc', carried: [{ name: 'Bolsa de componentes' }], focus: 'Divine' }];
        expect(componentsCheck(spell('mag-bola-fuego'), { carried: [], focus: 'Arcane', others: cleric }).reason).toMatch(/Se compran en las tiendas\.$/);
        expect(carries(['Perla negra'], 'Perla')).toBe(true);
        expect(carries(['Perlas'], 'Perla')).toBe(false);
    });

    test('el compañero que lanza llega con su foco, una vez; tu héroe, no', () => {
        expect(focusItemFor('Instrument')).toBe('Laúd');
        expect(focusItemFor('Divine')).toBe('Bolsa de componentes');
        const doc = { name: 'Doc', class: 'clerigo', items: [] };
        expect(focusGift({ member: doc, classRow: cls('clerigo') })).toBe('Bolsa de componentes');
        expect(focusGift({ member: { ...doc, class: 'bardo' }, classRow: cls('bardo') })).toBe('Laúd');
        expect(focusGift({ member: doc, classRow: cls('clerigo'), isHero: true })).toBe('');
        expect(focusGift({ member: { ...doc, focusGiven: true }, classRow: cls('clerigo') })).toBe('');
        expect(focusGift({ member: { ...doc, items: [{ name: 'Escudo' }] }, classRow: cls('clerigo') })).toBe('');
        expect(focusGift({ member: { ...doc, guest: { kind: 'ward' } }, classRow: cls('clerigo') })).toBe('');
        expect(focusGift({ member: { name: 'Bran', items: [] }, classRow: cls('guerrero') })).toBe('');
    });

    test('lo que se compra va a quien lo necesita: el laúd al bardo, la perla a quien sabe Identificar', () => {
        const casters = [
            { id: 1, name: 'Tessa', focus: 'Arcane', carried: [{ name: 'Bastón' }], needs: ['Perla'] },
            { id: 2, name: 'Lira', focus: 'Instrument', carried: [], needs: [] },
            { id: 3, name: 'Doc', focus: 'Divine', carried: [], needs: ['Diamante'] },
        ];
        expect(supplyHolder({ name: 'Laúd', casters })).toEqual({ id: 2, name: 'Lira', why: 'focus' });
        expect(supplyHolder({ name: 'Bolsa de componentes', casters })).toEqual({ id: 2, name: 'Lira', why: 'focus' });
        expect(supplyHolder({ name: 'Perla', casters })).toEqual({ id: 1, name: 'Tessa', why: 'material' });
        expect(supplyHolder({ name: 'Diamante', casters })).toEqual({ id: 3, name: 'Doc', why: 'material' });
        // Si ya lo lleva, o no le hace falta a nadie, se lo queda el héroe.
        expect(supplyHolder({ name: 'Perla', casters: [{ ...casters[0], carried: [{ name: 'Perla' }] }] })).toBeNull();
        expect(supplyHolder({ name: 'Red', casters })).toBeNull();
    });
});

describe('D-J26: la nigromancia es delito si daña o levanta muertos', () => {
    test('en el compendio: Toque helado, Infligir heridas, Toque vampírico y Animar a los muertos, sí', () => {
        const necro = catalogue.filter((/** @type {any} */ r) => r.school === 'nigromancia');
        const crimes = necro.filter(magicIsCrime).map((/** @type {any} */ r) => r.name).sort();
        expect(crimes).toEqual(['Animar a los muertos', 'Infligir heridas', 'Toque helado', 'Toque vampírico']);
        const fine = necro.filter((/** @type {any} */ r) => !magicIsCrime(r)).map((/** @type {any} */ r) => r.name).sort();
        expect(fine).toEqual(['Estabilizar', 'Hablar con los muertos', 'Revivir']);
    });

    test('en el grimorio que se juega hoy: el Toque vampírico sí; Hablar con los muertos, no', () => {
        const abilities = grimoireAbilities();
        expect(magicIsCrime(abilities.find(a => a.id === 'mag-toque-vampirico'))).toBe(true);
        expect(magicIsCrime(abilities.find(a => a.id === 'mag-hablar-muertos'))).toBe(false);
        // Y leído como fila del grimorio, con lo que hace dentro de `ability`.
        expect(magicIsCrime(SPELLS.find(s => s.id === 'mag-toque-vampirico'))).toBe(true);
    });

    test('lo que no es nigromancia no es delito, aunque dañe; una maldición sobre alguien, sí', () => {
        expect(magicIsCrime({ school: 'evocacion', damage: '8d6' })).toBe(false);
        expect(magicIsCrime({ school: 'nigromancia', target: 'enemy', condition: 'Blinded' })).toBe(true);
        expect(magicIsCrime({ school: 'nigromancia', target: 'ally', healing: '1d8' })).toBe(false);
        expect(magicIsCrime(null)).toBe(false);
    });
});

describe('D-J29: la tienda y la herrería tienen horario, y cierran algunos días', () => {
    test('el día de descanso es el séptimo de cada semana', () => {
        expect(WEEK_DAYS).toBe(7);
        expect([1, 6, 7, 8, 14, 21, 0].map(isRestDay)).toEqual([false, false, true, false, true, true, false]);
    });

    test('por qué está cerrado: la fiesta y el descanso, todo el día; si no, la noche', () => {
        expect(SHOPS).toEqual(['tienda', 'herreria']);
        expect(closedReason({ service: 'tienda', slot: 'morning', day: 3 })).toBe('');
        expect(closedReason({ service: 'tienda', slot: 'night', day: 3 })).toBe('noche');
        expect(closedReason({ service: 'herreria', slot: 'morning', day: 7 })).toBe('descanso');
        expect(closedReason({ service: 'tienda', slot: 'afternoon', day: 3, festival: 'la Vendimia' })).toBe('fiesta');
        // La posada y el templo no cierran nunca.
        expect(closedReason({ service: 'posada', slot: 'night', day: 7, festival: 'la Vendimia' })).toBe('');
        expect(closedReason({ service: 'templo', slot: 'night', day: 14 })).toBe('');
    });

    test('se dice llano, en el cartel y en la frase', () => {
        expect(closedSign('noche')).toBe('Cerrado: es de noche');
        expect(closedSign('descanso')).toBe('Cerrado hoy: día de descanso');
        expect(closedSign('fiesta')).toBe('Cerrado hoy: es fiesta');
        expect(closedLine({ service: 'tienda', keeper: 'Marisa', innHere: true, reason: 'noche' }))
            .toBe('La tienda está cerrada: es de noche. Marisa está en la posada, con una jarra. Abre por la mañana.');
        expect(closedLine({ service: 'herreria', keeper: 'Ramiro', innHere: true, reason: 'descanso' }))
            .toBe('La herrería está cerrada hoy: es el día de descanso. Ramiro está en la posada, con una jarra. Abre mañana.');
        expect(closedLine({ service: 'tienda', keeper: 'Marisa', reason: 'fiesta', festival: 'la Vendimia' }))
            .toBe('La tienda está cerrada hoy: es la Vendimia. Marisa se ha ido a casa. Abre mañana.');
    });

    const cards = [
        { id: 'posada', actions: [{ id: 'inn-room', enabled: true, detail: 'Un descanso largo.' }] },
        { id: 'tienda', actions: [{ id: 'shop-buy:Red', enabled: true, detail: 'Al precio de siempre.' }] },
        { id: 'herreria', actions: [{ id: 'craft:capa', enabled: true, detail: 'Una capa.' }] },
    ];
    const keepers = [{ name: 'Marisa', service: 'tienda' }, { name: 'Ramiro', service: 'herreria' }];
    const at = (/** @type {number} */ slotIndex, day = 1) => ({ ...createCalendar(), day, slotIndex });

    test('de día, todo abierto; de noche, la tienda y la herrería se ven pero no se pulsan', () => {
        expect(closeShopCards(cards, { calendar: at(0, 2), keepers, innHere: true })).toEqual(cards);
        const night = closeShopCards(cards, { calendar: at(2, 2), keepers, innHere: true });
        expect(night[0]).toEqual(cards[0]);
        expect(night[1].closed).toEqual({
            reason: 'noche', sign: 'Cerrado: es de noche', keeper: 'Marisa',
            line: 'La tienda está cerrada: es de noche. Marisa está en la posada, con una jarra. Abre por la mañana.',
        });
        expect(night[1].actions).toEqual([{ id: 'shop-buy:Red', enabled: false, detail: night[1].closed?.line }]);
        expect(night[2].closed?.sign).toBe('Cerrado: es de noche');
    });

    test('el día de descanso y en fiestas, cerradas todo el día', () => {
        expect(closeShopCards(cards, { calendar: at(0, 7), keepers, innHere: true })[1].closed?.sign).toBe('Cerrado hoy: día de descanso');
        expect(closeShopCards(cards, { calendar: at(1, 3), festival: 'la Feria del Grano', keepers })[2].closed?.line)
            .toBe('La herrería está cerrada hoy: es la Feria del Grano. Ramiro se ha ido a casa. Abre mañana.');
        // Un reloj con franjas a medida no cierra por la hora: lo que no se sabe no se cierra.
        const odd = { version: 1, day: 2, slotIndex: 0, slots: [{ id: 'alba', label: 'Alba', advancesDay: false }, { id: 'ocaso', label: 'Ocaso', advancesDay: true }] };
        expect(closeShopCards(cards, { calendar: odd })).toEqual(cards);
    });

    test('la pantalla del pueblo lo dice en el cartel, y quien lo lleva está en la taberna', () => {
        const alba = read('mundos/gremio.pack.json').locations[0];
        const location = { ...alba, places: alba.places.map((/** @type {any} */ p) => ({ ...p, keeper: { brunilda: 'Brunilda', ramiro: 'Ramiro', tomas: 'Tomás', marisa: 'Marisa', elvira: 'Madre Elvira' }[p.keeper] ?? p.keeper })) };
        const npcs = [
            { name: 'Brunilda', where: 'Puerto Alba', service: 'gremio', trade: 'Maestra del gremio' },
            { name: 'Tomás', where: 'Puerto Alba', service: 'posada', trade: 'Posadero' },
            { name: 'Ramiro', where: 'Puerto Alba', service: 'herreria', trade: 'Herrero' },
            { name: 'Marisa', where: 'Puerto Alba', service: 'tienda', trade: 'Tendera' },
            { name: 'Madre Elvira', where: 'Puerto Alba', service: 'templo', trade: 'Sacerdotisa' },
        ];
        const shut = closeShopCards(cards, { calendar: at(2, 3), keepers: npcs, innHere: true });
        const { places } = townPlaces({ location, npcs, cards: shut, guild: true });
        const shop = /** @type {any} */ (places.find(p => p.id === 'tienda'));
        expect(shop).toMatchObject({ keeper: null, closed: 'Cerrado: es de noche' });
        expect(describeWho(shop)).toBe('Cerrado: es de noche');
        expect(greetingFor({ place: shop, slot: 'Noche', hero: 'Tessa' }))
            .toBe('La tienda está cerrada: es de noche. Marisa está en la posada, con una jarra. Abre por la mañana.');
        const tavern = /** @type {any} */ (places.find(p => p.id === 'posada'));
        expect(tavern.keeper?.name).toBe('Tomás');
        expect(tavern.people.map((/** @type {any} */ p) => p.name)).toEqual(expect.arrayContaining(['Marisa', 'Ramiro']));
        // De día, Marisa atiende.
        const day = townPlaces({ location, npcs, cards: closeShopCards(cards, { calendar: at(0, 3), keepers: npcs, innHere: true }), guild: true }).places;
        expect(day.find(p => p.id === 'tienda')?.keeper?.name).toBe('Marisa');
    });

    test('quién está dónde: el día de descanso, la tendera también está en la posada', () => {
        const places = ['posada', 'tienda', 'herreria', 'plaza'];
        expect(townsfolkPlace({ npc: { name: 'Marisa', service: 'tienda' }, places, slot: 'morning' })).toBe('tienda');
        expect(townsfolkPlace({ npc: { name: 'Marisa', service: 'tienda' }, places, slot: 'morning', when: { day: 7 } })).toBe('posada');
        expect(townsfolkPlace({ npc: { name: 'Ramiro', service: 'herreria' }, places, slot: 'afternoon', when: { day: 3, festival: 'la Vendimia' } })).toBe('posada');
        expect(placeOpen('tienda', 'morning', { day: 14 })).toBe(false);
        expect(placeOpen('posada', 'morning', { day: 14 })).toBe(true);
        expect(meetPlaces({ places, slot: 'morning', day: 7 }).map(p => p.id)).toEqual(['posada', 'plaza']);
        const seen = whoIsWhere({ town: 'Puerto Alba', slot: 'morning', places, day: 7, townsfolk: [{ name: 'Marisa', where: 'Puerto Alba', service: 'tienda' }] });
        expect(seen.people.find(p => p.name === 'Marisa')?.place).toBe('posada');
        expect(seen.places.find(p => p.id === 'tienda')?.open).toBe(false);
    });
});

describe('D-J27: los rituales se lanzan fuera de combate, y cada uno hace algo', () => {
    const erudito = cls('erudito');
    const book = ['conj-detectar-magia', 'conj-comprender-idiomas', 'conj-identificar', 'conj-encontrar-familiar', 'conj-alarma'];
    const tomas = { id: 7, name: 'Tomás', level: 3, intelligence: 16, class: 'erudito', spellbook: book, items: [{ id: 'b', name: 'Bolsa de componentes' }] };
    /** @param {any[]} extra @param {any} [state] @param {boolean} [inCombat] */
    const choices = (extra = [], state = {}, inCombat = false) =>
        ritualChoices({ member: tomas, classRow: erudito, catalogue, carried: [...tomas.items, ...extra], state, inCombat });
    /** @param {any[]} list @param {string} id */
    const pick = (list, id) => list.find(c => c.id === id);

    test('los de su libro, cada uno con lo que hace; lo que falta, dicho llano', () => {
        const list = choices();
        expect(list.map(c => c.id).sort()).toEqual([...book].sort());
        expect(pick(list, 'conj-detectar-magia')).toMatchObject({ kind: 'detect', ok: true, reason: '', minutes: 10 });
        expect(pick(list, 'conj-comprender-idiomas')).toMatchObject({ kind: 'tongues', ok: true });
        expect(pick(list, 'conj-alarma')).toMatchObject({ kind: 'alarm', ok: true, minutes: 11 });
        expect(pick(list, 'conj-identificar')).toMatchObject({ ok: false, reason: 'Para Identificar hace falta: perla (100 de oro). Se compra en las tiendas.' });
        expect(pick(list, 'conj-encontrar-familiar').reason)
            .toBe('Para Encontrar familiar hace falta: incienso y hierbas (10 de oro), que se gasta al lanzarlo. Se compra en las tiendas.');
        // Con lo que piden, sí; y el incienso se gasta, la perla no.
        const stocked = choices([{ name: 'Perla' }, { name: 'Incienso y hierbas' }], { unknownItems: 2 });
        expect(pick(stocked, 'conj-identificar')).toMatchObject({ ok: true, consumes: [] });
        expect(pick(stocked, 'conj-encontrar-familiar')).toMatchObject({ ok: true, consumes: ['Incienso y hierbas'], minutes: 70 });
    });

    test('no se lanza lo que no serviría de nada, ni peleando', () => {
        const state = { unknownItems: 0, pet: 'Graznido, el cuervo', alarmSet: true };
        const list = choices([{ name: 'Perla' }, { name: 'Incienso y hierbas' }], state);
        expect(pick(list, 'conj-identificar').reason).toBe('No lleváis nada sin identificar.');
        expect(pick(list, 'conj-encontrar-familiar').reason).toBe('Ya os acompaña Graznido, el cuervo: un familiar no se queda donde ya hay mascota.');
        expect(pick(list, 'conj-alarma').reason).toBe('La alarma ya está puesta para esta noche.');
        expect(choices([], {}, true).every(c => !c.ok && c.reason === 'Un ritual lleva diez minutos: peleando no hay tiempo.')).toBe(true);
        // Silencio solo sirve peleando.
        expect(ritualKind(spell('conj-silencio'))).toBe('');
        const lira = { id: 8, name: 'Lira', level: 3, charisma: 16, spellsKnown: ['conj-silencio'], items: [{ name: 'Laúd' }] };
        expect(ritualChoices({ member: lira, classRow: cls('bardo'), catalogue, carried: lira.items })[0])
            .toMatchObject({ ok: false, reason: 'Silencio solo sirve peleando, y un ritual no se lanza peleando.' });
        // Y, sin ritual, el erudito no lanza nada: sin espacios.
        expect(canCastSpell({ member: tomas, classRow: erudito, spell: spell('conj-detectar-magia'), inCombat: false, carried: tomas.items }).ok).toBe(false);
    });

    const party = [
        { id: 7, name: 'Tomás', items: [{ id: 'v', name: 'Varita de escarcha' }, { id: 'd', name: 'Daga' }] },
        { id: 8, name: 'Bran', items: [
            { id: 'a', name: 'Anillo de plata', rarity: 'uncommon', identified: false, cursed: true, curse: { label: 'Maldición de la torpeza', note: 'Las manos no obedecen.' } },
            { id: 'e', name: 'Espada larga +1' },
        ], needs: { hunger: 3, thirst: 2, rest: 1 } },
    ];

    test('Detectar magia dice qué tiene magia, y avisa de lo maldito que aún no se sabía', () => {
        expect(isMagical({ name: 'Daga' })).toBe(false);
        expect(isMagical({ name: 'Espada larga +1' })).toBe(true);
        expect(detectMagic({ caster: 'Tomás', party })).toEqual([
            'Tomás cierra los ojos y nota la magia que hay a su alrededor.',
            'Tiene magia: Varita de escarcha (lo lleva Tomás), Anillo de plata (lo lleva Bran), Espada larga +1 (lo lleva Bran).',
            'Cuidado con Anillo de plata (lo lleva Bran): está maldito. No os lo pongáis; en un templo se quita.',
        ]);
        expect(detectMagic({ caster: 'Tomás', party: [{ name: 'Bran', items: [{ name: 'Daga' }] }] })[1]).toBe('Nada de lo que lleváis tiene magia.');
    });

    test('Identificar hace lo del templo; Purificar quita el hambre y la sed', () => {
        const seen = identifyAll({ caster: 'Tomás', party });
        expect(seen.changes).toEqual([{ memberId: '8', itemId: 'a', item: expect.objectContaining({ identified: true, cursed: true }) }]);
        expect(seen.lines).toEqual(['Tomás estudia lo que lleváis, con la perla en la mano.', 'Anillo de plata: Maldición de la torpeza. Las manos no obedecen.']);
        const clean = purifyAll({ caster: 'Tomás', party });
        expect(clean.changes.find(c => c.memberId === '8')?.needs).toMatchObject({ hunger: 0, thirst: 0, rest: 1 });
        expect(clean.lines[0]).toBe('Tomás limpia la comida y el agua que lleváis: nadie del grupo pasa hambre ni sed por ahora.');
    });

    test('Encontrar familiar trae una mascota; Alarma vale esa noche; Comprender idiomas, esa parte del día', () => {
        const familiar = summonFamiliar({ caster: 'Tomás', random: () => 0 });
        expect(familiar.pet).toMatchObject({ name: 'Ceniza', species: 'familiar', character: 'curiosa' });
        expect(familiar.lines[0]).toBe('Entre el humo del incienso aparece Ceniza, su familiar, y se queda con Tomás. Ve y oye por vosotros, y hace guardia de noche.');

        const calendar = { ...createCalendar(), day: 4, slotIndex: 1 };
        const alarm = setAlarm({ caster: 'Tomás', calendar });
        expect(alarm.lines[0]).toBe(`Tomás pone una alarma alrededor de donde dormiréis: esta noche, si alguien se acerca, sonará una campanilla (+${ALARM_WATCH_BONUS} a la guardia).`);
        expect(alarmActive(alarm.alarm, { ...calendar, slotIndex: 2 })).toBe(true);
        expect(alarmActive(alarm.alarm, { ...calendar, day: 5 })).toBe(false);

        const tongues = understandTongues({ caster: 'Tomás', calendar });
        expect(tongues.lines[0]).toBe('Hasta que acabe la tarde, Tomás entiende cualquier lengua que oiga o lea: al calar a alguien que habla otra, no va con desventaja.');
        const reader = { name: 'Tomás', hp: 10, tongues: tongues.tongues };
        expect(understandsAll(reader, calendar)).toBe(true);
        expect(understandsAll(reader, { ...calendar, slotIndex: 2 })).toBe(false);
        // Calar, sí; convencer, no: entender no es hablar.
        expect(languageBarrier({ speaker: reader, party: [reader], language: 'enano', skill: 'insight', now: calendar }).edge).toBe('');
        expect(languageBarrier({ speaker: reader, party: [reader], language: 'enano', skill: 'persuasion', now: calendar }).edge).toBe('disadvantage');
        expect(languageBarrier({ speaker: reader, party: [reader], language: 'enano', skill: 'insight', now: { ...calendar, day: 5 } }).edge).toBe('disadvantage');
    });
});
