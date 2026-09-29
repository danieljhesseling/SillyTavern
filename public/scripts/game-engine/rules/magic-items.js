/**
 * Pergaminos y varitas: la magia del grimorio en un objeto (R4 del roadmap de profundidad).
 *
 * - **Un pergamino** se lee una vez y se gasta. Lo lee cualquiera; quien estudia (el mago y
 *   el erudito) puede, en vez de leerlo, **aprender** el conjuro, y el pergamino se gasta.
 * - **Una varita** tiene cargas: al quedarse sin ninguna, se apaga para siempre.
 *
 * Ni uno ni otro gastan las cargas del círculo de quien los usa ni sus componentes: el
 * objeto ya los lleva dentro. Y los dos lanzan solo conjuros del grimorio: un pergamino de
 * algo que no existe no existe.
 *
 * Puro: qué objetos son mágicos, qué se puede hacer con ellos y cómo quedan.
 *
 * Ver wiki/ROADMAP_PROFUNDIDAD.md, R4.
 */

import { spellById, classKey } from './grimoire.js';

/**
 * Los objetos que llevan un conjuro. `charges` solo en las varitas.
 *
 * @type {Record<string, {spell: string, kind: 'scroll'|'wand', charges?: number}>}
 */
export const MAGIC_ITEMS = {
    'Pergamino de Bola de fuego': { spell: 'mag-bola-fuego', kind: 'scroll' },
    'Pergamino de Curar heridas': { spell: 'hab-curar', kind: 'scroll' },
    'Pergamino de Sueño pesado': { spell: 'hab-sueno', kind: 'scroll' },
    'Pergamino de Relámpago': { spell: 'mag-relampago', kind: 'scroll' },
    'Pergamino de Paso sin rastro': { spell: 'mag-paso-sin-rastro', kind: 'scroll' },
    'Varita de destellos': { spell: 'hab-luz-severa', kind: 'wand', charges: 3 },
    'Varita de escarcha': { spell: 'mag-cono-escarcha', kind: 'wand', charges: 3 },
};

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Los objetos mágicos que lleva alguien, con lo que les queda.
 *
 * @param {any} member
 * @returns {Array<{itemId: string, name: string, spell: string, kind: 'scroll'|'wand', left: number}>}
 */
export function magicItemsOf(member) {
    return (Array.isArray(member?.items) ? member.items : []).flatMap((/** @type {any} */ item) => {
        const spec = MAGIC_ITEMS[text(item?.name)];
        if (!spec || !spellById(spec.spell)) return [];
        const left = spec.kind === 'wand'
            ? Math.max(0, Math.floor(Number(item?.charges ?? spec.charges) || 0))
            : 1;
        return left > 0 ? [{ itemId: text(item?.id), name: text(item?.name), spell: spec.spell, kind: spec.kind, left }] : [];
    });
}

/**
 * Los botones de usar lo mágico, ya juzgados, con la forma de las maniobras.
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {boolean} input.hasAction
 * @param {Array<{id: string, name: string, distanceFeet: number}>} input.enemies
 * @param {Array<{id: string, name: string, distanceFeet: number}>} input.allies
 * @param {(id: string) => any} input.abilityOf El conjuro como habilidad del catálogo.
 * @returns {Array<{id: string, label: string, icon: string, detail: string, enabled: boolean, needsTarget: boolean, targets: Array<{id: string, name: string}>}>}
 */
export function judgeMagicItems({ member, hasAction, enemies, allies, abilityOf }) {
    return magicItemsOf(member).map(item => {
        const ability = abilityOf(item.spell);
        const range = Math.max(5, Number(ability?.rangeFeet) || 5);
        const side = ability?.target === 'ally' ? allies : ability?.target === 'enemy' ? enemies : [];
        const targets = (side || []).filter(t => Number(t.distanceFeet) <= range).map(t => ({ id: String(t.id), name: String(t.name) }));
        const self = ability?.target === 'self';
        const reason = !hasAction ? 'La acción de este turno ya está gastada.'
            : ability?.combat === false ? 'Esto no se usa peleando.'
                : !self && targets.length === 0 ? `No hay nadie a menos de ${range} pies.` : '';
        return {
            id: `leer:${item.itemId}`,
            label: item.kind === 'wand' ? `${item.name} (${item.left})` : `Leer ${item.name}`,
            icon: item.kind === 'wand' ? 'fa-wand-magic-sparkles' : 'fa-scroll',
            detail: reason || `${ability?.name ?? item.spell}: ${ability?.description ?? ''}`.trim(),
            enabled: !reason,
            needsTarget: !self,
            targets,
        };
    });
}

/**
 * Cómo queda el objeto después de usarlo: el pergamino se gasta; la varita pierde una carga,
 * y sin cargas se apaga.
 *
 * @param {any} item
 * @returns {{remove: boolean, charges: number, line: string}}
 */
export function afterUse(item) {
    const spec = MAGIC_ITEMS[text(item?.name)];
    if (!spec || spec.kind === 'scroll') return { remove: true, charges: 0, line: `${text(item?.name)} se deshace en ceniza.` };
    const charges = Math.max(0, Math.floor(Number(item?.charges ?? spec.charges) || 0) - 1);
    return charges > 0
        ? { remove: false, charges, line: `A ${text(item?.name)} le quedan ${charges}.` }
        : { remove: true, charges: 0, line: `${text(item?.name)} se apaga: ya no tiene nada dentro.` };
}

/**
 * Si alguien puede aprender el conjuro de un pergamino en vez de leerlo: quien estudia (el
 * mago y el erudito), y si no lo sabe ya.
 *
 * @param {any} member
 * @param {any} item
 * @returns {{ok: boolean, reason: string, spell: string}}
 */
export function canLearnScroll(member, item) {
    const spec = MAGIC_ITEMS[text(item?.name)];
    if (!spec || spec.kind !== 'scroll') return { ok: false, reason: 'Eso no es un pergamino.', spell: '' };
    const studies = classKey(String(member?.class ?? member?.charClass ?? '')) === 'mago'
        || /erudit/.test(String(member?.class ?? member?.charClass ?? '').toLowerCase());
    if (!studies) return { ok: false, reason: 'Para aprender de un pergamino hay que haber estudiado: el mago o el erudito.', spell: spec.spell };
    const known = (Array.isArray(member?.abilities) ? member.abilities : []).map(String);
    if (known.includes(spec.spell)) return { ok: false, reason: 'Ese conjuro ya lo sabe.', spell: spec.spell };
    return { ok: true, reason: '', spell: spec.spell };
}

// --- J19.9: los objetos mágicos de 5e, sobre la ficha de objeto que ya existe ---------------
//
// La ficha de objeto de `dnd-system.js` ya trae casi todo: `uses` y `maxUses` (las cargas),
// `recharge` (cuándo vuelven), `attunement` (si pide sintonía), `linkedSpell`, `spellLevel`,
// `saveDC` y `spellAttackBonus`. Aquí no se duplica nada: se leen esas columnas, y lo único
// nuevo es `attuned` (si ya está sintonizado) y, si se quiere, `rechargeDice` (las varitas
// de 5e recuperan 1d6+1 al alba, no todas).

/** Cuántos objetos puede tener alguien sintonizados a la vez (5e). */
export const ATTUNEMENT_MAX = 3;

/** Qué recargas vuelven con cada descanso, con los valores de `recharge` de la ficha. */
export const RECHARGE_ON = {
    largo: ['At Dawn', 'At Dusk', 'Long Rest', 'Short Rest'],
    corto: ['Short Rest'],
};

/** @param {any} value @returns {string} */
const plainName = (value) => text(value).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * El conjuro que lleva un objeto, de la lista de la capa ligera o de su ficha de 5e.
 *
 * @param {any} item
 * @returns {{spell: string, kind: 'scroll'|'wand'|'staff'|'ring'|'', slotLevel: number, saveDc: number, attackBonus: number, recharge: string}|null}
 */
export function itemSpellSpec(item) {
    const legacy = MAGIC_ITEMS[text(item?.name)];
    if (legacy) return { spell: legacy.spell, kind: legacy.kind, slotLevel: 0, saveDc: 0, attackBonus: 0, recharge: '' };
    const spell = text(item?.linkedSpell);
    if (!spell) return null;
    const name = plainName(item?.name);
    const kind = text(item?.subcategory) === 'scroll' ? 'scroll'
        : name.startsWith('baston') ? 'staff'
            : name.startsWith('anillo') ? 'ring'
                : text(item?.subcategory) === 'ring_wand_staff' ? 'wand' : '';
    return {
        spell,
        kind,
        slotLevel: Math.max(0, Math.floor(Number(item?.spellLevel) || 0)),
        saveDc: Math.max(0, Math.floor(Number(item?.saveDC) || 0)),
        attackBonus: Math.floor(Number(item?.spellAttackBonus) || 0),
        recharge: text(item?.recharge),
    };
}

/**
 * Las cargas de un objeto: las de su ficha (`uses`/`maxUses`) o, en las varitas de la capa
 * ligera, `charges`.
 *
 * @param {any} item
 * @returns {{left: number, max: number}}
 */
export function itemCharges(item) {
    const legacy = MAGIC_ITEMS[text(item?.name)];
    const max = Math.max(0, Math.floor(Number(item?.maxUses ?? legacy?.charges) || 0));
    const left = Math.max(0, Math.floor(Number(item?.uses ?? item?.charges ?? max) || 0));
    return { left: max > 0 ? Math.min(left, max) : left, max };
}

/**
 * Gastar cargas (un bastón puede pedir más de una por conjuro). Lo que se queda a cero y no
 * se recarga se apaga para siempre; lo que se recarga espera al descanso.
 *
 * @param {any} item
 * @param {number} [cost]
 * @returns {{ok: boolean, reason: string, uses: number, remove: boolean, line: string}}
 */
export function spendItemCharges(item, cost = 1) {
    const need = Math.max(1, Math.floor(Number(cost) || 1));
    const { left } = itemCharges(item);
    const name = text(item?.name) || 'El objeto';
    if (left < need) return { ok: false, reason: `A ${name} le quedan ${left} cargas y hacen falta ${need}.`, uses: left, remove: false, line: '' };
    const uses = left - need;
    const recharges = Boolean(text(item?.recharge)) && text(item?.recharge) !== 'Manual';
    if (uses > 0) return { ok: true, reason: '', uses, remove: false, line: `A ${name} le quedan ${uses}.` };
    return recharges
        ? { ok: true, reason: '', uses: 0, remove: false, line: `${name} se queda sin cargas hasta que se recargue.` }
        : { ok: true, reason: '', uses: 0, remove: true, line: `${name} se apaga: ya no tiene nada dentro.` };
}

/**
 * Lo que recargan los objetos con un descanso: hasta el máximo, o lo que diga su
 * `rechargeDice` («1d6+1»), sin pasarse.
 *
 * @param {any[]} items
 * @param {'corto'|'largo'} kind
 * @param {(formula: string) => {total: number}} [roll]
 * @returns {{items: any[], lines: string[]}}
 */
export function rechargeItems(items, kind, roll = () => ({ total: 0 })) {
    const when = RECHARGE_ON[kind] ?? [];
    /** @type {string[]} */
    const lines = [];
    const next = (Array.isArray(items) ? items : []).map(item => {
        const { left, max } = itemCharges(item);
        if (max === 0 || left >= max || !when.includes(text(item?.recharge))) return item;
        const dice = text(item?.rechargeDice);
        const gained = dice ? Math.max(0, Number(roll(dice).total) || 0) : max - left;
        const uses = Math.min(max, left + gained);
        if (uses === left) return item;
        lines.push(`🔋 ${text(item?.name)} recupera cargas: ${uses}/${max}.`);
        return { ...item, uses };
    });
    return { items: next, lines };
}

/**
 * Si un objeto funciona: lo que pide sintonía, solo sintonizado.
 *
 * @param {any} item
 * @returns {boolean}
 */
export function itemWorks(item) {
    return !item?.attunement || Boolean(item?.attuned);
}

/**
 * Los objetos que alguien tiene sintonizados.
 *
 * @param {any} member
 * @returns {any[]}
 */
export function attunedItems(member) {
    return (Array.isArray(member?.items) ? member.items : []).filter((/** @type {any} */ item) => item?.attunement && item?.attuned);
}

/**
 * Si alguien puede sintonizarse con un objeto: que lo pida, que no lo esté ya, que no tenga
 * tres, y fuera de combate (en 5e es una hora, un descanso corto).
 *
 * @param {any} member
 * @param {string} itemId
 * @param {{inCombat?: boolean}} [options]
 * @returns {{ok: boolean, reason: string}}
 */
export function canAttune(member, itemId, { inCombat = false } = {}) {
    const item = (Array.isArray(member?.items) ? member.items : []).find((/** @type {any} */ i) => text(i?.id) === text(itemId));
    if (!item) return { ok: false, reason: 'No lleva ese objeto.' };
    if (!item.attunement) return { ok: false, reason: `${text(item.name)} no pide sintonía: ya funciona.` };
    if (item.attuned) return { ok: false, reason: `Ya está en sintonía con ${text(item.name)}.` };
    if (inCombat) return { ok: false, reason: 'Sintonizarse lleva una hora tranquila: peleando no.' };
    if (attunedItems(member).length >= ATTUNEMENT_MAX) {
        return { ok: false, reason: `Ya tiene ${ATTUNEMENT_MAX} objetos en sintonía: tiene que soltar uno antes.` };
    }
    return { ok: true, reason: '' };
}

/**
 * Sintonizarse o dejarlo, como parche para la lista de objetos.
 *
 * @param {any} member
 * @param {string} itemId
 * @param {boolean} on
 * @param {{inCombat?: boolean}} [options]
 * @returns {{ok: boolean, reason: string, items: any[]}}
 */
export function setAttunement(member, itemId, on, options = {}) {
    const items = Array.isArray(member?.items) ? member.items : [];
    if (on) {
        const verdict = canAttune(member, itemId, options);
        if (!verdict.ok) return { ...verdict, items };
    }
    return {
        ok: true,
        reason: '',
        items: items.map((/** @type {any} */ item) => (text(item?.id) === text(itemId) ? { ...item, attuned: Boolean(on) } : item)),
    };
}

/**
 * Leer un pergamino con las reglas de 5e: solo si el conjuro es de la lista de su clase.
 * Si es de un nivel que todavía no lanza, una prueba de su característica contra 10 + el
 * nivel del conjuro; si la falla, el pergamino se pierde igual.
 *
 * @param {Object} input
 * @param {{name: string, level: number, classes: string[]}} input.spell Normalizado.
 * @param {string} input.classList El `list` de su `casting`.
 * @param {number} input.maxLevel El nivel de conjuro más alto que lanza.
 * @param {(formula: string) => {total: number}} input.roll
 * @param {number} [input.modifier] El de su característica de lanzar.
 * @returns {{ok: boolean, needsCheck: boolean, dc: number, success: boolean, reason: string, lines: string[]}}
 */
export function scrollCheck({ spell, classList, maxLevel, roll, modifier = 0 }) {
    if (!spell?.classes?.includes(text(classList))) {
        return { ok: false, needsCheck: false, dc: 0, success: false, reason: `${text(spell?.name)} no es de su lista: no sabe leerlo.`, lines: [] };
    }
    if (spell.level <= maxLevel) return { ok: true, needsCheck: false, dc: 0, success: true, reason: '', lines: [] };
    const dc = 10 + spell.level;
    const d20 = Number(roll('1d20').total) || 0;
    const total = d20 + modifier;
    const success = total >= dc;
    return {
        ok: true,
        needsCheck: true,
        dc,
        success,
        reason: '',
        lines: [`📜 Es de un nivel que aún no lanza: d20(${d20}) ${modifier >= 0 ? '+' : ''}${modifier} = ${total} vs CD ${dc}${success ? '.' : ': se le escapa, y el pergamino se deshace.'}`],
    };
}
