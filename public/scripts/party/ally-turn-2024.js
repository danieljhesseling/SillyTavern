/**
 * Los compañeros que lleva el juego, con las reglas de 2024 (tanda 12).
 *
 * Su turno lo decide `ally-ai.js` (`planAllyTurn`: la postura, a quién va, dónde se pone) y lo
 * hace `combat-flow.js` por los mismos caminos que usarías tú. Esto le añade lo de 2024 que tú
 * tienes en la barra, para que no se quede en «acercarse y pegar»:
 *
 * - **Antes de decidir**: si está en el suelo, se levanta (la mitad de lo que anda); malherido y
 *   con una poción, se la bebe (acción adicional).
 * - **En vez de su golpe**: darle una poción a quien cae a su lado, empujar al vacío (o a lo que
 *   quema) al enemigo que está al borde, abrirle la guardia a quien pega más (un familiar
 *   siempre), u ocultarse si se queda atrás sin nadie a tiro.
 * - **Después de su golpe**: con dos armas ligeras, la otra mano (Mellar, si la tiene).
 *
 * Las maestrías de su arma ya las aplica su golpe de siempre (`strikeEnemy`).
 *
 * Lo hace todo con las mismas funciones que la barra (`combat-bar.js`): lo que tú puedes hacer
 * es lo que hace él, con las mismas tiradas.
 */

import { planAlly2024, allyDrinks, stanceOf } from '../game-engine/combat/ally-ai.js';
import { potionsOf, canStand } from '../game-engine/rules/actions-2024.js';
import { unarmedDC, escapeSave } from '../game-engine/rules/unarmed.js';
import { getCoverBonus } from '../game-engine/board/terrain.js';
import { hazardsAt } from '../game-engine/board/hazards.js';
import { getCoverAlongLine } from '../game-engine/board/line-of-sight.js';
import { canHide } from '../game-engine/combat/maneuvers.js';
import { averageOf } from '../game-engine/combat/enemy-abilities.js';
import { hasAction } from '../game-engine/combat/turn-machine.js';
import { combatEncounter, partyMembers } from './state.js';
import { getAliveEnemies, getRemainingMovementFeet, partyCell, speedOf } from './combat-state.js';
import { getAttackRangeFeet, getPlayerDamageFormula, getPlayerAttackModifier, getEnemyDamageFormula } from './combat-rules.js';
import { shoveGround, performManeuver } from './player-actions.js';
import { getActiveBoardContext, boardVisibility } from './board.js';
import { drinkPotion, givePotion, unarmedStrike, hide2024, offHandAttack, buildCombatBarSnapshot, setProne } from './combat-bar.js';
import { ai2024 } from './enemy-turn.js';
import { livingSummons } from './spell-turn.js';
import { postCombatNarration } from './narration.js';

/**
 * Lo que hace de media el golpe de alguien del grupo.
 *
 * @param {any} member
 * @returns {number}
 */
function averageHit(member) {
    if (member?.summon && member.attacks === false) return 0;
    const reach = getAttackRangeFeet(member);
    return averageOf(getPlayerDamageFormula(member, reach)) + Math.max(0, getPlayerAttackModifier(member, reach));
}

/**
 * Antes de decidir su turno: se levanta si está en el suelo, y malherido y con una poción
 * encima, se la bebe (acción adicional).
 *
 * @param {any} member
 * @returns {boolean} Si se la ha bebido.
 */
export function allyBeforeTurn2024(member) {
    if (!ai2024() || !member) return false;
    // En el suelo (le han derribado, empujado), lo primero es levantarse: cuesta la mitad de lo
    // que anda (2024), y desde el suelo se pega con desventaja.
    if ((Array.isArray(member.activeConditions) ? member.activeConditions : []).includes('Prone')
        && canStand({ left: getRemainingMovementFeet(member), speed: speedOf(member) }).ok) {
        setProne(false);
    }
    if (member.summon) return false;
    const potions = potionsOf(member);
    const ready = allyDrinks({
        hp: Number(member.hp) || 0,
        maxHp: Number(member.maxHp) || 1,
        potions: potions.reduce((sum, p) => sum + p.count, 0),
        hasBonus: hasAction(combatEncounter, 'bonus'),
    });
    if (!ready || !potions[0]) return false;
    return Boolean(drinkPotion(potions[0].itemId));
}

/**
 * Ya movido, lo que hace en vez de su golpe, si le sale mejor. Vacío si pega como siempre.
 *
 * @param {any} member
 * @param {{action: string, targetId: string|null}} plan Lo que decidió `planAllyTurn`.
 * @returns {string} Por qué, en una frase (ya contada; lo hecho lo cuenta la barra al hacerlo).
 */
export function allyInstead2024(member, plan) {
    if (!ai2024() || !member || !combatEncounter.active || !hasAction(combatEncounter, 'action')) return '';
    const here = partyCell(member);
    const { terrain, board } = getActiveBoardContext();
    const ground = shoveGround();
    const enemies = getAliveEnemies();
    const potions = member.summon ? [] : potionsOf(member);
    const watchers = enemies.map(e => ({
        name: String(e.name),
        cover: Number(getCoverAlongLine(terrain, Number(e.gridX) || 0, Number(e.gridY) || 0, here.x, here.y, getCoverBonus)) || 0,
    }));
    const choice = planAlly2024({
        actor: {
            id: String(member.id), x: here.x, y: here.y,
            reachFeet: getAttackRangeFeet(member),
            avgDamage: averageHit(member),
            potions: potions.reduce((sum, p) => sum + p.count, 0),
            attacks: !(member.summon && member.attacks === false),
            stance: stanceOf(member),
            shoveDC: member.summon ? 0 : unarmedDC(member),
        },
        plan,
        enemies: enemies.map(e => ({
            id: String(e.instanceId), x: Number(e.gridX) || 0, y: Number(e.gridY) || 0,
            hp: Number(e.currentHp) || 0, maxHp: Number(e.maxHp) || 1,
            saveMod: escapeSave(e).modifier,
            avgDamage: averageOf(getEnemyDamageFormula(Number(e.cr) || 0)),
        })),
        allies: [...partyMembers, ...livingSummons()]
            .filter(m => String(m.id) !== String(member.id))
            .map(m => ({
                id: String(m.id), ...partyCell(m), hp: Number(m.hp) || 0, dead: Boolean(m.dead),
                avgDamage: averageHit(m), reachFeet: getAttackRangeFeet(m),
            })),
        ground: {
            isFree: ground.isFree,
            isChasm: ground.isChasm,
            isHazard: (x, y) => Boolean(board) && hazardsAt(board, x, y).some((/** @type {any} */ h) => h.armed),
        },
        sight: { canHide: canHide(watchers).ok, dim: boardVisibility().maxFeet !== null },
    });
    if (!choice) return '';
    // Primero por qué (se lee antes que la tirada), luego lo que hace, con la función de la barra.
    postCombatNarration(`[COMBAT] ${member.name}: ${choice.reason}`);
    const done = choice.kind === 'give-potion' ? givePotion(String(potions[0]?.itemId ?? ''), String(choice.targetId))
        : choice.kind === 'shove' ? unarmedStrike('apartar', String(choice.targetId))
            : choice.kind === 'help' ? performManeuver('ayudar', String(choice.targetId))
                : hide2024();
    return done ? choice.reason : '';
}

/**
 * Después de su golpe: con un arma ligera en cada mano, la otra (sin gastar la acción
 * adicional si tiene Mellar).
 *
 * @param {any} member
 * @param {any} target El enemigo al que ha pegado.
 * @returns {boolean} Si ha pegado con la otra mano.
 */
export function allyAfterAttack2024(member, target) {
    if (!ai2024() || !member || !target || !combatEncounter.active || (Number(target.currentHp) || 0) <= 0) return false;
    const snapshot = buildCombatBarSnapshot();
    if (!snapshot.offHand?.ok || !snapshot.offHand.weapon) return false;
    return Boolean(offHandAttack(String(target.instanceId)));
}
