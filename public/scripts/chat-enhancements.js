/**
 * Chat Enhancements: Lorebook Entity Highlighting + Inline Speech Avatars
 *
 * Post-processes rendered chat messages to:
 * 1. Underline World Info (lorebook) keywords with hover tooltips showing entry details
 * 2. Show small circular character avatars inline when characters speak (quoted dialogue)
 */

// @ts-nocheck

import { characters, getThumbnailUrl } from '../script.js';
import { eventSource, event_types } from './events.js';
import { getSortedEntries } from './world-info.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const LOG_PREFIX = '[ChatEnhance]';

/** Tags to skip when walking text nodes for lorebook highlighting */
const SKIP_TAGS = new Set(['CODE', 'PRE', 'A', 'SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT']);

/** Minimum keyword length to consider for highlighting */
const MIN_KEYWORD_LENGTH = 3;

/** Maximum content preview length in tooltip */
const MAX_CONTENT_PREVIEW = 220;

/** Delay (ms) before hiding tooltip when mouse leaves */
const TOOLTIP_HIDE_DELAY = 250;

// ============================================================================
// STATE
// ============================================================================

/** @type {Map<string, object[]>} lowercase keyword → array of WI entries */
let keywordEntryMap = new Map();

/** @type {RegExp|null} Combined regex for all keywords */
let keywordRegex = null;

/** @type {HTMLDivElement|null} Singleton tooltip element */
let tooltipEl = null;

/** @type {number|null} Tooltip hide timeout ID */
let tooltipHideTimer = null;

/** @type {boolean} Whether the keyword cache is currently being built */
let isBuildingCache = false;

/** @type {boolean} Feature enabled state */
let enabled = true;

// ============================================================================
// KEYWORD CACHE
// ============================================================================

/**
 * Build the keyword → entry map from all active World Info entries.
 * Called on init and when WI data changes.
 */
async function buildKeywordCache() {
    if (isBuildingCache) return;
    isBuildingCache = true;

    try {
        const entries = await getSortedEntries();
        const newMap = new Map();

        for (const entry of entries) {
            if (entry.disable) continue;
            if (!entry.key || !Array.isArray(entry.key)) continue;

            for (const rawKey of entry.key) {
                if (!rawKey || typeof rawKey !== 'string') continue;
                // Skip regex keys (start with /)
                if (rawKey.startsWith('/')) continue;

                const trimmed = rawKey.trim();
                if (trimmed.length < MIN_KEYWORD_LENGTH) continue;

                const lower = trimmed.toLowerCase();
                if (!newMap.has(lower)) {
                    newMap.set(lower, []);
                }
                newMap.get(lower).push(entry);
            }
        }

        keywordEntryMap = newMap;

        // Build combined regex from keywords sorted by length descending (longest match first)
        if (newMap.size > 0) {
            const sortedKeywords = Array.from(newMap.keys())
                .sort((a, b) => b.length - a.length)
                .map(kw => escapeRegex(kw));
            keywordRegex = new RegExp(`\\b(${sortedKeywords.join('|')})\\b`, 'gi');
        } else {
            keywordRegex = null;
        }

        console.debug(`${LOG_PREFIX} Keyword cache built: ${newMap.size} keywords from ${entries.length} entries`);
    } catch (err) {
        console.error(`${LOG_PREFIX} Failed to build keyword cache:`, err);
        keywordEntryMap = new Map();
        keywordRegex = null;
    } finally {
        isBuildingCache = false;
    }
}

/**
 * Escape special regex characters in a string.
 * @param {string} str
 * @returns {string}
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// LOREBOOK ENTITY HIGHLIGHTING
// ============================================================================

/**
 * Process a message's text element to highlight lorebook entity keywords.
 * Uses a TreeWalker to iterate text nodes and wrap matches.
 * @param {HTMLElement} mesTextEl - The .mes_text element
 */
function highlightLorebookEntities(mesTextEl) {
    if (!keywordRegex || keywordEntryMap.size === 0) return;

    // Collect text nodes to process (snapshot to avoid live mutation issues)
    const textNodes = [];
    const walker = document.createTreeWalker(mesTextEl, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            // Skip if already highlighted or inside elements we should not touch
            let parent = node.parentElement;
            while (parent && parent !== mesTextEl) {
                if (parent.classList?.contains('lorebook-entity')) return NodeFilter.FILTER_REJECT;
                if (parent.classList?.contains('inline-char-avatar-wrap')) return NodeFilter.FILTER_REJECT;
                if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
                parent = parent.parentElement;
            }
            return NodeFilter.FILTER_ACCEPT;
        },
    });

    while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
    }

    // Process each text node
    for (const textNode of textNodes) {
        processTextNode(textNode);
    }
}

/**
 * Process a single text node: find keyword matches and wrap them in highlight spans.
 * @param {Text} textNode
 */
function processTextNode(textNode) {
    const text = textNode.textContent;
    if (!text || !keywordRegex) return;

    // Reset regex lastIndex
    keywordRegex.lastIndex = 0;

    const matches = [];
    let match;
    while ((match = keywordRegex.exec(text)) !== null) {
        matches.push({ index: match.index, length: match[0].length, text: match[0] });
    }

    if (matches.length === 0) return;

    // Build replacement fragment
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    for (const m of matches) {
        // Add text before this match
        if (m.index > lastIndex) {
            fragment.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));
        }

        // Create highlighted span
        const span = document.createElement('span');
        span.className = 'lorebook-entity';
        span.textContent = m.text;

        // Store the keyword for tooltip lookup
        const lower = m.text.toLowerCase();
        const entries = keywordEntryMap.get(lower);
        if (entries && entries.length > 0) {
            span.dataset.entryUid = String(entries[0].uid);
            span.dataset.keyword = lower;
            if (entries[0].world) {
                span.dataset.entryBook = entries[0].world;
            }
        }

        fragment.appendChild(span);
        lastIndex = m.index + m.length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    // Replace original text node
    textNode.parentNode.replaceChild(fragment, textNode);
}

// ============================================================================
// TOOLTIP
// ============================================================================

/**
 * Initialize the singleton tooltip element and attach global listeners.
 */
function initTooltip() {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'lorebook-tooltip';
    tooltipEl.style.display = 'none';
    document.body.appendChild(tooltipEl);

    // Keep tooltip visible when hovering over it
    tooltipEl.addEventListener('mouseenter', () => {
        clearTooltipHideTimer();
    });
    tooltipEl.addEventListener('mouseleave', () => {
        scheduleHideTooltip();
    });

    // Delegate mouseenter/mouseleave on .lorebook-entity elements
    document.addEventListener('mouseover', (e) => {
        const entity = e.target.closest?.('.lorebook-entity');
        if (!entity) return;
        clearTooltipHideTimer();
        showTooltip(entity);
    });

    document.addEventListener('mouseout', (e) => {
        const entity = e.target.closest?.('.lorebook-entity');
        if (!entity) return;
        // Check if we moved to the tooltip or another entity
        const related = e.relatedTarget;
        if (related && (related.closest?.('.lorebook-tooltip') || related.closest?.('.lorebook-entity'))) {
            return;
        }
        scheduleHideTooltip();
    });
}

/**
 * Show the tooltip for a highlighted entity element.
 * @param {HTMLElement} entityEl
 */
function showTooltip(entityEl) {
    if (!tooltipEl) return;

    const keyword = entityEl.dataset.keyword;
    if (!keyword) return;

    const entries = keywordEntryMap.get(keyword);
    if (!entries || entries.length === 0) return;

    const entry = entries[0]; // Use first matching entry

    // Build tooltip content
    let html = '<div class="lorebook-tooltip-header">';

    // Check if this entry's comment matches a character name (for avatar)
    const charMatch = entry.comment
        ? characters.find(c => c.name && c.name.toLowerCase() === entry.comment.toLowerCase())
        : null;

    if (charMatch && charMatch.avatar && charMatch.avatar !== 'none') {
        const avatarUrl = getThumbnailUrl('avatar', charMatch.avatar);
        html += `<img class="lorebook-tooltip-avatar" src="${avatarUrl}" alt="" onerror="this.style.display='none'">`;
    }

    html += '<div class="lorebook-tooltip-title-block">';
    html += `<div class="lorebook-tooltip-title">${escapeHtml(entry.comment || keyword)}</div>`;

    if (entry.group) {
        html += `<div class="lorebook-tooltip-group">${escapeHtml(entry.group)}</div>`;
    }

    html += '</div></div>'; // close title-block and header

    // Keywords
    if (entry.key && entry.key.length > 0) {
        const displayKeys = entry.key
            .filter(k => k && typeof k === 'string' && !k.startsWith('/'))
            .slice(0, 6)
            .map(k => escapeHtml(k.trim()));
        if (displayKeys.length > 0) {
            html += `<div class="lorebook-tooltip-keywords">Keywords: <span>${displayKeys.join(', ')}</span></div>`;
        }
    }

    // Content preview
    if (entry.content) {
        // Strip @@ decorators from content
        let preview = entry.content.replace(/^@@[^\n]*\n?/gm, '').trim();
        if (preview.length > MAX_CONTENT_PREVIEW) {
            preview = preview.slice(0, MAX_CONTENT_PREVIEW).trimEnd() + '…';
        }
        if (preview) {
            html += `<div class="lorebook-tooltip-content">${escapeHtml(preview)}</div>`;
        }
    } else {
        html += '<div class="lorebook-tooltip-content lorebook-tooltip-empty">No content</div>';
    }

    tooltipEl.innerHTML = html;
    tooltipEl.style.display = 'block';

    // Position the tooltip
    positionTooltip(entityEl);

    // Animate in
    requestAnimationFrame(() => {
        tooltipEl.classList.add('visible');
    });
}

/**
 * Position the tooltip near the entity element, preferring above, falling back to below.
 * @param {HTMLElement} entityEl
 */
function positionTooltip(entityEl) {
    if (!tooltipEl) return;

    const entityRect = entityEl.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();
    const padding = 8;

    let top, left;

    // Try above
    top = entityRect.top - tooltipRect.height - padding;
    if (top < padding) {
        // Place below
        top = entityRect.bottom + padding;
    }

    // Horizontal: center on entity, constrained to viewport
    left = entityRect.left + (entityRect.width / 2) - (tooltipRect.width / 2);
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipRect.width - padding));

    // Constrain bottom
    if (top + tooltipRect.height > window.innerHeight - padding) {
        top = window.innerHeight - tooltipRect.height - padding;
    }

    tooltipEl.style.top = `${top}px`;
    tooltipEl.style.left = `${left}px`;
}

/** Schedule hiding the tooltip after a delay. */
function scheduleHideTooltip() {
    clearTooltipHideTimer();
    tooltipHideTimer = setTimeout(() => {
        hideTooltip();
    }, TOOLTIP_HIDE_DELAY);
}

/** Clear the tooltip hide timer. */
function clearTooltipHideTimer() {
    if (tooltipHideTimer !== null) {
        clearTimeout(tooltipHideTimer);
        tooltipHideTimer = null;
    }
}

/** Hide and reset the tooltip. */
function hideTooltip() {
    if (!tooltipEl) return;
    tooltipEl.classList.remove('visible');
    // Wait for transition then hide
    setTimeout(() => {
        if (!tooltipEl.classList.contains('visible')) {
            tooltipEl.style.display = 'none';
        }
    }, 200);
}

/**
 * Escape HTML special characters.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ============================================================================
// INLINE CHARACTER SPEECH AVATARS
// ============================================================================

/**
 * Process a message's text element to insert inline avatars next to character speech.
 * Detects "CharacterName:" before <q> tags and inserts a small avatar circle.
 * @param {HTMLElement} mesTextEl - The .mes_text element
 * @param {HTMLElement} mesEl - The parent .mes element (for ch_name fallback)
 */
function insertInlineAvatars(mesTextEl, mesEl) {
    const qTags = mesTextEl.querySelectorAll('q');
    if (qTags.length === 0) return;

    const messageAuthor = mesEl?.getAttribute('ch_name') || '';
    const isUser = mesEl?.getAttribute('is_user') === 'true';

    // Don't process user messages
    if (isUser) return;

    for (const q of qTags) {
        // Skip if already has an inline avatar before it
        const prevSibling = q.previousSibling;
        if (prevSibling && prevSibling.nodeType === Node.ELEMENT_NODE &&
            /** @type {HTMLElement} */ (prevSibling).classList?.contains('inline-char-avatar')) {
            continue;
        }

        // Also check the previous element sibling
        const prevEl = q.previousElementSibling;
        if (prevEl && prevEl.classList?.contains('inline-char-avatar')) {
            continue;
        }

        // Try to extract character name from preceding text
        const speakerName = extractSpeakerBeforeQuote(q);

        let character = null;
        if (speakerName) {
            // Match against characters array (case-insensitive)
            character = characters.find(c =>
                c.name && c.name.toLowerCase() === speakerName.toLowerCase(),
            );
        }

        // If no explicit speaker name found, check if there are multiple quotes
        // For single-speaker messages (main avatar is visible), skip inserting
        if (!character && !speakerName) {
            // Only add avatar for the message author if there's a Name: pattern elsewhere
            // indicating multi-character dialogue. For pure single-character messages, skip.
            continue;
        }

        if (!character) continue;
        if (!character.avatar || character.avatar === 'none') continue;

        // Don't insert avatar if the speaker is the message author (avatar already visible)
        if (character.name.toLowerCase() === messageAuthor.toLowerCase()) continue;

        // Create and insert the inline avatar
        const img = document.createElement('img');
        img.className = 'inline-char-avatar';
        img.src = getThumbnailUrl('avatar', character.avatar);
        img.title = character.name;
        img.alt = character.name;
        img.onerror = function () { this.style.display = 'none'; };

        q.parentNode.insertBefore(img, q);
    }
}

/**
 * Extract a character/speaker name from the text immediately preceding a <q> element.
 * Looks for patterns like "CharName:" or "CharName :" before the quote.
 * @param {HTMLElement} qEl - The <q> element
 * @returns {string|null} The extracted speaker name, or null
 */
function extractSpeakerBeforeQuote(qEl) {
    // Walk backwards through previous siblings to find text content before the <q>
    let textBefore = '';
    let node = qEl.previousSibling;

    // Collect text from up to 3 preceding siblings (to handle cases with inline elements)
    let sibCount = 0;
    while (node && sibCount < 3) {
        if (node.nodeType === Node.TEXT_NODE) {
            textBefore = node.textContent + textBefore;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Don't cross block elements
            const tag = /** @type {HTMLElement} */ (node).tagName;
            if (['P', 'DIV', 'BR', 'HR', 'LI'].includes(tag)) break;
            // Skip other inline avatars
            if (/** @type {HTMLElement} */ (node).classList?.contains('inline-char-avatar')) break;
            textBefore = node.textContent + textBefore;
        }
        node = node.previousSibling;
        sibCount++;
    }

    if (!textBefore) return null;

    // Match "Name:" pattern at the end of preceding text
    // Supports names with spaces, hyphens, apostrophes; accented characters
    const nameMatch = textBefore.match(/([A-Za-zÀ-ÿ][\w\sÀ-ÿ'-]{0,30}?)\s*:\s*$/);
    if (nameMatch) {
        return nameMatch[1].trim();
    }

    return null;
}

// ============================================================================
// MESSAGE PROCESSING
// ============================================================================

/**
 * Process a single message by its ID: apply lorebook highlights and inline avatars.
 * @param {number|string} messageId - The message index
 */
function processMessage(messageId) {
    if (!enabled) return;

    const mesEl = document.querySelector(`.mes[mesid="${messageId}"]`);
    if (!mesEl) return;

    const mesTextEl = mesEl.querySelector('.mes_text');
    if (!mesTextEl) return;

    // Remove existing enhancements before re-processing (for swipes/edits)
    cleanEnhancements(mesTextEl);

    // Apply lorebook highlights
    highlightLorebookEntities(mesTextEl);

    // Apply inline speech avatars
    insertInlineAvatars(mesTextEl, mesEl);
}

/**
 * Remove existing enhancements from a message text element.
 * Unwrap lorebook-entity spans and remove inline avatars.
 * @param {HTMLElement} mesTextEl
 */
function cleanEnhancements(mesTextEl) {
    // Unwrap lorebook-entity spans (restore text)
    const entities = mesTextEl.querySelectorAll('.lorebook-entity');
    for (const entity of entities) {
        const parent = entity.parentNode;
        while (entity.firstChild) {
            parent.insertBefore(entity.firstChild, entity);
        }
        parent.removeChild(entity);
        parent.normalize(); // Merge adjacent text nodes
    }

    // Remove inline avatars
    const avatars = mesTextEl.querySelectorAll('.inline-char-avatar');
    for (const avatar of avatars) {
        avatar.remove();
    }
}

/**
 * Process all visible messages in the chat.
 */
function processAllMessages() {
    if (!enabled) return;

    const messages = document.querySelectorAll('.mes[mesid]');
    for (const mesEl of messages) {
        const messageId = mesEl.getAttribute('mesid');
        if (messageId !== null) {
            processMessage(messageId);
        }
    }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Handle message rendered events (CHARACTER_MESSAGE_RENDERED, USER_MESSAGE_RENDERED).
 * @param {number} messageId
 */
function onMessageRendered(messageId) {
    // Small delay to ensure DOM is fully ready
    requestAnimationFrame(() => {
        processMessage(messageId);
    });
}

/**
 * Handle message swiped/updated events.
 * @param {number} messageId
 */
function onMessageUpdated(messageId) {
    requestAnimationFrame(() => {
        processMessage(messageId);
    });
}

/**
 * Handle chat changed event — re-process all messages and rebuild cache.
 */
async function onChatChanged() {
    await buildKeywordCache();
    requestAnimationFrame(() => {
        processAllMessages();
    });
}

/**
 * Handle World Info updated event — rebuild the keyword cache and re-process.
 */
async function onWorldInfoUpdated() {
    await buildKeywordCache();
    requestAnimationFrame(() => {
        processAllMessages();
    });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the chat enhancements module.
 * Sets up event listeners, builds keyword cache, and processes existing messages.
 */
export function initChatEnhancements() {
    console.log(`${LOG_PREFIX} Initializing chat enhancements...`);

    // Create tooltip
    initTooltip();

    // Build initial keyword cache
    buildKeywordCache().then(() => {
        // Process any messages already rendered
        processAllMessages();
    });

    // Listen for new message renders
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, onMessageRendered);
    eventSource.on(event_types.USER_MESSAGE_RENDERED, onMessageRendered);

    // Listen for message updates (swipes, edits)
    eventSource.on(event_types.MESSAGE_SWIPED, onMessageUpdated);
    eventSource.on(event_types.MESSAGE_UPDATED, onMessageUpdated);

    // Listen for chat changes
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);

    // Listen for World Info changes
    eventSource.on(event_types.WORLDINFO_UPDATED, onWorldInfoUpdated);

    console.log(`${LOG_PREFIX} Chat enhancements initialized`);
}
