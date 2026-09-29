/**
 * Tu gente, en el juego (J14 de wiki/ROADMAP_SIN_CONEXION.md): la charla corta, quedar con
 * alguien, quién está dónde en el pueblo, lo que abre cada vínculo y que todo eso viaje con el
 * grupo entre el gremio y las campañas.
 *
 * Las reglas están en el motor (`campaign/social.js`, `small-talk.js`, `meetups.js`,
 * `whereabouts.js` y `day-parts.js`) y la pantalla en `ui/meetup-scene.js`. Esto las junta con
 * la partida: lee las charlas y las quedadas del compendio, guarda `chat_metadata.social`,
 * suma los vínculos y pasa el reloj.
 *
 * - **Charlar** no gasta tiempo. En el pueblo se pide («Charlar con Gerd», `/charlar`); tras una
 *   pelea, al llegar a un sitio o por el camino sale sola, a veces, y se ofrece con un aviso y
 *   una ficha («Gerd quiere decirte algo»): no se abre encima de lo que se esté leyendo.
 * - **Quedar** gasta la parte del día (`/quedar`, «Quedar con alguien», o en la pantalla del
 *   pueblo). Sale su escena; al acabar, el vínculo sube y, si toca, se abre lo de su rango.
 */

import { chat_metadata, saveMetadata } from '../../script.js';
import { METADATA_KEY } from '../world-info.js';
import { SlashCommandParser } from '../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument } from '../slash-commands/SlashCommandArgument.js';
import { createSeededRandom } from '../game-engine/combat/seeded-random.js';
import { derive } from '../game-engine/campaign/seed.js';
import { SOCIAL_KEY, readSocial, keyOf, bondKeyOf, carryBonds, adoptBond } from '../game-engine/campaign/social.js';
import {
    readTalkRows, momentOf, shouldTalk, markSpontaneous, chooseSpeaker, pickTalk, answerTalk, talkScene, hasTalk, MOMENTS,
} from '../game-engine/campaign/small-talk.js';
import {
    readMeetupRows, personOf, meetupFor, renderScene, sceneOutcome, applyMeetup, recordMeetup, meetupSummary, wantsToMeet,
    bondDiscounts,
} from '../game-engine/campaign/meetups.js';
import { dayStrip } from '../game-engine/campaign/day-parts.js';
import { whoIsWhere, meetPlaces, placeLabel, socialChips } from '../game-engine/campaign/whereabouts.js';
import { normalizeCalendar, getElapsedSlots } from '../game-engine/campaign/calendar.js';
import { getBondProgress, normalizeBondState } from '../game-engine/campaign/bonds.js';
import { noteApproval } from '../game-engine/campaign/approval.js';
import { HIRELINGS } from '../game-engine/campaign/guests.js';
import { hubTrial } from '../game-engine/campaign/hub.js';
import { readReasons } from '../game-engine/rules/companions.js';
import { openMeetupScene, openMeetupPicker } from '../game-engine/ui/meetup-scene.js';
import { openPack } from '../game-engine/ui/pixel-art.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import { APPROVAL_KEY, PLOT_STATE_KEY } from './keys.js';
import { combatEncounter, currentBoardName, currentLocationName, partyMembers } from './state.js';
import { hereLocation, lastCompendium, lastConfidantEntries, lastHub, lastWorldNpcs } from './world.js';
import {
    campaignDay, getCampaignBonds, getCampaignCalendar, recordCampaignBondEvent, saveCampaignState, spendDayPart,
} from './time.js';
import { getPlot } from './plot.js';
import { changeAttitude, offerPersonalQuests } from './companions.js';
import { partyPurse, payFromParty } from './roster.js';
import { postCombatNarration } from './narration.js';
import { festivalHere } from './town.js';

/** @typedef {import('../game-engine/campaign/whereabouts.js').Here} Here */

/**
 * Lo que la pantalla del pueblo enseña de cada uno (J14.4).
 *
 * @typedef {Object} TownPerson
 * @property {string} key
 * @property {string} name
 * @property {string} kind `grupo`, `mercenario`, `confidente` o `pueblo`.
 * @property {string} place El sitio donde está (`posada`, `muelle`…).
 * @property {string} placeLabel
 * @property {boolean} canMeet Si se puede quedar con él (tu gente; la del pueblo, solo charlar).
 * @property {boolean} wantsToMeet «Quiere quedar contigo»: tiene una escena de su rango por jugar.
 * @property {string} why
 * @property {boolean} canTalk Si tiene algo que decir en una charla del pueblo.
 * @property {boolean} waiting Si tiene algo que decirte ya (una charla que salió sola).
 * @property {string} talk La orden de charlar con él.
 * @property {string} meet La orden de quedar con él.
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

// ---------------------------------------------------------------------------------------
// Lo guardado y lo escrito.

/** @returns {import('../game-engine/campaign/social.js').SocialState} Lo de tu gente en esta partida. */
export function getSocial() {
    return readSocial(chat_metadata?.[SOCIAL_KEY]);
}

/** @param {any} state */
function saveSocial(state) {
    if (!chat_metadata) return;
    chat_metadata[SOCIAL_KEY] = readSocial(state);
    saveMetadata();
}

/**
 * Las charlas y las quedadas del compendio, leídas una vez por compendio.
 *
 * @type {{from: any, talk: import('../game-engine/campaign/small-talk.js').TalkRow[], meet: ReturnType<typeof readMeetupRows>}}
 */
let rows = { from: null, talk: [], meet: { people: [], scenes: [], unlocks: [] } };

/** @returns {typeof rows} */
function socialRows() {
    if (rows.from !== lastCompendium) {
        rows = {
            from: lastCompendium,
            talk: readTalkRows(lastCompendium.find('charlas')),
            meet: readMeetupRows(lastCompendium.find('quedadas')),
        };
    }
    return rows;
}

/** @returns {ReturnType<typeof readMeetupRows>} Las quedadas de `compendio/quedadas.json`. */
export function meetupData() {
    return socialRows().meet;
}

// ---------------------------------------------------------------------------------------
// La hora, el sitio y quién es quién.

/** @returns {{id: string, label: string, advancesDay: boolean}} La parte del día de ahora. */
function slotNow() {
    const c = normalizeCalendar(getCampaignCalendar());
    return c.slots[c.slotIndex] ?? c.slots[0];
}

/** @returns {number} Las partes del día pasadas desde el principio. */
function elapsedNow() {
    return getElapsedSlots(getCampaignCalendar());
}

/**
 * El azar de lo social, con la semilla del mundo: la misma partida charla igual dos veces.
 *
 * @param {...any} parts
 * @returns {() => number}
 */
function seeded(...parts) {
    return createSeededRandom(derive(String(chat_metadata?.[METADATA_KEY] || ''), 'gente', ...parts.map(p => String(p))));
}

/** @returns {string} La campaña de aquí (`gremio`, `strahd`, `1387`): sus retratos y sus escenas. */
function campaignId() {
    return openPack(() => { if (isShellOpen()) refreshGameShell(); }) || (lastHub ? 'gremio' : '');
}

/** @param {any} member @returns {string} */
const wantsOfMember = (member) => readReasons(member).wants;

/** @returns {Set<string>} Los confidentes del mundo que aún no van contigo, por su clave. */
function confidantKeys() {
    return new Set(Object.values(lastConfidantEntries).map((/** @type {any} */ e) => keyOf(e?.dndData?.name || e?.comment)).filter(Boolean));
}

/**
 * La ficha con la que se habla o se queda con alguien de los de `whoIsWhere`.
 *
 * @param {Here} here
 * @returns {{name: string, wants: string, bondScenes?: any[]}}
 */
function personFor(here) {
    const source = here?.source ?? {};
    const scenes = Array.isArray(source.bondScenes) ? source.bondScenes : null;
    return {
        name: here.name,
        wants: here.inParty ? wantsOfMember(source) : text(source?.reasons?.wants || source?.wants),
        ...(scenes ? { bondScenes: scenes } : {}),
    };
}

/**
 * La clave de su vínculo: la de su ficha si va contigo; si no, la de la gente de aquí.
 *
 * @param {Here} here
 * @returns {string}
 */
function bondKeyForHere(here) {
    return here.inParty ? bondKeyOf(here.source) : bondKeyOf({ name: here.name });
}

/** @param {string} key @returns {number} */
function rankOf(key) {
    return getBondProgress(getCampaignBonds(), key).rank;
}

/** @returns {string} La fiesta de hoy aquí, si la hay (D-J29: ese día cierra la tienda). */
function festivalName() {
    return festivalHere()?.name ?? '';
}

/**
 * Quién de tu gente está dónde, en el pueblo de aquí y a esta hora (J14.4 y J14.6). Fuera de
 * un pueblo, o en un tablero, nadie.
 *
 * @returns {ReturnType<typeof whoIsWhere>}
 */
export function peopleHere() {
    const location = hereLocation();
    if (!location || !chat_metadata || currentBoardName) return { places: [], people: [] };
    const data = socialRows().meet;
    const social = getSocial();
    const campaign = campaignId();
    const inParty = new Set(partyMembers.map(m => keyOf(m.name)));
    const confidants = confidantKeys();
    // D-J28: hasta acabar la prueba, los mercenarios del gremio no se ofrecen; tampoco para quedar.
    const trial = lastHub ? hubTrial(getPlot(), chat_metadata?.[PLOT_STATE_KEY]) : null;
    return whoIsWhere({
        town: text(location.name),
        location,
        slot: slotNow().id,
        hub: Boolean(lastHub),
        party: partyMembers,
        townsfolk: lastWorldNpcs.filter(n => !confidants.has(keyOf(n.name))),
        confidants: Object.values(lastConfidantEntries)
            .map((/** @type {any} */ e) => ({
                name: text(e?.dndData?.name || e?.comment),
                arrivals: Array.isArray(e?.dndData?.arrivals) ? e.dndData.arrivals : [],
                bondScenes: Array.isArray(e?.dndData?.bondScenes) ? e.dndData.bondScenes : [],
                className: text(e?.dndData?.charClass),
                dead: Boolean(e?.dndData?.dead),
            }))
            .filter(c => c.name && !inParty.has(keyOf(c.name))),
        hirelings: lastHub && !trial ? HIRELINGS.filter(h => !inParty.has(keyOf(h.name))).map(h => ({ ...h })) : [],
        data,
        wantsOf: wantsOfMember,
        wants: (here) => (here.canMeet
            ? wantsToMeet({ person: personFor(here), rank: rankOf(bondKeyForHere(here)), data, social, campaign })
            : false),
        day: campaignDay(),
        festival: festivalName(),
    });
}

// ---------------------------------------------------------------------------------------
// La charla que sale sola (J14.1): se ofrece, no se impone.

/** @type {{name: string, key: string, moment: string, at: number, place: string}|null} */
let pendingTalk = null;

/** @returns {typeof pendingTalk} La charla que espera, si sigue valiendo (misma franja, mismo sitio). */
function pending() {
    if (!pendingTalk) return null;
    const stale = pendingTalk.at !== elapsedNow() || pendingTalk.place !== currentLocationName
        || !partyMembers.some(m => keyOf(m.name) === pendingTalk?.key && !m.dead);
    if (stale) pendingTalk = null;
    return pendingTalk;
}

/**
 * Tras una pelea, al llegar a un sitio o por el camino, a veces alguien de tu grupo tiene algo
 * que decir. No se abre encima de lo que se lee: sale un aviso con «Escuchar» y una ficha. Una
 * por parte del día como mucho, con la semilla del mundo.
 *
 * @param {'combat'|'arrive'|'travel'} event
 * @returns {boolean} Si alguien quiere hablar.
 */
export function offerSmallTalk(event) {
    if (!chat_metadata || combatEncounter.active || partyMembers.length < 2) return false;
    const moment = momentOf({ event, hero: partyMembers[0] });
    if (!moment) return false;
    const elapsed = elapsedNow();
    const social = getSocial();
    const random = seeded('charla-sola', moment, elapsed, currentLocationName);
    if (!shouldTalk({ moment, social, elapsed, random })) return false;
    const speaker = chooseSpeaker({ party: partyMembers, moment, rows: socialRows().talk, social, random, wantsOf: wantsOfMember });
    if (!speaker) return false;
    saveSocial(markSpontaneous(social, elapsed));
    const name = text(speaker.name);
    pendingTalk = { name, key: keyOf(name), moment, at: elapsed, place: currentLocationName };
    const toast = toastr.info(`${name.split(' ')[0]} quiere decirte algo.`, `💬 ${MOMENTS[/** @type {keyof typeof MOMENTS} */ (moment)]?.label ?? name}`, { timeOut: 15000 });
    $(toast).find('.toast-message').append($('<button type="button" class="menu_button gs-talk-listen"></button>')
        .text('Escuchar')
        .on('click', () => { void chatWith(name); }));
    if (isShellOpen()) refreshGameShell();
    return true;
}

/**
 * J14.1: después de una pelea de tablero. Gasta su parte del día (J14.2) y, si se ganó, a veces
 * alguien lo comenta. En el gremio solo se pelea en la llegada (el muelle y la bodega): esa
 * mañana no se parte en franjas, o se llegaría al pueblo de noche y con todo cerrado.
 *
 * @param {string} reason Cómo acabó (`victory`, `defeat`, `fled`…).
 * @param {{board?: string}} [where] El tablero donde se peleó.
 */
export function afterFight(reason, { board = '' } = {}) {
    if (!chat_metadata) return;
    if (text(board) && !lastHub && ['victory', 'defeat', 'fled'].includes(reason)) spendDayPart('pelea');
    if (reason === 'victory') offerSmallTalk('combat');
}

/**
 * J14.1: al llegar de viaje. Primero lo de llegar; si nadie dice nada, lo del camino.
 */
export function afterArrival() {
    if (!offerSmallTalk('arrive')) offerSmallTalk('travel');
}

/**
 * Charlar con alguien (J14.1): su charla del pueblo, o la que salió sola si es la suya. No gasta
 * tiempo; lo que contestas mueve un poco su aprobación (a los tuyos) o su trato (a la gente del
 * pueblo), una vez al día.
 *
 * @param {string} name
 * @returns {Promise<string>}
 */
export async function chatWith(name) {
    if (!chat_metadata || !partyMembers[0]) return '';
    if (combatEncounter.active) {
        toastr.warning('No mientras peleáis.');
        return '';
    }
    const wanted = keyOf(name);
    if (!wanted) {
        toastr.info('¿Con quién? Por ejemplo: /charlar Gerd', 'Charlar');
        return '';
    }
    const same = (/** @type {any} */ who) => keyOf(who) === wanted || keyOf(text(who).split(' ')[0]) === wanted;
    const waiting = pending();
    const here = peopleHere().people.find(p => same(p.name));
    const member = partyMembers.slice(1).find(m => !m.dead && same(m.name));
    const who = here ?? (member ? /** @type {Here} */ ({
        key: keyOf(member.name), name: text(member.name), kind: 'grupo', place: '', inParty: true, canMeet: true,
        wantsToMeet: false, why: '', source: member,
    }) : null);
    if (!who) {
        toastr.info(`${name} no está por aquí.`, 'Charlar');
        return '';
    }
    const moment = waiting && waiting.key === who.key ? waiting.moment : 'pueblo';
    if (waiting && waiting.key === who.key) pendingTalk = null;
    const person = personFor(who);
    const slot = slotNow();
    const picked = pickTalk({
        rows: socialRows().talk, person, moment, social: getSocial(), random: seeded('charla', who.key, elapsedNow(), moment),
        slot: slot.id, hero: partyMembers[0], party: partyMembers, place: text(currentLocationName),
    });
    if (!picked.talk) {
        toastr.info(`${who.name} no tiene nada que contarte ahora.`, 'Charlar');
        if (isShellOpen()) refreshGameShell();
        return '';
    }
    saveSocial(picked.social);
    const talk = picked.talk;
    const location = hereLocation();
    const data = socialRows().meet;
    const card = personOf(data, who.name);
    const result = await openMeetupScene({
        scene: talkScene(talk),
        person: { name: who.name, className: card?.className || text(who.source?.className || who.source?.charClass), gender: card?.gender || text(who.source?.gender) },
        pack: campaignId(),
        place: who.place,
        town: text(location?.name || currentLocationName),
        night: slot.id === 'night',
        placeLabel: who.place ? placeLabel(who.place, location) : '',
    });
    const choice = result.choices[0];
    if (!result.finished || !choice) {
        if (isShellOpen()) refreshGameShell();
        return '';
    }
    const said = answerTalk({
        talk, index: choice.reply, social: getSocial(), day: campaignDay(),
        inParty: who.inParty, id: who.inParty ? String(who.source?.id ?? '') : '', wants: person.wants,
    });
    saveSocial(said.social);
    if (said.event && who.inParty && who.source?.id !== undefined) {
        recordCampaignBondEvent(String(who.source.id), said.event);
        if (said.verdict) {
            chat_metadata[APPROVAL_KEY] = noteApproval(chat_metadata[APPROVAL_KEY], [said.verdict], campaignDay()).state;
            saveMetadata();
        }
    }
    if (said.attitude !== 0) changeAttitude(who.name, said.attitude, 'por lo que le dijiste en una charla');
    else if (said.note) toastr.info(said.note, who.name, { timeOut: 5000 });
    if (isShellOpen()) refreshGameShell();
    return said.note;
}

// ---------------------------------------------------------------------------------------
// Quedar (J14.3, J14.5, J14.6): el evento, que gasta la parte del día.

/**
 * Quedar con alguien: sin nombre, se elige con quién y dónde; con nombre, donde esté ahora.
 *
 * @param {string} [name]
 * @param {string} [place] El sitio, si se sabe (`posada`, `muelle`…).
 * @returns {Promise<string>}
 */
export async function meetSomeone(name = '', place = '') {
    if (!chat_metadata || !partyMembers[0]) return '';
    if (combatEncounter.active) {
        toastr.warning('No mientras peleáis.');
        return '';
    }
    const here = peopleHere();
    const able = here.people.filter(p => p.canMeet);
    if (able.length === 0) {
        toastr.info('Aquí y ahora no hay nadie de tu gente con quien quedar.', 'Quedar');
        return '';
    }
    const location = hereLocation();
    const slot = slotNow();
    const data = socialRows().meet;
    const wanted = keyOf(name);
    /** @type {{name: string, key: string, place: string}|null} */
    let chosen = null;
    if (wanted) {
        const person = able.find(p => p.key === wanted || keyOf(p.name.split(' ')[0]) === wanted);
        if (!person) {
            toastr.info(`${name} no está por aquí ahora.`, 'Quedar');
            return '';
        }
        chosen = { name: person.name, key: person.key, place: text(place) || person.place };
    } else {
        const places = here.places.map(p => p.id);
        chosen = await openMeetupPicker({
            people: able.map(p => {
                const card = personOf(data, p.name);
                return {
                    ...p,
                    placeLabel: placeLabel(p.place, location),
                    rankLabel: `Vínculo ${rankOf(bondKeyForHere(p))}`,
                    className: card?.className || text(p.source?.className || p.source?.charClass),
                    gender: card?.gender || text(p.source?.gender),
                };
            }),
            placesFor: (person) => meetPlaces({
                places, slot: slot.id, current: person.place, person: personOf(data, person.name), location,
                day: campaignDay(), festival: festivalName(),
            }),
            pack: campaignId(),
            slotLabel: slot.label,
        });
    }
    if (!chosen) return '';
    const who = able.find(p => p.key === chosen?.key);
    return who ? await playMeetup(who, chosen.place) : '';
}

/**
 * La quedada, jugada: su escena (o un rato juntos), lo que suma y la parte del día que se va.
 * Dejarla a medias no gasta nada.
 *
 * @param {Here} who
 * @param {string} place
 * @returns {Promise<string>}
 */
async function playMeetup(who, place) {
    const data = socialRows().meet;
    const bondKey = bondKeyForHere(who);
    const slot = slotNow();
    const hero = partyMembers[0];
    const picked = meetupFor({
        person: personFor(who), rank: rankOf(bondKey), data, talkRows: socialRows().talk, social: getSocial(),
        random: seeded('quedada', who.key, elapsedNow()), place, slot: slot.id, campaign: campaignId(), hero, party: partyMembers,
    });
    const scene = renderScene(picked.scene, { hero, party: partyMembers });
    const card = personOf(data, who.name);
    const location = hereLocation();
    /** @type {string[]} */
    let told = [];
    const result = await openMeetupScene({
        scene,
        person: { name: who.name, className: card?.className || text(who.source?.className || who.source?.charClass), gender: card?.gender || text(who.source?.gender) },
        pack: campaignId(),
        place,
        town: text(location?.name || currentLocationName),
        night: slot.id === 'night',
        placeLabel: placeLabel(place, location),
        summarize: (choices) => {
            const outcome = sceneOutcome({ scene, choices, likedPlace: Boolean(card?.likes?.includes(place)) });
            const applied = applyMeetup({ bonds: getCampaignBonds(), bondKey, outcome, data, name: who.name });
            saveCampaignState(null, applied.bonds);
            if (outcome.gold < 0) payFromParty(Math.min(-outcome.gold, partyPurse()));
            saveSocial(recordMeetup(picked.social, { name: who.name, scene, elapsed: elapsedNow(), unlocks: applied.unlocks }));
            told = meetupSummary({ name: who.name, result: applied, outcome });
            return told;
        },
    });
    if (!result.finished || told.length === 0) {
        if (isShellOpen()) refreshGameShell();
        return '';
    }
    postCombatNarration(`💞 [VÍNCULO] ${told.join(' ')}`);
    // Idea 30: quien llega a vínculo 3 te pide lo suyo.
    offerPersonalQuests();
    spendDayPart('quedar', { who: who.name });
    if (isShellOpen()) refreshGameShell();
    return told.join(' ');
}

/**
 * Si alguien de tu grupo tiene una escena a su rango por jugar: es lo que avisa, al subir de
 * rango, de que quiere quedar contigo (J14.3), en vez de contar la escena al narrador.
 *
 * @param {any} member
 * @param {number} rank
 * @returns {boolean}
 */
export function wantsToMeetAt(member, rank) {
    return wantsToMeet({
        person: { name: text(member?.name), ...(Array.isArray(member?.bondScenes) ? { bondScenes: member.bondScenes } : {}) },
        rank, data: socialRows().meet, social: getSocial(), campaign: campaignId(),
    }).wants;
}

// ---------------------------------------------------------------------------------------
// Lo que se ve: las fichas, la pantalla del pueblo y la cabecera.

/**
 * Las fichas de lo social: la charla que espera, quedar y charlar con quien está aquí. Fuera de
 * un pueblo, en un tablero o peleando, solo la charla que espera (si sigue en pie).
 *
 * @returns {Array<{id: string, label: string, icon: string, command: string}>}
 */
export function peopleChips() {
    if (!chat_metadata || combatEncounter.active) return [];
    const waiting = pending();
    const first = waiting ? [{
        id: `charla-sola:${waiting.key}`, label: `${waiting.name.split(' ')[0]} quiere decirte algo`, icon: 'fa-comment-dots', command: `/charlar ${waiting.name}`,
    }] : [];
    if (currentBoardName) return first;
    const talkRows = socialRows().talk;
    const chips = socialChips({
        people: peopleHere().people.filter(p => p.key !== waiting?.key),
        free: true,
        canTalk: (p) => hasTalk(talkRows, personFor(p), 'pueblo'),
        limit: 1,
    });
    return [...first, ...chips];
}

/**
 * J14.4: quién de tu gente está en cada sitio del pueblo, para su pantalla.
 *
 * @returns {TownPerson[]}
 */
export function townPeople() {
    if (!chat_metadata || combatEncounter.active) return [];
    const location = hereLocation();
    const talkRows = socialRows().talk;
    const waiting = pending();
    return peopleHere().people.map(p => ({
        key: p.key,
        name: p.name,
        kind: p.kind,
        place: p.place,
        placeLabel: placeLabel(p.place, location),
        canMeet: p.canMeet,
        wantsToMeet: p.wantsToMeet,
        why: p.why,
        canTalk: hasTalk(talkRows, personFor(p), 'pueblo'),
        waiting: waiting?.key === p.key,
        talk: `/charlar ${p.name}`,
        meet: `/quedar ${p.name}`,
    }));
}

/**
 * J3.11: la localización de aquí y su gente, para la pantalla del pueblo, sin que lea el mundo
 * cada quince segundos (así las muertes se ven al momento). Y J14.4: quién de tu gente está dónde.
 *
 * @returns {{location: any, npcs: any[], people: TownPerson[]}|null}
 */
export function townNow() {
    const location = hereLocation();
    if (!location) return null;
    const confidants = confidantKeys();
    return {
        location,
        // Los confidentes son para reclutar, no gente del pueblo (como `townNpcsFromEntries`).
        npcs: lastWorldNpcs.filter(n => !confidants.has(keyOf(n.name))),
        people: townPeople(),
    };
}

/**
 * J14.2: las partes del día para la cabecera: cuáles se fueron y en qué, cuál es ahora.
 *
 * @returns {ReturnType<typeof dayStrip>}
 */
export function dayStripNow() {
    if (!chat_metadata) return [];
    return dayStrip({ calendar: getCampaignCalendar(), social: chat_metadata[SOCIAL_KEY] });
}

/**
 * Los descuentos que ha abierto tu gente con su vínculo (J14.3): la forja de Gerd, la tienda de
 * Nella, la posada de Osric. Con la forma de los favores de la gente de aquí.
 *
 * @returns {ReturnType<typeof bondDiscounts>}
 */
export function bondFavors() {
    if (!chat_metadata) return [];
    const bonds = getCampaignBonds();
    return bondDiscounts(socialRows().meet, partyMembers.slice(1)
        .filter(m => !m.dead)
        .map(m => ({ name: text(m.name), rank: getBondProgress(bonds, String(m.id)).rank })));
}

// ---------------------------------------------------------------------------------------
// Que viaje con el grupo (J14.6): del gremio a una campaña y de vuelta.

/**
 * Lo de tu gente, al salir de un chat: sus vínculos y lo social, con el grupo que sale.
 *
 * @param {any[]} party
 * @returns {{bonds: any, social: any, party: any[]}}
 */
export function packPeople(party) {
    return {
        bonds: JSON.parse(JSON.stringify(getCampaignBonds())),
        social: getSocial(),
        party: (Array.isArray(party) ? party : []).map(m => ({ id: m?.id, name: m?.name })),
    };
}

/**
 * Y al llegar al otro: los vínculos pasan por el nombre (`carryBonds`), y lo social se junta.
 * Lo de cada chat (su día, la última charla, cuándo se quedó) se queda en el suyo.
 *
 * @param {{bonds: any, social: any, party: any[]}} carried
 */
export function unpackPeople(carried) {
    if (!chat_metadata || !carried) return;
    saveCampaignState(null, carryBonds({ bonds: carried.bonds, from: carried.party, to: partyMembers, here: getCampaignBonds() }));
    const here = getSocial();
    const there = readSocial(carried.social);
    /** @param {Record<string, string[]>} a @param {Record<string, string[]>} b */
    const lists = (a, b) => Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])]
        .map(k => [k, [...new Set([...(a[k] ?? []), ...(b[k] ?? [])])]]));
    saveSocial({
        ...here,
        heard: [...new Set([...here.heard, ...there.heard])],
        warmth: { ...here.warmth, ...there.warmth },
        seen: lists(here.seen, there.seen),
        opened: lists(here.opened, there.opened),
    });
}

/**
 * Cuando alguien que aún no iba contigo se une (contratas a Gerd, se une Ismark), lo que ya
 * había entre vosotros pasa a su ficha; al despedirle, vuelve a ser de la gente de aquí.
 *
 * @param {any} member
 * @param {'join'|'leave'} [how]
 */
export function carryBondOf(member, how = 'join') {
    if (!chat_metadata || !member) return;
    const loose = bondKeyOf({ name: member.name });
    const own = String(member.id ?? '');
    const bonds = normalizeBondState(getCampaignBonds());
    const [from, to] = how === 'join' ? [loose, own] : [own, loose];
    if (!from || !to || !bonds.bonds[from]) return;
    saveCampaignState(null, adoptBond(bonds, from, to));
}

// ---------------------------------------------------------------------------------------
// Las órdenes.

/** `/quedar` y `/charlar`. Las registra `registerPartyCommands`. */
export function registerSocialCommands() {
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'quedar',
        helpString: '<div>Quedar con alguien de tu gente: <code>/quedar</code> para elegir con quién y dónde, o '
            + '<code>/quedar Gerd</code>. Gasta la parte del día; sale su escena y el vínculo sube.</div>',
        unnamedArgumentList: [SlashCommandArgument.fromProps({ description: 'Con quién', typeList: [ARGUMENT_TYPE.STRING], isRequired: false })],
        callback: async (_args, value) => {
            await meetSomeone(String(value ?? ''));
            return '';
        },
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'charlar',
        helpString: '<div>Charlar un momento con alguien de tu gente o del pueblo: <code>/charlar Tomás</code>. '
            + 'No gasta tiempo; lo que contestas le parece bien o mal.</div>',
        unnamedArgumentList: [SlashCommandArgument.fromProps({ description: 'Con quién', typeList: [ARGUMENT_TYPE.STRING], isRequired: true })],
        callback: async (_args, value) => {
            await chatWith(String(value ?? ''));
            return '';
        },
    }));
}
