/**
 * El almacén del gremio: lo que no se lleva encima se deja en casa (idea 124).
 *
 * Lo que se va juntando —trofeos de caza, lo maldito ya limpio, el arma de repuesto— no
 * tiene por qué ir en la mochila. En el gremio se guarda y se saca. Lo que se lleva puesto
 * no se guarda (se quita antes en la ficha), y lo maldito tampoco: no se suelta.
 *
 * Puro: mueve objetos entre una ficha y el almacén.
 */

/** Cuántas cosas caben. */
export const STORAGE_SLOTS = 30;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * @param {any} raw
 * @returns {any[]}
 */
export function readStorage(raw) {
    return (Array.isArray(raw) ? raw : []).filter(i => i && text(i.name)).slice(0, STORAGE_SLOTS);
}

/**
 * Guardar algo de alguien.
 *
 * @param {any} member
 * @param {any} storage
 * @param {string} itemId
 * @returns {{ok: boolean, reason: string, items: any[], storage: any[], line: string}}
 */
export function store(member, storage, itemId) {
    const items = Array.isArray(member?.items) ? member.items : [];
    const box = readStorage(storage);
    const item = items.find(i => text(i?.id) === text(itemId));
    const fail = (/** @type {string} */ reason) => ({ ok: false, reason, items, storage: box, line: '' });
    if (!item) return fail('No lo lleva.');
    if (Object.values(member?.equippedItems ?? {}).some(id => text(id) === text(itemId))) return fail('Lo lleva puesto: quítatelo antes.');
    if (item.cursed) return fail(`${text(item.name)} no se suelta: está maldito.`);
    if (box.length >= STORAGE_SLOTS) return fail(`En el almacén ya no cabe nada (${STORAGE_SLOTS}).`);
    return {
        ok: true, reason: '', items: items.filter(i => i !== item), storage: [...box, item],
        line: `${text(member?.name)} deja ${text(item.name)} en el almacén del gremio.`,
    };
}

/**
 * Sacar algo del almacén para alguien.
 *
 * @param {any} member
 * @param {any} storage
 * @param {string} itemId
 * @returns {{ok: boolean, reason: string, items: any[], storage: any[], line: string}}
 */
export function retrieve(member, storage, itemId) {
    const items = Array.isArray(member?.items) ? member.items : [];
    const box = readStorage(storage);
    const item = box.find(i => text(i?.id) === text(itemId));
    if (!item) return { ok: false, reason: 'No está en el almacén.', items, storage: box, line: '' };
    return {
        ok: true, reason: '', items: [...items, item], storage: box.filter(i => i !== item),
        line: `${text(member?.name)} saca ${text(item.name)} del almacén.`,
    };
}
