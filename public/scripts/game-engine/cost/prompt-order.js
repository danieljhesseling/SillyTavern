/**
 * A prompt whose beginning does not move.
 *
 * Every provider worth caching for — Gemini implicitly, OpenAI automatically, Claude when
 * asked — caches by **prefix**: it reuses the work it already did on however many leading
 * tokens are byte-for-byte identical to last time, and throws away everything from the
 * first difference onwards. So what decides whether caching pays is not how much you send
 * but **where the first change is**.
 *
 * SillyTavern joins the injected blocks in `Object.keys(extension_prompts).sort()` order,
 * which is alphabetical. That is deterministic, which is good, and arbitrary, which is
 * not: a block keyed by a random instruction id can land anywhere, so the rules of the
 * game could sit after the party's current hit points. Change one hit point and every
 * token after it is recomputed — including all the rules.
 *
 * The fix is the whole of this module: give each block a key that **sorts by how often it
 * changes**. Then the things that never move are always first, and a hit point lost at
 * the end of a fight costs the cache only what comes after it.
 *
 * Pure. See wiki/ROADMAP.md, Transversales (T1) · la decisión D2 en wiki/POR_HACER.md.
 */

/**
 * The tiers, from what never changes to what changes every single turn.
 *
 * The numbers are what actually does the work: they are the sort key. They are spaced so
 * a tier can be inserted between two others later without renumbering the world.
 *
 * @type {Array<{id: string, order: number, label: string, why: string}>}
 */
export const PROMPT_TIERS = [
    { id: 'rules', order: 10, label: 'Reglas del juego', why: 'Solo cambia si editas el paquete de reglas.' },
    { id: 'world', order: 20, label: 'Mundo y trasfondo', why: 'Cambia cuando cambias de campaña.' },
    { id: 'npc', order: 30, label: 'Personajes y vínculos', why: 'Cambia cuando alguien sube de rango.' },
    { id: 'quest', order: 40, label: 'Misiones y objetivos', why: 'Cambia al empezar o terminar una misión.' },
    { id: 'location', order: 50, label: 'Dónde está el grupo', why: 'Cambia al viajar o entrar en un tablero.' },
    { id: 'party', order: 60, label: 'Ficha del grupo', why: 'Cambia con cada herida y cada objeto.' },
    { id: 'combat', order: 70, label: 'Estado del combate', why: 'Cambia en cada turno.' },
    { id: 'custom', order: 80, label: 'Instrucciones sueltas', why: 'Las escribe el modelo; pueden cambiar en cualquier momento.' },
];

/** Where anything unrecognised goes: after everything that has a declared tier. */
const FALLBACK_TIER = 'custom';

/** What each instruction category counts as. */
const CATEGORY_TIERS = {
    rules: 'rules',
    lore: 'world',
    relationship: 'npc',
    npc: 'npc',
    quest: 'quest',
    location: 'location',
    item: 'party',
    combat: 'combat',
    custom: 'custom',
};

/**
 * The tier an instruction belongs to, by its category.
 *
 * @param {string} category
 * @returns {string}
 */
export function tierForCategory(category) {
    const key = String(category ?? '').trim().toLowerCase();
    return CATEGORY_TIERS[key] ?? FALLBACK_TIER;
}

/**
 * The key a block must be injected under so it lands in the right place.
 *
 * The shape is `GAME_<order>_<tier>_<source>_<id>`: a common prefix so every block this
 * game injects sorts together and away from whatever else an extension adds, then the
 * tier number so the order is the one declared above, then who injected it, then the id
 * so two blocks of the same tier keep a stable order between themselves.
 *
 * The **source** is not decoration. Each injector clears its own orphaned keys by
 * prefix, and without it the dynamic context would wipe the blocks that active
 * instructions had just written, because they would share a prefix and not a list.
 *
 * The number is padded because `sort()` compares strings: without the padding, tier 100
 * would come before tier 20.
 *
 * @param {string} tier
 * @param {string|number} id
 * @param {string} [source] Who injected it.
 * @returns {string}
 */
export function promptKey(tier, id, source = 'dyn') {
    const found = PROMPT_TIERS.find(t => t.id === tier) ?? PROMPT_TIERS.find(t => t.id === FALLBACK_TIER);
    const order = String(found?.order ?? 99).padStart(3, '0');
    const clean = String(id ?? '').replace(/[^A-Za-z0-9_-]/g, '_');
    const who = String(source ?? 'dyn').replace(/[^a-z]/gi, '').toLowerCase() || 'dyn';
    return `GAME_${order}_${found?.id ?? FALLBACK_TIER}_${who}_${clean}`;
}

/**
 * Whether a key belongs to this game, and optionally to one particular injector.
 *
 * @param {string} key
 * @param {string} [source]
 * @returns {boolean}
 */
export function isPromptKey(key, source = '') {
    const text = String(key ?? '');
    if (!text.startsWith('GAME_')) return false;
    if (!source) return true;
    return text.split('_')[3] === String(source).toLowerCase();
}

/**
 * Sort a list of keys the way SillyTavern will.
 *
 * Here so a test can prove the order without reaching into the application, and so the
 * panel can show it.
 *
 * @param {string[]} keys
 * @returns {string[]}
 */
export function sortLikeSillyTavern(keys) {
    return [...(Array.isArray(keys) ? keys : [])].sort();
}

/**
 * How much of two prompts is the same from the start.
 *
 * This is the number that says whether any of this worked: it is, near enough, what a
 * provider will find cached. Measured in characters, because that is what can be compared
 * exactly; the token figure beside it is the usual four-to-one estimate and is labelled
 * as one wherever it is shown.
 *
 * @param {string} previous
 * @param {string} current
 * @returns {{chars: number, ratio: number, divergedAt: number}}
 */
export function stablePrefix(previous, current) {
    const a = String(previous ?? '');
    const b = String(current ?? '');
    const limit = Math.min(a.length, b.length);

    let i = 0;
    while (i < limit && a[i] === b[i]) i++;

    return {
        chars: i,
        ratio: b.length > 0 ? i / b.length : 0,
        divergedAt: i >= limit && a.length === b.length ? -1 : i,
    };
}

/**
 * What the blocks look like once sorted, and where the volatile part begins.
 *
 * The boundary is the useful number: everything before it is worth caching, everything
 * after it is going to be re-read on every turn whatever you do.
 *
 * @param {Array<{key: string, tokens?: number, label?: string}>} blocks
 * @returns {{ordered: any[], stableTokens: number, volatileTokens: number, boundary: string}}
 */
export function describeOrder(blocks) {
    const list = (Array.isArray(blocks) ? blocks : []).filter(Boolean);
    const ordered = [...list].sort((a, b) => String(a.key).localeCompare(String(b.key)));

    // Anything from the party's own sheet onwards changes with the play, not with the
    // campaign, so that is where the cache stops paying.
    const volatileFrom = PROMPT_TIERS.find(t => t.id === 'party')?.order ?? 60;
    const tierOf = (/** @type {string} */ key) => Number(String(key).split('_')[1]) || 99;

    let stableTokens = 0;
    let volatileTokens = 0;
    let boundary = '';

    for (const block of ordered) {
        const tokens = Number(block.tokens) || 0;
        if (tierOf(block.key) < volatileFrom) {
            stableTokens += tokens;
        } else {
            if (!boundary) boundary = String(block.label || block.key);
            volatileTokens += tokens;
        }
    }

    return { ordered, stableTokens, volatileTokens, boundary };
}
