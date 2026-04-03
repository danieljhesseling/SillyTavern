import { t } from './i18n.js';
import { askForPersonaSelection } from './personas.js';
import { power_user } from './power-user.js';
import { POPUP_TYPE, Popup } from './popup.js';
import { getThumbnailUrl } from '../script.js';
import { getCurrentWorldMapUrl, getCurrentWorldLocationMaps, getCurrentWorldBoards } from './world-info.js';

/**
 * @typedef {Object} PartyMember
 * @property {number} id
 * @property {string|null} personaId
 * @property {string} name
 * @property {string} avatar
 * @property {number} level
 * @property {string} class
 * @property {number} hp
 * @property {number} maxHp
 * @property {number} xp
 * @property {number} xpNext
 * @property {number} gold
 * @property {number} silver
 * @property {number} copper
 * @property {string} inventory
 * @property {string} conditions
 */

/** @type {PartyMember[]} */
let partyMembers = [];

function savePartyState() {
    try {
        window.localStorage.setItem('sillytavern_partyMembers', JSON.stringify(partyMembers));
    } catch (e) {
        console.warn('Unable to save party state', e);
    }
}

function loadPartyState() {
    try {
        const raw = window.localStorage.getItem('sillytavern_partyMembers');
        if (!raw) return;

        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            partyMembers = parsed.filter((member) => member && member.id && member.name);
        }
    } catch (e) {
        console.warn('Unable to load party state', e);
    }
}

function renderPartyMembers() {
    const list = $('#rm_party_list');
    if (!list.length) return;

    list.empty();

    if (partyMembers.length === 0) {
        list.append(
            `<div class="flex-container alignitemscenter justifyCenter padding10"><small data-i18n="No party members.">No party members.</small></div>`
        );
        return;
    }

    for (const member of partyMembers) {
        const card = $(
            `<div class="party-card" data-member-id="${member.id}">
                <img class="party-card-avatar" src="${member.avatar}" alt="${member.name}" />
                <div class="party-card-body">
                    <div class="party-card-heading">
                        <strong class="party-card-name">${member.name}</strong>
                        <button class="party-card-remove menu_button fa-solid fa-trash-can" title="Remove member" data-i18n="[title]Remove member"></button>
                    </div>
                    <div class="party-card-meta">
                        <span data-i18n="[title]Level">Lvl ${member.level}</span>
                        <span>${member.class}</span>
                    </div>
                    <div class="party-card-stats">
                        <div class="party-card-stat">
                            <div class="stat-label" data-i18n="HP">HP</div>
                            <div class="stat-value">${member.hp}/${member.maxHp}</div>
                        </div>
                        <div class="party-card-stat">
                            <div class="stat-label" data-i18n="EXP">EXP</div>
                            <div class="stat-value">${member.xp}</div>
                        </div>
                    </div>
                </div>
            </div>`
        );

        card.find('.party-card-remove').on('click', (event) => {
            event.stopPropagation();
            removePartyMember(member.id);
        });

        card.on('click', () => {
            openPartyMemberModal(member).catch((error) => {
                console.error('Failed to open party member modal', error);
            });
        });

        list.append(card);
    }
}

// Interactive scroll zoom + drag pan on image element
function connectImageZoom(img) {
    if (!img || img.length === 0) return;

    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    const applyTransform = () => {
        img.css('transform', `translate(${offsetX}px, ${offsetY}px) scale(${scale})`);
    };

    img.css({
        transformOrigin: 'center center',
        cursor: 'grab'
    });

    img.off('.imageZoom');

    img.on('wheel.imageZoom', (event) => {
        event.preventDefault();
        const delta = event.originalEvent.deltaY < 0 ? 0.12 : -0.12;
        const newScale = Math.min(Math.max(0.6, scale + delta), 4);
        if (newScale !== scale) {
            scale = newScale;
            applyTransform();
        }
    });

    img.on('mousedown.imageZoom', (event) => {
        event.preventDefault();
        isDragging = true;
        lastX = event.pageX;
        lastY = event.pageY;
        img.css('cursor', 'grabbing');
    });

    $(document).on('mousemove.imageZoom', (event) => {
        if (!isDragging) return;
        const dx = event.pageX - lastX;
        const dy = event.pageY - lastY;
        lastX = event.pageX;
        lastY = event.pageY;
        offsetX += dx;
        offsetY += dy;
        applyTransform();
    });

    $(document).on('mouseup.imageZoom', () => {
        if (!isDragging) return;
        isDragging = false;
        img.css('cursor', 'grab');
    });

    img.on('dblclick.imageZoom', () => {
        scale = 1;
        offsetX = 0;
        offsetY = 0;
        applyTransform();
    });
}

function renderWorldMapPreview() {
    const mapUrl = getCurrentWorldMapUrl();
    const img = $('#world_map_preview_img');
    const empty = $('#world_map_preview_empty');

    if (mapUrl) {
        img.attr('src', mapUrl)
            .show();
        empty.hide();
        connectImageZoom(img);
    } else {
        img.off('.imageZoom').hide();
        empty.show();
    }
}

// world map preview logic maintained in connectImageZoom and renderWorldMapPreview above.

/**
 * @param {string} containerId
 * @param {{name:string,url:string}[]} items
 * @param {string} noItemsText
 */
function renderCollectionArea(containerId, items, noItemsText) {
    const container = $(`#${containerId}`);
    if (!container.length) return;

    if (!items || items.length === 0) {
        container.html(`<div class="textAlignCenter opacity50p">${noItemsText}</div>`);
        return;
    }

    const isSpecial = containerId === 'world_location_maps_list' || containerId === 'world_boards_list';

    if (isSpecial && items.length > 0) {
        const item = items[0];
        const image = item.url ? `<img src="${item.url}" class="world-map-image" alt="${item.name || 'map'}" />` : '';
        container.html(`
            <div class="world-map-preview">
                <div class="world-map-item-name">${item.name || t`Unnamed`}</div>
                ${image}
            </div>
        `);
        const mapImg = container.find('.world-map-image');
        connectImageZoom(mapImg);
        return;
    }

    const cards = items.map((item) => {
        const image = item.url ? `<img src="${item.url}" class="world-map-thumbnail" alt="${item.name || 'map'}" />` : '';
        return `
            <div class="world-map-item-card">
                <div class="world-map-item-name">${item.name || t`Unnamed`}</div>
                ${image}
            </div>
        `;
    });

    container.html(`<div class="world-map-items_grid">${cards.join('')}</div>`);

    const thumbnails = container.find('.world-map-thumbnail');
    thumbnails.css('cursor', 'zoom-in');
    connectImageZoom(thumbnails);
}


function renderLocationMapsPreview() {
    const locationMaps = getCurrentWorldLocationMaps();
    renderCollectionArea('world_location_maps_list', locationMaps, t`No location maps available.`);
}

function renderBoardsPreview() {
    const boards = getCurrentWorldBoards();
    renderCollectionArea('world_boards_list', boards, t`No boards available.`);
}

/**
 * @param {PartyMember} member
 */
async function openPartyMemberModal(member) {
    const popupContent = $(
        `<div class="party-member-modal">
            <div class="popup_header"><h3>${member.name}</h3></div>
            <div class="popup_body">
                <div class="party-member-modal-avatar-wrap">
                    <img class="party-member-modal-avatar" src="${member.avatar}" alt="${member.name}" />
                </div>
                <div class="party-member-modal-details">
                    <p><strong>${t`Level`}:</strong> ${member.level}</p>
                    <p><strong>${t`HP`}:</strong> ${member.hp}/${member.maxHp}</p>
                    <p><strong>${t`EXP`}:</strong> ${member.xp}/${member.xpNext}</p>
                    <p><strong>${t`Gold`}:</strong> ${member.gold}g ${member.silver}s ${member.copper}c</p>
                    <p><strong>${t`Inventory`}:</strong> ${member.inventory || t`None`}</p>
                    <p><strong>${t`Conditions`}:</strong> ${member.conditions || t`None`}</p>
                </div>
            </div>
        </div>`
    );

    const popup = new Popup(popupContent, POPUP_TYPE.TEXT, member.name, {
        wide: true,
        allowVerticalScrolling: true,
    });

    await popup.show();
}

/**
 * @param {string} personaIdOrName
 */
export function addPartyMember(personaIdOrName) {
    if (!personaIdOrName || !personaIdOrName.trim()) {
        return;
    }

    /** @type {{[key: string]: string}} */
    const userPersonas = power_user?.personas || {};
    const isPersonaId = !!userPersonas[personaIdOrName];
    const name = isPersonaId ? userPersonas[personaIdOrName] : personaIdOrName.trim();

    const normalized = name.toLowerCase();
    if (partyMembers.some((member) => member.name.toLowerCase() === normalized)) {
        return;
    }

    const avatar = isPersonaId ? getThumbnailUrl('persona', personaIdOrName) : 'img/user-avatar.png';

    /** @type {any} */
    const descriptor = power_user.persona_descriptions || {};
    /** @type {{hp_current?: number, hp_max?: number, xp_current?: number, xp_next?: number, level?: number, gold?: number, silver?: number, copper?: number, inventory?: string, conditions?: string}|null} */
    const personaState = isPersonaId ? descriptor[personaIdOrName]?.player_state : null;
    const base = {
        id: Date.now(),
        personaId: isPersonaId ? personaIdOrName : null,
        name,
        avatar,
        level: personaState?.level ?? 1,
        class: 'Adventurer',
        hp: personaState?.hp_current ?? 30,
        maxHp: personaState?.hp_max ?? 30,
        xp: personaState?.xp_current ?? 0,
        xpNext: personaState?.xp_next ?? 100,
        gold: personaState?.gold ?? 0,
        silver: personaState?.silver ?? 0,
        copper: personaState?.copper ?? 0,
        inventory: personaState?.inventory ?? '',
        conditions: personaState?.conditions ?? '',
    };

    partyMembers.push(base);
    renderPartyMembers();
    savePartyState();
}

/**
 * @param {number} memberId
 */
export function removePartyMember(memberId) {
    partyMembers = partyMembers.filter((m) => m.id !== memberId);
    renderPartyMembers();
    savePartyState();
}

/**
 * @param {string} avatarId
 * @param {{hp_current?: number, hp_max?: number, xp_current?: number, xp_next?: number, level?: number, gold?: number, silver?: number, copper?: number, inventory?: string, conditions?: string}} newState
 */
export function updatePartyMemberFromPersona(avatarId, newState) {
    let changed = false;
    partyMembers = partyMembers.map((member) => {
        if (member.personaId !== avatarId) {
            return member;
        }

        changed = true;
        return {
            ...member,
            level: newState.level ?? member.level,
            hp: newState.hp_current ?? member.hp,
            maxHp: newState.hp_max ?? member.maxHp,
            xp: newState.xp_current ?? member.xp,
            xpNext: newState.xp_next ?? member.xpNext,
            gold: newState.gold ?? member.gold,
            silver: newState.silver ?? member.silver,
            copper: newState.copper ?? member.copper,
            inventory: newState.inventory ?? member.inventory,
            conditions: newState.conditions ?? member.conditions,
        };
    });

    if (changed) {
        renderPartyMembers();
        savePartyState();
    }
}

export function initPartyPanel() {
    const panel = $('#rm_party_block');
    if (!panel.length) {
        return;
    }

    $('#party_add_button').off('click').on('click', async () => {
        /** @type {{[key: string]: string}} */
        const userPersonas = power_user?.personas || {};
        const personas = Object.keys(userPersonas);
        if (!personas.length) {
            // @ts-ignore
            toastr.warning(t`No personas found. Create a persona first.`);
            return;
        }

        const selectedPersona = await askForPersonaSelection(
            t`Select Persona`,
            t`Please select a persona to add to the party.`,
            personas,
            { highlightPersonas: false }
        );

        if (!selectedPersona) {
            return;
        }

        addPartyMember(selectedPersona);
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

    $(document).on('worldBoardsUpdated', () => {
        renderBoardsPreview();
    });

    /**
     * @param {'party'|'world_map'|'location'|'board'} tab
     */
    function setPartyTab(tab) {
        const worldMapRow = $('#world_map_row');
        const locationRow = $('#world_location_maps_row');
        const boardsRow = $('#world_boards_row');
        const partyList = $('#rm_party_list');
        const partyFixedTop = $('#partyListFixedTop');

        $('.right_menu_tab').removeClass('active');
        $(`#rm_tab_${tab}`).addClass('active');

        // show party pane and hidden others per tab
        partyList.toggleClass('tab-panel-hidden', tab !== 'party');
        partyFixedTop.toggleClass('tab-panel-hidden', tab !== 'party');
        worldMapRow.toggleClass('tab-panel-hidden', tab !== 'world_map');
        locationRow.toggleClass('tab-panel-hidden', tab !== 'location');
        boardsRow.toggleClass('tab-panel-hidden', tab !== 'board');

        if (tab === 'party') {
            renderPartyMembers();
        } else if (tab === 'world_map') {
            renderWorldMapPreview();
        } else if (tab === 'location') {
            renderLocationMapsPreview();
        } else if (tab === 'board') {
            renderBoardsPreview();
        }

        try {
            window.localStorage.setItem('rm_PinAndTabs_selectedTab', tab);
        } catch (e) {
            console.warn('Unable to store selected tab', e);
        }
    }

    $('#rm_tab_party').on('click', () => setPartyTab('party'));
    $('#rm_tab_world_map').on('click', () => setPartyTab('world_map'));
    $('#rm_tab_location').on('click', () => setPartyTab('location'));
    $('#rm_tab_board').on('click', () => setPartyTab('board'));

    $(document).on('click', '.party-remove-member', null, () => {
        // handled by individual buttons
    });

    loadPartyState();
    renderPartyMembers();
    renderWorldMapPreview();
    renderLocationMapsPreview();
    renderBoardsPreview();

    /** @type {'party'|'world_map'|'location'|'board'} */
    const initiallySelected = /** @type {'party'|'world_map'|'location'|'board'} */ (window.localStorage.getItem('rm_PinAndTabs_selectedTab') || 'party');
    if (typeof setPartyTab === 'function') {
        setPartyTab(initiallySelected);
    }
}
