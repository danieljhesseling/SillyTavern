import { t } from './i18n.js';
import { power_user } from './power-user.js';
import { POPUP_TYPE, POPUP_RESULT, Popup } from './popup.js';
import { sendSystemMessage, system_message_types } from './system-messages.js';
import { getThumbnailUrl, chat, chat_metadata, saveMetadata, eventSource, event_types, setUserName, addOneMessage, saveChatConditional, substituteParams, system_avatar } from '../script.js';
import { getMessageTimeStamp } from './RossAscends-mods.js';
import { getCurrentWorldMapUrl, getCurrentWorldLocationMaps, getCurrentWorldBoards, getCurrentWorldEnemies, getCurrentWorldNPCs, loadWorldInfo, saveWorldInfo, METADATA_KEY } from './world-info.js';
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
import { escapeHtml } from './utils.js';
import {
    rollDice, rollDiceDetailed, getRollClassification, getRollClassificationLabel,
    getDistanceInFeet, getAttackRangeFeet, describeCover,
    getPlayerDamageFormula, getEnemyDamageFormula, getPlayerAttackModifier,
    createEmptyCombatEncounter, normalizeCombatEncounter,
} from './party/combat-rules.js';
import { escItemText, buildPartyItemSections } from './party/item-forms.js';
import { resolveEntryMapPosition } from './party/positions.js';
import {
    normalizeTerrain, setCell as setTerrainCell, getTerrainOptions, getCoverBonus, setDoorOpen,
} from './game-engine/board/terrain.js';
import { getReachableCells } from './game-engine/board/pathfinding.js';
import { createEmptyFog, normalizeFog, updateFog } from './game-engine/board/fog-of-war.js';
import { planEnemyTurn } from './game-engine/combat/enemy-ai.js';
import {
    buildTracker, describeTurn, statusMarkers, sizeToCells, toggleCondition,
} from './game-engine/combat/initiative-tracker.js';
import {
    createTurnState, advanceTurn, getRemainingMovement, spendMovement, hasAction, useAction,
} from './game-engine/combat/turn-machine.js';
import { rollEncounterLoot } from './game-engine/combat/loot.js';
import { planEndure, planFollowUp, planBatonPass } from './game-engine/combat/bond-perks.js';
import {
    buildBoardState, judgeScenario, hasScenario,
} from './game-engine/combat/scenario-board.js';
import {
    normalizeCalendar, advanceSlot, advanceToNextDay, formatCalendar,
} from './game-engine/campaign/calendar.js';
import {
    normalizeBondState, recordBondEvent, resetDailyPerks, getBondProgress, spendPerk, BOND_EVENTS,
} from './game-engine/campaign/bonds.js';
import { renderCampaignPanel } from './game-engine/ui/campaign-panel.js';
import {
    buildEpiloguePrompt, createCombatLogPanel, renderCombatLog, setRound,
    rollEntry, lineToEntry, append as appendLogEntry,
} from './game-engine/ui/combat-log.js';
import { buildGameMessage, CHANNEL } from './game-engine/ui/chat-channel.js';
import { guardRolls, guardImpossibleRolls, describeCorrections } from './game-engine/combat/roll-guard.js';
import {
    planRulesetChange, readRememberedRuleset, rememberRuleset, setActiveRuleset,
} from './game-engine/rules/ruleset.js';
import {
    isShellOpen, toggleGameShell, refreshGameShell, closeGameShell,
} from './game-engine/ui/shell/game-shell.js';
import { buildDialogueView } from './game-engine/ui/shell/dialogue-scene.js';

/** @typedef {import('./party/types.js').PartyMember} PartyMember */
/** @type {PartyMember[]} */
let partyMembers = [];

const LOCATION_MAPS_MANUAL_HIDDEN_KEY = 'sillytavern_locationMapsManualHidden';

/** @type {boolean} */
let locationMapsManuallyHidden = false;

/** @type {{ tokenId: number|null, boardName: string, locationName: string }} */
let combatBoardSelection = { tokenId: null, boardName: '', locationName: '' };

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
async function loadDndCatalog(worldName) {
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
    );
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
function getControlledMemberIds() {
    const linked = partyMembers.filter(m => m.personaId !== null).map(m => m.id);
    return linked.length > 0 ? linked : partyMembers.map(m => m.id);
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

        const boards = Array.isArray(data.metadata.boards) ? data.metadata.boards : [];
        const stored = boards.find((/** @type {any} */ b) => b.name === board.name);
        if (!stored) return;

        stored.terrain = board.terrain;
        stored.fog = board.fog;
        stored.fogEnabled = board.fogEnabled;
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
 * @returns {{terrain: import('./game-engine/board/terrain.js').BoardTerrain, gridWidth: number, gridHeight: number}}
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
function getTargetArmorClass(target) {
    const base = Number(target?.armorClass) || 10;
    const x = Number(target?.gridX ?? target?.mapPosition?.gridX);
    const y = Number(target?.gridY ?? target?.mapPosition?.gridY);

    if (!Number.isFinite(x) || !Number.isFinite(y)) return { ac: base, cover: 0 };

    const cover = Number(getCoverBonus(getActiveBoardTerrain(), x, y)) || 0;
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
            attackRangeFeet: Number(enemy.attackRangeFeet ?? enemy.range) || 5,
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

    if (plan.action !== 'attack' || !plan.targetId) {
        lines.push(`⛔ ${enemy.name}: ${plan.rationale}`);
        if (movedThisTurn) saveCombatState();
        return lines.join('\n');
    }

    const target = livingParty.find(member => String(member.id) === plan.targetId);
    if (!target) {
        return `[COMBAT] ${enemy.name} no encuentra un objetivo valido.`;
    }

    const attackRoll = rollDiceDetailed('1d20', 20);
    const d20 = attackRoll.total;
    const attackMod = Math.max(
        getAbilityModifier(enemy.strength || 10),
        getAbilityModifier(enemy.dexterity || 10),
    );
    const attackTotal = d20 + attackMod;
    const { ac: targetAc, cover: targetCover } = getTargetArmorClass(target);
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
    lines.push(`🎲 Tirada de ataque: d20(${d20}) ${attackMod >= 0 ? '+' : ''}${attackMod} = ${attackTotal} vs AC ${targetAc}${describeCover(targetCover)}`);

    if (!isHit) {
        lines.push('❌ Resultado: fallo.');
        if (movedThisTurn) saveCombatState();
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

    // Rank 8: a companion steps in rather than watch them drop. Once a day, and only
    // when the blow would really have finished them.
    const rescue = planEndure({
        bonds: getCampaignBonds(),
        party: partyMembers,
        targetId: String(target.id),
        currentHp: Number(target.hp) || 0,
        damage: totalDamage,
    });

    if (rescue) {
        saveCampaignState(null, spendPerk(getCampaignBonds(), rescue.saviourId, rescue.perkId));
        target.hp = 1;
        lines.push(`🛡️ ${rescue.saviourName} se interpone: ${target.name} aguanta con 1 HP.`);
    } else {
        target.hp = Math.max(0, (target.hp || 0) - totalDamage);
    }

    target.activeConditions = Array.isArray(target.activeConditions) ? target.activeConditions : [];

    lines.push(`✅ Resultado: impacto${isCrit ? ' critico' : ''}.`);
    lines.push(`💥 Tirada de daño: ${dmgFormula}(${baseDamage})${isCrit ? ` + crit(${critBonus})` : ''} + mod(${strMod}) = ${totalDamage}`);
    lines.push(`❤️ Estado de ${target.name}: ${target.hp}/${target.maxHp}`);

    if (target.hp === 0) {
        if (!target.activeConditions.includes('Unconscious')) {
            target.activeConditions.push('Unconscious');
        }
        lines.push(`🩸 ${target.name} cae a 0 HP y gana estado: Unconscious.`);
    } else if (isCrit && Math.random() < 0.35) {
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

function advanceTurnIndex() {
    if (!combatEncounter.active || combatEncounter.turnOrder.length === 0) return null;

    // The machine owns the walk: it skips the fallen, wraps the order and counts the
    // round. This used to be a second implementation of the same thing, right here.
    const roundBefore = Number(combatEncounter.round) || 1;
    const advanced = advanceTurn(combatEncounter, entry => canTurnEntryAct(entry));

    if (advanced === combatEncounter) return null;   // nobody left who can act

    Object.assign(combatEncounter, advanced);
    saveCombatState();

    // Announced here rather than inside the machine, which stays pure and silent.
    if (combatEncounter.round > roundBefore) {
        postCombatNarration(`⏳ [COMBAT] Ronda ${combatEncounter.round}`);
        // A scenario won by the clock has no other moment to notice.
        if (checkScenarioOutcome()) return null;
    }

    return getCurrentTurnEntry();
}

/**
 * @param {boolean} [includeCurrent=true]
 */
function runCombatTurnLoop(includeCurrent = true) {
    if (!combatEncounter.active || combatEncounter.turnOrder.length === 0) return null;

    let entry = includeCurrent ? getCurrentTurnEntry() : advanceTurnIndex();
    if (!entry || !canTurnEntryAct(entry)) {
        entry = advanceTurnIndex();
    }

    let safety = 0;
    while (entry && combatEncounter.active && entry.isEnemy && safety < combatEncounter.turnOrder.length + 1) {
        announceTurnInChat(entry);
        const actionLog = resolveEnemyTurnAction(entry);
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
            gridX: Math.floor(Math.random() * Math.min(gridWidth, 10)),
            gridY: Math.floor(Math.random() * Math.min(gridHeight, 10)),
        });
    }

    // Build initiative entries for party members
    /** @type {import('./dnd-system.js').TurnEntry[]} */
    const turnEntries = [];
    for (const m of partyMembers) {
        const init = rollInitiativeWithPopover(m.name, m.dexterity || 10, 'ally');
        turnEntries.push({ id: String(m.id), name: m.name, initiative: init, isEnemy: false });
    }

    // Build initiative entries for enemies
    for (const e of newEnemies) {
        const init = rollInitiativeWithPopover(e.name, e.dexterity || 10, 'enemy');
        turnEntries.push({ id: e.instanceId, name: e.name, initiative: init, isEnemy: true });
    }

    // Sort descending by initiative (ties: non-enemies first)
    turnEntries.sort((a, b) => b.initiative - a.initiative || (a.isEnemy ? 1 : 0) - (b.isEnemy ? 1 : 0));

    combatEncounter = {
        active: true,
        enemies: [...combatEncounter.enemies, ...newEnemies],
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

    const loot = rollEncounterLoot(defeated, survivors.length, {
        roll: (/** @type {string} */ formula) => rollDice(formula, 6),
    });

    for (const member of survivors) {
        member.gold = (Number(member.gold) || 0) + loot.goldEach;
        member.xp = (Number(member.xp) || 0) + loot.xpEach;
    }

    // Items go to the party as text on the first survivor's sheet, which is where the
    // inventory already lives. Turning them into real DndItem objects needs the item
    // forms, and that is a bigger change than this one earns.
    if (loot.items.length > 0) {
        const holder = survivors[0];
        const found = loot.items.map(i => i.name).join(', ');
        holder.inventory = [String(holder.inventory || '').trim(), found]
            .filter(Boolean)
            .join(', ');
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
    return { gold: loot.gold, xp: loot.xp, items: loot.items };
}

// ================================================================
//  Campaign clock and bonds (wiki/ROADMAP.md, Fase D)
// ================================================================

/** Where the day and the bonds live: with the chat, like the party and the board. */
const CALENDAR_KEY = 'calendar';
const BONDS_KEY = 'bonds';

/** @returns {any} */
function getCampaignCalendar() {
    return normalizeCalendar(chat_metadata?.[CALENDAR_KEY]);
}

/** @returns {any} */
function getCampaignBonds() {
    return normalizeBondState(chat_metadata?.[BONDS_KEY]);
}

/**
 * @param {any} calendar
 * @param {any} bonds
 */
function saveCampaignState(calendar, bonds) {
    if (calendar) chat_metadata[CALENDAR_KEY] = calendar;
    if (bonds) chat_metadata[BONDS_KEY] = bonds;
    saveMetadata();
}

/**
 * Moves the campaign clock on by one slot, and a whole day when the night rolls over.
 *
 * Once-a-day perks come back with the new day. Doing it here rather than in the panel
 * means it happens however the day turns over, including from a long rest later on.
 */
function advanceCampaignSlot() {
    const { calendar, dayAdvanced } = advanceSlot(getCampaignCalendar());
    const bonds = dayAdvanced ? resetDailyPerks(getCampaignBonds()) : null;

    saveCampaignState(calendar, bonds);
    postCombatNarration(dayAdvanced
        ? `🌅 [CAMPAÑA] Amanece el día ${calendar.day}.`
        : `🕐 [CAMPAÑA] ${formatCalendar(calendar)}.`);
    renderCampaignTab();
}

/** Skips whatever is left of today. */
function advanceCampaignDay() {
    const calendar = advanceToNextDay(getCampaignCalendar());
    saveCampaignState(calendar, resetDailyPerks(getCampaignBonds()));
    postCombatNarration(`🌅 [CAMPAÑA] Amanece el día ${calendar.day}.`);
    renderCampaignTab();
}

/**
 * Records something that happened between the player and a companion.
 *
 * A rank-up is announced rather than applied quietly, because it is the moment the model
 * is supposed to write a scene about — from a fact the engine already decided.
 *
 * @param {string} characterId
 * @param {string} eventType
 */
function recordCampaignBondEvent(characterId, eventType) {
    const member = partyMembers.find(m => String(m.id) === String(characterId));
    if (!member) return;

    const result = recordBondEvent(getCampaignBonds(), String(characterId), eventType);
    saveCampaignState(null, result.state);

    const label = BOND_EVENTS[eventType]?.label ?? eventType;
    postCombatNarration(`💞 [CAMPAÑA] ${member.name}: ${label}.`);

    if (result.rankedUp) {
        postCombatNarration(`✨ [CAMPAÑA] Tu vínculo con ${member.name} sube al rango ${result.rankAfter}.`);
        for (const perk of result.unlockedPerks) {
            postCombatNarration(`🎖️ [CAMPAÑA] Desbloqueado: ${perk.label} — ${perk.description}`);
        }
    }

    renderCampaignTab();
}

/** Draws the campaign tab, if it is the one on screen. */
function renderCampaignTab() {
    const container = $('#campaign_panel_row');
    if (container.length === 0) return;

    renderCampaignPanel(container, {
        calendar: getCampaignCalendar(),
        bonds: getCampaignBonds(),
        party: partyMembers,
        onAdvanceSlot: advanceCampaignSlot,
        onAdvanceDay: advanceCampaignDay,
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
    const { ac: targetAc, cover } = getTargetArmorClass(target);
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
        `🔄 [COMBAT] ${actor.name} puede ceder ${remainingFeet} ft de movimiento. `
        + `Usa /relevo <nombre> (${names}).`,
    );
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
    member.mapPosition = member.mapPosition || { locationName: '', gridX: 0, gridY: 0 };
    member.mapPosition.gridX = gridX;
    member.mapPosition.gridY = gridY;
    if (locationName) member.mapPosition.locationName = locationName;
    savePartyState();
}

/**
 * @param {number} tokenId
 */
function handleCombatTokenClick(tokenId) {
    const entry = getCurrentTurnEntry();
    const member = getCurrentActingMember();
    if (!combatEncounter.active || !entry || entry.isEnemy || !member) return;

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

    member.mapPosition = {
        locationName: currentLocationName,
        gridX: targetX,
        gridY: targetY,
    };
    Object.assign(combatEncounter, spendMovement(combatEncounter, distanceFeet, Number(member.speed) || 30));
    savePartyState();
    saveCombatState();

    postCombatNarration(`🚶 [COMBAT] ${member.name} se mueve a (${targetX + 1}, ${targetY + 1}) y gasta ${distanceFeet} ft. Restante: ${getRemainingMovementFeet(member)} ft.`);
    renderLocationMapsPreview();
    return `${member.name} -> ${targetX + 1},${targetY + 1}`;
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
    const attackRoll = rollDiceDetailed('1d20', 20);
    const attackTotal = attackRoll.total + attackMod;
    const { ac: targetAc, cover: targetCover } = getTargetArmorClass(target);
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
    lines.push(`🎲 Tirada de ataque: d20(${attackRoll.total}) ${attackMod >= 0 ? '+' : ''}${attackMod} = ${attackTotal} vs AC ${targetAc}${describeCover(targetCover)}`);

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
        renderStage: () => renderLocationMapsPreview(),
        onAttack: (name) => handlePlayerCombatAttack(name),
        onEndTurn: () => endPlayerCombatTurn(),
        onFlee: () => {
            if (!combatEncounter.active) return;
            endCombat('manual');
            renderLocationMapsPreview();
        },
        onClose: () => setLocationMapsHidden(wasHidden),
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

    if (!chat_metadata || !chat_metadata[METADATA_KEY]) {
        toastr.warning('Abre una campana antes de entrar en el Modo Juego.');
        return '';
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

    contentRoot.append(leaveLocBtn, viewTabs, locationPanel, worldPanel);

    // Assign all party members without a location to the current location
    for (const m of partyMembers) {
        if (!m.mapPosition || !m.mapPosition.locationName) {
            m.mapPosition = m.mapPosition || { locationName: '', gridX: 0, gridY: 0 };
            m.mapPosition.locationName = currentLocationName;
        }
    }

    const tokens = /** @type {import('./world-map-renderer.js').TokenData[]} */ (buildTokens(currentLocationName));

    // ---- Board drill-down: if a board is selected, show it instead of the location ----
    const locBoards = getLocationBoards(loc);
    const selectedBoard = locBoards.find(/** @param {{ name: string }} b */ (b) => b.name === currentBoardName) || null;


    if (selectedBoard) {
        // Board selected — render board map with a "Back to location" button
        const backBtn = $(`<button class="menu_button wm-leave-loc-btn"><i class="fa-solid fa-arrow-left"></i> ${t`Back to`} ${escapeHtml(loc.name)}</button>`);
        backBtn.on('click', () => {
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
            onDoorToggle: (gx, gy, open) => {
                selectedBoard.terrain = setDoorOpen(normalizeTerrain(selectedBoard.terrain), gx, gy, open);
                persistBoardTerrain(selectedBoard);
                postCombatNarration(`🚪 [BOARD] La puerta de (${gx + 1}, ${gy + 1}) queda ${open ? 'abierta' : 'cerrada'}.`);
                renderLocationMapsPreview();
            },
            tokens: allBoardTokens,
            onTokenClick: (tokenId) => handleCombatTokenClick(tokenId),
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
                            const originX = member.mapPosition?.gridX || 0;
                            const originY = member.mapPosition?.gridY || 0;
                            const distanceFeet = getDistanceInFeet(originX, originY, gx, gy);
                            const remainingFeet = getRemainingMovementFeet(member);
                            if (distanceFeet > remainingFeet) {
                                toastr.warning(`Movimiento insuficiente. Necesitas ${distanceFeet} ft pero te quedan ${remainingFeet} ft.`);
                                renderLocationMapsPreview();
                                return;
                            }
                            getCurrentTurnState();
                            Object.assign(combatEncounter, spendMovement(combatEncounter, distanceFeet, Number(member.speed) || 30));
                            member.mapPosition = member.mapPosition || { locationName: '', gridX: 0, gridY: 0 };
                            member.mapPosition.gridX = gx;
                            member.mapPosition.gridY = gy;
                            saveCombatState();
                            renderLocationMapsPreview();
                            return;
                        }
                    }
                }
                handleTokenMove(tokenId, gx, gy, currentLocationName);
            },
        });

        // ---- Terrain editor (wiki/ROADMAP.md, Fase A6) ----
        if (terrainEditing) {
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

    const factionOptions = Array.from(new Set([...(dndCatalog.factions || []), ...(member.factions || [])].filter(Boolean))).sort((a, b) => a.localeCompare(b));
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

    // Level Up button
    const levelUpBtn = $(`<button class="dnd-level-up-btn" ${member.xp < member.xpNext ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i> Level Up</button>`);
    levelUpBtn.on('click', function () {
        if (member.xp < member.xpNext) return;
        member.xp -= member.xpNext;
        member.level++;
        member.xpNext = Math.round(member.xpNext * 1.5);

        // Refresh the whole tab
        const wasActive = panel.hasClass('active');
        const newPanel = buildProgressionTab(member, dndCatalog);
        panel.replaceWith(newPanel);
        if (wasActive) newPanel.addClass('active');
    });
    prog.append(levelUpBtn);

    function updateLevelUpButton() {
        levelUpBtn.prop('disabled', member.xp < member.xpNext);
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

        // Create party member from the WI entry
        const d = selected.dndData || {};
        const defaults = getDefaultDndData();
        const memberName = getPartyEntryDisplayName(selected);
        /** @type {PartyMember} */
        const newMember = {
            id: Date.now() + Math.floor(Math.random() * 10000),
            personaId: null,
            wiUid: selected.uid != null ? Number(selected.uid) : null,
            worldName: worldName,
            name: memberName,
            group: selected.group || '',
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

        partyMembers.push(newMember);
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
    eventSource.on(event_types.CHAT_CHANGED, () => {
        loadPartyForChat();
        // Cerrar la partida con el Modo Juego encendido dejaria una pantalla completa
        // sobre una aplicacion sin tablero que mostrar.
        if (isShellOpen() && !chat_metadata?.[METADATA_KEY]) closeGameShell();
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
        callback: (_args, value) => {
            const name = String(value).trim();
            const locs = getCurrentWorldLocationMaps();
            const match = locs.find(l => l.name.toLowerCase() === name.toLowerCase());
            if (!match) {
                toastr.warning(`Location "${name}" not found.`);
                return '';
            }
            currentLocationName = match.name;
            currentBoardName = '';
            saveCurrentLocation();
            saveCurrentBoard();
            setPartyTab('location');
            toastr.info(`📍 ${t`Traveled to`} ${match.name}`);
            return match.name;
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
            const loc = getCurrentWorldLocationMaps().find(l => l.name === currentLocationName);
            let boards = getLocationBoards(loc);
            let usedFallback = false;
            if (boards.length === 0) {
                const globalBoards = getCurrentWorldBoards();
                if (globalBoards.length > 0) {
                    console.log('[party] /enter fallback to global boards', { currentLocationName, globalBoards });
                    boards = globalBoards;
                    usedFallback = true;
                }
            }
            console.log('[party] /enter lookup', { loc, boards, usedFallback });
            const match = boards.find((/** @type {any} */ b) => b.name.toLowerCase() === name.toLowerCase());
            console.log('[party] /enter match', { match });
            if (!match) {
                toastr.warning(`Board "${name}" not found at ${currentLocationName}.`);
                return '';
            }
            currentBoardName = match.name;
            saveCurrentBoard();
            setPartyTab('location');
            toastr.info(`🎲 ${t`Entered`} ${match.name}`);
            if (usedFallback) {
                console.log('[party] /enter used legacy global boards fallback for', { currentLocationName, board: match.name });
            }
            return match.name;
        },
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
        callback: async () => {
            const worldName = String(chat_metadata?.[METADATA_KEY] || '');
            if (!worldName) {
                toastr.warning('Abre una campaña primero.');
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
        },
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
        helpString: '<div>Muestra los objetivos del escenario en curso, si este tablero tiene alguno.</div>',
        callback: () => {
            const verdict = judgeCurrentScenario();
            if (!verdict) {
                toastr.info('Este tablero no tiene objetivos: gana quien limpie el tablero.');
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
        callback: (_args, value) => {
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

            const wanted = String(value ?? '').trim().toLowerCase();
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
        },
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
    eventSource.on(event_types.MESSAGE_RECEIVED, (/** @type {number} */ messageId) => {
        try {
            applyRollGuard(messageId);
        } catch (error) {
            // A guard that breaks the chat is worse than a wrong die.
            console.error('[party] roll guard failed', error);
        }
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
