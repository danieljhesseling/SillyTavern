/**
 * Escenas con varios (J14.7 y J14.8 de wiki/ROADMAP_SIN_CONEXION.md): las de la noche y las
 * charlas de pareja. Son como una quedada (`meetups.js`: pasos con lo que pasa, lo que se dice y
 * tus respuestas), pero hablan varios: cada paso dice quién habla (`who`), y lo que contestas
 * puede acercar a uno y alejar a otro.
 *
 * Cómo se escribe un paso:
 *
 *     { "who": "a", "mood": "alegre", "say": "¿Otra ronda, {b}?" }
 *     { "note": "Nella deja la jarra en la mesa y os mira a los dos.",
 *       "replies": [
 *         { "text": "Tiene razón {a}.", "bonds": { "a": 1, "b": -1 }, "who": "b", "then": "Claro. Como siempre." },
 *         { "text": "Pago yo esta.", "gold": -2, "bonds": { "todos": 1 } } ] }
 *
 * - **Quién**: `a` y `b` son los compañeros que salen (se eligen al montar la escena); también
 *   vale un nombre («Tomás»). Sin `who`, lo dice quien sale primero.
 * - **Huecos**: `{a}` y `{b}` son sus nombres cortos; `{a:callado|callada}` concuerda con `a`.
 *   Lo que concuerda con tu héroe va como siempre: `{cansado|cansada}`.
 * - **Lo que cambia** cada respuesta: `bonds` (por hueco, por nombre o `todos`: los del grupo),
 *   o `bond` (con quien habla en ese paso); `gold` (lo que cuesta, en negativo, o lo que se gana);
 *   `attitude` (cómo os mira alguien del pueblo: `{"Tomás": 1}`).
 *
 * Puro: monta la escena con quien toca, la deja lista para `ui/meetup-scene.js` y dice qué
 * cambia. Quien llama la enseña y lo aplica.
 */

import { resolveGenderDeep } from './grammar.js';
import { keyOf } from './social.js';
import { FACES } from './meetups.js';
import { shortOf } from './companion-cards.js';

/** Los huecos de las personas de una escena. */
export const SLOTS = ['a', 'b'];

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string} */
const faceOf = (value) => (FACES.includes(text(value)) ? text(value) : '');

/**
 * @typedef {Object} CastReply
 * @property {string} text
 * @property {string} then
 * @property {string} who  Quien contesta (un hueco o un nombre); vacío, quien habla en el paso.
 * @property {string} mood
 * @property {number} gold
 * @property {number} bond Con quien habla en el paso.
 * @property {Record<string, number>} bonds Por hueco, nombre o `todos`.
 * @property {Record<string, number>} attitude Por nombre.
 */

/**
 * @typedef {Object} CastBeat
 * @property {string} who
 * @property {string} note
 * @property {string} say
 * @property {string} mood
 * @property {CastReply[]} replies
 */

/**
 * @param {any} raw
 * @returns {Record<string, number>}
 */
function numbersOf(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    return Object.fromEntries(Object.entries(raw)
        .map(([key, value]) => [text(key), Math.max(-3, Math.min(3, Math.round(Number(value) || 0)))])
        .filter(([key, value]) => key && value));
}

/**
 * Los pasos de una escena con varios, con forma. Un paso sin nada que leer se cae.
 *
 * @param {any} raw
 * @returns {CastBeat[]}
 */
export function readCastBeats(raw) {
    return (Array.isArray(raw) ? raw : []).flatMap((/** @type {any} */ beat) => {
        const note = text(beat?.note);
        const say = text(beat?.say);
        if (!note && !say) return [];
        const replies = (Array.isArray(beat?.replies) ? beat.replies : [])
            .filter((/** @type {any} */ r) => text(r?.text))
            .slice(0, 3)
            .map((/** @type {any} */ r) => ({
                text: text(r.text),
                then: text(r.then),
                who: text(r.who),
                mood: faceOf(r.mood),
                gold: Math.max(-500, Math.min(500, Math.round(Number(r.gold) || 0))),
                bond: Math.sign(Math.round(Number(r.bond) || 0)),
                bonds: numbersOf(r.bonds),
                attitude: numbersOf(r.attitude),
            }));
        return [{ who: text(beat?.who), note, say, mood: faceOf(beat?.mood), replies }];
    });
}

/**
 * Los huecos que usa una escena: los que dicen sus pasos (`who`), sus respuestas y su texto.
 *
 * @param {any} row
 * @returns {string[]}
 */
export function slotsUsed(row) {
    const said = JSON.stringify(row ?? {});
    return SLOTS.filter(slot => said.includes(`"who":"${slot}"`) || said.includes(`{${slot}}`) || said.includes(`{${slot}:`)
        || said.includes(`"${slot}":`));
}

/**
 * @typedef {Object} Cast Quién sale en una escena.
 * @property {Record<string, any>} slots Por hueco (`a`, `b`), su ficha del grupo.
 * @property {any[]} party El grupo, con el héroe primero.
 * @property {any} hero
 */

/**
 * El nombre de quien dice o recibe algo: un hueco es su compañero; lo demás, tal cual.
 *
 * @param {string} who
 * @param {Record<string, any>} slots
 * @returns {string}
 */
export function nameOf(who, slots) {
    const said = text(who);
    return SLOTS.includes(said) ? text(slots?.[said]?.name) : said;
}

/**
 * @typedef {Object} CastScene Lista para `openMeetupScene`, con quién sale.
 * @property {string} id
 * @property {string} kind `noche` o `pareja`.
 * @property {string} who Quien sale primero (la placa si un paso no dice quién).
 * @property {string} title
 * @property {string} where
 * @property {Array<{name: string, short: string, className: string, gender: string}>} cast
 * @property {CastBeat[]} beats Con los nombres puestos y el texto de tu héroe.
 * @property {Record<string, string>} bound Por hueco, el nombre de quien sale.
 */

/**
 * Montar la escena con quien sale: los huecos se cambian por sus nombres, cada paso dice su
 * nombre de verdad, y el texto concuerda con tu héroe, tu grupo y cada uno de los que salen.
 *
 * @param {Object} input
 * @param {any} input.row La fila, tal cual.
 * @param {string} input.kind
 * @param {Record<string, any>} input.slots Por hueco, su ficha del grupo.
 * @param {any} [input.hero]
 * @param {any[]} [input.party]
 * @param {import('./companion-cards.js').CompanionCard[]} [input.cards]
 * @param {Array<{name: string, className?: string, gender?: string}>} [input.extras] Gente que no es
 *   del grupo y sale (Tomás), para su retrato.
 * @returns {CastScene}
 */
export function bindCast({ row, kind, slots, hero = null, party = [], cards = [], extras = [] }) {
    const shorts = Object.fromEntries(SLOTS.map(slot => [slot, slots?.[slot] ? shortOf(cards, slots[slot]) : '']));
    const fill = (/** @type {string} */ said) => SLOTS.reduce((out, slot) => out.replaceAll(`{${slot}}`, shorts[slot] || ''), said)
        .replaceAll('{heroe}', text(hero?.name));
    const beats = readCastBeats(row?.beats).map(beat => ({
        ...beat,
        who: nameOf(beat.who, slots),
        note: fill(beat.note),
        say: fill(beat.say),
        replies: beat.replies.map(reply => ({
            ...reply,
            text: fill(reply.text),
            then: fill(reply.then),
            who: nameOf(reply.who, slots),
            bonds: Object.fromEntries(Object.entries(reply.bonds).map(([key, value]) => [key === 'todos' ? 'todos' : nameOf(key, slots), value])),
        })),
    }));
    const grupo = Array.isArray(party) && party.length > 0 ? party : [hero];
    const who = { heroe: hero, grupo, ...Object.fromEntries(SLOTS.map(slot => [slot, slots?.[slot] ?? null])) };
    const people = [
        ...SLOTS.map(slot => slots?.[slot]).filter(Boolean),
        ...(Array.isArray(extras) ? extras : []),
    ];
    const named = [...new Set(beats.flatMap(b => [b.who, ...b.replies.map(r => r.who)]).filter(Boolean))];
    // El primero que sale manda: la ficha del hueco (con su clase, para el retrato de relleno)
    // antes que el mismo nombre suelto de quien habla, que no trae nada más.
    /** @type {Map<string, {name: string, short: string, className: string, gender: string}>} */
    const byKey = new Map();
    for (const p of [...people, ...named.map(name => ({ name }))]) {
        if (!text(p?.name) || byKey.has(keyOf(p.name))) continue;
        byKey.set(keyOf(p.name), {
            name: text(p.name),
            short: shortOf(cards, p),
            className: text(p.className || p.class || p.charClass),
            gender: text(p.gender),
        });
    }
    const cast = [...byKey.values()];
    const first = beats.find(b => b.who)?.who || cast[0]?.name || '';
    return {
        id: text(row?.id),
        kind,
        who: first,
        title: fill(text(row?.title)),
        where: text(row?.where),
        cast,
        beats: resolveGenderDeep(beats, who),
        bound: Object.fromEntries(SLOTS.filter(slot => slots?.[slot]).map(slot => [slot, text(slots[slot].name)])),
    };
}

/**
 * @typedef {Object} CastOutcome
 * @property {Array<{id: string, name: string, points: number, events: string[]}>} bonds Por compañero del
 *   grupo, los eventos de vínculo en orden (`approved`, `disapproved`) y lo que suman.
 * @property {Array<{who: string, amount: number}>} attitudes
 * @property {number} gold Lo que cuesta (negativo) o se gana.
 * @property {string[]} lines Cómo contarlo al acabar.
 */

/**
 * Lo que deja una escena con varios: por cada respuesta elegida, a quién acerca o aleja, el oro
 * y cómo os mira la gente del pueblo. Lo de «todos» es de los del grupo que salen o que están.
 *
 * @param {Object} input
 * @param {CastScene} input.scene
 * @param {Array<{beat: number, reply: number}>} input.choices
 * @param {any[]} input.party
 * @param {import('./companion-cards.js').CompanionCard[]} [input.cards]
 * @returns {CastOutcome}
 */
export function castOutcome({ scene, choices, party, cards = [] }) {
    const members = (Array.isArray(party) ? party : []).slice(1).filter(m => m && !m.dead);
    /** @type {Map<string, {id: string, name: string, points: number, events: string[]}>} */
    const bonds = new Map();
    /** @type {Map<string, number>} */
    const attitudes = new Map();
    let gold = 0;
    const touch = (/** @type {string} */ name, /** @type {number} */ amount) => {
        const member = members.find(m => keyOf(m.name) === keyOf(name) || keyOf(shortOf(cards, m)) === keyOf(name));
        if (!member || !amount) return;
        const key = String(member.id ?? keyOf(member.name));
        const entry = bonds.get(key) ?? { id: String(member.id ?? ''), name: text(member.name), points: 0, events: [] };
        for (let i = 0; i < Math.abs(amount); i++) entry.events.push(amount > 0 ? 'approved' : 'disapproved');
        entry.points += amount;
        bonds.set(key, entry);
    };
    for (const choice of Array.isArray(choices) ? choices : []) {
        const beat = scene?.beats?.[choice.beat];
        const reply = beat?.replies?.[choice.reply];
        if (!reply) continue;
        gold += reply.gold;
        if (reply.bond && beat.who) touch(beat.who, reply.bond);
        for (const [who, amount] of Object.entries(reply.bonds)) {
            if (who === 'todos') for (const m of members) touch(m.name, amount);
            else touch(who, amount);
        }
        for (const [who, amount] of Object.entries(reply.attitude)) {
            if (members.some(m => keyOf(m.name) === keyOf(who))) touch(who, amount);
            else attitudes.set(who, (attitudes.get(who) ?? 0) + amount);
        }
    }
    const list = [...bonds.values()];
    /** @type {string[]} */
    const lines = [];
    const closer = list.filter(b => b.points > 0).map(b => shortOf(cards, b.name));
    const farther = list.filter(b => b.points < 0).map(b => shortOf(cards, b.name));
    const join = (/** @type {string[]} */ names) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : names[0]);
    if (closer.length > 0) lines.push(`Te acercas a ${join(closer)}.`);
    if (farther.length > 0) lines.push(`${join(farther)} se ${farther.length > 1 ? 'quedan' : 'queda'} más lejos.`);
    for (const [who, amount] of attitudes) if (amount) lines.push(`${who} os mira ${amount > 0 ? 'mejor' : 'peor'}.`);
    if (gold < 0) lines.push(`Te cuesta ${-gold} de oro.`);
    else if (gold > 0) lines.push(`Ganas ${gold} de oro.`);
    if (lines.length === 0) lines.push('La noche sigue, sin más.');
    return { bonds: list, attitudes: [...attitudes].map(([who, amount]) => ({ who, amount: Math.sign(amount) })).filter(a => a.amount), gold, lines };
}
