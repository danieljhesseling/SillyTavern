/**
 * Lo que una partida recuerda de su gente (J14 de wiki/ROADMAP_SIN_CONEXION.md): las charlas
 * ya oídas, las escenas de quedada ya jugadas, lo que ha abierto cada vínculo y en qué se ha
 * ido cada parte del día.
 *
 * Va todo en una clave (`social`) y **por el nombre de cada persona**, no por su id: el Gerd
 * del gremio es el mismo Gerd en Barovia, y un id cambia de un chat a otro. Por eso esto
 * viaja tal cual entre el gremio y las campañas. Los vínculos (`bonds.js`) van por el id del
 * compañero, porque así los leen las ventajas de combate; `carryBonds` los lleva de un chat a
 * otro por el nombre, y `adoptBond` pasa lo de alguien que aún no iba contigo a su ficha
 * cuando se une.
 *
 * Puro: lee, repara y devuelve copias. Quien llama guarda.
 */

import { normalizeBondState } from './bonds.js';

/** La clave en los metadatos del chat. */
export const SOCIAL_KEY = 'social';

export const SOCIAL_VERSION = 1;

/** Cuántas charlas oídas se recuerdan: más que todas las que hay escritas de una persona. */
export const HEARD_MEMORY = 600;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * La clave de una persona: su nombre en minúsculas, sin tildes y con guiones. «Arthur «Doc»»
 * es `arthur-doc`; «Tomás», `tomas`.
 *
 * @param {any} name
 * @returns {string}
 */
export function keyOf(name) {
    return text(name).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

/**
 * La clave del vínculo de alguien: el id de su ficha si va en el grupo (así lo leen las
 * ventajas de combate), o `gente:<nombre>` si todavía no va contigo.
 *
 * @param {{id?: any, name?: string}|null|undefined} person
 * @returns {string}
 */
export function bondKeyOf(person) {
    const id = person?.id;
    if (id !== undefined && id !== null && text(id)) return text(id);
    const key = keyOf(person?.name);
    return key ? `gente:${key}` : '';
}

/**
 * @typedef {Object} DayDone
 * @property {string} slot  La franja (`morning`, `afternoon`, `night`).
 * @property {string} what  La actividad (`quedar`, `entrenar`…) o lo que la gastó (`viaje`, `pelea`…).
 * @property {string} label Cómo se dice.
 * @property {string} [who] Con quién, si fue una quedada.
 */

/**
 * @typedef {Object} SocialState
 * @property {number} version
 * @property {string[]} heard  Las charlas ya oídas (sus ids): no se repiten hasta agotarlas.
 * @property {number} talkSlot La franja (contada desde el principio) de la última charla que salió sola.
 * @property {string} lastSpeaker Quién habló en la última charla.
 * @property {Record<string, number>} nudged Por persona, el día en que una charla movió su aprobación.
 * @property {Record<string, number>} warmth Por persona que no va en el grupo, lo que suman sus charlas.
 * @property {Record<string, string[]>} seen Por persona, las escenas de quedada ya jugadas.
 * @property {Record<string, string[]>} opened Por persona, lo que ya se ha abierto con su vínculo.
 * @property {Record<string, number>} met Por persona, la franja de la última quedada.
 * @property {{day: number, done: DayDone[]}} day Lo que se ha hecho hoy, franja a franja.
 * @property {{what: string, day: number, slot: string, used: boolean}|null} errand Lo que se está
 *   haciendo sin haber gastado aún la franja (ir de compras).
 */

/**
 * @param {any} raw
 * @returns {Record<string, number>}
 */
function numbers(raw) {
    /** @type {Record<string, number>} */
    const out = {};
    for (const [key, value] of Object.entries(raw && typeof raw === 'object' ? raw : {})) {
        const n = Number(value);
        if (text(key) && Number.isFinite(n)) out[text(key)] = n;
    }
    return out;
}

/**
 * @param {any} raw
 * @returns {Record<string, string[]>}
 */
function lists(raw) {
    /** @type {Record<string, string[]>} */
    const out = {};
    for (const [key, value] of Object.entries(raw && typeof raw === 'object' ? raw : {})) {
        const list = (Array.isArray(value) ? value : []).map(text).filter(Boolean);
        if (text(key) && list.length > 0) out[text(key)] = [...new Set(list)];
    }
    return out;
}

/** @returns {SocialState} */
export function createSocial() {
    return {
        version: SOCIAL_VERSION,
        heard: [],
        talkSlot: -1,
        lastSpeaker: '',
        nudged: {},
        warmth: {},
        seen: {},
        opened: {},
        met: {},
        day: { day: 0, done: [] },
        errand: null,
    };
}

/**
 * Lo guardado, con forma aunque llegue roto o de una versión vieja.
 *
 * @param {any} raw
 * @returns {SocialState}
 */
export function readSocial(raw) {
    if (!raw || typeof raw !== 'object') return createSocial();
    const day = raw.day && typeof raw.day === 'object' ? raw.day : {};
    const errand = raw.errand && typeof raw.errand === 'object' && text(raw.errand.what) ? raw.errand : null;
    return {
        version: SOCIAL_VERSION,
        heard: (Array.isArray(raw.heard) ? raw.heard : []).map(text).filter(Boolean).slice(-HEARD_MEMORY),
        talkSlot: Number.isInteger(raw.talkSlot) ? raw.talkSlot : -1,
        lastSpeaker: text(raw.lastSpeaker),
        nudged: numbers(raw.nudged),
        warmth: numbers(raw.warmth),
        seen: lists(raw.seen),
        opened: lists(raw.opened),
        met: numbers(raw.met),
        day: {
            day: Math.max(0, Math.floor(Number(day.day) || 0)),
            done: (Array.isArray(day.done) ? day.done : [])
                .filter((/** @type {any} */ d) => d && text(d.slot) && text(d.what))
                .map((/** @type {any} */ d) => ({
                    slot: text(d.slot), what: text(d.what), label: text(d.label) || text(d.what),
                    ...(text(d.who) ? { who: text(d.who) } : {}),
                })),
        },
        errand: errand ? {
            what: text(errand.what),
            day: Math.max(0, Math.floor(Number(errand.day) || 0)),
            slot: text(errand.slot),
            used: Boolean(errand.used),
        } : null,
    };
}

/**
 * Los vínculos al cambiar de chat (del gremio a una campaña, o de vuelta): lo de cada
 * compañero pasa del id que tenía allí al que tiene aquí, por su nombre. Lo de quien no está
 * en ninguno de los dos grupos se queda como estaba (la gente del pueblo, `gente:…`).
 *
 * @param {Object} input
 * @param {any} input.bonds Los vínculos del chat de salida.
 * @param {any[]} input.from El grupo en el chat de salida.
 * @param {any[]} input.to   El grupo en el de llegada.
 * @param {any} [input.here] Los vínculos que ya había en el de llegada: los de quien no viaja se quedan.
 * @returns {any} Los vínculos del chat de llegada.
 */
export function carryBonds({ bonds, from, to, here = null }) {
    const source = normalizeBondState(bonds).bonds;
    const target = normalizeBondState(here);
    const idByName = new Map((Array.isArray(to) ? to : []).filter(m => m && text(m.name)).map(m => [keyOf(m.name), text(m.id)]));
    const travelling = new Set();
    /** @type {Record<string, any>} */
    const out = { ...target.bonds };
    for (const member of Array.isArray(from) ? from : []) {
        const oldId = text(member?.id);
        const newId = idByName.get(keyOf(member?.name));
        if (!oldId || !newId || !source[oldId]) continue;
        travelling.add(newId);
        out[newId] = { ...source[oldId], characterId: newId };
    }
    // La gente de aquí (`gente:…`) viaja también: es la misma persona en cualquier chat.
    for (const [id, bond] of Object.entries(source)) {
        if (id.startsWith('gente:') && !travelling.has(id)) out[id] = { ...bond };
    }
    return normalizeBondState({ bonds: out });
}

/**
 * Cuando alguien que aún no iba contigo se une (contratas a Gerd), lo que ya había entre
 * vosotros pasa a su ficha. Si ya tenía algo en su ficha, se suma.
 *
 * @param {any} bonds
 * @param {string} fromKey `gente:gerd-el-mellado`
 * @param {string} toKey   El id de su ficha.
 * @returns {any}
 */
export function adoptBond(bonds, fromKey, toKey) {
    const state = normalizeBondState(bonds);
    const from = state.bonds[text(fromKey)];
    const to = text(toKey);
    if (!from || !to || text(fromKey) === to) return state;
    const had = state.bonds[to];
    const rest = { ...state.bonds };
    delete rest[text(fromKey)];
    rest[to] = { characterId: to, points: (had?.points ?? 0) + from.points, usedOncePerDay: had?.usedOncePerDay ?? [] };
    return normalizeBondState({ bonds: rest });
}
