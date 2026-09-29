/**
 * J14.2: el día por partes (`day-parts.js`), encima del reloj de siempre (`calendar.js`).
 */
import { describe, test, expect } from '@jest/globals';
import {
    ACTIVITIES, SPENDERS, TRAIN_XP_PER_LEVEL, WORK_GOLD_BASE, slotsFor, noteSpent, spend, canDo, freeTime,
    openErrand, useErrand, closeErrand, activityOutcome, dayStrip, describeDay,
} from '../public/scripts/game-engine/campaign/day-parts.js';
import { createCalendar, advanceSlots, getCurrentSlot } from '../public/scripts/game-engine/campaign/calendar.js';
import { createSocial } from '../public/scripts/game-engine/campaign/social.js';

/** El reloj en una franja: 0 mañana, 1 tarde, 2 noche. */
const at = (/** @type {number} */ slotIndex, day = 1) => ({ ...createCalendar(), day, slotIndex });
const TOWN = ['posada', 'tienda', 'herreria', 'templo'];

describe('qué gasta una franja', () => {
    test('quedar, entrenar, trabajar, comprar y descansar: una cada una', () => {
        expect(Object.keys(ACTIVITIES)).toEqual(['quedar', 'entrenar', 'trabajar', 'comprar', 'descansar']);
        for (const what of Object.keys(ACTIVITIES)) expect(slotsFor(what, { calendar: at(0) })).toBe(1);
    });

    test('pelear y cada paso de una misión, una; lo que no es nada, ninguna', () => {
        expect(Object.keys(SPENDERS)).toEqual(['viaje', 'pelea', 'mision']);
        expect(slotsFor('pelea', { calendar: at(1) })).toBe(1);
        expect(slotsFor('mision', { calendar: at(1) })).toBe(1);
        expect(slotsFor('bailar', { calendar: at(1) })).toBe(0);
    });

    test('un viaje de días se come lo que queda de hoy y un día más por cada día; se llega por la mañana', () => {
        expect(slotsFor('viaje', { calendar: at(0), days: 0 })).toBe(1);
        expect(slotsFor('viaje', { calendar: at(0), days: 1 })).toBe(3);
        expect(slotsFor('viaje', { calendar: at(1), days: 1 })).toBe(2);
        expect(slotsFor('viaje', { calendar: at(2), days: 2 })).toBe(4);
        // Igual que el viaje de siempre, que pasa un día por día de camino (`advanceDay`).
        const after = advanceSlots(at(1, 4), slotsFor('viaje', { calendar: at(1, 4), days: 3 })).calendar;
        expect([after.day, getCurrentSlot(after).id]).toEqual([7, 'morning']);
    });
});

describe('quedar gasta la tarde y pasa a la noche', () => {
    test('se apunta con quién, y la cabecera lo enseña', () => {
        const calendar = at(1);
        const { social, slots } = spend({ social: createSocial(), calendar, what: 'quedar', who: 'Gerd el Mellado' });
        expect(slots).toBe(1);
        const night = advanceSlots(calendar, slots).calendar;
        expect(getCurrentSlot(night).id).toBe('night');
        const strip = dayStrip({ calendar: night, social });
        expect(strip).toEqual([
            { id: 'morning', label: 'Mañana', state: 'hecho', what: '' },
            { id: 'afternoon', label: 'Tarde', state: 'hecho', what: 'Con Gerd el Mellado' },
            { id: 'night', label: 'Noche', state: 'ahora', what: '' },
        ]);
        expect(describeDay(strip)).toBe('Mañana: pasada · Tarde: Con Gerd el Mellado · Noche: ahora');
    });

    test('lo apuntado es de hoy: un día nuevo empieza en blanco', () => {
        const social = noteSpent(createSocial(), at(0, 2), 'entrenar');
        expect(social.day.done).toEqual([{ slot: 'morning', what: 'entrenar', label: 'Entrenar' }]);
        expect(dayStrip({ calendar: at(1, 3), social }).find(p => p.id === 'morning')?.what).toBe('');
        const next = noteSpent(social, at(1, 3), 'pelea');
        expect(next.day).toEqual({ day: 3, done: [{ slot: 'afternoon', what: 'pelea', label: 'Una pelea' }] });
        expect(describeDay(dayStrip({ calendar: at(0), social: null }))).toBe('Mañana: ahora · Tarde: libre · Noche: libre');
    });

    test('gastar algo que no gasta nada no apunta nada', () => {
        expect(spend({ social: null, calendar: at(0), what: 'bailar' })).toEqual({ social: createSocial(), slots: 0 });
    });
});

describe('qué se puede hacer con una franja libre', () => {
    test('entrenar y trabajar, de día; de noche no', () => {
        expect(canDo('entrenar', { calendar: at(0), services: TOWN }).enabled).toBe(true);
        expect(canDo('entrenar', { calendar: at(2), services: TOWN })).toEqual({ enabled: false, why: 'No es cosa de la noche.' });
        expect(canDo('trabajar', { calendar: at(1), services: TOWN }).enabled).toBe(true);
        expect(canDo('trabajar', { calendar: at(1), services: [] }).why).toBe('Aquí no hay pueblo donde echar una mano.');
    });

    test('ir de compras, con la tienda o la herrería abiertas (de noche cierran)', () => {
        expect(canDo('comprar', { calendar: at(0), services: TOWN }).enabled).toBe(true);
        expect(canDo('comprar', { calendar: at(2), services: TOWN }).why).toBe('A esta hora está todo cerrado.');
        expect(canDo('comprar', { calendar: at(0), services: ['posada'] }).why).toBe('Aquí no hay tienda ni herrería.');
    });

    test('quedar, si hay con quién; descansar, siempre; nada mientras se pelea', () => {
        expect(canDo('quedar', { calendar: at(2), services: TOWN, people: 0 }).enabled).toBe(false);
        expect(canDo('quedar', { calendar: at(2), services: TOWN, people: 2 }).enabled).toBe(true);
        expect(canDo('descansar', { calendar: at(2), services: [] }).enabled).toBe(true);
        expect(canDo('descansar', { calendar: at(0), fighting: true })).toEqual({ enabled: false, why: 'No mientras peleáis.' });
        expect(canDo('volar', { calendar: at(0) }).enabled).toBe(false);
    });

    test('la franja de ahora, con sus cinco cosas juzgadas', () => {
        const free = freeTime({ calendar: at(1), services: TOWN, people: 1 });
        expect(free.slot).toEqual({ id: 'afternoon', label: 'Tarde' });
        expect(free.free).toBe(true);
        expect(free.activities.map(a => [a.id, a.enabled])).toEqual([
            ['quedar', true], ['entrenar', true], ['trabajar', true], ['comprar', true], ['descansar', true],
        ]);
    });
});

describe('ir de compras: la franja se gasta al salir, si se compró', () => {
    test('entrar a mirar no cuesta', () => {
        const social = openErrand(createSocial(), at(0));
        expect(freeTime({ calendar: at(0), social }).free).toBe(false);
        expect(closeErrand(social, at(0))).toEqual({ social: { ...social, errand: null }, slots: 0 });
    });

    test('comprar algo, sí: una franja, apuntada', () => {
        const bought = useErrand(openErrand(createSocial(), at(0)));
        const closed = closeErrand(bought, at(0));
        expect(closed.slots).toBe(1);
        expect(closed.social.errand).toBeNull();
        expect(closed.social.day.done).toEqual([{ slot: 'morning', what: 'comprar', label: 'Ir de compras' }]);
    });

    test('si otra cosa ya gastó la franja mientras tanto, no se cobra dos veces', () => {
        const bought = useErrand(openErrand(createSocial(), at(0)));
        expect(closeErrand(bought, at(1)).slots).toBe(0);
        expect(useErrand(createSocial()).errand).toBeNull();
    });
});

describe('lo que da cada cosa', () => {
    test('entrenar da experiencia por nivel; trabajar, algo de oro', () => {
        const hero = { name: 'Tessa', level: 3 };
        expect(activityOutcome('entrenar', { calendar: at(0), hero })).toEqual({
            kind: 'xp', amount: TRAIN_XP_PER_LEVEL * 3, line: `Tessa entrena toda la mañana: +${TRAIN_XP_PER_LEVEL * 3} de experiencia.`,
        });
        expect(activityOutcome('trabajar', { calendar: at(1), hero, port: true })).toEqual({
            kind: 'gold', amount: WORK_GOLD_BASE + 3, line: `Tessa se pasa la tarde descargando barcas en el muelle: +${WORK_GOLD_BASE + 3} de oro.`,
        });
    });

    test('descansar: de día, un rato; de noche, hasta mañana', () => {
        expect(activityOutcome('descansar', { calendar: at(0) }).kind).toBe('rest-short');
        expect(activityOutcome('descansar', { calendar: at(2) }).kind).toBe('rest-long');
        expect(activityOutcome('comprar', { calendar: at(0) }).kind).toBe('shop');
        expect(activityOutcome('quedar', { calendar: at(0) }).kind).toBe('meetup');
        expect(activityOutcome('nada', { calendar: at(0) }).kind).toBe('');
    });
});
