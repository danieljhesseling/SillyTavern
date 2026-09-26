/**
 * El Duelo de Palabras: una conversación que importa, jugada en rondas (U6 del pegamento; la
 * Propuesta 3 de wiki/archivo/PROPUESTAS_BUCLE_DE_JUEGO.md).
 *
 * Hablar era una tirada suelta y vuelta al chat: la mitad del rol, y la más cara, porque cada
 * mensaje es una llamada al modelo con el prompt entero. Aquí la conversación se juega:
 *
 * - **El otro** tiene **paciencia** (lo que hay que gastarle para que ceda) y una **postura**
 *   —desconfiado, orgulloso, asustado, codicioso, leal— que cambia qué funciona con él.
 * - **Tú** tienes **compostura**: sus réplicas te la gastan, y si se acaba, pierdes el hilo.
 * - **Tu mano** sale de lo que tienes: tus habilidades (se tiran), las pruebas que habéis
 *   encontrado, los favores de quien os debe una, el oro, y un compañero que hable por ti.
 *   Cada carta se juega una vez.
 * - Tres resultados: **cede**, **cede a medias** (con su precio) o **no cede**.
 *
 * El narrador lo cuenta una vez, al final, con las rondas en pocas líneas: una llamada donde
 * antes había varias.
 *
 * Puro, con el dado inyectado: arma la mano, juega las rondas y dice cómo acaba.
 *
 * Ver wiki/ROADMAP_PEGAMENTO.md, U6.
 */

/**
 * Las posturas: qué pesa más y qué se vuelve en contra con cada una. Un número negativo es
 * que esa forma de hablar le endurece: suma paciencia en vez de gastarla.
 *
 * @type {Record<string, {label: string, note: string, weights: Record<string, number>}>}
 */
export const STANCES = {
    desconfiado: { label: 'desconfiado', note: 'Lo que suene a truco cuenta la mitad; las pruebas, más.', weights: { enganar: 0.5, prueba: 1.5 } },
    orgulloso: { label: 'orgulloso', note: 'Amenazarle le endurece; que le den la razón, le ablanda.', weights: { intimidar: -1, persuadir: 1.5 } },
    asustado: { label: 'asustado', note: 'Una amenaza pesa el doble; las promesas, menos.', weights: { intimidar: 2, persuadir: 0.5 } },
    codicioso: { label: 'codicioso', note: 'El oro habla por dos; los favores, poco.', weights: { oro: 2, favor: 0.5 } },
    leal: { label: 'leal', note: 'Mentirle se nota; lo que diga un amigo de los suyos, cuenta.', weights: { enganar: -1, favor: 1.5, companero: 1.5 } },
};

/** Las formas de hablar que se tiran, con su habilidad. */
export const SKILL_ARGUMENTS = {
    persuadir: { skill: 'persuasion', label: 'Convencer', verb: 'le convence' },
    enganar: { skill: 'deception', label: 'Engañar', verb: 'le engaña' },
    intimidar: { skill: 'intimidation', label: 'Intimidar', verb: 'le intimida' },
};

/** Lo que gasta de paciencia un argumento que sale, antes de la postura. */
export const BASE_POWER = { tirada: 3, prueba: 4, favor: 3, oro: 3, companero: 2 };

/** La CD de las tiradas del duelo. */
export const DUEL_DC = 12;

/**
 * @typedef {Object} Argument
 * @property {string} id
 * @property {'persuadir'|'enganar'|'intimidar'|'prueba'|'favor'|'oro'|'companero'|'truco'} kind
 * @property {string} [as] R3: la forma de hablar a la que pesa un truco, para la postura.
 * @property {number} [power] R3: lo que gasta de paciencia un truco, sin tirar.
 * @property {number} [composure] R3: el aplomo que devuelve.
 * @property {string} [spell] R4: el conjuro que gasta al jugarla.
 * @property {boolean} [risky] R4: si sale mal, se nota (un Encanto).
 * @property {string} label Lo que es en la historia: «Enseñar la carta del molinero».
 * @property {string} [skill] La habilidad, si se tira.
 * @property {number} [modifier] Lo que suma a la tirada.
 * @property {number} [cost] El oro que cuesta, si cuesta.
 * @property {string} [who] Quién habla, si es un compañero.
 */

/**
 * @typedef {Object} DuelState
 * @property {{name: string, stance: string}} npc
 * @property {number} patience
 * @property {number} startPatience
 * @property {number} composure
 * @property {number} round
 * @property {number} rounds
 * @property {Argument[]} hand
 * @property {string[]} used
 * @property {string[]} log Lo que pasó, ronda a ronda.
 * @property {number} spent El oro gastado.
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * La mano: lo que puedes decir, sacado de lo que tienes.
 *
 * @param {Object} input
 * @param {Record<string, number>} input.modifiers Lo que suma quien habla a cada habilidad.
 * @param {string[]} [input.evidence] Las pruebas: pistas y secretos que el grupo sabe.
 * @param {string[]} [input.favors] Quién os debe una (facciones que os miran bien).
 * @param {number} [input.purse] El oro que hay.
 * @param {Array<{name: string, rank: number}>} [input.companions]
 * @param {boolean} [input.allowCoin] Si el oro sirve aquí (en un regateo, no).
 * @param {Argument[]} [input.tricks] R3: lo que sabe hacer quien habla y sirve hablando
 *   (`field-uses.js`, `duelTricks`): una burla, una palabra de ánimo.
 * @returns {Argument[]}
 */
export function handFrom({ modifiers, evidence = [], favors = [], purse = 0, companions = [], allowCoin = true, tricks = [] }) {
    /** @type {Argument[]} */
    const hand = [];
    for (const [kind, spec] of Object.entries(SKILL_ARGUMENTS)) {
        hand.push({ id: kind, kind: /** @type {any} */ (kind), label: spec.label, skill: spec.skill, modifier: Math.round(Number(modifiers?.[spec.skill]) || 0) });
    }
    for (const [i, clue] of evidence.filter(e => text(e)).slice(0, 2).entries()) {
        hand.push({ id: `prueba:${i}`, kind: 'prueba', label: `Enseñar lo que sabéis: ${text(clue)}` });
    }
    for (const [i, faction] of favors.filter(f => text(f)).slice(0, 1).entries()) {
        hand.push({ id: `favor:${i}`, kind: 'favor', label: `Nombrar a ${text(faction)}, que os deben una` });
    }
    if (allowCoin && Number(purse) >= 10) hand.push({ id: 'oro', kind: 'oro', label: 'Poner 10 de oro encima de la mesa', cost: 10 });
    const friend = [...companions].filter(c => Number(c.rank) >= 2).sort((a, b) => Number(b.rank) - Number(a.rank))[0];
    if (friend) hand.push({ id: 'companero', kind: 'companero', label: `Que hable ${text(friend.name)}`, who: text(friend.name) });
    for (const trick of (Array.isArray(tricks) ? tricks : []).slice(0, 2)) hand.push({ ...trick, kind: 'truco' });
    return hand;
}

/**
 * Empezar un duelo.
 *
 * @param {Object} input
 * @param {{name: string, stance?: string}} input.npc
 * @param {number} [input.patience]
 * @param {Argument[]} input.hand
 * @param {number} [input.rounds]
 * @param {number} [input.composure]
 * @returns {DuelState}
 */
export function startDuel({ npc, patience = 8, hand, rounds = 3, composure = 5 }) {
    const stance = text(npc?.stance) in STANCES ? text(npc.stance) : 'desconfiado';
    const start = Math.max(1, Math.round(Number(patience) || 8));
    return {
        npc: { name: text(npc?.name) || 'Alguien', stance },
        patience: start,
        startPatience: start,
        composure: Math.max(1, Math.round(Number(composure) || 5)),
        round: 0,
        rounds: Math.max(1, Math.round(Number(rounds) || 3)),
        hand: [...(hand ?? [])],
        used: [],
        log: [],
        spent: 0,
    };
}

/**
 * Cómo acaba, si ya acabó: cede, cede a medias o no cede. Nada si sigue.
 *
 * @param {DuelState} state
 * @returns {'cede'|'a-medias'|'no-cede'|null}
 */
export function duelOutcome(state) {
    if (state.patience <= 0) return 'cede';
    if (state.composure <= 0) return 'no-cede';
    if (state.round < state.rounds && state.used.length < state.hand.length) return null;
    return state.patience <= Math.floor(state.startPatience / 2) ? 'a-medias' : 'no-cede';
}

/**
 * Jugar una carta: una ronda. Lo que dice el otro después, también.
 *
 * @param {DuelState} state
 * @param {string} id
 * @param {() => number} rollD20
 * @returns {{state: DuelState, line: string, reply: string, ok: boolean}}
 */
export function playArgument(state, id, rollD20) {
    const argument = state.hand.find(a => a.id === id);
    if (!argument || state.used.includes(id) || duelOutcome(state) !== null) {
        return { state, line: '', reply: '', ok: false };
    }
    const stance = STANCES[state.npc.stance];
    // R3: un truco pesa como la forma de hablar a la que se parece (una burla, a intimidar).
    const weight = stance.weights[argument.kind === 'truco' ? String(argument.as ?? '') : argument.kind] ?? 1;
    let power = 0;
    let line = '';
    let composure = state.composure;
    if (argument.skill) {
        const natural = Math.max(1, Math.min(20, Math.round(Number(rollD20()) || 1)));
        const total = natural + (Number(argument.modifier) || 0);
        const success = natural === 20 || (natural !== 1 && total >= DUEL_DC);
        power = success ? BASE_POWER.tirada + (natural >= 18 ? 1 : 0) : 0;
        line = `${argument.label}: ${total} contra ${DUEL_DC} ${success ? '✓' : '✗'}`;
        if (!success) composure -= 1;
    } else {
        power = argument.kind === 'truco'
            ? Math.max(0, Number(argument.power) || 0)
            : BASE_POWER[/** @type {keyof typeof BASE_POWER} */ (argument.kind)] ?? 2;
        line = argument.label;
        // R3: una palabra de ánimo devuelve aplomo a los tuyos.
        if (Number(argument.composure) > 0) {
            composure += Number(argument.composure);
            line += ` — recuperáis aplomo (+${Number(argument.composure)})`;
        }
    }
    const spent = state.spent + (Number(argument.cost) || 0);
    let patience = state.patience;
    if (power > 0 && weight < 0) {
        // Esa forma de hablar le endurece.
        patience += power;
        composure -= 1;
        line += ` — y le endurece (${stance.label})`;
    } else {
        const cut = Math.round(power * weight);
        patience -= cut;
        if (cut > 0 && weight !== 1) line += weight > 1 ? ` — le pesa más (${stance.label})` : ` — le pesa menos (${stance.label})`;
    }
    const next = {
        ...state,
        patience: Math.max(0, patience),
        composure: Math.max(0, composure),
        round: state.round + 1,
        used: [...state.used, id],
        spent,
    };
    const reply = next.patience > 0 && next.composure > 0 && next.round < next.rounds ? replyOf(next) : '';
    if (reply) next.composure = Math.max(0, next.composure - 1);
    next.log = [...state.log, `Ronda ${next.round}: ${line}.${reply ? ` ${state.npc.name}: «${reply}»` : ''}`];
    return { state: next, line, reply, ok: true };
}

/** Lo que replica, según su postura: siempre lo mismo para la misma ronda, sin azar. */
const REPLIES = {
    desconfiado: ['¿Y quién me dice que no me estáis engañando?', 'Palabras. Enseñadme algo.'],
    orgulloso: ['No necesito que nadie me diga lo que me conviene.', 'Hablad con respeto, o no habléis.'],
    asustado: ['No sé… si se enteran, me la juego yo.', 'No me metáis en líos.'],
    codicioso: ['Eso está muy bien, pero ¿qué gano yo?', 'Todo tiene un precio.'],
    leal: ['Los míos primero. Siempre.', 'No voy a traicionar a quien me dio de comer.'],
};

/** @param {DuelState} state @returns {string} */
function replyOf(state) {
    const lines = REPLIES[/** @type {keyof typeof REPLIES} */ (state.npc.stance)] ?? REPLIES.desconfiado;
    return lines[(state.round - 1) % lines.length];
}

/**
 * Lo que se le da al narrador al acabar: las rondas en pocas líneas y cómo acabó. Una llamada.
 *
 * @param {DuelState} state
 * @param {string} what Qué se quería: «que os deje pasar sin pagar».
 * @returns {string}
 */
export function duelPrompt(state, what) {
    const outcome = duelOutcome(state) ?? 'no-cede';
    const said = { 'cede': 'cede', 'a-medias': 'cede a medias, con un precio', 'no-cede': 'no cede' }[outcome];
    return [
        `[DUELO] Una conversación con ${state.npc.name} (${STANCES[state.npc.stance].label}) para ${text(what) || 'convencerle'}. Así fue:`,
        ...state.log.map(line => `- ${line}`),
        `Al final ${said}. Cuéntalo en cuatro o cinco frases, con lo que se dijo. No cambies el resultado ni inventes nada más.`,
    ].join('\n');
}
