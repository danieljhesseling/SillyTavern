/**
 * Quedar con alguien (J14.3, J14.5 y J14.6 de wiki/ROADMAP_SIN_CONEXION.md): el evento de
 * *Persona*. Gastas una parte del día con alguien de tu gente, en un sitio del pueblo, y se
 * juega una escena corta que os acerca.
 *
 * - **Qué escena sale**: la siguiente de esa persona para su rango de vínculo que aún no se
 *   ha jugado. Si no le queda ninguna a su rango, un **rato** juntos: una de sus charlas del
 *   pueblo (`small-talk.js`), más corta y que suma menos.
 * - **Cómo se juega**: la escena son dos a cuatro pasos (`beats`); cada paso dice qué pasa
 *   (`note`) y qué dice (`say`), y casi todos ofrecen dos o tres respuestas. Cada respuesta
 *   acerca (`bond: 1`), no mueve (0) o aleja (-1).
 * - **Qué suma**: la escena, como escena de confidente; el rato, como tiempo compartido; cada
 *   respuesta que le gusta, un punto más, y cada una que no, uno menos; quedar en un sitio que
 *   le gusta, uno más. Todo son eventos de `bonds.js`, así que el rango sube por hechos.
 * - **Qué abre cada rango**: lo que diga su ficha (`kind: "rango"`): una ayuda en combate
 *   (una de las ventajas de vínculo que el combate ya usa), un descuento en un servicio o su
 *   misión personal (J14.9, solo los datos). Y además las ventajas de siempre de `BOND_PERKS`.
 * - **Las escenas de confidente de cada campaña, jugadas** (J14.5): el paquete trae cinco por
 *   persona, escritas como un párrafo. `compendio/quedadas.json` trae esas mismas escenas
 *   pasadas a pasos con respuestas; si una campaña nueva no las trae pasadas, se pasan solas
 *   de la prosa (`beatsFromProse`), peor pero jugables.
 *
 * Puro: elige la escena, la juega paso a paso y dice qué cambia. Quien llama la enseña
 * (`ui/meetup-scene.js`), gasta la franja (`day-parts.js`), suma el vínculo y guarda `social`.
 */

import { BOND_EVENTS, BOND_PERKS, MAX_RANK, recordBondEvent, getRankForPoints, normalizeBondState } from './bonds.js';
import { resolveGenderDeep } from './grammar.js';
import { keyOf, readSocial } from './social.js';
import { pickTalk, talkScene } from './small-talk.js';

/** Las caras que tienen los retratos: `<persona>--<cara>.png`. */
export const FACES = ['alegre', 'enfadado', 'triste'];

/** Lo que vale cada clase de quedada, como evento de vínculo. */
export const MEETUP_EVENTS = { escena: 'confidant_scene', rato: 'shared_downtime' };

/** Lo que abre un rango: una ayuda en combate, un descuento o su misión personal. */
export const UNLOCK_TYPES = ['apoyo', 'descuento', 'mision'];

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * @typedef {Object} Reply
 * @property {string} text
 * @property {1|0|-1} bond
 * @property {string} then
 * @property {string} mood
 * @property {number} gold Lo que cuesta (negativo), si cuesta.
 */

/**
 * @typedef {Object} Beat
 * @property {string} note Lo que pasa, contado.
 * @property {string} say  Lo que dice.
 * @property {string} mood Su cara mientras lo dice.
 * @property {Reply[]} replies
 */

/**
 * @typedef {Object} Scene
 * @property {string} id
 * @property {'escena'|'rato'|'charla'} kind
 * @property {string} who
 * @property {string} key
 * @property {string} campaign
 * @property {number} rank
 * @property {string} title
 * @property {string} where
 * @property {Beat[]} beats
 * @property {boolean} [auto] Pasada sola de la prosa, sin escribir a mano.
 */

/**
 * @typedef {Object} Person La ficha de alguien para J14 (`kind: "gente"`).
 * @property {string} id
 * @property {string} who
 * @property {string} key
 * @property {string} campaign
 * @property {string} home Su pueblo: donde se le encuentra si no va contigo.
 * @property {Record<string, string>} places Dónde está a cada hora (`morning`, `afternoon`, `night`).
 * @property {string[]} likes Los sitios donde le gusta quedar.
 * @property {string} gender
 * @property {string} className
 */

/**
 * @typedef {Object} Unlock
 * @property {string} id
 * @property {string} who
 * @property {number} rank
 * @property {'apoyo'|'descuento'|'mision'} type
 * @property {string} label
 * @property {string} describe
 * @property {string} [perk] La ventaja de combate (`BOND_PERKS`), si es una ayuda.
 * @property {string} [on] El servicio (`tienda`, `herreria`, `posada`, `templo`), si es un descuento.
 * @property {number} [amount] Lo que rebaja (0.1 es un 10 %).
 * @property {any} [quest] La misión personal: `id`, `title`, `pitch` y sus dos `endings`.
 */

/**
 * @param {any} value
 * @returns {1|0|-1}
 */
function bondOf(value) {
    const n = Number(value);
    return n > 0 ? 1 : n < 0 ? -1 : 0;
}

/**
 * @param {any} value
 * @returns {string}
 */
function faceOf(value) {
    const said = text(value);
    return FACES.includes(said) ? said : '';
}

/**
 * Un paso de escena, con forma.
 *
 * @param {any} raw
 * @returns {Beat|null}
 */
function readBeat(raw) {
    const note = text(raw?.note);
    const say = text(raw?.say);
    if (!note && !say) return null;
    const replies = (Array.isArray(raw?.replies) ? raw.replies : [])
        .filter((/** @type {any} */ r) => text(r?.text))
        .slice(0, 3)
        .map((/** @type {any} */ r) => ({
            text: text(r.text),
            bond: bondOf(r.bond),
            then: text(r.then),
            mood: faceOf(r.mood),
            gold: Math.min(0, Math.floor(Number(r.gold) || 0)),
        }));
    return { note, say, mood: faceOf(raw?.mood), replies };
}

/**
 * Una escena escrita, con forma. Sin pasos jugables, nada.
 *
 * @param {any} raw
 * @returns {Scene|null}
 */
export function readScene(raw) {
    const beats = (Array.isArray(raw?.beats) ? raw.beats : []).map(readBeat).filter(Boolean);
    const who = text(raw?.who);
    if (!who || beats.length === 0) return null;
    const kind = ['escena', 'rato', 'charla'].includes(text(raw?.kind)) ? text(raw.kind) : 'escena';
    const rank = Math.min(MAX_RANK, Math.max(1, Math.floor(Number(raw?.rank) || 1)));
    return {
        id: text(raw?.id) || `${keyOf(who)}-${rank}`,
        kind: /** @type {Scene['kind']} */ (kind),
        who,
        key: keyOf(who),
        campaign: text(raw?.campaign),
        rank,
        title: text(raw?.title),
        where: text(raw?.where),
        beats: /** @type {Beat[]} */ (beats),
        ...(raw?.auto ? { auto: true } : {}),
    };
}

/**
 * Lo de `compendio/quedadas.json` (el archivo, su `rows` o las filas del compendio), por clase:
 * la gente (`gente`), las escenas (`escena`) y lo que abre cada rango (`rango`).
 *
 * @param {any} raw
 * @returns {{people: Person[], scenes: Scene[], unlocks: Unlock[]}}
 */
export function readMeetupRows(raw) {
    const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.rows) ? raw.rows : [];
    /** @type {Person[]} */
    const people = [];
    /** @type {Scene[]} */
    const scenes = [];
    /** @type {Unlock[]} */
    const unlocks = [];
    for (const row of rows) {
        const kind = text(row?.kind);
        const who = text(row?.who);
        if (!who) continue;
        if (kind === 'gente') {
            const places = row?.places && typeof row.places === 'object' ? row.places : {};
            people.push({
                id: text(row.id) || keyOf(who),
                who,
                key: keyOf(who),
                campaign: text(row.campaign),
                home: text(row.home),
                places: Object.fromEntries(Object.entries(places).map(([slot, place]) => [text(slot), text(place)]).filter(([s, p]) => s && p)),
                likes: (Array.isArray(row.likes) ? row.likes : []).map(text).filter(Boolean),
                gender: text(row.gender),
                className: text(row.className),
            });
        } else if (kind === 'escena') {
            const scene = readScene(row);
            if (scene) scenes.push(scene);
        } else if (kind === 'rango') {
            const unlock = row?.unlock && typeof row.unlock === 'object' ? row.unlock : {};
            const type = text(unlock.type);
            if (!UNLOCK_TYPES.includes(type)) continue;
            unlocks.push({
                id: text(row.id) || `${keyOf(who)}-rango-${Math.floor(Number(row.rank) || 1)}`,
                who,
                rank: Math.min(MAX_RANK, Math.max(1, Math.floor(Number(row.rank) || 1))),
                type: /** @type {Unlock['type']} */ (type),
                label: text(unlock.label),
                describe: text(unlock.describe),
                ...(text(unlock.perk) ? { perk: text(unlock.perk) } : {}),
                ...(text(unlock.on) ? { on: text(unlock.on) } : {}),
                ...(Number(unlock.amount) > 0 ? { amount: Math.min(0.9, Number(unlock.amount)) } : {}),
                ...(unlock.quest && typeof unlock.quest === 'object' ? { quest: unlock.quest } : {}),
            });
        }
    }
    return { people, scenes, unlocks };
}

/**
 * La ficha J14 de alguien, por su nombre.
 *
 * @param {{people: Person[]}} data
 * @param {any} name
 * @returns {Person|null}
 */
export function personOf(data, name) {
    const key = keyOf(name);
    return (data?.people ?? []).find(p => p.key === key) ?? null;
}

// ---------------------------------------------------------------------------------------
// J14.5: de la prosa del paquete a una escena jugable.

/** Las respuestas de una escena pasada sola, cuando termina con una pregunta. */
const AUTO_ASK = [
    { text: 'Le dices lo que piensas, sin rodeos.', bond: 1, then: 'Gracias por decírmelo claro.' },
    { text: 'Le escuchas y no dices nada.', bond: 0, then: '' },
    { text: 'Cambias de tema.', bond: -1, then: 'Ya. Mejor lo dejamos.' },
];

/** Y cuando no hay pregunta: estar, o dejarlo estar. */
const AUTO_STAY = [
    { text: 'Te quedas a su lado un rato más.', bond: 1, then: '' },
    { text: 'Lo dejas estar.', bond: 0, then: '' },
];

/**
 * Las frases de un párrafo: se corta tras punto, cierre de interrogación o de exclamación, o
 * tras una comilla que cierra, cuando lo siguiente empieza en mayúscula o abre algo.
 *
 * @param {string} prose
 * @returns {string[]}
 */
export function sentencesOf(prose) {
    return text(prose)
        .split(/(?<=[.!?»])\s+(?=[A-ZÁÉÍÓÚÑ¿¡«"])/u)
        .map(text)
        .filter(Boolean);
}

/**
 * Una escena escrita como párrafo, pasada a pasos: lo que pasa, y la pregunta del final como
 * el paso con respuestas. Sin pregunta, el último paso ofrece quedarse o dejarlo estar.
 *
 * @param {string} prose
 * @returns {Beat[]}
 */
export function beatsFromProse(prose) {
    const sentences = sentencesOf(prose);
    if (sentences.length === 0) return [];
    const reply = (/** @type {any} */ r) => ({ ...r, mood: '', gold: 0 });
    const last = sentences[sentences.length - 1];
    const asks = /\?|¿|\bte pregunta\b|\bte pide\b|\btú eliges\b|\btú decides\b|\btienes que\b/iu.test(last);
    const before = sentences.slice(0, -1);
    const closing = asks ? AUTO_ASK : AUTO_STAY;
    if (before.length === 0) return [{ note: last, say: '', mood: '', replies: closing.map(reply) }];
    return [
        { note: before.join(' '), say: '', mood: '', replies: [] },
        { note: last, say: '', mood: '', replies: closing.map(reply) },
    ];
}

/**
 * Las escenas jugables de alguien: las escritas en `quedadas.json` y, de las que trae su ficha
 * del paquete (`scenes` o `bondScenes`: `{rank, title, scene}`), las que no están escritas,
 * pasadas solas. Ordenadas por rango.
 *
 * @param {Object} input
 * @param {{name: string, scenes?: any[], bondScenes?: any[]}} input.person
 * @param {{scenes: Scene[]}} input.data
 * @param {string} [input.campaign]
 * @returns {Scene[]}
 */
export function scenesFor({ person, data, campaign = '' }) {
    const key = keyOf(person?.name);
    const written = (data?.scenes ?? []).filter(s => s.key === key && (!s.campaign || !text(campaign) || s.campaign === text(campaign) || s.campaign === 'gremio'));
    const prose = Array.isArray(person?.bondScenes) ? person.bondScenes : Array.isArray(person?.scenes) ? person.scenes : [];
    const converted = prose
        .filter((/** @type {any} */ s) => text(s?.scene))
        .map((/** @type {any} */ s) => ({ rank: Math.min(MAX_RANK, Math.max(1, Math.floor(Number(s.rank) || 1))), title: text(s.title), scene: text(s.scene) }))
        .filter((/** @type {any} */ s) => !written.some(w => w.rank === s.rank))
        .map((/** @type {any} */ s) => /** @type {Scene} */ ({
            id: `${keyOf(campaign) || 'campana'}-${key}-${s.rank}`,
            kind: 'escena',
            who: text(person?.name),
            key,
            campaign: text(campaign),
            rank: s.rank,
            title: s.title,
            where: '',
            beats: beatsFromProse(s.scene),
            auto: true,
        }))
        .filter((/** @type {Scene} */ s) => s.beats.length > 0);
    return [...written, ...converted].sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id));
}

/**
 * Las escenas de confidente de un paquete, pasadas a jugables (J14.5): para la herramienta y
 * las pruebas. Las escritas a mano mandan; las demás, pasadas solas.
 *
 * @param {Object} input
 * @param {any} input.pack
 * @param {string} input.campaign `strahd`, `1387`…
 * @param {{scenes: Scene[]}} [input.data]
 * @returns {Scene[]}
 */
export function convertPackConfidants({ pack, campaign, data = { scenes: [] } }) {
    return (Array.isArray(pack?.confidants) ? pack.confidants : [])
        .flatMap((/** @type {any} */ c) => scenesFor({ person: { name: c?.name, scenes: c?.scenes }, data, campaign }));
}

// ---------------------------------------------------------------------------------------
// J14.3: qué escena sale, y cómo se juega.

/**
 * La siguiente escena de alguien para su rango: la de rango más bajo que aún no se ha jugado.
 *
 * @param {{scenes: Scene[], rank: number, seen?: string[]}} input
 * @returns {Scene|null}
 */
export function nextScene({ scenes, rank, seen = [] }) {
    const done = new Set((Array.isArray(seen) ? seen : []).map(text));
    return (Array.isArray(scenes) ? scenes : [])
        .filter(s => s.rank <= Math.max(1, Number(rank) || 1) && !done.has(s.id))
        .sort((a, b) => a.rank - b.rank)[0] ?? null;
}

/**
 * Si alguien quiere quedar contigo: tiene una escena de su rango por jugar. Es el icono de la
 * pantalla del pueblo (J14.4).
 *
 * @param {Object} input
 * @param {{name: string, scenes?: any[], bondScenes?: any[]}} input.person
 * @param {number} input.rank
 * @param {{scenes: Scene[]}} input.data
 * @param {any} input.social
 * @param {string} [input.campaign]
 * @returns {{wants: boolean, why: string, scene: Scene|null}}
 */
export function wantsToMeet({ person, rank, data, social, campaign = '' }) {
    const seen = readSocial(social).seen[keyOf(person?.name)] ?? [];
    const scene = nextScene({ scenes: scenesFor({ person, data, campaign }), rank, seen });
    return scene
        ? { wants: true, why: `${text(person?.name)} quiere contarte algo.`, scene }
        : { wants: false, why: '', scene: null };
}

/** Los sitios, dichos dentro de una frase, para contar dónde se queda. */
const PLACE_WORDS = {
    posada: 'en la posada', tienda: 'en la tienda', herreria: 'en la herrería', templo: 'en el templo',
    tablon: 'junto al tablón', plaza: 'en la plaza', muelle: 'en el muelle', gremio: 'en la sala del gremio', camino: 'por el camino',
};

/** Cómo se dice cada franja dentro de una frase. */
const SLOT_WORDS = { morning: 'la mañana', afternoon: 'la tarde', night: 'la noche' };

/**
 * Un rato juntos, cuando no queda escena a su rango: una charla suya del pueblo precedida de
 * dónde estáis. Sin charla que sirva, un rato sin palabras escritas.
 *
 * @param {Object} input
 * @param {{name: string, wants?: string}} input.person
 * @param {any[]} input.talkRows Las filas de `readTalkRows`.
 * @param {any} input.social
 * @param {() => number} input.random
 * @param {string} [input.place] El sitio (`posada`, `muelle`…).
 * @param {string} [input.slot] La franja.
 * @param {any} [input.hero]
 * @param {any[]} [input.party]
 * @returns {{scene: Scene, social: import('./social.js').SocialState}}
 */
export function ratoScene({ person, talkRows, social, random, place = '', slot = '', hero = null, party = [] }) {
    const name = text(person?.name) || 'Alguien';
    const where = /** @type {Record<string, string>} */ (PLACE_WORDS)[text(place)] ?? '';
    const when = /** @type {Record<string, string>} */ (SLOT_WORDS)[text(slot)] ?? 'un rato';
    const opening = `Pasas ${when} con ${name}${where ? ` ${where}` : ''}.`;
    const picked = pickTalk({ rows: talkRows, person, moment: 'pueblo', social, random, slot, hero, party, place });
    const base = picked.talk ? talkScene(picked.talk) : {
        beats: [{
            say: '',
            replies: [
                { text: 'Cuéntame algo de ti.', bond: 1, then: 'Poca cosa. Pero gracias por preguntar.' },
                { text: 'Hablamos del trabajo.', bond: 0, then: '' },
            ],
        }],
    };
    const [first] = base.beats;
    const scene = readScene({
        id: `rato-${keyOf(name)}`,
        kind: 'rato',
        who: name,
        rank: 1,
        title: 'Un rato juntos',
        where: text(place),
        beats: [{ ...first, note: opening }],
    });
    return { scene: /** @type {Scene} */ (scene), social: picked.social };
}

/**
 * La quedada que toca con alguien: su siguiente escena, o un rato.
 *
 * @param {Object} input
 * @param {{name: string, wants?: string, scenes?: any[], bondScenes?: any[]}} input.person
 * @param {number} input.rank
 * @param {{scenes: Scene[]}} input.data
 * @param {any[]} input.talkRows
 * @param {any} input.social
 * @param {() => number} input.random
 * @param {string} [input.place]
 * @param {string} [input.slot]
 * @param {string} [input.campaign]
 * @param {any} [input.hero]
 * @param {any[]} [input.party]
 * @returns {{scene: Scene, social: import('./social.js').SocialState}}
 */
export function meetupFor({ person, rank, data, talkRows, social, random, place = '', slot = '', campaign = '', hero = null, party = [] }) {
    const state = readSocial(social);
    const scene = nextScene({ scenes: scenesFor({ person, data, campaign }), rank, seen: state.seen[keyOf(person?.name)] ?? [] });
    if (scene) return { scene, social: state };
    return ratoScene({ person, talkRows, social: state, random, place, slot, hero, party });
}

/**
 * La escena con el texto que concuerda con tu héroe y `{heroe}` relleno.
 *
 * @template T
 * @param {T} scene
 * @param {{hero?: any, party?: any[]}} [who]
 * @returns {T}
 */
export function renderScene(scene, { hero = null, party = [] } = {}) {
    const name = text(hero?.name);
    const filled = JSON.parse(JSON.stringify(scene ?? null, (key, value) => (typeof value === 'string' && name ? value.replaceAll('{heroe}', name) : value)));
    return resolveGenderDeep(filled, { heroe: hero, grupo: Array.isArray(party) && party.length > 0 ? party : [hero] });
}

/**
 * @typedef {Object} PlayState
 * @property {number} beat El paso que se ve.
 * @property {number|null} answered La respuesta elegida en este paso, si ya se eligió.
 * @property {Array<{beat: number, reply: number}>} choices
 * @property {boolean} done
 */

/** @returns {PlayState} */
export function startScene() {
    return { beat: 0, answered: null, choices: [], done: false };
}

/**
 * Un paso de la escena: elegir una respuesta (`{reply: i}`) o seguir (`{next: true}`). Seguir
 * sin haber contestado donde hay que contestar no hace nada.
 *
 * @param {Scene} scene
 * @param {PlayState} state
 * @param {{reply?: number, next?: boolean}} action
 * @returns {PlayState}
 */
export function sceneStep(scene, state, action) {
    if (!scene || state.done) return state;
    const beat = scene.beats[state.beat];
    if (!beat) return { ...state, done: true };
    if (action?.reply !== undefined && action.reply !== null) {
        const index = Math.floor(Number(action.reply));
        if (state.answered !== null || !beat.replies[index]) return state;
        return { ...state, answered: index, choices: [...state.choices, { beat: state.beat, reply: index }] };
    }
    if (action?.next) {
        if (beat.replies.length > 0 && state.answered === null) return state;
        const nextBeat = state.beat + 1;
        return nextBeat >= scene.beats.length
            ? { ...state, answered: null, done: true }
            : { beat: nextBeat, answered: null, choices: state.choices, done: false };
    }
    return state;
}

/**
 * Lo que se ve en un paso: lo que pasa, lo que dice, su cara, lo que contestaste y lo que te
 * contesta, y qué toca pulsar (`reply`, `continue` o `finish`).
 *
 * @param {Scene} scene
 * @param {PlayState} state
 * @returns {{who: string, title: string, step: number, steps: number, note: string, say: string, face: string,
 *   answer: {text: string, then: string, gold: number}|null, replies: Array<{index: number, text: string, gold: number}>,
 *   next: 'reply'|'continue'|'finish'|'done'}}
 */
export function sceneView(scene, state) {
    const steps = scene?.beats?.length ?? 0;
    const base = { who: text(scene?.who), title: text(scene?.title), step: Math.min(state.beat + 1, steps), steps };
    if (!scene || state.done) return { ...base, note: '', say: '', face: '', answer: null, replies: [], next: 'done' };
    const beat = scene.beats[state.beat];
    const last = state.beat >= steps - 1;
    const reply = state.answered !== null ? beat.replies[state.answered] : null;
    const waiting = beat.replies.length > 0 && !reply;
    return {
        ...base,
        note: beat.note,
        say: beat.say,
        face: reply?.mood || beat.mood,
        answer: reply ? { text: reply.text, then: reply.then, gold: reply.gold } : null,
        replies: waiting ? beat.replies.map((r, index) => ({ index, text: r.text, gold: r.gold })) : [],
        next: waiting ? 'reply' : last ? 'finish' : 'continue',
    };
}

/**
 * Lo que deja una escena jugada: los eventos de vínculo (en orden), los puntos que suman, el
 * oro que cuesta y cuántas respuestas le gustaron o no.
 *
 * @param {Object} input
 * @param {Scene} input.scene
 * @param {Array<{beat: number, reply: number}>} input.choices
 * @param {boolean} [input.likedPlace] Si se quedó en un sitio que le gusta.
 * @returns {{events: string[], points: number, gold: number, liked: number, disliked: number}}
 */
export function sceneOutcome({ scene, choices, likedPlace = false }) {
    /** @type {string[]} */
    const events = [];
    const base = /** @type {Record<string, string>} */ (MEETUP_EVENTS)[scene?.kind ?? ''];
    if (base) events.push(base);
    let gold = 0;
    let liked = 0;
    let disliked = 0;
    for (const choice of Array.isArray(choices) ? choices : []) {
        const reply = scene?.beats?.[choice.beat]?.replies?.[choice.reply];
        if (!reply) continue;
        gold += reply.gold;
        if (reply.bond > 0) {
            liked += 1;
            events.push('approved');
        } else if (reply.bond < 0) {
            disliked += 1;
            events.push('disapproved');
        }
    }
    if (likedPlace && base) events.push('approved');
    const points = events.reduce((sum, id) => sum + (/** @type {Record<string, {points: number}>} */ (BOND_EVENTS)[id]?.points ?? 0), 0);
    return { events, points, gold, liked, disliked };
}

/**
 * Lo que abre alguien al llegar a un rango: lo suyo (`kind: "rango"`) y las ventajas de
 * vínculo de siempre de ese rango. Si lo suyo ya es una de esas ventajas, se dice como lo
 * suyo, una vez.
 *
 * @param {{unlocks: Unlock[]}} data
 * @param {any} name
 * @param {number} rank
 * @returns {Unlock[]}
 */
export function unlocksAt(data, name, rank) {
    const key = keyOf(name);
    const own = (data?.unlocks ?? []).filter(u => keyOf(u.who) === key && u.rank === rank);
    const perks = BOND_PERKS.filter(p => p.rank === rank && !own.some(u => u.perk === p.id))
        .map(p => /** @type {Unlock} */ ({
            id: `vinculo-${p.id}`, who: text(name), rank, type: 'apoyo', label: p.label, describe: p.description, perk: p.id,
        }));
    return [...own, ...perks];
}

/**
 * Lo que se abre al pasar de un rango a otro (los dos rangos de en medio incluidos).
 *
 * @param {{unlocks: Unlock[]}} data
 * @param {any} name
 * @param {number} rankBefore
 * @param {number} rankAfter
 * @returns {Unlock[]}
 */
export function unlocksBetween(data, name, rankBefore, rankAfter) {
    /** @type {Unlock[]} */
    const out = [];
    for (let rank = Math.max(1, rankBefore) + 1; rank <= Math.min(MAX_RANK, rankAfter); rank++) out.push(...unlocksAt(data, name, rank));
    return out;
}

/**
 * Todo lo que tiene abierto alguien a su rango.
 *
 * @param {{unlocks: Unlock[]}} data
 * @param {any} name
 * @param {number} rank
 * @returns {Unlock[]}
 */
export function unlockedFor(data, name, rank) {
    return unlocksBetween(data, name, 1, rank);
}

/**
 * Sumar la quedada al vínculo: cada evento, en orden, con `recordBondEvent`. Dice si subió de
 * rango y qué se abrió.
 *
 * @param {Object} input
 * @param {any} input.bonds
 * @param {string} input.bondKey `bondKeyOf(person)`.
 * @param {{events: string[]}} input.outcome
 * @param {{unlocks: Unlock[]}} input.data
 * @param {string} input.name
 * @returns {{bonds: any, rankBefore: number, rankAfter: number, rankedUp: boolean, points: number, unlocks: Unlock[]}}
 */
export function applyMeetup({ bonds, bondKey, outcome, data, name }) {
    let state = normalizeBondState(bonds);
    const pointsBefore = state.bonds[text(bondKey)]?.points ?? 0;
    const rankBefore = getRankForPoints(pointsBefore);
    for (const event of outcome?.events ?? []) state = recordBondEvent(state, bondKey, event).state;
    const pointsAfter = state.bonds[text(bondKey)]?.points ?? 0;
    const rankAfter = getRankForPoints(pointsAfter);
    return {
        bonds: state,
        rankBefore,
        rankAfter,
        rankedUp: rankAfter > rankBefore,
        points: pointsAfter - pointsBefore,
        unlocks: unlocksBetween(data, name, rankBefore, rankAfter),
    };
}

/**
 * Apuntar la quedada: la escena ya jugada (un rato no cuenta como escena), cuándo fue y lo
 * que se abrió.
 *
 * @param {any} social
 * @param {{name: string, scene: Scene, elapsed: number, unlocks?: Unlock[]}} input
 * @returns {import('./social.js').SocialState}
 */
export function recordMeetup(social, { name, scene, elapsed, unlocks = [] }) {
    const state = readSocial(social);
    const key = keyOf(name);
    const seen = scene?.kind === 'escena' ? [...new Set([...(state.seen[key] ?? []), scene.id])] : (state.seen[key] ?? []);
    const opened = [...new Set([...(state.opened[key] ?? []), ...unlocks.map(u => u.id)])];
    return {
        ...state,
        seen: seen.length > 0 ? { ...state.seen, [key]: seen } : state.seen,
        opened: opened.length > 0 ? { ...state.opened, [key]: opened } : state.opened,
        met: { ...state.met, [key]: Math.floor(Number(elapsed) || 0) },
    };
}

/**
 * Lo que se cuenta al acabar: cuánto se acerca, si sube de rango, lo que abre y lo que costó.
 *
 * @param {{name: string, result: ReturnType<typeof applyMeetup>, outcome: ReturnType<typeof sceneOutcome>}} input
 * @returns {string[]}
 */
export function meetupSummary({ name, result, outcome }) {
    const who = text(name) || 'Alguien';
    /** @type {string[]} */
    const lines = [];
    if (result.points > 0) lines.push(`Te acercas a ${who} (+${result.points} de vínculo).`);
    else if (result.points < 0) lines.push(`${who} se queda más lejos (${result.points} de vínculo).`);
    else lines.push(`Con ${who}, todo sigue igual.`);
    if (result.rankedUp) lines.push(`Vuestro vínculo sube a rango ${result.rankAfter}.`);
    for (const unlock of result.unlocks) lines.push(`Se abre: ${unlock.label}. ${unlock.describe}`.trim());
    if (outcome.gold < 0) lines.push(`Te cuesta ${-outcome.gold} de oro.`);
    return lines;
}

/**
 * Los descuentos que ha abierto tu gente, con la forma de los favores de `companion-arcs.js`
 * para que `favorDiscount` los mezcle con los de la gente del sitio.
 *
 * @param {{unlocks: Unlock[]}} data
 * @param {Array<{name: string, rank: number}>} ranks
 * @returns {Array<{name: string, kind: string, favor: string, discount: number, on: string}>}
 */
export function bondDiscounts(data, ranks) {
    return (Array.isArray(ranks) ? ranks : []).flatMap(({ name, rank }) => unlockedFor(data, name, rank)
        .filter(u => u.type === 'descuento' && u.on && (u.amount ?? 0) > 0)
        .map(u => ({ name: text(name), kind: /** @type {string} */ (u.on), favor: u.describe || u.label, discount: /** @type {number} */ (u.amount), on: /** @type {string} */ (u.on) })));
}

/**
 * Las misiones personales abiertas (J14.9, solo datos por ahora).
 *
 * @param {{unlocks: Unlock[]}} data
 * @param {Array<{name: string, rank: number}>} ranks
 * @returns {Array<{who: string, quest: any}>}
 */
export function personalQuestsOpen(data, ranks) {
    return (Array.isArray(ranks) ? ranks : []).flatMap(({ name, rank }) => unlockedFor(data, name, rank)
        .filter(u => u.type === 'mision' && u.quest)
        .map(u => ({ who: text(name), quest: u.quest })));
}
