/**
 * La magia dentro del turno (J19 de wiki/ROADMAP_SIN_CONEXION.md): lo que un conjuro sigue
 * haciendo después de lanzarse, ronda a ronda.
 *
 * - **Las zonas** (J19.6): saltan al empezar y al acabar el turno de quien está dentro (al
 *   entrar lo lleva el paso, en `board.js`), y se acaban con su ronda.
 * - **La concentración** (J19.4): un golpe pide aguantarla; un estado que incapacita, caer o
 *   morir la rompe; y se acaba sola con su tiempo. Al perderla se va lo que dependía de ella
 *   (`dropConcentration` de `magic.js`: sus zonas, sus invocaciones y sus estados).
 * - **Las invocaciones** (J19.5): fichas del grupo con su turno, justo detrás de quien las
 *   llamó. Las lleva el jugador o el juego (J7.3), y se van con su tiempo, al caer o con la
 *   concentración.
 * - **Las reacciones** (J19.7): Escudo cuando aciertan a alguien del grupo, Contraconjuro
 *   cuando un enemigo lanza a su alcance. Con la reacción de la ronda (`usedReactions`).
 *
 * Lanzar es de `magic.js` (`castSpellExtras`): pone la zona, la concentración y las fichas de
 * `planSummon` en `combatEncounter.summons`. Aquí se les da turno y se cuenta lo que pasa.
 * Las reglas son de `game-engine/` (puras); este módulo solo escribe en las fichas.
 */

import { rollDiceDetailed, getDistanceInFeet } from './combat-rules.js';
import {
    readConcentration, concentrationCheck, concentrationAfterConditions, expireConcentration, constitutionSave,
} from '../game-engine/rules/concentration.js';
import { zoneEffects, resolveZoneEffect, expireZones, followCaster, kindOf } from '../game-engine/board/spell-zones.js';
import { normalizeSummon, expireSummons, setSummonControl } from '../game-engine/rules/summons.js';
import { reactionOptions, resolveReaction } from '../game-engine/rules/spell-reactions.js';
import { castableSpells } from '../game-engine/rules/spell-prep.js';
import { lowestFreeSlot, spendSlot, spellcastingStats, SLOT_LABELS } from '../game-engine/rules/spell-slots.js';
import { clearTimersFor } from '../game-engine/combat/condition-timers.js';
import { canPlayerControl } from '../game-engine/campaign/bonds.js';
import { combatEncounter, currentLocationName, partyMembers, usedReactions } from './state.js';
import { boardCellOf, enemyTokenId } from './combat-state.js';
import { floatOnToken } from './combat-log.js';
import { damagePartyMember } from './enemy-turn.js';
import { applyTimedCondition, dropConcentration, spellFor, classRowOf, spellRows } from './magic.js';
import { getCampaignBonds } from './time.js';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** La ronda de ahora. */
const roundNow = () => Math.max(1, Math.floor(Number(combatEncounter.round) || 1));

/** Con el dado de la partida. @param {string} formula */
const roll = (formula) => rollDiceDetailed(formula, 20);

/** Las invocaciones llevan ids de ficha propios, lejos de los del grupo (`Date.now()`) y de los enemigos (negativos). */
const SUMMON_ID_BASE = 900000000;

/**
 * El id con el que el encuentro conoce a alguien: los enemigos, por su instancia.
 *
 * @param {any} creature
 * @returns {string}
 */
export function creatureId(creature) {
    return creature?.instanceId != null ? String(creature.instanceId) : String(creature?.id ?? '');
}

/** @param {any} creature */
const isEnemy = (creature) => creature?.instanceId != null;

/** @param {any} creature @returns {number} */
const hpOf = (creature) => Number(isEnemy(creature) ? creature?.currentHp : creature?.hp) || 0;

// ---------------------------------------------------------------------------------------
// Las invocaciones (J19.5)
// ---------------------------------------------------------------------------------------

/**
 * Una ficha de `planSummon` hecha luchadora: con su id de ficha, su casilla como la del grupo
 * (`mapPosition`) y unos números para pegar, de su desafío. Así anda, ataca y recibe por las
 * mismas puertas que cualquiera del grupo (`player-actions.js`, `enemy-turn.js`).
 *
 * @param {any} token
 * @param {number} id
 * @returns {any}
 */
function asFighter(token, id) {
    const spec = normalizeSummon(spellFor(token.spellId)?.summon);
    const cr = Math.max(0, Number(spec.cr) || 0);
    const muscle = 10 + Math.round(cr * 2);
    return Object.assign(token, {
        key: text(token.id),
        id,
        summon: true,
        archetype: spec.creature,
        level: Math.max(1, Math.ceil(cr * 2)),
        strength: muscle,
        dexterity: muscle,
        constitution: 10 + Math.round(cr),
        intelligence: 6,
        wisdom: 10,
        charisma: 6,
        activeConditions: Array.isArray(token.activeConditions) ? token.activeConditions : [],
        mapPosition: { locationName: currentLocationName, gridX: Number(token.x) || 0, gridY: Number(token.y) || 0 },
    });
}

/**
 * Un id de ficha que no tenga nadie.
 *
 * @param {any[]} list
 * @returns {number}
 */
function freeSummonId(list) {
    const used = new Set(list.map(s => Number(s.id)));
    let id = SUMMON_ID_BASE + (Date.now() % 50000000);
    while (used.has(id)) id++;
    return id;
}

/**
 * Las invocaciones del combate, listas para pelear. Las que acaban de llegar de `planSummon`
 * se hacen luchadoras aquí y entran en la iniciativa justo detrás de quien las llamó (en 5e
 * actúan en su turno); las que se han movido dejan su casilla también en `x`/`y`, que es lo
 * que leen las zonas y el dibujo.
 *
 * @returns {any[]}
 */
export function summonsNow() {
    const list = Array.isArray(combatEncounter.summons) ? combatEncounter.summons : [];
    combatEncounter.summons = list;
    for (const token of list) {
        if (!token.summon) {
            asFighter(token, freeSummonId(list));
            joinInitiative(token);
        }
        token.x = Number(token.mapPosition?.gridX) || 0;
        token.y = Number(token.mapPosition?.gridY) || 0;
    }
    return list;
}

/**
 * Las invocaciones en pie.
 *
 * @returns {any[]}
 */
export function livingSummons() {
    return summonsNow().filter(s => (Number(s.hp) || 0) > 0);
}

/**
 * Una invocación por su id de ficha (o de turno).
 *
 * @param {any} id
 * @returns {any|null}
 */
export function summonById(id) {
    return summonsNow().find(s => String(s.id) === String(id)) ?? null;
}

/**
 * Meter una invocación en la iniciativa, detrás de quien la llamó (o al final).
 *
 * @param {any} fighter
 */
function joinInitiative(fighter) {
    const order = Array.isArray(combatEncounter.turnOrder) ? combatEncounter.turnOrder : [];
    if (order.some(e => String(e.id) === String(fighter.id))) return;
    const at = order.findIndex(e => !e.isEnemy && String(e.id) === String(fighter.casterId));
    // Las que ya se han metido detrás de él van antes: el orden en que se invocaron.
    const summonOf = (/** @type {any} */ entry) => (combatEncounter.summons ?? []).find(s => s.summon && String(s.id) === String(entry?.id));
    let after = at;
    while (after >= 0 && after + 1 < order.length && summonOf(order[after + 1])?.casterId === fighter.casterId) after++;
    const entry = { id: String(fighter.id), name: String(fighter.name), initiative: at >= 0 ? order[at].initiative : 0, isEnemy: false };
    if (after < 0) {
        order.push(entry);
        return;
    }
    order.splice(after + 1, 0, entry);
    if (after + 1 <= combatEncounter.currentTurnIndex) combatEncounter.currentTurnIndex += 1;
}

/**
 * Quitar de la iniciativa los turnos de invocaciones que ya no están. El del turno en curso
 * se deja (se salta solo: no puede actuar) para no mover a nadie el suyo.
 */
export function pruneSummonTurns() {
    const order = Array.isArray(combatEncounter.turnOrder) ? combatEncounter.turnOrder : [];
    const ids = new Set(summonsNow().map(s => String(s.id)));
    const current = order[combatEncounter.currentTurnIndex] ?? null;
    const gone = (/** @type {any} */ e) => !e.isEnemy && Number(e.id) >= SUMMON_ID_BASE && Number(e.id) < SUMMON_ID_BASE * 2 && !ids.has(String(e.id));
    if (!order.some(e => e !== current && gone(e))) return;
    combatEncounter.turnOrder = order.filter(e => e === current || !gone(e));
    combatEncounter.currentTurnIndex = Math.max(0, combatEncounter.turnOrder.indexOf(current));
}

/**
 * Que se vayan unas invocaciones: fuera de la lista y de la iniciativa.
 *
 * @param {any[]} gone
 */
function removeSummons(gone) {
    if (gone.length === 0) return;
    const ids = new Set(gone.map(s => String(s.id)));
    combatEncounter.summons = summonsNow().filter(s => !ids.has(String(s.id)));
    combatEncounter.conditionTimers = gone.reduce((timers, s) => clearTimersFor(timers, String(s.id)), combatEncounter.conditionTimers);
    pruneSummonTurns();
}

/**
 * Un golpe a una invocación. A cero se desvanece: no se desangra ni tira salvaciones.
 *
 * @param {any} summon
 * @param {number} damage
 * @returns {string[]}
 */
export function hurtSummon(summon, damage) {
    summon.hp = Math.max(0, (Number(summon.hp) || 0) - Math.max(0, Math.floor(Number(damage) || 0)));
    /** @type {string[]} */
    const lines = [`❤️ Estado de ${summon.name}: ${summon.hp}/${summon.maxHp}`];
    if (summon.hp === 0) {
        lines.push(`🐾 ${summon.name} se desvanece.`);
        removeSummons([summon]);
    }
    return lines;
}

/**
 * Si quien la llamó cae, sus invocaciones se van con él (5e: las que dependen de él).
 *
 * @param {any} caster
 * @returns {string[]}
 */
function dismissFor(caster) {
    const gone = summonsNow().filter(s => String(s.casterId) === creatureId(caster));
    removeSummons(gone);
    return gone.map(s => `🐾 ${s.name} se desvanece.`);
}

// ---------------------------------------------------------------------------------------
// Quién mueve a quién (J7.3, D-J32)
// ---------------------------------------------------------------------------------------

/**
 * Si se puede elegir quién mueve a alguien: a un compañero, desde el vínculo de amigo; a una
 * invocación, si su conjuro deja llevarla y se puede llevar a quien la llamó. Al héroe no: es
 * tuyo siempre.
 *
 * @param {any} member
 * @returns {boolean}
 */
export function canChooseControl(member) {
    if (!member) return false;
    if (member.summon) {
        const spec = normalizeSummon(spellFor(member.spellId)?.summon);
        if (spec.control === 'engine') return false;
        return canPlayerControl({ ...member, control: 'player' }, getCampaignBonds(), { party: partyMembers });
    }
    return true;
}

/**
 * Quién le mueve ahora: `player` o `engine`.
 * Cualquier combatiente (incluido el primer miembro) puede llevarse en manual (`player`)
 * o delegarse en el juego (`engine`) para el Modo Manager.
 *
 * @param {any} member
 * @returns {'player'|'engine'}
 */
export function controlOf(member) {
    if (!member) return 'engine';
    if (member.summon) {
        if (member.control === 'engine') return 'engine';
        if (member.control === 'player') return 'player';
        return canPlayerControl(member, getCampaignBonds(), { party: partyMembers }) ? 'player' : 'engine';
    }
    if (member.control === 'engine') return 'engine';
    if (member.control === 'player') return 'player';
    return 'player';
}

/**
 * Cambiar quién le mueve, también a mitad de pelea.
 *
 * @param {any} member
 * @param {'player'|'engine'} control
 * @returns {boolean} Si ha cambiado.
 */
export function setControl(member, control) {
    if (!canChooseControl(member) || !['player', 'engine'].includes(control)) return false;
    if (member.summon) Object.assign(member, setSummonControl(member, control));
    else member.control = control;
    return true;
}

// Cómo se dice cada lado del interruptor, y el vínculo desde el que se puede elegir. Se
// reexportan sin leerlos: un módulo de party/ no lee nada importado al cargarse (J15.1).
export { SUMMON_CONTROL_LABELS as CONTROL_LABELS } from '../game-engine/rules/summons.js';
export { CONTROL_RANK as CONTROL_FROM_RANK } from '../game-engine/campaign/bonds.js';

// ---------------------------------------------------------------------------------------
// La concentración (J19.4)
// ---------------------------------------------------------------------------------------

/**
 * La salvación con Resguardado (Resistencia): 1d4 más, y se gasta.
 *
 * @param {any} creature
 * @returns {{bonus: number, line: string}}
 */
function wardDie(creature) {
    const had = Array.isArray(creature?.activeConditions) ? creature.activeConditions : [];
    if (!had.includes('Resguardado')) return { bonus: 0, line: '' };
    const bonus = Number(rollDiceDetailed('1d4', 4).total) || 1;
    creature.activeConditions = had.filter((/** @type {string} */ c) => c !== 'Resguardado');
    return { bonus, line: `🛡️ ${creature.name} está resguardado: +${bonus} a la salvación.` };
}

/**
 * Tras un golpe, si se concentra, la salvación de Constitución (CD la mitad del daño, 10
 * como poco). Si cae a cero, se acaba sin tirar.
 *
 * @param {any} creature
 * @param {number} damage
 * @returns {string[]}
 */
export function concentrationAfterHurt(creature, damage) {
    const current = readConcentration(creature?.concentration);
    const hurt = Math.max(0, Math.floor(Number(damage) || 0));
    if (!current || hurt === 0) return [];
    if (hpOf(creature) <= 0 || creature.dead) return dropConcentration(creature, `${creature.name} cae`);
    const ward = wardDie(creature);
    const check = concentrationCheck({
        concentration: current, damage: hurt, roll, name: String(creature.name),
        saveModifier: constitutionSave(creature) + ward.bonus,
    });
    creature.concentrationHp = hpOf(creature);
    const lines = [...(ward.line ? [ward.line] : []), ...check.lines];
    if (check.kept) return lines;
    // La primera línea de `dropConcentration` repite «se acaba»: ya lo ha dicho la tirada.
    return [...lines, ...dropConcentration(creature, 'pierde la concentración').slice(1)];
}

/**
 * Todos los que se concentran, mirados: quien ha caído o está incapacitado la pierde; el
 * enemigo al que han herido desde la última vez, tira. Se llama al cambiar de turno, que es
 * cuando ya ha pasado todo lo de un turno (el golpe, el conjuro que paraliza, la zona).
 *
 * @returns {string[]}
 */
export function sweepConcentration() {
    /** @type {string[]} */
    const lines = [];
    for (const creature of [...partyMembers, ...(combatEncounter.enemies ?? [])]) {
        if (!readConcentration(creature?.concentration)) continue;
        if (hpOf(creature) <= 0 || creature.dead) {
            lines.push(...dropConcentration(creature, `${creature.name} cae`));
            continue;
        }
        const conditions = concentrationAfterConditions(creature.concentration, creature.activeConditions);
        if (conditions.broken) {
            lines.push(`${creature.name}: ${conditions.lines[0]}`, ...dropConcentration(creature, '').slice(1));
            continue;
        }
        // Lo que no ha pasado por `damagePartyMember` (los golpes a los enemigos): la vida
        // que tenía al concentrarse, o en la última salvación, contra la de ahora.
        const seen = Number(creature.concentrationHp);
        const now = hpOf(creature);
        if (Number.isFinite(seen) && now < seen) lines.push(...concentrationAfterHurt(creature, seen - now));
        creature.concentrationHp = hpOf(creature);
    }
    return lines;
}

// ---------------------------------------------------------------------------------------
// Las zonas (J19.6)
// ---------------------------------------------------------------------------------------

/** @returns {import('../game-engine/board/spell-zones.js').Zone[]} */
function zonesNow() {
    return Array.isArray(combatEncounter.spellZones) ? combatEncounter.spellZones : [];
}

/**
 * Un golpe de zona o de conjuro a cualquiera: del grupo, enemigo o invocación.
 *
 * @param {any} creature
 * @param {number} damage
 * @returns {string[]}
 */
export function hurtCreature(creature, damage) {
    if (damage <= 0) return [];
    if (creature?.summon) {
        floatOnToken(creature.id, `-${damage}`, 'damage');
        return hurtSummon(creature, damage);
    }
    if (!isEnemy(creature)) return damagePartyMember(creature, damage, false);
    creature.currentHp = Math.max(0, (Number(creature.currentHp) || 0) - damage);
    floatOnToken(enemyTokenId(creature), `-${damage}`, 'damage');
    const lines = [`❤️ Estado de ${creature.name}: ${creature.currentHp}/${creature.maxHp}`];
    if (creature.currentHp === 0) {
        lines.push(`☠️ ${creature.name} cae derrotado.`);
        combatEncounter.conditionTimers = clearTimersFor(combatEncounter.conditionTimers, String(creature.instanceId));
        lines.push(...dropConcentration(creature, `${creature.name} cae`));
    } else {
        lines.push(...concentrationAfterHurt(creature, damage));
    }
    return lines;
}

/**
 * Lo que salta en la casilla de alguien al empezar o al acabar su turno.
 *
 * @param {any} creature
 * @param {'start'|'end'} trigger
 * @returns {string[]}
 */
export function zoneTurn(creature, trigger) {
    if (!creature || hpOf(creature) <= 0) return [];
    const zones = zonesNow();
    if (zones.length === 0) return [];
    /** @type {string[]} */
    const lines = [];
    for (const effect of zoneEffects({ zones, cell: boardCellOf(creature), trigger, who: creatureId(creature) })) {
        lines.push(...applyZoneEffect(creature, effect, `${creature.name} ${trigger === 'start' ? 'empieza su turno' : 'acaba su turno'} en ${effect.name}.`));
    }
    return lines;
}

/**
 * Lo que le hace a alguien un efecto de zona: su salvación, su daño y el estado que deja
 * (apuntado a la concentración de quien la lanzó, para que se vaya con ella).
 *
 * @param {any} creature
 * @param {any} effect Uno de `zoneEffects`.
 * @param {string} said Cómo se dice que le toca.
 * @returns {string[]}
 */
function applyZoneEffect(creature, effect, said) {
    const zone = zonesNow().find(z => z.id === effect.zoneId);
    // Lo que va con quien lo lanza (los espíritus) no toca a los suyos.
    if (zone && kindOf(zone.kind).follows && sameSide(zone.casterId, creature)) return [];
    const ward = effect.save ? wardDie(creature) : { bonus: 0, line: '' };
    const result = resolveZoneEffect({
        effect,
        roll: (formula) => rollDiceDetailed(formula, 8),
        saveModifier: (effect.save ? Math.floor(((Number(creature?.[effect.save]) || 10) - 10) / 2) : 0) + ward.bonus,
        targetName: String(creature.name),
    });
    const lines = [`${kindOf(effect.kind).icon} ${said}`, ...(ward.line ? [ward.line] : []), ...result.lines];
    lines.push(...hurtCreature(creature, result.damage));
    if (result.condition && hpOf(creature) > 0) {
        applyTimedCondition(creature, creatureId(creature), result.condition, result.conditionRounds);
        if (zone?.concentration) {
            creature.spellMarks = [...(Array.isArray(creature.spellMarks) ? creature.spellMarks : []), { casterId: zone.casterId, spellId: zone.spellId, condition: result.condition }];
        }
    }
    return lines;
}

/**
 * Un enemigo que cruza zonas al moverse: al entrar en cada una, una vez por turno. Se para
 * donde queda atrapado o cae. (El grupo, al andar: `walkThroughSpellZones` de `board.js`.)
 *
 * @param {any} enemy
 * @param {Array<{x: number, y: number}>} steps Las casillas que pisa, sin la de salida.
 * @returns {{stopAt: number, lines: string[]}}
 */
export function enemyWalksZones(enemy, steps) {
    /** @type {string[]} */
    const lines = [];
    const zones = zonesNow();
    if (zones.length === 0 || steps.length === 0) return { stopAt: steps.length - 1, lines };
    /** @type {string[]} */
    const already = [];
    for (let index = 0; index < steps.length; index++) {
        const hits = zoneEffects({ zones, cell: steps[index], trigger: 'enter', who: creatureId(enemy), alreadyThisTurn: already });
        for (const effect of hits) {
            already.push(effect.key);
            lines.push(...applyZoneEffect(enemy, effect, `${enemy.name} entra en ${effect.name}.`));
        }
        const held = (Array.isArray(enemy.activeConditions) ? enemy.activeConditions : []).some((/** @type {string} */ c) => ['Restrained', 'Grappled', 'Paralyzed', 'Unconscious'].includes(c));
        if (hits.length > 0 && (held || hpOf(enemy) <= 0)) return { stopAt: index, lines };
    }
    return { stopAt: steps.length - 1, lines };
}

/**
 * Si alguien es del mismo bando que quien lanzó.
 *
 * @param {string} casterId
 * @param {any} creature
 * @returns {boolean}
 */
function sameSide(casterId, creature) {
    const casterIsEnemy = (combatEncounter.enemies ?? []).some(e => String(e.instanceId) === String(casterId));
    return casterIsEnemy === isEnemy(creature);
}

/**
 * Las zonas que van con quien las lanzó (los espíritus guardianes), a donde está ahora.
 */
function followCasters() {
    let zones = zonesNow();
    for (const zone of zones.filter(z => kindOf(z.kind).follows)) {
        const caster = [...partyMembers, ...(combatEncounter.enemies ?? [])].find(c => creatureId(c) === String(zone.casterId));
        if (caster) zones = followCaster(zones, String(zone.casterId), boardCellOf(caster));
    }
    combatEncounter.spellZones = zones;
}

// ---------------------------------------------------------------------------------------
// El turno y la ronda
// ---------------------------------------------------------------------------------------

/**
 * Quien tiene un turno: del grupo, invocación o enemigo.
 *
 * @param {any} entry
 * @returns {any|null}
 */
export function creatureOfEntry(entry) {
    if (!entry) return null;
    if (entry.isEnemy) return (combatEncounter.enemies ?? []).find(e => String(e.instanceId) === String(entry.id)) ?? null;
    return partyMembers.find(m => String(m.id) === String(entry.id)) ?? summonById(entry.id);
}

/**
 * Lo que pasa al acabar el turno de alguien: las zonas en las que se queda.
 *
 * @param {any} entry
 * @returns {string[]}
 */
export function turnEndMagic(entry) {
    followCasters();
    return zoneTurn(creatureOfEntry(entry), 'end');
}

/**
 * Lo que pasa al empezar el turno de alguien: su Escudo se baja, las zonas en las que está
 * saltan, y quien se concentraba y ha caído o está incapacitado la pierde.
 *
 * @param {any} entry
 * @returns {string[]}
 */
export function turnStartMagic(entry) {
    summonsNow();
    const creature = creatureOfEntry(entry);
    if (creature && Array.isArray(combatEncounter.shielded)) {
        combatEncounter.shielded = combatEncounter.shielded.filter(id => id !== creatureId(creature));
    }
    followCasters();
    return [...sweepConcentration(), ...zoneTurn(creature, 'start')];
}

/**
 * Lo que caduca al empezar una ronda: las zonas, las invocaciones y las concentraciones que
 * han llegado a su fin; y los estados que tenía puestos una invocación.
 *
 * @returns {string[]}
 */
export function roundMagic() {
    const round = roundNow();
    /** @type {string[]} */
    const lines = [];
    const zones = expireZones(zonesNow(), round);
    combatEncounter.spellZones = zones.kept;
    lines.push(...zones.lines);
    for (const creature of [...partyMembers, ...(combatEncounter.enemies ?? [])]) {
        const over = expireConcentration(creature?.concentration, round);
        if (over.expired) lines.push(...over.lines, ...dropConcentration(creature, '').slice(1));
    }
    // Una invocación cuyo invocador ya no está en pie se va con él.
    for (const caster of [...partyMembers, ...(combatEncounter.enemies ?? [])].filter(c => hpOf(c) <= 0 || c.dead)) {
        lines.push(...dismissFor(caster));
    }
    const summons = expireSummons(summonsNow(), round);
    removeSummons(summons.gone);
    lines.push(...summons.lines);
    // Los estados con fecha de una invocación: `expireTimedConditions` solo busca al grupo y
    // a los enemigos.
    for (const summon of summonsNow()) {
        const due = (combatEncounter.conditionTimers ?? []).filter(t => String(t.who) === String(summon.id) && Number(t.until) <= round);
        if (due.length === 0) continue;
        const gone = new Set(due.map(t => String(t.condition)));
        summon.activeConditions = summon.activeConditions.filter((/** @type {string} */ c) => !gone.has(c));
    }
    pruneSummonTurns();
    return lines;
}

/**
 * Al acabar la pelea: las invocaciones se van, las zonas se deshacen y las concentraciones
 * de la pelea se acaban (en la mesa, lo que dura un minuto no pasa a la escena siguiente).
 *
 * @returns {string[]}
 */
export function endOfFightMagic() {
    /** @type {string[]} */
    const lines = [];
    const summons = summonsNow();
    if (summons.length > 0) lines.push(`🐾 ${summons.map(s => s.name).join(', ')} se ${summons.length > 1 ? 'desvanecen' : 'desvanece'}.`);
    combatEncounter.summons = [];
    for (const member of partyMembers) {
        delete member.concentrationHp;
        if (readConcentration(member?.concentration)) lines.push(...dropConcentration(member, ''));
    }
    for (const member of partyMembers) {
        if (Array.isArray(member.spellMarks) && member.spellMarks.length > 0) {
            const gone = new Set(member.spellMarks.map((/** @type {any} */ m) => String(m.condition)));
            member.activeConditions = (Array.isArray(member.activeConditions) ? member.activeConditions : []).filter((/** @type {string} */ c) => !gone.has(c));
            member.spellMarks = [];
        }
    }
    combatEncounter.spellZones = [];
    combatEncounter.shielded = [];
    return lines;
}

// ---------------------------------------------------------------------------------------
// Las reacciones (J19.7)
// ---------------------------------------------------------------------------------------

/**
 * Lo que alguien del grupo puede lanzar como reacción ahora, con el espacio que gastaría.
 *
 * @param {any} member
 * @param {'hit'|'spell'|'fall'} trigger
 * @param {number} distanceFeet
 * @returns {{spell: any, slotLevel: number, classRow: any}|null}
 */
function reactionFor(member, trigger, distanceFeet) {
    if (!member || member.summon || member.dead || hpOf(member) <= 0) return null;
    if (usedReactions.has(`party:${member.id}`)) return null;
    const classRow = classRowOf(member);
    if (!classRow?.casting) return null;
    const { cantrips, spells } = castableSpells(member, classRow, spellRows());
    const { options } = reactionOptions({
        spells: [...cantrips, ...spells],
        trigger,
        reactionUsed: false,
        slotFor: (level) => lowestFreeSlot(member, classRow, level),
        distanceFeet,
    });
    return options[0] ? { ...options[0], classRow } : null;
}

/**
 * Pagar una reacción: su espacio y la reacción de la ronda.
 *
 * @param {any} member
 * @param {{spell: any, slotLevel: number, classRow: any}} option
 * @returns {{ok: boolean, slotLevel: number, line: string}}
 */
function payReaction(member, option) {
    if (option.slotLevel <= 0) {
        usedReactions.add(`party:${member.id}`);
        return { ok: true, slotLevel: 0, line: '' };
    }
    const paid = spendSlot(member, option.classRow, option.slotLevel);
    if (!paid.ok) return { ok: false, slotLevel: 0, line: '' };
    member.slotsUsed = paid.slotsUsed;
    usedReactions.add(`party:${member.id}`);
    return { ok: true, slotLevel: paid.slotLevel, line: `🔮 ${member.name} gasta un espacio de ${SLOT_LABELS[/** @type {1} */ (paid.slotLevel)]}.` };
}

/**
 * Escudo: cuando aciertan a alguien del grupo que lo tiene, lo levanta si con él el golpe ya
 * no entra (si entra igual, no gasta el espacio para nada). Se queda +5 a la CA hasta su
 * turno (`shielded`, que lee `getTargetArmorClass`).
 *
 * @param {any} target
 * @param {{attackTotal: number, targetAc: number, magicMissile?: boolean}} attack
 * @returns {{blocked: boolean, lines: string[]}}
 */
export function shieldAgainst(target, { attackTotal, targetAc, magicMissile = false }) {
    const option = reactionFor(target, 'hit', 0);
    if (!option) return { blocked: false, lines: [] };
    const bonus = Math.max(0, Number(option.spell?.reaction?.amount) || 0);
    if (!magicMissile && attackTotal >= targetAc + bonus) return { blocked: false, lines: [] };
    const paid = payReaction(target, option);
    if (!paid.ok) return { blocked: false, lines: [] };
    combatEncounter.shielded = [...new Set([...(combatEncounter.shielded ?? []), String(target.id)])];
    const result = resolveReaction({ spell: option.spell, slotLevel: paid.slotLevel, context: { attackTotal, targetAc, magicMissile }, roll, casterName: String(target.name) });
    return { blocked: !result.hitNow, lines: [...result.lines, ...(paid.line ? [paid.line] : [])] };
}

/**
 * Lo que suma el Escudo levantado a la CA de alguien.
 *
 * @param {any} target
 * @returns {number}
 */
export function shieldBonus(target) {
    if (!combatEncounter.active || !Array.isArray(combatEncounter.shielded)) return 0;
    return combatEncounter.shielded.includes(String(target?.id)) && !isEnemy(target) ? 5 : 0;
}

/**
 * Contraconjuro: cuando un enemigo lanza un conjuro con nivel, quien del grupo lo tenga, a
 * su alcance y con la reacción sin gastar, lo corta. Los trucos se dejan pasar: no valen un
 * espacio de 3.º.
 *
 * @param {any} enemy
 * @param {any} ability Con `spellLevel` y `name`.
 * @returns {{countered: boolean, lines: string[]}}
 */
export function counterAgainst(enemy, ability) {
    if (!(Number(ability?.spellLevel) > 0)) return { countered: false, lines: [] };
    const at = boardCellOf(enemy);
    for (const member of partyMembers) {
        const from = boardCellOf(member);
        const option = reactionFor(member, 'spell', getDistanceInFeet(from.x, from.y, at.x, at.y));
        if (!option) continue;
        const paid = payReaction(member, option);
        if (!paid.ok) continue;
        const modifier = spellcastingStats(member, option.classRow).modifier;
        const result = resolveReaction({
            spell: option.spell, slotLevel: paid.slotLevel, roll, casterName: String(member.name),
            context: { spellName: String(ability.name), spellLevel: Number(ability.slotLevel) || Number(ability.spellLevel), modifier },
        });
        return { countered: Boolean(result.countered), lines: [...result.lines, ...(paid.line ? [paid.line] : [])] };
    }
    return { countered: false, lines: [] };
}
