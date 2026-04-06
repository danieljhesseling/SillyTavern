/**
 * Dynamic Context Manager for D&D Campaigns
 *
 * Provides intelligent, state-aware filtering of instructions sent to the chatbot.
 * Instructions are categorized (combat, relationship, quest, location, item, lore, rules)
 * and conditionally included based on:
 *   - Campaign state (combat, exploration, social, rest)
 *   - Active character / group members
 *   - Keyword matches in recent messages
 *   - Priority-based token budgeting
 *
 * Data is stored in chat_metadata.dynamicContext and injected via the existing
 * setExtensionPrompt() pipeline with async filter callbacks.
 */

import {
    characters,
    this_chid,
    chat,
    chat_metadata,
    saveMetadata,
    setExtensionPrompt,
    extension_prompt_types,
    extension_prompt_roles,
    extension_prompts,
    substituteParams,
} from '../script.js';
import { selected_group, groups } from './group-chats.js';
import { getTokenCountAsync } from './tokenizers.js';
import { eventSource, event_types } from './events.js';
import { Popup, POPUP_TYPE, POPUP_RESULT } from './popup.js';
import { SlashCommandParser } from './slash-commands/SlashCommandParser.js';
import { SlashCommand } from './slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument } from './slash-commands/SlashCommandArgument.js';
import { SlashCommandEnumValue } from './slash-commands/SlashCommandEnumValue.js';
import { getPartyMembersSnapshot, getBoardContextSnapshot } from './party.js';
import { ToolManager } from './tool-calling.js';

// ─── Constants ──────────────────────────────────────────────────────────

const DYNAMIC_KEY_PREFIX = 'DYN_CTX_';

export const CAMPAIGN_STATES = ['idle', 'combat', 'exploration', 'social', 'rest', 'stealth', 'travel', 'shopping'];

export const INSTRUCTION_CATEGORIES = [
    'combat',
    'relationship',
    'quest',
    'location',
    'item',
    'lore',
    'rules',
    'npc',
    'custom',
];

const DEFAULT_TOKEN_BUDGET = 1500;
const DEFAULT_SCAN_DEPTH = 5;
const DEFAULT_PRIORITY = 5;

// ─── Data types ─────────────────────────────────────────────────────────

/**
 * @typedef {Object} DynamicInstruction
 * @property {string} id
 * @property {string} label
 * @property {string} text
 * @property {boolean} enabled
 * @property {string} category - One of INSTRUCTION_CATEGORIES
 * @property {number} priority - 1 (critical) to 10 (nice-to-have)
 * @property {string[]} targetCharacters - Character names this applies to (empty = all)
 * @property {string[]} excludeCharacters - Character names to exclude
 * @property {string[]} keywords - Activate when these appear in recent messages
 * @property {string[]} states - Activate only in these campaign states (empty = all)
 * @property {boolean} groupOnly - Only in group chats
 * @property {boolean} soloOnly - Only in 1-on-1 chats
 * @property {number} scanDepth - How many messages back to scan for keywords
 * @property {number|null} _tokenCache - Cached token count (transient)
 */

/**
 * @typedef {Object} CampaignState
 * @property {string} currentState - One of CAMPAIGN_STATES
 * @property {string} activeLocation - Current location name
 * @property {string[]} activeQuests - Active quest labels
 * @property {Object<string, any>} customFlags - Arbitrary condition flags
 * @property {number} tokenBudget - Max tokens for dynamic instructions
 */

// ─── Data access ────────────────────────────────────────────────────────

/**
 * Get or initialize the dynamic context data from chat_metadata.
 * @returns {{ instructions: DynamicInstruction[], campaign: CampaignState }}
 */
function getDynamicContext() {
    if (!chat_metadata.dynamicContext) {
        chat_metadata.dynamicContext = {
            instructions: [],
            campaign: getDefaultCampaignState(),
        };
    }
    const ctx = chat_metadata.dynamicContext;
    if (!ctx.campaign) ctx.campaign = getDefaultCampaignState();
    if (!Array.isArray(ctx.instructions)) ctx.instructions = [];
    return ctx;
}

/** @returns {CampaignState} */
function getDefaultCampaignState() {
    return {
        currentState: 'idle',
        activeLocation: '',
        activeQuests: [],
        customFlags: {},
        tokenBudget: DEFAULT_TOKEN_BUDGET,
    };
}

/** @returns {DynamicInstruction[]} */
export function getDynamicInstructions() {
    return getDynamicContext().instructions;
}

/** @returns {CampaignState} */
export function getCampaignState() {
    return getDynamicContext().campaign;
}

// ─── Filtering engine ───────────────────────────────────────────────────

/**
 * Get names of currently active characters (the one being spoken to, or all group members).
 * @returns {string[]}
 */
function getActiveCharacterNames() {
    if (selected_group) {
        const group = groups.find(g => g.id === selected_group);
        if (group && Array.isArray(group.members)) {
            return group.members
                .filter(m => !group.disabled_members?.includes(m))
                .map(avatar => characters.find(c => c.avatar === avatar)?.name)
                .filter(/** @param {any} n @returns {n is string} */ n => typeof n === 'string');
        }
    }
    const chid = Number(this_chid);
    if (!isNaN(chid) && characters[chid]) {
        return [characters[chid].name];
    }
    return [];
}

/**
 * Scan recent chat messages for keyword matches.
 * @param {string[]} keywords
 * @param {number} depth - How many messages back to scan
 * @returns {boolean} True if any keyword found
 */
function scanMessagesForKeywords(keywords, depth) {
    if (!keywords.length) return true; // No keywords = always active
    const messages = chat.slice(-depth);
    const buffer = messages.map(m => (m.mes || '')).join('\n').toLowerCase();
    return keywords.some(kw => {
        const kwLower = kw.toLowerCase().trim();
        if (!kwLower) return false;
        // Support simple regex if wrapped in /pattern/
        if (kwLower.startsWith('/') && kwLower.lastIndexOf('/') > 0) {
            try {
                const lastSlash = kwLower.lastIndexOf('/');
                const pattern = kwLower.slice(1, lastSlash);
                const flags = kwLower.slice(lastSlash + 1) || 'i';
                return new RegExp(pattern, flags).test(buffer);
            } catch { return false; }
        }
        return buffer.includes(kwLower);
    });
}

/**
 * Evaluate whether a single instruction should be active right now.
 * @param {DynamicInstruction} instr
 * @param {string[]} activeChars
 * @param {CampaignState} campaign
 * @returns {boolean}
 */
function evaluateInstruction(instr, activeChars, campaign) {
    if (!instr.enabled || !instr.text?.trim()) return false;

    // State filter
    if (instr.states?.length > 0 && !instr.states.includes(campaign.currentState)) {
        return false;
    }

    // Group / solo filter
    if (instr.groupOnly && !selected_group) return false;
    if (instr.soloOnly && selected_group) return false;

    // Character filter: target
    if (instr.targetCharacters?.length > 0) {
        const hasMatch = instr.targetCharacters.some(tc =>
            activeChars.some(ac => ac.toLowerCase() === tc.toLowerCase()),
        );
        if (!hasMatch) return false;
    }

    // Character filter: exclude
    if (instr.excludeCharacters?.length > 0) {
        const hasExclude = instr.excludeCharacters.some(ec =>
            activeChars.some(ac => ac.toLowerCase() === ec.toLowerCase()),
        );
        if (hasExclude) return false;
    }

    // Keyword filter (scan recent messages)
    if (instr.keywords?.length > 0) {
        const depth = instr.scanDepth || DEFAULT_SCAN_DEPTH;
        if (!scanMessagesForKeywords(instr.keywords, depth)) {
            return false;
        }
    }

    return true;
}

/**
 * Get all instructions that pass the current filters, sorted by priority,
 * and trimmed to fit within the token budget.
 * @returns {Promise<{ active: DynamicInstruction[], trimmed: DynamicInstruction[], totalTokens: number, budget: number }>}
 */
export async function getActiveDynamicInstructions() {
    const { instructions, campaign } = getDynamicContext();
    const activeChars = getActiveCharacterNames();

    // Filter
    const passing = instructions.filter(i => evaluateInstruction(i, activeChars, campaign));

    // Sort by priority (lower = more important)
    passing.sort((a, b) => (a.priority || DEFAULT_PRIORITY) - (b.priority || DEFAULT_PRIORITY));

    // Count tokens and trim to budget
    const budget = campaign.tokenBudget || DEFAULT_TOKEN_BUDGET;
    const active = [];
    const trimmed = [];
    let totalTokens = 0;

    for (const instr of passing) {
        let tokens = instr._tokenCache;
        if (tokens == null) {
            tokens = await getTokenCountAsync(instr.text);
            instr._tokenCache = tokens;
        }
        if (totalTokens + tokens <= budget) {
            totalTokens += tokens;
            active.push(instr);
        } else {
            trimmed.push(instr);
        }
    }

    return { active, trimmed, totalTokens, budget };
}

// ─── Injection ──────────────────────────────────────────────────────────

/**
 * Inject dynamic instructions into the extension prompt system.
 * Evaluates all conditions synchronously at injection time (called before generation).
 * Only instructions that pass all filters and fit the token budget are injected.
 */
export function injectDynamicInstructions() {
    const { instructions, campaign } = getDynamicContext();
    const activeChars = getActiveCharacterNames();
    const activeKeySet = new Set();

    let budgetUsed = 0;
    const budgetLimit = campaign.tokenBudget || DEFAULT_TOKEN_BUDGET;
    const injectedLog = [];
    const filteredLog = [];

    // Sort by priority for deterministic budget allocation (lower = more important)
    const sorted = [...instructions].sort((a, b) => (a.priority || DEFAULT_PRIORITY) - (b.priority || DEFAULT_PRIORITY));

    for (const instr of sorted) {
        const key = `${DYNAMIC_KEY_PREFIX}${instr.id}`;

        if (instr.enabled && instr.text?.trim() && evaluateInstruction(instr, activeChars, campaign)) {
            // Estimate tokens (use cache if available, otherwise rough estimate)
            const tokens = instr._tokenCache ?? Math.ceil(instr.text.length / 4);

            if (budgetUsed + tokens <= budgetLimit) {
                budgetUsed += tokens;
                const categoryTag = instr.category ? instr.category.toUpperCase() : 'CUSTOM';
                const promptText = `[DYN_${categoryTag}: ${instr.label}]\n${substituteParams(instr.text)}`;
                setExtensionPrompt(
                    key,
                    promptText,
                    extension_prompt_types.IN_PROMPT,
                    0,
                    false,
                    extension_prompt_roles.SYSTEM,
                );
                activeKeySet.add(key);
                injectedLog.push({ label: instr.label, category: instr.category, priority: instr.priority, tokens, text: promptText.substring(0, 120) });
            } else {
                // Over budget — clear this prompt
                setExtensionPrompt(key, '', extension_prompt_types.IN_PROMPT, 0);
                filteredLog.push({ label: instr.label, reason: 'over budget', tokens });
            }
        } else {
            // Doesn't pass filters or disabled — clear
            setExtensionPrompt(key, '', extension_prompt_types.IN_PROMPT, 0);
            if (instr.enabled && instr.text?.trim()) {
                filteredLog.push({ label: instr.label, reason: 'filter mismatch' });
            }
        }
    }

    // Clean orphan keys
    for (const key of Object.keys(extension_prompts)) {
        if (key.startsWith(DYNAMIC_KEY_PREFIX) && !activeKeySet.has(key)) {
            setExtensionPrompt(key, '', extension_prompt_types.IN_PROMPT, 0);
        }
    }

    // Console logging
    if (injectedLog.length > 0) {
        console.log(`[DCM] 📜 Instructions injected: ${injectedLog.length} | Budget: ${budgetUsed}/${budgetLimit} tokens`);
        for (const entry of injectedLog) {
            console.log(`[DCM]   ✅ [${entry.category}] "${entry.label}" (P${entry.priority}, ~${entry.tokens}t) → ${entry.text}...`);
        }
    } else {
        console.log(`[DCM] 📜 No instructions injected (${instructions.length} total, all filtered out or empty)`);
    }
    if (filteredLog.length > 0) {
        console.log(`[DCM]   ❌ Filtered out: ${filteredLog.map(f => `"${f.label}" (${f.reason})`).join(', ')}`);
    }
}

// ─── CRUD operations ────────────────────────────────────────────────────

/**
 * Create a new dynamic instruction with defaults.
 * @param {Partial<DynamicInstruction>} [overrides]
 * @returns {DynamicInstruction}
 */
export function createDynamicInstruction(overrides = {}) {
    const instr = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        label: 'New Instruction',
        text: '',
        enabled: true,
        category: 'custom',
        priority: DEFAULT_PRIORITY,
        targetCharacters: [],
        excludeCharacters: [],
        keywords: [],
        states: [],
        groupOnly: false,
        soloOnly: false,
        scanDepth: DEFAULT_SCAN_DEPTH,
        _tokenCache: null,
        ...overrides,
    };
    getDynamicContext().instructions.push(instr);
    return instr;
}

/**
 * Delete a dynamic instruction by ID.
 * @param {string} id
 */
export function deleteDynamicInstruction(id) {
    const ctx = getDynamicContext();
    const idx = ctx.instructions.findIndex(i => i.id === id);
    if (idx >= 0) {
        ctx.instructions.splice(idx, 1);
        setExtensionPrompt(`${DYNAMIC_KEY_PREFIX}${id}`, '', extension_prompt_types.IN_PROMPT, 0);
    }
}

/**
 * Update campaign state fields.
 * @param {Partial<CampaignState>} updates
 */
export function updateCampaignState(updates) {
    const campaign = getCampaignState();
    Object.assign(campaign, updates);
    // Invalidate token caches when state changes (filter results may differ)
    getDynamicContext().instructions.forEach(i => { i._tokenCache = null; });
}

// ─── Auto-detection (optional) ──────────────────────────────────────────

const COMBAT_TRIGGERS = [
    /roll\s+initiative/i,
    /combat\s+begins/i,
    /draws?\s+(his|her|their|a)\s+weapon/i,
    /attacks?\s+/i,
    /initiative\s+order/i,
    /¡?combate!/i,
    /lanza(r|n)?\s+iniciativa/i,
    /sword\s+clash/i,
    /swings?\s+(his|her|their|a)\s+(sword|axe|mace|weapon)/i,
    /cast(s|ing)?\s+(fireball|magic\s+missile|spell)/i,
    /¡?al\s+ataque!/i,
    /prepara(n|d)?\s+(sus?\s+)?(armas?|escudo)/i,
];

const COMBAT_END_TRIGGERS = [
    /combat\s+ends/i,
    /the\s+battle\s+is\s+over/i,
    /sheathes?\s+(his|her|their)\s+weapon/i,
    /fin\s+del?\s+combate/i,
    /la\s+batalla\s+ha\s+terminado/i,
    /enemies?\s+(are|is)\s+(defeated|slain)/i,
    /victoria!/i,
    /enemigos?\s+(derrotados?|vencidos?)/i,
    /the\s+threat\s+has\s+passed/i,
];

const SOCIAL_TRIGGERS = [
    /let('s|us)\s+talk/i,
    /conversation\s+with/i,
    /speaks?\s+to\s+you/i,
    /hablemos/i,
    /conversaci[oó]n/i,
    /greets?\s+you/i,
    /introduces?\s+(himself|herself|themselves)/i,
    /te\s+saluda/i,
    /se\s+presenta/i,
    /negotiate|bargain|diplomacy/i,
    /negociar?|diplomacia/i,
];

const EXPLORATION_TRIGGERS = [
    /you\s+arrive\s+at/i,
    /entering\s+the/i,
    /explore\s+the/i,
    /llegas?\s+a/i,
    /entras?\s+(en|al)/i,
    /exploras?/i,
    /you\s+find\s+(yourself|a|an|the)/i,
    /discover\s+(a|an|the)/i,
    /descubres?/i,
    /encuentras?/i,
];

const REST_TRIGGERS = [
    /long\s+rest/i,
    /short\s+rest/i,
    /descanso\s+(largo|corto)/i,
    /make\s+camp/i,
    /acampan/i,
    /set\s+up\s+camp/i,
    /toman?\s+un\s+descanso/i,
    /rest\s+for\s+the\s+night/i,
    /descansan?\s+(por\s+la\s+noche|hasta\s+el\s+amanecer)/i,
];

const STEALTH_TRIGGERS = [
    /sneak(s|ing)?\s/i,
    /hide(s)?\s+(in|behind|under)/i,
    /stealth\s+check/i,
    /moves?\s+quietly/i,
    /infiltrate/i,
    /sigilo(so|sa)?/i,
    /se\s+esconde/i,
    /se\s+mueve(n)?\s+(sigilosamente|en\s+silencio)/i,
    /escabullirse/i,
];

const TRAVEL_TRIGGERS = [
    /travel(s|ing|led)?\s+(to|toward|north|south|east|west)/i,
    /on\s+the\s+road/i,
    /journey\s+(to|toward)/i,
    /set\s+out\s+(for|toward)/i,
    /viajan?(do)?\s+(a|hacia)/i,
    /en\s+(el\s+)?camino/i,
    /emprenden?\s+(el\s+)?viaje/i,
    /parten?\s+hacia/i,
];

const SHOPPING_TRIGGERS = [
    /shop(s|ping)?/i,
    /merchant|vendor|trader/i,
    /buy(s|ing)?|sell(s|ing)?|purchase/i,
    /tienda|mercader|vendedor/i,
    /compra(r|n|s)?|vende(r|n|s)?/i,
    /browse\s+(the\s+)?(wares|goods|items)/i,
    /mira(r|n)?\s+(los\s+)?(productos|artículos|mercancía)/i,
];

/**
 * Analyze a message for state change hints. Returns suggested state or null.
 * @param {string} message
 * @returns {string|null}
 */
function detectStateFromMessage(message) {
    if (!message) return null;
    if (COMBAT_TRIGGERS.some(r => r.test(message))) return 'combat';
    if (COMBAT_END_TRIGGERS.some(r => r.test(message))) return 'exploration';
    if (REST_TRIGGERS.some(r => r.test(message))) return 'rest';
    if (SOCIAL_TRIGGERS.some(r => r.test(message))) return 'social';
    if (STEALTH_TRIGGERS.some(r => r.test(message))) return 'stealth';
    if (TRAVEL_TRIGGERS.some(r => r.test(message))) return 'travel';
    if (SHOPPING_TRIGGERS.some(r => r.test(message))) return 'shopping';
    if (EXPLORATION_TRIGGERS.some(r => r.test(message))) return 'exploration';
    return null;
}

/**
 * Try to extract a location name from a message.
 * @param {string} message
 * @returns {string|null}
 */
function detectLocationFromMessage(message) {
    if (!message) return null;
    const patterns = [
        /(?:you\s+arrive\s+at|entering|you\s+enter|welcome\s+to|you\s+reach)\s+(?:the\s+)?["']?([A-Z][^.!?\n"']{2,40})["']?/i,
        /(?:llegas?\s+a|entras?\s+(?:en|al)|bienvenidos?\s+a)\s+(?:la\s+|el\s+|los\s+|las\s+)?["']?([A-ZÁÉÍÓÚÑ][^.!?\n"']{2,40})["']?/i,
    ];
    for (const re of patterns) {
        const m = re.exec(message);
        if (m && m[1]) {
            return m[1].trim().replace(/[.,;:!?]+$/, '');
        }
    }
    return null;
}

/** Auto-detect enabled flag (stored in campaign state) */
let autoDetectEnabled = true;

function setupAutoDetection() {
    eventSource.on(event_types.MESSAGE_RECEIVED, (/** @type {number} */ messageIndex) => {
        if (!autoDetectEnabled) return;
        const msg = chat[messageIndex];
        if (!msg) return;
        const text = msg.mes || '';

        // State detection
        const suggested = detectStateFromMessage(text);
        if (suggested && suggested !== getCampaignState().currentState) {
            const oldState = getCampaignState().currentState;
            updateCampaignState({ currentState: suggested });
            injectAllDynamicContext();
            saveMetadata();
            console.log(`[DCM] 🔄 Auto-detected state change: "${oldState}" → "${suggested}"`);
            if (typeof toastr !== 'undefined') {
                toastr.info(
                    `Campaign state: "${oldState}" → "${suggested}"`,
                    'Dynamic Context — Auto Update',
                    { timeOut: 5000 },
                );
            }
        }

        // Location detection
        const detectedLocation = detectLocationFromMessage(text);
        if (detectedLocation && detectedLocation !== getCampaignState().activeLocation) {
            const oldLoc = getCampaignState().activeLocation;
            updateCampaignState({ activeLocation: detectedLocation });
            injectAllDynamicContext();
            saveMetadata();
            console.log(`[DCM] 📍 Auto-detected location: "${oldLoc || '(none)'}" → "${detectedLocation}"`);
            if (typeof toastr !== 'undefined') {
                toastr.info(
                    `Location: "${detectedLocation}"`,
                    'Dynamic Context — Auto Update',
                    { timeOut: 5000 },
                );
            }
        }
    });

    // ─── Message scanner for structured tags from AI ─────────────
    setupMessageScanner();
}

// ─── Message Scanner (AI self-update via structured tags) ───────────────

/**
 * Regex patterns that scan AI responses for structured update tags.
 * These allow the AI to directly modify campaign state, quests, location, and flags.
 */
const TAG_PATTERNS = {
    state:          /\[(?:STATE|ESTADO)\s*:\s*([^\]]+)\]/gi,
    location:       /\[(?:LOCATION|UBICACI[OÓ]N)\s*:\s*([^\]]+)\]/gi,
    questAdd:       /\[(?:QUEST_ADD|MISI[OÓ]N_NUEVA|NEW_QUEST)\s*:\s*([^\]]+)\]/gi,
    questComplete:  /\[(?:QUEST_COMPLETE|MISI[OÓ]N_COMPLETA|QUEST_DONE)\s*:\s*([^\]]+)\]/gi,
    questRemove:    /\[(?:QUEST_REMOVE|MISI[OÓ]N_ELIMINAR)\s*:\s*([^\]]+)\]/gi,
    flag:           /\[(?:FLAG|BANDERA)\s*:\s*([^\]=]+)=([^\]]*)\]/gi,
    flagRemove:     /\[(?:FLAG_REMOVE|BANDERA_ELIMINAR)\s*:\s*([^\]]+)\]/gi,
    addInstruction: /\[(?:INSTRUCTION|INSTRUCCIÓN)\s*:\s*([^\]|]+)\|([^\]|]+)(?:\|([^\]]+))?\]/gi,
    removeInstruction: /\[(?:REMOVE_INSTRUCTION|ELIMINAR_INSTRUCCIÓN)\s*:\s*([^\]]+)\]/gi,
};

/**
 * Scan a message for structured update tags and apply them.
 * @param {string} text
 * @returns {{ updates: string[], stripped: string }}
 */
function scanMessageForUpdates(text) {
    if (!text) return { updates: [], stripped: text };

    const updates = [];
    const campaign = getCampaignState();
    let modified = false;

    // [STATE: combat] / [ESTADO: combate]
    let match;
    const stateRe = new RegExp(TAG_PATTERNS.state.source, TAG_PATTERNS.state.flags);
    while ((match = stateRe.exec(text)) !== null) {
        const newState = match[1].trim().toLowerCase();
        if (CAMPAIGN_STATES.includes(newState) || newState.startsWith('custom:')) {
            const old = campaign.currentState;
            updateCampaignState({ currentState: newState });
            updates.push(`State: "${old}" → "${newState}"`);
            modified = true;
        }
    }

    // [LOCATION: Dragon's Lair] / [UBICACIÓN: ...]
    const locRe = new RegExp(TAG_PATTERNS.location.source, TAG_PATTERNS.location.flags);
    while ((match = locRe.exec(text)) !== null) {
        const newLoc = match[1].trim();
        if (newLoc) {
            const old = campaign.activeLocation;
            updateCampaignState({ activeLocation: newLoc });
            updates.push(`Location: "${old || '(none)'}" → "${newLoc}"`);
            modified = true;
        }
    }

    // [QUEST_ADD: Find the dragon] / [MISIÓN_NUEVA: ...]
    const qaRe = new RegExp(TAG_PATTERNS.questAdd.source, TAG_PATTERNS.questAdd.flags);
    while ((match = qaRe.exec(text)) !== null) {
        const quest = match[1].trim();
        if (quest && !campaign.activeQuests.includes(quest)) {
            campaign.activeQuests.push(quest);
            updates.push(`Quest added: "${quest}"`);
            modified = true;
        }
    }

    // [QUEST_COMPLETE: Find the dragon] / [MISIÓN_COMPLETA: ...]
    const qcRe = new RegExp(TAG_PATTERNS.questComplete.source, TAG_PATTERNS.questComplete.flags);
    while ((match = qcRe.exec(text)) !== null) {
        const quest = match[1].trim();
        const idx = campaign.activeQuests.findIndex(q => q.toLowerCase() === quest.toLowerCase());
        if (idx >= 0) {
            campaign.activeQuests.splice(idx, 1);
            updates.push(`Quest completed: "${quest}"`);
            modified = true;
        }
    }

    // [QUEST_REMOVE: ...]
    const qrRe = new RegExp(TAG_PATTERNS.questRemove.source, TAG_PATTERNS.questRemove.flags);
    while ((match = qrRe.exec(text)) !== null) {
        const quest = match[1].trim();
        const idx = campaign.activeQuests.findIndex(q => q.toLowerCase() === quest.toLowerCase());
        if (idx >= 0) {
            campaign.activeQuests.splice(idx, 1);
            updates.push(`Quest removed: "${quest}"`);
            modified = true;
        }
    }

    // [FLAG: key=value] / [BANDERA: key=value]
    const fRe = new RegExp(TAG_PATTERNS.flag.source, TAG_PATTERNS.flag.flags);
    while ((match = fRe.exec(text)) !== null) {
        const key = match[1].trim();
        const val = match[2].trim();
        if (key) {
            campaign.customFlags[key] = val || true;
            updates.push(`Flag set: ${key}=${val || 'true'}`);
            modified = true;
        }
    }

    // [FLAG_REMOVE: key]
    const frRe = new RegExp(TAG_PATTERNS.flagRemove.source, TAG_PATTERNS.flagRemove.flags);
    while ((match = frRe.exec(text)) !== null) {
        const key = match[1].trim();
        if (key && key in campaign.customFlags) {
            delete campaign.customFlags[key];
            updates.push(`Flag removed: ${key}`);
            modified = true;
        }
    }

    // [INSTRUCTION: label|text|category] — adds a new dynamic instruction
    const aiRe = new RegExp(TAG_PATTERNS.addInstruction.source, TAG_PATTERNS.addInstruction.flags);
    while ((match = aiRe.exec(text)) !== null) {
        const label = match[1].trim();
        const instrText = match[2].trim();
        const category = (match[3] || 'custom').trim().toLowerCase();
        if (label && instrText) {
            // Check if instruction with same label already exists
            const existing = getDynamicInstructions().find(i => i.label.toLowerCase() === label.toLowerCase());
            if (existing) {
                existing.text = instrText;
                existing._tokenCache = null;
                updates.push(`Instruction updated: "${label}"`);
            } else {
                createDynamicInstruction({ label, text: instrText, category, priority: DEFAULT_PRIORITY });
                updates.push(`Instruction created: "${label}" [${category}]`);
            }
            modified = true;
        }
    }

    // [REMOVE_INSTRUCTION: label]
    const riRe = new RegExp(TAG_PATTERNS.removeInstruction.source, TAG_PATTERNS.removeInstruction.flags);
    while ((match = riRe.exec(text)) !== null) {
        const label = match[1].trim();
        const instr = getDynamicInstructions().find(i => i.label.toLowerCase() === label.toLowerCase());
        if (instr) {
            deleteDynamicInstruction(instr.id);
            updates.push(`Instruction removed: "${label}"`);
            modified = true;
        }
    }

    if (modified) {
        injectAllDynamicContext();
        saveMetadata();
    }

    return { updates, stripped: text };
}

/**
 * Set up the message scanner that hooks into CHARACTER_MESSAGE_RENDERED events.
 * This is the fallback mechanism for models without tool calling support.
 */
function setupMessageScanner() {
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (/** @type {number} */ messageIndex) => {
        const msg = chat[messageIndex];
        if (!msg?.mes || msg.is_user) return;

        const { updates } = scanMessageForUpdates(msg.mes);

        if (updates.length > 0) {
            console.log(`[DCM] 🤖 AI auto-updates from message #${messageIndex}:`);
            for (const u of updates) {
                console.log(`[DCM]   → ${u}`);
            }
            if (typeof toastr !== 'undefined') {
                toastr.success(
                    updates.join('<br>'),
                    'Dynamic Context — AI Update',
                    { timeOut: 8000, escapeHtml: false },
                );
            }
        }
    });
}

// ─── Meta-instruction (tells AI about available update mechanisms) ──────

/** Whether the meta-instruction that teaches the AI about tags is enabled */
let metaInstructionEnabled = true;

const META_INSTRUCTION_TEXT = `[SYSTEM: DYNAMIC CONTEXT UPDATE CAPABILITIES]
You can update the campaign state by including special tags in your responses. These tags will be automatically parsed and applied. Use them when the narrative naturally calls for it — do NOT use them in every message, only when something meaningful changes.

Available tags (use sparingly and naturally within your narration):
- [STATE: <state>] — Change campaign state. Values: idle, combat, exploration, social, rest, stealth, travel, shopping
- [LOCATION: <name>] — Update the current location when characters move to a new place
- [QUEST_ADD: <name>] — Add a new quest when the story introduces one
- [QUEST_COMPLETE: <name>] — Mark a quest as completed
- [QUEST_REMOVE: <name>] — Remove a quest
- [FLAG: <key>=<value>] — Set a campaign flag (useful for tracking story variables)
- [FLAG_REMOVE: <key>] — Remove a campaign flag
- [INSTRUCTION: <label>|<text>|<category>] — Add/update a context instruction. Categories: combat, relationship, quest, location, item, lore, rules, npc, custom
- [REMOVE_INSTRUCTION: <label>] — Remove a context instruction by label

Spanish equivalents also work: [ESTADO:], [UBICACIÓN:], [MISIÓN_NUEVA:], [MISIÓN_COMPLETA:], [BANDERA:], [INSTRUCCIÓN:], [ELIMINAR_INSTRUCCIÓN:]

IMPORTANT: Place tags at the END of your message, after the narrative text. Do NOT overuse them.`;

/**
 * Inject the meta-instruction that teaches the AI about the tag system.
 * Injected as a low-priority system prompt so it's trimmed when budget is tight.
 */
function injectMetaInstruction() {
    if (metaInstructionEnabled) {
        setExtensionPrompt(
            'DYN_META_INSTRUCTION',
            META_INSTRUCTION_TEXT,
            extension_prompt_types.IN_PROMPT,
            2, // depth 2 — closer to the end of context
            false,
            extension_prompt_roles.SYSTEM,
        );
        console.log('[DCM] 📋 Meta-instruction injected (AI knows about update tags)');
    } else {
        setExtensionPrompt('DYN_META_INSTRUCTION', '', extension_prompt_types.IN_PROMPT, 0);
    }
}

// ─── ToolManager Integration (AI native tool calls) ─────────────────────

/**
 * Register D&D campaign tools via SillyTavern's ToolManager.
 * These allow models with function-calling support to directly update campaign state.
 */
function registerCampaignTools() {
    // Tool: Update campaign state
    ToolManager.registerFunctionTool({
        name: 'dnd_update_state',
        displayName: 'D&D: Update Campaign State',
        description: 'Change the current D&D campaign state (e.g. combat, exploration, social, rest, stealth, travel, shopping). Use this when the narrative moves to a different phase.',
        parameters: {
            type: 'object',
            properties: {
                state: {
                    type: 'string',
                    description: 'The new campaign state',
                    enum: CAMPAIGN_STATES,
                },
            },
            required: ['state'],
        },
        action: async (/** @type {{ state: string }} */ params) => {
            const old = getCampaignState().currentState;
            updateCampaignState({ currentState: params.state });
            injectAllDynamicContext();
            await saveMetadata();
            console.log(`[DCM] 🔧 Tool call: dnd_update_state("${params.state}") — was "${old}"`);
            if (typeof toastr !== 'undefined') toastr.info(`State: "${old}" → "${params.state}"`, 'DCM Tool');
            return `Campaign state updated from "${old}" to "${params.state}"`;
        },
        stealth: true,
    });

    // Tool: Set location
    ToolManager.registerFunctionTool({
        name: 'dnd_set_location',
        displayName: 'D&D: Set Location',
        description: 'Set the current location in the D&D campaign. Use when characters move to a new place.',
        parameters: {
            type: 'object',
            properties: {
                location: {
                    type: 'string',
                    description: 'The name of the new location',
                },
            },
            required: ['location'],
        },
        action: async (/** @type {{ location: string }} */ params) => {
            const old = getCampaignState().activeLocation;
            updateCampaignState({ activeLocation: params.location });
            injectAllDynamicContext();
            await saveMetadata();
            console.log(`[DCM] 🔧 Tool call: dnd_set_location("${params.location}") — was "${old || '(none)'}"`);
            if (typeof toastr !== 'undefined') toastr.info(`Location: "${params.location}"`, 'DCM Tool');
            return `Location updated to "${params.location}"`;
        },
        stealth: true,
    });

    // Tool: Manage quests
    ToolManager.registerFunctionTool({
        name: 'dnd_manage_quest',
        displayName: 'D&D: Manage Quest',
        description: 'Add, remove, or complete a quest in the D&D campaign.',
        parameters: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    description: 'The action to perform',
                    enum: ['add', 'remove', 'complete'],
                },
                quest: {
                    type: 'string',
                    description: 'The quest name or description',
                },
            },
            required: ['action', 'quest'],
        },
        action: async (/** @type {{ action: string, quest: string }} */ params) => {
            const campaign = getCampaignState();
            let result = '';
            if (params.action === 'add') {
                if (!campaign.activeQuests.includes(params.quest)) {
                    campaign.activeQuests.push(params.quest);
                    result = `Quest added: "${params.quest}"`;
                } else {
                    result = `Quest already exists: "${params.quest}"`;
                }
            } else if (params.action === 'remove' || params.action === 'complete') {
                const idx = campaign.activeQuests.findIndex(q => q.toLowerCase() === params.quest.toLowerCase());
                if (idx >= 0) {
                    campaign.activeQuests.splice(idx, 1);
                    result = `Quest ${params.action === 'complete' ? 'completed' : 'removed'}: "${params.quest}"`;
                } else {
                    result = `Quest not found: "${params.quest}"`;
                }
            }
            injectAllDynamicContext();
            await saveMetadata();
            console.log(`[DCM] 🔧 Tool call: dnd_manage_quest(${params.action}, "${params.quest}") → ${result}`);
            if (typeof toastr !== 'undefined') toastr.info(result, 'DCM Tool');
            return result;
        },
        stealth: true,
    });

    // Tool: Set flag
    ToolManager.registerFunctionTool({
        name: 'dnd_set_flag',
        displayName: 'D&D: Set Campaign Flag',
        description: 'Set a custom campaign flag to track story variables, conditions, or events.',
        parameters: {
            type: 'object',
            properties: {
                flag: {
                    type: 'string',
                    description: 'The flag name/key',
                },
                value: {
                    type: 'string',
                    description: 'The flag value (use "true"/"false" for boolean flags)',
                },
            },
            required: ['flag', 'value'],
        },
        action: async (/** @type {{ flag: string, value: string }} */ params) => {
            const campaign = getCampaignState();
            campaign.customFlags[params.flag] = params.value;
            injectAllDynamicContext();
            await saveMetadata();
            console.log(`[DCM] 🔧 Tool call: dnd_set_flag("${params.flag}", "${params.value}")`);
            if (typeof toastr !== 'undefined') toastr.info(`Flag: ${params.flag}=${params.value}`, 'DCM Tool');
            return `Flag set: ${params.flag} = ${params.value}`;
        },
        stealth: true,
    });

    // Tool: Add/update dynamic instruction
    ToolManager.registerFunctionTool({
        name: 'dnd_add_instruction',
        displayName: 'D&D: Add Context Instruction',
        description: 'Create or update a dynamic context instruction that will be sent to the AI when conditions are met. Use this to store important campaign context, NPC details, lore, rules, etc.',
        parameters: {
            type: 'object',
            properties: {
                label: {
                    type: 'string',
                    description: 'A short label for the instruction (e.g. "Goblin King Personality")',
                },
                text: {
                    type: 'string',
                    description: 'The instruction text/context to inject',
                },
                category: {
                    type: 'string',
                    description: 'The category of this instruction',
                    enum: [...INSTRUCTION_CATEGORIES],
                },
                priority: {
                    type: 'number',
                    description: 'Priority 1-10, lower = more important. Default: 5',
                },
                targetCharacters: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Only apply when chatting with these characters (empty = all)',
                },
                states: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Only active in these campaign states (empty = all)',
                },
                keywords: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Activate when these keywords appear in recent messages',
                },
            },
            required: ['label', 'text', 'category'],
        },
        action: async (/** @type {Partial<DynamicInstruction> & { label: string, text: string, category: string }} */ params) => {
            // Check if exists by label
            const existing = getDynamicInstructions().find(i => i.label.toLowerCase() === params.label.toLowerCase());
            if (existing) {
                Object.assign(existing, {
                    text: params.text,
                    category: params.category || existing.category,
                    priority: params.priority ?? existing.priority,
                    targetCharacters: params.targetCharacters || existing.targetCharacters,
                    states: params.states || existing.states,
                    keywords: params.keywords || existing.keywords,
                    _tokenCache: null,
                });
                injectAllDynamicContext();
                await saveMetadata();
                console.log(`[DCM] 🔧 Tool call: dnd_add_instruction — updated "${params.label}" [${params.category}]`);
                if (typeof toastr !== 'undefined') toastr.info(`Updated: "${params.label}"`, 'DCM Tool');
                return `Instruction updated: "${params.label}"`;
            }
            const instr = createDynamicInstruction({
                label: params.label,
                text: params.text,
                category: params.category || 'custom',
                priority: params.priority ?? DEFAULT_PRIORITY,
                targetCharacters: params.targetCharacters || [],
                states: params.states || [],
                keywords: params.keywords || [],
            });
            injectAllDynamicContext();
            await saveMetadata();
            console.log(`[DCM] 🔧 Tool call: dnd_add_instruction — created "${params.label}" [${params.category}] (id: ${instr.id})`);
            if (typeof toastr !== 'undefined') toastr.info(`Created: "${params.label}"`, 'DCM Tool');
            return `Instruction created: "${params.label}" (id: ${instr.id})`;
        },
        stealth: true,
    });

    // Tool: Update existing instruction
    ToolManager.registerFunctionTool({
        name: 'dnd_update_instruction',
        displayName: 'D&D: Update Context Instruction',
        description: 'Modify an existing dynamic context instruction by its ID or label.',
        parameters: {
            type: 'object',
            properties: {
                id: {
                    type: 'string',
                    description: 'The instruction ID (or label as fallback)',
                },
                updates: {
                    type: 'object',
                    description: 'Fields to update',
                    properties: {
                        label: { type: 'string' },
                        text: { type: 'string' },
                        category: { type: 'string' },
                        priority: { type: 'number' },
                        enabled: { type: 'boolean' },
                        targetCharacters: { type: 'array', items: { type: 'string' } },
                        excludeCharacters: { type: 'array', items: { type: 'string' } },
                        states: { type: 'array', items: { type: 'string' } },
                        keywords: { type: 'array', items: { type: 'string' } },
                    },
                },
            },
            required: ['id', 'updates'],
        },
        action: async (/** @type {{ id: string, updates: Partial<DynamicInstruction> }} */ params) => {
            let instr = getDynamicInstructions().find(i => i.id === params.id);
            if (!instr) {
                instr = getDynamicInstructions().find(i => i.label.toLowerCase() === params.id.toLowerCase());
            }
            if (!instr) return `Instruction not found: "${params.id}"`;
            Object.assign(instr, params.updates, { _tokenCache: null });
            injectAllDynamicContext();
            await saveMetadata();
            console.log(`[DCM] 🔧 Tool call: dnd_update_instruction("${instr.label}") — updated fields: ${Object.keys(params.updates).join(', ')}`);
            if (typeof toastr !== 'undefined') toastr.info(`Updated: "${instr.label}"`, 'DCM Tool');
            return `Instruction updated: "${instr.label}"`;
        },
        stealth: true,
    });

    // Tool: Remove instruction
    ToolManager.registerFunctionTool({
        name: 'dnd_remove_instruction',
        displayName: 'D&D: Remove Context Instruction',
        description: 'Remove a dynamic context instruction by its ID or label.',
        parameters: {
            type: 'object',
            properties: {
                id: {
                    type: 'string',
                    description: 'The instruction ID or label to remove',
                },
            },
            required: ['id'],
        },
        action: async (/** @type {{ id: string }} */ params) => {
            let instr = getDynamicInstructions().find(i => i.id === params.id);
            if (!instr) {
                instr = getDynamicInstructions().find(i => i.label.toLowerCase() === params.id.toLowerCase());
            }
            if (!instr) return `Instruction not found: "${params.id}"`;
            const label = instr.label;
            deleteDynamicInstruction(instr.id);
            injectAllDynamicContext();
            await saveMetadata();
            console.log(`[DCM] 🔧 Tool call: dnd_remove_instruction("${label}")`);
            if (typeof toastr !== 'undefined') toastr.info(`Removed: "${label}"`, 'DCM Tool');
            return `Instruction removed: "${label}"`;
        },
        stealth: true,
    });

    // Tool: Get campaign status (read-only)
    ToolManager.registerFunctionTool({
        name: 'dnd_get_campaign_status',
        displayName: 'D&D: Get Campaign Status',
        description: 'Get the current campaign state, active location, quests, flags, and a summary of active instructions. Use to understand the current context before making decisions.',
        parameters: {
            type: 'object',
            properties: {},
        },
        action: async () => {
            const campaign = getCampaignState();
            const instructions = getDynamicInstructions();
            const activeChars = getActiveCharacterNames();
            const status = {
                state: campaign.currentState,
                location: campaign.activeLocation || '(none)',
                quests: campaign.activeQuests,
                flags: campaign.customFlags,
                activeCharacters: activeChars,
                tokenBudget: campaign.tokenBudget,
                instructions: instructions.filter(i => i.enabled).map(i => ({
                    id: i.id,
                    label: i.label,
                    category: i.category,
                    priority: i.priority,
                })),
            };
            console.log('[DCM] 🔧 Tool call: dnd_get_campaign_status →', status);
            return JSON.stringify(status, null, 2);
        },
        stealth: true,
    });

    console.log('[DCM] 🔧 Registered 8 campaign tools with ToolManager');
}

// ─── Relationship context builder ───────────────────────────────────────

/**
 * Build relationship context for the currently active character(s).
 * Pulls from party member relationship data.
 * @returns {string}
 */
export function buildRelationshipContext() {
    const partyMembers = getPartyMembersSnapshot();
    if (!partyMembers.length) return '';

    const activeChars = getActiveCharacterNames();
    if (!activeChars.length) return '';

    const lines = [];

    for (const member of partyMembers) {
        if (!Array.isArray(member.relationships)) continue;
        const relevant = member.relationships.filter(r =>
            activeChars.some(ac => ac.toLowerCase() === r.characterName?.toLowerCase()),
        );
        for (const rel of relevant) {
            lines.push(`${member.name} → ${rel.characterName}: ${rel.type || rel.category || 'neutral'} (score: ${rel.score ?? 0})${rel.description ? ' - ' + rel.description : ''}`);
        }
    }

    return lines.length ? lines.join('\n') : '';
}

/**
 * Inject relationship context for active characters only.
 */
export function injectRelationshipContext() {
    const ctx = buildRelationshipContext();
    if (ctx) {
        setExtensionPrompt(
            'DYN_RELATIONSHIPS',
            `[SYSTEM: ACTIVE RELATIONSHIPS]\n${ctx}`,
            extension_prompt_types.IN_PROMPT,
            0,
            false,
            extension_prompt_roles.SYSTEM,
        );
        console.log(`[DCM] 💕 Relationships injected (${ctx.split('\n').length} entries):\n${ctx}`);
    } else {
        setExtensionPrompt('DYN_RELATIONSHIPS', '', extension_prompt_types.IN_PROMPT, 0);
        console.log('[DCM] 💕 No relevant relationships for current character(s)');
    }
}

// ─── Quest context builder ──────────────────────────────────────────────

/**
 * Inject active quests context.
 */
export function injectQuestContext() {
    const campaign = getCampaignState();
    if (campaign.activeQuests?.length > 0) {
        const lines = campaign.activeQuests.map((q, i) => `${i + 1}. ${q}`);
        setExtensionPrompt(
            'DYN_QUESTS',
            `[SYSTEM: ACTIVE QUESTS]\n${lines.join('\n')}`,
            extension_prompt_types.IN_PROMPT,
            0,
            false,
            extension_prompt_roles.SYSTEM,
        );
        console.log(`[DCM] 🗺️ Quests injected: ${campaign.activeQuests.join(', ')}`);
    } else {
        setExtensionPrompt('DYN_QUESTS', '', extension_prompt_types.IN_PROMPT, 0);
        console.log('[DCM] 🗺️ No active quests');
    }
}

// ─── Board / location context ───────────────────────────────────────────

/**
 * Build context string describing who is present on the current board/location.
 * Includes party members, NPCs, and combat enemies.
 * @returns {string}
 */
export function buildBoardContext() {
    const board = getBoardContextSnapshot();
    if (!board.locationName) return '';

    const lines = [];
    lines.push(`Ubicación actual: ${board.locationName}`);
    if (board.boardName) {
        lines.push(`Tablero: ${board.boardName}`);
    }

    if (board.partyTokens.length > 0) {
        const names = board.partyTokens.map(t => t.name).join(', ');
        lines.push(`Miembros del grupo presentes: ${names}`);
    }

    if (board.npcTokens.length > 0) {
        const names = board.npcTokens.map(t => t.name).join(', ');
        lines.push(`NPCs presentes: ${names}`);
    }

    if (board.enemyTokens.length > 0) {
        const names = board.enemyTokens.map(t => t.name).join(', ');
        lines.push(`Enemigos en combate: ${names}`);
    }

    if (board.partyTokens.length === 0 && board.npcTokens.length === 0 && board.enemyTokens.length === 0) {
        return '';
    }

    return lines.join('\n');
}

/**
 * Inject board/location awareness into the AI context.
 * Tells the AI which characters, NPCs, and enemies are present at the current location.
 */
export function injectBoardContext() {
    const ctx = buildBoardContext();
    if (ctx) {
        setExtensionPrompt(
            'DYN_BOARD',
            `[SYSTEM: CHARACTERS PRESENT AT CURRENT LOCATION]\n${ctx}`,
            extension_prompt_types.IN_PROMPT,
            0,
            false,
            extension_prompt_roles.SYSTEM,
        );
        console.log(`[DCM] 🏰 Board context injected: ${ctx.split('\n').length} lines`);
    } else {
        setExtensionPrompt('DYN_BOARD', '', extension_prompt_types.IN_PROMPT, 0);
        console.log('[DCM] 🏰 No board context (no location or empty board)');
    }
}

// ─── Master injection (called before generation) ────────────────────────

/**
 * Master injection function. Call this before generation to update all dynamic prompts.
 */
export function injectAllDynamicContext() {
    const campaign = getCampaignState();
    const activeChars = getActiveCharacterNames();
    console.log(`[DCM] ════════════════════════════════════════════════════════`);
    console.log(`[DCM] 🐉 DYNAMIC CONTEXT INJECTION`);
    console.log(`[DCM]   State: ${campaign.currentState} | Location: ${campaign.activeLocation || '(none)'}`);
    console.log(`[DCM]   Active characters: ${activeChars.length ? activeChars.join(', ') : '(none)'}`);
    console.log(`[DCM]   Quests: ${campaign.activeQuests?.length || 0} | Flags: ${Object.keys(campaign.customFlags || {}).length}`);

    injectDynamicInstructions();
    injectRelationshipContext();
    injectQuestContext();
    injectBoardContext();
    injectMetaInstruction();

    console.log(`[DCM] ════════════════════════════════════════════════════════`);
}

// ─── Slash commands ─────────────────────────────────────────────────────

function registerSlashCommands() {
    // /campaign state <state>
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'campaign',
        callback: campaignCommandHandler,
        helpString: 'Manage D&D campaign dynamic context. Subcommands: state, location, quest, flag, budget, status, instructions, autodetect, meta',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'subcommand and arguments',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
            }),
        ],
        splitUnnamedArgument: true,
    }));

    // Shorthand commands
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'cstate',
        callback: async (args, value) => campaignCommandHandler(args, ['state', ...(Array.isArray(value) ? value : [value])]),
        helpString: 'Set campaign state. Usage: /cstate combat',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'state name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumList: CAMPAIGN_STATES.map(s => new SlashCommandEnumValue(s)),
            }),
        ],
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'clocation',
        callback: async (args, value) => campaignCommandHandler(args, ['location', ...(Array.isArray(value) ? value : [value])]),
        helpString: 'Set current location. Usage: /clocation Dragon\'s Lair',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'location name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
            }),
        ],
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'cquest',
        callback: async (args, value) => campaignCommandHandler(args, ['quest', ...(Array.isArray(value) ? value : [value])]),
        helpString: 'Manage quests. Usage: /cquest add Find the dragon | /cquest remove Find the dragon | /cquest list',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'action and quest name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
            }),
        ],
        splitUnnamedArgument: true,
    }));
}

/**
 * Main command handler for /campaign.
 * @param {object} _args
 * @param {any} value
 * @returns {Promise<string>}
 */
async function campaignCommandHandler(_args, value) {
    const parts = Array.isArray(value) ? value.map(String) : String(value).split(/\s+/);
    const sub = (parts[0] || '').toLowerCase();
    const rest = parts.slice(1).join(' ').trim();

    switch (sub) {
        case 'state': {
            if (!rest) return `Current state: ${getCampaignState().currentState}`;
            const normalized = rest.toLowerCase();
            if (!CAMPAIGN_STATES.includes(normalized) && !normalized.startsWith('custom:')) {
                return `Invalid state. Valid: ${CAMPAIGN_STATES.join(', ')} or custom:<name>`;
            }
            updateCampaignState({ currentState: normalized });
            injectAllDynamicContext();
            await saveMetadata();
            return `Campaign state set to: ${normalized}`;
        }
        case 'location': {
            if (!rest) return `Current location: ${getCampaignState().activeLocation || '(none)'}`;
            updateCampaignState({ activeLocation: rest });
            injectAllDynamicContext();
            await saveMetadata();
            return `Location set to: ${rest}`;
        }
        case 'quest': {
            const questParts = rest.split(/\s+/);
            const action = (questParts[0] || '').toLowerCase();
            const questName = questParts.slice(1).join(' ').trim();
            const campaign = getCampaignState();

            if (action === 'add' && questName) {
                if (!campaign.activeQuests.includes(questName)) {
                    campaign.activeQuests.push(questName);
                    injectAllDynamicContext();
                    await saveMetadata();
                }
                return `Quest added: ${questName}`;
            } else if (action === 'remove' && questName) {
                const idx = campaign.activeQuests.indexOf(questName);
                if (idx >= 0) {
                    campaign.activeQuests.splice(idx, 1);
                    injectAllDynamicContext();
                    await saveMetadata();
                }
                return `Quest removed: ${questName}`;
            } else if (action === 'list' || !action) {
                if (!campaign.activeQuests.length) return 'No active quests.';
                return 'Active quests:\n' + campaign.activeQuests.map((q, i) => `${i + 1}. ${q}`).join('\n');
            }
            return 'Usage: /campaign quest add|remove|list <name>';
        }
        case 'flag': {
            const flagParts = rest.split(/\s+/);
            const action = (flagParts[0] || '').toLowerCase();
            const flagKey = flagParts[1] || '';
            const flagValue = flagParts.slice(2).join(' ');
            const campaign = getCampaignState();

            if (action === 'set' && flagKey) {
                campaign.customFlags[flagKey] = flagValue || true;
                injectAllDynamicContext();
                await saveMetadata();
                return `Flag set: ${flagKey} = ${campaign.customFlags[flagKey]}`;
            } else if (action === 'unset' && flagKey) {
                delete campaign.customFlags[flagKey];
                await saveMetadata();
                return `Flag removed: ${flagKey}`;
            } else if (action === 'get' && flagKey) {
                return `${flagKey} = ${campaign.customFlags[flagKey] ?? '(not set)'}`;
            } else if (action === 'list' || !action) {
                const entries = Object.entries(campaign.customFlags);
                if (!entries.length) return 'No custom flags set.';
                return entries.map(([k, v]) => `${k} = ${v}`).join('\n');
            }
            return 'Usage: /campaign flag set|unset|get|list <key> [value]';
        }
        case 'budget': {
            if (!rest) return `Token budget: ${getCampaignState().tokenBudget}`;
            const num = parseInt(rest, 10);
            if (isNaN(num) || num < 100) return 'Budget must be a number >= 100';
            updateCampaignState({ tokenBudget: num });
            await saveMetadata();
            return `Token budget set to: ${num}`;
        }
        case 'status': {
            const campaign = getCampaignState();
            const result = await getActiveDynamicInstructions();
            const relCtx = buildRelationshipContext();
            const lines = [
                `=== Campaign Dynamic Context ===`,
                `State: ${campaign.currentState}`,
                `Location: ${campaign.activeLocation || '(none)'}`,
                `Quests: ${campaign.activeQuests.length ? campaign.activeQuests.join(', ') : '(none)'}`,
                `Flags: ${Object.keys(campaign.customFlags).length ? JSON.stringify(campaign.customFlags) : '(none)'}`,
                `Token budget: ${result.totalTokens}/${result.budget}`,
                `Active instructions: ${result.active.length} (${result.active.map(i => i.label).join(', ') || 'none'})`,
                `Trimmed (over budget): ${result.trimmed.length} (${result.trimmed.map(i => i.label).join(', ') || 'none'})`,
                `Active relationships: ${relCtx ? relCtx.split('\n').length + ' entries' : 'none'}`,
                `Auto-detect: ${autoDetectEnabled ? 'ON' : 'OFF'}`,
                `Meta-instruction: ${metaInstructionEnabled ? 'ON' : 'OFF'}`,
                `AI tools: 8 registered via ToolManager`,
            ];
            return lines.join('\n');
        }
        case 'autodetect': {
            if (rest === 'on') { autoDetectEnabled = true; return 'Auto-detection enabled.'; }
            if (rest === 'off') { autoDetectEnabled = false; return 'Auto-detection disabled.'; }
            return `Auto-detect: ${autoDetectEnabled ? 'ON' : 'OFF'}. Usage: /campaign autodetect on|off`;
        }
        case 'meta': {
            if (rest === 'on') { metaInstructionEnabled = true; injectMetaInstruction(); await saveMetadata(); return 'Meta-instruction enabled — AI will be informed about update tags.'; }
            if (rest === 'off') { metaInstructionEnabled = false; injectMetaInstruction(); await saveMetadata(); return 'Meta-instruction disabled — AI will NOT see update tag instructions.'; }
            return `Meta-instruction: ${metaInstructionEnabled ? 'ON' : 'OFF'}. Usage: /campaign meta on|off`;
        }
        case 'instructions': {
            await openDynamicInstructionsPopup();
            return '';
        }
        default:
            return 'Subcommands: state, location, quest, flag, budget, status, instructions, autodetect, meta';
    }
}

// ─── UI ─────────────────────────────────────────────────────────────────

function escapeHtml(/** @type {any} */ str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

const CATEGORY_COLORS = {
    combat: '#e74c3c',
    relationship: '#e91e63',
    quest: '#f39c12',
    location: '#27ae60',
    item: '#8e44ad',
    lore: '#2980b9',
    rules: '#7f8c8d',
    npc: '#00bcd4',
    custom: '#95a5a6',
};

/**
 * Build HTML for the campaign state controls.
 * @param {CampaignState} campaign
 * @returns {string}
 */
function buildCampaignStateHtml(campaign) {
    const stateOptions = CAMPAIGN_STATES.map(s =>
        `<option value="${s}" ${s === campaign.currentState ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`,
    ).join('');

    const questItems = (campaign.activeQuests || []).map((q, i) =>
        `<div class="dcm-quest-item">
            <span>${escapeHtml(q)}</span>
            <button class="dcm-quest-remove menu_button" data-index="${i}" title="Remove"><i class="fa-solid fa-xmark"></i></button>
        </div>`,
    ).join('');

    return `
    <div class="dcm-campaign-section">
        <div class="dcm-row">
            <div class="dcm-field">
                <label>State</label>
                <select id="dcm_state_select" class="text_pole">${stateOptions}</select>
            </div>
            <div class="dcm-field">
                <label>Location</label>
                <input type="text" id="dcm_location_input" class="text_pole" value="${escapeHtml(campaign.activeLocation || '')}" placeholder="Current location..." />
            </div>
            <div class="dcm-field dcm-field-narrow">
                <label>Token Budget</label>
                <input type="number" id="dcm_budget_input" class="text_pole" value="${campaign.tokenBudget || DEFAULT_TOKEN_BUDGET}" min="100" step="100" />
            </div>
        </div>
        <div class="dcm-quest-section">
            <label>Active Quests</label>
            <div class="dcm-quest-list">${questItems || '<div class="dcm-empty">No active quests</div>'}</div>
            <div class="dcm-row">
                <input type="text" id="dcm_quest_input" class="text_pole flex1" placeholder="Add quest..." />
                <button id="dcm_quest_add" class="menu_button"><i class="fa-solid fa-plus"></i></button>
            </div>
        </div>
    </div>`;
}

/**
 * Build HTML for a single dynamic instruction card.
 * @param {DynamicInstruction} instr
 * @param {boolean} isActive
 * @returns {string}
 */
function buildInstructionCard(instr, isActive) {
    const color = CATEGORY_COLORS[/** @type {keyof CATEGORY_COLORS} */ (instr.category)] || CATEGORY_COLORS.custom;
    const preview = (instr.text || '').substring(0, 100) + (instr.text?.length > 100 ? '…' : '');
    const charTags = (instr.targetCharacters || []).map(c => `<span class="dcm-tag dcm-tag-char">${escapeHtml(c)}</span>`).join('');
    const kwTags = (instr.keywords || []).map(k => `<span class="dcm-tag dcm-tag-kw">${escapeHtml(k)}</span>`).join('');
    const stateTags = (instr.states || []).map(s => `<span class="dcm-tag dcm-tag-state">${escapeHtml(s)}</span>`).join('');
    const tokens = instr._tokenCache != null ? `~${instr._tokenCache}t` : '?t';

    return `
    <div class="dcm-instr-card ${isActive ? 'dcm-active' : 'dcm-inactive'}" data-id="${escapeHtml(instr.id)}">
        <div class="dcm-instr-header">
            <label class="dcm-toggle-wrap">
                <input type="checkbox" class="dcm-instr-toggle" ${instr.enabled ? 'checked' : ''} />
            </label>
            <span class="dcm-category-badge" style="background:${color}">${instr.category}</span>
            <span class="dcm-instr-label">${escapeHtml(instr.label || 'Untitled')}</span>
            <span class="dcm-priority-badge" title="Priority ${instr.priority || DEFAULT_PRIORITY}">P${instr.priority || DEFAULT_PRIORITY}</span>
            <span class="dcm-token-badge">${tokens}</span>
            <span class="dcm-active-indicator ${isActive ? 'dcm-on' : 'dcm-off'}" title="${isActive ? 'Will be sent' : 'Filtered out'}">●</span>
            <div class="dcm-instr-actions">
                <button class="dcm-instr-edit menu_button" title="Edit"><i class="fa-solid fa-pen"></i></button>
                <button class="dcm-instr-delete menu_button" title="Delete"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
        <div class="dcm-instr-body">
            <div class="dcm-instr-preview">${escapeHtml(preview)}</div>
            <div class="dcm-instr-tags">${charTags}${kwTags}${stateTags}</div>
        </div>
    </div>`;
}

/**
 * Build the full token budget bar.
 * @param {number} used
 * @param {number} budget
 * @returns {string}
 */
function buildBudgetBar(used, budget) {
    const pct = budget > 0 ? Math.min(100, Math.round((used / budget) * 100)) : 0;
    const color = pct > 90 ? '#e74c3c' : pct > 70 ? '#f39c12' : '#27ae60';
    return `
    <div class="dcm-budget-bar">
        <div class="dcm-budget-fill" style="width:${pct}%;background:${color}"></div>
        <span class="dcm-budget-label">${used} / ${budget} tokens (${pct}%)</span>
    </div>`;
}

/**
 * Open the main Dynamic Instructions popup.
 */
export async function openDynamicInstructionsPopup() {
    const campaign = getCampaignState();
    const result = await getActiveDynamicInstructions();
    const activeIds = new Set(result.active.map(i => i.id));
    const instructions = getDynamicInstructions();

    const campaignHtml = buildCampaignStateHtml(campaign);
    const budgetHtml = buildBudgetBar(result.totalTokens, result.budget);

    let instrCards = '';
    for (const instr of instructions) {
        instrCards += buildInstructionCard(instr, activeIds.has(instr.id));
    }

    const html = `
    <div class="dcm-container">
        <h3><i class="fa-solid fa-dragon"></i> Dynamic Context Manager</h3>
        ${campaignHtml}
        <div class="dcm-section">
            <div class="dcm-section-title"><i class="fa-solid fa-gauge-high"></i> Token Budget</div>
            ${budgetHtml}
        </div>
        <div class="dcm-section">
            <div class="dcm-section-title"><i class="fa-solid fa-scroll"></i> Dynamic Instructions (${instructions.length})</div>
            <div id="dcm_instr_list">${instrCards || '<div class="dcm-empty">No dynamic instructions. Add one below.</div>'}</div>
            <button id="dcm_add_instr" class="dcm-add-btn menu_button">
                <i class="fa-solid fa-plus"></i> Add Dynamic Instruction
            </button>
        </div>
        <div class="dcm-section">
            <div class="dcm-section-title"><i class="fa-solid fa-heart"></i> Active Relationships</div>
            <div class="dcm-rel-preview">${escapeHtml(buildRelationshipContext()) || '<span class="dcm-empty">No relevant relationships for current character(s)</span>'}</div>
        </div>
    </div>`;

    const content = $(html);

    // ─── Wire events ────────────────────────
    content.on('change', '#dcm_state_select', function () {
        updateCampaignState({ currentState: $(this).val() });
        injectAllDynamicContext();
        saveMetadata();
    });

    content.on('change', '#dcm_location_input', function () {
        updateCampaignState({ activeLocation: $(this).val() });
        injectAllDynamicContext();
        saveMetadata();
    });

    content.on('change', '#dcm_budget_input', function () {
        const val = parseInt($(this).val(), 10);
        if (!isNaN(val) && val >= 100) {
            updateCampaignState({ tokenBudget: val });
            // Invalidate caches
            getDynamicInstructions().forEach(i => { i._tokenCache = null; });
            injectAllDynamicContext();
            saveMetadata();
        }
    });

    // Quest management
    content.on('click', '#dcm_quest_add', function () {
        const input = content.find('#dcm_quest_input');
        const name = input.val()?.toString().trim();
        if (name) {
            const c = getCampaignState();
            if (!c.activeQuests.includes(name)) {
                c.activeQuests.push(name);
                injectAllDynamicContext();
                saveMetadata();
                // Refresh quest list
                const questHtml = c.activeQuests.map((q, i) =>
                    `<div class="dcm-quest-item"><span>${escapeHtml(q)}</span><button class="dcm-quest-remove menu_button" data-index="${i}" title="Remove"><i class="fa-solid fa-xmark"></i></button></div>`,
                ).join('');
                content.find('.dcm-quest-list').html(questHtml);
            }
            input.val('');
        }
    });

    content.on('keypress', '#dcm_quest_input', function (e) {
        if (e.key === 'Enter') content.find('#dcm_quest_add').click();
    });

    content.on('click', '.dcm-quest-remove', function () {
        const idx = parseInt($(this).data('index'), 10);
        const c = getCampaignState();
        if (idx >= 0 && idx < c.activeQuests.length) {
            c.activeQuests.splice(idx, 1);
            injectAllDynamicContext();
            saveMetadata();
            $(this).closest('.dcm-quest-item').remove();
            if (!c.activeQuests.length) {
                content.find('.dcm-quest-list').html('<div class="dcm-empty">No active quests</div>');
            }
        }
    });

    // Instruction toggle
    content.on('change', '.dcm-instr-toggle', function () {
        const id = $(this).closest('.dcm-instr-card').data('id');
        const instr = getDynamicInstructions().find(i => i.id === id);
        if (instr) {
            instr.enabled = this.checked;
            injectDynamicInstructions();
            saveMetadata();
        }
    });

    // Instruction delete
    content.on('click', '.dcm-instr-delete', function () {
        const id = $(this).closest('.dcm-instr-card').data('id');
        deleteDynamicInstruction(id);
        injectDynamicInstructions();
        saveMetadata();
        $(this).closest('.dcm-instr-card').remove();
    });

    // Instruction edit
    content.on('click', '.dcm-instr-edit', async function () {
        const id = $(this).closest('.dcm-instr-card').data('id');
        const instr = getDynamicInstructions().find(i => i.id === id);
        if (!instr) return;
        const result = await openInstructionEditorPopup(instr);
        if (result) {
            Object.assign(instr, result);
            instr._tokenCache = null;
            injectDynamicInstructions();
            saveMetadata();
            // Refresh the card visually
            const newResult = await getActiveDynamicInstructions();
            const newActiveIds = new Set(newResult.active.map(i => i.id));
            const $card = $(`.dcm-instr-card[data-id="${id}"]`);
            $card.replaceWith(buildInstructionCard(instr, newActiveIds.has(instr.id)));
        }
    });

    // Add instruction
    content.on('click', '#dcm_add_instr', async function () {
        const result = await openInstructionEditorPopup(null);
        if (result && result.text?.trim()) {
            const newInstr = createDynamicInstruction(result);
            injectDynamicInstructions();
            saveMetadata();
            const newResult = await getActiveDynamicInstructions();
            const newActiveIds = new Set(newResult.active.map(i => i.id));
            content.find('#dcm_instr_list .dcm-empty').remove();
            content.find('#dcm_instr_list').append(buildInstructionCard(newInstr, newActiveIds.has(newInstr.id)));
        }
    });

    const popup = new Popup(content, POPUP_TYPE.CONFIRM, undefined, {
        wider: true,
        okButton: 'Close',
        cancelButton: null,
        allowVerticalScrolling: true,
    });
    await popup.show();
}

/**
 * Open a popup to create/edit a dynamic instruction.
 * @param {DynamicInstruction|null} existing
 * @returns {Promise<Partial<DynamicInstruction>|null>}
 */
async function openInstructionEditorPopup(existing) {
    const isNew = !existing;
    /** @type {Partial<DynamicInstruction>} */
    const data = existing || {};

    const categoryOptions = INSTRUCTION_CATEGORIES.map(c =>
        `<option value="${c}" ${c === (data.category || 'custom') ? 'selected' : ''}>${c.charAt(0).toUpperCase() + c.slice(1)}</option>`,
    ).join('');

    const stateCheckboxes = CAMPAIGN_STATES.map(s => {
        const checked = data.states?.includes(s) ? 'checked' : '';
        return `<label class="dcm-state-cb"><input type="checkbox" value="${s}" ${checked}/> ${s}</label>`;
    }).join('');

    // Gather character names for suggestions
    const charNames = characters.filter(c => c.name).map(c => c.name);
    const charDatalist = charNames.map(n => `<option value="${escapeHtml(n)}">`).join('');

    const editorHtml = `
    <div class="dcm-editor">
        <div class="dcm-editor-row">
            <div class="dcm-editor-field flex1">
                <label>Label</label>
                <input type="text" id="dcm_ed_label" class="text_pole" value="${escapeHtml(data.label || '')}" placeholder="e.g. Combat Rules" />
            </div>
            <div class="dcm-editor-field">
                <label>Category</label>
                <select id="dcm_ed_category" class="text_pole">${categoryOptions}</select>
            </div>
            <div class="dcm-editor-field dcm-field-narrow">
                <label>Priority (1-10)</label>
                <input type="number" id="dcm_ed_priority" class="text_pole" value="${data.priority || DEFAULT_PRIORITY}" min="1" max="10" />
            </div>
        </div>
        <div class="dcm-editor-field">
            <label>Instruction Text</label>
            <textarea id="dcm_ed_text" class="text_pole dcm-editor-textarea" placeholder="Context to send to the AI...">${escapeHtml(data.text || '')}</textarea>
            <small class="dcm-token-counter" id="dcm_ed_tokens">Tokens: calculating...</small>
        </div>
        <div class="dcm-editor-row">
            <div class="dcm-editor-field flex1">
                <label>Target Characters (comma-separated, empty = all)</label>
                <input type="text" id="dcm_ed_targets" class="text_pole" value="${escapeHtml((data.targetCharacters || []).join(', '))}" placeholder="Luna, Gandalf" list="dcm_char_list" />
                <datalist id="dcm_char_list">${charDatalist}</datalist>
            </div>
            <div class="dcm-editor-field flex1">
                <label>Exclude Characters (comma-separated)</label>
                <input type="text" id="dcm_ed_excludes" class="text_pole" value="${escapeHtml((data.excludeCharacters || []).join(', '))}" />
            </div>
        </div>
        <div class="dcm-editor-field">
            <label>Keywords (comma-separated, activate when found in recent messages)</label>
            <input type="text" id="dcm_ed_keywords" class="text_pole" value="${escapeHtml((data.keywords || []).join(', '))}" placeholder="dragon, magic sword, /regex/" />
        </div>
        <div class="dcm-editor-field">
            <label>Scan Depth (messages)</label>
            <input type="number" id="dcm_ed_scandepth" class="text_pole dcm-field-narrow" value="${data.scanDepth || DEFAULT_SCAN_DEPTH}" min="1" max="50" />
        </div>
        <div class="dcm-editor-field">
            <label>Active in States (empty = all):</label>
            <div class="dcm-state-checkboxes">${stateCheckboxes}</div>
        </div>
        <div class="dcm-editor-row">
            <label class="checkbox_label"><input type="checkbox" id="dcm_ed_grouponly" ${data.groupOnly ? 'checked' : ''} /> Group chats only</label>
            <label class="checkbox_label"><input type="checkbox" id="dcm_ed_soloonly" ${data.soloOnly ? 'checked' : ''} /> Solo chats only</label>
        </div>
    </div>`;

    const editorContent = $(editorHtml);

    // Live token counter
    const updateTokens = async () => {
        const text = editorContent.find('#dcm_ed_text').val()?.toString() || '';
        if (text.trim()) {
            const count = await getTokenCountAsync(text);
            editorContent.find('#dcm_ed_tokens').text(`Tokens: ~${count}`);
        } else {
            editorContent.find('#dcm_ed_tokens').text('Tokens: 0');
        }
    };
    editorContent.on('input', '#dcm_ed_text', () => {
        // Debounce
        clearTimeout(editorContent.data('tokenTimer'));
        editorContent.data('tokenTimer', setTimeout(updateTokens, 500));
    });
    // Initial count
    setTimeout(updateTokens, 100);

    const editorPopup = new Popup(editorContent, POPUP_TYPE.CONFIRM, undefined, {
        wider: true,
        okButton: isNew ? 'Create' : 'Save',
        cancelButton: 'Cancel',
        allowVerticalScrolling: true,
    });

    const popupResult = await editorPopup.show();
    if (popupResult !== POPUP_RESULT.AFFIRMATIVE) return null;

    // Collect form data
    const parseCommaSep = (/** @type {string} */ val) => val.split(',').map(s => s.trim()).filter(Boolean);
    /** @type {string[]} */
    const selectedStates = [];
    editorContent.find('.dcm-state-checkboxes input:checked').each(function () {
        selectedStates.push(String($(this).val()));
    });

    return {
        label: editorContent.find('#dcm_ed_label').val()?.toString().trim() || 'Untitled',
        text: editorContent.find('#dcm_ed_text').val()?.toString() || '',
        category: editorContent.find('#dcm_ed_category').val()?.toString() || 'custom',
        priority: parseInt(String(editorContent.find('#dcm_ed_priority').val()), 10) || DEFAULT_PRIORITY,
        targetCharacters: parseCommaSep(editorContent.find('#dcm_ed_targets').val()?.toString() || ''),
        excludeCharacters: parseCommaSep(editorContent.find('#dcm_ed_excludes').val()?.toString() || ''),
        keywords: parseCommaSep(editorContent.find('#dcm_ed_keywords').val()?.toString() || ''),
        states: selectedStates,
        scanDepth: parseInt(String(editorContent.find('#dcm_ed_scandepth').val()), 10) || DEFAULT_SCAN_DEPTH,
        groupOnly: editorContent.find('#dcm_ed_grouponly').is(':checked'),
        soloOnly: editorContent.find('#dcm_ed_soloonly').is(':checked'),
        _tokenCache: null,
    };
}

// ─── Initialization ─────────────────────────────────────────────────────

export function initDynamicContextManager() {
    registerSlashCommands();
    setupAutoDetection();
    registerCampaignTools();

    // Hook into generation to refresh dynamic context
    eventSource.on(event_types.GENERATION_STARTED, () => {
        injectAllDynamicContext();
    });

    // Add button handler for the UI
    $(document).on('click', '#option_dynamic_context', () => {
        $('#options').hide();
        openDynamicInstructionsPopup();
    });

    console.log('[DCM] 🐉 Dynamic Context Manager initialized. Commands: /campaign, /cstate, /clocation, /cquest');
    console.log('[DCM] 🔧 AI tools registered: dnd_update_state, dnd_set_location, dnd_manage_quest, dnd_set_flag, dnd_add_instruction, dnd_update_instruction, dnd_remove_instruction, dnd_get_campaign_status');
    console.log('[DCM] 🤖 Message scanner active: AI can use [STATE:], [LOCATION:], [QUEST_ADD:], etc. tags');
}
