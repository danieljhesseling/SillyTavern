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
 * E3.2: **la jugada en pareja del rango 3 para cualquier pareja del grupo** (`resolvePairCombo`),
 * con su nombre y lo que deja según los papeles de los dos (`rules/pair-moves.js`): tú con un
 * compañero o dos compañeros entre ellos. Un compañero que va solo también la hace con otro
 * compañero (no con tu reacción), una vez por ronda.
 *
 * Lo puro (quién puede, cómo se llama, qué dice) está en `game-engine/combat/bond-moves.js`.
 */

import { rollDiceDetailed, getAttackRangeFeet } from './combat-rules.js';
import {
    PAIR_MOVE_RANK, pairMoveOf, pairMoveOptions, perkBanner, perkLine, ultimateOf,
} from '../game-engine/combat/bond-moves.js';
import { PAIR_RANK, pairLine, pairOptions, roleOf } from '../game-engine/rules/pair-moves.js';
import { planUltimate } from '../game-engine/combat/bond-perks.js';
import { getBondProgress } from '../game-engine/campaign/bonds.js';
import { noteKnockdown, recordManeuver } from '../game-engine/combat/maneuvers.js';
import { bondMoveUsed, noteBondMove } from '../game-engine/rules/weapon-mastery.js';
import { escapeSave, saveFails, saveLine, unarmedDC } from '../game-engine/rules/unarmed.js';
import { hasAction, useAction } from '../game-engine/combat/turn-machine.js';
import { pushFx, showBond } from '../game-engine/ui/combat-vtt/fx.js';
import { floatOnToken } from './combat-log.js';
import { combatEncounter, partyMembers, usedReactions } from './state.js';
import { enemyTokenId, getAliveEnemies, partyCell, saveCombatState } from './combat-state.js';
import { showCombatDiceRoll } from './combat-log.js';
import { fxOn, tokenIdOf } from './combat-fx.js';
import { applyTimedCondition } from './magic.js';
import { postCombatNarration } from './narration.js';
import { getCampaignBonds } from './time.js';
import { sulks } from './roce.js';
import { attackEnemyById, resolveFollowUpAttack, resolveUltimateById } from './player-actions.js';
import { checkScenarioOutcome } from './combat-flow.js';

/** @typedef {'follow_up'|'pair'|'baton_pass'|'endure'|'pair_move'|'ultimate'} BondPerk */

/**
 * Salta una ventaja del vínculo: lo apunta el registro («💞 Vínculo 7 · Yunque y martillo»), el
 * compañero dice su frase y su ficha (y la de su pareja) brilla en el tablero.
 *
 * @param {any} member El compañero cuya ventaja salta (el que habla).
 * @param {BondPerk} perkId
 * @param {{partner?: any, title?: string, line?: string}} [options] Con quién (también brilla); y,
 *   si la jugada trae los suyos, su rótulo y su frase (E3.2: la de la pareja por sus papeles).
 */
export function announceBond(member, perkId, { partner = null, title: ownTitle = '', line: ownLine = '' } = {}) {
    if (!member) return;
    const line = ownLine || perkLine(member, perkId);
    const title = ownTitle || perkBanner(member, perkId);
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
 * @returns {Array<{id: string, name: string, x: number, y: number, hp: number, rank: number, reachFeet: number, reactionUsed: boolean, moveUsed: boolean, style: any, role: any}>}
 */
export function bondFighters() {
    const bonds = getCampaignBonds();
    return partyMembers.filter(m => !m.dead).map(m => ({
        id: String(m.id),
        name: String(m.name),
        ...partyCell(m),
        hp: Number(m.hp) || 0,
        // E4.1: quien está molesto contigo no hace ataques en pareja ni su jugada (hasta que se le pase).
        rank: sulks(m) ? 0 : getBondProgress(bonds, String(m.id)).rank,
        reachFeet: getAttackRangeFeet(m),
        reactionUsed: usedReactions.has(`party:${m.id}`),
        moveUsed: bondMoveUsed(combatEncounter.tactics, String(m.id)),
        style: pairMoveOf(m).style,
        // E3.2: su papel, para la jugada en pareja.
        role: roleOf(m),
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
 * @property {import('../game-engine/rules/pair-moves.js').PairCombo} [combo] La jugada en pareja (rango 3).
 */

/**
 * Lo que puede hacer ahora con el vínculo quien tiene el turno: a una (rango 3), la jugada propia
 * (rango 7) y el golpe definitivo (rango 10), contra cada enemigo. Sin la acción, nada.
 *
 * @param {any} member Quien juega.
 * @param {any} [onlyEnemy] Solo contra este (la tarjeta de un enemigo).
 * @param {{withHero?: boolean}} [options] Si vale sumar al héroe a la jugada en pareja.
 * @returns {BondChoice[]}
 */
export function bondChoices(member, onlyEnemy = null, { withHero = true } = {}) {
    if (!member || !combatEncounter.active || !hasAction(combatEncounter, 'action')) return [];
    const heroId = String(partyMembers[0]?.id ?? '');
    const fighters = bondFighters();
    const me = fighters.find(f => f.id === String(member.id));
    if (!me) return [];
    const enemies = (onlyEnemy ? [onlyEnemy] : getAliveEnemies()).filter(e => (Number(e?.currentHp) || 0) > 0);
    const cells = enemies.map(enemyCell);
    /** @type {BondChoice[]} */
    const out = [];
    // E3.2: con cualquiera del grupo con quien tenga vínculo 3, la jugada de los dos por sus papeles.
    for (const option of pairOptions({ actor: me, heroId, party: fighters, enemies: cells, withHero })) {
        out.push({
            kind: 'pair', name: `${option.combo.name} · con ${option.partnerName.split(/\s+/)[0]}`,
            desc: `${option.combo.describe} Gasta tu acción y la reacción de ${option.partnerName.split(/\s+/)[0]}.`,
            companionId: option.companionId, partnerId: option.partnerId, enemyId: option.enemyId, badge: `Vínculo ${PAIR_RANK}`,
            combo: option.combo,
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
 * Cuántas rondas dura lo que se le deja a alguien «hasta su próximo turno»: los estados con fecha
 * caducan al empezar la ronda, así que si ya le ha tocado en esta, tiene que durar a la siguiente.
 *
 * @param {string} id
 * @returns {number}
 */
function untilTurnOf(id) {
    const order = Array.isArray(combatEncounter.turnOrder) ? combatEncounter.turnOrder : [];
    const at = Number(combatEncounter.currentTurnIndex) || 0;
    return order.slice(at + 1).some(entry => String(entry?.id) === String(id)) ? 1 : 2;
}

/**
 * E3.2: la jugada en pareja del rango 3, para cualquier pareja del grupo, según sus papeles
 * (`pairCombo`): pegan los dos con ventaja, en su orden (quien dispara abre, la sombra remata), y
 * deja lo de cada papel: cubrir, despistar, dejarle vendido, frenarle o bendecir a la pareja.
 * Gasta la acción de quien la empieza y la reacción de quien se suma.
 *
 * @param {any} member Quien la empieza (a quien le toca).
 * @param {string} partnerId Quien se suma.
 * @param {any} enemy
 * @returns {string} El nombre de la jugada, o vacío si no se ha podido.
 */
export function resolvePairCombo(member, partnerId, enemy) {
    const partner = partyMembers.find(m => String(m.id) === String(partnerId));
    if (!combatEncounter.active || !member || !partner || !enemy) return '';
    const option = bondChoices(member, enemy).find(c => c.kind === 'pair' && c.partnerId === String(partnerId));
    const combo = option?.combo;
    if (!option || !combo) {
        toastr.warning(`Ahora no se puede: hace falta vínculo ${PAIR_RANK}, tu acción, su reacción y que lleguéis los dos.`, 'En pareja');
        return '';
    }
    const id = String(enemy.instanceId);
    const speaker = String(option.companionId) === String(partner.id) ? partner : member;
    usedReactions.add(`party:${partner.id}`);
    announceBond(speaker, 'pair', { partner: speaker === partner ? member : partner, title: `Vínculo ${PAIR_RANK} · ${combo.name}`, line: combo.say });
    postCombatNarration(`[COMBAT] ${pairLine(String(member.name), String(partner.name), String(enemy.name), combo.name)}`);

    const standing = () => (Number(enemy.currentHp) || 0) > 0 && combatEncounter.active;
    for (const who of combo.order) {
        if (!standing()) break;
        if (who === String(member.id)) {
            // Su pareja le abre la guardia: el golpe de quien la empieza va con ventaja.
            combatEncounter.maneuvers = recordManeuver(combatEncounter.maneuvers, 'ayudar', String(partner.id), id);
            attackEnemyById(id);
        } else {
            resolveFollowUpAttack(String(partner.id), enemy, `va a una con ${member.name} contra`, 'advantage');
        }
    }
    // Si cayó antes de que pegara quien la empezó, su acción se ha ido igual: era la jugada.
    if (combatEncounter.active && hasAction(combatEncounter, 'action')) Object.assign(combatEncounter, useAction(combatEncounter, 'action'));

    if (combatEncounter.active) {
        const byId = (/** @type {string} */ who) => (who === String(member.id) ? member : who === String(partner.id) ? partner : null);
        /** @type {string[]} */
        const lines = [];
        for (const effect of combo.effects) {
            const by = byId(effect.by);
            const on = effect.on ? byId(effect.on) : null;
            if (!by) continue;
            if (effect.kind === 'cubrir' && on && (Number(on.hp) || 0) > 0) {
                combatEncounter.maneuvers = recordManeuver(combatEncounter.maneuvers, 'cubrir', String(by.id), String(on.id));
                floatOnToken(tokenIdOf(on), 'Cubierto', 'heal');
                lines.push(`🛡️ ${by.name} se queda cubriendo a ${on.name}: hasta su próximo turno, le pegan con desventaja.`);
            } else if (effect.kind === 'bendecir' && on && (Number(on.hp) || 0) > 0) {
                applyTimedCondition(on, String(on.id), 'Bendecido', 2);
                floatOnToken(tokenIdOf(on), 'Bendecido', 'heal');
                lines.push(`✨ ${by.name} bendice a ${on.name}: dos rondas pegando con ventaja.`);
            } else if (standing() && effect.kind === 'despistar') {
                applyTimedCondition(enemy, id, 'Distraído', untilTurnOf(id));
                floatOnToken(enemyTokenId(enemy), 'Despistado', 'damage');
                lines.push(`🌀 ${by.name} despista a ${enemy.name}: en su próximo turno pega con desventaja.`);
            } else if (standing() && effect.kind === 'vendido') {
                combatEncounter.maneuvers = recordManeuver(combatEncounter.maneuvers, 'ayudar', String(by.id), id);
                floatOnToken(enemyTokenId(enemy), 'Vendido', 'damage');
                lines.push(`🎯 ${by.name} deja vendido a ${enemy.name}: el siguiente golpe de los vuestros va con ventaja.`);
            } else if (standing() && effect.kind === 'frenar') {
                applyTimedCondition(enemy, id, 'Ralentizado', untilTurnOf(id));
                floatOnToken(enemyTokenId(enemy), 'Frenado', 'damage');
                lines.push(`❄️ ${by.name} frena a ${enemy.name} con un hechizo: se mueve 10 pies menos.`);
            }
        }
        if (lines.length > 0) postCombatNarration(`[COMBAT] ${lines.join('\n')}`);
    }
    saveCombatState();
    if (combatEncounter.active) checkScenarioOutcome();
    return combo.name;
}

/** La pelea y la ronda en las que el juego ya ha hecho una jugada en pareja por su cuenta. */
/** @type {{enemies: any, round: number}} */
let autoPair = { enemies: null, round: -1 };

/**
 * E3.4: un compañero que va solo también usa lo que le da el vínculo, en vez de su golpe de
 * siempre: su golpe definitivo contra un jefe (o contra quien aguanta todo ese daño: no lo gasta en
 * rematar a un herido), o su jugada del rango 7 con el héroe, una vez por pelea. E3.2: si no, su
 * jugada en pareja con otro compañero (nunca con tu reacción), una por ronda entre todos.
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
    const round = Number(combatEncounter.round) || 0;
    if (autoPair.enemies !== combatEncounter.enemies || autoPair.round !== round) {
        const pair = bondChoices(member, target, { withHero: false }).find(c => c.kind === 'pair');
        if (pair && resolvePairCombo(member, pair.partnerId, target)) {
            autoPair = { enemies: combatEncounter.enemies, round };
            return true;
        }
    }
    return false;
}
