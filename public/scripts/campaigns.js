import { world_names, loadWorldInfo, METADATA_KEY } from './world-info.js';
import { characters, getRequestHeaders, openCharacterChat, chat_metadata, saveMetadata, selectCharacterById } from '../script.js';
import { Popup, POPUP_TYPE, POPUP_RESULT } from './popup.js';

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

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

    // Sort by most-recent chat activity
    worlds.sort((a, b) => {
        const aTime = a.chats[0]?.last_mes || 0;
        const bTime = b.chats[0]?.last_mes || 0;
        return bTime - aTime;
    });

    if (worlds.length === 0) {
        container.innerHTML = `
        <div class="campaigns-empty">
            <i class="fa-solid fa-compass fa-3x"></i>
            <p>No campaigns yet. Start a new chat and pick a world to create your first campaign.</p>
        </div>`;
        return;
    }

    let html = '';
    for (const world of worlds) {
        const coverStyle = world.coverImage
            ? `background-image: url('${world.coverImage.replace(/'/g, "\\'")}'); background-size: cover; background-position: center;`
            : '';
        const genreBadge = world.genre
            ? `<span class="campaign-genre">${escapeHtml(world.genre)}</span>`
            : '';
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
    const meta = worldMeta || data?.metadata || {};
    const displayName = meta.displayName || worldName;
    const coverImage = meta.coverImage || '';
    const genre = meta.genre || '';

    // Group entries by category
    /** @type {Map<string, Array<{title: string, image: string}>>} */
    const categorized = new Map();
    if (data?.entries) {
        for (const uid of Object.keys(data.entries)) {
            const entry = data.entries[uid];
            const cat = categorizeEntry(entry);
            if (!cat) continue;
            if (!categorized.has(cat)) categorized.set(cat, []);
            const title = entry.comment || (Array.isArray(entry.key) ? entry.key.join(', ') : entry.key || `Entry ${entry.uid}`);
            const image = entry.dndData?.image || '';
            categorized.get(cat).push({ title, image });
        }
    }

    // Only keep categories with entries
    const activeCats = PREVIEW_CATEGORIES.filter(c => categorized.has(c) && categorized.get(c).length > 0);

    // Build header
    const coverStyle = coverImage
        ? `background-image: url('${coverImage.replace(/'/g, "\\'")}'); background-size: cover; background-position: center;`
        : '';
    const headerHtml = `
    <div class="wp-header" style="${coverStyle}">
        <div class="wp-header-overlay">
            <div class="wp-header-title">${escapeHtml(displayName)}</div>
            ${genre ? `<span class="wp-header-genre">${escapeHtml(genre)}</span>` : ''}
        </div>
    </div>`;

    // Build tabs
    let tabsHtml = '<div class="wp-tabs">';
    for (let i = 0; i < activeCats.length; i++) {
        const cat = activeCats[i];
        const icon = PREVIEW_CATEGORY_ICONS[cat] || 'fa-folder';
        const count = categorized.get(cat)?.length || 0;
        tabsHtml += `<div class="wp-tab ${i === 0 ? 'active' : ''}" data-tab="${escapeHtml(cat)}">
            <i class="fa-solid ${icon}"></i>
            <span class="wp-tab-label">${cat}</span>
            <span class="wp-tab-count">${count}</span>
        </div>`;
    }
    tabsHtml += '</div>';

    // Build panels
    let panelsHtml = '';
    for (let i = 0; i < activeCats.length; i++) {
        const cat = activeCats[i];
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
        panelsHtml += `<div class="wp-panel ${i === 0 ? 'active' : ''}" data-panel="${escapeHtml(cat)}">
            <div class="wp-entry-grid">${gridHtml}</div>
        </div>`;
    }

    // Empty state
    if (activeCats.length === 0) {
        panelsHtml = `<div class="wp-empty"><i class="fa-solid fa-book-open fa-3x"></i><p>This world has no categorized entries yet.</p></div>`;
        tabsHtml = '';
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
 * Shows a world picker popup for new-chat flow.
 * Returns the chosen world name, or null if cancelled / no world.
 * @returns {Promise<string|null>}
 */
export async function showWorldPickerForNewChat() {
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

    // Loop: picker → preview → back to picker or confirm
    while (true) {
        const pickedWorld = await showPickerGrid(worldData);
        if (!pickedWorld) return null; // cancelled / "No World"

        const wMeta = worldData.find(w => w.name === pickedWorld);
        const confirmed = await showWorldPreviewPopup(pickedWorld, wMeta);
        if (confirmed) return pickedWorld;
        // else user clicked "Back" → loop again to show picker
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
            ? `background-image: url('${w.coverImage.replace(/'/g, "\\'")}'); background-size: cover; background-position: center;`
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
    chat_metadata[METADATA_KEY] = worldName;
    await saveMetadata();
}

/**
 * Initializes campaign delegated event handlers.
 */
export function initCampaigns() {
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
                await selectCharacterById(String(charIdx));
            }
        }
        const fileName = String(chatFile).replace('.jsonl', '');
        await openCharacterChat(fileName);
    });

    // View all sessions / card click → open sessions popup
    $(document).on('click', '.campaign-view-all, .campaign-card', async function (e) {
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
            if (charIdx >= 0) await selectCharacterById(String(charIdx));
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
