/**
 * La historia de una campaña, como un libro (J9.3, J9.5, J9.6 y J11.5 de
 * wiki/ROADMAP_SIN_CONEXION.md).
 *
 * El Diario era una lista de avisos por secciones: lo que tenéis entre manos, lo oído, la
 * crónica del chat. Aquí se lee como un libro:
 *
 * - **Capítulos** (J9.3): los actos del hilo, con el nombre que traiga `plot.chapters`. El que
 *   todavía no ha empezado sale en blanco, sin nombre, para no destripar nada. El tablón del
 *   gremio dice por cuál vais (`guildChapterLine`).
 * - **Plazos a la vista** (J9.5): cada hito con reloj dice cuánto le queda y cómo de cerca está
 *   (`deadlinesOf`, `focusClock`).
 * - **El libro** (J9.6): cada hito es una página con lo que pasó, lo que decidisteis en él y lo
 *   que salió de ello. En cada capítulo, además, lo decidido en los sucesos, lo que os contaron,
 *   lo vivido con los vuestros y lo que movió la historia en el chat (la crónica).
 * - **La crónica consultable** (J11.5): lo que decidisteis y lo que salió de ello, por campaña.
 *   Al volver al gremio se guarda una copia corta del libro (`withChronicle`), para leerla desde
 *   el tablón sin abrir la campaña.
 *
 * Nada de lo que no ha pasado se cuenta: un hito sin abrir no sale, un secreto sin encontrar
 * tampoco, y un capítulo sin empezar es una página en blanco.
 *
 * Puro: de lo guardado a lo que se lee. Lo dibuja `ui/story-book.js`.
 */

import { readPlot, readPlotState, readChapters, MAX_ACTS, hasDeadline } from './plot.js';
import { resolveGender } from './grammar.js';
import { chronicleOf } from './chronicle.js';
import { readDialogueMemory } from './dialogues.js';
import { readMemories } from './memories.js';
import { readDeeds } from './world-memory.js';
import { readFactions, saysWith } from './factions.js';
import { sceneBackdrop } from './plot-scenes.js';

/**
 * Dónde guarda la partida cada cosa que lee el libro. Son las mismas claves que
 * `party/keys.js` (las pruebas lo comprueban); aquí van copiadas para que el motor no dependa
 * de `party/`.
 */
export const BOOK_KEYS = {
    plot: 'plot',
    plotState: 'plotState',
    decisions: 'plotDecisions',
    dialogues: 'dialogues',
    memories: 'sharedMemories',
    deeds: 'deeds',
    actStarts: 'actStarts',
    ending: 'plotEnding',
};

/** J11.5: en los metadatos del mundo del gremio, la crónica de cada campaña, por su id del tablón. */
export const HUB_CHRONICLES_KEY = 'hubChronicles';

/** Cuánto cabe: en cada capítulo y en la copia que se guarda en el gremio. */
export const BOOK_LIMITS = { road: 8, told: 12, moments: 8, decisions: 300, came: 6, snapshotText: 360, snapshotDecided: 80, snapshotPages: 24 };

/**
 * Lo que dejó la crónica del chat que es historia y no aviso: una muerte, alguien que se va,
 * subir de nivel, el villano, un secreto, un presagio cumplido, el mundo que cambia. El hilo no
 * entra (sus escenas ya son las páginas), ni las tiradas, ni el comercio.
 */
const STORY_TAGS = new Set(['MUERTE', 'SE VA', 'HARTO', 'NIVEL', 'VILLANO', 'SECRETO', 'PRESAGIO', 'EL MUNDO CAMBIA', 'RELIQUIA', 'NEMESIS', 'DUELO', 'ENCARGO PERSONAL']);

/** Cómo se dice cada resultado de una tirada en la crónica. */
const OUTCOME_WORDS = { bien: 'salió bien', medias: 'salió a medias', mal: 'salió mal' };

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {number} */
const whole = (value) => Math.max(0, Math.floor(Number(value) || 0));

/** @param {string} value @param {number} max @returns {string} */
const cut = (value, max) => (value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value);

/**
 * «A», «A y B», «A, B y C».
 *
 * @param {string[]} items
 * @returns {string}
 */
export function listOf(items) {
    const list = (items ?? []).map(text).filter(Boolean);
    if (list.length <= 1) return list[0] ?? '';
    return `${list.slice(0, -1).join(', ')} y ${list[list.length - 1]}`;
}

/** @param {string[]} titles @returns {string} */
const quoted = (titles) => listOf(titles.map(t => `«${t}»`));

// ---------------------------------------------------------------------------------------------
// J9.3: los capítulos
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} ChapterFrame Un capítulo del libro, antes de llenarlo.
 * @property {number} act
 * @property {number} number El orden en el libro: 1, 2, 3…
 * @property {string} name   «Capítulo 2».
 * @property {string} title  Su nombre, si la campaña lo trae. «El prólogo» si es el prólogo.
 * @property {string} summary De qué va, si la campaña lo trae.
 */

/**
 * Los capítulos de un hilo: uno por acto con hitos a la vista, más los que la campaña nombra.
 *
 * @param {any} plot El hilo, leído (`readPlot`) o no.
 * @returns {ChapterFrame[]}
 */
export function chapterFrames(plot) {
    const milestones = Array.isArray(plot?.milestones) ? plot.milestones : [];
    const declared = new Map(readChapters(plot).map(c => [c.act, c]));
    const actOf = (/** @type {any} */ m) => Math.max(1, Math.min(MAX_ACTS, Math.floor(Number(m?.act) || 1)));
    const acts = [...new Set([...milestones.filter((/** @type {any} */ m) => m && !m.hidden).map(actOf), ...declared.keys()])]
        .sort((a, b) => a - b);
    if (acts.length === 0 && milestones.length > 0) acts.push(1);
    return acts.map((act, index) => {
        const own = declared.get(act);
        const inAct = milestones.filter((/** @type {any} */ m) => m && actOf(m) === act);
        // El gremio no nombra su único acto: empieza por el prólogo, y así se llama.
        const prologue = inAct.some((/** @type {any} */ m) => m.prologue);
        return {
            act,
            number: index + 1,
            name: `Capítulo ${index + 1}`,
            title: own?.title || (prologue ? 'El prólogo' : ''),
            summary: own?.summary ?? '',
        };
    });
}

/**
 * Hasta dónde ha llegado la historia: el acto más alto con algo abierto o hecho a la vista, o
 * el del final si ya se llegó a uno.
 *
 * @param {any} plot Leído.
 * @param {ReturnType<typeof readPlotState>} state
 * @returns {{act: number, ended: boolean}}
 */
function reached(plot, state) {
    const milestones = Array.isArray(plot?.milestones) ? plot.milestones : [];
    const ending = milestones.find((/** @type {any} */ m) => state.done.includes(m.id)
        && (text(m.changes?.ending) || Object.keys(m.changes?.endingBy ?? {}).length > 0));
    if (ending) return { act: Number(ending.act) || 1, ended: true };
    const touched = milestones.filter((/** @type {any} */ m) => !m.hidden && (state.open.includes(m.id) || state.done.includes(m.id) || state.missed.includes(m.id)));
    return { act: touched.reduce((max, m) => Math.max(max, Number(m.act) || 1), 0), ended: false };
}

/**
 * @typedef {Object} ChapterNow Por qué capítulo vais.
 * @property {number} act
 * @property {number} number
 * @property {number} of     Cuántos capítulos tiene el libro.
 * @property {string} name
 * @property {string} title
 * @property {string} label  «Capítulo 2 · El campamento vistani».
 * @property {string} line   «Capítulo 2 de 5: El campamento vistani».
 * @property {boolean} ended Si la historia ya llegó a un final.
 */

/**
 * J9.3: por qué capítulo vais.
 *
 * @param {any} plot
 * @param {any} rawState
 * @returns {ChapterNow|null} Nada sin hilo.
 */
export function chapterNow(plot, rawState) {
    // Leerlo otra vez no cambia uno ya leído, y a uno del paquete le pone los actos en su sitio.
    const read = readPlot(plot);
    const frames = chapterFrames(read);
    if (!read || frames.length === 0) return null;
    const at = reached(read, readPlotState(rawState));
    // El capítulo del acto al que se ha llegado; sin nada tocado todavía, el primero.
    const frame = [...frames].reverse().find(f => f.act <= at.act) ?? frames[0];
    const label = frame.title ? `${frame.name} · ${frame.title}` : frame.name;
    const line = frames.length > 1
        ? `${frame.name} de ${frames.length}${frame.title ? `: ${frame.title}` : ''}`
        : (frame.title || frame.name);
    return { act: frame.act, number: frame.number, of: frames.length, name: frame.name, title: frame.title, label, line, ended: at.ended };
}

/**
 * J9.3: lo que dice la tarjeta de una campaña empezada en el tablón del gremio: «Capítulo 2
 * de 5: El campamento vistani». Vacío si no hay hilo, si ya acabó (lo dice su final) o si es
 * de un solo capítulo sin nombre (no hay nada que contar).
 *
 * @param {any} plot
 * @param {any} rawState
 * @returns {string}
 */
export function guildChapterLine(plot, rawState) {
    const now = chapterNow(plot, rawState);
    if (!now || now.ended || (now.of <= 1 && !now.title)) return '';
    return now.line;
}

// ---------------------------------------------------------------------------------------------
// J9.5: los plazos
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} BookClock Un hito con plazo.
 * @property {string} id
 * @property {string} title
 * @property {number} left  Días que quedan (0: hoy es el último).
 * @property {number} of    Los días que tenía.
 * @property {'hoy'|'pronto'|'holgado'} urgency
 * @property {string} label «Quedan 2 días».
 * @property {string} line  «La nieve manchada»: quedan 2 días de 3.
 * @property {string} late  Qué pasa si se pasa, sin destripar.
 */

/**
 * «Quedan 3 días», «Queda 1 día», «Hoy es el último día».
 *
 * @param {number} left
 * @returns {string}
 */
export function daysLeftLabel(left) {
    const n = whole(left);
    return n === 0 ? 'Hoy es el último día' : n === 1 ? 'Queda 1 día' : `Quedan ${n} días`;
}

/**
 * J9.5: los hitos abiertos con plazo, del más apurado al más holgado. Los secretos no: no
 * se sabe que están ahí.
 *
 * @param {any} plot
 * @param {any} rawState
 * @param {number} today
 * @returns {BookClock[]}
 */
export function deadlinesOf(plot, rawState, today) {
    const read = readPlot(plot);
    const now = whole(today);
    if (!read || now < 1) return [];
    const state = readPlotState(rawState);
    // D-J46: con los plazos apagados (`STORY_DEADLINES` en plot.js) no hay ninguno que contar.
    return read.milestones
        .filter((/** @type {any} */ m) => !m.hidden && hasDeadline(m) && state.open.includes(m.id) && state.since[m.id])
        .map((/** @type {any} */ m) => {
            const left = Math.max(0, state.since[m.id] + m.within - now);
            const urgency = /** @type {BookClock['urgency']} */ (left === 0 ? 'hoy' : left <= Math.max(1, Math.ceil(m.within / 3)) ? 'pronto' : 'holgado');
            const label = daysLeftLabel(left);
            const late = (m.late?.open ?? []).length > 0
                ? 'Si se pasa el plazo, se pierde, y la historia sigue sin esperaros.'
                : 'Si se pasa el plazo, se pierde.';
            return {
                id: text(m.id),
                title: text(m.title),
                left,
                of: m.within,
                urgency,
                label,
                line: left === 0 ? `«${text(m.title)}»: hoy es el último día.` : `«${text(m.title)}»: ${label.toLowerCase()} de ${m.within}.`,
                late,
            };
        })
        .sort((a, b) => a.left - b.left || a.title.localeCompare(b.title));
}

/**
 * J9.5: el reloj que va junto a lo que tenéis entre manos: el del hito de la pantalla si tiene
 * plazo; si no, el más apurado de los demás.
 *
 * @param {any} plot
 * @param {any} rawState
 * @param {number} today
 * @param {string} [focusId] El hito de la pantalla (`focusOf`).
 * @returns {BookClock|null}
 */
export function focusClock(plot, rawState, today, focusId = '') {
    const clocks = deadlinesOf(plot, rawState, today);
    return clocks.find(c => c.id === text(focusId)) ?? clocks[0] ?? null;
}

// ---------------------------------------------------------------------------------------------
// J9.6: lo decidido
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} DecisionEntry Lo que se guarda de una decisión (`plotDecisions`).
 * @property {number} day
 * @property {string} text  «El ratero del muelle: «¡Quieto ahí!»».
 * @property {string} milestone El hito en cuya escena se decidió, si se sabe.
 * @property {number} act   Su acto, si se sabe.
 * @property {string[]} came Lo que salió de ello: «Tomás os mira mejor», «+5 de oro».
 */

/**
 * Lo decidido, tal como se guarda: antes de J9.6 era `{day, text}` o un texto suelto; ahora
 * puede traer el hito, su acto y lo que salió de ello.
 *
 * @param {any} raw
 * @returns {DecisionEntry[]}
 */
export function readDecisions(raw) {
    return (Array.isArray(raw) ? raw : [])
        .map(entry => (typeof entry === 'string' ? { text: entry } : entry))
        .filter(entry => entry && typeof entry === 'object' && text(entry.text))
        .map(entry => ({
            day: whole(entry.day),
            text: text(entry.text),
            milestone: text(entry.milestone),
            act: Math.min(MAX_ACTS, whole(entry.act)),
            came: (Array.isArray(entry.came) ? entry.came : []).map(text).filter(Boolean).slice(0, BOOK_LIMITS.came),
        }));
}

/**
 * Apuntar lo decidido: lo de antes y lo nuevo, sin repetir lo que ya está (mismo día, mismo
 * texto, mismo hito), y sin pasar de `BOOK_LIMITS.decisions` (se olvida lo más viejo).
 *
 * @param {any} before
 * @param {any[]} entries
 * @returns {DecisionEntry[]}
 */
export function recordDecisions(before, entries) {
    const list = readDecisions(before);
    const seen = new Set(list.map(e => `${e.day}|${e.milestone}|${e.text}`));
    for (const entry of readDecisions(entries)) {
        const key = `${entry.day}|${entry.milestone}|${entry.text}`;
        if (seen.has(key)) continue;
        seen.add(key);
        list.push(entry);
    }
    return list.slice(-BOOK_LIMITS.decisions);
}

/**
 * J9.6: lo que deja una escena del hilo para el libro: cada cosa que dijiste, con el hito, su
 * acto y lo que salió de ello (lo que la ventana dijo al elegir, y la tirada); y detrás, lo que
 * la escena apuntó (las pistas, lo que dice cada opción que se apunta).
 *
 * @param {Object} input
 * @param {any} input.scene La escena jugada (`milestoneScene`), con su título.
 * @param {Array<{beat: number, said: string, outcome?: string|null}>} [input.choices] Lo elegido.
 * @param {Record<number, string[]>} [input.came] Lo que se dijo al elegir, por línea de la escena.
 * @param {any} [input.milestone] El hito.
 * @param {number} [input.day]
 * @param {string[]} [input.notes] Lo apuntado que no es una frase tuya.
 * @returns {DecisionEntry[]}
 */
export function sceneDecisionEntries({ scene, choices = [], came = {}, milestone = null, day = 0, notes = [] }) {
    const id = text(milestone?.id ?? scene?.id);
    const act = Math.min(MAX_ACTS, whole(milestone?.act));
    const title = text(scene?.title) || text(milestone?.title) || 'La historia';
    return readDecisions([
        ...(Array.isArray(choices) ? choices : []).filter(c => text(c?.said)).map(c => ({
            day,
            text: `${title}: «${text(c.said)}»`,
            milestone: id,
            act,
            came: [
                ...(c.outcome && OUTCOME_WORDS[/** @type {keyof typeof OUTCOME_WORDS} */ (c.outcome)] ? [`La tirada ${OUTCOME_WORDS[/** @type {keyof typeof OUTCOME_WORDS} */ (c.outcome)]}.`] : []),
                ...(Array.isArray(came?.[c.beat]) ? came[c.beat] : []),
            ],
        })),
        ...(Array.isArray(notes) ? notes : []).map(note => ({ day, text: note, milestone: id, act, came: [] })),
    ]);
}

/**
 * Un suceso elegido, de su línea de la crónica: «Un mendigo en el camino: Le dais una moneda.
 * Os bendice (−1 de oro)». Lo elegido va hasta el primer punto; lo que salió, después.
 *
 * @param {string} line
 * @returns {{text: string, came: string[]}}
 */
export function sucesoDecision(line) {
    const said = text(line).split('\n')[0];
    const cutAt = said.search(/\.\s/);
    if (cutAt < 0) return { text: said.replace(/\.$/, ''), came: [] };
    const rest = said.slice(cutAt + 1).trim();
    return { text: said.slice(0, cutAt).trim(), came: rest ? [rest] : [] };
}

// ---------------------------------------------------------------------------------------------
// J9.6: el libro
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} BookDecision
 * @property {number} day
 * @property {string} text
 * @property {string[]} came
 * @property {number} act
 * @property {string} where «Capítulo 2 · El campamento vistani».
 * @property {string} page  El hito en el que se decidió, si se sabe.
 */

/**
 * @typedef {Object} BookPage Un hito, como página.
 * @property {string} id
 * @property {string} title
 * @property {'hecho'|'abierto'|'perdido'|'cerrado'} state
 * @property {boolean} secret Un secreto encontrado.
 * @property {string} text  Lo que pasó (su escena).
 * @property {string} hint  Lo que toca, si sigue abierto.
 * @property {BookClock|null} clock
 * @property {BookDecision[]} decided
 * @property {string[]} came Lo que salió de cumplirlo, o de perderlo.
 */

/**
 * @typedef {Object} BookChapter
 * @property {number} act
 * @property {number} number
 * @property {string} name
 * @property {string} title  Vacío si está en blanco: no se destripa.
 * @property {string} label
 * @property {'hecho'|'ahora'|'en-blanco'} state `hecho`: la historia ya va por otro, aunque quede algo abierto.
 * @property {number} pending Cuántas páginas siguen abiertas: lo que queda por hacer en él.
 * @property {string} summary
 * @property {string} closing «Quedó hecho: …», al cerrarse.
 * @property {BookPage[]} pages
 * @property {BookDecision[]} decided Lo decidido en el capítulo que no es de ninguna página.
 * @property {string[]} told    Lo que os contaron.
 * @property {string[]} moments Lo vivido con los vuestros.
 * @property {string[]} road    Lo que pasó por el camino (la crónica).
 * @property {{place: string, town: string}} backdrop Dónde pasa, para la viñeta.
 */

/**
 * @typedef {Object} StoryBook
 * @property {string} title
 * @property {ChapterNow|null} now
 * @property {BookClock[]} clocks
 * @property {BookChapter[]} chapters
 * @property {BookDecision[]} decided Todo lo decidido, capítulo a capítulo (J11.5).
 * @property {{title: string, scene: string, epilogues: string[]}|null} ending
 * @property {boolean} empty Si no hay nada que leer todavía.
 */

/**
 * Cómo se llama cada facción, por su id; sin nombre, su id legible («los-vistani» → «Los vistani»).
 *
 * @param {any[]} factions
 * @returns {(id: string) => string}
 */
function factionName(factions) {
    /** @type {Map<string, string>} */
    const names = new Map();
    for (const faction of readFactions(factions)) names.set(text(faction.id).toLowerCase(), text(faction.name) || text(faction.id));
    return (id) => {
        const known = names.get(text(id).toLowerCase());
        if (known) return known;
        const plain = text(id).replace(/[-_]+/g, ' ').trim();
        return plain.charAt(0).toUpperCase() + plain.slice(1);
    };
}

/**
 * Cómo os mira una facción después: «Los Lobos del Bosque os miran peor».
 *
 * @param {Record<string, number>} standing
 * @param {(id: string) => string} nameOf
 * @returns {string[]}
 */
function standingLines(standing, nameOf) {
    return Object.entries(standing ?? {})
        .filter(([, amount]) => Number(amount) !== 0)
        .map(([id, amount]) => {
            const name = nameOf(id);
            return `${name} ${saysWith(name, 'os mira', 'os miran')} ${Number(amount) > 0 ? 'mejor' : 'peor'}.`;
        });
}

/**
 * Lo que salió de un hito: adónde llevó, qué caminos cerró, qué apareció en el mapa, cómo os
 * miran y si ahí se acabó la historia. Solo lo que ya se ve: un hito que abrió un secreto no lo
 * dice.
 *
 * @param {any} plot
 * @param {ReturnType<typeof readPlotState>} state
 * @param {any} milestone
 * @param {(id: string) => string} nameOf
 * @param {'hecho'|'perdido'} how
 * @returns {string[]}
 */
function consequences(plot, state, milestone, nameOf, how) {
    const byId = new Map(plot.milestones.map((/** @type {any} */ m) => [m.id, m]));
    const seen = (/** @type {any} */ m) => m && !m.hidden && (state.open.includes(m.id) || state.done.includes(m.id) || state.missed.includes(m.id));
    /** @type {string[]} */
    const lines = [];
    if (how === 'perdido') {
        lines.push('Se os pasó el plazo.');
        const next = (milestone.late?.open ?? []).map((/** @type {string} */ id) => byId.get(id)).filter(seen);
        if (next.length > 0) lines.push(`Por llegar tarde: ${quoted(next.map((/** @type {any} */ m) => text(m.title)))}.`);
        if ((milestone.late?.reveal ?? []).length > 0) lines.push(`Apareció en el mapa: ${listOf(milestone.late.reveal)}.`);
        lines.push(...standingLines(milestone.late?.standing ?? {}, nameOf));
        return lines;
    }
    const next = plot.milestones.filter((/** @type {any} */ m) => seen(m) && m.id !== milestone.id
        && ((m.opens?.kind === 'after' && m.opens.milestone === milestone.id) || (milestone.changes?.open ?? []).includes(m.id)));
    if (next.length > 0) lines.push(`Llevó a ${quoted(next.map((/** @type {any} */ m) => text(m.title)))}.`);
    const closed = (milestone.changes?.close ?? []).filter((/** @type {string} */ id) => state.closed.includes(id))
        .map((/** @type {string} */ id) => byId.get(id)).filter(Boolean);
    if (closed.length === 1) lines.push(`Se cerró otro camino: «${text(closed[0].title)}».`);
    else if (closed.length > 1) lines.push(`Se cerraron otros caminos: ${quoted(closed.map((/** @type {any} */ m) => text(m.title)))}.`);
    if ((milestone.changes?.reveal ?? []).length > 0) lines.push(`Apareció en el mapa: ${listOf(milestone.changes.reveal)}.`);
    lines.push(...standingLines(milestone.changes?.standing ?? {}, nameOf));
    if (text(milestone.changes?.ending) || Object.keys(milestone.changes?.endingBy ?? {}).length > 0) lines.push('Con esto, la historia llegó a su final.');
    return lines;
}

/**
 * El día en que empezó cada capítulo: el primero en que se abrió uno de sus hitos.
 *
 * @param {any} plot
 * @param {ReturnType<typeof readPlotState>} state
 * @returns {Map<number, number>}
 */
function chapterStartDays(plot, state) {
    /** @type {Map<number, number>} */
    const starts = new Map();
    for (const m of plot.milestones) {
        const day = state.since[m.id];
        if (m.hidden || !day) continue;
        starts.set(m.act, Math.min(starts.get(m.act) ?? Infinity, day));
    }
    return starts;
}

/**
 * El capítulo de algo que pasó un día: el último que había empezado ya ese día.
 *
 * @param {Map<number, number>} starts
 * @param {number} day
 * @returns {number} 0 si no se sabe.
 */
function actOnDay(starts, day) {
    if (!(day > 0) || starts.size === 0) return 0;
    let best = 0;
    for (const [act, start] of starts) if (start <= day && act > best) best = act;
    return best;
}

/**
 * El capítulo de un mensaje del chat, por dónde empezó cada acto (`actStarts`: acto → el
 * primer mensaje suyo). Sin saberlo, 0.
 *
 * @param {any} actStarts
 * @param {number} index
 * @returns {number}
 */
function actAtMessage(actStarts, index) {
    const entries = Object.entries(actStarts && typeof actStarts === 'object' ? actStarts : {})
        .map(([act, at]) => [Math.floor(Number(act)), Math.floor(Number(at))])
        .filter(([act, at]) => act >= 1 && Number.isFinite(at));
    if (entries.length === 0) return 0;
    let best = 1;
    for (const [act, at] of entries) if (at <= index && act > best) best = act;
    return best;
}

/**
 * El final alcanzado, como se cuenta.
 *
 * @param {any} plot
 * @param {string} endingId
 * @returns {{title: string, scene: string, epilogues: string[]}|null}
 */
export function endingOf(plot, endingId) {
    const id = text(endingId);
    if (!id) return null;
    const ending = plot?.endings?.[id];
    const epilogues = (Array.isArray(ending?.epilogues) ? ending.epilogues : [])
        .map((/** @type {any} */ e) => (typeof e === 'string' ? text(e) : [text(e?.who), text(e?.text)].filter(Boolean).join(': ')))
        .filter(Boolean);
    return { title: text(ending?.title) || id, scene: text(ending?.scene), epilogues };
}

/**
 * J9.6: el libro de una campaña.
 *
 * @param {Object} input
 * @param {any} input.plot El hilo (`plot`), leído o no.
 * @param {any} [input.state] Por dónde va (`plotState`).
 * @param {number} [input.today] Para los plazos.
 * @param {any} [input.decisions] Lo decidido en las escenas (`plotDecisions`).
 * @param {any} [input.dialogueMemory] Lo recordado de las charlas (`dialogues`): lo que os contaron.
 * @param {any} [input.memories] Lo vivido con los vuestros (`sharedMemories`).
 * @param {any} [input.deeds] Lo que el mundo recuerda (`deeds`).
 * @param {any[]} [input.chat] El chat de la campaña: los sucesos elegidos y lo que movió la historia.
 * @param {any} [input.actStarts] Dónde empezó cada acto en el chat (`actStarts`).
 * @param {any[]} [input.factions] Las del mundo, para decir cómo se llaman.
 * @param {{title: string, scene: string, epilogues?: string[]}|null} [input.ending] El final, si se llegó (`endingOf`).
 * @param {Record<string, string>} [input.boardPlaces] Dónde está cada tablero, por su nombre en
 *   minúsculas: la localización de la viñeta de cada capítulo.
 * @param {any} [input.who] Quién juega (`{heroe, grupo}`), para el género del texto.
 * @param {string} [input.title] El título, si el hilo no trae uno.
 * @returns {StoryBook}
 */
export function buildStoryBook({
    plot, state = null, today = 0, decisions = [], dialogueMemory = null, memories = [], deeds = [], chat = [],
    actStarts = {}, factions = [], ending = null, boardPlaces = {}, who = {}, title = '',
}) {
    const read = readPlot(plot);
    const say = (/** @type {any} */ value) => resolveGender(text(value), who);
    const bookTitle = say(read?.title || title) || 'Diario';
    const finalPage = ending && text(ending.title)
        ? { title: say(ending.title), scene: say(ending.scene), epilogues: (ending.epilogues ?? []).map(say).filter(Boolean) }
        : null;
    if (!read) {
        return { title: bookTitle, now: null, clocks: [], chapters: [], decided: [], ending: finalPage, empty: true };
    }
    const plotState = readPlotState(state);
    const now = chapterNow(read, plotState);
    const frames = chapterFrames(read);
    const nameOf = factionName(factions);
    const clocks = deadlinesOf(read, plotState, today).map(c => ({ ...c, title: say(c.title), line: say(c.line) }));
    const nowAct = now?.act ?? frames[0]?.act ?? 1;
    const ended = Boolean(now?.ended);

    /** @type {BookChapter[]} */
    const chapters = frames.map(frame => {
        const status = /** @type {BookChapter['state']} */ (frame.act < nowAct || (ended && frame.act <= nowAct) ? 'hecho'
            : frame.act === nowAct ? 'ahora' : 'en-blanco');
        const blank = status === 'en-blanco';
        return {
            act: frame.act,
            number: frame.number,
            name: frame.name,
            title: blank ? '' : say(frame.title),
            label: !blank && frame.title ? `${frame.name} · ${say(frame.title)}` : frame.name,
            state: status,
            pending: 0,
            summary: blank ? '' : say(frame.summary),
            closing: '',
            pages: [],
            decided: [],
            told: [],
            moments: [],
            road: [],
            backdrop: { place: '', town: '' },
        };
    });
    const nowChapter = chapters.find(c => c.act === nowAct) ?? chapters[0];
    /** El capítulo donde va algo de un acto: el suyo, o el de ahora si el suyo está en blanco. */
    const chapterFor = (/** @type {number} */ act) => {
        const own = act > 0 ? [...chapters].reverse().find(c => c.act <= act) : null;
        return own && own.state !== 'en-blanco' ? own : nowChapter;
    };

    // Las páginas: lo hecho, lo abierto a la vista, lo perdido y lo cerrado, en el orden escrito.
    /** @type {Map<string, BookPage>} */
    const pageById = new Map();
    for (const m of read.milestones) {
        const done = plotState.done.includes(m.id);
        const open = plotState.open.includes(m.id);
        const missed = plotState.missed.includes(m.id);
        const closed = plotState.closed.includes(m.id);
        if (!done && !(open && !m.hidden) && !missed && !closed) continue;
        if (m.hidden && !done) continue;
        const pageState = /** @type {BookPage['state']} */ (done ? 'hecho' : missed ? 'perdido' : closed ? 'cerrado' : 'abierto');
        const closer = closed ? read.milestones.find((/** @type {any} */ c) => plotState.done.includes(c.id) && (c.changes?.close ?? []).includes(m.id)) : null;
        /** @type {BookPage} */
        const page = {
            id: m.id,
            title: say(m.title),
            state: pageState,
            secret: Boolean(m.hidden),
            // Un camino cerrado no se llegó a ver: no se cuenta su escena.
            text: closed ? '' : say(m.scene),
            hint: pageState === 'abierto' ? say(m.hint) : '',
            clock: pageState === 'abierto' ? (clocks.find(c => c.id === m.id) ?? null) : null,
            decided: [],
            came: pageState === 'hecho' ? consequences(read, plotState, m, nameOf, 'hecho').map(say)
                : pageState === 'perdido' ? consequences(read, plotState, m, nameOf, 'perdido').map(say)
                    : pageState === 'abierto' ? []
                        : closer ? [say(`Se cerró al cumplir «${text(closer.title)}».`)] : ['Se cerró por lo que decidisteis.'],
        };
        const chapter = chapterFor(m.act);
        chapter.pages.push(page);
        pageById.set(m.id, page);
        // La viñeta del capítulo: el sitio del último hito con uno.
        const where = sceneBackdrop(m.backdrop);
        const town = where.place || where.town ? '' : (text(m.asks?.place) || text(boardPlaces?.[text(m.asks?.board).toLowerCase()]) || text(m.opens?.place));
        if (where.place || where.town) chapter.backdrop = where;
        else if (town) chapter.backdrop = { place: '', town };
    }

    const starts = chapterStartDays(read, plotState);
    const actOfMilestone = new Map(read.milestones.map((/** @type {any} */ m) => [m.id, m.act]));

    // Lo decidido en las escenas: en su página si se sabe el hito; si no, en su capítulo.
    for (const entry of readDecisions(decisions)) {
        const act = entry.act || actOfMilestone.get(entry.milestone) || actOnDay(starts, entry.day);
        const chapter = chapterFor(act);
        /** @type {BookDecision} */
        const decision = { day: entry.day, text: say(entry.text), came: entry.came.map(say), act: chapter.act, where: chapter.label, page: '' };
        const page = entry.milestone ? pageById.get(entry.milestone) : null;
        if (page) page.decided.push({ ...decision, page: page.title });
        else chapter.decided.push(decision);
    }

    // Lo que pasó en el chat: los sucesos elegidos (son decisiones) y lo que movió la historia.
    for (const entry of chronicleOf(chat)) {
        const chapter = chapterFor(actAtMessage(actStarts, entry.index));
        if (entry.tag === 'SUCESO') {
            const suceso = sucesoDecision(entry.text);
            if (suceso.text) chapter.decided.push({ day: 0, text: say(suceso.text), came: suceso.came.map(say), act: chapter.act, where: chapter.label, page: '' });
        } else if (STORY_TAGS.has(entry.tag)) {
            const line = cut(say(entry.text.split('\n')[0]), 200);
            if (line && !chapter.road.includes(line)) chapter.road.push(line);
        }
    }
    for (const deed of readDeeds(deeds)) {
        const chapter = chapterFor(actOnDay(starts, deed.day));
        const line = say(deed.text);
        if (line && !chapter.road.includes(line)) chapter.road.push(line);
    }
    // Lo que os contaron en las charlas escritas, y lo vivido con los vuestros.
    const learned = Object.values(readDialogueMemory(dialogueMemory)).flatMap(entry => entry.learned).sort((a, b) => a.day - b.day);
    for (const line of learned) {
        const chapter = chapterFor(actOnDay(starts, line.day));
        const said = say(line.who ? `${line.who}: ${line.text}` : line.text);
        if (said && !chapter.told.includes(said)) chapter.told.push(said);
    }
    for (const memory of readMemories(memories)) {
        const chapter = chapterFor(actOnDay(starts, memory.day));
        const said = say(memory.text);
        if (said && !chapter.moments.includes(said)) chapter.moments.push(said);
    }

    for (const chapter of chapters) {
        chapter.road = chapter.road.slice(-BOOK_LIMITS.road);
        chapter.told = chapter.told.slice(-BOOK_LIMITS.told);
        chapter.moments = chapter.moments.slice(-BOOK_LIMITS.moments);
        chapter.pending = chapter.pages.filter(p => p.state === 'abierto').length;
        const doneTitles = chapter.pages.filter(p => p.state === 'hecho' && !p.secret).map(p => p.title);
        if (chapter.state === 'hecho' && doneTitles.length > 0) chapter.closing = `Quedó hecho: ${listOf(doneTitles)}.`;
    }

    const decided = collectDecided(chapters);
    const empty = chapters.every(c => c.pages.length === 0 && c.decided.length === 0 && c.road.length === 0 && c.told.length === 0 && c.moments.length === 0);
    return { title: bookTitle, now, clocks, chapters, decided, ending: finalPage, empty };
}

/**
 * Todo lo decidido, capítulo a capítulo: primero lo de sus páginas, luego lo demás.
 *
 * @param {BookChapter[]} chapters
 * @returns {BookDecision[]}
 */
function collectDecided(chapters) {
    return chapters.flatMap(chapter => [
        ...chapter.pages.flatMap(page => page.decided.map(d => ({ ...d, where: chapter.label, page: page.title, act: chapter.act }))),
        ...chapter.decided.map(d => ({ ...d, where: chapter.label, act: chapter.act })),
    ]);
}

/**
 * J11.5: buscar en lo decidido. Sin palabras, todo; con ellas, lo que las lleve todas (en lo
 * dicho, en lo que salió, en el capítulo o en la página), sin mirar tildes ni mayúsculas.
 *
 * @param {BookDecision[]} decided
 * @param {string} query
 * @returns {BookDecision[]}
 */
export function searchDecided(decided, query) {
    const fold = (/** @type {string} */ value) => text(value).toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');
    const words = fold(query).split(/\s+/).filter(Boolean);
    if (words.length === 0) return [...(decided ?? [])];
    return (decided ?? []).filter(d => {
        const all = fold([d.text, ...d.came, d.where, d.page].join(' '));
        return words.every(word => all.includes(word));
    });
}

/**
 * Lo que la partida guarda y lee el libro, de los metadatos del chat de la campaña.
 *
 * @param {any} meta `chat_metadata`.
 * @param {Object} [extra] Lo que no está en los metadatos.
 * @param {any[]} [extra.chat]
 * @param {number} [extra.today]
 * @param {any} [extra.who]
 * @param {any[]} [extra.factions]
 * @param {Record<string, string>} [extra.boardPlaces]
 * @param {string} [extra.title]
 * @returns {Parameters<typeof buildStoryBook>[0]}
 */
export function bookInputFromMetadata(meta, { chat = [], today = 0, who = {}, factions = [], boardPlaces = {}, title = '' } = {}) {
    const plot = meta?.[BOOK_KEYS.plot] ?? null;
    return {
        plot,
        state: meta?.[BOOK_KEYS.plotState] ?? null,
        today,
        decisions: meta?.[BOOK_KEYS.decisions] ?? [],
        dialogueMemory: meta?.[BOOK_KEYS.dialogues] ?? null,
        memories: meta?.[BOOK_KEYS.memories] ?? [],
        deeds: meta?.[BOOK_KEYS.deeds] ?? [],
        chat,
        actStarts: meta?.[BOOK_KEYS.actStarts] ?? {},
        factions,
        ending: endingOf(plot, meta?.[BOOK_KEYS.ending]),
        boardPlaces,
        who,
        title,
    };
}

// ---------------------------------------------------------------------------------------------
// J11.5: la crónica de cada campaña, guardada en el gremio
// ---------------------------------------------------------------------------------------------

/**
 * @param {any} raw
 * @returns {BookDecision}
 */
function readBookDecision(raw) {
    return {
        day: whole(raw?.day),
        text: text(raw?.text),
        came: (Array.isArray(raw?.came) ? raw.came : []).map(text).filter(Boolean).slice(0, BOOK_LIMITS.came),
        act: Math.min(MAX_ACTS, whole(raw?.act)),
        where: text(raw?.where),
        page: text(raw?.page),
    };
}

/** @param {any} raw @returns {string[]} */
const lines = (raw) => (Array.isArray(raw) ? raw.map(text).filter(Boolean) : []);

/**
 * Un libro guardado, con forma aunque llegue roto: es lo que lee la ventana.
 *
 * @param {any} raw
 * @returns {StoryBook|null} Nada si no es un libro.
 */
export function readStoryBook(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.chapters)) return null;
    const states = ['hecho', 'ahora', 'en-blanco'];
    const pageStates = ['hecho', 'abierto', 'perdido', 'cerrado'];
    /** @type {BookChapter[]} */
    const chapters = raw.chapters.filter((/** @type {any} */ c) => c && typeof c === 'object').map((/** @type {any} */ c, /** @type {number} */ i) => ({
        act: Math.max(1, Math.min(MAX_ACTS, whole(c.act) || i + 1)),
        number: whole(c.number) || i + 1,
        name: text(c.name) || `Capítulo ${i + 1}`,
        title: text(c.title),
        label: text(c.label) || text(c.name) || `Capítulo ${i + 1}`,
        state: /** @type {BookChapter['state']} */ (states.includes(c.state) ? c.state : 'hecho'),
        pending: whole(c.pending),
        summary: text(c.summary),
        closing: text(c.closing),
        pages: (Array.isArray(c.pages) ? c.pages : []).filter((/** @type {any} */ p) => p && text(p.title)).map((/** @type {any} */ p) => ({
            id: text(p.id),
            title: text(p.title),
            state: /** @type {BookPage['state']} */ (pageStates.includes(p.state) ? p.state : 'hecho'),
            secret: Boolean(p.secret),
            text: text(p.text),
            hint: text(p.hint),
            clock: null,
            decided: (Array.isArray(p.decided) ? p.decided : []).map(readBookDecision).filter((/** @type {BookDecision} */ d) => d.text),
            came: lines(p.came),
        })),
        decided: (Array.isArray(c.decided) ? c.decided : []).map(readBookDecision).filter((/** @type {BookDecision} */ d) => d.text),
        told: lines(c.told),
        moments: lines(c.moments),
        road: lines(c.road),
        backdrop: { place: text(c.backdrop?.place), town: text(c.backdrop?.town) },
    }));
    const now = raw.now && typeof raw.now === 'object' ? {
        act: whole(raw.now.act) || 1, number: whole(raw.now.number) || 1, of: whole(raw.now.of) || chapters.length,
        name: text(raw.now.name), title: text(raw.now.title), label: text(raw.now.label), line: text(raw.now.line), ended: Boolean(raw.now.ended),
    } : null;
    const ending = raw.ending && typeof raw.ending === 'object' && text(raw.ending.title)
        ? { title: text(raw.ending.title), scene: text(raw.ending.scene), epilogues: lines(raw.ending.epilogues) }
        : null;
    return {
        title: text(raw.title) || 'Diario',
        now,
        clocks: [],
        chapters,
        decided: collectDecided(chapters),
        ending,
        empty: chapters.every(c => c.pages.length === 0 && c.decided.length === 0 && c.road.length === 0),
    };
}

/**
 * J11.5: la copia corta del libro que se guarda en el gremio: los capítulos, cada página con su
 * texto recortado, lo decidido y lo que salió de ello, y el final. Sin los plazos (en el gremio
 * no corren), ni lo que os contaron ni lo vivido con los vuestros (eso se lee dentro).
 *
 * @param {StoryBook} book
 * @returns {any}
 */
export function bookSnapshot(book) {
    const max = BOOK_LIMITS.snapshotText;
    let room = BOOK_LIMITS.snapshotDecided;
    /** @param {BookDecision[]} list */
    const keep = (list) => {
        const kept = list.slice(0, Math.max(0, room)).map(d => ({ day: d.day, text: cut(d.text, max), came: d.came.map(c => cut(c, max)), act: d.act, where: d.where, page: d.page }));
        room -= kept.length;
        return kept;
    };
    return {
        v: 1,
        title: book.title,
        now: book.now,
        ending: book.ending,
        chapters: book.chapters.map(c => ({
            act: c.act, number: c.number, name: c.name, title: c.title, label: c.label, state: c.state,
            pending: c.pending, summary: c.summary, closing: c.closing, backdrop: c.backdrop,
            pages: c.pages.slice(0, BOOK_LIMITS.snapshotPages).map(p => ({
                id: p.id, title: p.title, state: p.state, secret: p.secret, text: cut(p.text, max), hint: cut(p.hint, max),
                came: p.came.map(line => cut(line, max)), decided: keep(p.decided),
            })),
            decided: keep(c.decided),
            road: c.road.slice(-BOOK_LIMITS.road).map(line => cut(line, max)),
        })),
    };
}

/**
 * Las crónicas guardadas en el gremio, por campaña, con forma aunque lleguen rotas.
 *
 * @param {any} raw
 * @returns {Record<string, StoryBook>}
 */
export function readChronicles(raw) {
    /** @type {Record<string, StoryBook>} */
    const out = {};
    for (const [id, value] of Object.entries(raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {})) {
        const book = readStoryBook(value);
        if (text(id) && book) out[text(id)] = book;
    }
    return out;
}

/**
 * J11.5: el gremio, con la crónica de una campaña puesta al día (al volver de ella).
 *
 * @param {any} raw Lo guardado en `HUB_CHRONICLES_KEY`.
 * @param {string} id La campaña, por su id del tablón.
 * @param {StoryBook} book
 * @returns {Record<string, any>}
 */
export function withChronicle(raw, id, book) {
    const now = raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {};
    if (!text(id) || !book) return now;
    now[text(id)] = bookSnapshot(book);
    return now;
}

/**
 * J11.5: la crónica de una campaña, para leerla desde el gremio. Nada si no hay, o si no tiene
 * nada que leer.
 *
 * @param {any} raw
 * @param {string} id
 * @returns {StoryBook|null}
 */
export function chronicleOfCampaign(raw, id) {
    const book = readChronicles(raw)[text(id)] ?? null;
    return book && !book.empty ? book : null;
}
