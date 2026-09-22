/**
 * What the dialogue scene shows: who is talking, how the party is doing, and when it is.
 *
 * Pure, like the director beside it. The scene it feeds is mostly the chat itself —
 * `#sheld` is moved into the scene, not rebuilt — so what is left to decide is small and
 * worth deciding once: which message counts as "who is speaking", what to do when the
 * speaker is not in the party, and which of the party's ailments are worth an icon.
 *
 * It does not carry the line that was said. The chat is right below the portrait and
 * already shows it; printing it twice would be two places to keep in step.
 *
 * See wiki/PROPUESTA_FRONTEND_MODO_JUEGO.md, H2 · wiki/ROADMAP.md, Fase H.
 */

import { buildPartyStrip } from './party-strip.js';

/**
 * @typedef {Object} SpeakerView
 * @property {string} name
 * @property {string} avatar
 * @property {number} rank The bond rank, or 0 for anyone the party has no bond with.
 * @property {boolean} known Whether the speaker is someone in the party.
 * @property {string} rankLabel Ready to print, empty when there is no bond.
 */

/**
 * @typedef {Object} DialogueView
 * @property {string} moment "Día 3 · Tarde", straight from the calendar.
 * @property {SpeakerView|null} speaker
 * @property {import('./party-strip.js').PartyChip[]} party
 */

/**
 * Whether a chat message can be the one speaking.
 *
 * The player is not the speaker: the portrait is who the player is talking *to*. A system
 * message is not one either — the output of a slash command would otherwise take over the
 * portrait. The narrator messages this game posts are not system messages, on purpose, so
 * they still count.
 *
 * @param {any} message
 * @returns {boolean}
 */
function canSpeak(message) {
    return Boolean(message) && message.is_user !== true && message.is_system !== true;
}

/**
 * Find the speaker, and say what is known about them.
 *
 * Someone who is not in the party still gets a portrait — most of the people you talk to
 * in a campaign are not party members — but no bond rank, because there is nothing to
 * read one from.
 *
 * @param {any[]} messages The chat, oldest first.
 * @param {Array<{id: any, name: string, avatar: string, rank: number}>} known
 * @returns {SpeakerView|null}
 */
function findSpeaker(messages, known) {
    const list = Array.isArray(messages) ? messages : [];
    let message = null;
    for (let i = list.length - 1; i >= 0; i--) {
        if (canSpeak(list[i])) {
            message = list[i];
            break;
        }
    }
    // Nothing but the player's own lines: better the last thing said than no portrait.
    if (!message) {
        for (let i = list.length - 1; i >= 0; i--) {
            if (list[i] && list[i].is_user !== true) {
                message = list[i];
                break;
            }
        }
    }
    if (!message) return null;

    const name = String(message.name || '').trim();
    const member = known.find(m => m.name.toLowerCase() === name.toLowerCase()) || null;
    const avatar = member?.avatar || String(message.force_avatar || '');
    const rank = member?.rank ?? 0;

    return {
        name: name || 'Narrador',
        avatar,
        rank,
        known: Boolean(member),
        rankLabel: rank > 0 ? `Vínculo ${rank}` : '',
    };
}

/**
 * Build everything the dialogue scene draws.
 *
 * The day and the bond ranks come from `buildCampaignView`, which the campaign tab
 * already uses: two panels reading the same view model cannot disagree about what rank
 * somebody is.
 *
 * @param {Object} input
 * @param {any[]} [input.messages] The chat, oldest first.
 * @param {any[]} [input.party]
 * @param {any} [input.bonds]
 * @param {any} [input.calendar]
 * @param {any} [input.xpTable] Los umbrales de nivel del paquete de reglas activo.
 * @returns {DialogueView}
 */
export function buildDialogueView({
    messages = [], party = [], bonds = null, calendar = null, xpTable = null,
} = {}) {
    const { chips, moment } = buildPartyStrip({ party, bonds, calendar, xpTable });

    return {
        moment,
        speaker: findSpeaker(messages, chips.map(c => ({ id: c.id, name: c.name, avatar: c.avatar, rank: c.rank }))),
        party: chips,
    };
}
