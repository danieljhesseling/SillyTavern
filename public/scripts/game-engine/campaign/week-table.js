/**
 * La Mesa de la Semana: los asuntos que no caben todos, cómo os ven y lo que pasó (U5 del
 * pegamento; la Propuesta 1 de wiki/archivo/PROPUESTAS_BUCLE_DE_JUEGO.md).
 *
 * La semana se pagaba, pero no se decidía: la pregunta era «¿me llega?», no «¿qué dejo
 * caer?». Y las decisiones estaban repartidas por ocho sitios. La mesa las junta:
 *
 * - **Los asuntos**: cuatro o cinco, de todos los relojes a la vez —una facción que avanza,
 *   el hito del hilo, el encargo aceptado, el mejor del tablón, el encargo de un compañero,
 *   la deuda—, cada uno con su plazo y **lo que pasa si no se atiende**.
 * - **Cómo os ven**: las siete formas de opinión del juego, juntas por fin, cada una en lo
 *   suyo (no se funden: miden cosas distintas).
 * - **La semana que pasó**: lo que movió la historia, sacado de la crónica (U4), sin llamar
 *   al modelo.
 *
 * Puro: arma lo que se enseña. Quien llama lo dibuja.
 *
 * Ver wiki/ROADMAP_PEGAMENTO.md, U5.
 */

import { readFactions, clockOf, describeStanding } from './factions.js';
import { readDebt } from './patronage.js';
import { visibleOpen, daysLeftOf } from './plot.js';
import { deadlineOf } from './contracts.js';
import { readAttitudes, describeAttitude } from './attitudes.js';
import { readWanted } from './crime.js';
import { describeFame } from './fame.js';
import { fortuneOf } from '../world/fortune.js';

/** Los asuntos que caben en la mesa. Más, y deja de ser una decisión para ser un menú. */
export const TABLE_MAX = 5;

/** Hasta dónde mira una facción para entrar en la mesa. */
const FACTION_HORIZON = 21;

/** Cómo se dice lo que quiere conseguir una facción. */
const GOAL_VERBS = {
    encontrar: 'encuentra',
    conquistar: 'toma',
    recuperar: 'recupera',
    destruir: 'destruye',
    controlar: 'se hace con',
};

/**
 * @typedef {Object} Affair
 * @property {string} id
 * @property {'deuda'|'encargo'|'hito'|'faccion'|'personal'|'tablon'|'caso'|'harto'} kind
 * @property {string} title
 * @property {string} detail Dónde y qué da.
 * @property {number|null} in Días hasta el plazo; nada si no tiene.
 * @property {string} ifIgnored Lo que pasa si no se atiende, dicho con su motivo.
 * @property {string} where El sitio al que hay que ir, si lo hay.
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Los asuntos de esta semana: de todos los relojes, los que aprietan antes, cinco como mucho.
 *
 * @param {Object} input
 * @param {number} input.today
 * @param {any[]} [input.factions]
 * @param {any} [input.taken]
 * @param {any[]} [input.board]
 * @param {any} [input.plot]
 * @param {any} [input.plotState]
 * @param {any} [input.debt]
 * @param {Array<{id: any, name: string}>} [input.party]
 * @param {boolean} [input.rivals] Si hay rivales que se llevan encargos (idea 94).
 * @param {{active: any, found: string[]}|null} [input.mystery] El caso abierto (U8).
 * @param {Array<{id: any, name: string}>} [input.leaving] T7: quien está harto y puede irse el día de la semana.
 * @param {number} [input.weekDue] El día de la semana (cuando se cobra, se va quien se va).
 * @returns {Affair[]}
 */
export function affairsOf({ today, factions = [], taken = null, board = [], plot = null, plotState = null, debt = null, party = [], rivals = false, mystery = null, leaving = [], weekDue = 0 }) {
    const now = Math.max(1, Math.floor(Number(today) || 1));
    /** @type {Affair[]} */
    const out = [];

    const owed = debt ? readDebt(debt) : null;
    if (owed && owed.owed > 0) {
        out.push({
            id: 'deuda', kind: 'deuda', title: 'La deuda con quien os prestó', detail: `${owed.owed} de oro, o cumplir el favor`,
            in: Math.max(0, owed.dueDay - now), ifIgnored: `Os cobran ${owed.owed} de oro, y os miran peor`, where: '',
        });
    }

    if (taken && text(taken.title)) {
        const left = deadlineOf(taken, now).daysLeft;
        out.push({
            id: `encargo:${text(taken.id)}`, kind: 'encargo', title: text(taken.title),
            detail: [taken.locationName ? `en ${text(taken.locationName)}` : '', Number(taken.reward) > 0 ? `${Number(taken.reward)} de oro` : ''].filter(Boolean).join(' · '),
            in: Math.max(0, left), ifIgnored: 'Caduca, y el sitio que lo pedía lo nota', where: text(taken.locationName),
        });
    }

    for (const milestone of visibleOpen(plot, plotState)) {
        const left = daysLeftOf(plot, plotState, milestone.id, now);
        out.push({
            id: `hito:${milestone.id}`, kind: 'hito', title: milestone.title, detail: milestone.hint || 'El hilo de la historia',
            in: left, ifIgnored: left !== null ? 'Se pasa el plazo, y la historia sigue sin vosotros' : 'Espera: el hilo no se va, pero el mundo sí se mueve',
            where: text(milestone.asks?.place),
        });
    }

    for (const faction of readFactions(factions)) {
        const clock = clockOf(faction);
        if (!clock.moving || clock.days > FACTION_HORIZON) continue;
        const verb = GOAL_VERBS[/** @type {keyof typeof GOAL_VERBS} */ (faction.goal.kind)] ?? 'consigue lo que quiere en';
        const target = faction.goal.target || 'lo que busca';
        out.push({
            id: `faccion:${faction.id}`, kind: 'faccion', title: `${faction.name} va a por ${target}`,
            detail: `Reloj ${clock.at} de ${clock.of}. Estar allí lo frena`,
            in: clock.days, ifIgnored: `${faction.name} ${verb} ${target}, porque nadie fue a impedirlo`, where: faction.goal.target,
        });
    }

    const names = new Map((party ?? []).map(m => [String(m?.id), text(m?.name)]));
    const open = (Array.isArray(board) ? board : []).filter(c => c && String(c.id) !== String(taken?.id ?? ''));
    for (const contract of open.filter(c => text(c.personal))) {
        const who = names.get(String(contract.personal)) || 'Un compañero';
        out.push({
            id: `personal:${text(contract.id)}`, kind: 'personal', title: text(contract.title), detail: `Lo pide ${who}`,
            in: Math.max(0, deadlineOf(contract, now).daysLeft), ifIgnored: `${who} se acuerda de que no fuisteis`, where: text(contract.locationName),
        });
    }
    const best = open.filter(c => !text(c.personal)).sort((a, b) => (Number(b.reward) || 0) - (Number(a.reward) || 0))[0];
    if (best) {
        out.push({
            id: `tablon:${text(best.id)}`, kind: 'tablon', title: text(best.title),
            detail: [`rango ${text(best.rank) || '?'}`, `${Number(best.reward) || 0} de oro`, best.locationName ? `en ${text(best.locationName)}` : ''].filter(Boolean).join(' · '),
            in: Math.max(0, deadlineOf(best, now).daysLeft),
            ifIgnored: rivals ? 'Caduca, o se lo llevan los rivales' : 'Caduca, y el sitio que lo pedía lo nota',
            where: text(best.locationName),
        });
    }

    // U8: el caso abierto. Sin plazo escrito, pero el culpable no espera para siempre.
    if (mystery?.active) {
        const total = mystery.active.clues.filter((/** @type {any} */ c) => !c.misleading).length;
        out.push({
            id: `caso:${text(mystery.active.id)}`, kind: 'caso', title: text(mystery.active.title),
            detail: `En ${text(mystery.active.place)} · ${mystery.found.length} pista(s) encontradas de unas ${total}`,
            in: null, ifIgnored: 'Quien fue sigue suelto, y el sitio se acuerda de que nadie lo resolvió', where: text(mystery.active.place),
        });
    }

    // T7: quien está harto también pide su sitio en la mesa: si nadie le atiende, se va.
    for (const member of Array.isArray(leaving) ? leaving : []) {
        if (!member?.name) continue;
        out.push({
            id: `harto:${text(member.id)}`, kind: 'harto', title: `${text(member.name)} está harto`,
            detail: 'Algo le pesa: habladle, dadle lo que quiere o cambiad de rumbo',
            in: Number(weekDue) > 0 ? Math.max(0, Number(weekDue) - now) : null,
            ifIgnored: `${text(member.name)} se va, con lo suyo`, where: '',
        });
    }

    const order = ['deuda', 'encargo', 'hito', 'harto', 'caso', 'personal', 'faccion', 'tablon'];
    const sorted = out.sort((a, b) => (a.in ?? 999) - (b.in ?? 999) || order.indexOf(a.kind) - order.indexOf(b.kind));
    const top = sorted.slice(0, TABLE_MAX);
    // El caso no tiene fecha, pero no se cae de la mesa: si no cabe, sale el último.
    const mysteryAffair = sorted.find(a => a.kind === 'caso');
    if (mysteryAffair && !top.includes(mysteryAffair)) top[top.length - 1] = mysteryAffair;
    return top;
}

/**
 * Cómo os ven: las siete formas de opinión, juntas. Solo lo que no es indiferente.
 *
 * @param {Object} input
 * @param {any} [input.guild]
 * @param {any[]} [input.factions]
 * @param {any} [input.fame]
 * @param {any[]} [input.places]
 * @param {any} [input.wanted]
 * @param {any} [input.attitudes]
 * @param {Array<{name: string, rank: number}>} [input.companions]
 * @returns {Array<{title: string, items: string[]}>}
 */
export function standingsOf({ guild = null, factions = [], fame = null, places = [], wanted = null, attitudes = null, companions = [] }) {
    /** @type {Array<{title: string, items: string[]}>} */
    const out = [];
    const add = (/** @type {string} */ title, /** @type {string[]} */ items) => {
        if (items.length > 0) out.push({ title, items });
    };
    if (guild && Number(guild.renown) > 0) add('El gremio', [`${text(guild.name) || 'Vuestro gremio'}: reputación ${Number(guild.renown)}`]);
    add('Las facciones', readFactions(factions).filter(f => Number(f.reputation) !== 0).map(f => `${f.name}: ${describeStanding(f.reputation)}`));
    add('Dónde os conocen', describeFame(fame));
    add('Cómo les va a los sitios', (places ?? []).filter(p => fortuneOf(p) !== 0).map(p => `${text(p.name)}: ${fortuneOf(p) > 0 ? 'les va mejor gracias a vosotros' : 'lo están pasando mal'} (${fortuneOf(p) > 0 ? '+' : ''}${fortuneOf(p)})`));
    add('Dónde os buscan', Object.entries(readWanted(wanted)).filter(([, n]) => n > 0).map(([place, n]) => `${place}: ${n >= 2 ? 'os paran los guardias' : 'os tienen fichados'} (${n})`));
    add('La gente', Object.entries(readAttitudes(attitudes).values).map(([name, value]) => `${name}: ${describeAttitude(value)}`));
    add('Los compañeros', (companions ?? []).filter(c => Number(c.rank) > 0).map(c => `${text(c.name)}: vínculo ${Number(c.rank)}`));
    return out;
}

/**
 * La semana que pasó, sacada de la crónica: lo que movió la historia, y cuánto de lo menor.
 *
 * @param {Array<{index: number, category: string, text: string, minor: boolean}>} entries
 * @param {number} since El primer mensaje de la semana.
 * @param {number} [limit]
 * @returns {string[]}
 */
export function weekSummary(entries, since, limit = 6) {
    const week = (entries ?? []).filter(e => e.index >= Math.max(0, Math.floor(Number(since) || 0)));
    const major = week.filter(e => !e.minor).slice(-limit).map(e => e.text.split('\n')[0]);
    const minor = week.filter(e => e.minor).length;
    if (major.length === 0 && minor === 0) return [];
    return [...major, ...(minor > 0 ? [`Y ${minor} ${minor === 1 ? 'cosa menor' : 'cosas menores'} más: combates, compras, caminos.`] : [])];
}
