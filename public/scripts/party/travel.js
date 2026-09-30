/**
 * Viajar: lo que cuesta, lo que sale al paso, los contratiempos, las paradas, acampar,
 * forrajear, los guardias y las noticias al llegar.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import { POPUP_TYPE, Popup } from '../popup.js';
import { chat_metadata, saveMetadata } from '../../script.js';
import { getCurrentWorldLocationMaps, METADATA_KEY } from '../world-info.js';
import { addItemToInventory, createItem } from '../dnd-system.js';
import { createSeededRandom, rollWith } from '../game-engine/combat/seeded-random.js';
import { derive } from '../game-engine/campaign/seed.js';
import {
    planTravel, reachFrom, travelEvents, describeTravel, rollWeather, DEFAULT_TRAVEL_EVENTS, MIN_DAYS,
} from '../game-engine/world/travel.js';
import { newsFor, standingWith } from '../game-engine/campaign/factions.js';
import { rollDiceDetailed } from './combat-rules.js';
import { travelShortcut, watchBonus, whoCan } from '../game-engine/rules/field-uses.js';
import { petDoes } from '../game-engine/campaign/pet.js';
import { spellById, spendCharge } from '../game-engine/rules/grimoire.js';
import { mountedDays } from '../game-engine/world/mounts.js';
import { assignRoles, rollRoles, describeRoles } from '../game-engine/world/travel-roles.js';
import { seasonClimates } from '../game-engine/world/seasons.js';
import {
    canCamp, nightRisk, defaultGuards, resolveNight, campMorning, MAX_GUARDS,
} from '../game-engine/campaign/camp.js';
import { talkPairs, campTalkPrompt, makePeace } from '../game-engine/campaign/camp-talk.js';
import { guardsAt, settleGuards } from '../game-engine/campaign/crime.js';
import { seaLegs, fareFor, sailingDays, describeVoyage } from '../game-engine/world/ships.js';
import { holdDuringCombat } from '../game-engine/combat/combat-hold.js';
import { relieve, readNeeds } from '../game-engine/rules/needs.js';
import { gravesAt } from '../game-engine/campaign/legacy.js';
import { SKILLS, rollCheck, skillModifier } from '../game-engine/rules/checks.js';
import {
    PACES, readPace, paceDays, paceEvents, isSetback, setbackChoice, resolveSetback, FORCE_DC, FORCE_HURT,
    RUSH_REST_HOURS,
} from '../game-engine/world/travel-choices.js';
import { deliverNews } from '../game-engine/world/news.js';
import { listNames, daysText } from '../game-engine/campaign/engine-narrator.js';
import { roadTrouble } from '../game-engine/campaign/world-memory.js';
import { readPlotState } from '../game-engine/campaign/plot.js';
import { withJob } from '../game-engine/campaign/company.js';
import { roadEncounter, roadStop } from '../game-engine/world/road.js';
import { forageCheck, forageResult } from '../game-engine/campaign/forage.js';
import { arrivalLines } from '../game-engine/campaign/recruit.js';
import { readReasons } from '../game-engine/rules/companions.js';
import { describeLootItem, declaredLootNames } from '../game-engine/combat/loot-items.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
export { roadLine, readLineRows } from '../game-engine/campaign/companion-lines.js';
export { nightFor, recordNight, NIGHTS_KEY } from '../game-engine/campaign/nights.js';
import {
    APPROVAL_KEY, ARRIVALS_HEARD_KEY, BOARD_KEY, GRAVES_KEY, MOUNTS_KEY, NEWS_KEY, PLOT_STATE_KEY,
    RUMORS_HEARD_KEY, TAKEN_KEY, VISITED_KEY, WANTED_KEY, WEATHER_TODAY_KEY,
} from './keys.js';
import {
    combatEncounter, currentLocationName, partyMembers, setCurrentBoardName, setCurrentLocationName, setTalkingTo,
} from './state.js';
import { currentPet, petMeetsTown } from './pet.js';
import {
    campaignCompendium, currentSeason, enemiesInSeason, hereLocation, lastConfidantEntries, lastRumors,
    lastWorldNpcs, saveCurrentBoard, saveCurrentLocation, weatherHere,
} from './world.js';
import { friendlyFactions, getCurrentWorldFactions, rulerOf } from './factions.js';
import {
    advanceCampaignDay, campaignDay, getCampaignCalendar, getCurrentSlotLabel, recordCampaignBondEvent, spendDayPart,
    takeRest,
} from './time.js';
import { afterArrival } from './social.js';
import { notePlot, openMilestones } from './plot.js';
import { noteDeed, populatePlace, worldWrite } from './world-growth.js';
import { numberWord, playSucesos, postCombatNarration, postForModel, showTip, tellMoment } from './narration.js';
import { partyPurse, payFromParty, savePartyState } from './roster.js';
import { judgeDecision } from './companions.js';
import { countStat } from './menus.js';
import { alarmBonus } from './rituals.js';

/**
 * Lo que el narrador del motor sabe de un sitio al llegar: cómo es, a qué hora, con qué
 * tiempo, quién hay y qué os espera.
 *
 * @param {string} name
 * @param {boolean} first La primera vez que se llega.
 * @returns {Record<string, any>}
 */
function placeFacts(name, first) {
    const same = (/** @type {any} */ a) => String(a ?? '').toLowerCase() === String(name).toLowerCase();
    const place = /** @type {any} */ (getCurrentWorldLocationMaps().find((/** @type {any} */ l) => same(l.name)) ?? {});
    const people = lastWorldNpcs.filter(n => !n.dead && same(n.where)).slice(0, 3).map(n => n.name);
    const hooks = [];
    if (openMilestones().some(m => same(m?.asks?.place))) hooks.push('el hilo pasa por aquí');
    if (same(chat_metadata?.[TAKEN_KEY]?.locationName)) hooks.push('aquí está vuestro encargo');
    const offered = (chat_metadata?.[BOARD_KEY] ?? []).filter((/** @type {any} */ c) => same(c?.locationName)).length;
    if (offered > 0) hooks.push(offered === 1 ? 'hay un encargo en el tablón' : `hay ${numberWord(offered)} encargos en el tablón`);
    const heardIds = Array.isArray(chat_metadata?.[RUMORS_HEARD_KEY]) ? chat_metadata[RUMORS_HEARD_KEY] : [];
    const unheard = lastRumors.filter(r => same(r.where) && !heardIds.includes(r.id)).length;
    if (unheard > 0) hooks.push(unheard === 1 ? 'alguien tiene algo que contar' : 'se oyen cosas que valdría la pena escuchar');
    return {
        sitio: String(place.name || name),
        descripcion: first ? String(place.description || '') : '',
        primera: first ? 'sí' : 'no',
        hora: String(getCurrentSlotLabel() || '').toLowerCase(),
        tiempo: weatherHere(),
        gente: listNames(people),
        gente_n: people.length,
        gancho: listNames(hooks),
    };
}

/**
 * Idea 68: cazar y forrajear. Gasta un bloque del dia; tira quien mejor mire.
 *
 * @returns {string}
 */
export function runForage() {
    if (combatEncounter.active) {
        toastr.warning('No mientras peleáis.');
        return '';
    }
    const where = hereLocation();
    const allowed = forageCheck(where ?? {});
    if (!where || !allowed.allowed) {
        toastr.info(allowed.why || 'Aquí no hay dónde buscar.');
        return '';
    }
    const standing = partyMembers.filter(m => (Number(m.hp) || 0) > 0);
    // Idea 41: si hay rastreador, sale el, y con ventaja.
    const tracker = withJob(partyMembers, 'rastreador');
    const best = tracker ?? standing.reduce((/** @type {any} */ top, m) =>
        (!top || skillModifier(m, 'perception').modifier > skillModifier(top, 'perception').modifier ? m : top), null);
    if (!best) return '';
    const d20 = () => (tracker
        ? Math.max(rollDiceDetailed('1d20', 20).total, rollDiceDetailed('1d20', 20).total)
        : rollDiceDetailed('1d20', 20).total);
    const roll = rollCheck({ member: best, skill: 'perception', rollD20: d20, dc: allowed.dc });
    const result = forageResult({ success: Boolean(roll?.success), who: String(best.name) });
    for (const member of partyMembers) {
        if (result.ate) member.needs = relieve(member, 'ate');
        if (result.drank) member.needs = relieve(member, 'drank');
    }
    savePartyState();
    // J14.2: la cabecera dice en qué se fue la parte del día.
    spendDayPart('forrajear', { label: 'Cazar y forrajear' });
    if (roll) postCombatNarration(roll.said);
    postCombatNarration(`🌿 [CAMPO] ${result.line}`);
    toastr.info(result.line, 'Cazar y forrajear', { timeOut: 7000 });
    if (isShellOpen()) refreshGameShell();
    return result.line;
}

/**
 * Contar al llegar lo que se comenta aqui de lo que paso lejos.
 *
 * @param {string} place
 * @returns {Promise<void>}
 */
async function tellArrivalNews(place) {
    if (!chat_metadata || !place) return;
    const today = Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1));
    const locations = getCurrentWorldLocationMaps();
    const { told, pending } = deliverNews(
        chat_metadata[NEWS_KEY],
        list => newsFor({ events: list, here: place, locations, factions: getCurrentWorldFactions() }),
        today,
    );
    chat_metadata[NEWS_KEY] = pending;
    saveMetadata();
    if (told.length === 0) return;
    for (const line of told) {
        toastr.info(line, `Se comenta en ${place}`, { timeOut: 8000 });
        // Idea 95: lo que se sabe del mundo queda en la cronica.
        noteDeed(`Se supo en ${place}: ${line.replace(/^Hace \d+ día\(s\): /, '')}`);
    }
    await postForModel([
        `[NOTICIAS] Al llegar a ${place}, se comenta:`,
        ...told.map(line => `- ${line}`),
        'Cuéntalo como lo que se oye al llegar, en una o dos frases. No inventes nada más.',
    ].join('\n'));
}

/**
 * Idea 67: si aquí se puede acampar.
 *
 * @returns {{ok: boolean, reason: string}}
 */
export function campHere() {
    const here = hereLocation();
    return canCamp({ locationType: String(here?.locationType ?? here?.type ?? ''), fighting: combatEncounter.active });
}

/**
 * Idea 67: acampar. El fuego, las guardias, con quién se charla y si se busca cena; y lo
 * que pase de noche. Luego se duerme como un descanso largo.
 *
 * @returns {Promise<string>}
 */
export async function campNight() {
    const allowed = campHere();
    if (!currentLocationName || !allowed.ok) {
        toastr.info(allowed.reason || 'Aquí no se acampa.', 'Acampar');
        return '';
    }
    const here = hereLocation();
    const living = partyMembers.filter(m => !m.dead && (Number(m.hp) || 0) > 0);
    const perception = (/** @type {any} */ m) => skillModifier(m, 'perception').modifier;
    const suggested = defaultGuards(living, perception);
    const weather = weatherHere();

    const body = $('<div class="cp-root"></div>');
    body.append($('<h3></h3>').text(`Acampar en ${currentLocationName}`));
    if (weather) body.append($('<p class="cp-weather"></p>').text(`Hoy: ${weather}.`));
    const fire = $('<input type="checkbox" class="cp-fire">').prop('checked', true);
    body.append($('<label class="cp-row"></label>').append(fire)
        .append($('<span></span>').text(' Encender fuego: abriga y deja cocinar, pero se ve de lejos.')));
    body.append($('<div class="cp-sub"></div>').text(`Quién hace guardia (hasta ${MAX_GUARDS}):`));
    for (const member of living) {
        const box = $('<input type="checkbox" class="cp-guard">').attr('value', String(member.id))
            .prop('checked', suggested.includes(String(member.id)));
        const mod = perception(member);
        body.append($('<label class="cp-row"></label>').append(box)
            .append($('<span></span>').text(` ${member.name} (Percepción ${mod >= 0 ? '+' : ''}${mod})`)));
    }
    const talk = $('<select class="cp-talk"></select>').append($('<option value=""></option>').text('Nadie: cada uno a lo suyo'));
    for (const member of living.slice(1)) talk.append($('<option></option>').attr('value', String(member.id)).text(member.name));
    body.append($('<label class="cp-row"></label>').append($('<span></span>').text('Charlar junto al fuego con: ')).append(talk));
    // Idea 31: que charlen dos del grupo entre ellos.
    const pair = $('<select class="cp-pair"></select>').append($('<option value=""></option>').text('Nadie'));
    for (const [a, b] of talkPairs(living.length > 0 ? [partyMembers[0], ...living.filter(m => m !== partyMembers[0])] : [])) {
        pair.append($('<option></option>').attr('value', `${a.id}|${b.id}`).text(`${a.name} y ${b.name}`));
    }
    if (pair.children().length > 1) {
        body.append($('<label class="cp-row"></label>').append($('<span></span>').text('Que charlen entre ellos: ')).append(pair));
    }
    const cook = $('<input type="checkbox" class="cp-cook">').prop('checked', true);
    body.append($('<label class="cp-row"></label>').append(cook)
        .append($('<span></span>').text(' Buscar algo que cenar (Supervivencia, CD 12)')));
    const ok = await new Popup(body[0], POPUP_TYPE.CONFIRM, '', { okButton: 'Pasar la noche', cancelButton: 'Mejor no' }).show();
    if (!ok) return '';

    const lit = Boolean(fire.prop('checked'));
    const guardIds = body.find('.cp-guard:checked').map((_, el) => String($(el).val())).get().slice(0, MAX_GUARDS);
    const guards = living.filter(m => guardIds.includes(String(m.id)));
    const friend = living.find(m => String(m.id) === String(talk.val() || ''));
    const chat31 = String(pair.val() || '').split('|');
    const wantsDinner = Boolean(cook.prop('checked'));
    /** @type {string[]} */
    const lines = [];

    // La cena: con fuego, lo que se encuentre.
    let caught = false;
    if (wantsDinner && lit) {
        const cooker = living.reduce((/** @type {any} */ top, m) => (!top || skillModifier(m, 'survival').modifier > skillModifier(top, 'survival').modifier ? m : top), null);
        const roll = cooker ? rollCheck({ member: cooker, skill: 'survival', rollD20: () => rollDiceDetailed('1d20', 20).total, dc: 12 }) : null;
        if (roll) {
            postCombatNarration(roll.said);
            caught = roll.success;
        }
    }

    // La noche: el sitio, el fuego y de quién es la tierra.
    const ruler = rulerOf(currentLocationName);
    const hostile = Boolean(ruler) && standingWith(getCurrentWorldFactions(), String(ruler.id)) < 0;
    const random = createSeededRandom(derive(String(chat_metadata?.[METADATA_KEY] || ''), 'noche', currentLocationName, String(campaignDay())));
    const beasts = enemiesInSeason().map((/** @type {any} */ e) => String(e?.name || '')).filter(Boolean);
    const night = resolveNight({
        // R4: una Luz alumbra como un fuego, aunque no lo haya.
        risk: nightRisk({ locationType: String(here?.locationType ?? here?.type ?? ''), fire: lit || Boolean(whoCan(living, 'campLight')), hostile }),
        guards,
        random,
        rollD20: () => rollDiceDetailed('1d20', 20).total,
        // R3: quien sabe dar la voz hace mejor guardia.
        // R5: la mascota también vigila. J19.8: y el ritual Alarma, si se puso para esta noche.
        perceptionOf: (/** @type {any} */ m) => perception(m) + watchBonus(living).amount + (petDoes(currentPet(), 'guardia') ? 2 : 0) + alarmBonus(),
        purse: partyPurse(),
        intruder: beasts.length > 0 ? beasts[Math.floor(random() * beasts.length) % beasts.length] : '',
    });
    if (night.loss) payFromParty(night.loss.amount);
    if (night.watch) postCombatNarration(`🎲 Guardia de ${night.watch.name}: ${night.watch.total} contra ${night.watch.dc} ${night.watch.success ? '✓' : '✗'}`);
    lines.push(night.line);

    // La charla.
    if (friend) {
        recordCampaignBondEvent(String(friend.id), 'shared_downtime');
        lines.push(`${partyMembers[0]?.name ?? 'Alguien'} y ${friend.name} hablan hasta tarde${lit ? ' junto al fuego' : ''}.`);
    }

    // Idea 31: la charla entre dos, y las paces si chocaron hoy.
    const [pa, pb] = [living.find(m => String(m.id) === chat31[0]), living.find(m => String(m.id) === chat31[1])];
    if (pa && pb && chat_metadata) {
        const last = (chat_metadata[APPROVAL_KEY]?.frictions ?? []).filter((/** @type {any} */ f) => [f.a, f.b].includes(String(pa.id)) && [f.a, f.b].includes(String(pb.id))).pop();
        const peace = makePeace(chat_metadata[APPROVAL_KEY], String(pa.id), String(pb.id), campaignDay());
        chat_metadata[APPROVAL_KEY] = peace.state;
        lines.push(`${pa.name} y ${pb.name} charlan junto al fuego${peace.mended ? ', y hacen las paces' : ''}.`);
        void postForModel(campTalkPrompt({ a: pa, b: pb, wantsOf: m => readReasons(m).wants, friction: String(last?.line ?? '') }));
    }

    // Y se duerme.
    await takeRest('largo');
    const morning = campMorning({ party: living, fire: lit, weather, cook: wantsDinner, caught });
    for (const id of morning.restless) {
        const member = partyMembers.find(m => String(m.id) === id);
        if (!member) continue;
        const needs = readNeeds(member);
        member.needs = { ...needs, rest: needs.rest + RUSH_REST_HOURS };
    }
    if (morning.fed) for (const member of living) member.needs = relieve(member, 'ate');
    lines.push(...morning.lines);
    savePartyState();

    const said = lines.join(' ');
    postCombatNarration(`🏕️ [CAMPAMENTO] ${said}`);
    toastr.info(lines.join('\n'), '🏕️ La noche', { timeOut: 12000 });
    void postForModel(`[CAMPAMENTO] Noche en ${currentLocationName}. ${said} Cuéntalo en un párrafo. No inventes nada que no esté aquí.`);
    if (isShellOpen()) refreshGameShell();
    return said;
}

/**
 * Idea 96: si en este sitio os buscan, os paran los guardias al llegar: multa o huir.
 *
 * @param {string} place
 * @param {boolean} ask Si hay a quien preguntar (el `/go` escrito no pregunta: paga si llega).
 * @returns {Promise<void>}
 */
async function stopAtGuards(place, ask) {
    if (!chat_metadata) return;
    const stop = guardsAt(chat_metadata[WANTED_KEY], place);
    if (!stop.stop) return;
    let pay = partyPurse() >= stop.fine;
    if (ask) {
        const body = $('<div class="tr-setback"></div>');
        body.append($('<h3></h3>').text('Los guardias'));
        body.append($('<p></p>').text(`En ${place} os tienen apuntados (buscados: ${stop.level}). O pagáis ${stop.fine} de oro, o salís corriendo.`));
        const picked = await new Popup(body[0], POPUP_TYPE.TEXT, '', {
            okButton: false, cancelButton: false,
            customButtons: [
                ...(partyPurse() >= stop.fine ? [{ text: `Pagar ${stop.fine} de oro`, result: 61, classes: ['gd-pay'] }] : []),
                { text: 'Huir', result: 62, classes: ['gd-flee'] },
            ],
        }).show();
        pay = picked === 61;
    }
    if (pay && payFromParty(stop.fine)) {
        chat_metadata[WANTED_KEY] = settleGuards(chat_metadata[WANTED_KEY], place, 'pay');
        postCombatNarration(`🛡️ [CAMPAÑA] Los guardias de ${place} os paran: pagáis ${stop.fine} de oro y queda saldado.`);
    } else {
        chat_metadata[WANTED_KEY] = settleGuards(chat_metadata[WANTED_KEY], place, 'flee');
        postCombatNarration(`🛡️ [CAMPAÑA] Los guardias de ${place} os paran y salís corriendo: ahora os buscan más.`);
    }
    savePartyState();
    saveMetadata();
    void postForModel(`[GUARDIAS] En ${place} os paran los guardias por lo que robasteis. ${pay ? 'Pagáis la multa.' : 'Huis.'} Cuéntalo en dos frases.`);
}

/**
 * A dónde se puede ir desde aquí, de un solo camino: los vecinos abiertos.
 *
 * @returns {string[]}
 */
export function neighbourPlaces() {
    const reach = reachFrom({
        from: currentLocationName, locations: getCurrentWorldLocationMaps(),
        friendly: friendlyFactions(), season: currentSeason(), done: readPlotState(chat_metadata?.[PLOT_STATE_KEY]).done,
    });
    return Object.entries(reach).filter(([, way]) => way.reach === 'near').map(([name]) => name);
}

/**
 * Lo que cuesta el viaje, antes de gastarlo.
 *
 * No es un aviso de cortesia: los dias de camino curan, dan hambre y acercan la cuenta
 * semanal, asi que un viaje de cinco dias es una decision. Se ensena por donde se pasa
 * porque esa es la mitad de la decision: el rodeo corto o el largo que evita el paso.
 *
 * @param {{to: string, days: number, legs: string[]}} plan
 * @returns {Promise<string|false>} El ritmo elegido, o `false` si no se va.
 */
export async function askBeforeTravelling(plan) {
    const jornadas = plan.days === 1 ? 'un día de camino' : `${plan.days} días de camino`;
    const por = plan.legs.length > 1
        ? `Se pasa por ${plan.legs.slice(0, -1).join(', ')}.`
        : 'Se va directo.';

    showTip('travel');
    // Idea 64: el ritmo es una decision. Cada boton dice lo que cuesta.
    const body = $('<div class="tr-ask"></div>');
    body.append($('<h3></h3>').text(`Viajar a ${plan.to}`));
    body.append($('<p></p>').text(`${jornadas} a paso normal. ${por} Por el camino se come, se cura y corre la semana.`));
    body.append($('<p class="tr-ask-hint"></p>').text('¿A qué ritmo?'));
    const ids = Object.keys(PACES);
    const popup = new Popup(body[0], POPUP_TYPE.TEXT, '', {
        okButton: false,
        cancelButton: 'Ahora no',
        customButtons: ids.map((id, i) => {
            const pace = PACES[/** @type {keyof typeof PACES} */ (id)];
            const days = paceDays(plan.days, id);
            return {
                text: `${pace.label} · ${days} ${days === 1 ? 'día' : 'días'}`,
                tooltip: pace.note,
                result: 10 + i,
                classes: [`tr-pace-${id}`],
            };
        }),
    });
    const answer = Number(await popup.show()) - 10;
    return answer >= 0 && answer < ids.length ? ids[answer] : false;
}

/**
 * Ideas 88 y 92: lo que sale al paso por el camino, y lo que se hace con ello.
 *
 * @param {() => number} random El azar del viaje, con la semilla del mundo.
 * @returns {Promise<any|null>} El suceso, para contarlo con el resto del viaje.
 */
async function meetOnTheRoad(random) {
    const goods = declaredLootNames().filter(name => describeLootItem(name).category === 'magic');
    const met = roadEncounter({
        factions: getCurrentWorldFactions(),
        goods,
        random,
        discount: withJob(partyMembers, 'buscavidas') ? 0.25 : 0,
    });
    if (!met) return null;
    // R4: con Paso sin rastro, los cazarrecompensas no os encuentran. Gasta la carga.
    const hider = met.kind === 'bounty' ? whoCan(partyMembers, 'hideTrail') : null;
    if (hider) {
        const spell = spellById(hider.id);
        if (spell) hider.who.spellCharges = spendCharge(hider.who, spell.circle);
        savePartyState();
        return { day: 1, id: 'paso_sin_rastro', name: 'Paso sin rastro', note: `${hider.who.name} borra vuestro rastro: la gente de ${/** @type {any} */ (met).faction} pasa de largo.`, days: 0, climate: '' };
    }
    const body = $('<div class="tr-setback"></div>');
    if (met.kind === 'bounty') {
        body.append($('<h3></h3>').text('Cazarrecompensas'));
        body.append($('<p></p>').text(`Gente de ${met.faction} os corta el paso: hay precio por vuestras cabezas.`));
        const purse = partyPurse();
        const picked = await new Popup(body[0], POPUP_TYPE.TEXT, '', {
            okButton: false,
            cancelButton: false,
            customButtons: [
                ...(purse >= met.toll ? [{ text: `Pagar ${met.toll} de oro`, result: 41, classes: ['rd-pay'] }] : []),
                { text: `Plantar cara (Intimidación, CD ${met.dc})`, result: 42, classes: ['rd-face'] },
            ],
        }).show();
        if (picked === 41 && payFromParty(met.toll)) {
            judgeDecision('pagar');
            return { day: 1, id: 'cazarrecompensas', name: 'Cazarrecompensas', note: `Pagasteis ${met.toll} de oro para que os dejaran pasar.`, days: 0, climate: '' };
        }
        judgeDecision('plantar-cara');
        const who = partyMembers.filter(m => (Number(m.hp) || 0) > 0)
            .reduce((/** @type {any} */ top, m) => (!top || skillModifier(m, 'intimidation').modifier > skillModifier(top, 'intimidation').modifier ? m : top), null);
        const roll = who ? rollCheck({ member: who, skill: 'intimidation', rollD20: () => rollDiceDetailed('1d20', 20).total, dc: met.dc }) : null;
        if (roll) postCombatNarration(roll.said);
        if (roll?.success) {
            noteDeed(`${who.name} hizo darse la vuelta a unos cazarrecompensas de ${met.faction}.`);
            return { day: 1, id: 'cazarrecompensas', name: 'Cazarrecompensas', note: `${who.name} les planta cara y se dan la vuelta.`, days: 0, climate: '' };
        }
        const hurt = rollDiceDetailed('1d8', 8).total;
        if (who) who.hp = Math.max(1, (Number(who.hp) || 0) - hurt);
        savePartyState();
        return { day: 1, id: 'cazarrecompensas', name: 'Cazarrecompensas', note: `No se asustan: hay pelea, ${who?.name ?? 'alguien'} se lleva ${hurt} de daño y perdéis un día escapando.`, days: 1, climate: '' };
    }
    body.append($('<h3></h3>').text('Un mercader en el camino'));
    body.append($('<p></p>').text(`Trae ${met.item}, y os lo deja en ${met.price} de oro.`));
    const buy = await new Popup(body[0], POPUP_TYPE.TEXT, '', {
        okButton: false,
        cancelButton: false,
        customButtons: [
            ...(partyPurse() >= met.price ? [{ text: `Comprarlo (${met.price} de oro)`, result: 51, classes: ['rd-buy'] }] : []),
            { text: 'Seguir el camino', result: 52, classes: ['rd-pass'] },
        ],
    }).show();
    if (buy === 51 && payFromParty(met.price) && partyMembers[0]) {
        partyMembers[0].items = partyMembers[0].items ?? [];
        addItemToInventory(/** @type {any} */ (partyMembers[0]), createItem(/** @type {any} */ (describeLootItem(met.item))));
        savePartyState();
        return { day: 1, id: 'mercader', name: 'Un mercader', note: `Le comprasteis ${met.item} por ${met.price} de oro.`, days: 0, climate: '' };
    }
    return { day: 1, id: 'mercader', name: 'Un mercader', note: `Traía ${met.item}; seguisteis de largo.`, days: 0, climate: '' };
}

/**
 * Idea 66: cada contratiempo que retrasa se decide. Rodear cuesta sus dias; forzar el
 * paso es una tirada de Atletismo de quien mejor la tenga.
 *
 * @param {any[]} events
 * @returns {Promise<any[]>}
 */
async function decideSetbacks(events) {
    /** @type {any[]} */
    const out = [];
    for (const event of events) {
        // El peaje de una faccion ya trae su decision (pagar o rodear), y los atajos no se eligen.
        if (!isSetback(event) || String(event.id ?? '').startsWith('peaje_')) {
            out.push(event);
            continue;
        }
        const choice = setbackChoice(event, SKILLS.athletics.label);
        const body = $('<div class="tr-setback"></div>');
        body.append($('<h3></h3>').text(`Día ${event.day}: ${choice.title}`));
        body.append($('<p></p>').text(event.note));
        const picked = await new Popup(body[0], POPUP_TYPE.TEXT, '', {
            okButton: false,
            cancelButton: false,
            customButtons: [
                { text: choice.detour, result: 21, classes: ['tr-detour'] },
                { text: choice.force, result: 22, classes: ['tr-force'] },
            ],
        }).show();

        if (picked !== 22) {
            out.push({ ...event, ...resolveSetback(event, 'detour') });
            continue;
        }
        const standing = partyMembers.filter(m => (Number(m.hp) || 0) > 0);
        const best = standing.reduce((/** @type {any} */ top, m) =>
            (!top || skillModifier(m, 'athletics').modifier > skillModifier(top, 'athletics').modifier ? m : top), null);
        if (!best) {
            out.push({ ...event, ...resolveSetback(event, 'detour') });
            continue;
        }
        const roll = rollCheck({ member: best, skill: 'athletics', rollD20: () => rollDiceDetailed('1d20', 20).total, dc: FORCE_DC });
        const hurt = roll?.success ? 0 : rollDiceDetailed(`1d${FORCE_HURT}`, FORCE_HURT).total;
        // En el camino no se muere: se llega peor.
        if (hurt > 0) best.hp = Math.max(1, (Number(best.hp) || 0) - hurt);
        const done = resolveSetback(event, 'force', { success: Boolean(roll?.success), who: String(best.name), hurt });
        if (roll) postCombatNarration(roll.said);
        out.push({ ...event, days: done.days, note: done.note });
    }
    return out;
}

/**
 * Ir a otro sitio, con lo que cuesta.
 *
 * El mundo es una **lista**: la distancia no se mide en casillas, se declara en dias. Y
 * los dias pasan por el mismo reloj que cura, da de comer y cobra la semana, asi que un
 * viaje largo **se paga en comida**. Eso es lo que hace que elegir ruta sea una decision.
 *
 * Por el camino pasan cosas. Lo que devuelve la tabla son hechos ya decididos —con sus
 * dias de retraso contados— y el narrador los cuenta: el motor decide, el modelo narra.
 *
 * Devuelve **el motivo**, no un texto vacio: no viajar tiene cuatro causas distintas
 * —hay pelea, ese sitio no existe, no hay camino, o te lo has pensado mejor— y las cuatro
 * se veian igual desde fuera. Quien llama decide como contarlo; avisar aqui y ademas alli
 * era como `/go` acababa diciendo dos cosas, una de ellas falsa.
 *
 * @param {string} name
 * @param {{confirm?: (plan: any) => Promise<boolean|string>}} [options] Si pregunta, puede
 *   devolver el ritmo elegido; y entonces tambien se deciden los contratiempos.
 * @returns {Promise<{to: string, reason: string, via?: string}>} `via`: si el sitio no es vecino,
 *   por dónde se empieza.
 */
export async function travelWithTime(name, options = {}) {
    // Z1: la primera vez que se llega a un sitio, el narrador lo describe.
    const visitedBefore = Array.isArray(chat_metadata?.[VISITED_KEY]) ? [...chat_metadata[VISITED_KEY]] : [];
    // La misma regla que apaga la pestana de Exploracion: si solo se cerraran los botones,
    // `/go` seguiria sacandote de la pelea.
    const held = holdDuringCombat(combatEncounter, 'travel');
    if (held) return { to: '', reason: held };

    const locations = getCurrentWorldLocationMaps();
    const wanted = String(name || '').trim();
    const match = locations.find(l => String(l.name).toLowerCase() === wanted.toLowerCase());
    if (!match) {
        // Y con los nombres que si valen: un nombre mal escrito se arregla solo si se ve.
        const hay = locations.map((/** @type {any} */ l) => String(l.name)).filter(Boolean);
        return {
            to: '',
            reason: hay.length > 0
                ? `No hay ningún sitio que se llame "${wanted}". Hay: ${hay.join(', ')}.`
                : `No hay ningún sitio que se llame "${wanted}".`,
        };
    }

    // Un paso cerrado por alguien que te debe una se abre para ti: es donde de verdad se
    // nota haberse ganado a alguien.
    const plan = planTravel({
        from: currentLocationName,
        to: match.name,
        locations,
        friendly: friendlyFactions(),
        // Idea 74: el lago helado solo se cruza en invierno.
        season: currentSeason(),
        // U7: lo que la historia tiene que abrir antes (`cerrado_hasta` en el guion).
        done: readPlotState(chat_metadata?.[PLOT_STATE_KEY]).done,
        // De vecino en vecino: a lo que queda más lejos se llega pasando por en medio.
        directOnly: true,
    });
    // El motivo, no un boton que no hace nada: "el paso esta cerrado" es una meta.
    if (!plan.ok) return { to: '', reason: plan.reason, ...(plan.via ? { via: plan.via } : {}) };

    // Pensarselo mejor no es un fallo: sin motivo, nadie avisa de nada.
    let pace = 'normal';
    if (options.confirm) {
        const answer = await options.confirm({ ...plan, to: match.name });
        if (!answer) return { to: '', reason: '' };
        if (typeof answer === 'string') pace = readPace(answer);
    }

    // Los sucesos del camino, con la semilla del mundo: el mismo viaje sale igual dos
    // veces, que es lo unico que la semilla promete.
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    const compendium = await campaignCompendium();
    const hasWorld = compendium.has('mundo');
    const table = hasWorld ? compendium.find('mundo', { kind: 'suceso' }) : [];
    // Idea 130: si algún tramo es por mar y llega para el pasaje, se navega.
    const seaCount = seaLegs(locations, currentLocationName, plan.legs);
    const fare = seaCount > 0 ? fareFor({ heads: partyMembers.filter(m => !m.dead).length, days: plan.days }) : 0;
    const sailing = seaCount > 0 && payFromParty(fare);
    if (seaCount > 0 && !sailing) toastr.info(`No llega para el pasaje (${fare} de oro): se va por tierra.`, 'El puerto');

    // Por donde se va y que tiempo admite: en una cueva no nieva, y eso lo dice la
    // bateria, no este codigo.
    const biome = String(match.biome || '');
    // Idea 74: y el tiempo de la estación.
    const climates = hasWorld
        ? seasonClimates(compendium.find('mundo', { kind: 'bioma', biome })[0]?.climates ?? [], currentSeason())
        : [];

    const random = createSeededRandom(derive(worldName, 'viaje', currentLocationName, match.name));
    const weather = hasWorld
        ? rollWeather({
            days: plan.days,
            table: compendium.find('mundo', { kind: 'clima' }),
            climates,
            random,
        })
        : [];

    const events = sailing ? [] : travelEvents({
        days: plan.days,
        table: table.length > 0 ? table : DEFAULT_TRAVEL_EVENTS,
        biome,
        weather,
        random,
    });

    // Quien os tiene ganas y manda por donde pasais os para: peaje, o rodeo.
    const trouble = sailing ? null : roadTrouble({ factions: getCurrentWorldFactions(), places: plan.legs, purse: partyPurse() });
    if (trouble?.toll) payFromParty(trouble.toll);
    if (trouble) {
        events.push({ day: 1, id: `peaje_${trouble.faction}`, name: trouble.name, note: trouble.note, days: trouble.days, climate: '' });
    }

    // El ritmo: con cuidado se esquivan contratiempos; y cada uno que queda se decide, si
    // hay a quien preguntar (el `/go` escrito no pregunta nada).
    const paced = paceEvents(events, pace, random);
    // Idea 65: quien guía, quien vigila y quien caza, cada uno con su tirada. Con su propia
    // semilla, para no mover el resto del viaje.
    const roleRandom = createSeededRandom(derive(worldName, 'papeles', currentLocationName, match.name, String(campaignDay())));
    const roles = rollRoles({
        roles: assignRoles({
            party: partyMembers.filter(m => !m.dead && (Number(m.hp) || 0) > 0),
            modifierOf: (m, skill) => skillModifier(m, skill).modifier,
        }),
        rollD20: () => 1 + (Math.floor(roleRandom() * 20) % 20),
        days: plan.days,
    });
    if (roles.dodge) {
        const index = paced.events.findIndex(event => isSetback(event));
        if (index >= 0) paced.avoided.push(String(paced.events.splice(index, 1)[0]?.name ?? 'un contratiempo'));
    }
    // R5: el halcón ve el camino desde arriba y os aparta de un contratiempo.
    if (petDoes(currentPet(), 'explora')) {
        const index = paced.events.findIndex(event => isSetback(event));
        if (index >= 0) paced.avoided.push(`${String(paced.events.splice(index, 1)[0]?.name ?? 'un contratiempo')} (lo vio ${currentPet()?.name})`);
    }
    const trip = options.confirm ? await decideSetbacks(paced.events) : paced.events;
    // Ideas 88 y 92: cazarrecompensas o un mercader, si hay a quien preguntar.
    if (options.confirm && !sailing) {
        const met = await meetOnTheRoad(random);
        if (met) trip.push(met);
    }
    // Idea 71: una parada por el camino, con el azar del viaje.
    const stop = roadStop({ days: plan.days, random });

    // Un atajo resta y una tormenta suma, pero un viaje nunca dura menos de un dia:
    // llegar antes de salir no lo cuenta nadie.
    const delay = trip.reduce((sum, event) => sum + event.days, 0);
    // Idea 129: con montura para todos se llega antes. Idea 65: y un buen guía ahorra un día.
    const ride = sailing ? { days: sailingDays(paceDays(plan.days, pace)), saved: 0, note: '' } : mountedDays({
        days: paceDays(plan.days, pace),
        mounts: chat_metadata?.[MOUNTS_KEY],
        riders: partyMembers.filter(m => !m.dead).length,
    });
    // R3: quien sabe leer el rastro encuentra el atajo (y se suma al buen guía de la idea 65).
    const shortcut = sailing ? null : travelShortcut(partyMembers, ride.days + delay - (roles.dayLess ? 1 : 0));
    const total = Math.max(MIN_DAYS, shortcut ? shortcut.days : ride.days + delay - (roles.dayLess ? 1 : 0));

    // Z4: de dónde se sale, para los sucesos del camino.
    const previousPlace = currentLocationName;
    setCurrentLocationName(match.name);
    setCurrentBoardName('');
    saveCurrentLocation();
    saveCurrentBoard();
    // El grupo viaja entero. Sin esto, cada uno seguía «estando» en el sitio de antes, y al
    // entrar en un tablero de aquí no aparecía nadie.
    for (const member of partyMembers.filter(m => !m.dead)) {
        member.mapPosition = { ...(member.mapPosition ?? { gridX: 0, gridY: 0 }), locationName: match.name };
    }
    savePartyState();
    countStat('trips');
    notePlot({ kind: 'arrive', place: match.name });
    void populatePlace(match.name);

    // El reloj de uno en uno: cada dia cura, pasa hambre y acerca la cuenta semanal. Un
    // salto de cinco dias de golpe se saltaria cuatro de esos.
    for (let day = 0; day < total; day++) {
        advanceCampaignDay();
        // Por el camino se duerme de noche y se bebe de la cantimplora; comer es otra cosa
        // (las raciones, el cazador). Antes, cada día de viaje contaba veinticuatro horas
        // despierto y sin beber, y un viaje de cuatro días mataba de sed o de sueño aunque se
        // saliera comido y descansado. El paso rápido sigue debiendo el sueño al llegar.
        for (const member of partyMembers.filter(m => !m.dead)) {
            member.needs = relieve(member, 'slept');
            member.needs = relieve(member, 'drank');
        }
    }

    // A paso rapido se llega sin haber dormido.
    if (pace === 'rapido') {
        for (const member of partyMembers) {
            const needs = readNeeds(member);
            member.needs = { ...needs, rest: needs.rest + RUSH_REST_HOURS };
        }
        savePartyState();
    }
    // Idea 65: el cazador da de comer a todos por el camino.
    if (roles.fed) {
        for (const member of partyMembers.filter(m => !m.dead)) member.needs = relieve(member, 'ate');
        savePartyState();
    }
    // Ideas 73 y 90: el tiempo de hoy aquí es el del último día del camino.
    if (chat_metadata && weather.length > 0) {
        chat_metadata[WEATHER_TODAY_KEY] = { day: Math.max(1, campaignDay()), place: match.name, weather: weather[weather.length - 1] };
        saveMetadata();
    }
    // Idea 144: al irse del sitio se acaba la conversación.
    setTalkingTo('');
    // Idea 71: lo que da la parada, después de los días, para que no lo borren.
    if (stop) trip.push({ day: Math.max(1, total), id: `parada_${stop.id}`, name: stop.name, note: takeRoadStop(stop, random), days: 0, climate: '' });
    // Idea 82: lo que se comenta aqui, de lo que paso lejos. Detras de los dias en la fila,
    // para que ya este lo de hoy.
    void worldWrite(() => tellArrivalNews(match.name));
    // Idea 45: lo que dicen los confidentes al llegar a un sitio suyo.
    sayArrivals(match.name);
    // T3: y la gente con oficio de aquí ve a la mascota por primera vez.
    petMeetsTown(match.name);
    // Idea 96: si aquí os buscan, os paran.
    await stopAtGuards(match.name, Boolean(options.confirm));
    // Idea 36: quien está enterrado aquí.
    for (const grave of gravesAt(chat_metadata?.[GRAVES_KEY], match.name)) {
        toastr.info(grave.epitaph, `🪦 Aquí está enterrado ${grave.name}`, { timeOut: 8000 });
    }

    const told = [pace === 'normal' ? describeTravel(plan) : `${PACES[readPace(pace)].label}: ${total} día(s)`];
    if (paced.avoided.length > 0) told.push(`esquivado: ${paced.avoided.join(', ')}`);
    if (delay > 0) told.push(`${delay} de retraso`);
    else if (delay < 0) told.push(`${-delay} menos de lo previsto`);
    if (weather.length > 0) told.push(`tiempo: ${[...new Set(weather)].join(', ')}`);
    if (ride.note) told.push(ride.note);
    if (roles.results.length > 0) told.push(describeRoles(roles.results));
    if (shortcut?.line) told.push(shortcut.line);
    if (sailing) told.push(describeVoyage({ fare, days: total }));
    // Idea 192: el camino se ve pasar, sin parar el juego.
    if (options.confirm) showTravelTransition(match.name, total);
    toastr.info(told.join(' · '), `Llegáis a ${match.name}`);

    for (const event of trip) {
        toastr.info(event.note, `Día ${event.day}: ${event.name}`, { timeOut: 6000 });
    }

    // Y el narrador se entera, por el canal que el modelo lee de verdad. Un mensaje de
    // sistema lo veria quien juega y no lo veria el modelo, que es justo al reves.
    const note = [
        `El grupo viaja hasta ${match.name}. ${describeTravel(plan)}.`,
        pace !== 'normal' ? `Van a paso ${PACES[readPace(pace)].label.toLowerCase()}: ${total} día(s). ${PACES[readPace(pace)].note}` : '',
        paced.avoided.length > 0 ? `Vieron venir y esquivaron: ${paced.avoided.join(', ')}.` : '',
        weather.length > 0 ? `El tiempo, día a día: ${weather.join(', ')}.` : '',
        roles.results.length > 0 ? `En el camino: ${describeRoles(roles.results)}.` : '',
        shortcut?.line ?? '',
        ride.note ? `Van montados: ${ride.note}.` : '',
        sailing ? `Van ${describeVoyage({ fare, days: total })}.` : '',
        ...trip.map(event => `Día ${event.day}: ${event.name}. ${event.note}`),
        'Cuenta el viaje en un párrafo breve. No inventes nada que no esté aquí.',
    ].filter(Boolean).join('\n');
    // Z1: si cuenta el motor, el viaje y la llegada en prosa.
    const lowerFirst = (/** @type {string} */ s) => (s ? s[0].toLocaleLowerCase('es') + s.slice(1) : s);
    const road = tellMoment('viaje', {
        destino: match.name,
        dias: total,
        dias_texto: daysText(total),
        tiempo: String(weather[weather.length - 1] ?? ''),
        sucesos: trip.length > 0 ? `${trip.map(event => lowerFirst(String(event.note || event.name).replace(/\.$/, ''))).join('; ')}.` : '',
    });
    const arrival = tellMoment('llegada', placeFacts(match.name, !visitedBefore.includes(match.name)));
    postForModel(note, { show: [road, arrival].filter(Boolean).join('\n\n') }).catch(error => console.error('[party] travel note failed', error));
    // Z4: lo que hubo que decidir por el camino, y lo que espera al llegar (o lo que vuelve).
    playSucesos('viaje', { destino: match.name, sitio: previousPlace || match.name, tiempo: String(weather[weather.length - 1] ?? ''), bioma: biome }, total);
    playSucesos('llegada', { sitio: match.name });
    // J14.1: al llegar (o de lo que pasó por el camino), a veces alguien del grupo tiene algo que decir.
    afterArrival();

    return { to: match.name, reason: '' };
}

/**
 * Idea 192: el viaje se ve pasar: el nombre del sitio y los días, en una franja que se va sola.
 * No para nada ni pide nada; solo es para que el tiempo se note.
 *
 * @param {string} to
 * @param {number} days
 */
function showTravelTransition(to, days) {
    document.querySelectorAll('.tr-transition').forEach(el => el.remove());
    const box = $('<div class="tr-transition" aria-hidden="true"></div>');
    box.append($('<div class="tr-transition-title"></div>').text(`Camino de ${to}`));
    const track = $('<div class="tr-transition-days"></div>');
    for (let day = 1; day <= Math.min(days, 7); day++) {
        track.append($('<span class="tr-transition-day"></span>').text(`Día ${day}`).css('animation-delay', `${(day - 1) * 0.25}s`));
    }
    box.append(track);
    $('body').append(box);
    setTimeout(() => box.remove(), 1400 + Math.min(days, 7) * 250);
}

/**
 * Idea 71: lo que da una parada del camino. Toca números que ya existen: la sed, el hambre,
 * el sueño, la vida.
 *
 * @param {{id: string, name: string, note: string, relieve: Array<'ate'|'drank'|'slept'>, heal: string, cost: number}} stop
 * @param {() => number} random El azar del viaje: el mismo camino cura lo mismo.
 * @returns {string} Lo que se cuenta.
 */
function takeRoadStop(stop, random) {
    const alive = partyMembers.filter(m => !m.dead);
    const bill = stop.cost * alive.length;
    if (bill > 0 && !payFromParty(bill)) return `${stop.note} Pero no llega el oro, y seguís de largo.`;
    for (const member of alive) {
        for (const what of stop.relieve) member.needs = relieve(member, what);
        if (stop.heal) {
            const maxHp = Number(member.maxHp) || 0;
            member.hp = Math.min(maxHp || Infinity, (Number(member.hp) || 0) + rollWith(stop.heal, random).total);
        }
    }
    savePartyState();
    return bill > 0 ? `${stop.note} (${bill} de oro)` : stop.note;
}

/**
 * Idea 45: lo que dice cada confidente que va en el grupo al llegar a un sitio suyo. Una vez
 * por confidente y sitio; la voz es del guionista, así que no llama al modelo.
 *
 * @param {string} place
 */
function sayArrivals(place) {
    if (!chat_metadata) return;
    const lines = arrivalLines({
        party: partyMembers, entries: lastConfidantEntries, place,
        heard: chat_metadata[ARRIVALS_HEARD_KEY],
    });
    if (lines.length === 0) return;
    chat_metadata[ARRIVALS_HEARD_KEY] = [...(chat_metadata[ARRIVALS_HEARD_KEY] ?? []), ...lines.map(l => l.key)];
    saveMetadata();
    for (const said of lines) {
        postCombatNarration(`💬 ${said.name}: «${said.line}»`);
        toastr.info(`«${said.line}»`, `💬 ${said.name}`, { timeOut: 8000 });
    }
}
