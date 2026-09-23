/**
 * El hilo: lo que tienes entre manos.
 *
 * Una partida arrancaba con sitios, facciones cuyos relojes corren y un tablón, y nada que
 * dijera **qué hacer ahora**. La sinopsis del mundo era texto. Esto la convierte en una
 * lista corta de **hitos**, y cada uno dice tres cosas con piezas que el motor ya sabe mirar:
 *
 * - **qué lo abre**: empezar, llegar a un sitio, cumplir otro hito, entregar un encargo,
 *   que pasen N días o que una facción llene su reloj;
 * - **qué pide**: llegar a un sitio, ganar un tablero, derrotar a alguien, nombrar a alguien
 *   al hablar, sacar una tirada o entregar un encargo (de una facción, o uno concreto);
 * - **qué cambia** al cumplirse: revelar sitios, abrir otros hitos y mover la reputación.
 *
 * El hilo va escrito en el paquete del mundo. Un mundo que no trae uno recibe el de su
 * facción más peligrosa (`plotFromFaction`): su meta es lo que pasa si nadie la para, y su
 * reloj la cuenta atrás. Así la partida empieza con un problema aunque nadie lo escribiera.
 *
 * Puro: recibe sucesos y devuelve lo que cambia. Quien llama lo cuenta y lo guarda.
 *
 * Ver wiki/ROADMAP_MUNDOS_VIVOS.md, fase H.
 */

import { readFactions, clockOf, saysWith } from './factions.js';

/** Lo que puede abrir un hito. */
export const OPENS = ['start', 'arrive', 'after', 'contract', 'day', 'clock'];

/** Lo que puede pedir. `none` se cumple en cuanto se abre: una escena, sin más. */
export const ASKS = ['arrive', 'win', 'defeat', 'talk', 'check', 'contract', 'none'];

/**
 * @typedef {Object} Milestone
 * @property {string} id
 * @property {number} act
 * @property {string} title
 * @property {string} hint   Lo que se ve en pantalla mientras está abierto.
 * @property {string} scene  Lo que el narrador cuenta al abrirse.
 * @property {{kind: string, place?: string, milestone?: string, id?: string, day?: number, faction?: string}} opens
 * @property {{kind: string, place?: string, board?: string, enemy?: string, npc?: string, skill?: string, id?: string, faction?: string, against?: boolean}} asks
 * @property {{reveal: string[], open: string[], standing: Record<string, number>, ending: string}} changes
 */

/**
 * @typedef {Object} Plot
 * @property {string} title
 * @property {'written'|'faction'} source
 * @property {Milestone[]} milestones
 */

/**
 * @typedef {{open: string[], done: string[]}} PlotState
 */

/** @param {any} value */
function text(value) {
    return String(value ?? '').trim();
}

/** @param {any} value */
function lower(value) {
    return text(value).toLowerCase();
}

/**
 * Un hito tal como se puede usar, venga como venga escrito.
 *
 * @param {any} raw
 * @param {number} index
 * @returns {Milestone|null}
 */
function readMilestone(raw, index) {
    if (!raw || typeof raw !== 'object') return null;
    const title = text(raw.title);
    const id = text(raw.id) || (title ? `hito_${index + 1}` : '');
    if (!id || !title) return null;

    const opens = raw.opens && typeof raw.opens === 'object' ? raw.opens : { kind: 'after' };
    const asks = raw.asks && typeof raw.asks === 'object' ? raw.asks : { kind: 'none' };
    const changes = raw.changes && typeof raw.changes === 'object' ? raw.changes : {};
    const list = (/** @type {any} */ v) => (Array.isArray(v) ? v.map(text).filter(Boolean) : []);

    /** @type {Record<string, number>} */
    const standing = {};
    for (const [faction, amount] of Object.entries(changes.standing ?? {})) {
        const n = Math.round(Number(amount) || 0);
        if (n !== 0) standing[text(faction)] = n;
    }

    return {
        id,
        act: Math.max(1, Math.min(3, Math.floor(Number(raw.act) || 1))),
        title,
        hint: text(raw.hint),
        scene: text(raw.scene),
        opens: { ...opens, kind: OPENS.includes(text(opens.kind)) ? text(opens.kind) : 'after' },
        asks: { ...asks, kind: ASKS.includes(text(asks.kind)) ? text(asks.kind) : 'none' },
        changes: { reveal: list(changes.reveal), open: list(changes.open), standing, ending: text(changes.ending) },
    };
}

/**
 * El hilo, leído con tolerancia: un hito mal escrito se cae, el resto sigue.
 *
 * @param {any} raw
 * @returns {Plot|null}
 */
export function readPlot(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const milestones = (Array.isArray(raw.milestones) ? raw.milestones : [])
        .map(readMilestone)
        .filter(/** @returns {m is Milestone} */ m => m !== null);
    if (milestones.length === 0) return null;
    return {
        title: text(raw.title),
        source: raw.source === 'faction' ? 'faction' : 'written',
        milestones,
    };
}

/**
 * @param {any} raw
 * @returns {PlotState}
 */
export function readPlotState(raw) {
    const list = (/** @type {any} */ v) => (Array.isArray(v) ? [...new Set(v.map(text).filter(Boolean))] : []);
    return { open: list(raw?.open), done: list(raw?.done) };
}

/**
 * Si un hito pide lo que acaba de pasar.
 *
 * @param {Milestone['asks']} asks
 * @param {any} event
 * @returns {boolean}
 */
function asksFor(asks, event) {
    const kind = text(event?.kind);
    switch (asks.kind) {
        case 'arrive':
            return kind === 'arrive' && lower(event.place) === lower(asks.place);
        case 'win':
            return kind === 'win'
                && (!asks.place || lower(event.place) === lower(asks.place))
                && (!asks.board || lower(event.board) === lower(asks.board));
        case 'defeat':
            return kind === 'defeat' && lower(event.enemy).startsWith(lower(asks.enemy));
        case 'talk':
            // Se nombra a alguien al hablar, estando donde está. El motor no sabe de qué
            // se habla, pero sí a quién se dirige quien juega.
            return kind === 'say' && Boolean(asks.npc)
                && lower(event.text).includes(lower(asks.npc))
                && (!asks.place || lower(event.place) === lower(asks.place));
        case 'check':
            return kind === 'check' && Boolean(event.success) && lower(event.skill) === lower(asks.skill);
        case 'contract':
            if (kind !== 'contract') return false;
            if (asks.id) return lower(event.id) === lower(asks.id);
            if (asks.faction) {
                return lower(event.faction) === lower(asks.faction)
                    && (asks.against === undefined || Boolean(event.against) === Boolean(asks.against));
            }
            return true;
        default:
            return false;
    }
}

/**
 * Si un hito se abre con lo que acaba de pasar (sin contar «tras otro hito»).
 *
 * @param {Milestone['opens']} opens
 * @param {any} event
 * @returns {boolean}
 */
function opensWith(opens, event) {
    const kind = text(event?.kind);
    switch (opens.kind) {
        case 'arrive': return kind === 'arrive' && lower(event.place) === lower(opens.place);
        case 'contract': return kind === 'contract' && lower(event.id) === lower(opens.id);
        case 'day': return kind === 'day' && Number(event.day) >= Number(opens.day);
        case 'clock': return kind === 'clock' && lower(event.faction) === lower(opens.faction);
        default: return false;
    }
}

/**
 * @typedef {Object} PlotStep
 * @property {PlotState} state
 * @property {Milestone[]} opened Los que se acaban de abrir, en orden: su escena se cuenta.
 * @property {Milestone[]} done   Los que se acaban de cumplir.
 * @property {{reveal: string[], standing: Record<string, number>, ending: string}} changes
 */

/**
 * Abrir un hito, y los que se cumplen solos al abrirse, y lo que eso abra.
 *
 * @param {Plot} plot
 * @param {PlotState} state
 * @param {Milestone[]} toOpen
 * @param {PlotStep} step
 */
function openAll(plot, state, toOpen, step) {
    const queue = [...toOpen];
    // Un hito que se abre a sí mismo en círculo no puede colgar la partida.
    for (let guard = 0; queue.length > 0 && guard < 200; guard++) {
        const milestone = /** @type {Milestone} */ (queue.shift());
        if (state.open.includes(milestone.id) || state.done.includes(milestone.id)) continue;
        // Con un final ya alcanzado no se abre nada más: «llegasteis tarde» no puede
        // pasar después de haberlos parado.
        if (hasEnded(plot, state)) break;
        state.open.push(milestone.id);
        step.opened.push(milestone);
        if (milestone.asks.kind === 'none') queue.push(...complete(plot, state, milestone, step));
    }
}

/**
 * Si la partida ya ha llegado a uno de sus finales.
 *
 * @param {Plot} plot
 * @param {PlotState} state
 * @returns {boolean}
 */
export function hasEnded(plot, state) {
    return plot.milestones.some(m => m.changes.ending && readPlotState(state).done.includes(m.id));
}

/**
 * Cumplir un hito: apunta lo que cambia y devuelve los que eso abre.
 *
 * @param {Plot} plot
 * @param {PlotState} state
 * @param {Milestone} milestone
 * @param {PlotStep} step
 * @returns {Milestone[]}
 */
function complete(plot, state, milestone, step) {
    state.open = state.open.filter(id => id !== milestone.id);
    if (!state.done.includes(milestone.id)) state.done.push(milestone.id);
    step.done.push(milestone);

    step.changes.reveal.push(...milestone.changes.reveal);
    for (const [faction, amount] of Object.entries(milestone.changes.standing)) {
        step.changes.standing[faction] = (step.changes.standing[faction] ?? 0) + amount;
    }
    if (milestone.changes.ending) step.changes.ending = milestone.changes.ending;

    const byId = new Map(plot.milestones.map(m => [m.id, m]));
    return [
        ...milestone.changes.open.map(id => byId.get(id)).filter(/** @returns {m is Milestone} */ m => Boolean(m)),
        ...plot.milestones.filter(m => m.opens.kind === 'after' && m.opens.milestone === milestone.id),
    ];
}

/** @returns {PlotStep} */
function emptyStep(/** @type {PlotState} */ state) {
    return { state, opened: [], done: [], changes: { reveal: [], standing: {}, ending: '' } };
}

/**
 * Empezar: se abren los hitos que se abren al empezar. El primero es la mecha.
 *
 * @param {Plot} plot
 * @returns {PlotStep}
 */
export function startPlot(plot) {
    const state = { open: [], done: [] };
    const step = emptyStep(state);
    openAll(plot, state, plot.milestones.filter(m => m.opens.kind === 'start'), step);
    return step;
}

/**
 * Lo que un suceso del juego le hace al hilo.
 *
 * Primero se cumple lo que estaba abierto y lo pedía; después se abre lo que ese suceso
 * abre por sí mismo. Un encargo entregado puede hacer las dos cosas a la vez.
 *
 * @param {Plot|null} plot
 * @param {any} rawState
 * @param {any} event `{kind: 'arrive'|'win'|'defeat'|'say'|'check'|'contract'|'day'|'clock', …}`
 * @returns {PlotStep}
 */
export function plotEvent(plot, rawState, event) {
    const state = readPlotState(rawState);
    const step = emptyStep(state);
    if (!plot) return step;

    const byId = new Map(plot.milestones.map(m => [m.id, m]));
    /** @type {Milestone[]} */
    const next = [];
    for (const id of [...state.open]) {
        const milestone = byId.get(id);
        if (milestone && asksFor(milestone.asks, event)) next.push(...complete(plot, state, milestone, step));
    }
    next.push(...plot.milestones.filter(m => opensWith(m.opens, event)));
    openAll(plot, state, next, step);
    return step;
}

/**
 * Lo que tienes entre manos: el hito abierto del acto más temprano.
 *
 * @param {Plot|null} plot
 * @param {any} rawState
 * @returns {{id: string, act: number, title: string, hint: string}|null}
 */
export function focusOf(plot, rawState) {
    if (!plot) return null;
    const state = readPlotState(rawState);
    const open = plot.milestones.filter(m => state.open.includes(m.id));
    const first = open.sort((a, b) => a.act - b.act
        || plot.milestones.indexOf(a) - plot.milestones.indexOf(b))[0];
    return first ? { id: first.id, act: first.act, title: first.title, hint: first.hint } : null;
}

/**
 * En qué acto va la partida: el más alto que se ha tocado.
 *
 * @param {Plot|null} plot
 * @param {any} rawState
 * @returns {number}
 */
export function actOf(plot, rawState) {
    if (!plot) return 1;
    const state = readPlotState(rawState);
    const touched = plot.milestones.filter(m => state.open.includes(m.id) || state.done.includes(m.id));
    return touched.reduce((max, m) => Math.max(max, m.act), 1);
}

/**
 * La línea para la pantalla y para el narrador.
 *
 * @param {{title: string, hint: string}|null} focus
 * @returns {string}
 */
export function describeFocus(focus) {
    if (!focus) return '';
    return focus.hint ? `${focus.title} — ${focus.hint}` : focus.title;
}

/** Cómo se dice lo que quiere una facción, por tipo de meta. */
const WANTS = {
    encontrar: (/** @type {string} */ who, /** @type {string} */ what) => `${who} ${saysWith(who, 'busca', 'buscan')} ${what || 'algo que lleva tiempo perdido'}`,
    conquistar: (/** @type {string} */ who, /** @type {string} */ what) => `${who} ${saysWith(who, 'quiere', 'quieren')} ${what || 'lo que no es suyo'}`,
    recuperar: (/** @type {string} */ who, /** @type {string} */ what) => `${who} ${saysWith(who, 'quiere', 'quieren')} recuperar ${what || 'lo que perdió'}`,
    destruir: (/** @type {string} */ who, /** @type {string} */ what) => `${who} ${saysWith(who, 'va', 'van')} a por ${what || 'alguien'}`,
    controlar: (/** @type {string} */ who, /** @type {string} */ what) => `${who} ${saysWith(who, 'quiere', 'quieren')} el camino a ${what || 'todas partes'}`,
};

/**
 * El hilo de un mundo que no trae uno escrito: el de su facción más peligrosa.
 *
 * La más peligrosa es la que más cerca está de su meta. Cuatro hitos:
 *
 * 1. **La mecha** (se cumple al abrirse): lo que quieren y cuánto les falta.
 * 2. **Verlo con tus ojos**: llegar a su sede.
 * 3. **Tomar partido**: entregar un encargo en su contra.
 * 4. **Pararlos**: otro encargo en su contra, o ganar un tablero en su sede.
 *
 * Y uno más que solo se abre si su reloj se llena antes: **llegasteis tarde**. Así ignorar
 * el hilo también tiene final.
 *
 * @param {Object} input
 * @param {any[]} input.factions
 * @returns {Plot|null}
 */
export function plotFromFaction({ factions }) {
    const all = readFactions(factions).filter(f => f.name);
    if (all.length === 0) return null;
    const progress = (/** @type {any} */ f) => {
        const clock = clockOf(f);
        return clock.of > 0 ? clock.at / clock.of : 0;
    };
    const faction = [...all].sort((a, b) => progress(b) - progress(a)
        || a.reputation - b.reputation || a.id.localeCompare(b.id))[0];

    const who = faction.name;
    const where = faction.seat || faction.holds[0] || '';
    const want = (WANTS[/** @type {keyof typeof WANTS} */ (faction.goal.kind)] ?? WANTS.conquistar)(who, faction.goal.target);

    /** @type {any[]} */
    const milestones = [
        {
            id: 'mecha', act: 1, title: `Lo que quieren ${who}`,
            hint: `${want}.`,
            scene: `${want}. Nadie en el camino habla de otra cosa, y nadie ha hecho nada todavía.`,
            opens: { kind: 'start' }, asks: { kind: 'none' }, changes: {},
        },
        where ? {
            id: 'verlo', act: 1, title: `Ver con tus ojos a ${who}`,
            hint: `Se les encuentra en ${where}.`,
            scene: `Lo que se cuenta de ${who} no basta: hay que ir a ${where} y verlo.`,
            opens: { kind: 'after', milestone: 'mecha' }, asks: { kind: 'arrive', place: where }, changes: {},
        } : null,
        {
            id: 'partido', act: 2, title: `Tomar partido contra ${who}`,
            hint: 'El tablón tiene trabajo en su contra.',
            scene: `Ya se sabe lo que ${saysWith(who, 'hace', 'hacen')} ${who}. Ahora hay que decidir si se les deja.`,
            opens: { kind: 'after', milestone: where ? 'verlo' : 'mecha' },
            asks: { kind: 'contract', faction: faction.id, against: true }, changes: {},
        },
        {
            id: 'pararlos', act: 3, title: `Parar a ${who}`,
            hint: where ? `Otro golpe, o plantarles cara en ${where}.` : 'Un golpe más en su contra.',
            scene: `${who} ya ${saysWith(who, 'sabe', 'saben')} quién les estorba. Falta el último paso.`,
            opens: { kind: 'after', milestone: 'partido' },
            asks: where
                ? { kind: 'win', place: where }
                : { kind: 'contract', faction: faction.id, against: true },
            changes: { ending: 'parados' },
        },
        {
            id: 'tarde', act: 3, title: 'Llegasteis tarde',
            hint: `${who} ${saysWith(who, 'consiguió', 'consiguieron')} lo que ${saysWith(who, 'quería', 'querían')}.`,
            scene: `${want}, y ya ${saysWith(who, 'lo tiene', 'lo tienen')}. El mundo ha cambiado sin esperar a nadie.`,
            opens: { kind: 'clock', faction: faction.id }, asks: { kind: 'none' }, changes: { ending: 'tarde' },
        },
    ].filter(Boolean);

    return readPlot({ title: `${who}`, source: 'faction', milestones });
}
