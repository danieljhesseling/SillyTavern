/**
 * Los despachos: mandar compañeros sin el héroe a un encargo menor (U8 del pegamento; la
 * fase F3 de la Mesa de la Semana en wiki/archivo/PROPUESTAS_BUCLE_DE_JUEGO.md).
 *
 * La mesa enseña más asuntos de los que caben; esto es lo que hace que un grupo grande sea
 * una ventaja y el banquillo algo que se usa: mientras tú vas a la cueva, Bran y Kael escoltan
 * al molinero. El motor lo resuelve —nivel, si su oficio encaja con el trabajo, si van
 * heridos— y **la probabilidad se ve antes de mandarlos**. Vuelven días después con el
 * resultado, con el oro, a veces heridos, y si la campaña lo permite y sale muy mal, alguno
 * no vuelve.
 *
 * Solo lo menor: el hilo y los encargos peligrosos piden al héroe.
 *
 * Puro, con el azar inyectado. Quien llama saca y mete a la gente del grupo.
 *
 * Ver wiki/ROADMAP_PEGAMENTO.md, U8.
 */

import { familyOf } from '../rules/class-trees.js';
import { readInjuries } from '../rules/injuries.js';

/** Los rangos que se pueden despachar: recados y trabajo honrado. */
export const DISPATCH_RANKS = ['D', 'C'];

/** Lo que pide cada rango, en «fuerza» (niveles, más lo que encaja). */
const NEED = { D: 2, C: 4 };

/** Qué oficios le van a cada clase de trabajo. */
export const FIT = {
    cull: ['marcial', 'cazador'],
    hunt: ['cazador', 'marcial'],
    escort: ['marcial', 'devoto'],
    recover: ['astuto', 'cazador'],
    hold: ['marcial', 'devoto'],
    steal: ['astuto'],
    silence: ['astuto', 'marcial'],
};

/** Cómo se dice cada familia, para explicar por qué encaja. */
const FAMILY_LABELS = { marcial: 'de armas', astuto: 'de maña', arcano: 'de saberes', devoto: 'de fe', cazador: 'de monte' };

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Si un encargo se puede despachar, y si no, por qué.
 *
 * @param {any} contract
 * @returns {{ok: boolean, reason: string}}
 */
export function canDispatch(contract) {
    if (!contract) return { ok: false, reason: 'No hay encargo.' };
    if (text(contract.personal)) return { ok: false, reason: 'Es un encargo personal: lo pide para vosotros, no para cualquiera.' };
    if (!DISPATCH_RANKS.includes(text(contract.rank))) return { ok: false, reason: 'Es demasiado peligroso para mandar a nadie sin el héroe.' };
    return { ok: true, reason: '' };
}

/**
 * Lo que tienen de salir bien, y por qué: se ve antes de mandarlos.
 *
 * @param {Object} input
 * @param {any[]} input.members
 * @param {any} input.contract
 * @returns {{chance: number, reasons: string[]}}
 */
export function dispatchOdds({ members, contract }) {
    const need = NEED[/** @type {keyof typeof NEED} */ (text(contract?.rank))] ?? 4;
    const fits = FIT[/** @type {keyof typeof FIT} */ (text(contract?.kind))] ?? [];
    let power = 0;
    /** @type {string[]} */
    const reasons = [];
    for (const member of members ?? []) {
        power += Math.max(1, Math.floor(Number(member?.level) || 1));
        const family = familyOf(member);
        if (family && fits.includes(family)) {
            power += 1;
            reasons.push(`${text(member.name)} es ${FAMILY_LABELS[/** @type {keyof typeof FAMILY_LABELS} */ (family)]}: le va este trabajo`);
        }
        const hurt = readInjuries(member).filter(i => !i.permanent && i.daysLeft > 0).length;
        if (hurt > 0) {
            power -= 1;
            reasons.push(`${text(member.name)} va herido`);
        }
    }
    const raw = 0.35 + 0.12 * (power - need);
    const chance = Math.round(Math.max(0.1, Math.min(0.95, raw)) * 20) / 20;
    return { chance, reasons };
}

/**
 * Los días que están fuera.
 *
 * @param {any} contract
 * @returns {number}
 */
export function dispatchDays(contract) {
    return (text(contract?.rank) === 'C' ? 4 : 2) + (text(contract?.kind) === 'escort' ? 1 : 0);
}

/**
 * @typedef {Object} Dispatch
 * @property {string} id
 * @property {any} contract
 * @property {any[]} members Las fichas, guardadas mientras están fuera.
 * @property {number} leftOn
 * @property {number} backOn
 * @property {number} chance
 */

/**
 * Mandarlos.
 *
 * @param {Object} input
 * @param {any} input.contract
 * @param {any[]} input.members
 * @param {number} input.today
 * @param {number} input.chance
 * @returns {Dispatch}
 */
export function startDispatch({ contract, members, today, chance }) {
    const now = Math.max(1, Math.floor(Number(today) || 1));
    return {
        id: `despacho-${text(contract?.id)}-${now}`,
        contract: structuredClone(contract),
        members: structuredClone(members ?? []),
        leftOn: now,
        backOn: now + dispatchDays(contract),
        chance: Math.max(0, Math.min(1, Number(chance) || 0)),
    };
}

/**
 * Los que vuelven hoy, y los que siguen fuera.
 *
 * @param {any} list
 * @param {number} today
 * @returns {{due: Dispatch[], away: Dispatch[]}}
 */
export function dispatchesDue(list, today) {
    const all = (Array.isArray(list) ? list : []).filter(d => d && Array.isArray(d.members));
    const now = Math.max(1, Math.floor(Number(today) || 1));
    return { due: all.filter(d => Number(d.backOn) <= now), away: all.filter(d => Number(d.backOn) > now) };
}

/**
 * Cómo les fue: sale o no, el oro, quién vuelve herido y, si la campaña lo permite y sale muy
 * mal, quién no vuelve.
 *
 * @param {Object} input
 * @param {Dispatch} input.dispatch
 * @param {() => number} input.random
 * @param {boolean} [input.allowDeath]
 * @returns {{success: boolean, reward: number, hurt: string, dead: string, line: string}}
 */
export function resolveDispatch({ dispatch, random, allowDeath = false }) {
    const roll = random();
    const success = roll < dispatch.chance;
    const members = dispatch.members ?? [];
    const names = members.map(m => text(m.name));
    const who = names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : (names[0] || 'Los que mandasteis');
    const title = text(dispatch.contract?.title) || 'el encargo';
    const pick = () => members[Math.floor(random() * members.length) % Math.max(1, members.length)];
    if (success) {
        const scratch = random() < 0.25 ? pick() : null;
        return {
            success: true,
            reward: Math.max(0, Math.floor(Number(dispatch.contract?.reward) || 0)),
            hurt: scratch ? String(scratch.id) : '',
            dead: '',
            line: `${who} ${names.length > 1 ? 'vuelven' : 'vuelve'} de «${title}»: hecho, y traen ${Math.floor(Number(dispatch.contract?.reward) || 0)} de oro.${scratch ? ` ${text(scratch.name)} trae un golpe.` : ''}`,
        };
    }
    // Muy mal: muy por encima de lo que tenían. Solo entonces, y solo si la campaña lo permite.
    const disaster = allowDeath && members.length > 0 && roll > Math.min(0.97, dispatch.chance + 0.45);
    const fallen = disaster ? pick() : null;
    const hurt = !fallen && random() < 0.6 ? pick() : null;
    return {
        success: false,
        reward: 0,
        hurt: hurt ? String(hurt.id) : '',
        dead: fallen ? String(fallen.id) : '',
        line: fallen
            ? `${who} ${names.length > 1 ? 'vuelven' : 'vuelve'} de «${title}» sin nada. ${text(fallen.name)} no vuelve.`
            : `${who} ${names.length > 1 ? 'vuelven' : 'vuelve'} de «${title}» sin nada: salió mal.${hurt ? ` ${text(hurt.name)} viene herido.` : ''}`,
    };
}
