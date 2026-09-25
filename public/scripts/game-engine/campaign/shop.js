/**
 * La tienda (fase L5) y lo que se hace en ella: vender la chatarra, regatear, precios que se
 * explican y género que cambia cada semana (ideas 118, 126, 127 y 134).
 *
 * - **Qué hay**: cada semana, lo que traiga el carro. Sale de la semilla del mundo, del sitio y
 *   de la semana, así que dos partidas iguales ven la misma tienda. Quien os aprecia saca algo
 *   de la trastienda.
 * - **Cuánto cuesta**: el precio de la cosa, por lo caro que esté el sitio (caminos cerrados,
 *   peajes: `economy.js`), por lo que os aprecie quien manda (`priceFactor`) y por lo que
 *   hayáis regateado. Y se dice por qué, parte a parte.
 * - **Vender**: a un 40 % de lo que vale. Lo que llevas puesto, las llaves y lo que no tiene
 *   precio no se vende.
 *
 * Puro: decide precios y surtido. Quien llama cobra, paga y guarda.
 */

/** Lo que vale cada tipo de cosa, en oro. */
export const PRICE_BY_KIND = {
    potion: 25, consumable: 4, tool: 8, ammunition: 2,
    simple_melee: 8, simple_ranged: 20, martial_melee: 18, martial_ranged: 40,
    light: 25, medium: 60, heavy: 150, shield: 10,
    wondrous: 70, ring: 90, scroll: 40, generic: 5,
    // Idea 122: el aceite y la red. Caros para ser trastos: deciden un combate.
    throwable: 10,
};

/** Cuánto multiplica la rareza. */
const RARITY = { common: 1, comun: 1, uncommon: 2, 'poco común': 2, rare: 5, raro: 5, 'very rare': 12, legendary: 30 };

/** Lo que pagan por lo que vendes: menos de lo que vale, como en todas partes. */
export const SELL_SHARE = 0.4;

/** Lo que rebaja un buen regateo, y lo que dura: el día, en esa tienda. */
export const HAGGLE_DISCOUNT = 0.15;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim().toLowerCase();

/**
 * Lo que vale una cosa, sin tienda ni regateo.
 *
 * @param {{category?: string, subcategory?: string, rarity?: string, name?: string}} item
 * @returns {number}
 */
export function basePrice(item) {
    const sub = text(item?.subcategory);
    const cat = text(item?.category);
    const base = PRICE_BY_KIND[/** @type {keyof typeof PRICE_BY_KIND} */ (sub)]
        ?? (cat === 'weapon' ? 12 : cat === 'armor' ? 40 : cat === 'magic' ? 70 : PRICE_BY_KIND.generic);
    const rarity = RARITY[/** @type {keyof typeof RARITY} */ (text(item?.rarity))] ?? (cat === 'magic' ? 2 : 1);
    return Math.max(1, Math.round(base * rarity));
}

/**
 * Qué hay en la tienda esta semana.
 *
 * @param {Object} input
 * @param {string[]} input.names Lo que puede traer el carro.
 * @param {(name: string) => any} input.describe De nombre a objeto (tipo, rareza).
 * @param {() => number} input.random Con la semilla del mundo, del sitio y de la semana.
 * @param {number} [input.reputation] Lo que os aprecia quien manda aquí.
 * @param {string[]} [input.always] Lo que hay siempre, delante y aparte de lo de la semana.
 * @returns {string[]} Los nombres, sin repetir.
 */
export function weeklyStock({ names, describe, random, reputation = 0, always = [] }) {
    const fixed = [...new Set(always || [])];
    const pool = [...new Set(names || [])].filter(n => !fixed.includes(n));
    const common = pool.filter(n => text(describe(n)?.category) !== 'magic');
    const rare = pool.filter(n => text(describe(n)?.category) === 'magic');
    /** @type {string[]} */
    const out = [];
    const take = (/** @type {string[]} */ from, /** @type {number} */ count) => {
        const left = from.filter(n => !out.includes(n));
        for (let i = 0; i < count && left.length > 0; i++) {
            out.push(left.splice(Math.floor(random() * left.length) % left.length, 1)[0]);
        }
    };
    take(common, 4);
    take(rare, 1);
    // De la trastienda, para quien se lo ha ganado.
    if (Number(reputation) >= 2) take(rare, 1);
    return [...fixed, ...out];
}

/**
 * El precio de hoy aquí, y por qué, parte a parte (idea 127).
 *
 * @param {Object} input
 * @param {number} input.base
 * @param {number} [input.market] Lo caro que está el sitio (1 = normal).
 * @param {string[]} [input.marketReasons]
 * @param {number} [input.standing] Factor por reputación (1 = normal; 0,9 = un 10 % menos).
 * @param {string} [input.ruler] Quién manda aquí, para decirlo.
 * @param {boolean} [input.haggled] Si hoy se ha regateado bien aquí.
 * @param {boolean} [input.festival] Si hoy es fiesta aquí (idea 89).
 * @param {{discount: number, label: string}} [input.fame] Lo que os conocen aquí (idea 52).
 * @returns {{price: number, reasons: string[]}}
 */
export function priceToday({ base, market = 1, marketReasons = [], standing = 1, ruler = '', haggled = false, festival = false, fame = { discount: 0, label: '' } }) {
    let factor = 1;
    /** @type {string[]} */
    const reasons = [];
    const pct = (/** @type {number} */ f) => `${f > 1 ? '+' : '−'}${Math.round(Math.abs(f - 1) * 100)} %`;
    if (Number(market) !== 1 && Number(market) > 0) {
        factor *= Number(market);
        reasons.push(`${pct(Number(market))}: ${marketReasons.join(' ') || 'el sitio está caro'}`);
    }
    if (Number(standing) !== 1 && Number(standing) > 0) {
        factor *= Number(standing);
        reasons.push(`${pct(Number(standing))}: ${Number(standing) < 1 ? `${ruler || 'quien manda'} os aprecia` : `${ruler || 'quien manda'} no os quiere aquí`}`);
    }
    if (festival) {
        factor *= 0.9;
        reasons.push('−10 %: es día de fiesta');
    }
    if (Number(fame?.discount) > 0) {
        factor *= 1 - Number(fame.discount);
        reasons.push(`−${Math.round(Number(fame.discount) * 100)} %: aquí ${fame.label}`);
    }
    if (haggled) {
        factor *= 1 - HAGGLE_DISCOUNT;
        reasons.push(`−${Math.round(HAGGLE_DISCOUNT * 100)} %: habéis regateado`);
    }
    return { price: Math.max(1, Math.round(Number(base) * factor)), reasons };
}

/**
 * Lo que pagan por algo tuyo.
 *
 * @param {any} item
 * @returns {number}
 */
export function sellPrice(item) {
    return Math.max(1, Math.floor(basePrice(item) * SELL_SHARE));
}

/**
 * Si algo se puede vender: ni lo puesto, ni las llaves, ni lo que es de la historia.
 *
 * @param {any} item
 * @param {any} member
 * @returns {boolean}
 */
export function canSell(item, member) {
    if (!item?.id) return false;
    const worn = Object.values(member?.equippedItems ?? {}).includes(item.id);
    return !worn && !/llave|ganz[uú]a/i.test(String(item.name ?? '')) && !item.quest;
}

/**
 * La chatarra de todo el grupo (idea 118): lo común que no lleva nadie puesto.
 *
 * @param {any[]} party
 * @returns {Array<{memberId: string, itemId: string, name: string, price: number}>}
 */
export function junkOf(party) {
    return (party || []).flatMap(member => (Array.isArray(member?.items) ? member.items : [])
        .filter((/** @type {any} */ item) => canSell(item, member) && text(item.category) !== 'magic'
            && !['rare', 'raro', 'very rare', 'legendary'].includes(text(item.rarity))
            // Lo que se gasta (el aceite, la red) no es chatarra, y una reliquia (idea 132) tampoco.
            && !item.consumable && !item.relic)
        .map((/** @type {any} */ item) => ({ memberId: String(member.id), itemId: String(item.id), name: String(item.name), price: sellPrice(item) })));
}
