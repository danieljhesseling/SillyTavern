/**
 * Las misiones personales de tus compañeros, jugables (J14.9 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * Al llegar al vínculo 4, Gerd, Nella y Osric te piden lo suyo (`compendio/quedadas.json`, lo
 * que abre el rango 4: su título, de qué va y sus dos finales). Hasta ahora se quedaba en datos.
 * Ahora cada una se juega como una misión pequeña, escrita en `compendio/personales.json`:
 *
 *     { "id": "osric-anillo", "kind": "mision", "who": "Osric Mediapaga", "quest": "osric-anillo",
 *       "start": "ida",
 *       "steps": [
 *         { "id": "ida", "kind": "viaje", "to": "Valdés", "days": 2, "text": "…", "next": "guardia" },
 *         { "id": "guardia", "kind": "escena", "title": "…", "backdrop": "camino", "beats": [ … ],
 *           "routes": { "despertar": "campamento", "espantar": { "bien": "viuda", "mal": "campamento" } } },
 *         { "id": "campamento", "kind": "tablero", "board": { … }, "bestiary": [ … ], "win": "viuda", "lose": "viuda" },
 *         { "id": "fin-verdad", "kind": "final", "ending": "verdad", "back": 2, "effects": { … } } ] }
 *
 * - **Pasos**: `viaje` (días de camino hasta un sitio: los pasa quien llama), `escena` (una
 *   escena como las del hilo, `plot-scenes.js`: líneas, decisiones con condiciones, tiradas y
 *   efectos), `tablero` (una pelea: el tablero y sus bichos, con la forma del paquete) y `final`
 *   (uno de los dos finales de `quedadas.json`, por su id, con lo que cambia).
 * - **Adónde lleva cada cosa**: en una escena, `routes` por opción (o por cómo sale su tirada:
 *   `bien`, `medias`, `mal`); sin ruta, `next`. En un tablero, `win`, `lose` y `flee`.
 * - **Lo que cambia un final** (`effects`): `gold` (lo que cuesta), `bonds` (cuántas veces cuenta
 *   como «misión juntos» para su vínculo: una misión personal pesa el doble), `fame` (renombre
 *   del gremio), `flags` (lo que el mundo recuerda: «el barón pone precio a tu cabeza») y
 *   `memory` (lo que él recuerda de ti).
 *
 * Puro: dice en qué paso vais, qué se juega y adónde lleva lo elegido. Quien llama pasa los días,
 * abre la pelea, enseña las escenas y aplica el final.
 */

import { readSceneBeats, sceneBackdrop } from './plot-scenes.js';
import { keyOf } from './social.js';

/** En la metadata del chat del gremio: las misiones personales empezadas y acabadas. */
export const QUESTS_KEY = 'misionesPersonales';

/** Las clases de paso. */
export const STEP_KINDS = ['viaje', 'escena', 'tablero', 'final'];

/** Lo que vale una misión personal para su vínculo, si el final no dice otra cosa. */
export const QUEST_BOND_EVENTS = 2;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string[]} */
const listOf = (value) => (Array.isArray(value) ? value : value == null ? [] : [value]).map(text).filter(Boolean);

/** @param {any} value @returns {boolean} */
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/**
 * @typedef {Object} QuestStep
 * @property {string} id
 * @property {'viaje'|'escena'|'tablero'|'final'} kind
 * @property {string} title
 * @property {string} text Lo que se cuenta al llegar al paso (el viaje, antes de pelear…).
 * @property {string} next
 * @property {any} raw
 */

/**
 * @typedef {Object} QuestRow
 * @property {string} id
 * @property {string} who
 * @property {string} key
 * @property {string} quest El id de su misión en `quedadas.json`.
 * @property {string} start
 * @property {QuestStep[]} steps
 */

/**
 * @param {any} raw
 * @returns {QuestStep|null}
 */
function readStep(raw) {
    if (!isObject(raw) || !text(raw.id)) return null;
    const kind = text(raw.kind);
    if (!STEP_KINDS.includes(kind)) return null;
    return {
        id: text(raw.id),
        kind: /** @type {QuestStep['kind']} */ (kind),
        title: text(raw.title),
        text: text(raw.text),
        next: text(raw.next),
        raw,
    };
}

/**
 * Las misiones de `personales.json` (el archivo, su `rows` o las filas del compendio). Una sin
 * pasos, o sin un final, no se puede jugar y se queda fuera.
 *
 * @param {any} raw
 * @returns {QuestRow[]}
 */
export function readQuestRows(raw) {
    const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.rows) ? raw.rows : [];
    return rows.flatMap((/** @type {any} */ row) => {
        if (text(row?.kind) !== 'mision' || !text(row.id) || !text(row.who)) return [];
        const steps = (Array.isArray(row.steps) ? row.steps : []).map(readStep).filter(/** @returns {s is QuestStep} */ s => s !== null);
        if (steps.length === 0 || !steps.some(s => s.kind === 'final')) return [];
        const start = text(row.start);
        return [{
            id: text(row.id),
            who: text(row.who),
            key: keyOf(row.who),
            quest: text(row.quest) || text(row.id),
            start: steps.some(s => s.id === start) ? start : steps[0].id,
            steps,
        }];
    });
}

/**
 * Lo que dice `quedadas.json` de una misión (lo que abre el rango: `unlocks` de `readMeetupRows`):
 * su título, dónde es, de qué va y sus dos finales.
 *
 * @param {{unlocks?: any[]}} meetData
 * @param {string} questId
 * @returns {{id: string, title: string, where: string, pitch: string, rank: number, who: string,
 *   endings: Array<{id: string, title: string, summary: string}>}|null}
 */
export function questInfo(meetData, questId) {
    const unlock = (meetData?.unlocks ?? []).find((/** @type {any} */ u) => u?.type === 'mision' && text(u?.quest?.id) === text(questId));
    if (!unlock) return null;
    const quest = unlock.quest;
    return {
        id: text(quest.id),
        title: text(quest.title) || text(unlock.label),
        where: text(quest.where),
        pitch: text(quest.pitch),
        rank: Number(unlock.rank) || 0,
        who: text(unlock.who),
        endings: (Array.isArray(quest.endings) ? quest.endings : [])
            .map((/** @type {any} */ e) => ({ id: text(e?.id), title: text(e?.title), summary: text(e?.summary) }))
            .filter((/** @type {any} */ e) => e.id),
    };
}

/**
 * @typedef {Object} QuestState
 * @property {string} id La misión.
 * @property {string} who
 * @property {string} step El paso de ahora; vacío si acabó.
 * @property {boolean} done
 * @property {string} ending El final al que se llegó.
 * @property {number} started El día en que se salió.
 * @property {number} finished
 * @property {string[]} path Los pasos por los que se ha pasado.
 * @property {string[]} flags Lo que queda apuntado.
 */

/**
 * @typedef {Object} QuestsState Lo de todas: por id.
 * @property {Record<string, QuestState>} quests
 */

/**
 * @param {any} raw
 * @returns {QuestsState}
 */
export function readQuests(raw) {
    const source = isObject(raw?.quests) ? raw.quests : {};
    /** @type {Record<string, QuestState>} */
    const quests = {};
    for (const [id, one] of Object.entries(source)) {
        if (!isObject(one) || !text(id)) continue;
        quests[text(id)] = {
            id: text(id),
            who: text(one.who),
            step: text(one.step),
            done: one.done === true,
            ending: text(one.ending),
            started: Math.max(0, Math.floor(Number(one.started) || 0)),
            finished: Math.max(0, Math.floor(Number(one.finished) || 0)),
            path: listOf(one.path),
            flags: listOf(one.flags),
        };
    }
    return { quests };
}

/**
 * Las misiones personales que se pueden empezar: las que su vínculo ya ha abierto (`personalQuestsOpen`
 * de `meetups.js`), que tienen su misión escrita y que no están empezadas ni acabadas. Solo con
 * quien va en el grupo: es su misión, y va contigo.
 *
 * @param {Object} input
 * @param {QuestRow[]} input.rows
 * @param {Array<{who: string, quest: any}>} input.open
 * @param {any} input.state `readQuests`.
 * @param {any[]} [input.party]
 * @returns {QuestRow[]}
 */
export function questsToStart({ rows, open, state, party = [] }) {
    const quests = readQuests(state).quests;
    const going = new Set((Array.isArray(party) ? party : []).filter(m => m && !m.dead).map(m => keyOf(m.name)));
    const opened = new Set((Array.isArray(open) ? open : []).map(o => text(o?.quest?.id)));
    return (Array.isArray(rows) ? rows : []).filter(row => opened.has(row.quest) && !quests[row.id] && (going.size === 0 || going.has(row.key)));
}

/**
 * La misión que va a medias, si la hay: solo se lleva una a la vez.
 *
 * @param {any} state
 * @returns {QuestState|null}
 */
export function questUnderway(state) {
    return Object.values(readQuests(state).quests).find(q => !q.done && q.step) ?? null;
}

/**
 * Empezar una misión.
 *
 * @param {any} state
 * @param {QuestRow} row
 * @param {{day: number}} input
 * @returns {QuestsState}
 */
export function startQuest(state, row, { day }) {
    const all = readQuests(state);
    return {
        quests: {
            ...all.quests,
            [row.id]: {
                id: row.id, who: row.who, step: row.start, done: false, ending: '',
                started: Math.max(0, Math.floor(Number(day) || 0)), finished: 0, path: [row.start], flags: [],
            },
        },
    };
}

/**
 * El paso de ahora.
 *
 * @param {QuestRow} row
 * @param {any} state
 * @returns {QuestStep|null}
 */
export function currentStep(row, state) {
    const one = readQuests(state).quests[row?.id ?? ''];
    if (!one || one.done) return null;
    return row.steps.find(s => s.id === one.step) ?? null;
}

/**
 * Pasar a otro paso (o, si no existe, acabar sin final: una misión mal escrita no se queda
 * colgada).
 *
 * @param {QuestsState} all
 * @param {QuestRow} row
 * @param {string} to
 * @returns {QuestsState}
 */
function moveTo(all, row, to) {
    const one = all.quests[row.id];
    const target = row.steps.find(s => s.id === text(to));
    if (!one) return all;
    if (!target) return { quests: { ...all.quests, [row.id]: { ...one, step: '', done: true } } };
    return { quests: { ...all.quests, [row.id]: { ...one, step: target.id, path: [...one.path, target.id] } } };
}

/**
 * Tras un viaje: al paso siguiente.
 *
 * @param {any} state
 * @param {QuestRow} row
 * @returns {QuestsState}
 */
export function afterTravel(state, row) {
    const all = readQuests(state);
    const step = currentStep(row, all);
    if (!step || step.kind !== 'viaje') return all;
    return moveTo(all, row, step.next);
}

/**
 * Tras una pelea: según cómo acabó (`win`, `lose` o `flee`). Sin camino para eso, el de ganar.
 *
 * @param {any} state
 * @param {QuestRow} row
 * @param {'win'|'lose'|'flee'} result
 * @returns {QuestsState}
 */
export function afterBoard(state, row, result) {
    const all = readQuests(state);
    const step = currentStep(row, all);
    if (!step || step.kind !== 'tablero') return all;
    const raw = step.raw;
    const to = text(raw?.[result]) || text(raw?.win) || step.next;
    return moveTo(all, row, to);
}

/**
 * Adónde lleva lo elegido en una escena: la ruta de la última decisión (por opción, o por cómo
 * salió su tirada); sin ruta, `next`.
 *
 * @param {QuestStep} step
 * @param {Array<{option: string, outcome: string|null}>} choices Las de `openPlotScene`.
 * @returns {string}
 */
export function routeOf(step, choices) {
    const routes = isObject(step?.raw?.routes) ? step.raw.routes : {};
    for (const choice of [...(Array.isArray(choices) ? choices : [])].reverse()) {
        const route = routes[text(choice?.option)];
        if (typeof route === 'string' && text(route)) return text(route);
        if (isObject(route)) {
            const outcome = text(choice?.outcome);
            const by = text(route[outcome]) || (outcome === 'medias' ? text(route.bien) : '');
            if (by) return by;
        }
    }
    return step?.next ?? '';
}

/**
 * Tras una escena: adonde lleve lo elegido.
 *
 * @param {any} state
 * @param {QuestRow} row
 * @param {Array<{option: string, outcome: string|null}>} choices
 * @returns {QuestsState}
 */
export function afterScene(state, row, choices) {
    const all = readQuests(state);
    const step = currentStep(row, all);
    if (!step || step.kind !== 'escena') return all;
    return moveTo(all, row, routeOf(step, choices));
}

/**
 * La escena de un paso, lista para `openPlotScene` (`ui/plot-scene.js`): sus líneas con el género
 * puesto, sus decisiones y dónde pasa.
 *
 * @param {QuestStep} step
 * @param {{hero?: any, party?: any[], questTitle?: string}} [who]
 * @returns {import('./plot-scenes.js').PlotScene}
 */
export function stepScene(step, { hero = null, party = [], questTitle = '' } = {}) {
    const beats = readSceneBeats(step?.raw?.beats, { id: `mision:${text(step?.id)}`, hero, party });
    return {
        kind: beats.length > 0 ? 'scene' : 'none',
        id: `mision:${text(step?.id)}`,
        title: [text(questTitle), text(step?.title)].filter(Boolean).join(' · '),
        text: text(step?.text),
        beats,
        dialogue: null,
        backdrop: sceneBackdrop(step?.raw?.backdrop),
    };
}

/**
 * @typedef {Object} QuestEnding
 * @property {string} id
 * @property {string} title
 * @property {string} summary Lo que pasó (de `quedadas.json`).
 * @property {number} gold Lo que cuesta (negativo) o se gana.
 * @property {number} bonds Cuántas veces cuenta como «misión juntos».
 * @property {number} fame
 * @property {string[]} flags
 * @property {string} memory
 * @property {number} back Los días de vuelta a casa.
 */

/**
 * El final de un paso `final`: lo de `quedadas.json` (título y lo que pasó) con lo que cambia.
 *
 * @param {QuestStep} step
 * @param {ReturnType<typeof questInfo>} info
 * @returns {QuestEnding|null}
 */
export function endingOf(step, info) {
    if (!step || step.kind !== 'final') return null;
    const id = text(step.raw?.ending);
    const told = (info?.endings ?? []).find(e => e.id === id);
    const effects = isObject(step.raw?.effects) ? step.raw.effects : {};
    const bonds = Number(effects.bonds);
    return {
        id,
        title: told?.title || text(step.title) || id,
        summary: told?.summary || text(step.text),
        gold: Math.round(Number(effects.gold) || 0),
        bonds: Number.isFinite(bonds) ? Math.max(0, Math.min(4, Math.floor(bonds))) : QUEST_BOND_EVENTS,
        fame: Math.max(0, Math.floor(Number(effects.fame) || 0)),
        flags: listOf(effects.flags),
        memory: text(effects.memory),
        back: Math.max(0, Math.floor(Number(step.raw?.back) || 0)),
    };
}

/**
 * Acabar la misión con su final.
 *
 * @param {any} state
 * @param {QuestRow} row
 * @param {QuestEnding} ending
 * @param {{day: number}} input
 * @returns {QuestsState}
 */
export function finishQuest(state, row, ending, { day }) {
    const all = readQuests(state);
    const one = all.quests[row.id];
    if (!one) return all;
    return {
        quests: {
            ...all.quests,
            [row.id]: {
                ...one, step: '', done: true, ending: ending.id,
                finished: Math.max(0, Math.floor(Number(day) || 0)), flags: [...new Set([...one.flags, ...ending.flags])],
            },
        },
    };
}

/**
 * Lo que se cuenta al acabar: lo que pasó y lo que cambia.
 *
 * @param {{who: string, ending: QuestEnding, short?: string}} input
 * @returns {string[]}
 */
export function endingLines({ who, ending, short = '' }) {
    const name = text(short) || text(who).split(' ')[0] || 'Tu compañero';
    /** @type {string[]} */
    const lines = [ending.summary].filter(Boolean);
    if (ending.gold < 0) lines.push(`Os cuesta ${-ending.gold} de oro.`);
    else if (ending.gold > 0) lines.push(`Ganáis ${ending.gold} de oro.`);
    if (ending.bonds > 0) lines.push(`${name} no lo olvidará: vuestro vínculo crece mucho.`);
    if (ending.fame > 0) lines.push('En el gremio se habla de ello: el renombre sube.');
    return lines;
}

/**
 * Lo que se ve de una misión en su tarjeta: de quién es, adónde, de qué va y en qué paso está.
 *
 * @param {QuestRow} row
 * @param {any} state
 * @param {ReturnType<typeof questInfo>} info
 * @returns {{id: string, who: string, title: string, where: string, pitch: string, step: string, next: string,
 *   endings: string[], done: boolean, ending: string}}
 */
export function questCard(row, state, info) {
    const one = readQuests(state).quests[row.id] ?? null;
    const step = one ? currentStep(row, state) : null;
    const days = Math.max(1, Math.floor(Number(step?.raw?.days) || 1));
    const next = !one ? 'Sin empezar'
        : one.done ? 'Terminada'
            : step?.kind === 'viaje' ? `De camino a ${text(step.raw?.to) || 'su destino'}: ${days} ${days === 1 ? 'día' : 'días'}`
                : step?.kind === 'tablero' ? 'Hay que pelear'
                    : step?.kind === 'final' ? 'A punto de acabar' : 'Os espera una escena';
    const ending = one?.done ? (info?.endings ?? []).find(e => e.id === one.ending)?.title ?? '' : '';
    return {
        id: row.id,
        who: row.who,
        title: info?.title || row.id,
        where: info?.where ?? '',
        pitch: info?.pitch ?? '',
        step: step?.id ?? '',
        next,
        endings: (info?.endings ?? []).map(e => e.title),
        done: Boolean(one?.done),
        ending,
    };
}

/**
 * El viaje de un paso `viaje`: adónde, cuántos días y lo que se cuenta.
 *
 * @param {QuestStep} step
 * @returns {{to: string, days: number, text: string}|null}
 */
export function travelOf(step) {
    if (!step || step.kind !== 'viaje') return null;
    return { to: text(step.raw?.to), days: Math.max(1, Math.floor(Number(step.raw?.days) || 1)), text: step.text };
}

/**
 * La pelea de un paso `tablero`: el tablero y los bichos, con la forma de un paquete, para que
 * quien llama los meta en el mundo como mete los de una campaña (`buildImportPlan`).
 *
 * @param {QuestStep} step
 * @returns {{board: any, bestiary: any[], text: string}|null}
 */
export function fightOf(step) {
    if (!step || step.kind !== 'tablero' || !isObject(step.raw?.board)) return null;
    return {
        board: step.raw.board,
        bestiary: (Array.isArray(step.raw.bestiary) ? step.raw.bestiary : []).filter(isObject),
        text: step.text,
    };
}

/**
 * Los caminos de una misión, para comprobar que se escribió bien: cada ruta lleva a un paso que
 * existe, cada final es uno de los dos de `quedadas.json` y los dos se pueden alcanzar.
 *
 * @param {QuestRow} row
 * @param {ReturnType<typeof questInfo>} info
 * @returns {string[]} Los problemas; vacío si está bien.
 */
export function checkQuest(row, info) {
    /** @type {string[]} */
    const problems = [];
    const ids = new Set(row.steps.map(s => s.id));
    const targets = (/** @type {QuestStep} */ step) => {
        /** @type {string[]} */
        const out = [];
        if (step.next) out.push(step.next);
        if (step.kind === 'tablero') for (const k of ['win', 'lose', 'flee']) if (text(step.raw?.[k])) out.push(text(step.raw[k]));
        const routes = isObject(step.raw?.routes) ? step.raw.routes : {};
        for (const route of Object.values(routes)) {
            if (typeof route === 'string') out.push(text(route));
            else if (isObject(route)) out.push(...Object.values(route).map(text));
        }
        return out.filter(Boolean);
    };
    for (const step of row.steps) {
        for (const to of targets(step)) if (!ids.has(to)) problems.push(`${row.id}: el paso «${step.id}» lleva a «${to}», que no existe.`);
        if (step.kind !== 'final' && targets(step).length === 0) problems.push(`${row.id}: el paso «${step.id}» no lleva a ninguna parte.`);
        if (step.kind === 'final' && !(info?.endings ?? []).some(e => e.id === text(step.raw?.ending))) {
            problems.push(`${row.id}: el final «${text(step.raw?.ending)}» no es de los de quedadas.json.`);
        }
        if (step.kind === 'tablero' && !fightOf(step)) problems.push(`${row.id}: el paso «${step.id}» no trae su tablero.`);
    }
    // Los dos finales, alcanzables desde el principio.
    const reached = new Set([row.start]);
    const queue = [row.start];
    while (queue.length > 0) {
        const step = row.steps.find(s => s.id === queue.shift());
        if (!step) continue;
        for (const to of targets(step)) if (!reached.has(to)) {
            reached.add(to);
            queue.push(to);
        }
    }
    const endingsReached = new Set(row.steps.filter(s => s.kind === 'final' && reached.has(s.id)).map(s => text(s.raw?.ending)));
    for (const ending of info?.endings ?? []) if (!endingsReached.has(ending.id)) problems.push(`${row.id}: no se llega al final «${ending.id}».`);
    return problems;
}
