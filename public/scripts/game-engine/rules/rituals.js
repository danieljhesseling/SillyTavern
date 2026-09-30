/**
 * Los rituales, fuera de combate (J19.8; D-J27: el erudito lanza solo rituales, sin espacios).
 *
 * Un ritual no gasta espacio: lleva diez minutos más y nunca se lanza peleando (`ritualCheck`
 * y `canCastSpell` de `spell-cast.js`). Esto dice **qué hace cada uno en el juego**, que un
 * ritual que solo se cuenta es decorado, y más para quien no tiene otra magia:
 *
 * | Ritual | Qué hace |
 * | :--- | :--- |
 * | Detectar magia | Dice qué de lo que lleváis tiene magia, y avisa de lo maldito que aún no sabíais |
 * | Identificar | Identifica todo lo que lleváis sin identificar, como el templo (pide una perla, que no se gasta) |
 * | Alarma | Esta noche, +5 a la guardia del campamento |
 * | Encontrar familiar | Un familiar se queda con vosotros, como mascota (pide incienso y hierbas, que se gastan) |
 * | Purificar comida y bebida | Nadie del grupo pasa hambre ni sed por ahora |
 * | Comprender idiomas | Hasta que acabe esta parte del día, entiende cualquier lengua: al calar a alguien, sin desventaja |
 *
 * Lanzar un ritual no gasta una parte del día: son diez minutos (como comprar, D-J31).
 *
 * Puro: qué se puede lanzar ahora, qué pasa y cómo se dice. Quien llama lo aplica y lo guarda.
 */

import { canCastSpell } from './spell-cast.js';
import { ritualSpells } from './spell-prep.js';
import { MAGIC_ITEMS, itemSpellSpec } from './magic-items.js';
import { relieve } from './needs.js';
import { isWorthy, isUnknown, identify, templeWork } from '../campaign/item-lore.js';
import { createPet, petName } from '../campaign/pet.js';

/** Qué hace cada ritual, por su id en `conjuros.json`. */
export const RITUAL_EFFECTS = {
    'conj-detectar-magia': 'detect',
    'conj-identificar': 'identify',
    'conj-alarma': 'alarm',
    'conj-encontrar-familiar': 'familiar',
    'conj-purificar': 'purify',
    'conj-comprender-idiomas': 'tongues',
};

/** Lo que suma la Alarma a la guardia de esa noche. */
export const ALARM_WATCH_BONUS = 5;

/** Cómo se llama el familiar que acude, y cómo es. */
const FAMILIAR_NAMES = ['Ceniza', 'Pluma', 'Tinta', 'Hollín', 'Musgo', 'Candil'];
const FAMILIAR_CHARACTERS = ['curiosa', 'leal', 'cinica'];

/** Cómo se dice cada franja dentro de una frase. */
const SLOT_WORDS = { morning: 'la mañana', afternoon: 'la tarde', night: 'la noche' };

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Qué hace un ritual: una de `RITUAL_EFFECTS`, o vacío si fuera de una pelea no hace nada
 * (Silencio).
 *
 * @param {any} spell Normalizado (`normalizeSpell`), con su id y sus alias.
 * @returns {string}
 */
export function ritualKind(spell) {
    const effects = /** @type {Record<string, string>} */ (RITUAL_EFFECTS);
    const ids = [text(spell?.id), ...(Array.isArray(spell?.aliases) ? spell.aliases.map(text) : [])];
    return ids.map(id => effects[id]).find(Boolean) ?? '';
}

/**
 * @typedef {Object} RitualState
 * @property {number} [unknownItems] Cuántas cosas lleva el grupo sin identificar.
 * @property {string} [pet] Cómo se llama la mascota que ya os acompaña, si la hay.
 * @property {boolean} [alarmSet] Si la alarma ya está puesta para esta noche.
 */

/**
 * Por qué un ritual que se puede lanzar no serviría ahora de nada. Vacío si sirve.
 *
 * @param {string} kind
 * @param {string} name
 * @param {RitualState} state
 * @returns {string}
 */
function uselessNow(kind, name, state) {
    if (!kind) return `${name} solo sirve peleando, y un ritual no se lanza peleando.`;
    if (kind === 'identify' && !(Number(state.unknownItems) > 0)) return 'No lleváis nada sin identificar.';
    if (kind === 'familiar' && text(state.pet)) return `Ya os acompaña ${text(state.pet)}: un familiar no se queda donde ya hay mascota.`;
    if (kind === 'alarm' && state.alarmSet) return 'La alarma ya está puesta para esta noche.';
    return '';
}

/**
 * @typedef {Object} RitualChoice
 * @property {string} id
 * @property {string} name
 * @property {string} kind
 * @property {string} note Lo que hace, dicho para quien juega.
 * @property {boolean} ok
 * @property {string} reason Por qué no, en una frase.
 * @property {number} minutes
 * @property {string[]} consumes El material que se gasta.
 */

/**
 * Los rituales de alguien, cada uno con si se puede lanzar ahora y, si no, por qué: su clase,
 * su libro (o sus preparados), el material que pide (D-J25), que no se pelee, y que sirva
 * de algo.
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {any} input.classRow
 * @param {any[]} input.catalogue Las filas de `conjuros.json`.
 * @param {boolean} [input.inCombat]
 * @param {any[]} [input.carried] Lo que lleva encima.
 * @param {Array<{name: string, carried: any[], focus?: string}>} [input.others] Los demás del grupo.
 * @param {RitualState} [input.state]
 * @returns {RitualChoice[]}
 */
export function ritualChoices({ member, classRow, catalogue, inCombat = false, carried = [], others = [], state = {} }) {
    return ritualSpells(member, classRow, catalogue).map(spell => {
        const kind = ritualKind(spell);
        const verdict = canCastSpell({ member, classRow, spell, inCombat, carried, others, asRitual: true });
        const useless = verdict.ok ? uselessNow(kind, spell.name, state) : '';
        return {
            id: spell.id,
            name: spell.name,
            kind,
            note: text(spell.note),
            ok: verdict.ok && !useless,
            reason: verdict.ok ? useless : verdict.reason,
            minutes: verdict.minutes,
            consumes: verdict.ok ? verdict.consumes : [],
        };
    });
}

/**
 * Si algo tiene magia: los pergaminos y varitas, lo que lleva un conjuro, lo que pide
 * sintonía, lo maldito, lo mejorado (+1) y lo que es de poco común para arriba.
 *
 * @param {any} item
 * @returns {boolean}
 */
export function isMagical(item) {
    if (!item || typeof item !== 'object') return false;
    return Boolean(/** @type {Record<string, any>} */ (MAGIC_ITEMS)[text(item.name)]) || Boolean(itemSpellSpec(item))
        || Boolean(item.attunement) || Boolean(item.cursed) || /\+\d/.test(text(item.name)) || isWorthy(item);
}

/**
 * Detectar magia: qué de lo que lleva el grupo tiene magia, y lo maldito que aún no se sabía.
 * No identifica: para saber qué es cada cosa está Identificar (o el templo).
 *
 * @param {Object} input
 * @param {string} input.caster
 * @param {any[]} input.party
 * @returns {string[]}
 */
export function detectMagic({ caster, party }) {
    /** @type {string[]} */
    const magic = [];
    /** @type {string[]} */
    const warn = [];
    for (const member of Array.isArray(party) ? party : []) {
        if (!member || member.dead) continue;
        for (const item of Array.isArray(member.items) ? member.items : []) {
            if (!isMagical(item)) continue;
            const whose = `${text(item.name)} (lo lleva ${text(member.name)})`;
            magic.push(whose);
            if (item.cursed && isUnknown(item)) warn.push(`Cuidado con ${whose}: está maldito. No os lo pongáis; en un templo se quita.`);
        }
    }
    const lines = [`${text(caster) || 'Alguien'} cierra los ojos y nota la magia que hay a su alrededor.`];
    lines.push(magic.length > 0 ? `Tiene magia: ${magic.join(', ')}.` : 'Nada de lo que lleváis tiene magia.');
    return [...lines, ...warn];
}

/**
 * Identificar: todo lo que el grupo lleva sin identificar, como lo haría el templo.
 *
 * @param {Object} input
 * @param {string} input.caster
 * @param {any[]} input.party
 * @returns {{changes: Array<{memberId: string, itemId: string, item: any}>, lines: string[]}}
 */
export function identifyAll({ caster, party }) {
    const list = Array.isArray(party) ? party : [];
    /** @type {Array<{memberId: string, itemId: string, item: any}>} */
    const changes = [];
    /** @type {string[]} */
    const lines = [];
    for (const { memberId, itemId } of templeWork(list).unknown) {
        const member = list.find(m => String(m?.id) === memberId);
        const item = (Array.isArray(member?.items) ? member.items : []).find((/** @type {any} */ i) => String(i?.id) === itemId);
        if (!item) continue;
        const seen = identify(item);
        changes.push({ memberId, itemId, item: seen.item });
        lines.push(seen.line);
    }
    const head = `${text(caster) || 'Alguien'} estudia lo que lleváis, con la perla en la mano.`;
    return { changes, lines: changes.length > 0 ? [head, ...lines] : [head, 'No hay nada sin identificar.'] };
}

/**
 * Purificar comida y bebida: nadie del grupo pasa hambre ni sed por ahora.
 *
 * @param {Object} input
 * @param {string} input.caster
 * @param {any[]} input.party
 * @returns {{changes: Array<{memberId: string, needs: any}>, lines: string[]}}
 */
export function purifyAll({ caster, party }) {
    const changes = (Array.isArray(party) ? party : []).filter(m => m && !m.dead).map(member => {
        const fed = relieve(member, 'ate');
        return { memberId: String(member.id), needs: relieve({ ...member, needs: fed }, 'drank') };
    });
    return {
        changes,
        lines: [`${text(caster) || 'Alguien'} limpia la comida y el agua que lleváis: nadie del grupo pasa hambre ni sed por ahora.`],
    };
}

/**
 * Encontrar familiar: acude uno y se queda, como mascota del grupo.
 *
 * @param {Object} input
 * @param {string} input.caster
 * @param {() => number} input.random
 * @returns {{pet: import('../campaign/pet.js').Pet|null, lines: string[]}}
 */
export function summonFamiliar({ caster, random }) {
    const pick = (/** @type {string[]} */ list) => list[Math.floor(random() * list.length) % list.length];
    const pet = createPet({ name: pick(FAMILIAR_NAMES), species: 'familiar', character: pick(FAMILIAR_CHARACTERS) });
    if (!pet) return { pet: null, lines: [] };
    return {
        pet,
        lines: [`Entre el humo del incienso aparece ${petName(pet)}, y se queda con ${text(caster) || 'quien lo llamó'}. Ve y oye por vosotros, y hace guardia de noche.`],
    };
}

/**
 * Alarma: esta noche, en el campamento, la guardia va con ventaja.
 *
 * @param {Object} input
 * @param {string} input.caster
 * @param {any} input.calendar Para saber qué noche.
 * @returns {{alarm: {day: number}, lines: string[]}}
 */
export function setAlarm({ caster, calendar }) {
    const day = Math.max(0, Math.floor(Number(calendar?.day) || 0));
    return {
        alarm: { day },
        lines: [`${text(caster) || 'Alguien'} pone una alarma alrededor de donde dormiréis: esta noche, si alguien se acerca, sonará una campanilla (+${ALARM_WATCH_BONUS} a la guardia).`],
    };
}

/**
 * Si la alarma vale para la noche de ese día.
 *
 * @param {any} alarm Lo guardado por `setAlarm`.
 * @param {any} calendar
 * @returns {boolean}
 */
export function alarmActive(alarm, calendar) {
    if (!alarm || typeof alarm !== 'object') return false;
    return Math.floor(Number(alarm.day) || 0) === Math.max(0, Math.floor(Number(calendar?.day) || 0));
}

/**
 * Comprender idiomas: hasta que acabe esta parte del día, quien lo lanza entiende cualquier
 * lengua (`tongues` en su ficha; lo lee `languageBarrier`).
 *
 * @param {Object} input
 * @param {string} input.caster
 * @param {any} input.calendar
 * @returns {{tongues: {day: number, slotIndex: number}, lines: string[]}}
 */
export function understandTongues({ caster, calendar }) {
    const day = Math.max(0, Math.floor(Number(calendar?.day) || 0));
    const slotIndex = Math.max(0, Math.floor(Number(calendar?.slotIndex) || 0));
    const slot = Array.isArray(calendar?.slots) ? calendar.slots[slotIndex] : null;
    const when = /** @type {Record<string, string>} */ (SLOT_WORDS)[text(slot?.id)] ?? 'esta parte del día';
    return {
        tongues: { day, slotIndex },
        lines: [`Hasta que acabe ${when}, ${text(caster) || 'quien lo lanza'} entiende cualquier lengua que oiga o lea: al calar a alguien que habla otra, no va con desventaja.`],
    };
}
