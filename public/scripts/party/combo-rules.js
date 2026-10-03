/**
 * E3.1 de wiki/ROADMAP_ENTRETENIDO.md: que las reglas de 5e encadenen solas en el tablero.
 *
 * El guerrero derriba, el pícaro llega y mete su furtivo; quien ayuda abre la guardia y el
 * siguiente golpe va con ventaja. Las cuentas puras están en `rules/sneak-attack.js` y en
 * `attackEdge` (`combat/maneuvers.js`); aquí se les da lo que hay en la pelea de ahora: quién
 * está pegado al objetivo, de quién es el turno y si el furtivo ya se ha metido.
 *
 * Lo usan el golpe de verdad (`player-actions.js`), su previsión en la barra (`combat-bar.js`) y
 * la tarjeta del objetivo (`board-view.js`): el número que ves antes es el que sale después.
 */

import { planSneakAttack, sneakKey } from '../game-engine/rules/sneak-attack.js';
import { noteSneak, sneakSpent } from '../game-engine/rules/weapon-mastery.js';
import { combatEncounter } from './state.js';
import { getCurrentTurnEntry, getLivingPartyMembers, partyCell } from './combat-state.js';
import { livingSummons } from './spell-turn.js';

/**
 * Los suyos pegados a un enemigo (a 5 pies), sin contar a quien ataca: los del grupo en pie y
 * sus invocaciones.
 *
 * @param {any} member Quien ataca.
 * @param {any} enemy
 * @returns {Array<{name: string, hp: number, conditions: string[]}>}
 */
export function alliesBeside(member, enemy) {
    const at = { x: Number(enemy?.gridX) || 0, y: Number(enemy?.gridY) || 0 };
    /** @type {any[]} */
    let summons = [];
    try {
        summons = livingSummons();
    } catch {
        summons = [];
    }
    return [...getLivingPartyMembers(), ...summons]
        .filter(m => m && String(m.id) !== String(member?.id))
        .filter(m => {
            const cell = partyCell(m);
            return Math.max(Math.abs(cell.x - at.x), Math.abs(cell.y - at.y)) <= 1;
        })
        .map(m => ({
            name: String(m.name ?? ''),
            hp: Number(m.hp) || 0,
            conditions: Array.isArray(m.activeConditions) ? m.activeConditions.map(String) : [],
        }));
}

/**
 * La clave del furtivo de ahora: quien ataca, en el turno de quién y en qué ronda.
 *
 * @param {any} member
 * @returns {string}
 */
export function sneakKeyNow(member) {
    const entry = getCurrentTurnEntry();
    return sneakKey(String(member?.id ?? ''), String(entry?.id ?? member?.id ?? ''), Number(combatEncounter.round) || 1);
}

/**
 * Si un golpe del pícaro lleva furtivo ahora, con lo que hay en la pelea.
 *
 * @param {any} member
 * @param {any} weapon El arma con la que pega (null: puños).
 * @param {any} enemy
 * @param {{mode: 'advantage'|'disadvantage'|'normal', reasons?: string[]}} edge
 * @returns {import('../game-engine/rules/sneak-attack.js').SneakPlan}
 */
export function sneakFor(member, weapon, enemy, edge) {
    return planSneakAttack({
        member,
        weapon,
        mode: edge?.mode ?? 'normal',
        reasons: edge?.reasons ?? [],
        alliesBeside: alliesBeside(member, enemy),
        used: sneakSpent(combatEncounter.tactics, sneakKeyNow(member)),
    });
}

/**
 * Apuntar que el furtivo de este turno ya está metido.
 *
 * @param {any} member
 */
export function spendSneak(member) {
    combatEncounter.tactics = noteSneak(combatEncounter.tactics, sneakKeyNow(member));
}
