/**
 * Darle algo a otro del grupo (idea 163).
 *
 * Repartir el botín era abrir el editor de cada uno, borrar en una ficha y escribir en la
 * otra. Ahora se arrastra el objeto a la cara de quien lo va a llevar, o se elige a quién
 * desde el propio objeto.
 *
 * Lo que se lleva puesto se quita antes de darlo. Lo maldito no se da: no se suelta.
 *
 * Puro: dice cómo quedan las dos fichas. Quien llama las guarda.
 */

import { canTakeOff } from '../campaign/item-lore.js';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Pasar un objeto de uno a otro.
 *
 * @param {Object} input
 * @param {any} input.from
 * @param {any} input.to
 * @param {string} input.itemId
 * @returns {{ok: boolean, reason: string, from: {items: any[], equippedItems: Record<string, string>}|null, to: {items: any[]}|null, item: any, line: string}}
 */
export function giveItem({ from, to, itemId }) {
    const fail = (/** @type {string} */ reason) => ({ ok: false, reason, from: null, to: null, item: null, line: '' });
    if (!from || !to) return fail('Falta quién da o quién recibe.');
    if (String(from.id) === String(to.id)) return fail('Ya lo lleva.');
    if (to.dead) return fail(`${text(to.name)} ya no lleva nada.`);
    const items = Array.isArray(from.items) ? from.items : [];
    const item = items.find((/** @type {any} */ i) => text(i?.id) === text(itemId));
    if (!item) return fail('No lo lleva.');
    const equipped = from.equippedItems && typeof from.equippedItems === 'object' ? from.equippedItems : {};
    const worn = Object.entries(equipped).filter(([, id]) => text(id) === text(itemId)).map(([slot]) => slot);
    const loose = canTakeOff(item);
    if (worn.length > 0 && !loose.ok) return fail(loose.reason);
    const unequipped = Object.fromEntries(Object.entries(equipped).filter(([slot]) => !worn.includes(slot)));
    return {
        ok: true,
        reason: '',
        from: { items: items.filter((/** @type {any} */ i) => i !== item), equippedItems: unequipped },
        to: { items: [...(Array.isArray(to.items) ? to.items : []), item] },
        item,
        line: `${text(from.name)} le da ${text(item.name)} a ${text(to.name)}${worn.length > 0 ? ' (se lo quita antes)' : ''}.`,
    };
}
