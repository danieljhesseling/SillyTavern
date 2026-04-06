import { t } from './i18n.js';
import { power_user } from './power-user.js';
import { POPUP_TYPE, POPUP_RESULT, Popup } from './popup.js';
import { sendSystemMessage, system_message_types } from './system-messages.js';
import { getThumbnailUrl, chat, chat_metadata, saveMetadata, eventSource, event_types, setUserName } from '../script.js';
import { getCurrentWorldMapUrl, getCurrentWorldLocationMaps, getCurrentWorldBoards, getCurrentWorldEnemies, loadWorldInfo, saveWorldInfo, METADATA_KEY } from './world-info.js';
import { renderWorldMapView, renderLocationView } from './world-map-renderer.js';
import { SlashCommandParser } from './slash-commands/SlashCommandParser.js';
import { SlashCommand } from './slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument } from './slash-commands/SlashCommandArgument.js';
import { SlashCommandEnumValue } from './slash-commands/SlashCommandEnumValue.js';
import {
    EQUIPMENT_SLOTS, SLOT_INFO, RELATIONSHIP_CATEGORIES, RELATIONSHIP_SCORE_MIN, RELATIONSHIP_SCORE_MAX, ITEM_TYPES, MODIFIABLE_STATS,
    ALIGNMENTS, CONDITIONS,
    generateItemId, generateMemoryId, getAbilityModifier, formatModifier,
    calculateCarryingCapacity, calculateTotalWeight, getDefaultDndData,
    applyEquipmentEffects, addItemToInventory, removeItemFromInventory,
    consumeItemInInventory,
    equipItem, unequipItem, getEquippedItem, getItemsByType,
    analyzeRelationshipsFromChat, migratePartyMember, createItem,
    ITEM_RECHARGE_OPTIONS, ITEM_CAPACITY_UNITS, ITEM_FOCUS_TYPES, ITEM_ARMOR_DEX_MODE_OPTIONS,
    ITEM_ARMOR_FLAG_DEFINITIONS, ITEM_ARMOR_RESISTANCE_OPTIONS,
    ITEM_GEAR_FLAG_DEFINITIONS, ITEM_LINKED_ABILITY_OPTIONS,
    ITEM_WEAPON_DAMAGE_TYPE_OPTIONS, ITEM_MAGIC_BONUS_OPTIONS, ITEM_WEAPON_FLAG_DEFINITIONS, ITEM_RARITY_OPTIONS,
    getItemCategoryOptions, getItemSubcategoryOptions, getSuggestedSlotForItem,
    buildItemMetaSummary, normalizeItem, getArmorDexRuleLabel, isArmorLikeItem, isRangedWeaponSubcategory, isMeleeWeaponSubcategory,
    getMagicSubtypeFlags,
    clampRelationshipScore,
    generateEnemyInstanceId,
} from './dnd-system.js';

/**
 * @typedef {Object} PartyMember
 * @property {number} id
 * @property {string|null} personaId
 * @property {number|null} [wiUid]
 * @property {string|null} [worldName]
 * @property {string} name
 * @property {string} avatar
 * @property {string} [group]
 * @property {number} level
 * @property {string} class
 * @property {number} hp
 * @property {number} maxHp
 * @property {number} xp
 * @property {number} xpNext
 * @property {number} gold
 * @property {number} silver
 * @property {number} copper
 * @property {string} inventory
 * @property {string} conditions
 * @property {string} alignment
 * @property {string} personality
 * @property {string[]} activeConditions
 * @property {number} strength
 * @property {number} dexterity
 * @property {number} constitution
 * @property {number} intelligence
 * @property {number} wisdom
 * @property {number} charisma
 * @property {number} armorClass
 * @property {number} speed
 * @property {import('./dnd-system.js').DndItem[]} items
 * @property {Object<string, string|null>} equippedItems
 * @property {import('./dnd-system.js').DndRelationship[]} relationships
 * @property {import('./dnd-system.js').DndMemory[]} memories
 * @property {import('./dnd-system.js').MapPosition} mapPosition
 */

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
    try {
        window.localStorage.setItem('sillytavern_partyMembers', JSON.stringify(partyMembers));
    } catch (e) {
        console.warn('Unable to save party state', e);
    }
    // Also persist to chat metadata for per-session party
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
    chat_metadata['party'] = JSON.parse(JSON.stringify(partyMembers));
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
 * Simple HTML escape for safe use in templates.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
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
            mapPosition: { locationName: '', gridX: 0, gridY: 0 },
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

function loadPartyState() {
    try {
        const raw = window.localStorage.getItem('sillytavern_partyMembers');
        if (!raw) return;

        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            partyMembers = parsed
                .filter((member) => member && member.id && member.name)
                .map((member) => migratePartyMember(member));
        }
    } catch (e) {
        console.warn('Unable to load party state', e);
    }
}

function renderPartyMembers() {
    const list = $('#rm_party_list');
    if (!list.length) return;

    list.empty();

    if (partyMembers.length === 0) {
        list.append(
            `<div class="flex-container alignitemscenter justifyCenter padding10"><small data-i18n="No party members.">No party members.</small></div>`
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
            </div>`
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

/** @type {import('./dnd-system.js').CombatEncounter & { turnState: null | { actorId: string, isEnemy: boolean, movementSpentFeet: number, actionUsed: boolean } }} */
let combatEncounter = { active: false, enemies: [], turnOrder: [], currentTurnIndex: 0, turnState: null };

function createEmptyCombatEncounter() {
    return { active: false, enemies: [], turnOrder: [], currentTurnIndex: 0, turnState: null };
}

/**
 * @param {any} encounter
 */
function normalizeCombatEncounter(encounter) {
    if (!encounter || typeof encounter !== 'object') return createEmptyCombatEncounter();
    return {
        active: Boolean(encounter.active),
        enemies: Array.isArray(encounter.enemies) ? encounter.enemies : [],
        turnOrder: Array.isArray(encounter.turnOrder) ? encounter.turnOrder : [],
        currentTurnIndex: Number.isInteger(encounter.currentTurnIndex) ? encounter.currentTurnIndex : 0,
        turnState: encounter.turnState && typeof encounter.turnState === 'object'
            ? {
                actorId: String(encounter.turnState.actorId || ''),
                isEnemy: Boolean(encounter.turnState.isEnemy),
                movementSpentFeet: Number(encounter.turnState.movementSpentFeet) || 0,
                actionUsed: Boolean(encounter.turnState.actionUsed),
            }
            : null,
    };
}

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
function setLocationMapsVisibility(hidden) {
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

    combatEncounter.turnState = {
        actorId: entry.id,
        isEnemy: entry.isEnemy,
        movementSpentFeet: 0,
        actionUsed: false,
    };
    saveCombatState();
    return combatEncounter.turnState;
}

/**
 * @param {import('./dnd-system.js').TurnEntry|null} entry
 */
function resetCombatTurnState(entry) {
    combatEncounter.turnState = entry
        ? { actorId: entry.id, isEnemy: entry.isEnemy, movementSpentFeet: 0, actionUsed: false }
        : null;
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
 * @param {number} ax
 * @param {number} ay
 * @param {number} bx
 * @param {number} by
 */
function getDistanceInCells(ax, ay, bx, by) {
    const safeAx = Number(ax);
    const safeAy = Number(ay);
    const safeBx = Number(bx);
    const safeBy = Number(by);
    const fromX = Number.isFinite(safeAx) ? safeAx : 0;
    const fromY = Number.isFinite(safeAy) ? safeAy : 0;
    const toX = Number.isFinite(safeBx) ? safeBx : 0;
    const toY = Number.isFinite(safeBy) ? safeBy : 0;
    return Math.max(Math.abs(fromX - toX), Math.abs(fromY - toY));
}

/**
 * @param {number} ax
 * @param {number} ay
 * @param {number} bx
 * @param {number} by
 */
function getDistanceInFeet(ax, ay, bx, by) {
    return getDistanceInCells(ax, ay, bx, by) * 5;
}

/**
 * @param {PartyMember|null} member
 */
function getRemainingMovementFeet(member) {
    if (!member) return 0;
    const turnState = getCurrentTurnState();
    const speed = Number(member?.speed) || 30;
    if (!turnState || turnState.actorId !== String(member.id)) return speed;
    return Math.max(0, speed - (Number(turnState.movementSpentFeet) || 0));
}

/**
 * @param {PartyMember|null} member
 */
function getAttackRangeFeet(member) {
    const equippedWeaponId = member?.equippedItems?.weapon;
    const equippedWeapon = equippedWeaponId ? (member.items || []).find(/** @param {import('./dnd-system.js').DndItem} item */ (item) => item.id === equippedWeaponId) : null;
    const weaponName = String(equippedWeapon?.name || '').toLowerCase();
    const className = String(member?.class || '').toLowerCase();

    if (/(bow|crossbow|sling|wand|staff|rifle|gun)/.test(weaponName)) return 60;
    if (/(ranger|wizard|sorcerer|warlock|cleric|druid|artificer)/.test(className)) return 60;
    return 5;
}

/**
 * @param {PartyMember|null} member
 * @param {number} rangeFeet
 */
function getPlayerAttackModifier(member, rangeFeet) {
    const strMod = getAbilityModifier(member?.strength || 10);
    const dexMod = getAbilityModifier(member?.dexterity || 10);
    return rangeFeet > 5 ? dexMod : Math.max(strMod, dexMod);
}

/**
 * @param {PartyMember|null} member
 * @param {number} rangeFeet
 */
function getPlayerDamageFormula(member, rangeFeet) {
    const level = Number(member?.level) || 1;
    if (rangeFeet > 5) return level >= 5 ? '1d10' : '1d8';
    if (level >= 9) return '2d8';
    if (level >= 5) return '1d10';
    return '1d8';
}

/**
 * @param {number} originX
 * @param {number} originY
 * @param {number} remainingFeet
 * @param {number} gridWidth
 * @param {number} gridHeight
 */
function buildReachableCells(originX, originY, remainingFeet, gridWidth, gridHeight) {
    const radius = Math.max(0, Math.floor(remainingFeet / 5));
    /** @type {{gridX:number,gridY:number,kind:'move'}[]} */
    const cells = [];
    for (let y = Math.max(0, originY - radius); y <= Math.min(gridHeight - 1, originY + radius); y++) {
        for (let x = Math.max(0, originX - radius); x <= Math.min(gridWidth - 1, originX + radius); x++) {
            if (getDistanceInCells(originX, originY, x, y) <= radius) {
                cells.push({ gridX: x, gridY: y, kind: 'move' });
            }
        }
    }
    return cells;
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
    const movementCells = buildReachableCells(pos.gridX || 0, pos.gridY || 0, remainingFeet, gridWidth, gridHeight);
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
function buildDragHighlightCells(tokenId, tentGX, tentGY, gridW, gridH) {
    if (!combatEncounter.active) return [];
    const member = partyMembers.find(m => m.id === tokenId);
    if (!member) return [];
    const originX = member.mapPosition?.gridX || 0;
    const originY = member.mapPosition?.gridY || 0;
    const distanceFeet = getDistanceInFeet(originX, originY, tentGX, tentGY);
    const remainingFromHere = Math.max(0, getRemainingMovementFeet(member) - distanceFeet);
    const moveCells = buildReachableCells(tentGX, tentGY, remainingFromHere, gridW, gridH);
    const rangeFeet = getAttackRangeFeet(member);
    /** @type {{gridX:number,gridY:number,kind:'attack'}[]} */
    const attackCells = getAliveEnemies()
        .filter(e => getDistanceInFeet(tentGX, tentGY, e.gridX || 0, e.gridY || 0) <= rangeFeet)
        .map(e => ({ gridX: e.gridX || 0, gridY: e.gridY || 0, kind: /** @type {'attack'} */ ('attack') }));
    return [...moveCells, ...attackCells];
}

/**
 * Send a compact combat narration line to chat.
 * @param {string} text
 */
function postCombatNarration(text) {
    if (typeof text !== 'string' || !text.trim()) return;
    sendSystemMessage(system_message_types.GENERIC, text.trim(), {
        isSmallSys: true,
        isNarrator: true,
    });
}

/**
 * Roll dice by formula with breakdown support.
 * @param {string} formula
 * @param {number} [fallbackSides=20]
 * @returns {{formula: string, rolls: number[], modifier: number, total: number, natural: number|null}}
 */
function rollDiceDetailed(formula, fallbackSides = 20) {
    const normalized = String(formula || '').trim() || `1d${fallbackSides}`;
    const match = normalized.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (!match) {
        const total = Math.floor(Math.random() * fallbackSides) + 1;
        return { formula: normalized, rolls: [total], modifier: 0, total, natural: total };
    }

    const count = Math.max(1, parseInt(match[1], 10) || 1);
    const sides = Math.max(2, parseInt(match[2], 10) || fallbackSides);
    const modifier = parseInt(match[3] || '0', 10) || 0;
    const rolls = [];
    for (let index = 0; index < count; index++) {
        rolls.push(Math.floor(Math.random() * sides) + 1);
    }

    return {
        formula: normalized,
        rolls,
        modifier,
        total: rolls.reduce((sum, value) => sum + value, 0) + modifier,
        natural: count === 1 && sides === 20 ? rolls[0] : null,
    };
}

/**
 * @param {string} formula
 * @param {number} [fallbackSides=20]
 */
function rollDice(formula, fallbackSides = 20) {
    return rollDiceDetailed(formula, fallbackSides).total;
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

/**
 * @param {number|null} natural
 * @param {number} total
 * @param {number|null} dc
 * @returns {'critical-success'|'success'|'failure'|'critical-failure'}
 */
function getRollClassification(natural, total, dc) {
    if (natural === 20) return 'critical-success';
    if (natural === 1) return 'critical-failure';
    if (dc == null) return 'success';
    return total >= dc ? 'success' : 'failure';
}

/**
 * @param {'critical-success'|'success'|'failure'|'critical-failure'} classification
 */
function getRollClassificationLabel(classification) {
    if (classification === 'critical-success') return 'Victoria critica';
    if (classification === 'critical-failure') return 'Fracaso critico';
    if (classification === 'failure') return 'Fracaso';
    return 'Victoria';
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
 * @param {number} cr
 * @returns {string}
 */
function getEnemyDamageFormula(cr) {
    if (cr <= 0.5) return '1d6';
    if (cr <= 2) return '1d8';
    if (cr <= 5) return '2d6';
    if (cr <= 10) return '2d8';
    return '3d8';
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

    const nearestTargetInfo = livingParty
        .map(member => {
            const memberX = Number.isFinite(Number(member.mapPosition?.gridX)) ? Number(member.mapPosition?.gridX) : 0;
            const memberY = Number.isFinite(Number(member.mapPosition?.gridY)) ? Number(member.mapPosition?.gridY) : 0;
            return {
                member,
                memberX,
                memberY,
                distanceFeet: getDistanceInFeet(enemyX, enemyY, memberX, memberY),
            };
        })
        .sort((a, b) => a.distanceFeet - b.distanceFeet)[0] || null;

    if (!nearestTargetInfo) {
        return `[COMBAT] ${enemy.name} no encuentra un objetivo valido.`;
    }

    const target = nearestTargetInfo.member;
    const targetX = nearestTargetInfo.memberX;
    const targetY = nearestTargetInfo.memberY;
    const meleeRangeFeet = 5;
    const initialDistanceFeet = nearestTargetInfo.distanceFeet;
    const lines = [];
    let movedThisTurn = false;

    if (initialDistanceFeet > meleeRangeFeet) {
        const enemySpeed = Number(enemy.speed);
        const movementBudgetFeet = Math.max(5, Number.isFinite(enemySpeed) ? enemySpeed : 30);
        const maxSteps = Math.max(1, Math.floor(movementBudgetFeet / 5));

        let nx = enemyX;
        let ny = enemyY;
        for (let step = 0; step < maxSteps; step++) {
            if (getDistanceInFeet(nx, ny, targetX, targetY) <= meleeRangeFeet) break;
            nx += Math.sign(targetX - nx);
            ny += Math.sign(targetY - ny);
        }

        enemy.gridX = nx;
        enemy.gridY = ny;
        movedThisTurn = nx !== enemyX || ny !== enemyY;
    }

    const finalEnemyX = Number.isFinite(Number(enemy.gridX)) ? Number(enemy.gridX) : 0;
    const finalEnemyY = Number.isFinite(Number(enemy.gridY)) ? Number(enemy.gridY) : 0;
    const distanceAfterMoveFeet = getDistanceInFeet(finalEnemyX, finalEnemyY, targetX, targetY);

    if (movedThisTurn) {
        lines.push(`🚶 ${enemy.name} avanza a (${finalEnemyX + 1}, ${finalEnemyY + 1}). Distancia: ${initialDistanceFeet} ft -> ${distanceAfterMoveFeet} ft.`);
    }

    if (distanceAfterMoveFeet > meleeRangeFeet) {
        lines.push(`⛔ ${enemy.name} no alcanza a ${target.name} y no puede atacar este turno.`);
        if (movedThisTurn) saveCombatState();
        return lines.join('\n');
    }

    const attackRoll = rollDiceDetailed('1d20', 20);
    const d20 = attackRoll.total;
    const attackMod = Math.max(
        getAbilityModifier(enemy.strength || 10),
        getAbilityModifier(enemy.dexterity || 10),
    );
    const attackTotal = d20 + attackMod;
    const targetAc = Number(target.armorClass) || 10;
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
    lines.push(`🎲 Tirada de ataque: d20(${d20}) ${attackMod >= 0 ? '+' : ''}${attackMod} = ${attackTotal} vs AC ${targetAc}`);

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

    target.hp = Math.max(0, (target.hp || 0) - totalDamage);
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
    const totalTurns = combatEncounter.turnOrder.length;
    for (let step = 0; step < totalTurns; step++) {
        combatEncounter.currentTurnIndex = (combatEncounter.currentTurnIndex + 1) % totalTurns;
        const candidate = combatEncounter.turnOrder[combatEncounter.currentTurnIndex] || null;
        if (canTurnEntryAct(candidate)) {
            resetCombatTurnState(candidate);
            return candidate;
        }
    }
    return null;
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
 * End the current combat encounter.
 */
function endCombat(reason = 'ended') {
    postCombatNarration('🏁 [COMBAT] El combate termina.');
    postCombatNarration(buildCombatSummary(/** @type {'victory'|'defeat'|'manual'|'ended'} */ (reason)));
    combatEncounter = createEmptyCombatEncounter();
    combatBoardSelection = { tokenId: null, boardName: '', locationName: '' };
    saveCombatState();
}

/**
 * Advance to the next turn in combat.
 * @returns {import('./dnd-system.js').TurnEntry|null} The new current turn entry
 */
function nextTurn() {
    const entry = advanceTurnIndex();
    saveCombatState();
    return entry;
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
        });
    });
    return result;
}

/**
 * Handle enemy token move on the board.
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
    turnState.movementSpentFeet += distanceFeet;
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

    if (turnState.actionUsed) {
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
    const targetAc = Number(target.armorClass) || 10;
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
    lines.push(`🎲 Tirada de ataque: d20(${attackRoll.total}) ${attackMod >= 0 ? '+' : ''}${attackMod} = ${attackTotal} vs AC ${targetAc}`);

    turnState.actionUsed = true;

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

    saveCombatState();
    postCombatNarration(lines.join('\n'));

    if (getAliveEnemies().length === 0) {
        postCombatNarration('🏆 [COMBAT] Todos los enemigos han sido derrotados.');
        endCombat('victory');
        renderLocationMapsPreview();
        return `${member.name} derrota a ${target.name}`;
    }

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

    // Turn order
    if (combatEncounter.turnOrder.length > 0) {
        let turnHtml = '<div class="wm-combat-turn-order"><div class="wm-combat-turn-title">' + t`Initiative Order` + '</div><ol>';
        combatEncounter.turnOrder.forEach((entry, idx) => {
            const isCurrent = idx === combatEncounter.currentTurnIndex;
            const enemyTag = entry.isEnemy ? ' <span class="wm-combat-enemy-tag">⚔️</span>' : '';
            turnHtml += `<li class="${isCurrent ? 'wm-combat-turn-current' : ''}">${escapeHtml(entry.name)}${enemyTag} <span class="wm-combat-init">(${entry.initiative})</span></li>`;
        });
        turnHtml += '</ol></div>';
        section.append(turnHtml);
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
                <div class="wm-combat-turn-help">${t`Action used`}: ${turnState.actionUsed ? t`yes` : t`no`} · ${t`Movement left`}: ${remainingFeet} ft · ${t`Attack range`}: ${rangeFeet} ft.</div>
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

function renderLocationMapsPreview() {
    const container = $('#world_location_maps_list');
    if (!container.length) return;

    container.empty();

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
        setLocationMapsVisibility(!locationMapsManuallyHidden);
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
        const allBoardTokens = [...boardTokens, ...enemyTokens];
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

        renderLocationView(boardPanel, {
            name: selectedBoard.name,
            imageUrl: selectedBoard.url,
            description: '',
            gridWidth: boardGridW,
            gridHeight: boardGridH,
            viewStateKey: `board::${currentLocationName}::${selectedBoard.name}`,
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
                            const turnState = getCurrentTurnState();
                            if (turnState) turnState.movementSpentFeet += distanceFeet;
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

    const popupContent = $(`<div class="dnd-modal"></div>`);

    // ---- Tab bar ----
    const tabs = ['Character Sheet', 'Inventory', 'Progression', 'Relationships', 'Memories'];
    const tabBar = $('<div class="dnd-tabs"></div>');
    for (const tabName of tabs) {
        const tabId = tabName.toLowerCase().replace(/\s+/g, '_');
        tabBar.append(`<div class="dnd-tab" data-tab="${tabId}">${tabName}</div>`);
    }
    popupContent.append(tabBar);

    // ---- Tab panels ----
    popupContent.append(buildCharacterSheetTab(member));
    popupContent.append(buildInventoryTab(member));
    popupContent.append(buildProgressionTab(member));
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
 * @returns {JQuery}
 */
function buildCharacterSheetTab(member) {
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
                <div class="dnd-sheet-class-level">Level ${member.level} ${member.class}</div>
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
            $(this).siblings('.dnd-stat-modifier').text(formatModifier(getAbilityModifier(val)));
        });

        statsGrid.append(box);
    }
    sheet.append(statsGrid);

    // Derived stats
    const eqEffects = applyEquipmentEffects(member);
    const derivedRow = $('<div class="dnd-derived-row"></div>');

    // AC
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
                <span class="dnd-ac-effective">${eqEffects.effectiveAC}</span>
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
        for (const [s, eqId] of Object.entries(member.equippedItems || {})) {
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
            ${item.image ? `<img class="dnd-item-img" src="${item.image}" />` : `<div class="dnd-item-img-placeholder"><i class="fa-solid fa-box"></i></div>`}
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
 * @param {any} value
 * @returns {string}
 */
function escItemText(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * @param {import('./dnd-system.js').DndItem | null | undefined} item
 * @param {keyof import('./dnd-system.js').DndItem} key
 * @returns {boolean}
 */
function getItemBooleanFlag(item, key) {
    return Boolean(item?.[key]);
}

/**
 * @param {import('./dnd-system.js').DndItem} item
 * @returns {string}
 */
function buildPartyArmorDexRuleNote(item) {
    return `<div class="dnd-item-form-note dnd-armor-dex-note">${escItemText(getArmorDexRuleLabel(item.subcategory || 'generic', item.armorDexMode || 'full'))}</div>`;
}

/**
 * @param {import('./dnd-system.js').DndItem} item
 * @returns {string}
 */
function buildPartyArmorResistanceChoices(item) {
    const resistanceTypes = Array.isArray(item.resistanceTypes) ? item.resistanceTypes : [];
    return `<div class="dnd-item-flag-grid">${ITEM_ARMOR_RESISTANCE_OPTIONS.map(value => `
        <label class="checkbox_label dnd-item-flag-toggle">
            <input type="checkbox" class="item-resistance" data-value="${escItemText(value)}" ${resistanceTypes.includes(value) ? 'checked' : ''} />
            <span>${escItemText(value)}</span>
        </label>
    `).join('')}</div>`;
}

/**
 * @param {string} title
 * @param {string} body
 * @returns {string}
 */
function buildPartyItemSection(title, body) {
    return `<div class="dnd-item-form-section"><div class="dnd-item-form-section-title">${title}</div>${body}</div>`;
}

/**
 * @param {string} content
 * @param {{ categories?: string[], subcategories?: string[] }} [options]
 * @returns {string}
 */
function buildPartyConditional(content, options = {}) {
    const { categories = /** @type {string[]} */ ([]), subcategories = /** @type {string[]} */ ([]) } = options;
    const categoryAttr = categories.length ? ` data-item-categories="${escItemText(categories.join(','))}"` : '';
    const subcategoryAttr = subcategories.length ? ` data-item-subcategories="${escItemText(subcategories.join(','))}"` : '';
    return `<div class="dnd-item-conditional"${categoryAttr}${subcategoryAttr}>${content}</div>`;
}

/**
 * @param {string} label
 * @param {string} fieldHtml
 * @returns {string}
 */
function buildPartyField(label, fieldHtml) {
    return `<div class="dnd-form-row"><label>${label}</label>${fieldHtml}</div>`;
}

/**
 * @param {import('./dnd-system.js').DndItem} item
 * @returns {string}
 */
function buildPartyItemSections(item) {
    return [
        buildPartyConditional(buildPartyItemSection('Combat', [
            buildPartyField('Damage Dice', `<input type="text" class="item-damage-dice" value="${escItemText(item.damageDice || item.baseDamage)}" placeholder="1d8" />`),
            buildPartyField('Damage Type', `<select class="item-damage-type">${ITEM_WEAPON_DAMAGE_TYPE_OPTIONS.map(([value, label]) => `<option value="${escItemText(value)}" ${value === (item.damageType || '') ? 'selected' : ''}>${escItemText(label)}</option>`).join('')}</select>`),
            buildPartyField('Magical Bonus', `<select class="item-magical-bonus">${ITEM_MAGIC_BONUS_OPTIONS.map(([value, label]) => `<option value="${escItemText(value)}" ${String(item.magicalBonus ?? 0) === String(value) ? 'selected' : ''}>${escItemText(label)}</option>`).join('')}</select>`),
            buildPartyConditional(buildPartyField('Melee Range', `<input type="number" class="item-melee-range" value="${item.meleeRange ?? 5}" min="5" step="5" />`), { subcategories: ['generic', 'simple_melee', 'martial_melee'] }),
            buildPartyConditional(buildPartyField('Normal Range', `<input type="number" class="item-range" value="${item.range ?? ''}" min="0" step="1" />`), { subcategories: ['simple_ranged', 'martial_ranged'] }),
            buildPartyConditional(buildPartyField('Long Range', `<input type="number" class="item-long-range" value="${item.longRange ?? ''}" min="0" step="1" />`), { subcategories: ['simple_ranged', 'martial_ranged'] }),
            buildPartyConditional(buildPartyField('Versatile Damage', `<input type="text" class="item-versatile-damage" value="${escItemText(item.versatileDamage)}" placeholder="1d10" />`), { subcategories: ['simple_melee', 'martial_melee'] }),
        ].join('')), { categories: ['weapon'] }),
        buildPartyConditional(buildPartyItemSection('Defense Stats', [
            buildPartyField('Base CA', `<input type="number" class="item-base-armor-class" value="${item.baseArmorClass ?? item.armorClass ?? ''}" min="0" step="1" />`),
            buildPartyField('Magical Bonus', `<select class="item-magical-bonus">${ITEM_MAGIC_BONUS_OPTIONS.map(([value, label]) => `<option value="${escItemText(value)}" ${String(item.magicalBonus ?? 0) === String(value) ? 'selected' : ''}>${escItemText(label)}</option>`).join('')}</select>`),
            buildPartyConditional(buildPartyField('Min Str', `<input type="number" class="item-strength-req" value="${item.strengthRequirement ?? ''}" min="0" max="20" step="1" />`), { subcategories: ['generic', 'heavy_armor'] }),
            buildPartyConditional(buildPartyField('Dexterity Mode', `<select class="item-armor-dex-mode">${ITEM_ARMOR_DEX_MODE_OPTIONS.map(([value, label]) => `<option value="${escItemText(value)}" ${value === (item.armorDexMode || 'full') ? 'selected' : ''}>${escItemText(label)}</option>`).join('')}</select>`), { subcategories: ['generic'] }),
            buildPartyArmorDexRuleNote(item),
            buildPartyField('Don Time', `<input type="text" class="item-don-time" value="${escItemText(item.donTime)}" placeholder="1 minute" />`),
            buildPartyField('Doff Time', `<input type="text" class="item-doff-time" value="${escItemText(item.doffTime)}" placeholder="1 minute" />`),
        ].join('')), { categories: ['armor'] }),
        buildPartyConditional(buildPartyItemSection('Flags', `
            <div class="dnd-item-flag-grid">
                ${ITEM_WEAPON_FLAG_DEFINITIONS.map(flag => buildPartyConditional(
                    `<label class="checkbox_label dnd-item-flag-toggle"><input type="checkbox" class="item-flag" data-flag="${flag.key}" ${getItemBooleanFlag(item, /** @type {keyof import('./dnd-system.js').DndItem} */ (flag.key)) ? 'checked' : ''} /><span>${escItemText(flag.label)}</span></label>`,
                    { subcategories: flag.subcategories },
                )).join('')}
                ${ITEM_ARMOR_FLAG_DEFINITIONS.map(flag => buildPartyConditional(
                    `<label class="checkbox_label dnd-item-flag-toggle"><input type="checkbox" class="item-flag" data-flag="${flag.key}" ${getItemBooleanFlag(item, /** @type {keyof import('./dnd-system.js').DndItem} */ (flag.key)) ? 'checked' : ''} /><span>${escItemText(flag.label)}</span></label>`,
                    { categories: ['armor'], subcategories: flag.subcategories },
                )).join('')}
                ${ITEM_GEAR_FLAG_DEFINITIONS.map(flag => buildPartyConditional(
                    `<label class="checkbox_label dnd-item-flag-toggle"><input type="checkbox" class="item-flag" data-flag="${flag.key}" ${getItemBooleanFlag(item, /** @type {keyof import('./dnd-system.js').DndItem} */ (flag.key)) ? 'checked' : ''} /><span>${escItemText(flag.label)}</span></label>`,
                    { categories: ['gear'], subcategories: flag.subcategories },
                )).join('')}
            </div>
            <div class="dnd-item-resistance-conditional">
                ${buildPartyField('Resistances', buildPartyArmorResistanceChoices(item))}
            </div>
        `), { categories: ['weapon', 'armor', 'gear'] }),
        buildPartyConditional(buildPartyItemSection('Utility', [
            buildPartyConditional(buildPartyField('Consumable', `<label class="checkbox_label"><input type="checkbox" class="item-consumable" ${item.consumable ? 'checked' : ''} /><span>Single-use or expendable</span></label>`), { categories: ['gear', 'magic'] }),
            buildPartyConditional(buildPartyField('Current Uses', `<input type="number" class="item-uses" value="${item.uses ?? ''}" min="0" step="1" />`), { subcategories: ['basic_consumable'] }),
            buildPartyConditional(buildPartyField('Max Uses', `<input type="number" class="item-max-uses" value="${item.maxUses ?? ''}" min="0" step="1" />`), { subcategories: ['basic_consumable'] }),
            buildPartyConditional(buildPartyField('Focus Type', `<select class="item-focus-type">${ITEM_FOCUS_TYPES.map(value => `<option value="${escItemText(value)}" ${value === (item.focusType || '') ? 'selected' : ''}>${escItemText(value || 'None')}</option>`).join('')}</select>`), { subcategories: ['magic_focus'] }),
            buildPartyConditional(buildPartyField('Tool Type', `<input type="text" class="item-tool-type" value="${escItemText(item.toolType)}" placeholder="Thieves' tools" />`), { subcategories: ['exploration_tool', 'artisan_tool'] }),
            buildPartyConditional(buildPartyField('Linked Ability', `<select class="item-linked-ability">${ITEM_LINKED_ABILITY_OPTIONS.map(([value, label]) => `<option value="${escItemText(value)}" ${String(item.linkedAbility || '') === value ? 'selected' : ''}>${escItemText(label)}</option>`).join('')}</select>`), { subcategories: ['artisan_tool'] }),
            buildPartyConditional(buildPartyField('Stack Size (items/slot)', `<input type="number" class="item-stack-size" value="${item.stackSize ?? ''}" min="1" step="1" />`), { subcategories: ['basic_consumable'] }),
            buildPartyConditional(buildPartyField('Stored In Container', `<input type="text" class="item-container-id" value="${escItemText(item.containerItemId || '')}" placeholder="Container item id (optional)" />`), { categories: ['gear', 'magic', 'mount_vehicle_trade'] }),
            buildPartyConditional(buildPartyField('Capacity', `<input type="number" class="item-capacity" value="${item.capacity ?? ''}" min="0" step="1" />`), { subcategories: ['container', 'mount', 'vehicle'] }),
            buildPartyConditional(buildPartyField('Capacity Unit', `<select class="item-capacity-unit">${ITEM_CAPACITY_UNITS.map(value => `<option value="${escItemText(value)}" ${value === (item.capacityUnit || '') ? 'selected' : ''}>${escItemText(value || 'None')}</option>`).join('')}</select>`), { subcategories: ['container', 'mount', 'vehicle'] }),
            buildPartyConditional(buildPartyField('Capacity Weight (lb)', `<input type="number" class="item-capacity-weight" value="${item.capacityWeight ?? ''}" min="0" step="1" />`), { subcategories: ['container'] }),
            buildPartyConditional(buildPartyField('Capacity Volume (ft³)', `<input type="number" class="item-capacity-volume" value="${item.capacityVolume ?? ''}" min="0" step="0.1" />`), { subcategories: ['container'] }),
            buildPartyConditional(buildPartyField('Emits Light', `<label class="checkbox_label"><input type="checkbox" class="item-emits-light" ${item.emitsLight ? 'checked' : ''} /><span>This tool emits light</span></label>`), { subcategories: ['exploration_tool'] }),
            buildPartyConditional(`<div class="dnd-item-light-fields">
                ${buildPartyField('Bright Light (ft)', `<input type="number" class="item-light-bright" value="${item.lightBright ?? ''}" min="0" step="5" />`)}
                ${buildPartyField('Dim Light (ft)', `<input type="number" class="item-light-dim" value="${item.lightDim ?? ''}" min="0" step="5" />`)}
            </div>`, { subcategories: ['exploration_tool'] }),
            buildPartyConditional(buildPartyField('Storage Weight (lb)', `<input type="number" class="item-storage-weight" value="${item.storageWeightLimit ?? ''}" min="0" step="1" />`), { categories: ['magic'] }),
            buildPartyConditional(buildPartyField('Storage Volume (ft³)', `<input type="number" class="item-storage-volume" value="${item.storageVolumeLimit ?? ''}" min="0" step="1" />`), { categories: ['magic'] }),
            buildPartyConditional(buildPartyField('Bright Light (ft)', `<input type="number" class="item-bright-light" value="${item.brightLightRadius ?? ''}" min="0" step="5" />`), { categories: ['magic'] }),
            buildPartyConditional(buildPartyField('Dim Light (ft)', `<input type="number" class="item-dim-light" value="${item.dimLightRadius ?? ''}" min="0" step="5" />`), { categories: ['magic'] }),
            buildPartyConditional(buildPartyField('Cost (gp)', `<input type="number" class="item-cost-gp" value="${item.costGp ?? ''}" min="0" step="1" />`), { categories: ['gear', 'magic', 'mount_vehicle_trade'] }),
        ].join('')), { categories: ['gear', 'magic', 'mount_vehicle_trade'] }),
        buildPartyConditional(buildPartyItemSection('Magic & Charges', [
            buildPartyField('Attunement', `<label class="checkbox_label"><input type="checkbox" class="item-attunement" ${item.attunement ? 'checked' : ''} /><span>Required</span></label>`),
            buildPartyField('Current Uses', `<input type="number" class="item-uses" value="${item.uses ?? ''}" min="0" step="1" />`),
            buildPartyField('Max Uses', `<input type="number" class="item-max-uses" value="${item.maxUses ?? ''}" min="0" step="1" />`),
            buildPartyField('Recharge', `<select class="item-recharge">${ITEM_RECHARGE_OPTIONS.map(value => `<option value="${escItemText(value)}" ${value === (item.recharge || '') ? 'selected' : ''}>${escItemText(value || 'None')}</option>`).join('')}</select>`),
            buildPartyField('Save DC', `<input type="number" class="item-save-dc" value="${item.saveDC ?? ''}" min="0" max="30" step="1" />`),
            buildPartyField('Spell Attack', `<input type="number" class="item-spell-attack" value="${item.spellAttackBonus ?? ''}" min="0" max="20" step="1" />`),
        ].join('')), { categories: ['gear'], subcategories: ['magic_focus'] }),
        buildPartyConditional(buildPartyItemSection('Magic', [
            buildPartyField('Rarity', `<select class="item-rarity">${ITEM_RARITY_OPTIONS.map(value => `<option value="${escItemText(value)}" ${value === (item.rarity || '') ? 'selected' : ''}>${escItemText(value || 'None')}</option>`).join('')}</select>`),
            buildPartyConditional(buildPartyField('Attunement', `<label class="checkbox_label"><input type="checkbox" class="item-attunement" ${item.attunement ? 'checked' : ''} /><span>Required</span></label>`), { subcategories: ['generic', 'magic_weapon_armor', 'ring_wand_staff', 'wondrous'] }),
            buildPartyField('Magical', `<label class="checkbox_label"><input type="checkbox" class="item-magical" ${item.magical ? 'checked' : ''} /><span>Counts as magical</span></label>`),
            buildPartyField('Cursed', `<label class="checkbox_label"><input type="checkbox" class="item-cursed" ${item.cursed ? 'checked' : ''} /><span>Yes</span></label>`),
            buildPartyConditional(buildPartyField('Current Uses', `<input type="number" class="item-uses" value="${item.uses ?? ''}" min="0" step="1" />`), { subcategories: ['generic', 'magic_weapon_armor', 'ring_wand_staff', 'wondrous'] }),
            buildPartyConditional(buildPartyField('Max Uses', `<input type="number" class="item-max-uses" value="${item.maxUses ?? ''}" min="0" step="1" />`), { subcategories: ['generic', 'magic_weapon_armor', 'ring_wand_staff', 'wondrous'] }),
            buildPartyConditional(buildPartyField('Recharge', `<select class="item-recharge">${ITEM_RECHARGE_OPTIONS.map(value => `<option value="${escItemText(value)}" ${value === (item.recharge || '') ? 'selected' : ''}>${escItemText(value || 'None')}</option>`).join('')}</select>`), { subcategories: ['generic', 'magic_weapon_armor', 'ring_wand_staff', 'wondrous'] }),
            buildPartyConditional(buildPartyField('Linked Spell', `<input type="text" class="item-linked-spell" value="${escItemText(item.linkedSpell || '')}" placeholder="Cure Wounds, Fireball..." />`), { subcategories: ['scroll'] }),
            buildPartyConditional(buildPartyField('Spell Level', `<input type="number" class="item-spell-level" value="${item.spellLevel ?? ''}" min="0" max="9" step="1" />`), { subcategories: ['scroll'] }),
            buildPartyConditional(buildPartyField('Save DC', `<input type="number" class="item-save-dc" value="${item.saveDC ?? ''}" min="0" max="30" step="1" />`), { subcategories: ['generic', 'ring_wand_staff', 'wondrous'] }),
            buildPartyConditional(buildPartyField('Spell Attack', `<input type="number" class="item-spell-attack" value="${item.spellAttackBonus ?? ''}" min="0" max="20" step="1" />`), { subcategories: ['generic', 'ring_wand_staff', 'wondrous'] }),
        ].join('')), { categories: ['magic'] }),
        buildPartyConditional(buildPartyItemSection('Transport & Trade', [
            buildPartyConditional(buildPartyField('Crew Required', `<input type="number" class="item-vehicle-crew" value="${item.vehicleCrew ?? ''}" min="0" step="1" />`), { subcategories: ['vehicle'] }),
            buildPartyConditional(buildPartyField('Damage Threshold', `<input type="number" class="item-vehicle-threshold" value="${item.vehicleDamageThreshold ?? ''}" min="0" step="1" />`), { subcategories: ['vehicle'] }),
        ].join('')), { categories: ['mount_vehicle_trade'] }),
    ].join('');
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
                    ${item.image ? `<img class="dnd-item-img" src="${item.image}" />` : `<div class="dnd-item-img-placeholder"><i class="fa-solid fa-box"></i></div>`}
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
 * @returns {JQuery}
 */
function buildProgressionTab(member) {
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
    const classEdit = $(`
        <div class="dnd-class-edit">
            <label style="font-size:0.8rem;color:var(--SmartThemeTextColor);">Class:</label>
            <input type="text" class="dnd-class-input" value="${member.class}" />
        </div>
    `);
    classEdit.find('input').on('change', function () {
        member.class = String($(this).val()) || 'Adventurer';
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
        const pct = member.maxHp > 0 ? Math.min(100, (member.hp / member.maxHp) * 100) : 0;
        prog.find('.dnd-hp-bar-fill').css('width', pct + '%');
        prog.find('.dnd-hp-bar-text').text(`${member.hp} / ${member.maxHp}`);
    });

    prog.find('.hp-max-input').on('change', function () {
        member.maxHp = parseInt(String($(this).val()), 10) || 1;
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
        const parent = panel.parent();
        const wasActive = panel.hasClass('active');
        const newPanel = buildProgressionTab(member);
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
                r.characterName.toLowerCase() === sug.characterName.toLowerCase()
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
            if (!group.includes('character')) continue;
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
            mapPosition: { locationName: '', gridX: 0, gridY: 0 },
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
     * @param {'party'|'world_map'|'location'|'board'} tab
     */
    function setPartyTab(tab) {
        const worldMapRow = $('#world_map_row');
        const locationRow = $('#world_location_maps_row');
        const partyList = $('#rm_party_list');
        const partyFixedTop = $('#partyListFixedTop');

        // Remap legacy 'board' tab to 'location'
        const normalizedTab = /** @type {'party'|'world_map'|'location'} */ (tab === 'board' ? 'location' : tab);

        $('.right_menu_tab').removeClass('active');
        $(`#rm_tab_${normalizedTab}`).addClass('active');

        // show party pane and hidden others per tab
        partyList.toggleClass('tab-panel-hidden', normalizedTab !== 'party');
        partyFixedTop.toggleClass('tab-panel-hidden', normalizedTab !== 'party');
        worldMapRow.toggleClass('tab-panel-hidden', normalizedTab !== 'world_map');
        locationRow.toggleClass('tab-panel-hidden', normalizedTab !== 'location');

        if (normalizedTab === 'party') {
            renderPartyMembers();
        } else if (normalizedTab === 'world_map') {
            renderWorldMapPreview();
        } else if (normalizedTab === 'location') {
            renderLocationMapsPreview();
        }

        try {
            window.localStorage.setItem('rm_PinAndTabs_selectedTab', normalizedTab);
        } catch (e) {
            console.warn('Unable to store selected tab', e);
        }
    }

    $('#rm_tab_party').on('click', () => setPartyTab('party'));
    $('#rm_tab_world_map').on('click', () => setPartyTab('world_map'));
    $('#rm_tab_location').on('click', () => setPartyTab('location'));

    $(document).on('click', '.party-remove-member', null, () => {
        // handled by individual buttons
    });

    loadPartyState();
    renderPartyMembers();
    renderWorldMapPreview();
    renderLocationMapsPreview();

    // Restore per-session party when chat changes
    eventSource.on(event_types.CHAT_CHANGED, () => {
        loadPartyForChat();
    });

    /** @type {'party'|'world_map'|'location'} */
    const initiallySelected = /** @type {'party'|'world_map'|'location'} */ (window.localStorage.getItem('rm_PinAndTabs_selectedTab') || 'party');
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
                toastr.warning(`Choose a location first (/go).`);
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
                toastr.warning(`Enemy template not found in world enemy pool.`);
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
        helpString: '<div>End the current player turn and advance combat.</div>',
        callback: () => endPlayerCombatTurn(),
    }));

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
