/**
 * E2.4 de wiki/ROADMAP_ENTRETENIDO.md: el kit de curandero, que se acaba.
 *
 * 5e (2024): el kit tiene **diez usos**. Con un uso, quien atiende estabiliza a alguien a 0 PG
 * sin tirar Medicina. Se gasta, y cuando se acaba, se vuelve a tirar. Así curarse en la
 * mazmorra cuesta algo que se ve: los usos que quedan.
 *
 * Puro: cuenta y gasta usos. Quien llama estabiliza y guarda.
 */

/** Los usos de un kit nuevo (5e). */
export const KIT_USES = 10;

/** @param {any} value @returns {number} */
const num = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Si un objeto es un kit de curandero.
 *
 * @param {any} item
 * @returns {boolean}
 */
export function isHealerKit(item) {
    return /kit de curandero|botiqu[ií]n/i.test(String(item?.name ?? ''));
}

/**
 * Los usos que le quedan a un kit (sin decir, uno nuevo: diez).
 *
 * @param {any} item
 * @returns {number}
 */
export function usesLeft(item) {
    if (!isHealerKit(item)) return 0;
    return item.uses === undefined || item.uses === null ? KIT_USES : Math.max(0, Math.floor(num(item.uses)));
}

/**
 * Los usos de kit que lleva alguien, sumados.
 *
 * @param {any} member
 * @returns {number}
 */
export function kitUsesOf(member) {
    return (Array.isArray(member?.items) ? member.items : []).reduce((/** @type {number} */ sum, /** @type {any} */ item) => sum + usesLeft(item), 0);
}

/**
 * Los usos de kit de todo el grupo.
 *
 * @param {any[]} members
 * @returns {number}
 */
export function partyKitUses(members) {
    return (Array.isArray(members) ? members : []).filter(m => m && !m.dead).reduce((sum, m) => sum + kitUsesOf(m), 0);
}

/**
 * Quién lleva un kit con usos: primero el que atiende, si lo lleva; si no, el primero que lo
 * tenga (se lo pasan).
 *
 * @param {any[]} members
 * @param {any} [helper]
 * @returns {any|null}
 */
export function kitCarrier(members, helper = null) {
    if (helper && kitUsesOf(helper) > 0) return helper;
    return (Array.isArray(members) ? members : []).find(m => m && !m.dead && kitUsesOf(m) > 0) ?? null;
}

/**
 * Gastar un uso del kit de una mochila: el kit baja en uno y, si se queda en cero, se tira.
 *
 * @param {any[]} items
 * @returns {{items: any[], left: number, spent: boolean}} `left`: los usos que le quedan a ese kit.
 */
export function spendKitUse(items) {
    const list = Array.isArray(items) ? [...items] : [];
    const at = list.findIndex(item => usesLeft(item) > 0);
    if (at < 0) return { items: list, left: 0, spent: false };
    const left = usesLeft(list[at]) - 1;
    if (left <= 0) list.splice(at, 1);
    else list[at] = { ...list[at], uses: left };
    return { items: list, left: Math.max(0, left), spent: true };
}

/**
 * Cómo se dice lo que queda: «le quedan 3 usos», «era el último uso».
 *
 * @param {number} left
 * @returns {string}
 */
export function describeKitLeft(left) {
    const n = Math.max(0, Math.floor(num(left)));
    return n === 0 ? 'era el último uso del kit' : n === 1 ? 'al kit le queda un uso' : `al kit le quedan ${n} usos`;
}
