/**
 * World Content Browser
 * Browse and manage world info entries organized by category (Characters, Locations,
 * Monsters, Items, Spells, Races, Classes, Factions, Boards, Uncategorized).
 */

import { t } from './i18n.js';
import { POPUP_TYPE, POPUP_RESULT, Popup } from './popup.js';
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
    const catalog = buildCatalogFromWorldDataMap(worldDataMap);

    const result = await showCategoryPopup(category, existingData, existingTitle, undefined, catalog);

    if (result) {
        entry.comment = result.title;
        entry.key = result.keys;
        entry.content = result.content;
        entry.dndData = result.dndData;

        const data = worldDataMap.get(worldName);
        if (data) {
            if (result.dndData && categorizeEntry(entry) === 'Characters') {
                registerCharacterPosition(data, result.title, result.dndData);
            }
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

    const catalog = buildCatalogFromWorldDataMap(worldDataMap);
    const result = await showCategoryPopup(category, null, '', worlds, catalog);

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
 * Update world metadata to register a character's board position.
 * Writes/updates an entry in metadata.locationMaps[i].boards[j].characters[].
 * @param {any} data          - World info data object (mutated in place)
 * @param {string} charName   - Character name/title
 * @param {any} dndData       - Character's dndData (contains location, board, boardX, boardY)
 */
function registerCharacterPosition(data, charName, dndData) {
    const locName = dndData?.location;
    const boardName = dndData?.board;
    if (!locName || !boardName) return; // nothing to register if no board is set

    if (!data.metadata) data.metadata = {};
    if (!Array.isArray(data.metadata.locationMaps)) data.metadata.locationMaps = [];

    let locMap = data.metadata.locationMaps.find(l => l.name === locName);
    if (!locMap) {
        locMap = { name: locName, boards: [] };
        data.metadata.locationMaps.push(locMap);
    }
    if (!Array.isArray(locMap.boards)) locMap.boards = [];

    let board = locMap.boards.find(b => b.name === boardName);
    if (!board) {
        board = { name: boardName };
        locMap.boards.push(board);
    }
    if (!Array.isArray(board.characters)) board.characters = [];

    // Remove any existing entry for this character (by name), then re-add with new position
    board.characters = board.characters.filter(c => c.name !== charName);
    board.characters.push({
        name: charName,
        gridX: Number(dndData.boardX) || 0,
        gridY: Number(dndData.boardY) || 0,
    });
}

/**
 * Build a catalog of { races, classes, factions, locationMaps } from a worldDataMap.
 * locationMaps is the merged array of { name, boards: [{name, gridWidth, gridHeight}] } objects
 * sourced from metadata.locationMaps across all loaded worlds.
 * @param {Map<string, any>} worldDataMap
 * @returns {{ races: string[], classes: string[], factions: string[], locationMaps: Array<{name:string, boards:Array<{name:string,gridWidth:number,gridHeight:number}>}> }}
 */
function buildCatalogFromWorldDataMap(worldDataMap) {
    const racesSet = new Set(), classesSet = new Set(), factionsSet = new Set();
    /** @type {Map<string, {name:string, boards:Array<{name:string,gridWidth:number,gridHeight:number}>}>} */
    const locationMapsMap = new Map();

    for (const [, data] of worldDataMap.entries()) {
        for (const entry of Object.values(data?.entries || {})) {
            const cat = categorizeEntry(entry);
            const name = entry.comment || (Array.isArray(entry.key) ? entry.key[0] : String(entry.key || ''));
            if (!name) continue;
            if (cat === 'Races') racesSet.add(name);
            else if (cat === 'Classes') classesSet.add(name);
            else if (cat === 'Factions') factionsSet.add(name);
        }
        // Merge location maps from metadata
        const mapsInWorld = Array.isArray(data?.metadata?.locationMaps) ? data.metadata.locationMaps : [];
        for (const loc of mapsInWorld) {
            if (!loc?.name) continue;
            const existing = locationMapsMap.get(loc.name);
            const boards = (Array.isArray(loc.boards) ? loc.boards : []).map(b => ({
                name: String(b.name || ''),
                gridWidth: Number(b.gridWidth) || 50,
                gridHeight: Number(b.gridHeight) || 50,
            })).filter(b => b.name);
            if (!existing) {
                locationMapsMap.set(loc.name, { name: loc.name, boards });
            } else {
                // Merge boards that aren't already listed
                for (const board of boards) {
                    if (!existing.boards.some(eb => eb.name === board.name)) {
                        existing.boards.push(board);
                    }
                }
            }
        }
    }

    return {
        races: [...racesSet].sort(),
        classes: [...classesSet].sort(),
        factions: [...factionsSet].sort(),
        locationMaps: [...locationMapsMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
    };
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

    /** @type {any} */
    const data = await loadWorldInfo(worldName);
    if (!data?.entries) {
        // @ts-ignore
        toastr.warning(t`Could not load world info entries.`);
        return;
    }

    const meta = data.metadata || {};
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
    /** @type {Map<string, Array<{entry: any, title: string, image: string, desc: string}>>} */
    const categorized = new Map();
    for (const uid of Object.keys(data.entries)) {
        const entry = data.entries[uid];
        const cat = categorizeEntry(entry);
        if (!cat || cat === 'Uncategorized') continue;
        if (!categorized.has(cat)) categorized.set(cat, []);
        const title = entry.comment || (Array.isArray(entry.key) ? entry.key.join(', ') : entry.key || `Entry ${entry.uid}`);
        const image = entry.dndData?.image || '';
        categorized.get(cat).push({ entry, title, image, desc: '' });
    }

    const activeCats = CONTENT_CATEGORIES.filter(c => c !== 'Uncategorized' && categorized.has(c) && categorized.get(c).length > 0);
    // Build catalog for character form selects.
    const catalog = buildCatalogFromWorldDataMap(new Map([[worldName, data]]));

    // ---- Build campaign-style HTML ----
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

    // ---- Build Lore panel content ----
    let loreSections = '';

    if (worldDescription) {
        loreSections += `
        <div class="wp-lore-section">
            <div class="wp-lore-section-title"><i class="fa-solid fa-scroll"></i> ${t`Description`}</div>
            <div class="wp-lore-desc">${escapeHtml(worldDescription)}</div>
        </div>`;
    }

    if (worldMapUrl) {
        loreSections += `
        <div class="wp-lore-section">
            <div class="wp-lore-section-title"><i class="fa-solid fa-map"></i> ${t`World Map`}</div>
            <div class="wp-lore-map"><img src="${escapeHtml(worldMapUrl)}" alt="World Map" /></div>
        </div>`;
    }

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
            <div class="wp-lore-section-title"><i class="fa-solid fa-location-dot"></i> ${t`Locations`}</div>
            <div class="wp-entry-grid">${locCards}</div>
        </div>`;
    }

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
            <div class="wp-lore-section-title"><i class="fa-solid fa-chess-board"></i> ${t`Boards`}</div>
            <div class="wp-entry-grid">${boardCards}</div>
        </div>`;
    }

    if (!loreSections) {
        loreSections = `<div class="wp-lore-empty"><i class="fa-solid fa-book-open fa-3x"></i><p>${t`No lore content available yet.`}</p></div>`;
    }

    const lorePanelHtml = `<div class="wp-panel active" data-panel="Lore">${loreSections}</div>`;

    // ---- Build tabs: Lore first, then categories ----
    const isLoreStart = !initialCategory || !activeCats.includes(initialCategory);
    const startTab = isLoreStart ? 'Lore' : initialCategory;

    let tabsHtml = '<div class="wp-tabs">';
    tabsHtml += `<div class="wp-tab ${startTab === 'Lore' ? 'active' : ''}" data-tab="Lore">
        <i class="fa-solid fa-book-open"></i>
        <span class="wp-tab-label">${t`Lore`}</span>
    </div>`;
    for (const cat of activeCats) {
        const icon = CATEGORY_ICONS[cat] || 'fa-folder';
        const count = categorized.get(cat)?.length || 0;
        tabsHtml += `<div class="wp-tab ${cat === startTab ? 'active' : ''}" data-tab="${escapeHtml(cat)}">
            <i class="fa-solid ${icon}"></i>
            <span class="wp-tab-label">${cat}</span>
            <span class="wp-tab-count">${count}</span>
        </div>`;
    }
    tabsHtml += '</div>';

    // ---- Build category panels ----
    let panelsHtml = startTab === 'Lore' ? lorePanelHtml : lorePanelHtml.replace('class="wp-panel active"', 'class="wp-panel"');
    for (const cat of activeCats) {
        const items = categorized.get(cat) || [];
        let gridHtml = '';
        for (const item of items) {
            const imgHtml = item.image
                ? `<img src="${escapeHtml(item.image)}" alt="" />`
                : `<i class="fa-solid ${CATEGORY_ICONS[cat] || 'fa-folder'} fa-2x"></i>`;
            gridHtml += `
            <div class="wp-entry-card" data-uid="${item.entry.uid}" style="cursor:pointer;">
                <div class="wp-entry-img">${imgHtml}</div>
                <div class="wp-entry-name">${escapeHtml(item.title)}</div>
            </div>`;
        }
        panelsHtml += `<div class="wp-panel ${cat === startTab ? 'active' : ''}" data-panel="${escapeHtml(cat)}">
            <div class="wp-entry-grid">${gridHtml}</div>
        </div>`;
    }

    const fullHtml = `<div class="wp-container">${headerHtml}${tabsHtml}<div class="wp-panels">${panelsHtml}</div></div>`;
    const content = $(fullHtml);

    const popup = new Popup(content, POPUP_TYPE.CONFIRM, null, {
        wider: true,
        allowVerticalScrolling: true,
        okButton: t`Close`,
        cancelButton: null,
        onOpen: () => {
            // Tab switching
            content.on('click', '.wp-tab', function () {
                const cat = $(this).data('tab');
                content.find('.wp-tab').removeClass('active');
                $(this).addClass('active');
                content.find('.wp-panel').removeClass('active');
                content.find(`.wp-panel[data-panel="${cat}"]`).addClass('active');
            });

            // Entry click → edit
            content.on('click', '.wp-entry-card', async function () {
                const uid = String($(this).data('uid'));
                const entry = data.entries[uid];
                if (!entry) return;

                const category = categorizeEntry(entry);
                const existingData = entry.dndData || {};
                const existingTitle = entry.comment || (Array.isArray(entry.key) ? entry.key.join(', ') : '');

                const result = await showCategoryPopup(category, existingData, existingTitle, undefined, catalog);
                if (result) {
                    entry.comment = result.title;
                    entry.key = result.keys;
                    entry.content = result.content;
                    entry.dndData = result.dndData;
                    if (result.dndData && category === 'Characters') {
                        registerCharacterPosition(data, result.title, result.dndData);
                    }
                    await saveWorldInfo(worldName, data);
                    // @ts-ignore
                    toastr.success(t`Entry "${result.title}" updated.`);
                }
            });
        },
    });

    await popup.show();
}

// ============================================================
//  LOREBOOK BUTTON WIRING
// ============================================================

// Wire the "Browse Content" button in the Lorebook toolbar
$(document).on('click', '#world_content_browse_btn', async function () {
    const worldName = current_world_info_name || '';
    await openWorldContentPopup(worldName);
});

// Wire category quick-access icons in the Lorebook toolbar
// Opens the category-specific creation form directly
$(document).on('click', '.wi-cat-icon', async function () {
    const worldName = current_world_info_name || '';
    const category = String($(this).data('category') || '');
    if (!category) return;

    if (!worldName) {
        // @ts-ignore
        toastr.warning(t`Please select a world first.`);
        return;
    }

    const rawData = await loadWorldInfo(worldName);
    const catalogMap = rawData ? new Map([[worldName, rawData]]) : new Map();
    const catalog = buildCatalogFromWorldDataMap(catalogMap);
    const result = await showCategoryPopup(category, null, '', [worldName], catalog);

    if (result) {
        if (!result.title) {
            // @ts-ignore
            toastr.warning(t`Please provide at least a name.`);
            return;
        }

        let data = rawData || await loadWorldInfo(worldName);
        if (!data) return;

        const newEntry = /** @type {any} */ (createWorldInfoEntry(worldName, data));
        if (!newEntry) return;

        newEntry.comment = result.title;
        newEntry.key = result.keys;
        newEntry.content = result.content;
        newEntry.group = category;
        newEntry.dndData = result.dndData;

        if (result.dndData && category === 'Characters') {
            registerCharacterPosition(data, result.title, result.dndData);
        }

        await saveWorldInfo(worldName, data);
        // @ts-ignore
        toastr.success(t`Entry "${result.title}" created in ${worldName}.`);
    }
});
