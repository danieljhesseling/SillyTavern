/**
 * Lo que sale al paso por el camino: atajos, cazarrecompensas, mercaderes y paradas (ideas 72,
 * 88, 92 y 71).
 *
 * - **Atajos** (72): a veces, al oír un rumor, alguien menciona un camino de pastores. El
 *   camino desde aquí a un sitio lejano se queda un día más corto, para siempre.
 * - **Cazarrecompensas** (88): quien se ha ganado el odio de una facción (reputación −3 o
 *   menos) puede encontrarse con gente cobrando la cabeza del grupo. Pagar o plantar cara.
 * - **Mercader ambulante** (92): alguien con género raro. Se compra o se sigue.
 * - **Paradas del camino** (71): un pozo, un santuario, una venta o un refugio de pastores.
 *   Cosas pequeñas que tocan números que ya existen: la sed, la vida, el hambre, el sueño.
 *
 * Todo con el azar que se pase, que es el de la semilla del viaje: el mismo viaje sale igual.
 *
 * Puro: decide si pasa y qué ofrece.
 */

/** Lo probable que es cada cosa: un atajo al oír un rumor, y lo que sale al paso en un viaje. */
export const ROAD_CHANCE = { shortcut: 0.3, bounty: 0.35, merchant: 0.2, stop: 0.35 };

/**
 * Las paradas del camino (idea 71): lo que hay, lo que se dice y lo que hace.
 *
 * `relieve` es lo que se pone a cero de las necesidades (`needs.js`); `heal`, los dados que
 * recupera cada uno; `cost`, el oro por cabeza, si lo hay.
 *
 * @type {Record<string, {name: string, note: string, relieve?: Array<'ate'|'drank'|'slept'>, heal?: string, cost?: number}>}
 */
export const STOPS = {
    pozo: { name: 'Un pozo de agua clara', note: 'Bebéis hasta hartaros y llenáis los odres.', relieve: ['drank'] },
    santuario: { name: 'Un santuario del camino', note: 'Un rato a la sombra de las piedras: las heridas escuecen menos.', heal: '1d4' },
    venta: { name: 'Una venta en el cruce', note: 'Comida caliente, a una moneda por cabeza.', relieve: ['ate'], cost: 1 },
    refugio: { name: 'Un refugio de pastores', note: 'Paredes de piedra y un fuego: dormís de un tirón.', relieve: ['slept'] },
};

/**
 * Si el viaje tiene parada, y cuál (idea 71).
 *
 * Con el azar del viaje: el mismo camino tiene la misma parada. Un viaje largo tiene más
 * donde parar que uno de un día.
 *
 * @param {Object} input
 * @param {number} input.days
 * @param {() => number} input.random
 * @returns {{id: string, name: string, note: string, relieve: Array<'ate'|'drank'|'slept'>, heal: string, cost: number}|null}
 */
export function roadStop({ days, random }) {
    const chance = Math.min(1, ROAD_CHANCE.stop * (Number(days) >= 2 ? 1.5 : 1));
    if (random() >= chance) return null;
    const ids = Object.keys(STOPS);
    const id = ids[Math.floor(random() * ids.length) % ids.length];
    const stop = STOPS[id];
    return { id, name: stop.name, note: stop.note, relieve: stop.relieve ?? [], heal: stop.heal ?? '', cost: stop.cost ?? 0 };
}

/** Desde qué reputación mandan a cobrar la cabeza del grupo. */
export const BOUNTY_AT = -3;

/**
 * Un atajo desde un sitio, si toca.
 *
 * Primero, el camino directo más largo desde aquí baja un día. Si todos son de un día, el
 * atajo es un camino de pastores nuevo hacia un sitio que estaba a dos tramos: un día menos
 * que dar el rodeo.
 *
 * @param {Object} input
 * @param {any[]} input.locations
 * @param {string} input.from
 * @param {() => number} input.random
 * @returns {{from: string, to: string, days: number}|null} El camino, con sus días nuevos.
 */
export function findShortcut({ locations, from, random }) {
    if (random() >= ROAD_CHANCE.shortcut) return null;
    const same = (/** @type {any} */ a, /** @type {any} */ b) => String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();
    const find = (/** @type {string} */ name) => (locations || []).find(l => same(l?.name, name));
    const open = (/** @type {any} */ place) => (Array.isArray(place?.routes) ? place.routes : []).filter((/** @type {any} */ r) => !r?.closed);
    const here = find(from);
    if (!here) return null;

    const longest = open(here)
        .filter((/** @type {any} */ r) => !r?.shortcut && Number(r?.days) >= 2)
        .sort((/** @type {any} */ a, /** @type {any} */ b) => Number(b.days) - Number(a.days))[0];
    if (longest) return { from: String(here.name), to: String(longest.to), days: Number(longest.days) - 1 };

    // A dos tramos: por donde se pasa y adonde se llega, sin camino directo todavía.
    /** @type {Array<{to: string, days: number}>} */
    const around = [];
    for (const first of open(here)) {
        for (const second of open(find(first.to))) {
            if (same(second.to, here.name) || open(here).some((/** @type {any} */ r) => same(r.to, second.to))) continue;
            around.push({ to: String(second.to), days: Number(first.days) + Number(second.days) });
        }
    }
    const far = around.sort((a, b) => b.days - a.days || a.to.localeCompare(b.to))[0];
    return far && far.days >= 2 ? { from: String(here.name), to: far.to, days: far.days - 1 } : null;
}

/**
 * Poner el atajo en el mapa: el camino, en los dos sentidos, más corto (o nuevo).
 *
 * @param {any[]} locations
 * @param {{from: string, to: string, days: number}} shortcut
 * @returns {any[]}
 */
export function applyShortcut(locations, shortcut) {
    const same = (/** @type {any} */ a, /** @type {string} */ b) => String(a ?? '').toLowerCase() === b.toLowerCase();
    return (locations || []).map(l => {
        const other = same(l?.name, shortcut.from) ? shortcut.to : same(l?.name, shortcut.to) ? shortcut.from : '';
        if (!other) return l;
        const routes = Array.isArray(l.routes) ? l.routes : [];
        const exists = routes.some((/** @type {any} */ r) => same(r?.to, other));
        return {
            ...l,
            routes: exists
                ? routes.map((/** @type {any} */ r) => (same(r?.to, other)
                    ? { ...r, days: Math.max(1, Math.min(Number(r.days) || 1, shortcut.days)), shortcut: true }
                    : r))
                : [...routes, { to: other, days: Math.max(1, shortcut.days), shortcut: true }],
        };
    });
}

/**
 * Lo que sale al paso en un viaje, si sale algo.
 *
 * @param {Object} input
 * @param {Array<{id: string, name: string, reputation: number}>} input.factions
 * @param {string[]} input.goods Objetos que un mercader puede traer.
 * @param {() => number} input.random
 * @param {number} [input.discount] Del 0 al 1: lo que rebaja quien regatea.
 * @returns {{kind: 'bounty', faction: string, toll: number, dc: number}
 *   | {kind: 'merchant', item: string, price: number}
 *   | null}
 */
export function roadEncounter({ factions, goods, random, discount = 0 }) {
    const angry = (factions || []).filter(f => Number(f?.reputation) <= BOUNTY_AT)
        .sort((a, b) => Number(a.reputation) - Number(b.reputation))[0];
    if (angry && random() < ROAD_CHANCE.bounty) {
        const hate = Math.abs(Number(angry.reputation));
        return { kind: 'bounty', faction: String(angry.name), toll: 10 * hate, dc: 10 + hate };
    }
    if ((goods || []).length > 0 && random() < ROAD_CHANCE.merchant) {
        const item = goods[Math.floor(random() * goods.length) % goods.length];
        const price = Math.max(5, Math.round(50 * (1 - Math.max(0, Math.min(1, Number(discount) || 0)))));
        return { kind: 'merchant', item, price };
    }
    return null;
}
