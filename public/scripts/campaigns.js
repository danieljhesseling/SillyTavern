import {
    world_names, loadWorldInfo, saveWorldInfo, createNewWorldInfo, createWorldInfoEntry, METADATA_KEY,
} from './world-info.js';
import {
    characters, getRequestHeaders, openCharacterChat, chat_metadata, saveMetadata, selectCharacterById,
    doNewChat, this_chid, generateRaw, online_status,
} from '../script.js';
import { Popup, POPUP_TYPE, POPUP_RESULT } from './popup.js';
import { buildNewCampaignCta, askWizard, createCampaign } from './game-engine/ui/campaign-wizard.js';
import { openCampaignBuilder } from './party.js';
import { isCampaignWorld, getStartingPoint } from './game-engine/campaign/campaign-worlds.js';
import { generateWorld } from './game-engine/world-builder/world-schema.js';
import { escapeHtml } from './utils.js';

/**
 * Fetches recent chats with metadata from the cross-character API.
 * @param {number} [max=50]
 * @returns {Promise<Array>}
 */
async function fetchRecentChatsWithMetadata(max = 50) {
    const response = await fetch('/api/chats/recent', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ max, metadata: true }),
        cache: 'no-cache',
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
}

/**
 * Renders campaign cards (world-bound chats) into the given container.
 * Used on the welcome panel.
 * @param {HTMLElement} container
 */
export async function renderCampaignCards(container) {
    container.innerHTML = '<div class="campaigns-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading campaigns...</div>';

    const allChats = await fetchRecentChatsWithMetadata(100);

    // Group chats by world
    /** @type {Map<string, Array>} */
    const chatsByWorld = new Map();
    for (const chat of allChats) {
        const worldName = chat.chat_metadata?.world_info;
        if (worldName) {
            if (!chatsByWorld.has(worldName)) chatsByWorld.set(worldName, []);
            chatsByWorld.get(worldName).push(chat);
        }
    }

    // Build world data for worlds that have chats
    /** @type {Array<{name: string, displayName: string, coverImage: string, genre: string, chats: any[], unstarted?: boolean}>} */
    const worlds = [];
    for (const [worldName, chats] of chatsByWorld) {
        let meta = {};
        try {
            const data = await loadWorldInfo(worldName);
            meta = data?.metadata ?? {};
        } catch { /* world may have been deleted */ }
        worlds.push({
            name: worldName,
            displayName: meta.displayName || worldName,
            coverImage: meta.coverImage || '',
            genre: meta.genre || '',
            chats: chats.sort((a, b) => (b.last_mes || 0) - (a.last_mes || 0)),
        });
    }

    // Worlds built to be played that no chat points at yet. World Info lists every world and
    // this list only knew about the ones with a chat, so a world could exist in one place and
    // be invisible in the other, with no way to start it. They sort last, having no activity.
    const startedNames = new Set(worlds.map(w => w.name));
    const unstarted = await Promise.all(
        (Array.isArray(world_names) ? world_names : [])
            .filter(name => !startedNames.has(name))
            .map(async (name) => {
                try {
                    const data = await loadWorldInfo(name);
                    const meta = data?.metadata ?? {};
                    return isCampaignWorld(meta) ? { name, meta } : null;
                } catch {
                    return null; // deleted or unreadable: nothing to offer
                }
            }),
    );
    for (const item of unstarted) {
        if (!item) continue;
        worlds.push({
            name: item.name,
            displayName: item.meta.displayName || item.name,
            coverImage: item.meta.coverImage || '',
            genre: item.meta.genre || '',
            chats: [],
            unstarted: true,
        });
    }

    // Sort by most-recent chat activity
    worlds.sort((a, b) => {
        const aTime = a.chats[0]?.last_mes || 0;
        const bTime = b.chats[0]?.last_mes || 0;
        return bTime - aTime;
    });

    if (worlds.length === 0) {
        // The old empty state was an instruction disguised as a placeholder: it told you to
        // "start a new chat and pick a world", which silently did nothing when no world
        // existed yet. Now it offers the thing it was describing.
        container.innerHTML = buildNewCampaignCta(false);
        return;
    }

    let html = buildNewCampaignCta(true);
    for (const world of worlds) {
        const coverStyle = world.coverImage
            ? `background-image: url('${world.coverImage.replace(/'/g, '\\\'')}'); background-size: cover; background-position: center;`
            : '';
        const genreBadge = world.genre
            ? `<span class="campaign-genre">${escapeHtml(world.genre)}</span>`
            : '';

        if (world.unstarted) {
            html += `
        <div class="campaign-card campaign-card-unstarted" data-world="${escapeHtml(world.name)}">
            <div class="campaign-cover" style="${coverStyle}">
                ${!world.coverImage ? '<i class="fa-solid fa-map fa-3x campaign-cover-placeholder"></i>' : ''}
                ${genreBadge}
            </div>
            <div class="campaign-info">
                <div class="campaign-title">${escapeHtml(world.displayName)}</div>
                <div class="campaign-meta"><span class="campaign-sessions">Sin sesiones todavía</span></div>
            </div>
            <div class="campaign-actions">
                <button class="campaign-start menu_button" data-world="${escapeHtml(world.name)}">
                    <i class="fa-solid fa-play"></i> Iniciar
                </button>
            </div>
        </div>`;
            continue;
        }

        const chatCount = world.chats.length;
        const chatLabel = chatCount === 1 ? '1 session' : `${chatCount} sessions`;
        const lastChat = world.chats[0];
        const charName = lastChat?.char_name || '';
        const lastChatName = (lastChat?.file_name || '').replace('.jsonl', '');

        html += `
        <div class="campaign-card" data-world="${escapeHtml(world.name)}">
            <div class="campaign-cover" style="${coverStyle}">
                ${!world.coverImage ? '<i class="fa-solid fa-map fa-3x campaign-cover-placeholder"></i>' : ''}
                ${genreBadge}
            </div>
            <div class="campaign-info">
                <div class="campaign-title">${escapeHtml(world.displayName)}</div>
                <div class="campaign-meta">
                    <span class="campaign-sessions">${chatLabel}</span>
                    ${charName ? `<span class="campaign-char">${escapeHtml(charName)}</span>` : ''}
                </div>
                <div class="campaign-session-name" title="${escapeHtml(lastChatName)}">${escapeHtml(lastChatName)}</div>
            </div>
            <div class="campaign-actions">
                <button class="campaign-continue menu_button" data-avatar="${escapeHtml(lastChat?.avatar || '')}" data-chat="${escapeHtml(lastChat?.file_name || '')}">
                    <i class="fa-solid fa-play"></i> Continue
                </button>
                <button class="campaign-view-all menu_button" data-world="${escapeHtml(world.name)}">
                    <i class="fa-solid fa-list"></i> Sessions
                </button>
            </div>
        </div>`;
    }

    container.innerHTML = html;
}

// ---- Category constants for world preview ----
const PREVIEW_CATEGORIES = [
    'Characters', 'Locations', 'Monsters', 'Items',
    'Spells', 'Races', 'Classes', 'Factions', 'Boards',
];

const PREVIEW_CATEGORY_ICONS = {
    'Characters': 'fa-user', 'Locations': 'fa-location-dot', 'Monsters': 'fa-dragon',
    'Items': 'fa-gem', 'Spells': 'fa-wand-sparkles', 'Races': 'fa-people-group',
    'Classes': 'fa-shield-halved', 'Factions': 'fa-flag', 'Boards': 'fa-chess-board',
};

/**
 * Categorize an entry by its group field.
 * @param {any} entry
 * @returns {string}
 */
function categorizeEntry(entry) {
    const group = (entry.group || '').trim().toLowerCase();
    if (!group) return '';
    for (const cat of PREVIEW_CATEGORIES) {
        const catLower = cat.toLowerCase();
        const singular = catLower.endsWith('es') ? catLower.slice(0, -2) : catLower.endsWith('s') ? catLower.slice(0, -1) : catLower;
        if (group === catLower || group === singular || group.includes(catLower) || group.includes(singular)) {
            return cat;
        }
    }
    return '';
}

/**
 * Shows a world preview popup with tabbed content.
 * @param {string} worldName
 * @param {object} worldMeta - Pre-loaded metadata {displayName, coverImage, genre}
 * @returns {Promise<boolean>} true if user confirms "Start Campaign"
 */
async function showWorldPreviewPopup(worldName, worldMeta) {
    const data = await loadWorldInfo(worldName);
    const fullMeta = data?.metadata || {};
    const meta = { ...fullMeta, ...(worldMeta || {}) };
    const displayName = meta.displayName || worldName;
    const coverImage = meta.coverImage || '';
    const genre = meta.genre || '';
    const worldDescription = meta.description || '';
    const locationMaps = Array.isArray(meta.locationMaps) ? meta.locationMaps : [];
    // Collect boards from locations (per-location model), fallback to top-level meta.boards
    const locBoards = [];
    for (const loc of locationMaps) {
        for (const b of (loc.boards || [])) {
            if (!locBoards.some(x => x.name === b.name)) locBoards.push(b);
        }
    }
    const boards = locBoards.length ? locBoards : (Array.isArray(meta.boards) ? meta.boards : []);
    const worldMapUrl = meta.worldMapUrl || meta.mapUrl || '';

    // Group entries by category
    /** @type {Map<string, Array<{title: string, image: string, desc: string}>>} */
    const categorized = new Map();
    if (data?.entries) {
        for (const uid of Object.keys(data.entries)) {
            const entry = data.entries[uid];
            const cat = categorizeEntry(entry);
            if (!cat) continue;
            if (!categorized.has(cat)) categorized.set(cat, []);
            const title = entry.comment || (Array.isArray(entry.key) ? entry.key.join(', ') : entry.key || `Entry ${entry.uid}`);
            const image = entry.dndData?.image || '';
            categorized.get(cat).push({ title, image, desc: '' });
        }
    }

    // Only keep categories with entries
    const activeCats = PREVIEW_CATEGORIES.filter(c => categorized.has(c) && categorized.get(c).length > 0);

    // Build header (title + genre only, no description)
    const coverStyle = coverImage
        ? `background-image: url('${coverImage.replace(/'/g, '\\\'')}'); background-size: cover; background-position: center;`
        : '';
    const headerHtml = `
    <div class="wp-header" style="${coverStyle}">
        <div class="wp-header-overlay">
            <div class="wp-header-title">${escapeHtml(displayName)}</div>
            ${genre ? `<span class="wp-header-genre">${escapeHtml(genre)}</span>` : ''}
        </div>
    </div>`;

    // ---- Build Lore panel content ----
    let loreSections = '';

    // Description
    if (worldDescription) {
        loreSections += `
        <div class="wp-lore-section">
            <div class="wp-lore-section-title"><i class="fa-solid fa-scroll"></i> Description</div>
            <div class="wp-lore-desc">${escapeHtml(worldDescription)}</div>
        </div>`;
    }

    // World Map
    if (worldMapUrl) {
        loreSections += `
        <div class="wp-lore-section">
            <div class="wp-lore-section-title"><i class="fa-solid fa-map"></i> World Map</div>
            <div class="wp-lore-map"><img src="${escapeHtml(worldMapUrl)}" alt="World Map" /></div>
        </div>`;
    }

    // Locations from metadata
    if (locationMaps.length > 0) {
        let locCards = '';
        for (const loc of locationMaps) {
            const imgHtml = loc.url
                ? `<img src="${escapeHtml(loc.url)}" alt="" />`
                : '<i class="fa-solid fa-location-dot fa-2x"></i>';
            locCards += `
            <div class="wp-entry-card">
                <div class="wp-entry-img">${imgHtml}</div>
                <div class="wp-entry-name">${escapeHtml(loc.name || 'Unnamed')}</div>
                ${loc.description ? `<div class="wp-entry-desc">${escapeHtml(loc.description)}</div>` : ''}
            </div>`;
        }
        loreSections += `
        <div class="wp-lore-section">
            <div class="wp-lore-section-title"><i class="fa-solid fa-location-dot"></i> Locations</div>
            <div class="wp-entry-grid">${locCards}</div>
        </div>`;
    }

    // Boards from metadata
    if (boards.length > 0) {
        let boardCards = '';
        for (const board of boards) {
            const imgHtml = board.url
                ? `<img src="${escapeHtml(board.url)}" alt="" />`
                : '<i class="fa-solid fa-chess-board fa-2x"></i>';
            boardCards += `
            <div class="wp-entry-card">
                <div class="wp-entry-img">${imgHtml}</div>
                <div class="wp-entry-name">${escapeHtml(board.name || 'Unnamed')}</div>
            </div>`;
        }
        loreSections += `
        <div class="wp-lore-section">
            <div class="wp-lore-section-title"><i class="fa-solid fa-chess-board"></i> Boards</div>
            <div class="wp-entry-grid">${boardCards}</div>
        </div>`;
    }

    // Empty lore state
    if (!loreSections) {
        loreSections = '<div class="wp-lore-empty"><i class="fa-solid fa-book-open fa-3x"></i><p>No lore content available yet.</p></div>';
    }

    const lorePanelHtml = `<div class="wp-panel active" data-panel="Lore">${loreSections}</div>`;

    // ---- Build tabs: Lore first, then categories ----
    let tabsHtml = '<div class="wp-tabs">';
    tabsHtml += `<div class="wp-tab active" data-tab="Lore">
        <i class="fa-solid fa-book-open"></i>
        <span class="wp-tab-label">Lore</span>
    </div>`;
    for (const cat of activeCats) {
        const icon = PREVIEW_CATEGORY_ICONS[cat] || 'fa-folder';
        const count = categorized.get(cat)?.length || 0;
        tabsHtml += `<div class="wp-tab" data-tab="${escapeHtml(cat)}">
            <i class="fa-solid ${icon}"></i>
            <span class="wp-tab-label">${cat}</span>
            <span class="wp-tab-count">${count}</span>
        </div>`;
    }
    tabsHtml += '</div>';

    // ---- Build category panels (all inactive) ----
    let panelsHtml = lorePanelHtml;
    for (const cat of activeCats) {
        const entries = categorized.get(cat) || [];
        let gridHtml = '';
        for (const e of entries) {
            const imgHtml = e.image
                ? `<img src="${escapeHtml(e.image)}" alt="" />`
                : `<i class="fa-solid ${PREVIEW_CATEGORY_ICONS[cat] || 'fa-folder'} fa-2x"></i>`;
            gridHtml += `
            <div class="wp-entry-card">
                <div class="wp-entry-img">${imgHtml}</div>
                <div class="wp-entry-name">${escapeHtml(e.title)}</div>
            </div>`;
        }
        panelsHtml += `<div class="wp-panel" data-panel="${escapeHtml(cat)}">
            <div class="wp-entry-grid">${gridHtml}</div>
        </div>`;
    }

    const fullHtml = `<div class="wp-container">${headerHtml}${tabsHtml}<div class="wp-panels">${panelsHtml}</div></div>`;

    const content = $(fullHtml);

    const popup = new Popup(content, POPUP_TYPE.CONFIRM, null, {
        wider: true,
        okButton: 'Start Campaign',
        cancelButton: 'Back',
        allowVerticalScrolling: true,
        onOpen: () => {
            content.on('click', '.wp-tab', function () {
                const cat = $(this).data('tab');
                content.find('.wp-tab').removeClass('active');
                $(this).addClass('active');
                content.find('.wp-panel').removeClass('active');
                content.find(`.wp-panel[data-panel="${cat}"]`).addClass('active');
            });
        },
    });

    const result = await popup.show();
    return result === POPUP_RESULT.AFFIRMATIVE;
}

/**
 * Shows a party picker popup for a given world.
 * Lets the user multi-select characters that belong to this world.
 * @param {string} worldName
 * @returns {Promise<{names: string[], entries: Array}>} Selected character names and entries
 */
async function showPartyPicker(worldName) {
    const data = await loadWorldInfo(worldName);
    if (!data?.entries) return { names: [], entries: [] };

    // Gather all Character entries
    const charEntries = [];
    for (const uid of Object.keys(data.entries)) {
        const entry = data.entries[uid];
        if (categorizeEntry(entry) === 'Characters') {
            charEntries.push(entry);
        }
    }
    if (charEntries.length === 0) return { names: [], entries: [] };

    // Build character card grid
    const selectedNames = new Set();
    const selectedUids = [];
    let gridHtml = '<div class="party-picker-grid">';
    for (const entry of charEntries) {
        const uid = String(entry.uid);
        const name = entry.comment || (Array.isArray(entry.key) ? entry.key.join(', ') : entry.key || 'Unknown');
        const image = entry.dndData?.image || '';
        const race = entry.dndData?.race || '';
        const charClass = entry.dndData?.charClass || '';
        const level = entry.dndData?.level ? `Lv ${entry.dndData.level}` : '';
        const subtitle = [race, charClass, level].filter(Boolean).join(' · ');

        const imgHtml = image
            ? `<img src="${escapeHtml(image)}" alt="" />`
            : '<i class="fa-solid fa-user fa-2x"></i>';

        gridHtml += `
        <div class="party-card" data-uid="${escapeHtml(uid)}" data-name="${escapeHtml(name)}">
            <div class="party-card-order"></div>
            <div class="party-card-img">${imgHtml}</div>
            <div class="party-card-info">
                <div class="party-card-name">${escapeHtml(name)}</div>
                ${subtitle ? `<div class="party-card-subtitle">${escapeHtml(subtitle)}</div>` : ''}
            </div>
            <div class="party-card-check"><i class="fa-solid fa-check"></i></div>
        </div>`;
    }
    gridHtml += '</div>';

    const headerHtml = `<h3 style="margin:0 0 6px"><i class="fa-solid fa-users"></i> Choose Your Party</h3>
        <p style="margin:0 0 10px;font-size:0.85rem;color:var(--SmartThemeQuoteColor,#999)">Select the characters that will join this campaign. You can pick multiple.</p>`;

    const content = $(`<div class="party-picker-container">${headerHtml}${gridHtml}</div>`);

    const popup = new Popup(content, POPUP_TYPE.CONFIRM, null, {
        wider: true,
        okButton: 'Confirm Party',
        cancelButton: 'Skip',
        allowVerticalScrolling: true,
        onOpen: () => {
            content.on('click', '.party-card', function () {
                const $card = $(this);
                const uid = String($card.data('uid'));
                const charName = $card.data('name');
                $card.toggleClass('selected');
                if ($card.hasClass('selected')) {
                    selectedNames.add(String(charName));
                    selectedUids.push(uid);
                } else {
                    selectedNames.delete(String(charName));
                    const index = selectedUids.indexOf(uid);
                    if (index >= 0) selectedUids.splice(index, 1);
                }
                content.find('.party-card').each(function () {
                    const $item = $(this);
                    const orderIndex = selectedUids.indexOf(String($item.data('uid')));
                    if (orderIndex >= 0) {
                        $item.find('.party-card-order').text(orderIndex === 0 ? 'P1' : `P${orderIndex + 1}`).show();
                    } else {
                        $item.find('.party-card-order').hide();
                    }
                });
            });
        },
    });

    const result = await popup.show();
    const selectedEntries = selectedUids
        .map(uid => charEntries.find(e => String(e.uid) === uid))
        .filter(Boolean);
    console.log('showPartyPicker result', { result, selectedUids, selectedNames: [...selectedNames], selectedEntries });
    if (result === POPUP_RESULT.AFFIRMATIVE && selectedUids.length > 0) {
        return { names: [...selectedNames], entries: selectedEntries };
    }
    return { names: [], entries: [] };
}

/**
 * Shows a world picker popup for new-chat flow.
 * Returns the chosen world + party, or null if cancelled / no world.
 * @returns {Promise<{worldName: string, party: string[], partyEntries: Array}|null>}
 */
export async function showWorldPickerForNewChat() {
    // A choice made ahead of time (the campaign wizard) answers instead of the picker.
    if (pendingWorldChoice) {
        const choice = pendingWorldChoice;
        pendingWorldChoice = null;
        return choice;
    }

    if (!world_names || world_names.length === 0) return null;

    // Load metadata for all worlds
    const worldData = [];
    for (const name of world_names) {
        let meta = {};
        try {
            const data = await loadWorldInfo(name);
            meta = data?.metadata ?? {};
        } catch { /* skip */ }
        worldData.push({
            name,
            displayName: meta.displayName || name,
            coverImage: meta.coverImage || '',
            genre: meta.genre || '',
        });
    }

    // Loop: picker → preview → party picker → return
    while (true) {
        const pickedWorld = await showPickerGrid(worldData);
        if (!pickedWorld) return null; // cancelled / "No World"

        const wMeta = worldData.find(w => w.name === pickedWorld);
        const confirmed = await showWorldPreviewPopup(pickedWorld, wMeta);
        if (!confirmed) continue; // user clicked "Back" → loop again

        // Party picker step
        const { names: partyNames, entries: partyEntries } = await showPartyPicker(pickedWorld);
        console.log('showWorldPickerForNewChat party selection', { pickedWorld, partyNames, partyEntries });
        return { worldName: pickedWorld, party: partyNames, partyEntries };
    }
}

/**
 * Shows the world picker grid popup.
 * @param {Array<{name: string, displayName: string, coverImage: string, genre: string}>} worldData
 * @returns {Promise<string|null>} world name or null
 */
async function showPickerGrid(worldData) {
    let selectedWorld = null;

    const content = $('<div class="world-picker-container"></div>');
    let gridHtml = '<div class="world-picker-grid">';
    for (const w of worldData) {
        const coverStyle = w.coverImage
            ? `background-image: url('${w.coverImage.replace(/'/g, '\\\'')}'); background-size: cover; background-position: center;`
            : '';
        const genreBadge = w.genre ? `<span class="campaign-genre">${escapeHtml(w.genre)}</span>` : '';
        gridHtml += `
        <div class="world-picker-card" data-world="${escapeHtml(w.name)}">
            <div class="campaign-cover" style="${coverStyle}">
                ${!w.coverImage ? '<i class="fa-solid fa-globe fa-3x campaign-cover-placeholder"></i>' : ''}
                ${genreBadge}
            </div>
            <div class="campaign-info">
                <div class="campaign-title">${escapeHtml(w.displayName)}</div>
            </div>
        </div>`;
    }
    gridHtml += '</div>';
    content.append(gridHtml);

    const popup = new Popup(content, POPUP_TYPE.CONFIRM, null, {
        wider: true,
        okButton: 'Select World',
        cancelButton: 'No World',
        allowVerticalScrolling: true,
        onOpen: () => {
            content.on('click', '.world-picker-card', function () {
                content.find('.world-picker-card').removeClass('selected');
                $(this).addClass('selected');
                selectedWorld = $(this).data('world');
            });
        },
    });

    const result = await popup.show();
    if (result === POPUP_RESULT.AFFIRMATIVE && selectedWorld) {
        return String(selectedWorld);
    }
    return null;
}

/**
 * Binds a world to the current chat via metadata.
 * @param {string} worldName
 */
export async function bindWorldToChat(worldName) {
    if (!worldName) return;
    console.log('bindWorldToChat', { worldName });
    chat_metadata[METADATA_KEY] = worldName;
    await saveMetadata();
}

/**
 * Binds a party (array of character names) to the current chat via metadata.
 * @param {string[]} party
 */
export async function bindPartyToChat(party) {
    if (!Array.isArray(party) || party.length === 0) {
        console.log('bindPartyToChat called with empty party', { party });
        return;
    }
    console.log('bindPartyToChat', { party });
    chat_metadata.party = party;
    await saveMetadata();
}

/**
 * A world choice made ahead of time, handed to showWorldPickerForNewChat so the normal
 * new-chat path (doNewChat) can run with the answers already in hand instead of asking.
 *
 * Reusing that path is the point. It creates the chat file, and only then binds the world
 * and builds the party, because getChat() resets the chat metadata. Doing those steps by
 * hand against whatever chat happened to be open is what left the first version of the
 * wizard with a Lorebook and no campaign.
 *
 * @type {{worldName: string, party: string[], partyEntries: any[]}|null}
 */
let pendingWorldChoice = null;

/** Guards against a second click starting a second wizard while the first is working. */
let wizardRunning = false;

/**
 * The character a campaign chat belongs to: the welcome-screen assistant, which is the
 * narrator these campaigns are already played with, else whatever is selected, else the
 * first character there is.
 *
 * @returns {Promise<number>} A character index, or -1 when there are no characters at all.
 */
async function pickCampaignCharacterId() {
    // Dynamic: welcome-screen.js imports this file, so a static import would be circular.
    const { getPermanentAssistantAvatar, openPermanentAssistantChat } = await import('./welcome-screen.js');
    const findAssistant = () => characters.findIndex(c => c.avatar === getPermanentAssistantAvatar());

    let assistantId = findAssistant();
    if (assistantId === -1) {
        // A truly empty install has no characters at all, and that is exactly who this
        // wizard is for. The welcome screen already knows how to create the assistant when
        // it is missing, so a new user is not stopped here.
        await openPermanentAssistantChat();
        assistantId = findAssistant();
    }
    if (assistantId !== -1) return assistantId;
    if (this_chid !== undefined && characters[Number(this_chid)]) return Number(this_chid);
    return characters.length > 0 ? 0 : -1;
}

/**
 * Opens a chat for a world that already exists and puts the player on its first board.
 *
 * Shared by everything that starts a campaign — the wizard for a world it just built, and
 * the Start button on a world that was never played — so the two cannot drift apart. It
 * runs the same doNewChat path the world picker has always used (see pendingWorldChoice for
 * why that matters), and treats the chat metadata, not the absence of an error, as the
 * test for having worked: that metadata is what the campaign list is built from.
 *
 * @param {Object} input
 * @param {string} input.worldName
 * @param {string[]} input.party
 * @param {any[]} input.partyEntries
 * @param {string} input.locationName  Empty when the world has no location yet.
 * @param {string} input.boardName     Empty when the location has no board yet.
 * @param {string} input.verb          'creada' or 'iniciada', for the toast title.
 * @returns {Promise<boolean>} Whether the campaign is now open and bound to the world.
 */
async function openCampaignChat({ worldName, party, partyEntries, locationName, boardName, verb }) {
    const characterId = await pickCampaignCharacterId();
    if (characterId === -1) {
        toastr.warning(
            'El mundo está listo, pero no hay ningún personaje con el que abrir el chat. '
            + 'Crea o importa uno y usa "Start new chat" para elegir este mundo.',
            `Mundo "${worldName}"`,
        );
        return false;
    }

    pendingWorldChoice = { worldName, party, partyEntries };

    try {
        await selectCharacterById(characterId);
        await doNewChat({ deleteCurrentChat: false });
    } finally {
        // Cleared whether or not doNewChat asked for it, so a stale choice can never
        // answer some later, unrelated "Start new chat".
        pendingWorldChoice = null;
    }

    if (chat_metadata?.[METADATA_KEY] !== worldName) {
        console.warn('[campaigns] the new chat did not end up bound to the world', { chat_metadata });
        toastr.warning(
            'El mundo está listo, pero el chat no quedó vinculado a él. '
            + 'Usa "Start new chat" y elígelo en el selector.',
            `Mundo "${worldName}"`,
        );
        return false;
    }

    let message = 'Este mundo aún no tiene ningún tablero: añádelo desde World Info.';
    if (locationName && boardName) {
        const { enterStartingBoard } = await import('./party.js');
        message = enterStartingBoard(locationName, boardName)
            ? `Estás en "${boardName}", en "${locationName}".`
            : 'Usa /go y /enter para llegar al primer tablero.';
    }

    toastr.success(message, `Campaña "${worldName}" ${verb}`);
    return true;
}

/**
 * Runs the campaign wizard end to end and leaves the player standing on the first board.
 */
async function startCampaignWizard() {
    if (wizardRunning) return;
    wizardRunning = true;

    try {
        const answers = await askWizard({
            Popup,
            POPUP_TYPE,
            existingWorldNames: Array.isArray(world_names) ? world_names : [],
            // generateRaw goes through whichever provider is configured, so the blank
            // canvas is not tied to one vendor. Offered only when something is connected:
            // a button that can only fail is worse than no button.
            generateWorld: online_status !== 'no_connection'
                ? (idea, partySize) => generateWorld({
                    idea,
                    partySize,
                    generate: params => generateRaw(params),
                })
                : null,
        });
        if (!answers) return;

        /** @type {import('./game-engine/ui/campaign-wizard.js').WizardResult} */
        let created;
        try {
            created = await createCampaign({
                answers,
                createWorld: (name) => createNewWorldInfo(name, { interactive: false }),
                loadWorld: loadWorldInfo,
                saveWorld: (name, data) => saveWorldInfo(name, data, true),
                createEntry: createWorldInfoEntry,
            });
        } catch (error) {
            console.error('[campaigns] wizard failed creating the world', error);
            toastr.error(String(error?.message || error), 'No se pudo crear la campaña');
            return;
        }

        // Un libro importado trae mas de lo que cabe en el aviso de siempre, y puede
        // traer nombres que no se resolvieron: eso hay que decirlo, no esconderlo.
        if (created.imported) {
            const c = created.imported.counts;
            toastr.success(
                `${c.boards} tableros, ${c.quests} misiones, ${c.entries} entradas.`,
                'Libro importado', { timeOut: 8000 },
            );
            if (created.imported.unresolved.length > 0) {
                toastr.warning(
                    created.imported.unresolved.slice(0, 5).join('; '),
                    `${created.imported.unresolved.length} nombres sin resolver`,
                    { timeOut: 15000 },
                );
            }
        }

        await openCampaignChat({ ...created, verb: 'creada' });

        // "Crear y escribir el mundo": la partida ya esta abierta detras, asi que cerrar
        // el editor deja a quien lo abrio jugando, no en una pantalla muerta.
        if (answers.writeWorld) await openCampaignBuilder();
    } catch (error) {
        console.error('[campaigns] wizard failed', error);
        toastr.error(String(error?.message || error), 'No se pudo abrir la campaña');
    } finally {
        wizardRunning = false;
    }
}

/**
 * Starts a campaign in a world that exists but has never been played: no chat points at it,
 * so it was visible in World Info and nowhere in the campaign list.
 *
 * The party comes from the same picker the "Start new chat" flow uses. Its Skip button
 * means "no party", as it always has, rather than "abort".
 *
 * @param {string} worldName
 */
async function startUnstartedWorld(worldName) {
    if (wizardRunning) return;
    wizardRunning = true;

    try {
        const data = await loadWorldInfo(worldName);
        if (!data) {
            toastr.error(`No se pudo cargar el mundo "${worldName}".`, 'No se pudo iniciar la campaña');
            return;
        }

        const { locationName, boardName } = getStartingPoint(data.metadata);
        const { names, entries } = await showPartyPicker(worldName);

        await openCampaignChat({
            worldName, party: names, partyEntries: entries, locationName, boardName, verb: 'iniciada',
        });
    } catch (error) {
        console.error('[campaigns] could not start the world', error);
        toastr.error(String(error?.message || error), 'No se pudo iniciar la campaña');
    } finally {
        wizardRunning = false;
    }
}

/**
 * Initializes campaign delegated event handlers.
 */
export function initCampaigns() {
    $(document).on('click', '#cw-new-campaign', async function (e) {
        e.stopPropagation();
        await startCampaignWizard();
    });

    // Continue most recent chat for a world (welcome panel)
    $(document).on('click', '.campaign-continue', async function (e) {
        e.stopPropagation();
        const chatFile = $(this).data('chat');
        const avatar = $(this).data('avatar');
        if (!chatFile) return;

        // Find the character index by avatar
        if (avatar) {
            const charIdx = characters.findIndex(c => c.avatar === avatar);
            if (charIdx >= 0) {
                await selectCharacterById(charIdx);
            }
        }
        const fileName = String(chatFile).replace('.jsonl', '');
        await openCharacterChat(fileName);
    });

    // A world that was never played: the whole card starts it. It has no sessions to list.
    $(document).on('click', '.campaign-card-unstarted', async function (e) {
        e.stopPropagation();
        const worldName = $(this).data('world');
        if (worldName) await startUnstartedWorld(String(worldName));
    });

    // View all sessions / card click → open sessions popup
    $(document).on('click', '.campaign-view-all, .campaign-card', async function (e) {
        if ($(this).hasClass('campaign-card-unstarted')) return;
        if ($(e.target).closest('.campaign-continue').length) return;
        if ($(e.target).closest('.campaign-view-all').length && !$(this).hasClass('campaign-view-all')) return;
        e.stopPropagation();
        const worldName = $(this).data('world') || $(this).closest('.campaign-card').data('world');
        if (worldName) {
            await showSessionsPopup(String(worldName));
        }
    });
}

/**
 * Shows a popup with all sessions for a given world.
 * @param {string} worldName
 */
async function showSessionsPopup(worldName) {
    const allChats = await fetchRecentChatsWithMetadata(200);
    const worldChats = allChats
        .filter(c => c.chat_metadata?.world_info === worldName)
        .sort((a, b) => (b.last_mes || 0) - (a.last_mes || 0));

    let meta = {};
    try {
        const data = await loadWorldInfo(worldName);
        meta = data?.metadata ?? {};
    } catch { /* skip */ }
    const displayName = meta.displayName || worldName;

    let html = '<div class="sessions-list">';
    if (worldChats.length === 0) {
        html += '<div class="sessions-empty">No sessions yet for this world.</div>';
    }
    for (const chat of worldChats) {
        const fileName = chat.file_name || '';
        const displayFileName = fileName.replace('.jsonl', '');
        const charName = chat.char_name || '';
        const itemCount = chat.chat_items || 0;
        const dateStr = chat.last_mes ? new Date(chat.last_mes).toLocaleDateString() : '';
        const preview = (chat.mes || '').substring(0, 120);

        html += `
        <div class="session-item" data-chat="${escapeHtml(fileName)}" data-avatar="${escapeHtml(chat.avatar || '')}">
            <div class="session-meta">
                <span class="session-name">${escapeHtml(charName)} &ndash; ${escapeHtml(displayFileName)}</span>
                <span class="session-date">${dateStr}</span>
            </div>
            ${preview ? `<div class="session-preview">${escapeHtml(preview)}</div>` : ''}
            <div class="session-footer">
                <span class="session-msg-count">${itemCount} messages</span>
                <button class="session-open menu_button" data-chat="${escapeHtml(fileName)}" data-avatar="${escapeHtml(chat.avatar || '')}">
                    <i class="fa-solid fa-play"></i> Open
                </button>
            </div>
        </div>`;
    }
    html += '</div>';

    const content = $(`<div><h3 style="margin:0 0 10px">${escapeHtml(displayName)} — Sessions</h3>${html}</div>`);

    // Delegate session open clicks
    content.on('click', '.session-open, .session-item', async function (e) {
        e.stopPropagation();
        const el = $(this).hasClass('session-open') ? $(this) : $(this).find('.session-open');
        const chatFile = el.data('chat') || $(this).data('chat');
        const avatar = el.data('avatar') || $(this).data('avatar');
        if (!chatFile) return;
        if (avatar) {
            const charIdx = characters.findIndex(c => c.avatar === avatar);
            if (charIdx >= 0) await selectCharacterById(charIdx);
        }
        await openCharacterChat(String(chatFile).replace('.jsonl', ''));
    });

    const popup = new Popup(content, POPUP_TYPE.TEXT, null, {
        wider: true,
        allowVerticalScrolling: true,
    });
    await popup.show();
}

// Initialize on document ready
jQuery(() => initCampaigns());
