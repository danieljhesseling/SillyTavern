/**
 * Consecuencias diferidas (J11.2 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * Un suceso ya podía volver días después (`follow`, en `compendio/sucesos.json`): el desertor al
 * que disteis pan os busca en la posada. Lo que se decide en una **escena del hilo** o en una
 * **charla escrita** no volvía nunca: Karl os pedía mirar a otro lado, mirabais, y el pueblo no
 * pasaba hambre. Aquí esas decisiones también vuelven.
 *
 * Cómo se escribe, en la opción de una escena (`beats[].options[]`) o de una charla
 * (`dialogues[].nodes[].options[]`):
 *
 *     "later": {
 *       "days": 3,
 *       "on": "siempre",
 *       "name": "Los graneros vacíos",
 *       "text": "Tres días después, en la plaza, la cola del pan da la vuelta a la esquina…",
 *       "options": [
 *         { "label": "Repartir lo que lleváis", "cost": { "oro": 5 }, "effects": ["fama:+1"],
 *           "then": "Os lo agradecen sin palabras." },
 *         { "label": "Seguir de largo", "then": "Alguien escupe al suelo cuando pasáis." }
 *       ]
 *     }
 *
 * - `days`: cuántos días después vuelve (de 1 a 30). Sale en el siguiente sitio al que se
 *   llegue, donde se descanse o en la semana, como las continuaciones de los sucesos.
 * - `on`: con qué resultado vuelve, si la opción lleva tirada: `siempre` (lo normal), `bien` o
 *   `mal`.
 * - `name`, `text` y `options`: la tarjeta que vuelve, escrita como un suceso (la misma ventana y
 *   los mismos efectos). O, en vez de escribirla, `suceso`: el id de uno de `sucesos.json`.
 *
 * Por dentro, cada tarjeta escrita pasa a ser un suceso de continuación con un id propio
 * (`hilo-<hito>-<opción>`, `charla-<charla>-<opción>`), y lo que queda pendiente se guarda donde
 * los sucesos guardan lo suyo (`pending`). Así una sola cola decide qué vuelve hoy.
 *
 * Puro: de lo escrito y de lo elegido, a lo que vuelve. Quien llama guarda y enseña.
 */

import { readSceneBeats } from './plot-scenes.js';
import { readDialogue } from './dialogues.js';
import { leftoverMarkers } from './grammar.js';

/** Cuántos días puede esperar una consecuencia. */
export const LATER_DAYS = { min: 1, max: 30 };

/** Con qué resultado vuelve: siempre, o solo si salió bien o mal. */
export const LATER_ON = ['siempre', 'bien', 'mal'];

/** Los efectos de una tarjeta que vuelve: los de los sucesos. */
export const LATER_EFFECT = /^(oro:[+-](\d+|\d*d\d+)|hora|dia|herida:(\d+|\d*d\d+)|cura:\d*d\d+|comida|fama:[+-]1|faccion:[+-]1|vinculo:\+1|rumor|pista)$/;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {boolean} */
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/**
 * Un trozo de id: minúsculas, sin tildes y con guiones.
 *
 * @param {any} value
 * @returns {string}
 */
function slug(value) {
    return text(value).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
}

/**
 * @typedef {Object} Later
 * @property {number} days
 * @property {'siempre'|'bien'|'mal'} on
 * @property {string} suceso Un suceso de `sucesos.json` que vuelve, en vez de una tarjeta escrita.
 * @property {string} name
 * @property {string} text
 * @property {any[]} options En la forma de las opciones de un suceso.
 * @property {string} [who] Tanda 22 (D-J60): quién vuelve; lo que pasa al elegir lo dice él.
 */

/**
 * Lo que vuelve de una opción, si lo trae (`later`, o `despues` en castellano).
 *
 * @param {any} option
 * @returns {Later|null}
 */
export function readLater(option) {
    const raw = isObject(option) ? (option.later ?? option.despues) : null;
    if (!isObject(raw)) return null;
    const days = Math.max(LATER_DAYS.min, Math.min(LATER_DAYS.max, Math.floor(Number(raw.days ?? raw.dias) || 1)));
    const on = /** @type {'siempre'|'bien'|'mal'} */ (LATER_ON.includes(text(raw.on ?? raw.si)) ? text(raw.on ?? raw.si) : 'siempre');
    const suceso = text(raw.suceso);
    const options = (Array.isArray(raw.options) ? raw.options : []).filter(o => isObject(o) && text(o.label));
    // Tanda 22 (D-J60): quién vuelve; lo que pasa al elegir lo dice él.
    const who = text(raw.who);
    const card = { name: text(raw.name), text: text(raw.text), options, ...(who ? { who } : {}) };
    if (!suceso && (!card.name || !card.text || options.length === 0)) return null;
    return { days, on, suceso, ...card };
}

/**
 * El id del suceso que vuelve de una opción de escena.
 *
 * @param {string} milestone
 * @param {string} option
 * @returns {string}
 */
export function sceneLaterId(milestone, option) {
    return `hilo-${slug(milestone)}-${slug(option)}`;
}

/**
 * El id del suceso que vuelve de una opción de charla.
 *
 * @param {string} dialogue
 * @param {string} option
 * @returns {string}
 */
export function dialogueLaterId(dialogue, option) {
    return `charla-${slug(dialogue)}-${slug(option)}`;
}

/**
 * Las líneas de una escena tal como las cuenta `readSceneBeats`: las que tienen texto. Con su
 * índice, que es el que dice una decisión (`SceneChoice.beat`).
 *
 * @param {any} beats
 * @returns {any[]}
 */
function playedBeats(beats) {
    return (Array.isArray(beats) ? beats : [])
        .map(entry => (typeof entry === 'string' ? { text: entry } : entry))
        .filter(entry => isObject(entry) && text(entry.text));
}

/**
 * Las opciones escritas de una decisión, cada una con el id con que la conoce el motor (el suyo,
 * o el que le pone `dialogues.js` si no lo trae).
 *
 * @param {any} milestone
 * @param {number} beat
 * @returns {Array<{id: string, raw: any}>}
 */
function sceneOptionsOf(milestone, beat) {
    const raw = playedBeats(milestone?.beats)[beat];
    const read = readSceneBeats(milestone?.beats, { id: text(milestone?.id) })[beat];
    const written = (Array.isArray(raw?.options) ? raw.options : []).filter(isObject);
    const ids = read?.decision?.dialogue.nodes[0].options.map(o => o.id) ?? [];
    return written.map((option, index) => ({ id: ids[index] ?? text(option.id), raw: option }));
}

/**
 * Una tarjeta escrita, como fila de suceso de continuación.
 *
 * @param {string} id
 * @param {Later} later
 * @returns {any}
 */
function laterRow(id, later) {
    return {
        id,
        name: later.name,
        weight: 1,
        when: { momento: 'continuacion' },
        text: later.text,
        options: later.options,
        kind: 'suceso',
        ...(later.who ? { who: later.who } : {}),
    };
}

/**
 * Los sucesos que pueden volver de lo que se decide en el hilo y en las charlas escritas: una
 * fila por cada tarjeta escrita. Se juntan con los de `sucesos.json` para buscar la que toca.
 *
 * @param {any} plot El hilo (leído o no: las escenas se guardan tal cual).
 * @param {Object} [input]
 * @param {any[]} [input.dialogues] Las charlas del paquete, sin leer.
 * @returns {any[]}
 */
export function laterRows(plot, { dialogues = [] } = {}) {
    /** @type {any[]} */
    const rows = [];
    for (const milestone of Array.isArray(plot?.milestones) ? plot.milestones : []) {
        const beats = playedBeats(milestone?.beats);
        beats.forEach((_, index) => {
            for (const { id, raw } of sceneOptionsOf(milestone, index)) {
                const later = readLater(raw);
                if (later && !later.suceso) rows.push(laterRow(sceneLaterId(milestone.id, id), later));
            }
        });
    }
    for (const dialogue of Array.isArray(dialogues) ? dialogues : []) {
        const read = readDialogue(dialogue);
        if (!read) continue;
        (Array.isArray(dialogue?.nodes) ? dialogue.nodes : []).forEach((/** @type {any} */ node, n) => {
            const written = Array.isArray(node?.options) ? node.options : [];
            written.forEach((/** @type {any} */ option, o) => {
                const later = readLater(option);
                const id = read.nodes[n]?.options[o]?.id;
                if (later && !later.suceso && id) rows.push(laterRow(dialogueLaterId(read.id, id), later));
            });
        });
    }
    return rows;
}

/**
 * Si vuelve con este resultado.
 *
 * @param {Later} later
 * @param {'bien'|'medias'|'mal'|null|undefined} outcome
 * @returns {boolean}
 */
function comesBack(later, outcome) {
    if (later.on === 'siempre' || !outcome) return true;
    // A medias es que salió, pagando: cuenta como bien.
    return later.on === 'bien' ? outcome !== 'mal' : outcome === 'mal';
}

/**
 * Lo que queda pendiente de las decisiones de una escena del hilo, cuando acaba.
 *
 * @param {any} milestone El hito de la escena.
 * @param {Array<{beat: number, option: string, outcome?: 'bien'|'medias'|'mal'|null}>} choices Lo que
 *   devuelve la ventana de la escena (`PlotSceneResult.choices`).
 * @returns {Array<{id: string, days: number}>}
 */
export function sceneFollows(milestone, choices) {
    /** @type {Array<{id: string, days: number}>} */
    const out = [];
    for (const choice of Array.isArray(choices) ? choices : []) {
        const found = sceneOptionsOf(milestone, Number(choice?.beat)).find(o => o.id === text(choice?.option));
        const later = found ? readLater(found.raw) : null;
        if (!later || !comesBack(later, choice?.outcome)) continue;
        out.push({ id: later.suceso || sceneLaterId(milestone.id, found?.id), days: later.days });
    }
    return out;
}

/**
 * Lo que queda pendiente de una opción elegida en una charla escrita.
 *
 * @param {any} dialogue La charla, sin leer (con sus `later`).
 * @param {string} optionId
 * @param {'bien'|'medias'|'mal'|null} [outcome]
 * @returns {{id: string, days: number}|null}
 */
export function dialogueFollow(dialogue, optionId, outcome = null) {
    const read = readDialogue(dialogue);
    if (!read) return null;
    const nodes = Array.isArray(dialogue?.nodes) ? dialogue.nodes : [];
    for (let n = 0; n < nodes.length; n++) {
        const index = read.nodes[n]?.options.findIndex(o => o.id === text(optionId)) ?? -1;
        if (index < 0) continue;
        const later = readLater(nodes[n]?.options?.[index]);
        if (!later || !comesBack(later, outcome)) return null;
        return { id: later.suceso || dialogueLaterId(read.id, text(optionId)), days: later.days };
    }
    return null;
}

/**
 * Apuntar lo que volverá, en lo que recuerdan los sucesos (`readSucesoState`), sin darlo por
 * visto. Si ya estaba pendiente, se queda la fecha nueva.
 *
 * @param {{seen: string[], pending: Array<{id: string, day: number, place: string}>}} state
 * @param {Object} input
 * @param {Array<{id: string, days: number}>|{id: string, days: number}|null} input.follows
 * @param {number} input.day Hoy.
 * @param {string} [input.place] Dónde volverá; vacío, donde se esté ese día.
 * @returns {{seen: string[], pending: Array<{id: string, day: number, place: string}>}}
 */
export function scheduleFollows(state, { follows, day, place = '' }) {
    const list = (Array.isArray(follows) ? follows : follows ? [follows] : []).filter(f => text(f?.id));
    const today = Math.max(1, Math.floor(Number(day) || 1));
    const ids = new Set(list.map(f => text(f.id)));
    return {
        seen: Array.isArray(state?.seen) ? [...state.seen] : [],
        pending: [
            ...(Array.isArray(state?.pending) ? state.pending : []).filter(p => !ids.has(text(p?.id))),
            ...list.map(f => ({ id: text(f.id), day: today + Math.max(LATER_DAYS.min, Math.floor(Number(f.days) || 1)), place: text(place) })),
        ],
    };
}

/**
 * @typedef {Object} LaterIssue
 * @property {string} path
 * @property {string} message
 */

/**
 * Lo que está mal escrito en lo que vuelve: una tarjeta sin nombre, texto u opciones, un
 * efecto que no se entiende, un `suceso` que no existe, o un `on` que no es ninguno.
 *
 * @param {any} pack
 * @param {Object} [refs]
 * @param {string[]} [refs.sucesos] Los ids de `sucesos.json`.
 * @returns {{errors: LaterIssue[], warnings: LaterIssue[], count: number}}
 */
export function checkLaters(pack, { sucesos = [] } = {}) {
    /** @type {LaterIssue[]} */
    const errors = [];
    /** @type {LaterIssue[]} */
    const warnings = [];
    let count = 0;
    const known = new Set(sucesos.map(text));
    /** @param {any} option @param {string} path */
    const look = (option, path) => {
        if (!isObject(option)) return;
        const raw = option.later ?? option.despues;
        if (raw === undefined) return;
        const where = `${path}.${option.later !== undefined ? 'later' : 'despues'}`;
        if (!isObject(raw)) {
            errors.push({ path: where, message: 'Lo que vuelve es un objeto: {days, name, text, options}, o {days, suceso}.' });
            return;
        }
        count += 1;
        const on = text(raw.on ?? raw.si);
        if (on && !LATER_ON.includes(on)) errors.push({ path: `${where}.on`, message: `"${on}" no vale: ${LATER_ON.join(', ')}.` });
        const days = Number(raw.days ?? raw.dias);
        if (!Number.isInteger(days) || days < LATER_DAYS.min || days > LATER_DAYS.max) {
            warnings.push({ path: `${where}.days`, message: `Los días van de ${LATER_DAYS.min} a ${LATER_DAYS.max}; si no, se ajustan.` });
        }
        if (text(raw.suceso)) {
            if (!known.has(text(raw.suceso))) errors.push({ path: `${where}.suceso`, message: `El suceso "${text(raw.suceso)}" no está en sucesos.json.` });
            return;
        }
        if (!text(raw.name)) errors.push({ path: `${where}.name`, message: 'Falta el nombre de la tarjeta (`name`).' });
        if (!text(raw.text)) errors.push({ path: `${where}.text`, message: 'Falta lo que pasa (`text`).' });
        const options = Array.isArray(raw.options) ? raw.options : [];
        if (options.length < 2) errors.push({ path: `${where}.options`, message: 'Una tarjeta que vuelve trae al menos dos opciones: algo que decidir.' });
        for (const [key, said] of [['text', raw.text], ['name', raw.name]]) {
            const bad = leftoverMarkers(text(said));
            if (bad.length > 0) errors.push({ path: `${where}.${key}`, message: `Marca de género mal escrita: ${bad[0]}. Se escribe {forma|forma}.` });
        }
        options.forEach((/** @type {any} */ o, i) => {
            const at = `${where}.options[${i}]`;
            if (!isObject(o) || !text(o.label)) {
                errors.push({ path: at, message: 'Cada opción lleva `label`: lo que se hace.' });
                return;
            }
            const effects = [...(o.effects ?? []), ...(o.success?.effects ?? []), ...(o.fail?.effects ?? [])];
            for (const effect of effects) {
                if (!LATER_EFFECT.test(text(effect))) errors.push({ path: at, message: `Efecto que no se entiende: "${text(effect)}". Los de los sucesos: oro:+N, hora, dia, herida:N, cura:1d6, comida, fama:±1, faccion:±1, vinculo:+1, rumor, pista.` });
            }
            if (!(text(o.then) || text(o.success?.then) || effects.length > 0)) {
                warnings.push({ path: at, message: 'Esta opción no hace ni dice nada.' });
            }
        });
    };
    const milestones = Array.isArray(pack?.plot?.milestones) ? pack.plot.milestones : [];
    milestones.forEach((/** @type {any} */ milestone, m) => {
        (Array.isArray(milestone?.beats) ? milestone.beats : []).forEach((/** @type {any} */ beat, b) => {
            (Array.isArray(beat?.options) ? beat.options : []).forEach((/** @type {any} */ option, o) => look(option, `plot.milestones[${m}].beats[${b}].options[${o}]`));
        });
    });
    (Array.isArray(pack?.dialogues) ? pack.dialogues : []).forEach((/** @type {any} */ dialogue, d) => {
        (Array.isArray(dialogue?.nodes) ? dialogue.nodes : []).forEach((/** @type {any} */ node, n) => {
            (Array.isArray(node?.options) ? node.options : []).forEach((/** @type {any} */ option, o) => look(option, `dialogues[${d}].nodes[${n}].options[${o}]`));
        });
    });
    return { errors, warnings, count };
}
