/**
 * El modo de la partida (R1): sus interruptores y cambiarlo a mitad de partida.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import { POPUP_TYPE, Popup } from '../popup.js';
import { chat_metadata, saveMetadata } from '../../script.js';
import { loadWorldInfo, saveWorldInfo, METADATA_KEY } from '../world-info.js';
import { readSurvival } from '../game-engine/rules/mortality.js';
import {
    describeMode as describeGameMode, recordModeChange, modeOf, MODES as GAME_MODES,
} from '../game-engine/rules/modes.js';
import { rememberRuleset, setActiveRuleset, getActiveRuleset } from '../game-engine/rules/ruleset.js';
import { LEAVE_ON_KEY, MODE_HISTORY_KEY, SAFETY_ON_KEY } from './keys.js';
import { campaignDay, renderCampaignTab } from './time.js';
import { refreshWorldMemoryPrompt } from './world-growth.js';
import { postCombatNarration } from './main.js';

/**
 * Lo que queda de alguien que ha fallado su tercera salvacion.
 *
 * Las dos salidas son de la campana, no mias: se eligieron al crearla. Y la herida se
 * escribe **encima de la ficha**, no al lado, porque `speed` y la CA se leen en veinte
 * sitios y ninguno deberia tener que preguntar si el que corre esta cojo.
 *
 * @param {any} member
 */
/**
 * Las reglas de filo de esta campana.
 *
 * @returns {any}
 */
export function currentSurvival() {
    return readSurvival(getActiveRuleset()?.survival ?? null);
}

/**
 * R1 del roadmap de profundidad: los interruptores tal como están en el paquete, para
 * preguntar por letras (`hasLetter`) y filtrar lo que no existe en este modo.
 *
 * @returns {any}
 */
export function survivalNow() {
    return getActiveRuleset()?.survival ?? null;
}

/**
 * R1: los ajustes de la pausa que trae el modo (la red de seguridad, que los hartos se
 * vayan), puestos al empezar una partida. Solo lo que nadie ha tocado todavía.
 */
export function applyModeExtras() {
    if (!chat_metadata) return;
    const extras = /** @type {any} */ (GAME_MODES)[modeOf(survivalNow())]?.extras;
    if (!extras) return;
    if (chat_metadata[SAFETY_ON_KEY] === undefined) chat_metadata[SAFETY_ON_KEY] = Boolean(extras.safetyNet);
    if (chat_metadata[LEAVE_ON_KEY] === undefined) chat_metadata[LEAVE_ON_KEY] = Boolean(extras.companionsLeave);
    saveMetadata();
}

/**
 * R1 del roadmap de profundidad: cambiar el modo a mitad de partida (DR2).
 *
 * Los interruptores viven en el paquete de reglas del mundo, así que ahí se escriben; se
 * leen en directo, sin recargar. El cambio queda en la crónica y en el historial, y los
 * ajustes de la pausa que el modo trae (la red de seguridad, que los hartos se vayan) se
 * ponen como los pone el modo: luego se tocan sueltos si se quiere.
 *
 * @returns {Promise<string>}
 */
export async function openGameMode() {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName || !chat_metadata) {
        toastr.warning('Abre una campaña antes de cambiarle el modo.');
        return '';
    }
    const before = readSurvival(survivalNow());
    const { openModePanel } = await import('../game-engine/ui/mode-panel.js');
    const chosen = await openModePanel({
        survival: before,
        Popup,
        POPUP_TYPE,
        hint: 'Se puede cambiar cuando quieras, y queda escrito. Una partida que baja de Supervivencia deja de contar como de hierro.',
    });
    if (!chosen) return '';
    const change = recordModeChange({ from: before, to: chosen, day: campaignDay(), history: chat_metadata[MODE_HISTORY_KEY] ?? null });
    if (!change.changed) return '';

    try {
        const data = await loadWorldInfo(worldName);
        if (!data) throw new Error(`no se pudo leer el mundo «${worldName}»`);
        const pack = structuredClone(data.metadata?.rulesetPack ?? { id: 'campaign', name: worldName });
        pack.survival = chosen;
        data.metadata = data.metadata ?? {};
        data.metadata.rulesetPack = pack;
        await saveWorldInfo(worldName, data, true);
        // Recordado para la próxima carga: si no, al volver diría que hay reglas nuevas.
        rememberRuleset(pack);
        setActiveRuleset(pack);
    } catch (error) {
        console.error('[party] el modo no se pudo guardar', error);
        toastr.error('No se pudo guardar el modo. Sigue el de antes.', 'Modo de juego');
        return '';
    }

    chat_metadata[MODE_HISTORY_KEY] = change.history;
    const extras = /** @type {any} */ (GAME_MODES)[modeOf(chosen)]?.extras;
    if (extras) {
        chat_metadata[SAFETY_ON_KEY] = Boolean(extras.safetyNet);
        chat_metadata[LEAVE_ON_KEY] = Boolean(extras.companionsLeave);
    }
    saveMetadata();
    postCombatNarration(`⚙️ [MODO] ${change.line} ${describeGameMode(chosen)}.`);
    renderCampaignTab();
    refreshWorldMemoryPrompt();
    toastr.success(describeGameMode(chosen), 'Modo de juego');
    return change.line;
}
