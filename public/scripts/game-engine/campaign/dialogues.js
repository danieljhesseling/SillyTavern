/**
 * Hablar sin IA: las charlas con ramas (J8.1, J8.2, J8.3 y J8.6 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * La charla de siempre (`talk.js`) tiene temas que se ganan: qué sabe, qué busca, un rumor.
 * Sirve con cualquiera, pero con quien importa se queda corta: Brunilda os recibe, Giles os
 * vende lo que vio, Ismark os pide ayuda. Eso se escribe, y aquí se juega:
 *
 * - **Nudos**: lo que dice quien habla, con su gesto (`alegre`, `enfadado`, `triste` o
 *   `neutral`, que es la cara del retrato) y las opciones de quien juega.
 * - **Condiciones** de cada opción: cómo os mira, un hito, algo que se lleva, el oro, y quién
 *   eres (especie, clase, trasfondo, género). Lo de quién eres no se enseña si no encaja: sale
 *   como «[Enano] …» solo al enano (J8.2). Lo que se puede ganar (que os mire mejor, llevar
 *   algo) sí se enseña, apagado y diciendo por qué.
 * - **Tiradas** con bien, a medias y mal, con las reglas de siempre (`rollCheck` y
 *   `outcomeOf`, J8.3). A medias, sin rama escrita, sale como bien pero se paga lo de la tabla
 *   de `consequences.js`.
 * - **Efectos**: cómo os mira, una pista, un rumor, un hito, un objeto que se da o se quita,
 *   el oro, el vínculo, un rato del día y «se acabó». No se aplican aquí: se devuelven, y los
 *   aplica quien llama.
 * - **Lo dicho no se repite** (J8.6): lo que ya preguntasteis no vuelve a salir, y quien ya
 *   os dijo algo lo resume (`again`). Lo que se aprende queda apuntado para el Diario.
 *
 * Cómo se escribe en el paquete (`dialogues`, uno por charla):
 *
 *     { "id": "brunilda-bienvenida", "speaker": "Brunilda", "start": "inicio",
 *       "nodes": [
 *         { "id": "inicio", "mood": "neutral", "line": "…", "again": "…",
 *           "options": [
 *             { "id": "bodega", "text": "¿Qué hay en la bodega?", "next": "bodega",
 *               "if": { "milestone": { "id": "la-prueba", "is": "open" } } },
 *             { "id": "enano", "text": "Esas ratas no saben con quién se meten.",
 *               "if": { "species": "Enano" }, "effects": [{ "attitude": 1 }], "next": "risa" },
 *             { "id": "adelanto", "text": "¿Me adelantas algo para el equipo?",
 *               "check": { "skill": "persuasion", "dc": 13,
 *                 "success": { "next": "si", "effects": [{ "gold": 5 }] },
 *                 "failure": { "next": "no" } } },
 *             { "id": "adios", "text": "Me voy.", "end": true, "repeat": true } ] } ] }
 *
 * Puro, con el dado inyectado: lee, dice qué se ve, elige y apunta.
 */

import { rollCheck, SKILLS, DEFAULT_DC } from '../rules/checks.js';
import { outcomeOf, consequence } from './consequences.js';
import { resolveGender, genderOf, leftoverMarkers } from './grammar.js';
import { BACKGROUNDS } from './backgrounds.js';
import { describeAttitude, ATTITUDE } from './attitudes.js';
import { readNoReturn, optionNoReturn } from './weighty.js';
import { followUpLine, hashOf } from './human-lines.js';

/** Los gestos del retrato. `neutral` es la cara de siempre. */
export const MOODS = ['neutral', 'alegre', 'enfadado', 'triste'];

/** Lo que puede hacer una opción, con la clave con que se escribe. */
export const EFFECT_KINDS = ['attitude', 'clue', 'rumor', 'milestone', 'give', 'take', 'bond', 'gold', 'time', 'end'];

/** Las condiciones que se entienden, con la clave con que se escriben. */
export const CONDITION_KEYS = ['attitude', 'milestone', 'item', 'gold', 'species', 'class', 'background', 'gender', 'said', 'chose'];

/** Cómo puede estar un hito para una condición. */
export const MILESTONE_STATES = ['open', 'done', 'not-done'];

/**
 * Las tiradas en las que cuenta cómo os mira: a quien os aprecia se le convence y se le
 * engaña mejor. La CD baja un punto por cada paso de aprecio (y sube si os mira mal).
 */
export const SOCIAL_SKILLS = ['persuasion', 'deception'];

/** Lo más fácil y lo más difícil que puede ser una tirada escrita. */
export const DC_LIMITS = { min: 5, max: 30 };

/**
 * @typedef {Object} DialogueCondition Todas se tienen que cumplir.
 * @property {{min?: number, max?: number}} [attitude]
 * @property {{id: string, is: string}} [milestone]
 * @property {string} [item]
 * @property {number} [gold]
 * @property {string[]} [species]
 * @property {string[]} [class]
 * @property {string[]} [background]
 * @property {string} [gender]
 * @property {string} [said] Una opción de esta charla que ya se eligió.
 * @property {string[]} [chose] J13.8: algo que se eligió en una escena del hilo (el id de su
 *   opción): basta uno. Así quien te habla se acuerda de lo que hiciste.
 * @property {string[]} [unknown] Lo escrito que no es ninguna condición.
 */

/**
 * @typedef {Object} DialogueEffect
 * @property {string} kind Uno de `EFFECT_KINDS`, o `unknown`.
 * @property {number} [amount] `attitude`, `bond` y `gold`.
 * @property {string} [who] `attitude` y `bond`: con quién. Sin decirlo, quien habla.
 * @property {string} [text] `clue`.
 * @property {string} [id] `rumor` y `milestone`.
 * @property {string} [item] `give` y `take`.
 * @property {any} [raw] `unknown`: lo que venía.
 */

/**
 * @typedef {Object} DialogueBranch
 * @property {string} next
 * @property {boolean} end
 * @property {DialogueEffect[]} effects
 * @property {string} journal
 */

/**
 * @typedef {Object} DialogueCheck
 * @property {string} skill
 * @property {number} dc
 * @property {DialogueBranch} success
 * @property {DialogueBranch|null} partial Sin escribir, a medias es bien pagando lo de la tabla.
 * @property {DialogueBranch} failure
 */

/**
 * @typedef {Object} DialogueOption
 * @property {string} id
 * @property {string} text Lo que dice (o hace) quien juega.
 * @property {string|null} tag La etiqueta que se ve delante («Enano»); null, la de su condición.
 * @property {DialogueCondition[]} when Las formas de cumplirla (basta una). Vacía: siempre.
 * @property {boolean} hidden Si, cerrada, no se enseña en vez de enseñarse apagada.
 * @property {boolean} repeat Si se puede decir más de una vez («Me voy»).
 * @property {string} next
 * @property {boolean} end
 * @property {DialogueEffect[]} effects
 * @property {DialogueCheck|null} check
 * @property {string} journal Lo que queda en el Diario al elegirla.
 * @property {{text: string, mood: string}|null} [reply] J13.8: lo que contesta quien habla nada
 *   más oírla, antes de seguir («Gracias» → «No me las des»). Si lleva de vuelta a donde ya
 *   estabais, con eso basta: no repite su frase.
 * @property {string} [noReturn] J11.1: su aviso, si se escribe `irreversible` («Esto no tiene vuelta atrás»).
 * @property {string[]} [decision] J7.5: lo que es, si se escribe (`pagar`, `amenazar`…, de
 *   `companion-opinions.js`), para lo que opinan tus compañeros.
 */

/**
 * @typedef {Object} DialogueNode
 * @property {string} id
 * @property {string} line Lo que dice quien habla la primera vez.
 * @property {string} again Lo que dice si ya se lo oísteis (J8.6). Vacío: lo mismo.
 * @property {Array<{text: string, when: DialogueCondition[]}>} [agains] J13.8: si `again` se
 *   escribe como lista, todas: vale la primera con condición que se cumpla; si no, una sin
 *   condición, distinta según el día.
 * @property {string[]} [more] J13.8: lo que dice al volver aquí sin haberse ido (tras «Gracias»
 *   o «Entendido»), por turnos. Sin escribir, una frase corta del compendio (`charla-sigue`).
 * @property {string} mood
 * @property {string} journal Lo que queda en el Diario al oírlo.
 * @property {DialogueEffect[]} effects Lo que pasa al oírlo la primera vez.
 * @property {string|string[]|boolean} [presenta] J13.7: quién se da a conocer en esta línea (`true`: quien habla).
 * @property {DialogueOption[]} options
 */

/**
 * @typedef {Object} Dialogue
 * @property {string} id
 * @property {string} speaker
 * @property {string} title
 * @property {string} start
 * @property {DialogueCondition[]} when Cuándo se ofrece.
 * @property {DialogueNode[]} nodes
 */

/**
 * @typedef {Object} DialogueWorld Lo que se sabe de la partida para las condiciones.
 * @property {number} [attitude] Cómo os mira quien habla, de −3 a 3.
 * @property {string[]} [open] Los hitos abiertos.
 * @property {string[]} [done] Los cumplidos.
 * @property {string[]} [items] Los nombres de lo que lleva el grupo.
 * @property {number} [gold] El oro del grupo.
 * @property {any[]} [party] El grupo, para los plurales de género.
 * @property {number} [day] Hoy, para lo que se apunta.
 * @property {Record<string, string>} [weighty] J11.1: los hitos que pesan (`weightyMilestones`): una
 *   opción que cumple uno avisa de que no tiene vuelta atrás.
 * @property {string[]} [chose] J13.8: lo elegido en las escenas del hilo, por el id de la opción.
 */

/**
 * @typedef {Object} DialogueState
 * @property {Dialogue} dialogue
 * @property {string} node Dónde está la charla; vacío si acabó.
 * @property {boolean} ended
 * @property {boolean} repeated Si lo del nudo actual ya se había oído al entrar.
 * @property {DialogueEffect[]} pending Lo que hace el nudo al que se acaba de entrar (la primera
 *   vez). `choose` lo devuelve con lo demás; al empezar, lo aplica quien abre la charla.
 * @property {string[]} heard Los nudos oídos, de antes y de ahora.
 * @property {string[]} chosen Las opciones elegidas, de antes y de ahora.
 * @property {Array<{who: string, text: string, day: number}>} learned Lo aprendido en esta charla.
 * @property {Array<{kind: 'npc'|'hero'|'roll'|'note', who: string, text: string, mood?: string}>} log
 * @property {string[]} [here] J13.8: los nudos por los que ha pasado esta charla (no las de antes).
 * @property {number} [backs] J13.8: las veces que se ha vuelto al principio en esta charla.
 * @property {string} [face] J13.8: el gesto de lo último que dijo (una respuesta trae el suyo).
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string} */
const fold = (value) => text(value).toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** @param {any} value @returns {string[]} */
const listOf = (value) => (Array.isArray(value) ? value : [value]).map(text).filter(Boolean);

/** @param {any} value @returns {boolean} */
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/**
 * La raíz de un nombre, para que «Enana» sea «Enano» y «Clériga» sea «Clérigo»: sin tildes,
 * sin el «raza-» del compendio y sin la vocal del género al final de cada palabra.
 *
 * @param {any} value
 * @returns {string}
 */
export function kindStem(value) {
    return fold(value).replace(/^raza[-\s]+/, '').split(/[^a-z0-9ñ]+/).filter(Boolean)
        .map(word => (word.length > 3 ? word.replace(/[ao]s?$/, '') : word)).join(' ');
}

/**
 * El trasfondo por su id (`soldado`) o por su nombre («Soldado veterano»).
 *
 * @param {any} value
 * @returns {string} El id, o la raíz de lo escrito si no es ninguno.
 */
function backgroundKey(value) {
    const said = fold(value);
    if (!said) return '';
    for (const [id, def] of Object.entries(BACKGROUNDS)) {
        if (said === id || said === fold(def.label) || kindStem(said) === kindStem(def.label.split(/\s+/)[0])) return id;
    }
    return kindStem(said);
}

/**
 * La etiqueta de un trasfondo: la primera palabra de su nombre («Soldado veterano» → «Soldado»).
 *
 * @param {string} value
 * @returns {string}
 */
function backgroundTag(value) {
    const def = BACKGROUNDS[/** @type {keyof typeof BACKGROUNDS} */ (backgroundKey(value))];
    return def ? def.label.split(/\s+/)[0] : text(value);
}

/**
 * @param {any} raw
 * @returns {DialogueEffect}
 */
function readEffect(raw) {
    if (typeof raw === 'string') {
        const said = fold(raw);
        if (said === 'end' || said === 'time') return { kind: said };
        return { kind: 'unknown', raw };
    }
    if (!isObject(raw)) return { kind: 'unknown', raw };
    const who = text(raw.who);
    if ('attitude' in raw) return { kind: 'attitude', amount: Math.sign(Math.round(Number(raw.attitude) || 0)), ...(who ? { who } : {}) };
    if ('bond' in raw) return { kind: 'bond', amount: Math.round(Number(raw.bond) || 0), ...(who ? { who } : {}) };
    if ('gold' in raw) return { kind: 'gold', amount: Math.round(Number(raw.gold) || 0) };
    if ('clue' in raw) return { kind: 'clue', text: text(raw.clue) };
    if ('rumor' in raw) return { kind: 'rumor', id: text(raw.rumor) };
    if ('milestone' in raw) return { kind: 'milestone', id: text(raw.milestone) };
    if ('give' in raw) return { kind: 'give', item: text(raw.give) };
    if ('take' in raw) return { kind: 'take', item: text(raw.take) };
    if ('time' in raw) return { kind: 'time' };
    if ('end' in raw) return raw.end === false ? { kind: 'unknown', raw } : { kind: 'end' };
    return { kind: 'unknown', raw };
}

/**
 * @param {any} raw
 * @returns {DialogueEffect[]}
 */
function readEffects(raw) {
    return (Array.isArray(raw) ? raw : raw == null ? [] : [raw]).map(readEffect);
}

/**
 * Una condición, venga como venga escrita.
 *
 * @param {any} raw
 * @returns {DialogueCondition}
 */
function readCondition(raw) {
    /** @type {DialogueCondition} */
    const out = {};
    if (!isObject(raw)) return out;
    /** @type {string[]} */
    const unknown = Object.keys(raw).filter(key => !CONDITION_KEYS.includes(key));
    if (unknown.length > 0) out.unknown = unknown;
    if (raw.attitude !== undefined) {
        // `"attitude": 1` es «al menos cordial»; con min y max, un tramo.
        const attitude = isObject(raw.attitude) ? raw.attitude : { min: raw.attitude };
        out.attitude = {
            ...(attitude.min !== undefined ? { min: Math.round(Number(attitude.min) || 0) } : {}),
            ...(attitude.max !== undefined ? { max: Math.round(Number(attitude.max) || 0) } : {}),
        };
    }
    if (raw.milestone !== undefined) {
        // `"milestone": "la-prueba"` es «cumplido».
        const milestone = isObject(raw.milestone) ? raw.milestone : { id: raw.milestone };
        out.milestone = { id: text(milestone.id), is: text(milestone.is) || 'done' };
    }
    if (text(raw.item)) out.item = text(raw.item);
    if (raw.gold !== undefined) out.gold = Math.max(0, Math.round(Number(raw.gold) || 0));
    for (const key of /** @type {const} */ (['species', 'class', 'background'])) {
        if (raw[key] !== undefined) out[key] = listOf(raw[key]);
    }
    if (text(raw.gender)) out.gender = text(raw.gender);
    if (text(raw.said)) out.said = text(raw.said);
    if (raw.chose !== undefined && listOf(raw.chose).length > 0) out.chose = listOf(raw.chose);
    return out;
}

/**
 * J13.8: lo que contesta quien habla nada más oír una opción: una frase, o `{text, mood}`.
 *
 * @param {any} raw
 * @returns {{text: string, mood: string}|null}
 */
function readReply(raw) {
    const source = typeof raw === 'string' ? { text: raw } : isObject(raw) ? raw : null;
    if (!source || !text(source.text)) return null;
    const mood = fold(source.mood);
    return { text: text(source.text), mood: MOODS.includes(mood) ? mood : '' };
}

/**
 * J13.8: lo que dice al volver otro día (`again`): una frase o una lista. En la lista, cada una
 * puede traer su condición (`{"if": {…}, "text": "…"}`). Una ya leída trae `when`.
 *
 * @param {any} raw
 * @returns {Array<{text: string, when: DialogueCondition[]}>}
 */
function readAgain(raw) {
    return (Array.isArray(raw) ? raw : raw == null ? [] : [raw])
        .map(entry => (typeof entry === 'string' ? { text: text(entry), when: [] }
            : isObject(entry) ? { text: text(entry.text), when: Array.isArray(entry.when) ? entry.when : readConditions(entry.if) }
                : { text: '', when: [] }))
        .filter(entry => entry.text);
}

/**
 * Las formas de cumplir algo: un objeto (todo) o una lista de objetos (basta uno).
 *
 * @param {any} raw
 * @returns {DialogueCondition[]}
 */
function readConditions(raw) {
    if (raw == null) return [];
    return (Array.isArray(raw) ? raw : [raw]).map(readCondition);
}

/**
 * @param {any} raw
 * @returns {DialogueBranch}
 */
function readBranch(raw) {
    if (typeof raw === 'string') return { next: text(raw), end: false, effects: [], journal: '' };
    const source = isObject(raw) ? raw : {};
    const effects = readEffects(source.effects);
    return {
        next: text(source.next),
        end: source.end === true || effects.some(e => e.kind === 'end'),
        effects: effects.filter(e => e.kind !== 'end'),
        journal: text(source.journal),
    };
}

/**
 * @param {any} raw
 * @returns {DialogueCheck|null}
 */
function readCheck(raw) {
    if (!isObject(raw)) return null;
    const dc = Number(raw.dc);
    return {
        skill: text(raw.skill),
        dc: Number.isFinite(dc) && dc > 0 ? Math.round(dc) : DEFAULT_DC,
        success: readBranch(raw.success),
        partial: raw.partial == null ? null : readBranch(raw.partial),
        failure: readBranch(raw.failure),
    };
}

/**
 * Un id para una opción que no lo trae: el del nudo y el principio de lo que dice. Mejor que
 * su posición: reordenar las opciones no hace que lo ya dicho vuelva a salir.
 *
 * @param {string} node
 * @param {string} said
 * @param {number} index
 * @returns {string}
 */
function optionId(node, said, index) {
    const slug = fold(said).replace(/[^a-z0-9ñ]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32).replace(/-+$/, '');
    return `${node}:${slug || index + 1}`;
}

/**
 * @param {any} raw
 * @param {string} node
 * @param {number} index
 * @returns {DialogueOption}
 */
function readOption(raw, node, index) {
    const source = isObject(raw) ? raw : {};
    const said = text(source.text);
    const effects = readEffects(source.effects);
    return {
        id: text(source.id) || optionId(node, said, index),
        text: said,
        tag: typeof source.tag === 'string' ? source.tag.trim() : null,
        when: readConditions(source.if),
        hidden: source.hidden === true,
        repeat: source.repeat === true,
        next: text(source.next),
        end: source.end === true || effects.some(e => e.kind === 'end'),
        effects: effects.filter(e => e.kind !== 'end'),
        check: readCheck(source.check),
        journal: text(source.journal),
        // J13.8: lo que te contesta al momento, si se escribe.
        ...(readReply(source.reply) ? { reply: readReply(source.reply) } : {}),
        // J11.1: solo si se escribe, para que una opción de antes se lea igual que siempre. Una
        // ya leída trae el suyo en `noReturn`.
        ...(readNoReturn(source) || text(source.noReturn) ? { noReturn: readNoReturn(source) || text(source.noReturn) } : {}),
        // J7.5: lo que es, si se escribe; si no, lo que opinan se saca de lo que hace.
        ...(readDecision(source.decision).length > 0 ? { decision: readDecision(source.decision) } : {}),
    };
}

/**
 * J7.5: lo que dice ser una opción (`"decision": "amenazar"`, o una lista), en palabras sueltas.
 *
 * @param {any} raw
 * @returns {string[]}
 */
function readDecision(raw) {
    return [...new Set((Array.isArray(raw) ? raw : raw == null ? [] : [raw]).map(text).filter(Boolean))];
}

/**
 * @param {any} raw
 * @param {number} index
 * @returns {DialogueNode}
 */
function readNode(raw, index) {
    const source = isObject(raw) ? raw : {};
    const id = text(source.id) || `nudo-${index + 1}`;
    const mood = fold(source.mood);
    // J13.8: `again` puede ser una lista; `again` se queda con la primera sin condición, como antes.
    const agains = readAgain(source.agains ?? source.again);
    const more = listOf(source.more);
    return {
        id,
        line: text(source.line),
        again: agains.find(a => a.when.length === 0)?.text ?? agains[0]?.text ?? '',
        ...(agains.length > 1 || agains.some(a => a.when.length > 0) ? { agains } : {}),
        ...(more.length > 0 ? { more } : {}),
        mood: MOODS.includes(mood) ? mood : 'neutral',
        journal: text(source.journal),
        // Lo que pasa al oírlo la primera vez, se llegue por donde se llegue: pagando, con una
        // buena tirada o por las malas, Giles cuenta lo mismo y el hito se cumple una vez.
        effects: readEffects(source.effects).filter(e => e.kind !== 'end'),
        options: (Array.isArray(source.options) ? source.options : []).map((option, i) => readOption(option, id, i)),
        // J13.7: quién se da a conocer en esta línea (`true`: quien habla), si el paquete lo dice.
        ...(source.presenta != null && source.presenta !== '' ? { presenta: source.presenta } : {}),
    };
}

/**
 * Una charla tal como se puede jugar, venga como venga escrita. Sin id o sin nudos, nada.
 *
 * @param {any} raw
 * @returns {Dialogue|null}
 */
export function readDialogue(raw) {
    if (!isObject(raw)) return null;
    const id = text(raw.id);
    const nodes = (Array.isArray(raw.nodes) ? raw.nodes : []).map(readNode);
    if (!id || nodes.length === 0) return null;
    const start = text(raw.start);
    return {
        id,
        speaker: text(raw.speaker),
        title: text(raw.title),
        start: start && nodes.some(n => n.id === start) ? start : nodes[0].id,
        when: readConditions(raw.when),
        nodes,
    };
}

/**
 * Las charlas de un paquete (o de los metadatos del mundo), las que se pueden jugar.
 *
 * @param {any} raw
 * @returns {Dialogue[]}
 */
export function readDialogues(raw) {
    return (Array.isArray(raw) ? raw : []).map(readDialogue).filter(/** @returns {d is Dialogue} */ d => d !== null);
}

/**
 * @param {Dialogue} dialogue
 * @param {string} id
 * @returns {DialogueNode|null}
 */
function nodeOf(dialogue, id) {
    return dialogue.nodes.find(n => n.id === id) ?? null;
}

/**
 * La clase de alguien, como la guarde su ficha.
 *
 * @param {any} hero
 * @returns {string}
 */
function classOf(hero) {
    return text(hero?.class ?? hero?.className ?? hero?.charClass);
}

/**
 * Si se cumple una condición, y si no, cómo se enseña.
 *
 * - `hidden`: no se enseña. Lo que depende de quién eres, del hilo o de lo ya dicho.
 * - `why`: se enseña apagada, con el porqué. Lo que se puede ganar: que os mire mejor,
 *   llevar algo, tener el oro.
 *
 * @param {DialogueCondition} condition
 * @param {any} hero
 * @param {DialogueWorld} world
 * @param {{speaker: string, chosen: string[]}} context
 * @returns {{ok: boolean, hidden: boolean, why: string, tag: string}}
 */
function checkCondition(condition, hero, world, { speaker, chosen }) {
    const hide = { ok: false, hidden: true, why: '', tag: '' };
    let tag = '';
    // Quién eres: si no encaja, ni se ve (J8.2).
    if (condition.species) {
        const race = kindStem(hero?.race);
        const match = condition.species.find(s => kindStem(s) === race);
        if (!race || !match) return hide;
        tag = tag || match;
    }
    if (condition.class) {
        const cls = kindStem(classOf(hero));
        const match = condition.class.find(c => kindStem(c) === cls);
        if (!cls || !match) return hide;
        tag = tag || match;
    }
    if (condition.background) {
        const bg = backgroundKey(hero?.background);
        const match = condition.background.find(b => backgroundKey(b) === bg);
        if (!bg || !match) return hide;
        tag = tag || backgroundTag(match);
    }
    if (condition.gender && genderOf(condition.gender) !== genderOf(hero?.gender)) return hide;
    // El hilo y lo ya dicho: tampoco se enseña lo que todavía no toca.
    if (condition.milestone) {
        const { id, is } = condition.milestone;
        const done = (world.done ?? []).includes(id);
        const open = (world.open ?? []).includes(id);
        const ok = is === 'open' ? open : is === 'not-done' ? !done : done;
        if (!ok) return hide;
    }
    if (condition.said && !chosen.includes(condition.said)) return hide;
    // J13.8: lo que hiciste en una escena del hilo.
    if (condition.chose && !condition.chose.some(id => (world.chose ?? []).includes(id))) return hide;
    const attitude = Math.round(Number(world.attitude) || 0);
    if (condition.attitude?.max !== undefined && attitude > condition.attitude.max) return hide;
    // Lo que se puede ganar: se ve, apagado, y dice cómo se abre.
    if (condition.attitude?.min !== undefined && attitude < condition.attitude.min) {
        return { ok: false, hidden: false, why: `Hace falta que ${speaker || 'quien habla'} os mire de forma ${describeAttitude(condition.attitude.min)}.`, tag };
    }
    if (condition.item && !(world.items ?? []).some(item => fold(item) === fold(condition.item))) {
        return { ok: false, hidden: false, why: `Hace falta llevar «${condition.item}».`, tag };
    }
    if (condition.gold !== undefined && (Number(world.gold) || 0) < condition.gold) {
        return { ok: false, hidden: false, why: `Hacen falta ${condition.gold} monedas.`, tag };
    }
    return { ok: true, hidden: false, why: '', tag };
}

/**
 * Si se cumple alguna de las formas. Sin formas, siempre.
 *
 * @param {DialogueCondition[]} when
 * @param {any} hero
 * @param {DialogueWorld} world
 * @param {{speaker: string, chosen: string[]}} context
 * @returns {{ok: boolean, hidden: boolean, why: string, tag: string}}
 */
function checkConditions(when, hero, world, context) {
    if (when.length === 0) return { ok: true, hidden: false, why: '', tag: '' };
    const results = when.map(condition => checkCondition(condition, hero, world, context));
    const passed = results.find(r => r.ok);
    if (passed) return passed;
    // Cerrada: se enseña si alguna forma se puede ganar; si todas dependen de quién eres, no.
    return results.find(r => !r.hidden) ?? results[0];
}

/**
 * La CD de una tirada con quien habla: quien os aprecia se deja convencer mejor.
 *
 * @param {DialogueCheck} check
 * @param {DialogueWorld} world
 * @returns {number}
 */
export function checkDc(check, world = {}) {
    const attitude = SOCIAL_SKILLS.includes(check.skill) ? Math.round(Number(world.attitude) || 0) : 0;
    return Math.max(DC_LIMITS.min, Math.min(DC_LIMITS.max, check.dc - attitude));
}

/**
 * El texto con el género de quien juega: «{listo|lista}».
 *
 * @param {string} said
 * @param {any} hero
 * @param {DialogueWorld} world
 * @returns {string}
 */
function voiced(said, hero, world) {
    return resolveGender(said, { heroe: hero, ...(Array.isArray(world.party) && world.party.length > 0 ? { grupo: world.party } : {}) });
}

/**
 * Si una charla se ofrece ahora: su `when` se cumple.
 *
 * @param {Dialogue} dialogue
 * @param {any} hero
 * @param {DialogueWorld} [world]
 * @returns {boolean}
 */
export function dialogueOffered(dialogue, hero, world = {}) {
    return checkConditions(dialogue.when, hero, world, { speaker: dialogue.speaker, chosen: [] }).ok;
}

/**
 * La charla que toca con alguien: la primera escrita para esa persona que se ofrece ahora.
 * Una persona puede tener varias a lo largo de la historia; manda el orden del paquete.
 *
 * @param {Dialogue[]} dialogues
 * @param {string} name
 * @param {any} hero
 * @param {DialogueWorld} [world]
 * @returns {Dialogue|null}
 */
export function dialogueFor(dialogues, name, hero, world = {}) {
    const who = fold(name);
    if (!who) return null;
    return (Array.isArray(dialogues) ? dialogues : [])
        .find(d => fold(d.speaker) === who && dialogueOffered(d, hero, world)) ?? null;
}

/**
 * Los hitos que cumple una charla (sus efectos `milestone`, en opciones, tiradas y nudos).
 * Con charla, el hito de «habla con Giles» se cumple cuando Giles lo cuenta, no al saludar:
 * quien abre la charla no manda el suceso `talk` para estos.
 *
 * @param {Dialogue} dialogue
 * @returns {string[]}
 */
export function dialogueMilestones(dialogue) {
    const ids = new Set();
    const note = (/** @type {DialogueEffect[]} */ effects) => {
        for (const effect of effects) if (effect.kind === 'milestone' && effect.id) ids.add(effect.id);
    };
    for (const node of dialogue?.nodes ?? []) {
        note(node.effects);
        for (const option of node.options) {
            note(option.effects);
            if (option.check) for (const branch of [option.check.success, option.check.partial, option.check.failure]) if (branch) note(branch.effects);
        }
    }
    return [...ids];
}

/**
 * Quiénes tienen una charla escrita (para ofrecerles «Hablar»).
 *
 * @param {Dialogue[]} dialogues
 * @returns {string[]}
 */
export function speakersWithDialogue(dialogues) {
    return [...new Set((Array.isArray(dialogues) ? dialogues : []).map(d => d.speaker).filter(Boolean))];
}

/**
 * @typedef {Object} DialogueMemoryEntry
 * @property {string[]} heard
 * @property {string[]} chosen
 * @property {Array<{who: string, text: string, day: number}>} learned
 */

/**
 * Lo que se recuerda de las charlas (J8.6), por su id: qué se oyó, qué se dijo y qué se
 * aprendió. Es lo que se guarda en la partida.
 *
 * @param {any} raw
 * @returns {Record<string, DialogueMemoryEntry>}
 */
export function readDialogueMemory(raw) {
    /** @type {Record<string, DialogueMemoryEntry>} */
    const out = {};
    for (const [id, entry] of Object.entries(isObject(raw) ? raw : {})) {
        if (!text(id) || !isObject(entry)) continue;
        out[text(id)] = {
            heard: listOf(entry.heard ?? []),
            chosen: listOf(entry.chosen ?? []),
            learned: (Array.isArray(entry.learned) ? entry.learned : [])
                .filter(l => isObject(l) && text(l.text))
                .map(l => ({ who: text(l.who), text: text(l.text), day: Math.max(0, Math.floor(Number(l.day) || 0)) })),
        };
    }
    return out;
}

/**
 * Apuntar algo para el Diario, una vez.
 *
 * @param {DialogueState} state
 * @param {string} said
 * @param {number} day
 * @param {Array<{who: string, text: string, day: number}>} [before] Lo aprendido otras veces.
 * @returns {Array<{who: string, text: string, day: number}>}
 */
function learn(state, said, day, before = []) {
    const clean = text(said);
    if (!clean || [...before, ...state.learned].some(l => fold(l.text) === fold(clean))) return state.learned;
    return [...state.learned, { who: state.dialogue.speaker, text: clean, day }];
}

/**
 * J13.8: lo que dice al volver otro día: la primera de sus frases con condición que se cumpla
 * («¿Has subido entera?» si vienes de la bodega) o una de las de siempre, distinta según el día
 * y lo que lleváis hablado.
 *
 * @param {DialogueNode} node
 * @param {DialogueState} state
 * @param {any} hero
 * @param {DialogueWorld} world
 * @returns {string}
 */
function againLine(node, state, hero, world) {
    const list = node.agains ?? (node.again ? [{ text: node.again, when: [] }] : []);
    const context = { speaker: state.dialogue.speaker, chosen: state.chosen };
    const fits = list.find(a => a.when.length > 0 && checkConditions(a.when, hero, world, context).ok);
    if (fits) return fits.text;
    const plain = list.filter(a => a.when.length === 0);
    if (plain.length === 0) return '';
    const day = Math.max(0, Math.floor(Number(world.day) || 0));
    return plain[(hashOf(state.dialogue.id) + day + state.chosen.length) % plain.length].text;
}

/**
 * Entrar en un nudo: lo que dice, con su gesto, y lo que se apunta.
 *
 * J13.8: volver al principio sin haberse ido (tras «Gracias», «Lo siento») no es volver otro
 * día. Ahí no sale `again` («¿Otra vez tú?»), sino lo que dice para seguir (`followUpLine`); y si
 * la opción ya traía su respuesta (`reply`), nada más: la respuesta basta.
 *
 * @param {DialogueState} state
 * @param {string} id
 * @param {any} hero
 * @param {DialogueWorld} world
 * @param {Array<{who: string, text: string, day: number}>} [before]
 * @param {{replied?: boolean}} [how] Si quien habla acaba de contestar a la opción.
 * @returns {DialogueState}
 */
function enter(state, id, hero, world, before = [], { replied = false } = {}) {
    const node = nodeOf(state.dialogue, id);
    if (!node) return { ...state, node: '', ended: true, pending: [] };
    const repeated = state.heard.includes(node.id);
    const here = state.here ?? [];
    // Un nudo al que se vuelve dentro de la misma charla: el principio, o uno con `more` escrito.
    const back = here.includes(node.id) && (node.id === state.dialogue.start || (node.more?.length ?? 0) > 0);
    const backs = state.backs ?? 0;
    const said = back
        ? (replied ? '' : followUpLine({ more: node.more ?? [], attitude: world.attitude, seed: state.dialogue.id, turn: backs, who: { heroe: hero } }))
        : (repeated ? againLine(node, state, hero, world) || node.line : node.line);
    const day = Math.max(0, Math.floor(Number(world.day) || 0));
    // Lo que hace el nudo, solo la primera vez: volver a oírlo no vuelve a cumplir el hito.
    const pending = repeated ? [] : resolveEffects(node.effects, state.dialogue.speaker, hero, world);
    let after = { ...state };
    if (node.journal) after = { ...after, learned: learn(after, voiced(node.journal, hero, world), day, before) };
    for (const clue of pending.filter(e => e.kind === 'clue')) after = { ...after, learned: learn(after, clue.text ?? '', day, before) };
    return {
        ...after,
        node: node.id,
        repeated,
        pending,
        heard: repeated ? state.heard : [...state.heard, node.id],
        log: said ? [...state.log, { kind: 'npc', who: state.dialogue.speaker, text: voiced(said, hero, world), mood: node.mood }] : state.log,
        here: here.includes(node.id) ? here : [...here, node.id],
        backs: back ? backs + 1 : backs,
        face: said ? node.mood : (state.face ?? node.mood),
    };
}

/**
 * Los efectos listos para aplicar: con quién es cada cosa (sin decirlo, quien habla) y las
 * pistas con el género puesto.
 *
 * @param {DialogueEffect[]} effects
 * @param {string} speaker
 * @param {any} hero
 * @param {DialogueWorld} world
 * @returns {DialogueEffect[]}
 */
function resolveEffects(effects, speaker, hero, world) {
    return effects.map(effect => {
        if ((effect.kind === 'attitude' || effect.kind === 'bond') && !effect.who) return { ...effect, who: speaker };
        if (effect.kind === 'clue') return { ...effect, text: voiced(effect.text ?? '', hero, world) };
        return effect;
    });
}

/**
 * Empezar una charla, desde su nudo de inicio. Con lo recordado de otras veces: lo ya dicho
 * no vuelve a salir y quien ya os lo contó lo resume.
 *
 * @param {Dialogue} dialogue
 * @param {Object} [input]
 * @param {any} [input.memory] Lo recordado de todas las charlas (`readDialogueMemory`).
 * @param {any} [input.hero]
 * @param {DialogueWorld} [input.world]
 * @returns {DialogueState}
 */
export function startDialogue(dialogue, { memory = null, hero = null, world = {} } = {}) {
    const past = readDialogueMemory(memory)[dialogue.id];
    /** @type {DialogueState} */
    const state = {
        dialogue,
        node: '',
        ended: false,
        repeated: false,
        pending: [],
        heard: past ? [...past.heard] : [],
        chosen: past ? [...past.chosen] : [],
        learned: [],
        log: [],
        here: [],
        backs: 0,
        face: '',
    };
    return enter(state, dialogue.start, hero, world, past?.learned ?? []);
}

/**
 * @typedef {Object} OptionView
 * @property {string} id
 * @property {string} text Con el género ya puesto.
 * @property {string} tag «Enano», «Soldado»…; vacío si no depende de quién eres.
 * @property {string} locked Vacío si se puede elegir; si no, por qué no.
 * @property {{skill: string, label: string, dc: number}|null} check
 * @property {boolean} ends Si acaba la charla.
 * @property {string} [warn] J11.1: «Esto no tiene vuelta atrás», si pesa; sin decir por qué.
 */

/**
 * Lo que puede decir quien juega ahora mismo.
 *
 * - Lo que depende de quién eres solo le sale a quien encaja (J8.2), con su etiqueta.
 * - Lo que se puede ganar sale apagado, con el porqué.
 * - Lo ya dicho no vuelve a salir (J8.6), salvo lo que se puede repetir («Me voy»).
 *
 * @param {DialogueState} state
 * @param {any} hero
 * @param {DialogueWorld} [world]
 * @returns {OptionView[]}
 */
export function optionsFor(state, hero, world = {}) {
    if (state.ended) return [];
    const node = nodeOf(state.dialogue, state.node);
    if (!node) return [];
    /** @type {OptionView[]} */
    const out = [];
    for (const option of node.options) {
        if (!option.repeat && state.chosen.includes(option.id)) continue;
        const found = checkConditions(option.when, hero, world, { speaker: state.dialogue.speaker, chosen: state.chosen });
        if (!found.ok && (found.hidden || option.hidden)) continue;
        const tag = option.tag === null ? found.tag : option.tag;
        // J11.1: lo que pesa se avisa antes de elegirlo, sin decir qué se pierde.
        const warn = optionNoReturn(option, { weighty: world.weighty });
        out.push({
            id: option.id,
            text: voiced(option.text, hero, world),
            tag: voiced(tag, hero, world),
            locked: found.ok ? '' : found.why,
            check: option.check ? {
                skill: option.check.skill,
                label: SKILLS[/** @type {keyof typeof SKILLS} */ (option.check.skill)]?.label ?? option.check.skill,
                dc: checkDc(option.check, world),
            } : null,
            ends: option.end,
            ...(warn ? { warn } : {}),
        });
    }
    return out;
}

/**
 * @typedef {Object} DialogueView
 * @property {string} speaker
 * @property {string} mood
 * @property {string} line Lo último que ha dicho, con el género puesto.
 * @property {OptionView[]} options
 * @property {boolean} ended
 * @property {boolean} final Si el nudo no tiene opciones: lo dicho cierra la charla.
 */

/**
 * Todo lo que se pinta de una charla: quién habla, con qué cara, qué dice y qué se puede
 * contestar.
 *
 * @param {DialogueState} state
 * @param {any} hero
 * @param {DialogueWorld} [world]
 * @returns {DialogueView}
 */
export function dialogueView(state, hero, world = {}) {
    const node = nodeOf(state.dialogue, state.node);
    const last = [...state.log].reverse().find(entry => entry.kind === 'npc');
    return {
        speaker: state.dialogue.speaker,
        // J13.8: con la cara de lo último que dijo (una respuesta trae la suya).
        mood: state.face || node?.mood || last?.mood || 'neutral',
        line: last?.text ?? '',
        options: optionsFor(state, hero, world),
        ended: state.ended,
        final: !state.ended && Boolean(node) && (node?.options.length ?? 0) === 0,
    };
}

/**
 * Lo que cuesta sacar una tirada a medias sin rama escrita: lo de `consequences.js` para esa
 * habilidad, en efectos de charla. Persuadir o engañar a medias se lleva un rato; intimidar,
 * que os mire peor.
 *
 * @param {string} skill
 * @returns {DialogueEffect[]}
 */
export function partialCost(skill) {
    const can = { pista: false, rumor: false, oro: false, comida: false, mirada: true, sabe: false, busca: false };
    /** @type {DialogueEffect[]} */
    const out = [];
    for (const effect of consequence({ skill, outcome: 'medias', can })) {
        if (effect.kind === 'hora') out.push({ kind: 'time' });
        else if (effect.kind === 'mirada') out.push({ kind: 'attitude', amount: Math.sign(Number(effect.amount) || 0) });
    }
    return out;
}

/**
 * @typedef {Object} ChoiceResult
 * @property {boolean} ok
 * @property {string} reason Si no se pudo, por qué.
 * @property {DialogueState} state
 * @property {string} said Lo que ha dicho quien juega.
 * @property {ReturnType<typeof rollCheck>} roll La tirada, si la hubo.
 * @property {'bien'|'medias'|'mal'|null} outcome
 * @property {DialogueEffect[]} effects Lo que hay que aplicar, con `who` ya puesto.
 * @property {boolean} ended
 * @property {DialogueView|null} view Lo que se ve después.
 */

/**
 * Elegir una opción: lo que dice quien juega, la tirada si la hay, adónde lleva y qué hace.
 *
 * @param {DialogueState} state
 * @param {string} optionId
 * @param {Object} [input]
 * @param {any} [input.hero] Quien habla: su ficha tira y su género concuerda.
 * @param {DialogueWorld} [input.world]
 * @param {() => number} [input.rollD20]
 * @param {any} [input.memory] Lo recordado de otras charlas, para no apuntar dos veces lo mismo.
 * @returns {ChoiceResult}
 */
export function choose(state, optionId, { hero = null, world = {}, rollD20 = () => 10, memory = null } = {}) {
    const refuse = (/** @type {string} */ reason) => ({ ok: false, reason, state, said: '', roll: null, outcome: null, effects: [], ended: state.ended, view: null });
    if (state.ended) return refuse('La charla ya ha acabado.');
    const node = nodeOf(state.dialogue, state.node);
    const option = node?.options.find(o => o.id === optionId);
    if (!node || !option) return refuse('Esa opción no está aquí.');
    const shown = optionsFor(state, hero, world).find(o => o.id === optionId);
    if (!shown) return refuse('Esa opción ya no se puede elegir.');
    if (shown.locked) return refuse(shown.locked);

    const before = readDialogueMemory(memory)[state.dialogue.id]?.learned ?? [];
    const day = Math.max(0, Math.floor(Number(world.day) || 0));
    let effects = [...option.effects];
    let next = option.next;
    let end = option.end;
    let journal = option.journal;
    /** @type {ReturnType<typeof rollCheck>} */
    let roll = null;
    /** @type {'bien'|'medias'|'mal'|null} */
    let outcome = null;
    /** @type {DialogueState['log']} */
    const log = [...state.log, { kind: 'hero', who: text(hero?.name), text: shown.text }];

    if (option.check) {
        // Las reglas de siempre: el d20 de `rollCheck` y los tres resultados de `consequences.js`.
        roll = rollCheck({ member: hero ?? { name: 'Alguien' }, skill: option.check.skill, rollD20, dc: checkDc(option.check, world) });
        if (roll) {
            outcome = outcomeOf(roll);
            const branch = outcome === 'bien' ? option.check.success
                : outcome === 'medias' ? (option.check.partial ?? option.check.success)
                    : option.check.failure;
            effects = [...effects, ...branch.effects, ...(outcome === 'medias' && !option.check.partial ? partialCost(option.check.skill) : [])];
            next = branch.next || next;
            end = end || branch.end;
            journal = branch.journal || journal;
            const said = outcome === 'medias' ? roll.said.replace(/ ✗ Fallo\b/, ' ✗ A medias') : roll.said;
            log.push({ kind: 'roll', who: text(hero?.name), text: said });
        }
    }

    // Con quién es cada cosa: sin decirlo, con quien habla.
    const resolved = resolveEffects(effects, state.dialogue.speaker, hero, world);

    // J13.8: lo que contesta al momento, con su gesto (o el del nudo).
    const reply = option.reply ?? null;
    if (reply) log.push({ kind: 'npc', who: state.dialogue.speaker, text: voiced(reply.text, hero, world), mood: reply.mood || node.mood });

    /** @type {DialogueState} */
    let after = {
        ...state, log, pending: [], chosen: state.chosen.includes(option.id) ? state.chosen : [...state.chosen, option.id],
        ...(reply ? { face: reply.mood || node.mood } : {}),
    };
    if (journal) after = { ...after, learned: learn(after, voiced(journal, hero, world), day, before) };
    for (const clue of resolved.filter(e => e.kind === 'clue')) after = { ...after, learned: learn(after, clue.text ?? '', day, before) };

    if (end) after = { ...after, node: '', ended: true };
    else if (next) after = enter(after, next, hero, world, before, { replied: Boolean(reply) });

    return {
        ok: true,
        reason: '',
        state: after,
        said: shown.text,
        roll,
        outcome,
        // Lo de la opción (y su tirada) y, detrás, lo del nudo al que lleva.
        effects: [...resolved, ...after.pending],
        ended: after.ended,
        view: after.ended ? null : dialogueView(after, hero, world),
    };
}

/**
 * Guardar lo de una charla en lo recordado (J8.6): lo oído, lo dicho y lo aprendido.
 *
 * @param {any} memory
 * @param {DialogueState} state
 * @returns {Record<string, DialogueMemoryEntry>}
 */
export function rememberDialogue(memory, state) {
    const all = readDialogueMemory(memory);
    const past = all[state.dialogue.id] ?? { heard: [], chosen: [], learned: [] };
    const learned = [...past.learned];
    for (const line of state.learned) {
        if (!learned.some(l => fold(l.text) === fold(line.text))) learned.push(line);
    }
    return {
        ...all,
        [state.dialogue.id]: {
            heard: [...new Set([...past.heard, ...state.heard])],
            chosen: [...new Set([...past.chosen, ...state.chosen])],
            learned,
        },
    };
}

/**
 * Lo que os han contado, para el Diario: «Brunilda: …», en el orden en que se supo.
 *
 * @param {any} memory
 * @returns {string[]}
 */
export function dialogueJournal(memory) {
    return Object.values(readDialogueMemory(memory))
        .flatMap(entry => entry.learned)
        .sort((a, b) => a.day - b.day)
        .map(line => (line.who ? `${line.who}: ${line.text}` : line.text));
}

/**
 * Un efecto en llano, para decirlo en la ventana: «Brunilda os mira mejor», «+5 de oro».
 *
 * @param {DialogueEffect} effect
 * @returns {string}
 */
export function describeDialogueEffect(effect) {
    const n = Number(effect.amount) || 0;
    switch (effect.kind) {
        case 'attitude': return n > 0 ? `${effect.who} os mira mejor.` : n < 0 ? `${effect.who} os mira peor.` : '';
        case 'bond': return n > 0 ? `Tu vínculo con ${effect.who} crece.` : n < 0 ? `Tu vínculo con ${effect.who} se resiente.` : '';
        case 'gold': return n > 0 ? `+${n} de oro.` : n < 0 ? `−${-n} de oro.` : '';
        case 'give': return `Recibes: ${effect.item}.`;
        case 'take': return `Entregas: ${effect.item}.`;
        case 'clue': return `Apuntado en el Diario: ${effect.text}`;
        case 'rumor': return 'Os cuenta algo que se dice por aquí.';
        case 'milestone': return '';
        case 'time': return 'Se os va un rato.';
        default: return '';
    }
}

/**
 * @typedef {Object} DialogueIssue
 * @property {string} path
 * @property {string} message
 */

/**
 * Lo que está mal escrito en las charlas de un paquete, con lo que el paquete trae para
 * comprobar los nombres. Lo que ningún esquema ve: a qué nudo lleva cada opción, qué nudos no
 * se alcanzan nunca, y si la persona, el hito, el rumor o el objeto existen.
 *
 * - **errores**: una charla sin nadie que hable, una opción que lleva a un nudo que no
 *   existe, una tirada sin habilidad conocida, un hito o un rumor que el paquete no tiene.
 * - **avisos**: un nudo al que no se llega, un gesto que no se conoce (sale neutral), un
 *   objeto que el paquete no trae (puede ser del compendio), una condición que no se entiende.
 *
 * @param {any} raw La lista `dialogues` del paquete, tal cual.
 * @param {Object} [refs]
 * @param {string[]} [refs.people] Quién puede hablar: la gente y los compañeros.
 * @param {string[]|null} [refs.milestones] Los ids de los hitos; null si el paquete no tiene hilo.
 * @param {string[]} [refs.rumors] Los ids de los rumores.
 * @param {string[]} [refs.items] Los nombres de los objetos.
 * @returns {{errors: DialogueIssue[], warnings: DialogueIssue[]}}
 */
export function checkDialogues(raw, { people = [], milestones = null, rumors = [], items = [] } = {}) {
    /** @type {DialogueIssue[]} */
    const errors = [];
    /** @type {DialogueIssue[]} */
    const warnings = [];
    if (raw === undefined || raw === null) return { errors, warnings };
    if (!Array.isArray(raw)) {
        errors.push({ path: 'dialogues', message: '`dialogues` es una lista de charlas.' });
        return { errors, warnings };
    }
    const who = new Set(people.map(fold).filter(Boolean));
    const milestoneIds = milestones ? new Set(milestones.map(text)) : null;
    const rumorIds = new Set(rumors.map(text));
    const itemNames = new Set(items.map(fold));
    const seenIds = new Set();

    /** Un texto con las marcas de género bien cerradas. @param {string} value @param {string} path */
    const markers = (value, path) => {
        const bad = leftoverMarkers(value);
        if (bad.length > 0) errors.push({ path, message: `Marca de género mal escrita: ${bad[0]}. Se escribe {forma|forma}.` });
    };

    /** @param {any} condition @param {string} path */
    const validateCondition = (condition, path) => {
        if (!isObject(condition)) {
            errors.push({ path, message: 'Una condición es un objeto, o una lista de objetos (basta con que se cumpla uno).' });
            return;
        }
        for (const key of Object.keys(condition)) {
            if (!CONDITION_KEYS.includes(key)) {
                warnings.push({ path: `${path}.${key}`, message: `"${key}" no es una condición: se ignora. Las que hay: ${CONDITION_KEYS.join(', ')}.` });
            }
        }
        if (condition.attitude !== undefined) {
            const range = isObject(condition.attitude) ? condition.attitude : { min: condition.attitude };
            for (const bound of ['min', 'max']) {
                if (range[bound] === undefined) continue;
                const n = Number(range[bound]);
                if (!Number.isInteger(n) || n < ATTITUDE.min || n > ATTITUDE.max) {
                    errors.push({ path: `${path}.attitude`, message: `La actitud va de ${ATTITUDE.min} a ${ATTITUDE.max}, en enteros.` });
                }
            }
        }
        if (condition.milestone !== undefined) {
            const milestone = isObject(condition.milestone) ? condition.milestone : { id: condition.milestone };
            if (milestone.is !== undefined && !MILESTONE_STATES.includes(text(milestone.is))) {
                errors.push({ path: `${path}.milestone.is`, message: `"${text(milestone.is)}" no es un estado de hito. Los que hay: ${MILESTONE_STATES.join(', ')}.` });
            }
            checkMilestone(text(milestone.id), `${path}.milestone`);
        }
        if (condition.item !== undefined) checkItem(text(condition.item), `${path}.item`);
        if (condition.gold !== undefined && !(Number(condition.gold) > 0)) {
            errors.push({ path: `${path}.gold`, message: '`gold` es lo que hace falta llevar: un número mayor que cero.' });
        }
    };

    /** @param {string} id @param {string} path */
    const checkMilestone = (id, path) => {
        if (!id) errors.push({ path, message: 'Falta el id del hito.' });
        else if (!milestoneIds) errors.push({ path, message: `El paquete no tiene hilo (\`plot\`): no hay hito "${id}".` });
        else if (!milestoneIds.has(id)) errors.push({ path, message: `El hito "${id}" no existe en el hilo.` });
    };

    /** @param {string} name @param {string} path */
    const checkItem = (name, path) => {
        if (!name) errors.push({ path, message: 'Falta el nombre del objeto.' });
        else if (!itemNames.has(fold(name))) warnings.push({ path, message: `"${name}" no está en \`items\`: si no es un objeto del compendio, nunca se tendrá.` });
    };

    /** @param {any} list @param {string} path */
    const checkEffects = (list, path) => {
        if (list === undefined) return;
        (Array.isArray(list) ? list : [list]).forEach((raw, i) => {
            const effect = readEffect(raw);
            const where = `${path}[${i}]`;
            switch (effect.kind) {
                case 'unknown':
                    errors.push({ path: where, message: `Efecto que no se entiende. Los que hay: ${EFFECT_KINDS.join(', ')}.` });
                    break;
                case 'attitude':
                case 'bond':
                case 'gold':
                    if (!effect.amount) errors.push({ path: where, message: `\`${effect.kind}\` necesita un número distinto de cero.` });
                    if (effect.who && !who.has(fold(effect.who))) errors.push({ path: `${where}.who`, message: `"${effect.who}" no está entre la gente ni los compañeros del paquete.` });
                    break;
                case 'clue':
                    if (!effect.text) errors.push({ path: where, message: 'Una pista necesita su texto.' });
                    else markers(effect.text, where);
                    break;
                case 'rumor':
                    if (!rumorIds.has(effect.id ?? '')) errors.push({ path: where, message: `El rumor "${effect.id}" no está en \`rumors\`.` });
                    break;
                case 'milestone':
                    checkMilestone(effect.id ?? '', where);
                    break;
                case 'give':
                case 'take':
                    checkItem(effect.item ?? '', where);
                    break;
                default:
                    break;
            }
        });
    };

    raw.forEach((dialogue, index) => {
        const path = `dialogues[${index}]`;
        if (!isObject(dialogue)) {
            errors.push({ path, message: 'Una charla es un objeto con `id`, `speaker` y `nodes`.' });
            return;
        }
        const id = text(dialogue.id);
        if (!id) errors.push({ path: `${path}.id`, message: 'La charla necesita un `id`: es lo que la partida recuerda.' });
        else if (seenIds.has(id)) errors.push({ path: `${path}.id`, message: `El id "${id}" está repetido: la partida confundiría las dos charlas.` });
        seenIds.add(id);
        const speaker = text(dialogue.speaker);
        if (!speaker) errors.push({ path: `${path}.speaker`, message: 'Falta quién habla (`speaker`).' });
        else if (!who.has(fold(speaker))) errors.push({ path: `${path}.speaker`, message: `"${speaker}" no está entre la gente (\`npcs\`) ni los compañeros (\`confidants\`) del paquete.` });
        if (dialogue.when !== undefined) (Array.isArray(dialogue.when) ? dialogue.when : [dialogue.when]).forEach((c, i) => validateCondition(c, Array.isArray(dialogue.when) ? `${path}.when[${i}]` : `${path}.when`));

        const nodes = Array.isArray(dialogue.nodes) ? dialogue.nodes : [];
        if (nodes.length === 0) {
            errors.push({ path: `${path}.nodes`, message: 'Una charla sin nudos no dice nada.' });
            return;
        }
        /** @type {Map<string, number>} */
        const nodeIds = new Map();
        nodes.forEach((node, n) => {
            const nodeId = text(node?.id);
            if (!nodeId) errors.push({ path: `${path}.nodes[${n}].id`, message: 'Cada nudo necesita su `id`: es adonde llevan las opciones.' });
            else if (nodeIds.has(nodeId)) errors.push({ path: `${path}.nodes[${n}].id`, message: `El nudo "${nodeId}" está repetido.` });
            else nodeIds.set(nodeId, n);
        });
        const start = text(dialogue.start) || text(nodes[0]?.id);
        if (text(dialogue.start) && !nodeIds.has(start)) errors.push({ path: `${path}.start`, message: `El nudo de inicio "${start}" no existe.` });

        /** @type {Map<string, string[]>} Adónde lleva cada nudo. */
        const links = new Map();
        /** @param {string} target @param {string} where @param {string} from */
        const link = (target, where, from) => {
            if (!target) return;
            if (!nodeIds.has(target)) errors.push({ path: where, message: `Lleva al nudo "${target}", que no existe.` });
            else links.set(from, [...(links.get(from) ?? []), target]);
        };

        nodes.forEach((node, n) => {
            if (!isObject(node)) return;
            const nodePath = `${path}.nodes[${n}]`;
            const nodeId = text(node.id);
            if (!text(node.line)) errors.push({ path: `${nodePath}.line`, message: 'Falta lo que dice quien habla (`line`).' });
            markers(text(node.line), `${nodePath}.line`);
            // J13.8: `again` puede ser una lista, con condición en cada frase; y `more`, lo de seguir.
            if (Array.isArray(node.again)) {
                node.again.forEach((/** @type {any} */ entry, i) => {
                    const where = `${nodePath}.again[${i}]`;
                    if (typeof entry === 'string') {
                        markers(entry, where);
                    } else if (!isObject(entry) || !text(entry.text)) {
                        errors.push({ path: where, message: 'Cada frase de `again` es un texto, o `{"if": {…}, "text": "…"}`.' });
                    } else {
                        markers(text(entry.text), `${where}.text`);
                        if (entry.if !== undefined) (Array.isArray(entry.if) ? entry.if : [entry.if]).forEach((/** @type {any} */ c, k) => validateCondition(c, Array.isArray(entry.if) ? `${where}.if[${k}]` : `${where}.if`));
                    }
                });
            } else markers(text(node.again), `${nodePath}.again`);
            listOf(node.more).forEach((said, i) => markers(said, `${nodePath}.more[${i}]`));
            markers(text(node.journal), `${nodePath}.journal`);
            checkEffects(node.effects, `${nodePath}.effects`);
            if (node.mood !== undefined && !MOODS.includes(fold(node.mood))) {
                warnings.push({ path: `${nodePath}.mood`, message: `"${text(node.mood)}" no es un gesto: se verá neutral. Los que hay: ${MOODS.join(', ')}.` });
            }
            const optionIds = new Set();
            (Array.isArray(node.options) ? node.options : []).forEach((/** @type {any} */ option, o) => {
                const optionPath = `${nodePath}.options[${o}]`;
                if (!isObject(option)) {
                    errors.push({ path: optionPath, message: 'Una opción es un objeto con `text`.' });
                    return;
                }
                if (!text(option.text)) errors.push({ path: `${optionPath}.text`, message: 'Falta lo que dice quien juega (`text`).' });
                markers(text(option.text), `${optionPath}.text`);
                markers(text(option.journal), `${optionPath}.journal`);
                if (option.reply !== undefined) {
                    if (!readReply(option.reply)) errors.push({ path: `${optionPath}.reply`, message: 'La respuesta es un texto, o `{"text": "…", "mood": "…"}`.' });
                    else markers(readReply(option.reply)?.text ?? '', `${optionPath}.reply`);
                }
                const read = readOption(option, nodeId, o);
                if (optionIds.has(read.id)) errors.push({ path: `${optionPath}.id`, message: `La opción "${read.id}" está repetida en este nudo: lo ya dicho se recuerda por su id.` });
                optionIds.add(read.id);
                if (option.if !== undefined) (Array.isArray(option.if) ? option.if : [option.if]).forEach((c, i) => validateCondition(c, Array.isArray(option.if) ? `${optionPath}.if[${i}]` : `${optionPath}.if`));
                checkEffects(option.effects, `${optionPath}.effects`);
                link(text(option.next), `${optionPath}.next`, nodeId);
                if (option.check !== undefined) {
                    const check = isObject(option.check) ? option.check : {};
                    const checkPath = `${optionPath}.check`;
                    if (!SKILLS[/** @type {keyof typeof SKILLS} */ (text(check.skill))]) {
                        errors.push({ path: `${checkPath}.skill`, message: `"${text(check.skill)}" no es una habilidad de las tiradas. Las que hay: ${Object.keys(SKILLS).join(', ')}.` });
                    }
                    if (check.dc !== undefined && (!Number.isInteger(Number(check.dc)) || Number(check.dc) < DC_LIMITS.min || Number(check.dc) > DC_LIMITS.max)) {
                        errors.push({ path: `${checkPath}.dc`, message: `La CD va de ${DC_LIMITS.min} a ${DC_LIMITS.max}; ${DEFAULT_DC} es un intento normal.` });
                    }
                    for (const outcome of ['success', 'partial', 'failure']) {
                        const branch = check[outcome];
                        if (branch === undefined) {
                            if (outcome !== 'partial') errors.push({ path: `${checkPath}.${outcome}`, message: `Falta qué pasa si sale ${outcome === 'success' ? 'bien' : 'mal'}.` });
                            continue;
                        }
                        const target = typeof branch === 'string' ? text(branch) : text(branch?.next);
                        link(target, `${checkPath}.${outcome}${typeof branch === 'string' ? '' : '.next'}`, nodeId);
                        if (isObject(branch)) {
                            checkEffects(branch.effects, `${checkPath}.${outcome}.effects`);
                            markers(text(branch.journal), `${checkPath}.${outcome}.journal`);
                        }
                    }
                }
            });
        });

        // Lo que ningún esquema ve: los nudos a los que no se llega desde el inicio.
        if (!nodeIds.has(start)) return;
        const reached = new Set([start]);
        const queue = [start];
        while (queue.length > 0) {
            const at = /** @type {string} */ (queue.shift());
            for (const next of links.get(at) ?? []) {
                if (!reached.has(next)) {
                    reached.add(next);
                    queue.push(next);
                }
            }
        }
        for (const [nodeId, n] of nodeIds) {
            if (!reached.has(nodeId)) {
                warnings.push({ path: `${path}.nodes[${n}]`, message: `Al nudo "${nodeId}" no se llega desde "${start}": nunca se dirá.` });
            }
        }
    });
    return { errors, warnings };
}
