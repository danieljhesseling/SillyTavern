import { t } from './i18n.js';
import { power_user } from './power-user.js';
import { POPUP_TYPE, POPUP_RESULT, Popup } from './popup.js';
import { sendSystemMessage, system_message_types } from './system-messages.js';
import { getThumbnailUrl, chat, chat_metadata, saveMetadata, eventSource, event_types, setUserName, addOneMessage, saveChatConditional, substituteParams, system_avatar, generateRaw, online_status, setExtensionPrompt, extension_prompt_types, extension_prompt_roles, saveSettingsDebounced } from '../script.js';
import { extension_settings } from './extensions.js';
import { getMessageTimeStamp } from './RossAscends-mods.js';
import { getCurrentWorldMapUrl, getCurrentWorldLocationMaps, getCurrentWorldBoards, getCurrentWorldEnemies, getCurrentWorldNPCs, loadWorldInfo, saveWorldInfo, createWorldInfoEntry, refreshWorldMapGlobals, METADATA_KEY } from './world-info.js';
import { renderWorldMapView, renderLocationView } from './world-map-renderer.js';
import { SlashCommandParser } from './slash-commands/SlashCommandParser.js';
import { SlashCommand } from './slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument } from './slash-commands/SlashCommandArgument.js';
import { SlashCommandEnumValue } from './slash-commands/SlashCommandEnumValue.js';
import {
    EQUIPMENT_SLOTS, SLOT_INFO, RELATIONSHIP_CATEGORIES, RELATIONSHIP_SCORE_MIN, RELATIONSHIP_SCORE_MAX,
    MODIFIABLE_STATS, ALIGNMENTS, CONDITIONS, generateMemoryId, getAbilityModifier, formatModifier,
    calculateCarryingCapacity, calculateTotalWeight, getDefaultDndData, applyEquipmentEffects,
    addItemToInventory, removeItemFromInventory, consumeItemInInventory, equipItem, unequipItem,
    getEquippedItem, getItemsByType, analyzeRelationshipsFromChat, migratePartyMember, createItem,
    getItemCategoryOptions, getItemSubcategoryOptions, getSuggestedSlotForItem, buildItemMetaSummary,
    normalizeItem, getArmorDexRuleLabel, isMeleeWeaponSubcategory, getMagicSubtypeFlags,
    clampRelationshipScore, generateEnemyInstanceId, normalizeDndEntityType,
} from './dnd-system.js';
import { escapeHtml, download } from './utils.js';
import { createSeededRandom, seedFrom, rollWith } from './game-engine/combat/seeded-random.js';
import { getCompendium } from './game-engine/compendio/browser.js';
import { ensureSeed, derive, describeSeed } from './game-engine/campaign/seed.js';
import {
    planTravel, travelEvents, describeTravel, rollWeather, DEFAULT_TRAVEL_EVENTS, MIN_DAYS,
} from './game-engine/world/travel.js';
import { forgeItem as forgeFromCompendium, forgeItems, describeItem } from './game-engine/compendio/forge.js';
import { makeNames } from './game-engine/compendio/names.js';
import { breedMonster as breedFromCompendium, breedBand, describeMonster } from './game-engine/compendio/bestiary.js';
import { writeQuest as writeFromCompendium, writeQuestBoard, describeQuest } from './game-engine/compendio/quests.js';
import { writePerson as writePersonFromCompendium, writeVillage, describePerson } from './game-engine/compendio/people.js';
import { injuryTableFor, causesOf } from './game-engine/compendio/ailments.js';
import { racesOf, kindsOf, describeKin, validateKin } from './game-engine/compendio/kin.js';
import { createCompendium, onlyPicked } from './game-engine/compendio/compendio.js';
import {
    readFactions, tickFactions, outcomeOf, applyOutcome, newsFor, describeFaction, priceFactor,
    rollFactions, validateFactionRows, busyFactions, pushFaction, speaksPlural, namesOf,
    changeStanding, describeStanding, standingWith, saysWith,
} from './game-engine/campaign/factions.js';
import { marketPressure, applyMarket, describeMarket, warPressure } from './game-engine/campaign/economy.js';
import {
    abilitiesFor, classesOf, nameAndAbility, validateAbilities, asAbility,
} from './game-engine/compendio/skills.js';
import {
    rollDice, rollDiceDetailed, getRollClassification, getRollClassificationLabel,
    getDistanceInFeet, getAttackRangeFeet, describeCover,
    getPlayerDamageFormula, getEnemyDamageFormula, getPlayerAttackModifier,
    createEmptyCombatEncounter, normalizeCombatEncounter, setRandomSource, nextRandom,
} from './party/combat-rules.js';
import { escItemText, buildPartyItemSections } from './party/item-forms.js';
import { armourClassOf, shieldBlocked, bestFor, weaponOf as heldWeapon, weaponBonus } from './game-engine/rules/equipment.js';
import { resolveEntryMapPosition } from './party/positions.js';
import { createCampaignState } from './party/campaign-state.js';
import {
    normalizeTerrain, setCell as setTerrainCell, getTerrainOptions, getCoverBonus, setDoorOpen,
    parseCellKey, terrainFromAsciiMap, cellKey, isPassable, getCell, isLocked, unlockDoor, lockedDoors, breakDoor,
    TERRAIN_TYPES,
} from './game-engine/board/terrain.js';
// R3 del roadmap de profundidad: áreas, elementos, usos fuera del combate y jugadas en pareja.
import { areaCells, creaturesIn, isArea, describeArea } from './game-engine/rules/area.js';
import { elementOf, reactTerrain, comboFor, ELEMENT_ICONS } from './game-engine/rules/tags.js';
import { travelShortcut, lockBonus, watchBonus, duelTricks, patchUpAfterFight, whoCan } from './game-engine/rules/field-uses.js';
// R5 del roadmap de profundidad: la mascota.
import {
    readPet, createPet, petComment, afterComment, shouldComment, petAdvice, supportActions, liveTogether, petDoes,
    petChoicesFor, tamableAs, describePet, petName, SPECIES as PET_SPECIES, CHARACTERS as PET_CHARACTERS,
} from './game-engine/campaign/pet.js';
// R8 y R9 del roadmap de profundidad: compañeros con arco, y el mundo que responde.
import { completeArc, homeFavors, favorDiscount, noteGone, whoComesBack, comebackOf, forgetGone } from './game-engine/campaign/companion-arcs.js';
import { rumorsFromPlay, chronicleMemory, reactionTo } from './game-engine/campaign/world-echoes.js';
// R7 del roadmap de profundidad: enemigos con cabeza, y la némesis.
import { ROLES as ENEMY_ROLES, roleOf as bandRoleOf, tacticOf, leaderBonus, breaksAndRuns, describeBand } from './game-engine/combat/enemy-roles.js';
import { readNemeses, noteEscape, whoReturns, comeback, nemesisFalls } from './game-engine/campaign/nemesis.js';
// H2 de wiki/LO_QUE_FALTA.md: «Cómo se juega», con lo que el motor sabe.
import { buildHowToPlay } from './game-engine/campaign/how-to-play.js';
import { getMapLegend } from './game-engine/campaign/campaign-pack-schema.js';
// B1 y B2 de wiki/LO_QUE_FALTA.md: la altura y las salidas del tablero.
import { heightBetween, isHigh } from './game-engine/board/heights.js';
import { isExit, exitCells, readLeft, leaveBoard, hasLeft, stillFighting, everyoneOut, leaveLine } from './game-engine/board/exits.js';
// T1, T2 y B3 de wiki/LO_QUE_FALTA.md: la palanca, la barricada, la tregua y los refuerzos.
import { hitBarricade, pullLever } from './game-engine/board/interactables.js';
import { truceOffered, truceLine, callsForHelp, helpWave } from './game-engine/combat/morale-options.js';
// T4: la estación y la magia, en los precios.
import { seasonalMarket, magicStance } from './game-engine/campaign/season-market.js';
// T3: la gente del mundo ve a la mascota.
import { reactionsHere } from './game-engine/campaign/pet-reception.js';
// R6: los jefes con fases.
import { bossPhase } from './game-engine/combat/boss-phases.js';
// R6 del roadmap de profundidad: tableros con intención.
import { generateIntended, threatOf, budgetFor } from './game-engine/world-builder/board-intent.js';
// R4: pergaminos y varitas.
import { MAGIC_ITEMS, judgeMagicItems, afterUse, canLearnScroll } from './game-engine/rules/magic-items.js';
// R4 del roadmap de profundidad: la magia, solo la del grimorio.
import {
    grimoireAbilities, spellById, spellAbility, spellsForClass, spendCharge, magicInData, magicLine, knownSpells, describeSpell,
    describeCharges, SCHOOLS, COMPONENTS, SPELLS, CIRCLE_LABELS,
} from './game-engine/rules/grimoire.js';
import { pairOptions, pairLine } from './game-engine/rules/pair-moves.js';
import { getReachableCells, findPath, getPathCost } from './game-engine/board/pathfinding.js';
import { getCoverAlongLine } from './game-engine/board/line-of-sight.js';
import { createEmptyFog, normalizeFog, updateFog } from './game-engine/board/fog-of-war.js';
import { planEnemyTurn } from './game-engine/combat/enemy-ai.js';
import { planAllyTurn, stanceOf, STANCES, PREFERENCES, DEFAULT_PREFERENCE } from './game-engine/combat/ally-ai.js';
import { chooseEnemyAbility, longestReach, averageOf } from './game-engine/combat/enemy-abilities.js';
import {
    MANEUVERS, judgeManeuvers, recordManeuver, startTurn as startManeuverTurn, attackEdge,
    consumeHelp, rollWithEdge, describeEdge, resolveShove, readManeuvers, noteKnockdown, takeCombo, COMBO_DICE,
    canHide, hideDC, revealHidden, cannotAct,
} from './game-engine/combat/maneuvers.js';
import { THROWABLES, judgeThrows, throwablesOf, burningPuddle } from './game-engine/combat/throwables.js';
import { readyAttack, dropReadied, readiedAgainst } from './game-engine/combat/readied.js';
import { canReact, markReacted, bossLine } from './game-engine/combat/boss-reaction.js';
import { perkChoices, takePerk, perkBonus, PERKS, perksOf } from './game-engine/rules/level-perks.js';
import { hasMaster, lessonsHere, describeLesson, LESSON } from './game-engine/campaign/masters.js';
import { startGame, drawDie, stand, cheat, payout, describeGame, roundsLeft, BETS } from './game-engine/campaign/tavern-dice.js';
import { MOUNTS, addMount, mountedDays, feedPerWeek, describeMounts } from './game-engine/world/mounts.js';
import { assignRoles, rollRoles, describeRoles } from './game-engine/world/travel-roles.js';
import { isIndoors, carriesLight, combatVisibility, visibilityPenalties, sightFeetFor } from './game-engine/world/visibility.js';
import { companionEpilogues } from './game-engine/campaign/epilogues.js';
import { canPry, notePry, secretNote, describeSecrets, SECRET_DC, SECRET_SKILL } from './game-engine/campaign/npc-secrets.js';
import { repliesFor } from './game-engine/ui/shell/replies.js';
import { checkWorldDensity, gemRequest } from './game-engine/campaign/world-density.js';
import { SCENERY, sceneryNear, judgeSceneryThrow } from './game-engine/combat/throwables.js';
import { spreadFire, fireAt } from './game-engine/board/living-terrain.js';
import { playCue } from './game-engine/ui/shell/action-sounds.js';
import { loadAudioSettings } from './game-engine/ui/shell/scene-audio.js';
import { trophiesOf, trophyItem, canCraft, cloakItem, upgradedWeapon, RECIPES } from './game-engine/campaign/trophies.js';
import { seasonOf, seasonClimates, describeSeason, openInSeason, readSeason } from './game-engine/world/seasons.js';
import { canCamp, nightRisk, defaultGuards, resolveNight, campMorning, MAX_GUARDS } from './game-engine/campaign/camp.js';
import { approvalFor, approvalFromOpinions, noteApproval, frictionsOn, describeApproval, approvalOf, DECISIONS } from './game-engine/campaign/approval.js';
import { duePersonalQuests, personalQuestFor, describePersonalAsk } from './game-engine/campaign/personal-quests.js';
import { readBench, benchMember, callFromBench, whereHired } from './game-engine/campaign/bench.js';
import { respecCost, redoPerks } from './game-engine/rules/respec.js';
import { languageBarrier, languagesOf } from './game-engine/rules/languages.js';
import { saveSet, applySet, readSets } from './game-engine/rules/equipment-sets.js';
import { giveItem } from './game-engine/rules/give-item.js';
import { neighboursOf, fateAt, driftOf, describeFate } from './game-engine/world/people-fate.js';
import { namedContract, hasNamed, NAMED_CHANCE } from './game-engine/campaign/named-contracts.js';
import { addOffer, takeOffer, resolveOffer, offerChips } from './game-engine/campaign/item-offers.js';
import { toneNote, nextTone, describeTone, readTone } from './game-engine/campaign/scene-tone.js';
import { makeShareCode } from './game-engine/campaign/share-code.js';
import { noteOutcome, shouldSoften, softenEnemy, SOFTEN_NOTE } from './game-engine/campaign/safety-net.js';
import { judgeDepartures, describeWarning, describeLeaving } from './game-engine/campaign/departures.js';
import { talkPairs, campTalkPrompt, makePeace, roundPrompt, topicHits, TOPICS } from './game-engine/campaign/camp-talk.js';
import { rivalOf, rivalsTake, describeRivalTake } from './game-engine/campaign/rivals.js';
import { stealDC, stealOutcome, guardsAt, settleGuards, coolDown, WATCH, readWanted } from './game-engine/campaign/crime.js';
import { store, retrieve, readStorage } from './game-engine/campaign/storage.js';
import { guestMember, hirelingsHere, guestsLeave, wardLost, exitCell } from './game-engine/campaign/guests.js';
import { readVillain, villainScenesDue, villainNote } from './game-engine/campaign/villain.js';
import { seaLegs, fareFor, sailingDays, describeVoyage } from './game-engine/world/ships.js';
import { shiftAttitude, attitudeBonus, describeAttitude, readAttitudes } from './game-engine/campaign/attitudes.js';
import { summarizeAct, hideRange, addSummary, readSummaries } from './game-engine/campaign/act-summary.js';
import { previewOf, describePreview } from './game-engine/campaign/world-preview.js';
import { readIllustrationSettings, promptFor, buildRequest, imageFrom } from './game-engine/campaign/illustrations.js';
import { notForHero } from './game-engine/campaign/hero-fit.js';
import { newPerson, newPlace } from './game-engine/campaign/director.js';
import { stairsReached, nextLevel, withStairs, levelName } from './game-engine/board/dungeon-levels.js';
import { SOCIAL_SKILLS } from './game-engine/rules/languages.js';
import { speakerOf, initialsOf, hueOf } from './game-engine/ui/shell/speakers.js';
import { describeForecast, describeIntents } from './game-engine/combat/forecast.js';
import { noteDealt, noteTaken, buildVictoryReport } from './game-engine/combat/tally.js';
import { planRetreat } from './game-engine/combat/retreat.js';
import { planWalk, canWalk } from './game-engine/board/walk.js';
import { enterCell, describeHazard, passiveSpot, hazardsAt, visibleHazards } from './game-engine/board/hazards.js';
import {
    buildTracker, describeTurn, statusMarkers, sizeToCells, toggleCondition,
} from './game-engine/combat/initiative-tracker.js';
import {
    createTurnState, advanceTurn, getRemainingMovement, spendMovement, hasAction, useAction,
} from './game-engine/combat/turn-machine.js';
import { rollEncounterLoot, lootRulesWithWorldItems, DEFAULT_LOOT_RULES } from './game-engine/combat/loot.js';
import { holdDuringCombat } from './game-engine/combat/combat-hold.js';
import {
    applyInjury, healInjuries, describeInjuries, readInjuries, setInjury, treatmentCost, rollInjury,
} from './game-engine/rules/injuries.js';
import {
    tickNeeds, exhaustionInjury, describeNeeds, LETHAL_EXHAUSTION,
} from './game-engine/rules/needs.js';
import { resolveFall, describeSurvival, canCheckpoint, readSurvival } from './game-engine/rules/mortality.js';
import {
    stagesFor, keepOn, hasLetter, describeMode as describeGameMode, recordModeChange, isIronRun, modeOf, modeLabel,
    MODES as GAME_MODES, lettersOf,
} from './game-engine/rules/modes.js';
import { weeklyBill, settleWeek, describeBill } from './game-engine/rules/upkeep.js';
import { readRemedies, remediesFor, applyRemedy, shouldOfferRetirement } from './game-engine/rules/remedies.js';
import { readDebt, offerPatronage, settlesDebt, debtDue, describeDebt, borrow, repay, LOAN } from './game-engine/campaign/patronage.js';
import { rollLine, damageLine } from './game-engine/rules/roll-line.js';
import { epitaphFor, heirloomOf, heirOf, addGrave, gravesAt, readGraves, addToHall, readHall, describeHallEntry } from './game-engine/campaign/legacy.js';
import { addFame, fameAt, fameNote, describeFame } from './game-engine/campaign/fame.js';
import { lootable, relicsFor, describeRelic } from './game-engine/campaign/relics.js';
import { dressLoot, templeWork, identify, liftCurse, canTakeOff, shownName, curseInjury, TEMPLE_PRICES } from './game-engine/campaign/item-lore.js';
import { SKILLS, checkOptions, rollCheck, skillModifier, DEFAULT_DC } from './game-engine/rules/checks.js';
import {
    PACES, readPace, paceDays, paceEvents, isSetback, setbackChoice, resolveSetback, FORCE_DC, FORCE_HURT, RUSH_REST_HOURS,
} from './game-engine/world/travel-choices.js';
import { shiftFortune, fortuneLine } from './game-engine/world/fortune.js';
import { queueNews, deliverNews, clockWarnings } from './game-engine/world/news.js';
import { dueHints, buildJournal, buildHelp, pendingByPlace, buildRecap } from './game-engine/campaign/guidance.js';
import { addNotice, unseenCount, glanceRow, MAX_VISIBLE_TOASTS } from './game-engine/ui/shell/notices.js';
import { addRequest, takeRequest, readRequests } from './game-engine/campaign/check-requests.js';
import { recordDeed, proposeDeed, worldMemoryBlock, roadTrouble } from './game-engine/campaign/world-memory.js';
import { readSession, enterScene, noteSent, noteClick, describeSession } from './game-engine/campaign/session-log.js';
import { captureKeys, restoreKeys, captureWorld, restoreWorld } from './game-engine/campaign/state-registry.js';
import { DAY_STAGES, WEEK_STAGES, runStages, weeksDue } from './game-engine/campaign/time-stages.js';
import { upcoming, describeUpcoming, whenText } from './game-engine/campaign/upcoming.js';
import { affairsOf, standingsOf, weekSummary } from './game-engine/campaign/week-table.js';
import { STANCES as DUEL_STANCES, handFrom, startDuel, playArgument, duelOutcome, duelPrompt } from './game-engine/campaign/word-duel.js';
import { canDispatch, dispatchOdds, dispatchDays, startDispatch, dispatchesDue, resolveDispatch } from './game-engine/campaign/dispatch.js';
import { CASE_CHANCE, generateCase, checkCase, accuse, caseForNarrator, readCases, cluesHere } from './game-engine/campaign/cases.js';
import { mapRows, describeRoute, setNote, markVisited } from './game-engine/campaign/text-map.js';
import { readTaggedLine, chronicleOf, chronicleSections, foldPlan, describeFold } from './game-engine/campaign/chronicle.js';
import {
    readPlot, startPlot, plotEvent, focusOf, describeFocus, plotFromFaction, chooseEnding, actOf, hasEnded,
    visibleOpen, secretsOf, omensOf, daysLeftOf, cluesOf, closedOf, readPlotState,
} from './game-engine/campaign/plot.js';
import {
    readWrittenContracts, availableWritten, writtenSlots, toBoardContract, settlesNoFight, describeWrittenAccept,
} from './game-engine/campaign/written-contracts.js';
import { readRumors, nextRumor, describeRumor } from './game-engine/campaign/rumors.js';
import { chooseSource } from './game-engine/campaign/mix.js';
import {
    canExplore, discoverPlace, boardForPlace, peopleWanted, readProposals, addProposal, takeProposal,
} from './game-engine/world/growth.js';
import { ToolManager } from './tool-calling.js';
import { servicesOf, serviceActions, SERVICE_INFO } from './game-engine/campaign/services.js';
import { chooseBark, opinionOf, wantsOf, chooseEnemyBark } from './game-engine/combat/barks.js';
import { critEffect, roleOf, breaksMorale, isFlanked } from './game-engine/combat/crits.js';
import { groupMorale, campJobOf, withJob, whoMourns, mourningFor } from './game-engine/campaign/company.js';
import { takePrisoners, prisonerChips, dealWith, BOUNTY } from './game-engine/campaign/prisoners.js';
import { findShortcut, applyShortcut, roadEncounter, roadStop } from './game-engine/world/road.js';
import { addRoll, diceStats, readRolls } from './game-engine/campaign/dice-log.js';
import { basePrice, weeklyStock, priceToday, sellPrice, canSell, junkOf } from './game-engine/campaign/shop.js';
import { festivalsOf, festivalToday, daysUntil } from './game-engine/world/festivals.js';
import { readLetters, newLetters } from './game-engine/campaign/letters.js';
import { bump, describeStats } from './game-engine/campaign/stats.js';
import { intentSkills } from './game-engine/campaign/intents.js';
import { tipFor, GLOSSARY } from './game-engine/ui/shell/tips.js';
import { LENGTHS, lengthNote, nextLength } from './game-engine/campaign/narration.js';
import { noteFeat, newNickname, traitBonus, traitsOf, addScar, desireLine, heroStory, TRAIT_AT, knackBonus, knacksOf, KNACK_AT } from './game-engine/campaign/feats.js';
import { forageCheck, forageResult } from './game-engine/campaign/forage.js';
import { readRecruits, recruitActions, bondSceneFor, describeMeeting, describeJoin, arrivalLines } from './game-engine/campaign/recruit.js';
import { addMemory, memoryLines, lastMemoryWith } from './game-engine/campaign/memories.js';
import { bodyLine } from './game-engine/campaign/body.js';
import { relieve, readNeeds } from './game-engine/rules/needs.js';
import { promptKey } from './game-engine/cost/prompt-order.js';
import {
    generateBoardOfContracts, contractsFromFactions, expireContracts, describeContract,
} from './game-engine/campaign/contracts.js';
import {
    readGuild, upkeepWithBuildings, boardSize, settleLoyalty, completeContract, STAFF_ROLES, retireTo,
    upgradeCost, describeGuild, trainingFor,
} from './game-engine/campaign/guild.js';
import { generateBoard } from './game-engine/world-builder/dungeon-generator.js';
import {
    formParty, canControl, describeMode, readMode, MODES, readReasons,
} from './game-engine/rules/companions.js';
import { describeLootItem, declaredLootNames } from './game-engine/combat/loot-items.js';
import { planSpawnCells } from './game-engine/combat/spawn.js';
import { buildTargetCard, describeTargetCard } from './game-engine/combat/target-card.js';
import {
    deriveRooms, openDoor, enemiesInRoom, awakePlacements, normalizeRooms,
} from './game-engine/campaign/campaign-map.js';
import {
    planEndure, planFollowUp, planBatonPass, planUltimate,
} from './game-engine/combat/bond-perks.js';
import {
    buildBoardState, judgeScenario, hasScenario,
} from './game-engine/combat/scenario-board.js';
import {
    formatCalendar,
} from './game-engine/campaign/calendar.js';
import {
    recordBondEvent, getBondProgress, spendPerk, BOND_EVENTS,
} from './game-engine/campaign/bonds.js';
import { renderCampaignPanel } from './game-engine/ui/campaign-panel.js';
import {
    buildEpiloguePrompt, createCombatLogPanel, renderCombatLog, setRound,
    rollEntry, lineToEntry, append as appendLogEntry, filterLog, renderLogFilters, logFilterOf,
} from './game-engine/ui/combat-log.js';
import { buildGameMessage, CHANNEL } from './game-engine/ui/chat-channel.js';
import { guardRolls, guardImpossibleRolls, describeCorrections } from './game-engine/combat/roll-guard.js';
import {
    findContradictions, appendContradictions, summariseContradictions,
} from './game-engine/ui/contradiction-log.js';
import {
    planRulesetChange, readRememberedRuleset, rememberRuleset, setActiveRuleset,
    getActiveRuleset,
} from './game-engine/rules/ruleset.js';
import {
    planLevelUp, buildLevelUpPatch, describeLevelUp, validateAbilityPicks, ABILITIES,
    levelForXp,
} from './game-engine/rules/level-up.js';
import {
    normalizeAbilities, knownAbilities, usesLeft, canUseAbility, planAbilityUse,
    spendAbilityUse, describeAbility,
} from './game-engine/rules/abilities.js';
import {
    addConditionTimer, expireConditions, clearTimersFor,
} from './game-engine/combat/condition-timers.js';
import {
    isDying, rollDeathSave, takeHitWhileDown, clearDeathSaves,
} from './game-engine/rules/death-saves.js';
import {
    findOpportunityAttacks, describeOpportunity,
} from './game-engine/combat/opportunity.js';
import {
    createCheckpoint, normalizeCheckpoints, addCheckpoint, findCheckpoint, describeCheckpoint,
    CHECKPOINT_KEY,
} from './game-engine/campaign/checkpoint.js';
import {
    isShellOpen, toggleGameShell, refreshGameShell, closeGameShell,
} from './game-engine/ui/shell/game-shell.js';
import { buildDialogueView } from './game-engine/ui/shell/dialogue-scene.js';
import { buildExplorationView } from './game-engine/ui/shell/exploration-scene.js';
import { buildClockView, availableHitDice } from './game-engine/ui/shell/clock-widget.js';
import { buildActionChips } from './game-engine/ui/shell/action-chips.js';
import { buildCompanionCard, judgeGift } from './game-engine/ui/shell/companion-card.js';
import { buildPackFromWorld, describeExport } from './game-engine/campaign/campaign-export.js';
import { normalizePack, validatePack } from './game-engine/campaign/campaign-pack.js';

/** @typedef {import('./party/types.js').PartyMember} PartyMember */
/** @type {PartyMember[]} */
let partyMembers = [];

const LOCATION_MAPS_MANUAL_HIDDEN_KEY = 'sillytavern_locationMapsManualHidden';

/**
 * Si el Modo Juego se abre solo al arrancar.
 *
 * Encendido por defecto: este fork es un juego, y un juego se abre por su pantalla de
 * titulo, no por la bandeja de entrada de un chat. Pero se apaga con un clic desde la
 * pausa, y apagado la aplicacion arranca exactamente como la de siempre.
 */
const GAME_SHELL_AUTOSTART_KEY = 'sillytavern_gameShellAutostart';

/** @type {boolean} */
let locationMapsManuallyHidden = false;

/** @type {{ tokenId: number|null, boardName: string, locationName: string }} */
let combatBoardSelection = { tokenId: null, boardName: '', locationName: '' };

/**
 * Quien ha gastado ya su reaccion en esta ronda.
 *
 * Un ataque de oportunidad cuesta la reaccion, y la reaccion es una por ronda: sin esto,
 * un solo enemigo cobraria peaje a todo el grupo cada vez que alguien se mueve.
 * @type {Set<string>}
 */
let usedReactions = new Set();

/** @type {HTMLElement|null} */
let combatDiceOverlayElement = null;

/** @type {Array<{title: string, subtitle: string, dc: string, total: string, formula: string, classification: 'critical-success'|'success'|'failure'|'critical-failure', detail: string, glyph: string}>} */
let combatDiceQueue = [];

let combatDiceAnimating = false;

function savePartyState() {
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
function getPartyEntryDisplayName(entry) {
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
        partyMembers = chat_metadata.party
            .filter((member) => member && member.id && member.name)
            .map((member) => migratePartyMember(member));
        partyMembers = partyMembers.map((member) => {
            if (member.name === 'Untitled') {
                const fallbackName = getPartyMemberFallbackName(member);
                console.log('Replacing Untitled party member name with fallback', { member, fallbackName });
                return { ...member, name: fallbackName };
            }
            return member;
        });
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
        partyMembers = [];
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
 * @param {PartyMember} member
 * @returns {string|null}
 */
function getMemberWorldName(member) {
    return member.worldName || (chat_metadata ? chat_metadata[METADATA_KEY] : null) || null;
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

/**
 * @typedef {Object} DndCatalog
 * @property {string[]} races
 * @property {string[]} classes
 * @property {string[]} factions
 * @property {string[]} locations
 * @property {Map<string, Partial<PartyMember>>} classPresets
 */

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
 * @param {PartyMember} member
 * @param {Partial<PartyMember>} preset
 */
function applyClassPresetToMember(member, preset) {
    const assignIfNumber = (key, value) => {
        if (typeof value === 'number' && Number.isFinite(value)) {
            /** @type {any} */ (member)[key] = value;
        }
    };

    assignIfNumber('strength', preset.strength);
    assignIfNumber('dexterity', preset.dexterity);
    assignIfNumber('constitution', preset.constitution);
    assignIfNumber('intelligence', preset.intelligence);
    assignIfNumber('wisdom', preset.wisdom);
    assignIfNumber('charisma', preset.charisma);
    assignIfNumber('armorClass', preset.armorClass);
    assignIfNumber('speed', preset.speed);
    assignIfNumber('maxHp', preset.maxHp);
    assignIfNumber('hp', preset.hp);
    if (member.hp > member.maxHp) {
        member.hp = member.maxHp;
    }
    member.classPresetSource = member.class;
    member.classPresetDirty = false;
}

function memberHasLikelyEditedStats(member) {
    if (member.classPresetDirty) return true;
    const defaults = getDefaultDndData();
    const deviatesFromDefaults =
        member.strength !== defaults.strength
        || member.dexterity !== defaults.dexterity
        || member.constitution !== defaults.constitution
        || member.intelligence !== defaults.intelligence
        || member.wisdom !== defaults.wisdom
        || member.charisma !== defaults.charisma
        || member.armorClass !== defaults.armorClass
        || member.speed !== defaults.speed;
    return deviatesFromDefaults;
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
        const level = entry.dndData?.level ? `Lv ${entry.dndData.level}` : '';
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

    const headerHtml = `<h3 style="margin:0 0 6px"><i class="fa-solid fa-user-plus"></i> ${t`Add Character to Party`}</h3>
        <p style="margin:0 0 10px;font-size:0.85rem;color:var(--SmartThemeQuoteColor,#999)">${t`Select a character from the world to add to your party.`}</p>`;

    const content = $(`<div class="party-picker-container">${headerHtml}${gridHtml}</div>`);

    const popup = new Popup(content, POPUP_TYPE.CONFIRM, undefined, {
        wider: true,
        okButton: t`Add to Party`,
        cancelButton: t`Cancel`,
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
 * Syncs a party member's data back to the corresponding World Info entry.
 * @param {PartyMember} member
 */
async function syncPartyMemberToWorldInfo(member) {
    if (member.wiUid == null || !member.worldName) return;

    try {
        const data = /** @type {any} */ (await loadWorldInfo(member.worldName));
        if (!data?.entries) return;

        const entry = data.entries[member.wiUid];
        if (!entry) {
            console.warn('syncPartyMemberToWorldInfo: entry not found', { wiUid: member.wiUid, worldName: member.worldName });
            return;
        }

        // Update entry fields from party member
        entry.comment = member.name;
        if (!entry.dndData) entry.dndData = {};
        entry.dndData.image = member.avatar;
        entry.dndData.level = member.level;
        entry.dndData.charClass = member.class;
        entry.dndData.race = member.race || '';
        entry.dndData.factions = Array.isArray(member.factions) ? member.factions : [];
        entry.dndData.locationName = member.mapPosition?.locationName || '';
        entry.dndData.maxHp = member.maxHp;
        entry.dndData.alignment = member.alignment;
        entry.dndData.personality = member.personality;
        entry.dndData.str = member.strength;
        entry.dndData.dex = member.dexterity;
        entry.dndData.con = member.constitution;
        entry.dndData.int = member.intelligence;
        entry.dndData.wis = member.wisdom;
        entry.dndData.cha = member.charisma;
        entry.dndData.ac = member.armorClass;
        entry.dndData.speed = member.speed;
        entry.dndData.name = member.name;

        await saveWorldInfo(member.worldName, data, true);
        console.log('syncPartyMemberToWorldInfo synced', { member: member.name, wiUid: member.wiUid });
    } catch (e) {
        console.warn('syncPartyMemberToWorldInfo failed', e);
    }
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

export function setPartyFromWorldEntries(entries, worldName = null) {
    console.log('setPartyFromWorldEntries called', { entriesCount: entries?.length, entries, worldName });
    // Auto-detect world name from chat metadata if not provided
    const resolvedWorldName = worldName || (chat_metadata ? chat_metadata[METADATA_KEY] : null) || null;
    partyMembers = [];
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

function renderPartyMembers() {
    const list = $('#rm_party_list');
    if (!list.length) return;

    list.empty();

    if (partyMembers.length === 0) {
        list.append(
            '<div class="flex-container alignitemscenter justifyCenter padding10"><small data-i18n="No party members.">No party members.</small></div>',
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
                        <button class="party-card-remove menu_button fa-solid fa-trash-can" title="Remove member" data-i18n="[title]Remove member"></button>
                    </div>
                    <div class="party-card-meta">
                        <span data-i18n="[title]Level">Lvl ${member.level}</span>
                        <span>${member.class}</span>
                    </div>
                    <div class="party-card-stats">
                        <div class="party-card-stat">
                            <div class="stat-label" data-i18n="HP">HP</div>
                            <div class="stat-value">${member.hp}/${member.maxHp}</div>
                        </div>
                        <div class="party-card-stat">
                            <div class="stat-label" data-i18n="EXP">EXP</div>
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

/** Currently selected location name — per-chat, stored in chat_metadata */
let currentLocationName = '';
/** Currently selected board name — per-chat, stored in chat_metadata */
let currentBoardName = '';

function saveCurrentLocation() {
    if (chat_metadata) {
        chat_metadata['currentLocation'] = currentLocationName;
        // Idea 69: el mapa sabe dónde habéis estado.
        if (currentLocationName) chat_metadata[VISITED_KEY] = markVisited(chat_metadata[VISITED_KEY], currentLocationName);
        saveMetadata();
    }
}

function saveCurrentBoard() {
    if (chat_metadata) {
        chat_metadata['currentBoard'] = currentBoardName;
        saveMetadata();
    }
}

function loadCurrentLocation() {
    currentLocationName = (chat_metadata && chat_metadata['currentLocation']) || '';
    currentBoardName = (chat_metadata && chat_metadata['currentBoard']) || '';
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
async function ensureWorldData() {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (worldName && worldName !== loadedWorldName) await reloadWorldFactions();
}

/**
 * Las facciones del mundo abierto, ya leidas.
 *
 * Mismo apano que `lastCompendium`: `renderCampaignTab` se dibuja de golpe y no puede ser
 * `async`. Sin facciones escritas esto es una lista vacia y el panel queda como estaba.
 *
 * @type {any[]}
 */
let currentWorldFactions = [];

/** Idea 74: la estación en la que empezó el mundo; vacía es la de siempre (otoño). */
let lastWorldSeason = '';

/** R5: el género del mundo, para ofrecer la mascota que le pega. */
let lastWorldGenre = '';

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
function enemiesInSeason() {
    const season = currentSeason();
    return getCurrentWorldEnemies().filter((/** @type {any} */ e) => openInSeason(e?.seasons, season));
}

/** @returns {any[]} */
function getCurrentWorldFactions() {
    return currentWorldFactions;
}

/** @returns {Promise<any[]>} */
async function reloadWorldFactions() {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName) {
        currentWorldFactions = [];
        return currentWorldFactions;
    }
    try {
        const data = await loadWorldInfo(worldName);
        loadedWorldName = worldName;
        currentWorldFactions = readFactions(data?.metadata?.factions);
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
    } catch (error) {
        console.error('[party] no se pudieron leer las facciones', error);
        currentWorldFactions = [];
    }
    return currentWorldFactions;
}

/**
 * Helper: resolve boards for a location, including legacy boardName fallback.
 * @param {any} loc
 */
function getLocationBoards(loc) {
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

/**
 * The fight in progress.
 *
 * Typed as the turn machine's own Encounter now that the machine is what runs it: there
 * is one definition of a turn, and this is it. The enemy list stays widened to the game's
 * EnemyInstance, which carries the sheet the machine does not care about.
 *
 * @type {import('./game-engine/combat/turn-machine.js').Encounter & { enemies: import('./dnd-system.js').EnemyInstance[], collectedTreasures?: string[] }}
 */
let combatEncounter = { active: false, enemies: [], turnOrder: [], currentTurnIndex: 0, round: 0, turnState: null };

function saveCombatState() {
    if (chat_metadata) {
        chat_metadata['combatEncounter'] = JSON.parse(JSON.stringify(combatEncounter));
        saveMetadata();
    }
}

function loadCombatState() {
    const saved = chat_metadata?.['combatEncounter'];
    if (saved && saved.active) {
        combatEncounter = normalizeCombatEncounter(saved);
    } else {
        combatEncounter = createEmptyCombatEncounter();
    }
}

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

function getCurrentTurnState() {
    const entry = getCurrentTurnEntry();
    if (!entry) {
        combatEncounter.turnState = null;
        return null;
    }

    const current = combatEncounter.turnState;
    if (current && current.actorId === entry.id && current.isEnemy === entry.isEnemy) {
        return current;
    }

    combatEncounter.turnState = createTurnState(entry);
    saveCombatState();
    return combatEncounter.turnState;
}

/**
 * @param {import('./dnd-system.js').TurnEntry|null} entry
 */
function resetCombatTurnState(entry) {
    combatEncounter.turnState = createTurnState(entry);
    saveCombatState();
}

/**
 * @param {string} instanceId
 */
function getEnemyByInstanceId(instanceId) {
    return combatEncounter.enemies.find(enemy => enemy.instanceId === instanceId) || null;
}

function getAliveEnemies() {
    return combatEncounter.enemies.filter(enemy => (enemy.currentHp || 0) > 0);
}

/**
 * @param {import('./dnd-system.js').TurnEntry|null} entry
 */
function getPartyMemberByTurnEntry(entry) {
    if (!entry || entry.isEnemy) return null;
    return partyMembers.find(member => String(member.id) === String(entry.id)) || null;
}

function getCurrentActingMember() {
    return getPartyMemberByTurnEntry(getCurrentTurnEntry());
}

/**
 * @param {PartyMember|null} member
 */
function getRemainingMovementFeet(member) {
    if (!member) return 0;
    const turnState = getCurrentTurnState();
    const speed = Number(member?.speed) || 30;
    // Somebody who is not the current actor has their whole move ahead of them.
    if (!turnState || turnState.actorId !== String(member.id)) return speed;
    return getRemainingMovement(combatEncounter, speed);
}

/**
 * @param {PartyMember|null} member
 */
function getAttackableEnemiesForMember(member) {
    if (!member) return [];
    const origin = member.mapPosition || { gridX: 0, gridY: 0, locationName: '' };
    const originX = Number.isFinite(Number(origin.gridX)) ? Number(origin.gridX) : 0;
    const originY = Number.isFinite(Number(origin.gridY)) ? Number(origin.gridY) : 0;
    const rangeFeet = getAttackRangeFeet(member);
    return getAliveEnemies().filter(enemy => {
        const enemyX = Number.isFinite(Number(enemy.gridX)) ? Number(enemy.gridX) : 0;
        const enemyY = Number.isFinite(Number(enemy.gridY)) ? Number(enemy.gridY) : 0;
        return getDistanceInFeet(originX, originY, enemyX, enemyY) <= rangeFeet;
    });
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

/**
 * Returns the IDs of party members that the player directly controls (personaId !== null).
 * Falls back to all party member IDs if none are persona-linked.
 * @returns {number[]}
 */
/**
 * En solo llevas al tuyo; los demas deciden por su cuenta.
 *
 * Se filtra aqui, en el unico sitio que decide que fichas se pueden arrastrar, para que
 * el modo no haya que recordarlo en cada pantalla.
 *
 * @param {number[]} ids
 * @returns {number[]}
 */
function underYourHand(ids) {
    const rules = getActiveRuleset()?.companions ?? null;
    if (readMode(rules) === MODES.GROUP) return ids;

    return ids.filter((id) => {
        const member = partyMembers.find(m => Number(m.id) === Number(id));
        return member ? canControl(member, partyMembers, rules).allowed : false;
    });
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
 * @returns {import('./world-map-renderer.js').HighlightCell[]}
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
function persistBoardTerrain(board) {
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
 * @returns {import('./game-engine/board/terrain.js').BoardTerrain}
 */
function getActiveBoardTerrain() {
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

    currentLocationName = location.name;
    currentBoardName = board.name;
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
 * @returns {{terrain: import('./game-engine/board/terrain.js').BoardTerrain, gridWidth: number, gridHeight: number, board: any}}
 */
function getActiveBoardContext() {
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
    const moveCells = getReachableCells(getActiveBoardTerrain(), tentGX, tentGY, remainingFromHere, gridW, gridH);
    const rangeFeet = getAttackRangeFeet(member);
    /** @type {{gridX:number,gridY:number,kind:'attack'}[]} */
    const attackCells = getAliveEnemies()
        .filter(e => getDistanceInFeet(tentGX, tentGY, e.gridX || 0, e.gridY || 0) <= rangeFeet)
        .map(e => ({ gridX: e.gridX || 0, gridY: e.gridY || 0, kind: /** @type {'attack'} */ ('attack') }));
    return [...moveCells, ...attackCells];
}

/**
 * The combat log shown beside the board.
 *
 * Session state on purpose: the log is a read-out of a fight in progress, and the fight
 * itself already lives in the encounter. Writing 300 entries into the world info on every
 * swing would grow the saved campaign for something nobody reads twice. A reload starts
 * a fresh log, and the chat still holds every line.
 *
 * @type {import('./game-engine/ui/combat-log.js').LogEntry[]}
 */
let combatLogEntries = [];

/** The mounted panel, when the board is on screen. Null when it is not. */
let combatLogPanel = null;

/** Idea 20: el filtro del registro. Vive aquí, porque el panel se repinta entero. */
let combatLogFilter = { kind: 'all', who: '' };

/**
 * Pinta el registro con el filtro puesto.
 */
function paintCombatLog() {
    if (!combatLogPanel) return;
    renderCombatLog(combatLogPanel, filterLog(combatLogEntries, combatLogFilter));
}

/**
 * Adds an entry to the log and repaints it if it is visible.
 * @param {import('./game-engine/ui/combat-log.js').LogEntry|null} item
 */
function pushCombatLogEntry(item) {
    if (!item) return;
    combatLogEntries = appendLogEntry(combatLogEntries, item);
    paintCombatLog();
}

/**
 * Mirrors a narration line into the log, one entry per line.
 * @param {string} text
 */
function pushCombatLogLines(text) {
    for (const line of String(text ?? '').split('\n')) {
        pushCombatLogEntry(lineToEntry(line));
    }
}

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
        worldItemCatalogue = Array.isArray(data?.metadata?.itemCatalogue) ? data.metadata.itemCatalogue : [];
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
 * Los objetos que la campana abierta tiene escritos.
 *
 * Se guarda aqui porque el botin se reparte en mitad de un combate y leer el mundo del
 * disco en ese momento seria esperar por algo que ya se sabe. Se rellena al abrir la
 * campana y al guardarla desde el editor, que son las dos unicas veces que cambia.
 *
 * @type {any[]}
 */
let worldItemCatalogue = [];

/** Where the guard's mode lives, so it travels with the campaign. */
const ROLL_GUARD_KEY = 'rollGuardMode';

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
 * Armour class of a target, including the cover its cell grants.
 *
 * Cover is a property of where you stand, so the bonus comes from the target's own cell —
 * the same rule `getCoverBonus` documents. It is a simplification of D&D 5e, where cover
 * depends on the line between attacker and target; doing it properly needs the attacker's
 * position and a traced line, and that can be added later without moving this call site.
 *
 * A board with no terrain yields zero, so every existing board plays exactly as before.
 *
 * @param {{armorClass?: number|null, gridX?: number, gridY?: number, mapPosition?: {gridX?: number, gridY?: number}|null}} target
 * @returns {{ac: number, cover: number}}
 */
/**
 * La clase de armadura de lo que lleva puesto, o 0 si no lleva nada que la de.
 *
 * @param {any} who
 * @returns {number}
 */
function wornArmorClass(who) {
    if (!Array.isArray(who?.items) || !who?.equippedItems) return 0;
    const sum = armourClassOf({
        member: who,
        dexModifier: getAbilityModifier(Number(who.dexterity) || 10),
    });
    return sum.worn ? sum.armorClass : 0;
}

function getTargetArmorClass(target, attacker = null) {
    // Lo que lleva puesto manda sobre el numero de la ficha, **solo si lo lleva puesto**:
    // una armadura equipada es un hecho, y el numero escrito a mano era una promesa. Sin
    // nada con clase de armadura encima, todo sigue exactamente como estaba.
    // Idea 46: la «piel dura» de quien la eligió al subir de nivel.
    const base = (wornArmorClass(target) || Number(target?.armorClass) || 10) + perkBonus(target, 'armorClass');
    const x = Number(target?.gridX ?? target?.mapPosition?.gridX);
    const y = Number(target?.gridY ?? target?.mapPosition?.gridY);

    if (!Number.isFinite(x) || !Number.isFinite(y)) return { ac: base, cover: 0 };

    const terrain = getActiveBoardTerrain();
    const ax = Number(attacker?.gridX ?? attacker?.mapPosition?.gridX);
    const ay = Number(attacker?.gridY ?? attacker?.mapPosition?.gridY);

    // Con atacante conocido, la cobertura es la mejor de la linea de tiro: un pilar
    // protege a quien esta detras, no solo a quien esta dentro. Sin atacante se cae a la
    // regla vieja, la de la casilla del objetivo, que es lo que habia hasta ahora.
    const cover = (Number.isFinite(ax) && Number.isFinite(ay))
        ? getCoverAlongLine(terrain, ax, ay, x, y, getCoverBonus)
        : (Number(getCoverBonus(terrain, x, y)) || 0);

    return { ac: base + cover, cover };
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
function postCombatNarration(text) {
    if (typeof text !== 'string' || !text.trim()) return;
    pushCombatLogLines(text);
    sendSystemMessage(system_message_types.GENERIC, text.trim(), {
        isSmallSys: true,
        isNarrator: true,
    });
    // R5: la mascota, a veces, dice algo de lo que acaba de pasar. Gratis: es del motor.
    petReact(text);
}

/** R8: los que se fueron, con su ficha, por si vuelven. */
const GONE_KEY = 'gone';

/**
 * R9: quien manda en un sitio nota lo que pasa en él: un caso resuelto le gusta; un crimen
 * o la nigromancia, no. Lo mueve `changeStanding`, como los encargos.
 *
 * @param {string} place
 * @param {string} what Una clave de `REACTIONS` (`world-echoes.js`).
 * @returns {Promise<void>}
 */
async function nudgeRuler(place, what) {
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
        currentWorldFactions = moved;
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

/** R7: los que escaparon y pueden volver. */
const NEMESES_KEY = 'nemeses';

/** R5: la mascota del héroe, en los metadatos de la partida. */
const PET_KEY = 'pet';

/** @returns {import('./game-engine/campaign/pet.js').Pet|null} */
function currentPet() {
    return readPet(chat_metadata?.[PET_KEY]);
}

/**
 * T5: la mascota con la que llega un héroe hecho. Si ya hay una, se queda la que hay.
 *
 * @param {{name?: string, species?: string, character?: string}|null} raw
 * @returns {boolean} Si se ha quedado.
 */
export function adoptPet(raw) {
    if (!chat_metadata || !raw || currentPet()) return false;
    const made = createPet({ name: String(raw.name ?? ''), species: String(raw.species ?? ''), character: String(raw.character ?? 'leal') });
    if (!made) return false;
    keepPet(made);
    postCombatNarration(`🐾 [MASCOTA] ${petName(made)} va con vosotros desde el principio.`);
    return true;
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
 * T3: la gente con oficio de un sitio ve a la mascota por primera vez: le gusta o no, lo
 * dice (sin llamar al modelo) y su actitud da un paso.
 *
 * @param {string} place
 */
function petMeetsTown(place) {
    const pet = currentPet();
    if (!pet || !chat_metadata) return;
    const reactions = reactionsHere({
        pet, npcs: lastWorldNpcs, here: place, met: pet.met,
        speciesLabel: PET_SPECIES[/** @type {keyof typeof PET_SPECIES} */ (pet.species)]?.label ?? '',
    });
    if (reactions.length === 0) return;
    let attitudes = chat_metadata[ATTITUDES_KEY];
    for (const reaction of reactions) {
        const shifted = shiftAttitude(attitudes, { name: reaction.npc, delta: reaction.mood, day: campaignDay() });
        if (shifted.ok) attitudes = shifted.state;
        postCombatNarration(`🐾 [MASCOTA] ${reaction.line}`);
    }
    chat_metadata[ATTITUDES_KEY] = attitudes;
    keepPet({ ...pet, met: [...pet.met, ...reactions.map(r => r.npc)] });
}

/**
 * R5: guardar la mascota.
 *
 * @param {import('./game-engine/campaign/pet.js').Pet|null} pet
 */
function keepPet(pet) {
    if (!chat_metadata) return;
    chat_metadata[PET_KEY] = pet;
    saveMetadata();
    // H1: la primera mascota dice qué hace.
    if (pet) showTip('pet');
}

/**
 * R5: reaccionar a una línea de la crónica. Nunca a lo suyo, y como mucho una vez cada rato.
 *
 * @param {string} text
 */
function petReact(text) {
    const pet = currentPet();
    if (!pet || !chat_metadata) return;
    const line = readTaggedLine(text);
    if (!line || line.tag === 'MASCOTA') return;
    const now = Array.isArray(chat) ? chat.length : 0;
    if (!shouldComment({ pet, category: line.category, now, random: Math.random })) return;
    const said = petComment({ pet, category: line.category, random: Math.random });
    if (!said) return;
    keepPet(afterComment(pet, said, now));
    // Detrás de la línea que comenta, y sin volver a entrar aquí.
    setTimeout(() => postCombatNarration(said), 0);
}

/**
 * R5: algo vivido juntos (una pelea ganada, un viaje). Cada cinco, más vínculo.
 */
function petLivesIt() {
    const pet = currentPet();
    if (!pet) return;
    const step = liveTogether(pet);
    keepPet(step.pet);
    if (step.line) postCombatNarration(step.line);
}

/** Los nombres de siempre de cada especie, para no pedir uno en blanco. */
const PET_NAMES = /** @type {Record<string, string>} */ ({
    perro: 'Canela', gato: 'Hollín', zorro: 'Rastro', halcon: 'Brisa', cuervo: 'Graznido', loro: 'Chismes', familiar: 'Chispa', espiritu: 'Susurro',
});

/**
 * R5: la mascota en un cuadro: tenerla, preguntarle, acariciarla. Sin mascota, se elige una
 * de las tres que le pegan al mundo.
 *
 * @returns {Promise<string>}
 */
async function openPetPanel() {
    if (!chat_metadata || partyMembers.length === 0) {
        toastr.info('Abre una partida con alguien en el grupo antes.', 'La mascota');
        return '';
    }
    const pet = currentPet();
    const body = $('<div class="jr-root pet-root"></div>');
    if (!pet) {
        body.append($('<h3></h3>').text('¿Te acompaña alguien?'));
        body.append($('<p></p>').text('Una mascota no ocupa plaza ni cobra. Comenta lo que pasa, ayuda sin pelear y crece contigo.'));
        const choices = petChoicesFor(lastWorldGenre);
        const picked = await new Popup(body[0], POPUP_TYPE.TEXT, '', {
            okButton: false, cancelButton: 'Nadie, por ahora',
            customButtons: choices.map((species, i) => ({
                text: `${PET_NAMES[species]}, ${PET_SPECIES[/** @type {keyof typeof PET_SPECIES} */ (species)].label}${PET_SPECIES[/** @type {keyof typeof PET_SPECIES} */ (species)].talks ? ' (habla)' : ''}`,
                result: 60 + i, classes: ['pet-pick'],
            })),
        }).show();
        const index = Number(picked) - 60;
        const species = choices[index];
        if (!species) return '';
        const characters = Object.keys(PET_CHARACTERS);
        const random = createSeededRandom(derive(String(chat_metadata?.[METADATA_KEY] || ''), 'mascota', species));
        const made = createPet({ name: PET_NAMES[species], species, character: characters[Math.floor(random() * characters.length) % characters.length] });
        keepPet(made);
        if (made) postCombatNarration(`🐾 [MASCOTA] ${petName(made)} se viene contigo (${PET_CHARACTERS[made.character]}).`);
        if (isShellOpen()) refreshGameShell();
        return made ? petName(made) : '';
    }
    body.append($('<h3></h3>').text(petName(pet)));
    body.append($('<p class="pet-sheet"></p>').text(describePet(pet)));
    body.append($('<p></p>').text(PET_SPECIES[pet.species].note));
    const today = campaignDay();
    const petted = Number(chat_metadata.petPetted) === today;
    const picked = await new Popup(body[0], POPUP_TYPE.TEXT, '', {
        okButton: 'Cerrar',
        customButtons: [
            { text: PET_SPECIES[pet.species].talks ? 'Preguntarle' : 'Ver qué hace', result: 71, classes: ['pet-ask'] },
            ...(petted ? [] : [{ text: 'Acariciarle', result: 72, classes: ['pet-pet'] }]),
        ],
    }).show();
    if (picked === 71) {
        const next = whatComes(today)[0] ?? null;
        const urgent = weekAffairsNow()[0] ?? null;
        const state = readCases(chat_metadata?.[CASES_KEY]);
        const missing = state.active ? state.active.clues.find(c => !state.found.includes(c.id) && !c.misleading) : null;
        const clue = missing ? `falta ${missing.how === 'registrar' ? `registrar ${missing.source.name}` : missing.how === 'rumor' ? `oír lo que se dice en ${missing.source.name}` : `hablar con ${missing.source.name}`}` : '';
        postCombatNarration(petAdvice({ pet, next, urgent: urgent ? { title: urgent.title, in: urgent.in } : null, clue }));
    } else if (picked === 72) {
        chat_metadata.petPetted = today;
        saveMetadata();
        postCombatNarration(`🐾 [MASCOTA] ${pet.name} se deja hacer, y el grupo se ríe un rato.`);
        petLivesIt();
    }
    return '';
}

/**
 * R5: los asuntos de la mesa de ahora, para que la mascota sepa qué aprieta.
 *
 * @returns {Array<{title: string, in: number|null}>}
 */
function weekAffairsNow() {
    if (!chat_metadata) return [];
    return keepOn(affairsOf({
        today: campaignDay(),
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
}

/**
 * R5: domar lo que se ha vencido, si es de las que se dejan. Supervivencia, CD 12.
 *
 * @param {any[]} fallen Los enemigos vencidos (las instancias del combate).
 */
function offerTaming(fallen) {
    // T6: se mira su ficha del mundo (el dato `domable`), y solo sin ella, su nombre.
    const beasts = fallen.map(e => {
        const template = getCurrentWorldEnemies().find((/** @type {any} */ t) => String(t.id) === String(e.templateId));
        return { name: String(template?.name ?? e.name), ...(template?.domable !== undefined ? { domable: template.domable } : {}) };
    });
    const beast = beasts.find(b => tamableAs(b));
    if (!beast || !chat_metadata) return;
    const species = tamableAs(beast);
    const toast = toastr.info('Una cría de lo que acabáis de vencer se queda mirándoos. ¿Os la lleváis? (Supervivencia, CD 12)', `🐾 ${PET_SPECIES[/** @type {keyof typeof PET_SPECIES} */ (species)].label}`, { timeOut: 15000, extendedTimeOut: 5000, closeButton: true });
    $(toast).find('.toast-message').append($('<button class="menu_button pet-tame" style="margin-top:6px;"></button>').text('Intentarlo').on('click', () => {
        const who = partyMembers.filter(m => (Number(m.hp) || 0) > 0).reduce((/** @type {any} */ top, m) => (!top || skillModifier(m, 'survival').modifier > skillModifier(top, 'survival').modifier ? m : top), null);
        const roll = who ? rollCheck({ member: who, skill: 'survival', rollD20: () => rollDiceDetailed('1d20', 20).total, dc: 12 }) : null;
        if (roll) postCombatNarration(roll.said);
        if (!roll?.success || currentPet()) {
            postCombatNarration('🐾 [MASCOTA] Se escapa entre la maleza. Otra vez será.');
            return;
        }
        const characters = Object.keys(PET_CHARACTERS);
        const made = createPet({ name: PET_NAMES[species] ?? 'Sin nombre', species, character: characters[Math.floor(Math.random() * characters.length) % characters.length] });
        keepPet(made);
        if (made) postCombatNarration(`🐾 [MASCOTA] ${petName(made)} se viene con vosotros.`);
    }));
}

/**
 * R5: la carta de la mascota con labia (el cuervo, el loro): roba la atención.
 *
 * @returns {any[]}
 */
function petTricks() {
    const pet = currentPet();
    if (!pet || !petDoes(pet, 'labia')) return [];
    return [{ id: 'truco:mascota', kind: 'truco', label: `Que ${pet.name} le robe la atención`, as: 'enganar', power: 2 }];
}

/**
 * R5: la mascota ayuda en combate: una vez por ronda, sin gastar la acción de nadie.
 *
 * @param {string} action
 * @param {any} enemy
 */
function petSupport(action, enemy) {
    const pet = currentPet();
    if (!pet || !combatEncounter.active) return;
    /** @type {any} */ (combatEncounter).petRound = Number(combatEncounter.round) || 1;
    if (action === 'avisar') {
        combatEncounter.maneuvers = recordManeuver(combatEncounter.maneuvers, 'ayudar', 'mascota', String(enemy.instanceId));
        postCombatNarration(`🐾 [COMBAT] ${pet.name} señala a ${enemy.name}: el siguiente golpe del grupo va con ventaja.`);
    } else if (action === 'distraer') {
        applyTimedCondition(enemy, String(enemy.instanceId), 'Distraído', 1);
        postCombatNarration(`🐾 [COMBAT] ${pet.name} se le mete entre las piernas a ${enemy.name}: su próximo golpe va con desventaja.`);
    } else if (action === 'rastrear') {
        const board = getActiveBoardContext().board;
        const hero = partyMembers[0];
        const at = boardCellOf(hero);
        let found = 0;
        if (board && Array.isArray(board.hazards)) {
            board.hazards = board.hazards.map((/** @type {any} */ h) => {
                if (h?.seen || Math.max(Math.abs(Number(h?.x) - at.x), Math.abs(Number(h?.y) - at.y)) > 4) return h;
                found++;
                return { ...h, seen: true };
            });
            persistBoardTerrain(board);
        }
        for (const foe of getAliveEnemies()) combatEncounter.maneuvers = revealHidden(combatEncounter.maneuvers, String(foe.instanceId));
        postCombatNarration(`🐾 [COMBAT] ${pet.name} olfatea alrededor${found > 0 ? `: ${found} trampa(s) a la vista` : ''}, y quien se escondía, ya no.`);
    }
    saveCombatState();
    renderLocationMapsPreview();
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
 * @returns {Promise<void>}
 */
async function postForModel(text) {
    if (typeof text !== 'string' || !text.trim()) return;

    const message = buildGameMessage({
        text: substituteParams(text.trim()),
        channel: CHANNEL.MODEL,
        name: chat_metadata?.narrator_name || 'Narrador',
        avatar: system_avatar,
        timestamp: getMessageTimeStamp(),
        compact: true,
    });

    chat.push(message);
    await eventSource.emit(event_types.MESSAGE_RECEIVED, chat.length - 1, 'game-engine');
    addOneMessage(message);
    await eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, chat.length - 1, 'game-engine');
    await saveChatConditional();
}

/**
 * @param {string} name
 * @param {number} dexterity
 * @param {'ally'|'enemy'} actorType
 * @returns {number}
 */
function rollInitiativeWithPopover(name, dexterity, actorType) {
    const dexMod = getAbilityModifier(dexterity || 10);
    const formula = `1d20${dexMod >= 0 ? '+' : ''}${dexMod}`;
    const roll = rollDiceDetailed(formula, 20);
    const total = roll.total;
    const d20 = roll.natural ?? roll.rolls[0] ?? total;

    showCombatDiceRoll({
        title: `${name} iniciativa`,
        subtitle: actorType === 'enemy' ? 'Iniciativa de enemigo' : 'Iniciativa de aliado',
        formula: roll.formula,
        detail: `d20(${d20}) ${dexMod >= 0 ? '+' : ''}${dexMod} = ${total}`,
        total,
        glyph: 'init',
    });

    return total;
}

function ensureCombatDiceOverlay() {
    if (combatDiceOverlayElement) return combatDiceOverlayElement;

    const overlay = document.createElement('div');
    overlay.className = 'wm-dice-overlay';
    overlay.innerHTML = `
        <div class="wm-dice-backdrop"></div>
        <div class="wm-dice-card">
            <div class="wm-dice-header">
                <div>
                    <div class="wm-dice-title"></div>
                    <div class="wm-dice-subtitle"></div>
                </div>
                <div class="wm-dice-result-badge"></div>
            </div>
            <div class="wm-dice-body">
                <div class="wm-dice-glyph"></div>
                <div class="wm-dice-metrics">
                    <div class="wm-dice-metric">
                        <div class="wm-dice-metric-label">Dificultad</div>
                        <div class="wm-dice-metric-value" data-field="dc"></div>
                    </div>
                    <div class="wm-dice-metric">
                        <div class="wm-dice-metric-label">Resultado</div>
                        <div class="wm-dice-metric-value" data-field="total"></div>
                    </div>
                    <div class="wm-dice-metric">
                        <div class="wm-dice-metric-label">Formula</div>
                        <div class="wm-dice-metric-value" data-field="formula"></div>
                    </div>
                </div>
            </div>
            <div class="wm-dice-result">
                <div class="wm-dice-detail"></div>
            </div>
            <div class="wm-dice-actions">
                <button class="menu_button wm-dice-next" type="button">Next</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    combatDiceOverlayElement = overlay;
    return overlay;
}

function flushCombatDiceQueue() {
    if (combatDiceAnimating || combatDiceQueue.length === 0) return;
    const overlay = ensureCombatDiceOverlay();
    const next = combatDiceQueue.shift();
    if (!next) return;

    combatDiceAnimating = true;

    const titleEl = /** @type {HTMLElement|null} */ (overlay.querySelector('.wm-dice-title'));
    const subtitleEl = /** @type {HTMLElement|null} */ (overlay.querySelector('.wm-dice-subtitle'));
    const dcEl = /** @type {HTMLElement|null} */ (overlay.querySelector('[data-field="dc"]'));
    const totalEl = /** @type {HTMLElement|null} */ (overlay.querySelector('[data-field="total"]'));
    const formulaEl = /** @type {HTMLElement|null} */ (overlay.querySelector('[data-field="formula"]'));
    const glyphEl = /** @type {HTMLElement|null} */ (overlay.querySelector('.wm-dice-glyph'));
    const detailEl = /** @type {HTMLElement|null} */ (overlay.querySelector('.wm-dice-detail'));
    const badge = /** @type {HTMLElement|null} */ (overlay.querySelector('.wm-dice-result-badge'));
    const nextBtn = /** @type {HTMLButtonElement|null} */ (overlay.querySelector('.wm-dice-next'));
    if (!titleEl || !subtitleEl || !dcEl || !totalEl || !formulaEl || !glyphEl || !detailEl || !badge || !nextBtn) return;

    titleEl.textContent = next.title;
    subtitleEl.textContent = next.subtitle;
    formulaEl.textContent = next.formula;
    glyphEl.textContent = next.glyph;
    detailEl.textContent = next.detail;

    badge.textContent = getRollClassificationLabel(next.classification);
    badge.className = `wm-dice-result-badge ${next.classification}`;

    const finalBtnText = combatDiceQueue.length > 0 ? 'Next' : 'Close';
    nextBtn.disabled = true;
    nextBtn.textContent = 'Rolling...';
    dcEl.classList.add('rolling');
    totalEl.classList.add('rolling');

    const dcNumeric = /^-?\d+$/.test(next.dc) ? Number(next.dc) : null;
    const totalNumeric = /^-?\d+$/.test(next.total) ? Number(next.total) : 0;
    const startedAt = Date.now();
    const durationMs = 820;
    const timer = window.setInterval(() => {
        const elapsed = Date.now() - startedAt;
        if (dcNumeric == null) {
            dcEl.textContent = '--';
        } else {
            const spread = Math.max(6, Math.abs(dcNumeric) + 6);
            const randomValue = Math.max(0, dcNumeric + Math.floor((Math.random() * spread) - spread / 2));
            dcEl.textContent = String(randomValue);
        }

        const totalSpread = Math.max(8, Math.abs(totalNumeric) + 8);
        const randomTotal = Math.max(0, totalNumeric + Math.floor((Math.random() * totalSpread) - totalSpread / 2));
        totalEl.textContent = String(randomTotal);

        if (elapsed >= durationMs) {
            window.clearInterval(timer);
            dcEl.textContent = next.dc;
            totalEl.textContent = next.total;
            dcEl.classList.remove('rolling');
            totalEl.classList.remove('rolling');
            nextBtn.disabled = false;
            nextBtn.textContent = finalBtnText;
        }
    }, 42);

    nextBtn.onclick = () => {
        if (!combatDiceAnimating) return;
        window.clearInterval(timer);
        dcEl.classList.remove('rolling');
        totalEl.classList.remove('rolling');
        nextBtn.disabled = false;
        overlay.classList.remove('active');
        window.setTimeout(() => {
            combatDiceAnimating = false;
            flushCombatDiceQueue();
        }, 120);
    };

    overlay.classList.add('active');
}

/**
 * @param {'victory'|'defeat'|'manual'|'ended'} reason
 * @returns {string}
 */
function buildCombatSummary(reason) {
    const enemyTotal = combatEncounter.enemies.length;
    const enemyAlive = combatEncounter.enemies.filter(enemy => (enemy.currentHp || 0) > 0).length;
    const enemyDefeated = Math.max(0, enemyTotal - enemyAlive);

    const partyTotal = partyMembers.length;
    const partyAlive = partyMembers.filter(member => (member.hp || 0) > 0).length;

    let outcome = 'Resultado: combate finalizado.';
    if (reason === 'victory') outcome = 'Resultado: victoria del grupo.';
    if (reason === 'defeat') outcome = 'Resultado: derrota del grupo.';
    if (reason === 'manual') outcome = 'Resultado: combate terminado manualmente.';

    const partyHp = partyMembers.length
        ? partyMembers.map(member => `${member.name} ${member.hp || 0}/${member.maxHp || 0}`).join(' | ')
        : 'Sin miembros de grupo.';
    const enemyHp = combatEncounter.enemies.length
        ? combatEncounter.enemies.map(enemy => `${enemy.name} ${enemy.currentHp || 0}/${enemy.maxHp || 0}`).join(' | ')
        : 'Sin enemigos registrados.';

    return [
        '📋 [COMBAT] Resumen final',
        outcome,
        `Enemigos derrotados: ${enemyDefeated}/${enemyTotal}`,
        `Aliados en pie: ${partyAlive}/${partyTotal}`,
        `HP aliados: ${partyHp}`,
        `HP enemigos: ${enemyHp}`,
    ].join('\n');
}

/**
 * @param {{title: string, subtitle: string, dc: string, total: string, formula: string, classification: 'critical-success'|'success'|'failure'|'critical-failure', detail: string, glyph: string}} payload
 */
function queueCombatDiceRoll(payload) {
    combatDiceQueue.push(payload);
    flushCombatDiceQueue();
}

/**
 * @param {{ title: string, subtitle: string, formula: string, detail: string, total: number, dc?: number|null, natural?: number|null, glyph?: string }} param0
 */
function showCombatDiceRoll({ title, subtitle, formula, detail, total, dc = null, natural = null, glyph = 'd20' }) {
    // Idea 168: cada d20, apuntado, para poder contestar a «este dado me odia».
    if (glyph === 'd20' && chat_metadata && Number(natural) >= 1) {
        chat_metadata[DICE_LOG_KEY] = addRoll(chat_metadata[DICE_LOG_KEY], { title: String(title), natural: Number(natural), total: Number(total) || 0, dc });
    }
    const classification = getRollClassification(natural, total, dc);

    // The log gets the breakdown, not the prose: seeing "1d20+5 · 17 · vs 15" is what
    // lets a player audit a resolver nobody is supervising.
    pushCombatLogEntry(rollEntry(
        String(title || ''),
        { formula: String(formula || ''), rolls: [], total: Number(total) || 0, natural },
        dc == null ? null : Number(dc),
        String(subtitle || ''),
    ));

    queueCombatDiceRoll({
        title,
        subtitle,
        dc: dc == null ? '--' : String(dc),
        total: String(total),
        formula,
        classification,
        detail,
        glyph,
    });
    return classification;
}

/**
 * @returns {import('./dnd-system.js').TurnEntry|null}
 */
function getCurrentTurnEntry() {
    if (!combatEncounter.active || combatEncounter.turnOrder.length === 0) return null;
    return combatEncounter.turnOrder[combatEncounter.currentTurnIndex] || null;
}

/**
 * @returns {PartyMember[]}
 */
function getLivingPartyMembers() {
    // B2: quien ha salido por una salida ya no está en la pelea: nadie le ataca.
    const left = combatEncounter.active ? readLeft(combatEncounter.left) : [];
    return partyMembers.filter(member => (member.hp || 0) > 0 && !left.includes(String(member.id)));
}

/**
 * La casilla de alguien del grupo en el tablero.
 *
 * @param {any} member
 * @returns {{x: number, y: number}}
 */
function partyCell(member) {
    return { x: Number(member?.mapPosition?.gridX) || 0, y: Number(member?.mapPosition?.gridY) || 0 };
}

/**
 * B1: cómo está quien ataca respecto a quien recibe, en el tablero de ahora.
 *
 * @param {{x: number, y: number}} from
 * @param {{x: number, y: number}} to
 * @returns {'above'|'below'|'level'}
 */
function heightFor(from, to) {
    return heightBetween(getActiveBoardContext().terrain, from, to);
}

/**
 * @param {import('./dnd-system.js').TurnEntry|null} entry
 */
function announceTurnInChat(entry) {
    if (!entry) return;
    const actorType = entry.isEnemy ? 'Enemigo' : 'Jugador';
    const actorIcon = entry.isEnemy ? '⚔️' : '🛡️';
    postCombatNarration(`${actorIcon} [COMBAT] Turno de ${entry.name} (${actorType})`);

    if (!entry.isEnemy) {
        const member = getPartyMemberByTurnEntry(entry);
        if (!member) return;
        const rangeFeet = getAttackRangeFeet(member);
        const remainingFeet = getRemainingMovementFeet(member);
        const targets = getAttackableEnemiesForMember(member);
        const targetSummary = targets.length
            ? targets.map(enemy => enemy.name).join(', ')
            : 'ningun enemigo en rango';
        postCombatNarration(`💬 [COMBAT] ${member.name}, elige accion. Usa /combat-attack <objetivo>, /combat-move <x> <y> y /combat-end. Movimiento restante: ${remainingFeet} ft. Rango actual: ${rangeFeet} ft. Objetivos en rango: ${targetSummary}.`);
        $('#send_textarea').attr('placeholder', `/combat-attack ${targets[0]?.name || '<objetivo>'} | /combat-move 12 8 | /combat-end`);
    }
}

/**
 * Resolve enemy action: attack roll, damage and possible status effects.
 * @param {import('./dnd-system.js').TurnEntry} turnEntry
 * @returns {string}
 */
/**
 * Resuelve un golpe de un enemigo contra alguien del grupo.
 *
 * Extraido del turno enemigo porque un **ataque de oportunidad** es exactamente esto y no
 * otra cosa: el mismo d20, la misma cobertura, el mismo critico y las mismas salvaciones
 * de muerte. Dos copias de esta aritmetica serian dos sitios donde discrepar.
 *
 * @param {any} enemy
 * @param {any} target
 * @returns {string} Lo ocurrido, ya escrito.
 */
function resolveEnemyAttackOn(enemy, target) {
    /** @type {string[]} */
    const lines = [];

    // Esquivar, estar en el suelo: lo que cambia el dado antes de tirarlo.
    const enemyFeet = getDistanceInFeet(
        Number(enemy.gridX) || 0, Number(enemy.gridY) || 0,
        Number(target.mapPosition?.gridX) || 0, Number(target.mapPosition?.gridY) || 0);
    const edge = attackEdge({
        targetId: String(target.id),
        targetConditions: target.activeConditions ?? [],
        attackerConditions: enemy.activeConditions ?? [],
        // Ideas 73 y 90: la niebla y la noche estorban a los dos bandos.
        hindered: visibilityPenalties(boardVisibility(), enemyFeet),
        distanceFeet: enemyFeet,
        // B1: desde arriba, mejor.
        height: heightFor({ x: Number(enemy.gridX) || 0, y: Number(enemy.gridY) || 0 }, partyCell(target)),
        maneuvers: combatEncounter.maneuvers,
        // El flanqueo vale para los dos bandos.
        flanked: flankedFrom(
            { x: Number(enemy.gridX) || 0, y: Number(enemy.gridY) || 0 },
            { x: Number(target.mapPosition?.gridX) || 0, y: Number(target.mapPosition?.gridY) || 0 },
            getAliveEnemies().filter(e => e !== enemy).map(e => ({ x: Number(e.gridX) || 0, y: Number(e.gridY) || 0 })),
        ),
    });
    const edged = rollWithEdge(() => rollDiceDetailed('1d20', 20).total, edge.mode);
    const attackRoll = { total: edged.natural, natural: edged.natural };
    const d20 = attackRoll.total;
    const attackMod = Math.max(
        getAbilityModifier(enemy.strength || 10),
        getAbilityModifier(enemy.dexterity || 10),
    // R7: con su líder cerca, pega mejor. R6: y un jefe enfurecido, más.
    ) + (Number(/** @type {any} */ (enemy).rage) || 0) + leaderBonus(
        { id: String(enemy.instanceId), x: Number(enemy.gridX) || 0, y: Number(enemy.gridY) || 0 },
        getAliveEnemies().map(e => ({ id: String(e.instanceId), x: Number(e.gridX) || 0, y: Number(e.gridY) || 0, hp: Number(e.currentHp) || 0, role: String(/** @type {any} */ (e).role ?? '') })),
    );
    const attackTotal = d20 + attackMod;
    const { ac: targetAc, cover: targetCover } = getTargetArmorClass(target, enemy);
    const isCrit = d20 === 20;
    const isHit = isCrit || attackTotal >= targetAc;

    showCombatDiceRoll({
        title: `${enemy.name} ataca`,
        subtitle: `Objetivo: ${target.name}`,
        formula: `1d20${attackMod >= 0 ? '+' : ''}${attackMod}`,
        detail: `d20(${d20}) ${attackMod >= 0 ? '+' : ''}${attackMod} = ${attackTotal}`,
        total: attackTotal,
        dc: targetAc,
        natural: attackRoll.natural,
        glyph: 'd20',
    });

    lines.push(`👹 ${enemy.name} ataca a ${target.name}.`);
    lines.push(attackLine({ who: enemy.name, at: target.name, total: attackTotal, ac: targetAc, hit: isHit, natural: d20, modifier: attackMod, cover: targetCover, edge: describeEdge(edged, edge.mode, edge.reasons) }));

    if (!isHit) {
        lines.push('❌ Resultado: fallo.');
        return lines.join('\n');
    }

    const dmgFormula = getEnemyDamageFormula(enemy.cr || 0);
    const baseDamageRoll = rollDiceDetailed(dmgFormula, 8);
    const baseDamage = baseDamageRoll.total;
    const strMod = Math.max(0, getAbilityModifier(enemy.strength || 10));
    const critBonusRoll = isCrit ? rollDiceDetailed(dmgFormula, 8) : null;
    const critBonus = critBonusRoll ? critBonusRoll.total : 0;
    const totalDamage = Math.max(1, baseDamage + critBonus + strMod);

    showCombatDiceRoll({
        title: `${enemy.name} tira dano`,
        subtitle: `Contra ${target.name}`,
        formula: `${dmgFormula}${isCrit ? ` + ${dmgFormula}` : ''}`,
        detail: isCrit
            ? `${baseDamageRoll.rolls.join(', ')} + crit(${critBonusRoll?.rolls.join(', ') || ''}) + mod(${strMod})`
            : `${baseDamageRoll.rolls.join(', ')} + mod(${strMod})`,
        total: totalDamage,
        glyph: 'dmg',
    });

    lines.push(`✅ Resultado: impacto${isCrit ? ' critico' : ''}.`);
    lines.push(damageLine({ total: totalDamage, formula: dmgFormula, rolled: baseDamage, modifier: strMod, crit: isCrit ? critBonus : 0 }));
    lines.push(...damagePartyMember(target, totalDamage, isCrit));
    floatOnToken(target.id, `-${totalDamage}`, isCrit ? 'crit' : 'damage');
    enemyBark(enemy, 'hit');

    if (target.hp > 0 && isCrit && Math.random() < 0.35) {
        const pool = ['Bleeding', 'Poisoned', 'Prone', 'Frightened'];
        const candidates = pool.filter(status => !target.activeConditions.includes(status));
        if (candidates.length) {
            const status = candidates[Math.floor(Math.random() * candidates.length)];
            target.activeConditions.push(status);
            lines.push(`🧪 Efecto adicional: ${target.name} queda ${status}.`);
        }
    }

    savePartyState();
    saveCombatState();
    return lines.join('\n');
}

/**
 * Un golpe que le llega a alguien del grupo: el ataque de un enemigo o su habilidad.
 *
 * Una sola puerta, para que un conjuro que tumba a alguien cuente igual que una espada:
 * el companero de rango 8 que se interpone, la cuenta de salvaciones al caer, y el fallo
 * automatico si ya estaba en el suelo.
 *
 * @param {any} target
 * @param {number} totalDamage
 * @param {boolean} [isCrit]
 * @returns {string[]}
 */
function damagePartyMember(target, totalDamage, isCrit = false) {
    /** @type {string[]} */
    const lines = [];

    // Rank 8: a companion steps in rather than watch them drop. Once a day, and only
    // when the blow would really have finished them.
    const rescue = planEndure({
        bonds: getCampaignBonds(),
        party: partyMembers,
        targetId: String(target.id),
        currentHp: Number(target.hp) || 0,
        damage: totalDamage,
    });

    // Antes de escribir el dano: hace falta saber si ya estaba en el suelo, porque un
    // golpe sobre un cuerpo caido cuenta distinto que el golpe que lo tira.
    const wasDown = (Number(target.hp) || 0) <= 0;
    const before = Number(target.hp) || 0;

    if (rescue) {
        saveCampaignState(null, spendPerk(getCampaignBonds(), rescue.saviourId, rescue.perkId));
        target.hp = 1;
        lines.push(`🛡️ ${rescue.saviourName} se interpone: ${target.name} aguanta con 1 HP.`);
        rememberTogether(`${rescue.saviourName} se interpuso para salvar a ${target.name} en ${currentBoardName || currentLocationName}.`,
            [rescue.saviourName, String(target.name)]);
        recordFeat(partyMembers.find(m => String(m.id) === String(rescue.saviourId)), 'rescue');
    } else {
        target.hp = Math.max(0, (target.hp || 0) - totalDamage);
    }

    target.activeConditions = Array.isArray(target.activeConditions) ? target.activeConditions : [];
    lines.push(`❤️ Estado de ${target.name}: ${target.hp}/${target.maxHp}`);
    if (combatEncounter.active) {
        combatEncounter.tally = noteTaken(combatEncounter.tally, target.id, before - (Number(target.hp) || 0), !wasDown && target.hp === 0);
    }

    if (target.hp === 0) {
        if (!target.activeConditions.includes('Unconscious')) {
            target.activeConditions.push('Unconscious');
        }

        // Golpear a alguien que ya estaba en el suelo es un fallo automatico de salvacion
        // — dos si es critico —; caer por primera vez solo empieza la cuenta.
        if (wasDown) {
            const hit = takeHitWhileDown(target, isCrit);
            target.deathSaves = hit.saves;
            lines.push(hit.line);
        } else {
            target.deathSaves = clearDeathSaves();
            recordFeat(target, 'downed');
            lines.push(`🩸 ${target.name} cae a 0 PG y empieza a jugarsela: `
                + 'tres exitos para estabilizarse, tres fallos y se acabo.');
            // C7: alguien de pie lo grita.
            const witness = partyMembers.find(m => String(m.id) !== String(target.id)
                && String(m.id) !== String(partyMembers[0]?.id) && (Number(m.hp) || 0) > 0);
            if (witness) bark(witness, 'ally_down', String(target.name));
        }
    } else if ((Number(target.hp) || 0) / Math.max(1, Number(target.maxHp) || 1) < 0.3) {
        bark(target, 'hurt');
    }

    return lines;
}

/**
 * Un enemigo usa una habilidad del catalogo.
 *
 * La decision es de `enemy-abilities.js`; la tirada, de `planAbilityUse`, la misma que usa
 * el grupo. Aqui solo se escribe en las fichas.
 *
 * @param {any} enemy
 * @param {import('./game-engine/combat/enemy-abilities.js').AbilityChoice} choice
 * @returns {string}
 */
function resolveEnemyAbility(enemy, choice) {
    const { ability } = choice;
    const target = choice.side === 'enemy'
        ? partyMembers.find(m => String(m.id) === choice.targetId)
        : (choice.side === 'self' ? enemy : getEnemyByInstanceId(choice.targetId));
    if (!target) return '';

    enemy.abilityUses = spendAbilityUse(enemy, ability);
    // R4: un cultista también gasta las cargas de su círculo.
    if (typeof ability.circle === 'number' && ability.circle > 0) enemy.spellCharges = spendCharge(enemy, ability.circle);
    // R3: el mismo camino que el grupo: con área, alcanza también a los suyos si están ahí.
    const lines = resolveAbilityOnBoard({ actor: enemy, side: 'enemy', ability, subject: target });

    savePartyState();
    saveCombatState();
    renderPartyMembers();
    return lines.join('\n');
}

/**
 * Lo que haria este enemigo si le tocase ahora: a por quien va y adonde se mueve.
 *
 * Lo usa su turno de verdad y lo usan las intenciones que se ven en la barra: al ser la
 * misma cuenta, lo que se anuncia es lo que pasa (salvo que el grupo se mueva antes, que
 * es justo para lo que sirve verlo).
 *
 * @param {any} enemy
 * @returns {import('./game-engine/combat/enemy-ai.js').TurnPlan}
 */
function planFor(enemy) {
    const enemyX = Number.isFinite(Number(enemy.gridX)) ? Number(enemy.gridX) : 0;
    const enemyY = Number.isFinite(Number(enemy.gridY)) ? Number(enemy.gridY) : 0;
    const livingParty = getLivingPartyMembers();
    const { terrain, gridWidth, gridHeight } = getActiveBoardContext();
    const known = knownAbilities(enemy, getAbilityCatalogue());

    /** @param {any} member */
    const memberCell = (member) => ({
        x: Number.isFinite(Number(member.mapPosition?.gridX)) ? Number(member.mapPosition.gridX) : 0,
        y: Number.isFinite(Number(member.mapPosition?.gridY)) ? Number(member.mapPosition.gridY) : 0,
    });

    return planEnemyTurn({
        actor: {
            id: String(enemy.instanceId),
            gridX: enemyX,
            gridY: enemyY,
            currentHp: Number(enemy.currentHp) || 0,
            maxHp: Number(enemy.maxHp) || 0,
            // Agarrado o apresado no anda: pega a quien tenga al lado, si tiene a alguien.
            speedFeet: heldInPlace(enemy) ? 0 : Number(enemy.speed) || 30,
            // Un cultista con un rayo de 120 ft se queda a su distancia, no se acerca a dar
            // punetazos. Sin habilidades, su alcance de siempre.
            attackRangeFeet: Math.max(Number(enemy.attackRangeFeet ?? enemy.range) || 5, longestReach(enemy, known)),
            profile: enemy.profile,
            // R7: su papel y la táctica de su bando.
            role: String(/** @type {any} */ (enemy).role ?? ''),
            tactic: tacticOf(enemy)?.id ?? '',
        },
        targets: livingParty.map(member => {
            const cell = memberCell(member);
            return {
                id: String(member.id),
                gridX: cell.x,
                gridY: cell.y,
                currentHp: Number(member.hp) || 0,
                maxHp: Number(member.maxHp) || 0,
            };
        }),
        allies: getAliveEnemies()
            .filter(other => other.instanceId !== enemy.instanceId)
            .map(other => ({
                id: String(other.instanceId),
                gridX: Number(other.gridX) || 0,
                gridY: Number(other.gridY) || 0,
                currentHp: Number(other.currentHp) || 0,
                maxHp: Number(other.maxHp) || 0,
            })),
        terrain,
        gridWidth,
        gridHeight,
    });
}

/**
 * Lo que va a hacer cada enemigo, en una linea por enemigo.
 *
 * @returns {string[]}
 */
function buildEnemyIntents() {
    if (!combatEncounter.active) return [];
    const names = Object.fromEntries(partyMembers.map(m => [String(m.id), String(m.name)]));
    return describeIntents(
        getAliveEnemies().map(enemy => ({ name: String(enemy.name), plan: planFor(enemy) })),
        names,
    ).map(intent => intent.text);
}

function resolveEnemyTurnAction(turnEntry) {
    const enemy = combatEncounter.enemies.find(e => e.instanceId === turnEntry.id && e.currentHp > 0);
    if (!enemy) {
        return '[COMBAT] El enemigo no puede actuar (derrotado o no encontrado).';
    }
    // R3: dormido, aturdido o paralizado, pierde el turno. Antes era una etiqueta.
    const out = cannotAct(enemy.activeConditions);
    if (out) return `💤 [COMBAT] ${enemy.name} no puede actuar (${CONDITION_WORDS[out] ?? out}): pierde el turno.`;

    const livingParty = getLivingPartyMembers();
    if (!livingParty.length) {
        return `[COMBAT] ${enemy.name} ruge sobre un campo sin oponentes conscientes.`;
    }

    // T2: una tregua pedida espera respuesta hasta la ronda siguiente; sin respuesta, se sigue.
    if (/** @type {any} */ (combatEncounter).truce === 'pending') {
        if ((Number(combatEncounter.round) || 1) > (Number(/** @type {any} */ (combatEncounter).truceRound) || 0)) {
            /** @type {any} */ (combatEncounter).truce = 'refused';
            saveCombatState();
            postCombatNarration('⚔️ [COMBAT] No contestáis: vuelven a por vosotros.');
        } else {
            return `🏳️ [COMBAT] ${enemy.name} espera vuestra respuesta, con el arma baja.`;
        }
    }
    // T2: con su líder caído y la mitad fuera, los que quedan piden tregua (una vez).
    if (truceOffered({
        enemies: combatEncounter.enemies.map(e => ({ name: String(e.name), hp: Number(e.currentHp) || 0, maxHp: Number(e.maxHp) || 0, boss: Boolean(/** @type {any} */ (e).boss), role: String(/** @type {any} */ (e).role ?? '') })),
        offered: Boolean(/** @type {any} */ (combatEncounter).truce),
    })) {
        offerTruce();
        return `🏳️ [COMBAT] ${enemy.name} espera vuestra respuesta, con el arma baja.`;
    }

    // Idea 6: con su bando cayendo y malherido, quien no es jefe puede rendirse.
    if (breaksMorale({
        enemy, started: combatEncounter.enemies.length, standing: getAliveEnemies().length, random: Math.random,
    })) {
        enemyBark(enemy, 'surrender');
        enemy.currentHp = 0;
        enemy.surrendered = true;
        saveCombatState();
        const said = `🏳️ [COMBAT] ${enemy.name} tira el arma y se rinde.`;
        if (getAliveEnemies().length === 0) {
            postCombatNarration(said);
            postCombatNarration('🏆 [COMBAT] No queda nadie dispuesto a pelear.');
            endCombat('victory');
            return '';
        }
        return said;
    }

    // R7: con su líder caído y malherido, huye. Sale de esta pelea… y puede volver en otra.
    const leaderDown = combatEncounter.enemies.some(e => e !== enemy && /** @type {any} */ (e).role === 'lider' && (Number(e.currentHp) || 0) <= 0);
    if (breaksAndRuns({ hp: Number(enemy.currentHp) || 0, maxHp: Number(enemy.maxHp) || 0, boss: Boolean(/** @type {any} */ (enemy).boss), role: String(/** @type {any} */ (enemy).role ?? '') }, leaderDown)) {
        enemy.currentHp = 0;
        /** @type {any} */ (enemy).fled = true;
        const escape = noteEscape({ raw: chat_metadata?.[NEMESES_KEY], name: String(enemy.name), grudge: String(partyMembers[0]?.name ?? ''), day: campaignDay() });
        if (chat_metadata) {
            chat_metadata[NEMESES_KEY] = escape.list;
            saveMetadata();
        }
        saveCombatState();
        // B2: si el tablero tiene salida, se va por ella.
        const exits = exitCells(getActiveBoardContext().terrain);
        const way = exits.length > 0 ? ' por la salida' : '';
        // T2: y puede volver con ayuda, dos rondas después, por donde se fue (una vez por pelea).
        let help = '';
        const board = getActiveBoardContext().board;
        if (board && getAliveEnemies().length > 0 && callsForHelp({ random: Math.random, hasExit: exits.length > 0, called: Boolean(/** @type {any} */ (combatEncounter).helpCalled) })) {
            const template = getCurrentWorldEnemies().find((/** @type {any} */ t) => String(t.id) === String(enemy.templateId));
            board.waves = [...(Array.isArray(board.waves) ? board.waves : []), helpWave({
                name: String(template?.name ?? enemy.name), round: Number(combatEncounter.round) || 1,
                at: exits[0] ?? { x: Number(enemy.gridX) || 0, y: Number(enemy.gridY) || 0 },
            })];
            /** @type {any} */ (combatEncounter).helpCalled = true;
            persistBoardTerrain(board);
            help = ' Grita que vuelve con ayuda.';
        }
        const fled = `🏃 [COMBAT] ${enemy.name} ve caer a quien mandaba y sale corriendo${way}.${help}${escape.line ? ` ${escape.line}` : ''}`;
        if (getAliveEnemies().length === 0) {
            postCombatNarration(fled);
            postCombatNarration('🏆 [COMBAT] No queda nadie dispuesto a pelear.');
            endCombat('victory');
            return '';
        }
        return fled;
    }

    const known = knownAbilities(enemy, getAbilityCatalogue());

    /** @param {any} member */
    const memberCell = (member) => ({
        x: Number.isFinite(Number(member.mapPosition?.gridX)) ? Number(member.mapPosition.gridX) : 0,
        y: Number.isFinite(Number(member.mapPosition?.gridY)) ? Number(member.mapPosition.gridY) : 0,
    });

    const plan = planFor(enemy);

    const lines = [];
    const movedThisTurn = plan.movementCostFeet > 0;

    if (movedThisTurn) {
        const leftFrom = { x: Number(enemy.gridX) || 0, y: Number(enemy.gridY) || 0 };
        enemy.gridX = plan.destination.x;
        enemy.gridY = plan.destination.y;
        lines.push(`🚶 ${enemy.name} avanza a (${plan.destination.x + 1}, ${plan.destination.y + 1}). ${plan.rationale} (${plan.movementCostFeet} ft)`);
        // Idea 4: quien le esperaba con el golpe preparado, se lo da antes de que haga nada.
        const ambusher = readiedAgainst({
            readied: combatEncounter.readied,
            members: livingParty.map(member => ({
                id: String(member.id), x: memberCell(member).x, y: memberCell(member).y, reachFeet: getAttackRangeFeet(member),
            })),
            from: leftFrom,
            to: { x: Number(enemy.gridX) || 0, y: Number(enemy.gridY) || 0 },
            distanceFeet: (a, b) => getDistanceInFeet(a.x, a.y, b.x, b.y),
        });
        if (ambusher) {
            combatEncounter.readied = dropReadied(combatEncounter.readied, ambusher);
            const waiting = partyMembers.find(member => String(member.id) === ambusher);
            lines.push(`⚡ ${waiting?.name ?? 'Alguien'} estaba esperando a ${enemy.name}: golpe preparado.`);
            postCombatNarration(`[COMBAT] ${lines.join('\n')}`);
            lines.length = 0;
            resolveFollowUpAttack(ambusher, enemy, 'descarga el golpe preparado sobre');
            saveCombatState();
            if ((Number(enemy.currentHp) || 0) <= 0) {
                if (!checkScenarioOutcome() && getAliveEnemies().length === 0 && !judgeCurrentScenario()) {
                    postCombatNarration('🏆 [COMBAT] Todos los enemigos han sido derrotados.');
                    endCombat('victory');
                }
                return '';
            }
        }
    }

    // Antes que el golpe: si trae algo mejor que pegar y le llega, lo usa.
    const choice = chooseEnemyAbility({
        actor: { id: String(enemy.instanceId), abilityUses: enemy.abilityUses, currentHp: enemy.currentHp, maxHp: enemy.maxHp },
        from: { x: Number(enemy.gridX) || 0, y: Number(enemy.gridY) || 0 },
        abilities: known,
        targets: livingParty.map(member => ({
            id: String(member.id), gridX: memberCell(member).x, gridY: memberCell(member).y,
            currentHp: Number(member.hp) || 0, maxHp: Number(member.maxHp) || 0,
        })),
        allies: getAliveEnemies()
            .filter(other => other.instanceId !== enemy.instanceId)
            .map(other => ({
                id: String(other.instanceId), gridX: Number(other.gridX) || 0, gridY: Number(other.gridY) || 0,
                currentHp: Number(other.currentHp) || 0, maxHp: Number(other.maxHp) || 0,
            })),
        focusId: plan.focusId,
        basicAverage: averageOf(getEnemyDamageFormula(enemy.cr || 0)) + Math.max(0, getAbilityModifier(enemy.strength || 10)),
        basicRangeFeet: Number(enemy.attackRangeFeet ?? enemy.range) || 5,
    });
    if (choice) {
        lines.push(`✨ ${enemy.name}: ${choice.reason}`);
        lines.push(resolveEnemyAbility(enemy, choice));
        saveCombatState();
        return lines.join('\n');
    }

    // El plan se hizo con el alcance de sus habilidades; si no ha usado ninguna, su golpe
    // tiene que llegar de verdad.
    const basicReach = Number(enemy.attackRangeFeet ?? enemy.range) || 5;
    const struck = plan.targetId ? livingParty.find(member => String(member.id) === plan.targetId) : null;
    const struckCell = struck ? memberCell(struck) : null;
    const outOfReach = struckCell
        && getDistanceInFeet(Number(enemy.gridX) || 0, Number(enemy.gridY) || 0, struckCell.x, struckCell.y) > basicReach;

    if (plan.action !== 'attack' || !plan.targetId || outOfReach) {
        lines.push(`⛔ ${enemy.name}: ${outOfReach ? 'No le llega el golpe.' : plan.rationale}`);
        if (movedThisTurn) saveCombatState();
        return lines.join('\n');
    }

    const target = livingParty.find(member => String(member.id) === plan.targetId);
    if (!target) {
        return `[COMBAT] ${enemy.name} no encuentra un objetivo valido.`;
    }

    lines.push(resolveEnemyAttackOn(enemy, target));
    if (movedThisTurn) saveCombatState();
    return lines.join('\n');
}

/**
 * @param {import('./dnd-system.js').TurnEntry|null} entry
 * @returns {boolean}
 */
function canTurnEntryAct(entry) {
    if (!entry) return false;
    if (entry.isEnemy) {
        const enemy = getEnemyByInstanceId(entry.id);
        return Boolean(enemy && enemy.currentHp > 0);
    }
    const member = getPartyMemberByTurnEntry(entry);
    // B2: quien salió ya no tiene turno.
    return Boolean(member && member.hp > 0 && !hasLeft(combatEncounter.left, member.id));
}

/**
 * Cobra los ataques de oportunidad que provoque un movimiento.
 *
 * Sin esto, alejarse de un enemigo es gratis — y si alejarse es gratis, la posicion no
 * significa nada y media mecanica del tablero sobra. El golpe lo resuelve el mismo codigo
 * que cualquier otro ataque enemigo: un ataque de oportunidad no es un ataque distinto.
 *
 * @param {any} member Quien se mueve.
 * @param {{x: number, y: number}} from
 * @param {{x: number, y: number}} to
 */
function chargeOpportunityAttacks(member, from, to) {
    if (!combatEncounter.active) return;
    // Quien se ha destrabado se va sin pagar: para eso gasto la accion.
    if (readManeuvers(combatEncounter.maneuvers).disengaged.includes(String(member.id))) return;

    const attacks = findOpportunityAttacks({
        mover: member,
        from,
        to,
        threats: getAliveEnemies(),
        reachOf: (/** @type {any} */ enemy) => Number(enemy?.attackRangeFeet) || 5,
        isAlive: (/** @type {any} */ enemy) => (Number(enemy?.currentHp) || 0) > 0,
        // Cada enemigo tiene una reaccion por ronda, y aqui se apunta cual la ha gastado.
        canReact: (/** @type {any} */ enemy) => !usedReactions.has(String(enemy.instanceId)),
    });

    if (attacks.length === 0) return;

    postCombatNarration(`⚠️ [COMBAT] ${describeOpportunity(attacks, member)}`);
    for (const attack of attacks) {
        usedReactions.add(String(attack.threat.instanceId));
        const line = resolveEnemyAttackOn(attack.threat, member);
        if (line) postCombatNarration(line);
        // Si el golpe lo tira, el resto de oportunidades siguen: en 5e tambien.
    }
    savePartyState();
    saveCombatState();
}

/**
 * El turno de quien esta en el suelo: una salvacion de muerte.
 *
 * No actua — no puede — pero su turno no es un hueco en blanco: es el momento mas tenso
 * de una mesa de D&D, y hasta ahora no existia. Se tira sola al llegarle el turno, porque
 * no hay nada que decidir.
 *
 * @param {any} member
 * @returns {boolean} Si ha pasado algo que merezca redibujar.
 */
function resolveDeathSave(member) {
    if (!isDying(member)) return false;

    const result = rollDeathSave({
        member,
        roll: () => rollDiceDetailed('1d20', 20),
    });

    member.deathSaves = result.saves;
    if (result.hp != null) member.hp = result.hp;

    if (result.outcome === 'up') {
        member.activeConditions = (Array.isArray(member.activeConditions) ? member.activeConditions : [])
            .filter((/** @type {string} */ c) => c !== 'Unconscious');
    }

    // El tercer fallo dejaba a alguien tirado para siempre y ahi se acababa: ni moria ni
    // se levantaba. Ahora pasa lo que diga la campana — muere quien vino por la paga, y
    // quien vino por ti se levanta roto.
    if (result.outcome === 'dead') applyFall(member);

    showCombatDiceRoll({
        title: `${member.name}: salvacion de muerte`,
        subtitle: result.outcome === 'dead' ? 'Tercer fallo' : '',
        formula: '1d20',
        detail: result.line,
        total: result.natural,
        dc: 10,
        natural: result.natural,
        glyph: 'd20',
    });

    postCombatNarration(`☠️ [COMBAT] ${result.line}`);
    savePartyState();
    saveCombatState();
    return true;
}

/**
 * Tu ficha, la de mirar.
 *
 * @param {any} member
 * @returns {Promise<void>}
 */
async function openOwnSheet(member) {
    const rules = getActiveRuleset();
    const { openCharacterPanel } = await import('./game-engine/ui/character-panel.js');

    // Lo que se toca en la ficha (dar algo, ponerse un juego) la cierra; se vuelve a abrir
    // al día, hasta que se cierra sin tocar nada.
    for (let open = 0; open < 20; open++) {
        const result = await openCharacterPanel({
            member,
            slotInfo: rules?.slotInfo ?? {},
            abilities: getAbilityCatalogue(),
            xpTable: rules?.progression?.xpThresholds ?? null,
            bondRank: Number(getCampaignBonds()?.[String(member.id)]?.rank) || 0,
            onEdit: () => { void openPartyMemberModal(member); },
            // Idea 59: lo que habla.
            languages: languagesOf(member),
            // Idea 62: sus juegos de equipo.
            sets: readSets(member),
            onSaveSet: (name) => wearSet(member, name, 'save'),
            onApplySet: (name) => wearSet(member, name, 'apply'),
            // Idea 163: a quién darle algo.
            mates: partyMembers.filter(m => m !== member && !m.dead)
                .map(m => ({ id: String(m.id), name: String(m.name), avatar: String(m.avatar || '') })),
            onGive: (itemId, toId) => handItem(member, itemId, toId),
            Popup,
            POPUP_TYPE,
        });
        if (result !== 'changed') break;
    }
}

/**
 * Idea 62: guardar lo que se lleva puesto con un nombre, o ponerse un juego guardado. Lo
 * maldito que no se suelta se queda donde está.
 *
 * @param {any} member
 * @param {string} name
 * @param {'save'|'apply'} what
 * @returns {boolean}
 */
function wearSet(member, name, what) {
    if (what === 'save') {
        const saved = saveSet(member, name);
        if (!saved.ok) {
            toastr.warning(saved.line);
            return false;
        }
        member.equipmentSets = saved.sets;
        savePartyState();
        toastr.success(saved.line, 'Juego de equipo');
        return true;
    }
    if (combatEncounter.active) {
        toastr.warning('En combate no hay tiempo de cambiarse de todo.');
        return false;
    }
    const worn = applySet(member, name, (slot) => {
        const id = member.equippedItems?.[slot];
        return Boolean((member.items ?? []).find((/** @type {any} */ i) => i.id === id)?.cursed);
    });
    if (!worn.ok) {
        toastr.warning(worn.line);
        return false;
    }
    member.equippedItems = worn.equippedItems;
    // Lo maldito que uno se pone se descubre al ponérselo, como con una pieza suelta.
    for (const id of Object.values(worn.equippedItems)) {
        const item = (member.items ?? []).find((/** @type {any} */ i) => i.id === id);
        if (item?.cursed && item.identified === false) {
            item.identified = true;
            toastr.error(`${item.name} se os pega a la mano: ${item.curse?.label ?? 'está maldito'}.`, 'Maldito', { timeOut: 12000 });
        }
    }
    syncCurse(member);
    savePartyState();
    renderPartyMembers();
    toastr.success(worn.line, 'Juego de equipo');
    return true;
}

/**
 * Idea 163: darle algo a otro del grupo.
 *
 * @param {any} member
 * @param {string} itemId
 * @param {string} toId
 * @returns {boolean}
 */
function handItem(member, itemId, toId) {
    const to = partyMembers.find(m => String(m.id) === String(toId));
    const given = giveItem({ from: member, to, itemId });
    if (!given.ok || !given.from || !given.to || !to) {
        toastr.warning(given.reason || 'No se puede.');
        return false;
    }
    member.items = given.from.items;
    member.equippedItems = given.from.equippedItems;
    to.items = given.to.items;
    syncCurse(member);
    savePartyState();
    renderPartyMembers();
    postCombatNarration(`🎒 [GRUPO] ${given.line}`);
    toastr.success(given.line, 'Repartir');
    return true;
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
function currentSurvival() {
    return readSurvival(getActiveRuleset()?.survival ?? null);
}

/**
 * R1 del roadmap de profundidad: los interruptores tal como están en el paquete, para
 * preguntar por letras (`hasLetter`) y filtrar lo que no existe en este modo.
 *
 * @returns {any}
 */
function survivalNow() {
    return getActiveRuleset()?.survival ?? null;
}

/** R1: el historial de modos de esta partida (DR2), para el salón de la fama. */
const MODE_HISTORY_KEY = 'modeHistory';

/**
 * Ideas 36 y 199: lo que queda de quien muere. Epitafio, tumba donde cayó, lo mejor que
 * llevaba para quien más le quería, y un sitio en el salón de la fama.
 *
 * @param {any} member
 * @param {number} today
 * @param {any} bonds
 */
function buryMember(member, today, bonds) {
    const place = currentLocationName || '';
    const epitaph = epitaphFor(member, { day: today, place, className: String(member.charClass ?? member.className ?? '') });
    if (chat_metadata) {
        chat_metadata[GRAVES_KEY] = addGrave(chat_metadata[GRAVES_KEY], { name: String(member.name), place, day: today, epitaph });
        saveMetadata();
    }
    // Lo que se hereda: el arma que llevaba, o lo que más valía.
    const heir = heirOf({
        dead: member,
        party: partyMembers,
        bondRanks: Object.fromEntries(partyMembers.map(m => [String(m.id), getBondProgress(bonds, String(m.id)).rank])),
    });
    const heirloom = heirloomOf(member);
    let inherited = '';
    if (heir && heirloom) {
        removeItemFromInventory(/** @type {any} */ (member), String(heirloom.id));
        heir.items = heir.items ?? [];
        addItemToInventory(/** @type {any} */ (heir), createItem(/** @type {any} */ ({
            ...heirloom,
            id: undefined,
            heirloom: String(member.name),
            description: [String(heirloom.description ?? ''), `Era de ${member.name}.`].filter(Boolean).join(' '),
        })));
        inherited = `${heir.name} se queda con ${heirloom.name}.`;
    }
    // Idea 199: el salón de la fama no es de ninguna partida.
    const settings = /** @type {any} */ (extension_settings);
    settings.partyHall = addToHall(settings.partyHall, {
        name: String(member.name), world: String(chat_metadata?.[METADATA_KEY] ?? ''), day: today, epitaph,
        when: new Date().toISOString(),
        // R1 (DR2): de hierro solo si lo fue siempre.
        mode: modeLabel(modeOf(survivalNow())),
        iron: isIronRun(survivalNow(), chat_metadata?.[MODE_HISTORY_KEY] ?? null),
    });
    saveSettingsDebounced();
    postCombatNarration(`🪦 [CAMPAÑA] ${epitaph}${inherited ? ` ${inherited}` : ''}`);
    void postForModel(`[MUERTE] ${epitaph}${inherited ? ` ${inherited}` : ''} Ya no está: que se note en lo que cuentes, y que nadie le haga hablar.`)
        .catch(error => console.error('[party] death note failed', error));
}

function applyFall(member, cause = '') {
    const fall = resolveFall(member, {
        roll: () => nextRandom(),
        rules: getActiveRuleset()?.survival ?? null,
        // Caer con el golpe todavia encima deja peor recuerdo que desangrarse despacio.
        severity: (Number(member.hp) || 0) < 0 ? 1 : 0,
        // De que viene el golpe elige la rama: una caida rompe huesos, el fuego quema
        // manos y el frio se lleva dedos. Sin bateria de estados, la tabla de siempre.
        table: injuryTableFor(lastCompendium, cause),
    });

    if (fall.outcome === 'dies') {
        member.dead = true;
        countStat('deaths');
        postCombatNarration(`⚰️ [COMBAT] ${fall.reason}`);
        toastr.error(fall.reason, 'Se acabo', { timeOut: 15000 });
        // Idea 43: quien le quería, o quien busca calma, guarda duelo un dia.
        const today = Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1));
        const bonds = getCampaignBonds();
        for (const grief of whoMourns({
            party: partyMembers.filter(m => m !== member).map(m => ({
                id: m.id, name: m.name, hp: m.hp, wants: readReasons(m).wants,
                bondWithDead: getBondProgress(bonds, String(m.id)).rank,
            })),
            dead: String(member.name),
            today,
        })) {
            const mourner = partyMembers.find(m => String(m.id) === grief.id);
            if (mourner) mourner.mourning = grief.mourning;
        }
        buryMember(member, today, bonds);
        rememberTogether(`${member.name} murió en ${currentBoardName || currentLocationName}.`,
            partyMembers.map(m => String(m.name)));
        return;
    }

    // Un mundo puede decidir que las heridas no quedan: se levanta y ya esta.
    if (!currentSurvival().injuries) {
        member.hp = 1;
        member.deathSaves = clearDeathSaves();
        postCombatNarration(`🩸 [COMBAT] ${fall.reason}`);
        return;
    }

    const patch = applyInjury(member, fall.injury);
    member.injuries = patch.injuries;
    member.baseStats = patch.baseStats;
    Object.assign(member, patch.stats);

    // Se levanta, pero no entero: sigue a 1 PG y con lo suyo encima.
    member.hp = 1;
    member.deathSaves = clearDeathSaves();
    member.activeConditions = (Array.isArray(member.activeConditions) ? member.activeConditions : [])
        .filter((/** @type {string} */ c) => c !== 'Unconscious');

    postCombatNarration(`🩸 [COMBAT] ${fall.reason}`);
    postCombatNarration(`🩹 [COMBAT] ${describeInjuries(member).join(' · ')}`);
    toastr.warning(describeInjuries(member).join('\n'), fall.reason, { timeOut: 15000 });
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
 * Idea 23: al empezar cada ronda, el fuego se extiende a lo que arde de al lado (cajas,
 * puertas, maleza), se apaga a las tres rondas, y con lluvia no prende.
 */
function burnRound() {
    const context = getActiveBoardContext();
    const board = context.board;
    if (!board || !Array.isArray(board.hazards) || board.hazards.length === 0) return;
    const step = spreadFire({
        hazards: board.hazards,
        terrain: context.terrain,
        round: Number(combatEncounter.round) || 1,
        random: nextRandom,
        wet: boardVisibility().wet,
        outdoors: !isIndoors(board, hereLocation()),
        width: context.gridWidth,
        height: context.gridHeight,
    });
    if (step.lines.length === 0) return;
    board.hazards = step.hazards;
    board.terrain = step.terrain;
    persistBoardTerrain(board);
    // R6: si el fuego llega a un barril, revienta.
    const blasts = explodeBarrels(step.burnt.filter(b => /barril/i.test(b.what)));
    postCombatNarration(`[COMBAT] ${[...step.lines, ...blasts].join('\n')}`);
    renderLocationMapsPreview();
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
    const rare = nextRandom() < 0.4;
    const pool = DEFAULT_LOOT_RULES.itemsByRarity[rare ? 'Uncommon' : 'Common'] ?? [];
    const name = pool.length > 0 && nextRandom() < 0.6 ? pool[Math.floor(nextRandom() * pool.length) % pool.length] : '';
    if (name) addItemToInventory(/** @type {any} */ (opener), createItem(/** @type {any} */ (describeLootItem(name, rare ? 'Uncommon' : 'Common', worldItemCatalogue))));
    board.terrain = setTerrainCell(normalizeTerrain(board.terrain), gx, gy, 'floor');
    persistBoardTerrain(board);
    savePartyState();
    renderPartyMembers();
    renderLocationMapsPreview();
    postCombatNarration(`🧰 [TABLERO] ${opener.name} abre el cofre: ${gold} de oro${name ? ` y ${name}` : ''}.`);
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
function explodeBarrels(cells) {
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
 * R6: los jefes con fases (la P22): al bajar de la mitad, cambian una vez, y se dice.
 */
function bossPhases() {
    const band = [...getAliveEnemies()]
        .sort((a, b) => (Number(a.maxHp) || 0) - (Number(b.maxHp) || 0))
        .map(e => String(e.name).replace(/\s+\d+$/, ''));
    for (const enemy of getAliveEnemies()) {
        const phase = bossPhase({ enemy, band });
        if (!phase) continue;
        Object.assign(enemy, phase.patch);
        postCombatNarration(`👑 [COMBAT] ${phase.line}`);
        if (phase.summon.length > 0) {
            const board = getActiveBoardContext().board;
            if (board) {
                board.waves = [...(Array.isArray(board.waves) ? board.waves : []), {
                    round: Number(combatEncounter.round) || 1, names: phase.summon, x: Number(enemy.gridX) || 0, y: Number(enemy.gridY) || 0, tell: '',
                }];
                arriveWaves();
            }
        }
    }
    saveCombatState();
}

/**
 * R6: los refuerzos de un tablero (la P21). Una ronda antes se oyen (el aviso); en su ronda
 * llegan, junto a donde dice el tablero, y entran en la iniciativa.
 */
function arriveWaves() {
    const board = getActiveBoardContext().board;
    if (!board || !Array.isArray(board.waves) || board.waves.length === 0 || !combatEncounter.active) return;
    const round = Number(combatEncounter.round) || 1;
    const { terrain, gridWidth, gridHeight } = getActiveBoardContext();
    const busy = new Set([
        ...partyMembers.map(m => `${Number(m.mapPosition?.gridX) || 0},${Number(m.mapPosition?.gridY) || 0}`),
        ...combatEncounter.enemies.filter(e => (e.currentHp || 0) > 0).map(e => `${Number(e.gridX) || 0},${Number(e.gridY) || 0}`),
    ]);
    let changed = false;
    board.waves = board.waves.map((/** @type {any} */ wave) => {
        if (!wave || wave.done) return wave;
        if (Number(wave.round) - 1 === round && wave.tell && !wave.told) {
            postCombatNarration(`👂 [COMBAT] ${wave.tell}`);
            changed = true;
            return { ...wave, told: true };
        }
        if (Number(wave.round) > round) return wave;
        // Las casillas libres más cerca de por donde llegan.
        /** @type {Array<{x: number, y: number}>} */
        const cells = [];
        for (let r = 0; r <= 3 && cells.length < (wave.names?.length ?? 0); r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    const x = Number(wave.x) + dx;
                    const y = Number(wave.y) + dy;
                    if (cells.length >= (wave.names?.length ?? 0) || busy.has(`${x},${y}`) || !isPassable(terrain, x, y, gridWidth, gridHeight)) continue;
                    busy.add(`${x},${y}`);
                    cells.push({ x, y });
                }
            }
        }
        const arrived = instancesFromPlacements((wave.names ?? []).slice(0, cells.length).map((/** @type {string} */ name, /** @type {number} */ i) => ({ name, ...cells[i] })));
        if (arrived.length > 0) {
            combatEncounter.enemies = [...combatEncounter.enemies, ...arrived];
            for (const enemy of arrived) {
                const initiative = rollInitiativeWithPopover(enemy.name, enemy.dexterity || 10, 'enemy');
                combatEncounter.turnOrder.push({ id: enemy.instanceId, name: enemy.name, initiative, isEnemy: true });
            }
            postCombatNarration(`⚠️ [COMBAT] Llegan refuerzos: ${arrived.map(e => e.name).join(', ')}.`);
        }
        changed = true;
        return { ...wave, done: true };
    });
    if (!changed) return;
    persistBoardTerrain(board);
    saveCombatState();
    renderLocationMapsPreview();
}

function advanceTurnIndex() {
    if (!combatEncounter.active || combatEncounter.turnOrder.length === 0) return null;

    // The machine owns the walk: it skips the fallen, wraps the order and counts the
    // round. This used to be a second implementation of the same thing, right here.
    const roundBefore = Number(combatEncounter.round) || 1;
    const advanced = advanceTurn(combatEncounter, entry => canTurnEntryAct(entry));

    if (advanced === combatEncounter) return null;   // nobody left who can act

    Object.assign(combatEncounter, advanced);
    // Lo que caduca cuando vuelve a tocarle a alguien: su esquivar, su destrabarse, su ayuda.
    const starting = getCurrentTurnEntry();
    if (starting) combatEncounter.maneuvers = startManeuverTurn(combatEncounter.maneuvers, String(starting.id));
    // Idea 4: lo preparado dura hasta que vuelve a tocarle.
    if (starting) combatEncounter.readied = dropReadied(combatEncounter.readied, String(starting.id));
    saveCombatState();

    // Announced here rather than inside the machine, which stays pure and silent.
    if (combatEncounter.round > roundBefore) {
        postCombatNarration(`⏳ [COMBAT] Ronda ${combatEncounter.round}`);
        // Lo que una habilidad puso con duracion se va aqui, que es el unico sitio donde
        // el combate cuenta rondas.
        for (const line of expireTimedConditions()) postCombatNarration(line);

        // Y aqui tiran los que estan en el suelo. En 5e se tira "al empezar tu turno",
        // pero la maquina de turnos salta a quien no puede actuar, asi que el turno de un
        // caido no llega nunca: una vez por ronda es lo mismo y no pide reescribirla.
        for (const member of partyMembers) resolveDeathSave(member);

        // Ronda nueva, reacciones nuevas.
        usedReactions = new Set();
        // Idea 23: el tablero cambia mientras se pelea.
        burnRound();
        // R6: los refuerzos del tablero: se oyen una ronda antes, y llegan en la suya.
        arriveWaves();
        // R6: y los jefes que han bajado de la mitad cambian.
        bossPhases();
        // A scenario won by the clock has no other moment to notice.
        if (checkScenarioOutcome()) return null;
    }

    return getCurrentTurnEntry();
}

/**
 * @param {boolean} [includeCurrent=true]
 */
/**
 * Si a este le toca moverse solo.
 *
 * @param {any} entry
 * @returns {boolean}
 */
function actsOnItsOwn(entry) {
    if (!entry || entry.isEnemy) return false;
    const member = partyMembers.find(m => Number(m.id) === Number(entry.id));
    if (!member) return false;
    return !canControl(member, partyMembers, getActiveRuleset()?.companions ?? null).allowed;
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
/** R3: cómo se dicen los estados que quitan el turno. */
const CONDITION_WORDS = /** @type {Record<string, string>} */ ({
    Unconscious: 'dormido', Stunned: 'aturdido', Paralyzed: 'paralizado', Incapacitated: 'fuera de sí',
});

function resolveAllyTurnAction(entry) {
    const member = partyMembers.find(m => Number(m.id) === Number(entry.id));
    if (!member) return '';
    const out = cannotAct(member.activeConditions);
    if (out && (Number(member.hp) || 0) > 0) return `💤 [COMBAT] ${member.name} no puede actuar (${CONDITION_WORDS[out] ?? out}): pierde el turno.`;

    const living = combatEncounter.enemies.filter((/** @type {any} */ e) => (Number(e.currentHp) || 0) > 0);
    if (living.length === 0) return `[COMBAT] ${member.name} baja el arma: no queda nadie.`;

    const { terrain, gridWidth, gridHeight } = getActiveBoardContext();
    const cellOf = (/** @type {any} */ m) => ({
        gridX: Number(m.mapPosition?.gridX) || 0,
        gridY: Number(m.mapPosition?.gridY) || 0,
    });

    // Su postura la eliges tu, en su ficha. Sin elegir, se queda a tu lado: el valor
    // por defecto de antes era cargar, y eso no lo habia decidido nadie.
    const stance = stanceOf(member);
    const yours = partyMembers[0];
    const leader = yours && String(yours.id) !== String(member.id) && (Number(yours.hp) || 0) > 0
        ? cellOf(yours) : null;

    const plan = planAllyTurn({
        actor: {
            id: String(member.id),
            name: String(member.name),
            ...cellOf(member),
            currentHp: Number(member.hp) || 0,
            maxHp: Number(member.maxHp) || 1,
            speedFeet: Number(member.speed) || 30,
            // Su arma de verdad: un arquero que se queda atras tiene que poder disparar.
            attackRangeFeet: getAttackRangeFeet(member),
        },
        leader,
        enemies: living.map((/** @type {any} */ e) => ({
            id: String(e.instanceId),
            gridX: Number(e.gridX) || 0,
            gridY: Number(e.gridY) || 0,
            currentHp: Number(e.currentHp) || 0,
            maxHp: Number(e.maxHp) || 1,
            reachFeet: Number(e.attackRangeFeet) || 5,
            boss: Boolean(e.boss),
        })),
        allies: partyMembers
            .filter(m => Number(m.id) !== Number(member.id) && (Number(m.hp) || 0) > 0)
            .map(m => ({ id: String(m.id), ...cellOf(m) })),
        stance,
        // Idea 35: a quien prefiere, de su ficha.
        prefer: String(member.prefer || DEFAULT_PREFERENCE),
        terrain,
        gridWidth,
        gridHeight,
    });

    /** @type {string[]} */
    const lines = [`[COMBAT] ${member.name} (${STANCES[/** @type {keyof typeof STANCES} */ (stance)].label.toLowerCase()}) decide por su cuenta: ${plan.rationale}`];

    // Destrabarse va **antes** de moverse: es lo que le deja irse sin pagar el golpe.
    if (plan.action === 'disengage') performManeuver('destrabarse');

    const here = cellOf(member);
    if (plan.destination && (plan.destination.x !== here.gridX || plan.destination.y !== here.gridY)) {
        // Se mueve por la puerta de siempre: cuenta los pies y paga los ataques de
        // oportunidad igual que si lo arrastraras tu.
        handlePlayerCombatMove(`${plan.destination.x + 1},${plan.destination.y + 1}`);
    }

    if (plan.action === 'dodge') performManeuver('esquivar');

    if (plan.action === 'attack' && plan.targetId != null) {
        const target = living.find((/** @type {any} */ e) => String(e.instanceId) === String(plan.targetId));
        if (target) handlePlayerCombatAttack(String(target.name));
    }

    return lines.join('\n');
}

function runCombatTurnLoop(includeCurrent = true) {
    if (!combatEncounter.active || combatEncounter.turnOrder.length === 0) return null;

    let entry = includeCurrent ? getCurrentTurnEntry() : advanceTurnIndex();
    if (!entry || !canTurnEntryAct(entry)) {
        entry = advanceTurnIndex();
    }

    let safety = 0;
    while (entry && combatEncounter.active
        && (entry.isEnemy || actsOnItsOwn(entry))
        && safety < combatEncounter.turnOrder.length + 1) {
        announceTurnInChat(entry);
        const actionLog = entry.isEnemy ? resolveEnemyTurnAction(entry) : resolveAllyTurnAction(entry);
        postCombatNarration(actionLog);

        if (!getLivingPartyMembers().length) {
            // B2: si alguien salió antes, los de dentro han caído pero los de fuera se salvan.
            if (everyoneOut(partyMembers.filter(m => !m.dead), combatEncounter.left)) {
                finishEscape('Los que quedaban dentro han caído; los que salieron, se salvan.');
                return null;
            }
            postCombatNarration('💀 [COMBAT] Todos los miembros del grupo han caido. Fin del combate.');
            endCombat('defeat');
            return null;
        }

        entry = advanceTurnIndex();
        safety += 1;
    }

    if (entry && combatEncounter.active) {
        announceTurnInChat(entry);
    }

    return entry;
}

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
function toggleBoardDoor(board, gx, gy, open, gridW, gridH) {
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
 * Convierte lo que el libro dibujo en el tablero en enemigos de verdad.
 *
 * Es el ritmo de una mazmorra de Gloomhaven: el siguiente combate llega cuando **tu**
 * abres la puerta, no cuando se carga el mapa. Aparecen donde el libro los dibujo, con
 * los numeros de su plantilla; una colocacion sin plantilla se salta y se avisa.
 *
 * @param {Array<{name: string, x: number, y: number}>} placements
 * @returns {import('./dnd-system.js').EnemyInstance[]}
 */
function instancesFromPlacements(placements) {
    const templates = getCurrentWorldEnemies();
    /** @type {import('./dnd-system.js').EnemyInstance[]} */
    const instances = [];

    for (const placement of placements) {
        const template = templates.find(e => String(e.name).toLowerCase() === String(placement.name).toLowerCase());
        if (!template) {
            console.warn('[party] placement with no template', placement);
            continue;
        }
        const already = combatEncounter.enemies.filter(e => e.name.startsWith(template.name)).length
            + instances.filter(e => e.name.startsWith(template.name)).length;
        // R7: la némesis vuelve más fuerte, y lo dice.
        const nemesis = /** @type {any} */ (placement).nemesis ? readNemeses(chat_metadata?.[NEMESES_KEY]).find(n => n.id === /** @type {any} */ (placement).nemesis && !n.gone) : null;
        const back = nemesis ? comeback(nemesis) : null;
        if (back) {
            postCombatNarration(back.line.replace(/^😈 /u, '😈 [NEMESIS] '));
            void postForModel(back.forModel);
        }
        instances.push({
            ...(back ? { nemesis: /** @type {any} */ (nemesis).id } : {}),
            instanceId: generateEnemyInstanceId(),
            templateId: template.id,
            name: already > 0 ? `${template.name} ${already + 1}` : template.name,
            avatar: template.avatar,
            currentHp: Math.round(template.maxHp * (back?.hpFactor ?? 1)),
            maxHp: Math.round(template.maxHp * (back?.hpFactor ?? 1)),
            armorClass: template.armorClass,
            strength: template.strength,
            dexterity: template.dexterity,
            constitution: template.constitution,
            intelligence: template.intelligence,
            wisdom: template.wisdom,
            charisma: template.charisma,
            speed: template.speed,
            cr: template.cr,
            // Sin esto, todos peleaban como agresivos de cuerpo a cuerpo: el arquero del
            // mundo bajaba a dar punetazos.
            profile: /** @type {any} */ (template).profile,
            attackRangeFeet: /** @type {any} */ (template).attackRangeFeet,
            abilities: /** @type {any} */ (template).abilities,
            gridX: placement.x,
            gridY: placement.y,
        });
    }

    return instances;
}

/**
 * Despierta a lo que duerme en una sala recien revelada.
 *
 * @param {any} board El tablero abierto.
 * @param {any} room La sala que se acaba de revelar.
 * @returns {number} Cuantos han despertado.
 */
function wakeRoomEnemies(board, room) {
    const placements = enemiesInRoom(room, board?.enemyPlacements ?? []);
    if (placements.length === 0) return 0;

    const woken = instancesFromPlacements(placements);
    if (woken.length === 0) return 0;

    const names = woken.map(e => `${e.name} (${e.gridX + 1}, ${e.gridY + 1})`).join(', ');

    if (!combatEncounter.active) {
        // Nadie peleaba: la sala abre su propio combate.
        postCombatNarration(`[COMBAT] Se despierta lo que dormia en la sala: ${names}.`);
        beginEncounterWith(woken);
        showInitiativeBanner(woken.map(e => e.name));
        return woken.length;
    } else {
        combatEncounter.enemies = [...combatEncounter.enemies, ...woken];
        for (const enemy of woken) {
            const initiative = rollInitiativeWithPopover(enemy.name, enemy.dexterity || 10, 'enemy');
            combatEncounter.turnOrder.push({ id: enemy.instanceId, name: enemy.name, initiative, isEnemy: true });
        }
        saveCombatState();
    }

    postCombatNarration(`⚠️ [COMBAT] Se despierta lo que dormia en la sala: ${names}.`);
    showInitiativeBanner(woken.map(e => e.name));
    return woken.length;
}

/**
 * Start a combat encounter on the current board.
 * @param {import('./dnd-system.js').EnemyTemplate} template - Enemy template
 * @param {number} count - Number of enemies to spawn
 * @param {number} [gridWidth=50] - Board grid width for random placement
 * @param {number} [gridHeight=50] - Board grid height for random placement
 * @returns {string} Initiative order summary string
 */
function startCombat(template, count, gridWidth = 50, gridHeight = 50) {
    if (!combatEncounter.active) countStat('fights');
    // A new fight starts with an empty log: the last one's blow-by-blow is already in
    // the chat, and leaving it here would read as if it were still happening.
    combatLogEntries = [];

    // Donde los pone el tablero, si los pone. Un libro dibuja a sus monstruos donde
    // quiere — tras la cobertura, al otro lado de la sala — y ese dibujo es la mitad de
    // lo que hace que el encuentro sea el que es. Antes caian en una casilla al azar de
    // la esquina, muros incluidos.
    const spawnBoard = getActiveBoardContext();
    const spawnCells = planSpawnCells({
        name: template.name,
        count,
        // Solo los que estan en una sala ya revelada: lo que duerme tras una puerta
        // cerrada no aparece porque alguien escriba su nombre.
        placements: awakePlacements(spawnBoard.board?.rooms, spawnBoard.board?.enemyPlacements ?? []),
        terrain: spawnBoard.terrain,
        gridWidth: spawnBoard.gridWidth || gridWidth,
        gridHeight: spawnBoard.gridHeight || gridHeight,
        taken: partyMembers.map(m => ({
            x: Number(m.mapPosition?.gridX) || 0,
            y: Number(m.mapPosition?.gridY) || 0,
        })),
        // Con el dado de la partida, no con Math.random. Cuando no hay nada dibujado que
        // este despierto, la casilla se sortea — y una tirada que se salte la semilla hace
        // que dos partidas con la misma semilla dejen de salir iguales, que es justo lo
        // unico que la semilla promete.
        random: nextRandom,
    });

    /** @type {import('./dnd-system.js').EnemyInstance[]} */
    const newEnemies = [];
    for (let i = 0; i < count; i++) {
        newEnemies.push({
            instanceId: generateEnemyInstanceId(),
            templateId: template.id,
            name: count > 1 ? `${template.name} ${i + 1}` : template.name,
            avatar: template.avatar,
            // Idea 24: el jefe del guion lo es también en el tablero.
            boss: Boolean(/** @type {any} */ (template).boss),
            currentHp: template.maxHp,
            maxHp: template.maxHp,
            armorClass: template.armorClass,
            strength: template.strength,
            dexterity: template.dexterity,
            constitution: template.constitution,
            intelligence: template.intelligence,
            wisdom: template.wisdom,
            charisma: template.charisma,
            speed: template.speed,
            cr: template.cr,
            // Sin esto, todos peleaban como agresivos de cuerpo a cuerpo: el arquero del
            // mundo bajaba a dar punetazos.
            profile: /** @type {any} */ (template).profile,
            attackRangeFeet: /** @type {any} */ (template).attackRangeFeet,
            abilities: /** @type {any} */ (template).abilities,
            gridX: spawnCells[i]?.x ?? 0,
            gridY: spawnCells[i]?.y ?? 0,
        });
    }

    return beginEncounterWith(newEnemies);
}

/**
 * Arranca el encuentro con los enemigos dados: tira iniciativas, ordena y empieza.
 *
 * Extraido de `startCombat` porque una sala que se abre tambien empieza un combate, y
 * fingir una plantilla vacia para reutilizar aquella dejaba a los recien despertados sin
 * turno: existian en el encuentro y no actuaban nunca.
 *
 * @param {import('./dnd-system.js').EnemyInstance[]} newEnemies
 * @returns {string} El orden de iniciativa, ya escrito.
 */
function beginEncounterWith(newEnemies) {
    // Idea 25: tras dos derrotas seguidas, con la red puesta, este baja un escalón.
    if (chat_metadata && shouldSoften(chat_metadata[SAFETY_KEY], Boolean(chat_metadata[SAFETY_ON_KEY])) && !combatEncounter.active) {
        for (const enemy of newEnemies) Object.assign(enemy, softenEnemy(enemy));
        chat_metadata[SAFETY_KEY] = { streak: 0 };
        postCombatNarration(`🪢 [COMBAT] ${SOFTEN_NOTE}`);
    }
    // Antes de una pelea que puede torcer la campana, una red. Solo con los duros: un
    // punto antes de cada rata seria un cajon de sastre y tapa a los que guardas tu.
    const boss = newEnemies.find(e => (Number(e.cr) || 0) >= 2 || (Number(e.maxHp) || 0) >= 40);
    if (boss && !combatEncounter.active) {
        saveCheckpoint(`Antes de ${boss.name}`, true);
    }

    /** @type {import('./dnd-system.js').TurnEntry[]} */
    const turnEntries = [];
    // Ideas 39 y 41: la moral del grupo y quien vigila mueven la iniciativa de todos.
    const morale = partyMorale();
    const sentinel = withJob(partyMembers, 'centinela') ? 1 : 0;
    // Quien ha muerto ya no pelea (idea 36): antes seguía tirando iniciativa, y un descanso
    // lo ponía en pie otra vez.
    for (const m of partyMembers.filter(member => !member.dead)) {
        const init = rollInitiativeWithPopover(m.name, m.dexterity || 10, 'ally') + morale.value + sentinel + perkBonus(m, 'initiative');
        turnEntries.push({ id: String(m.id), name: m.name, initiative: init, isEnemy: false });
    }
    if (morale.value !== 0) postCombatNarration(`🫂 [COMBAT] Moral del grupo: ${morale.label}.`);
    // Ideas 73 y 90: la niebla, la lluvia, el viento o la noche, dichos antes del primer golpe.
    const seen = boardVisibility();
    if (seen.note) postCombatNarration(`🌫️ [COMBAT] ${seen.note}`);
    // R7: cada enemigo con su papel; sin perfil escrito, el que pide su papel. Y la banda,
    // si es banda, se organiza a la vista.
    for (const enemy of newEnemies) {
        const role = bandRoleOf(enemy, knownAbilities(enemy, getAbilityCatalogue()));
        /** @type {any} */ (enemy).role = role;
        if (!enemy.profile) /** @type {any} */ (enemy).profile = ENEMY_ROLES[role].profile;
    }
    const band = newEnemies.length > 1
        ? describeBand(newEnemies.map(e => ({ name: String(e.name), role: String(/** @type {any} */ (e).role ?? '') })), tacticOf(newEnemies[0]))
        : '';
    if (band) postCombatNarration(`🧠 [COMBAT] ${band}`);

    const enemies = [...combatEncounter.enemies, ...newEnemies];
    for (const e of enemies) {
        const init = rollInitiativeWithPopover(e.name, e.dexterity || 10, 'enemy');
        turnEntries.push({ id: e.instanceId, name: e.name, initiative: init, isEnemy: true });
    }

    // Sort descending by initiative (ties: non-enemies first)
    turnEntries.sort((a, b) => b.initiative - a.initiative || (a.isEnemy ? 1 : 0) - (b.isEnemy ? 1 : 0));

    combatEncounter = {
        active: true,
        enemies,
        turnOrder: turnEntries,
        currentTurnIndex: 0,
        round: 1,
        turnState: null,
    };

    saveCombatState();

    // Build summary
    const summary = turnEntries.map((t, i) => `${i + 1}. ${t.name} (${t.initiative})${t.isEnemy ? ' ⚔️' : ''}`).join('\n');

    postCombatNarration(`⚔️ [COMBAT] ¡Encuentro iniciado!\n\nOrden de iniciativa:\n${summary}`);
    const firstTurn = getCurrentTurnEntry();
    resetCombatTurnState(firstTurn);
    runCombatTurnLoop(true);

    return summary;
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
 * Idea 135: lo maldito que se lleva puesto resta, como una herida. Se vuelve a mirar cada
 * vez que se pone o se quita algo, y al quitar la maldición.
 *
 * @param {any} member
 */
function syncCurse(member) {
    const patch = setInjury(member, curseInjury(member), 'curse');
    member.injuries = patch.injuries;
    member.baseStats = patch.baseStats;
    Object.assign(member, patch.stats);
}

/**
 * Idea 135: soltar lo que se lleva, salvo que esté maldito.
 *
 * @param {any} member
 * @param {string} slot
 * @returns {boolean}
 */
function tryUnequip(member, slot) {
    const worn = (member.items ?? []).find((/** @type {any} */ i) => i.id === member.equippedItems?.[slot]);
    const off = canTakeOff(worn);
    if (!off.ok) {
        toastr.warning(off.reason, 'Maldito');
        return false;
    }
    unequipItem(member, slot);
    syncCurse(member);
    savePartyState();
    return true;
}

/**
 * Idea 135: ponerse algo. Lo que ya está en esa ranura y está maldito no se deja quitar, y
 * lo maldito que uno se pone se descubre al ponérselo.
 *
 * @param {any} member
 * @param {string} itemId
 * @param {string} slot
 * @returns {boolean}
 */
function tryEquip(member, itemId, slot) {
    const worn = (member.items ?? []).find((/** @type {any} */ i) => i.id === member.equippedItems?.[slot]);
    if (worn && worn.id !== itemId && !canTakeOff(worn).ok) {
        toastr.warning(canTakeOff(worn).reason, 'Maldito');
        return false;
    }
    equipItem(member, itemId, slot);
    const item = (member.items ?? []).find((/** @type {any} */ i) => i.id === itemId);
    if (item?.cursed && item.identified === false) {
        item.identified = true;
        toastr.error(`${item.name} se os pega a la mano: ${item.curse?.label ?? 'está maldito'}. ${item.curse?.note ?? ''}`, 'Maldito', { timeOut: 12000 });
    }
    syncCurse(member);
    savePartyState();
    return true;
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
function awardEncounterLoot(defeated) {
    const survivors = partyMembers.filter(m => (m.hp || 0) > 0);
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
 * Entrega el encargo aceptado, si el combate que acaba de ganarse era el suyo.
 *
 * Aqui se cierra el bucle entero: el tablon te mando, el generador te construyo el sitio,
 * lo jugaste, y ahora te pagan y subes de reputacion — que es lo que abre el siguiente
 * rango del tablon. Sin esto, aceptar un encargo era apuntar una frase.
 */
function deliverTakenContract() {
    const taken = chat_metadata?.[TAKEN_KEY];
    if (!taken || !currentBoardName) return;
    // Uno escrito se entrega en su tablero; uno generado, en el que se le construyo.
    const itsBoard = taken.boardName
        ? String(currentBoardName) === String(taken.boardName)
        : String(currentBoardName).includes('(encargo)');
    if (!itsBoard) return;
    finishTakenContract(taken);
}

/**
 * Cumplir el encargo aceptado: pagar, subir la reputacion, apuntarlo y contarlo.
 *
 * @param {any} taken
 */
function finishTakenContract(taken) {
    const guild = getGuild();
    const done = completeContract(guild, taken);

    // El pago va al grupo, al mismo bolsillo del que sale la cena.
    const holder = partyMembers.find(m => (m.hp || 0) > 0) ?? partyMembers[0];
    if (holder) holder.gold = (Number(holder.gold) || 0) + done.gold;

    guild.renown = done.renown;
    chat_metadata[GUILD_KEY] = guild;
    delete chat_metadata[TAKEN_KEY];
    countStat('contracts');
    countStat('gold', Number(done.gold) || 0);

    noteDeed(`Entregasteis el encargo «${taken.title}»${taken.patron ? ` (lo pedía ${taken.patron})` : ''}.`);
    // Idea 85: al sitio le va mejor.
    void shiftPlaceFortune(String(taken.locationName ?? ''), 1);
    // Uno escrito no vuelve a salir, y su giro es lo que se descubre al cumplirlo.
    if (taken.written) {
        const done = Array.isArray(chat_metadata[WRITTEN_DONE_KEY]) ? chat_metadata[WRITTEN_DONE_KEY] : [];
        chat_metadata[WRITTEN_DONE_KEY] = [...new Set([...done, String(taken.id)])];
        if (taken.twist) {
            void postForModel(`[ENCARGO] «${taken.title}», cumplido. Lo que se descubre: ${taken.twist} `
                + 'Cuéntalo en un párrafo. No inventes nada que no esté aquí.');
        }
    }
    notePlot({ kind: 'contract', id: String(taken.id), faction: String(taken.faction || ''), against: Boolean(taken.against) });
    // Idea 52: donde se entrega, se sabe.
    raiseFame(String(taken.locationName ?? '') || currentLocationName);
    // Ideas 105 y 131: quien iba solo para este encargo, se va.
    dismissGuests(String(taken.id), 'cumplido');
    // Idea 30: el encargo de un compañero pesa el doble en su vínculo.
    if (taken.personal) {
        const friend = partyMembers.find(m => String(m.id) === String(taken.personal));
        if (friend) {
            recordCampaignBondEvent(String(friend.id), 'quest_together');
            recordCampaignBondEvent(String(friend.id), 'quest_together');
            toastr.success(`${friend.name} no lo olvida.`, '🤝 Encargo personal');
            // R8: su historia cambia lo que sabe hacer.
            const arc = completeArc(friend, readReasons(friend).wants);
            if (arc) {
                /** @type {any} */ (friend).perks = arc.perks;
                savePartyState();
                postCombatNarration(`🌱 [GRUPO] ${arc.line}`);
            }
            void postForModel(`[ENCARGO PERSONAL] ${friend.name} ve cumplido lo suyo: «${taken.title}». Que lo agradezca a su manera, en una o dos frases.`);
        }
    }
    // Idea 132: la reliquia de este encargo, si la tiene.
    const relicLines = deliverRelics({ kind: 'contract', id: String(taken.id) });
    if (relicLines.length > 0) {
        void postForModel(`[RELIQUIA] ${relicLines.join(' ')} Cuéntalo en una frase. No inventes nada que no esté aquí.`);
    }

    // Si era el favor que se debia, la cuenta queda saldada.
    const debt = getDebt();
    if (settlesDebt(debt, taken)) {
        delete chat_metadata[DEBT_KEY];
        const paid = `Favor cumplido: ${debt?.patronName} ${saysWith(debt?.patronName, 'da', 'dan')} la deuda por saldada.`;
        void postForModel(`🤝 [CAMPAÑA] ${paid}`);
        toastr.success(paid, 'Deuda saldada', { timeOut: 12000 });
    }
    saveMetadata();
    savePartyState();

    postCombatNarration(`🏆 [GREMIO] ${done.line}`);
    toastr.success(done.line, 'Encargo entregado', { timeOut: 12000 });

    // Y si el encargo tomaba partido, el mundo se entera: es lo que lo separa de un
    // recado. Va aparte porque escribir el mundo es asincrono y esto no puede serlo.
    if (taken.faction) void settleFactionStake(taken);
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
function settleFactionStake(contract) {
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
        currentWorldFactions = people;
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
const campaign = createCampaignState({
    metadata: () => chat_metadata,
    saveMetadata: () => saveMetadata(),
    party: () => partyMembers,
    saveParty: () => savePartyState(),
    renderParty: () => renderPartyMembers(),
    renderCampaign: () => renderCampaignTab(),
    narrate: (text) => postCombatNarration(text),
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

/** Donde se apunta el dia en que vence la proxima cuenta. */
const BILL_DUE_KEY = 'upkeepDueDay';

/** El gremio y su tablon viven en la partida, no en la sesion. */
const GUILD_KEY = 'guild';
const BOARD_KEY = 'contractBoard';
const TAKEN_KEY = 'contractTaken';

/** @returns {any} */
function getGuild() {
    return readGuild(chat_metadata?.[GUILD_KEY]);
}

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
async function campaignCompendium() {
    const { compendium, batteries } = await getCompendium();
    if (!lastPicks || !batteries) return compendium;
    return createCompendium(onlyPicked(batteries, lastPicks));
}

/**
 * Lo que el mundo dijo sobre su tablon, en el taller.
 *
 * Sin nada dicho, lo de siempre: uno de cada tres encargos de faccion y ninguna mision
 * escrita. Es la copia leida, porque esto se llama al dibujar y no puede esperar.
 *
 * @returns {{factionShare: number, theme: string, written: any[]}}
 */
function worldBoardRules() {
    return {
        factionShare: Number(lastBoardRules?.factionShare) || 3,
        theme: String(lastBoardRules?.theme ?? ''),
        written: Array.isArray(lastWrittenQuests) ? lastWrittenQuests : [],
    };
}

/** @type {any} */
let lastBoardRules = null;
/** Lo que este mundo dejo entrar de cada bateria, o null si no eligio. */
/** @type {any} */
let lastPicks = null;
/** @type {any[]} */
let lastWrittenQuests = [];
/** @type {import('./game-engine/campaign/written-contracts.js').WrittenContract[]} */
let lastWrittenContracts = [];
/** @type {import('./game-engine/campaign/rumors.js').Rumor[]} */
let lastRumors = [];
/** @type {any} */
let lastMix = null;
/** La gente del mundo: quien es, donde vive y que servicio atiende. */
/** @type {Array<{name: string, where: string, service: string, secret?: string, language?: string, dead?: boolean}>} */
let lastWorldNpcs = [];
/** Las fichas de los confidentes del mundo, por uid. */
/** @type {Record<string, any>} */
let lastConfidantEntries = {};
/** A quien se ha conocido ya en una posada: el paso antes de pedirle que venga. */
const RECRUITS_MET_KEY = 'recruitsMet';
/** Lo que el grupo recuerda haber vivido junto (idea 34). */
const MEMORIES_KEY = 'sharedMemories';

/** Los encargos escritos ya entregados, y los rumores ya oidos. */
const WRITTEN_DONE_KEY = 'writtenDone';
const RUMORS_HEARD_KEY = 'rumorsHeard';

/**
 * U3 del pegamento: los encargos del tablón que caducan hoy, y el sitio que los pedía lo
 * nota. Lo llama el paso del tiempo cada día; antes solo pasaba al abrir el gremio.
 *
 * @param {number} today
 * @returns {any[]} Los que siguen.
 */
function expireBoard(today) {
    if (!chat_metadata) return [];
    const { kept, expired } = expireContracts(chat_metadata[BOARD_KEY] ?? [], today);
    if (expired.length === 0) return kept;
    for (const gone of expired) {
        postCombatNarration(`📄 [GREMIO] Se paso el plazo: ${gone.title}.`);
        // Y al sitio que lo pedia, peor.
        void shiftPlaceFortune(String(gone.locationName ?? ''), -1);
    }
    chat_metadata[BOARD_KEY] = kept;
    saveMetadata();
    return kept;
}

/**
 * El tablon, llenandolo si hace falta.
 *
 * Los encargos vencen solos y el hueco se rellena: un tablon que se vacia deja de tirar
 * de ti, y uno que no vence deja de apretar.
 *
 * @returns {any[]}
 */
function refreshContractBoard() {
    if (!chat_metadata) return [];

    const guild = getGuild();
    const today = Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1));
    const kept = expireBoard(today);

    const wanted = boardSize(guild);

    // Las que el mundo trae escritas salen una vez, al principio: son las que dan el tono.
    // Lo demas lo genera el tablon segun se va vaciando.
    const written = worldBoardRules().written;
    if (kept.length === 0 && written.length > 0) {
        kept.push(...written.filter((/** @type {any} */ q) => q.atStart !== false).map(
            (/** @type {any} */ quest, /** @type {number} */ i) => ({
                id: `w_${i}_${String(quest.title ?? '').slice(0, 12)}`,
                rank: 'D',
                kind: 'cull',
                title: String(quest.title ?? '').trim(),
                locationName: String(quest.where ?? '').trim(),
                reward: Math.max(0, Number(quest.reward) || 40),
                days: today + 14,
                difficulty: 0.25,
                patron: 'El mundo',
            }),
        ));
    }

    // Lo que trae escrito el mundo va primero, en la parte que le toca segun el acto: la
    // curva de la mezcla (M7). Lo demas lo pone el generador, como siempre.
    if (lastWrittenContracts.length > 0) {
        const plot = getPlot();
        const act = actOf(plot, chat_metadata[PLOT_STATE_KEY]);
        const taken = chat_metadata?.[TAKEN_KEY];
        const pool = availableWritten({
            contracts: lastWrittenContracts,
            act,
            done: Array.isArray(chat_metadata[WRITTEN_DONE_KEY]) ? chat_metadata[WRITTEN_DONE_KEY] : [],
            busy: [...kept.map((/** @type {any} */ c) => String(c.id)), taken ? String(taken.id) : ''],
        });
        const slots = writtenSlots({
            wanted,
            onBoard: kept.filter((/** @type {any} */ c) => c.written).length,
            available: pool.length,
            act,
            ended: plot ? hasEnded(plot, chat_metadata[PLOT_STATE_KEY]) : false,
            mix: lastMix,
        });
        // Sin pasarse del tamano del tablon: lo escrito entra en los huecos, no encima.
        kept.push(...pool.slice(0, Math.min(slots, Math.max(0, wanted - kept.length))).map(w => toBoardContract(w, today)));
    }

    // Uno de cada N encargos sale de lo que alguien quiere de verdad. Lo dice el mundo, y
    // por defecto uno de cada tres: un tablon que solo habla de facciones deja de ofrecer
    // trabajo y pasa a ser una guerra.
    const share = Math.max(1, Number(worldBoardRules().factionShare) || 3);
    const huecos = wanted - kept.length;
    if (huecos > 0) {
        const suyos = contractsFromFactions({
            factions: busyFactions(getCurrentWorldFactions())
                // Los que ya estan en el tablon no se repiten: un encargo por faccion.
                .filter((/** @type {any} */ f) => !kept.some((/** @type {any} */ c) => c.faction === f.id)),
            random: nextRandom,
            renown: guild.renown,
            day: today,
            count: Math.max(0, Math.floor(huecos / share)),
        });
        kept.push(...suyos);
    }

    // Idea 116: uno te nombra, por tu trasfondo. Uno a la vez, y en el hueco de uno
    // generado: el tablón no crece, y lo escrito sigue siendo la mayoría.
    const places116 = getCurrentWorldLocationMaps().map((/** @type {any} */ l) => String(l?.name || '')).filter(Boolean);
    const bestiary116 = enemiesInSeason().map((/** @type {any} */ e) => String(e?.name || '')).filter(Boolean);
    if (kept.length < wanted && !hasNamed(kept) && nextRandom() < NAMED_CHANCE.chance) {
        const named = namedContract({ hero: partyMembers[0], places: places116, bestiary: bestiary116, random: nextRandom, day: today });
        if (named) kept.push(named);
    }
    if (kept.length < wanted) {
        const fresh = generateBoardOfContracts({
            random: nextRandom,
            count: wanted - kept.length,
            renown: guild.renown,
            theme: guild.theme,
            day: today,
            places: places116,
            // Idea 97: los que migran solo salen en su estación.
            bestiary: bestiary116,
        });
        kept.push(...fresh);
    }

    chat_metadata[BOARD_KEY] = kept;
    saveMetadata();
    // Idea 30: y lo que pidan los tuyos, si ya toca.
    offerPersonalQuests();
    return /** @type {any[]} */ (chat_metadata[BOARD_KEY]);
}

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
        factionDaysDue += Math.max(0, Math.floor(Number(days) || 0));
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

/** U8 del pegamento: quién está fuera haciendo un encargo sin el héroe. */
const DISPATCHES_KEY = 'dispatches';

/**
 * U8: mandar a uno o dos compañeros, sin el héroe, a un encargo menor del tablón. La
 * probabilidad se ve antes de mandarlos; mientras están fuera, no van con el grupo.
 *
 * @param {any} contract
 * @returns {Promise<boolean>}
 */
async function openDispatch(contract) {
    if (!chat_metadata) return false;
    const allowed = canDispatch(contract);
    if (!allowed.ok) {
        toastr.info(allowed.reason, 'Despachar');
        return false;
    }
    const hero = partyMembers[0];
    const candidates = partyMembers.filter(m => m !== hero && !m.dead && (Number(m.hp) || 0) > 0 && !m.guest);
    if (candidates.length === 0) {
        toastr.info('No hay nadie a quien mandar: el héroe no se despacha.', 'Despachar');
        return false;
    }
    const body = $('<div class="dp-root"></div>');
    body.append($('<h3></h3>').text(`Mandar a «${contract.title}»`));
    body.append($('<p class="dp-intro"></p>').text('Uno o dos, sin el héroe. Mientras estén fuera, no van con vosotros.'));
    for (const member of candidates) {
        const box = $('<input type="checkbox" class="dp-pick">').attr('value', String(member.id));
        body.append($('<label class="dp-member"></label>').append(box).append(document.createTextNode(` ${member.name} (nivel ${Number(member.level) || 1})`)));
    }
    const odds = $('<p class="dp-odds"></p>');
    body.append(odds);
    const chosen = () => candidates.filter(m => body.find(`.dp-pick[value="${String(m.id)}"]`).prop('checked')).slice(0, 2);
    const update = () => {
        const members = chosen();
        if (members.length === 0) {
            odds.text('Elige a quién mandas.');
            return;
        }
        const guess = dispatchOdds({ members, contract });
        odds.text(`${Math.round(guess.chance * 100)} % de que salga bien · de vuelta en ${dispatchDays(contract)} días.${guess.reasons.length > 0 ? ` ${guess.reasons.join('. ')}.` : ''}`);
    };
    body.on('change', '.dp-pick', function () {
        // Dos como mucho: el tercero que se marca desmarca el primero.
        if (body.find('.dp-pick:checked').length > 2) $(this).prop('checked', false);
        update();
    });
    update();
    const ok = await new Popup(body[0], POPUP_TYPE.CONFIRM, '', { okButton: 'Mandarlos', cancelButton: 'Mejor no' }).show();
    const members = chosen();
    if (!ok || members.length === 0) return false;
    const { chance } = dispatchOdds({ members, contract });
    const dispatch = startDispatch({ contract, members, today: Math.max(1, campaignDay()), chance });
    chat_metadata[DISPATCHES_KEY] = [...(Array.isArray(chat_metadata[DISPATCHES_KEY]) ? chat_metadata[DISPATCHES_KEY] : []), dispatch];
    chat_metadata[BOARD_KEY] = (Array.isArray(chat_metadata[BOARD_KEY]) ? chat_metadata[BOARD_KEY] : []).filter((/** @type {any} */ c) => String(c?.id) !== String(contract.id));
    // En el sitio: `partyMembers` es el array que el resto del archivo tiene cogido.
    for (const member of members) {
        const at = partyMembers.indexOf(member);
        if (at >= 0) partyMembers.splice(at, 1);
    }
    savePartyState();
    renderPartyMembers();
    saveMetadata();
    const names = members.map(m => String(m.name)).join(' y ');
    postCombatNarration(`🧭 [GREMIO] ${names} ${members.length > 1 ? 'salen' : 'sale'} hacia «${contract.title}»: ${Math.round(chance * 100)} % de que salga bien, de vuelta en ${dispatchDays(contract)} días.`);
    if (isShellOpen()) refreshGameShell();
    return true;
}

/**
 * U8: vuelven los que mandasteis, con lo que traigan. Si sale, se cobra y el sitio lo nota;
 * si sale mal, heridos, y si la campaña lo permite y sale muy mal, alguno no vuelve.
 *
 * @param {number} today
 */
function returnDispatches(today) {
    if (!chat_metadata) return;
    const { due, away } = dispatchesDue(chat_metadata[DISPATCHES_KEY], today);
    if (due.length === 0) return;
    chat_metadata[DISPATCHES_KEY] = away;
    const seed = String(chat_metadata?.[METADATA_KEY] || '');
    const survival = currentSurvival();
    for (const dispatch of due) {
        const random = createSeededRandom(derive(seed, 'despacho', dispatch.id));
        const result = resolveDispatch({ dispatch, random, allowDeath: survival.mortality === 'everyone' });
        for (const member of dispatch.members) {
            if (String(member.id) === result.dead) {
                member.dead = true;
                member.hp = 0;
                countStat('deaths');
                buryMember(member, today, getCampaignBonds());
            } else if (String(member.id) === result.hurt && survival.injuries) {
                const patch = applyInjury(member, rollInjury(() => random() * 0.4));
                member.injuries = patch.injuries;
                member.baseStats = patch.baseStats;
                Object.assign(member, patch.stats);
            }
            partyMembers.push(member);
        }
        if (result.success) finishDispatchedContract(dispatch.contract);
        else void shiftPlaceFortune(String(dispatch.contract?.locationName ?? ''), -1);
        postCombatNarration(`🧭 [GREMIO] ${result.line}`);
        noteDeed(result.line);
    }
    savePartyState();
    renderPartyMembers();
    saveMetadata();
    if (isShellOpen()) refreshGameShell();
}

/**
 * U8: un encargo cumplido sin el héroe: se cobra, sube la reputación y el sitio lo nota.
 *
 * @param {any} contract
 */
function finishDispatchedContract(contract) {
    const guild = getGuild();
    const done = completeContract(guild, contract);
    const holder = partyMembers.find(m => (m.hp || 0) > 0) ?? partyMembers[0];
    if (holder) holder.gold = (Number(holder.gold) || 0) + done.gold;
    guild.renown = done.renown;
    chat_metadata[GUILD_KEY] = guild;
    countStat('contracts');
    countStat('gold', Number(done.gold) || 0);
    void shiftPlaceFortune(String(contract?.locationName ?? ''), 1);
}

/** U8 del pegamento: los casos con verdad. */
const CASES_KEY = 'cases';
/** U6 del pegamento: con quién se ha tenido ya un duelo hoy. */
const DUELS_KEY = 'duels';
/** Ideas 69 y 70: dónde se ha estado, y las notas del mapa. */
const VISITED_KEY = 'visited';
const MAP_NOTES_KEY = 'mapNotes';

/**
 * U8: empezar un caso con la gente y los sitios del mundo. Cada semana, a veces; o cuando
 * se pide. Solo si sale uno que se pueda resolver.
 *
 * @param {boolean} force
 * @returns {Promise<boolean>}
 */
async function startCase(force) {
    if (!chat_metadata) return false;
    // R1: los casos son del mundo que se mueve (letra c).
    if (!hasLetter(survivalNow(), 'c')) {
        if (force) toastr.info('En este modo el mundo no se mueve solo: no hay casos. Se enciende con «El mundo se mueve» en /modo.', 'El caso');
        return false;
    }
    const state = readCases(chat_metadata[CASES_KEY]);
    if (state.active) return false;
    const seed = String(chat_metadata?.[METADATA_KEY] || '');
    const random = createSeededRandom(derive(seed, 'caso', String(campaignDay()), String(state.closed.length)));
    if (!force && random() >= CASE_CHANCE.weekly) return false;
    const people = lastWorldNpcs.filter(n => !n.dead && n.name).map(n => ({ name: n.name, place: n.where }));
    const places = getCurrentWorldLocationMaps().map(l => String(l?.name ?? '')).filter(Boolean);
    // Nunca muere quien necesita el hilo ni quien atiende un servicio (idea 87).
    const protectedNames = [...plotPeople(), ...lastWorldNpcs.filter(n => n.service).map(n => n.name)];
    const mystery = generateCase({ people, places, random, day: Math.max(1, campaignDay()), protectedNames });
    if (!mystery || !checkCase(mystery).ok) {
        if (force) toastr.info('Este mundo aún no tiene gente suficiente para un caso: hacen falta seis personas.', 'El caso');
        return false;
    }
    chat_metadata[CASES_KEY] = { ...state, active: mystery, found: [] };
    saveMetadata();
    // Un asesinato deja a alguien menos en el mundo: el narrador tiene que saberlo.
    if (mystery.kind === 'asesinato') {
        await worldWrite(async () => {
            const worldName = String(chat_metadata?.[METADATA_KEY] || '');
            const data = await loadWorldInfo(worldName);
            if (!data) return;
            applyFate(data, { name: mystery.victim, kind: 'muere', from: mystery.place, to: '', why: 'a manos de alguien' });
            await saveWorldInfo(worldName, data, true);
        });
    }
    postCombatNarration(`🔎 [CASO] ${mystery.title}: pasó en ${mystery.place}, el día ${mystery.day}. Está en la mesa y en /caso.`);
    void postForModel(`[CASO] En ${mystery.place} ha pasado algo: ${mystery.title.toLowerCase()}. Nadie sabe todavía quién fue. `
        + 'Cuéntalo en dos frases, como se comenta en el pueblo. No sabes quién fue: no lo insinúes ni inventes pistas.');
    if (isShellOpen()) refreshGameShell();
    return true;
}

/**
 * U8: una tirada del mejor del grupo para esto, contra 12.
 *
 * @param {string} skill
 * @returns {boolean}
 */
function caseRoll(skill) {
    const who = partyMembers.filter(m => !m.dead && (Number(m.hp) || 0) > 0)
        .reduce((/** @type {any} */ best, m) => (!best || skillModifier(m, skill).modifier > skillModifier(best, skill).modifier ? m : best), null);
    if (!who) return false;
    const roll = rollCheck({ member: who, skill, rollD20: () => rollDiceDetailed('1d20', 20).total, dc: 12 });
    if (roll) postCombatNarration(roll.said);
    return Boolean(roll?.success);
}

/**
 * U8: una pista encontrada: al diario del caso y al chat, a 0 tokens.
 *
 * @param {import('./game-engine/campaign/cases.js').CaseClue} clue
 */
function revealClue(clue) {
    const state = readCases(chat_metadata?.[CASES_KEY]);
    if (!state.active || state.found.includes(clue.id)) return;
    chat_metadata[CASES_KEY] = { ...state, found: [...state.found, clue.id] };
    saveMetadata();
    postCombatNarration(`🔎 [PISTA] ${clue.fact}`);
}

/**
 * U8: preguntarle a alguien por el caso. Lo que sabe a la vista se cuenta; lo que esconde,
 * se sonsaca (Perspicacia).
 *
 * @param {string} name
 * @returns {Promise<string>}
 */
async function askAboutCase(name) {
    const state = readCases(chat_metadata?.[CASES_KEY]);
    const clues = cluesHere(state, { person: String(name ?? '').trim() });
    if (!state.active || clues.length === 0) {
        toastr.info(`${name} no sabe nada más de eso.`, 'El caso');
        return '';
    }
    let got = 0;
    for (const clue of clues) {
        if (clue.how === 'sonsacar' && !caseRoll('insight')) continue;
        revealClue(clue);
        got++;
    }
    if (got === 0) postCombatNarration(`🔎 [PISTA] ${name} se calla lo que sabe. Otro día.`);
    if (isShellOpen()) refreshGameShell();
    return '';
}

/**
 * R4: Hablar con los muertos. En un asesinato, la víctima contesta una pregunta: una pista
 * de las que señalan de verdad (no las que despistan). Gasta la carga y el polvo de hueso.
 *
 * @returns {string}
 */
function askTheDead() {
    const state = readCases(chat_metadata?.[CASES_KEY]);
    if (!state.active || state.active.kind !== 'asesinato') {
        toastr.info('No hay ningún muerto a quien preguntar.', 'Hablar con los muertos');
        return '';
    }
    const caster = whoCan(partyMembers, 'deadTalk');
    const ability = caster ? getAbilityCatalogue().find(a => a.id === caster.id) : null;
    if (!caster || !ability) {
        toastr.info('Nadie del grupo sabe Hablar con los muertos, o no le quedan cargas.', 'Hablar con los muertos');
        return '';
    }
    if (ability.component && !carriedNames().map(n => n.toLowerCase()).includes(String(ability.component).toLowerCase())) {
        toastr.info(`Hace falta ${ability.component} (${COMPONENTS[/** @type {keyof typeof COMPONENTS} */ (ability.component)]?.from ?? 'se compra'}).`, 'Hablar con los muertos');
        return '';
    }
    const clue = state.active.clues.find(c => !c.misleading && !state.found.includes(c.id));
    const paid = payForSpell(caster.who, ability);
    postCombatNarration(`💀 [CASO] ${caster.who.name} le pregunta a ${state.active.victim}.${paid.length > 0 ? ` ${paid.join(' ')}` : ''}`);
    if (clue) revealClue(clue);
    else postCombatNarration(`💀 [CASO] ${state.active.victim} no tiene nada más que decir.`);
    for (const line of magicConsequences(ability)) postCombatNarration(line);
    savePartyState();
    if (isShellOpen()) refreshGameShell();
    return '';
}

/** U8: buscar pistas aquí. Cuesta un rato del día; lo que se registra pide Investigación. */
async function searchCaseHere() {
    const state = readCases(chat_metadata?.[CASES_KEY]);
    const clues = cluesHere(state, { place: currentLocationName });
    advanceCampaignSlot();
    let got = 0;
    for (const clue of clues) {
        // R5: el perro olfatea lo que otro tendría que registrar.
        const sniffed = clue.how === 'registrar' && petDoes(currentPet(), 'olfato');
        if (sniffed) postCombatNarration(`🐾 [MASCOTA] ${currentPet()?.name} olfatea algo y no se mueve de ahí.`);
        if (clue.how === 'registrar' && !sniffed && !caseRoll('investigation')) continue;
        revealClue(clue);
        got++;
    }
    if (got === 0) postCombatNarration(`🔎 [PISTA] Buscáis en ${currentLocationName}, pero hoy no sale nada.`);
    if (isShellOpen()) refreshGameShell();
}

/**
 * U8: acusar. Una vez: equivocarse cuenta.
 *
 * @param {{culprit: string, motive: string, method: string}} accusation
 * @returns {Promise<{verdict: string, line: string, reward: number}|null>}
 */
async function accuseCase(accusation) {
    const state = readCases(chat_metadata?.[CASES_KEY]);
    if (!state.active || !chat_metadata) return null;
    const mystery = state.active;
    const verdict = accuse(mystery, accusation);
    const reward = verdict.verdict === 'acierto' ? 60 : verdict.verdict === 'a-medias' ? 25 : 0;
    if (reward > 0) {
        const holder = partyMembers.find(m => (m.hp || 0) > 0) ?? partyMembers[0];
        if (holder) holder.gold = (Number(holder.gold) || 0) + reward;
        savePartyState();
        raiseFame(mystery.place);
    } else {
        void shiftPlaceFortune(mystery.place, -1);
    }
    // R9: quien manda donde pasó lo nota.
    void nudgeRuler(mystery.place, verdict.verdict === 'error' ? 'caso-fallo' : 'caso-acierto');
    chat_metadata[CASES_KEY] = { active: null, found: [], closed: [...state.closed, { id: mystery.id, title: mystery.title, verdict: verdict.verdict }] };
    saveMetadata();
    const told = verdict.verdict === 'error' ? `Acusasteis a ${accusation.culprit}, y no fue: quien lo hizo sigue suelto.` : verdict.line;
    noteDeed(`${mystery.title}: ${told}`);
    postCombatNarration(`⚖️ [CASO] ${verdict.line}${reward > 0 ? ` (${reward} de oro)` : ''}`);
    void postForModel(`${caseForNarrator(mystery, state.found)}
[CASO] El grupo acusa a ${accusation.culprit}. `
        + `${verdict.verdict === 'error' ? 'Se equivocan: no fue.' : verdict.verdict === 'a-medias' ? 'Fue, aunque no todo encaja.' : 'Aciertan.'} Cuéntalo en tres o cuatro frases.`);
    if (isShellOpen()) refreshGameShell();
    return { ...verdict, reward };
}

/** U8: el tablero del caso. */
async function openCaseBoard() {
    const { buildCaseBoard } = await import('./game-engine/ui/case-board.js');
    const state = readCases(chat_metadata?.[CASES_KEY]);
    const board = buildCaseBoard({
        state,
        onAccuse: (accusation) => {
            void accuseCase(accusation).then(result => {
                if (!result) return;
                const verdict = document.createElement('div');
                verdict.className = 'cb-verdict';
                verdict.dataset.verdict = result.verdict;
                verdict.textContent = `${result.line}${result.reward > 0 ? ` (${result.reward} de oro)` : ''}`;
                board.replaceChildren(verdict);
            });
        },
    });
    await new Popup(board, POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', wide: true, allowVerticalScrolling: true, leftAlign: true }).show();
}

/**
 * U6: si hoy aún se puede tener un duelo de palabras con alguien.
 *
 * @param {string} name
 * @returns {boolean}
 */
function canDuel(name) {
    return Number(chat_metadata?.[DUELS_KEY]?.[name]) !== Math.max(1, campaignDay());
}

/**
 * U6: convencer a alguien del mundo, en un duelo de palabras. Su postura sale de la semilla
 * (siempre la misma para la misma persona); su paciencia, de cómo os mira. Si cede, os mira
 * mejor. El narrador lo cuenta una vez.
 *
 * @param {string} name
 * @returns {Promise<string>}
 */
async function duelWith(name) {
    const npc = lastWorldNpcs.find(n => !n.dead && n.name.toLowerCase() === String(name ?? '').trim().toLowerCase());
    if (!npc || !chat_metadata) {
        toastr.info('No hay nadie así aquí.', 'Convencer');
        return '';
    }
    if (!canDuel(npc.name)) {
        toastr.info(`Con ${npc.name} ya hablasteis hoy: mañana.`, 'Convencer');
        return '';
    }
    const who = partyMembers.filter(m => (Number(m.hp) || 0) > 0 && !m.dead)
        .reduce((/** @type {any} */ top, m) => (!top || skillModifier(m, 'persuasion').modifier > skillModifier(top, 'persuasion').modifier ? m : top), null);
    if (!who) return '';
    const random = createSeededRandom(derive(String(chat_metadata?.[METADATA_KEY] || ''), 'postura', npc.name));
    const stances = Object.keys(DUEL_STANCES);
    const stance = stances[Math.floor(random() * stances.length) % stances.length];
    const value = Number(readAttitudes(chat_metadata?.[ATTITUDES_KEY]).values[npc.name]) || 0;
    const mystery = readCases(chat_metadata?.[CASES_KEY]);
    const bonds = getCampaignBonds();
    const hand = handFrom({
        modifiers: {
            persuasion: skillModifier(who, 'persuasion').modifier,
            deception: skillModifier(who, 'deception').modifier,
            intimidation: skillModifier(who, 'intimidation').modifier,
        },
        evidence: mystery.active ? mystery.active.clues.filter(c => mystery.found.includes(c.id)).map(c => c.fact) : [],
        favors: readFactions(currentWorldFactions).filter(f => Number(f.reputation) >= 2).map(f => f.name),
        purse: partyPurse(),
        companions: partyMembers.filter(m => m !== who && !m.dead).map(m => ({ name: String(m.name), rank: getBondProgress(bonds, String(m.id)).rank })),
        // R3: una burla o una palabra de ánimo, si quien habla las sabe. R5: y la mascota con labia.
        tricks: [...duelTricks(who), ...petTricks()],
    });
    const what = `que ${npc.name} os mire mejor`;
    const final = await playDuel({ npc: { name: npc.name, stance }, patience: Math.max(3, Math.min(11, 7 - 2 * value)), hand, rounds: 3, speaker: String(who.name), what });
    chat_metadata[DUELS_KEY] = { ...(chat_metadata[DUELS_KEY] ?? {}), [npc.name]: Math.max(1, campaignDay()) };
    if (final.spent > 0) payFromParty(Math.min(final.spent, partyPurse()));
    const outcome = duelOutcome(final) ?? 'no-cede';
    if (outcome === 'cede') changeAttitude(npc.name, 1, 'le convencisteis');
    saveMetadata();
    postCombatNarration(`🗣️ [DUELO] ${who.name} habla con ${npc.name}: ${outcome === 'cede' ? 'cede' : outcome === 'a-medias' ? 'cede a medias' : 'no cede'}.`);
    void postForModel(duelPrompt(final, what));
    if (isShellOpen()) refreshGameShell();
    return '';
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
    const body = $('<div class="tm-root"></div>');
    body.append($('<h3></h3>').text('El mapa'));
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

/** U5 del pegamento: la mesa de la semana. */
const WEEK_TABLE_KEY = 'weekTable';
/** Si se abre sola cada semana (ajuste); si no, solo la primera vez y luego un aviso (DU4). */
const WEEK_TABLE_AUTO_KEY = 'weekTableAuto';

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
    postCombatNarration(`📋 [PARTIDA] Empieza la semana ${week}: la mesa, con lo que no cabe entero, está en su botón.`);
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
    const body = $('<div class="wt-root"></div>');
    body.append($('<h3></h3>').text(`Semana ${weekNumber(today)} · ${describeSeason(today, lastWorldSeason || undefined)}`));
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
    await new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'A la semana', allowVerticalScrolling: true, leftAlign: true }).show();
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

/** Donde se apunta el clima del sitio donde estais. */
const CLIMATE_KEY = 'climate';

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
        partyMembers = partyMembers.filter(m => !loyalty.leaving.includes(String(m.name)));
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

/** Donde se apunta lo que se debe, y a quien. */
const DEBT_KEY = 'debt';

/** Lo que el grupo ha hecho y el mundo ha visto. */
const DEEDS_KEY = 'deeds';

/**
 * Apuntar un hecho, con el dia de hoy.
 *
 * @param {string} text
 */
function noteDeed(text) {
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

/** U0 del pegamento: el diario de sesión, en esta pestaña. */
const SESSION_LOG_KEY = 'sillytavern_gameSession';
/** @type {import('./game-engine/campaign/session-log.js').SessionLog|null} */
let sessionLog = null;

/** @returns {import('./game-engine/campaign/session-log.js').SessionLog} */
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

/** @param {import('./game-engine/campaign/session-log.js').SessionLog} next */
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
    const { getSession } = await import('./game-engine/ui/prompt-preview.js');
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
 * R4: usar un pergamino o una varita: el conjuro sale del objeto, sin gastar cargas del
 * círculo ni componentes de quien lo usa. El pergamino se gasta; la varita pierde una carga.
 *
 * @param {string} itemId
 * @param {string} targetId
 * @returns {string}
 */
function useMagicItem(itemId, targetId) {
    const member = getCurrentActingMember();
    if (!member || !combatEncounter.active) return '';
    const item = (Array.isArray(member.items) ? member.items : []).find((/** @type {any} */ i) => String(i.id) === String(itemId));
    const spec = item ? MAGIC_ITEMS[String(item.name)] : null;
    const ability = spec ? getAbilityCatalogue().find(a => a.id === spec.spell) : null;
    if (!item || !ability || !hasAction(combatEncounter, 'action')) return '';
    const subject = ability.target === 'self' ? member
        : ability.target === 'ally' ? partyMembers.find(m => String(m.id) === String(targetId))
            : getEnemyByInstanceId(String(targetId));
    if (!subject) return '';
    Object.assign(combatEncounter, useAction(combatEncounter, 'action'));
    const lines = [`📜 ${member.name} usa ${item.name}.`, ...resolveAbilityOnBoard({ actor: member, side: 'party', ability, subject })];
    const after = afterUse(item);
    if (after.remove) removeItemFromInventory(/** @type {any} */ (member), String(item.id));
    else /** @type {any} */ (item).charges = after.charges;
    lines.push(after.line, ...magicConsequences(ability));
    saveCombatState();
    savePartyState();
    postCombatNarration(lines.join('\n'));
    renderPartyMembers();
    renderLocationMapsPreview();
    if (!checkScenarioOutcome() && getAliveEnemies().length === 0 && !judgeCurrentScenario()) {
        postCombatNarration('🏆 [COMBAT] Todos los enemigos han sido derrotados.');
        endCombat('victory');
    }
    return item.name;
}

/**
 * R4: aprender el conjuro de un pergamino, si se ha estudiado (el mago y el erudito). El
 * pergamino se gasta.
 *
 * @param {string} name Del pergamino, o vacío para el primero que haya.
 * @returns {string}
 */
function learnFromScroll(name) {
    for (const member of partyMembers.filter(m => !m.dead)) {
        const item = (Array.isArray(member.items) ? member.items : []).find((/** @type {any} */ i) => MAGIC_ITEMS[String(i.name)]?.kind === 'scroll'
            && (!name || String(i.name).toLowerCase().includes(String(name).toLowerCase())));
        if (!item) continue;
        const verdict = canLearnScroll(member, item);
        if (!verdict.ok) continue;
        member.abilities = [...new Set([...(Array.isArray(member.abilities) ? member.abilities.map(String) : []), verdict.spell])];
        removeItemFromInventory(/** @type {any} */ (member), String(item.id));
        savePartyState();
        renderPartyMembers();
        const line = `${member.name} estudia ${item.name} hasta sabérselo: ya sabe ${spellById(verdict.spell)?.name ?? verdict.spell}.`;
        postCombatNarration(`📜 [APRENDIZAJE] ${line}`);
        noteDeed(line);
        return line;
    }
    toastr.info('Nadie del grupo puede aprender de un pergamino ahora: hace falta haber estudiado (el mago o el erudito), y no sabérselo ya.', 'Pergaminos');
    return '';
}

/**
 * R4: el grimorio del grupo, en un cuadro. Solo lee.
 */
async function openGrimoire(all = false) {
    const body = $('<div class="jr-root gr-root"></div>');
    body.append($('<h3></h3>').text(all ? 'Toda la magia que existe' : 'El grimorio'));
    // R10: la lista entera, por círculos: no se crea, se consulta.
    if (all) {
        for (const circle of [0, 1, 2, 3]) {
            body.append($('<div class="jr-title"></div>').text(CIRCLE_LABELS[/** @type {0|1|2|3} */ (circle)].replace(/^./, c => c.toUpperCase())));
            for (const spell of SPELLS.filter(s => s.circle === circle)) {
                body.append($('<div class="jr-item gr-spell"></div>').attr('data-spell', spell.id).attr('title', spell.note).text(`${describeSpell(spell)} · ${spell.id}`));
            }
        }
        await new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', allowVerticalScrolling: true, leftAlign: true }).show();
        return;
    }
    const casters = partyMembers.filter(m => !m.dead && knownSpells(m).length > 0);
    if (casters.length === 0) {
        body.append($('<div class="jr-item"></div>').text('Nadie del grupo hace magia. En este mundo, la única que existe es la del grimorio.'));
    }
    const carried = carriedNames().map(n => n.toLowerCase());
    for (const member of casters) {
        body.append($('<div class="jr-title"></div>').text(`${member.name}${describeCharges(member) ? ` · ${describeCharges(member)}` : ''}`));
        for (const spell of knownSpells(member)) {
            const missing = spell.component && !carried.includes(spell.component.toLowerCase()) ? ` (falta ${spell.component.toLowerCase()})` : '';
            body.append($('<div class="jr-item gr-spell"></div>').attr('data-spell', spell.id).attr('title', spell.note).text(`${describeSpell(spell)}${missing}`));
        }
    }
    const schools = Object.values(SCHOOLS).map(s => `${s.label}: ${s.note}`).join(' · ');
    body.append($('<div class="jr-item gr-schools"></div>').text(schools));
    await new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', allowVerticalScrolling: true, leftAlign: true }).show();
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
    const { openModePanel } = await import('./game-engine/ui/mode-panel.js');
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
    const { openStatePanel } = await import('./game-engine/ui/state-panel.js');
    await openStatePanel({ metadata: chat_metadata ?? {}, Popup, POPUP_TYPE });
}

/**
 * U3 del pegamento: lo que viene, de todos los relojes a la vez.
 *
 * @param {number} today
 * @returns {import('./game-engine/campaign/upcoming.js').Upcoming[]}
 */
function whatComes(today) {
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
function leavingMembers() {
    if (!chat_metadata?.[LEAVE_ON_KEY]) return [];
    const warned = Array.isArray(chat_metadata[WARNED_KEY]) ? chat_metadata[WARNED_KEY].map(String) : [];
    return partyMembers.filter(m => !m.dead && warned.includes(String(m.id)));
}

/** El hilo de la campana, y por donde va. */
const PLOT_KEY = 'plot';
const PLOT_STATE_KEY = 'plotState';
/** Si la mecha ya se ha contado. */
const PLOT_ANNOUNCED_KEY = 'plotAnnounced';

/** @returns {import('./game-engine/campaign/plot.js').Plot|null} */
function getPlot() {
    return readPlot(chat_metadata?.[PLOT_KEY]);
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
 * @param {any} event
 */
function notePlot(event) {
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
    postCombatNarration(`📜 [HILO] Se cierra el acto ${closed}. ${summary}`);
    if (range) {
        try {
            const { hideChatMessageRange } = await import('./chats.js');
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
 * @param {import('./game-engine/campaign/plot.js').PlotStep} step
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
        // Idea 200: la partida en numeros, al cerrar.
        const numbers = $('<div class="st-root"></div>');
        numbers.append($('<h3></h3>').text(`Final: ${ending?.title || endingId}`));
        for (const line of statsLines()) numbers.append($('<div class="jr-item"></div>').text(line));
        // Idea 111: los secretos encontrados, y cuántos había.
        const secrets = secretsOf(getPlot(), chat_metadata?.[PLOT_STATE_KEY]);
        if (secrets.total > 0) numbers.append($('<div class="jr-item"></div>').text(`Secretos de la historia: ${secrets.found.length} de ${secrets.total}`));
        // Idea 109: qué fue de cada uno.
        const bondsNow = getCampaignBonds();
        const epilogues = companionEpilogues({
            party: partyMembers,
            ranks: Object.fromEntries(partyMembers.map(m => [String(m.id), getBondProgress(bondsNow, String(m.id)).rank])),
            ending: String(ending?.title || endingId),
            graves: readGraves(chat_metadata?.[GRAVES_KEY]),
        });
        if (epilogues.length > 0) {
            numbers.append($('<h4></h4>').text('Qué fue de cada uno'));
            for (const line of epilogues) numbers.append($('<div class="jr-item ep-line"></div>').text(line));
            lines.push(`Qué fue de cada uno: ${epilogues.join(' ')}`);
        }
        void new Popup(numbers[0], POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', leftAlign: true }).show();
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
function revealLocations(names) {
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
async function hearRumor() {
    await ensureWorldData();
    if (combatEncounter.active) {
        toastr.warning('No en mitad de un combate.');
        return '';
    }
    const heard = Array.isArray(chat_metadata?.[RUMORS_HEARD_KEY]) ? chat_metadata[RUMORS_HEARD_KEY] : [];
    // R9: primero lo que se cuenta de vosotros, luego lo del guion.
    const played = rumorsFromPlay(chronicleOf(Array.isArray(chat) ? chat : []), { told: heard })
        .map(r => ({ id: r.id, text: r.text, where: currentLocationName, by: 'Alguien en la taberna', truth: '', leadsTo: '' }));
    const rumor = nextRumor({ rumors: [...played, ...lastRumors], here: currentLocationName, heard });
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

/** Lo que el narrador ha propuesto y nadie ha ido a buscar todavia. */
const PROPOSALS_KEY = 'placeProposals';
/** Cuantas veces se ha explorado: es parte de la semilla del siguiente hallazgo. */
const EXPLORED_KEY = 'explored';

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
function hereLocation() {
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
function worldWrite(task) {
    const run = worldWriteQueue.then(task, task);
    worldWriteQueue = run.catch(() => undefined);
    return run;
}

/** Los avisos del juego, guardados para la bandeja (idea 159). */
/** @type {import('./game-engine/ui/shell/notices.js').Notice[]} */
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
    const body = $('<div class="nt-root"></div>');
    body.append($('<h3></h3>').text('Avisos'));
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
    const body = $('<div class="pg-root"></div>');
    body.append($('<h3></h3>').text('El grupo'));
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
function raiseFame(place, amount = 1) {
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
function deliverRelics(event) {
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

/** El dia en que se oyo cada rumor (idea 91). */
const RUMORS_HEARD_ON_KEY = 'rumorsHeardOn';
/** Los prisioneros que lleva el grupo (idea 7). */
const PRISONERS_KEY = 'prisoners';
/** Los d20 que ha tirado el motor (idea 168). */
const DICE_LOG_KEY = 'diceLog';
/** El regateo de hoy (idea 126): donde, que dia y si salio. */
const HAGGLE_KEY = 'haggle';
/** Las cartas que esperan, y las ya mandadas (idea 113). */
const LETTERS_KEY = 'letters';
const LETTERS_SENT_KEY = 'lettersSent';
/** La ultima fiesta contada (idea 89): para no contarla dos veces el mismo dia. */
const FESTIVAL_TOLD_KEY = 'festivalTold';
/** La partida en numeros (idea 200). */
const STATS_KEY = 'stats';
/** El largo de la narracion elegido en la partida (idea 149). */
const LENGTH_KEY = 'narrationLength';
/** Las tumbas de quien ha muerto, con su epitafio (idea 36). */
const GRAVES_KEY = 'graves';
/** La fama del grupo, sitio a sitio (idea 52). */
const FAME_KEY = 'fame';
/** Las reliquias ya entregadas (idea 132): cada una llega una vez. */
const RELICS_GIVEN_KEY = 'relicsGiven';
/** Lo que ya han dicho los confidentes al llegar a cada sitio (idea 45). */
const ARRIVALS_HEARD_KEY = 'arrivalsHeard';
/** Los secretos de la gente: los sabidos y los intentos de hoy (idea 110). */
const SECRETS_KEY = 'npcSecrets';
/** Las monturas del grupo (idea 129). */
const MOUNTS_KEY = 'mounts';
/** Las partidas de dados de hoy en la taberna (idea 128). */
const DICE_GAME_KEY = 'tavernDice';
/** La letra del narrador (idea 195). */
const NARRATOR_FONT_KEY = 'narratorFont';
/** El tiempo de hoy donde se está, cuando se sabe por el viaje (ideas 73 y 90). */
const WEATHER_TODAY_KEY = 'weatherToday';
// Batería 7: lo que les parece a los compañeros (28, 32), a quién se le ofreció ya su
// encargo (30) y quién se queda en casa (42).
const APPROVAL_KEY = 'approval';
const PERSONAL_ASKED_KEY = 'personalAsked';
const BENCH_KEY = 'bench';
// Idea 139: lo que el narrador ofrece coger.
const OFFERS_KEY = 'itemOffers';
// Idea 142: el tono de la escena, elegido en la pausa.
const TONE_KEY = 'sceneTone';
// Batería 8: la red de seguridad (25), quién ya avisó que se va (29), dónde os buscan (96) y
// el almacén del gremio (124).
const SAFETY_KEY = 'safety';
const SAFETY_ON_KEY = 'safetyNet';
const LEAVE_ON_KEY = 'companionsLeave';
const WARNED_KEY = 'departWarned';
const WANTED_KEY = 'wanted';
const STORAGE_KEY = 'guildStorage';
// Batería 8: las escenas del villano ya contadas (115), la actitud de la gente (140), los
// resúmenes de cada acto y dónde empezó cada uno en el chat (143), y si el hilo ya se adaptó
// al héroe (184).
const VILLAIN_SEEN_KEY = 'villainSeen';
const ATTITUDES_KEY = 'attitudes';
const ACT_SUMMARIES_KEY = 'actSummaries';
const ACT_STARTS_KEY = 'actStarts';
const HERO_FIT_KEY = 'heroFit';
/** Idea 183: los ajustes de ilustraciones son de esta máquina (llevan una clave). */
const ART_STORAGE = 'sillytavern_illustrations';

/** Con quién se está hablando, para las respuestas sugeridas (idea 144). */
let talkingTo = '';
/** Lo último que gritó un jefe al contestar (idea 24). */
let lastBossLine = '';
/** Si alguien acaba de caer al vacío, para dejar ver la caída (idea 189). */
let fellThisTurn = false;

/** Lo que se guarda en este navegador, sin que falle si no se puede. */
const localFlag = {
    /** @param {string} key @returns {string} */
    get(key) {
        try { return String(globalThis.localStorage?.getItem(key) ?? ''); } catch { return ''; }
    },
    /** @param {string} key @param {string} value */
    set(key, value) {
        try { globalThis.localStorage?.setItem(key, value); } catch { /* sin almacenamiento: se juega igual */ }
    },
};
/** Idea 148: el modo ahorro, en este navegador. */
const SAVER_KEY = 'sillytavern_gameSaver';
/** Idea 172: los colores para daltonismo, en este navegador. */
const COLORBLIND_KEY = 'sillytavern_gameColorblind';
/** Idea 155: los consejos ya vistos, en este navegador. */
const TIPS_SEEN_KEY = 'sillytavern_gameTipsSeen';

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
function countStat(key, amount = 1) {
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

/**
 * Idea 155: un consejo, la primera vez que aparece cada cosa.
 *
 * @param {string} situation
 */
function showTip(situation) {
    const seen = localFlag.get(TIPS_SEEN_KEY).split(',').filter(Boolean);
    const tip = tipFor(situation, seen);
    if (!tip) return;
    localFlag.set(TIPS_SEEN_KEY, [...seen, tip.id].join(','));
    toastr.info(tip.text, 'Consejo', { timeOut: 12000 });
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

/** Lo que dice el duelo al acabar. */
const DUEL_OUTCOMES = { 'cede': 'Cede.', 'a-medias': 'Cede a medias.', 'no-cede': 'No cede.' };

/**
 * U6 del pegamento: jugar un duelo de palabras en un cuadro, ronda a ronda.
 *
 * @param {Object} input
 * @param {{name: string, stance: string}} input.npc
 * @param {number} input.patience
 * @param {import('./game-engine/campaign/word-duel.js').Argument[]} input.hand
 * @param {number} input.rounds
 * @param {string} input.speaker
 * @param {string} input.what
 * @returns {Promise<import('./game-engine/campaign/word-duel.js').DuelState>}
 */
function playDuel({ npc, patience, hand, rounds, speaker, what }) {
    let state = startDuel({ npc, patience, hand, rounds });
    const body = $('<div class="wd-root"></div>');
    const render = () => {
        body.empty();
        const stance = DUEL_STANCES[state.npc.stance];
        body.append($('<h3></h3>').text(`${speaker} habla con ${state.npc.name}`));
        body.append($('<p class="wd-goal"></p>').text(`Para ${what}.`));
        body.append($('<p class="wd-stance"></p>').text(`Está ${stance.label}: ${stance.note}`));
        body.append($('<div class="wd-meters"></div>').text(`Su paciencia: ${state.patience} · Tu compostura: ${state.composure} · Ronda ${state.round} de ${state.rounds}`));
        for (const line of state.log) body.append($('<div class="wd-log"></div>').text(line));
        const outcome = duelOutcome(state);
        if (outcome) {
            body.append($('<div class="wd-outcome"></div>').attr('data-outcome', outcome).text(DUEL_OUTCOMES[outcome]));
            return;
        }
        const cards = $('<div class="wd-cards"></div>');
        for (const argument of state.hand) {
            const signed = (/** @type {number} */ n) => `${n >= 0 ? '+' : ''}${n}`;
            const card = $('<button type="button" class="menu_button wd-card"></button>')
                .attr('data-id', argument.id)
                .prop('disabled', state.used.includes(argument.id))
                .text(argument.skill ? `${argument.label} (${signed(Number(argument.modifier) || 0)})` : argument.label);
            card.on('click', () => {
                state = playArgument(state, argument.id, () => rollDiceDetailed('1d20', 20).total).state;
                // R4: una carta de conjuro gasta la carga de quien habla.
                const spell = argument.spell ? spellById(String(argument.spell)) : null;
                const caster = spell ? partyMembers.find(m => String(m.name) === speaker) : null;
                if (spell && caster) {
                    caster.spellCharges = spendCharge(caster, spell.circle);
                    savePartyState();
                }
                render();
            });
            cards.append(card);
        }
        body.append(cards);
    };
    render();
    return new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Hecho', allowVerticalScrolling: true }).show().then(() => {
        // R4: un Encanto que no sale bien se nota: os tiene ganas.
        const risky = state.hand.some(a => a.risky && state.used.includes(a.id));
        if (risky && duelOutcome(state) !== 'cede') changeAttitude(state.npc.name, -1, 'se ha dado cuenta del encanto');
        return state;
    });
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
    const note = RETRY_NOTES[/** @type {keyof typeof RETRY_NOTES} */ (mode)] ?? '';
    const key = promptKey('combat', 'retry', 'ctx');
    setExtensionPrompt(key, note, extension_prompt_types.IN_PROMPT, 0, false, extension_prompt_roles.SYSTEM);
    try {
        const { executeSlashCommandsWithOptions } = await import('./slash-commands.js');
        await executeSlashCommandsWithOptions('/regenerate await=true');
    } finally {
        // Una vez y ya: la siguiente respuesta vuelve a ser la de siempre.
        setExtensionPrompt(key, '', extension_prompt_types.IN_PROMPT, 0, false, extension_prompt_roles.SYSTEM);
    }
}

/** Idea 168: el historial de dados, con sus cuentas. */
function openDiceHistory() {
    const stats = diceStats(chat_metadata?.[DICE_LOG_KEY]);
    const body = $('<div class="dl-root"></div>');
    body.append($('<h3></h3>').text('Los dados'));
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

/** Las pistas del hilo: cuando se abrio cada hito, que nivel se ha dado y cuales. */
const HINTS_KEY = 'threadHints';
/** Las tiradas que ha pedido el narrador y esperan a que se tiren (idea 138). */
const CHECK_REQUESTS_KEY = 'checkRequests';

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
    const body = $('<div class="jr-root"></div>');
    body.append($('<h3></h3>').text('Diario'));
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
        places: getCurrentWorldLocationMaps().filter(l => l.name !== currentLocationName).length,
        fighting: Boolean(combatEncounter.active),
    });
    const body = $('<div class="hp-root"></div>');
    body.append($('<h3></h3>').text('¿Qué puedo hacer aquí?'));
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

/** Las noticias que esperan a que el grupo llegue a donde se oyen (idea 82). */
const NEWS_KEY = 'newsPending';

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
function shiftPlaceFortune(place, delta) {
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

/** @returns {import('./game-engine/campaign/recruit.js').Recruit[]} */
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
function tellBondScene(member, rank) {
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
function rememberTogether(text, who) {
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
function voiceOpinions(contract) {
    const said = partyMembers.slice(1)
        .filter(m => !m.dead && (Number(m.hp) || 0) > 0)
        .map(m => ({ member: m, opinion: opinionOf(readReasons(m).wants, contract, { last: lastOpinion.get(String(m.id)) ?? '' }) }))
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
 * Idea 58: rehacerse en el templo. Se deshacen las mejoras y se eligen otras tantas, las que
 * se quieran de la lista entera. Se paga al confirmar.
 *
 * @param {string} memberId
 * @returns {Promise<void>}
 */
async function respecMember(memberId) {
    const member = partyMembers.find(m => String(m.id) === String(memberId));
    if (!member) return;
    const cost = respecCost(member);
    const had = perksOf(member).map(p => p.id);
    const body = $('<div class="rs-root"></div>');
    body.append($('<h3></h3>').text(`Rehacer a ${member.name}`));
    body.append($('<p></p>').text(`Elige ${had.length}, las que quieras. Cuesta ${cost} de oro.`));
    const list = $('<div class="rs-perks"></div>');
    for (const perk of PERKS) {
        const box = $('<input type="checkbox" class="rs-perk">').attr('value', perk.id).prop('checked', had.includes(perk.id));
        list.append($('<label class="rs-perk-row"></label>').append(box).append($('<span></span>').text(` ${perk.label}: ${perk.describe}`)));
    }
    body.append(list);
    const ok = await new Popup(body[0], POPUP_TYPE.CONFIRM, '', { okButton: 'Rehacer', cancelButton: 'Dejarlo' }).show();
    if (!ok) return;
    const chosen = body.find('.rs-perk:checked').map((_, el) => String($(el).val())).get();
    const redone = redoPerks(member, chosen);
    if (!redone.ok || !redone.patch) {
        toastr.warning(redone.reason, 'Rehacerse');
        return;
    }
    if (!payFromParty(cost)) {
        toastr.warning(`No llega el oro: cuesta ${cost}.`);
        return;
    }
    Object.assign(member, redone.patch);
    savePartyState();
    renderPartyMembers();
    const line = `${member.name} se rehace en el templo: ${perksOf(member).map(p => p.label).join(', ')}.`;
    postCombatNarration(`🕯️ [TEMPLO] ${line}`);
    toastr.success(line, 'Rehacerse');
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
    else if (actionId === 'inn-talk') draftInChat(`Le digo a ${action.target}: `);
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
function bark(member, event, about = '') {
    if (!member || String(member.id) === String(partyMembers[0]?.id)) return;
    const line = chooseBark({ event, wants: readReasons(member).wants, about, last: lastBark, random: Math.random });
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
function dropBoardKey() {
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
function judgeDecision(decision, { verdicts = undefined, quiet = false } = {}) {
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
function plotPeople() {
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
 * @param {import('./game-engine/world/people-fate.js').Fate} fate
 */
function applyFate(data, fate) {
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
function changeAttitude(name, delta, why) {
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
    const ui = await import('./game-engine/ui/world-workshop.js');
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
        partyMembers = partyMembers.filter(m => m !== member);
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
 * Idea 94: la compañía rival de este mundo, siempre la misma.
 *
 * @returns {{name: string, leader: string}}
 */
function currentRival() {
    return rivalOf(createSeededRandom(derive(String(chat_metadata?.[METADATA_KEY] || ''), 'rivales')));
}

/**
 * Idea 94: cada semana, los rivales se llevan el mejor encargo generado del tablón.
 */
function rivalsMove() {
    if (!chat_metadata || !chat_metadata[METADATA_KEY]) return;
    const { taken, board } = rivalsTake(chat_metadata[BOARD_KEY]);
    if (!taken) return;
    chat_metadata[BOARD_KEY] = board;
    saveMetadata();
    const line = describeRivalTake(currentRival(), taken);
    postCombatNarration(`⚔️ [GREMIO] ${line}`);
    toastr.info(line, 'Los rivales', { timeOut: 9000 });
    void postForModel(`[RIVALES] ${line} Cuéntalo como algo que se comenta en el gremio, en una frase.`);
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
function partyMorale() {
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
 * Si algo le tiene sujeto en su sitio (agarrado o apresado).
 *
 * @param {any} creature
 * @returns {boolean}
 */
function heldInPlace(creature) {
    const said = (Array.isArray(creature?.activeConditions) ? creature.activeConditions : []).map((/** @type {string} */ c) => String(c).toLowerCase());
    return said.includes('grappled') || said.includes('restrained');
}

/**
 * El id de ficha de un enemigo en el tablero: los enemigos van en negativo, por orden.
 *
 * @param {any} enemy
 * @returns {number}
 */
function enemyTokenId(enemy) {
    return -(combatEncounter.enemies.indexOf(enemy) + 1);
}

/** Lo ultimo que grito cada enemigo, para no repetirlo. */
let lastEnemyBark = '';

/**
 * Idea 190: un enemigo grita algo, a veces. Sin llamar al modelo.
 *
 * @param {any} enemy
 * @param {'hit'|'hurt'|'ally_down'|'surrender'} event
 */
function enemyBark(enemy, event) {
    if (!enemy) return;
    const line = chooseEnemyBark({ event, profile: enemy.profile, boss: Boolean(enemy.boss), last: lastEnemyBark, random: Math.random });
    if (!line) return;
    lastEnemyBark = line;
    postCombatNarration(`🗯️ ${enemy.name}: «${line}»`);
    floatOnToken(enemyTokenId(enemy), line, 'bark');
}

/**
 * Idea 188: algo que sale flotando de una ficha (daño, un grito). Se pinta un poco despues,
 * cuando el tablero ya se ha redibujado con el golpe.
 *
 * @param {number|string} tokenId
 * @param {string} text
 * @param {'damage'|'crit'|'heal'|'bark'} kind
 */
function floatOnToken(tokenId, text, kind) {
    setTimeout(() => {
        const token = [...document.querySelectorAll('.wm-token')]
            .find(t => t instanceof HTMLElement && t.dataset.tokenId === String(tokenId) && t.offsetParent);
        if (!token) return;
        const node = document.createElement('div');
        node.className = kind === 'bark' ? 'wm-bark wm-bark-enemy' : `wm-float wm-float-${kind}`;
        node.textContent = text;
        token.appendChild(node);
        setTimeout(() => node.remove(), kind === 'bark' ? 2600 : 1400);
    }, 250);
}

/**
 * Ideas 44 y 47: apuntar una hazaña, y contar si trae apodo o rasgo nuevo.
 *
 * @param {any} member
 * @param {'kill'|'crit'|'downed'|'rescue'|'hit'} kind
 * @param {string} [about]
 */
function recordFeat(member, kind, about = '') {
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

/**
 * Si el grupo tiene flanqueado a este enemigo desde la casilla de este miembro.
 *
 * @param {any} member
 * @param {any} enemy
 * @returns {boolean}
 */
function partyFlanks(member, enemy) {
    const cell = (/** @type {any} */ m) => ({ x: Number(m?.mapPosition?.gridX) || 0, y: Number(m?.mapPosition?.gridY) || 0 });
    return flankedFrom(cell(member), { x: Number(enemy.gridX) || 0, y: Number(enemy.gridY) || 0 },
        getLivingPartyMembers().filter(m => String(m.id) !== String(member.id)).map(cell));
}

/**
 * Idea 3: si quien ataca tiene a un compañero suyo pegado al objetivo por el otro lado.
 *
 * @param {{x: number, y: number}} from
 * @param {{x: number, y: number}} at
 * @param {Array<{x: number, y: number}>} friends
 * @returns {boolean}
 */
function flankedFrom(from, at, friends) {
    return isFlanked(from, at, friends);
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
 * @param {import('./game-engine/campaign/plot.js').Plot} plot
 * @returns {Promise<void>}
 */
async function tellOmens(plot) {
    if (!chat_metadata || chat_metadata.omensTold || (plot.omens ?? []).length === 0) return;
    chat_metadata.omensTold = true;
    saveMetadata();
    const said = plot.omens.map(o => `«${o.text}»`).join(' ');
    postCombatNarration(`🔮 [HILO] El presagio: ${said}`);
    await postForModel(`[PRESAGIO] Alguien lo murmura, o se sueña. Dilo tal cual, sin explicarlo: ${said}`)
        .catch(error => console.error('[party] omens note failed', error));
}

/**
 * El bloque de lo que el mundo sabe del grupo, puesto al dia antes de cada turno.
 *
 * Vacio cuando no hay nada que contar: un bloque vacio no cuesta ni un token.
 */
function refreshWorldMemoryPrompt() {
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
    setExtensionPrompt(promptKey('combat', 'tone', 'ctx'), tone, extension_prompt_types.IN_PROMPT, 0, false, extension_prompt_roles.SYSTEM);
}

/** @returns {import('./game-engine/campaign/patronage.js').Debt|null} */
function getDebt() {
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
        currentWorldFactions = moved;
        await saveWorldInfo(worldName, data, true);
        await refreshWorldMapGlobals(worldName);
        if (isShellOpen()) refreshGameShell();
    } catch (error) {
        console.error('[party] no se pudo mover la reputacion', error);
    }
}

/** @returns {any} */
const getCampaignCalendar = () => campaign.getCalendar();
/** @returns {any} */
const getCampaignBonds = () => campaign.getBonds();
/** @param {any} calendar @param {any} bonds */
const saveCampaignState = (calendar, bonds) => campaign.save(calendar, bonds);
// El reloj del Modo Juego lee lo mismo que la pestana de Campana, asi que pasar el
// tiempo tiene que redibujarlo: sin esto el dia cambiaba y la cabecera no se enteraba.
const advanceCampaignSlot = () => {
    const result = campaign.advanceSlot();
    if (isShellOpen()) refreshGameShell();
    return result;
};
/**
 * Los dias que le deben a las facciones.
 *
 * Se acumulan y se vuelcan de una vez porque escribir el mundo es asincrono: un viaje de
 * cinco dias llama a `advanceCampaignDay` cinco veces seguidas, y cinco escrituras a la
 * vez del mismo archivo es como se pierde una. El `setTimeout(0)` espera a que termine el
 * bucle entero, que es sincrono, y entonces pasa los cinco dias de golpe.
 */
let factionDaysDue = 0;
/** @type {any} */
let factionTickTimer = null;

function scheduleFactionTick() {
    if (factionTickTimer) clearTimeout(factionTickTimer);
    factionTickTimer = setTimeout(() => {
        const days = factionDaysDue;
        factionDaysDue = 0;
        factionTickTimer = null;
        void passFactionDays(days);
    }, 0);
}

// U3 del pegamento: los días de las facciones los apunta la etapa `facciones` del paso del
// tiempo. Todas las formas de pasar el día (el turno que cierra la noche, un descanso largo,
// un viaje) pasan por `passTime` en `campaign-state.js`, así que ya no hace falta medir el
// calendario alrededor de cada una.

/** @returns {number} */
function campaignDay() {
    return Math.max(0, Math.floor(Number(getCampaignCalendar()?.day) || 0));
}

const advanceCampaignDay = () => {
    const result = campaign.advanceDay();
    if (isShellOpen()) refreshGameShell();
    return result;
};
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
        /** @type {Array<import('./game-engine/world/people-fate.js').Fate>} */
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
        currentWorldFactions = people;
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
const recordCampaignBondEvent = (characterId, eventType) => {
    const result = campaign.recordBond(characterId, eventType);
    // Idea 30: quien llega a vínculo 3 te pide lo suyo.
    offerPersonalQuests();
    if (isShellOpen()) refreshGameShell();
    return result;
};

/**
 * Idea 30: quien llega a vínculo 3 te pide lo suyo. Va al tablón, con su nombre, y se le
 * ofrece una sola vez.
 */
function offerPersonalQuests() {
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
const getCurrentSlotLabel = () => campaign.getSlotLabel();
/** @param {'corto'|'largo'} kind @returns {Promise<string>} */
const takeRest = async (kind) => {
    const result = await campaign.rest(kind);
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
};
const getCampaignMap = () => campaign.getMap();
/** @param {string} locationName */
const markLocationComplete = (locationName) => campaign.markLocationComplete(locationName);

/** Lo que se guarda con el chat y no vive en `party/campaign-state.js`. */
const CONTRADICTIONS_KEY = 'contradictions';
const SEED_KEY = 'diceSeed';

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

    const { openEncounterEditor } = await import('./game-engine/ui/encounter-editor.js');
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

    const { openObjectiveEditor } = await import('./game-engine/ui/objective-editor.js');
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
function renderCampaignTab() {
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
 * @param {import('./dnd-system.js').EnemyInstance} target
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

function resolveFollowUpAttack(actorId, target, how = 'ataca de seguimiento a', mode = /** @type {'advantage'|'disadvantage'|'normal'} */ ('normal')) {
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
 * El aviso de que esto ya es un combate.
 *
 * Abrir una puerta y que de pronto tengas turnos es el momento que mas facil se pasa por
 * alto: el registro lo decia en una linea entre otras diez. Un cartel no decide nada y no
 * se puede pulsar — por eso no roba clics —, solo hace imposible no enterarse.
 *
 * @param {string[]} names Los que acaban de entrar.
 */
function showInitiativeBanner(names) {
    $('.ib-banner').remove();

    const root = $('<div class="ib-banner"></div>');
    root.append($('<div class="ib-title"></div>').text('¡INICIATIVA!'));
    if (names.length > 0) {
        root.append($('<div class="ib-names"></div>').text(names.join(', ')));
    }
    $('body').append(root);

    // Se va sola: es un aviso, no algo que haya que cerrar.
    setTimeout(() => root.addClass('ib-out'), 2200);
    setTimeout(() => root.remove(), 3000);
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
    const counts = new Map();
    for (const placement of awake) {
        const name = String(placement.name);
        counts.set(name, (counts.get(name) || 0) + 1);
    }
    const summary = [...counts.entries()]
        .map(([name, count]) => (count > 1 ? `${name} x${count}` : name))
        .join(', ');

    const row = $('<div class="sc-row"></div>');
    row.append($('<div class="sc-what"></div>').text(`En el tablero: ${summary}`));

    const button = $('<button class="menu_button sc-btn" type="button"></button>');
    button.append('<i class="fa-solid fa-swords"></i>');
    button.append($('<span></span>').text(' Iniciar combate'));
    button.on('click', () => {
        if (combatEncounter.active) return;
        const enemies = instancesFromPlacements(awake);
        if (enemies.length === 0) {
            toastr.warning('Ninguno de los enemigos del tablero existe en el mundo.');
            return;
        }
        combatLogEntries = [];
        postCombatNarration(`[COMBAT] Empieza el combate del tablero: ${summary}.`);
        beginEncounterWith(enemies);
        showInitiativeBanner(enemies.map(e => e.name));
        renderLocationMapsPreview();
    });
    row.append(button);
    return row;
}

/**
 * Judges the scenario the current board carries, if it carries one.
 *
 * Most boards do not, and one without objectives has to behave exactly as it always did:
 * clear the enemies and you win. A scenario replaces that rule rather than adding to it —
 * "survive six rounds" is a victory with every enemy still standing.
 *
 * @returns {ReturnType<typeof judgeScenario>|null}
 */
function judgeCurrentScenario() {
    if (!combatEncounter.active) return null;

    const location = getCurrentWorldLocationMaps().find(l => l.name === currentLocationName);
    const board = getLocationBoards(location).find((/** @type {any} */ b) => b.name === currentBoardName);
    if (!board || !hasScenario(board)) return null;

    return judgeScenario(board.objectives, buildBoardState({
        round: combatEncounter.round,
        enemies: combatEncounter.enemies,
        party: partyMembers,
        collectedTreasures: combatEncounter.collectedTreasures,
    }));
}

/**
 * Ends the fight when the scenario says it is over.
 *
 * Called after anything that could change the answer — an attack, a move, a turn passing —
 * because "survive six rounds" is won by the clock and nothing else would notice.
 *
 * @returns {boolean} Whether the fight ended here.
 */
function checkScenarioOutcome() {
    const verdict = judgeCurrentScenario();
    if (!verdict || !verdict.outcome) return false;

    postCombatNarration(`🎯 [COMBAT] ${verdict.summary}`);
    postCombatNarration(verdict.outcome === 'victory'
        ? '🏁 [COMBAT] Objetivos cumplidos.'
        : '🏁 [COMBAT] La misión ha fracasado.');

    // Cumplir la mision de un tablero es lo que da la localizacion por superada, y eso
    // es lo que abre las siguientes en el mapa de campana. Ganar deberia ser lo unico
    // que abre puertas.
    if (verdict.outcome === 'victory') markLocationComplete(currentLocationName);

    endCombat(verdict.outcome === 'victory' ? 'victory' : 'defeat');
    renderLocationMapsPreview();
    return true;
}

/**
 * End the current combat encounter.
 */
function endCombat(reason = 'ended') {
    postCombatNarration('🏁 [COMBAT] El combate termina.');
    // T2: la ayuda que no llegó a entrar no espera a la pelea siguiente.
    const helpBoard = getActiveBoardContext().board;
    if (helpBoard && Array.isArray(helpBoard.waves) && helpBoard.waves.some((/** @type {any} */ w) => w?.help && !w.done)) {
        helpBoard.waves = helpBoard.waves.filter((/** @type {any} */ w) => !(w?.help && !w.done));
        persistBoardTerrain(helpBoard);
    }
    // Idea 25: la cuenta de derrotas seguidas.
    if (chat_metadata) chat_metadata[SAFETY_KEY] = noteOutcome(chat_metadata[SAFETY_KEY], reason);
    // Idea 105: si cayó a quien se escoltaba, el encargo se pierde.
    const escorted = chat_metadata?.[TAKEN_KEY] ? wardLost(partyMembers, String(chat_metadata[TAKEN_KEY].id)) : null;
    if (escorted && chat_metadata) {
        const lost = chat_metadata[TAKEN_KEY];
        delete chat_metadata[TAKEN_KEY];
        noteDeed(`Se perdió el encargo «${lost.title}»: ${escorted.name} no llegó.`);
        postCombatNarration(`💀 [GREMIO] ${escorted.name} ha caído: el encargo «${lost.title}» se pierde.`);
        dismissGuests(String(lost.id), 'perdido');
    }
    postCombatNarration(buildCombatSummary(/** @type {'victory'|'defeat'|'manual'|'ended'} */ (reason === 'fled' ? 'manual' : reason)));

    // Winning has to be worth something, or the tactical engine underneath is doing
    // careful work for nothing.
    /** @type {ReturnType<typeof awardEncounterLoot>} */
    let loot = null;
    if (reason === 'fled') countStat('fled');
    if (reason === 'victory') {
        countStat('wins');
        // R5: ganar juntos suma vínculo con la mascota; sin mascota, una bestia vencida se
        // puede domar (un aviso con botón: no para la partida).
        if (currentPet()) petLivesIt();
        else offerTaming(combatEncounter.enemies.filter(e => (e.currentHp || 0) <= 0 && !(/** @type {any} */ (e).fled)));
        // R3: quien sabe primeros auxilios levanta a quien quedó en el suelo.
        const medic = patchUpAfterFight(partyMembers);
        for (const fallenMember of medic ? partyMembers.filter(m => !m.dead && (Number(m.hp) || 0) <= 0) : []) {
            const healed = Math.max(1, Number(rollDiceDetailed(String(medic?.formula), 4).total) || 1);
            fallenMember.hp = Math.min(Number(fallenMember.maxHp) || healed, healed);
            fallenMember.deathSaves = clearDeathSaves();
            fallenMember.activeConditions = (Array.isArray(fallenMember.activeConditions) ? fallenMember.activeConditions : [])
                .filter((/** @type {string} */ c) => c !== 'Unconscious');
            postCombatNarration(`🩹 [COMBAT] ${medic?.who} venda a ${fallenMember.name}: se levanta con ${fallenMember.hp} PG.`);
        }
        loot = awardEncounterLoot(combatEncounter.enemies.filter(e => (e.currentHp || 0) <= 0 && !(/** @type {any} */ (e).fled)));
        // R7: una némesis que cae, se acaba.
        for (const fallen of combatEncounter.enemies.filter(e => /** @type {any} */ (e).nemesis && (e.currentHp || 0) <= 0 && !(/** @type {any} */ (e).fled))) {
            const done = nemesisFalls(chat_metadata?.[NEMESES_KEY], String(fallen.name));
            if (chat_metadata && done.line) {
                chat_metadata[NEMESES_KEY] = done.list;
                saveMetadata();
                postCombatNarration(`😈 [NEMESIS] ${done.line}`);
            }
        }
        if (loot?.gold) countStat('gold', loot.gold);

        // C7: alguien lo celebra.
        const cheering = partyMembers.filter(m => String(m.id) !== String(partyMembers[0]?.id) && (Number(m.hp) || 0) > 0);
        if (cheering.length > 0) bark(cheering[Math.floor(Math.random() * cheering.length)], 'victory');

        // El hilo: ganar aqui, y a quien se ha derrotado.
        for (const fallen of combatEncounter.enemies.filter(e => (e.currentHp || 0) <= 0)) {
            notePlot({ kind: 'defeat', enemy: String(fallen.name) });
        }
        notePlot({ kind: 'win', place: currentLocationName, board: currentBoardName });
        // Idea 52: el sitio sabe quién le ha quitado ese peso de encima.
        raiseFame(currentLocationName);

        // Surviving a fight together is a recorded fact, which is the whole point of the
        // bond design: the engine decides it happened, the model writes about it later.
        const survivors = partyMembers.filter(m => (m.hp || 0) > 0);
        if (survivors.length > 1) {
            let bonds = getCampaignBonds();
            for (const member of survivors) {
                const together = recordBondEvent(bonds, String(member.id), 'combat_together');
                bonds = together.state;
                if (together.rankedUp) tellBondScene(member, together.rankAfter);
            }
            saveCampaignState(null, bonds);
        }
    }

    // The blow-by-blow above is posted as system messages, which SillyTavern filters out
    // of the prompt (script.js: chat.filter(x => !x.is_system)). So the model never saw
    // the fight at all. This is the one line that tells it what happened — condensed on
    // purpose, because it is also the only part of a combat that costs anything.
    //
    // It goes out through postForModel, not postCombatNarration: sending it as a system
    // message, as this did until 2026-09-21, meant the model never received it either.
    const epilogue = buildEpiloguePrompt([], {
        rounds: Number(combatEncounter.round) || 1,
        victory: reason === 'victory',
        abandoned: reason === 'manual' || reason === 'fled',
        survivors: partyMembers.filter(m => (m.hp || 0) > 0).map(m => m.name),
        defeated: combatEncounter.enemies.filter(e => (e.currentHp || 0) <= 0).map(e => e.name),
    });
    postForModel(epilogue).catch(error => console.error('[party] could not post the combat epilogue', error));

    // Idea 191: ganar se celebra, con la cuenta delante.
    if (reason === 'victory') {
        const report = buildVictoryReport({
            tally: combatEncounter.tally,
            party: partyMembers,
            rounds: Number(combatEncounter.round) || 1,
            loot,
            defeated: combatEncounter.enemies.filter(e => (e.currentHp || 0) <= 0).length,
        });
        // Idea 63: lo nuevo, frente a lo que ya lleva quien mas lo aprovecha.
        report.upgrades = (loot?.items ?? []).map(item => bestFor(item, partyMembers)).filter(Boolean);
        showVictoryScreen(report);
        // Idea 34: lo que se recuerda de este combate.
        const where = currentBoardName || currentLocationName;
        for (const row of report.rows.filter(r => r.downed)) {
            rememberTogether(`${row.name} cayó en ${where} y se levantó.`, [row.name]);
        }
        // Idea 7: quien se rindio se queda con el grupo, hasta que se decida que hacer.
        const surrendered = combatEncounter.enemies.filter(e => e.surrendered).map(e => String(e.name));
        if (surrendered.length > 0 && chat_metadata) {
            chat_metadata[PRISONERS_KEY] = takePrisoners(chat_metadata[PRISONERS_KEY], surrendered, {
                day: Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1)), place: where,
            });
            saveMetadata();
            postCombatNarration(`⛓️ [COMBAT] Prisioneros: ${surrendered.join(', ')}. Se puede interrogarlos, entregarlos o soltarlos.`);
            showTip('prisoners');
        }
        // Idea 77: si el tablero tiene puertas con llave, el que mandaba la llevaba encima.
        dropBoardKey();
    }

    combatEncounter = createEmptyCombatEncounter();
    combatBoardSelection = { tokenId: null, boardName: '', locationName: '' };
    saveCombatState();
}

/**
 * La pantalla de victoria: quien hizo que, que os lleváis y quien cayo por el camino.
 *
 * No tapa la partida: es una tarjeta que se cierra sola o al pulsarla, porque detras
 * sigue el epilogo del narrador, que es lo que importa leer.
 *
 * @param {import('./game-engine/combat/tally.js').VictoryReport} report
 */
function showVictoryScreen(report) {
    $('.vs-card').remove();
    const card = $('<div class="vs-card" role="status"></div>');
    card.append($('<div class="vs-title"></div>').text(`🏆 ${report.title}`));
    const table = $('<div class="vs-rows"></div>');
    for (const row of report.rows) {
        const line = $('<div class="vs-row"></div>').toggleClass('vs-best', row.best);
        line.append($('<span class="vs-name"></span>').text(`${row.best ? '⭐ ' : ''}${row.name}`));
        line.append($('<span class="vs-num"></span>').text(`${row.dealt} hecho`));
        line.append($('<span class="vs-num"></span>').text(`${row.kills} tumbados`));
        line.append($('<span class="vs-num"></span>').text(`${row.taken} recibido`));
        table.append(line);
    }
    card.append(table);
    if (report.best) card.append($('<div class="vs-line"></div>').text(report.best));
    card.append($('<div class="vs-line vs-loot"></div>').text(`Os lleváis: ${report.loot}`));
    for (const scar of report.scars) card.append($('<div class="vs-line vs-scar"></div>').text(scar));
    for (const upgrade of report.upgrades ?? []) card.append($('<div class="vs-line vs-upgrade"></div>').text(`⬆️ ${upgrade}`));
    card.append($('<div class="vs-hint"></div>').text('Pulsa para cerrar'));
    card.on('click', () => card.remove());
    $('body').append(card);
    setTimeout(() => card.remove(), 20000);
}

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
 * T2: el bando pide tregua. Un aviso con sus dos botones; también `/tregua sí|no`.
 */
function offerTruce() {
    /** @type {any} */ (combatEncounter).truce = 'pending';
    /** @type {any} */ (combatEncounter).truceRound = Number(combatEncounter.round) || 1;
    saveCombatState();
    postCombatNarration(truceLine(getAliveEnemies().map(e => String(e.name))));
    const toast = toastr.info('Aceptarla gana el tablero, pero los que se van no dejan botín. Los tuyos lo juzgarán, la aceptes o no.', '🏳️ Piden tregua', { timeOut: 20000 });
    const buttons = $('<div style="margin-top:6px; display:flex; gap:6px;"></div>');
    buttons.append($('<button class="menu_button truce-yes"></button>').text('Dejarles ir').on('click', () => { answerTruce(true); }));
    buttons.append($('<button class="menu_button truce-no"></button>').text('Sin cuartel').on('click', () => { answerTruce(false); }));
    $(toast).find('.toast-message').append(buttons);
}

/**
 * T2: la respuesta a la tregua.
 *
 * @param {boolean} accept
 * @returns {string}
 */
function answerTruce(accept) {
    if (!combatEncounter.active || /** @type {any} */ (combatEncounter).truce !== 'pending') {
        toastr.info('Nadie está pidiendo tregua ahora.', 'La tregua');
        return '';
    }
    if (!accept) {
        /** @type {any} */ (combatEncounter).truce = 'refused';
        saveCombatState();
        postCombatNarration('⚔️ [COMBAT] Sin cuartel: vuelven a levantar las armas.');
        judgeDecision('sin-cuartel');
        return '';
    }
    /** @type {any} */ (combatEncounter).truce = 'accepted';
    const leaving = getAliveEnemies();
    for (const enemy of leaving) {
        enemy.currentHp = 0;
        /** @type {any} */ (enemy).fled = true;
    }
    saveCombatState();
    postCombatNarration(`🤝 [COMBAT] Tregua: ${leaving.map(e => e.name).join(', ')} se van. El tablero es vuestro.`);
    noteDeed(`Dejasteis ir a los que pidieron tregua en ${currentBoardName || currentLocationName || 'un combate'}.`);
    judgeDecision('tregua');
    endCombat('victory');
    renderLocationMapsPreview();
    return '';
}

/**
 * B2: quien está en una salida puede irse de la pelea. Un aviso con su botón.
 *
 * @param {any} member
 * @param {number} x
 * @param {number} y
 */
function offerExit(member, x, y) {
    if (!combatEncounter.active || (Number(member?.hp) || 0) <= 0) return;
    if (!isExit(getActiveBoardContext().terrain, x, y)) return;
    const toast = toastr.info(`${member.name} está en una salida. Salir le saca de esta pelea: nadie le ataca y ya no actúa. Cuando salgáis todos, se acaba en huida.`, '🚪 Una salida', { timeOut: 12000 });
    $(toast).find('.toast-message').append($('<button class="menu_button exit-leave" style="margin-top:6px;"></button>').text('Salir por aquí').on('click', () => { leaveThroughExit(member); }));
}

/**
 * B2: salir por una salida. Quien sale deja de estar en la pelea; cuando han salido todos los
 * que siguen en pie, se acaba en huida, sin los golpes de la retirada (el camino ya se pagó).
 *
 * @param {any} member
 * @returns {string}
 */
function leaveThroughExit(member) {
    if (!combatEncounter.active || !member) return '';
    const cell = partyCell(member);
    if (!isExit(getActiveBoardContext().terrain, cell.x, cell.y)) {
        toastr.info(`${member.name} no está en una salida: primero hay que llegar a ella.`, 'Salir');
        return '';
    }
    if ((Number(member.hp) || 0) <= 0 || hasLeft(combatEncounter.left, member.id)) return '';
    const wasTurn = String(getPartyMemberByTurnEntry(getCurrentTurnEntry())?.id ?? '') === String(member.id);
    combatEncounter.left = leaveBoard(combatEncounter.left, member.id);
    postCombatNarration(leaveLine(member.name, stillFighting(partyMembers, combatEncounter.left).length));
    saveCombatState();
    if (everyoneOut(partyMembers.filter(m => !m.dead), combatEncounter.left)) {
        finishEscape('Todos fuera.');
        return '';
    }
    renderPartyMembers();
    renderLocationMapsPreview();
    // Si le tocaba a él, su turno se acaba aquí.
    if (wasTurn) endPlayerCombatTurn();
    return '';
}

/**
 * B2: la pelea acaba en huida por las salidas. Se deja el tablero sin ganar, se sabe y se juzga,
 * como la retirada de siempre.
 *
 * @param {string} said
 */
function finishEscape(said) {
    postCombatNarration(`🏃 [COMBAT] ${said} Os vais de ${currentBoardName || 'aquí'} sin ganar el tablero.`);
    noteDeed(`Salisteis por pies de ${currentBoardName || currentLocationName || 'un combate'}.`);
    savePartyState();
    renderPartyMembers();
    endCombat('fled');
    renderLocationMapsPreview();
    judgeDecision('retirada');
}

/**
 * Idea 22: huir, con su precio dicho antes.
 *
 * @returns {Promise<void>}
 */
async function retreatFromCombat() {
    if (!combatEncounter.active) return;
    const cell = (/** @type {any} */ pos) => ({ x: Number(pos?.gridX) || 0, y: Number(pos?.gridY) || 0 });
    const plan = planRetreat({
        party: partyMembers.map(m => ({ id: m.id, name: m.name, ...cell(m.mapPosition), hp: Number(m.hp) || 0 })),
        enemies: getAliveEnemies().map(e => ({ id: e.instanceId, name: e.name, ...cell(e), hp: Number(e.currentHp) || 0 })),
        disengaged: readManeuvers(combatEncounter.maneuvers).disengaged,
        distanceFeet: getDistanceInFeet,
    });
    const go = await Popup.show.confirm('¿Huir del combate?', plan.summary);
    if (!go || !combatEncounter.active) return;

    const lines = ['🏃 [COMBAT] El grupo se retira.'];
    for (const blow of plan.blows) {
        const enemy = getEnemyByInstanceId(blow.enemyId);
        const member = partyMembers.find(m => String(m.id) === blow.memberId);
        if (enemy && member && (Number(enemy.currentHp) || 0) > 0) {
            lines.push(`↩️ ${enemy.name} aprovecha que ${member.name} se da la vuelta.`);
            lines.push(resolveEnemyAttackOn(enemy, member));
        }
    }
    postCombatNarration(lines.filter(Boolean).join('\n'));
    noteDeed(`Huisteis de ${currentBoardName || currentLocationName || 'un combate'}.`);
    savePartyState();
    renderPartyMembers();
    endCombat('fled');
    renderLocationMapsPreview();
    // Idea 28: huir también se juzga.
    judgeDecision('retirada');
}

/**
 * Build token data from combat encounter enemies.
 * @returns {import('./world-map-renderer.js').TokenData[]}
 */
function buildEnemyTokens() {
    if (!combatEncounter.active) return [];
    /** @type {import('./world-map-renderer.js').TokenData[]} */
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
 * @returns {import('./world-map-renderer.js').TokenData[]}
 */
function buildBoardNPCTokens(board) {
    if (!board?.npcPlacements || !Array.isArray(board.npcPlacements)) return [];
    const worldNPCs = getCurrentWorldNPCs();
    /** @type {import('./world-map-renderer.js').TokenData[]} */
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

/** Export combat state for external access (e.g., script.js AI injection) */
export function getCombatEncounter() {
    return combatEncounter;
}

/**
 * Read-only snapshot of current party state for external modules.
 * @returns {PartyMember[]}
 */
export function getPartyMembersSnapshot() {
    try {
        return JSON.parse(JSON.stringify(partyMembers || []));
    } catch {
        return [];
    }
}

/**
 * La escena según el motor, para el gestor de contexto (U1 del pegamento): combate si hay un
 * encuentro, exploración en un tablero, social en un sitio. Sin partida del juego, nada, y
 * entonces manda la que se elija a mano con `/cstate`.
 *
 * @returns {string}
 */
export function getEngineSceneState() {
    if (!chat_metadata?.[METADATA_KEY]) return '';
    if (combatEncounter.active) return 'combat';
    if (currentBoardName) return 'exploration';
    return currentLocationName ? 'social' : 'idle';
}

/**
 * Get a snapshot of all characters/NPCs/enemies present on the current board/location.
 * Used by the Dynamic Context Manager to inject board awareness into AI context.
 * @returns {{ locationName: string, boardName: string, partyTokens: Array<{name: string}>, npcTokens: Array<{name: string}>, enemyTokens: Array<{name: string}> }}
 */
export function getBoardContextSnapshot() {
    /** @type {{name: string}[]} */
    const partyTokens = [];
    /** @type {{name: string}[]} */
    const npcTokens = [];
    /** @type {{name: string}[]} */
    const enemyTokens = [];
    const snapshot = {
        locationName: currentLocationName || '',
        boardName: currentBoardName || '',
        partyTokens,
        npcTokens,
        enemyTokens,
    };

    if (!currentLocationName) return snapshot;

    // Party members at current location
    for (const m of partyMembers) {
        const pos = m.mapPosition || { locationName: '', gridX: 0, gridY: 0 };
        if (pos.locationName === currentLocationName) {
            snapshot.partyTokens.push({ name: m.name });
        }
    }

    // Board NPCs (if a board is selected)
    if (currentBoardName) {
        const locationMaps = getCurrentWorldLocationMaps();
        const loc = locationMaps.find(l => l.name === currentLocationName);
        if (loc) {
            const locBoards = getLocationBoards(loc);
            const board = locBoards.find(/** @param {{ name: string }} b */ (b) => b.name === currentBoardName);
            if (board?.npcPlacements && Array.isArray(board.npcPlacements)) {
                const worldNPCs = getCurrentWorldNPCs();
                for (const placement of board.npcPlacements) {
                    const npc = worldNPCs.find(n => n.id === placement.npcId);
                    if (npc) {
                        snapshot.npcTokens.push({ name: npc.name });
                    }
                }
            }
        }
    }

    // Combat enemies (if active)
    if (combatEncounter.active && combatEncounter.enemies.length > 0) {
        for (const e of combatEncounter.enemies) {
            snapshot.enemyTokens.push({ name: e.name });
        }
    }

    return snapshot;
}

/**
 * Build token data from party members for a specific location.
 * @param {string} [locationFilter] - Only include members at this location (empty = all)
 * @returns {import('./world-map-renderer.js').TokenData[]}
 */
function buildTokens(locationFilter) {
    /** @type {import('./world-map-renderer.js').TokenData[]} */
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
        occupied: new Set([
            ...getAliveEnemies().map(e => `${e.gridX || 0},${e.gridY || 0}`),
            ...partyMembers
                .filter(m => String(m.id) !== String(member.id))
                .map(m => `${m.mapPosition?.gridX || 0},${m.mapPosition?.gridY || 0}`),
        ]),
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

    combatBoardSelection = alreadySelected
        ? { tokenId: null, boardName: '', locationName: '' }
        : { tokenId, boardName: currentBoardName, locationName: currentLocationName };

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
function handlePlayerCombatMove(rawValue) {
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
function boardVisibility() {
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
function attackLine({ who, at, total, ac, hit, natural, modifier, cover = 0, edge = '' }) {
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
function performManeuver(kind, targetId = '') {
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
function handlePlayerCombatAttack(rawTargetName) {
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
        title: `${member.name} tira dano`,
        subtitle: `Contra ${target.name}`,
        formula: `${damageFormula}${isCrit ? ` + ${damageFormula}` : ''}`,
        detail: isCrit
            ? `${damageRoll.rolls.join(', ')} + crit(${critRoll?.rolls.join(', ') || ''}) + mod(${damageMod})`
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

function endPlayerCombatTurn() {
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
            currentLocationName = loc.name;
            saveCurrentLocation();
        },
        onLocationNavigate: (loc) => {
            // Switch to Location tab
            currentLocationName = loc.name;
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
    section.append(`<div class="wm-combat-banner"><i class="fa-solid fa-swords"></i> ${t`Combat Active`} — ${escapeHtml(board.name)}</div>`);

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
                            <span>HP: ${enemy.currentHp}/${enemy.maxHp}</span>
                            <span>AC: ${enemy.armorClass}</span>
                            <span>CR: ${enemy.cr}</span>
                        </div>
                        <div class="wm-combat-enemy-hp-bar">
                            <div class="wm-combat-enemy-hp-fill" style="width:${hpPct}%"></div>
                        </div>
                    </div>
                </div>
            `);
        }
        section.append('<div class="wm-combat-enemies-title">' + t`Enemies` + '</div>');
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
            ? targets.map(enemy => `<span class="wm-combat-chip attack">${escapeHtml(enemy.name)} · ${getDistanceInFeet(memberX, memberY, Number(enemy.gridX) || 0, Number(enemy.gridY) || 0)} ft</span>`).join('')
            : `<span class="wm-combat-chip attack">${t`No enemies in range`}${nearestEnemyInfo ? ` · ${t`Nearest`}: ${escapeHtml(nearestEnemyInfo.name)} (${nearestEnemyInfo.distanceFeet} ft)` : ''}</span>`;

        section.append(`
            <div class="wm-combat-turn-panel">
                <strong>${escapeHtml(currentMember.name)}</strong> · ${t`Your turn`}<br>
                <div class="wm-combat-turn-help">${t`Action used`}: ${turnState.actionUsed ? t`yes` : t`no`} · ${t`Bonus`}: ${turnState.bonusActionUsed ? t`yes` : t`no`} · ${t`Reaction`}: ${turnState.reactionUsed ? t`yes` : t`no`} · ${t`Movement left`}: ${remainingFeet} ft · ${t`Attack range`}: ${rangeFeet} ft.</div>
                <div class="wm-combat-chip-row">
                    <span class="wm-combat-chip move">${t`Click your token to display movement range on the board`}</span>
                    ${targetChips}
                </div>
                <div class="wm-combat-button-note">${t`Chat commands`}: /combat-attack &lt;target&gt;, /combat-move &lt;x&gt; &lt;y&gt;, /combat-end</div>
            </div>
        `);
    }

    // Action buttons
    const btnRow = $('<div class="wm-combat-buttons"></div>');
    const endTurnBtn = $(`<button class="menu_button"><i class="fa-solid fa-forward-step"></i> ${t`End Turn`}</button>`);
    endTurnBtn.on('click', () => {
        const nextEntry = endPlayerCombatTurn();
        if (nextEntry) {
            toastr.info(`🎯 ${t`Turn`}: ${nextEntry}`);
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
 * @returns {import('./game-engine/ui/shell/scene-director.js').GameSituation}
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
 * @returns {import('./game-engine/ui/shell/game-shell.js').CombatBar}
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
 * @returns {import('./game-engine/ui/shell/dialogue-scene.js').DialogueView}
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

        const { openCampaignEditor } = await import('./game-engine/ui/campaign-editor.js');
        const { applyEditorModel, describeModel, planEntryChanges } = await import('./game-engine/campaign/campaign-editor.js');

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
        worldItemCatalogue = Array.isArray(data.metadata.itemCatalogue) ? data.metadata.itemCatalogue : [];

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
        syncPartyWithEntries(data.entries, worldName);
        deliverGifts(edited.gifts, worldItemCatalogue);

        // La localidad abierta puede haberse quedado sin existir: mejor volver al selector
        // que dejar la pantalla apuntando a un sitio borrado.
        const places = (data.metadata.locationMaps ?? []).map((/** @type {any} */ l) => String(l.name));
        if (currentLocationName && !places.includes(currentLocationName)) {
            currentLocationName = '';
            currentBoardName = '';
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
function memberFromEntry(entry, worldName) {
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
        partyMembers = partyMembers.filter(member => !left.includes(member));
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
 * Abre el gremio: el tablon, la casa y quien esta.
 *
 * @returns {Promise<string>}
 */
async function openGuild() {
    await ensureWorldData();
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName) {
        toastr.warning('Abre una campana antes de mirar el tablon.');
        return '';
    }

    const guild = getGuild();
    const board = refreshContractBoard();
    const today = Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1));
    const purse = partyMembers.reduce((sum, m) => sum + Math.max(0, Number(m.gold) || 0), 0);


    const { openGuildPanel } = await import('./game-engine/ui/guild-panel.js');
    const choice = await openGuildPanel({
        guild, board, day: today, purse, roster: partyMembers, Popup, POPUP_TYPE,
        // Idea 42: quien está en casa, y si cabe alguien más en el grupo.
        bench: readBench(chat_metadata?.[BENCH_KEY]),
        partyFull: whereHired(partyMembers) === 'bench',
        // Idea 124: lo que hay en el almacén y lo que se puede dejar.
        storage: readStorage(chat_metadata?.[STORAGE_KEY]),
        carried: partyMembers.filter(m => !m.dead).flatMap(m => (m.items ?? [])
            .filter((/** @type {any} */ i) => !Object.values(m.equippedItems ?? {}).includes(i.id) && !i.cursed)
            .map((/** @type {any} */ i) => ({ memberId: String(m.id), memberName: String(m.name), itemId: String(i.id), name: String(i.name) }))),
        fighting: combatEncounter.active,
        // Para que el tablon pueda decir a quien ayudas o a quien paras por su nombre.
        factionNames: Object.fromEntries(
            getCurrentWorldFactions().map((/** @type {any} */ f) => [f.id, f.name]),
        ),
    });
    if (!choice) return describeGuild(guild);

    if (choice.built) return raiseBuilding(choice.built, purse);
    if (choice.accepted) return await acceptContract(choice.accepted);
    if (choice.benched) return rotateBench('bench', choice.benched);
    if (choice.called) return rotateBench('call', choice.called);
    if (choice.stored || choice.retrieved) return useStorage(choice.stored, choice.retrieved);
    return '';
}

/**
 * Idea 124: guardar algo en el almacén del gremio, o sacarlo para el héroe.
 *
 * @param {string} stored `memberId:itemId`
 * @param {string} retrieved `itemId`
 * @returns {string}
 */
function useStorage(stored, retrieved) {
    if (!chat_metadata) return '';
    const [memberId, itemId] = String(stored || '').split(':');
    const member = stored ? partyMembers.find(m => String(m.id) === memberId) : partyMembers[0];
    if (!member) return '';
    const result = stored ? store(member, chat_metadata[STORAGE_KEY], itemId) : retrieve(member, chat_metadata[STORAGE_KEY], retrieved);
    if (!result.ok) {
        toastr.warning(result.reason, 'El almacén');
        return '';
    }
    member.items = result.items;
    chat_metadata[STORAGE_KEY] = result.storage;
    savePartyState();
    saveMetadata();
    renderPartyMembers();
    postCombatNarration(`📦 [GREMIO] ${result.line}`);
    toastr.success(result.line, 'El almacén');
    return result.line;
}

/**
 * Ideas 105 y 131: los invitados de un encargo se van al acabarlo.
 *
 * @param {string} contractId
 * @param {'cumplido'|'perdido'} how
 */
function dismissGuests(contractId, how) {
    const { leaving, party } = guestsLeave(partyMembers, contractId);
    if (leaving.length === 0) return;
    partyMembers = party;
    for (const guest of leaving) {
        const line = guest.guest?.kind === 'mercenary'
            ? `${guest.name} cobró por este encargo${how === 'cumplido' ? ' y se despide' : ', y se va sin mirar atrás'}.`
            : `${guest.name} ${how === 'cumplido' ? 'llega a su sitio y se despide' : 'no llegará a ninguna parte'}.`;
        postCombatNarration(`🧳 [GREMIO] ${line}`);
    }
    savePartyState();
    renderPartyMembers();
}

/**
 * Idea 131: pagar a alguien para el encargo de ahora.
 *
 * @param {string} name
 */
function hireMercenary(name) {
    const taken = chat_metadata?.[TAKEN_KEY];
    const offer = hirelingsHere(createSeededRandom(derive(String(chat_metadata?.[METADATA_KEY] || ''), 'mercenario', currentLocationName, String(campaignDay()))), Number(partyMembers[0]?.level) || 1)
        .find(o => o.name === name);
    if (!taken || !offer) return;
    const merc = guestMember({
        id: Date.now(), name: offer.name, kind: 'mercenary', contractId: String(taken.id), level: Number(partyMembers[0]?.level) || 1,
        base: partyMembers[0], stats: offer,
    });
    merc.mapPosition = { ...(partyMembers[0]?.mapPosition ?? { locationName: currentLocationName, gridX: 1, gridY: 1 }) };
    partyMembers.push(merc);
    savePartyState();
    renderPartyMembers();
    const line = `${merc.name} se apunta para «${taken.title}»: cobra ${offer.fee} de oro y se va al acabar.`;
    postCombatNarration(`🗡️ [POSADA] ${line}`);
    toastr.success(line, 'Mercenario');
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
 * Idea 42: dejar a alguien en casa, o llamarle. Quien llega tarda un día.
 *
 * @param {'bench'|'call'} what
 * @param {string} id
 * @returns {string}
 */
function rotateBench(what, id) {
    if (!chat_metadata) return '';
    if (combatEncounter.active) {
        toastr.warning('No mientras peleáis.');
        return '';
    }
    const result = what === 'bench'
        ? { ...benchMember({ party: partyMembers, bench: chat_metadata[BENCH_KEY], id }), days: 0 }
        : callFromBench({ party: partyMembers, bench: chat_metadata[BENCH_KEY], id });
    if (!result.ok) {
        toastr.warning(result.line);
        return '';
    }
    partyMembers = result.party;
    chat_metadata[BENCH_KEY] = result.bench;
    if (what === 'call') {
        const back = partyMembers[partyMembers.length - 1];
        // Llega donde está el grupo, al lado del primero.
        const lead = partyMembers[0]?.mapPosition ?? { locationName: currentLocationName, gridX: 0, gridY: 0 };
        if (back) back.mapPosition = { locationName: currentLocationName, gridX: (Number(lead.gridX) || 0) + 1, gridY: Number(lead.gridY) || 0 };
        for (let day = 0; day < result.days; day++) advanceCampaignDay();
    }
    savePartyState();
    saveMetadata();
    renderPartyMembers();
    postCombatNarration(`🏠 [GREMIO] ${result.line}`);
    toastr.info(result.line, what === 'bench' ? 'A casa' : 'De vuelta');
    if (isShellOpen()) refreshGameShell();
    return result.line;
}

/**
 * Sube un edificio, si el oro llega.
 *
 * Se cobra del mismo bolsillo que la cena: es lo que hace que construir sea una decision
 * y no una casilla que marcar cuando toca.
 *
 * @param {string} key
 * @param {number} purse
 * @returns {string}
 */
function raiseBuilding(key, purse) {
    const guild = getGuild();
    const next = upgradeCost(guild, key);
    if (next.maxed || purse < next.cost) {
        toastr.warning('No llega el oro para eso.');
        return '';
    }

    let owed = next.cost;
    for (const member of [...partyMembers].sort((a, b) => (Number(b.gold) || 0) - (Number(a.gold) || 0))) {
        if (owed <= 0) break;
        const has = Math.max(0, Number(member.gold) || 0);
        const taken = Math.min(has, owed);
        member.gold = has - taken;
        owed -= taken;
    }

    guild.buildings[key] = next.nextLevel;
    chat_metadata[GUILD_KEY] = guild;
    saveMetadata();
    savePartyState();

    const line = `${key} sube al nivel ${next.nextLevel} por ${next.cost} de oro.`;
    postCombatNarration(`🏛️ [GREMIO] ${line}`);
    toastr.success(line, 'La casa crece');
    return line;
}

/**
 * Acepta un encargo y le construye el sitio donde se juega.
 *
 * Aqui se juntan las dos mitades del plan: el tablon dice **que** hay que hacer y el
 * generador construye **donde**. Sin esto, aceptar un encargo seria apuntar una frase.
 *
 * @param {string} id
 * @returns {Promise<string>}
 */
async function acceptContract(id) {
    const board = chat_metadata?.[BOARD_KEY] ?? [];
    const contract = board.find((/** @type {any} */ c) => String(c?.id) === String(id));
    if (!contract) return '';

    // Uno escrito ya tiene su sitio: el tablero del guion, o ninguno si se resuelve sin
    // pelear. No se genera nada.
    if (contract.written) {
        chat_metadata[TAKEN_KEY] = contract;
        chat_metadata[BOARD_KEY] = board.filter((/** @type {any} */ c) => String(c?.id) !== String(id));
        saveMetadata();
        const said = describeWrittenAccept(contract);
        postCombatNarration(`📄 [GREMIO] ${said}`);
        void postForModel(`[ENCARGO] ${said} Cuéntalo en una o dos frases. No inventes nada que no esté aquí.`);
        const formedWritten = formParty(partyMembers, contract, { max: Math.max(1, partyMembers.length) });
        for (const line of formedWritten.lines) postCombatNarration(`🫱 [GREMIO] ${line}`);
        voiceOpinions(contract);
        toastr.success(contract.locationName, 'Encargo aceptado');
        return said;
    }

    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    const data = await loadWorldInfo(worldName);
    if (!data) return '';

    // Idea 97: los que migran solo salen en su estación.
    const bestiary = enemiesInSeason()
        .map((/** @type {any} */ e) => String(e?.name || '')).filter(Boolean);

    // De que clase es el sitio, de que esta hecho por dentro y en que estado esta. Sin
    // bateria de sitios sale lo de siempre: salas y pasillos, como hasta ahora.
    const compendium = await campaignCompendium();
    const seed = derive(seedOfWorld(data.metadata), 'encargo', String(contract.id));
    const random = createSeededRandom(seed);
    const biome = biomeHere(data.metadata);

    const type = compendium.has('sitios')
        ? compendium.pick('sitios', { where: { kind: 'tipo', biome }, random })
            ?? compendium.pick('sitios', { where: { kind: 'tipo' }, random })
        : null;
    const state = compendium.has('sitios')
        ? compendium.pick('sitios', { where: { kind: 'estado' }, random })
        : null;
    // R6: las salas escritas, las de siempre y las pensadas para este propósito.
    const templates = compendium.has('sitios')
        ? compendium.find('sitios', { kind: 'sala' })
            .filter((/** @type {any} */ row) => !Array.isArray(row.when?.purpose) || row.when.purpose.includes(String(contract.kind || '')))
            .map((/** @type {any} */ row) => row.rows)
        : [];

    // R6: el sitio sabe para qué es. El propósito del encargo manda en la forma, el sitio en
    // lo que trae (y en sus trampas), y los enemigos salen por presupuesto (idea 83): por el
    // nivel y el tamaño del grupo, el encargo y el modo. Si no sale divertido, se vuelve a
    // tirar con la semilla siguiente.
    const heroLevels = partyMembers.filter(m => !m.dead && !m.guest).map(m => Number(m.level) || 1);
    const generated = generateIntended({
        // El dado del mundo, no el de la sesion: el mismo encargo da el mismo sitio.
        randomFor: (attempt) => (attempt === 0 ? random
            : createSeededRandom(derive(seedOfWorld(data.metadata), 'encargo', String(contract.id), 'intento', String(attempt)))),
        generate: generateBoard,
        purpose: String(contract.kind || 'cull'),
        site: `${String(type?.name ?? '')} ${biome}`,
        options: enemiesInSeason().map((/** @type {any} */ e) => ({ name: String(e?.name || ''), threat: threatOf(e) })).filter(o => o.name),
        budget: budgetFor({
            partyLevel: heroLevels.length > 0 ? Math.round(heroLevels.reduce((a, b) => a + b, 0) / heroLevels.length) : 1,
            partySize: Math.max(1, heroLevels.length),
            difficulty: Number(contract.difficulty) || 1,
            letters: lettersOf(survivalNow()),
        }),
        board: {
            size: contract.difficulty >= 5 ? 'large' : (contract.difficulty >= 1 ? 'medium' : 'small'),
            shape: String(type?.shape || 'rooms'),
            templates,
            state: state ? { cover: state.cover, rough: state.rough } : null,
            partySize: Math.max(1, partyMembers.length),
        },
    });

    // El sitio entra como una localidad de verdad, editable en `/campana` y exportable con
    // la campana. Lo generado que no se guarda como contenido de primera clase es texto
    // suelto: no hay mapa que aprender ni sitio al que volver.
    const places = Array.isArray(data.metadata?.locationMaps) ? data.metadata.locationMaps : [];
    const placeName = contract.locationName || contract.title;
    let place = places.find((/** @type {any} */ l) => String(l?.name) === placeName);
    if (!place) {
        place = { name: placeName, description: '', url: '', gridWidth: 50, gridHeight: 50, boards: [] };
        places.push(place);
    }
    place.boards = Array.isArray(place.boards) ? place.boards : [];

    const boardName = `${contract.title} (encargo)`;
    const built = {
        name: boardName,
        description: [
            `Encargo de rango ${contract.rank} para ${contract.patron}.`,
            // Lo que el sitio es y como esta, escrito donde el narrador lo lee.
            type ? `${type.name}: ${type.note}` : '',
            state ? `${state.name}. ${state.note}` : '',
        ].filter(Boolean).join(' '),
        url: '',
        gridWidth: generated.gridWidth,
        gridHeight: generated.gridHeight,
        terrain: terrainFromAsciiMap(generated.map),
        partyStart: generated.partyStart,
        enemyPlacements: generated.enemies,
        objectives: /** @type {any[]} */ ([]),
        // R6: las trampas del sitio, cada una con su aviso, y los refuerzos que llegan.
        hazards: generated.hazards ?? [],
        waves: generated.waves ?? [],
    };
    // R6: si hay un caso abierto con algo que registrar en este sitio, la pista está en el
    // tablero: en la sala del fondo, a la vista para quien la pise.
    const openCase = readCases(chat_metadata?.[CASES_KEY]);
    const toFind = openCase.active?.clues.find(c => c.how === 'registrar' && c.source.kind === 'sitio'
        && String(c.source.name).toLowerCase() === String(placeName).toLowerCase() && !openCase.found.includes(c.id));
    const clueCell = toFind ? (generated.target ?? built.enemyPlacements[built.enemyPlacements.length - 1] ?? null) : null;
    if (toFind && clueCell) {
        built.hazards = [...built.hazards, {
            id: `pista-${toFind.id}`, name: 'Algo que no encaja', kind: 'pista', trigger: 'enter', effect: 'none',
            x: clueCell.x, y: clueCell.y, tell: 'Algo que no encaja con el resto.', note: `caso:${toFind.id}`, seen: true, armed: true, once: true,
        }];
    }
    // R7: si toca, la némesis vuelve: en el sitio del más fuerte, si es de este mundo.
    const nemesis = whoReturns({ raw: chat_metadata?.[NEMESES_KEY], today: campaignDay(), random });
    if (nemesis && getCurrentWorldEnemies().some((/** @type {any} */ e) => String(e.name) === nemesis.name) && built.enemyPlacements.length > 0) {
        built.enemyPlacements = [{ ...built.enemyPlacements[0], name: nemesis.name, nemesis: nemesis.id }, ...built.enemyPlacements.slice(1)];
    }
    // R6: lo que se busca, en la sala más lejana (y en un robo, detrás de una puerta con llave).
    if (generated.target && (contract.kind === 'recover' || contract.kind === 'steal')) {
        built.objectives = [{
            id: 'recuperar', type: 'reach_cell', cell: generated.target,
            label: `Llegar a lo que se busca, en (${generated.target.x + 1}, ${generated.target.y + 1})`,
        }];
    }
    // Idea 105: a quien se escolta, en el tablero, y la salida adonde hay que llevarlo.
    const start = generated.partyStart?.[0] ?? { x: 1, y: 1 };
    const ward = contract.kind === 'escort'
        ? guestMember({ id: Date.now(), name: String(contract.patron || 'El viajero'), kind: 'ward', contractId: String(contract.id), level: Number(partyMembers[0]?.level) || 1, base: partyMembers[0] })
        : null;
    const exit = ward ? exitCell(generated.map, start) : null;
    if (ward && exit) {
        built.objectives = [{ id: 'escoltar', type: 'escort', allyId: String(ward.id), cell: exit, label: `Llevar a ${ward.name} hasta la salida (${exit.x + 1}, ${exit.y + 1}), vivo` }];
    }
    /** @type {any[]} */
    const levels = [built];
    // Idea 75: los grandes tienen dos niveles, con una escalera al fondo del primero.
    if ((Number(contract.difficulty) || 0) >= 3) {
        const deeper = generateBoard({
            random: createSeededRandom(derive(seedOfWorld(data.metadata), 'encargo', String(contract.id), 'nivel2')),
            size: 'medium',
            shape: String(type?.shape || 'rooms'),
            templates,
            state: state ? { cover: state.cover, rough: state.rough } : null,
            bestiary,
            partySize: Math.max(1, partyMembers.length),
        });
        const below = levelName(boardName);
        built.terrain = terrainFromAsciiMap(withStairs(generated.map, start));
        /** @type {any} */ (built).next = below;
        levels.push({
            name: below, description: 'Más abajo.', url: '', gridWidth: deeper.gridWidth, gridHeight: deeper.gridHeight,
            terrain: terrainFromAsciiMap(deeper.map), partyStart: deeper.partyStart, enemyPlacements: deeper.enemies, objectives: [],
        });
    }
    place.boards = [...place.boards.filter((/** @type {any} */ b) => !levels.some(l => l.name === b?.name)), ...levels];
    if (ward) {
        ward.mapPosition = { locationName: placeName, gridX: Number(start.x) || 1, gridY: Number(start.y) || 1 };
        partyMembers.push(ward);
        savePartyState();
        renderPartyMembers();
        postCombatNarration(`🧳 [GREMIO] ${ward.name} va con vosotros: hay que llevarle vivo hasta la salida.`);
    }

    data.metadata = Object.assign(data.metadata ?? {}, { locationMaps: places });
    await saveWorldInfo(worldName, data, true);

    chat_metadata[TAKEN_KEY] = contract;
    chat_metadata[BOARD_KEY] = board.filter((/** @type {any} */ c) => String(c?.id) !== String(id));
    saveMetadata();

    const line = `Aceptado: ${describeContract(contract, Number(getCampaignCalendar()?.day) || 1)}`;
    postCombatNarration(`📄 [GREMIO] ${line}`);
    postCombatNarration(`🗺️ [GREMIO] El sitio ya existe: ${placeName} — ${boardName}.`);

    // Y quien va. Cada uno con su motivo, tambien los que se quedan: un "no" que no se
    // entiende no es una decision, es un error. Es la diferencia entre un compañero y una
    // ficha que a veces falta.
    const formed = formParty(partyMembers, contract, { max: Math.max(1, partyMembers.length) });
    for (const said of formed.lines) postCombatNarration(`🫱 [GREMIO] ${said}`);
    if (formed.going.length === 0) {
        toastr.warning('Nadie quiere ir a este. Mira sus motivos en el registro.', 'Sin grupo');
    }
    voiceOpinions(contract);
    toastr.success(`${placeName} — ${boardName}`, 'Encargo aceptado');
    renderLocationMapsPreview();
    return line;
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
 * Abre el panel de habilidades y guarda lo que salga.
 *
 * El catalogo viaja dentro del paquete de reglas del mundo, como las armas y las
 * condiciones; lo que cada personaje se sabe vive en su ficha.
 *
 * @returns {Promise<string>}
 */
async function openAbilitiesEditor() {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName) {
        toastr.warning('Abre una campana antes de escribir sus habilidades.');
        return '';
    }

    try {
        const data = await loadWorldInfo(worldName);
        if (!data) {
            toastr.warning(`No se pudo leer el mundo "${worldName}".`);
            return '';
        }

        const { openAbilitiesPanel } = await import('./game-engine/ui/abilities-panel.js');
        const edited = await openAbilitiesPanel({
            abilities: getPackAbilities(),
            party: partyMembers,
            conditions: getActiveRuleset()?.character?.conditions ?? [],
            Popup,
            POPUP_TYPE,
        });
        if (!edited) return '';

        // El paquete del mundo manda: si no tiene uno propio, se parte del activo para no
        // perder el resto de secciones al guardar solo las habilidades.
        const pack = structuredClone(data.metadata?.rulesetPack ?? getActiveRuleset());
        pack.abilities = edited.abilities;
        data.metadata = data.metadata ?? {};
        data.metadata.rulesetPack = pack;
        await saveWorldInfo(worldName, data, true);
        await applyCampaignRuleset(worldName);

        // Y lo que cada uno se sabe, en su ficha. Una habilidad borrada deja de saberse
        // sola, porque el panel ya la quito de las listas.
        const live = new Set(edited.abilities.map((/** @type {any} */ a) => a.id));
        for (const member of partyMembers) {
            const mine = edited.known[String(member.id)] ?? [];
            member.abilities = mine.filter((/** @type {string} */ id) => live.has(id));
        }
        savePartyState();
        renderPartyMembers();
        renderLocationMapsPreview();

        const total = edited.abilities.length;
        toastr.success(`${total} habilidad(es) guardadas con las reglas de "${worldName}".`);
        return `${total} habilidades`;
    } catch (error) {
        console.error('[party] abilities editor failed', error);
        toastr.error(String(error?.message || error), 'No se pudieron guardar las habilidades');
        return '';
    }
}

/**
 * Abre los ajustes de sonido, cargando el panel solo cuando hace falta.
 *
 * @returns {Promise<string>}
 */
async function openAudioSettings() {
    const { openAudioSettings: open } = await import('./game-engine/ui/audio-settings.js');
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

/** El catalogo de habilidades del paquete de reglas activo. */
/**
 * Lo que se puede saber hacer: el paquete del mundo, y debajo las filas del compendio.
 *
 * R3: las habilidades de clase del héroe salían del compendio y se escribían en su ficha,
 * pero el catálogo solo leía el paquete, así que en combate no aparecía ninguna. Ahora el
 * compendio entra debajo; si el paquete trae una con el mismo id, manda la del paquete.
 *
 * @returns {import('./game-engine/rules/abilities.js').Ability[]}
 */
const getAbilityCatalogue = () => {
    // R4: un conjuro del paquete (por su id, o el viejo de fila de datos) solo ajusta los
    // números del grimorio; lo que parezca magia y no esté en el grimorio no entra (DR3).
    /** @type {Map<string, Record<string, any>>} */
    const tuned = new Map();
    /** @type {any[]} */
    const plain = [];
    for (const row of Array.isArray(getActiveRuleset()?.abilities) ? getActiveRuleset().abilities : []) {
        const spell = spellById(String(row?.id ?? ''));
        if (spell) {
            tuned.set(spell.id, Object.fromEntries(['damage', 'healing', 'rangeFeet', 'saveDc', 'conditionRounds']
                .filter(key => row?.[key] !== undefined && row?.[key] !== '').map(key => [key, row[key]])));
            continue;
        }
        if (magicInData(row)) continue;
        plain.push(row);
    }
    const pack = normalizeAbilities(plain);
    const have = new Set(pack.map(ability => ability.id));
    const rows = lastCompendium?.has?.('habilidades')
        ? lastCompendium.find('habilidades', { kind: 'habilidad' }).map(asAbility)
            .filter((/** @type {any} */ a) => !have.has(String(a.id)) && !magicInData(a))
        : [];
    const magic = grimoireAbilities().map(ability => ({ ...ability, ...(tuned.get(ability.id) ?? {}), aliases: spellById(ability.id)?.aliases ?? [] }));
    return [...pack, ...normalizeAbilities(rows), ...normalizeAbilities(magic)];
};

/**
 * R4: lo que lleva encima el grupo, por nombre, para los componentes de los conjuros.
 *
 * @returns {string[]}
 */
function carriedNames() {
    return partyMembers.filter(m => !m.dead).flatMap(m => (Array.isArray(m.items) ? m.items : []).map((/** @type {any} */ item) => String(item?.name ?? '')));
}

/**
 * R4: lo que gastan los conjuros que el grupo sabe, para que la botica lo tenga.
 *
 * @returns {string[]}
 */
function neededComponents() {
    return [...new Set(partyMembers.filter(m => !m.dead).flatMap(m => knownSpells(m)).map(s => String(s.component ?? '')).filter(Boolean))];
}

/**
 * R4: gastar un componente, de quien lo lleve.
 *
 * @param {string} name
 * @returns {boolean}
 */
function consumeComponent(name) {
    const wanted = String(name).trim().toLowerCase();
    for (const member of partyMembers) {
        const item = (Array.isArray(member.items) ? member.items : []).find((/** @type {any} */ i) => String(i?.name ?? '').trim().toLowerCase() === wanted);
        if (!item) continue;
        removeItemFromInventory(/** @type {any} */ (member), String(item.id));
        return true;
    }
    return false;
}

/**
 * R4: pagar un conjuro: la carga de su círculo y lo que gaste.
 *
 * @param {any} caster
 * @param {any} ability
 * @returns {string[]} Lo que se dice.
 */
function payForSpell(caster, ability) {
    /** @type {string[]} */
    const said = [];
    if (typeof ability?.circle !== 'number') return said;
    if (ability.circle > 0) caster.spellCharges = spendCharge(caster, ability.circle);
    // H1: el primer conjuro del grupo dice cómo va lo de las cargas.
    if (partyMembers.includes(caster)) showTip('spell');
    if (ability.component && partyMembers.includes(caster) && consumeComponent(ability.component)) {
        said.push(`🧪 Se gasta ${String(ability.component).toLowerCase()}.`);
    }
    return said;
}

/**
 * R4: la nigromancia, en un sitio con gente, es un crimen; y a los tuyos les parece lo que
 * les parece (a quien busca tranquilidad, mal).
 *
 * @param {any} ability
 * @returns {string[]}
 */
function magicConsequences(ability) {
    /** @type {string[]} */
    const said = [];
    if (ability?.school !== 'nigromancia') return said;
    judgeDecision('nigromancia', { quiet: true });
    const here = hereLocation();
    const type = String(here?.locationType ?? here?.type ?? '').toLowerCase();
    if (chat_metadata && currentLocationName && Object.hasOwn(WATCH, type)) {
        const wanted = readWanted(chat_metadata[WANTED_KEY]);
        const level = (wanted[currentLocationName] ?? 0) + 1;
        chat_metadata[WANTED_KEY] = { ...wanted, [currentLocationName]: level };
        saveMetadata();
        said.push(`👁️ [GUARDIAS] Alguien os ha visto usar nigromancia en ${currentLocationName}: ahora os buscan (buscados: ${level}).`);
        // R9: y quien manda aquí lo nota.
        void nudgeRuler(currentLocationName, 'nigromancia');
    }
    return said;
}

/** Solo las del paquete del mundo: lo que el editor de habilidades escribe. */
const getPackAbilities = () => normalizeAbilities(getActiveRuleset()?.abilities);

/**
 * El modificador de una caracteristica, que es la misma cuenta de siempre.
 *
 * @param {any} creature
 * @param {string} ability
 */
function abilityModifier(creature, ability) {
    return Math.floor(((Number(creature?.[ability]) || 10) - 10) / 2);
}

/**
 * Pone una condicion, con fecha de caducidad si la habilidad la trae.
 *
 * Lo puesto a mano con `/condition` no lleva apunte y se quita a mano; lo que pone una
 * habilidad se va solo al pasar las rondas que dijo. Un "una ronda" que dura para siempre
 * seria un numero decorativo.
 *
 * @param {any} creature
 * @param {string} who El id con el que el encuentro lo conoce.
 * @param {string} condition
 * @param {number} rounds
 */
function applyTimedCondition(creature, who, condition, rounds) {
    creature.activeConditions = Array.isArray(creature.activeConditions) ? creature.activeConditions : [];
    if (!creature.activeConditions.includes(condition)) creature.activeConditions.push(condition);

    combatEncounter.conditionTimers = addConditionTimer(combatEncounter.conditionTimers, {
        who, condition, round: Number(combatEncounter.round) || 1, rounds,
    });
}

/**
 * Quita lo que ya ha caducado al empezar una ronda.
 *
 * @returns {string[]} Lo que se ha ido, ya escrito.
 */
function expireTimedConditions() {
    const { timers, expired } = expireConditions(combatEncounter.conditionTimers, Number(combatEncounter.round) || 1);
    combatEncounter.conditionTimers = timers;
    if (expired.length === 0) return [];

    const lines = [];
    for (const gone of expired) {
        const enemy = combatEncounter.enemies.find(e => String(e.instanceId) === gone.who);
        const member = partyMembers.find(m => String(m.id) === gone.who);
        const creature = enemy || member;
        if (!creature) continue;

        creature.activeConditions = (Array.isArray(creature.activeConditions) ? creature.activeConditions : [])
            .filter((/** @type {string} */ c) => c !== gone.condition);
        lines.push(`✨ [COMBAT] A ${creature.name} se le pasa: ${gone.condition}.`);
    }
    return lines;
}

/**
 * Usa una habilidad sobre alguien, o sobre uno mismo.
 *
 * Resuelve y aplica: la decision de si se puede y de que pasa esta en `rules/abilities.js`,
 * y aqui solo se escribe en las fichas y se cuenta.
 *
 * @param {any} member Quien la usa.
 * @param {any} ability
 * @param {any} target El enemigo o el companero, o null para uno mismo.
 * @returns {string}
 */
function useAbility(member, ability, target) {
    const turnState = getCurrentTurnState();
    if (!combatEncounter.active || !turnState) {
        toastr.warning('No hay un turno de jugador activo.');
        return '';
    }

    const isSelf = ability.target === 'self';
    const subject = isSelf ? member : target;
    if (!subject) {
        toastr.warning('Esa habilidad necesita un objetivo.');
        return '';
    }

    const origin = member.mapPosition || { gridX: 0, gridY: 0 };
    const at = subject.mapPosition || { gridX: subject.gridX ?? 0, gridY: subject.gridY ?? 0 };
    const distanceFeet = isSelf ? 0 : getDistanceInFeet(
        origin.gridX || 0, origin.gridY || 0,
        at.gridX ?? at.x ?? 0, at.gridY ?? at.y ?? 0,
    );

    const alive = ability.target === 'enemy'
        ? (Number(subject.currentHp) || 0) > 0
        : (Number(subject.hp) || 0) > 0 || isSelf;

    const verdict = canUseAbility({
        member,
        ability,
        distanceFeet,
        hasAction: hasAction(combatEncounter, 'action'),
        hasBonus: hasAction(combatEncounter, 'bonus'),
        targetAlive: alive,
        // R4: los componentes de los conjuros.
        carried: carriedNames(),
    });
    if (!verdict.ok) {
        toastr.warning(verdict.reason);
        return '';
    }

    // El coste se paga aunque falle: lanzar y errar tambien gasta el turno.
    if (ability.cost !== 'free') {
        Object.assign(combatEncounter, useAction(combatEncounter, ability.cost === 'bonus' ? 'bonus' : 'action'));
    }
    member.abilityUses = spendAbilityUse(member, ability);
    // R4: un conjuro gasta una carga de su círculo y lo que pida.
    const paid = payForSpell(member, ability);

    // R3: a uno o en área, por el mismo camino que los enemigos.
    const lines = [...resolveAbilityOnBoard({ actor: member, side: 'party', ability, subject }), ...paid, ...magicConsequences(ability)];

    saveCombatState();
    savePartyState();
    postCombatNarration(lines.join('\n'));
    renderPartyMembers();
    renderLocationMapsPreview();
    if (!checkScenarioOutcome() && getAliveEnemies().length === 0 && !judgeCurrentScenario()) {
        postCombatNarration('🏆 [COMBAT] Todos los enemigos han sido derrotados.');
        endCombat('victory');
    }

    return `${member.name} usa ${ability.name}`;
}

/**
 * La casilla de alguien del tablero, sea del grupo o enemigo.
 *
 * @param {any} creature
 * @returns {{x: number, y: number}}
 */
function boardCellOf(creature) {
    return {
        x: Number(creature?.mapPosition?.gridX ?? creature?.gridX) || 0,
        y: Number(creature?.mapPosition?.gridY ?? creature?.gridY) || 0,
    };
}

/**
 * R3: a quién alcanzaría una habilidad apuntada a una casilla. El área no distingue bandos;
 * las que van sobre aliados solo tocan a los del bando de quien la lanza (una canción no
 * cura al enemigo), y quien la lanza nunca se da a sí mismo con lo que hace daño.
 *
 * @param {any} actor
 * @param {'party'|'enemy'} side
 * @param {any} ability
 * @param {any} subject
 * @returns {{cells: Array<{x: number, y: number}>, victims: Array<{kind: 'party'|'enemy', ref: any, x: number, y: number}>}}
 */
function abilityVictims(actor, side, ability, subject) {
    const aim = boardCellOf(subject);
    if (!isArea(ability.area)) {
        const kind = partyMembers.includes(subject) ? 'party' : 'enemy';
        return { cells: [aim], victims: [{ kind, ref: subject, ...aim }] };
    }
    const context = getActiveBoardContext();
    const cells = areaCells({
        area: ability.area, origin: boardCellOf(actor), aim,
        terrain: context.terrain, width: context.gridWidth, height: context.gridHeight,
    });
    /** @type {Array<{kind: 'party'|'enemy', ref: any, x: number, y: number}>} */
    const creatures = [
        ...getAliveEnemies().map(e => ({ kind: /** @type {'enemy'} */ ('enemy'), ref: e, ...boardCellOf(e) })),
        ...partyMembers.filter(m => !m.dead && (Number(m.hp) || 0) > 0).map(m => ({ kind: /** @type {'party'} */ ('party'), ref: m, ...boardCellOf(m) })),
    ];
    const friendly = ability.target === 'ally';
    const victims = creaturesIn(cells, creatures).filter(v => (friendly ? v.kind === side : v.ref !== actor));
    return { cells, victims };
}

/**
 * R3 del roadmap de profundidad: una habilidad sobre el tablero, a uno o en área, para los
 * dos bandos. Decide a quién toca (`rules/area.js`), tira por cada uno con
 * `planAbilityUse`, aplica, y deja su huella en el terreno (`rules/tags.js`): un rayo de
 * fuego prende las cajas, un cono de escarcha hiela el charco.
 *
 * @param {Object} input
 * @param {any} input.actor
 * @param {'party'|'enemy'} input.side
 * @param {any} input.ability
 * @param {any} input.subject El objetivo elegido, o quien la lanza si es sobre sí mismo.
 * @returns {string[]}
 */
function resolveAbilityOnBoard({ actor, side, ability, subject }) {
    const area = isArea(ability.area);
    const { cells, victims } = abilityVictims(actor, side, ability, subject);
    const friendly = ability.target === 'ally';
    /** @type {string[]} */
    const lines = [];
    if (area) {
        lines.push(`✨ ${actor.name} usa ${ability.name} (${describeArea(ability.area)}).`);
        if (victims.length === 0) lines.push('No alcanza a nadie.');
        const own = friendly ? [] : victims.filter(v => v.kind === side);
        if (own.length > 0) lines.push(`⚠️ También alcanza a ${own.map(v => v.ref.name).join(', ')}, de los suyos.`);
    }

    const context = getActiveBoardContext();
    const element = elementOf(ability);
    const outdoors = context.board ? !isIndoors(context.board, hereLocation()) : true;
    const wet = Boolean(boardVisibility().wet);
    // R4: lo que se quita con un conjuro que roba vida.
    let drained = 0;
    for (const victim of victims) {
        const target = victim.ref;
        const plan = planAbilityUse({
            actor,
            target,
            ability,
            roll: (/** @type {string} */ formula) => rollDiceDetailed(formula, 8),
            attackModifier: side === 'party'
                ? getPlayerAttackModifier(actor, ability.rangeFeet)
                : Math.max(getAbilityModifier(actor.strength || 10), getAbilityModifier(actor.dexterity || 10)),
            targetAc: friendly || target === actor ? 10 : getTargetArmorClass(target, actor).ac,
            saveModifier: abilityModifier(target, ability.saveAbility),
        });
        if (area) {
            lines.push(`➤ ${target.name}:`);
            lines.push(...plan.lines.slice(1));
        } else {
            lines.push(...plan.lines);
        }
        lines.push(...applyAbilityPlan({ actor, side, victim, plan }));
        if (ability.drain && victim.kind !== side) drained += plan.damage;

        // El elemento y dónde está, o cómo está: en el agua, el frío hiela.
        if (element && plan.hit && !plan.saved && (Number(target.currentHp ?? target.hp) || 0) > 0) {
            const standingOn = context.terrain ? getCell(context.terrain, victim.x, victim.y).type : 'floor';
            const conditions = [...(Array.isArray(target.activeConditions) ? target.activeConditions : []), ...(wet && outdoors ? ['Mojado'] : [])];
            const combo = comboFor({ element, standingOn, conditions });
            if (combo) {
                if (combo.remove) {
                    target.activeConditions = (Array.isArray(target.activeConditions) ? target.activeConditions : []).filter((/** @type {string} */ c) => c !== combo.remove);
                }
                if (combo.add) applyTimedCondition(target, victim.kind === 'enemy' ? String(target.instanceId) : String(target.id), combo.add, combo.rounds);
                lines.push(`${ELEMENT_ICONS[/** @type {keyof typeof ELEMENT_ICONS} */ (element)] ?? '✨'} ${target.name}: ${combo.line}.`);
            }
        }
    }

    // R4: lo que se roba, se queda.
    if (drained > 0) {
        const back = Math.floor(drained / 2);
        if (side === 'party') actor.hp = Math.min(Number(actor.maxHp) || 0, (Number(actor.hp) || 0) + back);
        else actor.currentHp = Math.min(Number(actor.maxHp) || 0, (Number(actor.currentHp) || 0) + back);
        if (back > 0) lines.push(`🩸 ${actor.name} se queda con ${back} PG de lo que quita.`);
    }

    // La huella en el tablero: lo que prende, lo que se hiela, lo que queda en el suelo.
    const board = context.board;
    if (board && context.terrain && (element || ability.leaves)) {
        let terrain = context.terrain;
        let hazards = Array.isArray(board.hazards) ? board.hazards : [];
        /** @type {string[]} */
        const said = [];
        if (element) {
            const out = reactTerrain({ element, cells, terrain, hazards, round: Number(combatEncounter.round) || 1, outdoors, wet });
            terrain = out.terrain;
            hazards = out.hazards;
            said.push(...out.lines);
            // R6: los barriles que ha tocado el fuego revientan.
            said.push(...explodeBarrels(out.changed.filter(c => c.from === 'barrel')));
        }
        // R4: un muro de fuego deja cada casilla ardiendo, sea de lo que sea (salvo la lluvia).
        if (ability.leaves === 'fuego' && !wet) {
            let lit = 0;
            for (const cell of cells) {
                if (hazards.some((/** @type {any} */ h) => h.kind === 'fuego' && h.armed !== false && Number(h.x) === cell.x && Number(h.y) === cell.y)) continue;
                hazards = [...hazards, fireAt({ x: cell.x, y: cell.y, round: Number(combatEncounter.round) || 1, what: 'Muro de fuego' })];
                lit++;
            }
            if (lit > 0) said.push(`🔥 Arden ${lit} casilla(s) durante tres rondas.`);
        }
        if (ability.leaves && Object.hasOwn(TERRAIN_TYPES, ability.leaves)) {
            let left = 0;
            for (const cell of cells) {
                if (getCell(terrain, cell.x, cell.y).type !== 'floor') continue;
                terrain = setTerrainCell(terrain, cell.x, cell.y, ability.leaves);
                left++;
            }
            if (left > 0) said.push(`🪤 El suelo queda ${ability.leaves === 'difficult' ? 'difícil de pisar' : 'cambiado'} en ${left} casilla(s).`);
        }
        if (said.length > 0) {
            board.terrain = terrain;
            board.hazards = hazards;
            persistBoardTerrain(board);
            lines.push(...said);
        }
    }
    return lines;
}

/**
 * R3: aplicar a una víctima lo que decidió `planAbilityUse`. El daño cae sobre quien sea,
 * del bando que sea: un área no pregunta.
 *
 * @param {Object} input
 * @param {any} input.actor
 * @param {'party'|'enemy'} input.side
 * @param {{kind: 'party'|'enemy', ref: any}} input.victim
 * @param {any} input.plan
 * @returns {string[]}
 */
function applyAbilityPlan({ actor, side, victim, plan }) {
    /** @type {string[]} */
    const lines = [];
    const target = victim.ref;
    if (plan.damage > 0) {
        if (victim.kind === 'enemy') {
            target.currentHp = Math.max(0, (Number(target.currentHp) || 0) - plan.damage);
            if (side === 'party') {
                combatEncounter.tally = noteDealt(combatEncounter.tally, actor.id, plan.damage, target.currentHp === 0);
                if (target.currentHp === 0) recordFeat(actor, 'kill', String(target.name));
            }
            floatOnToken(enemyTokenId(target), `-${plan.damage}`, 'damage');
            lines.push(`❤️ Estado de ${target.name}: ${target.currentHp}/${target.maxHp}`);
            if (target.currentHp === 0) {
                lines.push(`☠️ ${target.name} cae derrotado.`);
                combatEncounter.conditionTimers = clearTimersFor(combatEncounter.conditionTimers, String(target.instanceId));
            }
        } else {
            lines.push(...damagePartyMember(target, plan.damage, plan.crit));
        }
    }
    if (plan.healing > 0) {
        if (victim.kind === 'enemy') {
            target.currentHp = Math.min(Number(target.maxHp) || 0, (Number(target.currentHp) || 0) + plan.healing);
            lines.push(`❤️ Estado de ${target.name}: ${target.currentHp}/${target.maxHp}`);
        } else {
            const before = Number(target.hp) || 0;
            target.hp = Math.min(Number(target.maxHp) || before, before + plan.healing);
            lines.push(`❤️ Estado de ${target.name}: ${target.hp}/${target.maxHp}`);
            // Curar a quien estaba en el suelo lo levanta y borra la cuenta: es para lo que
            // sirve una curacion en mitad de un combate.
            if (before <= 0 && target.hp > 0) {
                target.deathSaves = clearDeathSaves();
                target.activeConditions = (Array.isArray(target.activeConditions) ? target.activeConditions : [])
                    .filter((/** @type {string} */ c) => c !== 'Unconscious');
                lines.push(`🙌 ${target.name} vuelve en si.`);
            }
        }
    }
    if (plan.condition) {
        applyTimedCondition(target, victim.kind === 'enemy' ? String(target.instanceId) : String(target.id), plan.condition, plan.conditionRounds);
    }
    return lines;
}

/**
 * Todo lo que el juego da por cierto, listo para guardarlo o devolverlo a su sitio.
 *
 * No incluye la conversacion: el chat es de SillyTavern y tiene su propio historial.
 * Volver a un punto deja el chat como esta y el mundo como estaba.
 *
 * @returns {any}
 */
function captureGameState() {
    return {
        // U2 del pegamento: todo lo de juego que dice el registro del estado…
        ...captureKeys(chat_metadata ?? {}),
        // …y lo que vive en memoria encima, que puede ir un paso por delante de lo guardado.
        party: partyMembers,
        combatEncounter,
        calendar: getCampaignCalendar(),
        bonds: getCampaignBonds(),
        campaignMap: getCampaignMap(),
        currentLocation: currentLocationName,
        currentBoard: currentBoardName,
    };
}

/**
 * Guarda un punto de retorno.
 *
 * @param {string} label
 * @param {boolean} [automatic]
 * @returns {string}
 */
function saveCheckpoint(label, automatic = false) {
    if (!chat_metadata || typeof chat_metadata !== 'object') return '';

    // La casilla de la campana. Con el guardado libre esto no dice nada; con el guardado
    // en el refugio es lo unico que le da peso a una herida permanente, porque si no
    // vuelves atras y Bruna conserva la pierna.
    const allowed = canCheckpoint(
        { inShelter: !currentBoardName, inCombat: Boolean(combatEncounter.active) },
        getActiveRuleset()?.survival ?? null,
    );
    if (!allowed.allowed) {
        // Un punto automatico no discute: si esta campana no guarda aqui, no guarda.
        if (!automatic) toastr.warning(allowed.reason, 'Aqui no se guarda');
        return '';
    }

    const checkpoint = createCheckpoint({ label, state: captureGameState(), automatic });
    const before = normalizeCheckpoints(chat_metadata[CHECKPOINT_KEY]);
    const after = addCheckpoint(before, checkpoint);
    chat_metadata[CHECKPOINT_KEY] = after;
    saveMetadata();
    // DU2: el mundo también vuelve. Lo que cambia de él va a un archivo aparte, para no
    // cargar el chat; el punto que se cae se lleva el suyo.
    void forgetWorldFiles(before.filter(cp => !after.some(kept => kept.id === cp.id)));
    void worldWrite(() => attachWorldToCheckpoint(checkpoint.id));

    postCombatNarration(`💾 [PARTIDA] Punto de retorno: ${describeCheckpoint(checkpoint)}.`);
    return checkpoint.id;
}

/**
 * U2 (DU2): lo que cambia del mundo jugando, copiado a un archivo para un punto de retorno.
 *
 * @param {string} id
 */
async function attachWorldToCheckpoint(id) {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName) return;
    try {
        const data = await loadWorldInfo(worldName);
        if (!data) return;
        const bytes = new TextEncoder().encode(JSON.stringify(captureWorld(data)));
        let binary = '';
        for (const byte of bytes) binary += String.fromCharCode(byte);
        const { uploadFileAttachment, deleteFileFromServer } = await import('./chats.js');
        const url = await uploadFileAttachment(`punto-${id}.json`, btoa(binary));
        const list = normalizeCheckpoints(chat_metadata?.[CHECKPOINT_KEY]);
        const target = list.find(cp => cp.id === id);
        if (!url) return;
        // El punto se cayó mientras se subía: su archivo sobra.
        if (!target) {
            await deleteFileFromServer(url, true);
            return;
        }
        target.worldFile = url;
        chat_metadata[CHECKPOINT_KEY] = list;
        saveMetadata();
    } catch (error) {
        console.error('[party] no se pudo guardar el mundo del punto', error);
    }
}

/**
 * Los archivos del mundo de los puntos que ya no están.
 *
 * @param {Array<{worldFile?: string}>} dropped
 */
async function forgetWorldFiles(dropped) {
    const files = dropped.map(cp => cp.worldFile).filter(Boolean);
    if (files.length === 0) return;
    const { deleteFileFromServer } = await import('./chats.js');
    for (const file of files) await deleteFileFromServer(String(file), true);
}

/**
 * Devolver el mundo a como estaba en un punto: sitios, facciones y dónde vive cada persona.
 *
 * @param {string} file
 * @returns {Promise<boolean>}
 */
async function restoreWorldFrom(file) {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName || !file) return false;
    try {
        const response = await fetch(file, { cache: 'no-store' });
        if (!response.ok) return false;
        const saved = await response.json();
        const data = await loadWorldInfo(worldName);
        if (!data || restoreWorld(data, saved) === 0) return false;
        await saveWorldInfo(worldName, data, true);
        await refreshWorldMapGlobals(worldName);
        return true;
    } catch (error) {
        console.error('[party] no se pudo devolver el mundo del punto', error);
        return false;
    }
}

/**
 * Devuelve la partida a un punto guardado.
 *
 * @param {string} id
 * @returns {Promise<boolean>}
 */
async function restoreCheckpoint(id) {
    const checkpoint = findCheckpoint(chat_metadata?.[CHECKPOINT_KEY], id);
    if (!checkpoint) {
        toastr.warning('Ese punto de retorno ya no esta.');
        return false;
    }

    const state = checkpoint.state ?? {};
    // U2 del pegamento: todo lo de juego vuelve a como estaba; en un punto de antes del
    // registro (versión 1), solo lo que traía.
    if (chat_metadata) restoreKeys(chat_metadata, state, Number(checkpoint.version) >= 2);

    // El grupo se reemplaza en el sitio: `partyMembers` es el array que todo el resto del
    // archivo tiene cogido, asi que cambiarlo por otro dejaria media interfaz mirando al
    // anterior.
    partyMembers.length = 0;
    for (const member of (Array.isArray(state.party) ? state.party : [])) {
        partyMembers.push(structuredClone(member));
    }

    combatEncounter = normalizeCombatEncounter(structuredClone(state.combatEncounter ?? null));
    currentLocationName = String(state.currentLocation ?? '');
    currentBoardName = String(state.currentBoard ?? '');
    combatBoardSelection = { tokenId: null, boardName: '', locationName: '' };
    usedReactions = new Set();

    saveCampaignState(structuredClone(state.calendar ?? null), structuredClone(state.bonds ?? null));
    if (state.campaignMap) campaign.saveMap(structuredClone(state.campaignMap));

    savePartyState();
    saveCombatState();
    saveCurrentLocation();
    saveCurrentBoard();

    // DU2: y el mundo, si el punto lo guardó.
    let world = false;
    if (checkpoint.worldFile) {
        await worldWrite(async () => {
            world = await restoreWorldFrom(String(checkpoint.worldFile));
        });
    }
    saveMetadata();
    refreshWorldMemoryPrompt();

    renderPartyMembers();
    renderCampaignTab();
    renderLocationMapsPreview();
    if (isShellOpen()) refreshGameShell();

    postCombatNarration(`⏪ [PARTIDA] Vuelta a: ${describeCheckpoint(checkpoint)}.${world ? ' El mundo también vuelve a como estaba.' : ''}`);
    return true;
}

/** Los umbrales de nivel del paquete de reglas activo. */
const getXpTable = () => getActiveRuleset()?.progression?.xpThresholds;

/** Los niveles que dan mejora de caracteristica, del mismo paquete. */
const getAbilityLevels = () => getActiveRuleset()?.progression?.abilityLevels;

/** @param {any} member */
function canLevelUp(member) {
    return levelForXp(member?.xp, getXpTable()) > Math.max(1, Math.floor(Number(member?.level) || 1));
}

/** Como se llaman las seis en la ficha. */
const ABILITY_LABELS = {
    strength: 'Fuerza',
    dexterity: 'Destreza',
    constitution: 'Constitucion',
    intelligence: 'Inteligencia',
    wisdom: 'Sabiduria',
    charisma: 'Carisma',
};

/**
 * Subir de nivel, con lo que da escrito antes de pulsar.
 *
 * Sube todos los niveles que la experiencia de de una vez, y para cuando hay que repartir
 * puntos de caracteristica se para a preguntar: es la unica eleccion de verdad que trae
 * subir de nivel, y decidirla por ti la convertiria en un numero mas.
 *
 * @param {any} member
 */
async function openLevelUpCard(member) {
    if (!member) return;

    // El dado de golpe sale de la clase, que vive en el Lorebook: por eso esto espera.
    const hitDieByClass = await campaign.getHitDiceByClass();
    const plan = planLevelUp({
        member,
        table: getXpTable(),
        abilityLevels: getAbilityLevels(),
        hitDieByClass,
    });

    if (!plan.canLevel) {
        toastr.info(plan.reason, member.name);
        return;
    }

    const root = $('<div class="lu-card"></div>');
    root.append($('<div class="lu-title"></div>').text(`${member.name}: nivel ${plan.from} → ${plan.to}`));
    root.append($('<div class="lu-gains"></div>').text(
        `+${plan.hpGained} PG · +${plan.hitDiceGained} dado(s) de golpe`));

    /** @type {Record<string, number>} */
    const picks = {};
    const remaining = $('<div class="lu-remaining"></div>');

    if (plan.pointsToSpend > 0) {
        root.append($('<div class="lu-subtitle"></div>').text('Mejora de caracteristica'));
        root.append(remaining);

        const grid = $('<div class="lu-abilities"></div>');
        for (const ability of ABILITIES) {
            const row = $('<div class="lu-ability"></div>');
            row.append($('<span class="lu-ability-name"></span>').text(ABILITY_LABELS[ability]));

            const value = $('<span class="lu-ability-value"></span>');
            const minus = $('<button class="menu_button lu-step" type="button">−</button>');
            const plus = $('<button class="menu_button lu-step" type="button">+</button>');

            const paint = () => {
                const added = picks[ability] || 0;
                const base = Number(member[ability]) || 10;
                value.text(added > 0 ? `${base} → ${base + added}` : String(base));
                row.toggleClass('changed', added > 0);
            };

            minus.on('click', () => {
                picks[ability] = Math.max(0, (picks[ability] || 0) - 1);
                if (picks[ability] === 0) delete picks[ability];
                paint();
                refresh();
            });
            plus.on('click', () => {
                picks[ability] = (picks[ability] || 0) + 1;
                paint();
                refresh();
            });

            row.append(minus, value, plus);
            grid.append(row);
            paint();
        }
        root.append(grid);
    }

    // Idea 46: una mejora a elegir entre tres. Con la semilla de quién sube y a qué nivel.
    const offered = perkChoices({
        member,
        random: createSeededRandom(derive(String(chat_metadata?.[METADATA_KEY] || ''), 'mejora', String(member.id), String(plan.to))),
    });
    let chosenPerk = '';
    if (offered.length > 0) {
        root.append($('<div class="lu-subtitle"></div>').text('Una mejora a elegir'));
        const perksBox = $('<div class="lu-perks"></div>');
        for (const perk of offered) {
            const button = $('<button type="button" class="menu_button lu-perk"></button>').attr('data-perk', perk.id);
            button.append($('<span class="lu-perk-name"></span>').text(perk.label));
            button.append($('<span class="lu-perk-desc"></span>').text(perk.describe));
            button.on('click', () => {
                chosenPerk = perk.id;
                perksBox.find('.lu-perk').removeClass('chosen');
                button.addClass('chosen');
                refresh();
            });
            perksBox.append(button);
        }
        root.append(perksBox);
    }

    const actions = $('<div class="lu-actions"></div>');
    const confirm = $('<button class="menu_button lu-btn lu-confirm" type="button"></button>').text('Subir de nivel');

    function refresh() {
        const picked = validateAbilityPicks(picks, plan, member);
        const verdict = picked.ok && offered.length > 0 && !chosenPerk
            ? { ok: false, error: 'Falta elegir una mejora.' }
            : picked;
        confirm.prop('disabled', !verdict.ok);
        confirm.attr('title', verdict.ok ? 'Escribe el nivel en la ficha' : verdict.error);
        const spent = Object.values(picks).reduce((total, value) => total + value, 0);
        remaining.text(`Quedan ${Math.max(0, plan.pointsToSpend - spent)} de ${plan.pointsToSpend} punto(s)`);
        remaining.toggleClass('over', spent > plan.pointsToSpend);
    }

    actions.append(confirm);
    root.append(actions);
    refresh();

    // Un popup y no una capa propia: esto se abre desde dentro de la ficha del personaje,
    // que es un `<dialog>` nativo, y un `<dialog>` pinta por encima de cualquier z-index.
    // La tarjeta quedaba detras de la ficha y no se podia pulsar — lo cazó el recorrido.
    const popup = new Popup(root, POPUP_TYPE.TEXT, null, { okButton: 'Ahora no' });

    confirm.on('click', () => {
        if (!validateAbilityPicks(picks, plan, member).ok) return;
        if (offered.length > 0 && !chosenPerk) return;
        Object.assign(member, buildLevelUpPatch(member, plan, picks));
        // Idea 46: lo elegido, que se nota jugando.
        const perkPatch = chosenPerk ? takePerk(member, chosenPerk) : null;
        if (perkPatch) Object.assign(member, perkPatch);
        // R4: quien hace magia aprende los conjuros de su clase del círculo que se le abre.
        const before = new Set((Array.isArray(member.abilities) ? member.abilities : []).map(String));
        const learned = spellsForClass({ className: String(member.class ?? ''), level: Number(member.level) || 1 }).filter(id => !before.has(id));
        if (learned.length > 0) {
            member.abilities = [...before, ...learned];
            postCombatNarration(`📖 [NIVEL] ${member.name} aprende: ${learned.map(id => spellById(id)?.name ?? id).join(', ')}.`);
        }
        savePartyState();
        renderPartyMembers();
        const perkNote = chosenPerk ? ` Mejora: ${offered.find(o => o.id === chosenPerk)?.label ?? chosenPerk}.` : '';
        postCombatNarration(`⭐ [NIVEL] ${describeLevelUp(member, plan)}${perkNote}`);
        void popup.complete(POPUP_RESULT.AFFIRMATIVE);
        renderLocationMapsPreview();
        if (isShellOpen()) refreshGameShell();
    });

    await popup.show();
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
function partyPurse() {
    return partyMembers.reduce((sum, m) => sum + Math.max(0, Number(m.gold) || 0), 0);
}

/**
 * Pagar del bolsillo del grupo, empezando por quien mas lleva.
 *
 * @param {number} amount
 * @returns {boolean} Si llegaba.
 */
function payFromParty(amount) {
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
 * Que alguien deje de salir y se quede en casa con un puesto.
 *
 * Sale del grupo —no pelea, no cobra, no come a cuenta del grupo— y entra en el gremio,
 * donde su puesto abarata algo cada semana.
 *
 * @param {any} member
 * @param {string} role
 * @returns {string}
 */
function retireMember(member, role) {
    if (combatEncounter.active) {
        toastr.warning('No en mitad de un combate.');
        return '';
    }
    if (String(partyMembers[0]?.id) === String(member.id)) {
        toastr.warning('El tuyo no se retira: es tu partida.');
        return '';
    }
    const result = retireTo(getGuild(), String(member.name), role);
    if (!result.ok) {
        toastr.warning(result.line);
        return '';
    }

    chat_metadata[GUILD_KEY] = result.guild;
    partyMembers = partyMembers.filter(m => String(m.id) !== String(member.id));
    saveMetadata();
    savePartyState();
    renderPartyMembers();

    noteDeed(result.line);
    void postForModel(`🏠 [GREMIO] ${result.line}`);
    toastr.success(result.line, 'Se queda en casa', { timeOut: 12000 });
    return result.line;
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
 * @returns {import('./game-engine/ui/shell/action-chips.js').ActionChip[]}
 */
/**
 * @param {number} [limit] Cuantas caben; sin decir, las de la fila.
 * @returns {import('./game-engine/ui/shell/action-chips.js').ActionChip[]}
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
        companions: partyMembers.filter(m => !m.dead).map(m => ({ name: m.name })),
        mentioned: namesInLastNarration(),
        places: getCurrentWorldLocationMaps()
            .filter(l => l.name !== currentLocationName)
            .map(l => ({ name: l.name })),
        boards: getLocationBoards(location).map((/** @type {any} */ b) => ({ name: b.name })),
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
        extras: offerChips(chat_metadata?.[OFFERS_KEY]),
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
 * @param {import('./game-engine/ui/shell/action-chips.js').ActionChip} chip
 */
function runShellChip(chip) {
    // Idea 144: hablar con alguien de aquí abre sus respuestas; despedirse las cierra. Y la
    // fila se redibuja en el acto, detrás de la frase empezada: si no, las respuestas no
    // salían hasta que pasara otra cosa.
    if (chip.id.startsWith('talk-local:') || chip.id === 'reply-bye') {
        talkingTo = chip.id === 'reply-bye' ? '' : chip.id.slice('talk-local:'.length);
        if (isShellOpen()) setTimeout(() => refreshGameShell(), 0);
    }
    // Idea 169: las que no cabian en la fila.
    if (chip.id === 'more') {
        openAllChips();
        return;
    }
    // Idea 137: tirar por lo que se esta escribiendo, sin borrarlo.
    if (chip.id.startsWith('typed:')) {
        const input = /** @type {HTMLTextAreaElement|null} */ (document.querySelector('#send_textarea'));
        runSkillCheck(chip.id.slice('typed:'.length), String(input?.value ?? ''));
        typedIntents = [];
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
        void import('./slash-commands.js').then(m => m.executeSlashCommandsWithOptions(chip.command));
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
    return repliesFor({ name: npc.name, rumors: rumorsLeftHere(), canPry: pry.ok, extra })
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

/** La tirada hecha que todavia no se ha enviado. Una por mensaje. */
const PENDING_CHECK_KEY = 'pendingCheck';

/**
 * Intentar algo fuera de combate: el motor tira y el narrador lee el resultado.
 *
 * El resultado viaja **dentro de tu mensaje**, que es lo unico que el modelo lee seguro.
 * Se guarda hasta que lo envias: volver a pulsar da la misma tirada, no otra.
 *
 * @param {string} skill
 * @returns {string}
 */
/** Lo que pide lo que se esta escribiendo (idea 137). */
/** @type {string[]} */
let typedIntents = [];

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
 * @param {string} skill
 * @param {string} [keep] Lo que ya estaba escrito: la tirada va delante y lo escrito se queda.
 * @returns {string}
 */
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

function runSkillCheck(skill, keep = '') {
    // Idea 138: si la pidio el narrador, con su dificultad, y la peticion se gasta.
    const asked = takeRequest(chat_metadata?.[CHECK_REQUESTS_KEY], skill, SKILLS);
    if (combatEncounter.active) {
        toastr.warning('En combate se pelea con la barra de abajo.');
        return '';
    }
    const pending = chat_metadata?.[PENDING_CHECK_KEY];
    if (pending?.draft) {
        toastr.info('Ya has tirado. Envia el mensaje antes de intentar otra cosa.');
        draftInChat(String(pending.draft));
        return String(pending.line || '');
    }

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
        dc: (asked.request ? asked.request.dc : DEFAULT_DC) - (SOCIAL_SKILLS.includes(skill) && talkingTo ? attitudeBonus(chat_metadata?.[ATTITUDES_KEY], talkingTo) : 0),
        ...(barrier.edge ? { edge: barrier.edge, why: 'no habla su lengua' } : {}),
    });
    if (result && asked.request && chat_metadata) chat_metadata[CHECK_REQUESTS_KEY] = asked.requests;
    if (!result) {
        toastr.warning(`No conozco esa tirada. Hay: ${Object.keys(SKILLS).join(', ')}.`);
        return '';
    }

    showCombatDiceRoll({
        title: `${member.name}: ${result.label}`,
        subtitle: result.success ? 'Sale' : 'No sale',
        formula: `1d20${result.modifier >= 0 ? '+' : ''}${result.modifier}`,
        detail: `d20(${result.natural}) ${result.modifier >= 0 ? '+' : ''}${result.modifier} = ${result.total}`,
        total: result.total,
        dc: result.dc,
        natural: result.natural,
        glyph: 'd20',
    });

    chat_metadata[PENDING_CHECK_KEY] = { line: result.line, draft: result.draft };
    // Idea 107: con el sitio, que es donde está la pista.
    notePlot({ kind: 'check', skill, success: result.success, place: currentLocationName });
    // Un encargo que se resuelve sin pelear se da por hecho con una tirada buena en su sitio.
    const takenNow = chat_metadata?.[TAKEN_KEY];
    if (settlesNoFight(takenNow, { place: currentLocationName, success: result.success })) finishTakenContract(takenNow);
    saveMetadata();
    draftInChat(String(keep).trim() ? `${result.line}\n${String(keep).trim()}` : result.draft);
    if (isShellOpen()) refreshGameShell();
    return result.line;
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
let lastCompendium = { has: () => false, find: () => [] };

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
function seedOfWorld(metadata) {
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
function biomeHere(metadata) {
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
 * @returns {Promise<{to: string, reason: string}>}
 */
async function travelWithTime(name, options = {}) {
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
    });
    // El motivo, no un boton que no hace nada: "el paso esta cerrado" es una meta.
    if (!plan.ok) return { to: '', reason: plan.reason };

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

    currentLocationName = match.name;
    currentBoardName = '';
    saveCurrentLocation();
    saveCurrentBoard();
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
    talkingTo = '';
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
    postForModel(note).catch(error => console.error('[party] travel note failed', error));

    return { to: match.name, reason: '' };
}

/**
 * Idea 199: el salón de la fama. Los caídos de todas las partidas, el más reciente arriba.
 */
function openHallOfFame() {
    const hall = readHall(/** @type {any} */ (extension_settings).partyHall);
    const body = $('<div class="jr-root hall-root"></div>');
    body.append($('<h3></h3>').text('Salón de la fama'));
    if (hall.length === 0) body.append($('<div class="jr-item"></div>').text('Todavía no ha caído nadie.'));
    for (const entry of hall) body.append($('<div class="jr-item hall-entry"></div>').text(describeHallEntry(entry)));
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
 * Idea 54: aprender con quien enseña. Se paga (ya pagado al pulsar), pasan los días, y la
 * habilidad entra en el catálogo del mundo si no estaba y en la ficha de quien aprende.
 *
 * @param {string} memberId
 * @param {string} abilityId
 * @returns {Promise<void>}
 */
async function learnAbility(memberId, abilityId) {
    const member = partyMembers.find(m => String(m.id) === String(memberId));
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    // R4: un conjuro no se escribe en el paquete: vive en el grimorio. Se aprende y ya.
    const spell = spellById(String(abilityId));
    if (member && spell) {
        member.abilities = [...new Set([...(Array.isArray(member.abilities) ? member.abilities.map(String) : []), spell.id])];
        for (let day = 0; day < LESSON.days; day++) advanceCampaignDay();
        savePartyState();
        const line = describeLesson(String(member.name), spellAbility(spell), currentLocationName);
        noteDeed(line);
        toastr.success(line, '📜 Aprendido', { timeOut: 10000 });
        return;
    }
    if (!member || !worldName || !lastCompendium?.has?.('habilidades')) return;
    const ability = lastCompendium.find('habilidades', { kind: 'habilidad' })
        .filter((/** @type {any} */ row) => String(row.id) === String(abilityId))
        .map(asAbility)[0];
    if (!ability) return;
    await worldWrite(async () => {
        const data = await loadWorldInfo(worldName);
        if (!data) return;
        const pack = structuredClone(data.metadata?.rulesetPack ?? getActiveRuleset());
        pack.abilities = Array.isArray(pack.abilities) ? pack.abilities : [];
        if (!pack.abilities.some((/** @type {any} */ a) => String(a?.id) === ability.id)) pack.abilities.push(ability);
        data.metadata = data.metadata ?? {};
        data.metadata.rulesetPack = pack;
        await saveWorldInfo(worldName, data, true);
    });
    await applyCampaignRuleset(worldName);
    member.abilities = [...new Set([...(Array.isArray(member.abilities) ? member.abilities.map(String) : []), ability.id])];
    for (let day = 0; day < LESSON.days; day++) advanceCampaignDay();
    savePartyState();
    const line = describeLesson(String(member.name), ability, currentLocationName);
    noteDeed(line);
    toastr.success(line, '📜 Aprendido', { timeOut: 10000 });
    await postForModel(`[APRENDIZAJE] ${line} Cuéntalo en dos frases. No inventes nada más.`);
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

    currentBoardName = match.name;
    saveCurrentBoard();
    return match.name;
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
    const { openCompendiumPanel } = await import('./game-engine/ui/compendio-panel.js');

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

        const { openRulesEditor } = await import('./game-engine/ui/rules-editor.js');
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
        const { findBrokenReferences, describeImpact } = await import('./game-engine/rules/rule-impact.js');
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
 * @returns {import('./game-engine/ui/shell/exploration-scene.js').ExplorationView}
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
 * @returns {import('./game-engine/ui/shell/game-shell.js').ShellOptions}
 */
function buildShellOptions() {
    installNoticeTray();
    applyColorblind();
    // El panel podia estar plegado antes de encender el Shell, y apagarlo tiene que
    // dejarlo como estaba: el Shell lo despliega porque es su escenario, no porque el
    // jugador lo pidiera.
    const wasHidden = locationMapsManuallyHidden;
    return {
        getSituation: buildShellSituation,
        getCombatBar: buildShellCombatBar,
        getDialogue: buildShellDialogue,
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
        getFocus: () => focusOf(getPlot(), chat_metadata?.[PLOT_STATE_KEY], campaignDay()),
        onJournal: () => openJournalSafely(),
        onGlance: () => openPartyGlance(),
        getNoticeCount: () => unseenCount(notices, noticesSeenAt),
        onTray: () => openNoticeTray(),
        getMeter: () => lastMeter,
        onMeter: () => { void import('./game-engine/ui/prompt-preview.js').then(m => m.openPromptPreview({ Popup, POPUP_TYPE })); },
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
        onOptions: () => { $('#ai-config-button .drawer-toggle').trigger('click'); },
        onRules: () => { void openRules(); },
        onCompendium: () => { void openCompendiumLibrary(); },
        // Idea 181: el comprobador de densidad, desde la partida.
        onCheckWorld: () => { void checkCurrentWorld(); },
        // Idea 199: los caídos de todas las partidas.
        countHall: () => readHall(/** @type {any} */ (extension_settings).partyHall).length,
        onHall: () => { openHallOfFame(); },
        onEditCampaign: () => { void openCampaignBuilder(); },
        // El asistente de campana vive en la pantalla de bienvenida, que viaja dentro del
        // chat adoptado: pulsar su boton es pulsar el que ya existe.
        // R1: la partida rápida, el mismo taller en su vista corta.
        onQuickStart: () => {
            void import('./campaigns.js')
                .then(({ startQuickCampaign }) => startQuickCampaign())
                .catch(error => {
                    console.error('[party] la partida rápida no pudo empezar', error);
                    toastr.error('La partida rápida no ha podido empezar. Queda anotado en la consola.');
                });
        },
        onNewCampaign: () => {
            const button = document.querySelector('#cw-new-campaign');
            if (button instanceof HTMLElement) button.click();
            else toastr.info('Abre "Nueva campana" desde la lista de partidas.');
        },
        countCampaigns: () => document.querySelectorAll(
            '#game-shell .campaign-card, #game-shell .campaign-card-unstarted').length,
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
        onScene: (scene) => showTip(scene),
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
            if (id === 'saver') localFlag.set(SAVER_KEY, saverOn() ? '' : '1');
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

function renderLocationMapsPreview() {
    drawLocationMapsPreview();
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
            <div class="wm-location-toolbar-title"><i class="fa-solid fa-map-location-dot"></i> ${t`Location Maps`}</div>
            <div class="wm-location-toolbar-actions">
                <button class="menu_button" data-location-toggle>${locationMapsManuallyHidden ? t`Open` : t`Hide`}</button>
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
        shell.append(`<div class="wm-location-collapsed">${t`The location panel stays hidden until you open it manually.`}</div>`);
        return;
    }

    const contentRoot = $('<div class="wm-location-content"></div>');
    shell.append(contentRoot);

    const locationMaps = getCurrentWorldLocationMaps();
    if (!locationMaps || locationMaps.length === 0) {
        contentRoot.html(`<div class="wm-empty-state">${t`No location maps available.`}</div>`);
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
                <div class="wm-loc-chooser-title"><i class="fa-solid fa-compass"></i> ${t`Where are you?`}</div>
                <div class="wm-loc-choose-grid">${cards}</div>
            </div>
        `);
        contentRoot.find('.wm-loc-choose-card').on('click', function () {
            currentLocationName = String($(this).data('loc'));
            currentBoardName = '';
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
            <div class="wm-view-tab" data-view="world"><i class="fa-solid fa-globe"></i> World</div>
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
                    currentLocationName = l.name;
                    saveCurrentLocation();
                },
                onLocationNavigate: (l) => {
                    currentLocationName = l.name;
                    saveCurrentLocation();
                    renderLocationMapsPreview();
                },
            });
        }
    });

    const leaveLocBtn = $(`<button class="menu_button wm-leave-loc-btn"><i class="fa-solid fa-arrow-left"></i> ${t`Leave location`}</button>`);
    leaveLocBtn.on('click', () => {
        currentLocationName = '';
        currentBoardName = '';
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

    const tokens = /** @type {import('./world-map-renderer.js').TokenData[]} */ (buildTokens(currentLocationName));

    // ---- Board drill-down: if a board is selected, show it instead of the location ----
    if (selectedBoard) {
        // Board selected — render board map with a "Back to location" button
        const backBtn = $(`<button class="menu_button wm-leave-loc-btn"><i class="fa-solid fa-arrow-left"></i> ${t`Back to`} ${escapeHtml(loc.name)}</button>`);

        // Se queda a la vista, apagado y diciendo por que: esconderlo haria pensar que
        // salir del tablero ya no existe, cuando lo que pasa es que hay que acabar antes.
        const heldBack = holdDuringCombat(combatEncounter, 'board');
        backBtn.attr('title', heldBack || `${t`Back to`} ${loc.name}`);
        backBtn.prop('disabled', Boolean(heldBack));
        backBtn.on('click', () => {
            if (holdDuringCombat(combatEncounter, 'board')) return;
            currentBoardName = '';
            combatBoardSelection = { tokenId: null, boardName: '', locationName: '' };
            saveCurrentBoard();
            renderLocationMapsPreview();
        });
        const boardPanel = $('<div data-map-root></div>');
        contentRoot.append(backBtn, boardPanel);

        const boardTokens = /** @type {import('./world-map-renderer.js').TokenData[]} */ (buildTokens(currentLocationName));
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
        if (!combatEncounter.active) {
            const awake = awakePlacements(selectedBoard.rooms, selectedBoard.enemyPlacements ?? [])
                .filter((/** @type {any} */ p) => !fogOn
                    || fogState.visible.has(cellKey(Number(p.x) || 0, Number(p.y) || 0)));
            if (awake.length > 0) contentRoot.append(buildStartCombatButton(selectedBoard, awake));
        }

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
                <div class="wm-boards-section-title"><i class="fa-solid fa-chess-board"></i> ${t`Boards`}</div>
                <div class="wm-loc-choose-grid">${boardCards}</div>
            </div>
        `);
        boardsSection.find('.wm-loc-choose-card').on('click', function () {
            currentBoardName = String($(this).data('board'));
            combatBoardSelection = { tokenId: null, boardName: '', locationName: '' };
            saveCurrentBoard();
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

/**
 * @param {PartyMember} member
 */
async function openPartyMemberModal(member) {
    // Ensure member has all D&D fields
    const m = migratePartyMember(member);
    Object.assign(member, m);

    const popupContent = $('<div class="dnd-modal"></div>');
    const dndCatalog = await loadDndCatalog(getMemberWorldName(member));

    // ---- Tab bar ----
    const tabs = ['Character Sheet', 'Inventory', 'Progression', 'Relationships', 'Memories'];
    const tabBar = $('<div class="dnd-tabs"></div>');
    for (const tabName of tabs) {
        const tabId = tabName.toLowerCase().replace(/\s+/g, '_');
        tabBar.append(`<div class="dnd-tab" data-tab="${tabId}">${tabName}</div>`);
    }
    popupContent.append(tabBar);

    // ---- Tab panels ----
    popupContent.append(buildCharacterSheetTab(member, dndCatalog));
    popupContent.append(buildInventoryTab(member));
    popupContent.append(buildProgressionTab(member, dndCatalog));
    popupContent.append(buildRelationshipsTab(member));
    popupContent.append(buildMemoriesTab(member));

    // ---- Tab switching ----
    popupContent.find('.dnd-tab').on('click', function () {
        const tabId = $(this).data('tab');
        popupContent.find('.dnd-tab').removeClass('active');
        $(this).addClass('active');
        popupContent.find('.dnd-tab-panel').removeClass('active');
        popupContent.find(`.dnd-tab-panel[data-panel="${tabId}"]`).addClass('active');
    });

    // Activate first tab
    popupContent.find('.dnd-tab').first().addClass('active');
    popupContent.find('.dnd-tab-panel').first().addClass('active');

    const popup = new Popup(popupContent, POPUP_TYPE.TEXT, '', {
        wide: true,
        wider: true,
        allowVerticalScrolling: true,
        okButton: t`Close`,
    });

    await popup.show();

    // Save changes on close
    const idx = partyMembers.findIndex(p => p.id === member.id);
    if (idx !== -1) {
        partyMembers[idx] = member;
        renderPartyMembers();
        savePartyState();
        // Sync changes back to World Info entry
        syncPartyMemberToWorldInfo(member);
        // If this is the party leader, update the active chat speaker name
        if (idx === 0) {
            setUserName(member.name, { toastPersonaNameChange: false });
        }
    }
}

// ============================================================
//  CHARACTER SHEET TAB
// ============================================================

/**
 * @param {PartyMember} member
 * @param {DndCatalog} dndCatalog
 * @returns {JQuery}
 */
function buildCharacterSheetTab(member, dndCatalog) {
    const panel = $('<div class="dnd-tab-panel" data-panel="character_sheet"></div>');
    const sheet = $('<div class="dnd-sheet"></div>');

    // Header (editable name + clickable avatar)
    const header = $(`
        <div class="dnd-sheet-header">
            <div class="dnd-avatar-wrapper" title="Click to change avatar">
                <img class="dnd-sheet-avatar" src="${member.avatar}" alt="${member.name}" />
                <div class="dnd-avatar-overlay"><i class="fa-solid fa-camera"></i></div>
                <input type="file" class="dnd-avatar-input" accept="image/*" style="display:none" />
            </div>
            <div class="dnd-sheet-identity">
                <input type="text" class="dnd-sheet-name-input" value="${member.name}" placeholder="Character name" />
                <div class="dnd-sheet-class-level">${[member.race, `Level ${member.level} ${member.class}`].filter(Boolean).join(' · ')}</div>
            </div>
        </div>
    `);

    // Name editing
    header.find('.dnd-sheet-name-input').on('change', function () {
        const newName = String($(this).val()).trim();
        if (newName) {
            member.name = newName;
        }
    });

    // Avatar click -> open file picker
    header.find('.dnd-avatar-wrapper').on('click', function (e) {
        if ($(e.target).hasClass('dnd-avatar-input')) return;
        header.find('.dnd-avatar-input')[0].click();
    });

    // Avatar file selected -> convert to data URL
    header.find('.dnd-avatar-input').on('change', function () {
        const file = /** @type {HTMLInputElement} */ (this).files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = function (e) {
            const dataUrl = e.target?.result;
            if (typeof dataUrl === 'string') {
                member.avatar = dataUrl;
                header.find('.dnd-sheet-avatar').attr('src', dataUrl);
            }
        };
        reader.readAsDataURL(file);
    });

    sheet.append(header);

    const renderIdentitySubtitle = () => {
        header.find('.dnd-sheet-class-level').text([member.race, `Level ${member.level} ${member.class}`].filter(Boolean).join(' · '));
    };

    // Race / Factions / Location
    const identityRow = $(`
        <div class="dnd-field-row" style="gap:8px;align-items:flex-start;">
            <div style="flex:1;min-width:160px;">
                <label class="dnd-field-label">Race:</label>
                <select class="dnd-race-select text_pole"></select>
            </div>
            <div style="flex:1;min-width:180px;">
                <label class="dnd-field-label">Factions:</label>
                <select class="dnd-faction-select text_pole" multiple></select>
            </div>
            <div style="flex:1;min-width:180px;">
                <label class="dnd-field-label">Location:</label>
                <select class="dnd-location-select text_pole"></select>
            </div>
        </div>
    `);

    const raceOptions = Array.from(new Set([...(dndCatalog.races || []), String(member.race || '').trim()].filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const raceSelect = identityRow.find('.dnd-race-select');
    raceSelect.append('<option value="">—</option>');
    for (const race of raceOptions) {
        raceSelect.append(`<option value="${escapeHtml(race)}">${escapeHtml(race)}</option>`);
    }
    raceSelect.val(member.race || '');
    raceSelect.on('change', function () {
        member.race = String($(this).val() || '').trim();
        renderIdentitySubtitle();
    });

    // Las del mundo primero: son las que tienen planes y reloj, asi que poner a alguien
    // en una de ellas le da un motivo de verdad. Las escritas a mano siguen valiendo.
    const factionOptions = Array.from(new Set([
        ...getCurrentWorldFactions().map((/** @type {any} */ f) => String(f?.name || '')),
        ...(dndCatalog.factions || []),
        ...(member.factions || []),
    ].filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const factionSelect = identityRow.find('.dnd-faction-select');
    for (const faction of factionOptions) {
        factionSelect.append(`<option value="${escapeHtml(faction)}">${escapeHtml(faction)}</option>`);
    }
    factionSelect.val(Array.isArray(member.factions) ? member.factions : []);
    factionSelect.on('change', function () {
        // .val() returns an array for a multiple select, but a bare string otherwise;
        // calling .map() on that string would throw.
        const selected = $(this).val();
        const values = Array.isArray(selected) ? selected : (selected === null || selected === undefined || selected === '' ? [] : [selected]);
        member.factions = values.map(x => String(x));
    });

    const locationOptions = Array.from(new Set([...(dndCatalog.locations || []), String(member.mapPosition?.locationName || '').trim()].filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const locationSelect = identityRow.find('.dnd-location-select');
    locationSelect.append('<option value="">—</option>');
    for (const location of locationOptions) {
        locationSelect.append(`<option value="${escapeHtml(location)}">${escapeHtml(location)}</option>`);
    }
    locationSelect.val(member.mapPosition?.locationName || '');
    locationSelect.on('change', function () {
        member.mapPosition = member.mapPosition || { locationName: '', gridX: 0, gridY: 0 };
        member.mapPosition.locationName = String($(this).val() || '').trim();
    });

    sheet.append(identityRow);

    // Alignment
    const alignmentRow = $('<div class="dnd-alignment-row"></div>');
    const alignmentSelect = $(`
        <div class="dnd-field-row">
            <label class="dnd-field-label">Alignment:</label>
            <select class="dnd-alignment-select">
                <option value="">— None —</option>
            </select>
        </div>
    `);
    const sel = alignmentSelect.find('select');
    for (const a of ALIGNMENTS) {
        sel.append(`<option value="${a}" ${member.alignment === a ? 'selected' : ''}>${a}</option>`);
    }
    sel.on('change', function () {
        member.alignment = String($(this).val());
    });
    alignmentRow.append(alignmentSelect);
    sheet.append(alignmentRow);

    // Personality
    sheet.append(`
        <div class="dnd-field-row">
            <label class="dnd-field-label">Personality:</label>
            <textarea class="dnd-personality-input" rows="2" placeholder="Brave, impulsive, protective of friends...">${member.personality || ''}</textarea>
        </div>
    `);
    sheet.find('.dnd-personality-input').on('change', function () {
        member.personality = String($(this).val());
    });

    // Ability Scores
    sheet.append('<div class="dnd-section-title">Stats</div>');
    const statsGrid = $('<div class="dnd-stats-grid"></div>');
    const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

    for (const ability of abilities) {
        const value = /** @type {any} */ (member)[ability] || 10;
        const mod = getAbilityModifier(value);
        const box = $(`
            <div class="dnd-stat-box">
                <div class="dnd-stat-label">${ability.charAt(0).toUpperCase() + ability.slice(1)}</div>
                <input type="number" class="dnd-stat-value" data-stat="${ability}" value="${value}" min="1" max="30" />
                <div class="dnd-stat-modifier">${formatModifier(mod)}</div>
            </div>
        `);

        box.find('input').on('change', function () {
            const val = parseInt(String($(this).val()), 10) || 10;
            /** @type {any} */ (member)[ability] = val;
            member.classPresetDirty = true;
            $(this).siblings('.dnd-stat-modifier').text(formatModifier(getAbilityModifier(val)));
        });

        statsGrid.append(box);
    }
    sheet.append(statsGrid);

    // Derived stats
    const eqEffects = applyEquipmentEffects(member);
    const derivedRow = $('<div class="dnd-derived-row"></div>');

    const acBox = $('<div class="dnd-derived-box"></div>');
    const acLabel = $('<div class="dnd-derived-label">Armor Class</div>');
    if (eqEffects.acBonus !== 0) {
        acLabel.append(`<span class="dnd-ac-bonus">${eqEffects.acBonus > 0 ? '+' : ''}${eqEffects.acBonus}</span>`);
    }
    acBox.append(acLabel);
    if (eqEffects.acBonus !== 0) {
        acBox.append(`
            <div class="dnd-ac-display">
                <span class="dnd-ac-base">${eqEffects.baseAC}</span>
                <span class="dnd-ac-arrow">→</span>
                <span class="dnd-ac-total">${eqEffects.baseAC + eqEffects.acBonus}</span>
            </div>
        `);
    } else {
        acBox.append(`<div class="dnd-derived-value">${eqEffects.baseAC}</div>`);
    }
    derivedRow.append(acBox);

    // Max HP
    const hpBox = $(`
        <div class="dnd-derived-box">
            <div class="dnd-derived-label">Max HP</div>
            <input type="number" class="dnd-derived-input" data-field="maxHp" value="${member.maxHp}" min="1" />
        </div>
    `);
    hpBox.find('input').on('change', function () {
        member.maxHp = parseInt(String($(this).val()), 10) || 1;
        member.classPresetDirty = true;
    });
    derivedRow.append(hpBox);

    // Speed
    const speedBox = $(`
        <div class="dnd-derived-box">
            <div class="dnd-derived-label">Speed</div>
            <input type="number" class="dnd-derived-input" data-field="speed" value="${member.speed}" min="0" />
        </div>
    `);
    speedBox.find('input').on('change', function () {
        member.speed = parseInt(String($(this).val()), 10) || 30;
        member.classPresetDirty = true;
    });
    derivedRow.append(speedBox);

    sheet.append(derivedRow);

    // Conditions (multi-select chip-based)
    sheet.append('<div class="dnd-section-title">Conditions</div>');
    const conditionsContainer = $('<div class="dnd-conditions-chips"></div>');
    const activeConditions = member.activeConditions || [];

    for (const cond of CONDITIONS) {
        const isActive = activeConditions.includes(cond);
        const chip = $(`<div class="dnd-condition-chip ${isActive ? 'active' : ''}" data-condition="${cond}">${cond}</div>`);
        chip.on('click', function () {
            const idx = member.activeConditions.indexOf(cond);
            if (idx >= 0) {
                member.activeConditions.splice(idx, 1);
                $(this).removeClass('active');
            } else {
                member.activeConditions.push(cond);
                $(this).addClass('active');
            }
            // Also sync the legacy text field
            member.conditions = member.activeConditions.join(', ');
        });
        conditionsContainer.append(chip);
    }
    sheet.append(conditionsContainer);

    panel.append(sheet);
    return panel;
}

// ============================================================
//  INVENTORY TAB
// ============================================================

/**
 * @param {PartyMember} member
 * @returns {JQuery}
 */
function buildInventoryTab(member) {
    const panel = $('<div class="dnd-tab-panel" data-panel="inventory"></div>');
    const inventory = $('<div class="dnd-inventory"></div>');

    // ---- Left: Equipped Items ----
    const left = $('<div class="dnd-inventory-left"></div>');
    left.append('<div class="dnd-section-title">Equipped Items</div>');

    const equipGrid = $('<div class="dnd-equipment-grid"></div>');

    // Layout rows matching a simplified character paper doll
    const slotRows = [
        [EQUIPMENT_SLOTS.HEAD],
        [EQUIPMENT_SLOTS.WEAPON, EQUIPMENT_SLOTS.BODY, EQUIPMENT_SLOTS.SHIELD],
        [EQUIPMENT_SLOTS.HANDS, EQUIPMENT_SLOTS.RING],
        [EQUIPMENT_SLOTS.FEET],
    ];

    for (const row of slotRows) {
        const rowEl = $('<div class="dnd-equipment-row"></div>');
        for (const slotKey of row) {
            const info = SLOT_INFO[slotKey];
            const equippedItem = getEquippedItem(member, slotKey);
            const slotEl = $(`<div class="dnd-equipment-slot ${equippedItem ? 'occupied' : ''}" data-slot="${slotKey}" title="${info.label}"></div>`);

            if (equippedItem && equippedItem.image) {
                slotEl.append(`<img class="dnd-equipment-slot-img" src="${equippedItem.image}" alt="${equippedItem.name}" />`);
            } else if (equippedItem) {
                slotEl.append(`<i class="dnd-equipment-slot-icon fa-solid ${info.icon}"></i>`);
                slotEl.append(`<span style="font-size:0.6rem;color:#2dd4bf;margin-top:2px;">${equippedItem.name}</span>`);
            } else {
                slotEl.append(`<i class="dnd-equipment-slot-icon fa-solid ${info.icon}"></i>`);
            }

            slotEl.append(`<span class="dnd-equipment-slot-label">${info.label}</span>`);

            slotEl.on('click', function () {
                if (equippedItem) {
                    tryUnequip(member, slotKey);
                    rebuildInventoryPanel(panel, member);
                } else {
                    showEquipSelector(panel, member, slotKey);
                }
            });

            rowEl.append(slotEl);
        }
        equipGrid.append(rowEl);
    }

    left.append(equipGrid);
    inventory.append(left);

    // ---- Right: Currency, Stats, Carrying ----
    const right = $('<div class="dnd-inventory-right"></div>');

    // Currency
    right.append('<div class="dnd-section-title">Currency</div>');
    const currencyRow = $('<div class="dnd-currency"></div>');
    for (const [key, label] of [['gold', 'Gold Pieces'], ['silver', 'Silver Pieces'], ['copper', 'Copper Pieces']]) {
        const item = $(`
            <div class="dnd-currency-item">
                <input type="number" class="dnd-currency-value" data-currency="${key}" value="${/** @type {any} */ (member)[key] || 0}" min="0" />
                <span class="dnd-currency-label">${label}</span>
            </div>
        `);
        item.find('input').on('change', function () {
            /** @type {any} */ (member)[key] = parseInt(String($(this).val()), 10) || 0;
        });
        currencyRow.append(item);
    }
    right.append(currencyRow);

    // Stats summary
    right.append('<div class="dnd-section-title" style="margin-top:12px">Stats</div>');
    const eqEffects = applyEquipmentEffects(member);
    const statsGrid = $('<div class="dnd-inv-stats"></div>');
    const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
    for (const ab of abilities) {
        const bonus = eqEffects.statBonuses[ab] || 0;
        const base = /** @type {any} */ (member)[ab] || 10;
        const display = bonus ? `${base} + ${bonus}` : `${base}`;
        statsGrid.append(`
            <div class="dnd-inv-stat">
                <div class="dnd-inv-stat-label">${ab.charAt(0).toUpperCase() + ab.slice(1)}</div>
                <div class="dnd-inv-stat-value">${display}</div>
            </div>
        `);
    }
    right.append(statsGrid);

    // Carrying Capacity
    const totalWeight = calculateTotalWeight(member.items || []);
    const maxCapacity = calculateCarryingCapacity(member.strength || 10);
    const pct = maxCapacity > 0 ? Math.min(100, (totalWeight / maxCapacity) * 100) : 0;

    right.append(`
        <div class="dnd-carrying">
            <div class="dnd-carrying-title">Carrying Capacity</div>
            <div class="dnd-carrying-bar-bg">
                <div class="dnd-carrying-bar-fill ${pct > 100 ? 'overweight' : ''}" style="width:${pct}%"></div>
            </div>
            <div class="dnd-carrying-text">${totalWeight.toFixed(1)}/${maxCapacity} lbs.</div>
        </div>
    `);

    inventory.append(right);
    panel.append(inventory);

    // ---- Item sub-tabs and list ----
    buildItemListSection(panel, member);

    return panel;
}

/**
 * Rebuild the inventory panel content
 * @param {JQuery} panel
 * @param {PartyMember} member
 */
function rebuildInventoryPanel(panel, member) {
    panel.empty();
    const newContent = buildInventoryTab(member);
    panel.append(newContent.children());
    panel.addClass('active');
}

/**
 * Show a simple selector popup for equipping an item to a slot
 * @param {JQuery} panel
 * @param {PartyMember} member
 * @param {string} slot
 */
function showEquipSelector(panel, member, slot) {
    // Renunciar al escudo tiene que pagar algo, o nadie renunciaria al escudo. Y se dice
    // el motivo, que es lo que convierte una regla en una decision entendida.
    if (slot === 'shield') {
        const sinMano = shieldBlocked(member);
        if (sinMano) {
            toastr.info(sinMano, 'No puedes llevar escudo');
            return;
        }
    }

    const eligibleItems = (member.items || []).filter(item => {
        if (item.slot !== slot) return false;
        // Check not already equipped
        for (const eqId of Object.values(member.equippedItems || {})) {
            if (eqId === item.id) return false;
        }
        return true;
    });

    if (eligibleItems.length === 0) {
        toastr.info(t`No items available for this slot.`);
        return;
    }

    const html = eligibleItems.map(item => `
        <div class="dnd-item-card" data-item-id="${item.id}" style="cursor:pointer;">
            ${item.image ? `<img class="dnd-item-img" src="${item.image}" />` : '<div class="dnd-item-img-placeholder"><i class="fa-solid fa-box"></i></div>'}
            <div class="dnd-item-info">
                <div class="dnd-item-name">${shownName(item)}</div>
                <div class="dnd-item-meta">${item.type} · ${item.weight} lbs</div>
            </div>
        </div>
    `).join('');

    const popupEl = $(`<div style="max-width:400px"><div class="dnd-section-title">Select item for ${SLOT_INFO[slot]?.label || slot}</div><div class="dnd-item-list">${html}</div></div>`);

    const selectorPopup = new Popup(popupEl, POPUP_TYPE.TEXT, '', {
        okButton: t`Cancel`,
    });

    popupEl.find('.dnd-item-card').on('click', function () {
        const itemId = $(this).data('item-id');
        tryEquip(member, itemId, slot);
        selectorPopup.complete(0);
        rebuildInventoryPanel(panel, member);
    });

    selectorPopup.show();
}

/**
 * @param {JQuery} form
 */
function refreshPartyItemFormState(form) {
    const categoryEl = form.find('.item-category');
    const subcategoryEl = form.find('.item-subcategory');
    const slotEl = form.find('.item-slot');
    if (!categoryEl.length || !subcategoryEl.length) return;

    const category = String(categoryEl.val() || 'gear');
    const currentSubcategory = String(subcategoryEl.val() || 'generic');
    const subcategoryOptions = getItemSubcategoryOptions(category);
    subcategoryEl.html(subcategoryOptions.map(([value, label]) => `<option value="${escItemText(value)}">${escItemText(label)}</option>`).join(''));
    subcategoryEl.val(subcategoryOptions.some(([value]) => value === currentSubcategory) ? currentSubcategory : (subcategoryOptions[0]?.[0] || 'generic'));

    const subcategory = String(subcategoryEl.val() || 'generic');
    const armorDexModeEl = form.find('.item-armor-dex-mode');
    const resistanceEnabled = Boolean(form.find('.item-flag[data-flag="resistanceEnabled"]').prop('checked'));
    const isEmitsLight = Boolean(form.find('.item-emits-light').prop('checked'));
    form.find('.dnd-item-conditional').each(function () {
        /** @type {HTMLElement} */
        const element = /** @type {HTMLElement} */ (this);
        const categories = String(element.getAttribute('data-item-categories') || '').split(',').map(value => value.trim()).filter(Boolean);
        const subcategories = String(element.getAttribute('data-item-subcategories') || '').split(',').map(value => value.trim()).filter(Boolean);
        const categoryMatch = !categories.length || categories.includes(category);
        const subcategoryMatch = !subcategories.length || subcategories.includes(subcategory);
        $(element).toggle(categoryMatch && subcategoryMatch);
    });

    const suggestedSlot = getSuggestedSlotForItem(category, subcategory);
    if (subcategory === 'basic_consumable') {
        slotEl.val('');
    } else if (subcategory === 'container') {
        slotEl.val('container');
    } else if (suggestedSlot != null) {
        slotEl.val(suggestedSlot || '');
    }

    const consumableEl = form.find('.item-consumable');
    if (subcategory === 'basic_consumable') {
        consumableEl.prop('checked', true);
        consumableEl.prop('disabled', true);
    } else {
        consumableEl.prop('disabled', false);
    }

    const stackableEl = form.find('.item-flag[data-flag="stackable"]');
    const stackSizeWrap = form.find('.item-stack-size').closest('.dnd-form-row');
    if (stackSizeWrap.length) {
        const shouldShowStack = subcategory === 'basic_consumable';
        stackSizeWrap.toggle(shouldShowStack && Boolean(stackableEl.prop('checked')));
    }

    const lightFieldsWrap = form.find('.dnd-item-light-fields');
    if (lightFieldsWrap.length) {
        lightFieldsWrap.toggle(subcategory === 'exploration_tool' && isEmitsLight);
    }

    const meleeRangeEl = form.find('.item-melee-range');
    if (meleeRangeEl.length) {
        if (isMeleeWeaponSubcategory(subcategory)) {
            meleeRangeEl.prop('disabled', subcategory !== 'generic');
            if (subcategory !== 'generic') {
                meleeRangeEl.val('5');
            }
        } else {
            meleeRangeEl.prop('disabled', false);
        }
    }

    if (category === 'armor' && armorDexModeEl.length) {
        if (subcategory === 'generic') {
            armorDexModeEl.prop('disabled', false);
            if (!armorDexModeEl.val()) armorDexModeEl.val('full');
        } else {
            const implicitMode = subcategory === 'medium_armor' ? 'max_2' : (subcategory === 'heavy_armor' || subcategory === 'shield' ? 'none' : 'full');
            armorDexModeEl.val(implicitMode);
            armorDexModeEl.prop('disabled', true);
        }
    }

    const armorDexNoteEl = form.find('.dnd-armor-dex-note');
    if (armorDexNoteEl.length) {
        armorDexNoteEl.text(getArmorDexRuleLabel(subcategory, String(armorDexModeEl.val() || 'full')));
    }

    const resistanceWrap = form.find('.dnd-item-resistance-conditional');
    if (resistanceWrap.length) {
        resistanceWrap.toggle(category === 'armor' && resistanceEnabled);
    }

    // magic_weapon_armor: force Combat and Defense Stats section wrappers to show
    if (category === 'magic' && subcategory === 'magic_weapon_armor') {
        form.find('.dnd-item-conditional').each(function () {
            const el = /** @type {HTMLElement} */ (this);
            const catAttr = (el.getAttribute('data-item-categories') || '').split(',').map(s => s.trim());
            const subAttr = (el.getAttribute('data-item-subcategories') || '').split(',').map(s => s.trim()).filter(Boolean);
            if ((catAttr.includes('weapon') || catAttr.includes('armor')) && subAttr.length === 0) {
                $(el).show();
            }
        });
    }

    // Auto-consumable for potion_oil and scroll: check and lock the consumable checkbox
    if (category === 'magic') {
        const magicFlags = getMagicSubtypeFlags(subcategory);
        if (magicFlags.autoConsumable) {
            consumableEl.prop('checked', true);
            consumableEl.prop('disabled', true);
        } else {
            consumableEl.prop('disabled', false);
        }
    }
}

/**
 * Build the item list section with sub-tabs, search, and add button
 * @param {JQuery} panel
 * @param {PartyMember} member
 */
function buildItemListSection(panel, member) {
    const section = $('<div style="margin-top: 16px;"></div>');

    // Sub-tabs
    const itemTabs = $('<div class="dnd-item-tabs"></div>');
    const tabDefs = [
        { key: 'all', label: 'All', icon: 'fa-table-cells' },
        { key: 'weapon', label: 'Weapons', icon: 'fa-sword' },
        { key: 'armor', label: 'Armor', icon: 'fa-shield-halved' },
        { key: 'gear', label: 'Gear', icon: 'fa-toolbox' },
    ];

    for (const td of tabDefs) {
        itemTabs.append(`<div class="dnd-item-tab ${td.key === 'all' ? 'active' : ''}" data-filter="${td.key}"><i class="fa-solid ${td.icon}"></i> ${td.label}</div>`);
    }
    section.append(itemTabs);

    // Search + Add
    section.append(`
        <div class="dnd-item-search-row">
            <input type="text" class="dnd-item-search" placeholder="Search..." />
            <button class="dnd-add-item-btn"><i class="fa-solid fa-plus"></i> Add Item</button>
        </div>
    `);

    // Item list container
    const listContainer = $('<div class="dnd-item-list"></div>');
    section.append(listContainer);

    /** Render items with filter and search */
    function renderItems(filter = 'all', search = '') {
        listContainer.empty();
        let items = filter === 'all' ? [...(member.items || [])].map(normalizeItem) : getItemsByType(member, /** @type {'weapon'|'armor'|'gear'} */ (filter));
        if (search) {
            const q = search.toLowerCase();
            items = items.filter(i => i.name.toLowerCase().includes(q));
        }

        if (items.length === 0) {
            listContainer.append('<div class="dnd-empty-state">No items found.</div>');
            return;
        }

        for (const item of items) {
            const isEquipped = Object.values(member.equippedItems || {}).includes(item.id);
            const isEquippableSlot = Boolean(item.slot && Object.values(EQUIPMENT_SLOTS).includes(item.slot));
            const canUseConsumable = item.consumable && ((item.uses ?? 1) > 0);
            // Idea 135: de lo que no se ha identificado no se sabe lo que hace.
            const effectsText = /** @type {any} */ (item).identified === false ? '' : (item.effects || []).map(/** @param {import('./dnd-system.js').DndItemEffect} e */ e => `${e.stat} ${e.modifier >= 0 ? '+' : ''}${e.modifier}`).join(', ');
            const metaText = buildItemMetaSummary(item).join(' · ');
            const card = $(`
                <div class="dnd-item-card ${isEquipped ? 'equipped' : ''}" data-item-id="${item.id}">
                    ${item.image ? `<img class="dnd-item-img" src="${item.image}" />` : '<div class="dnd-item-img-placeholder"><i class="fa-solid fa-box"></i></div>'}
                    <div class="dnd-item-info">
                        <div class="dnd-item-name">${shownName(item)}${isEquipped ? ' <span style="color:#2dd4bf;font-size:0.7rem;">(equipped)</span>' : ''}</div>
                        <div class="dnd-item-meta">${metaText}${effectsText ? ' · ' + effectsText : ''}</div>
                    </div>
                    <div class="dnd-item-actions">
                        ${isEquipped
        ? '<button class="dnd-item-action-btn unequip-btn" title="Unequip"><i class="fa-solid fa-arrow-down"></i></button>'
        : (isEquippableSlot ? '<button class="dnd-item-action-btn equip-btn" title="Equip"><i class="fa-solid fa-arrow-up"></i></button>' : '')}
                        ${canUseConsumable ? '<button class="dnd-item-action-btn use-btn" title="Use"><i class="fa-solid fa-vial"></i></button>' : ''}
                        <button class="dnd-item-action-btn delete" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </div>
            `);

            card.find('.equip-btn').on('click', function (e) {
                e.stopPropagation();
                if (item.slot) tryEquip(member, item.id, item.slot);
                rebuildInventoryPanel(panel, member);
            });

            card.find('.unequip-btn').on('click', function (e) {
                e.stopPropagation();
                const slot = Object.entries(member.equippedItems || {}).find(([, v]) => v === item.id)?.[0];
                if (slot) tryUnequip(member, slot);
                rebuildInventoryPanel(panel, member);
            });

            card.find('.delete').on('click', function (e) {
                e.stopPropagation();
                removeItemFromInventory(member, item.id);
                renderItems(filter, search);
                rebuildInventoryPanel(panel, member);
            });

            card.find('.use-btn').on('click', function (e) {
                e.stopPropagation();
                const useResult = consumeItemInInventory(member, item.id);
                if (!useResult.consumed) {
                    toastr.info(t`This item cannot be consumed.`);
                    return;
                }

                if (useResult.removed) {
                    toastr.success(t`Item consumed and removed.`);
                } else {
                    toastr.success(t`Item consumed. Remaining uses updated.`);
                }

                renderItems(filter, search);
                rebuildInventoryPanel(panel, member);
            });

            listContainer.append(card);
        }
    }

    renderItems();

    // Tab switching
    section.find('.dnd-item-tab').on('click', function () {
        section.find('.dnd-item-tab').removeClass('active');
        $(this).addClass('active');
        const filter = String($(this).data('filter'));
        const search = String(section.find('.dnd-item-search').val() || '');
        renderItems(filter, search);
    });

    // Search
    section.find('.dnd-item-search').on('input', function () {
        const activeFilter = String(section.find('.dnd-item-tab.active').data('filter') || 'all');
        renderItems(activeFilter, String($(this).val() || ''));
    });

    // Add item button
    section.find('.dnd-add-item-btn').on('click', function () {
        openAddItemForm(panel, member);
    });

    panel.append(section);
}

/**
 * Open a popup form to add a new item
 * @param {JQuery} panel - The inventory panel for refresh
 * @param {PartyMember} member
 */
async function openAddItemForm(panel, member) {
    const defaultItem = normalizeItem({});
    const categoryOptions = getItemCategoryOptions();
    const slotOptions = [['', 'None (unequippable)'], ['container', 'Container'], ...Object.entries(SLOT_INFO).map(([key, info]) => [key, info.label])];
    const subcategoryOptions = getItemSubcategoryOptions(defaultItem.category || 'gear');
    const form = $(`
        <div class="dnd-add-item-form" style="min-width:380px;">
            <div class="dnd-form-row"><label>Name</label><input type="text" class="item-name" value="" /></div>
            <div class="dnd-form-row">
                <label>Category</label>
                <select class="item-category">
                    ${categoryOptions.map(([value, label]) => `<option value="${escItemText(value)}" ${value === defaultItem.category ? 'selected' : ''}>${escItemText(label)}</option>`).join('')}
                </select>
            </div>
            <div class="dnd-form-row">
                <label>Subcategory</label>
                <select class="item-subcategory">
                    ${subcategoryOptions.map(([value, label]) => `<option value="${escItemText(value)}" ${value === defaultItem.subcategory ? 'selected' : ''}>${escItemText(label)}</option>`).join('')}
                </select>
            </div>
            <div class="dnd-form-row">
                <label>Slot</label>
                <select class="item-slot">
                    ${slotOptions.map(([value, label]) => `<option value="${escItemText(value)}" ${value === (defaultItem.slot || '') ? 'selected' : ''}>${escItemText(label)}</option>`).join('')}
                </select>
            </div>
            <div class="dnd-form-row"><label>Image URL</label><input type="text" class="item-image" placeholder="Optional image URL" /></div>
            <div class="dnd-form-row"><label>Weight</label><input type="number" class="item-weight" value="0" min="0" step="0.1" /></div>
            ${buildPartyItemSections(defaultItem)}
            <div class="dnd-form-row"><label>Description</label><textarea class="item-desc" placeholder="Item description..."></textarea></div>
            <div style="margin-top:8px;">
                <label style="font-size:0.8rem;font-weight:600;color:var(--SmartThemeEmColor);">Effects</label>
                <div class="dnd-effect-rows"></div>
                <button class="dnd-add-effect-btn"><i class="fa-solid fa-plus"></i> Add Effect</button>
            </div>
        </div>
    `);

    // Add effect button
    form.find('.dnd-add-effect-btn').on('click', function () {
        const row = $(`
            <div class="dnd-effect-row">
                <select class="effect-stat">
                    ${MODIFIABLE_STATS.map(s => `<option value="${s}">${s}</option>`).join('')}
                </select>
                <input type="number" class="effect-modifier" value="0" />
                <button class="dnd-remove-effect-btn"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `);
        row.find('.dnd-remove-effect-btn').on('click', function () { row.remove(); });
        form.find('.dnd-effect-rows').append(row);
    });

    refreshPartyItemFormState(form);
    form.find('.item-category, .item-subcategory, .item-armor-dex-mode, .item-flag[data-flag="resistanceEnabled"], .item-emits-light, .item-flag[data-flag="stackable"]').on('change', function () {
        refreshPartyItemFormState(form);
    });

    const popup = new Popup(form, POPUP_TYPE.CONFIRM, '', {
        okButton: t`Add Item`,
        cancelButton: t`Cancel`,
    });

    const result = await popup.show();
    if (result !== 1) return; // POPUP_RESULT.AFFIRMATIVE

    /** @type {import('./dnd-system.js').DndItemEffect[]} */
    const effects = [];
    form.find('.dnd-effect-row').each(function () {
        effects.push({
            stat: String($(this).find('.effect-stat').val() || 'armorClass'),
            modifier: parseInt(String($(this).find('.effect-modifier').val()), 10) || 0,
        });
    });

    const resistanceTypes = form.find('.item-resistance:checked').map(function () {
        return String($(this).data('value') || '');
    }).get().filter(Boolean);

    const selectedSubcategory = String(form.find('.item-subcategory').val() || 'generic');
    if (selectedSubcategory === 'container') {
        const capacityWeight = parseInt(String(form.find('.item-capacity-weight').val() || ''), 10) || 0;
        const capacityVolume = parseFloat(String(form.find('.item-capacity-volume').val() || '')) || 0;
        if (capacityWeight <= 0 || capacityVolume <= 0) {
            toastr.error(t`Container items require Capacity Weight and Capacity Volume greater than 0.`);
            return;
        }
    }

    const newItem = createItem({
        name: form.find('.item-name').val()?.toString().trim() || 'New Item',
        category: /** @type {'weapon'|'armor'|'gear'|'magic'|'mount_vehicle_trade'} */ (String(form.find('.item-category').val() || 'gear')),
        subcategory: String(form.find('.item-subcategory').val() || 'generic'),
        slot: String(form.find('.item-slot').val() || '') || null,
        image: form.find('.item-image').val()?.toString().trim() || '',
        weight: parseFloat(String(form.find('.item-weight').val())) || 0,
        description: form.find('.item-desc').val()?.toString().trim() || '',
        rarity: form.find('.item-rarity').val()?.toString().trim() || '',
        damageDice: form.find('.item-damage-dice').val()?.toString().trim() || '',
        baseDamage: form.find('.item-damage-dice').val()?.toString().trim() || '',
        damageType: form.find('.item-damage-type').val()?.toString().trim() || '',
        properties: form.find('.item-properties').val()?.toString().trim() || '',
        meleeRange: parseInt(String(form.find('.item-melee-range').val() || ''), 10) || 5,
        range: parseInt(String(form.find('.item-range').val() || ''), 10) || null,
        longRange: parseInt(String(form.find('.item-long-range').val() || ''), 10) || null,
        versatileDamage: form.find('.item-versatile-damage').val()?.toString().trim() || '',
        baseArmorClass: parseInt(String(form.find('.item-base-armor-class').val() || ''), 10) || null,
        armorClass: parseInt(String(form.find('.item-base-armor-class').val() || ''), 10) || null,
        armorDexMode: /** @type {'full'|'max_2'|'none'} */ (String(form.find('.item-armor-dex-mode').val() || 'full')),
        strengthRequirement: parseInt(String(form.find('.item-strength-req').val() || ''), 10) || null,
        donTime: form.find('.item-don-time').val()?.toString().trim() || '',
        doffTime: form.find('.item-doff-time').val()?.toString().trim() || '',
        consumable: Boolean(form.find('.item-consumable').prop('checked')),
        focusType: form.find('.item-focus-type').val()?.toString().trim() || '',
        toolType: form.find('.item-tool-type').val()?.toString().trim() || '',
        linkedAbility: form.find('.item-linked-ability').val()?.toString().trim() || '',
        capacity: parseInt(String(form.find('.item-capacity').val() || ''), 10) || null,
        capacityUnit: form.find('.item-capacity-unit').val()?.toString().trim() || '',
        capacityWeight: parseInt(String(form.find('.item-capacity-weight').val() || ''), 10) || null,
        capacityVolume: parseFloat(String(form.find('.item-capacity-volume').val() || '')) || null,
        stackSize: parseInt(String(form.find('.item-stack-size').val() || ''), 10) || null,
        emitsLight: Boolean(form.find('.item-emits-light').prop('checked')),
        lightBright: parseInt(String(form.find('.item-light-bright').val() || ''), 10) || null,
        lightDim: parseInt(String(form.find('.item-light-dim').val() || ''), 10) || null,
        containerItemId: form.find('.item-container-id').val()?.toString().trim() || '',
        costGp: parseInt(String(form.find('.item-cost-gp').val() || ''), 10) || null,
        attunement: Boolean(form.find('.item-attunement').prop('checked')),
        magical: Boolean(form.find('.item-magical').prop('checked')),
        cursed: Boolean(form.find('.item-cursed').prop('checked')),
        magicalBonus: parseInt(String(form.find('.item-magical-bonus').val() || ''), 10) || null,
        uses: parseInt(String(form.find('.item-uses').val() || ''), 10) || null,
        maxUses: parseInt(String(form.find('.item-max-uses').val() || ''), 10) || null,
        recharge: form.find('.item-recharge').val()?.toString().trim() || '',
        vehicleCrew: parseInt(String(form.find('.item-vehicle-crew').val() || ''), 10) || null,
        vehicleDamageThreshold: parseInt(String(form.find('.item-vehicle-threshold').val() || ''), 10) || null,
        stealthDisadvantage: Boolean(form.find('.item-flag[data-flag="stealthDisadvantage"]').prop('checked')),
        adamantine: Boolean(form.find('.item-flag[data-flag="adamantine"]').prop('checked')),
        mithral: Boolean(form.find('.item-flag[data-flag="mithral"]').prop('checked')),
        resistanceEnabled: Boolean(form.find('.item-flag[data-flag="resistanceEnabled"]').prop('checked')),
        resistanceTypes,
        finesse: Boolean(form.find('.item-flag[data-flag="finesse"]').prop('checked')),
        heavy: Boolean(form.find('.item-flag[data-flag="heavy"]').prop('checked')),
        light: Boolean(form.find('.item-flag[data-flag="light"]').prop('checked')),
        reach: Boolean(form.find('.item-flag[data-flag="reach"]').prop('checked')),
        thrown: Boolean(form.find('.item-flag[data-flag="thrown"]').prop('checked')),
        twoHanded: Boolean(form.find('.item-flag[data-flag="twoHanded"]').prop('checked')),
        versatile: Boolean(form.find('.item-flag[data-flag="versatile"]').prop('checked')),
        ammunition: Boolean(form.find('.item-flag[data-flag="ammunition"]').prop('checked')),
        loading: Boolean(form.find('.item-flag[data-flag="loading"]').prop('checked')),
        stackable: Boolean(form.find('.item-flag[data-flag="stackable"]').prop('checked')),
        toolProficiency: Boolean(form.find('.item-flag[data-flag="toolProficiency"]').prop('checked')),
        linkedSpell: form.find('.item-linked-spell').val()?.toString().trim() || '',
        spellLevel: parseInt(String(form.find('.item-spell-level').val() || ''), 10) || null,
        saveDC: parseInt(String(form.find('.item-save-dc').val() || ''), 10) || null,
        spellAttackBonus: parseInt(String(form.find('.item-spell-attack').val() || ''), 10) || null,
        storageWeightLimit: parseInt(String(form.find('.item-storage-weight').val() || ''), 10) || null,
        storageVolumeLimit: parseInt(String(form.find('.item-storage-volume').val() || ''), 10) || null,
        brightLightRadius: parseInt(String(form.find('.item-bright-light').val() || ''), 10) || null,
        dimLightRadius: parseInt(String(form.find('.item-dim-light').val() || ''), 10) || null,
        effects,
    });

    addItemToInventory(member, newItem);
    rebuildInventoryPanel(panel, member);
}

// ============================================================
//  PROGRESSION TAB
// ============================================================

/**
 * @param {PartyMember} member
 * @param {DndCatalog} dndCatalog
 * @returns {JQuery}
 */
function buildProgressionTab(member, dndCatalog) {
    const panel = $('<div class="dnd-tab-panel" data-panel="progression"></div>');
    const prog = $('<div class="dnd-progression"></div>');

    // Level
    prog.append(`
        <div class="dnd-level-display">
            <div class="dnd-level-number">${member.level}</div>
            <div class="dnd-level-label">Level</div>
        </div>
    `);

    // Class
    const classOptions = Array.from(new Set([...(dndCatalog.classes || []), String(member.class || '').trim()].filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const classEdit = $(`
        <div class="dnd-class-edit">
            <label style="font-size:0.8rem;color:var(--SmartThemeTextColor);">Class:</label>
            <select class="dnd-class-input text_pole"></select>
        </div>
    `);
    const classSelect = classEdit.find('select');
    classSelect.append('<option value="">Adventurer</option>');
    for (const className of classOptions) {
        classSelect.append(`<option value="${escapeHtml(className)}">${escapeHtml(className)}</option>`);
    }
    classSelect.val(member.class || '');
    classSelect.on('change', async function () {
        const selectedClass = String($(this).val() || '').trim() || 'Adventurer';
        if (selectedClass === member.class) return;

        const nextPreset = dndCatalog.classPresets.get(selectedClass);
        if (nextPreset) {
            if (memberHasLikelyEditedStats(member)) {
                const overwritePopup = new Popup(
                    `${t`This character has manually edited stats.`}<br>${t`Apply the class preset and overwrite current stats?`}`,
                    POPUP_TYPE.CONFIRM,
                    '',
                    { okButton: t`Apply Preset`, cancelButton: t`Keep Current Stats` },
                );
                const result = await overwritePopup.show();
                if (result !== POPUP_RESULT.AFFIRMATIVE) {
                    classSelect.val(member.class || '');
                    return;
                }
            }

            member.class = selectedClass;
            applyClassPresetToMember(member, nextPreset);
        } else {
            member.class = selectedClass;
        }
    });
    prog.append(classEdit);

    // HP bar
    const hpPct = member.maxHp > 0 ? Math.min(100, (member.hp / member.maxHp) * 100) : 0;
    prog.append(`
        <div class="dnd-hp-section">
            <div class="dnd-section-title">Hit Points</div>
            <div class="dnd-hp-bar-bg">
                <div class="dnd-hp-bar-fill" style="width:${hpPct}%"></div>
                <div class="dnd-hp-bar-text">${member.hp} / ${member.maxHp}</div>
            </div>
            <div class="dnd-xp-inputs">
                <div class="dnd-xp-field">
                    <label>Current HP</label>
                    <input type="number" class="hp-current-input" value="${member.hp}" min="0" />
                </div>
                <div class="dnd-xp-field">
                    <label>Max HP</label>
                    <input type="number" class="hp-max-input" value="${member.maxHp}" min="1" />
                </div>
            </div>
        </div>
    `);

    prog.find('.hp-current-input').on('change', function () {
        member.hp = parseInt(String($(this).val()), 10) || 0;
        member.classPresetDirty = true;
        const pct = member.maxHp > 0 ? Math.min(100, (member.hp / member.maxHp) * 100) : 0;
        prog.find('.dnd-hp-bar-fill').css('width', pct + '%');
        prog.find('.dnd-hp-bar-text').text(`${member.hp} / ${member.maxHp}`);
    });

    prog.find('.hp-max-input').on('change', function () {
        member.maxHp = parseInt(String($(this).val()), 10) || 1;
        member.classPresetDirty = true;
        const pct = member.maxHp > 0 ? Math.min(100, (member.hp / member.maxHp) * 100) : 0;
        prog.find('.dnd-hp-bar-fill').css('width', pct + '%');
        prog.find('.dnd-hp-bar-text').text(`${member.hp} / ${member.maxHp}`);
    });

    // XP bar
    const xpPct = member.xpNext > 0 ? Math.min(100, (member.xp / member.xpNext) * 100) : 0;
    prog.append(`
        <div class="dnd-xp-section">
            <div class="dnd-section-title">Experience Points</div>
            <div class="dnd-xp-bar-bg">
                <div class="dnd-xp-bar-fill" style="width:${xpPct}%"></div>
                <div class="dnd-xp-bar-text">${member.xp} / ${member.xpNext} (${Math.round(xpPct)}%)</div>
            </div>
            <div class="dnd-xp-inputs">
                <div class="dnd-xp-field">
                    <label>Current XP</label>
                    <input type="number" class="xp-current-input" value="${member.xp}" min="0" />
                </div>
                <div class="dnd-xp-field">
                    <label>XP to Next Level</label>
                    <input type="number" class="xp-next-input" value="${member.xpNext}" min="1" />
                </div>
            </div>
        </div>
    `);

    prog.find('.xp-current-input').on('change', function () {
        member.xp = parseInt(String($(this).val()), 10) || 0;
        const pct = member.xpNext > 0 ? Math.min(100, (member.xp / member.xpNext) * 100) : 0;
        prog.find('.dnd-xp-bar-fill').css('width', pct + '%');
        prog.find('.dnd-xp-bar-text').text(`${member.xp} / ${member.xpNext} (${Math.round(pct)}%)`);
        updateLevelUpButton();
    });

    prog.find('.xp-next-input').on('change', function () {
        member.xpNext = parseInt(String($(this).val()), 10) || 100;
        const pct = member.xpNext > 0 ? Math.min(100, (member.xp / member.xpNext) * 100) : 0;
        prog.find('.dnd-xp-bar-fill').css('width', pct + '%');
        prog.find('.dnd-xp-bar-text').text(`${member.xp} / ${member.xpNext} (${Math.round(pct)}%)`);
        updateLevelUpButton();
    });

    // Subir de nivel: el mismo camino que el boton de la ficha de companero, porque dos
    // formas de subir de nivel son dos sitios donde olvidarse de dar los PG.
    const levelUpBtn = $(`<button class="dnd-level-up-btn" ${canLevelUp(member) ? '' : 'disabled'}><i class="fa-solid fa-arrow-up"></i> Subir de nivel</button>`);
    levelUpBtn.on('click', function () {
        void openLevelUpCard(member);
    });
    prog.append(levelUpBtn);

    function updateLevelUpButton() {
        levelUpBtn.prop('disabled', !canLevelUp(member));
    }

    panel.append(prog);
    return panel;
}

// ============================================================
//  RELATIONSHIPS TAB
// ============================================================

/**
 * @param {any} rel
 * @returns {'normal'|'amoroso'|'familiar'}
 */
function getRelationshipCategory(rel) {
    const explicitCategory = String(rel?.category || '').trim();
    if (RELATIONSHIP_CATEGORIES.includes(explicitCategory)) {
        return /** @type {'normal'|'amoroso'|'familiar'} */ (explicitCategory);
    }

    const legacyType = String(rel?.type || '').trim();
    if (legacyType === 'romantic') return 'amoroso';
    if (legacyType === 'family') return 'familiar';
    return 'normal';
}

/**
 * @param {'normal'|'amoroso'|'familiar'} category
 * @returns {string}
 */
function getRelationshipCategoryLabel(category) {
    if (category === 'amoroso') return 'amoroso';
    if (category === 'familiar') return 'familiar';
    return 'normal';
}

/**
 * @param {number} score
 * @returns {string}
 */
function getNormalRelationshipBand(score) {
    if (score >= 100) return 'mejor amigo';
    if (score >= 50) return 'amistad';
    if (score <= -100) return 'archienemigo';
    if (score <= -50) return 'enemigo';
    return 'indiferente';
}

/**
 * @param {{ category?: string, score?: number, type?: string }} rel
 * @returns {string}
 */
function getRelationshipSummary(rel) {
    const category = getRelationshipCategory(rel);
    const score = clampRelationshipScore(rel?.score ?? 0);
    if (category === 'normal') return getNormalRelationshipBand(score);
    if (category === 'amoroso') return 'amoroso';
    return 'familiar';
}

/**
 * Returns selectable character names from the specific lorebook tied to this member.
 * Prefers member.worldName; falls back to active chat world.
 * @param {PartyMember} member
 * @returns {Promise<string[]>}
 */
async function getRelationshipTargetNamesFromLorebook(member) {
    const worldName = String(member.worldName || chat_metadata?.[METADATA_KEY] || '').trim();
    if (!worldName) return [];

    try {
        const data = /** @type {any} */ (await loadWorldInfo(worldName));
        if (!data?.entries) return [];

        const names = [];
        for (const uid of Object.keys(data.entries)) {
            const entry = data.entries[uid];
            const group = String(entry?.group || '').trim().toLowerCase();
            if (!group.includes('character')) continue;

            const name = getPartyEntryDisplayName(entry).trim();
            if (!name) continue;
            names.push(name);
        }

        return [...new Set(names)];
    } catch (error) {
        console.warn('Could not load lorebook characters for relationship picker', { worldName, error });
        return [];
    }
}

/**
 * @param {PartyMember} member
 * @returns {JQuery}
 */
function buildRelationshipsTab(member) {
    const panel = $('<div class="dnd-tab-panel" data-panel="relationships"></div>');
    const container = $('<div class="dnd-relationships"></div>');

    // Actions
    const actions = $('<div class="dnd-relationships-actions"></div>');
    const analyzeBtn = $('<button class="dnd-rel-btn"><i class="fa-solid fa-magnifying-glass"></i> Analyze Chat</button>');
    const addBtn = $('<button class="dnd-rel-btn"><i class="fa-solid fa-plus"></i> Add Relationship</button>');
    actions.append(analyzeBtn, addBtn);
    container.append(actions);

    // List
    const list = $('<div class="dnd-relationship-list"></div>');
    container.append(list);

    function renderRelationships() {
        list.empty();
        if (!member.relationships || member.relationships.length === 0) {
            list.append('<div class="dnd-empty-state">No relationships defined yet.</div>');
            return;
        }

        for (let i = 0; i < member.relationships.length; i++) {
            const rel = member.relationships[i];
            const category = getRelationshipCategory(rel);
            const score = clampRelationshipScore(rel?.score ?? 0);
            const scoreText = `${score >= 0 ? '+' : ''}${score}`;
            const summaryText = getRelationshipSummary(rel);
            const card = $(`
                <div class="dnd-relationship-card">
                    <div class="dnd-rel-avatar" style="display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-user" style="font-size:1.2rem;"></i></div>
                    <div class="dnd-rel-info">
                        <div class="dnd-rel-name">${rel.characterName}</div>
                        <div class="dnd-rel-meta">
                            <span class="dnd-rel-summary">${summaryText}</span>
                            <span class="dnd-rel-score">${scoreText}</span>
                        </div>
                    </div>
                    <span class="dnd-rel-category-badge ${category}">${getRelationshipCategoryLabel(category)}</span>
                    <div class="dnd-rel-actions">
                        <button class="dnd-rel-action-btn edit-rel" title="Edit"><i class="fa-solid fa-pen"></i></button>
                        <button class="dnd-rel-action-btn delete" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </div>
            `);

            card.find('.delete').on('click', function () {
                member.relationships.splice(i, 1);
                renderRelationships();
            });

            card.find('.edit-rel').on('click', function () {
                openRelationshipEditor(member, i, renderRelationships);
            });

            list.append(card);
        }
    }

    renderRelationships();

    // Analyze chat button
    analyzeBtn.on('click', function () {
        const messages = chat || [];
        const otherNames = partyMembers.map(m => m.name).filter(n => n !== member.name);
        const suggestions = analyzeRelationshipsFromChat(/** @type {any} */ (messages), member.name, otherNames);

        if (suggestions.length === 0) {
            toastr.info(t`No relationship patterns found in chat.`);
            return;
        }

        // Add suggestions that don't exist yet
        let added = 0;
        for (const sug of suggestions) {
            const exists = (member.relationships || []).some(r =>
                r.characterName.toLowerCase() === sug.characterName.toLowerCase(),
            );
            if (!exists) {
                member.relationships = member.relationships || [];
                member.relationships.push(sug);
                added++;
            }
        }

        if (added > 0) {
            toastr.success(`Found ${added} new relationship(s) from chat.`);
            renderRelationships();
        } else {
            toastr.info(t`No new relationships found.`);
        }
    });

    // Add relationship button
    addBtn.on('click', function () {
        openRelationshipEditor(member, -1, renderRelationships);
    });

    panel.append(container);
    return panel;
}

/**
 * Open editor for a relationship (new or existing)
 * @param {PartyMember} member
 * @param {number} index - -1 for new
 * @param {Function} onSave - callback to refresh
 */
async function openRelationshipEditor(member, index, onSave) {
    const isNew = index < 0;
    const rel = isNew
        ? { characterName: '', characterAvatar: '', category: 'normal', score: 0, lastInteraction: '', type: '', description: '' }
        : member.relationships[index];

    const currentTargetName = String(rel?.characterName || '').trim();
    const existingTargets = new Set(
        (member.relationships || [])
            .map((entry, entryIndex) => entryIndex === index ? '' : String(entry?.characterName || '').trim().toLowerCase())
            .filter(Boolean),
    );
    const lorebookCharacterNames = await getRelationshipTargetNamesFromLorebook(member);
    const validTargetNames = [...new Set(
        lorebookCharacterNames
            .filter(Boolean)
            .filter(name => name.toLowerCase() !== String(member.name || '').trim().toLowerCase())
            .filter(name => !existingTargets.has(name.toLowerCase()) || name.toLowerCase() === currentTargetName.toLowerCase()),
    )];

    if (isNew && validTargetNames.length === 0) {
        toastr.info(t`No available characters to relate.`);
        return;
    }

    const initialCategory = getRelationshipCategory(rel);
    const initialScore = clampRelationshipScore(rel?.score ?? 0);

    const form = $(`
        <div class="dnd-add-item-form" style="min-width:350px;">
            <div class="dnd-form-row">
                <label>Name</label>
                <select class="rel-name">
                    ${validTargetNames.map(name => `<option value="${name}" ${name === currentTargetName ? 'selected' : ''}>${name}</option>`).join('')}
                </select>
            </div>
            <div class="dnd-form-row">
                <label>Category</label>
                <select class="rel-category">
                    ${RELATIONSHIP_CATEGORIES.map(category => `<option value="${category}" ${category === initialCategory ? 'selected' : ''}>${category}</option>`).join('')}
                </select>
            </div>
            <div class="dnd-form-row">
                <label>Score (${RELATIONSHIP_SCORE_MIN} to ${RELATIONSHIP_SCORE_MAX})</label>
                <input type="number" class="rel-score" min="${RELATIONSHIP_SCORE_MIN}" max="${RELATIONSHIP_SCORE_MAX}" value="${initialScore}" />
            </div>
        </div>
    `);

    const popup = new Popup(form, POPUP_TYPE.CONFIRM, '', {
        okButton: isNew ? t`Add` : t`Save`,
        cancelButton: t`Cancel`,
    });

    const result = await popup.show();
    if (result !== 1) return;

    const selectedName = String(form.find('.rel-name').val() || '').trim();
    const selectedCategory = /** @type {'normal'|'amoroso'|'familiar'} */ (String(form.find('.rel-category').val() || 'normal'));
    const selectedScore = clampRelationshipScore(form.find('.rel-score').val());

    if (!selectedName) {
        toastr.error(t`Please select a character.`);
        return;
    }

    const duplicateExists = (member.relationships || []).some((entry, entryIndex) => {
        if (entryIndex === index) return false;
        return String(entry?.characterName || '').trim().toLowerCase() === selectedName.toLowerCase();
    });
    if (duplicateExists) {
        toastr.error(t`Relationship already exists with this character.`);
        return;
    }

    if (selectedCategory === 'amoroso' && selectedScore < 50) {
        toastr.error(t`Amoroso relationship requires score 50 or higher.`);
        return;
    }

    const updated = {
        characterName: selectedName,
        characterAvatar: rel.characterAvatar || '',
        category: selectedCategory,
        score: selectedScore,
        description: rel.description || undefined,
        lastInteraction: rel.lastInteraction || '',
    };

    if (isNew) {
        member.relationships = member.relationships || [];
        member.relationships.push(updated);
    } else {
        member.relationships[index] = updated;
    }

    onSave();
}

// ============================================================
//  MEMORIES TAB
// ============================================================

/**
 * @param {PartyMember} member
 * @returns {JQuery}
 */
function buildMemoriesTab(member) {
    const panel = $('<div class="dnd-tab-panel" data-panel="memories"></div>');
    const container = $('<div class="dnd-memories"></div>');

    // Actions
    const actions = $('<div class="dnd-memories-actions"></div>');
    const addBtn = $('<button class="dnd-mem-btn"><i class="fa-solid fa-plus"></i> Add Memory</button>');
    actions.append(addBtn);
    container.append(actions);

    // List
    const list = $('<div class="dnd-memory-list"></div>');
    container.append(list);

    function renderMemories() {
        list.empty();
        if (!member.memories || member.memories.length === 0) {
            list.append('<div class="dnd-empty-state">No memories recorded yet.</div>');
            return;
        }

        // Sort by date descending
        const sorted = [...member.memories].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        for (const mem of sorted) {
            const tags = (mem.tags || []).map(t => `<span class="dnd-memory-tag">${t}</span>`).join('');
            const wiBadge = mem.worldInfoBook ? `<span class="dnd-memory-wi-badge" title="Linked to World Info: ${mem.worldInfoBook}">WI: ${mem.worldInfoBook}</span>` : '';

            const card = $(`
                <div class="dnd-memory-card" data-mem-id="${mem.id}">
                    <div class="dnd-memory-header">
                        <span class="dnd-memory-date">${mem.date || 'Unknown date'}</span>
                        <div class="dnd-memory-tags">${tags}${wiBadge}</div>
                    </div>
                    <div class="dnd-memory-text">${mem.text}</div>
                    <div class="dnd-memory-actions">
                        <button class="dnd-rel-action-btn edit-mem" title="Edit"><i class="fa-solid fa-pen"></i></button>
                        <button class="dnd-rel-action-btn delete" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </div>
            `);

            card.find('.delete').on('click', function () {
                member.memories = member.memories.filter(m => m.id !== mem.id);
                renderMemories();
            });

            card.find('.edit-mem').on('click', function () {
                openMemoryEditor(member, mem.id, renderMemories);
            });

            list.append(card);
        }
    }

    renderMemories();

    addBtn.on('click', function () {
        openMemoryEditor(member, null, renderMemories);
    });

    panel.append(container);
    return panel;
}

/**
 * Open editor for a memory (new or existing)
 * @param {PartyMember} member
 * @param {string|null} memId - null for new
 * @param {Function} onSave
 */
async function openMemoryEditor(member, memId, onSave) {
    const isNew = !memId;
    const mem = isNew ? { id: '', text: '', date: new Date().toISOString().slice(0, 10), worldInfoEntryId: '', worldInfoBook: '', tags: [] } : member.memories.find(m => m.id === memId);
    if (!mem) return;

    const form = $(`
        <div class="dnd-add-item-form" style="min-width:380px;">
            <div class="dnd-form-row"><label>Date</label><input type="date" class="mem-date" value="${mem.date || new Date().toISOString().slice(0, 10)}" /></div>
            <div class="dnd-form-row"><label>Text</label><textarea class="mem-text" rows="4">${mem.text || ''}</textarea></div>
            <div class="dnd-form-row"><label>Tags</label><input type="text" class="mem-tags" value="${(mem.tags || []).join(', ')}" placeholder="Comma-separated tags" /></div>
            <div class="dnd-form-row"><label>WI Book</label><input type="text" class="mem-wi-book" value="${mem.worldInfoBook || ''}" placeholder="World Info book name (optional)" /></div>
            <div class="dnd-form-row"><label>WI Entry ID</label><input type="text" class="mem-wi-entry" value="${mem.worldInfoEntryId || ''}" placeholder="World Info entry ID (optional)" /></div>
        </div>
    `);

    const popup = new Popup(form, POPUP_TYPE.CONFIRM, '', {
        okButton: isNew ? t`Add Memory` : t`Save`,
        cancelButton: t`Cancel`,
    });

    const result = await popup.show();
    if (result !== 1) return;

    const updated = {
        id: mem.id || generateMemoryId(),
        text: form.find('.mem-text').val()?.toString().trim() || '',
        date: form.find('.mem-date').val()?.toString() || new Date().toISOString().slice(0, 10),
        worldInfoEntryId: form.find('.mem-wi-entry').val()?.toString().trim() || '',
        worldInfoBook: form.find('.mem-wi-book').val()?.toString().trim() || '',
        tags: form.find('.mem-tags').val()?.toString().split(',').map(t => t.trim()).filter(Boolean) || [],
    };

    if (isNew) {
        member.memories = member.memories || [];
        member.memories.push(updated);
    } else {
        const idx = member.memories.findIndex(m => m.id === memId);
        if (idx !== -1) member.memories[idx] = updated;
    }

    onSave();
}

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
    partyMembers = partyMembers.filter((m) => m.id !== memberId);
    renderPartyMembers();
    savePartyState();
}

/**
 * @param {string} avatarId
 * @param {{hp_current?: number, hp_max?: number, xp_current?: number, xp_next?: number, level?: number, gold?: number, silver?: number, copper?: number, inventory?: string, conditions?: string, strength?: number, dexterity?: number, constitution?: number, intelligence?: number, wisdom?: number, charisma?: number, armorClass?: number, speed?: number}} newState
 */
export function updatePartyMemberFromPersona(avatarId, newState) {
    let changed = false;
    partyMembers = partyMembers.map((member) => {
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
    });

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
            toastr.warning(t`No world info bound to this chat. Start a campaign first.`);
            return;
        }

        const data = /** @type {any} */ (await loadWorldInfo(worldName));
        if (!data?.entries) {
            toastr.warning(t`Could not load world info entries.`);
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
            toastr.info(t`No available characters to add. All characters from this world are already in the party.`);
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
        talkingTo = '';
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
            const { to, reason } = await travelWithTime(String(value));
            if (!to) {
                // El motivo que venga, una sola vez: antes esto decia «not found» aunque
                // el sitio existiera y lo que fallara fuese el camino.
                if (reason) toastr.warning(reason, 'No se puede viajar');
                return '';
            }
            setPartyTab('location');
            toastr.info(`📍 ${t`Traveled to`} ${to}`);
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
                toastr.warning('Choose a location first (/go).');
                return '';
            }

            const entered = enterBoard(name);
            if (!entered) {
                if (!holdDuringCombat(combatEncounter, 'board')) {
                    toastr.warning(`Board "${name}" not found at ${currentLocationName}.`);
                }
                return '';
            }

            setPartyTab('location');
            toastr.info(`🎲 ${t`Entered`} ${entered}`);
            return entered;
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'narrador',
        helpString: '<div>Cambia <b>cuánto se extiende</b> quien narra esta campaña: de una o dos '
            + 'frases a sin freno. Se escribe en su ficha, que es lo que llega al modelo cada turno.</div>',
        callback: async () => {
            const { changeNarratorPace } = await import('./campaigns.js');
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
            const { openSandbox } = await import('./game-engine/ui/sandbox.js');
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
                currentBoardName = '';
                saveCurrentBoard();
                setPartyTab('location');
                toastr.info(`← ${t`Left`} ${leftBoard}`);
                return leftBoard;
            }
            if (currentLocationName) {
                const leftLoc = currentLocationName;
                currentLocationName = '';
                currentBoardName = '';
                saveCurrentLocation();
                saveCurrentBoard();
                setPartyTab('location');
                toastr.info(`← ${t`Left`} ${leftLoc}`);
                return leftLoc;
            }
            toastr.info(t`Nowhere to leave.`);
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
                toastr.warning(t`Choose a location first (/go).`);
                return '';
            }
            if (!currentBoardName) {
                toastr.warning(t`Enter a board first (/enter).`);
                return '';
            }

            const loc = getCurrentWorldLocationMaps().find(l => l.name === currentLocationName);
            const boards = getLocationBoards(loc);
            const board = boards.find((/** @type {any} */ b) => b.name === currentBoardName);

            if (!board || !board.isCombat) {
                toastr.warning(t`This board is not a combat board.`);
                return '';
            }

            const globalEnemies = getCurrentWorldEnemies();
            const rule = (board.encounterRules || []).find((/** @type {any} */ r) => {
                const tmpl = globalEnemies.find(e => e.id === r.enemyId);
                return tmpl && tmpl.name.toLowerCase() === enemyName.toLowerCase();
            });
            if (!rule) {
                toastr.warning(`Enemy "${enemyName}" not found in encounter rules for this board.`);
                return '';
            }

            const template = globalEnemies.find(e => e.id === rule.enemyId);
            if (!template) {
                toastr.warning('Enemy template not found in world enemy pool.');
                return '';
            }

            const gw = loc?.gridWidth || 50;
            const gh = loc?.gridHeight || 50;
            const count = countOverride > 0
                ? countOverride
                : Math.floor(Math.random() * (rule.maxCount - rule.minCount + 1)) + rule.minCount;
            const summary = startCombat(template, count, gw, gh);

            toastr.success(`⚔️ ${t`Combat started!`}\n${summary}`, '', { timeOut: 8000 });

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
            const { openPromptPreview, resetSession, getSession } = await import('./game-engine/ui/prompt-preview.js');

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
            const { openCampaignSchema } = await import('./game-engine/ui/campaign-schema-panel.js');
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
        helpString: '<div>El editor de la campana abierta: el mundo y sus localidades, con sus tableros. '
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
        import('./game-engine/ui/prompt-preview.js')
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

    // Idea 137: mientras se escribe, si lo escrito pide una tirada, se ofrece.
    /** @type {ReturnType<typeof setTimeout>|null} */
    let typingTimer = null;
    $(document).on('input', '#send_textarea', () => {
        if (typingTimer) clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
            const said = String(/** @type {HTMLTextAreaElement|null} */ (document.querySelector('#send_textarea'))?.value ?? '');
            const next = /^\[TIRADA/.test(said.trim()) ? [] : intentSkills(said);
            if (next.join() === typedIntents.join()) return;
            typedIntents = next;
            if (isShellOpen()) refreshGameShell();
        }, 400);
    });
    eventSource.on(event_types.MESSAGE_SENT, () => {
        if (typedIntents.length === 0) return;
        typedIntents = [];
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

    eventSource.on(event_types.USER_MESSAGE_RENDERED, (/** @type {number} */ messageId) => {
        const message = chat[messageId];
        if (!message || !message.mes) return;
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

        const locs = getCurrentWorldLocationMaps();
        if (!locs || locs.length === 0) return;

        // Check boards at current location first (more specific)
        if (currentLocationName) {
            const loc = locs.find(l => l.name === currentLocationName);
            const boards = (loc && Array.isArray(loc.boards)) ? loc.boards : [];
            for (const b of boards) {
                if (b.name && text.includes(b.name.toLowerCase())) {
                    currentBoardName = b.name;
                    saveCurrentBoard();
                    setPartyTab('location');
                    toastr.info(`🎲 ${t`Entered`} ${b.name}`);
                    return;
                }
            }
        }

        // Check location names
        for (const l of locs) {
            if (l.name && text.includes(l.name.toLowerCase())) {
                if (l.name !== currentLocationName) {
                    currentLocationName = l.name;
                    currentBoardName = '';
                    saveCurrentLocation();
                    saveCurrentBoard();
                    setPartyTab('location');
                    toastr.info(`📍 ${t`Traveled to`} ${l.name}`);
                }
                return;
            }
        }
    });
}
