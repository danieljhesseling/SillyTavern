import { describe, test, expect } from '@jest/globals';
import {
    ROAD_CARDS, MIN_TRIP_DAYS, DETOUR_DAYS, MAP_PRICE, cardDays, pickCards, isBlizzard, askFor, resolveCard,
} from '../public/scripts/game-engine/world/road-cards.js';
import {
    NIGHT_ROLES, readNightRoles, suggestNightRoles, cookDinner, studyNight, appraiseLoot, LOOT_FIGHTS_MAX, STUDY_MAX,
} from '../public/scripts/game-engine/campaign/camp-roles.js';
import { DUTIES, readFormation } from '../public/scripts/game-engine/campaign/formation.js';

/** Un azar que repite una lista. */
const seq = (/** @type {number[]} */ values) => {
    let i = 0;
    return () => values[i++ % values.length];
};

describe('E6.1: las tarjetas del camino', () => {
    test('los viajes cortos no tienen tarjetas', () => {
        expect(cardDays({ days: 1, random: Math.random })).toEqual([]);
        expect(cardDays({ days: MIN_TRIP_DAYS - 1, random: Math.random })).toEqual([]);
    });

    test('a Barovia (9 días) hay una cada dos o tres días, nunca el de llegar', () => {
        const days = cardDays({ days: 9, random: seq([0.1, 0.9, 0.1, 0.9]) });
        expect(days).toEqual([2, 5, 7]);
        const other = cardDays({ days: 9, random: seq([0.9]) });
        expect(other).toEqual([3, 6]);
        for (const day of [...days, ...other]) expect(day).toBeLessThan(9);
    });

    test('un viaje de tres días tiene una', () => {
        expect(cardDays({ days: 3, random: seq([0.9]) })).toEqual([2]);
    });

    test('sin repetir, sin el mercader si no llega el oro, y sin pisar un día con contratiempo', () => {
        const all = pickCards({ days: [2, 5, 7, 9], random: seq([0]), purse: 100 });
        expect(all.map(c => c.card.id).sort()).toEqual(Object.keys(ROAD_CARDS).sort());
        expect(all).toHaveLength(3);
        const poor = pickCards({ days: [2, 5, 7], random: seq([0]), purse: 0 });
        expect(poor.map(c => c.card.id)).not.toContain('mercader');
        const busy = pickCards({ days: [2, 5], random: seq([0]), purse: 100, busy: [2] });
        expect(busy.map(c => c.day)).toEqual([5]);
    });

    test('ventisca en invierno o con nieve; si no, temporal', () => {
        expect(isBlizzard({ season: 'invierno' })).toBe(true);
        expect(isBlizzard({ weather: 'nieve' })).toBe(true);
        expect(isBlizzard({ season: 'verano', weather: 'lluvia' })).toBe(false);
        expect(askFor(ROAD_CARDS.ventisca, { day: 3, total: 9, season: 'verano' }).title).toBe('Un temporal');
        expect(askFor(ROAD_CARDS.ventisca, { day: 3, total: 9, season: 'invierno' }).title).toBe('La ventisca');
    });

    test('lo que se pregunta lo dice alguien, y la respuesta segura es la 2 (Escape)', () => {
        const ask = askFor(ROAD_CARDS.puente, { day: 2, total: 9, to: 'Barovia', rations: 4, mouths: 3 });
        expect(ask.notes[0]).toBe('Día 2 de 9, camino de Barovia.');
        expect(ask.notes[1]).toBe('Raciones: 4 para 3.');
        expect(ask.answers).toEqual({ yes: 'cruzar', no: 'rodeo', other: '' });
        expect(ask.no).toContain(`${DETOUR_DAYS} días más`);
        expect(askFor(ROAD_CARDS.ventisca, { day: 3, total: 9 }).answers.no).toBe('acampar');
    });

    test('el mercader: el mapa y lo raro, si llega el oro', () => {
        const offer = { item: 'Varita de escarcha', price: 50 };
        const rich = askFor(ROAD_CARDS.mercader, { day: 5, total: 9, purse: 80, offer });
        expect(rich.answers).toEqual({ yes: 'mapa', no: 'pasar', other: 'raro' });
        expect(rich.other).toContain('Varita de escarcha');
        const some = askFor(ROAD_CARDS.mercader, { day: 5, total: 9, purse: 20, offer });
        expect(some.answers.other).toBe('');
        const none = askFor(ROAD_CARDS.mercader, { day: 5, total: 9, purse: 3, offer });
        expect(none.answers.yes).toBe('pasar');
    });

    test('el puente: rodeo, cruzar bien, y cruzar mal (comida o daño)', () => {
        expect(resolveCard(ROAD_CARDS.puente, 'rodeo').days).toBe(DETOUR_DAYS);
        const good = resolveCard(ROAD_CARDS.puente, 'cruzar', { success: true, who: 'Bran', rations: 4, mouths: 3 });
        expect(good).toMatchObject({ days: 0, rationsLost: 0, hurt: '' });
        expect(good.note).toContain('Bran');
        const wet = resolveCard(ROAD_CARDS.puente, 'cruzar', { success: false, who: 'Bran', rations: 2, mouths: 3 });
        expect(wet.rationsLost).toBe(2);
        expect(wet.said).toContain('2 raciones');
        const hurt = resolveCard(ROAD_CARDS.puente, 'cruzar', { success: false, who: 'Bran', rations: 0, mouths: 3 });
        expect(hurt.hurt).toBe('1d6');
    });

    test('la ventisca: acampar cuesta un día y raciones; apretar, el sueño', () => {
        const camp = resolveCard(ROAD_CARDS.ventisca, 'acampar', { rations: 5, mouths: 3 });
        expect(camp).toMatchObject({ days: 1, rationsEaten: 3, hungry: false, tired: false });
        const short = resolveCard(ROAD_CARDS.ventisca, 'acampar', { rations: 1, mouths: 3 });
        expect(short).toMatchObject({ days: 1, rationsEaten: 1, hungry: true });
        expect(resolveCard(ROAD_CARDS.ventisca, 'apretar')).toMatchObject({ days: 0, tired: true });
    });

    test('el mercader: el mapa ahorra un día; lo raro se compra', () => {
        expect(resolveCard(ROAD_CARDS.mercader, 'mapa')).toMatchObject({ days: -1, gold: MAP_PRICE });
        const rare = resolveCard(ROAD_CARDS.mercader, 'raro', { offer: { item: 'Varita de escarcha', price: 50 } });
        expect(rare).toMatchObject({ gold: 50, item: 'Varita de escarcha', days: 0 });
        expect(resolveCard(ROAD_CARDS.mercader, 'pasar')).toMatchObject({ gold: 0, item: '', days: 0 });
    });
});

describe('E6.2: los papeles de la noche', () => {
    const bran = { id: 'b', name: 'Bran', hp: 10, survival: 1, investigation: 0 };
    const lyra = { id: 'l', name: 'Lyra', hp: 10, survival: 4, investigation: 1 };
    const mira = { id: 'm', name: 'Mira', hp: 10, survival: 0, investigation: 5 };
    const pip = { id: 'p', name: 'Pip', hp: 10, survival: 2, investigation: 3 };
    const mod = (/** @type {any} */ m, /** @type {string} */ skill) => Number(m[skill]) || 0;

    test('la formación tiene los tres papeles nuevos', () => {
        for (const role of Object.keys(NIGHT_ROLES)) expect(DUTIES).toHaveProperty(role);
        expect(readFormation({ duties: { cocinero: 'l' } }).duties.cocinero).toBe('l');
    });

    test('se propone a quien mejor lo hace, sin repetir y sin los que vigilan', () => {
        const roles = suggestNightRoles({ party: [bran, lyra, mira, pip], modifierOf: mod, guards: ['b'] });
        expect(roles).toEqual({ cocinero: 'l', erudito: 'm', tasador: 'p' });
        const chosen = suggestNightRoles({ party: [bran, lyra, mira, pip], modifierOf: mod, chosen: { erudito: 'p' }, guards: [] });
        expect(chosen.erudito).toBe('p');
        expect(chosen.tasador).toBe('m');
    });

    test('con poca gente, también hace algo quien vigila; y si no da, un papel se queda sin hacer', () => {
        const roles = suggestNightRoles({ party: [bran, lyra], modifierOf: mod, guards: ['b'] });
        expect(roles).toEqual({ cocinero: 'l', erudito: 'b', tasador: '' });
    });

    test('la cena: sin fuego no hay guiso; si sale, repone', () => {
        expect(cookDinner({ cook: '', fire: true, success: true }).said).toBe('');
        expect(cookDinner({ cook: 'Lyra', fire: false, success: true })).toMatchObject({ caught: false, hearty: false });
        expect(cookDinner({ cook: 'Lyra', fire: true, success: false })).toMatchObject({ caught: false, hearty: false });
        expect(cookDinner({ cook: 'Lyra', fire: true, success: true })).toMatchObject({ caught: true, hearty: true });
    });

    test('quien estudia identifica (hasta un tope) y copia el pergamino', () => {
        expect(studyNight({ scholar: 'Mira', unknown: 5, success: true }).identify).toBe(STUDY_MAX);
        expect(studyNight({ scholar: 'Mira', unknown: 2, success: false }).identify).toBe(0);
        const scroll = studyNight({ scholar: 'Mira', unknown: 0, success: false, scroll: 'Pergamino de Bola de fuego', spell: 'Bola de fuego' });
        expect(scroll.learn).toBe(true);
        expect(scroll.said).toContain('Bola de fuego');
    });

    test('quien examina el botín: solo lo de las peleas nuevas, y como mucho tres', () => {
        const roll = () => 7;
        const first = appraiseLoot({ appraiser: 'Pip', wins: 5, state: null, success: true, roll });
        expect(first.fights).toBe(LOOT_FIGHTS_MAX);
        expect(first.gold).toBe(7 * LOOT_FIGHTS_MAX);
        expect(first.state).toEqual({ wins: 5 });
        const again = appraiseLoot({ appraiser: 'Pip', wins: 5, state: first.state, success: true, roll });
        expect(again).toMatchObject({ fights: 0, gold: 0 });
        const miss = appraiseLoot({ appraiser: 'Pip', wins: 6, state: first.state, success: false, roll });
        expect(miss).toMatchObject({ fights: 1, gold: 0, state: { wins: 6 } });
        expect(readNightRoles({ wins: '3' })).toEqual({ wins: 3 });
    });
});
