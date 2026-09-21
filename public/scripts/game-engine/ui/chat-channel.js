/**
 * Who a game message is for.
 *
 * SillyTavern strips system messages from the prompt (`script.js`:
 * `chat.filter(x => !x.is_system || ...)`). That is the mechanism that makes a whole
 * combat cost nothing: every blow-by-blow line is a system message the model never reads.
 *
 * It is also how a message meant for the model got lost in silence. `endCombat` built an
 * epilogue prompt and posted it with `sendSystemMessage`, so the player saw it and the
 * model did not — and nothing failed, which is why it survived a review.
 *
 * This module makes the choice explicit and testable: a caller names the audience, and
 * `is_system` follows from that instead of from which helper happened to be nearby.
 */

/** Audiences a game message can have. */
export const CHANNEL = {
    /** The player only. Filtered out of the prompt, so it is free. */
    PLAYER: 'player',
    /** The player and the model. Enters the next prompt, so it costs context. */
    MODEL: 'model',
};

/** Message type SillyTavern uses for narration that is not a character talking. */
export const NARRATOR_TYPE = 'narrator';

/**
 * @typedef {Object} GameMessage
 * @property {string} name
 * @property {boolean} is_user
 * @property {boolean} is_system    False is what puts a message in the prompt.
 * @property {string} send_date
 * @property {string} mes
 * @property {string} force_avatar
 * @property {Object} extra
 */

/**
 * Builds a chat message for a named audience.
 *
 * Shaped after `sendNarratorMessage` in slash-commands.js (what `/sys` sends), because a
 * message the renderer has never seen before is a message that renders wrong.
 *
 * @param {Object} input
 * @param {string} input.text
 * @param {string} input.channel       One of CHANNEL.
 * @param {string} [input.name]        Speaker label. Defaults to 'Narrador'.
 * @param {string} [input.avatar]      Avatar path, normally `system_avatar`.
 * @param {string} [input.timestamp]   ISO date; injected so tests are deterministic.
 * @param {boolean} [input.compact]    Small-system styling, as in /sys compact=true.
 * @returns {GameMessage}
 */
export function buildGameMessage({ text, channel, name = 'Narrador', avatar = '', timestamp = '', compact = true }) {
    const forModel = channel === CHANNEL.MODEL;

    return {
        name: String(name),
        is_user: false,
        // The whole point of this module: the audience decides this flag, nothing else.
        is_system: !forModel,
        send_date: String(timestamp),
        mes: String(text ?? '').trim(),
        force_avatar: String(avatar),
        extra: {
            type: NARRATOR_TYPE,
            bias: null,
            gen_id: null,
            isSmallSys: Boolean(compact),
            api: 'manual',
            model: 'game-engine',
        },
    };
}

/**
 * Whether SillyTavern will include this message in the next prompt.
 *
 * Mirrors the filter in `script.js` so a test can assert the outcome that matters —
 * "does the model read this?" — rather than the flag that implements it.
 *
 * @param {{is_system?: boolean}} message
 * @returns {boolean}
 */
export function reachesModel(message) {
    return message?.is_system === false;
}
