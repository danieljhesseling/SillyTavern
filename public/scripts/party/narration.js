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
import { sendSystemMessage, system_message_types } from '../system-messages.js';
import {
    getThumbnailUrl, chat, chat_metadata, saveMetadata, eventSource, event_types, addOneMessage,
    saveChatConditional, substituteParams, system_avatar, online_status, setExtensionPrompt,
    extension_prompt_types, extension_prompt_roles, characters as stCharacters, this_chid,
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
import { relieve } from '../game-engine/rules/needs.js';
import { readGraves } from '../game-engine/campaign/legacy.js';
import { SKILLS, rollCheck, DEFAULT_DC } from '../game-engine/rules/checks.js';
import { buildRecap } from '../game-engine/campaign/guidance.js';
import { splitModelNote } from '../game-engine/campaign/model-note.js';
import { narrate as narrateMoment, rememberUsed, listNames } from '../game-engine/campaign/engine-narrator.js';
import { resolveGender } from '../game-engine/campaign/grammar.js';
import { readCases, cluesHere } from '../game-engine/campaign/cases.js';
import { readTaggedLine, foldPlan, describeFold } from '../game-engine/campaign/chronicle.js';
import { focusOf } from '../game-engine/campaign/plot.js';
import { addRoll } from '../game-engine/campaign/dice-log.js';
import {
    sucesoCount, pickSucesos, sucesoById, optionView, resolveOption, readSucesoState, noteSuceso, dueFollowUp,
    describeEffect,
} from '../game-engine/campaign/sucesos.js';
import { planTip, nextQueuedTip } from '../game-engine/ui/shell/tips.js';
import { memoryLines } from '../game-engine/campaign/memories.js';
import { promptKey } from '../game-engine/cost/prompt-order.js';
import { lineToEntry } from '../game-engine/ui/combat-log.js';
import { buildGameMessage, CHANNEL } from '../game-engine/ui/chat-channel.js';
import { guardRolls, guardImpossibleRolls, describeCorrections } from '../game-engine/combat/roll-guard.js';
import { findContradictions, appendContradictions } from '../game-engine/ui/contradiction-log.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import {
    CASES_KEY, COLORBLIND_KEY, CONTRADICTIONS_KEY, DEEDS_KEY, DICE_LOG_KEY, GRAVES_KEY, MEMORIES_KEY,
    NARRATOR_FONT_KEY, NARRATOR_MODE_STORAGE, NARRATOR_RECENT_KEY, PLOT_STATE_KEY, ROLL_GUARD_KEY, SAVER_KEY,
    SUCESOS_KEY, SUCESOS_STORAGE, TAKEN_KEY, TIPS_SEEN_KEY, localFlag,
} from './keys.js';
import { combatEncounter, currentLocationName, partyMembers } from './state.js';
import { petReact } from './pet.js';
import { revealClue } from './cases.js';
import {
    actsOnItsOwn, getAttackableEnemiesForMember, getCurrentActingMember, getCurrentTurnEntry,
} from './combat-state.js';
import { pushCombatLogEntry, pushCombatLogLines } from './combat-log.js';
import { getLocationBoards, lastCompendium, lastHub, lastHubHome, lastWorldNpcs } from './world.js';
import { rulerOf, shiftFactionStanding } from './factions.js';
import {
    advanceCampaignDay, advanceCampaignSlot, campaignDay, getCampaignCalendar, getCurrentSlotLabel,
    recordCampaignBondEvent,
} from './time.js';
import { getPlot } from './plot.js';
import { savePartyState, hearRumor, raiseFame, rumorsLeftHere, partyPurse, payFromParty } from './main.js';

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
 */
export function postCombatNarration(text) {
    if (typeof text !== 'string' || !text.trim()) return;
    text = sayGendered(text);
    pushCombatLogLines(text);
    sendSystemMessage(system_message_types.GENERIC, text.trim(), {
        isSmallSys: true,
        isNarrator: true,
    });
    // R5: la mascota, a veces, dice algo de lo que acaba de pasar. Gratis: es del motor.
    petReact(text);
}

/** @returns {boolean} */
export function sucesosOn() {
    try {
        return localStorage.getItem(SUCESOS_STORAGE) !== 'off';
    } catch {
        return true;
    }
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
        const rows = compendium.find('sucesos', {});
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
        const followed = due ? sucesoById(rows, due, all) : null;
        if (followed) cards.push(followed);
        else cards.push(...pickSucesos({ rows, moment, facts: all, count: sucesoCount({ moment, days, random }), random, seen: state.seen }));
        for (const card of cards) await showSuceso(card, random);
    }).catch(error => console.error('[party] suceso failed', error));
}

/**
 * Una tarjeta: la situación, las opciones con su precio y, al elegir, lo que pasa. Lo
 * elegido queda en el chat (y en el Diario) y en lo que los sucesos recuerdan.
 *
 * @param {any} card
 * @param {() => number} random
 * @returns {Promise<void>}
 */
async function showSuceso(card, random) {
    const body = $('<div class="su-root gs-panel"></div>').attr('data-suceso', card.id);
    body.append($('<h3 class="gs-popup-title"></h3>').text(card.name));
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
            const said = applySucesoEffects(done.effects, random);
            result.empty();
            if (rolled) result.append($('<div class="su-roll"></div>').text(rolled));
            result.append($('<div></div>').text(done.then || 'Hecho.'));
            if (said.length > 0) result.append($('<div class="su-effects"></div>').text(said.join(' · ')));
            result.show();
            if (chat_metadata) {
                chat_metadata[SUCESOS_KEY] = noteSuceso(readSucesoState(chat_metadata[SUCESOS_KEY]), { id: card.id, follow: done.follow, day: campaignDay() });
                saveMetadata();
            }
            const check = option.check ? ` (${SKILLS[/** @type {keyof typeof SKILLS} */ (option.check.skill)]?.label ?? option.check.skill}: ${success ? 'sale' : 'no sale'})` : '';
            await postForModel(
                `[SUCESO] ${card.text} Quien juega elige: ${option.label}${check}. ${done.then}${said.length > 0 ? ` (${said.join(', ')})` : ''} Si lo cuentas, en dos frases y sin cambiar lo que pasó.`,
                { show: `🃏 [SUCESO] ${card.name}: ${option.label}${check}. ${done.then}${said.length > 0 ? ` (${said.join(', ')})` : ''}` },
            );
            savePartyState();
            if (isShellOpen()) refreshGameShell();
            const go = $('<button type="button" class="menu_button su-go"></button>').text('Seguir');
            go.on('click', () => { void popup?.completeAffirmative(); });
            body.append(go);
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
 * @returns {string[]}
 */
function applySucesoEffects(effects, random) {
    /** @type {string[]} */
    const said = [];
    const alive = partyMembers.filter(m => !m.dead && (Number(m.hp) || 0) > 0);
    const someone = () => alive[Math.floor(random() * alive.length)] ?? partyMembers[0];
    const amountOf = (/** @type {string} */ value) => (/d/.test(value) ? rollDiceDetailed(value.replace(/^[+-]/, ''), 6).total : Math.abs(Number(value) || 0));
    for (const effect of effects) {
        const [kind, amount = ''] = String(effect).split(':');
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
            const who = someone();
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
    return said;
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
    if (modelNarrates() || !lastCompendium?.has?.('frases')) return '';
    const rows = lastCompendium.find('frases', {});
    const random = createSeededRandom(derive(String(chat_metadata?.[METADATA_KEY] || ''), 'narrador', moment, String(chat.length)));
    // J1.4: con quién juega, para que «llegáis empapados» sea «empapadas» si toca.
    const told = narrateMoment({ rows, moment, facts: { ...facts, generos: whoPlays(facts) }, random, recent: chat_metadata?.[NARRATOR_RECENT_KEY] });
    if (chat_metadata && told.used.length > 0) chat_metadata[NARRATOR_RECENT_KEY] = rememberUsed(chat_metadata[NARRATOR_RECENT_KEY], told.used);
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
        text: sayGendered(text.trim()),
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
    const foes = Object.entries(count).map(([name, n]) => (n > 1 ? `${name} (${n})` : name));
    const told = tellMoment('tablero', {
        tablero: boardName,
        objetivo: goal ? goal[0].toLocaleLowerCase('es') + goal.slice(1) : '',
        enemigos: listNames(foes),
    });
    if (told) void postEngineLine(told);
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
 * @param {{show?: string}} [options] `show`: lo que se ve si cuenta el motor (Z1).
 * @returns {Promise<void>}
 */
export async function postForModel(text, options = {}) {
    if (typeof text !== 'string' || !text.trim()) return;

    const message = buildGameMessage({
        // J1.4: el modelo también lee «entera», no «{entero|entera}».
        text: sayGendered(substituteParams(text.trim())),
        channel: CHANNEL.MODEL,
        name: chat_metadata?.narrator_name || 'Narrador',
        avatar: system_avatar,
        timestamp: getMessageTimeStamp(),
        compact: true,
    });
    // El modelo lee la nota entera; en pantalla sale solo lo que pasó, sin la orden al
    // narrador («Cuéntalo en un párrafo…»), que sin modelo se leía como un error y con él
    // como una instrucción colada (ROADMAP_SIN_TOKENS, Z0).
    const { said } = splitModelNote(message.mes);
    // Z1: si cuenta el motor, lo que se ve es su prosa (el modelo sigue leyendo los hechos).
    const shown = !modelNarrates() && typeof options?.show === 'string' && options.show.trim() ? sayGendered(options.show.trim()) : said;
    if (shown !== message.mes) /** @type {any} */ (message.extra).display_text = shown;

    chat.push(message);
    await eventSource.emit(event_types.MESSAGE_RECEIVED, chat.length - 1, 'game-engine');
    addOneMessage(message);
    await eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, chat.length - 1, 'game-engine');
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
            badge.textContent = initialsOf(who);
            badge.style.setProperty('--sp-hue', String(hueOf(who)));
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
    const card = $('<div class="rc-card" role="status"></div>');
    card.append($('<div class="rc-title"></div>').text(recap.title));
    for (const line of recap.lines) card.append($('<div class="rc-line"></div>').text(line));
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
