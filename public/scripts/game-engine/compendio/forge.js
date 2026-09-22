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

/** Los peldanos del botin, de menos a mas. Subir del ultimo no lleva a ninguna parte. */
export const RARITY_LADDER = ['Common', 'Uncommon', 'Rare', 'Very Rare'];

/**
 * Lo que una propiedad da y lo que quita, en un solo numero.
 *
 * Existe para que una prueba pueda decir que alguien se ha pasado escribiendo. Vida,
 * dano y caracteristicas se pagan de la misma bolsa, y un objeto que **solo suma** no es
 * una decision: se equipa y se olvida.
 *
 * @param {any} row
 * @returns {{gives: number, takes: number}}
 */
export function propertyBalance(row) {
    let gives = 0;
    let takes = 0;

    const damage = number(row?.damageBonus, 0) * 3;
    if (damage > 0) gives += damage; else takes -= damage;

    // Menos kilos es una ventaja, y mas kilos es el precio.
    const kilos = (1 - number(row?.weightFactor, 1)) * 4;
    if (kilos > 0) gives += kilos; else takes -= kilos;

    for (const effect of (Array.isArray(row?.effects) ? row.effects : [])) {
        const value = number(effect?.modifier, 0) * (text(effect?.stat) === 'armorClass' ? 3 : 2);
        if (value > 0) gives += value; else takes -= value;
    }

    return { gives: Math.round(gives * 10) / 10, takes: Math.round(takes * 10) / 10 };
}

/**
 * Sube la rareza unos peldanos, sin salirse de la escalera.
 *
 * @param {string} rarity
 * @param {number} steps
 * @returns {string}
 */
export function raiseRarity(rarity, steps) {
    const at = RARITY_LADDER.indexOf(text(rarity));
    const from = at < 0 ? 0 : at;
    return RARITY_LADDER[Math.max(0, Math.min(RARITY_LADDER.length - 1, from + Math.round(steps)))];
}

/**
 * Pega el bono al formulario de dano, que es como el motor sabe tirarlo.
 *
 * `rollWith` entiende `NdM+K`, asi que el bono tiene que acabar **dentro** de la cadena.
 * Dejarlo en un campo aparte seria un numero que nadie suma.
 *
 * @param {string} dice
 * @param {number} bonus
 * @returns {string}
 */
export function withBonus(dice, bonus) {
    const base = text(dice);
    if (!base) return '';

    const match = base.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (!match) return base;

    const total = number(match[3], 0) + Math.round(number(bonus, 0));
    if (total === 0) return `${match[1]}d${match[2]}`;
    return `${match[1]}d${match[2]}${total > 0 ? '+' : ''}${total}`;
}

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
 * @param {number} [input.properties] Cuantas propiedades colgarle. Por defecto, una o
 *        ninguna: un mundo donde todo tiene apellido cansa igual que uno donde nada lo tiene.
 * @returns {{name: string, type: string, category: string, rarity: string, weight: number,
 *   damageDice: string, damageType: string, slot: string, description: string,
 *   effects: Array<{stat: string, modifier: number}>,
 *   from: {forma: string, material: string, propiedades: string[]}}|null}
 */
export function forgeItem({
    compendium, random = Math.random, itemType = '', rarity = '', category = '', properties = -1,
}) {
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
    let name = fillPattern(pattern, {
        forma: [text(forma.name)],
        material: [text(material?.name)],
    }, random).replace(/\s+/g, ' ').trim();

    // Las propiedades: lo que separa un botin de una lista de numeros. Se cuelgan sobre
    // lo ya forjado, asi que una daga de plata afilada es las tres cosas a la vez.
    const howMany = properties >= 0
        ? properties
        : (random() < 0.55 ? 0 : 1);
    const attached = howMany > 0 && compendium.has('propiedades')
        ? compendium.take('propiedades', howMany, {
            where: { kind: 'propiedad', itemType: text(forma.itemType), category: text(forma.category) },
            random,
        })
        : [];

    let kg = number(forma.kg, 1) * number(material?.weightMultiplier, 1);
    let damage = 0;
    let step = 0;
    const feminine = text(forma.gender) === 'f';
    /** @type {Array<{stat: string, modifier: number}>} */
    const effects = [];
    /** @type {string[]} */
    const notes = [text(material?.effect)];

    for (const property of attached) {
        damage += number(property.damageBonus, 0);
        kg *= number(property.weightFactor, 1);
        step += number(property.rarityStep, 0);
        for (const effect of (Array.isArray(property.effects) ? property.effects : [])) {
            effects.push({ stat: text(effect.stat), modifier: number(effect.modifier, 0) });
        }
        notes.push(text(property.note));

        name = fillPattern(text(property.pattern) || '{cosa}', {
            cosa: [name],
            adj: [text(feminine ? property.adjf : property.adjm)],
            sustantivo: [text(property.sustantivo)],
        }, random).replace(/\s+/g, ' ').trim();
    }

    return {
        name,
        type: ITEM_TYPES.includes(text(forma.itemType)) ? text(forma.itemType) : 'gear',
        category: text(forma.category),
        rarity: raiseRarity(text(material?.rarity) || 'Common', step),
        weight: kilos(kg),
        damageDice: withBonus(text(forma.damageDice), damage),
        damageType: text(forma.damageType),
        slot: text(forma.slot),
        description: notes.filter(Boolean).join(' '),
        effects,
        from: {
            forma: text(forma.id),
            material: text(material?.id),
            propiedades: attached.map((/** @type {any} */ p) => text(p.id)),
        },
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

        const key = `${item.from.forma}|${item.from.material}|${item.from.propiedades.join(',')}`;
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
