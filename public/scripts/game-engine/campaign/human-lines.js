/**
 * Que la gente suene a gente (J13.8 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * Daniel, el 2026-09-30: «la humanización de los textos y reacciones». Jugando el prólogo se
 * veía la máquina por debajo:
 *
 * - **Brunilda decía «¿Otra vez tú?» seis veces en la misma charla**: cada vez que una opción
 *   («Gracias», «Lo siento») volvía al principio, salía la frase de quien vuelve otro día. Aquí
 *   está lo que se dice al volver al principio sin haberse ido (`followUpLine`): lo que escribe
 *   el paquete en el nudo (`more`) o, si no escribe nada, una frase corta de la tabla
 *   `charla-sigue` del compendio, según cómo te mire.
 * - **«Brunilda os mira mejor.»** tras cada opción, en plural aunque vayas solo y siempre igual.
 *   En la ventana se dice como lo diría alguien que mira (`humanNote`): «A Brunilda le ha
 *   gustado eso». En el Diario y en el libro sigue la línea llana, que es un registro.
 * - **Todos te saludaban por tu nombre** la primera vez, sin conocerte, y siempre con la misma
 *   frase. El saludo de quien atiende un sitio (`townGreeting`) sale ahora de la tabla `saludo`:
 *   distinto la primera vez («no te había visto por aquí») que cuando ya te conoce (y entonces
 *   sí, por tu nombre), según la hora y cómo te mire, con frases propias para la gente del
 *   gremio, y a veces fijándose en tu clase.
 * - **Las escenas no se acordaban de lo que acababas de hacer.** Una línea de escena puede traer
 *   otras versiones (`alt`), cada una con su condición: lo que elegiste antes (`chose`), tu
 *   clase, tu especie, tu género o tu pasado (`beatVariant`). La línea es la misma (el mismo
 *   sitio en la escena), con otras palabras.
 *
 * El banco de frases es el del compendio (`frases.json`): quien abre la partida lo pasa una vez
 * (`setPhraseBank`). Sin banco, cada cosa tiene unas pocas frases propias de reserva, para que
 * nunca falte qué decir.
 *
 * Puro: con el banco, el héroe y una semilla, frases. Quien llama guarda lo que haga falta.
 */

import { matches } from '../compendio/compendio.js';
import { resolveGender, genderOf } from './grammar.js';

/** Las clases de frase de esta capa, en `frases.json`. */
export const HUMAN_KINDS = ['charla-sigue', 'mirada-mejor', 'mirada-peor', 'saludo'];

/** Las condiciones que entiende una versión de una línea de escena (`alt[].if`). */
export const ALT_KEYS = ['chose', 'class', 'species', 'gender', 'background'];

/** Cómo se saluda a cada hora. */
const HELLO = { mañana: 'Buenos días', tarde: 'Buenas tardes', noche: 'Buenas noches', '': 'Hola' };

/**
 * Lo que se dice al volver al principio de una charla sin haberse ido, si no hay banco.
 * Corto y sin voz propia: vale para cualquiera.
 */
const FOLLOW_UPS = {
    buena: ['¿Algo más?', 'Tú dirás.', 'Sigue, sigue.', '¿Qué más te cuento?'],
    neutra: ['¿Algo más?', 'Tú dirás.', '¿Qué más?', 'Te escucho.'],
    mala: ['¿Qué más?', 'Abrevia.', '¿Algo más, o ya está?', 'Rápido.'],
};

/** Y lo que se dice cuando alguien te mira mejor o peor, si no hay banco. */
const LOOKS = {
    'mirada-mejor': ['{a_quien} le ha gustado eso.', '{quien} te mira con otros ojos.', 'Eso a {quien} le ha caído bien.'],
    'mirada-peor': ['{a_quien} no le ha gustado nada.', '{quien} tuerce el gesto. Se le nota.', 'Eso a {quien} le ha sentado mal.'],
};

/** @type {any[]} */
let bank = [];

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string} */
const fold = (value) => text(value).toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** @param {any} value @returns {boolean} */
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** @param {any} value @returns {string[]} */
const listOf = (value) => (Array.isArray(value) ? value : value == null ? [] : [value]).map(text).filter(Boolean);

/**
 * El banco de frases del compendio (las filas de `frases`). Se queda con las de esta capa.
 *
 * @param {any} rows
 */
export function setPhraseBank(rows) {
    bank = (Array.isArray(rows) ? rows : []).filter(row => HUMAN_KINDS.includes(text(row?.kind)));
}

/** @returns {any[]} Las filas de esta capa que hay ahora. */
export function phraseBank() {
    return bank;
}

/**
 * Un número estable para una semilla: la misma semilla, la misma frase.
 *
 * @param {string} seed
 * @returns {number}
 */
export function hashOf(seed) {
    let h = 2166136261;
    for (const ch of String(seed ?? '')) {
        h ^= ch.codePointAt(0) ?? 0;
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
}

/**
 * Cómo te mira alguien, en las tres bandas de las frases.
 *
 * @param {any} attitude De −3 a 3.
 * @returns {'buena'|'neutra'|'mala'}
 */
export function attitudeBand(attitude) {
    const n = Math.round(Number(attitude) || 0);
    return n >= 1 ? 'buena' : n <= -1 ? 'mala' : 'neutra';
}

/**
 * La franja del día como la escriben las frases: «mañana», «tarde», «noche».
 *
 * @param {any} slot Por su id (`night`) o por su nombre en el reloj («Noche»).
 * @returns {'mañana'|'tarde'|'noche'|''}
 */
export function hourOf(slot) {
    const said = fold(slot);
    if (/noche|night|madrugada/.test(said)) return 'noche';
    if (/tarde|afternoon|evening/.test(said)) return 'tarde';
    if (/manana|morning|alba|amanecer/.test(said)) return 'mañana';
    return '';
}

/**
 * «a Brunilda», «al Tuerto»: alguien detrás de «a», con la contracción.
 *
 * @param {string} name
 * @returns {string}
 */
export function toWhom(name) {
    const who = text(name);
    if (!who) return '';
    const article = who.match(/^el\s+(.+)$/i);
    return article ? `al ${article[1]}` : `a ${who}`;
}

/**
 * Rellenar una frase: sus huecos con los hechos y el género con quien juega. Si le falta algún
 * hueco, no vale (null). Empieza en mayúscula.
 *
 * @param {string} template
 * @param {Record<string, any>} facts
 * @param {any} [who] Para el género: `{heroe, grupo}`.
 * @returns {string|null}
 */
export function fillLine(template, facts, who = {}) {
    let missing = false;
    const out = String(template ?? '').replace(/\{([a-z_]+)\}/g, (all, key) => {
        const value = text(facts?.[key]);
        if (!value) missing = true;
        return value;
    });
    if (missing) return null;
    const clean = resolveGender(out, who).replace(/\s+/g, ' ').trim();
    return clean ? clean[0].toLocaleUpperCase('es') + clean.slice(1) : null;
}

/**
 * Una frase del banco para unos hechos, elegida por la semilla. Las que dicen para quién son
 * (`when.quien`) pesan lo que diga su `weight`, como las demás: así una persona con frases
 * propias las dice casi siempre, pero no siempre.
 *
 * @param {string} kind
 * @param {Record<string, any>} facts Las condiciones (`servicio`, `hora`…) y los huecos.
 * @param {Object} [input]
 * @param {string} [input.seed]
 * @param {number} [input.turn] Cuántas veces se ha elegido ya con esta semilla: va por turno, sin repetir hasta acabar.
 * @param {any} [input.who] Para el género.
 * @param {any[]} [input.rows] Otro banco (para las pruebas).
 * @returns {string}
 */
export function pickPhrase(kind, facts, { seed = '', turn = 0, who = {}, rows = bank } = {}) {
    const usable = (Array.isArray(rows) ? rows : [])
        .filter(row => text(row?.kind) === kind && matches(row, conditionsOf(facts)))
        .map(row => ({ row, line: fillLine(row.text, facts, who) }))
        .filter(/** @returns {option is {row: any, line: string}} */ option => option.line !== null);
    if (usable.length === 0) return '';
    /** @type {Map<string, number>} */
    const weights = new Map();
    for (const option of usable) {
        const weight = Math.max(1, Math.min(6, Math.round(Number(option.row.weight ?? 1)) || 1));
        weights.set(option.line, (weights.get(option.line) ?? 0) + weight);
    }
    return inTurn([...weights].map(([line, weight]) => ({ line, weight })), seed, turn);
}

/** Cuántos turnos tienen que pasar, como mucho, para que vuelva a salir la misma frase. */
const GAP = 3;

/**
 * La frase de un turno, por turnos desde un sitio que da la semilla: las de más peso salen más
 * veces (un reparto por pesos «suave», sin rachas), y ninguna vuelve a salir en los tres turnos
 * siguientes si hay otras. Sin estado: el turno se calcula desde el principio.
 *
 * @param {Array<{line: string, weight: number}>} options
 * @param {string} seed
 * @param {number} turn
 * @returns {string}
 */
function inTurn(options, seed, turn) {
    const n = options.length;
    const start = hashOf(seed) % n;
    const list = options.map((_, i) => options[(start + i) % n]);
    const total = list.reduce((sum, option) => sum + option.weight, 0);
    const credit = list.map(() => 0);
    const gap = Math.min(GAP, n - 1);
    /** @type {number[]} */
    const recent = [];
    let picked = 0;
    const last = Math.min(5000, Math.max(0, Math.floor(Number(turn) || 0)));
    for (let step = 0; step <= last; step++) {
        list.forEach((option, i) => { credit[i] += option.weight; });
        let best = -1;
        for (let i = 0; i < n; i++) {
            if (recent.includes(i)) continue;
            if (best < 0 || credit[i] > credit[best]) best = i;
        }
        credit[best] -= total;
        recent.push(best);
        if (recent.length > gap) recent.shift();
        picked = best;
    }
    return list[picked].line;
}

/**
 * Las condiciones de unos hechos: lo que filtra filas, sin los huecos que son texto libre.
 *
 * @param {Record<string, any>} facts
 * @returns {Record<string, any>}
 */
function conditionsOf(facts) {
    const out = { ...facts };
    for (const key of ['nombre', 'hola', 'a_quien', 'quien']) delete out[key];
    return out;
}

/**
 * Lo que dice alguien al volver al principio de una charla sin haberse ido: lo escrito en el
 * nudo (`more`, por turnos) o una frase de `charla-sigue` según cómo te mire.
 *
 * @param {Object} input
 * @param {string[]} [input.more] Lo que escribe el paquete para ese nudo.
 * @param {any} [input.attitude]
 * @param {string} [input.seed] La charla, para que cada una empiece en un sitio.
 * @param {number} [input.turn] Cuántas veces se ha vuelto ya en esta charla.
 * @param {any} [input.who] Para el género.
 * @returns {string}
 */
export function followUpLine({ more = [], attitude = 0, seed = '', turn = 0, who = {} } = {}) {
    const written = listOf(more);
    if (written.length > 0) return resolveGender(written[(hashOf(seed) + turn) % written.length], who);
    const band = attitudeBand(attitude);
    return pickPhrase('charla-sigue', { actitud: band }, { seed, turn, who })
        || FOLLOW_UPS[band][(hashOf(seed) + turn) % FOLLOW_UPS[band].length];
}

/**
 * Una nota de la ventana dicha como la diría quien mira: «Brunilda os mira mejor.» pasa a ser
 * «A Brunilda le ha gustado eso.» (o una de sus hermanas). Lo demás, tal cual.
 *
 * @param {string} note
 * @param {Object} [input]
 * @param {string} [input.seed]
 * @param {number} [input.turn]
 * @returns {string}
 */
export function humanNote(note, { seed = '', turn = 0 } = {}) {
    const said = text(note);
    const look = said.match(/^(.+?) os mira (mejor|peor)\.$/);
    if (!look) return said;
    const kind = look[2] === 'mejor' ? 'mirada-mejor' : 'mirada-peor';
    const facts = { quien: look[1], a_quien: toWhom(look[1]) };
    const key = `${seed}|${look[1]}`;
    return pickPhrase(kind, facts, { seed: key, turn })
        || fillLine(LOOKS[kind][(hashOf(key) + turn) % LOOKS[kind].length], facts)
        || said;
}

/**
 * @typedef {Object} GreetEntry Lo que recuerda quien atiende un sitio de tus visitas.
 * @property {string} first La primera vez que te vio: «día|franja».
 * @property {string} last La última.
 * @property {number} visits Cuántas veces distintas (días o franjas) has entrado.
 */

/**
 * Lo que se guarda de los saludos (`greetings` en la partida), por persona.
 *
 * @param {any} raw
 * @returns {Record<string, GreetEntry>}
 */
export function readGreetMemory(raw) {
    /** @type {Record<string, GreetEntry>} */
    const out = {};
    for (const [key, entry] of Object.entries(isObject(raw) ? raw : {})) {
        if (!fold(key) || !isObject(entry) || !text(entry.first)) continue;
        out[fold(key)] = {
            first: text(entry.first),
            last: text(entry.last) || text(entry.first),
            visits: Math.max(1, Math.floor(Number(entry.visits) || 1)),
        };
    }
    return out;
}

/**
 * Apuntar que has entrado donde está alguien, hoy a esta hora. Volver a pintar el mismo sitio
 * en la misma franja no cuenta como otra visita.
 *
 * @param {any} memory
 * @param {string} keeper
 * @param {string} stamp «día|franja».
 * @returns {Record<string, GreetEntry>}
 */
export function noteGreeting(memory, keeper, stamp) {
    const all = readGreetMemory(memory);
    const key = fold(keeper);
    const now = text(stamp);
    if (!key || !now) return all;
    const was = all[key];
    if (!was) return { ...all, [key]: { first: now, last: now, visits: 1 } };
    if (was.last === now) return all;
    return { ...all, [key]: { ...was, last: now, visits: was.visits + 1 } };
}

/**
 * Si alguien ya te conoce: te vio otro día u otra franja, o ya os habíais cruzado en la
 * historia (`before`). La primera visita sigue siendo la primera mientras dure esa franja.
 *
 * @param {any} memory
 * @param {string} keeper
 * @param {string} stamp
 * @param {boolean} [before]
 * @returns {boolean}
 */
export function knowsYou(memory, keeper, stamp, before = false) {
    if (before) return true;
    const was = readGreetMemory(memory)[fold(keeper)];
    return Boolean(was) && was.first !== text(stamp);
}

/**
 * El saludo de quien atiende un sitio, de la tabla `saludo`: por la clase de sitio
 * (`servicio`), la primera vez o no (`primera`), la hora, cómo te mira (`actitud`), quién es
 * (sus frases propias: `persona`) y, la primera vez, tu clase (`clase`). Huecos: `{quien}`,
 * `{hola}` («Buenas tardes») y `{nombre}` (el tuyo: solo vale cuando ya te conoce).
 * Vacío si no hay frase o no atiende nadie: entonces vale el de siempre (`greetingFor`).
 *
 * @param {Object} input
 * @param {any} input.place El sitio (`TownPlace`), con su clase y quien lo atiende.
 * @param {string} [input.slot] La franja, por su id o por su nombre.
 * @param {any} [input.hero] Tu héroe: su nombre (solo si ya te conoce), su clase y su género.
 * @param {boolean} [input.met] Si ya te conoce.
 * @param {any} [input.attitude] Cómo te mira.
 * @param {string} [input.who] Cómo se le llama en la frase (su nombre, o lo que es si aún no lo sabes).
 * @param {string} [input.seed]
 * @param {number} [input.turn] Las visitas: cada una, otra frase.
 * @param {any[]} [input.rows]
 * @returns {string}
 */
export function townGreeting({ place, slot = '', hero = null, met = false, attitude = 0, who = '', seed = '', turn = 0, rows = bank }) {
    const keeper = text(place?.keeper?.name);
    if (!keeper || place?.closed) return '';
    const hora = hourOf(slot);
    const name = text(hero?.name ?? (typeof hero === 'string' ? hero : ''));
    const facts = {
        servicio: text(place?.kind),
        primera: met ? 'no' : 'sí',
        actitud: attitudeBand(attitude),
        ...(hora ? { hora } : {}),
        // Quién es (sus frases propias dicen `when.persona`), y cómo se le nombra en la frase.
        persona: keeper,
        quien: text(who) || keeper,
        // Como la escriban las frases: «Pícara» vale para la de «Pícaro».
        clase: spelledAs(hero?.class ?? hero?.className ?? hero?.charClass, 'clase', rows),
        hola: HELLO[hora],
        // Tu nombre solo lo dice quien ya te conoce.
        nombre: met ? name : '',
    };
    return pickPhrase('saludo', facts, { seed: `${seed}|${keeper}`, turn, who: { heroe: hero ?? '' }, rows });
}

/**
 * Una clase (o lo que sea) como la escribe alguna frase del banco, comparando por la raíz:
 * «Pícara» sale como «Pícaro» si es así como la escriben las frases. Si ninguna la escribe, tal cual.
 *
 * @param {any} value
 * @param {string} key La condición (`clase`).
 * @param {any[]} rows
 * @returns {string}
 */
function spelledAs(value, key, rows) {
    const wanted = stem(value);
    if (!wanted) return '';
    for (const row of Array.isArray(rows) ? rows : []) {
        const found = listOf(row?.when?.[key]).find(written => stem(written) === wanted);
        if (found) return found;
    }
    return text(value);
}

/** Cuántas elecciones de escena se recuerdan (las más viejas se olvidan). */
export const CHOICES_LIMIT = 200;

/**
 * Lo elegido en las escenas del hilo, como se guarda: ids de opción, una vez cada uno.
 *
 * @param {any} raw
 * @returns {string[]}
 */
export function readChoices(raw) {
    return [...new Set(listOf(Array.isArray(raw) ? raw : []))].slice(-CHOICES_LIMIT);
}

/**
 * Apuntar lo elegido en una escena.
 *
 * @param {any} before
 * @param {any} ids
 * @returns {string[]}
 */
export function rememberChoices(before, ids) {
    return readChoices([...readChoices(before), ...listOf(Array.isArray(ids) ? ids : [ids])]);
}

/**
 * La raíz de una clase o una especie, para comparar «Clériga» con «Clérigo».
 *
 * @param {any} value
 * @returns {string}
 */
function stem(value) {
    return fold(value).replace(/^raza[-\s]+/, '').split(/[^a-z0-9ñ]+/).filter(Boolean)
        .map(word => (word.length > 3 ? word.replace(/[ao]s?$/, '') : word)).join(' ');
}

/**
 * Si una versión de una línea vale para quien juega y lo que ha elegido.
 *
 * @param {any} condition `{chose, class, species, gender, background}`; todo lo escrito se tiene que cumplir.
 * @param {{hero?: any, chose?: string[]}} facts
 * @returns {boolean}
 */
export function altMatches(condition, { hero = null, chose = [] } = {}) {
    if (!isObject(condition)) return false;
    if (condition.chose !== undefined) {
        const wanted = listOf(condition.chose);
        if (!wanted.some(id => listOf(chose).includes(id))) return false;
    }
    if (condition.class !== undefined) {
        const cls = stem(hero?.class ?? hero?.className ?? hero?.charClass);
        if (!cls || !listOf(condition.class).some(c => stem(c) === cls)) return false;
    }
    if (condition.species !== undefined) {
        const race = stem(hero?.race);
        if (!race || !listOf(condition.species).some(s => stem(s) === race)) return false;
    }
    if (condition.gender !== undefined && genderOf(condition.gender) !== genderOf(hero?.gender)) return false;
    if (condition.background !== undefined) {
        const bg = stem(hero?.background);
        if (!bg || !listOf(condition.background).some(b => stem(b) === bg)) return false;
    }
    return true;
}

/**
 * Una línea de escena con su versión para quien juega: la primera de `alt` cuya condición se
 * cumple pone su texto (y su gesto y quién lo dice, si los trae). Sin `alt`, o sin ninguna que
 * valga, la línea tal cual. La decisión de la línea (sus opciones) no cambia.
 *
 * @param {any} raw La línea, tal como viene en el paquete.
 * @param {{hero?: any, chose?: string[]}} [facts]
 * @returns {any}
 */
export function beatVariant(raw, facts = {}) {
    if (!isObject(raw) || !Array.isArray(raw.alt)) return raw;
    const found = raw.alt.find((/** @type {any} */ alt) => isObject(alt) && text(alt.text) && altMatches(alt.if, facts));
    if (!found) return raw;
    return {
        ...raw,
        text: text(found.text),
        ...(found.mood !== undefined ? { mood: found.mood } : {}),
        ...(found.who !== undefined ? { who: found.who } : {}),
    };
}

/**
 * Lo que está mal escrito en las versiones de una línea de escena (`alt`): sin texto, sin
 * condición o con una que no se entiende.
 *
 * @param {any} alt
 * @param {string} path
 * @returns {{errors: Array<{path: string, message: string}>, warnings: Array<{path: string, message: string}>}}
 */
export function checkBeatAlts(alt, path) {
    /** @type {Array<{path: string, message: string}>} */
    const errors = [];
    /** @type {Array<{path: string, message: string}>} */
    const warnings = [];
    if (alt === undefined) return { errors, warnings };
    if (!Array.isArray(alt)) {
        errors.push({ path, message: '`alt` es una lista de versiones: {"if": {…}, "text": "…"}.' });
        return { errors, warnings };
    }
    alt.forEach((entry, i) => {
        const where = `${path}[${i}]`;
        if (!isObject(entry) || !text(entry.text)) {
            errors.push({ path: where, message: 'Cada versión necesita su `text`.' });
            return;
        }
        if (!isObject(entry.if)) {
            errors.push({ path: `${where}.if`, message: 'Cada versión dice cuándo vale (`if`): sin condición, escríbela como la línea.' });
            return;
        }
        for (const key of Object.keys(entry.if)) {
            if (!ALT_KEYS.includes(key)) warnings.push({ path: `${where}.if.${key}`, message: `"${key}" no es una condición de versión: se ignora. Las que hay: ${ALT_KEYS.join(', ')}.` });
        }
    });
    return { errors, warnings };
}
