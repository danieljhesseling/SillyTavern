import { power_user } from '../power-user.js';
import { POPUP_TYPE, POPUP_RESULT, Popup } from '../popup.js';
import { sendSystemMessage, system_message_types } from '../system-messages.js';
import {
    getThumbnailUrl, chat, chat_metadata, saveMetadata, eventSource, event_types, setUserName, addOneMessage,
    saveChatConditional, substituteParams, system_avatar, generateRaw, online_status, setExtensionPrompt,
    extension_prompt_types, extension_prompt_roles, characters as stCharacters, this_chid, sendMessageAsUser,
    updateMessageBlock, name2,
} from '../../script.js';
import { extension_settings } from '../extensions.js';
import { getMessageTimeStamp, shouldSendOnEnter } from '../RossAscends-mods.js';
import { getCurrentWorldMapUrl, getCurrentWorldLocationMaps, getCurrentWorldBoards, getCurrentWorldEnemies, getCurrentWorldNPCs, loadWorldInfo, saveWorldInfo, createWorldInfoEntry, refreshWorldMapGlobals, METADATA_KEY } from '../world-info.js';
import { renderWorldMapView, renderLocationView } from '../world-map-renderer.js';
import { SlashCommandParser } from '../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument } from '../slash-commands/SlashCommandArgument.js';
import { SlashCommandEnumValue } from '../slash-commands/SlashCommandEnumValue.js';
import {
    getAbilityModifier, getDefaultDndData, addItemToInventory, removeItemFromInventory, consumeItemInInventory,
    migratePartyMember, createItem, normalizeDndEntityType,
} from '../dnd-system.js';
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
import { causesOf } from '../game-engine/compendio/ailments.js';
import { racesOf, kindsOf, describeKin, validateKin } from '../game-engine/compendio/kin.js';
import { createCompendium, onlyPicked } from '../game-engine/compendio/compendio.js';
import { mergeWorldRows } from '../game-engine/campaign/world-rows.js';
import {
    readFactions, tickFactions, outcomeOf, applyOutcome, newsFor, describeFaction, priceFactor, rollFactions,
    validateFactionRows, pushFaction, speaksPlural, namesOf, changeStanding, describeStanding, standingWith,
    saysWith,
} from '../game-engine/campaign/factions.js';
import { marketPressure, applyMarket, describeMarket, warPressure } from '../game-engine/campaign/economy.js';
import {
    abilitiesFor, classesOf, nameAndAbility, validateAbilities, asAbility,
} from '../game-engine/compendio/skills.js';
import {
    rollDice, rollDiceDetailed, getDistanceInFeet, getAttackRangeFeet, describeCover, getPlayerDamageFormula,
    getPlayerAttackModifier, setRandomSource, nextRandom,
} from './combat-rules.js';
import { weaponOf as heldWeapon, weaponBonus } from '../game-engine/rules/equipment.js';
import { resolveEntryMapPosition } from './positions.js';
import { createCampaignState } from './campaign-state.js';
import {
    normalizeTerrain, setCell as setTerrainCell, getTerrainOptions, getCoverBonus, setDoorOpen, parseCellKey,
    cellKey, isPassable, getCell, isLocked, unlockDoor, lockedDoors, breakDoor,
} from '../game-engine/board/terrain.js';
// R3 del roadmap de profundidad: áreas, elementos, usos fuera del combate y jugadas en pareja.
import { isArea } from '../game-engine/rules/area.js';
import { travelShortcut, lockBonus, watchBonus, duelTricks, whoCan } from '../game-engine/rules/field-uses.js';
// R5 del roadmap de profundidad: la mascota.
import { supportActions, petDoes, petName } from '../game-engine/campaign/pet.js';
// R8 y R9 del roadmap de profundidad: compañeros con arco, y el mundo que responde.
import {
    homeFavors, favorDiscount, noteGone, whoComesBack, comebackOf, forgetGone,
} from '../game-engine/campaign/companion-arcs.js';
import { rumorsFromPlay, chronicleMemory, reactionTo } from '../game-engine/campaign/world-echoes.js';
// R7 del roadmap de profundidad: enemigos con cabeza, y la némesis.
// H2 de wiki/LO_QUE_FALTA.md: «Cómo se juega», con lo que el motor sabe.
import { buildHowToPlay } from '../game-engine/campaign/how-to-play.js';
import { getMapLegend } from '../game-engine/campaign/campaign-pack-schema.js';
// B1 y B2 de wiki/LO_QUE_FALTA.md: la altura y las salidas del tablero.
import { isHigh } from '../game-engine/board/heights.js';
import { hasLeft } from '../game-engine/board/exits.js';
// T1, T2 y B3 de wiki/LO_QUE_FALTA.md: la palanca, la barricada, la tregua y los refuerzos.
import { hitBarricade, pullLever } from '../game-engine/board/interactables.js';
// T4: la estación y la magia, en los precios.
import { seasonalMarket, magicStance } from '../game-engine/campaign/season-market.js';
// T3: la gente del mundo ve a la mascota.
// R6: los jefes con fases.
// R6 del roadmap de profundidad: tableros con intención.
import { levelPlanOf } from '../game-engine/combat/level-adjust.js';
// R4: pergaminos y varitas.
import { judgeMagicItems } from '../game-engine/rules/magic-items.js';
// R4 del roadmap de profundidad: la magia, solo la del grimorio.
import {
    grimoireAbilities, spellById, spellsForClass, spendCharge, magicLine, knownSpells,
} from '../game-engine/rules/grimoire.js';
import { pairOptions, pairLine } from '../game-engine/rules/pair-moves.js';
import { getReachableCells, findPath, getPathCost } from '../game-engine/board/pathfinding.js';
import { getCoverAlongLine } from '../game-engine/board/line-of-sight.js';
import { createEmptyFog, normalizeFog, updateFog } from '../game-engine/board/fog-of-war.js';
import { stanceOf, STANCES, PREFERENCES, DEFAULT_PREFERENCE } from '../game-engine/combat/ally-ai.js';
import {
    MANEUVERS, judgeManeuvers, recordManeuver, attackEdge, consumeHelp, rollWithEdge, describeEdge, resolveShove,
    readManeuvers, noteKnockdown, takeCombo, COMBO_DICE, canHide, hideDC, revealHidden,
} from '../game-engine/combat/maneuvers.js';
import { THROWABLES, judgeThrows, throwablesOf, burningPuddle } from '../game-engine/combat/throwables.js';
import { readyAttack } from '../game-engine/combat/readied.js';
import { canReact, markReacted, bossLine } from '../game-engine/combat/boss-reaction.js';
import { perkBonus } from '../game-engine/rules/level-perks.js';
import { hasMaster, lessonsHere } from '../game-engine/campaign/masters.js';
import { startGame, drawDie, stand, cheat, payout, describeGame, roundsLeft, BETS } from '../game-engine/campaign/tavern-dice.js';
import { MOUNTS, addMount, mountedDays, feedPerWeek, describeMounts } from '../game-engine/world/mounts.js';
import { assignRoles, rollRoles, describeRoles } from '../game-engine/world/travel-roles.js';
import { isIndoors, carriesLight, combatVisibility, visibilityPenalties, sightFeetFor } from '../game-engine/world/visibility.js';
import { companionEpilogues } from '../game-engine/campaign/epilogues.js';
import { endingEpilogues, partyAtStart, readPartyStart, takeHome } from '../game-engine/campaign/campaign-end.js';
import { canPry, notePry, secretNote, describeSecrets, readSecrets, SECRET_DC, SECRET_SKILL } from '../game-engine/campaign/npc-secrets.js';
import { repliesFor } from '../game-engine/ui/shell/replies.js';
import { checkWorldDensity, gemRequest } from '../game-engine/campaign/world-density.js';
import { SCENERY, sceneryNear, judgeSceneryThrow } from '../game-engine/combat/throwables.js';
import { playCue } from '../game-engine/ui/shell/action-sounds.js';
import { loadAudioSettings } from '../game-engine/ui/shell/scene-audio.js';
import { trophiesOf, trophyItem, canCraft, cloakItem, upgradedWeapon, RECIPES } from '../game-engine/campaign/trophies.js';
import { seasonOf, seasonClimates, describeSeason, openInSeason, readSeason } from '../game-engine/world/seasons.js';
import { canCamp, nightRisk, defaultGuards, resolveNight, campMorning, MAX_GUARDS } from '../game-engine/campaign/camp.js';
import { approvalFor, approvalFromOpinions, noteApproval, frictionsOn, describeApproval, approvalOf, DECISIONS } from '../game-engine/campaign/approval.js';
import { duePersonalQuests, personalQuestFor, describePersonalAsk } from '../game-engine/campaign/personal-quests.js';
import { readBench, whereHired } from '../game-engine/campaign/bench.js';
import { respecCost } from '../game-engine/rules/respec.js';
import { languageBarrier } from '../game-engine/rules/languages.js';
import { neighboursOf, fateAt, driftOf, describeFate } from '../game-engine/world/people-fate.js';
import { addOffer, takeOffer, resolveOffer, offerChips } from '../game-engine/campaign/item-offers.js';
import { toneNote, nextTone, describeTone, readTone } from '../game-engine/campaign/scene-tone.js';
import { makeShareCode } from '../game-engine/campaign/share-code.js';
import { judgeDepartures, describeWarning, describeLeaving } from '../game-engine/campaign/departures.js';
import { talkPairs, campTalkPrompt, makePeace, roundPrompt, topicHits, TOPICS } from '../game-engine/campaign/camp-talk.js';
import { stealDC, stealOutcome, guardsAt, settleGuards, coolDown, readWanted } from '../game-engine/campaign/crime.js';
import { hirelingsHere } from '../game-engine/campaign/guests.js';
import {
    readHub, isHubWorld, hubHomeOf, settleCarried, hubRoster, HUB_CAMPAIGN_KEY,
} from '../game-engine/campaign/hub.js';
import { HUB_HEROES_KEY, restingUids } from '../game-engine/campaign/hub-heroes.js';
import { readVillain, villainScenesDue, villainNote } from '../game-engine/campaign/villain.js';
import { seaLegs, fareFor, sailingDays, describeVoyage } from '../game-engine/world/ships.js';
import { shiftAttitude, attitudeBonus, describeAttitude, readAttitudes } from '../game-engine/campaign/attitudes.js';
import { summarizeAct, hideRange, addSummary, readSummaries } from '../game-engine/campaign/act-summary.js';
import { previewOf, describePreview } from '../game-engine/campaign/world-preview.js';
import { readIllustrationSettings, promptFor, buildRequest, imageFrom } from '../game-engine/campaign/illustrations.js';
import { notForHero } from '../game-engine/campaign/hero-fit.js';
import { newPerson, newPlace } from '../game-engine/campaign/director.js';
import { stairsReached, nextLevel } from '../game-engine/board/dungeon-levels.js';
import { SOCIAL_SKILLS } from '../game-engine/rules/languages.js';
import { speakerOf, initialsOf, hueOf } from '../game-engine/ui/shell/speakers.js';
import { describeForecast } from '../game-engine/combat/forecast.js';
import { noteDealt } from '../game-engine/combat/tally.js';
import { planWalk, canWalk } from '../game-engine/board/walk.js';
import { enterCell, describeHazard, passiveSpot, hazardsAt, visibleHazards } from '../game-engine/board/hazards.js';
import {
    buildTracker, describeTurn, statusMarkers, sizeToCells, toggleCondition,
} from '../game-engine/combat/initiative-tracker.js';
import { spendMovement, hasAction, useAction } from '../game-engine/combat/turn-machine.js';
import { rollEncounterLoot, lootRulesWithWorldItems, DEFAULT_LOOT_RULES } from '../game-engine/combat/loot.js';
import { holdDuringCombat } from '../game-engine/combat/combat-hold.js';
import {
    healInjuries, describeInjuries, readInjuries, setInjury, treatmentCost,
} from '../game-engine/rules/injuries.js';
import {
    tickNeeds, exhaustionInjury, describeNeeds, LETHAL_EXHAUSTION,
} from '../game-engine/rules/needs.js';
import { describeSurvival, readSurvival } from '../game-engine/rules/mortality.js';
import {
    stagesFor, keepOn, hasLetter, describeMode as describeGameMode, recordModeChange, modeOf, MODES as GAME_MODES,
} from '../game-engine/rules/modes.js';
import { weeklyBill, settleWeek, describeBill } from '../game-engine/rules/upkeep.js';
import { readRemedies, remediesFor, applyRemedy, shouldOfferRetirement } from '../game-engine/rules/remedies.js';
import {
    readDebt, offerPatronage, debtDue, describeDebt, borrow, repay, LOAN,
} from '../game-engine/campaign/patronage.js';
import { rollLine, damageLine } from '../game-engine/rules/roll-line.js';
import {
    gravesAt, readGraves, readHall, describeHallEntry, describeHallCount,
} from '../game-engine/campaign/legacy.js';
import { addFame, fameAt, fameNote, describeFame } from '../game-engine/campaign/fame.js';
import { lootable, relicsFor, describeRelic } from '../game-engine/campaign/relics.js';
import { dressLoot, templeWork, identify, liftCurse, TEMPLE_PRICES } from '../game-engine/campaign/item-lore.js';
import { SKILLS, checkOptions, rollCheck, skillModifier, DEFAULT_DC } from '../game-engine/rules/checks.js';
import {
    PACES, readPace, paceDays, paceEvents, isSetback, setbackChoice, resolveSetback, FORCE_DC, FORCE_HURT, RUSH_REST_HOURS,
} from '../game-engine/world/travel-choices.js';
import { shiftFortune, fortuneLine } from '../game-engine/world/fortune.js';
import { queueNews, deliverNews, clockWarnings } from '../game-engine/world/news.js';
import { dueHints, buildJournal, buildHelp, pendingByPlace, buildRecap } from '../game-engine/campaign/guidance.js';
import { splitModelNote } from '../game-engine/campaign/model-note.js';
import { narrate as narrateMoment, rememberUsed, listNames, daysText } from '../game-engine/campaign/engine-narrator.js';
import { resolveGender, resolveGenderDeep } from '../game-engine/campaign/grammar.js';
import { talkTopics, topicAnswer, threatAnswer, talkNote, talkPromptNote, sceneAddressee, narratorAskNote, effectiveAttitude, confronts, keepSpeech } from '../game-engine/campaign/talk.js';
import { addNotice, unseenCount, glanceRow, MAX_VISIBLE_TOASTS } from '../game-engine/ui/shell/notices.js';
import { addRequest, takeRequest, readRequests } from '../game-engine/campaign/check-requests.js';
import { recordDeed, proposeDeed, worldMemoryBlock, roadTrouble } from '../game-engine/campaign/world-memory.js';
import { readSession, enterScene, noteSent, noteClick, describeSession } from '../game-engine/campaign/session-log.js';
import { DAY_STAGES, WEEK_STAGES, runStages, weeksDue } from '../game-engine/campaign/time-stages.js';
import { upcoming, describeUpcoming, whenText } from '../game-engine/campaign/upcoming.js';
import { affairsOf, standingsOf, weekSummary } from '../game-engine/campaign/week-table.js';
import { handFrom, duelOutcome } from '../game-engine/campaign/word-duel.js';
import { canDispatch } from '../game-engine/campaign/dispatch.js';
import { readCases, cluesHere } from '../game-engine/campaign/cases.js';
import { mapRows, describeRoute, setNote, markVisited } from '../game-engine/campaign/text-map.js';
import { readTaggedLine, chronicleOf, chronicleSections, foldPlan, describeFold } from '../game-engine/campaign/chronicle.js';
import {
    readPlot, startPlot, plotEvent, focusOf, describeFocus, plotFromFaction, chooseEnding, actOf, hasEnded,
    visibleOpen, secretsOf, omensOf, daysLeftOf, cluesOf, closedOf, readPlotState,
} from '../game-engine/campaign/plot.js';
import { readWrittenContracts, settlesNoFight } from '../game-engine/campaign/written-contracts.js';
import { readRumors, nextRumor, describeRumor } from '../game-engine/campaign/rumors.js';
import { chooseSource } from '../game-engine/campaign/mix.js';
import {
    canExplore, discoverPlace, boardForPlace, peopleWanted, readProposals, addProposal, takeProposal,
} from '../game-engine/world/growth.js';
import { ToolManager } from '../tool-calling.js';
import { servicesOf, serviceActions, SERVICE_INFO } from '../game-engine/campaign/services.js';
import { chooseBark, opinionOf, wantsOf } from '../game-engine/combat/barks.js';
import { critEffect, roleOf } from '../game-engine/combat/crits.js';
import { groupMorale, campJobOf, withJob, mourningFor } from '../game-engine/campaign/company.js';
import { prisonerChips, dealWith, BOUNTY } from '../game-engine/campaign/prisoners.js';
import { findShortcut, applyShortcut, roadEncounter, roadStop } from '../game-engine/world/road.js';
import { addRoll, diceStats, readRolls } from '../game-engine/campaign/dice-log.js';
import { basePrice, weeklyStock, priceToday, sellPrice, canSell, junkOf } from '../game-engine/campaign/shop.js';
import { festivalsOf, festivalToday, daysUntil } from '../game-engine/world/festivals.js';
import { readLetters, newLetters } from '../game-engine/campaign/letters.js';
import { bump, describeStats } from '../game-engine/campaign/stats.js';
import { intentSkills } from '../game-engine/campaign/intents.js';
import { readBox, boxExamples, explainMiss } from '../game-engine/campaign/read-box.js';
import { outcomeOf as checkOutcome, consequence } from '../game-engine/campaign/consequences.js';
import {
    sucesoCount, pickSucesos, sucesoById, optionView, resolveOption, readSucesoState, noteSuceso, dueFollowUp, describeEffect,
} from '../game-engine/campaign/sucesos.js';
import { planTip, nextQueuedTip, GLOSSARY, MOMENT_TIPS } from '../game-engine/ui/shell/tips.js';
import { LENGTHS, lengthNote, nextLength } from '../game-engine/campaign/narration.js';
import { noteFeat, newNickname, traitBonus, traitsOf, addScar, desireLine, heroStory, TRAIT_AT, knackBonus, knacksOf, KNACK_AT } from '../game-engine/campaign/feats.js';
import { forageCheck, forageResult } from '../game-engine/campaign/forage.js';
import { readRecruits, recruitActions, bondSceneFor, describeMeeting, describeJoin, arrivalLines } from '../game-engine/campaign/recruit.js';
import { addMemory, memoryLines, lastMemoryWith } from '../game-engine/campaign/memories.js';
import { bodyLine } from '../game-engine/campaign/body.js';
import { relieve, readNeeds } from '../game-engine/rules/needs.js';
import { promptKey } from '../game-engine/cost/prompt-order.js';
import { upkeepWithBuildings, settleLoyalty, STAFF_ROLES, trainingFor } from '../game-engine/campaign/guild.js';
import { generateBoard } from '../game-engine/world-builder/dungeon-generator.js';
import { describeMode, readReasons } from '../game-engine/rules/companions.js';
import { describeLootItem, declaredLootNames } from '../game-engine/combat/loot-items.js';
import { buildTargetCard, describeTargetCard } from '../game-engine/combat/target-card.js';
import { deriveRooms, openDoor, awakePlacements, normalizeRooms } from '../game-engine/campaign/campaign-map.js';
import { planFollowUp, planBatonPass, planUltimate } from '../game-engine/combat/bond-perks.js';
import { treasureInChest } from '../game-engine/campaign/scenarios.js';
import {
    formatCalendar,
} from '../game-engine/campaign/calendar.js';
import { getBondProgress, spendPerk, BOND_EVENTS } from '../game-engine/campaign/bonds.js';
import { renderCampaignPanel } from '../game-engine/ui/campaign-panel.js';
import {
    createCombatLogPanel, setRound, lineToEntry, renderLogFilters, logFilterOf,
} from '../game-engine/ui/combat-log.js';
import { buildGameMessage, CHANNEL } from '../game-engine/ui/chat-channel.js';
import { guardRolls, guardImpossibleRolls, describeCorrections } from '../game-engine/combat/roll-guard.js';
import {
    findContradictions, appendContradictions, summariseContradictions,
} from '../game-engine/ui/contradiction-log.js';
import {
    planRulesetChange, readRememberedRuleset, rememberRuleset, setActiveRuleset, needsReload,
    getActiveRuleset,
} from '../game-engine/rules/ruleset.js';
import { knownAbilities, usesLeft, canUseAbility, describeAbility } from '../game-engine/rules/abilities.js';
import { clearTimersFor } from '../game-engine/combat/condition-timers.js';
import { findOpportunityAttacks } from '../game-engine/combat/opportunity.js';
import { normalizeCheckpoints, describeCheckpoint, CHECKPOINT_KEY } from '../game-engine/campaign/checkpoint.js';
import {
    isShellOpen, toggleGameShell, refreshGameShell, closeGameShell,
} from '../game-engine/ui/shell/game-shell.js';
import { buildDialogueView } from '../game-engine/ui/shell/dialogue-scene.js';
import { buildExplorationView } from '../game-engine/ui/shell/exploration-scene.js';
import { buildClockView, availableHitDice } from '../game-engine/ui/shell/clock-widget.js';
import { buildActionChips } from '../game-engine/ui/shell/action-chips.js';
import { buildCompanionCard, judgeGift } from '../game-engine/ui/shell/companion-card.js';
import { buildPackFromWorld, describeExport } from '../game-engine/campaign/campaign-export.js';
import { normalizePack, validatePack } from '../game-engine/campaign/campaign-pack.js';
import {
    ACT_STARTS_KEY, ACT_SUMMARIES_KEY, APPROVAL_KEY, ARRIVALS_HEARD_KEY, ART_STORAGE, ATTITUDES_KEY, BENCH_KEY,
    BILL_DUE_KEY, BOARDS_WON_KEY, BOARD_KEY, CAMPAIGN_START_KEY, CASES_KEY, CHECK_REQUESTS_KEY, CLIMATE_KEY,
    COLORBLIND_KEY, CONTRADICTIONS_KEY, DEBT_KEY, DEEDS_KEY, DICE_GAME_KEY, DICE_LOG_KEY, DISPATCHES_KEY,
    EXPLORED_KEY, FAME_KEY, FESTIVAL_TOLD_KEY, FIELD_GAINS_KEY, GAME_SHELL_AUTOSTART_KEY, GONE_KEY, GRAVES_KEY,
    HAGGLE_KEY, HERO_FIT_KEY, HINTS_KEY, LEAVE_ON_KEY, LENGTH_KEY, LETTERS_KEY, LETTERS_SENT_KEY,
    LOCATION_MAPS_MANUAL_HIDDEN_KEY, MAP_NOTES_KEY, MEMORIES_KEY, MODE_HISTORY_KEY, MOUNTS_KEY, NARRATOR_FONT_KEY,
    NARRATOR_MODE_STORAGE, NARRATOR_RECENT_KEY, NEWS_KEY, OFFERS_KEY, PENDING_CHECK_KEY, PERSONAL_ASKED_KEY,
    PLOT_ANNOUNCED_KEY, PLOT_KEY, PLOT_STATE_KEY, PRISONERS_KEY, PROPOSALS_KEY, RECRUITS_MET_KEY, RELICS_GIVEN_KEY,
    ROLL_GUARD_KEY, RUMORS_HEARD_KEY, RUMORS_HEARD_ON_KEY, SAFETY_ON_KEY, SAVER_KEY, SECRETS_KEY, SEED_KEY,
    SESSION_LOG_KEY, STATS_KEY, SUCESOS_KEY, SUCESOS_STORAGE, TAKEN_KEY, TIPS_SEEN_KEY, TONE_KEY, VILLAIN_SEEN_KEY,
    VISITED_KEY, WANTED_KEY, WARNED_KEY, WEATHER_TODAY_KEY, WEEK_TABLE_AUTO_KEY, WEEK_TABLE_KEY, localFlag,
} from './keys.js';
import {
    combatBoardSelection, combatEncounter, combatLogEntries, currentBoardName, currentLocationName,
    currentWorldFactions, factionDaysDue, narratorTurn, partyMembers, setCombatBoardSelection, setCurrentBoardName,
    setCurrentLocationName, setCurrentWorldFactions, setFactionDaysDue, setNarratorTurn, setPartyMembers,
    setTalkingTo, setTypedIntents, setWorldItemCatalogue, talkingTo, typedIntents, usedReactions,
    worldItemCatalogue,
} from './state.js';
import { openOwnSheet, openPartyMemberModal, syncCurse } from './sheet.js';
import { restoreCheckpoint, saveCheckpoint } from './checkpoints.js';
import { canLevelUp, getXpTable, openLevelUpCard, respecMember } from './level-up.js';
import { currentPet, openPetPanel, petMeetsTown, petReact, petSupport, petTricks } from './pet.js';
import {
    abilityVictims, applyTimedCondition, carriedNames, getAbilityCatalogue, learnAbility, learnFromScroll,
    neededComponents, openAbilitiesEditor, openGrimoire, useAbility, useMagicItem,
} from './magic.js';
import {
    deliverTakenContract, expireBoard, finishTakenContract, getGuild, hireMercenary, openDispatch,
    returnDispatches, rivalsMove,
} from './contracts.js';
import {
    hubChips, openGuild, openHubCampaigns, openHubHire, recordFinishedCampaign, retireMember, skipHubTrial,
} from './hub.js';
import {
    askAboutCase, askTheDead, canDuel, duelWith, openCaseBoard, playDuel, revealClue, searchCaseHere, startCase,
} from './cases.js';
import {
    actsOnItsOwn, boardCellOf, enemyTokenId, getAliveEnemies, getAttackableEnemiesForMember,
    getCurrentActingMember, getCurrentTurnEntry, getCurrentTurnState, getPartyMemberByTurnEntry,
    getRemainingMovementFeet, getTargetArmorClass, heightFor, loadCombatState, occupiedCellsFor, partyCell,
    partyFlanks, resetCombatTurnState, saveCombatState, underYourHand, waitingHere,
} from './combat-state.js';
import {
    floatOnToken, paintCombatLog, pushCombatLogEntry, pushCombatLogLines, showCombatDiceRoll,
} from './combat-log.js';
import {
    buildEnemyIntents, chargeOpportunityAttacks, damagePartyMember, enemyBark, planFor, resolveEnemyAttackOn,
} from './enemy-turn.js';
import {
    answerTruce, applyFall, checkScenarioOutcome, endCombat, judgeCurrentScenario, leaveThroughExit, offerExit,
    resolveAllyTurnAction, restoreChatPlaceholder, retreatFromCombat, runCombatTurnLoop, startCombat,
    startWaitingFight, waitingSummary, wakeRoomEnemies,
} from './combat-flow.js';

/** @typedef {import('./types.js').PartyMember} PartyMember */


/** @type {boolean} */
let locationMapsManuallyHidden = false;


export function savePartyState() {
    // chat_metadata.party is the single source of truth. The party used to be
    // mirrored into localStorage as well, which is global to the browser: two
    // chats open in different tabs overwrote each other, and on startup the
    // party of whichever campaign was touched last leaked into the new one.
    savePartyToMetadata();
}

/**
 * Saves current partyMembers to chat_metadata.party and persists to disk.
 */
async function savePartyToMetadata() {
    if (!chat_metadata || typeof chat_metadata !== 'object') {
        console.log('savePartyToMetadata skipped: chat_metadata invalid', { chat_metadata });
        return;
    }
    if (partyMembers.length > 0 && chat_metadata.persona) {
        console.log('Clearing locked chat persona because active party exists', { persona: chat_metadata.persona });
        delete chat_metadata.persona;
    }
    chat_metadata.party = JSON.parse(JSON.stringify(partyMembers));
    console.log('savePartyToMetadata saving party to chat_metadata', { partyMembers, chat_metadata });
    try {
        await saveMetadata();
    } catch (e) {
        console.warn('Unable to save party to chat metadata', e);
    }
}

/**
 * Computes a display name for a party entry from world info.
 * Uses comment first, then dndData.name, then first key, then group.
 * @param {{comment?: string, dndData?: any, key?: string[], group?: string}} entry
 * @returns {string}
 */
export function getPartyEntryDisplayName(entry) {
    const comment = String(entry.comment || '').trim();
    const dataName = String(entry.dndData?.name || '').trim();
    const keys = Array.isArray(entry.key) ? entry.key.filter(Boolean) : [];
    if (comment && comment !== 'Untitled') return comment;
    if (dataName) return dataName;
    if (keys.length) return keys[0];
    return String(entry.group || 'Unknown Character');
}

/**
 * Returns a fallback name for party members that are missing real titles.
 * @param {Partial<PartyMember>} member
 * @returns {string}
 */
function getPartyMemberFallbackName(member) {
    const parts = [];
    if (member.group) parts.push(member.group);
    if (member.class) parts.push(member.class);
    if (member.level) parts.push(`Lv ${member.level}`);
    if (member.alignment) parts.push(member.alignment);
    return parts.filter(Boolean).join(' ') || 'Party Member';
}

/**
 * Loads party from chat_metadata.party (per-session) and renders.
 */
function loadPartyForChat() {
    console.log('loadPartyForChat called', { chat_metadata });
    if (chat_metadata?.party && Array.isArray(chat_metadata.party) && chat_metadata.party.length > 0) {
        setPartyMembers(chat_metadata.party
            .filter((member) => member && member.id && member.name)
            .map((member) => migratePartyMember(member)));
        setPartyMembers(partyMembers.map((member) => {
            if (member.name === 'Untitled') {
                const fallbackName = getPartyMemberFallbackName(member);
                console.log('Replacing Untitled party member name with fallback', { member, fallbackName });
                return { ...member, name: fallbackName };
            }
            return member;
        }));
        console.log('Loaded party from chat_metadata', { partyMembers });
        // Clear any locked persona when party is active
        if (partyMembers.length > 0 && chat_metadata?.persona) {
            console.log('Clearing locked chat persona due to active party', { persona: chat_metadata.persona });
            delete chat_metadata.persona;
        }
        // Restore party leader as active speaker
        if (partyMembers.length > 0) {
            console.log('Restoring active chat speaker to party leader', partyMembers[0].name);
            setUserName(partyMembers[0].name, { toastPersonaNameChange: false });
        }
    } else {
        console.log('No party found in chat_metadata');
        setPartyMembers([]);
    }
    loadCurrentLocation();
    loadCombatState();
    renderPartyMembers();
}

/**
 * @param {any} entry
 * @returns {string}
 */
function getDndEntryName(entry) {
    const comment = String(entry?.comment || '').trim();
    const dndName = String(entry?.dndData?.name || '').trim();
    if (comment && comment !== 'Untitled') return comment;
    if (dndName) return dndName;
    if (Array.isArray(entry?.key) && entry.key.length) return String(entry.key[0]).trim();
    if (entry?.key && String(entry.key).trim()) return String(entry.key).trim();
    return 'Unnamed';
}

/**
 * @param {any} entry
 * @returns {'none'|'character'|'npc'|'monster'|'race'|'class'|'faction'|'location'}
 */
function getDndEntryType(entry) {
    const explicit = normalizeDndEntityType(entry?.dndData?.entityType);
    if (explicit !== 'none') return explicit;

    const group = String(entry?.group || '').trim().toLowerCase();
    if (!group) return 'none';
    if (group.includes('monster')) return 'monster';
    if (group.includes('character')) return 'character';
    if (group.includes('class')) return 'class';
    if (group.includes('race')) return 'race';
    if (group.includes('faction')) return 'faction';
    if (group.includes('location')) return 'location';
    return 'none';
}


/**
 * @param {any} value
 * @returns {string[]}
 */
function parseFactionValues(value) {
    if (Array.isArray(value)) {
        return value.map(x => String(x).trim()).filter(Boolean);
    }
    return String(value || '').split(/,\s*/).map(x => x.trim()).filter(Boolean);
}

/**
 * @param {any} entry
 * @returns {Partial<PartyMember>}
 */
function extractClassPreset(entry) {
    const d = entry?.dndData || {};
    const toNumber = (value) => {
        const n = Number(value);
        return Number.isFinite(n) ? n : undefined;
    };

    return {
        strength: toNumber(d.str ?? d.strength),
        dexterity: toNumber(d.dex ?? d.dexterity),
        constitution: toNumber(d.con ?? d.constitution),
        intelligence: toNumber(d.int ?? d.intelligence),
        wisdom: toNumber(d.wis ?? d.wisdom),
        charisma: toNumber(d.cha ?? d.charisma),
        armorClass: toNumber(d.ac ?? d.armorClass),
        speed: toNumber(d.speed),
        hp: toNumber(d.hp ?? d.maxHp),
        maxHp: toNumber(d.maxHp ?? d.hp),
    };
}

/** @typedef {import('./types.js').DndCatalog} DndCatalog */

/**
 * @param {string|null} worldName
 * @returns {Promise<DndCatalog>}
 */
export async function loadDndCatalog(worldName) {
    /** @type {DndCatalog} */
    const catalog = {
        races: [],
        classes: [],
        factions: [],
        locations: [],
        classPresets: new Map(),
    };

    if (!worldName) return catalog;
    const data = await loadWorldInfo(worldName);
    if (!data?.entries) return catalog;

    const races = new Set();
    const classes = new Set();
    const factions = new Set();
    const locations = new Set();

    for (const entry of Object.values(data.entries)) {
        const type = getDndEntryType(entry);
        const name = getDndEntryName(entry);

        if (type === 'race' && name) races.add(name);
        if (type === 'class' && name) {
            classes.add(name);
            catalog.classPresets.set(name, extractClassPreset(entry));
        }
        if (type === 'faction' && name) factions.add(name);
        if (type === 'location' && name) locations.add(name);

        const d = entry?.dndData || {};
        if (d.race) races.add(String(d.race).trim());
        if (d.charClass) classes.add(String(d.charClass).trim());
        parseFactionValues(d.factions || d.faction).forEach(x => factions.add(x));
        if (d.locationName || d.location) {
            locations.add(String(d.locationName || d.location).trim());
        }
    }

    const locationMaps = Array.isArray(data.metadata?.locationMaps) ? data.metadata.locationMaps : [];
    for (const loc of locationMaps) {
        if (loc?.name) locations.add(String(loc.name).trim());
    }

    catalog.races = Array.from(races).filter(Boolean).sort((a, b) => a.localeCompare(b));
    catalog.classes = Array.from(classes).filter(Boolean).sort((a, b) => a.localeCompare(b));
    catalog.factions = Array.from(factions).filter(Boolean).sort((a, b) => a.localeCompare(b));
    catalog.locations = Array.from(locations).filter(Boolean).sort((a, b) => a.localeCompare(b));
    return catalog;
}


/**
 * Shows a popup to pick a single WI character entry.
 * @param {Array<any>} charEntries - WI entries with group "Characters"
 * @returns {Promise<any|null>} Selected entry or null
 */
async function showCharacterPicker(charEntries) {
    let selectedEntry = null;

    let gridHtml = '<div class="party-picker-grid">';
    for (const entry of charEntries) {
        const uid = String(entry.uid);
        const name = getPartyEntryDisplayName(entry);
        const image = entry.dndData?.image || '';
        const race = entry.dndData?.race || '';
        const charClass = entry.dndData?.charClass || '';
        const level = entry.dndData?.level ? `nivel ${entry.dndData.level}` : '';
        const subtitle = [race, charClass, level].filter(Boolean).join(' · ');

        const imgHtml = image
            ? `<img src="${escapeHtml(image)}" alt="" />`
            : '<i class="fa-solid fa-user fa-2x"></i>';

        gridHtml += `
        <div class="party-card" data-uid="${escapeHtml(uid)}">
            <div class="party-card-img">${imgHtml}</div>
            <div class="party-card-info">
                <div class="party-card-name">${escapeHtml(name)}</div>
                ${subtitle ? `<div class="party-card-subtitle">${escapeHtml(subtitle)}</div>` : ''}
            </div>
            <div class="party-card-check"><i class="fa-solid fa-check"></i></div>
        </div>`;
    }
    gridHtml += '</div>';

    const headerHtml = `<h3 style="margin:0 0 6px"><i class="fa-solid fa-user-plus"></i> Sumar a alguien al grupo</h3>
        <p style="margin:0 0 10px;font-size:0.85rem;color:var(--SmartThemeQuoteColor,#999)">Elige a alguien del mundo para que vaya con vosotros.</p>`;

    const content = $(`<div class="party-picker-container">${headerHtml}${gridHtml}</div>`);

    const popup = new Popup(content, POPUP_TYPE.CONFIRM, undefined, {
        wider: true,
        okButton: 'Sumarlo al grupo',
        cancelButton: 'Cancelar',
        allowVerticalScrolling: true,
        onOpen: () => {
            content.on('click', '.party-card', function () {
                content.find('.party-card').removeClass('selected');
                $(this).addClass('selected');
                selectedEntry = charEntries.find(e => String(e.uid) === String($(this).data('uid'))) || null;
            });
        },
    });

    const result = await popup.show();
    if (result === POPUP_RESULT.AFFIRMATIVE && selectedEntry) {
        return selectedEntry;
    }
    return null;
}


/**
 * Sets party members from world info character entries (used by campaign party picker).
 * Creates proper PartyMember objects from world info dndData.
 * @param {Array<{comment: string, dndData: any, key: string[], group?: string, uid?: number}>} entries
 * @param {string|null} [worldName]
 */
/**
 * Idea 179: el veterano que se trae de otra partida llega con lo puesto y sus mejoras.
 *
 * @param {{items: any[], equippedItems: Record<string, string>, perks: string[]}} gear
 */
export function adoptVeteranGear(gear) {
    const hero = partyMembers[0];
    if (!hero) return;
    hero.items = Array.isArray(gear?.items) ? JSON.parse(JSON.stringify(gear.items)) : [];
    hero.equippedItems = { ...(hero.equippedItems ?? {}), ...(gear?.equippedItems ?? {}) };
    /** @type {any} */ (hero).perks = Array.isArray(gear?.perks) ? [...gear.perks] : [];
    savePartyState();
    renderPartyMembers();
}

/**
 * J1.3: el equipo con el que empieza el héroe nuevo, puesto.
 *
 * @param {any[]} pieces Las piezas del kit (`campaign/starting-kit.js`).
 * @param {Record<string, number>} slots Dónde va cada una, por su índice.
 */
export function giveStartingGear(pieces, slots) {
    const hero = partyMembers.find(m => !m.guest);
    if (!hero || !Array.isArray(pieces) || pieces.length === 0) return;
    const items = pieces.map(piece => createItem(/** @type {any} */ (piece)));
    hero.items = [...(Array.isArray(hero.items) ? hero.items : []), ...items];
    hero.equippedItems = { ...(hero.equippedItems ?? {}) };
    for (const [slot, index] of Object.entries(slots ?? {})) {
        if (items[index]) hero.equippedItems[slot] = items[index].id;
    }
    savePartyState();
    renderPartyMembers();
}

export function setPartyFromWorldEntries(entries, worldName = null) {
    console.log('setPartyFromWorldEntries called', { entriesCount: entries?.length, entries, worldName });
    // Auto-detect world name from chat metadata if not provided
    const resolvedWorldName = worldName || (chat_metadata ? chat_metadata[METADATA_KEY] : null) || null;
    setPartyMembers([]);
    const defaults = getDefaultDndData();
    for (const entry of entries) {
        const d = entry.dndData || {};
        const memberName = getPartyEntryDisplayName(entry);
        /** @type {PartyMember} */
        const member = {
            id: Date.now() + Math.floor(Math.random() * 10000),
            personaId: null,
            wiUid: entry.uid != null ? Number(entry.uid) : null,
            worldName: resolvedWorldName,
            name: memberName,
            group: entry.group || '',
            avatar: d.image || 'img/user-default.png',
            level: Number(d.level) || 1,
            class: d.charClass || 'Adventurer',
            race: d.race || '',
            // Idea 49: el trasfondo, que las tiradas leen.
            background: d.background || '',
            // J1.4: cómo se presenta, que decide si el texto dice «cansado» o «cansada».
            gender: d.gender || '',
            factions: parseFactionValues(d.factions || d.faction),
            hp: Number(d.maxHp) || 30,
            maxHp: Number(d.maxHp) || 30,
            xp: 0,
            xpNext: 100,
            gold: 0,
            silver: 0,
            copper: 0,
            inventory: '',
            conditions: '',
            alignment: d.alignment || '',
            personality: d.personality || '',
            activeConditions: /** @type {string[]} */ ([]),
            strength: Number(d.str) || defaults.strength,
            dexterity: Number(d.dex) || defaults.dexterity,
            constitution: Number(d.con) || defaults.constitution,
            intelligence: Number(d.int) || defaults.intelligence,
            wisdom: Number(d.wis) || defaults.wisdom,
            charisma: Number(d.cha) || defaults.charisma,
            armorClass: Number(d.ac) || defaults.armorClass,
            speed: Number(d.speed) || defaults.speed,
            items: [],
            equippedItems: { ...defaults.equippedItems },
            relationships: [],
            memories: [],
            mapPosition: resolveEntryMapPosition(d),
            // R3: lo que la ficha del mundo dice que sabe hacer (se escribía y no se leía).
            abilities: abilityIdsOf(d),
        };
        partyMembers.push(member);
    }
    renderPartyMembers();
    // Y el tablero, que es donde se les ve. Antes solo se repintaba la tira: quien se
    // hacia un personaje al entrar, o reclutaba a alguien desde el editor, no aparecia
    // sobre el mapa hasta recargar la pagina.
    renderLocationMapsPreview();
    savePartyState();
    console.log('setPartyFromWorldEntries built partyMembers', { partyMembers });
    // Set party leader as active chat speaker
    if (partyMembers.length > 0) {
        console.log('Setting active chat speaker to party leader', partyMembers[0].name);
        setUserName(partyMembers[0].name, { toastPersonaNameChange: false });
    }
}

export function renderPartyMembers() {
    const list = $('#rm_party_list');
    if (!list.length) return;

    list.empty();

    if (partyMembers.length === 0) {
        list.append(
            '<div class="flex-container alignitemscenter justifyCenter padding10"><small>Todavía no hay nadie en el grupo.</small></div>',
        );
        return;
    }

    for (const member of partyMembers) {
        const card = $(
            `<div class="party-card" data-member-id="${member.id}">
                <img class="party-card-avatar" src="${member.avatar}" alt="${member.name}" />
                <div class="party-card-body">
                    <div class="party-card-heading">
                        <strong class="party-card-name">${member.name}</strong>
                        <button class="party-card-remove menu_button fa-solid fa-trash-can" title="Sacar del grupo"></button>
                    </div>
                    <div class="party-card-meta">
                        <span title="Nivel">Nivel ${member.level}</span>
                        <span>${member.class}</span>
                    </div>
                    <div class="party-card-stats">
                        <div class="party-card-stat">
                            <div class="stat-label">PG</div>
                            <div class="stat-value">${member.hp}/${member.maxHp}</div>
                        </div>
                        <div class="party-card-stat">
                            <div class="stat-label">PX</div>
                            <div class="stat-value">${member.xp}</div>
                        </div>
                    </div>
                </div>
            </div>`,
        );

        card.find('.party-card-remove').on('click', (event) => {
            event.stopPropagation();
            removePartyMember(member.id);
        });

        card.on('click', () => {
            openPartyMemberModal(member).catch((error) => {
                console.error('Failed to open party member modal', error);
            });
        });

        list.append(card);
    }
}

// ============================================================
//  WORLD MAP, LOCATION, AND BOARD VIEWS
// ============================================================


export function saveCurrentLocation() {
    if (chat_metadata) {
        chat_metadata['currentLocation'] = currentLocationName;
        // Idea 69: el mapa sabe dónde habéis estado.
        if (currentLocationName) chat_metadata[VISITED_KEY] = markVisited(chat_metadata[VISITED_KEY], currentLocationName);
        saveMetadata();
    }
}

export function saveCurrentBoard() {
    if (chat_metadata) {
        chat_metadata['currentBoard'] = currentBoardName;
        saveMetadata();
    }
}

function loadCurrentLocation() {
    setCurrentLocationName((chat_metadata && chat_metadata['currentLocation']) || '');
    setCurrentBoardName((chat_metadata && chat_metadata['currentBoard']) || '');
    // Y quien se mueve ahi fuera, que el panel de campana dibuja sin poder esperar.
    void reloadWorldFactions();
}

/** De que mundo son los datos leidos. */
let loadedWorldName = '';

/**
 * Releer los datos del mundo si el abierto ya no es el que se leyo.
 *
 * Al crear una campana, el chat cambia **antes** de saber cual es su mundo: la lectura de
 * ese momento no encuentra nada, y nadie volvia a leer. Sin esto, un mundo escrito entero
 * se jugaba sin sus encargos, sin sus rumores y sin sus facciones hasta recargar.
 *
 * @returns {Promise<void>}
 */
export async function ensureWorldData() {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (worldName && worldName !== loadedWorldName) await reloadWorldFactions();
}


/** Idea 74: la estación en la que empezó el mundo; vacía es la de siempre (otoño). */
let lastWorldSeason = '';

/** R5: el género del mundo, para ofrecer la mascota que le pega. */
export let lastWorldGenre = '';

/**
 * J4 de ROADMAP_SIN_CONEXION: si este mundo es un gremio, lo guardado de él; si es una campaña
 * empezada desde uno, de cuál. Las dos cosas hacen que la partida sea sin conexión.
 *
 * @type {import('../game-engine/campaign/hub.js').Hub|null}
 */
export let lastHub = null;

/** @type {string} */
export let lastHubHome = '';

/**
 * J4.6: para qué nivel es la campaña del tablón y en qué acto va cada tablero. Nulo fuera
 * de una campaña del tablón, o si su fila no dice para qué nivel es.
 *
 * @type {import('../game-engine/combat/level-adjust.js').LevelPlan|null}
 */
export let lastLevelPlan = null;

/**
 * J4.6: las filas del tablón (`mundos.json`), leídas una vez por sesión. De ahí sale el
 * tramo de niveles de cada campaña: escrito en un solo sitio, el mismo que lee su tarjeta.
 *
 * @type {Promise<any[]>|null}
 */
let boardCampaignRows = null;

/**
 * @param {string} id La campaña, de `mundos.json`.
 * @returns {Promise<any>} Su tramo de niveles, tal cual; nada si no lo dice.
 */
async function campaignLevelsOf(id) {
    if (!id) return null;
    boardCampaignRows = boardCampaignRows ?? fetch('/mundos/mundos.json')
        .then(response => response.json())
        .then(json => (Array.isArray(json?.worlds) ? json.worlds : []))
        .catch(() => {
            // Sin tablón no se ajusta nada; la próxima vez se vuelve a probar.
            boardCampaignRows = null;
            return [];
        });
    return (await boardCampaignRows).find(w => String(w?.id) === id)?.levels ?? null;
}

/**
 * Idea 74: la estación de hoy.
 *
 * @returns {string}
 */
function currentSeason() {
    return seasonOf(Math.max(1, campaignDay()), lastWorldSeason || undefined);
}

/**
 * Idea 97: los bichos del mundo que andan por aquí en esta estación.
 *
 * @returns {any[]}
 */
export function enemiesInSeason() {
    const season = currentSeason();
    return getCurrentWorldEnemies().filter((/** @type {any} */ e) => openInSeason(e?.seasons, season));
}

/** @returns {any[]} */
export function getCurrentWorldFactions() {
    return currentWorldFactions;
}

/** @returns {Promise<any[]>} */
async function reloadWorldFactions() {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName) {
        setCurrentWorldFactions([]);
        lastHub = null;
        lastHubHome = '';
        lastLevelPlan = null;
        return currentWorldFactions;
    }
    try {
        const data = await loadWorldInfo(worldName);
        loadedWorldName = worldName;
        // J4: el gremio y sus campañas.
        lastHub = isHubWorld(data?.metadata) ? readHub(data.metadata.hub) : null;
        lastHubHome = hubHomeOf(data?.metadata);
        setCurrentWorldFactions(readFactions(data?.metadata?.factions));
        // Y los mandos del tablon, que se leen en el mismo sitio y para lo mismo.
        lastBoardRules = data?.metadata?.boardRules ?? null;
        lastWrittenQuests = Array.isArray(data?.metadata?.writtenQuests)
            ? data.metadata.writtenQuests : [];
        // Lo que trae un mundo escrito entero: sus encargos, sus rumores y su mezcla.
        lastWrittenContracts = readWrittenContracts(data?.metadata?.writtenContracts);
        lastRumors = readRumors(data?.metadata?.rumors);
        lastWorldSeason = readSeason(data?.metadata?.season);
        lastWorldGenre = String(data?.metadata?.genre ?? '');
        lastWorldNpcs = Object.values(data?.entries ?? {})
            .filter((/** @type {any} */ e) => e?.dndData?.entityType === 'npc')
            .map((/** @type {any} */ e) => ({
                name: String(e.dndData?.name || e.comment || ''),
                where: String(e.dndData?.mapPosition?.locationName || ''),
                service: String(e.dndData?.service || ''),
                // Z2 de ROADMAP_SIN_TOKENS: de qué se puede hablar con él sin modelo.
                trade: String(e.dndData?.trade || e.dndData?.title || ''),
                wants: String(e.dndData?.wants || ''),
                knows: String(e.dndData?.knows || ''),
                voice: String(e.dndData?.voice || ''),
                // Idea 110: lo que esconde. No va al narrador hasta que se sonsaca.
                secret: String(e.dndData?.secret || ''),
                // Idea 59: la lengua que habla; vacío es la común.
                language: String(e.dndData?.language || ''),
                // Idea 87: quien ha muerto sigue en el mundo, pero ya no atiende.
                dead: Boolean(e.dndData?.dead),
            }));
        lastMix = data?.metadata?.mix ?? null;
        // Los confidentes, para reclutarlos en la posada (idea 26).
        lastConfidantEntries = Object.fromEntries(Object.entries(data?.entries ?? {})
            .filter(([, e]) => /** @type {any} */ (e)?.dndData?.confidant));
        // Y lo que este mundo dejo entrar de cada bateria.
        lastPicks = (data?.metadata?.picks && typeof data.metadata.picks === 'object')
            ? data.metadata.picks : null;
        // Y lo que escribio o retoco en el taller: su raza, su arma, su bicho.
        lastWorldRows = (data?.metadata?.worldRows && typeof data.metadata.worldRows === 'object')
            ? data.metadata.worldRows : null;
        // J4.6: para qué nivel es, si es una campaña del tablón. Lo último, porque espera a
        // leer el tablón: lo de arriba ya está puesto.
        lastLevelPlan = levelPlanOf(data?.metadata, await campaignLevelsOf(String(data?.metadata?.[HUB_CAMPAIGN_KEY] ?? '')));
    } catch (error) {
        console.error('[party] no se pudieron leer las facciones', error);
        setCurrentWorldFactions([]);
        lastLevelPlan = null;
    }
    return currentWorldFactions;
}

/**
 * Helper: resolve boards for a location, including legacy boardName fallback.
 * @param {any} loc
 */
export function getLocationBoards(loc) {
    if (!loc) return [];
    if (Array.isArray(loc.boards) && loc.boards.length) {
        return loc.boards;
    }
    if (loc.boardName) {
        const globalBoards = getCurrentWorldBoards();
        const found = globalBoards.filter(b => b.name === loc.boardName);
        if (found.length) {
            console.log('[party] getLocationBoards fallback to loc.boardName', { locName: loc.name, boardName: loc.boardName, found });
            return found;
        }
    }
    return [];
}

// ============================================================
//  COMBAT ENCOUNTER STATE
// ============================================================


function loadLocationMapsVisibility() {
    try {
        locationMapsManuallyHidden = window.localStorage.getItem(LOCATION_MAPS_MANUAL_HIDDEN_KEY) === 'true';
    } catch {
        locationMapsManuallyHidden = false;
    }
}

/**
 * @param {boolean} hidden
 */
/**
 * Plegar o desplegar el panel de localizacion.
 *
 * El nombre dice "hidden" y no "visible" a proposito: se llamaba setLocationMapsVisibility
 * y recibia "hidden", asi que pasarle true lo ocultaba. El Modo Juego nacio plegado por eso.
 *
 * @param {boolean} hidden
 */
function setLocationMapsHidden(hidden) {
    locationMapsManuallyHidden = Boolean(hidden);
    try {
        window.localStorage.setItem(LOCATION_MAPS_MANUAL_HIDDEN_KEY, String(locationMapsManuallyHidden));
    } catch (e) {
        console.warn('Unable to store location maps panel visibility', e);
    }
}


/**
 * @param {number} gridWidth
 * @param {number} gridHeight
 */
function getCombatBoardHighlightState(gridWidth, gridHeight) {
    const entry = getCurrentTurnEntry();
    const member = getCurrentActingMember();
    if (!combatEncounter.active || !entry || entry.isEnemy || !member) {
        return { selectedTokenId: null, highlightedTokenIds: [], highlightedCells: [], overlayLegend: '' };
    }

    const isSelected = combatBoardSelection.tokenId === member.id && combatBoardSelection.boardName === currentBoardName && combatBoardSelection.locationName === currentLocationName;
    if (!isSelected) {
        return { selectedTokenId: null, highlightedTokenIds: [], highlightedCells: [], overlayLegend: '' };
    }

    const remainingFeet = getRemainingMovementFeet(member);
    const pos = member.mapPosition || { gridX: 0, gridY: 0, locationName: '' };
    const attackable = getAttackableEnemiesForMember(member);
    /** @type {{gridX:number,gridY:number,kind:'attack'}[]} */
    const attackCells = attackable.map(enemy => ({ gridX: enemy.gridX || 0, gridY: enemy.gridY || 0, kind: 'attack' }));
    const movementCells = getReachableCells(
        getActiveBoardTerrain(), pos.gridX || 0, pos.gridY || 0, remainingFeet, gridWidth, gridHeight,
        { occupied: occupiedCellsFor(member) },
    // La casilla en la que ya estas no es un sitio al que moverte: pulsarla gastaria
    // cero pies, y encendida solo servia para que tu propia ficha se comiera el clic.
    ).filter(cell => cell.gridX !== (pos.gridX || 0) || cell.gridY !== (pos.gridY || 0));
    const overlayLegend = `${member.name} · Movimiento restante ${remainingFeet} ft · Rango ${getAttackRangeFeet(member)} ft${attackable.length ? ` · Objetivos: ${attackable.map(enemy => enemy.name).join(', ')}` : ' · Sin objetivos en rango'}`;

    return {
        selectedTokenId: member.id,
        highlightedTokenIds: attackable.map(enemy => -(combatEncounter.enemies.findIndex(candidate => candidate.instanceId === enemy.instanceId) + 1)).filter(id => id !== 0),
        highlightedCells: [...movementCells, ...attackCells],
        overlayLegend,
    };
}


function getControlledMemberIds() {
    const linked = partyMembers.filter(m => m.personaId !== null).map(m => m.id);
    const yours = underYourHand(linked.length > 0 ? linked : partyMembers.map(m => m.id));

    // Y quien no puede andar tampoco se deja arrastrar: es mejor que la ficha no se
    // levante a que se levante, se suelte y entonces le digan que no. Sigue pudiendo
    // accionar lo que tenga al lado, que es lo que significa estar atado.
    return yours.filter((id) => {
        const member = partyMembers.find(m => Number(m.id) === Number(id));
        return member ? canWalk(member).allowed : false;
    });
}

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
 * Which terrain brush is selected, or null when not editing.
 * @type {string|null}
 */
let activeTerrainBrush = null;

/**
 * Writes terrain and fog back into the world info file that owns the board.
 *
 * The board object handed around is a reference into the loaded world data, so the edit is
 * already visible; this is what makes it survive a reload.
 *
 * @param {any} board
 */
export function persistBoardTerrain(board) {
    // En la fila de escrituras del mundo: abrir una puerta mientras llega gente nueva al
    // sitio guardaba dos copias del mundo, y la ultima borraba a la otra.
    return worldWrite(() => persistBoardTerrainNow(board));
}

/**
 * @param {any} board
 * @returns {Promise<void>}
 */
async function persistBoardTerrainNow(board) {
    if (!currentLocationName || !board) return;
    try {
        const worldName = chat_metadata?.[METADATA_KEY];
        if (!worldName) return;
        const data = await loadWorldInfo(worldName);
        if (!data?.metadata) return;

        // Los tableros viven colgados de su localizacion; la lista global es la forma
        // antigua, y solo la usan los mundos de antes. Mirar solo ahi hacia que pintar
        // terreno en un tablero de localizacion no guardara nada, en silencio.
        const globalBoards = Array.isArray(data.metadata.boards) ? data.metadata.boards : [];
        const locationBoards = (Array.isArray(data.metadata.locationMaps) ? data.metadata.locationMaps : [])
            .flatMap((/** @type {any} */ l) => (Array.isArray(l?.boards) ? l.boards : []));
        const stored = [...locationBoards, ...globalBoards]
            .find((/** @type {any} */ b) => b?.name === board.name);
        if (!stored) return;

        stored.terrain = board.terrain;
        stored.fog = board.fog;
        stored.fogEnabled = board.fogEnabled;
        // Lo que arde o se ha descubierto (ideas 23 y 122): sin esto, un charco de aceite
        // desaparecía al recargar.
        if (Array.isArray(board.hazards)) stored.hazards = board.hazards;
        // R6: y los refuerzos que ya llegaron, para que no vuelvan a llegar.
        if (Array.isArray(board.waves)) stored.waves = board.waves;
        // Y los tesoros de la misión ya sacados de sus cofres.
        if (Array.isArray(board.collectedTreasures)) stored.collectedTreasures = board.collectedTreasures;
        // Que salas se han revelado es parte del estado del tablero: sin esto, una
        // mazmorra se volveria a cerrar sola al recargar.
        if (board.rooms) stored.rooms = board.rooms;
        await saveWorldInfo(worldName, data);
    } catch (e) {
        console.warn('[party] could not persist board terrain', e);
    }
}

/**
 * The brush palette shown under a board while terrain editing is on.
 * @param {any} board
 * @param {() => void} onChange
 * @returns {JQuery}
 */
function buildTerrainPalette(board, onChange) {
    const palette = $('<div class="wm-terrain-palette"></div>');

    const chips = {
        floor: '#3a3a46',
        wall: '#2b2b33',
        difficult: '#b47828',
        cover_half: '#5aa0dc',
        cover_three_quarters: '#3a80bc',
        door: '#6b4a24',
    };

    for (const [value, label] of getTerrainOptions()) {
        const swatch = $('<div class="wm-terrain-swatch"></div>')
            .toggleClass('active', activeTerrainBrush === value);
        swatch.append($('<span class="swatch-chip"></span>').css('background', chips[value] || '#555'));
        swatch.append($('<span></span>').text(label));
        swatch.on('click', () => {
            activeTerrainBrush = activeTerrainBrush === value ? null : value;
            onChange();
        });
        palette.append(swatch);
    }

    const fogToggle = $('<div class="wm-terrain-swatch"></div>')
        .toggleClass('active', Boolean(board?.fogEnabled));
    fogToggle.append('<i class="fa-solid fa-cloud"></i>');
    fogToggle.append($('<span></span>').text('Niebla'));
    fogToggle.on('click', () => {
        board.fogEnabled = !board.fogEnabled;
        if (!board.fogEnabled) board.fog = createEmptyFog();
        persistBoardTerrain(board);
        onChange();
    });
    palette.append(fogToggle);

    const done = $('<div class="wm-terrain-swatch"></div>');
    done.append('<i class="fa-solid fa-xmark"></i>');
    done.append($('<span></span>').text('Salir'));
    done.on('click', () => {
        activeTerrainBrush = null;
        terrainEditing = false;
        onChange();
    });
    palette.append(done);

    return palette;
}

/** Whether the terrain editor is open on the current board. */
let terrainEditing = false;

/**
 * Terrain of the board the party is standing on.
 *
 * Boards created before terrain existed simply have none, and an empty terrain behaves as
 * open floor — so movement highlighting is unchanged for them, and becomes wall-aware the
 * moment a board gains terrain.
 *
 * @returns {import('../game-engine/board/terrain.js').BoardTerrain}
 */
export function getActiveBoardTerrain() {
    return getActiveBoardContext().terrain;
}

/**
 * Switches the right-hand panel tab. Defined inside initPartyPanel, so it is handed out
 * here once that has run.
 * @type {((tab: 'party'|'world_map'|'location'|'campaign') => void)|null}
 */
let partyTabSetter = null;

/**
 * Puts the party on a board without going through /go and /enter.
 *
 * The campaign wizard uses this so a new campaign opens on its first board instead of
 * ending with a toast that tells you which two commands to type. It does exactly what
 * those commands do, minus the toasts, and refuses a location or board that does not
 * exist rather than leaving the panel pointing at nothing.
 *
 * @param {string} locationName
 * @param {string} boardName
 * @returns {boolean} whether both the location and the board were found
 */
export function enterStartingBoard(locationName, boardName) {
    const location = getCurrentWorldLocationMaps().find(l => l.name === locationName);
    if (!location) return false;

    const board = getLocationBoards(location).find((/** @type {any} */ b) => b.name === boardName);
    if (!board) return false;

    setCurrentLocationName(location.name);
    setCurrentBoardName(board.name);
    saveCurrentLocation();
    saveCurrentBoard();
    partyTabSetter?.('location');

    // The board lives in the party view of the right-hand panel, which starts closed and
    // showing the character editor instead. Entering a board you cannot see reads as
    // nothing having happened — which is exactly what the first version of the campaign
    // wizard looked like.
    //
    // The party icon in the top bar does this properly: it closes the persona drawer, opens
    // the panel and selects the party view, keeping selected_button in step. It never
    // toggles, so pressing it when the view is already showing is harmless. Opening the
    // panel by hand (#rightNavDrawerIcon) shows the wrong view.
    $('#partyDrawerIcon').trigger('click');
    return true;
}

/**
 * Terrain and dimensions of the board the party is standing on.
 *
 * The tactical planner needs all three together, and resolving them separately invited
 * passing a grid size from one board with the terrain of another.
 *
 * @returns {{terrain: import('../game-engine/board/terrain.js').BoardTerrain, gridWidth: number, gridHeight: number, board: any}}
 */
export function getActiveBoardContext() {
    const location = currentLocationName
        ? getCurrentWorldLocationMaps().find(l => l.name === currentLocationName)
        : null;
    const board = (currentLocationName && currentBoardName)
        ? getLocationBoards(location).find((/** @type {any} */ b) => b.name === currentBoardName)
        : null;

    return {
        terrain: normalizeTerrain(board?.terrain),
        gridWidth: Number(location?.gridWidth) || 50,
        gridHeight: Number(location?.gridHeight) || 50,
        board: board ?? null,
    };
}

function buildDragHighlightCells(tokenId, tentGX, tentGY, gridW, gridH) {
    if (!combatEncounter.active) return [];
    const member = partyMembers.find(m => m.id === tokenId);
    if (!member) return [];
    const originX = member.mapPosition?.gridX || 0;
    const originY = member.mapPosition?.gridY || 0;
    const distanceFeet = getDistanceInFeet(originX, originY, tentGX, tentGY);
    const remainingFromHere = Math.max(0, getRemainingMovementFeet(member) - distanceFeet);
    const moveCells = getReachableCells(getActiveBoardTerrain(), tentGX, tentGY, remainingFromHere, gridW, gridH, { occupied: occupiedCellsFor(member) });
    const rangeFeet = getAttackRangeFeet(member);
    /** @type {{gridX:number,gridY:number,kind:'attack'}[]} */
    const attackCells = getAliveEnemies()
        .filter(e => getDistanceInFeet(tentGX, tentGY, e.gridX || 0, e.gridY || 0) <= rangeFeet)
        .map(e => ({ gridX: e.gridX || 0, gridY: e.gridY || 0, kind: /** @type {'attack'} */ ('attack') }));
    return [...moveCells, ...attackCells];
}


/** The mounted panel, when the board is on screen. Null when it is not. */
export let combatLogPanel = null;

/** Idea 20: el filtro del registro. Vive aquí, porque el panel se repinta entero. */
export let combatLogFilter = { kind: 'all', who: '' };


/**
 * Installs the rule pack the open campaign asks for.
 *
 * `dnd-system.js` binds its tables the moment it loads, so a pack that arrives later
 * cannot take effect until the page reloads. Rather than pretend otherwise, the pack is
 * remembered now — `ruleset.js` reads it back on the next load, before dnd-system runs —
 * and the player is told once, with the button that does it. Saying nothing would leave
 * someone editing weapons that the game is quietly ignoring.
 *
 * @param {string} worldName
 */
export async function applyCampaignRuleset(worldName) {
    if (!worldName) return;

    let worldPack = null;
    try {
        const data = await loadWorldInfo(worldName);
        worldPack = data?.metadata?.rulesetPack ?? null;
        setWorldItemCatalogue(Array.isArray(data?.metadata?.itemCatalogue) ? data.metadata.itemCatalogue : []);
    } catch (error) {
        console.error('[party] could not read the campaign rule pack', error);
        return;
    }

    const plan = planRulesetChange(worldPack, readRememberedRuleset());
    if (plan.action === 'none') return;

    if (plan.action === 'reject') {
        console.warn('[party] invalid campaign rule pack', plan.errors);
        toastr.error(plan.reason, 'Reglas de campaña', { timeOut: 12000 });
        return;
    }

    if (!rememberRuleset(plan.action === 'install' ? worldPack : null)) {
        toastr.warning(
            'No se pudieron guardar las reglas de esta campaña: el navegador bloquea el almacenamiento local.',
            'Reglas de campaña',
        );
        return;
    }

    // Applied now so anything reading the ruleset directly is already correct; the reload
    // is for the tables dnd-system froze at load.
    setActiveRuleset(plan.action === 'install' ? worldPack : null);
    // Si lo que cambia se lee al usarse (las habilidades de una campaña), no hay nada que
    // recargar: ir y volver del gremio no puede pedir recargar cada vez.
    if (!needsReload(plan.action === 'install' ? worldPack : null)) return;

    const toast = toastr.info(
        `${plan.reason} Recarga la página para aplicarlas.`,
        'Reglas de campaña',
        { timeOut: 0, extendedTimeOut: 0, closeButton: true, tapToDismiss: false },
    );
    $(toast).find('.toast-message').append(
        $('<button class="menu_button" style="margin-top:6px;"></button>')
            .text('Recargar ahora')
            .on('click', () => window.location.reload()),
    );
}


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
function getRollGuardMode() {
    const mode = chat_metadata?.[ROLL_GUARD_KEY];
    return (mode === 'off' || mode === 'strict') ? mode : 'impossible';
}

/**
 * Corrects fabricated dice totals in a message the model just produced.
 *
 * @param {number} messageId
 */
function applyRollGuard(messageId) {
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
function whoPlays(facts = {}) {
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
function sucesosOn() {
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
function playSucesos(moment, facts = {}, days = 1) {
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
function noteRollInWindow(member, roll) {
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
 * @returns {{day: number, keys: string[], looked: string[]}}
 */
function fieldGainsToday() {
    const today = campaignDay();
    const stored = chat_metadata?.[FIELD_GAINS_KEY];
    if (!stored || Number(stored.day) !== today) return { day: today, keys: [], looked: [] };
    return {
        day: today,
        keys: Array.isArray(stored.keys) ? stored.keys.map(String) : [],
        looked: Array.isArray(stored.looked) ? stored.looked.map(String) : [],
    };
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
async function postEngineLine(text) {
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
function numberWord(n) {
    return ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'][n] ?? String(n);
}

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
 * Entrar en un tablero, contado: qué hay que hacer y quién espera.
 *
 * @param {string} boardName
 * @returns {void}
 */
function tellBoard(boardName) {
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
 * R9: quien manda en un sitio nota lo que pasa en él: un caso resuelto le gusta; un crimen
 * o la nigromancia, no. Lo mueve `changeStanding`, como los encargos.
 *
 * @param {string} place
 * @param {string} what Una clave de `REACTIONS` (`world-echoes.js`).
 * @returns {Promise<void>}
 */
export async function nudgeRuler(place, what) {
    const ruler = rulerOf(place);
    const delta = reactionTo(what);
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!ruler || delta === 0 || !worldName) return;
    await worldWrite(async () => {
        const data = await loadWorldInfo(worldName);
        if (!data) return;
        const moved = changeStanding(readFactions(data.metadata?.factions), String(ruler.id), delta);
        data.metadata = data.metadata ?? {};
        data.metadata.factions = moved;
        await saveWorldInfo(worldName, data, true);
        setCurrentWorldFactions(moved);
    });
    postCombatNarration(`🏛️ [MUNDO] ${ruler.name} ${delta > 0 ? 'lo tiene en cuenta: os mira mejor' : 'se entera: os mira peor'}.`);
}

/**
 * R8: los favores de la gente de aquí que os aprecia (actitud +2 o más).
 *
 * @returns {ReturnType<typeof homeFavors>}
 */
function favorsHere() {
    return homeFavors({ npcs: lastWorldNpcs, attitudes: readAttitudes(chat_metadata?.[ATTITUDES_KEY]), here: currentLocationName });
}

/**
 * R8: si vuelve alguien de los que se fueron. Con la semilla del mundo y la semana.
 */
function welcomeBack() {
    if (!chat_metadata) return;
    const today = campaignDay();
    const random = createSeededRandom(derive(String(chat_metadata?.[METADATA_KEY] || ''), 'vuelve', String(Math.floor(today / 7))));
    const gone = whoComesBack({ raw: chat_metadata[GONE_KEY], today, random });
    if (!gone || partyMembers.some(m => String(m.name) === gone.name)) return;
    const back = comebackOf(gone);
    const hero = partyMembers[0];
    back.member.mapPosition = { ...(hero?.mapPosition ?? {}), locationName: currentLocationName };
    partyMembers.push(back.member);
    chat_metadata[GONE_KEY] = forgetGone(chat_metadata[GONE_KEY], gone.name);
    saveMetadata();
    savePartyState();
    renderPartyMembers();
    postCombatNarration(`🔁 [GRUPO] ${back.line}`);
    void postForModel(back.forModel);
}


/**
 * K3: qué ficha centrar en el tablero: la de quien tiene el turno en combate, una vez por turno.
 *
 * @returns {{focusTokenId?: any, focusKey?: string}}
 */
function activeFocus() {
    if (!combatEncounter.active) return {};
    const entry = getCurrentTurnEntry();
    if (!entry || entry.isEnemy) return {};
    return { focusTokenId: getPartyMemberByTurnEntry(entry)?.id ?? null, focusKey: `${Number(combatEncounter.round) || 1}:${String(entry.id)}` };
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
 * Lo que queda de alguien que ha fallado su tercera salvacion.
 *
 * Las dos salidas son de la campana, no mias: se eligieron al crearla. Y la herida se
 * escribe **encima de la ficha**, no al lado, porque `speed` y la CA se leen en veinte
 * sitios y ninguno deberia tener que preguntar si el que corre esta cojo.
 *
 * @param {any} member
 */
/**
 * Las reglas de filo de esta campana.
 *
 * @returns {any}
 */
export function currentSurvival() {
    return readSurvival(getActiveRuleset()?.survival ?? null);
}

/**
 * R1 del roadmap de profundidad: los interruptores tal como están en el paquete, para
 * preguntar por letras (`hasLetter`) y filtrar lo que no existe en este modo.
 *
 * @returns {any}
 */
export function survivalNow() {
    return getActiveRuleset()?.survival ?? null;
}


/**
 * Idea 186: un sonido por acción, si no se han apagado en «Sonido».
 *
 * @param {string} kind
 */
function soundCue(kind) {
    const settings = loadAudioSettings();
    playCue(kind, { enabled: settings.enabled && settings.effects, volume: settings.volume });
}


/**
 * R6: abrir un cofre. Hace falta estar al lado; da oro y, a veces, algo de valor. Se queda
 * vacío (en suelo).
 *
 * @param {any} board
 * @param {number} gx
 * @param {number} gy
 */
function openChest(board, gx, gy) {
    const opener = partyMembers.find(m => !m.dead && (Number(m.hp) || 0) > 0
        && Math.max(Math.abs((Number(m.mapPosition?.gridX) || 0) - gx), Math.abs((Number(m.mapPosition?.gridY) || 0) - gy)) <= 1);
    if (!opener) {
        toastr.info('Hay que llegar al lado del cofre para abrirlo.', 'Un cofre');
        return;
    }
    const gold = 5 + Math.floor(nextRandom() * 10) * 3;
    opener.gold = (Number(opener.gold) || 0) + gold;
    // Si la misión del tablero pide un tesoro, está en el cofre: es lo que hace que
    // «Encontrar la reliquia» se pueda cumplir.
    const wanted = treasureInChest(board?.objectives, collectedHere(board));
    const rare = nextRandom() < 0.4;
    const pool = DEFAULT_LOOT_RULES.itemsByRarity[rare ? 'Uncommon' : 'Common'] ?? [];
    const name = wanted || (pool.length > 0 && nextRandom() < 0.6 ? pool[Math.floor(nextRandom() * pool.length) % pool.length] : '');
    if (name) addItemToInventory(/** @type {any} */ (opener), createItem(/** @type {any} */ (describeLootItem(name, wanted ? '' : rare ? 'Uncommon' : 'Common', worldItemCatalogue))));
    if (wanted) {
        board.collectedTreasures = [...collectedHere(board), wanted];
        if (combatEncounter.active) combatEncounter.collectedTreasures = board.collectedTreasures;
    }
    board.terrain = setTerrainCell(normalizeTerrain(board.terrain), gx, gy, 'floor');
    persistBoardTerrain(board);
    savePartyState();
    renderPartyMembers();
    renderLocationMapsPreview();
    postCombatNarration(`🧰 [TABLERO] ${opener.name} abre el cofre: ${gold} de oro${name ? ` y ${name}` : ''}.`);
    if (wanted) {
        toastr.success(`${opener.name} encuentra ${wanted}.`, 'Lo que buscabais');
        if (combatEncounter.active) checkScenarioOutcome();
    }
}

/**
 * Los tesoros de la misión que ya se han sacado de este tablero, con o sin pelea.
 *
 * @param {any} board
 * @returns {string[]}
 */
export function collectedHere(board) {
    return [...new Set([
        ...(Array.isArray(board?.collectedTreasures) ? board.collectedTreasures : []),
        ...(combatEncounter.active && Array.isArray(combatEncounter.collectedTreasures) ? combatEncounter.collectedTreasures : []),
    ].map(String))];
}

/**
 * T1 y B3: tirar de la palanca o golpear la barricada. Hace falta alguien al lado; en combate,
 * el que tiene el turno, y gasta su acción (como abrir un cofre a golpes no es gratis).
 *
 * @param {any} board
 * @param {number} gx
 * @param {number} gy
 * @param {'lever'|'barricade'} kind
 */
function useBoardThing(board, gx, gy, kind) {
    const near = (/** @type {any} */ m) => Math.max(Math.abs((Number(m?.mapPosition?.gridX) || 0) - gx), Math.abs((Number(m?.mapPosition?.gridY) || 0) - gy)) <= 1;
    const acting = combatEncounter.active ? getPartyMemberByTurnEntry(getCurrentTurnEntry()) : null;
    const who = combatEncounter.active
        ? (acting && near(acting) && (Number(acting.hp) || 0) > 0 ? acting : null)
        : partyMembers.find(m => !m.dead && (Number(m.hp) || 0) > 0 && near(m));
    const what = kind === 'lever' ? 'la palanca' : 'la barricada';
    if (!who) {
        toastr.info(combatEncounter.active ? `Tiene que estar al lado de ${what} quien tiene el turno.` : `Hay que llegar al lado de ${what}.`, kind === 'lever' ? 'La palanca' : 'La barricada');
        return;
    }
    if (combatEncounter.active) {
        if (!hasAction(combatEncounter, 'action')) {
            toastr.info(`${who.name} ya ha usado su acción este turno.`, kind === 'lever' ? 'La palanca' : 'La barricada');
            return;
        }
        Object.assign(combatEncounter, useAction(combatEncounter, 'action'));
    }
    if (kind === 'lever') {
        const pulled = pullLever(normalizeTerrain(board.terrain));
        board.terrain = pulled.terrain;
        postCombatNarration(`🕹️ [TABLERO] ${who.name} tira de la palanca. ${pulled.line}`);
        if (pulled.opened.length > 0) soundCue('door');
        // Lo que había tras las rejas se ve, y lo que dormía despierta: abrir con la palanca
        // es abrir. Antes la reja se abría y la sala seguía a oscuras, con lo de dentro
        // dormido para siempre (el engendro del Sótano de la Iglesia, en Strahd).
        const { gridWidth, gridHeight } = getActiveBoardContext();
        for (const door of pulled.opened) toggleBoardDoor(board, door.x, door.y, true, gridWidth, gridHeight);
    } else {
        // Fuera de combate se rompe con calma, de una vez; en combate, con el daño del arma.
        const damage = combatEncounter.active ? Math.max(1, rollDiceDetailed(getPlayerDamageFormula(who, 5), 8).total) : 99;
        const hit = hitBarricade(normalizeTerrain(board.terrain), gx, gy, damage);
        board.terrain = hit.terrain;
        postCombatNarration(`🪓 [TABLERO] ${who.name} golpea la barricada${combatEncounter.active ? ` (−${damage})` : ''}. ${hit.line}`);
    }
    persistBoardTerrain(board);
    saveCombatState();
    renderLocationMapsPreview();
}

/**
 * R6: revientan barriles. Quien esté pegado a uno se lleva 2d6 de fuego.
 *
 * @param {Array<{x: number, y: number}>} cells
 * @returns {string[]}
 */
export function explodeBarrels(cells) {
    /** @type {string[]} */
    const lines = [];
    for (const cell of cells) {
        const blast = rollWith('2d6', nextRandom).total;
        const near = (/** @type {number} */ x, /** @type {number} */ y) => Math.max(Math.abs(x - cell.x), Math.abs(y - cell.y)) <= 1;
        const hit = [];
        for (const enemy of getAliveEnemies().filter(e => near(Number(e.gridX) || 0, Number(e.gridY) || 0))) {
            enemy.currentHp = Math.max(0, (Number(enemy.currentHp) || 0) - blast);
            hit.push(`${enemy.name}${enemy.currentHp === 0 ? ' (cae)' : ''}`);
        }
        for (const member of partyMembers.filter(m => !m.dead && (Number(m.hp) || 0) > 0 && near(Number(m.mapPosition?.gridX) || 0, Number(m.mapPosition?.gridY) || 0))) {
            lines.push(...damagePartyMember(member, blast, false));
            hit.push(String(member.name));
        }
        lines.push(`💥 Revienta un barril en (${cell.x + 1}, ${cell.y + 1}): ${blast} de fuego${hit.length > 0 ? ` a ${hit.join(', ')}` : ', y no pilla a nadie'}.`);
    }
    return lines;
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


/**
 * Abre o cierra una puerta del tablero.
 *
 * Abrir no es solo cambiar una casilla: revela la sala que guardaba y despierta lo que
 * dormia dentro. Ese es el ritmo de una mazmorra — el siguiente combate llega cuando tu
 * decides abrir.
 *
 * Vive aqui y no dentro del renderer porque la ficha de accion abre la misma puerta: dos
 * copias de esto serian dos sitios donde olvidarse de despertar la sala.
 *
 * @param {any} board
 * @param {number} gx
 * @param {number} gy
 * @param {boolean} open
 * @param {number} gridW
 * @param {number} gridH
 */
export function toggleBoardDoor(board, gx, gy, open, gridW, gridH) {
    // R6: un cofre se abre, no se cierra.
    if (getCell(normalizeTerrain(board?.terrain), gx, gy).type === 'chest') {
        openChest(board, gx, gy);
        return;
    }
    // T1 y B3: la palanca se tira; la barricada se golpea.
    const touched = getCell(normalizeTerrain(board?.terrain), gx, gy).type;
    if (touched === 'lever' || touched === 'barricade') {
        useBoardThing(board, gx, gy, touched);
        return;
    }
    if (open && isLocked(normalizeTerrain(board.terrain), gx, gy)) {
        void tryUnlock(board, gx, gy, gridW, gridH);
        return;
    }
    if (!open) {
        // Idea 23: una puerta rota ya no se cierra.
        if (getCell(normalizeTerrain(board.terrain), gx, gy).broken) {
            toastr.info('Está rota: ya no se cierra.', 'La puerta');
            return;
        }
        board.terrain = setDoorOpen(normalizeTerrain(board.terrain), gx, gy, false);
        persistBoardTerrain(board);
        soundCue('door');
        postCombatNarration(`[BOARD] La puerta de (${gx + 1}, ${gy + 1}) queda cerrada.`);
        renderLocationMapsPreview();
        return;
    }

    const rooms = normalizeRooms(board.rooms).length > 0
        ? board.rooms
        : deriveRooms(normalizeTerrain(board.terrain), gridW, gridH, {
            revealFrom: partyMembers.map(m => ({
                x: Number(m.mapPosition?.gridX) || 0,
                y: Number(m.mapPosition?.gridY) || 0,
            })),
        });

    const result = openDoor(normalizeTerrain(board.terrain), rooms, gx, gy);
    board.terrain = result.terrain;
    board.rooms = result.rooms;
    persistBoardTerrain(board);
    soundCue('door');
    postCombatNarration(`[BOARD] La puerta de (${gx + 1}, ${gy + 1}) queda abierta.`);

    if (result.revealedRoom) {
        wakeRoomEnemies(board, result.revealedRoom);
    }
    renderLocationMapsPreview();
}


/**
 * Ideas 119 y 135: de quién fue lo que cae. Un nombre del compendio y un sitio del mundo.
 *
 * Con su propia semilla (mundo, objeto, día y cuál): el mismo botín cuenta lo mismo, y los
 * dados del combate no se enteran de que alguien ha inventado una historia.
 *
 * @param {string} name
 * @param {number} index
 * @returns {{owner: string, place: string, random: () => number}}
 */
function lootLore(name, index) {
    const random = createSeededRandom(derive(String(chat_metadata?.[METADATA_KEY] || ''), 'botin', String(name), String(campaignDay()), String(index)));
    const owner = lastCompendium?.has?.('nombres')
        ? String(makeNames({ compendium: lastCompendium, howMany: 1, random })[0] ?? '')
        : '';
    const places = getCurrentWorldLocationMaps().map((/** @type {any} */ l) => String(l?.name ?? '')).filter(Boolean);
    const place = places.length > 0 ? places[Math.floor(random() * places.length) % places.length] : currentLocationName;
    return { owner: owner || ['Brunilda', 'Odo el Tuerto', 'Mencía', 'Rodrigo de la Cruz'][Math.floor(random() * 4) % 4], place, random };
}


/**
 * Hands out what the encounter was worth.
 *
 * Only on a victory: walking away or being wiped out leaves the bodies where they are.
 * Everything is rolled by the engine and announced line by line, like every other combat
 * result, so a player can see where their gold came from.
 *
 * @param {Array<any>} defeated
 * @returns {{gold: number, xp: number, items: Array<any>}|null}
 */
export function awardEncounterLoot(defeated) {
    const standing = partyMembers.filter(m => (m.hp || 0) > 0);
    // Los invitados (el mercenario, el escoltado) no van a partes: al mercenario ya se le
    // pagó al contratarle. Antes se llevaba su parte del oro y de la experiencia, y con dos
    // mercenarios el héroe subía de nivel a un tercio de lo que debía.
    const own = standing.filter(m => !m.guest);
    const survivors = own.length > 0 ? own : standing;
    if (survivors.length === 0 || defeated.length === 0) return null;

    // Lo que el autor de la campana haya escrito cae tambien, con la rareza que le puso.
    // Sin esto, escribir objetos seria llenar una lista que el juego no mira.
    const loot = rollEncounterLoot(defeated, survivors.length, {
        roll: (/** @type {string} */ formula) => rollDice(formula, 6),
        // Idea 132: las reliquias no caen como botín: llegan con su hito o su encargo.
        rules: lootRulesWithWorldItems(lootable(worldItemCatalogue)),
    });

    for (const member of survivors) {
        member.gold = (Number(member.gold) || 0) + loot.goldEach;
        member.xp = (Number(member.xp) || 0) + loot.xpEach;
    }

    // Objetos de verdad, no texto. Una pocion que no se puede beber y una espada que no
    // se puede equipar son ambientacion con pasos de mas: lo que cae entra en el
    // inventario como `DndItem`, con su tipo, su peso y su ranura.
    if (loot.items.length > 0) {
        // Un miembro del grupo *es* su ficha: lleva `items` directamente.
        const holder = survivors[0];
        holder.items = holder.items ?? [];
        loot.items.forEach((dropped, index) => {
            const spec = describeLootItem(dropped.name, dropped.rarity, worldItemCatalogue);
            // Ideas 119 y 135: lo de las tablas trae historia, y alguno muerde. Lo escrito
            // por el mundo ya trae la suya.
            const written = worldItemCatalogue.some((/** @type {any} */ i) => String(i?.name ?? '').toLowerCase() === String(dropped.name).toLowerCase());
            const item = createItem(/** @type {any} */ (written ? spec : dressLoot(spec, lootLore(String(dropped.name), index))));
            addItemToInventory(/** @type {any} */ (holder), item);
        });
    }

    // G5: a veces, algo forjado que no estaba en ninguna lista. Solo de quien plantaba cara
    // (desafio de medio para arriba), y en la parte que la curva deja a lo generado.
    const worthy = defeated.some((/** @type {any} */ e) => Number(e?.cr) >= 0.5);
    if (worthy && survivors[0] && lastCompendium.has('materiales') && mixSource({ written: true }) !== 'written') {
        const forged = forgeFromCompendium({ compendium: lastCompendium, random: nextRandom });
        if (forged) {
            addItemToInventory(/** @type {any} */ (survivors[0]), createItem(/** @type {any} */ (dressLoot(forged, lootLore(String(forged.name), -1)))));
            postCombatNarration(`🗡️ [COMBAT] Entre lo que dejaron: ${describeItem(forged)}.`);
        }
    }

    for (const line of loot.lines) postCombatNarration(line);
    if (loot.goldEach > 0) soundCue('coin');

    // Idea 121: las bestias dejan materiales, para la herrería.
    if (survivors[0]) {
        for (const enemy of defeated) {
            for (const name of trophiesOf(enemy, nextRandom)) {
                addItemToInventory(/** @type {any} */ (survivors[0]), createItem(/** @type {any} */ (trophyItem(name))));
                postCombatNarration(`🦴 [COMBAT] De ${String(enemy?.name ?? 'la bestia')}: ${name}.`);
            }
        }
    }

    // Levelling is not automatic: the sheet already has a button for it, and deciding
    // when to level is a player's business, not the engine's.
    for (const member of survivors) {
        if (member.xpNext > 0 && member.xp >= member.xpNext) {
            postCombatNarration(`⭐ [COMBAT] ${member.name} tiene experiencia para subir de nivel.`);
            soundCue('level');
        }
    }

    savePartyState();
    deliverTakenContract();
    return { gold: loot.gold, xp: loot.xp, items: loot.items };
}


/**
 * Las facciones del mundo, en una linea cada una.
 *
 * Con los nombres delante: lo que quiere una meta `destruir` es otra faccion, y sin la
 * lista el panel decia «van a por fac-4-fac-corte».
 *
 * @returns {string[]}
 */
function describeWorldFactions() {
    const all = readFactions(getCurrentWorldFactions());
    const names = namesOf(all);
    return all.map(faction => describeFaction(faction, names));
}

/**
 * Las facciones que te dejarian pasar por lo suyo.
 *
 * A partir de que te miran bien: por debajo de eso te conocen, que no es lo mismo que
 * abrirte un paso que cerraron.
 *
 * @returns {string[]}
 */
function friendlyFactions() {
    return readFactions(getCurrentWorldFactions())
        .filter(faction => standingWith(getCurrentWorldFactions(), faction.id) >= 2)
        .map(faction => faction.name)
        .filter(Boolean);
}

/**
 * De quien es un sitio, en las palabras que lee el modelo.
 *
 * Una faccion manda en lo que tiene (`holds`) y se sienta en su sede. Un vecino de ahi
 * carga con lo que los suyos quieren, y eso es justo lo que le da un motivo propio sin
 * escribirle uno a mano.
 *
 * @param {string} placeName
 * @param {any} rawFactions
 * @returns {{name: string, wants: string, note: string}|null}
 */
function bannerOf(placeName, rawFactions) {
    const where = String(placeName || '').trim().toLowerCase();
    if (!where) return null;

    const owner = readFactions(rawFactions).find(faction =>
        String(faction.seat).toLowerCase() === where
        || faction.holds.some((/** @type {string} */ held) => String(held).toLowerCase() === where));
    if (!owner) return null;

    // «Es de La casa del Vado, los que quieren…» no lo dice nadie: el nombre manda.
    const many = speaksPlural(owner.name);
    const wants = {
        encontrar: `${many ? 'buscan' : 'busca'} el camino a ${owner.goal.target}`,
        conquistar: `${many ? 'quieren' : 'quiere'} ${owner.goal.target}`,
        recuperar: `${many ? 'quieren' : 'quiere'} recuperar ${owner.goal.target}`,
        destruir: `${many ? 'van' : 'va'} a por alguien`,
        controlar: `${many ? 'quieren' : 'quiere'} el camino a ${owner.goal.target}`,
    }[owner.goal.kind] ?? '';

    return { name: owner.name, wants, note: owner.note };
}

/**
 * Lo que un encargo entregado le hace al reloj de quien lo pedia (o lo sufria).
 *
 * Aqui se cierra la otra mitad del bucle de las facciones: hasta ahora el mundo se movia
 * y tu mirabas. Un encargo en contra les quita una semana de trabajo; uno a favor se la
 * da. Tomar partido es la unica forma de que el reloj de otro dependa de ti.
 *
 * @param {any} contract
 * @returns {Promise<void>}
 */
export function settleFactionStake(contract) {
    return worldWrite(() => settleFactionStakeNow(contract));
}

/**
 * @param {any} contract
 * @returns {Promise<void>}
 */
async function settleFactionStakeNow(contract) {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName) return;

    try {
        const data = await loadWorldInfo(worldName);
        const before = readFactions(data?.metadata?.factions);
        if (before.length === 0) return;

        const segments = Math.max(1, Math.floor(Number(contract.segments) || 1));
        const { factions, event } = pushFaction(
            before, String(contract.faction), contract.against ? -segments : segments,
        );

        // Lo que piensan de ti se mueve aunque el reloj no: parar a quien ya estaba a cero
        // sigue siendo haberte puesto en su contra, y ellos se acuerdan.
        const seen = changeStanding(factions, String(contract.faction), contract.against ? -1 : 1);
        const mine = seen.find(f => f.id === String(contract.faction));
        // Idea 104: lo que se gana con unos se pierde con sus enemigos, y se dice.
        const rivals = seen.filter(f => f.id !== String(contract.faction)
            && f.reputation < (factions.find(g => g.id === f.id)?.reputation ?? f.reputation));
        const saidStanding = mine
            ? `${mine.name}: ${describeStanding(mine.reputation)}.`
                + (rivals.length > 0 ? ` ${rivals.map(r => r.name).join(' y ')} no lo olvida${rivals.length > 1 ? 'n' : ''}: os mira${rivals.length > 1 ? 'n' : ''} peor.` : '')
            : '';

        if (!event && !saidStanding) return;

        // Empujar hasta el final cumple la meta igual que cumplirla con el tiempo: una
        // sola forma de que un reloj lleno cambie el mundo.
        let locations = Array.isArray(data.metadata.locationMaps) ? data.metadata.locationMaps : [];
        let people = seen;
        /** @type {string[]} */
        const changed = [];
        if (event?.kind === 'cumple') {
            const who = people.find(f => f.id === event.faction);
            if (who) {
                const applied = applyOutcome({ locations, factions: people, outcome: outcomeOf(who) });
                locations = applied.locations;
                people = applied.factions;
                changed.push(...applied.changed);
            }
        }

        data.metadata.factions = people;
        data.metadata.locationMaps = locations;
        setCurrentWorldFactions(people);
        await saveWorldInfo(worldName, data, true);
        await refreshWorldMapGlobals(worldName);
        if (isShellOpen()) refreshGameShell();

        const told = [event?.note, saidStanding, ...changed].filter(Boolean);
        toastr.info(told[0], 'Se nota ahí fuera', { timeOut: 9000 });
        postForModel([...told, 'Cuéntalo en una frase. No inventes nada que no esté aquí.']
            .join('\n'))
            .catch(error => console.error('[party] faction stake note failed', error));
    } catch (error) {
        console.error('[party] no se pudo mover el reloj de la facción', error);
    }
}

// ================================================================
//  Campaign clock and bonds (wiki/ROADMAP.md, Fase D)
// ================================================================

/**
 * El estado de campana -reloj, vinculos, descansos y mapa- vive en su propio modulo.
 *
 * Aqui solo queda decirle donde estan las cosas de la aplicacion. Ese es el corte: el
 * modulo dice que necesita, y nada de lo que hay dentro busca variables globales.
 */
export const campaign = createCampaignState({
    metadata: () => chat_metadata,
    saveMetadata: () => saveMetadata(),
    party: () => partyMembers,
    saveParty: () => savePartyState(),
    renderParty: () => renderPartyMembers(),
    renderCampaign: () => renderCampaignTab(),
    narrate: (text) => postCombatNarration(text),
    // Z1 de ROADMAP_SIN_TOKENS: el descanso, contado por el narrador del motor.
    tellRest: (kind) => tellMoment('descanso', {
        largo: kind === 'largo' ? 'sí' : 'no',
        dia: Math.max(1, Number(getCampaignCalendar()?.day) || 1) + (kind === 'largo' ? 1 : 0),
        tiempo: weatherHere(),
    }),
    // Cada rango tiene su escena escrita, si el compañero la trae (idea 26).
    rankedUp: (member, rank) => tellBondScene(member, rank),
    isFighting: () => Boolean(combatEncounter.active),
    worldName: () => String(chat_metadata?.[METADATA_KEY] || ''),
    loadWorld: (name) => loadWorldInfo(name),
    // Para devolver los usos de habilidad al descansar: el catalogo vive en las reglas.
    abilities: () => getAbilityCatalogue(),
    // Lo que el tiempo le hace al grupo: curar heridas y pasar la cuenta.
    timePasses: (days, calendar) => onTimePassed(days, calendar),
});


/**
 * Los precios de la semana, con los edificios del gremio descontados.
 *
 * Un solo sitio donde se juntan las dos capas: la campana pone los precios y el gremio los
 * abarata. Preguntarlo en dos sitios distintos seria acabar cobrando dos cosas distintas.
 *
 * @returns {any}
 */
function currentUpkeepRules() {
    // Tres capas, y en este orden: la campana pone los precios, el gremio los abarata con
    // lo que haya construido, y el mundo de fuera los sube. Preguntarlo en dos sitios
    // distintos seria acabar cobrando dos cosas distintas.
    return applyMarket(
        upkeepWithBuildings(getActiveRuleset()?.upkeep ?? null, getGuild()),
        currentMarket(),
    );
}

/**
 * Como esta el mercado donde esta el grupo.
 *
 * Un paso cerrado no es solo un rodeo: es comida que no llega. Sin facciones ni caminos
 * cerrados devuelve 1 y la cuenta sale como salia siempre.
 *
 * @returns {any}
 */
function currentMarket() {
    return marketPressure({
        here: currentLocationName,
        locations: getCurrentWorldLocationMaps(),
        factions: getCurrentWorldFactions(),
    });
}

/**
 * La biblioteca de **esta** campana.
 *
 * La misma de siempre, menos lo que el mundo dejo fuera. Un mundo sin nada elegido la
 * recibe entera, que es como estaba antes de que el taller existiera.
 *
 * @returns {Promise<any>}
 */
export async function campaignCompendium() {
    const { compendium, batteries } = await getCompendium();
    if ((!lastPicks && !lastWorldRows) || !batteries) return compendium;
    const own = mergeWorldRows(batteries, lastWorldRows);
    return createCompendium(lastPicks ? onlyPicked(own, lastPicks) : own);
}


/** @type {any} */
export let lastBoardRules = null;
/** Lo que este mundo dejo entrar de cada bateria, o null si no eligio. */
/** @type {any} */
let lastPicks = null;
/** Las filas que este mundo escribio o retoco en el taller, por dominio, o null. */
/** @type {Record<string, any[]>|null} */
export let lastWorldRows = null;
/** @type {any[]} */
export let lastWrittenQuests = [];
/** @type {import('../game-engine/campaign/written-contracts.js').WrittenContract[]} */
export let lastWrittenContracts = [];
/** @type {import('../game-engine/campaign/rumors.js').Rumor[]} */
let lastRumors = [];
/** @type {any} */
export let lastMix = null;
/** La gente del mundo: quien es, donde vive y que servicio atiende. */
/** @type {Array<{name: string, where: string, service: string, secret?: string, language?: string, dead?: boolean}>} */
export let lastWorldNpcs = [];
/** Las fichas de los confidentes del mundo, por uid. */
/** @type {Record<string, any>} */
let lastConfidantEntries = {};


/**
 * Curar y cobrar: lo que pasa por el hecho de que pase el tiempo.
 *
 * Es la mitad que le faltaba al reloj. Hasta ahora el dia solo avanzaba si tu lo movias y
 * no costaba nada, asi que ganar por los pelos y ganar de sobra eran lo mismo al dia
 * siguiente. Ahora cada dia cura un poco y cada semana hay que pagar.
 *
 * @param {number} days
 * @param {any} calendar
 */
function onTimePassed(days, calendar) {
    const today = Math.max(1, Math.floor(Number(calendar?.day) || 1));
    if (!chat_metadata) {
        notePlot({ kind: 'day', day: Math.floor(Number(calendar?.day) || 0) });
        return;
    }
    // U3 del pegamento: un solo paso del tiempo, en el orden de `time-stages.js`. Si una
    // etapa falla, las demás pasan igual (antes, un error en los rivales dejaba la cuenta
    // sin cobrar).
    // R1: lo que el modo apaga no pasa (sin el cuerpo no hay hambre; sin el mundo, las
    // facciones no avanzan solas).
    const result = runStages(stagesFor(DAY_STAGES, survivalNow()), DAY_HANDLERS, { days, today, calendar }, reportLateStage);
    for (const failed of result.failed) console.error(`[party] la etapa «${failed.id}» del paso del tiempo falló:`, failed.error);
}

/** @param {string} id @param {string} error */
function reportLateStage(id, error) {
    console.error(`[party] la etapa «${id}» del paso del tiempo falló después:`, error);
}

/**
 * U3 del pegamento: lo que hace cada etapa del día. El orden no está aquí: está en
 * `DAY_STAGES`, escrito una vez y probado.
 *
 * @type {Record<string, (context: {days: number, today: number, calendar: any}) => any>}
 */
const DAY_HANDLERS = {
    hilo: ({ calendar }) => notePlot({ kind: 'day', day: Math.floor(Number(calendar?.day) || 0) }),
    // Idea 103: si el hilo lleva dias quieto, llega una pista.
    pistas: () => giveDueHints(),
    // Ideas 113 y 89: las cartas que se escriben hoy, y la fiesta de hoy.
    cartas: () => writeLetters(),
    fiesta: () => tellFestival(),
    curar: ({ days }) => healByDays(days),
    // Comer, beber, dormir y aguantar el clima. Hasta ahora la comida se pagaba y no pasaba
    // nada si no comias: un aviso y a seguir.
    necesidades: ({ days }) => passNeeds(days),
    // El mismo dia que cura y da de comer acerca a los otros a lo que quieren. Antes se
    // contaba aparte, midiendo el calendario alrededor de cada forma de pasar el dia.
    facciones: ({ days }) => {
        setFactionDaysDue(factionDaysDue + Math.max(0, Math.floor(Number(days) || 0)));
        scheduleFactionTick();
    },
    // U8 del pegamento: vuelven los que mandasteis.
    despachos: ({ today }) => returnDispatches(today),
    // Antes solo vencian al abrir el gremio: no abrirlo salia gratis.
    tablon: ({ today }) => expireBoard(today),
    semana: ({ today }) => settleWeeks(today),
};

/**
 * U3 del pegamento: lo de cada semana. Cobrar, lo último.
 *
 * @type {Record<string, () => any>}
 */
const WEEK_HANDLERS = {
    // Primero cobran lo que se debe: el viernes es el viernes para todos.
    deuda: () => settleDueDebt(),
    // Idea 87: y de vez en cuando, sin guerra de por medio, alguien se muda.
    gente: () => driftPeople(),
    // Idea 29: quien está harto avisa, y si ya avisó, se va (si está puesto).
    hartos: () => {
        weighDepartures();
        // R8: y quien se fue, a veces vuelve.
        welcomeBack();
    },
    // Idea 94: los rivales se llevan uno del tablón.
    rivales: () => rivalsMove(),
    // Idea 96: lo que os buscan se va olvidando.
    buscados: () => {
        if (chat_metadata) chat_metadata[WANTED_KEY] = coolDown(chat_metadata[WANTED_KEY]);
    },
    cuenta: () => chargeBill(),
    // U8 del pegamento: a veces, un caso.
    caso: () => { void startCase(false); },
    // U5 del pegamento: la mesa de la semana que empieza.
    mesa: () => startWeekTable(),
};


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


/**
 * Empieza una semana: se apunta lo que pasó en la anterior (de la crónica, sin llamar al
 * modelo) y la mesa se abre sola la primera vez —como un consejo— o si así se quiere; si
 * no, se avisa y está en su botón.
 */
function startWeekTable() {
    if (!chat_metadata) return;
    const state = chat_metadata[WEEK_TABLE_KEY] ?? {};
    const week = weekNumber(campaignDay());
    const summary = weekSummary(chronicleOf(chat), Number(state.since) || 0);
    chat_metadata[WEEK_TABLE_KEY] = { week, since: chat.length, summary };
    saveMetadata();
    const seen = localFlag.get(TIPS_SEEN_KEY).split(',').filter(Boolean);
    if (chat_metadata[WEEK_TABLE_AUTO_KEY] || !seen.includes('mesa')) {
        if (!seen.includes('mesa')) localFlag.set(TIPS_SEEN_KEY, [...seen, 'mesa'].join(','));
        setTimeout(() => { void openWeekTable(); }, 300);
        return;
    }
    const weekTold = tellMoment('semana', { semana: week, cuenta: 'La mesa, con lo que no cabe entero, está en su botón.' });
    postCombatNarration(`📋 [PARTIDA] ${weekTold || `Empieza la semana ${week}: la mesa, con lo que no cabe entero, está en su botón.`}`);
    // Z4: la semana también trae lo suyo.
    playSucesos('semana');
}

/**
 * La semana del calendario en la que cae un día: la 1 es la de los primeros días.
 *
 * @param {number} day
 * @returns {number}
 */
function weekNumber(day) {
    const length = Math.max(1, Number(currentUpkeepRules().weekLength) || 7);
    return Math.floor((Math.max(1, Math.floor(Number(day) || 1)) - 1) / length) + 1;
}

/** U5 del pegamento: la mesa de la semana. */
async function openWeekTable() {
    if (!chat_metadata) return;
    const today = Math.max(1, campaignDay());
    const state = chat_metadata[WEEK_TABLE_KEY] ?? {};
    const bill = partyMembers.length > 0 ? weeklyBill(partyMembers, { rules: currentUpkeepRules() }) : null;
    const due = Number(chat_metadata[BILL_DUE_KEY]) || 0;
    const body = $('<div class="wt-root gs-panel"></div>');
    body.append($('<h3 class="gs-popup-title"></h3>').text(`Semana ${weekNumber(today)} · ${describeSeason(today, lastWorldSeason || undefined)}`));
    if (bill && due > 0 && hasLetter(survivalNow(), 'b')) {
        const short = bill.purse < bill.total;
        body.append($('<p class="wt-bill"></p>').toggleClass('wt-short', short)
            .text(`La cuenta ${whenText(Math.max(0, due - today))}: debéis ${bill.total}, tenéis ${bill.purse}.`));
    }
    const section = (/** @type {string} */ title) => body.append($('<div class="wt-title"></div>').text(title));
    const past = Array.isArray(state.summary) ? state.summary : [];
    if (past.length > 0) {
        section('La semana que pasó');
        for (const line of past) body.append($('<div class="wt-line"></div>').text(line));
    }
    const bonds = getCampaignBonds();
    const affairs = keepOn(affairsOf({
        today,
        factions: currentWorldFactions,
        taken: chat_metadata[TAKEN_KEY] ?? null,
        board: Array.isArray(chat_metadata[BOARD_KEY]) ? chat_metadata[BOARD_KEY] : [],
        plot: getPlot(),
        plotState: chat_metadata[PLOT_STATE_KEY],
        debt: chat_metadata[DEBT_KEY] ?? null,
        party: partyMembers,
        rivals: hasLetter(survivalNow(), 'c'),
        mystery: readCases(chat_metadata[CASES_KEY]),
        // T7: el harto, en la mesa.
        leaving: leavingMembers().map(m => ({ id: m.id, name: String(m.name) })),
        weekDue: Number(chat_metadata[BILL_DUE_KEY]) || 0,
    }), survivalNow());
    section('Los asuntos: no caben todos');
    if (affairs.length === 0) body.append($('<div class="wt-line"></div>').text('Nada aprieta esta semana. Buen momento para el gremio, la posada o el camino.'));
    for (const affair of affairs) {
        const card = $('<div class="wt-affair"></div>').attr('data-kind', affair.kind);
        card.append($('<div class="wt-affair-title"></div>').text(affair.title));
        if (affair.detail) card.append($('<div class="wt-affair-detail"></div>').text(affair.detail));
        card.append($('<div class="wt-affair-when"></div>').text(affair.in === null ? 'Sin plazo' : `Plazo: ${whenText(affair.in)}`));
        card.append($('<div class="wt-ignored"></div>').text(`Si no vais: ${affair.ifIgnored}.`));
        // U8: lo menor del tablón se puede despachar.
        if (affair.kind === 'tablon') {
            const contract = (Array.isArray(chat_metadata[BOARD_KEY]) ? chat_metadata[BOARD_KEY] : [])
                .find((/** @type {any} */ c) => `tablon:${String(c?.id)}` === affair.id);
            if (contract && canDispatch(contract).ok) {
                const send = $('<button type="button" class="menu_button wt-dispatch"></button>').text('Mandar a alguien');
                send.on('click', async () => {
                    if (await openDispatch(contract)) send.replaceWith($('<div class="wt-sent"></div>').text('Mandados.'));
                });
                card.append(send);
            }
        }
        // U8: el caso, con su tablero.
        if (affair.kind === 'caso') {
            const look = $('<button type="button" class="menu_button wt-case"></button>').text('Ver el caso');
            look.on('click', () => { void openCaseBoard(); });
            card.append(look);
        }
        body.append(card);
    }
    const standings = standingsOf({
        guild: getGuild(),
        factions: currentWorldFactions,
        fame: chat_metadata[FAME_KEY],
        places: getCurrentWorldLocationMaps(),
        wanted: chat_metadata[WANTED_KEY],
        attitudes: chat_metadata[ATTITUDES_KEY],
        companions: partyMembers.slice(1).map(m => ({ name: String(m.name), rank: getBondProgress(bonds, String(m.id)).rank })),
    });
    // R8: lo que os hace la gente de aquí que os aprecia.
    const favors = favorsHere();
    if (favors.length > 0) {
        section('Quién os echa una mano aquí');
        for (const favor of favors) body.append($('<div class="wt-line wt-favor"></div>').text(`${favor.name}: ${favor.favor}.`));
    }
    if (standings.length > 0) {
        section('Cómo os ven');
        for (const group of standings) {
            body.append($('<div class="wt-sub"></div>').text(group.title));
            for (const item of group.items) body.append($('<div class="wt-line"></div>').text(item));
        }
    }
    const coming = describeUpcoming(whatComes(today), 6);
    if (coming.length > 0) {
        section('Lo que viene');
        for (const line of coming) body.append($('<div class="wt-line"></div>').text(line));
    }
    await new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', allowVerticalScrolling: true, leftAlign: true }).show();
}

/**
 * Cobrar, cuando toca. El dia de vencimiento vive en la partida, no en la sesion.
 *
 * @param {number} today
 */
function settleWeeks(today) {
    if (!chat_metadata) return;
    const week = Math.max(1, Number(currentUpkeepRules().weekLength) || 7);
    const { weeks, nextDue } = weeksDue(today, Number(chat_metadata[BILL_DUE_KEY]), week);
    for (let i = 0; i < weeks; i++) chargeWeek();
    chat_metadata[BILL_DUE_KEY] = nextDue;
    saveMetadata();
}

/**
 * Curar. Lo permanente se queda; lo demas cuenta los dias.
 *
 * @param {number} days
 */
function healByDays(days) {
    /** @type {string[]} */
    const mended = [];
    for (const member of partyMembers) {
        if (readInjuries(member).length === 0) continue;

        const patch = healInjuries(member, days);
        member.injuries = patch.injuries;
        member.baseStats = patch.baseStats;
        Object.assign(member, patch.stats);
        for (const injury of patch.healed) {
            mended.push(`${member.name}: ${injury.label.toLowerCase()}, curado.`);
            // Idea 56: la herida se va, la marca se queda. E impone.
            member.scars = addScar(member, injury.label);
            mended.push('Le queda una cicatriz (+1 a Intimidación, hasta +2).');
            checkNickname(member);
        }
    }
    if (mended.length > 0) {
        postCombatNarration(`🩹 [CAMPAÑA] ${mended.join(' ')}`);
        savePartyState();
    }
}


/**
 * Lo que unas horas mas le hacen al grupo: hambre, sed, sueno y frio.
 *
 * El agotamiento se aplica **como una herida**, por el mismo sitio que una pierna rota:
 * asi hay un solo mecanismo que empeora a alguien y un solo dueno de `baseStats`.
 *
 * @param {number} days
 */
function passNeeds(days) {
    const hours = Math.max(0, Math.floor(Number(days) || 0)) * 24;
    if (hours <= 0) return;

    const climate = String(chat_metadata?.[CLIMATE_KEY] || 'mild');
    // Dentro de un tablero se esta a la intemperie; en la localidad, bajo techo. Es una
    // aproximacion honesta y se puede afinar cuando las localidades digan si cobijan.
    const sheltered = !currentBoardName;

    /** @type {string[]} */
    const said = [];

    for (const member of partyMembers) {
        if (member.dead) continue;

        // Un mundo puede decidir que aqui no se pasa hambre, o que el clima no mata.
        const rules = currentSurvival();
        if (!rules.needs) continue;
        const tick = tickNeeds(member, {
            hours, climate: rules.exposure ? climate : 'templado', sheltered,
        });
        member.needs = tick.needs;
        said.push(...tick.lines);

        if (tick.damage > 0) member.hp = Math.max(0, (Number(member.hp) || 0) - tick.damage);

        const patch = setInjury(member, tick.exhaustion > 0 ? exhaustionInjury(tick.exhaustion) : null, 'exhaustion');
        member.injuries = patch.injuries;
        member.baseStats = patch.baseStats;
        Object.assign(member, patch.stats);

        // Quien llega al final cae a cero: de ahi en adelante deciden las reglas de la
        // campana, igual que si lo hubiera tumbado una espada. Una sola puerta a la muerte.
        if (tick.collapsed || tick.exhaustion >= LETHAL_EXHAUSTION) {
            member.hp = 0;
            // Quien cae por el clima cae por el clima: el frio se lleva dedos, no brazos.
            applyFall(member, climate === 'frio' ? 'frio' : '');
        }
    }

    if (said.length > 0) {
        postCombatNarration(`🥖 [CAMPAÑA] ${said.join(' ')}`);
        savePartyState();
    }
}

/**
 * La cuenta de una semana, pasada de verdad.
 *
 * Se cobra de lo que hay entre todos y se dice entero. Cuando no llega no se mata de
 * hambre a nadie de golpe: quien vino por dinero deja de cobrar y la lealtad baja, que es
 * lo que se nota en la partida siguiente.
 */
function chargeWeek() {
    // U3 del pegamento: las etapas de la semana, en el orden de `WEEK_STAGES`.
    const result = runStages(stagesFor(WEEK_STAGES, survivalNow()), WEEK_HANDLERS, {}, reportLateStage);
    for (const failed of result.failed) console.error(`[party] la etapa «${failed.id}» de la semana falló:`, failed.error);
}

/** La cuenta de la semana: comida, sueldos, posada y tasas. */
function chargeBill() {
    // H1: la primera cuenta dice qué es (solo llega en los modos que la tienen).
    showTip('bill');
    let bill = weeklyBill(partyMembers, { rules: currentUpkeepRules() });
    // Si no llega, alguien pone lo que falta. Una vez: es para romper la espiral, no para
    // que la cuenta deje de importar.
    if (bill.total > bill.purse && takePatronage(bill.total - bill.purse)) {
        bill = weeklyBill(partyMembers, { rules: currentUpkeepRules() });
    }
    const week = settleWeek(partyMembers, bill);

    // Se cobra por cabeza, empezando por quien mas lleva: el oro es del grupo.
    let owed = Math.min(bill.total, bill.purse);
    for (const member of [...partyMembers].sort((a, b) => (Number(b.gold) || 0) - (Number(a.gold) || 0))) {
        if (owed <= 0) break;
        const has = Math.max(0, Number(member.gold) || 0);
        const taken = Math.min(has, owed);
        member.gold = has - taken;
        owed -= taken;
    }

    for (const name of week.unpaid) {
        const member = partyMembers.find(m => m.name === name);
        if (member) member.unpaidWeeks = (Number(member.unpaidWeeks) || 0) + 1;
    }

    // Y la lealtad, que es lo que convierte no pagar en una consecuencia y no en un
    // numero rojo. Quien llega al fondo se va: es la decision que tomaste con la cuenta
    // delante, no un castigo por jugar mal.
    // Y que la gente se vaya cuando no cobra: se puede apagar, y entonces se quedan.
    const loyalty = currentSurvival().loyalty
        ? settleLoyalty(partyMembers, week.unpaid)
        : { leaving: [], lines: [] };
    if (loyalty.leaving.length > 0) {
        // R8: quien se va sin cobrar también puede volver.
        for (const gone of partyMembers.filter(m => loyalty.leaving.includes(String(m.name)))) {
            if (chat_metadata) chat_metadata[GONE_KEY] = noteGone(chat_metadata[GONE_KEY], gone, campaignDay(), 'sin cobrar');
        }
        setPartyMembers(partyMembers.filter(m => !loyalty.leaving.includes(String(m.name))));
        renderPartyMembers();
    }
    for (const line of loyalty.lines) postCombatNarration(`🤝 [GREMIO] ${line}`);

    // Idea 129: lo que comen las monturas.
    const feed = feedPerWeek(chat_metadata?.[MOUNTS_KEY]);
    if (feed > 0) {
        payFromParty(Math.min(feed, partyPurse()));
        postCombatNarration(`🐴 [CAMPAÑA] El pienso de las monturas: ${feed} de oro.`);
    }

    // Idea 37: el maestro de armas enseña a los que van por detrás.
    const lessons = trainingFor(getGuild(), partyMembers);
    for (const lesson of lessons) {
        const member = partyMembers.find(m => String(m.id) === lesson.id);
        if (member) member.xp = (Number(member.xp) || 0) + lesson.xp;
    }
    if (lessons.length > 0) {
        postCombatNarration(`🗡️ [GREMIO] El maestro de armas os entrena: ${lessons.map(l => l.name).join(', ')} ganan ${lessons[0].xp} de experiencia.`);
    }

    savePartyState();
    postCombatNarration(`💰 [CAMPAÑA] ${week.lines.join(' ')}`);
    if (!week.paid) toastr.warning(week.lines.join('\n'), 'La cuenta no sale', { timeOut: 15000 });
}


/**
 * Apuntar un hecho, con el dia de hoy.
 *
 * @param {string} text
 */
export function noteDeed(text) {
    if (!chat_metadata) return;
    const today = Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1));
    chat_metadata[DEEDS_KEY] = recordDeed(chat_metadata[DEEDS_KEY], today, text);
    saveMetadata();
}

/**
 * U1 del pegamento: un hecho que propone el narrador. El motor decide si se apunta: una
 * frase, que no esté ya, y una al día. Sustituye a las banderas que ponía por su cuenta.
 *
 * @param {string} proposal
 * @returns {string} Lo que se le contesta al narrador.
 */
function proposeFact(proposal) {
    if (!chat_metadata) return 'No hay partida.';
    const today = Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1));
    const result = proposeDeed(chat_metadata[DEEDS_KEY], today, proposal);
    if (!result.ok) return `No se apunta: ${result.reason}`;
    chat_metadata[DEEDS_KEY] = result.deeds;
    saveMetadata();
    refreshWorldMemoryPrompt();
    postCombatNarration(`📝 [MUNDO] El mundo lo recordará: ${result.deeds[result.deeds.length - 1].text}`);
    return 'Apuntado. Sigue con la escena.';
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


/**
 * R1: los ajustes de la pausa que trae el modo (la red de seguridad, que los hartos se
 * vayan), puestos al empezar una partida. Solo lo que nadie ha tocado todavía.
 */
export function applyModeExtras() {
    if (!chat_metadata) return;
    const extras = /** @type {any} */ (GAME_MODES)[modeOf(survivalNow())]?.extras;
    if (!extras) return;
    if (chat_metadata[SAFETY_ON_KEY] === undefined) chat_metadata[SAFETY_ON_KEY] = Boolean(extras.safetyNet);
    if (chat_metadata[LEAVE_ON_KEY] === undefined) chat_metadata[LEAVE_ON_KEY] = Boolean(extras.companionsLeave);
    saveMetadata();
}

/**
 * R1 del roadmap de profundidad: cambiar el modo a mitad de partida (DR2).
 *
 * Los interruptores viven en el paquete de reglas del mundo, así que ahí se escriben; se
 * leen en directo, sin recargar. El cambio queda en la crónica y en el historial, y los
 * ajustes de la pausa que el modo trae (la red de seguridad, que los hartos se vayan) se
 * ponen como los pone el modo: luego se tocan sueltos si se quiere.
 *
 * @returns {Promise<string>}
 */
async function openGameMode() {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName || !chat_metadata) {
        toastr.warning('Abre una campaña antes de cambiarle el modo.');
        return '';
    }
    const before = readSurvival(survivalNow());
    const { openModePanel } = await import('../game-engine/ui/mode-panel.js');
    const chosen = await openModePanel({
        survival: before,
        Popup,
        POPUP_TYPE,
        hint: 'Se puede cambiar cuando quieras, y queda escrito. Una partida que baja de Supervivencia deja de contar como de hierro.',
    });
    if (!chosen) return '';
    const change = recordModeChange({ from: before, to: chosen, day: campaignDay(), history: chat_metadata[MODE_HISTORY_KEY] ?? null });
    if (!change.changed) return '';

    try {
        const data = await loadWorldInfo(worldName);
        if (!data) throw new Error(`no se pudo leer el mundo «${worldName}»`);
        const pack = structuredClone(data.metadata?.rulesetPack ?? { id: 'campaign', name: worldName });
        pack.survival = chosen;
        data.metadata = data.metadata ?? {};
        data.metadata.rulesetPack = pack;
        await saveWorldInfo(worldName, data, true);
        // Recordado para la próxima carga: si no, al volver diría que hay reglas nuevas.
        rememberRuleset(pack);
        setActiveRuleset(pack);
    } catch (error) {
        console.error('[party] el modo no se pudo guardar', error);
        toastr.error('No se pudo guardar el modo. Sigue el de antes.', 'Modo de juego');
        return '';
    }

    chat_metadata[MODE_HISTORY_KEY] = change.history;
    const extras = /** @type {any} */ (GAME_MODES)[modeOf(chosen)]?.extras;
    if (extras) {
        chat_metadata[SAFETY_ON_KEY] = Boolean(extras.safetyNet);
        chat_metadata[LEAVE_ON_KEY] = Boolean(extras.companionsLeave);
    }
    saveMetadata();
    postCombatNarration(`⚙️ [MODO] ${change.line} ${describeGameMode(chosen)}.`);
    renderCampaignTab();
    refreshWorldMemoryPrompt();
    toastr.success(describeGameMode(chosen), 'Modo de juego');
    return change.line;
}

/** U2 del pegamento: el panel del estado. */
async function openStateView() {
    const { openStatePanel } = await import('../game-engine/ui/state-panel.js');
    await openStatePanel({ metadata: chat_metadata ?? {}, Popup, POPUP_TYPE });
}

/**
 * U3 del pegamento: lo que viene, de todos los relojes a la vez.
 *
 * @param {number} today
 * @returns {import('../game-engine/campaign/upcoming.js').Upcoming[]}
 */
export function whatComes(today) {
    const bill = partyMembers.length > 0 ? weeklyBill(partyMembers, { rules: currentUpkeepRules() }) : null;
    // R1: lo apagado no sale.
    return keepOn(upcoming({
        today,
        factions: currentWorldFactions,
        billDue: Number(chat_metadata?.[BILL_DUE_KEY]) || 0,
        bill: Number(bill?.total) || 0,
        purse: partyPurse(),
        debt: chat_metadata?.[DEBT_KEY] ?? null,
        taken: chat_metadata?.[TAKEN_KEY] ?? null,
        plot: getPlot(),
        plotState: chat_metadata?.[PLOT_STATE_KEY],
        party: partyMembers,
        festivals: worldFestivals(),
        dispatches: Array.isArray(chat_metadata?.[DISPATCHES_KEY]) ? chat_metadata[DISPATCHES_KEY] : [],
        seasonStart: lastWorldSeason || undefined,
        // T7: los relojes que no decían su plazo.
        leaving: leavingMembers().map(m => String(m.name)),
        rivals: (Array.isArray(chat_metadata?.[BOARD_KEY]) ? chat_metadata[BOARD_KEY] : []).length > 0,
        wanted: readWanted(chat_metadata?.[WANTED_KEY]),
        hints: {
            open: openMilestones().map((/** @type {any} */ m) => ({ id: String(m.id), title: String(m.title ?? m.id) })),
            openedDay: chat_metadata?.[HINTS_KEY]?.openedDay ?? {},
            given: chat_metadata?.[HINTS_KEY]?.given ?? {},
            early: withJob(partyMembers, 'erudito') ? 1 : 0,
        },
    }), survivalNow());
}

/**
 * T7: quien está harto (ya avisó) y puede irse el día de la semana, si los hartos se van en
 * esta partida.
 *
 * @returns {any[]}
 */
export function leavingMembers() {
    if (!chat_metadata?.[LEAVE_ON_KEY]) return [];
    const warned = Array.isArray(chat_metadata[WARNED_KEY]) ? chat_metadata[WARNED_KEY].map(String) : [];
    return partyMembers.filter(m => !m.dead && warned.includes(String(m.id)));
}


/**
 * El hilo, con sus escenas y pistas ya concordadas con quien juega (J1.4): el guion escribe
 * «si subes {entero|entera}» y aquí sale la forma buena. Lo guardado no se toca: el editor
 * del hilo sigue viendo las dos formas.
 *
 * @returns {import('../game-engine/campaign/plot.js').Plot|null}
 */
export function getPlot() {
    return resolveGenderDeep(readPlot(chat_metadata?.[PLOT_KEY]), whoPlays());
}

/**
 * Poner el hilo en marcha, si esta campana todavia no lo tiene.
 *
 * El del mundo si lo trae escrito; si no, el de su faccion mas peligrosa. Con `announce`
 * se cuenta la mecha, que es como empieza una campana nueva. Sin el, se pone en silencio:
 * una campana que ya iba por la mitad no puede empezar de repente por la primera escena.
 *
 * @param {{announce?: boolean, heroNote?: string}} [options]
 * @returns {Promise<void>}
 */
async function ensurePlot({ announce = false, heroNote = '' } = {}) {
    await ensureWorldData();
    if (!chat_metadata || chat_metadata[PLOT_STATE_KEY]) return;
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName) return;

    let written = null;
    try {
        const data = await loadWorldInfo(worldName);
        written = readPlot(data?.metadata?.plot);
    } catch (error) {
        console.warn('[party] no se pudo leer el hilo del mundo', error);
    }
    // Mientras se leia, otra llamada ha podido ponerlo.
    if (chat_metadata[PLOT_STATE_KEY]) return;

    const plot = written ?? plotFromFaction({ factions: getCurrentWorldFactions() });
    if (!plot) return;

    chat_metadata[PLOT_KEY] = plot;
    const step = startPlot(plot, Math.max(1, campaignDay()));
    chat_metadata[PLOT_STATE_KEY] = step.state;
    saveMetadata();
    if (announce) {
        chat_metadata[PLOT_ANNOUNCED_KEY] = true;
        await applyPlotStep(step, heroNote);
        await tellOmens(plot);
    } else if (isShellOpen()) refreshGameShell();

    // Donde ya se esta tambien cuenta: si la partida empieza en la sede de quien hay que
    // ir a ver, no hace falta salir y volver.
    if (currentLocationName) notePlot({ kind: 'arrive', place: currentLocationName });
}

/**
 * Lo que un suceso del juego le hace al hilo.
 *
 * Exportado para las vueltas de prueba: empujan el hilo con el mismo suceso que daría el
 * juego («ganar en la cripta») sin jugar la campaña entera (J4.5).
 *
 * @param {any} event
 */
export function notePlot(event) {
    const plot = getPlot();
    if (!plot || !chat_metadata) return;
    // Con el día de hoy: es lo que mide los plazos (idea 106).
    const actBefore = actOf(plot, chat_metadata[PLOT_STATE_KEY]);
    const step = plotEvent(plot, chat_metadata[PLOT_STATE_KEY], event, campaignDay());
    // Una pista suelta también es un paso (idea 107): sin ella aquí, una tirada que solo
    // sumaba una pista no se guardaba, y la investigación no avanzaba nunca.
    if (step.opened.length === 0 && step.done.length === 0 && step.missed.length === 0 && step.clues.length === 0) return;
    chat_metadata[PLOT_STATE_KEY] = step.state;
    saveMetadata();
    void applyPlotStep(step);
    // J2.2: la primera vez que el hilo se mueve, el Diario importa: ahí queda apuntado.
    showTip('journal');
    // Ideas 115 y 143: si cambia el acto, se resume el anterior; y el villano asoma cuando toca.
    const actAfter = actOf(plot, step.state);
    if (actAfter > actBefore) void closeAct(plot, actBefore, actAfter);
    showVillain(plot);
}

/**
 * Idea 143: al cerrarse un acto, su resumen va a la memoria del mundo y sus mensajes salen
 * del prompt (se siguen viendo, pero ya no se pagan).
 *
 * @param {any} plot
 * @param {number} closed
 * @param {number} opened
 * @returns {Promise<void>}
 */
async function closeAct(plot, closed, opened) {
    if (!chat_metadata) return;
    const state = chat_metadata[PLOT_STATE_KEY];
    const doneIds = new Set(Array.isArray(state?.done) ? state.done.map(String) : []);
    const milestones = (plot?.milestones ?? []).filter((/** @type {any} */ m) => Number(m.act) === closed && doneIds.has(String(m.id))).map((/** @type {any} */ m) => String(m.title));
    // U4 del pegamento: lo que movió la historia en este acto, de la crónica. Antes entraban
    // todos los hechos apuntados, fueran de este acto o de antes. Seis líneas cortas como mucho:
    // el resumen va a la memoria del narrador en cada turno.
    const from = Number((chat_metadata[ACT_STARTS_KEY] ?? {})[closed]) || 0;
    const deeds = chronicleOf(chat)
        .filter(entry => entry.index >= from && !entry.minor && entry.category !== 'partida')
        .map(entry => entry.text.split('\n')[0].slice(0, 140))
        .slice(-6);
    const summary = summarizeAct({ act: closed, milestones, deeds });
    chat_metadata[ACT_SUMMARIES_KEY] = addSummary(chat_metadata[ACT_SUMMARIES_KEY], closed, summary);
    const starts = chat_metadata[ACT_STARTS_KEY] && typeof chat_metadata[ACT_STARTS_KEY] === 'object' ? chat_metadata[ACT_STARTS_KEY] : {};
    const range = hideRange({ from: Number(starts[closed]) || 0, to: chat.length - 1 });
    chat_metadata[ACT_STARTS_KEY] = { ...starts, [opened]: chat.length };
    saveMetadata();
    // Z1: si cuenta el motor, el cierre en su prosa; si no, el resumen. Una vez, no las dos.
    const closing = tellMoment('acto', { acto: closed, hitos: listNames(milestones) });
    postCombatNarration(closing ? `📜 [HILO] ${closing}` : `📜 [HILO] Se cierra el acto ${closed}. ${summary}`);
    if (range) {
        try {
            const { hideChatMessageRange } = await import('../chats.js');
            await hideChatMessageRange(range.start, range.end, false);
        } catch (error) {
            console.warn('[party] no se pudieron ocultar los mensajes del acto', error);
        }
    }
    refreshWorldMemoryPrompt();
}

/**
 * Idea 115: las escenas del villano que tocan ya, una vez cada una.
 *
 * @param {any} plot
 */
function showVillain(plot) {
    if (!chat_metadata) return;
    const villain = readVillain(plot?.villain);
    if (!villain) return;
    const seen = Array.isArray(chat_metadata[VILLAIN_SEEN_KEY]) ? chat_metadata[VILLAIN_SEEN_KEY].map(String) : [];
    const state = chat_metadata[PLOT_STATE_KEY];
    const due = villainScenesDue({ villain, act: actOf(plot, state), done: Array.isArray(state?.done) ? state.done : [], seen });
    if (due.length === 0) return;
    for (const scene of due) {
        seen.push(scene.id);
        noteDeed(`${villain.name} se dejó ver.`);
        postCombatNarration(`🦹 [HILO] ${villain.name}: ${scene.scene}`);
        void postForModel(villainNote(villain, scene.scene));
    }
    chat_metadata[VILLAIN_SEEN_KEY] = seen;
    saveMetadata();
}

/**
 * Aplicar un paso del hilo: revelar sitios, mover reputaciones y contarlo.
 *
 * Lo que se cuenta va al narrador por el canal que lee, con la escena escrita y la orden
 * de no inventar: la trama es del mundo, no del modelo.
 *
 * @param {import('../game-engine/campaign/plot.js').PlotStep} step
 * @returns {Promise<void>}
 */
async function applyPlotStep(step, heroNote = '') {
    if (step.changes.reveal.length > 0) await revealLocations(step.changes.reveal);
    for (const [faction, amount] of Object.entries(step.changes.standing)) {
        void shiftFactionStanding(faction, amount);
    }

    /** @type {string[]} */
    const lines = [];
    // Idea 101: cómo se cumplió, cuando había varias formas.
    const WAYS = { win: 'luchando', talk: 'hablando', check: 'con maña', arrive: 'llegando', defeat: 'derrotándole', contract: 'con un encargo' };
    // Idea 107: las pistas que se acaban de encontrar.
    for (const found of step.clues) {
        noteDeed(`Una pista para «${found.milestone.title}» (${found.found} de ${found.need}).`);
        lines.push(`Una pista más para «${found.milestone.title}»: ${found.found} de ${found.need}.`);
        toastr.info(`${found.found} de ${found.need}`, `🔍 Una pista: ${found.milestone.title}`, { timeOut: 8000 });
    }
    for (const milestone of step.done) {
        const via = step.via?.[milestone.id];
        noteDeed(`Cumplido${via ? ` (${WAYS[/** @type {keyof typeof WAYS} */ (via)] ?? via})` : ''}: ${milestone.title}.`);
        // Idea 28: cómo se resolvió, cuando había más de una forma, también se juzga.
        if (via) judgeDecision(via === 'win' || via === 'defeat' ? 'hito-luchando' : via === 'talk' ? 'hito-hablando' : via === 'check' ? 'hito-maña' : '');
        if (milestone.hidden) {
            // Idea 111: un secreto de la historia. Su escena se cuenta ahora, al encontrarlo.
            lines.push(`Un secreto de la historia: ${milestone.title}.`);
            if (milestone.scene) lines.push(milestone.scene);
            toastr.success(milestone.title, '🏅 Un secreto de la historia', { timeOut: 12000 });
        } else if (milestone.asks.kind !== 'none') {
            // Los que se cumplen solos son escenas: se cuentan al abrirse, no dos veces.
            lines.push(`Hecho: ${milestone.title}.`);
            // Idea 52: lo que se hace en un sitio, allí se sabe.
            raiseFame(currentLocationName);
        }
        // Idea 132: la reliquia de este hito, si la tiene.
        lines.push(...deliverRelics({ kind: 'milestone', id: milestone.id }));
    }
    for (const milestone of step.opened) {
        // Lo oculto no se cuenta al abrirse: sería decirlo.
        if (milestone.scene && !milestone.hidden) lines.push(milestone.scene);
    }
    // Idea 102: los caminos que se cierran por lo que se ha elegido.
    for (const milestone of step.closed ?? []) {
        noteDeed(`Se cierra un camino: ${milestone.title}.`);
        lines.push(`Por lo que habéis elegido, se cierra un camino: ${milestone.title}.`);
        toastr.warning(milestone.title, '🚧 Se cierra un camino', { timeOut: 10000 });
    }
    // Idea 106: lo que tenía plazo y se ha pasado.
    for (const milestone of step.missed) {
        noteDeed(`Se os pasó el plazo: ${milestone.title}.`);
        lines.push(`Se ha pasado el plazo y ya no hay remedio: ${milestone.title}.`);
        toastr.warning(milestone.title, '⌛ Se os pasó el plazo', { timeOut: 12000 });
    }
    // Idea 114: el presagio que se cumple.
    for (const omen of step.omens) {
        lines.push(`Se cumple el presagio del principio: «${omen}».`);
        toastr.info(`«${omen}»`, '🔮 Se cumple el presagio', { timeOut: 12000 });
    }
    if (step.changes.reveal.length > 0) lines.push(`Ahora se sabe cómo llegar a: ${step.changes.reveal.join(', ')}.`);
    if (heroNote && lines.length > 0) lines.push(heroLine(heroNote));

    // Un final: cual, lo decide con quien os habeis aliado. Se cuenta entero y se guarda.
    const endingId = chooseEnding(step.changes, getCurrentWorldFactions());
    if (endingId && chat_metadata) {
        const ending = getPlot()?.endings?.[endingId];
        chat_metadata.plotEnding = endingId;
        saveMetadata();
        if (ending?.scene) lines.push(ending.scene);
        noteDeed(`Final: ${ending?.title || endingId}.`);
        toastr.success(ending?.title || endingId, 'Final', { timeOut: 15000 });
        // J3.9: la campaña terminada entra en el salón de la fama.
        recordFinishedCampaign();
        // J4.5: la escena del final, con qué fue de cada uno y lo que se lleva.
        const summary = endingSummary();
        if (summary?.people.length) lines.push(`Qué fue de la gente: ${summary.people.join(' ')}`);
        if (summary?.companions.length) lines.push(`Qué fue de cada uno: ${summary.companions.join(' ')}`);
        if (summary) void showEnding(summary);
    }

    const focus = focusOf(getPlot(), chat_metadata?.[PLOT_STATE_KEY], campaignDay());
    // Corto: la linea fija de arriba ya lo dice, esto es solo el aviso del cambio.
    if (focus && step.done.length > 0) toastr.info(describeFocus(focus), 'Lo que tienes entre manos', { timeOut: 5000 });
    if (isShellOpen()) refreshGameShell();

    if (lines.length === 0) return;
    lines.push('Cuéntalo en uno o dos párrafos, en el tono de la campaña. No inventes nada que no esté aquí.');
    await postForModel(`[HILO] ${lines.join('\n')}`)
        .catch(error => console.error('[party] plot note failed', error));
}


/**
 * J4.5: lo que cuenta el final de la campaña abierta. Null si no ha llegado a ninguno.
 *
 * @returns {{title: string, scene: string, people: string[], companions: string[], take: string[], numbers: string[]}|null}
 */
function endingSummary() {
    const endingId = String(chat_metadata?.plotEnding || '');
    if (!endingId) return null;
    const ending = getPlot()?.endings?.[endingId];
    const title = String(ending?.title || endingId);
    // Idea 109: qué fue de cada compañero.
    const bondsNow = getCampaignBonds();
    const companions = companionEpilogues({
        party: partyMembers,
        ranks: Object.fromEntries(partyMembers.map(m => [String(m.id), getBondProgress(bondsNow, String(m.id)).rank])),
        ending: title,
        graves: readGraves(chat_metadata?.[GRAVES_KEY]),
        // J4.5: si la campaña sale de un gremio, quien sigue vivo vuelve con vosotros.
        home: Boolean(lastHubHome),
    });
    // Idea 111: los secretos encontrados, y cuántos había.
    const secrets = secretsOf(getPlot(), chat_metadata?.[PLOT_STATE_KEY]);
    return {
        title,
        scene: String(ending?.scene || ''),
        people: endingEpilogues({ ending, factions: getCurrentWorldFactions() }),
        companions,
        take: takeHome({ party: partyMembers, start: readPartyStart(chat_metadata?.[CAMPAIGN_START_KEY]) }).map(t => t.line),
        // Idea 200: la partida en números, al cerrar.
        numbers: [...statsLines(), ...(secrets.total > 0 ? [`Secretos de la historia: ${secrets.found.length} de ${secrets.total}`] : [])],
    };
}

/**
 * J4.5: la escena del final. El título, lo que pasó, qué fue de la gente y de cada
 * compañero, lo que se lleva cada uno y los números; y, si la campaña sale de un gremio, el
 * botón para volver a él.
 *
 * @param {NonNullable<ReturnType<typeof endingSummary>>} summary
 * @returns {Promise<void>}
 */
async function showEnding(summary) {
    const card = $('<div class="st-root end-root gs-panel"></div>');
    card.append($('<h3 class="gs-popup-title"></h3>').text(`Final: ${summary.title}`));
    if (summary.scene) card.append($('<p class="end-scene"></p>').text(summary.scene));
    /** @param {string} title @param {string[]} rows @param {string} kind */
    const section = (title, rows, kind) => {
        if (rows.length === 0) return;
        card.append($('<h4 class="end-head"></h4>').text(title));
        for (const row of rows) card.append($(`<div class="jr-item ${kind}"></div>`).text(row));
    };
    section('Lo que dejáis atrás', summary.people, 'end-epilogue');
    section('Qué fue de cada uno', summary.companions, 'ep-line');
    section('Lo que se lleva cada uno', summary.take, 'end-take');
    section('La partida en números', summary.numbers, 'end-number');
    const home = Boolean(lastHubHome);
    const HOME = 71;
    const choice = await new Popup(card[0], POPUP_TYPE.TEXT, '', {
        okButton: 'Cerrar',
        leftAlign: true,
        allowVerticalScrolling: true,
        customButtons: home ? [{ text: 'Volver al gremio', result: HOME, classes: ['end-home'], icon: 'fa-house-flag' }] : [],
    }).show();
    if (choice !== HOME) return;
    if (combatEncounter.active) {
        toastr.warning('No mientras peleáis.');
        return;
    }
    const { returnToHub } = await import('../campaigns.js');
    await returnToHub();
}


/**
 * J4.5: volver a ver el final de la campaña abierta.
 *
 * @returns {Promise<string>}
 */
async function openEnding() {
    const summary = endingSummary();
    if (!summary) {
        toastr.info('Esta campaña todavía no ha llegado a su final.', 'El final');
        return '';
    }
    await showEnding(summary);
    return '';
}

/**
 * Quien juega, para la mecha: su pasado manda sobre como se cuenta la primera escena.
 *
 * @param {string} heroNote
 * @returns {string}
 */
function heroLine(heroNote) {
    return `Quien juega es ${heroNote}. Adapta la escena a quién es: no contradigas su pasado.`;
}

/**
 * Pasar al mapa los sitios que el hilo acaba de revelar.
 *
 * Las escondidas viven en `hiddenLocations`, fuera de la lista que usa todo lo demas: asi
 * nada tiene que saber que existen hasta que existen.
 *
 * @param {string[]} names
 * @returns {Promise<void>}
 */
export function revealLocations(names) {
    return worldWrite(() => revealLocationsNow(names));
}

/**
 * @param {string[]} names
 * @returns {Promise<void>}
 */
async function revealLocationsNow(names) {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName) return;
    try {
        const data = await loadWorldInfo(worldName);
        if (!data?.metadata) return;
        const wanted = new Set(names.map(n => String(n).toLowerCase()));
        const hidden = Array.isArray(data.metadata.hiddenLocations) ? data.metadata.hiddenLocations : [];
        const found = hidden.filter((/** @type {any} */ l) => wanted.has(String(l?.name).toLowerCase()));
        if (found.length === 0) return;
        data.metadata.hiddenLocations = hidden.filter((/** @type {any} */ l) => !found.includes(l));
        data.metadata.locationMaps = [...(data.metadata.locationMaps ?? []), ...found];
        await saveWorldInfo(worldName, data, true);
        await refreshWorldMapGlobals(worldName);
    } catch (error) {
        console.error('[party] no se pudo revelar el sitio', error);
    }
}

/**
 * Escuchar lo que se cuenta aqui.
 *
 * Uno cada vez, sin repetir. Si lleva a un sitio escondido, oirlo lo pone en el mapa: es la
 * forma mas natural de descubrir.
 *
 * @returns {Promise<string>}
 */
async function hearRumor(by = '') {
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


/**
 * De donde sale lo siguiente, segun el acto de la partida (M7).
 *
 * @param {{written?: boolean, chat?: boolean}} have
 * @returns {'written'|'seed'|'chat'}
 */
function mixSource(have) {
    const plot = getPlot();
    const state = chat_metadata?.[PLOT_STATE_KEY];
    return chooseSource({
        act: actOf(plot, state),
        ended: plot ? hasEnded(plot, state) : false,
        mix: lastMix,
        roll: nextRandom(),
        have,
    });
}

/**
 * Escribir en el Lorebook del mundo la gente que falta en un sitio (G3).
 *
 * @param {any} data El mundo, ya leido: se escribe en el y se guarda fuera.
 * @param {string} worldName
 * @param {any} compendium
 * @param {string} placeName
 * @param {number} howMany
 * @param {() => number} random
 * @returns {any[]} Los que se han escrito.
 */
function writePeopleInto(data, worldName, compendium, placeName, howMany, random) {
    /** @type {any[]} */
    const made = [];
    for (let i = 0; i < howMany; i++) {
        const person = writePersonFromCompendium({
            compendium, random, locationName: placeName, banner: bannerOf(placeName, data?.metadata?.factions),
        });
        if (!person) break;
        const entry = createWorldInfoEntry(worldName, data);
        if (!entry) break;
        entry.comment = person.name;
        entry.key = person.keys;
        entry.content = [person.backstory, person.personality].filter(Boolean).join(' ');
        entry.group = 'Characters';
        entry.dndData = {
            entityType: 'npc',
            name: person.name,
            title: person.title,
            factions: person.factions,
            mapPosition: { locationName: placeName, gridX: 0, gridY: 0 },
            generated: true,
        };
        made.push(person);
    }
    return made;
}

/**
 * Explorar los alrededores: descubrir un sitio nuevo, con su tablero, sus bichos y su gente.
 *
 * Gasta un bloque del dia. Con nombre, va a buscar lo que propuso el narrador (G6).
 *
 * @param {string} [name]
 * @returns {Promise<string>}
 */
async function exploreHere(name = '') {
    await ensureWorldData();
    if (combatEncounter.active) {
        toastr.warning('No en mitad de un combate.');
        return '';
    }
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    const data = worldName ? await loadWorldInfo(worldName) : null;
    if (!data?.metadata || !currentLocationName) {
        toastr.warning('Primero hay que estar en algún sitio.');
        return '';
    }
    const places = Array.isArray(data.metadata.locationMaps) ? data.metadata.locationMaps : [];
    const hidden = Array.isArray(data.metadata.hiddenLocations) ? data.metadata.hiddenLocations : [];
    const { proposal, proposals } = takeProposal(chat_metadata[PROPOSALS_KEY], name);
    if (name && !proposal) {
        toastr.warning(`Nadie ha hablado de «${name}».`);
        return '';
    }
    if (!canExplore(places, hidden)) {
        toastr.info('Por aquí ya no queda nada que no conozcáis.', 'Explorar');
        return '';
    }

    const compendium = await campaignCompendium();
    const count = Math.max(0, Number(chat_metadata[EXPLORED_KEY]) || 0);
    const random = createSeededRandom(derive(seedOfWorld(data.metadata), 'explorar', currentLocationName, proposal?.name || String(count)));
    const place = discoverPlace({
        compendium, locations: [...places, ...hidden], here: currentLocationName, random,
        name: proposal?.name ?? '', note: proposal?.note ?? '', source: proposal ? 'chat' : 'seed',
    });
    if (!place) {
        toastr.info('No encontráis nada que no conozcáis ya.', 'Explorar');
        return '';
    }

    // G4: lo que vive ahi, criado para su bioma y guardado en el bestiario del mundo.
    const bred = compendium.has('bestiario')
        ? breedBand({ compendium, howMany: 2, cr: 0.5, biome: place.biome, random, season: currentSeason() })
        : [];
    for (const monster of bred) {
        const entry = createWorldInfoEntry(worldName, data);
        if (!entry) continue;
        entry.comment = monster.name;
        entry.key = [monster.name];
        entry.content = monster.description || monster.name;
        entry.group = 'Monsters';
        entry.dndData = {
            entityType: 'monster', name: monster.name, hp: monster.hp, maxHp: monster.hp,
            armorClass: monster.armorClass, cr: monster.cr, speed: monster.speed,
            profile: monster.profile, attackRangeFeet: monster.attackRangeFeet, abilities: monster.abilities ?? [],
            ...(monster.domable !== undefined ? { domable: monster.domable } : {}),
            generated: true,
        };
    }
    const bestiaryNames = bred.length > 0
        ? bred.map(m => m.name)
        : getCurrentWorldEnemies().map((/** @type {any} */ e) => String(e?.name || '')).filter(Boolean);

    // G2: su tablero, de su forma.
    place.boards = [boardForPlace({ place, random, bestiary: bestiaryNames, partySize: partyMembers.length })];
    // G3: su gente.
    const people = writePeopleInto(data, worldName, compendium, place.name, 2, random);

    data.metadata.locationMaps = [...places, place];
    await saveWorldInfo(worldName, data, true);
    await refreshWorldMapGlobals(worldName);

    chat_metadata[EXPLORED_KEY] = count + 1;
    chat_metadata[PROPOSALS_KEY] = proposals;
    saveMetadata();
    advanceCampaignSlot();

    noteDeed(`Descubristeis ${place.name}.`);
    const who = people.map(p => `${p.name}${p.title ? `, ${String(p.title).toLowerCase()}` : ''}`).join(' y ');
    await postForModel(`[EXPLORAR] Explorando los alrededores de ${currentLocationName}, el grupo encuentra ${place.name}. `
        + `${place.description}${who ? ` Allí viven ${who}.` : ''} `
        + 'Cuéntalo en un párrafo. No inventes nada que no esté aquí.');
    toastr.success(place.name, 'Un sitio nuevo en el mapa');
    if (isShellOpen()) refreshGameShell();
    return place.name;
}

/**
 * Al llegar a un sitio con poca gente, se escribe la que falta (G3).
 *
 * En un mundo escrito, la mezcla decide si le toca a lo generado: un sitio que ya tiene a
 * alguien escrito solo se completa en la parte que la curva deja a la semilla. Un sitio
 * vacio se completa siempre, porque llegar tiene que ser llegar a alguna parte.
 *
 * @param {string} placeName
 * @returns {Promise<void>}
 */
function populatePlace(placeName) {
    return worldWrite(() => populatePlaceNow(placeName));
}

/**
 * @param {string} placeName
 * @returns {Promise<void>}
 */
async function populatePlaceNow(placeName) {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName || !placeName) return;
    try {
        const data = await loadWorldInfo(worldName);
        if (!data) return;
        const here = Object.values(data.entries ?? {}).filter((/** @type {any} */ e) =>
            e?.dndData?.entityType === 'npc'
            && String(e.dndData?.mapPosition?.locationName || '').toLowerCase() === placeName.toLowerCase()).length;
        const wanted = peopleWanted(here);
        if (wanted === 0) return;
        if (here > 0 && mixSource({ written: true }) === 'written') return;

        const compendium = await campaignCompendium();
        const random = createSeededRandom(derive(seedOfWorld(data.metadata), 'gente', placeName));
        const people = writePeopleInto(data, worldName, compendium, placeName, wanted, random);
        if (people.length === 0) return;
        await saveWorldInfo(worldName, data, true);
        await refreshWorldMapGlobals(worldName);
        const who = people.map(p => `${p.name}${p.title ? `, ${String(p.title).toLowerCase()}` : ''}`).join(' y ');
        const plural = people.length > 1;
        await postForModel(`[GENTE] En ${placeName} vive${plural ? 'n' : ''} ${who}. `
            + `Que aparezca${plural ? 'n' : ''} con naturalidad cuando toque: el grupo no ${plural ? 'los' : 'lo'} conoce todavía.`);
    } catch (error) {
        console.error('[party] no se pudo poblar el sitio', error);
    }
}

// ================================================================
//  Servicios de cada sitio (wiki/archivo/ROADMAP_MUNDOS_VIVOS.md, fase L)
// ================================================================

/** @returns {any|null} La localidad donde esta el grupo. */
export function hereLocation() {
    return getCurrentWorldLocationMaps().find((/** @type {any} */ l) => l?.name === currentLocationName) ?? null;
}

/** Las escrituras del archivo del mundo, en fila (ver worldWrite). */
let worldWriteQueue = Promise.resolve();

/**
 * Hacer algo con el archivo del mundo sin pisar a otro que lo este haciendo.
 *
 * Llegar a un sitio dispara a la vez el hilo (revela sitios), la gente (G3) y las
 * reputaciones. Cada uno lee el archivo entero, lo cambia y lo guarda: sin fila, el ultimo
 * en guardar borraba lo de los demas, y la cueva que el hito acababa de revelar no salia.
 *
 * @param {() => Promise<void>} task
 * @returns {Promise<void>}
 */
export function worldWrite(task) {
    const run = worldWriteQueue.then(task, task);
    worldWriteQueue = run.catch(() => undefined);
    return run;
}

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
function localMemory() {
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
 * Idea 132: las reliquias que llegan con lo que se acaba de cumplir. Devuelve lo que hay que
 * contarle al narrador.
 *
 * @param {{kind: 'milestone'|'contract', id: string}} event
 * @returns {string[]}
 */
export function deliverRelics(event) {
    if (!chat_metadata) return [];
    const given = Array.isArray(chat_metadata[RELICS_GIVEN_KEY]) ? chat_metadata[RELICS_GIVEN_KEY] : [];
    const relics = relicsFor(worldItemCatalogue, event, given);
    const holder = partyMembers.find(m => !m.dead && (Number(m.hp) || 0) > 0) ?? partyMembers[0];
    if (relics.length === 0 || !holder) return [];
    holder.items = holder.items ?? [];
    for (const relic of relics) {
        const item = createItem(/** @type {any} */ ({ ...describeLootItem(String(relic.name), String(relic.rarity ?? ''), worldItemCatalogue), relic: true }));
        addItemToInventory(/** @type {any} */ (holder), item);
        chat_metadata[RELICS_GIVEN_KEY] = [...(chat_metadata[RELICS_GIVEN_KEY] ?? []), String(relic.name)];
        noteDeed(`${holder.name} lleva ahora ${relic.name}.`);
        toastr.success(describeRelic(relic), '🏺 Una reliquia', { timeOut: 12000 });
    }
    saveMetadata();
    savePartyState();
    return relics.map(relic => `${holder.name} se queda con ${describeRelic(relic)}`);
}


/**
 * @param {string} location
 * @param {string} board
 * @returns {string}
 */
function boardKeyOf(location, board) {
    return `${String(location || '')}::${String(board || '')}`;
}

/**
 * Si la pelea que trae escrita este tablero ya se ganó.
 *
 * @param {string} location
 * @param {string} board
 * @returns {boolean}
 */
export function isBoardWon(location, board) {
    const won = chat_metadata?.[BOARDS_WON_KEY];
    return Array.isArray(won) && won.includes(boardKeyOf(location, board));
}

/**
 * Apuntar que la pelea escrita de un tablero se ganó: peleándola o, la prueba del gremio,
 * saltándola (J2.3), que cuenta igual.
 *
 * @param {string} location
 * @param {string} board
 */
export function recordBoardWon(location, board) {
    if (!chat_metadata || !String(board || '').trim() || isBoardWon(location, board)) return;
    const won = Array.isArray(chat_metadata[BOARDS_WON_KEY]) ? chat_metadata[BOARDS_WON_KEY] : [];
    chat_metadata[BOARDS_WON_KEY] = [...won, boardKeyOf(location, board)];
    saveMetadata();
}

/**
 * Quien espera en el tablero sin pelear todavía: los enemigos que trae escritos y que el grupo
 * ve. Antes solo salían al empezar el combate, y el texto decía que el alguacil y sus guardias
 * revientan la puerta sobre un tablero donde no había nadie (Daniel, 2026-09-28).
 *
 * @param {Array<{name: string, x: number, y: number}>} waiting
 * @returns {import('../world-map-renderer.js').TokenData[]}
 */
function buildBoardIdleEnemyTokens(waiting) {
    const templates = getCurrentWorldEnemies();
    return waiting.map((placement, index) => {
        const template = templates.find(e => String(e.name).toLowerCase() === String(placement.name).toLowerCase());
        return {
            id: -(2000 + index),
            name: String(placement.name),
            avatar: template?.avatar ?? '',
            gridX: Number(placement.x) || 0,
            gridY: Number(placement.y) || 0,
            hp: Number(template?.maxHp) || undefined,
            maxHp: Number(template?.maxHp) || undefined,
            isEnemy: true,
            idle: true,
        };
    });
}

/** El botón «Al narrador» está puesto: lo próximo que se escriba es para él (2026-09-28). */
let askingNarrator = false;
/** Lo último que gritó un jefe al contestar (idea 24). */
let lastBossLine = '';
/** Si alguien acaba de caer al vacío, para dejar ver la caída (idea 189). */
let fellThisTurn = false;


/** @returns {boolean} */
function saverOn() {
    return localFlag.get(SAVER_KEY) === '1';
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
function statsLines() {
    return describeStats(chat_metadata?.[STATS_KEY], {
        days: Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1)),
        places: getCurrentWorldLocationMaps().length,
    });
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
function writeLetters() {
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

/** Idea 172: aplicar los colores para daltonismo. */
function applyColorblind() {
    document.body.classList.toggle('game-colorblind', localFlag.get(COLORBLIND_KEY) === '1');
}

/**
 * Las fiestas del mundo abierto (idea 89), por sitio.
 *
 * @returns {Record<string, {day: number, name: string}>}
 */
function worldFestivals() {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    return festivalsOf(getCurrentWorldLocationMaps(), key => createSeededRandom(derive(worldName, 'fiesta', key)));
}

/** @returns {{day: number, name: string}|null} La fiesta de hoy aqui. */
function festivalHere() {
    return festivalToday(worldFestivals(), currentLocationName, Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1)));
}

/** Idea 89: contar la fiesta de hoy, una vez. */
function tellFestival() {
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
 * Quien manda en un sitio, si alguien manda.
 *
 * @param {string} place
 * @returns {any|null}
 */
function rulerOf(place) {
    const at = String(place).toLowerCase();
    return getCurrentWorldFactions().find(f => String(f.seat ?? '').toLowerCase() === at
        || (f.holds ?? []).some((/** @type {string} */ h) => String(h).toLowerCase() === at)) ?? null;
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
async function retryLastReply(mode) {
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


/** @returns {any[]} Los hitos abiertos del hilo que se ven: los ocultos no (idea 111). */
function openMilestones() {
    const plot = getPlot();
    if (!plot || !chat_metadata) return [];
    return visibleOpen(plot, chat_metadata[PLOT_STATE_KEY]);
}

/** Dar las pistas que tocan hoy (idea 103). */
function giveDueHints() {
    if (!chat_metadata) return;
    const open = openMilestones();
    if (open.length === 0) return;
    const saved = chat_metadata[HINTS_KEY] ?? {};
    const due = dueHints({
        open,
        openedDay: saved.openedDay,
        given: saved.given,
        // Idea 41: con un erudito en el grupo, las pistas llegan un dia antes.
        today: Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1)) + (withJob(partyMembers, 'erudito') ? 1 : 0),
        skillLabel: (skill) => SKILLS[/** @type {keyof typeof SKILLS} */ (skill)]?.label ?? skill,
    });
    /** @type {Record<string, string[]>} */
    const clues = { ...(saved.clues ?? {}) };
    for (const hint of due.hints) clues[hint.id] = [...(clues[hint.id] ?? []), hint.text];
    chat_metadata[HINTS_KEY] = { openedDay: due.openedDay, given: due.given, clues };
    saveMetadata();
    for (const hint of due.hints) {
        toastr.info(hint.text, 'Una pista', { timeOut: 10000 });
        void postForModel('[PISTA] El grupo lleva días sin avanzar. Que les llegue esto por boca de alguien del lugar, '
            + `con naturalidad y sin nombrar reglas: ${hint.text}`);
    }
}

/** Idea 100: el diario, con lo que el grupo sabe. */
/**
 * El diario, sin fallar en silencio: si algo no se puede montar, se dice y queda en la consola
 * con su traza, en vez de que el botón no haga nada.
 */
function openJournalSafely() {
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

/** U4 del pegamento (DU3): las tandas de avisos menores que el jugador ha abierto. */
const unfoldedMessages = new Set();
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
function scheduleFoldChat() {
    if (foldTimer) clearTimeout(foldTimer);
    foldTimer = setTimeout(() => {
        foldTimer = null;
        foldChat();
    }, 60);
}

/** Idea 136: todo lo que se puede hacer ahora, junto y pulsable. */
function openHelp() {
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
function openService(serviceId) {
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
function smithHere() {
    const here = hereLocation();
    return Boolean(here) && servicesOf(here).includes('herreria');
}

/** @returns {string[]} Donde hay herreria, para decirlo cuando aqui no la hay. */
function smithPlaces() {
    return getCurrentWorldLocationMaps()
        .filter((/** @type {any} */ l) => servicesOf(l).includes('herreria'))
        .map((/** @type {any} */ l) => String(l.name));
}

/**
 * Los servicios de aqui, con lo que se puede hacer en cada uno, ya juzgado.
 *
 * @returns {ReturnType<typeof serviceActions>}
 */
function buildServiceCards() {
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

/** @returns {import('../game-engine/campaign/recruit.js').Recruit[]} */
function currentRecruits() {
    return readRecruits({ entries: lastConfidantEntries, party: partyMembers, met: chat_metadata?.[RECRUITS_MET_KEY] });
}

/**
 * Conocer a un confidente: el narrador cuenta la escena de su ficha.
 *
 * @param {string} uid
 * @returns {Promise<void>}
 */
async function meetRecruit(uid) {
    const recruit = currentRecruits().find(r => r.uid === uid);
    if (!recruit || !chat_metadata) return;
    const met = Array.isArray(chat_metadata[RECRUITS_MET_KEY]) ? chat_metadata[RECRUITS_MET_KEY].map(String) : [];
    chat_metadata[RECRUITS_MET_KEY] = [...new Set([...met, uid])];
    saveMetadata();
    await postForModel(describeMeeting(recruit, currentLocationName));
    if (isShellOpen()) refreshGameShell();
}

/**
 * Que un confidente se una al grupo.
 *
 * Su ficha del mundo pasa a ser de personaje: asi la sincronizacion del grupo lo reconoce
 * como de los tuyos y no lo saca al recargar. Se lleva sus escenas de vinculo.
 *
 * @param {string} uid
 * @returns {Promise<void>}
 */
async function hireRecruit(uid) {
    const recruit = currentRecruits().find(r => r.uid === uid);
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!recruit || !worldName) return;
    /** @type {any} */
    let joined = null;
    await worldWrite(async () => {
        const data = await loadWorldInfo(worldName);
        const entry = data?.entries?.[uid]
            ?? Object.values(data?.entries ?? {}).find((/** @type {any} */ e) => String(e?.uid) === uid);
        if (!data || !entry) return;
        entry.dndData = {
            ...entry.dndData,
            entityType: 'character',
            level: Math.max(1, Number(partyMembers[0]?.level) || 1),
            mapPosition: { locationName: currentLocationName, gridX: 0, gridY: 0 },
        };
        joined = memberFromEntry(entry, worldName);
        Object.assign(joined, {
            motive: recruit.motive,
            // Lo que le mueve: de su ficha, o de su motivo y su oficio. Es lo que decide de
            // que opina y como habla en combate.
            reasons: {
                ...(joined.reasons ?? {}),
                wants: wantsOf({ motive: recruit.motive, className: recruit.className, wants: entry.dndData.wants }),
            },
            confidant: true,
            bondScenes: Array.isArray(entry.dndData.bondScenes) ? entry.dndData.bondScenes : [],
            // Idea 45: lo que dice al llegar a cada sitio suyo va con él.
            arrivals: Array.isArray(entry.dndData.arrivals) ? entry.dndData.arrivals : [],
        });
        // Antes de guardar el mundo: al guardarlo se sincroniza el grupo, y tiene que
        // encontrarlo ya dentro para no meterlo dos veces. Idea 42: si no cabe, a casa.
        if (whereHired(partyMembers) === 'bench' && chat_metadata) {
            chat_metadata[BENCH_KEY] = [...readBench(chat_metadata[BENCH_KEY]), joined];
            saveMetadata();
            toastr.info(`${joined.name} se queda en casa, en el gremio: el grupo está lleno.`, 'Contratado');
        } else {
            partyMembers.push(joined);
        }
        savePartyState();
        await saveWorldInfo(worldName, data, true);
        delete lastConfidantEntries[uid];
    });
    if (!joined) return;
    renderPartyMembers();
    noteDeed(`${recruit.name} se unió al grupo en ${currentLocationName}.`);
    rememberTogether(`${recruit.name} se unió al grupo en ${currentLocationName}.`, [String(partyMembers[0]?.name ?? ''), recruit.name]);
    await postForModel(describeJoin(recruit));
    if (isShellOpen()) refreshGameShell();
}

/**
 * La escena escrita de un rango de vinculo, al narrador. Sin escena escrita, nada: el
 * aviso de siempre ya dice que el vinculo ha subido.
 *
 * @param {any} member
 * @param {number} rank
 */
export function tellBondScene(member, rank) {
    const scene = bondSceneFor(member, rank);
    if (!scene) return;
    void postForModel(`[ESCENA DE VÍNCULO · ${member.name}, rango ${rank}${scene.title ? `: ${scene.title}` : ''}] `
        + `${scene.scene} Narra esta escena en tu voz, sin decidir por el jugador.`);
}

/**
 * Apuntar algo que el grupo vivio junto.
 *
 * @param {string} text
 * @param {string[]} who
 */
export function rememberTogether(text, who) {
    if (!chat_metadata) return;
    const day = Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1));
    chat_metadata[MEMORIES_KEY] = addMemory(chat_metadata[MEMORIES_KEY], { day, text, who: who.filter(Boolean) });
    saveMetadata();
}

/** Lo ultimo que opino cada uno: no se repite la frase seguida. */
/** @type {Map<string, string>} */
const lastOpinion = new Map();

/**
 * Idea 27: al aceptar un encargo, quien tenga algo que decir lo dice.
 *
 * @param {any} contract
 */
export function voiceOpinions(contract) {
    const said = partyMembers.slice(1)
        .filter(m => !m.dead && (Number(m.hp) || 0) > 0)
        .map(m => ({ member: m, opinion: opinionOf(readReasons(m).wants, contract, { last: lastOpinion.get(String(m.id)) ?? '', gender: m.gender ?? '' }) }))
        .filter(x => x.opinion);
    for (const { member, opinion } of said.slice(0, 2)) {
        if (!opinion) continue;
        lastOpinion.set(String(member.id), opinion.line);
        postCombatNarration(`💬 ${member.name}: «${opinion.line}»`);
        toastr.info(`«${opinion.line}»`, `${opinion.mood === 'like' ? '👍' : '👎'} ${member.name}`, { timeOut: 6000 });
    }
    // Idea 28: y lo que opinan cuenta para el vínculo. Ya se ha visto: no se repite.
    judgeDecision('', {
        verdicts: approvalFromOpinions(said, m => readReasons(m).wants, `aceptar «${String(contract?.title ?? 'el encargo')}»`),
        quiet: true,
    });
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
async function runService(actionId) {
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

/** La ultima frase, para no repetirla. */
let lastBark = '';

/**
 * Que un companero diga algo, a veces. El tuyo no: sus palabras las pones tu.
 *
 * Es de adorno —no cambia nada y no se le manda al modelo—, asi que usa `Math.random` y no
 * el dado de la partida: no puede mover ninguna tirada de las que si cuentan.
 *
 * @param {any} member
 * @param {string} event
 * @param {string} [about]
 */
export function bark(member, event, about = '') {
    if (!member || String(member.id) === String(partyMembers[0]?.id)) return;
    const line = chooseBark({
        event, wants: readReasons(member).wants, about, last: lastBark, random: Math.random,
        // J1.4: «estoy segura» si lo dice ella; «cubridla» si es ella la que cae.
        gender: member.gender ?? '', aboutGender: partyMembers.find(m => m.name === about)?.gender ?? '',
    });
    if (!line) return;
    lastBark = line;
    postCombatNarration(`💬 ${member.name}: «${line}»`);
    const token = [...document.querySelectorAll('.wm-token')]
        .find(t => t instanceof HTMLElement && t.dataset.tokenId === String(member.id) && t.offsetParent);
    if (!token) return;
    const bubble = document.createElement('div');
    bubble.className = 'wm-bark';
    bubble.textContent = line;
    token.appendChild(bubble);
    setTimeout(() => bubble.remove(), 2600);
}

/**
 * Idea 77: al ganar en un tablero con puertas cerradas con llave, la llave, una vez.
 */
export function dropBoardKey() {
    const context = getActiveBoardContext();
    if (!context.board || lockedDoors(normalizeTerrain(context.board.terrain)).length === 0) return;
    const hero = partyMembers[0];
    const name = `Llave de ${currentBoardName || 'este sitio'}`;
    if (!hero || (hero.items ?? []).some((/** @type {any} */ i) => i?.name === name)) return;
    hero.items = hero.items ?? [];
    addItemToInventory(/** @type {any} */ (hero), createItem(/** @type {any} */ ({ name, type: 'gear', category: 'gear', subcategory: 'tool', weight: 0.1, description: 'Abre las puertas cerradas de este sitio.' })));
    savePartyState();
    postCombatNarration(`🗝️ [COMBAT] Entre lo que dejaron: ${name}.`);
}

/**
 * Idea 77: una puerta cerrada con llave. Con la llave se abre; si no, con maña o a golpes.
 *
 * @param {any} board
 * @param {number} gx
 * @param {number} gy
 * @param {number} gridW
 * @param {number} gridH
 * @returns {Promise<void>}
 */
async function tryUnlock(board, gx, gy, gridW, gridH) {
    const key = partyMembers.flatMap(m => (m.items ?? []).map((/** @type {any} */ item) => ({ member: m, item })))
        .find(({ item }) => /llave|ganz[uú]a/i.test(String(item?.name ?? '')));
    const body = $('<div class="tr-setback"></div>');
    body.append($('<h3></h3>').text('Puerta cerrada con llave'));
    body.append($('<p></p>').text(key ? `${key.member.name} lleva ${key.item.name}.` : 'Nadie lleva la llave. Se puede abrir con maña o echarla abajo.'));
    const picked = await new Popup(body[0], POPUP_TYPE.TEXT, '', {
        okButton: false,
        cancelButton: 'Dejarla',
        customButtons: [
            ...(key ? [{ text: `Usar ${key.item.name}`, result: 31, classes: ['lk-key'] }] : []),
            { text: 'Con maña (Juego de manos, CD 14)', result: 32, classes: ['lk-pick'] },
            { text: 'A golpes (Atletismo, CD 16)', result: 33, classes: ['lk-force'] },
        ],
    }).show();
    if (picked !== 31 && picked !== 32 && picked !== 33) return;
    let opened = picked === 31;
    if (!opened) {
        const skill = picked === 32 ? 'sleight' : 'athletics';
        const dc = picked === 32 ? 14 : 16;
        const who = partyMembers.filter(m => (Number(m.hp) || 0) > 0)
            .reduce((/** @type {any} */ top, m) => (!top || skillModifier(m, skill).modifier > skillModifier(top, skill).modifier ? m : top), null);
        // R3: quien sabe usar la ganzúa lo tiene más fácil (+5, que se nota en la CD).
        const trick = skill === 'sleight' && who ? lockBonus(who) : 0;
        if (trick > 0) postCombatNarration(`🗝️ [BOARD] ${who.name} saca la ganzúa: la cerradura baja de CD ${dc} a ${dc - trick}.`);
        const roll = who ? rollCheck({ member: who, skill, rollD20: () => rollDiceDetailed('1d20', 20).total, dc: dc - trick }) : null;
        if (roll) postCombatNarration(roll.said);
        opened = Boolean(roll?.success);
        if (!opened) {
            toastr.info('La cerradura aguanta.', 'Puerta cerrada');
            return;
        }
    }
    // Idea 23: a golpes, la puerta no se abre: se rompe, y ya no se cierra.
    board.terrain = picked === 33
        ? breakDoor(normalizeTerrain(board.terrain), gx, gy)
        : unlockDoor(normalizeTerrain(board.terrain), gx, gy);
    persistBoardTerrain(board);
    if (picked === 33) postCombatNarration(`🪓 [BOARD] La puerta de (${gx + 1}, ${gy + 1}) salta a golpes: queda rota, y ya no se cierra.`);
    toggleBoardDoor(board, gx, gy, true, gridW, gridH);
}

/**
 * Ideas 28 y 32: lo que les parece a los compañeros lo que acabas de hacer. Suma o resta
 * un punto de vínculo y se ve; y si chocan dos, se cuenta al narrador y pesa en la moral de
 * hoy.
 *
 * @param {string} decision Una de `DECISIONS`, o vacía si ya vienen juzgadas.
 * @param {{verdicts?: any[], quiet?: boolean}} [options] Las ya juzgadas (las opiniones de un
 *   encargo), y si no hace falta enseñarlas otra vez.
 */
export function judgeDecision(decision, { verdicts = undefined, quiet = false } = {}) {
    if (!chat_metadata) return;
    const judged = verdicts ?? approvalFor({ party: partyMembers, decision, wantsOf: m => readReasons(m).wants });
    if (judged.length === 0) return;
    for (const verdict of judged) recordCampaignBondEvent(verdict.id, verdict.mood > 0 ? 'approved' : 'disapproved');
    const { state, friction } = noteApproval(chat_metadata[APPROVAL_KEY], judged, campaignDay());
    chat_metadata[APPROVAL_KEY] = state;
    saveMetadata();
    if (!quiet) toastr.info(describeApproval(judged), `Les parece: ${DECISIONS[decision]?.label ?? judged[0].what}`, { timeOut: 7000 });
    if (friction) {
        postCombatNarration(`⚡ [GRUPO] ${friction.line}`);
        toastr.warning(friction.line, '⚡ Roce en el grupo', { timeOut: 9000 });
        void postForModel(`[ROCE] ${friction.line} Cuéntalo en una o dos frases: discuten, y nadie se va.`);
    }
}

/**
 * Idea 87: los que el hilo necesita, que ni se mudan ni mueren por azar.
 *
 * @returns {string[]}
 */
export function plotPeople() {
    const plot = getPlot();
    /** @type {string[]} */
    const names = [];
    for (const milestone of plot?.milestones ?? []) {
        const asks = /** @type {any} */ (milestone.asks);
        for (const ask of [asks, ...(Array.isArray(asks?.options) ? asks.options : [])]) {
            if (ask?.npc) names.push(String(ask.npc));
        }
    }
    return names;
}

/**
 * Idea 87: apuntar en el mundo lo que le ha pasado a alguien. Muerto sigue en el mundo
 * (el narrador tiene que saberlo), pero ya no atiende; mudado, vive en otro sitio.
 *
 * @param {any} data
 * @param {import('../game-engine/world/people-fate.js').Fate} fate
 */
export function applyFate(data, fate) {
    const entry = Object.values(data?.entries ?? {})
        .find((/** @type {any} */ e) => e?.dndData?.entityType === 'npc' && String(e.dndData.name || e.comment) === fate.name);
    if (!entry) return;
    const npc = lastWorldNpcs.find(n => n.name === fate.name);
    if (fate.kind === 'muere') {
        entry.dndData.dead = true;
        entry.content = `${String(entry.content || '')}\n(Murió en ${fate.from}${fate.why ? ` ${fate.why}` : ''}.)`.trim();
        if (npc) npc.dead = true;
    } else {
        entry.dndData.mapPosition = { ...(entry.dndData.mapPosition ?? {}), locationName: fate.to };
        if (npc) npc.where = fate.to;
    }
}

/**
 * Idea 87: una mudanza sin guerra, una vez a la semana como mucho.
 *
 * @returns {Promise<void>}
 */
async function driftPeople() {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName) return;
    const fate = driftOf({
        npcs: lastWorldNpcs.filter(n => !n.dead),
        neighbours: neighboursOf(getCurrentWorldLocationMaps()),
        keep: plotPeople(),
        random: createSeededRandom(derive(worldName, 'mudanza', String(campaignDay()))),
    });
    if (!fate) return;
    await worldWrite(async () => {
        const data = await loadWorldInfo(worldName);
        if (!data) return;
        applyFate(data, fate);
        await saveWorldInfo(worldName, data, true);
    });
    const line = describeFate(fate);
    toastr.info(line, 'Se sabe algo', { timeOut: 8000 });
    void postForModel(`[MUNDO] ${line} Cuéntalo como algo que se comenta, en una frase. No inventes nada más.`);
}

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
 * Idea 140: cambiar cómo mira alguien al grupo, con los límites del motor.
 *
 * @param {string} name
 * @param {number} delta
 * @param {string} why
 * @returns {string}
 */
export function changeAttitude(name, delta, why) {
    if (!chat_metadata) return 'No hay partida.';
    const npc = lastWorldNpcs.find(n => n.name.toLowerCase() === name.trim().toLowerCase());
    if (!npc) return 'No hay nadie así en el mundo.';
    const result = shiftAttitude(chat_metadata[ATTITUDES_KEY], { name: npc.name, delta, day: campaignDay() });
    if (!result.ok) return `No cambia: ${result.reason}`;
    chat_metadata[ATTITUDES_KEY] = result.state;
    saveMetadata();
    const line = `${npc.name} os mira ahora de forma ${describeAttitude(result.value)}${why ? ` (${why})` : ''}.`;
    postCombatNarration(`🤝 [CAMPAÑA] ${line}`);
    toastr.info(line, 'Actitud');
    refreshWorldMemoryPrompt();
    return `Apuntado: ${line}`;
}

/**
 * Idea 139: apuntar lo que ofrece el narrador, para que quien juega lo coja si quiere.
 *
 * @param {any} name
 * @param {any} note
 * @param {any} to
 * @returns {string}
 */
function offerItem(name, note, to) {
    if (!chat_metadata) return 'No hay partida.';
    const result = addOffer(chat_metadata[OFFERS_KEY], { name: String(name ?? ''), note: String(note ?? ''), to: String(to ?? '') }, { day: campaignDay() });
    if (!result.added) return `No se ofrece: ${result.reason}`;
    chat_metadata[OFFERS_KEY] = result.offers;
    saveMetadata();
    if (isShellOpen()) refreshGameShell();
    return 'Ofrecido. El jugador lo verá como opción; no narres que ya lo lleva.';
}

/**
 * Idea 139: coger lo que ofreció el narrador. Entra lo que el motor conoce, y si es mágico
 * o no lo conoce, una curiosidad que no hace nada.
 *
 * @param {string} idOrName
 * @returns {string}
 */
function acceptOffer(idOrName) {
    if (!chat_metadata) return '';
    const { offer, offers } = takeOffer(chat_metadata[OFFERS_KEY], idOrName);
    if (!offer) {
        toastr.info('No hay nada así esperando.', 'Coger');
        return '';
    }
    const catalogue = [...worldItemCatalogue, ...declaredLootNames().map(name => describeLootItem(name))];
    const { item, known } = resolveOffer(offer, catalogue);
    const holder = partyMembers.find(m => !m.dead && String(m.name).toLowerCase() === offer.to.toLowerCase())
        ?? partyMembers.find(m => !m.dead) ?? partyMembers[0];
    if (!holder) return '';
    const spec = known ? describeLootItem(String(item.name), String(item.rarity ?? ''), worldItemCatalogue) : item;
    addItemToInventory(/** @type {any} */ (holder), createItem(/** @type {any} */ (spec)));
    chat_metadata[OFFERS_KEY] = offers;
    saveMetadata();
    savePartyState();
    const line = `${holder.name} coge ${offer.name}${known ? '' : ' (una curiosidad: no hace nada que el juego sepa)'}.`;
    postCombatNarration(`🎁 [CAMPAÑA] ${line}`);
    toastr.success(line, 'Coger');
    if (isShellOpen()) refreshGameShell();
    return line;
}

/**
 * Idea 145: la cara de quien habla, delante de su párrafo. Solo se dibuja: el texto del
 * mensaje no cambia, y lo que lee el modelo tampoco.
 *
 * @param {number} messageId
 */
function decorateSpeakers(messageId) {
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
 * Idea 29: quien acumula disgustos avisa; si ya avisó y sigue, se va. Solo con la opción
 * puesta en la pausa.
 */
function weighDepartures() {
    if (!chat_metadata?.[LEAVE_ON_KEY]) return;
    const bonds = getCampaignBonds();
    const warned = Array.isArray(chat_metadata[WARNED_KEY]) ? chat_metadata[WARNED_KEY].map(String) : [];
    const verdict = judgeDepartures({
        party: partyMembers,
        approvalOf: m => approvalOf(chat_metadata?.[APPROVAL_KEY], String(m.id), 30).score,
        rankOf: m => getBondProgress(bonds, String(m.id)).rank,
        warned,
    });
    for (const member of verdict.warn) {
        const line = describeWarning(member);
        warned.push(String(member.id));
        toastr.warning(line, `😠 ${member.name}`, { timeOut: 12000 });
        void postForModel(`[HARTO] ${line} Que lo diga con sus palabras, en una frase.`);
    }
    for (const member of verdict.leave) {
        const line = describeLeaving(member);
        // R8: se apunta, con su ficha, por si un día vuelve.
        if (chat_metadata) chat_metadata[GONE_KEY] = noteGone(chat_metadata[GONE_KEY], member, campaignDay(), 'harto');
        setPartyMembers(partyMembers.filter(m => m !== member));
        noteDeed(line);
        toastr.error(line, `👋 ${member.name}`, { timeOut: 15000 });
        void postForModel(`[SE VA] ${line} Cuenta la despedida en dos frases.`);
    }
    chat_metadata[WARNED_KEY] = warned;
    if (verdict.leave.length > 0) {
        savePartyState();
        renderPartyMembers();
    }
    saveMetadata();
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

/**
 * Idea 39: la moral del grupo, de sus vinculos, su hambre y sus heridas.
 *
 * @returns {{value: -1|0|1, label: string}}
 */
export function partyMorale() {
    const bonds = getCampaignBonds();
    return groupMorale({
        ranks: partyMembers.slice(1).map(m => getBondProgress(bonds, String(m.id)).rank),
        hungry: partyMembers.filter(m => /hambre|sed/i.test(describeNeeds(m))).length,
        wounded: partyMembers.filter(m => (Number(m.hp) || 0) / Math.max(1, Number(m.maxHp) || 1) < 0.5).length,
        size: partyMembers.length,
        mourning: partyMembers.filter(m => mourningFor(m, campaignDay())).length,
        // Idea 32: los roces de hoy también pesan.
        friction: frictionsOn(chat_metadata?.[APPROVAL_KEY], campaignDay()),
    });
}

/**
 * Idea 9: lo que pisa un enemigo al que empujan encima de algo (trampa, fuego).
 *
 * @param {any} enemy
 * @param {{x: number, y: number}} cell
 * @returns {string[]}
 */
function shovedInto(enemy, cell) {
    const board = getActiveBoardContext().board;
    if (!board || hazardsAt(board, cell.x, cell.y).length === 0) return [];
    const { fired, hazards } = enterCell(board, cell);
    board.hazards = hazards;
    persistBoardTerrain(board);
    /** @type {string[]} */
    const lines = [];
    for (const hazard of fired) {
        if (hazard.effect === 'damage' && hazard.damageDice) {
            const roll = rollWith(hazard.damageDice, nextRandom);
            enemy.currentHp = Math.max(0, (Number(enemy.currentHp) || 0) - roll.total);
            lines.push(`🔥 Cae encima de ${hazard.name.toLowerCase()}: ${roll.total} de daño.`);
            if (enemy.currentHp === 0) lines.push(`☠️ ${enemy.name} no se levanta.`);
        } else if (hazard.effect === 'condition' && hazard.condition) {
            applyTimedCondition(enemy, String(enemy.instanceId), hazard.condition, 2);
            lines.push(`🪤 ${hazard.name}: ${enemy.name} queda ${String(hazard.condition).toLowerCase()}.`);
        } else {
            lines.push(`🪤 ${describeHazard(hazard)}.`);
        }
    }
    return lines;
}


/**
 * Ideas 44 y 47: apuntar una hazaña, y contar si trae apodo o rasgo nuevo.
 *
 * @param {any} member
 * @param {'kill'|'crit'|'downed'|'rescue'|'hit'} kind
 * @param {string} [about]
 */
export function recordFeat(member, kind, about = '') {
    if (!member) return;
    member.feats = noteFeat(member, kind, about);
    if (kind === 'hit' && about && member.feats.hitsWith[about] === KNACK_AT) {
        const line = `${member.name} le ha cogido el tranquillo a ${about}: +1 al daño con ella.`;
        postCombatNarration(`🗡️ ${line}`);
        toastr.info(line, 'Soltura', { timeOut: 8000 });
        noteDeed(line);
    }
    if (kind === 'kill' && about && member.feats.killsBy[about] === TRAIT_AT) {
        const line = `${member.name} ya sabe cómo pelear contra ${about}: +1 al atacarle.`;
        postCombatNarration(`🎯 ${line}`);
        toastr.info(line, 'Rasgo nuevo', { timeOut: 8000 });
        noteDeed(line);
    }
    checkNickname(member);
}

/**
 * Si alguien se ha ganado un apodo, ponerselo y contarlo.
 *
 * @param {any} member
 */
function checkNickname(member) {
    const nickname = newNickname(member);
    if (nickname) {
        member.nickname = nickname.name;
        const line = `Desde hoy le llaman ${member.name} «${nickname.name}»: ${nickname.why}.`;
        postCombatNarration(`🏷️ ${line}`);
        toastr.success(line, 'Un apodo', { timeOut: 9000 });
        noteDeed(line);
        rememberTogether(line, [String(member.name)]);
    }
}


/** @returns {number} Los rumores que quedan por oir aqui. */
function rumorsLeftHere() {
    const heard = Array.isArray(chat_metadata?.[RUMORS_HEARD_KEY]) ? chat_metadata[RUMORS_HEARD_KEY] : [];
    return lastRumors.filter(r => r.where.toLowerCase() === String(currentLocationName).toLowerCase()
        && !heard.includes(r.id)).length;
}

/**
 * Empezar el hilo de una campana recien creada, contando la mecha.
 *
 * @returns {Promise<void>}
 */
export async function beginCampaignPlot(heroNote = '') {
    // J4.5: cómo empieza el grupo, para contar al final lo que se lleva cada uno.
    if (chat_metadata && !chat_metadata[CAMPAIGN_START_KEY]) {
        chat_metadata[CAMPAIGN_START_KEY] = partyAtStart(partyMembers, Math.max(1, campaignDay()));
        saveMetadata();
    }
    await ensurePlot({ announce: true, heroNote });
    // Idea 184: los hitos que no son para este héroe se cierran, en silencio.
    fitPlotToHero();
    // Al crear la campana, el arranque silencioso (el de las campanas viejas, al cambiar de
    // chat) puede haber ganado la carrera: entonces el hilo ya esta en marcha y la mecha no
    // se ha contado. Se cuenta ahora, una sola vez.
    const plot = getPlot();
    if (plot && chat_metadata && !chat_metadata[PLOT_ANNOUNCED_KEY]) {
        chat_metadata[PLOT_ANNOUNCED_KEY] = true;
        saveMetadata();
        const opening = startPlot(plot, Math.max(1, campaignDay()));
        const lines = opening.opened.filter(m => !m.hidden).map(m => m.scene).filter(Boolean);
        if (lines.length > 0 && heroNote) lines.push(heroLine(heroNote));
        if (lines.length > 0) {
            lines.push('Cuéntalo en uno o dos párrafos, en el tono de la campaña. No inventes nada que no esté aquí.');
            await postForModel(`[HILO] ${lines.join('\n')}`)
                .catch(error => console.error('[party] opening note failed', error));
        }
        await tellOmens(plot);
    }
}

/**
 * Idea 184: cerrar los hitos que el guion escribió para otros trasfondos. Una vez.
 */
function fitPlotToHero() {
    const plot = getPlot();
    if (!plot || !chat_metadata || chat_metadata[HERO_FIT_KEY] || !partyMembers[0]) return;
    const skip = notForHero(plot, partyMembers[0]);
    chat_metadata[HERO_FIT_KEY] = true;
    if (skip.length > 0) {
        const state = readPlotState(chat_metadata[PLOT_STATE_KEY]);
        chat_metadata[PLOT_STATE_KEY] = { ...state, open: state.open.filter(id => !skip.includes(id)), closed: [...new Set([...state.closed, ...skip])] };
    }
    saveMetadata();
}

/**
 * Idea 114: el presagio, al empezar. Al narrador, para que lo diga tal cual; y en el chat,
 * para quien juega. Una vez.
 *
 * @param {import('../game-engine/campaign/plot.js').Plot} plot
 * @returns {Promise<void>}
 */
async function tellOmens(plot) {
    if (!chat_metadata || chat_metadata.omensTold || (plot.omens ?? []).length === 0) return;
    chat_metadata.omensTold = true;
    saveMetadata();
    const said = plot.omens.map(o => `«${o.text}»`).join(' ');
    // Un solo mensaje: el narrador lee la nota, y quien juega lo ve una vez (antes salía
    // dos: la línea del hilo y la nota, que sin modelo también se veía).
    await postForModel(`[PRESAGIO] Alguien lo murmura, o se sueña. Dilo tal cual, sin explicarlo: ${said}`, { show: `🔮 [HILO] El presagio: ${said}` })
        .catch(error => console.error('[party] omens note failed', error));
}

/**
 * El bloque de lo que el mundo sabe del grupo, puesto al dia antes de cada turno.
 *
 * Vacio cuando no hay nada que contar: un bloque vacio no cuesta ni un token.
 */
export function refreshWorldMemoryPrompt() {
    const key = promptKey('quest', 'memory', 'ctx');
    const block = chat_metadata ? worldMemoryBlock({
        deeds: chat_metadata[DEEDS_KEY],
        factions: getCurrentWorldFactions(),
        debt: getDebt(),
        focus: describeFocus(focusOf(getPlot(), chat_metadata[PLOT_STATE_KEY], campaignDay())),
        today: Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1)),
        memories: memoryLines(chat_metadata[MEMORIES_KEY], Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1))),
        here: localMemory(),
        // Idea 148: en modo ahorro, lo justo.
        compact: saverOn(),
    }) : '';
    // Idea 149: el largo elegido en la partida manda sobre el de la ficha.
    setExtensionPrompt(promptKey('rules', 'length', 'ctx'), chat_metadata ? lengthNote(String(chat_metadata[LENGTH_KEY] ?? '')) : '',
        extension_prompt_types.IN_PROMPT, 0, false, extension_prompt_roles.SYSTEM);
    // Idea 143: lo que pasó en los actos cerrados. Idea 140: cómo os mira la gente de aquí.
    const acts = chat_metadata ? readSummaries(chat_metadata[ACT_SUMMARIES_KEY]).map(s => s.text) : [];
    const moods = chat_metadata ? Object.entries(readAttitudes(chat_metadata[ATTITUDES_KEY]).values)
        .filter(([name]) => lastWorldNpcs.some(n => n.name === name && n.where.toLowerCase() === String(currentLocationName).toLowerCase()))
        .map(([name, value]) => `${name} os mira de forma ${describeAttitude(value)}.`) : [];
    // R4: lo que el grupo sabe lanzar, y que no existe otra magia. Solo si alguien la hace.
    const magic = magicLine(partyMembers);
    // R9: lo último que pasó de verdad, de la crónica. En modo ahorro, no.
    const lately = saverOn() ? '' : chronicleMemory(chronicleOf(Array.isArray(chat) ? chat : []));
    const full = [block, acts.length > 0 ? `Lo que pasó antes: ${acts.join(' ')}` : '', moods.join(' '), lately, magic].filter(Boolean).join('\n');
    setExtensionPrompt(key, full, extension_prompt_types.IN_PROMPT, 0, false, extension_prompt_roles.SYSTEM);

    // C1: como esta el grupo. Va con lo que cambia en cada turno, al final del prompt. En
    // modo ahorro no va: es lo primero que se puede quitar sin que la historia lo note.
    const body = chat_metadata && !saverOn() ? bodyLine({
        party: partyMembers,
        day: Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1)),
        slot: getCurrentSlotLabel(),
        climate: String(chat_metadata[CLIMATE_KEY] || ''),
        place: currentLocationName,
    }) : '';
    setExtensionPrompt(promptKey('combat', 'body', 'ctx'), body, extension_prompt_types.IN_PROMPT, 0, false, extension_prompt_roles.SYSTEM);

    // Idea 142: el tono de la escena, una frase con lo que cambia en cada turno. Vacío si no
    // toca ninguno: un bloque vacío no cuesta nada.
    const tone = chat_metadata ? toneNote({ chosen: String(chat_metadata[TONE_KEY] || ''), fighting: combatEncounter.active }) : '';
    // Y con quién se está hablando: que conteste esa persona, no el narrador. Va con lo que
    // cambia en cada turno, al final.
    setExtensionPrompt(promptKey('combat', 'tone', 'ctx'), [tone, narratorTurn ? narratorAskNote() : speakingNote()].filter(Boolean).join('\n'),
        extension_prompt_types.IN_PROMPT, 0, false, extension_prompt_roles.SYSTEM);
}

/**
 * Con quién se está hablando ahora, si es alguien que puede contestar: alguien de aquí o de
 * tu grupo, y sin pelea en marcha.
 *
 * @returns {{name: string, npc: any|null}|null}
 */
function speakingWith() {
    const who = String(talkingTo || '').trim();
    if (!who || combatEncounter.active) return null;
    const npc = lastWorldNpcs.find(n => !n.dead && n.name === who && n.where.toLowerCase() === String(currentLocationName).toLowerCase()) ?? null;
    if (npc) return { name: npc.name, npc };
    const friend = partyMembers.slice(1).find(m => !m.dead && String(m.name) === who);
    return friend ? { name: String(friend.name), npc: null } : null;
}

/**
 * Qué se hace con lo que se escribe en la caja (Daniel, 2026-09-28: «el narrador ha de narrar
 * en momentos más importantes», y con el alguacil delante «¿qué pasa?» lo contestaba él).
 *
 * - Con el botón «Al narrador» puesto, va al narrador, fuera de la escena, y contesta él.
 * - Lo que el motor entiende (ir, entrar, descansar…) lo hace el motor, como antes.
 * - Lo demás va al modelo, y **contesta quien tienes delante**: a quien nombras, si está aquí,
 *   o quien te está plantando cara en el tablero. Desde ahí se está hablando con esa persona
 *   (sus respuestas sugeridas y «Despedirse»), hasta despedirse, irse o empezar la pelea.
 * - Si no hay nadie delante, contesta el narrador contando qué pasa.
 *
 * Una sola llamada por mensaje: cambia el estado del turno.
 *
 * @param {string} said
 * @returns {'engine'|'model'}
 */
export function routeTyped(said) {
    setNarratorTurn(askingNarrator);
    askingNarrator = false;
    showNarratorAsk();
    if (narratorTurn) return 'model';
    if (engineTakesBox(said)) return 'engine';
    if (!chat_metadata?.[METADATA_KEY] || speakingWith() || combatEncounter.active) return 'model';
    const intent = readBox(said, boxContext());
    if (intent.do !== 'unknown' && !(intent.do === 'check' && SOCIAL_SKILLS.includes(String(intent.skill)))) return 'model';
    const who = sceneAddressee({
        said,
        people: lastWorldNpcs.filter(n => !n.dead && n.where.toLowerCase() === String(currentLocationName).toLowerCase()).map(n => n.name),
        companions: partyMembers.slice(1).filter(m => !m.dead).map(m => String(m.name)),
        waiting: waitingHere(),
    });
    if (who) {
        setTalkingTo(who);
        notePlot({ kind: 'talk', npc: who });
        if (isShellOpen()) refreshGameShell();
    }
    return 'model';
}

/**
 * Z3 y Z6: si lo escrito lo hace el motor. Sin modelo, todo; en «Mixto», lo que la caja
 * entiende, salvo hablando con alguien o convenciéndole con tus palabras.
 *
 * @param {string} said
 * @returns {boolean}
 */
function engineTakesBox(said) {
    if (!chat_metadata?.[METADATA_KEY]) return false;
    const mode = narratorMode();
    if (mode === 'motor') return true;
    if (mode !== 'mixto' || speakingWith()) return false;
    const intent = readBox(said, boxContext());
    return intent.do !== 'unknown' && !(intent.do === 'check' && SOCIAL_SKILLS.includes(String(intent.skill)));
}

/**
 * El botón «Al narrador»: lo próximo que escribas es para él. Sin modelo no hay a quién
 * preguntar, así que abre lo mismo que «¿Qué hago?». Pulsarlo otra vez lo quita.
 *
 * @returns {void}
 */
function askNarrator() {
    if (narratorMode() === 'motor') {
        void openHelp();
        return;
    }
    askingNarrator = !askingNarrator;
    showNarratorAsk();
    const box = /** @type {HTMLTextAreaElement|null} */ (document.querySelector('#send_textarea'));
    box?.focus();
}

/**
 * Que se note que lo próximo va al narrador: la caja lo dice, y el botón queda encendido.
 *
 * @returns {void}
 */
function showNarratorAsk() {
    const box = /** @type {HTMLTextAreaElement|null} */ (document.querySelector('#send_textarea'));
    if (box) {
        if (askingNarrator && !box.dataset.placeholderBefore) box.dataset.placeholderBefore = box.placeholder;
        box.placeholder = askingNarrator ? 'Pregúntale al narrador, fuera de la escena…' : (box.dataset.placeholderBefore || box.placeholder);
        if (!askingNarrator) delete box.dataset.placeholderBefore;
        box.classList.toggle('gs-asking-narrator', askingNarrator);
    }
    document.querySelectorAll('#game-shell .gs-chip-narrator').forEach(b => b.classList.toggle('on', askingNarrator));
}

/**
 * Para el modelo: a quién le habla quien juega, con su oficio, su voz y cómo os mira.
 *
 * @returns {string}
 */
function speakingNote() {
    const with_ = speakingWith();
    if (!with_) return '';
    if (!with_.npc) return talkPromptNote({ name: with_.name, companion: true });
    return talkPromptNote({
        name: with_.name, trade: String(with_.npc.trade ?? ''), voice: String(with_.npc.voice ?? ''),
        attitudeWord: describeAttitude(attitudeTowards(with_.name)), confronting: confrontingNow(with_.name),
    });
}


/**
 * Si alguien os está plantando cara ahora: está entre los que esperan en el tablero para
 * pelear (el alguacil Torres, con sus guardias en la posada).
 *
 * @param {string} name
 * @returns {boolean}
 */
function confrontingNow(name) {
    return confronts(name, waitingHere());
}

/**
 * Cómo os mira alguien ahora mismo: lo apuntado, salvo que os esté plantando cara, que
 * entonces como mucho receloso (Daniel, 2026-09-28: Torres salía «neutral» reventando la puerta).
 *
 * @param {string} name
 * @returns {number}
 */
function attitudeTowards(name) {
    return effectiveAttitude(attitudeBonus(chat_metadata?.[ATTITUDES_KEY], name), confrontingNow(name));
}

/** @returns {import('../game-engine/campaign/patronage.js').Debt|null} */
export function getDebt() {
    return readDebt(chat_metadata?.[DEBT_KEY]);
}

/**
 * Alguien paga lo que falta de la semana, a cambio de un favor.
 *
 * @param {number} shortfall
 * @returns {boolean} Si ha pagado alguien.
 */
function takePatronage(shortfall) {
    if (!chat_metadata || getDebt()) return false;
    const today = Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1));
    const offer = offerPatronage({
        shortfall, factions: getCurrentWorldFactions(), here: currentLocationName, today,
    });
    if (!offer) return false;

    const holder = partyMembers.find(m => (Number(m.hp) || 0) > 0) ?? partyMembers[0];
    if (!holder) return false;
    holder.gold = (Number(holder.gold) || 0) + offer.debt.amount;

    chat_metadata[DEBT_KEY] = offer.debt;
    if (offer.contract) chat_metadata[BOARD_KEY] = [offer.contract, ...(chat_metadata[BOARD_KEY] ?? [])];
    saveMetadata();
    savePartyState();

    noteDeed(`${offer.debt.patronName} ${saysWith(offer.debt.patronName, 'pagó', 'pagaron')} vuestra cuenta de la semana.`);
    void postForModel(`🤝 [CAMPAÑA] ${offer.line}`);
    toastr.info(offer.line, 'Alguien paga por vosotros', { timeOut: 15000 });
    return true;
}

/**
 * Llega el dia y la deuda sigue ahi: vienen a cobrar.
 */
function settleDueDebt() {
    const debt = getDebt();
    if (!debt) return;
    const today = Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1));
    const due = debtDue({ debt, today, purse: partyPurse() });
    if (!due.due) return;

    payFromParty(due.take);
    if (due.debt) chat_metadata[DEBT_KEY] = due.debt;
    else delete chat_metadata[DEBT_KEY];
    // El favor sin hacer ya no esta en el tablon: ahora quieren oro.
    if (debt.contractId) {
        chat_metadata[BOARD_KEY] = (chat_metadata[BOARD_KEY] ?? [])
            .filter((/** @type {any} */ c) => String(c?.id) !== debt.contractId);
    }
    saveMetadata();
    savePartyState();

    if (due.standing && debt.patron) void shiftFactionStanding(debt.patron, due.standing);
    if (debt.contractId) noteDeed(`Dejasteis sin hacer el favor que debíais a ${debt.patronName}.`);
    void postForModel(`💸 [CAMPAÑA] ${due.line}`);
    toastr.warning(due.line, 'Vienen a cobrar', { timeOut: 15000 });
}

/**
 * Mover lo que una faccion piensa de vosotros, y guardarlo en el mundo.
 *
 * @param {string} factionId
 * @param {number} amount
 * @returns {Promise<void>}
 */
function shiftFactionStanding(factionId, amount) {
    return worldWrite(() => shiftFactionStandingNow(factionId, amount));
}

/**
 * @param {string} factionId
 * @param {number} amount
 * @returns {Promise<void>}
 */
async function shiftFactionStandingNow(factionId, amount) {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName) return;
    try {
        const data = await loadWorldInfo(worldName);
        if (!data?.metadata) return;
        const moved = changeStanding(readFactions(data.metadata.factions), factionId, amount);
        data.metadata.factions = moved;
        setCurrentWorldFactions(moved);
        await saveWorldInfo(worldName, data, true);
        await refreshWorldMapGlobals(worldName);
        if (isShellOpen()) refreshGameShell();
    } catch (error) {
        console.error('[party] no se pudo mover la reputacion', error);
    }
}

/** @returns {any} */
export function getCampaignCalendar() {
    return campaign.getCalendar();
}
/** @returns {any} */
export function getCampaignBonds() {
    return campaign.getBonds();
}
/** @param {any} calendar @param {any} bonds */
export function saveCampaignState(calendar, bonds) {
    return campaign.save(calendar, bonds);
}
// El reloj del Modo Juego lee lo mismo que la pestana de Campana, asi que pasar el
// tiempo tiene que redibujarlo: sin esto el dia cambiaba y la cabecera no se enteraba.
export function advanceCampaignSlot() {
    const result = campaign.advanceSlot();
    if (isShellOpen()) refreshGameShell();
    return result;
}
/** @type {any} */
let factionTickTimer = null;

function scheduleFactionTick() {
    if (factionTickTimer) clearTimeout(factionTickTimer);
    factionTickTimer = setTimeout(() => {
        const days = factionDaysDue;
        setFactionDaysDue(0);
        factionTickTimer = null;
        void passFactionDays(days);
    }, 0);
}

// U3 del pegamento: los días de las facciones los apunta la etapa `facciones` del paso del
// tiempo. Todas las formas de pasar el día (el turno que cierra la noche, un descanso largo,
// un viaje) pasan por `passTime` en `campaign-state.js`, así que ya no hace falta medir el
// calendario alrededor de cada una.

/** @returns {number} */
export function campaignDay() {
    return Math.max(0, Math.floor(Number(getCampaignCalendar()?.day) || 0));
}

export function advanceCampaignDay() {
    const result = campaign.advanceDay();
    if (isShellOpen()) refreshGameShell();
    return result;
}
/**
 * Los dias de las facciones, con lo que cambien.
 *
 * Aditivo como el compendio: una campana sin facciones no pierde nada, porque sin filas
 * esto no hace nada. Y lo que cambia se guarda en el mundo —no en el chat— porque las
 * rutas cerradas y los duenos de cada sitio **son** el mundo.
 *
 * @param {number} days
 * @returns {Promise<void>}
 */
function passFactionDays(days) {
    return worldWrite(() => passFactionDaysNow(days));
}

/**
 * @param {number} days
 * @returns {Promise<void>}
 */
async function passFactionDaysNow(days) {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName || days <= 0) return;

    try {
        const data = await loadWorldInfo(worldName);
        const before = readFactions(data?.metadata?.factions);
        if (before.length === 0) return;

        const { factions, events } = tickFactions({
            factions: before, days, here: currentLocationName,
        });
        // Idea 117: la meta de una faccion se nota antes de cumplirse.
        events.push(...clockWarnings(before, factions));

        // Lo que se cumple cambia la lista de sitios, que es lo que el viaje ya lee.
        let locations = Array.isArray(data.metadata.locationMaps) ? data.metadata.locationMaps : [];
        let people = factions;
        /** @type {string[]} */
        const changed = [];
        /** @type {Array<import('../game-engine/world/people-fate.js').Fate>} */
        const fates = [];
        for (const event of events.filter(e => e.kind === 'cumple')) {
            notePlot({ kind: 'clock', faction: String(event.faction) });
            const who = people.find(f => f.id === event.faction);
            if (!who) continue;
            const outcome = outcomeOf(who);
            const applied = applyOutcome({ locations, factions: people, outcome });
            // Idea 87: la gente de allí no sigue igual: alguno muere y otro se va.
            const fallen = outcome.kind === 'cae' ? people.find(f => f.id === outcome.other) : null;
            const place = outcome.kind === 'toma' ? String(outcome.place || '') : String(fallen?.seat || '');
            if (place) {
                fates.push(...fateAt({
                    npcs: lastWorldNpcs.filter(n => !n.dead),
                    place,
                    cause: outcome.kind === 'toma' ? `cuando ${who.name} lo tomó` : `cuando cayó ${fallen?.name ?? 'su gente'}`,
                    neighbours: neighboursOf(locations),
                    keep: plotPeople(),
                    random: createSeededRandom(derive(worldName, 'gente', place, String(campaignDay()))),
                }));
            }
            locations = applied.locations;
            people = applied.factions;
            changed.push(...applied.changed);
        }
        for (const fate of fates) {
            applyFate(data, fate);
            changed.push(describeFate(fate));
        }

        data.metadata.factions = people;
        data.metadata.locationMaps = locations;
        setCurrentWorldFactions(people);
        await saveWorldInfo(worldName, data, true);
        // Guardar escribe el archivo; el viaje va con la copia en memoria. Sin esto, un
        // paso que se cierra hoy se seguiria pudiendo andar hasta reabrir la campana.
        await refreshWorldMapGlobals(worldName);
        if (isShellOpen()) refreshGameShell();

        // Y solo se cuenta lo que llega hasta aqui: el motor mueve a todos, pero lo que
        // pasa en la otra punta del mundo se sabra al llegar.
        const news = newsFor({ events, here: currentLocationName, locations, factions: people });
        // Lo que no se oye desde aqui se guarda: se contara al llegar a donde se oiga.
        if (chat_metadata) {
            const today = Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1));
            chat_metadata[NEWS_KEY] = queueNews(chat_metadata[NEWS_KEY], events, news, today);
            saveMetadata();
        }
        if (news.length === 0) return;

        for (const line of news) toastr.info(line, 'Se sabe algo', { timeOut: 8000 });
        const note = [
            ...news,
            ...changed,
            'Cuéntalo como un rumor que llega, en una o dos frases. No inventes nada que no esté aquí.',
        ].join('\n');
        postForModel(note).catch(error => console.error('[party] faction news failed', error));
    } catch (error) {
        // Que el mundo no avance no puede romper la partida: es lo que hay encima, no debajo.
        console.error('[party] faction tick failed', error);
    }
}

/** @param {string} characterId @param {string} eventType */
export function recordCampaignBondEvent(characterId, eventType) {
    const result = campaign.recordBond(characterId, eventType);
    // Idea 30: quien llega a vínculo 3 te pide lo suyo.
    offerPersonalQuests();
    if (isShellOpen()) refreshGameShell();
    return result;
}

/**
 * Idea 30: quien llega a vínculo 3 te pide lo suyo. Va al tablón, con su nombre, y se le
 * ofrece una sola vez.
 */
export function offerPersonalQuests() {
    if (!chat_metadata || !chat_metadata[METADATA_KEY]) return;
    const bonds = getCampaignBonds();
    const asked = Array.isArray(chat_metadata[PERSONAL_ASKED_KEY]) ? chat_metadata[PERSONAL_ASKED_KEY].map(String) : [];
    const due = duePersonalQuests({ party: partyMembers, rankOf: m => getBondProgress(bonds, String(m.id)).rank, asked });
    if (due.length === 0) return;
    const places = getCurrentWorldLocationMaps().map((/** @type {any} */ l) => String(l?.name || '')).filter(Boolean);
    // Sin los sitios del mundo cargados todavía, se espera: un encargo en ninguna parte
    // mandaría al grupo a un sitio inventado.
    if (places.length === 0) return;
    const board = Array.isArray(chat_metadata[BOARD_KEY]) ? chat_metadata[BOARD_KEY] : [];
    const bestiary = getCurrentWorldEnemies().map((/** @type {any} */ e) => String(e?.name || '')).filter(Boolean);
    for (const member of due) {
        const reasons = readReasons(member);
        const random = createSeededRandom(derive(String(chat_metadata[METADATA_KEY] || ''), 'personal', String(member.id)));
        const quest = personalQuestFor({
            member, wants: reasons.wants, hates: reasons.hates, places, here: currentLocationName, bestiary, random, day: campaignDay(),
        });
        board.unshift(quest);
        asked.push(String(member.id));
        const said = describePersonalAsk(member, quest);
        toastr.info(said, `🤝 ${member.name}`, { timeOut: 10000 });
        postCombatNarration(`🤝 [GRUPO] ${said}`);
        void postForModel(`[ENCARGO PERSONAL] ${member.name} le pide al grupo algo suyo: ${quest.title}. Que lo pida con sus palabras, en una o dos frases.`);
    }
    chat_metadata[BOARD_KEY] = board;
    chat_metadata[PERSONAL_ASKED_KEY] = asked;
    saveMetadata();
}
function getCurrentSlotLabel() {
    return campaign.getSlotLabel();
}
/** @param {'corto'|'largo'} kind @returns {Promise<string>} */
async function takeRest(kind) {
    const result = await campaign.rest(kind);
    // Z4: de noche pasan cosas.
    if (kind === 'largo') playSucesos('descanso');
    // Idea 41: con un sanador en el grupo, un descanso corto cura algo mas.
    const healer = kind === 'corto' ? withJob(partyMembers, 'sanador') : null;
    if (healer) {
        for (const member of partyMembers.filter(m => (Number(m.hp) || 0) > 0)) {
            member.hp = Math.min(Number(member.maxHp) || 1, (Number(member.hp) || 0) + rollDiceDetailed('1d6', 6).total);
        }
        savePartyState();
        postCombatNarration(`🩹 [CAMPAÑA] ${healer.name} cura heridas mientras descansáis.`);
    }
    if (isShellOpen()) refreshGameShell();
    return result;
}
export function getCampaignMap() {
    return campaign.getMap();
}
/** @param {string} locationName */
export function markLocationComplete(locationName) {
    return campaign.markLocationComplete(locationName);
}


/**
 * El golpe definitivo del vinculo de rango 10.
 *
 * Impacta sin tirar, lo que es mucho que conceder: por eso cuesta un dia entero y diez
 * rangos de un vinculo que solo suben los hechos registrados. El dano lo decide el modulo
 * puro; aqui solo se aplica, se gasta y se cuenta.
 *
 * @param {string} rawTargetName
 * @returns {string}
 */
function resolveUltimateStrike(rawTargetName) {
    const entry = getCurrentTurnEntry();
    const member = getCurrentActingMember();
    if (!combatEncounter.active || !entry || entry.isEnemy || !member) {
        toastr.warning('No hay un turno de jugador activo.');
        return '';
    }

    const target = getAttackableEnemiesForMember(member)
        .find(enemy => enemy.name.toLowerCase() === String(rawTargetName).trim().toLowerCase());
    if (!target) {
        toastr.warning(`"${rawTargetName}" no esta a tu alcance.`);
        return '';
    }

    const plan = planUltimate({
        bonds: getCampaignBonds(),
        party: partyMembers,
        actorId: String(member.id),
        targetId: String(target.instanceId),
    });

    if (!plan) {
        toastr.info('El golpe definitivo pide un vinculo de rango 10 y no haberlo usado hoy.');
        return '';
    }

    target.currentHp = Math.max(0, (Number(target.currentHp) || 0) - plan.damage);
    combatEncounter.tally = noteDealt(combatEncounter.tally, plan.actorId, plan.damage, target.currentHp === 0);
    saveCampaignState(null, spendPerk(getCampaignBonds(), plan.actorId, 'ultimate'));
    saveCombatState();

    pushCombatLogEntry(lineToEntry(`${plan.reason} ${plan.damage} de dano a ${target.name}.`));
    postCombatNarration(`✨ [COMBAT] ${plan.actorName} usa su golpe definitivo contra ${target.name}: ${plan.damage} de dano.`);

    if (target.currentHp <= 0) {
        postCombatNarration(`☠️ [COMBAT] ${target.name} cae.`);
        checkScenarioOutcome();
    }

    renderLocationMapsPreview();
    return `${plan.damage}`;
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
function recordContradictions(messageId) {
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

/** Draws the campaign tab, if it is the one on screen. */
export function renderCampaignTab() {
    const container = $('#campaign_panel_row');
    if (container.length === 0) return;

    const today = Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1));
    const due = Number(chat_metadata?.[BILL_DUE_KEY]);

    renderCampaignPanel(container, {
        calendar: getCampaignCalendar(),
        bonds: getCampaignBonds(),
        party: partyMembers,
        // Sin nadie en el grupo no hay cuenta que pasar, y un panel de ceros estorba.
        // R1: sin la cuenta (letra b) no hay cuenta que enseñar.
        bill: partyMembers.length > 0 && hasLetter(survivalNow(), 'b') ? weeklyBill(partyMembers, { rules: currentUpkeepRules() }) : null,
        daysToBill: Number.isFinite(due) ? Math.max(0, due - today) : 0,
        // Una cuenta que sube sin decir por que es un impuesto; una que dice «han cerrado
        // el paso del norte» es una razon para ir a abrirlo.
        market: describeMarket(currentMarket()),
        // Como esta cada uno: solo aparece quien tiene algo que contar.
        needs: hasLetter(survivalNow(), 'd') ? partyMembers
            .map(member => ({ name: member.name, said: describeNeeds(member) }))
            .filter(entry => entry.said) : [],
        // Lo que se mueve ahi fuera sin ti. Sin facciones escritas, la lista sale vacia
        // y el panel queda como estaba.
        world: hasLetter(survivalNow(), 'c') ? describeWorldFactions() : [],
        onAdvanceSlot: advanceCampaignSlot,
        onAdvanceDay: advanceCampaignDay,
        onShortRest: () => { void takeRest('corto'); },
        onLongRest: () => { void takeRest('largo'); },
        onRecordEvent: recordCampaignBondEvent,
    });
}

/**
 * Resolves the free attack the rank-3 bond perk grants.
 *
 * A real attack: it rolls to hit against the same armour class, it can miss, and it goes
 * through the log like any other. A free hit that always lands is not a perk, it is a
 * cheat, and the engine's whole claim is that any result can be audited.
 *
 * It costs the companion nothing — no action, no movement — because the perk is the
 * reward for the bond, not a second turn.
 *
 * @param {string} actorId
 * @param {import('../dnd-system.js').EnemyInstance} target
 */
/**
 * R3 del roadmap de profundidad: a una. Quien tiene el turno ataca con ventaja (su compañero
 * le abre la guardia) y el compañero ataca detrás, también con ventaja, gastando su reacción.
 *
 * @param {any} member
 * @param {string} partnerId
 * @param {any} enemy
 */
function resolvePairStrike(member, partnerId, enemy) {
    const partner = partyMembers.find(m => String(m.id) === String(partnerId));
    if (!partner || !combatEncounter.active) return;
    usedReactions.add(`party:${partner.id}`);
    postCombatNarration(`[COMBAT] ${pairLine(String(member.name), String(partner.name), String(enemy.name))}`);
    combatEncounter.maneuvers = recordManeuver(combatEncounter.maneuvers, 'ayudar', String(partner.id), String(enemy.instanceId));
    handlePlayerCombatAttack(String(enemy.name));
    if ((Number(enemy.currentHp) || 0) > 0 && combatEncounter.active) {
        resolveFollowUpAttack(String(partner.id), enemy, `va a una con ${member.name} contra`, 'advantage');
    }
}

export function resolveFollowUpAttack(actorId, target, how = 'ataca de seguimiento a', mode = /** @type {'advantage'|'disadvantage'|'normal'} */ ('normal')) {
    const ally = partyMembers.find(m => String(m.id) === String(actorId));
    if (!ally || (target.currentHp || 0) <= 0) return;

    const rangeFeet = getAttackRangeFeet(ally);
    const attackMod = getPlayerAttackModifier(ally, rangeFeet);
    // R3: la jugada en pareja va con ventaja.
    const edged = rollWithEdge(() => rollDiceDetailed('1d20', 20).total, mode);
    const attackRoll = { total: edged.natural, natural: edged.natural };
    const attackTotal = attackRoll.total + attackMod;
    const { ac: targetAc, cover } = getTargetArmorClass(target, ally);
    const isCrit = attackRoll.natural === 20;
    const isHit = isCrit || attackTotal >= targetAc;

    showCombatDiceRoll({
        title: `${ally.name}: ataque de seguimiento`,
        subtitle: `Objetivo: ${target.name}`,
        formula: `1d20${attackMod >= 0 ? '+' : ''}${attackMod}`,
        detail: `d20(${attackRoll.total}) ${attackMod >= 0 ? '+' : ''}${attackMod} = ${attackTotal}`,
        total: attackTotal,
        dc: targetAc,
        natural: attackRoll.natural,
        glyph: 'd20',
    });

    const lines = [];
    lines.push(`🤝 ${ally.name} ${how} ${target.name}.`);
    lines.push(attackLine({ who: ally.name, at: target.name, total: attackTotal, ac: targetAc, hit: isHit, natural: attackRoll.total, modifier: attackMod, cover }));

    if (!isHit) {
        lines.push('❌ Resultado: fallo.');
        saveCombatState();
        postCombatNarration(lines.join('\n'));
        return;
    }

    const damageFormula = getPlayerDamageFormula(ally, rangeFeet);
    const damageRoll = rollDiceDetailed(damageFormula, 8);
    const critRoll = isCrit ? rollDiceDetailed(damageFormula, 8) : null;
    const damageMod = Math.max(0, getPlayerAttackModifier(ally, rangeFeet));
    const totalDamage = Math.max(1, damageRoll.total + (critRoll?.total || 0) + damageMod);

    target.currentHp = Math.max(0, (target.currentHp || 0) - totalDamage);
    combatEncounter.tally = noteDealt(combatEncounter.tally, ally.id, totalDamage, target.currentHp === 0);
    floatOnToken(enemyTokenId(target), `-${totalDamage}`, 'damage');
    if (target.currentHp === 0) recordFeat(ally, 'kill', String(target.name));
    lines.push(`✅ Resultado: impacto${isCrit ? ' critico' : ''}.`);
    lines.push(damageLine({ total: totalDamage, formula: damageFormula, rolled: damageRoll.total, modifier: damageMod }));
    lines.push(`❤️ Estado de ${target.name}: ${target.currentHp}/${target.maxHp}`);

    if (target.currentHp === 0) lines.push(`☠️ ${target.name} cae derrotado.`);

    saveCombatState();
    postCombatNarration(lines.join('\n'));

    if (getAliveEnemies().length === 0) {
        postCombatNarration('🏆 [COMBAT] Todos los enemigos han sido derrotados.');
        endCombat('victory');
    }
}

/**
 * Offers the rank-5 relay after a kill.
 *
 * An offer rather than an event: passing your leftover movement is a decision, and the
 * engine deciding it for you would take away the only interesting part.
 *
 * @param {PartyMember} actor
 */
function offerBatonPass(actor) {
    const remainingFeet = getRemainingMovementFeet(actor);
    const candidates = planBatonPass({
        bonds: getCampaignBonds(),
        party: partyMembers,
        actorId: String(actor.id),
        remainingFeet,
    });

    if (candidates.length === 0) return;

    const names = candidates.map(c => c.name).join(', ');
    postCombatNarration(
        `🔄 [COMBAT] ${actor.name} puede ceder ${remainingFeet} ft de movimiento a: ${names}.`,
    );

    // Y con un boton, porque decirle a alguien que escriba un comando en mitad de un
    // combate es pedirle que deje el raton.
    showBatonPassOffer(actor, candidates, remainingFeet);
}

/**
 * Cede el movimiento que queda al companero que se nombre.
 *
 * Lo mismo que hace /relevo, porque es lo que usa /relevo: el boton y el comando
 * no pueden divergir si solo hay un sitio donde esta escrito.
 *
 * @param {string} wantedName
 * @returns {string} el nombre de quien recibe el relevo, o '' si no se pudo
 */
function handleBatonPass(wantedName) {
    const actor = getCurrentActingMember();
    if (!actor) {
        toastr.warning('No hay un turno de jugador activo.');
        return '';
    }

    const remainingFeet = getRemainingMovementFeet(actor);
    const candidates = planBatonPass({
        bonds: getCampaignBonds(),
        party: partyMembers,
        actorId: String(actor.id),
        remainingFeet,
    });

    if (candidates.length === 0) {
        toastr.warning('No puedes ceder movimiento ahora mismo.');
        return '';
    }

    const wanted = String(wantedName ?? '').trim().toLowerCase();
    const chosen = candidates.find(c => c.name.toLowerCase() === wanted);
    if (!chosen) {
        toastr.warning(`Puedes cederlo a: ${candidates.map(c => c.name).join(', ')}.`);
        return '';
    }

    // Spent for the day, and the turn moves to whoever received it: that is what
    // makes the relay a tactical choice and not free movement for everyone.
    saveCampaignState(null, spendPerk(getCampaignBonds(), String(actor.id), 'baton_pass'));

    const index = combatEncounter.turnOrder.findIndex(e => !e.isEnemy && String(e.id) === chosen.id);
    if (index >= 0) {
        combatEncounter.currentTurnIndex = index;
        resetCombatTurnState(combatEncounter.turnOrder[index]);
    }

    postCombatNarration(`🔄 [COMBAT] ${actor.name} cede el relevo a ${chosen.name}.`);
    renderLocationMapsPreview();
    return chosen.name;
}

/**
 * El relevo, como botones sobre los companeros a los que puedes cedersele.
 *
 * Aparece solo, al derrotar a alguien, y se va solo si no lo usas: es una oportunidad,
 * no una decision pendiente que bloquee el turno.
 *
 * @param {any} actor
 * @param {Array<{id: string, name: string}>} candidates
 * @param {number} remainingFeet
 */
function showBatonPassOffer(actor, candidates, remainingFeet) {
    $('.bp-offer').remove();

    const root = $('<div class="bp-offer"></div>');
    root.append($('<div class="bp-title"></div>').text(
        `${actor.name} puede ceder ${remainingFeet} ft`));

    for (const candidate of candidates) {
        const button = $('<button class="menu_button bp-btn" type="button"></button>');
        button.append('<i class="fa-solid fa-rotate"></i>');
        button.append($('<span></span>').text(` ${candidate.name}`));
        button.on('click', () => {
            root.remove();
            handleBatonPass(candidate.name);
        });
        root.append(button);
    }

    const skip = $('<button class="menu_button bp-btn bp-skip" type="button"></button>').text('No');
    skip.on('click', () => root.remove());
    root.append(skip);

    $('body').append(root);
    // Una oferta que no se toma se retira sola: el combate sigue.
    setTimeout(() => root.remove(), 20000);
}


/**
 * El boton de empezar el combate que el tablero ya tiene dibujado.
 *
 * Un libro de mazmorras coloca a sus monstruos en el mapa; hasta ahora, para pelear con
 * ellos habia que escribir `/fight` con su nombre y su cuenta, y el tablero ya sabia
 * ambas cosas. Solo cuenta lo que esta en una sala revelada: lo que duerme tras una
 * puerta cerrada sigue durmiendo.
 *
 * @param {any} board
 * @param {Array<{name: string, x: number, y: number}>} awake
 * @returns {JQuery<HTMLElement>}
 */
function buildStartCombatButton(board, awake) {
    const row = $('<div class="sc-row"></div>');
    row.append($('<div class="sc-what"></div>').text(`En el tablero: ${waitingSummary(awake)}`));

    const button = $('<button class="menu_button sc-btn" type="button"></button>');
    button.append('<i class="fa-solid fa-swords"></i>');
    button.append($('<span></span>').text(' Iniciar combate'));
    button.on('click', () => startWaitingFight(awake));
    row.append(button);
    return row;
}


/**
 * Los que el grupo ve esperando en el tablero abierto, tal y como los dibujó el último
 * repintado (con niebla y salas ya contadas). La ficha de «Iniciar combate» sale de aquí:
 * en la escena de diálogo el botón del tablero no se ve, y quien empezaba en la bodega del
 * gremio no tenía cómo pelear.
 *
 * @type {{board: string, placements: Array<{name: string, x: number, y: number}>}}
 */
let lastWaiting = { board: '', placements: [] };


/**
 * Idea 108: la tarjeta de «Anteriormente…». No tapa nada (no se puede pulsar) y se va sola.
 */
function showRecap() {
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


/**
 * Build token data from combat encounter enemies.
 * @returns {import('../world-map-renderer.js').TokenData[]}
 */
function buildEnemyTokens() {
    if (!combatEncounter.active) return [];
    /** @type {import('../world-map-renderer.js').TokenData[]} */
    const result = [];
    combatEncounter.enemies.forEach((e, idx) => {
        result.push({
            id: -(idx + 1),
            name: e.name,
            avatar: e.avatar,
            gridX: e.gridX || 0,
            gridY: e.gridY || 0,
            hp: e.currentHp,
            maxHp: e.maxHp,
            isEnemy: true,
            // Idea 13: que se lea el tablero de un vistazo.
            role: roleOf(e),
            statuses: statusMarkers(e.activeConditions),
            sizeCells: sizeToCells(e.size),
        });
    });
    return result;
}

/**
 * Build token data from board NPC placements.
 * @param {{npcPlacements: Array<any>}} board
 * @returns {import('../world-map-renderer.js').TokenData[]}
 */
function buildBoardNPCTokens(board) {
    if (!board?.npcPlacements || !Array.isArray(board.npcPlacements)) return [];
    const worldNPCs = getCurrentWorldNPCs();
    /** @type {import('../world-map-renderer.js').TokenData[]} */
    const result = [];
    board.npcPlacements.forEach((placement, /** @type {any} */ idx) => {
        const npc = worldNPCs.find(/** @type {any} */ (n) => n.id === placement.npcId);
        if (!npc) return;
        result.push({
            id: -(1000 + idx),
            name: npc.name,
            avatar: npc.avatar,
            gridX: placement.gridX || 0,
            gridY: placement.gridY || 0,
            hp: npc.hp,
            maxHp: npc.maxHp,
            isNPC: true,
        });
    });
    return result;
}

/**
 * @param {number} tokenId - Negative token ID
 * @param {number} gridX
 * @param {number} gridY
 */
function handleEnemyTokenMove(tokenId, gridX, gridY) {
    const idx = (-tokenId) - 1;
    if (idx >= 0 && idx < combatEncounter.enemies.length) {
        combatEncounter.enemies[idx].gridX = gridX;
        combatEncounter.enemies[idx].gridY = gridY;
        saveCombatState();
    }
}


/**
 * Build token data from party members for a specific location.
 * @param {string} [locationFilter] - Only include members at this location (empty = all)
 * @returns {import('../world-map-renderer.js').TokenData[]}
 */
function buildTokens(locationFilter) {
    /** @type {import('../world-map-renderer.js').TokenData[]} */
    const result = [];
    // Los muertos no andan por el tablero: están en su tumba (idea 36).
    for (const m of partyMembers.filter(member => !member.dead)) {
        // B2: quien salió por una salida ya no está en este tablero mientras dure la pelea.
        if (combatEncounter.active && hasLeft(combatEncounter.left, m.id)) continue;
        const pos = m.mapPosition || { locationName: '', gridX: 0, gridY: 0 };
        if (locationFilter && pos.locationName !== locationFilter) continue;
        result.push({
            id: m.id,
            name: m.name,
            avatar: m.avatar,
            gridX: pos.gridX || 0,
            gridY: pos.gridY || 0,
            level: m.level,
            className: m.class,
            weapon: String(heldWeapon(m)?.name ?? ''),
            hp: m.hp,
            maxHp: m.maxHp,
            // Drawn over the token, so what is wrong with a character is visible on the
            // board and not only on the sheet.
            statuses: statusMarkers(m.activeConditions ?? m.conditions),
            sizeCells: sizeToCells(m.size),
        });
    }
    return result;
}

/**
 * Handle token move: update party member's mapPosition and save.
 * @param {number} tokenId
 * @param {number} gridX
 * @param {number} gridY
 * @param {string} [locationName]
 */
function handleTokenMove(tokenId, gridX, gridY, locationName) {
    const member = partyMembers.find(m => m.id === tokenId);
    if (!member) return;

    // Dentro de un tablero, andar tiene reglas: hace falta camino, hay un alcance y quien
    // esta atado no se mueve. Fuera —en el mapa de la localidad, que es un plano y no una
    // rejilla de combate— colocarse sigue siendo libre.
    if (currentBoardName) {
        const { terrain, gridWidth, gridHeight } = getActiveBoardContext();
        const plan = planWalk({
            member,
            to: { x: gridX, y: gridY },
            terrain,
            gridWidth,
            gridHeight,
            occupied: partyMembers
                .filter(m => Number(m.id) !== Number(member.id))
                .map(m => ({ x: Number(m.mapPosition?.gridX) || 0, y: Number(m.mapPosition?.gridY) || 0 })),
        });

        if (!plan.allowed) {
            toastr.warning(plan.reason, 'Ahi no se llega');
            renderLocationMapsPreview();
            return;
        }
    }

    member.mapPosition = member.mapPosition || { locationName: '', gridX: 0, gridY: 0 };
    member.mapPosition.gridX = gridX;
    member.mapPosition.gridY = gridY;
    if (locationName) member.mapPosition.locationName = locationName;
    savePartyState();
}

/**
 * La tarjeta de objetivo: lo que sale al pulsar un enemigo.
 *
 * La regla de toda la capa de clics: **un clic nunca gasta nada, un boton si**. Atacar
 * es irreversible y consume la accion del turno, asi que pulsar al enemigo solo abre
 * esto. Y cuando algo no se puede hacer, la tarjeta dice por que en vez de no responder.
 *
 * @param {any} member Quien actua.
 * @param {any} enemy
 */
function openTargetCard(member, enemy) {
    closeTargetCard();

    const origin = member.mapPosition || { gridX: 0, gridY: 0 };
    const distanceFeet = getDistanceInFeet(
        origin.gridX || 0, origin.gridY || 0, enemy.gridX || 0, enemy.gridY || 0,
    );
    const { ac, cover } = getTargetArmorClass(enemy, member);

    // Idea 2: lo que va a pasar si ataca, con las mismas cuentas que la tirada.
    const forecastRange = getAttackRangeFeet(member);
    const forecastEdge = attackEdge({
        targetId: String(enemy.instanceId),
        height: heightFor(partyCell(member), { x: Number(enemy.gridX) || 0, y: Number(enemy.gridY) || 0 }),
        targetConditions: enemy.activeConditions ?? [],
        attackerConditions: member.activeConditions ?? [],
        distanceFeet,
        maneuvers: combatEncounter.maneuvers,
        byParty: true,
        flanked: partyFlanks(member, enemy),
        attackerId: String(member.id),
        hindered: visibilityPenalties(boardVisibility(), distanceFeet),
    });
    const forecast = describeForecast({
        attackMod: getPlayerAttackModifier(member, forecastRange) + traitBonus(member, enemy.name) + perkBonus(member, 'attack') + weaponBonus(member),
        armorClass: ac,
        mode: forecastEdge.mode,
        reasons: forecastEdge.reasons,
        formula: getPlayerDamageFormula(member, forecastRange),
        damageBonus: Math.max(0, getPlayerAttackModifier(member, forecastRange)),
        targetHp: Number(enemy.currentHp) || 0,
    });
    const intent = planFor(enemy);
    const intentTarget = partyMembers.find(m => String(m.id) === String(intent.targetId ?? intent.focusId ?? ''));

    // Las que este personaje se sabe y van sobre un enemigo, cada una con su veredicto:
    // un conjuro de 120 ft no esta "fuera de alcance" porque la espada llegue a 5.
    const usable = knownAbilities(member, getAbilityCatalogue())
        .filter(ability => ability.target === 'enemy' && ability.combat !== false)
        .map(ability => {
            const verdict = canUseAbility({
                member,
                ability,
                distanceFeet,
                hasAction: hasAction(combatEncounter, 'action'),
                hasBonus: hasAction(combatEncounter, 'bonus'),
                targetAlive: (Number(enemy.currentHp) || 0) > 0,
                carried: carriedNames(),
            });
            const left = usesLeft(member, ability);
            return {
                id: ability.id,
                label: Number.isFinite(left) ? `${ability.name} (${left})` : ability.name,
                enabled: verdict.ok,
                reason: verdict.ok ? describeAbility(ability) : verdict.reason,
            };
        });

    const card = buildTargetCard({
        actor: member,
        target: enemy,
        distanceFeet,
        rangeFeet: getAttackRangeFeet(member),
        cover,
        abilities: usable,
        hasAction: hasAction(combatEncounter, 'action'),
        canUltimate: Boolean(planUltimate({
            bonds: getCampaignBonds(),
            party: partyMembers,
            actorId: String(member.id),
            targetId: String(enemy.instanceId),
        })),
    });

    const root = $('<div class="tc-card"></div>');
    root.append($('<div class="tc-name"></div>').text(card.name));
    root.append($('<div class="tc-stats"></div>').text(describeTargetCard(card)));
    if (card.inRange) root.append($('<div class="tc-forecast"></div>').text(forecast.text));
    if (intentTarget) root.append($('<div class="tc-intent"></div>').text(`Va a por ${intentTarget.name}.`));
    // R3: lo que alcanzaría cada habilidad de área, antes de usarla. Colocarse importa.
    for (const ability of knownAbilities(member, getAbilityCatalogue()).filter(a => a.target === 'enemy' && isArea(a.area))) {
        const { victims } = abilityVictims(member, 'party', ability, enemy);
        const own = victims.filter(v => v.kind === 'party');
        root.append($('<div class="tc-area"></div>').toggleClass('tc-area-risk', own.length > 0).text(
            `${ability.name} alcanzaría a ${victims.map(v => v.ref.name).join(', ') || 'nadie'}${own.length > 0 ? ` (¡${own.length === 1 ? 'uno es de los tuyos' : `${own.length} son de los tuyos`}!)` : ''}.`,
        ));
    }

    const bar = $('<div class="tc-hp"></div>');
    const pct = card.maxHp > 0 ? Math.round((card.hp / card.maxHp) * 100) : 0;
    bar.append($('<div class="tc-hp-fill"></div>').css('width', `${pct}%`));
    root.append(bar);

    const actions = $('<div class="tc-actions"></div>');
    for (const action of card.actions) {
        const button = $('<button class="menu_button tc-btn" type="button"></button>').text(action.label);
        button.prop('disabled', !action.enabled);
        if (!action.enabled) button.attr('title', action.reason);
        button.on('click', () => {
            closeTargetCard();
            if (action.id === 'attack') {
                handlePlayerCombatAttack(enemy.name);
            } else if (action.id.startsWith('ability:')) {
                const ability = getAbilityCatalogue().find(a => a.id === action.id.slice('ability:'.length));
                if (ability) useAbility(member, ability, enemy);
            } else {
                resolveUltimateStrike(enemy.name);
            }
        });
        actions.append(button);
    }

    // R3: a una con quien tiene vínculo, si los dos están pegados a este enemigo.
    const heroId = String(partyMembers[0]?.id ?? '');
    const bonds = getCampaignBonds();
    const fighters = partyMembers.filter(m => !m.dead).map(m => ({
        id: String(m.id), name: String(m.name), ...boardCellOf(m), hp: Number(m.hp) || 0,
        rank: getBondProgress(bonds, String(m.id)).rank, reactionUsed: usedReactions.has(`party:${m.id}`),
    }));
    const me = fighters.find(f => f.id === String(member.id));
    const pairs = me && hasAction(combatEncounter, 'action')
        ? pairOptions({ actor: me, heroId, party: fighters, enemies: [{ id: String(enemy.instanceId), name: String(enemy.name), ...boardCellOf(enemy), hp: Number(enemy.currentHp) || 0 }] })
        : [];
    for (const pair of pairs) {
        const button = $('<button class="menu_button tc-btn tc-pair" type="button"></button>').text(`A una con ${pair.partnerName}`);
        button.attr('title', 'Los dos atacáis, con ventaja. Gasta tu acción y su reacción.');
        button.on('click', () => {
            closeTargetCard();
            resolvePairStrike(member, pair.partnerId, enemy);
        });
        actions.append(button);
    }

    // R5: la mascota, una vez por ronda, sin gastar la acción de nadie.
    const pet = currentPet();
    if (pet && Number(/** @type {any} */ (combatEncounter).petRound) !== (Number(combatEncounter.round) || 1)) {
        for (const help of supportActions(pet)) {
            const button = $('<button class="menu_button tc-btn tc-pet" type="button"></button>').attr('data-pet', help.id).text(`${pet.name}: ${help.label.toLowerCase()}`);
            button.attr('title', help.note);
            button.on('click', () => {
                closeTargetCard();
                petSupport(help.id, enemy);
            });
            actions.append(button);
        }
    }

    const close = $('<button class="menu_button tc-btn tc-close" type="button"></button>').text('Cerrar');
    close.on('click', () => closeTargetCard());
    actions.append(close);
    root.append(actions);

    // Lo que impide actuar se dice, no se deja adivinar.
    const blocked = card.actions.filter(a => !a.enabled).map(a => a.reason);
    if (blocked.length === card.actions.length) {
        root.append($('<div class="tc-why"></div>').text(blocked[0]));
    }

    $('body').append($('<div class="tc-overlay"></div>').on('click', () => closeTargetCard()).append(root));
}

/** Cierra la tarjeta, si hay alguna. */
function closeTargetCard() {
    $('.tc-overlay').remove();
}

/**
 * La ruta hasta una casilla y lo que cuesta llegar, para ensenarla antes de pulsar.
 *
 * La calcula el mismo A* que usa la IA enemiga: una linea dibujada a ojo diria una cosa y
 * el movimiento haria otra, que es peor que no dibujar nada.
 *
 * @param {number} gridX
 * @param {number} gridY
 * @returns {{cells: Array<{gridX: number, gridY: number}>, feet: number, ok: boolean, provokes: string[]}|null}
 */
function previewMovement(gridX, gridY) {
    const member = getCurrentActingMember();
    if (!combatEncounter.active || !member) return null;

    const origin = member.mapPosition || { gridX: 0, gridY: 0 };
    const { terrain, gridWidth: w, gridHeight: h } = getActiveBoardContext();
    const path = findPath(terrain, origin.gridX || 0, origin.gridY || 0, gridX, gridY, w, h, {
        // Las casillas ocupadas no se atraviesan, igual que al mover de verdad.
        occupied: occupiedCellsFor(member),
    });
    if (!path || path.length === 0) return null;

    const feet = getPathCost(terrain, path) * 5;
    // Idea 1: quien te golpearia al salir de su alcance, con la misma cuenta que el golpe.
    const disengaged = readManeuvers(combatEncounter.maneuvers).disengaged.includes(String(member.id));
    const provokes = disengaged ? [] : findOpportunityAttacks({
        mover: member,
        from: { x: origin.gridX || 0, y: origin.gridY || 0 },
        to: { x: gridX, y: gridY },
        threats: getAliveEnemies(),
        reachOf: (/** @type {any} */ enemy) => Number(enemy?.attackRangeFeet) || 5,
        isAlive: (/** @type {any} */ enemy) => (Number(enemy?.currentHp) || 0) > 0,
        canReact: (/** @type {any} */ enemy) => !usedReactions.has(String(enemy.instanceId)),
    }).map(attack => String(attack.threat.name));
    return {
        cells: path.slice(1).map(cell => ({ gridX: cell.x, gridY: cell.y })),
        feet,
        ok: feet <= getRemainingMovementFeet(member),
        provokes,
    };
}

/**
 * Pulsar una casilla encendida.
 *
 * Solo las encendidas llegan aqui: el renderizador no deja pulsar las demas. Mover es
 * reversible dentro del turno, asi que un clic basta; atacar no, y por eso una casilla
 * de ataque abre la tarjeta en vez de resolver el golpe.
 *
 * @param {number} gridX
 * @param {number} gridY
 * @param {string} kind
 */
function handleBoardCellClick(gridX, gridY, kind) {
    const member = getCurrentActingMember();
    if (!member) return;

    if (kind === 'attack') {
        const enemy = getAliveEnemies().find(e => (e.gridX || 0) === gridX && (e.gridY || 0) === gridY);
        if (enemy) openTargetCard(member, enemy);
        return;
    }

    // `/combat-move` habla en las coordenadas que el tablero dibuja en sus ejes, que
    // empiezan en 1; el renderizador cuenta desde 0. Sin el +1 el clic movia a la
    // casilla de arriba a la izquierda de la pulsada, y el recorrido lo cazo.
    handlePlayerCombatMove(`${gridX + 1} ${gridY + 1}`);
}

/**
 * @param {number} tokenId
 */
function handleCombatTokenClick(tokenId) {
    const entry = getCurrentTurnEntry();
    const member = getCurrentActingMember();
    if (!combatEncounter.active || !entry || entry.isEnemy || !member) return;

    // Las fichas de enemigo llevan id negativo. Pulsar una abre su tarjeta: **un clic
    // nunca gasta nada**, y atacar es el boton de la tarjeta.
    if (tokenId < 0) {
        const enemy = combatEncounter.enemies[-tokenId - 1];
        if (enemy && (enemy.currentHp || 0) > 0) openTargetCard(member, enemy);
        return;
    }

    if (tokenId !== member.id) return;

    const alreadySelected = combatBoardSelection.tokenId === tokenId
        && combatBoardSelection.boardName === currentBoardName
        && combatBoardSelection.locationName === currentLocationName;

    setCombatBoardSelection(alreadySelected
        ? { tokenId: null, boardName: '', locationName: '' }
        : { tokenId, boardName: currentBoardName, locationName: currentLocationName });

    renderLocationMapsPreview();
}

/**
 * @param {string} name
 */
function resolveCombatTargetByName(name) {
    const normalized = String(name || '').trim().toLowerCase();
    if (!normalized) return null;
    return getAliveEnemies().find(enemy => enemy.name.toLowerCase() === normalized) || null;
}

/**
 * @param {string} rawValue
 */
export function handlePlayerCombatMove(rawValue) {
    const entry = getCurrentTurnEntry();
    const member = getCurrentActingMember();
    if (!combatEncounter.active || !entry || entry.isEnemy || !member) {
        toastr.warning('No hay un turno de jugador activo.');
        return '';
    }

    const match = String(rawValue || '').trim().match(/^(\d+)\s*[ ,]\s*(\d+)$/);
    if (!match) {
        toastr.warning('Usa /combat-move X Y o /combat-move X,Y');
        return '';
    }

    const targetX = Math.max(0, parseInt(match[1], 10) - 1);
    const targetY = Math.max(0, parseInt(match[2], 10) - 1);
    const position = member.mapPosition || { locationName: currentLocationName, gridX: 0, gridY: 0 };
    // Una casilla con alguien no se pisa, y a una casilla sin camino no se llega.
    const occupied = occupiedCellsFor(member);
    if (occupied.has(`${targetX},${targetY}`)) {
        toastr.warning('Esa casilla ya está ocupada.', 'Ahí no se llega');
        return '';
    }
    if (currentBoardName) {
        const { terrain, gridWidth: boardW, gridHeight: boardH } = getActiveBoardContext();
        const way = findPath(terrain, position.gridX || 0, position.gridY || 0, targetX, targetY, boardW, boardH, { occupied });
        if (!way) {
            toastr.warning('No hay camino hasta esa casilla.', 'Ahí no se llega');
            return '';
        }
    }
    const distanceFeet = getDistanceInFeet(position.gridX || 0, position.gridY || 0, targetX, targetY);
    const turnState = getCurrentTurnState();
    if (!turnState) return '';
    const remainingFeet = getRemainingMovementFeet(member);

    if (distanceFeet > remainingFeet) {
        toastr.warning(`Movimiento insuficiente. Necesitas ${distanceFeet} ft y te quedan ${remainingFeet} ft.`);
        return '';
    }

    const leftFrom = { x: position.gridX || 0, y: position.gridY || 0 };
    member.mapPosition = {
        locationName: currentLocationName,
        gridX: targetX,
        gridY: targetY,
    };

    // Lo que hubiera puesto en esa casilla. Se resuelve **despues** de mover: una trampa
    // salta porque has llegado, no para impedir que llegues.
    fireHazardsOnEnter(member, targetX, targetY);
    Object.assign(combatEncounter, spendMovement(combatEncounter, distanceFeet, Number(member.speed) || 30));
    savePartyState();
    saveCombatState();

    // Salir del alcance de quien te tenia pegado cuesta un golpe gratis. Se cobra despues
    // de moverse, como en la mesa: primero te vas, luego te alcanzan.
    chargeOpportunityAttacks(member, leftFrom, { x: targetX, y: targetY });

    postCombatNarration(`🚶 [COMBAT] ${member.name} se mueve a (${targetX + 1}, ${targetY + 1}) y gasta ${distanceFeet} ft. Restante: ${getRemainingMovementFeet(member)} ft.`);

    // Hay objetivos que se ganan **andando** — «alcanza la salida», «llega al altar»— y
    // esto no se miraba al moverse: solo al atacar y al empezar ronda. Con el bicho ya
    // muerto no empezaba ninguna ronda nueva, asi que se podia estar encima de la salida,
    // con los dos objetivos en verde, y seguir en combate para siempre.
    if (checkScenarioOutcome()) return `${member.name} -> ${targetX + 1},${targetY + 1}`;

    // B2: pisar una salida deja irse de la pelea: un aviso con su botón, sin parar nada.
    offerExit(member, targetX, targetY);
    // H1: la primera vez que alguien sube a lo alto, se dice para qué sirve.
    if (isHigh(getActiveBoardContext().terrain, targetX, targetY)) showTip('high');
    // J2.2: andando se llega al alcance de alguien, y entonces se enseña a atacar.
    if (getAttackableEnemiesForMember(member).length > 0) showTip('attack');

    renderLocationMapsPreview();
    return `${member.name} -> ${targetX + 1},${targetY + 1}`;
}

/**
 * Ideas 73 y 90: el tiempo de hoy aquí. Si se ha llegado hoy de viaje, el del último día del
 * camino; si no, el que toca con la semilla del mundo, del sitio y del día.
 *
 * @returns {string}
 */
function weatherHere() {
    const today = Math.max(1, campaignDay());
    const known = chat_metadata?.[WEATHER_TODAY_KEY];
    if (known && Number(known.day) === today && String(known.place) === String(currentLocationName)) return String(known.weather || '');
    if (!lastCompendium?.has?.('mundo')) return '';
    const biome = String(hereLocation()?.biome || '');
    const climates = seasonClimates(lastCompendium.find('mundo', { kind: 'bioma', biome })[0]?.climates ?? [], currentSeason());
    const random = createSeededRandom(derive(String(chat_metadata?.[METADATA_KEY] || ''), 'tiempo', String(currentLocationName), String(today)));
    return String(rollWeather({ days: 1, table: lastCompendium.find('mundo', { kind: 'clima' }), climates, random })[0] ?? '');
}

/**
 * Ideas 73 y 90: cómo se ve en el tablero ahora: el tiempo, la hora y si hay luz.
 *
 * @returns {{maxFeet: number|null, reasons: string[], windy: boolean, wet: boolean, note: string}}
 */
export function boardVisibility() {
    const { board } = getActiveBoardContext();
    return combatVisibility({
        weather: weatherHere(),
        slot: getCurrentSlotLabel(),
        indoors: isIndoors(board, hereLocation()),
        lit: carriesLight(partyMembers),
    });
}

/**
 * Idea 11: si hay dónde esconderse, mirando desde cada enemigo en pie.
 *
 * @param {any} member
 * @returns {{ok: boolean, reason: string}}
 */
function hideCheck(member) {
    const x = Number(member?.mapPosition?.gridX) || 0;
    const y = Number(member?.mapPosition?.gridY) || 0;
    const terrain = getActiveBoardTerrain();
    return canHide(getAliveEnemies().map((/** @type {any} */ e) => ({
        name: String(e.name),
        cover: Number(getCoverAlongLine(terrain, Number(e.gridX) || 0, Number(e.gridY) || 0, x, y, getCoverBonus)) || 0,
    })));
}

/**
 * Idea 146: un ataque, dicho como todas las tiradas.
 *
 * @param {{who: string, at: string, total: number, ac: number, hit: boolean, natural: number, modifier: number, cover?: number, edge?: string}} input
 * @returns {string}
 */
export function attackLine({ who, at, total, ac, hit, natural, modifier, cover = 0, edge = '' }) {
    const covered = describeCover(cover).trim().replace(/^\(|\)$/g, '');
    const edged = String(edge ?? '').trim().replace(/^·\s*/, '');
    return rollLine({
        what: 'Ataque', who, at, total, against: ac, label: 'CA', success: hit, natural, modifier,
        extra: [covered, edged].filter(Boolean).join(' · '),
    });
}

/**
 * Idea 122: lanzar el aceite o la red. Gasta la acción y el objeto.
 *
 * Es un ataque a distancia improvisado: d20 más la Destreza contra la CA, con la ventaja o
 * la desventaja que toque. El aceite deja la casilla ardiendo aunque falle.
 *
 * @param {string} kind `aceite` o `red`.
 * @param {string} targetId
 * @returns {string}
 */
function throwItem(kind, targetId) {
    const entry = getCurrentTurnEntry();
    const member = getCurrentActingMember();
    if (!combatEncounter.active || !entry || entry.isEnemy || !member) {
        toastr.warning('No hay un turno de jugador activo.');
        return '';
    }
    const spec = THROWABLES[kind];
    const carried = throwablesOf(member).find(t => t.kind === kind);
    if (!spec || !carried) {
        toastr.warning('No lleva nada así para lanzar.');
        return '';
    }
    if (!hasAction(combatEncounter, 'action')) {
        toastr.warning('Tu accion de este turno ya fue usada.');
        return '';
    }
    const target = getAliveEnemies().find((/** @type {any} */ e) => String(e.instanceId) === String(targetId))
        ?? resolveCombatTargetByName(targetId);
    const x = Number(member.mapPosition?.gridX) || 0;
    const y = Number(member.mapPosition?.gridY) || 0;
    const distanceFeet = target ? getDistanceInFeet(x, y, Number(target.gridX) || 0, Number(target.gridY) || 0) : Infinity;
    if (!target || distanceFeet > spec.rangeFeet) {
        toastr.warning(`${spec.label}: tiene que ser alguien a menos de ${spec.rangeFeet} pies.`);
        return '';
    }

    Object.assign(combatEncounter, useAction(combatEncounter, 'action'));
    consumeItemInInventory(/** @type {any} */ (member), carried.itemId);
    const modifier = getAbilityModifier(member.dexterity || 10);
    const edge = attackEdge({
        targetId: String(target.instanceId),
        height: heightFor(partyCell(member), { x: Number(target.gridX) || 0, y: Number(target.gridY) || 0 }),
        targetConditions: target.activeConditions ?? [],
        attackerConditions: member.activeConditions ?? [],
        distanceFeet,
        maneuvers: combatEncounter.maneuvers,
        byParty: true,
        attackerId: String(member.id),
        hindered: visibilityPenalties(boardVisibility(), distanceFeet),
    });
    if (edge.usesHidden) combatEncounter.maneuvers = revealHidden(combatEncounter.maneuvers, String(member.id));
    const edged = rollWithEdge(() => rollDiceDetailed('1d20', 20).total, edge.mode);
    const natural = edged.natural;
    const total = natural + modifier;
    const { ac } = getTargetArmorClass(target, member);
    const hit = natural === 20 || (natural !== 1 && total >= ac);
    showCombatDiceRoll({
        title: `${member.name} lanza`,
        subtitle: `${spec.name} contra ${target.name}`,
        formula: `1d20${modifier >= 0 ? '+' : ''}${modifier}`,
        detail: `d20(${natural}) ${modifier >= 0 ? '+' : ''}${modifier} = ${total} contra CA ${ac}`,
        total,
        dc: ac,
        natural,
        glyph: 'd20',
    });

    /** @type {string[]} */
    const lines = [`🫙 ${member.name} lanza ${spec.name.toLowerCase()} a ${target.name}.`];
    lines.push(rollLine({
        what: 'Lanzar', who: member.name, at: target.name, total, against: ac, label: 'CA', success: hit, natural, modifier,
        extra: describeEdge(edged, edge.mode, edge.reasons),
    }));
    if (kind === 'aceite') {
        if (hit) {
            const burn = rollDiceDetailed(spec.damageDice || '2d4', 4).total;
            target.currentHp = Math.max(0, (Number(target.currentHp) || 0) - burn);
            combatEncounter.tally = noteDealt(combatEncounter.tally, member.id, burn, target.currentHp === 0);
            floatOnToken(enemyTokenId(target), `-${burn}`, 'damage');
            lines.push(`🔥 ${target.name} arde: ${burn} de daño.`);
            if (target.currentHp === 0) {
                lines.push(`☠️ ${target.name} cae.`);
                recordFeat(member, 'kill', String(target.name));
            }
        } else {
            lines.push('❌ El frasco no le da, pero revienta a sus pies.');
        }
        // Aunque falle: el aceite cae y arde. El primero que lo pise, se quema. Con lluvia,
        // no prende (idea 73).
        const board = getActiveBoardContext().board;
        if (boardVisibility().wet) {
            lines.push('💧 Con esta agua, el aceite no prende.');
        } else if (board) {
            board.hazards = [...(Array.isArray(board.hazards) ? board.hazards : []),
                burningPuddle({ x: Number(target.gridX) || 0, y: Number(target.gridY) || 0, round: Number(combatEncounter.round) || 1 })];
            persistBoardTerrain(board);
            lines.push('🔥 El suelo arde donde cayó: el primero que lo pise, se quema.');
        }
    } else if (hit) {
        applyTimedCondition(target, String(target.instanceId), spec.condition || 'Restrained', spec.rounds || 2);
        lines.push(`🕸️ ${target.name} queda enredado en la red: no se mueve, y pegarle va con ventaja.`);
    } else {
        lines.push('❌ La red cae al suelo, vacía.');
    }

    saveCombatState();
    savePartyState();
    postCombatNarration(`[COMBAT] ${lines.join('\n')}`);
    if (!checkScenarioOutcome() && getAliveEnemies().length === 0 && !judgeCurrentScenario()) {
        postCombatNarration('🏆 [COMBAT] Todos los enemigos han sido derrotados.');
        endCombat('victory');
    }
    renderLocationMapsPreview();
    return `${member.name}: ${spec.label}`;
}

/**
 * Idea 8: coger lo que hay a mano —una caja, un barril, una silla de al lado— y tirárselo a
 * alguien. Con la Fuerza, sin competencia: es un ataque improvisado. Y la caja se rompe al
 * caer, así que quien se cubría detrás, ya no.
 *
 * @param {string} targetId
 * @returns {string}
 */
function throwScenery(targetId) {
    const entry = getCurrentTurnEntry();
    const member = getCurrentActingMember();
    if (!combatEncounter.active || !entry || entry.isEnemy || !member) {
        toastr.warning('No hay un turno de jugador activo.');
        return '';
    }
    if (!hasAction(combatEncounter, 'action')) {
        toastr.warning('Tu accion de este turno ya fue usada.');
        return '';
    }
    const context = getActiveBoardContext();
    const x = Number(member.mapPosition?.gridX) || 0;
    const y = Number(member.mapPosition?.gridY) || 0;
    const spot = sceneryNear(context.terrain, x, y, context.gridWidth, context.gridHeight)[0];
    if (!spot || !context.board) {
        toastr.warning('No hay nada a mano que lanzar: una caja o un barril al lado.');
        return '';
    }
    const target = getAliveEnemies().find((/** @type {any} */ e) => String(e.instanceId) === String(targetId))
        ?? resolveCombatTargetByName(targetId);
    const distanceFeet = target ? getDistanceInFeet(x, y, Number(target.gridX) || 0, Number(target.gridY) || 0) : Infinity;
    if (!target || distanceFeet > SCENERY.rangeFeet) {
        toastr.warning(`${SCENERY.label}: tiene que ser alguien a menos de ${SCENERY.rangeFeet} pies.`);
        return '';
    }

    Object.assign(combatEncounter, useAction(combatEncounter, 'action'));
    const strength = getAbilityModifier(member.strength || 10);
    const edge = attackEdge({
        targetId: String(target.instanceId),
        height: heightFor(partyCell(member), { x: Number(target.gridX) || 0, y: Number(target.gridY) || 0 }),
        targetConditions: target.activeConditions ?? [],
        attackerConditions: member.activeConditions ?? [],
        distanceFeet,
        maneuvers: combatEncounter.maneuvers,
        byParty: true,
        attackerId: String(member.id),
        hindered: visibilityPenalties(boardVisibility(), distanceFeet),
    });
    if (edge.usesHidden) combatEncounter.maneuvers = revealHidden(combatEncounter.maneuvers, String(member.id));
    const edged = rollWithEdge(() => rollDiceDetailed('1d20', 20).total, edge.mode);
    const natural = edged.natural;
    const total = natural + strength;
    const { ac } = getTargetArmorClass(target, member);
    const hit = natural === 20 || (natural !== 1 && total >= ac);
    soundCue(hit ? 'hit' : 'miss');
    showCombatDiceRoll({
        title: `${member.name} lanza`,
        subtitle: `Lo que hay a mano contra ${target.name}`,
        formula: `1d20${strength >= 0 ? '+' : ''}${strength}`,
        detail: `d20(${natural}) ${strength >= 0 ? '+' : ''}${strength} = ${total} contra CA ${ac}`,
        total,
        dc: ac,
        natural,
        glyph: 'd20',
    });

    /** @type {string[]} */
    const lines = [`📦 ${member.name} coge lo que hay a mano en (${spot.x + 1}, ${spot.y + 1}) y se lo tira a ${target.name}.`];
    lines.push(rollLine({
        what: 'Lanzar', who: member.name, at: target.name, total, against: ac, label: 'CA', success: hit, natural, modifier: strength,
        extra: describeEdge(edged, edge.mode, edge.reasons),
    }));
    if (hit) {
        const damage = Math.max(1, rollDiceDetailed(SCENERY.damageDice, 6).total + strength);
        target.currentHp = Math.max(0, (Number(target.currentHp) || 0) - damage);
        combatEncounter.tally = noteDealt(combatEncounter.tally, member.id, damage, target.currentHp === 0);
        floatOnToken(enemyTokenId(target), `-${damage}`, 'damage');
        lines.push(`💥 Le da de lleno: ${damage} de daño.`);
        if (target.currentHp === 0) {
            lines.push(`☠️ ${target.name} cae.`);
            recordFeat(member, 'kill', String(target.name));
        }
    } else {
        lines.push('❌ No le da.');
    }
    // Se rompe al caer: donde estaba, ya no hay dónde cubrirse.
    context.board.terrain = setTerrainCell(context.terrain, spot.x, spot.y, 'floor');
    persistBoardTerrain(context.board);
    lines.push('🪵 Se rompe al caer: ahí ya no hay dónde cubrirse.');

    saveCombatState();
    postCombatNarration(`[COMBAT] ${lines.join('\n')}`);
    if (!checkScenarioOutcome() && getAliveEnemies().length === 0 && !judgeCurrentScenario()) {
        postCombatNarration('🏆 [COMBAT] Todos los enemigos han sido derrotados.');
        endCombat('victory');
    }
    renderLocationMapsPreview();
    return `${member.name}: ${SCENERY.label}`;
}

/**
 * Una maniobra: esquivar, destrabarse, empujar o ayudar.
 *
 * Gasta la accion, como en 5e. El boton de la barra de combate, el comando
 * `/maniobra` y el companero que se lleva solo pasan todos por aqui.
 *
 * @param {string} kind
 * @param {string} [targetId] El `instanceId` del enemigo, para empujar y ayudar.
 * @returns {string}
 */
export function performManeuver(kind, targetId = '') {
    const entry = getCurrentTurnEntry();
    const member = getCurrentActingMember();
    if (!combatEncounter.active || !entry || entry.isEnemy || !member) {
        toastr.warning('No hay un turno de jugador activo.');
        return '';
    }
    const maneuver = MANEUVERS[/** @type {keyof typeof MANEUVERS} */ (kind)];
    if (!maneuver) {
        toastr.warning(`No conozco esa maniobra. Hay: ${Object.keys(MANEUVERS).join(', ')}.`);
        return '';
    }
    if (!hasAction(combatEncounter, 'action')) {
        toastr.warning('Tu accion de este turno ya fue usada.');
        return '';
    }

    const from = { x: Number(member.mapPosition?.gridX) || 0, y: Number(member.mapPosition?.gridY) || 0 };
    /** @type {any} */
    let target = null;
    if (maneuver.needsTarget) {
        target = getAliveEnemies().find((/** @type {any} */ e) => String(e.instanceId) === String(targetId))
            ?? resolveCombatTargetByName(targetId);
        const far = !target || getDistanceInFeet(from.x, from.y, Number(target.gridX) || 0, Number(target.gridY) || 0) > 5;
        if (far) {
            toastr.warning(`${maneuver.label}: tiene que ser un enemigo pegado a ti.`);
            return '';
        }
    }

    // Idea 11: sin cobertura no se gasta la acción en intentarlo.
    if (kind === 'esconderse') {
        const hide = hideCheck(member);
        if (!hide.ok) {
            toastr.warning(hide.reason, 'Esconderse');
            return '';
        }
    }

    Object.assign(combatEncounter, useAction(combatEncounter, 'action'));
    const id = String(member.id);
    /** @type {string[]} */
    const lines = [];

    if (kind === 'esquivar' || kind === 'destrabarse') {
        combatEncounter.maneuvers = recordManeuver(combatEncounter.maneuvers, kind, id);
        lines.push(kind === 'esquivar'
            ? `🛡️ ${member.name} se cubre: hasta su proximo turno, atacarle es con desventaja.`
            : `🏃 ${member.name} se destraba: este turno se mueve sin dar ataques de oportunidad.`);
    } else if (kind === 'preparar') {
        // Idea 4: el golpe espera al primero que se acerque.
        combatEncounter.readied = readyAttack(combatEncounter.readied, id, Number(combatEncounter.round) || 1);
        lines.push(`⏳ ${member.name} prepara el golpe: el primero que se le acerque antes de su turno se lo lleva.`);
    } else if (kind === 'ayudar') {
        combatEncounter.maneuvers = recordManeuver(combatEncounter.maneuvers, 'ayudar', id, String(target.instanceId));
        lines.push(`🤝 ${member.name} distrae a ${target.name}: el proximo ataque del grupo contra el va con ventaja.`);
    } else if (kind === 'esconderse') {
        // Idea 11: con algo delante de cada uno que mira, Sigilo contra su mejor Percepción.
        const dc = hideDC(getAliveEnemies().map((/** @type {any} */ e) => ({ wisdom: Number(e.wisdom) || 10 })));
        const { modifier } = skillModifier(member, 'stealth');
        const natural = rollDiceDetailed('1d20', 20).total;
        const total = natural + modifier;
        showCombatDiceRoll({
            title: `${member.name} se esconde`,
            subtitle: 'Sigilo contra su Percepción',
            formula: `1d20${modifier >= 0 ? '+' : ''}${modifier}`,
            detail: `d20(${natural}) ${modifier >= 0 ? '+' : ''}${modifier} = ${total} contra ${dc}`,
            total,
            dc,
            natural,
            glyph: 'd20',
        });
        lines.push(rollLine({ what: 'Sigilo', who: member.name, total, against: dc, label: 'Percepción', success: total >= dc, natural, modifier }));
        if (total >= dc) {
            combatEncounter.maneuvers = recordManeuver(combatEncounter.maneuvers, 'esconderse', id);
            lines.push(`🫥 ${member.name} desaparece tras la cobertura: su próximo ataque, con ventaja.`);
        } else {
            lines.push(`👀 Le han visto: ${member.name} no consigue esconderse.`);
        }
    } else if (kind === 'agarrar') {
        // Idea 10: Atletismo contra el mejor de Atletismo y Acrobacias del otro, como empujar.
        const mine = getAbilityModifier(member.strength || 10);
        const theirs = Math.max(getAbilityModifier(target.strength || 10), getAbilityModifier(target.dexterity || 10));
        const attackRoll = rollDiceDetailed('1d20', 20).total;
        const defenseRoll = rollDiceDetailed('1d20', 20).total;
        showCombatDiceRoll({
            title: `${member.name} agarra`,
            subtitle: `Contra ${target.name}`,
            formula: `1d20${mine >= 0 ? '+' : ''}${mine}`,
            detail: `d20(${attackRoll}) ${mine >= 0 ? '+' : ''}${mine} = ${attackRoll + mine} contra ${defenseRoll + theirs}`,
            total: attackRoll + mine,
            dc: defenseRoll + theirs + 1,
            natural: attackRoll,
            glyph: 'd20',
        });
        lines.push(rollLine({ what: 'Agarrar', who: member.name, at: target.name, total: attackRoll + mine, against: defenseRoll + theirs, label: '', success: attackRoll + mine > defenseRoll + theirs, natural: attackRoll, modifier: mine }));
        if (attackRoll + mine > defenseRoll + theirs) {
            applyTimedCondition(target, String(target.instanceId), 'Grappled', 1);
            lines.push(`✅ ${target.name} queda agarrado: no se mueve hasta el próximo turno de ${member.name}.`);
        } else {
            lines.push(`❌ ${target.name} se suelta.`);
        }
    } else {
        // Empujar: Atletismo contra el mejor de Atletismo y Acrobacias del otro.
        const mine = getAbilityModifier(member.strength || 10);
        const theirs = Math.max(getAbilityModifier(target.strength || 10), getAbilityModifier(target.dexterity || 10));
        const attackRoll = rollDiceDetailed('1d20', 20).total;
        const defenseRoll = rollDiceDetailed('1d20', 20).total;
        const attackTotal = attackRoll + mine;
        const defenseTotal = defenseRoll + theirs;
        const { terrain, gridWidth, gridHeight } = getActiveBoardContext();
        const taken = new Set([
            ...getAliveEnemies().map((/** @type {any} */ e) => cellKey(Number(e.gridX) || 0, Number(e.gridY) || 0)),
            ...partyMembers.filter(m => (Number(m.hp) || 0) > 0)
                .map(m => cellKey(Number(m.mapPosition?.gridX) || 0, Number(m.mapPosition?.gridY) || 0)),
        ]);
        const shove = resolveShove({
            from,
            target: { x: Number(target.gridX) || 0, y: Number(target.gridY) || 0 },
            attackTotal,
            defenseTotal,
            isFree: (x, y) => isPassable(terrain, x, y, gridWidth, gridHeight) && !taken.has(cellKey(x, y)),
            isChasm: (x, y) => getCell(terrain, x, y)?.type === 'chasm',
        });

        showCombatDiceRoll({
            title: `${member.name} empuja`,
            subtitle: `Contra ${target.name}`,
            formula: `1d20${mine >= 0 ? '+' : ''}${mine}`,
            detail: `d20(${attackRoll}) ${mine >= 0 ? '+' : ''}${mine} = ${attackTotal} contra ${defenseTotal}`,
            total: attackTotal,
            dc: defenseTotal + 1,
            natural: attackRoll,
            glyph: 'd20',
        });
        lines.push(rollLine({ what: 'Empujar', who: member.name, at: target.name, total: attackTotal, against: defenseTotal, label: '', success: attackTotal > defenseTotal, natural: attackRoll, modifier: mine }));
        if (!shove.success) {
            lines.push(`❌ ${target.name} aguanta el empujon.`);
        } else if (shove.falls && shove.pushedTo) {
            // Al vacio: fuera del combate, sin tirada de dano. Es lo que tiene un precipicio.
            target.gridX = shove.pushedTo.x;
            target.gridY = shove.pushedTo.y;
            target.currentHp = 0;
            combatEncounter.conditionTimers = clearTimersFor(combatEncounter.conditionTimers, String(target.instanceId));
            lines.push(`✅ ${target.name} pierde pie y cae al vacío.`);
            bark(member, 'kill');
            // Idea 189: que se vea caer antes de que desaparezca.
            $(`.wm-token[data-token-id="${enemyTokenId(target)}"]`).addClass('wm-token-falling');
            fellThisTurn = true;
        } else if (shove.pushedTo) {
            target.gridX = shove.pushedTo.x;
            target.gridY = shove.pushedTo.y;
            lines.push(`✅ ${target.name} retrocede a (${shove.pushedTo.x + 1}, ${shove.pushedTo.y + 1}).`);
            // Idea 9: si detras habia algo puesto (una trampa, fuego), lo pisa el.
            lines.push(...shovedInto(target, shove.pushedTo));
        } else {
            // Sin sitio detras, cae: el empujon no se pierde, cambia de forma.
            applyTimedCondition(target, String(target.instanceId), 'Prone', 1);
            lines.push(`✅ ${target.name} no tiene a donde ir y cae al suelo: pegarle de cerca va con ventaja.`);
            // Idea 17: el siguiente de los tuyos que le pegue esta ronda, remata la jugada.
            combatEncounter.maneuvers = noteKnockdown(combatEncounter.maneuvers, String(target.instanceId), id, Number(combatEncounter.round) || 1);
        }
    }

    saveCombatState();
    savePartyState();
    postCombatNarration(`[COMBAT] ${lines.join('\n')}`);
    if (fellThisTurn) {
        // Idea 189: la caída se ve entera antes de repintar el tablero.
        fellThisTurn = false;
        setTimeout(() => {
            if (!checkScenarioOutcome() && getAliveEnemies().length === 0 && !judgeCurrentScenario()) {
                postCombatNarration('🏆 [COMBAT] Todos los enemigos han sido derrotados.');
                endCombat('victory');
            }
            renderLocationMapsPreview();
        }, 900);
        return `${member.name}: ${maneuver.label}`;
    }
    // Un empujon al vacio puede ser el ultimo golpe del combate.
    if (kind === 'empujar' && !checkScenarioOutcome() && getAliveEnemies().length === 0 && !judgeCurrentScenario()) {
        postCombatNarration('🏆 [COMBAT] Todos los enemigos han sido derrotados.');
        endCombat('victory');
    }
    renderLocationMapsPreview();
    return `${member.name}: ${maneuver.label}`;
}

/**
 * @param {string} rawTargetName
 */
export function handlePlayerCombatAttack(rawTargetName) {
    const entry = getCurrentTurnEntry();
    const member = getCurrentActingMember();
    const turnState = getCurrentTurnState();
    if (!combatEncounter.active || !entry || entry.isEnemy || !member || !turnState) {
        toastr.warning('No hay un turno de jugador activo.');
        return '';
    }

    if (!hasAction(combatEncounter, 'action')) {
        toastr.warning('Tu accion de este turno ya fue usada.');
        return '';
    }

    const target = resolveCombatTargetByName(rawTargetName);
    if (!target) {
        toastr.warning(`Objetivo no encontrado: ${rawTargetName}`);
        return '';
    }

    const origin = member.mapPosition || { gridX: 0, gridY: 0, locationName: currentLocationName };
    const rangeFeet = getAttackRangeFeet(member);
    const distanceFeet = getDistanceInFeet(origin.gridX || 0, origin.gridY || 0, target.gridX || 0, target.gridY || 0);
    if (distanceFeet > rangeFeet) {
        toastr.warning(`${target.name} esta fuera de rango. Distancia ${distanceFeet} ft, rango ${rangeFeet} ft.`);
        return '';
    }

    // Idea 47: lo aprendido a fuerza de tumbar a los de su clase.
    // Idea 120: el «+1» del arma suma al ataque y al daño.
    const attackMod = getPlayerAttackModifier(member, rangeFeet) + traitBonus(member, target.name) + perkBonus(member, 'attack') + weaponBonus(member);
    const edge = attackEdge({
        targetId: String(target.instanceId),
        height: heightFor(partyCell(member), { x: Number(target.gridX) || 0, y: Number(target.gridY) || 0 }),
        targetConditions: target.activeConditions ?? [],
        attackerConditions: member.activeConditions ?? [],
        distanceFeet,
        maneuvers: combatEncounter.maneuvers,
        byParty: true,
        flanked: partyFlanks(member, target),
        attackerId: String(member.id),
        hindered: visibilityPenalties(boardVisibility(), distanceFeet),
    });
    const edged = rollWithEdge(() => rollDiceDetailed('1d20', 20).total, edge.mode);
    const attackRoll = { total: edged.natural, natural: edged.natural };
    // La ayuda vale para un golpe: se gasta aunque falle.
    if (edge.usesHelp) combatEncounter.maneuvers = consumeHelp(combatEncounter.maneuvers, String(target.instanceId));
    // Idea 11: quien ataca desde su escondite deja de estar escondido.
    if (edge.usesHidden) combatEncounter.maneuvers = revealHidden(combatEncounter.maneuvers, String(member.id));
    const attackTotal = attackRoll.total + attackMod;
    const { ac: targetAc, cover: targetCover } = getTargetArmorClass(target, member);
    const isCrit = attackRoll.natural === 20;
    const isHit = isCrit || attackTotal >= targetAc;

    showCombatDiceRoll({
        title: `${member.name} ataca`,
        subtitle: `Objetivo: ${target.name}`,
        formula: `1d20${attackMod >= 0 ? '+' : ''}${attackMod}`,
        detail: `d20(${attackRoll.total}) ${attackMod >= 0 ? '+' : ''}${attackMod} = ${attackTotal}`,
        total: attackTotal,
        dc: targetAc,
        natural: attackRoll.natural,
        glyph: 'd20',
    });

    const lines = [];
    lines.push(`🗡️ ${member.name} ataca a ${target.name}.`);
    lines.push(attackLine({ who: member.name, at: target.name, total: attackTotal, ac: targetAc, hit: isHit, natural: attackRoll.total, modifier: attackMod, cover: targetCover, edge: describeEdge(edged, edge.mode, edge.reasons) }));

    Object.assign(combatEncounter, useAction(combatEncounter, 'action'));

    // Idea 186: cada golpe suena según salga.
    soundCue(isHit ? (isCrit ? 'crit' : 'hit') : 'miss');
    if (!isHit) {
        lines.push('❌ Resultado: fallo.');
        saveCombatState();
        postCombatNarration(lines.join('\n'));
        renderLocationMapsPreview();
        return `${member.name} fallo contra ${target.name}`;
    }

    const damageFormula = getPlayerDamageFormula(member, rangeFeet);
    const damageRoll = rollDiceDetailed(damageFormula, 8);
    const critRoll = isCrit ? rollDiceDetailed(damageFormula, 8) : null;
    // Idea 55: con el arma de siempre, se pega mejor.
    const weaponName = String(heldWeapon(member)?.name ?? '');
    const damageMod = Math.max(0, getPlayerAttackModifier(member, rangeFeet)) + knackBonus(member, weaponName) + weaponBonus(member);
    const totalDamage = Math.max(1, damageRoll.total + (critRoll?.total || 0) + damageMod);
    if (weaponName) recordFeat(member, 'hit', weaponName);

    showCombatDiceRoll({
        title: `${member.name} tira daño`,
        subtitle: `Contra ${target.name}`,
        formula: `${damageFormula}${isCrit ? ` + ${damageFormula}` : ''}`,
        detail: isCrit
            ? `${damageRoll.rolls.join(', ')} + crítico(${critRoll?.rolls.join(', ') || ''}) + mod(${damageMod})`
            : `${damageRoll.rolls.join(', ')} + mod(${damageMod})`,
        total: totalDamage,
        glyph: 'dmg',
    });

    target.currentHp = Math.max(0, (target.currentHp || 0) - totalDamage);
    combatEncounter.tally = noteDealt(combatEncounter.tally, member.id, totalDamage, target.currentHp === 0);
    lines.push(`✅ Resultado: impacto${isCrit ? ' critico' : ''}.`);
    lines.push(damageLine({ total: totalDamage, formula: damageFormula, rolled: damageRoll.total, modifier: damageMod, crit: isCrit ? (critRoll?.total || 0) : 0 }));
    floatOnToken(enemyTokenId(target), `-${totalDamage}`, isCrit ? 'crit' : 'damage');
    if (isCrit) recordFeat(member, 'crit');
    // Idea 17: rematar la jugada de un compañero suma.
    const combo = takeCombo(combatEncounter.maneuvers, {
        targetId: String(target.instanceId), attackerId: String(member.id), round: Number(combatEncounter.round) || 1,
    });
    if (combo.combo && target.currentHp > 0) {
        combatEncounter.maneuvers = combo.state;
        const extra = rollDiceDetailed(COMBO_DICE, 4).total;
        target.currentHp = Math.max(0, target.currentHp - extra);
        combatEncounter.tally = noteDealt(combatEncounter.tally, member.id, extra, target.currentHp === 0);
        const partner = partyMembers.find(m => String(m.id) === combo.by);
        lines.push(`🤝 Jugada combinada: ${member.name} remata lo que empezó ${partner?.name ?? 'un compañero'}: ${extra} más.`);
    }
    // Idea 15: un critico hace algo, segun el arma.
    if (isCrit && target.currentHp > 0) {
        const effect = critEffect(String(heldWeapon(member)?.damageType ?? ''));
        if (effect.kind === 'damage') {
            const extra = rollDiceDetailed(effect.dice, 8).total;
            target.currentHp = Math.max(0, target.currentHp - extra);
            combatEncounter.tally = noteDealt(combatEncounter.tally, member.id, extra, target.currentHp === 0);
            lines.push(`🩸 El crítico ${effect.label}: ${extra} más.`);
        } else {
            applyTimedCondition(target, String(target.instanceId), effect.condition, effect.rounds);
            lines.push(`💢 El crítico ${effect.label}.`);
            if (effect.condition === 'Prone') {
                combatEncounter.maneuvers = noteKnockdown(combatEncounter.maneuvers, String(target.instanceId), String(member.id), Number(combatEncounter.round) || 1);
            }
        }
    }
    if (target.currentHp === 0) {
        recordFeat(member, 'kill', String(target.name));
        const friend = getAliveEnemies()[0];
        if (friend) enemyBark(friend, 'ally_down');
    } else if (target.currentHp / Math.max(1, Number(target.maxHp) || 1) < 0.5) {
        enemyBark(target, 'hurt');
    }
    lines.push(`❤️ Estado de ${target.name}: ${target.currentHp}/${target.maxHp}`);

    if (target.currentHp === 0) {
        lines.push(`☠️ ${target.name} cae derrotado.`);
    }

    // Idea 24: el jefe contesta, una vez por ronda, si le llega quien le ha pegado.
    const round24 = Number(combatEncounter.round) || 1;
    if (canReact({
        enemy: target, reacted: combatEncounter.bossReacted, id: String(target.instanceId), round: round24,
        distanceFeet, reachFeet: Number(target.attackRangeFeet ?? target.range) || 5,
    })) {
        combatEncounter.bossReacted = markReacted(combatEncounter.bossReacted, String(target.instanceId), round24);
        lastBossLine = bossLine(Math.random, lastBossLine);
        lines.push(`👑 ${target.name}: «${lastBossLine}» Contesta en el acto.`);
        lines.push(resolveEnemyAttackOn(target, member));
    }

    // Rank 3: a critical opens the door for a companion who can already reach the target.
    // A free attack from across the room would make position meaningless, and position is
    // the whole game underneath.
    if (isCrit && target.currentHp > 0) {
        const followUp = planFollowUp({
            bonds: getCampaignBonds(),
            party: partyMembers,
            attackerId: String(member.id),
            canReach: (/** @type {any} */ ally) => {
                const from = ally.mapPosition || { gridX: 0, gridY: 0 };
                return getDistanceInFeet(from.gridX || 0, from.gridY || 0, target.gridX || 0, target.gridY || 0)
                    <= getAttackRangeFeet(ally);
            },
        });

        if (followUp) {
            lines.push(`🤝 ${followUp.actorName} aprovecha el hueco y ataca también.`);
            saveCombatState();
            postCombatNarration(lines.join('\n'));
            // Resolved as a real attack, so it rolls, it can miss and it is logged like
            // any other: a free hit that always lands is not a perk, it is a cheat.
            resolveFollowUpAttack(followUp.actorId, target);
            renderLocationMapsPreview();
            return `${member.name} golpea a ${target.name}`;
        }
    }

    saveCombatState();
    // C7: quien pega dice algo, a veces. No cuesta tokens: son frases escritas.
    bark(member, target.currentHp === 0 ? 'kill' : (isCrit ? 'crit' : 'hit'));
    postCombatNarration(lines.join('\n'));

    // A scenario decides the fight when the board carries one: clearing the enemies is
    // just one way to finish, and not always the way that was asked for.
    if (checkScenarioOutcome()) return `${member.name} derrota a ${target.name}`;

    if (getAliveEnemies().length === 0 && !judgeCurrentScenario()) {
        postCombatNarration('🏆 [COMBAT] Todos los enemigos han sido derrotados.');
        endCombat('victory');
        renderLocationMapsPreview();
        return `${member.name} derrota a ${target.name}`;
    }

    if (target.currentHp === 0) offerBatonPass(member);

    renderLocationMapsPreview();
    return `${member.name} golpea a ${target.name}`;
}

/**
 * Idea 153: pasar el turno con el golpe sin dar, preguntando antes. Solo cuando de verdad
 * se puede pegar a alguien: si no hay a quien, no hay nada que perder y no se pregunta.
 *
 * @returns {Promise<void>}
 */
async function confirmEndTurn() {
    const member = getCurrentActingMember();
    const reachable = member && hasAction(combatEncounter, 'action') ? getAttackableEnemiesForMember(member) : [];
    if (reachable.length > 0) {
        const go = await Popup.show.confirm('¿Acabar el turno?',
            `Aún puedes atacar a ${reachable.map(e => e.name).slice(0, 3).join(', ')}. Si acabas, la acción se pierde.`,
            { okButton: 'Acabar igual', cancelButton: 'Seguir' });
        if (!go) return;
    }
    endPlayerCombatTurn();
}

export function endPlayerCombatTurn() {
    const entry = getCurrentTurnEntry();
    if (!entry || entry.isEnemy) {
        toastr.warning('No hay un turno de jugador que cerrar.');
        return '';
    }

    const nextEntry = runCombatTurnLoop(false);
    renderLocationMapsPreview();
    return nextEntry ? nextEntry.name : '';
}

function renderWorldMapPreview() {
    const container = $('#world_map_preview');
    if (!container.length) return;

    const mapUrl = getCurrentWorldMapUrl();
    const locationMaps = getCurrentWorldLocationMaps();

    renderWorldMapView(container, mapUrl, locationMaps, {
        onLocationSelect: (loc) => {
            setCurrentLocationName(loc.name);
            saveCurrentLocation();
        },
        onLocationNavigate: (loc) => {
            // Switch to Location tab
            setCurrentLocationName(loc.name);
            saveCurrentLocation();
            $('#rm_tab_location').trigger('click');
        },
    });
}

/**
 * Build the combat encounter UI section (banner, turn order, enemy cards, buttons).
 * @param {Object} board - The current board object
 * @returns {JQuery}
 */
/**
 * @param {{ name: string }} board
 */
function buildCombatSection(board) {
    const section = $('<div class="wm-combat-section"></div>');
    const currentEntry = getCurrentTurnEntry();
    const currentMember = getCurrentActingMember();
    const turnState = getCurrentTurnState();

    // Banner
    section.append(`<div class="wm-combat-banner"><i class="fa-solid fa-swords"></i> En combate — ${escapeHtml(board.name)}</div>`);

    // ---- Scenario objectives (wiki/ROADMAP.md, Fase E) ----
    // Above the initiative order, because what the fight is *for* outranks whose turn it
    // is. Only drawn when the board actually carries a scenario.
    const scenario = judgeCurrentScenario();
    if (scenario && scenario.rows.length > 0) {
        const panel = $('<div class="wm-objectives"></div>');
        panel.append($('<div class="wm-objectives-title"></div>').text('Objetivos'));

        for (const row of scenario.rows) {
            const line = $('<div class="wm-objective"></div>').addClass(`status-${row.status}`);
            line.append($('<i class="wm-objective-icon fa-solid"></i>').addClass(
                row.status === 'complete' ? 'fa-circle-check'
                    : row.status === 'failed' ? 'fa-circle-xmark' : 'fa-circle',
            ));
            line.append($('<span class="wm-objective-label"></span>').text(row.label));
            if (row.optional) {
                line.append($('<span class="wm-objective-optional"></span>').text('opcional'));
            }
            panel.append(line);
        }

        section.append(panel);
    }

    // ---- Initiative tracker (wiki/ROADMAP.md, B8) ----
    // Replaces the numbered list of names that used to live here. The list said who was
    // in the fight and nothing else, so knowing whether the wounded one acts before the
    // ghoul meant counting rows by hand every round.
    const tracker = buildTracker({
        turnOrder: combatEncounter.turnOrder,
        currentTurnIndex: combatEncounter.currentTurnIndex,
        round: combatEncounter.round,
        party: partyMembers,
        enemies: combatEncounter.enemies,
    });

    if (tracker.entries.length > 0) {
        const panel = $('<div class="wm-init"></div>');

        const head = $('<div class="wm-init-head"></div>');
        head.append($('<span class="wm-init-round"></span>').text(`Ronda ${tracker.round}`));
        head.append($('<span class="wm-init-turn"></span>').text(describeTurn(tracker)));
        panel.append(head);

        const list = $('<div class="wm-init-list"></div>');
        for (const entry of tracker.entries) {
            const row = $('<div class="wm-init-row"></div>')
                .toggleClass('current', entry.isCurrent)
                .toggleClass('next', entry.isNext)
                .toggleClass('enemy', entry.isEnemy)
                .toggleClass('defeated', entry.defeated)
                .toggleClass('bloodied', entry.bloodied);

            row.append($('<span class="wm-init-score"></span>').text(String(entry.initiative)));
            // Idea 5: la cara, o la inicial si no la tiene. Se reconoce antes que un nombre.
            row.append(entry.avatar
                ? $('<img class="wm-init-face" alt="">').attr('src', entry.avatar)
                : $('<span class="wm-init-face wm-init-initial"></span>').text(entry.name.charAt(0).toUpperCase()));

            const body = $('<div class="wm-init-body"></div>');
            const nameLine = $('<div class="wm-init-name-line"></div>');
            nameLine.append($('<span class="wm-init-name"></span>').text(entry.name));

            // Conditions as icons rather than as a sentence: a row you can read at a
            // glance is the whole point of a tracker.
            for (const status of entry.statuses) {
                nameLine.append(
                    $('<i class="wm-init-status fa-solid"></i>')
                        .addClass(status.icon)
                        .attr('title', status.label),
                );
            }
            body.append(nameLine);

            if (entry.maxHp > 0) {
                body.append($('<div class="wm-init-hp"></div>').append(
                    $('<div class="wm-init-hp-fill"></div>').css('width', `${entry.hpPct}%`),
                ));
                body.append($('<span class="wm-init-hp-text"></span>')
                    .text(`${entry.hp}/${entry.maxHp}`));
            }

            row.append(body);
            list.append(row);
        }

        panel.append(list);
        section.append(panel);
    }


    // Enemy cards
    if (combatEncounter.enemies.length > 0) {
        const enemyGrid = $('<div class="wm-combat-enemy-grid"></div>');
        for (const enemy of combatEncounter.enemies) {
            const hpPct = enemy.maxHp > 0 ? Math.min(100, (enemy.currentHp / enemy.maxHp) * 100) : 0;
            const isDead = enemy.currentHp <= 0;
            const avatarHtml = enemy.avatar
                ? `<img src="${escapeHtml(enemy.avatar)}" alt="" />`
                : '<i class="fa-solid fa-skull fa-2x"></i>';
            enemyGrid.append(`
                <div class="wm-combat-enemy-card${isDead ? ' wm-combat-enemy-dead' : ''}">
                    <div class="wm-combat-enemy-avatar">${avatarHtml}</div>
                    <div class="wm-combat-enemy-info">
                        <div class="wm-combat-enemy-name">${escapeHtml(enemy.name)}</div>
                        <div class="wm-combat-enemy-stats">
                            <span>PG ${enemy.currentHp}/${enemy.maxHp}</span>
                            <span>CA ${enemy.armorClass}</span>
                            <span>Desafío ${({ 0.125: '1/8', 0.25: '1/4', 0.5: '1/2' })[Number(enemy.cr)] ?? enemy.cr}</span>
                        </div>
                        <div class="wm-combat-enemy-hp-bar">
                            <div class="wm-combat-enemy-hp-fill" style="width:${hpPct}%"></div>
                        </div>
                    </div>
                </div>
            `);
        }
        section.append('<div class="wm-combat-enemies-title">Enemigos</div>');
        section.append(enemyGrid);
    }

    if (currentEntry && !currentEntry.isEnemy && currentMember && turnState) {
        const remainingFeet = getRemainingMovementFeet(currentMember);
        const rangeFeet = getAttackRangeFeet(currentMember);
        const targets = getAttackableEnemiesForMember(currentMember);
        const memberX = Number.isFinite(Number(currentMember.mapPosition?.gridX)) ? Number(currentMember.mapPosition?.gridX) : 0;
        const memberY = Number.isFinite(Number(currentMember.mapPosition?.gridY)) ? Number(currentMember.mapPosition?.gridY) : 0;
        const nearestEnemyInfo = getAliveEnemies()
            .map(enemy => ({
                name: enemy.name,
                distanceFeet: getDistanceInFeet(memberX, memberY, Number(enemy.gridX) || 0, Number(enemy.gridY) || 0),
            }))
            .sort((a, b) => a.distanceFeet - b.distanceFeet)[0] || null;
        const targetChips = targets.length
            ? targets.map(enemy => `<span class="wm-combat-chip attack">${escapeHtml(enemy.name)} · ${getDistanceInFeet(memberX, memberY, Number(enemy.gridX) || 0, Number(enemy.gridY) || 0)} pies</span>`).join('')
            : `<span class="wm-combat-chip attack">Nadie al alcance${nearestEnemyInfo ? ` · el más cercano: ${escapeHtml(nearestEnemyInfo.name)} (${nearestEnemyInfo.distanceFeet} pies)` : ''}</span>`;
        // Lo gastado y lo que queda, dicho como se diría en la mesa.
        const spent = (/** @type {boolean} */ used) => (used ? 'gastada' : 'libre');

        section.append(`
            <div class="wm-combat-turn-panel">
                <strong>${escapeHtml(currentMember.name)}</strong> · Te toca<br>
                <div class="wm-combat-turn-help">Acción: ${spent(turnState.actionUsed)} · Adicional: ${spent(turnState.bonusActionUsed)} · Reacción: ${spent(turnState.reactionUsed)} · Te quedan ${remainingFeet} pies de movimiento · Alcance: ${rangeFeet} pies.</div>
                <div class="wm-combat-chip-row">
                    <span class="wm-combat-chip move">Pulsa tu ficha para ver hasta dónde puedes andar</span>
                    ${targetChips}
                </div>
                <div class="wm-combat-button-note">Con comandos: /combat-attack &lt;objetivo&gt;, /combat-move &lt;x&gt; &lt;y&gt;, /combat-end</div>
            </div>
        `);
    }

    // Action buttons
    const btnRow = $('<div class="wm-combat-buttons"></div>');
    const endTurnBtn = $('<button class="menu_button"><i class="fa-solid fa-forward-step"></i> Fin de turno</button>');
    endTurnBtn.on('click', () => {
        const nextEntry = endPlayerCombatTurn();
        if (nextEntry) {
            toastr.info(`🎯 Turno de ${nextEntry}`);
        }
    });
    btnRow.append(endTurnBtn);
    section.append(btnRow);

    return section;
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
 * Un miembro del grupo recien salido de su ficha del Lorebook.
 *
 * Empieza entero y con los bolsillos vacios, porque entrar al grupo no es continuar una
 * partida: la vida, el oro y la mochila son de quien ya jugaba.
 *
 * @param {any} entry
 * @param {string|null} worldName
 * @returns {PartyMember}
 */
export function memberFromEntry(entry, worldName) {
    const d = entry?.dndData || {};
    const defaults = getDefaultDndData();

    return {
        id: Date.now() + Math.floor(Math.random() * 10000),
        personaId: null,
        wiUid: entry?.uid != null ? Number(entry.uid) : null,
        worldName: worldName,
        name: getPartyEntryDisplayName(entry),
        group: entry?.group || '',
        avatar: d.image || 'img/user-default.png',
        level: Number(d.level) || 1,
        class: d.charClass || 'Adventurer',
        race: d.race || '',
        background: d.background || '',
        gender: d.gender || '',
        factions: parseFactionValues(d.factions || d.faction),
        hp: Number(d.maxHp) || 30,
        maxHp: Number(d.maxHp) || 30,
        xp: 0,
        xpNext: 100,
        gold: 0,
        silver: 0,
        copper: 0,
        inventory: '',
        conditions: '',
        alignment: d.alignment || '',
        personality: d.personality || '',
        activeConditions: /** @type {string[]} */ ([]),
        strength: Number(d.str) || defaults.strength,
        dexterity: Number(d.dex) || defaults.dexterity,
        constitution: Number(d.con) || defaults.constitution,
        intelligence: Number(d.int) || defaults.intelligence,
        wisdom: Number(d.wis) || defaults.wisdom,
        charisma: Number(d.cha) || defaults.charisma,
        armorClass: Number(d.ac) || defaults.armorClass,
        speed: Number(d.speed) || defaults.speed,
        items: [],
        equippedItems: { ...defaults.equippedItems },
        relationships: [],
        memories: [],
        mapPosition: resolveEntryMapPosition(d),
        abilities: abilityIdsOf(d),
    };
}

/**
 * R3: lo que sabe hacer una ficha del mundo, como ids del catálogo. La ficha puede traer
 * filas enteras (las que escribe el creador de personaje) o solo ids.
 *
 * @param {any} dnd
 * @returns {string[]}
 */
function abilityIdsOf(dnd) {
    return [...new Set((Array.isArray(dnd?.abilities) ? dnd.abilities : [])
        .map((/** @type {any} */ a) => String(typeof a === 'string' ? a : a?.id ?? '').trim())
        .filter(Boolean))];
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
 * Pone el grupo al dia con lo que dicen las fichas, sin rehacerlo.
 *
 * `setPartyFromWorldEntries` construye el grupo de cero, y eso aqui seria un desastre:
 * devolveria a todos los puntos de vida llenos, con cero de oro y la mochila vacia. Lo
 * que cambia en el editor es la ficha — nombre, clase, caracteristicas, cara — y eso es
 * lo unico que se copia encima.
 *
 * @param {any} entries Las fichas ya guardadas.
 * @param {string} worldName
 */
function syncPartyWithEntries(entries, worldName) {
    const rows = Object.entries(entries ?? {})
        .filter(([, entry]) => getDndEntryType(entry) === 'character');
    const playable = new Set(rows.map(([uid]) => Number(uid)));

    // Quien ha dejado de ser del grupo sale de la tira, pero no se borra del mundo.
    const left = partyMembers.filter(member => member.wiUid != null && !playable.has(Number(member.wiUid)));
    if (left.length > 0) {
        setPartyMembers(partyMembers.filter(member => !left.includes(member)));
    }

    for (const [uid, entry] of rows) {
        const d = /** @type {any} */ (entry)?.dndData || {};
        const existing = partyMembers.find(member => Number(member.wiUid) === Number(uid));

        if (!existing) {
            partyMembers.push(memberFromEntry(entry, worldName));
            continue;
        }

        existing.name = getPartyEntryDisplayName(entry);
        existing.level = Number(d.level) || existing.level;
        existing.class = d.charClass || existing.class;
        existing.race = d.race ?? existing.race;
        existing.background = d.background ?? existing.background;
        existing.avatar = d.image || existing.avatar;
        existing.personality = d.personality ?? existing.personality;
        existing.strength = Number(d.str) || existing.strength;
        existing.dexterity = Number(d.dex) || existing.dexterity;
        existing.constitution = Number(d.con) || existing.constitution;
        existing.intelligence = Number(d.int) || existing.intelligence;
        existing.wisdom = Number(d.wis) || existing.wisdom;
        existing.charisma = Number(d.cha) || existing.charisma;
        existing.armorClass = Number(d.ac) || existing.armorClass;
        existing.speed = Number(d.speed) || existing.speed;

        // Subir el maximo cura esa diferencia; bajarlo no mata a nadie.
        const maxHp = Number(d.maxHp) || existing.maxHp;
        if (maxHp !== existing.maxHp) {
            existing.hp = Math.max(0, Math.min(maxHp, existing.hp + Math.max(0, maxHp - existing.maxHp)));
            existing.maxHp = maxHp;
        }
        existing.mapPosition = resolveEntryMapPosition(d);
    }

    renderPartyMembers();
    savePartyState();

    if (left.length > 0) {
        toastr.info(`${left.map(m => m.name).join(', ')} ya no ${left.length === 1 ? 'juega' : 'juegan'} en el grupo.`);
    }
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
 * J4: el grupo tal cual está, para llevarlo a otro chat.
 *
 * @returns {PartyMember[]}
 */
export function partySnapshot() {
    return JSON.parse(JSON.stringify(partyMembers));
}

/**
 * J4: el grupo que llega de otro chat (del gremio a una campaña, o de vuelta). Llega entero;
 * de lo que había aquí solo se queda dónde estaba cada uno.
 *
 * @param {PartyMember[]} carried
 * @param {{worldName: string, uids?: Record<string, number>, atStart?: boolean}} where
 *   `atStart`: en una campaña recién empezada, cada uno a su casilla de salida.
 */
export function adoptCarriedParty(carried, { worldName, uids = {}, atStart = false }) {
    const lead = partyMembers[0]?.mapPosition ?? { locationName: currentLocationName, gridX: 1, gridY: 1 };
    setPartyMembers(hubRoster(settleCarried({ carried, here: partyMembers, worldName, uids, lead }))
        .map(member => migratePartyMember(member)));
    if (atStart) placePartyAtStart(getActiveBoardContext().board);
    savePartyState();
    renderPartyMembers();
    renderLocationMapsPreview();
    if (partyMembers[0]) setUserName(partyMembers[0].name, { toastPersonaNameChange: false });
    if (isShellOpen()) refreshGameShell();
}


/**
 * J4: el final al que ha llegado la campaña abierta, si ha llegado a alguno.
 *
 * @returns {string}
 */
export function plotEndingTitle() {
    const id = String(chat_metadata?.plotEnding || '');
    return id ? String(getPlot()?.endings?.[id]?.title || id) : '';
}


/**
 * Idea 75: si alguien está en una escalera que baja.
 *
 * @returns {any|null} El tablero de abajo.
 */
function stairsHere() {
    if (combatEncounter.active || !currentBoardName) return null;
    const context = getActiveBoardContext();
    const loc = getCurrentWorldLocationMaps().find(l => l.name === currentLocationName);
    const below = nextLevel(context.board, getLocationBoards(loc));
    if (!below) return null;
    const at = partyMembers.filter(m => !m.dead).map(m => ({ x: Number(m.mapPosition?.gridX) || 0, y: Number(m.mapPosition?.gridY) || 0 }));
    return stairsReached(context.terrain, at) ? below : null;
}


/**
 * La cuenta de la semana, dicha antes de que venza.
 *
 * Es la mitad del valor de todo esto: una factura que te sorprende es un impuesto, y una
 * que ves venir es una decision. Por eso se puede preguntar cuando quieras y no aparece
 * solo el dia del cobro.
 *
 * @returns {string}
 */
function showWeeklyBill() {
    const rules = getActiveRuleset();
    // R1: en un modo sin la cuenta (letra b) no hay nada que pagar, y se dice.
    if (!hasLetter(rules?.survival ?? null, 'b')) {
        const said = `En este modo no hay cuenta semanal: ni sueldos, ni posada, ni comida que pagar. ${describeGameMode(rules?.survival ?? null)}.`;
        postCombatNarration(`📒 [CAMPAÑA] ${said}`);
        toastr.info(said, 'La cuenta');
        return said;
    }
    // Los mismos precios que se cobran el viernes: con el gremio y el mercado encima. Leer
    // los de la campana a pelo ensenaba una cuenta y cobraba otra.
    const bill = weeklyBill(partyMembers, { rules: currentUpkeepRules() });

    const today = Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1));
    const due = Number(chat_metadata?.[BILL_DUE_KEY]);
    const daysLeft = Number.isFinite(due) ? Math.max(0, due - today) : 0;

    const lines = describeBill(bill, daysLeft);
    const debt = describeDebt(getDebt(), today);
    if (debt) lines.push(debt);
    lines.push(describeSurvival(rules?.survival ?? null));
    lines.push(describeGameMode(rules?.survival ?? null));
    lines.push(describeMode(rules?.companions ?? null));

    postCombatNarration(`📒 [CAMPAÑA] ${lines.join('\n')}`);
    if (bill.covered) toastr.info(lines.join('\n'), 'La cuenta', { timeOut: 12000 });
    else toastr.warning(lines.join('\n'), 'La cuenta no sale', { timeOut: 15000 });

    return lines.join('\n');
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
 * Lo que el lider lleva encima y puede dar.
 *
 * Lo equipado no se regala: quitarle a alguien la espada que esta empunando en mitad de
 * una conversacion es una forma rara de hacer amigos.
 *
 * @param {any} giver
 * @returns {any[]}
 */
function giveableItems(giver) {
    const equipped = new Set(Object.values(giver?.equippedItems || {}).filter(Boolean));
    return (Array.isArray(giver?.items) ? giver.items : []).filter(item => item && !equipped.has(item.id));
}

/**
 * Regala un objeto: lo cambia de manos y anota lo que le ha parecido.
 *
 * @param {any} giver
 * @param {any} member
 * @param {any} item
 */
function giveGift(giver, member, item) {
    const verdict = judgeGift({ member, item });

    giver.items = (Array.isArray(giver.items) ? giver.items : []).filter(i => i.id !== item.id);
    member.items = [...(Array.isArray(member.items) ? member.items : []), item];
    savePartyState();
    renderPartyMembers();

    postCombatNarration(`🎁 [VINCULO] ${verdict.line}`);
    if (verdict.event) recordCampaignBondEvent(String(member.id), verdict.event);
    if (isShellOpen()) refreshGameShell();
}

/** Cierra la ficha de companero, si hay alguna. */
function closeCompanionCard() {
    $('.cc-overlay').remove();
}

/**
 * La ficha de un companero, al pulsar su cara en la tira del grupo.
 *
 * Abrirla no gasta nada — mirar es gratis —; lo que gasta son sus botones: pasar tiempo
 * se lleva un bloque del dia y regalar se lleva el objeto.
 *
 * @param {string} memberId
 */
function openCompanionCard(memberId) {
    closeCompanionCard();

    const member = partyMembers.find(m => String(m.id) === String(memberId));
    if (!member) return;

    // El tuyo no es un companero: es tu ficha. Y la ficha que se abre es **la de mirar**,
    // no la de editar — el editor tiene desplegables, facciones con casillas y las seis
    // caracteristicas como campos que se escriben, que es lo ultimo que quieres delante
    // en mitad de una partida. Se llega a el desde un boton de la propia ficha.
    const yours = partyMembers[0];
    if (yours && String(yours.id) === String(member.id)) {
        void openOwnSheet(member);
        return;
    }

    const giver = getActivePartyLeader();
    const giverItems = giver && String(giver.id) !== String(member.id) ? giveableItems(giver) : [];
    const card = buildCompanionCard({
        member,
        bonds: getCampaignBonds(),
        calendar: getCampaignCalendar(),
        fighting: combatEncounter.active,
        canLevel: canLevelUp(member),
        giverItems,
    });

    const root = $('<div class="cc-card"></div>');
    // Un clic dentro de la tarjeta no la cierra: cerrarla es el fondo o su boton.
    root.on('click', (event) => event.stopPropagation());

    const head = $('<div class="cc-head"></div>');
    if (card.avatar) head.append($('<img class="cc-avatar">').attr('src', card.avatar).attr('alt', ''));
    const who = $('<div></div>');
    who.append($('<div class="cc-name"></div>').text(card.name));
    who.append($('<div class="cc-rank"></div>').text(card.rankLabel));
    head.append(who);
    root.append(head);

    const bar = $('<div class="cc-bar"></div>');
    bar.append($('<div class="cc-fill"></div>').css('width', `${Math.round(card.progress * 100)}%`));
    root.append(bar);
    root.append($('<div class="cc-points"></div>').text(
        card.maxed ? `${card.points} puntos` : `${card.points} / ${card.nextAt} para el rango ${card.rank + 1}`,
    ));
    // Idea 38: que quiere ahora, en una linea. Y lo que se ha ganado (44, 47, 56).
    const needs = describeNeeds(member);
    const wants = desireLine({
        mourning: mourningFor(member, Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1))),
        wants: readReasons(member).wants,
        hpPct: Math.round(((Number(member.hp) || 0) / Math.max(1, Number(member.maxHp) || 1)) * 100),
        hungry: /hambre|sed/i.test(needs),
        tired: /sueño/i.test(needs),
        gender: member.gender ?? '',
    });
    if (wants) root.append($('<div class="cc-wants"></div>').text(`Ahora: ${wants}`));
    // Idea 28: lo que le ha parecido lo último que hicisteis.
    const liked = approvalOf(chat_metadata?.[APPROVAL_KEY], String(member.id));
    if (liked.recent.length > 0) {
        const box = $('<div class="cc-approval"></div>');
        box.append($('<div class="cc-approval-title"></div>').text('Lo último que le ha parecido'));
        for (const line of liked.recent) box.append($('<div class="cc-approval-line"></div>').text(line));
        root.append(box);
    }
    const earned = [
        member.nickname ? `Le llaman «${member.nickname}»` : '',
        ...traitsOf(member).map(t => t.label),
        ...knacksOf(member),
        ...(Array.isArray(member.scars) ? member.scars : []),
    ].filter(Boolean);
    if (earned.length > 0) root.append($('<div class="cc-earned"></div>').text(earned.join(' · ')));
    // Idea 41: lo que hace fuera del combate.
    const job = campJobOf(member);
    if (job) root.append($('<div class="cc-job"></div>').text(`${job.label}: ${job.effect}`));
    // Idea 35: a quien va primero.
    const preferRow = $('<div class="cc-stance cc-prefer"></div>');
    preferRow.append($('<div class="cc-stance-title"></div>').text('Va primero a'));
    const prefer = String(member.prefer || DEFAULT_PREFERENCE);
    for (const [id, option] of Object.entries(PREFERENCES)) {
        const pick = $('<button class="menu_button cc-prefer-btn" type="button"></button>')
            .attr('data-prefer', id)
            .attr('title', option.description)
            .toggleClass('active', id === prefer)
            .append(`<i class="fa-solid ${option.icon}"></i>`)
            .append($('<span></span>').text(` ${option.label}`));
        pick.on('click', () => {
            member.prefer = id;
            savePartyState();
            preferRow.find('.cc-prefer-btn').removeClass('active');
            pick.addClass('active');
        });
        preferRow.append(pick);
    }
    root.append(preferRow);

    // Como pelea cuando no lo llevas tu. Un clic, y vale tambien en mitad de un combate:
    // es justo cuando se ve que la que tenia no era la buena.
    const stanceRow = $('<div class="cc-stance"></div>');
    stanceRow.append($('<div class="cc-stance-title"></div>').text('En combate'));
    const current = stanceOf(member);
    for (const [id, stance] of Object.entries(STANCES)) {
        const pick = $('<button class="menu_button cc-stance-btn" type="button"></button>')
            .attr('data-stance', id)
            .attr('title', stance.description)
            .toggleClass('active', id === current)
            .append(`<i class="fa-solid ${stance.icon}"></i>`)
            .append($('<span></span>').text(` ${stance.label}`));
        pick.on('click', () => {
            setMemberStance(member, id);
            stanceRow.find('.cc-stance-btn').removeClass('active');
            pick.addClass('active');
        });
        stanceRow.append(pick);
    }
    root.append(stanceRow);

    // Lo que no cura. Un remedio cuesta oro; quedarse en casa cuesta tenerle a tu lado.
    const table = readRemedies();
    const remedies = remediesFor(member, partyPurse(), table);
    const lasting = readInjuries(member).filter(injury => injury.permanent);
    if (lasting.length > 0) {
        const box = $('<div class="cc-remedies"></div>');
        box.append($('<div class="cc-remedy-title"></div>').text(
            `Arrastra: ${lasting.map(injury => injury.label.toLowerCase()).join(', ')}.`));
        // Los remedios los hace un herrero (DL1): aqui se dice donde hay uno.
        if (remedies.length > 0 && !smithHere()) {
            const where = smithPlaces();
            box.append($('<div class="cc-remedy-title"></div>').text(where.length > 0
                ? `Esto lo hace un herrero: en ${where.slice(0, 3).join(', ')}.`
                : 'Esto lo hace un herrero, y por aquí no hay ninguno.'));
        }
        for (const option of remedies) {
            const buy = $('<button class="menu_button cc-remedy-btn" type="button"></button>')
                .attr('data-remedy', option.injuryId)
                .attr('title', option.remedy.description)
                .prop('disabled', combatEncounter.active || !option.affordable || !smithHere())
                .text(`${option.remedy.label} — ${option.remedy.cost} de oro`);
            buy.on('click', () => {
                closeCompanionCard();
                buyRemedy(member, option.injuryId);
            });
            box.append(buy);
        }

        if (!combatEncounter.active) {
            box.append($('<div class="cc-remedy-title"></div>').text(shouldOfferRetirement(member)
                ? 'Ya no está para salir. Puede quedarse en casa:'
                : 'O quedarse en casa, si lo prefieres:'));
            for (const [role, job] of Object.entries(STAFF_ROLES)) {
                const stay = $('<button class="menu_button cc-remedy-btn" type="button"></button>')
                    .attr('data-retire', role)
                    .attr('title', job.describe)
                    .text(`${job.label}: ${job.describe}`);
                stay.on('click', () => {
                    closeCompanionCard();
                    retireMember(member, role);
                });
                box.append(stay);
            }
        }
        root.append(box);
    }

    const actions = $('<div class="cc-actions"></div>');
    for (const action of card.actions) {
        const button = $('<button class="menu_button cc-btn" type="button"></button>');
        button.append(`<i class="fa-solid ${action.icon}"></i>`);
        button.append($('<span></span>').text(` ${action.label}`));
        button.attr('title', action.why);
        button.prop('disabled', !action.enabled);
        button.on('click', () => {
            if (action.id === 'level') {
                closeCompanionCard();
                void openLevelUpCard(member);
                return;
            }

            if (action.id === 'downtime') {
                closeCompanionCard();
                recordCampaignBondEvent(String(member.id), 'shared_downtime');
                advanceCampaignSlot();
                return;
            }
            if (action.id === 'gift') {
                renderGiftList();
                return;
            }
            closeCompanionCard();
            recordCampaignBondEvent(String(member.id), action.id.slice('event:'.length));
        });
        actions.append(button);
    }
    root.append(actions);

    const gifts = $('<div class="cc-gifts"></div>');
    root.append(gifts);

    function renderGiftList() {
        if (gifts.children().length > 0) {
            gifts.empty();
            return;
        }
        gifts.append($('<div class="cc-gifts-title"></div>').text('Lo que llevas encima'));
        for (let index = 0; index < card.gifts.length; index++) {
            const gift = card.gifts[index];
            const item = giverItems[index];
            const button = $('<button class="menu_button cc-gift" type="button"></button>').text(gift.name);
            // Lo que va a pasar se dice antes de pulsar, no despues.
            button.attr('title', gift.verdict.points === 0
                ? 'No le dice nada en especial'
                : `${gift.verdict.points > 0 ? '+' : ''}${gift.verdict.points} al vínculo`);
            button.on('click', () => {
                closeCompanionCard();
                giveGift(giver, member, item);
            });
            gifts.append(button);
        }
    }

    const close = $('<button class="menu_button cc-btn cc-close" type="button"></button>').text('Cerrar');
    close.on('click', () => closeCompanionCard());
    root.append(close);

    $('body').append($('<div class="cc-overlay"></div>').on('click', () => closeCompanionCard()).append(root));
}

/** @returns {number} El oro de todo el grupo, que es de todos. */
export function partyPurse() {
    return partyMembers.reduce((sum, m) => sum + Math.max(0, Number(m.gold) || 0), 0);
}

/**
 * Pagar del bolsillo del grupo, empezando por quien mas lleva.
 *
 * @param {number} amount
 * @returns {boolean} Si llegaba.
 */
export function payFromParty(amount) {
    if (partyPurse() < amount) return false;
    let owed = amount;
    for (const member of [...partyMembers].sort((a, b) => (Number(b.gold) || 0) - (Number(a.gold) || 0))) {
        if (owed <= 0) break;
        const has = Math.max(0, Number(member.gold) || 0);
        const taken = Math.min(has, owed);
        member.gold = has - taken;
        owed -= taken;
    }
    return true;
}

/**
 * Comprar el remedio de una herida que no cura.
 *
 * @param {any} member
 * @param {string} injuryId
 * @returns {string}
 */
function buyRemedy(member, injuryId) {
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
 * Cambiar la postura de alguien.
 *
 * @param {any} member
 * @param {string} stance
 * @returns {string}
 */
function setMemberStance(member, stance) {
    if (!(stance in STANCES)) return '';
    member.stance = stance;
    savePartyState();
    const label = STANCES[/** @type {keyof typeof STANCES} */ (stance)].label;
    toastr.info(`${member.name}: ${label.toLowerCase()}.`);
    return `${member.name}: ${label}`;
}

/**
 * Las puertas cerradas del tablero abierto, con lo lejos que le quedan al grupo.
 *
 * @returns {Array<{x: number, y: number, distance: number}>}
 */
function closedDoorsNearParty() {
    if (!currentBoardName) return [];
    const context = getActiveBoardContext();
    const cells = context.terrain?.cells || {};

    /** @type {Array<{x: number, y: number, distance: number}>} */
    const doors = [];
    for (const [key, cell] of Object.entries(cells)) {
        if (!cell || cell.type !== 'door' || cell.open) continue;
        const parsed = parseCellKey(key);
        if (!parsed) continue;

        const distances = partyMembers.map(m => getDistanceInFeet(
            Number(m.mapPosition?.gridX) || 0, Number(m.mapPosition?.gridY) || 0,
            parsed.x, parsed.y));
        doors.push({
            x: parsed.x,
            y: parsed.y,
            distance: distances.length > 0 ? Math.min(...distances) : Number.MAX_SAFE_INTEGER,
        });
    }
    return doors;
}

/**
 * A quien nombra lo ultimo que se ha narrado.
 *
 * No crea a nadie: solo sirve para poner delante al companero del que se estaba hablando.
 *
 * @returns {string[]}
 */
function namesInLastNarration() {
    const last = [...(chat || [])].reverse().find(m => m && !m.is_user && !m.is_system);
    const text = String(last?.mes || '').toLowerCase();
    if (!text) return [];
    return partyMembers.map(m => m.name).filter(name => text.includes(String(name).toLowerCase()));
}

/**
 * Lo que se puede hacer sin escribirlo, para la fila de fichas del Modo Juego.
 *
 * @returns {import('../game-engine/ui/shell/action-chips.js').ActionChip[]}
 */
/**
 * Z3: lo que hay aquí, para leer la caja con los nombres de aquí.
 *
 * @returns {import('../game-engine/campaign/read-box.js').BoxContext}
 */
function boxContext() {
    const location = hereLocation();
    const shop = buildServiceCards().find(c => c.id === 'tienda');
    return {
        fighting: Boolean(combatEncounter.active),
        foes: combatEncounter.active ? getAliveEnemies().map((/** @type {any} */ e) => String(e.name)) : [],
        places: neighbourPlaces(),
        boards: currentBoardName ? [] : getLocationBoards(location).map((/** @type {any} */ b) => String(b.name)),
        onBoard: Boolean(currentBoardName),
        people: lastWorldNpcs.filter(n => !n.dead && n.where.toLowerCase() === String(currentLocationName).toLowerCase()).map(n => n.name),
        companions: partyMembers.slice(1).filter(m => !m.dead).map(m => String(m.name)),
        services: location ? servicesOf(location) : [],
        wares: (shop?.actions ?? []).filter(a => a.id.startsWith('shop-buy:')).map(a => a.id.slice('shop-buy:'.length)),
        goods: (shop?.actions ?? []).filter(a => a.id.startsWith('shop-sell:')).map(a => a.label.replace(/^Vender /, '').replace(/ \(\d+ de oro\)$/, '')),
    };
}

/** Z3: mientras la caja la lee el motor, lo escrito no se vuelve a leer como mensaje. */
let readingBox = false;

/**
 * Z3 de ROADMAP_SIN_TOKENS: sin modelo, la caja la lee el motor. Lo escrito queda en el
 * chat, como siempre, y se hace lo que dice; si no lo entiende, lo dice y enseña qué se
 * puede escribir aquí.
 *
 * @param {string} said
 * @returns {Promise<void>}
 */
async function readTheBox(said) {
    await ensureWorldData();
    const context = boxContext();
    const intent = readBox(said, context);
    readingBox = true;
    try {
        await sendMessageAsUser(said, '');
    } finally {
        readingBox = false;
    }
    await doBoxIntent(intent, context);
    if (isShellOpen()) refreshGameShell();
}

/**
 * Hacer lo que la caja entendió: lo mismo que la ficha o el comando de siempre.
 *
 * @param {import('../game-engine/campaign/read-box.js').BoxIntent} intent
 * @param {import('../game-engine/campaign/read-box.js').BoxContext} context
 * @returns {Promise<void>}
 */
async function doBoxIntent(intent, context) {
    const run = (/** @type {string} */ command) => import('../slash-commands.js').then(m => m.executeSlashCommandsWithOptions(command));
    const name = String(intent.name ?? '');
    const shopAction = (/** @type {string} */ prefix, /** @type {string} */ item) => buildServiceCards().find(c => c.id === 'tienda')
        ?.actions.find(a => a.id.startsWith(prefix) && (a.id.includes(item) || a.label.includes(item)))?.id ?? '';
    switch (intent.do) {
        case 'go': {
            const { reason } = await travelWithTime(name, { confirm: askBeforeTravelling });
            if (reason) toastr.info(reason, 'No se puede viajar');
            renderLocationMapsPreview();
            return;
        }
        case 'enter': await run(`/enter ${name}`); return;
        case 'leave': await run('/leave'); return;
        case 'service': openService(name); return;
        case 'talk': startTalk(name, '', String(intent.topic ?? '')); return;
        case 'threaten': startTalk(name, '', 'amenazar'); return;
        case 'duel': await run(`/convencer ${name}`); return;
        case 'pry': await run(`/sonsacar ${name}`); return;
        case 'round': {
            const member = intent.companion ? partyMembers.find(m => String(m.name) === name) : null;
            if (member) await runService(`inn-round:${member.id}`);
            else startTalk(name, '', 'ronda');
            return;
        }
        case 'attack': handlePlayerCombatAttack(name); return;
        case 'move': handlePlayerCombatMove(`${intent.x} ${intent.y}`); return;
        case 'end-turn': endPlayerCombatTurn(); return;
        case 'check': {
            // «Observo a Torres»: la tirada es con él delante.
            const npc = name ? worldNpc(name) : null;
            if (npc) setTalkingTo(npc.name);
            runSkillCheck(String(intent.skill), '', String(intent.what ?? ''));
            return;
        }
        case 'rest': await run(`/descanso ${intent.long ? 'largo' : 'corto'}`); return;
        case 'camp': await run('/acampar'); return;
        case 'explore': await run('/explorar'); return;
        case 'forage': await run('/forrajear'); return;
        case 'rumor': await run('/rumor'); return;
        case 'wait': {
            // Hasta el momento pedido, o un rato; nunca más de un día.
            const slots = getCampaignCalendar()?.slots ?? [];
            if (intent.until && slots[Number(getCampaignCalendar()?.slotIndex) || 0]?.id === intent.until) {
                postCombatNarration(`⏳ [CAMPAÑA] Ya es ${String(getCurrentSlotLabel() || '').toLowerCase()}.`);
                return;
            }
            for (let step = 0; step < 3; step++) {
                advanceCampaignSlot();
                const now = getCampaignCalendar();
                if (!intent.until || slots[Number(now?.slotIndex) || 0]?.id === intent.until) break;
            }
            postCombatNarration(`⏳ [CAMPAÑA] Esperáis. Ya es ${String(getCurrentSlotLabel() || '').toLowerCase()}.`);
            return;
        }
        case 'buy': {
            const id = name ? shopAction('shop-buy:', name) : '';
            if (id) await runService(id);
            else openService('tienda');
            return;
        }
        case 'sell': {
            const id = name === '*' ? 'shop-junk' : name ? shopAction('shop-sell:', name) : '';
            if (id) await runService(id);
            else openService('tienda');
            return;
        }
        case 'steal': {
            const id = shopAction('shop-steal:', name);
            if (id) await runService(id);
            else openService('tienda');
            return;
        }
        case 'help': openHelp(); return;
        case 'journal': openJournalSafely(); return;
        default: {
            const why = explainMiss(intent, context) || 'Eso no lo sé hacer sin narrador.';
            const tries = boxExamples(context).map(e => `«${e}»`).join(' · ');
            postCombatNarration(`🤔 [CAJA] ${why} Prueba: ${tries}. O pulsa una ficha, o «¿Qué hago?».`);
        }
    }
}

/**
 * A dónde se puede ir desde aquí, de un solo camino: los vecinos abiertos.
 *
 * @returns {string[]}
 */
function neighbourPlaces() {
    const reach = reachFrom({
        from: currentLocationName, locations: getCurrentWorldLocationMaps(),
        friendly: friendlyFactions(), season: currentSeason(), done: readPlotState(chat_metadata?.[PLOT_STATE_KEY]).done,
    });
    return Object.entries(reach).filter(([, way]) => way.reach === 'near').map(([name]) => name);
}

/**
 * Los tableros de este sitio que la historia pide ganar ahora.
 *
 * @param {any} location
 * @returns {string[]}
 */
function threadBoardsHere(location) {
    const plot = getPlot();
    if (!plot || !location) return [];
    const open = new Set(readPlotState(chat_metadata?.[PLOT_STATE_KEY]).open);
    const here = new Set(getLocationBoards(location).map((/** @type {any} */ b) => String(b.name)));
    return [...new Set(plot.milestones
        .filter(m => open.has(m.id) && m.asks?.kind === 'win' && here.has(String(m.asks.board ?? ''))
            && (!m.asks.place || String(m.asks.place).toLowerCase() === String(currentLocationName).toLowerCase())
            && !isBoardWon(currentLocationName, String(m.asks.board)))
        .map(m => String(m.asks.board)))];
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

/**
 * Idea 144: lo que se le puede decir a quien se está hablando, si sigue aquí.
 *
 * @returns {Array<{id: string, label: string, icon: string, draft?: string, command?: string}>}
 */
function currentReplies() {
    if (!talkingTo || combatEncounter.active) return [];
    const npc = lastWorldNpcs.find(n => n.name === talkingTo && n.where.toLowerCase() === String(currentLocationName).toLowerCase());
    if (!npc) return [];
    const pry = canPry({ npc, here: currentLocationName, secrets: chat_metadata?.[SECRETS_KEY], today: Math.max(1, campaignDay()) });
    // U8 y U6 del pegamento: preguntarle por el caso, si sabe algo; y convencerle, una vez al día.
    /** @type {any[]} */
    const extra = [];
    const mystery = readCases(chat_metadata?.[CASES_KEY]);
    if (cluesHere(mystery, { person: npc.name }).length > 0) {
        extra.push({ id: 'reply-case', label: `Preguntar a ${npc.name} por lo de ${mystery.active?.victim}`, icon: 'fa-magnifying-glass', command: `/caso preguntar ${npc.name}` });
    }
    if (canDuel(npc.name)) extra.push({ id: 'reply-duel', label: `Convencer a ${npc.name}`, icon: 'fa-comments', command: `/convencer ${npc.name}` });
    // Quien os planta cara no pregunta qué necesitáis: se le contesta (2026-09-28).
    return repliesFor({ name: npc.name, rumors: rumorsLeftHere(), canPry: pry.ok, extra, confronting: confrontingNow(npc.name) })
        .map(reply => (reply.action === 'pry' ? { ...reply, command: `/sonsacar ${npc.name}` } : reply));
}

/**
 * Idea 110: sonsacarle a alguien lo que esconde. Perspicacia, una vez al día por persona.
 * Si sale, su secreto pasa a la ficha que lee el narrador: desde entonces habla distinto.
 *
 * @param {string} name
 * @returns {Promise<string>}
 */
async function pryNpc(name) {
    const npc = lastWorldNpcs.find(n => n.name.toLowerCase() === String(name ?? '').trim().toLowerCase());
    const today = Math.max(1, campaignDay());
    const verdict = npc ? canPry({ npc, here: currentLocationName, secrets: chat_metadata?.[SECRETS_KEY], today }) : { ok: false, reason: 'No hay nadie así aquí.' };
    if (!npc || !verdict.ok || !chat_metadata) {
        toastr.info(verdict.reason, 'Sonsacar');
        return '';
    }
    const who = partyMembers.filter(m => !m.dead && (Number(m.hp) || 0) > 0)
        .reduce((/** @type {any} */ best, m) => (!best || skillModifier(m, SECRET_SKILL).modifier > skillModifier(best, SECRET_SKILL).modifier ? m : best), null);
    if (!who) return '';
    // Idea 59: sonsacar a quien habla otra lengua, también con desventaja si nadie la entiende.
    const barrier = listenerBarrier(who, SECRET_SKILL, npc.name);
    if (barrier.note) postCombatNarration(`🗣️ [CAMPAÑA] ${barrier.note}`);
    const roll = rollCheck({
        member: who, skill: SECRET_SKILL, rollD20: () => rollDiceDetailed('1d20', 20).total, dc: SECRET_DC,
        ...(barrier.edge ? { edge: barrier.edge, why: 'no habla su lengua' } : {}),
    });
    if (!roll) return '';
    showCombatDiceRoll({
        title: `${who.name}: ${roll.label}`,
        subtitle: `Sonsacar a ${npc.name}`,
        formula: `1d20${roll.modifier >= 0 ? '+' : ''}${roll.modifier}`,
        detail: `d20(${roll.natural}) ${roll.modifier >= 0 ? '+' : ''}${roll.modifier} = ${roll.total}`,
        total: roll.total,
        dc: roll.dc,
        natural: roll.natural,
        glyph: 'd20',
    });
    postCombatNarration(roll.said);
    chat_metadata[SECRETS_KEY] = notePry(chat_metadata[SECRETS_KEY], { name: npc.name, secret: String(npc.secret) }, roll.success, today);
    saveMetadata();
    if (roll.success) {
        const worldName = String(chat_metadata?.[METADATA_KEY] || '');
        await worldWrite(async () => {
            const data = await loadWorldInfo(worldName);
            const entry = Object.values(data?.entries ?? {}).find((/** @type {any} */ e) => e?.dndData?.entityType === 'npc'
                && String(e.dndData?.name || e.comment || '').toLowerCase() === npc.name.toLowerCase());
            if (!data || !entry) return;
            const note = secretNote(String(npc.secret));
            if (!String(/** @type {any} */ (entry).content || '').includes(note)) {
                /** @type {any} */ (entry).content = `${String(/** @type {any} */ (entry).content || '')} ${note}`.trim();
                await saveWorldInfo(worldName, data, true);
            }
        });
        noteDeed(`${who.name} le sacó a ${npc.name} su secreto.`);
        toastr.success(String(npc.secret), `🗝️ Lo que escondía ${npc.name}`, { timeOut: 12000 });
        await postForModel(`[SECRETO] ${who.name} le saca a ${npc.name} lo que escondía: ${npc.secret} `
            + 'Cuéntalo en su voz, a regañadientes. No inventes nada más.');
    } else {
        toastr.info(`${npc.name} se cierra en banda. Hoy no hay nada que sacarle.`, 'Sonsacar', { timeOut: 8000 });
    }
    if (isShellOpen()) refreshGameShell();
    return roll.said;
}

/**
 * Dejar una frase empezada en el cuadro del chat, con el cursor al final.
 *
 * @param {string} text
 */
function draftInChat(text) {
    const input = /** @type {HTMLTextAreaElement|null} */ (document.querySelector('#send_textarea'));
    if (!input) return;
    input.value = text;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    input.dispatchEvent(new Event('input', { bubbles: true }));
}


/** Motor: 0 tokens. Mixto: el motor cuenta y el modelo añade en lo que importa. Modelo: como antes. */
const NARRATOR_MODES = ['motor', 'mixto', 'modelo'];

/** Z6: cómo se llama cada modo en la pausa, y qué quiere decir. */
const NARRATOR_LABELS = { motor: 'Motor (0 tokens)', mixto: 'Mixto', modelo: 'Modelo' };
const NARRATOR_HINTS = {
    motor: 'Todo lo cuenta el juego y no se gasta ni un token. Lo que escribes en la caja lo lee el juego.',
    mixto: 'El juego cuenta y resuelve, y hace lo que entiende de la caja; el modelo contesta lo demás y a quien le hablas.',
    modelo: 'Como antes: cuenta el modelo, y las fichas de hablar dejan la frase empezada.',
};

/**
 * El modo elegido, o «mixto» si no se ha elegido nunca (DZ3).
 *
 * @returns {string}
 */
function storedNarratorMode() {
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
function narratorMode() {
    return online_status === 'no_connection' || offlineGame() ? 'motor' : storedNarratorMode();
}

/**
 * J4: una partida del gremio (el gremio o una campaña empezada desde él) se juega sin
 * conexión: la cuenta el motor aunque haya un proveedor conectado.
 *
 * @returns {boolean}
 */
function offlineGame() {
    return Boolean(lastHub) || Boolean(lastHubHome);
}

/**
 * Si el modelo lo cuenta todo, como antes: la tirada espera al mensaje, hablar deja la frase
 * empezada. En «Motor» y en «Mixto», el motor resuelve y cuenta, y nada espera a un mensaje
 * enviado, que sin modelo no se envía (ROADMAP_SIN_TOKENS, Z0).
 *
 * @returns {boolean}
 */
function modelNarrates() {
    return narratorMode() === 'modelo';
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
 * Idea 59: cómo va una tirada de trato con quien se está hablando, por la lengua.
 *
 * @param {any} speaker
 * @param {string} skill
 * @param {string} [name] Con quién, si no es con quien se está hablando.
 * @returns {{edge: ''|'disadvantage', by: string, note: string}}
 */
function listenerBarrier(speaker, skill, name = '') {
    const who = String(name || talkingTo || '');
    const listener = who
        ? lastWorldNpcs.find(n => n.name.toLowerCase() === who.toLowerCase() && n.where.toLowerCase() === String(currentLocationName).toLowerCase())
        : null;
    if (!listener?.language) return { edge: '', by: '', note: '' };
    return languageBarrier({ speaker, party: partyMembers, language: listener.language, skill, listener: listener.name });
}

/**
 * Intentar algo fuera de combate: el motor tira y el narrador lee el resultado.
 *
 * El resultado viaja **dentro de tu mensaje**, que es lo unico que el modelo lee seguro.
 * Se guarda hasta que lo envias: volver a pulsar da la misma tirada, no otra.
 *
 * @param {string} skill
 * @param {string} [keep] Lo que ya estaba escrito: la tirada va delante y lo escrito se queda.
 * @param {string} [what] Z3: lo que se intenta, en infinitivo, para contarlo sin modelo.
 * @returns {string}
 */
function runSkillCheck(skill, keep = '', what = '') {
    // Idea 138: si la pidio el narrador, con su dificultad, y la peticion se gasta.
    const asked = takeRequest(chat_metadata?.[CHECK_REQUESTS_KEY], skill, SKILLS);
    if (combatEncounter.active) {
        toastr.warning('En combate se pelea con la barra de abajo.');
        return '';
    }
    // Quién cuenta la tirada: el modelo si narra él; en «Mixto», también si la pidió él (idea
    // 138) o si hay algo escrito en la caja (lo vas a enviar, y la tirada va delante para que
    // la lea). Si no, el motor.
    const toModel = modelNarrates() || (narratorMode() === 'mixto' && (Boolean(asked.request) || Boolean(String(keep).trim())));
    const pending = chat_metadata?.[PENDING_CHECK_KEY];
    if (pending?.draft && toModel) {
        toastr.info('Ya has tirado. Envia el mensaje antes de intentar otra cosa.');
        draftInChat(String(pending.draft));
        return String(pending.line || '');
    }
    // Sin modelo no hay mensaje que la gaste: una pendiente de antes no bloquea nada (y una
    // partida que se quedó así, tras recargar, se desatasca aquí).
    if (pending && chat_metadata) delete chat_metadata[PENDING_CHECK_KEY];

    const member = partyMembers[0];
    if (!member) {
        toastr.warning('No hay nadie en el grupo que pueda intentarlo.');
        return '';
    }
    // Idea 59: si se habla con alguien de aquí que habla otra lengua.
    const barrier = listenerBarrier(member, skill);
    if (barrier.note) postCombatNarration(`🗣️ [CAMPAÑA] ${barrier.note}`);
    const result = rollCheck({
        member, skill, rollD20: () => rollDiceDetailed('1d20', 20).total,
        // Idea 140: la actitud de con quien se habla baja o sube lo que hace falta.
        dc: (asked.request ? asked.request.dc : DEFAULT_DC) - (SOCIAL_SKILLS.includes(skill) && talkingTo ? attitudeTowards(talkingTo) : 0),
        ...(barrier.edge ? { edge: barrier.edge, why: 'no habla su lengua' } : {}),
    });
    if (result && asked.request && chat_metadata) chat_metadata[CHECK_REQUESTS_KEY] = asked.requests;
    if (!result) {
        toastr.warning(`No conozco esa tirada. Hay: ${Object.keys(SKILLS).join(', ')}.`);
        return '';
    }

    // Z3: sin modelo, fallar por poco sale a medias: se consigue, pero se paga.
    const halfway = !toModel && checkOutcome(result) === 'medias';
    showCombatDiceRoll({
        title: `${member.name}: ${result.label}`,
        subtitle: result.success ? 'Sale' : halfway ? 'A medias' : 'No sale',
        formula: `1d20${result.modifier >= 0 ? '+' : ''}${result.modifier}`,
        detail: `d20(${result.natural}) ${result.modifier >= 0 ? '+' : ''}${result.modifier} = ${result.total}`,
        total: result.total,
        dc: result.dc,
        natural: result.natural,
        glyph: 'd20',
    });

    // Con modelo, la consecuencia la cuenta él con el mensaje que se envíe; sin modelo, la
    // tirada se cuenta aquí, y hace algo (Z3): no hay mensaje que esperar.
    if (toModel) chat_metadata[PENDING_CHECK_KEY] = { line: result.line, draft: result.draft };
    else tellCheck(member, result, what);
    // Idea 107: con el sitio, que es donde está la pista.
    notePlot({ kind: 'check', skill, success: result.success, place: currentLocationName });
    // Un encargo que se resuelve sin pelear se da por hecho con una tirada buena en su sitio.
    const takenNow = chat_metadata?.[TAKEN_KEY];
    if (settlesNoFight(takenNow, { place: currentLocationName, success: result.success })) finishTakenContract(takenNow);
    saveMetadata();
    if (toModel) draftInChat(String(keep).trim() ? `${result.line}\n${String(keep).trim()}` : result.draft);
    if (isShellOpen()) refreshGameShell();
    return result.line;
}

/**
 * Z3 de ROADMAP_SIN_TOKENS: sin modelo, una tirada se cuenta y hace algo. Bien, a medias o
 * mal, y cada resultado con su efecto en lo que ya existe: una pista del caso, un rumor,
 * unas monedas, algo de comer, un rato del día, una herida, o cómo os mira con quien se
 * habla.
 *
 * @param {any} member Quien lo intenta.
 * @param {{skill: string, success: boolean, total: number, dc: number, natural: number, said: string}} result
 * @param {string} [what] Lo que se intentaba, en infinitivo.
 * @returns {void}
 */
function tellCheck(member, result, what = '') {
    const outcome = checkOutcome(result);
    const gains = fieldGainsToday();
    const key = `${currentLocationName}|${result.skill}`;
    const fresh = !gains.keys.includes(key);
    const npc = talkingTo ? worldNpc(talkingTo) : null;
    const cases = readCases(chat_metadata?.[CASES_KEY]);
    const clue = cases.active ? cluesHere(cases, { place: currentLocationName }).find(c => !cases.found.includes(c.id)) ?? null : null;
    const effects = consequence({
        skill: result.skill,
        outcome,
        can: {
            pista: Boolean(clue), rumor: rumorsLeftHere() > 0, oro: fresh, comida: fresh,
            mirada: Boolean(npc), sabe: Boolean(npc?.knows), busca: Boolean(npc?.wants),
        },
    });
    const said = outcome === 'medias' ? result.said.replace(/ ✗ Fallo\b/, ' ✗ A medias') : result.said;
    const prose = tellMoment(`tirada-${outcome}`, { quien: String(member?.name || ''), que: String(what || '').trim(), habilidad: result.skill });
    /** @type {string[]} */
    const notes = [];
    /** @type {Array<() => void>} */
    const after = [];
    let gained = false;
    for (const effect of effects) {
        if (effect.kind === 'pista' && clue) after.push(() => revealClue(clue));
        else if (effect.kind === 'rumor') after.push(() => { void hearRumor(); });
        else if (effect.kind === 'oro') {
            const gold = Math.max(1, rollDiceDetailed(String(effect.amount || '1d4'), 4).total);
            member.gold = (Number(member.gold) || 0) + gold;
            notes.push(`Encontráis ${gold} de oro.`);
            gained = true;
        } else if (effect.kind === 'comida') {
            for (const one of partyMembers) {
                if (!one.dead) one.needs = relieve(one, 'ate');
            }
            notes.push('Algo de comer: se os pasa el hambre.');
            gained = true;
        } else if (effect.kind === 'hora') {
            // El reloj, detrás de la tirada: si no, el aviso de la hora salía antes que ella.
            after.unshift(() => { advanceCampaignSlot(); });
            notes.push('Se os va un rato.');
        } else if (effect.kind === 'herida') {
            const before = Number(member.hp) || 0;
            const hurt = /d/.test(String(effect.amount)) ? rollDiceDetailed(String(effect.amount), 4).total : Number(effect.amount) || 1;
            member.hp = Math.max(1, before - hurt);
            if (before > member.hp) notes.push(`${member.name} se hace daño: −${before - member.hp} de vida.`);
        } else if (effect.kind === 'mirada' && npc) {
            const delta = Number(effect.amount) || 0;
            after.push(() => { changeAttitude(npc.name, delta, delta > 0 ? 'le habéis convencido' : 'no le ha gustado'); });
        } else if (effect.kind === 'sabe' && npc?.knows) {
            after.push(() => { sayInTalk(npc, threatAnswer({ npc, success: true }), `${npc.name} lo suelta: ${npc.knows}`); });
        } else if (effect.kind === 'busca' && npc?.wants) {
            const wants = String(npc.wants).trim();
            notes.push(`Le caláis: lo que de verdad busca ${npc.name} es ${wants.charAt(0).toLocaleLowerCase('es')}${wants.slice(1)}`);
        }
    }
    if (outcome !== 'mal' && effects.length === 0 && !fresh) notes.push('Aquí ya no queda nada más que sacar hoy.');
    if (gained && chat_metadata) chat_metadata[FIELD_GAINS_KEY] = { ...gains, keys: [...gains.keys, key] };
    postCombatNarration(`🎲 [TIRADA] ${[`${said}.`, prose, ...notes].filter(Boolean).join(' ')}`);
    for (const run of after) run();
    savePartyState();
}

/**
 * Z3: lo que se puede examinar aquí sin que nadie lo ofrezca: dos cosas del sitio, cada una
 * con su tirada, una vez al día. Es la versión del motor de «Buscar X» y de la tirada que
 * pide el sitio, que antes solo ofrecía el modelo.
 *
 * @returns {Array<{id: string, label: string, icon: string, command: string}>}
 */
function lookChips() {
    if (!currentLocationName || currentBoardName || combatEncounter.active || !lastCompendium?.has?.('frases')) return [];
    const place = hereLocation();
    const tipo = String(place?.locationType || place?.type || '');
    const rows = lastCompendium.find('frases', { kind: 'mirar', ...(tipo ? { tipo } : {}) });
    const own = rows.filter((/** @type {any} */ r) => r.when?.tipo);
    const pool = own.length > 0 ? own : rows;
    const random = createSeededRandom(derive(String(chat_metadata?.[METADATA_KEY] || ''), 'mirar', currentLocationName, String(campaignDay())));
    const looked = fieldGainsToday().looked;
    return pool.map((/** @type {any} */ row) => ({ row, at: random() }))
        .sort((a, b) => a.at - b.at)
        .slice(0, 2)
        .map(({ row }) => row)
        .filter((/** @type {any} */ row) => !looked.includes(`${currentLocationName}|${row.id}`))
        .map((/** @type {any} */ row) => ({
            id: `look:${row.id}`,
            label: `${String(row.verbo).charAt(0).toLocaleUpperCase('es')}${String(row.verbo).slice(1)} ${row.text}`,
            icon: SKILLS[/** @type {keyof typeof SKILLS} */ (row.skill)]?.icon ?? 'fa-eye',
            command: `/examinar ${row.id}`,
        }));
}

/**
 * Z3: examinar algo de aquí. Una de las cosas del sitio (por su id) o lo que se escriba:
 * «/examinar la cerradura del baúl».
 *
 * @param {string} value
 * @returns {Promise<void>}
 */
async function lookAt(value) {
    const wanted = String(value ?? '').trim();
    if (!wanted) return;
    const row = lastCompendium?.has?.('frases')
        ? lastCompendium.find('frases', { kind: 'mirar' }).find((/** @type {any} */ r) => r.id === wanted) : null;
    if (row) {
        const gains = fieldGainsToday();
        if (chat_metadata) chat_metadata[FIELD_GAINS_KEY] = { ...gains, looked: [...gains.looked, `${currentLocationName}|${row.id}`] };
        runSkillCheck(String(row.skill), '', `${row.verbo} ${row.text}`);
    } else {
        const intent = readBox(`examino ${wanted}`, boxContext());
        runSkillCheck(String(intent.skill || 'investigation'), '', intent.what || `examinar ${wanted}`);
    }
    if (isShellOpen()) refreshGameShell();
}

/**
 * Hablar con alguien: el hilo se entera, y con modelo queda la frase empezada para que la
 * termine quien juega. Sin modelo, se abre la charla (Z2).
 *
 * @param {string} name
 * @param {string} [draft] La frase empezada, para el modelo.
 * @param {string} [ask] Z3: de qué preguntar nada más abrir (`sabe`, `rumor`…) o qué hacer (`amenazar`, `ronda`).
 * @returns {void}
 */
function startTalk(name, draft = '', ask = '') {
    const who = String(name ?? '').trim();
    if (!who) return;
    notePlot({ kind: 'talk', npc: who, place: currentLocationName });
    // Desde ahora se habla con él: con modelo, contesta él (y no el narrador).
    const known = worldNpc(who)?.name ?? partyMembers.slice(1).find(m => !m.dead && String(m.name).toLowerCase() === who.toLowerCase())?.name;
    if (known) {
        setTalkingTo(String(known));
        if (isShellOpen()) setTimeout(() => refreshGameShell(), 0);
    }
    if (modelNarrates()) {
        draftInChat(draft || `Le digo a ${who}: `);
        return;
    }
    // Z2: la charla, con temas y respuestas del motor.
    void openTalk(who, draft, ask);
}

/**
 * La gente del mundo por su nombre.
 *
 * @param {string} name
 * @returns {any|null}
 */
function worldNpc(name) {
    const who = String(name ?? '').trim().toLowerCase();
    return lastWorldNpcs.find(n => n.name.toLowerCase() === who) ?? null;
}

/**
 * Lo que dice alguien en una charla: la frase del banco (o, si no hay, el dato tal cual),
 * en la ventana y en el chat, con los hechos para el modelo si lo hay.
 *
 * @param {any} npc
 * @param {{moment: string, facts: Record<string, any>}|null} plan
 * @param {string} fallback Lo que se dice si el banco no tiene frase.
 * @returns {string}
 */
function sayInTalk(npc, plan, fallback) {
    const line = (plan ? tellMoment(plan.moment, plan.facts) : '') || fallback;
    if (line) void postForModel(talkNote(npc, line), { show: `🗣️ [GENTE] ${line}` });
    return line;
}

/**
 * Z2 de ROADMAP_SIN_TOKENS: hablar con alguien sin modelo. Una ventana con de qué se puede
 * hablar (lo que sabe, lo que busca, lo que se cuenta, el caso) y qué se puede hacer
 * (convencer, sonsacar, amenazar, invitar a una ronda). Lo que contesta depende de cómo os
 * mire; y lo que dice queda en la ventana y en el chat.
 *
 * @param {string} name
 * @param {string} [draft] La frase empezada, para decírselo con tus palabras si hay modelo.
 * @param {string} [ask] Z3: lo que se pidió al escribirlo: un tema o una acción (`amenazar`, `ronda`).
 * @returns {Promise<void>}
 */
async function openTalk(name, draft = '', ask = '') {
    await ensureWorldData();
    const npc = worldNpc(name);
    // Un compañero, o alguien que el mundo no conoce: una línea, y la caja si hay modelo.
    if (!npc) {
        postCombatNarration(`🗣️ [GENTE] Hablas con ${name}.`);
        if (narratorMode() !== 'motor') draftInChat(draft || `Le digo a ${name}: `);
        return;
    }
    setTalkingTo(npc.name);
    // Cómo os mira de verdad ahora: quien os planta cara no os mira neutral (2026-09-28).
    const attitude = () => attitudeTowards(npc.name);
    const confronting = confrontingNow(npc.name);
    // Si se le ha calado (sonsacado con éxito): abre lo que busca y lo que piensa de vosotros.
    const read = () => Boolean(readSecrets(chat_metadata?.[SECRETS_KEY]).known[npc.name]);
    const same = (/** @type {any} */ a) => String(a ?? '').toLowerCase() === npc.name.toLowerCase();
    const milestone = openMilestones().find(m => m?.asks?.kind === 'talk' && same(m.asks.npc)) ?? null;
    const heard = Array.isArray(chat_metadata?.[RUMORS_HEARD_KEY]) ? chat_metadata[RUMORS_HEARD_KEY] : [];
    const hasRumor = () => lastRumors.some(r => same(r.by) && !heard.includes(r.id));
    const cases = readCases(chat_metadata?.[CASES_KEY]);
    const hasCase = Boolean(cases.active) && cluesHere(cases, { person: npc.name }).length > 0;

    const body = $('<div class="tk-root gs-panel"></div>');
    body.append($('<h3 class="gs-popup-title"></h3>').text(npc.name));
    const who = $('<div class="tk-who"></div>');
    const mood = $('<span class="tk-mood"></span>');
    const drawMood = () => mood.text(`Os mira de forma ${describeAttitude(attitude())}`).attr('data-band', attitude() >= 1 ? 'buena' : attitude() < 0 ? 'mala' : 'neutra');
    drawMood();
    if (npc.trade) who.append($('<span class="tk-trade"></span>').text(npc.trade));
    who.append(mood);
    body.append(who);
    if (npc.voice) body.append($('<div class="tk-voice"></div>').text(`Cómo habla: ${npc.voice}`));
    const log = $('<div class="tk-log"></div>');
    const add = (/** @type {string} */ line) => {
        if (!line) return;
        log.append($('<div class="tk-line"></div>').text(line));
        log.scrollTop(log[0]?.scrollHeight ?? 0);
    };

    /** @type {Popup|null} */
    let popup = null;
    const topics = $('<div class="tk-topics"></div>');
    const drawTopics = () => {
        topics.empty();
        for (const topic of talkTopics({ npc, milestone, hasRumor: hasRumor(), hasCase, attitude: attitude(), read: read(), confronting })) {
            const button = $('<button type="button" class="menu_button tk-topic"></button>').attr('data-topic', topic.id)
                .append(`<i class="fa-solid ${topic.locked ? 'fa-lock' : topic.icon}"></i>`).append($('<span></span>').text(topic.label));
            // Cerrado, y diciendo cómo se abre: con relación o con una tirada.
            if (topic.locked) {
                // No va desactivado: al pulsarlo dice cómo se abre, y eso es una respuesta.
                button.addClass('tk-locked').attr('title', topic.locked);
                button.on('click', () => add(topic.locked ?? ''));
                topics.append(button);
                continue;
            }
            button.on('click', async () => {
                if (topic.id === 'rumor') {
                    const said = await hearRumor(npc.name);
                    add(said ? `${npc.name} cuenta: «${said}»` : `${npc.name} no tiene nada nuevo que contar.`);
                    drawTopics();
                    return;
                }
                if (topic.id === 'caso') {
                    const before = chat.length;
                    await askAboutCase(npc.name);
                    const told = chat.slice(before).map(m => String(m.extra?.display_text ?? m.mes ?? '')).filter(Boolean);
                    add(told.length > 0 ? told.join(' ') : `${npc.name} no sabe nada más del caso.`);
                    return;
                }
                const plan = topicAnswer({ npc, topic: topic.id, attitude: attitude(), attitudeWord: describeAttitude(attitude()), milestone });
                const fallback = topic.id === 'sabe' ? `${npc.name}: ${npc.knows}` : topic.id === 'quiere' ? `Lo que busca ${npc.name}: ${npc.wants}` : '';
                add(sayInTalk(npc, plan, fallback));
            });
            topics.append(button);
        }
    };
    drawTopics();
    body.append(topics).append(log);

    // Lo que se puede hacer, además de preguntar.
    const actions = $('<div class="tk-actions"></div>');
    const act = (/** @type {string} */ label, /** @type {string} */ icon, /** @type {() => void|Promise<void>} */ run, /** @type {string} */ title, /** @type {string} */ id = '') => {
        const button = $('<button type="button" class="menu_button tk-act"></button>').attr('title', title).attr('data-act', id)
            .append(`<i class="fa-solid ${icon}"></i>`).append($('<span></span>').text(label));
        button.on('click', () => { void run(); });
        actions.append(button);
    };
    const closeAndRun = (/** @type {string} */ command) => {
        void popup?.completeAffirmative();
        setTimeout(() => { void import('../slash-commands.js').then(m => m.executeSlashCommandsWithOptions(command)); }, 300);
    };
    act('Convencer', 'fa-comments', () => closeAndRun(`/convencer ${npc.name}`), 'El Duelo de Palabras: tres rondas, y cede o no cede', 'convencer');
    act('Sonsacar', 'fa-user-secret', () => closeAndRun(`/sonsacar ${npc.name}`), 'Perspicacia: lo que esconde, si lo notas', 'sonsacar');
    act('Amenazar', 'fa-hand-fist', () => {
        const member = partyMembers[0];
        const result = member ? rollCheck({ member, skill: 'intimidation', rollD20: () => rollDiceDetailed('1d20', 20).total, dc: DEFAULT_DC }) : null;
        if (!result) return;
        add(noteRollInWindow(member, result));
        const plan = threatAnswer({ npc, success: result.success });
        add(sayInTalk(npc, plan, result.success ? `${npc.name} lo suelta: ${npc.knows}` : `${npc.name} no se deja amenazar.`));
        // Amenazar se paga, salga o no.
        changeAttitude(npc.name, -1, 'amenazado');
        drawMood();
    }, 'Intimidación: si sale, lo suelta aunque no os quiera; os lo tendrá en cuenta siempre', 'amenazar');
    const inn = (/** @type {any} */ (getCurrentWorldLocationMaps().find((/** @type {any} */ l) => l.name === currentLocationName))?.services ?? []).includes('posada');
    // A quien viene a por vosotros no se le invita a una ronda.
    if (inn && !confronting) {
        act('Invitar a una ronda', 'fa-beer-mug-empty', () => {
            if (!payFromParty(2)) {
                add('No os llega ni para una ronda.');
                return;
            }
            const before = attitude();
            const result = shiftAttitude(chat_metadata?.[ATTITUDES_KEY], { name: npc.name, delta: 1, day: campaignDay() });
            if (result.ok && chat_metadata) {
                chat_metadata[ATTITUDES_KEY] = result.state;
                saveMetadata();
                refreshWorldMemoryPrompt();
            }
            const changed = attitude() !== before;
            add(sayInTalk(npc, { moment: changed ? 'charla-ronda' : 'charla-ronda-no', facts: { quien: npc.name, actitud_texto: describeAttitude(attitude()) } },
                changed ? `Una ronda para ${npc.name}.` : `${npc.name} acepta la ronda.`));
            drawMood();
            drawTopics();
        }, 'Dos de oro. Una vez al día, mejora cómo os mira', 'ronda');
    }
    // Con modelo que acompaña, también se le puede decir algo con tus palabras.
    let keepTalking = false;
    if (narratorMode() === 'mixto') {
        act('Decírselo con tus palabras', 'fa-pen', () => {
            // La conversación sigue en la caja: lo que se escriba lo contesta él.
            keepTalking = true;
            void popup?.completeAffirmative();
            draftInChat(draft || `Le digo a ${npc.name}: `);
        }, 'Lo escribes tú, y lo contesta el modelo', 'palabras');
    }
    body.append(actions);

    // De quien os planta cara no se despide uno: se cierra la ventana y sigue la escena.
    popup = new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: confronting ? 'Cerrar' : 'Despedirse', allowVerticalScrolling: true, leftAlign: true });
    if (isShellOpen()) refreshGameShell();
    // Z3: «le pregunto a Giles por los rumores», «amenazo a Torres»: nada más abrir, eso.
    if (ask) setTimeout(() => body.find(`[data-topic="${ask}"], [data-act="${ask}"]`).first().trigger('click'), 80);
    const talking = popup.show();
    // J2.2: la primera charla, con la ventana ya abierta (el aviso sale encima de ella). Con
    // quien os planta cara no: ahí no hay despedida que enseñar.
    if (!confronting) showTip('talk');
    await talking;
    // «Despedirse» acaba la conversación; seguirla con tus palabras, no.
    if (!keepTalking && talkingTo === npc.name) {
        setTalkingTo('');
        if (isShellOpen()) refreshGameShell();
    }
}

/**
 * El compendio ya cargado, para lo que no puede esperar a una promesa.
 *
 * `applyFall` se llama desde dentro de una tirada de combate y no puede ser `async`: lo
 * que hay aqui es lo que ya se cargo antes, y si todavia no hay nada se usa la tabla del
 * motor. Aditivo, como todo lo demas.
 *
 * @type {any}
 */
export let lastCompendium = { has: () => false, find: () => [] };

// Se rellena en cuanto alguien pide el compendio por primera vez.
void getCompendium().then(({ compendium }) => {
    lastCompendium = compendium;
    const causes = causesOf(compendium);
    if (causes.length > 0) console.log(`[compendio] heridas por causa: ${causes.join(', ')}`);
});

/**
 * La semilla del mundo abierto, o cadena vacia si es de antes de que existieran.
 *
 * @param {any} metadata
 * @returns {string}
 */
export function seedOfWorld(metadata) {
    return String(metadata?.seed || '');
}

/**
 * El bioma del sitio donde esta el grupo.
 *
 * Es lo que hace que el pantano no de lobos de nieve. Estaba leyendose de
 * `metadata.biome`, que no existe: el bioma es de **cada localidad**, porque un mundo
 * tiene pantano y montana a la vez.
 *
 * @param {any} metadata
 * @returns {string}
 */
export function biomeHere(metadata) {
    const here = (metadata?.locationMaps ?? [])
        .find((/** @type {any} */ l) => String(l?.name || '') === currentLocationName);
    return String(here?.biome || '');
}

/**
 * Lo que hay puesto en esa casilla, disparado.
 *
 * El motor decide que salta y cuanto duele; el narrador lo cuenta. Al reves —dejarselo al
 * modelo— es como acaban las trampas haciendo un dano distinto cada vez.
 *
 * Y el dado es el de la partida: una trampa que se saltara la semilla haria que dos
 * partidas con la misma semilla dejaran de salir iguales.
 *
 * @param {any} member
 * @param {number} x
 * @param {number} y
 */
function fireHazardsOnEnter(member, x, y) {
    const board = getActiveBoardContext().board;
    if (!board) return;

    const { fired, hazards } = enterCell(board, { x, y });
    board.hazards = hazards;

    // Idea 78: lo que hay al lado se ve sin buscarlo, si se tiene buen ojo.
    const passive = 10 + skillModifier(member, 'perception').modifier;
    const spotted = passiveSpot(board, { x, y }, passive);
    if (spotted.spotted.length > 0) {
        board.hazards = spotted.hazards;
        for (const hazard of spotted.spotted) {
            const line = `${member.name} se fija: ${hazard.tell || describeHazard(hazard)} en (${hazard.x + 1}, ${hazard.y + 1}).`;
            postCombatNarration(`👁️ [TABLERO] ${line}`);
            toastr.warning(line, 'Cuidado', { timeOut: 8000 });
        }
    }
    if (fired.length === 0 && spotted.spotted.length === 0) return;
    persistBoardTerrain(board);
    if (fired.length === 0) {
        renderLocationMapsPreview();
        return;
    }

    for (const hazard of fired) {
        // R6: una pista del caso, puesta en el tablero: pisarla es encontrarla.
        if (hazard.kind === 'pista') {
            const state = readCases(chat_metadata?.[CASES_KEY]);
            const clue = state.active?.clues.find(c => `caso:${c.id}` === String(hazard.note));
            if (clue) revealClue(clue);
            continue;
        }
        if (hazard.effect === 'damage' && hazard.damageDice) {
            const roll = rollWith(hazard.damageDice, nextRandom);
            member.hp = Math.max(0, (Number(member.hp) || 0) - roll.total);
            postCombatNarration(
                `[TABLERO] ${hazard.name} salta bajo ${member.name}: ${roll.total} de daño.`,
            );
            // A cero manda la misma puerta de siempre: una sola forma de caer.
            // Lo que salta en el tablero dice de que es: fuego es fuego.
            if (member.hp === 0) applyFall(member, String(hazard.cause || ''));
        } else if (hazard.effect === 'condition' && hazard.condition) {
            member.activeConditions = Array.isArray(member.activeConditions)
                ? member.activeConditions : [];
            if (!member.activeConditions.includes(hazard.condition)) {
                member.activeConditions.push(hazard.condition);
            }
            postCombatNarration(
                `[TABLERO] ${hazard.name} deja a ${member.name}: ${hazard.condition}.`,
            );
        } else {
            postCombatNarration(`[TABLERO] ${describeHazard(hazard)}.`);
        }
    }

    savePartyState();
    renderLocationMapsPreview();
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
async function askBeforeTravelling(plan) {
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
async function travelWithTime(name, options = {}) {
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


/** Idea 195: las letras que puede llevar el narrador. */
const NARRATOR_FONTS = [
    { id: '', label: 'la de siempre' },
    { id: 'libro', label: 'de libro' },
    { id: 'pluma', label: 'a pluma' },
    { id: 'maquina', label: 'de máquina' },
];

/** Idea 195: poner la letra del narrador de esta campaña. */
function applyNarratorFont() {
    document.body.dataset.narratorFont = String(chat_metadata?.[NARRATOR_FONT_KEY] || '');
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
 * Entrar en un tablero de la localizacion actual. Devuelve el nombre real, o ''.
 *
 * Extraido de `/enter`, con su respaldo para los mundos antiguos que guardaban los
 * tableros sueltos en vez de colgados de la localizacion.
 *
 * @param {string} name
 * @returns {string}
 */
function enterBoard(name) {
    const held = holdDuringCombat(combatEncounter, 'board');
    if (held) {
        toastr.warning(held, 'Combate en marcha');
        return '';
    }

    const wanted = String(name || '').trim();
    if (!currentLocationName) return '';

    const loc = getCurrentWorldLocationMaps().find(l => l.name === currentLocationName);
    let boards = getLocationBoards(loc);
    if (boards.length === 0) {
        const globalBoards = getCurrentWorldBoards();
        if (globalBoards.length > 0) {
            console.log('[party] enterBoard fallback to global boards', { currentLocationName, globalBoards });
            boards = globalBoards;
        }
    }

    const match = boards.find((/** @type {any} */ b) => b.name.toLowerCase() === wanted.toLowerCase());
    if (!match) return '';

    setCurrentBoardName(match.name);
    saveCurrentBoard();
    placePartyAtStart(match);
    return match.name;
}

/**
 * Al entrar en un tablero, el grupo se pone en sus casillas de inicio, como al empezar una
 * campaña: la casilla de otro tablero puede caer en un muro de este, o fuera del mapa.
 * Uno en cada casilla, por orden; si hay más gente que casillas, en la primera.
 *
 * @param {any} board
 * @returns {void}
 */
function placePartyAtStart(board) {
    const starts = Array.isArray(board?.partyStart) ? board.partyStart : [];
    if (starts.length === 0 || combatEncounter.active) return;
    partyMembers.filter(m => !m.dead).forEach((member, index) => {
        const cell = starts[index] ?? starts[0];
        member.mapPosition = { locationName: currentLocationName, gridX: Number(cell?.x) || 0, gridY: Number(cell?.y) || 0 };
    });
    savePartyState();
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

/**
 * Volver a dibujar el tablero. Para las pruebas y las herramientas que cambian el terreno
 * desde fuera: el juego ya redibuja solo cuando algo suyo lo cambia.
 */
export function refreshBoardView() {
    renderLocationMapsPreview();
}

export function renderLocationMapsPreview() {
    drawLocationMapsPreview();
    // La caja de escribir dice lo del juego mientras no hay pelea (la pelea pone la suya). Al
    // cambiar de chat el mundo aún no está atado a una partida nueva: aquí ya lo está.
    if (!combatEncounter.active) restoreChatPlaceholder();
    // El Shell dibuja su cabecera y su barra a partir del mismo estado que acaba de
    // pintar el tablero, asi que se refresca aqui y no en cada sitio que redibuja.
    if (isShellOpen()) refreshGameShell();
}

function drawLocationMapsPreview() {
    const container = $('#world_location_maps_list');
    if (!container.length) return;

    container.empty();
    // The panel about to be discarded with the rest of the view. Re-mounted below if the
    // board is what gets drawn; anything else leaves the log without a place to render.
    combatLogPanel = null;

    const shell = $('<div class="wm-location-shell"></div>');
    const toolbar = $(`
        <div class="wm-location-toolbar">
            <div class="wm-location-toolbar-title"><i class="fa-solid fa-map-location-dot"></i> Mapas</div>
            <div class="wm-location-toolbar-actions">
                <button class="menu_button" data-location-toggle>${locationMapsManuallyHidden ? 'Abrir' : 'Ocultar'}</button>
            </div>
        </div>
    `);
    shell.append(toolbar);
    container.append(shell);

    toolbar.find('[data-location-toggle]').on('click', () => {
        setLocationMapsHidden(!locationMapsManuallyHidden);
        renderLocationMapsPreview();
    });

    if (locationMapsManuallyHidden) {
        shell.append('<div class="wm-location-collapsed">Los mapas quedan ocultos hasta que pulses «Abrir».</div>');
        return;
    }

    const contentRoot = $('<div class="wm-location-content"></div>');
    shell.append(contentRoot);

    const locationMaps = getCurrentWorldLocationMaps();
    if (!locationMaps || locationMaps.length === 0) {
        contentRoot.html('<div class="wm-empty-state">Este mundo aún no tiene ninguna localización con mapa.</div>');
        return;
    }

    // Find the current location
    let loc = locationMaps.find(l => l.name === currentLocationName);
    const resolvedBoards = getLocationBoards(loc);
    console.log('[party] renderLocationMapsPreview', { currentLocationName, currentBoardName, locName: loc?.name, locBoardsLength: resolvedBoards.length, resolvedBoards });

    // No location selected yet — show a chooser
    if (!loc) {
        let cards = '';
        for (const l of locationMaps) {
            const imgHtml = l.url
                ? `<img src="${escapeHtml(l.url)}" alt="" />`
                : '<i class="fa-solid fa-location-dot fa-2x"></i>';
            cards += `
            <div class="wm-loc-choose-card" data-loc="${escapeHtml(l.name)}">
                <div class="wm-loc-choose-img">${imgHtml}</div>
                <div class="wm-loc-choose-name">${escapeHtml(l.name)}</div>
                ${l.region ? `<div class="wm-loc-choose-region">${escapeHtml(l.region)}</div>` : ''}
            </div>`;
        }
        contentRoot.html(`
            <div class="wm-loc-chooser">
                <div class="wm-loc-chooser-title"><i class="fa-solid fa-compass"></i> ¿Dónde estáis?</div>
                <div class="wm-loc-choose-grid">${cards}</div>
            </div>
        `);
        contentRoot.find('.wm-loc-choose-card').on('click', function () {
            setCurrentLocationName(String($(this).data('loc')));
            setCurrentBoardName('');
            saveCurrentLocation();
            saveCurrentBoard();
            renderLocationMapsPreview();
        });
        return;
    }

    // Build view tabs (Location Name ↔ World)
    const viewTabs = $(`
        <div class="wm-view-tabs">
            <div class="wm-view-tab active" data-view="location"><i class="fa-solid fa-location-dot"></i> ${loc.name}</div>
            <div class="wm-view-tab" data-view="world"><i class="fa-solid fa-globe"></i> Mundo</div>
        </div>
    `);
    const locationPanel = $('<div class="wm-view-panel active" data-view="location" data-map-root></div>');
    const worldPanel = $('<div class="wm-view-panel" data-view="world"></div>');

    viewTabs.find('.wm-view-tab').on('click', function () {
        const view = $(this).data('view');
        viewTabs.find('.wm-view-tab').removeClass('active');
        $(this).addClass('active');
        contentRoot.find('.wm-view-panel').removeClass('active');
        contentRoot.find(`.wm-view-panel[data-view="${view}"]`).addClass('active');

        if (view === 'world') {
            const mapUrl = getCurrentWorldMapUrl();
            const allLocs = getCurrentWorldLocationMaps();
            renderWorldMapView(worldPanel, mapUrl, allLocs, {
                onLocationSelect: (l) => {
                    setCurrentLocationName(l.name);
                    saveCurrentLocation();
                },
                onLocationNavigate: (l) => {
                    setCurrentLocationName(l.name);
                    saveCurrentLocation();
                    renderLocationMapsPreview();
                },
            });
        }
    });

    const leaveLocBtn = $('<button class="menu_button wm-leave-loc-btn"><i class="fa-solid fa-arrow-left"></i> Salir de la localización</button>');
    leaveLocBtn.on('click', () => {
        setCurrentLocationName('');
        setCurrentBoardName('');
        saveCurrentLocation();
        saveCurrentBoard();
        renderLocationMapsPreview();
    });

    // Que tablero hay abierto se decide antes de dibujar: estando dentro de uno, salir de
    // la localidad y saltar al mapa del mundo no son cosas que ofrecer — y con un combate
    // en marcha, la pestana World era la puerta por la que se huia sin decidirlo.
    const locBoards = getLocationBoards(loc);
    const selectedBoard = locBoards.find(/** @param {{ name: string }} b */ (b) => b.name === currentBoardName) || null;

    if (!selectedBoard) contentRoot.append(leaveLocBtn, viewTabs, locationPanel, worldPanel);

    // Assign all party members without a location to the current location
    for (const m of partyMembers) {
        if (!m.mapPosition || !m.mapPosition.locationName) {
            m.mapPosition = m.mapPosition || { locationName: '', gridX: 0, gridY: 0 };
            m.mapPosition.locationName = currentLocationName;
        }
    }

    const tokens = /** @type {import('../world-map-renderer.js').TokenData[]} */ (buildTokens(currentLocationName));

    // ---- Board drill-down: if a board is selected, show it instead of the location ----
    if (selectedBoard) {
        // Board selected — render board map with a "Back to location" button
        const backBtn = $(`<button class="menu_button wm-leave-loc-btn"><i class="fa-solid fa-arrow-left"></i> Volver a ${escapeHtml(loc.name)}</button>`);

        // Se queda a la vista, apagado y diciendo por que: esconderlo haria pensar que
        // salir del tablero ya no existe, cuando lo que pasa es que hay que acabar antes.
        const heldBack = holdDuringCombat(combatEncounter, 'board');
        backBtn.attr('title', heldBack || `Volver a ${loc.name}`);
        backBtn.prop('disabled', Boolean(heldBack));
        backBtn.on('click', () => {
            if (holdDuringCombat(combatEncounter, 'board')) return;
            setCurrentBoardName('');
            setCombatBoardSelection({ tokenId: null, boardName: '', locationName: '' });
            saveCurrentBoard();
            renderLocationMapsPreview();
        });
        const boardPanel = $('<div data-map-root></div>');
        contentRoot.append(backBtn, boardPanel);

        const boardTokens = /** @type {import('../world-map-renderer.js').TokenData[]} */ (buildTokens(currentLocationName));
        // Merge enemy tokens if combat is active on this board
        const enemyTokens = combatEncounter.active ? buildEnemyTokens() : [];
        const npcTokens = buildBoardNPCTokens(selectedBoard);
        const allBoardTokens = [...boardTokens, ...enemyTokens, ...npcTokens];
        const tacticalState = getCombatBoardHighlightState(loc.gridWidth || 50, loc.gridHeight || 50);

        // Determine which tokens can be dragged
        let boardDraggableIds;
        if (combatEncounter.active) {
            const entry = getCurrentTurnEntry();
            boardDraggableIds = (entry && !entry.isEnemy) ? [Number(entry.id)] : [];
        } else {
            boardDraggableIds = getControlledMemberIds();
        }
        const boardGridW = loc.gridWidth || 50;
        const boardGridH = loc.gridHeight || 50;

        // Terrain, fog and the paint palette (wiki/ROADMAP.md, Fase A6).
        const boardTerrain = normalizeTerrain(selectedBoard.terrain);
        const fogOn = Boolean(selectedBoard.fogEnabled);
        const boardFog = normalizeFog(selectedBoard.fog);
        const sightNow = fogOn ? boardVisibility() : null;
        const partySight = allBoardTokens
            .filter(t => !t.isEnemy)
            .map(t => ({ gridX: t.gridX, gridY: t.gridY, sightFeet: sightNow ? sightFeetFor(sightNow, t.sightFeet ?? 60) : t.sightFeet }));
        const fogState = fogOn
            ? updateFog(boardFog, boardTerrain, partySight, boardGridW, boardGridH)
            : { fog: boardFog, visible: new Set() };

        if (fogOn && JSON.stringify(fogState.fog) !== JSON.stringify(boardFog)) {
            selectedBoard.fog = fogState.fog;
            persistBoardTerrain(selectedBoard);
        }

        // Fuera de combate, los enemigos que el tablero trae escritos y el grupo ve: se dibujan
        // quietos, y son los mismos que ofrece el botón de empezar. Solo lo que el grupo **ve
        // de verdad**: `awakePlacements` esconde a los de una sala sin revelar, y la niebla al
        // resto. Un tablero ya ganado no los vuelve a poner.
        const waiting = combatEncounter.active || isBoardWon(currentLocationName, selectedBoard.name) ? [] : awakePlacements(selectedBoard.rooms, selectedBoard.enemyPlacements ?? [])
            .filter((/** @type {any} */ p) => !fogOn
                || fogState.visible.has(cellKey(Number(p.x) || 0, Number(p.y) || 0)));
        allBoardTokens.push(...buildBoardIdleEnemyTokens(waiting));
        const waitingKey = (/** @type {typeof lastWaiting} */ w) => `${w.board}|${w.placements.map(p => `${p.name}@${p.x},${p.y}`).join(';')}`;
        const nowWaiting = { board: String(selectedBoard.name), placements: waiting };
        if (waitingKey(nowWaiting) !== waitingKey(lastWaiting)) {
            lastWaiting = nowWaiting;
            // La fila de fichas se hizo antes que el tablero: se rehace una vez con lo nuevo.
            if (isShellOpen()) setTimeout(() => refreshGameShell(), 0);
        }

        renderLocationView(boardPanel, {
            name: selectedBoard.name,
            imageUrl: selectedBoard.url,
            description: '',
            gridWidth: boardGridW,
            gridHeight: boardGridH,
            viewStateKey: `board::${currentLocationName}::${selectedBoard.name}`,
            terrain: boardTerrain,
            fog: fogState.fog,
            visibleCells: fogState.visible,
            fogEnabled: fogOn,
            paintMode: activeTerrainBrush,
            onPaintCell: (gx, gy, type) => {
                selectedBoard.terrain = setTerrainCell(normalizeTerrain(selectedBoard.terrain), gx, gy, type);
                persistBoardTerrain(selectedBoard);
                renderLocationMapsPreview();
            },
            // Opening a door changes what can be walked through and what can be seen, so
            // the board is redrawn: fog is recomputed from the new terrain on the way.
            onDoorToggle: (gx, gy, open) =>
                toggleBoardDoor(selectedBoard, gx, gy, open, boardGridW, boardGridH),
            // K3: la ficha a la que le toca, a la vista (una vez por turno).
            ...activeFocus(),
            // Lo ya visto del tablero, a la vista (idea 122: el aceite que arde).
            hazards: visibleHazards(selectedBoard).map((/** @type {any} */ h) => ({ x: h.x, y: h.y, name: h.name, kind: h.kind, note: h.tell })),
            tokens: allBoardTokens,
            onTokenClick: (tokenId) => handleCombatTokenClick(tokenId),
            // Clic en una casilla encendida: mover. Solo las encendidas responden.
            onCellClick: (gx, gy, kind) => handleBoardCellClick(gx, gy, kind),
            // Y al pasar por encima, la ruta y el precio: mover deja de ser una apuesta.
            onCellHover: (gx, gy) => previewMovement(gx, gy),
            selectedTokenId: tacticalState.selectedTokenId,
            highlightedTokenIds: tacticalState.highlightedTokenIds,
            highlightedCells: tacticalState.highlightedCells,
            overlayLegend: tacticalState.overlayLegend,
            draggableTokenIds: boardDraggableIds,
            onTokenDragging: (tokenId, tentGX, tentGY) =>
                buildDragHighlightCells(tokenId, tentGX, tentGY, boardGridW, boardGridH),
            onTokenMove: (tokenId, gx, gy) => {
                if (tokenId < 0) {
                    handleEnemyTokenMove(tokenId, gx, gy);
                    return;
                }
                if (combatEncounter.active) {
                    const entry = getCurrentTurnEntry();
                    if (entry && !entry.isEnemy && String(entry.id) === String(tokenId)) {
                        const member = partyMembers.find(m => m.id === tokenId);
                        if (member) {
                            // Arrastrar la ficha **es** moverse igual que escribirlo, y
                            // hasta ahora eso era un comentario y no un hecho: esta rama
                            // tenia su propia copia del movimiento, que no guardaba la
                            // ficha, no narraba el paso y no miraba si con ese paso se
                            // ganaba el escenario. Una sola puerta y se acabo la deriva.
                            handlePlayerCombatMove(`${gx + 1},${gy + 1}`);
                            return;
                        }
                    }
                }
                handleTokenMove(tokenId, gx, gy, currentLocationName);
            },
        });

        // ---- Terrain editor (wiki/ROADMAP.md, Fase A6) ----
        // Con una pelea encima no se ofrece: mover un muro a mitad de un turno cambia
        // quien ve a quien, por donde se pasa y cuanto cuesta llegar, y nada de eso lo
        // habia decidido nadie. El pincel vuelve entero al acabar.
        const heldBrush = holdDuringCombat(combatEncounter, 'terrain');
        if (heldBrush) {
            // Si alguien dejo el pincel abierto y empezo el combate, se cierra solo.
            terrainEditing = false;
            activeTerrainBrush = null;
        }

        if (heldBrush) {
            const lockedBtn = $('<button class="wm-terrain-edit-btn menu_button" disabled></button>');
            lockedBtn.attr('title', heldBrush);
            lockedBtn.append('<i class="fa-solid fa-draw-polygon"></i>');
            lockedBtn.append($('<span></span>').text(' Terreno'));
            boardPanel.append(lockedBtn);
        } else if (terrainEditing) {
            boardPanel.append(buildTerrainPalette(selectedBoard, () => renderLocationMapsPreview()));
        } else {
            const editButton = $('<button class="wm-terrain-edit-btn menu_button" title="Pintar muros, cobertura y puertas"></button>');
            editButton.append('<i class="fa-solid fa-draw-polygon"></i>');
            editButton.append($('<span></span>').text(' Terreno'));
            editButton.on('click', () => {
                terrainEditing = true;
                activeTerrainBrush = 'wall';
                renderLocationMapsPreview();
            });
            boardPanel.append(editButton);
        }


        // ---- Iniciar combate (wiki/archivo/ROADMAP_JUEGO_SIN_COMANDOS.md, K2) ----
        // Solo con lo que el grupo **ve de verdad**. `awakePlacements` esconde a los de
        // una sala sin revelar, pero un tablero sin salas no esconde nada — y entonces el
        // boton anunciaba al Carcelero de Hierro antes de que nadie lo hubiera visto. Un
        // boton que te chiva lo que hay detras de la puerta es lo contrario de un juego.
        if (waiting.length > 0) contentRoot.append(buildStartCombatButton(selectedBoard, waiting));

        // ---- Combat log (wiki/ROADMAP.md, Fase B4) ----
        // Beside the real board now, not only inside /sandbox. It appears once there is
        // something to show, so a quiet board is not covered by an empty panel.
        if (combatEncounter.active || combatLogEntries.length > 0) {
            const logPanel = createCombatLogPanel({ title: 'Registro de combate' });
            contentRoot.append(logPanel);
            combatLogPanel = logPanel;
            // Idea 20: de quién y de qué. «Mis tiradas» es Tiradas más tu nombre.
            logPanel.attr('data-kind', combatLogFilter.kind).attr('data-who', combatLogFilter.who);
            const people = [...partyMembers.map(m => String(m.name)), ...combatEncounter.enemies.map((/** @type {any} */ e) => String(e.name))]
                .filter((name, index, all) => name && all.indexOf(name) === index);
            const repaint = () => {
                combatLogFilter = logFilterOf(logPanel);
                renderLogFilters(logPanel, people, repaint);
                paintCombatLog();
            };
            renderLogFilters(logPanel, people, repaint);
            paintCombatLog();
            setRound(logPanel, combatEncounter.active ? (Number(combatEncounter.round) || 1) : 0);
        }

        // ---- Combat UI section ----
        if (combatEncounter.active) {
            const combatSection = buildCombatSection(selectedBoard);
            contentRoot.append(combatSection);
        }
        return;
    }

    // ---- Location view (no board selected) ----
    renderLocationView(locationPanel, {
        name: loc.name,
        imageUrl: loc.url,
        description: loc.description || '',
        gridWidth: loc.gridWidth || 50,
        gridHeight: loc.gridHeight || 50,
        viewStateKey: `location::${loc.name}`,
        tokens,
        draggableTokenIds: getControlledMemberIds(),
        onTokenMove: (tokenId, gx, gy) => handleTokenMove(tokenId, gx, gy, currentLocationName),
    });

    // ---- Board cards below the location map ----
    if (locBoards.length > 0) {
        let boardCards = '';
        for (const b of locBoards) {
            const imgHtml = b.url
                ? `<img src="${escapeHtml(b.url)}" alt="" />`
                : '<i class="fa-solid fa-chess-board fa-2x"></i>';
            boardCards += `
            <div class="wm-loc-choose-card" data-board="${escapeHtml(b.name)}">
                <div class="wm-loc-choose-img">${imgHtml}</div>
                <div class="wm-loc-choose-name">${escapeHtml(b.name)}</div>
            </div>`;
        }
        const boardsSection = $(`
            <div class="wm-boards-section">
                <div class="wm-boards-section-title"><i class="fa-solid fa-chess-board"></i> Tableros</div>
                <div class="wm-loc-choose-grid">${boardCards}</div>
            </div>
        `);
        boardsSection.find('.wm-loc-choose-card').on('click', function () {
            setCurrentBoardName(String($(this).data('board')));
            setCombatBoardSelection({ tokenId: null, boardName: '', locationName: '' });
            saveCurrentBoard();
            placePartyAtStart(getLocationBoards(loc).find((/** @type {any} */ b) => b.name === currentBoardName));
            renderLocationMapsPreview();
        });
        contentRoot.append(boardsSection);
    } else {
        // Un sitio sin tablero es un sitio legitimo — una aldea donde solo se habla — y
        // desde A4 se puede escribir en un libro. Decirlo evita que parezca roto.
        contentRoot.append($('<div class="wm-boards-empty"></div>').text(
            'Aqui no hay ningun tablero: es un sitio para hablar y pasar el rato, no para pelear.',
        ));
    }
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


/**
 * @param {string} personaIdOrName
 */
export function addPartyMember(personaIdOrName) {
    if (!personaIdOrName || !personaIdOrName.trim()) {
        return;
    }

    /** @type {{[key: string]: string}} */
    const userPersonas = power_user?.personas || {};
    const isPersonaId = !!userPersonas[personaIdOrName];
    const name = isPersonaId ? userPersonas[personaIdOrName] : personaIdOrName.trim();

    const normalized = name.toLowerCase();
    if (partyMembers.some((member) => member.name.toLowerCase() === normalized)) {
        return;
    }

    const avatar = isPersonaId ? getThumbnailUrl('persona', personaIdOrName) : 'img/user-avatar.png';

    /** @type {any} */
    const descriptor = power_user.persona_descriptions || {};
    /** @type {{hp_current?: number, hp_max?: number, xp_current?: number, xp_next?: number, level?: number, gold?: number, silver?: number, copper?: number, inventory?: string, conditions?: string, strength?: number, dexterity?: number, constitution?: number, intelligence?: number, wisdom?: number, charisma?: number, armorClass?: number, speed?: number}|null} */
    const personaState = isPersonaId ? descriptor[personaIdOrName]?.player_state : null;
    const defaults = getDefaultDndData();
    const base = {
        id: Date.now(),
        personaId: isPersonaId ? personaIdOrName : null,
        name,
        avatar,
        level: personaState?.level ?? 1,
        class: 'Adventurer',
        race: '',
        factions: [],
        hp: personaState?.hp_current ?? 30,
        maxHp: personaState?.hp_max ?? 30,
        xp: personaState?.xp_current ?? 0,
        xpNext: personaState?.xp_next ?? 100,
        gold: personaState?.gold ?? 0,
        silver: personaState?.silver ?? 0,
        copper: personaState?.copper ?? 0,
        inventory: personaState?.inventory ?? '',
        conditions: personaState?.conditions ?? '',
        alignment: '',
        personality: '',
        activeConditions: /** @type {string[]} */ ([]),
        strength: personaState?.strength ?? defaults.strength,
        dexterity: personaState?.dexterity ?? defaults.dexterity,
        constitution: personaState?.constitution ?? defaults.constitution,
        intelligence: personaState?.intelligence ?? defaults.intelligence,
        wisdom: personaState?.wisdom ?? defaults.wisdom,
        charisma: personaState?.charisma ?? defaults.charisma,
        armorClass: personaState?.armorClass ?? defaults.armorClass,
        speed: personaState?.speed ?? defaults.speed,
        items: [],
        equippedItems: { ...defaults.equippedItems },
        relationships: [],
        memories: [],
        mapPosition: { locationName: currentLocationName, gridX: 0, gridY: 0 },
    };

    partyMembers.push(base);
    renderPartyMembers();
    savePartyState();
}

/**
 * @param {number} memberId
 */
export function removePartyMember(memberId) {
    setPartyMembers(partyMembers.filter((m) => m.id !== memberId));
    renderPartyMembers();
    savePartyState();
}

/**
 * @param {string} avatarId
 * @param {{hp_current?: number, hp_max?: number, xp_current?: number, xp_next?: number, level?: number, gold?: number, silver?: number, copper?: number, inventory?: string, conditions?: string, strength?: number, dexterity?: number, constitution?: number, intelligence?: number, wisdom?: number, charisma?: number, armorClass?: number, speed?: number}} newState
 */
export function updatePartyMemberFromPersona(avatarId, newState) {
    let changed = false;
    setPartyMembers(partyMembers.map((member) => {
        if (member.personaId !== avatarId) {
            return member;
        }

        changed = true;
        return {
            ...member,
            level: newState.level ?? member.level,
            hp: newState.hp_current ?? member.hp,
            maxHp: newState.hp_max ?? member.maxHp,
            xp: newState.xp_current ?? member.xp,
            xpNext: newState.xp_next ?? member.xpNext,
            gold: newState.gold ?? member.gold,
            silver: newState.silver ?? member.silver,
            copper: newState.copper ?? member.copper,
            inventory: newState.inventory ?? member.inventory,
            conditions: newState.conditions ?? member.conditions,
            strength: newState.strength ?? member.strength,
            dexterity: newState.dexterity ?? member.dexterity,
            constitution: newState.constitution ?? member.constitution,
            intelligence: newState.intelligence ?? member.intelligence,
            wisdom: newState.wisdom ?? member.wisdom,
            charisma: newState.charisma ?? member.charisma,
            armorClass: newState.armorClass ?? member.armorClass,
            speed: newState.speed ?? member.speed,
        };
    }));

    if (changed) {
        renderPartyMembers();
        savePartyState();
    }
}

/**
 * Returns the current party leader (first member), or null if no party is active.
 * @returns {PartyMember|null}
 */
export function getActivePartyLeader() {
    return partyMembers.length > 0 ? partyMembers[0] : null;
}

export function getPartyDescription() {
    if (!partyMembers.length) {
        return '';
    }

    return partyMembers
        .map((member) => {
            const parts = [];
            parts.push(`Nombre: ${member.name}`);
            parts.push(`Clase: ${member.class}`);
            parts.push(`Nivel: ${member.level}`);
            parts.push(`HP: ${member.hp}/${member.maxHp}`);
            parts.push(`STR:${member.strength || 10} DEX:${member.dexterity || 10} CON:${member.constitution || 10} INT:${member.intelligence || 10} WIS:${member.wisdom || 10} CHA:${member.charisma || 10}`);
            parts.push(`AC: ${member.armorClass || 10} Speed: ${member.speed || 30}`);
            const equippedNames = Object.values(member.equippedItems || {}).filter(Boolean).map(id => (member.items || []).find(i => i.id === id)?.name).filter(Boolean);
            if (equippedNames.length) parts.push(`Equipado: ${equippedNames.join(', ')}`);
            if (member.inventory) parts.push(`Inventario: ${member.inventory}`);
            if (member.conditions) parts.push(`Condiciones: ${member.conditions}`);
            return parts.join(' | ');
        })
        .join('\n');
}

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
