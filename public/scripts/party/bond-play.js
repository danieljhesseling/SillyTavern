/**
 * E3.4 de wiki/ROADMAP_ENTRETENIDO.md: que el vínculo se note en la pelea.
 *
 * Las ventajas del vínculo ya daban cosas (el ataque de seguimiento, a una, el Relevo, Aguantar,
 * el golpe definitivo), pero pasaban casi sin verse. Aquí:
 *
 * - **se anuncian al saltar** (`announceBond`): el compañero dice su frase (D-J60: la dice él), su
 *   ficha brilla y sale el rótulo («Vínculo 7 · Yunque y martillo») en la secuencia del combate;
 * - **la jugada del rango 7** de cada compañero (`resolveBondMove`), con su nombre, desde la barra
 *   de acciones o la tarjeta del enemigo, y también cuando el juego lleva al compañero;
 * - lo que la barra y la tarjeta necesitan saber para ofrecerlas (`bondChoices`).
 *
 * Lo puro (quién puede, cómo se llama, qué dice) está en `game-engine/combat/bond-moves.js`.
 */

import { rollDiceDetailed, getAttackRangeFeet } from './combat-rules.js';
import {
    PAIR_MOVE_RANK, pairMoveOf, pairMoveOptions, perkBanner, perkLine, ultimateOf,
} from '../game-engine/combat/bond-moves.js';
import { pairOptions } from '../game-engine/rules/pair-moves.js';
import { planUltimate } from '../game-engine/combat/bond-perks.js';
import { getBondProgress } from '../game-engine/campaign/bonds.js';
import { noteKnockdown, recordManeuver } from '../game-engine/combat/maneuvers.js';
import { bondMoveUsed, noteBondMove } from '../game-engine/rules/weapon-mastery.js';
import { escapeSave, saveFails, saveLine, unarmedDC } from '../game-engine/rules/unarmed.js';
import { hasAction, useAction } from '../game-engine/combat/turn-machine.js';
import { pushFx, showBond } from '../game-engine/ui/combat-vtt/fx.js';
import { combatEncounter, partyMembers, usedReactions } from './state.js';
import { getAliveEnemies, partyCell, saveCombatState } from './combat-state.js';
import { showCombatDiceRoll } from './combat-log.js';
import { fxOn, tokenIdOf } from './combat-fx.js';
import { applyTimedCondition } from './magic.js';
import { postCombatNarration } from './narration.js';
import { getCampaignBonds } from './time.js';
import { attackEnemyById, resolveFollowUpAttack, resolveUltimateById } from './player-actions.js';
import { checkScenarioOutcome } from './combat-flow.js';

/** @typedef {'follow_up'|'pair'|'baton_pass'|'endure'|'pair_move'|'ultimate'} BondPerk */

/**
 * Salta una ventaja del vínculo: lo apunta el registro («💞 Vínculo 7 · Yunque y martillo»), el
 * compañero dice su frase y su ficha (y la de su pareja) brilla en el tablero.
 *
 * @param {any} member El compañero cuya ventaja salta (el que habla).
 * @param {BondPerk} perkId
 * @param {{partner?: any}} [options] Con quién (también brilla).
 */
export function announceBond(member, perkId, { partner = null } = {}) {
    if (!member) return;
    const line = perkLine(member, perkId);
    const title = perkBanner(member, perkId);
    if (title) postCombatNarration(`💞 [COMBAT] ${title}`);
    if (line) postCombatNarration(`💬 ${member.name}: «${line}»`);
    const step = {
        kind: /** @type {const} */ ('bond'),
        tokenId: tokenIdOf(member),
        to: partner ? tokenIdOf(partner) : null,
        text: line,
        title,
    };
    if (fxOn()) pushFx(step);
    else if (typeof document !== 'undefined') setTimeout(() => showBond(step), 250);
}

/**
 * Los del grupo como los quieren `pairOptions` y `pairMoveOptions`: dónde están, su vínculo contigo,
 * si les queda la reacción y si ya hicieron su jugada en esta pelea.
 *
 * @returns {Array<{id: string, name: string, x: number, y: number, hp: number, rank: number, reachFeet: number, reactionUsed: boolean, moveUsed: boolean, style: any}>}
 */
export function bondFighters() {
    const bonds = getCampaignBonds();
    return partyMembers.filter(m => !m.dead).map(m => ({
        id: String(m.id),
        name: String(m.name),
        ...partyCell(m),
        hp: Number(m.hp) || 0,
        rank: getBondProgress(bonds, String(m.id)).rank,
        reachFeet: getAttackRangeFeet(m),
        reactionUsed: usedReactions.has(`party:${m.id}`),
        moveUsed: bondMoveUsed(combatEncounter.tactics, String(m.id)),
        style: pairMoveOf(m).style,
    }));
}

/** @param {any} enemy */
const enemyCell = (enemy) => ({
    id: String(enemy.instanceId), name: String(enemy.name), x: Number(enemy.gridX) || 0, y: Number(enemy.gridY) || 0, hp: Number(enemy.currentHp) || 0,
});

/**
 * @typedef {Object} BondChoice Lo que da el vínculo a quien juega, contra un enemigo.
 * @property {'pair'|'pair_move'|'ultimate'} kind
 * @property {string} name «A una con Gerd», «Yunque y martillo», «La carga del Mellado».
 * @property {string} desc Lo que hace, en una frase.
 * @property {string} companionId El compañero de la jugada (el que tiene el vínculo).
 * @property {string} partnerId Con quién la hace quien juega (vacío en el golpe definitivo).
 * @property {string} enemyId
 * @property {string} badge «Vínculo 7».
 */

/**
 * Lo que puede hacer ahora con el vínculo quien tiene el turno: a una (rango 3), la jugada propia
 * (rango 7) y el golpe definitivo (rango 10), contra cada enemigo. Sin la acción, nada.
 *
 * @param {any} member Quien juega.
 * @param {any} [onlyEnemy] Solo contra este (la tarjeta de un enemigo).
 * @returns {BondChoice[]}
 */
export function bondChoices(member, onlyEnemy = null) {
    if (!member || !combatEncounter.active || !hasAction(combatEncounter, 'action')) return [];
    const heroId = String(partyMembers[0]?.id ?? '');
    const fighters = bondFighters();
    const me = fighters.find(f => f.id === String(member.id));
    if (!me) return [];
    const enemies = (onlyEnemy ? [onlyEnemy] : getAliveEnemies()).filter(e => (Number(e?.currentHp) || 0) > 0);
    const cells = enemies.map(enemyCell);
    /** @type {BondChoice[]} */
    const out = [];
    for (const option of pairOptions({ actor: me, heroId, party: fighters, enemies: cells })) {
        const companionId = String(member.id) === heroId ? option.partnerId : String(member.id);
        out.push({
            kind: 'pair', name: `A una con ${option.partnerName}`, desc: 'Los dos atacáis, con ventaja. Gasta tu acción y su reacción.',
            companionId, partnerId: option.partnerId, enemyId: option.enemyId, badge: 'Vínculo 3',
        });
    }
    for (const option of pairMoveOptions({ actor: me, heroId, party: fighters, enemies: cells })) {
        const companion = partyMembers.find(m => String(m.id) === option.companionId);
        const move = pairMoveOf(companion);
        out.push({
            kind: 'pair_move', name: move.name, desc: `Con ${option.partnerName}. ${move.describe} Una vez por combate.`,
            companionId: option.companionId, partnerId: option.partnerId, enemyId: option.enemyId, badge: `Vínculo ${PAIR_MOVE_RANK}`,
        });
    }
    for (const enemy of enemies) {
        const plan = planUltimate({ bonds: getCampaignBonds(), party: partyMembers, actorId: String(member.id), targetId: String(enemy.instanceId) });
        const reach = getAttackRangeFeet(member);
        const here = partyCell(member);
        const far = Math.max(Math.abs(here.x - (Number(enemy.gridX) || 0)), Math.abs(here.y - (Number(enemy.gridY) || 0))) * 5;
        if (!plan || far > reach) continue;
        out.push({
            kind: 'ultimate', name: ultimateOf(member).name, desc: `Acierta sin tirar: ${plan.damage} de daño. Una vez al día.`,
            companionId: String(member.id), partnerId: '', enemyId: String(enemy.instanceId), badge: 'Vínculo 10',
        });
    }
    return out;
}

/**
 * La jugada propia del rango 7 (`bond-moves.js`): con el héroe, contra un enemigo. Gasta la acción
 * de quien la empieza, la reacción del otro y la jugada de esta pelea. El compañero hace lo suyo
 * (derribar, disparar primero o abrirle la guardia y cubrirte) y el héroe pega.
 *
 * @param {any} member Quien la empieza (el héroe o el compañero, en su turno).
 * @param {string} companionId El compañero de la jugada.
 * @param {string} enemyId
 * @returns {string}
 */
export function resolveBondMove(member, companionId, enemyId) {
    const hero = partyMembers[0];
    const companion = partyMembers.find(m => String(m.id) === String(companionId));
    const enemy = getAliveEnemies().find(e => String(e.instanceId) === String(enemyId));
    if (!combatEncounter.active || !member || !hero || !companion || !enemy) return '';
    const can = bondChoices(member, enemy).some(c => c.kind === 'pair_move' && c.companionId === String(companionId));
    if (!can) {
        toastr.warning('Ahora no se puede: hace falta vínculo 7, la acción, su reacción y llegar los dos.', 'Jugada en pareja');
        return '';
    }
    const heroStarts = String(member.id) === String(hero.id);
    const partner = heroStarts ? companion : hero;
    const move = pairMoveOf(companion);
    const id = String(enemy.instanceId);
    const round = Number(combatEncounter.round) || 1;

    usedReactions.add(`party:${partner.id}`);
    combatEncounter.tactics = noteBondMove(combatEncounter.tactics, String(companion.id));
    // Si la empieza el compañero, su acción se va en lo suyo; el héroe pega con su reacción.
    if (!heroStarts) Object.assign(combatEncounter, useAction(combatEncounter, 'action'));
    announceBond(companion, 'pair_move', { partner: hero });
    postCombatNarration(`🤝 [COMBAT] ${move.name}: ${hero.name} y ${companion.name} van a por ${enemy.name}.`);

    const heroStrikes = (/** @type {'advantage'|'normal'} */ mode = 'normal') => {
        if ((Number(enemy.currentHp) || 0) <= 0 || !combatEncounter.active) return;
        if (heroStarts) attackEnemyById(id);
        else resolveFollowUpAttack(String(hero.id), enemy, `remata la jugada de ${companion.name} contra`, mode);
    };

    if (move.style === 'derribo') {
        // Lo tira al suelo: salva con Fuerza o Destreza contra su CD de golpe sin armas (2024).
        const dc = unarmedDC(companion);
        const save = escapeSave(enemy);
        const natural = rollDiceDetailed('1d20', 20).total;
        const fails = saveFails({ dc, saveTotal: natural + save.modifier });
        showCombatDiceRoll({
            title: `${enemy.name} se resiste`, subtitle: `${companion.name} intenta tirarle al suelo`,
            formula: `1d20${save.modifier >= 0 ? '+' : ''}${save.modifier}`,
            detail: `d20(${natural}) ${save.modifier >= 0 ? '+' : ''}${save.modifier} = ${natural + save.modifier} contra CD ${dc}`,
            total: natural + save.modifier, dc, natural, glyph: 'd20',
            stage: { by: companion, at: enemy, hit: fails, against: 'CD', style: 'melee', save: true, side: 'enemy' },
        });
        const lines = [saveLine({ who: String(enemy.name), label: save.label, natural, modifier: save.modifier, dc })];
        if (fails) {
            applyTimedCondition(enemy, id, 'Prone', 1);
            // Así el golpe del héroe remata la jugada (+1d4, idea 17), además de ir con ventaja.
            combatEncounter.maneuvers = noteKnockdown(combatEncounter.maneuvers, id, String(companion.id), round);
            lines.push(`✅ ${enemy.name} cae al suelo: ahora, de cerca, con ventaja.`);
        } else {
            lines.push(`❌ ${enemy.name} aguanta de pie.`);
        }
        postCombatNarration(`[COMBAT] ${lines.join('\n')}`);
        heroStrikes();
    } else if (move.style === 'tiro') {
        const hit = resolveFollowUpAttack(String(companion.id), enemy, 'dispara primero a', 'normal');
        if (hit && (Number(enemy.currentHp) || 0) > 0) {
            // Le ha abierto la guardia: el siguiente golpe de los tuyos, con ventaja.
            combatEncounter.maneuvers = recordManeuver(combatEncounter.maneuvers, 'ayudar', String(companion.id), id);
        }
        heroStrikes();
    } else {
        combatEncounter.maneuvers = recordManeuver(combatEncounter.maneuvers, 'ayudar', String(companion.id), id);
        heroStrikes('advantage');
        if ((Number(enemy.currentHp) || 0) > 0 && combatEncounter.active) {
            resolveFollowUpAttack(String(companion.id), enemy, `ataca a la vez que ${hero.name} a`, 'advantage');
        }
        // Y se queda cubriéndote: hasta tu próximo turno, te pegan con desventaja.
        combatEncounter.maneuvers = recordManeuver(combatEncounter.maneuvers, 'cubrir', String(companion.id), String(hero.id));
        postCombatNarration(`🛡️ [COMBAT] ${companion.name} se queda cubriendo a ${hero.name}: hasta su próximo turno, le pegan con desventaja.`);
    }
    saveCombatState();
    if (combatEncounter.active) checkScenarioOutcome();
    return move.name;
}

/**
 * E3.4: un compañero que va solo también usa lo que le da el vínculo, en vez de su golpe de
 * siempre: su golpe definitivo contra un jefe (o contra quien aguanta todo ese daño: no lo gasta en
 * rematar a un herido), o su jugada del rango 7 con el héroe, una vez por pelea.
 *
 * @param {any} member
 * @param {any} target El enemigo al que iba a pegar.
 * @returns {boolean} Si lo ha hecho (y ya no pega como siempre).
 */
export function allyBondPlay(member, target) {
    if (!member || member.summon || !target || (Number(target.currentHp) || 0) <= 0) return false;
    const choices = bondChoices(member, target);
    const ultimate = choices.find(c => c.kind === 'ultimate');
    if (ultimate) {
        const plan = planUltimate({ bonds: getCampaignBonds(), party: partyMembers, actorId: String(member.id), targetId: String(target.instanceId) });
        if (plan && (target.boss || (Number(target.currentHp) || 0) >= plan.damage)) {
            return Boolean(resolveUltimateById(String(target.instanceId)));
        }
    }
    const move = choices.find(c => c.kind === 'pair_move');
    if (move) return Boolean(resolveBondMove(member, move.companionId, move.enemyId));
    return false;
}
