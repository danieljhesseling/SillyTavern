/**
 * E6 de wiki/ROADMAP_ENTRETENIDO.md: el camino entre campañas, en la partida.
 *
 * - **E6.1, el viaje con decisiones** (`game-engine/world/road-cards.js`): en un viaje de tres días
 *   o más, cada dos o tres días alguien del grupo para la marcha y pregunta (un puente caído, la
 *   ventisca, un mercader). Se pregunta en la novela, con su cara (`askInScene`), y lo que pasa lo
 *   dice quien lo hizo (`sayHere`). Lo llama `travelWithTime` (travel.js) al viajar desde «Ir a…».
 * - **E6.2, los papeles de la noche** (`game-engine/campaign/camp-roles.js`): al acampar, quién
 *   cocina, quién estudia y quién examina el botín. Lo llama `campNight` (travel.js): las filas
 *   van en la ficha de acampar, y lo que sale, por la mañana, lo dice cada uno.
 */

import { chat_metadata, saveMetadata } from '../../script.js';
import { addItemToInventory, createItem } from '../dnd-system.js';
import { askInScene } from '../game-engine/ui/vn-question.js';
import { cardDays, pickCards, askFor, resolveCard, PUSH_REST_HOURS } from '../game-engine/world/road-cards.js';
import {
    NIGHT_ROLES, NIGHT_DC, NIGHT_ROLES_KEY, suggestNightRoles, cookDinner, studyNight, appraiseLoot,
} from '../game-engine/campaign/camp-roles.js';
import { eatRations, partyRations } from '../game-engine/campaign/dungeon-camp.js';
import { identify, isUnknown } from '../game-engine/campaign/item-lore.js';
import { canLearnScroll, MAGIC_ITEMS } from '../game-engine/rules/magic-items.js';
import { spellById } from '../game-engine/rules/grimoire.js';
import { healInjuries } from '../game-engine/rules/injuries.js';
import { relieve, readNeeds } from '../game-engine/rules/needs.js';
import { rollCheck, skillModifier } from '../game-engine/rules/checks.js';
import { travelRolesOf, dutyHolder } from '../game-engine/campaign/formation.js';
import { withJob } from '../game-engine/campaign/company.js';
import { describeLootItem, declaredLootNames } from '../game-engine/combat/loot-items.js';
import { rollDiceDetailed } from './combat-rules.js';
import { partyMembers } from './state.js';
import { lastPack } from './world.js';
import { STATS_KEY } from './keys.js';
import { getPartyFormation } from './companions.js';
import { partyPurse, payFromParty, savePartyState } from './roster.js';
import { postCombatNarration, sayHere } from './narration.js';
import { noteDeed } from './world-growth.js';
import { currentSurvival } from './modes.js';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} m @returns {boolean} */
const standing = (m) => Boolean(m) && !m.dead && (Number(m.hp) || 0) > 0;

/** @param {any} m @param {string} skill @returns {number} */
const modifierOf = (m, skill) => skillModifier(m, skill).modifier;

/** @returns {number} */
const d20 = () => rollDiceDetailed('1d20', 20).total;

/**
 * Quien pregunta en una tarjeta del camino: el guía (o quien habla, para el mercader). Si ese eres
 * tú y vas acompañado, pregunta uno de los tuyos: la pregunta se te hace a ti.
 *
 * @param {'guia'|'portavoz'} role
 * @param {any[]} living
 * @returns {any}
 */
function askerFor(role, living) {
    const formation = getPartyFormation();
    let who = role === 'guia'
        ? living.find(m => text(m.id) === travelRolesOf({ formation, party: living, modifierOf }).find(r => r.role === 'guia')?.id)
        : dutyHolder(formation, 'portavoz', living);
    if (!who || (who === partyMembers[0] && living.length > 1)) who = living.find(m => m !== partyMembers[0]) ?? who;
    return who ?? living[0] ?? partyMembers[0];
}

/**
 * Lo raro que trae el mercader, como en el camino de siempre (`roadEncounter`): un objeto mágico
 * de los que hay en el mundo, a 50 de oro (menos con un buscavidas en el grupo).
 *
 * @param {() => number} random
 * @returns {{item: string, price: number}|null}
 */
function merchantOffer(random) {
    const goods = declaredLootNames().filter(name => describeLootItem(name).category === 'magic');
    if (goods.length === 0) return null;
    const item = goods[Math.floor(random() * goods.length) % goods.length];
    const price = Math.max(5, Math.round(50 * (withJob(partyMembers, 'buscavidas') ? 0.75 : 1)));
    return { item, price };
}

/**
 * Gastar raciones de la mochila de quien las lleve.
 *
 * @param {number} count
 * @returns {number} Las que se gastaron.
 */
function spendRations(count) {
    const want = Math.min(Math.max(0, Math.floor(count)), partyRations(partyMembers));
    if (want <= 0) return 0;
    const meal = eatRations(Array.from({ length: want }, () => ({ hp: 1 })), partyMembers);
    if (!meal.ok) return 0;
    for (const [member, items] of meal.items) member.items = items;
    return meal.eaten;
}

/**
 * E6.1: por el camino se come cada día (5e: comida para un día por cabeza). Lo que trae el
 * cazador si le salió; si no, una ración de la mochila de quien la lleve. Sin raciones para todos,
 * comen los que pueden y los demás pasan hambre. Antes no se comía nada por el camino y un viaje de
 * nueve días mataba de hambre aunque se llevaran raciones. Solo donde el modo cuenta el hambre.
 *
 * @param {boolean} hunted Si el cazador trae comida para todos.
 * @returns {number} Las raciones que se comieron.
 */
export function feedOnTheRoad(hunted) {
    if (!currentSurvival()?.needs) return 0;
    const mouths = partyMembers.filter(m => !m.dead && !(/** @type {any} */ (m)).summon);
    const eaten = hunted ? 0 : spendRations(mouths.length);
    mouths.forEach((member, index) => {
        if (hunted || index < eaten) member.needs = relieve(member, 'ate');
    });
    savePartyState();
    return eaten;
}

/**
 * E6.1: las tarjetas del camino. Se juegan antes de que pasen los días; lo que cuestan en días va
 * con los demás sucesos del viaje (`trip`), y lo demás (raciones, oro, daño) se paga ya.
 *
 * @param {Object} input
 * @param {string} input.to
 * @param {number} input.days Los días del viaje, al ritmo elegido.
 * @param {() => number} input.random El azar del viaje.
 * @param {any[]} input.trip Los sucesos del viaje: se añaden aquí los de las tarjetas.
 * @param {string} [input.season]
 * @param {string[]} [input.weather] El tiempo de cada día.
 * @returns {Promise<{played: string[], tired: boolean}>} `tired`: se apretó el paso (se llega sin dormir).
 */
export async function playRoadCards({ to, days, random, trip, season = '', weather = [] }) {
    const living = partyMembers.filter(standing);
    if (living.length === 0) return { played: [], tired: false };
    const offer = merchantOffer(random);
    const busy = trip.filter(event => Number(event?.days) > 0).map(event => Number(event.day));
    const cards = pickCards({ days: cardDays({ days, random }), random, purse: partyPurse(), cheapest: offer?.price, busy });
    /** @type {string[]} */
    const played = [];
    let tired = false;
    for (const { day, card } of cards) {
        const asker = askerFor(card.asker, living);
        const rations = partyRations(partyMembers);
        const ask = askFor(card, {
            day, total: days, to, rations, mouths: living.length, purse: partyPurse(), season, weather: text(weather[day - 1]), offer,
        });
        const reply = await askInScene({
            title: ask.title, who: asker, notes: ask.notes, question: ask.question,
            yes: ask.yes, no: ask.no, other: ask.other, kind: `camino-${card.id}`, pack: lastPack,
        });
        const answer = reply === 'other' ? ask.answers.other : reply ? ask.answers.yes : ask.answers.no;
        played.push(card.id);

        // Cruzar por las piedras: tira quien mejor salta.
        let doer = asker;
        let success = false;
        if (answer === 'cruzar') {
            doer = living.reduce((/** @type {any} */ top, m) => (!top || modifierOf(m, 'athletics') > modifierOf(top, 'athletics') ? m : top), null) ?? asker;
            const roll = rollCheck({ member: doer, skill: 'athletics', rollD20: d20, dc: 12 });
            if (roll) postCombatNarration(roll.said);
            success = Boolean(roll?.success);
        }
        const done = resolveCard(card, answer, { success, who: text(doer?.name), rations, mouths: living.length, offer });

        if (done.rationsLost > 0) spendRations(done.rationsLost);
        if (done.rationsEaten > 0 || done.hungry) {
            const eaten = spendRations(done.rationsEaten);
            living.forEach((member, index) => {
                if (index < eaten) member.needs = relieve(member, 'ate');
                else {
                    const needs = readNeeds(member);
                    member.needs = { ...needs, hunger: needs.hunger + 24 };
                }
            });
        }
        if (done.hurt && doer) doer.hp = Math.max(1, (Number(doer.hp) || 0) - rollDiceDetailed(done.hurt, 6).total);
        if (done.gold > 0 && !payFromParty(done.gold)) {
            // No llegó el oro (alguien lo gastó antes): no hay compra.
            trip.push({ day, id: `camino_${card.id}`, name: ask.title, note: 'El mercader no fía, y no llegaba el oro.', days: 0, climate: '' });
            continue;
        }
        if (done.item && partyMembers[0]) {
            partyMembers[0].items = partyMembers[0].items ?? [];
            addItemToInventory(/** @type {any} */ (partyMembers[0]), createItem(/** @type {any} */ (describeLootItem(done.item))));
        }
        if (done.tired) tired = true;
        savePartyState();
        trip.push({ day, id: `camino_${card.id}`, name: ask.title, note: done.note, days: done.days, climate: '' });
        sayHere(`🧭 [CAMINO] Día ${day}: ${done.note}`, text(doer?.name), done.said);
    }
    return { played, tired };
}

/**
 * E6.2: se llega sin dormir por apretar el paso. Va después de los días del camino, que dejan
 * dormido a todo el mundo cada noche (como el paso rápido).
 */
export function arriveTired() {
    for (const member of partyMembers.filter(m => !m.dead)) {
        const needs = readNeeds(member);
        member.needs = { ...needs, rest: needs.rest + PUSH_REST_HOURS };
    }
    savePartyState();
}

/**
 * E6.2: las filas de los papeles de la noche, en la ficha de acampar. Cada una, con quién lo hace;
 * se propone lo de la formación o quien mejor lo hace de los que no vigilan.
 *
 * @param {JQuery} body La ficha de acampar.
 * @param {any[]} living
 * @param {string[]} guards Los ids que vigilan (propuestos).
 * @returns {() => Record<string, string>} Lo elegido al cerrar, por papel.
 */
export function nightRolesRows(body, living, guards) {
    const duties = getPartyFormation().duties ?? {};
    const picked = suggestNightRoles({ party: living, modifierOf, chosen: duties, guards });
    body.append($('<div class="cp-sub cp-roles-title"></div>').text('Mientras los demás duermen:'));
    /** @type {Record<string, JQuery>} */
    const selects = {};
    for (const [role, spec] of Object.entries(NIGHT_ROLES)) {
        const skill = spec.skill === 'survival' ? 'Supervivencia' : 'Investigación';
        const select = $('<select></select>').addClass(`cp-role cp-role-${role}${role === 'cocinero' ? ' cp-cook' : ''}`).attr('data-role', role)
            .append($('<option value=""></option>').text('Nadie'));
        for (const member of living) {
            const mod = modifierOf(member, spec.skill);
            select.append($('<option></option>').attr('value', String(member.id)).text(`${member.name} (${skill} ${mod >= 0 ? '+' : ''}${mod})`));
        }
        select.val(picked[role] || '');
        selects[role] = select;
        body.append($('<label class="cp-row cp-role-row"></label>').attr('title', spec.does)
            .append($('<span></span>').text(`${spec.label}: `)).append(select));
    }
    return () => Object.fromEntries(Object.entries(selects).map(([role, select]) => [role, String(select.val() || '')]));
}

/**
 * E6.2: la cena de quien cocina (antes de dormir).
 *
 * @param {any} cook
 * @param {boolean} lit
 * @returns {{caught: boolean, hearty: boolean, said: string}}
 */
export function cookTonight(cook, lit) {
    if (!cook) return { caught: false, hearty: false, said: '' };
    const roll = lit ? rollCheck({ member: cook, skill: 'survival', rollD20: d20, dc: NIGHT_DC }) : null;
    if (roll) postCombatNarration(roll.said);
    return cookDinner({ cook: text(cook.name), fire: lit, success: Boolean(roll?.success) });
}

/**
 * E6.2: por la mañana, lo que deja la cena que repone: todos los dados de golpe, y un día más de
 * cura para las heridas.
 *
 * @param {any[]} living
 * @returns {string[]} Las heridas que se curaron.
 */
export function heartyMorning(living) {
    /** @type {string[]} */
    const mended = [];
    for (const member of living) {
        member.hitDiceSpent = 0;
        const patch = healInjuries(member, 1);
        if (patch.healed.length === 0 && patch.injuries.length === (Array.isArray(member.injuries) ? member.injuries.length : 0)) continue;
        member.injuries = patch.injuries;
        member.baseStats = patch.baseStats;
        Object.assign(member, patch.stats);
        for (const injury of patch.healed) mended.push(`${member.name}: ${String(injury.label).toLowerCase()}, curado.`);
    }
    savePartyState();
    return mended;
}

/**
 * E6.2: lo que hacen de noche quien estudia y quien examina el botín. Se cuenta por la mañana,
 * cada uno con sus palabras.
 *
 * @param {{erudito?: any, tasador?: any}} roles
 * @returns {string[]} Las notas, para el diario de la noche.
 */
export function studyAndAppraise({ erudito = null, tasador = null }) {
    /** @type {string[]} */
    const notes = [];
    /** @param {(item: any) => boolean} test */
    const carried = (test) => partyMembers.flatMap(m => (Array.isArray(m.items) ? m.items : []).filter(test).map((/** @type {any} */ item) => ({ m, item })));
    const unknown = carried(isUnknown);
    const scroll = erudito
        ? carried(i => MAGIC_ITEMS[/** @type {keyof typeof MAGIC_ITEMS} */ (String(i?.name))]?.kind === 'scroll' && canLearnScroll(erudito, i).ok)[0] ?? null
        : null;
    // Sin nada que mirar ni que copiar, no se dice nada: cada noche lo mismo sería ruido.
    if (erudito && (unknown.length > 0 || scroll)) {
        const roll = unknown.length > 0 ? rollCheck({ member: erudito, skill: 'investigation', rollD20: d20, dc: NIGHT_DC }) : null;
        if (roll) postCombatNarration(roll.said);
        const spell = scroll ? canLearnScroll(erudito, scroll.item).spell : '';
        const study = studyNight({
            scholar: text(erudito.name), unknown: unknown.length, success: Boolean(roll?.success),
            scroll: scroll ? text(scroll.item.name) : '', spell: spell ? (spellById(spell)?.name ?? spell) : '',
        });
        /** @type {string[]} */
        const seen = [];
        for (const { m, item } of unknown.slice(0, study.identify)) {
            const known = identify(item);
            m.items = m.items.map((/** @type {any} */ i) => (i === item ? known.item : i));
            seen.push(known.line);
        }
        if (study.learn && scroll && spell) {
            erudito.abilities = [...new Set([...(Array.isArray(erudito.abilities) ? erudito.abilities.map(String) : []), spell])];
            scroll.m.items = scroll.m.items.filter((/** @type {any} */ i) => i !== scroll.item);
            noteDeed(`${erudito.name} copió ${spellById(spell)?.name ?? spell} de un pergamino, junto al fuego.`);
        }
        const said = [study.said, ...seen].join(' ');
        notes.push(`${erudito.name} estudia de noche. ${seen.join(' ')}`.trim());
        sayHere(`📜 [CAMPAMENTO] ${erudito.name}: ${said}`, text(erudito.name), said);
    }
    if (tasador && chat_metadata) {
        const wins = Number(chat_metadata[STATS_KEY]?.wins) || 0;
        const state = chat_metadata[NIGHT_ROLES_KEY];
        const fresh = wins > (Number(state?.wins) || 0);
        const roll = fresh ? rollCheck({ member: tasador, skill: 'investigation', rollD20: d20, dc: NIGHT_DC }) : null;
        if (roll) postCombatNarration(roll.said);
        const found = appraiseLoot({
            appraiser: text(tasador.name), wins, state, success: Boolean(roll?.success),
            roll: (formula) => rollDiceDetailed(formula, 6).total,
        });
        chat_metadata[NIGHT_ROLES_KEY] = found.state;
        saveMetadata();
        if (found.gold > 0 && partyMembers[0]) partyMembers[0].gold = (Number(partyMembers[0].gold) || 0) + found.gold;
        if (found.fights > 0) {
            notes.push(found.gold > 0 ? `${tasador.name} encuentra ${found.gold} de oro en el botín.` : `${tasador.name} repasa el botín.`);
            sayHere(`💰 [CAMPAMENTO] ${tasador.name}: ${found.said}`, text(tasador.name), found.said);
        }
    }
    savePartyState();
    return notes;
}
