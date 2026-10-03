/**
 * Lo que se cuenta: las líneas del motor y las del modelo, los sucesos, los consejos, quién
 * narra (motor, mixto o modelo), el chat plegado, las caras de quien habla, la guardia de los
 * dados y lo que no cuadra con el motor.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import { POPUP_TYPE, Popup } from '../popup.js';
import { getSystemMessageByType, sendSystemMessage, system_message_types } from '../system-messages.js';
import {
    getThumbnailUrl, chat, chat_metadata, saveMetadata, eventSource, event_types, addOneMessage,
    saveChatConditional, substituteParams, system_avatar, online_status, setExtensionPrompt,
    extension_prompt_types, extension_prompt_roles, characters as stCharacters, this_chid, setSendButtonState,
} from '../../script.js';
import { getMessageTimeStamp } from '../RossAscends-mods.js';
import { getCurrentWorldLocationMaps, METADATA_KEY } from '../world-info.js';
import { createSeededRandom } from '../game-engine/combat/seeded-random.js';
import { getCompendium } from '../game-engine/compendio/browser.js';
import { derive } from '../game-engine/campaign/seed.js';
import { rollDice, rollDiceDetailed } from './combat-rules.js';
import { playCue } from '../game-engine/ui/shell/action-sounds.js';
import { loadAudioSettings } from '../game-engine/ui/shell/scene-audio.js';
import { speakerOf, initialsOf, hueOf } from '../game-engine/ui/shell/speakers.js';
import { readFaceChoice, faceHue } from '../game-engine/campaign/face-choice.js';
import { relieve } from '../game-engine/rules/needs.js';
import { readGraves } from '../game-engine/campaign/legacy.js';
import { SKILLS, rollCheck, DEFAULT_DC } from '../game-engine/rules/checks.js';
import { buildRecap, recapSaid } from '../game-engine/campaign/guidance.js';
import { splitModelNote } from '../game-engine/campaign/model-note.js';
import { narrate as narrateMoment, rememberUsed, listNames } from '../game-engine/campaign/engine-narrator.js';
import { countedName, sucesoProse } from '../game-engine/campaign/narration-notes.js';
import { noteProse } from '../game-engine/campaign/narration-prose.js';
import { voiceNote, voiceArrivalHook } from '../game-engine/campaign/narration-voices.js';
import { hashOf } from '../game-engine/campaign/human-lines.js';
import { servicesOf } from '../game-engine/campaign/services.js';
import { tagLength } from '../game-engine/ui/shell/engine-tags.js';
import { currentTownPlace } from '../game-engine/ui/shell/town-scene.js';
import { resolveGender } from '../game-engine/campaign/grammar.js';
import { readCases, cluesHere } from '../game-engine/campaign/cases.js';
import { readTaggedLine, foldPlan, describeFold } from '../game-engine/campaign/chronicle.js';
import { focusOf } from '../game-engine/campaign/plot.js';
import { addRoll } from '../game-engine/campaign/dice-log.js';
import {
    sucesoCount, pickSucesos, sucesoById, optionView, resolveOption, readSucesoState, noteSuceso, dueFollowUp,
    describeEffect,
} from '../game-engine/campaign/sucesos.js';
import { mergeSucesoRows, sucesoWorld, readSucesoEffect, describeWorldEffect } from '../game-engine/campaign/suceso-triggers.js';
import { factionWorldOn } from '../game-engine/campaign/factions.js';
import { laterRows, scheduleFollows } from '../game-engine/campaign/aftermath.js';
import { visitorFollow } from '../game-engine/campaign/guild-memory.js';
import { planTip, nextQueuedTip } from '../game-engine/ui/shell/tips.js';
import { memoryLines } from '../game-engine/campaign/memories.js';
import { promptKey } from '../game-engine/cost/prompt-order.js';
import { lineToEntry } from '../game-engine/ui/combat-log.js';
import { buildGameMessage, CHANNEL } from '../game-engine/ui/chat-channel.js';
import { firstArt } from '../game-engine/ui/pixel-art.js';
import { guardRolls, guardImpossibleRolls, describeCorrections } from '../game-engine/combat/roll-guard.js';
import { findContradictions, appendContradictions } from '../game-engine/ui/contradiction-log.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import {
    CASES_KEY, COLORBLIND_KEY, CONTRADICTIONS_KEY, DEEDS_KEY, DICE_LOG_KEY, FAME_KEY, GRAVES_KEY, MEMORIES_KEY,
    NARRATOR_FONT_KEY, NARRATOR_MODE_STORAGE, NARRATOR_RECENT_KEY, PLOT_KEY, PLOT_STATE_KEY, ROLL_GUARD_KEY, SAVER_KEY,
    STORY_WINDOWS_STORAGE, SUCESOS_KEY, SUCESOS_STORAGE, TAKEN_KEY, TIPS_SEEN_KEY, localFlag,
} from './keys.js';
import { combatEncounter, currentLocationName, currentWorldFactions, partyMembers, worldItemCatalogue } from './state.js';
import { addItemToInventory, createItem } from '../dnd-system.js';
import { describeLootItem } from '../game-engine/combat/loot-items.js';
import { lastDialogues } from './world.js';
import { petReact } from './pet.js';
import { revealClue } from './cases.js';
import {
    actsOnItsOwn, getAttackableEnemiesForMember, getCurrentActingMember, getCurrentTurnEntry,
} from './combat-state.js';
import { pushCombatLogEntry, pushCombatLogLines } from './combat-log.js';
import {
    announceOpenedRoads, currentSeason, getLocationBoards, giveWorldKey, guildVisitorRows, hereLocation, lastCampaignSucesos, lastCompendium,
    lastHub, lastHubHome, lastPack, lastWorldNpcs,
} from './world.js';
import { pushFactionClock, rulerOf, shiftFactionStanding } from './factions.js';
import { silentNow } from './silent.js';
import {
    advanceCampaignDay, advanceCampaignSlot, campaignDay, getCampaignCalendar, getCurrentSlotLabel,
    recordCampaignBondEvent,
} from './time.js';
import { getPlot } from './plot.js';
import { savePartyState, partyPurse, payFromParty } from './roster.js';
import { hearRumor, raiseFame, rumorsLeftHere } from './town.js';
import { hearLine, shownName, shownText } from '../game-engine/ui/shown-names.js';

/**
 * How strictly the engine polices dice the model writes.
 *
 * `impossible` is the default because its corrections are never debatable: a 1d20+5
 * cannot total 30, whoever wrote it. `strict` hands every die to the engine, which is
 * the stronger reading of "the model narrates, the engine decides", at the price of
 * overriding totals that were fine.
 *
 * @returns {'off'|'impossible'|'strict'}
 */
export function getRollGuardMode() {
    const mode = chat_metadata?.[ROLL_GUARD_KEY];
    return (mode === 'off' || mode === 'strict') ? mode : 'impossible';
}

/**
 * Corrects fabricated dice totals in a message the model just produced.
 *
 * @param {number} messageId
 */
export function applyRollGuard(messageId) {
    const mode = getRollGuardMode();
    if (mode === 'off') return;

    const message = chat[messageId];
    if (!message || message.is_user || message.is_system || !message.mes) return;
    // Lines this engine wrote are already the engine's own rolls.
    if (message.extra?.model === 'game-engine') return;

    const guard = mode === 'strict' ? guardRolls : guardImpossibleRolls;
    const result = guard(message.mes, (/** @type {string} */ formula) => rollDice(formula, 20));
    if (result.corrections.length === 0) return;

    message.mes = result.text;
    postCombatNarration(describeCorrections(result.corrections) || '');
}

/**
 * J1.4: quién juega, para que el texto concuerde (`campaign/grammar.js`): tu héroe, el
 * grupo que sigue en pie y, por su hueco, quien del grupo se nombre en la frase
 * (`{quien}`, `{companero}`…).
 *
 * @param {Record<string, any>} [facts] Los huecos de la frase, si los hay.
 * @returns {Record<string, any>}
 */
export function whoPlays(facts = {}) {
    const hero = partyMembers.find(m => !m.guest) ?? partyMembers[0];
    const standing = partyMembers.filter(m => !m.dead);
    /** @type {Record<string, any>} */
    const who = { heroe: hero?.gender ?? '', grupo: (standing.length > 0 ? standing : partyMembers).map(m => m.gender ?? '') };
    for (const [key, value] of Object.entries(facts ?? {})) {
        const named = typeof value === 'string' && value.trim() ? partyMembers.find(m => m.name === value.trim()) : null;
        if (named) who[key] = named.gender ?? '';
    }
    return who;
}

/**
 * Un texto del motor con cada `{cansado|cansada}` ya concordado con quien juega. Por aquí
 * pasa todo lo que sale al chat, así que ninguna marca llega a verse.
 *
 * @param {string} text
 * @returns {string}
 */
function sayGendered(text) {
    return resolveGender(text, whoPlays());
}

/**
 * Send a compact combat narration line to chat, for the player only.
 *
 * System messages are stripped from the prompt, so every line posted here is free. That
 * is deliberate for the blow-by-blow: the engine already decided it, and paying the model
 * to re-read it would buy nothing. Anything the model has to know goes through
 * postForModel instead.
 *
 * @param {string} text
 * @param {{moment?: string}} [options] `moment`: el momento del narrador que cuenta (`descanso`,
 *   `semana`, `acto`). J13.9: sin conexión, si no lo dice nadie que esté allí, no sale (`quietMoment`).
 */
export function postCombatNarration(text, options = {}) {
    if (typeof text !== 'string' || !text.trim()) return;
    text = sayGendered(text);
    pushCombatLogLines(text);
    // J13.1: sin modelo, lo que se lee es la nota contada («Le toca a Irene.», no «Turno de
    // Irene (Jugador)»). El mensaje guarda la de siempre, con sus datos, para el modelo.
    // Con el género otra vez, por si la frase contada trae «{solo|sola}».
    const prose = narratorMode() === 'motor' ? sayGendered(noteProse(text.trim(), { key: String(chat.length) })) : '';
    // D-J54: y sin modelo, la dice quien está allí (la tendera, el posadero, uno de los tuyos),
    // sale como aviso corto o no sale en la caja, si ya se ve en pantalla.
    const voice = narratorMode() === 'motor' ? voiceOf(text.trim(), prose) : null;
    if (voice && voice.mode !== 'notice') {
        postVoiced(text.trim(), prose, voice);
        petReact(text);
        return;
    }
    // J13.9 (D-J60): el narrador no cuenta el descanso, la semana ni el cierre de un acto sin
    // conexión. Queda en el registro, pero no sale ni en la caja ni en el aviso de fuera.
    if (quietMoment(options?.moment)) {
        postVoiced(text.trim(), prose, { mode: 'quiet', text: '' });
        petReact(text);
        return;
    }
    // J13.7: el aviso no nombra a quien aún no se ha presentado («lo pide la tendera del mercado»).
    const told = prose ? shownText(prose, { mask: true }) : '';
    if (!told || told === text.trim()) {
        sendSystemMessage(system_message_types.GENERIC, text.trim(), {
            isSmallSys: true,
            isNarrator: true,
        });
    } else {
        // La versión contada va en un `extra` propio: el de los mensajes de sistema es un solo
        // objeto que comparten todos (`getSystemMessageByType`), y ponérsela ahí se la pondría
        // a todas las notas del chat a la vez.
        const message = getSystemMessageByType(system_message_types.GENERIC, text.trim(), { isSmallSys: true, isNarrator: true });
        message.extra = { ...message.extra, display_text: told };
        chat.push(message);
        addOneMessage(message);
        setSendButtonState(false);
    }
    // R5: la mascota, a veces, dice algo de lo que acaba de pasar. Gratis: es del motor.
    petReact(text);
}

/** D-J54: dónde se durmió el último descanso (`techo`, `cielo`), para saber quién da los buenos días. */
let lastRestUnder = '';

/** D-J54: cuántas frases de cada clase `voz-*` se han dicho ya, para que vayan por turnos sin repetirse. */
const voiceTurns = new Map();

/**
 * D-J54: quién está ahora para decir una nota: quien atiende cada sitio de aquí, el sitio del
 * pueblo abierto, los tuyos que siguen en pie y dónde se durmió.
 *
 * @returns {import('../game-engine/campaign/narration-voices.js').VoiceScene}
 */
function voiceScene() {
    const here = String(currentLocationName || '').toLowerCase();
    /** @type {Record<string, {name: string, gender: string}>} */
    const keepers = {};
    for (const npc of /** @type {any[]} */ (lastWorldNpcs)) {
        const service = String(npc?.service || '');
        if (!service || npc.dead || String(npc.where || '').toLowerCase() !== here || keepers[service]) continue;
        keepers[service] = { name: String(npc.name), gender: String(npc.gender || '') };
    }
    const hero = partyMembers.find(m => !m.guest) ?? partyMembers[0];
    const person = (/** @type {any} */ m) => ({ name: String(m?.name || ''), gender: String(m?.gender || '') });
    // Tanda 22: quien aún no habla (Grimm, hasta el rango 8) no cuenta nada; lo suyo, con un gruñido.
    const silent = partyMembers.filter(m => m !== hero && silentNow(m)).map(m => String(m.name));
    return {
        keepers,
        services: hereLocation() ? servicesOf(hereLocation()) : [],
        open: currentTownPlace(),
        // Los mercenarios y quien se escolta también están, y también hablan.
        companions: partyMembers.filter(m => m !== hero && !m.dead && (Number(m.hp) || 0) > 0 && !silent.includes(String(m.name))).map(person),
        party: partyMembers.map(person),
        silent,
        hero: hero ? person(hero) : null,
        restUnder: lastRestUnder,
    };
}

/**
 * Tanda 22 (D-J60): quién dice algo que se ve aquí (lo que sale al mirar, una trampa a la vista):
 * `prefer` si está aquí (alguien de la gente del sitio o de los tuyos que ya hable), si no uno de
 * los tuyos que hable (el mismo para la misma `seed`), y a solas, alguien de la gente de aquí.
 * Vacío si no hay nadie: entonces va al aviso de fuera de la caja.
 *
 * @param {{prefer?: string, seed?: string, party?: boolean}} [input] `party`: solo uno de los tuyos
 *   (lo que pasa al huir o al esconderse no lo dice la gente del sitio).
 * @returns {string}
 */
export function sayerHere({ prefer = '', seed = '', party = false } = {}) {
    const here = String(currentLocationName || '').toLowerCase();
    const people = /** @type {any[]} */ (lastWorldNpcs).filter(npc => npc && !npc.dead && String(npc.where || '').toLowerCase() === here);
    const scene = voiceScene();
    const wanted = String(prefer || '').trim().toLowerCase();
    if (wanted) {
        const found = people.find(npc => String(npc.name).toLowerCase() === wanted)
            ?? (scene.companions ?? []).find(c => String(c.name).toLowerCase() === wanted);
        if (found) return String(found.name);
    }
    const companions = (scene.companions ?? []).filter(c => String(c?.name || ''));
    if (companions.length > 0) return String(companions[hashOf(String(seed)) % companions.length].name);
    return !party && people[0] ? String(people[0].name) : '';
}

/**
 * Tanda 22 (D-J60): quién dice algo escrito con `who`: «{companero}» es uno de los tuyos que hable
 * (el mismo para la misma `seed`); a solas, nadie (vacío: va al aviso de fuera de la caja).
 *
 * @param {string} who
 * @param {string} [seed]
 * @returns {string}
 */
export function speakerFor(who, seed = '') {
    const said = String(who || '').trim();
    return said === '{companero}' ? sayerHere({ seed, party: true }) : said;
}

/**
 * Tanda 22 (D-J60): una nota del motor que dice alguien que está allí (el compañero que ve una
 * trampa): en la caja, con su placa y su cara; la nota queda para el Diario y el registro. Sin
 * nadie, o con conexión, la nota de siempre.
 *
 * @param {string} note La nota, con su etiqueta («👁️ [TABLERO] …»).
 * @param {string} who
 * @param {string} said Lo que dice, con sus palabras.
 * @param {{mood?: string}} [options]
 */
export function sayHere(note, who, said, { mood = '' } = {}) {
    if (!String(who || '').trim() || !String(said || '').trim() || narratorMode() !== 'motor') {
        postCombatNarration(note);
        return;
    }
    pushCombatLogLines(note);
    postVoiced(note, '', { mode: 'line', who: String(who), text: String(said), ...(mood ? { mood } : {}) });
}

/** Tanda 22: cómo sale en una quedada quien atiende cada servicio, por lo que es. */
const STAND_IN_ROLES = {
    posada: ['el tabernero', 'la tabernera', 'el posadero', 'la posadera'],
    tienda: ['el tendero', 'la tendera'],
    herreria: ['el herrero', 'la herrera'],
    templo: ['el sacerdote', 'la sacerdotisa'],
};

/**
 * Tanda 22: quién hace aquí de tabernero, de tendero…: en una quedada, «el tabernero» que habla
 * es el que lleva la posada de aquí, y sale con su cara (`guestPortrait`).
 *
 * @returns {Record<string, string>} Por lo que es, en minúsculas: su nombre.
 */
export function standInsHere() {
    const keepers = voiceScene().keepers ?? {};
    /** @type {Record<string, string>} */
    const out = {};
    for (const [service, roles] of Object.entries(STAND_IN_ROLES)) {
        const name = String(keepers[service]?.name || '');
        if (name) for (const role of roles) out[role] = name;
    }
    return out;
}

/**
 * D-J54: cómo llega una nota a quien juega sin modelo: quién la dice, un aviso o nada.
 *
 * @param {string} note La nota con su etiqueta.
 * @param {string} told La nota contada, que es el aviso si nadie la dice.
 * @returns {import('../game-engine/campaign/narration-voices.js').VoicedNote}
 */
function voiceOf(note, told) {
    return voiceNote(note, { told, ...voiceInput() });
}

/**
 * D-J54: con qué se elige quién habla y su frase: quién está, el banco, la partida y los turnos.
 *
 * @returns {{scene: import('../game-engine/campaign/narration-voices.js').VoiceScene, rows: any[], seed: string, turn: (kind: string) => number, who: Record<string, any>}}
 */
function voiceInput() {
    return {
        scene: voiceScene(),
        rows: lastCompendium?.has?.('frases') ? lastCompendium.find('frases', {}) : [],
        seed: String(chat_metadata?.[METADATA_KEY] || ''),
        turn: (kind) => {
            const n = voiceTurns.get(kind) ?? 0;
            voiceTurns.set(kind, n + 1);
            return n;
        },
        who: whoPlays(),
    };
}

/** D-J54: lo que conviene saber del sitio al que se llega, para decirlo después de la llegada. */
/** @type {{hook: string, arrival: string}|null} */
let pendingHook = null;

/**
 * D-J54: al llegar, lo que conviene saber del sitio («aquí está vuestro encargo») lo dice uno de
 * los tuyos; a solas, un aviso corto. No va al Diario: es una pista, no algo que pasó.
 *
 * @param {string} hook
 */
function sayArrivalHook(hook) {
    const voice = voiceArrivalHook(hook, voiceInput());
    if (voice.mode === 'quiet') return;
    const note = voice.text;
    if (voice.mode === 'line') postVoiced(note, '', voice);
    else pushSystemNote(note, { display_text: shownText(sayGendered(note), { mask: true }), told: '' });
}

/**
 * Un aviso del juego en el chat, para quien juega: un mensaje de sistema con su `extra` propio
 * (el de `getSystemMessageByType` lo comparten todos: tocarlo cambiaría todas las notas).
 *
 * @param {string} mes Lo que se guarda: la nota con su etiqueta.
 * @param {Record<string, any>} extra
 */
function pushSystemNote(mes, extra) {
    const message = getSystemMessageByType(system_message_types.GENERIC, mes, { isSmallSys: true, isNarrator: true });
    message.extra = { ...message.extra, ...extra };
    chat.push(message);
    addOneMessage(message);
    setSendButtonState(false);
}

/**
 * La etiqueta de una nota («🛒 [TIENDA] »), para ponerla delante de lo que se lee: el Diario y el
 * plegado del chat la leen; la caja y el registro la esconden.
 *
 * @param {string} note
 * @returns {string}
 */
function tagOf(note) {
    return note.slice(0, tagLength(note));
}

/**
 * D-J54: lo de una nota que no le toca decir a quien habla, antes, como aviso corto: contado
 * (`noteProse`), sin nombrar a quien no se conoce, y sin entrar dos veces en el Diario.
 *
 * @param {string} note La nota entera, por su etiqueta.
 * @param {string} before
 */
function postBefore(note, before) {
    const said = `${tagOf(note)}${before}`;
    pushSystemNote(said, { display_text: shownText(sayGendered(noteProse(said, { key: String(chat.length) })), { mask: true }), told: '' });
}

/**
 * D-J54: una nota del motor dicha por alguien que está allí, o que no sale en la caja. Sigue siendo
 * un mensaje de sistema (no llega al modelo); el que habla le pone su nombre y su cara, y la caja
 * lo pinta con su placa y su retrato (`extra.voiced`). La nota contada se guarda para el Diario.
 *
 * @param {string} note
 * @param {string} told
 * @param {import('../game-engine/campaign/narration-voices.js').VoicedNote} voice
 */
function postVoiced(note, told, voice) {
    if (voice.mode === 'quiet') {
        pushSystemNote(note, { display_text: told || note, quiet: true });
        return;
    }
    // Lo de la nota que no le toca decir a quien habla, antes, como aviso (sin entrar dos veces en el Diario).
    if (voice.before) postBefore(note, voice.before);
    const who = String(voice.who || '');
    const said = sayGendered(voice.text);
    hearLine({ who, text: said });
    const member = partyMembers.find(m => String(m?.name) === who);
    const message = buildGameMessage({
        text: note,
        channel: CHANNEL.PLAYER,
        name: who,
        // Su retrato en pixel si lo tiene; si no, la cara de su ficha. Nunca la del sistema: la
        // caja la tomaría por el narrador y no le pondría placa.
        avatar: firstArt('portrait', { name: who, pack: lastPack }) || String(member?.avatar || ''),
        timestamp: getMessageTimeStamp(),
        compact: true,
    });
    Object.assign(/** @type {any} */ (message.extra), {
        voiced: true,
        // J13.7: lo que se lee no nombra a quien aún no se ha presentado.
        display_text: `${tagOf(note)}${shownText(said, { mask: true })}`,
        told: told || note,
        ...(voice.mood ? { mood: voice.mood } : {}),
    });
    chat.push(message);
    addOneMessage(message);
    setSendButtonState(false);
}

/**
 * D-J54: lo último que ha dicho alguien al dar una nota (la tendera al cobrarte), si es lo último
 * del chat. La pantalla del sitio lo pone en su caja, en vez del saludo.
 *
 * @param {string} name
 * @returns {{text: string, mood: string}|null}
 */
export function lastVoicedLine(name) {
    const last = /** @type {any} */ (chat?.[chat.length - 1]);
    if (!last?.extra?.voiced || !name || String(last.name) !== String(name)) return null;
    const shown = String(last.extra.display_text || '');
    return { text: shown.slice(tagLength(shown)).trim(), mood: String(last.extra.mood || '') };
}

/** @returns {boolean} */
export function sucesosOn() {
    try {
        return localStorage.getItem(SUCESOS_STORAGE) !== 'off';
    } catch {
        return true;
    }
}

/**
 * J9.2 y J8: si las escenas del hilo y las charlas escritas se abren en su ventana. Siempre,
 * salvo que se apaguen (las vueltas de prueba que no miran eso): entonces se cuentan en el
 * chat, como antes.
 *
 * @returns {boolean}
 */
export function storyWindowsOn() {
    try {
        return localStorage.getItem(STORY_WINDOWS_STORAGE) !== 'off';
    } catch {
        return true;
    }
}

/**
 * J11.4: al volver al gremio tras el final de una campaña, quien vendrá a buscaros por lo que
 * hicisteis allí queda esperando: sale días después como una tarjeta, donde estéis (en el gremio).
 * Se llama con la partida del gremio ya abierta.
 *
 * @param {any} legacy El legado del final (`endingLegacy(...).legacy`).
 * @param {string} campaignId La campaña, por su id del tablón.
 * @returns {void}
 */
export function scheduleGuildVisitor(legacy, campaignId) {
    const follow = visitorFollow(legacy, campaignId);
    if (!follow || !chat_metadata) return;
    chat_metadata[SUCESOS_KEY] = scheduleFollows(readSucesoState(chat_metadata[SUCESOS_KEY]), { follows: follow, day: Math.max(1, campaignDay()) });
    saveMetadata();
}

/** Las tarjetas, de una en una: dos que salen a la vez no se tapan. */
let sucesoQueue = Promise.resolve();

/**
 * Z4 de ROADMAP_SIN_TOKENS: los sucesos de un momento (el viaje, la llegada, el descanso, la
 * semana), en tarjetas con decisión. Antes, lo que vuelve: una continuación que toca hoy aquí
 * sale primero. No espera a que se decida: la tarjeta sale en cuanto se puede.
 *
 * @param {string} moment
 * @param {Record<string, any>} [facts]
 * @param {number} [days] Los días de camino, si es un viaje.
 * @returns {void}
 */
export function playSucesos(moment, facts = {}, days = 1) {
    if (!sucesosOn() || !chat_metadata?.[METADATA_KEY] || combatEncounter.active) return;
    sucesoQueue = sucesoQueue.then(async () => {
        const { compendium } = await getCompendium();
        if (!compendium?.has?.('sucesos')) return;
        // J11.2: con los de `sucesos.json`, las tarjetas que vuelven de lo decidido en el hilo y
        // en las charlas (`later`): si no, la que se dejó agendada no se encontraría nunca.
        // J11.4: y, en el gremio, quien viene a buscaros por cómo acabó una campaña.
        // J10.3 y D-J42: y los propios de la campaña, que sustituyen a los del compendio con su id.
        const rows = [
            ...mergeSucesoRows(compendium.find('sucesos', {}), lastCampaignSucesos),
            ...laterRows(chat_metadata?.[PLOT_KEY], { dialogues: lastDialogues }), ...guildVisitorRows(),
        ];
        // J10.3: cómo está el mundo con vosotros aquí, para los que salen por facción, reputación o fama.
        const world = sucesoWorld({ factions: currentWorldFactions, here: currentLocationName, fame: chat_metadata?.[FAME_KEY] ?? {} });
        const state = readSucesoState(chat_metadata?.[SUCESOS_KEY]);
        const companion = partyMembers.slice(1).find(m => !m.dead);
        /** @type {Record<string, any>} */
        const all = { sitio: currentLocationName, ...(companion ? { companero: String(companion.name) } : {}), ...facts };
        // J1.4: «{companero} se queda {companero:callado|callada}», con el suyo.
        all.generos = whoPlays(all);
        const random = createSeededRandom(derive(String(chat_metadata?.[METADATA_KEY] || ''), 'sucesos', moment, String(chat.length), String(campaignDay())));
        /** @type {any[]} */
        const cards = [];
        const due = moment === 'viaje' ? '' : dueFollowUp(state, { day: campaignDay(), place: currentLocationName });
        const followed = due ? sucesoById(rows, due, all, world) : null;
        // Una continuación que ya no está escrita (el paquete cambió) se olvida: si no, sería
        // siempre la primera en tocar y taparía las que vienen detrás.
        // (Una que existe pero hoy no se puede contar, sin compañero para su `{companero}`, espera.)
        if (due && !followed && chat_metadata && !rows.some(row => String(row?.id ?? '').trim() === due)) {
            chat_metadata[SUCESOS_KEY] = { ...state, pending: state.pending.filter(p => p.id !== due) };
            saveMetadata();
        }
        if (followed) cards.push(followed);
        else cards.push(...pickSucesos({ rows, moment, facts: all, count: sucesoCount({ moment, days, random }), random, seen: state.seen, world }));
        for (const card of cards) await showSuceso(card, random, world.names);
    }).catch(error => console.error('[party] suceso failed', error));
}

/**
 * Una tarjeta: la situación, las opciones con su precio y, al elegir, lo que pasa. Lo
 * elegido queda en el chat (y en el Diario) y en lo que los sucesos recuerdan.
 *
 * @param {any} card
 * @param {() => number} random
 * @param {Record<string, string>} [names] J10.3: el nombre de cada facción, por id, para decir sus efectos.
 * @returns {Promise<void>}
 */
async function showSuceso(card, random, names = {}) {
    const body = $('<div class="su-root gs-panel"></div>').attr('data-suceso', card.id);
    body.append($('<h3 class="gs-popup-title"></h3>').text(card.name));
    // Tanda 22 (D-J60): la tarjeta se queda como tarjeta, pero si trae quién está (quien vuelve, quien
    // viene al gremio), sale con su cara y su nombre, y lo que pasa al elegir lo dice él.
    const cardWho = speakerFor(String(card.who || ''), String(card.id));
    if (cardWho) {
        const face = firstArt('portrait', { name: cardWho, pack: lastPack }) || firstArt('creature', { name: cardWho });
        const who = $('<div class="su-who"></div>').attr('data-who', cardWho);
        if (face) who.append($('<img class="pixel-art su-face" alt="">').attr('src', face));
        who.append($('<span class="su-name"></span>').text(shownName(cardWho)));
        body.append(who);
    }
    body.append($('<div class="su-text"></div>').text(card.text));
    const list = $('<div class="su-options"></div>');
    const result = $('<div class="su-result"></div>').hide();
    /** @type {Popup|null} */
    let popup = null;
    let chosen = false;
    const companion = partyMembers.slice(1).some(m => !m.dead);
    for (const option of card.options) {
        const view = optionView(option, { purse: partyPurse(), companion, skills: SKILLS });
        const button = $('<button type="button" class="su-option"></button>').prop('disabled', !view.enabled).attr('title', view.why || '')
            .append($('<span class="su-label"></span>').text(option.label));
        if (view.price) button.append($('<span class="su-price"></span>').text(view.price));
        button.on('click', async () => {
            if (chosen) return;
            chosen = true;
            list.find('.su-option').prop('disabled', true);
            button.addClass('chosen');
            const member = partyMembers.find(m => !m.dead) ?? partyMembers[0];
            let success = true;
            let rolled = '';
            if (option.check && member) {
                const roll = rollCheck({ member, skill: option.check.skill, rollD20: () => rollDiceDetailed('1d20', 20).total, dc: Number(option.check.dc) || DEFAULT_DC });
                if (roll) {
                    success = roll.success;
                    rolled = noteRollInWindow(member, roll);
                }
            }
            const done = resolveOption(option, { success });
            const said = applySucesoEffects(done.effects, random, names);
            // Tanda 22 (D-J60): lo dice quien está en la tarjeta (o quien diga la opción).
            const speaker = done.who ? speakerFor(done.who, String(card.id)) : cardWho;
            result.empty();
            if (rolled) result.append($('<div class="su-roll"></div>').text(rolled));
            if (speaker && done.then) {
                result.append($('<div class="su-said"></div>').attr('data-who', speaker)
                    .append($('<span class="su-said-who"></span>').text(`${shownName(speaker)}: `))
                    .append($('<span></span>').text(done.then)));
            } else {
                result.append($('<div></div>').text(done.then || 'Hecho.'));
            }
            if (said.length > 0) result.append($('<div class="su-effects"></div>').text(said.join(' · ')));
            result.show();
            // J9.1: «Seguir» sale con lo que pasa, no cuando acaba de escribirse la nota del chat
            // (con la partida cargada tardaba segundos, y la ventana se quedaba sin botón).
            const go = $('<button type="button" class="menu_button su-go"></button>').text('Seguir');
            go.on('click', () => { void popup?.completeAffirmative(); });
            body.append(go);
            if (chat_metadata) {
                chat_metadata[SUCESOS_KEY] = noteSuceso(readSucesoState(chat_metadata[SUCESOS_KEY]), { id: card.id, follow: done.follow, day: campaignDay() });
                saveMetadata();
            }
            const skill = option.check ? SKILLS[/** @type {keyof typeof SKILLS} */ (option.check.skill)]?.label ?? option.check.skill : '';
            const check = option.check ? ` (${skill}: ${success ? 'sale' : 'no sale'})` : '';
            // J13.1: lo que se lee, en frases: «Elegís echarlos, y con Intimidación sale bien.»
            const chose = `Elegís ${String(option.label).charAt(0).toLocaleLowerCase('es')}${String(option.label).slice(1)}${option.check ? (success ? `, y con ${skill} sale bien` : `, pero con ${skill} no sale`) : ''}.`;
            await postForModel(
                `[SUCESO] ${card.text} Quien juega elige: ${option.label}${check}. ${done.then}${said.length > 0 ? ` (${said.join(', ')})` : ''} Si lo cuentas, en dos frases y sin cambiar lo que pasó.`,
                // Tanda 22 (D-J60): sin conexión, con alguien que lo diga, en la caja lo dice él.
                speaker && done.then && offlineGame() ? { show: `🃏 [SUCESO] ${done.then}`, speaker } : {
                    show: narratorMode() === 'motor' ? `🃏 [SUCESO] ${card.name}. ${chose} ${sucesoProse({ then: done.then, effects: said })}`
                        : `🃏 [SUCESO] ${card.name}: ${option.label}${check}. ${done.then}${said.length > 0 ? ` (${said.join(', ')})` : ''}`,
                },
            );
            savePartyState();
            if (isShellOpen()) refreshGameShell();
        });
        list.append(button);
    }
    body.append(list).append(result);
    popup = new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: false, cancelButton: false, allowVerticalScrolling: true, leftAlign: true });
    await popup.show();
    // Cerrar sin elegir es dejarlo estar: se apunta que salió, para que no vuelva enseguida.
    if (!chosen && chat_metadata) {
        chat_metadata[SUCESOS_KEY] = noteSuceso(readSucesoState(chat_metadata[SUCESOS_KEY]), { id: card.id, day: campaignDay() });
        saveMetadata();
    }
}

/**
 * Una tirada hecha dentro de una ventana (una charla, un suceso): se apunta en el registro de
 * dados, como todas, y se dice en la ventana. El cartel del dado no: iría detrás de la
 * ventana, sin verse ni poder pulsarse hasta cerrarla.
 *
 * @param {any} member
 * @param {{label: string, natural: number, total: number, dc: number, said: string}} roll
 * @returns {string}
 */
export function noteRollInWindow(member, roll) {
    if (chat_metadata) {
        chat_metadata[DICE_LOG_KEY] = addRoll(chat_metadata[DICE_LOG_KEY], { title: `${member.name}: ${roll.label}`, natural: Number(roll.natural), total: Number(roll.total) || 0, dc: roll.dc });
    }
    return roll.said;
}

/**
 * Lo que hace una opción, en lo que ya existe. Devuelve cada efecto dicho en llano.
 *
 * @param {string[]} effects
 * @param {() => number} random
 * @param {Record<string, string>} [names] J10.3: el nombre de cada facción, por id.
 * @returns {string[]}
 */
function applySucesoEffects(effects, random, names = {}) {
    /** @type {string[]} */
    const said = [];
    const alive = partyMembers.filter(m => !m.dead && (Number(m.hp) || 0) > 0);
    const someone = () => alive[Math.floor(random() * alive.length)] ?? partyMembers[0];
    const amountOf = (/** @type {string} */ value) => (/d/.test(value) ? rollDiceDetailed(value.replace(/^[+-]/, ''), 6).total : Math.abs(Number(value) || 0));
    let opens = false;
    for (const effect of effects) {
        const [kind, amount = ''] = String(effect).split(':');
        // J10.3: lo que mueve a una facción por su id, y lo que abre caminos (J10.1).
        const world = readSucesoEffect(String(effect));
        if ((world.kind === 'faccion' || world.kind === 'reloj') && world.target) {
            // D-J58: sin el mundo vivo, ningún plan se retrasa ni adelanta, y no se dice.
            if (world.kind === 'reloj' && !factionWorldOn()) continue;
            const who = currentWorldFactions.find(f => String(f?.id) === world.target);
            if (!who || !world.amount) continue;
            if (world.kind === 'faccion') void shiftFactionStanding(world.target, Math.sign(world.amount));
            else void pushFactionClock(world.target, world.amount);
            said.push(describeWorldEffect(String(effect), { ...names, [world.target]: String(who.name ?? world.target) }));
            opens = true;
            continue;
        }
        if (world.kind === 'llave' || world.kind === 'guia') {
            if (!world.target) continue;
            const written = world.kind === 'llave'
                ? worldItemCatalogue.find((/** @type {any} */ i) => String(i?.name ?? '').trim().toLowerCase() === world.target.toLowerCase()) : null;
            const holder = partyMembers.find(m => !m.dead) ?? partyMembers[0];
            // Un objeto del paquete va a la mochila; lo demás (una barca, un guía) se apunta.
            if (written && holder) addItemToInventory(/** @type {any} */ (holder), createItem(/** @type {any} */ (describeLootItem(String(written.name), '', worldItemCatalogue))));
            else giveWorldKey(world.target);
            said.push(describeWorldEffect(String(effect), names));
            opens = true;
            continue;
        }
        if (kind === 'oro') {
            const n = amountOf(amount);
            if (amount.startsWith('-')) {
                const paid = Math.min(n, partyPurse());
                if (paid > 0) payFromParty(paid);
                said.push(`−${paid} de oro`);
            } else if (partyMembers[0]) {
                partyMembers[0].gold = (Number(partyMembers[0].gold) || 0) + n;
                said.push(`+${n} de oro`);
            }
        } else if (kind === 'hora') {
            advanceCampaignSlot();
            said.push('se va un rato');
        } else if (kind === 'dia') {
            advanceCampaignDay();
            said.push('se pierde un día');
        } else if (kind === 'herida') {
            // J9.1: solo a quien sigue en pie. Con el grupo en el suelo, `someone()` daba al
            // primero, y un golpe a quien tenía 0 le «subía» a 1 («−-1 de vida»).
            const who = alive.length > 0 ? someone() : null;
            if (who) {
                const before = Number(who.hp) || 0;
                who.hp = Math.max(1, before - Math.max(1, amountOf(amount || '1')));
                said.push(`${who.name} −${before - who.hp} de vida`);
            }
        } else if (kind === 'cura') {
            const who = [...alive].sort((a, b) => ((Number(a.hp) || 0) - (Number(a.maxHp) || 0)) - ((Number(b.hp) || 0) - (Number(b.maxHp) || 0)))[0];
            if (who) {
                const before = Number(who.hp) || 0;
                who.hp = Math.min(Number(who.maxHp) || before, before + amountOf(amount || '1d6'));
                said.push(`${who.name} +${who.hp - before} de vida`);
            }
        } else if (kind === 'comida') {
            for (const one of alive) one.needs = relieve(one, 'ate');
            said.push('coméis');
        } else if (kind === 'fama') {
            raiseFame(currentLocationName, amount.startsWith('-') ? -1 : 1);
            said.push(describeEffect(effect));
        } else if (kind === 'faccion') {
            const ruler = rulerOf(currentLocationName);
            if (ruler?.id) {
                void shiftFactionStanding(String(ruler.id), amount.startsWith('-') ? -1 : 1);
                said.push(`${ruler.name} os mira ${amount.startsWith('-') ? 'peor' : 'mejor'}`);
            }
        } else if (kind === 'vinculo') {
            const friend = partyMembers.slice(1).filter(m => !m.dead)[0];
            if (friend) {
                recordCampaignBondEvent(String(friend.id), 'shared_downtime');
                said.push(`más cerca de ${friend.name}`);
            }
        } else if (kind === 'rumor') {
            if (rumorsLeftHere() > 0) {
                void hearRumor();
                said.push('os enteráis de algo');
            }
        } else if (kind === 'pista') {
            const cases = readCases(chat_metadata?.[CASES_KEY]);
            const clue = cases.active ? cluesHere(cases, { place: currentLocationName }).find(c => !cases.found.includes(c.id)) : null;
            if (clue) {
                revealClue(clue);
                said.push('una pista');
            }
        }
    }
    // J10.1: un objeto que abre un paso se nota ya; lo de las facciones, al moverse (`factions.js`).
    if (opens) announceOpenedRoads();
    return said.filter(Boolean);
}

/**
 * Contar un momento con las frases del motor (`public/compendio/frases.json`), a 0 tokens.
 * Vacío si lo cuenta el modelo (modo «Modelo») o si no hay frases que valgan.
 *
 * @param {string} moment Uno de `MOMENTS` (`engine-narrator.js`).
 * @param {Record<string, any>} facts
 * @returns {string}
 */
export function tellMoment(moment, facts) {
    // D-J54: dónde se durmió, para quién da los buenos días (el posadero, o nadie al raso).
    if (moment === 'descanso') lastRestUnder = String(facts?.bajo ?? '');
    if (modelNarrates() || !lastCompendium?.has?.('frases')) return '';
    const rows = lastCompendium.find('frases', {});
    const random = createSeededRandom(derive(String(chat_metadata?.[METADATA_KEY] || ''), 'narrador', moment, String(chat.length)));
    // J1.4: con quién juega, para que «llegáis empapados» sea «empapadas» si toca. J13: y la
    // estación de hoy, en todos los momentos (la llegada, el viaje, el descanso…): una frase
    // escrita para el invierno (`when: {estacion: 'invierno'}`) solo sale en invierno.
    // J13.1: y si vas a solas, sin las frases que piden a varios («os miráis unos a otros»).
    const solo = partyMembers.filter(m => !m.dead).length <= 1 ? 'sí' : 'no';
    // D-J54: sin modelo, al llegar el narrador dice solo que se llega. Cómo es el sitio ya está en
    // pantalla, quién anda por allí sale en sus fichas, y lo que conviene saber lo dice uno de los
    // tuyos justo después (`pendingHook`, en `postForModel`).
    // Y por el camino, solo el camino: lo que pasó cada día sale en sus avisos («Día 1: Un mojón caído»).
    const arriving = moment === 'llegada' && narratorMode() === 'motor';
    const walking = moment === 'viaje' && narratorMode() === 'motor';
    const skipped = arriving ? ['llegada-descripcion', 'llegada-gente', 'llegada-gancho'] : walking ? ['viaje-sucesos'] : [];
    const usable = skipped.length > 0 ? rows.filter((/** @type {any} */ row) => !skipped.includes(String(row?.kind))) : rows;
    const told = narrateMoment({ rows: usable, moment, facts: { estacion: currentSeason(), solo, ...facts, generos: whoPlays(facts) }, random, recent: chat_metadata?.[NARRATOR_RECENT_KEY] });
    if (chat_metadata && told.used.length > 0) chat_metadata[NARRATOR_RECENT_KEY] = rememberUsed(chat_metadata[NARRATOR_RECENT_KEY], told.used);
    if (arriving) pendingHook = String(facts?.gancho ?? '').trim() && told.text ? { hook: String(facts.gancho), arrival: told.text } : null;
    return told.text;
}

/**
 * Una línea del narrador del motor: con su nombre y su cara, como habla el narrador, y sin
 * llegar al modelo (que tiene los hechos por su nota). Z1 de ROADMAP_SIN_TOKENS.
 *
 * @param {string} text
 * @returns {Promise<void>}
 */
export async function postEngineLine(text) {
    if (typeof text !== 'string' || !text.trim()) return;
    const card = /** @type {any} */ (stCharacters)?.[/** @type {any} */ (this_chid)];
    const message = buildGameMessage({
        // J13.7: solo para quien juega: quien aún no se ha presentado sale por lo que es.
        text: shownText(sayGendered(text.trim()), { mask: true }),
        channel: CHANNEL.PLAYER,
        name: String(card?.name || chat_metadata?.narrator_name || 'Narrador'),
        avatar: card?.avatar ? getThumbnailUrl('avatar', card.avatar) : system_avatar,
        timestamp: getMessageTimeStamp(),
        compact: false,
    });
    chat.push(message);
    addOneMessage(message);
    await saveChatConditional();
}

/**
 * «dos», «tres»…, para contar en una frase.
 *
 * @param {number} n
 * @returns {string}
 */
export function numberWord(n) {
    return ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'][n] ?? String(n);
}

/**
 * Entrar en un tablero, contado: qué hay que hacer y quién espera.
 *
 * @param {string} boardName
 * @returns {void}
 */
export function tellBoard(boardName) {
    const place = getCurrentWorldLocationMaps().find((/** @type {any} */ l) => l.name === currentLocationName);
    const board = /** @type {any} */ (getLocationBoards(place).find((/** @type {any} */ b) => b.name === boardName) ?? {});
    const goal = String(board.objectives?.[0]?.label || '').trim();
    /** @type {Record<string, number>} */
    const count = {};
    for (const foe of board.enemyPlacements ?? []) {
        const name = String(foe?.name || '').trim();
        if (name) count[name] = (count[name] ?? 0) + 1;
    }
    // J13.1: «dos ratas de bodega», no «Rata de bodega (2)».
    const foes = Object.entries(count).map(([name, n]) => countedName(name, n));
    const told = tellMoment('tablero', {
        tablero: boardName,
        objetivo: goal ? goal[0].toLocaleLowerCase('es') + goal.slice(1) : '',
        enemigos: listNames(foes),
    });
    // Tanda 22 (D-J60): sin conexión no lo cuenta nadie: el objetivo ya sale en la cabecera.
    if (told && !quietMoment('tablero')) void postEngineLine(told);
}

/**
 * Post a line the model must actually read.
 *
 * The counterpart of postCombatNarration, and the reason chat-channel.js exists: the
 * combat epilogue used to go out as a system message, which meant the player saw it and
 * the model never did. No error, no failing test, just a prompt that was silently missing
 * the only summary of the fight.
 *
 * This does not start a generation. The message sits in the chat and enters the prompt on
 * the player's next turn, so a finished combat still costs nothing by itself.
 *
 * @param {string} text
 * @param {{show?: string, speaker?: string, mood?: string, quiet?: boolean, moment?: string}} [options] `show`: lo que se ve si
 *   cuenta el motor (Z1). `speaker`: quien lo dice, si es alguien del mundo (la novela sale con
 *   su cara y su nombre en la placa, no con la del narrador); `mood`: con qué gesto (`alegre`,
 *   `enfadado`, `triste`), para la cara que toca. `quiet`: lo que ya se ha visto en pantalla (una
 *   escena jugada): queda en el registro y lo lee el modelo, pero no sale otra vez en la caja.
 *   `moment`: el momento del narrador que cuenta (`viaje`, `fin-combate`); J13.9: sin conexión,
 *   si no lo dice nadie que esté allí, tampoco sale (`quietMoment`).
 * @returns {Promise<void>}
 */
export async function postForModel(text, options = {}) {
    if (typeof text !== 'string' || !text.trim()) return;

    const speaker = String(options?.speaker ?? '').trim();
    // Quien habla, con su retrato en pixel si lo tiene: con la cara del sistema, la novela lo
    // tomaría por el narrador y no le pondría cara.
    const face = speaker ? firstArt('portrait', { name: speaker, pack: lastPack }) : '';
    const message = buildGameMessage({
        // J1.4: el modelo también lee «entera», no «{entero|entera}».
        text: sayGendered(substituteParams(text.trim())),
        channel: CHANNEL.MODEL,
        name: speaker || chat_metadata?.narrator_name || 'Narrador',
        avatar: face || system_avatar,
        timestamp: getMessageTimeStamp(),
        compact: true,
    });
    // La cara de quien habla en la novela: `extra.mood` la elige (game-shell.js, `renderNovel`).
    const mood = String(options?.mood ?? '').trim();
    if (speaker && mood && mood !== 'neutral') /** @type {any} */ (message.extra).mood = mood;
    // El modelo lee la nota entera; en pantalla sale solo lo que pasó, sin la orden al
    // narrador («Cuéntalo en un párrafo…»), que sin modelo se leía como un error y con él
    // como una instrucción colada (ROADMAP_SIN_TOKENS, Z0).
    const { said } = splitModelNote(message.mes);
    // Z1: si cuenta el motor, lo que se ve es su prosa (el modelo sigue leyendo los hechos).
    const seen = !modelNarrates() && typeof options?.show === 'string' && options.show.trim() ? sayGendered(options.show.trim()) : said;
    // J13.1: y sin modelo, contada, sin lo que quedaba de registro.
    const told = narratorMode() === 'motor' ? sayGendered(noteProse(seen, { key: String(chat.length) })) : seen;
    // D-J54: sin modelo, y si nadie lo dice ya, lo dice quien está allí (la sacerdotisa al
    // curaros); o no sale en la caja, si es lo mismo otra vez. El modelo sigue leyendo la nota.
    // «Las escenas en las que se resume lo ocurrido no hacen falta» (Daniel, 2026-10-02): lo ya
    // jugado en pantalla no lo dice nadie ni sale en la caja.
    const quiet = options?.quiet === true;
    const voice = !quiet && !speaker && narratorMode() === 'motor' ? voiceOf(seen, told) : null;
    if (voice?.mode === 'line') {
        if (voice.before) postBefore(seen, voice.before);
        const who = String(voice.who || '');
        const line = sayGendered(voice.text);
        const member = partyMembers.find(m => String(m?.name) === who);
        message.name = who;
        message.force_avatar = firstArt('portrait', { name: who, pack: lastPack }) || String(member?.avatar || '');
        hearLine({ who, text: line });
        Object.assign(/** @type {any} */ (message.extra), {
            voiced: true,
            display_text: `${tagOf(seen)}${shownText(line, { mask: true })}`,
            told,
            ...(voice.mood ? { mood: voice.mood } : {}),
        });
    } else {
        // J13.7: quien habla y dice su nombre se ha presentado; lo que se ve no nombra a quien aún no
        // se conoce (sale por lo que es: «el posadero»). El modelo sigue leyendo los nombres.
        // Del narrador, solo lo que alguien dice entre comillas («¡Gracias! Soy Tomás…»).
        hearLine(speaker ? { who: speaker, text: told } : { who: '', text: told, quotes: true });
        const shown = shownText(told, { mask: true });
        if (shown !== message.mes) /** @type {any} */ (message.extra).display_text = shown;
        // J13.9: un momento del narrador sin nadie que lo diga, sin conexión, tampoco sale.
        if (quiet || voice?.mode === 'quiet' || (!speaker && quietMoment(options?.moment))) /** @type {any} */ (message.extra).quiet = true;
    }

    chat.push(message);
    await eventSource.emit(event_types.MESSAGE_RECEIVED, chat.length - 1, 'game-engine');
    addOneMessage(message);
    await eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, chat.length - 1, 'game-engine');
    // D-J54: tras la llegada, lo que conviene saber del sitio, dicho por uno de los tuyos.
    if (pendingHook && seen.includes(pendingHook.arrival)) {
        const { hook } = pendingHook;
        pendingHook = null;
        sayArrivalHook(hook);
    }
    await saveChatConditional();
}

/**
 * J4.9: el viaje entre el gremio y una campaña, contado. Lo lee el modelo y lo ve quien juega.
 *
 * @param {string} line La de `journeyLine`; vacía si la campaña no dice lo lejos que queda.
 * @returns {Promise<void>}
 */
export async function postJourney(line) {
    if (!String(line ?? '').trim()) return;
    await postForModel(`[VIAJE] ${String(line).trim()} Cuéntalo en una o dos frases. No inventes nada que no esté aquí.`);
}

/**
 * Idea 186: un sonido por acción, si no se han apagado en «Sonido».
 *
 * @param {string} kind
 */
export function soundCue(kind) {
    const settings = loadAudioSettings();
    playCue(kind, { enabled: settings.enabled && settings.effects, volume: settings.volume });
}

/** @returns {boolean} */
export function saverOn() {
    return localFlag.get(SAVER_KEY) === '1';
}

/** Lo que dura un consejo a la vista, si nadie lo cierra antes. */
const TIP_MS = 12000;
/** J2.2: los consejos que esperan a que se cierre el que está en pantalla. */
/** @type {string[]} */
let tipQueue = [];
/** El aviso del consejo a la vista, para saber si sigue ahí. */
/** @type {any} */
let tipToast = null;

/** @returns {string[]} Los consejos ya vistos en este navegador. */
function seenTips() {
    return localFlag.get(TIPS_SEEN_KEY).split(',').filter(Boolean);
}

/**
 * Si hay un consejo a la vista. La bandeja de avisos quita los que sobran sin avisar a nadie
 * (idea 159): por eso se mira si su aviso sigue en la página, no si se ha cerrado.
 *
 * @returns {boolean}
 */
function tipOnScreen() {
    const element = tipToast?.[0];
    return Boolean(element && element.isConnected && !$(element).is(':hidden'));
}

/**
 * Idea 155: un consejo, la primera vez que aparece cada cosa. J2.2: de uno en uno; si ya hay
 * uno a la vista, este espera a que se cierre (con su ×, pulsándolo o cuando se acaba su tiempo).
 *
 * @param {string} situation
 */
export function showTip(situation) {
    const seen = seenTips();
    const plan = planTip({ situation, seen, queue: tipQueue, busy: tipOnScreen() });
    tipQueue = plan.queue;
    if (!plan.show) return;
    localFlag.set(TIPS_SEEN_KEY, [...seen, plan.show.id].join(','));
    tipToast = toastr.info(plan.show.text, 'Consejo', { timeOut: TIP_MS, closeButton: true, onHidden: () => showNextTip() });
    // Si lo quita otra cosa, el siguiente no se queda esperando para siempre.
    setTimeout(() => showNextTip(), TIP_MS + 1000);
}

/** J2.2: el siguiente consejo que esperaba, si ya no hay ninguno a la vista. */
function showNextTip() {
    if (tipOnScreen()) return;
    const next = nextQueuedTip(tipQueue, seenTips(), tipStillFits);
    tipQueue = next.queue;
    if (next.id) showTip(next.id);
}

/**
 * J2.2: si lo que enseña un consejo que esperaba sigue ahí cuando le llega el turno: la
 * pelea, tu turno con alguien al alcance, la ventana de la charla.
 *
 * @param {string} id
 * @returns {boolean}
 */
function tipStillFits(id) {
    const entry = getCurrentTurnEntry();
    const yours = Boolean(entry && !entry.isEnemy && !actsOnItsOwn(entry));
    if (id === 'combat') return combatEncounter.active;
    if (id === 'move') return yours;
    if (id === 'attack') return yours && getAttackableEnemiesForMember(getCurrentActingMember()).length > 0;
    if (id === 'talk') return Boolean(document.querySelector('.tk-root'));
    return true;
}

/** Idea 172: aplicar los colores para daltonismo. */
export function applyColorblind() {
    document.body.classList.toggle('game-colorblind', localFlag.get(COLORBLIND_KEY) === '1');
}

/** Como rehacer la ultima respuesta (idea 150): una instruccion de una sola vez. */
const RETRY_NOTES = {
    otra: '',
    corto: '[NOTA PARA ESTA RESPUESTA] Más corta: la mitad de largo, sin perder lo que pasa.',
    intenso: '[NOTA PARA ESTA RESPUESTA] Más intensa: más tensión y detalle sensorial, sin inventar hechos nuevos.',
};

/**
 * Idea 150: rehacer la ultima respuesta del narrador, igual, mas corta o mas intensa.
 *
 * @param {string} mode otra, corto o intenso.
 * @returns {Promise<void>}
 */
export async function retryLastReply(mode) {
    // El regenerar de SillyTavern borra el último mensaje si no es tuyo, sea lo que sea: con
    // una línea del motor al final, «Otra vez» se la llevaba (ROADMAP_SIN_TOKENS, Z0).
    if (!lastIsModelReply()) {
        toastr.info('Lo último no lo ha contado el narrador: no hay nada que repetir.');
        return;
    }
    const note = RETRY_NOTES[/** @type {keyof typeof RETRY_NOTES} */ (mode)] ?? '';
    const key = promptKey('combat', 'retry', 'ctx');
    setExtensionPrompt(key, note, extension_prompt_types.IN_PROMPT, 0, false, extension_prompt_roles.SYSTEM);
    try {
        const { executeSlashCommandsWithOptions } = await import('../slash-commands.js');
        await executeSlashCommandsWithOptions('/regenerate await=true');
    } finally {
        // Una vez y ya: la siguiente respuesta vuelve a ser la de siempre.
        setExtensionPrompt(key, '', extension_prompt_types.IN_PROMPT, 0, false, extension_prompt_roles.SYSTEM);
    }
}

/**
 * Si lo último del chat es una respuesta del modelo (y no una línea o nota del motor).
 *
 * @returns {boolean}
 */
function lastIsModelReply() {
    const last = chat?.[chat.length - 1];
    return Boolean(last && !last.is_user && !last.is_system && last.extra?.model !== 'game-engine');
}

/** U4 del pegamento (DU3): las tandas de avisos menores que el jugador ha abierto. */
export const unfoldedMessages = new Set();
/** @type {any} */
let foldTimer = null;

/**
 * U4 del pegamento (DU3): el chat con menos ruido. Varios avisos menores seguidos (combate,
 * pueblo, viaje, campamento) se quedan en el último, con un «y N más» que abre el resto. Lo
 * que mueve la historia no se pliega nunca, y nada se pierde: todo sigue en el diario.
 */
function foldChat() {
    const root = document.getElementById('chat');
    if (!root) return;
    root.querySelectorAll('.gm-fold').forEach(node => node.remove());
    root.querySelectorAll('.mes.gm-folded').forEach(node => node.classList.remove('gm-folded'));
    if (!chat_metadata?.[METADATA_KEY]) return;
    /** @type {Map<number, Element>} */
    const nodes = new Map();
    const lines = [...root.querySelectorAll('.mes')].map(node => {
        const id = Number(node.getAttribute('mesid'));
        const message = chat?.[id];
        if (!Number.isFinite(id) || !message || message.is_user) return null;
        nodes.set(id, node);
        const line = readTaggedLine(String(message.mes ?? ''));
        return line && !unfoldedMessages.has(id) ? { index: id, minor: line.minor, category: line.category } : null;
    });
    for (const fold of foldPlan(lines)) {
        for (const id of fold.hide) nodes.get(id)?.classList.add('gm-folded');
        const shown = nodes.get(fold.show);
        if (!shown) continue;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'gm-fold menu_button';
        button.textContent = describeFold(fold);
        button.addEventListener('click', () => {
            for (const id of fold.hide) unfoldedMessages.add(id);
            foldChat();
        });
        shown.before(button);
    }
}

/** Plegar en cuanto el chat cambia, una vez por tanda de cambios. */
export function scheduleFoldChat() {
    if (foldTimer) clearTimeout(foldTimer);
    foldTimer = setTimeout(() => {
        foldTimer = null;
        foldChat();
    }, 60);
}

/**
 * Idea 145: la cara de quien habla, delante de su párrafo. Solo se dibuja: el texto del
 * mensaje no cambia, y lo que lee el modelo tampoco.
 *
 * @param {number} messageId
 */
export function decorateSpeakers(messageId) {
    const message = chat?.[messageId];
    if (!message || message.is_user || message.is_system || !chat_metadata?.[METADATA_KEY]) return;
    const block = /** @type {HTMLElement|null} */ (document.querySelector(`#chat .mes[mesid="${messageId}"] .mes_text`));
    if (!block) return;
    /** @type {Map<string, string>} */
    const faces = new Map();
    for (const npc of lastWorldNpcs) if (!npc.dead && npc.name) faces.set(npc.name, '');
    for (const member of partyMembers) if (member?.name) faces.set(String(member.name), String(member.avatar || ''));
    const names = [...faces.keys()];
    // Un mensaje de un solo párrafo puede venir sin <p>: entonces el bloque entero.
    const paragraphs = block.querySelectorAll('p');
    const list = paragraphs.length > 0 ? [...paragraphs] : [block];
    for (const paragraph of list) {
        if (paragraph.querySelector('.sp-badge')) continue;
        const who = speakerOf(paragraph.textContent || '', names);
        if (!who) continue;
        const badge = document.createElement('span');
        badge.className = 'sp-badge';
        badge.title = who;
        badge.dataset.speaker = who;
        const avatar = faces.get(who) ?? '';
        if (avatar && !/user-default/.test(avatar)) {
            const img = document.createElement('img');
            img.src = avatar;
            img.alt = '';
            badge.appendChild(img);
        } else {
            // D-J52: la cara sin arte que eligió uno del grupo: sus iniciales en su color, un
            // icono o un emoji.
            const choice = readFaceChoice(partyMembers.find(m => String(m?.name) === who)?.face);
            if (choice?.kind === 'icon') {
                const icon = document.createElement('i');
                icon.className = `fa-solid ${choice.icon}`;
                badge.appendChild(icon);
            } else {
                badge.textContent = choice?.kind === 'emoji' ? String(choice.emoji) : initialsOf(who);
            }
            badge.style.setProperty('--sp-hue', String(faceHue(choice?.color) ?? hueOf(who)));
        }
        paragraph.prepend(badge);
    }
}

/**
 * Compara lo que el modelo acaba de contar con lo que el motor sabe.
 *
 * No cambia nada, a proposito. Una narracion que contradice el estado es un problema de
 * prompt, y lo que arregla un problema de prompt es un prompt mejor, no reescribir en
 * silencio lo que escribio el modelo. Lo que esto da son datos sobre donde fallan los
 * prompts, en vez de la sensacion de que a veces fallan.
 *
 * @param {number} messageId
 */
export function recordContradictions(messageId) {
    const message = chat[messageId];
    if (!message || message.is_user || !message.mes) return;

    const found = findContradictions(String(message.mes), {
        party: partyMembers.map(m => ({ name: m.name, hp: Number(m.hp) || 0, maxHp: Number(m.maxHp) || 0 })),
        enemies: combatEncounter.enemies.map(e => ({
            name: e.name, currentHp: Number(e.currentHp) || 0, maxHp: Number(e.maxHp) || 0,
        })),
        day: getCampaignCalendar().day,
        slotLabel: getCurrentSlotLabel(),
        locationName: currentLocationName,
        combatActive: Boolean(combatEncounter.active),
        // Idea 141: quien ha muerto de verdad no habla.
        dead: [
            ...readGraves(chat_metadata?.[GRAVES_KEY]).map(g => ({ name: g.name, day: g.day })),
            ...partyMembers.filter(m => m.dead && !readGraves(chat_metadata?.[GRAVES_KEY]).some(g => g.name === m.name))
                .map(m => ({ name: String(m.name) })),
        ],
    });

    if (found.length === 0) return;
    // Idea 141: esto sí se ve. Un muerto que habla rompe la partida para quien la juega.
    for (const item of found.filter(f => f.kind === 'muerto que habla')) {
        toastr.warning(`${item.message} El motor lo tiene por muerto: puedes regenerar la respuesta.`, '⚠️ El narrador se ha equivocado', { timeOut: 15000 });
    }

    if (chat_metadata) {
        chat_metadata[CONTRADICTIONS_KEY] = appendContradictions(
            chat_metadata[CONTRADICTIONS_KEY], found, { day: getCampaignCalendar().day },
        );
        saveMetadata();
    }

    // En el registro del jugador, no en el prompt: el modelo no necesita leer que se
    // equivoco, necesita un prompt que no le deje equivocarse.
    for (const item of found) {
        console.warn('[party] contradiccion', item);
        pushCombatLogEntry(lineToEntry(`Contradiccion: ${item.message}`));
    }
}

/**
 * Idea 108: la tarjeta de «Anteriormente…». No tapa nada (no se puede pulsar) y se va sola.
 */
export function showRecap() {
    const today = Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1));
    const recap = buildRecap({
        day: today,
        place: currentLocationName,
        focus: focusOf(getPlot(), chat_metadata?.[PLOT_STATE_KEY], campaignDay()),
        deeds: Array.isArray(chat_metadata?.[DEEDS_KEY]) ? chat_metadata[DEEDS_KEY] : [],
        memory: memoryLines(chat_metadata?.[MEMORIES_KEY], today).slice(-1)[0] ?? '',
        taken: chat_metadata?.[TAKEN_KEY] ?? null,
    });
    if (!recap) return;
    $('.rc-card').remove();
    // J13.9 (D-J60): sin conexión no lo cuenta un narrador: te lo recuerda uno de los tuyos (o, si
    // vas solo y estás en el gremio, quien lo lleva), con su cara y su nombre, en una o dos frases.
    const mate = partyMembers.slice(1).find(m => m && !m.dead && String(m.name || '').trim());
    const keeper = lastHub ? (lastWorldNpcs ?? []).find((/** @type {any} */ n) => String(n?.service || '') === 'gremio') : null;
    const speaker = mate ? { name: String(mate.name).trim(), along: true, avatar: String(mate.avatar || '') }
        : keeper?.name ? { name: String(keeper.name).trim(), along: false, avatar: '' } : null;
    const said = offlineGame() && speaker ? recapSaid({
        who: speaker.name,
        along: speaker.along,
        focus: focusOf(getPlot(), chat_metadata?.[PLOT_STATE_KEY], campaignDay()),
        taken: chat_metadata?.[TAKEN_KEY] ?? null,
        deeds: Array.isArray(chat_metadata?.[DEEDS_KEY]) ? chat_metadata[DEEDS_KEY] : [],
    }) : null;
    const card = $('<div class="rc-card" role="status"></div>');
    if (said) {
        card.addClass('rc-said');
        const face = firstArt('portrait', { name: said.who, pack: lastPack }) || (speaker?.avatar ?? '');
        if (face) card.append($('<img class="rc-face" alt="">').attr('src', face));
        const body = $('<div class="rc-body"></div>');
        body.append($('<div class="rc-who"></div>').text(shownName(said.who)));
        for (const line of said.lines) {
            const spoken = sayGendered(line);
            hearLine({ who: said.who, text: spoken });
            body.append($('<div class="rc-line"></div>').text(shownText(spoken, { mask: true })));
        }
        card.append(body);
    } else {
        card.append($('<div class="rc-title"></div>').text(recap.title));
        for (const line of recap.lines) card.append($('<div class="rc-line"></div>').text(line));
    }
    $('body').append(card);
    setTimeout(() => card.addClass('rc-leaving'), 11000);
    setTimeout(() => card.remove(), 12000);
}

/** Motor: 0 tokens. Mixto: el motor cuenta y el modelo añade en lo que importa. Modelo: como antes. */
export const NARRATOR_MODES = ['motor', 'mixto', 'modelo'];

/** Z6: cómo se llama cada modo en la pausa, y qué quiere decir. */
export const NARRATOR_LABELS = { motor: 'Motor (0 tokens)', mixto: 'Mixto', modelo: 'Modelo' };
export const NARRATOR_HINTS = {
    motor: 'Todo lo cuenta el juego y no se gasta ni un token. Lo que escribes en la caja lo lee el juego.',
    mixto: 'El juego cuenta y resuelve, y hace lo que entiende de la caja; el modelo contesta lo demás y a quien le hablas.',
    modelo: 'Como antes: cuenta el modelo, y las fichas de hablar dejan la frase empezada.',
};

/**
 * El modo elegido, o «mixto» si no se ha elegido nunca (DZ3).
 *
 * @returns {string}
 */
export function storedNarratorMode() {
    try {
        const stored = String(localStorage.getItem(NARRATOR_MODE_STORAGE) || '');
        return NARRATOR_MODES.includes(stored) ? stored : 'mixto';
    } catch {
        return 'mixto';
    }
}

/**
 * Quién cuenta ahora: sin proveedor, siempre el motor.
 *
 * @returns {string}
 */
export function narratorMode() {
    return online_status === 'no_connection' || offlineGame() ? 'motor' : storedNarratorMode();
}

/**
 * J4: una partida del gremio (el gremio o una campaña empezada desde él) se juega sin
 * conexión: la cuenta el motor aunque haya un proveedor conectado.
 *
 * @returns {boolean}
 */
export function offlineGame() {
    return Boolean(lastHub) || Boolean(lastHubHome);
}

/**
 * J13.9 (D-J60): los momentos que el narrador del motor ya no cuenta sin conexión. El viaje y
 * la llegada ya salen en el aviso del viaje y en el mapa, el descanso y la semana en el reloj y
 * en la vida, el final de una pelea en la pantalla de la victoria, y el cierre de un acto en el
 * libro de la historia. Lo que dice alguien que está allí (los buenos días del posadero, el
 * compañero que avisa al llegar) sigue saliendo; lo que es un hecho (el oro, una tirada,
 * «Objetivos cumplidos») va en su aviso, como siempre.
 *
 * Tanda 22: tampoco entrar en un tablero (el objetivo ya sale en la cabecera), entrar en un
 * edificio (su tarjeta ya dice qué hay) ni el epitafio de quien cae (se ve en el tablero y queda
 * en el Salón de la fama).
 */
export const QUIET_MOMENTS = Object.freeze(['viaje', 'llegada', 'descanso', 'fin-combate', 'semana', 'acto', 'tablero', 'servicio', 'muerte']);

/**
 * Si un momento del narrador se calla: sin conexión, los de `QUIET_MOMENTS`.
 *
 * @param {any} moment
 * @returns {boolean}
 */
export function quietMoment(moment) {
    return QUIET_MOMENTS.includes(String(moment ?? '')) && offlineGame();
}

/**
 * Si el modelo lo cuenta todo, como antes: la tirada espera al mensaje, hablar deja la frase
 * empezada. En «Motor» y en «Mixto», el motor resuelve y cuenta, y nada espera a un mensaje
 * enviado, que sin modelo no se envía (ROADMAP_SIN_TOKENS, Z0).
 *
 * @returns {boolean}
 */
export function modelNarrates() {
    return narratorMode() === 'modelo';
}

/** Idea 195: las letras que puede llevar el narrador. */
export const NARRATOR_FONTS = [
    { id: '', label: 'la de siempre' },
    { id: 'libro', label: 'de libro' },
    { id: 'pluma', label: 'a pluma' },
    { id: 'maquina', label: 'de máquina' },
];

/** Idea 195: poner la letra del narrador de esta campaña. */
export function applyNarratorFont() {
    document.body.dataset.narratorFont = String(chat_metadata?.[NARRATOR_FONT_KEY] || '');
}
