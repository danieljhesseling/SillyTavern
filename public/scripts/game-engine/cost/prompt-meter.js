/**
 * What a turn actually sends, and what it costs.
 *
 * The roadmap says "you cannot optimise what you cannot see", and this project has the
 * scar to prove it: a whole plan was built on the belief that combat cost twenty model
 * calls a fight, when combat had always been free. The belief was reasonable and wrong,
 * and nothing in the app could have shown that.
 *
 * So this measures rather than estimates where it can, and says which is which where it
 * cannot. The cost of a turn is dominated by what gets re-sent every time — system
 * prompt, lorebook, party sheets, board state, history — not by what the model writes.
 * This module breaks that bundle into named blocks so the expensive one is obvious.
 *
 * Pure: the caller passes in the request the app is about to send, and a token counter.
 *
 * See wiki/ROADMAP.md §1 and T3/T4.
 */

/**
 * How a block of prompt is labelled, by what it looks like.
 *
 * Data rather than a chain of ifs, so a new kind of injection is one line. Order matters:
 * the first pattern that matches wins, so the specific ones come before the general.
 *
 * @type {Array<{label: string, test: RegExp}>}
 */
export const SOURCE_PATTERNS = [
    { label: 'Contexto dinámico', test: /\[DYN_[A-Z_]+:/ },
    { label: 'Ficha del grupo', test: /\b(HP|PG)\s*:\s*\d+\s*\/\s*\d+|\bAC:\s*\d+|Inventario:/i },
    { label: 'Tablero y posiciones', test: /\[BOARD\]|casilla|cuadrícula|tablero t[áa]ctico/i },
    { label: 'Lorebook / World Info', test: /\[WI\]|World Info|Lorebook/i },
    { label: 'Instrucciones activas', test: /\[INSTRUCTION|instrucci[óo]n activa/i },
    { label: 'Ejemplos de diálogo', test: /<START>|\bEjemplo de di[áa]logo/i },
    { label: 'Descripción del personaje', test: /Personality:|Scenario:|Description:/i },
];

/** What a block is called when nothing matches, by its role in the request. */
const ROLE_LABELS = {
    system: 'Prompt de sistema',
    user: 'Mensajes del jugador',
    assistant: 'Respuestas del modelo',
};

/**
 * A rough token count for text, when no real tokenizer is available.
 *
 * Four characters per token is the usual English approximation and it is wrong for
 * Spanish, wrong for names, and wrong for markup. It is here so a preview can be drawn
 * synchronously, and anything shown from it must be labelled as an estimate.
 *
 * @param {string} text
 * @returns {number}
 */
export function roughTokens(text) {
    return Math.ceil(String(text ?? '').length / 4);
}

/**
 * Pulls the text blocks out of whatever the app is about to send.
 *
 * Chat completion sends an array of messages; text completion sends one string. Both are
 * reduced to the same list of blocks so the rest of this module — and the panel above it
 * — does not care which API is in use.
 *
 * @param {any} generateData  The request object, as emitted with GENERATE_AFTER_DATA.
 * @returns {Array<{role: string, text: string}>}
 */
export function extractBlocks(generateData) {
    if (!generateData || typeof generateData !== 'object') return [];

    if (Array.isArray(generateData.messages)) {
        return generateData.messages
            .map((/** @type {any} */ message) => ({
                role: String(message?.role || 'system'),
                text: typeof message?.content === 'string'
                    ? message.content
                    // Multimodal content arrives as parts; only the text costs tokens here.
                    : (Array.isArray(message?.content)
                        ? message.content.map((/** @type {any} */ p) => p?.text || '').join('\n')
                        : ''),
            }))
            .filter((/** @type {any} */ block) => block.text.trim().length > 0);
    }

    const prompt = generateData.prompt ?? generateData.text ?? '';
    if (typeof prompt === 'string' && prompt.trim()) {
        return [{ role: 'system', text: prompt }];
    }

    return [];
}

/**
 * Names a block by what it contains.
 * @param {{role: string, text: string}} block
 * @returns {string}
 */
export function labelBlock(block) {
    for (const { label, test } of SOURCE_PATTERNS) {
        if (test.test(block.text)) return label;
    }
    return ROLE_LABELS[block.role] || block.role;
}

/**
 * Breaks a request into named blocks with their sizes, biggest first.
 *
 * Sorted by size because the question this answers is always "what is taking up the
 * room?", and the answer is usually one block nobody suspected.
 *
 * @param {any} generateData
 * @param {(text: string) => number} [countTokens]  Defaults to the rough estimate.
 * @returns {{blocks: Array<{label: string, role: string, tokens: number, chars: number, preview: string}>, totalTokens: number, totalChars: number, estimated: boolean}}
 */
export function describePrompt(generateData, countTokens = null) {
    const counter = typeof countTokens === 'function' ? countTokens : roughTokens;
    const raw = extractBlocks(generateData);

    /** @type {Map<string, {label: string, role: string, tokens: number, chars: number, preview: string}>} */
    const byLabel = new Map();

    for (const block of raw) {
        const label = labelBlock(block);
        const existing = byLabel.get(label);
        const tokens = Number(counter(block.text)) || 0;

        if (existing) {
            existing.tokens += tokens;
            existing.chars += block.text.length;
        } else {
            byLabel.set(label, {
                label,
                role: block.role,
                tokens,
                chars: block.text.length,
                preview: block.text.slice(0, 400),
            });
        }
    }

    const blocks = [...byLabel.values()].sort((a, b) => b.tokens - a.tokens);

    return {
        blocks,
        totalTokens: blocks.reduce((sum, b) => sum + b.tokens, 0),
        totalChars: blocks.reduce((sum, b) => sum + b.chars, 0),
        estimated: typeof countTokens !== 'function',
    };
}

/**
 * @typedef {Object} SessionCost
 * @property {number} turns
 * @property {number} promptTokens   Sent, summed over the session.
 * @property {number} largestTurn
 * @property {string} largestBlock   Which block was biggest on the largest turn.
 * @property {boolean} estimated     True while any turn was measured by approximation.
 */

/** A session that has cost nothing yet. */
export function emptySession() {
    return { turns: 0, promptTokens: 0, largestTurn: 0, largestBlock: '', estimated: false };
}

/**
 * Folds one turn into the running total.
 *
 * Returns a new object rather than mutating: the panel keeps the previous figure to show
 * what changed, and mutating would erase it.
 *
 * @param {SessionCost} session
 * @param {{totalTokens: number, blocks: Array<{label: string, tokens: number}>, estimated: boolean}} turn
 * @returns {SessionCost}
 */
export function addTurn(session, turn) {
    const base = session ?? emptySession();
    const tokens = Number(turn?.totalTokens) || 0;
    const biggest = turn?.blocks?.[0]?.label ?? base.largestBlock;

    return {
        turns: base.turns + 1,
        promptTokens: base.promptTokens + tokens,
        largestTurn: Math.max(base.largestTurn, tokens),
        largestBlock: tokens >= base.largestTurn ? biggest : base.largestBlock,
        estimated: base.estimated || Boolean(turn?.estimated),
    };
}

/**
 * What a session has cost so far, at a price the player provides.
 *
 * Rates are not hard-coded because they change, they differ per provider, and a stale
 * number in the interface is worse than no number: it would be believed.
 *
 * @param {SessionCost} session
 * @param {number} pricePerMillion  Input price, in whatever currency the player thinks in.
 * @returns {{tokens: number, spend: number, perTurn: number}}
 */
export function estimateSpend(session, pricePerMillion) {
    const rate = Number(pricePerMillion);
    const tokens = Number(session?.promptTokens) || 0;
    const turns = Number(session?.turns) || 0;

    if (!Number.isFinite(rate) || rate <= 0) {
        return { tokens, spend: 0, perTurn: turns ? tokens / turns : 0 };
    }

    return {
        tokens,
        spend: (tokens / 1_000_000) * rate,
        perTurn: turns ? tokens / turns : 0,
    };
}

/**
 * The one number this project got wrong, kept honest.
 *
 * Says how much of a turn is the context you resend every time versus the conversation
 * itself, because that ratio is what decides whether a campaign gets more expensive as it
 * goes — and it is the thing the cross-cutting levers (cache, summarise) act on.
 *
 * @param {Array<{label: string, tokens: number}>} blocks
 * @returns {{fixed: number, conversation: number, ratio: number}}
 */
export function splitFixedFromConversation(blocks) {
    const list = Array.isArray(blocks) ? blocks : [];
    const conversationLabels = new Set([ROLE_LABELS.user, ROLE_LABELS.assistant]);

    let fixed = 0;
    let conversation = 0;
    for (const block of list) {
        const tokens = Number(block?.tokens) || 0;
        if (conversationLabels.has(block?.label)) conversation += tokens;
        else fixed += tokens;
    }

    const total = fixed + conversation;
    return { fixed, conversation, ratio: total ? fixed / total : 0 };
}
