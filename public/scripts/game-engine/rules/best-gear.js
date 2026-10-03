/**
 * E7.3 de wiki/ROADMAP_ENTRETENIDO.md (G5.5 de ROADMAP_AUTOMATIZAR): «Equipar lo mejor».
 *
 * Un botón en la ficha de un compañero le pone el mejor arma y la mejor armadura de lo que
 * tiene a mano, según su clase y lo que domina, y dice por qué. Y los compañeros que lleva el
 * juego se lo ponen solos cuando les llega algo mejor.
 *
 * Con las reglas de D&D 2024:
 *
 * - **Armaduras:** cada clase tiene su entrenamiento (guerrero y paladín, todas y escudo;
 *   bárbaro, explorador y clérigo, ligeras, medias y escudo; druida, ligeras y escudo; bardo,
 *   pícaro y brujo, ligeras; monje, hechicero y mago, ninguna). Sin entrenamiento no se la pone:
 *   en 5e no podría lanzar conjuros y tendría desventaja en todo lo de Fuerza y Destreza.
 * - **Armadura pesada:** pide su Fuerza (la que diga la pieza; si no lo dice, 13, o 15 la de CA
 *   17 o más). Con menos, en 2024 se anda 10 pies menos: aquí no se la pone.
 * - **Armas:** las que domina (`weaponProficient`, como el ataque). Se mide lo que mueve el arma
 *   por la escalera de dados (`damageStepOf`), su «+1» y la característica con que pega.
 * - **Dos manos o escudo:** un arma a dos manos quita el escudo. Se elige lo que más vale: el
 *   escudo cuenta como dos puntos de daño por cada punto de CA.
 * - **La luz (E2.1):** quien lleva la antorcha tiene una mano ocupada: nada a dos manos, y el
 *   escudo no cuenta (lo lleva colgado a la espalda).
 *
 * Lo maldito que ya se sabe que lo está no se toca, ni lo que pide sintonía (eso lo decide quien
 * juega).
 *
 * Puro: decide y explica. Quien llama mueve los objetos y guarda.
 */

import { classKey } from './checks.js';
import { weaponProficient } from './attack-bonus.js';
import { damageStepOf, equippedIn } from './equipment.js';

/** El entrenamiento con armaduras de cada clase (D&D 2024). */
export const ARMOR_TRAINING = {
    fighter: ['light', 'medium', 'heavy', 'shield'],
    paladin: ['light', 'medium', 'heavy', 'shield'],
    barbarian: ['light', 'medium', 'shield'],
    ranger: ['light', 'medium', 'shield'],
    cleric: ['light', 'medium', 'shield'],
    druid: ['light', 'shield'],
    bard: ['light'],
    rogue: ['light'],
    warlock: ['light'],
    monk: [],
    sorcerer: [],
    wizard: [],
};

/** Lo que se supone a una clase que no está en la lista (una del taller): ligeras, medias y escudo. */
const UNKNOWN_TRAINING = ['light', 'medium', 'shield'];

/** Cuánto vale un punto de CA del escudo frente al daño de un arma a dos manos. */
export const SHIELD_WORTH = 2;

/** Las ranuras de lo que se pone encima, además del cuerpo y el escudo. */
const EXTRA_SLOTS = ['head', 'hands', 'feet'];

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {number} */
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

/** @param {any} score @returns {number} */
const modOf = (score) => Math.floor(((Number(score) || 10) - 10) / 2);

/**
 * El entrenamiento con armaduras de alguien, por su clase.
 *
 * @param {any} member
 * @returns {string[]}
 */
export function armorTraining(member) {
    const key = classKey(member?.class);
    return key ? [...(/** @type {Record<string, string[]>} */ (ARMOR_TRAINING)[key] ?? UNKNOWN_TRAINING)] : [...UNKNOWN_TRAINING];
}

/**
 * Qué ranura ocupa un objeto: la que diga, o la que se deduce de lo que es.
 *
 * @param {any} item
 * @returns {string}
 */
export function slotOf(item) {
    const slot = text(item?.slot);
    if (slot) return slot;
    if (text(item?.damageDice) || text(item?.type) === 'weapon') return 'weapon';
    if (/shield/.test(text(item?.subcategory))) return 'shield';
    if (/armor/.test(text(item?.subcategory)) || num(item?.armorClass) >= 10) return 'body';
    return '';
}

/**
 * El peso de una armadura de cuerpo: ligera, media o pesada.
 *
 * @param {any} item
 * @returns {'light'|'medium'|'heavy'}
 */
export function armourWeight(item) {
    const sub = text(item?.subcategory).toLowerCase();
    if (sub.startsWith('heavy')) return 'heavy';
    if (sub.startsWith('medium')) return 'medium';
    if (sub.startsWith('light')) return 'light';
    const tags = (Array.isArray(item?.tags) ? item.tags : []).map(t => text(t).toLowerCase());
    const mode = text(item?.dexMode || item?.armorDexMode).toLowerCase();
    if (mode === 'none' || tags.includes('pesada') || item?.heavy === true) return 'heavy';
    if (mode === 'half' || mode === 'max_2' || tags.includes('media')) return 'medium';
    return 'light';
}

/**
 * La Fuerza que pide una armadura para llevarla sin ir más lento.
 *
 * @param {any} item
 * @returns {number} 0 si no pide nada.
 */
export function strengthNeeded(item) {
    const said = num(item?.strengthRequirement);
    if (said > 0) return said;
    if (armourWeight(item) !== 'heavy') return 0;
    return num(item?.armorClass ?? item?.baseArmorClass) >= 17 ? 15 : 13;
}

/**
 * La CA que le daría a alguien una armadura de cuerpo (o ir sin ella), con su Destreza.
 *
 * @param {any} member
 * @param {any} item La armadura, o null (sin armadura: 10 + Destreza; el bárbaro suma su
 *   Constitución y el monje su Sabiduría, su Defensa sin armadura).
 * @returns {number}
 */
export function bodyArmourClass(member, item) {
    const dex = modOf(member?.dexterity);
    if (!item) {
        const key = classKey(member?.class);
        if (key === 'barbarian') return 10 + dex + modOf(member?.constitution);
        if (key === 'monk') return 10 + dex + modOf(member?.wisdom);
        return 10 + dex;
    }
    const base = num(item.armorClass ?? item.baseArmorClass) || 10;
    const weight = armourWeight(item);
    const mode = text(item.dexMode || item.armorDexMode).toLowerCase();
    const allowed = weight === 'heavy' || mode === 'none' ? 0 : weight === 'medium' || mode === 'half' || mode === 'max_2' ? Math.min(dex, 2) : dex;
    return base + allowed + Math.max(0, Math.min(3, Math.floor(num(item.magicalBonus))));
}

/**
 * Lo que suma una pieza que no es la del cuerpo (escudo, yelmo…): su CA y su `effects`.
 *
 * @param {any} item
 * @returns {number}
 */
export function pieceArmourClass(item) {
    if (!item) return 0;
    const effects = (Array.isArray(item.effects) ? item.effects : [])
        .filter((/** @type {any} */ e) => text(e?.stat) === 'armorClass')
        .reduce((/** @type {number} */ sum, /** @type {any} */ e) => sum + num(e.modifier), 0);
    return num(item.armorClass) + effects + Math.max(0, Math.min(3, Math.floor(num(item.magicalBonus))));
}

/** @param {any} item @returns {boolean} */
const isRanged = (item) => num(item?.rangeFeet ?? item?.range) > 30;

/** @param {any} item @returns {boolean} */
const twoHanded = (item) => num(item?.hands) >= 2 || item?.twoHanded === true;

/**
 * Lo que vale un arma en manos de alguien: el peldaño de su dado, su «+1» (al golpe y al daño) y
 * la característica con que pega. Quien pelea de cerca por oficio prefiere lo de cerca; el
 * explorador, lo de lejos.
 *
 * @param {any} member
 * @param {any} item
 * @returns {number}
 */
export function weaponWorth(member, item) {
    if (!item) return -3;
    const ranged = isRanged(item);
    const ability = ranged ? modOf(member?.dexterity) : Math.max(modOf(member?.strength), modOf(member?.dexterity));
    const bonus = Math.max(0, Math.min(3, Math.floor(num(item.magicalBonus))));
    const key = classKey(member?.class);
    const taste = ['fighter', 'paladin', 'barbarian'].includes(key) && !ranged ? 0.5 : key === 'ranger' && ranged ? 0.5 : 0;
    return damageStepOf(item) + bonus * 1.5 + ability + taste;
}

/**
 * @typedef {Object} GearPick Un objeto que se le puede poner, y de quién es ahora.
 * @property {any} item
 * @property {string} [owner] El id de quien lo lleva en la mochila, si no es él.
 */

/**
 * @typedef {Object} GearChange
 * @property {string} slot
 * @property {any|null} item Lo que se pone (null: se quita lo de esa ranura).
 * @property {string} owner De quién es (vacío: suyo).
 * @property {any|null} was Lo que llevaba.
 */

/**
 * @typedef {Object} GearPlan
 * @property {GearChange[]} changes
 * @property {string[]} lines Por qué, en frases.
 * @property {boolean} better Si cambia algo.
 */

/**
 * Lo que se puede poner alguien de verdad: lo que domina, lo que no pide sintonía y lo que no se
 * sabe maldito.
 *
 * @param {any} member
 * @param {any} item
 * @returns {string} Por qué no, o vacío si sí.
 */
export function cannotWear(member, item) {
    if (!item) return 'No hay nada.';
    if (item.cursed && item.identified !== false) return `${text(item.name)} está maldito.`;
    if (item.attunement && !item.attuned) return `${text(item.name)} pide sintonía.`;
    const slot = slotOf(item);
    if (slot === 'weapon') return weaponProficient(member, item) ? '' : 'no domina esa arma';
    const training = armorTraining(member);
    if (slot === 'shield') return training.includes('shield') ? '' : 'no sabe llevar escudo';
    if (slot === 'body') {
        const weight = armourWeight(item);
        if (!training.includes(weight)) return `no sabe llevar armadura ${weight === 'heavy' ? 'pesada' : weight === 'medium' ? 'media' : 'ligera'}`;
        const need = strengthNeeded(item);
        if (need > 0 && num(member?.strength) < need) return `le falta Fuerza (pide ${need})`;
    }
    return '';
}

/**
 * Lo mejor que se puede poner alguien de lo que tiene a mano.
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {GearPick[]} [input.pool] Lo que tiene a mano además de su mochila (lo suelto de los demás).
 * @param {boolean} [input.torchBearer] Si lleva la antorcha (E2.1): una mano ocupada.
 * @returns {GearPlan}
 */
export function bestGear({ member, pool = [], torchBearer = false }) {
    /** @type {GearPlan} */
    const plan = { changes: [], lines: [], better: false };
    if (!member) return plan;
    const own = (Array.isArray(member.items) ? member.items : []).map((/** @type {any} */ item) => ({ item, owner: '' }));
    const all = [...own, ...(Array.isArray(pool) ? pool : []).filter(p => p?.item && !own.some(o => o.item === p.item))];
    /** @type {Array<{item: any, why: string}>} */
    const refused = [];
    const wearable = all.filter(pick => {
        const why = cannotWear(member, pick.item);
        if (why && slotOf(pick.item) && !(pick.item.cursed && pick.item.identified !== false) && !pick.item.attunement) refused.push({ item: pick.item, why });
        return !why;
    });
    const stuck = (/** @type {string} */ slot) => {
        const now = equippedIn(member, slot);
        return Boolean(now?.cursed);
    };

    // ---- Arma (y el escudo con ella) -------------------------------------
    const nowWeapon = equippedIn(member, 'weapon');
    const nowShield = equippedIn(member, 'shield');
    const weapons = wearable.filter(p => slotOf(p.item) === 'weapon' && !(torchBearer && twoHanded(p.item)));
    const shields = wearable.filter(p => slotOf(p.item) === 'shield');
    const best = (/** @type {GearPick[]} */ list, /** @type {(p: GearPick) => number} */ score) => [...list].sort((a, b) => score(b) - score(a))[0] ?? null;
    const oneHand = best(weapons.filter(p => !twoHanded(p.item)), p => weaponWorth(member, p.item));
    const twoHand = best(weapons.filter(p => twoHanded(p.item)), p => weaponWorth(member, p.item));
    const shield = best(shields, p => pieceArmourClass(p.item));
    const shieldValue = torchBearer ? 0 : pieceArmourClass(shield?.item) * SHIELD_WORTH;
    const withShield = (oneHand ? weaponWorth(member, oneHand.item) : weaponWorth(member, null)) + shieldValue;
    const withTwo = twoHand ? weaponWorth(member, twoHand.item) : -Infinity;
    const pickTwo = withTwo > withShield;
    const wantWeapon = pickTwo ? twoHand : oneHand;
    const wantShield = pickTwo || torchBearer ? null : shield;
    const nowWorth = weaponWorth(member, nowWeapon) + (nowShield && !twoHanded(nowWeapon) && !torchBearer ? pieceArmourClass(nowShield) * SHIELD_WORTH : 0);
    const wantWorth = pickTwo ? withTwo : withShield;
    if (!stuck('weapon') && wantWeapon && wantWeapon.item !== nowWeapon && wantWorth > nowWorth + 0.01) {
        plan.changes.push({ slot: 'weapon', item: wantWeapon.item, owner: wantWeapon.owner ?? '', was: nowWeapon });
        const steps = Math.round(weaponWorth(member, wantWeapon.item) - weaponWorth(member, nowWeapon));
        plan.lines.push(`${text(wantWeapon.item.name)} en vez de ${nowWeapon ? text(nowWeapon.name) : 'los puños'}${steps > 0 ? `: pega más fuerte (+${steps})` : ''}.`);
        if (pickTwo && nowShield && !stuck('shield')) {
            plan.changes.push({ slot: 'shield', item: null, owner: '', was: nowShield });
            plan.lines.push(`Deja ${text(nowShield.name)}: ${text(wantWeapon.item.name)} va a dos manos y pega más de lo que tapa el escudo.`);
        }
    }
    const weaponAfter = plan.changes.find(c => c.slot === 'weapon')?.item ?? nowWeapon;
    if (!stuck('shield') && wantShield && !twoHanded(weaponAfter) && wantShield.item !== nowShield
        && pieceArmourClass(wantShield.item) > pieceArmourClass(nowShield)) {
        plan.changes.push({ slot: 'shield', item: wantShield.item, owner: wantShield.owner ?? '', was: nowShield });
        plan.lines.push(`${text(wantShield.item.name)}: +${pieceArmourClass(wantShield.item) - pieceArmourClass(nowShield)} de CA.`);
    }
    if (torchBearer && plan.changes.some(c => c.slot === 'weapon')) plan.lines.push('Lleva la antorcha: con una mano ocupada, nada a dos manos.');

    // ---- Armadura del cuerpo --------------------------------------------
    const nowBody = equippedIn(member, 'body');
    const bodies = wearable.filter(p => slotOf(p.item) === 'body');
    const body = best(bodies, p => bodyArmourClass(member, p.item));
    const acNow = bodyArmourClass(member, nowBody);
    if (!stuck('body') && body && body.item !== nowBody && bodyArmourClass(member, body.item) > acNow) {
        const acNew = bodyArmourClass(member, body.item);
        plan.changes.push({ slot: 'body', item: body.item, owner: body.owner ?? '', was: nowBody });
        plan.lines.push(`${text(body.item.name)}: CA ${acNew} en vez de ${acNow}.`);
    }

    // ---- Lo demás que tapa (yelmo, guantes, botas) ------------------------
    for (const slot of EXTRA_SLOTS) {
        const now = equippedIn(member, slot);
        const pick = best(wearable.filter(p => slotOf(p.item) === slot), p => pieceArmourClass(p.item));
        if (stuck(slot) || !pick || pick.item === now || pieceArmourClass(pick.item) <= pieceArmourClass(now)) continue;
        plan.changes.push({ slot, item: pick.item, owner: pick.owner ?? '', was: now });
        plan.lines.push(`${text(pick.item.name)}: +${pieceArmourClass(pick.item) - pieceArmourClass(now)} de CA.`);
    }

    // Lo que sería mejor y no se pone, dicho: si no, parece que el botón no ha visto la placa.
    const after = (/** @type {string} */ slot) => {
        const change = plan.changes.find(c => c.slot === slot);
        return change ? change.item : equippedIn(member, slot);
    };
    const beats = (/** @type {any} */ item) => {
        const slot = slotOf(item);
        if (slot === 'weapon') return weaponWorth(member, item) > weaponWorth(member, after('weapon'));
        if (slot === 'body') return bodyArmourClass(member, item) > bodyArmourClass(member, after('body'));
        return pieceArmourClass(item) > pieceArmourClass(after(slot));
    };
    for (const { item, why } of refused.filter(r => beats(r.item)).slice(0, 2)) plan.lines.push(`No se pone ${text(item.name)}: ${why}.`);
    plan.better = plan.changes.length > 0;
    return plan;
}

/**
 * Aplicar un plan a la ficha (y a las de quienes le pasan algo). Devuelve las fichas como
 * quedan; quien llama las guarda.
 *
 * @param {any} member
 * @param {GearPlan} plan
 * @param {any[]} [mates] Los demás del grupo (de quienes pueden venir cosas).
 * @returns {{member: {items: any[], equippedItems: Record<string, any>}, mates: Array<{id: string, items: any[]}>}}
 */
export function applyGear(member, plan, mates = []) {
    const items = [...(Array.isArray(member?.items) ? member.items : [])];
    const equipped = { ...(member?.equippedItems ?? {}) };
    /** @type {Map<string, any[]>} */
    const taken = new Map();
    for (const change of plan?.changes ?? []) {
        if (!change.item) {
            equipped[change.slot] = null;
            continue;
        }
        if (change.owner) {
            const from = (Array.isArray(mates) ? mates : []).find(m => text(m?.id) === text(change.owner));
            if (!from) continue;
            const left = taken.get(text(from.id)) ?? [...(Array.isArray(from.items) ? from.items : [])];
            taken.set(text(from.id), left.filter(i => i !== change.item));
            if (!items.includes(change.item)) items.push(change.item);
        }
        // Lo que ya llevaba puesto en otra ranura, fuera de ella.
        for (const [slot, id] of Object.entries(equipped)) if (id && id === change.item.id && slot !== change.slot) equipped[slot] = null;
        equipped[change.slot] = change.item.id;
    }
    return { member: { items, equippedItems: equipped }, mates: [...taken].map(([id, list]) => ({ id, items: list })) };
}
