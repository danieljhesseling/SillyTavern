/**
 * Lo que opinan tus compañeros, a la vista al decidir (J7.5 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * Hasta ahora la opinión llegaba después: elegías, y un aviso decía «👍 Bran · 👎 Lyra»
 * (`approval.js`). Ahora se ve antes, en la opción misma de una charla o de una escena del hilo:
 * «A Bran le gusta esto», «A Nella no le gusta esto». Como en *Baldur's Gate*: sabes a quién vas
 * a contentar, y eliges igual.
 *
 * - **Qué es cada opción** (`optionTraits`): lo dice la opción si trae `decision` (una de
 *   `TRAITS` o de `DECISIONS` de `approval.js`); si no, se saca de lo que hace: pagar o pedir
 *   dinero, tratar bien o mal a quien habla, lo que se pregunta, y la tirada (convencer,
 *   amenazar, engañar, mirar, colarse).
 * - **A quién le gusta** (`opinionsOn`): a cada uno, según lo que busca (`WANT_LEANS`) y lo que
 *   su ficha dice que le gusta o no (`companion-cards.js`), que manda. El héroe no opina de sí
 *   mismo, y los caídos tampoco.
 * - **Lo que se ve** (`opinionBadges`): una o dos etiquetas por opción, las de quien más se
 *   nota, dichas en llano.
 * - **Y cuenta**: al elegir, las mismas opiniones son la aprobación de `approval.js`
 *   (`verdictsOf`): un punto de vínculo arriba o abajo, como siempre.
 * - **Solo en lo importante** (D-J48, `importantOption`): las escenas del hilo y las opciones de
 *   una charla que deciden algo. Charlar de cualquier cosa no sube ni baja a nadie.
 *
 * Puro: de una opción y un grupo, quién opina qué. Quien llama lo pinta y lo apunta.
 */

import { DECISIONS } from './approval.js';
import { cardOf, shortOf, wantsFor } from './companion-cards.js';

/**
 * Lo que puede ser una opción, dicho para quien lea el porqué.
 *
 * @type {Record<string, {label: string}>}
 */
export const TRAITS = {
    pagar: { label: 'pagar' },
    cobrar: { label: 'pedir dinero' },
    amable: { label: 'tratar bien a quien tienes delante' },
    desairar: { label: 'tratar mal a quien tienes delante' },
    ayudar: { label: 'echar una mano' },
    preguntar: { label: 'preguntar' },
    observar: { label: 'fijarse bien' },
    convencer: { label: 'convencer con buenas palabras' },
    amenazar: { label: 'amenazar' },
    enganar: { label: 'mentir' },
    sigilo: { label: 'hacerlo a escondidas' },
    apostar: { label: 'apostar' },
    pelear: { label: 'pelear' },
    huir: { label: 'echarse atrás' },
};

/**
 * Lo que le gusta (1) o no (-1) a cada deseo, de lo que puede ser una opción. Lo que no está
 * le da igual: un compañero que opina de todo deja de decir nada.
 *
 * @type {Record<string, Record<string, 1|-1>>}
 */
export const WANT_LEANS = {
    coin: { pagar: -1, cobrar: 1, apostar: 1 },
    glory: { pelear: 1, amenazar: 1, huir: -1, enganar: -1, sigilo: -1 },
    blood: { pelear: 1, amenazar: 1, pagar: -1 },
    quiet: { convencer: 1, amable: 1, amenazar: -1, pelear: -1 },
    knowledge: { preguntar: 1, observar: 1 },
};

/** Lo que se lee de cada tirada. */
const CHECK_TRAITS = {
    persuasion: 'convencer',
    intimidation: 'amenazar',
    deception: 'enganar',
    insight: 'observar',
    investigation: 'observar',
    perception: 'observar',
    stealth: 'sigilo',
};

/** Cuántas etiquetas se enseñan por opción, como mucho. */
export const MAX_BADGES = 2;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string[]} */
const listOf = (value) => (Array.isArray(value) ? value : value == null ? [] : [value]).map(text).filter(Boolean);

/**
 * Lo que es una opción: lo que dice (`decision`, una palabra o una lista) y lo que hace.
 *
 * Vale una opción de charla leída (`dialogues.js`: `effects` con `kind`, `check.skill`) y una
 * tal como se escribe en el paquete (`effects: [{"gold": -3}]`, `check: {"skill": …}`).
 *
 * @param {any} option
 * @returns {string[]} Palabras de `TRAITS` o decisiones de `DECISIONS`, sin repetir.
 */
export function optionTraits(option) {
    if (!option || typeof option !== 'object') return [];
    /** @type {string[]} */
    const out = listOf(option.decision).filter(d => d in TRAITS || d in DECISIONS);
    const effects = Array.isArray(option.effects) ? option.effects : option.effects ? [option.effects] : [];
    for (const raw of effects) {
        if (!raw || typeof raw !== 'object') continue;
        const kind = text(raw.kind) || Object.keys(raw).find(k => ['gold', 'attitude', 'bond', 'rumor', 'clue', 'take', 'time'].includes(k)) || '';
        const amount = Number(raw.amount ?? raw[kind]) || 0;
        if (kind === 'gold' && amount < 0) out.push('pagar');
        else if (kind === 'gold' && amount > 0) out.push('cobrar');
        else if (kind === 'attitude' && amount > 0) out.push('amable');
        else if (kind === 'attitude' && amount < 0) out.push('desairar');
        else if (kind === 'bond' && amount > 0) out.push('amable');
        else if (kind === 'rumor' || kind === 'clue') out.push('preguntar');
        else if (kind === 'take' || kind === 'time') out.push('ayudar');
    }
    const skill = text(option.check?.skill).toLowerCase();
    const fromCheck = /** @type {Record<string, string>} */ (CHECK_TRAITS)[skill];
    if (fromCheck) out.push(fromCheck);
    return [...new Set(out)];
}

/**
 * Lo que le parece a alguien una palabra: su ficha manda; si no, lo que busca; y si es una
 * decisión de `approval.js`, lo que esa decisión dice de lo que busca.
 *
 * @param {{wants: string, likes: string[], dislikes: string[]}} who
 * @param {string} trait
 * @returns {1|-1|0}
 */
export function leanOn(who, trait) {
    if (who.likes.includes(trait)) return 1;
    if (who.dislikes.includes(trait)) return -1;
    const decision = /** @type {Record<string, {moods: Record<string, number>}>} */ (DECISIONS)[trait];
    const mood = decision ? decision.moods[who.wants] : WANT_LEANS[who.wants]?.[trait];
    return mood === 1 ? 1 : mood === -1 ? -1 : 0;
}

/**
 * @typedef {Object} Opinion
 * @property {string} id El id de su ficha del grupo.
 * @property {string} name
 * @property {string} short Cómo se le llama en corto.
 * @property {1|-1} mood
 * @property {string} want Lo que busca.
 * @property {string} trait Lo que le ha hecho opinar.
 * @property {string} what Lo mismo, dicho («pagar»).
 */

/**
 * Lo que opina cada compañero de una opción. Si una palabra le gusta y otra no, manda la que
 * más le toca: su ficha antes que lo que busca. Empate: no dice nada.
 *
 * @param {Object} input
 * @param {any} input.option La opción (leída o como se escribe).
 * @param {any[]} input.party El grupo, con el héroe primero.
 * @param {import('./companion-cards.js').CompanionCard[]} [input.cards]
 * @param {(member: any) => string} [input.wantsOf] Lo que busca cada uno, si no hay ficha.
 * @returns {Opinion[]}
 */
export function opinionsOn({ option, party, cards = [], wantsOf = null }) {
    const traits = optionTraits(option);
    if (traits.length === 0) return [];
    /** @type {Opinion[]} */
    const out = [];
    for (const member of (Array.isArray(party) ? party : []).slice(1)) {
        if (!member || member.dead || (Number(member.hp ?? 1) || 0) <= 0 || member.guest?.kind === 'ward') continue;
        const card = cardOf(cards, member.name);
        const want = card?.wants || (wantsOf ? text(wantsOf(member)) : '') || wantsFor(cards, member);
        const who = { wants: want, likes: card?.likes ?? [], dislikes: card?.dislikes ?? [] };
        // Lo de su ficha pesa el doble que lo de su deseo: es lo que le hace él.
        let score = 0;
        let strongest = { trait: '', weight: 0, mood: /** @type {1|-1|0} */ (0) };
        for (const trait of traits) {
            const mood = leanOn(who, trait);
            if (!mood) continue;
            const weight = who.likes.includes(trait) || who.dislikes.includes(trait) ? 2 : 1;
            score += mood * weight;
            if (weight > strongest.weight || (weight === strongest.weight && !strongest.trait)) strongest = { trait, weight, mood };
        }
        if (score === 0) continue;
        const mood = /** @type {1|-1} */ (score > 0 ? 1 : -1);
        const trait = strongest.mood === mood ? strongest.trait : traits.find(t => leanOn(who, t) === mood) ?? strongest.trait;
        out.push({
            id: String(member.id ?? ''),
            name: text(member.name),
            short: shortOf(cards, member),
            mood,
            want,
            trait,
            what: /** @type {Record<string, {label: string}>} */ (TRAITS)[trait]?.label ?? /** @type {Record<string, {label: string}>} */ (DECISIONS)[trait]?.label ?? trait,
        });
    }
    return out;
}

/**
 * @typedef {Object} OpinionBadge Lo que se ve en la opción.
 * @property {1|-1} mood
 * @property {string} text «A Gerd le gusta esto», «A Gerd y a Nella no les gusta esto».
 * @property {string[]} names
 * @property {string} title El porqué, para quien pase el ratón: «Gerd: pagar».
 */

/**
 * Las etiquetas de una opción: a quién le gusta y a quién no, en una o dos, con los nombres
 * cortos. Primero lo que gusta.
 *
 * @param {Opinion[]} opinions
 * @param {{max?: number}} [options]
 * @returns {OpinionBadge[]}
 */
export function opinionBadges(opinions, { max = MAX_BADGES } = {}) {
    const list = Array.isArray(opinions) ? opinions : [];
    /** @type {OpinionBadge[]} */
    const out = [];
    for (const mood of /** @type {Array<1|-1>} */ ([1, -1])) {
        const those = list.filter(o => o.mood === mood);
        if (those.length === 0) continue;
        const names = those.map(o => o.short || o.name);
        const who = names.length === 1 ? `A ${names[0]}` : `A ${names.slice(0, -1).join(', a ')} y a ${names[names.length - 1]}`;
        const verb = names.length === 1 ? 'le gusta' : 'les gusta';
        out.push({
            mood,
            text: `${who} ${mood > 0 ? '' : 'no '}${verb} esto`,
            names,
            title: those.map(o => `${o.short || o.name}: ${o.what}`).join(' · '),
        });
    }
    return out.slice(0, Math.max(0, max));
}

/**
 * Lo que se dice en la ventana al elegir: «A Gerd le ha gustado.», «A Gerd y a Nella no les ha
 * gustado.». Primero lo que gusta. Vacío si nadie opina.
 *
 * @param {Opinion[]} opinions
 * @returns {string[]}
 */
export function opinionNotes(opinions) {
    return opinionBadges(opinions, { max: 2 }).map(badge => `${badge.text.replace(/ (le|les) gusta esto$/, ' $1 ha gustado')}.`);
}

/**
 * Las opiniones como aprobación de `approval.js` (`noteApproval`, `judgeDecision`): al elegir la
 * opción, cuentan para el vínculo.
 *
 * @param {Opinion[]} opinions
 * @param {string} [what] Lo que se hizo, para el apunte; sin él, lo de cada uno.
 * @returns {Array<{id: string, name: string, want: string, mood: 1|-1, what: string}>}
 */
export function verdictsOf(opinions, what = '') {
    return (Array.isArray(opinions) ? opinions : [])
        .filter(o => o.id)
        .map(o => ({ id: o.id, name: o.name, want: o.want, mood: o.mood, what: text(what) || o.what }));
}

// ---------------------------------------------------------------------------------------------
// D-J48: solo en las charlas importantes
// ---------------------------------------------------------------------------------------------

/** Lo que una opción puede escribir para decir que pesa, aunque no cambie nada a la vista. */
const WEIGHTY_FLAGS = ['decision', 'noReturn', 'irreversible', 'sinVuelta', 'weighty', 'important', 'importante'];

/** Lo que hace que un efecto sea una consecuencia: cómo os miran, una facción o el hilo. */
const WEIGHTY_EFFECTS = ['attitude', 'milestone', 'standing', 'faction', 'reputation', 'plot'];

/**
 * Si un efecto (leído, `{kind, amount}`, o como se escribe, `{"attitude": 1}`) es una
 * consecuencia de las que cuentan: cambiar cómo os mira alguien, una facción o el hilo.
 *
 * @param {any} effect
 * @returns {boolean}
 */
function weightyEffect(effect) {
    if (!effect || typeof effect !== 'object') return false;
    const kind = text(effect.kind) || Object.keys(effect).find(k => WEIGHTY_EFFECTS.includes(k)) || '';
    if (!WEIGHTY_EFFECTS.includes(kind)) return false;
    if (kind === 'attitude') return (Number(effect.amount ?? effect.attitude) || 0) !== 0;
    if (kind === 'milestone') return Boolean(text(effect.id ?? effect.milestone));
    return true;
}

/** @param {any} list @returns {any[]} */
const effectsOf = (list) => (Array.isArray(list) ? list : list == null ? [] : [list]);

/**
 * D-J48: si una opción es de las importantes, las únicas en las que el grupo opina (la etiqueta
 * «A Gerd le gusta esto») y en las que eso cuenta para el vínculo. Charlar de cualquier cosa no
 * sube ni baja a nadie.
 *
 * Importante es:
 * - todo lo de una **escena del hilo** (`scene`): es la historia;
 * - una opción **marcada** por quien la escribe: `decision` (lo que es), `irreversible` o
 *   `sinVuelta` (J11.1), `weighty` o `importante`;
 * - una opción con **consecuencias**: que cambia cómo os mira alguien, una facción o el hilo
 *   (cumple un hito), ella misma, su tirada (salga como salga) o el nudo al que lleva (con la
 *   charla, `dialogue`: «Quiero entrar en el gremio» lleva a donde se cumple el hito).
 *
 * Preguntar, pagar una ronda, oír un rumor o despedirse no lo son.
 *
 * @param {any} option Una opción de charla o de escena, leída o como se escribe.
 * @param {Object} [context]
 * @param {boolean} [context.scene] Si es de una escena del hilo.
 * @param {any} [context.dialogue] La charla de la opción (leída), para mirar adónde lleva.
 * @returns {boolean}
 */
export function importantOption(option, { scene = false, dialogue = null } = {}) {
    if (scene) return true;
    if (!option || typeof option !== 'object') return false;
    for (const flag of WEIGHTY_FLAGS) {
        const value = option[flag];
        if (value === true || (typeof value === 'string' && text(value)) || (Array.isArray(value) && value.some(v => text(v)))) return true;
    }
    const check = option.check && typeof option.check === 'object' ? option.check : null;
    // Una rama de la tirada es un nudo (`"success": "si"`) o un nudo con efectos.
    const branches = check ? ['success', 'partial', 'failure'].map(k => check[k]).filter(b => (b && typeof b === 'object') || typeof b === 'string') : [];
    if ([option.effects, ...branches.map(b => (typeof b === 'string' ? null : b.effects))].some(list => effectsOf(list).some(weightyEffect))) return true;
    // Adónde lleva: el nudo que se oye al elegirla (o al tirar) hace lo que hace la opción.
    const nodes = Array.isArray(dialogue?.nodes) ? dialogue.nodes : [];
    if (nodes.length === 0) return false;
    const next = [option.next, ...branches.map(b => (typeof b === 'string' ? b : b.next))].map(text).filter(Boolean);
    return nodes.some((/** @type {any} */ node) => next.includes(text(node?.id)) && effectsOf(node.effects).some(weightyEffect));
}

/**
 * Buscar la opción leída de una charla por su id, en el nudo donde está la charla ahora (o en
 * cualquiera). Para las pantallas, que solo tienen el id de la ficha.
 *
 * @param {any} dialogue Una charla leída (`readDialogue`).
 * @param {string} optionId
 * @param {string} [node] El nudo de ahora.
 * @returns {any|null}
 */
export function findOption(dialogue, optionId, node = '') {
    const nodes = Array.isArray(dialogue?.nodes) ? dialogue.nodes : [];
    const first = node ? nodes.filter((/** @type {any} */ n) => n?.id === node) : [];
    for (const one of [...first, ...nodes]) {
        const found = (Array.isArray(one?.options) ? one.options : []).find((/** @type {any} */ o) => o?.id === optionId);
        if (found) return found;
    }
    return null;
}
