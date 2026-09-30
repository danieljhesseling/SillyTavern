/**
 * Lo que dicen tus compañeros fuera de combate (J13.5 de wiki/ROADMAP_SIN_CONEXION.md): por el
 * camino, al llegar a un sitio y ante lo que decidís.
 *
 * En combate ya hablaban (`combat/barks.js`), y al cruzarte con ellos se charla (`small-talk.js`,
 * con tus tres respuestas). Esto es lo de en medio: una línea suelta que se oye sin pararse,
 * como en *Baldur's Gate* cuando alguien del grupo comenta el paisaje o lo que acabas de hacer.
 * No gasta tiempo ni pide respuesta.
 *
 * Sale escrito de `compendio/charlas.json`, en las filas `kind: "frase"`:
 *
 *     { "id": "gerd-viaje-1", "kind": "frase", "name": "Gerd · de camino", "who": "Gerd el Mellado",
 *       "moment": "viaje", "lines": ["Si alguien ve una venta, que avise. Tengo un hambre que no veo."] }
 *     { "id": "oro-decision-pagar-mal", "kind": "frase", "name": "Oro · no le gusta pagar", "wants": "coin",
 *       "moment": "decision", "about": "pagar", "feel": -1, "lines": ["Eso salía de nuestro bolsillo."] }
 *
 * - **`moment`**: `viaje` (de camino), `llegada` (al llegar; puede llevar `{sitio}`) o
 *   `decision` (ante lo que decidís: `about` es lo que se hizo —una palabra de
 *   `companion-opinions.js` o una decisión de `approval.js`— y `feel`, si le gusta, 1, o no, -1).
 * - **Las suyas primero**; si no tiene, las de lo que busca (`wants`). Ante una decisión, sin
 *   frase para eso en concreto, una de «me gusta» o «no me gusta» de lo que busca (`about: "*"`).
 * - **Sin repetir hasta agotarlas**, como las charlas: lo oído se apunta en `social.heard`.
 * - El texto concuerda con tu héroe (`{cansado|cansada}`) y rellena `{heroe}` y `{sitio}`.
 *
 * Puro: elige quién habla y qué dice. Quien llama lo pinta y guarda `social`.
 */

import { resolveGender } from './grammar.js';
import { HEARD_MEMORY, keyOf, readSocial } from './social.js';
import { cardOf, shortOf, wantsFor } from './companion-cards.js';

/** Los momentos de una frase, y lo fácil que es que alguien diga algo. */
export const LINE_MOMENTS = {
    viaje: { label: 'De camino', chance: 0.5 },
    llegada: { label: 'Al llegar', chance: 0.5 },
    decision: { label: 'Ante lo que decidís', chance: 0.8 },
};

/** Cuántas frases como mucho por decisión: una, o dos si chocan (a uno le gusta y a otro no). */
export const MAX_REACTIONS = 2;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * @typedef {Object} LineRow
 * @property {string} id
 * @property {string} who
 * @property {string} whoKey
 * @property {string} wants
 * @property {string} moment
 * @property {string} about Lo que se decidió (`decision`), o `*` para cualquier cosa.
 * @property {0|1|-1} feel
 * @property {string} mood La cara de quien lo dice.
 * @property {string[]} lines
 */

/**
 * Las frases de `charlas.json` (el archivo, su `rows` o las filas del compendio). Solo las de
 * `kind: "frase"`; las charlas de siempre las lee `small-talk.js`.
 *
 * @param {any} raw
 * @returns {LineRow[]}
 */
export function readLineRows(raw) {
    const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.rows) ? raw.rows : [];
    return rows.flatMap((/** @type {any} */ row) => {
        if (text(row?.kind) !== 'frase') return [];
        const moment = text(row.moment);
        const lines = (Array.isArray(row.lines) ? row.lines : [row.lines]).map(text).filter(Boolean);
        if (!text(row.id) || !(moment in LINE_MOMENTS) || lines.length === 0) return [];
        if (!text(row.who) && !text(row.wants)) return [];
        const feel = Number(row.feel);
        return [{
            id: text(row.id),
            who: text(row.who),
            whoKey: keyOf(row.who),
            wants: text(row.wants),
            moment,
            about: text(row.about) || '*',
            feel: /** @type {0|1|-1} */ (feel > 0 ? 1 : feel < 0 ? -1 : 0),
            mood: text(row.mood),
            lines,
        }];
    });
}

/**
 * @param {LineRow} row
 * @param {{moment: string, about?: string, feel?: number, place?: string, heroName?: string}} want
 * @param {boolean} exact Si tiene que ser de eso en concreto (`about`) o vale lo de «cualquier cosa».
 * @returns {boolean}
 */
function fits(row, { moment, about = '', feel = 0, place = '', heroName = '' }, exact) {
    if (row.moment !== moment) return false;
    if (moment === 'decision') {
        if (row.feel !== 0 && row.feel !== Math.sign(Number(feel) || 0)) return false;
        if (exact ? row.about !== text(about) : row.about !== '*') return false;
    }
    const all = row.lines.join(' ');
    if (all.includes('{sitio}') && !text(place)) return false;
    if (all.includes('{heroe}') && !text(heroName)) return false;
    return true;
}

/**
 * Las frases que valen para alguien: las suyas de eso en concreto; si no, las suyas de
 * cualquier cosa; si no, las de lo que busca, en el mismo orden.
 *
 * @param {Object} input
 * @param {LineRow[]} input.rows
 * @param {{name: string, wants?: string}} input.person
 * @param {string} input.moment
 * @param {string} [input.about]
 * @param {number} [input.feel]
 * @param {string} [input.place]
 * @param {string} [input.heroName]
 * @returns {LineRow[]}
 */
export function lineRowsFor({ rows, person, moment, about = '', feel = 0, place = '', heroName = '' }) {
    const list = Array.isArray(rows) ? rows : [];
    const key = keyOf(person?.name);
    const want = { moment, about, feel, place, heroName };
    const own = list.filter(r => r.whoKey && r.whoKey === key);
    const theirs = text(person?.wants) ? list.filter(r => !r.whoKey && r.wants === text(person?.wants)) : [];
    for (const pool of [own, theirs]) {
        const exact = moment === 'decision' ? pool.filter(r => fits(r, want, true)) : [];
        if (exact.length > 0) return exact;
        const loose = pool.filter(r => fits(r, want, false));
        if (loose.length > 0) return loose;
    }
    return [];
}

/**
 * @param {string} said
 * @param {{hero?: any, party?: any[], place?: string}} who
 * @returns {string}
 */
function render(said, { hero = null, party = [], place = '' }) {
    const filled = said.replaceAll('{heroe}', text(hero?.name)).replaceAll('{sitio}', text(place));
    return resolveGender(filled, { heroe: hero, grupo: Array.isArray(party) && party.length > 0 ? party : [hero] });
}

/**
 * @typedef {Object} SpokenLine
 * @property {string} id  La frase (`fila:n`), para no repetirla.
 * @property {string} who Quien la dice.
 * @property {string} short
 * @property {string} line
 * @property {string} mood
 * @property {0|1|-1} feel
 */

/**
 * Una frase de alguien, sin repetir hasta agotar las suyas de ese momento.
 *
 * @param {Object} input
 * @param {LineRow[]} input.rows
 * @param {any} input.member Su ficha del grupo (o `{name, wants}`).
 * @param {string} input.moment
 * @param {any} input.social
 * @param {() => number} input.random
 * @param {string} [input.about]
 * @param {number} [input.feel]
 * @param {import('./companion-cards.js').CompanionCard[]} [input.cards]
 * @param {any} [input.hero]
 * @param {any[]} [input.party]
 * @param {string} [input.place]
 * @returns {{line: SpokenLine|null, social: import('./social.js').SocialState}}
 */
export function pickLine({ rows, member, moment, social, random, about = '', feel = 0, cards = [], hero = null, party = [], place = '' }) {
    const state = readSocial(social);
    const person = { name: text(member?.name), wants: text(member?.wants) || wantsFor(cards, member) };
    const pool = lineRowsFor({ rows, person, moment, about, feel, place, heroName: text(hero?.name) });
    const candidates = pool.flatMap(row => row.lines.map((said, i) => ({ id: `${row.id}:${i + 1}`, row, said })));
    if (candidates.length === 0) return { line: null, social: state };
    const ids = new Set(candidates.map(c => c.id));
    let heard = state.heard;
    let fresh = candidates.filter(c => !heard.includes(c.id));
    if (fresh.length === 0) {
        // Agotadas: vuelven todas, menos la última que se oyó.
        const last = [...heard].reverse().find(id => ids.has(id));
        heard = heard.filter(id => !ids.has(id));
        fresh = candidates.length > 1 ? candidates.filter(c => c.id !== last) : candidates;
    }
    const chosen = fresh[Math.floor(random() * fresh.length) % fresh.length];
    return {
        line: {
            id: chosen.id,
            who: person.name,
            short: shortOf(cards, member),
            line: render(chosen.said, { hero, party, place }),
            mood: chosen.row.mood,
            feel: chosen.row.feel,
        },
        social: { ...state, heard: [...heard, chosen.id].slice(-HEARD_MEMORY) },
    };
}

/**
 * Quién puede decir algo ahora: del grupo, vivo, que no sea tu héroe ni alguien escoltado.
 *
 * @param {any[]} party
 * @returns {any[]}
 */
function speakers(party) {
    return (Array.isArray(party) ? party : []).slice(1)
        .filter(m => m && !m.dead && (Number(m.hp ?? 1) || 0) > 0 && m.guest?.kind !== 'ward');
}

/**
 * Por el camino o al llegar: a veces alguien dice algo. Mejor quien no habló la última vez, y
 * mejor quien tiene frases propias sin oír.
 *
 * @param {Object} input
 * @param {'viaje'|'llegada'} input.moment
 * @param {LineRow[]} input.rows
 * @param {any[]} input.party El grupo, con el héroe primero.
 * @param {any} input.social
 * @param {() => number} input.random
 * @param {import('./companion-cards.js').CompanionCard[]} [input.cards]
 * @param {string} [input.place] Para `{sitio}`.
 * @param {boolean} [input.always] Sin tirar: sale seguro (para probar, o cuando ya se sabe que toca).
 * @returns {{line: SpokenLine|null, social: import('./social.js').SocialState}}
 */
export function roadLine({ moment, rows, party, social, random, cards = [], place = '', always = false }) {
    const state = readSocial(social);
    const spec = /** @type {Record<string, {chance: number}>} */ (LINE_MOMENTS)[moment];
    if (!spec || moment === 'decision') return { line: null, social: state };
    if (!always && random() >= spec.chance) return { line: null, social: state };
    const hero = Array.isArray(party) ? party[0] : null;
    const heroName = text(hero?.name);
    const able = speakers(party).filter(m => lineRowsFor({ rows, person: { name: m.name, wants: wantsFor(cards, m) }, moment, place, heroName }).length > 0);
    if (able.length === 0) return { line: null, social: state };
    const notLast = able.filter(m => keyOf(m.name) !== state.lastSpeaker);
    const pool = notLast.length > 0 ? notLast : able;
    const heard = new Set(state.heard);
    const fresh = pool.filter(m => lineRowsFor({ rows, person: { name: m.name }, moment, place, heroName })
        .some(row => row.lines.some((_, i) => !heard.has(`${row.id}:${i + 1}`))));
    const from = fresh.length > 0 ? fresh : pool;
    const member = from[Math.floor(random() * from.length) % from.length];
    const picked = pickLine({ rows, member, moment, social: state, random, cards, hero, party, place });
    return picked.line ? { line: picked.line, social: { ...picked.social, lastSpeaker: keyOf(member.name) } } : picked;
}

/**
 * Ante una decisión: lo que dicen los que opinan (las opiniones de `companion-opinions.js`, o
 * la aprobación de `approval.js`). Una frase; dos si a uno le gusta y a otro no.
 *
 * @param {Object} input
 * @param {Array<{id?: string, name: string, mood: 1|-1, trait?: string}>} input.opinions
 * @param {string} [input.about] Lo que se decidió, si todos opinan de lo mismo.
 * @param {LineRow[]} input.rows
 * @param {any[]} input.party
 * @param {any} input.social
 * @param {() => number} input.random
 * @param {import('./companion-cards.js').CompanionCard[]} [input.cards]
 * @param {boolean} [input.always]
 * @returns {{lines: SpokenLine[], social: import('./social.js').SocialState}}
 */
export function reactionLines({ opinions, about = '', rows, party, social, random, cards = [], always = false }) {
    let state = readSocial(social);
    const list = Array.isArray(opinions) ? opinions : [];
    if (list.length === 0 || (!always && random() >= LINE_MOMENTS.decision.chance)) return { lines: [], social: state };
    const members = speakers(party);
    const hero = Array.isArray(party) ? party[0] : null;
    const like = list.find(o => o.mood > 0);
    const dislike = list.find(o => o.mood < 0);
    const order = like && dislike ? [like, dislike] : [list[Math.floor(random() * list.length) % list.length]];
    /** @type {SpokenLine[]} */
    const lines = [];
    for (const opinion of order.slice(0, MAX_REACTIONS)) {
        const member = members.find(m => (opinion.id && String(m.id) === String(opinion.id)) || keyOf(m.name) === keyOf(opinion.name));
        if (!member) continue;
        const picked = pickLine({
            rows, member, moment: 'decision', social: state, random, about: text(opinion.trait) || text(about), feel: opinion.mood, cards, hero, party,
        });
        state = picked.social;
        if (picked.line) lines.push(picked.line);
    }
    return { lines, social: state };
}

/**
 * Cuántas frases tiene cada uno por momento: para las pruebas y el compendio.
 *
 * @param {LineRow[]} rows
 * @returns {Record<string, Record<string, number>>}
 */
export function lineCoverage(rows) {
    /** @type {Record<string, Record<string, number>>} */
    const out = {};
    for (const row of Array.isArray(rows) ? rows : []) {
        const who = row.who || `(${row.wants})`;
        out[who] = out[who] ?? {};
        out[who][row.moment] = (out[who][row.moment] ?? 0) + row.lines.length;
    }
    return out;
}

/**
 * La frase como se lee en el registro: «Gerd: «…»».
 *
 * @param {SpokenLine} spoken
 * @returns {string}
 */
export function describeLine(spoken) {
    return spoken ? `${spoken.short || spoken.who}: «${spoken.line}»` : '';
}

/**
 * Si alguien tiene frases escritas para algo: para el compendio y las pruebas.
 *
 * @param {LineRow[]} rows
 * @param {import('./companion-cards.js').CompanionCard[]} cards
 * @param {string} name
 * @param {string} moment
 * @returns {boolean}
 */
export function hasLines(rows, cards, name, moment) {
    const card = cardOf(cards, name);
    return lineRowsFor({ rows, person: { name, wants: card?.wants ?? '' }, moment, place: '-', heroName: '-', about: '*', feel: 1 }).length > 0;
}
