/**
 * Los puntos de retorno: guardar la partida entera (y lo que cambia del mundo) y volver a
 * ella.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import { chat_metadata, saveMetadata } from '../../script.js';
import { loadWorldInfo, saveWorldInfo, refreshWorldMapGlobals, METADATA_KEY } from '../world-info.js';
import { normalizeCombatEncounter } from './combat-rules.js';
import { canCheckpoint } from '../game-engine/rules/mortality.js';
import { captureKeys, restoreKeys, captureWorld, restoreWorld } from '../game-engine/campaign/state-registry.js';
import { getActiveRuleset } from '../game-engine/rules/ruleset.js';
import {
    createCheckpoint, normalizeCheckpoints, addCheckpoint, findCheckpoint, describeCheckpoint, CHECKPOINT_KEY,
} from '../game-engine/campaign/checkpoint.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import {
    combatEncounter, currentBoardName, currentLocationName, partyMembers, setCombatBoardSelection,
    setCombatEncounter, setCurrentBoardName, setCurrentLocationName, setUsedReactions,
} from './state.js';
import { savePartyState, renderPartyMembers, postCombatNarration } from './main.js';
import { saveCombatState } from './combat-state.js';
import { renderLocationMapsPreview } from './board-view.js';
import { saveCurrentLocation, saveCurrentBoard } from './world.js';
import {
    campaign, getCampaignCalendar, getCampaignBonds, saveCampaignState, getCampaignMap, renderCampaignTab,
} from './time.js';
import { worldWrite, refreshWorldMemoryPrompt } from './world-growth.js';

/**
 * Todo lo que el juego da por cierto, listo para guardarlo o devolverlo a su sitio.
 *
 * No incluye la conversacion: el chat es de SillyTavern y tiene su propio historial.
 * Volver a un punto deja el chat como esta y el mundo como estaba.
 *
 * @returns {any}
 */
function captureGameState() {
    return {
        // U2 del pegamento: todo lo de juego que dice el registro del estado…
        ...captureKeys(chat_metadata ?? {}),
        // …y lo que vive en memoria encima, que puede ir un paso por delante de lo guardado.
        party: partyMembers,
        combatEncounter,
        calendar: getCampaignCalendar(),
        bonds: getCampaignBonds(),
        campaignMap: getCampaignMap(),
        currentLocation: currentLocationName,
        currentBoard: currentBoardName,
    };
}

/**
 * Guarda un punto de retorno.
 *
 * @param {string} label
 * @param {boolean} [automatic]
 * @returns {string}
 */
export function saveCheckpoint(label, automatic = false) {
    if (!chat_metadata || typeof chat_metadata !== 'object') return '';

    // La casilla de la campana. Con el guardado libre esto no dice nada; con el guardado
    // en el refugio es lo unico que le da peso a una herida permanente, porque si no
    // vuelves atras y Bruna conserva la pierna.
    const allowed = canCheckpoint(
        { inShelter: !currentBoardName, inCombat: Boolean(combatEncounter.active) },
        getActiveRuleset()?.survival ?? null,
    );
    if (!allowed.allowed) {
        // Un punto automatico no discute: si esta campana no guarda aqui, no guarda.
        if (!automatic) toastr.warning(allowed.reason, 'Aqui no se guarda');
        return '';
    }

    const checkpoint = createCheckpoint({ label, state: captureGameState(), automatic });
    const before = normalizeCheckpoints(chat_metadata[CHECKPOINT_KEY]);
    const after = addCheckpoint(before, checkpoint);
    chat_metadata[CHECKPOINT_KEY] = after;
    saveMetadata();
    // DU2: el mundo también vuelve. Lo que cambia de él va a un archivo aparte, para no
    // cargar el chat; el punto que se cae se lleva el suyo.
    void forgetWorldFiles(before.filter(cp => !after.some(kept => kept.id === cp.id)));
    void worldWrite(() => attachWorldToCheckpoint(checkpoint.id));

    postCombatNarration(`💾 [PARTIDA] Punto de retorno: ${describeCheckpoint(checkpoint)}.`);
    return checkpoint.id;
}

/**
 * U2 (DU2): lo que cambia del mundo jugando, copiado a un archivo para un punto de retorno.
 *
 * @param {string} id
 */
async function attachWorldToCheckpoint(id) {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName) return;
    try {
        const data = await loadWorldInfo(worldName);
        if (!data) return;
        const bytes = new TextEncoder().encode(JSON.stringify(captureWorld(data)));
        let binary = '';
        for (const byte of bytes) binary += String.fromCharCode(byte);
        const { uploadFileAttachment, deleteFileFromServer } = await import('../chats.js');
        const url = await uploadFileAttachment(`punto-${id}.json`, btoa(binary));
        const list = normalizeCheckpoints(chat_metadata?.[CHECKPOINT_KEY]);
        const target = list.find(cp => cp.id === id);
        if (!url) return;
        // El punto se cayó mientras se subía: su archivo sobra.
        if (!target) {
            await deleteFileFromServer(url, true);
            return;
        }
        target.worldFile = url;
        chat_metadata[CHECKPOINT_KEY] = list;
        saveMetadata();
    } catch (error) {
        console.error('[party] no se pudo guardar el mundo del punto', error);
    }
}

/**
 * Los archivos del mundo de los puntos que ya no están.
 *
 * @param {Array<{worldFile?: string}>} dropped
 */
async function forgetWorldFiles(dropped) {
    const files = dropped.map(cp => cp.worldFile).filter(Boolean);
    if (files.length === 0) return;
    const { deleteFileFromServer } = await import('../chats.js');
    for (const file of files) await deleteFileFromServer(String(file), true);
}

/**
 * Devolver el mundo a como estaba en un punto: sitios, facciones y dónde vive cada persona.
 *
 * @param {string} file
 * @returns {Promise<boolean>}
 */
async function restoreWorldFrom(file) {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName || !file) return false;
    try {
        const response = await fetch(file, { cache: 'no-store' });
        if (!response.ok) return false;
        const saved = await response.json();
        const data = await loadWorldInfo(worldName);
        if (!data || restoreWorld(data, saved) === 0) return false;
        await saveWorldInfo(worldName, data, true);
        await refreshWorldMapGlobals(worldName);
        return true;
    } catch (error) {
        console.error('[party] no se pudo devolver el mundo del punto', error);
        return false;
    }
}

/**
 * Devuelve la partida a un punto guardado.
 *
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function restoreCheckpoint(id) {
    const checkpoint = findCheckpoint(chat_metadata?.[CHECKPOINT_KEY], id);
    if (!checkpoint) {
        toastr.warning('Ese punto de retorno ya no esta.');
        return false;
    }

    const state = checkpoint.state ?? {};
    // U2 del pegamento: todo lo de juego vuelve a como estaba; en un punto de antes del
    // registro (versión 1), solo lo que traía.
    if (chat_metadata) restoreKeys(chat_metadata, state, Number(checkpoint.version) >= 2);

    // El grupo se reemplaza en el sitio: `partyMembers` es el array que todo el resto del
    // archivo tiene cogido, asi que cambiarlo por otro dejaria media interfaz mirando al
    // anterior.
    partyMembers.length = 0;
    for (const member of (Array.isArray(state.party) ? state.party : [])) {
        partyMembers.push(structuredClone(member));
    }

    setCombatEncounter(normalizeCombatEncounter(structuredClone(state.combatEncounter ?? null)));
    setCurrentLocationName(String(state.currentLocation ?? ''));
    setCurrentBoardName(String(state.currentBoard ?? ''));
    setCombatBoardSelection({ tokenId: null, boardName: '', locationName: '' });
    setUsedReactions(new Set());

    saveCampaignState(structuredClone(state.calendar ?? null), structuredClone(state.bonds ?? null));
    if (state.campaignMap) campaign.saveMap(structuredClone(state.campaignMap));

    savePartyState();
    saveCombatState();
    saveCurrentLocation();
    saveCurrentBoard();

    // DU2: y el mundo, si el punto lo guardó.
    let world = false;
    if (checkpoint.worldFile) {
        await worldWrite(async () => {
            world = await restoreWorldFrom(String(checkpoint.worldFile));
        });
    }
    saveMetadata();
    refreshWorldMemoryPrompt();

    renderPartyMembers();
    renderCampaignTab();
    renderLocationMapsPreview();
    if (isShellOpen()) refreshGameShell();

    postCombatNarration(`⏪ [PARTIDA] Vuelta a: ${describeCheckpoint(checkpoint)}.${world ? ' El mundo también vuelve a como estaba.' : ''}`);
    return true;
}
