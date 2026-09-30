/**
 * El cofre del gremio (J3.4 de wiki/ROADMAP_SIN_CONEXION.md): lo que no lleváis encima se queda
 * en casa, y es de todos los tuyos.
 *
 * El almacén ya existía (`storage.js`, idea 124): treinta huecos donde dejar un objeto y de
 * donde sacarlo. Esto lo convierte en el cofre de la sala del gremio:
 *
 * - **Se ve entero**: lo que hay dentro, agrupado («Poción de curación ×3»), y lo que lleva
 *   cada uno, con lo que no se puede dejar apagado y el porqué (lo puesto, lo maldito).
 * - **Se saca para quien tú digas**, no siempre para el primero del grupo.
 * - **El arca**: el oro también se deja. Cada personaje tuyo tiene su bolsa; lo que se deja en
 *   el arca lo puede sacar cualquiera, también el que entre después (J1.6). Es lo que hace que
 *   el cofre sea compartido.
 *
 * Lo que se deja en el cofre no va a las campañas: se queda en el gremio, en su chat.
 *
 * Puro: dice qué hay y mueve cosas entre una ficha, el cofre y el arca. Quien llama guarda.
 */

import { STORAGE_SLOTS, readStorage, store, retrieve } from './storage.js';
import { readGuild } from './guild.js';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {number} */
const coins = (value) => Math.max(0, Math.floor(Number(value) || 0));

/**
 * Qué clase de cosa es, para agruparla y para su icono: arma, armadura o lo demás.
 *
 * @param {any} item
 * @returns {'weapon'|'armor'|'gear'}
 */
export function itemKind(item) {
    const said = text(item?.type || item?.category).toLowerCase();
    if (said === 'weapon' || text(item?.slot) === 'weapon' || text(item?.damageDice)) return 'weapon';
    if (said === 'armor' || ['body', 'shield', 'head', 'hands', 'feet'].includes(text(item?.slot))) return 'armor';
    return 'gear';
}

/**
 * Si alguien lleva algo puesto.
 *
 * @param {any} member
 * @param {string} itemId
 * @returns {boolean}
 */
function worn(member, itemId) {
    return Object.values(member?.equippedItems ?? {}).some(id => text(id) === text(itemId));
}

/**
 * @typedef {Object} ChestGroup Lo que hay en el cofre, agrupado por nombre.
 * @property {string} name
 * @property {string} kind  weapon | armor | gear
 * @property {number} count
 * @property {string[]} ids Los de cada pieza: se saca una cada vez, la primera.
 * @property {string} note  Lo que tiene de especial: «+1», «CA 14».
 */

/**
 * @typedef {Object} CarriedItem
 * @property {string} id
 * @property {string} name
 * @property {string} kind
 * @property {boolean} canStore
 * @property {string} why Por qué no se puede dejar, si no se puede.
 * @property {string} note
 */

/**
 * @typedef {Object} ChestView
 * @property {number} slots    Los huecos del cofre.
 * @property {number} used
 * @property {number} gold     Lo que hay en el arca.
 * @property {ChestGroup[]} stored
 * @property {Array<{memberId: string, name: string, gold: number, items: CarriedItem[]}>} carried
 */

/**
 * Lo que tiene de especial una pieza, corto: «+1», «CA 14», «maldito».
 *
 * @param {any} item
 * @returns {string}
 */
export function itemNote(item) {
    const parts = [];
    const bonus = coins(item?.magicalBonus);
    if (bonus > 0) parts.push(`+${bonus}`);
    if (itemKind(item) === 'armor' && coins(item?.armorClass) > 0) parts.push(text(item?.slot) === 'body' ? `CA ${coins(item.armorClass)}` : `+${coins(item.armorClass)} CA`);
    if (itemKind(item) === 'weapon' && text(item?.damageDice)) parts.push(text(item.damageDice));
    if (item?.cursed) parts.push('maldito');
    return parts.join(' · ');
}

/**
 * El cofre y lo que lleva el grupo, listo para enseñar.
 *
 * @param {Object} input
 * @param {any} input.storage Lo guardado (`STORAGE_KEY` del chat del gremio).
 * @param {any[]} input.party
 * @param {any} input.guild   El gremio, con su arca.
 * @returns {ChestView}
 */
export function chestView({ storage, party, guild }) {
    const box = readStorage(storage);
    /** @type {Map<string, ChestGroup>} */
    const groups = new Map();
    for (const item of box) {
        const key = `${text(item.name).toLowerCase()}|${itemNote(item)}`;
        const was = groups.get(key);
        if (was) {
            was.count += 1;
            was.ids.push(text(item.id));
        } else {
            groups.set(key, { name: text(item.name), kind: itemKind(item), count: 1, ids: [text(item.id)], note: itemNote(item) });
        }
    }
    const order = { weapon: 0, armor: 1, gear: 2 };
    const stored = [...groups.values()].sort((a, b) => order[/** @type {keyof typeof order} */ (a.kind)] - order[/** @type {keyof typeof order} */ (b.kind)]
        || a.name.localeCompare(b.name, 'es'));
    const carried = (Array.isArray(party) ? party : [])
        .filter(member => member && !member.dead && text(member.name))
        .map(member => ({
            memberId: text(member.id),
            name: text(member.name),
            gold: coins(member.gold),
            items: (Array.isArray(member.items) ? member.items : []).filter(item => item && text(item.name)).map(item => {
                const on = worn(member, item.id);
                const why = on ? 'Lo lleva puesto: quítatelo antes en la ficha.'
                    : item.cursed ? 'Está maldito: no se suelta.'
                        : box.length >= STORAGE_SLOTS ? `El cofre está lleno (${STORAGE_SLOTS}).` : '';
                return { id: text(item.id), name: text(item.name), kind: itemKind(item), canStore: !why, why, note: itemNote(item) };
            }),
        }));
    return { slots: STORAGE_SLOTS, used: box.length, gold: coins(readGuild(guild).gold), stored, carried };
}

/**
 * Dejar algo en el cofre. Lo mismo que el almacén de siempre (`store`), con la frase del cofre.
 *
 * @param {any} member
 * @param {any} storage
 * @param {string} itemId
 * @returns {{ok: boolean, reason: string, items: any[], storage: any[], line: string}}
 */
export function putInChest(member, storage, itemId) {
    const done = store(member, storage, itemId);
    if (!done.ok) return done;
    const item = readStorage(done.storage).find(i => text(i.id) === text(itemId));
    return { ...done, line: `${text(member?.name)} deja ${text(item?.name)} en el cofre del gremio.` };
}

/**
 * Sacar algo del cofre para alguien del grupo (el que se elija, no siempre el primero).
 *
 * @param {any} member
 * @param {any} storage
 * @param {string} itemId
 * @returns {{ok: boolean, reason: string, items: any[], storage: any[], line: string}}
 */
export function takeFromChest(member, storage, itemId) {
    if (!member || member.dead) return { ok: false, reason: 'Esa persona no puede cogerlo.', items: [], storage: readStorage(storage), line: '' };
    const done = retrieve(member, storage, itemId);
    if (!done.ok) return done;
    const item = done.items.find((/** @type {any} */ i) => text(i?.id) === text(itemId));
    return { ...done, line: `${text(member?.name)} saca ${text(item?.name)} del cofre del gremio.` };
}

/**
 * Dejar oro en el arca.
 *
 * @param {any} member
 * @param {any} guild
 * @param {number} amount
 * @returns {{ok: boolean, reason: string, gold: number, guild: any, line: string}} `gold`: lo que le queda a quien lo deja.
 */
export function depositGold(member, guild, amount) {
    const has = coins(member?.gold);
    const want = coins(amount);
    const read = readGuild(guild);
    if (want <= 0) return { ok: false, reason: 'Di cuánto.', gold: has, guild: read, line: '' };
    if (want > has) return { ok: false, reason: `${text(member?.name)} solo lleva ${has} de oro.`, gold: has, guild: read, line: '' };
    const now = coins(read.gold) + want;
    return {
        ok: true, reason: '', gold: has - want, guild: { ...read, gold: now },
        line: `${text(member?.name)} deja ${want} de oro en el arca del gremio. En el arca hay ${now}.`,
    };
}

/**
 * Sacar oro del arca para alguien.
 *
 * @param {any} member
 * @param {any} guild
 * @param {number} amount
 * @returns {{ok: boolean, reason: string, gold: number, guild: any, line: string}} `gold`: lo que lleva después.
 */
export function withdrawGold(member, guild, amount) {
    const has = coins(member?.gold);
    const want = coins(amount);
    const read = readGuild(guild);
    const inside = coins(read.gold);
    if (want <= 0) return { ok: false, reason: 'Di cuánto.', gold: has, guild: read, line: '' };
    if (want > inside) return { ok: false, reason: inside > 0 ? `En el arca solo hay ${inside} de oro.` : 'El arca está vacía.', gold: has, guild: read, line: '' };
    const left = inside - want;
    const next = { ...read };
    if (left > 0) next.gold = left;
    else delete next.gold;
    return {
        ok: true, reason: '', gold: has + want, guild: next,
        line: `${text(member?.name)} saca ${want} de oro del arca del gremio.${left > 0 ? ` Quedan ${left}.` : ' El arca se queda vacía.'}`,
    };
}

/**
 * Cómo se paga algo del gremio (un edificio, la forja, la biblioteca): primero del arca y, lo
 * que falte, de las bolsas del grupo.
 *
 * @param {Object} input
 * @param {number} input.cost
 * @param {any} input.guild
 * @param {number} input.purse Lo que lleva el grupo entre todos.
 * @returns {{ok: boolean, fromChest: number, fromPurse: number, line: string}}
 */
export function payPlan({ cost, guild, purse }) {
    const want = coins(cost);
    const inside = coins(readGuild(guild).gold);
    const fromChest = Math.min(inside, want);
    const fromPurse = want - fromChest;
    const ok = fromPurse <= coins(purse);
    const line = !ok ? `No llega el oro: cuesta ${want}, y entre el arca y vuestras bolsas hay ${inside + coins(purse)}.`
        : fromChest > 0 && fromPurse > 0 ? `Se pagan ${fromChest} del arca y ${fromPurse} de vuestras bolsas.`
            : fromChest > 0 ? `Se paga del arca: ${fromChest} de oro.` : `Se paga de vuestras bolsas: ${fromPurse} de oro.`;
    return { ok, fromChest, fromPurse, line };
}

/**
 * El gremio después de cobrar del arca lo que diga `payPlan`.
 *
 * @param {any} guild
 * @param {number} fromChest
 * @returns {any}
 */
export function spendFromChest(guild, fromChest) {
    const read = readGuild(guild);
    const left = coins(read.gold) - coins(fromChest);
    const next = { ...read };
    if (left > 0) next.gold = left;
    else delete next.gold;
    return next;
}
