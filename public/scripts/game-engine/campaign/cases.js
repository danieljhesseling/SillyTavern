/**
 * Casos con verdad: un misterio que el motor sabe y el narrador no (U8 del pegamento; la
 * Propuesta 2 de wiki/archivo/PROPUESTAS_BUCLE_DE_JUEGO.md, fase F1).
 *
 * El motor genera un caso con **una verdad fija** —quién, por qué, cómo, dónde y cuándo— y
 * reparte pistas por el mundo. Cada pista es un hecho atómico con su fuente (una persona, un
 * sitio) y su forma de conseguirla (hablar, sonsacar, registrar, un rumor). Hay sospechosos
 * de más, con pistas falsas que apuntan a ellos, y cada uno tiene su secreto de verdad: una
 * pista falsa no es una mentira del juego, es la verdad de otra cosa.
 *
 * **El narrador no ve la verdad**: solo las pistas que ya se han encontrado. No puede
 * destripar lo que no sabe, y el prompt crece solo con lo hallado.
 *
 * Lo más importante del módulo es el **comprobador**: cada hecho clave tiene que tener al
 * menos dos caminos, y ninguna pista falsa puede pesar más que la verdad. Las pruebas generan
 * miles de casos y los pasan todos por él.
 *
 * Puro, con semilla: dar, repartir, comprobar y juzgar. Lo que se ve y cómo se busca, fuera.
 *
 * Ver wiki/ROADMAP_PEGAMENTO.md, U8.
 */

/**
 * Cada semana, si no hay ninguno abierto, lo que tiene de empezar un caso. Es una tabla para
 * que el recorrido de pruebas pueda subirla a 1 y ponerla como estaba.
 */
export const CASE_CHANCE = { weekly: 0.35 };

/** Las clases de caso, con lo que se pregunta en cada una. */
export const CASE_KINDS = {
    asesinato: { label: 'Asesinato', title: (/** @type {any} */ v) => `Quién mató a ${v}`, crime: 'lo mató' },
    robo: { label: 'Robo', title: (/** @type {any} */ v) => `Quién robó a ${v}`, crime: 'le robó' },
    desaparicion: { label: 'Desaparición', title: (/** @type {any} */ v) => `Qué fue de ${v}`, crime: 'se lo llevó' },
};

/** Los móviles: de dónde sale que alguien haga algo así. */
export const MOTIVES = ['una deuda', 'los celos', 'un secreto que iba a contarse', 'la paga de una facción', 'una vieja venganza'];

/** Las formas, por clase de caso. */
export const METHODS = {
    asesinato: ['un remo', 'veneno en la jarra', 'un cuchillo de cocina', 'un empujón al río'],
    robo: ['una llave copiada', 'la ventana del granero', 'un descuido en la feria'],
    desaparicion: ['un carro de noche', 'una barca sin luz', 'el camino viejo'],
};

/** Las franjas del día, para la línea de tiempo. */
export const SLOTS = ['mañana', 'tarde', 'noche'];

/** Las formas de conseguir una pista, con lo que se tira si se tira. */
export const HOW = {
    hablar: { label: 'Hablar con', skill: '' },
    sonsacar: { label: 'Sonsacar a', skill: 'insight' },
    registrar: { label: 'Registrar', skill: 'investigation' },
    rumor: { label: 'Oír en', skill: '' },
};

/**
 * @typedef {Object} CaseClue
 * @property {string} id
 * @property {string} fact Lo que se sabe, en una frase.
 * @property {'culpable'|'movil'|'forma'} points Qué hecho clave apoya.
 * @property {string} about De quién habla: el sospechoso al que apunta.
 * @property {boolean} misleading Si apunta a quien no fue (y es verdad de otra cosa).
 * @property {{kind: 'persona'|'sitio', name: string}} source
 * @property {keyof typeof HOW} how
 */

/**
 * @typedef {Object} MysteryCase
 * @property {string} id
 * @property {keyof typeof CASE_KINDS} kind
 * @property {string} title
 * @property {string} victim
 * @property {string} place
 * @property {number} day
 * @property {{culprit: string, motive: string, method: string, slot: string}} truth
 * @property {string[]} suspects
 * @property {Record<string, string>} secrets El secreto de cada sospechoso inocente.
 * @property {CaseClue[]} clues
 * @property {string[]} motives Los móviles que se pueden elegir al acusar.
 * @property {string[]} methods Las formas que se pueden elegir al acusar.
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Elegir uno de una lista, con la semilla.
 *
 * @template T
 * @param {T[]} list
 * @param {() => number} random
 * @returns {T}
 */
function pick(list, random) {
    return list[Math.floor(random() * list.length) % list.length];
}

/**
 * Barajar, con la semilla.
 *
 * @template T
 * @param {T[]} list
 * @param {() => number} random
 * @returns {T[]}
 */
function shuffle(list, random) {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1)) % (i + 1);
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/**
 * Generar un caso con la gente y los sitios del mundo.
 *
 * @param {Object} input
 * @param {Array<{name: string, place?: string, trade?: string}>} input.people Hacen falta seis: la víctima, tres
 *   sospechosos y al menos dos testigos (una víctima no puede ser quien cuenta lo que vio).
 * @param {string[]} input.places Dónde se buscan las pistas.
 * @param {() => number} input.random
 * @param {number} [input.day]
 * @param {keyof typeof CASE_KINDS} [input.kind]
 * @param {string[]} [input.protectedNames] Quien no puede ser la víctima: lo necesita el hilo o
 *   atiende un servicio. Como en «la gente se muda o muere» (idea 87): nunca quien hace falta.
 * @returns {MysteryCase|null} Nada si no hay gente suficiente.
 */
export function generateCase({ people, places, random, day = 1, kind, protectedNames = [] }) {
    const shuffled = shuffle((people ?? []).filter(p => text(p?.name)), random);
    const safe = new Set((protectedNames ?? []).map(text));
    const victimAt = shuffled.findIndex(p => !safe.has(text(p.name)));
    if (victimAt < 0) return null;
    const cast = [shuffled[victimAt], ...shuffled.filter((_, i) => i !== victimAt)];
    const sites = [...new Set((places ?? []).map(text).filter(Boolean))];
    if (cast.length < 6 || sites.length < 2) return null;
    const chosenKind = kind && kind in CASE_KINDS ? kind : pick(/** @type {Array<keyof typeof CASE_KINDS>} */ (Object.keys(CASE_KINDS)), random);
    const [victim, culprit, decoyA, decoyB] = cast;
    const place = text(victim.place) || sites[0];
    const motives = shuffle(MOTIVES, random).slice(0, 3);
    const methods = shuffle(METHODS[chosenKind], random).slice(0, 3);
    const truth = { culprit: text(culprit.name), motive: motives[0], method: methods[0], slot: pick(SLOTS, random) };
    const suspects = shuffle([truth.culprit, text(decoyA.name), text(decoyB.name)], random);
    const witnesses = cast.slice(4).map(p => text(p.name));
    const site = (/** @type {number} */ i) => sites[i % sites.length];
    const someone = (/** @type {number} */ i) => witnesses[i % witnesses.length];

    /** @type {CaseClue[]} */
    const clues = [];
    const add = (/** @type {Omit<CaseClue, 'id'>} */ clue) => clues.push({ id: `pista-${clues.length + 1}`, ...clue });

    // Cada hecho clave, por dos caminos distintos: una persona y un sitio.
    add({ fact: `Alguien vio a ${truth.culprit} cerca de ${place} por la ${truth.slot}.`, points: 'culpable', about: truth.culprit, misleading: false, source: { kind: 'persona', name: someone(0) }, how: 'hablar' });
    add({ fact: `En ${place} hay algo de ${truth.culprit} que no debería estar allí.`, points: 'culpable', about: truth.culprit, misleading: false, source: { kind: 'sitio', name: place }, how: 'registrar' });
    add({ fact: `${truth.culprit} tenía ${truth.motive} con ${text(victim.name)}.`, points: 'movil', about: truth.culprit, misleading: false, source: { kind: 'persona', name: someone(1) }, how: 'sonsacar' });
    add({ fact: `Se dice en ${site(1)} que lo de ${text(victim.name)} va de ${truth.motive}.`, points: 'movil', about: truth.culprit, misleading: false, source: { kind: 'sitio', name: site(1) }, how: 'rumor' });
    add({ fact: `Fue con ${truth.method}.`, points: 'forma', about: truth.culprit, misleading: false, source: { kind: 'sitio', name: place }, how: 'registrar' });
    add({ fact: `${someone(2)} echó en falta ${truth.method} esa ${truth.slot}.`, points: 'forma', about: truth.culprit, misleading: false, source: { kind: 'persona', name: someone(2) }, how: 'hablar' });

    // Una pista falsa por sospechoso inocente: verdad de otra cosa, que se explica con su secreto.
    /** @type {Record<string, string>} */
    const secrets = {};
    for (const [i, decoy] of [text(decoyA.name), text(decoyB.name)].entries()) {
        secrets[decoy] = `${decoy} estaba en ${site(i + 2)} esa ${truth.slot}, por algo que no quería que se supiera: ${pick(['una deuda de juego', 'una cita', 'un contrabando pequeño', 'una visita al curandero'], random)}.`;
        add({ fact: `A ${decoy} se le vio nervioso después de lo de ${text(victim.name)}.`, points: 'culpable', about: decoy, misleading: true, source: { kind: 'persona', name: someone(3 + i) }, how: 'hablar' });
    }

    return {
        id: `caso-${text(victim.name).toLowerCase().replace(/[^a-z0-9ñáéíóú]+/g, '-')}-${Math.max(1, Math.floor(Number(day) || 1))}`,
        kind: chosenKind,
        title: CASE_KINDS[chosenKind].title(text(victim.name)),
        victim: text(victim.name),
        place,
        day: Math.max(1, Math.floor(Number(day) || 1)),
        truth,
        suspects,
        secrets,
        clues: shuffle(clues, random),
        motives: shuffle(motives, random),
        methods: shuffle(methods, random),
    };
}

/**
 * ¿Se puede resolver? Cada hecho clave con al menos dos caminos (fuentes distintas) a la
 * verdad, y ninguna pista falsa pesa más que la verdad para el culpable. Devuelve lo que
 * falla, para que un caso roto se vea en las pruebas y no en la partida.
 *
 * @param {MysteryCase} mystery
 * @returns {{ok: boolean, problems: string[]}}
 */
export function checkCase(mystery) {
    /** @type {string[]} */
    const problems = [];
    if (!mystery) return { ok: false, problems: ['No hay caso.'] };
    for (const point of /** @type {Array<CaseClue['points']>} */ (['culpable', 'movil', 'forma'])) {
        const paths = new Set(mystery.clues.filter(c => c.points === point && !c.misleading).map(c => `${c.source.kind}:${c.source.name}:${c.how}`));
        if (paths.size < 2) problems.push(`El hecho «${point}» tiene ${paths.size} camino(s); hacen falta dos.`);
    }
    const weight = (/** @type {string} */ who) => mystery.clues.filter(c => c.points === 'culpable' && c.about === who).length;
    for (const suspect of mystery.suspects) {
        if (suspect !== mystery.truth.culprit && weight(suspect) >= weight(mystery.truth.culprit)) {
            problems.push(`Contra ${suspect} hay tantas pistas como contra quien fue.`);
        }
        if (suspect !== mystery.truth.culprit && !text(mystery.secrets[suspect])) problems.push(`${suspect} no tiene secreto que explique su pista falsa.`);
    }
    if (!mystery.suspects.includes(mystery.truth.culprit)) problems.push('Quien fue no está entre los sospechosos.');
    if (!mystery.motives.includes(mystery.truth.motive) || !mystery.methods.includes(mystery.truth.method)) problems.push('La verdad no está entre lo que se puede elegir.');
    if (new Set(mystery.suspects).size !== mystery.suspects.length) problems.push('Hay un sospechoso repetido.');
    return { ok: problems.length === 0, problems };
}

/**
 * Acusar: quién, por qué y cómo. Se acierta con las tres; con el culpable pero sin lo demás,
 * a medias (se le encierra, pero el porqué se queda sin saber); con otro, mal.
 *
 * @param {MysteryCase} mystery
 * @param {{culprit: string, motive: string, method: string}} accusation
 * @returns {{verdict: 'acierto'|'a-medias'|'error', line: string}}
 */
export function accuse(mystery, accusation) {
    const rightWho = text(accusation?.culprit) === mystery.truth.culprit;
    const rightWhy = text(accusation?.motive) === mystery.truth.motive;
    const rightHow = text(accusation?.method) === mystery.truth.method;
    if (rightWho && rightWhy && rightHow) {
        return { verdict: 'acierto', line: `Fue ${mystery.truth.culprit}, por ${mystery.truth.motive}, con ${mystery.truth.method}. Encaja todo.` };
    }
    if (rightWho) {
        return { verdict: 'a-medias', line: `Fue ${mystery.truth.culprit}, pero no todo lo que decís encaja: queda la duda de por qué, o de cómo.` };
    }
    return { verdict: 'error', line: `${text(accusation?.culprit) || 'Nadie'} no fue. ${mystery.secrets[text(accusation?.culprit)] ?? ''}`.trim() };
}

/**
 * Lo que el narrador puede saber de un caso: las pistas encontradas, nunca la verdad.
 *
 * @param {MysteryCase} mystery
 * @param {string[]} found Los ids de las pistas encontradas.
 * @returns {string}
 */
export function caseForNarrator(mystery, found) {
    const known = mystery.clues.filter(c => (found ?? []).includes(c.id)).map(c => `- ${c.fact}`);
    return [
        `[CASO] ${mystery.title}. Lo que el grupo sabe hasta ahora:`,
        ...(known.length > 0 ? known : ['- Nada todavía.']),
        'Cuéntalo solo con esto. No sabes quién fue: no lo insinúes ni inventes pistas.',
    ].join('\n');
}

/**
 * @typedef {Object} CaseState
 * @property {MysteryCase|null} active
 * @property {string[]} found Las pistas encontradas del caso abierto.
 * @property {Array<{id: string, title: string, verdict: string}>} closed
 */

/**
 * Lo guardado de los casos, o nada abierto.
 *
 * @param {any} raw
 * @returns {CaseState}
 */
export function readCases(raw) {
    const active = raw?.active && typeof raw.active === 'object' && Array.isArray(raw.active.clues) ? raw.active : null;
    return {
        active,
        found: active && Array.isArray(raw.found) ? raw.found.map(text).filter(id => active.clues.some((/** @type {any} */ c) => c.id === id)) : [],
        closed: (Array.isArray(raw?.closed) ? raw.closed : []).filter((/** @type {any} */ c) => c && text(c.id)).slice(-20),
    };
}

/**
 * Las pistas que quedan por encontrar en un sitio o con una persona.
 *
 * @param {CaseState} state
 * @param {{place?: string, person?: string}} where
 * @returns {CaseClue[]}
 */
export function cluesHere(state, { place = '', person = '' }) {
    if (!state.active) return [];
    return state.active.clues.filter(c => !state.found.includes(c.id)
        && ((person && c.source.kind === 'persona' && c.source.name === text(person))
            || (place && c.source.kind === 'sitio' && c.source.name === text(place))));
}

/**
 * Lo que se sabe de cada sospechoso, con lo encontrado.
 *
 * @param {CaseState} state
 * @returns {Array<{name: string, facts: string[]}>}
 */
export function suspectsBoard(state) {
    if (!state.active) return [];
    const found = state.active.clues.filter(c => state.found.includes(c.id));
    return state.active.suspects.map(name => ({ name, facts: found.filter(c => c.about === name && c.points === 'culpable').map(c => c.fact) }));
}
