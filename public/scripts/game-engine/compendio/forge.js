/**
 * Forma × material = objeto.
 *
 * El catalogo de un mundo se escribia a mano, campo a campo, y por eso todos los mundos
 * tenian las mismas ocho cosas. Aqui una **forma** dice que es —daga, cota de malla,
 * farol— con los numeros que el motor juega, y un **material** la modifica: pesa distinto,
 * vale distinto y a veces hace algo. Veinticuatro formas por dieciseis materiales son
 * trescientos objetos escribiendo cuarenta filas.
 *
 * Lo que sale de aqui tiene **exactamente** los campos de la ficha de objeto del editor,
 * porque el sitio donde se escribe un objeto ya existe y no hay que inventar otro. Se
 * puede mirar, cambiar y guardar como cualquier cosa escrita a mano: eso es lo que hace
 * que esto sea una ayuda y no una caja negra.
 *
 * Puro: recibe el compendio y el azar, y devuelve un borrador.
 *
 * Ver wiki/ALGORITMOS_GENERACION.md (#109-#120) y wiki/ROADMAP_COMPENDIO.md, B2.
 */

import { fillPattern } from './names.js';

/** Lo que el editor de campana sabe dibujar. */
export const ITEM_TYPES = ['weapon', 'armor', 'gear'];

/**
 * @param {any} value
 * @returns {string}
 */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * @param {any} value
 * @param {number} fallback
 * @returns {number}
 */
function number(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Los kilos, con un decimal. Un peso de 0,7350000000001 no lo escribe nadie a mano y en
 * un campo de texto se ve fatal.
 *
 * @param {number} value
 * @returns {number}
 */
function kilos(value) {
    return Math.max(0.1, Math.round(value * 10) / 10);
}

/**
 * Un objeto hecho de una forma y un material.
 *
 * Devuelve null cuando la bateria no esta, y quien llama sigue con lo que hiciera antes:
 * es la misma regla que el resto del compendio.
 *
 * @param {Object} input
 * @param {any} input.compendium
 * @param {() => number} [input.random]
 * @param {string} [input.itemType] Arma, armadura o equipo. Vacio deja elegir.
 * @param {string} [input.rarity]   Para pedir algo de un peldano concreto del botin.
 * @param {string} [input.category] Hoja, asta, distancia…
 * @returns {{name: string, type: string, category: string, rarity: string, weight: number,
 *   damageDice: string, damageType: string, slot: string, description: string,
 *   from: {forma: string, material: string}}|null}
 */
export function forgeItem({ compendium, random = Math.random, itemType = '', rarity = '', category = '' }) {
    if (!compendium?.has?.('materiales')) return null;

    /** @type {Record<string, any>} */
    const askForma = { kind: 'forma' };
    if (text(itemType)) askForma.itemType = text(itemType);
    if (text(category)) askForma.category = text(category);

    const forma = compendium.pick('materiales', { where: askForma, random });
    if (!forma) return null;

    // El material tiene que pegar con la forma: no hay cotas de malla de roble. Lo dice
    // el propio material en su `when.itemType`, que es donde lo puede cambiar quien
    // escribe el archivo sin tocar esto.
    /** @type {Record<string, any>} */
    const askMaterial = { kind: 'material', itemType: text(forma.itemType) };
    if (text(rarity)) askMaterial.rarity = text(rarity);

    // Si se pidio una rareza que ningun material tiene, mejor el objeto sin ella que
    // ningun objeto: quien lo pidio ya vera que la rareza no es la que queria.
    const material = compendium.pick('materiales', { where: askMaterial, random })
        ?? compendium.pick('materiales', { where: { kind: 'material', itemType: text(forma.itemType) }, random });

    const pattern = material ? (text(forma.pattern) || '{forma}') : '{forma}';
    const name = fillPattern(pattern, {
        forma: [text(forma.name)],
        material: [text(material?.name)],
    }, random).replace(/\s+/g, ' ').trim();

    return {
        name,
        type: ITEM_TYPES.includes(text(forma.itemType)) ? text(forma.itemType) : 'gear',
        category: text(forma.category),
        rarity: text(material?.rarity) || 'Common',
        weight: kilos(number(forma.kg, 1) * number(material?.weightMultiplier, 1)),
        damageDice: text(forma.damageDice),
        damageType: text(forma.damageType),
        slot: text(forma.slot),
        description: text(material?.effect),
        from: { forma: text(forma.id), material: text(material?.id) },
    };
}

/**
 * Varios, sin repetir la misma combinacion.
 *
 * Es lo que pide una tienda o el botin de una mazmorra: ocho cosas distintas, no ocho
 * tiradas que a veces coinciden.
 *
 * @param {Object} input
 * @param {any} input.compendium
 * @param {number} input.howMany
 * @param {() => number} [input.random]
 * @param {string} [input.itemType]
 * @param {string} [input.rarity]
 * @returns {any[]}
 */
export function forgeItems({ compendium, howMany, random = Math.random, itemType = '', rarity = '' }) {
    /** @type {any[]} */
    const out = [];
    const seen = new Set();

    // Se intenta el doble de veces que objetos se piden: con pocas formas, insistir hasta
    // el infinito colgaria, y rendirse a la primera daria siempre menos de los pedidos.
    for (let i = 0; i < Math.max(0, howMany) * 2 && out.length < howMany; i++) {
        const item = forgeItem({ compendium, random, itemType, rarity });
        if (!item) break;

        const key = `${item.from.forma}|${item.from.material}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(item);
    }

    return out;
}

/**
 * Lo forjado en una linea, para el aviso de despues.
 *
 * @param {any} item
 * @returns {string}
 */
export function describeItem(item) {
    if (!item) return '';
    const bits = [text(item.name)];
    if (text(item.damageDice)) bits.push(`${item.damageDice} ${text(item.damageType)}`.trim());
    bits.push(`${item.weight} kg`);
    if (text(item.rarity) && item.rarity !== 'Common') bits.push(text(item.rarity));
    return bits.filter(Boolean).join(' · ');
}
