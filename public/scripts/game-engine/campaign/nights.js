/**
 * La noche (J14.7 de wiki/ROADMAP_SIN_CONEXION.md): una escena por noche, si toca. Alguien que
 * llega a la posada, una ronda, o una charla entre dos de tus compañeros.
 *
 * El día ya tiene partes (`day-parts.js`) y la noche se podía gastar quedando con alguien o
 * durmiendo. Faltaba lo que pasa sin que lo busques, como en un pueblo de verdad: un buhonero
 * empapado que pide sitio junto al fuego, Tomás que saca la baraja, Gerd y Nella discutiendo
 * quién paga. Sale escrito de `compendio/noches.json`:
 *
 * - **`kind: "noche"`**, con `type` `llegada` (alguien llega) o `ronda` (una ronda, un juego,
 *   una canción). `campaign` la deja para un sitio (`gremio`, `strahd`, `1387`); sin él, vale en
 *   cualquier posada. `needs` pide gente: `with` (esos, en el grupo) o `companions` (cuántos
 *   compañeros, que salen como `a` y `b`).
 * - **`kind: "pareja"`**: las charlas de pareja (`pair-talks.js`). De noche, una más de las tres
 *   cosas que pueden pasar.
 *
 * Reglas:
 *
 * - **Una por noche como mucho**, y no siempre (`NIGHT_CHANCE`): la noche también puede ser
 *   tranquila.
 * - **No se repite lo de anoche**: si ayer llegó alguien, hoy toca otra cosa, si la hay. Una
 *   escena ya vista no vuelve hasta que se ven todas las de su clase.
 * - **Solo donde hay posada** (o en el gremio, que es una): en mitad del camino, la noche es
 *   del fuego del campamento, y ahí solo salen las charlas de pareja.
 *
 * Puro: dice qué pasa esta noche y lo deja montado. Quien llama la enseña (`meetup-scene.js`),
 * aplica lo que cambia (`castOutcome`) y guarda lo visto (`recordNight`).
 */

import { readCastBeats, bindCast, slotsUsed } from './cast-scenes.js';
import { keyOf } from './social.js';
import { pairTalkFor, readPairRows } from './pair-talks.js';

/** En la metadata del chat: lo visto de las noches y de las charlas de pareja. */
export const NIGHTS_KEY = 'noches';

/** Lo que es cada noche. */
export const NIGHT_TYPES = {
    llegada: { label: 'Alguien llega' },
    ronda: { label: 'Una ronda' },
    pareja: { label: 'Una charla entre dos' },
};

/** La probabilidad de que pase algo una noche. */
export const NIGHT_CHANCE = 0.7;

/** Cuántas escenas vistas se recuerdan. */
const SEEN_MEMORY = 200;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string[]} */
const listOf = (value) => (Array.isArray(value) ? value : value == null ? [] : [value]).map(text).filter(Boolean);

/**
 * @typedef {Object} NightRow
 * @property {string} id
 * @property {string} type `llegada` o `ronda`.
 * @property {string} campaign
 * @property {string} where
 * @property {string} title
 * @property {string[]} with Quién tiene que ir en el grupo.
 * @property {number} companions Cuántos compañeros salen (`a`, `b`).
 * @property {Array<{name: string, className?: string, gender?: string}>} extras Gente del sitio que sale.
 * @property {any} raw La fila, para montarla.
 */

/**
 * Las noches de `noches.json` (el archivo, su `rows` o las filas del compendio). Solo las de
 * `kind: "noche"` con algo que leer.
 *
 * @param {any} raw
 * @returns {NightRow[]}
 */
export function readNightRows(raw) {
    const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.rows) ? raw.rows : [];
    return rows.flatMap((/** @type {any} */ row) => {
        if (text(row?.kind) !== 'noche' || !text(row.id)) return [];
        const type = text(row.type);
        if (!(type in NIGHT_TYPES) || type === 'pareja') return [];
        if (readCastBeats(row.beats).length === 0) return [];
        const needs = row.needs && typeof row.needs === 'object' ? row.needs : {};
        const used = slotsUsed(row).length;
        return [{
            id: text(row.id),
            type,
            campaign: text(row.campaign),
            where: text(row.where) || 'posada',
            title: text(row.title),
            with: listOf(needs.with),
            companions: Math.max(used, Math.min(2, Math.floor(Number(needs.companions) || 0))),
            extras: (Array.isArray(row.extras) ? row.extras : [])
                .map((/** @type {any} */ e) => (typeof e === 'string' ? { name: text(e) } : { name: text(e?.name), className: text(e?.className), gender: text(e?.gender) }))
                .filter((/** @type {any} */ e) => e.name),
            raw: row,
        }];
    });
}

/**
 * @typedef {Object} NightState
 * @property {number} last El último día con escena de noche (o con la noche ya mirada).
 * @property {string} lastType Lo que pasó esa noche.
 * @property {string[]} seen Las escenas de noche ya vistas.
 * @property {string[]} pairs Las charlas de pareja ya oídas (`id` o `id@pareja` las de plantilla).
 */

/**
 * @param {any} raw
 * @returns {NightState}
 */
export function readNights(raw) {
    return {
        last: Math.max(0, Math.floor(Number(raw?.last) || 0)),
        lastType: text(raw?.lastType),
        seen: listOf(raw?.seen).slice(-SEEN_MEMORY),
        pairs: listOf(raw?.pairs).slice(-SEEN_MEMORY),
    };
}

/**
 * Los compañeros que pueden salir en una escena: del grupo, vivos, sin contar a quien se escolta.
 *
 * @param {any[]} party
 * @returns {any[]}
 */
function companionsOf(party) {
    return (Array.isArray(party) ? party : []).slice(1)
        .filter(m => m && !m.dead && (Number(m.hp ?? 1) || 0) > 0 && m.guest?.kind !== 'ward');
}

/**
 * Si una noche escrita vale aquí y con este grupo.
 *
 * @param {NightRow} row
 * @param {{campaign: string, places: string[], companions: any[]}} here
 * @returns {boolean}
 */
function nightFits(row, { campaign, places, companions }) {
    if (row.campaign && row.campaign !== text(campaign)) return false;
    if (places.length > 0 && !places.includes(row.where)) return false;
    const names = new Set(companions.map(m => keyOf(m.name)));
    if (row.with.some(name => !names.has(keyOf(name)))) return false;
    return companions.filter(m => !row.with.some(name => keyOf(name) === keyOf(m.name))).length + row.with.length >= row.companions;
}

/**
 * Quién sale en los huecos: primero los que pide la escena, luego al azar.
 *
 * @param {NightRow} row
 * @param {any[]} companions
 * @param {() => number} random
 * @returns {Record<string, any>}
 */
function castFor(row, companions, random) {
    const wanted = row.with.map(name => companions.find(m => keyOf(m.name) === keyOf(name))).filter(Boolean);
    const rest = companions.filter(m => !wanted.includes(m));
    const bag = [...rest];
    const drawn = [];
    while (bag.length > 0 && wanted.length + drawn.length < row.companions) {
        drawn.push(bag.splice(Math.floor(random() * bag.length) % bag.length, 1)[0]);
    }
    const order = [...wanted, ...drawn];
    return Object.fromEntries(['a', 'b'].slice(0, Math.max(row.companions, order.length)).map((slot, i) => [slot, order[i]]).filter(([, m]) => m));
}

/**
 * @typedef {Object} NightPick
 * @property {'llegada'|'ronda'|'pareja'} type
 * @property {import('./cast-scenes.js').CastScene} scene Lista para enseñar.
 * @property {string} rowId
 * @property {string} [pairKey] En una de pareja, quiénes (`gerd-el-mellado+nella-tresflechas`).
 */

/**
 * Lo que pasa esta noche, si pasa algo.
 *
 * @param {Object} input
 * @param {number} input.day El día de la campaña.
 * @param {string} input.slot La parte del día: solo de noche.
 * @param {any} input.state Lo visto (`readNights`).
 * @param {any[]} input.party El grupo, con el héroe primero.
 * @param {() => number} input.random
 * @param {any} [input.nightRows] `noches.json` (o sus filas): noches y parejas.
 * @param {string} [input.campaign] `gremio`, `strahd`, `1387`…
 * @param {string[]} [input.places] Los sitios del pueblo de aquí (`posada`…). Vacío: en el camino.
 * @param {import('./companion-cards.js').CompanionCard[]} [input.cards]
 * @param {(member: any) => string} [input.wantsOf]
 * @param {Array<{a: string, b: string}>} [input.frictions] Los roces de hoy (ids): esa pareja habla antes.
 * @param {boolean} [input.always] Sin tirar: pasa algo seguro.
 * @returns {NightPick|null}
 */
export function nightFor({
    day, slot, state, party, random, nightRows = [], campaign = '', places = [], cards = [], wantsOf = undefined, frictions = [], always = false,
}) {
    if (text(slot) !== 'night') return null;
    const seen = readNights(state);
    const today = Math.max(0, Math.floor(Number(day) || 0));
    if (seen.last === today && today > 0) return null;
    if (!always && random() >= NIGHT_CHANCE) return null;

    const companions = companionsOf(party);
    const hero = Array.isArray(party) ? party[0] : null;
    const inn = listOf(places).includes('posada') || listOf(places).includes('gremio');
    const here = { campaign, places: inn ? listOf(places) : [], companions };
    const rows = inn ? readNightRows(nightRows).filter(row => nightFits(row, here)) : [];
    const pair = pairTalkFor({ party, rows: readPairRows(nightRows), heard: seen.pairs, random, cards, wantsOf, frictions, hero });

    /** @type {Array<'llegada'|'ronda'|'pareja'>} */
    const types = [];
    if (rows.some(r => r.type === 'llegada')) types.push('llegada');
    if (rows.some(r => r.type === 'ronda')) types.push('ronda');
    if (pair) types.push('pareja');
    if (types.length === 0) return null;
    const fresh = types.filter(t => t !== seen.lastType);
    const pool = fresh.length > 0 ? fresh : types;
    const type = pool[Math.floor(random() * pool.length) % pool.length];

    if (type === 'pareja' && pair) return { type, scene: pair.scene, rowId: pair.rowId, pairKey: pair.pairKey };
    const ofType = rows.filter(r => r.type === type);
    const unseen = ofType.filter(r => !seen.seen.includes(r.id));
    // Vistas todas: vuelven, menos las tres últimas.
    const recent = seen.seen.slice(-3);
    const from = unseen.length > 0 ? unseen : (ofType.filter(r => !recent.includes(r.id)).length > 0 ? ofType.filter(r => !recent.includes(r.id)) : ofType);
    const row = from[Math.floor(random() * from.length) % from.length];
    const slots = castFor(row, companions, random);
    return {
        type,
        rowId: row.id,
        scene: bindCast({ row: row.raw, kind: 'noche', slots, hero, party, cards, extras: row.extras }),
    };
}

/**
 * Apuntar que esta noche ya pasó algo (o que se miró y no pasó nada: `pick` nulo), para que no
 * salga otra hasta mañana.
 *
 * @param {any} state
 * @param {{day: number, pick?: NightPick|null}} input
 * @returns {NightState}
 */
export function recordNight(state, { day, pick = null }) {
    const seen = readNights(state);
    const today = Math.max(0, Math.floor(Number(day) || 0));
    if (!pick) return { ...seen, last: today, lastType: '' };
    if (pick.type === 'pareja') {
        const id = pick.pairKey && pick.rowId.startsWith('plantilla') ? `${pick.rowId}@${pick.pairKey}` : pick.rowId;
        return { ...seen, last: today, lastType: 'pareja', pairs: [...seen.pairs.filter(p => p !== id), id].slice(-SEEN_MEMORY) };
    }
    return { ...seen, last: today, lastType: pick.type, seen: [...seen.seen.filter(s => s !== pick.rowId), pick.rowId].slice(-SEEN_MEMORY) };
}

/**
 * Cómo se avisa de que esta noche pasa algo, antes de verlo: sin destripar qué.
 *
 * @param {NightPick} pick
 * @returns {string}
 */
export function nightTeaser(pick) {
    if (!pick) return '';
    if (pick.type === 'pareja') {
        const names = pick.scene.cast.slice(0, 2).map(c => c.short || c.name);
        return names.length === 2 ? `${names[0]} y ${names[1]} están hablando junto al fuego.` : 'Dos de los tuyos están hablando junto al fuego.';
    }
    return pick.type === 'llegada' ? 'Esta noche llega alguien a la posada.' : 'Esta noche hay ronda en la posada.';
}
