/**
 * Escenas del hilo, jugadas (J9.2 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * Un hito importante se abría con una nota del narrador: «[HILO] …». La gente de la escena
 * (Tomás gritando «¡al ladrón!», Brunilda midiendo al nuevo) no salía nunca: ni su cara ni su
 * gesto. Ahora el hito puede traer su escena escrita, y se juega como una novela visual:
 *
 * - **`beats`**: las líneas, en orden. Cada una dice quién habla (`who`: alguien de la gente o
 *   de los compañeros; sin él, el narrador, que no tiene retrato), con qué gesto (`mood`) y qué
 *   (`text`). Una línea puede traer una **decisión** (`options`): sus opciones son las de una
 *   charla con ramas (`dialogues.js`), con sus condiciones, sus tiradas y sus efectos, y cada una
 *   puede traer lo que se oye al elegirla (`reply`: una línea, o varias, escritas igual).
 * - **`sceneDialogue`**: el id de una charla del paquete, que se abre al acabar las líneas (o
 *   sola, si no hay líneas). Así Giles cuenta lo que vio en cuanto entras en su taberna.
 * - **`backdrop`**: dónde pasa, para el fondo: un sitio del pueblo (`muelle`, `posada`…) o una
 *   localización del paquete.
 * - **`scene`**, el texto de siempre, se queda: es lo que lee el narrador, y la escena de
 *   reserva (la de una partida guardada antes, o la de un hito sin líneas).
 *
 * Cómo se escribe:
 *
 *     "beats": [
 *       { "text": "La barca del correo te deja en el muelle al caer la tarde." },
 *       { "who": "Tomás", "mood": "enfadado", "text": "¡Al ladrón! ¡Mi bolsa!" },
 *       { "who": "Tomás", "mood": "triste", "text": "¡Es la paga de la semana!",
 *         "options": [
 *           { "id": "yo", "text": "¡Quédate atrás, yo me encargo!", "effects": [{ "attitude": 1 }],
 *             "reply": { "who": "Tomás", "mood": "alegre", "text": "¡Que los dioses te lo paguen!" } },
 *           { "id": "cobrar", "text": "¿Cuánto me das si te la traigo?",
 *             "effects": [{ "gold": 3 }, { "attitude": -1 }] } ] } ]
 *
 * Los efectos sin `who` son con quien dice la línea de la decisión; si la cuenta el narrador,
 * `attitude` y `bond` tienen que decir con quién.
 *
 * Puro: dice qué se enseña, qué se puede elegir y qué cambia. Quien llama lo pinta y lo aplica.
 */

import {
    readDialogue, readDialogues, startDialogue, optionsFor, choose, checkDialogues, describeDialogueEffect, MOODS,
} from './dialogues.js';
import { resolveGender, leftoverMarkers } from './grammar.js';
import { readAttitudes, ATTITUDE } from './attitudes.js';
import { readRumors } from './rumors.js';
import { readPlotState } from './plot.js';
import { PLACE_KINDS } from './town.js';
import { beatVariant, checkBeatAlts } from './human-lines.js';

/**
 * Lo que se aconseja al escribir una escena: de 3 a 8 líneas y una o dos decisiones. Por
 * encima de esto se avisa (no es un error: se juega igual, pero cansa).
 */
export const SCENE_LIMITS = { beats: 12, decisions: 2 };

/** Cómo se dice cada resultado de una tirada en lo que queda escrito. */
const OUTCOME_WORDS = { bien: 'sale bien', medias: 'sale a medias', mal: 'sale mal' };

/** El que habla en la charla de prueba de una decisión del narrador, para validarla. */
const NARRATOR_CHECK = '\u0000narrador';

/**
 * @typedef {import('./dialogues.js').DialogueEffect} DialogueEffect
 * @typedef {import('./dialogues.js').DialogueWorld} DialogueWorld
 * @typedef {import('./dialogues.js').OptionView} OptionView
 */

/**
 * @typedef {Object} SceneLine Una línea: quién, con qué cara y qué.
 * @property {string} who  Quien habla; vacío, el narrador (sin retrato).
 * @property {string} mood Uno de `MOODS`.
 * @property {string} text Con el género ya puesto.
 * @property {string|string[]|boolean} [presenta] J13.7: quién se da a conocer en ella (`true`: quien habla).
 */

/**
 * @typedef {Object} SceneDecision
 * @property {import('./dialogues.js').Dialogue} dialogue Una charla de un solo nudo: la línea y
 *   sus opciones, para que decidir se juegue con las reglas de las charlas (J8).
 * @property {Record<string, {base: SceneLine[], bien: SceneLine[], medias: SceneLine[]|null, mal: SceneLine[]}>} replies
 *   Lo que se oye al elegir cada opción, por su id; con tirada, también según cómo salga.
 */

/**
 * @typedef {SceneLine & {decision: SceneDecision|null}} SceneBeat
 */

/**
 * @typedef {Object} PlotScene Lo que se enseña al abrirse un hito.
 * @property {'scene'|'text'|'none'} kind `scene`: se juega en la ventana; `text`: lo cuenta el
 *   narrador, como siempre; `none`: nada (un secreto que todavía no se ha encontrado).
 * @property {string} id    El del hito.
 * @property {string} title
 * @property {string} text  El texto de siempre (`scene`), con el género puesto.
 * @property {SceneBeat[]} beats
 * @property {import('./dialogues.js').Dialogue|null} dialogue La charla que sigue a las líneas.
 * @property {{place: string, town: string}} backdrop Dónde pasa, si el hito lo dice.
 */

/**
 * @typedef {Object} SceneChoice Lo que se eligió en una decisión.
 * @property {number} beat
 * @property {string} option
 * @property {string} said
 * @property {'bien'|'medias'|'mal'|null} outcome
 * @property {SceneLine[]} reply
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string} */
const fold = (value) => text(value).toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** @param {any} value @returns {boolean} */
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** @param {any} value @returns {string[]} */
const listOf = (value) => (Array.isArray(value) ? value.map(text).filter(Boolean) : []);

/**
 * El gesto que se entiende, o `neutral`.
 *
 * @param {any} value
 * @returns {string}
 */
function moodOf(value) {
    const said = fold(value);
    return MOODS.includes(said) ? said : 'neutral';
}

/**
 * Una línea (o varias) tal como se escriben: un texto suelto es del narrador.
 *
 * @param {any} raw
 * @param {(said: string) => string} voice
 * @returns {SceneLine[]}
 */
function readLines(raw, voice) {
    return (Array.isArray(raw) ? raw : raw == null ? [] : [raw])
        .map(entry => (typeof entry === 'string' ? { text: entry } : entry))
        .filter(isObject)
        // J13.7: `presenta` (quién se da a conocer en la línea) pasa tal cual.
        .map(entry => ({ who: text(entry.who), mood: moodOf(entry.mood), text: voice(text(entry.text)), ...(entry.presenta != null ? { presenta: entry.presenta } : {}) }))
        .filter(line => line.text);
}

/**
 * Una rama de tirada tal como la lee el motor de charlas: lo que hace y lo que se apunta. Lo
 * que se oye (`reply`) lo guarda la escena; adónde lleva no existe, porque la escena sigue.
 *
 * @param {any} raw
 * @returns {any}
 */
function branchForEngine(raw) {
    // Sin escribir se queda sin escribir: la tirada sin `failure` es un error que se dice.
    if (raw === undefined) return undefined;
    return isObject(raw) ? { effects: raw.effects, journal: raw.journal } : {};
}

/**
 * Una opción de la escena tal como la lee el motor de charlas: sin `next` ni `reply`, y
 * acabando la charla de un nudo (la escena sigue por su cuenta).
 *
 * @param {any} raw
 * @returns {any}
 */
function optionForEngine(raw) {
    const out = { ...raw, end: true };
    delete out.next;
    delete out.reply;
    if (isObject(raw.check)) {
        out.check = {
            ...raw.check,
            success: branchForEngine(raw.check.success),
            failure: branchForEngine(raw.check.failure),
            ...(raw.check.partial == null ? {} : { partial: branchForEngine(raw.check.partial) }),
        };
        if (raw.check.partial == null) delete out.check.partial;
    } else {
        delete out.check;
    }
    return out;
}

/**
 * Lo que se oye tras una rama de tirada: su `reply`, o su texto si se escribió como texto.
 *
 * @param {any} branch
 * @returns {any}
 */
function branchReply(branch) {
    if (typeof branch === 'string') return branch;
    return isObject(branch) ? branch.reply : undefined;
}

/**
 * La decisión de una línea: una charla de un nudo con sus opciones, y lo que se oye tras cada una.
 *
 * @param {any} raw La línea, tal cual.
 * @param {string} id Un id para la charla: el hito y la línea.
 * @param {(said: string) => string} voice
 * @returns {SceneDecision|null}
 */
function readDecision(raw, id, voice) {
    const options = (Array.isArray(raw.options) ? raw.options : []).filter(isObject);
    if (options.length === 0) return null;
    const dialogue = readDialogue({
        id,
        speaker: text(raw.who),
        start: 'decision',
        nodes: [{ id: 'decision', line: text(raw.text), mood: raw.mood, options: options.map(optionForEngine) }],
    });
    if (!dialogue) return null;
    /** @type {SceneDecision['replies']} */
    const replies = {};
    dialogue.nodes[0].options.forEach((option, index) => {
        const source = options[index];
        const check = isObject(source.check) ? source.check : null;
        replies[option.id] = {
            base: readLines(source.reply, voice),
            bien: check ? readLines(branchReply(check.success), voice) : [],
            medias: check && check.partial != null ? readLines(branchReply(check.partial), voice) : null,
            mal: check ? readLines(branchReply(check.failure), voice) : [],
        };
    });
    return { dialogue, replies };
}

/**
 * Las líneas de un hito, con su género puesto. Una línea sin texto se cae; las demás siguen.
 *
 * @param {any} raw `beats`, tal cual.
 * @param {Object} [input]
 * @param {string} [input.id] El del hito, para los ids de sus decisiones.
 * @param {any} [input.hero]
 * @param {any[]} [input.party]
 * @param {string[]} [input.chose] J13.8: lo elegido en escenas anteriores, para las versiones (`alt`).
 * @returns {SceneBeat[]}
 */
export function readSceneBeats(raw, { id = '', hero = null, party = [], chose = [] } = {}) {
    const who = { heroe: hero, ...(Array.isArray(party) && party.length > 0 ? { grupo: party } : {}) };
    const voice = (/** @type {string} */ said) => resolveGender(said, who);
    /** @type {SceneBeat[]} */
    const beats = [];
    (Array.isArray(raw) ? raw : []).forEach((entry, index) => {
        // J13.8: la versión de la línea para quien juega y lo que ya ha hecho, en el mismo sitio.
        const source = beatVariant(typeof entry === 'string' ? { text: entry } : entry, { hero, chose });
        if (!isObject(source) || !text(source.text)) return;
        beats.push({
            who: text(source.who),
            mood: moodOf(source.mood),
            text: voice(text(source.text)),
            decision: readDecision(source, `escena:${text(id) || 'hito'}:${index + 1}`, voice),
            // J13.7: quién se da a conocer en esta línea, si el paquete lo dice.
            ...(source.presenta != null ? { presenta: source.presenta } : {}),
        });
    });
    return beats;
}

/**
 * Dónde pasa la escena: un sitio del pueblo (`muelle`, `posada`…) va al fondo de sitio; lo
 * demás es una localización (su escenario del paquete).
 *
 * @param {any} value
 * @returns {{place: string, town: string}}
 */
export function sceneBackdrop(value) {
    const said = text(value);
    if (!said) return { place: '', town: '' };
    const key = fold(said).replace(/^(el|la)\s+/, '');
    return key in PLACE_KINDS ? { place: key, town: '' } : { place: '', town: said };
}

/**
 * Una charla, leída o tal como viene en el paquete. Leer otra vez una ya leída la estropearía
 * (sus condiciones ya no están en `if`), así que se mira antes: lo leído trae en cada nudo su
 * `again` y sus `effects`, y en cada opción sus `when`.
 *
 * @param {any} raw
 * @returns {import('./dialogues.js').Dialogue|null}
 */
function asDialogue(raw) {
    const read = isObject(raw) && Array.isArray(raw.when) && Array.isArray(raw.nodes) && raw.nodes.length > 0
        && raw.nodes.every((/** @type {any} */ n) => typeof n?.again === 'string' && Array.isArray(n?.effects)
            && Array.isArray(n?.options) && n.options.every((/** @type {any} */ o) => Array.isArray(o?.when)));
    return read ? raw : readDialogues([raw])[0] ?? null;
}

/**
 * Lo que se enseña al abrirse un hito: su escena jugada (las líneas y, si la trae, su charla),
 * o el texto de siempre para el narrador.
 *
 * - Un hito oculto no se enseña hasta que se cumple (idea 111): decirlo al abrirse sería
 *   descubrirlo. Cumplido, su escena es la del secreto encontrado.
 * - Una escena ya jugada no se juega dos veces (lo que se eligió ya pasó): vuelve a ser texto.
 * - Una partida guardada antes de las escenas trae el hilo sin líneas: se cuenta su texto.
 *
 * @param {any} milestone Un hito, de `readPlot` o tal como viene en el paquete.
 * @param {Object} [input]
 * @param {any} [input.state] El estado del hilo, para saber si un oculto se ha cumplido.
 * @param {any[]} [input.dialogues] Las charlas del paquete (leídas o no), para `sceneDialogue`.
 * @param {string[]} [input.played] Los hitos cuya escena ya se jugó.
 * @param {any} [input.hero] Para el género de lo que se dice.
 * @param {any[]} [input.party]
 * @param {string[]} [input.chose] J13.8: lo elegido en escenas anteriores.
 * @returns {PlotScene}
 */
export function milestoneScene(milestone, { state = null, dialogues = [], played = [], hero = null, party = [], chose = [] } = {}) {
    const id = text(milestone?.id);
    const who = { heroe: hero, ...(Array.isArray(party) && party.length > 0 ? { grupo: party } : {}) };
    const said = resolveGender(text(milestone?.scene), who);
    /** @type {PlotScene} */
    const base = {
        kind: 'none', id, title: text(milestone?.title), text: said, beats: [], dialogue: null,
        backdrop: sceneBackdrop(milestone?.backdrop),
    };
    if (!isObject(milestone) || !id) return base;
    if (milestone.hidden && !readPlotState(state).done.includes(id)) return base;
    const asText = { ...base, kind: /** @type {'text'|'none'} */ (said ? 'text' : 'none') };
    if (listOf(played).includes(id)) return asText;

    const beats = readSceneBeats(milestone.beats, { id, hero, party, chose });
    const wanted = text(milestone.sceneDialogue);
    const dialogue = wanted
        ? (Array.isArray(dialogues) ? dialogues : []).map(asDialogue).find(d => d && d.id === wanted) ?? null
        : null;
    if (beats.length === 0 && !dialogue) return asText;
    return { ...base, kind: 'scene', beats, dialogue };
}

/**
 * Las escenas de un paso del hilo, en orden: las de lo que se acaba de abrir (menos lo oculto)
 * y las de los secretos que se acaban de encontrar. Lo que `applyPlotStep` contaba a mano.
 *
 * @param {{opened?: any[], done?: any[], state?: any}} step Un `PlotStep`.
 * @param {Object} [input] Lo mismo que `milestoneScene`, menos el estado, que es el del paso.
 * @param {any[]} [input.dialogues]
 * @param {string[]} [input.played]
 * @param {any} [input.hero]
 * @param {any[]} [input.party]
 * @param {string[]} [input.chose] J13.8: lo elegido en escenas anteriores.
 * @returns {Array<{milestone: any, scene: PlotScene, when: 'done'|'opened'}>}
 */
export function stepScenes(step, { dialogues = [], played = [], hero = null, party = [], chose = [] } = {}) {
    const found = (step?.done ?? []).filter(m => m?.hidden);
    // J9.1: la escena de un hito «llegar a» cuenta la llegada; se juega al llegar (al cumplirse),
    // no al abrirse. Antes salía en cuanto se abría («Llegas a las puertas del castillo…») y
    // luego había que hacer el viaje igual. Si ya se jugó (una partida de antes), no se repite.
    const arrived = (step?.done ?? []).filter(m => !m?.hidden && isArrival(m) && !listOf(played).includes(text(m?.id)));
    const opened = (step?.opened ?? []).filter(m => !m?.hidden && !isArrival(m));
    const scene = (/** @type {any} */ milestone) => milestoneScene(milestone, { state: step?.state, dialogues, played, hero, party, chose });
    return [
        ...[...found, ...arrived].map(milestone => ({ milestone, scene: scene(milestone), when: /** @type {'done'} */ ('done') })),
        ...opened.map(milestone => ({ milestone, scene: scene(milestone), when: /** @type {'opened'} */ ('opened') })),
    ].filter(entry => entry.scene.kind !== 'none');
}

/**
 * J9.1: si un hito pide llegar a un sitio: su escena es la de la llegada.
 *
 * @param {any} milestone
 * @returns {boolean}
 */
export function isArrival(milestone) {
    return text(milestone?.asks?.kind) === 'arrive';
}

/**
 * Apuntar que una escena ya se jugó.
 *
 * @param {any} played
 * @param {string} id
 * @returns {string[]}
 */
export function rememberScene(played, id) {
    const list = listOf(played);
    return text(id) && !list.includes(text(id)) ? [...list, text(id)] : list;
}

/**
 * Lo que puede elegir quien juega en la decisión de una línea: lo mismo que en una charla
 * (`optionsFor`), con sus etiquetas, lo cerrado con su porqué y las tiradas con su CD.
 *
 * @param {PlotScene} scene
 * @param {number} index La línea.
 * @param {Object} [input]
 * @param {any} [input.hero]
 * @param {DialogueWorld} [input.world] Con `attitude`, cómo os mira quien dice la línea.
 * @returns {OptionView[]}
 */
export function sceneOptions(scene, index, { hero = null, world = {} } = {}) {
    const decision = scene?.beats?.[index]?.decision;
    if (!decision) return [];
    return optionsFor(startDialogue(decision.dialogue, { hero, world }), hero, world);
}

/**
 * @typedef {Object} SceneChoiceResult
 * @property {boolean} ok
 * @property {string} reason Si no se pudo, por qué.
 * @property {string} said Lo que dijo (o hizo) quien juega.
 * @property {any} roll La tirada, si la hubo (la de `rollCheck`).
 * @property {'bien'|'medias'|'mal'|null} outcome
 * @property {DialogueEffect[]} effects Lo que hay que aplicar, con `who` ya puesto.
 * @property {SceneLine[]} reply Lo que se oye después.
 * @property {string[]} journal Lo que queda en el Diario.
 * @property {SceneChoice|null} choice Lo elegido, para `sceneTranscript`.
 */

/**
 * Elegir en una decisión: con las reglas de las charlas (condiciones, tirada y efectos) y la
 * respuesta escrita para lo elegido (y, con tirada, para cómo salió).
 *
 * @param {PlotScene} scene
 * @param {number} index
 * @param {string} optionId
 * @param {Object} [input]
 * @param {any} [input.hero] Quien decide: su ficha tira y su género concuerda.
 * @param {DialogueWorld} [input.world]
 * @param {() => number} [input.rollD20]
 * @returns {SceneChoiceResult}
 */
export function chooseInScene(scene, index, optionId, { hero = null, world = {}, rollD20 = () => 10 } = {}) {
    const refuse = (/** @type {string} */ reason) => ({ ok: false, reason, said: '', roll: null, outcome: null, effects: [], reply: [], journal: [], choice: null });
    const decision = scene?.beats?.[index]?.decision;
    if (!decision) return refuse('Aquí no hay nada que decidir.');
    const result = choose(startDialogue(decision.dialogue, { hero, world }), optionId, { hero, world, rollD20 });
    if (!result.ok) return refuse(result.reason);
    const replies = decision.replies[optionId] ?? { base: [], bien: [], medias: null, mal: [] };
    const after = result.outcome === 'bien' ? replies.bien
        : result.outcome === 'medias' ? (replies.medias ?? replies.bien)
            : result.outcome === 'mal' ? replies.mal : [];
    const reply = [...replies.base, ...after];
    return {
        ok: true,
        reason: '',
        said: result.said,
        roll: result.roll,
        outcome: result.outcome,
        effects: result.effects,
        reply,
        journal: result.state.learned.map(line => line.text),
        choice: { beat: index, option: optionId, said: result.said, outcome: result.outcome, reply },
    };
}

/**
 * @typedef {Object} SceneGame Lo de la partida que tocan los efectos de una escena.
 * @property {any} [attitudes] Cómo os mira cada uno (`readAttitudes`).
 * @property {string[]} [rumorsHeard] Los rumores ya oídos, por id.
 * @property {Record<string, number>} [rumorsHeardOn] El día en que se oyó cada uno.
 * @property {any[]} [rumors] Los del paquete, para decir cuál y adónde lleva.
 * @property {number} [day]
 * @property {number} [gold] El oro del grupo.
 * @property {string[]} [items] Lo que lleva el grupo, por nombre.
 * @property {any} [who] D-J17: quién juega (`{heroe, grupo}`), para que un rumor oído concuerde.
 */

/**
 * @typedef {Object} SceneApplied Lo que queda después, y lo que tiene que hacer quien llama.
 * @property {{values: Record<string, number>, changed: Record<string, number>}} attitudes
 * @property {string[]} rumorsHeard
 * @property {Record<string, number>} rumorsHeardOn
 * @property {number} gold
 * @property {number} goldChange Cuánto ha cambiado, para repartirlo entre las bolsas del grupo.
 * @property {string[]} items
 * @property {string[]} give Lo que hay que dar al grupo.
 * @property {string[]} take Lo que hay que quitarle.
 * @property {Array<{who: string, amount: number}>} bonds Los vínculos que cambian.
 * @property {number} time Los ratos del día que se van.
 * @property {string[]} milestones Los hitos que se cumplen: `{kind: 'milestone', id}` al hilo.
 * @property {string[]} reveal Los sitios que un rumor pone en el mapa.
 * @property {string[]} clues Lo que se apunta en el Diario.
 * @property {Array<{id: string, text: string, by: string}>} heard Los rumores que se acaban de oír.
 * @property {string[]} notes Cómo decirlo en la ventana.
 * @property {Array<{kind: 'board'|'go', name: string}>} moves D-J62: el tablero al que se va o el sitio
 *   al que se viaja al acabar la charla («Bajo a la bodega»). Lo hace quien llama, con la ventana cerrada.
 */

/**
 * Aplicar lo que cambia una decisión (o una charla): los efectos de las charlas (`dialogues.js`)
 * sobre lo que la partida guarda. Lo que es del grupo (dar, quitar, el vínculo, el rato, el hito)
 * se devuelve para que lo haga quien llama, que es quien sabe dónde vive.
 *
 * Lo escrito manda: el límite de un cambio de actitud al día es para lo que propone el narrador
 * (idea 140). Aquí se sube o se baja un paso, dentro de −3 y +3.
 *
 * @param {DialogueEffect[]} effects
 * @param {SceneGame} [game]
 * @returns {SceneApplied}
 */
export function applySceneEffects(effects, game = {}) {
    const day = Math.max(0, Math.floor(Number(game.day) || 0));
    let attitudes = readAttitudes(game.attitudes);
    let rumorsHeard = listOf(game.rumorsHeard);
    let rumorsHeardOn = { ...(isObject(game.rumorsHeardOn) ? game.rumorsHeardOn : {}) };
    const startGold = Math.max(0, Math.floor(Number(game.gold) || 0));
    let gold = startGold;
    let items = listOf(game.items);
    const rumors = readRumors(game.rumors);
    /** @type {Omit<SceneApplied, 'attitudes'|'rumorsHeard'|'rumorsHeardOn'|'gold'|'goldChange'|'items'>} */
    const out = { give: [], take: [], bonds: [], time: 0, milestones: [], reveal: [], clues: [], heard: [], notes: [], moves: /** @type {Array<{kind: 'board'|'go', name: string}>} */ ([]) };
    const note = (/** @type {string} */ said) => {
        if (text(said)) out.notes.push(text(said));
    };

    for (const effect of Array.isArray(effects) ? effects : []) {
        const amount = Math.round(Number(effect?.amount) || 0);
        const who = text(effect?.who);
        switch (effect?.kind) {
            case 'attitude': {
                const step = Math.sign(amount);
                if (!who || !step) break;
                const now = attitudes.values[who] ?? 0;
                const value = Math.max(ATTITUDE.min, Math.min(ATTITUDE.max, now + step));
                if (value === now) break;
                const values = { ...attitudes.values, [who]: value };
                if (value === 0) delete values[who];
                attitudes = { values, changed: { ...attitudes.changed, [who]: day } };
                note(describeDialogueEffect({ kind: 'attitude', who, amount: step }));
                break;
            }
            case 'bond':
                if (!who || !amount) break;
                out.bonds.push({ who, amount });
                note(describeDialogueEffect({ kind: 'bond', who, amount }));
                break;
            case 'gold': {
                const next = Math.max(0, gold + amount);
                if (next === gold) break;
                note(describeDialogueEffect({ kind: 'gold', amount: next - gold }));
                gold = next;
                break;
            }
            case 'give': {
                const item = text(effect?.item);
                if (!item) break;
                items = [...items, item];
                out.give.push(item);
                note(describeDialogueEffect({ kind: 'give', item }));
                break;
            }
            case 'take': {
                const item = text(effect?.item);
                const at = items.findIndex(i => fold(i) === fold(item));
                if (!item || at < 0) break;
                items = items.filter((_, i) => i !== at);
                out.take.push(item);
                note(describeDialogueEffect({ kind: 'take', item }));
                break;
            }
            case 'clue': {
                const said = text(effect?.text);
                if (!said || out.clues.includes(said)) break;
                out.clues.push(said);
                note(describeDialogueEffect({ kind: 'clue', text: said }));
                break;
            }
            case 'rumor': {
                const id = text(effect?.id);
                if (!id || rumorsHeard.includes(id)) break;
                const rumor = rumors.find(r => r.id === id);
                rumorsHeard = [...rumorsHeard, id];
                rumorsHeardOn = { ...rumorsHeardOn, [id]: Math.max(1, day) };
                if (rumor) {
                    // D-J17: el rumor puede traer `{forma|forma}`; en la ventana, ya concordado.
                    const said = resolveGender(rumor.text, game.who ?? {});
                    out.heard.push({ id, text: said, by: rumor.by });
                    if (rumor.leadsTo && !out.reveal.includes(rumor.leadsTo)) out.reveal.push(rumor.leadsTo);
                    note(`Apuntado en el Diario: «${said}»`);
                } else {
                    note(describeDialogueEffect({ kind: 'rumor', id }));
                }
                break;
            }
            case 'milestone': {
                const id = text(effect?.id);
                if (id && !out.milestones.includes(id)) out.milestones.push(id);
                break;
            }
            case 'time':
                out.time += 1;
                note(describeDialogueEffect({ kind: 'time' }));
                break;
            // D-J62: ir a un tablero o a un sitio, al acabar; el último que se pide manda.
            case 'board':
            case 'go': {
                const name = text(effect.kind === 'board' ? effect?.board : effect?.place);
                if (name) out.moves = [...out.moves.filter(m => m.kind !== effect.kind), { kind: /** @type {'board'|'go'} */ (effect.kind), name }];
                break;
            }
            default:
                break;
        }
    }
    return { attitudes, rumorsHeard, rumorsHeardOn, gold, goldChange: gold - startGold, items, ...out };
}

/**
 * Una línea escrita en llano: «Tomás: «¡Al ladrón!»», o lo que cuenta el narrador tal cual.
 *
 * @param {SceneLine} line
 * @returns {string}
 */
function lineText(line) {
    return line.who ? `${line.who}: «${line.text}»` : line.text;
}

/**
 * Lo que pasó en la escena, línea a línea y con lo elegido: lo que lee el narrador (para no
 * contradecirla) y lo que queda en el chat. Una escena de texto es su texto.
 *
 * @param {PlotScene} scene
 * @param {SceneChoice[]} [choices]
 * @returns {string[]}
 */
export function sceneTranscript(scene, choices = []) {
    if (scene?.kind !== 'scene') return scene?.text ? [scene.text] : [];
    /** @type {string[]} */
    const lines = [];
    scene.beats.forEach((beat, index) => {
        lines.push(lineText(beat));
        for (const choice of (Array.isArray(choices) ? choices : []).filter(c => c?.beat === index)) {
            const how = choice.outcome ? ` (la tirada ${OUTCOME_WORDS[choice.outcome]})` : '';
            lines.push(`Tú: «${choice.said}»${how}`);
            for (const reply of choice.reply ?? []) lines.push(lineText(reply));
        }
    });
    if (scene.dialogue) lines.push(`Después, una charla con ${scene.dialogue.speaker}.`);
    return lines;
}

/**
 * Lo que se decidió, para el Diario (J9.6): «El ratero del muelle: «¡Quédate atrás…!»».
 *
 * @param {PlotScene} scene
 * @param {SceneChoice[]} [choices]
 * @returns {string[]}
 */
export function sceneDecisions(scene, choices = []) {
    return (Array.isArray(choices) ? choices : [])
        .filter(choice => text(choice?.said))
        .map(choice => `${scene?.title || 'La historia'}: «${choice.said}»`);
}

/**
 * @typedef {Object} SceneIssue
 * @property {string} path
 * @property {string} message
 */

/**
 * Lo que está mal escrito en las escenas de un hilo. Lo que un esquema no ve: quién habla, si
 * la charla existe, y los efectos, las condiciones y las tiradas de cada decisión (con el mismo
 * `checkDialogues` que las charlas).
 *
 * - **errores**: `beats` que no es una lista, una línea sin texto, una marca de género mal
 *   escrita, una charla (`sceneDialogue`) que no existe, un efecto o una tirada mal escritos, o
 *   una decisión del narrador que cambia cómo os mira alguien sin decir quién.
 * - **avisos**: alguien que no es de la gente ni de los compañeros (sale sin retrato), un gesto
 *   que no se conoce, un fondo que no es ni sitio ni localización, una escena sin `scene` (el
 *   narrador no sabría qué ha pasado), y una escena demasiado larga.
 *
 * @param {any} plot El hilo del paquete, tal cual.
 * @param {Object} [refs]
 * @param {string[]} [refs.people] Quién puede hablar: la gente y los compañeros.
 * @param {string[]} [refs.rumors] Los ids de los rumores.
 * @param {string[]} [refs.items] Los nombres de los objetos.
 * @param {string[]} [refs.dialogues] Los ids de las charlas.
 * @param {string[]} [refs.places] Las localizaciones, para el fondo.
 * @returns {{errors: SceneIssue[], warnings: SceneIssue[]}}
 */
export function checkPlotScenes(plot, { people = [], rumors = [], items = [], dialogues = [], places = [] } = {}) {
    /** @type {SceneIssue[]} */
    const errors = [];
    /** @type {SceneIssue[]} */
    const warnings = [];
    const milestones = Array.isArray(plot?.milestones) ? plot.milestones : [];
    const ids = milestones.map(m => text(m?.id)).filter(Boolean);
    const known = new Set(people.map(fold).filter(Boolean));
    const talks = new Set(dialogues.map(text).filter(Boolean));
    const towns = new Set(places.map(fold).filter(Boolean));

    /** @param {any} said @param {string} path */
    const markers = (said, path) => {
        const bad = leftoverMarkers(text(said));
        if (bad.length > 0) errors.push({ path, message: `Marca de género mal escrita: ${bad[0]}. Se escribe {forma|forma}.` });
    };

    /** D-J60: una línea que no dice nadie. */
    const nobody = (/** @type {string} */ path) => warnings.push({
        path,
        message: 'Esta línea no la dice nadie (sin `who`). En el juego sin conexión no hay narrador (D-J60): que la diga alguien que esté allí (de `npcs` o `confidants`), o quítala. Si se queda, sale en un aviso pequeño fuera de la caja.',
    });

    /** Una línea: su texto, quién y su gesto. @param {any} raw @param {string} path @param {boolean} [reply] */
    const checkLine = (raw, path, reply = false) => {
        if (typeof raw === 'string') {
            if (!text(raw)) errors.push({ path, message: 'Una línea sin texto no dice nada.' });
            else nobody(path);
            markers(raw, path);
            return;
        }
        if (!isObject(raw)) {
            errors.push({ path, message: 'Una línea es un objeto con `text` (y `who` y `mood` si habla alguien).' });
            return;
        }
        if (!text(raw.text)) errors.push({ path: `${path}.text`, message: 'Falta lo que se dice o se cuenta (`text`).' });
        markers(raw.text, `${path}.text`);
        const who = text(raw.who);
        // D-J60: una decisión sin quien hable vale (las opciones las dices tú), pero su línea no.
        if (!who && text(raw.text)) nobody(`${path}.who`);
        if (who && !known.has(fold(who))) {
            warnings.push({ path: `${path}.who`, message: `"${who}" no está entre la gente (\`npcs\`), los compañeros (\`confidants\`) ni el bestiario: saldrá sin retrato.` });
        }
        if (raw.mood !== undefined && !MOODS.includes(fold(raw.mood))) {
            warnings.push({ path: `${path}.mood`, message: `"${text(raw.mood)}" no es un gesto: se verá neutral. Los que hay: ${MOODS.join(', ')}.` });
        }
        if (reply && raw.options !== undefined) {
            warnings.push({ path: `${path}.options`, message: 'Una respuesta no lleva opciones: se ignoran. La decisión va en una línea de `beats`.' });
        }
    };

    /** Lo que se oye tras elegir: una línea o varias. @param {any} raw @param {string} path */
    const checkReply = (raw, path) => {
        if (raw === undefined) return;
        if (Array.isArray(raw)) raw.forEach((line, i) => checkLine(line, `${path}[${i}]`, true));
        else checkLine(raw, path, true);
    };

    /** Si una lista de efectos cambia cómo os mira alguien sin decir quién. @param {any} list */
    const needsWho = (list) => (Array.isArray(list) ? list : list == null ? [] : [list])
        .some(e => isObject(e) && ('attitude' in e || 'bond' in e) && !text(e.who));

    milestones.forEach((milestone, m) => {
        if (!isObject(milestone)) return;
        const path = `plot.milestones[${m}]`;
        if (milestone.sceneDialogue !== undefined) {
            const wanted = text(milestone.sceneDialogue);
            if (!wanted || !talks.has(wanted)) {
                errors.push({ path: `${path}.sceneDialogue`, message: `La charla "${wanted}" no está en \`dialogues\`.` });
            }
        }
        if (milestone.backdrop !== undefined) {
            const where = sceneBackdrop(milestone.backdrop);
            if (!where.place && !towns.has(fold(where.town))) {
                warnings.push({
                    path: `${path}.backdrop`,
                    message: `"${text(milestone.backdrop)}" no es un sitio del pueblo (${Object.keys(PLACE_KINDS).join(', ')}) ni una localización del paquete: se verá el fondo de donde estéis.`,
                });
            }
        }
        if (milestone.beats === undefined) return;
        if (!Array.isArray(milestone.beats)) {
            errors.push({ path: `${path}.beats`, message: '`beats` es una lista de líneas: {"who", "mood", "text"}.' });
            return;
        }
        if (!text(milestone.scene)) {
            warnings.push({ path: `${path}.scene`, message: 'Con `beats`, `scene` sigue haciendo falta: es lo que lee el narrador y lo que se cuenta en una partida de antes.' });
        }
        if (milestone.beats.length > SCENE_LIMITS.beats) {
            warnings.push({ path: `${path}.beats`, message: `${milestone.beats.length} líneas son muchas: de 3 a 8 se leen bien. Mejor partirla en dos hitos.` });
        }
        const decisions = milestone.beats.filter((/** @type {any} */ b) => isObject(b) && Array.isArray(b.options) && b.options.length > 0).length;
        if (decisions > SCENE_LIMITS.decisions) {
            warnings.push({ path: `${path}.beats`, message: `${decisions} decisiones en una escena son muchas: una o dos pesan más.` });
        }

        milestone.beats.forEach((/** @type {any} */ beat, b) => {
            const beatPath = `${path}.beats[${b}]`;
            checkLine(beat, beatPath);
            // J13.8: sus otras versiones (`alt`), con su texto, su condición y sus marcas.
            if (isObject(beat) && beat.alt !== undefined) {
                const alts = checkBeatAlts(beat.alt, `${beatPath}.alt`);
                errors.push(...alts.errors);
                warnings.push(...alts.warnings);
                if (Array.isArray(beat.alt)) beat.alt.forEach((/** @type {any} */ alt, a) => { if (isObject(alt)) markers(alt.text, `${beatPath}.alt[${a}].text`); });
            }
            if (!isObject(beat) || beat.options === undefined) return;
            if (!Array.isArray(beat.options)) {
                errors.push({ path: `${beatPath}.options`, message: 'Las opciones de una decisión van en una lista.' });
                return;
            }
            const who = text(beat.who);
            const speaks = Boolean(who) && known.has(fold(who));
            // Las opciones, con las reglas de las charlas: una charla de un nudo, sin `next`.
            const found = checkDialogues([{
                id: `escena-${m}-${b}`,
                speaker: speaks ? who : NARRATOR_CHECK,
                nodes: [{ id: 'decision', line: 'x', options: beat.options.map((/** @type {any} */ o) => (isObject(o) ? optionForEngine(o) : o)) }],
            }], { people: [...people, NARRATOR_CHECK], milestones: ids, rumors, items });
            const remap = (/** @type {SceneIssue} */ issue) => ({ ...issue, path: issue.path.replace(/^dialogues\[0\]\.nodes\[0\]/, beatPath).replace(/^dialogues\[0\]/, beatPath) });
            errors.push(...found.errors.map(remap));
            warnings.push(...found.warnings.map(remap));
            beat.options.forEach((/** @type {any} */ option, o) => {
                if (!isObject(option)) return;
                const optionPath = `${beatPath}.options[${o}]`;
                checkReply(option.reply, `${optionPath}.reply`);
                const check = isObject(option.check) ? option.check : null;
                for (const outcome of ['success', 'partial', 'failure']) {
                    const branch = check?.[outcome];
                    if (typeof branch === 'string') checkReply(branch, `${optionPath}.check.${outcome}`);
                    else if (isObject(branch)) checkReply(branch.reply, `${optionPath}.check.${outcome}.reply`);
                }
                if (speaks) return;
                const all = [option.effects, ...(check ? ['success', 'partial', 'failure'].map(k => (isObject(check[k]) ? check[k].effects : undefined)) : [])];
                if (all.some(needsWho)) {
                    errors.push({
                        path: `${optionPath}.effects`,
                        message: 'Esta decisión la cuenta el narrador (o alguien sin ficha): `attitude` y `bond` tienen que decir con quién (`who`).',
                    });
                }
            });
        });
    });
    return { errors, warnings };
}
