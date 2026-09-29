/**
 * Lo que hace quien juega en su turno: moverse, atacar, las maniobras, lanzar cosas, el golpe
 * a una y el relevo, y pasar el turno.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import { Popup } from '../popup.js';
import { getAbilityModifier, consumeItemInInventory } from '../dnd-system.js';
import { rollWith } from '../game-engine/combat/seeded-random.js';
import {
    rollDiceDetailed, getDistanceInFeet, getAttackRangeFeet, describeCover, getPlayerDamageFormula,
    getPlayerAttackModifier, nextRandom,
} from './combat-rules.js';
import { weaponOf as heldWeapon, weaponBonus } from '../game-engine/rules/equipment.js';
import {
    setCell as setTerrainCell, getCoverBonus, cellKey, isPassable, getCell,
} from '../game-engine/board/terrain.js';
import { isHigh } from '../game-engine/board/heights.js';
import { pairLine } from '../game-engine/rules/pair-moves.js';
import { findPath } from '../game-engine/board/pathfinding.js';
import { getCoverAlongLine } from '../game-engine/board/line-of-sight.js';
import {
    MANEUVERS, recordManeuver, attackEdge, consumeHelp, rollWithEdge, describeEdge, resolveShove, noteKnockdown,
    takeCombo, COMBO_DICE, canHide, hideDC, revealHidden,
} from '../game-engine/combat/maneuvers.js';
import { THROWABLES, throwablesOf, burningPuddle, SCENERY, sceneryNear } from '../game-engine/combat/throwables.js';
import { readyAttack } from '../game-engine/combat/readied.js';
import { canReact, markReacted, bossLine } from '../game-engine/combat/boss-reaction.js';
import { perkBonus } from '../game-engine/rules/level-perks.js';
import { visibilityPenalties } from '../game-engine/world/visibility.js';
import { noteDealt } from '../game-engine/combat/tally.js';
import { enterCell, describeHazard, hazardsAt } from '../game-engine/board/hazards.js';
import { spendMovement, hasAction, useAction } from '../game-engine/combat/turn-machine.js';
import { rollLine, damageLine } from '../game-engine/rules/roll-line.js';
import { skillModifier } from '../game-engine/rules/checks.js';
import { critEffect } from '../game-engine/combat/crits.js';
import { traitBonus, knackBonus } from '../game-engine/campaign/feats.js';
import { planFollowUp, planBatonPass, planUltimate } from '../game-engine/combat/bond-perks.js';
import { spendPerk } from '../game-engine/campaign/bonds.js';
import { lineToEntry } from '../game-engine/ui/combat-log.js';
import { clearTimersFor } from '../game-engine/combat/condition-timers.js';
import { combatEncounter, currentBoardName, currentLocationName, partyMembers, usedReactions } from './state.js';
import { applyTimedCondition } from './magic.js';
import {
    enemyTokenId, getAliveEnemies, getAttackableEnemiesForMember, getCurrentActingMember, getCurrentTurnEntry,
    getCurrentTurnState, getRemainingMovementFeet, getTargetArmorClass, heightFor, occupiedCellsFor, partyCell,
    partyFlanks, resetCombatTurnState, saveCombatState,
} from './combat-state.js';
import { floatOnToken, pushCombatLogEntry, showCombatDiceRoll } from './combat-log.js';
import { chargeOpportunityAttacks, enemyBark, resolveEnemyAttackOn } from './enemy-turn.js';
import { checkScenarioOutcome, endCombat, judgeCurrentScenario, offerExit, runCombatTurnLoop } from './combat-flow.js';
import { savePartyState, bark, recordFeat } from './main.js';
import {
    persistBoardTerrain, getActiveBoardTerrain, getActiveBoardContext, boardVisibility, fireHazardsOnEnter,
} from './board.js';
import { renderLocationMapsPreview } from './board-view.js';
import { getCampaignBonds, saveCampaignState } from './time.js';
import { postCombatNarration, soundCue, showTip } from './narration.js';

/** @typedef {import('./types.js').PartyMember} PartyMember */

/** Lo último que gritó un jefe al contestar (idea 24). */
let lastBossLine = '';
/** Si alguien acaba de caer al vacío, para dejar ver la caída (idea 189). */
let fellThisTurn = false;

/**
 * Idea 9: lo que pisa un enemigo al que empujan encima de algo (trampa, fuego).
 *
 * @param {any} enemy
 * @param {{x: number, y: number}} cell
 * @returns {string[]}
 */
function shovedInto(enemy, cell) {
    const board = getActiveBoardContext().board;
    if (!board || hazardsAt(board, cell.x, cell.y).length === 0) return [];
    const { fired, hazards } = enterCell(board, cell);
    board.hazards = hazards;
    persistBoardTerrain(board);
    /** @type {string[]} */
    const lines = [];
    for (const hazard of fired) {
        if (hazard.effect === 'damage' && hazard.damageDice) {
            const roll = rollWith(hazard.damageDice, nextRandom);
            enemy.currentHp = Math.max(0, (Number(enemy.currentHp) || 0) - roll.total);
            lines.push(`🔥 Cae encima de ${hazard.name.toLowerCase()}: ${roll.total} de daño.`);
            if (enemy.currentHp === 0) lines.push(`☠️ ${enemy.name} no se levanta.`);
        } else if (hazard.effect === 'condition' && hazard.condition) {
            applyTimedCondition(enemy, String(enemy.instanceId), hazard.condition, 2);
            lines.push(`🪤 ${hazard.name}: ${enemy.name} queda ${String(hazard.condition).toLowerCase()}.`);
        } else {
            lines.push(`🪤 ${describeHazard(hazard)}.`);
        }
    }
    return lines;
}

/**
 * El golpe definitivo del vinculo de rango 10.
 *
 * Impacta sin tirar, lo que es mucho que conceder: por eso cuesta un dia entero y diez
 * rangos de un vinculo que solo suben los hechos registrados. El dano lo decide el modulo
 * puro; aqui solo se aplica, se gasta y se cuenta.
 *
 * @param {string} rawTargetName
 * @returns {string}
 */
export function resolveUltimateStrike(rawTargetName) {
    const entry = getCurrentTurnEntry();
    const member = getCurrentActingMember();
    if (!combatEncounter.active || !entry || entry.isEnemy || !member) {
        toastr.warning('No hay un turno de jugador activo.');
        return '';
    }

    const target = getAttackableEnemiesForMember(member)
        .find(enemy => enemy.name.toLowerCase() === String(rawTargetName).trim().toLowerCase());
    if (!target) {
        toastr.warning(`"${rawTargetName}" no esta a tu alcance.`);
        return '';
    }

    const plan = planUltimate({
        bonds: getCampaignBonds(),
        party: partyMembers,
        actorId: String(member.id),
        targetId: String(target.instanceId),
    });

    if (!plan) {
        toastr.info('El golpe definitivo pide un vinculo de rango 10 y no haberlo usado hoy.');
        return '';
    }

    target.currentHp = Math.max(0, (Number(target.currentHp) || 0) - plan.damage);
    combatEncounter.tally = noteDealt(combatEncounter.tally, plan.actorId, plan.damage, target.currentHp === 0);
    saveCampaignState(null, spendPerk(getCampaignBonds(), plan.actorId, 'ultimate'));
    saveCombatState();

    pushCombatLogEntry(lineToEntry(`${plan.reason} ${plan.damage} de dano a ${target.name}.`));
    postCombatNarration(`✨ [COMBAT] ${plan.actorName} usa su golpe definitivo contra ${target.name}: ${plan.damage} de dano.`);

    if (target.currentHp <= 0) {
        postCombatNarration(`☠️ [COMBAT] ${target.name} cae.`);
        checkScenarioOutcome();
    }

    renderLocationMapsPreview();
    return `${plan.damage}`;
}

/**
 * Resolves the free attack the rank-3 bond perk grants.
 *
 * A real attack: it rolls to hit against the same armour class, it can miss, and it goes
 * through the log like any other. A free hit that always lands is not a perk, it is a
 * cheat, and the engine's whole claim is that any result can be audited.
 *
 * It costs the companion nothing — no action, no movement — because the perk is the
 * reward for the bond, not a second turn.
 *
 * @param {string} actorId
 * @param {import('../dnd-system.js').EnemyInstance} target
 */
/**
 * R3 del roadmap de profundidad: a una. Quien tiene el turno ataca con ventaja (su compañero
 * le abre la guardia) y el compañero ataca detrás, también con ventaja, gastando su reacción.
 *
 * @param {any} member
 * @param {string} partnerId
 * @param {any} enemy
 */
export function resolvePairStrike(member, partnerId, enemy) {
    const partner = partyMembers.find(m => String(m.id) === String(partnerId));
    if (!partner || !combatEncounter.active) return;
    usedReactions.add(`party:${partner.id}`);
    postCombatNarration(`[COMBAT] ${pairLine(String(member.name), String(partner.name), String(enemy.name))}`);
    combatEncounter.maneuvers = recordManeuver(combatEncounter.maneuvers, 'ayudar', String(partner.id), String(enemy.instanceId));
    handlePlayerCombatAttack(String(enemy.name));
    if ((Number(enemy.currentHp) || 0) > 0 && combatEncounter.active) {
        resolveFollowUpAttack(String(partner.id), enemy, `va a una con ${member.name} contra`, 'advantage');
    }
}

export function resolveFollowUpAttack(actorId, target, how = 'ataca de seguimiento a', mode = /** @type {'advantage'|'disadvantage'|'normal'} */ ('normal')) {
    const ally = partyMembers.find(m => String(m.id) === String(actorId));
    if (!ally || (target.currentHp || 0) <= 0) return;

    const rangeFeet = getAttackRangeFeet(ally);
    const attackMod = getPlayerAttackModifier(ally, rangeFeet);
    // R3: la jugada en pareja va con ventaja.
    const edged = rollWithEdge(() => rollDiceDetailed('1d20', 20).total, mode);
    const attackRoll = { total: edged.natural, natural: edged.natural };
    const attackTotal = attackRoll.total + attackMod;
    const { ac: targetAc, cover } = getTargetArmorClass(target, ally);
    const isCrit = attackRoll.natural === 20;
    const isHit = isCrit || attackTotal >= targetAc;

    showCombatDiceRoll({
        title: `${ally.name}: ataque de seguimiento`,
        subtitle: `Objetivo: ${target.name}`,
        formula: `1d20${attackMod >= 0 ? '+' : ''}${attackMod}`,
        detail: `d20(${attackRoll.total}) ${attackMod >= 0 ? '+' : ''}${attackMod} = ${attackTotal}`,
        total: attackTotal,
        dc: targetAc,
        natural: attackRoll.natural,
        glyph: 'd20',
    });

    const lines = [];
    lines.push(`🤝 ${ally.name} ${how} ${target.name}.`);
    lines.push(attackLine({ who: ally.name, at: target.name, total: attackTotal, ac: targetAc, hit: isHit, natural: attackRoll.total, modifier: attackMod, cover }));

    if (!isHit) {
        lines.push('❌ Resultado: fallo.');
        saveCombatState();
        postCombatNarration(lines.join('\n'));
        return;
    }

    const damageFormula = getPlayerDamageFormula(ally, rangeFeet);
    const damageRoll = rollDiceDetailed(damageFormula, 8);
    const critRoll = isCrit ? rollDiceDetailed(damageFormula, 8) : null;
    const damageMod = Math.max(0, getPlayerAttackModifier(ally, rangeFeet));
    const totalDamage = Math.max(1, damageRoll.total + (critRoll?.total || 0) + damageMod);

    target.currentHp = Math.max(0, (target.currentHp || 0) - totalDamage);
    combatEncounter.tally = noteDealt(combatEncounter.tally, ally.id, totalDamage, target.currentHp === 0);
    floatOnToken(enemyTokenId(target), `-${totalDamage}`, 'damage');
    if (target.currentHp === 0) recordFeat(ally, 'kill', String(target.name));
    lines.push(`✅ Resultado: impacto${isCrit ? ' critico' : ''}.`);
    lines.push(damageLine({ total: totalDamage, formula: damageFormula, rolled: damageRoll.total, modifier: damageMod }));
    lines.push(`❤️ Estado de ${target.name}: ${target.currentHp}/${target.maxHp}`);

    if (target.currentHp === 0) lines.push(`☠️ ${target.name} cae derrotado.`);

    saveCombatState();
    postCombatNarration(lines.join('\n'));

    if (getAliveEnemies().length === 0) {
        postCombatNarration('🏆 [COMBAT] Todos los enemigos han sido derrotados.');
        endCombat('victory');
    }
}

/**
 * Offers the rank-5 relay after a kill.
 *
 * An offer rather than an event: passing your leftover movement is a decision, and the
 * engine deciding it for you would take away the only interesting part.
 *
 * @param {PartyMember} actor
 */
function offerBatonPass(actor) {
    const remainingFeet = getRemainingMovementFeet(actor);
    const candidates = planBatonPass({
        bonds: getCampaignBonds(),
        party: partyMembers,
        actorId: String(actor.id),
        remainingFeet,
    });

    if (candidates.length === 0) return;

    const names = candidates.map(c => c.name).join(', ');
    postCombatNarration(
        `🔄 [COMBAT] ${actor.name} puede ceder ${remainingFeet} ft de movimiento a: ${names}.`,
    );

    // Y con un boton, porque decirle a alguien que escriba un comando en mitad de un
    // combate es pedirle que deje el raton.
    showBatonPassOffer(actor, candidates, remainingFeet);
}

/**
 * Cede el movimiento que queda al companero que se nombre.
 *
 * Lo mismo que hace /relevo, porque es lo que usa /relevo: el boton y el comando
 * no pueden divergir si solo hay un sitio donde esta escrito.
 *
 * @param {string} wantedName
 * @returns {string} el nombre de quien recibe el relevo, o '' si no se pudo
 */
export function handleBatonPass(wantedName) {
    const actor = getCurrentActingMember();
    if (!actor) {
        toastr.warning('No hay un turno de jugador activo.');
        return '';
    }

    const remainingFeet = getRemainingMovementFeet(actor);
    const candidates = planBatonPass({
        bonds: getCampaignBonds(),
        party: partyMembers,
        actorId: String(actor.id),
        remainingFeet,
    });

    if (candidates.length === 0) {
        toastr.warning('No puedes ceder movimiento ahora mismo.');
        return '';
    }

    const wanted = String(wantedName ?? '').trim().toLowerCase();
    const chosen = candidates.find(c => c.name.toLowerCase() === wanted);
    if (!chosen) {
        toastr.warning(`Puedes cederlo a: ${candidates.map(c => c.name).join(', ')}.`);
        return '';
    }

    // Spent for the day, and the turn moves to whoever received it: that is what
    // makes the relay a tactical choice and not free movement for everyone.
    saveCampaignState(null, spendPerk(getCampaignBonds(), String(actor.id), 'baton_pass'));

    const index = combatEncounter.turnOrder.findIndex(e => !e.isEnemy && String(e.id) === chosen.id);
    if (index >= 0) {
        combatEncounter.currentTurnIndex = index;
        resetCombatTurnState(combatEncounter.turnOrder[index]);
    }

    postCombatNarration(`🔄 [COMBAT] ${actor.name} cede el relevo a ${chosen.name}.`);
    renderLocationMapsPreview();
    return chosen.name;
}

/**
 * El relevo, como botones sobre los companeros a los que puedes cedersele.
 *
 * Aparece solo, al derrotar a alguien, y se va solo si no lo usas: es una oportunidad,
 * no una decision pendiente que bloquee el turno.
 *
 * @param {any} actor
 * @param {Array<{id: string, name: string}>} candidates
 * @param {number} remainingFeet
 */
function showBatonPassOffer(actor, candidates, remainingFeet) {
    $('.bp-offer').remove();

    const root = $('<div class="bp-offer"></div>');
    root.append($('<div class="bp-title"></div>').text(
        `${actor.name} puede ceder ${remainingFeet} ft`));

    for (const candidate of candidates) {
        const button = $('<button class="menu_button bp-btn" type="button"></button>');
        button.append('<i class="fa-solid fa-rotate"></i>');
        button.append($('<span></span>').text(` ${candidate.name}`));
        button.on('click', () => {
            root.remove();
            handleBatonPass(candidate.name);
        });
        root.append(button);
    }

    const skip = $('<button class="menu_button bp-btn bp-skip" type="button"></button>').text('No');
    skip.on('click', () => root.remove());
    root.append(skip);

    $('body').append(root);
    // Una oferta que no se toma se retira sola: el combate sigue.
    setTimeout(() => root.remove(), 20000);
}

/**
 * @param {string} name
 */
function resolveCombatTargetByName(name) {
    const normalized = String(name || '').trim().toLowerCase();
    if (!normalized) return null;
    return getAliveEnemies().find(enemy => enemy.name.toLowerCase() === normalized) || null;
}

/**
 * @param {string} rawValue
 */
export function handlePlayerCombatMove(rawValue) {
    const entry = getCurrentTurnEntry();
    const member = getCurrentActingMember();
    if (!combatEncounter.active || !entry || entry.isEnemy || !member) {
        toastr.warning('No hay un turno de jugador activo.');
        return '';
    }

    const match = String(rawValue || '').trim().match(/^(\d+)\s*[ ,]\s*(\d+)$/);
    if (!match) {
        toastr.warning('Usa /combat-move X Y o /combat-move X,Y');
        return '';
    }

    const targetX = Math.max(0, parseInt(match[1], 10) - 1);
    const targetY = Math.max(0, parseInt(match[2], 10) - 1);
    const position = member.mapPosition || { locationName: currentLocationName, gridX: 0, gridY: 0 };
    // Una casilla con alguien no se pisa, y a una casilla sin camino no se llega.
    const occupied = occupiedCellsFor(member);
    if (occupied.has(`${targetX},${targetY}`)) {
        toastr.warning('Esa casilla ya está ocupada.', 'Ahí no se llega');
        return '';
    }
    if (currentBoardName) {
        const { terrain, gridWidth: boardW, gridHeight: boardH } = getActiveBoardContext();
        const way = findPath(terrain, position.gridX || 0, position.gridY || 0, targetX, targetY, boardW, boardH, { occupied });
        if (!way) {
            toastr.warning('No hay camino hasta esa casilla.', 'Ahí no se llega');
            return '';
        }
    }
    const distanceFeet = getDistanceInFeet(position.gridX || 0, position.gridY || 0, targetX, targetY);
    const turnState = getCurrentTurnState();
    if (!turnState) return '';
    const remainingFeet = getRemainingMovementFeet(member);

    if (distanceFeet > remainingFeet) {
        toastr.warning(`Movimiento insuficiente. Necesitas ${distanceFeet} ft y te quedan ${remainingFeet} ft.`);
        return '';
    }

    const leftFrom = { x: position.gridX || 0, y: position.gridY || 0 };
    member.mapPosition = {
        locationName: currentLocationName,
        gridX: targetX,
        gridY: targetY,
    };

    // Lo que hubiera puesto en esa casilla. Se resuelve **despues** de mover: una trampa
    // salta porque has llegado, no para impedir que llegues.
    fireHazardsOnEnter(member, targetX, targetY);
    Object.assign(combatEncounter, spendMovement(combatEncounter, distanceFeet, Number(member.speed) || 30));
    savePartyState();
    saveCombatState();

    // Salir del alcance de quien te tenia pegado cuesta un golpe gratis. Se cobra despues
    // de moverse, como en la mesa: primero te vas, luego te alcanzan.
    chargeOpportunityAttacks(member, leftFrom, { x: targetX, y: targetY });

    postCombatNarration(`🚶 [COMBAT] ${member.name} se mueve a (${targetX + 1}, ${targetY + 1}) y gasta ${distanceFeet} ft. Restante: ${getRemainingMovementFeet(member)} ft.`);

    // Hay objetivos que se ganan **andando** — «alcanza la salida», «llega al altar»— y
    // esto no se miraba al moverse: solo al atacar y al empezar ronda. Con el bicho ya
    // muerto no empezaba ninguna ronda nueva, asi que se podia estar encima de la salida,
    // con los dos objetivos en verde, y seguir en combate para siempre.
    if (checkScenarioOutcome()) return `${member.name} -> ${targetX + 1},${targetY + 1}`;

    // B2: pisar una salida deja irse de la pelea: un aviso con su botón, sin parar nada.
    offerExit(member, targetX, targetY);
    // H1: la primera vez que alguien sube a lo alto, se dice para qué sirve.
    if (isHigh(getActiveBoardContext().terrain, targetX, targetY)) showTip('high');
    // J2.2: andando se llega al alcance de alguien, y entonces se enseña a atacar.
    if (getAttackableEnemiesForMember(member).length > 0) showTip('attack');

    renderLocationMapsPreview();
    return `${member.name} -> ${targetX + 1},${targetY + 1}`;
}

/**
 * Idea 11: si hay dónde esconderse, mirando desde cada enemigo en pie.
 *
 * @param {any} member
 * @returns {{ok: boolean, reason: string}}
 */
export function hideCheck(member) {
    const x = Number(member?.mapPosition?.gridX) || 0;
    const y = Number(member?.mapPosition?.gridY) || 0;
    const terrain = getActiveBoardTerrain();
    return canHide(getAliveEnemies().map((/** @type {any} */ e) => ({
        name: String(e.name),
        cover: Number(getCoverAlongLine(terrain, Number(e.gridX) || 0, Number(e.gridY) || 0, x, y, getCoverBonus)) || 0,
    })));
}

/**
 * Idea 146: un ataque, dicho como todas las tiradas.
 *
 * @param {{who: string, at: string, total: number, ac: number, hit: boolean, natural: number, modifier: number, cover?: number, edge?: string}} input
 * @returns {string}
 */
export function attackLine({ who, at, total, ac, hit, natural, modifier, cover = 0, edge = '' }) {
    const covered = describeCover(cover).trim().replace(/^\(|\)$/g, '');
    const edged = String(edge ?? '').trim().replace(/^·\s*/, '');
    return rollLine({
        what: 'Ataque', who, at, total, against: ac, label: 'CA', success: hit, natural, modifier,
        extra: [covered, edged].filter(Boolean).join(' · '),
    });
}

/**
 * Idea 122: lanzar el aceite o la red. Gasta la acción y el objeto.
 *
 * Es un ataque a distancia improvisado: d20 más la Destreza contra la CA, con la ventaja o
 * la desventaja que toque. El aceite deja la casilla ardiendo aunque falle.
 *
 * @param {string} kind `aceite` o `red`.
 * @param {string} targetId
 * @returns {string}
 */
export function throwItem(kind, targetId) {
    const entry = getCurrentTurnEntry();
    const member = getCurrentActingMember();
    if (!combatEncounter.active || !entry || entry.isEnemy || !member) {
        toastr.warning('No hay un turno de jugador activo.');
        return '';
    }
    const spec = THROWABLES[kind];
    const carried = throwablesOf(member).find(t => t.kind === kind);
    if (!spec || !carried) {
        toastr.warning('No lleva nada así para lanzar.');
        return '';
    }
    if (!hasAction(combatEncounter, 'action')) {
        toastr.warning('Tu accion de este turno ya fue usada.');
        return '';
    }
    const target = getAliveEnemies().find((/** @type {any} */ e) => String(e.instanceId) === String(targetId))
        ?? resolveCombatTargetByName(targetId);
    const x = Number(member.mapPosition?.gridX) || 0;
    const y = Number(member.mapPosition?.gridY) || 0;
    const distanceFeet = target ? getDistanceInFeet(x, y, Number(target.gridX) || 0, Number(target.gridY) || 0) : Infinity;
    if (!target || distanceFeet > spec.rangeFeet) {
        toastr.warning(`${spec.label}: tiene que ser alguien a menos de ${spec.rangeFeet} pies.`);
        return '';
    }

    Object.assign(combatEncounter, useAction(combatEncounter, 'action'));
    consumeItemInInventory(/** @type {any} */ (member), carried.itemId);
    const modifier = getAbilityModifier(member.dexterity || 10);
    const edge = attackEdge({
        targetId: String(target.instanceId),
        height: heightFor(partyCell(member), { x: Number(target.gridX) || 0, y: Number(target.gridY) || 0 }),
        targetConditions: target.activeConditions ?? [],
        attackerConditions: member.activeConditions ?? [],
        distanceFeet,
        maneuvers: combatEncounter.maneuvers,
        byParty: true,
        attackerId: String(member.id),
        hindered: visibilityPenalties(boardVisibility(), distanceFeet),
    });
    if (edge.usesHidden) combatEncounter.maneuvers = revealHidden(combatEncounter.maneuvers, String(member.id));
    const edged = rollWithEdge(() => rollDiceDetailed('1d20', 20).total, edge.mode);
    const natural = edged.natural;
    const total = natural + modifier;
    const { ac } = getTargetArmorClass(target, member);
    const hit = natural === 20 || (natural !== 1 && total >= ac);
    showCombatDiceRoll({
        title: `${member.name} lanza`,
        subtitle: `${spec.name} contra ${target.name}`,
        formula: `1d20${modifier >= 0 ? '+' : ''}${modifier}`,
        detail: `d20(${natural}) ${modifier >= 0 ? '+' : ''}${modifier} = ${total} contra CA ${ac}`,
        total,
        dc: ac,
        natural,
        glyph: 'd20',
    });

    /** @type {string[]} */
    const lines = [`🫙 ${member.name} lanza ${spec.name.toLowerCase()} a ${target.name}.`];
    lines.push(rollLine({
        what: 'Lanzar', who: member.name, at: target.name, total, against: ac, label: 'CA', success: hit, natural, modifier,
        extra: describeEdge(edged, edge.mode, edge.reasons),
    }));
    if (kind === 'aceite') {
        if (hit) {
            const burn = rollDiceDetailed(spec.damageDice || '2d4', 4).total;
            target.currentHp = Math.max(0, (Number(target.currentHp) || 0) - burn);
            combatEncounter.tally = noteDealt(combatEncounter.tally, member.id, burn, target.currentHp === 0);
            floatOnToken(enemyTokenId(target), `-${burn}`, 'damage');
            lines.push(`🔥 ${target.name} arde: ${burn} de daño.`);
            if (target.currentHp === 0) {
                lines.push(`☠️ ${target.name} cae.`);
                recordFeat(member, 'kill', String(target.name));
            }
        } else {
            lines.push('❌ El frasco no le da, pero revienta a sus pies.');
        }
        // Aunque falle: el aceite cae y arde. El primero que lo pise, se quema. Con lluvia,
        // no prende (idea 73).
        const board = getActiveBoardContext().board;
        if (boardVisibility().wet) {
            lines.push('💧 Con esta agua, el aceite no prende.');
        } else if (board) {
            board.hazards = [...(Array.isArray(board.hazards) ? board.hazards : []),
                burningPuddle({ x: Number(target.gridX) || 0, y: Number(target.gridY) || 0, round: Number(combatEncounter.round) || 1 })];
            persistBoardTerrain(board);
            lines.push('🔥 El suelo arde donde cayó: el primero que lo pise, se quema.');
        }
    } else if (hit) {
        applyTimedCondition(target, String(target.instanceId), spec.condition || 'Restrained', spec.rounds || 2);
        lines.push(`🕸️ ${target.name} queda enredado en la red: no se mueve, y pegarle va con ventaja.`);
    } else {
        lines.push('❌ La red cae al suelo, vacía.');
    }

    saveCombatState();
    savePartyState();
    postCombatNarration(`[COMBAT] ${lines.join('\n')}`);
    if (!checkScenarioOutcome() && getAliveEnemies().length === 0 && !judgeCurrentScenario()) {
        postCombatNarration('🏆 [COMBAT] Todos los enemigos han sido derrotados.');
        endCombat('victory');
    }
    renderLocationMapsPreview();
    return `${member.name}: ${spec.label}`;
}

/**
 * Idea 8: coger lo que hay a mano —una caja, un barril, una silla de al lado— y tirárselo a
 * alguien. Con la Fuerza, sin competencia: es un ataque improvisado. Y la caja se rompe al
 * caer, así que quien se cubría detrás, ya no.
 *
 * @param {string} targetId
 * @returns {string}
 */
export function throwScenery(targetId) {
    const entry = getCurrentTurnEntry();
    const member = getCurrentActingMember();
    if (!combatEncounter.active || !entry || entry.isEnemy || !member) {
        toastr.warning('No hay un turno de jugador activo.');
        return '';
    }
    if (!hasAction(combatEncounter, 'action')) {
        toastr.warning('Tu accion de este turno ya fue usada.');
        return '';
    }
    const context = getActiveBoardContext();
    const x = Number(member.mapPosition?.gridX) || 0;
    const y = Number(member.mapPosition?.gridY) || 0;
    const spot = sceneryNear(context.terrain, x, y, context.gridWidth, context.gridHeight)[0];
    if (!spot || !context.board) {
        toastr.warning('No hay nada a mano que lanzar: una caja o un barril al lado.');
        return '';
    }
    const target = getAliveEnemies().find((/** @type {any} */ e) => String(e.instanceId) === String(targetId))
        ?? resolveCombatTargetByName(targetId);
    const distanceFeet = target ? getDistanceInFeet(x, y, Number(target.gridX) || 0, Number(target.gridY) || 0) : Infinity;
    if (!target || distanceFeet > SCENERY.rangeFeet) {
        toastr.warning(`${SCENERY.label}: tiene que ser alguien a menos de ${SCENERY.rangeFeet} pies.`);
        return '';
    }

    Object.assign(combatEncounter, useAction(combatEncounter, 'action'));
    const strength = getAbilityModifier(member.strength || 10);
    const edge = attackEdge({
        targetId: String(target.instanceId),
        height: heightFor(partyCell(member), { x: Number(target.gridX) || 0, y: Number(target.gridY) || 0 }),
        targetConditions: target.activeConditions ?? [],
        attackerConditions: member.activeConditions ?? [],
        distanceFeet,
        maneuvers: combatEncounter.maneuvers,
        byParty: true,
        attackerId: String(member.id),
        hindered: visibilityPenalties(boardVisibility(), distanceFeet),
    });
    if (edge.usesHidden) combatEncounter.maneuvers = revealHidden(combatEncounter.maneuvers, String(member.id));
    const edged = rollWithEdge(() => rollDiceDetailed('1d20', 20).total, edge.mode);
    const natural = edged.natural;
    const total = natural + strength;
    const { ac } = getTargetArmorClass(target, member);
    const hit = natural === 20 || (natural !== 1 && total >= ac);
    soundCue(hit ? 'hit' : 'miss');
    showCombatDiceRoll({
        title: `${member.name} lanza`,
        subtitle: `Lo que hay a mano contra ${target.name}`,
        formula: `1d20${strength >= 0 ? '+' : ''}${strength}`,
        detail: `d20(${natural}) ${strength >= 0 ? '+' : ''}${strength} = ${total} contra CA ${ac}`,
        total,
        dc: ac,
        natural,
        glyph: 'd20',
    });

    /** @type {string[]} */
    const lines = [`📦 ${member.name} coge lo que hay a mano en (${spot.x + 1}, ${spot.y + 1}) y se lo tira a ${target.name}.`];
    lines.push(rollLine({
        what: 'Lanzar', who: member.name, at: target.name, total, against: ac, label: 'CA', success: hit, natural, modifier: strength,
        extra: describeEdge(edged, edge.mode, edge.reasons),
    }));
    if (hit) {
        const damage = Math.max(1, rollDiceDetailed(SCENERY.damageDice, 6).total + strength);
        target.currentHp = Math.max(0, (Number(target.currentHp) || 0) - damage);
        combatEncounter.tally = noteDealt(combatEncounter.tally, member.id, damage, target.currentHp === 0);
        floatOnToken(enemyTokenId(target), `-${damage}`, 'damage');
        lines.push(`💥 Le da de lleno: ${damage} de daño.`);
        if (target.currentHp === 0) {
            lines.push(`☠️ ${target.name} cae.`);
            recordFeat(member, 'kill', String(target.name));
        }
    } else {
        lines.push('❌ No le da.');
    }
    // Se rompe al caer: donde estaba, ya no hay dónde cubrirse.
    context.board.terrain = setTerrainCell(context.terrain, spot.x, spot.y, 'floor');
    persistBoardTerrain(context.board);
    lines.push('🪵 Se rompe al caer: ahí ya no hay dónde cubrirse.');

    saveCombatState();
    postCombatNarration(`[COMBAT] ${lines.join('\n')}`);
    if (!checkScenarioOutcome() && getAliveEnemies().length === 0 && !judgeCurrentScenario()) {
        postCombatNarration('🏆 [COMBAT] Todos los enemigos han sido derrotados.');
        endCombat('victory');
    }
    renderLocationMapsPreview();
    return `${member.name}: ${SCENERY.label}`;
}

/**
 * Una maniobra: esquivar, destrabarse, empujar o ayudar.
 *
 * Gasta la accion, como en 5e. El boton de la barra de combate, el comando
 * `/maniobra` y el companero que se lleva solo pasan todos por aqui.
 *
 * @param {string} kind
 * @param {string} [targetId] El `instanceId` del enemigo, para empujar y ayudar.
 * @returns {string}
 */
export function performManeuver(kind, targetId = '') {
    const entry = getCurrentTurnEntry();
    const member = getCurrentActingMember();
    if (!combatEncounter.active || !entry || entry.isEnemy || !member) {
        toastr.warning('No hay un turno de jugador activo.');
        return '';
    }
    const maneuver = MANEUVERS[/** @type {keyof typeof MANEUVERS} */ (kind)];
    if (!maneuver) {
        toastr.warning(`No conozco esa maniobra. Hay: ${Object.keys(MANEUVERS).join(', ')}.`);
        return '';
    }
    if (!hasAction(combatEncounter, 'action')) {
        toastr.warning('Tu accion de este turno ya fue usada.');
        return '';
    }

    const from = { x: Number(member.mapPosition?.gridX) || 0, y: Number(member.mapPosition?.gridY) || 0 };
    /** @type {any} */
    let target = null;
    if (maneuver.needsTarget) {
        target = getAliveEnemies().find((/** @type {any} */ e) => String(e.instanceId) === String(targetId))
            ?? resolveCombatTargetByName(targetId);
        const far = !target || getDistanceInFeet(from.x, from.y, Number(target.gridX) || 0, Number(target.gridY) || 0) > 5;
        if (far) {
            toastr.warning(`${maneuver.label}: tiene que ser un enemigo pegado a ti.`);
            return '';
        }
    }

    // Idea 11: sin cobertura no se gasta la acción en intentarlo.
    if (kind === 'esconderse') {
        const hide = hideCheck(member);
        if (!hide.ok) {
            toastr.warning(hide.reason, 'Esconderse');
            return '';
        }
    }

    Object.assign(combatEncounter, useAction(combatEncounter, 'action'));
    const id = String(member.id);
    /** @type {string[]} */
    const lines = [];

    if (kind === 'esquivar' || kind === 'destrabarse') {
        combatEncounter.maneuvers = recordManeuver(combatEncounter.maneuvers, kind, id);
        lines.push(kind === 'esquivar'
            ? `🛡️ ${member.name} se cubre: hasta su proximo turno, atacarle es con desventaja.`
            : `🏃 ${member.name} se destraba: este turno se mueve sin dar ataques de oportunidad.`);
    } else if (kind === 'preparar') {
        // Idea 4: el golpe espera al primero que se acerque.
        combatEncounter.readied = readyAttack(combatEncounter.readied, id, Number(combatEncounter.round) || 1);
        lines.push(`⏳ ${member.name} prepara el golpe: el primero que se le acerque antes de su turno se lo lleva.`);
    } else if (kind === 'ayudar') {
        combatEncounter.maneuvers = recordManeuver(combatEncounter.maneuvers, 'ayudar', id, String(target.instanceId));
        lines.push(`🤝 ${member.name} distrae a ${target.name}: el proximo ataque del grupo contra el va con ventaja.`);
    } else if (kind === 'esconderse') {
        // Idea 11: con algo delante de cada uno que mira, Sigilo contra su mejor Percepción.
        const dc = hideDC(getAliveEnemies().map((/** @type {any} */ e) => ({ wisdom: Number(e.wisdom) || 10 })));
        const { modifier } = skillModifier(member, 'stealth');
        const natural = rollDiceDetailed('1d20', 20).total;
        const total = natural + modifier;
        showCombatDiceRoll({
            title: `${member.name} se esconde`,
            subtitle: 'Sigilo contra su Percepción',
            formula: `1d20${modifier >= 0 ? '+' : ''}${modifier}`,
            detail: `d20(${natural}) ${modifier >= 0 ? '+' : ''}${modifier} = ${total} contra ${dc}`,
            total,
            dc,
            natural,
            glyph: 'd20',
        });
        lines.push(rollLine({ what: 'Sigilo', who: member.name, total, against: dc, label: 'Percepción', success: total >= dc, natural, modifier }));
        if (total >= dc) {
            combatEncounter.maneuvers = recordManeuver(combatEncounter.maneuvers, 'esconderse', id);
            lines.push(`🫥 ${member.name} desaparece tras la cobertura: su próximo ataque, con ventaja.`);
        } else {
            lines.push(`👀 Le han visto: ${member.name} no consigue esconderse.`);
        }
    } else if (kind === 'agarrar') {
        // Idea 10: Atletismo contra el mejor de Atletismo y Acrobacias del otro, como empujar.
        const mine = getAbilityModifier(member.strength || 10);
        const theirs = Math.max(getAbilityModifier(target.strength || 10), getAbilityModifier(target.dexterity || 10));
        const attackRoll = rollDiceDetailed('1d20', 20).total;
        const defenseRoll = rollDiceDetailed('1d20', 20).total;
        showCombatDiceRoll({
            title: `${member.name} agarra`,
            subtitle: `Contra ${target.name}`,
            formula: `1d20${mine >= 0 ? '+' : ''}${mine}`,
            detail: `d20(${attackRoll}) ${mine >= 0 ? '+' : ''}${mine} = ${attackRoll + mine} contra ${defenseRoll + theirs}`,
            total: attackRoll + mine,
            dc: defenseRoll + theirs + 1,
            natural: attackRoll,
            glyph: 'd20',
        });
        lines.push(rollLine({ what: 'Agarrar', who: member.name, at: target.name, total: attackRoll + mine, against: defenseRoll + theirs, label: '', success: attackRoll + mine > defenseRoll + theirs, natural: attackRoll, modifier: mine }));
        if (attackRoll + mine > defenseRoll + theirs) {
            applyTimedCondition(target, String(target.instanceId), 'Grappled', 1);
            lines.push(`✅ ${target.name} queda agarrado: no se mueve hasta el próximo turno de ${member.name}.`);
        } else {
            lines.push(`❌ ${target.name} se suelta.`);
        }
    } else {
        // Empujar: Atletismo contra el mejor de Atletismo y Acrobacias del otro.
        const mine = getAbilityModifier(member.strength || 10);
        const theirs = Math.max(getAbilityModifier(target.strength || 10), getAbilityModifier(target.dexterity || 10));
        const attackRoll = rollDiceDetailed('1d20', 20).total;
        const defenseRoll = rollDiceDetailed('1d20', 20).total;
        const attackTotal = attackRoll + mine;
        const defenseTotal = defenseRoll + theirs;
        const { terrain, gridWidth, gridHeight } = getActiveBoardContext();
        const taken = new Set([
            ...getAliveEnemies().map((/** @type {any} */ e) => cellKey(Number(e.gridX) || 0, Number(e.gridY) || 0)),
            ...partyMembers.filter(m => (Number(m.hp) || 0) > 0)
                .map(m => cellKey(Number(m.mapPosition?.gridX) || 0, Number(m.mapPosition?.gridY) || 0)),
        ]);
        const shove = resolveShove({
            from,
            target: { x: Number(target.gridX) || 0, y: Number(target.gridY) || 0 },
            attackTotal,
            defenseTotal,
            isFree: (x, y) => isPassable(terrain, x, y, gridWidth, gridHeight) && !taken.has(cellKey(x, y)),
            isChasm: (x, y) => getCell(terrain, x, y)?.type === 'chasm',
        });

        showCombatDiceRoll({
            title: `${member.name} empuja`,
            subtitle: `Contra ${target.name}`,
            formula: `1d20${mine >= 0 ? '+' : ''}${mine}`,
            detail: `d20(${attackRoll}) ${mine >= 0 ? '+' : ''}${mine} = ${attackTotal} contra ${defenseTotal}`,
            total: attackTotal,
            dc: defenseTotal + 1,
            natural: attackRoll,
            glyph: 'd20',
        });
        lines.push(rollLine({ what: 'Empujar', who: member.name, at: target.name, total: attackTotal, against: defenseTotal, label: '', success: attackTotal > defenseTotal, natural: attackRoll, modifier: mine }));
        if (!shove.success) {
            lines.push(`❌ ${target.name} aguanta el empujon.`);
        } else if (shove.falls && shove.pushedTo) {
            // Al vacio: fuera del combate, sin tirada de dano. Es lo que tiene un precipicio.
            target.gridX = shove.pushedTo.x;
            target.gridY = shove.pushedTo.y;
            target.currentHp = 0;
            combatEncounter.conditionTimers = clearTimersFor(combatEncounter.conditionTimers, String(target.instanceId));
            lines.push(`✅ ${target.name} pierde pie y cae al vacío.`);
            bark(member, 'kill');
            // Idea 189: que se vea caer antes de que desaparezca.
            $(`.wm-token[data-token-id="${enemyTokenId(target)}"]`).addClass('wm-token-falling');
            fellThisTurn = true;
        } else if (shove.pushedTo) {
            target.gridX = shove.pushedTo.x;
            target.gridY = shove.pushedTo.y;
            lines.push(`✅ ${target.name} retrocede a (${shove.pushedTo.x + 1}, ${shove.pushedTo.y + 1}).`);
            // Idea 9: si detras habia algo puesto (una trampa, fuego), lo pisa el.
            lines.push(...shovedInto(target, shove.pushedTo));
        } else {
            // Sin sitio detras, cae: el empujon no se pierde, cambia de forma.
            applyTimedCondition(target, String(target.instanceId), 'Prone', 1);
            lines.push(`✅ ${target.name} no tiene a donde ir y cae al suelo: pegarle de cerca va con ventaja.`);
            // Idea 17: el siguiente de los tuyos que le pegue esta ronda, remata la jugada.
            combatEncounter.maneuvers = noteKnockdown(combatEncounter.maneuvers, String(target.instanceId), id, Number(combatEncounter.round) || 1);
        }
    }

    saveCombatState();
    savePartyState();
    postCombatNarration(`[COMBAT] ${lines.join('\n')}`);
    if (fellThisTurn) {
        // Idea 189: la caída se ve entera antes de repintar el tablero.
        fellThisTurn = false;
        setTimeout(() => {
            if (!checkScenarioOutcome() && getAliveEnemies().length === 0 && !judgeCurrentScenario()) {
                postCombatNarration('🏆 [COMBAT] Todos los enemigos han sido derrotados.');
                endCombat('victory');
            }
            renderLocationMapsPreview();
        }, 900);
        return `${member.name}: ${maneuver.label}`;
    }
    // Un empujon al vacio puede ser el ultimo golpe del combate.
    if (kind === 'empujar' && !checkScenarioOutcome() && getAliveEnemies().length === 0 && !judgeCurrentScenario()) {
        postCombatNarration('🏆 [COMBAT] Todos los enemigos han sido derrotados.');
        endCombat('victory');
    }
    renderLocationMapsPreview();
    return `${member.name}: ${maneuver.label}`;
}

/**
 * @param {string} rawTargetName
 */
export function handlePlayerCombatAttack(rawTargetName) {
    const entry = getCurrentTurnEntry();
    const member = getCurrentActingMember();
    const turnState = getCurrentTurnState();
    if (!combatEncounter.active || !entry || entry.isEnemy || !member || !turnState) {
        toastr.warning('No hay un turno de jugador activo.');
        return '';
    }

    if (!hasAction(combatEncounter, 'action')) {
        toastr.warning('Tu accion de este turno ya fue usada.');
        return '';
    }

    const target = resolveCombatTargetByName(rawTargetName);
    if (!target) {
        toastr.warning(`Objetivo no encontrado: ${rawTargetName}`);
        return '';
    }

    const origin = member.mapPosition || { gridX: 0, gridY: 0, locationName: currentLocationName };
    const rangeFeet = getAttackRangeFeet(member);
    const distanceFeet = getDistanceInFeet(origin.gridX || 0, origin.gridY || 0, target.gridX || 0, target.gridY || 0);
    if (distanceFeet > rangeFeet) {
        toastr.warning(`${target.name} esta fuera de rango. Distancia ${distanceFeet} ft, rango ${rangeFeet} ft.`);
        return '';
    }

    // Idea 47: lo aprendido a fuerza de tumbar a los de su clase.
    // Idea 120: el «+1» del arma suma al ataque y al daño.
    const attackMod = getPlayerAttackModifier(member, rangeFeet) + traitBonus(member, target.name) + perkBonus(member, 'attack') + weaponBonus(member);
    const edge = attackEdge({
        targetId: String(target.instanceId),
        height: heightFor(partyCell(member), { x: Number(target.gridX) || 0, y: Number(target.gridY) || 0 }),
        targetConditions: target.activeConditions ?? [],
        attackerConditions: member.activeConditions ?? [],
        distanceFeet,
        maneuvers: combatEncounter.maneuvers,
        byParty: true,
        flanked: partyFlanks(member, target),
        attackerId: String(member.id),
        hindered: visibilityPenalties(boardVisibility(), distanceFeet),
    });
    const edged = rollWithEdge(() => rollDiceDetailed('1d20', 20).total, edge.mode);
    const attackRoll = { total: edged.natural, natural: edged.natural };
    // La ayuda vale para un golpe: se gasta aunque falle.
    if (edge.usesHelp) combatEncounter.maneuvers = consumeHelp(combatEncounter.maneuvers, String(target.instanceId));
    // Idea 11: quien ataca desde su escondite deja de estar escondido.
    if (edge.usesHidden) combatEncounter.maneuvers = revealHidden(combatEncounter.maneuvers, String(member.id));
    const attackTotal = attackRoll.total + attackMod;
    const { ac: targetAc, cover: targetCover } = getTargetArmorClass(target, member);
    const isCrit = attackRoll.natural === 20;
    const isHit = isCrit || attackTotal >= targetAc;

    showCombatDiceRoll({
        title: `${member.name} ataca`,
        subtitle: `Objetivo: ${target.name}`,
        formula: `1d20${attackMod >= 0 ? '+' : ''}${attackMod}`,
        detail: `d20(${attackRoll.total}) ${attackMod >= 0 ? '+' : ''}${attackMod} = ${attackTotal}`,
        total: attackTotal,
        dc: targetAc,
        natural: attackRoll.natural,
        glyph: 'd20',
    });

    const lines = [];
    lines.push(`🗡️ ${member.name} ataca a ${target.name}.`);
    lines.push(attackLine({ who: member.name, at: target.name, total: attackTotal, ac: targetAc, hit: isHit, natural: attackRoll.total, modifier: attackMod, cover: targetCover, edge: describeEdge(edged, edge.mode, edge.reasons) }));

    Object.assign(combatEncounter, useAction(combatEncounter, 'action'));

    // Idea 186: cada golpe suena según salga.
    soundCue(isHit ? (isCrit ? 'crit' : 'hit') : 'miss');
    if (!isHit) {
        lines.push('❌ Resultado: fallo.');
        saveCombatState();
        postCombatNarration(lines.join('\n'));
        renderLocationMapsPreview();
        return `${member.name} fallo contra ${target.name}`;
    }

    const damageFormula = getPlayerDamageFormula(member, rangeFeet);
    const damageRoll = rollDiceDetailed(damageFormula, 8);
    const critRoll = isCrit ? rollDiceDetailed(damageFormula, 8) : null;
    // Idea 55: con el arma de siempre, se pega mejor.
    const weaponName = String(heldWeapon(member)?.name ?? '');
    const damageMod = Math.max(0, getPlayerAttackModifier(member, rangeFeet)) + knackBonus(member, weaponName) + weaponBonus(member);
    const totalDamage = Math.max(1, damageRoll.total + (critRoll?.total || 0) + damageMod);
    if (weaponName) recordFeat(member, 'hit', weaponName);

    showCombatDiceRoll({
        title: `${member.name} tira daño`,
        subtitle: `Contra ${target.name}`,
        formula: `${damageFormula}${isCrit ? ` + ${damageFormula}` : ''}`,
        detail: isCrit
            ? `${damageRoll.rolls.join(', ')} + crítico(${critRoll?.rolls.join(', ') || ''}) + mod(${damageMod})`
            : `${damageRoll.rolls.join(', ')} + mod(${damageMod})`,
        total: totalDamage,
        glyph: 'dmg',
    });

    target.currentHp = Math.max(0, (target.currentHp || 0) - totalDamage);
    combatEncounter.tally = noteDealt(combatEncounter.tally, member.id, totalDamage, target.currentHp === 0);
    lines.push(`✅ Resultado: impacto${isCrit ? ' critico' : ''}.`);
    lines.push(damageLine({ total: totalDamage, formula: damageFormula, rolled: damageRoll.total, modifier: damageMod, crit: isCrit ? (critRoll?.total || 0) : 0 }));
    floatOnToken(enemyTokenId(target), `-${totalDamage}`, isCrit ? 'crit' : 'damage');
    if (isCrit) recordFeat(member, 'crit');
    // Idea 17: rematar la jugada de un compañero suma.
    const combo = takeCombo(combatEncounter.maneuvers, {
        targetId: String(target.instanceId), attackerId: String(member.id), round: Number(combatEncounter.round) || 1,
    });
    if (combo.combo && target.currentHp > 0) {
        combatEncounter.maneuvers = combo.state;
        const extra = rollDiceDetailed(COMBO_DICE, 4).total;
        target.currentHp = Math.max(0, target.currentHp - extra);
        combatEncounter.tally = noteDealt(combatEncounter.tally, member.id, extra, target.currentHp === 0);
        const partner = partyMembers.find(m => String(m.id) === combo.by);
        lines.push(`🤝 Jugada combinada: ${member.name} remata lo que empezó ${partner?.name ?? 'un compañero'}: ${extra} más.`);
    }
    // Idea 15: un critico hace algo, segun el arma.
    if (isCrit && target.currentHp > 0) {
        const effect = critEffect(String(heldWeapon(member)?.damageType ?? ''));
        if (effect.kind === 'damage') {
            const extra = rollDiceDetailed(effect.dice, 8).total;
            target.currentHp = Math.max(0, target.currentHp - extra);
            combatEncounter.tally = noteDealt(combatEncounter.tally, member.id, extra, target.currentHp === 0);
            lines.push(`🩸 El crítico ${effect.label}: ${extra} más.`);
        } else {
            applyTimedCondition(target, String(target.instanceId), effect.condition, effect.rounds);
            lines.push(`💢 El crítico ${effect.label}.`);
            if (effect.condition === 'Prone') {
                combatEncounter.maneuvers = noteKnockdown(combatEncounter.maneuvers, String(target.instanceId), String(member.id), Number(combatEncounter.round) || 1);
            }
        }
    }
    if (target.currentHp === 0) {
        recordFeat(member, 'kill', String(target.name));
        const friend = getAliveEnemies()[0];
        if (friend) enemyBark(friend, 'ally_down');
    } else if (target.currentHp / Math.max(1, Number(target.maxHp) || 1) < 0.5) {
        enemyBark(target, 'hurt');
    }
    lines.push(`❤️ Estado de ${target.name}: ${target.currentHp}/${target.maxHp}`);

    if (target.currentHp === 0) {
        lines.push(`☠️ ${target.name} cae derrotado.`);
    }

    // Idea 24: el jefe contesta, una vez por ronda, si le llega quien le ha pegado.
    const round24 = Number(combatEncounter.round) || 1;
    if (canReact({
        enemy: target, reacted: combatEncounter.bossReacted, id: String(target.instanceId), round: round24,
        distanceFeet, reachFeet: Number(target.attackRangeFeet ?? target.range) || 5,
    })) {
        combatEncounter.bossReacted = markReacted(combatEncounter.bossReacted, String(target.instanceId), round24);
        lastBossLine = bossLine(Math.random, lastBossLine);
        lines.push(`👑 ${target.name}: «${lastBossLine}» Contesta en el acto.`);
        lines.push(resolveEnemyAttackOn(target, member));
    }

    // Rank 3: a critical opens the door for a companion who can already reach the target.
    // A free attack from across the room would make position meaningless, and position is
    // the whole game underneath.
    if (isCrit && target.currentHp > 0) {
        const followUp = planFollowUp({
            bonds: getCampaignBonds(),
            party: partyMembers,
            attackerId: String(member.id),
            canReach: (/** @type {any} */ ally) => {
                const from = ally.mapPosition || { gridX: 0, gridY: 0 };
                return getDistanceInFeet(from.gridX || 0, from.gridY || 0, target.gridX || 0, target.gridY || 0)
                    <= getAttackRangeFeet(ally);
            },
        });

        if (followUp) {
            lines.push(`🤝 ${followUp.actorName} aprovecha el hueco y ataca también.`);
            saveCombatState();
            postCombatNarration(lines.join('\n'));
            // Resolved as a real attack, so it rolls, it can miss and it is logged like
            // any other: a free hit that always lands is not a perk, it is a cheat.
            resolveFollowUpAttack(followUp.actorId, target);
            renderLocationMapsPreview();
            return `${member.name} golpea a ${target.name}`;
        }
    }

    saveCombatState();
    // C7: quien pega dice algo, a veces. No cuesta tokens: son frases escritas.
    bark(member, target.currentHp === 0 ? 'kill' : (isCrit ? 'crit' : 'hit'));
    postCombatNarration(lines.join('\n'));

    // A scenario decides the fight when the board carries one: clearing the enemies is
    // just one way to finish, and not always the way that was asked for.
    if (checkScenarioOutcome()) return `${member.name} derrota a ${target.name}`;

    if (getAliveEnemies().length === 0 && !judgeCurrentScenario()) {
        postCombatNarration('🏆 [COMBAT] Todos los enemigos han sido derrotados.');
        endCombat('victory');
        renderLocationMapsPreview();
        return `${member.name} derrota a ${target.name}`;
    }

    if (target.currentHp === 0) offerBatonPass(member);

    renderLocationMapsPreview();
    return `${member.name} golpea a ${target.name}`;
}

/**
 * Idea 153: pasar el turno con el golpe sin dar, preguntando antes. Solo cuando de verdad
 * se puede pegar a alguien: si no hay a quien, no hay nada que perder y no se pregunta.
 *
 * @returns {Promise<void>}
 */
export async function confirmEndTurn() {
    const member = getCurrentActingMember();
    const reachable = member && hasAction(combatEncounter, 'action') ? getAttackableEnemiesForMember(member) : [];
    if (reachable.length > 0) {
        const go = await Popup.show.confirm('¿Acabar el turno?',
            `Aún puedes atacar a ${reachable.map(e => e.name).slice(0, 3).join(', ')}. Si acabas, la acción se pierde.`,
            { okButton: 'Acabar igual', cancelButton: 'Seguir' });
        if (!go) return;
    }
    endPlayerCombatTurn();
}

export function endPlayerCombatTurn() {
    const entry = getCurrentTurnEntry();
    if (!entry || entry.isEnemy) {
        toastr.warning('No hay un turno de jugador que cerrar.');
        return '';
    }

    const nextEntry = runCombatTurnLoop(false);
    renderLocationMapsPreview();
    return nextEntry ? nextEntry.name : '';
}
