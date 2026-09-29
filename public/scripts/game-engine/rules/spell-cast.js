/**
 * Lanzar un conjuro de 5e: con qué espacio, qué hace a ese nivel, qué pide y si se puede
 * ahora (J19.3 y J19.8 del roadmap sin conexión).
 *
 * - **Lanzar a más nivel** (J19.3): el mismo conjuro con un espacio mayor hace más. Lo que
 *   sube lo dice su columna `upcast`, por cada nivel de más: `{"dice": "1d6"}` suma un dado
 *   de daño, `{"targets": 1}` un objetivo más, `{"rays": 1}` un rayo más. Con `"every": 2`,
 *   cada dos niveles.
 * - **Componentes** (J19.8): V son palabras (en un silencio no se pueden decir), S gestos y
 *   M un material. El material corriente lo cubre un **foco** (un bastón, un amuleto, un
 *   instrumento) o una **bolsa de componentes**; el que tiene precio (`material.costGp`) hay
 *   que llevarlo, y si dice `consumed`, se gasta. Desde D-J25 las tiendas venden la perla, el
 *   diamante, el incienso, el agua bendita, la bolsa y el laúd, así que el foco **se exige**
 *   (`strict`, encendido si no se dice otra cosa).
 * - **Rituales** (J19.8): un conjuro con `ritual` se puede lanzar **sin gastar espacio**,
 *   tardando diez minutos más, y nunca peleando.
 *
 * Y el puente con la capa ligera: `spellToAbility` convierte el conjuro, ya subido de nivel,
 * en una habilidad que `planAbilityUse` sabe resolver (tirada, salvación, daño, estado).
 *
 * Puro: decide y cuenta. Gastar el espacio es `spendSlot`; quitar el material, `party.js`.
 *
 * Ver wiki/ROADMAP_SIN_CONEXION.md, J19.3 y J19.8.
 */

import { casterOf, lowestFreeSlot, slotsLeft, SLOT_LABELS } from './spell-slots.js';
import { isCastableBy, maxSpellLevel, scaleCantrip } from './spell-prep.js';
import { CASTING_LABELS, CASTING_MINUTES, SPELL_SCHOOLS, DAMAGE_TYPES, ABILITY_NAMES } from './spell-catalogue.js';
import { describeArea } from './area.js';

/** Lo que cuenta como foco de cada tipo, por cómo empieza su nombre (sin acentos). */
export const FOCUS_WORDS = {
    Arcane: ['baston', 'varita', 'vara', 'orbe', 'cristal'],
    Divine: ['amuleto', 'simbolo', 'relicario', 'escudo'],
    Druidic: ['baston', 'vara', 'muerdago', 'totem'],
    Instrument: ['laud', 'flauta', 'lira', 'tambor', 'gaita', 'violin', 'instrumento'],
};

/** Lo que sirve a cualquiera en vez de foco. */
export const COMPONENT_POUCH = 'Bolsa de componentes';

/** Cómo se dice cada tipo de foco cuando falta: con ejemplos, que «foco arcano» no dice nada. */
export const FOCUS_SAID = {
    Arcane: 'un bastón, una varita o un orbe',
    Divine: 'un símbolo sagrado, un amuleto o el escudo con el emblema',
    Druidic: 'un bastón, una vara o una rama de muérdago',
    Instrument: 'un instrumento, como un laúd',
};

/** Los minutos que un ritual añade a lo que tarda el conjuro. */
export const RITUAL_EXTRA_MINUTES = 10;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string} */
const plain = (value) => text(value).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Una fórmula en sus trozos: dados por caras, en el orden en que salen, y lo fijo.
 *
 * @param {string} formula
 * @returns {{dice: Map<number, number>, flat: number}}
 */
function parseFormula(formula) {
    /** @type {Map<number, number>} */
    const dice = new Map();
    let flat = 0;
    for (const term of text(formula).replace(/\s+/g, '').match(/[+-]?[^+-]+/g) ?? []) {
        const sign = term.startsWith('-') ? -1 : 1;
        const body = term.replace(/^[+-]/, '');
        const match = body.match(/^(\d*)d(\d+)$/i);
        if (match) {
            const sides = Number(match[2]);
            dice.set(sides, (dice.get(sides) ?? 0) + sign * Math.max(1, Number(match[1]) || 1));
        } else {
            flat += sign * (Number(body) || 0);
        }
    }
    return { dice, flat };
}

/**
 * Sumar dados a una fórmula, tantas veces como se pida: «8d6» + «1d6» × 2 = «10d6»;
 * «3d4+3» + «1d4+1» = «4d4+4».
 *
 * @param {string} formula
 * @param {string} extra
 * @param {number} [times]
 * @returns {string}
 */
export function addDice(formula, extra, times = 1) {
    const n = Math.max(0, Math.floor(Number(times) || 0));
    if (!text(extra) || n === 0) return text(formula);
    const base = parseFormula(formula);
    const more = parseFormula(extra);
    for (const [sides, count] of more.dice) base.dice.set(sides, (base.dice.get(sides) ?? 0) + count * n);
    base.flat += more.flat * n;
    const parts = [...base.dice].filter(([, count]) => count > 0).map(([sides, count]) => `${count}d${sides}`);
    if (base.flat !== 0 || parts.length === 0) parts.push(String(base.flat));
    return parts.join('+').replace(/\+-/g, '-');
}

/**
 * Cuántos «escalones» sube un conjuro con ese espacio.
 *
 * @param {import('./spell-catalogue.js').Spell} spell
 * @param {number} slotLevel
 * @returns {number}
 */
export function upcastSteps(spell, slotLevel) {
    if (!spell || spell.level === 0) return 0;
    const extra = Math.max(0, Math.floor(Number(slotLevel) || 0) - spell.level);
    const every = Math.max(1, Math.floor(Number(spell.upcast?.every) || 1));
    return Math.floor(extra / every);
}

/**
 * @typedef {Object} Upcast
 * @property {number} slotLevel
 * @property {number} steps
 * @property {string} damage
 * @property {string} healing
 * @property {string} hpPool
 * @property {number} targets
 * @property {number} rays
 * @property {import('./area.js').Area} area
 * @property {number} count Cuántas criaturas invoca.
 * @property {number} maxHpBonus
 */

/**
 * Lo que hace un conjuro lanzado con ese espacio.
 *
 * @param {import('./spell-catalogue.js').Spell} spell
 * @param {number} slotLevel
 * @returns {Upcast}
 */
export function upcastSpell(spell, slotLevel) {
    const steps = upcastSteps(spell, slotLevel);
    const up = spell.upcast ?? {};
    const more = (/** @type {string} */ key) => Math.max(0, Math.floor(Number(up[key]) || 0)) * steps;
    const baseCount = Math.max(1, Math.floor(Number(spell.summon?.count) || 1));
    return {
        slotLevel: Math.max(spell.level, Math.floor(Number(slotLevel) || spell.level)),
        steps,
        damage: addDice(spell.damage, text(up.dice), steps),
        healing: addDice(spell.healing, text(up.healing), steps),
        hpPool: addDice(spell.hpPool, text(up.hpPool), steps),
        targets: spell.targets + more('targets'),
        rays: spell.rays > 0 ? spell.rays + more('rays') : 0,
        area: spell.area.shape === 'single' ? spell.area : { ...spell.area, size: spell.area.size + more('radius') },
        count: baseCount + more('count'),
        maxHpBonus: spell.maxHpBonus + more('maxHpBonus'),
    };
}

/**
 * A quién alcanza un conjuro que va por puntos de vida (Dormir): de menos vida a más, hasta
 * gastar lo que salió en los dados. Quien no cabe entero en lo que queda, se libra; y quien
 * ya está en el suelo no cuenta.
 *
 * @template {{currentHp?: number, hp?: number}} T
 * @param {T[]} creatures Los que están dentro del área.
 * @param {number} pool Lo que salió en `hpPool`.
 * @returns {T[]}
 */
export function hpPoolTargets(creatures, pool) {
    let left = Math.max(0, Math.floor(Number(pool) || 0));
    const hpOf = (/** @type {T} */ c) => Math.max(0, Math.floor(Number(c?.currentHp ?? c?.hp) || 0));
    /** @type {T[]} */
    const out = [];
    for (const creature of [...(Array.isArray(creatures) ? creatures : [])].filter(c => hpOf(c) > 0).sort((a, b) => hpOf(a) - hpOf(b))) {
        if (hpOf(creature) > left) break;
        left -= hpOf(creature);
        out.push(creature);
    }
    return out;
}

/**
 * Una fórmula con el modificador de lanzar sumado: «1d8» y +3 = «1d8+3».
 *
 * @param {string} formula
 * @param {number} modifier
 * @returns {string}
 */
function withModifier(formula, modifier) {
    if (!text(formula) || !modifier) return text(formula);
    return addDice(formula, String(modifier));
}

/**
 * El conjuro como habilidad de la capa ligera, ya subido de nivel y con los números de quien
 * lo lanza, para que `planAbilityUse` lo resuelva igual que siempre.
 *
 * `resource` va a `at_will` a propósito: el espacio lo paga `spendSlot`, y
 * `abilities.js` no tiene que contar usos. Y **no** lleva `circle`, que es lo que haría
 * que gastase las cargas del grimorio de la capa ligera.
 *
 * @param {import('./spell-catalogue.js').Spell} spell
 * @param {Object} [caster]
 * @param {number} [caster.slotLevel]
 * @param {number} [caster.casterLevel] Para los trucos.
 * @param {number} [caster.modifier]
 * @param {number} [caster.saveDc]
 * @param {number} [caster.attackBonus]
 * @returns {Record<string, any>}
 */
export function spellToAbility(spell, { slotLevel = spell.level, casterLevel = 1, modifier = 0, saveDc = 13, attackBonus = 0 } = {}) {
    const up = upcastSpell(spell, slotLevel);
    const damage = spell.level === 0 ? scaleCantrip(spell.damage, casterLevel) : up.damage;
    return {
        id: spell.id,
        name: spell.name,
        description: spell.note,
        cost: spell.castingTime === 'bonus' ? 'bonus' : spell.castingTime === 'reaction' ? 'free' : 'action',
        resource: 'at_will',
        usesPerRest: 1,
        rangeFeet: spell.target === 'self' ? 0 : spell.rangeFeet,
        target: spell.target === 'point' ? 'enemy' : spell.target,
        resolution: spell.attack ? 'attack' : spell.save ? 'save' : 'auto',
        saveAbility: spell.save || 'dexterity',
        saveDc,
        damage: spell.addModifier ? withModifier(damage, modifier) : damage,
        damageType: spell.damageType,
        healing: spell.addModifier ? withModifier(up.healing, modifier) : up.healing,
        condition: spell.condition,
        conditionRounds: spell.conditionRounds,
        area: up.area,
        element: spell.element,
        leaves: spell.leaves,
        school: spell.school,
        // Lo de 5e, para quien lo quiera leer: `planAbilityUse` no lo mira.
        spellLevel: spell.level,
        slotLevel: spell.level === 0 ? 0 : up.slotLevel,
        concentration: spell.concentration,
        onSave: spell.onSave,
        attackBonus,
        targets: up.targets,
        rays: up.rays,
        point: spell.target === 'point',
        ...(spell.drain ? { drain: true } : {}),
        ...(spell.combat === false ? { combat: false } : {}),
    };
}

/**
 * Si alguien lleva un foco que le sirve, o la bolsa de componentes.
 *
 * @param {any[]} carried Nombres u objetos (con `name` y, si es un objeto del juego, `focusType`).
 * @param {string} focus El tipo de foco de su clase.
 * @returns {boolean}
 */
export function hasFocus(carried, focus) {
    const words = /** @type {Record<string, string[]>} */ (FOCUS_WORDS)[text(focus)] ?? [];
    return (Array.isArray(carried) ? carried : []).some(item => {
        const name = plain(typeof item === 'string' ? item : item?.name);
        if (name === plain(COMPONENT_POUCH)) return true;
        if (item && typeof item === 'object' && (text(item.focusType) === text(focus) || text(item.subcategory) === 'magic_focus')) return true;
        return words.some(word => name.startsWith(word));
    });
}

/**
 * Lo que piden sus componentes, y si se tiene.
 *
 * Lo caro y lo que se gasta se exige siempre: es lo que lo hace caro. El foco (o la bolsa de
 * componentes), desde D-J25, también: ya se venden en las tiendas. Con `strict` apagado (un
 * modo más suave, si alguna vez se quiere) se lanza igual y se avisa.
 *
 * @param {import('./spell-catalogue.js').Spell} spell
 * @param {Object} [input]
 * @param {any[]} [input.carried]
 * @param {string} [input.focus]
 * @param {boolean} [input.silenced] Si está en un silencio (o amordazado).
 * @param {boolean} [input.strict] Si el foco se exige (sí, si no se dice).
 * @returns {{ok: boolean, reason: string, warnings: string[], consumes: string[]}}
 */
export function componentsCheck(spell, { carried = [], focus = '', silenced = false, strict = true } = {}) {
    /** @type {string[]} */
    const warnings = [];
    if (spell.components.includes('V') && silenced) {
        return { ok: false, reason: 'Aquí no se oye nada: no puede decir las palabras del conjuro.', warnings, consumes: [] };
    }
    if (!spell.components.includes('M')) return { ok: true, reason: '', warnings, consumes: [] };

    const material = spell.material;
    if (material && (material.costGp > 0 || material.consumed)) {
        const names = (Array.isArray(carried) ? carried : []).map(item => plain(typeof item === 'string' ? item : item?.name));
        if (!names.some(name => name === plain(material.name) || name.startsWith(`${plain(material.name)} `))) {
            const price = material.costGp > 0 ? ` (${material.costGp} de oro)` : '';
            const spent = material.consumed ? ', que se gasta al lanzarlo' : '';
            return { ok: false, reason: `Para ${spell.name} hace falta: ${material.name.toLowerCase()}${price}${spent}. Se compra en las tiendas.`, warnings, consumes: [] };
        }
        return { ok: true, reason: '', warnings, consumes: material.consumed ? [material.name] : [] };
    }

    if (!hasFocus(carried, focus)) {
        const example = /** @type {Record<string, string>} */ (FOCUS_SAID)[text(focus)];
        const what = example ? `un foco (${example})` : 'un foco';
        if (strict) return { ok: false, reason: `Para ${spell.name} hace falta ${what} o una ${COMPONENT_POUCH.toLowerCase()}. Se compran en las tiendas.`, warnings, consumes: [] };
        warnings.push(`Sin foco ni ${COMPONENT_POUCH.toLowerCase()}: se lanza igual, a pulso.`);
    }
    return { ok: true, reason: '', warnings, consumes: [] };
}

/**
 * Si lo puede lanzar como ritual: sin espacio, sin pelear y con diez minutos más.
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {any} input.classRow
 * @param {import('./spell-catalogue.js').Spell} input.spell
 * @param {boolean} [input.inCombat]
 * @returns {{ok: boolean, reason: string, minutes: number}}
 */
export function ritualCheck({ member, classRow, spell, inCombat = false }) {
    const casting = casterOf(classRow);
    const minutes = (/** @type {Record<string, number>} */ (CASTING_MINUTES)[spell.castingTime] ?? 0) + RITUAL_EXTRA_MINUTES;
    if (!spell.ritual) return { ok: false, reason: `${spell.name} no es un ritual.`, minutes: 0 };
    if (!casting?.rituals) return { ok: false, reason: 'Su clase no lanza rituales.', minutes: 0 };
    if (inCombat) return { ok: false, reason: 'Un ritual lleva diez minutos: peleando no hay tiempo.', minutes };
    if (!spell.classes.includes(casting.list) || spell.level > maxSpellLevel(classRow, member?.level)) {
        return { ok: false, reason: `${spell.name} no está a su alcance.`, minutes };
    }
    const from = casting.rituals === 'book' ? member?.spellbook : casting.rituals === 'known' ? member?.spellsKnown : member?.prepared;
    const list = (Array.isArray(from) ? from : []).map(text);
    if (!list.includes(spell.id) && !spell.aliases.some(alias => list.includes(alias))) {
        const where = casting.rituals === 'book' ? 'en su libro' : casting.rituals === 'known' ? 'entre los que sabe' : 'preparado';
        return { ok: false, reason: `Para lanzarlo como ritual tiene que tenerlo ${where}.`, minutes };
    }
    return { ok: true, reason: '', minutes };
}

/**
 * @typedef {Object} CastVerdict
 * @property {boolean} ok
 * @property {string} reason Por qué no, en una frase.
 * @property {number} slotLevel El espacio que gastará (0: truco o ritual).
 * @property {boolean} ritual
 * @property {number} minutes Lo que tarda fuera de combate (0 si es de una acción).
 * @property {string[]} consumes El material que se gasta.
 * @property {string[]} warnings
 */

/**
 * Si alguien puede lanzar un conjuro ahora, con qué espacio, y si no, por qué.
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {any} input.classRow
 * @param {import('./spell-catalogue.js').Spell} input.spell
 * @param {number} [input.slotLevel] El espacio elegido; sin decir, el más bajo que sirva.
 * @param {boolean} [input.inCombat]
 * @param {boolean} [input.hasAction]
 * @param {boolean} [input.hasBonus]
 * @param {boolean} [input.hasReaction]
 * @param {any[]} [input.carried]
 * @param {boolean} [input.silenced]
 * @param {boolean} [input.strictComponents] Si el foco se exige (D-J25: sí, si no se dice).
 * @param {boolean} [input.asRitual]
 * @returns {CastVerdict}
 */
export function canCastSpell({
    member, classRow, spell, slotLevel, inCombat = true, hasAction = true, hasBonus = true, hasReaction = true,
    carried = [], silenced = false, strictComponents = true, asRitual = false,
}) {
    /** @type {(reason: string) => CastVerdict} */
    const no = (reason) => ({ ok: false, reason, slotLevel: 0, ritual: asRitual, minutes: 0, consumes: [], warnings: [] });
    if (!spell) return no('Ese conjuro no existe.');
    const casting = casterOf(classRow);
    if (!casting) return no('Su clase no lanza conjuros de nivel.');
    // D-J27: quien solo lanza rituales (el erudito) no tiene espacios: como ritual, o nada.
    if (casting.ritualsOnly && !asRitual) {
        return no(spell.ritual
            ? `Solo lanza rituales, sin espacios: ${spell.name} se lanza como ritual (diez minutos más, y no peleando).`
            : `Solo lanza rituales, sin espacios: ${spell.name} no es un ritual.`);
    }

    let minutes = /** @type {Record<string, number>} */ (CASTING_MINUTES)[spell.castingTime] ?? 0;
    if (asRitual) {
        const ritual = ritualCheck({ member, classRow, spell, inCombat });
        if (!ritual.ok) return no(ritual.reason);
        minutes = ritual.minutes;
    } else if (!isCastableBy(member, classRow, spell)) {
        return no(casting.mode === 'known' ? `No se sabe ${spell.name}.` : `No tiene ${spell.name} preparado.`);
    }

    if (inCombat && spell.combat === false) return no('Esto no se usa peleando.');
    if (inCombat && minutes > 0) return no(`${spell.name} lleva ${CASTING_LABELS[/** @type {'minute'} */ (spell.castingTime)]}: en mitad de una pelea no da tiempo.`);
    if (inCombat && spell.castingTime === 'action' && !hasAction) return no('La acción de este turno ya está gastada.');
    if (inCombat && spell.castingTime === 'bonus' && !hasBonus) return no('La acción adicional de este turno ya está gastada.');
    if (inCombat && spell.castingTime === 'reaction' && !hasReaction) return no('La reacción de esta ronda ya está gastada.');

    let slot = 0;
    if (spell.level > 0 && !asRitual) {
        const wanted = slotLevel === undefined ? lowestFreeSlot(member, classRow, spell.level) : Math.floor(Number(slotLevel) || 0);
        if (wanted === 0) return no(`Sin espacios de ${SLOT_LABELS[/** @type {1} */ (spell.level)]} o más: vuelven con un descanso.`);
        if (wanted < spell.level) return no(`${spell.name} es de ${SLOT_LABELS[/** @type {1} */ (spell.level)]}: no cabe en un espacio menor.`);
        const left = slotsLeft(member, classRow);
        const free = left.pactLevel > 0 ? (wanted <= left.pactLevel && left.pact > 0) : (left.slots[wanted] ?? 0) > 0;
        if (!free) return no(`No le quedan espacios de ${SLOT_LABELS[/** @type {1} */ (wanted)]}.`);
        slot = left.pactLevel > 0 ? left.pactLevel : wanted;
    }

    const parts = componentsCheck(spell, { carried, focus: casting.focus, silenced, strict: strictComponents });
    if (!parts.ok) return no(parts.reason);

    return { ok: true, reason: '', slotLevel: slot, ritual: asRitual, minutes, consumes: parts.consumes, warnings: parts.warnings };
}

/**
 * El conjuro en una línea, para la lista y el `title` de su botón: «Bola de fuego · 3.er
 * nivel, evocación · acción · 150 ft · radio de 20 ft · salva Destreza · 8d6 fuego».
 *
 * @param {import('./spell-catalogue.js').Spell} spell
 * @param {number} [slotLevel] Si se lanza con un espacio mayor, lo que hace con él.
 * @returns {string}
 */
export function describeSpell5e(spell, slotLevel) {
    const up = upcastSpell(spell, slotLevel ?? spell.level);
    const school = /** @type {Record<string, {label: string}>} */ (SPELL_SCHOOLS)[spell.school]?.label.toLowerCase() ?? spell.school;
    const parts = [
        spell.name,
        `${spell.level === 0 ? 'truco' : SLOT_LABELS[/** @type {1} */ (up.slotLevel)]}, ${school}`,
        CASTING_LABELS[/** @type {'action'} */ (spell.castingTime)]?.toLowerCase() ?? spell.castingTime,
        spell.target === 'self' && spell.area.shape === 'single' ? 'sobre ti' : spell.rangeFeet <= 5 && spell.target !== 'self' ? 'tocando' : `${spell.rangeFeet} ft`,
    ];
    const area = describeArea(up.area);
    if (area) parts.push(area);
    if (spell.save) parts.push(`salva ${ABILITY_NAMES[/** @type {'strength'} */ (spell.save)] ?? spell.save}`);
    if (spell.attack) parts.push('tirada de ataque');
    if (up.damage) parts.push(`${up.rays > 1 ? `${up.rays} × ` : ''}${up.damage} ${DAMAGE_TYPES[/** @type {'Fire'} */ (spell.damageType)] ?? ''}`.trim());
    if (up.healing) parts.push(`cura ${up.healing}${spell.addModifier ? ' + mod.' : ''}`);
    if (up.targets > 1) parts.push(`hasta ${up.targets}`);
    if (spell.concentration) parts.push('concentración');
    if (spell.ritual) parts.push('ritual');
    if (spell.material?.costGp) parts.push(`${spell.material.name.toLowerCase()} de ${spell.material.costGp} mo${spell.material.consumed ? ', se gasta' : ''}`);
    return parts.join(' · ');
}
