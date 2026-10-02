/**
 * J4.2: la partida es el gremio (wiki/ROADMAP_SIN_CONEXION.md). El pegamento del almacén de la
 * partida (`game-engine/campaign/game-state.js`): busca el mundo del gremio del chat abierto,
 * decide con su almacén y guarda los dos.
 *
 * Se llama en tres sitios:
 *
 * - al abrir cualquier chat (`loadPartyForChat`): si es del gremio o de una campaña suya, su copia
 *   del gremio se pone al día (o sube, si fue el último que escribió);
 * - en los viajes (`playHubCampaign`, `returnToHub`): antes de salir y al llegar, en su orden.
 *   Mientras dura el viaje, lo de abrir un chat espera (`holdGameSync`): el viaje lo hace él;
 * - al volver a un punto de retorno y antes de guardar la partida en una ranura.
 */

import { chat_metadata, saveMetadata, getCurrentChatId } from '../../script.js';
import { loadWorldInfo, saveWorldInfo, METADATA_KEY } from '../world-info.js';
import { isHubWorld, hubHomeOf } from '../game-engine/campaign/hub.js';
import { HUB_STATE_KEY, HUB_STATE_REV_KEY, planGameSync, pullGameKeys } from '../game-engine/campaign/game-state.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import { worldWrite } from './world-growth.js';

/** Cuántos viajes hay en marcha: mientras, abrir un chat no sincroniza solo. */
let travelling = 0;

/** Una cosa detrás de otra: dos sincronizaciones a la vez escribirían el mundo dos veces. */
let queue = Promise.resolve(/** @type {any} */ (null));

/**
 * Un viaje entre el gremio y una campaña empieza (`true`) o acaba (`false`).
 *
 * @param {boolean} on
 */
export function holdGameSync(on) {
    travelling = Math.max(0, travelling + (on ? 1 : -1));
}

/**
 * El mundo del gremio de un mundo: él mismo si es un gremio; si es una campaña del tablón, del
 * que sale. Vacío si no es de ninguna partida del gremio.
 *
 * @param {string} worldName
 * @returns {Promise<string>}
 */
async function hubWorldOf(worldName) {
    const data = await loadWorldInfo(worldName).catch(() => null);
    if (isHubWorld(data?.metadata)) return worldName;
    return hubHomeOf(data?.metadata);
}

/**
 * Pone al día la copia del gremio del chat abierto con el almacén de la partida, o sube la suya.
 *
 * @param {{force?: boolean, restore?: boolean}} [options] `force`: también durante un viaje (lo usa
 *   el viaje). `restore`: se acaba de volver a un punto de retorno; si desde él solo ha escrito este
 *   chat, su gremio vuelve al almacén.
 * @returns {Promise<{action: string, changed: string[]}|null>} Lo que se hizo, o null si el chat
 *   no es de una partida del gremio.
 */
export function syncGameState({ force = false, restore = false } = {}) {
    if (travelling > 0 && !force) return Promise.resolve(null);
    const job = queue.then(() => syncNow(restore));
    queue = job.catch(() => null);
    return job.catch(error => {
        console.error('[partida] no se pudo poner al día el gremio', error);
        return null;
    });
}

/**
 * @param {boolean} restore
 * @returns {Promise<{action: string, changed: string[]}|null>}
 */
async function syncNow(restore) {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    const chatId = String(getCurrentChatId() ?? '');
    if (!worldName || !chatId || !chat_metadata) return null;
    const hubName = await hubWorldOf(worldName);
    if (!hubName) return null;
    /** @type {{action: string, changed: string[]}|null} */
    let done = null;
    // En la fila de las escrituras del mundo: al llegar a un sitio, el hilo, la gente y las
    // reputaciones también escriben el del gremio, y sin fila el último borraría lo de los demás.
    await worldWrite(async () => {
        const hub = await loadWorldInfo(hubName);
        if (!hub || !isHubWorld(hub.metadata)) return;
        // Mientras se esperaba se ha podido abrir otro chat: ese se pondrá al día solo.
        if (String(getCurrentChatId() ?? '') !== chatId || !chat_metadata) return;

        const plan = planGameSync({ store: hub.metadata[HUB_STATE_KEY], chatId, meta: chat_metadata, restore });
        const revBefore = chat_metadata[HUB_STATE_REV_KEY];
        const changed = plan.pull ? pullGameKeys(chat_metadata, plan.store) : [];
        chat_metadata[HUB_STATE_REV_KEY] = plan.store.rev;
        // Primero el chat (es el abierto). Si el mundo no llegara a guardarse, el chat iría por
        // delante del almacén y la próxima vez lo subiría.
        if (changed.length > 0 || revBefore !== plan.store.rev) await saveMetadata();
        if (plan.storeChanged) {
            hub.metadata[HUB_STATE_KEY] = plan.store;
            await saveWorldInfo(hubName, hub, true);
        }
        if (changed.length > 0 && isShellOpen()) refreshGameShell();
        done = { action: plan.action, changed };
    });
    return done;
}
