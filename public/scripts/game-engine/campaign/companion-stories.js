/**
 * Los romances y las misiones personales que trae una campaña (los Gems al día, 2026-10-02).
 *
 * Hasta ahora vivían solo en el compendio, comunes a todo el juego: quién lo permite en
 * `compendio/companeros.json` (su campo `romance`), las escenas en `compendio/romances.json`,
 * las misiones en `compendio/personales.json` y lo que abre el rango 4 en
 * `compendio/quedadas.json`. Una campaña escrita por un Gem no tenía dónde ponerlos.
 *
 * Ahora cada compañero de un paquete (`confidants`) puede traer los suyos, con **la misma
 * forma** que esos archivos:
 *
 *     { "name": "Mira la Molinera",
 *       "romance": { "with": "todos", "no": "…",
 *         "escenas": [ { "kind": "cita", "step": 1, "title": "…", "beats": [ … ] }, …,
 *                      { "kind": "final", … }, { "kind": "pareja", "lines": [ … ] },
 *                      { "kind": "epilogo", "home": "…", "away": "…", "hall": "…" } ] },
 *       "misionPersonal": { "title": "…", "where": "…", "pitch": "…",
 *         "endings": [ { "id": "…", "title": "…", "summary": "…" }, … ],
 *         "start": "ida", "steps": [ … ] },
 *       "scenes": [ { "rank": 2, "title": "…", "scene": "…", "beats": [ { "note": "…", "say": "…", "replies": [ … ] } ] } ] }
 *
 * Sus escenas de vínculo (`scenes`), si traen `beats`, se juegan como las escritas de
 * `quedadas.json`: una conversación con sus respuestas, en vez de la prosa pasada sola.
 *
 * Aquí se pasan a filas de esos cuatro archivos (`companionStoryRows`), que el importador guarda
 * en el mundo (`metadata.companionStories`) y el juego junta con las del compendio
 * (`withCampaignRows`) antes de leerlas con los lectores de siempre (`readRomanceCards`,
 * `readRomanceRows`, `readQuestRows`, `readMeetupRows`). Las de la campaña van delante: si un
 * compañero se llama igual que uno del gremio, dentro de su campaña vale lo suyo.
 *
 * Puro.
 */

import { keyOf } from './social.js';
import { readRomanceRows, readRomanceCards, hasWrittenRomance, DATES } from './romance.js';
import { readQuestRows, checkQuest } from './companion-quests.js';

/** La clave en los metadatos del mundo. */
export const STORIES_KEY = 'companionStories';

/** Las clases de escena de un romance, como en `compendio/romances.json`. */
export const ROMANCE_KINDS = ['senal', 'cita', 'final', 'pareja', 'epilogo'];

/** El rango de vínculo que abre una misión personal, si no dice otro. */
export const QUEST_RANK = 4;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {boolean} */
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** @param {any} raw @returns {any[]} Las filas: el archivo entero, su `rows` o la lista. */
const rowsOf = (raw) => (Array.isArray(raw) ? raw : Array.isArray(raw?.rows) ? raw.rows : []);

/**
 * @typedef {Object} StoryRows Lo de los compañeros de una campaña, con la forma del compendio.
 * @property {any[]} companeros Quién permite el romance: `{who, short, romance: {with, no}}`.
 * @property {any[]} romances Las escenas, como en `romances.json`.
 * @property {any[]} personales Las misiones, como en `personales.json`.
 * @property {any[]} quedadas Lo que abre cada misión en su rango y las escenas de vínculo escritas
 *   como conversación, como en `quedadas.json`.
 */

/** @returns {StoryRows} */
function emptyStories() {
    return { companeros: [], romances: [], personales: [], quedadas: [] };
}

/**
 * Las filas de un compañero: su ficha de romance y sus escenas, y su misión personal con lo que
 * la abre.
 *
 * @param {any} person Un compañero del paquete.
 * @returns {StoryRows}
 */
export function storyRowsOf(person) {
    const out = emptyStories();
    const who = text(person?.name);
    if (!who) return out;
    const short = text(person?.short) || who.split(' ')[0];

    const romance = person?.romance;
    if (romance !== undefined && romance !== null) {
        const said = isObject(romance) ? romance : { with: romance };
        out.companeros.push({ who, short, romance: { with: said.with ?? 'nadie', ...(text(said.no) ? { no: text(said.no) } : {}) } });
        for (const row of Array.isArray(said.escenas) ? said.escenas : []) {
            if (!isObject(row) || !ROMANCE_KINDS.includes(text(row.kind))) continue;
            const step = text(row.kind) === 'cita' ? Math.max(1, Math.floor(Number(row.step) || 1)) : 0;
            out.romances.push({
                ...row,
                id: text(row.id) || `romance-${keyOf(who)}-${text(row.kind)}${step ? `-${step}` : ''}`,
                who,
            });
        }
    }

    // Sus escenas de vínculo escritas como conversación (`beats`, como en `quedadas.json`): mandan
    // sobre las de prosa del mismo rango, que el juego pasa a escena solo.
    for (const scene of Array.isArray(person?.scenes) ? person.scenes : []) {
        if (!isObject(scene) || !Array.isArray(scene.beats) || scene.beats.length === 0) continue;
        const rank = Math.min(10, Math.max(1, Math.floor(Number(scene.rank) || 1)));
        out.quedadas.push({
            id: text(scene.id) || `${keyOf(who)}-vinculo-${rank}`,
            kind: 'escena',
            who,
            rank,
            title: text(scene.title),
            where: text(scene.where),
            beats: scene.beats,
        });
    }

    const quest = person?.misionPersonal;
    if (isObject(quest) && Array.isArray(quest.steps) && quest.steps.length > 0) {
        const id = text(quest.id) || `${keyOf(who)}-mision`;
        const title = text(quest.title) || `La misión de ${short}`;
        const endings = (Array.isArray(quest.endings) ? quest.endings : [])
            .filter(isObject)
            .map((/** @type {any} */ e) => ({ id: text(e.id), title: text(e.title), summary: text(e.summary) }))
            .filter((/** @type {any} */ e) => e.id);
        out.personales.push({
            id,
            kind: 'mision',
            name: `${short} · ${title}`,
            who,
            quest: id,
            ...(text(quest.start) ? { start: text(quest.start) } : {}),
            steps: quest.steps,
        });
        out.quedadas.push({
            id: `${keyOf(who)}-rango-mision`,
            kind: 'rango',
            name: `${short} · su misión`,
            who,
            rank: Math.min(10, Math.max(1, Math.floor(Number(quest.rank) || QUEST_RANK))),
            unlock: {
                type: 'mision',
                label: title,
                describe: text(quest.pitch) || title,
                quest: { id, title, where: text(quest.where), pitch: text(quest.pitch), endings },
            },
        });
    }
    return out;
}

/**
 * Las filas de todos los compañeros de un paquete. Lo que guarda el importador.
 *
 * @param {any} pack
 * @returns {StoryRows}
 */
export function companionStoryRows(pack) {
    const out = emptyStories();
    for (const person of Array.isArray(pack?.confidants) ? pack.confidants : []) {
        const one = storyRowsOf(person);
        out.companeros.push(...one.companeros);
        out.romances.push(...one.romances);
        out.personales.push(...one.personales);
        out.quedadas.push(...one.quedadas);
    }
    return out;
}

/**
 * Si hay algo que guardar.
 *
 * @param {StoryRows} stories
 * @returns {boolean}
 */
export function hasStories(stories) {
    return Boolean(stories) && ['companeros', 'romances', 'personales', 'quedadas'].some(k => (/** @type {any} */ (stories)[k]?.length ?? 0) > 0);
}

/**
 * Lo guardado en el mundo, con forma aunque llegue roto o no haya nada.
 *
 * @param {any} raw `metadata.companionStories`.
 * @returns {StoryRows}
 */
export function readCompanionStories(raw) {
    const source = isObject(raw) ? raw : {};
    return {
        companeros: rowsOf(source.companeros).filter(isObject),
        romances: rowsOf(source.romances).filter(isObject),
        personales: rowsOf(source.personales).filter(isObject),
        quedadas: rowsOf(source.quedadas).filter(isObject),
    };
}

/**
 * Las filas de un archivo del compendio con las de la campaña delante.
 *
 * @param {any} base Lo del compendio (el archivo, su `rows` o la lista).
 * @param {any} extra Lo de la campaña, de la misma forma.
 * @returns {any[]}
 */
export function withCampaignRows(base, extra) {
    const own = rowsOf(extra);
    return own.length > 0 ? [...own, ...rowsOf(base)] : rowsOf(base);
}

/**
 * Lo que está mal escrito en los romances y las misiones personales de un paquete: avisos, no
 * errores. Un romance a medias no sale (se quedaría colgado) y una misión que no llega a sus
 * finales no se ofrece, pero la campaña se juega igual.
 *
 * @param {any} pack
 * @returns {Array<{path: string, message: string}>}
 */
export function checkCompanionStories(pack) {
    /** @type {Array<{path: string, message: string}>} */
    const out = [];
    (Array.isArray(pack?.confidants) ? pack.confidants : []).forEach((/** @type {any} */ person, /** @type {number} */ at) => {
        const who = text(person?.name);
        if (!who) return;
        const rows = storyRowsOf(person);
        const path = `confidants[${at}]`;
        if (person?.romance !== undefined) {
            const card = readRomanceCards(rows.companeros)[0];
            const data = readRomanceRows(rows.romances);
            if (card && card.with.length > 0 && !hasWrittenRomance(data, who)) {
                const missing = [];
                for (let step = 1; step <= DATES; step++) {
                    if (!data.scenes.some(s => s.stage === 'cita' && s.step === step)) missing.push(`la cita ${step}`);
                }
                if (!data.scenes.some(s => s.stage === 'final')) missing.push('la noche (`final`)');
                out.push({ path: `${path}.romance`, message: `El romance con ${who} no saldrá: le falta ${missing.join(', ')}.` });
            }
        }
        if (person?.misionPersonal !== undefined) {
            const quest = person.misionPersonal;
            const [row] = readQuestRows(rows.personales);
            const info = rows.quedadas.find(r => r.kind === 'rango')?.unlock?.quest ?? null;
            if (!row) {
                out.push({ path: `${path}.misionPersonal`, message: `La misión de ${who} no se puede jugar: necesita pasos (\`steps\`) y al menos uno \`final\`.` });
                return;
            }
            if (!Array.isArray(quest?.endings) || quest.endings.length === 0) {
                out.push({ path: `${path}.misionPersonal.endings`, message: `La misión de ${who} no dice sus finales (\`endings\`, con id, título y lo que pasó).` });
            }
            for (const problem of checkQuest(row, info)) out.push({ path: `${path}.misionPersonal`, message: problem.replace('no es de los de quedadas.json', 'no está en sus `endings`') });
        }
    });
    return out;
}
