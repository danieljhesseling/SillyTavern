/**
 * El romance, opcional (J14.10 de wiki/ROADMAP_SIN_CONEXION.md): con los compañeros que lo
 * permiten, una señal, tres citas, una noche que acaba en fundido a negro y, desde entonces,
 * una pareja que el juego recuerda (el vínculo, sus frases, el final de la campaña y el Salón
 * de la fama).
 *
 * - **Quién lo permite** lo dice la ficha de cada compañero (`compendio/companeros.json`, su
 *   campo `romance`): `with` es con quién (`todos`, `hombres`, `mujeres`, `no-binario`, o una
 *   lista de esos) o `nadie`; `no` es lo que contesta si no puede ser. Sin campo, nada: ni
 *   siquiera sale la pregunta.
 * - **La señal**: a partir del vínculo 4 (`ROMANCE_RANK`), una quedada sin escena pendiente
 *   (un rato) puede ser su escena de señal, con una respuesta claramente romántica (lleva un
 *   corazón). Contesta según su ficha: si te acepta, empezáis; si no, te lo dice con cariño y
 *   no vuelve a salir. Si la dejas pasar, no vuelve hasta dentro de unos días (`SIGNAL_REST`).
 * - **Las citas** son quedadas (J14.3): tres escenas escritas, una por quedada. Solo se avanza
 *   al elegir la respuesta romántica; lo demás deja la cita para otro día, y «como amigos» lo
 *   cierra para siempre.
 * - **La noche**: la cuarta escena, solo de noche. Si te quedas, fundido a negro (`fade` en la
 *   respuesta): nada explícito. Desde ahí, sois pareja.
 *
 * Las escenas van en `compendio/romances.json` (`kind`: `senal`, `cita` con su `step`, `final`,
 * `pareja` con frases sueltas y `epilogo`), con la forma de las escenas de quedada. Las
 * respuestas llevan `romance: "avanza"` o `romance: "amigos"`.
 *
 * Todo va **por el nombre** de cada persona (`keyOf`), como lo social: Nella es la misma en el
 * gremio y en Barovia. Se guarda en la clave `romances`.
 *
 * Puro: lee, decide y devuelve copias. Quien llama guarda, y mira si el jugador lo tiene
 * encendido en las opciones (apagado, nada de esto sale).
 */

import { genderOf, GENDER, resolveGender } from './grammar.js';
import { keyOf } from './social.js';

/** La clave en los metadatos del chat. */
export const ROMANCE_KEY = 'romances';

export const ROMANCE_VERSION = 1;

/** El vínculo al que puede salir la señal. */
export const ROMANCE_RANK = 4;

/** Las citas antes de la noche. */
export const DATES = 3;

/** Los días que pasan antes de que vuelva a salir la señal, si la dejaste pasar. */
export const SIGNAL_REST = 3;

/** La marca de la respuesta romántica: que se vea a la primera. */
export const HEART = '♥ ';

/** Con quién puede ser, según quién eres. `nadie`: con nadie. */
export const ROMANCE_WITH = ['todos', 'hombres', 'mujeres', 'no-binario', 'nadie'];

/** Lo que dice quien no puede, si su ficha no lo trae escrito. */
const GENERIC_NO = 'Te mira un momento y sonríe con cariño. «Te aprecio mucho. Pero no de esa manera.» Y todo sigue como antes entre vosotros.';

/** Lo que dice quien sí puede, si su señal no está escrita (la común). */
const GENERIC_YES = 'Te coge la mano, sin prisa. «Yo también lo había pensado.»';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string} */
const plain = (value) => text(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * @typedef {Object} RomanceCard Lo que dice la ficha de un compañero del romance.
 * @property {string} who
 * @property {string} key
 * @property {string} short
 * @property {string[]} with Con quién: `todos`, `hombres`, `mujeres`, `no-binario`. Vacío: con nadie.
 * @property {string} no Lo que contesta si no puede ser.
 */

/**
 * @typedef {Object} RomanceReply
 * @property {string} text
 * @property {1|0|-1} bond
 * @property {string} then
 * @property {string} mood
 * @property {number} gold
 * @property {'avanza'|'amigos'|''} romance
 * @property {boolean} [fade]
 */

/**
 * @typedef {Object} RomanceBeat
 * @property {string} note
 * @property {string} say
 * @property {string} mood
 * @property {RomanceReply[]} replies
 */

/**
 * @typedef {Object} RomanceScene Con la forma de una escena de quedada (`meetups.js`).
 * @property {string} id
 * @property {'escena'} kind
 * @property {string} who
 * @property {string} key
 * @property {string} campaign
 * @property {number} rank
 * @property {string} title
 * @property {string} where
 * @property {RomanceBeat[]} beats
 * @property {'senal'|'cita'|'final'} stage
 * @property {number} step La cita (1 a `DATES`); 0 en la señal y la noche.
 */

/**
 * @typedef {Object} RomanceData
 * @property {RomanceScene[]} scenes Las señales, las citas y las noches.
 * @property {Record<string, string[]>} notes Por persona, frases sueltas de pareja.
 * @property {Record<string, {home: string, away: string, hall: string}>} epilogues Por persona.
 */

/**
 * @typedef {Object} RomanceEntry
 * @property {string} name
 * @property {'pausa'|'citas'|'pareja'|'amigos'|'no'} status `pausa`: la señal salió y la dejaste pasar.
 * @property {number} step Las citas ya hechas.
 * @property {number} since El día en que empezó (o en que fuisteis pareja, o en que salió la señal).
 */

/** @typedef {{version: number, people: Record<string, RomanceEntry>}} RomanceState */

/** @typedef {'senal'|'espera'|'cita'|'final'|'pareja'|'cerrado'} RomanceStage */

// ---------------------------------------------------------------------------------------
// Quién lo permite.

/**
 * Quién eres, para el romance: `hombre`, `mujer`, `no-binario` o vacío si no se sabe. Lo que
 * cuenta es lo que elegiste al crearte, no cómo te habla el texto: «No binario (en femenino)»
 * es `no-binario`.
 *
 * @param {any} hero Su ficha o su género.
 * @returns {''|'hombre'|'mujer'|'no-binario'}
 */
export function heroIdentity(hero) {
    const raw = hero && typeof hero === 'object' ? (hero.gender ?? hero.genero) : hero;
    if (/no[ -]?binari|^nb$|^n$|^elle$/.test(plain(raw))) return 'no-binario';
    const gender = genderOf(raw);
    if (gender === GENDER.F) return 'mujer';
    if (gender === GENDER.M) return 'hombre';
    if (gender === GENDER.N) return 'no-binario';
    return '';
}

/** Cada palabra de `with`, por quién la cumple. */
const WITH_HERO = /** @type {Record<string, string>} */ ({ hombres: 'hombre', mujeres: 'mujer', 'no-binario': 'no-binario' });

/**
 * Lo que dice una fila de `companeros.json` del romance. Sin campo `romance`, nada.
 *
 * @param {any} row
 * @returns {RomanceCard|null}
 */
export function readRomanceCard(row) {
    const who = text(row?.who);
    const raw = row?.romance;
    if (!who || raw === undefined || raw === null) return null;
    const said = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : { with: raw };
    const list = (Array.isArray(said.with) ? said.with : [said.with])
        .map((/** @type {any} */ w) => plain(w).replace(/\s+/g, '-'))
        .filter((/** @type {string} */ w) => ROMANCE_WITH.includes(w));
    const nobody = said.with === false || list.includes('nadie') || list.length === 0;
    return {
        who,
        key: keyOf(who),
        short: text(row?.short) || who.split(' ')[0],
        with: nobody ? [] : list.includes('todos') ? ['todos'] : [...new Set(list)],
        no: text(said.no),
    };
}

/**
 * Las de todo el archivo (o sus filas).
 *
 * @param {any} raw
 * @returns {RomanceCard[]}
 */
export function readRomanceCards(raw) {
    const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.rows) ? raw.rows : [];
    return rows.map(readRomanceCard).filter(/** @returns {card is RomanceCard} */ (card) => card !== null);
}

/**
 * La ficha de alguien, por su nombre.
 *
 * @param {RomanceCard[]} cards
 * @param {any} name
 * @returns {RomanceCard|null}
 */
export function romanceCardOf(cards, name) {
    const key = keyOf(name);
    return (Array.isArray(cards) ? cards : []).find(card => card.key === key || keyOf(card.short) === key) ?? null;
}

/**
 * Si su ficha le deja con tu héroe. `todos` es con cualquiera, también con quien no dice
 * quién es; lo demás, con quien lo cumple.
 *
 * @param {RomanceCard|null} card
 * @param {any} hero
 * @returns {boolean}
 */
export function allowsHero(card, hero) {
    if (!card || card.with.length === 0) return false;
    if (card.with.includes('todos')) return true;
    const who = heroIdentity(hero);
    return Boolean(who) && card.with.some(w => WITH_HERO[w] === who);
}

// ---------------------------------------------------------------------------------------
// Las escenas escritas.

/** @param {any} value @returns {1|0|-1} */
const bondOf = (value) => (Number(value) > 0 ? 1 : Number(value) < 0 ? -1 : 0);

/**
 * @param {any} raw
 * @returns {RomanceBeat|null}
 */
function readBeat(raw) {
    const note = text(raw?.note);
    const say = text(raw?.say);
    if (!note && !say) return null;
    const replies = (Array.isArray(raw?.replies) ? raw.replies : [])
        .filter((/** @type {any} */ r) => text(r?.text))
        .slice(0, 3)
        .map((/** @type {any} */ r) => /** @type {RomanceReply} */ ({
            text: text(r.text),
            bond: bondOf(r.bond),
            then: text(r.then),
            mood: ['alegre', 'enfadado', 'triste'].includes(text(r.mood)) ? text(r.mood) : '',
            gold: 0,
            romance: text(r.romance) === 'avanza' ? 'avanza' : text(r.romance) === 'amigos' ? 'amigos' : '',
            ...(r.fade === true ? { fade: true } : {}),
        }));
    return { note, say, mood: ['alegre', 'enfadado', 'triste'].includes(text(raw?.mood)) ? text(raw.mood) : '', replies };
}

/**
 * Lo de `compendio/romances.json` (el archivo, su `rows` o las filas del compendio).
 *
 * @param {any} raw
 * @returns {RomanceData}
 */
export function readRomanceRows(raw) {
    const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.rows) ? raw.rows : [];
    /** @type {RomanceData} */
    const data = { scenes: [], notes: {}, epilogues: {} };
    for (const row of rows) {
        const kind = text(row?.kind);
        const who = text(row?.who);
        if (!who) continue;
        // `*`: la señal común, para quien no tiene la suya escrita.
        const key = who === '*' ? '*' : keyOf(who);
        if (kind === 'senal' || kind === 'cita' || kind === 'final') {
            const beats = (Array.isArray(row?.beats) ? row.beats : []).map(readBeat).filter(/** @returns {b is RomanceBeat} */ (b) => b !== null);
            if (beats.length === 0) continue;
            const step = kind === 'cita' ? Math.max(1, Math.floor(Number(row?.step) || 1)) : 0;
            data.scenes.push({
                id: text(row?.id) || `romance-${key}-${kind}${step ? `-${step}` : ''}`,
                kind: 'escena',
                who,
                key,
                campaign: text(row?.campaign),
                rank: ROMANCE_RANK,
                title: text(row?.title),
                where: text(row?.where),
                beats,
                stage: kind,
                step,
            });
        } else if (kind === 'pareja') {
            const lines = (Array.isArray(row?.lines) ? row.lines : []).map(text).filter(Boolean);
            if (lines.length > 0) data.notes[key] = [...(data.notes[key] ?? []), ...lines];
        } else if (kind === 'epilogo') {
            data.epilogues[key] = { home: text(row?.home), away: text(row?.away), hall: text(row?.hall) };
        }
    }
    return data;
}

/**
 * La escena escrita de alguien para ese momento.
 *
 * @param {RomanceData} data
 * @param {string} key
 * @param {'senal'|'cita'|'final'} stage
 * @param {number} [step]
 * @returns {RomanceScene|null}
 */
function writtenScene(data, key, stage, step = 0) {
    return (data?.scenes ?? []).find(s => s.key === key && s.stage === stage && (stage !== 'cita' || s.step === step)) ?? null;
}

/**
 * Si el romance de alguien está escrito entero: sus tres citas y su noche. Sin eso no se
 * empieza, aunque su ficha lo permita (se quedaría a medias).
 *
 * @param {RomanceData} data
 * @param {any} name
 * @returns {boolean}
 */
export function hasWrittenRomance(data, name) {
    const key = keyOf(name);
    if (!writtenScene(data, key, 'final')) return false;
    for (let step = 1; step <= DATES; step++) if (!writtenScene(data, key, 'cita', step)) return false;
    return true;
}

/**
 * Si contigo puede ser: su ficha te deja y su romance está escrito.
 *
 * @param {RomanceCard|null} card
 * @param {RomanceData} data
 * @param {any} hero
 * @returns {boolean}
 */
export function canRomance(card, data, hero) {
    return Boolean(card) && allowsHero(card, hero) && hasWrittenRomance(data, card?.who);
}

// ---------------------------------------------------------------------------------------
// Lo guardado.

/** @returns {RomanceState} */
export function createRomanceState() {
    return { version: ROMANCE_VERSION, people: {} };
}

/**
 * Lo guardado, con forma aunque llegue roto.
 *
 * @param {any} raw
 * @returns {RomanceState}
 */
export function readRomanceState(raw) {
    const state = createRomanceState();
    const people = raw && typeof raw === 'object' && raw.people && typeof raw.people === 'object' ? raw.people : {};
    for (const [key, entry] of Object.entries(people)) {
        const status = text(/** @type {any} */ (entry)?.status);
        if (!text(key) || !['pausa', 'citas', 'pareja', 'amigos', 'no'].includes(status)) continue;
        state.people[text(key)] = {
            name: text(/** @type {any} */ (entry)?.name) || text(key),
            status: /** @type {RomanceEntry['status']} */ (status),
            step: Math.max(0, Math.min(DATES, Math.floor(Number(/** @type {any} */ (entry)?.step) || 0))),
            since: Math.max(0, Math.floor(Number(/** @type {any} */ (entry)?.since) || 0)),
        };
    }
    return state;
}

/**
 * Lo de alguien, si hay algo.
 *
 * @param {any} state
 * @param {any} name
 * @returns {RomanceEntry|null}
 */
export function romanceOf(state, name) {
    const people = readRomanceState(state).people;
    const key = keyOf(name);
    // Por su nombre entero; si no, por el corto («Nella» es Nella Tresflechas).
    return people[key] ?? Object.values(people).find(e => key && keyOf(text(e.name).split(' ')[0]) === key) ?? null;
}

/**
 * En qué punto está: la señal por salir (o en espera, si la dejaste pasar hace poco), una
 * cita, la noche, pareja, o cerrado (dijo que no, o lo dejasteis como amigos).
 *
 * @param {RomanceEntry|null} entry
 * @param {number} [day] Hoy: para saber si la señal ya puede volver a salir.
 * @returns {RomanceStage}
 */
export function stageOf(entry, day = 0) {
    if (!entry) return 'senal';
    if (entry.status === 'pausa') return (Number(day) || 0) - entry.since >= SIGNAL_REST ? 'senal' : 'espera';
    if (entry.status === 'pareja') return 'pareja';
    if (entry.status === 'citas') return entry.step >= DATES ? 'final' : 'cita';
    return 'cerrado';
}

/**
 * Si sois pareja.
 *
 * @param {any} state
 * @param {any} name
 * @returns {boolean}
 */
export function isCouple(state, name) {
    return romanceOf(state, name)?.status === 'pareja';
}

/**
 * Con quién sois pareja (los nombres).
 *
 * @param {any} state
 * @returns {string[]}
 */
export function couplesOf(state) {
    return Object.values(readRomanceState(state).people).filter(e => e.status === 'pareja').map(e => e.name);
}

/**
 * Lo que viene de otro chat (del gremio a una campaña, o de vuelta): lo de quien viaja es lo
 * más nuevo y manda; lo de quien se quedó aquí, se queda.
 *
 * @param {any} here
 * @param {any} there
 * @returns {RomanceState}
 */
export function mergeRomance(here, there) {
    const a = readRomanceState(here);
    const b = readRomanceState(there);
    return { version: ROMANCE_VERSION, people: { ...a.people, ...b.people } };
}

// ---------------------------------------------------------------------------------------
// La quedada que toca.

/**
 * La escena, lista para jugarse: el corazón en la respuesta romántica y, si no puede ser, su
 * «no» como lo que contesta.
 *
 * @param {RomanceScene} scene
 * @param {{short: string, answer?: string}} input
 * @returns {RomanceScene}
 */
function ready(scene, { short, answer = '' }) {
    const fill = (/** @type {string} */ value) => value.replaceAll('{nombre}', short);
    return {
        ...scene,
        title: fill(scene.title),
        beats: scene.beats.map(beat => ({
            ...beat,
            note: fill(beat.note),
            say: fill(beat.say),
            replies: beat.replies.map(reply => ({
                ...reply,
                text: `${reply.romance === 'avanza' ? HEART : ''}${fill(reply.text)}`,
                then: fill(reply.romance === 'avanza' && answer ? answer : reply.then),
            })),
        })),
    };
}

/**
 * La escena de romance que toca en una quedada con alguien, o null si no toca ninguna.
 *
 * - Apagado en las opciones (`on: false`), sin ficha, o cerrado: nada.
 * - La señal: a partir del vínculo 4, en un rato (`free`: sin escena suya pendiente). La suya si
 *   está escrita; si no, la común. Si no puede ser, lo que contesta es su «no». Si la dejaste
 *   pasar hace poco (`espera`), todavía no.
 * - Una cita: la siguiente, aunque tenga una escena suya pendiente (esa, en la próxima).
 * - La noche: solo de noche.
 * - Pareja: nada que sustituir (el rato lleva una frase suya: `coupleNote`).
 *
 * @param {Object} input
 * @param {RomanceData} input.data
 * @param {RomanceCard|null} input.card
 * @param {any} input.state
 * @param {string} input.name
 * @param {number} input.rank
 * @param {any} input.hero
 * @param {string} [input.slot] La franja (`morning`, `afternoon`, `night`).
 * @param {boolean} [input.free] Si la quedada iba a ser un rato (sin escena suya por jugar).
 * @param {boolean} [input.on] Si el romance está encendido en las opciones.
 * @param {number} [input.day] Hoy.
 * @returns {{scene: RomanceScene, stage: 'senal'|'cita'|'final', allowed: boolean}|null}
 */
export function romanceScene({ data, card, state, name, rank, hero, slot = '', free = true, on = true, day = 0 }) {
    if (!on || !card) return null;
    const entry = romanceOf(state, name);
    const stage = stageOf(entry, day);
    const short = card.short || text(name).split(' ')[0];
    if (stage === 'senal') {
        // La señal no le quita el sitio a una escena suya por jugar; las citas y la noche, sí:
        // las has pedido tú.
        if (!free || (Number(rank) || 0) < ROMANCE_RANK) return null;
        const allowed = canRomance(card, data, hero);
        const own = writtenScene(data, card.key, 'senal');
        const scene = own ?? writtenScene(data, '*', 'senal');
        if (!scene) return null;
        const answer = allowed ? (own ? '' : GENERIC_YES) : (card.no || GENERIC_NO);
        const who = { ...scene, who: card.who, key: card.key, id: own ? scene.id : `romance-${card.key}-senal` };
        return { scene: ready(who, { short, answer }), stage: 'senal', allowed };
    }
    if (stage === 'cita') {
        const scene = writtenScene(data, card.key, 'cita', (entry?.step ?? 0) + 1);
        return scene ? { scene: ready(scene, { short }), stage: 'cita', allowed: true } : null;
    }
    if (stage === 'final') {
        if (text(slot) !== 'night') return null;
        const scene = writtenScene(data, card.key, 'final');
        return scene ? { scene: ready(scene, { short }), stage: 'final', allowed: true } : null;
    }
    return null;
}

/**
 * Lo que se eligió en la escena, para el romance: la última respuesta que lo mueve.
 *
 * @param {{beats: Array<{replies: Array<{romance?: string}>}>}|null} scene
 * @param {Array<{beat: number, reply: number}>} choices
 * @returns {'avanza'|'amigos'|''}
 */
export function romanceChoice(scene, choices) {
    let chosen = /** @type {'avanza'|'amigos'|''} */ ('');
    for (const choice of Array.isArray(choices) ? choices : []) {
        const said = text(scene?.beats?.[choice?.beat]?.replies?.[choice?.reply]?.romance);
        if (said === 'avanza' || said === 'amigos') chosen = said;
    }
    return chosen;
}

/**
 * Lo que cambia tras una escena de romance, y lo que se cuenta.
 *
 * @param {any} state
 * @param {Object} input
 * @param {string} input.name
 * @param {string} [input.short]
 * @param {'senal'|'cita'|'final'} input.stage
 * @param {'avanza'|'amigos'|''} input.choice
 * @param {boolean} [input.allowed] En la señal: si su ficha te deja.
 * @param {number} [input.day]
 * @returns {{state: RomanceState, news: string[], couple: boolean, changed: boolean}}
 */
export function advanceRomance(state, { name, short = '', stage, choice, allowed = true, day = 0 }) {
    const now = readRomanceState(state);
    const key = keyOf(name);
    const who = text(short) || text(name).split(' ')[0];
    const entry = now.people[key] ?? null;
    /** @type {(change: Partial<RomanceEntry>) => RomanceState} */
    const put = (change) => {
        /** @type {RomanceEntry} */
        const next = { name: text(name), status: 'citas', step: 0, since: Math.max(0, Math.floor(Number(day) || 0)), ...(entry ?? {}), ...change };
        return { version: ROMANCE_VERSION, people: { ...now.people, [key]: next } };
    };
    const same = { state: now, news: [], couple: false, changed: false };
    if (!key) return same;
    // La señal que se deja pasar: no vuelve hasta dentro de unos días.
    if (stage === 'senal' && !choice && (!entry || entry.status === 'pausa')) {
        return { state: put({ status: 'pausa', step: 0, since: Math.max(0, Math.floor(Number(day) || 0)) }), news: [], couple: false, changed: true };
    }
    if (!choice) return same;
    if (choice === 'amigos') {
        return { state: put({ status: 'amigos' }), news: [`${who} y tú lo dejáis en amistad. No volverá a salir.`], couple: false, changed: true };
    }
    if (stage === 'senal') {
        if (entry && entry.status !== 'pausa') return same;
        if (!allowed) return { state: put({ status: 'no' }), news: [`${who} te ha dicho que no, con cariño. Entre vosotros, todo sigue como antes.`], couple: false, changed: true };
        return {
            state: put({ status: 'citas', step: 0, since: Math.max(0, Math.floor(Number(day) || 0)) }),
            news: [`${who} y tú empezáis algo. A partir de ahora, quedar con ${who} es una cita.`],
            couple: false,
            changed: true,
        };
    }
    if (stage === 'cita') {
        if (entry?.status !== 'citas' || entry.step >= DATES) return same;
        const step = entry.step + 1;
        const news = step < DATES
            ? `Una cita más con ${who}: van ${step} de ${DATES}.`
            : `Tercera cita con ${who}. La próxima vez que quedéis de noche, ${who} te esperará.`;
        return { state: put({ step }), news: [news], couple: false, changed: true };
    }
    if (stage === 'final') {
        if (entry?.status !== 'citas' || entry.step < DATES) return same;
        return {
            state: put({ status: 'pareja', step: DATES, since: Math.max(0, Math.floor(Number(day) || 0)) }),
            news: [`${text(name)} y tú sois pareja.`],
            couple: true,
            changed: true,
        };
    }
    return same;
}

/**
 * Cómo está, dicho corto, para junto al vínculo: vacío si no hay nada que decir.
 *
 * @param {RomanceEntry|null} entry
 * @returns {string}
 */
export function romanceLabel(entry) {
    const stage = stageOf(entry);
    if (stage === 'cita') return `Os estáis conociendo (${entry?.step ?? 0} de ${DATES} citas)`;
    if (stage === 'final') return 'Os estáis conociendo: os veréis de noche';
    if (stage === 'pareja') return 'Pareja';
    return '';
}

/**
 * Si quiere quedar contigo por el romance (el icono del pueblo), o null.
 *
 * @param {Object} input
 * @param {RomanceCard|null} input.card
 * @param {any} input.state
 * @param {string} input.name
 * @param {string} [input.slot]
 * @param {boolean} [input.on]
 * @returns {{wants: boolean, why: string}|null}
 */
export function romanceWants({ card, state, name, slot = '', on = true }) {
    if (!on || !card) return null;
    const stage = stageOf(romanceOf(state, name));
    const short = card.short || text(name).split(' ')[0];
    if (stage === 'cita') return { wants: true, why: `${short} te espera para vuestra cita.` };
    if (stage === 'final' && text(slot) === 'night') return { wants: true, why: `${short} quiere verte esta noche.` };
    return null;
}

// ---------------------------------------------------------------------------------------
// Lo que queda: las frases de pareja, el epílogo y el Salón de la fama.

/**
 * Una frase suya de pareja, para un rato juntos. Vacía si no tiene.
 *
 * @param {RomanceData} data
 * @param {any} name
 * @param {number} [turn] Cuál (se da la vuelta).
 * @returns {string}
 */
export function coupleNote(data, name, turn = 0) {
    const lines = data?.notes?.[keyOf(name)] ?? [];
    return lines.length > 0 ? lines[Math.abs(Math.floor(Number(turn) || 0)) % lines.length] : '';
}

/**
 * Un rato juntos con su frase de pareja delante.
 *
 * @template {{beats: Array<{note: string}>}} T
 * @param {T} scene
 * @param {string} note
 * @returns {T}
 */
export function withCoupleNote(scene, note) {
    if (!text(note) || !scene?.beats?.length) return scene;
    const [first, ...rest] = scene.beats;
    return { ...scene, beats: [{ ...first, note: [text(first.note), text(note)].filter(Boolean).join(' ') }, ...rest] };
}

/**
 * Rellena `{heroe}`, `{nombre}`, `{ending}` y `{day}`, y concuerda: el héroe, y los dos juntos
 * en plural (`{juntos|juntas}`: juntas solo si los dos son mujeres).
 *
 * @param {string} line
 * @param {{hero: any, partner: any, name: string, ending?: string, day?: number}} who
 * @returns {string}
 */
function fillCouple(line, { hero, partner, name, ending = '', day = 0 }) {
    const filled = text(line)
        .replaceAll('{heroe}', text(hero?.name) || 'Tu héroe')
        .replaceAll('{nombre}', text(name))
        .replaceAll('{ending}', text(ending) || 'el final')
        .replaceAll('{day}', String(Math.max(1, Math.floor(Number(day) || 1))));
    return resolveGender(filled, { heroe: hero, grupo: [hero, partner] });
}

/**
 * La línea de la pareja al final de una campaña, en «Qué fue de cada uno». `home`: si la
 * campaña sale del gremio y volvéis a él.
 *
 * @param {Object} input
 * @param {RomanceData} input.data
 * @param {string} input.name
 * @param {any} input.hero
 * @param {any} input.partner Su ficha (para su género).
 * @param {string} input.ending
 * @param {boolean} [input.home]
 * @returns {string}
 */
export function coupleEpilogue({ data, name, hero, partner, ending, home = false }) {
    const own = data?.epilogues?.[keyOf(name)];
    const line = (home ? own?.home : own?.away)
        || (home
            ? '{nombre} vuelve contigo al gremio. Después de «{ending}», seguís {juntos|juntas}, y ya nadie lo pregunta.'
            : '{nombre} se quedó a tu lado después de «{ending}». Seguís {juntos|juntas}.');
    return fillCouple(line, { hero, partner, name, ending });
}

/**
 * La entrada del Salón de la fama para una pareja del gremio (`kind: 'couple'`): los dos
 * nombres y su línea.
 *
 * @param {Object} input
 * @param {RomanceData} input.data
 * @param {string} input.name
 * @param {any} input.hero
 * @param {any} input.partner
 * @param {string} input.world El gremio.
 * @param {number} input.day
 * @param {string} input.when
 * @returns {{kind: 'couple', name: string, world: string, day: number, when: string, epitaph: string}}
 */
export function coupleHallEntry({ data, name, hero, partner, world, day, when }) {
    const own = data?.epilogues?.[keyOf(name)]?.hall;
    const line = own || '{heroe} y {nombre}: {juntos|juntas} desde el día {day}.';
    return {
        kind: 'couple',
        name: `${text(hero?.name) || 'Tu héroe'} y ${text(name)}`,
        world: text(world),
        day: Math.max(1, Math.floor(Number(day) || 1)),
        when: text(when),
        epitaph: fillCouple(line, { hero, partner, name, day }),
    };
}
