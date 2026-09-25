/**
 * El encargo personal de cada compañero, al llegar a vínculo 3 (idea 30).
 *
 * Hasta aquí un compañero te seguía en tu historia y no tenía la suya. Ahora, cuando el
 * vínculo llega a 3, te pide algo: una deuda que cobrar, alguien con quien batirse, una
 * venganza, a alguien que poner a salvo o algo que se perdió. Sale de lo que busca y de
 * a quién odia, y va al tablón como un encargo más, con su nombre.
 *
 * Cumplirlo pesa: un encargo personal cuenta el doble para el vínculo.
 *
 * Puro: decide cuándo toca y qué pide. Quien llama lo pone en el tablón y lo paga.
 */

/** El rango en el que pide lo suyo. */
export const PERSONAL_RANK = 3;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Lo que pide cada deseo: el verbo del tablón y cómo se dice.
 *
 * @type {Record<string, {kind: string, phrase: string, withTarget?: string}>}
 */
const ASKS = {
    coin: { kind: 'recover', phrase: '{name} quiere cobrarse una deuda en {place}' },
    glory: { kind: 'cull', phrase: '{name} quiere demostrar lo que vale en {place}', withTarget: '{name} quiere batirse con {target} en {place}' },
    blood: { kind: 'cull', phrase: '{name} quiere cobrarse una venganza en {place}', withTarget: '{name} quiere hacérselo pagar a {target} en {place}' },
    quiet: { kind: 'escort', phrase: '{name} quiere poner a salvo a uno de los suyos, camino de {place}' },
    knowledge: { kind: 'recover', phrase: '{name} busca algo que se le perdió en {place}' },
};

/**
 * Quién tiene ya vínculo para pedir lo suyo y aún no lo ha pedido.
 *
 * @param {Object} input
 * @param {any[]} input.party El grupo, con el héroe primero.
 * @param {(member: any) => number} input.rankOf
 * @param {string[]} input.asked Los ids a los que ya se les ofreció.
 * @returns {any[]}
 */
export function duePersonalQuests({ party, rankOf, asked }) {
    const done = new Set((Array.isArray(asked) ? asked : []).map(String));
    return (Array.isArray(party) ? party : []).slice(1)
        .filter(m => m && !m.dead && !done.has(String(m.id)) && rankOf(m) >= PERSONAL_RANK);
}

/**
 * El encargo que pide alguien.
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {string} input.wants Lo que busca.
 * @param {string} [input.hates] A quién odia.
 * @param {string[]} input.places Los sitios conocidos.
 * @param {string} [input.here] Donde está el grupo: el encargo es en otro sitio.
 * @param {string[]} [input.bestiary]
 * @param {() => number} input.random
 * @param {number} input.day
 * @returns {any}
 */
export function personalQuestFor({ member, wants, hates = '', places, here = '', bestiary = [], random, day }) {
    const ask = ASKS[text(wants)] ?? ASKS.coin;
    const away = (Array.isArray(places) ? places : []).map(text).filter(p => p && p !== text(here));
    const pool = away.length > 0 ? away : (Array.isArray(places) ? places : []).map(text).filter(Boolean);
    const place = pool.length > 0 ? pool[Math.floor(random() * pool.length) % pool.length] : 'el camino';
    const beasts = (Array.isArray(bestiary) ? bestiary : []).map(text).filter(Boolean);
    const target = text(hates) || (ask.withTarget && beasts.length > 0 ? beasts[Math.floor(random() * beasts.length) % beasts.length] : '');
    const name = text(member?.name) || 'Alguien';
    const phrase = target && ask.withTarget ? ask.withTarget : ask.phrase;
    const title = phrase.replace('{name}', name).replace('{place}', place).replace('{target}', target);
    const today = Math.max(1, Math.floor(Number(day) || 1));
    return {
        id: `p_${String(member?.id ?? name)}`,
        rank: 'C',
        kind: ask.withTarget && target ? 'hunt' : ask.kind,
        title,
        locationName: place,
        reward: 60 + Math.floor(random() * 31),
        days: today + 14,
        difficulty: 1,
        patron: name,
        personal: String(member?.id ?? ''),
    };
}

/**
 * Cómo se dice que alguien pide lo suyo.
 *
 * @param {any} member
 * @param {any} contract
 * @returns {string}
 */
export function describePersonalAsk(member, contract) {
    return `${text(member?.name) || 'Alguien'} tiene algo que pedirte: ${text(contract?.title)}. Está en el tablón, con su nombre.`;
}
