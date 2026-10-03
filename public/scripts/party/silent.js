/**
 * Quien de los tuyos aún no habla (tanda 22): Grimm, hasta el rango 8 (`campaign/mute.js`). Lo
 * leen los gritos de la pelea y las opiniones (`companions.js`) y quién cuenta algo
 * (`narration.js`, `voiceScene`).
 */

import { chat_metadata } from '../../script.js';
import { getBondProgress, normalizeBondState } from '../game-engine/campaign/bonds.js';
import { isSilent, silentRow } from '../game-engine/campaign/mute.js';
import { BONDS_KEY } from './campaign-state.js';
import { lastCompendium } from './world.js';

/**
 * Si alguien del grupo aún no habla: su ficha dice hasta qué rango calla y aún no ha llegado.
 *
 * @param {any} member
 * @returns {boolean}
 */
export function silentNow(member) {
    const name = String(member?.name ?? '').trim();
    if (!name || !lastCompendium?.has?.('companeros')) return false;
    const row = silentRow(name, lastCompendium.find('companeros'));
    if (!row) return false;
    const rank = getBondProgress(normalizeBondState(chat_metadata?.[BONDS_KEY]), String(member?.id ?? '')).rank;
    return isSilent(row, rank);
}
