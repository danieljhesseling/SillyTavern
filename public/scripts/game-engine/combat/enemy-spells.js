/**
 * Enemigos que lanzan conjuros (J19.12 del roadmap sin conexión): la bruja, el nigromante,
 * Strahd. Usan **los mismos** conjuros que el grupo (`conjuros.json`), con sus espacios, y
 * los elige la misma máquina de decidir de siempre (`enemy-abilities.js`).
 *
 * Una ficha del bestiario (del compendio o de un paquete de campaña) puede traer un bloque
 * `spellcasting`, con la forma de los bloques de monstruo de 5e:
 *
 * ```json
 * "spellcasting": {
 *   "ability": "intelligence", "saveDc": 15, "attackBonus": 7, "casterLevel": 9,
 *   "slots": { "1": 4, "2": 3, "3": 3 },
 *   "spells": ["hab-rayo-fuego", "hab-sueno", "mag-bola-fuego"],
 *   "perDay": { "1": ["conj-paso-brumoso"] }
 * }
 * ```
 *
 * - `spells`: los que tiene preparados. Los trucos, a voluntad; los demás gastan espacio.
 * - `slots`: sus espacios. Sin `slots`, los de un lanzador completo de su `casterLevel`.
 * - `perDay`: lo innato, «tantas veces al día cada uno», sin espacio.
 * - `saveDc` y `attackBonus`: su CD y su bono de ataque de conjuro, como en su ficha.
 *
 * Lo gastado se guarda en el enemigo como `slotsUsed`, igual que en el grupo.
 *
 * Puro: lee, comprueba y traduce a habilidades. Lanzar y gastar es de `party.js`.
 *
 * Ver wiki/ROADMAP_SIN_CONEXION.md, J19.12.
 */

import { FULL_CASTER_SLOTS, SLOT_LABELS } from '../rules/spell-slots.js';
import { normalizeSpell, findSpell, SAVE_ABILITIES } from '../rules/spell-catalogue.js';
import { spellToAbility } from '../rules/spell-cast.js';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * @typedef {Object} CasterBlock
 * @property {string} ability
 * @property {number} saveDc
 * @property {number} attackBonus
 * @property {number} casterLevel
 * @property {Record<number, number>} slots
 * @property {string[]} spells
 * @property {Array<{id: string, uses: number}>} perDay
 */

/**
 * El bloque `spellcasting` de una ficha, leído con tolerancia. `null` si no lanza.
 *
 * @param {any} raw
 * @returns {CasterBlock|null}
 */
export function readCasterBlock(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const casterLevel = Math.max(1, Math.min(20, Math.floor(Number(raw.casterLevel) || 1)));
    /** @type {Record<number, number>} */
    const slots = {};
    if (raw.slots && typeof raw.slots === 'object') {
        for (const [key, value] of Object.entries(raw.slots)) {
            const level = Math.floor(Number(key));
            const count = Math.max(0, Math.floor(Number(value) || 0));
            if (level >= 1 && level <= 9 && count > 0) slots[level] = count;
        }
    } else {
        (FULL_CASTER_SLOTS[casterLevel - 1] ?? []).forEach((count, index) => { slots[index + 1] = count; });
    }
    const perDay = raw.perDay && typeof raw.perDay === 'object'
        ? Object.entries(raw.perDay).flatMap(([uses, list]) => (Array.isArray(list) ? list : [])
            .map(id => ({ id: text(id), uses: Math.max(1, Math.floor(Number(uses) || 1)) })).filter(entry => entry.id))
        : [];
    return {
        ability: SAVE_ABILITIES.includes(text(raw.ability)) ? text(raw.ability) : 'intelligence',
        saveDc: Math.max(1, Math.floor(Number(raw.saveDc) || 13)),
        attackBonus: Math.floor(Number(raw.attackBonus) || 0),
        casterLevel,
        slots,
        spells: (Array.isArray(raw.spells) ? raw.spells : []).map(text).filter(Boolean),
        perDay,
    };
}

/**
 * Lo que está mal en un bloque `spellcasting`: conjuros que no existen, o que no puede
 * lanzar con los espacios que tiene. Todos los problemas, no el primero.
 *
 * @param {any} raw
 * @param {any[]} catalogue Las filas de `conjuros.json`.
 * @param {string} [who] El nombre de la ficha, para los mensajes.
 * @returns {string[]}
 */
export function validateCasterBlock(raw, catalogue, who = 'Un enemigo') {
    /** @type {string[]} */
    const errors = [];
    const say = (/** @type {string} */ message) => errors.push(`${who}: ${message}`);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [`${who}: "spellcasting" tiene que ser un objeto.`];
    const spells = (Array.isArray(catalogue) ? catalogue : []).map(normalizeSpell);
    if (raw.ability !== undefined && !SAVE_ABILITIES.includes(text(raw.ability))) say(`"spellcasting.ability" dice "${text(raw.ability)}". Vale: ${SAVE_ABILITIES.join(', ')}.`);
    if (!(Number(raw.saveDc) >= 8 && Number(raw.saveDc) <= 30)) say('"spellcasting.saveDc" tiene que ser su CD de conjuro (de 8 a 30).');
    if (raw.attackBonus !== undefined && !Number.isFinite(Number(raw.attackBonus))) say('"spellcasting.attackBonus" tiene que ser un número.');
    if (raw.slots !== undefined) {
        if (!raw.slots || typeof raw.slots !== 'object' || Array.isArray(raw.slots)) say('"spellcasting.slots" es un objeto: { "1": 4, "2": 3 }.');
        else for (const [key, value] of Object.entries(raw.slots)) {
            if (!(Number.isInteger(Number(key)) && Number(key) >= 1 && Number(key) <= 9)) say(`"spellcasting.slots" tiene un nivel "${key}": van del 1 al 9.`);
            if (!(Number.isInteger(Number(value)) && Number(value) >= 0)) say(`"spellcasting.slots.${key}" tiene que ser un número entero.`);
        }
    }
    if (!Array.isArray(raw.spells) || raw.spells.length === 0) say('"spellcasting.spells" tiene que decir qué conjuros tiene preparados.');
    const block = readCasterBlock(raw);
    const top = Math.max(0, ...Object.keys(block?.slots ?? {}).map(Number));
    for (const id of Array.isArray(raw.spells) ? raw.spells : []) {
        const spell = findSpell(spells, text(id));
        if (!spell) say(`"${text(id)}" no está en conjuros.json.`);
        else if (spell.level > top) say(`${spell.name} es de ${SLOT_LABELS[/** @type {1} */ (spell.level)]} y no tiene espacios de ese nivel.`);
    }
    for (const entry of block?.perDay ?? []) {
        if (!findSpell(spells, entry.id)) say(`"${entry.id}" (perDay) no está en conjuros.json.`);
    }
    return errors;
}

/**
 * Lo que le queda de cada nivel.
 *
 * @param {any} enemy Con `slotsUsed`.
 * @param {CasterBlock} block
 * @returns {Record<number, number>}
 */
export function enemySlotsLeft(enemy, block) {
    /** @type {Record<number, number>} */
    const out = {};
    for (const [level, max] of Object.entries(block.slots)) {
        out[Number(level)] = Math.max(0, max - Math.max(0, Math.floor(Number(enemy?.slotsUsed?.[level]) || 0)));
    }
    return out;
}

/**
 * El espacio más bajo que le sirve para ese nivel, o 0.
 *
 * @param {any} enemy
 * @param {CasterBlock} block
 * @param {number} spellLevel
 * @returns {number}
 */
export function enemySlotFor(enemy, block, spellLevel) {
    const left = enemySlotsLeft(enemy, block);
    for (let level = Math.max(1, spellLevel); level <= 9; level++) if ((left[level] ?? 0) > 0) return level;
    return 0;
}

/**
 * Gastar un espacio de un enemigo, como parche para `slotsUsed`.
 *
 * @param {any} enemy
 * @param {CasterBlock} block
 * @param {number} slotLevel
 * @returns {Record<string, number>}
 */
export function spendEnemySlot(enemy, block, slotLevel) {
    const used = { ...(enemy?.slotsUsed ?? {}) };
    const level = Math.floor(Number(slotLevel) || 0);
    if ((block.slots[level] ?? 0) > 0) used[level] = Math.min(block.slots[level], (Number(used[level]) || 0) + 1);
    return used;
}

/**
 * Sus conjuros como habilidades, listas para `chooseEnemyAbility`:
 *
 * - los trucos, a voluntad;
 * - los de nivel, «de usos contados» (`long_rest`) con tantos usos como espacios le quedan
 *   de su nivel o más, y lanzados con el más bajo que tenga: la máquina los trata como su
 *   golpe especial y los gasta en cuanto llega;
 * - lo innato, con sus usos al día (que cuenta `abilityUses`, como cualquier habilidad).
 *
 * Si ya se concentra en algo, no se ofrecen los que piden concentración: soltar su conjuro
 * por otro sería regalarle la pelea al grupo.
 *
 * @param {Object} input
 * @param {any} input.enemy
 * @param {CasterBlock} input.block
 * @param {any[]} input.catalogue
 * @param {boolean} [input.concentrating]
 * @returns {any[]}
 */
export function enemySpellAbilities({ enemy, block, catalogue, concentrating = false }) {
    const spells = (Array.isArray(catalogue) ? catalogue : []).map(normalizeSpell);
    const modifier = block.attackBonus - (2 + Math.floor((block.casterLevel - 1) / 4));
    const left = enemySlotsLeft(enemy, block);
    const stats = { casterLevel: block.casterLevel, modifier, saveDc: block.saveDc, attackBonus: block.attackBonus };
    /** @type {any[]} */
    const out = [];
    const usable = (/** @type {any} */ spell) => spell && spell.combat !== false && spell.castingTime !== 'reaction'
        && !['minute', '10min', 'hour'].includes(spell.castingTime) && !(concentrating && spell.concentration);

    for (const id of block.spells) {
        const spell = findSpell(spells, id);
        if (!usable(spell)) continue;
        if (spell.level === 0) {
            out.push(spellToAbility(spell, { ...stats, slotLevel: 0 }));
            continue;
        }
        const slot = enemySlotFor(enemy, block, spell.level);
        if (!slot) continue;
        const uses = Object.entries(left).filter(([level]) => Number(level) >= spell.level).reduce((sum, [, n]) => sum + n, 0);
        out.push({ ...spellToAbility(spell, { ...stats, slotLevel: slot }), resource: 'long_rest', usesPerRest: uses, slotLevel: slot });
    }
    for (const entry of block.perDay) {
        const spell = findSpell(spells, entry.id);
        if (!usable(spell)) continue;
        out.push({ ...spellToAbility(spell, { ...stats, slotLevel: spell.level }), resource: 'long_rest', usesPerRest: entry.uses, innate: true });
    }
    return out;
}

/**
 * Tanda 12 (J19.3 para los enemigos): uno de sus conjuros de nivel, lanzado con un espacio
 * mayor. Lo mismo que da `enemySpellAbilities`, con más dados, dardos u objetivos.
 *
 * @param {Object} input
 * @param {any} input.enemy
 * @param {CasterBlock} input.block
 * @param {any[]} input.catalogue
 * @param {string} input.spellId
 * @param {number} input.slotLevel
 * @returns {any|null} La habilidad, o `null` si no lo tiene preparado o no es de nivel.
 */
export function enemySpellAt({ enemy, block, catalogue, spellId, slotLevel }) {
    const spells = (Array.isArray(catalogue) ? catalogue : []).map(normalizeSpell);
    if (!block.spells.includes(spellId)) return null;
    const spell = findSpell(spells, spellId);
    if (!spell || spell.level < 1) return null;
    const modifier = block.attackBonus - (2 + Math.floor((block.casterLevel - 1) / 4));
    const stats = { casterLevel: block.casterLevel, modifier, saveDc: block.saveDc, attackBonus: block.attackBonus };
    const left = enemySlotsLeft(enemy, block);
    const uses = Object.entries(left).filter(([level]) => Number(level) >= spell.level).reduce((sum, [, n]) => sum + n, 0);
    const slot = Math.max(spell.level, Math.floor(Number(slotLevel) || 0));
    return { ...spellToAbility(spell, { ...stats, slotLevel: slot }), resource: 'long_rest', usesPerRest: uses, slotLevel: slot };
}
