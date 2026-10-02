/**
 * J14.11: trabajos y ratos libres (`campaign/pastimes.js`) y las cartas de la taberna,
 * «Mayor o menor» (`campaign/card-game.js`): qué se ofrece en cada sitio, qué da cada uno y que
 * el juego de cartas sea honrado (ninguna jugada gana de media) con las probabilidades a la vista.
 */
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import {
    CARD_BETS, MAX_GUESSES, MAX_MULTIPLIER, RANKS, SUITS, newDeck, cardName, startCards, potIfRight, oddsOf, canStand,
    guessCard, standCards, cardsNet, describeSide, describeCards,
} from '../public/scripts/game-engine/campaign/card-game.js';
import {
    PASTIMES, PASTIMES_KEY, FORGE_STEPS, HELPER_GOLD, READ_XP_PER_LEVEL, LIBRARY_XP_PER_LEVEL, FORGE_BONUS_GOLD, CHOICES,
    readPastimes, pastimeOffers, docksPlace, pastimeScene, choiceOf, pastimeOutcome, pastimeLog, sayList,
} from '../public/scripts/game-engine/campaign/pastimes.js';
import { WORK_GOLD_BASE } from '../public/scripts/game-engine/campaign/day-parts.js';
import { renderScene, startScene, sceneStep, sceneView } from '../public/scripts/game-engine/campaign/meetups.js';
import { BOND_EVENTS, createBondState, recordBondEvent } from '../public/scripts/game-engine/campaign/bonds.js';
import { getRecordableEvents } from '../public/scripts/game-engine/campaign/campaign-view.js';
import { createSeededRandom } from '../public/scripts/game-engine/combat/seeded-random.js';
import { STATE_KEYS } from '../public/scripts/game-engine/campaign/state-registry.js';
import { sideButton, sameLine, potLine } from '../public/scripts/game-engine/ui/pastime-scene.js';
import { TRAIN_XP_PER_LEVEL } from '../public/scripts/game-engine/campaign/day-parts.js';
import { GUILD_TRAINING_FACTOR, CATCH_UP_FACTOR } from '../public/scripts/game-engine/campaign/guild-training.js';
import { townPlaces } from '../public/scripts/game-engine/campaign/town.js';
import { buildImportPlan } from '../public/scripts/game-engine/campaign/campaign-importer.js';

const read = (/** @type {string} */ path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

/** Un azar que da siempre lo mismo. */
const fixed = (/** @type {number} */ v) => () => v;

/** Una partida a mano: esta carta en la mesa y estas por salir. */
const table = (/** @type {number} */ shown, /** @type {number[]} */ deck, pot = 10, bet = 10) => ({
    bet, pot, shown: { value: shown, suit: 'oros' }, deck: deck.map(value => ({ value, suit: 'copas' })),
    drawn: [{ value: shown, suit: 'oros' }], guesses: 0, state: /** @type {'guess'} */ ('guess'), last: /** @type {''} */ (''),
});

describe('las cartas: «Mayor o menor»', () => {
    test('la baraja española: cuarenta cartas distintas, del as al rey en cuatro palos', () => {
        const deck = newDeck(createSeededRandom(7));
        expect(deck).toHaveLength(40);
        expect(new Set(deck.map(c => `${c.value}-${c.suit}`)).size).toBe(40);
        expect(SUITS.map(s => s.id)).toEqual(['oros', 'copas', 'espadas', 'bastos']);
        expect(RANKS.map(r => r.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        expect(cardName({ value: 9, suit: 'copas' })).toBe('el caballo de copas');
        expect(cardName({ value: 1, suit: 'oros' }, { article: false })).toBe('As de oros');
    });

    test('sentarse: lo apostado al bote y una carta boca arriba; una apuesta rara se queda en la mínima', () => {
        const game = startCards(10, createSeededRandom(3));
        expect(game.pot).toBe(10);
        expect(game.bet).toBe(10);
        expect(game.deck).toHaveLength(39);
        expect(game.drawn).toEqual([game.shown]);
        expect(game.state).toBe('guess');
        expect(startCards(7, createSeededRandom(3)).bet).toBe(CARD_BETS[0]);
    });

    test('las probabilidades se cuentan con las cartas que quedan', () => {
        // Un cinco en la mesa y, por salir: dos mayores, un cinco y un menor.
        const odds = oddsOf(table(5, [7, 9, 5, 2]));
        expect(odds.left).toBe(4);
        expect(odds.higher).toBe(2);
        expect(odds.lower).toBe(1);
        expect(odds.same).toBe(1);
        expect(odds.mayor.percent).toBe(50);
        expect(odds.menor.percent).toBe(25);
        // Paga lo justo: al 50 %, el doble; al 25 %, el cuádruple.
        expect(odds.mayor.pot).toBe(20);
        expect(odds.menor.pot).toBe(40);
    });

    test('lo que se lee antes de elegir: cuántas de cuántas, el tanto por ciento y el bote', () => {
        const game = table(5, [7, 9, 5, 2]);
        expect(describeSide(game, 'mayor')).toBe('Mayor: 2 de 4 cartas (50 %). Si aciertas, el bote sube a 20.');
        expect(describeSide(table(1, [3, 4]), 'menor')).toBe('Menor: no queda ninguna carta menor.');
        // Lo casi seguro no paga: el bote se queda como está.
        expect(describeSide(table(1, [3, 4, 5, 6, 7, 8, 9, 10, 1], 5, 5), 'mayor')).toMatch(/el bote se queda en 5/);
    });

    test('honrado: ninguna jugada gana de media (la probabilidad por el bote nuevo nunca pasa del bote)', () => {
        const random = createSeededRandom(11);
        for (let round = 0; round < 400; round++) {
            let game = startCards(CARD_BETS[round % CARD_BETS.length], random);
            while (game.state === 'guess') {
                const odds = oddsOf(game);
                for (const side of /** @type {const} */ (['mayor', 'menor'])) {
                    if (!odds[side].possible) continue;
                    expect(odds[side].chance * odds[side].pot).toBeLessThanOrEqual(game.pot + 1e-9);
                    expect(odds[side].pot).toBeLessThanOrEqual(game.bet * MAX_MULTIPLIER);
                    expect(odds[side].pot).toBeGreaterThanOrEqual(game.pot);
                }
                const side = odds.mayor.chance >= odds.menor.chance ? 'mayor' : 'menor';
                game = guessCard(game, side);
            }
        }
    });

    test('y tampoco pierde mucho: jugando con cabeza se pierde de media menos de una décima parte de lo apostado', () => {
        const random = createSeededRandom(2026);
        const runs = 20000;
        let careful = 0;
        let greedy = 0;
        for (let i = 0; i < runs; i++) {
            // Con cabeza: el lado más probable y plantarse al primer acierto.
            let game = startCards(10, random);
            const odds = oddsOf(game);
            game = guessCard(game, odds.mayor.chance >= odds.menor.chance ? 'mayor' : 'menor');
            careful += cardsNet(standCards(game));
            // A por todo: el más probable hasta el tercer acierto.
            let all = startCards(10, random);
            while (all.state === 'guess') {
                const o = oddsOf(all);
                all = guessCard(all, o.mayor.chance >= o.menor.chance ? 'mayor' : 'menor');
            }
            greedy += cardsNet(all);
        }
        expect(careful / runs).toBeLessThanOrEqual(0);
        expect(careful / runs).toBeGreaterThan(-1);
        expect(greedy / runs).toBeLessThanOrEqual(0);
        expect(greedy / runs).toBeGreaterThan(-2);
    });

    test('acertar hace crecer el bote; fallar o sacar igual lo pierde', () => {
        const right = guessCard(table(5, [8, 2]), 'mayor');
        expect(right.state).toBe('guess');
        expect(right.guesses).toBe(1);
        expect(right.pot).toBe(20);
        expect(right.shown.value).toBe(8);
        expect(canStand(right)).toBe(true);

        const wrong = guessCard(table(5, [2, 8]), 'mayor');
        expect(wrong.state).toBe('lost');
        expect(wrong.pot).toBe(0);
        expect(cardsNet(wrong)).toBe(-10);

        const tie = guessCard(table(5, [5, 8]), 'mayor');
        expect(tie.state).toBe('lost');
        expect(tie.tie).toBe(true);
        expect(describeCards(tie)).toMatch(/igual, y la igual pierde/);
    });

    test('lo imposible no se juega, y plantarse solo vale tras un acierto', () => {
        const game = table(1, [3, 4]);
        expect(guessCard(game, 'menor')).toBe(game);
        expect(canStand(game)).toBe(false);
        expect(standCards(game)).toBe(game);
        const won = standCards(guessCard(table(5, [8, 2]), 'mayor'));
        expect(won.state).toBe('won');
        expect(cardsNet(won)).toBe(10);
        expect(describeCards(won)).toMatch(/te llevas el bote: 20 de oro, 10 más de lo que pusiste/);
    });

    test(`al acierto número ${MAX_GUESSES} se cobra solo`, () => {
        let game = table(1, [2, 3, 4, 5, 6]);
        for (let i = 0; i < MAX_GUESSES; i++) game = guessCard(game, 'mayor');
        expect(game.state).toBe('won');
        expect(game.guesses).toBe(MAX_GUESSES);
        expect(guessCard(game, 'mayor')).toBe(game);
    });

    test('la mesa no paga más de diez veces lo apostado', () => {
        expect(potIfRight(80, 1, 30, 10)).toBe(10 * MAX_MULTIPLIER);
        expect(potIfRight(10, 0, 30, 10)).toBe(10);
    });

    test('en pantalla: cada botón dice cuántas de cuántas, el tanto por ciento y el bote; y las iguales, aparte', () => {
        const game = table(5, [7, 9, 5, 2]);
        expect(sideButton(game, 'mayor')).toEqual({ label: 'Mayor', odds: '2 de 4 cartas · 50 %', pot: 'Si aciertas, el bote sube a 20', possible: true });
        expect(sideButton(table(1, [3, 4]), 'menor')).toMatchObject({ possible: false, odds: 'No queda ninguna menor' });
        expect(sameLine(game)).toBe('Iguales: 1 de 4 (25 %). Si sale una igual, pierdes.');
        expect(sameLine(table(5, [7, 2]))).toBe('No queda ninguna igual a esta.');
        expect(potLine(game)).toBe(`Bote: 10 de oro · Apostaste 10 · Aciertos: 0 de ${MAX_GUESSES}`);
    });
});

// ---------------------------------------------------------------------------------------

const tavern = (keeper = 'Tomás') => ({ kind: 'posada', keeper: keeper ? { name: keeper } : null });
const forge = (extra = {}) => ({ kind: 'herreria', keeper: { name: 'Ramiro' }, ...extra });
const byId = (/** @type {any[]} */ offers) => Object.fromEntries(offers.map(o => [o.id, o]));

describe('qué se ofrece en cada sitio', () => {
    test('en la taberna por la tarde: servir mesas y las cartas, con lo que dan y lo que gastan', () => {
        const offers = byId(pastimeOffers({ place: tavern(), slot: 'afternoon', purse: 30 }));
        expect(Object.keys(offers)).toEqual(['mesas', 'cartas']);
        expect(offers.mesas.enabled).toBe(true);
        expect(offers.mesas.detail).toMatch(/que Tomás os aprecie más\. Gasta la tarde\./);
        expect(offers.cartas.enabled).toBe(true);
        expect(offers.cartas.detail).toMatch(/probabilidades/);
    });

    test('por la mañana la taberna está vacía; sin oro no se juega a las cartas', () => {
        const offers = byId(pastimeOffers({ place: tavern(), slot: 'morning', purse: 2 }));
        expect(offers.mesas.enabled).toBe(false);
        expect(offers.mesas.detail).toMatch(/de tarde o de noche/);
        const night = byId(pastimeOffers({ place: tavern(), slot: 'night', purse: 2 }));
        expect(night.cartas.enabled).toBe(false);
        expect(night.cartas.detail).toMatch(/al menos 5 de oro/);
    });

    test('la forja: cerrada no, sin herrero no, y dice cuánto falta para la mejora', () => {
        expect(pastimeOffers({ place: forge({ closed: 'Cerrado', closedLine: 'Cerrado: es de noche. Ramiro está en la taberna.' }), slot: 'night' })[0])
            .toMatchObject({ id: 'forja', enabled: false, detail: 'Cerrado: es de noche. Ramiro está en la taberna.' });
        expect(pastimeOffers({ place: { kind: 'herreria', keeper: null }, slot: 'morning' })[0].detail).toMatch(/Nadie atiende/);
        const open = pastimeOffers({ place: forge(), slot: 'morning', forgeSteps: 2 })[0];
        expect(open.enabled).toBe(true);
        expect(open.detail).toMatch(/Llevas 2 de 3 días/);
    });

    test('leer en el gremio a cualquier hora (en la biblioteca, si la hay); pescar solo de día', () => {
        expect(pastimeOffers({ place: { kind: 'gremio' }, slot: 'night' })[0]).toMatchObject({ id: 'leer', label: 'Leer en el gremio', enabled: true });
        expect(pastimeOffers({ place: { kind: 'gremio' }, slot: 'night', library: 1 })[0].label).toBe('Leer en la biblioteca');
        expect(pastimeOffers({ place: { kind: 'muelle' }, slot: 'morning' })[0]).toMatchObject({ id: 'pescar', enabled: true });
        expect(pastimeOffers({ place: { kind: 'muelle' }, slot: 'night' })[0].enabled).toBe(false);
        expect(pastimeOffers({ place: { kind: 'tienda' }, slot: 'morning' })).toEqual([]);
    });

    test('peleando, nada', () => {
        for (const offer of pastimeOffers({ place: tavern(), slot: 'night', purse: 50, fighting: true })) {
            expect(offer.enabled).toBe(false);
            expect(offer.detail).toBe('No mientras peleáis.');
        }
    });

    test('el muelle de un puerto sale como sitio, si la localización no lo trae', () => {
        const alba = { name: 'Puerto Alba', type: 'city', places: [{ kind: 'gremio' }, { kind: 'posada' }] };
        expect(docksPlace({ location: alba, hub: true })).toMatchObject({ id: 'muelle', kind: 'muelle', art: 'muelle', keeper: null });
        expect(docksPlace({ location: { name: 'Puerto Viejo', type: 'village' } })?.kind).toBe('muelle');
        expect(docksPlace({ location: { name: 'Barovia', type: 'village' } })).toBeNull();
        expect(docksPlace({ location: { name: 'Puerto Alba', places: [{ kind: 'muelle' }] }, hub: true })).toBeNull();
    });
});

describe('las escenas', () => {
    test('cada trabajo y cada rato tiene su escena, con quien lleva el sitio', () => {
        for (const id of /** @type {Array<keyof typeof PASTIMES>} */ (Object.keys(PASTIMES))) {
            const scene = pastimeScene(id, { keeper: 'Tomás', slot: 'afternoon', random: fixed(0) });
            expect(scene.beats.length).toBeGreaterThan(0);
            expect(scene.title).toBe(PASTIMES[id].label);
            const choice = CHOICES[id];
            // Donde se decide algo, tantas respuestas como etiquetas; las cartas no deciden en la escena.
            const replies = choice.beat >= 0 ? scene.beats[choice.beat].replies.length : 0;
            expect(replies).toBe(choice.tags.length);
        }
        expect(pastimeScene('pescar', {}).who).toBe('Un pescador viejo');
        expect(pastimeScene('cartas', {}).who).toBe('Un tahúr');
    });

    test('quien viene contigo sale en la escena, y el texto concuerda con tu héroe', () => {
        const scene = pastimeScene('mesas', { keeper: 'Tomás', companions: ['Gerd el Mellado', 'Nella Tresflechas'], slot: 'night' });
        expect(scene.beats[0].note).toMatch(/Gerd y Nella echan una mano/);
        const she = renderScene(scene, { hero: { name: 'Tessa', gender: 'Mujer' } });
        expect(she.beats[1].say).toMatch(/nacida para esto/);
        const he = renderScene(scene, { hero: { name: 'Bruno', gender: 'Hombre' } });
        expect(he.beats[1].say).toMatch(/nacido para esto/);
    });

    test('lo elegido en la escena se lee por su etiqueta', () => {
        const scene = pastimeScene('mesas', { keeper: 'Tomás', slot: 'afternoon' });
        let state = startScene();
        state = sceneStep(scene, state, { next: true });
        expect(sceneView(scene, state).next).toBe('reply');
        state = sceneStep(scene, state, { reply: 1 });
        expect(choiceOf('mesas', state.choices)).toBe('rumor');
        expect(choiceOf('mesas', [])).toBe('propinas');
        expect(choiceOf('cartas', state.choices)).toBe('');
    });
});

describe('lo que da cada uno', () => {
    const hero = { id: 1, name: 'Mara', level: 2 };
    const gerd = { id: 2, name: 'Gerd el Mellado', level: 1 };
    const wage = WORK_GOLD_BASE + 2;

    test('servir mesas a por las propinas: el jornal, las propinas, lo de quien ayuda y el aprecio', () => {
        const out = pastimeOutcome('mesas', { choice: 'propinas', hero, companions: [gerd], random: fixed(0.99) });
        expect(out.gold).toBe(wage + 4 + HELPER_GOLD);
        expect(out.keeperLikes).toBe(true);
        expect(out.rumor).toBe(false);
        expect(out.lines[0]).toBe(`+${wage + 4 + HELPER_GOLD} de oro (${wage} de el jornal, 4 de las propinas, 1 de lo de Gerd).`);
        expect(out.lines).toContain('Gerd y tú, un poco más cerca.');
    });

    test('servir mesas con la oreja puesta: sin propinas, pero un rumor', () => {
        const out = pastimeOutcome('mesas', { choice: 'rumor', hero, random: fixed(0.5) });
        expect(out.gold).toBe(wage);
        expect(out.rumor).toBe(true);
    });

    test('la forja: en monedas cuenta un día; «para mi arma» cuenta dos y no cobra; al tercero, la mejora', () => {
        const coins = pastimeOutcome('forja', { choice: 'monedas', hero, forgeSteps: 0 });
        expect(coins).toMatchObject({ gold: wage, forgeSteps: 1, upgrade: false, keeperLikes: true });
        expect(coins.lines.join(' ')).toMatch(/Llevas 1 de 3 días en la forja: 2 más/);
        const saved = pastimeOutcome('forja', { choice: 'arma', hero, forgeSteps: 0 });
        expect(saved).toMatchObject({ gold: 0, forgeSteps: 2 });
        expect(saved.lines[0]).toMatch(/Hoy no cobras/);
        const done = pastimeOutcome('forja', { choice: 'arma', hero, forgeSteps: 2, canUpgrade: true });
        expect(done).toMatchObject({ upgrade: true, forgeSteps: 0 });
        const nothing = pastimeOutcome('forja', { choice: 'monedas', hero, forgeSteps: FORGE_STEPS - 1, canUpgrade: false });
        expect(nothing).toMatchObject({ upgrade: false, forgeSteps: 0, gold: wage + FORGE_BONUS_GOLD });
    });

    test('leer: experiencia para cada uno por su nivel, y más con biblioteca', () => {
        const out = pastimeOutcome('leer', { hero, companions: [gerd], library: 1 });
        const per = READ_XP_PER_LEVEL + LIBRARY_XP_PER_LEVEL;
        expect(out.xp).toEqual([{ id: '1', name: 'Mara', amount: per * 2 }, { id: '2', name: 'Gerd el Mellado', amount: per }]);
        expect(pastimeOutcome('leer', { hero }).xp[0].amount).toBe(READ_XP_PER_LEVEL * 2);
    });

    test('pescar: junto a las barcas, seguro; lo que sobra se vende; con poco, no se come', () => {
        const safe = pastimeOutcome('pescar', { choice: 'barcas', hero, companions: [gerd], partySize: 2, random: fixed(0.99) });
        expect(safe.fish).toBe(2 + 2 + 1);
        expect(safe.eat).toBe(true);
        expect(safe.gold).toBe(3);
        const poor = pastimeOutcome('pescar', { choice: 'rocas', hero, partySize: 3, random: fixed(0) });
        expect(poor.fish).toBe(1);
        expect(poor.eat).toBe(false);
        expect(poor.gold).toBe(1);
        expect(poor.lines).toContain('No da para que coma todo el grupo: lo vendes.');
        const big = pastimeOutcome('pescar', { choice: 'rocas', hero, partySize: 1, random: fixed(0.99) });
        expect(big.bigFish).toBe(true);
        expect(big.gold).toBe(5 + 3);
    });

    test('lo que se apunta en el diario', () => {
        expect(pastimeLog('mesas', { hero: 'Mara', slot: 'night', place: 'La taberna', gold: 7 })).toBe('🍺 [TABERNA] Mara sirve mesas toda la noche en La taberna: +7 de oro.');
        expect(pastimeLog('cartas', { hero: 'Mara', slot: 'afternoon', place: '', net: -10 })).toMatch(/pierde 10 de oro/);
        expect(sayList(['Gerd', 'Nella', 'Osric'])).toBe('Gerd, Nella y Osric');
    });

    test('lo guardado se lee con forma', () => {
        expect(readPastimes({ forge: { Ramiro: 2, Nadie: 0, Otro: 9 } })).toEqual({ forge: { Ramiro: 2, Otro: FORGE_STEPS } });
        expect(readPastimes(null)).toEqual({ forge: {} });
        expect(STATE_KEYS.some(e => e.key === PASTIMES_KEY)).toBe(true);
    });

    test('venir contigo suma un poco al vínculo, y no sale como botón para apuntarlo a mano', () => {
        expect(BOND_EVENTS.pastime_together.points).toBe(1);
        const after = recordBondEvent(createBondState(), '2', 'pastime_together');
        expect(after.state.bonds['2'].points).toBe(1);
        expect(getRecordableEvents().map(e => e.type)).not.toContain('pastime_together');
    });
});

describe('entrenar en el patio del gremio', () => {
    const hero = { id: 1, name: 'Mara', level: 2 };
    const nella = { id: 3, name: 'Nella Tresflechas', level: 1 };
    const gerd = { id: 2, name: 'Gerd el Mellado', level: 1, guest: true };

    test('solo en casa (la sala del gremio con patio), por la mañana o por la tarde', () => {
        const day = byId(pastimeOffers({ place: { kind: 'gremio', keeper: { name: 'Brunilda' } }, slot: 'morning', yard: true }));
        expect(Object.keys(day)).toEqual(['leer', 'patio']);
        expect(day.patio).toMatchObject({ label: 'Entrenar en el patio', enabled: true });
        expect(day.patio.detail).toMatch(/el doble a quien va por detrás de los tuyos\. Gasta la mañana\./);
        const night = byId(pastimeOffers({ place: { kind: 'gremio' }, slot: 'night', yard: true }));
        expect(night.patio.enabled).toBe(false);
        expect(night.patio.detail).toMatch(/a oscuras/);
        expect(byId(pastimeOffers({ place: { kind: 'gremio' }, slot: 'morning' })).patio).toBeUndefined();
    });

    test('las reglas del patio: por nivel, el doble a quien va por detrás, y los de alquiler no ganan', () => {
        const out = pastimeOutcome('patio', { choice: 'golpes', hero, companions: [nella, gerd], top: 2 });
        expect(out.xp).toEqual([
            { id: '1', name: 'Mara', amount: TRAIN_XP_PER_LEVEL * 2 * GUILD_TRAINING_FACTOR },
            { id: '3', name: 'Nella Tresflechas', amount: TRAIN_XP_PER_LEVEL * GUILD_TRAINING_FACTOR * CATCH_UP_FACTOR, catchUp: true },
        ]);
        expect(out.gold).toBe(0);
        expect(out.lines).toContain(`Nella Tresflechas: +${TRAIN_XP_PER_LEVEL * GUILD_TRAINING_FACTOR * CATCH_UP_FACTOR} de experiencia (va por detrás de los tuyos: aprende el doble).`);
        expect(out.lines).toContain('Gerd es de alquiler: no gana experiencia, sube de nivel contigo.');
        // Leyendo, igual.
        expect(pastimeOutcome('leer', { hero, companions: [gerd] }).xp.map(g => g.name)).toEqual(['Mara']);
        expect(out.lines).toContain('Nella, Gerd y tú, un poco más cerca.');
        // Un maestro de armas en casa suma.
        expect(pastimeOutcome('patio', { hero, top: 2, masters: 1 }).xp[0].amount).toBe(TRAIN_XP_PER_LEVEL * 2 * (GUILD_TRAINING_FACTOR + 1));
    });

    test('su escena, con quien enseña y quien viene; y su línea del diario', () => {
        const scene = pastimeScene('patio', { keeper: 'Brunilda', companions: ['Nella Tresflechas'], slot: 'morning' });
        expect(scene.who).toBe('Brunilda');
        expect(scene.beats[0].note).toMatch(/Brunilda se arremanga/);
        expect(scene.beats[0].note).toMatch(/Nella coge un arma de madera/);
        expect(scene.beats[0].replies.length).toBe(2);
        expect(choiceOf('patio', [{ beat: 0, reply: 1 }])).toBe('esquivar');
        expect(pastimeLog('patio', { hero: 'Mara', slot: 'afternoon', place: '' })).toBe('🏋️ [GREMIO] Mara entrena toda la tarde en el patio del gremio.');
    });
});

describe('en los pueblos de campaña', () => {
    test('Vallaki, de Strahd: en El Agua Azul se sirven mesas y se juega a las cartas; en la herrería, con Bogdan', () => {
        const pack = read('../public/mundos/strahd.pack.json');
        const plan = buildImportPlan(pack);
        const vallaki = plan.metadata.locationMaps.find((/** @type {any} */ l) => l.name === 'Ciudad de Vallaki');
        const npcs = pack.npcs.map((/** @type {any} */ n) => ({ name: n.name, where: n.where, service: n.service, trade: n.trade }));
        const { places } = townPlaces({ location: vallaki, npcs });
        const inn = places.find(p => p.kind === 'posada');
        const smithy = places.find(p => p.kind === 'herreria');
        const evening = byId(pastimeOffers({ place: inn ?? null, slot: 'afternoon', purse: 20 }));
        expect(evening.mesas).toMatchObject({ enabled: true });
        expect(evening.mesas.detail).toMatch(/que Urwin os aprecie más/);
        expect(evening.cartas.enabled).toBe(true);
        expect(byId(pastimeOffers({ place: smithy ?? null, slot: 'morning' })).forja.detail).toMatch(/que Bogdan os aprecie más/);
        // Ni patio (no es el gremio) ni muelle (no es un puerto).
        expect(places.some(p => p.kind === 'gremio')).toBe(false);
        expect(docksPlace({ location: vallaki })).toBeNull();
    });
});
