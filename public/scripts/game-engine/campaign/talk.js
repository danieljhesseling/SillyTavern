/**
 * Hablar sin modelo (Z2 de wiki/ROADMAP_SIN_TOKENS.md).
 *
 * Hablar es lo más de rol, y era el único sitio donde, sin modelo, no había juego: «Hablar
 * con Giles» dejaba una frase en la caja y nada más. Los personajes de un mundo escrito
 * traen qué quieren, qué saben y cómo hablan, pero eso solo lo leía el modelo.
 *
 * Aquí se decide **de qué se puede hablar** con alguien y **qué contesta**, con lo que el
 * motor ya sabe:
 *
 * - lo que te trae (si el hilo pasa por esa persona);
 * - lo que sabe, que solo lo cuenta a quien no mira mal: con una ronda, un duelo o una buena
 *   tirada se gana;
 * - lo que busca, que siempre se ve: es de lo que salen los favores;
 * - lo que se cuenta (sus rumores), el caso si lo hay, y qué piensa de vosotros.
 *
 * Qué se dice es una frase del banco (`frases.json`, momentos `charla-*`), con la actitud
 * como condición: el mismo dato, dicho por quien os aprecia o por quien no os soporta. El
 * modelo, si lo hay, pone la voz; lo que se revela lo decide siempre el motor.
 *
 * Puro.
 */

/**
 * @typedef {Object} Talker
 * @property {string} name
 * @property {string} [trade]
 * @property {string} [wants]
 * @property {string} [knows]
 * @property {string} [voice]
 */

/**
 * @typedef {Object} TalkTopic
 * @property {string} id
 * @property {string} label
 * @property {string} icon
 */

/**
 * @param {any} value
 * @returns {string}
 */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * @param {string} value
 * @returns {string}
 */
function lowerFirst(value) {
    const clean = text(value);
    return clean ? clean[0].toLocaleLowerCase('es') + clean.slice(1) : '';
}

/**
 * Cómo os mira, en tres: «buena» (cordial o más), «neutra» o «mala» (fría o menos).
 *
 * @param {number} value La actitud, de −3 a 3.
 * @returns {'buena'|'neutra'|'mala'}
 */
export function attitudeBand(value) {
    const n = Number(value) || 0;
    if (n >= 1) return 'buena';
    if (n < 0) return 'mala';
    return 'neutra';
}

/**
 * De qué se puede hablar con alguien.
 *
 * Lo que alguien sabe, lo que busca y lo que piensa de vosotros **no se da de primeras**
 * (Daniel, 2026-09-28: «es demasiado fácil, son cosas que se deberían de desbloquear con
 * tiradas y con relación»). Se enseñan, pero cerrados y diciendo cómo se abren:
 * - **Qué sabe**: a quien os aprecia (cordial o más). O amenazándole, que se paga.
 * - **Qué busca** y **qué piensa de vosotros**: a quien os aprecia, o si se le ha calado
 *   (sonsacarle con Perspicacia).
 *
 * Y quien os planta cara no está para charlas: ni rumores ni el caso.
 *
 * @param {Object} input
 * @param {Talker} input.npc
 * @param {{title?: string, hint?: string}|null} [input.milestone] El hito que pide hablar con él.
 * @param {boolean} [input.hasRumor] Si tiene algo que contar que no hayáis oído.
 * @param {boolean} [input.hasCase] Si hay un caso abierto en el que pinta algo.
 * @param {number} [input.attitude] Cómo os mira, de −3 a 3.
 * @param {boolean} [input.read] Si se le ha calado (sonsacado con éxito).
 * @param {boolean} [input.confronting] Si os está plantando cara ahora mismo.
 * @returns {Array<TalkTopic & {locked?: string}>}
 */
export function talkTopics({ npc, milestone = null, hasRumor = false, hasCase = false, attitude = 0, read = false, confronting = false }) {
    const liked = attitudeBand(attitude) === 'buena';
    const unread = 'Hay que calarle antes: sonsácale (Perspicacia).';
    /** @type {Array<TalkTopic & {locked?: string}>} */
    const topics = [];
    if (milestone) topics.push({ id: 'hilo', label: 'Lo que te trae aquí', icon: 'fa-compass' });
    if (text(npc?.knows)) {
        topics.push({ id: 'sabe', label: 'Qué sabe', icon: 'fa-eye',
            ...(liked ? {} : { locked: 'Solo se lo cuenta a quien aprecia: gánatelo (convencerle, una ronda) o amenázale.' }) });
    }
    if (text(npc?.wants)) topics.push({ id: 'quiere', label: 'Qué busca', icon: 'fa-hand-holding-heart', ...(liked || read ? {} : { locked: unread }) });
    if (hasRumor && !confronting) topics.push({ id: 'rumor', label: 'Qué se cuenta', icon: 'fa-ear-listen' });
    if (hasCase && !confronting) topics.push({ id: 'caso', label: 'El caso', icon: 'fa-magnifying-glass' });
    topics.push({ id: 'vosotros', label: 'Qué piensa de vosotros', icon: 'fa-people-group', ...(liked || read ? {} : { locked: unread }) });
    return topics;
}

/**
 * Cómo os mira de verdad ahora: quien os planta cara (el alguacil que revienta la puerta) no
 * os mira neutral, os mire como os mire el resto del tiempo. Como mucho, receloso.
 *
 * @param {number} stored La actitud apuntada, de −3 a 3.
 * @param {boolean} confronting
 * @returns {number}
 */
export function effectiveAttitude(stored, confronting) {
    const value = Number(stored) || 0;
    return confronting ? Math.min(value, -2) : value;
}

/**
 * Qué momento del banco contesta a un tema, y con qué hechos.
 *
 * `rumor` y `caso` no salen de aquí: los cuenta el motor con lo suyo (el rumor, las pistas).
 *
 * @param {Object} input
 * @param {Talker} input.npc
 * @param {string} input.topic
 * @param {number} [input.attitude]
 * @param {string} [input.attitudeWord] Cómo os mira, en palabras (fría, cordial…).
 * @param {{title?: string, hint?: string}|null} [input.milestone]
 * @returns {{moment: string, facts: Record<string, any>, reveals: boolean}|null}
 */
export function topicAnswer({ npc, topic, attitude = 0, attitudeWord = '', milestone = null }) {
    const band = attitudeBand(attitude);
    const base = { quien: text(npc?.name), actitud: band, actitud_texto: text(attitudeWord) };
    switch (topic) {
        case 'hilo':
            return milestone ? { moment: 'charla-hilo', facts: { ...base, pista: text(milestone.hint) || text(milestone.title) }, reveals: false } : null;
        case 'sabe':
            if (!text(npc?.knows)) return null;
            // Lo que sabe solo se lo cuenta a quien no le mira mal.
            return band === 'mala'
                ? { moment: 'charla-no', facts: base, reveals: false }
                : { moment: 'charla-sabe', facts: { ...base, sabe: lowerFirst(npc.knows) }, reveals: true };
        case 'quiere':
            return text(npc?.wants) ? { moment: 'charla-quiere', facts: { ...base, quiere: lowerFirst(npc.wants) }, reveals: false } : null;
        case 'vosotros':
            return { moment: 'charla-vosotros', facts: base, reveals: false };
        default:
            return null;
    }
}

/**
 * Amenazar: con una tirada de Intimidación buena, se lo saca aunque no os quiera; siempre os
 * lo tendrá en cuenta.
 *
 * @param {Object} input
 * @param {Talker} input.npc
 * @param {boolean} input.success
 * @returns {{moment: string, facts: Record<string, any>, reveals: boolean}}
 */
export function threatAnswer({ npc, success }) {
    const knows = lowerFirst(npc?.knows);
    return success && knows
        ? { moment: 'charla-amenaza-bien', facts: { quien: text(npc?.name), sabe: knows }, reveals: true }
        : { moment: 'charla-amenaza-mal', facts: { quien: text(npc?.name) }, reveals: false };
}

/**
 * Con modelo: a quién le está hablando quien juega, para que conteste esa persona y no el
 * narrador. Sin esto, «¿cómo te llamas?» dicho al tabernero lo contestaba el narrador
 * contando otra cosa de la escena.
 *
 * No lleva lo que sabe ni lo que esconde: eso lo suelta el motor (Z2), no el modelo.
 *
 * @param {Object} input
 * @param {string} input.name
 * @param {string} [input.trade]
 * @param {string} [input.voice]
 * @param {string} [input.attitudeWord] Cómo os mira, en palabras.
 * @param {boolean} [input.companion] Si es de tu grupo.
 * @param {boolean} [input.confronting] Si os está plantando cara ahora mismo.
 * @returns {string}
 */
export function talkPromptNote({ name, trade = '', voice = '', attitudeWord = '', companion = false, confronting = false }) {
    const who = text(name);
    if (!who) return '';
    const what = companion ? ', de tu grupo' : text(trade) ? ` (${lowerFirst(trade)})` : '';
    const how = text(voice) ? ` Habla así: ${lowerFirst(voice).replace(/\.$/, '')}.` : '';
    const mood = text(attitudeWord) ? ` Os mira de forma ${text(attitudeWord)}.` : '';
    const face = confronting ? ` ${who} os está plantando cara ahora mismo: habla como quien viene a por vosotros.` : '';
    // Una persona en una conversación contesta corto (Daniel, 2026-09-28: la respuesta de
    // Torres traía un párrafo de narración delante y el presagio en su boca).
    return `[CONVERSACIÓN] Quien juega le está hablando a ${who}${what}. Ahora no narras: contesta ${who}, en primera persona, `
        + `con una o dos frases de lo que dice, entre rayas.${how}${mood}${face} Sin párrafos describiendo la escena ni lo que hacen otros: `
        + `como mucho, un gesto en pocas palabras. No menciones presagios ni nada que ${who} no sabría.`;
}

/**
 * @param {string} value
 * @returns {string}
 */
function fold(value) {
    return text(value).toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Palabras de un nombre que no bastan para saber de quién se habla. */
const TITLES = new Set(['lord', 'fray', 'don', 'dona', 'senor', 'senora', 'padre', 'madre', 'hermano', 'hermana', 'maese', 'sir']);

/**
 * Si lo escrito nombra a alguien: su nombre entero, o una palabra suya que no sea un título.
 *
 * @param {string} said Ya plegado.
 * @param {string} name
 * @returns {boolean}
 */
function names(said, name) {
    const whole = fold(name);
    if (!whole) return false;
    const word = (/** @type {string} */ w) => new RegExp(`(^|[^a-z0-9ñ])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9ñ]|$)`).test(said);
    if (word(whole)) return true;
    return whole.split(/[^a-z0-9ñ]+/).some(w => w.length >= 4 && !TITLES.has(w) && word(w));
}

/**
 * A quién le habla quien juega cuando escribe en la caja sin decir «hablo con» (Daniel,
 * 2026-09-28: con el alguacil reventando la puerta, «¿qué pasa?» lo contestaba el narrador).
 *
 * - A quien nombra, si está aquí (de este sitio o del grupo).
 * - Si no nombra a nadie, a quien tiene delante: alguien de aquí que está en el tablero
 *   plantándole cara (el alguacil Torres, entre los que esperan en la posada).
 * - Si no, a nadie: contesta el narrador, contando qué pasa.
 *
 * @param {Object} input
 * @param {string} input.said Lo que ha escrito.
 * @param {string[]} [input.people] La gente de este sitio.
 * @param {string[]} [input.companions] Los del grupo, sin quien juega.
 * @param {string[]} [input.waiting] Quién espera en el tablero sin pelear todavía.
 * @returns {string} Su nombre, o '' si nadie.
 */
export function sceneAddressee({ said, people = [], companions = [], waiting = [] }) {
    const folded = fold(said);
    if (!folded) return '';
    const named = [...people, ...companions].filter(name => names(folded, name))
        .sort((a, b) => text(b).length - text(a).length)[0];
    if (named) return text(named);
    const facing = people.find(name => confronts(name, waiting));
    return facing ? text(facing) : '';
}

/**
 * Si alguien os está plantando cara: está entre los que esperan en el tablero para pelear
 * (el «Alguacil Torres» de la posada es Torres).
 *
 * @param {string} name
 * @param {string[]} waiting Quién espera en el tablero sin pelear todavía.
 * @returns {boolean}
 */
export function confronts(name, waiting) {
    return Boolean(text(name)) && (Array.isArray(waiting) ? waiting : []).some(w => names(fold(w), name));
}

/**
 * Lo que dice alguien en una charla, sin el párrafo de narración que el modelo pone delante
 * a veces («La posadera se cruza de brazos…»): desde el primer párrafo en que habla. Sin
 * diálogo, se deja como está.
 *
 * @param {string} said
 * @returns {string}
 */
export function keepSpeech(said) {
    const paragraphs = String(said ?? '').split(/\n\s*\n|\n/).map(p => p.trim()).filter(Boolean);
    const first = paragraphs.findIndex(p => /[—«"“]/.test(p));
    return first > 0 ? paragraphs.slice(first).join('\n\n') : String(said ?? '');
}

/**
 * Para el modelo, cuando quien juega le pregunta al narrador directamente (el botón «Al
 * narrador»): fuera de la escena, contesta el narrador y nadie más.
 *
 * @returns {string}
 */
export function narratorAskNote() {
    return '[AL NARRADOR] Quien juega te pregunta a ti directamente, fuera de la escena. Contesta tú, como narrador, '
        + 'en dos o tres frases claras: lo que ve o sabe su personaje, o qué puede hacer ahora. '
        + 'No hables por nadie de la escena ni hagas avanzar la historia.';
}

/**
 * Lo que se le dice al modelo de una charla: los hechos, y que lo diga con su voz.
 *
 * @param {Talker} npc
 * @param {string} said Lo que ha salido en pantalla.
 * @returns {string}
 */
export function talkNote(npc, said) {
    const voice = text(npc?.voice);
    return `[GENTE] ${text(said)}${voice ? ` Habla así: ${lowerFirst(voice).replace(/\.$/, '')}.` : ''} Si lo cuentas, en su boca y con su voz; no añadas nada que no esté aquí.`;
}
