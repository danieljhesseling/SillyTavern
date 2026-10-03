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
import { prepBonus } from '../game-engine/campaign/guild-perks.js';
import { armorWithSpell } from '../game-engine/rules/spell-cast.js';
import { createTurnState, getRemainingMovement } from '../game-engine/combat/turn-machine.js';
import { isFlanked } from '../game-engine/combat/crits.js';
import { awakePlacements } from '../game-engine/campaign/campaign-map.js';
import { combatEncounter, currentBoardName, currentLocationName, partyMembers, setCombatEncounter } from './state.js';
import { controlOf, livingSummons, pruneSummonTurns, shieldBonus, summonById, summonsNow } from './spell-turn.js';
import { restoreChatPlaceholder } from './combat-flow.js';
import { getActiveBoardTerrain, getActiveBoardContext, isBoardWon } from './board.js';
import { armourLoss } from './dungeon.js';
import { quietFight } from './quiet-fight.js';

/** @typedef {import('./types.js').PartyMember} PartyMember */

export function saveCombatState() {
    // J19.5: lo que acaba de invocar un conjuro se hace luchador aquí, antes de guardar: con su
    // turno detrás de quien lo llamó y su ficha con id propio. Todo lo que cambia la pelea pasa
    // por aquí, así que la invocación ya sale en la iniciativa y en el tablero al redibujar.
    // Y las que se han ido (su tiempo, la concentración que las sostenía, su invocador caído)
    // dejan también su fila de la iniciativa.
    if (combatEncounter.active) {
        if (Array.isArray(combatEncounter.summons) && combatEncounter.summons.length > 0) summonsNow();
        pruneSummonTurns();
    }
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
    // J19.5: una invocación también tiene su turno del lado del grupo, y se juega igual.
    return partyMembers.find(member => String(member.id) === String(entry.id)) || summonById(entry.id);
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
    const speed = speedOf(member);
    // Somebody who is not the current actor has their whole move ahead of them.
    if (!turnState || turnState.actorId !== String(member.id)) return speed;
    return getRemainingMovement(combatEncounter, speed);
}

/**
 * Lo que anda alguien en un turno, con lo que le han echado encima (J19, `SPELL_CONDITIONS`):
 * Acelerado, el doble; A la carrera (Retirada expeditiva), otra vez lo suyo con la acción
 * adicional; Ralentizado (Rayo de escarcha), 10 pies menos.
 *
 * @param {any} member
 * @returns {number}
 */
export function speedOf(member) {
    const base = Number(member?.speed) || 30;
    const has = (/** @type {string} */ name) => (Array.isArray(member?.activeConditions) ? member.activeConditions : []).includes(name);
    let speed = base;
    if (has('Acelerado')) speed += base;
    if (has('A la carrera')) speed += base;
    // Tanda 10: Correr (la acción de 2024), lo suyo otra vez este turno.
    if (has('Corriendo')) speed += base;
    if (has('Ralentizado')) speed -= 10;
    // Tanda 12: agarrado o sujeto, no anda (5e). Antes solo lo miraba el turno de los enemigos;
    // ahora que ellos también agarran, vale igual para el grupo. Si quien le agarraba ha caído
    // o ya no está a su lado, anda (el agarre se le quita del todo en el turno enemigo).
    const holder = member?.grappledBy ? getEnemyByInstanceId(String(member.grappledBy)) : null;
    const loose = Boolean(member?.grappledBy) && !(holder && (Number(holder.currentHp) || 0) > 0
        && Math.max(Math.abs((Number(holder.gridX) || 0) - (Number(member?.mapPosition?.gridX) || 0)),
            Math.abs((Number(holder.gridY) || 0) - (Number(member?.mapPosition?.gridY) || 0))) <= 1);
    if ((has('Grappled') && !loose) || has('Restrained')) return 0;
    return Math.max(0, speed);
}

/**
 * @param {PartyMember|null} member
 */
export function getAttackableEnemiesForMember(member) {
    if (!member) return [];
    // J19.5: lo que no pega (un familiar) no tiene a quién atacar.
    if (/** @type {any} */ (member).summon && /** @type {any} */ (member).attacks === false) return [];
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
        // J19.5: las invocaciones también ocupan su casilla.
        ...[...partyMembers, ...(combatEncounter.active ? livingSummons() : [])]
            .filter(m => String(m.id) !== String(member?.id) && (Number(m.hp) || 0) > 0 && !m.dead)
            // E1.1: quien ya salió por una salida no la tapa: por la ventana se sale de uno en uno.
            .filter(m => !(combatEncounter.active && readLeft(combatEncounter.left).includes(String(m.id))))
            .map(m => `${m.mapPosition?.gridX || 0},${m.mapPosition?.gridY || 0}`),
    ]);
}

/**
 * Returns the IDs of party members that the player directly controls (personaId !== null).
 * Falls back to all party member IDs if none are persona-linked.
 * @returns {number[]}
 */
/**
 * Llevas al tuyo; a un compañero, desde el vínculo 5 (D-J32, en los dos modos). Los demas
 * deciden por su cuenta.
 *
 * Se filtra aqui, en el unico sitio que decide que fichas se pueden arrastrar, para que
 * la regla no haya que recordarla en cada pantalla.
 *
 * @param {number[]} ids
 * @returns {number[]}
 */
export function underYourHand(ids) {
    // D-J32: el vínculo 5 manda en los dos modos; en «grupo» tampoco se mueve a todos. J7.3:
    // y a quien ya es amigo se le puede devolver al juego («Que lo lleve el juego»).
    return ids.filter((id) => {
        const member = partyMembers.find(m => Number(m.id) === Number(id));
        return member ? controlOf(member) === 'player' : false;
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
    // J19: y la que da un conjuro (Armadura de mago, Escudo de fe), si lo tiene encima.
    const base = armorWithSpell((wornArmorClass(target) || Number(target?.armorClass) || 10) + perkBonus(target, 'armorClass')
        // E5.1: la armadura templada en la forja del gremio, hasta volver a casa.
        + prepBonus(target, 'armorClass'), target)
        // J19.7: el Escudo levantado, hasta su turno; y Acelerado, +2.
        + shieldBonus(target)
        + ((Array.isArray(target?.activeConditions) ? target.activeConditions : []).includes('Acelerado') ? 2 : 0)
        // E2.1 y E2.3: el escudo que no se usa por llevar la antorcha, y la armadura que se quitó para dormir.
        - armourLoss(target).penalty;
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
    // J9.1: quien ha muerto no está en pie aunque un suceso le haya subido la vida: sin esto,
    // una pelea con todo el grupo muerto no se daba por perdida y los enemigos jugaban sin fin.
    return partyMembers.filter(member => !member.dead && (member.hp || 0) > 0 && !left.includes(String(member.id)));
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
    // J12.10: con las cotas del tablero, quien está en lo alto de un risco ataca desde arriba.
    const { terrain, board } = getActiveBoardContext();
    return heightBetween(terrain, from, to, board?.elevation);
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
    // J7.3: el compañero que aún no es amigo, el que le has devuelto al juego, y la invocación
    // que va sola (J19.5) deciden por su cuenta.
    const member = getPartyMemberByTurnEntry(entry);
    if (!member) return false;
    // E7.2: resolviendo rápido, todos los del grupo van solos (también el héroe).
    if (quietFight()) return true;
    return controlOf(member) === 'engine';
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
