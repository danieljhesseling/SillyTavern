/**
 * El combate en curso, preguntado: de quién es el turno, quién sigue en pie, qué casillas
 * ocupa cada uno, cuánto le queda por andar, a quién puede atacar y qué armadura tiene.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import { chat_metadata, saveMetadata } from '../../script.js';
import { getAbilityModifier } from '../dnd-system.js';
import {
    getDistanceInFeet, getAttackRangeFeet, createEmptyCombatEncounter, normalizeCombatEncounter,
} from './combat-rules.js';
import { armourClassOf } from '../game-engine/rules/equipment.js';
import { getCoverBonus } from '../game-engine/board/terrain.js';
import { heightBetween } from '../game-engine/board/heights.js';
import { readLeft } from '../game-engine/board/exits.js';
import { getCoverAlongLine } from '../game-engine/board/line-of-sight.js';
import { perkBonus } from '../game-engine/rules/level-perks.js';
import { createTurnState, getRemainingMovement } from '../game-engine/combat/turn-machine.js';
import { isFlanked } from '../game-engine/combat/crits.js';
import { canControl, readMode, MODES } from '../game-engine/rules/companions.js';
import { awakePlacements } from '../game-engine/campaign/campaign-map.js';
import { getActiveRuleset } from '../game-engine/rules/ruleset.js';
import { combatEncounter, currentBoardName, currentLocationName, partyMembers, setCombatEncounter } from './state.js';
import { restoreChatPlaceholder } from './combat-flow.js';
import { getActiveBoardTerrain, getActiveBoardContext, isBoardWon } from './board.js';

/** @typedef {import('./types.js').PartyMember} PartyMember */

export function saveCombatState() {
    if (chat_metadata) {
        chat_metadata['combatEncounter'] = JSON.parse(JSON.stringify(combatEncounter));
        saveMetadata();
    }
}

export function loadCombatState() {
    const saved = chat_metadata?.['combatEncounter'];
    if (saved && saved.active) {
        setCombatEncounter(normalizeCombatEncounter(saved));
    } else {
        setCombatEncounter(createEmptyCombatEncounter());
        // Sin pelea, la caja dice lo de siempre, y no la pelea de otro chat.
        restoreChatPlaceholder();
    }
}

export function getCurrentTurnState() {
    const entry = getCurrentTurnEntry();
    if (!entry) {
        combatEncounter.turnState = null;
        return null;
    }

    const current = combatEncounter.turnState;
    if (current && current.actorId === entry.id && current.isEnemy === entry.isEnemy) {
        return current;
    }

    combatEncounter.turnState = createTurnState(entry);
    saveCombatState();
    return combatEncounter.turnState;
}

/**
 * @param {import('../dnd-system.js').TurnEntry|null} entry
 */
export function resetCombatTurnState(entry) {
    combatEncounter.turnState = createTurnState(entry);
    saveCombatState();
}

/**
 * @param {string} instanceId
 */
export function getEnemyByInstanceId(instanceId) {
    return combatEncounter.enemies.find(enemy => enemy.instanceId === instanceId) || null;
}

export function getAliveEnemies() {
    return combatEncounter.enemies.filter(enemy => (enemy.currentHp || 0) > 0);
}

/**
 * @param {import('../dnd-system.js').TurnEntry|null} entry
 */
export function getPartyMemberByTurnEntry(entry) {
    if (!entry || entry.isEnemy) return null;
    return partyMembers.find(member => String(member.id) === String(entry.id)) || null;
}

export function getCurrentActingMember() {
    return getPartyMemberByTurnEntry(getCurrentTurnEntry());
}

/**
 * @param {PartyMember|null} member
 */
export function getRemainingMovementFeet(member) {
    if (!member) return 0;
    const turnState = getCurrentTurnState();
    const speed = Number(member?.speed) || 30;
    // Somebody who is not the current actor has their whole move ahead of them.
    if (!turnState || turnState.actorId !== String(member.id)) return speed;
    return getRemainingMovement(combatEncounter, speed);
}

/**
 * @param {PartyMember|null} member
 */
export function getAttackableEnemiesForMember(member) {
    if (!member) return [];
    const origin = member.mapPosition || { gridX: 0, gridY: 0, locationName: '' };
    const originX = Number.isFinite(Number(origin.gridX)) ? Number(origin.gridX) : 0;
    const originY = Number.isFinite(Number(origin.gridY)) ? Number(origin.gridY) : 0;
    const rangeFeet = getAttackRangeFeet(member);
    return getAliveEnemies().filter(enemy => {
        const enemyX = Number.isFinite(Number(enemy.gridX)) ? Number(enemy.gridX) : 0;
        const enemyY = Number.isFinite(Number(enemy.gridY)) ? Number(enemy.gridY) : 0;
        return getDistanceInFeet(originX, originY, enemyX, enemyY) <= rangeFeet;
    });
}

/**
 * Las casillas que tiene alguien (enemigos en pie y el resto del grupo), para quien se
 * mueve. Lo encendido, la vista previa y el movimiento de verdad miran lo mismo: antes se
 * encendían casillas ocupadas que luego no se podían pisar, y `/combat-move` dejaba dos
 * fichas en la misma casilla.
 *
 * @param {any} member
 * @returns {Set<string>} Claves «x,y».
 */
export function occupiedCellsFor(member) {
    return new Set([
        ...getAliveEnemies().map(e => `${e.gridX || 0},${e.gridY || 0}`),
        ...partyMembers
            .filter(m => String(m.id) !== String(member?.id) && (Number(m.hp) || 0) > 0 && !m.dead)
            .map(m => `${m.mapPosition?.gridX || 0},${m.mapPosition?.gridY || 0}`),
    ]);
}

/**
 * Returns the IDs of party members that the player directly controls (personaId !== null).
 * Falls back to all party member IDs if none are persona-linked.
 * @returns {number[]}
 */
/**
 * En solo llevas al tuyo; los demas deciden por su cuenta.
 *
 * Se filtra aqui, en el unico sitio que decide que fichas se pueden arrastrar, para que
 * el modo no haya que recordarlo en cada pantalla.
 *
 * @param {number[]} ids
 * @returns {number[]}
 */
export function underYourHand(ids) {
    const rules = getActiveRuleset()?.companions ?? null;
    if (readMode(rules) === MODES.GROUP) return ids;

    return ids.filter((id) => {
        const member = partyMembers.find(m => Number(m.id) === Number(id));
        return member ? canControl(member, partyMembers, rules).allowed : false;
    });
}

/**
 * Armour class of a target, including the cover its cell grants.
 *
 * Cover is a property of where you stand, so the bonus comes from the target's own cell —
 * the same rule `getCoverBonus` documents. It is a simplification of D&D 5e, where cover
 * depends on the line between attacker and target; doing it properly needs the attacker's
 * position and a traced line, and that can be added later without moving this call site.
 *
 * A board with no terrain yields zero, so every existing board plays exactly as before.
 *
 * @param {{armorClass?: number|null, gridX?: number, gridY?: number, mapPosition?: {gridX?: number, gridY?: number}|null}} target
 * @returns {{ac: number, cover: number}}
 */
/**
 * La clase de armadura de lo que lleva puesto, o 0 si no lleva nada que la de.
 *
 * @param {any} who
 * @returns {number}
 */
function wornArmorClass(who) {
    if (!Array.isArray(who?.items) || !who?.equippedItems) return 0;
    const sum = armourClassOf({
        member: who,
        dexModifier: getAbilityModifier(Number(who.dexterity) || 10),
    });
    return sum.worn ? sum.armorClass : 0;
}

export function getTargetArmorClass(target, attacker = null) {
    // Lo que lleva puesto manda sobre el numero de la ficha, **solo si lo lleva puesto**:
    // una armadura equipada es un hecho, y el numero escrito a mano era una promesa. Sin
    // nada con clase de armadura encima, todo sigue exactamente como estaba.
    // Idea 46: la «piel dura» de quien la eligió al subir de nivel.
    const base = (wornArmorClass(target) || Number(target?.armorClass) || 10) + perkBonus(target, 'armorClass');
    const x = Number(target?.gridX ?? target?.mapPosition?.gridX);
    const y = Number(target?.gridY ?? target?.mapPosition?.gridY);

    if (!Number.isFinite(x) || !Number.isFinite(y)) return { ac: base, cover: 0 };

    const terrain = getActiveBoardTerrain();
    const ax = Number(attacker?.gridX ?? attacker?.mapPosition?.gridX);
    const ay = Number(attacker?.gridY ?? attacker?.mapPosition?.gridY);

    // Con atacante conocido, la cobertura es la mejor de la linea de tiro: un pilar
    // protege a quien esta detras, no solo a quien esta dentro. Sin atacante se cae a la
    // regla vieja, la de la casilla del objetivo, que es lo que habia hasta ahora.
    const cover = (Number.isFinite(ax) && Number.isFinite(ay))
        ? getCoverAlongLine(terrain, ax, ay, x, y, getCoverBonus)
        : (Number(getCoverBonus(terrain, x, y)) || 0);

    return { ac: base + cover, cover };
}

/**
 * @returns {import('../dnd-system.js').TurnEntry|null}
 */
export function getCurrentTurnEntry() {
    if (!combatEncounter.active || combatEncounter.turnOrder.length === 0) return null;
    return combatEncounter.turnOrder[combatEncounter.currentTurnIndex] || null;
}

/**
 * @returns {PartyMember[]}
 */
export function getLivingPartyMembers() {
    // B2: quien ha salido por una salida ya no está en la pelea: nadie le ataca.
    const left = combatEncounter.active ? readLeft(combatEncounter.left) : [];
    return partyMembers.filter(member => (member.hp || 0) > 0 && !left.includes(String(member.id)));
}

/**
 * La casilla de alguien del grupo en el tablero.
 *
 * @param {any} member
 * @returns {{x: number, y: number}}
 */
export function partyCell(member) {
    return { x: Number(member?.mapPosition?.gridX) || 0, y: Number(member?.mapPosition?.gridY) || 0 };
}

/**
 * B1: cómo está quien ataca respecto a quien recibe, en el tablero de ahora.
 *
 * @param {{x: number, y: number}} from
 * @param {{x: number, y: number}} to
 * @returns {'above'|'below'|'level'}
 */
export function heightFor(from, to) {
    return heightBetween(getActiveBoardContext().terrain, from, to);
}

/**
 * @param {boolean} [includeCurrent=true]
 */
/**
 * Si a este le toca moverse solo.
 *
 * @param {any} entry
 * @returns {boolean}
 */
export function actsOnItsOwn(entry) {
    if (!entry || entry.isEnemy) return false;
    const member = partyMembers.find(m => Number(m.id) === Number(entry.id));
    if (!member) return false;
    return !canControl(member, partyMembers, getActiveRuleset()?.companions ?? null).allowed;
}

/**
 * Si algo le tiene sujeto en su sitio (agarrado o apresado).
 *
 * @param {any} creature
 * @returns {boolean}
 */
export function heldInPlace(creature) {
    const said = (Array.isArray(creature?.activeConditions) ? creature.activeConditions : []).map((/** @type {string} */ c) => String(c).toLowerCase());
    return said.includes('grappled') || said.includes('restrained');
}

/**
 * El id de ficha de un enemigo en el tablero: los enemigos van en negativo, por orden.
 *
 * @param {any} enemy
 * @returns {number}
 */
export function enemyTokenId(enemy) {
    return -(combatEncounter.enemies.indexOf(enemy) + 1);
}

/**
 * Si el grupo tiene flanqueado a este enemigo desde la casilla de este miembro.
 *
 * @param {any} member
 * @param {any} enemy
 * @returns {boolean}
 */
export function partyFlanks(member, enemy) {
    const cell = (/** @type {any} */ m) => ({ x: Number(m?.mapPosition?.gridX) || 0, y: Number(m?.mapPosition?.gridY) || 0 });
    return flankedFrom(cell(member), { x: Number(enemy.gridX) || 0, y: Number(enemy.gridY) || 0 },
        getLivingPartyMembers().filter(m => String(m.id) !== String(member.id)).map(cell));
}

/**
 * Idea 3: si quien ataca tiene a un compañero suyo pegado al objetivo por el otro lado.
 *
 * @param {{x: number, y: number}} from
 * @param {{x: number, y: number}} at
 * @param {Array<{x: number, y: number}>} friends
 * @returns {boolean}
 */
export function flankedFrom(from, at, friends) {
    return isFlanked(from, at, friends);
}

/**
 * Quién espera en el tablero sin pelear todavía: los enemigos escritos que el grupo ve. Sin
 * tablero, en combate o con su pelea ya ganada, nadie.
 *
 * @returns {string[]}
 */
export function waitingHere() {
    if (!currentBoardName || combatEncounter.active || isBoardWon(currentLocationName, currentBoardName)) return [];
    const board = getActiveBoardContext().board;
    return awakePlacements(board?.rooms, board?.enemyPlacements ?? []).map((/** @type {any} */ p) => String(p.name));
}

/**
 * La casilla de alguien del tablero, sea del grupo o enemigo.
 *
 * @param {any} creature
 * @returns {{x: number, y: number}}
 */
export function boardCellOf(creature) {
    return {
        x: Number(creature?.mapPosition?.gridX ?? creature?.gridX) || 0,
        y: Number(creature?.mapPosition?.gridY ?? creature?.gridY) || 0,
    };
}
