import { t } from './i18n.js';
import { power_user } from './power-user.js';
import { POPUP_TYPE, POPUP_RESULT, Popup } from './popup.js';
import { sendSystemMessage, system_message_types } from './system-messages.js';
import { getThumbnailUrl, chat, chat_metadata, saveMetadata, eventSource, event_types, setUserName, addOneMessage, saveChatConditional, substituteParams, system_avatar, generateRaw, online_status, setExtensionPrompt, extension_prompt_types, extension_prompt_roles } from '../script.js';
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
    readFactions, tickFactions, outcomeOf, applyOutcome, newsFor, describeFaction,
    rollFactions, validateFactionRows, busyFactions, pushFaction, speaksPlural, namesOf,
    changeStanding, describeStanding, standingWith,
} from './game-engine/campaign/factions.js';
import { marketPressure, applyMarket, describeMarket } from './game-engine/campaign/economy.js';
import {
    abilitiesFor, classesOf, nameAndAbility, validateAbilities,
} from './game-engine/compendio/skills.js';
import {
    rollDice, rollDiceDetailed, getRollClassification, getRollClassificationLabel,
    getDistanceInFeet, getAttackRangeFeet, describeCover,
    getPlayerDamageFormula, getEnemyDamageFormula, getPlayerAttackModifier,
    createEmptyCombatEncounter, normalizeCombatEncounter, setRandomSource, nextRandom,
} from './party/combat-rules.js';
import { escItemText, buildPartyItemSections } from './party/item-forms.js';
import { armourClassOf, shieldBlocked } from './game-engine/rules/equipment.js';
import { resolveEntryMapPosition } from './party/positions.js';
import { createCampaignState } from './party/campaign-state.js';
import {
    normalizeTerrain, setCell as setTerrainCell, getTerrainOptions, getCoverBonus, setDoorOpen,
    parseCellKey, terrainFromAsciiMap, cellKey, isPassable,
} from './game-engine/board/terrain.js';
import { getReachableCells, findPath, getPathCost } from './game-engine/board/pathfinding.js';
import { getCoverAlongLine } from './game-engine/board/line-of-sight.js';
import { createEmptyFog, normalizeFog, updateFog } from './game-engine/board/fog-of-war.js';
import { planEnemyTurn } from './game-engine/combat/enemy-ai.js';
import { planAllyTurn, stanceOf, STANCES } from './game-engine/combat/ally-ai.js';
import { chooseEnemyAbility, longestReach, averageOf } from './game-engine/combat/enemy-abilities.js';
import {
    MANEUVERS, judgeManeuvers, recordManeuver, startTurn as startManeuverTurn, attackEdge,
    consumeHelp, rollWithEdge, describeEdge, resolveShove, readManeuvers,
} from './game-engine/combat/maneuvers.js';
import { planWalk, canWalk } from './game-engine/board/walk.js';
import { enterCell, describeHazard } from './game-engine/board/hazards.js';
import {
    buildTracker, describeTurn, statusMarkers, sizeToCells, toggleCondition,
} from './game-engine/combat/initiative-tracker.js';
import {
    createTurnState, advanceTurn, getRemainingMovement, spendMovement, hasAction, useAction,
} from './game-engine/combat/turn-machine.js';
import { rollEncounterLoot, lootRulesWithWorldItems } from './game-engine/combat/loot.js';
import { holdDuringCombat } from './game-engine/combat/combat-hold.js';
import {
    applyInjury, healInjuries, describeInjuries, readInjuries, setInjury,
} from './game-engine/rules/injuries.js';
import {
    tickNeeds, exhaustionInjury, describeNeeds, LETHAL_EXHAUSTION,
} from './game-engine/rules/needs.js';
import { resolveFall, describeSurvival, canCheckpoint, readSurvival } from './game-engine/rules/mortality.js';
import { weeklyBill, settleWeek, describeBill } from './game-engine/rules/upkeep.js';
import { readRemedies, remediesFor, applyRemedy, shouldOfferRetirement } from './game-engine/rules/remedies.js';
import { readDebt, offerPatronage, settlesDebt, debtDue, describeDebt } from './game-engine/campaign/patronage.js';
import { SKILLS, checkOptions, rollCheck } from './game-engine/rules/checks.js';
import { recordDeed, worldMemoryBlock, roadTrouble } from './game-engine/campaign/world-memory.js';
import { promptKey } from './game-engine/cost/prompt-order.js';
import {
    generateBoardOfContracts, contractsFromFactions, expireContracts, describeContract,
} from './game-engine/campaign/contracts.js';
import {
    readGuild, upkeepWithBuildings, boardSize, settleLoyalty, completeContract, STAFF_ROLES, retireTo,
    upgradeCost, describeGuild,
} from './game-engine/campaign/guild.js';
import { generateBoard } from './game-engine/world-builder/dungeon-generator.js';
import {
    formParty, canControl, describeMode, readMode, MODES,
} from './game-engine/rules/companions.js';
import { describeLootItem } from './game-engine/combat/loot-items.js';
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
    rollEntry, lineToEntry, append as appendLogEntry,
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

/**
 * Las facciones del mundo abierto, ya leidas.
 *
 * Mismo apano que `lastCompendium`: `renderCampaignTab` se dibuja de golpe y no puede ser
 * `async`. Sin facciones escritas esto es una lista vacia y el panel queda como estaba.
 *
 * @type {any[]}
 */
let currentWorldFactions = [];

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
        currentWorldFactions = readFactions(data?.metadata?.factions);
        // Y los mandos del tablon, que se leen en el mismo sitio y para lo mismo.
        lastBoardRules = data?.metadata?.boardRules ?? null;
        lastWrittenQuests = Array.isArray(data?.metadata?.writtenQuests)
            ? data.metadata.writtenQuests : [];
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
async function persistBoardTerrain(board) {
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

/**
 * Adds an entry to the log and repaints it if it is visible.
 * @param {import('./game-engine/ui/combat-log.js').LogEntry|null} item
 */
function pushCombatLogEntry(item) {
    if (!item) return;
    combatLogEntries = appendLogEntry(combatLogEntries, item);
    if (combatLogPanel) renderCombatLog(combatLogPanel, combatLogEntries);
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
async function applyCampaignRuleset(worldName) {
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
    const base = wornArmorClass(target) || Number(target?.armorClass) || 10;
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
    return partyMembers.filter(member => (member.hp || 0) > 0);
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
    const edge = attackEdge({
        targetId: String(target.id),
        targetConditions: target.activeConditions ?? [],
        attackerConditions: enemy.activeConditions ?? [],
        distanceFeet: getDistanceInFeet(
            Number(enemy.gridX) || 0, Number(enemy.gridY) || 0,
            Number(target.mapPosition?.gridX) || 0, Number(target.mapPosition?.gridY) || 0),
        maneuvers: combatEncounter.maneuvers,
    });
    const edged = rollWithEdge(() => rollDiceDetailed('1d20', 20).total, edge.mode);
    const attackRoll = { total: edged.natural, natural: edged.natural };
    const d20 = attackRoll.total;
    const attackMod = Math.max(
        getAbilityModifier(enemy.strength || 10),
        getAbilityModifier(enemy.dexterity || 10),
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
    lines.push(`🎲 Tirada de ataque: d20(${d20}) ${attackMod >= 0 ? '+' : ''}${attackMod} = ${attackTotal} vs AC ${targetAc}${describeCover(targetCover)}${describeEdge(edged, edge.mode, edge.reasons)}`);

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
    lines.push(`💥 Tirada de daño: ${dmgFormula}(${baseDamage})${isCrit ? ` + crit(${critBonus})` : ''} + mod(${strMod}) = ${totalDamage}`);
    lines.push(...damagePartyMember(target, totalDamage, isCrit));

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

    if (rescue) {
        saveCampaignState(null, spendPerk(getCampaignBonds(), rescue.saviourId, rescue.perkId));
        target.hp = 1;
        lines.push(`🛡️ ${rescue.saviourName} se interpone: ${target.name} aguanta con 1 HP.`);
    } else {
        target.hp = Math.max(0, (target.hp || 0) - totalDamage);
    }

    target.activeConditions = Array.isArray(target.activeConditions) ? target.activeConditions : [];
    lines.push(`❤️ Estado de ${target.name}: ${target.hp}/${target.maxHp}`);

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
            lines.push(`🩸 ${target.name} cae a 0 PG y empieza a jugarsela: `
                + 'tres exitos para estabilizarse, tres fallos y se acabo.');
        }
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

    const plan = planAbilityUse({
        actor: enemy,
        target,
        ability,
        roll: (/** @type {string} */ formula) => rollDiceDetailed(formula, 8),
        attackModifier: Math.max(getAbilityModifier(enemy.strength || 10), getAbilityModifier(enemy.dexterity || 10)),
        targetAc: choice.side === 'enemy' ? getTargetArmorClass(target, enemy).ac : 10,
        saveModifier: choice.side === 'enemy' ? abilityModifier(target, ability.saveAbility) : 0,
    });
    enemy.abilityUses = spendAbilityUse(enemy, ability);

    const lines = [...plan.lines];
    if (plan.damage > 0 && choice.side === 'enemy') lines.push(...damagePartyMember(target, plan.damage, plan.crit));
    if (plan.healing > 0 && choice.side !== 'enemy') {
        target.currentHp = Math.min(Number(target.maxHp) || 0, (Number(target.currentHp) || 0) + plan.healing);
        lines.push(`❤️ Estado de ${target.name}: ${target.currentHp}/${target.maxHp}`);
    }
    if (plan.condition) {
        const who = choice.side === 'enemy' ? String(target.id) : String(target.instanceId);
        applyTimedCondition(target, who, plan.condition, plan.conditionRounds);
    }

    savePartyState();
    saveCombatState();
    renderPartyMembers();
    return lines.join('\n');
}

function resolveEnemyTurnAction(turnEntry) {
    const enemy = combatEncounter.enemies.find(e => e.instanceId === turnEntry.id && e.currentHp > 0);
    if (!enemy) {
        return '[COMBAT] El enemigo no puede actuar (derrotado o no encontrado).';
    }

    const livingParty = getLivingPartyMembers();
    if (!livingParty.length) {
        return `[COMBAT] ${enemy.name} ruge sobre un campo sin oponentes conscientes.`;
    }

    const enemyX = Number.isFinite(Number(enemy.gridX)) ? Number(enemy.gridX) : 0;
    const enemyY = Number.isFinite(Number(enemy.gridY)) ? Number(enemy.gridY) : 0;

    // The tactical planner replaces the old straight-line walk, which stepped with
    // Math.sign and went through walls, and which assumed every creature had five feet of
    // reach whatever it was holding.
    const { terrain, gridWidth, gridHeight } = getActiveBoardContext();
    const known = knownAbilities(enemy, getAbilityCatalogue());

    /** @param {any} member */
    const memberCell = (member) => ({
        x: Number.isFinite(Number(member.mapPosition?.gridX)) ? Number(member.mapPosition.gridX) : 0,
        y: Number.isFinite(Number(member.mapPosition?.gridY)) ? Number(member.mapPosition.gridY) : 0,
    });

    const plan = planEnemyTurn({
        actor: {
            id: String(enemy.instanceId),
            gridX: enemyX,
            gridY: enemyY,
            currentHp: Number(enemy.currentHp) || 0,
            maxHp: Number(enemy.maxHp) || 0,
            speedFeet: Number(enemy.speed) || 30,
            // Un cultista con un rayo de 120 ft se queda a su distancia, no se acerca a dar
            // punetazos. Sin habilidades, su alcance de siempre.
            attackRangeFeet: Math.max(Number(enemy.attackRangeFeet ?? enemy.range) || 5, longestReach(enemy, known)),
            profile: enemy.profile,
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

    const lines = [];
    const movedThisTurn = plan.movementCostFeet > 0;

    if (movedThisTurn) {
        enemy.gridX = plan.destination.x;
        enemy.gridY = plan.destination.y;
        lines.push(`🚶 ${enemy.name} avanza a (${plan.destination.x + 1}, ${plan.destination.y + 1}). ${plan.rationale} (${plan.movementCostFeet} ft)`);
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
    return Boolean(member && member.hp > 0);
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

    await openCharacterPanel({
        member,
        slotInfo: rules?.slotInfo ?? {},
        abilities: getAbilityCatalogue(),
        xpTable: rules?.progression?.xpThresholds ?? null,
        bondRank: Number(getCampaignBonds()?.[String(member.id)]?.rank) || 0,
        onEdit: () => { void openPartyMemberModal(member); },
        Popup,
        POPUP_TYPE,
    });
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
        postCombatNarration(`⚰️ [COMBAT] ${fall.reason}`);
        toastr.error(fall.reason, 'Se acabo', { timeOut: 15000 });
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
function resolveAllyTurnAction(entry) {
    const member = partyMembers.find(m => Number(m.id) === Number(entry.id));
    if (!member) return '';

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
        })),
        allies: partyMembers
            .filter(m => Number(m.id) !== Number(member.id) && (Number(m.hp) || 0) > 0)
            .map(m => ({ id: String(m.id), ...cellOf(m) })),
        stance,
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
    if (!open) {
        board.terrain = setDoorOpen(normalizeTerrain(board.terrain), gx, gy, false);
        persistBoardTerrain(board);
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
        instances.push({
            instanceId: generateEnemyInstanceId(),
            templateId: template.id,
            name: already > 0 ? `${template.name} ${already + 1}` : template.name,
            avatar: template.avatar,
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
    // Antes de una pelea que puede torcer la campana, una red. Solo con los duros: un
    // punto antes de cada rata seria un cajon de sastre y tapa a los que guardas tu.
    const boss = newEnemies.find(e => (Number(e.cr) || 0) >= 2 || (Number(e.maxHp) || 0) >= 40);
    if (boss && !combatEncounter.active) {
        saveCheckpoint(`Antes de ${boss.name}`, true);
    }

    /** @type {import('./dnd-system.js').TurnEntry[]} */
    const turnEntries = [];
    for (const m of partyMembers) {
        const init = rollInitiativeWithPopover(m.name, m.dexterity || 10, 'ally');
        turnEntries.push({ id: String(m.id), name: m.name, initiative: init, isEnemy: false });
    }

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
        rules: lootRulesWithWorldItems(worldItemCatalogue),
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
        for (const dropped of loot.items) {
            const item = createItem(/** @type {any} */ (
                describeLootItem(dropped.name, dropped.rarity, worldItemCatalogue)));
            addItemToInventory(/** @type {any} */ (holder), item);
        }
    }

    for (const line of loot.lines) postCombatNarration(line);

    // Levelling is not automatic: the sheet already has a button for it, and deciding
    // when to level is a player's business, not the engine's.
    for (const member of survivors) {
        if (member.xpNext > 0 && member.xp >= member.xpNext) {
            postCombatNarration(`⭐ [COMBAT] ${member.name} tiene experiencia para subir de nivel.`);
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
    if (!String(currentBoardName).includes('(encargo)')) return;

    const guild = getGuild();
    const done = completeContract(guild, taken);

    // El pago va al grupo, al mismo bolsillo del que sale la cena.
    const holder = partyMembers.find(m => (m.hp || 0) > 0) ?? partyMembers[0];
    if (holder) holder.gold = (Number(holder.gold) || 0) + done.gold;

    guild.renown = done.renown;
    chat_metadata[GUILD_KEY] = guild;
    delete chat_metadata[TAKEN_KEY];

    noteDeed(`Entregasteis el encargo «${taken.title}»${taken.patron ? ` (lo pedía ${taken.patron})` : ''}.`);

    // Si era el favor que se debia, la cuenta queda saldada.
    const debt = getDebt();
    if (settlesDebt(debt, taken)) {
        delete chat_metadata[DEBT_KEY];
        const paid = `Favor cumplido: ${debt?.patronName} da la deuda por saldada.`;
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
async function settleFactionStake(contract) {
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
        const saidStanding = mine
            ? `${mine.name}: ${describeStanding(mine.reputation)}.`
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
    const { kept, expired } = expireContracts(chat_metadata[BOARD_KEY] ?? [], today);

    for (const gone of expired) {
        postCombatNarration(`📄 [GREMIO] Se paso el plazo: ${gone.title}.`);
    }

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

    if (kept.length < wanted) {
        const fresh = generateBoardOfContracts({
            random: nextRandom,
            count: wanted - kept.length,
            renown: guild.renown,
            theme: guild.theme,
            day: today,
            places: getCurrentWorldLocationMaps().map((/** @type {any} */ l) => String(l?.name || '')).filter(Boolean),
            bestiary: getCurrentWorldEnemies().map((/** @type {any} */ e) => String(e?.name || '')).filter(Boolean),
        });
        kept.push(...fresh);
    }

    chat_metadata[BOARD_KEY] = kept;
    saveMetadata();
    return kept;
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
    if (!chat_metadata) return;

    // 1. Curar. Lo permanente se queda; lo demas cuenta los dias.
    /** @type {string[]} */
    const mended = [];
    for (const member of partyMembers) {
        if (readInjuries(member).length === 0) continue;

        const patch = healInjuries(member, days);
        member.injuries = patch.injuries;
        member.baseStats = patch.baseStats;
        Object.assign(member, patch.stats);
        for (const injury of patch.healed) mended.push(`${member.name}: ${injury.label.toLowerCase()}, curado.`);
    }
    if (mended.length > 0) {
        postCombatNarration(`🩹 [CAMPAÑA] ${mended.join(' ')}`);
        savePartyState();
    }

    // 2. Comer, beber, dormir y aguantar el clima. Hasta ahora la comida se pagaba y no
    // pasaba nada si no comias: un aviso y a seguir.
    passNeeds(days);

    // 3. Cobrar, cuando toca. El dia de vencimiento vive en la partida, no en la sesion.
    const today = Math.max(1, Math.floor(Number(calendar?.day) || 1));
    const week = Math.max(1, Number(currentUpkeepRules().weekLength) || 7);

    let due = Number(chat_metadata[BILL_DUE_KEY]);
    if (!Number.isFinite(due) || due <= 0) {
        // La primera semana empieza a contar hoy, no se debe desde el minuto uno.
        chat_metadata[BILL_DUE_KEY] = today + week;
        saveMetadata();
        return;
    }

    while (today >= due) {
        chargeWeek();
        due += week;
    }
    chat_metadata[BILL_DUE_KEY] = due;
    saveMetadata();
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
    // Primero cobran lo que se debe: el viernes es el viernes para todos.
    settleDueDebt();

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
        partyMembers = partyMembers.filter(m => !loyalty.leaving.includes(String(m.name)));
        renderPartyMembers();
    }
    for (const line of loyalty.lines) postCombatNarration(`🤝 [GREMIO] ${line}`);

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
        today: Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1)),
    }) : '';
    setExtensionPrompt(key, block, extension_prompt_types.IN_PROMPT, 0, false, extension_prompt_roles.SYSTEM);
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

    noteDeed(`${offer.debt.patronName} pagó vuestra cuenta de la semana.`);
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
async function shiftFactionStanding(factionId, amount) {
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
    const before = campaignDay();
    const result = campaign.advanceSlot();
    if (isShellOpen()) refreshGameShell();
    // Pasar el ultimo turno del dia es pasar de dia, aunque el boton diga otra cosa.
    chargeFactionDays(before);
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

/**
 * Lo que el calendario se haya movido, se lo deben las facciones.
 *
 * **Se mide, no se confia.** Sumar uno al pasar el dia parecia lo mismo y no lo era: un
 * descanso largo adelanta el dia **por dentro** del modulo de campana, y un turno que
 * cierra la noche tambien. Por esos dos caminos dormir les salia gratis, que es justo el
 * reloj aparte que este sistema no quiere tener.
 *
 * @param {number} before El dia que marcaba el calendario antes.
 */
function chargeFactionDays(before) {
    const days = campaignDay() - before;
    if (days <= 0) return;
    // El mismo dia que cura y da de comer acerca a los otros a lo que quieren.
    factionDaysDue += days;
    scheduleFactionTick();
}

/** @returns {number} */
function campaignDay() {
    return Math.max(0, Math.floor(Number(getCampaignCalendar()?.day) || 0));
}

const advanceCampaignDay = () => {
    const before = campaignDay();
    const result = campaign.advanceDay();
    if (isShellOpen()) refreshGameShell();
    chargeFactionDays(before);
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
async function passFactionDays(days) {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName || days <= 0) return;

    try {
        const data = await loadWorldInfo(worldName);
        const before = readFactions(data?.metadata?.factions);
        if (before.length === 0) return;

        const { factions, events } = tickFactions({
            factions: before, days, here: currentLocationName,
        });

        // Lo que se cumple cambia la lista de sitios, que es lo que el viaje ya lee.
        let locations = Array.isArray(data.metadata.locationMaps) ? data.metadata.locationMaps : [];
        let people = factions;
        /** @type {string[]} */
        const changed = [];
        for (const event of events.filter(e => e.kind === 'cumple')) {
            const who = people.find(f => f.id === event.faction);
            if (!who) continue;
            const applied = applyOutcome({ locations, factions: people, outcome: outcomeOf(who) });
            locations = applied.locations;
            people = applied.factions;
            changed.push(...applied.changed);
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
    if (isShellOpen()) refreshGameShell();
    return result;
};
const getCurrentSlotLabel = () => campaign.getSlotLabel();
/** @param {'corto'|'largo'} kind @returns {Promise<string>} */
const takeRest = async (kind) => {
    const before = campaignDay();
    const result = await campaign.rest(kind);
    if (isShellOpen()) refreshGameShell();
    // Un descanso largo adelanta el dia por dentro: sin esto, dormir era la forma de
    // pararles el reloj.
    chargeFactionDays(before);
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
    });

    if (found.length === 0) return;

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
        bill: partyMembers.length > 0 ? weeklyBill(partyMembers, { rules: currentUpkeepRules() }) : null,
        daysToBill: Number.isFinite(due) ? Math.max(0, due - today) : 0,
        // Una cuenta que sube sin decir por que es un impuesto; una que dice «han cerrado
        // el paso del norte» es una razon para ir a abrirlo.
        market: describeMarket(currentMarket()),
        // Como esta cada uno: solo aparece quien tiene algo que contar.
        needs: partyMembers
            .map(member => ({ name: member.name, said: describeNeeds(member) }))
            .filter(entry => entry.said),
        // Lo que se mueve ahi fuera sin ti. Sin facciones escritas, la lista sale vacia
        // y el panel queda como estaba.
        world: describeWorldFactions(),
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
function resolveFollowUpAttack(actorId, target) {
    const ally = partyMembers.find(m => String(m.id) === String(actorId));
    if (!ally || (target.currentHp || 0) <= 0) return;

    const rangeFeet = getAttackRangeFeet(ally);
    const attackMod = getPlayerAttackModifier(ally, rangeFeet);
    const attackRoll = rollDiceDetailed('1d20', 20);
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
    lines.push(`🤝 ${ally.name} ataca de seguimiento a ${target.name}.`);
    lines.push(`🎲 Tirada de ataque: d20(${attackRoll.total}) ${attackMod >= 0 ? '+' : ''}${attackMod} = ${attackTotal} vs AC ${targetAc}${describeCover(cover)}`);

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
    lines.push(`✅ Resultado: impacto${isCrit ? ' critico' : ''}.`);
    lines.push(`💥 Tirada de dano: ${damageFormula}(${damageRoll.total}) + mod(${damageMod}) = ${totalDamage}`);
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
    postCombatNarration(buildCombatSummary(/** @type {'victory'|'defeat'|'manual'|'ended'} */ (reason)));

    // Winning has to be worth something, or the tactical engine underneath is doing
    // careful work for nothing.
    if (reason === 'victory') {
        awardEncounterLoot(combatEncounter.enemies.filter(e => (e.currentHp || 0) <= 0));

        // Surviving a fight together is a recorded fact, which is the whole point of the
        // bond design: the engine decides it happened, the model writes about it later.
        const survivors = partyMembers.filter(m => (m.hp || 0) > 0);
        if (survivors.length > 1) {
            let bonds = getCampaignBonds();
            for (const member of survivors) {
                bonds = recordBondEvent(bonds, String(member.id), 'combat_together').state;
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
        abandoned: reason === 'manual',
        survivors: partyMembers.filter(m => (m.hp || 0) > 0).map(m => m.name),
        defeated: combatEncounter.enemies.filter(e => (e.currentHp || 0) <= 0).map(e => e.name),
    });
    postForModel(epilogue).catch(error => console.error('[party] could not post the combat epilogue', error));

    combatEncounter = createEmptyCombatEncounter();
    combatBoardSelection = { tokenId: null, boardName: '', locationName: '' };
    saveCombatState();
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
    for (const m of partyMembers) {
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
    const { cover } = getTargetArmorClass(enemy, member);

    // Las que este personaje se sabe y van sobre un enemigo, cada una con su veredicto:
    // un conjuro de 120 ft no esta "fuera de alcance" porque la espada llegue a 5.
    const usable = knownAbilities(member, getAbilityCatalogue())
        .filter(ability => ability.target === 'enemy')
        .map(ability => {
            const verdict = canUseAbility({
                member,
                ability,
                distanceFeet,
                hasAction: hasAction(combatEncounter, 'action'),
                hasBonus: hasAction(combatEncounter, 'bonus'),
                targetAlive: (Number(enemy.currentHp) || 0) > 0,
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
 * @returns {{cells: Array<{gridX: number, gridY: number}>, feet: number, ok: boolean}|null}
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
    return {
        cells: path.slice(1).map(cell => ({ gridX: cell.x, gridY: cell.y })),
        feet,
        ok: feet <= getRemainingMovementFeet(member),
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

    renderLocationMapsPreview();
    return `${member.name} -> ${targetX + 1},${targetY + 1}`;
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

    Object.assign(combatEncounter, useAction(combatEncounter, 'action'));
    const id = String(member.id);
    /** @type {string[]} */
    const lines = [];

    if (kind === 'esquivar' || kind === 'destrabarse') {
        combatEncounter.maneuvers = recordManeuver(combatEncounter.maneuvers, kind, id);
        lines.push(kind === 'esquivar'
            ? `🛡️ ${member.name} se cubre: hasta su proximo turno, atacarle es con desventaja.`
            : `🏃 ${member.name} se destraba: este turno se mueve sin dar ataques de oportunidad.`);
    } else if (kind === 'ayudar') {
        combatEncounter.maneuvers = recordManeuver(combatEncounter.maneuvers, 'ayudar', id, String(target.instanceId));
        lines.push(`🤝 ${member.name} distrae a ${target.name}: el proximo ataque del grupo contra el va con ventaja.`);
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
        lines.push(`💪 ${member.name} empuja a ${target.name}: ${attackTotal} contra ${defenseTotal}.`);
        if (!shove.success) {
            lines.push(`❌ ${target.name} aguanta el empujon.`);
        } else if (shove.pushedTo) {
            target.gridX = shove.pushedTo.x;
            target.gridY = shove.pushedTo.y;
            lines.push(`✅ ${target.name} retrocede a (${shove.pushedTo.x + 1}, ${shove.pushedTo.y + 1}).`);
        } else {
            // Sin sitio detras, cae: el empujon no se pierde, cambia de forma.
            applyTimedCondition(target, String(target.instanceId), 'Prone', 1);
            lines.push(`✅ ${target.name} no tiene a donde ir y cae al suelo: pegarle de cerca va con ventaja.`);
        }
    }

    saveCombatState();
    savePartyState();
    postCombatNarration(`[COMBAT] ${lines.join('\n')}`);
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

    const attackMod = getPlayerAttackModifier(member, rangeFeet);
    const edge = attackEdge({
        targetId: String(target.instanceId),
        targetConditions: target.activeConditions ?? [],
        attackerConditions: member.activeConditions ?? [],
        distanceFeet,
        maneuvers: combatEncounter.maneuvers,
        byParty: true,
    });
    const edged = rollWithEdge(() => rollDiceDetailed('1d20', 20).total, edge.mode);
    const attackRoll = { total: edged.natural, natural: edged.natural };
    // La ayuda vale para un golpe: se gasta aunque falle.
    if (edge.usesHelp) combatEncounter.maneuvers = consumeHelp(combatEncounter.maneuvers, String(target.instanceId));
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
    lines.push(`🎲 Tirada de ataque: d20(${attackRoll.total}) ${attackMod >= 0 ? '+' : ''}${attackMod} = ${attackTotal} vs AC ${targetAc}${describeCover(targetCover)}${describeEdge(edged, edge.mode, edge.reasons)}`);

    Object.assign(combatEncounter, useAction(combatEncounter, 'action'));

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
    const damageMod = Math.max(0, getPlayerAttackModifier(member, rangeFeet));
    const totalDamage = Math.max(1, damageRoll.total + (critRoll?.total || 0) + damageMod);

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
    lines.push(`✅ Resultado: impacto${isCrit ? ' critico' : ''}.`);
    lines.push(`💥 Tirada de dano: ${damageFormula}(${damageRoll.total})${isCrit ? ` + crit(${critRoll?.total || 0})` : ''} + mod(${damageMod}) = ${totalDamage}`);
    lines.push(`❤️ Estado de ${target.name}: ${target.currentHp}/${target.maxHp}`);

    if (target.currentHp === 0) {
        lines.push(`☠️ ${target.name} cae derrotado.`);
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
        return { active: false, round: 0, turnLabel: '', movement: '', isPlayerTurn: false, hasAction: false, targets: [] };
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
    };
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
        // Para que el tablon pueda decir a quien ayudas o a quien paras por su nombre.
        factionNames: Object.fromEntries(
            getCurrentWorldFactions().map((/** @type {any} */ f) => [f.id, f.name]),
        ),
    });
    if (!choice) return describeGuild(guild);

    if (choice.built) return raiseBuilding(choice.built, purse);
    if (choice.accepted) return await acceptContract(choice.accepted);
    return '';
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

    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    const data = await loadWorldInfo(worldName);
    if (!data) return '';

    const bestiary = getCurrentWorldEnemies()
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
    const templates = compendium.has('sitios')
        ? compendium.find('sitios', { kind: 'sala' }).map((/** @type {any} */ row) => row.rows)
        : [];

    const generated = generateBoard({
        // El dado del mundo, no el de la sesion: el mismo encargo da el mismo sitio.
        random,
        size: contract.difficulty >= 5 ? 'large' : (contract.difficulty >= 1 ? 'medium' : 'small'),
        shape: String(type?.shape || 'rooms'),
        templates,
        state: state ? { cover: state.cover, rough: state.rough } : null,
        bestiary,
        partySize: Math.max(1, partyMembers.length),
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
        objectives: [],
    };
    place.boards = [...place.boards.filter((/** @type {any} */ b) => b?.name !== boardName), built];

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
            abilities: getAbilityCatalogue(),
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
const getAbilityCatalogue = () => normalizeAbilities(getActiveRuleset()?.abilities);

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
    });
    if (!verdict.ok) {
        toastr.warning(verdict.reason);
        return '';
    }

    const plan = planAbilityUse({
        actor: member,
        target: subject,
        ability,
        roll: (/** @type {string} */ formula) => rollDiceDetailed(formula, 8),
        attackModifier: getPlayerAttackModifier(member, ability.rangeFeet),
        targetAc: ability.target === 'enemy' ? getTargetArmorClass(subject, member).ac : 10,
        saveModifier: abilityModifier(subject, ability.saveAbility),
    });

    // El coste se paga aunque falle: lanzar y errar tambien gasta el turno.
    if (ability.cost !== 'free') {
        Object.assign(combatEncounter, useAction(combatEncounter, ability.cost === 'bonus' ? 'bonus' : 'action'));
    }
    member.abilityUses = spendAbilityUse(member, ability);

    const lines = [...plan.lines];

    if (plan.damage > 0 && ability.target === 'enemy') {
        subject.currentHp = Math.max(0, (Number(subject.currentHp) || 0) - plan.damage);
        lines.push(`❤️ Estado de ${subject.name}: ${subject.currentHp}/${subject.maxHp}`);
        if (subject.currentHp === 0) {
            lines.push(`☠️ ${subject.name} cae derrotado.`);
            combatEncounter.conditionTimers = clearTimersFor(combatEncounter.conditionTimers, String(subject.instanceId));
        }
    }

    if (plan.healing > 0 && ability.target !== 'enemy') {
        const before = Number(subject.hp) || 0;
        subject.hp = Math.min(Number(subject.maxHp) || before, before + plan.healing);
        lines.push(`❤️ Estado de ${subject.name}: ${subject.hp}/${subject.maxHp}`);

        // Curar a quien estaba en el suelo lo levanta y borra la cuenta: es para lo que
        // sirve una curacion en mitad de un combate.
        if (before <= 0 && subject.hp > 0) {
            subject.deathSaves = clearDeathSaves();
            subject.activeConditions = (Array.isArray(subject.activeConditions) ? subject.activeConditions : [])
                .filter((/** @type {string} */ c) => c !== 'Unconscious');
            lines.push(`🙌 ${subject.name} vuelve en si.`);
        }
    }

    if (plan.condition) {
        const who = ability.target === 'enemy' ? String(subject.instanceId) : String(subject.id);
        applyTimedCondition(subject, who, plan.condition, plan.conditionRounds);
    }

    saveCombatState();
    savePartyState();
    postCombatNarration(lines.join('\n'));
    renderPartyMembers();
    renderLocationMapsPreview();

    return `${member.name} usa ${ability.name}`;
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
    chat_metadata[CHECKPOINT_KEY] = addCheckpoint(chat_metadata[CHECKPOINT_KEY], checkpoint);
    saveMetadata();

    postCombatNarration(`💾 [PARTIDA] Punto de retorno: ${describeCheckpoint(checkpoint)}.`);
    return checkpoint.id;
}

/**
 * Devuelve la partida a un punto guardado.
 *
 * @param {string} id
 * @returns {boolean}
 */
function restoreCheckpoint(id) {
    const checkpoint = findCheckpoint(chat_metadata?.[CHECKPOINT_KEY], id);
    if (!checkpoint) {
        toastr.warning('Ese punto de retorno ya no esta.');
        return false;
    }

    const state = checkpoint.state ?? {};

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

    renderPartyMembers();
    renderCampaignTab();
    renderLocationMapsPreview();

    postCombatNarration(`⏪ [PARTIDA] Vuelta a: ${describeCheckpoint(checkpoint)}.`);
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

    const actions = $('<div class="lu-actions"></div>');
    const confirm = $('<button class="menu_button lu-btn lu-confirm" type="button"></button>').text('Subir de nivel');

    function refresh() {
        const verdict = validateAbilityPicks(picks, plan, member);
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
        Object.assign(member, buildLevelUpPatch(member, plan, picks));
        savePartyState();
        renderPartyMembers();
        postCombatNarration(`⭐ [NIVEL] ${describeLevelUp(member, plan)}`);
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
        for (const option of remedies) {
            const buy = $('<button class="menu_button cc-remedy-btn" type="button"></button>')
                .attr('data-remedy', option.injuryId)
                .attr('title', option.remedy.description)
                .prop('disabled', combatEncounter.active || !option.affordable)
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
function buildShellChips() {
    const location = currentLocationName
        ? getCurrentWorldLocationMaps().find(l => l.name === currentLocationName)
        : null;

    return buildActionChips({
        fighting: combatEncounter.active,
        hasBoard: Boolean(currentBoardName),
        doors: closedDoorsNearParty(),
        companions: partyMembers.map(m => ({ name: m.name })),
        mentioned: namesInLastNarration(),
        places: getCurrentWorldLocationMaps()
            .filter(l => l.name !== currentLocationName)
            .map(l => ({ name: l.name })),
        boards: getLocationBoards(location).map((/** @type {any} */ b) => ({ name: b.name })),
        hurt: partyMembers.some(m => (Number(m.hp) || 0) < (Number(m.maxHp) || 0)),
        // Cuantos dados quedan sale del nivel y de los ya gastados; las caras las
        // lee el descanso, que puede esperar al Lorebook porque es asincrono.
        hitDice: availableHitDice(partyMembers),
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
function runSkillCheck(skill) {
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
    const result = rollCheck({ member, skill, rollD20: () => rollDiceDetailed('1d20', 20).total });
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
    saveMetadata();
    draftInChat(result.draft);
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
    if (fired.length === 0) return;

    board.hazards = hazards;
    persistBoardTerrain(board);

    for (const hazard of fired) {
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
 * @returns {Promise<boolean>}
 */
async function askBeforeTravelling(plan) {
    const jornadas = plan.days === 1 ? 'un día de camino' : `${plan.days} días de camino`;
    const por = plan.legs.length > 1
        ? `Se pasa por ${plan.legs.slice(0, -1).join(', ')}.`
        : 'Se va directo.';

    const answer = await Popup.show.confirm(
        `Viajar a ${plan.to}`,
        `${jornadas}. ${por} Por el camino se come, se cura y corre la semana.`,
        { okButton: 'Viajar', cancelButton: 'Ahora no' },
    );
    return Boolean(answer);
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
 * @param {{confirm?: (plan: any) => Promise<boolean>}} [options]
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
    });
    // El motivo, no un boton que no hace nada: "el paso esta cerrado" es una meta.
    if (!plan.ok) return { to: '', reason: plan.reason };

    // Pensarselo mejor no es un fallo: sin motivo, nadie avisa de nada.
    if (options.confirm && !(await options.confirm({ ...plan, to: match.name }))) {
        return { to: '', reason: '' };
    }

    // Los sucesos del camino, con la semilla del mundo: el mismo viaje sale igual dos
    // veces, que es lo unico que la semilla promete.
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    const compendium = await campaignCompendium();
    const hasWorld = compendium.has('mundo');
    const table = hasWorld ? compendium.find('mundo', { kind: 'suceso' }) : [];

    // Por donde se va y que tiempo admite: en una cueva no nieva, y eso lo dice la
    // bateria, no este codigo.
    const biome = String(match.biome || '');
    const climates = hasWorld
        ? (compendium.find('mundo', { kind: 'bioma', biome })[0]?.climates ?? [])
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

    const events = travelEvents({
        days: plan.days,
        table: table.length > 0 ? table : DEFAULT_TRAVEL_EVENTS,
        biome,
        weather,
        random,
    });

    // Quien os tiene ganas y manda por donde pasais os para: peaje, o rodeo.
    const trouble = roadTrouble({ factions: getCurrentWorldFactions(), places: plan.legs, purse: partyPurse() });
    if (trouble?.toll) payFromParty(trouble.toll);
    if (trouble) {
        events.push({ day: 1, id: `peaje_${trouble.faction}`, name: trouble.name, note: trouble.note, days: trouble.days, climate: '' });
    }

    // Un atajo resta y una tormenta suma, pero un viaje nunca dura menos de un dia:
    // llegar antes de salir no lo cuenta nadie.
    const delay = events.reduce((sum, event) => sum + event.days, 0);
    const total = Math.max(MIN_DAYS, plan.days + delay);

    currentLocationName = match.name;
    currentBoardName = '';
    saveCurrentLocation();
    saveCurrentBoard();

    // El reloj de uno en uno: cada dia cura, pasa hambre y acerca la cuenta semanal. Un
    // salto de cinco dias de golpe se saltaria cuatro de esos.
    for (let day = 0; day < total; day++) advanceCampaignDay();

    const told = [describeTravel(plan)];
    if (delay > 0) told.push(`${delay} de retraso`);
    else if (delay < 0) told.push(`${-delay} menos de lo previsto`);
    if (weather.length > 0) told.push(`tiempo: ${[...new Set(weather)].join(', ')}`);
    toastr.info(told.join(' · '), `Llegáis a ${match.name}`);

    for (const event of events) {
        toastr.info(event.note, `Día ${event.day}: ${event.name}`, { timeOut: 6000 });
    }

    // Y el narrador se entera, por el canal que el modelo lee de verdad. Un mensaje de
    // sistema lo veria quien juega y no lo veria el modelo, que es justo al reves.
    const note = [
        `El grupo viaja hasta ${match.name}. ${describeTravel(plan)}.`,
        weather.length > 0 ? `El tiempo, día a día: ${weather.join(', ')}.` : '',
        ...events.map(event => `Día ${event.day}: ${event.name}. ${event.note}`),
        'Cuenta el viaje en un párrafo breve. No inventes nada que no esté aquí.',
    ].filter(Boolean).join('\n');
    postForModel(note).catch(error => console.error('[party] travel note failed', error));

    return { to: match.name, reason: '' };
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
    return buildExplorationView({
        locationMaps: getCurrentWorldLocationMaps(),
        campaignMap: getCampaignMap(),
        currentLocation: currentLocationName,
        currentBoard: currentBoardName,
        party: partyMembers,
        bonds: getCampaignBonds(),
        calendar: getCampaignCalendar(),
        xpTable: getXpTable(),
    });
}

/**
 * @returns {import('./game-engine/ui/shell/game-shell.js').ShellOptions}
 */
function buildShellOptions() {
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
        }),
        getChips: buildShellChips,
        onChip: runShellChip,
        getChecks: () => (combatEncounter.active || !partyMembers[0]
            ? []
            : checkOptions(partyMembers[0], { locked: Boolean(chat_metadata?.[PENDING_CHECK_KEY]) })),
        onCheck: (skill) => { runSkillCheck(skill); },
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
        onEditCampaign: () => { void openCampaignBuilder(); },
        // El asistente de campana vive en la pantalla de bienvenida, que viaja dentro del
        // chat adoptado: pulsar su boton es pulsar el que ya existe.
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
        onEndTurn: () => endPlayerCombatTurn(),
        onFlee: () => {
            if (!combatEncounter.active) return;
            endCombat('manual');
            renderLocationMapsPreview();
        },
        onClose: () => setLocationMapsHidden(wasHidden),
        getAbilities: () => {
            const member = getCurrentActingMember();
            if (!member || !combatEncounter.active) return [];
            return knownAbilities(member, getAbilityCatalogue())
                .filter(ability => ability.target !== 'enemy')
                .map(ability => {
                    const verdict = canUseAbility({
                        member,
                        ability,
                        hasAction: hasAction(combatEncounter, 'action'),
                        hasBonus: hasAction(combatEncounter, 'bonus'),
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
            return judgeManeuvers({
                hasAction: hasAction(combatEncounter, 'action'),
                enemies: getAliveEnemies().map((/** @type {any} */ e) => ({
                    id: String(e.instanceId),
                    name: String(e.name),
                    distanceFeet: getDistanceInFeet(x, y, Number(e.gridX) || 0, Number(e.gridY) || 0),
                })),
            });
        },
        onManeuver: (maneuverId, targetId) => { performManeuver(maneuverId, targetId); },
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
        const partySight = allBoardTokens
            .filter(t => !t.isEnemy)
            .map(t => ({ gridX: t.gridX, gridY: t.gridY, sightFeet: t.sightFeet }));
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


        // ---- Iniciar combate (wiki/ROADMAP_JUEGO_SIN_COMANDOS.md, K2) ----
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
            renderCombatLog(logPanel, combatLogEntries);
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
                    unequipItem(member, slotKey);
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
                <div class="dnd-item-name">${item.name}</div>
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
        equipItem(member, itemId, slot);
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
            const effectsText = (item.effects || []).map(/** @param {import('./dnd-system.js').DndItemEffect} e */ e => `${e.stat} ${e.modifier >= 0 ? '+' : ''}${e.modifier}`).join(', ');
            const metaText = buildItemMetaSummary(item).join(' · ');
            const card = $(`
                <div class="dnd-item-card ${isEquipped ? 'equipped' : ''}" data-item-id="${item.id}">
                    ${item.image ? `<img class="dnd-item-img" src="${item.image}" />` : '<div class="dnd-item-img-placeholder"><i class="fa-solid fa-box"></i></div>'}
                    <div class="dnd-item-info">
                        <div class="dnd-item-name">${item.name}${isEquipped ? ' <span style="color:#2dd4bf;font-size:0.7rem;">(equipped)</span>' : ''}</div>
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
                if (item.slot) equipItem(member, item.id, item.slot);
                rebuildInventoryPanel(panel, member);
            });

            card.find('.unequip-btn').on('click', function (e) {
                e.stopPropagation();
                const slot = Object.entries(member.equippedItems || {}).find(([, v]) => v === item.id)?.[0];
                if (slot) unequipItem(member, slot);
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
    // book later. See wiki/ROADMAP_INGESTA_CAMPANAS_LIBROS.md.
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
        callback: (_args, value) => {
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
                return restoreCheckpoint(target.id) ? `vuelta a ${target.label}` : '';
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
            + '<code>/maniobra empujar Goblin</code> o <code>/maniobra ayudar Goblin</code>. Gasta la accion.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'la maniobra y, si hace falta, a quien',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
            }),
        ],
        callback: (_args, value) => {
            const [kind, ...rest] = String(value ?? '').trim().split(/\s+/);
            return performManeuver(String(kind || '').toLowerCase(), rest.join(' '));
        },
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
            .then(({ recordPrompt }) => recordPrompt(data, dryRun))
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
