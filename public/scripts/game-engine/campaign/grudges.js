/**
 * E4.1 de wiki/ROADMAP_ENTRETENIDO.md: que desaprobar tenga consecuencias.
 *
 * `approval.js` ya apunta lo que le parece a cada uno lo que haces (👍 / 👎), y `departures.js`
 * hace que un compañero harto se vaya (con su interruptor, y nunca un mercenario). Faltaba que el
 * disgusto se notara antes de llegar a eso:
 *
 * - **Molesto** (lo de las dos últimas semanas suma −2 o menos): no hace ataques en pareja ni su
 *   jugada del vínculo. Lo dice su ficha, y se le pasa solo (lo viejo deja de contar), dándole la
 *   razón en una discusión (E4.2) o con decisiones que le gusten.
 * - **Pide más paga** (un mercenario, −3 o menos): esa noche, junto al fuego, te lo dice él. Le
 *   subes el sueldo (con la cuenta de la semana) o le das una paga extra (sin ella), intentas
 *   convencerle (Persuasión) o le dejas ir. Si no le convences, se va del gremio.
 *
 * Todo lo dice él (D-J60): la escena es una charla con su cara, montada con `cast-scenes.js`.
 *
 * Puro: cuenta el disgusto, dice quién pide y monta la charla. Quien llama la enseña, cobra y
 * le saca del gremio si se va.
 */

import { readApproval } from './approval.js';
import { gendered } from './grammar.js';

/** En la metadata del chat: cuándo pidió cada uno más paga y lo que ya se le subió. */
export const GRUDGES_KEY = 'rencillas';

/** Los días que cuenta el disgusto: lo de antes ya se le ha pasado. */
export const GRUDGE_DAYS = 14;

/** Desde dónde se nota: molesto, y (un mercenario) pide más paga. */
export const GRUDGE = { sulk: -2, raise: -3 };

/** Cada cuántos días puede volver a pedir. */
export const RAISE_EVERY = 7;

/** Lo que pide de más cada semana, con la cuenta de la semana encendida. */
export const RAISE_WEEKLY = 10;

/** La paga extra que pide, sin la cuenta: esto más esto por nivel. */
export const RAISE_ONCE = { base: 15, perLevel: 5 };

/** La Persuasión para convencerle sin pagar. */
export const RAISE_DC = 13;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {number} */
const dayOf = (value) => Math.max(1, Math.floor(Number(value) || 1));

/**
 * Lo que suma el disgusto de alguien: sus 👍 y 👎 de los últimos `GRUDGE_DAYS` días.
 *
 * @param {any} approval El estado de `approval.js`.
 * @param {string} id
 * @param {number} day Hoy.
 * @returns {number}
 */
export function grudgeScore(approval, id, day) {
    const today = dayOf(day);
    return readApproval(approval).log
        .filter(e => e.id === String(id) && today - e.day < GRUDGE_DAYS)
        .reduce((sum, e) => sum + e.mood, 0);
}

/**
 * Si un mercenario del gremio (los que cobran y pueden irse por dinero).
 *
 * @param {any} member
 * @returns {boolean}
 */
export function isHired(member) {
    return member?.guest?.kind === 'mercenary';
}

/**
 * @typedef {Object} Grudge
 * @property {number} score
 * @property {boolean} sulks No hace ataques en pareja.
 * @property {boolean} asksRaise Un mercenario que pide más paga.
 * @property {string} label Lo que dice su ficha; vacío si no le pasa nada.
 */

/**
 * Cómo está alguien por lo que le ha parecido lo último.
 *
 * @param {any} member
 * @param {number} score `grudgeScore`.
 * @returns {Grudge}
 */
export function grudgeOf(member, score) {
    const value = Math.round(Number(score) || 0);
    const sulks = value <= GRUDGE.sulk;
    const asksRaise = isHired(member) && value <= GRUDGE.raise;
    const upset = gendered(member, 'molesto', 'molesta');
    return {
        score: value,
        sulks,
        asksRaise,
        label: sulks ? `Está ${upset} contigo: no hará ataques en pareja hasta que se le pase.` : '',
    };
}

/**
 * @typedef {Object} GrudgeState
 * @property {Record<string, number>} asked El último día en que pidió más paga, por id.
 * @property {Record<string, number>} raises Lo que se le ha subido el sueldo, por id.
 * @property {number} argued El último día con discusión junto al fuego (E4.2).
 */

/**
 * @param {any} raw
 * @returns {GrudgeState}
 */
export function readGrudges(raw) {
    /** @param {any} source @returns {Record<string, number>} */
    const numbers = (source) => Object.fromEntries(Object.entries(source && typeof source === 'object' && !Array.isArray(source) ? source : {})
        .map(([key, value]) => [text(key), Math.max(0, Math.floor(Number(value) || 0))])
        .filter(([key, value]) => key && value));
    return {
        asked: numbers(raw?.asked),
        raises: numbers(raw?.raises),
        argued: Math.max(0, Math.floor(Number(raw?.argued) || 0)),
    };
}

/**
 * Quién pide más paga esta noche: el mercenario más disgustado de los que no lo pidieron en la
 * última semana.
 *
 * @param {Object} input
 * @param {any[]} input.party El grupo, con el héroe primero.
 * @param {(member: any) => number} input.scoreOf `grudgeScore` de cada uno.
 * @param {any} input.state `readGrudges`.
 * @param {number} input.day
 * @returns {any|null}
 */
export function dueRaise({ party, scoreOf, state, day }) {
    const asked = readGrudges(state).asked;
    const today = dayOf(day);
    const due = (Array.isArray(party) ? party : []).slice(1)
        .filter(m => m && !m.dead && (Number(m.hp ?? 1) || 0) > 0 && isHired(m))
        .filter(m => !asked[String(m.id)] || today - asked[String(m.id)] >= RAISE_EVERY)
        .map(m => ({ member: m, score: scoreOf(m) }))
        .filter(({ member, score }) => grudgeOf(member, score).asksRaise)
        .sort((x, y) => x.score - y.score);
    return due[0]?.member ?? null;
}

/**
 * Lo que pide: con la cuenta de la semana, más sueldo; sin ella, una paga extra ahora.
 *
 * @param {any} member
 * @param {{weekly: boolean}} input
 * @returns {{amount: number, weekly: boolean}}
 */
export function raiseAsk(member, { weekly }) {
    if (weekly) return { amount: RAISE_WEEKLY, weekly: true };
    const level = Math.max(1, Math.floor(Number(member?.level) || 1));
    return { amount: RAISE_ONCE.base + RAISE_ONCE.perLevel * level, weekly: false };
}

/** Lo que puede contestar el héroe, en el orden de las respuestas. */
export const RAISE_REPLIES = ['pagar', 'convencer', 'dejar'];

/**
 * La charla en la que pide más paga, como una fila de `cast-scenes.js` (`a` es él). La tirada de
 * Persuasión viene hecha: lo que contesta al intentar convencerle depende de ella.
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {{amount: number, weekly: boolean}} input.ask
 * @param {boolean} input.canPay Si hay oro para la paga extra (con sueldo, siempre).
 * @param {{total: number, dc: number, success: boolean}} input.persuasion
 * @param {string} [input.why] Lo último que no le gustó («pagar para que os dejen pasar»).
 * @returns {{row: any, kinds: string[]}} La fila y, por respuesta, qué es (`RAISE_REPLIES`).
 */
export function raiseScene({ member, ask, canPay, persuasion, why = '' }) {
    const tired = gendered(member, 'cansado', 'cansada');
    const reason = text(why) ? `Lo de ${text(why).replace(/\bos\b/g, 'nos')}, por ejemplo. ` : '';
    const price = ask.weekly ? `${ask.amount} de oro más a la semana` : `${ask.amount} de oro, ahora`;
    /** @type {Array<{kind: string, reply: any}>} */
    const replies = [];
    if (canPay) {
        replies.push({
            kind: 'pagar',
            reply: {
                text: ask.weekly ? `Te subo la paga: ${ask.amount} de oro más cada semana.` : `Toma: ${ask.amount} de oro, y seguimos.`,
                who: 'a', mood: 'alegre', bonds: { a: 1 },
                then: 'Así sí. Contigo hasta donde haga falta, mientras se pague lo justo.',
            },
        });
    }
    replies.push({
        kind: 'convencer',
        reply: persuasion.success
            ? { text: 'Escúchame: lo de hoy tenía su porqué. Quédate. (Persuasión)', who: 'a', mood: 'neutral', then: 'Vale. Me has convencido. Esta vez.' }
            : { text: 'Escúchame: lo de hoy tenía su porqué. Quédate. (Persuasión)', who: 'a', mood: 'enfadado', then: 'No. Palabras ya me han dado muchas. Mañana me voy.' },
    });
    replies.push({
        kind: 'dejar',
        reply: { text: 'Si no estás a gusto, puedes irte.', who: 'a', mood: 'triste', then: 'Pues me voy. Ha sido un placer, a ratos.' },
    });
    const row = {
        id: `paga-${text(member?.id) || text(member?.name)}`,
        title: 'Más paga',
        where: '',
        beats: [
            { who: 'a', mood: 'enfadado', say: `Tenemos que hablar. Estoy ${tired} de cómo se hacen las cosas aquí. ${reason}Yo me juego el pellejo por un sueldo, no por tus ideas.` },
            {
                who: 'a',
                mood: 'neutral',
                say: `Así que una de dos: ${price}, o mañana busco otro gremio.`,
                replies: replies.map(r => r.reply),
            },
        ],
    };
    return { row, kinds: replies.map(r => r.kind) };
}

/**
 * Lo que se eligió en la charla de la paga: la última respuesta que es de la pregunta.
 *
 * @param {string[]} kinds `raiseScene(...).kinds`.
 * @param {Array<{beat: number, reply: number}>} choices
 * @returns {string} Una de `RAISE_REPLIES`, o vacío si se cerró sin contestar.
 */
export function raiseChoice(kinds, choices) {
    const last = [...(Array.isArray(choices) ? choices : [])].reverse().find(c => c && c.beat === 1);
    return last ? text(kinds?.[last.reply]) : '';
}

/**
 * @typedef {Object} RaiseResult
 * @property {boolean} stays
 * @property {number} weekly Lo que se le sube a la semana.
 * @property {number} once La paga extra de ahora.
 * @property {number} ease Cuántos 👍 se le apuntan («le subiste la paga»).
 * @property {string} what Lo que se apunta con ellos.
 * @property {string} line Lo que se ve al acabar, fuera de la caja.
 */

/**
 * Lo que deja la charla de la paga.
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {string} input.choice `raiseChoice`.
 * @param {{amount: number, weekly: boolean}} input.ask
 * @param {{total: number, dc: number, success: boolean}} input.persuasion
 * @param {number} input.score Su disgusto de ahora.
 * @returns {RaiseResult}
 */
export function settleRaise({ member, choice, ask, persuasion, score }) {
    const name = text(member?.name) || 'Tu mercenario';
    const owed = Math.max(0, -Math.round(Number(score) || 0));
    if (choice === 'pagar') {
        return {
            stays: true,
            weekly: ask.weekly ? ask.amount : 0,
            once: ask.weekly ? 0 : ask.amount,
            ease: owed,
            what: 'le subiste la paga',
            line: ask.weekly ? `${name} cobra ahora ${ask.amount} de oro más a la semana, y se le pasa el enfado.` : `Le das ${ask.amount} de oro a ${name}, y se le pasa el enfado.`,
        };
    }
    if (choice === 'convencer') {
        const roll = `Persuasión: ${persuasion.total} contra ${persuasion.dc}`;
        return persuasion.success
            ? { stays: true, weekly: 0, once: 0, ease: Math.max(0, owed - 1), what: 'le convenciste', line: `${roll}. ${name} se queda, por ahora.` }
            : { stays: false, weekly: 0, once: 0, ease: 0, what: '', line: `${roll}. ${name} se va del gremio.` };
    }
    if (choice === 'dejar') return { stays: false, weekly: 0, once: 0, ease: 0, what: '', line: `${name} recoge sus cosas y se va del gremio.` };
    // Se cerró sin contestar: lo volverá a pedir otro día.
    return { stays: true, weekly: 0, once: 0, ease: 0, what: '', line: '' };
}

/**
 * Apuntar que lo pidió hoy y, si se le subió, cuánto.
 *
 * @param {any} raw
 * @param {{id: string, day: number, weekly?: number}} input
 * @returns {GrudgeState}
 */
export function noteRaise(raw, { id, day, weekly = 0 }) {
    const state = readGrudges(raw);
    const key = String(id);
    const raises = weekly > 0 ? { ...state.raises, [key]: (state.raises[key] ?? 0) + Math.floor(weekly) } : state.raises;
    return { ...state, asked: { ...state.asked, [key]: dayOf(day) }, raises };
}

/**
 * Los 👍 que se le apuntan al arreglarlo, como aprobación de `approval.js`.
 *
 * @param {any} member
 * @param {number} count
 * @param {string} what
 * @returns {Array<{id: string, name: string, want: string, mood: 1, what: string}>}
 */
export function easeVerdicts(member, count, what) {
    return Array.from({ length: Math.max(0, Math.min(6, Math.floor(Number(count) || 0))) }, () => ({
        id: String(member?.id ?? ''), name: text(member?.name), want: '', mood: /** @type {1} */ (1), what: text(what),
    }));
}
