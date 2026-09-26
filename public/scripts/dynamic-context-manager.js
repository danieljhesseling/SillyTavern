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
 *
 * Lo que queda aquí desde la U1 del pegamento (2026-09-25): las instrucciones que escribe
 * quien juega, los vínculos y quién está en el tablero. La escena en una partida del juego
 * la decide el motor (`getEngineSceneState`); las misiones, el sitio y los hechos, también.
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
import { promptKey, tierForCategory, isPromptKey } from './game-engine/cost/prompt-order.js';
import { selected_group, groups } from './group-chats.js';
import { getTokenCountAsync } from './tokenizers.js';
import { eventSource, event_types } from './events.js';
import { Popup, POPUP_TYPE, POPUP_RESULT } from './popup.js';
import { SlashCommandParser } from './slash-commands/SlashCommandParser.js';
import { SlashCommand } from './slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument } from './slash-commands/SlashCommandArgument.js';
import { SlashCommandEnumValue } from './slash-commands/SlashCommandEnumValue.js';
import { getPartyMembersSnapshot, getBoardContextSnapshot, getEngineSceneState } from './party.js';
import { escapeHtml } from './utils.js';

// ─── Constants ──────────────────────────────────────────────────────────

// Las claves deciden el orden: SillyTavern une los bloques por `Object.keys().sort()`,
// asi que una clave con el id de la instruccion los colocaba al azar y la ficha del grupo
// podia quedar antes que las reglas. `promptKey` ordena por cada cuanto cambia cada cosa,
// que es lo unico que decide si el proveedor puede reutilizar el principio del prompt.
// Ver game-engine/cost/prompt-order.js.

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
 * @property {string} currentState - One of CAMPAIGN_STATES. Fuera de una partida del juego, la
 *   que se elige a mano; dentro, manda la del motor (ver `currentStateOf`).
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

/**
 * La escena de ahora. Con una partida del juego abierta la decide el motor: hay combate o
 * no, se está en un tablero o en el pueblo. Fuera de él, la que se eligió a mano con
 * `/cstate`. Antes se adivinaba por la prosa del narrador, y una frase como «¡al ataque!»
 * cambiaba la escena sin combate detrás.
 *
 * @param {CampaignState} campaign
 * @returns {string}
 */
export function currentStateOf(campaign) {
    return getEngineSceneState() || campaign.currentState;
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
    if (instr.states?.length > 0 && !instr.states.includes(currentStateOf(campaign))) {
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
        const key = promptKey(tierForCategory(instr.category), instr.id);

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
        if (isPromptKey(key, 'dyn') && !activeKeySet.has(key)) {
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
        // La categoria decide la clave, asi que hay que leerla antes de quitar la
        // instruccion: despues del splice, ese indice es ya la siguiente.
        const category = ctx.instructions[idx]?.category;
        ctx.instructions.splice(idx, 1);
        setExtensionPrompt(promptKey(tierForCategory(category), id), '', extension_prompt_types.IN_PROMPT, 0);
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

// ─── Lo que ya no está aquí ─────────────────────────────────────────────

// Hasta el 2026-09-25 este módulo también adivinaba la escena y el sitio leyendo la prosa,
// enseñaba al narrador a escribir etiquetas ([QUEST_ADD:], [FLAG:]…) con una instrucción
// que iba en cada turno, y le daba ocho herramientas para apuntar misiones, banderas,
// escena y sitio por su cuenta. Todo eso ya lo decide el motor: el director de escenas, el
// hilo y el tablón, el viaje, y `proponer_hecho` en `party.js`. Eran dos verdades sobre lo
// mismo, y una la escribía quien no debe. Ver wiki/ROADMAP_PEGAMENTO.md, U1.

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
            promptKey('npc', 'relationships', 'ctx'),
            `[SYSTEM: ACTIVE RELATIONSHIPS]\n${ctx}`,
            extension_prompt_types.IN_PROMPT,
            0,
            false,
            extension_prompt_roles.SYSTEM,
        );
        console.log(`[DCM] 💕 Relationships injected (${ctx.split('\n').length} entries):\n${ctx}`);
    } else {
        setExtensionPrompt(promptKey('npc', 'relationships', 'ctx'), '', extension_prompt_types.IN_PROMPT, 0);
        console.log('[DCM] 💕 No relevant relationships for current character(s)');
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
            promptKey('combat', 'board', 'ctx'),
            `[SYSTEM: CHARACTERS PRESENT AT CURRENT LOCATION]\n${ctx}`,
            extension_prompt_types.IN_PROMPT,
            0,
            false,
            extension_prompt_roles.SYSTEM,
        );
        console.log(`[DCM] 🏰 Board context injected: ${ctx.split('\n').length} lines`);
    } else {
        setExtensionPrompt(promptKey('combat', 'board', 'ctx'), '', extension_prompt_types.IN_PROMPT, 0);
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
    console.log('[DCM] ════════════════════════════════════════════════════════');
    console.log('[DCM] 🐉 DYNAMIC CONTEXT INJECTION');
    console.log(`[DCM]   State: ${currentStateOf(campaign)}`);
    console.log(`[DCM]   Active characters: ${activeChars.length ? activeChars.join(', ') : '(none)'}`);

    injectDynamicInstructions();
    injectRelationshipContext();
    injectBoardContext();

    console.log('[DCM] ════════════════════════════════════════════════════════');
}

// ─── Slash commands ─────────────────────────────────────────────────────

function registerSlashCommands() {
    // /campaign state <state>
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'campaign',
        callback: campaignCommandHandler,
        helpString: 'Manage D&D campaign dynamic context. Subcommands: state, budget, status, instructions',
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
                '=== Campaign Dynamic Context ===',
                `State: ${currentStateOf(campaign)}${getEngineSceneState() ? ' (la decide el juego)' : ''}`,
                `Token budget: ${result.totalTokens}/${result.budget}`,
                `Active instructions: ${result.active.length} (${result.active.map(i => i.label).join(', ') || 'none'})`,
                `Trimmed (over budget): ${result.trimmed.length} (${result.trimmed.map(i => i.label).join(', ') || 'none'})`,
                `Active relationships: ${relCtx ? relCtx.split('\n').length + ' entries' : 'none'}`,
            ];
            return lines.join('\n');
        }
        case 'instructions': {
            await openDynamicInstructionsPopup();
            return '';
        }
        default:
            return 'Subcommands: state, budget, status, instructions';
    }
}

// ─── UI ─────────────────────────────────────────────────────────────────

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
    const byEngine = Boolean(getEngineSceneState());
    const current = currentStateOf(campaign);
    const stateOptions = CAMPAIGN_STATES.map(s =>
        `<option value="${s}" ${s === current ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`,
    ).join('');

    return `
    <div class="dcm-campaign-section">
        <div class="dcm-row">
            <div class="dcm-field">
                <label>State</label>
                <select id="dcm_state_select" class="text_pole" ${byEngine ? 'disabled title="En una partida, la escena la decide el juego."' : ''}>${stateOptions}</select>
            </div>
            <div class="dcm-field dcm-field-narrow">
                <label>Token Budget</label>
                <input type="number" id="dcm_budget_input" class="text_pole" value="${campaign.tokenBudget || DEFAULT_TOKEN_BUDGET}" min="100" step="100" />
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

    // Hook into generation to refresh dynamic context
    eventSource.on(event_types.GENERATION_STARTED, () => {
        injectAllDynamicContext();
    });

    // Add button handler for the UI
    $(document).on('click', '#option_dynamic_context', () => {
        $('#options').hide();
        openDynamicInstructionsPopup();
    });

    console.log('[DCM] 🐉 Dynamic Context Manager initialized. Commands: /campaign, /cstate');
}
