/**
 * World Content Browser
 * Browse and manage world info entries organized by category (Characters, Locations,
 * Monsters, Items, Spells, Races, Classes, Factions, Boards, Uncategorized).
 */

import { t } from './i18n.js';
import { POPUP_TYPE, Popup } from './popup.js';
import {
    selected_world_info, loadWorldInfo, saveWorldInfo,
    createWorldInfoEntry, current_world_info_name,
} from './world-info.js';
import { chat_metadata } from '../script.js';
import { showCategoryPopup, initWcpHandlers } from './world-content-popups.js';

// Initialize popup event handlers once
initWcpHandlers();

/** @type {string[]} */
const CONTENT_CATEGORIES = [
    'Characters', 'Locations', 'Monsters', 'Items',
    'Spells', 'Races', 'Classes', 'Factions', 'Boards', 'Uncategorized',
];

/** @type {Object<string, string>} */
const CATEGORY_ICONS = {
    'Characters': 'fa-user',
    'Locations': 'fa-location-dot',
    'Monsters': 'fa-dragon',
    'Items': 'fa-gem',
    'Spells': 'fa-wand-sparkles',
    'Races': 'fa-people-group',
    'Classes': 'fa-shield-halved',
    'Factions': 'fa-flag',
    'Boards': 'fa-chess-board',
    'Uncategorized': 'fa-folder',
};

const METADATA_KEY = 'world_info';

/**
 * Get all active world names (global + chat + character-bound).
 * @returns {string[]}
 */
function getActiveWorldNames() {
    const worlds = new Set();
    // Global worlds
    if (selected_world_info?.length) {
        for (const w of selected_world_info) worlds.add(w);
    }
    // Chat-bound world
    const chatWorld = chat_metadata?.[METADATA_KEY];
    if (chatWorld) worlds.add(chatWorld);
    return [...worlds];
}

/**
 * Categorize a world info entry based on its group field.
 * @param {any} entry
 * @returns {string}
 */
function categorizeEntry(entry) {
    const group = (entry.group || '').trim().toLowerCase();
    if (!group) return 'Uncategorized';

    for (const cat of CONTENT_CATEGORIES) {
        if (cat === 'Uncategorized') continue;
        // Match singular or plural forms
        const catLower = cat.toLowerCase();
        const singular = catLower.endsWith('es') ? catLower.slice(0, -2) : catLower.endsWith('s') ? catLower.slice(0, -1) : catLower;
        if (group === catLower || group === singular || group.includes(catLower) || group.includes(singular)) {
            return cat;
        }
    }
    return 'Uncategorized';
}

/**
 * Render the world content browser into the given container.
 * @param {JQuery} container
 * @param {string[]} [worldNameFilter] - If provided, only show entries from these worlds
 */
export async function renderWorldContentBrowser(container, worldNameFilter) {
    container.empty();

    const worlds = worldNameFilter?.length ? worldNameFilter : getActiveWorldNames();
    if (!worlds.length) {
        container.html(`<div class="wcb-empty-state"><i class="fa-solid fa-globe"></i><div>${t`No active worlds. Select or bind a world first.`}</div></div>`);
        return;
    }

    // Load all entries from all active worlds
    /** @type {{entry: any, worldName: string}[]} */
    const allEntries = [];
    /** @type {Map<string, any>} */
    const worldDataMap = new Map();

    for (const worldName of worlds) {
        /** @type {any} */
        const data = await loadWorldInfo(worldName);
        if (!data || !data.entries) continue;
        worldDataMap.set(worldName, data);
        for (const uid of Object.keys(data.entries)) {
            allEntries.push({ entry: data.entries[uid], worldName });
        }
    }

    if (!allEntries.length) {
        container.html(`<div class="wcb-empty-state"><i class="fa-solid fa-book-open"></i><div>${t`No entries found in active worlds.`}</div></div>`);
        return;
    }

    // Group by category
    /** @type {Map<string, {entry: any, worldName: string}[]>} */
    const categorized = new Map();
    for (const cat of CONTENT_CATEGORIES) categorized.set(cat, []);

    for (const item of allEntries) {
        const cat = categorizeEntry(item.entry);
        categorized.get(cat)?.push(item);
    }

    // Build the UI
    const browser = $('<div class="wcb-browser"></div>');

    // Category sidebar
    const sidebar = $('<div class="wcb-sidebar"></div>');
    const contentPanel = $('<div class="wcb-content"></div>');

    let firstNonEmpty = null;
    for (const cat of CONTENT_CATEGORIES) {
        const items = categorized.get(cat) || [];
        const icon = CATEGORY_ICONS[cat] || 'fa-folder';
        const btn = $(`
            <div class="wcb-category-btn" data-category="${cat}">
                <i class="fa-solid ${icon}"></i>
                <span class="wcb-cat-name">${cat}</span>
                <span class="wcb-cat-count">${items.length}</span>
            </div>
        `);
        if (!firstNonEmpty && items.length > 0) firstNonEmpty = cat;
        btn.on('click', function () {
            sidebar.find('.wcb-category-btn').removeClass('active');
            $(this).addClass('active');
            renderCategoryContent(contentPanel, cat, categorized.get(cat) || [], worldDataMap);
        });
        sidebar.append(btn);
    }

    // Add "New Entry" button at the bottom of sidebar
    const addBtn = $(`<div class="wcb-add-btn"><i class="fa-solid fa-plus"></i> Add Entry</div>`);
    addBtn.on('click', async () => {
        await addNewWorldEntry(worlds, worldDataMap, container);
    });
    sidebar.append(addBtn);

    browser.append(sidebar, contentPanel);
    container.append(browser);

    // Select first non-empty category
    const initialCat = firstNonEmpty || CONTENT_CATEGORIES[0];
    sidebar.find(`[data-category="${initialCat}"]`).addClass('active');
    renderCategoryContent(contentPanel, initialCat, categorized.get(initialCat) || [], worldDataMap);
}

/**
 * Render the entries for a specific category.
 * @param {JQuery} panel
 * @param {string} category
 * @param {{entry: any, worldName: string}[]} items
 * @param {Map<string, any>} worldDataMap
 */
function renderCategoryContent(panel, category, items, worldDataMap) {
    panel.empty();

    const header = $(`<div class="wcb-category-header">
        <i class="fa-solid ${CATEGORY_ICONS[category] || 'fa-folder'}"></i>
        <span>${category}</span>
        <span class="wcb-cat-header-count">(${items.length})</span>
    </div>`);
    panel.append(header);

    if (!items.length) {
        panel.append(`<div class="wcb-empty-category">${t`No entries in this category.`}</div>`);
        return;
    }

    const grid = $('<div class="wcb-entries-grid"></div>');

    for (const item of items) {
        const entry = item.entry;
        const title = entry.comment || (Array.isArray(entry.key) ? entry.key.join(', ') : entry.key || `Entry ${entry.uid}`);
        const keyText = Array.isArray(entry.key) ? entry.key.join(', ') : entry.key || '';
        const contentPreview = (entry.content || '').substring(0, 120).replace(/\n/g, ' ');
        const isDisabled = entry.disable;

        // Check for location coordinates (for image display)
        const imageUrl = entry.dndData?.image || entry.mapUrl || entry.locationMapUrl;

        const card = $(`
            <div class="wcb-entry-card ${isDisabled ? 'disabled' : ''}">
                ${imageUrl ? `<div class="wcb-entry-image"><img src="${escapeHtml(imageUrl)}" alt="" /></div>` : ''}
                <div class="wcb-entry-info">
                    <div class="wcb-entry-title">${escapeHtml(title)}</div>
                    <div class="wcb-entry-keys" title="${escapeHtml(keyText)}"><i class="fa-solid fa-key"></i> ${escapeHtml(keyText)}</div>
                    <div class="wcb-entry-preview">${escapeHtml(contentPreview)}${contentPreview.length >= 120 ? '…' : ''}</div>
                </div>
                <div class="wcb-entry-meta">
                    <span class="wcb-entry-world" title="${escapeHtml(item.worldName)}"><i class="fa-solid fa-globe"></i> ${escapeHtml(item.worldName)}</span>
                    ${isDisabled ? '<span class="wcb-entry-disabled-badge">Disabled</span>' : ''}
                </div>
            </div>
        `);

        card.on('click', () => {
            showEntryDetail(entry, item.worldName, worldDataMap, panel.closest('.wcb-browser').parent());
        });

        grid.append(card);
    }

    panel.append(grid);
}

/**
 * Show detailed view / edit popup for a world info entry.
 * @param {any} entry
 * @param {string} worldName
 * @param {Map<string, any>} worldDataMap
 * @param {JQuery} [browserContainer]
 */
async function showEntryDetail(entry, worldName, worldDataMap, browserContainer) {
    const category = categorizeEntry(entry);
    const existingData = entry.dndData || {};
    const existingTitle = entry.comment || (Array.isArray(entry.key) ? entry.key.join(', ') : '');

    const result = await showCategoryPopup(category, existingData, existingTitle);

    if (result) {
        entry.comment = result.title;
        entry.key = result.keys;
        entry.content = result.content;
        entry.dndData = result.dndData;

        const data = worldDataMap.get(worldName);
        if (data) {
            await saveWorldInfo(worldName, data);
            // @ts-ignore
            toastr.success(t`Entry "${result.title}" updated.`);
        }

        // Re-render the browser if container available
        if (browserContainer) renderWorldContentBrowser(browserContainer);
    }
}

/**
 * Add a new world entry with category-specific popup.
 * @param {string[]} worlds
 * @param {Map<string, any>} worldDataMap
 * @param {JQuery} browserContainer
 */
async function addNewWorldEntry(worlds, worldDataMap, browserContainer) {
    // Get currently selected category from sidebar
    const activeBtn = document.querySelector('.wcb-category-btn.active');
    const category = activeBtn?.getAttribute('data-category') || 'Uncategorized';

    const result = await showCategoryPopup(category, null, '', worlds);

    if (result) {
        const worldName = result.world;
        if (!worldName || !result.title) {
            // @ts-ignore
            toastr.warning(t`Please provide at least a name and world.`);
            return;
        }

        /** @type {any} */
        let data = worldDataMap.get(worldName);
        if (!data) {
            data = await loadWorldInfo(worldName);
            if (!data) return;
            worldDataMap.set(worldName, data);
        }

        const newEntry = /** @type {any} */ (createWorldInfoEntry(worldName, data));
        if (!newEntry) return;

        newEntry.comment = result.title;
        newEntry.key = result.keys;
        newEntry.content = result.content;
        newEntry.group = category;
        newEntry.dndData = result.dndData;

        await saveWorldInfo(worldName, data);
        // @ts-ignore
        toastr.success(t`Entry "${result.title}" created in ${worldName}.`);

        // Re-render the browser
        renderWorldContentBrowser(browserContainer);
    }
}

/**
 * Simple HTML escape.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Open the world content browser in a standalone popup.
 * Used by the Lorebook "Browse Content" button.
 * @param {string} worldName - The world to browse
 * @param {string} [initialCategory] - Category to auto-select on open
 */
export async function openWorldContentPopup(worldName, initialCategory) {
    if (!worldName) {
        // @ts-ignore
        toastr.warning(t`Please select a world to browse.`);
        return;
    }

    const html = '<div id="wcb_popup_container" class="width100p" style="min-height:400px"></div>';

    const popup = new Popup(html, POPUP_TYPE.CONFIRM, null, {
        large: true,
        allowVerticalScrolling: true,
        okButton: 'Close',
        cancelButton: null,
        onOpen: async () => {
            const container = $('#wcb_popup_container');
            if (container.length) {
                await renderWorldContentBrowser(container, [worldName]);
                // Auto-select category if specified
                if (initialCategory) {
                    const catBtn = container.find(`.wcb-category-btn[data-category="${initialCategory}"]`);
                    if (catBtn.length) catBtn.trigger('click');
                }
            }
        },
    });

    await popup.show();
}

// ============================================================
//  LOREBOOK BUTTON WIRING
// ============================================================

// Wire the "Browse Content" button in the Lorebook toolbar
$(document).on('click', '#world_content_browse_btn', async function () {
    const worldName = String($('#world_editor_select').val() || '').trim();
    await openWorldContentPopup(worldName);
});

// Wire category quick-access icons in the Lorebook toolbar
// Opens the category-specific creation form directly
$(document).on('click', '.wi-cat-icon', async function () {
    const worldName = String($('#world_editor_select').val() || '').trim();
    const category = String($(this).data('category') || '');
    if (!category) return;

    if (!worldName) {
        // @ts-ignore
        toastr.warning(t`Please select a world first.`);
        return;
    }

    const result = await showCategoryPopup(category, null, '', [worldName]);

    if (result) {
        if (!result.title) {
            // @ts-ignore
            toastr.warning(t`Please provide at least a name.`);
            return;
        }

        let data = await loadWorldInfo(worldName);
        if (!data) return;

        const newEntry = /** @type {any} */ (createWorldInfoEntry(worldName, data));
        if (!newEntry) return;

        newEntry.comment = result.title;
        newEntry.key = result.keys;
        newEntry.content = result.content;
        newEntry.group = category;
        newEntry.dndData = result.dndData;

        await saveWorldInfo(worldName, data);
        // @ts-ignore
        toastr.success(t`Entry "${result.title}" created in ${worldName}.`);
    }
});
