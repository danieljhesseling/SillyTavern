/**
 * Charlas de pareja sin modelo (J14.8 de wiki/ROADMAP_SIN_CONEXION.md): dos de tus compañeros
 * hablan entre ellos, y tú escuchas y, si quieres, dices algo.
 *
 * Antes se le pedían al narrador (`camp-talk.js`), y sin modelo no salía nada. Ahora se escriben
 * en `compendio/noches.json`, en las filas `kind: "pareja"`, de dos formas:
 *
 * - **Escritas para una pareja** (`pair`: sus dos nombres): Gerd y Nella discuten quién paga,
 *   Osric le cuenta a Gerd lo de la barca. Salen en orden (`order`) y no se repiten.
 * - **De plantilla** (`wants`: lo que busca cada uno, o `*`): para cualquier pareja que encaje,
 *   con sus nombres en los huecos `{a}` y `{b}`. Así dos compañeros de una campaña nueva
 *   también hablan. Cada plantilla sale una vez por pareja.
 *
 * Se juegan con la pantalla de la quedada (`ui/meetup-scene.js`), con los dos retratos. Lo que
 * contestas puede acercar a uno y alejar al otro (`cast-scenes.js`). Si esos dos chocaron hoy
 * (`approval.js`), hablan antes que nadie: es la charla en la que hacen las paces.
 *
 * Puro: elige quién habla y qué, y lo deja montado. Quien llama lo enseña y lo aplica.
 */

import { readCastBeats, bindCast } from './cast-scenes.js';
import { keyOf } from './social.js';
import { wantsFor } from './companion-cards.js';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * @typedef {Object} PairRow
 * @property {string} id
 * @property {string[]} pair Los dos nombres, si es de una pareja escrita.
 * @property {string[]} wants Lo que busca cada uno, si es de plantilla.
 * @property {number} order
 * @property {string} title
 * @property {string} where
 * @property {any} raw
 */

/**
 * Las charlas de pareja de `noches.json`. Las que no dicen de quién (ni una pareja ni lo que
 * busca cada uno) se quedan fuera.
 *
 * @param {any} raw
 * @returns {PairRow[]}
 */
export function readPairRows(raw) {
    const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.rows) ? raw.rows : [];
    return rows.flatMap((/** @type {any} */ row) => {
        if (text(row?.kind) !== 'pareja' || !text(row.id)) return [];
        const pair = (Array.isArray(row.pair) ? row.pair : []).map(text).filter(Boolean);
        const wants = (Array.isArray(row.wants) ? row.wants : []).map(text).filter(Boolean);
        if (pair.length !== 2 && wants.length !== 2) return [];
        if (readCastBeats(row.beats).length === 0) return [];
        return [{
            id: text(row.id),
            pair: pair.length === 2 ? pair : [],
            wants: pair.length === 2 ? [] : wants,
            order: Math.max(0, Math.floor(Number(row.order) || 0)),
            title: text(row.title),
            where: text(row.where),
            raw: row,
        }];
    });
}

/**
 * La clave de una pareja, la misma en los dos órdenes.
 *
 * @param {any} a
 * @param {any} b
 * @returns {string}
 */
export function pairKeyOf(a, b) {
    return [keyOf(a?.name ?? a), keyOf(b?.name ?? b)].sort().join('+');
}

/**
 * Las parejas que pueden hablar: dos compañeros vivos del grupo (el héroe no, ni quien se escolta).
 *
 * @param {any[]} party
 * @returns {Array<[any, any]>}
 */
export function pairsOf(party) {
    const living = (Array.isArray(party) ? party : []).slice(1)
        .filter(m => m && !m.dead && (Number(m.hp ?? 1) || 0) > 0 && m.guest?.kind !== 'ward');
    /** @type {Array<[any, any]>} */
    const out = [];
    for (let i = 0; i < living.length; i++) for (let j = i + 1; j < living.length; j++) out.push([living[i], living[j]]);
    return out;
}

/**
 * Las charlas que tiene una pareja, en el orden de sus huecos (`a` es el primero de la fila):
 * las escritas para ellos y las plantillas que les encajan. Lo ya oído, fuera.
 *
 * @param {Object} input
 * @param {PairRow[]} input.rows
 * @param {[any, any]} input.pair
 * @param {string[]} input.heard
 * @param {(member: any) => string} input.wantsOf
 * @returns {Array<{row: PairRow, slots: {a: any, b: any}, written: boolean}>}
 */
export function talksForPair({ rows, pair, heard, wantsOf }) {
    const [x, y] = pair;
    const key = pairKeyOf(x, y);
    const done = new Set(Array.isArray(heard) ? heard : []);
    /** @type {Array<{row: PairRow, slots: {a: any, b: any}, written: boolean}>} */
    const out = [];
    for (const row of Array.isArray(rows) ? rows : []) {
        if (row.pair.length === 2) {
            if (done.has(row.id)) continue;
            if (keyOf(row.pair[0]) === keyOf(x.name) && keyOf(row.pair[1]) === keyOf(y.name)) out.push({ row, slots: { a: x, b: y }, written: true });
            else if (keyOf(row.pair[0]) === keyOf(y.name) && keyOf(row.pair[1]) === keyOf(x.name)) out.push({ row, slots: { a: y, b: x }, written: true });
            continue;
        }
        if (done.has(`${row.id}@${key}`)) continue;
        const [wa, wb] = row.wants;
        const fit = (/** @type {string} */ want, /** @type {any} */ m) => want === '*' || want === text(wantsOf(m));
        if (fit(wa, x) && fit(wb, y)) out.push({ row, slots: { a: x, b: y }, written: false });
        else if (fit(wa, y) && fit(wb, x)) out.push({ row, slots: { a: y, b: x }, written: false });
    }
    // Las escritas primero y por su orden; las plantillas, las más concretas antes que las de `*`.
    const stars = (/** @type {PairRow} */ r) => r.wants.filter(w => w === '*').length;
    return out.sort((p, q) => Number(q.written) - Number(p.written) || p.row.order - q.row.order || stars(p.row) - stars(q.row));
}

/**
 * La charla de pareja que toca: de la pareja que chocó hoy si la hay; si no, de una al azar que
 * tenga algo que decirse. Una escrita antes que una de plantilla.
 *
 * @param {Object} input
 * @param {any[]} input.party El grupo, con el héroe primero.
 * @param {PairRow[]} input.rows
 * @param {string[]} [input.heard] Lo ya oído (`readNights(...).pairs`).
 * @param {() => number} input.random
 * @param {import('./companion-cards.js').CompanionCard[]} [input.cards]
 * @param {(member: any) => string} [input.wantsOf]
 * @param {Array<{a: string, b: string}>} [input.frictions] Los roces de hoy, por id de ficha.
 * @param {any} [input.hero]
 * @returns {{scene: import('./cast-scenes.js').CastScene, rowId: string, pairKey: string, written: boolean}|null}
 */
export function pairTalkFor({ party, rows, heard = [], random, cards = [], wantsOf = undefined, frictions = [], hero = null }) {
    const want = (/** @type {any} */ m) => (wantsOf ? text(wantsOf(m)) : '') || wantsFor(cards, m);
    const pairs = pairsOf(party);
    if (pairs.length === 0) return null;
    const clashed = (/** @type {[any, any]} */ [x, y]) => (Array.isArray(frictions) ? frictions : [])
        .some(f => new Set([String(f?.a), String(f?.b)]).has(String(x.id)) && new Set([String(f?.a), String(f?.b)]).has(String(y.id)));
    // Al azar, pero con la semilla: se barajan y se mira en ese orden.
    const shuffled = [...pairs];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1)) % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const ordered = [...shuffled.filter(clashed), ...shuffled.filter(p => !clashed(p))];
    const withTalk = ordered.map(pair => ({ pair, talks: talksForPair({ rows, pair, heard, wantsOf: want }) })).filter(p => p.talks.length > 0);
    if (withTalk.length === 0) return null;
    const written = withTalk.find(p => p.talks[0].written && clashed(p.pair)) ?? withTalk.find(p => clashed(p.pair)) ?? withTalk.find(p => p.talks[0].written) ?? withTalk[0];
    const chosen = written.talks[0];
    const scene = bindCast({ row: chosen.row.raw, kind: 'pareja', slots: chosen.slots, hero: hero ?? (Array.isArray(party) ? party[0] : null), party, cards });
    return { scene, rowId: chosen.row.id, pairKey: pairKeyOf(chosen.slots.a, chosen.slots.b), written: chosen.written };
}

/**
 * Cuántas charlas escritas tiene cada pareja: para las pruebas y el compendio.
 *
 * @param {PairRow[]} rows
 * @returns {Record<string, number>}
 */
export function pairCoverage(rows) {
    /** @type {Record<string, number>} */
    const out = {};
    for (const row of Array.isArray(rows) ? rows : []) {
        const key = row.pair.length === 2 ? pairKeyOf(row.pair[0], row.pair[1]) : `(${row.wants.join('+')})`;
        out[key] = (out[key] ?? 0) + 1;
    }
    return out;
}
