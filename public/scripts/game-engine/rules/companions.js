/**
 * Por qué alguien va contigo, y por qué a veces no.
 *
 * El modo un jugador no consiste en esconder botones. Si lo único que cambia es que no
 * puedes mover a Brand, es el mismo juego con menos manos. Lo que tiene que cambiar es que
 * Brand **decida**, y para eso hace falta algo que casi nunca se construye:
 *
 * > **Un compañero que te dice que no solo es divertido si entiendes por qué.** Si se
 * > queda en casa y no sabes si fue por el vínculo, por la paga, por el rango del encargo
 * > o porque odia a los no-muertos, no has recibido una decisión: has recibido un error.
 *
 * Así que esto no devuelve nunca un booleano a secas. Devuelve **el motivo**, en una frase
 * que se puede leer, y lo devuelve también cuando la respuesta es que sí — porque saber
 * *por qué* alguien acepta es lo que te enseña a formar el grupo siguiente.
 *
 * Y lo hace todo con datos que el juego ya tiene: el vínculo, la lealtad, el motivo por el
 * que te sigue, sus heridas y el rango del encargo. Nada de esto es una tirada.
 *
 * Puro: decide y explica. Ni forma grupos, ni mueve a nadie, ni narra.
 *
 * Ver wiki/ROADMAP_MAESTRO.md, Nivel 5.
 */

import { motiveOf } from './mortality.js';
import { readInjuries } from './injuries.js';

/** Quién lleva a quién. Se elige al crear la campaña. */
export const MODES = {
    /** Llevas al tuyo; los demás deciden por su cuenta. */
    SOLO: 'solo',
    /** Los mueves a todos, como hasta ahora. */
    GROUP: 'group',
};

/** Lo que trae una campaña que no dice nada: lo de siempre. */
export const DEFAULT_MODE = MODES.GROUP;

/** Qué busca alguien. Decide qué encargos le tiran y cuáles le dan igual. */
export const WANTS = {
    coin: { label: 'oro', likes: ['steal', 'recover'], rankBias: 0 },
    glory: { label: 'gloria', likes: ['hunt', 'hold'], rankBias: 1 },
    blood: { label: 'sangre', likes: ['cull', 'hunt', 'silence'], rankBias: 1 },
    quiet: { label: 'tranquilidad', likes: ['escort', 'recover'], rankBias: -1 },
    knowledge: { label: 'saber', likes: ['recover'], rankBias: 0 },
};

/** Cuánta herida encima hace que alguien prefiera quedarse. */
export const TOO_HURT = 2;

/**
 * @typedef {Object} Reasons
 * @property {string} wants     Una de `WANTS`.
 * @property {string} hates     Un nombre: una facción, un bicho, una persona.
 * @property {string} profile   Cómo pelea cuando decide él.
 * @property {number} loyalty
 * @property {number} bond
 * @property {'coin'|'bond'} motive
 */

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
 * Las razones de alguien, leídas de su ficha.
 *
 * Lo que no esté escrito se rellena con lo más neutro, nunca con lo más dramático: una
 * partida que ya venía jugándose no tiene ninguno de estos campos, y estrenar la regla
 * con medio grupo negándose a salir sería el peor debut posible.
 *
 * @param {any} member
 * @returns {Reasons}
 */
export function readReasons(member) {
    const raw = (member?.reasons && typeof member.reasons === 'object') ? member.reasons : {};
    const wants = String(raw.wants ?? '');

    return {
        wants: wants in WANTS ? wants : 'coin',
        hates: String(raw.hates ?? '').trim(),
        profile: String(raw.profile ?? '').trim() || 'aggressive',
        loyalty: number(member?.loyalty, 3),
        bond: number(member?.bondRank ?? raw.bond, 0),
        motive: motiveOf(member),
    };
}

/**
 * Si alguien acepta ir a este encargo, y por qué.
 *
 * El orden importa: primero lo que impide ir —estar roto, no cobrar— y después lo que
 * anima. Un «no» por dos motivos distintos se explica por el primero, que es el que hay
 * que arreglar.
 *
 * @param {any} member
 * @param {any} contract
 * @param {{rankOrder?: string[]}} [context]
 * @returns {{joins: boolean, reason: string, eagerness: number}}
 */
export function willJoin(member, contract, context = {}) {
    const reasons = readReasons(member);
    const name = String(member?.name ?? 'Alguien');
    const kind = String(contract?.kind ?? '');
    const order = Array.isArray(context.rankOrder) ? context.rankOrder : ['D', 'C', 'B', 'A', 'S'];
    const rankIndex = Math.max(0, order.indexOf(String(contract?.rank ?? 'D')));

    // 1. Lo que impide ir, diga lo que diga el resto.
    const wounds = readInjuries(member).length;
    if (wounds >= TOO_HURT) {
        return { joins: false, reason: `${name} arrastra demasiadas heridas para salir.`, eagerness: -10 };
    }
    if ((Number(member?.hp) || 0) <= 0) {
        return { joins: false, reason: `${name} no está en condiciones de ir a ninguna parte.`, eagerness: -10 };
    }
    if (reasons.motive === 'coin' && reasons.loyalty <= 1) {
        return {
            joins: false,
            reason: `${name} lleva demasiado sin cobrar como para arriesgarse por ti.`,
            eagerness: -5,
        };
    }

    // 2. Lo que anima o echa para atrás.
    let eagerness = 0;
    /** @type {string[]} */
    const because = [];

    const want = WANTS[reasons.wants];
    if (want?.likes.includes(kind)) {
        eagerness += 2;
        because.push(`busca ${want.label}`);
    }

    // El rango: quien busca gloria quiere lo difícil, quien quiere tranquilidad no.
    const stretch = rankIndex - 1 - number(want?.rankBias);
    if (stretch > 1) {
        eagerness -= 2;
        because.push('le parece demasiado grande');
    } else if (stretch < 0 && want?.rankBias > 0) {
        eagerness -= 1;
        because.push('le parece poca cosa');
    }

    // El odio manda sobre lo demás: quien odia a los Cuervos va contra los Cuervos.
    const mentions = `${contract?.title ?? ''} ${contract?.patron ?? ''} ${contract?.locationName ?? ''}`;
    if (reasons.hates && mentions.toLowerCase().includes(reasons.hates.toLowerCase())) {
        eagerness += 3;
        because.push(`odia a ${reasons.hates}`);
    }

    // El vínculo pesa: a partir de cierto punto van contigo aunque no les convenza.
    if (reasons.bond >= 2) {
        eagerness += 1;
        because.push('va contigo de todas formas');
    }
    if (reasons.motive === 'coin' && number(contract?.reward) >= 150) {
        eagerness += 1;
        because.push('paga bien');
    }

    const joins = eagerness >= 0;
    const why = because.length > 0 ? because.join(', ') : 'no le dice nada';
    return {
        joins,
        reason: joins ? `${name} se apunta: ${why}.` : `${name} se queda: ${why}.`,
        eagerness,
    };
}

/**
 * Quién va a este encargo, y quién no, con su motivo cada uno.
 *
 * Los que más ganas tienen van primero. Que el grupo salga ordenado por ganas y no por el
 * orden de la lista es lo que hace que las razones se noten.
 *
 * @param {any[]} roster
 * @param {any} contract
 * @param {{max?: number, rankOrder?: string[]}} [options]
 * @returns {{going: any[], staying: any[], lines: string[]}}
 */
export function formParty(roster, contract, options = {}) {
    const people = Array.isArray(roster) ? roster : [];
    const max = Math.max(1, Math.floor(number(options.max, 4)));

    const judged = people.map(member => ({ member, verdict: willJoin(member, contract, options) }));
    const willing = judged
        .filter(entry => entry.verdict.joins)
        .sort((a, b) => b.verdict.eagerness - a.verdict.eagerness);

    const going = willing.slice(0, max).map(entry => entry.member);
    const goingNames = new Set(going.map(m => String(m?.name ?? '')));

    return {
        going,
        staying: people.filter(member => !goingNames.has(String(member?.name ?? ''))),
        lines: judged.map(entry => entry.verdict.reason),
    };
}

/**
 * @param {any} rules
 * @returns {string}
 */
export function readMode(rules) {
    const mode = String(rules?.mode ?? '');
    return Object.values(MODES).includes(mode) ? mode : DEFAULT_MODE;
}

/**
 * Si puedes mover a alguien tú mismo.
 *
 * En solo llevas al tuyo y los demás se llevan solos. El primero de la lista es el tuyo:
 * es el que ya manda en el resto del juego —habla por ti, abre las puertas— así que
 * cambiar eso aquí sería inventar un concepto nuevo para nada.
 *
 * @param {any} member
 * @param {any[]} party
 * @param {any} [rules]
 * @returns {{allowed: boolean, reason: string}}
 */
export function canControl(member, party, rules = null) {
    if (readMode(rules) === MODES.GROUP) return { allowed: true, reason: '' };

    const first = (Array.isArray(party) ? party : [])[0];
    if (first && String(first.id) === String(member?.id)) return { allowed: true, reason: '' };

    const name = String(member?.name ?? 'Ese');
    return { allowed: false, reason: `${name} se lleva solo: en esta campaña cada uno decide lo suyo.` };
}

/**
 * El modo, en una línea, para enseñarlo donde se eligió.
 *
 * @param {any} rules
 * @returns {string}
 */
export function describeMode(rules) {
    return readMode(rules) === MODES.SOLO
        ? 'Llevas al tuyo; los demás deciden por su cuenta'
        : 'Los llevas a todos';
}
