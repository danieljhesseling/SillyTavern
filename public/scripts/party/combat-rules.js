/**
 * Combat rules: dice, board geometry, damage formulas and encounter shape.
 *
 * Extracted from party.js as the first slice of its decomposition. Everything here is
 * pure: no DOM, no module state, no reads of the active encounter. That is what makes it
 * testable in Node, and the reason this slice was chosen first.
 *
 * See wiki/ROADMAP.md, Bateria 2.
 */

import { getAbilityModifier } from '../dnd-system.js';
import { createEncounter, normalizeEncounter } from '../game-engine/combat/turn-machine.js';
import { weaponDamage, weaponRange } from '../game-engine/rules/equipment.js';

/** @typedef {import('./types.js').PartyMember} PartyMember */

/**
 * How a cover bonus reads in the combat log, or nothing when there is none.
 *
 * Cover that changes a roll without saying so looks like a bug to a player counting on
 * their fingers, and this engine's whole claim is that any result can be audited.
 *
 * @param {number} coverBonus
 * @returns {string}
 */
export function describeCover(coverBonus) {
    const bonus = Number(coverBonus) || 0;
    if (bonus <= 0) return '';
    const label = bonus >= 5 ? 'cobertura 3/4' : 'cobertura media';
    return ` (incluye +${bonus} por ${label})`;
}

/**
 * @param {string} formula
 * @param {number} [fallbackSides=20]
 */
export function rollDice(formula, fallbackSides = 20) {
    return rollDiceDetailed(formula, fallbackSides).total;
}

/**
 * Roll dice by formula with breakdown support.
 * @param {string} formula
 * @param {number} [fallbackSides=20]
 * @returns {{formula: string, rolls: number[], modifier: number, total: number, natural: number|null}}
 */
/**
 * The source of randomness every roll in the game goes through.
 *
 * `Math.random` by default. A seeded one can be put in its place, and then a fight rolls
 * the same way twice — which is what makes it possible to say whether a change to a
 * prompt or a rule improved anything, instead of noticing that the fight went
 * differently and shrugging.
 *
 * Null means chance, and `Math.random` is then looked up **at each roll** rather than
 * captured here: capturing it broke every test that stubs `Math.random`, because the
 * module went on holding the original function.
 *
 * @type {(() => number)|null}
 */
let randomSource = null;

/**
 * Replace the die. Pass nothing to go back to chance.
 *
 * @param {(() => number)|null} random
 */
export function setRandomSource(random) {
    randomSource = typeof random === 'function' ? random : null;
}

/** Whether rolls are currently repeatable. */
export function isSeeded() {
    return randomSource !== null;
}

/**
 * One number in [0, 1), from whichever die is in force.
 *
 * Exported because anything that rolls has to roll **this** die: una tirada que se saltara
 * la semilla —la tabla de heridas, por ejemplo— haria que dos partidas con la misma
 * semilla dejaran de salir iguales, que es justo lo unico que la semilla promete.
 *
 * @returns {number}
 */
export function nextRandom() {
    return randomSource ? randomSource() : Math.random();
}

export function rollDiceDetailed(formula, fallbackSides = 20) {
    const normalized = String(formula || '').trim() || `1d${fallbackSides}`;
    const match = normalized.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (!match) {
        const total = Math.floor(nextRandom() * fallbackSides) + 1;
        return { formula: normalized, rolls: [total], modifier: 0, total, natural: total };
    }

    const count = Math.max(1, parseInt(match[1], 10) || 1);
    const sides = Math.max(2, parseInt(match[2], 10) || fallbackSides);
    const modifier = parseInt(match[3] || '0', 10) || 0;
    const rolls = [];
    for (let index = 0; index < count; index++) {
        rolls.push(Math.floor(nextRandom() * sides) + 1);
    }

    return {
        formula: normalized,
        rolls,
        modifier,
        total: rolls.reduce((sum, value) => sum + value, 0) + modifier,
        natural: count === 1 && sides === 20 ? rolls[0] : null,
    };
}

/**
 * @param {number|null} natural
 * @param {number} total
 * @param {number|null} dc
 * @returns {'critical-success'|'success'|'failure'|'critical-failure'}
 */
export function getRollClassification(natural, total, dc) {
    if (natural === 20) return 'critical-success';
    if (natural === 1) return 'critical-failure';
    if (dc == null) return 'success';
    return total >= dc ? 'success' : 'failure';
}

/**
 * @param {'critical-success'|'success'|'failure'|'critical-failure'} classification
 */
export function getRollClassificationLabel(classification) {
    if (classification === 'critical-success') return 'Victoria critica';
    if (classification === 'critical-failure') return 'Fracaso critico';
    if (classification === 'failure') return 'Fracaso';
    return 'Victoria';
}

/**
 * @param {number} ax
 * @param {number} ay
 * @param {number} bx
 * @param {number} by
 */
export function getDistanceInCells(ax, ay, bx, by) {
    const safeAx = Number(ax);
    const safeAy = Number(ay);
    const safeBx = Number(bx);
    const safeBy = Number(by);
    const fromX = Number.isFinite(safeAx) ? safeAx : 0;
    const fromY = Number.isFinite(safeAy) ? safeAy : 0;
    const toX = Number.isFinite(safeBx) ? safeBx : 0;
    const toY = Number.isFinite(safeBy) ? safeBy : 0;
    return Math.max(Math.abs(fromX - toX), Math.abs(fromY - toY));
}

/**
 * @param {number} ax
 * @param {number} ay
 * @param {number} bx
 * @param {number} by
 */
export function getDistanceInFeet(ax, ay, bx, by) {
    return getDistanceInCells(ax, ay, bx, by) * 5;
}

/**
 * @param {number} originX
 * @param {number} originY
 * @param {number} remainingFeet
 * @param {number} gridWidth
 * @param {number} gridHeight
 */
export function buildReachableCells(originX, originY, remainingFeet, gridWidth, gridHeight) {
    const radius = Math.max(0, Math.floor(remainingFeet / 5));
    /** @type {{gridX:number,gridY:number,kind:'move'}[]} */
    const cells = [];
    for (let y = Math.max(0, originY - radius); y <= Math.min(gridHeight - 1, originY + radius); y++) {
        for (let x = Math.max(0, originX - radius); x <= Math.min(gridWidth - 1, originX + radius); x++) {
            if (getDistanceInCells(originX, originY, x, y) <= radius) {
                cells.push({ gridX: x, gridY: y, kind: 'move' });
            }
        }
    }
    return cells;
}

/**
 * Hasta donde alcanza quien ataca.
 *
 * Primero **lo que diga el arma**. Antes esto solo miraba el nombre —en ingles— asi que un
 * «Arco corto de tejo» salido del compendio era cuerpo a cuerpo: el campo existia en la
 * fila y no llegaba hasta aqui. El nombre y la clase siguen detras, para todo lo que se
 * escribio antes de que las armas dijeran su alcance.
 *
 * @param {PartyMember|null} member
 */
export function getAttackRangeFeet(member) {
    const declared = weaponRange(member);
    if (declared > 0) return declared;

    const equippedWeaponId = member?.equippedItems?.weapon;
    const equippedWeapon = equippedWeaponId ? (member.items || []).find(/** @param {import('../dnd-system.js').DndItem} item */ (item) => item.id === equippedWeaponId) : null;
    const weaponName = String(equippedWeapon?.name || '').toLowerCase();
    const className = String(member?.class || '').toLowerCase();

    if (/(bow|crossbow|sling|wand|staff|rifle|gun)/.test(weaponName)) return 60;
    if (/(ranger|wizard|sorcerer|warlock|cleric|druid|artificer)/.test(className)) return 60;
    return 5;
}

/**
 * Lo que hace de dano quien ataca.
 *
 * **El nivel dice de que dado partes; el arma te mueve por la escalera.** Hasta aqui el
 * dano salia solo del nivel, asi que una daga y un hacha a dos manos pegaban igual y el
 * `damageDice` que la forja escribia en cada objeto no lo leia nadie. El nivel sigue
 * mandando —un nivel 9 con una daga sigue siendo un nivel 9— y el arma decide desde donde.
 *
 * Sin arma, o con una que no dice su dado, sale lo mismo de siempre.
 *
 * @param {PartyMember|null} member
 * @param {number} rangeFeet
 */
export function getPlayerDamageFormula(member, rangeFeet) {
    const level = Number(member?.level) || 1;

    let base;
    if (rangeFeet > 5) base = level >= 5 ? '1d10' : '1d8';
    else if (level >= 9) base = '2d8';
    else if (level >= 5) base = '1d10';
    else base = '1d8';

    return weaponDamage(member, base) || base;
}

/**
 * @param {number} cr
 * @returns {string}
 */
export function getEnemyDamageFormula(cr) {
    if (cr <= 0.5) return '1d6';
    if (cr <= 2) return '1d8';
    if (cr <= 5) return '2d6';
    if (cr <= 10) return '2d8';
    return '3d8';
}

/**
 * @param {PartyMember|null} member
 * @param {number} rangeFeet
 */
export function getPlayerAttackModifier(member, rangeFeet) {
    const strMod = getAbilityModifier(member?.strength || 10);
    const dexMod = getAbilityModifier(member?.dexterity || 10);
    return rangeFeet > 5 ? dexMod : Math.max(strMod, dexMod);
}

export function createEmptyCombatEncounter() {
    return createEncounter();
}

/**
 * Repairs an encounter read from disk.
 *
 * Delegates to the turn machine rather than keeping a second, thinner copy of the same
 * shape here. There used to be two: this one, which knew about movement and one action,
 * and `combat/turn-machine.js`, which also knew about bonus actions and reactions and
 * which nothing called. Encounters saved by the older code load unchanged; they simply
 * gain the two flags they were missing.
 *
 * @param {any} encounter
 */
export function normalizeCombatEncounter(encounter) {
    return normalizeEncounter(encounter);
}
