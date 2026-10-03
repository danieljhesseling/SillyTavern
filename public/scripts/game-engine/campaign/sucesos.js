/**
 * Sucesos con decisiones (Z4 de wiki/ROADMAP_SIN_TOKENS.md).
 *
 * Entre pelea y pelea había mucho que mirar y poco que elegir: los sucesos del camino
 * pasaban y ya. Aquí un suceso es una **tarjeta**, como en *Darkest Dungeon*, *Sunless Sea*
 * u *Oregon Trail*: una situación, dos o tres opciones con su precio (oro, tiempo, una
 * tirada) y un resultado **con efecto** en lo que ya existe: oro, heridas, fama, la facción
 * que manda aquí, los vínculos, los rumores, las pistas, el tiempo.
 *
 * Y lo que se elige se nota: el Diario lo apunta, y algunos vuelven días después como
 * continuación («el desertor al que disteis pan está en la posada»).
 *
 * Los sucesos salen de `compendio/sucesos.json` (se editan sin programar) y, en un mundo
 * escrito, de sus bloques `suceso:` (Z7). El motor elige y aplica; el modelo, si lo hay,
 * solo lo cuenta con su voz.
 *
 * Puro: de las filas, el momento y el azar, a tarjetas; de una opción elegida, a efectos.
 * Los aplica quien llama.
 */

import { matches, pickWeighted } from '../compendio/compendio.js';
import { fill } from './engine-narrator.js';
import { resolveGender } from './grammar.js';
import { passesTriggers, triggerFacts, withoutTriggers, describeWorldEffect } from './suceso-triggers.js';

/**
 * Cuántas veces sale un suceso en cada momento. El viaje no se sortea: cada viaje trae el
 * suyo (uno por cada dos días de camino). A cero, un momento no trae ninguno.
 */
export const SUCESO_CHANCE = { viaje: 1, llegada: 0.3, descanso: 0.25, semana: 0.6 };

/** Cuántos sucesos se recuerdan para no repetirlos. */
export const SEEN_MEMORY = 12;

/**
 * @typedef {Object} SucesoOutcome
 * @property {string[]} [effects]
 * @property {string} [then] Lo que pasa, dicho.
 * @property {{id: string, days: number}} [follow] J11.2: lo que vuelve si sale así (también si sale mal).
 */

/**
 * @typedef {Object} SucesoOption
 * @property {string} label
 * @property {{oro?: number, horas?: number, dias?: number}} [cost] Lo que se paga antes, salga lo que salga.
 * @property {{skill: string, dc: number}} [check] Una tirada: sale bien o mal.
 * @property {string[]} [effects] Lo que pasa siempre.
 * @property {string} [then]
 * @property {SucesoOutcome} [success]
 * @property {SucesoOutcome} [fail]
 * @property {{id: string, days: number}} [follow] Un suceso que vuelve días después.
 * @property {string} [needs] `companero`: solo si hay alguien en el grupo además de quien juega.
 */

/**
 * @typedef {Object} SucesoRow
 * @property {string} id
 * @property {string} name
 * @property {string} text
 * @property {SucesoOption[]} options
 * @property {number} [weight]
 * @property {Record<string, any>} [when]
 */

/**
 * @typedef {Object} SucesoState
 * @property {string[]} seen Los últimos que salieron.
 * @property {Array<{id: string, day: number, place: string}>} pending Los que volverán.
 */

/**
 * @param {any} value
 * @returns {string}
 */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * Cuántos sucesos tocan en un momento.
 *
 * @param {Object} input
 * @param {string} input.moment `viaje`, `llegada`, `descanso` o `semana`.
 * @param {number} [input.days] Los días de camino, si es un viaje.
 * @param {() => number} input.random
 * @returns {number}
 */
export function sucesoCount({ moment, days = 1, random }) {
    const chance = SUCESO_CHANCE[/** @type {keyof typeof SUCESO_CHANCE} */ (moment)] ?? 0;
    if (!(chance > 0)) return 0;
    // Entre sitio y sitio siempre pasa algo que decidir: es lo que hace que viajar sea jugar.
    if (moment === 'viaje') return Math.max(1, Math.ceil((Math.floor(Number(days) || 0)) / 2));
    return random() < chance ? 1 : 0;
}

/**
 * Los sucesos de un momento: los que valen aquí, sin repetir los últimos, y con los huecos
 * del texto rellenos (`{sitio}`, `{destino}`, `{companero}`). Uno con un hueco que no se
 * puede rellenar no sale.
 *
 * @param {Object} input
 * @param {SucesoRow[]} input.rows
 * @param {string} input.moment
 * @param {Record<string, any>} [input.facts]
 * @param {number} [input.count]
 * @param {() => number} input.random
 * @param {string[]} [input.seen]
 * @param {import('./suceso-triggers.js').SucesoWorld|null} [input.world] J10.3: cómo está el
 *   mundo con vosotros aquí (`sucesoWorld`). Sin él, los que tienen disparador de facción, de
 *   reputación o de fama no salen.
 * @returns {SucesoRow[]}
 */
export function pickSucesos({ rows, moment, facts = {}, count = 1, random, seen = [], world = null }) {
    const skip = new Set(seen.map(text));
    const plainFacts = withoutTriggers(facts);
    const factsOf = (/** @type {any} */ row) => ({ ...plainFacts, ...triggerFacts(row, world) });
    const usable = (Array.isArray(rows) ? rows : [])
        .filter(row => text(row?.id) && Array.isArray(row?.options) && row.options.length > 0)
        .filter(row => matches(row, { ...plainFacts, momento: moment }) && [row.when?.momento ?? []].flat().map(text).includes(moment))
        .filter(row => passesTriggers(row, world))
        .map(row => ({ row, said: fill(text(row.text), factsOf(row)) }))
        .filter(option => option.said !== null);
    const fresh = usable.filter(option => !skip.has(text(option.row.id)));
    let pool = (fresh.length > 0 ? fresh : usable).map(option => ({ ...option.row, text: String(option.said), weight: Math.max(0, Number(option.row.weight ?? 1)) }));
    /** @type {SucesoRow[]} */
    const out = [];
    for (let i = 0; i < count && pool.length > 0; i++) {
        const chosen = pickWeighted(pool, random);
        if (!chosen) break;
        out.push(fillOptions(chosen, factsOf(chosen)));
        pool = pool.filter(row => row.id !== chosen.id);
    }
    return out;
}

/**
 * Un suceso concreto por su id: el de una continuación.
 *
 * @param {SucesoRow[]} rows
 * @param {string} id
 * @param {Record<string, any>} [facts]
 * @param {import('./suceso-triggers.js').SucesoWorld|null} [world] Para el `{bando}` de su texto.
 *   Una continuación sale aunque el disparador ya no se cumpla: ya se eligió volver.
 * @returns {SucesoRow|null}
 */
export function sucesoById(rows, id, facts = {}, world = null) {
    const row = (Array.isArray(rows) ? rows : []).find(r => text(r?.id) === text(id));
    if (!row) return null;
    const all = { ...withoutTriggers(facts), ...triggerFacts(row, world) };
    const said = fill(text(row.text), all);
    return said === null ? null : fillOptions({ ...row, text: said }, all);
}

/**
 * Los huecos de las opciones y de lo que pasa, rellenos; si uno no se puede, se queda el
 * texto con el hueco quitado mejor que con las llaves. El género (J1.4), antes de quitar
 * nada: `{secos|secas}` es una palabra, no un hueco.
 *
 * @param {SucesoRow} row
 * @param {Record<string, any>} facts
 * @returns {SucesoRow}
 */
function fillOptions(row, facts) {
    const put = (/** @type {any} */ value) => (value
        ? fill(String(value), facts) ?? resolveGender(String(value), facts?.generos ?? {}).replace(/\{[^}]+\}/g, '').replace(/\s+/g, ' ').trim()
        : value);
    return {
        ...row,
        options: row.options.map(option => ({
            ...option,
            label: put(option.label),
            ...(option.then ? { then: put(option.then) } : {}),
            ...(option.success ? { success: { ...option.success, ...(option.success.then ? { then: put(option.success.then) } : {}) } } : {}),
            ...(option.fail ? { fail: { ...option.fail, ...(option.fail.then ? { then: put(option.fail.then) } : {}) } } : {}),
        })),
    };
}

/**
 * Lo que cuesta una opción y si se puede elegir, dicho antes de pulsar.
 *
 * @param {SucesoOption} option
 * @param {Object} input
 * @param {number} [input.purse] El oro del grupo.
 * @param {boolean} [input.companion] Si hay alguien más en el grupo.
 * @param {Record<string, {label: string}>} [input.skills] Cómo se llama cada tirada.
 * @returns {{enabled: boolean, why: string, price: string}}
 */
export function optionView(option, { purse = 0, companion = false, skills = {} } = {}) {
    const bits = [];
    const gold = Number(option.cost?.oro) || 0;
    if (gold > 0) bits.push(`${gold} de oro`);
    const hours = Number(option.cost?.horas) || 0;
    if (hours > 0) bits.push(hours === 1 ? 'un rato' : `${hours} ratos`);
    const days = Number(option.cost?.dias) || 0;
    if (days > 0) bits.push(days === 1 ? 'un día' : `${days} días`);
    if (option.check) bits.push(`${skills[option.check.skill]?.label ?? option.check.skill}, CD ${option.check.dc}`);
    const why = gold > purse ? `No llega el oro: cuesta ${gold}.`
        : option.needs === 'companero' && !companion ? 'Hace falta alguien más en el grupo.' : '';
    return { enabled: !why, why, price: bits.join(' · ') };
}

/**
 * Lo que pasa al elegir una opción: lo que se paga, lo que pasa siempre y lo de la tirada.
 *
 * @param {SucesoOption} option
 * @param {{success?: boolean}} [roll]
 * @returns {{effects: string[], then: string, follow: {id: string, days: number}|null, who?: string}}
 */
export function resolveOption(option, { success = true } = {}) {
    /** @type {string[]} */
    const effects = [];
    const gold = Number(option.cost?.oro) || 0;
    if (gold > 0) effects.push(`oro:-${gold}`);
    for (let i = 0; i < (Number(option.cost?.horas) || 0); i++) effects.push('hora');
    for (let i = 0; i < (Number(option.cost?.dias) || 0); i++) effects.push('dia');
    effects.push(...(option.effects ?? []).map(text).filter(Boolean));
    const branch = option.check ? (success ? option.success : option.fail) : null;
    if (branch) effects.push(...(branch.effects ?? []).map(text).filter(Boolean));
    const then = [text(option.then), text(branch?.then)].filter(Boolean).join(' ');
    // J11.2: la rama de la tirada puede traer su continuación (el mulero que os vio robar); si no,
    // la de la opción, que con tirada solo vuelve si sale bien.
    const back = branch?.follow ?? (!option.check || success ? option.follow : null);
    const follow = back && text(back.id) ? { id: text(back.id), days: Math.max(1, Number(back.days) || 1) } : null;
    // Tanda 22 (D-J60): quién dice lo que pasa, si la opción (o su tirada) lo dice; si no, quien
    // llama mira el de la tarjeta (`who`).
    const who = text(/** @type {any} */ (branch)?.who) || text(/** @type {any} */ (option).who);
    return { effects, then, follow, ...(who ? { who } : {}) };
}

/**
 * Lo que los sucesos recuerdan: los últimos que salieron y los que volverán.
 *
 * @param {any} raw
 * @returns {SucesoState}
 */
export function readSucesoState(raw) {
    return {
        seen: Array.isArray(raw?.seen) ? raw.seen.map(text).filter(Boolean).slice(-SEEN_MEMORY) : [],
        pending: Array.isArray(raw?.pending)
            ? raw.pending.filter((/** @type {any} */ p) => text(p?.id)).map((/** @type {any} */ p) => ({ id: text(p.id), day: Number(p.day) || 1, place: text(p.place) }))
            : [],
    };
}

/**
 * Apuntar que un suceso salió, y lo que dejó pendiente.
 *
 * @param {SucesoState} state
 * @param {Object} input
 * @param {string} input.id
 * @param {{id: string, days: number}|null} [input.follow]
 * @param {number} input.day
 * @param {string} [input.place] Dónde volverá: donde se esté ese día, si no se dice.
 * @returns {SucesoState}
 */
export function noteSuceso(state, { id, follow = null, day, place = '' }) {
    return {
        seen: [...state.seen, text(id)].slice(-SEEN_MEMORY),
        pending: [
            ...state.pending.filter(p => p.id !== text(id)),
            ...(follow ? [{ id: follow.id, day: day + follow.days, place: text(place) }] : []),
        ],
    };
}

/**
 * La continuación que toca hoy aquí, si hay alguna.
 *
 * @param {SucesoState} state
 * @param {{day: number, place: string}} now
 * @returns {string}
 */
export function dueFollowUp(state, { day, place }) {
    const here = text(place).toLowerCase();
    return state.pending.find(p => p.day <= day && (!p.place || p.place.toLowerCase() === here))?.id ?? '';
}

/**
 * Un efecto, dicho para quien juega: `oro:-2` es «−2 de oro».
 *
 * @param {string} effect
 * @param {Record<string, string>} [names] J10.3: el nombre de cada facción, por id, para
 *   `faccion:<id>:+1` y `reloj:<id>:-1`.
 * @returns {string}
 */
export function describeEffect(effect, names = {}) {
    // J10.3 y J10.1: los que nombran una facción, y las llaves y los guías.
    const world = describeWorldEffect(effect, names);
    if (world) return world;
    const [kind, amount = ''] = text(effect).split(':');
    const sign = amount.startsWith('-') ? '−' : '+';
    const n = amount.replace(/^[+-]/, '');
    switch (kind) {
        case 'oro': return `${sign}${n} de oro`;
        case 'hora': return 'se va un rato';
        case 'dia': return 'se pierde un día';
        case 'herida': return `una herida (${n || '1'})`;
        case 'cura': return `se cura ${n || '1d6'}`;
        case 'comida': return 'se come';
        case 'fama': return sign === '+' ? 'se habla bien de vosotros' : 'se habla mal de vosotros';
        case 'faccion': return sign === '+' ? 'los que mandan aquí os miran mejor' : 'los que mandan aquí os miran peor';
        case 'vinculo': return 'los tuyos se sienten más cerca';
        case 'rumor': return 'os enteráis de algo';
        case 'pista': return 'una pista';
        default: return '';
    }
}
