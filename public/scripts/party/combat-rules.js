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

/** @typedef {import('./types.js').PartyMember} PartyMember */

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
export function rollDiceDetailed(formula, fallbackSides = 20) {
    const normalized = String(formula || '').trim() || `1d${fallbackSides}`;
    const match = normalized.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (!match) {
        const total = Math.floor(Math.random() * fallbackSides) + 1;
        return { formula: normalized, rolls: [total], modifier: 0, total, natural: total };
    }

    const count = Math.max(1, parseInt(match[1], 10) || 1);
    const sides = Math.max(2, parseInt(match[2], 10) || fallbackSides);
    const modifier = parseInt(match[3] || '0', 10) || 0;
    const rolls = [];
    for (let index = 0; index < count; index++) {
        rolls.push(Math.floor(Math.random() * sides) + 1);
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
 * @param {PartyMember|null} member
 */
export function getAttackRangeFeet(member) {
    const equippedWeaponId = member?.equippedItems?.weapon;
    const equippedWeapon = equippedWeaponId ? (member.items || []).find(/** @param {import('../dnd-system.js').DndItem} item */ (item) => item.id === equippedWeaponId) : null;
    const weaponName = String(equippedWeapon?.name || '').toLowerCase();
    const className = String(member?.class || '').toLowerCase();

    if (/(bow|crossbow|sling|wand|staff|rifle|gun)/.test(weaponName)) return 60;
    if (/(ranger|wizard|sorcerer|warlock|cleric|druid|artificer)/.test(className)) return 60;
    return 5;
}

/**
 * @param {PartyMember|null} member
 * @param {number} rangeFeet
 */
export function getPlayerDamageFormula(member, rangeFeet) {
    const level = Number(member?.level) || 1;
    if (rangeFeet > 5) return level >= 5 ? '1d10' : '1d8';
    if (level >= 9) return '2d8';
    if (level >= 5) return '1d10';
    return '1d8';
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
    return { active: false, enemies: [], turnOrder: [], currentTurnIndex: 0, round: 0, turnState: null };
}

/**
 * @param {any} encounter
 */
export function normalizeCombatEncounter(encounter) {
    if (!encounter || typeof encounter !== 'object') return createEmptyCombatEncounter();
    return {
        active: Boolean(encounter.active),
        enemies: Array.isArray(encounter.enemies) ? encounter.enemies : [],
        turnOrder: Array.isArray(encounter.turnOrder) ? encounter.turnOrder : [],
        currentTurnIndex: Number.isInteger(encounter.currentTurnIndex) ? encounter.currentTurnIndex : 0,
        // Encounters saved before rounds existed resume at one rather than refusing to load.
        round: Number.isInteger(encounter.round) && encounter.round > 0
            ? encounter.round
            : (encounter.active ? 1 : 0),
        turnState: encounter.turnState && typeof encounter.turnState === 'object'
            ? {
                actorId: String(encounter.turnState.actorId || ''),
                isEnemy: Boolean(encounter.turnState.isEnemy),
                movementSpentFeet: Number(encounter.turnState.movementSpentFeet) || 0,
                actionUsed: Boolean(encounter.turnState.actionUsed),
            }
            : null,
    };
}
