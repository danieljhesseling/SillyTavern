/**
 * E8.1 de wiki/ROADMAP_ENTRETENIDO.md: las campañas por tramos de nivel, como las aventuras
 * oficiales de 5e.
 *
 * El manual divide el juego en cuatro tramos: del 1 al 4 se salva una aldea, del 5 al 10 un
 * reino, del 11 al 16 se pesa en el destino de un continente y del 17 al 20 en el del mundo.
 * Una campaña es del tramo de su nivel de entrada; corta o larga, cabe en cualquiera.
 *
 * El tablón ofrece primero las de tu tramo y, detrás, las demás en su orden de siempre: nada
 * se esconde (quien quiera ir a Strahd a nivel 1 puede), y el ajuste de D-J56
 * (`combat/level-adjust.js`) hace el resto.
 *
 * Puro: dice de qué tramo es un nivel y ordena las tarjetas.
 */

/**
 * @typedef {Object} LevelTier
 * @property {number} id 1 a 4.
 * @property {number} min
 * @property {number} max
 * @property {string} label Cómo se dice, para quien juega.
 * @property {string} what Lo que está en juego en ese tramo, en una frase.
 */

/** @type {LevelTier[]} */
export const LEVEL_TIERS = [
    { id: 1, min: 1, max: 4, label: 'Héroes del lugar', what: 'Se salva una aldea, un valle o a su gente.' },
    { id: 2, min: 5, max: 10, label: 'Héroes del reino', what: 'Se juega la suerte de una ciudad o de un reino.' },
    { id: 3, min: 11, max: 16, label: 'Señores del reino', what: 'Se pesa en el destino de un continente.' },
    { id: 4, min: 17, max: 20, label: 'Señores del mundo', what: 'Lo que hagáis cambia el mundo entero.' },
];

/**
 * El tramo de un nivel. Por debajo del 1, el primero; por encima del 20 (los dones épicos,
 * E8.2), el último.
 *
 * @param {any} level
 * @returns {LevelTier}
 */
export function tierOf(level) {
    const n = Math.max(1, Math.floor(Number(level) || 1));
    return LEVEL_TIERS.find(tier => n >= tier.min && n <= tier.max) ?? LEVEL_TIERS[LEVEL_TIERS.length - 1];
}

/**
 * El tramo de una campaña: el de su nivel de entrada. Sin niveles escritos, ninguno (no se
 * adivina).
 *
 * @param {any} levels `[min, max]`, como en `mundos.json`.
 * @returns {LevelTier|null}
 */
export function campaignTier(levels) {
    const min = Array.isArray(levels) ? Math.floor(Number(levels[0]) || 0) : Math.floor(Number(levels) || 0);
    return min >= 1 ? tierOf(min) : null;
}

/**
 * La línea del tramo en la tarjeta: «Tramo 1 · Héroes del lugar (niveles 1 a 4)».
 *
 * @param {LevelTier|null} tier
 * @returns {string}
 */
export function tierLine(tier) {
    return tier ? `Tramo ${tier.id} · ${tier.label} (niveles ${tier.min} a ${tier.max})` : '';
}

/**
 * El tablón con las de tu tramo delante. Dentro de cada grupo se respeta el orden en que
 * venían (las del juego, las tuyas, las de semilla). Las que no dicen nivel van con las de
 * tu tramo: no hay por qué mandarlas al fondo.
 *
 * @template {{minLevel?: number}} T
 * @param {T[]} cards
 * @param {number} level El del héroe que va.
 * @returns {Array<T & {tier: number, tierLabel: string, yourTier: boolean}>}
 */
export function sortByTier(cards, level) {
    const yours = tierOf(level).id;
    const marked = (Array.isArray(cards) ? cards : []).map((card, index) => {
        const tier = campaignTier(card?.minLevel ?? 0);
        return {
            card: { ...card, tier: tier?.id ?? 0, tierLabel: tierLine(tier), yourTier: !tier || tier.id === yours },
            index,
        };
    });
    // Primero las de tu tramo; detrás, las demás por cercanía a tu tramo y en su orden.
    const distance = (/** @type {{tier: number}} */ c) => (c.tier ? Math.abs(c.tier - yours) : 0);
    return marked
        .sort((a, b) => distance(a.card) - distance(b.card) || a.index - b.index)
        .map(entry => entry.card);
}

/**
 * La línea de arriba del tablón: de qué tramo es tu grupo y qué va delante.
 *
 * @param {number} level
 * @returns {string}
 */
export function tierBoardLine(level) {
    const tier = tierOf(level);
    const n = Math.max(1, Math.floor(Number(level) || 1));
    return `Tu grupo es de nivel ${n}: tramo ${tier.id}, ${tier.label.toLowerCase()}. Delante, las campañas de tu tramo.`;
}
