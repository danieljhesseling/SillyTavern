/**
 * Precios que se mueven con la estación, y la magia donde la persiguen (T4 de wiki/LO_QUE_FALTA.md).
 *
 * La tienda ya subía el acero con la guerra (idea 84) y bajaba lo que os vende quien os
 * aprecia. Faltaban dos cosas que se notan al viajar:
 *
 * - **La estación**: en invierno la comida escasea y el abrigo se paga; en otoño hay cosecha;
 *   en verano nadie quiere mantas.
 * - **La magia donde la persiguen**: si quien manda aquí persigue la magia, los componentes
 *   no se venden (hay que ir a otra parte, o saber a quién preguntar). Donde la magia es
 *   negocio, salen más baratos.
 *
 * Cómo ve la magia una facción es un dato suyo (`magia: persigue | tolera | comercia`), que
 * escribe el Gem; si no lo dice, se deduce de sus etiquetas del compendio (la fe persigue,
 * lo arcano comercia) y, sin nada, tolera.
 *
 * Puro: devuelve un factor y sus motivos, que se suman a los del mercado.
 */

/** Lo que cambia cada estación, por clase de cosa. */
export const SEASON_PRICES = {
    invierno: { comida: 1.25, abrigo: 1.2 },
    otono: { comida: 0.9 },
    verano: { abrigo: 0.85 },
    primavera: {},
};

/** Cómo se dice el porqué. */
const SEASON_WORDS = {
    invierno: { comida: 'en invierno la comida escasea', abrigo: 'en invierno el abrigo se paga' },
    otono: { comida: 'es tiempo de cosecha' },
    verano: { abrigo: 'en verano nadie quiere mantas' },
};

/** Donde la magia es negocio, los componentes salen así. */
export const MAGIC_TRADE = 0.75;

/** @param {any} value @returns {string} */
const plain = (value) => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * La clase de cosa que es un objeto, a efectos de precio.
 *
 * @param {string} name
 * @param {any} spec Lo que dice de él el catálogo (`category`, `subcategory`).
 * @returns {'comida'|'abrigo'|'componente'|''}
 */
export function priceKind(name, spec) {
    if (plain(spec?.subcategory) === 'component') return 'componente';
    const said = plain(name);
    if (/raci|comida|pan\b|queso|cecina|carne|provision/.test(said)) return 'comida';
    if (/capa|manta|abrigo|pellizas?|pieles?\b/.test(said)) return 'abrigo';
    return '';
}

/**
 * Cómo ve la magia una facción.
 *
 * @param {any} faction
 * @returns {'persigue'|'tolera'|'comercia'}
 */
export function magicStance(faction) {
    const said = plain(faction?.magia ?? faction?.magic);
    if (said === 'persigue' || said === 'comercia' || said === 'tolera') return said;
    const tags = (Array.isArray(faction?.tags) ? faction.tags : []).map(plain);
    if (tags.includes('arcano')) return 'comercia';
    if (tags.includes('fe') && !tags.includes('secreto')) return 'persigue';
    return 'tolera';
}

/**
 * Lo que la estación y la magia le hacen al precio de algo, aquí y hoy.
 *
 * @param {Object} input
 * @param {string} input.name
 * @param {any} [input.spec]
 * @param {string} [input.season] `primavera`, `verano`, `otono` o `invierno`.
 * @param {'persigue'|'tolera'|'comercia'} [input.magic] Cómo ve la magia quien manda aquí.
 * @param {string} [input.ruler] Su nombre, para decirlo.
 * @returns {{factor: number, reasons: string[], banned: boolean}}
 */
export function seasonalMarket({ name, spec = null, season = '', magic = 'tolera', ruler = '' }) {
    const kind = priceKind(name, spec);
    /** @type {string[]} */
    const reasons = [];
    let factor = 1;
    if (kind === 'componente') {
        if (magic === 'persigue') return { factor: 1, reasons: [`aquí ${ruler || 'quien manda'} persigue la magia: no se vende`], banned: true };
        if (magic === 'comercia') {
            factor *= MAGIC_TRADE;
            reasons.push(`aquí la magia es negocio${ruler ? ` (${ruler})` : ''}`);
        }
    }
    const byKind = /** @type {Record<string, Record<string, number>>} */ (SEASON_PRICES)[plain(season)] ?? {};
    if (kind && byKind[kind]) {
        factor *= byKind[kind];
        const words = /** @type {Record<string, Record<string, string>>} */ (SEASON_WORDS)[plain(season)]?.[kind];
        if (words) reasons.push(words);
    }
    return { factor: Math.round(factor * 100) / 100, reasons, banned: false };
}
