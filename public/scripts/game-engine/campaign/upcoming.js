/**
 * Lo que viene: los plazos de todos los relojes, en una lista con fecha (U3 del pegamento).
 *
 * El juego tiene dieciocho relojes —facciones, la cuenta del viernes, la deuda, el plazo del
 * encargo, los hitos con plazo, las estaciones, las fiestas, las heridas…— y cada uno avisaba
 * por su cuenta, cuando llegaba. Ninguno decía qué venía, porque ninguno sabía de los demás.
 * Aquí se juntan: cada reloj dice cuándo le toca y qué pasa entonces, y sale una lista.
 *
 * Es la base de la Mesa de la Semana (U5): los asuntos de la mesa salen de aquí.
 *
 * Puro: recibe lo ya leído y devuelve la lista. No guarda ni dibuja.
 *
 * Ver wiki/ROADMAP_PEGAMENTO.md, U3.
 */

import { readFactions, clockOf } from './factions.js';
import { readDebt } from './patronage.js';
import { visibleOpen, daysLeftOf } from './plot.js';
import { SEASONS, SEASON_ORDER, DEFAULT_START, seasonOf, daysLeftInSeason } from '../world/seasons.js';
import { daysUntil } from '../world/festivals.js';
import { readInjuries } from '../rules/injuries.js';
import { STALL_DAYS } from './guidance.js';

/** Hasta cuántos días se mira por delante. */
export const HORIZON = 14;

/** Cómo se dice lo que quiere conseguir una facción. */
const GOAL_VERBS = {
    encontrar: 'encuentra',
    conquistar: 'toma',
    recuperar: 'recupera',
    destruir: 'destruye',
    controlar: 'se hace con',
};

/**
 * @typedef {Object} Upcoming
 * @property {number} in Días que faltan desde hoy. 0 es hoy.
 * @property {'faccion'|'cuenta'|'deuda'|'encargo'|'hito'|'estacion'|'fiesta'|'herida'|'despacho'|'harto'|'rivales'|'buscados'|'pista'} kind
 * @property {string} text Lo que pasa, dicho para quien juega.
 */

/** @param {any} value @returns {number} */
const whole = (value) => Math.max(0, Math.floor(Number(value) || 0));

/**
 * Todo lo que viene en los próximos días, de lo más cercano a lo más lejano.
 *
 * @param {Object} input
 * @param {number} input.today
 * @param {any[]} [input.factions]
 * @param {number} [input.billDue] El día en que vence la cuenta de la semana.
 * @param {number} [input.bill] Lo que se debe entonces.
 * @param {number} [input.purse] Lo que hay.
 * @param {any} [input.debt]
 * @param {any} [input.taken] El encargo aceptado (`days` es el día en que caduca).
 * @param {any} [input.plot]
 * @param {any} [input.plotState]
 * @param {any[]} [input.party]
 * @param {Record<string, {day: number, name: string}>} [input.festivals]
 * @param {any[]} [input.dispatches] Los que están fuera sin el héroe (U8).
 * @param {string} [input.seasonStart]
 * @param {number} [input.horizon]
 * @param {string[]} [input.leaving] T7: quien está harto y puede irse el día de la semana.
 * @param {boolean} [input.rivals] T7: si hay encargos en el tablón que los rivales pueden llevarse.
 * @param {Record<string, number>} [input.wanted] T7: lo que os buscan, por sitio (baja uno por semana).
 * @param {{open: Array<{id: string, title: string}>, openedDay?: Record<string, number>, given?: Record<string, number>, early?: number}} [input.hints]
 *   T7: el hilo quieto y sus pistas (a los 3 y a los 6 días; un día antes con un erudito).
 * @returns {Upcoming[]}
 */
export function upcoming({ today, factions = [], billDue = 0, bill = 0, purse = 0, debt = null, taken = null, plot = null, plotState = null, party = [], festivals = {}, dispatches = [], seasonStart = DEFAULT_START, horizon = HORIZON, leaving = [], rivals = false, wanted = {}, hints = null }) {
    const now = Math.max(1, whole(today));
    /** @type {Upcoming[]} */
    const out = [];
    const add = (/** @type {number} */ days, /** @type {Upcoming['kind']} */ kind, /** @type {string} */ text) => {
        if (days >= 0 && days <= horizon && text) out.push({ in: days, kind, text });
    };

    for (const faction of readFactions(factions)) {
        const clock = clockOf(faction);
        if (!clock.moving) continue;
        const verb = GOAL_VERBS[/** @type {keyof typeof GOAL_VERBS} */ (faction.goal.kind)] ?? 'consigue lo que quiere en';
        add(clock.days, 'faccion', `${faction.name} ${verb} ${faction.goal.target || 'lo que busca'}`);
    }

    if (whole(billDue) > 0) {
        const owed = whole(bill);
        add(whole(billDue) - now, 'cuenta', owed > 0
            ? `La cuenta de la semana: debéis ${owed}${whole(purse) < owed ? `, y tenéis ${whole(purse)}` : ''}`
            : 'La cuenta de la semana');
    }

    const owed = debt ? readDebt(debt) : null;
    if (owed && owed.dueDay > 0) add(owed.dueDay - now, 'deuda', `Vence la deuda: ${owed.owed} de oro si no cumplís el favor`);

    if (taken && whole(taken.days) > 0) add(whole(taken.days) - now, 'encargo', `Se acaba el plazo de «${String(taken.title || 'el encargo')}»`);

    for (const milestone of visibleOpen(plot, plotState)) {
        const left = daysLeftOf(plot, plotState, milestone.id, now);
        if (left !== null) add(left, 'hito', `Se acaba el plazo de «${milestone.title}»`);
    }

    const season = seasonOf(now, seasonStart);
    const next = SEASON_ORDER[(SEASON_ORDER.indexOf(season) + 1) % SEASON_ORDER.length];
    add(daysLeftInSeason(now), 'estacion', `Empieza ${SEASONS[/** @type {keyof typeof SEASONS} */ (next)]?.label.toLowerCase() ?? 'otra estación'}`);

    for (const [place, festival] of Object.entries(festivals ?? {})) {
        add(daysUntil(festival, now), 'fiesta', `${festival.name} en ${place}`);
    }

    for (const away of Array.isArray(dispatches) ? dispatches : []) {
        const names = (away?.members ?? []).map((/** @type {any} */ m) => String(m?.name ?? '')).filter(Boolean);
        if (names.length === 0) continue;
        const who = names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : names[0];
        add(whole(away.backOn) - now, 'despacho', `${who} ${names.length > 1 ? 'vuelven' : 'vuelve'} de «${String(away.contract?.title || 'su encargo')}»`);
    }

    for (const member of Array.isArray(party) ? party : []) {
        if (!member || member.dead) continue;
        for (const injury of readInjuries(member)) {
            if (!injury.permanent && injury.daysLeft > 0) add(injury.daysLeft, 'herida', `${member.name} se cura de ${String(injury.label || 'su herida').toLowerCase()}`);
        }
    }

    // T7 de wiki/LO_QUE_FALTA.md: los relojes que avisaban cuando ya había pasado.
    if (whole(billDue) > 0) {
        const week = whole(billDue) - now;
        for (const name of Array.isArray(leaving) ? leaving : []) if (name) add(week, 'harto', `${name} puede irse si nada cambia`);
        if (rivals) add(week, 'rivales', 'Los rivales pueden llevarse un encargo del tablón');
        for (const [place, level] of Object.entries(wanted ?? {})) {
            if (whole(level) > 0) add(week, 'buscados', `En ${place} os buscan un poco menos (de ${whole(level)} a ${whole(level) - 1})`);
        }
    }
    for (const milestone of Array.isArray(hints?.open) ? hints.open : []) {
        const opened = Number(hints?.openedDay?.[milestone.id]);
        const given = whole(hints?.given?.[milestone.id]);
        if (!Number.isFinite(opened) || given >= STALL_DAYS.length) continue;
        add(Math.max(0, opened + STALL_DAYS[given] - whole(hints?.early) - now), 'pista', `Si el hilo sigue quieto, una pista de «${milestone.title}»`);
    }

    const order = ['cuenta', 'deuda', 'encargo', 'hito', 'harto', 'despacho', 'faccion', 'rivales', 'pista', 'buscados', 'herida', 'fiesta', 'estacion'];
    return out.sort((a, b) => a.in - b.in || order.indexOf(a.kind) - order.indexOf(b.kind));
}

/**
 * Cómo se dice cuándo: «hoy», «mañana», «en 5 días».
 *
 * @param {number} days
 * @returns {string}
 */
export function whenText(days) {
    const n = whole(days);
    return n === 0 ? 'hoy' : n === 1 ? 'mañana' : `en ${n} días`;
}

/**
 * La lista en líneas, para el diario y el reloj de pantalla.
 *
 * @param {Upcoming[]} list
 * @param {number} [limit]
 * @returns {string[]}
 */
export function describeUpcoming(list, limit = 6) {
    return (list ?? []).slice(0, limit).map(item => `${item.text}, ${whenText(item.in)}.`);
}
