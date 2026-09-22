/**
 * El tablón de encargos: por qué sales de casa.
 *
 * Hasta aquí las metas te las ponías tú, y una meta que te asignas tú no tira de nadie.
 * Esto es lo contrario: un tablón que se llena solo, con trabajos que **vencen**, que
 * pagan distinto según lo que arriesgan y que pide cosas que a lo mejor no sabes hacer
 * todavía. Es la otra mitad de la cuenta semanal — una dice lo que debes y el otro dice
 * de dónde puede salir.
 *
 * Determinista: la misma semilla da el mismo tablón, así que dos partidas iguales ofrecen
 * los mismos trabajos y se pueden comparar. Cero tokens: aquí solo hay tablas.
 *
 * **La temática del gremio no es un adorno**: es un peso sobre estas mismas tablas. Un
 * gremio de ladrones ve más robos y menos escoltas porque su tabla pesa distinto, no
 * porque haya otro generador. Un sistema, una tabla, y la ambientación sale de los pesos.
 *
 * Puro: genera y explica. No cobra, no guarda y no abre ningún tablero.
 *
 * Ver wiki/ROADMAP_MAESTRO.md, Niveles 3 y 4.
 */

/**
 * @typedef {Object} Contract
 * @property {string} id
 * @property {string} rank       De D a S: lo que exige, y lo que paga.
 * @property {string} kind       Qué hay que hacer.
 * @property {string} title
 * @property {string} locationName Dónde, si nombra un sitio del mundo.
 * @property {number} reward     Oro al entregarlo.
 * @property {number} days       Cuántos días quedan para entregarlo.
 * @property {number} difficulty El desafío recomendado, para poblar el sitio.
 * @property {string} patron     Quién lo pide.
 */

/**
 * Los rangos, de lo que hace cualquiera a lo que casi nadie vuelve.
 *
 * Los pagos suben más deprisa que el peligro a propósito: un encargo de rango alto tiene
 * que compensar el riesgo de perder a alguien, o nadie lo cogería dos veces.
 */
export const RANKS = [
    { id: 'D', label: 'Recados', reward: [15, 35], days: [10, 16], difficulty: 0.25, minRenown: 0 },
    { id: 'C', label: 'Trabajo honrado', reward: [45, 90], days: [8, 14], difficulty: 1, minRenown: 3 },
    { id: 'B', label: 'Peligroso', reward: [120, 220], days: [6, 12], difficulty: 3, minRenown: 8 },
    { id: 'A', label: 'Para pocos', reward: [300, 500], days: [5, 10], difficulty: 5, minRenown: 16 },
    { id: 'S', label: 'De los que no se vuelve', reward: [700, 1200], days: [4, 8], difficulty: 8, minRenown: 28 },
];

/** Qué clase de trabajo es. El verbo decide qué objetivo lleva el tablero. */
export const CONTRACT_KINDS = {
    cull: { label: 'Limpiar', objective: 'eliminate_all', phrase: 'Despejar {place}' },
    hunt: { label: 'Cazar', objective: 'eliminate', phrase: 'Acabar con {target} en {place}' },
    escort: { label: 'Escoltar', objective: 'escort', phrase: 'Llevar a {patron} a través de {place}' },
    recover: { label: 'Recuperar', objective: 'reach', phrase: 'Recuperar lo que quedó en {place}' },
    hold: { label: 'Aguantar', objective: 'survive', phrase: 'Aguantar en {place} hasta que llegue ayuda' },
    steal: { label: 'Robar', objective: 'reach', phrase: 'Sacar algo de {place} sin que lo noten' },
    silence: { label: 'Silenciar', objective: 'eliminate', phrase: 'Que {target} deje de hablar' },
};

/**
 * La temática del gremio, como pesos sobre las mismas tablas.
 *
 * Lo que no aparece aquí pesa 1. Un 0 no es «poco probable»: es que ese gremio no recibe
 * esos encargos, y eso es lo que hace que un gremio de asesinos se sienta distinto en vez
 * de ser el mismo tablón con otro rótulo.
 */
export const GUILD_THEMES = {
    general: { label: 'General', weights: {} },
    thieves: { label: 'Ladrones', weights: { steal: 4, recover: 2, escort: 0, hold: 0 } },
    assassins: { label: 'Asesinos', weights: { silence: 4, hunt: 2, escort: 0, cull: 0.5 } },
    mercenaries: { label: 'Mercenarios', weights: { cull: 3, hold: 3, escort: 2, steal: 0, silence: 0 } },
    wardens: { label: 'Guardabosques', weights: { hunt: 3, cull: 2, escort: 2, steal: 0, silence: 0 } },
};

/** Quién pone dinero encima de la mesa. */
const PATRONS = [
    'el concejo', 'un mercader sin nombre', 'la viuda del molinero', 'la guarnición',
    'un cura que no mira a los ojos', 'la casa Vareno', 'alguien que pagó por adelantado',
];

/**
 * @param {any} value
 * @param {number} fallback
 * @returns {number}
 */
function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * @param {() => number} random
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function between(random, min, max) {
    if (max <= min) return min;
    return min + Math.floor(random() * (max - min + 1));
}

/**
 * @template T
 * @param {() => number} random
 * @param {T[]} list
 * @returns {T}
 */
function pick(random, list) {
    return list[Math.min(list.length - 1, Math.floor(random() * list.length))];
}

/**
 * Elige una clase de trabajo respetando los pesos del gremio.
 *
 * @param {() => number} random
 * @param {Record<string, number>} weights
 * @returns {string}
 */
function pickKind(random, weights) {
    const entries = Object.keys(CONTRACT_KINDS)
        .map(kind => ({ kind, weight: Math.max(0, number(weights?.[kind], 1)) }))
        .filter(entry => entry.weight > 0);

    if (entries.length === 0) return 'cull';

    const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
    let ticket = random() * total;
    for (const entry of entries) {
        ticket -= entry.weight;
        if (ticket <= 0) return entry.kind;
    }
    return entries[entries.length - 1].kind;
}

/**
 * Qué rangos puede ofrecer alguien con esta reputación.
 *
 * Se ofrece **uno por encima** del que te corresponde, a propósito: el tablón tiene que
 * enseñar siempre algo que todavía no deberías coger. Es lo que hace que la reputación se
 * sienta como una puerta y no como un número.
 *
 * @param {number} renown
 * @returns {typeof RANKS}
 */
export function ranksFor(renown) {
    const earned = RANKS.filter(rank => number(renown) >= rank.minRenown);
    const next = RANKS[earned.length];
    return next ? [...earned, next] : earned;
}

/**
 * Llena un tablón.
 *
 * @param {Object} [options]
 * @param {() => number} [options.random]
 * @param {number} [options.count]
 * @param {number} [options.renown]     Lo que el gremio ha ganado a pulso.
 * @param {string} [options.theme]      De qué va este gremio.
 * @param {string[]} [options.places]   Sitios del mundo que ya existen.
 * @param {string[]} [options.bestiary] Para los encargos que nombran a un bicho.
 * @param {number} [options.day]        El día de hoy, para los vencimientos.
 * @returns {Contract[]}
 */
export function generateBoardOfContracts(options = {}) {
    const random = typeof options.random === 'function' ? options.random : Math.random;
    const theme = GUILD_THEMES[options.theme ?? 'general'] ?? GUILD_THEMES.general;
    const available = ranksFor(number(options.renown, 0));
    const places = (Array.isArray(options.places) ? options.places : []).filter(Boolean);
    const bestiary = (Array.isArray(options.bestiary) ? options.bestiary : []).filter(Boolean);
    const today = Math.max(1, Math.floor(number(options.day, 1)));
    const wanted = Math.max(1, Math.floor(number(options.count, 4)));

    /** @type {Contract[]} */
    const contracts = [];

    for (let i = 0; i < wanted; i++) {
        const rank = pick(random, available);
        let kind = pickKind(random, theme.weights);

        // Un encargo que nombra a un bicho necesita un bestiario. Sin el, se cambia por
        // uno que no lo necesite en vez de ofrecer "acabar con undefined".
        if (!bestiary.length && (kind === 'hunt' || kind === 'silence')) kind = 'cull';

        const place = places.length > 0 ? pick(random, places) : 'el yermo';
        const target = bestiary.length > 0 ? pick(random, bestiary) : '';
        const patron = pick(random, PATRONS);

        const title = CONTRACT_KINDS[kind].phrase
            .replace('{place}', place)
            .replace('{target}', target)
            .replace('{patron}', patron);

        contracts.push({
            id: `c_${rank.id}_${i}_${Math.floor(random() * 100000)}`,
            rank: rank.id,
            kind,
            title,
            locationName: places.includes(place) ? place : '',
            reward: between(random, rank.reward[0], rank.reward[1]),
            days: today + between(random, rank.days[0], rank.days[1]),
            difficulty: rank.difficulty,
            patron,
        });
    }

    return contracts;
}

/**
 * Lo que queda de plazo, y si ya se pasó.
 *
 * @param {Contract} contract
 * @param {number} today
 * @returns {{daysLeft: number, expired: boolean, urgent: boolean}}
 */
export function deadlineOf(contract, today) {
    const daysLeft = Math.floor(number(contract?.days)) - Math.max(1, Math.floor(number(today, 1)));
    return { daysLeft, expired: daysLeft < 0, urgent: daysLeft >= 0 && daysLeft <= 2 };
}

/**
 * Quita del tablón lo que ya venció, y dice qué se cayó.
 *
 * Un encargo caducado no se borra en silencio: dejar pasar un plazo es una decisión que
 * tomaste —aunque fuera por no mirar— y merece decirse.
 *
 * @param {Contract[]} board
 * @param {number} today
 * @returns {{kept: Contract[], expired: Contract[]}}
 */
export function expireContracts(board, today) {
    const list = Array.isArray(board) ? board : [];
    return {
        kept: list.filter(contract => !deadlineOf(contract, today).expired),
        expired: list.filter(contract => deadlineOf(contract, today).expired),
    };
}

/**
 * Un encargo, dicho como se lee en el tablón.
 *
 * @param {Contract} contract
 * @param {number} [today]
 * @returns {string}
 */
export function describeContract(contract, today = 1) {
    const { daysLeft, expired } = deadlineOf(contract, today);
    const when = expired ? 'vencido' : `${daysLeft} día(s)`;
    return `[${contract.rank}] ${contract.title} — ${contract.reward} de oro · ${when} · ${contract.patron}`;
}
