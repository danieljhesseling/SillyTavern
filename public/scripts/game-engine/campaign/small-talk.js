/**
 * La charla corta con tu gente (J14.1 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * Al cruzarte con un compañero —tras una pelea, al llegar a un sitio, de camino, en el pueblo
 * o cuando vas mal de vida— dice una o dos cosas y tú contestas con una de tres. No gasta
 * tiempo y mueve un poco la aprobación: lo que le gusta sube un punto de vínculo, lo que no,
 * lo baja. Con la gente del pueblo (Tomás, Ramiro…) lo que se suma es su trato: tres charlas
 * buenas y os mira mejor (`attitudes`), que es lo que abre sus favores.
 *
 * Todo sale escrito de `compendio/charlas.json`, sin modelo:
 *
 * - **Por persona y momento** (`who` + `moment`), y si alguien no tiene frases propias para
 *   ese momento, las de **lo que busca** (`wants`: oro, gloria, sangre, tranquilidad o saber).
 * - **Sin repetir hasta agotarlas**: una frase oída no vuelve mientras queden otras de esa
 *   persona y ese momento; agotadas, vuelven todas menos la última.
 * - **Una charla que sale sola por franja** como mucho; la del pueblo se pide y sale siempre.
 * - **La aprobación se mueve una vez al día por persona**: se puede charlar más, pero no
 *   ordeñar el vínculo a base de charlas.
 * - El texto concuerda con tu héroe (`{cansado|cansada}`, `grammar.js`) y rellena `{heroe}`
 *   y `{sitio}`; una frase con un hueco que no se puede rellenar no sale.
 *
 * Puro: elige y dice qué cambia. Quien llama lo enseña, suma el vínculo y guarda `social`.
 */

import { resolveGender } from './grammar.js';
import { HEARD_MEMORY, keyOf, readSocial } from './social.js';

/** Los momentos de una charla, con cómo se dicen y lo fácil que es que salga sola. */
export const MOMENTS = {
    pelea: { label: 'Tras la pelea', chance: 0.5 },
    llegada: { label: 'Al llegar', chance: 0.6 },
    viaje: { label: 'De camino', chance: 0.35 },
    pueblo: { label: 'En el pueblo', chance: 1 },
    herido: { label: 'Vas mal', chance: 0.8 },
};

/** Lo que pasa en el juego, y el momento de charla que le toca. */
const EVENT_MOMENTS = {
    combat: 'pelea', pelea: 'pelea', victory: 'pelea',
    arrive: 'llegada', llegada: 'llegada',
    travel: 'viaje', viaje: 'viaje', road: 'viaje',
    town: 'pueblo', pueblo: 'pueblo', idle: 'pueblo',
};

/** Por debajo de esta parte de su vida, tu gente te ve mal y lo dice. */
export const HURT_AT = 0.35;

/** Lo que suma el trato con alguien del pueblo antes de que os mire mejor (o peor). */
export const WARMTH_STEP = 3;

/** Los deseos que tienen frases propias (`WANTS` de `rules/companions.js`). */
export const TALK_WANTS = ['coin', 'glory', 'blood', 'quiet', 'knowledge'];

/** La cara del retrato al contestar, si la respuesta no dice otra. */
const ANSWER_FACE = { 1: 'alegre', '-1': 'enfadado' };

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * @typedef {Object} TalkReply
 * @property {string} text
 * @property {1|0|-1} mood Lo que le parece: 1 le gusta, -1 no.
 * @property {string} then Lo que contesta, si lo hay.
 * @property {string} face La cara con la que contesta (`alegre`, `enfadado`, `triste` o vacío).
 */

/**
 * @typedef {Object} TalkRow
 * @property {string} id
 * @property {string} who     El nombre de la persona, o vacío si es de un deseo.
 * @property {string} whoKey
 * @property {string} wants   El deseo, si la fila vale para cualquiera que busque eso.
 * @property {string} campaign
 * @property {string} moment
 * @property {string} mood    La cara mientras habla.
 * @property {string[]} lines
 * @property {TalkReply[]} replies
 * @property {string[]} hora  Las franjas en las que vale; vacío, todas.
 */

/**
 * @typedef {Object} Talk Una charla lista para enseñar.
 * @property {string} id
 * @property {string} who
 * @property {string} key    La clave de la persona (`social.js`).
 * @property {string} moment
 * @property {string} mood
 * @property {string[]} lines
 * @property {TalkReply[]} replies
 */

/**
 * @param {any} value
 * @returns {1|0|-1}
 */
function moodOf(value) {
    const n = Number(value);
    return n > 0 ? 1 : n < 0 ? -1 : 0;
}

/**
 * Las filas de `charlas.json` (el archivo, su `rows` o las filas del compendio), con forma.
 * Las que no se pueden jugar (sin frases, sin tres respuestas, un momento que no existe) se
 * quedan fuera.
 *
 * @param {any} raw
 * @returns {TalkRow[]}
 */
export function readTalkRows(raw) {
    const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.rows) ? raw.rows : [];
    return rows.flatMap((/** @type {any} */ row) => {
        const moment = text(row?.moment);
        const lines = (Array.isArray(row?.lines) ? row.lines : []).map(text).filter(Boolean).slice(0, 2);
        const replies = (Array.isArray(row?.replies) ? row.replies : [])
            .filter((/** @type {any} */ r) => text(r?.text))
            .map((/** @type {any} */ r) => ({ text: text(r.text), mood: moodOf(r.mood), then: text(r.then), face: text(r.face) }));
        if (!text(row?.id) || !(moment in MOMENTS) || lines.length === 0 || replies.length !== 3) return [];
        const hora = row?.when?.hora ?? row?.hora;
        return [{
            id: text(row.id),
            who: text(row.who),
            whoKey: keyOf(row.who),
            wants: text(row.wants),
            campaign: text(row.campaign),
            moment,
            mood: text(row.mood),
            lines,
            replies,
            hora: (Array.isArray(hora) ? hora : hora ? [hora] : []).map(text).filter(Boolean),
        }];
    });
}

/**
 * Si alguien va mal de vida.
 *
 * @param {any} member
 * @returns {boolean}
 */
export function isHurt(member) {
    const max = Number(member?.maxHp) || 0;
    if (max <= 0 || member?.dead) return false;
    return (Number(member?.hp) || 0) / max <= HURT_AT;
}

/**
 * El momento de charla de lo que acaba de pasar. Si tu héroe va mal de vida, manda eso:
 * nadie te habla del camino con la camisa llena de sangre.
 *
 * @param {{event: string, hero?: any}} input
 * @returns {string} Un momento de `MOMENTS`, o vacío.
 */
export function momentOf({ event, hero = null }) {
    const moment = /** @type {Record<string, string>} */ (EVENT_MOMENTS)[text(event)] ?? '';
    if (!moment) return '';
    return isHurt(hero) ? 'herido' : moment;
}

/**
 * @param {string} said
 * @param {{heroName?: string, place?: string}} holes
 * @returns {boolean}
 */
function fillable(said, { heroName = '', place = '' }) {
    if (said.includes('{sitio}') && !text(place)) return false;
    if (said.includes('{heroe}') && !text(heroName)) return false;
    return true;
}

/**
 * Las frases que valen para alguien en un momento: las suyas y, si no tiene, las de lo que busca.
 *
 * @param {Object} input
 * @param {TalkRow[]} input.rows
 * @param {{name: string, wants?: string}} input.person
 * @param {string} input.moment
 * @param {string} [input.slot] La franja (`morning`, `afternoon`, `night`).
 * @param {string} [input.place] El sitio al que se llega, para `{sitio}`.
 * @param {string} [input.heroName]
 * @returns {TalkRow[]}
 */
export function talkRowsFor({ rows, person, moment, slot = '', place = '', heroName = '' }) {
    const who = keyOf(person?.name);
    const fits = (/** @type {TalkRow} */ row) => row.moment === moment
        && (row.hora.length === 0 || !text(slot) || row.hora.includes(text(slot)))
        && fillable(JSON.stringify(row), { heroName, place });
    const list = Array.isArray(rows) ? rows : [];
    const own = list.filter(row => row.whoKey && row.whoKey === who && fits(row));
    if (own.length > 0) return own;
    const wants = text(person?.wants);
    return wants ? list.filter(row => !row.whoKey && row.wants === wants && fits(row)) : [];
}

/**
 * Si alguien tiene algo que decir en ese momento (suyo o de lo que busca).
 *
 * @param {TalkRow[]} rows
 * @param {{name: string, wants?: string}} person
 * @param {string} moment
 * @returns {boolean}
 */
export function hasTalk(rows, person, moment) {
    return talkRowsFor({ rows, person, moment, place: '-', heroName: '-' }).length > 0;
}

/**
 * Si sale una charla sola ahora. La del pueblo se pide, así que sale siempre; las demás, con
 * su probabilidad y como mucho una por franja.
 *
 * @param {Object} input
 * @param {string} input.moment
 * @param {any} input.social
 * @param {number} input.elapsed Las franjas pasadas desde el principio (`getElapsedSlots`).
 * @param {() => number} input.random
 * @returns {boolean}
 */
export function shouldTalk({ moment, social, elapsed, random }) {
    const spec = /** @type {Record<string, {chance: number}>} */ (MOMENTS)[text(moment)];
    if (!spec) return false;
    if (moment === 'pueblo') return true;
    if (readSocial(social).talkSlot === Math.floor(Number(elapsed) || 0)) return false;
    return random() < spec.chance;
}

/**
 * Apuntar que en esta franja ya salió una charla sola.
 *
 * @param {any} social
 * @param {number} elapsed
 * @returns {import('./social.js').SocialState}
 */
export function markSpontaneous(social, elapsed) {
    return { ...readSocial(social), talkSlot: Math.floor(Number(elapsed) || 0) };
}

/**
 * Quién habla: alguien del grupo (no el héroe), vivo, que tenga algo que decir. Mejor quien
 * no habló la última vez, y mejor quien tiene frases propias sin oír.
 *
 * @param {Object} input
 * @param {any[]} input.party El grupo, con el héroe primero.
 * @param {string} input.moment
 * @param {TalkRow[]} input.rows
 * @param {any} input.social
 * @param {() => number} input.random
 * @param {(member: any) => string} [input.wantsOf] Lo que busca cada uno (`readReasons(m).wants`).
 * @returns {any|null}
 */
export function chooseSpeaker({ party, moment, rows, social, random, wantsOf = (m) => text(m?.reasons?.wants) }) {
    const state = readSocial(social);
    const heard = new Set(state.heard);
    const able = (Array.isArray(party) ? party : []).slice(1)
        .filter(m => m && !m.dead && (Number(m.hp) || 0) > 0 && m.guest?.kind !== 'ward')
        .filter(m => hasTalk(rows, { name: m.name, wants: wantsOf(m) }, moment));
    if (able.length === 0) return null;
    const notLast = able.filter(m => keyOf(m.name) !== state.lastSpeaker);
    const pool = notLast.length > 0 ? notLast : able;
    const fresh = pool.filter(m => talkRowsFor({ rows, person: { name: m.name }, moment, place: '-', heroName: '-' })
        .some(row => row.whoKey && !heard.has(row.id)));
    const from = fresh.length > 0 ? fresh : pool;
    return from[Math.floor(random() * from.length) % from.length];
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
 * Una charla con alguien: sin repetir hasta agotar las suyas de ese momento.
 *
 * @param {Object} input
 * @param {TalkRow[]} input.rows
 * @param {{name: string, wants?: string}} input.person
 * @param {string} input.moment
 * @param {any} input.social
 * @param {() => number} input.random
 * @param {string} [input.slot]
 * @param {any} [input.hero] Tu héroe, para concordar y para `{heroe}`.
 * @param {any[]} [input.party] El grupo, para los plurales.
 * @param {string} [input.place] Para `{sitio}`.
 * @returns {{talk: Talk|null, social: import('./social.js').SocialState}}
 */
export function pickTalk({ rows, person, moment, social, random, slot = '', hero = null, party = [], place = '' }) {
    const state = readSocial(social);
    const candidates = talkRowsFor({ rows, person, moment, slot, place, heroName: text(hero?.name) });
    if (candidates.length === 0) return { talk: null, social: state };

    const ids = new Set(candidates.map(row => row.id));
    let heard = state.heard;
    let fresh = candidates.filter(row => !heard.includes(row.id));
    if (fresh.length === 0) {
        // Agotadas: vuelven todas, menos la última que se oyó (no se repite seguida).
        const last = [...heard].reverse().find(id => ids.has(id));
        heard = heard.filter(id => !ids.has(id));
        fresh = candidates.length > 1 ? candidates.filter(row => row.id !== last) : candidates;
    }
    const row = fresh[Math.floor(random() * fresh.length) % fresh.length];
    const who = { hero, party, place };
    return {
        talk: {
            id: row.id,
            who: text(person?.name) || row.who,
            key: keyOf(person?.name || row.who),
            moment: row.moment,
            mood: row.mood,
            lines: row.lines.map(line => render(line, who)),
            replies: row.replies.map(reply => ({
                text: render(reply.text, who),
                mood: reply.mood,
                then: render(reply.then, who),
                face: reply.face || /** @type {Record<string, string>} */ (ANSWER_FACE)[String(reply.mood)] || row.mood,
            })),
        },
        social: { ...state, heard: [...heard, row.id].slice(-HEARD_MEMORY), lastSpeaker: keyOf(person?.name || row.who) },
    };
}

/**
 * Lo que pasa al contestar. A un compañero, su aprobación: un punto de vínculo arriba
 * (`approved`) o abajo (`disapproved`). A alguien del pueblo, su trato: cada `WARMTH_STEP`
 * puntos, un paso de actitud. Una vez al día por persona; las demás charlas del día se
 * oyen igual, pero no cuentan.
 *
 * @param {Object} input
 * @param {Talk} input.talk
 * @param {number} input.index La respuesta elegida.
 * @param {any} input.social
 * @param {number} input.day El día del calendario.
 * @param {boolean} [input.inParty] Si va en el grupo (vínculo) o es del pueblo (trato).
 * @param {string} [input.id] El id de su ficha, para el apunte de aprobación.
 * @param {string} [input.wants]
 * @returns {{social: import('./social.js').SocialState, reply: TalkReply|null, event: 'approved'|'disapproved'|null,
 *   attitude: -1|0|1, counted: boolean, note: string,
 *   verdict: {id: string, name: string, want: string, mood: 1|-1, what: string}|null}}
 */
export function answerTalk({ talk, index, social, day, inParty = true, id = '', wants = '' }) {
    const state = readSocial(social);
    const reply = talk?.replies?.[Math.floor(Number(index))] ?? null;
    const none = { social: state, reply, event: null, attitude: /** @type {0} */ (0), counted: false, note: '', verdict: null };
    if (!reply) return none;
    const name = text(talk.who) || 'Alguien';
    const note = reply.mood > 0 ? `A ${name} le ha gustado.` : reply.mood < 0 ? `A ${name} no le ha gustado.` : '';
    const today = Math.floor(Number(day) || 0);
    if (reply.mood === 0 || state.nudged[talk.key] === today) return { ...none, note };

    const nudged = { ...state.nudged, [talk.key]: today };
    if (inParty) {
        return {
            social: { ...state, nudged },
            reply,
            event: reply.mood > 0 ? 'approved' : 'disapproved',
            attitude: 0,
            counted: true,
            note,
            verdict: { id: text(id), name, want: text(wants), mood: reply.mood, what: 'lo que le dijiste en una charla' },
        };
    }
    let warmth = (state.warmth[talk.key] ?? 0) + reply.mood;
    /** @type {-1|0|1} */
    let attitude = 0;
    if (warmth >= WARMTH_STEP) {
        attitude = 1;
        warmth -= WARMTH_STEP;
    } else if (warmth <= -WARMTH_STEP) {
        attitude = -1;
        warmth += WARMTH_STEP;
    }
    return {
        social: { ...state, nudged, warmth: { ...state.warmth, [talk.key]: warmth } },
        reply,
        event: null,
        attitude,
        counted: true,
        note: attitude > 0 ? `${name} os mira mejor.` : attitude < 0 ? `${name} os mira peor.` : note,
        verdict: null,
    };
}

/**
 * Una charla como escena de un solo paso, para enseñarla con la misma pantalla que las
 * quedadas (`ui/meetup-scene.js`). Las respuestas llevan su `bond` (lo que le parece), pero
 * lo que cuenta de verdad lo dice `answerTalk`.
 *
 * @param {Talk} talk
 * @returns {any}
 */
export function talkScene(talk) {
    return {
        id: talk.id,
        kind: 'charla',
        who: talk.who,
        title: /** @type {Record<string, {label: string}>} */ (MOMENTS)[talk.moment]?.label ?? '',
        beats: [{
            say: talk.lines.join(' '),
            mood: talk.mood,
            replies: talk.replies.map(reply => ({ text: reply.text, bond: reply.mood, then: reply.then, mood: reply.face })),
        }],
    };
}

/**
 * Cuántas frases tiene cada uno por momento: para las pruebas y para el compendio.
 *
 * @param {TalkRow[]} rows
 * @returns {Record<string, Record<string, number>>}
 */
export function talkCoverage(rows) {
    /** @type {Record<string, Record<string, number>>} */
    const out = {};
    for (const row of Array.isArray(rows) ? rows : []) {
        const who = row.who || `(${row.wants})`;
        out[who] = out[who] ?? {};
        out[who][row.moment] = (out[who][row.moment] ?? 0) + 1;
    }
    return out;
}
