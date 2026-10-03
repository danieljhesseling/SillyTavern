/**
 * El turno de los enemigos: qué hace cada uno, sus golpes y habilidades, los ataques de
 * oportunidad y lo que gritan.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import { chat_metadata, saveMetadata } from '../../script.js';
import { getCurrentWorldEnemies } from '../world-info.js';
import { getAbilityModifier } from '../dnd-system.js';
import { rollDiceDetailed, getDistanceInFeet, getAttackRangeFeet, getEnemyDamageFormula, getPlayerDamageFormula, getPlayerAttackModifier } from './combat-rules.js';
import { tacticOf, leaderBonus, breaksAndRuns } from '../game-engine/combat/enemy-roles.js';
import { noteEscape } from '../game-engine/campaign/nemesis.js';
import { exitCells } from '../game-engine/board/exits.js';
import { truceOffered, callsForHelp, helpWave } from '../game-engine/combat/morale-options.js';
import { spendCharge } from '../game-engine/rules/grimoire.js';
import { planEnemyTurn } from '../game-engine/combat/enemy-ai.js';
import { chooseEnemyAbility, longestReach, averageOf } from '../game-engine/combat/enemy-abilities.js';
import {
    attackEdge, rollWithEdge, describeEdge, readManeuvers, cannotAct, recordManeuver, consumeHelp, revealHidden, canHide,
} from '../game-engine/combat/maneuvers.js';
import {
    enemyWeapon, enemyPotions, chooseEnemyAction2024, chooseEnemyBefore2024, chooseEnemySlot, enemySaveDC, masteryLine,
    pushTrail, enemyAttackBonus, enemyAttackHits,
} from '../game-engine/combat/ai-2024.js';
import {
    masteryFires, grazeDamage, toppled, cleaveTarget, combineEdge, noteVex, takeVex, turnFlags, markTurn,
} from '../game-engine/rules/weapon-mastery.js';
import { escapeSave, saveFails, saveLine } from '../game-engine/rules/unarmed.js';
import { HIDE_DC } from '../game-engine/rules/actions-2024.js';
import { normalizeSpell, findSpell } from '../game-engine/rules/spell-catalogue.js';
import { getCell, getCoverBonus } from '../game-engine/board/terrain.js';
import { isHigh, elevationAt } from '../game-engine/board/heights.js';
import { hazardsAt } from '../game-engine/board/hazards.js';
import { getCoverAlongLine, hasLineOfSight } from '../game-engine/board/line-of-sight.js';
import { dropReadied, readiedAgainst } from '../game-engine/combat/readied.js';
import { describeIntents } from '../game-engine/combat/forecast.js';
import { noteTaken } from '../game-engine/combat/tally.js';
import { damageLine } from '../game-engine/rules/roll-line.js';
import { chooseEnemyBark } from '../game-engine/combat/barks.js';
import { breaksMorale } from '../game-engine/combat/crits.js';
import { planEndure } from '../game-engine/combat/bond-perks.js';
import { spendPerk } from '../game-engine/campaign/bonds.js';
import { knownAbilities, spendAbilityUse } from '../game-engine/rules/abilities.js';
import { readCasterBlock, spendEnemySlot, enemySpellAbilities, enemySpellAt, enemySlotsLeft } from '../game-engine/combat/enemy-spells.js';
import { readConcentration } from '../game-engine/rules/concentration.js';
import { zoneFlagsAt } from '../game-engine/board/spell-zones.js';
import { takeHitWhileDown, clearDeathSaves } from '../game-engine/rules/death-saves.js';
import { findOpportunityAttacks, describeOpportunity } from '../game-engine/combat/opportunity.js';
import { NEMESES_KEY } from './keys.js';
import { combatEncounter, currentBoardName, currentLocationName, partyMembers, usedReactions } from './state.js';
import { getAbilityCatalogue, resolveAbilityOnBoard, spellRows, applyTimedCondition, castsLikeFifth } from './magic.js';
import {
    enemyTokenId, flankedFrom, getAliveEnemies, getEnemyByInstanceId, getLivingPartyMembers, getTargetArmorClass,
    heightFor, heldInPlace, partyCell, saveCombatState, speedOf,
} from './combat-state.js';
import { floatOnToken, showCombatDiceRoll } from './combat-log.js';
import { fxMark, stageAttack, stageMove } from './combat-fx.js';
import { CONDITION_WORDS, judgeCurrentScenario, checkScenarioOutcome, endCombat, offerTruce } from './combat-flow.js';
import { resolveFollowUpAttack, attackLine, shoveGround } from './player-actions.js';
import { persistBoardTerrain, getActiveBoardContext, attackHindrance, boardVisibility, fireHazardsOnEnter } from './board.js';
import { getCampaignBonds, saveCampaignState, campaignDay } from './time.js';
import { postCombatNarration } from './narration.js';
import { savePartyState, renderPartyMembers } from './roster.js';
import { rememberTogether, bark, recordFeat } from './companions.js';
import {
    concentrationAfterHurt, counterAgainst, enemyWalksZones, hurtSummon, livingSummons, shieldAgainst,
} from './spell-turn.js';
import { brawlEnemyTurn, brawlKnockOut } from './brawl.js';

/**
 * Resuelve un golpe de un enemigo contra alguien del grupo.
 *
 * Extraido del turno enemigo porque un **ataque de oportunidad** es exactamente esto y no
 * otra cosa: el mismo d20, la misma cobertura, el mismo critico y las mismas salvaciones
 * de muerte. Dos copias de esta aritmetica serian dos sitios donde discrepar.
 *
 * Tanda 12: con su arma de 2024 (`ai-2024.js`): su maestría al dar (o Rozar al fallar), y en
 * su propio turno, Hender (el tajo sigue hasta otro) y la otra mano (dos armas ligeras).
 *
 * @param {any} enemy
 * @param {any} target
 * @param {{ownTurn?: boolean, bonusFree?: boolean}} [options] `ownTurn`: es su turno (no una
 *   reacción); `bonusFree`: le queda la acción adicional (no se ha bebido una poción).
 * @returns {string} Lo ocurrido, ya escrito.
 */
export function resolveEnemyAttackOn(enemy, target, { ownTurn = false, bonusFree = true } = {}) {
    const weapon = ai2024() ? weaponOfEnemy(enemy) : null;
    const first = enemyStrike(enemy, target, { weapon });
    /** @type {string[]} */
    const lines = [first.text];
    if (!weapon || !ownTurn || !combatEncounter.active) return lines.join('\n');
    const round = Number(combatEncounter.round) || 1;
    const id = String(enemy.instanceId);

    // Hender: si da, el mismo tajo sigue hasta otro de los vuestros pegado al primero (una vez
    // por turno, sin su modificador al daño).
    if (first.hit && weapon.mastery === 'cleave' && !weapon.ranged && !turnFlags(combatEncounter.tactics, id, round).cleaved) {
        const from = { x: Number(enemy.gridX) || 0, y: Number(enemy.gridY) || 0 };
        const secondId = cleaveTarget({
            first: { id: String(target.id), ...partyCell(target) },
            attacker: from,
            reachFeet: Math.min(10, Number(enemy.attackRangeFeet) || 5),
            others: getLivingPartyMembers().map(m => ({ id: String(m.id), ...partyCell(m), hp: Number(m.hp) || 0 })),
        });
        const second = secondId ? getLivingPartyMembers().find(m => String(m.id) === secondId) : null;
        if (second) {
            combatEncounter.tactics = markTurn(combatEncounter.tactics, id, round, { cleaved: true });
            lines.push(masteryLine('cleave', { who: enemy.name, at: second.name, weapon: weapon.name }));
            lines.push(enemyStrike(enemy, second, { weapon: { ...weapon, mastery: '' }, noModifier: true }).text);
        }
    }

    // La otra mano: con dos armas ligeras, otro golpe sin su modificador. Mellar deja darlo sin
    // gastar la acción adicional; sin Mellar, solo si no la ha gastado (en una poción).
    const offHand = weapon.offHand;
    const nick = weapon.mastery === 'nick' || offHand?.mastery === 'nick';
    if (offHand && (Number(target.hp) || 0) > 0 && combatEncounter.active && (bonusFree || nick)) {
        lines.push(`🗡️ ${enemy.name} pega también con la otra mano (${offHand.name}${nick ? ', Mellar' : ''}).`);
        lines.push(enemyStrike(enemy, target, { weapon: { ...weapon, name: offHand.name, mastery: offHand.mastery }, noModifier: true }).text);
    }
    return lines.join('\n');
}

/**
 * Un golpe de un enemigo: el d20 con su ventaja o desventaja, el daño y lo que deja.
 *
 * @param {any} enemy
 * @param {any} target
 * @param {{weapon?: import('../game-engine/combat/ai-2024.js').EnemyWeapon|null, noModifier?: boolean}} [options]
 *   `noModifier`: el golpe de la otra mano o el de Hender, sin su modificador al daño.
 * @returns {{text: string, hit: boolean}}
 */
function enemyStrike(enemy, target, { weapon = null, noModifier = false } = {}) {
    /** @type {string[]} */
    const lines = [];
    const on = ai2024();
    const enemyId = String(enemy.instanceId);
    const round = Number(combatEncounter.round) || 1;

    // Esquivar, estar en el suelo: lo que cambia el dado antes de tirarlo.
    const enemyFeet = getDistanceInFeet(
        Number(enemy.gridX) || 0, Number(enemy.gridY) || 0,
        Number(target.mapPosition?.gridX) || 0, Number(target.mapPosition?.gridY) || 0);
    const baseEdge = attackEdge({
        targetId: String(target.id),
        targetConditions: target.activeConditions ?? [],
        attackerConditions: enemy.activeConditions ?? [],
        // Ideas 73 y 90: la niebla y la noche estorban a los dos bandos.
        // J19.6: y una zona que no deja ver (niebla, oscuridad) entre los dos, también.
        hindered: attackHindrance({ x: Number(enemy.gridX) || 0, y: Number(enemy.gridY) || 0 }, partyCell(target), enemyFeet),
        distanceFeet: enemyFeet,
        // B1: desde arriba, mejor.
        height: heightFor({ x: Number(enemy.gridX) || 0, y: Number(enemy.gridY) || 0 }, partyCell(target)),
        maneuvers: combatEncounter.maneuvers,
        // El flanqueo vale para los dos bandos.
        flanked: flankedFrom(
            { x: Number(enemy.gridX) || 0, y: Number(enemy.gridY) || 0 },
            { x: Number(target.mapPosition?.gridX) || 0, y: Number(target.mapPosition?.gridY) || 0 },
            getAliveEnemies().filter(e => e !== enemy).map(e => ({ x: Number(e.gridX) || 0, y: Number(e.gridY) || 0 })),
        ),
        // J19: Protección contra el mal y el bien estorba a los muertos, los demonios…
        attackerKind: enemyKind(enemy),
        // Tanda 12: quien sale de su escondite pega con ventaja (y deja de estar escondido).
        attackerId: on ? enemyId : '',
    });
    /** @type {{mode: 'advantage'|'disadvantage'|'normal', reasons: string[]}} */
    let edge = baseEdge;
    if (on) {
        /** @type {string[]} */
        const up = [];
        // Tanda 12: Molestar (su golpe anterior le dejó medido) y Ayudar (uno de los suyos le
        // abre la guardia).
        const vex = takeVex(combatEncounter.tactics, { by: enemyId, target: String(target.id), round });
        if (vex.vex) {
            combatEncounter.tactics = vex.state;
            up.push('le tiene medido');
        }
        const helper = enemyHelpAgainst(target);
        if (helper) {
            combatEncounter.maneuvers = consumeHelp(combatEncounter.maneuvers, String(target.id));
            up.push(`${helper} le abre la guardia`);
        }
        if (up.length > 0) edge = combineEdge(baseEdge, up);
        if (baseEdge.usesHidden) combatEncounter.maneuvers = revealHidden(combatEncounter.maneuvers, enemyId);
    }
    const edged = rollWithEdge(() => rollDiceDetailed('1d20', 20).total, edge.mode);
    const attackRoll = { total: edged.natural, natural: edged.natural };
    const d20 = attackRoll.total;
    const abilityMod = Math.max(getAbilityModifier(enemy.strength || 10), getAbilityModifier(enemy.dexterity || 10));
    // R7: con su líder cerca, pega mejor. R6: y un jefe enfurecido, más. J4.6: y el ajuste
    // al nivel del grupo, si el tablero es de otro nivel. Tanda 22: y su competencia, por su
    // desafío, como en los bloques de 5e (+2 hasta el 4, +3 hasta el 8…).
    const attackMod = enemyAttackBonus(enemy) + (Number(/** @type {any} */ (enemy).rage) || 0) + (Number(/** @type {any} */ (enemy).levelHit) || 0) + leaderBonus(
        { id: String(enemy.instanceId), x: Number(enemy.gridX) || 0, y: Number(enemy.gridY) || 0 },
        getAliveEnemies().map(e => ({ id: String(e.instanceId), x: Number(e.gridX) || 0, y: Number(e.gridY) || 0, hp: Number(e.currentHp) || 0, role: String(/** @type {any} */ (e).role ?? '') })),
    );
    const attackTotal = d20 + attackMod;
    const { ac: targetAc, cover: targetCover } = getTargetArmorClass(target, enemy);
    const isCrit = d20 === 20;
    // Tanda 22: un 1 natural falla siempre, también para ellos.
    const wouldHit = enemyAttackHits({ natural: d20, total: attackTotal, ac: targetAc });
    // J19.7: quien sabe Escudo lo levanta si con él el golpe ya no entra (un crítico entra igual).
    const shield = wouldHit && !isCrit ? shieldAgainst(target, { attackTotal, targetAc }) : { blocked: false, lines: [] };
    const isHit = wouldHit && !shield.blocked;

    showCombatDiceRoll({
        title: `${enemy.name} ataca`,
        subtitle: `Objetivo: ${target.name}`,
        formula: `1d20${attackMod >= 0 ? '+' : ''}${attackMod}`,
        detail: `d20(${d20}) ${attackMod >= 0 ? '+' : ''}${attackMod} = ${attackTotal}`,
        total: attackTotal,
        dc: targetAc,
        natural: attackRoll.natural,
        glyph: 'd20',
        // Tanda 17: en la secuencia del combate, como los golpes del grupo.
        stage: {
            by: enemy, at: target, hit: isHit, roll: edged, edge: edge.mode, against: 'CA',
            style: weapon?.ranged || enemyFeet > 10 ? 'ranged' : 'melee',
            // J12.19: con qué pega, para dibujar cómo llega el golpe.
            damageType: `${/** @type {any} */ (weapon)?.damageType || ''} ${weapon?.name || ''}`.trim(),
        },
    });

    lines.push(`👹 ${enemy.name} ataca a ${target.name}${weapon ? ` con ${weaponWords(weapon.name)}` : ''}.`);
    lines.push(attackLine({ who: enemy.name, at: target.name, total: attackTotal, ac: targetAc, hit: wouldHit, natural: d20, modifier: attackMod, cover: targetCover, edge: describeEdge(edged, edge.mode, edge.reasons) }));
    lines.push(...shield.lines);

    if (!isHit) {
        lines.push('❌ Resultado: fallo.');
        // Tanda 12: Rozar (un espadón, una guja): aunque falle, el filo le alcanza.
        const graze = weapon && masteryFires(weapon.mastery, { hit: false }) ? grazeDamage(abilityMod) : 0;
        if (graze > 0 && weapon) {
            lines.push(`${masteryLine('graze', { who: enemy.name, at: target.name, weapon: weapon.name })} ${graze} de daño.`);
            lines.push(...damagePartyMember(target, graze));
            floatOnToken(target.id, `-${graze}`, 'damage');
        }
        if (shield.blocked || graze > 0) {
            savePartyState();
            saveCombatState();
        }
        return { text: lines.join('\n'), hit: false };
    }

    const dmgFormula = getEnemyDamageFormula(enemy.cr || 0);
    const baseDamageRoll = rollDiceDetailed(dmgFormula, 8);
    const baseDamage = baseDamageRoll.total;
    // J4.6: el ajuste al nivel del grupo va con el modificador. Puede restar: el golpe que
    // acierta hace 1 como poco. Tanda 12: el de la otra mano y el de Hender, sin modificador.
    const fullMod = Math.max(0, getAbilityModifier(enemy.strength || 10)) + (Number(/** @type {any} */ (enemy).levelDamage) || 0);
    const strMod = noModifier ? Math.min(0, fullMod) : fullMod;
    const critBonusRoll = isCrit ? rollDiceDetailed(dmgFormula, 8) : null;
    const critBonus = critBonusRoll ? critBonusRoll.total : 0;
    const totalDamage = Math.max(1, baseDamage + critBonus + strMod);

    showCombatDiceRoll({
        title: `${enemy.name} tira daño`,
        subtitle: `Contra ${target.name}`,
        formula: `${dmgFormula}${isCrit ? ` + ${dmgFormula}` : ''}`,
        detail: isCrit
            ? `${baseDamageRoll.rolls.join(', ')} + crítico(${critBonusRoll?.rolls.join(', ') || ''}) + mod(${strMod})`
            : `${baseDamageRoll.rolls.join(', ')} + mod(${strMod})`,
        total: totalDamage,
        glyph: 'dmg',
        stage: { dice: `${dmgFormula}${isCrit ? ` + ${dmgFormula}` : ''}`, modifier: strMod, crit: isCrit },
    });

    lines.push(`✅ Resultado: impacto${isCrit ? ' critico' : ''}.`);
    lines.push(damageLine({ total: totalDamage, formula: dmgFormula, rolled: baseDamage, modifier: strMod, crit: isCrit ? critBonus : 0 }));
    lines.push(...damagePartyMember(target, totalDamage, isCrit));
    floatOnToken(target.id, `-${totalDamage}`, 'damage');
    enemyBark(enemy, 'hit');

    // Tanda 12: la maestría de su arma (Molestar, Derribar, Debilitar, Ralentizar, Empujar).
    if (weapon && masteryFires(weapon.mastery, { hit: true, damage: totalDamage }) && (Number(target.hp) || 0) > 0) {
        lines.push(...enemyMasteryOnHit(enemy, target, weapon));
    }

    if (target.hp > 0 && isCrit && Math.random() < 0.35) {
        const pool = ['Bleeding', 'Poisoned', 'Prone', 'Frightened'];
        const candidates = pool.filter(status => !target.activeConditions.includes(status));
        if (candidates.length) {
            const status = candidates[Math.floor(Math.random() * candidates.length)];
            target.activeConditions.push(status);
            lines.push(`🧪 Efecto adicional: ${target.name} queda ${status}.`);
        }
    }

    savePartyState();
    saveCombatState();
    return { text: lines.join('\n'), hit: true };
}

/**
 * Un golpe que le llega a alguien del grupo: el ataque de un enemigo o su habilidad.
 *
 * Una sola puerta, para que un conjuro que tumba a alguien cuente igual que una espada:
 * el companero de rango 8 que se interpone, la cuenta de salvaciones al caer, y el fallo
 * automatico si ya estaba en el suelo.
 *
 * @param {any} target
 * @param {number} totalDamage
 * @param {boolean} [isCrit]
 * @returns {string[]}
 */
export function damagePartyMember(target, totalDamage, isCrit = false) {
    // J19.5: una invocación no se desangra ni tira salvaciones: a cero, se desvanece.
    if (target?.summon) return hurtSummon(target, totalDamage);

    /** @type {string[]} */
    const lines = [];

    // Rank 8: a companion steps in rather than watch them drop. Once a day, and only
    // when the blow would really have finished them.
    const rescue = planEndure({
        bonds: getCampaignBonds(),
        party: partyMembers,
        targetId: String(target.id),
        currentHp: Number(target.hp) || 0,
        damage: totalDamage,
    });

    // Antes de escribir el dano: hace falta saber si ya estaba en el suelo, porque un
    // golpe sobre un cuerpo caido cuenta distinto que el golpe que lo tira.
    const wasDown = (Number(target.hp) || 0) <= 0;
    const before = Number(target.hp) || 0;

    if (rescue) {
        saveCampaignState(null, spendPerk(getCampaignBonds(), rescue.saviourId, rescue.perkId));
        target.hp = 1;
        lines.push(`🛡️ ${rescue.saviourName} se interpone: ${target.name} aguanta con 1 HP.`);
        rememberTogether(`${rescue.saviourName} se interpuso para salvar a ${target.name} en ${currentBoardName || currentLocationName}.`,
            [rescue.saviourName, String(target.name)]);
        recordFeat(partyMembers.find(m => String(m.id) === String(rescue.saviourId)), 'rescue');
    } else {
        target.hp = Math.max(0, (target.hp || 0) - totalDamage);
    }

    target.activeConditions = Array.isArray(target.activeConditions) ? target.activeConditions : [];
    lines.push(`❤️ Estado de ${target.name}: ${target.hp}/${target.maxHp}`);
    if (combatEncounter.active) {
        combatEncounter.tally = noteTaken(combatEncounter.tally, target.id, before - (Number(target.hp) || 0), !wasDown && target.hp === 0);
    }

    // J12.7: en una pelea sin muertes, quien cae queda fuera de combate: ni salvaciones ni remate.
    const knocked = target.hp === 0 ? brawlKnockOut(target) : null;
    if (knocked) lines.push(...knocked);
    else if (target.hp === 0) {
        if (!target.activeConditions.includes('Unconscious')) {
            target.activeConditions.push('Unconscious');
        }

        // Golpear a alguien que ya estaba en el suelo es un fallo automatico de salvacion
        // — dos si es critico —; caer por primera vez solo empieza la cuenta.
        if (wasDown) {
            const hit = takeHitWhileDown(target, isCrit);
            target.deathSaves = hit.saves;
            lines.push(hit.line);
        } else {
            target.deathSaves = clearDeathSaves();
            recordFeat(target, 'downed');
            lines.push(`🩸 ${target.name} cae a 0 PG y empieza a jugársela: `
                + 'tres éxitos para estabilizarse, tres fallos y se acabó.');
            // C7: alguien de pie lo grita.
            const witness = partyMembers.find(m => String(m.id) !== String(target.id)
                && String(m.id) !== String(partyMembers[0]?.id) && (Number(m.hp) || 0) > 0);
            if (witness) bark(witness, 'ally_down', String(target.name));
        }
    } else if ((Number(target.hp) || 0) / Math.max(1, Number(target.maxHp) || 1) < 0.3) {
        bark(target, 'hurt');
    }

    // J19.4: quien se concentra y recibe un golpe, aguanta o lo pierde (y si cae, lo pierde).
    lines.push(...concentrationAfterHurt(target, before - (Number(target.hp) || 0)));

    return lines;
}

/**
 * Un enemigo usa una habilidad del catalogo.
 *
 * La decision es de `enemy-abilities.js`; la tirada, de `planAbilityUse`, la misma que usa
 * el grupo. Aqui solo se escribe en las fichas.
 *
 * @param {any} enemy
 * @param {import('../game-engine/combat/enemy-abilities.js').AbilityChoice} choice
 * @returns {string}
 */
function resolveEnemyAbility(enemy, choice) {
    let { ability } = choice;
    const target = choice.side === 'enemy'
        ? partyMembers.find(m => String(m.id) === choice.targetId)
        : (choice.side === 'self' ? enemy : getEnemyByInstanceId(choice.targetId));
    if (!target) return '';

    // J19.12: un conjuro de su bloque `spellcasting` gasta su espacio; lo innato y lo demás,
    // su uso. Contarlo en los dos sitios lo gastaría dos veces.
    const block = readCasterBlock(enemy.spellcasting);
    const fromSlot = Boolean(block) && Number(ability.spellLevel) > 0 && !(/** @type {any} */ (ability).innate);
    // Tanda 12 (J19.3): con un espacio mayor, si el conjuro crece con él y ese espacio no lo
    // guarda para otro.
    const upcast = fromSlot && block && ai2024()
        ? upcastFor(enemy, block, ability, choice.side === 'enemy' ? Number(target.hp) || 0 : 0) : null;
    if (upcast) ability = upcast.ability;
    if (fromSlot && block) enemy.slotsUsed = spendEnemySlot(enemy, block, Number(ability.slotLevel) || Number(ability.spellLevel));
    else enemy.abilityUses = spendAbilityUse(enemy, ability);
    // R4: un cultista también gasta las cargas de su círculo.
    if (typeof ability.circle === 'number' && ability.circle > 0) enemy.spellCharges = spendCharge(enemy, ability.circle);
    // J19.7: alguien del grupo con Contraconjuro, a su alcance, lo corta antes de que salga.
    const counter = typeof ability.spellLevel === 'number' ? counterAgainst(enemy, ability) : { countered: false, lines: [] };
    if (counter.countered) {
        savePartyState();
        saveCombatState();
        renderPartyMembers();
        return [`🪄 ${enemy.name} lanza ${ability.name}.`, ...counter.lines].join('\n');
    }
    // J19.7: los dardos que no fallan (Proyectil mágico) se deshacen contra Escudo, si quien
    // los recibe lo sabe.
    const darts = typeof ability.spellLevel === 'number' && ability.resolution === 'auto' && Number(ability.rays) > 1 && Boolean(ability.damage);
    if (darts && choice.side === 'enemy' && partyMembers.includes(target)) {
        const shield = shieldAgainst(target, { attackTotal: 0, targetAc: 0, magicMissile: true });
        if (shield.blocked) {
            savePartyState();
            saveCombatState();
            renderPartyMembers();
            return [...counter.lines, `🪄 ${enemy.name} lanza ${ability.name} sobre ${target.name}.`, ...shield.lines].join('\n');
        }
    }
    // Tanda 17: lo que lanza sale hacia quien lo recibe, en la secuencia del combate.
    if (target !== enemy) stageAttack(enemy, target, 'spell', undefined, `${ability.damageType || ''} ${ability.name || ''}`.trim());
    // R3: el mismo camino que el grupo: con área, alcanza también a los suyos si están ahí.
    const lines = [
        ...counter.lines,
        ...(upcast ? [`🪄 ${enemy.name} gasta un espacio de nivel ${upcast.level} en ${ability.name}: ${upcast.detail}.`] : []),
        ...resolveAbilityOnBoard({ actor: enemy, side: 'enemy', ability, subject: target }),
    ];

    savePartyState();
    saveCombatState();
    renderPartyMembers();
    return lines.join('\n');
}

/**
 * J19.12: lo que sabe usar un enemigo: sus habilidades y, si trae bloque `spellcasting`, sus
 * conjuros de `conjuros.json` con los espacios que le quedan. Si ya se concentra en algo, no
 * suelta su conjuro por otro (`enemySpellAbilities`); dentro de un silencio no dice ninguno.
 *
 * @param {any} enemy
 * @returns {any[]}
 */
export function enemyAbilities(enemy) {
    const known = knownAbilities(enemy, getAbilityCatalogue());
    const block = readCasterBlock(enemy?.spellcasting);
    if (!block) return known;
    const zones = Array.isArray(combatEncounter.spellZones) ? combatEncounter.spellZones : [];
    if (zoneFlagsAt(zones, { x: Number(enemy.gridX) || 0, y: Number(enemy.gridY) || 0 }).silence) return known;
    const spells = enemySpellAbilities({ enemy, block, catalogue: spellRows(), concentrating: Boolean(readConcentration(enemy.concentration)) });
    const own = new Set(spells.map(ability => ability.id));
    return [...spells, ...known.filter(ability => !own.has(ability.id))];
}

/**
 * Qué es un enemigo, en palabras, para lo que distingue a los muertos, los demonios o las
 * bestias (Protección contra el mal y el bien): sus etiquetas, su nombre y su arquetipo.
 *
 * @param {any} enemy
 * @returns {string}
 */
function enemyKind(enemy) {
    const template = getCurrentWorldEnemies().find((/** @type {any} */ t) => String(t.id) === String(enemy?.templateId));
    return [enemy?.name, template?.name, enemy?.archetype, template?.archetype, ...(Array.isArray(template?.tags) ? template.tags : [])]
        .filter(Boolean).map(String).join(' ');
}

/**
 * Lo que haria este enemigo si le tocase ahora: a por quien va y adonde se mueve.
 *
 * Lo usa su turno de verdad y lo usan las intenciones que se ven en la barra: al ser la
 * misma cuenta, lo que se anuncia es lo que pasa (salvo que el grupo se mueva antes, que
 * es justo para lo que sirve verlo).
 *
 * @param {any} enemy
 * @returns {import('../game-engine/combat/enemy-ai.js').TurnPlan}
 */
export function planFor(enemy) {
    const enemyX = Number.isFinite(Number(enemy.gridX)) ? Number(enemy.gridX) : 0;
    const enemyY = Number.isFinite(Number(enemy.gridY)) ? Number(enemy.gridY) : 0;
    // J19.5: las invocaciones del grupo también se ponen en medio, y se les pega.
    const livingParty = [...getLivingPartyMembers(), ...livingSummons()];
    const { terrain, gridWidth, gridHeight } = getActiveBoardContext();
    const known = enemyAbilities(enemy);

    /** @param {any} member */
    const memberCell = (member) => ({
        x: Number.isFinite(Number(member.mapPosition?.gridX)) ? Number(member.mapPosition.gridX) : 0,
        y: Number.isFinite(Number(member.mapPosition?.gridY)) ? Number(member.mapPosition.gridY) : 0,
    });

    return planEnemyTurn({
        actor: {
            id: String(enemy.instanceId),
            gridX: enemyX,
            gridY: enemyY,
            currentHp: Number(enemy.currentHp) || 0,
            maxHp: Number(enemy.maxHp) || 0,
            // Agarrado o apresado no anda: pega a quien tenga al lado, si tiene a alguien.
            // J19: y lo que le han echado encima (Ralentizado por el Rayo de escarcha, Acelerado).
            speedFeet: heldInPlace(enemy) ? 0 : speedOf(enemy),
            // Un cultista con un rayo de 120 ft se queda a su distancia, no se acerca a dar
            // punetazos. Sin habilidades, su alcance de siempre.
            attackRangeFeet: Math.max(Number(enemy.attackRangeFeet ?? enemy.range) || 5, longestReach(enemy, known)),
            profile: enemy.profile,
            // R7: su papel y la táctica de su bando.
            role: String(/** @type {any} */ (enemy).role ?? ''),
            tactic: tacticOf(enemy)?.id ?? '',
        },
        targets: livingParty.map(member => {
            const cell = memberCell(member);
            return {
                id: String(member.id),
                gridX: cell.x,
                gridY: cell.y,
                currentHp: Number(member.hp) || 0,
                maxHp: Number(member.maxHp) || 0,
            };
        }),
        allies: getAliveEnemies()
            .filter(other => other.instanceId !== enemy.instanceId)
            .map(other => ({
                id: String(other.instanceId),
                gridX: Number(other.gridX) || 0,
                gridY: Number(other.gridY) || 0,
                currentHp: Number(other.currentHp) || 0,
                maxHp: Number(other.maxHp) || 0,
            })),
        terrain,
        gridWidth,
        gridHeight,
    });
}

/**
 * Lo que va a hacer cada enemigo, en una linea por enemigo.
 *
 * @returns {string[]}
 */
export function buildEnemyIntents() {
    if (!combatEncounter.active) return [];
    const names = Object.fromEntries([...partyMembers, ...livingSummons()].map(m => [String(m.id), String(m.name)]));
    return describeIntents(
        getAliveEnemies().map(enemy => ({ name: String(enemy.name), plan: planFor(enemy) })),
        names,
    ).map(intent => intent.text);
}

// ---------------------------------------------------------------- tanda 12: las reglas de 2024

/**
 * Tanda 12: si la IA juega con las reglas de 2024 (`ai-2024.js`). Solo se apaga para comparar
 * en las simulaciones (`tools/sim-campana.mjs --sin-ia-2024` deja `sillytavern_ia2024` en `off`).
 *
 * @returns {boolean}
 */
export function ai2024() {
    try {
        return globalThis.localStorage?.getItem('sillytavern_ia2024') !== 'off';
    } catch {
        return true;
    }
}

/**
 * La plantilla del bestiario de un enemigo, si la hay.
 *
 * @param {any} enemy
 * @returns {any}
 */
function templateOf(enemy) {
    return getCurrentWorldEnemies().find((/** @type {any} */ t) => String(t.id) === String(enemy?.templateId)) ?? null;
}

/**
 * Tanda 12: con qué pega un enemigo: lo que dice su ficha (`weapon`) o su descripción.
 *
 * @param {any} enemy
 * @returns {import('../game-engine/combat/ai-2024.js').EnemyWeapon|null}
 */
export function weaponOfEnemy(enemy) {
    const template = templateOf(enemy);
    return enemyWeapon({
        name: String(template?.name ?? enemy?.name ?? ''),
        description: String(template?.description ?? enemy?.description ?? ''),
        weapon: enemy?.weapon ?? template?.weapon,
        attackRangeFeet: Number(enemy?.attackRangeFeet ?? template?.attackRangeFeet) || 5,
    });
}

/**
 * «la maza», «el hacha», «el estoque»: el arma con su artículo, para el registro.
 *
 * @param {string} name
 * @returns {string}
 */
function weaponWords(name) {
    const first = String(name).split(' ')[0];
    const article = first === 'hacha' ? 'el' : /a$/.test(first) ? 'la' : 'el';
    return `${article} ${name}`;
}

/**
 * Quién de los enemigos le ha abierto la guardia a alguien del grupo (Ayudar), o vacío.
 *
 * @param {any} target
 * @returns {string}
 */
function enemyHelpAgainst(target) {
    const help = readManeuvers(combatEncounter.maneuvers).helped
        .find(h => h.targetId === String(target.id) && getEnemyByInstanceId(h.by));
    return help ? String(getEnemyByInstanceId(help.by)?.name ?? '') : '';
}

/**
 * Lo que hace de media el golpe de un enemigo.
 *
 * @param {any} enemy
 * @returns {number}
 */
function enemyAverage(enemy) {
    return averageOf(getEnemyDamageFormula(enemy.cr || 0)) + Math.max(0, getAbilityModifier(enemy.strength || 10))
        + (Number(/** @type {any} */ (enemy).levelDamage) || 0);
}

/**
 * Lo que hace de media el golpe de alguien del grupo.
 *
 * @param {any} member
 * @returns {number}
 */
function memberAverage(member) {
    const reach = getAttackRangeFeet(member);
    return averageOf(getPlayerDamageFormula(member, reach)) + Math.max(0, getPlayerAttackModifier(member, reach));
}

/**
 * El alcance de cuerpo a cuerpo de alguien del grupo, para los ataques de oportunidad: una daga
 * o una lanza se pueden arrojar, pero de cerca pegan a 5 pies; un arco no amenaza a quien pasa.
 *
 * @param {any} member
 * @returns {number}
 */
function meleeReachOf(member) {
    const reach = getAttackRangeFeet(member);
    return reach > 5 && reach <= 20 ? 5 : reach;
}

/**
 * Quién le haría pagar a un enemigo que se va de su alcance (5e): los vuestros de cuerpo a cuerpo
 * que aún tienen su reacción.
 *
 * @param {any} enemy
 * @param {{x: number, y: number}} from
 * @param {{x: number, y: number}} to
 * @returns {Array<{threat: any, name: string}>}
 */
function partyOpportunities(enemy, from, to) {
    return findOpportunityAttacks({
        mover: enemy,
        from,
        to,
        threats: getLivingPartyMembers().filter(m => !cannotAct(m.activeConditions)),
        reachOf: (/** @type {any} */ m) => meleeReachOf(m),
        canReact: (/** @type {any} */ m) => !usedReactions.has(`party:${m.id}`),
        isAlive: (/** @type {any} */ m) => (Number(m.hp) || 0) > 0,
    });
}

/**
 * Cuántas rondas dura lo que un enemigo le deja a alguien del grupo «hasta su próximo turno»:
 * los estados con fecha caducan al empezar la ronda, así que si ya le ha tocado en esta, tiene
 * que durar a la siguiente; si no, se le iría antes de notarlo.
 *
 * @param {any} member
 * @returns {number}
 */
function untilTheirTurn(member) {
    return laterThisRound().has(String(member?.id)) ? 1 : 2;
}

/**
 * Los que aún actúan en esta ronda, después de quien juega ahora.
 *
 * @returns {Set<string>}
 */
function laterThisRound() {
    const order = Array.isArray(combatEncounter.turnOrder) ? combatEncounter.turnOrder : [];
    const at = Number(combatEncounter.currentTurnIndex) || 0;
    return new Set(order.slice(at + 1).map(entry => String(entry.id)));
}

/**
 * El grupo (y sus invocaciones), como los mira la IA de 2024.
 *
 * @returns {import('../game-engine/combat/ai-2024.js').Body[]}
 */
function partyBodies() {
    const later = laterThisRound();
    const helped = readManeuvers(combatEncounter.maneuvers).helped;
    return [...getLivingPartyMembers(), ...livingSummons()].map(m => {
        const cell = partyCell(m);
        const reach = getAttackRangeFeet(m);
        return {
            id: String(m.id), x: cell.x, y: cell.y, hp: Number(m.hp) || 0, maxHp: Number(m.maxHp) || 1,
            reachFeet: reach, avgDamage: memberAverage(m),
            // Lo que un bruto quiere sujetar: quien lanza conjuros o dispara de lejos.
            caster: castsLikeFifth(m) || reach > 10,
            conditions: Array.isArray(m.activeConditions) ? m.activeConditions.map(String) : [],
            saveMod: escapeSave(m).modifier,
            helped: helped.some(h => h.targetId === String(m.id)),
            laterThisRound: later.has(String(m.id)),
        };
    });
}

/**
 * Los suyos en pie, menos él, como los mira la IA de 2024.
 *
 * @param {any} enemy
 * @returns {import('../game-engine/combat/ai-2024.js').Body[]}
 */
function enemyBodies(enemy) {
    const later = laterThisRound();
    return getAliveEnemies().filter(e => e !== enemy).map(e => ({
        id: String(e.instanceId), x: Number(e.gridX) || 0, y: Number(e.gridY) || 0,
        hp: Number(e.currentHp) || 0, maxHp: Number(e.maxHp) || 1,
        reachFeet: Number(e.attackRangeFeet ?? e.range) || 5, avgDamage: enemyAverage(e),
        boss: Boolean(/** @type {any} */ (e).boss), laterThisRound: later.has(String(e.instanceId)),
    }));
}

/**
 * Un enemigo, como se mira a sí mismo la IA de 2024.
 *
 * @param {any} enemy
 * @param {import('../game-engine/combat/ai-2024.js').EnemyWeapon|null} [weapon]
 */
function enemyBody(enemy, weapon = null) {
    const holding = partyMembers.find(m => String(/** @type {any} */ (m).grappledBy ?? '') === String(enemy.instanceId)
        && (m.activeConditions ?? []).includes('Grappled'));
    return {
        id: String(enemy.instanceId), x: Number(enemy.gridX) || 0, y: Number(enemy.gridY) || 0,
        hp: Number(enemy.currentHp) || 0, maxHp: Number(enemy.maxHp) || 1,
        reachFeet: Number(enemy.attackRangeFeet ?? enemy.range) || 5, avgDamage: enemyAverage(enemy),
        profile: String(enemy.profile ?? ''), role: String(/** @type {any} */ (enemy).role ?? ''), boss: Boolean(enemy.boss),
        str: Number(enemy.strength) || 10, dex: Number(enemy.dexterity) || 10, cr: Number(enemy.cr) || 0,
        freeHand: !(weapon && weapon.hands >= 2), grappling: holding ? String(holding.id) : '',
        grabbed: Array.isArray(/** @type {any} */ (enemy).grabbed) ? /** @type {any} */ (enemy).grabbed.map(String) : [],
        dodged: Boolean(/** @type {any} */ (enemy).dodged),
        hidden: readManeuvers(combatEncounter.maneuvers).hidden?.some(h => h.id === String(enemy.instanceId)) ?? false,
    };
}

/**
 * El tablero, para empujar a alguien del grupo: lo que se pisa, los desniveles, el agua honda y
 * lo que quema. El vacío no: tirar a uno de los vuestros a un precipicio lo decide Daniel.
 *
 * @returns {import('../game-engine/combat/ai-2024.js').Ground}
 */
function memberGround() {
    const { terrain, board } = getActiveBoardContext();
    const { isFree } = shoveGround();
    const elevation = board?.elevation;
    return {
        isFree,
        isDeepWater: (x, y) => getCell(terrain, x, y)?.type === 'deep_water',
        isHazard: (x, y) => Boolean(board) && hazardsAt(board, x, y).some((/** @type {any} */ h) => h.armed),
        drop: (a, b) => {
            if (elevation) {
                const feet = elevationAt(elevation, a.x, a.y) - elevationAt(elevation, b.x, b.y);
                if (Math.abs(feet) >= 10) return feet;
            }
            return isHigh(terrain, a.x, a.y) && !isHigh(terrain, b.x, b.y) ? 10 : 0;
        },
    };
}

/**
 * Lo que ve un enemigo para esconderse: si cada uno de los vuestros tiene algo delante, o si hay
 * poca luz.
 *
 * @param {any} enemy
 * @returns {{canHide: boolean, dim: boolean}}
 */
function enemySight(enemy) {
    const terrain = getActiveBoardContext().terrain;
    const at = { x: Number(enemy.gridX) || 0, y: Number(enemy.gridY) || 0 };
    const watchers = getLivingPartyMembers().map(m => {
        const from = partyCell(m);
        return {
            name: String(m.name),
            cover: Number(getCoverAlongLine(terrain, from.x, from.y, at.x, at.y, getCoverBonus)) || 0,
            // Tras un muro no le ve nadie: eso también vale para esconderse.
            sees: hasLineOfSight(terrain, from.x, from.y, at.x, at.y),
        };
    });
    return { canHide: canHide(watchers).ok, dim: boardVisibility().maxFeet !== null };
}

/**
 * Alguien del grupo va a parar a otra casilla (un empujón, Empujar): lo que se encuentra.
 *
 * @param {any} member
 * @param {{to: {x: number, y: number}, moved: number, why: string, dropFeet: number}} path `pushTrail`.
 * @returns {string[]}
 */
function landMember(member, path) {
    const id = String(member.id);
    /** @type {string[]} */
    const lines = [];
    if (path.moved > 0) {
        member.mapPosition = { ...(member.mapPosition ?? {}), gridX: path.to.x, gridY: path.to.y };
        if (currentLocationName) member.mapPosition.locationName = currentLocationName;
    }
    if (path.why === 'water') {
        // El agua honda no se anda: cae dentro y sale como puede por donde cayó.
        applyTimedCondition(member, id, 'Prone', untilTheirTurn(member));
        applyTimedCondition(member, id, 'Ralentizado', untilTheirTurn(member));
        lines.push(`💦 ${member.name} cae al agua honda y sale como puede por donde cayó: chorreando, en el suelo y andando 10 pies menos.`);
        return lines;
    }
    if (path.why === 'ledge') {
        const dice = `${Math.max(1, Math.min(20, Math.floor(path.dropFeet / 10)))}d6`;
        const fall = rollDiceDetailed(dice, 6).total;
        lines.push(`🪨 ${member.name} cae ${path.dropFeet} pies desnivel abajo: ${fall} de daño (${dice}), y queda en el suelo.`);
        lines.push(...damagePartyMember(member, fall));
        floatOnToken(member.id, `-${fall}`, 'damage');
        if ((Number(member.hp) || 0) > 0) applyTimedCondition(member, id, 'Prone', untilTheirTurn(member));
        return lines;
    }
    lines.push(path.moved > 0
        ? `💨 ${member.name} sale despedido ${path.moved * 5} pies, hasta (${path.to.x + 1}, ${path.to.y + 1}).`
        : `🧱 ${member.name} no tiene a dónde ir: se queda donde está.`);
    if (path.why === 'hazard') {
        lines.push(`🔥 ${member.name} va a parar encima de lo que hay en (${path.to.x + 1}, ${path.to.y + 1}).`);
        fireHazardsOnEnter(member, path.to.x, path.to.y);
    }
    return lines;
}

/**
 * Tanda 12: lo que hace la maestría del arma de un enemigo tras un golpe que entra.
 *
 * @param {any} enemy
 * @param {any} target
 * @param {import('../game-engine/combat/ai-2024.js').EnemyWeapon} weapon
 * @returns {string[]}
 */
function enemyMasteryOnHit(enemy, target, weapon) {
    const id = String(target.id);
    const round = Number(combatEncounter.round) || 1;
    const names = { who: String(enemy.name), at: String(target.name), weapon: weapon.name };
    switch (weapon.mastery) {
        case 'vex':
            combatEncounter.tactics = noteVex(combatEncounter.tactics, { by: String(enemy.instanceId), target: id, round });
            return [masteryLine('vex', names)];
        case 'sap':
            applyTimedCondition(target, id, 'Debilitado', untilTheirTurn(target));
            return [masteryLine('sap', names)];
        case 'slow':
            applyTimedCondition(target, id, 'Ralentizado', untilTheirTurn(target));
            return [masteryLine('slow', names)];
        case 'topple': {
            const dc = enemySaveDC(enemy, 'best');
            const natural = rollDiceDetailed('1d20', 20).total;
            const modifier = getAbilityModifier(Number(target.constitution) || 10);
            const lines = [masteryLine('topple', names), saveLine({ who: String(target.name), label: 'Constitución', natural, modifier, dc })];
            if (toppled({ dc, saveTotal: natural + modifier })) {
                applyTimedCondition(target, id, 'Prone', untilTheirTurn(target));
                lines.push(`💢 ${target.name} cae al suelo: de cerca le pegan con ventaja, y su golpe va con desventaja.`);
            } else {
                lines.push(`🧍 ${target.name} aguanta de pie.`);
            }
            return lines;
        }
        case 'push': {
            const path = pushTrail({ from: { x: Number(enemy.gridX) || 0, y: Number(enemy.gridY) || 0 }, target: partyCell(target), cells: 2, ground: memberGround() });
            return [masteryLine('push', names), ...landMember(target, path)];
        }
        default:
            return [];
    }
}

/**
 * Tanda 12: lo que hace un enemigo antes de moverse: la poción, cubrirse o destrabarse.
 *
 * @param {any} enemy
 * @param {import('../game-engine/combat/enemy-ai.js').TurnPlan} plan
 * @returns {{lines: string[], dodged: boolean, disengaged: boolean, drank: boolean}}
 */
function beforeMove2024(enemy, plan) {
    /** @type {{lines: string[], dodged: boolean, disengaged: boolean, drank: boolean}} */
    const out = { lines: [], dodged: false, disengaged: false, drank: false };
    const id = String(enemy.instanceId);
    const potions = enemyPotions(templateOf(enemy) ?? enemy, enemy);
    const from = { x: Number(enemy.gridX) || 0, y: Number(enemy.gridY) || 0 };
    const threats = Number(plan.movementCostFeet) > 0 ? partyOpportunities(enemy, from, plan.destination) : [];
    const { potion, before } = chooseEnemyBefore2024({
        actor: { ...enemyBody(enemy), potions: potions.count },
        plan,
        foes: partyBodies(),
        friends: enemyBodies(enemy),
        provokes: threats.map(t => ({ id: String(t.threat.id), x: 0, y: 0, hp: 1, maxHp: 1, avgDamage: memberAverage(t.threat) })),
    });
    if (potion) {
        const heal = rollDiceDetailed(potions.heal, 4).total;
        const before = Number(enemy.currentHp) || 0;
        enemy.currentHp = Math.min(Number(enemy.maxHp) || before + heal, before + heal);
        /** @type {any} */ (enemy).potionsUsed = (Number(/** @type {any} */ (enemy).potionsUsed) || 0) + 1;
        floatOnToken(enemyTokenId(enemy), `+${enemy.currentHp - before}`, 'heal');
        out.lines.push(`🧪 ${enemy.name} va malherido y se bebe una poción (acción adicional): recupera ${enemy.currentHp - before}. ${enemy.currentHp}/${enemy.maxHp}.`);
        out.drank = true;
    }
    if (before?.kind === 'dodge') {
        // Una vez por pelea (`chooseEnemyBefore2024`): se apunta aquí.
        /** @type {any} */ (enemy).dodged = true;
        combatEncounter.maneuvers = recordManeuver(combatEncounter.maneuvers, 'esquivar', id);
        out.lines.push(`🛡️ ${enemy.name}: ${before.reason} Pegarle va con desventaja hasta su próximo turno.`);
        out.dodged = true;
    } else if (before?.kind === 'disengage') {
        combatEncounter.maneuvers = recordManeuver(combatEncounter.maneuvers, 'destrabarse', id);
        out.lines.push(`🏃 ${enemy.name}: ${before.reason}`);
        out.disengaged = true;
    }
    return out;
}

/**
 * Tanda 12: lo que hace un enemigo en vez de su golpe (empujar, agarrar, ayudar, ocultarse), si
 * algo le sale mejor. Vacío si pega como siempre.
 *
 * @param {any} enemy
 * @param {boolean} canAttack Si su golpe llega a alguien.
 * @returns {string}
 */
function insteadOfStrike2024(enemy, canAttack) {
    const weapon = weaponOfEnemy(enemy);
    const choice = chooseEnemyAction2024({
        actor: enemyBody(enemy, weapon),
        canAttack,
        foes: partyBodies(),
        friends: enemyBodies(enemy),
        ground: memberGround(),
        sight: enemySight(enemy),
    });
    if (!choice) return '';
    const id = String(enemy.instanceId);
    if (choice.kind === 'hide') {
        const modifier = getAbilityModifier(Number(enemy.dexterity) || 10) + (String(enemy.profile) === 'skirmisher' ? 2 : 0);
        const natural = rollDiceDetailed('1d20', 20).total;
        const success = natural + modifier >= HIDE_DC;
        if (success) combatEncounter.maneuvers = recordManeuver(combatEncounter.maneuvers, 'esconderse', id);
        return [
            `🫥 ${enemy.name}: ${choice.reason}`,
            `🎲 Sigilo de ${enemy.name}: ${natural}${modifier >= 0 ? '+' : ''}${modifier} = ${natural + modifier} contra ${HIDE_DC} · ${success ? 'sale' : 'no sale'}`,
            success
                ? '🫥 No se le ve bien: pegarle va con desventaja, y su próximo golpe irá con ventaja.'
                : `👀 ${enemy.name} no consigue esconderse: se le ve.`,
        ].join('\n');
    }
    const target = [...getLivingPartyMembers(), ...livingSummons()].find(m => String(m.id) === String(choice.targetId));
    if (!target) return '';
    if (choice.kind === 'help') {
        combatEncounter.maneuvers = recordManeuver(combatEncounter.maneuvers, 'ayudar', id, String(target.id));
        const friend = getEnemyByInstanceId(String(choice.friendId ?? ''));
        return `🤝 ${enemy.name}: ${choice.reason} Distrae a ${target.name}: el próximo golpe de ${friend?.name ?? 'los suyos'} contra él irá con ventaja.`;
    }
    // Agarrar y empujar: salva quien lo recibe, con su Fuerza o su Destreza (2024). A cada uno lo
    // intenta agarrar una vez por pelea (`chooseEnemyAction2024`): se apunta aquí.
    if (choice.kind === 'grapple') {
        /** @type {any} */ (enemy).grabbed = [...(Array.isArray(/** @type {any} */ (enemy).grabbed) ? /** @type {any} */ (enemy).grabbed : []), String(target.id)];
    }
    const dc = enemySaveDC(enemy, 'strength');
    const save = escapeSave(target);
    const natural = rollDiceDetailed('1d20', 20).total;
    const fails = saveFails({ dc, saveTotal: natural + save.modifier });
    showCombatDiceRoll({
        title: `${target.name} se resiste`,
        subtitle: choice.kind === 'grapple' ? `${enemy.name} intenta agarrarle` : `${enemy.name} intenta empujarle`,
        formula: `1d20${save.modifier >= 0 ? '+' : ''}${save.modifier}`,
        detail: `d20(${natural}) ${save.modifier >= 0 ? '+' : ''}${save.modifier} = ${natural + save.modifier} contra CD ${dc}`,
        total: natural + save.modifier,
        dc,
        natural,
        glyph: 'd20',
        // Tanda 17: se lanza a por él y tira quien se resiste.
        stage: { by: enemy, at: target, hit: !fails, against: 'CD', style: 'melee', save: true, side: 'you' },
    });
    /** @type {string[]} */
    const lines = [
        `🤼 ${enemy.name}: ${choice.reason}`,
        saveLine({ who: String(target.name), label: save.label, natural, modifier: save.modifier, dc }),
    ];
    if (!fails) {
        lines.push(`❌ ${target.name} se zafa.`);
    } else if (choice.kind === 'grapple') {
        // Le dura hasta que le vuelva a tocar a quien agarra; si suelta o cae, antes.
        applyTimedCondition(target, String(target.id), 'Grappled', untilTheirTurn(target));
        /** @type {any} */ (target).grappledBy = id;
        lines.push(`✅ ${enemy.name} agarra a ${target.name}: no se puede mover mientras le sujete.`);
    } else if (choice.why === 'prone') {
        applyTimedCondition(target, String(target.id), 'Prone', untilTheirTurn(target));
        lines.push(`✅ ${target.name} cae al suelo: de cerca le pegan con ventaja.`);
    } else {
        const path = pushTrail({ from: { x: Number(enemy.gridX) || 0, y: Number(enemy.gridY) || 0 }, target: partyCell(target), cells: 1, ground: memberGround() });
        lines.push(...landMember(target, path));
    }
    savePartyState();
    saveCombatState();
    renderPartyMembers();
    return lines.join('\n');
}

/**
 * Tanda 12: los ataques de oportunidad del grupo contra un enemigo que se va de su alcance.
 * Antes, alejarse de vosotros les salía gratis; ahora pagan como pagáis vosotros (5e), salvo
 * que se destraben.
 *
 * @param {any} enemy
 * @param {{x: number, y: number}} from
 * @param {string[]} said Lo que ya se iba a contar de su turno: sale antes, para que se lea en orden.
 * @returns {boolean} Si ha habido alguno.
 */
function chargePartyOpportunities(enemy, from, said) {
    const attacks = partyOpportunities(enemy, from, { x: Number(enemy.gridX) || 0, y: Number(enemy.gridY) || 0 });
    if (attacks.length === 0) return false;
    if (said.length > 0) postCombatNarration(`[COMBAT] ${said.join('\n')}`);
    said.length = 0;
    postCombatNarration(describeOpportunity(attacks, enemy).replace(/^⚔️ /u, '⚔️ [COMBAT] '));
    for (const attack of attacks) {
        if ((Number(enemy.currentHp) || 0) <= 0 || !combatEncounter.active) break;
        usedReactions.add(`party:${attack.threat.id}`);
        resolveFollowUpAttack(String(attack.threat.id), enemy, 'aprovecha que se va y golpea a');
    }
    saveCombatState();
    return true;
}

/**
 * Tanda 12: a quien sujetaba un enemigo que ha caído, o que ya no está a su lado, se le suelta.
 */
function releaseGrapples() {
    for (const member of partyMembers) {
        const by = String(/** @type {any} */ (member).grappledBy ?? '');
        if (!by) continue;
        const holder = getEnemyByInstanceId(by);
        const cell = partyCell(member);
        const near = holder && (Number(holder.currentHp) || 0) > 0
            && getDistanceInFeet(Number(holder.gridX) || 0, Number(holder.gridY) || 0, cell.x, cell.y) <= 5;
        const held = (member.activeConditions ?? []).includes('Grappled');
        if (near && held) continue;
        delete /** @type {any} */ (member).grappledBy;
        if (!held) continue;
        member.activeConditions = (member.activeConditions ?? []).filter(c => c !== 'Grappled');
        combatEncounter.conditionTimers = (Array.isArray(combatEncounter.conditionTimers) ? combatEncounter.conditionTimers : [])
            .filter((/** @type {any} */ t) => !(String(t.who) === String(member.id) && t.condition === 'Grappled'));
        postCombatNarration(`🙌 [COMBAT] ${member.name} se suelta: ya no le sujeta nadie.`);
    }
}

/**
 * Tanda 12 (J19.3): el conjuro de nivel de un enemigo, con un espacio mayor si le compensa.
 *
 * @param {any} enemy
 * @param {import('../game-engine/combat/enemy-spells.js').CasterBlock} block
 * @param {any} ability
 * @param {number} targetHp
 * @returns {{ability: any, level: number, detail: string}|null}
 */
function upcastFor(enemy, block, ability, targetHp) {
    const catalogue = spellRows();
    const spells = catalogue.map(normalizeSpell);
    const spell = findSpell(spells, String(ability.id));
    if (!spell) return null;
    const reservedLevels = block.spells.filter(id => id !== ability.id)
        .map(id => Number(findSpell(spells, id)?.level) || 0).filter(level => level > 0);
    const pick = chooseEnemySlot({ spell, left: enemySlotsLeft(enemy, block), reservedLevels, targetHp, average: averageOf });
    if (!pick.upcast) return null;
    const up = enemySpellAt({ enemy, block, catalogue, spellId: String(ability.id), slotLevel: pick.slotLevel });
    return up ? { ability: { ...ability, ...up }, level: pick.slotLevel, detail: pick.detail } : null;
}

/**
 * Resuelve el turno entero de un enemigo: moverse, lo que hace con lo que tiene y su golpe.
 *
 * @param {import('../dnd-system.js').TurnEntry} turnEntry
 * @returns {string} Lo ocurrido, ya escrito (vacío si ya se ha contado).
 */
export function resolveEnemyTurnAction(turnEntry) {
    const enemy = combatEncounter.enemies.find(e => e.instanceId === turnEntry.id && e.currentHp > 0);
    if (!enemy) {
        return '[COMBAT] El enemigo no puede actuar (derrotado o no encontrado).';
    }
    // R3: dormido, aturdido o paralizado, pierde el turno. Antes era una etiqueta.
    const out = cannotAct(enemy.activeConditions);
    if (out) return `💤 [COMBAT] ${enemy.name} no puede actuar (${CONDITION_WORDS[out] ?? out}): pierde el turno.`;
    // J8.5: dudan por lo que se les ha dicho (`party/avoid.js`): este turno no atacan.
    if (Number(/** @type {any} */ (enemy).parleyLull) > 0) {
        /** @type {any} */ (enemy).parleyLull -= 1;
        return `🤔 [COMBAT] ${enemy.name} duda y baja el arma: este turno no ataca.`;
    }
    // J12.7: en un duelo sin muertes, quien no puede más se rinde.
    const yielded = brawlEnemyTurn(enemy);
    if (yielded !== null) return yielded;

    const livingParty = getLivingPartyMembers();
    if (!livingParty.length) {
        return `[COMBAT] ${enemy.name} ruge sobre un campo sin oponentes conscientes.`;
    }

    // T2: una tregua pedida espera respuesta hasta que a uno de los vuestros le haya tocado y
    // la haya dejado pasar; sin respuesta, se sigue. Antes caducaba al cambiar de ronda, y si
    // en la iniciativa los enemigos iban antes que el grupo, caducaba sin que os tocara.
    if (/** @type {any} */ (combatEncounter).truce === 'pending') {
        if (/** @type {any} */ (combatEncounter).truceSeen) {
            /** @type {any} */ (combatEncounter).truce = 'refused';
            saveCombatState();
            postCombatNarration('⚔️ [COMBAT] No contestáis: vuelven a por vosotros.');
        } else {
            return `🏳️ [COMBAT] ${enemy.name} espera vuestra respuesta, con el arma baja.`;
        }
    }
    // T2: con su líder caído y la mitad fuera, los que quedan piden tregua (una vez).
    if (truceOffered({
        enemies: combatEncounter.enemies.map(e => ({ name: String(e.name), hp: Number(e.currentHp) || 0, maxHp: Number(e.maxHp) || 0, boss: Boolean(/** @type {any} */ (e).boss), role: String(/** @type {any} */ (e).role ?? '') })),
        offered: Boolean(/** @type {any} */ (combatEncounter).truce),
    })) {
        offerTruce();
        return `🏳️ [COMBAT] ${enemy.name} espera vuestra respuesta, con el arma baja.`;
    }

    // Idea 6: con su bando cayendo y malherido, quien no es jefe puede rendirse.
    if (breaksMorale({
        enemy, started: combatEncounter.enemies.length, standing: getAliveEnemies().length, random: Math.random,
    })) {
        enemyBark(enemy, 'surrender');
        enemy.currentHp = 0;
        enemy.surrendered = true;
        saveCombatState();
        const said = `🏳️ [COMBAT] ${enemy.name} tira el arma y se rinde.`;
        if (getAliveEnemies().length === 0) {
            postCombatNarration(said);
            postCombatNarration('🏆 [COMBAT] No queda nadie dispuesto a pelear.');
            endCombat('victory');
            return '';
        }
        return said;
    }

    // R7: con su líder caído y malherido, huye. Sale de esta pelea… y puede volver en otra.
    const leaderDown = combatEncounter.enemies.some(e => e !== enemy && /** @type {any} */ (e).role === 'lider' && (Number(e.currentHp) || 0) <= 0);
    if (breaksAndRuns({ hp: Number(enemy.currentHp) || 0, maxHp: Number(enemy.maxHp) || 0, boss: Boolean(/** @type {any} */ (enemy).boss), role: String(/** @type {any} */ (enemy).role ?? '') }, leaderDown)) {
        enemy.currentHp = 0;
        /** @type {any} */ (enemy).fled = true;
        const escape = noteEscape({ raw: chat_metadata?.[NEMESES_KEY], name: String(enemy.name), grudge: String(partyMembers[0]?.name ?? ''), day: campaignDay() });
        if (chat_metadata) {
            chat_metadata[NEMESES_KEY] = escape.list;
            saveMetadata();
        }
        saveCombatState();
        // B2: si el tablero tiene salida, se va por ella.
        const exits = exitCells(getActiveBoardContext().terrain);
        const way = exits.length > 0 ? ' por la salida' : '';
        // T2: y puede volver con ayuda, dos rondas después, por donde se fue (una vez por pelea).
        let help = '';
        const board = getActiveBoardContext().board;
        if (board && getAliveEnemies().length > 0 && callsForHelp({ random: Math.random, hasExit: exits.length > 0, called: Boolean(/** @type {any} */ (combatEncounter).helpCalled) })) {
            const template = getCurrentWorldEnemies().find((/** @type {any} */ t) => String(t.id) === String(enemy.templateId));
            board.waves = [...(Array.isArray(board.waves) ? board.waves : []), helpWave({
                name: String(template?.name ?? enemy.name), round: Number(combatEncounter.round) || 1,
                at: exits[0] ?? { x: Number(enemy.gridX) || 0, y: Number(enemy.gridY) || 0 },
            })];
            /** @type {any} */ (combatEncounter).helpCalled = true;
            persistBoardTerrain(board);
            help = ' Grita que vuelve con ayuda.';
        }
        const fled = `🏃 [COMBAT] ${enemy.name} ve caer a quien mandaba y sale corriendo${way}.${help}${escape.line ? ` ${escape.line}` : ''}`;
        if (getAliveEnemies().length === 0) {
            postCombatNarration(fled);
            postCombatNarration('🏆 [COMBAT] No queda nadie dispuesto a pelear.');
            endCombat('victory');
            return '';
        }
        return fled;
    }

    // J19.12: con sus conjuros, si los tiene (`spellcasting`).
    const known = enemyAbilities(enemy);
    // J19.5: a quien puede pegar: el grupo y sus invocaciones.
    const targetsNow = [...livingParty, ...livingSummons()];

    /** @param {any} member */
    const memberCell = (member) => ({
        x: Number.isFinite(Number(member.mapPosition?.gridX)) ? Number(member.mapPosition.gridX) : 0,
        y: Number.isFinite(Number(member.mapPosition?.gridY)) ? Number(member.mapPosition.gridY) : 0,
    });

    // Tanda 12: a quien sujetaba alguien que ya ha caído o se ha ido, se le suelta.
    const on = ai2024();
    if (on) releaseGrapples();
    const plan = planFor(enemy);

    const lines = [];
    // Tanda 12: antes de moverse, la poción (acción adicional), cubrirse o destrabarse.
    const early = on ? beforeMove2024(enemy, plan) : { lines: [], dodged: false, disengaged: false, drank: false };
    lines.push(...early.lines);
    if (early.dodged) {
        saveCombatState();
        return lines.join('\n');
    }
    const movedThisTurn = plan.movementCostFeet > 0;

    if (movedThisTurn) {
        const leftFrom = { x: Number(enemy.gridX) || 0, y: Number(enemy.gridY) || 0 };
        // J19.6: las zonas que cruza le hacen lo suyo, y donde queda atrapado, se queda.
        const steps = (Array.isArray(plan.path) ? plan.path : []).slice(1);
        // Tanda 17: lo que le pase por el camino (una zona que quema) se ve después de andar.
        const beforeWalk = fxMark();
        const walk = enemyWalksZones(enemy, steps.length > 0 ? steps : [plan.destination]);
        const stop = (steps.length > 0 ? steps[walk.stopAt] : null) ?? plan.destination;
        stageMove(enemy, steps.length > 0 ? [leftFrom, ...steps.slice(0, walk.stopAt + 1)] : [leftFrom, stop], beforeWalk);
        enemy.gridX = stop.x;
        enemy.gridY = stop.y;
        const cut = stop.x !== plan.destination.x || stop.y !== plan.destination.y;
        lines.push(cut
            ? `🚶 ${enemy.name} avanza hasta (${stop.x + 1}, ${stop.y + 1}) y se queda a medio camino.`
            : `🚶 ${enemy.name} avanza a (${plan.destination.x + 1}, ${plan.destination.y + 1}). ${plan.rationale} (${plan.movementCostFeet} ft)`);
        lines.push(...walk.lines);
        if ((Number(enemy.currentHp) || 0) <= 0) {
            saveCombatState();
            if (!checkScenarioOutcome() && getAliveEnemies().length === 0 && !judgeCurrentScenario()) {
                postCombatNarration(`[COMBAT] ${lines.join('\n')}`);
                postCombatNarration('🏆 [COMBAT] Todos los enemigos han sido derrotados.');
                endCombat('victory');
                return '';
            }
            return lines.join('\n');
        }
        // Tanda 12: irse del alcance de uno de los vuestros le cuesta un golpe (5e), salvo que
        // se haya destrabado.
        if (on && !early.disengaged && chargePartyOpportunities(enemy, leftFrom, lines)) {
            if (!combatEncounter.active) return '';
            if ((Number(enemy.currentHp) || 0) <= 0) {
                if (!checkScenarioOutcome() && getAliveEnemies().length === 0 && !judgeCurrentScenario()) {
                    postCombatNarration('🏆 [COMBAT] Todos los enemigos han sido derrotados.');
                    endCombat('victory');
                }
                return '';
            }
        }
        // Idea 4: quien le esperaba con el golpe preparado, se lo da antes de que haga nada.
        const ambusher = readiedAgainst({
            readied: combatEncounter.readied,
            members: livingParty.map(member => ({
                id: String(member.id), x: memberCell(member).x, y: memberCell(member).y, reachFeet: getAttackRangeFeet(member),
            })),
            from: leftFrom,
            to: { x: Number(enemy.gridX) || 0, y: Number(enemy.gridY) || 0 },
            distanceFeet: (a, b) => getDistanceInFeet(a.x, a.y, b.x, b.y),
        });
        if (ambusher) {
            combatEncounter.readied = dropReadied(combatEncounter.readied, ambusher);
            const waiting = partyMembers.find(member => String(member.id) === ambusher);
            lines.push(`⚡ ${waiting?.name ?? 'Alguien'} estaba esperando a ${enemy.name}: golpe preparado.`);
            postCombatNarration(`[COMBAT] ${lines.join('\n')}`);
            lines.length = 0;
            resolveFollowUpAttack(ambusher, enemy, 'descarga el golpe preparado sobre');
            saveCombatState();
            if ((Number(enemy.currentHp) || 0) <= 0) {
                if (!checkScenarioOutcome() && getAliveEnemies().length === 0 && !judgeCurrentScenario()) {
                    postCombatNarration('🏆 [COMBAT] Todos los enemigos han sido derrotados.');
                    endCombat('victory');
                }
                return '';
            }
        }
    }

    // Tanda 12: destrabarse gasta la acción: después de moverse, ya no pega ni lanza.
    if (early.disengaged) {
        saveCombatState();
        return lines.join('\n');
    }

    // Antes que el golpe: si trae algo mejor que pegar y le llega, lo usa.
    const choice = chooseEnemyAbility({
        actor: { id: String(enemy.instanceId), abilityUses: enemy.abilityUses, currentHp: enemy.currentHp, maxHp: enemy.maxHp },
        from: { x: Number(enemy.gridX) || 0, y: Number(enemy.gridY) || 0 },
        abilities: known,
        targets: livingParty.map(member => ({
            id: String(member.id), gridX: memberCell(member).x, gridY: memberCell(member).y,
            currentHp: Number(member.hp) || 0, maxHp: Number(member.maxHp) || 0,
        })),
        allies: getAliveEnemies()
            .filter(other => other.instanceId !== enemy.instanceId)
            .map(other => ({
                id: String(other.instanceId), gridX: Number(other.gridX) || 0, gridY: Number(other.gridY) || 0,
                currentHp: Number(other.currentHp) || 0, maxHp: Number(other.maxHp) || 0,
            })),
        focusId: plan.focusId,
        basicAverage: averageOf(getEnemyDamageFormula(enemy.cr || 0)) + Math.max(0, getAbilityModifier(enemy.strength || 10)) + (Number(/** @type {any} */ (enemy).levelDamage) || 0),
        basicRangeFeet: Number(enemy.attackRangeFeet ?? enemy.range) || 5,
    });
    if (choice) {
        lines.push(`✨ ${enemy.name}: ${choice.reason}`);
        lines.push(resolveEnemyAbility(enemy, choice));
        saveCombatState();
        return lines.join('\n');
    }

    // El plan se hizo con el alcance de sus habilidades; si no ha usado ninguna, su golpe
    // tiene que llegar de verdad.
    const basicReach = Number(enemy.attackRangeFeet ?? enemy.range) || 5;
    const struck = plan.targetId ? targetsNow.find(member => String(member.id) === plan.targetId) : null;
    const struckCell = struck ? memberCell(struck) : null;
    const outOfReach = struckCell
        && getDistanceInFeet(Number(enemy.gridX) || 0, Number(enemy.gridY) || 0, struckCell.x, struckCell.y) > basicReach;

    // Tanda 12: en vez del golpe, lo que le salga mejor: empujar al que está al borde, agarrar al
    // que lanza, abrirle la guardia a quien pega más, tirar al suelo al rodeado u ocultarse.
    if (on) {
        const instead = insteadOfStrike2024(enemy, plan.action === 'attack' && Boolean(plan.targetId) && !outOfReach);
        if (instead) {
            lines.push(instead);
            saveCombatState();
            return lines.join('\n');
        }
    }

    if (plan.action !== 'attack' || !plan.targetId || outOfReach) {
        lines.push(`⛔ ${enemy.name}: ${outOfReach ? 'No le llega el golpe.' : plan.rationale}`);
        if (movedThisTurn) saveCombatState();
        return lines.join('\n');
    }

    const target = targetsNow.find(member => String(member.id) === plan.targetId);
    if (!target) {
        return `[COMBAT] ${enemy.name} no encuentra un objetivo valido.`;
    }

    lines.push(resolveEnemyAttackOn(enemy, target, { ownTurn: true, bonusFree: !early.drank }));
    if (movedThisTurn) saveCombatState();
    return lines.join('\n');
}

/**
 * Cobra los ataques de oportunidad que provoque un movimiento.
 *
 * Sin esto, alejarse de un enemigo es gratis — y si alejarse es gratis, la posicion no
 * significa nada y media mecanica del tablero sobra. El golpe lo resuelve el mismo codigo
 * que cualquier otro ataque enemigo: un ataque de oportunidad no es un ataque distinto.
 *
 * @param {any} member Quien se mueve.
 * @param {{x: number, y: number}} from
 * @param {{x: number, y: number}} to
 */
export function chargeOpportunityAttacks(member, from, to) {
    if (!combatEncounter.active) return;
    // Quien se ha destrabado se va sin pagar: para eso gasto la accion.
    if (readManeuvers(combatEncounter.maneuvers).disengaged.includes(String(member.id))) return;

    const attacks = findOpportunityAttacks({
        mover: member,
        from,
        to,
        threats: getAliveEnemies(),
        reachOf: (/** @type {any} */ enemy) => Number(enemy?.attackRangeFeet) || 5,
        isAlive: (/** @type {any} */ enemy) => (Number(enemy?.currentHp) || 0) > 0,
        // Cada enemigo tiene una reaccion por ronda, y aqui se apunta cual la ha gastado.
        canReact: (/** @type {any} */ enemy) => !usedReactions.has(String(enemy.instanceId)),
    });

    if (attacks.length === 0) return;

    postCombatNarration(`⚠️ [COMBAT] ${describeOpportunity(attacks, member)}`);
    for (const attack of attacks) {
        usedReactions.add(String(attack.threat.instanceId));
        const line = resolveEnemyAttackOn(attack.threat, member);
        if (line) postCombatNarration(line);
        // Si el golpe lo tira, el resto de oportunidades siguen: en 5e tambien.
    }
    savePartyState();
    saveCombatState();
}

/** Lo ultimo que grito cada enemigo, para no repetirlo. */
let lastEnemyBark = '';

/**
 * Idea 190: un enemigo grita algo, a veces. Sin llamar al modelo.
 *
 * @param {any} enemy
 * @param {'hit'|'hurt'|'ally_down'|'surrender'} event
 */
export function enemyBark(enemy, event) {
    if (!enemy) return;
    const line = chooseEnemyBark({ event, profile: enemy.profile, boss: Boolean(enemy.boss), last: lastEnemyBark, random: Math.random });
    if (!line) return;
    lastEnemyBark = line;
    postCombatNarration(`🗯️ ${enemy.name}: «${line}»`);
    floatOnToken(enemyTokenId(enemy), line, 'bark');
}
