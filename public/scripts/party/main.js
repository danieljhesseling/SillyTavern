import { POPUP_TYPE, Popup } from '../popup.js';
import {
    chat, chat_metadata, saveMetadata, eventSource, event_types, generateRaw, online_status, updateMessageBlock,
    name2,
} from '../../script.js';
import { extension_settings } from '../extensions.js';
import { shouldSendOnEnter } from '../RossAscends-mods.js';
import {
    getCurrentWorldMapUrl, getCurrentWorldLocationMaps, getCurrentWorldBoards, getCurrentWorldEnemies,
    loadWorldInfo, saveWorldInfo, createWorldInfoEntry, refreshWorldMapGlobals, METADATA_KEY,
} from '../world-info.js';
import { SlashCommandParser } from '../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument } from '../slash-commands/SlashCommandArgument.js';
import { SlashCommandEnumValue } from '../slash-commands/SlashCommandEnumValue.js';
import { addItemToInventory, removeItemFromInventory, createItem } from '../dnd-system.js';
import { escapeHtml, download } from '../utils.js';
import { createSeededRandom, seedFrom, rollWith } from '../game-engine/combat/seeded-random.js';
import { getCompendium } from '../game-engine/compendio/browser.js';
import { ensureSeed, derive, describeSeed } from '../game-engine/campaign/seed.js';
import {
    planTravel, reachFrom, travelEvents, describeTravel, rollWeather, DEFAULT_TRAVEL_EVENTS, MIN_DAYS,
} from '../game-engine/world/travel.js';
import { forgeItem as forgeFromCompendium, forgeItems, describeItem } from '../game-engine/compendio/forge.js';
import { makeNames } from '../game-engine/compendio/names.js';
import { breedMonster as breedFromCompendium, breedBand, describeMonster } from '../game-engine/compendio/bestiary.js';
import { writeQuest as writeFromCompendium, writeQuestBoard, describeQuest } from '../game-engine/compendio/quests.js';
import { writePerson as writePersonFromCompendium, writeVillage, describePerson } from '../game-engine/compendio/people.js';
import { racesOf, kindsOf, describeKin, validateKin } from '../game-engine/compendio/kin.js';
import {
    newsFor, describeFaction, priceFactor, rollFactions, validateFactionRows, namesOf, standingWith,
} from '../game-engine/campaign/factions.js';
import { marketPressure, warPressure } from '../game-engine/campaign/economy.js';
import {
    abilitiesFor, classesOf, nameAndAbility, validateAbilities, asAbility,
} from '../game-engine/compendio/skills.js';
import { rollDiceDetailed, getDistanceInFeet, setRandomSource, nextRandom } from './combat-rules.js';
import { weaponOf as heldWeapon } from '../game-engine/rules/equipment.js';
// R3 del roadmap de profundidad: áreas, elementos, usos fuera del combate y jugadas en pareja.
import { travelShortcut, watchBonus, duelTricks, whoCan } from '../game-engine/rules/field-uses.js';
// R5 del roadmap de profundidad: la mascota.
import { petDoes, petName } from '../game-engine/campaign/pet.js';
// R8 y R9 del roadmap de profundidad: compañeros con arco, y el mundo que responde.
import { favorDiscount } from '../game-engine/campaign/companion-arcs.js';
import { rumorsFromPlay } from '../game-engine/campaign/world-echoes.js';
// R7 del roadmap de profundidad: enemigos con cabeza, y la némesis.
// H2 de wiki/LO_QUE_FALTA.md: «Cómo se juega», con lo que el motor sabe.
import { buildHowToPlay } from '../game-engine/campaign/how-to-play.js';
import { getMapLegend } from '../game-engine/campaign/campaign-pack-schema.js';
// B1 y B2 de wiki/LO_QUE_FALTA.md: la altura y las salidas del tablero.
// T1, T2 y B3 de wiki/LO_QUE_FALTA.md: la palanca, la barricada, la tregua y los refuerzos.
// T4: la estación y la magia, en los precios.
import { seasonalMarket, magicStance } from '../game-engine/campaign/season-market.js';
// T3: la gente del mundo ve a la mascota.
// R6: los jefes con fases.
// R6 del roadmap de profundidad: tableros con intención.
// R4: pergaminos y varitas.
import { judgeMagicItems } from '../game-engine/rules/magic-items.js';
// R4 del roadmap de profundidad: la magia, solo la del grimorio.
import {
    grimoireAbilities, spellById, spellsForClass, spendCharge, knownSpells,
} from '../game-engine/rules/grimoire.js';
import { stanceOf, STANCES } from '../game-engine/combat/ally-ai.js';
import { judgeManeuvers } from '../game-engine/combat/maneuvers.js';
import { THROWABLES, judgeThrows } from '../game-engine/combat/throwables.js';
import { hasMaster, lessonsHere } from '../game-engine/campaign/masters.js';
import { startGame, drawDie, stand, cheat, payout, describeGame, roundsLeft, BETS } from '../game-engine/campaign/tavern-dice.js';
import { MOUNTS, addMount, mountedDays, describeMounts } from '../game-engine/world/mounts.js';
import { assignRoles, rollRoles, describeRoles } from '../game-engine/world/travel-roles.js';
import { describeSecrets } from '../game-engine/campaign/npc-secrets.js';
import { checkWorldDensity, gemRequest } from '../game-engine/campaign/world-density.js';
import { sceneryNear, judgeSceneryThrow } from '../game-engine/combat/throwables.js';
import { canCraft, cloakItem, upgradedWeapon, RECIPES } from '../game-engine/campaign/trophies.js';
import { seasonClimates, describeSeason } from '../game-engine/world/seasons.js';
import { canCamp, nightRisk, defaultGuards, resolveNight, campMorning, MAX_GUARDS } from '../game-engine/campaign/camp.js';
import { respecCost } from '../game-engine/rules/respec.js';
import { offerChips } from '../game-engine/campaign/item-offers.js';
import { nextTone, describeTone, readTone } from '../game-engine/campaign/scene-tone.js';
import { makeShareCode } from '../game-engine/campaign/share-code.js';
import { talkPairs, campTalkPrompt, makePeace, roundPrompt, topicHits, TOPICS } from '../game-engine/campaign/camp-talk.js';
import { stealDC, stealOutcome, guardsAt, settleGuards } from '../game-engine/campaign/crime.js';
import { hirelingsHere } from '../game-engine/campaign/guests.js';
import { HUB_HEROES_KEY, restingUids } from '../game-engine/campaign/hub-heroes.js';
import { seaLegs, fareFor, sailingDays, describeVoyage } from '../game-engine/world/ships.js';
import { previewOf, describePreview } from '../game-engine/campaign/world-preview.js';
import { readIllustrationSettings, promptFor, buildRequest, imageFrom } from '../game-engine/campaign/illustrations.js';
import { newPerson, newPlace } from '../game-engine/campaign/director.js';
import { toggleCondition } from '../game-engine/combat/initiative-tracker.js';
import { hasAction } from '../game-engine/combat/turn-machine.js';
import { holdDuringCombat } from '../game-engine/combat/combat-hold.js';
import { healInjuries, describeInjuries, treatmentCost } from '../game-engine/rules/injuries.js';
import { describeNeeds } from '../game-engine/rules/needs.js';
import { describeMode as describeGameMode } from '../game-engine/rules/modes.js';
import { readRemedies, remediesFor, applyRemedy } from '../game-engine/rules/remedies.js';
import { borrow, repay, LOAN } from '../game-engine/campaign/patronage.js';
import {
    gravesAt, readGraves, readHall, describeHallEntry, describeHallCount,
} from '../game-engine/campaign/legacy.js';
import { addFame, fameAt, fameNote, describeFame } from '../game-engine/campaign/fame.js';
import { templeWork, identify, liftCurse, TEMPLE_PRICES } from '../game-engine/campaign/item-lore.js';
import { SKILLS, checkOptions, rollCheck, skillModifier } from '../game-engine/rules/checks.js';
import {
    PACES, readPace, paceDays, paceEvents, isSetback, setbackChoice, resolveSetback, FORCE_DC, FORCE_HURT, RUSH_REST_HOURS,
} from '../game-engine/world/travel-choices.js';
import { shiftFortune, fortuneLine } from '../game-engine/world/fortune.js';
import { deliverNews } from '../game-engine/world/news.js';
import { buildJournal, buildHelp, pendingByPlace } from '../game-engine/campaign/guidance.js';
import { listNames, daysText } from '../game-engine/campaign/engine-narrator.js';
import { keepSpeech } from '../game-engine/campaign/talk.js';
import { addNotice, unseenCount, glanceRow, MAX_VISIBLE_TOASTS } from '../game-engine/ui/shell/notices.js';
import { addRequest, readRequests } from '../game-engine/campaign/check-requests.js';
import { roadTrouble } from '../game-engine/campaign/world-memory.js';
import { readSession, enterScene, noteSent, noteClick, describeSession } from '../game-engine/campaign/session-log.js';
import { describeUpcoming } from '../game-engine/campaign/upcoming.js';
import { handFrom, duelOutcome } from '../game-engine/campaign/word-duel.js';
import { readCases, cluesHere } from '../game-engine/campaign/cases.js';
import { mapRows, describeRoute, setNote } from '../game-engine/campaign/text-map.js';
import { chronicleOf, chronicleSections } from '../game-engine/campaign/chronicle.js';
import {
    focusOf, secretsOf, omensOf, daysLeftOf, cluesOf, closedOf, readPlotState,
} from '../game-engine/campaign/plot.js';
import { nextRumor, describeRumor } from '../game-engine/campaign/rumors.js';
import { canExplore, readProposals, addProposal } from '../game-engine/world/growth.js';
import { ToolManager } from '../tool-calling.js';
import { servicesOf, serviceActions, SERVICE_INFO } from '../game-engine/campaign/services.js';
import { withJob } from '../game-engine/campaign/company.js';
import { prisonerChips, dealWith, BOUNTY } from '../game-engine/campaign/prisoners.js';
import { findShortcut, applyShortcut, roadEncounter, roadStop } from '../game-engine/world/road.js';
import { diceStats, readRolls } from '../game-engine/campaign/dice-log.js';
import { basePrice, weeklyStock, priceToday, sellPrice, canSell, junkOf } from '../game-engine/campaign/shop.js';
import { festivalsOf, festivalToday, daysUntil } from '../game-engine/world/festivals.js';
import { readLetters, newLetters } from '../game-engine/campaign/letters.js';
import { bump, describeStats } from '../game-engine/campaign/stats.js';
import { intentSkills } from '../game-engine/campaign/intents.js';
import { readBox } from '../game-engine/campaign/read-box.js';
import { GLOSSARY, MOMENT_TIPS } from '../game-engine/ui/shell/tips.js';
import { LENGTHS, nextLength } from '../game-engine/campaign/narration.js';
import { heroStory } from '../game-engine/campaign/feats.js';
import { forageCheck, forageResult } from '../game-engine/campaign/forage.js';
import { recruitActions, arrivalLines } from '../game-engine/campaign/recruit.js';
import { memoryLines, lastMemoryWith } from '../game-engine/campaign/memories.js';
import { relieve, readNeeds } from '../game-engine/rules/needs.js';
import { generateBoard } from '../game-engine/world-builder/dungeon-generator.js';
import { readReasons } from '../game-engine/rules/companions.js';
import { describeLootItem, declaredLootNames } from '../game-engine/combat/loot-items.js';
import {
    formatCalendar,
} from '../game-engine/campaign/calendar.js';
import { getBondProgress, BOND_EVENTS } from '../game-engine/campaign/bonds.js';
import { summariseContradictions } from '../game-engine/ui/contradiction-log.js';
import { knownAbilities, usesLeft, canUseAbility, describeAbility } from '../game-engine/rules/abilities.js';
import { normalizeCheckpoints, describeCheckpoint, CHECKPOINT_KEY } from '../game-engine/campaign/checkpoint.js';
import {
    isShellOpen, toggleGameShell, refreshGameShell, closeGameShell,
} from '../game-engine/ui/shell/game-shell.js';
import { buildDialogueView } from '../game-engine/ui/shell/dialogue-scene.js';
import { buildExplorationView } from '../game-engine/ui/shell/exploration-scene.js';
import { buildClockView, availableHitDice } from '../game-engine/ui/shell/clock-widget.js';
import { buildActionChips } from '../game-engine/ui/shell/action-chips.js';
import { buildPackFromWorld, describeExport } from '../game-engine/campaign/campaign-export.js';
import { normalizePack, validatePack } from '../game-engine/campaign/campaign-pack.js';
import {
    APPROVAL_KEY, ARRIVALS_HEARD_KEY, ART_STORAGE, BOARD_KEY, CASES_KEY, CHECK_REQUESTS_KEY, COLORBLIND_KEY,
    CONTRADICTIONS_KEY, DEBT_KEY, DEEDS_KEY, DICE_GAME_KEY, DICE_LOG_KEY, FAME_KEY, FESTIVAL_TOLD_KEY,
    GAME_SHELL_AUTOSTART_KEY, GRAVES_KEY, HAGGLE_KEY, HINTS_KEY, LEAVE_ON_KEY, LENGTH_KEY, LETTERS_KEY,
    LETTERS_SENT_KEY, MAP_NOTES_KEY, MEMORIES_KEY, MOUNTS_KEY, NARRATOR_FONT_KEY, NARRATOR_MODE_STORAGE, NEWS_KEY,
    OFFERS_KEY, PENDING_CHECK_KEY, PLOT_KEY, PLOT_STATE_KEY, PRISONERS_KEY, PROPOSALS_KEY, ROLL_GUARD_KEY,
    RUMORS_HEARD_KEY, RUMORS_HEARD_ON_KEY, SAFETY_ON_KEY, SAVER_KEY, SECRETS_KEY, SEED_KEY, SESSION_LOG_KEY,
    STATS_KEY, SUCESOS_STORAGE, TAKEN_KEY, TONE_KEY, VISITED_KEY, WANTED_KEY, WEATHER_TODAY_KEY,
    WEEK_TABLE_AUTO_KEY, localFlag,
} from './keys.js';
import {
    combatEncounter, currentBoardName, currentLocationName, narratorTurn, partyMembers, setCurrentBoardName,
    setCurrentLocationName, setNarratorTurn, setTalkingTo, setTypedIntents, setWorldItemCatalogue, talkingTo,
    typedIntents, worldItemCatalogue,
} from './state.js';
import { syncCurse } from './sheet.js';
import { restoreCheckpoint, saveCheckpoint } from './checkpoints.js';
import { getXpTable, respecMember } from './level-up.js';
import { currentPet, openPetPanel, petMeetsTown, petTricks } from './pet.js';
import {
    carriedNames, getAbilityCatalogue, learnAbility, learnFromScroll, neededComponents, openAbilitiesEditor,
    openGrimoire, useAbility, useMagicItem,
} from './magic.js';
import { hireMercenary } from './contracts.js';
import { hubChips, openGuild, openHubCampaigns, openHubHire, skipHubTrial } from './hub.js';
import { askAboutCase, askTheDead, duelWith, openCaseBoard, playDuel, searchCaseHere, startCase } from './cases.js';
import {
    getAliveEnemies, getAttackableEnemiesForMember, getCurrentActingMember, getCurrentTurnEntry,
    getPartyMemberByTurnEntry, getRemainingMovementFeet, saveCombatState,
} from './combat-state.js';
import { buildEnemyIntents } from './enemy-turn.js';
import {
    answerTruce, endCombat, judgeCurrentScenario, leaveThroughExit, resolveAllyTurnAction, retreatFromCombat,
    startCombat, startWaitingFight, waitingSummary,
} from './combat-flow.js';
import {
    confirmEndTurn, endPlayerCombatTurn, handleBatonPass, handlePlayerCombatAttack, handlePlayerCombatMove,
    hideCheck, performManeuver, resolveUltimateStrike, throwItem, throwScenery,
} from './player-actions.js';
import {
    closedDoorsNearParty, enterBoard, getActiveBoardContext, isBoardWon, placePartyAtStart, stairsHere,
    threadBoardsHere, toggleBoardDoor,
} from './board.js';
import {
    lastWaiting, loadLocationMapsVisibility, locationMapsManuallyHidden, renderLocationMapsPreview,
    renderWorldMapPreview, setLocationMapsHidden,
} from './board-view.js';
import {
    applyCampaignRuleset, biomeHere, campaignCompendium, currentSeason, enemiesInSeason, ensureWorldData,
    getLocationBoards, hereLocation, lastCompendium, lastConfidantEntries, lastHubHome, lastRumors, lastWorldNpcs,
    lastWorldSeason, loadedWorldName, reloadWorldFactions, saveCurrentBoard, saveCurrentLocation, seedOfWorld,
    weatherHere, worldNpc,
} from './world.js';
import {
    bannerOf, friendlyFactions, getCurrentWorldFactions, nudgeRuler, rulerOf, shiftFactionStanding,
} from './factions.js';
import {
    advanceCampaignDay, advanceCampaignSlot, campaignDay, currentUpkeepRules, getCampaignBonds,
    getCampaignCalendar, getCampaignMap, getCurrentSlotLabel, getDebt, openWeekTable, recordCampaignBondEvent,
    renderCampaignTab, showWeeklyBill, takeRest, whatComes,
} from './time.js';
import { ensurePlot, getPlot, notePlot, openEnding, openMilestones, revealLocations } from './plot.js';
import {
    exploreHere, noteDeed, populatePlace, proposeFact, refreshWorldMemoryPrompt, worldWrite,
} from './world-growth.js';
import { openGameMode, survivalNow } from './modes.js';
import {
    NARRATOR_FONTS, NARRATOR_HINTS, NARRATOR_LABELS, NARRATOR_MODES, applyColorblind, applyNarratorFont,
    applyRollGuard, decorateSpeakers, getRollGuardMode, narratorMode, numberWord, offlineGame, playSucesos,
    postCombatNarration, postEngineLine, postForModel, recordContradictions, retryLastReply, saverOn,
    scheduleFoldChat, showRecap, showTip, storedNarratorMode, sucesosOn, tellBoard, tellMoment, unfoldedMessages,
} from './narration.js';
import {
    getDndEntryType, getPartyEntryDisplayName, loadPartyForChat, memberFromEntry, partyPurse, payFromParty,
    renderPartyMembers, savePartyState, showCharacterPicker, syncPartyWithEntries, updatePartyMemberFromPersona,
} from './roster.js';
import {
    changeAttitude, currentRecruits, favorsHere, hireRecruit, judgeDecision, meetRecruit, openCompanionCard,
    partyMorale, setMemberStance,
} from './companions.js';
import {
    acceptOffer, askNarrator, askingNarrator, boxContext, currentReplies, draftInChat, lookAt, lookChips,
    namesInLastNarration, offerItem, pryNpc, readTheBox, readingBox, routeTyped, runSkillCheck, speakingWith,
    startTalk,
} from './talk.js';

/** @typedef {import('./types.js').PartyMember} PartyMember */


/** @typedef {import('./types.js').DndCatalog} DndCatalog */


// ============================================================
//  WORLD MAP, LOCATION, AND BOARD VIEWS
// ============================================================


// ============================================================
//  COMBAT ENCOUNTER STATE
// ============================================================


/**
 * Computes live highlight cells (movement range + attackable enemies) from a tentative drag position.
 * Used by world-map-renderer onTokenDragging callback during drag.
 * @param {number} tokenId
 * @param {number} tentGX
 * @param {number} tentGY
 * @param {number} gridW
 * @param {number} gridH
 * @returns {import('../world-map-renderer.js').HighlightCell[]}
 */


/**
 * Switches the right-hand panel tab. Defined inside initPartyPanel, so it is handed out
 * here once that has run.
 * @type {((tab: 'party'|'world_map'|'location'|'campaign') => void)|null}
 */
export let partyTabSetter = null;


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
 * El turno de un companero que se lleva solo.
 *
 * Decide con **su propia maquina** (`ally-ai.js`), no con la de los enemigos: una IA que
 * vale para un goblin no vale para alguien a quien le tienes carino. Sigue la postura que
 * le has puesto en su ficha, no sale del alcance de nadie andando y se retira malherido.
 * Lo que decide lo aplica **por los mismos caminos que usarias tu**: mover cuesta pies,
 * atacar gasta la accion y tira contra la misma CA.
 *
 * @param {any} entry
 * @returns {string}
 */


// ================================================================
//  Campaign clock and bonds (wiki/ROADMAP.md, Fase D)
// ================================================================


/**
 * Como esta el mercado donde esta el grupo.
 *
 * Un paso cerrado no es solo un rodeo: es comida que no llega. Sin facciones ni caminos
 * cerrados devuelve 1 y la cuenta sale como salia siempre.
 *
 * @returns {any}
 */
export function currentMarket() {
    return marketPressure({
        here: currentLocationName,
        locations: getCurrentWorldLocationMaps(),
        factions: getCurrentWorldFactions(),
    });
}


/** Ideas 69 y 70: el mapa en texto, con niebla y con notas. */
async function openTextMap() {
    if (!chat_metadata) return;
    const rows = mapRows({
        locations: getCurrentWorldLocationMaps(),
        here: currentLocationName,
        visited: chat_metadata[VISITED_KEY] ?? [],
        notes: chat_metadata[MAP_NOTES_KEY] ?? {},
        friendly: friendlyFactions(),
        season: currentSeason(),
        done: readPlotState(chat_metadata[PLOT_STATE_KEY]).done,
    });
    const body = $('<div class="tm-root gs-panel"></div>');
    body.append($('<h3 class="gs-popup-title"></h3>').text('El mapa'));
    body.append($('<p class="tm-intro"></p>').text('Lo que no habéis pisado sale en gris, y un camino que no sale de ningún sitio conocido no se sabe adónde lleva. Cada sitio admite una nota tuya.'));
    for (const row of rows) {
        const item = $('<div class="tm-place"></div>').attr('data-state', row.state).attr('data-place', row.name);
        item.append($('<div class="tm-name"></div>').text(`${row.name}${row.state === 'aqui' ? ' · aquí' : row.state === 'sin-visitar' ? ' · sin visitar' : ''}`));
        for (const route of row.routes) item.append($('<div class="tm-route"></div>').toggleClass('tm-unknown', !route.known).text(describeRoute(route)));
        const note = $('<input type="text" class="text_pole tm-note" maxlength="140" placeholder="Una nota tuya…">').val(row.note);
        note.on('change', () => {
            chat_metadata[MAP_NOTES_KEY] = setNote(chat_metadata?.[MAP_NOTES_KEY], row.name, String(note.val() ?? ''));
            saveMetadata();
        });
        item.append(note);
        body.append(item);
    }
    await new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', allowVerticalScrolling: true, leftAlign: true }).show();
}


/** @type {import('../game-engine/campaign/session-log.js').SessionLog|null} */
let sessionLog = null;

/** @returns {import('../game-engine/campaign/session-log.js').SessionLog} */
function currentSessionLog() {
    if (!sessionLog) {
        let raw = null;
        try {
            raw = JSON.parse(sessionStorage.getItem(SESSION_LOG_KEY) || 'null');
        } catch {
            raw = null;
        }
        sessionLog = readSession(raw, Date.now());
    }
    return sessionLog;
}

/** @param {import('../game-engine/campaign/session-log.js').SessionLog} next */
function keepSessionLog(next) {
    sessionLog = next;
    try {
        sessionStorage.setItem(SESSION_LOG_KEY, JSON.stringify(next));
    } catch {
        // Sin almacenamiento se sigue contando en memoria: se pierde al recargar, y ya.
    }
}

/** Tu sesión: minutos por escena, mensajes, llamadas y botones. */
async function openSessionLog() {
    const { getSession } = await import('../game-engine/ui/prompt-preview.js');
    const lines = describeSession(currentSessionLog(), Date.now(), getSession());
    const body = $('<div class="sl-root"></div>');
    body.append($('<h3></h3>').text('Tu sesión'));
    for (const line of lines) body.append($('<p class="sl-line"></p>').text(line));
    // R1: y en qué modo se juega.
    body.append($('<p class="sl-line sl-mode"></p>').text(`Modo: ${describeGameMode(survivalNow())}.`));
    body.append($('<p class="sl-hint"></p>').text('Si has escrito algo en el chat porque no había un botón para ello, apúntalo: es lo que más ayuda a decidir qué construir.'));
    // U2 del pegamento: y lo que el juego da por cierto, clave a clave.
    const state = $('<button type="button" class="menu_button sl-state"></button>').text('Ver lo que el juego da por cierto');
    state.on('click', () => { void openStateView(); });
    body.append(state);
    await new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Seguir jugando' }).show();
}


/** U2 del pegamento: el panel del estado. */
async function openStateView() {
    const { openStatePanel } = await import('../game-engine/ui/state-panel.js');
    await openStatePanel({ metadata: chat_metadata ?? {}, Popup, POPUP_TYPE });
}


/**
 * Escuchar lo que se cuenta aqui.
 *
 * Uno cada vez, sin repetir. Si lleva a un sitio escondido, oirlo lo pone en el mapa: es la
 * forma mas natural de descubrir.
 *
 * @returns {Promise<string>}
 */
export async function hearRumor(by = '') {
    await ensureWorldData();
    if (combatEncounter.active) {
        toastr.warning('No en mitad de un combate.');
        return '';
    }
    const heard = Array.isArray(chat_metadata?.[RUMORS_HEARD_KEY]) ? chat_metadata[RUMORS_HEARD_KEY] : [];
    // R9: primero lo que se cuenta de vosotros, luego lo del guion.
    const played = rumorsFromPlay(chronicleOf(Array.isArray(chat) ? chat : []), { told: heard })
        .map(r => ({ id: r.id, text: r.text, where: currentLocationName, by: 'Alguien en la taberna', truth: '', leadsTo: '' }));
    // Z2: preguntado a alguien, lo que cuenta él.
    const pool = by ? lastRumors.filter(r => String(r.by || '').toLowerCase() === String(by).toLowerCase()) : [...played, ...lastRumors];
    const rumor = by
        ? pool.find(r => !heard.includes(r.id)) ?? null
        : nextRumor({ rumors: pool, here: currentLocationName, heard });
    if (!rumor) {
        toastr.info('Aquí ya no se cuenta nada que no hayas oído.');
        return '';
    }
    chat_metadata[RUMORS_HEARD_KEY] = [...heard, rumor.id];
    countStat('rumors');
    // Idea 91: cuando se oyo, para saber si ya se ha enfriado.
    chat_metadata[RUMORS_HEARD_ON_KEY] = {
        ...(chat_metadata[RUMORS_HEARD_ON_KEY] ?? {}),
        [rumor.id]: Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1)),
    };
    saveMetadata();
    if (rumor.leadsTo) await revealLocations([rumor.leadsTo]);
    await postForModel(`[RUMOR] ${describeRumor(rumor)}`);
    // Idea 72: a veces, de paso, alguien menciona un camino de pastores.
    await learnShortcut(String(rumor.id));
    if (isShellOpen()) refreshGameShell();
    return rumor.text;
}

// ================================================================
//  El mundo crece mientras juegas (wiki/archivo/ROADMAP_MUNDOS_VIVOS.md, fase G)
// ================================================================


// ================================================================
//  Servicios de cada sitio (wiki/archivo/ROADMAP_MUNDOS_VIVOS.md, fase L)
// ================================================================


/** Los avisos del juego, guardados para la bandeja (idea 159). */
/** @type {import('../game-engine/ui/shell/notices.js').Notice[]} */
let notices = [];
/** Cuando se abrio la bandeja por ultima vez: lo de despues esta sin ver. */
let noticesSeenAt = 0;

/**
 * Idea 159: cada aviso del juego se guarda en la bandeja, y en pantalla nunca hay mas de
 * tres a la vez, para que no tapen los botones. Solo con el Modo Juego abierto: fuera,
 * SillyTavern avisa como siempre.
 */
function installNoticeTray() {
    const t = /** @type {any} */ (toastr);
    if (t.gameTrayInstalled) return;
    t.gameTrayInstalled = true;
    for (const kind of ['info', 'success', 'warning', 'error']) {
        const original = t[kind].bind(t);
        t[kind] = (/** @type {any} */ message, /** @type {any} */ title, /** @type {any} */ opts) => {
            const shown = original(message, title, opts);
            if (isShellOpen()) {
                notices = addNotice(notices, { kind, title: String(title ?? ''), message: String(message ?? ''), at: Date.now() });
                trimToasts();
                const badge = document.querySelector('.gs-tray-count');
                if (badge) badge.textContent = String(unseenCount(notices, noticesSeenAt) || '');
            }
            return shown;
        };
    }
}

/** Dejar a la vista solo los tres ultimos avisos. */
function trimToasts() {
    const shown = $('#toast-container .toast');
    if (shown.length <= MAX_VISIBLE_TOASTS) return;
    const newestOnTop = Boolean(/** @type {any} */ (toastr).options?.newestOnTop);
    (newestOnTop ? shown.slice(MAX_VISIBLE_TOASTS) : shown.slice(0, shown.length - MAX_VISIBLE_TOASTS)).remove();
}

/** La bandeja: los ultimos avisos, el mas nuevo arriba. */
function openNoticeTray() {
    const body = $('<div class="nt-root gs-panel"></div>');
    body.append($('<h3 class="gs-popup-title"></h3>').text('Avisos'));
    if (notices.length === 0) body.append($('<div class="jr-item"></div>').text('Nada todavía.'));
    const now = Date.now();
    for (const notice of [...notices].reverse()) {
        const row = $('<div class="nt-row"></div>').addClass(`nt-${notice.kind}`).toggleClass('nt-new', notice.at > noticesSeenAt);
        const ago = Math.max(0, Math.round((now - notice.at) / 60000));
        row.append($('<div class="nt-head"></div>').text(`${notice.title || 'Aviso'}${notice.count > 1 ? ` ×${notice.count}` : ''}`
            + ` · ${ago === 0 ? 'ahora' : `hace ${ago} min`}`));
        if (notice.message) row.append($('<div class="nt-text"></div>').text(notice.message));
        body.append(row);
    }
    noticesSeenAt = now;
    if (isShellOpen()) refreshGameShell();
    void new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', allowVerticalScrolling: true, leftAlign: true }).show();
}

/** Idea 162: el grupo de un vistazo. */
function openPartyGlance() {
    const bonds = getCampaignBonds();
    const body = $('<div class="pg-root gs-panel"></div>');
    body.append($('<h3 class="gs-popup-title"></h3>').text('El grupo'));
    let gold = 0;
    for (const member of partyMembers) {
        const row = glanceRow(member, {
            injuries: describeInjuries(member),
            needs: describeNeeds(member),
            rank: member === partyMembers[0] ? 0 : getBondProgress(bonds, String(member.id)).rank,
        });
        gold += row.gold;
        const box = $('<div class="pg-row"></div>').addClass(`pg-${row.state}`);
        const head = $('<div class="pg-head"></div>');
        head.append($('<span class="pg-name"></span>').text(row.name));
        head.append($('<span class="pg-hp"></span>').text(`PG ${row.hp}`));
        head.append($('<span class="pg-gold"></span>').text(`${row.gold} de oro`));
        box.append(head);
        box.append($('<div class="pg-bar"></div>').append($('<div class="pg-fill"></div>').css('width', `${row.pct}%`)));
        // Idea 61: lo que lleva en la mano.
        const weapon = heldWeapon(member);
        box.append($('<div class="pg-line pg-weapon"></div>').text(weapon ? `Lleva: ${weapon.name}${weapon.damageDice ? ` (${weapon.damageDice})` : ''}` : 'Pelea con las manos'));
        for (const line of row.lines) box.append($('<div class="pg-line"></div>').text(line));
        // Idea 57: su historia, de lo que el motor ya apunto.
        const story = $('<button type="button" class="menu_button pg-story"></button>').text('Su historia');
        story.on('click', () => openHeroStory(member));
        box.append(story);
        body.append(box);
    }
    body.append($('<div class="pg-total"></div>').text(`Oro del grupo: ${gold}`));
    // Idea 39: la moral, con lo que da.
    body.append($('<div class="pg-morale"></div>').text(`Moral: ${partyMorale().label}`));
    void new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', allowVerticalScrolling: true, leftAlign: true }).show();
}

/** El contador de tokens del ultimo turno, ya escrito (idea 147). */
/** @type {{text: string, title: string, high: boolean}|null} */
let lastMeter = null;

/**
 * Idea 68: cazar y forrajear. Gasta un bloque del dia; tira quien mejor mire.
 *
 * @returns {string}
 */
function runForage() {
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
    advanceCampaignSlot();
    if (roll) postCombatNarration(roll.said);
    postCombatNarration(`🌿 [CAMPO] ${result.line}`);
    toastr.info(result.line, 'Cazar y forrajear', { timeOut: 7000 });
    if (isShellOpen()) refreshGameShell();
    return result.line;
}

/**
 * Idea 86: lo que en este sitio se sabe del grupo, para que la gente salude con eso.
 *
 * @returns {{place: string, lines: string[]}|null}
 */
export function localMemory() {
    if (!currentLocationName || !chat_metadata) return null;
    const place = currentLocationName.toLowerCase();
    const said = (Array.isArray(chat_metadata[DEEDS_KEY]) ? chat_metadata[DEEDS_KEY] : [])
        .filter((/** @type {any} */ d) => String(d?.text ?? '').toLowerCase().includes(place))
        .slice(-2)
        .map((/** @type {any} */ d) => String(d.text));
    const fortune = fortuneLine(hereLocation());
    // Idea 52: si aquí os conocen. Idea 36: quién está enterrado aquí.
    const fame = fameNote(chat_metadata[FAME_KEY], currentLocationName);
    const buried = gravesAt(chat_metadata[GRAVES_KEY], currentLocationName).map(g => `Aquí está enterrado ${g.name}.`);
    const lines = [fortune, fame, ...buried, ...said].filter(Boolean);
    return lines.length > 0 ? { place: currentLocationName, lines } : null;
}

/**
 * Idea 52: sumar fama en un sitio, y avisar si se sube un peldaño.
 *
 * @param {string} place
 * @param {number} [amount]
 */
export function raiseFame(place, amount = 1) {
    if (!chat_metadata || !String(place ?? '').trim()) return;
    const out = addFame(chat_metadata[FAME_KEY], String(place), amount);
    chat_metadata[FAME_KEY] = out.fame;
    saveMetadata();
    if (out.rose) toastr.success(`En ${place} ${out.label}.`, '🌟 Fama', { timeOut: 8000 });
}


/**
 * Idea 200: sumar a la partida en numeros.
 *
 * @param {'fights'|'wins'|'fled'|'deaths'|'gold'|'rumors'|'trips'|'contracts'} key
 * @param {number} [amount]
 */
export function countStat(key, amount = 1) {
    if (!chat_metadata) return;
    chat_metadata[STATS_KEY] = bump(chat_metadata[STATS_KEY], key, amount);
    saveMetadata();
}

/** @returns {string[]} La partida en numeros, en lineas. */
export function statsLines() {
    return describeStats(chat_metadata?.[STATS_KEY], {
        days: Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1)),
        places: getCurrentWorldLocationMaps().length,
    });
}


/**
 * Vender: cada cosa la vende quien la lleva, y el oro va a su bolsa (ideas 118 y L5).
 *
 * @param {Array<{memberId: string, itemId: string, name: string, price: number}>} sales
 */
function sellItems(sales) {
    let total = 0;
    for (const sale of sales) {
        const member = partyMembers.find(m => String(m.id) === sale.memberId);
        if (!member) continue;
        removeItemFromInventory(/** @type {any} */ (member), sale.itemId);
        member.gold = (Number(member.gold) || 0) + sale.price;
        total += sale.price;
    }
    if (total === 0) return;
    savePartyState();
    countStat('gold', total);
    postCombatNarration(`🪙 [TIENDA] Vendéis ${sales.map(s => s.name).join(', ')}: ${total} de oro.`);
    toastr.success(`${total} de oro`, 'Vendido', { timeOut: 5000 });
}

/** Idea 126: regatear, una vez al dia en cada tienda. */
async function haggle() {
    if (!chat_metadata) return;
    const who = partyMembers.filter(m => (Number(m.hp) || 0) > 0)
        .reduce((/** @type {any} */ top, m) => (!top || skillModifier(m, 'persuasion').modifier > skillModifier(top, 'persuasion').modifier ? m : top), null);
    if (!who) return;
    // U6 del pegamento: regatear es un duelo de tres rondas. El tendero de cada sitio tiene
    // siempre la misma postura: la semilla del mundo y el sitio la deciden.
    const random = createSeededRandom(derive(String(chat_metadata?.[METADATA_KEY] || ''), 'tendero', currentLocationName));
    const stance = ['codicioso', 'desconfiado', 'orgulloso'][Math.floor(random() * 3) % 3];
    const keeper = `El tendero de ${currentLocationName || 'aquí'}`;
    const bonds = getCampaignBonds();
    const hand = handFrom({
        modifiers: {
            persuasion: skillModifier(who, 'persuasion').modifier,
            deception: skillModifier(who, 'deception').modifier,
            intimidation: skillModifier(who, 'intimidation').modifier,
        },
        companions: partyMembers.filter(m => m !== who && !m.dead).map(m => ({ name: String(m.name), rank: getBondProgress(bonds, String(m.id)).rank })),
        allowCoin: false,
        tricks: [...duelTricks(who), ...petTricks()],
    });
    const final = await playDuel({ npc: { name: keeper, stance }, patience: 7, hand, rounds: 3, speaker: String(who.name), what: 'rebajar el precio' });
    const outcome = duelOutcome(final) ?? 'no-cede';
    const discount = outcome === 'cede' ? 0.2 : outcome === 'a-medias' ? 0.1 : 0;
    chat_metadata[HAGGLE_KEY] = {
        place: currentLocationName,
        day: Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1)),
        ok: discount > 0,
        discount,
    };
    saveMetadata();
    // Un regateo no merece una llamada al modelo: se cuenta en el chat y ya.
    postCombatNarration(`🛒 [TIENDA] ${who.name} regatea con ${keeper.toLowerCase()}: ${discount > 0 ? `${Math.round(discount * 100)} % menos para hoy${outcome === 'a-medias' ? ', a medias' : ''}` : 'no cede, hoy al precio que hay'}.`);
    if (isShellOpen()) refreshGameShell();
}


/**
 * Idea 113: leer una carta, contarla y guardarla en la cronica.
 *
 * @param {string} id
 * @returns {Promise<void>}
 */
async function readLetter(id) {
    if (!chat_metadata) return;
    const letters = readLetters(chat_metadata[LETTERS_KEY]);
    const letter = letters.find(l => l.id === id);
    if (!letter) return;
    chat_metadata[LETTERS_KEY] = letters.filter(l => l.id !== id);
    saveMetadata();
    noteDeed(`Carta de ${letter.from}: ${letter.text}`);
    await postForModel(`[CARTA] ${letter.text} Cuéntalo como una carta que os dan en la posada: el papel, la letra, quién la trae. No inventes nada más de lo que dice.`);
}

/** Idea 113: las cartas de hoy, a la posada. */
export function writeLetters() {
    if (!chat_metadata) return;
    const debt = getDebt();
    const today = Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1));
    const sent = Array.isArray(chat_metadata[LETTERS_SENT_KEY]) ? chat_metadata[LETTERS_SENT_KEY].map(String) : [];
    const fresh = newLetters({
        factions: getCurrentWorldFactions(),
        debt: debt ? { amount: Number(debt.owed) || Number(debt.amount) || 0, due: Number(debt.dueDay) || 0, creditor: debt.patronName } : null,
        today,
        sent,
    });
    if (fresh.length === 0) return;
    chat_metadata[LETTERS_KEY] = [...readLetters(chat_metadata[LETTERS_KEY]), ...fresh].slice(-4);
    chat_metadata[LETTERS_SENT_KEY] = [...sent, ...fresh.map(l => l.id)].slice(-60);
    saveMetadata();
    toastr.info(fresh.map(l => l.from).join(', '), 'Hay cartas para vosotros en la posada', { timeOut: 7000 });
}

/** Idea 156: el glosario, en una ventana. */
function openGlossary() {
    const body = $('<div class="gl-root"></div>');
    body.append($('<h3></h3>').text('Glosario'));
    for (const entry of GLOSSARY) {
        const row = $('<div class="gl-row"></div>');
        row.append($('<div class="gl-term"></div>').text(entry.term));
        row.append($('<div class="gl-means"></div>').text(entry.means));
        body.append(row);
    }
    void new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', allowVerticalScrolling: true, leftAlign: true }).show();
}


/**
 * Las fiestas del mundo abierto (idea 89), por sitio.
 *
 * @returns {Record<string, {day: number, name: string}>}
 */
export function worldFestivals() {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    return festivalsOf(getCurrentWorldLocationMaps(), key => createSeededRandom(derive(worldName, 'fiesta', key)));
}

/** @returns {{day: number, name: string}|null} La fiesta de hoy aqui. */
function festivalHere() {
    return festivalToday(worldFestivals(), currentLocationName, Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1)));
}

/** Idea 89: contar la fiesta de hoy, una vez. */
export function tellFestival() {
    const festival = festivalHere();
    if (!festival || !chat_metadata) return;
    const today = Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1));
    const stamp = `${today}:${currentLocationName}`;
    if (chat_metadata[FESTIVAL_TOLD_KEY] === stamp) return;
    chat_metadata[FESTIVAL_TOLD_KEY] = stamp;
    saveMetadata();
    const line = `Hoy es ${festival.name} en ${currentLocationName}: la comida de la posada corre a cuenta del pueblo y en la tienda rebajan.`;
    toastr.success(line, '¡Fiesta!', { timeOut: 9000 });
    void postForModel(`[FIESTA] ${line} Que se note en la calle: música, gente, puestos. No inventes nada más.`);
}


/**
 * La tienda de aqui esta semana (ideas 118, 126, 127 y 134), con sus precios de hoy.
 *
 * @returns {{stock: Array<{name: string, price: number, reasons: string[]}>, reasons: string[], haggled: boolean, triedToday: boolean}}
 */
function shopHere() {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    const today = Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1));
    const week = Math.floor((today - 1) / 7);
    const ruler = rulerOf(currentLocationName);
    const market = currentMarket();
    const haggle = chat_metadata?.[HAGGLE_KEY];
    const triedToday = Boolean(haggle && haggle.place === currentLocationName && Number(haggle.day) === today);
    const haggled = triedToday && Boolean(haggle.ok);
    // U6 del pegamento: lo que rebajó el duelo, si lo dice; si no, lo de siempre.
    const haggleOff = haggled ? (Number(haggle.discount) > 0 ? Number(haggle.discount) : true) : false;
    const names = weeklyStock({
        names: declaredLootNames(),
        describe: (name) => describeLootItem(name),
        random: createSeededRandom(derive(worldName, 'tienda', currentLocationName, String(week))),
        reputation: Number(ruler?.reputation) || 0,
        // Idea 122: el aceite y la red, siempre. R4: y lo que gastan los conjuros que sabéis.
        always: [...Object.values(THROWABLES).map(t => t.name), ...neededComponents()],
    });
    // Idea 84: con una guerra en marcha, el acero se paga caro.
    const war = warPressure({ here: currentLocationName, factions: getCurrentWorldFactions() });
    // Idea 52: donde os conocen, os lo dejan mejor.
    const fame = fameAt(chat_metadata?.[FAME_KEY], currentLocationName);
    // T4: la estación y cómo ve la magia quien manda aquí.
    const season = currentSeason();
    const stance = magicStance(ruler);
    const stock = names.flatMap(name => {
        const spec = describeLootItem(name);
        const steel = ['weapon', 'armor'].includes(String(spec.category));
        const food = Number(market?.food) || 1;
        const seasonal = seasonalMarket({ name, spec, season, magic: stance, ruler: String(ruler?.name ?? '') });
        if (seasonal.banned) return [];
        return [{
            name,
            ...priceToday({
                base: basePrice(spec),
                market: Math.round((steel ? food * war.steel : food) * seasonal.factor * 100) / 100,
                marketReasons: [...(Array.isArray(market?.reasons) ? market.reasons : []), ...(steel ? war.reasons : []), ...seasonal.reasons],
                // R8: y si quien atiende os aprecia, un poco menos.
                standing: (ruler ? priceFactor(Number(ruler.reputation) || 0) : 1) * (1 - favorDiscount(favorsHere(), 'tienda').discount),
                ruler: String(ruler?.name ?? ''),
                haggled: haggleOff,
                festival: Boolean(festivalHere()),
                fame: { discount: fame.discount, label: fame.label },
            }),
        }];
    });
    return { stock, reasons: [...new Set(stock.flatMap(s => s.reasons))], haggled, triedToday };
}

/**
 * Idea 7: que hacer con un prisionero.
 *
 * @param {string} what interrogar, entregar o soltar.
 * @param {string} id
 * @returns {Promise<string>}
 */
async function handlePrisoner(what, id) {
    if (!chat_metadata) return '';
    const kind = /^interrog/i.test(what) ? 'ask' : /^entreg/i.test(what) ? 'give' : 'free';
    const { prisoner, prisoners } = dealWith(chat_metadata[PRISONERS_KEY], id, kind);
    if (!prisoner) {
        toastr.warning('No hay ningún prisionero así.');
        return '';
    }
    chat_metadata[PRISONERS_KEY] = prisoners;
    saveMetadata();
    // Idea 28: lo que les parece a los tuyos lo que haces con él.
    judgeDecision(kind === 'ask' ? 'interrogar' : kind === 'give' ? 'entregar-prisionero' : 'soltar-prisionero');
    if (kind === 'ask') {
        const heard = Array.isArray(chat_metadata[RUMORS_HEARD_KEY]) ? chat_metadata[RUMORS_HEARD_KEY] : [];
        const rumor = lastRumors.find(r => !heard.includes(r.id));
        if (!rumor) {
            await postForModel(`[INTERROGATORIO] ${prisoner.name} no sabe nada que no sepáis ya. Cuéntalo en una frase.`);
            return 'nada';
        }
        chat_metadata[RUMORS_HEARD_KEY] = [...heard, rumor.id];
        chat_metadata[RUMORS_HEARD_ON_KEY] = { ...(chat_metadata[RUMORS_HEARD_ON_KEY] ?? {}), [rumor.id]: Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1)) };
        saveMetadata();
        if (rumor.leadsTo) await revealLocations([rumor.leadsTo]);
        await postForModel(`[INTERROGATORIO] ${prisoner.name} acaba contando lo que sabe: ${rumor.text} `
            + 'Cuéntalo en su voz, a regañadientes. No inventes nada más.');
        return rumor.text;
    }
    if (kind === 'give') {
        const holder = partyMembers.find(m => (m.hp || 0) > 0) ?? partyMembers[0];
        if (holder) holder.gold = (Number(holder.gold) || 0) + BOUNTY;
        savePartyState();
        const place = currentLocationName.toLowerCase();
        const rulers = getCurrentWorldFactions().find(f => String(f.seat ?? '').toLowerCase() === place
            || (f.holds ?? []).some((/** @type {string} */ h) => String(h).toLowerCase() === place));
        if (rulers) void shiftFactionStanding(String(rulers.id), 1);
        noteDeed(`Entregasteis a ${prisoner.name} en ${currentLocationName}${rulers ? ` (${rulers.name} lo agradece)` : ''}.`);
        toastr.success(`+${BOUNTY} de oro${rulers ? ` · ${rulers.name} os mira mejor` : ''}`, `${prisoner.name}, entregado`);
        return 'entregado';
    }
    noteDeed(`Soltasteis a ${prisoner.name}.`);
    postCombatNarration(`🕊️ [CAMPAÑA] ${prisoner.name} se va sin mirar atrás.`);
    return 'suelto';
}

/**
 * Idea 72: un atajo que se oye en la posada, con la semilla del mundo.
 *
 * @param {string} about
 * @returns {Promise<void>}
 */
function learnShortcut(about) {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName) return Promise.resolve();
    return worldWrite(async () => {
        const data = await loadWorldInfo(worldName);
        const maps = data?.metadata?.locationMaps;
        if (!Array.isArray(maps)) return;
        const shortcut = findShortcut({
            locations: maps, from: currentLocationName,
            random: createSeededRandom(derive(seedOfWorld(data.metadata), 'atajo', about)),
        });
        if (!shortcut) return;
        data.metadata.locationMaps = applyShortcut(maps, shortcut);
        await saveWorldInfo(worldName, data, true);
        await refreshWorldMapGlobals(worldName);
        const line = `Un camino de pastores acorta el viaje entre ${shortcut.from} y ${shortcut.to}: ${shortcut.days} día(s).`;
        noteDeed(line);
        toastr.info(line, 'Un atajo', { timeOut: 9000 });
        void postForModel(`[ATAJO] De paso, alguien menciona esto: ${line} Cuéntalo en una frase.`);
    });
}


/** Idea 168: el historial de dados, con sus cuentas. */
function openDiceHistory() {
    const stats = diceStats(chat_metadata?.[DICE_LOG_KEY]);
    const body = $('<div class="dl-root gs-panel"></div>');
    body.append($('<h3 class="gs-popup-title"></h3>').text('Los dados'));
    body.append($('<div class="jr-item"></div>').text(stats.count > 0
        ? `${stats.count} tiradas de d20 · media ${String(stats.average).replace('.', ',')} · ${stats.twenties} veintes · ${stats.ones} unos`
            + (stats.judged > 0 ? ` · ${stats.passed} de ${stats.judged} salieron` : '')
        : 'Todavía no se ha tirado nada.'));
    body.append($('<div class="jr-item dl-verdict"></div>').text(stats.verdict));
    const last = readRolls(chat_metadata?.[DICE_LOG_KEY]).slice(-12).reverse();
    if (last.length > 0) body.append($('<div class="jr-title"></div>').text('Las últimas'));
    for (const roll of last) {
        body.append($('<div class="jr-item dl-roll"></div>').text(`${roll.title}: ${roll.natural}${roll.dc !== null ? ` (total ${roll.total} contra ${roll.dc})` : ''}`));
    }
    void new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', allowVerticalScrolling: true, leftAlign: true }).show();
}

/**
 * Idea 57: la historia de alguien del grupo.
 *
 * @param {any} member
 */
function openHeroStory(member) {
    const lines = heroStory({
        member,
        deeds: Array.isArray(chat_metadata?.[DEEDS_KEY]) ? chat_metadata[DEEDS_KEY] : [],
        memories: Array.isArray(chat_metadata?.[MEMORIES_KEY]) ? chat_metadata[MEMORIES_KEY] : [],
    });
    const body = $('<div class="hs-root"></div>');
    body.append($('<h3></h3>').text(`La historia de ${member.name}${member.nickname ? ` «${member.nickname}»` : ''}`));
    if (lines.length === 0) body.append($('<div class="jr-item"></div>').text('Todavía no ha pasado nada que contar.'));
    for (const line of lines) body.append($('<div class="jr-item"></div>').text(line));
    void new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', allowVerticalScrolling: true, leftAlign: true }).show();
}


/** Idea 100: el diario, con lo que el grupo sabe. */
/**
 * El diario, sin fallar en silencio: si algo no se puede montar, se dice y queda en la consola
 * con su traza, en vez de que el botón no haga nada.
 */
export function openJournalSafely() {
    try {
        openJournal();
    } catch (error) {
        console.error('[party] el diario no se pudo abrir', error);
        toastr.error('El diario no se ha podido abrir. Queda anotado en la consola.', 'Diario');
    }
}

function openJournal() {
    const today = Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1));
    const heardIds = Array.isArray(chat_metadata?.[RUMORS_HEARD_KEY]) ? chat_metadata[RUMORS_HEARD_KEY] : [];
    const heard = heardIds
        .map((/** @type {string} */ id) => lastRumors.find(r => r.id === id))
        .filter(Boolean)
        .map((/** @type {any} */ r) => ({
            text: r.text, by: r.by, where: r.where, leadsTo: r.leadsTo,
            day: Number(chat_metadata?.[RUMORS_HEARD_ON_KEY]?.[r.id]) || 0,
        }));
    const sections = buildJournal({
        // Idea 106: lo que tiene plazo lo dice.
        open: openMilestones().map(m => {
            const left = daysLeftOf(getPlot(), chat_metadata?.[PLOT_STATE_KEY], m.id, today);
            return left == null ? m : { ...m, title: `${m.title} (${left === 0 ? 'hoy es el último día' : `quedan ${left} día(s)`})` };
        }),
        clues: chat_metadata?.[HINTS_KEY]?.clues ?? {},
        taken: chat_metadata?.[TAKEN_KEY] ?? null,
        today,
        heard,
        memories: memoryLines(chat_metadata?.[MEMORIES_KEY], today),
        deeds: Array.isArray(chat_metadata?.[DEEDS_KEY]) ? chat_metadata[DEEDS_KEY] : [],
    });
    // U3 del pegamento: lo que viene, de todos los relojes a la vez. Lo primero del diario.
    const coming = describeUpcoming(whatComes(today), 8);
    if (coming.length > 0) sections.unshift({ title: 'Lo que viene', items: coming });
    // Idea 114: el presagio, con lo que ya se ha cumplido.
    const omens = omensOf(getPlot(), chat_metadata?.[PLOT_STATE_KEY]);
    if (omens.length > 0) sections.push({ title: 'El presagio', items: omens.map(o => `${o.fulfilled ? '✓' : '·'} «${o.text}»`) });
    // Idea 111: los secretos, sin decir cuáles faltan.
    const secrets = secretsOf(getPlot(), chat_metadata?.[PLOT_STATE_KEY]);
    if (secrets.total > 0) {
        sections.push({ title: `Secretos de la historia (${secrets.found.length} de ${secrets.total})`, items: secrets.found.length > 0 ? secrets.found : ['Ninguno todavía. Hay cosas que se encuentran sin buscarlas.'] });
    }
    // Idea 107: las investigaciones, con lo que falta y dónde.
    for (const case107 of cluesOf(getPlot(), chat_metadata?.[PLOT_STATE_KEY])) {
        sections.push({
            title: `Investigación: ${case107.title} (${case107.found} de ${case107.need} pistas)`,
            items: case107.missing.map(c => `Falta: ${SKILLS[/** @type {keyof typeof SKILLS} */ (c.skill)]?.label ?? c.skill} en ${c.place}`),
        });
    }
    // Idea 102: los caminos que se cerraron.
    const closed = closedOf(getPlot(), chat_metadata?.[PLOT_STATE_KEY]);
    if (closed.length > 0) sections.push({ title: 'Caminos cerrados', items: closed });
    // Idea 110: lo que sabéis de la gente.
    const pried = describeSecrets(chat_metadata?.[SECRETS_KEY]);
    if (pried.length > 0) sections.push({ title: 'Lo que sabéis de la gente', items: pried });
    // Idea 129: las monturas.
    const mounts = describeMounts(chat_metadata?.[MOUNTS_KEY]);
    if (mounts) sections.push({ title: 'Monturas', items: [mounts] });
    // Idea 52: dónde os conocen.
    const known = describeFame(chat_metadata?.[FAME_KEY]);
    if (known.length > 0) sections.push({ title: 'Dónde os conocen', items: known });
    // Idea 36: quien se quedó por el camino.
    const graves = readGraves(chat_metadata?.[GRAVES_KEY]);
    if (graves.length > 0) sections.push({ title: 'Los que se quedaron', items: graves.map(g => g.epitaph) });
    // Idea 200: mientras se juega, la partida en numeros tambien esta en el diario.
    sections.push({ title: 'La partida en números', items: statsLines() });
    // U4 del pegamento: lo que el mundo recuerda son los hechos; la crónica es todo lo que
    // pasó, sacado de lo que el juego ya contó en el chat, por categorías y con filtro.
    const remembered = sections.find(s => s.title === 'Crónica');
    if (remembered) remembered.title = 'Lo que el mundo recuerda';
    const told = chronicleSections(chronicleOf(chat), { limit: 8 });
    const body = $('<div class="jr-root gs-panel"></div>');
    body.append($('<h3 class="gs-popup-title"></h3>').text('Diario'));
    for (const section of sections) {
        body.append($('<div class="jr-title"></div>').text(section.title));
        for (const item of section.items) body.append($('<div class="jr-item"></div>').text(item));
    }
    if (told.length > 0) {
        body.append($('<div class="jr-title"></div>').text('Crónica'));
        const filters = $('<div class="jr-filters"></div>');
        filters.append($('<button type="button" class="menu_button jr-filter jr-filter-on" data-cat=""></button>').text('Todo'));
        for (const section of told) filters.append($('<button type="button" class="menu_button jr-filter"></button>').attr('data-cat', section.category).text(section.title));
        body.append(filters);
        for (const section of told) {
            for (const item of section.items) {
                body.append($('<div class="jr-item jr-chron"></div>').attr('data-cat', section.category).text(`${section.title}: ${item}`));
            }
        }
        body.on('click', '.jr-filter', function () {
            const only = String($(this).attr('data-cat') || '');
            body.find('.jr-filter').removeClass('jr-filter-on');
            $(this).addClass('jr-filter-on');
            body.find('.jr-chron').each(function () {
                $(this).toggle(!only || $(this).attr('data-cat') === only);
            });
        });
    }
    void new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', allowVerticalScrolling: true, leftAlign: true }).show();
}


/** Idea 136: todo lo que se puede hacer ahora, junto y pulsable. */
export function openHelp() {
    const sections = buildHelp({
        focus: focusOf(getPlot(), chat_metadata?.[PLOT_STATE_KEY], campaignDay()),
        services: buildServiceCards(),
        boards: currentBoardName ? [] : getLocationBoards(hereLocation()).map((/** @type {any} */ b) => String(b.name)),
        chips: buildShellChips().map(c => ({ id: c.id, label: c.label })),
        places: neighbourPlaces().length,
        fighting: Boolean(combatEncounter.active),
        engineReads: narratorMode() === 'motor',
    });
    showHelpSections('¿Qué puedo hacer aquí?', sections);
}

/**
 * Z3: un edificio de aquí, con lo que se puede hacer dentro: «voy a la posada».
 *
 * @param {string} serviceId
 * @returns {void}
 */
export function openService(serviceId) {
    const card = buildServiceCards().find(c => c.id === serviceId);
    if (!card) return;
    const line = tellMoment('servicio', { servicio: serviceId });
    if (line) void postEngineLine(line);
    showHelpSections(card.label, [{
        title: 'Qué se puede hacer',
        items: card.actions.map(a => ({ label: a.label, detail: a.detail, key: a.enabled ? `service:${a.id}` : '' })),
    }]);
}

/**
 * La ventana de «¿Qué puedo hacer aquí?»: secciones de cosas que se pulsan.
 *
 * @param {string} title
 * @param {Array<{title: string, items: Array<{label: string, detail: string, key: string}>}>} sections
 * @returns {void}
 */
function showHelpSections(title, sections) {
    const body = $('<div class="hp-root gs-panel"></div>');
    body.append($('<h3 class="gs-popup-title"></h3>').text(title));
    /** @type {Popup|null} */
    let popup = null;
    for (const section of sections) {
        body.append($('<div class="jr-title"></div>').text(section.title));
        for (const item of section.items) {
            const row = item.key
                ? $('<button type="button" class="menu_button hp-item"></button>').attr('data-key', item.key)
                : $('<div class="hp-item hp-still"></div>');
            row.append($('<span class="hp-label"></span>').text(item.label));
            if (item.detail) row.append($('<span class="hp-detail"></span>').text(item.detail));
            if (item.key) {
                row.on('click', () => {
                    void popup?.completeCancelled();
                    runHelpItem(item.key);
                });
            }
            body.append(row);
        }
    }
    popup = new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', allowVerticalScrolling: true, leftAlign: true });
    void popup.show();
}

/** @param {string} key */
function runHelpItem(key) {
    const [kind, ...rest] = key.split(':');
    const value = rest.join(':');
    if (kind === 'journal') openJournal();
    else if (kind === 'glossary') openGlossary();
    else if (kind === 'service') void runService(value);
    else if (kind === 'board') {
        enterBoard(value);
        renderLocationMapsPreview();
        if (isShellOpen()) refreshGameShell();
    } else if (kind === 'chip') {
        const chip = buildShellChips().find(c => c.id === value);
        if (chip) runShellChip(chip);
    }
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
 * Idea 85: mover la fortuna de un sitio, y contar si abre o cierra algo.
 *
 * @param {string} place
 * @param {number} delta
 * @returns {Promise<void>}
 */
export function shiftPlaceFortune(place, delta) {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName || !place) return Promise.resolve();
    return worldWrite(async () => {
        const data = await loadWorldInfo(worldName);
        const maps = data?.metadata?.locationMaps;
        if (!Array.isArray(maps)) return;
        const index = maps.findIndex((/** @type {any} */ l) => String(l?.name).toLowerCase() === place.toLowerCase());
        if (index < 0) return;
        const { location, change } = shiftFortune(maps[index], delta, servicesOf(maps[index]));
        maps[index] = location;
        await saveWorldInfo(worldName, data, true);
        await refreshWorldMapGlobals(worldName);
        if (change) {
            noteDeed(change);
            toastr.info(change, place, { timeOut: 8000 });
            void postForModel(`[EL MUNDO CAMBIA] ${change} Que se note cuando el grupo pase por allí, sin inventar más.`);
        }
        if (isShellOpen()) refreshGameShell();
    });
}

/** @returns {boolean} Si aqui hay herreria: es donde se hacen los remedios (DL1). */
export function smithHere() {
    const here = hereLocation();
    return Boolean(here) && servicesOf(here).includes('herreria');
}

/** @returns {string[]} Donde hay herreria, para decirlo cuando aqui no la hay. */
export function smithPlaces() {
    return getCurrentWorldLocationMaps()
        .filter((/** @type {any} */ l) => servicesOf(l).includes('herreria'))
        .map((/** @type {any} */ l) => String(l.name));
}

/**
 * Los servicios de aqui, con lo que se puede hacer en cada uno, ya juzgado.
 *
 * @returns {ReturnType<typeof serviceActions>}
 */
export function buildServiceCards() {
    const location = hereLocation();
    if (!location || !chat_metadata) return [];
    const purse = partyPurse();
    const table = readRemedies();
    const remedies = partyMembers.flatMap(m => remediesFor(m, purse, table)
        .map(option => ({ id: option.injuryId, name: String(m.name), label: option.remedy.label, cost: option.remedy.cost })));
    const price = Number(currentUpkeepRules().healingPerDay) || 5;
    const cure = partyMembers.reduce((total, m) => {
        const cost = treatmentCost(m, price);
        return { gold: total.gold + cost.gold, days: Math.max(total.days, cost.days) };
    }, { gold: 0, days: 0 });
    const innkeeper = lastWorldNpcs.find(n => n.service === 'posada'
        && n.where.toLowerCase() === String(currentLocationName).toLowerCase())?.name ?? '';

    const cards = serviceActions({
        location,
        purse,
        partySize: partyMembers.length,
        fighting: combatEncounter.active,
        companions: partyMembers.slice(1).filter(m => !m.dead).map(m => ({ id: String(m.id), name: String(m.name) })),
        rumors: rumorsLeftHere(),
        innkeeper,
        remedies,
        cure,
        // Idea 135: lo que hay que llevar al templo.
        relics: (() => {
            const work = templeWork(partyMembers);
            return { unknown: work.unknown.length, cursed: work.cursed.length, identify: TEMPLE_PRICES.identify, lift: TEMPLE_PRICES.lift };
        })(),
    });
    // Idea 89: dia de fiesta, la comida corre a cuenta del pueblo.
    const feast = festivalHere();
    const innCard = cards.find(card => card.id === 'posada');
    const meal = innCard?.actions.find(a => a.id === 'inn-meal');
    if (feast && meal) Object.assign(meal, { cost: 0, enabled: !combatEncounter.active, label: 'Comer caliente (gratis: es fiesta)', detail: `Hoy es ${feast.name}.` });
    // Idea 129: el establo de la posada. Idea 128: los dados.
    if (innCard) {
        for (const [id, mount] of Object.entries(MOUNTS)) {
            innCard.actions.push({
                id: `inn-mount:${id}`, label: `Comprar ${id === 'mula' ? 'una mula' : 'un caballo'} (${mount.price} de oro)`,
                detail: `Para ir montados hace falta una por cabeza. Come ${mount.feedPerWeek} de oro de pienso a la semana.`,
                enabled: !combatEncounter.active && purse >= mount.price, cost: mount.price, target: id,
            });
        }
        const diceToday = roundsLeft(chat_metadata?.[DICE_GAME_KEY], currentLocationName, Math.max(1, campaignDay()));
        if (!diceToday.banned && diceToday.left > 0) {
            innCard.actions.push({
                id: 'inn-dice', label: `Jugar a los dados: a veintiuno (${diceToday.left} hoy)`,
                detail: 'Se apuesta, se piden dados y se suma. Quien se pasa de 21, pierde.',
                enabled: !combatEncounter.active && purse >= BETS[0], cost: 0,
            });
        }
    }
    // Idea 54: en los pueblos, quien enseña.
    if (hasMaster(location) && lastCompendium?.has?.('habilidades')) {
        /** @type {any[]} */
        const lessonActions = [];
        for (const member of partyMembers.filter(m => !m.dead)) {
            const className = String(/** @type {any} */ (member).charClass ?? /** @type {any} */ (member).class ?? '').toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            // R3/R4: quien enseña adelanta lo que tu clase aprendería más tarde (hasta dos
            // niveles), y a quien hace magia le enseña conjuros de su clase del grimorio. Lo
            // de tu nivel ya lo sabes: no se lo pagas a nadie.
            const level = Number(member.level) || 1;
            const now = new Set([
                ...abilitiesFor({ compendium: lastCompendium, className, level }).map((/** @type {any} */ a) => String(a.id)),
                ...spellsForClass({ className, level }),
            ]);
            // Y las técnicas de otros oficios: un maestro de armas enseña a quien pague.
            const crafts = lastCompendium.find('habilidades', { kind: 'habilidad' })
                .filter((/** @type {any} */ row) => row.when?.tree !== true && (Number(row.level) || 1) <= level + 2)
                .map(asAbility);
            const lessons = lessonsHere({
                candidates: [
                    ...crafts,
                    ...spellsForClass({ className, level: level + 2 }).map(id => grimoireAbilities().find(a => a.id === id)).filter(Boolean),
                ].filter((/** @type {any} */ a) => !now.has(String(a.id))),
                known: Array.isArray(member.abilities) ? member.abilities.map(String) : [],
                // La semilla del mundo y del sitio: el mismo maestro enseña siempre lo mismo.
                random: createSeededRandom(derive(String(chat_metadata?.[METADATA_KEY] || ''), 'maestro', String(currentLocationName))),
            });
            for (const lesson of lessons) {
                lessonActions.push({
                    id: `learn:${member.id}:${lesson.ability.id}`,
                    label: `${member.name}: aprender «${lesson.ability.name}» (${lesson.price} de oro, ${lesson.days} días)`,
                    detail: String(lesson.ability.description || ''),
                    enabled: !combatEncounter.active && purse >= lesson.price, cost: lesson.price, target: lesson.ability.id,
                });
            }
        }
        if (lessonActions.length > 0) cards.push({ id: 'maestro', label: 'Quien enseña', icon: 'fa-graduation-cap', actions: lessonActions.slice(0, 4) });
    }
    /** @param {'templo'|'herreria'} id @returns {any} */
    const cardOf = (id) => {
        if (!servicesOf(location).includes(id)) return null;
        let card = cards.find(c => c.id === id);
        if (!card) {
            card = { id, label: SERVICE_INFO[id].label, icon: SERVICE_INFO[id].icon, actions: [] };
            cards.push(card);
        }
        return card;
    };
    // Idea 58: en el templo se rehace quien quiera volver a elegir sus mejoras. Se paga al
    // confirmar: elegir puede acabar en no hacer nada.
    const temple = cardOf('templo');
    for (const member of temple ? partyMembers.filter(m => !m.dead) : []) {
        const cost = respecCost(member);
        if (cost <= 0) continue;
        temple.actions.push({
            id: `temple-respec:${member.id}`, label: `Rehacer a ${member.name}: volver a elegir sus mejoras (${cost} de oro)`,
            detail: purse < cost ? `No llega el oro: cuesta ${cost}.` : 'Se deshacen las que tiene y se eligen otras tantas, las que quiera.',
            enabled: !combatEncounter.active && purse >= cost, cost: 0, target: String(member.id),
        });
    }
    // Ideas 120 y 121: lo que el herrero hace con lo que traéis de caza.
    const smithy = cardOf('herreria');
    if (smithy) {
        const cloak = canCraft({ recipe: 'capa', party: partyMembers, purse });
        smithy.actions.push({
            id: 'craft:capa', label: `${RECIPES.capa.label} (${RECIPES.capa.gold} de oro y dos pieles)`,
            detail: cloak.reason || RECIPES.capa.note, enabled: !combatEncounter.active && cloak.ok, cost: 0,
        });
        for (const member of partyMembers.filter(m => !m.dead)) {
            const weapon = heldWeapon(member);
            if (!weapon) continue;
            const upgrade = canCraft({ recipe: 'mejora', party: partyMembers, purse, weapon });
            smithy.actions.push({
                id: `craft:mejora:${member.id}`,
                label: `Mejorar ${weapon.name} de ${member.name} (+1: ${RECIPES.mejora.gold} de oro y algo duro)`,
                detail: upgrade.reason || RECIPES.mejora.note, enabled: !combatEncounter.active && upgrade.ok, cost: 0, target: String(member.id),
            });
        }
    }
    // U8 del pegamento: el caso abierto, si queda algo por buscar aquí.
    const mystery = readCases(chat_metadata?.[CASES_KEY]);
    if (cluesHere(mystery, { place: currentLocationName }).length > 0) {
        cards.push({
            id: 'caso', label: 'El caso', icon: 'fa-magnifying-glass',
            actions: [{
                id: 'case-search', label: `Buscar pistas de «${mystery.active?.title}» aquí`,
                detail: 'Registrar el sitio y escuchar lo que se dice. Cuesta un rato del día; registrar pide Investigación.',
                enabled: !combatEncounter.active, cost: 0,
            }],
        });
    }
    // Idea 131: con un encargo entre manos, quien se alquila para él.
    if (innCard && chat_metadata?.[TAKEN_KEY]) {
        const hired = new Set(partyMembers.filter(m => m.guest).map(m => String(m.name)));
        const offers = hirelingsHere(createSeededRandom(derive(String(chat_metadata?.[METADATA_KEY] || ''), 'mercenario', currentLocationName, String(campaignDay()))), Number(partyMembers[0]?.level) || 1);
        for (const offer of offers.filter(o => !hired.has(o.name))) {
            innCard.actions.push({
                id: `inn-merc:${offer.name}`, label: `Pagar a ${offer.name} (${offer.className}) para este encargo (${offer.fee} de oro)`,
                detail: 'Pega como uno más y, acabado el encargo, se va.', enabled: !combatEncounter.active && purse >= offer.fee, cost: offer.fee, target: offer.name,
            });
        }
    }
    // Idea 113: las cartas que esperan, se recogen en la posada.
    if (innCard) {
        for (const letter of readLetters(chat_metadata?.[LETTERS_KEY]).slice(0, 2)) {
            innCard.actions.push({
                id: `inn-letter:${letter.id}`, label: `Leer la carta de ${letter.from}`,
                detail: 'Os la guardaban en la posada.', enabled: !combatEncounter.active, cost: 0, target: letter.id,
            });
        }
    }
    // Ideas 118, 126, 127 y 134: la tienda.
    if (servicesOf(location).includes('tienda')) {
        const shop = shopHere();
        const hero = partyMembers[0];
        const junk = junkOf(partyMembers);
        const sellable = partyMembers.flatMap(m => (m.items ?? []).filter((/** @type {any} */ i) => canSell(i, m))
            .map((/** @type {any} */ i) => ({ member: m, item: i, price: sellPrice(i) })))
            .filter(x => !junk.some(j => j.itemId === String(x.item.id)))
            .sort((a, b) => b.price - a.price)
            .slice(0, 2);
        /** @type {any[]} */
        const shopActions = shop.stock.map(offer => ({
            id: `shop-buy:${offer.name}`,
            label: `${offer.name} (${offer.price} de oro)`,
            detail: offer.reasons.length > 0 ? `Precio de hoy: ${offer.reasons.join(' · ')}` : 'Al precio de siempre.',
            enabled: !combatEncounter.active && Boolean(hero) && purse >= offer.price,
            cost: offer.price,
            target: offer.name,
        }));
        if (junk.length > 0) {
            const total = junk.reduce((sum, j) => sum + j.price, 0);
            shopActions.push({
                id: 'shop-junk', label: `Vender la chatarra (${junk.length} ${junk.length === 1 ? 'cosa' : 'cosas'}, ${total} de oro)`,
                detail: junk.map(j => j.name).slice(0, 6).join(', '), enabled: !combatEncounter.active, cost: 0,
            });
        }
        for (const sale of sellable) {
            shopActions.push({
                id: `shop-sell:${sale.member.id}:${sale.item.id}`, label: `Vender ${sale.item.name} (${sale.price} de oro)`,
                detail: `Lo lleva ${sale.member.name}.`, enabled: !combatEncounter.active, cost: 0,
            });
        }
        // Idea 96: llevarse lo más barato sin pagar, si se atreve alguien.
        const cheapest = [...shop.stock].sort((a, b) => a.price - b.price)[0];
        if (cheapest) {
            shopActions.push({
                id: `shop-steal:${cheapest.name}`, label: `Llevarse ${cheapest.name} sin pagar (Juego de manos, CD ${stealDC(String(location?.locationType ?? location?.type ?? ''))})`,
                detail: 'Si os pillan, multa del doble, y aquí os apuntan.', enabled: !combatEncounter.active, cost: 0, target: String(cheapest.price),
            });
        }
        if (!shop.triedToday) {
            shopActions.push({
                id: 'shop-haggle', label: 'Regatear: tres rondas con el tendero',
                detail: 'Una vez al día en cada tienda. Si cede, un 20 % menos hoy; a medias, un 10 %.', enabled: !combatEncounter.active, cost: 0,
            });
        }
        shopActions.push({ id: 'shop-prices', label: '¿Por qué estos precios?', detail: 'Lo que sube y lo que baja, parte a parte.', enabled: true, cost: 0 });
        // Idea 125: quien presta, con ventanilla. Una deuda a la vez.
        const debt = getDebt();
        if (!debt) {
            for (const amount of LOAN.amounts) {
                shopActions.push({
                    id: `lend:${amount}`, label: `Pedir prestados ${amount} de oro`,
                    detail: `Hay que devolver ${Math.ceil(amount * (1 + LOAN.interest))} en ${LOAN.days} días.`,
                    enabled: !combatEncounter.active, cost: 0, target: String(amount),
                });
            }
        } else if (!debt.contractId) {
            shopActions.push({
                id: 'repay', label: `Devolver lo que debéis (${debt.owed} de oro)`, detail: `A ${debt.patronName}.`,
                enabled: !combatEncounter.active && purse >= debt.owed, cost: 0,
            });
        }
        cards.push({ id: 'tienda', label: 'La tienda', icon: 'fa-shop', actions: shopActions });
    }

    // Idea 26: en la posada se busca compañia. Primero se conoce, luego se pide.
    const inn = cards.find(card => card.id === 'posada');
    if (inn) {
        // Idea 42: con el grupo lleno, el nuevo se va a casa.
        inn.actions.push(...recruitActions(currentRecruits(), {
            bench: true,
            fighting: combatEncounter.active, purse, partySize: partyMembers.length,
        }));
    }
    return cards;
}


/**
 * Ideas 120 y 121: el herrero convierte lo cazado en algo: una capa de pieles, o el arma a +1.
 *
 * @param {string} actionId `craft:capa` o `craft:mejora:<id>`.
 */
function craftAtSmith(actionId) {
    const [, recipe, memberId] = actionId.split(':');
    const member = recipe === 'mejora' ? partyMembers.find(m => String(m.id) === memberId) : partyMembers[0];
    const weapon = recipe === 'mejora' && member ? heldWeapon(member) : null;
    const plan = canCraft({ recipe, party: partyMembers, purse: partyPurse(), weapon });
    if (!plan.ok || !member) {
        toastr.warning(plan.reason || 'No se puede.', 'La herrería');
        return;
    }
    if (!payFromParty(plan.gold)) {
        toastr.warning(`No llega el oro: cuesta ${plan.gold}.`);
        return;
    }
    for (const used of plan.use) {
        const owner = partyMembers.find(m => String(m.id) === used.memberId);
        if (owner) removeItemFromInventory(/** @type {any} */ (owner), used.itemId);
    }
    const spent = plan.use.map(u => u.name).join(', ');
    let line = '';
    if (recipe === 'capa') {
        addItemToInventory(/** @type {any} */ (member), createItem(/** @type {any} */ (cloakItem())));
        line = `El herrero cose una capa de pieles para ${member.name} (${plan.gold} de oro, ${spent}).`;
    } else if (weapon) {
        Object.assign(weapon, upgradedWeapon(weapon));
        line = `El herrero mejora el arma de ${member.name}: ahora es ${weapon.name} (${plan.gold} de oro, ${spent}).`;
    }
    savePartyState();
    renderPartyMembers();
    postCombatNarration(`⚒️ [HERRERÍA] ${line}`);
    toastr.success(line, 'La herrería');
}

/**
 * Hacer algo en un servicio de aqui.
 *
 * @param {string} actionId
 * @returns {Promise<string>}
 */
export async function runService(actionId) {
    const action = buildServiceCards().flatMap(card => card.actions).find(a => a.id === actionId);
    if (!action || !action.enabled) {
        toastr.warning(action?.detail || 'Eso no se puede hacer aquí ahora.');
        return '';
    }
    // Los remedios se cobran solos, en `buyRemedy`: no se paga dos veces.
    const smith = actionId.startsWith('smith:');
    if (!smith && action.cost > 0 && !payFromParty(action.cost)) {
        toastr.warning(`No llega el oro: cuesta ${action.cost}.`);
        return '';
    }

    if (actionId === 'inn-common') await takeRest('corto');
    else if (actionId === 'inn-room') await takeRest('largo');
    else if (actionId === 'inn-meal') {
        for (const member of partyMembers) {
            member.needs = relieve(member, 'ate');
            member.needs = relieve(member, 'drank');
        }
        postCombatNarration(`🍲 [POSADA] Comida caliente para todos (${action.cost} de oro).`);
    } else if (actionId.startsWith('inn-round:')) {
        const member = partyMembers.find(m => String(m.id) === String(action.target));
        if (member) {
            // Idea 40: de qué se habla. Si toca lo que busca, cuenta como escena de confidente.
            const body = $('<div class="tr-setback"></div>');
            body.append($('<h3></h3>').text(`Una ronda con ${member.name}`));
            body.append($('<p></p>').text('¿De qué le preguntas?'));
            const ids = Object.keys(TOPICS);
            const picked = await new Popup(body[0], POPUP_TYPE.TEXT, '', {
                okButton: false, cancelButton: false,
                customButtons: ids.map((id, i) => ({ text: TOPICS[/** @type {keyof typeof TOPICS} */ (id)].label, result: 70 + i, classes: [`rt-${id}`] })),
            }).show();
            const topic = ids[Number(picked) - 70] ?? 'pasado';
            const hits = topicHits(topic, readReasons(member).wants);
            recordCampaignBondEvent(String(member.id), hits ? 'confidant_scene' : 'shared_downtime');
            advanceCampaignSlot();
            if (hits) toastr.success(`Le toca de cerca: ${member.name} se abre.`, 'La ronda');
            const shared = lastMemoryWith(chat_metadata?.[MEMORIES_KEY], String(member.name));
            await postForModel(roundPrompt({ member, topic, place: currentLocationName, shared }));
        }
    } else if (actionId.startsWith('inn-letter:')) await readLetter(String(action.target));
    else if (actionId.startsWith('shop-buy:')) {
        const hero = partyMembers[0];
        if (hero) {
            hero.items = hero.items ?? [];
            addItemToInventory(/** @type {any} */ (hero), createItem(/** @type {any} */ (describeLootItem(String(action.target)))));
            savePartyState();
            postCombatNarration(`🛒 [TIENDA] ${hero.name} compra ${action.target} por ${action.cost} de oro.`);
        }
    } else if (actionId === 'shop-junk') sellItems(junkOf(partyMembers));
    else if (actionId.startsWith('shop-steal:')) stealItem(actionId.slice('shop-steal:'.length), Number(action.target) || 0);
    else if (actionId.startsWith('inn-merc:')) hireMercenary(String(action.target));
    else if (actionId.startsWith('shop-sell:')) {
        const [, memberId, itemId] = actionId.split(':');
        const member = partyMembers.find(m => String(m.id) === memberId);
        const item = (member?.items ?? []).find((/** @type {any} */ i) => String(i.id) === itemId);
        if (member && item) sellItems([{ memberId, itemId, name: String(item.name), price: sellPrice(item) }]);
    } else if (actionId === 'case-search') await searchCaseHere();
    else if (actionId === 'shop-haggle') await haggle();
    else if (actionId === 'shop-prices') {
        const shop = shopHere();
        const said = shop.reasons.length > 0 ? shop.reasons.join('\n') : 'Hoy, al precio de siempre: ni el sitio está caro ni os tratan distinto.';
        void Popup.show.text('Los precios de hoy', said);
    } else if (actionId.startsWith('inn-meet:')) await meetRecruit(String(action.target));
    else if (actionId.startsWith('inn-hire:')) await hireRecruit(String(action.target));
    else if (actionId === 'inn-rumor') await hearRumor();
    else if (actionId === 'inn-talk') startTalk(String(action.target));
    else if (smith) {
        const [, injuryId, name] = actionId.split(':');
        const member = partyMembers.find(m => String(m.name) === name);
        if (member) buyRemedy(member, injuryId);
    } else if (actionId === 'temple-cure') {
        for (const member of partyMembers) {
            const patch = healInjuries(member, 9999);
            member.injuries = patch.injuries;
            member.baseStats = patch.baseStats;
            Object.assign(member, patch.stats);
        }
        await postForModel(`[TEMPLO] En el templo de ${currentLocationName} os cosen y os vendan (${action.cost} de oro). `
            + 'Las heridas que se curan con tiempo quedan cerradas. Cuéntalo en dos frases.');
    } else if (actionId === 'temple-identify') {
        // Idea 135: se mira cada cosa; lo maldito se dice.
        /** @type {string[]} */
        const said = [];
        for (const { memberId, itemId } of templeWork(partyMembers).unknown) {
            const member = partyMembers.find(m => String(m.id) === memberId);
            const index = (member?.items ?? []).findIndex((/** @type {any} */ i) => String(i.id) === itemId);
            if (!member || index < 0) continue;
            const seen = identify(/** @type {any} */ (member.items)[index]);
            /** @type {any} */ (member.items)[index] = seen.item;
            said.push(seen.line);
        }
        postCombatNarration(`🔎 [TEMPLO] ${said.join(' ')}`);
        void Popup.show.text('Lo que traéis', said.join('\n'));
    } else if (actionId === 'temple-lift') {
        /** @type {string[]} */
        const freed = [];
        for (const { memberId, itemId } of templeWork(partyMembers).cursed) {
            const member = partyMembers.find(m => String(m.id) === memberId);
            const index = (member?.items ?? []).findIndex((/** @type {any} */ i) => String(i.id) === itemId);
            if (!member || index < 0) continue;
            freed.push(String(/** @type {any} */ (member.items)[index].name));
            /** @type {any} */ (member.items)[index] = liftCurse(/** @type {any} */ (member.items)[index]);
            syncCurse(member);
        }
        postCombatNarration(`🕯️ [TEMPLO] Quitan la maldición: ${freed.join(', ')}. Ya se puede soltar.`);
    } else if (actionId.startsWith('inn-mount:')) {
        // Idea 129: ya está pagada; al establo.
        if (chat_metadata) chat_metadata[MOUNTS_KEY] = addMount(chat_metadata[MOUNTS_KEY], String(action.target));
        postCombatNarration(`🐴 [POSADA] En el establo: ${describeMounts(chat_metadata?.[MOUNTS_KEY])}.`);
    } else if (actionId === 'inn-dice') await playTavernDice();
    else if (actionId.startsWith('temple-respec:')) await respecMember(String(action.target));
    else if (actionId.startsWith('craft:')) craftAtSmith(actionId);
    else if (actionId.startsWith('learn:')) {
        const [, memberId, abilityId] = actionId.split(':');
        await learnAbility(memberId, abilityId);
    } else if (actionId.startsWith('lend:')) {
        // Idea 125: pedir prestado porque se quiere.
        const lent = borrow({ amount: Number(action.target), today: Math.max(1, campaignDay()), here: currentLocationName, debt: getDebt() });
        const holder = partyMembers.find(m => !m.dead) ?? partyMembers[0];
        if (lent.debt && holder && chat_metadata) {
            chat_metadata[DEBT_KEY] = lent.debt;
            holder.gold = (Number(holder.gold) || 0) + lent.debt.amount;
            noteDeed(`${lent.debt.patronName} os prestó ${lent.debt.amount} de oro.`);
            void postForModel(`💰 [CAMPAÑA] ${lent.line}`);
            toastr.info(lent.line, 'Préstamo', { timeOut: 10000 });
        } else toastr.warning(lent.line);
    } else if (actionId === 'repay') {
        const paid = repay(getDebt(), partyPurse());
        if (paid.ok && payFromParty(paid.pay) && chat_metadata) {
            delete chat_metadata[DEBT_KEY];
            noteDeed(paid.line);
            postCombatNarration(`💰 [CAMPAÑA] ${paid.line}`);
            toastr.success(paid.line, 'Deuda saldada', { timeOut: 10000 });
        } else toastr.warning(paid.line);
    } else if (actionId === 'board') await openGuild();

    savePartyState();
    saveMetadata();
    renderPartyMembers();
    if (isShellOpen()) refreshGameShell();
    return action.label;
}

// ================================================================
//  Lo que dicen los companeros en combate (C7)
// ================================================================


/**
 * Idea 67: si aquí se puede acampar.
 *
 * @returns {{ok: boolean, reason: string}}
 */
function campHere() {
    const here = hereLocation();
    return canCamp({ locationType: String(here?.locationType ?? here?.type ?? ''), fighting: combatEncounter.active });
}

/**
 * Idea 67: acampar. El fuego, las guardias, con quién se charla y si se busca cena; y lo
 * que pase de noche. Luego se duerme como un descanso largo.
 *
 * @returns {Promise<string>}
 */
async function campNight() {
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
        // R5: la mascota también vigila.
        perceptionOf: (/** @type {any} */ m) => perception(m) + watchBonus(living).amount + (petDoes(currentPet(), 'guardia') ? 2 : 0),
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
 * Ideas 175, 176, 183 y 185: el taller del mundo. Ver el mundo (y, con clave, ilustrarlo),
 * editar el hilo de esta partida, añadir a alguien o un sitio, y los ajustes de PixelLab.
 *
 * @returns {Promise<void>}
 */
async function openWorkshop() {
    const ui = await import('../game-engine/ui/world-workshop.js');
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName || !chat_metadata) {
        toastr.info('Abre una campaña antes.', 'Taller del mundo');
        return;
    }
    const choice = await ui.openWorkshopMenu({ Popup, POPUP_TYPE });
    const art = readIllustrationSettings((() => { try { return JSON.parse(localStorage.getItem(ART_STORAGE) || '{}'); } catch { return {}; } })());
    if (choice === 'preview') {
        const data = await loadWorldInfo(worldName);
        const preview = previewOf({ ...(data?.metadata ?? {}), plot: chat_metadata[PLOT_KEY] ?? data?.metadata?.plot });
        const npcs = Object.values(data?.entries ?? {}).filter((/** @type {any} */ e) => e?.dndData?.entityType === 'npc' && !e.dndData.dead);
        await ui.openWorldPreview({
            lines: describePreview(preview),
            subjects: [
                ...(data?.metadata?.locationMaps ?? []).map((/** @type {any} */ l) => ({ kind: /** @type {'place'} */ ('place'), name: String(l.name), image: String(l.illustration || '') })),
                ...npcs.slice(0, 20).map((/** @type {any} */ e) => ({ kind: /** @type {'person'} */ ('person'), name: String(e.dndData.name || e.comment), image: String(e.dndData.image || '') })),
            ],
            canIllustrate: Boolean(art.key),
            onIllustrate: (kind, name) => illustrate(kind, name, art),
            Popup,
            POPUP_TYPE,
        });
    } else if (choice === 'plot') {
        await ui.openPlotEditor({
            plot: chat_metadata[PLOT_KEY],
            onSave: (plot) => {
                chat_metadata[PLOT_KEY] = plot;
                saveMetadata();
                toastr.success('El hilo queda guardado en esta partida.', 'Editar el hilo');
                if (isShellOpen()) refreshGameShell();
            },
            Popup,
            POPUP_TYPE,
        });
    } else if (choice === 'director') {
        const places = getCurrentWorldLocationMaps().map((/** @type {any} */ l) => String(l.name));
        const asked = await ui.openDirector({ places, Popup, POPUP_TYPE });
        if (asked) await direct(asked.kind, asked.data);
    } else if (choice === 'art') {
        const saved = await ui.openArtSettings({ settings: art, Popup, POPUP_TYPE });
        if (saved) {
            try { localStorage.setItem(ART_STORAGE, JSON.stringify(saved)); } catch { /* sin almacenamiento */ }
            toastr.success(saved.key ? 'Guardado: ya se puede ilustrar desde «Ver el mundo».' : 'Guardado, sin clave.', 'Ilustraciones');
        }
    }
}

/**
 * Idea 183: pedir una ilustración a PixelLab y guardarla en el mundo.
 *
 * @param {'place'|'person'} kind
 * @param {string} name
 * @param {{key: string, endpoint: string, size: number}} art
 * @returns {Promise<boolean>}
 */
async function illustrate(kind, name, art) {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    const data = await loadWorldInfo(worldName);
    if (!data) return false;
    const place = kind === 'place' ? (data.metadata?.locationMaps ?? []).find((/** @type {any} */ l) => String(l.name) === name) : null;
    const entry = kind === 'person' ? Object.values(data.entries ?? {}).find((/** @type {any} */ e) => e?.dndData?.entityType === 'npc' && String(e.dndData.name) === name) : null;
    const about = kind === 'place' ? String(place?.description ?? '') : String(/** @type {any} */ (entry)?.content ?? '');
    const request = buildRequest(art, promptFor({ kind, name, about, genre: String(data.metadata?.genre ?? '') }));
    if (!request) return false;
    try {
        const response = await fetch(request.url, request.init);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const image = imageFrom(await response.json());
        if (!image) throw new Error('la respuesta no trae imagen');
        await worldWrite(async () => {
            const fresh = await loadWorldInfo(worldName);
            if (!fresh) return;
            if (kind === 'place') {
                const target = (fresh.metadata?.locationMaps ?? []).find((/** @type {any} */ l) => String(l.name) === name);
                if (target) target.illustration = image;
            } else {
                const target = Object.values(fresh.entries ?? {}).find((/** @type {any} */ e) => e?.dndData?.entityType === 'npc' && String(e.dndData.name) === name);
                if (target) /** @type {any} */ (target).dndData.image = image;
            }
            await saveWorldInfo(worldName, fresh, true);
        });
        toastr.success(name, 'Ilustrado');
        return true;
    } catch (error) {
        toastr.error(`No se pudo ilustrar: ${error instanceof Error ? error.message : error}`, 'Ilustraciones');
        return false;
    }
}

/**
 * Idea 185: el director añade a alguien o un sitio al mundo, en mitad de la partida.
 *
 * @param {'person'|'place'} kind
 * @param {any} input
 * @returns {Promise<void>}
 */
async function direct(kind, input) {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    const known = { places: getCurrentWorldLocationMaps().map((/** @type {any} */ l) => String(l.name)), people: lastWorldNpcs.map(n => n.name) };
    let said = '';
    await worldWrite(async () => {
        const data = await loadWorldInfo(worldName);
        if (!data) return;
        if (kind === 'person') {
            const made = newPerson(input, known);
            if (!made.ok) { said = made.reason; return; }
            const entry = /** @type {any} */ (createWorldInfoEntry(worldName, data));
            if (!entry) return;
            entry.comment = made.entry.title;
            entry.key = made.entry.keys;
            entry.content = made.entry.content;
            entry.group = made.entry.group;
            entry.dndData = made.entry.dndData;
            said = `${made.entry.title} vive ahora en ${input.where}.`;
        } else {
            const made = newPlace(input, known);
            if (!made.ok) { said = made.reason; return; }
            const places = Array.isArray(data.metadata?.locationMaps) ? data.metadata.locationMaps : [];
            places.push(made.place);
            const link = places.find((/** @type {any} */ l) => String(l.name) === String(input.linkTo));
            if (link) link.routes = [...(Array.isArray(link.routes) ? link.routes : []), made.route];
            data.metadata.locationMaps = places;
            said = `${made.place.name} ya está en el mapa, a ${made.route.days} día(s) de ${input.linkTo}.`;
        }
        await saveWorldInfo(worldName, data, true);
    });
    await refreshWorldMapGlobals(worldName);
    await reloadWorldFactions();
    if (said) {
        postCombatNarration(`🎬 [DIRECTOR] ${said}`);
        toastr.info(said, 'Modo director');
    }
    if (isShellOpen()) refreshGameShell();
}

/**
 * Idea 180: el código de este mundo, para que otro lo juegue igual.
 *
 * @returns {Promise<void>}
 */
async function shareWorld() {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    const data = worldName ? await loadWorldInfo(worldName) : null;
    const code = makeShareCode({ seed: seedOfWorld(data?.metadata), origin: String(data?.metadata?.origin ?? '') });
    if (!code) {
        toastr.info('Este mundo no tiene semilla: no se puede compartir con un código.', 'Compartir');
        return;
    }
    const body = $('<div class="sw-root"></div>');
    body.append($('<h3></h3>').text('Compartir este mundo'));
    body.append($('<p></p>').text('Quien escriba este código en la semilla del taller juega el mismo mundo. Lo que se cambie a mano en el taller no viaja en él.'));
    const box = $('<input type="text" class="text_pole sw-code" readonly>').val(code);
    const copy = $('<button class="menu_button sw-copy" type="button"></button>').text('Copiar');
    copy.on('click', async () => {
        try {
            await navigator.clipboard.writeText(code);
            toastr.success('Copiado.', 'Compartir');
        } catch {
            box.trigger('select');
        }
    });
    body.append($('<div class="sw-row"></div>').append(box).append(copy));
    await new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Cerrar' }).show();
}


/**
 * Idea 96: intentar llevarse algo de la tienda sin pagar. Juego de manos contra la
 * vigilancia del sitio; si os pillan, multa y os apuntan.
 *
 * @param {string} name
 * @param {number} price
 * @returns {string}
 */
function stealItem(name, price) {
    if (!chat_metadata) return '';
    const here = hereLocation();
    const thief = partyMembers.filter(m => !m.dead && (Number(m.hp) || 0) > 0)
        .reduce((/** @type {any} */ top, m) => (!top || skillModifier(m, 'sleight').modifier > skillModifier(top, 'sleight').modifier ? m : top), null);
    if (!thief) return '';
    const roll = rollCheck({ member: thief, skill: 'sleight', rollD20: () => rollDiceDetailed('1d20', 20).total, dc: stealDC(String(here?.locationType ?? here?.type ?? '')) });
    if (!roll) return '';
    postCombatNarration(roll.said);
    const outcome = stealOutcome({ success: roll.success, price, place: currentLocationName, wanted: chat_metadata[WANTED_KEY] });
    chat_metadata[WANTED_KEY] = outcome.wanted;
    // R9: si os pillan, quien manda aquí lo sabe.
    if (!outcome.free) void nudgeRuler(currentLocationName, 'crimen');
    if (outcome.free) {
        addItemToInventory(/** @type {any} */ (thief), createItem(/** @type {any} */ (describeLootItem(name, '', worldItemCatalogue))));
    } else if (!payFromParty(outcome.fine)) {
        for (const member of partyMembers) member.gold = 0;
    }
    savePartyState();
    saveMetadata();
    postCombatNarration(`🫳 [TIENDA] ${thief.name} intenta llevarse ${name}. ${outcome.line}`);
    toastr[outcome.free ? 'success' : 'error'](outcome.line, 'Robar');
    void postForModel(`[ROBO] ${thief.name} intenta llevarse ${name} de la tienda de ${currentLocationName}. ${outcome.line} Cuéntalo en dos frases.`);
    // Idea 28: y a los tuyos les parece lo que sea.
    judgeDecision('robar');
    if (isShellOpen()) refreshGameShell();
    return outcome.line;
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


/** @returns {number} Los rumores que quedan por oir aqui. */
export function rumorsLeftHere() {
    const heard = Array.isArray(chat_metadata?.[RUMORS_HEARD_KEY]) ? chat_metadata[RUMORS_HEARD_KEY] : [];
    return lastRumors.filter(r => r.where.toLowerCase() === String(currentLocationName).toLowerCase()
        && !heard.includes(r.id)).length;
}


// U3 del pegamento: los días de las facciones los apunta la etapa `facciones` del paso del
// tiempo. Todas las formas de pasar el día (el turno que cierra la noche, un descanso largo,
// un viaje) pasan por `passTime` en `campaign-state.js`, así que ya no hace falta medir el
// calendario alrededor de cada una.


/**
 * Abre las reglas de encuentro del tablero en el que esta el grupo.
 *
 * Las escribe el asistente y las escribe el importador; cambiarlas obligaba a abrir World
 * Info y editar una lista de uids a mano, que es justo lo que este proyecto promete que
 * no hace falta.
 *
 * @returns {Promise<string>}
 */
async function editBoardEncounters() {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName || !currentBoardName) {
        toastr.warning('Entra en un tablero primero (/enter).');
        return '';
    }

    const data = await loadWorldInfo(worldName);
    const location = (data?.metadata?.locationMaps ?? []).find((/** @type {any} */ l) => l.name === currentLocationName);
    const board = getLocationBoards(location).find((/** @type {any} */ b) => b.name === currentBoardName);
    if (!board) {
        toastr.error(`No se encontro el tablero "${currentBoardName}".`);
        return '';
    }

    /** @type {Record<string, string>} */
    const namesById = {};
    /** @type {Record<string, string>} */
    const idsByName = {};
    for (const enemy of getCurrentWorldEnemies()) {
        namesById[String(enemy.id)] = String(enemy.name);
        idsByName[String(enemy.name)] = String(enemy.id);
    }

    const { openEncounterEditor } = await import('../game-engine/ui/encounter-editor.js');
    const saved = await openEncounterEditor({
        boardName: board.name,
        rules: board.encounterRules ?? [],
        namesById,
        idsByName,
        available: Object.values(namesById),
        Popup,
        POPUP_TYPE,
    });

    if (!saved) return '';

    board.encounterRules = saved;
    await saveWorldInfo(worldName, data, true);
    renderLocationMapsPreview();
    toastr.success(`${saved.length} enemigo(s) declarados en "${board.name}".`, 'Enemigos del tablero');
    return `${saved.length} reglas`;
}

/**
 * Abre los objetivos del tablero en el que esta el grupo.
 *
 * El motor juzga por ids y el editor habla de nombres, asi que las dos tablas de
 * traduccion se arman aqui, donde viven las entradas. Es la misma traduccion que hace el
 * importador de paquetes, a proposito: un objetivo escrito a mano, importado de un libro
 * o propuesto por el modelo tiene que ser el mismo objeto cuando el motor lo lee.
 *
 * @returns {Promise<string>}
 */
async function editBoardObjectives() {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName || !currentBoardName) {
        toastr.warning('Entra en un tablero primero (/enter).');
        return '';
    }

    const data = await loadWorldInfo(worldName);
    const location = (data?.metadata?.locationMaps ?? []).find((/** @type {any} */ l) => l.name === currentLocationName);
    const board = getLocationBoards(location).find((/** @type {any} */ b) => b.name === currentBoardName);
    if (!board) {
        toastr.error(`No se encontro el tablero "${currentBoardName}".`);
        return '';
    }

    /** @type {Record<string, string>} */
    const namesById = {};
    /** @type {Record<string, string>} */
    const idsByName = {};
    for (const entry of Object.values(data?.entries ?? {})) {
        const name = String(/** @type {any} */ (entry).comment || '').trim();
        if (!name) continue;
        namesById[String(/** @type {any} */ (entry).uid)] = name;
        idsByName[name] = String(/** @type {any} */ (entry).uid);
    }

    const enemies = [...new Set((board.enemyPlacements ?? []).map((/** @type {any} */ p) => String(p.name)))];
    const allies = partyMembers.map(m => m.name);

    const { openObjectiveEditor } = await import('../game-engine/ui/objective-editor.js');
    const saved = await openObjectiveEditor({
        boardName: board.name,
        objectives: board.objectives ?? [],
        namesById,
        idsByName,
        enemies: enemies.length > 0 ? enemies : Object.values(namesById),
        allies,
        width: Number(location?.gridWidth) || 0,
        height: Number(location?.gridHeight) || 0,
        // Sin proveedor no se ofrece el boton: pedirselo a nadie no es una opcion.
        generate: online_status !== 'no_connection' ? (params) => generateRaw(params) : null,
        Popup,
        POPUP_TYPE,
    });

    if (!saved) return '';

    board.objectives = saved;
    await saveWorldInfo(worldName, data, true);
    renderLocationMapsPreview();
    toastr.success(`${saved.length} objetivo(s) guardados en "${board.name}".`, 'Objetivos');
    return `${saved.length} objetivos`;
}


/**
 * H2: «Cómo se juega». La página se arma con el modo de esta partida, la leyenda del tablero
 * y las categorías de la crónica: no se escribe a mano, así que no se queda vieja.
 *
 * @returns {Promise<string>}
 */
async function openHowToPlay() {
    const sections = buildHowToPlay({
        survival: survivalNow(),
        legend: getMapLegend(),
        pet: Boolean(currentPet()),
        magic: partyMembers.some(m => !m.dead && knownSpells(m).length > 0),
    });
    const body = $('<div class="jr-root hp-root"></div>');
    body.append($('<h3></h3>').text('Cómo se juega'));
    for (const section of sections) {
        body.append($('<div class="jr-title"></div>').attr('data-help', section.id).text(section.title));
        const list = $('<ul class="hp-lines"></ul>');
        for (const line of section.lines) list.append($('<li></li>').text(line.replace(/`/g, '')));
        body.append(list);
    }
    await new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', allowVerticalScrolling: true, leftAlign: true, wide: true }).show();
    return '';
}


// ---------------------------------------------------------------------------
// El Modo Juego (wiki/ROADMAP.md, Fase H · PROPUESTA_FRONTEND_MODO_JUEGO.md, H1)
//
// Pegamento y nada mas: el Shell no sabe nada de D&D y este bloque no sabe nada de
// pantallas. Lo que el director necesita son hechos que el motor ya tiene.
// ---------------------------------------------------------------------------

/**
 * Lo que el motor sabe de la partida, para el director de escena.
 *
 * Ni una sola de estas respuestas viene del modelo: son el mundo cargado, el tablero
 * abierto y el encuentro en curso.
 *
 * @returns {import('../game-engine/ui/shell/scene-director.js').GameSituation}
 */
function buildShellSituation() {
    return {
        hasChat: Boolean(chat_metadata && chat_metadata[METADATA_KEY]),
        combatActive: Boolean(combatEncounter.active),
        boardName: currentBoardName || '',
        locationName: currentLocationName || '',
        hasWorldMap: Boolean(getCurrentWorldMapUrl()),
        // Cuantos sitios hay. Con uno solo no hay a donde viajar, y explorar no es una
        // escena: es una pestana que abre un mapa de un punto.
        placeCount: getCurrentWorldLocationMaps().length,
    };
}

/**
 * Lo que la barra de acciones necesita del turno en curso.
 *
 * @returns {import('../game-engine/ui/shell/game-shell.js').CombatBar}
 */
function buildShellCombatBar() {
    if (!combatEncounter.active) {
        return { active: false, round: 0, turnLabel: '', movement: '', isPlayerTurn: false, hasAction: false, targets: [], intents: [], canAuto: false };
    }

    const entry = getCurrentTurnEntry();
    const member = getCurrentActingMember();
    const isPlayerTurn = Boolean(entry && !entry.isEnemy && member);
    const speed = Number(member?.speed) || 30;
    const remaining = member ? getRemainingMovementFeet(member) : 0;

    const targets = (isPlayerTurn ? getAttackableEnemiesForMember(member) : []).map(enemy => ({
        name: enemy.name,
        detail: `${getDistanceInFeet(member?.mapPosition?.gridX || 0, member?.mapPosition?.gridY || 0, enemy.gridX || 0, enemy.gridY || 0)} pies · PG ${enemy.currentHp}/${enemy.maxHp} · CA ${enemy.armorClass}`,
    }));

    return {
        active: true,
        round: Number(combatEncounter.round) || 1,
        turnLabel: entry ? `Turno de ${entry.name}` : 'Combate en curso',
        movement: isPlayerTurn ? `Movimiento: ${remaining}/${speed} pies` : '',
        isPlayerTurn,
        hasAction: isPlayerTurn && hasAction(combatEncounter, 'action'),
        targets,
        // Idea 14: a por quien va cada uno, para reaccionar antes.
        intents: buildEnemyIntents(),
        // Idea 18: el turno de un compañero lo puede jugar la maquina, con su postura.
        canAuto: isPlayerTurn && Boolean(member) && String(member?.id) !== String(partyMembers[0]?.id),
    };
}

/**
 * Lo que la escena de dialogo dibuja: quien habla, como esta el grupo y en que momento
 * del calendario va la partida.
 *
 * @returns {import('../game-engine/ui/shell/dialogue-scene.js').DialogueView}
 */
function buildShellDialogue() {
    return buildDialogueView({
        messages: chat,
        party: partyMembers,
        bonds: getCampaignBonds(),
        calendar: getCampaignCalendar(),
        xpTable: getXpTable(),
    });
}

/**
 * Abre el editor de campana y guarda lo que salga.
 *
 * Escribe donde escribe el importador de libros — `metadata.locationMaps` — para que una
 * campana hecha a mano y una importada sean **la misma cosa**. Lo que este panel no ensena
 * (el terreno, las salas, los objetivos) se queda intacto: tiene sus propios editores.
 *
 * @returns {Promise<string>}
 */
export async function openCampaignBuilder() {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName) {
        toastr.warning('Abre una campana antes de editarla.');
        return '';
    }

    try {
        const data = await loadWorldInfo(worldName);
        if (!data) {
            toastr.warning(`No se pudo leer el mundo "${worldName}".`);
            return '';
        }

        const { openCampaignEditor } = await import('../game-engine/ui/campaign-editor.js');
        const { applyEditorModel, describeModel, planEntryChanges } = await import('../game-engine/campaign/campaign-editor.js');

        // El compendio, si lo hay. Sin batería de materiales no hay botón de forjar y la
        // ficha se rellena a mano, igual que siempre.
        const compendium = await campaignCompendium();

        // Un mundo de antes de que esto existiera se lleva una semilla aqui, que es el
        // primer sitio donde ya estabamos cargando y guardando su metadata. A partir de
        // ese momento es reproducible como cualquier otro.
        const seeded = ensureSeed(data.metadata ?? {});
        if (seeded.rolled) {
            data.metadata = seeded.metadata;
            await saveWorldInfo(worldName, data, true);
            console.log(`[compendio] ${describeSeed(seeded.seed)}`);
        }

        const forgeSeed = seeded.seed;
        let forged = 0;

        const edited = await openCampaignEditor({
            metadata: data.metadata ?? {},
            entries: data.entries ?? {},
            writePerson: compendium.has('personas')
                ? (/** @type {string} */ where) => writePersonFromCompendium({
                    compendium,
                    locationName: where,
                    culture: String(data.metadata?.culture || ''),
                    // De quien es ese sitio. Es lo que le da a un vecino un motivo que no
                    // es suyo, y lo que hace que valga la pena preguntarle.
                    banner: bannerOf(where, data.metadata?.factions),
                    random: createSeededRandom(derive(forgeSeed, 'persona', forged++)),
                })
                : null,
            writeQuest: compendium.has('misiones')
                ? (/** @type {string[]} */ boards) => writeFromCompendium({
                    compendium,
                    boards,
                    random: createSeededRandom(derive(forgeSeed, 'encargo', forged++)),
                })
                : null,
            breedMonster: compendium.has('bestiario')
                ? (/** @type {number} */ cr) => breedFromCompendium({
                    compendium,
                    cr: Number(cr) || 0.5,
                    // El bioma de la campana, si lo dice: el pantano no da lobos de nieve.
                    biome: biomeHere(data.metadata),
                    random: createSeededRandom(derive(forgeSeed, 'criar', forged++)),
                })
                : null,
            biomes: compendium.has('mundo')
                ? compendium.find('mundo', { kind: 'bioma' })
                    .map((/** @type {any} */ row) => String(row.biome || '')).filter(Boolean)
                : [],
            forgeItem: compendium.has('materiales')
                // Con la semilla del mundo y el número de forja: el mismo mundo propone las
                // mismas cosas en el mismo orden, y cada martillazo saca una distinta.
                ? () => forgeFromCompendium({
                    compendium,
                    random: createSeededRandom(derive(forgeSeed, 'forja', forged++)),
                })
                : null,
            Popup,
            POPUP_TYPE,
        });
        if (!edited) return '';

        data.metadata = applyEditorModel(data.metadata ?? {}, edited);
        setWorldItemCatalogue(Array.isArray(data.metadata.itemCatalogue) ? data.metadata.itemCatalogue : []);

        // Las fichas del Lorebook: lo que se escribe aqui es exactamente lo que escribe el
        // importador de libros, que es la regla que evita tener dos medias campanas.
        const plan = planEntryChanges(data.entries ?? {}, edited);
        data.entries = data.entries ?? {};

        for (const spec of plan.update) {
            const entry = data.entries[spec.uid];
            if (!entry) continue;
            writeEntrySpec(entry, spec);
        }
        for (const spec of plan.create) {
            const entry = /** @type {any} */ (createWorldInfoEntry(worldName, data));
            if (!entry) continue;
            writeEntrySpec(entry, spec);
        }
        for (const uid of plan.remove) delete data.entries[uid];

        await saveWorldInfo(worldName, data, true);

        // El grupo se pone al dia sin rehacerse: quien ya jugaba conserva su vida, su oro
        // y su mochila, que no son cosa de este editor.
        // J1.6: los tuyos que se quedan en el gremio tienen ficha, pero no van en el grupo.
        const resting = restingUids(data.metadata?.[HUB_HEROES_KEY]);
        syncPartyWithEntries(Object.fromEntries(Object.entries(data.entries).filter(([uid]) => !resting.has(Number(uid)))), worldName);
        deliverGifts(edited.gifts, worldItemCatalogue);

        // La localidad abierta puede haberse quedado sin existir: mejor volver al selector
        // que dejar la pantalla apuntando a un sitio borrado.
        const places = (data.metadata.locationMaps ?? []).map((/** @type {any} */ l) => String(l.name));
        if (currentLocationName && !places.includes(currentLocationName)) {
            setCurrentLocationName('');
            setCurrentBoardName('');
            saveCurrentLocation();
            saveCurrentBoard();
        }

        renderLocationMapsPreview();
        toastr.success(describeModel(edited), `"${worldName}" guardado`);
        return describeModel(edited);
    } catch (error) {
        console.error('[party] campaign editor failed', error);
        toastr.error(String(error?.message || error), 'No se pudo guardar la campana');
        return '';
    }
}


/**
 * Vuelca una ficha planeada sobre una entrada del Lorebook.
 *
 * @param {any} entry
 * @param {{title: string, keys: string[], content: string, group: string, dndData: any}} spec
 */
function writeEntrySpec(entry, spec) {
    entry.comment = spec.title;
    entry.key = spec.keys;
    entry.content = spec.content;
    entry.group = spec.group;
    entry.dndData = spec.dndData;
}


/**
 * Reparte lo que el editor dijo de regalar.
 *
 * @param {Array<{item: string, to: string}>|undefined} gifts
 * @param {any[]} catalogue
 */
function deliverGifts(gifts, catalogue) {
    for (const gift of Array.isArray(gifts) ? gifts : []) {
        const holder = partyMembers.find(member => member.name === gift.to);
        const declared = catalogue.find(item => String(item?.name ?? '') === gift.item);
        if (!holder) {
            toastr.warning(`"${gift.to}" ya no esta en el grupo: "${gift.item}" no se ha repartido.`);
            continue;
        }

        const item = createItem(/** @type {any} */ (
            describeLootItem(gift.item, String(declared?.rarity ?? ''), catalogue)));
        addItemToInventory(/** @type {any} */ (holder), item);
        toastr.success(`${holder.name} lleva ahora "${gift.item}".`);
    }

    if (Array.isArray(gifts) && gifts.length > 0) savePartyState();
}


/**
 * Abre los ajustes de sonido, cargando el panel solo cuando hace falta.
 *
 * @returns {Promise<string>}
 */
async function openAudioSettings() {
    const { openAudioSettings: open } = await import('../game-engine/ui/audio-settings.js');
    return await open({ Popup, POPUP_TYPE });
}

/**
 * Empaqueta la campana abierta y la descarga.
 *
 * Sale por el mismo formato que entra: el paquete se normaliza y se valida con el mismo
 * validador que juzga los libros de fuera, asi que lo que se descarga aqui se puede
 * importar alli. Si el validador encuentra algo, se dice **antes** de que el archivo
 * acabe en manos de otro.
 *
 * @returns {Promise<string>}
 */
async function exportCampaignPack() {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName) {
        toastr.warning('No hay ninguna campana abierta que exportar.');
        return '';
    }

    const data = await loadWorldInfo(worldName);
    if (!data) {
        toastr.warning(`No se pudo leer el mundo "${worldName}".`);
        return '';
    }

    const built = buildPackFromWorld({
        worldName,
        metadata: data.metadata ?? {},
        entries: data.entries ?? {},
        synopsis: String(data.metadata?.synopsis ?? ''),
    });

    const { pack, repairs } = normalizePack(built);
    const report = validatePack(pack);

    const fileName = `${worldName.toLowerCase().replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'campana'}.campaign.json`;
    download(JSON.stringify(pack, null, 2), fileName, 'application/json');

    const summary = describeExport(pack);
    if (report.ok) {
        toastr.success(summary, 'Campana exportada', { timeOut: 8000 });
    } else {
        // Se descarga igual — son tus datos — pero nadie deberia enterarse de que el
        // archivo no vale al intentar importarlo en casa de otro.
        toastr.warning(
            `${summary}. El validador encuentra ${report.errors.length} problema(s): `
            + report.errors.slice(0, 3).map(e => e.message).join(' · '),
            'Exportada, pero con avisos', { timeOut: 15000 },
        );
    }
    if (repairs.length > 0) console.info('[party] exportando:', repairs);

    postCombatNarration(`📦 [CAMPANA] Exportada: ${summary}.`);
    return fileName;
}


/**
 * Comprar el remedio de una herida que no cura.
 *
 * @param {any} member
 * @param {string} injuryId
 * @returns {string}
 */
export function buyRemedy(member, injuryId) {
    if (combatEncounter.active) {
        toastr.warning('No en mitad de un combate.');
        return '';
    }
    if (!smithHere()) {
        toastr.warning('Esto lo hace un herrero: hay que estar donde haya uno.');
        return '';
    }
    const table = readRemedies();
    const remedy = table[injuryId];
    const patch = applyRemedy(member, injuryId, table);
    if (!remedy || !patch) {
        toastr.warning('Esa herida no tiene remedio, o ya no la tiene.');
        return '';
    }
    if (!payFromParty(remedy.cost)) {
        toastr.warning(`No llega el oro: cuesta ${remedy.cost}.`);
        return '';
    }

    member.injuries = patch.injuries;
    member.baseStats = patch.baseStats;
    Object.assign(member, patch.stats);
    savePartyState();
    renderPartyMembers();

    const line = remedy.becomes
        ? `${member.name} estrena ${remedy.label.toLowerCase()} (${remedy.cost} de oro). Ahora: ${String(remedy.becomes.label).toLowerCase()}.`
        : `${member.name}: ${remedy.label.toLowerCase()} (${remedy.cost} de oro). La herida se cierra del todo.`;
    // Al narrador, que es quien tiene que saber que Bruna ahora lleva pierna de palo.
    void postForModel(`🦿 [CAMPAÑA] ${line}`);
    toastr.success(line, 'Remedio');
    return line;
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
 * @param {number} [limit] Cuantas caben; sin decir, las de la fila.
 * @returns {import('../game-engine/ui/shell/action-chips.js').ActionChip[]}
 */
function buildShellChips(limit = undefined) {
    // Si los datos del mundo son de otro, se releen y la fila se vuelve a dibujar.
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (worldName && worldName !== loadedWorldName) {
        void ensureWorldData().then(() => { if (isShellOpen()) refreshGameShell(); });
    }
    const location = currentLocationName
        ? getCurrentWorldLocationMaps().find(l => l.name === currentLocationName)
        : null;

    return buildActionChips({
        fighting: combatEncounter.active,
        hasBoard: Boolean(currentBoardName),
        doors: closedDoorsNearParty(),
        // Con los muertos no se habla (idea 36).
        // Con los compañeros: el primero es quien juega, y hablar consigo mismo no es hablar.
        companions: partyMembers.slice(1).filter(m => !m.dead).map(m => ({ name: m.name })),
        mentioned: namesInLastNarration(),
        // Se viaja a los vecinos: una ficha a la otra punta del mapa sería un salto.
        places: neighbourPlaces().map(name => ({ name })),
        // Los tableros de aquí que pide la historia: sus fichas van delante.
        thread: threadBoardsHere(location),
        // Los que quedan por ganar, delante: caben dos, y un tablero ya ganado escondía el
        // siguiente (en Barovia, el Sótano detrás de la Taberna).
        boards: getLocationBoards(location)
            .map((/** @type {any} */ b) => ({ name: String(b.name), won: isBoardWon(currentLocationName, String(b.name)) }))
            .sort((a, b) => Number(a.won) - Number(b.won))
            .map(b => ({ name: b.name })),
        hurt: partyMembers.some(m => !m.dead && (Number(m.hp) || 0) < (Number(m.maxHp) || 0)),
        // Cuantos dados quedan sale del nivel y de los ya gastados; las caras las
        // lee el descanso, que puede esperar al Lorebook porque es asincrono.
        hitDice: availableHitDice(partyMembers),
        rumors: rumorsLeftHere(),
        forage: Boolean(currentLocationName) && !currentBoardName && forageCheck(hereLocation() ?? {}).allowed,
        explore: Boolean(currentLocationName) && !currentBoardName
            && canExplore(getCurrentWorldLocationMaps(), []),
        proposals: readProposals(chat_metadata?.[PROPOSALS_KEY]).map(p => ({ name: p.name })),
        ...(limit !== undefined ? { limit } : {}),
        // Idea 151: con quien se puede hablar aqui, ademas de los tuyos.
        people: lastWorldNpcs
            .filter(n => !n.dead && n.where.toLowerCase() === String(currentLocationName).toLowerCase())
            .map(n => ({ name: n.name })),
        // Idea 139: lo que ofrece el narrador.
        // Z3: y lo que el sitio deja examinar, sin que nadie lo ofrezca.
        extras: [...offerChips(chat_metadata?.[OFFERS_KEY]), ...lookChips()],
        // Idea 67: acampar donde no hay posada.
        camp: Boolean(currentLocationName) && !currentBoardName && campHere().ok,
        // Idea 75: la escalera al nivel siguiente.
        stairs: Boolean(stairsHere()),
        // Idea 7: los prisioneros, con lo que se puede hacer con ellos aqui.
        prisoners: prisonerChips(chat_metadata?.[PRISONERS_KEY], {
            authority: Boolean(location) && servicesOf(location).some(sv => sv === 'tablon' || sv === 'templo'),
            fighting: combatEncounter.active,
        }),
        // Idea 137: lo que estas escribiendo pide una tirada.
        typed: typedIntents.map(skill => ({ skill, label: SKILLS[/** @type {keyof typeof SKILLS} */ (skill)]?.label ?? skill })),
        // Idea 144: lo que se le puede decir a quien se está hablando.
        replies: currentReplies(),
        // J4: el tablón de campañas y los mercenarios en el gremio; volver, en una campaña.
        hub: hubChips(),
        // Los que esperan en el tablero: la pelea se empieza también desde la fila.
        fight: !combatEncounter.active && lastWaiting.board === currentBoardName && lastWaiting.placements.length > 0
            && !isBoardWon(currentLocationName, currentBoardName)
            ? waitingSummary(lastWaiting.placements) : '',
        requests: readRequests(chat_metadata?.[CHECK_REQUESTS_KEY], SKILLS).map(r => ({
            skill: r.skill, label: SKILLS[/** @type {keyof typeof SKILLS} */ (r.skill)].label, reason: r.reason, dc: r.dc,
        })),
    });
}

/**
 * Lo que hace pulsar una ficha.
 *
 * Una que abre una puerta gasta — puede despertar una sala — y por eso es un boton. La
 * de hablar solo deja la frase empezada en el chat: lo que se diga lo escribe quien juega,
 * y enviarlo por el es ponerle palabras en la boca.
 *
 * @param {import('../game-engine/ui/shell/action-chips.js').ActionChip} chip
 */
function runShellChip(chip) {
    // Idea 144: hablar con alguien de aquí abre sus respuestas; despedirse las cierra. Y la
    // fila se redibuja en el acto, detrás de la frase empezada: si no, las respuestas no
    // salían hasta que pasara otra cosa.
    if (chip.id.startsWith('talk-local:') || chip.id === 'reply-bye') {
        setTalkingTo(chip.id === 'reply-bye' ? '' : chip.id.slice('talk-local:'.length));
        if (isShellOpen()) setTimeout(() => refreshGameShell(), 0);
    }
    // Hablar con alguien cuenta al pulsar, no al enviar: sin modelo no se envía nada, y el
    // hilo se quedaba esperando (ROADMAP_SIN_TOKENS, Z0).
    const talkTo = chip.id.startsWith('talk-local:') ? chip.id.slice('talk-local:'.length)
        : chip.id.startsWith('talk:') ? chip.id.slice('talk:'.length) : '';
    if (talkTo) {
        startTalk(talkTo, String(chip.draft || ''));
        return;
    }
    // Idea 169: las que no cabian en la fila.
    if (chip.id === 'more') {
        openAllChips();
        return;
    }
    if (chip.id === 'fight-board') {
        if (lastWaiting.board === currentBoardName) startWaitingFight(lastWaiting.placements);
        return;
    }
    // Idea 137: tirar por lo que se esta escribiendo, sin borrarlo.
    if (chip.id.startsWith('typed:')) {
        const input = /** @type {HTMLTextAreaElement|null} */ (document.querySelector('#send_textarea'));
        runSkillCheck(chip.id.slice('typed:'.length), String(input?.value ?? ''));
        setTypedIntents([]);
        if (isShellOpen()) refreshGameShell();
        return;
    }
    if (chip.cell) {
        const context = getActiveBoardContext();
        if (!context.board) return;
        toggleBoardDoor(context.board, chip.cell.x, chip.cell.y, true, context.gridWidth, context.gridHeight);
        return;
    }

    if (chip.command) {
        // Importado aqui y no arriba a proposito: `slash-commands.js` carga `script.js`,
        // que carga este archivo. Traerlo al cargar cambiaria ese orden, y lo que la
        // ficha necesita es ejecutar lo mismo que si se escribiera, no antes.
        void import('../slash-commands.js').then(m => m.executeSlashCommandsWithOptions(chip.command));
        return;
    }

    if (chip.draft) draftInChat(chip.draft);
}


/** Idea 169: todas las fichas, en una ventana. */
function openAllChips() {
    const chips = buildShellChips(Infinity);
    const body = $('<div class="hp-root"></div>');
    body.append($('<h3></h3>').text('Todo lo que se puede hacer'));
    /** @type {Popup|null} */
    let popup = null;
    for (const chip of chips) {
        const row = $('<button type="button" class="menu_button hp-item"></button>').attr('data-chip', chip.id);
        row.append($('<span class="hp-label"></span>').text(chip.label));
        row.on('click', () => {
            void popup?.completeCancelled();
            runShellChip(chip);
        });
        body.append(row);
    }
    popup = new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', allowVerticalScrolling: true, leftAlign: true });
    void popup.show();
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

    return { to: match.name, reason: '' };
}

/**
 * Idea 199: el salón de la fama. Los caídos de todas las partidas, el más reciente arriba.
 */
function openHallOfFame() {
    const hall = readHall(/** @type {any} */ (extension_settings).partyHall);
    const body = $('<div class="jr-root hall-root"></div>');
    body.append($('<h3></h3>').text('Salón de la fama'));
    // J3.9: arriba, las campañas terminadas; debajo, los caídos.
    const done = hall.filter(entry => entry.kind === 'campaign');
    const fallen = hall.filter(entry => entry.kind !== 'campaign');
    if (done.length > 0) {
        body.append($('<h4 class="hall-head"></h4>').text('Campañas terminadas'));
        for (const entry of done) body.append($('<div class="jr-item hall-entry hall-campaign"></div>').text(describeHallEntry(entry)));
        body.append($('<h4 class="hall-head"></h4>').text('Los caídos'));
    }
    if (fallen.length === 0) body.append($('<div class="jr-item"></div>').text('Todavía no ha caído nadie.'));
    for (const entry of fallen) body.append($('<div class="jr-item hall-entry"></div>').text(describeHallEntry(entry)));
    void new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', allowVerticalScrolling: true, leftAlign: true }).show();
}

/**
 * Idea 128: a veintiuno, en la taberna. Se apuesta, se piden dados, se planta; y quien tenga
 * buenas manos puede hacer trampa una vez.
 *
 * @returns {Promise<void>}
 */
async function playTavernDice() {
    if (!chat_metadata) return;
    const today = Math.max(1, campaignDay());
    const hero = partyMembers.find(m => !m.dead) ?? partyMembers[0];
    const left = roundsLeft(chat_metadata[DICE_GAME_KEY], currentLocationName, today);
    if (!hero || left.banned || left.left <= 0) {
        toastr.info(left.banned ? 'Aquí ya os conocen: hoy no os dejan jugar.' : 'Por hoy ya está bien de dados.');
        return;
    }
    const betBox = $('<div class="td-root"></div>');
    betBox.append($('<h3></h3>').text('A veintiuno'));
    betBox.append($('<p></p>').text('Se tiran dados y se suman. Quien se pasa de 21, pierde; al plantarte, la casa tira hasta 17.'));
    const purse = partyPurse();
    const bet = await new Popup(betBox[0], POPUP_TYPE.TEXT, '', {
        okButton: false,
        cancelButton: 'Mejor no',
        customButtons: BETS.filter(b => purse >= b).map(b => ({ text: `Apostar ${b}`, result: 100 + b, classes: ['td-bet'] })),
    }).show();
    if (typeof bet !== 'number' || bet < 100) return;
    let game = startGame(bet - 100, nextRandom);
    while (game.state === 'playing') {
        const table = $('<div class="td-root"></div>');
        table.append($('<h3></h3>').text('A veintiuno'));
        table.append($('<p class="td-table"></p>').text(describeGame(game)));
        const choice = await new Popup(table[0], POPUP_TYPE.TEXT, '', {
            okButton: false,
            cancelButton: false,
            customButtons: [
                { text: 'Otro dado', result: 61, classes: ['td-draw'] },
                { text: 'Plantarse', result: 62, classes: ['td-stand'] },
                ...(game.cheated ? [] : [{ text: 'Hacer trampa (Juego de manos)', result: 63, classes: ['td-cheat'] }]),
            ],
        }).show();
        if (choice === 61) game = drawDie(game, nextRandom);
        else if (choice === 63) {
            const trick = rollCheck({ member: hero, skill: 'sleight', rollD20: () => rollDiceDetailed('1d20', 20).total, dc: 14 });
            if (trick) postCombatNarration(trick.said);
            game = cheat(game, { total: Number(trick?.total) || 0 });
        } else game = stand(game, nextRandom);
    }
    const money = payout(game);
    if (money > 0) hero.gold = (Number(hero.gold) || 0) + money;
    else if (money < 0) payFromParty(-money);
    const before = chat_metadata[DICE_GAME_KEY];
    const same = before && before.place === currentLocationName && Number(before.day) === today;
    chat_metadata[DICE_GAME_KEY] = {
        place: currentLocationName, day: today,
        played: (same ? Number(before.played) || 0 : 0) + 1,
        banned: game.state === 'caught' || Boolean(same && before.banned),
    };
    countStat('gold', Math.max(0, money));
    saveMetadata();
    savePartyState();
    postCombatNarration(`🎲 [TABERNA] ${hero.name} juega a veintiuno. ${describeGame(game)}`);
    const result = $('<div class="td-root"></div>');
    result.append($('<h3></h3>').text(game.state === 'won' ? 'Ganáis' : game.state === 'push' ? 'Empate' : 'Perdéis'));
    result.append($('<p class="td-table"></p>').text(describeGame(game)));
    await new Popup(result[0], POPUP_TYPE.TEXT, '', { okButton: 'Vale' }).show();
}


/**
 * Idea 181: ¿llega este mundo al listón? El mismo informe que la herramienta de consola,
 * sobre el mundo abierto, con el encargo para el Gem listo para copiar.
 *
 * @returns {Promise<string>}
 */
async function checkCurrentWorld() {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    const data = worldName ? await loadWorldInfo(worldName) : null;
    if (!data) {
        toastr.warning('Abre una campaña para comprobar su mundo.');
        return '';
    }
    const built = buildPackFromWorld({
        worldName, metadata: data.metadata ?? {}, entries: data.entries ?? {}, synopsis: String(data.metadata?.synopsis ?? ''),
    });
    const { pack } = normalizePack(built);
    // Lo que el paquete exportado no lleva y el comprobador mira: la gente del mundo, los
    // encargos escritos, los rumores y el hilo.
    const npcs = Object.values(data.entries ?? {})
        .filter((/** @type {any} */ e) => e?.dndData?.entityType === 'npc')
        .map((/** @type {any} */ e) => ({
            name: String(e.dndData.name || e.comment || ''),
            where: String(e.dndData.mapPosition?.locationName || ''),
            wants: String(e.dndData.wants || ''),
            knows: String(e.dndData.knows || ''),
        }));
    const report = checkWorldDensity({
        ...pack,
        npcs,
        plot: data.metadata?.plot ?? /** @type {any} */ (pack).plot,
        contracts: data.metadata?.writtenContracts ?? [],
        rumors: data.metadata?.rumors ?? [],
    });
    const body = $('<div class="jr-root wd-root"></div>');
    body.append($('<h3></h3>').text(`¿Llega al listón? ${report.ok ? 'Sí' : `${report.errors.length} cosa(s) por arreglar`}`));
    for (const line of report.counts) body.append($('<div class="jr-item wd-count"></div>').text(line));
    if (report.errors.length > 0) body.append($('<div class="jr-title"></div>').text('Por arreglar'));
    for (const line of report.errors.slice(0, 20)) body.append($('<div class="jr-item wd-error"></div>').text(line));
    if (report.warnings.length > 0) body.append($('<div class="jr-title"></div>').text('Conviene mirar'));
    for (const line of report.warnings.slice(0, 20)) body.append($('<div class="jr-item wd-warning"></div>').text(line));
    const request = gemRequest(report);
    const result = await new Popup(body[0], POPUP_TYPE.TEXT, '', {
        okButton: 'Cerrar',
        allowVerticalScrolling: true,
        leftAlign: true,
        customButtons: request ? [{ text: 'Copiar el encargo para el Gem', result: 71, classes: ['wd-copy'] }] : [],
    }).show();
    if (result === 71 && request) {
        await navigator.clipboard?.writeText(request).catch(() => {});
        toastr.success('El encargo está copiado: pégalo en el Gem.', 'Copiado');
    }
    return report.ok ? 'llega' : `${report.errors.length} por arreglar`;
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


/**
 * El compendio: la biblioteca de contenido de la que tiran los generadores.
 *
 * No hace falta tener una partida abierta, y por eso vive en el menu de titulo: el
 * compendio es **tuyo**, no de una campana. Lo que se ve es que baterias hay, cuantas
 * filas traen, **cuales faltan** y que sale si lo pides con una semilla.
 *
 * @returns {Promise<void>}
 */
async function openCompendiumLibrary() {
    const { compendium, errors } = await getCompendium();
    const { openCompendiumPanel } = await import('../game-engine/ui/compendio-panel.js');

    // Un vocabulario cerrado mal escrito pasa la validacion de toda fila y luego no hace
    // lo que dice. Se cuenta aqui, junto a lo que no se pudo leer.
    const broken = [
        ...validateAbilities(compendium),
        ...validateFactionRows(compendium),
        ...validateKin(compendium),
    ];

    await openCompendiumPanel({
        compendium,
        errors: [...errors, ...broken],
        // Probar es lo que hace util la pantalla: diez tiradas con tu semilla, sin jugarte
        // una partida entera para descubrir que la daga sale siempre. Cada bateria se
        // prueba con quien la sortea de verdad, no con una lista de nombres.
        sample: (domain, seed, howMany) => {
            const random = createSeededRandom(derive(seed, 'probar', domain));

            if (domain === 'nombres') {
                return makeNames({ compendium, howMany, random });
            }
            if (domain === 'materiales' || domain === 'trastos') {
                return forgeItems({ compendium, howMany, random }).map(describeItem);
            }
            if (domain === 'armas' || domain === 'armaduras') {
                // Del tipo que toca: una pestaña de armas que ensena faroles no dice si
                // la bateria de armas esta bien.
                const itemType = domain === 'armas' ? 'weapon' : 'armor';
                return forgeItems({ compendium, howMany, random, itemType }).map(describeItem);
            }
            if (domain === 'bestiario') {
                return breedBand({ compendium, howMany, cr: 1, random }).map(describeMonster);
            }
            if (domain === 'misiones') {
                return writeQuestBoard({ compendium, howMany, random }).map(describeQuest);
            }
            if (domain === 'facciones') {
                // Se prueba repartiendolas por el mundo abierto, que es para lo que son.
                // Sin campana abierta, por un mundo de mentira: la bateria se ve igual.
                const places = getCurrentWorldLocationMaps().length >= 2
                    ? getCurrentWorldLocationMaps()
                    : [{ name: 'El Molino' }, { name: 'La Ermita' }, { name: 'Cripta olvidada' }];
                const rolled = rollFactions({
                    compendium, locations: places, random, count: howMany,
                });
                const names = namesOf(rolled);
                return rolled.map(faction => describeFaction(faction, names));
            }
            if (domain === 'razas' || domain === 'clases') {
                // Se prueban ensenando lo que dan y lo que quitan: una lista de nombres no
                // dice si elegir raza significa algo.
                const rows = domain === 'razas' ? racesOf(compendium) : kindsOf(compendium);
                return rows.slice(0, howMany).map(row => `${row.name} · ${describeKin(row)}`);
            }
            if (domain === 'habilidades') {
                // Lo que sabe hacer una clase, que es lo que la bateria hace. Una lista
                // de nombres sueltos no dice si elegir clase significa algo.
                const classes = classesOf(compendium);
                const className = classes[Math.floor(random() * classes.length) % classes.length] ?? '';
                const known = abilitiesFor({ compendium, className, level: 3 });
                return [
                    `${className || 'Cualquiera'}, a nivel 3:`,
                    ...known.map(nameAndAbility),
                ];
            }
            if (domain === 'personas') {
                // Un pueblo, no filas sueltas: lo que se quiere ver es que cada uno
                // quiere algo distinto y que el oficio no se repite.
                return writeVillage({ compendium, howMany, locationName: 'El Molino', random })
                    .flatMap((/** @type {any} */ person) => [
                        describePerson(person),
                        `   ${person.backstory}`,
                    ]);
            }
            if (domain === 'mundo') return sampleJourney(compendium, random);
            if (domain === 'sitios') return samplePlace(compendium, random);
            if (domain === 'propiedades') {
                // Solo lo que lleva propiedad: forjar sin ellas es probar la otra bateria.
                return forgeItems({ compendium, howMany, random, properties: 1 })
                    .map(describeItem);
            }

            // Lo que todavia no tiene generador se ensena **agrupado por clase**: una
            // lista que mezcla biomas, climas y sucesos no dice nada de ninguno.
            const rows = compendium.take(domain, howMany * 2, { random });
            /** @type {Map<string, string[]>} */
            const byKind = new Map();
            for (const row of rows) {
                const kind = String(row.kind || 'filas');
                if (!byKind.has(kind)) byKind.set(kind, []);
                byKind.get(kind)?.push(String(row.name));
            }
            return [...byKind.entries()].map(([kind, names]) => `${kind}: ${names.join(', ')}`);
        },
        Popup,
        POPUP_TYPE,
    });
}

/**
 * Un viaje entero, que es lo que la bateria del mundo **hace**.
 *
 * Ensenar sus filas sueltas —«Niebla, Viento, Un desprendimiento, Despejado»— no dice
 * nada de ninguna: lo que se quiere ver es que el tiempo hace rachas, que en un sitio no
 * puede nevar y que los sucesos encajan con lo que hace ese dia.
 *
 * @param {any} compendium
 * @param {() => number} random
 * @returns {string[]}
 */
function sampleJourney(compendium, random) {
    const biome = compendium.pick('mundo', { where: { kind: 'bioma' }, random });
    if (!biome) return [];

    const days = 6;
    const weather = rollWeather({
        days,
        table: compendium.find('mundo', { kind: 'clima' }),
        climates: biome.climates ?? [],
        random,
    });
    const events = travelEvents({
        days,
        table: compendium.find('mundo', { kind: 'suceso' }),
        biome: String(biome.biome || ''),
        weather,
        random,
    });

    const lines = [`Seis días por ${String(biome.name).toLowerCase()}: ${weather.join(' · ')}`];
    for (const event of events) {
        const cost = event.days > 0 ? ` (+${event.days} día)`
            : (event.days < 0 ? ` (−${-event.days} día)` : '');
        lines.push(`Día ${event.day} · ${event.name}${cost} — ${event.note}`);
    }
    if (events.length === 0) lines.push('Seis días sin nada que contar. También pasa.');

    return lines;
}

/**
 * Un sitio entero, dibujado.
 *
 * La bateria de sitios no es una lista de nombres: es de que forma es un sitio, que salas
 * escritas a mano lleva dentro y en que estado esta. Eso solo se ve mirando el mapa.
 *
 * @param {any} compendium
 * @param {() => number} random
 * @returns {string[]}
 */
function samplePlace(compendium, random) {
    const type = compendium.pick('sitios', { where: { kind: 'tipo' }, random });
    const state = compendium.pick('sitios', { where: { kind: 'estado' }, random });
    if (!type) return [];

    const board = generateBoard({
        random,
        size: 'small',
        shape: String(type.shape || 'rooms'),
        templates: compendium.find('sitios', { kind: 'sala' })
            .map((/** @type {any} */ row) => row.rows),
        state: state ? { cover: state.cover, rough: state.rough } : null,
        partySize: 2,
        bestiary: ['Lobo'],
    });

    return [
        `${type.name}${state ? ` · ${state.name}` : ''} · forma "${type.shape}"`,
        ...board.map,
    ];
}

/**
 * Las reglas de la campana abierta.
 *
 * Extraido de `/rules` porque el menu de pausa abre lo mismo. Una segunda copia seria
 * un segundo sitio donde olvidarse de volver a aplicar el paquete despues de guardarlo.
 *
 * @returns {Promise<string>}
 */
async function openRules() {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName) {
        toastr.warning('Abre una campana primero.');
        return '';
    }

    try {
        const data = await loadWorldInfo(worldName);
        if (!data) {
            toastr.error(`No se pudo cargar el mundo "${worldName}".`);
            return '';
        }

        const { openRulesEditor } = await import('../game-engine/ui/rules-editor.js');
        const edited = await openRulesEditor({
            pack: data.metadata?.rulesetPack ?? null,
            title: `Reglas de "${worldName}"`,
            Popup,
            POPUP_TYPE,
        });
        if (!edited) return '';

        // Quitar un valor que algo ya usa deja una referencia muerta, y hasta ahora se
        // guardaba sin protestar: la espada seguia apuntando a un tipo de dano que ya no
        // existia y solo se notaba tres sesiones despues. No se impide el cambio -es tu
        // campana- pero se decide con la factura delante.
        const { findBrokenReferences, describeImpact } = await import('../game-engine/rules/rule-impact.js');
        const broken = findBrokenReferences({
            before: data.metadata?.rulesetPack ?? null,
            after: edited,
            items: partyMembers.flatMap(m => (Array.isArray(m.items) ? m.items : [])),
            characters: partyMembers,
        });

        if (broken.length > 0) {
            // El texto del dialogo es HTML, asi que las lineas van con <br>.
            const detail = broken.map(b => `• ${escapeHtml(b.message)}`).join('<br>');
            const go = await Popup.show.confirm(
                'Este cambio rompe referencias',
                `${escapeHtml(describeImpact(broken))}<br><br>${detail}<br><br>¿Guardar de todas formas?`,
            );
            if (!go) {
                toastr.info('No se ha guardado nada.');
                return '';
            }
        }

        data.metadata = data.metadata ?? {};
        data.metadata.rulesetPack = edited;
        await saveWorldInfo(worldName, data, true);

        await applyCampaignRuleset(worldName);
        return 'reglas guardadas';
    } catch (error) {
        console.error('[party] rules editor failed', error);
        toastr.error(String(error?.message || error), 'No se pudieron editar las reglas');
        return '';
    }
}

/**
 * Lo que dibuja la escena de exploracion.
 *
 * @returns {import('../game-engine/ui/shell/exploration-scene.js').ExplorationView}
 */
function buildShellExploration() {
    const view = buildExplorationView({
        locationMaps: getCurrentWorldLocationMaps(),
        campaignMap: getCampaignMap(),
        currentLocation: currentLocationName,
        currentBoard: currentBoardName,
        party: partyMembers,
        bonds: getCampaignBonds(),
        calendar: getCampaignCalendar(),
        xpTable: getXpTable(),
        travel: { friendly: friendlyFactions(), season: currentSeason(), done: readPlotState(chat_metadata?.[PLOT_STATE_KEY]).done },
    });
    // Idea 81: lo pendiente en cada sitio, para decidir adonde ir.
    /** @type {Record<string, number>} */
    const unheard = {};
    const heardIds = Array.isArray(chat_metadata?.[RUMORS_HEARD_KEY]) ? chat_metadata[RUMORS_HEARD_KEY] : [];
    for (const rumor of lastRumors) {
        if (heardIds.includes(rumor.id)) continue;
        unheard[rumor.where] = (unheard[rumor.where] ?? 0) + 1;
    }
    const pending = pendingByPlace({
        places: view.places.map(p => p.name),
        board: chat_metadata?.[BOARD_KEY] ?? [],
        taken: chat_metadata?.[TAKEN_KEY] ?? null,
        rumors: unheard,
        thread: openMilestones().map(m => String(m?.asks?.place ?? '')).filter(Boolean),
    });
    // Idea 89: la fiesta que se acerca, en la lista de viaje.
    const festivals = worldFestivals();
    const today = Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1));
    const soon = (/** @type {string} */ name) => {
        const festival = festivals[name];
        if (!festival) return '';
        const left = daysUntil(festival, today);
        return left === 0 ? `hoy, ${festival.name}` : left <= 3 ? `${festival.name} en ${left} día${left === 1 ? '' : 's'}` : '';
    };
    // Idea 85: como le va a este sitio por lo que hicisteis.
    return {
        ...view,
        places: view.places.map(p => ({
            ...p,
            pending: [pending[p.name] ?? '', soon(p.name) ? `Fiesta: ${soon(p.name)}` : ''].filter(Boolean).join(' · '),
        })),
        fortune: fortuneLine(hereLocation()),
    };
}

/**
 * J0.6: campaigns.js, para leer las partidas guardadas sin esperar. Lo trae la portada; se
 * pide sin import estático, que campaigns.js ya importa de aquí.
 * @type {typeof import('../campaigns.js')|null}
 */
let savedGamesApi = null;

/**
 * @returns {import('../game-engine/ui/shell/game-shell.js').ShellOptions}
 */
function buildShellOptions() {
    installNoticeTray();
    applyColorblind();
    if (!savedGamesApi) {
        void import('../campaigns.js').then(m => {
            savedGamesApi = m;
            if (isShellOpen()) refreshGameShell();
        });
    }
    // J0.4: el tamaño y la velocidad del texto, de este navegador.
    void import('../game-engine/ui/game-options.js').then(({ applyTextOptions }) => applyTextOptions());
    // El panel podia estar plegado antes de encender el Shell, y apagarlo tiene que
    // dejarlo como estaba: el Shell lo despliega porque es su escenario, no porque el
    // jugador lo pidiera.
    const wasHidden = locationMapsManuallyHidden;
    return {
        getSituation: buildShellSituation,
        getCombatBar: buildShellCombatBar,
        getDialogue: buildShellDialogue,
        // J18.4: el narrador cuenta, no se pinta en la novela visual.
        narratorName: () => String(name2 || ''),
        getExploration: buildShellExploration,
        // El reloj: el mismo calendario y los mismos descansos que la pestana de
        // Campana, pero dentro de la partida. Ver ROADMAP_JUEGO_SIN_COMANDOS.md, K3.
        getClock: () => buildClockView({
            day: Number(getCampaignCalendar()?.day) || 1,
            slotLabel: getCurrentSlotLabel(),
            fighting: combatEncounter.active,
            party: partyMembers,
            // Idea 74: la estación, y lo que le queda.
            season: chat_metadata?.[METADATA_KEY] ? describeSeason(Math.max(1, campaignDay()), lastWorldSeason || undefined) : '',
        }),
        getChips: buildShellChips,
        onChip: runShellChip,
        getChecks: () => (combatEncounter.active || !partyMembers[0]
            ? []
            : checkOptions(partyMembers[0], { locked: Boolean(chat_metadata?.[PENDING_CHECK_KEY]) })),
        onCheck: (skill) => { runSkillCheck(skill); },
        onAskNarrator: () => askNarrator(),
        isAskingNarrator: () => askingNarrator,
        canAskNarrator: () => !combatEncounter.active && Boolean(partyMembers[0]),
        getFocus: () => focusOf(getPlot(), chat_metadata?.[PLOT_STATE_KEY], campaignDay()),
        onJournal: () => openJournalSafely(),
        onGlance: () => openPartyGlance(),
        getNoticeCount: () => unseenCount(notices, noticesSeenAt),
        onTray: () => openNoticeTray(),
        getMeter: () => lastMeter,
        onMeter: () => { void import('../game-engine/ui/prompt-preview.js').then(m => m.openPromptPreview({ Popup, POPUP_TYPE })); },
        onHelp: () => openHelp(),
        getServices: () => buildServiceCards(),
        onService: (actionId) => { void runService(actionId); },
        onCompanion: (memberId) => openCompanionCard(memberId),
        onClock: (action) => {
            if (action === 'slot') advanceCampaignSlot();
            else if (action === 'day') advanceCampaignDay();
            else void takeRest(action === 'short' ? 'corto' : 'largo');
        },
        onEnterBoard: (name) => { enterBoard(name); renderLocationMapsPreview(); },
        // Un clic nunca gasta nada; lo gasta el boton que lo confirma. Y viajar gasta
        // dias, comida y la cuenta de la semana, asi que primero se dice lo que cuesta.
        onTravel: (name) => {
            void travelWithTime(name, { confirm: askBeforeTravelling })
                .then(({ reason }) => {
                    // Cancelar no lleva motivo: solo se avisa de lo que impide viajar.
                    if (reason) toastr.info(reason, 'No se puede viajar');
                    renderLocationMapsPreview();
                });
        },
        // Los paneles de SillyTavern se abren donde estan: en pausa su barra vuelve
        // arriba, por encima de esta capa, y el boton pulsa el mismo icono de siempre.
        // J0.4: las opciones del juego. Los ajustes de SillyTavern, al fondo y con conexión.
        onOptions: () => { void openGameOptionsPanel(); },
        onRules: () => { void openRules(); },
        onCompendium: () => { void openCompendiumLibrary(); },
        // Idea 181: el comprobador de densidad, desde la partida.
        onCheckWorld: () => { void checkCurrentWorld(); },
        // Idea 199: los caídos de todas las partidas.
        countHall: () => readHall(/** @type {any} */ (extension_settings).partyHall).length,
        // J3.9: «1 campaña terminada · 2 caídos».
        hallHint: () => describeHallCount(/** @type {any} */ (extension_settings).partyHall),
        onHall: () => { openHallOfFame(); },
        onEditCampaign: () => { void openCampaignBuilder(); },
        // El asistente de campana vive en la pantalla de bienvenida, que viaja dentro del
        // chat adoptado: pulsar su boton es pulsar el que ya existe.
        onNewCampaign: () => {
            const button = document.querySelector('#cw-new-campaign');
            if (button instanceof HTMLElement) button.click();
            else toastr.info('Abre "Nueva campana" desde la lista de partidas.');
        },
        // J4: jugar sin conexión, con los botones del bloque de la lista de partidas.
        onOffline: () => {
            const button = document.querySelector('#hub-new-game');
            if (button instanceof HTMLElement) button.click();
            else toastr.info('Espera a que cargue la lista de partidas.');
        },
        // J0.5 y J0.6: las partidas guardadas, «Continuar» y «Cargar partida». Las lee
        // campaigns.js con la lista de la portada; aquí solo se piden.
        getGames: () => savedGamesApi?.savedGameCards() ?? null,
        onLoadGame: (id) => { void import('../campaigns.js').then(m => m.continueSavedGame(id)); },
        onDeleteGame: (id) => { void import('../campaigns.js').then(m => m.deleteSavedGame(id)); },
        getAutostart: () => shouldAutostartGameShell(),
        setAutostart: (value) => {
            setGameShellAutostart(value);
            toastr.info(value
                ? 'El juego se abrira solo la proxima vez.'
                : 'La proxima vez arranca el SillyTavern de siempre. Vuelve con /modojuego.');
        },
        onExport: () => { void exportCampaignPack(); },
        onAudio: () => { void openAudioSettings(); },
        // Salir al menu principal es cerrar la partida, no cerrar el juego: el Shell se
        // queda, y lo que se ve es la pantalla de bienvenida con las campanas.
        onMainMenu: () => { $('#option_close_chat').trigger('click'); },
        renderStage: () => renderLocationMapsPreview(),
        onAttack: (name) => handlePlayerCombatAttack(name),
        onEndTurn: () => { void confirmEndTurn(); },
        onAutoTurn: () => {
            const entry = getCurrentTurnEntry();
            if (!entry || entry.isEnemy || !combatEncounter.active) return;
            postCombatNarration(resolveAllyTurnAction(entry));
            if (combatEncounter.active) endPlayerCombatTurn();
            renderLocationMapsPreview();
        },
        onDice: () => openDiceHistory(),
        onGlossary: () => openGlossary(),
        // J2.2: el de la pelea sale al empezar la primera, no al abrir el tablero.
        onScene: (scene) => { if (!MOMENT_TIPS.includes(scene)) showTip(scene); },
        // U0 del pegamento: el diario de sesión.
        onSceneTime: (scene) => keepSessionLog(enterScene(currentSessionLog(), scene, Date.now())),
        onSession: () => { void openSessionLog(); },
        onHowToPlay: () => { void openHowToPlay(); },
        // U5 del pegamento: la semana en una mesa.
        onWeekTable: () => { void openWeekTable(); },
        // Ideas 69 y 70: el mapa en texto.
        onTextMap: () => { void openTextMap(); },
        // Idea 187: en un sitio sin tablero, la música del pueblo.
        audioSceneFor: (scene) => (scene === 'exploration' && !currentBoardName && !combatEncounter.active ? 'town' : scene),
        getToggles: () => [
            // R1: el modo, arriba del todo. Pulsarlo abre el selector.
            { id: 'mode', label: `Modo: ${describeGameMode(survivalNow())}`, on: true },
            // R5: la mascota.
            { id: 'pet', label: currentPet() ? `Mascota: ${petName(/** @type {any} */ (currentPet()))}` : 'Mascota: ninguna', on: Boolean(currentPet()) },
            { id: 'saver', label: saverOn() ? 'Modo ahorro: encendido' : 'Modo ahorro: apagado', on: saverOn() },
            // Z6 de ROADMAP_SIN_TOKENS: quién cuenta (y cuánto se gasta), y si salen sucesos.
            {
                id: 'narrator',
                label: `Narrador: ${NARRATOR_LABELS[/** @type {keyof typeof NARRATOR_LABELS} */ (storedNarratorMode())]}${online_status === 'no_connection' && storedNarratorMode() !== 'motor' ? ' (sin conexión: Motor)' : ''}`,
                on: storedNarratorMode() !== 'modelo',
            },
            { id: 'sucesos', label: sucesosOn() ? 'Sucesos con decisión: sí' : 'Sucesos con decisión: no', on: sucesosOn() },
            { id: 'length', label: `Largo de la narración: ${LENGTHS[/** @type {keyof typeof LENGTHS} */ (String(chat_metadata?.[LENGTH_KEY] || 'ficha'))]?.label ?? 'Lo de su ficha'}`, on: Boolean(chat_metadata?.[LENGTH_KEY]) },
            { id: 'colorblind', label: localFlag.get(COLORBLIND_KEY) === '1' ? 'Colores para daltonismo: sí' : 'Colores para daltonismo: no', on: localFlag.get(COLORBLIND_KEY) === '1' },
            // Idea 195: la letra del narrador, de la campaña.
            { id: 'font', label: `Letra del narrador: ${(NARRATOR_FONTS.find(f => f.id === String(chat_metadata?.[NARRATOR_FONT_KEY] || '')) ?? NARRATOR_FONTS[0]).label}`, on: Boolean(chat_metadata?.[NARRATOR_FONT_KEY]) },
            // Idea 142: el tono de la escena.
            { id: 'tone', label: describeTone(chat_metadata?.[TONE_KEY]), on: readTone(chat_metadata?.[TONE_KEY]) !== 'auto' },
            // Ideas 25 y 29: la red de seguridad, y que los hartos se vayan.
            { id: 'safety', label: chat_metadata?.[SAFETY_ON_KEY] ? 'Red de seguridad: sí' : 'Red de seguridad: no', on: Boolean(chat_metadata?.[SAFETY_ON_KEY]) },
            { id: 'leave', label: chat_metadata?.[LEAVE_ON_KEY] ? 'Los hartos se van: sí' : 'Los hartos se van: no', on: Boolean(chat_metadata?.[LEAVE_ON_KEY]) },
            // U5 (DU4): la mesa se abre sola la primera vez; luego, con aviso, salvo que se quiera siempre.
            { id: 'mesa', label: chat_metadata?.[WEEK_TABLE_AUTO_KEY] ? 'La mesa cada semana: se abre sola' : 'La mesa cada semana: con aviso', on: Boolean(chat_metadata?.[WEEK_TABLE_AUTO_KEY]) },
        ],
        onToggle: (id) => {
            if (id === 'mode') {
                void openGameMode();
                return;
            }
            if (id === 'pet') {
                void openPetPanel();
                return;
            }
            if (id === 'narrator') {
                const next = NARRATOR_MODES[(NARRATOR_MODES.indexOf(storedNarratorMode()) + 1) % NARRATOR_MODES.length];
                try {
                    localStorage.setItem(NARRATOR_MODE_STORAGE, next);
                } catch { /* sin almacenamiento, se queda como estaba */ }
                toastr.info(NARRATOR_HINTS[/** @type {keyof typeof NARRATOR_HINTS} */ (next)], `Narrador: ${NARRATOR_LABELS[/** @type {keyof typeof NARRATOR_LABELS} */ (next)]}`);
            } else if (id === 'sucesos') {
                try {
                    localStorage.setItem(SUCESOS_STORAGE, sucesosOn() ? 'off' : 'on');
                } catch { /* sin almacenamiento, se queda como estaba */ }
            } else if (id === 'saver') localFlag.set(SAVER_KEY, saverOn() ? '' : '1');
            else if (id === 'colorblind') {
                localFlag.set(COLORBLIND_KEY, localFlag.get(COLORBLIND_KEY) === '1' ? '' : '1');
                applyColorblind();
            } else if (id === 'font' && chat_metadata) {
                const at = NARRATOR_FONTS.findIndex(f => f.id === String(chat_metadata[NARRATOR_FONT_KEY] || ''));
                chat_metadata[NARRATOR_FONT_KEY] = NARRATOR_FONTS[(at + 1) % NARRATOR_FONTS.length].id;
                saveMetadata();
                applyNarratorFont();
            } else if (id === 'length' && chat_metadata) {
                const next = nextLength(String(chat_metadata[LENGTH_KEY] || 'ficha'));
                chat_metadata[LENGTH_KEY] = next === 'ficha' ? '' : next;
                saveMetadata();
            } else if (id === 'tone' && chat_metadata) {
                chat_metadata[TONE_KEY] = nextTone(chat_metadata[TONE_KEY]);
                saveMetadata();
            } else if (id === 'mesa' && chat_metadata) {
                chat_metadata[WEEK_TABLE_AUTO_KEY] = !chat_metadata[WEEK_TABLE_AUTO_KEY];
                saveMetadata();
            } else if ((id === 'safety' || id === 'leave') && chat_metadata) {
                const key = id === 'safety' ? SAFETY_ON_KEY : LEAVE_ON_KEY;
                chat_metadata[key] = !chat_metadata[key];
                saveMetadata();
            }
            refreshWorldMemoryPrompt();
        },
        // Idea 180: el código del mundo.
        onShareWorld: () => { void shareWorld(); },
        // Ideas 175, 176, 183 y 185: el taller del mundo.
        onWorkshop: () => { void openWorkshop(); },
        onRetry: (mode) => { void retryLastReply(mode); },
        canRetry: () => narratorMode() !== 'motor',
        onFlee: () => { void retreatFromCombat(); },
        onClose: () => setLocationMapsHidden(wasHidden),
        getAbilities: () => {
            const member = getCurrentActingMember();
            if (!member || !combatEncounter.active) return [];
            return knownAbilities(member, getAbilityCatalogue())
                .filter(ability => ability.target !== 'enemy' && ability.combat !== false)
                .map(ability => {
                    const verdict = canUseAbility({
                        member,
                        ability,
                        hasAction: hasAction(combatEncounter, 'action'),
                        hasBonus: hasAction(combatEncounter, 'bonus'),
                        carried: carriedNames(),
                    });
                    const left = usesLeft(member, ability);
                    return {
                        id: ability.id,
                        label: Number.isFinite(left) ? `${ability.name} (${left})` : ability.name,
                        detail: verdict.ok ? describeAbility(ability) : verdict.reason,
                        enabled: verdict.ok,
                        needsAlly: ability.target === 'ally',
                        allies: ability.target === 'ally'
                            ? partyMembers
                                .filter(m => (Number(m.hp) || 0) > 0)
                                .map(m => ({ id: String(m.id), name: `${m.name} (${m.hp}/${m.maxHp})` }))
                            : [],
                    };
                });
        },
        onAbility: (abilityId, allyId) => {
            const member = getCurrentActingMember();
            const ability = getAbilityCatalogue().find(a => a.id === abilityId);
            if (!member || !ability) return;
            const ally = allyId ? partyMembers.find(m => String(m.id) === String(allyId)) : null;
            useAbility(member, ability, ability.target === 'ally' ? ally : null);
        },
        getManeuvers: () => {
            const member = getCurrentActingMember();
            if (!member || !combatEncounter.active) return [];
            const x = Number(member.mapPosition?.gridX) || 0;
            const y = Number(member.mapPosition?.gridY) || 0;
            const enemies = getAliveEnemies().map((/** @type {any} */ e) => ({
                id: String(e.instanceId),
                name: String(e.name),
                distanceFeet: getDistanceInFeet(x, y, Number(e.gridX) || 0, Number(e.gridY) || 0),
            }));
            // Idea 8: lo que hay a mano en el tablero, si hay algo al lado.
            const board8 = getActiveBoardContext();
            const scenery = judgeSceneryThrow({
                near: sceneryNear(board8.terrain, x, y, board8.gridWidth, board8.gridHeight),
                hasAction: hasAction(combatEncounter, 'action'),
                enemies,
            });
            return [
                ...judgeManeuvers({ hasAction: hasAction(combatEncounter, 'action'), enemies, hide: hideCheck(member) }),
                // Idea 122: lo que lleva para lanzar, con la misma forma que una maniobra.
                ...judgeThrows({ member, hasAction: hasAction(combatEncounter, 'action'), enemies }),
                ...(scenery ? [scenery] : []),
                // R4: los pergaminos y las varitas, con la misma forma.
                ...judgeMagicItems({
                    member,
                    hasAction: hasAction(combatEncounter, 'action'),
                    enemies,
                    allies: partyMembers.filter(m => (Number(m.hp) || 0) > 0).map(m => ({
                        id: String(m.id), name: String(m.name),
                        distanceFeet: getDistanceInFeet(x, y, Number(m.mapPosition?.gridX) || 0, Number(m.mapPosition?.gridY) || 0),
                    })),
                    abilityOf: (id) => getAbilityCatalogue().find(a => a.id === id),
                }),
            ];
        },
        onManeuver: (maneuverId, targetId) => {
            if (String(maneuverId).startsWith('leer:')) useMagicItem(String(maneuverId).slice('leer:'.length), targetId);
            else if (maneuverId === 'lanzar:objeto') throwScenery(targetId);
            else if (String(maneuverId).startsWith('lanzar:')) throwItem(String(maneuverId).slice('lanzar:'.length), targetId);
            else performManeuver(maneuverId, targetId);
        },
        onObjectives: () => {
            const verdict = judgeCurrentScenario();
            toastr.info(
                verdict ? verdict.summary : 'Este tablero no tiene objetivos: gana quien limpie el tablero.',
                'Objetivos', { timeOut: 10000 },
            );
        },
    };
}

/**
 * J0.4 de ROADMAP_SIN_CONEXION: las opciones del juego, en su ventana y con sus palabras.
 * Lo de este navegador; lo de cada partida (el tono, la red de seguridad…) sigue en la pausa.
 *
 * @returns {Promise<void>}
 */
async function openGameOptionsPanel() {
    const { openGameOptions, textOptions, cycleTextOption } = await import('../game-engine/ui/game-options.js');
    const { loadAudioSettings } = await import('../game-engine/ui/shell/scene-audio.js');
    // Sin proveedor, o en una partida del gremio (se juega sin conexión aunque lo haya).
    const offline = () => online_status === 'no_connection' || offlineGame();
    const yes = (/** @type {boolean} */ on) => (on ? 'Sí' : 'No');
    const rows = () => {
        const text = textOptions();
        return [
            // El modo es de la partida: solo con una abierta.
            ...(currentLocationName ? [{ id: 'mode', icon: 'fa-skull', label: 'Modo de juego', value: describeGameMode(survivalNow()), hint: 'Cuánto duele caer, en esta partida' }] : []),
            {
                id: 'narrator', icon: 'fa-feather', label: 'Quién cuenta',
                value: offline() ? 'El juego (sin conexión)' : NARRATOR_LABELS[/** @type {keyof typeof NARRATOR_LABELS} */ (storedNarratorMode())],
                hint: offline() ? 'Jugando sin conexión, lo cuenta siempre el juego' : 'El juego, el modelo o los dos',
            },
            { id: 'sucesos', icon: 'fa-signs-post', label: 'Sucesos con decisión', value: yes(sucesosOn()), hint: 'Cosas que pasan por el camino y piden decidir' },
            { id: 'size', icon: 'fa-text-height', label: 'Tamaño del texto', value: text.size.label },
            { id: 'speed', icon: 'fa-gauge', label: 'Velocidad del texto', value: text.speed.label, hint: 'Cómo aparece lo que se cuenta en la caja' },
            { id: 'colorblind', icon: 'fa-eye-low-vision', label: 'Colores para daltonismo', value: yes(localFlag.get(COLORBLIND_KEY) === '1') },
            { id: 'audio', icon: 'fa-music', label: 'Sonido', value: loadAudioSettings().enabled ? 'Encendido' : 'Apagado', hint: 'La música de cada escena y los golpes' },
            { id: 'autostart', icon: 'fa-door-open', label: 'Abrir el juego al entrar', value: yes(shouldAutostartGameShell()) },
            ...(offline() ? [] : [{ id: 'saver', icon: 'fa-piggy-bank', label: 'Modo ahorro', value: yes(saverOn()), hint: 'Gasta menos del modelo' }]),
        ];
    };
    await openGameOptions({
        Popup, POPUP_TYPE, rows,
        onPick: async (id) => {
            if (id === 'mode') await openGameMode();
            else if (id === 'audio') await openAudioSettings();
            else if (id === 'size' || id === 'speed') cycleTextOption(id);
            else if (id === 'autostart') setGameShellAutostart(!shouldAutostartGameShell());
            else if (id === 'narrator') {
                if (offline()) {
                    toastr.info('Jugando sin conexión cuenta el juego. En una partida con modelo se puede elegir.', 'Quién cuenta');
                    return;
                }
                const next = NARRATOR_MODES[(NARRATOR_MODES.indexOf(storedNarratorMode()) + 1) % NARRATOR_MODES.length];
                try {
                    localStorage.setItem(NARRATOR_MODE_STORAGE, next);
                } catch { /* sin almacenamiento, se queda como estaba */ }
            } else if (id === 'sucesos') {
                try {
                    localStorage.setItem(SUCESOS_STORAGE, sucesosOn() ? 'off' : 'on');
                } catch { /* sin almacenamiento, se queda como estaba */ }
            } else if (id === 'colorblind') {
                localFlag.set(COLORBLIND_KEY, localFlag.get(COLORBLIND_KEY) === '1' ? '' : '1');
                applyColorblind();
            } else if (id === 'saver') localFlag.set(SAVER_KEY, saverOn() ? '' : '1');
            refreshWorldMemoryPrompt();
        },
        onAdvanced: offline() ? null : () => { $('#ai-config-button .drawer-toggle').trigger('click'); },
    });
    refreshGameShell();
}

/** @returns {boolean} */
function shouldAutostartGameShell() {
    try {
        return window.localStorage.getItem(GAME_SHELL_AUTOSTART_KEY) !== 'false';
    } catch {
        return true;
    }
}

/** @param {boolean} value */
function setGameShellAutostart(value) {
    try {
        window.localStorage.setItem(GAME_SHELL_AUTOSTART_KEY, String(Boolean(value)));
    } catch (error) {
        console.warn('[party] no se pudo guardar el arranque del Modo Juego', error);
    }
}

/**
 * Abre el Modo Juego al arrancar, si toca.
 *
 * No decide **que** pantalla: eso es del director. Sin campana abierta cae en el titulo,
 * y con una campana a medias te deja donde lo dejaste — que es lo que uno espera de un
 * juego al que vuelve.
 */
function autostartGameShell() {
    if (!shouldAutostartGameShell() || isShellOpen()) return;

    const shellOptions = buildShellOptions();
    setLocationMapsHidden(false);
    toggleGameShell(shellOptions);
}

/**
 * Enciende o apaga el Modo Juego.
 *
 * Al encenderlo se abre el panel de localizacion aunque estuviera plegado: el Shell no
 * tiene otra cosa que poner en el escenario, y una pantalla completa vacia no se
 * entiende.
 *
 * @returns {string}
 */
function toggleGameMode() {
    if (isShellOpen()) {
        closeGameShell();
        return 'modo juego apagado';
    }

    // Las opciones primero: guardan si el panel estaba plegado, y desplegarlo antes
    // haria que el Shell lo "restaurara" siempre desplegado al apagarse.
    const shellOptions = buildShellOptions();
    setLocationMapsHidden(false);
    toggleGameShell(shellOptions);
    return 'modo juego encendido';
}


// ============================================================
//  CHARACTER SHEET TAB
// ============================================================


// ============================================================
//  INVENTORY TAB
// ============================================================


// ============================================================
//  PROGRESSION TAB
// ============================================================


// ============================================================
//  RELATIONSHIPS TAB
// ============================================================


// ============================================================
//  MEMORIES TAB
// ============================================================


export function initPartyPanel() {
    // Hoisted, so this works although setPartyTab is declared further down.
    partyTabSetter = setPartyTab;

    // The campaign tab is created from here, not from index.html: that file is
    // upstream's, and every line the fork adds to it is paid for at every merge.
    if ($('#rm_tab_campaign').length === 0) {
        $('<div class="right_menu_tab" id="rm_tab_campaign" data-tab="campaign" title="Calendario y vínculos">Campaña</div>')
            .insertAfter('#rm_tab_location');
    }
    if ($('#campaign_panel_row').length === 0) {
        $('<div id="campaign_panel_row" class="world-map-row width100p marginTop10 tab-panel-hidden"></div>')
            .insertAfter('#world_location_maps_row');
    }

    const panel = $('#rm_party_block');
    if (!panel.length) {
        return;
    }

    loadLocationMapsVisibility();

    $('#party_add_button').off('click').on('click', async () => {
        const worldName = chat_metadata ? chat_metadata[METADATA_KEY] : null;
        if (!worldName) {
            toastr.warning('Esta partida no tiene mundo: empieza una campaña primero.');
            return;
        }

        const data = /** @type {any} */ (await loadWorldInfo(worldName));
        if (!data?.entries) {
            toastr.warning('No se pudo leer el mundo de esta partida.');
            return;
        }

        // Filter to "Characters" group, exclude members already in party
        const existingNames = new Set(partyMembers.map(m => m.name.toLowerCase()));
        const existingUids = new Set(partyMembers.filter(m => m.wiUid != null).map(m => m.wiUid));
        const charEntries = [];
        for (const uid of Object.keys(data.entries)) {
            const entry = data.entries[uid];
            const group = (entry.group || '').trim().toLowerCase();
            const entityType = getDndEntryType(entry);
            const isCharacterEntry = entityType === 'character' || entityType === 'npc' || group.includes('character');
            if (!isCharacterEntry) continue;
            // Exclude already-in-party by uid or name
            if (existingUids.has(Number(entry.uid))) continue;
            const entryName = getPartyEntryDisplayName(entry).toLowerCase();
            if (existingNames.has(entryName)) continue;
            charEntries.push(entry);
        }

        if (charEntries.length === 0) {
            toastr.info('No queda nadie del mundo por sumar: ya están todos en el grupo.');
            return;
        }

        // Build a picker popup
        const selected = await showCharacterPicker(charEntries);
        if (!selected) return;

        partyMembers.push(memberFromEntry(selected, worldName));
        renderPartyMembers();
        savePartyState();
    });

    $(document).on('personaStateUpdated', (_, avatarId, newState) => {
        updatePartyMemberFromPersona(avatarId, newState);
    });

    $(document).on('worldMapUpdated', () => {
        renderWorldMapPreview();
    });

    $(document).on('worldLocationMapsUpdated', () => {
        renderLocationMapsPreview();
    });

    /**
     * @param {'party'|'world_map'|'location'|'campaign'|'board'} tab
     */
    function setPartyTab(tab) {
        const worldMapRow = $('#world_map_row');
        const locationRow = $('#world_location_maps_row');
        const campaignRow = $('#campaign_panel_row');
        const partyList = $('#rm_party_list');
        const partyFixedTop = $('#partyListFixedTop');

        // Remap legacy 'board' tab to 'location'
        const normalizedTab = /** @type {'party'|'world_map'|'location'|'campaign'} */ (tab === 'board' ? 'location' : tab);

        $('.right_menu_tab').removeClass('active');
        $(`#rm_tab_${normalizedTab}`).addClass('active');

        // show party pane and hidden others per tab
        partyList.toggleClass('tab-panel-hidden', normalizedTab !== 'party');
        partyFixedTop.toggleClass('tab-panel-hidden', normalizedTab !== 'party');
        worldMapRow.toggleClass('tab-panel-hidden', normalizedTab !== 'world_map');
        locationRow.toggleClass('tab-panel-hidden', normalizedTab !== 'location');
        campaignRow.toggleClass('tab-panel-hidden', normalizedTab !== 'campaign');

        if (normalizedTab === 'party') {
            renderPartyMembers();
        } else if (normalizedTab === 'world_map') {
            renderWorldMapPreview();
        } else if (normalizedTab === 'location') {
            renderLocationMapsPreview();
        } else if (normalizedTab === 'campaign') {
            renderCampaignTab();
        }

        try {
            window.localStorage.setItem('rm_PinAndTabs_selectedTab', normalizedTab);
        } catch (e) {
            console.warn('Unable to store selected tab', e);
        }
    }

    $('#rm_tab_campaign').on('click', () => setPartyTab('campaign'));
    $('#rm_tab_party').on('click', () => setPartyTab('party'));
    $('#rm_tab_world_map').on('click', () => setPartyTab('world_map'));
    $('#rm_tab_location').on('click', () => setPartyTab('location'));

    $(document).on('click', '.party-remove-member', null, () => {
        // handled by individual buttons
    });

    // Read the party from the chat that is already open; CHAT_CHANGED keeps it
    // in sync from here on. loadPartyForChat() renders on its own.
    loadPartyForChat();
    renderWorldMapPreview();
    renderLocationMapsPreview();

    // Restore per-session party when chat changes
    // El juego se abre por su pantalla de titulo. Se espera a que la aplicacion termine de
    // cargar — antes de APP_READY el chat todavia se esta montando, y adoptarlo a medias
    // deja la pantalla en blanco.
    eventSource.on(event_types.APP_READY, () => {
        // Un respiro para que la pantalla de bienvenida acabe de dibujar sus campanas: es
        // lo que el menu cuenta en "Cargar partida".
        setTimeout(() => autostartGameShell(), 400);
    });

    eventSource.on(event_types.CHAT_CHANGED, () => {
        loadPartyForChat();
        // Idea 195: la letra del narrador es de la campaña.
        applyNarratorFont();
        // Idea 144: en otra partida no se está hablando con nadie.
        setTalkingTo('');
        // Y volver a dibujar donde estabas. `loadPartyForChat` restaura la localidad y el
        // tablero en memoria, pero nadie repintaba el panel: al cargar una partida veias
        // el selector de "¿donde estas?" y habia que volver a entrar a mano en el sitio
        // donde ya estabas. Si el mundo aun no ha terminado de cargar, el evento
        // `worldLocationMapsUpdated` vuelve a pasar por aqui.
        renderWorldMapPreview();
        renderLocationMapsPreview();
        // Cerrar la partida ya no apaga el Modo Juego: sin campana abierta, la escena
        // de titulo ensena la bienvenida con las campanas, que es donde hay que estar.
        if (isShellOpen()) refreshGameShell();

        // La semilla es de la partida, no de la sesion: abrir una campana con semilla
        // fijada tiene que volver a fijarla, o el "mismo" combate saldria distinto.
        const seed = chat_metadata?.[SEED_KEY];
        setRandomSource(seed ? createSeededRandom(String(seed)) : null);
        // The campaign may play by its own rules; see applyCampaignRuleset.
        applyCampaignRuleset(String(chat_metadata?.[METADATA_KEY] || ''))
            .catch(error => console.error('[party] campaign ruleset failed', error));
    });

    /** @type {'party'|'world_map'|'location'|'campaign'} */
    const initiallySelected = /** @type {'party'|'world_map'|'location'|'campaign'} */ (window.localStorage.getItem('rm_PinAndTabs_selectedTab') || 'party');
    if (typeof setPartyTab === 'function') {
        setPartyTab(initiallySelected);
    }

    // ================================================================
    //  Slash commands: /go, /enter, /leave
    // ================================================================

    /** Helper: enum provider listing current world's location names */
    function locationEnumProvider() {
        return getCurrentWorldLocationMaps().map(l => new SlashCommandEnumValue(l.name, l.region || ''));
    }

    /** Helper: enum provider listing boards at the current location */
    function boardEnumProvider() {
        const loc = getCurrentWorldLocationMaps().find(l => l.name === currentLocationName);
        const locBoards = getLocationBoards(loc);
        const globalBoards = getCurrentWorldBoards();
        console.log('[party] boardEnumProvider', { currentLocationName, loc: loc?.name, locBoardsLength: locBoards.length, locBoards, globalBoardsLength: globalBoards.length });
        if (locBoards.length > 0) {
            return locBoards.map((/** @type {any} */ b) => new SlashCommandEnumValue(b.name));
        }
        if (globalBoards.length > 0) {
            console.log('[party] boardEnumProvider fallback to global boards', { globalBoards });
            return globalBoards.map((/** @type {any} */ b) => new SlashCommandEnumValue(b.name));
        }
        return [];
    }

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'go',
        helpString: '<div>Navigate to a location. Usage: <code>/go Oakhaven</code></div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Location name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: locationEnumProvider,
            }),
        ],
        // Sin confirmacion: escribir el comando ya es la decision. El clic del mapa si
        // pregunta, porque un clic no puede gastar dias sin avisar. Lo que no cambia es el
        // coste: dos formas de viajar y una gratis seria una forma de saltarse el hambre.
        callback: async (_args, value) => {
            // Escribirlo es decidir el viaje entero; pero se hace de vecino en vecino, llegando
            // de verdad a cada sitio de en medio, no de un salto.
            let { to, reason, via } = await travelWithTime(String(value));
            for (let hop = 0; !to && via && hop < 8; hop++) {
                const step = await travelWithTime(via);
                if (!step.to) {
                    reason = step.reason;
                    break;
                }
                ({ to, reason, via } = await travelWithTime(String(value)));
            }
            if (!to) {
                // El motivo que venga, una sola vez: antes esto decia «not found» aunque
                // el sitio existiera y lo que fallara fuese el camino.
                if (reason) toastr.warning(reason, 'No se puede viajar');
                return '';
            }
            setPartyTab('location');
            toastr.info(`📍 Llegáis a ${to}`);
            return to;
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'enter',
        helpString: '<div>Enter a board at your current location. Usage: <code>/enter Tavern</code></div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Board name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: boardEnumProvider,
            }),
        ],
        callback: (_args, value) => {
            const name = String(value).trim();
            console.log('[party] /enter called', { currentLocationName, name });
            if (!currentLocationName) {
                toastr.warning('Primero id a una localización (/go).');
                return '';
            }

            const entered = enterBoard(name);
            if (!entered) {
                if (!holdDuringCombat(combatEncounter, 'board')) {
                    toastr.warning(`En ${currentLocationName} no hay ningún tablero «${name}».`);
                }
                return '';
            }

            setPartyTab('location');
            toastr.info(`🎲 Entras en ${entered}`);
            tellBoard(String(entered));
            return entered;
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'narrador',
        helpString: '<div>Cambia <b>cuánto se extiende</b> quien narra esta campaña: de una o dos '
            + 'frases a sin freno. Se escribe en su ficha, que es lo que llega al modelo cada turno.</div>',
        callback: async () => {
            const { changeNarratorPace } = await import('../campaigns.js');
            return await changeNarratorPace();
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'gremio',
        helpString: '<div>El tablon de encargos, la casa y quien esta contratado. '
            + 'Aceptar un encargo <b>construye el sitio</b> donde se juega.</div>',
        callback: async () => await openGuild(),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'cuenta',
        helpString: '<div>Lo que debes esta semana y cuanto tienes: comida, posada, tasas, '
            + 'sueldos y lo que costaria curar a los heridos. Se pregunta cuando quieras, '
            + 'porque una factura que ves venir es una decision y una que te sorprende es un impuesto.</div>',
        callback: () => showWeeklyBill(),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'sandbox',
        helpString: '<div>Abre un tablero de pruebas con terreno, niebla, tokens y registro de combate. No guarda nada.</div>',
        callback: async () => {
            const { openSandbox } = await import('../game-engine/ui/sandbox.js');
            await openSandbox({ Popup, POPUP_TYPE });
            return '';
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'leave',
        helpString: '<div>Leave the current board or location. Cascading: board first, then location.</div>',
        callback: () => {
            const held = holdDuringCombat(combatEncounter, 'board');
            if (held) {
                toastr.warning(held, 'Combate en marcha');
                return '';
            }

            if (currentBoardName) {
                const leftBoard = currentBoardName;
                setCurrentBoardName('');
                saveCurrentBoard();
                setPartyTab('location');
                toastr.info(`← Sales de ${leftBoard}`);
                return leftBoard;
            }
            if (currentLocationName) {
                const leftLoc = currentLocationName;
                setCurrentLocationName('');
                setCurrentBoardName('');
                saveCurrentLocation();
                saveCurrentBoard();
                setPartyTab('location');
                toastr.info(`← Sales de ${leftLoc}`);
                return leftLoc;
            }
            toastr.info('No estáis dentro de nada de lo que salir.');
            return '';
        },
    }));

    // ================================================================
    //  Slash command: /fight
    // ================================================================

    /** Helper: enum provider listing enemies at the current board */
    function enemyEnumProvider() {
        const loc = getCurrentWorldLocationMaps().find(l => l.name === currentLocationName);
        const boards = getLocationBoards(loc);
        const board = boards.find((/** @type {any} */ b) => b.name === currentBoardName);
        if (!board || !board.isCombat || !Array.isArray(board.encounterRules) || !board.encounterRules.length) return [];
        const globalEnemies = getCurrentWorldEnemies();
        return board.encounterRules.map((/** @type {any} */ r) => {
            const template = globalEnemies.find(e => e.id === r.enemyId);
            if (!template) return null;
            return new SlashCommandEnumValue(template.name, `${r.minCount}-${r.maxCount} | HP:${template.hp} AC:${template.armorClass} CR:${template.cr}`);
        }).filter(Boolean);
    }

    function currentTurnTargetEnumProvider() {
        const member = getCurrentActingMember();
        if (!member) return [];
        return getAttackableEnemiesForMember(member).map(enemy => new SlashCommandEnumValue(
            enemy.name,
            `${getDistanceInFeet(member.mapPosition?.gridX || 0, member.mapPosition?.gridY || 0, enemy.gridX || 0, enemy.gridY || 0)} ft | HP:${enemy.currentHp}/${enemy.maxHp} AC:${enemy.armorClass}`,
        ));
    }

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'fight',
        helpString: '<div>Start a combat encounter. Usage: <code>/fight Goblin 3</code></div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Enemy name and optional count (e.g. "Goblin 3")',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: enemyEnumProvider,
            }),
        ],
        callback: (_args, value) => {
            const raw = String(value).trim();
            // Parse "EnemyName N" or just "EnemyName"
            const countMatch = raw.match(/^(.+?)\s+(\d+)$/);
            const enemyName = countMatch ? countMatch[1].trim() : raw;
            const countOverride = countMatch ? parseInt(countMatch[2], 10) : 0;

            if (!currentLocationName) {
                toastr.warning('Primero id a una localización (/go).');
                return '';
            }
            if (!currentBoardName) {
                toastr.warning('Primero entrad en un tablero (/enter).');
                return '';
            }

            const loc = getCurrentWorldLocationMaps().find(l => l.name === currentLocationName);
            const boards = getLocationBoards(loc);
            const board = boards.find((/** @type {any} */ b) => b.name === currentBoardName);

            if (!board || !board.isCombat) {
                toastr.warning('En este tablero no se pelea.');
                return '';
            }

            const globalEnemies = getCurrentWorldEnemies();
            const rule = (board.encounterRules || []).find((/** @type {any} */ r) => {
                const tmpl = globalEnemies.find(e => e.id === r.enemyId);
                return tmpl && tmpl.name.toLowerCase() === enemyName.toLowerCase();
            });
            if (!rule) {
                toastr.warning(`«${enemyName}» no es de los enemigos de este tablero.`);
                return '';
            }

            const template = globalEnemies.find(e => e.id === rule.enemyId);
            if (!template) {
                toastr.warning('Ese enemigo no está en el bestiario del mundo.');
                return '';
            }

            const gw = loc?.gridWidth || 50;
            const gh = loc?.gridHeight || 50;
            const count = countOverride > 0
                ? countOverride
                : Math.floor(Math.random() * (rule.maxCount - rule.minCount + 1)) + rule.minCount;
            const summary = startCombat(template, count, gw, gh);

            toastr.success(`⚔️ ¡Empieza el combate!\n${summary}`, '', { timeOut: 8000 });

            // Re-render board to show enemy tokens + combat UI
            setPartyTab('location');
            return summary;
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'combat-attack',
        helpString: '<div>Attack an enemy during your current turn. Usage: <code>/combat-attack Goblin 1</code></div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Enemy name in range',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: currentTurnTargetEnumProvider,
            }),
        ],
        callback: (_args, value) => handlePlayerCombatAttack(String(value || '')),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'combat-move',
        helpString: '<div>Move your current combatant on the board. Usage: <code>/combat-move 12 8</code></div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Target coordinates X Y',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
            }),
        ],
        callback: (_args, value) => handlePlayerCombatMove(String(value || '')),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'combat-end',
        helpString: '<div>End the current player turn and advance combat. '
            + 'To leave the fight entirely, use <code>/combat-stop</code>.</div>',
        callback: () => endPlayerCombatTurn(),
    }));

    // Until this existed, a fight could only be left by winning it or dying: there was no
    // way out of an encounter started by mistake, and no way to reach the epilogue except
    // through a body count.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'combat-stop',
        helpString: '<div>Abandona el combate en curso sin resolverlo. '
            + 'Publica el resumen final igual que una victoria o una derrota.</div>',
        callback: () => {
            if (!combatEncounter.active) {
                toastr.info('No hay ningun combate en curso.');
                return '';
            }
            endCombat('manual');
            renderLocationMapsPreview();
            return 'combate abandonado';
        },
    }));

    // Opens the rules editor for the open campaign and saves what comes back into the
    // world, which is where a campaign's rules belong: exporting the world takes them
    // along, and two campaigns can disagree about what a weapon is.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'rules',
        helpString: '<div>Abre el editor de reglas de la campaña: tipos de daño, propiedades de armas y armaduras, condiciones, rarezas. '
            + 'Lo que guardes se aplica al recargar.</div>',
        callback: () => openRules(),
    }));

    // The prompt preview (wiki/ROADMAP.md, T3). Recording is a listener rather than a
    // rebuild for display: what it shows is the request the app actually sent.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'prompt',
        helpString: '<div>Muestra qué se envía al modelo en cada turno, desglosado por bloque, '
            + 'y lo que lleva gastado la sesión. <code>/prompt reset</code> pone el contador a cero.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'reset para reiniciar el contador de la sesión',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
            }),
        ],
        callback: async (_args, value) => {
            const { openPromptPreview, resetSession, getSession } = await import('../game-engine/ui/prompt-preview.js');

            if (String(value ?? '').trim().toLowerCase() === 'reset') {
                resetSession();
                toastr.success('Contador de la sesión reiniciado.');
                return '0';
            }

            await openPromptPreview({ Popup, POPUP_TYPE });
            return String(getSession().promptTokens);
        },
    }));

    // Conditions could only be set by opening a character sheet, or by the combat putting
    // them there itself. Marking someone poisoned mid-scene is a table gesture, so it
    // belongs in the chat next to /fight.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'time',
        helpString: '<div>Muestra el día y el momento actual. <code>/time next</code> pasa al siguiente bloque '
            + 'y <code>/time sleep</code> al día siguiente.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'next | sleep',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                enumList: [
                    new SlashCommandEnumValue('next', 'Siguiente bloque del día'),
                    new SlashCommandEnumValue('sleep', 'Dormir hasta mañana'),
                ],
            }),
        ],
        callback: (_args, value) => {
            const what = String(value ?? '').trim().toLowerCase();

            if (what === 'next') advanceCampaignSlot();
            else if (what === 'sleep') advanceCampaignDay();
            else toastr.info(formatCalendar(getCampaignCalendar()));

            return formatCalendar(getCampaignCalendar());
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'bond',
        helpString: '<div>Registra algo que ha pasado con un compañero: '
            + '<code>/bond Lyra confidant_scene</code>. Sin evento, muestra el rango actual. '
            + 'Los vínculos suben por hechos registrados, no por lo que diga la narración.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Nombre del compañero, y el evento',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
            }),
        ],
        callback: (_args, value) => {
            const raw = String(value ?? '').trim();
            if (!raw) {
                toastr.warning('Usa: /bond <nombre> <evento>');
                return '';
            }

            const parts = raw.split(/\s+/);
            const known = parts.length > 1 && Object.prototype.hasOwnProperty.call(BOND_EVENTS, parts[parts.length - 1]);
            const targetName = known ? parts.slice(0, -1).join(' ') : raw;
            const eventType = known ? parts[parts.length - 1] : '';

            const member = partyMembers.find(m => m.name.toLowerCase() === targetName.toLowerCase());
            if (!member) {
                toastr.warning(`No encuentro a "${targetName}" en el grupo.`);
                return '';
            }

            if (!eventType) {
                const { rank, points, nextAt } = getBondProgress(getCampaignBonds(), String(member.id));
                const text = nextAt
                    ? `${member.name}: rango ${rank} (${points}/${nextAt}).`
                    : `${member.name}: rango máximo (${points} puntos).`;
                toastr.info(text);
                return String(rank);
            }

            recordCampaignBondEvent(String(member.id), eventType);
            return String(getBondProgress(getCampaignBonds(), String(member.id)).rank);
        },
    }));

    // The rank-5 perk, spent deliberately. Giving away your leftover movement is a
    // decision, so it is a command rather than something the engine does for you.
    // The contract for the Gem that processes a book. The Gem itself lives outside this
    // program — in a Gemini subscription — so the one thing the code owes it is an exact,
    // generated schema: a copy kept by hand goes stale and the failure shows up a whole
    // book later. See wiki/archivo/ROADMAP_INGESTA_CAMPANAS_LIBROS.md.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'esquema-campana',
        helpString: '<div>Entrega el contrato del paquete de campaña para pegarlo en tu Gem: '
            + 'el esquema JSON, las reglas que el esquema no puede comprobar y un ejemplo de salida correcta.</div>',
        callback: async () => {
            const { openCampaignSchema } = await import('../game-engine/ui/campaign-schema-panel.js');
            await openCampaignSchema({ Popup, POPUP_TYPE });
            return 'esquema mostrado';
        },
    }));

    // El camino de vuelta del importador: sin esto se puede meter el libro de otro y no
    // mandar el tuyo, que es media historia de "sin marketplace".
    // U8 del pegamento: el caso.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'caso',
        helpString: '<div>El caso abierto: <code>/caso</code> abre su tablero; <code>/caso preguntar Giles</code> le pregunta; '
            + '<code>/caso buscar</code> busca aquí; <code>/caso nuevo</code> empieza uno si no hay ninguno; '
            + '<code>/caso muerto</code> le pregunta a la víctima, si alguien sabe Hablar con los muertos.</div>',
        unnamedArgumentList: [SlashCommandArgument.fromProps({ description: 'preguntar <nombre> | buscar | nuevo', typeList: [ARGUMENT_TYPE.STRING], isRequired: false })],
        callback: async (_args, value) => {
            const raw = String(value ?? '').trim();
            const [verb, ...rest] = raw.split(/\s+/);
            if (/^preguntar$/i.test(verb)) return askAboutCase(rest.join(' '));
            if (/^buscar$/i.test(verb)) {
                await searchCaseHere();
                return '';
            }
            if (/^nuevo$/i.test(verb)) return (await startCase(true)) ? 'caso abierto' : '';
            // R4: el muerto contesta, si alguien sabe preguntarle.
            if (/^muerto$/i.test(verb)) return askTheDead();
            await openCaseBoard();
            return '';
        },
    }));

    // U6 del pegamento: convencer a alguien, en un duelo de palabras.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'convencer',
        helpString: '<div>Convencer a alguien del mundo en un duelo de palabras: tres rondas, con lo que tengáis. Una vez al día por persona.</div>',
        unnamedArgumentList: [SlashCommandArgument.fromProps({ description: 'a quién', typeList: [ARGUMENT_TYPE.STRING], isRequired: true })],
        callback: async (_args, value) => duelWith(String(value ?? '')),
    }));

    // Ideas 69 y 70: el mapa en texto.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'mapa',
        helpString: '<div>El mapa en texto: los sitios y sus caminos, lo no visitado en gris, y tus notas.</div>',
        callback: async () => {
            await openTextMap();
            return '';
        },
    }));

    // J4 de ROADMAP_SIN_CONEXION: el gremio.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'campanas',
        helpString: '<div>El tablón de campañas del gremio: empezar una o seguir la que dejaste. Tu grupo va entero.</div>',
        callback: async () => await openHubCampaigns(),
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'contratar',
        helpString: '<div>Los mercenarios del gremio: contratar a uno (se paga una vez y va contigo hasta que le despidas) o despedirle.</div>',
        callback: async () => await openHubHire(),
    }));
    // J2.3: saltar la prueba de la bodega, para quien ya sabe jugar.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'saltar-prueba',
        helpString: '<div>Saltar la prueba del gremio: cuenta como ganada, sin pelea y sin botín, y el hilo sigue con el tablón de campañas.</div>',
        callback: async () => await skipHubTrial(),
    }));
    // No `/gremio`: ese nombre es del panel de la compañía (el tablón de encargos y los edificios).
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'volver-gremio',
        helpString: '<div>Volver al gremio desde una campaña, con todo lo ganado. La campaña queda donde la dejas.</div>',
        callback: async () => {
            if (combatEncounter.active) {
                toastr.warning('No mientras peleáis.');
                return '';
            }
            if (!lastHubHome) {
                toastr.info('Esta campaña no sale de ningún gremio.', 'El gremio');
                return '';
            }
            const { returnToHub } = await import('../campaigns.js');
            await returnToHub();
            return '';
        },
    }));
    // J4.5 y J3.9: el final de la campaña, otra vez, y el salón de la fama.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'final',
        helpString: '<div>Volver a ver el final de la campaña: lo que pasó, qué fue de cada uno y lo que se lleva.</div>',
        callback: async () => await openEnding(),
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'salon',
        helpString: '<div>El salón de la fama: las campañas terminadas y los caídos de todas las partidas.</div>',
        callback: () => {
            openHallOfFame();
            return '';
        },
    }));

    // R5 del roadmap de profundidad: la mascota.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'mascota',
        helpString: '<div>La mascota del héroe: tenerla, preguntarle lo que aprieta, acariciarla. No ocupa plaza ni cobra.</div>',
        callback: async () => await openPetPanel(),
    }));

    // R4: aprender de un pergamino.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'pergamino',
        helpString: '<div>Aprender el conjuro de un pergamino, en vez de leerlo: solo quien ha estudiado (el mago o el erudito). El pergamino se gasta.</div>',
        unnamedArgumentList: [SlashCommandArgument.fromProps({ description: 'de qué pergamino (opcional)', typeList: [ARGUMENT_TYPE.STRING], isRequired: false })],
        callback: async (_args, value) => learnFromScroll(String(value ?? '').trim()),
    }));

    // R4 del roadmap de profundidad: el grimorio del grupo.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'grimorio',
        helpString: '<div>Lo que el grupo sabe lanzar: cada conjuro con su escuela y su círculo, las cargas que quedan '
            + 'y lo que se gasta. No existe más magia que la del grimorio.</div>',
        unnamedArgumentList: [SlashCommandArgument.fromProps({ description: '«todo» para ver toda la magia que existe', typeList: [ARGUMENT_TYPE.STRING], isRequired: false })],
        callback: async (_args, value) => {
            await openGrimoire(/^todo$/i.test(String(value ?? '').trim()));
            return '';
        },
    }));

    // R1 del roadmap de profundidad: el modo de juego.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'modo',
        helpString: '<div>El modo de juego: Relajado, Normal, Supervivencia o a tu medida. Dice qué está encendido '
            + 'y deja cambiarlo; el cambio queda en la crónica.</div>',
        callback: async () => await openGameMode(),
    }));

    // U5 del pegamento: la mesa de la semana.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'mesa',
        helpString: '<div>La mesa de la semana: los asuntos que no caben todos, con su plazo y lo que pasa si no se atienden; '
            + 'cómo os ven, y lo que viene.</div>',
        callback: async () => {
            await openWeekTable();
            return '';
        },
    }));

    // U2 del pegamento: lo que el juego da por cierto.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'estado',
        helpString: '<div>Lo que el juego da por cierto: cada cosa que la partida guarda, con cuánto hay, '
            + 'y qué vuelve con un punto de retorno.</div>',
        callback: async () => {
            await openStateView();
            return '';
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'punto',
        helpString: '<div>Puntos de retorno. <code>/punto</code> los lista, '
            + '<code>/punto guardar Antes del jefe</code> guarda uno y '
            + '<code>/punto volver 1</code> devuelve la partida al numero que diga la lista. '
            + 'No toca la conversacion: solo el estado del juego.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'guardar <nombre> | volver <numero>',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
            }),
        ],
        callback: async (_args, value) => {
            const raw = String(value ?? '').trim();
            const list = normalizeCheckpoints(chat_metadata?.[CHECKPOINT_KEY]);

            if (!raw) {
                if (list.length === 0) return 'No hay ningun punto de retorno todavia.';
                const lines = list.map((cp, i) => `${i + 1}. ${describeCheckpoint(cp)}`);
                toastr.info(lines.join('\n'), 'Puntos de retorno', { timeOut: 15000 });
                return lines.join(' | ');
            }

            const [verb, ...rest] = raw.split(/\s+/);
            const argument = rest.join(' ').trim();

            if (/^guardar$/i.test(verb)) {
                saveCheckpoint(argument || 'Guardado a mano');
                return 'punto guardado';
            }

            if (/^volver$/i.test(verb)) {
                const index = parseInt(argument, 10) - 1;
                const target = list[index];
                if (!target) {
                    toastr.warning(`No hay un punto numero ${argument}. Escribe /punto para verlos.`);
                    return '';
                }
                return (await restoreCheckpoint(target.id)) ? `vuelta a ${target.label}` : '';
            }

            toastr.warning('Usa /punto, /punto guardar <nombre> o /punto volver <numero>.');
            return '';
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'campana',
        helpString: '<div>El editor de la campana abierta: el mundo y sus localizaciones, con sus tableros. '
            + 'Escribe donde escribe el importador de libros.</div>',
        callback: async () => await openCampaignBuilder(),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'habilidades',
        helpString: '<div>Escribe conjuros, tecnicas y recursos de clase, y reparte quien se sabe cada uno. '
            + 'Se guardan con las reglas de la campa\u00f1a.</div>',
        callback: async () => await openAbilitiesEditor(),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'sonido',
        helpString: '<div>Ajusta que suena en cada escena del Modo Juego. Las pistas las pones tu: '
            + 'una direccion de tu servidor o una URL.</div>',
        callback: async () => await openAudioSettings(),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'exportar-campana',
        helpString: '<div>Empaqueta la campaña abierta en un archivo que se puede importar '
            + 'en otra instalación: mundo, tableros, bestiario, compañeros y misiones.</div>',
        callback: async () => await exportCampaignPack(),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'semilla',
        helpString: '<div>Fija la semilla de los dados para que una partida se repita igual. '
            + '<code>/semilla molino</code> la fija, <code>/semilla</code> sola vuelve al azar. '
            + 'Sirve para saber si un cambio mejoro algo, en vez de suponerlo.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'La semilla, o nada para volver al azar',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
            }),
        ],
        callback: (_args, value) => {
            const raw = String(value ?? '').trim();

            if (!raw) {
                setRandomSource(null);
                if (chat_metadata) {
                    delete chat_metadata[SEED_KEY];
                    saveMetadata();
                }
                toastr.info('Los dados vuelven a ser aleatorios.', 'Semilla');
                return '';
            }

            setRandomSource(createSeededRandom(raw));
            if (chat_metadata) {
                chat_metadata[SEED_KEY] = raw;
                saveMetadata();
            }
            toastr.success(`Semilla "${raw}" (${seedFrom(raw)}). Las tiradas se repetiran igual.`, 'Semilla');
            return raw;
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'contradicciones',
        helpString: '<div>Lo que la narracion ha dicho y el motor no confirma, agrupado por tipo. '
            + 'No corrige nada: dice donde falla el prompt.</div>',
        callback: () => {
            const summary = summariseContradictions(chat_metadata?.[CONTRADICTIONS_KEY]);
            if (summary.total === 0) {
                toastr.success('La narracion no ha contradicho al motor ni una vez.', 'Contradicciones');
                return '0';
            }

            const lines = summary.byKind
                .map(k => `${k.count} de ${k.kind} — ultima: ${k.last}`)
                .join(String.fromCharCode(10));
            toastr.info(lines, `${summary.total} contradiccion(es)`, { timeOut: 20000 });
            return String(summary.total);
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'enemigos',
        helpString: '<div>Abre los enemigos que este tablero puede sacar, y cuantos. '
            + 'Lo que <code>/fight</code> encuentra sale de aqui.</div>',
        callback: () => editBoardEncounters(),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'definitivo',
        helpString: '<div>El golpe definitivo del vinculo de rango 10: impacta sin tirar y hace el maximo del arma '
            + 'mas el nivel. Una vez al dia. Usage: <code>/definitivo Goblin 1</code></div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Enemigo al alcance',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: currentTurnTargetEnumProvider,
            }),
        ],
        callback: (_args, value) => resolveUltimateStrike(String(value || '')),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'descanso',
        helpString: '<div>Descansa. <code>/descanso corto</code> gasta dados de golpe y un bloque del dia; '
            + '<code>/descanso largo</code> cura del todo, devuelve la mitad de los dados y amanece.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'corto o largo',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                enumProvider: () => [
                    new SlashCommandEnumValue('corto', 'Gasta dados de golpe y un bloque del dia'),
                    new SlashCommandEnumValue('largo', 'Cura del todo, devuelve dados y amanece'),
                ],
            }),
        ],
        callback: (_args, value) => {
            const kind = String(value ?? '').trim().toLowerCase();
            if (kind !== 'corto' && kind !== 'largo') {
                toastr.info('Di que descanso quieres: /descanso corto o /descanso largo.');
                return '';
            }
            return takeRest(kind);
        },
    }));

    // El Modo Juego se enciende y se apaga con el mismo comando, a proposito: es una capa
    // de presentacion, y la garantia de que se pueda quitar vale tanto como la capa.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'modojuego',
        helpString: '<div>Enciende o apaga el Modo Juego: el tablero a pantalla completa, '
            + 'con el rastreador, el registro y la barra de acciones. Se sale con <code>Esc</code>.</div>',
        callback: () => toggleGameMode(),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'objetivos',
        helpString: '<div>Muestra los objetivos del escenario en curso. '
            + '<code>/objetivos editar</code> los abre para cambiarlos, o para que la IA los proponga.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'editar para abrirlos',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
            }),
        ],
        callback: (_args, value) => {
            if (String(value ?? '').trim().toLowerCase() === 'editar') {
                return editBoardObjectives();
            }
            const verdict = judgeCurrentScenario();
            if (!verdict) {
                toastr.info('Este tablero no tiene objetivos: gana quien limpie el tablero. Pruebalo con /objetivos editar.');
                return '';
            }
            toastr.info(verdict.summary, 'Objetivos', { timeOut: 10000 });
            return verdict.summary;
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'relevo',
        helpString: '<div>Cede el movimiento que te queda a un compañero, si tienes el vínculo de rango 5. '
            + '<code>/relevo Brand</code></div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Nombre del compañero',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
            }),
        ],
        callback: (_args, value) => handleBatonPass(String(value ?? '')),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'condition',
        helpString: '<div>Pone o quita una condición. <code>/condition Lyra Poisoned</code> la alterna, '
            + '<code>/condition Lyra</code> muestra las que tiene, y <code>/condition Lyra clear</code> las quita todas.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Nombre del personaje o enemigo, y la condición',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
            }),
        ],
        callback: (_args, value) => {
            const raw = String(value ?? '').trim();
            if (!raw) {
                toastr.warning('Usa: /condition <nombre> <condición>');
                return '';
            }

            // The name can hold spaces, so the condition is taken as the last word and
            // the rest is the name — the same shape /fight already uses for its count.
            const parts = raw.split(/\s+/);
            const targetName = parts.length > 1 ? parts.slice(0, -1).join(' ') : raw;
            const conditionName = parts.length > 1 ? parts[parts.length - 1] : '';

            const member = partyMembers.find(m => m.name.toLowerCase() === targetName.toLowerCase());
            const enemy = combatEncounter.enemies.find(e => e.name.toLowerCase() === targetName.toLowerCase());
            const target = member || enemy;

            if (!target) {
                toastr.warning(`No encuentro a "${targetName}".`);
                return '';
            }

            const current = Array.isArray(target.activeConditions) ? target.activeConditions : [];

            if (!conditionName) {
                const list = current.length ? current.join(', ') : 'ninguna';
                toastr.info(`${target.name}: ${list}.`);
                return list;
            }

            if (conditionName.toLowerCase() === 'clear') {
                target.activeConditions = [];
                postCombatNarration(`🧪 [BOARD] ${target.name} se libra de todas sus condiciones.`);
            } else {
                const { conditions, added } = toggleCondition(current, conditionName);
                target.activeConditions = conditions;
                postCombatNarration(added
                    ? `🧪 [BOARD] ${target.name} queda ${conditionName}.`
                    : `🧪 [BOARD] ${target.name} se libra de ${conditionName}.`);
            }

            if (member) savePartyState();
            if (enemy) saveCombatState();
            renderLocationMapsPreview();
            return (target.activeConditions || []).join(', ');
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'prisionero',
        helpString: '<div>Qué hacer con un prisionero: <code>/prisionero interrogar p1</code>, '
            + '<code>/prisionero entregar p1</code> o <code>/prisionero soltar p1</code>.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({ description: 'acción e id', typeList: [ARGUMENT_TYPE.STRING], isRequired: true }),
        ],
        callback: async (_args, value) => {
            const [what, id] = String(value ?? '').trim().split(/\s+/);
            const said = await handlePrisoner(String(what ?? ''), String(id ?? ''));
            if (isShellOpen()) refreshGameShell();
            return said;
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'forrajear',
        helpString: '<div>Cazar y forrajear: gasta un rato del día. Si sale, todos comen y beben; si no, al menos agua.</div>',
        callback: () => runForage(),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'explorar',
        helpString: '<div>Explorar los alrededores: gasta un rato del día y descubre un sitio nuevo junto a donde '
            + 'estás. Con un nombre, va a buscar lo que el narrador mencionó: <code>/explorar La cueva del norte</code>.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({ description: 'lo que se va a buscar', typeList: [ARGUMENT_TYPE.STRING], isRequired: false }),
        ],
        callback: (_args, value) => exploreHere(String(value ?? '').trim()),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'rumor',
        helpString: '<div>Escuchar lo que se cuenta donde estás. Uno cada vez, sin repetir; '
            + 'alguno lleva a sitios que no están en el mapa.</div>',
        callback: () => hearRumor(),
    }));

    // Z2 de ROADMAP_SIN_TOKENS: hablar con alguien escribiéndolo, igual que pulsando su ficha.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'hablar',
        helpString: '<div>Hablar con alguien de aquí: <code>/hablar Giles</code>. Abre la charla: qué sabe, qué busca, '
            + 'qué se cuenta, y convencer, sonsacar, amenazar o invitar a una ronda. Sin gastar tokens.</div>',
        unnamedArgumentList: [SlashCommandArgument.fromProps({ description: 'Con quién', typeList: [ARGUMENT_TYPE.STRING], isRequired: true })],
        callback: (_args, value) => {
            const who = String(value ?? '').trim();
            if (!who) return '';
            startTalk(worldNpc(who)?.name ?? who);
            return '';
        },
    }));

    // Z3: examinar algo de aquí, con su tirada y su consecuencia.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'examinar',
        helpString: '<div>Examinar algo de aquí: <code>/examinar la cerradura del baúl</code>. Tira lo que toque '
            + '(Investigación, Percepción, Supervivencia…) y sale bien, a medias o mal, con su efecto.</div>',
        unnamedArgumentList: [SlashCommandArgument.fromProps({ description: 'Qué', typeList: [ARGUMENT_TYPE.STRING], isRequired: true })],
        callback: async (_args, value) => {
            await lookAt(String(value ?? ''));
            return '';
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'tirada',
        helpString: '<div>Intentar algo fuera de combate. El motor tira el dado con la ficha del tuyo y deja '
            + 'el resultado escrito en el chat, para que el narrador lo lea: <code>/tirada persuasion</code>. '
            + 'Una por mensaje.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'la habilidad',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumList: Object.entries(SKILLS).map(([id, def]) => new SlashCommandEnumValue(id, def.label)),
            }),
        ],
        callback: (_args, value) => runSkillCheck(String(value ?? '').trim().toLowerCase()),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'maniobra',
        helpString: '<div>En vez de atacar: <code>/maniobra esquivar</code>, <code>/maniobra destrabarse</code>, '
            + '<code>/maniobra empujar Goblin</code>, <code>/maniobra ayudar Goblin</code>, <code>/maniobra esconderse</code> '
            + 'o <code>/maniobra lanzar red Goblin</code> (y <code>aceite</code>, u <code>objeto</code> para lo que haya a mano en el tablero). Gasta la accion.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'la maniobra y, si hace falta, a quien',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
            }),
        ],
        callback: (_args, value) => {
            const [kind, ...rest] = String(value ?? '').trim().split(/\s+/);
            // Idea 122: «lanzar red Goblin» o «lanzar:red Goblin».
            if (/^lanzar/i.test(String(kind))) {
                const what = String(kind).includes(':') ? String(kind).split(':')[1] : String(rest.shift() ?? '');
                // Idea 8: «lanzar objeto Goblin» coge lo que haya a mano en el tablero.
                if (what.toLowerCase() === 'objeto') return throwScenery(rest.join(' '));
                return throwItem(what.toLowerCase(), rest.join(' '));
            }
            return performManeuver(String(kind || '').toLowerCase(), rest.join(' '));
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'tregua',
        helpString: '<div>T2: contestar a quien pide tregua. <code>/tregua sí</code> les deja ir (ganáis el tablero, sin su botín); <code>/tregua no</code>, sin cuartel.</div>',
        unnamedArgumentList: [SlashCommandArgument.fromProps({ description: 'sí o no', typeList: [ARGUMENT_TYPE.STRING], isRequired: true })],
        callback: (_args, value) => answerTruce(/^(s[ií]|si|yes|vale|dejar)/i.test(String(value ?? '').trim())),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'ayuda',
        helpString: '<div>H2: cómo se juega: tu modo, el tablero, la semana, la crónica y qué hacer si te pierdes.</div>',
        callback: async () => await openHowToPlay(),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'salir',
        helpString: '<div>B2: salir de la pelea por una salida del tablero (la casilla «x»). Sin nombre, quien tiene el turno.</div>',
        unnamedArgumentList: [SlashCommandArgument.fromProps({ description: 'quién sale', typeList: [ARGUMENT_TYPE.STRING], isRequired: false })],
        callback: (_args, value) => {
            const name = String(value ?? '').trim().toLowerCase();
            const current = getCurrentTurnEntry();
            const member = name
                ? partyMembers.find(m => String(m.name).toLowerCase() === name)
                : (current && !current.isEnemy ? getPartyMemberByTurnEntry(current) : partyMembers[0]);
            return leaveThroughExit(member);
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'bajar',
        helpString: '<div>Idea 75: bajar por la escalera al nivel siguiente, si alguien está en ella.</div>',
        callback: () => {
            const below = stairsHere();
            if (!below) {
                toastr.info('Aquí no hay escalera a mano: acercaos a ella.', 'Bajar');
                return '';
            }
            postCombatNarration(`🪜 [BOARD] Bajáis por la escalera: ${below.name}.`);
            return enterBoard(String(below.name));
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'actitud',
        helpString: '<div>Idea 140: lo mismo que el narrador con <code>cambiar_actitud</code>: <code>/actitud Giles +1</code>.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({ description: 'quién y +1 o -1', typeList: [ARGUMENT_TYPE.STRING], isRequired: true }),
        ],
        callback: (_args, value) => {
            const match = /^(.+?)\s+([+-]?1)$/.exec(String(value ?? '').trim());
            return match ? changeAttitude(match[1], Number(match[2]), '') : 'Usa: /actitud Nombre +1';
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'ofrecer-objeto',
        helpString: '<div>Idea 139: lo mismo que hace el narrador con <code>dar_objeto</code>: <code>/ofrecer-objeto Manta de lana</code> '
            + 'deja el objeto para cogerlo desde la fila de fichas.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({ description: 'qué es', typeList: [ARGUMENT_TYPE.STRING], isRequired: true }),
        ],
        callback: (_args, value) => offerItem(String(value ?? ''), '', ''),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'aceptar-objeto',
        helpString: '<div>Idea 139: coger lo que ofreció el narrador. <code>/aceptar-objeto Manta de lana</code>.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({ description: 'cuál', typeList: [ARGUMENT_TYPE.STRING], isRequired: true }),
        ],
        callback: (_args, value) => acceptOffer(String(value ?? '')),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'acampar',
        helpString: '<div>Idea 67: acampar aquí, donde no hay posada: el fuego, las guardias, la charla y la cena. '
            + 'Luego se duerme como un descanso largo.</div>',
        callback: async () => campNight(),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'sonsacar',
        helpString: '<div>Idea 110: sonsacarle a alguien de aquí lo que esconde (Perspicacia, una vez al día). '
            + '<code>/sonsacar Giles</code>.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({ description: 'a quién', typeList: [ARGUMENT_TYPE.STRING], isRequired: true }),
        ],
        callback: async (_args, value) => pryNpc(String(value ?? '')),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'comprobar-mundo',
        helpString: '<div>Idea 181: si el mundo abierto llega al listón, y el encargo para el Gem con lo que falta.</div>',
        callback: async () => checkCurrentWorld(),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'postura',
        helpString: '<div>Como pelea un companero cuando se lleva solo: '
            + '<code>/postura Bruna cerca</code> (a tu lado), <code>carga</code> o <code>atras</code>. '
            + 'Sin postura, dice la que tiene.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'nombre y postura',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
            }),
        ],
        callback: (_args, value) => {
            const parts = String(value ?? '').trim().split(/\s+/);
            const last = String(parts[parts.length - 1] || '').toLowerCase();
            const hasStance = parts.length > 1 && last in STANCES;
            const name = (hasStance ? parts.slice(0, -1) : parts).join(' ').toLowerCase();
            const member = partyMembers.find(m => String(m.name).toLowerCase() === name);
            if (!member) {
                toastr.warning(`No encuentro a "${name}" en el grupo.`);
                return '';
            }
            if (!hasStance) {
                const label = STANCES[/** @type {keyof typeof STANCES} */ (stanceOf(member))].label;
                toastr.info(`${member.name}: ${label.toLowerCase()}.`);
                return label;
            }
            return setMemberStance(member, last);
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'rollguard',
        helpString: '<div>Controla la correccion de tiradas inventadas por el modelo. '
            + '<code>/rollguard</code> muestra el modo actual. '
            + '<code>/rollguard imposibles</code> corrige solo totales que los dados no pueden dar (por defecto). '
            + '<code>/rollguard estricto</code> hace que el motor tire por todas. '
            + '<code>/rollguard off</code> lo desactiva.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'off | imposibles | estricto',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                enumList: [
                    new SlashCommandEnumValue('off', 'No tocar nada'),
                    new SlashCommandEnumValue('imposibles', 'Corregir solo lo imposible'),
                    new SlashCommandEnumValue('estricto', 'El motor tira por todas'),
                ],
            }),
        ],
        callback: (_args, value) => {
            const labels = {
                off: 'desactivado',
                impossible: 'solo corrige totales imposibles',
                strict: 'el motor tira por todas las tiradas',
            };
            const raw = String(value ?? '').trim().toLowerCase();

            if (!raw) {
                const mode = getRollGuardMode();
                toastr.info(`Guardian de tiradas: ${labels[mode]}.`);
                return mode;
            }

            /** @type {Record<string, 'off'|'impossible'|'strict'>} */
            const aliases = {
                off: 'off', no: 'off', desactivado: 'off',
                imposibles: 'impossible', impossible: 'impossible', posibles: 'impossible',
                estricto: 'strict', strict: 'strict',
            };
            const mode = aliases[raw];
            if (!mode) {
                toastr.warning('Usa: off, imposibles o estricto.');
                return getRollGuardMode();
            }

            chat_metadata[ROLL_GUARD_KEY] = mode;
            saveMetadata();
            toastr.success(`Guardian de tiradas: ${labels[mode]}.`);
            return mode;
        },
    }));

    // ================================================================
    //  What every turn costs
    // ================================================================

    // Loaded lazily so the meter never delays startup for a panel most turns never open.
    eventSource.on(event_types.GENERATE_AFTER_DATA, (/** @type {any} */ data, /** @type {boolean} */ dryRun) => {
        import('../game-engine/ui/prompt-preview.js')
            .then(({ recordPrompt, meterView }) => {
                recordPrompt(data, dryRun);
                // Idea 147: lo que cuesta cada turno, a la vista mientras se juega.
                if (!dryRun) {
                    lastMeter = meterView();
                    if (isShellOpen()) refreshGameShell();
                }
            })
            .catch(error => console.error('[party] prompt meter failed', error));
    });

    // ================================================================
    //  Dice claims the model made up
    // ================================================================

    // Runs before the message is rendered, so the player only ever sees the corrected
    // text. Corrections are announced rather than applied quietly: a number that changes
    // with no explanation is indistinguishable from a bug.
    // Lo que el mundo sabe del grupo, al dia justo antes de montar el prompt.
    eventSource.on(event_types.GENERATION_STARTED, () => {
        try {
            refreshWorldMemoryPrompt();
        } catch (error) {
            console.error('[party] world memory prompt failed', error);
        }
    });

    // G6: el narrador puede proponer un sitio. No lo crea: queda como opcion para quien juega.
    ToolManager.registerFunctionTool({
        name: 'proponer_sitio',
        displayName: 'Proponer un sitio',
        description: 'Úsala cuando la narración mencione un sitio concreto al que el grupo podría ir y que no está en el mapa '
            + '(una cueva, una granja, un paso). No lo crea: lo propone, y el jugador decide si va a buscarlo.',
        parameters: {
            type: 'object',
            properties: {
                nombre: { type: 'string', description: 'Nombre corto del sitio, como lo diría la gente.' },
                descripcion: { type: 'string', description: 'Una frase: lo que se sabe de él.' },
            },
            required: ['nombre'],
        },
        action: async (/** @type {{nombre: string, descripcion?: string}} */ params) => {
            const known = getCurrentWorldLocationMaps().map((/** @type {any} */ l) => String(l?.name || ''));
            const result = addProposal(chat_metadata?.[PROPOSALS_KEY], {
                name: params?.nombre, note: params?.descripcion, near: currentLocationName,
            }, known);
            if (!result.added) return `No se apunta: ${result.reason}`;
            chat_metadata[PROPOSALS_KEY] = result.proposals;
            saveMetadata();
            if (isShellOpen()) refreshGameShell();
            return 'Propuesto. El jugador lo verá como opción; no lo narres como un sitio ya visitado.';
        },
        shouldRegister: () => Boolean(chat_metadata?.[METADATA_KEY]),
        stealth: true,
    });

    // Idea 139: el narrador ofrece un objeto; quien juega decide si lo coge, y lo que entra lo
    // decide el motor.
    ToolManager.registerFunctionTool({
        name: 'dar_objeto',
        displayName: 'Ofrecer un objeto',
        description: 'Úsala cuando la narración ponga un objeto concreto al alcance del grupo (lo que deja un caído, un regalo, algo sobre una mesa). '
            + 'No lo da: lo ofrece, y el jugador decide si lo coge. Lo que es de verdad lo decide el juego.',
        parameters: {
            type: 'object',
            properties: {
                nombre: { type: 'string', description: 'Qué es, en pocas palabras: «Manta de lana», «Daga oxidada».' },
                descripcion: { type: 'string', description: 'Una frase: de dónde sale o cómo es.' },
                para: { type: 'string', description: 'Quién del grupo lo recibe, si es para alguien concreto.' },
            },
            required: ['nombre'],
        },
        action: async (/** @type {{nombre: string, descripcion?: string, para?: string}} */ params) => offerItem(params?.nombre, params?.descripcion, params?.para),
        shouldRegister: () => Boolean(chat_metadata?.[METADATA_KEY]),
        stealth: true,
    });

    // Idea 140: el narrador propone que alguien mire mejor o peor al grupo; el motor limita.
    ToolManager.registerFunctionTool({
        name: 'cambiar_actitud',
        displayName: 'Cambiar la actitud de alguien',
        description: 'Úsala cuando en la conversación alguien del mundo cambie de verdad cómo ve al grupo (se gana su confianza, se le ofende). '
            + 'Un paso cada vez (+1 o −1), una vez al día por persona. Pesa en las tiradas de trato con esa persona.',
        parameters: {
            type: 'object',
            properties: {
                persona: { type: 'string', description: 'Su nombre, como en el mundo.' },
                cambio: { type: 'number', description: '+1 si mejora, −1 si empeora.' },
                motivo: { type: 'string', description: 'Por qué, en pocas palabras.' },
            },
            required: ['persona', 'cambio'],
        },
        action: async (/** @type {{persona: string, cambio: number, motivo?: string}} */ params) => changeAttitude(String(params?.persona ?? ''), Number(params?.cambio) || 0, String(params?.motivo ?? '')),
        shouldRegister: () => Boolean(chat_metadata?.[METADATA_KEY]),
        stealth: true,
    });

    // Idea 138: el narrador pide una tirada; la tira quien juega, con el dado del motor.
    ToolManager.registerFunctionTool({
        name: 'pedir_tirada',
        displayName: 'Pedir una tirada',
        description: 'Úsala cuando la escena pida una prueba del jugador (convencer, escalar, mentir, fijarse) y el resultado no sea obvio. '
            + 'No tires tú ni narres el resultado: aparece un botón para que el jugador tire, y el resultado te llega en su mensaje.',
        parameters: {
            type: 'object',
            properties: {
                habilidad: { type: 'string', description: `Una de: ${Object.values(SKILLS).map(s => s.label).join(', ')}.` },
                motivo: { type: 'string', description: 'Qué se intenta, en pocas palabras. Ejemplo: convencer al guardia.' },
                dificultad: { type: 'number', description: 'CD de 5 (fácil) a 25 (casi imposible). Normal: 12.' },
            },
            required: ['habilidad'],
        },
        action: async (/** @type {{habilidad: string, motivo?: string, dificultad?: number}} */ params) => {
            if (combatEncounter.active) return 'En combate no: las tiradas las lleva la barra de combate.';
            const result = addRequest(chat_metadata?.[CHECK_REQUESTS_KEY], {
                skill: params?.habilidad, reason: params?.motivo, dc: params?.dificultad,
            }, SKILLS);
            if (!result.added) return `No se pide: ${result.reason}`;
            chat_metadata[CHECK_REQUESTS_KEY] = result.requests;
            saveMetadata();
            if (isShellOpen()) refreshGameShell();
            return 'Pedida. Termina tu respuesta dejando la situación abierta; no narres si sale o no.';
        },
        shouldRegister: () => Boolean(chat_metadata?.[METADATA_KEY]),
        stealth: true,
    });

    // U1 del pegamento: en vez de poner banderas por su cuenta, el narrador propone un hecho
    // para que el mundo lo recuerde, y el motor decide.
    ToolManager.registerFunctionTool({
        name: 'proponer_hecho',
        displayName: 'Proponer un hecho',
        description: 'Úsala solo cuando pase algo que el mundo debería recordar más adelante y que el juego no ha visto: una promesa, una revelación, una ofensa. '
            + 'Una frase. El juego decide si lo apunta (uno al día como mucho). No sirve para dar objetos, oro ni heridas, ni para cambiar actitudes: para eso hay otras.',
        parameters: {
            type: 'object',
            properties: {
                hecho: { type: 'string', description: 'Lo que pasó, en una frase. Ejemplo: El molinero juró venganza contra Vane.' },
            },
            required: ['hecho'],
        },
        action: async (/** @type {{hecho: string}} */ params) => proposeFact(String(params?.hecho ?? '')),
        shouldRegister: () => Boolean(chat_metadata?.[METADATA_KEY]),
        stealth: true,
    });

    // U4 del pegamento (DU3): el chat se pliega solo, mire quien mire lo que lo cambie.
    const chatRoot = document.getElementById('chat');
    if (chatRoot) {
        new MutationObserver(mutations => {
            // Lo que cambia el propio plegado no vuelve a plegar.
            if (mutations.every(m => [...m.addedNodes, ...m.removedNodes].every(n => n instanceof Element && n.classList.contains('gm-fold')))) return;
            scheduleFoldChat();
        }).observe(chatRoot, { childList: true });
    }
    eventSource.on(event_types.CHAT_CHANGED, () => {
        unfoldedMessages.clear();
        scheduleFoldChat();
    });

    // U0 del pegamento: lo que se escribe al narrador y lo que se pulsa, mientras se juega.
    eventSource.on(event_types.MESSAGE_SENT, () => {
        if (isShellOpen()) keepSessionLog(noteSent(currentSessionLog()));
    });
    document.addEventListener('click', (event) => {
        if (!isShellOpen() || !(event.target instanceof Element)) return;
        const button = event.target.closest('button, .menu_button');
        // Los botones de la pausa y los de cerrar un cuadro no son jugar.
        if (!button || button.closest('.gs-pause, .popup-controls')) return;
        if (!button.closest('#game-shell, .popup')) return;
        keepSessionLog(noteClick(currentSessionLog()));
    }, true);

    // El hilo: a quien nombras al hablar, estando donde estas.
    eventSource.on(event_types.MESSAGE_SENT, (/** @type {number} */ messageId) => {
        const said = String(chat?.[messageId]?.mes || '');
        if (said) notePlot({ kind: 'say', text: said, place: currentLocationName });
    });

    // Idea 108: al abrir una campana ya jugada, lo que hace falta para retomar.
    eventSource.on(event_types.CHAT_CHANGED, () => {
        setTimeout(() => {
            const played = (chat || []).filter(m => m && !m.is_system).length;
            if (played > 3 && chat_metadata?.[METADATA_KEY]) showRecap();
        }, 2500);
    });

    // Una campana de antes del hilo lo recibe en silencio la primera vez que se juega.
    eventSource.on(event_types.CHAT_CHANGED, () => {
        setTimeout(() => {
            // Una campana sin nada jugado es una que se esta creando: su mecha la cuenta
            // `beginCampaignPlot`. Poner el hilo en silencio aqui se la comeria.
            const played = (chat || []).filter(m => m && !m.is_system).length;
            if (played > 1) void ensurePlot({ announce: false });
        }, 1500);
    });

    // Z3 de ROADMAP_SIN_TOKENS: sin modelo, SillyTavern no envía nada (no hay con quién
    // hablar) y lo escrito se quedaba en la caja. Aquí se lee antes, y se hace lo que dice.
    // Y a quién va lo que no hace el motor: `routeTyped`.
    const takeBox = (/** @type {Event} */ event) => {
        const input = /** @type {HTMLTextAreaElement|null} */ (document.querySelector('#send_textarea'));
        const said = String(input?.value ?? '').trim();
        if (!said || said.startsWith('/') || routeTyped(said) !== 'engine') return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (input) {
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        void readTheBox(said);
    };
    document.addEventListener('keydown', (event) => {
        if (!(event.target instanceof HTMLElement) || event.target.id !== 'send_textarea') return;
        if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.altKey || event.isComposing || !shouldSendOnEnter()) return;
        if (Popup.util.isPopupOpen()) return;
        takeBox(event);
    }, true);
    document.addEventListener('click', (event) => {
        if (event.target instanceof Element && event.target.closest('#send_but')) takeBox(event);
    }, true);

    // Idea 137: mientras se escribe, si lo escrito pide una tirada, se ofrece.
    /** @type {ReturnType<typeof setTimeout>|null} */
    let typingTimer = null;
    $(document).on('input', '#send_textarea', () => {
        if (typingTimer) clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
            const said = String(/** @type {HTMLTextAreaElement|null} */ (document.querySelector('#send_textarea'))?.value ?? '');
            const next = /^\[TIRADA/.test(said.trim()) ? [] : intentSkills(said);
            if (next.join() === typedIntents.join()) return;
            setTypedIntents(next);
            if (isShellOpen()) refreshGameShell();
        }, 400);
    });
    eventSource.on(event_types.MESSAGE_SENT, () => {
        if (typedIntents.length === 0) return;
        setTypedIntents([]);
        if (isShellOpen()) refreshGameShell();
    });

    // Enviado el mensaje con la tirada, se puede volver a intentar algo.
    eventSource.on(event_types.MESSAGE_SENT, () => {
        if (chat_metadata?.[PENDING_CHECK_KEY]) {
            delete chat_metadata[PENDING_CHECK_KEY];
            saveMetadata();
            if (isShellOpen()) refreshGameShell();
        }
    });

    // Con modelo, a quien se le habla contesta él: la respuesta sale a su nombre, no al del
    // narrador. Y así también la lee el modelo en lo que viene después.
    eventSource.on(event_types.MESSAGE_RECEIVED, (/** @type {number} */ messageId) => {
        const message = chat?.[messageId];
        // Lo que se le preguntó al narrador lo contesta él, con su nombre.
        if (narratorTurn && message && !message.is_user && !message.is_system) {
            setNarratorTurn(false);
            return;
        }
        const with_ = speakingWith();
        if (!with_ || !message || message.is_user || message.is_system || message.extra?.model === 'game-engine') return;
        message.name = with_.name;
        // Habla una persona: sin el párrafo de narración que el modelo pone delante a veces.
        const spoken = keepSpeech(String(message.mes ?? ''));
        if (spoken !== message.mes) {
            message.mes = spoken;
            try {
                updateMessageBlock(Number(messageId), message);
            } catch (error) {
                console.error('[party] no se pudo recortar la respuesta', error);
            }
        }
        const shown = document.querySelector(`#chat .mes[mesid="${messageId}"] .name_text`);
        if (shown) shown.textContent = with_.name;
    });

    eventSource.on(event_types.MESSAGE_RECEIVED, (/** @type {number} */ messageId) => {
        try {
            applyRollGuard(messageId);
        } catch (error) {
            // A guard that breaks the chat is worse than a wrong die.
            console.error('[party] roll guard failed', error);
        }

        try {
            recordContradictions(messageId);
        } catch (error) {
            console.error('[party] contradiction log failed', error);
        }
    });

    // El retrato de la escena de dialogo es quien acaba de hablar, asi que tiene que
    // enterarse de que alguien ha hablado. El tablero se redibuja por su cuenta; un
    // mensaje nuevo no lo redibuja, y sin esto el epilogo de un combate dejaria en
    // pantalla la cara del turno anterior.
    for (const rendered of [event_types.CHARACTER_MESSAGE_RENDERED, event_types.USER_MESSAGE_RENDERED]) {
        eventSource.on(rendered, () => {
            if (isShellOpen()) refreshGameShell();
        });
    }

    // Idea 145: la cara de quien habla, en cada mensaje del narrador que se pinta.
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (/** @type {number} */ messageId) => decorateSpeakers(Number(messageId)));
    for (const redrawn of [event_types.MESSAGE_SWIPED, event_types.MESSAGE_UPDATED, event_types.MESSAGE_EDITED]) {
        eventSource.on(redrawn, (/** @type {number} */ messageId) => setTimeout(() => decorateSpeakers(Number(messageId)), 50));
    }
    eventSource.on(event_types.CHAT_CHANGED, () => {
        setTimeout(() => {
            for (const node of document.querySelectorAll('#chat .mes')) decorateSpeakers(Number(node.getAttribute('mesid')));
        }, 1200);
    });

    // ================================================================
    //  Auto-detect location / board names in user messages
    // ================================================================

    eventSource.on(event_types.USER_MESSAGE_RENDERED, async (/** @type {number} */ messageId) => {
        const message = chat[messageId];
        if (!message || !message.mes || readingBox) return;
        const text = message.mes.toLowerCase();

        // ── Natural-language combat commands (only while combat is active) ──
        if (combatEncounter.active) {
            const currentEntry = getCurrentTurnEntry();
            if (currentEntry && !currentEntry.isEnemy) {
                // Attack: "ataco a X", "ataco al X", "attack X", "i attack X"
                const attackMatch = text.match(/(?:ataco\s+(?:a\s+(?:la?\s+)?)?|attack\s+(?:the\s+)?|i\s+attack\s+(?:the\s+)?)(.+)/i);
                if (attackMatch) {
                    const targetName = attackMatch[1].trim().replace(/[.!?]$/, '');
                    handlePlayerCombatAttack(targetName);
                    return;
                }

                // Move: "me muevo a X Y", "me desplazo a X,Y", "move to X Y", "i move to X,Y"
                const moveMatch = text.match(/(?:me\s+(?:muevo|desplazo)(?:\s+(?:a|hacia))?\s+|(?:i\s+)?move\s+(?:to\s+)?)(\d+)[,\s]+(\d+)/i);
                if (moveMatch) {
                    handlePlayerCombatMove(`${moveMatch[1]} ${moveMatch[2]}`);
                    return;
                }

                // End turn: "paso turno", "termino turno", "fin de turno", "paso mi turno", "end turn", "pass turn", "skip turn"
                const endTurnMatch = text.match(/\b(?:paso\s+(?:mi\s+)?turno|termino\s+(?:mi\s+)?turno|fin\s+(?:de\s+)?turno|end\s+turn|pass\s+turn|skip\s+turn)\b/i);
                if (endTurnMatch) {
                    endPlayerCombatTurn();
                    return;
                }
            }
        }

        if (getCurrentWorldLocationMaps().length === 0) return;

        // Z3: con modelo, «entramos en el callejón» entra y «vamos a Castillo de Vane» viaja,
        // con sus días y solo a un vecino, antes de que conteste: así lo cuenta él. Nombrar
        // un sitio de pasada ya no teletransporta a nadie.
        const intent = readBox(message.mes, boxContext());
        if (intent.do === 'talk' && intent.name && worldNpc(String(intent.name))) {
            setTalkingTo(String(worldNpc(String(intent.name))?.name));
            notePlot({ kind: 'talk', npc: talkingTo, place: currentLocationName });
        } else if (intent.do === 'enter' && intent.name) {
            setCurrentBoardName(String(intent.name));
            saveCurrentBoard();
            placePartyAtStart(getLocationBoards(hereLocation()).find((/** @type {any} */ b) => b.name === currentBoardName));
            setPartyTab('location');
            toastr.info(`🎲 Entras en ${intent.name}`);
            tellBoard(String(intent.name));
        } else if (intent.do === 'go' && intent.name) {
            const { to, reason } = await travelWithTime(String(intent.name));
            if (to) setPartyTab('location');
            else if (reason) toastr.info(reason, 'No se puede viajar');
        }
    });
}
