/**
 * Los conjuros de cada uno, en juego (J19.2 del roadmap sin conexión): lo que se tiene al
 * empezar, lo que se elige al subir de nivel y lo que se prepara si nadie dice otra cosa.
 *
 * `spell-prep.js` dice **cuántos** y **de dónde**; esto dice **cuáles** y lo escribe como un
 * parche para la ficha (`cantrips`, `spellsKnown`, `spellbook`, `prepared`).
 *
 * - **Al empezar** (`startingSpells`): quien crea un mago no pasa por una lista de ochenta
 *   conjuros antes de jugar. Se le da lo de su nivel, empezando por lo que ya sabía con la
 *   capa ligera (sus ids del grimorio, que `conjuros.json` conserva) y siguiendo por lo que
 *   más sirve peleando. Luego, en el grimorio, lo cambia si quiere.
 * - **Al subir** (`choicesBetween`): lo de cada nivel ganado, sumado, por si se suben dos de
 *   golpe. Las opciones no repiten lo que ya sabe.
 * - **Lo elegido** (`applySpellPicks`): comprobado contra lo que se ofrecía.
 *
 * Puro: listas y cuentas. Guardarlo y enseñarlo es de `party/magic.js` y `party/level-up.js`.
 *
 * Ver wiki/ROADMAP_SIN_CONEXION.md, J19.2.
 */

import { casterOf } from './spell-slots.js';
import {
    cantripsKnown, spellsKnownCount, spellbookSize, preparedLimit, maxSpellLevel, classSpellList,
} from './spell-prep.js';

/** Las listas de conjuros de la ficha. */
export const SPELL_LISTS = ['cantrips', 'spellsKnown', 'spellbook', 'prepared'];

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string[]} */
const ids = (value) => (Array.isArray(value) ? value : []).map(v => text(typeof v === 'string' ? v : v?.id)).filter(Boolean);

/** @param {any} value @returns {number} */
const levelOf = (value) => Math.max(1, Math.min(20, Math.floor(Number(value) || 1)));

/**
 * Si la ficha ya tiene sus listas de conjuros (aunque estén vacías): entonces no se le
 * vuelve a dar nada de oficio.
 *
 * @param {any} member
 * @returns {boolean}
 */
export function hasSpellLists(member) {
    return SPELL_LISTS.some(key => Array.isArray(member?.[key]));
}

/**
 * Lo que más sirve peleando, primero: lo que hace daño o cura; luego lo que deja un estado o
 * una zona; luego lo demás; y lo que no sirve peleando, al final. Dentro de cada grupo, el
 * orden del archivo.
 *
 * @template {{damage?: string, healing?: string, condition?: string, zone?: any, combat?: boolean, castingTime?: string}} T
 * @param {T[]} spells
 * @returns {T[]}
 */
export function combatFirst(spells) {
    const score = (/** @type {T} */ spell) => {
        if (spell.combat === false || ['minute', '10min', 'hour'].includes(text(spell.castingTime))) return 4;
        if (text(spell.damage) || text(spell.healing)) return 0;
        if (text(spell.condition) || spell.zone) return 1;
        if (text(spell.castingTime) === 'reaction') return 3;
        return 2;
    };
    return (Array.isArray(spells) ? spells : [])
        .map((spell, index) => ({ spell, index, score: score(spell) }))
        .sort((a, b) => a.score - b.score || a.index - b.index)
        .map(entry => entry.spell);
}

/**
 * Los conjuros de la lista de su clase que ya sabía con la capa ligera (por su id o por un
 * alias): quien sabía Curar heridas lo sigue sabiendo.
 *
 * @param {any} member
 * @param {import('./spell-catalogue.js').Spell[]} list
 * @returns {import('./spell-catalogue.js').Spell[]}
 */
function legacyOf(member, list) {
    const had = new Set(ids(member?.abilities));
    return list.filter(spell => had.has(spell.id) || spell.aliases.some(alias => had.has(alias)));
}

/**
 * Los primeros `count`, sin repetir: lo de antes primero, y después el resto por orden.
 *
 * @param {import('./spell-catalogue.js').Spell[]} first
 * @param {import('./spell-catalogue.js').Spell[]} rest
 * @param {number} count
 * @returns {string[]}
 */
function takeIds(first, rest, count) {
    /** @type {string[]} */
    const out = [];
    for (const spell of [...first, ...rest]) {
        if (out.length >= count) break;
        if (!out.includes(spell.id)) out.push(spell.id);
    }
    return out;
}

/**
 * Los que prepara si nadie elige: los de su libro (mago) o de su lista (clérigo, druida) de
 * los niveles que ya lanza, lo que sirve peleando primero, hasta lo que le cabe.
 *
 * @param {Object} input
 * @param {any} input.member Con su nivel, su característica y su libro.
 * @param {any} input.classRow
 * @param {any[]} input.catalogue
 * @returns {string[]}
 */
export function defaultPrepared({ member, classRow, catalogue }) {
    const casting = casterOf(classRow);
    if (!casting || casting.mode === 'known' || casting.ritualsOnly) return [];
    const max = maxSpellLevel(classRow, member?.level);
    const book = new Set(ids(member?.spellbook));
    const pool = classSpellList(classRow, catalogue).filter(spell => spell.level > 0 && spell.level <= max
        && (casting.mode !== 'spellbook' || book.has(spell.id) || spell.aliases.some(a => book.has(a))));
    return takeIds(legacyOf(member, pool), combatFirst(pool), preparedLimit(classRow, member));
}

/**
 * Lo de empezar, para quien hace magia de 5e y no tiene todavía ninguna lista: lo de todos
 * los niveles hasta el suyo. `null` si su clase no hace magia de 5e.
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {any} input.classRow
 * @param {any[]} input.catalogue
 * @returns {{cantrips: string[], spellsKnown?: string[], spellbook?: string[], prepared?: string[]}|null}
 */
export function startingSpells({ member, classRow, catalogue }) {
    const casting = casterOf(classRow);
    if (!casting) return null;
    const level = levelOf(member?.level);
    const list = classSpellList(classRow, catalogue);
    const old = legacyOf(member, list);
    const max = maxSpellLevel(classRow, level);
    const cantripList = list.filter(spell => spell.level === 0);
    /** @type {{cantrips: string[], spellsKnown?: string[], spellbook?: string[], prepared?: string[]}} */
    const patch = {
        cantrips: takeIds(old.filter(s => s.level === 0), combatFirst(cantripList), cantripsKnown(classRow, level)),
    };
    const leveled = list.filter(spell => spell.level > 0 && spell.level <= Math.max(1, max));
    if (casting.mode === 'known') {
        patch.spellsKnown = max > 0 ? takeIds(old.filter(s => s.level > 0 && s.level <= max), combatFirst(leveled), spellsKnownCount(classRow, level)) : [];
    } else if (casting.mode === 'spellbook') {
        patch.spellbook = takeIds(old.filter(s => s.level > 0 && s.level <= Math.max(1, max)), combatFirst(leveled), spellbookSize(classRow, level));
        patch.prepared = defaultPrepared({ member: { ...member, ...patch }, classRow, catalogue });
    } else {
        patch.prepared = defaultPrepared({ member, classRow, catalogue });
    }
    return patch;
}

/**
 * @typedef {Object} SpellChoiceCard
 * @property {number} from
 * @property {number} to
 * @property {'spellbook'|'prepared'|'known'|''} mode
 * @property {number} maxSpellLevel
 * @property {number} newCantrips
 * @property {import('./spell-catalogue.js').Spell[]} cantripOptions
 * @property {number} newSpells
 * @property {import('./spell-catalogue.js').Spell[]} spellOptions
 * @property {boolean} canSwap
 * @property {import('./spell-catalogue.js').Spell[]} swapOut Lo que sabe y puede cambiar.
 * @property {number} preparedLimit
 * @property {string[]} lines
 */

/**
 * Lo que se elige al pasar de un nivel a otro, sumando cada nivel ganado.
 *
 * @param {Object} input
 * @param {any} input.classRow
 * @param {number} input.from El nivel que tenía.
 * @param {number} input.to El nivel al que llega.
 * @param {any[]} input.catalogue
 * @param {any} [input.member] Lo que ya sabe (y su característica, para los preparados).
 * @returns {SpellChoiceCard}
 */
export function choicesBetween({ classRow, from, to, catalogue, member = {} }) {
    const casting = casterOf(classRow);
    const start = Math.max(0, Math.floor(Number(from) || 0));
    const end = levelOf(to);
    /** @type {SpellChoiceCard} */
    const card = {
        from: start, to: end, mode: casting?.mode ?? '', maxSpellLevel: 0, newCantrips: 0, cantripOptions: [],
        newSpells: 0, spellOptions: [], canSwap: false, swapOut: [], preparedLimit: 0, lines: [],
    };
    if (!casting || end <= start) return card;

    const list = classSpellList(classRow, catalogue);
    const max = maxSpellLevel(classRow, end);
    const maxBefore = start >= 1 ? maxSpellLevel(classRow, start) : 0;
    const has = new Set([...ids(member?.cantrips), ...ids(member?.spellsKnown), ...ids(member?.spellbook)]);
    const fresh = (/** @type {import('./spell-catalogue.js').Spell} */ spell) => !has.has(spell.id) && !spell.aliases.some(a => has.has(a));

    card.maxSpellLevel = max;
    card.newCantrips = Math.max(0, cantripsKnown(classRow, end) - (start >= 1 ? cantripsKnown(classRow, start) : 0));
    if (casting.mode === 'known') {
        card.newSpells = Math.max(0, spellsKnownCount(classRow, end) - (start >= 1 ? spellsKnownCount(classRow, start) : 0));
    } else if (casting.mode === 'spellbook') {
        card.newSpells = start < 1 ? spellbookSize(classRow, end) : casting.spellbook.perLevel * (end - start);
    }
    card.canSwap = casting.mode === 'known' && end > 1 && max > 0 && ids(member?.spellsKnown).length > 0;
    card.swapOut = card.canSwap ? list.filter(spell => spell.level > 0 && !fresh(spell) && ids(member?.spellsKnown).some(id => id === spell.id || spell.aliases.includes(id))) : [];
    card.preparedLimit = casting.mode === 'known' ? 0 : preparedLimit(classRow, { ...member, level: end });
    card.cantripOptions = card.newCantrips > 0 ? list.filter(s => s.level === 0 && fresh(s)) : [];
    card.spellOptions = card.newSpells > 0 || card.canSwap ? list.filter(s => s.level > 0 && s.level <= max && fresh(s)) : [];

    const what = casting.ritualsOnly ? { one: 'ritual', some: 'rituales' } : { one: 'conjuro', some: 'conjuros' };
    if (max > maxBefore && max > 0) card.lines.push(`Ya lanza ${what.some} de nivel ${max}.`);
    if (card.newCantrips > 0) card.lines.push(`Aprende ${card.newCantrips === 1 ? 'un truco nuevo' : `${card.newCantrips} trucos nuevos`}.`);
    if (casting.mode === 'known' && card.newSpells > 0) card.lines.push(`Aprende ${card.newSpells === 1 ? `un ${what.one} nuevo` : `${card.newSpells} ${what.some} nuevos`}.`);
    if (casting.mode === 'spellbook' && card.newSpells > 0) card.lines.push(`Copia ${card.newSpells === 1 ? `un ${what.one}` : `${card.newSpells} ${what.some}`} en su libro.`);
    if (card.canSwap) card.lines.push('Puede cambiar uno que sabía por otro.');
    if (card.preparedLimit > 0) card.lines.push(`Prepara ${card.preparedLimit} cada mañana.`);
    return card;
}

/**
 * Lo elegido en la tarjeta, comprobado y hecho parche para la ficha. Hay que elegir todo lo
 * que toca (o todo lo que hay, si hay menos opciones que huecos). El cambio es opcional.
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {any} input.classRow
 * @param {any[]} input.catalogue
 * @param {SpellChoiceCard} input.card
 * @param {string[]} [input.cantrips]
 * @param {string[]} [input.spells]
 * @param {{out: string, in: string}|null} [input.swap]
 * @returns {{ok: boolean, errors: string[], patch: Record<string, string[]>, learned: string[]}}
 */
export function applySpellPicks({ member, classRow, catalogue, card, cantrips = [], spells = [], swap = null }) {
    const casting = casterOf(classRow);
    /** @type {string[]} */
    const errors = [];
    if (!casting) return { ok: false, errors: ['Su clase no hace magia de 5e.'], patch: {}, learned: [] };
    const pickedCantrips = [...new Set(ids(cantrips))];
    const pickedSpells = [...new Set(ids(spells))];
    const needCantrips = Math.min(card.newCantrips, card.cantripOptions.length);
    const needSpells = Math.min(card.newSpells, card.spellOptions.length);
    const offered = (/** @type {import('./spell-catalogue.js').Spell[]} */ options, /** @type {string} */ id) => options.some(s => s.id === id);

    if (pickedCantrips.length !== needCantrips) errors.push(`Faltan trucos por elegir: ${needCantrips - pickedCantrips.length}.`);
    if (pickedSpells.length !== needSpells) errors.push(`Faltan conjuros por elegir: ${needSpells - pickedSpells.length}.`);
    for (const id of pickedCantrips) if (!offered(card.cantripOptions, id)) errors.push(`${id}: no es uno de los trucos que se ofrecían.`);
    for (const id of pickedSpells) if (!offered(card.spellOptions, id)) errors.push(`${id}: no es uno de los conjuros que se ofrecían.`);
    const swapping = swap && text(swap.out) && text(swap.in);
    if (swapping) {
        if (!card.canSwap) errors.push('Esta clase no cambia conjuros al subir.');
        if (!offered(card.swapOut, text(swap?.out))) errors.push('Lo que se cambia tiene que ser uno que sabía.');
        if (!offered(card.spellOptions, text(swap?.in)) || pickedSpells.includes(text(swap?.in))) errors.push('Lo que entra en el cambio tiene que ser otro de la lista.');
    }
    if (errors.length > 0) return { ok: false, errors, patch: {}, learned: [] };

    /** @type {Record<string, string[]>} */
    const patch = {};
    const learned = [...pickedCantrips, ...pickedSpells, ...(swapping ? [text(swap?.in)] : [])];
    if (pickedCantrips.length > 0 || Array.isArray(member?.cantrips)) patch.cantrips = [...new Set([...ids(member?.cantrips), ...pickedCantrips])];
    if (casting.mode === 'known') {
        const kept = ids(member?.spellsKnown).filter(id => !(swapping && id === text(swap?.out)));
        patch.spellsKnown = [...new Set([...kept, ...pickedSpells, ...(swapping ? [text(swap?.in)] : [])])];
    } else if (casting.mode === 'spellbook') {
        patch.spellbook = [...new Set([...ids(member?.spellbook), ...pickedSpells])];
    }
    // Lo recién copiado entra preparado si cabe: subir de nivel y no poder usar lo que se
    // acaba de aprender hasta dormir sería castigar por subir.
    if (casting.mode !== 'known' && !casting.ritualsOnly) {
        const limit = preparedLimit(classRow, { ...member, level: card.to });
        const now = ids(member?.prepared);
        const fits = casting.mode === 'spellbook' ? pickedSpells : [];
        patch.prepared = [...new Set([...now, ...fits])].slice(0, Math.max(now.length, limit));
        if (patch.prepared.length === 0) patch.prepared = defaultPrepared({ member: { ...member, ...patch, level: card.to }, classRow, catalogue });
    }
    return { ok: true, errors: [], patch, learned };
}
