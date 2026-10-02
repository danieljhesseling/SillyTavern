/**
 * Las peleas de taberna y los duelos (J12.7 de wiki/ROADMAP_SIN_CONEXION.md), fuera del
 * tablero: quién te busca pelea, a quién se reta, qué se ofrece en la taberna y qué se gana o se
 * pierde al acabar.
 *
 * - **La pelea de taberna**: a veces, por la tarde o por la noche, alguien te busca pelea; y tú
 *   puedes armarla. Se pelea en un tablero de taberna, a puñetazos, y nadie muere.
 * - **El duelo por dinero**: contra el campeón de la taberna, uno contra uno, con 5, 10 o 25 de
 *   oro en la mesa. Quien pierde (o se rinde) paga.
 * - **El duelo por honor**: alguien con nombre al que has amenazado y no se asusta te reta. Lo
 *   que se juega es lo que se dice de ti en el pueblo (la fama de la localización).
 *
 * La regla de la pelea (nadie muere, puños, sin magia que hiere) y el tablero están en
 * `combat/brawl.js`. Lo escrito (los camorristas, los campeones, quien reta y lo que se lee) está
 * en `compendio/peleas.json`; sin el archivo, valen las frases de aquí.
 *
 * Puro: quien llama tira los dados, cobra, guarda y enseña.
 */

import { resolveGender } from './grammar.js';
import { STAKES, FURNITURE_PRICE } from '../combat/brawl.js';

/** En los metadatos de la partida: lo que ha pasado en las tabernas (camorristas, duelos, retos). */
export const BRAWLS_KEY = 'tavernBrawls';

/** Cuántas cosas se recuerdan. */
export const BRAWL_LOG_MAX = 40;

/** La probabilidad de que alguien te busque pelea en una franja de tarde o de noche. */
export const ROWDY_CHANCE = 0.35;

/** El posadero se harta a la segunda pelea que armas en su taberna… */
export const FED_UP_AFTER = 2;

/** …en estos días, y durante estos días no te deja armar otra. */
export const FED_UP_DAYS = 7;

/** Lo que cuesta calmar a un camorrista hablando (Persuasión). */
export const CALM_DC = 13;

/** Lo que cuesta una ronda para quien te busca pelea y sus amigos. */
export const ROUND_PRICE = 2;

/** Lo que cuesta, por cabeza de los de enfrente, acabar una pelea a medias pagando una ronda. */
export const PEACE_PRICE = 2;

/** Lo que se gana o se pierde de fama en la localización en un duelo por honor. */
export const HONOR_FAME = { gana: 2, pierde: -1, rinde: -1, rechaza: -1 };

/** Las franjas en las que hay ambiente en la taberna. Por la mañana está casi vacía. */
const LIVELY = ['afternoon', 'night'];

/** Los oficios de quien no se deja amenazar y contesta con un reto. */
const TOUGH = /guardia|soldad|mercenari|cazador|herrer|capit[aá]n|marinero|pescador|estibador|le[ñn]ador|caballero|mat[oó]n|sargento|teniente|vanguardia|comandante|jefe|guerrer|luchador|carnicer|vistani|bandid|contrabandist/i;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string} */
const fold = (value) => text(value).toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** @param {any} value @returns {boolean} */
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** @param {any} value @returns {string[]} */
const listOf = (value) => (Array.isArray(value) ? value : value == null ? [] : [value]).map(text).filter(Boolean);

// ---------------------------------------------------------------------------------------
// Lo escrito

/**
 * @typedef {Object} Fighter Alguien escrito en `peleas.json`: un camorrista, un campeón o quien reta.
 * @property {string} id
 * @property {'camorrista'|'campeon'|'retador'} kind
 * @property {string} name
 * @property {string} archetype Su dibujo en el tablero (`bestias/<arquetipo>.png`), o vacío.
 * @property {string} town Dónde está (un campeón), o vacío.
 * @property {string} opens Lo que pasa cuando aparece (provoca, reta).
 * @property {string} says Lo que dice.
 * @property {string} wins Lo que pasa si te gana.
 * @property {string} loses Lo que pasa si le ganas.
 */

/**
 * @typedef {Object} FightRows Lo escrito, leído.
 * @property {Fighter[]} rowdies
 * @property {Fighter[]} champions
 * @property {Fighter[]} challengers
 * @property {Record<string, string[]>} lines Lo que se lee en cada momento.
 */

/** Lo de siempre, si no hay `peleas.json`: dos camorristas, un campeón y las frases. */
const DEFAULT_ROWS = [
    {
        id: 'bruno-el-tuerto', kind: 'camorrista', name: 'Bruno el Tuerto', arquetipo: 'cunado-de-lope',
        provoca: 'Bruno el Tuerto se levanta de su mesa con la jarra en la mano y te la vacía en las botas.',
        dice: '«¿Y tú qué miras, {forastero|forastera}? Aquí se bebe y se calla. O se pelea.»',
        gana: 'Bruno vuelve a su mesa resoplando.', pierde: 'Bruno se queda en el suelo, entre serrín y cerveza.',
    },
    {
        id: 'mateo-nudillos', kind: 'camorrista', name: 'Mateo Nudillos', arquetipo: 'bestia-bandido',
        provoca: 'Mateo Nudillos hace crujir los dedos mientras te mira.',
        dice: '«Me aburro. Y cuando me aburro, alguien acaba en el suelo.»',
        gana: 'Mateo se sopla los nudillos y se va a la barra.', pierde: 'Mateo se queda mirando el techo.',
    },
    {
        id: 'osvaldo-el-toro', kind: 'campeon', name: 'Osvaldo el Toro', arquetipo: 'cunado-de-lope',
        reta: 'Osvaldo el Toro ocupa él solo un banco entero.', dice: '«Me llaman el Toro. Apuesta lo que quieras.»',
        gana: 'Osvaldo se guarda tu oro sin contarlo.', pierde: 'Osvaldo te paga sin rechistar.',
    },
];

/** Las frases de cada momento, si `peleas.json` no trae las suyas. */
const DEFAULT_LINES = {
    'armar': ['Le das un empujón a la mesa de {quien}. Las jarras caen, y su mesa entera se levanta a la vez.'],
    'calmar-bien': ['{quien} baja el puño, gruñe algo y vuelve a su mesa.'],
    'calmar-mal': ['{quien} no te deja acabar la frase: la mesa vuela, y sus amigos ya vienen.'],
    'ronda': ['Una ronda para su mesa arregla lo que las palabras no arreglan. Hoy no hay pelea.'],
    'irse': ['Te apartas a otra mesa. {quien} se ríe un rato y luego se olvida de ti.'],
    'gana-taberna': ['El último se queda en el suelo y la taberna estalla en gritos.'],
    'pierde-taberna': ['Te despiertas en el suelo con la boca llena de serrín. La bolsa pesa menos que antes.'],
    'rinde-taberna': ['Levantas las manos. {quien} se ríe y pide una ronda que pagas tú.'],
    'paz-taberna': ['Pides una ronda para todos. Los puños bajan, las jarras suben, y la pelea se acaba.'],
    'gana-apuesta': ['{quien} te da los {oro} de oro que había en la mesa.'],
    'pierde-apuesta': ['Los {oro} de oro de la mesa son de {quien}.'],
    'rinde-apuesta': ['Dices basta. {quien} se queda los {oro} de oro: rendirse también es perder.'],
    'gana-honor': ['Antes de que anochezca, todo {pueblo} sabe que {heroe} tumbó a {quien} en un duelo limpio.'],
    'pierde-honor': ['En {pueblo} se cuenta que {quien} te dio una lección.'],
    'rechaza-honor': ['Te das la vuelta. La gente que lo ha visto lo contará en {pueblo}.'],
    'posadero-cobra': ['{posadero} cuenta lo roto: {muebles}. Te lo cobra antes de que te levantes.'],
    'posadero-harto': ['{posadero} te para con la mano: «Aquí ya se han roto bastantes sillas por tu culpa. Ni una pelea más en unos días.»'],
};

/**
 * Lo escrito en `peleas.json`, leído. Sin filas (sin el archivo), lo de siempre.
 *
 * @param {any} rows
 * @returns {FightRows}
 */
export function readFightRows(rows) {
    const list = (Array.isArray(rows) && rows.length > 0 ? rows : DEFAULT_ROWS).filter(isObject);
    /** @type {Fighter[]} */
    const fighters = list
        .filter(row => ['camorrista', 'campeon', 'retador'].includes(text(row.kind)) && text(row.name))
        .map(row => ({
            id: text(row.id) || fold(row.name).replace(/[^a-z0-9]+/g, '-'),
            kind: /** @type {'camorrista'|'campeon'|'retador'} */ (text(row.kind)),
            name: text(row.name),
            archetype: text(row.arquetipo ?? row.archetype),
            town: text(row.en),
            opens: text(row.provoca ?? row.reta),
            says: text(row.dice),
            wins: text(row.gana),
            loses: text(row.pierde),
        }));
    /** @type {Record<string, string[]>} */
    const lines = Object.fromEntries(Object.entries(DEFAULT_LINES).map(([k, v]) => [k, [...v]]));
    /** @type {Record<string, string[]>} */
    const written = {};
    for (const row of list.filter(r => text(r.kind) === 'frase' && text(r.momento))) {
        const moment = text(row.momento);
        written[moment] = [...(written[moment] ?? []), ...listOf(row.texto)];
    }
    for (const [moment, said] of Object.entries(written)) if (said.length > 0) lines[moment] = said;
    const rowdies = fighters.filter(f => f.kind === 'camorrista');
    const champions = fighters.filter(f => f.kind === 'campeon');
    return {
        // Sin camorristas o sin campeón escritos, los de siempre: la taberna nunca se queda sin gente.
        rowdies: rowdies.length > 0 ? rowdies : readFightRows(DEFAULT_ROWS).rowdies,
        champions: champions.length > 0 ? champions : readFightRows(DEFAULT_ROWS).champions,
        challengers: fighters.filter(f => f.kind === 'retador'),
        lines,
    };
}

/**
 * Una frase de un momento, con sus huecos y el género de quien juega.
 *
 * @param {FightRows} rows
 * @param {string} moment
 * @param {{heroe?: any, quien?: string, pueblo?: string, taberna?: string, posadero?: string, oro?: number, muebles?: string}} facts
 * @param {() => number} [random]
 * @returns {string}
 */
export function fightLine(rows, moment, facts = {}, random = Math.random) {
    const said = rows?.lines?.[moment] ?? DEFAULT_LINES[/** @type {keyof typeof DEFAULT_LINES} */ (moment)] ?? [];
    if (said.length === 0) return '';
    const pick = said[Math.floor(random() * said.length) % said.length];
    return fillLine(pick, facts);
}

/**
 * Los huecos de una línea escrita.
 *
 * @param {string} line
 * @param {{heroe?: any, quien?: string, pueblo?: string, taberna?: string, posadero?: string, oro?: number, muebles?: string}} facts
 * @returns {string}
 */
export function fillLine(line, facts = {}) {
    const hero = facts.heroe;
    const heroName = text(isObject(hero) ? hero.name : hero) || 'tu héroe';
    const filled = text(line)
        .replace(/\{heroe\}/g, heroName)
        .replace(/\{quien\}/g, text(facts.quien) || 'tu rival')
        .replace(/\{pueblo\}/g, text(facts.pueblo) || 'el pueblo')
        .replace(/\{taberna\}/g, text(facts.taberna) || 'la taberna')
        .replace(/\{posadero\}/g, text(facts.posadero) || 'El posadero')
        .replace(/\{oro\}/g, String(Math.max(0, Math.floor(Number(facts.oro) || 0))))
        .replace(/\{muebles\}/g, text(facts.muebles) || 'nada');
    return resolveGender(filled, { heroe: isObject(hero) ? hero : '' }).replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------------------
// Lo que ha pasado

/**
 * @typedef {Object} BrawlEvent
 * @property {string} town
 * @property {number} day
 * @property {string} slot `morning`, `afternoon` o `night`.
 * @property {'camorra'|'armada'|'duelo'|'honor'} what `camorra`: alguien te buscó pelea y ya
 *   se resolvió (peleando, hablando, pagando o yéndote); `armada`: la empezaste tú; `duelo`: uno
 *   por dinero; `honor`: un reto por honor, aceptado o no.
 * @property {string} who Con quién.
 */

/**
 * Lo guardado, con forma aunque llegue roto.
 *
 * @param {any} raw
 * @returns {{events: BrawlEvent[]}}
 */
export function readBrawlLog(raw) {
    const events = (Array.isArray(raw?.events) ? raw.events : [])
        .filter(isObject)
        .filter(e => ['camorra', 'armada', 'duelo', 'honor'].includes(text(e.what)) && text(e.town))
        .map(e => ({
            town: text(e.town),
            day: Math.max(1, Math.floor(Number(e.day) || 1)),
            slot: text(e.slot),
            what: /** @type {BrawlEvent['what']} */ (text(e.what)),
            who: text(e.who),
        }));
    return { events: events.slice(-BRAWL_LOG_MAX) };
}

/**
 * Apuntar algo.
 *
 * @param {any} raw
 * @param {{town: string, day: number, slot?: string, what: BrawlEvent['what'], who?: string}} event
 * @returns {{events: BrawlEvent[]}}
 */
export function noteBrawl(raw, event) {
    const log = readBrawlLog(raw);
    const [clean] = readBrawlLog({ events: [event] }).events;
    return clean ? { events: [...log.events, clean].slice(-BRAWL_LOG_MAX) } : log;
}

/**
 * @param {BrawlEvent} event
 * @param {string} town
 * @returns {boolean}
 */
const here = (event, town) => fold(event.town) === fold(town);

/**
 * Hasta qué día el posadero no deja armar otra pelea: a la segunda que armas en su taberna en
 * una semana. 0 si te deja.
 *
 * @param {any} raw
 * @param {string} town
 * @param {number} today
 * @returns {number}
 */
export function fedUpUntil(raw, town, today) {
    const now = Math.max(1, Math.floor(Number(today) || 1));
    const started = readBrawlLog(raw).events.filter(e => e.what === 'armada' && here(e, town) && now - e.day < FED_UP_DAYS);
    if (started.length < FED_UP_AFTER) return 0;
    return Math.max(...started.map(e => e.day)) + FED_UP_DAYS;
}

/**
 * Si algo ya pasó hoy aquí (y, si se dice, en esta franja o con esta persona).
 *
 * @param {any} raw
 * @param {{town: string, day: number, what: BrawlEvent['what'], slot?: string, who?: string}} query
 * @returns {boolean}
 */
export function happened(raw, { town, day, what, slot = '', who = '' }) {
    return readBrawlLog(raw).events.some(e => e.what === what && here(e, town) && e.day === Math.floor(Number(day) || 0)
        && (!slot || e.slot === slot) && (!who || fold(e.who) === fold(who)));
}

/**
 * Si quien reta por honor ya te retó hace poco (no lo repite en una semana).
 *
 * @param {any} raw
 * @param {string} who
 * @param {number} today
 * @returns {boolean}
 */
export function challengedLately(raw, who, today) {
    const now = Math.max(1, Math.floor(Number(today) || 1));
    return readBrawlLog(raw).events.some(e => e.what === 'honor' && fold(e.who) === fold(who) && now - e.day < FED_UP_DAYS);
}

// ---------------------------------------------------------------------------------------
// Quién hay en la taberna

/**
 * Si alguien te busca pelea ahora: por la tarde o por la noche, en una taberna, con su suerte
 * (la de la semilla de la partida, la localización, el día y la franja: el mismo camorrista toda
 * la franja), y si no se ha resuelto ya.
 *
 * @param {Object} input
 * @param {FightRows} input.rows
 * @param {() => number} input.random La suerte de esta franja aquí (sembrada).
 * @param {string} input.town
 * @param {number} input.day
 * @param {string} input.slot
 * @param {any} input.log
 * @returns {Fighter|null}
 */
export function rowdyNow({ rows, random, town, day, slot, log }) {
    if (!LIVELY.includes(text(slot)) || !text(town)) return null;
    if (happened(log, { town, day, what: 'camorra', slot }) || happened(log, { town, day, what: 'armada', slot })) return null;
    if (random() >= ROWDY_CHANCE) return null;
    const list = rows.rowdies;
    return list.length > 0 ? list[Math.floor(random() * list.length) % list.length] : null;
}

/**
 * El campeón de una taberna: el suyo, si lo tiene escrito; si no, uno de los de cualquier sitio,
 * siempre el mismo para la misma localización (la suerte es la de la semilla y el sitio).
 *
 * @param {FightRows} rows
 * @param {string} town
 * @param {() => number} random
 * @returns {Fighter|null}
 */
export function championOf(rows, town, random) {
    const own = rows.champions.find(c => c.town && fold(c.town) === fold(town));
    if (own) return own;
    const loose = rows.champions.filter(c => !c.town);
    const list = loose.length > 0 ? loose : rows.champions;
    return list.length > 0 ? list[Math.floor(random() * list.length) % list.length] : null;
}

/**
 * Los de enfrente en una pelea de taberna: quien la empieza (o con quien la armas) y sus amigos,
 * de los otros camorristas escritos. Si no hay bastantes, «Un amigo de…».
 *
 * @param {FightRows} rows
 * @param {Fighter} first
 * @param {number} count
 * @param {() => number} random
 * @returns {Array<{name: string, archetype: string}>}
 */
export function rowdyBand(rows, first, count, random) {
    const others = rows.rowdies.filter(r => r.id !== first.id);
    // Barajar con la suerte de la franja.
    const deck = [...others];
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1)) % (i + 1);
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    const band = [{ name: first.name, archetype: first.archetype }];
    for (let i = 1; i < Math.max(1, Math.floor(Number(count) || 1)); i++) {
        const mate = deck[i - 1];
        band.push(mate ? { name: mate.name, archetype: mate.archetype } : { name: `Un amigo de ${first.name}`, archetype: first.archetype });
    }
    return band;
}

/**
 * @typedef {Object} TavernAction Una acción de la tarjeta de la taberna, como las de `services.js`.
 * @property {string} id
 * @property {string} label
 * @property {string} detail
 * @property {boolean} enabled
 * @property {number} cost Siempre 0: lo que cuesta se paga al acabar.
 * @property {string} [target]
 */

/**
 * Lo que se puede hacer en la taberna: atender a quien te busca pelea, armarla tú o retar al
 * campeón por dinero. Lo que no se puede sale apagado, con el porqué.
 *
 * @param {Object} input
 * @param {Fighter|null} input.rowdy Quien te busca pelea ahora, si hay alguien.
 * @param {Fighter|null} input.champion
 * @param {string} input.town
 * @param {number} input.day
 * @param {string} input.slot
 * @param {any} input.log
 * @param {number} input.purse
 * @param {boolean} input.fighting
 * @param {boolean} input.heroUp Si quien juega se tiene en pie.
 * @param {string} [input.keeper] Quien lleva la taberna.
 * @returns {TavernAction[]}
 */
export function tavernActions({ rowdy, champion, town, day, slot, log, purse, fighting, heroUp, keeper = '' }) {
    const lively = LIVELY.includes(text(slot));
    const blocked = fighting ? 'No mientras peleáis.' : !heroUp ? 'Hace falta tenerse en pie.' : '';
    /** @type {TavernAction[]} */
    const out = [];
    if (rowdy) {
        out.push({
            id: 'brawl-rowdy', label: `${rowdy.name} te busca pelea`,
            detail: blocked || 'Puedes pelear, calmarle hablando, invitarle a una ronda o irte. Si se pelea, es a puñetazos: nadie muere.',
            enabled: !blocked, cost: 0, target: rowdy.id,
        });
    }
    const fedUp = fedUpUntil(log, town, day);
    const startedNow = happened(log, { town, day, what: 'armada', slot });
    out.push({
        id: 'brawl-start', label: 'Armar una pelea',
        detail: blocked
            || (!lively ? 'Por la mañana la taberna está casi vacía: no hay con quién.'
                : fedUp ? `${text(keeper) || 'El posadero'} no quiere más peleas aquí hasta el día ${fedUp}.`
                    : startedNow ? 'Ya has armado una esta franja.'
                        : 'Empiezas tú. A puñetazos y sin muertes; lo que se rompa lo pagas tú, y al posadero no le hará gracia.'),
        enabled: !blocked && lively && !fedUp && !startedNow, cost: 0,
    });
    if (champion) {
        const done = happened(log, { town, day, what: 'duelo' });
        const broke = purse < STAKES[0];
        out.push({
            id: 'brawl-duel', label: `Retar a ${champion.name} a un duelo por dinero`,
            detail: blocked
                || (!lively ? `Por la mañana ${champion.name} no está.`
                    : done ? 'Hoy ya has peleado un duelo aquí. Vuelve otro día.'
                        : broke ? `Hace falta tener al menos ${STAKES[0]} de oro para apostar.`
                            : `Uno contra uno, a puñetazos, hasta que uno caiga o se rinda. Se apuesta ${STAKES.join(', ').replace(/, (\d+)$/, ' o $1')} de oro; tu gente mira.`),
            enabled: !blocked && lively && !done && !broke, cost: 0, target: champion.id,
        });
    }
    return out;
}

/**
 * Lo que se puede apostar con lo que se lleva.
 *
 * @param {number} purse
 * @returns {number[]}
 */
export function stakesFor(purse) {
    return STAKES.filter(s => s <= Math.max(0, Number(purse) || 0));
}

// ---------------------------------------------------------------------------------------
// El reto por honor

/**
 * Si alguien a quien has amenazado (y no se ha asustado) te reta a un duelo por honor: quien
 * tiene su reto escrito, o quien es de armas tomar por su oficio. Nulo si no.
 *
 * @param {Object} input
 * @param {{name?: string, trade?: string, role?: string, dead?: boolean}|null} input.npc
 * @param {FightRows} input.rows
 * @returns {Fighter|null}
 */
export function challengerFor({ npc, rows }) {
    const name = text(npc?.name);
    if (!name || npc?.dead) return null;
    const written = rows.challengers.find(c => fold(c.name) === fold(name));
    if (written) return written;
    if (!TOUGH.test(`${text(npc?.trade)} ${text(npc?.role)}`)) return null;
    return {
        id: `retador-${fold(name).replace(/[^a-z0-9]+/g, '-')}`, kind: 'retador', name, archetype: '', town: '',
        opens: `${name} deja lo que tenía entre manos y se planta delante de ti.`,
        says: '«¿Me amenazas a mí? Muy bien. Tú y yo, a puñetazos, delante de todos. Si te echas atrás, que todo {pueblo} sepa lo que vales.»',
        wins: `${name} te mira desde arriba y se va sin decir nada.`,
        loses: `${name} se levanta despacio y te mira de otra manera.`,
    };
}

// ---------------------------------------------------------------------------------------
// Lo que pasa al acabar

/**
 * @typedef {Object} BrawlResult
 * @property {string} title Arriba, en la escena del final.
 * @property {number} gold Lo que se gana (positivo) o se pierde (negativo), sin lo roto.
 * @property {number} bill Lo roto que pagas tú.
 * @property {number} fame La fama en la localización (+ o −).
 * @property {string[]} marks Las huellas que deja (`world-marks.js`), en la taberna.
 * @property {string[]} lines Lo que se lee.
 * @property {string[]} notes Lo que cambia, en una línea cada cosa.
 * @property {''|'alegre'|'enfadado'} mood La cara del rival o de quien lleva la taberna.
 */

/**
 * Cómo se cuenta lo roto.
 *
 * @param {number} broken
 * @returns {string}
 */
export function describeBroken(broken) {
    const n = Math.max(0, Math.floor(Number(broken) || 0));
    if (n === 0) return 'nada';
    return n === 1 ? 'una silla' : `${n} muebles`;
}

/**
 * Lo que pasa al acabar una pelea sin muertes. Pelea de taberna:
 *
 * - **La empezaron ellos y ganas**: +1 de fama aquí, el posadero os da `2 × rivales` de oro por
 *   echarlos, y lo roto lo pagan ellos. El posadero se alegra.
 * - **La empezaron ellos y pierdes**: −1 de fama, os vacían un poco la bolsa (`lost`) y pagas la
 *   mitad de lo roto.
 * - **La armas tú**: lo roto lo pagas tú entero, y el posadero se enfada. Ganando, +1 de fama
 *   (entre los que pelean); perdiendo o rindiéndote, −1, y perdiendo también os vacían la bolsa.
 * - **Te rindes**: pagas una ronda (`ROUND_PRICE`) y la mitad de lo roto.
 * - **Se acaba pagando una ronda** (tablas): ya está pagada; la mitad de lo roto.
 *
 * Duelo por dinero: ganas, `+stake`; pierdes o te rindes, `−stake`. Lo roto lo paga quien pierde.
 * Duelo por honor: la fama de `HONOR_FAME`, y su huella.
 *
 * @param {Object} input
 * @param {import('../combat/brawl.js').Brawl} input.brawl
 * @param {'gana'|'pierde'|'rinde'|'tablas'} input.verdict
 * @param {number} input.broken Los muebles rotos.
 * @param {number} input.lost Lo que os quitan de la bolsa si perdéis en la taberna (ya tirado).
 * @param {FightRows} input.rows
 * @param {Fighter|null} [input.rival] Quien pelea enfrente, si está escrito.
 * @param {{heroe?: any, posadero?: string}} [input.facts]
 * @param {() => number} [input.random]
 * @returns {BrawlResult}
 */
export function brawlOutcome({ brawl, verdict, broken, lost, rows, rival = null, facts = {}, random = Math.random }) {
    const n = Math.max(0, Math.floor(Number(broken) || 0));
    const furniture = n * FURNITURE_PRICE;
    const said = {
        ...facts, quien: brawl.rival, pueblo: brawl.town, taberna: brawl.tavern, oro: brawl.stake, muebles: describeBroken(n),
    };
    const line = (/** @type {string} */ moment) => fightLine(rows, moment, said, random);
    const theirs = (/** @type {'wins'|'loses'} */ key) => (rival?.[key] ? fillLine(rival[key], said) : '');
    /** @type {BrawlResult} */
    const out = { title: '', gold: 0, bill: 0, fame: 0, marks: [], lines: [], notes: [], mood: '' };

    if (brawl.kind === 'taberna') {
        const mine = brawl.started === 'tu';
        if (verdict === 'gana') {
            out.title = 'Ganas la pelea';
            out.fame = 1;
            out.lines.push(line('gana-taberna'), theirs('loses'));
            if (mine) {
                out.bill = furniture;
                out.marks.push('pelea');
                out.mood = 'enfadado';
            } else {
                out.gold = 2 * Math.max(1, brawl.rivals);
                out.marks.push('pelea-ganada');
                out.mood = 'alegre';
                out.notes.push(`${text(facts.posadero) || 'El posadero'} os da ${out.gold} de oro por echarlos, y lo roto lo pagan ellos.`);
            }
        } else if (verdict === 'pierde') {
            out.title = 'Pierdes la pelea';
            out.fame = -1;
            const taken = Math.max(0, Math.floor(Number(lost) || 0));
            out.gold = taken > 0 ? -taken : 0;
            out.bill = mine ? furniture : Math.ceil(furniture / 2);
            out.lines.push(line('pierde-taberna'), theirs('wins'));
            if (mine) out.marks.push('pelea');
            out.mood = mine ? 'enfadado' : '';
        } else if (verdict === 'rinde') {
            out.title = 'Te rindes';
            out.fame = mine ? -1 : 0;
            out.gold = -ROUND_PRICE;
            out.bill = mine ? furniture : Math.ceil(furniture / 2);
            out.lines.push(line('rinde-taberna'));
            if (mine) out.marks.push('pelea');
            out.mood = mine ? 'enfadado' : '';
        } else {
            out.title = 'Se acaba con una ronda';
            out.bill = mine ? furniture : Math.ceil(furniture / 2);
            out.lines.push(line('paz-taberna'));
            if (mine) out.marks.push('pelea');
        }
        if (out.bill > 0) out.lines.push(line('posadero-cobra'));
    } else if (brawl.way === 'apuesta') {
        const stake = Math.max(0, Math.floor(Number(brawl.stake) || 0));
        if (verdict === 'gana') {
            out.title = 'Ganas el duelo';
            out.gold = stake;
            out.lines.push(theirs('loses'), line('gana-apuesta'));
            out.marks.push('duelo-ganado');
            out.mood = 'alegre';
        } else if (verdict === 'tablas') {
            out.title = 'Nadie gana';
            out.lines.push(`${brawl.rival} recoge su oro de la mesa y tú el tuyo: hoy no gana nadie.`);
        } else {
            out.title = verdict === 'rinde' ? 'Te rindes' : 'Pierdes el duelo';
            out.gold = -stake;
            out.lines.push(theirs('wins'), line(verdict === 'rinde' ? 'rinde-apuesta' : 'pierde-apuesta'));
            out.marks.push('duelo-perdido');
        }
        // Lo roto lo paga quien pierde.
        out.bill = verdict === 'gana' ? 0 : furniture;
        if (out.bill > 0) out.lines.push(line('posadero-cobra'));
    } else {
        if (verdict === 'gana') {
            out.title = 'Ganas el duelo';
            out.fame = HONOR_FAME.gana;
            out.lines.push(theirs('loses'), line('gana-honor'));
            out.marks.push('duelo-ganado');
            out.mood = 'alegre';
        } else if (verdict === 'tablas') {
            out.title = 'Nadie gana';
            out.lines.push(`${brawl.rival} y tú os separáis sin que nadie haya caído. En ${brawl.town} se hablará de ello, pero no mucho.`);
        } else {
            out.title = verdict === 'rinde' ? 'Te rindes' : 'Pierdes el duelo';
            out.fame = verdict === 'rinde' ? HONOR_FAME.rinde : HONOR_FAME.pierde;
            out.lines.push(theirs('wins'), line('pierde-honor'));
            out.marks.push('duelo-perdido');
            out.mood = 'enfadado';
        }
        out.bill = verdict === 'gana' ? 0 : furniture;
    }

    // En la taberna, lo que da el posadero ya lo dice su nota.
    if (out.gold > 0 && brawl.kind !== 'taberna') out.notes.unshift(`+${out.gold} de oro.`);
    if (out.gold < 0) {
        out.notes.unshift(brawl.kind !== 'taberna' ? `−${-out.gold} de oro.`
            : verdict === 'pierde' ? `Os falta ${-out.gold} de oro en la bolsa.` : `La ronda: ${-out.gold} de oro.`);
    }
    if (out.bill > 0) out.notes.push(`Lo roto (${describeBroken(n)}): ${out.bill} de oro.`);
    if (out.fame > 0) out.notes.push(`En ${brawl.town} se habla bien de vosotros (+${out.fame} de fama).`);
    else if (out.fame < 0) out.notes.push(`En ${brawl.town} se ríen un poco de vosotros (${out.fame} de fama).`);
    out.lines = out.lines.filter(Boolean);
    return out;
}

/**
 * No aceptar un reto por honor: se sabe, y se pierde algo de fama.
 *
 * @param {Object} input
 * @param {string} input.rival
 * @param {string} input.town
 * @param {FightRows} input.rows
 * @param {any} [input.hero]
 * @param {() => number} [input.random]
 * @returns {{fame: number, marks: string[], lines: string[], notes: string[]}}
 */
export function refuseHonor({ rival, town, rows, hero = null, random = Math.random }) {
    return {
        fame: HONOR_FAME.rechaza,
        marks: ['reto-rechazado'],
        lines: [fightLine(rows, 'rechaza-honor', { quien: rival, pueblo: town, heroe: hero }, random)].filter(Boolean),
        notes: [`En ${text(town) || 'el pueblo'} se dirá que no aceptaste (${HONOR_FAME.rechaza} de fama).`],
    };
}

/**
 * Cómo se llama lo que se lleva la parte del día.
 *
 * @param {import('../combat/brawl.js').Brawl} brawl
 * @returns {string}
 */
export function dayPartLabel(brawl) {
    return brawl.kind === 'taberna' ? 'Pelea en la taberna' : `Duelo con ${text(brawl.rival) || 'alguien'}`;
}
