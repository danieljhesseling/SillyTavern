/**
 * El día por partes (J14.2 de wiki/ROADMAP_SIN_CONEXION.md): mañana, tarde y noche, y en qué
 * se gasta cada una.
 *
 * El reloj ya existe (`calendar.js`): un día tiene sus franjas y gastar una pasa a la
 * siguiente; la noche, al día siguiente. Esto no lo repite. Dice **qué gasta una franja** y
 * **qué se puede hacer con una libre**, y apunta en qué se fue cada una para que la cabecera
 * lo enseñe («Mañana: entrenar · Tarde: ahora · Noche: libre»).
 *
 * Qué gasta una franja:
 *
 * - **Lo que eliges hacer con una libre** (`ACTIVITIES`): quedar con alguien, entrenar,
 *   trabajar, ir de compras o descansar. Una franja cada una. Ir de compras es un recado: se
 *   gasta al salir, y solo si se compró algo (entrar a mirar no cuesta).
 * - **Viajar**: un camino de días se come lo que queda de hoy y un día entero por cada día
 *   más (se llega por la mañana, como ya hace el viaje); uno corto, una franja.
 * - **Pelear**: una franja por pelea de tablero, al acabar.
 * - **Las misiones**: cada paso de un encargo que no es pelea (explorar, buscar pistas,
 *   entregar), una franja. Los que ya existen (explorar, buscar pistas) ya la gastan.
 *
 * Puro: dice cuántas franjas y qué se apunta. Quien llama pasa el reloj (con
 * `advanceCampaignSlot`, que ya cura, cobra y narra al cambiar de día) y guarda `social`.
 */

import { normalizeCalendar, getRemainingSlots } from './calendar.js';
import { isOpen } from './hours.js';
import { readSocial } from './social.js';

/** Lo que se puede hacer con una franja libre. `hours`: cuándo; `services`: dónde hace falta. */
export const ACTIVITIES = {
    quedar: {
        label: 'Quedar con alguien', icon: 'fa-mug-hot', hours: ['morning', 'afternoon', 'night'],
        describe: 'Pasas esta parte del día con alguien de tu gente. Sale su escena y el vínculo sube.',
    },
    entrenar: {
        label: 'Entrenar', icon: 'fa-dumbbell', hours: ['morning', 'afternoon'],
        describe: 'Un rato de armas y de sudor: algo de experiencia.',
    },
    trabajar: {
        label: 'Trabajar', icon: 'fa-hammer', hours: ['morning', 'afternoon'], town: true,
        describe: 'Echas una mano en el pueblo por unas monedas.',
    },
    comprar: {
        label: 'Ir de compras', icon: 'fa-basket-shopping', hours: ['morning', 'afternoon', 'night'], services: ['tienda', 'herreria'],
        describe: 'La tienda y la herrería, con calma. La franja se gasta al salir, si has comprado algo.',
    },
    descansar: {
        label: 'Descansar', icon: 'fa-bed', hours: ['morning', 'afternoon', 'night'],
        describe: 'De día, un descanso corto. De noche, dormir hasta mañana.',
    },
};

/** Lo que gasta franjas sin que se elija en el día: viajar, pelear y las misiones. */
export const SPENDERS = {
    viaje: { label: 'De viaje', describe: 'Un camino de días se come lo que queda de hoy y un día más por cada día de camino; uno corto, una franja.' },
    pelea: { label: 'Una pelea', describe: 'Cada pelea de tablero gasta una franja al acabar.' },
    mision: { label: 'Una misión', describe: 'Cada paso de un encargo que no es pelea (explorar, buscar pistas, entregar) gasta una franja.' },
};

/** Lo que da entrenar una franja, por nivel del héroe. */
export const TRAIN_XP_PER_LEVEL = 25;

/** Lo que da trabajar una franja: esto más el nivel, en oro. */
export const WORK_GOLD_BASE = 2;

/** Cómo se dice cada franja dentro de una frase. */
const SLOT_WORDS = { morning: 'la mañana', afternoon: 'la tarde', night: 'la noche' };

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * @param {any} calendar
 * @returns {{id: string, label: string, advancesDay: boolean}}
 */
function slotNow(calendar) {
    const c = normalizeCalendar(calendar);
    return c.slots[c.slotIndex];
}

/**
 * Cuántas franjas gasta algo.
 *
 * @param {string} what Una de `ACTIVITIES` o de `SPENDERS`.
 * @param {{calendar: any, days?: number}} input `days`: los días de camino, en un viaje.
 * @returns {number}
 */
export function slotsFor(what, { calendar, days = 0 }) {
    const kind = text(what);
    if (kind === 'viaje') {
        const d = Math.max(0, Math.floor(Number(days) || 0));
        if (d === 0) return 1;
        const c = normalizeCalendar(calendar);
        return getRemainingSlots(c) + (d - 1) * c.slots.length;
    }
    return kind in ACTIVITIES || kind in SPENDERS ? 1 : 0;
}

/**
 * Lo hecho hoy, con el día al día: si el calendario ya va por otro, se empieza de cero.
 *
 * @param {import('./social.js').SocialState} state
 * @param {any} calendar
 * @returns {import('./social.js').DayDone[]}
 */
function doneToday(state, calendar) {
    const day = normalizeCalendar(calendar).day;
    return state.day.day === day ? state.day.done : [];
}

/**
 * Apuntar en qué se va la franja de ahora. No pasa el reloj: eso lo hace quien llama.
 *
 * @param {any} social
 * @param {any} calendar
 * @param {string} what
 * @param {{who?: string, label?: string}} [extra]
 * @returns {import('./social.js').SocialState}
 */
export function noteSpent(social, calendar, what, extra = {}) {
    const state = readSocial(social);
    const c = normalizeCalendar(calendar);
    const slot = c.slots[c.slotIndex].id;
    const spec = /** @type {Record<string, {label: string}>} */ ({ ...ACTIVITIES, ...SPENDERS })[text(what)];
    const label = text(extra.label) || spec?.label || text(what);
    const entry = { slot, what: text(what), label, ...(text(extra.who) ? { who: text(extra.who) } : {}) };
    const kept = doneToday(state, c).filter(d => d.slot !== slot);
    return { ...state, day: { day: c.day, done: [...kept, entry] } };
}

/**
 * Gastar la franja de ahora en algo: lo apunta y dice cuántas pasar.
 *
 * @param {Object} input
 * @param {any} input.social
 * @param {any} input.calendar
 * @param {string} input.what
 * @param {number} [input.days] Los días de camino, si es un viaje.
 * @param {string} [input.who] Con quién, si es una quedada.
 * @returns {{social: import('./social.js').SocialState, slots: number}}
 */
export function spend({ social, calendar, what, days = 0, who = '' }) {
    const slots = slotsFor(what, { calendar, days });
    if (slots === 0) return { social: readSocial(social), slots: 0 };
    const label = who && what === 'quedar' ? `Con ${text(who)}` : '';
    return { social: noteSpent(social, calendar, what, { who, label }), slots };
}

/**
 * Si se puede hacer algo ahora, y si no, por qué.
 *
 * @param {string} activity
 * @param {Object} input
 * @param {any} input.calendar
 * @param {string[]} [input.services] Los servicios de aquí (`servicesOf`).
 * @param {boolean} [input.fighting]
 * @param {number} [input.people] Con cuántos se puede quedar aquí y ahora.
 * @returns {{enabled: boolean, why: string}}
 */
export function canDo(activity, { calendar, services = [], fighting = false, people = 0 }) {
    const spec = /** @type {Record<string, any>} */ (ACTIVITIES)[text(activity)];
    if (!spec) return { enabled: false, why: 'Eso no es algo que se haga con una parte del día.' };
    if (fighting) return { enabled: false, why: 'No mientras peleáis.' };
    const slot = slotNow(calendar);
    if (!spec.hours.includes(slot.id)) return { enabled: false, why: `No es cosa de ${SLOT_WORDS[/** @type {keyof typeof SLOT_WORDS} */ (slot.id)] ?? 'esta hora'}.` };
    const here = (Array.isArray(services) ? services : []).map(text);
    if (spec.town && here.length === 0) return { enabled: false, why: 'Aquí no hay pueblo donde echar una mano.' };
    if (spec.services) {
        const open = spec.services.filter((/** @type {string} */ s) => here.includes(s) && isOpen(s, slot.id));
        if (open.length === 0) {
            return { enabled: false, why: spec.services.some((/** @type {string} */ s) => here.includes(s)) ? 'A esta hora está todo cerrado.' : 'Aquí no hay tienda ni herrería.' };
        }
    }
    if (activity === 'quedar' && !(Number(people) > 0)) return { enabled: false, why: 'Aquí y ahora no hay nadie de tu gente con quien quedar.' };
    return { enabled: true, why: '' };
}

/**
 * La franja de ahora y lo que se puede hacer con ella, para las fichas de la escena.
 *
 * @param {Object} input
 * @param {any} input.calendar
 * @param {any} [input.social]
 * @param {string[]} [input.services]
 * @param {boolean} [input.fighting]
 * @param {number} [input.people]
 * @returns {{slot: {id: string, label: string}, free: boolean, activities: Array<{id: string, label: string, icon: string,
 *   describe: string, enabled: boolean, why: string}>}}
 */
export function freeTime({ calendar, social = null, services = [], fighting = false, people = 0 }) {
    const slot = slotNow(calendar);
    const state = readSocial(social);
    const c = normalizeCalendar(calendar);
    const errand = state.errand && state.errand.day === c.day && state.errand.slot === slot.id ? state.errand : null;
    return {
        slot: { id: slot.id, label: slot.label },
        free: !errand,
        activities: Object.entries(ACTIVITIES).map(([id, spec]) => ({
            id,
            label: spec.label,
            icon: spec.icon,
            describe: spec.describe,
            ...canDo(id, { calendar, services, fighting, people }),
        })),
    };
}

/**
 * Empezar un recado que gasta la franja al acabar (ir de compras).
 *
 * @param {any} social
 * @param {any} calendar
 * @param {string} [what]
 * @returns {import('./social.js').SocialState}
 */
export function openErrand(social, calendar, what = 'comprar') {
    const c = normalizeCalendar(calendar);
    return { ...readSocial(social), errand: { what: text(what), day: c.day, slot: c.slots[c.slotIndex].id, used: false } };
}

/**
 * Durante el recado se hizo algo (se compró): al salir, la franja se gasta.
 *
 * @param {any} social
 * @returns {import('./social.js').SocialState}
 */
export function useErrand(social) {
    const state = readSocial(social);
    return state.errand ? { ...state, errand: { ...state.errand, used: true } } : state;
}

/**
 * Salir del recado: si se hizo algo en esta misma franja, se gasta (y se apunta).
 *
 * @param {any} social
 * @param {any} calendar
 * @returns {{social: import('./social.js').SocialState, slots: number}}
 */
export function closeErrand(social, calendar) {
    const state = readSocial(social);
    const errand = state.errand;
    const cleared = { ...state, errand: null };
    if (!errand || !errand.used) return { social: cleared, slots: 0 };
    const c = normalizeCalendar(calendar);
    // Si el reloj ya pasó de franja mientras tanto (otra cosa la gastó), no se cobra dos veces.
    if (errand.day !== c.day || errand.slot !== c.slots[c.slotIndex].id) return { social: cleared, slots: 0 };
    return { social: noteSpent(cleared, c, errand.what), slots: 1 };
}

/**
 * Lo que da hacer algo con una franja. Quien llama lo aplica: la experiencia, el oro, el
 * descanso, la tienda o la escena.
 *
 * @param {string} activity
 * @param {{calendar: any, hero?: any, port?: boolean}} input
 * @returns {{kind: 'xp'|'gold'|'rest-short'|'rest-long'|'shop'|'meetup'|'', amount: number, line: string}}
 */
export function activityOutcome(activity, { calendar, hero = null, port = false }) {
    const slot = slotNow(calendar);
    const when = SLOT_WORDS[/** @type {keyof typeof SLOT_WORDS} */ (slot.id)] ?? 'un rato';
    const level = Math.max(1, Math.floor(Number(hero?.level) || 1));
    const name = text(hero?.name) || 'Tu héroe';
    switch (text(activity)) {
        case 'entrenar': {
            const amount = TRAIN_XP_PER_LEVEL * level;
            return { kind: 'xp', amount, line: `${name} entrena toda ${when}: +${amount} de experiencia.` };
        }
        case 'trabajar': {
            const amount = WORK_GOLD_BASE + level;
            const where = port ? 'descargando barcas en el muelle' : 'echando una mano en el pueblo';
            return { kind: 'gold', amount, line: `${name} se pasa ${when} ${where}: +${amount} de oro.` };
        }
        case 'descansar':
            return slot.advancesDay
                ? { kind: 'rest-long', amount: 0, line: 'A dormir: mañana será otro día.' }
                : { kind: 'rest-short', amount: 0, line: `Descansáis ${when}.` };
        case 'comprar':
            return { kind: 'shop', amount: 0, line: '' };
        case 'quedar':
            return { kind: 'meetup', amount: 0, line: '' };
        default:
            return { kind: '', amount: 0, line: '' };
    }
}

/**
 * Las partes del día para la cabecera: cuáles ya se fueron (y en qué), cuál es ahora y
 * cuáles quedan libres.
 *
 * @param {{calendar: any, social?: any}} input
 * @returns {Array<{id: string, label: string, state: 'hecho'|'ahora'|'libre', what: string}>}
 */
export function dayStrip({ calendar, social = null }) {
    const c = normalizeCalendar(calendar);
    const done = doneToday(readSocial(social), c);
    return c.slots.map((slot, index) => {
        const entry = done.find(d => d.slot === slot.id);
        const state = index < c.slotIndex ? 'hecho' : index === c.slotIndex ? 'ahora' : 'libre';
        return { id: slot.id, label: slot.label, state, what: state === 'hecho' ? (entry?.label ?? '') : '' };
    });
}

/**
 * La tira del día dicha en una línea: «Mañana: Entrenar · Tarde: ahora · Noche: libre».
 *
 * @param {ReturnType<typeof dayStrip>} strip
 * @returns {string}
 */
export function describeDay(strip) {
    return (Array.isArray(strip) ? strip : []).map(part => {
        if (part.state === 'ahora') return `${part.label}: ahora`;
        if (part.state === 'libre') return `${part.label}: libre`;
        return `${part.label}: ${part.what || 'pasada'}`;
    }).join(' · ');
}
