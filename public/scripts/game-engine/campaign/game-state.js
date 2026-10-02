/**
 * La partida es el gremio (J4.2 de wiki/ROADMAP_SIN_CONEXION.md): lo que es de la partida entera
 * —el gremio, su almacén, quien espera en casa y la mascota— guardado una vez, aparte de las
 * campañas.
 *
 * Hasta ahora cada chat llevaba su propio gremio. El del gremio tenía los edificios y el arca; el
 * de Strahd, otro gremio vacío donde caía el renombre de sus encargos; y el de 1387, otro más. El
 * grupo sí viajaba (`partySnapshot` → `adoptCarriedParty`), pero el gremio se quedaba en cada chat.
 *
 * Ahora hay **un almacén** en los metadatos del mundo del gremio (`HUB_STATE_KEY`), con las claves
 * que el registro del estado marca como de la partida (`gameScopeKeys`). Cada chat del gremio o de
 * sus campañas lleva una copia de trabajo en sus metadatos, como siempre: así todo lo que lee
 * `chat_metadata.guild` sigue leyéndolo igual. Lo que cambia es que la copia se pone al día con el
 * almacén al abrir el chat y al salir de él.
 *
 * Para saber quién va por delante, el almacén lleva una versión (`rev`) y cada chat, la versión
 * que tiene (`HUB_STATE_REV_KEY`):
 *
 * - **Sin almacén** (una partida nueva, o de antes de esto): se crea con lo del chat abierto.
 * - **Chat sin versión** (de antes de esto, o recién creado): lo suyo **se funde** con el almacén
 *   —el renombre y el arca se suman, los edificios quedan al nivel más alto, y en la plantilla, el
 *   almacén y el banquillo nadie sale dos veces— y luego se trae. Así una partida de antes no
 *   pierde el renombre que ganó en una campaña. Cada chat se funde una vez (`folded`).
 * - **Chat por detrás** (su versión es menor): otro chat escribió después; se trae del almacén.
 * - **Chat al día**: fue el último que escribió; lo suyo sube al almacén (versión nueva si cambió).
 *
 * Los puntos de retorno: el almacén apunta quién escribió el último (`by`) y desde qué versión
 * escribe sin que nadie más lo haya hecho (`from`). Al volver a un punto, si desde entonces solo
 * ha escrito este chat, el gremio del punto **se devuelve** al almacén: un encargo cumplido y
 * luego deshecho no deja su renombre. Si otro chat escribió después (un viaje al gremio, otra
 * campaña), lo suyo se queda y el punto trae el gremio de ahora.
 *
 * Puro: decide y mezcla. Quien llama lee y guarda el mundo y el chat.
 */

import { gameScopeKeys } from './state-registry.js';
import { readGuild, MAX_STAFF } from './guild.js';

/** En los metadatos del mundo del gremio: lo de la partida entera. */
export const HUB_STATE_KEY = 'hubState';

/** En los de cada chat de la partida: qué versión del almacén tiene. */
export const HUB_STATE_REV_KEY = 'hubStateRev';

/**
 * @typedef {Object} GameState
 * @property {number} version
 * @property {number} rev La versión: sube cada vez que un chat cambia algo.
 * @property {Record<string, any>} keys Lo de la partida, por clave.
 * @property {string[]} folded Los chats cuyo gremio ya se fundió en este (se funde una vez).
 * @property {string} by El chat que escribió el último (vacío si no se sabe).
 * @property {number} from La versión sobre la que ese chat empezó a escribir: desde ella, nadie más.
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {any} */
const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

/** @param {any} a @param {any} b @returns {boolean} */
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** @param {Record<string, any>|null|undefined} source @param {string} key @returns {boolean} */
const has = (source, key) => Boolean(source) && Object.prototype.hasOwnProperty.call(source, key) && source?.[key] !== undefined && source?.[key] !== null;

/**
 * Lo guardado del almacén, con forma aunque llegue roto. Sin almacén, `null`.
 *
 * @param {any} raw
 * @returns {GameState|null}
 */
export function readGameState(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    /** @type {Record<string, any>} */
    const keys = {};
    for (const key of gameScopeKeys()) {
        if (has(raw.keys, key)) keys[key] = clone(raw.keys[key]);
    }
    const folded = [...new Set((Array.isArray(raw.folded) ? raw.folded : []).map(text).filter(Boolean))];
    const rev = Math.max(1, Math.floor(Number(raw.rev) || 1));
    const from = Math.min(rev, Math.max(0, Math.floor(Number(raw.from) || 0)));
    return { version: 1, rev, keys, folded, by: text(raw.by), from };
}

/**
 * Lo de la partida que lleva un chat, copiado.
 *
 * @param {Record<string, any>|null|undefined} meta Los metadatos del chat.
 * @returns {Record<string, any>}
 */
export function pickGameKeys(meta) {
    /** @type {Record<string, any>} */
    const out = {};
    for (const key of gameScopeKeys()) {
        if (has(meta, key)) out[key] = clone(meta?.[key]);
    }
    return out;
}

/**
 * Si dos copias de lo de la partida dicen lo mismo.
 *
 * @param {Record<string, any>} a
 * @param {Record<string, any>} b
 * @returns {boolean}
 */
export function sameGameKeys(a, b) {
    return gameScopeKeys().every(key => same(a?.[key], b?.[key]));
}

/** Los rangos del gremio, de menos a más (`guild-rank.js`). */
const RANK_ORDER = ['D', 'C', 'B', 'A', 'S'];

/**
 * Dos gremios en uno: el de una partida de antes, que tenía uno por chat.
 *
 * El renombre y el oro del arca se suman: cada chat ganó lo suyo, y nunca se copiaron de uno a
 * otro. Los edificios quedan al nivel más alto; la plantilla, sin repetir a nadie. El nombre y
 * el tema, los del primero que los tenga. Lo que no se conoce se queda como estaba en el primero.
 *
 * @param {any} first El del almacén.
 * @param {any} second El del chat que se funde.
 * @returns {any}
 */
export function mergeGuilds(first, second) {
    if (first === undefined || first === null) return clone(second);
    if (second === undefined || second === null) return clone(first);
    const a = readGuild(first);
    const b = readGuild(second);
    /** @type {Record<string, number>} */
    const buildings = { ...a.buildings };
    for (const [key, level] of Object.entries(b.buildings)) buildings[key] = Math.max(buildings[key] ?? 0, level);
    const names = new Set(a.staff.map(person => person.name.toLowerCase()));
    const staff = [...a.staff, ...b.staff.filter(person => !names.has(person.name.toLowerCase()))].slice(0, MAX_STAFF);
    const gold = (a.gold ?? 0) + (b.gold ?? 0);
    const seen = Math.max(RANK_ORDER.indexOf(a.rankSeen ?? ''), RANK_ORDER.indexOf(b.rankSeen ?? ''));
    /** @type {any} */
    const merged = {
        ...clone(second),
        ...clone(first),
        name: a.name || b.name,
        theme: a.theme !== 'general' ? a.theme : b.theme,
        renown: a.renown + b.renown,
        buildings,
        staff,
    };
    delete merged.gold;
    delete merged.rankSeen;
    if (gold > 0) merged.gold = gold;
    if (seen >= 0) merged.rankSeen = RANK_ORDER[seen];
    return merged;
}

/**
 * Dos listas en una, sin repetir a nadie (por su id y, si no tiene, por su nombre).
 *
 * @param {any} first
 * @param {any} second
 * @returns {any[]}
 */
function mergeLists(first, second) {
    const a = Array.isArray(first) ? first : [];
    const b = Array.isArray(second) ? second : [];
    /** @param {any} row @returns {string} */
    const idOf = (row) => (text(row?.id) ? `id:${text(row.id)}` : `name:${text(row?.name).toLowerCase()}`);
    const known = new Set(a.map(idOf));
    return clone([...a, ...b.filter(row => !known.has(idOf(row)))]);
}

/**
 * Cómo se juntan, clave a clave, lo del almacén y lo de un chat que se funde. Lo que no está
 * aquí se queda como lo tiene el almacén (y, si no lo tiene, como lo trae el chat).
 *
 * @type {Record<string, (first: any, second: any) => any>}
 */
const MERGERS = {
    guild: mergeGuilds,
    // El almacén de cada chat nunca viajó: lo de uno no está en otro. Se junta entero, sin mirar
    // ids (dos pociones iguales son dos pociones).
    guildStorage: (first, second) => clone([...(Array.isArray(first) ? first : []), ...(Array.isArray(second) ? second : [])]),
    bench: mergeLists,
};

/**
 * Lo de la partida de un chat de antes, fundido con el almacén.
 *
 * @param {Record<string, any>} store Lo del almacén.
 * @param {Record<string, any>} chat Lo del chat.
 * @returns {Record<string, any>}
 */
export function mergeGameKeys(store, chat) {
    /** @type {Record<string, any>} */
    const out = {};
    for (const key of gameScopeKeys()) {
        const mine = has(store, key);
        const theirs = has(chat, key);
        if (!mine && !theirs) continue;
        const merger = MERGERS[key];
        out[key] = mine && theirs && merger ? merger(store[key], chat[key]) : clone(mine ? store[key] : chat[key]);
    }
    return out;
}

/**
 * @typedef {Object} GameSyncPlan
 * @property {'crear'|'fundir'|'traer'|'subir'|'devolver'|'nada'} action
 * @property {GameState} store Cómo queda el almacén.
 * @property {boolean} storeChanged Si hay que guardar el mundo del gremio.
 * @property {boolean} pull Si el chat tiene que traer lo del almacén (`pullGameKeys`).
 */

/**
 * El almacén con lo de un chat encima, escrito por él: si ya era el último en escribir, sigue su
 * tramo; si no, empieza uno nuevo sobre la versión que había.
 *
 * @param {GameState} base
 * @param {Record<string, any>} keys
 * @param {number} rev
 * @param {string} id
 * @returns {GameState}
 */
function writtenBy(base, keys, rev, id) {
    return { ...base, rev, keys, by: id, from: base.by === id ? base.from : base.rev };
}

/**
 * Qué hacer al abrir un chat de la partida (o antes de salir de él).
 *
 * @param {Object} input
 * @param {any} input.store Lo guardado en el mundo del gremio (`HUB_STATE_KEY`).
 * @param {string} input.chatId El chat abierto.
 * @param {Record<string, any>|null|undefined} input.meta Sus metadatos.
 * @param {boolean} [input.restore] Se acaba de volver a un punto de retorno en este chat.
 * @returns {GameSyncPlan}
 */
export function planGameSync({ store, chatId, meta, restore = false }) {
    const now = readGameState(store);
    const id = text(chatId);
    const mine = pickGameKeys(meta);
    const rev = Math.floor(Number(meta?.[HUB_STATE_REV_KEY]));
    const marked = Number.isFinite(rev) && rev >= 1;

    if (!now) {
        return { action: 'crear', store: { version: 1, rev: 1, keys: mine, folded: id ? [id] : [], by: id, from: 1 }, storeChanged: true, pull: false };
    }
    // Un punto de retorno de este mismo tramo (desde él solo ha escrito este chat): su gremio
    // vuelve al almacén. Lo que se deshace es solo de aquí.
    if (restore && marked && id && rev < now.rev && now.by === id && rev >= now.from && !sameGameKeys(mine, now.keys)) {
        return { action: 'devolver', store: writtenBy(now, mine, now.rev + 1, id), storeChanged: true, pull: false };
    }
    if (!marked) {
        // Ya fundido una vez y sin versión: un punto de retorno de antes se la quitó. Lo suyo ya
        // está en el almacén; fundirlo otra vez sumaría dos veces el mismo renombre.
        if (id && now.folded.includes(id)) return { action: 'traer', store: now, storeChanged: false, pull: true };
        const keys = mergeGameKeys(now.keys, mine);
        const folded = { ...now, folded: id ? [...now.folded, id] : now.folded };
        return {
            action: 'fundir',
            store: sameGameKeys(keys, now.keys) ? folded : writtenBy(folded, keys, now.rev + 1, id),
            storeChanged: true,
            pull: true,
        };
    }
    if (rev < now.rev) return { action: 'traer', store: now, storeChanged: false, pull: true };
    if (sameGameKeys(mine, now.keys)) {
        // Al día. Si el chat iba por delante (el mundo no llegó a guardarse), el almacén se pone a su altura.
        return rev > now.rev
            ? { action: 'nada', store: { ...now, rev }, storeChanged: true, pull: false }
            : { action: 'nada', store: now, storeChanged: false, pull: false };
    }
    return { action: 'subir', store: writtenBy(now, mine, Math.max(now.rev, rev) + 1, id), storeChanged: true, pull: false };
}

/**
 * Traer lo del almacén a los metadatos de un chat: cada clave de la partida queda como en el
 * almacén, y la que el almacén no tiene se quita. Con la versión del almacén.
 *
 * @param {Record<string, any>} meta Se cambia en el sitio: es el objeto del chat.
 * @param {GameState} store
 * @returns {string[]} Las claves que cambiaron.
 */
export function pullGameKeys(meta, store) {
    const changed = [];
    for (const key of gameScopeKeys()) {
        const before = meta[key];
        if (has(store.keys, key)) meta[key] = clone(store.keys[key]);
        else delete meta[key];
        if (!same(before, meta[key])) changed.push(key);
    }
    meta[HUB_STATE_REV_KEY] = store.rev;
    return changed;
}
