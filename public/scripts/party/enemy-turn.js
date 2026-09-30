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
import { rollDiceDetailed, getDistanceInFeet, getAttackRangeFeet, getEnemyDamageFormula } from './combat-rules.js';
import { tacticOf, leaderBonus, breaksAndRuns } from '../game-engine/combat/enemy-roles.js';
import { noteEscape } from '../game-engine/campaign/nemesis.js';
import { exitCells } from '../game-engine/board/exits.js';
import { truceOffered, callsForHelp, helpWave } from '../game-engine/combat/morale-options.js';
import { spendCharge } from '../game-engine/rules/grimoire.js';
import { planEnemyTurn } from '../game-engine/combat/enemy-ai.js';
import { chooseEnemyAbility, longestReach, averageOf } from '../game-engine/combat/enemy-abilities.js';
import { attackEdge, rollWithEdge, describeEdge, readManeuvers, cannotAct } from '../game-engine/combat/maneuvers.js';
import { dropReadied, readiedAgainst } from '../game-engine/combat/readied.js';
import { describeIntents } from '../game-engine/combat/forecast.js';
import { noteTaken } from '../game-engine/combat/tally.js';
import { damageLine } from '../game-engine/rules/roll-line.js';
import { chooseEnemyBark } from '../game-engine/combat/barks.js';
import { breaksMorale } from '../game-engine/combat/crits.js';
import { planEndure } from '../game-engine/combat/bond-perks.js';
import { spendPerk } from '../game-engine/campaign/bonds.js';
import { knownAbilities, spendAbilityUse } from '../game-engine/rules/abilities.js';
import { readCasterBlock, spendEnemySlot, enemySpellAbilities } from '../game-engine/combat/enemy-spells.js';
import { readConcentration } from '../game-engine/rules/concentration.js';
import { zoneFlagsAt } from '../game-engine/board/spell-zones.js';
import { takeHitWhileDown, clearDeathSaves } from '../game-engine/rules/death-saves.js';
import { findOpportunityAttacks, describeOpportunity } from '../game-engine/combat/opportunity.js';
import { NEMESES_KEY } from './keys.js';
import { combatEncounter, currentBoardName, currentLocationName, partyMembers, usedReactions } from './state.js';
import { getAbilityCatalogue, resolveAbilityOnBoard, spellRows } from './magic.js';
import {
    enemyTokenId, flankedFrom, getAliveEnemies, getEnemyByInstanceId, getLivingPartyMembers, getTargetArmorClass,
    heightFor, heldInPlace, partyCell, saveCombatState, speedOf,
} from './combat-state.js';
import { floatOnToken, showCombatDiceRoll } from './combat-log.js';
import { CONDITION_WORDS, judgeCurrentScenario, checkScenarioOutcome, endCombat, offerTruce } from './combat-flow.js';
import { resolveFollowUpAttack, attackLine } from './player-actions.js';
import { persistBoardTerrain, getActiveBoardContext, attackHindrance } from './board.js';
import { getCampaignBonds, saveCampaignState, campaignDay } from './time.js';
import { postCombatNarration } from './narration.js';
import { savePartyState, renderPartyMembers } from './roster.js';
import { rememberTogether, bark, recordFeat } from './companions.js';
import {
    concentrationAfterHurt, counterAgainst, enemyWalksZones, hurtSummon, livingSummons, shieldAgainst,
} from './spell-turn.js';

/**
 * Resolve enemy action: attack roll, damage and possible status effects.
 * @param {import('../dnd-system.js').TurnEntry} turnEntry
 * @returns {string}
 */
/**
 * Resuelve un golpe de un enemigo contra alguien del grupo.
 *
 * Extraido del turno enemigo porque un **ataque de oportunidad** es exactamente esto y no
 * otra cosa: el mismo d20, la misma cobertura, el mismo critico y las mismas salvaciones
 * de muerte. Dos copias de esta aritmetica serian dos sitios donde discrepar.
 *
 * @param {any} enemy
 * @param {any} target
 * @returns {string} Lo ocurrido, ya escrito.
 */
export function resolveEnemyAttackOn(enemy, target) {
    /** @type {string[]} */
    const lines = [];

    // Esquivar, estar en el suelo: lo que cambia el dado antes de tirarlo.
    const enemyFeet = getDistanceInFeet(
        Number(enemy.gridX) || 0, Number(enemy.gridY) || 0,
        Number(target.mapPosition?.gridX) || 0, Number(target.mapPosition?.gridY) || 0);
    const edge = attackEdge({
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
    });
    const edged = rollWithEdge(() => rollDiceDetailed('1d20', 20).total, edge.mode);
    const attackRoll = { total: edged.natural, natural: edged.natural };
    const d20 = attackRoll.total;
    const attackMod = Math.max(
        getAbilityModifier(enemy.strength || 10),
        getAbilityModifier(enemy.dexterity || 10),
    // R7: con su líder cerca, pega mejor. R6: y un jefe enfurecido, más. J4.6: y el ajuste
    // al nivel del grupo, si el tablero es de otro nivel.
    ) + (Number(/** @type {any} */ (enemy).rage) || 0) + (Number(/** @type {any} */ (enemy).levelHit) || 0) + leaderBonus(
        { id: String(enemy.instanceId), x: Number(enemy.gridX) || 0, y: Number(enemy.gridY) || 0 },
        getAliveEnemies().map(e => ({ id: String(e.instanceId), x: Number(e.gridX) || 0, y: Number(e.gridY) || 0, hp: Number(e.currentHp) || 0, role: String(/** @type {any} */ (e).role ?? '') })),
    );
    const attackTotal = d20 + attackMod;
    const { ac: targetAc, cover: targetCover } = getTargetArmorClass(target, enemy);
    const isCrit = d20 === 20;
    const wouldHit = isCrit || attackTotal >= targetAc;
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
    });

    lines.push(`👹 ${enemy.name} ataca a ${target.name}.`);
    lines.push(attackLine({ who: enemy.name, at: target.name, total: attackTotal, ac: targetAc, hit: wouldHit, natural: d20, modifier: attackMod, cover: targetCover, edge: describeEdge(edged, edge.mode, edge.reasons) }));
    lines.push(...shield.lines);

    if (!isHit) {
        lines.push('❌ Resultado: fallo.');
        if (shield.blocked) {
            savePartyState();
            saveCombatState();
        }
        return lines.join('\n');
    }

    const dmgFormula = getEnemyDamageFormula(enemy.cr || 0);
    const baseDamageRoll = rollDiceDetailed(dmgFormula, 8);
    const baseDamage = baseDamageRoll.total;
    // J4.6: el ajuste al nivel del grupo va con el modificador. Puede restar: el golpe que
    // acierta hace 1 como poco.
    const strMod = Math.max(0, getAbilityModifier(enemy.strength || 10)) + (Number(/** @type {any} */ (enemy).levelDamage) || 0);
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
    });

    lines.push(`✅ Resultado: impacto${isCrit ? ' critico' : ''}.`);
    lines.push(damageLine({ total: totalDamage, formula: dmgFormula, rolled: baseDamage, modifier: strMod, crit: isCrit ? critBonus : 0 }));
    lines.push(...damagePartyMember(target, totalDamage, isCrit));
    floatOnToken(target.id, `-${totalDamage}`, isCrit ? 'crit' : 'damage');
    enemyBark(enemy, 'hit');

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
    return lines.join('\n');
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

    if (target.hp === 0) {
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
            lines.push(`🩸 ${target.name} cae a 0 PG y empieza a jugarsela: `
                + 'tres exitos para estabilizarse, tres fallos y se acabo.');
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
    const { ability } = choice;
    const target = choice.side === 'enemy'
        ? partyMembers.find(m => String(m.id) === choice.targetId)
        : (choice.side === 'self' ? enemy : getEnemyByInstanceId(choice.targetId));
    if (!target) return '';

    // J19.12: un conjuro de su bloque `spellcasting` gasta su espacio; lo innato y lo demás,
    // su uso. Contarlo en los dos sitios lo gastaría dos veces.
    const block = readCasterBlock(enemy.spellcasting);
    const fromSlot = Boolean(block) && Number(ability.spellLevel) > 0 && !(/** @type {any} */ (ability).innate);
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
    // R3: el mismo camino que el grupo: con área, alcanza también a los suyos si están ahí.
    const lines = [...counter.lines, ...resolveAbilityOnBoard({ actor: enemy, side: 'enemy', ability, subject: target })];

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

    const plan = planFor(enemy);

    const lines = [];
    const movedThisTurn = plan.movementCostFeet > 0;

    if (movedThisTurn) {
        const leftFrom = { x: Number(enemy.gridX) || 0, y: Number(enemy.gridY) || 0 };
        // J19.6: las zonas que cruza le hacen lo suyo, y donde queda atrapado, se queda.
        const steps = (Array.isArray(plan.path) ? plan.path : []).slice(1);
        const walk = enemyWalksZones(enemy, steps.length > 0 ? steps : [plan.destination]);
        const stop = (steps.length > 0 ? steps[walk.stopAt] : null) ?? plan.destination;
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

    if (plan.action !== 'attack' || !plan.targetId || outOfReach) {
        lines.push(`⛔ ${enemy.name}: ${outOfReach ? 'No le llega el golpe.' : plan.rationale}`);
        if (movedThisTurn) saveCombatState();
        return lines.join('\n');
    }

    const target = targetsNow.find(member => String(member.id) === plan.targetId);
    if (!target) {
        return `[COMBAT] ${enemy.name} no encuentra un objetivo valido.`;
    }

    lines.push(resolveEnemyAttackOn(enemy, target));
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
