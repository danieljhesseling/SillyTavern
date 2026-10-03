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
 * Y tres cosas más, escritas por el guionista (ideas 106, 111 y 114):
 *
 * - **Un plazo**: N días desde que se abre. Si se pasan, el hito se pierde y pasa lo que diga
 *   `late` (lo normal: abrir el siguiente, peor parado).
 * - **Oculto**: no sale en pantalla ni en el diario hasta que se cumple por casualidad. Es un
 *   logro de la historia, no una tarea.
 * - **El presagio**: tres frases al empezar, cada una ligada a un hito. Se cumple con él.
 *
 * Y tres formas de pedir y de cambiar (ideas 101, 102 y 107):
 *
 * - **Varias formas** (`any`): luchar, hablar o colarse; cualquiera lo cumple, y se apunta
 *   cuál fue.
 * - **Bifurcaciones** (`changes.close`): cumplir uno cierra otros. Ayudar a unos cierra el
 *   camino de los otros, y ya no se abre.
 * - **Investigaciones** (`clues`): reunir N pistas, cada una con una tirada en un sitio.
 *
 * Y un **prólogo** (J2.1): los hitos marcados `prologue` hasta la prueba, su último tablero.
 * Ganar la prueba lo da entero por hecho, se haya jugado o no (`prologueOf`).
 *
 * Y **escenas** (J9.2): un hito puede traer la suya escrita (`beats`, `sceneDialogue`), que se
 * juega en su ventana en vez de contarse. Aquí solo se guarda; la lee `plot-scenes.js`.
 *
 * El hilo va escrito en el paquete del mundo. Un mundo que no trae uno recibe el de su
 * facción más peligrosa (`plotFromFaction`): su meta es lo que pasa si nadie la para, y su
 * reloj la cuenta atrás. Así la partida empieza con un problema aunque nadie lo escribiera.
 *
 * Puro: recibe sucesos y devuelve lo que cambia. Quien llama lo cuenta y lo guarda.
 *
 * Ver wiki/archivo/ROADMAP_MUNDOS_VIVOS.md, fase H.
 */

import { readFactions, clockOf, saysWith } from './factions.js';
import { epiloguesOf } from './campaign-end.js';

/**
 * D-J46: el interruptor de los plazos del hilo (idea 106, J9.5). **Apagados por ahora**: Daniel
 * los encenderá más adelante, poniendo `on: true` aquí y en ningún otro sitio.
 *
 * Apagados, un hito con `within` es un hito sin plazo: no se dice cuánto queda (ni en la
 * cabecera, ni en el libro, ni en el diario, ni en la mesa de la semana) y no se pierde por
 * llegar tarde. Lo escrito en el paquete (`within`, `late`) y lo guardado (`since`) se quedan
 * como están, para cuando se enciendan. Las pruebas lo encienden dentro de la prueba.
 */
export const STORY_DEADLINES = { on: false };

/**
 * Si un hito tiene plazo que cuente ahora: con los plazos encendidos (D-J46) y `within` > 0.
 *
 * @param {any} milestone
 * @returns {boolean}
 */
export function hasDeadline(milestone) {
    return STORY_DEADLINES.on === true && Math.floor(Number(milestone?.within) || 0) > 0;
}

/** Lo que puede abrir un hito. */
export const OPENS = ['start', 'arrive', 'after', 'contract', 'day', 'clock'];

/** Lo que puede pedir. `none` se cumple en cuanto se abre: una escena, sin más. */
export const ASKS = ['arrive', 'win', 'defeat', 'talk', 'check', 'contract', 'none', 'any', 'clues'];

/** Lo que puede ser cada una de las formas de un `any`: todo lo que se mira de un suceso. */
const SIMPLE_ASKS = ['arrive', 'win', 'defeat', 'talk', 'check', 'contract'];

/**
 * @typedef {Object} Milestone
 * @property {string} id
 * @property {number} act
 * @property {string} title
 * @property {string} hint   Lo que se ve en pantalla mientras está abierto.
 * @property {string} scene  Lo que el narrador cuenta al abrirse.
 * @property {{kind: string, place?: string, milestone?: string, id?: string, day?: number, faction?: string}} opens
 * @property {{kind: string, place?: string, board?: string, enemy?: string, npc?: string, skill?: string, id?: string, faction?: string, against?: boolean, options?: any[], need?: number, clues?: Array<{place: string, skill: string}>}} asks
 *   `options`: las formas de un `any` (idea 101). `clues` y `need`: las pistas de una investigación (idea 107).
 * @property {{reveal: string[], open: string[], standing: Record<string, number>, ending: string, endingBy: Record<string, string>, close: string[]}} changes
 *   `endingBy`: el final depende de con quien os hayais aliado — la faccion que mejor os
 *   mira, de entre estas, decide cual. `ending` es el de reserva. `close`: los hitos que
 *   se cierran al cumplir este (idea 102).
 * @property {boolean} hidden Idea 111: no se ve hasta que se cumple.
 * @property {number} within  Idea 106: días para cumplirlo desde que se abre; 0 es sin plazo.
 * @property {{reveal: string[], open: string[], standing: Record<string, number>}} late
 *   Lo que pasa si se pasa el plazo.
 * @property {string[]} [backgrounds] Idea 105: solo se abre si el héroe tiene uno de estos trasfondos.
 * @property {boolean} [prologue] J2.1: es del prólogo. El último que pide ganar un tablero es la
 *   prueba, y ganarla da el prólogo entero por hecho (`prologueOf`).
 * @property {any[]} [beats] J9.2: la escena escrita, línea a línea, con sus decisiones
 *   (`plot-scenes.js`). Sin ella, se cuenta `scene`.
 * @property {string} [sceneDialogue] J9.2: la charla del paquete que se abre al acabar la escena.
 * @property {string} [backdrop] J9.2: dónde pasa la escena, para el fondo.
 * @property {any} [presenta] J13.7: en un hito de texto, quién se da a conocer en él.
 * @property {boolean|string} [irreversible] J11.1: se avisa antes de cumplirlo, aunque no cierre
 *   nada: «Esto no tiene vuelta atrás» (o el aviso escrito).
 */

/**
 * @typedef {Object} Plot
 * @property {string} title
 * @property {'written'|'faction'} source
 * @property {Milestone[]} milestones
 * @property {Record<string, {title: string, scene: string, who?: string, epilogues?: Array<{who: string, text: string}>, legacy?: any}>} endings
 *   Lo que se cuenta en cada final; `epilogues`, qué fue de la gente (J4.5).
 * @property {Array<{text: string, milestone: string}>} omens Idea 114: el presagio del principio.
 * @property {any} [villain] Idea 115: el villano que se deja ver entre actos.
 * @property {Chapter[]} [chapters] J9.3: el nombre de cada acto, si el hilo los trae. Con ellos,
 *   el hilo puede tener más de tres actos (hasta `MAX_ACTS`), uno por capítulo.
 */

/**
 * @typedef {Object} Chapter J9.3: un capítulo (un acto) con su nombre.
 * @property {number} act
 * @property {string} title
 * @property {string} summary De qué va, en una o dos frases, para el Diario. Puede ir vacío.
 */

/** J9.3: sin capítulos, un hilo tiene tres actos; con ellos, tantos como traiga, hasta aquí. */
export const MAX_ACTS = 9;

/**
 * J9.3: los capítulos de un hilo, leídos con tolerancia: `chapters` (`act`, `title`, `summary`)
 * o, como los escribe un Gem en español, `capitulos` (`acto`, `titulo`, `resumen`). Uno por
 * acto (vale el primero), en orden; sin título, no cuenta.
 *
 * @param {any} raw El hilo, o su lista de capítulos.
 * @returns {Chapter[]}
 */
export function readChapters(raw) {
    const list = Array.isArray(raw) ? raw
        : Array.isArray(raw?.chapters) ? raw.chapters
            : Array.isArray(raw?.capitulos) ? raw.capitulos : [];
    /** @type {Map<number, Chapter>} */
    const byAct = new Map();
    for (const row of list) {
        const act = Math.floor(Number(row?.act ?? row?.acto) || 0);
        const title = text(row?.title ?? row?.titulo);
        if (act < 1 || act > MAX_ACTS || !title || byAct.has(act)) continue;
        byAct.set(act, { act, title, summary: text(row?.summary ?? row?.resumen) });
    }
    return [...byAct.values()].sort((a, b) => a.act - b.act);
}

/**
 * @typedef {{open: string[], done: string[], missed: string[], since: Record<string, number>, closed: string[], clues: Record<string, number[]>}} PlotState
 *   `missed`: los que se perdieron por plazo. `since`: el día en que se abrió cada uno.
 *   `closed`: los que cerró una bifurcación (idea 102). `clues`: las pistas halladas de cada
 *   investigación, por su número (idea 107).
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
 * @param {number} [ceiling] J9.3: el acto más alto que vale; tres, salvo que el hilo traiga más capítulos.
 * @returns {Milestone|null}
 */
function readMilestone(raw, index, ceiling = 3) {
    if (!raw || typeof raw !== 'object') return null;
    const title = text(raw.title);
    const id = text(raw.id) || (title ? `hito_${index + 1}` : '');
    if (!id || !title) return null;

    const opens = raw.opens && typeof raw.opens === 'object' ? raw.opens : { kind: 'after' };
    const rawAsks = raw.asks && typeof raw.asks === 'object' ? raw.asks : { kind: 'none' };
    // Idea 101: las formas de un `any`, cada una de las que se sabe mirar.
    const options = (Array.isArray(rawAsks.options) ? rawAsks.options : [])
        .filter((/** @type {any} */ o) => o && SIMPLE_ASKS.includes(text(o.kind)))
        .map((/** @type {any} */ o) => ({ ...o, kind: text(o.kind) }));
    // Idea 107: las pistas de una investigación, cada una en un sitio y con una tirada.
    const clues = (Array.isArray(rawAsks.clues) ? rawAsks.clues : [])
        .filter((/** @type {any} */ c) => text(c?.place) && text(c?.skill))
        .map((/** @type {any} */ c) => ({ place: text(c.place), skill: text(c.skill) }));
    const askKind = text(rawAsks.kind) === 'any' && options.length === 0 ? 'none'
        : text(rawAsks.kind) === 'clues' && clues.length === 0 ? 'none'
            : text(rawAsks.kind);
    const asks = {
        ...rawAsks,
        kind: askKind,
        ...(askKind === 'any' ? { options } : {}),
        ...(askKind === 'clues' ? { clues, need: Math.max(1, Math.min(clues.length, Math.floor(Number(rawAsks.need) || clues.length))) } : {}),
    };
    const changes = raw.changes && typeof raw.changes === 'object' ? raw.changes : {};
    const list = (/** @type {any} */ v) => (Array.isArray(v) ? v.map(text).filter(Boolean) : []);

    /** @type {Record<string, string>} */
    const endingBy = {};
    for (const [faction, ending] of Object.entries(changes.endingBy ?? {})) {
        if (text(faction) && text(ending)) endingBy[text(faction)] = text(ending);
    }

    /** @param {any} source @returns {Record<string, number>} */
    const standingOf = (source) => {
        /** @type {Record<string, number>} */
        const out = {};
        for (const [faction, amount] of Object.entries(source ?? {})) {
            const n = Math.round(Number(amount) || 0);
            if (n !== 0) out[text(faction)] = n;
        }
        return out;
    };
    const standing = standingOf(changes.standing);
    const late = raw.late && typeof raw.late === 'object' ? raw.late : {};

    return {
        id,
        act: Math.max(1, Math.min(ceiling, Math.floor(Number(raw.act) || 1))),
        title,
        hint: text(raw.hint),
        scene: text(raw.scene),
        // Idea 184: para qué trasfondos es; vacío, para todos.
        backgrounds: list(raw.backgrounds),
        opens: { ...opens, kind: OPENS.includes(text(opens.kind)) ? text(opens.kind) : 'after' },
        asks: { ...asks, kind: ASKS.includes(text(asks.kind)) ? text(asks.kind) : 'none' },
        changes: {
            reveal: list(changes.reveal), open: list(changes.open), standing, ending: text(changes.ending), endingBy,
            close: list(changes.close),
        },
        hidden: Boolean(raw.hidden),
        within: Math.max(0, Math.floor(Number(raw.within) || 0)),
        late: { reveal: list(late.reveal), open: list(late.open), standing: standingOf(late.standing) },
        // J2.1: solo si lo es, para que un hilo de antes se lea igual que siempre.
        ...(raw.prologue ? { prologue: true } : {}),
        // J11.1: pesa aunque no cierre nada ni acabe la campaña: se avisa antes (`weighty.js`).
        ...(raw.irreversible === true || (typeof raw.irreversible === 'string' && text(raw.irreversible))
            ? { irreversible: raw.irreversible === true ? true : text(raw.irreversible) } : {}),
        // J9.2: la escena jugada, si la trae. Se guarda tal cual; la lee `plot-scenes.js`.
        ...(Array.isArray(raw.beats) && raw.beats.length > 0 ? { beats: raw.beats } : {}),
        ...(text(raw.sceneDialogue) ? { sceneDialogue: text(raw.sceneDialogue) } : {}),
        ...(text(raw.backdrop) ? { backdrop: text(raw.backdrop) } : {}),
        // J13.7: en un hito de texto, quién se da a conocer en él (no tiene líneas donde ponerlo).
        ...(raw.presenta != null && raw.presenta !== '' ? { presenta: raw.presenta } : {}),
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
    // J9.3: con capítulos, el hilo tiene tantos actos como capítulos; sin ellos, tres.
    const chapters = readChapters(raw);
    const ceiling = Math.max(3, ...chapters.map(c => c.act));
    const milestones = (Array.isArray(raw.milestones) ? raw.milestones : [])
        .map((/** @type {any} */ m, /** @type {number} */ i) => readMilestone(m, i, ceiling))
        .filter(/** @returns {m is Milestone} */ m => m !== null);
    if (milestones.length === 0) return null;
    /** @type {Record<string, {title: string, scene: string, who?: string, epilogues?: Array<{who: string, text: string}>, legacy?: any}>} */
    const endings = {};
    for (const [id, ending] of Object.entries(raw.endings ?? {})) {
        if (text(id) && ending && typeof ending === 'object') {
            // J4.5: qué fue de la gente con este final, si el paquete lo escribe (D-J18: también
            // como `epilogos`, con `quien` y `texto`).
            const epilogues = epiloguesOf(ending);
            // J11.4: lo que el gremio recordará de este final (`legacy`, o `legado`), tal cual:
            // lo lee `guild-memory.js`.
            const legacy = /** @type {any} */ (ending).legacy ?? /** @type {any} */ (ending).legado;
            // Tanda 22 (D-J60): quién cuenta el final; sin conexión, la escena la dice él.
            const who = text(/** @type {any} */ (ending).who ?? /** @type {any} */ (ending).quien);
            endings[text(id)] = {
                title: text(/** @type {any} */ (ending).title), scene: text(/** @type {any} */ (ending).scene),
                ...(who ? { who } : {}),
                ...(epilogues.length > 0 ? { epilogues } : {}),
                ...(legacy && typeof legacy === 'object' && !Array.isArray(legacy) ? { legacy } : {}),
            };
        }
    }
    const ids = new Set(milestones.map(m => m.id));
    const omens = (Array.isArray(raw.omens) ? raw.omens : [])
        .map((/** @type {any} */ o) => ({ text: text(o?.text), milestone: text(o?.milestone) }))
        .filter((/** @type {{text: string, milestone: string}} */ o) => o.text && ids.has(o.milestone))
        .slice(0, 3);
    return {
        title: text(raw.title),
        source: raw.source === 'faction' ? 'faction' : 'written',
        milestones,
        endings,
        omens,
        // Idea 115: el villano y cuándo asoma. Lo lee `villain.js`.
        villain: raw.villain && typeof raw.villain === 'object' ? raw.villain : null,
        // J9.3: solo si los trae, para que un hilo de antes se lea igual que siempre.
        ...(chapters.length > 0 ? { chapters } : {}),
    };
}

/**
 * @param {any} raw
 * @returns {PlotState}
 */
export function readPlotState(raw) {
    const list = (/** @type {any} */ v) => (Array.isArray(v) ? [...new Set(v.map(text).filter(Boolean))] : []);
    /** @type {Record<string, number>} */
    const since = {};
    for (const [id, day] of Object.entries(raw?.since && typeof raw.since === 'object' ? raw.since : {})) {
        const n = Math.floor(Number(day) || 0);
        if (text(id) && n > 0) since[text(id)] = n;
    }
    /** @type {Record<string, number[]>} */
    const clues = {};
    for (const [id, found] of Object.entries(raw?.clues && typeof raw.clues === 'object' ? raw.clues : {})) {
        const indexes = (Array.isArray(found) ? found : []).map(n => Math.floor(Number(n))).filter(n => Number.isFinite(n) && n >= 0);
        if (text(id) && indexes.length > 0) clues[text(id)] = [...new Set(indexes)];
    }
    return { open: list(raw?.open), done: list(raw?.done), missed: list(raw?.missed), since, closed: list(raw?.closed), clues };
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
        // Idea 101: cualquiera de sus formas lo cumple.
        case 'any':
            return (asks.options ?? []).some(option => asksFor(option, event));
        case 'arrive':
            return kind === 'arrive' && lower(event.place) === lower(asks.place);
        case 'win':
            return kind === 'win'
                && (!asks.place || lower(event.place) === lower(asks.place))
                && (!asks.board || lower(event.board) === lower(asks.board));
        case 'defeat':
            return kind === 'defeat' && lower(event.enemy).startsWith(lower(asks.enemy));
        case 'talk':
            // Se habla con alguien estando donde está: pulsando «Hablar con…» (`talk`, sin que
            // haga falta modelo) o nombrándole en un mensaje (`say`). El motor no sabe de qué
            // se habla, pero sí a quién se dirige quien juega. Antes solo contaba el mensaje,
            // y sin modelo no se envía: 1387 se paraba en su hito 2 (ROADMAP_SIN_TOKENS, Z0).
            return Boolean(asks.npc)
                && ((kind === 'say' && lower(event.text).includes(lower(asks.npc)))
                    || (kind === 'talk' && lower(event.npc) === lower(asks.npc)))
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
 * @property {Milestone[]} missed Los que se acaban de perder por plazo (idea 106).
 * @property {string[]} omens     Las frases del presagio que se acaban de cumplir (idea 114).
 * @property {Milestone[]} closed Los que cierra una bifurcación (idea 102).
 * @property {Record<string, string>} via Cómo se cumplió cada uno de un `any` (idea 101).
 * @property {Array<{milestone: Milestone, found: number, need: number, clue: {place: string, skill: string}}>} clues
 *   Las pistas que se acaban de encontrar (idea 107).
 * @property {Milestone[]} skipped J2.1: los del prólogo que se dan por hechos sin contarse, porque
 *   se ganó la prueba sin haberlos jugado (saltándola, o entrando en su tablero por tu cuenta).
 * @property {{reveal: string[], standing: Record<string, number>, ending: string, endingBy: Record<string, string>}} changes
 */

/**
 * Abrir un hito, y los que se cumplen solos al abrirse, y lo que eso abra.
 *
 * @param {Plot} plot
 * @param {PlotState} state
 * @param {Milestone[]} toOpen
 * @param {PlotStep} step
 * @param {number} [today] Para apuntar desde cuándo está abierto: es lo que mide el plazo.
 */
function openAll(plot, state, toOpen, step, today = 0) {
    const queue = [...toOpen];
    // Un hito que se abre a sí mismo en círculo no puede colgar la partida.
    for (let guard = 0; queue.length > 0 && guard < 200; guard++) {
        const milestone = /** @type {Milestone} */ (queue.shift());
        if (state.open.includes(milestone.id) || state.done.includes(milestone.id)) continue;
        // Lo que cerró una bifurcación no vuelve a abrirse (idea 102).
        if (state.closed.includes(milestone.id)) continue;
        // Con un final ya alcanzado no se abre nada más: «llegasteis tarde» no puede
        // pasar después de haberlos parado.
        if (hasEnded(plot, state)) break;
        state.open.push(milestone.id);
        if (today > 0) state.since[milestone.id] = today;
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
    const done = readPlotState(state).done;
    return plot.milestones.some(m => (m.changes.ending || Object.keys(m.changes.endingBy).length > 0)
        && done.includes(m.id));
}

/**
 * Cual de los finales toca, visto lo que piensan de vosotros.
 *
 * Con `endingBy`, gana la faccion que mejor os mira de entre las que tienen final: con
 * quien os habeis aliado es lo que decide como acaba. Sin nada que decidir, el de reserva.
 *
 * @param {{ending: string, endingBy: Record<string, string>}} changes
 * @param {any[]} factions
 * @returns {string}
 */
export function chooseEnding(changes, factions) {
    const options = Object.entries(changes?.endingBy ?? {});
    if (options.length === 0) return text(changes?.ending);
    const standing = new Map(readFactions(factions).map(f => [f.id, f.reputation]));
    const best = options
        .map(([faction, ending], index) => ({ ending, index, value: standing.get(faction) ?? -Infinity }))
        .sort((a, b) => b.value - a.value || a.index - b.index)[0];
    return best && best.value > -Infinity ? best.ending : (text(changes?.ending) || options[0][1]);
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
    if (Object.keys(milestone.changes.endingBy).length > 0) step.changes.endingBy = milestone.changes.endingBy;
    for (const omen of plot.omens ?? []) if (omen.milestone === milestone.id) step.omens.push(omen.text);
    // Idea 102: los caminos que cierra.
    const byIdAll = new Map(plot.milestones.map(m => [m.id, m]));
    for (const id of milestone.changes.close ?? []) {
        const closing = byIdAll.get(id);
        if (!closing || state.done.includes(id) || state.closed.includes(id)) continue;
        state.open = state.open.filter(open => open !== id);
        state.closed.push(id);
        step.closed.push(closing);
    }

    const byId = new Map(plot.milestones.map(m => [m.id, m]));
    return [
        ...milestone.changes.open.map(id => byId.get(id)).filter(/** @returns {m is Milestone} */ m => Boolean(m)),
        ...plot.milestones.filter(m => m.opens.kind === 'after' && m.opens.milestone === milestone.id),
    ];
}

/** @returns {PlotStep} */
function emptyStep(/** @type {PlotState} */ state) {
    return { state, opened: [], done: [], missed: [], omens: [], closed: [], via: {}, clues: [], skipped: [], changes: { reveal: [], standing: {}, ending: '', endingBy: {} } };
}

/**
 * J2.1: el prólogo de un hilo, si lo escribe: sus hitos, en el orden en que están escritos, y
 * la prueba, que es el último de ellos que pide ganar un tablero (en el gremio, la bodega).
 *
 * Vale también con el hilo sin leer: mira `prologue`, `hidden` y `asks` tal y como vengan.
 *
 * @param {any} plot
 * @returns {{milestones: any[], trial: any|null}}
 */
export function prologueOf(plot) {
    const milestones = (Array.isArray(plot?.milestones) ? plot.milestones : []).filter((/** @type {any} */ m) => m && m.prologue && text(m.id));
    const trial = [...milestones].reverse().find(m => !m.hidden && lower(m.asks?.kind) === 'win' && text(m.asks?.board)) ?? null;
    return { milestones, trial };
}

/**
 * J2.1: ganar la prueba con el prólogo a medias lo cierra entero. Lo que faltaba se da por
 * hecho sin contarse, y la prueba queda abierta para que el suceso la cumpla como siempre: así
 * saltarla (J2.3) y bajar a la bodega por tu cuenta acaban igual que jugarlo, y nadie se queda
 * con un hito que pide ganar un tablero ya ganado.
 *
 * @param {Plot} plot
 * @param {PlotState} state
 * @param {any} event
 * @param {PlotStep} step
 * @returns {Milestone[]} Lo que abren los hitos dados por hechos, fuera del prólogo.
 */
function settlePrologue(plot, state, event, step) {
    const { milestones, trial } = prologueOf(plot);
    if (!trial || state.open.includes(trial.id) || state.done.includes(trial.id) || state.closed.includes(trial.id)
        || state.missed.includes(trial.id) || !asksFor(trial.asks, event)) return [];
    // Solo con el prólogo empezado: antes de empezar, o ya terminado, no hay nada que cerrar.
    if (!milestones.some(m => state.open.includes(m.id))) return [];
    const inPrologue = new Set(milestones.map(m => m.id));
    /** @type {Milestone[]} */
    const next = [];
    for (const milestone of milestones) {
        if (milestone === trial || milestone.hidden || state.done.includes(milestone.id)
            || state.closed.includes(milestone.id) || state.missed.includes(milestone.id)) continue;
        next.push(...complete(plot, state, milestone, step));
        // Hecho, pero sin contarlo: su escena es de un camino que no se ha jugado.
        step.done = step.done.filter(m => m !== milestone);
        step.skipped.push(milestone);
    }
    if (!state.open.includes(trial.id)) state.open.push(trial.id);
    return next.filter(m => !inPrologue.has(m.id));
}

/**
 * Empezar: se abren los hitos que se abren al empezar. El primero es la mecha.
 *
 * @param {Plot} plot
 * @param {number} [today] El día en que empieza, para los plazos.
 * @returns {PlotStep}
 */
export function startPlot(plot, today = 1) {
    const state = readPlotState(null);
    const step = emptyStep(state);
    openAll(plot, state, plot.milestones.filter(m => m.opens.kind === 'start'), step, today);
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
 * @param {any} event `{kind: 'arrive'|'win'|'defeat'|'say'|'talk'|'check'|'contract'|'day'|'clock'|'milestone', …}`
 *   `milestone` (J8.1): `{kind: 'milestone', id}`, lo que manda una charla escrita: cumple ese hito si está abierto.
 * @param {number} [today] Hoy. Un suceso `day` trae el suyo; sin día, los plazos no se miden.
 * @returns {PlotStep}
 */
export function plotEvent(plot, rawState, event, today = 0) {
    const state = readPlotState(rawState);
    const step = emptyStep(state);
    if (!plot) return step;
    const now = text(event?.kind) === 'day' ? Math.floor(Number(event.day) || 0) : Math.floor(Number(today) || 0);

    const byId = new Map(plot.milestones.map(m => [m.id, m]));
    /** @type {Milestone[]} */
    const next = [];
    // J2.1: la prueba ganada con el prólogo a medias lo cierra entero, antes de mirar lo abierto.
    next.push(...settlePrologue(plot, state, event, step));
    for (const id of [...state.open]) {
        const milestone = byId.get(id);
        if (!milestone || !state.open.includes(id)) continue;
        // J8.1: una charla escrita cumple un hito abierto por su id (`{kind: 'milestone', id}`),
        // pida lo que pida: el de «habla con Giles» se cumple cuando Giles lo cuenta, no al saludar.
        if (text(event?.kind) === 'milestone') {
            if (lower(event.id) === lower(id)) next.push(...complete(plot, state, milestone, step));
            continue;
        }
        // Idea 107: una pista más, si la tirada es la de una pista de aquí que falta.
        if (milestone.asks.kind === 'clues') {
            if (text(event?.kind) !== 'check' || !event.success) continue;
            const found = state.clues[id] ?? [];
            const index = (milestone.asks.clues ?? []).findIndex((clue, i) => !found.includes(i)
                && lower(clue.skill) === lower(event.skill)
                && (!clue.place || lower(clue.place) === lower(event.place)));
            if (index < 0) continue;
            state.clues[id] = [...found, index];
            const need = milestone.asks.need ?? (milestone.asks.clues ?? []).length;
            step.clues.push({ milestone, found: state.clues[id].length, need, clue: (milestone.asks.clues ?? [])[index] });
            if (state.clues[id].length >= need) next.push(...complete(plot, state, milestone, step));
            continue;
        }
        if (asksFor(milestone.asks, event)) {
            // Idea 101: de las formas, cuál fue.
            if (milestone.asks.kind === 'any') {
                const way = (milestone.asks.options ?? []).find(option => asksFor(option, event));
                if (way) step.via[milestone.id] = way.kind;
            }
            next.push(...complete(plot, state, milestone, step));
        }
    }
    // Idea 106: lo que tenía plazo y no se hizo a tiempo se pierde, y pasa lo que diga.
    // D-J46: con los plazos apagados no se pierde nada.
    if (text(event?.kind) === 'day' && now > 0) {
        for (const id of [...state.open]) {
            const milestone = byId.get(id);
            const opened = state.since[id];
            if (!milestone || !hasDeadline(milestone) || !opened || now <= opened + milestone.within) continue;
            state.open = state.open.filter(open => open !== id);
            if (!state.missed.includes(id)) state.missed.push(id);
            step.missed.push(milestone);
            step.changes.reveal.push(...milestone.late.reveal);
            for (const [faction, amount] of Object.entries(milestone.late.standing)) {
                step.changes.standing[faction] = (step.changes.standing[faction] ?? 0) + amount;
            }
            next.push(...milestone.late.open.map(open => byId.get(open)).filter(/** @returns {m is Milestone} */ m => Boolean(m)));
        }
    }
    next.push(...plot.milestones.filter(m => opensWith(m.opens, event)));
    openAll(plot, state, next, step, now);
    return step;
}

/**
 * Lo que tienes entre manos: el hito abierto del acto más temprano.
 *
 * Lo oculto no cuenta (idea 111). Con `today`, dice cuántos días quedan si tiene plazo.
 *
 * @param {Plot|null} plot
 * @param {any} rawState
 * @param {number} [today]
 * @returns {{id: string, act: number, title: string, hint: string, daysLeft: number|null}|null}
 */
export function focusOf(plot, rawState, today = 0) {
    if (!plot) return null;
    const state = readPlotState(rawState);
    const open = plot.milestones.filter(m => state.open.includes(m.id) && !m.hidden);
    const first = open.sort((a, b) => a.act - b.act
        || plot.milestones.indexOf(a) - plot.milestones.indexOf(b))[0];
    if (!first) return null;
    return { id: first.id, act: first.act, title: first.title, hint: first.hint, daysLeft: daysLeftOf(plot, state, first.id, today) };
}

/**
 * Cuántos días le quedan a un hito con plazo (idea 106). Null si no tiene, o si no se sabe
 * qué día es.
 *
 * @param {Plot|null} plot
 * @param {any} rawState
 * @param {string} id
 * @param {number} today
 * @returns {number|null}
 */
export function daysLeftOf(plot, rawState, id, today) {
    const milestone = plot?.milestones.find(m => m.id === id);
    const opened = readPlotState(rawState).since[id];
    // D-J46: con los plazos apagados, ninguno tiene.
    if (!milestone || !hasDeadline(milestone) || !opened || !(Number(today) > 0)) return null;
    return Math.max(0, opened + milestone.within - Math.floor(Number(today)));
}

/**
 * Los hitos abiertos que se ven: todos menos los ocultos (idea 111).
 *
 * @param {Plot|null} plot
 * @param {any} rawState
 * @returns {Milestone[]}
 */
export function visibleOpen(plot, rawState) {
    if (!plot) return [];
    const state = readPlotState(rawState);
    return plot.milestones.filter(m => state.open.includes(m.id) && !m.hidden);
}

/**
 * Las investigaciones abiertas: cuántas pistas van, y dónde y con qué faltan (idea 107).
 *
 * @param {Plot|null} plot
 * @param {any} rawState
 * @returns {Array<{id: string, title: string, found: number, need: number, missing: Array<{place: string, skill: string}>}>}
 */
export function cluesOf(plot, rawState) {
    if (!plot) return [];
    const state = readPlotState(rawState);
    return plot.milestones
        .filter(m => m.asks.kind === 'clues' && state.open.includes(m.id) && !m.hidden)
        .map(m => {
            const found = state.clues[m.id] ?? [];
            return {
                id: m.id,
                title: m.title,
                found: found.length,
                need: m.asks.need ?? (m.asks.clues ?? []).length,
                missing: (m.asks.clues ?? []).filter((_, i) => !found.includes(i)),
            };
        });
}

/**
 * Los caminos que se cerraron por una bifurcación (idea 102).
 *
 * @param {Plot|null} plot
 * @param {any} rawState
 * @returns {string[]}
 */
export function closedOf(plot, rawState) {
    if (!plot) return [];
    const state = readPlotState(rawState);
    return plot.milestones.filter(m => state.closed.includes(m.id)).map(m => m.title);
}

/**
 * Los secretos de la historia: cuántos hay y cuáles se han encontrado (idea 111).
 *
 * @param {Plot|null} plot
 * @param {any} rawState
 * @returns {{found: string[], total: number}}
 */
export function secretsOf(plot, rawState) {
    if (!plot) return { found: [], total: 0 };
    const state = readPlotState(rawState);
    const hidden = plot.milestones.filter(m => m.hidden);
    return { found: hidden.filter(m => state.done.includes(m.id)).map(m => m.title), total: hidden.length };
}

/**
 * El presagio, frase a frase, y si ya se ha cumplido (idea 114).
 *
 * @param {Plot|null} plot
 * @param {any} rawState
 * @returns {Array<{text: string, fulfilled: boolean}>}
 */
export function omensOf(plot, rawState) {
    if (!plot) return [];
    const state = readPlotState(rawState);
    return (plot.omens ?? []).map(o => ({ text: o.text, fulfilled: state.done.includes(o.milestone) }));
}

/**
 * En qué acto va la partida: el más alto que se ha tocado.
 *
 * Los secretos (idea 111) no cuentan: se abren al empezar para poder encontrarse en cualquier
 * momento, y el de Strahd, del acto 3, ponía la partida en el acto 3 desde el primer día (J9.3).
 *
 * @param {Plot|null} plot
 * @param {any} rawState
 * @returns {number}
 */
export function actOf(plot, rawState) {
    if (!plot) return 1;
    const state = readPlotState(rawState);
    const touched = plot.milestones.filter(m => !m.hidden && (state.open.includes(m.id) || state.done.includes(m.id)));
    return touched.reduce((max, m) => Math.max(max, m.act), 1);
}

/**
 * La línea para la pantalla y para el narrador.
 *
 * @param {{title: string, hint: string, daysLeft?: number|null}|null} focus
 * @returns {string}
 */
export function describeFocus(focus) {
    if (!focus) return '';
    const base = focus.hint ? `${focus.title} — ${focus.hint}` : focus.title;
    // Idea 106: un plazo se dice siempre, que es lo que lo hace un plazo y no una sorpresa.
    if (focus.daysLeft == null) return base;
    return `${base} · ${focus.daysLeft === 0 ? 'hoy es el último día' : `quedan ${focus.daysLeft} día(s)`}`;
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
