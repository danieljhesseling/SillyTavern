/**
 * El panel del grupo: montarlo y cambiar de pestaña.
 *
 * `initPartyPanel` es lo que llama `script.js` al arrancar. Monta el panel de la derecha y
 * registra, en este orden, los comandos (`commands.js`), lo del modelo y los eventos del chat
 * (`events.js`). El resto del juego vive en los otros módulos de `party/`; `party.js` es la
 * fachada que los reexporta.
 *
 * Era `party.js` entero hasta J15.1 (wiki/ROADMAP_SIN_CONEXION.md).
 */

import { chat_metadata, eventSource, event_types } from '../../script.js';
import { loadWorldInfo, METADATA_KEY } from '../world-info.js';
import { createSeededRandom } from '../game-engine/combat/seeded-random.js';
import { setRandomSource } from './combat-rules.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import { SEED_KEY } from './keys.js';
import { partyMembers, setTalkingTo } from './state.js';
import { loadLocationMapsVisibility, renderLocationMapsPreview, renderWorldMapPreview } from './board-view.js';
import { applyCampaignRuleset } from './world.js';
import { renderCampaignTab } from './time.js';
import { applyNarratorFont } from './narration.js';
import {
    getDndEntryType, getPartyEntryDisplayName, loadPartyForChat, memberFromEntry, renderPartyMembers,
    savePartyState, showCharacterPicker, updatePartyMemberFromPersona,
} from './roster.js';
import { autostartGameShell } from './shell.js';
import { registerPartyCommands } from './commands.js';
import { registerChatEvents, registerModelTools } from './events.js';
import { registerKnownPeople } from './known-people.js';

/**
 * La función que cambia de pestaña en el panel de la derecha, una vez montado el panel.
 * `initPartyPanel` la pone; antes es null y quien la llame no hace nada (`board.js`).
 * @type {((tab: 'party'|'world_map'|'location'|'campaign') => void)|null}
 */
export let partyTabSetter = null;

/**
 * @param {'party'|'world_map'|'location'|'campaign'|'board'} tab
 */
export function setPartyTab(tab) {
    const worldMapRow = $('#world_map_row');
    const locationRow = $('#world_location_maps_row');
    const campaignRow = $('#campaign_panel_row');
    const partyList = $('#rm_party_list');
    const partyFixedTop = $('#partyListFixedTop');

    // Remap legacy 'board' tab to 'location'
    const normalizedTab = /** @type {'party'|'world_map'|'location'|'campaign'} */ (tab === 'board' ? 'location' : tab);

    $('.right_menu_tab').removeClass('active');
    $(`#rm_tab_${normalizedTab}`).addClass('active');

    // show party pane and hidden others per tab
    partyList.toggleClass('tab-panel-hidden', normalizedTab !== 'party');
    partyFixedTop.toggleClass('tab-panel-hidden', normalizedTab !== 'party');
    worldMapRow.toggleClass('tab-panel-hidden', normalizedTab !== 'world_map');
    locationRow.toggleClass('tab-panel-hidden', normalizedTab !== 'location');
    campaignRow.toggleClass('tab-panel-hidden', normalizedTab !== 'campaign');

    if (normalizedTab === 'party') {
        renderPartyMembers();
    } else if (normalizedTab === 'world_map') {
        renderWorldMapPreview();
    } else if (normalizedTab === 'location') {
        renderLocationMapsPreview();
    } else if (normalizedTab === 'campaign') {
        renderCampaignTab();
    }

    try {
        window.localStorage.setItem('rm_PinAndTabs_selectedTab', normalizedTab);
    } catch (e) {
        console.warn('Unable to store selected tab', e);
    }
}


export function initPartyPanel() {
    // Desde aquí el panel existe: `partyTabSetter` ya puede cambiar de pestaña.
    partyTabSetter = setPartyTab;
    // J13.7: las ventanas preguntan aquí cómo se llama a cada uno (solo a quien se ha presentado).
    registerKnownPeople();

    // The campaign tab is created from here, not from index.html: that file is
    // upstream's, and every line the fork adds to it is paid for at every merge.
    if ($('#rm_tab_campaign').length === 0) {
        $('<div class="right_menu_tab" id="rm_tab_campaign" data-tab="campaign" title="Calendario y vínculos">Campaña</div>')
            .insertAfter('#rm_tab_location');
    }
    if ($('#campaign_panel_row').length === 0) {
        $('<div id="campaign_panel_row" class="world-map-row width100p marginTop10 tab-panel-hidden"></div>')
            .insertAfter('#world_location_maps_row');
    }

    const panel = $('#rm_party_block');
    if (!panel.length) {
        return;
    }

    loadLocationMapsVisibility();

    $('#party_add_button').off('click').on('click', async () => {
        const worldName = chat_metadata ? chat_metadata[METADATA_KEY] : null;
        if (!worldName) {
            toastr.warning('Esta partida no tiene mundo: empieza una campaña primero.');
            return;
        }

        const data = /** @type {any} */ (await loadWorldInfo(worldName));
        if (!data?.entries) {
            toastr.warning('No se pudo leer el mundo de esta partida.');
            return;
        }

        // Filter to "Characters" group, exclude members already in party
        const existingNames = new Set(partyMembers.map(m => m.name.toLowerCase()));
        const existingUids = new Set(partyMembers.filter(m => m.wiUid != null).map(m => m.wiUid));
        const charEntries = [];
        for (const uid of Object.keys(data.entries)) {
            const entry = data.entries[uid];
            const group = (entry.group || '').trim().toLowerCase();
            const entityType = getDndEntryType(entry);
            const isCharacterEntry = entityType === 'character' || entityType === 'npc' || group.includes('character');
            if (!isCharacterEntry) continue;
            // Exclude already-in-party by uid or name
            if (existingUids.has(Number(entry.uid))) continue;
            const entryName = getPartyEntryDisplayName(entry).toLowerCase();
            if (existingNames.has(entryName)) continue;
            charEntries.push(entry);
        }

        if (charEntries.length === 0) {
            toastr.info('No queda nadie del mundo por sumar: ya están todos en el grupo.');
            return;
        }

        // Build a picker popup
        const selected = await showCharacterPicker(charEntries);
        if (!selected) return;

        partyMembers.push(memberFromEntry(selected, worldName));
        renderPartyMembers();
        savePartyState();
    });

    $(document).on('personaStateUpdated', (_, avatarId, newState) => {
        updatePartyMemberFromPersona(avatarId, newState);
    });

    $(document).on('worldMapUpdated', () => {
        renderWorldMapPreview();
    });

    $(document).on('worldLocationMapsUpdated', () => {
        renderLocationMapsPreview();
    });


    $('#rm_tab_campaign').on('click', () => setPartyTab('campaign'));
    $('#rm_tab_party').on('click', () => setPartyTab('party'));
    $('#rm_tab_world_map').on('click', () => setPartyTab('world_map'));
    $('#rm_tab_location').on('click', () => setPartyTab('location'));

    $(document).on('click', '.party-remove-member', null, () => {
        // handled by individual buttons
    });

    // Read the party from the chat that is already open; CHAT_CHANGED keeps it
    // in sync from here on. loadPartyForChat() renders on its own.
    loadPartyForChat();
    renderWorldMapPreview();
    renderLocationMapsPreview();

    // Restore per-session party when chat changes
    // El juego se abre por su pantalla de titulo. Se espera a que la aplicacion termine de
    // cargar — antes de APP_READY el chat todavia se esta montando, y adoptarlo a medias
    // deja la pantalla en blanco.
    eventSource.on(event_types.APP_READY, () => {
        // Un respiro para que la pantalla de bienvenida acabe de dibujar sus campanas: es
        // lo que el menu cuenta en "Cargar partida".
        setTimeout(() => autostartGameShell(), 400);
    });

    eventSource.on(event_types.CHAT_CHANGED, () => {
        loadPartyForChat();
        // Idea 195: la letra del narrador es de la campaña.
        applyNarratorFont();
        // Idea 144: en otra partida no se está hablando con nadie.
        setTalkingTo('');
        // Y volver a dibujar donde estabas. `loadPartyForChat` restaura la localidad y el
        // tablero en memoria, pero nadie repintaba el panel: al cargar una partida veias
        // el selector de "¿donde estas?" y habia que volver a entrar a mano en el sitio
        // donde ya estabas. Si el mundo aun no ha terminado de cargar, el evento
        // `worldLocationMapsUpdated` vuelve a pasar por aqui.
        renderWorldMapPreview();
        renderLocationMapsPreview();
        // Cerrar la partida ya no apaga el Modo Juego: sin campana abierta, la escena
        // de titulo ensena la bienvenida con las campanas, que es donde hay que estar.
        if (isShellOpen()) refreshGameShell();

        // La semilla es de la partida, no de la sesion: abrir una campana con semilla
        // fijada tiene que volver a fijarla, o el "mismo" combate saldria distinto.
        const seed = chat_metadata?.[SEED_KEY];
        setRandomSource(seed ? createSeededRandom(String(seed)) : null);
        // The campaign may play by its own rules; see applyCampaignRuleset.
        applyCampaignRuleset(String(chat_metadata?.[METADATA_KEY] || ''))
            .catch(error => console.error('[party] campaign ruleset failed', error));
    });

    /** @type {'party'|'world_map'|'location'|'campaign'} */
    const initiallySelected = /** @type {'party'|'world_map'|'location'|'campaign'} */ (window.localStorage.getItem('rm_PinAndTabs_selectedTab') || 'party');
    if (typeof setPartyTab === 'function') {
        setPartyTab(initiallySelected);
    }

    registerPartyCommands();
    registerModelTools();
    registerChatEvents();
}
