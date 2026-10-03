/**
 * El romance, en el juego (J14.10 de wiki/ROADMAP_SIN_CONEXION.md). Opcional: se enciende y se
 * apaga en las opciones del juego («Romance», encendido de salida), y apagado no sale nada
 * romántico: ni la pregunta, ni las citas, ni las frases de pareja, ni su línea en el final o en
 * el Salón de la fama. Lo ya vivido se guarda igual, por si se vuelve a encender.
 *
 * Las reglas están en el motor (`campaign/romance.js`) y las escenas en `compendio/romances.json`;
 * quién lo permite, en `compendio/companeros.json` (su campo `romance`). Esto lo junta con la
 * partida:
 *
 * - **Quedar** (`social.js`, `playMeetup`): si toca, la quedada es el punto de inflexión del
 *   rango 9 (D-J63), una cita o la noche (`romanceMeetup`), y al acabar se apunta lo elegido
 *   (`romanceAfterMeetup`). Con pareja, el rato juntos lleva una frase suya (de fiesta o de
 *   noche, si toca).
 * - **Lo que se ve**: junto al vínculo en el selector de quedar y en «El grupo»
 *   (`romanceLabelFor`, `romanceGlanceLine`); «quiere quedar contigo» si hay cita
 *   (`romanceWantsFor`).
 * - **Lo que queda**: la pareja entra en el Salón de la fama al serlo, y el final de una campaña
 *   la cuenta en «Qué fue de cada uno» (`coupleEndingLines`).
 * - **Viaja con el grupo** entre el gremio y las campañas (`packRomance`, `unpackRomance`).
 *
 * Guarda `chat_metadata.romances`. No hace nada al importarse.
 */

import { chat_metadata, saveMetadata, saveSettingsDebounced } from '../../script.js';
import { extension_settings } from '../extensions.js';
import { METADATA_KEY } from '../world-info.js';
import {
    ROMANCE_KEY, readRomanceState, readRomanceCards, readRomanceRows, romanceCardOf, romanceOf, romanceScene, romanceChoice,
    advanceRomance, romanceLabel, romanceWants, isCouple, couplesOf, coupleNote, withCoupleNote, coupleEpilogue, coupleHallEntry,
    mergeRomance, stageOf,
} from '../game-engine/campaign/romance.js';
import { addToHall, readHall } from '../game-engine/campaign/legacy.js';
import { readMeetupRows, personOf } from '../game-engine/campaign/meetups.js';
import { HIRELINGS } from '../game-engine/campaign/guests.js';
import { keyOf } from '../game-engine/campaign/social.js';
import { romanceOn } from '../game-engine/ui/romance-option.js';
import { partyMembers } from './state.js';
import { lastCompendium, lastCompanionStories } from './world.js';
import { withCampaignRows } from '../game-engine/campaign/companion-stories.js';
import { campaignDay } from './time.js';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

// ---------------------------------------------------------------------------------------
// Lo guardado y lo escrito.

/** @returns {import('../game-engine/campaign/romance.js').RomanceState} */
export function getRomances() {
    return readRomanceState(chat_metadata?.[ROMANCE_KEY]);
}

/** @param {any} state */
function saveRomances(state) {
    if (!chat_metadata) return;
    chat_metadata[ROMANCE_KEY] = readRomanceState(state);
    saveMetadata();
}

/**
 * Las fichas, las escenas y la gente del compendio, leídas una vez por compendio.
 *
 * @type {{from: any, own: any, cards: import('../game-engine/campaign/romance.js').RomanceCard[],
 *   rows: import('../game-engine/campaign/romance.js').RomanceData, meet: ReturnType<typeof readMeetupRows>}}
 */
let written = { from: null, own: null, cards: [], rows: { scenes: [], notes: {}, epilogues: {} }, meet: { people: [], scenes: [], unlocks: [] } };

/** @returns {typeof written} */
function romanceData() {
    // Los Gems al día: los romances de los compañeros de la campaña abierta, delante de los del compendio.
    if (written.from !== lastCompendium || written.own !== lastCompanionStories) {
        written = {
            from: lastCompendium,
            own: lastCompanionStories,
            cards: readRomanceCards(withCampaignRows(lastCompendium.find('companeros'), lastCompanionStories.companeros)),
            rows: readRomanceRows(withCampaignRows(lastCompendium.find('romances'), lastCompanionStories.romances)),
            meet: readMeetupRows(lastCompendium.find('quedadas')),
        };
    }
    return written;
}

/** @returns {any} Tu héroe: el primero que no es un invitado. */
function heroNow() {
    return partyMembers.find(m => !m.guest) ?? partyMembers[0] ?? null;
}

/**
 * Lo justo de alguien para concordar con él: su nombre y su género (de su ficha, de los
 * mercenarios del gremio o de dónde anda).
 *
 * @param {string} name
 * @returns {{name: string, gender: string}}
 */
function personCard(name) {
    const key = keyOf(name);
    const member = partyMembers.find(m => keyOf(m.name) === key);
    const hired = HIRELINGS.find(h => keyOf(h.name) === key);
    return { name: text(name), gender: text(member?.gender) || text(hired?.gender) || text(personOf(romanceData().meet, name)?.gender) };
}

// ---------------------------------------------------------------------------------------
// Quedar.

/**
 * @typedef {Object} Love Lo que el romance pone en una quedada.
 * @property {any} scene La escena que se juega en su lugar (sin pasar aún por `renderScene`).
 * @property {'senal'|'cita'|'final'|'pareja'} stage
 * @property {boolean} allowed En la señal: si su ficha te deja.
 */

/**
 * Si la quedada con alguien es de romance: la señal, una cita, la noche, o el rato de siempre
 * con una frase suya de pareja. Null si no toca (o si está apagado).
 *
 * @param {Object} input
 * @param {string} input.name
 * @param {number} input.rank Su vínculo.
 * @param {any} input.picked La quedada que tocaba (`meetupFor`): solo en un rato cabe el romance.
 * @param {string} [input.slot] La franja.
 * @param {number} [input.reaches] D-J63: el rango al que llega esta quedada (el punto de inflexión es el 9).
 * @param {boolean} [input.known] J13.7: con quien aún no se ha presentado, nunca.
 * @param {string} [input.festival] D-J63: la fiesta de hoy aquí: la frase de pareja es de fiesta.
 * @returns {Love|null}
 */
export function romanceMeetup({ name, rank, picked, slot = '', reaches = 0, known = true, festival = '' }) {
    if (!romanceOn() || !chat_metadata || !known) return null;
    const { cards, rows } = romanceData();
    const card = romanceCardOf(cards, name);
    if (!card) return null;
    const state = getRomances();
    const free = picked?.kind === 'rato';
    if (isCouple(state, card.who)) {
        // D-J63: en una fiesta o de noche, lo que te dice es de esa fiesta o de esa noche.
        const note = free ? coupleNote(rows, card.who, campaignDay(), { festival, night: slot === 'night' }) : '';
        return note ? { scene: withCoupleNote(picked, note), stage: 'pareja', allowed: true } : null;
    }
    return romanceScene({ data: rows, card, state, name: card.who, rank, hero: heroNow(), slot, free, on: true, day: campaignDay(), reaches, known });
}

/**
 * D-J63: si con alguien os toca una cita o la noche (ya en la ruta de pareja), para su saludo.
 *
 * @param {string} name
 * @param {string} [slot]
 * @returns {''|'cita'|'final'}
 */
export function romanceDateFor(name, slot = '') {
    if (!romanceOn() || !chat_metadata) return '';
    const card = romanceCardOf(romanceData().cards, name);
    if (!card) return '';
    const stage = stageOf(romanceOf(getRomances(), card.who), campaignDay());
    if (stage === 'cita') return 'cita';
    return stage === 'final' && slot === 'night' ? 'final' : '';
}

/**
 * Tras jugar una quedada de romance: lo que se eligió cambia el romance, y se cuenta. Al ser
 * pareja, entra en el Salón de la fama.
 *
 * @param {Object} input
 * @param {string} input.name
 * @param {Love|null} input.love
 * @param {any} input.scene La escena jugada (ya con el texto de tu héroe).
 * @param {Array<{beat: number, reply: number}>} input.choices
 * @returns {string[]} Lo que se añade al resumen de la quedada.
 */
export function romanceAfterMeetup({ name, love, scene, choices }) {
    if (!love || love.stage === 'pareja' || !chat_metadata) return [];
    const card = romanceCardOf(romanceData().cards, name);
    const who = card?.who || text(name);
    const result = advanceRomance(getRomances(), {
        name: who, short: card?.short, stage: love.stage, choice: romanceChoice(scene, choices), allowed: love.allowed, day: campaignDay(),
    });
    if (!result.changed) return [];
    saveRomances(result.state);
    if (result.couple) rememberCouple(who);
    return result.news;
}

/**
 * La pareja, al Salón de la fama del gremio: los dos nombres y su línea.
 *
 * @param {string} name
 */
function rememberCouple(name) {
    const settings = /** @type {any} */ (extension_settings);
    const entry = coupleHallEntry({
        data: romanceData().rows,
        name,
        hero: heroNow(),
        partner: personCard(name),
        world: text(chat_metadata?.[METADATA_KEY]),
        day: Math.max(1, campaignDay()),
        when: new Date().toISOString(),
    });
    settings.partyHall = addToHall(settings.partyHall, entry);
    saveSettingsDebounced();
}

// ---------------------------------------------------------------------------------------
// Lo que se ve.

/**
 * «Quiere quedar contigo» por el romance: si hay cita pendiente (o la noche, de noche).
 *
 * @param {string} name
 * @param {string} [slot]
 * @returns {{wants: boolean, why: string}|null}
 */
export function romanceWantsFor(name, slot = '') {
    if (!romanceOn() || !chat_metadata) return null;
    return romanceWants({ card: romanceCardOf(romanceData().cards, name), state: getRomances(), name, slot, on: true });
}

/**
 * Cómo va el romance con alguien, dicho corto (vacío si nada, o si está apagado).
 *
 * @param {string} name
 * @returns {string}
 */
export function romanceLabelFor(name) {
    if (!romanceOn() || !chat_metadata) return '';
    return romanceLabel(romanceOf(getRomances(), name));
}

/**
 * La línea de «El grupo» para un compañero (vacía si no hay romance).
 *
 * @param {any} member
 * @returns {string}
 */
export function romanceGlanceLine(member) {
    if (!member || member === partyMembers[0]) return '';
    const label = romanceLabelFor(text(member.name));
    return label ? `♥ ${label === 'Pareja' ? 'Sois pareja' : label}` : '';
}

/**
 * En qué punto está el romance con alguien, para quien quiera leerlo (sus frases, un final):
 * `senal`, `espera`, `cita`, `final`, `pareja` o `cerrado`. Vacío si está apagado o no tiene.
 *
 * @param {string} name
 * @returns {string}
 */
export function romanceStageOf(name) {
    if (!romanceOn() || !romanceCardOf(romanceData().cards, name)) return '';
    return stageOf(romanceOf(getRomances(), name), campaignDay());
}

/** @returns {string[]} Con quién es pareja tu héroe (vacío si está apagado). */
export function partnerNames() {
    return romanceOn() ? couplesOf(getRomances()) : [];
}

/**
 * El Salón de la fama como se enseña: con el romance apagado, sin las parejas.
 *
 * @param {any} raw `extension_settings.partyHall`.
 * @returns {import('../game-engine/campaign/legacy.js').HallEntry[]}
 */
export function hallShown(raw) {
    const hall = readHall(raw);
    return romanceOn() ? hall : hall.filter(entry => entry.kind !== 'couple');
}

// ---------------------------------------------------------------------------------------
// El final de la campaña.

/**
 * «Qué fue de cada uno», con la línea de la pareja en vez de la de siempre. `lines` va en el
 * orden del grupo sin el héroe (`companionEpilogues`).
 *
 * @param {string[]} lines
 * @param {{ending: string, home?: boolean}} input
 * @returns {string[]}
 */
export function coupleEndingLines(lines, { ending, home = false }) {
    const list = Array.isArray(lines) ? [...lines] : [];
    if (!romanceOn() || !chat_metadata) return list;
    const state = getRomances();
    const { rows } = romanceData();
    partyMembers.slice(1).forEach((member, index) => {
        if (index >= list.length || member?.dead || !isCouple(state, member?.name)) return;
        list[index] = coupleEpilogue({ data: rows, name: text(member.name), hero: heroNow(), partner: member, ending, home });
    });
    return list;
}

// ---------------------------------------------------------------------------------------
// Que viaje con el grupo.

/** @returns {import('../game-engine/campaign/romance.js').RomanceState} Lo de este chat, para llevarlo. */
export function packRomance() {
    return getRomances();
}

/**
 * Lo que llega de otro chat: lo de quien viaja manda.
 *
 * @param {any} carried
 */
export function unpackRomance(carried) {
    if (!chat_metadata || !carried) return;
    saveRomances(mergeRomance(getRomances(), carried));
}
