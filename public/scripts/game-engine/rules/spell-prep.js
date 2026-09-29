/**
 * Conocidos y preparados (J19.2 del roadmap sin conexión): qué conjuros tiene a mano cada
 * uno, cuántos, y qué elige al subir de nivel.
 *
 * Tres maneras, que dice la columna `casting.mode` de su clase:
 *
 * - **`spellbook`** (el mago): lo que sabe está en su **libro**; cada mañana **prepara**
 *   unos cuantos de ahí. Al subir de nivel entran dos gratis en el libro.
 * - **`prepared`** (el clérigo, el druida): prepara cada mañana de **toda la lista** de su
 *   clase. No aprende: elige.
 * - **`known`** (el bardo, el explorador): **se los sabe**, pocos y siempre los mismos. Al
 *   subir de nivel aprende los nuevos y puede cambiar uno.
 *
 * Cuántos prepara: su modificador + su nivel (`prepares: level`) o + medio nivel (`half`),
 * y nunca menos de uno. Los trucos se saben aparte, se lanzan a voluntad y pegan más a los
 * niveles 5, 11 y 17.
 *
 * En la ficha: `cantrips` (trucos), `spellsKnown` (los que sabe, si es `known`),
 * `spellbook` (el libro, si es `spellbook`) y `prepared` (los de hoy).
 *
 * Puro: cuentas y listas. Guardarlo y enseñarlo es de `party.js`.
 *
 * Ver wiki/ROADMAP_SIN_CONEXION.md, J19.2.
 */

import { casterOf, slotsFor, stepValue, spellcastingStats, SLOT_LABELS } from './spell-slots.js';
import { normalizeSpell, spellsOfClass } from './spell-catalogue.js';

/**
 * Lo que se sabe un lanzador `known` cuando su clase no lo dice: la tabla del SRD más
 * parecida a su progresión (hechicero, explorador, un tercio, brujo).
 */
export const DEFAULT_KNOWN = {
    full: { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9, 9: 10, 10: 11, 11: 12, 13: 13, 15: 14, 17: 15 },
    half: { 2: 2, 3: 3, 5: 4, 7: 5, 9: 6, 11: 7, 13: 8, 15: 9, 17: 10, 19: 11 },
    third: { 3: 3, 4: 4, 7: 5, 8: 6, 10: 7, 11: 8, 13: 9, 14: 10, 16: 11, 19: 12, 20: 13 },
    pact: { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9, 9: 10, 11: 11, 13: 12, 15: 13, 17: 14, 19: 15 },
};

/** Los niveles de personaje en que los trucos pegan más. */
export const CANTRIP_STEPS = [5, 11, 17];

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {number} */
const levelOf = (value) => Math.max(1, Math.min(20, Math.floor(Number(value) || 1)));

/** @param {any} value @returns {string[]} */
const ids = (value) => (Array.isArray(value) ? value : []).map(v => text(typeof v === 'string' ? v : v?.id)).filter(Boolean);

/**
 * Cuántos trucos sabe a ese nivel.
 *
 * @param {any} classRow
 * @param {number} level
 * @returns {number}
 */
export function cantripsKnown(classRow, level) {
    const casting = casterOf(classRow);
    return casting ? stepValue(casting.cantrips, levelOf(level)) : 0;
}

/**
 * Cuántos conjuros (sin los trucos) se sabe un lanzador `known`. Cero para los demás.
 *
 * @param {any} classRow
 * @param {number} level
 * @returns {number}
 */
export function spellsKnownCount(classRow, level) {
    const casting = casterOf(classRow);
    if (!casting || casting.mode !== 'known') return 0;
    return stepValue(casting.known ?? DEFAULT_KNOWN[casting.progression], levelOf(level));
}

/**
 * Cuántos puede preparar cada día un lanzador `spellbook` o `prepared`. Cero para los demás.
 *
 * @param {any} classRow
 * @param {any} member Con su nivel y su característica de lanzar.
 * @returns {number}
 */
export function preparedLimit(classRow, member) {
    const casting = casterOf(classRow);
    if (!casting || casting.mode === 'known') return 0;
    const level = levelOf(member?.level);
    const { modifier } = spellcastingStats(member, classRow);
    return Math.max(1, modifier + (casting.prepares === 'half' ? Math.floor(level / 2) : level));
}

/**
 * Cuántos conjuros entran gratis en el libro hasta ese nivel: seis al empezar y dos por
 * nivel (5e). Lo que se copie de pergaminos va aparte.
 *
 * @param {any} classRow
 * @param {number} level
 * @returns {number}
 */
export function spellbookSize(classRow, level) {
    const casting = casterOf(classRow);
    if (!casting || casting.mode !== 'spellbook') return 0;
    return casting.spellbook.start + casting.spellbook.perLevel * (levelOf(level) - 1);
}

/**
 * El nivel de conjuro más alto que puede lanzar con espacio.
 *
 * @param {any} classRow
 * @param {number} level
 * @returns {number}
 */
export function maxSpellLevel(classRow, level) {
    return slotsFor(classRow, level).maxLevel;
}

/**
 * Por cuánto se multiplican los dados de un truco a ese nivel: 1, 2, 3 o 4.
 *
 * @param {number} level
 * @returns {number}
 */
export function cantripMultiplier(level) {
    const at = levelOf(level);
    return 1 + CANTRIP_STEPS.filter(step => at >= step).length;
}

/**
 * Los dados de un truco a ese nivel: «1d10» es «2d10» en el 5, «3d10» en el 11. Solo los
 * dados; lo que se suma detrás no cambia.
 *
 * @param {string} formula
 * @param {number} level
 * @returns {string}
 */
export function scaleCantrip(formula, level) {
    const times = cantripMultiplier(level);
    if (times === 1) return text(formula);
    return text(formula).replace(/(\d*)d(\d+)/gi, (_, count, sides) => `${Math.max(1, Number(count) || 1) * times}d${sides}`);
}

/**
 * Los conjuros de la lista de su clase, normalizados.
 *
 * @param {any} classRow
 * @param {any[]} catalogue Filas de `conjuros.json` (crudas o normalizadas).
 * @returns {import('./spell-catalogue.js').Spell[]}
 */
export function classSpellList(classRow, catalogue) {
    const casting = casterOf(classRow);
    if (!casting) return [];
    return spellsOfClass((Array.isArray(catalogue) ? catalogue : []).map(normalizeSpell), casting.list);
}

/**
 * Si el conjuro está a mano: un truco que se sabe, o uno que sabe (known) o que ha
 * preparado hoy (los demás), de un nivel que ya lanza.
 *
 * @param {any} member
 * @param {any} classRow
 * @param {import('./spell-catalogue.js').Spell} spell
 * @returns {boolean}
 */
export function isCastableBy(member, classRow, spell) {
    const casting = casterOf(classRow);
    if (!casting || !spell || !spell.classes.includes(casting.list)) return false;
    const has = (/** @type {string[]} */ list) => list.includes(spell.id) || spell.aliases.some(alias => list.includes(alias));
    if (spell.level === 0) return has(ids(member?.cantrips));
    if (spell.level > maxSpellLevel(classRow, member?.level)) return false;
    if (casting.mode === 'known') return has(ids(member?.spellsKnown));
    if (casting.mode === 'spellbook' && !has(ids(member?.spellbook))) return false;
    return has(ids(member?.prepared));
}

/**
 * Lo que puede lanzar ahora mismo: sus trucos y sus conjuros (sabidos o preparados).
 *
 * @param {any} member
 * @param {any} classRow
 * @param {any[]} catalogue
 * @returns {{cantrips: import('./spell-catalogue.js').Spell[], spells: import('./spell-catalogue.js').Spell[]}}
 */
export function castableSpells(member, classRow, catalogue) {
    const all = classSpellList(classRow, catalogue).filter(spell => isCastableBy(member, classRow, spell));
    return { cantrips: all.filter(s => s.level === 0), spells: all.filter(s => s.level > 0) };
}

/**
 * Los rituales que puede lanzar sin gastar espacio: el mago, los de su libro aunque no los
 * tenga preparados; el clérigo y el druida, los preparados; el bardo, los que sabe.
 *
 * @param {any} member
 * @param {any} classRow
 * @param {any[]} catalogue
 * @returns {import('./spell-catalogue.js').Spell[]}
 */
export function ritualSpells(member, classRow, catalogue) {
    const casting = casterOf(classRow);
    if (!casting || !casting.rituals) return [];
    const from = casting.rituals === 'book' ? ids(member?.spellbook)
        : casting.rituals === 'known' ? ids(member?.spellsKnown)
            : ids(member?.prepared);
    const max = maxSpellLevel(classRow, member?.level);
    return classSpellList(classRow, catalogue)
        .filter(spell => spell.ritual && spell.level <= max && (from.includes(spell.id) || spell.aliases.some(alias => from.includes(alias))));
}

/**
 * Si una lista de preparados vale: cuántos caben, de dónde salen y de qué nivel.
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {any} input.classRow
 * @param {any[]} input.catalogue
 * @param {string[]} input.chosen Los ids que quiere preparar.
 * @returns {{ok: boolean, errors: string[], prepared: string[], limit: number}}
 */
export function checkPreparation({ member, classRow, catalogue, chosen }) {
    const casting = casterOf(classRow);
    const wanted = [...new Set(ids(chosen))];
    if (!casting || casting.mode === 'known') {
        return { ok: false, errors: ['Esta clase no prepara: se sabe sus conjuros.'], prepared: [], limit: 0 };
    }
    const limit = preparedLimit(classRow, member);
    const max = maxSpellLevel(classRow, member?.level);
    const list = classSpellList(classRow, catalogue);
    const book = ids(member?.spellbook);
    /** @type {string[]} */
    const errors = [];
    if (wanted.length > limit) errors.push(`Caben ${limit} y se han elegido ${wanted.length}.`);
    for (const id of wanted) {
        const spell = list.find(s => s.id === id || s.aliases.includes(id));
        if (!spell) errors.push(`${id}: no es de la lista de su clase.`);
        else if (spell.level === 0) errors.push(`${spell.name}: los trucos no se preparan, se saben.`);
        else if (spell.level > max) errors.push(`${spell.name}: todavía no lanza conjuros de ${SLOT_LABELS[/** @type {1} */ (spell.level)]}.`);
        else if (casting.mode === 'spellbook' && !book.includes(spell.id) && !spell.aliases.some(a => book.includes(a))) {
            errors.push(`${spell.name}: no está en su libro.`);
        }
    }
    return { ok: errors.length === 0, errors, prepared: errors.length === 0 ? wanted : [], limit };
}

/**
 * @typedef {Object} SpellChoices
 * @property {number} level
 * @property {number} maxSpellLevel
 * @property {boolean} newSpellLevel Si con este nivel lanza un nivel de conjuro nuevo.
 * @property {number} newCantrips Cuántos trucos nuevos elige.
 * @property {import('./spell-catalogue.js').Spell[]} cantripOptions
 * @property {number} newSpells Cuántos conjuros nuevos aprende (known) o entran en su libro (spellbook).
 * @property {import('./spell-catalogue.js').Spell[]} spellOptions
 * @property {boolean} canSwap Si puede cambiar uno que sabía por otro (known).
 * @property {number} preparedLimit Cuántos prepara desde ahora (spellbook y prepared).
 * @property {string[]} lines Lo mismo, en frases para la tarjeta de nivel.
 */

/**
 * Lo que elige al llegar a un nivel: la tarjeta de subir de nivel, en datos.
 *
 * Las opciones no repiten lo que ya tiene. Para el nivel 1 es todo lo inicial: sus trucos,
 * y sus conjuros o su libro.
 *
 * @param {Object} input
 * @param {any} input.classRow
 * @param {number} input.level El nivel al que llega.
 * @param {any[]} input.catalogue
 * @param {any} [input.member] Lo que ya sabe (y su característica, para los preparados).
 * @returns {SpellChoices}
 */
export function spellChoicesAtLevel({ classRow, level, catalogue, member = {} }) {
    const casting = casterOf(classRow);
    const at = levelOf(level);
    const before = at - 1;
    const empty = {
        level: at, maxSpellLevel: 0, newSpellLevel: false, newCantrips: 0, cantripOptions: [],
        newSpells: 0, spellOptions: [], canSwap: false, preparedLimit: 0, lines: [],
    };
    if (!casting) return empty;

    const max = maxSpellLevel(classRow, at);
    const maxBefore = before >= 1 ? maxSpellLevel(classRow, before) : 0;
    const list = classSpellList(classRow, catalogue);
    const has = new Set([...ids(member?.cantrips), ...ids(member?.spellsKnown), ...ids(member?.spellbook)]);
    const fresh = (/** @type {import('./spell-catalogue.js').Spell} */ spell) => !has.has(spell.id) && !spell.aliases.some(a => has.has(a));

    const newCantrips = Math.max(0, cantripsKnown(classRow, at) - (before >= 1 ? cantripsKnown(classRow, before) : 0));
    let newSpells = 0;
    if (casting.mode === 'known') newSpells = Math.max(0, spellsKnownCount(classRow, at) - (before >= 1 ? spellsKnownCount(classRow, before) : 0));
    if (casting.mode === 'spellbook') newSpells = at === 1 ? casting.spellbook.start : casting.spellbook.perLevel;
    const canSwap = casting.mode === 'known' && at > 1 && max > 0;
    const limit = casting.mode === 'known' ? 0 : preparedLimit(classRow, { ...member, level: at });

    const choices = {
        level: at,
        maxSpellLevel: max,
        newSpellLevel: max > maxBefore,
        newCantrips,
        cantripOptions: newCantrips > 0 ? list.filter(s => s.level === 0 && fresh(s)) : [],
        newSpells,
        spellOptions: newSpells > 0 || canSwap ? list.filter(s => s.level > 0 && s.level <= max && fresh(s)) : [],
        canSwap,
        preparedLimit: limit,
        lines: /** @type {string[]} */ ([]),
    };

    if (choices.newSpellLevel) choices.lines.push(`Ya lanza conjuros de ${SLOT_LABELS[/** @type {1} */ (max)]}.`);
    if (newCantrips > 0) choices.lines.push(`Aprende ${newCantrips === 1 ? 'un truco nuevo' : `${newCantrips} trucos nuevos`}.`);
    if (casting.mode === 'known' && newSpells > 0) choices.lines.push(`Aprende ${newSpells === 1 ? 'un conjuro nuevo' : `${newSpells} conjuros nuevos`}.`);
    if (casting.mode === 'spellbook' && newSpells > 0) choices.lines.push(`Copia ${newSpells} conjuros en su libro.`);
    if (canSwap) choices.lines.push('Puede cambiar uno que sabía por otro.');
    if (limit > 0) choices.lines.push(`Prepara ${limit} cada mañana.`);
    return choices;
}

/**
 * Los huecos del archivo: una clase que lanza y no tiene nada que lanzar de algún nivel al
 * que llega. Es la comprobación del compendio de J19.11.
 *
 * - En cada nivel de personaje pedido, un conjuro al menos de cada nivel de espacio que ya
 *   tenga.
 * - Tantos trucos como sabe, y a los `known`, tantos conjuros como se sabe.
 *
 * @param {Object} input
 * @param {any[]} input.classRows Las filas de `clases.json`.
 * @param {any[]} input.catalogue Las de `conjuros.json`.
 * @param {number[]} [input.levels]
 * @returns {string[]} Vacío si no falta nada.
 */
export function coverageGaps({ classRows, catalogue, levels = [1, 2, 3, 4, 5] }) {
    /** @type {string[]} */
    const gaps = [];
    for (const row of Array.isArray(classRows) ? classRows : []) {
        const casting = casterOf(row);
        if (!casting) continue;
        const list = classSpellList(row, catalogue);
        const name = text(row?.name) || text(row?.id);
        for (const level of levels) {
            const max = maxSpellLevel(row, level);
            for (let spellLevel = 1; spellLevel <= max; spellLevel++) {
                if (!list.some(s => s.level === spellLevel)) gaps.push(`${name}, nivel ${level}: no tiene conjuros de ${SLOT_LABELS[/** @type {1} */ (spellLevel)]}.`);
            }
            const cantrips = cantripsKnown(row, level);
            const haveCantrips = list.filter(s => s.level === 0).length;
            if (haveCantrips < cantrips) gaps.push(`${name}, nivel ${level}: sabe ${cantrips} trucos y su lista tiene ${haveCantrips}.`);
            const known = spellsKnownCount(row, level);
            const haveSpells = list.filter(s => s.level > 0 && s.level <= max).length;
            if (haveSpells < known) gaps.push(`${name}, nivel ${level}: se sabe ${known} conjuros y su lista tiene ${haveSpells}.`);
        }
    }
    return [...new Set(gaps)];
}
