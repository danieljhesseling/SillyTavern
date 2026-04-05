import { t } from './i18n.js';
import { power_user } from './power-user.js';
import { POPUP_TYPE, POPUP_RESULT, Popup } from './popup.js';
import { getThumbnailUrl, chat, chat_metadata, saveMetadata, eventSource, event_types, setUserName } from '../script.js';
import { getCurrentWorldMapUrl, getCurrentWorldLocationMaps, getCurrentWorldBoards, loadWorldInfo, saveWorldInfo, METADATA_KEY } from './world-info.js';
import { renderWorldMapView, renderLocationView } from './world-map-renderer.js';
import { SlashCommandParser } from './slash-commands/SlashCommandParser.js';
import { SlashCommand } from './slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument } from './slash-commands/SlashCommandArgument.js';
import { SlashCommandEnumValue } from './slash-commands/SlashCommandEnumValue.js';
import {
    EQUIPMENT_SLOTS, SLOT_INFO, RELATIONSHIP_TYPES, ITEM_TYPES, MODIFIABLE_STATS,
    ALIGNMENTS, CONDITIONS,
    generateItemId, generateMemoryId, getAbilityModifier, formatModifier,
    calculateCarryingCapacity, calculateTotalWeight, getDefaultDndData,
    applyEquipmentEffects, addItemToInventory, removeItemFromInventory,
    equipItem, unequipItem, getEquippedItem, getItemsByType,
    analyzeRelationshipsFromChat, migratePartyMember, createItem,
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

    const popup = new Popup(content, POPUP_TYPE.CONFIRM, null, {
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
        const data = await loadWorldInfo(member.worldName);
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

/** Helper: resolve boards for a location, including legacy boardName fallback */
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

function renderLocationMapsPreview() {
    const container = $('#world_location_maps_list');
    if (!container.length) return;

    const locationMaps = getCurrentWorldLocationMaps();
    if (!locationMaps || locationMaps.length === 0) {
        container.html(`<div class="wm-empty-state">${t`No location maps available.`}</div>`);
        return;
    }

    // Find the current location
    let loc = locationMaps.find(l => l.name === currentLocationName);
    const resolvedBoards = getLocationBoards(loc);
    console.log('[party] renderLocationMapsPreview', { currentLocationName, currentBoardName, locName: loc?.name, locBoardsLength: resolvedBoards.length, resolvedBoards });

    // No location selected yet — show a chooser
    if (!loc) {
        container.empty();
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
        container.html(`
            <div class="wm-loc-chooser">
                <div class="wm-loc-chooser-title"><i class="fa-solid fa-compass"></i> ${t`Where are you?`}</div>
                <div class="wm-loc-choose-grid">${cards}</div>
            </div>
        `);
        container.find('.wm-loc-choose-card').on('click', function () {
            currentLocationName = String($(this).data('loc'));
            currentBoardName = '';
            saveCurrentLocation();
            saveCurrentBoard();
            renderLocationMapsPreview();
        });
        return;
    }

    // Build view tabs (Location Name ↔ World)
    container.empty();
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
        container.find('.wm-view-panel').removeClass('active');
        container.find(`.wm-view-panel[data-view="${view}"]`).addClass('active');

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

    container.append(leaveLocBtn, viewTabs, locationPanel, worldPanel);

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
    const selectedBoard = locBoards.find(b => b.name === currentBoardName) || null;


    if (selectedBoard) {
        // Board selected — render board map with a "Back to location" button
        const backBtn = $(`<button class="menu_button wm-leave-loc-btn"><i class="fa-solid fa-arrow-left"></i> ${t`Back to`} ${escapeHtml(loc.name)}</button>`);
        backBtn.on('click', () => {
            currentBoardName = '';
            saveCurrentBoard();
            renderLocationMapsPreview();
        });
        const boardPanel = $('<div data-map-root></div>');
        container.append(backBtn, boardPanel);

        const boardTokens = /** @type {import('./world-map-renderer.js').TokenData[]} */ (buildTokens(currentLocationName));
        renderLocationView(boardPanel, {
            name: selectedBoard.name,
            imageUrl: selectedBoard.url,
            description: '',
            gridWidth: loc.gridWidth || 50,
            gridHeight: loc.gridHeight || 50,
            tokens: boardTokens,
            onTokenMove: (tokenId, gx, gy) => handleTokenMove(tokenId, gx, gy, currentLocationName),
        });
        return;
    }

    // ---- Location view (no board selected) ----
    renderLocationView(locationPanel, {
        name: loc.name,
        imageUrl: loc.url,
        description: loc.description || '',
        gridWidth: loc.gridWidth || 50,
        gridHeight: loc.gridHeight || 50,
        tokens,
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
            saveCurrentBoard();
            renderLocationMapsPreview();
        });
        container.append(boardsSection);
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
        const file = this.files?.[0];
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
        // @ts-ignore
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
        let items = filter === 'all' ? [...(member.items || [])] : getItemsByType(member, /** @type {'weapon'|'armor'|'gear'} */ (filter));
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
            const effectsText = (item.effects || []).map(e => `${e.stat} ${e.modifier >= 0 ? '+' : ''}${e.modifier}`).join(', ');
            const card = $(`
                <div class="dnd-item-card ${isEquipped ? 'equipped' : ''}" data-item-id="${item.id}">
                    ${item.image ? `<img class="dnd-item-img" src="${item.image}" />` : `<div class="dnd-item-img-placeholder"><i class="fa-solid fa-box"></i></div>`}
                    <div class="dnd-item-info">
                        <div class="dnd-item-name">${item.name}${isEquipped ? ' <span style="color:#2dd4bf;font-size:0.7rem;">(equipped)</span>' : ''}</div>
                        <div class="dnd-item-meta">${item.type}${item.slot ? ' · ' + item.slot : ''} · ${item.weight} lbs${effectsText ? ' · ' + effectsText : ''}</div>
                    </div>
                    <div class="dnd-item-actions">
                        ${isEquipped
                            ? '<button class="dnd-item-action-btn unequip-btn" title="Unequip"><i class="fa-solid fa-arrow-down"></i></button>'
                            : (item.slot ? '<button class="dnd-item-action-btn equip-btn" title="Equip"><i class="fa-solid fa-arrow-up"></i></button>' : '')}
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
    const form = $(`
        <div class="dnd-add-item-form" style="min-width:380px;">
            <div class="dnd-form-row"><label>Name</label><input type="text" class="item-name" value="" /></div>
            <div class="dnd-form-row">
                <label>Type</label>
                <select class="item-type">
                    <option value="weapon">Weapon</option>
                    <option value="armor">Armor</option>
                    <option value="gear" selected>Gear</option>
                </select>
            </div>
            <div class="dnd-form-row">
                <label>Slot</label>
                <select class="item-slot">
                    <option value="">None (unequippable)</option>
                    ${Object.entries(SLOT_INFO).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}
                </select>
            </div>
            <div class="dnd-form-row"><label>Image URL</label><input type="text" class="item-image" placeholder="Optional image URL" /></div>
            <div class="dnd-form-row"><label>Weight</label><input type="number" class="item-weight" value="0" min="0" step="0.1" /></div>
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

    const newItem = createItem({
        name: form.find('.item-name').val()?.toString().trim() || 'New Item',
        type: /** @type {'weapon'|'armor'|'gear'} */ (form.find('.item-type').val()),
        slot: String(form.find('.item-slot').val() || '') || null,
        image: form.find('.item-image').val()?.toString().trim() || '',
        weight: parseFloat(String(form.find('.item-weight').val())) || 0,
        description: form.find('.item-desc').val()?.toString().trim() || '',
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
            const card = $(`
                <div class="dnd-relationship-card">
                    <div class="dnd-rel-avatar" style="display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-user" style="font-size:1.2rem;"></i></div>
                    <div class="dnd-rel-info">
                        <div class="dnd-rel-name">${rel.characterName}</div>
                        <div class="dnd-rel-desc">${rel.description || 'No description'}</div>
                    </div>
                    <span class="dnd-rel-type-badge ${rel.type}">${rel.type}</span>
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
            // @ts-ignore
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
            // @ts-ignore
            toastr.success(`Found ${added} new relationship(s) from chat.`);
            renderRelationships();
        } else {
            // @ts-ignore
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
    const rel = isNew ? { characterName: '', characterAvatar: '', type: 'neutral', description: '', lastInteraction: '' } : member.relationships[index];

    const form = $(`
        <div class="dnd-add-item-form" style="min-width:350px;">
            <div class="dnd-form-row"><label>Name</label><input type="text" class="rel-name" value="${rel.characterName}" /></div>
            <div class="dnd-form-row">
                <label>Type</label>
                <select class="rel-type">
                    ${RELATIONSHIP_TYPES.map(t => `<option value="${t}" ${rel.type === t ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
            </div>
            <div class="dnd-form-row"><label>Description</label><textarea class="rel-desc">${rel.description || ''}</textarea></div>
        </div>
    `);

    const popup = new Popup(form, POPUP_TYPE.CONFIRM, '', {
        okButton: isNew ? t`Add` : t`Save`,
        cancelButton: t`Cancel`,
    });

    const result = await popup.show();
    if (result !== 1) return;

    const updated = {
        characterName: form.find('.rel-name').val()?.toString().trim() || 'Unknown',
        characterAvatar: rel.characterAvatar || '',
        type: /** @type {import('./dnd-system.js').DndRelationship['type']} */ (form.find('.rel-type').val()) || 'neutral',
        description: form.find('.rel-desc').val()?.toString().trim() || '',
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

    $('#party_add_button').off('click').on('click', async () => {
        const worldName = chat_metadata ? chat_metadata[METADATA_KEY] : null;
        if (!worldName) {
            // @ts-ignore
            toastr.warning(t`No world info bound to this chat. Start a campaign first.`);
            return;
        }

        const data = await loadWorldInfo(worldName);
        if (!data?.entries) {
            // @ts-ignore
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
            // @ts-ignore
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
     * @param {'party'|'world_map'|'location'} tab
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
            return locBoards.map(b => new SlashCommandEnumValue(b.name));
        }
        if (globalBoards.length > 0) {
            console.log('[party] boardEnumProvider fallback to global boards', { globalBoards });
            return globalBoards.map(b => new SlashCommandEnumValue(b.name));
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
            const match = boards.find(b => b.name.toLowerCase() === name.toLowerCase());
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
    //  Auto-detect location / board names in user messages
    // ================================================================

    eventSource.on(event_types.USER_MESSAGE_RENDERED, (messageId) => {
        const message = chat[messageId];
        if (!message || !message.mes) return;
        const text = message.mes.toLowerCase();

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
