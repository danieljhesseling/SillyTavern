import { t } from './i18n.js';
import { askForPersonaSelection } from './personas.js';
import { power_user } from './power-user.js';
import { getThumbnailUrl } from '../script.js';

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

        card.find('.party-card-remove').on('click', () => removePartyMember(member.id));
        list.append(card);
    }
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

    $(document).on('click', '.party-remove-member', null, () => {
        // handled by individual buttons
    });

    loadPartyState();
    renderPartyMembers();
}
