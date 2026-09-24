/**
 * Los encargos que trae escritos un mundo, y cuándo salen en el tablón.
 *
 * Un mundo escrito entero (fase M) trae sus encargos con su gente, su sitio y su giro. No
 * salen todos de golpe: cada uno pertenece a un **acto** del hilo, las **cadenas** salen
 * parte a parte, y el tablón los mezcla con los generados según **la curva de la mezcla**
 * (M7): en el acto 1 casi todo es escrito, y según avanza la partida pesa más lo generado.
 *
 * Dos formas de cumplirse:
 *
 * - **Con combate**: se juega en su tablero escrito, y se entrega al ganarlo.
 * - **Sin pelear**: se resuelve en su sitio, hablando. Se da por hecho con una tirada que
 *   salga bien estando allí; lo que se diga lo decide quien juega y lo cuenta el narrador.
 *
 * Puro: decide qué se ofrece y cuándo se cumple. Quien llama paga y escribe.
 *
 * Ver wiki/ROADMAP_MUNDOS_VIVOS.md, M1 y M7.
 */

import { DEFAULT_CURVE, shareFor } from './mix.js';

/** Qué clase de trabajo es cada verbo del guion, en las del tablón. */
export const VERB_KINDS = {
    limpiar: 'cull', cazar: 'hunt', escoltar: 'escort', recuperar: 'recover', aguantar: 'hold',
    robar: 'steal', silenciar: 'silence', investigar: 'recover', negociar: 'recover', entregar: 'escort',
};

/**
 * La parte escrita de la curva de la mezcla, por acto: 80, 60, 40 y 10 %. La curva entera
 * vive en `mix.js`; aqui solo se lee, para que no haya dos sitios donde cambiarla.
 */
export const DEFAULT_MIX = {
    1: DEFAULT_CURVE[1].written, 2: DEFAULT_CURVE[2].written, 3: DEFAULT_CURVE[3].written, after: DEFAULT_CURVE.after.written,
};

/** @param {any} value */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * @typedef {Object} WrittenContract
 * @property {string} id
 * @property {string} title
 * @property {string} verb
 * @property {{id: string, part: number, of: number}|null} chain
 * @property {string} patron   Quien lo pide, por nombre.
 * @property {{id: string, against: boolean}|null} faction
 * @property {string} where    Donde se juega o se resuelve.
 * @property {number} act
 * @property {boolean} noFight
 * @property {number} reward
 * @property {string} rewardText
 * @property {string} twist
 * @property {string} boardName El tablero donde se pelea, si se pelea.
 */

/**
 * @param {any} raw
 * @returns {WrittenContract[]}
 */
export function readWrittenContracts(raw) {
    return (Array.isArray(raw) ? raw : [])
        .filter(c => c && text(c.id) && text(c.title))
        .map(c => ({
            id: text(c.id),
            title: text(c.title),
            verb: text(c.verb).toLowerCase(),
            chain: c.chain && text(c.chain.id)
                ? { id: text(c.chain.id), part: Math.max(1, Math.floor(Number(c.chain.part) || 1)), of: Math.max(1, Math.floor(Number(c.chain.of) || 1)) }
                : null,
            patron: text(c.patron),
            faction: c.faction && text(c.faction.id) ? { id: text(c.faction.id), against: Boolean(c.faction.against) } : null,
            where: text(c.where),
            act: Math.max(1, Math.min(3, Math.floor(Number(c.act) || 1))),
            noFight: Boolean(c.noFight),
            reward: Math.max(0, Math.round(Number(c.reward) || 0)),
            rewardText: text(c.rewardText),
            twist: text(c.twist),
            boardName: text(c.boardName),
        }));
}

/**
 * Qué parte de los huecos del tablón llena lo escrito.
 *
 * @param {number} act
 * @param {boolean} [ended] Si la partida ya llegó a un final.
 * @param {any} [mix] La curva del mundo, si trae una.
 * @returns {number} Entre 0 y 1.
 */
export function writtenShare(act, ended = false, mix = null) {
    return shareFor(act, ended, mix).written;
}

/**
 * Los que se pueden ofrecer ahora: de este acto o de antes, con su parte anterior hecha,
 * y que no estén ya hechos, en el tablón o aceptados.
 *
 * En orden: primero los de actos anteriores que se quedaron sin hacer, y dentro de un acto,
 * el orden en que están escritos. El guion ya pensó en qué orden van.
 *
 * @param {Object} input
 * @param {WrittenContract[]} input.contracts
 * @param {number} input.act
 * @param {string[]} [input.done]
 * @param {string[]} [input.busy] En el tablón o aceptados.
 * @returns {WrittenContract[]}
 */
export function availableWritten({ contracts, act, done = [], busy = [] }) {
    const finished = new Set(done.map(text));
    const taken = new Set(busy.map(text));
    const byChain = new Map();
    for (const c of contracts) if (c.chain) byChain.set(`${c.chain.id}#${c.chain.part}`, c.id);

    return contracts
        .map((c, index) => ({ c, index }))
        .filter(({ c }) => c.act <= act && !finished.has(c.id) && !taken.has(c.id))
        .filter(({ c }) => {
            if (!c.chain || c.chain.part <= 1) return true;
            const before = byChain.get(`${c.chain.id}#${c.chain.part - 1}`);
            return !before || finished.has(before);
        })
        .sort((a, b) => a.c.act - b.c.act || a.index - b.index)
        .map(({ c }) => c);
}

/**
 * Cuántos de los huecos del tablón le tocan a lo escrito.
 *
 * @param {Object} input
 * @param {number} input.wanted   Los huecos que tiene el tablón.
 * @param {number} input.onBoard  Los escritos que ya hay en él.
 * @param {number} input.available Los que se podrían poner.
 * @param {number} input.act
 * @param {boolean} [input.ended]
 * @param {any} [input.mix]
 * @returns {number}
 */
export function writtenSlots({ wanted, onBoard, available, act, ended = false, mix = null }) {
    const target = Math.round(Math.max(0, wanted) * writtenShare(act, ended, mix));
    return Math.max(0, Math.min(available, target - Math.max(0, onBoard)));
}

/**
 * El encargo escrito tal como va en el tablón.
 *
 * @param {WrittenContract} written
 * @param {number} today
 * @returns {any}
 */
export function toBoardContract(written, today) {
    return {
        id: written.id,
        rank: 'D',
        kind: VERB_KINDS[/** @type {keyof typeof VERB_KINDS} */ (written.verb)] ?? 'recover',
        title: written.title,
        locationName: written.where,
        reward: written.reward,
        rewardText: written.rewardText,
        // Lo escrito no corre prisa como lo generado: tiene su sitio en la historia.
        days: Math.max(1, Math.floor(Number(today) || 1)) + 21,
        difficulty: written.noFight ? 0 : 1,
        patron: written.patron || 'Alguien del valle',
        faction: written.faction?.id ?? '',
        against: Boolean(written.faction?.against),
        segments: 1,
        written: true,
        noFight: written.noFight,
        boardName: written.boardName,
        twist: written.twist,
        chain: written.chain,
    };
}

/**
 * Si un encargo sin pelea se da por hecho: una tirada que sale, estando en su sitio.
 *
 * @param {any} taken
 * @param {{place: string, success: boolean}} event
 * @returns {boolean}
 */
export function settlesNoFight(taken, { place, success }) {
    return Boolean(taken?.noFight) && Boolean(success)
        && text(place).toLowerCase() === text(taken?.locationName).toLowerCase();
}

/**
 * El encargo en una línea para el narrador, al aceptarlo.
 *
 * @param {any} contract
 * @returns {string}
 */
export function describeWrittenAccept(contract) {
    const how = contract.noFight
        ? `Se resuelve en ${contract.locationName}, sin pelear: hablando, con una tirada o pagando.`
        : `Se juega en ${contract.locationName}${contract.boardName ? ` (${contract.boardName})` : ''}.`;
    return `Encargo aceptado: «${contract.title}», lo pide ${contract.patron}. ${how}`;
}
