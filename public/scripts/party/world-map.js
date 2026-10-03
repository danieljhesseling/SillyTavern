/**
 * El mapa de la campaña, dibujado (J10.5 de wiki/ROADMAP_SIN_CONEXION.md), abierto desde la
 * partida: el botón «Mapa» de la cabecera, también sin conexión.
 *
 * Lo que se dibuja lo decide el motor (`world/map-layout.js`) y lo pinta `ui/campaign-map.js`;
 * aquí se junta con la partida: los sitios que se ven (los escondidos no), con sus caminos
 * pasados por sus puertas (J10.1), dónde habéis estado, vuestras notas, y viajar al pulsar
 * «Viajar aquí», con la misma pregunta de siempre (lo que cuesta, el ritmo).
 *
 * No hace nada al importarse: el mapa se arma al abrirlo.
 */

import { chat_metadata, saveMetadata } from '../../script.js';
import { mapModel } from '../game-engine/world/map-layout.js';
import { setNote } from '../game-engine/campaign/text-map.js';
import { readPlotState } from '../game-engine/campaign/plot.js';
import { HUB_BOARD_NAME_KEY } from '../game-engine/campaign/hub.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import { MAP_NOTES_KEY, PLOT_STATE_KEY, VISITED_KEY } from './keys.js';
import { currentLocationName } from './state.js';
import { currentSeason, lastPack, travelLocations, worldGates } from './world.js';
import { friendlyFactions } from './factions.js';
import { getCurrentSlotLabel } from './time.js';
import { askBeforeTravelling, travelWithTime } from './travel.js';
import { renderLocationMapsPreview } from './board-view.js';
import { guidedNow, storyStepsNow, travelForStory } from './guided.js';

/**
 * El mapa de ahora, listo para pintar: los sitios del mundo con sus caminos y sus puertas,
 * dónde estáis, lo visitado y vuestras notas.
 *
 * @returns {import('../game-engine/world/map-layout.js').MapModel}
 */
export function worldMapModel() {
    return mapModel({
        locations: travelLocations(),
        here: currentLocationName,
        visited: Array.isArray(chat_metadata?.[VISITED_KEY]) ? chat_metadata[VISITED_KEY] : [],
        notes: chat_metadata?.[MAP_NOTES_KEY] ?? {},
        friendly: friendlyFactions(),
        season: currentSeason(),
        done: readPlotState(chat_metadata?.[PLOT_STATE_KEY]).done,
        gates: worldGates(),
    });
}

/**
 * Cómo se llama el mapa: el de la campaña del tablón, si lo es.
 *
 * @returns {string}
 */
function mapTitle() {
    const name = String(chat_metadata?.[HUB_BOARD_NAME_KEY] ?? '').trim();
    return name ? `El mapa de ${name}` : 'El mapa';
}

/**
 * Abrir el mapa dibujado. Guardar una nota la apunta en la partida; «Viajar aquí» viaja como
 * la columna «Viajar»: primero se dice lo que cuesta.
 *
 * @returns {Promise<void>}
 */
export async function openWorldMap() {
    if (!chat_metadata) return;
    const model = worldMapModel();
    if (model.places.length === 0) {
        toastr.info('Aquí no hay más sitios a los que ir: el mapa sale cuando la campaña tiene localizaciones.', 'El mapa');
        return;
    }
    const { openCampaignMap } = await import('../game-engine/ui/campaign-map.js');
    // D-J62, el modo guiado: el mapa enseña todos los sitios, pero solo se viaja adonde manda la
    // historia o el encargo (como «Ir a…»), y al llegar se entra en su pelea si la hay.
    const guided = guidedNow();
    const goes = guided ? storyStepsNow().filter(step => step.kind === 'go' && step.enabled && step.place) : [];
    const stepTo = (/** @type {string} */ name) => goes.find(step => String(step.place).toLowerCase() === String(name).toLowerCase()) ?? null;
    const { travelTo } = await openCampaignMap({
        ...(guided ? { canTravel: (/** @type {string} */ name) => Boolean(stepTo(name)) } : {}),
        model,
        title: mapTitle(),
        pack: lastPack,
        night: /noche/i.test(String(getCurrentSlotLabel() ?? '')),
        onNote: (place, note) => {
            if (!chat_metadata) return;
            chat_metadata[MAP_NOTES_KEY] = setNote(chat_metadata[MAP_NOTES_KEY], place, note);
            saveMetadata();
        },
    });
    if (!travelTo) return;
    if (guided) {
        await travelForStory(travelTo, stepTo(travelTo)?.board ?? '');
        return;
    }
    const { reason } = await travelWithTime(travelTo, { confirm: askBeforeTravelling });
    // Cancelar no lleva motivo: solo se avisa de lo que impide viajar.
    if (reason) toastr.info(reason, 'No se puede viajar');
    renderLocationMapsPreview();
    if (isShellOpen()) refreshGameShell();
}
